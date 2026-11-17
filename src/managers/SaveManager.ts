import {
  AttachmentId,
  CharacterSkinId,
  CrosshairStyle,
  EffectsQuality,
  EquipmentId,
  FpsLimitOption,
  GraphicsQuality,
  MobileControlsMode,
  PlayerProfile,
  SaveData,
  SettingsData,
  ShadowQuality,
  TextureQuality,
  UpgradeId,
  WeaponId,
  WeaponSkinId,
} from '../types/game';
import {
  ATTACHMENTS_BY_ID,
  WEAPONS_BY_ID,
  WEAPON_SKINS_BY_ID,
} from '../data/WeaponData';
import {
  CHARACTER_SKINS_BY_ID,
  ITEMS_BY_ID,
  UPGRADES_BY_ID,
} from '../data/GameData';

const SAVE_STORAGE_KEY = 'zombie_shooter_save_v1';

export interface GraphicsPresetOverrides {
  graphicsQuality: GraphicsQuality;
  resolutionScale: number;
  renderDistance: number;
  shadowQuality: ShadowQuality;
  textureQuality: TextureQuality;
  effectsQuality: EffectsQuality;
  antiAliasing: boolean;
  vegetationDensity: number;
  lodDistance: number;
  rainEnabled: boolean;
  fpsLimit: FpsLimitOption;
}

export function detectRecommendedQuality(): GraphicsQuality {
  if (typeof navigator === 'undefined') return 'high';
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency || 4;
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);

  if (typeof mem === 'number') {
    if (mem <= 2) return 'low';
    if (mem <= 4 && isMobile) return 'medium';
    if (mem >= 8 && !isMobile) return 'high';
  }
  if (isMobile && cores <= 4) return 'low';
  if (isMobile) return 'medium';
  return 'high';
}

export function getGraphicsPresetOverrides(quality: GraphicsQuality): GraphicsPresetOverrides {
  switch (quality) {
    case 'low':
      return {
        graphicsQuality: 'low',
        resolutionScale: 0.65,
        renderDistance: 65,
        shadowQuality: 'off',
        textureQuality: 'low',
        effectsQuality: 'low',
        antiAliasing: false,
        vegetationDensity: 0.25,
        lodDistance: 0.65,
        rainEnabled: false,
        fpsLimit: 30,
      };
    case 'medium':
      return {
        graphicsQuality: 'medium',
        resolutionScale: 0.85,
        renderDistance: 85,
        shadowQuality: 'low',
        textureQuality: 'medium',
        effectsQuality: 'medium',
        antiAliasing: false,
        vegetationDensity: 0.55,
        lodDistance: 0.9,
        rainEnabled: false,
        fpsLimit: 60,
      };
    case 'ultra':
      return {
        graphicsQuality: 'ultra',
        resolutionScale: 1.15,
        renderDistance: 135,
        shadowQuality: 'high',
        textureQuality: 'high',
        effectsQuality: 'high',
        antiAliasing: true,
        vegetationDensity: 1.0,
        lodDistance: 1.35,
        rainEnabled: true,
        fpsLimit: 120,
      };
    case 'high':
    default:
      return {
        graphicsQuality: 'high',
        resolutionScale: 1.0,
        renderDistance: 110,
        shadowQuality: 'medium',
        textureQuality: 'high',
        effectsQuality: 'high',
        antiAliasing: true,
        vegetationDensity: 0.85,
        lodDistance: 1.1,
        rainEnabled: false,
        fpsLimit: 60,
      };
  }
}

export function getDefaultSettings(): SettingsData {
  const recommended = detectRecommendedQuality();
  const preset = getGraphicsPresetOverrides(recommended);
  return {
    ...preset,
    vsync: true,

    fov: 74,
    mouseSensitivity: 1.0,
    cameraSensitivity: 1.0,
    aimSensitivity: 0.65,
    verticalSensitivity: 1.0,
    horizontalSensitivity: 1.0,
    invertY: false,
    cameraSmoothing: 0.15,
    aimAssist: recommended === 'low' || recommended === 'medium',

    autoReload: true,
    autoSprint: false,
    aimMode: 'hold',
    gyroscope: false,
    vibration: true,
    damageIndicators: true,
    hitMarkers: true,
    crosshairStyle: 'tactical',
    crosshairColor: '#ffffff',

    masterVolume: 0.8,
    musicVolume: 0.45,
    sfxVolume: 0.85,
    ambientVolume: 0.75,
    voiceVolume: 0.85,
    muted: false,

    mobileControls: 'auto',
    mobileSensitivity: 1.0,
    hudScale: 1.0,
    hudOpacity: 0.92,
    joystickSide: 'left',
    fireButtonScale: 1.0,
  };
}

function generatePlayerId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'OP-';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function getDefaultProfile(): PlayerProfile {
  return {
    playerId: generatePlayerId(),
    username: 'Survivor',
    avatarId: 0,
    level: 1,
    xp: 0,
    totalPlaytimeSec: 0,
    matchesPlayed: 0,
    matchesWon: 0,
    selectedCharacterSkin: 'ranger',
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
  inventory[EquipmentId.MEDKIT] = 2;
  inventory[EquipmentId.GRENADE] = 2;

  return {
    version: 2,
    coins: 180,
    gems: 15,
    profile: getDefaultProfile(),
    unlockedWeapons: [WeaponId.KATANA],
    equippedWeapon: WeaponId.KATANA,
    weaponLevels,
    unlockedAttachments: {},
    equippedAttachments: {},
    unlockedWeaponSkins: ['standard'],
    equippedWeaponSkins: {},
    unlockedCharacterSkins: ['ranger'],
    upgrades,
    inventory,
    highestWave: 0,
    totalKills: 0,
    totalCoinsEarned: 180,
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
  const validShadows: ShadowQuality[] = ['off', 'low', 'medium', 'high'];
  const validTex: TextureQuality[] = ['low', 'medium', 'high'];
  const validFx: EffectsQuality[] = ['low', 'medium', 'high'];
  const validFps: FpsLimitOption[] = [30, 45, 60, 90, 120];
  const validMobile: MobileControlsMode[] = ['auto', 'always', 'off'];
  const validCrosshair: CrosshairStyle[] = ['tactical', 'dot', 'cross', 'dynamic'];

  return {
    graphicsQuality: validGraphics.includes(r.graphicsQuality as GraphicsQuality)
      ? (r.graphicsQuality as GraphicsQuality)
      : def.graphicsQuality,
    resolutionScale: clampNum(r.resolutionScale, 0.5, 1.25, def.resolutionScale),
    renderDistance: clampNum(r.renderDistance, 45, 150, def.renderDistance),
    shadowQuality: validShadows.includes(r.shadowQuality as ShadowQuality)
      ? (r.shadowQuality as ShadowQuality)
      : def.shadowQuality,
    textureQuality: validTex.includes(r.textureQuality as TextureQuality)
      ? (r.textureQuality as TextureQuality)
      : def.textureQuality,
    effectsQuality: validFx.includes(r.effectsQuality as EffectsQuality)
      ? (r.effectsQuality as EffectsQuality)
      : def.effectsQuality,
    antiAliasing: typeof r.antiAliasing === 'boolean' ? r.antiAliasing : def.antiAliasing,
    vegetationDensity: clampNum(r.vegetationDensity, 0.2, 1.0, def.vegetationDensity),
    lodDistance: clampNum(r.lodDistance, 0.6, 1.5, def.lodDistance),
    rainEnabled: typeof r.rainEnabled === 'boolean' ? r.rainEnabled : def.rainEnabled,
    vsync: typeof r.vsync === 'boolean' ? r.vsync : def.vsync,
    fpsLimit: validFps.includes(r.fpsLimit as FpsLimitOption)
      ? (r.fpsLimit as FpsLimitOption)
      : def.fpsLimit,

    fov: clampNum(r.fov, 60, 110, def.fov),
    mouseSensitivity: clampNum(r.mouseSensitivity, 0.2, 3.0, def.mouseSensitivity),
    cameraSensitivity: clampNum(r.cameraSensitivity, 0.2, 3.0, def.cameraSensitivity),
    aimSensitivity: clampNum(r.aimSensitivity, 0.2, 2.0, def.aimSensitivity),
    verticalSensitivity: clampNum(r.verticalSensitivity, 0.3, 2.0, def.verticalSensitivity),
    horizontalSensitivity: clampNum(r.horizontalSensitivity, 0.3, 2.0, def.horizontalSensitivity),
    invertY: typeof r.invertY === 'boolean' ? r.invertY : def.invertY,
    cameraSmoothing: clampNum(r.cameraSmoothing, 0, 0.85, def.cameraSmoothing),
    aimAssist: typeof r.aimAssist === 'boolean' ? r.aimAssist : def.aimAssist,

    autoReload: typeof r.autoReload === 'boolean' ? r.autoReload : def.autoReload,
    autoSprint: typeof r.autoSprint === 'boolean' ? r.autoSprint : def.autoSprint,
    aimMode: r.aimMode === 'toggle' ? 'toggle' : 'hold',
    gyroscope: typeof r.gyroscope === 'boolean' ? r.gyroscope : def.gyroscope,
    vibration: typeof r.vibration === 'boolean' ? r.vibration : def.vibration,
    damageIndicators:
      typeof r.damageIndicators === 'boolean' ? r.damageIndicators : def.damageIndicators,
    hitMarkers: typeof r.hitMarkers === 'boolean' ? r.hitMarkers : def.hitMarkers,
    crosshairStyle: validCrosshair.includes(r.crosshairStyle as CrosshairStyle)
      ? (r.crosshairStyle as CrosshairStyle)
      : def.crosshairStyle,
    crosshairColor:
      typeof r.crosshairColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(r.crosshairColor)
        ? r.crosshairColor
        : def.crosshairColor,

    masterVolume: clampNum(r.masterVolume, 0, 1, def.masterVolume),
    musicVolume: clampNum(r.musicVolume, 0, 1, def.musicVolume),
    sfxVolume: clampNum(r.sfxVolume, 0, 1, def.sfxVolume),
    ambientVolume: clampNum(r.ambientVolume, 0, 1, def.ambientVolume),
    voiceVolume: clampNum(r.voiceVolume, 0, 1, def.voiceVolume),
    muted: typeof r.muted === 'boolean' ? r.muted : def.muted,

    mobileControls: validMobile.includes(r.mobileControls as MobileControlsMode)
      ? (r.mobileControls as MobileControlsMode)
      : def.mobileControls,
    mobileSensitivity: clampNum(r.mobileSensitivity, 0.2, 3.0, def.mobileSensitivity),
    hudScale: clampNum(r.hudScale, 0.75, 1.25, def.hudScale),
    hudOpacity: clampNum(r.hudOpacity, 0.45, 1.0, def.hudOpacity),
    joystickSide: r.joystickSide === 'right' ? 'right' : 'left',
    fireButtonScale: clampNum(r.fireButtonScale, 0.8, 1.4, def.fireButtonScale),
  };
}

function validateProfile(raw: unknown, unlockedSkins: CharacterSkinId[]): PlayerProfile {
  const def = getDefaultProfile();
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Record<string, unknown>;
  const skin =
    typeof r.selectedCharacterSkin === 'string' &&
    unlockedSkins.includes(r.selectedCharacterSkin as CharacterSkinId)
      ? (r.selectedCharacterSkin as CharacterSkinId)
      : 'ranger';

  return {
    playerId:
      typeof r.playerId === 'string' && r.playerId.length >= 4
        ? r.playerId.slice(0, 16)
        : def.playerId,
    username:
      typeof r.username === 'string' && r.username.trim().length > 0
        ? r.username.trim().slice(0, 16)
        : def.username,
    avatarId: Math.floor(clampNum(r.avatarId, 0, 5, 0)),
    level: Math.floor(clampNum(r.level, 1, 100, 1)),
    xp: Math.floor(clampNum(r.xp, 0, 999999, 0)),
    totalPlaytimeSec: Math.floor(clampNum(r.totalPlaytimeSec, 0, 99999999, 0)),
    matchesPlayed: Math.floor(clampNum(r.matchesPlayed, 0, 999999, 0)),
    matchesWon: Math.floor(clampNum(r.matchesWon, 0, 999999, 0)),
    selectedCharacterSkin: skin,
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

      const unlockedAttachments: Partial<Record<WeaponId, AttachmentId[]>> = {};
      if (parsed.unlockedAttachments && typeof parsed.unlockedAttachments === 'object') {
        for (const wid of Object.values(WeaponId)) {
          const arr = parsed.unlockedAttachments[wid];
          if (Array.isArray(arr)) {
            unlockedAttachments[wid] = arr.filter(
              (a): a is AttachmentId => typeof a === 'string' && a in ATTACHMENTS_BY_ID
            );
          }
        }
      }

      const equippedAttachments: Partial<Record<WeaponId, AttachmentId[]>> = {};
      if (parsed.equippedAttachments && typeof parsed.equippedAttachments === 'object') {
        for (const wid of Object.values(WeaponId)) {
          const arr = parsed.equippedAttachments[wid];
          const owned = unlockedAttachments[wid] ?? [];
          if (Array.isArray(arr)) {
            equippedAttachments[wid] = arr.filter(
              (a): a is AttachmentId => typeof a === 'string' && owned.includes(a as AttachmentId)
            );
          }
        }
      }

      const weaponSkinSet = new Set<WeaponSkinId>(['standard']);
      if (Array.isArray(parsed.unlockedWeaponSkins)) {
        for (const s of parsed.unlockedWeaponSkins) {
          if (typeof s === 'string' && s in WEAPON_SKINS_BY_ID) {
            weaponSkinSet.add(s as WeaponSkinId);
          }
        }
      }

      const equippedWeaponSkins: Partial<Record<WeaponId, WeaponSkinId>> = {};
      if (parsed.equippedWeaponSkins && typeof parsed.equippedWeaponSkins === 'object') {
        for (const wid of Object.values(WeaponId)) {
          const s = parsed.equippedWeaponSkins[wid];
          if (typeof s === 'string' && weaponSkinSet.has(s as WeaponSkinId)) {
            equippedWeaponSkins[wid] = s as WeaponSkinId;
          }
        }
      }

      const charSkinSet = new Set<CharacterSkinId>(['ranger']);
      if (Array.isArray(parsed.unlockedCharacterSkins)) {
        for (const s of parsed.unlockedCharacterSkins) {
          if (typeof s === 'string' && s in CHARACTER_SKINS_BY_ID) {
            charSkinSet.add(s as CharacterSkinId);
          }
        }
      }
      const unlockedCharacterSkins = Array.from(charSkinSet);

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
          inventory[id] = Math.floor(
            clampNum(parsed.inventory[id], 0, maxStack, def.inventory[id])
          );
        }
      }

      return {
        version: 2,
        coins: Math.floor(clampNum(parsed.coins, 0, 9999999, def.coins)),
        gems: Math.floor(clampNum(parsed.gems, 0, 999999, def.gems)),
        profile: validateProfile(parsed.profile, unlockedCharacterSkins),
        unlockedWeapons: Array.from(unlockedSet),
        equippedWeapon,
        weaponLevels,
        unlockedAttachments,
        equippedAttachments,
        unlockedWeaponSkins: Array.from(weaponSkinSet),
        equippedWeaponSkins,
        unlockedCharacterSkins,
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
