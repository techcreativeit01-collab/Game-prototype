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

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';
export type MobileControlsMode = 'auto' | 'always' | 'off';

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
  | 'howtoplay';

export interface WeaponSpec {
  id: WeaponId;
  slot: number;
  name: string;
  category: 'Melee' | 'Sidearm' | 'SMG' | 'Shotgun' | 'Assault Rifle' | 'Sniper' | 'LMG' | 'Heavy MG';
  description: string;
  price: number;
  upgradeBaseCost: number;
  damage: number;
  fireRate: number; // shots/swings per second
  reloadTime: number; // seconds
  magSize: number;
  maxReserve: number;
  recoil: number;
  accuracy: number; // 0..1 (1 = pinpoint)
  spreadRad: number;
  range: number; // meters
  pellets: number;
  automatic: boolean;
  isMelee: boolean;
  adsFov: number;
  penetration: number;
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

export interface SettingsData {
  graphicsQuality: GraphicsQuality;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  mouseSensitivity: number;
  cameraSensitivity: number;
  aimSensitivity: number;
  invertY: boolean;
  mobileControls: MobileControlsMode;
  mobileSensitivity: number;
}

export interface SaveData {
  version: number;
  coins: number;
  unlockedWeapons: WeaponId[];
  equippedWeapon: WeaponId;
  weaponLevels: Record<WeaponId, number>;
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
  x: number; // screen px
  y: number; // screen px
  amount: number;
  headshot: boolean;
  createdAt: number;
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
  reloadProgress: number; // 0..1
  isAiming: boolean;
  isCrouching: boolean;
  crosshairSpread: number; // px
  coins: number;
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
  damageFlash: number; // 0..1
  adrenalineTimer: number;
  inventory: Record<EquipmentId, number>;
  unlockedWeapons: WeaponId[];
  activeTurrets: number;
  activeBarricades: number;
  waveBanner: string | null;
}

export interface GameOverStats {
  finalWave: number;
  highestWave: number;
  kills: number;
  coinsEarned: number;
  survivalTime: number;
  waveBonusCoins: number;
  isNewRecord: boolean;
}

// Multiplayer-ready simulation command abstraction
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
