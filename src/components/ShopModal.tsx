import React, { useState } from 'react';
import { Check, Coins, Gem, Shield, Sparkles, X } from 'lucide-react';
import { CharacterSkinId, SaveData, WeaponId, WeaponSkinId } from '../types/game';
import { CHARACTER_SKINS } from '../data/GameData';
import { WEAPON_LIST, WEAPON_SKINS } from '../data/WeaponData';

interface Props {
  saveData: SaveData;
  onBuyOrEquipCharacterSkin: (skinId: CharacterSkinId) => void;
  onBuyOrEquipWeaponSkin: (weaponId: WeaponId, skinId: WeaponSkinId) => void;
  onClose: () => void;
}

export const ShopModal: React.FC<Props> = ({
  saveData,
  onBuyOrEquipCharacterSkin,
  onBuyOrEquipWeaponSkin,
  onClose,
}) => {
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponId>(saveData.equippedWeapon);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/82 p-3 sm:p-4">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-[#0c1018] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c12]">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-100 tracking-wide">
              TACTICAL QUARTERMASTER SHOP
            </h2>
            <p className="text-xs text-slate-400">
              Operator combat uniforms and custom weapon finishes
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
              aria-label="Close Shop"
              className="p-2 rounded-lg bg-[#151b26] hover:bg-[#1e2636] text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto survival-scroll space-y-6">
          {/* Character Outfits */}
          <section>
            <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-amber-400 mb-3">
              <Shield className="w-4 h-4" />
              Operator Combat Outfits (Visible in Main Menu & Multiplayer)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {CHARACTER_SKINS.map((skin) => {
                const owned = saveData.unlockedCharacterSkins.includes(skin.id);
                const equipped = saveData.profile.selectedCharacterSkin === skin.id;
                return (
                  <div
                    key={skin.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                      equipped
                        ? 'bg-[#151c29] border-amber-400/80'
                        : 'bg-[#101521] border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-10 h-10 rounded-lg border border-white/25 shrink-0"
                          style={{ background: skin.swatchCss }}
                        />
                        <div>
                          <div className="font-display text-base font-bold text-slate-100">
                            {skin.name}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-slate-400">
                            {owned ? (equipped ? 'Equipped' : 'Owned') : 'Locked'}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{skin.description}</p>
                    </div>

                    <button
                      onClick={() => onBuyOrEquipCharacterSkin(skin.id)}
                      disabled={equipped}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                        equipped
                          ? 'bg-emerald-900/40 border border-emerald-500/40 text-emerald-200 cursor-default'
                          : owned
                          ? 'bg-[#1b2435] hover:bg-[#25324a] text-slate-100'
                          : 'bg-red-700 hover:bg-red-600 text-white'
                      }`}
                    >
                      {equipped ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          EQUIPPED
                        </>
                      ) : owned ? (
                        'EQUIP OUTFIT'
                      ) : (
                        <>
                          BUY · {skin.priceCoins} Coins
                          {skin.priceGems > 0 ? ` + ${skin.priceGems} Gems` : ''}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Weapon Skins */}
          <section className="pt-2 border-t border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-sky-400">
                <Sparkles className="w-4 h-4" />
                Weapon Finishes
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Apply to Weapon:</span>
                <select
                  value={selectedWeapon}
                  onChange={(e) => setSelectedWeapon(e.target.value as WeaponId)}
                  className="bg-[#111723] border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                >
                  {WEAPON_LIST.filter((w) => saveData.unlockedWeapons.includes(w.id)).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {WEAPON_SKINS.map((ws) => {
                const owned = saveData.unlockedWeaponSkins.includes(ws.id);
                const equipped =
                  (saveData.equippedWeaponSkins[selectedWeapon] ?? 'standard') === ws.id;
                return (
                  <div
                    key={ws.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                      equipped
                        ? 'bg-[#151c29] border-sky-400/80'
                        : 'bg-[#101521] border-white/10'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-10 h-10 rounded-lg border border-white/25 shrink-0"
                          style={{ background: ws.swatchCss }}
                        />
                        <div>
                          <div className="font-display text-base font-bold text-slate-100">
                            {ws.name}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-slate-400">
                            {owned ? (equipped ? 'Active on Selected' : 'Unlocked') : 'Locked'}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{ws.description}</p>
                    </div>

                    <button
                      onClick={() => onBuyOrEquipWeaponSkin(selectedWeapon, ws.id)}
                      disabled={equipped}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                        equipped
                          ? 'bg-sky-900/40 border border-sky-500/40 text-sky-200 cursor-default'
                          : owned
                          ? 'bg-[#1b2435] hover:bg-[#25324a] text-slate-100'
                          : 'bg-amber-700 hover:bg-amber-600 text-white'
                      }`}
                    >
                      {equipped ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          ACTIVE FINISH
                        </>
                      ) : owned ? (
                        'APPLY TO WEAPON'
                      ) : (
                        <>
                          UNLOCK · {ws.priceCoins} Coins
                          {ws.priceGems > 0 ? ` + ${ws.priceGems} Gems` : ''}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
