import React from 'react';
import { ArrowUpRight, Coins, X } from 'lucide-react';
import { SaveData, UpgradeId } from '../types/game';
import { UPGRADE_LIST, getUpgradeCost } from '../data/GameData';

interface Props {
  saveData: SaveData;
  onUpgrade: (id: UpgradeId) => void;
  onClose: () => void;
}

export const UpgradesModal: React.FC<Props> = ({ saveData, onUpgrade, onClose }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0c1018] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c12]">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-100 tracking-wide">
              SURVIVOR UPGRADES
            </h2>
            <p className="text-xs text-slate-400">
              Permanent combat & physical enhancements persisted across runs
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-mono-tabular text-sm font-bold text-amber-400">
              <Coins className="w-4 h-4" />
              <span>{saveData.coins.toLocaleString()}</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close Upgrades"
              className="p-2 rounded-lg bg-[#151b26] hover:bg-[#1e2636] text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto survival-scroll grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {UPGRADE_LIST.map((u) => {
            const level = saveData.upgrades[u.id] ?? 0;
            const maxed = level >= u.maxLevel;
            const cost = getUpgradeCost(u, level);
            const canAfford = saveData.coins >= cost;

            return (
              <div
                key={u.id}
                className="flex flex-col justify-between p-4 rounded-xl bg-[#10141d] border border-white/10"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-slate-100">{u.name}</h3>
                    <span className="font-mono-tabular text-xs font-semibold text-emerald-400">
                      Level {level} / {u.maxLevel}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{u.description}</p>

                  {/* Level pip bar */}
                  <div className="mt-3 flex gap-1">
                    {Array.from({ length: u.maxLevel }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 flex-1 rounded-sm ${
                          idx < level ? 'bg-red-600' : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/10">
                  <div className="text-xs text-slate-300">
                    Next Bonus:{' '}
                    <span className="font-semibold text-amber-400">
                      {maxed ? 'Maxed' : u.bonusPerLevelLabel}
                    </span>
                  </div>
                  <button
                    onClick={() => onUpgrade(u.id)}
                    disabled={maxed}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      maxed
                        ? 'bg-[#151923] text-slate-500 cursor-default'
                        : canAfford
                        ? 'bg-red-700 hover:bg-red-600 text-white cursor-pointer'
                        : 'bg-[#1a1f2b] text-slate-400 hover:bg-[#232938] cursor-pointer'
                    }`}
                  >
                    {maxed ? (
                      'MAXED'
                    ) : (
                      <>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Upgrade · {cost}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
