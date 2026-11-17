import {
  EquipmentId,
  InventoryItemSpec,
  UpgradeId,
  UpgradeSpec,
  ZombieType,
} from '../types/game';

export const UPGRADE_LIST: UpgradeSpec[] = [
  {
    id: UpgradeId.MAX_HEALTH,
    name: 'Maximum Health',
    description: 'Increases base survivor vitality pool.',
    maxLevel: 10,
    baseCost: 120,
    costMultiplier: 1.45,
    bonusPerLevelLabel: '+20 HP',
    valuePerLevel: 20,
  },
  {
    id: UpgradeId.MOVE_SPEED,
    name: 'Movement Speed',
    description: 'Enhances walking and sprinting agility across forest terrain.',
    maxLevel: 8,
    baseCost: 140,
    costMultiplier: 1.48,
    bonusPerLevelLabel: '+5% Speed',
    valuePerLevel: 0.05,
  },
  {
    id: UpgradeId.DAMAGE_RESIST,
    name: 'Damage Resistance',
    description: 'Hardens survival gear to reduce incoming zombie melee damage.',
    maxLevel: 8,
    baseCost: 160,
    costMultiplier: 1.5,
    bonusPerLevelLabel: '+5% Mitigation',
    valuePerLevel: 0.05,
  },
  {
    id: UpgradeId.WEAPON_DAMAGE,
    name: 'Weapon Damage',
    description: 'Increases stopping power across all firearms and melee blades.',
    maxLevel: 10,
    baseCost: 180,
    costMultiplier: 1.5,
    bonusPerLevelLabel: '+8% Damage',
    valuePerLevel: 0.08,
  },
  {
    id: UpgradeId.RELOAD_SPEED,
    name: 'Reload Speed',
    description: 'Speeds up magazine swaps and tactical chambering.',
    maxLevel: 8,
    baseCost: 130,
    costMultiplier: 1.45,
    bonusPerLevelLabel: '+7% Faster',
    valuePerLevel: 0.07,
  },
  {
    id: UpgradeId.ACCURACY,
    name: 'Accuracy & Recoil',
    description: 'Tightens bullet spread and reduces muzzle climb.',
    maxLevel: 8,
    baseCost: 130,
    costMultiplier: 1.45,
    bonusPerLevelLabel: '+7% Stability',
    valuePerLevel: 0.07,
  },
  {
    id: UpgradeId.FIRE_RATE,
    name: 'Fire Rate',
    description: 'Increases cyclic rate of fire and melee swing cadence.',
    maxLevel: 8,
    baseCost: 160,
    costMultiplier: 1.5,
    bonusPerLevelLabel: '+6% Cadence',
    valuePerLevel: 0.06,
  },
  {
    id: UpgradeId.MAX_AMMO,
    name: 'Maximum Ammunition',
    description: 'Expands tactical pouches to carry larger reserve ammo pools.',
    maxLevel: 8,
    baseCost: 120,
    costMultiplier: 1.42,
    bonusPerLevelLabel: '+15% Capacity',
    valuePerLevel: 0.15,
  },
];

export const UPGRADES_BY_ID: Record<UpgradeId, UpgradeSpec> = UPGRADE_LIST.reduce(
  (acc, u) => {
    acc[u.id] = u;
    return acc;
  },
  {} as Record<UpgradeId, UpgradeSpec>
);

export function getUpgradeCost(spec: UpgradeSpec, currentLevel: number): number {
  return Math.round(spec.baseCost * Math.pow(spec.costMultiplier, currentLevel));
}

export const INVENTORY_ITEMS: InventoryItemSpec[] = [
  {
    id: EquipmentId.MEDKIT,
    name: 'Field Medkit',
    category: 'Medical Supplies',
    description: 'Restores 60 HP immediately during combat.',
    price: 90,
    maxStack: 5,
    usableInCombat: true,
    hotkey: 'H',
  },
  {
    id: EquipmentId.ARMOR_PLATE,
    name: 'Kevlar Armor Plate',
    category: 'Equipment',
    description: 'Restores 50 ballistic armor that absorbs 70% of incoming damage.',
    price: 110,
    maxStack: 4,
    usableInCombat: true,
    hotkey: 'V',
  },
  {
    id: EquipmentId.AMMO_CRATE,
    name: 'Tactical Ammo Pack',
    category: 'Ammunition',
    description: 'Resupplies full reserve ammunition for your currently equipped firearm.',
    price: 85,
    maxStack: 6,
    usableInCombat: true,
    hotkey: 'F',
  },
  {
    id: EquipmentId.GRENADE,
    name: 'Frag Grenade',
    category: 'Grenades',
    description: 'High-explosive fragmentation grenade. Deals up to 280 area damage.',
    price: 100,
    maxStack: 6,
    usableInCombat: true,
    hotkey: 'G',
  },
  {
    id: EquipmentId.BARRICADE,
    name: 'Timber Barricade',
    category: 'Equipment',
    description: 'Deployable reinforced defensive barrier (350 HP) that blocks zombie movement.',
    price: 160,
    maxStack: 4,
    usableInCombat: true,
    hotkey: 'B',
  },
  {
    id: EquipmentId.TURRET,
    name: 'Auto Robot Turret',
    category: 'Special Items',
    description: 'Automated tripod sentry gun. Tracks nearby zombies and fires 120 rounds.',
    price: 380,
    maxStack: 3,
    usableInCombat: true,
    hotkey: 'T',
  },
  {
    id: EquipmentId.ADRENALINE,
    name: 'Adrenaline Injector',
    category: 'Special Items',
    description: 'Grants +35% movement speed and unlimited stamina for 12 seconds.',
    price: 140,
    maxStack: 4,
    usableInCombat: true,
    hotkey: 'X',
  },
];

export const ITEMS_BY_ID: Record<EquipmentId, InventoryItemSpec> = INVENTORY_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<EquipmentId, InventoryItemSpec>
);

export interface ZombieClassConfig {
  type: ZombieType;
  label: string;
  baseHealth: number;
  baseSpeed: number;
  runSpeed: number;
  baseDamage: number;
  attackRange: number;
  attackCooldown: number;
  coinReward: number;
  scale: number;
  bodyColor: number;
  clothColor: number;
  eyeColor: number;
}

export const ZOMBIE_CONFIGS: Record<ZombieType, ZombieClassConfig> = {
  [ZombieType.NORMAL]: {
    type: ZombieType.NORMAL,
    label: 'Walker',
    baseHealth: 100,
    baseSpeed: 2.35,
    runSpeed: 3.15,
    baseDamage: 14,
    attackRange: 1.85,
    attackCooldown: 1.15,
    coinReward: 18,
    scale: 1.0,
    bodyColor: 0x5c6858,
    clothColor: 0x2b3038,
    eyeColor: 0xff3b2f,
  },
  [ZombieType.FAST]: {
    type: ZombieType.FAST,
    label: 'Sprinter',
    baseHealth: 68,
    baseSpeed: 4.5,
    runSpeed: 5.85,
    baseDamage: 11,
    attackRange: 1.7,
    attackCooldown: 0.78,
    coinReward: 24,
    scale: 0.94,
    bodyColor: 0x6f5a52,
    clothColor: 0x3b2323,
    eyeColor: 0xff9d2e,
  },
  [ZombieType.TANK]: {
    type: ZombieType.TANK,
    label: 'Brute Tank',
    baseHealth: 360,
    baseSpeed: 1.55,
    runSpeed: 2.1,
    baseDamage: 32,
    attackRange: 2.35,
    attackCooldown: 1.65,
    coinReward: 55,
    scale: 1.38,
    bodyColor: 0x454e45,
    clothColor: 0x1e2226,
    eyeColor: 0xdc2626,
  },
  [ZombieType.FEMALE]: {
    type: ZombieType.FEMALE,
    label: 'Banshee',
    baseHealth: 115,
    baseSpeed: 3.1,
    runSpeed: 4.15,
    baseDamage: 17,
    attackRange: 1.8,
    attackCooldown: 0.95,
    coinReward: 28,
    scale: 0.96,
    bodyColor: 0x6c7274,
    clothColor: 0x3a2634,
    eyeColor: 0xf43f5e,
  },
  [ZombieType.BOSS]: {
    type: ZombieType.BOSS,
    label: 'Forest Abomination',
    baseHealth: 950,
    baseSpeed: 2.15,
    runSpeed: 2.85,
    baseDamage: 42,
    attackRange: 2.6,
    attackCooldown: 1.45,
    coinReward: 220,
    scale: 1.68,
    bodyColor: 0x3b2d2d,
    clothColor: 0x171215,
    eyeColor: 0xff1e00,
  },
};

export function getWaveZombieCount(wave: number): number {
  if (wave === 1) return 20;
  if (wave === 2) return 30;
  if (wave === 3) return 40;
  if (wave === 4) return 60;
  if (wave === 5) return 100;
  return Math.min(240, 100 + (wave - 5) * 28);
}

export const INVENTORY_MAX_CAPACITY = 30;
