import React from 'react';
import { Award, Coins, Gem, Home, RotateCcw, Skull, Trophy } from 'lucide-react';
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
  const isVictory = Boolean(stats.victory);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
      <div
        className={`w-full max-w-lg bg-[#0c1018] rounded-xl p-7 shadow-2xl border ${
          isVictory ? 'border-amber-500/50' : 'border-red-900/40'
        }`}
      >
        <div className="text-center">
          {isVictory ? (
            <Award className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          ) : (
            <Skull className="w-12 h-12 text-red-500 mx-auto mb-3" />
          )}
          <div
            className={`text-xs uppercase tracking-[0.28em] font-semibold ${
              isVictory ? 'text-amber-400' : 'text-red-400'
            }`}
          >
            {stats.gameMode === 'solo'
              ? isVictory
                ? 'Operation Complete'
                : 'Survivor Overrun'
              : `Multiplayer ${stats.gameMode.toUpperCase()} Match`}
          </div>
          <h2 className="font-display text-4xl font-bold text-slate-100 mt-1">
            {isVictory ? 'VICTORY' : 'GAME OVER'}
          </h2>
          {stats.isNewRecord && (
            <div className="mt-2 text-xs font-semibold text-amber-400">
              New Personal Record: Wave {stats.finalWave}
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono-tabular">
          <div className="p-3 rounded-lg bg-[#111621] border border-white/10">
            <div className="text-[11px] text-slate-400">Final Wave</div>
            <div className="text-xl font-bold text-red-400 mt-0.5">{stats.finalWave}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#111621] border border-white/10">
            <div className="text-[11px] text-slate-400">Best Wave</div>
            <div className="text-xl font-bold text-slate-100 mt-0.5 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              {stats.highestWave}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#111621] border border-white/10">
            <div className="text-[11px] text-slate-400">Kills</div>
            <div className="text-xl font-bold text-slate-100 mt-0.5">{stats.kills}</div>
          </div>
          <div className="p-3 rounded-lg bg-[#111621] border border-white/10">
            <div className="text-[11px] text-slate-400">Coins Earned</div>
            <div className="text-lg font-bold text-amber-400 mt-0.5 flex items-center gap-1">
              <Coins className="w-4 h-4" />+{stats.coinsEarned.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#111621] border border-white/10">
            <div className="text-[11px] text-slate-400">XP Gained</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              +{stats.xpEarned.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#111621] border border-white/10">
            <div className="text-[11px] text-slate-400">Gems Earned</div>
            <div className="text-lg font-bold text-sky-400 mt-0.5 flex items-center gap-1">
              <Gem className="w-4 h-4" />+{stats.gemsEarned}
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
            {stats.gameMode === 'solo' ? 'RETRY SOLO' : 'PLAY SOLO'}
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
