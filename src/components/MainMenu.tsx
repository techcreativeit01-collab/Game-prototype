import React, { useEffect } from 'react';
import {
  Backpack,
  BookOpen,
  Coins,
  Crosshair,
  LogOut,
  Play,
  Settings,
  ShieldAlert,
  TrendingUp,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { MenuModalType, SaveData } from '../types/game';

interface Props {
  saveData: SaveData;
  isMuted: boolean;
  standbyExited: boolean;
  onPlay: () => void;
  onOpenModal: (modal: MenuModalType) => void;
  onExitToggle: () => void;
  onToggleMute: () => void;
}

export const MainMenu: React.FC<Props> = ({
  saveData,
  isMuted,
  standbyExited,
  onPlay,
  onOpenModal,
  onExitToggle,
  onToggleMute,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !standbyExited) {
        onPlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPlay, standbyExited]);

  if (standbyExited) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#06080c]/95 px-6">
        <div className="max-w-md w-full bg-[#0e131c] border border-white/10 rounded-xl p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-slate-100">Session Ended</h2>
          <p className="mt-2 text-sm text-slate-400">
            Your coins, weapons, upgrades, and survival records have been saved locally.
          </p>
          <button
            onClick={onExitToggle}
            className="mt-6 w-full py-3 px-6 bg-red-700 hover:bg-red-600 active:scale-[0.99] text-white font-display font-semibold tracking-wider rounded-lg transition-all cursor-pointer"
          >
            Return to Main Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 lg:p-12 pointer-events-none bg-gradient-to-r from-[#05070b]/92 via-[#070a10]/55 to-transparent">
      {/* Top Status Strip */}
      <div className="flex items-center justify-between gap-4 pointer-events-auto">
        <div className="flex items-center gap-4 text-xs sm:text-sm text-slate-300 font-mono-tabular">
          <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
            <Coins className="w-4 h-4" />
            {saveData.coins.toLocaleString()} Coins
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-red-400" />
            Best Wave {saveData.highestWave}
          </span>
          <span className="hidden sm:inline text-slate-600" aria-hidden="true">·</span>
          <span className="hidden sm:inline text-slate-400">
            {saveData.totalKills.toLocaleString()} Eliminations
          </span>
        </div>

        <button
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          className="p-2.5 rounded-lg bg-[#0d1119]/90 border border-white/10 text-slate-300 hover:text-white hover:border-white/25 transition-colors cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Title & Navigation Column */}
      <div className="my-auto max-w-md pointer-events-auto">
        {/* Bespoke SVG Title Lockup */}
        <div className="mb-7">
          <div className="text-xs font-medium tracking-[0.26em] text-red-500 uppercase mb-2">
            3D First-Person Survival Horror
          </div>
          <svg
            viewBox="0 0 420 76"
            className="w-full max-w-[380px] h-auto"
            role="img"
            aria-label="ZOMBIE SHOOTER"
          >
            <text
              x="0"
              y="42"
              fill="#f1f5f9"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="44"
              letterSpacing="3"
            >
              ZOMBIE
            </text>
            <text
              x="2"
              y="70"
              fill="#dc2626"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="26"
              letterSpacing="8"
            >
              SHOOTER
            </text>
            <line x1="175" y1="62" x2="365" y2="62" stroke="#991b1b" strokeWidth="2.5" />
          </svg>
        </div>

        {/* Menu Buttons */}
        <nav className="flex flex-col gap-2.5">
          <button
            onClick={onPlay}
            className="group flex items-center justify-between px-5 py-3.5 rounded-lg bg-red-700 hover:bg-red-600 active:scale-[0.99] text-white font-display font-bold tracking-wider text-lg transition-all cursor-pointer shadow-lg shadow-red-950/40"
          >
            <span className="flex items-center gap-3">
              <Play className="w-5 h-5 fill-current" />
              PLAY
            </span>
            <span className="text-xs font-sans font-medium text-red-100/80">Enter Forest</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => onOpenModal('weapons')}
              className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-[#0d121b]/95 hover:bg-[#151c29] border border-white/10 hover:border-red-500/40 text-slate-200 font-medium text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Crosshair className="w-4 h-4 text-red-400 shrink-0" />
              WEAPONS
            </button>

            <button
              onClick={() => onOpenModal('inventory')}
              className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-[#0d121b]/95 hover:bg-[#151c29] border border-white/10 hover:border-red-500/40 text-slate-200 font-medium text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Backpack className="w-4 h-4 text-amber-400 shrink-0" />
              INVENTORY
            </button>

            <button
              onClick={() => onOpenModal('upgrades')}
              className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-[#0d121b]/95 hover:bg-[#151c29] border border-white/10 hover:border-red-500/40 text-slate-200 font-medium text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
              UPGRADES
            </button>

            <button
              onClick={() => onOpenModal('settings')}
              className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-[#0d121b]/95 hover:bg-[#151c29] border border-white/10 hover:border-red-500/40 text-slate-200 font-medium text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-4 h-4 text-slate-400 shrink-0" />
              SETTINGS
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => onOpenModal('howtoplay')}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-[#0a0e16]/90 hover:bg-[#141a26] border border-white/10 text-slate-300 text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
              HOW TO PLAY
            </button>

            <button
              onClick={onExitToggle}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-[#0a0e16]/90 hover:bg-[#1a1115] border border-white/10 hover:border-red-500/40 text-slate-300 text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 text-red-400 shrink-0" />
              EXIT / RETURN
            </button>
          </div>
        </nav>
      </div>

      {/* Bottom Control Hint */}
      <div className="text-xs text-slate-400 pointer-events-auto">
        WASD Move · Mouse Look · LMB Fire · RMB Aim · R Reload · 1–9 Weapons · Esc Pause
      </div>
    </div>
  );
};
