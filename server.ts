import http from 'http';
import path from 'path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  CharacterSkinId,
  ChatMessage,
  ClientToServerMsg,
  LobbyPlayer,
  MultiplayerMatchSnapshot,
  MultiplayerRoomState,
  RemotePlayerSnapshot,
  ServerToClientMsg,
  ServerZombieSnapshot,
  WeaponId,
  ZombieType,
} from './src/types/game.ts';

const PORT = Number(process.env.PORT || 3000);
const LOBBY_CAPACITY = 16;
const MAX_ROOM_PLAYERS = 4;
const ARENA_RADIUS = 52;

const ZOMBIE_BASE_STATS: Record<
  ZombieType,
  { hp: number; speed: number; damage: number; range: number; cooldown: number; coin: number; xp: number }
> = {
  normal: { hp: 100, speed: 2.6, damage: 14, range: 1.9, cooldown: 1.15, coin: 18, xp: 22 },
  fast: { hp: 68, speed: 4.8, damage: 11, range: 1.7, cooldown: 0.78, coin: 24, xp: 28 },
  tank: { hp: 360, speed: 1.8, damage: 32, range: 2.35, cooldown: 1.65, coin: 55, xp: 70 },
  female: { hp: 115, speed: 3.4, damage: 17, range: 1.8, cooldown: 0.95, coin: 28, xp: 34 },
  boss: { hp: 950, speed: 2.4, damage: 42, range: 2.6, cooldown: 1.45, coin: 220, xp: 250 },
};

const WEAPON_MAX_SINGLE_SHOT_DMG: Record<WeaponId, number> = {
  katana: 190,
  m1911: 120,
  uzi: 80,
  benelli_m4: 110,
  ak74: 140,
  m4: 135,
  m107: 950,
  m249: 130,
  m2: 310,
};

interface ClientSession {
  ws: WebSocket;
  playerId: string;
  username: string;
  avatarId: number;
  level: number;
  skin: CharacterSkinId;
  roomId: string | null;
}

interface ServerZombieEntity {
  id: number;
  type: ZombieType;
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  coinReward: number;
  xpReward: number;
  state: 'idle' | 'walk' | 'run' | 'attack' | 'dead';
  deathTimer: number;
}

interface MatchPlayerRuntime extends RemotePlayerSnapshot {
  lastShotAt: number;
  disconnectedAt: number | null;
}

interface RoomRuntime {
  state: MultiplayerRoomState;
  matchTimer: ReturnType<typeof setInterval> | null;
  countdownTimer: ReturnType<typeof setInterval> | null;
  wave: number;
  waveState: 'countdown' | 'active' | 'cleared';
  waveCountdown: number;
  waveTotalZombies: number;
  zombiesSpawned: number;
  zombiesRemaining: number;
  spawnTimer: number;
  nextZombieId: number;
  zombies: ServerZombieEntity[];
  players: Map<string, MatchPlayerRuntime>;
  winnerId: string | null;
}

const clients = new Map<string, ClientSession>();
const rooms = new Map<string, RoomRuntime>();

function sendTo(ws: WebSocket, msg: ServerToClientMsg): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastAll(msg: ServerToClientMsg): void {
  const raw = JSON.stringify(msg);
  clients.forEach((c) => {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(raw);
  });
}

function broadcastRoom(room: RoomRuntime, msg: ServerToClientMsg): void {
  const raw = JSON.stringify(msg);
  for (const m of room.state.members) {
    const c = clients.get(m.playerId);
    if (c && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(raw);
    }
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getWaveCount(wave: number): number {
  if (wave === 1) return 16;
  if (wave === 2) return 24;
  if (wave === 3) return 34;
  return Math.min(140, 34 + (wave - 3) * 14);
}

function broadcastLobbyState(): void {
  const players: LobbyPlayer[] = [];
  clients.forEach((c) => {
    const room = c.roomId ? rooms.get(c.roomId) : undefined;
    players.push({
      playerId: c.playerId,
      username: c.username,
      avatarId: c.avatarId,
      level: c.level,
      skin: c.skin,
      status: room
        ? room.state.status === 'playing'
          ? 'in-match'
          : 'room'
        : 'lobby',
      roomId: c.roomId,
    });
  });

  const roomList: MultiplayerRoomState[] = [];
  rooms.forEach((r) => {
    if (r.state.status !== 'ended') {
      roomList.push(r.state);
    }
  });

  broadcastAll({
    type: 'lobby:state',
    players: players.slice(0, LOBBY_CAPACITY),
    rooms: roomList,
  });
}

function chooseServerZombieType(wave: number, spawned: number): ZombieType {
  if (wave % 5 === 0 && spawned === 0) return 'boss' as ZombieType;
  const r = Math.random();
  if (wave === 1) return (r < 0.72 ? 'normal' : 'female') as ZombieType;
  if (wave === 2) return (r < 0.55 ? 'normal' : r < 0.8 ? 'female' : 'fast') as ZombieType;
  if (r < 0.35) return 'normal' as ZombieType;
  if (r < 0.6) return 'female' as ZombieType;
  if (r < 0.85) return 'fast' as ZombieType;
  return 'tank' as ZombieType;
}

function startRoomMatch(room: RoomRuntime): void {
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
  }
  room.state.status = 'playing';
  room.wave = 1;
  room.waveState = 'countdown';
  room.waveCountdown = 3.5;
  room.waveTotalZombies = getWaveCount(1);
  room.zombiesRemaining = room.waveTotalZombies;
  room.zombiesSpawned = 0;
  room.spawnTimer = 0;
  room.zombies = [];
  room.winnerId = null;
  room.players.clear();

  room.state.members.forEach((m, idx) => {
    const angle = (idx / Math.max(1, room.state.members.length)) * Math.PI * 2;
    const spawnDist = room.state.mode === 'competitive' ? 14 : 3.5;
    room.players.set(m.playerId, {
      playerId: m.playerId,
      username: m.username,
      avatarId: m.avatarId,
      skin: m.skin,
      weaponId: 'katana' as WeaponId,
      x: Math.cos(angle) * spawnDist,
      y: 0,
      z: Math.sin(angle) * spawnDist,
      yaw: 0,
      pitch: 0,
      health: 120,
      maxHealth: 120,
      alive: true,
      isMoving: false,
      isSprinting: false,
      isCrouching: false,
      isFiring: false,
      kills: 0,
      score: 0,
      lastShotAt: 0,
      disconnectedAt: null,
    });
  });

  broadcastRoom(room, { type: 'room:state', room: room.state });
  broadcastRoom(room, {
    type: 'match:started',
    roomId: room.state.roomId,
    mode: room.state.mode,
  });
  broadcastLobbyState();

  const dt = 0.05; // 20Hz authoritative loop
  room.matchTimer = setInterval(() => stepRoomMatch(room, dt), 50);
}

function stopRoomTimers(room: RoomRuntime): void {
  if (room.matchTimer) {
    clearInterval(room.matchTimer);
    room.matchTimer = null;
  }
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
  }
}

function stepRoomMatch(room: RoomRuntime, dt: number): void {
  if (room.state.status !== 'playing') {
    stopRoomTimers(room);
    return;
  }

  const alivePlayers = Array.from(room.players.values()).filter((p) => p.alive);

  // Check match end conditions
  if (alivePlayers.length === 0) {
    finishRoomMatch(room, null, 'Squad eliminated.');
    return;
  }
  if (room.state.mode === 'competitive' && room.players.size > 1 && alivePlayers.length === 1) {
    const survivor = alivePlayers[0];
    finishRoomMatch(room, survivor.playerId, `${survivor.username} is the Last Survivor!`);
    return;
  }

  // Wave manager
  if (room.waveState === 'countdown') {
    room.waveCountdown -= dt;
    if (room.waveCountdown <= 0) {
      room.waveState = 'active';
    }
  } else if (room.waveState === 'active') {
    const livingZ = room.zombies.filter((z) => z.state !== 'dead').length;
    const maxSim = Math.min(24, 10 + room.wave * 2 + room.players.size * 2);

    if (room.zombiesSpawned < room.waveTotalZombies && livingZ < maxSim) {
      room.spawnTimer -= dt;
      if (room.spawnTimer <= 0) {
        const zType = chooseServerZombieType(room.wave, room.zombiesSpawned);
        const cfg = ZOMBIE_BASE_STATS[zType];
        const angle = Math.random() * Math.PI * 2;
        const r = ARENA_RADIUS - 4;
        const hpScale = 1 + (room.wave - 1) * 0.18;
        const dmgScale = 1 + (room.wave - 1) * 0.08;
        const spdScale = 1 + Math.min(0.4, (room.wave - 1) * 0.03);

        room.zombies.push({
          id: room.nextZombieId++,
          type: zType,
          x: Math.cos(angle) * r,
          y: 0,
          z: Math.sin(angle) * r,
          yaw: 0,
          health: Math.round(cfg.hp * hpScale),
          maxHealth: Math.round(cfg.hp * hpScale),
          speed: cfg.speed * spdScale,
          damage: Math.round(cfg.damage * dmgScale),
          attackRange: cfg.range,
          attackCooldown: cfg.cooldown,
          attackTimer: 0.4,
          coinReward: cfg.coin + (room.wave - 1) * 2,
          xpReward: cfg.xp,
          state: 'walk',
          deathTimer: 0,
        });
        room.zombiesSpawned++;
        room.spawnTimer = Math.max(0.35, 1.05 - room.wave * 0.06);
      }
    } else if (room.zombiesRemaining <= 0 && livingZ === 0) {
      room.wave++;
      room.waveState = 'countdown';
      room.waveCountdown = 5.0;
      room.waveTotalZombies = getWaveCount(room.wave);
      room.zombiesRemaining = room.waveTotalZombies;
      room.zombiesSpawned = 0;
    }
  }

  // Step server zombies AI
  for (let i = room.zombies.length - 1; i >= 0; i--) {
    const z = room.zombies[i];
    if (z.state === 'dead') {
      z.deathTimer += dt;
      if (z.deathTimer > 3.0) room.zombies.splice(i, 1);
      continue;
    }

    // Target nearest living player
    let target: MatchPlayerRuntime | null = null;
    let bestDistSq = Infinity;
    for (const p of alivePlayers) {
      const dx = p.x - z.x;
      const dz = p.z - z.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        target = p;
      }
    }
    if (!target) continue;

    const dx = target.x - z.x;
    const dz = target.z - z.z;
    const dist = Math.sqrt(bestDistSq) || 0.001;
    z.yaw = Math.atan2(dx, dz);
    z.attackTimer = Math.max(0, z.attackTimer - dt);

    if (dist <= z.attackRange) {
      z.state = 'attack';
      if (z.attackTimer <= 0) {
        z.attackTimer = z.attackCooldown;
        target.health = Math.max(0, target.health - z.damage);
        if (target.health <= 0) target.alive = false;
        const targetClient = clients.get(target.playerId);
        if (targetClient) {
          sendTo(targetClient.ws, {
            type: 'match:player_damaged',
            targetPlayerId: target.playerId,
            health: target.health,
            damage: z.damage,
            attackerX: z.x,
            attackerZ: z.z,
          });
        }
      }
    } else {
      z.state = dist < 16 || z.type === 'fast' ? 'run' : 'walk';
      const spd = z.state === 'run' ? z.speed * 1.25 : z.speed;
      z.x += (dx / dist) * spd * dt;
      z.z += (dz / dist) * spd * dt;
    }
  }

  const snapshot: MultiplayerMatchSnapshot = {
    roomId: room.state.roomId,
    mode: room.state.mode,
    serverTime: Date.now(),
    wave: room.wave,
    waveState: room.waveState,
    waveCountdown: Math.max(0, Math.ceil(room.waveCountdown)),
    zombiesRemaining: room.zombiesRemaining,
    waveTotalZombies: room.waveTotalZombies,
    players: Array.from(room.players.values()),
    zombies: room.zombies.map(
      (z): ServerZombieSnapshot => ({
        id: z.id,
        type: z.type,
        x: z.x,
        y: z.y,
        z: z.z,
        yaw: z.yaw,
        health: z.health,
        maxHealth: z.maxHealth,
        state: z.state,
      })
    ),
    winnerId: room.winnerId,
  };

  broadcastRoom(room, { type: 'match:snapshot', snapshot });
}

function finishRoomMatch(room: RoomRuntime, winnerId: string | null, reason: string): void {
  stopRoomTimers(room);
  room.state.status = 'ended';
  room.winnerId = winnerId;
  const bonusCoins = 80 + room.wave * 35;
  const bonusXp = 120 + room.wave * 40;
  broadcastRoom(room, {
    type: 'match:ended',
    winnerId,
    reason,
    bonusCoins,
    bonusXp,
  });

  // Reset room to waiting for replay or cleanup if empty
  setTimeout(() => {
    const r = rooms.get(room.state.roomId);
    if (!r) return;
    if (r.state.members.length === 0) {
      rooms.delete(r.state.roomId);
    } else {
      r.state.status = 'waiting';
      r.state.members.forEach((m) => {
        m.ready = false;
      });
      broadcastRoom(r, { type: 'room:state', room: r.state });
      broadcastLobbyState();
    }
  }, 1500);
}

function leaveCurrentRoom(session: ClientSession): void {
  if (!session.roomId) return;
  const room = rooms.get(session.roomId);
  session.roomId = null;
  if (!room) return;

  room.state.members = room.state.members.filter((m) => m.playerId !== session.playerId);
  room.players.delete(session.playerId);

  if (room.state.members.length === 0) {
    stopRoomTimers(room);
    rooms.delete(room.state.roomId);
  } else {
    if (room.state.hostId === session.playerId) {
      room.state.hostId = room.state.members[0].playerId;
      room.state.members[0].isHost = true;
    }
    broadcastRoom(room, { type: 'room:state', room: room.state });
  }
  sendTo(session.ws, { type: 'room:state', room: null });
  broadcastLobbyState();
}

function createRoomForSession(
  session: ClientSession,
  name: string,
  mode: 'coop' | 'competitive'
): RoomRuntime {
  leaveCurrentRoom(session);
  const roomId = `room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const roomCode = generateRoomCode();
  const room: RoomRuntime = {
    state: {
      roomId,
      roomCode,
      name: (name || `${session.username}'s Squad`).slice(0, 28),
      mode,
      status: 'waiting',
      countdownSec: 0,
      hostId: session.playerId,
      maxPlayers: MAX_ROOM_PLAYERS,
      members: [
        {
          playerId: session.playerId,
          username: session.username,
          avatarId: session.avatarId,
          level: session.level,
          skin: session.skin,
          ready: true,
          isHost: true,
          connected: true,
        },
      ],
    },
    matchTimer: null,
    countdownTimer: null,
    wave: 1,
    waveState: 'countdown',
    waveCountdown: 3.5,
    waveTotalZombies: 16,
    zombiesSpawned: 0,
    zombiesRemaining: 16,
    spawnTimer: 0,
    nextZombieId: 1,
    zombies: [],
    players: new Map(),
    winnerId: null,
  };
  rooms.set(roomId, room);
  session.roomId = roomId;
  sendTo(session.ws, { type: 'room:state', room: room.state });
  broadcastLobbyState();
  return room;
}

function joinRoomForSession(session: ClientSession, roomCodeOrId: string): void {
  const key = roomCodeOrId.trim().toUpperCase();
  let target: RoomRuntime | undefined;
  rooms.forEach((r) => {
    if (r.state.roomId === roomCodeOrId.trim() || r.state.roomCode === key) {
      target = r;
    }
  });
  if (!target) {
    sendTo(session.ws, { type: 'error', message: 'Room not found or expired.' });
    return;
  }
  if (target.state.status === 'playing') {
    sendTo(session.ws, { type: 'error', message: 'Match already in progress.' });
    return;
  }
  if (target.state.members.length >= target.state.maxPlayers) {
    sendTo(session.ws, { type: 'error', message: 'Room is full (4/4).' });
    return;
  }

  leaveCurrentRoom(session);
  session.roomId = target.state.roomId;
  target.state.members.push({
    playerId: session.playerId,
    username: session.username,
    avatarId: session.avatarId,
    level: session.level,
    skin: session.skin,
    ready: false,
    isHost: false,
    connected: true,
  });
  broadcastRoom(target, { type: 'room:state', room: target.state });
  broadcastLobbyState();
}

async function bootstrapServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      playersOnline: clients.size,
      activeRooms: rooms.size,
      lobbyCapacity: LOBBY_CAPACITY,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let session: ClientSession | null = null;

    ws.on('message', (rawBuf) => {
      let msg: ClientToServerMsg;
      try {
        msg = JSON.parse(rawBuf.toString()) as ClientToServerMsg;
      } catch {
        return;
      }

      if (msg.type === 'auth:hello') {
        const pid = (msg.playerId || `OP-${Math.random().toString(36).slice(2, 8)}`).slice(0, 20);
        session = {
          ws,
          playerId: pid,
          username: (msg.username || 'Survivor').slice(0, 16),
          avatarId: Number(msg.avatarId) || 0,
          level: Math.max(1, Number(msg.level) || 1),
          skin: msg.skin || 'ranger',
          roomId: null,
        };
        clients.set(pid, session);
        sendTo(ws, { type: 'auth:welcome', playerId: pid, lobbyCapacity: LOBBY_CAPACITY });

        // Reconnect recovery into active match room if present
        if (msg.reconnectRoomId && rooms.has(msg.reconnectRoomId)) {
          const r = rooms.get(msg.reconnectRoomId)!;
          const member = r.state.members.find((m) => m.playerId === pid);
          if (member) {
            member.connected = true;
            session.roomId = r.state.roomId;
            const mp = r.players.get(pid);
            if (mp) mp.disconnectedAt = null;
            sendTo(ws, { type: 'room:state', room: r.state });
            if (r.state.status === 'playing') {
              sendTo(ws, { type: 'match:started', roomId: r.state.roomId, mode: r.state.mode });
            }
          }
        }
        broadcastLobbyState();
        return;
      }

      if (!session) return;

      switch (msg.type) {
        case 'profile:update': {
          session.username = (msg.username || session.username).slice(0, 16);
          session.avatarId = Number(msg.avatarId) || 0;
          session.level = Math.max(1, Number(msg.level) || 1);
          session.skin = msg.skin || session.skin;
          if (session.roomId) {
            const room = rooms.get(session.roomId);
            const mem = room?.state.members.find((m) => m.playerId === session!.playerId);
            if (mem && room) {
              mem.username = session.username;
              mem.avatarId = session.avatarId;
              mem.level = session.level;
              mem.skin = session.skin;
              broadcastRoom(room, { type: 'room:state', room: room.state });
            }
          }
          broadcastLobbyState();
          break;
        }

        case 'lobby:chat': {
          const text = msg.text.trim().slice(0, 160);
          if (!text) break;
          const chat: ChatMessage = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            channel: 'lobby',
            senderId: session.playerId,
            senderName: session.username,
            text,
            timestamp: Date.now(),
          };
          broadcastAll({ type: 'chat:message', message: chat });
          break;
        }

        case 'room:chat': {
          const room = session.roomId ? rooms.get(session.roomId) : null;
          const text = msg.text.trim().slice(0, 160);
          if (!room || !text) break;
          const chat: ChatMessage = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            channel: 'room',
            senderId: session.playerId,
            senderName: session.username,
            text,
            timestamp: Date.now(),
          };
          broadcastRoom(room, { type: 'chat:message', message: chat });
          break;
        }

        case 'lobby:invite': {
          const room = session.roomId ? rooms.get(session.roomId) : null;
          const target = clients.get(msg.targetPlayerId);
          if (room && target) {
            sendTo(target.ws, {
              type: 'lobby:invited',
              fromName: session.username,
              roomCode: room.state.roomCode,
              roomName: room.state.name,
            });
          }
          break;
        }

        case 'room:create': {
          createRoomForSession(session, msg.name, msg.mode);
          break;
        }

        case 'room:join': {
          joinRoomForSession(session, msg.roomCodeOrId);
          break;
        }

        case 'room:quick_match': {
          let openRoom: RoomRuntime | undefined;
          rooms.forEach((r) => {
            if (
              !openRoom &&
              r.state.status === 'waiting' &&
              r.state.mode === msg.mode &&
              r.state.members.length < r.state.maxPlayers
            ) {
              openRoom = r;
            }
          });
          if (openRoom) {
            joinRoomForSession(session, openRoom.state.roomId);
          } else {
            createRoomForSession(
              session,
              msg.mode === 'competitive' ? 'Survival Arena' : 'Co-op Squad',
              msg.mode
            );
          }
          break;
        }

        case 'room:leave': {
          leaveCurrentRoom(session);
          break;
        }

        case 'room:ready': {
          const room = session.roomId ? rooms.get(session.roomId) : null;
          if (!room || room.state.status !== 'waiting') break;
          const member = room.state.members.find((m) => m.playerId === session!.playerId);
          if (member) {
            member.ready = msg.ready;
            broadcastRoom(room, { type: 'room:state', room: room.state });
          }
          break;
        }

        case 'room:start': {
          const room = session.roomId ? rooms.get(session.roomId) : null;
          if (!room || room.state.hostId !== session.playerId || room.state.status !== 'waiting') {
            break;
          }
          room.state.status = 'countdown';
          room.state.countdownSec = 3;
          broadcastRoom(room, { type: 'room:state', room: room.state });

          room.countdownTimer = setInterval(() => {
            room.state.countdownSec--;
            if (room.state.countdownSec <= 0) {
              startRoomMatch(room);
            } else {
              broadcastRoom(room, { type: 'room:state', room: room.state });
            }
          }, 1000);
          break;
        }

        case 'match:player_state': {
          const room = session.roomId ? rooms.get(session.roomId) : null;
          if (!room || room.state.status !== 'playing') break;
          const mp = room.players.get(session.playerId);
          if (!mp || !mp.alive) break;

          // Anti-cheat spatial clamp inside forest bounds
          mp.x = Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, msg.x));
          mp.y = Math.max(-4, Math.min(12, msg.y));
          mp.z = Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, msg.z));
          mp.yaw = msg.yaw;
          mp.pitch = msg.pitch;
          mp.weaponId = msg.weaponId;
          mp.isMoving = msg.isMoving;
          mp.isSprinting = msg.isSprinting;
          mp.isCrouching = msg.isCrouching;
          mp.isFiring = msg.isFiring;
          break;
        }

        case 'match:shot_hit': {
          const room = session.roomId ? rooms.get(session.roomId) : null;
          if (!room || room.state.status !== 'playing') break;
          const shooter = room.players.get(session.playerId);
          if (!shooter || !shooter.alive) break;

          const maxPlausible = WEAPON_MAX_SINGLE_SHOT_DMG[msg.weaponId] ?? 200;
          const validatedDmg = Math.max(1, Math.min(maxPlausible, Math.round(msg.damage)));
          const z = room.zombies.find((item) => item.id === msg.zombieId);
          if (!z || z.state === 'dead') break;

          z.health -= validatedDmg;
          if (z.health <= 0) {
            z.health = 0;
            z.state = 'dead';
            z.deathTimer = 0;
            room.zombiesRemaining = Math.max(0, room.zombiesRemaining - 1);
            shooter.kills++;
            shooter.score += z.coinReward * 5;
            broadcastRoom(room, {
              type: 'match:zombie_killed',
              zombieId: z.id,
              killerId: shooter.playerId,
              coinReward: z.coinReward,
              xpReward: z.xpReward,
            });
          }
          break;
        }

        case 'match:use_medkit': {
          const room = session.roomId ? rooms.get(session.roomId) : null;
          const mp = room?.players.get(session.playerId);
          if (mp && mp.alive) {
            mp.health = Math.min(mp.maxHealth, mp.health + 60);
          }
          break;
        }

        case 'rtc:signal': {
          const target = clients.get(msg.targetPlayerId);
          if (target) {
            sendTo(target.ws, {
              type: 'rtc:signal',
              fromPlayerId: session.playerId,
              payload: msg.payload,
            });
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      if (!session) return;
      const pid = session.playerId;
      clients.delete(pid);
      if (session.roomId) {
        const room = rooms.get(session.roomId);
        if (room && room.state.status === 'playing') {
          const mem = room.state.members.find((m) => m.playerId === pid);
          if (mem) mem.connected = false;
          const mp = room.players.get(pid);
          if (mp) mp.disconnectedAt = Date.now();
          broadcastRoom(room, { type: 'room:state', room: room.state });
        } else {
          leaveCurrentRoom(session);
        }
      }
      broadcastLobbyState();
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ZOMBIE SHOOTER server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrapServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
