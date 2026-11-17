import React from 'react';
import {
  Backpack,
  BookOpen,
  Crosshair,
  Home,
  Play,
  RotateCcw,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { GameMode, MenuModalType } from '../types/game';

interface Props {
  wave: number;
  kills: number;
  coins: number;
  gameMode: GameMode;
  onResume: () => void;
  onRestart: () => void;
  onOpenModal: (modal: MenuModalType) => void;
  onReturnToMenu: () => void;
}

export const PauseMenu: React.FC<Props> = ({
  wave,
  kills,
  coins,
  gameMode,
  onResume,
  onRestart,
  onOpenModal,
  onReturnToMenu,
}) => {
  const isMp = gameMode !== 'solo';
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md bg-[#0c1018] border border-white/15 rounded-xl p-6 shadow-2xl">
        <div className="text-center border-b border-white/10 pb-4 mb-5">
          <div className="text-xs uppercase tracking-[0.25em] text-red-500 font-semibold">
            {isMp ? `Multiplayer ${gameMode.toUpperCase()} Active` : 'Game Paused'}
          </div>
          <h2 className="font-display text-3xl font-bold text-slate-100 mt-1">
            WAVE {wave}
          </h2>
          <div className="mt-1.5 text-xs text-slate-400 font-mono-tabular">
            {kills} Kills · {coins.toLocaleString()} Coins
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onResume}
            className="w-full py-3 px-4 rounded-lg bg-red-700 hover:bg-red-600 text-white font-display font-bold tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            RESUME
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onOpenModal('weapons')}
              className="py-2.5 px-2 rounded-lg bg-[#141a26] hover:bg-[#1c2434] border border-white/10 text-xs font-semibold text-slate-200 flex flex-col items-center gap-1 cursor-pointer"
            >
              <Crosshair className="w-4 h-4 text-red-400" />
              Weapons
            </button>
            <button
              onClick={() => onOpenModal('inventory')}
              className="py-2.5 px-2 rounded-lg bg-[#141a26] hover:bg-[#1c2434] border border-white/10 text-xs font-semibold text-slate-200 flex flex-col items-center gap-1 cursor-pointer"
            >
              <Backpack className="w-4 h-4 text-amber-400" />
              Inventory
            </button>
            <button
              onClick={() => onOpenModal('upgrades')}
              className="py-2.5 px-2 rounded-lg bg-[#141a26] hover:bg-[#1c2434] border border-white/10 text-xs font-semibold text-slate-200 flex flex-col items-center gap-1 cursor-pointer"
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Upgrades
            </button>
          </div>

          {!isMp && (
            <button
              onClick={onRestart}
              className="w-full py-2.5 px-4 rounded-lg bg-[#121722] hover:bg-[#1b2232] border border-white/10 text-slate-200 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              Restart Match
            </button>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => onOpenModal('settings')}
              className="py-2.5 px-4 rounded-lg bg-[#121722] hover:bg-[#1b2232] border border-white/10 text-slate-200 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              Settings
            </button>
            <button
              onClick={() => onOpenModal('howtoplay')}
              className="py-2.5 px-4 rounded-lg bg-[#121722] hover:bg-[#1b2232] border border-white/10 text-slate-200 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-slate-400" />
              Controls
            </button>
          </div>

          <button
            onClick={onReturnToMenu}
            className="w-full py-2.5 px-4 rounded-lg bg-[#171115] hover:bg-[#24161c] border border-red-900/40 text-red-300 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            <Home className="w-4 h-4" />
            {isMp ? 'Leave Match & Return' : 'Return to Main Menu'}
          </button>
        </div>
      </div>
    </div>
  );
};
