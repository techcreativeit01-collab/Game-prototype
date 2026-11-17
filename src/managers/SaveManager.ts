import {
  EquipmentId,
  GraphicsQuality,
  MobileControlsMode,
  SaveData,
  SettingsData,
  UpgradeId,
  WeaponId,
} from '../types/game';
import { WEAPONS_BY_ID } from '../data/WeaponData';
import { ITEMS_BY_ID, UPGRADES_BY_ID } from '../data/GameData';

const SAVE_STORAGE_KEY = 'zombie_shooter_save_v1';

export function getDefaultSettings(): SettingsData {
  return {
    graphicsQuality: 'high',
    masterVolume: 0.8,
    musicVolume: 0.45,
    sfxVolume: 0.85,
    muted: false,
    mouseSensitivity: 1.0,
    cameraSensitivity: 1.0,
    aimSensitivity: 0.65,
    invertY: false,
    mobileControls: 'auto',
    mobileSensitivity: 1.0,
  };
}

export function getDefaultSaveData(): SaveData {
  const weaponLevels = {} as Record<WeaponId, number>;
  (Object.values(WeaponId) as WeaponId[]).forEach((id) => {
    weaponLevels[id] = 1;
  });

  const upgrades = {} as Record<UpgradeId, number>;
  (Object.values(UpgradeId) as UpgradeId[]).forEach((id) => {
    upgrades[id] = 0;
  });

  const inventory = {} as Record<EquipmentId, number>;
  (Object.values(EquipmentId) as EquipmentId[]).forEach((id) => {
    inventory[id] = 0;
  });
  inventory[EquipmentId.MEDKIT] = 1;
  inventory[EquipmentId.GRENADE] = 1;

  return {
    version: 1,
    coins: 120,
    unlockedWeapons: [WeaponId.KATANA],
    equippedWeapon: WeaponId.KATANA,
    weaponLevels,
    upgrades,
    inventory,
    highestWave: 0,
    totalKills: 0,
    totalCoinsEarned: 120,
    gamesPlayed: 0,
    bestSurvivalTime: 0,
    settings: getDefaultSettings(),
  };
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

function validateSettings(raw: unknown): SettingsData {
  const def = getDefaultSettings();
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Record<string, unknown>;

  const validGraphics: GraphicsQuality[] = ['low', 'medium', 'high', 'ultra'];
  const validMobile: MobileControlsMode[] = ['auto', 'always', 'off'];

  return {
    graphicsQuality: validGraphics.includes(r.graphicsQuality as GraphicsQuality)
      ? (r.graphicsQuality as GraphicsQuality)
      : def.graphicsQuality,
    masterVolume: clampNum(r.masterVolume, 0, 1, def.masterVolume),
    musicVolume: clampNum(r.musicVolume, 0, 1, def.musicVolume),
    sfxVolume: clampNum(r.sfxVolume, 0, 1, def.sfxVolume),
    muted: typeof r.muted === 'boolean' ? r.muted : def.muted,
    mouseSensitivity: clampNum(r.mouseSensitivity, 0.2, 3.0, def.mouseSensitivity),
    cameraSensitivity: clampNum(r.cameraSensitivity, 0.2, 3.0, def.cameraSensitivity),
    aimSensitivity: clampNum(r.aimSensitivity, 0.2, 2.0, def.aimSensitivity),
    invertY: typeof r.invertY === 'boolean' ? r.invertY : def.invertY,
    mobileControls: validMobile.includes(r.mobileControls as MobileControlsMode)
      ? (r.mobileControls as MobileControlsMode)
      : def.mobileControls,
    mobileSensitivity: clampNum(r.mobileSensitivity, 0.2, 3.0, def.mobileSensitivity),
  };
}

export class SaveManager {
  static load(): SaveData {
    const def = getDefaultSaveData();
    try {
      const rawStr = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!rawStr) return def;
      const parsed = JSON.parse(rawStr);
      if (!parsed || typeof parsed !== 'object') return def;

      const unlockedSet = new Set<WeaponId>([WeaponId.KATANA]);
      if (Array.isArray(parsed.unlockedWeapons)) {
        for (const w of parsed.unlockedWeapons) {
          if (typeof w === 'string' && w in WEAPONS_BY_ID) {
            unlockedSet.add(w as WeaponId);
          }
        }
      }

      const equippedWeapon =
        typeof parsed.equippedWeapon === 'string' &&
        unlockedSet.has(parsed.equippedWeapon as WeaponId)
          ? (parsed.equippedWeapon as WeaponId)
          : WeaponId.KATANA;

      const weaponLevels = { ...def.weaponLevels };
      if (parsed.weaponLevels && typeof parsed.weaponLevels === 'object') {
        for (const id of Object.values(WeaponId)) {
          weaponLevels[id] = Math.floor(clampNum(parsed.weaponLevels[id], 1, 10, 1));
        }
      }

      const upgrades = { ...def.upgrades };
      if (parsed.upgrades && typeof parsed.upgrades === 'object') {
        for (const id of Object.values(UpgradeId)) {
          const maxL = UPGRADES_BY_ID[id].maxLevel;
          upgrades[id] = Math.floor(clampNum(parsed.upgrades[id], 0, maxL, 0));
        }
      }

      const inventory = { ...def.inventory };
      if (parsed.inventory && typeof parsed.inventory === 'object') {
        for (const id of Object.values(EquipmentId)) {
          const maxStack = ITEMS_BY_ID[id].maxStack;
          inventory[id] = Math.floor(clampNum(parsed.inventory[id], 0, maxStack, def.inventory[id]));
        }
      }

      return {
        version: 1,
        coins: Math.floor(clampNum(parsed.coins, 0, 9999999, def.coins)),
        unlockedWeapons: Array.from(unlockedSet),
        equippedWeapon,
        weaponLevels,
        upgrades,
        inventory,
        highestWave: Math.floor(clampNum(parsed.highestWave, 0, 9999, 0)),
        totalKills: Math.floor(clampNum(parsed.totalKills, 0, 99999999, 0)),
        totalCoinsEarned: Math.floor(clampNum(parsed.totalCoinsEarned, 0, 99999999, def.coins)),
        gamesPlayed: Math.floor(clampNum(parsed.gamesPlayed, 0, 999999, 0)),
        bestSurvivalTime: clampNum(parsed.bestSurvivalTime, 0, 999999, 0),
        settings: validateSettings(parsed.settings),
      };
    } catch {
      return def;
    }
  }

  static save(data: SaveData): void {
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage quota errors gracefully
    }
  }

  static resetAll(): SaveData {
    const def = getDefaultSaveData();
    SaveManager.save(def);
    return def;
  }
}
