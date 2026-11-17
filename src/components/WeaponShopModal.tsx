import React, { useState } from 'react';
import { ArrowUpCircle, Check, Coins, Gem, Lock, Wrench, X } from 'lucide-react';
import { AttachmentId, SaveData, WeaponId, WeaponSkinId } from '../types/game';
import {
  ATTACHMENTS_BY_ID,
  WEAPON_LIST,
  WEAPON_SKINS,
  WEAPONS_BY_ID,
  getEffectiveWeaponDamage,
  getEffectiveWeaponStats,
  getWeaponUpgradeCost,
} from '../data/WeaponData';
import { WeaponIllustration } from './WeaponIllustration';

interface Props {
  saveData: SaveData;
  onBuy: (id: WeaponId) => void;
  onEquip: (id: WeaponId) => void;
  onUpgrade: (id: WeaponId) => void;
  onBuyAttachment: (weaponId: WeaponId, attId: AttachmentId) => void;
  onToggleAttachment: (weaponId: WeaponId, attId: AttachmentId) => void;
  onWeaponSkin: (weaponId: WeaponId, skinId: WeaponSkinId) => void;
  onClose: () => void;
}

export const WeaponShopModal: React.FC<Props> = ({
  saveData,
  onBuy,
  onEquip,
  onUpgrade,
  onBuyAttachment,
  onToggleAttachment,
  onWeaponSkin,
  onClose,
}) => {
  const [inspectWeaponId, setInspectWeaponId] = useState<WeaponId>(saveData.equippedWeapon);
  const inspectedWeapon = WEAPONS_BY_ID[inspectWeaponId] ?? WEAPON_LIST[0];
  const inspectedUnlocked = saveData.unlockedWeapons.includes(inspectedWeapon.id);
  const ownedAtts = saveData.unlockedAttachments[inspectedWeapon.id] ?? [];
  const equippedAtts = saveData.equippedAttachments[inspectedWeapon.id] ?? [];
  const activeSkinId = saveData.equippedWeaponSkins[inspectedWeapon.id] ?? 'standard';
  const effStats = getEffectiveWeaponStats(inspectedWeapon, equippedAtts);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/82 p-3 sm:p-4">
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-[#0c1018] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c12]">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-100 tracking-wide">
              WEAPON ARMORY & GUNSMITH
            </h2>
            <p className="text-xs text-slate-400">
              Unlock firearms, upgrade barrels, install optics/suppressors, and apply custom finishes
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 font-mono-tabular text-sm font-bold">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Coins className="w-4 h-4" />
                {saveData.coins.toLocaleString()}
              </span>
              <span className="flex items-center gap-1.5 text-sky-400">
                <Gem className="w-4 h-4" />
                {saveData.gems.toLocaleString()}
              </span>
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

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Weapon Roster */}
          <div className="lg:col-span-8 p-4 overflow-y-auto survival-scroll grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {WEAPON_LIST.map((w) => {
              const unlocked = saveData.unlockedWeapons.includes(w.id);
              const equipped = saveData.equippedWeapon === w.id;
              const selected = inspectWeaponId === w.id;
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
                  onClick={() => setInspectWeaponId(w.id)}
                  className={`flex flex-col justify-between p-3.5 rounded-xl border transition-colors cursor-pointer ${
                    selected
                      ? 'bg-[#151c29] border-amber-400/75'
                      : equipped
                      ? 'bg-[#141923] border-red-600/60'
                      : 'bg-[#10141d] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] text-slate-400">
                          Slot {w.slot} · {w.category}
                        </div>
                        <h3 className="font-display text-base font-bold text-slate-100">
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

                    <div className="my-2.5 py-2 px-3 rounded-lg bg-[#090c12] border border-white/5">
                      <WeaponIllustration weaponId={w.id} className="w-full h-14" />
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed mb-2.5">{w.description}</p>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono-tabular border-t border-white/10 pt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Damage</span>
                        <span className="text-slate-100 font-semibold">{displayDmg}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Fire Rate</span>
                        <span className="text-slate-100 font-semibold">{w.fireRate}/s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Magazine</span>
                        <span className="text-slate-100 font-semibold">
                          {w.isMelee
                            ? '∞'
                            : getEffectiveWeaponStats(w, saveData.equippedAttachments[w.id] ?? []).magSize}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Reload</span>
                        <span className="text-slate-100 font-semibold">
                          {w.isMelee ? 'N/A' : `${w.reloadTime.toFixed(2)}s`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-3 pt-2.5 border-t border-white/10 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!unlocked ? (
                      <button
                        onClick={() => {
                          onBuy(w.id);
                          setInspectWeaponId(w.id);
                        }}
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
                          className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
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
                          className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                            level >= 10
                              ? 'bg-[#141821] text-slate-500 cursor-default'
                              : saveData.coins >= upgradeCost
                              ? 'bg-amber-700 hover:bg-amber-600 text-white cursor-pointer'
                              : 'bg-[#191d27] text-slate-400 hover:bg-[#222836] cursor-pointer'
                          }`}
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          {level >= 10 ? 'MAX' : `UPG · ${upgradeCost}`}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Gunsmith Panel: Attachments + Weapon Skins */}
          <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#090d14] p-4 overflow-y-auto survival-scroll flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-400 font-semibold">
                <Wrench className="w-3.5 h-3.5" />
                Gunsmith Bench
              </div>
              <h3 className="font-display text-xl font-bold text-slate-100 mt-0.5">
                {inspectedWeapon.name}
              </h3>
              {!inspectedWeapon.isMelee && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] font-mono-tabular bg-[#0e131d] border border-white/10 rounded-lg p-2.5">
                  <div>
                    <div className="text-slate-400">Mag</div>
                    <div className="text-slate-100 font-bold">{effStats.magSize}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">ADS FOV</div>
                    <div className="text-slate-100 font-bold">{effStats.adsFov}°</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Stealth</div>
                    <div className="text-slate-100 font-bold">
                      {effStats.suppressed ? 'Suppressed' : 'Standard'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Attachments */}
            <div>
              <h4 className="text-xs font-display font-bold uppercase tracking-wider text-slate-300 mb-2">
                Tactical Attachments
              </h4>
              {inspectedWeapon.supportedAttachments.length === 0 ? (
                <div className="text-xs text-slate-500 bg-[#0e131d] border border-white/10 rounded-lg p-3">
                  Melee blades do not mount optical or muzzle attachments.
                </div>
              ) : (
                <div className="space-y-2">
                  {inspectedWeapon.supportedAttachments.map((attId) => {
                    const att = ATTACHMENTS_BY_ID[attId];
                    const owned = ownedAtts.includes(attId);
                    const equipped = equippedAtts.includes(attId);
                    return (
                      <div
                        key={attId}
                        className={`p-2.5 rounded-lg border ${
                          equipped
                            ? 'bg-[#141d2b] border-emerald-500/60'
                            : 'bg-[#0e131d] border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-100">{att.name}</div>
                          {owned ? (
                            <button
                              disabled={!inspectedUnlocked}
                              onClick={() => onToggleAttachment(inspectedWeapon.id, attId)}
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                                equipped
                                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                                  : 'bg-[#1a2333] hover:bg-[#243046] text-slate-200'
                              }`}
                            >
                              {equipped ? 'Equipped' : 'Equip'}
                            </button>
                          ) : (
                            <button
                              disabled={!inspectedUnlocked}
                              onClick={() => onBuyAttachment(inspectedWeapon.id, attId)}
                              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Coins className="w-3 h-3" />
                              {att.price}
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">{att.description}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Weapon Finishes */}
            <div>
              <h4 className="text-xs font-display font-bold uppercase tracking-wider text-slate-300 mb-2">
                Weapon Finish
              </h4>
              <div className="space-y-2">
                {WEAPON_SKINS.map((skin) => {
                  const owned = saveData.unlockedWeaponSkins.includes(skin.id);
                  const active = activeSkinId === skin.id;
                  return (
                    <div
                      key={skin.id}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        active
                          ? 'bg-[#181f2d] border-amber-400/70'
                          : 'bg-[#0e131d] border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded border border-white/25 shrink-0"
                          style={{ background: skin.swatchCss }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-100 truncate">
                            {skin.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {skin.description}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onWeaponSkin(inspectedWeapon.id, skin.id)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold shrink-0 cursor-pointer ${
                          active
                            ? 'bg-amber-600 text-white'
                            : owned
                            ? 'bg-[#1a2333] hover:bg-[#243046] text-slate-200'
                            : 'bg-red-700 hover:bg-red-600 text-white'
                        }`}
                      >
                        {active
                          ? 'Active'
                          : owned
                          ? 'Apply'
                          : `${skin.priceCoins}c${skin.priceGems ? ` + ${skin.priceGems}g` : ''}`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
