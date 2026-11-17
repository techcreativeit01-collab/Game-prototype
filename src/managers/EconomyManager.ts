import {
  AttachmentId,
  CharacterSkinId,
  EquipmentId,
  SaveData,
  UpgradeId,
  WeaponId,
  WeaponSkinId,
} from '../types/game';
import {
  ATTACHMENTS_BY_ID,
  WEAPONS_BY_ID,
  WEAPON_SKINS_BY_ID,
  getWeaponUpgradeCost,
} from '../data/WeaponData';
import {
  CHARACTER_SKINS_BY_ID,
  INVENTORY_MAX_CAPACITY,
  ITEMS_BY_ID,
  UPGRADES_BY_ID,
  getUpgradeCost,
  getXpForNextLevel,
} from '../data/GameData';
import { SaveManager } from './SaveManager';

export interface ActionResult {
  success: boolean;
  message: string;
}

export class ProgressionManager {
  private data: SaveData;
  private rewardedZombieIds = new Set<number>();
  private listeners = new Set<(data: SaveData) => void>();

  constructor() {
    this.data = SaveManager.load();
  }

  getData(): SaveData {
    return this.data;
  }

  subscribe(cb: (data: SaveData) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emitAndSave(): void {
    SaveManager.save(this.data);
    this.listeners.forEach((cb) => cb(this.data));
  }

  resetSessionTracking(): void {
    this.rewardedZombieIds.clear();
  }

  rewardZombieKill(zombieUniqueId: number, coins: number, xpAmount = 22): boolean {
    if (this.rewardedZombieIds.has(zombieUniqueId)) return false;
    this.rewardedZombieIds.add(zombieUniqueId);
    const { level, xp } = this.computeLevelUp(this.data.profile.level, this.data.profile.xp + xpAmount);
    this.data = {
      ...this.data,
      coins: this.data.coins + coins,
      totalCoinsEarned: this.data.totalCoinsEarned + coins,
      totalKills: this.data.totalKills + 1,
      profile: {
        ...this.data.profile,
        level,
        xp,
      },
    };
    this.emitAndSave();
    return true;
  }

  private computeLevelUp(curLevel: number, totalXp: number): { level: number; xp: number } {
    let level = curLevel;
    let xp = totalXp;
    let needed = getXpForNextLevel(level);
    while (xp >= needed && level < 100) {
      xp -= needed;
      level++;
      needed = getXpForNextLevel(level);
    }
    return { level, xp };
  }

  addXpAndGems(xpAmount: number, gemsAmount: number): void {
    if (xpAmount <= 0 && gemsAmount <= 0) return;
    const { level, xp } = this.computeLevelUp(
      this.data.profile.level,
      this.data.profile.xp + Math.max(0, xpAmount)
    );
    this.data = {
      ...this.data,
      gems: this.data.gems + Math.max(0, gemsAmount),
      profile: {
        ...this.data.profile,
        level,
        xp,
      },
    };
    this.emitAndSave();
  }

  addCoins(amount: number): void {
    if (amount <= 0) return;
    this.data = {
      ...this.data,
      coins: this.data.coins + amount,
      totalCoinsEarned: this.data.totalCoinsEarned + amount,
    };
    this.emitAndSave();
  }

  updateProfile(partial: { username?: string; avatarId?: number }): ActionResult {
    const nextName =
      partial.username !== undefined ? partial.username.trim().slice(0, 16) : this.data.profile.username;
    if (!nextName) {
      return { success: false, message: 'Callsign cannot be empty.' };
    }
    this.data = {
      ...this.data,
      profile: {
        ...this.data.profile,
        username: nextName,
        avatarId: partial.avatarId !== undefined ? partial.avatarId : this.data.profile.avatarId,
      },
    };
    this.emitAndSave();
    return { success: true, message: 'Operator profile updated.' };
  }

  buyWeapon(weaponId: WeaponId): ActionResult {
    const spec = WEAPONS_BY_ID[weaponId];
    if (!spec) return { success: false, message: 'Unknown weapon.' };
    if (this.data.unlockedWeapons.includes(weaponId)) {
      return { success: false, message: `${spec.name} is already unlocked.` };
    }
    if (this.data.coins < spec.price) {
      return {
        success: false,
        message: `Need ${spec.price - this.data.coins} more coins to unlock ${spec.name}.`,
      };
    }

    this.data = {
      ...this.data,
      coins: this.data.coins - spec.price,
      unlockedWeapons: [...this.data.unlockedWeapons, weaponId],
      equippedWeapon: weaponId,
    };
    this.emitAndSave();
    return { success: true, message: `Purchased and equipped ${spec.name}.` };
  }

  equipWeapon(weaponId: WeaponId): ActionResult {
    if (!this.data.unlockedWeapons.includes(weaponId)) {
      return { success: false, message: 'Weapon not unlocked yet.' };
    }
    const spec = WEAPONS_BY_ID[weaponId];
    this.data = {
      ...this.data,
      equippedWeapon: weaponId,
    };
    this.emitAndSave();
    return { success: true, message: `Equipped ${spec.name}.` };
  }

  upgradeWeapon(weaponId: WeaponId): ActionResult {
    if (!this.data.unlockedWeapons.includes(weaponId)) {
      return { success: false, message: 'Unlock this weapon first.' };
    }
    const spec = WEAPONS_BY_ID[weaponId];
    const currentLevel = this.data.weaponLevels[weaponId] ?? 1;
    if (currentLevel >= 10) {
      return { success: false, message: `${spec.name} is at max level.` };
    }
    const cost = getWeaponUpgradeCost(spec, currentLevel);
    if (this.data.coins < cost) {
      return {
        success: false,
        message: `Need ${cost - this.data.coins} more coins to upgrade ${spec.name}.`,
      };
    }

    this.data = {
      ...this.data,
      coins: this.data.coins - cost,
      weaponLevels: {
        ...this.data.weaponLevels,
        [weaponId]: currentLevel + 1,
      },
    };
    this.emitAndSave();
    return {
      success: true,
      message: `Upgraded ${spec.name} to Level ${currentLevel + 1}.`,
    };
  }

  buyAttachment(weaponId: WeaponId, attachmentId: AttachmentId): ActionResult {
    if (!this.data.unlockedWeapons.includes(weaponId)) {
      return { success: false, message: 'Unlock the weapon first.' };
    }
    const att = ATTACHMENTS_BY_ID[attachmentId];
    if (!att) return { success: false, message: 'Invalid attachment.' };

    const owned = this.data.unlockedAttachments[weaponId] ?? [];
    if (owned.includes(attachmentId)) {
      return { success: false, message: `${att.name} already owned.` };
    }
    if (this.data.coins < att.price) {
      return { success: false, message: `Need ${att.price - this.data.coins} more coins.` };
    }

    // Equip automatically, replacing same optic slot if needed
    const prevEq = this.data.equippedAttachments[weaponId] ?? [];
    const filteredEq = prevEq.filter((id) => ATTACHMENTS_BY_ID[id]?.slotType !== att.slotType);

    this.data = {
      ...this.data,
      coins: this.data.coins - att.price,
      unlockedAttachments: {
        ...this.data.unlockedAttachments,
        [weaponId]: [...owned, attachmentId],
      },
      equippedAttachments: {
        ...this.data.equippedAttachments,
        [weaponId]: [...filteredEq, attachmentId],
      },
    };
    this.emitAndSave();
    return { success: true, message: `Installed ${att.name} on ${WEAPONS_BY_ID[weaponId].name}.` };
  }

  toggleAttachment(weaponId: WeaponId, attachmentId: AttachmentId): ActionResult {
    const owned = this.data.unlockedAttachments[weaponId] ?? [];
    if (!owned.includes(attachmentId)) {
      return { success: false, message: 'Purchase this attachment first.' };
    }
    const att = ATTACHMENTS_BY_ID[attachmentId];
    const current = this.data.equippedAttachments[weaponId] ?? [];
    const isEquipped = current.includes(attachmentId);
    const next = isEquipped
      ? current.filter((id) => id !== attachmentId)
      : [
          ...current.filter((id) => ATTACHMENTS_BY_ID[id]?.slotType !== att.slotType),
          attachmentId,
        ];

    this.data = {
      ...this.data,
      equippedAttachments: {
        ...this.data.equippedAttachments,
        [weaponId]: next,
      },
    };
    this.emitAndSave();
    return {
      success: true,
      message: isEquipped ? `Removed ${att.name}.` : `Equipped ${att.name}.`,
    };
  }

  buyOrEquipWeaponSkin(weaponId: WeaponId, skinId: WeaponSkinId): ActionResult {
    const spec = WEAPON_SKINS_BY_ID[skinId];
    if (!spec) return { success: false, message: 'Unknown skin.' };
    const owned = this.data.unlockedWeaponSkins.includes(skinId);

    if (!owned) {
      if (this.data.coins < spec.priceCoins || this.data.gems < spec.priceGems) {
        return {
          success: false,
          message: `Insufficient funds for ${spec.name}.`,
        };
      }
      this.data = {
        ...this.data,
        coins: this.data.coins - spec.priceCoins,
        gems: this.data.gems - spec.priceGems,
        unlockedWeaponSkins: [...this.data.unlockedWeaponSkins, skinId],
        equippedWeaponSkins: {
          ...this.data.equippedWeaponSkins,
          [weaponId]: skinId,
        },
      };
      this.emitAndSave();
      return { success: true, message: `Unlocked and applied ${spec.name}.` };
    }

    this.data = {
      ...this.data,
      equippedWeaponSkins: {
        ...this.data.equippedWeaponSkins,
        [weaponId]: skinId,
      },
    };
    this.emitAndSave();
    return { success: true, message: `Applied ${spec.name} finish.` };
  }

  buyOrEquipCharacterSkin(skinId: CharacterSkinId): ActionResult {
    const spec = CHARACTER_SKINS_BY_ID[skinId];
    if (!spec) return { success: false, message: 'Unknown character skin.' };
    const owned = this.data.unlockedCharacterSkins.includes(skinId);

    if (!owned) {
      if (this.data.coins < spec.priceCoins || this.data.gems < spec.priceGems) {
        return {
          success: false,
          message: `Insufficient funds for ${spec.name}.`,
        };
      }
      this.data = {
        ...this.data,
        coins: this.data.coins - spec.priceCoins,
        gems: this.data.gems - spec.priceGems,
        unlockedCharacterSkins: [...this.data.unlockedCharacterSkins, skinId],
        profile: {
          ...this.data.profile,
          selectedCharacterSkin: skinId,
        },
      };
      this.emitAndSave();
      return { success: true, message: `Unlocked and equipped ${spec.name}.` };
    }

    this.data = {
      ...this.data,
      profile: {
        ...this.data.profile,
        selectedCharacterSkin: skinId,
      },
    };
    this.emitAndSave();
    return { success: true, message: `Equipped ${spec.name} outfit.` };
  }

  buyPlayerUpgrade(upgradeId: UpgradeId): ActionResult {
    const spec = UPGRADES_BY_ID[upgradeId];
    const currentLevel = this.data.upgrades[upgradeId] ?? 0;
    if (currentLevel >= spec.maxLevel) {
      return { success: false, message: `${spec.name} is maxed out.` };
    }
    const cost = getUpgradeCost(spec, currentLevel);
    if (this.data.coins < cost) {
      return {
        success: false,
        message: `Need ${cost - this.data.coins} more coins for ${spec.name}.`,
      };
    }
    this.data = {
      ...this.data,
      coins: this.data.coins - cost,
      upgrades: {
        ...this.data.upgrades,
        [upgradeId]: currentLevel + 1,
      },
    };
    this.emitAndSave();
    return {
      success: true,
      message: `${spec.name} upgraded to Level ${currentLevel + 1}.`,
    };
  }

  getTotalInventoryCount(): number {
    return Object.values(this.data.inventory).reduce((a, b) => a + b, 0);
  }

  buyInventoryItem(itemId: EquipmentId): ActionResult {
    const spec = ITEMS_BY_ID[itemId];
    const currentCount = this.data.inventory[itemId] ?? 0;
    if (currentCount >= spec.maxStack) {
      return {
        success: false,
        message: `Max stack (${spec.maxStack}) reached for ${spec.name}.`,
      };
    }
    if (this.getTotalInventoryCount() >= INVENTORY_MAX_CAPACITY) {
      return { success: false, message: `Inventory full (${INVENTORY_MAX_CAPACITY} slots).` };
    }
    if (this.data.coins < spec.price) {
      return {
        success: false,
        message: `Need ${spec.price - this.data.coins} more coins for ${spec.name}.`,
      };
    }
    this.data = {
      ...this.data,
      coins: this.data.coins - spec.price,
      inventory: {
        ...this.data.inventory,
        [itemId]: currentCount + 1,
      },
    };
    this.emitAndSave();
    return { success: true, message: `Purchased 1x ${spec.name}.` };
  }

  consumeInventoryItem(itemId: EquipmentId): boolean {
    const currentCount = this.data.inventory[itemId] ?? 0;
    if (currentCount <= 0) return false;
    this.data = {
      ...this.data,
      inventory: {
        ...this.data.inventory,
        [itemId]: currentCount - 1,
      },
    };
    this.emitAndSave();
    return true;
  }

  grantLootItem(itemId: EquipmentId): boolean {
    const spec = ITEMS_BY_ID[itemId];
    const current = this.data.inventory[itemId] ?? 0;
    if (current >= spec.maxStack || this.getTotalInventoryCount() >= INVENTORY_MAX_CAPACITY) {
      return false;
    }
    this.data = {
      ...this.data,
      inventory: {
        ...this.data.inventory,
        [itemId]: current + 1,
      },
    };
    this.emitAndSave();
    return true;
  }

  recordRunEnd(
    waveReached: number,
    survivalTime: number,
    won = false
  ): boolean {
    const isNewRecord = waveReached > this.data.highestWave;
    const bonusGems = Math.floor(waveReached / 3) + (won ? 5 : 0);
    this.data = {
      ...this.data,
      gems: this.data.gems + bonusGems,
      highestWave: Math.max(this.data.highestWave, waveReached),
      gamesPlayed: this.data.gamesPlayed + 1,
      bestSurvivalTime: Math.max(this.data.bestSurvivalTime, survivalTime),
      profile: {
        ...this.data.profile,
        totalPlaytimeSec: this.data.profile.totalPlaytimeSec + Math.round(survivalTime),
        matchesPlayed: this.data.profile.matchesPlayed + 1,
        matchesWon: this.data.profile.matchesWon + (won ? 1 : 0),
      },
    };
    this.emitAndSave();
    return isNewRecord;
  }

  updateSettings(settings: SaveData['settings']): void {
    this.data = {
      ...this.data,
      settings: { ...settings },
    };
    this.emitAndSave();
  }

  resetSaveData(): void {
    this.data = SaveManager.resetAll();
    this.listeners.forEach((cb) => cb(this.data));
  }
}
