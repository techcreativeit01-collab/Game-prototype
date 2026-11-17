export enum WeaponId {
  KATANA = 'katana',
  M1911 = 'm1911',
  UZI = 'uzi',
  BENELLI_M4 = 'benelli_m4',
  AK74 = 'ak74',
  M4 = 'm4',
  M107 = 'm107',
  M249 = 'm249',
  M2 = 'm2',
}

export enum ZombieType {
  NORMAL = 'normal',
  FAST = 'fast',
  TANK = 'tank',
  FEMALE = 'female',
  BOSS = 'boss',
}

export enum EquipmentId {
  MEDKIT = 'medkit',
  ARMOR_PLATE = 'armor_plate',
  AMMO_CRATE = 'ammo_crate',
  GRENADE = 'grenade',
  BARRICADE = 'barricade',
  TURRET = 'turret',
  ADRENALINE = 'adrenaline',
}

export enum UpgradeId {
  MAX_HEALTH = 'max_health',
  MOVE_SPEED = 'move_speed',
  DAMAGE_RESIST = 'damage_resist',
  WEAPON_DAMAGE = 'weapon_damage',
  RELOAD_SPEED = 'reload_speed',
  ACCURACY = 'accuracy',
  FIRE_RATE = 'fire_rate',
  MAX_AMMO = 'max_ammo',
}

export type AttachmentId =
  | 'scope'
  | 'red_dot'
  | 'suppressor'
  | 'extended_mag'
  | 'foregrip';

export type CharacterSkinId =
  | 'ranger'
  | 'night_ops'
  | 'crimson'
  | 'arctic'
  | 'gold';

export type WeaponSkinId =
  | 'standard'
  | 'urban_camo'
  | 'crimson_steel'
  | 'desert_tan'
  | 'gold_plated';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';
export type ShadowQuality = 'off' | 'low' | 'medium' | 'high';
export type TextureQuality = 'low' | 'medium' | 'high';
export type EffectsQuality = 'low' | 'medium' | 'high';
export type FpsLimitOption = 30 | 45 | 60 | 90 | 120;
export type MobileControlsMode = 'auto' | 'always' | 'off';
export type AimMode = 'hold' | 'toggle';
export type CrosshairStyle = 'tactical' | 'dot' | 'cross' | 'dynamic';
export type GameMode = 'solo' | 'coop' | 'competitive';

export type GameScreen =
  | 'loading'
  | 'menu'
  | 'playing'
  | 'paused'
  | 'gameover';

export type MenuModalType =
  | null
  | 'weapons'
  | 'inventory'
  | 'upgrades'
  | 'settings'
  | 'howtoplay'
  | 'multiplayer'
  | 'shop'
  | 'profile';

export interface WeaponSpec {
  id: WeaponId;
  slot: number;
  name: string;
  category:
    | 'Melee'
    | 'Sidearm'
    | 'SMG'
    | 'Shotgun'
    | 'Assault Rifle'
    | 'Sniper'
    | 'LMG'
    | 'Heavy MG';
  description: string;
  price: number;
  upgradeBaseCost: number;
  damage: number;
  fireRate: number;
  reloadTime: number;
  magSize: number;
  maxReserve: number;
  recoil: number;
  accuracy: number;
  spreadRad: number;
  range: number;
  pellets: number;
  automatic: boolean;
  isMelee: boolean;
  adsFov: number;
  penetration: number;
  supportedAttachments: AttachmentId[];
}

export interface AttachmentSpec {
  id: AttachmentId;
  name: string;
  slotType: 'optic' | 'muzzle' | 'magazine' | 'underbarrel';
  description: string;
  price: number;
  spreadMult: number;
  recoilMult: number;
  magMult: number;
  adsFovDelta: number;
  suppressed: boolean;
}

export interface CharacterSkinSpec {
  id: CharacterSkinId;
  name: string;
  description: string;
  priceCoins: number;
  priceGems: number;
  primaryHex: number;
  secondaryHex: number;
  accentHex: number;
  swatchCss: string;
}

export interface WeaponSkinSpec {
  id: WeaponSkinId;
  name: string;
  description: string;
  priceCoins: number;
  priceGems: number;
  tintHex: number;
  accentHex: number;
  swatchCss: string;
}

export interface UpgradeSpec {
  id: UpgradeId;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  bonusPerLevelLabel: string;
  valuePerLevel: number;
}

export type InventoryCategory =
  | 'Weapons'
  | 'Ammunition'
  | 'Grenades'
  | 'Medical Supplies'
  | 'Equipment'
  | 'Special Items';

export interface InventoryItemSpec {
  id: EquipmentId;
  name: string;
  category: InventoryCategory;
  description: string;
  price: number;
  maxStack: number;
  usableInCombat: boolean;
  hotkey?: string;
}

export interface PlayerProfile {
  playerId: string;
  username: string;
  avatarId: number;
  level: number;
  xp: number;
  totalPlaytimeSec: number;
  matchesPlayed: number;
  matchesWon: number;
  selectedCharacterSkin: CharacterSkinId;
}

export interface SettingsData {
  // Graphics & Optimization
  graphicsQuality: GraphicsQuality;
  resolutionScale: number; // 0.5 .. 1.25
  renderDistance: number; // 45 .. 150
  shadowQuality: ShadowQuality;
  textureQuality: TextureQuality;
  effectsQuality: EffectsQuality;
  antiAliasing: boolean;
  vegetationDensity: number; // 0.2 .. 1.0
  lodDistance: number; // 0.6 .. 1.5
  rainEnabled: boolean;
  vsync: boolean;
  fpsLimit: FpsLimitOption;

  // Camera
  fov: number; // 60 .. 110
  mouseSensitivity: number;
  cameraSensitivity: number;
  aimSensitivity: number;
  verticalSensitivity: number;
  horizontalSensitivity: number;
  invertY: boolean;
  cameraSmoothing: number; // 0 .. 0.85
  aimAssist: boolean;

  // Gameplay
  autoReload: boolean;
  autoSprint: boolean;
  aimMode: AimMode;
  gyroscope: boolean;
  vibration: boolean;
  damageIndicators: boolean;
  hitMarkers: boolean;
  crosshairStyle: CrosshairStyle;
  crosshairColor: string;

  // Audio
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  voiceVolume: number;
  muted: boolean;

  // Controls & HUD
  mobileControls: MobileControlsMode;
  mobileSensitivity: number;
  hudScale: number; // 0.75 .. 1.25
  hudOpacity: number; // 0.45 .. 1.0
  joystickSide: 'left' | 'right';
  fireButtonScale: number; // 0.8 .. 1.4
}

export interface SaveData {
  version: number;
  coins: number;
  gems: number;
  profile: PlayerProfile;
  unlockedWeapons: WeaponId[];
  equippedWeapon: WeaponId;
  weaponLevels: Record<WeaponId, number>;
  unlockedAttachments: Partial<Record<WeaponId, AttachmentId[]>>;
  equippedAttachments: Partial<Record<WeaponId, AttachmentId[]>>;
  unlockedWeaponSkins: WeaponSkinId[];
  equippedWeaponSkins: Partial<Record<WeaponId, WeaponSkinId>>;
  unlockedCharacterSkins: CharacterSkinId[];
  upgrades: Record<UpgradeId, number>;
  inventory: Record<EquipmentId, number>;
  highestWave: number;
  totalKills: number;
  totalCoinsEarned: number;
  gamesPlayed: number;
  bestSurvivalTime: number;
  settings: SettingsData;
}

export interface DamageNumberEvent {
  id: number;
  x: number;
  y: number;
  amount: number;
  headshot: boolean;
  createdAt: number;
}

export interface TargetZombieHUD {
  name: string;
  health: number;
  maxHealth: number;
  isBoss: boolean;
}

export interface ObjectiveItem {
  id: string;
  label: string;
  completed: boolean;
  progressText?: string;
}

export interface SquadMemberHUD {
  playerId: string;
  username: string;
  avatarId: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  speaking?: boolean;
  score: number;
}

export interface MinimapBlip {
  x: number;
  z: number;
  kind: 'zombie' | 'boss' | 'teammate' | 'drop' | 'supply';
}

export interface HUDState {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  stamina: number;
  weaponId: WeaponId;
  weaponName: string;
  isMelee: boolean;
  ammoInMag: number;
  ammoReserve: number;
  magSize: number;
  isReloading: boolean;
  reloadProgress: number;
  isAiming: boolean;
  scopeActive: boolean;
  isCrouching: boolean;
  isSprinting: boolean;
  isSliding: boolean;
  flashlightOn: boolean;
  crosshairSpread: number;
  coins: number;
  gems: number;
  sessionCoins: number;
  wave: number;
  zombiesRemaining: number;
  waveTotalZombies: number;
  waveState: 'countdown' | 'active' | 'cleared';
  waveCountdown: number;
  kills: number;
  survivalTime: number;
  pointerLocked: boolean;
  interactPrompt: string | null;
  hitMarkerType: 'none' | 'normal' | 'headshot' | 'kill';
  damageFlash: number;
  hitDirectionDeg: number | null;
  adrenalineTimer: number;
  inventory: Record<EquipmentId, number>;
  unlockedWeapons: WeaponId[];
  activeTurrets: number;
  activeBarricades: number;
  waveBanner: string | null;
  targetZombie: TargetZombieHUD | null;
  // Upgraded HUD telemetry
  yaw: number;
  playerX: number;
  playerZ: number;
  objectives: ObjectiveItem[];
  squadMembers: SquadMemberHUD[];
  minimapBlips: MinimapBlip[];
  supplyDropDistance: number | null;
  fps: number;
  qualityTier: GraphicsQuality;
  gameMode: GameMode;
  playerName: string;
  playerLevel: number;
  playerXpPct: number;
  playerAvatarId: number;
}

export interface GameOverStats {
  finalWave: number;
  highestWave: number;
  kills: number;
  coinsEarned: number;
  xpEarned: number;
  gemsEarned: number;
  survivalTime: number;
  waveBonusCoins: number;
  isNewRecord: boolean;
  gameMode: GameMode;
  victory?: boolean;
}

export interface PlayerInputCommand {
  seq: number;
  moveX: number;
  moveZ: number;
  lookDeltaX: number;
  lookDeltaY: number;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  fireHeld: boolean;
  fireJustPressed: boolean;
  aimHeld: boolean;
  reloadPressed: boolean;
  interactPressed: boolean;
  switchSlot: number | null;
  useEquipment: EquipmentId | null;
}

// ---------- MULTIPLAYER PROTOCOL TYPES ----------

export interface LobbyPlayer {
  playerId: string;
  username: string;
  avatarId: number;
  level: number;
  skin: CharacterSkinId;
  status: 'lobby' | 'room' | 'in-match';
  roomId: string | null;
  verified?: boolean;
}

export interface ChatMessage {
  id: string;
  channel: 'lobby' | 'room';
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface RoomMember {
  playerId: string;
  username: string;
  avatarId: number;
  level: number;
  skin: CharacterSkinId;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
}

export interface MultiplayerRoomState {
  roomId: string;
  roomCode: string;
  name: string;
  mode: 'coop' | 'competitive';
  status: 'waiting' | 'countdown' | 'playing' | 'ended';
  countdownSec: number;
  hostId: string;
  maxPlayers: number;
  members: RoomMember[];
}

export interface RemotePlayerSnapshot {
  playerId: string;
  username: string;
  avatarId: number;
  skin: CharacterSkinId;
  weaponId: WeaponId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
  maxHealth: number;
  armor?: number;
  alive: boolean;
  isMoving: boolean;
  isSprinting: boolean;
  isCrouching: boolean;
  isFiring: boolean;
  kills: number;
  score: number;
}

export interface ServerZombieSnapshot {
  id: number;
  type: ZombieType;
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  maxHealth: number;
  state: 'idle' | 'walk' | 'run' | 'attack' | 'dead';
}

export interface MultiplayerMatchSnapshot {
  roomId: string;
  mode: 'coop' | 'competitive';
  serverTime: number;
  wave: number;
  waveState: 'countdown' | 'active' | 'cleared';
  waveCountdown: number;
  zombiesRemaining: number;
  waveTotalZombies: number;
  players: RemotePlayerSnapshot[];
  zombies: ServerZombieSnapshot[];
  winnerId: string | null;
}

export type ClientToServerMsg =
  | {
      type: 'auth:hello';
      playerId: string;
      username: string;
      avatarId: number;
      level: number;
      skin: CharacterSkinId;
      maxHealth?: number;
      reconnectRoomId?: string;
      accessToken?: string;
    }
  | {
      type: 'profile:update';
      username: string;
      avatarId: number;
      level: number;
      skin: CharacterSkinId;
      maxHealth?: number;
    }
  | { type: 'lobby:chat'; text: string }
  | { type: 'room:chat'; text: string }
  | { type: 'lobby:invite'; targetPlayerId: string }
  | { type: 'room:create'; name: string; mode: 'coop' | 'competitive' }
  | { type: 'room:join'; roomCodeOrId: string }
  | { type: 'room:quick_match'; mode: 'coop' | 'competitive' }
  | { type: 'room:leave' }
  | { type: 'room:ready'; ready: boolean }
  | { type: 'room:start' }
  | {
      type: 'match:player_state';
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
    }
  | {
      type: 'match:shot_hit';
      zombieId: number;
      damage: number;
      headshot: boolean;
      weaponId: WeaponId;
      source?: 'weapon' | 'grenade' | 'turret';
    }
  | { type: 'match:use_medkit' }
  | { type: 'match:use_armor' }
  | { type: 'rtc:signal'; targetPlayerId: string; payload: unknown }
  | { type: 'ping' };

export type ServerToClientMsg =
  | {
      type: 'auth:welcome';
      playerId: string;
      lobbyCapacity: number;
      reconnectedRoomId?: string | null;
      authMode?: 'supabase' | 'guest';
      verifiedUserId?: string | null;
    }
  | { type: 'lobby:state'; players: LobbyPlayer[]; rooms: MultiplayerRoomState[] }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'lobby:invited'; fromName: string; roomCode: string; roomName: string }
  | { type: 'room:state'; room: MultiplayerRoomState | null }
  | {
      type: 'match:started';
      roomId: string;
      mode: 'coop' | 'competitive';
      isReconnect?: boolean;
      spawnX?: number;
      spawnZ?: number;
    }
  | { type: 'match:snapshot'; snapshot: MultiplayerMatchSnapshot }
  | { type: 'match:zombie_killed'; zombieId: number; killerId: string; coinReward: number; xpReward: number }
  | {
      type: 'match:player_damaged';
      targetPlayerId: string;
      health: number;
      armor: number;
      damage: number;
      attackerX: number;
      attackerZ: number;
    }
  | { type: 'match:ended'; winnerId: string | null; reason: string; bonusCoins: number; bonusXp: number }
  | { type: 'rtc:signal'; fromPlayerId: string; payload: unknown }
  | { type: 'pong'; serverTime: number }
  | { type: 'error'; message: string };
