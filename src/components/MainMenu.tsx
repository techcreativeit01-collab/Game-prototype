import React, { useEffect } from 'react';
import {
  Backpack,
  BookOpen,
  Coins,
  Crosshair,
  Gem,
  LogOut,
  Play,
  Settings,
  ShieldAlert,
  ShoppingBag,
  TrendingUp,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { MenuModalType, SaveData } from '../types/game';
import { getXpForNextLevel } from '../data/GameData';
import { MpConnectionStatus } from '../managers/MultiplayerClient';
import { AvatarBadge } from './AvatarBadge';

interface Props {
  saveData: SaveData;
  isMuted: boolean;
  standbyExited: boolean;
  mpStatus: MpConnectionStatus;
  onlineCount: number;
  onPlay: () => void;
  onOpenModal: (modal: MenuModalType) => void;
  onExitToggle: () => void;
  onToggleMute: () => void;
}

export const MainMenu: React.FC<Props> = ({
  saveData,
  isMuted,
  standbyExited,
  mpStatus,
  onlineCount,
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
        <div className="max-w-md w-full bg-[#0e131c] border border-white/15 rounded-xl p-8 text-center shadow-2xl">
          <ShieldAlert className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-slate-100">Session Ended</h2>
          <p className="mt-2 text-sm text-slate-400">
            Your coins, gems, profile, weapons, upgrades, and survival records are saved locally.
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

  const nextXp = getXpForNextLevel(saveData.profile.level);
  const xpPct = Math.min(100, Math.round((saveData.profile.xp / Math.max(1, nextXp)) * 100));

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 lg:p-10 pointer-events-none bg-gradient-to-r from-[#05070b]/90 via-[#070a10]/45 to-transparent">
      {/* Top Status & Profile Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        <button
          onClick={() => onOpenModal('profile')}
          className="flex items-center gap-3 bg-[#090c12]/88 hover:bg-[#111723] border border-white/15 rounded-lg px-3 py-2 text-left transition-colors cursor-pointer"
        >
          <AvatarBadge avatarId={saveData.profile.avatarId} size={38} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold text-slate-100">
                {saveData.profile.username}
              </span>
              <span className="font-mono-tabular text-xs font-bold text-amber-400">
                Lv.{saveData.profile.level}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${xpPct}%` }} />
              </div>
              <span className="text-[10px] font-mono-tabular text-slate-400">
                {saveData.profile.playerId}
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-3 text-xs sm:text-sm font-mono-tabular bg-[#090c12]/88 border border-white/12 rounded-lg px-3.5 py-2">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <Coins className="w-4 h-4" />
              {saveData.coins.toLocaleString()}
            </span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
              <Gem className="w-4 h-4" />
              {saveData.gems.toLocaleString()}
            </span>
            <span className="hidden sm:inline text-slate-600" aria-hidden="true">·</span>
            <span className="hidden sm:flex items-center gap-1.5 text-slate-200">
              <Trophy className="w-4 h-4 text-red-400" />
              Wave {saveData.highestWave}
            </span>
          </div>

          <button
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            className="p-2.5 rounded-lg bg-[#0d1119]/90 border border-white/12 text-slate-300 hover:text-white hover:border-white/25 transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Left-Aligned Title & 8-Action Tactical Menu (3D Hero visible on the right) */}
      <div className="my-auto max-w-md pointer-events-auto">
        <div className="mb-5">
          <div className="text-[11px] font-semibold tracking-[0.26em] text-red-500 uppercase mb-1.5">
            3D First-Person Survival Horror
          </div>
          <svg
            viewBox="0 0 420 74"
            className="w-full max-w-[360px] h-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]"
            role="img"
            aria-label="ZOMBIE SHOOTER"
          >
            <text
              x="0"
              y="40"
              fill="#f1f5f9"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="43"
              letterSpacing="3"
            >
              ZOMBIE
            </text>
            <text
              x="2"
              y="68"
              fill="#dc2626"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="25"
              letterSpacing="8"
            >
              SHOOTER
            </text>
            <line x1="172" y1="60" x2="362" y2="60" stroke="#991b1b" strokeWidth="2.5" />
          </svg>
        </div>

        <nav className="flex flex-col gap-2 bg-[#080b12]/88 border border-white/12 rounded-xl p-3 shadow-2xl">
          <button
            onClick={onPlay}
            className="group flex items-center justify-between px-4 py-3 rounded-lg bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 active:scale-[0.99] text-white font-display font-bold tracking-wider text-base sm:text-lg transition-all cursor-pointer shadow-lg shadow-red-950/50"
          >
            <span className="flex items-center gap-2.5">
              <Play className="w-5 h-5 fill-current" />
              PLAY SOLO
            </span>
            <span className="text-xs font-sans font-medium text-red-100/90">Forest Survival</span>
          </button>

          <button
            onClick={() => onOpenModal('multiplayer')}
            className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-[#111928] hover:bg-[#172236] border border-sky-500/40 hover:border-sky-400 text-slate-100 font-display font-bold tracking-wider text-sm transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-sky-400" />
              MULTIPLAYER SQUAD
            </span>
            <span className="text-[11px] font-mono-tabular text-sky-300">
              {mpStatus === 'connected' ? `${onlineCount} Online` : mpStatus === 'connecting' ? 'Connecting...' : 'Offline'}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onOpenModal('weapons')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0d121b] hover:bg-[#161e2d] border border-white/10 hover:border-red-500/50 text-slate-200 font-medium text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Crosshair className="w-4 h-4 text-red-400 shrink-0" />
              WEAPONS
            </button>

            <button
              onClick={() => onOpenModal('inventory')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0d121b] hover:bg-[#161e2d] border border-white/10 hover:border-amber-500/50 text-slate-200 font-medium text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Backpack className="w-4 h-4 text-amber-400 shrink-0" />
              INVENTORY
            </button>

            <button
              onClick={() => onOpenModal('upgrades')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0d121b] hover:bg-[#161e2d] border border-white/10 hover:border-emerald-500/50 text-slate-200 font-medium text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
              UPGRADES
            </button>

            <button
              onClick={() => onOpenModal('shop')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0d121b] hover:bg-[#161e2d] border border-white/10 hover:border-sky-500/50 text-slate-200 font-medium text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-4 h-4 text-sky-400 shrink-0" />
              SHOP
            </button>

            <button
              onClick={() => onOpenModal('profile')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0d121b] hover:bg-[#161e2d] border border-white/10 hover:border-amber-400/50 text-slate-200 font-medium text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <User className="w-4 h-4 text-amber-300 shrink-0" />
              PROFILE
            </button>

            <button
              onClick={() => onOpenModal('settings')}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#0d121b] hover:bg-[#161e2d] border border-white/10 hover:border-white/30 text-slate-200 font-medium text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-4 h-4 text-slate-400 shrink-0" />
              SETTINGS
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onOpenModal('howtoplay')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0b1018] hover:bg-[#141b28] border border-white/10 text-slate-300 text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
              HOW TO PLAY
            </button>

            <button
              onClick={onExitToggle}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0b1018] hover:bg-[#1a1115] border border-white/10 hover:border-red-500/40 text-slate-300 text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 text-red-400 shrink-0" />
              EXIT / RETURN
            </button>
          </div>
        </nav>
      </div>

      {/* Bottom Control Hint */}
      <div className="text-[11px] sm:text-xs text-slate-400 pointer-events-auto">
        WASD Move · Mouse Look · LMB Fire · RMB Aim · Shift+C Slide · L Flashlight · 1–9 Weapons · Esc Pause
      </div>
    </div>
  );
};
