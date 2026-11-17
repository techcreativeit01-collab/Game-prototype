import React from 'react';
import { Check, Coins, Lock, ArrowUpCircle, X } from 'lucide-react';
import { SaveData, WeaponId } from '../types/game';
import {
  WEAPON_LIST,
  getEffectiveWeaponDamage,
  getWeaponUpgradeCost,
} from '../data/WeaponData';
import { WeaponIllustration } from './WeaponIllustration';

interface Props {
  saveData: SaveData;
  onBuy: (id: WeaponId) => void;
  onEquip: (id: WeaponId) => void;
  onUpgrade: (id: WeaponId) => void;
  onClose: () => void;
}

export const WeaponShopModal: React.FC<Props> = ({
  saveData,
  onBuy,
  onEquip,
  onUpgrade,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-[#0c1018] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c12]">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-100 tracking-wide">
              WEAPON ARMORY
            </h2>
            <p className="text-xs text-slate-400">
              Unlock, equip, and upgrade firearms for survival waves
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-mono-tabular text-sm font-bold text-amber-400">
              <Coins className="w-4 h-4" />
              <span>{saveData.coins.toLocaleString()}</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close Armory"
              className="p-2 rounded-lg bg-[#151b26] hover:bg-[#1e2636] text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto survival-scroll grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WEAPON_LIST.map((w) => {
            const unlocked = saveData.unlockedWeapons.includes(w.id);
            const equipped = saveData.equippedWeapon === w.id;
            const level = saveData.weaponLevels[w.id] ?? 1;
            const upgradeCost = getWeaponUpgradeCost(w, level);
            const effDamage = getEffectiveWeaponDamage(
              w,
              level,
              saveData.upgrades.weapon_damage ?? 0
            );
            const displayDmg = w.pellets > 1 ? `${effDamage}×${w.pellets}` : `${effDamage}`;

            return (
              <div
                key={w.id}
                className={`flex flex-col justify-between p-4 rounded-xl border transition-colors ${
                  equipped
                    ? 'bg-[#141923] border-red-600/70'
                    : 'bg-[#10141d] border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-slate-400">
                        Slot {w.slot} · {w.category}
                      </div>
                      <h3 className="font-display text-lg font-bold text-slate-100">
                        {w.name}
                      </h3>
                    </div>
                    <div className="text-xs font-mono-tabular text-slate-300">
                      {unlocked ? (
                        <span className={equipped ? 'text-red-400 font-semibold' : 'text-emerald-400'}>
                          {equipped ? 'Equipped' : `Lv.${level}`}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-400 font-semibold">
                          <Lock className="w-3 h-3" />
                          {w.price}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="my-3 py-2 px-3 rounded-lg bg-[#090c12] border border-white/5">
                    <WeaponIllustration weaponId={w.id} className="w-full h-16" />
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed mb-3">{w.description}</p>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-mono-tabular border-t border-white/10 pt-2.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Damage</span>
                      <span className="text-slate-100 font-semibold">{displayDmg}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fire Rate</span>
                      <span className="text-slate-100 font-semibold">{w.fireRate}/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Accuracy</span>
                      <span className="text-slate-100 font-semibold">
                        {Math.round(w.accuracy * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Magazine</span>
                      <span className="text-slate-100 font-semibold">
                        {w.isMelee ? '∞' : w.magSize}
                      </span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-slate-400">Reload Time</span>
                      <span className="text-slate-100 font-semibold">
                        {w.isMelee ? 'N/A' : `${w.reloadTime.toFixed(2)}s`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
                  {!unlocked ? (
                    <button
                      onClick={() => onBuy(w.id)}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        saveData.coins >= w.price
                          ? 'bg-red-700 hover:bg-red-600 text-white'
                          : 'bg-[#1a1f2b] text-slate-400 hover:bg-[#232938]'
                      }`}
                    >
                      <Coins className="w-3.5 h-3.5" />
                      BUY · {w.price}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onEquip(w.id)}
                        disabled={equipped}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                          equipped
                            ? 'bg-red-900/40 border border-red-500/40 text-red-200 cursor-default'
                            : 'bg-[#1b2333] hover:bg-[#253045] text-slate-100 cursor-pointer'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {equipped ? 'EQUIPPED' : 'EQUIP'}
                      </button>

                      <button
                        onClick={() => onUpgrade(w.id)}
                        disabled={level >= 10}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                          level >= 10
                            ? 'bg-[#141821] text-slate-500 cursor-default'
                            : saveData.coins >= upgradeCost
                            ? 'bg-amber-700 hover:bg-amber-600 text-white cursor-pointer'
                            : 'bg-[#191d27] text-slate-400 hover:bg-[#222836] cursor-pointer'
                        }`}
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        {level >= 10 ? 'MAX' : `UPGRADE · ${upgradeCost}`}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
