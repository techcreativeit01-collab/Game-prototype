import {
  ChatMessage,
  ClientToServerMsg,
  LobbyPlayer,
  MultiplayerMatchSnapshot,
  MultiplayerRoomState,
  PlayerProfile,
  ServerToClientMsg,
  WeaponId,
} from '../types/game';

export type MpConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface InviteNotice {
  fromName: string;
  roomCode: string;
  roomName: string;
}

export interface MatchStartMeta {
  isReconnect?: boolean;
  spawnX?: number;
  spawnZ?: number;
}

export interface MultiplayerListener {
  onStatusChange?: (status: MpConnectionStatus) => void;
  onAuthModeChange?: (mode: 'supabase' | 'guest', verifiedUserId: string | null) => void;
  onLobbyUpdate?: (players: LobbyPlayer[], rooms: MultiplayerRoomState[]) => void;
  onRoomUpdate?: (room: MultiplayerRoomState | null) => void;
  onChatMessage?: (msg: ChatMessage) => void;
  onInvited?: (invite: InviteNotice) => void;
  onMatchStarted?: (
    roomId: string,
    mode: 'coop' | 'competitive',
    meta?: MatchStartMeta
  ) => void;
  onMatchSnapshot?: (snapshot: MultiplayerMatchSnapshot) => void;
  onZombieKilled?: (
    zombieId: number,
    killerId: string,
    coinReward: number,
    xpReward: number
  ) => void;
  onPlayerDamaged?: (
    damage: number,
    attackerX: number,
    attackerZ: number,
    serverHealth: number,
    serverArmor: number
  ) => void;
  onMatchEnded?: (
    winnerId: string | null,
    reason: string,
    bonusCoins: number,
    bonusXp: number
  ) => void;
  onError?: (message: string) => void;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
  pendingCandidates: RTCIceCandidateInit[];
  iceRestartAttempts: number;
}

interface RtcSignalPayload {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

const TAB_ID_STORAGE_KEY = 'zs_mp_tab_id';
const ROOM_ID_STORAGE_KEY = 'zs_mp_room_id';
const HEARTBEAT_INTERVAL_MS = 10000;
const HEARTBEAT_TIMEOUT_MS = 18000;
const MAX_RECONNECT_ATTEMPTS = 12;
const MAX_QUEUED_CONTROLS = 20;
const DEFAULT_RENDER_WS_URL = 'wss://zombie-shooter-server-i03r.onrender.com/ws';

const QUEUEABLE_CONTROL_TYPES = new Set<ClientToServerMsg['type']>([
  'profile:update',
  'lobby:chat',
  'room:chat',
  'lobby:invite',
  'room:create',
  'room:join',
  'room:quick_match',
  'room:leave',
  'room:ready',
  'room:start',
]);

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private profile: PlayerProfile;
  private maxHealth = 120;
  private readonly networkPlayerId: string;
  private status: MpConnectionStatus = 'disconnected';
  private authenticated = false;
  private accessToken: string | null = null;
  private authMode: 'supabase' | 'guest' = 'guest';
  private verifiedUserId: string | null = null;
  private listeners = new Set<MultiplayerListener>();
  private lastRoomId: string | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private pingTimer: number | null = null;
  private lastPongAt = 0;
  private manuallyClosed = false;
  private browserEventsBound = false;
  private fallbackToRenderDefault = false;
  private pendingControlQueue: ClientToServerMsg[] = [];

  // Perfect Negotiation WebRTC peer mesh for squad voice chat
  private localStream: MediaStream | null = null;
  private peers = new Map<string, PeerEntry>();
  private micMuted = true;
  private voiceDeafened = false;

  lobbyPlayers: LobbyPlayer[] = [];
  rooms: MultiplayerRoomState[] = [];
  currentRoom: MultiplayerRoomState | null = null;
  chatMessages: ChatMessage[] = [];

  constructor(profile: PlayerProfile, maxHealth = 120) {
    this.profile = { ...profile };
    this.maxHealth = maxHealth;
    this.networkPlayerId = this.resolveTabNetworkId(profile.playerId);
    this.lastRoomId = this.readStoredRoomId();
  }

  private resolveTabNetworkId(baseId: string): string {
    if (typeof window === 'undefined') {
      return `${baseId.slice(0, 12)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    }
    try {
      const existing = window.sessionStorage.getItem(TAB_ID_STORAGE_KEY);
      if (existing && existing.length >= 6) return existing.slice(0, 24);
      const generated = `${baseId.slice(0, 12)}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;
      window.sessionStorage.setItem(TAB_ID_STORAGE_KEY, generated);
      return generated;
    } catch {
      return `${baseId.slice(0, 12)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    }
  }

  private readStoredRoomId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.sessionStorage.getItem(ROOM_ID_STORAGE_KEY);
      return stored && stored.trim().length > 0 ? stored : null;
    } catch {
      return null;
    }
  }

  private persistRoomId(roomId: string | null): void {
    this.lastRoomId = roomId;
    if (typeof window === 'undefined') return;
    try {
      if (roomId) {
        window.sessionStorage.setItem(ROOM_ID_STORAGE_KEY, roomId);
      } else {
        window.sessionStorage.removeItem(ROOM_ID_STORAGE_KEY);
      }
    } catch {
      // ignore storage quota / privacy mode errors
    }
  }

  getNetworkPlayerId(): string {
    return this.networkPlayerId;
  }

  subscribe(listener: MultiplayerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getStatus(): MpConnectionStatus {
    return this.status;
  }

  getAuthMode(): 'supabase' | 'guest' {
    return this.authMode;
  }

  getVerifiedUserId(): string | null {
    return this.verifiedUserId;
  }

  setAccessToken(token: string | null): void {
    const changed = this.accessToken !== token;
    this.accessToken = token;
    if (changed && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendHello();
    }
  }

  isMicActive(): boolean {
    return !this.micMuted;
  }

  isDeafened(): boolean {
    return this.voiceDeafened;
  }

  private handleBrowserOnline = (): void => {
    if (this.manuallyClosed) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.clearReconnectTimer();
      this.reconnectAttempts = 0;
      this.connect();
    }
  };

  private handleVisibilityChange = (): void => {
    if (this.manuallyClosed || typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible') return;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.clearReconnectTimer();
      this.reconnectAttempts = 0;
      this.connect();
    } else if (this.authenticated) {
      // Probe socket health immediately after returning from background tab
      if (Date.now() - this.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
        this.ws.close(4001, 'Stale background socket');
      } else {
        this.sendRaw({ type: 'ping' });
      }
    }
  };

  private bindBrowserEvents(): void {
    if (this.browserEventsBound || typeof window === 'undefined') return;
    this.browserEventsBound = true;
    window.addEventListener('online', this.handleBrowserOnline);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private unbindBrowserEvents(): void {
    if (!this.browserEventsBound || typeof window === 'undefined') return;
    this.browserEventsBound = false;
    window.removeEventListener('online', this.handleBrowserOnline);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  private resolveWebSocketUrl(): { url: string; source: 'env' | 'localhost' | 'render-default' } {
    if (this.fallbackToRenderDefault) {
      return { url: DEFAULT_RENDER_WS_URL, source: 'render-default' };
    }

    const rawOverride = (import.meta.env.VITE_MULTIPLAYER_WS_URL ?? '').trim();

    if (rawOverride) {
      let normalized = rawOverride.replace(/\/+$/, '');
      if (normalized.startsWith('https://')) {
        normalized = `wss://${normalized.slice('https://'.length)}`;
      } else if (normalized.startsWith('http://')) {
        normalized = `ws://${normalized.slice('http://'.length)}`;
      } else if (!normalized.startsWith('ws://') && !normalized.startsWith('wss://')) {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        normalized = `${proto}//${normalized}`;
      }
      if (!normalized.endsWith('/ws')) {
        normalized = `${normalized}/ws`;
      }

      try {
        const parsed = new URL(normalized);
        if (
          parsed.hostname === 'zombie-shooter-server.onrender.com' ||
          parsed.hostname.endsWith('.vercel.app')
        ) {
          console.warn(
            `[Multiplayer] Ignoring invalid/unreachable VITE_MULTIPLAYER_WS_URL "${normalized}"; using live Render backend ${DEFAULT_RENDER_WS_URL}`
          );
          return { url: DEFAULT_RENDER_WS_URL, source: 'render-default' };
        }
      } catch {
        // Invalid URL format will be handled cleanly by new WebSocket() try/catch
      }

      return { url: normalized, source: 'env' };
    }

    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return { url: `${proto}//${window.location.host}/ws`, source: 'localhost' };
    }

    return { url: DEFAULT_RENDER_WS_URL, source: 'render-default' };
  }

  getWebSocketUrl(): string {
    if (typeof window === 'undefined') return DEFAULT_RENDER_WS_URL;
    return this.resolveWebSocketUrl().url;
  }

  reconnect(): void {
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    this.fallbackToRenderDefault = false;
    this.manuallyClosed = false;
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      const stale = this.ws;
      this.ws = null;
      try {
        stale.close(4002, 'Manual reconnect requested');
      } catch {
        // ignore close error on pending socket
      }
    }
    this.connect();
  }

  connect(maxHealth?: number): void {
    if (typeof maxHealth === 'number') this.maxHealth = maxHealth;
    if (typeof window === 'undefined') return;

    this.bindBrowserEvents();

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.clearReconnectTimer();
    this.manuallyClosed = false;
    this.authenticated = false;
    this.setStatus('connecting');

    const { url: wsUrl, source } = this.resolveWebSocketUrl();
    if (source === 'render-default') {
      console.warn(
        `[Multiplayer] VITE_MULTIPLAYER_WS_URL is not set; using Render backend ${wsUrl}`
      );
    } else {
      console.info(`[Multiplayer] Connecting to WebSocket (${source}): ${wsUrl}`);
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Multiplayer] Invalid WebSocket URL "${wsUrl}":`, err);
      this.ws = null;
      this.setStatus('disconnected');
      this.listeners.forEach((l) =>
        l.onError?.(`Invalid multiplayer WebSocket URL (${wsUrl}): ${errMsg}`)
      );
      return;
    }

    this.ws = ws;
    let hadSocketError = false;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      console.info(`[Multiplayer] WebSocket connected: ${wsUrl}`);
      this.lastPongAt = Date.now();
      this.startHeartbeat(ws);
      this.sendHello();
    };

    ws.onmessage = (evt) => {
      if (this.ws !== ws) return;
      this.lastPongAt = Date.now();
      try {
        const msg = JSON.parse(String(evt.data)) as ServerToClientMsg;
        this.handleServerMessage(msg);
      } catch (err) {
        console.warn('[Multiplayer] Ignored malformed WebSocket message:', err);
      }
    };

    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      const wasAuthed = this.authenticated;
      this.stopHeartbeat();
      this.authenticated = false;
      this.ws = null;
      this.setStatus('disconnected');

      console.warn('[Multiplayer] WebSocket closed', {
        url: wsUrl,
        code: event.code,
        reason: event.reason || '(none)',
        wasClean: event.wasClean,
        wasAuthenticated: wasAuthed,
      });

      if (!this.manuallyClosed) {
        if (
          !wasAuthed &&
          (hadSocketError || event.code === 1006) &&
          source === 'env' &&
          wsUrl !== DEFAULT_RENDER_WS_URL
        ) {
          console.warn(
            `[Multiplayer] Primary WS URL ${wsUrl} failed before auth; falling back to ${DEFAULT_RENDER_WS_URL}`
          );
          this.fallbackToRenderDefault = true;
        }
        if (hadSocketError || !event.wasClean || event.code === 1006) {
          const detail = event.reason ? ` (${event.code}: ${event.reason})` : ` (code ${event.code})`;
          this.listeners.forEach((l) =>
            l.onError?.(
              `Unable to reach multiplayer server at ${wsUrl}${detail}. Retrying...`
            )
          );
        }
        this.scheduleReconnect();
      }
    };

    ws.onerror = (event) => {
      if (this.ws !== ws) return;
      hadSocketError = true;
      console.error(`[Multiplayer] WebSocket connection error on ${wsUrl}`, {
        readyState: ws.readyState,
        event,
      });
    };
  }

  private sendHello(): void {
    this.sendRaw({
      type: 'auth:hello',
      playerId: this.networkPlayerId,
      username: this.profile.username,
      avatarId: this.profile.avatarId,
      level: this.profile.level,
      skin: this.profile.selectedCharacterSkin,
      maxHealth: this.maxHealth,
      reconnectRoomId: this.lastRoomId ?? undefined,
      accessToken: this.accessToken ?? undefined,
    });
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.authenticated = false;
    this.pendingControlQueue = [];
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.unbindBrowserEvents();
    this.teardownVoice();
    const activeWs = this.ws;
    this.ws = null;
    if (activeWs) {
      try {
        activeWs.close();
      } catch {
        // ignore close errors
      }
    }
    this.setStatus('disconnected');
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(ws: WebSocket): void {
    this.stopHeartbeat();
    this.pingTimer = window.setInterval(() => {
      if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) {
        this.stopHeartbeat();
        return;
      }
      if (Date.now() - this.lastPongAt > HEARTBEAT_TIMEOUT_MS) {
        console.warn('[Multiplayer] Heartbeat timeout; closing stale WebSocket');
        this.stopHeartbeat();
        ws.close(4001, 'Heartbeat timeout');
        return;
      }
      this.sendRaw({ type: 'ping' });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.manuallyClosed) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      const wsUrl = this.resolveWebSocketUrl().url;
      console.error(
        `[Multiplayer] Reconnect aborted after ${MAX_RECONNECT_ATTEMPTS} attempts (${wsUrl})`
      );
      this.listeners.forEach((l) =>
        l.onError?.(
          `Connection to ${wsUrl} failed after ${MAX_RECONNECT_ATTEMPTS} retries. Click Reconnect to try again.`
        )
      );
      return;
    }

    const baseDelay = Math.min(15000, 1000 * Math.pow(2, this.reconnectAttempts));
    const jitteredDelay = Math.round(baseDelay * (0.75 + Math.random() * 0.5));
    this.reconnectAttempts++;
    console.info(
      `[Multiplayer] Scheduling reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${jitteredDelay}ms`
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manuallyClosed) {
        this.connect();
      }
    }, jitteredDelay);
  }

  private setStatus(next: MpConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.listeners.forEach((l) => l.onStatusChange?.(next));
  }

  private sendRaw(msg: ClientToServerMsg): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  send(msg: ClientToServerMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.authenticated) {
      this.ws.send(JSON.stringify(msg));
      return;
    }

    if (QUEUEABLE_CONTROL_TYPES.has(msg.type)) {
      if (msg.type === 'room:leave') {
        this.pendingControlQueue = this.pendingControlQueue.filter(
          (q) => !q.type.startsWith('room:')
        );
      } else if (msg.type === 'profile:update') {
        this.pendingControlQueue = this.pendingControlQueue.filter(
          (q) => q.type !== 'profile:update'
        );
      }
      if (this.pendingControlQueue.length >= MAX_QUEUED_CONTROLS) {
        this.pendingControlQueue.shift();
      }
      this.pendingControlQueue.push(msg);

      if (
        !this.manuallyClosed &&
        (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING)
      ) {
        this.clearReconnectTimer();
        this.reconnectAttempts = 0;
        this.connect();
      }
    }
  }

  private flushPendingControls(): void {
    if (!this.authenticated || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.pendingControlQueue.length === 0) return;
    const queued = this.pendingControlQueue.splice(0, this.pendingControlQueue.length);
    for (const msg of queued) {
      this.sendRaw(msg);
    }
  }

  updateProfile(profile: PlayerProfile, maxHealth?: number): void {
    this.profile = { ...profile };
    if (typeof maxHealth === 'number') this.maxHealth = maxHealth;
    this.send({
      type: 'profile:update',
      username: profile.username,
      avatarId: profile.avatarId,
      level: profile.level,
      skin: profile.selectedCharacterSkin,
      maxHealth: this.maxHealth,
    });
  }

  createRoom(name: string, mode: 'coop' | 'competitive'): void {
    this.send({ type: 'room:create', name, mode });
  }

  joinRoom(roomCodeOrId: string): void {
    this.send({ type: 'room:join', roomCodeOrId });
  }

  quickMatch(mode: 'coop' | 'competitive'): void {
    this.send({ type: 'room:quick_match', mode });
  }

  leaveRoom(): void {
    this.persistRoomId(null);
    this.send({ type: 'room:leave' });
  }

  setReady(ready: boolean): void {
    this.send({ type: 'room:ready', ready });
  }

  startMatch(): void {
    this.send({ type: 'room:start' });
  }

  invitePlayer(targetPlayerId: string): void {
    this.send({ type: 'lobby:invite', targetPlayerId });
  }

  sendChat(channel: 'lobby' | 'room', text: string): void {
    if (!text.trim()) return;
    this.send(channel === 'lobby' ? { type: 'lobby:chat', text } : { type: 'room:chat', text });
  }

  sendPlayerState(payload: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    weaponId: WeaponId;
    isMoving: boolean;
    isSprinting: boolean;
    isCrouching: boolean;
    isFiring: boolean;
  }): void {
    this.send({ type: 'match:player_state', ...payload });
  }

  sendShotHit(
    zombieId: number,
    damage: number,
    headshot: boolean,
    weaponId: WeaponId,
    source: 'weapon' | 'grenade' | 'turret' = 'weapon'
  ): void {
    this.send({ type: 'match:shot_hit', zombieId, damage, headshot, weaponId, source });
  }

  sendUseConsumable(kind: 'medkit' | 'armor'): void {
    this.send({ type: kind === 'medkit' ? 'match:use_medkit' : 'match:use_armor' });
  }

  async toggleMicrophone(): Promise<boolean> {
    if (this.micMuted) {
      try {
        if (!this.localStream && navigator.mediaDevices?.getUserMedia) {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        this.localStream?.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });
        this.micMuted = false;
        this.attachLocalTracksToExistingPeers();
        this.connectSquadVoicePeers();
      } catch {
        this.listeners.forEach((l) => l.onError?.('Microphone permission denied or unavailable.'));
        this.micMuted = true;
      }
    } else {
      this.micMuted = true;
      this.localStream?.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
    }
    return !this.micMuted;
  }

  toggleDeafen(): boolean {
    this.voiceDeafened = !this.voiceDeafened;
    const audios = document.querySelectorAll<HTMLAudioElement>('audio[data-mp-voice="true"]');
    audios.forEach((a) => {
      a.muted = this.voiceDeafened;
    });
    return this.voiceDeafened;
  }

  private attachLocalTracksToExistingPeers(): void {
    if (!this.localStream) return;
    const tracks = this.localStream.getTracks();
    this.peers.forEach((entry, remoteId) => {
      if (entry.pc.signalingState === 'closed') return;
      const existingSenders = entry.pc.getSenders();
      let addedTrack = false;
      for (const track of tracks) {
        if (!existingSenders.some((s) => s.track?.id === track.id)) {
          entry.pc.addTrack(track, this.localStream!);
          addedTrack = true;
        }
      }
      if (addedTrack && entry.pc.signalingState === 'stable' && !entry.makingOffer) {
        void this.initiatePeerOffer(remoteId);
      }
    });
  }

  private connectSquadVoicePeers(): void {
    if (!this.currentRoom) return;
    for (const m of this.currentRoom.members) {
      if (m.playerId === this.networkPlayerId || !m.connected) continue;
      const existing = this.peers.get(m.playerId);
      if (!existing || existing.pc.signalingState === 'closed') {
        void this.initiatePeerOffer(m.playerId);
      }
    }
  }

  private pruneStalePeers(room: MultiplayerRoomState | null): void {
    if (!room) {
      this.closeVoicePeers();
      return;
    }
    const memberIds = new Set(room.members.map((m) => m.playerId));
    for (const remoteId of Array.from(this.peers.keys())) {
      if (!memberIds.has(remoteId)) {
        this.cleanupPeer(remoteId);
      }
    }
  }

  private cleanupPeer(remoteId: string): void {
    const entry = this.peers.get(remoteId);
    if (entry) {
      entry.pc.onicecandidate = null;
      entry.pc.ontrack = null;
      entry.pc.oniceconnectionstatechange = null;
      entry.pc.onconnectionstatechange = null;
      try {
        entry.pc.close();
      } catch {
        // ignore close error
      }
      this.peers.delete(remoteId);
    }
    document
      .querySelectorAll<HTMLAudioElement>(`audio[data-mp-voice="true"][data-peer="${remoteId}"]`)
      .forEach((el) => el.remove());
  }

  private closeVoicePeers(): void {
    for (const remoteId of Array.from(this.peers.keys())) {
      this.cleanupPeer(remoteId);
    }
    document.querySelectorAll('audio[data-mp-voice="true"]').forEach((el) => el.remove());
  }

  private getOrCreatePeerEntry(remoteId: string): PeerEntry {
    const existing = this.peers.get(remoteId);
    if (existing && existing.pc.signalingState !== 'closed') {
      return existing;
    }
    if (existing) {
      this.cleanupPeer(remoteId);
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    const entry: PeerEntry = {
      pc,
      polite: this.networkPlayerId < remoteId,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      pendingCandidates: [],
      iceRestartAttempts: 0,
    };
    this.peers.set(remoteId, entry);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.onicecandidate = (e) => {
      if (this.peers.get(remoteId) !== entry) return;
      if (e.candidate) {
        this.send({
          type: 'rtc:signal',
          targetPlayerId: remoteId,
          payload: { candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (this.peers.get(remoteId) !== entry) return;
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        entry.iceRestartAttempts = 0;
      } else if (pc.iceConnectionState === 'failed') {
        if (entry.iceRestartAttempts < 2) {
          entry.iceRestartAttempts++;
          void this.restartPeerIce(remoteId);
        } else {
          this.cleanupPeer(remoteId);
        }
      } else if (pc.iceConnectionState === 'closed') {
        this.cleanupPeer(remoteId);
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.peers.get(remoteId) !== entry) return;
      if (pc.connectionState === 'closed') {
        this.cleanupPeer(remoteId);
      } else if (pc.connectionState === 'failed' && entry.iceRestartAttempts >= 2) {
        this.cleanupPeer(remoteId);
      }
    };

    pc.ontrack = (e) => {
      if (this.peers.get(remoteId) !== entry) return;
      let audioEl = document.querySelector<HTMLAudioElement>(
        `audio[data-mp-voice="true"][data-peer="${remoteId}"]`
      );
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.dataset.mpVoice = 'true';
        audioEl.dataset.peer = remoteId;
        audioEl.muted = this.voiceDeafened;
        document.body.appendChild(audioEl);
      }
      audioEl.srcObject = e.streams[0] ?? new MediaStream([e.track]);
    };

    return entry;
  }

  private async restartPeerIce(remoteId: string): Promise<void> {
    const entry = this.peers.get(remoteId);
    if (!entry || entry.pc.signalingState !== 'stable' || entry.makingOffer) return;
    try {
      entry.makingOffer = true;
      const offer = await entry.pc.createOffer({ iceRestart: true });
      if (this.peers.get(remoteId) !== entry || entry.pc.signalingState !== 'stable') return;
      await entry.pc.setLocalDescription(offer);
      if (entry.pc.localDescription) {
        this.send({
          type: 'rtc:signal',
          targetPlayerId: remoteId,
          payload: { sdp: entry.pc.localDescription },
        });
      }
    } catch {
      // ignore ICE restart errors on disconnected peers
    } finally {
      entry.makingOffer = false;
    }
  }

  private async initiatePeerOffer(remoteId: string): Promise<void> {
    const entry = this.getOrCreatePeerEntry(remoteId);
    if (entry.makingOffer || entry.pc.signalingState !== 'stable') return;

    try {
      entry.makingOffer = true;
      const offer = await entry.pc.createOffer();
      if (this.peers.get(remoteId) !== entry || entry.pc.signalingState !== 'stable') {
        return;
      }
      await entry.pc.setLocalDescription(offer);
      if (entry.pc.localDescription) {
        this.send({
          type: 'rtc:signal',
          targetPlayerId: remoteId,
          payload: { sdp: entry.pc.localDescription },
        });
      }
    } catch {
      // ignore WebRTC setup failure on restricted networks
    } finally {
      entry.makingOffer = false;
    }
  }

  private async flushPendingCandidates(entry: PeerEntry): Promise<void> {
    if (!entry.pc.remoteDescription || !entry.pc.remoteDescription.type) return;
    while (entry.pendingCandidates.length > 0) {
      const candidate = entry.pendingCandidates.shift()!;
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore stale ICE candidate
      }
    }
  }

  private async handleRtcSignal(fromId: string, payload: unknown): Promise<void> {
    if (!payload || typeof payload !== 'object') return;
    if (!this.currentRoom?.members.some((m) => m.playerId === fromId)) return;

    const data = payload as RtcSignalPayload;
    const entry = this.getOrCreatePeerEntry(fromId);
    const { pc } = entry;

    try {
      if (data.sdp) {
        const description = new RTCSessionDescription(data.sdp);
        const readyForOffer =
          !entry.makingOffer &&
          (pc.signalingState === 'stable' || entry.isSettingRemoteAnswerPending);
        const offerCollision = description.type === 'offer' && !readyForOffer;

        entry.ignoreOffer = !entry.polite && offerCollision;
        if (entry.ignoreOffer) return;

        if (description.type === 'answer') {
          if (pc.signalingState !== 'have-local-offer') {
            return;
          }
          entry.isSettingRemoteAnswerPending = true;
        } else if (offerCollision && entry.polite && pc.signalingState !== 'stable') {
          await pc.setLocalDescription({ type: 'rollback' }).catch(() => undefined);
        }

        try {
          await pc.setRemoteDescription(description);
        } finally {
          entry.isSettingRemoteAnswerPending = false;
        }

        await this.flushPendingCandidates(entry);

        if (description.type === 'offer') {
          const answer = await pc.createAnswer();
          if (this.peers.get(fromId) !== entry) return;
          await pc.setLocalDescription(answer);
          if (pc.localDescription) {
            this.send({
              type: 'rtc:signal',
              targetPlayerId: fromId,
              payload: { sdp: pc.localDescription },
            });
          }
        }
      } else if (data.candidate) {
        if (entry.ignoreOffer) return;
        if (!pc.remoteDescription || !pc.remoteDescription.type) {
          if (entry.pendingCandidates.length < 64) {
            entry.pendingCandidates.push(data.candidate);
          }
          return;
        }
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          if (!entry.ignoreOffer) {
            // ignore mismatched ICE candidate
          }
        }
      }
    } catch {
      // keep signaling resilient against transient state races
    }
  }

  private teardownVoice(): void {
    this.closeVoicePeers();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.micMuted = true;
  }

  private handleServerMessage(msg: ServerToClientMsg): void {
    switch (msg.type) {
      case 'auth:welcome':
        this.authenticated = true;
        this.reconnectAttempts = 0;
        this.authMode = msg.authMode ?? 'guest';
        this.verifiedUserId = msg.verifiedUserId ?? null;
        if (msg.reconnectedRoomId === null) {
          this.persistRoomId(null);
        } else if (msg.reconnectedRoomId) {
          this.persistRoomId(msg.reconnectedRoomId);
        }
        console.info('[Multiplayer] Authenticated', {
          playerId: msg.playerId,
          authMode: this.authMode,
          reconnectedRoomId: msg.reconnectedRoomId ?? null,
        });
        this.setStatus('connected');
        this.listeners.forEach((l) => l.onAuthModeChange?.(this.authMode, this.verifiedUserId));
        this.flushPendingControls();
        break;
      case 'pong':
        this.lastPongAt = Date.now();
        break;
      case 'lobby:state':
        this.lobbyPlayers = msg.players;
        this.rooms = msg.rooms;
        this.listeners.forEach((l) => l.onLobbyUpdate?.(msg.players, msg.rooms));
        break;
      case 'room:state':
        this.currentRoom = msg.room;
        this.persistRoomId(msg.room ? msg.room.roomId : null);
        this.pruneStalePeers(msg.room);
        if (msg.room && !this.micMuted) {
          this.connectSquadVoicePeers();
        }
        this.listeners.forEach((l) => l.onRoomUpdate?.(msg.room));
        break;
      case 'chat:message':
        this.chatMessages = [...this.chatMessages.slice(-49), msg.message];
        this.listeners.forEach((l) => l.onChatMessage?.(msg.message));
        break;
      case 'lobby:invited':
        this.listeners.forEach((l) =>
          l.onInvited?.({
            fromName: msg.fromName,
            roomCode: msg.roomCode,
            roomName: msg.roomName,
          })
        );
        break;
      case 'match:started':
        this.listeners.forEach((l) =>
          l.onMatchStarted?.(msg.roomId, msg.mode, {
            isReconnect: msg.isReconnect,
            spawnX: msg.spawnX,
            spawnZ: msg.spawnZ,
          })
        );
        break;
      case 'match:snapshot':
        this.listeners.forEach((l) => l.onMatchSnapshot?.(msg.snapshot));
        break;
      case 'match:zombie_killed':
        this.listeners.forEach((l) =>
          l.onZombieKilled?.(msg.zombieId, msg.killerId, msg.coinReward, msg.xpReward)
        );
        break;
      case 'match:player_damaged':
        if (msg.targetPlayerId === this.networkPlayerId) {
          this.listeners.forEach((l) =>
            l.onPlayerDamaged?.(
              msg.damage,
              msg.attackerX,
              msg.attackerZ,
              msg.health,
              msg.armor
            )
          );
        }
        break;
      case 'match:ended':
        this.listeners.forEach((l) =>
          l.onMatchEnded?.(msg.winnerId, msg.reason, msg.bonusCoins, msg.bonusXp)
        );
        break;
      case 'rtc:signal':
        void this.handleRtcSignal(msg.fromPlayerId, msg.payload);
        break;
      case 'error':
        console.error('[Multiplayer] Server error:', msg.message);
        this.listeners.forEach((l) => l.onError?.(msg.message));
        break;
    }
  }
}
