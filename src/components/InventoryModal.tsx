import React, { useState } from 'react';
import {
  Box,
  Coins,
  Crosshair,
  Flame,
  Heart,
  Package,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import {
  EquipmentId,
  InventoryCategory,
  SaveData,
  WeaponId,
} from '../types/game';
import { INVENTORY_ITEMS, INVENTORY_MAX_CAPACITY } from '../data/GameData';
import { WEAPON_LIST } from '../data/WeaponData';

interface Props {
  saveData: SaveData;
  isPlaying: boolean;
  onBuyItem: (id: EquipmentId) => void;
  onUseItem: (id: EquipmentId) => void;
  onEquipWeapon: (id: WeaponId) => void;
  onClose: () => void;
}

const CATEGORIES: Array<'All' | InventoryCategory> = [
  'All',
  'Weapons',
  'Ammunition',
  'Grenades',
  'Medical Supplies',
  'Equipment',
  'Special Items',
];

function ItemIcon({ id }: { id: EquipmentId }) {
  switch (id) {
    case EquipmentId.MEDKIT:
      return <Heart className="w-5 h-5 text-red-400" />;
    case EquipmentId.ARMOR_PLATE:
      return <Shield className="w-5 h-5 text-sky-400" />;
    case EquipmentId.AMMO_CRATE:
      return <Package className="w-5 h-5 text-emerald-400" />;
    case EquipmentId.GRENADE:
      return <Flame className="w-5 h-5 text-amber-400" />;
    case EquipmentId.BARRICADE:
      return <Box className="w-5 h-5 text-orange-400" />;
    case EquipmentId.TURRET:
      return <Crosshair className="w-5 h-5 text-red-400" />;
    case EquipmentId.ADRENALINE:
      return <Sparkles className="w-5 h-5 text-emerald-300" />;
  }
}

export const InventoryModal: React.FC<Props> = ({
  saveData,
  isPlaying,
  onBuyItem,
  onUseItem,
  onEquipWeapon,
  onClose,
}) => {
  const [filter, setFilter] = useState<'All' | InventoryCategory>('All');
  const totalSlotsUsed = Object.values(saveData.inventory).reduce((a, b) => a + b, 0);

  const unlockedWeapons = WEAPON_LIST.filter((w) =>
    saveData.unlockedWeapons.includes(w.id)
  );
  const filteredItems = INVENTORY_ITEMS.filter(
    (item) => filter === 'All' || item.category === filter
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-[#0c1018] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c12]">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-100 tracking-wide">
              TACTICAL INVENTORY
            </h2>
            <p className="text-xs text-slate-400 font-mono-tabular">
              Capacity: {totalSlotsUsed} / {INVENTORY_MAX_CAPACITY} gear units
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-mono-tabular text-sm font-bold text-amber-400">
              <Coins className="w-4 h-4" />
              <span>{saveData.coins.toLocaleString()}</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close Inventory"
              className="p-2 rounded-lg bg-[#151b26] hover:bg-[#1e2636] text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-5 py-3 border-b border-white/10 bg-[#0a0e15] flex items-center gap-1.5 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                filter === cat
                  ? 'bg-red-700 text-white'
                  : 'bg-[#141925] text-slate-400 hover:text-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto survival-scroll space-y-6">
          {(filter === 'All' || filter === 'Weapons') && (
            <div>
              <h3 className="font-display text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
                Owned Weapons ({unlockedWeapons.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unlockedWeapons.map((w) => {
                  const isEquipped = saveData.equippedWeapon === w.id;
                  return (
                    <div
                      key={w.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                        isEquipped
                          ? 'bg-[#151a26] border-red-500/60'
                          : 'bg-[#10141d] border-white/10'
                      }`}
                    >
                      <div>
                        <div className="text-[11px] text-slate-400">
                          Slot {w.slot} · {w.category}
                        </div>
                        <div className="font-display font-bold text-slate-100">{w.name}</div>
                      </div>
                      <button
                        onClick={() => onEquipWeapon(w.id)}
                        disabled={isEquipped}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                          isEquipped
                            ? 'bg-red-900/50 text-red-200 cursor-default'
                            : 'bg-[#1c2434] hover:bg-[#283348] text-slate-100 cursor-pointer'
                        }`}
                      >
                        {isEquipped ? 'Equipped' : 'Equip'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filter !== 'Weapons' && (
            <div>
              <h3 className="font-display text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
                Field Supplies & Tactical Gear
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredItems.map((item) => {
                  const qty = saveData.inventory[item.id] ?? 0;
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-[#10141d] border border-white/10 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-lg bg-[#090c12] border border-white/10">
                            <ItemIcon id={item.id} />
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-400">
                              {item.category}
                              {item.hotkey ? ` · Key [${item.hotkey}]` : ''}
                            </div>
                            <h4 className="font-display text-base font-bold text-slate-100">
                              {item.name}
                            </h4>
                            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        <div className="text-right font-mono-tabular shrink-0">
                          <div className="text-sm font-bold text-slate-100">
                            {qty} / {item.maxStack}
                          </div>
                          <div className="text-xs text-amber-400">{item.price} Coins</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                        <button
                          onClick={() => onBuyItem(item.id)}
                          disabled={
                            qty >= item.maxStack ||
                            totalSlotsUsed >= INVENTORY_MAX_CAPACITY
                          }
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                            qty >= item.maxStack ||
                            totalSlotsUsed >= INVENTORY_MAX_CAPACITY
                              ? 'bg-[#151923] text-slate-500 cursor-default'
                              : saveData.coins >= item.price
                              ? 'bg-red-700 hover:bg-red-600 text-white cursor-pointer'
                              : 'bg-[#1a1f2b] text-slate-400 hover:bg-[#232938] cursor-pointer'
                          }`}
                        >
                          {qty >= item.maxStack ? 'MAX STACK' : `BUY 1 · ${item.price}`}
                        </button>

                        {isPlaying && item.usableInCombat && (
                          <button
                            onClick={() => onUseItem(item.id)}
                            disabled={qty <= 0}
                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                              qty > 0
                                ? 'bg-amber-700 hover:bg-amber-600 text-white cursor-pointer'
                                : 'bg-[#141821] text-slate-600 cursor-default'
                            }`}
                          >
                            USE NOW
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
