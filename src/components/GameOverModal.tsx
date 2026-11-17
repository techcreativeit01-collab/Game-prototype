import React from 'react';
import { Coins, Home, RotateCcw, Skull, Trophy } from 'lucide-react';
import { GameOverStats } from '../types/game';

interface Props {
  stats: GameOverStats;
  onRetry: () => void;
  onMainMenu: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export const GameOverModal: React.FC<Props> = ({ stats, onRetry, onMainMenu }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
      <div className="w-full max-w-lg bg-[#0c1018] border border-red-900/40 rounded-xl p-7 shadow-2xl">
        <div className="text-center">
          <Skull className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <div className="text-xs uppercase tracking-[0.28em] text-red-400 font-semibold">
            Survivor Overrun
          </div>
          <h2 className="font-display text-4xl font-bold text-slate-100 mt-1">
            GAME OVER
          </h2>
          {stats.isNewRecord && (
            <div className="mt-2 text-xs font-semibold text-amber-400">
              New Personal Record: Wave {stats.finalWave}
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 font-mono-tabular">
          <div className="p-3.5 rounded-lg bg-[#111621] border border-white/10">
            <div className="text-xs text-slate-400">Final Wave</div>
            <div className="text-2xl font-bold text-red-400 mt-0.5">{stats.finalWave}</div>
          </div>
          <div className="p-3.5 rounded-lg bg-[#111621] border border-white/10">
            <div className="text-xs text-slate-400">Highest Wave</div>
            <div className="text-2xl font-bold text-slate-100 mt-0.5 flex items-center gap-1.5">
              <Trophy className="w-5 h-5 text-amber-400" />
              {stats.highestWave}
            </div>
          </div>
          <div className="p-3.5 rounded-lg bg-[#111621] border border-white/10">
            <div className="text-xs text-slate-400">Total Kills</div>
            <div className="text-2xl font-bold text-slate-100 mt-0.5">{stats.kills}</div>
          </div>
          <div className="p-3.5 rounded-lg bg-[#111621] border border-white/10">
            <div className="text-xs text-slate-400">Coins Earned</div>
            <div className="text-2xl font-bold text-amber-400 mt-0.5 flex items-center gap-1.5">
              <Coins className="w-5 h-5" />
              +{stats.coinsEarned.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mt-3 p-3.5 rounded-lg bg-[#111621] border border-white/10 flex items-center justify-between text-xs font-mono-tabular">
          <span className="text-slate-400">
            Survival Duration:{' '}
            <strong className="text-slate-100">{formatDuration(stats.survivalTime)}</strong>
          </span>
          <span className="text-slate-400">
            Wave Rewards:{' '}
            <strong className="text-amber-400">+{stats.waveBonusCoins} Coins</strong>
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={onRetry}
            className="py-3 px-4 rounded-lg bg-red-700 hover:bg-red-600 text-white font-display font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            RETRY
          </button>
          <button
            onClick={onMainMenu}
            className="py-3 px-4 rounded-lg bg-[#151b26] hover:bg-[#1e2636] border border-white/10 text-slate-200 font-display font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};
