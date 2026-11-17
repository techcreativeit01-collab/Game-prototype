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

export interface MultiplayerListener {
  onStatusChange?: (status: MpConnectionStatus) => void;
  onLobbyUpdate?: (players: LobbyPlayer[], rooms: MultiplayerRoomState[]) => void;
  onRoomUpdate?: (room: MultiplayerRoomState | null) => void;
  onChatMessage?: (msg: ChatMessage) => void;
  onInvited?: (invite: InviteNotice) => void;
  onMatchStarted?: (roomId: string, mode: 'coop' | 'competitive') => void;
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

const TAB_ID_STORAGE_KEY = 'zs_mp_tab_id';

export class MultiplayerClient {
  private ws: WebSocket | null = null;
  private profile: PlayerProfile;
  private maxHealth = 120;
  private readonly networkPlayerId: string;
  private status: MpConnectionStatus = 'disconnected';
  private listeners = new Set<MultiplayerListener>();
  private lastRoomId: string | null = null;
  private reconnectTimer: number | null = null;
  private manuallyClosed = false;

  // Optional WebRTC peer mesh for squad voice chat
  private localStream: MediaStream | null = null;
  private peers = new Map<string, RTCPeerConnection>();
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

  isMicActive(): boolean {
    return !this.micMuted;
  }

  isDeafened(): boolean {
    return this.voiceDeafened;
  }

  connect(maxHealth?: number): void {
    if (typeof maxHealth === 'number') this.maxHealth = maxHealth;
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.manuallyClosed = false;
    this.setStatus('connecting');

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      this.setStatus('connected');
      this.send({
        type: 'auth:hello',
        playerId: this.networkPlayerId,
        username: this.profile.username,
        avatarId: this.profile.avatarId,
        level: this.profile.level,
        skin: this.profile.selectedCharacterSkin,
        maxHealth: this.maxHealth,
        reconnectRoomId: this.lastRoomId ?? undefined,
      });
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(String(evt.data)) as ServerToClientMsg;
        this.handleServerMessage(msg);
      } catch {
        // ignore malformed packets
      }
    };

    ws.onclose = () => {
      this.setStatus('disconnected');
      this.ws = null;
      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // handled by onclose
    };
  }

  disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.teardownVoice();
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manuallyClosed) this.connect();
    }, 2500);
  }

  private setStatus(next: MpConnectionStatus): void {
    this.status = next;
    this.listeners.forEach((l) => l.onStatusChange?.(next));
  }

  send(msg: ClientToServerMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
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
    this.lastRoomId = null;
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

  private connectSquadVoicePeers(): void {
    if (!this.currentRoom) return;
    for (const m of this.currentRoom.members) {
      if (m.playerId === this.networkPlayerId || this.peers.has(m.playerId)) continue;
      void this.initiatePeerOffer(m.playerId);
    }
  }

  private closeVoicePeers(): void {
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    document.querySelectorAll('audio[data-mp-voice="true"]').forEach((el) => el.remove());
  }

  private createPeerConnection(remoteId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.peers.set(remoteId, pc);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.send({
          type: 'rtc:signal',
          targetPlayerId: remoteId,
          payload: { candidate: e.candidate },
        });
      }
    };

    pc.ontrack = (e) => {
      let audioEl = document.querySelector<HTMLAudioElement>(
        `audio[data-peer="${remoteId}"]`
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

    return pc;
  }

  private async initiatePeerOffer(remoteId: string): Promise<void> {
    try {
      const pc = this.createPeerConnection(remoteId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.send({
        type: 'rtc:signal',
        targetPlayerId: remoteId,
        payload: { sdp: pc.localDescription },
      });
    } catch {
      // ignore WebRTC setup failure on restricted networks
    }
  }

  private async handleRtcSignal(fromId: string, payload: unknown): Promise<void> {
    try {
      const data = payload as { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
      let pc = this.peers.get(fromId);
      if (!pc) pc = this.createPeerConnection(fromId);

      if (data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.send({
            type: 'rtc:signal',
            targetPlayerId: fromId,
            payload: { sdp: pc.localDescription },
          });
        }
      } else if (data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch {
      // ignore signaling race
    }
  }

  private teardownVoice(): void {
    this.peers.forEach((pc) => pc.close());
    this.peers.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.micMuted = true;
    document.querySelectorAll('audio[data-mp-voice="true"]').forEach((el) => el.remove());
  }

  private handleServerMessage(msg: ServerToClientMsg): void {
    switch (msg.type) {
      case 'lobby:state':
        this.lobbyPlayers = msg.players;
        this.rooms = msg.rooms;
        this.listeners.forEach((l) => l.onLobbyUpdate?.(msg.players, msg.rooms));
        break;
      case 'room:state':
        this.currentRoom = msg.room;
        this.lastRoomId = msg.room ? msg.room.roomId : null;
        if (!msg.room) {
          this.closeVoicePeers();
        } else if (!this.micMuted) {
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
        this.listeners.forEach((l) => l.onMatchStarted?.(msg.roomId, msg.mode));
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
        this.listeners.forEach((l) => l.onError?.(msg.message));
        break;
    }
  }
}
