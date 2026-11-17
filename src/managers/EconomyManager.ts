import {
  EquipmentId,
  SaveData,
  UpgradeId,
  WeaponId,
} from '../types/game';
import { WEAPONS_BY_ID, getWeaponUpgradeCost } from '../data/WeaponData';
import {
  INVENTORY_MAX_CAPACITY,
  ITEMS_BY_ID,
  UPGRADES_BY_ID,
  getUpgradeCost,
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

  rewardZombieKill(zombieUniqueId: number, coins: number): boolean {
    if (this.rewardedZombieIds.has(zombieUniqueId)) return false;
    this.rewardedZombieIds.add(zombieUniqueId);
    this.data = {
      ...this.data,
      coins: this.data.coins + coins,
      totalCoinsEarned: this.data.totalCoinsEarned + coins,
      totalKills: this.data.totalKills + 1,
    };
    this.emitAndSave();
    return true;
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
      return { success: false, message: `Max stack (${spec.maxStack}) reached for ${spec.name}.` };
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

  recordRunEnd(waveReached: number, survivalTime: number): boolean {
    const isNewRecord = waveReached > this.data.highestWave;
    this.data = {
      ...this.data,
      highestWave: Math.max(this.data.highestWave, waveReached),
      gamesPlayed: this.data.gamesPlayed + 1,
      bestSurvivalTime: Math.max(this.data.bestSurvivalTime, survivalTime),
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
