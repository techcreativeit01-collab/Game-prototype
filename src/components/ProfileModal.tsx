import React, { useState } from 'react';
import {
  Award,
  Check,
  Clock,
  Cloud,
  CloudOff,
  Crosshair,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  Skull,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';
import { AVATAR_PRESETS, CHARACTER_SKINS, getXpForNextLevel } from '../data/GameData';
import { CharacterSkinId, SaveData } from '../types/game';
import { CloudSyncStatus } from '../managers/EconomyManager';
import { AvatarBadge } from './AvatarBadge';

interface Props {
  saveData: SaveData;
  cloudConfigured: boolean;
  cloudEmail: string | null;
  cloudSyncStatus: CloudSyncStatus;
  onUpdateProfile: (partial: { username?: string; avatarId?: number }) => void;
  onSelectSkin: (skinId: CharacterSkinId) => void;
  onSignIn: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  onSignUp: (
    email: string,
    password: string,
    username: string
  ) => Promise<{ ok: boolean; message: string }>;
  onSignOut: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onClose: () => void;
}

function formatHoursMin(sec: number): string {
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return h > 0 ? `${h}h ${remM}m` : `${remM}m ${Math.floor(sec % 60)}s`;
}

export const ProfileModal: React.FC<Props> = ({
  saveData,
  cloudConfigured,
  cloudEmail,
  cloudSyncStatus,
  onUpdateProfile,
  onSelectSkin,
  onSignIn,
  onSignUp,
  onSignOut,
  onSyncNow,
  onClose,
}) => {
  const [username, setUsername] = useState(saveData.profile.username);
  const [avatarId, setAvatarId] = useState(saveData.profile.avatarId);
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authFeedback, setAuthFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const nextXp = getXpForNextLevel(saveData.profile.level);
  const xpPct = Math.min(100, Math.round((saveData.profile.xp / Math.max(1, nextXp)) * 100));

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setAuthFeedback({ ok: false, text: 'Enter a valid email and password (min 6 chars).' });
      return;
    }
    setAuthBusy(true);
    setAuthFeedback(null);
    const res =
      authTab === 'signin'
        ? await onSignIn(email, password)
        : await onSignUp(email, password, username);
    setAuthBusy(false);
    setAuthFeedback({ ok: res.ok, text: res.message });
    if (res.ok && authTab === 'signin') {
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/82 p-3 sm:p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#0c1018] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c12]">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-100 tracking-wide">
              SURVIVOR PROFILE
            </h2>
            <p className="text-xs text-slate-400 font-mono-tabular">
              Operator ID: {saveData.profile.playerId}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Profile"
            className="p-2 rounded-lg bg-[#151b26] hover:bg-[#1e2636] text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto survival-scroll space-y-6">
          {/* Identity & XP */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 bg-[#101521] border border-white/10 rounded-xl p-4">
            <AvatarBadge avatarId={avatarId} size={68} />
            <div className="flex-1 w-full">
              <div className="flex items-center justify-between gap-2">
                <div className="font-display text-xl font-bold text-slate-100">
                  {saveData.profile.username}
                </div>
                <span className="font-mono-tabular text-sm font-bold text-amber-400">
                  Level {saveData.profile.level}
                </span>
              </div>
              <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${xpPct}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] font-mono-tabular text-slate-400">
                <span>
                  XP {saveData.profile.xp.toLocaleString()} / {nextXp.toLocaleString()}
                </span>
                <span>{xpPct}% to next rank</span>
              </div>
            </div>
          </div>

          {/* Supabase Cloud Account & Persistent Save Sync */}
          <div className="bg-[#101521] border border-sky-500/30 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {cloudEmail ? (
                  <Cloud className="w-4 h-4 text-emerald-400" />
                ) : (
                  <CloudOff className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-xs font-display font-bold uppercase tracking-wider text-slate-200">
                  Cloud Account & Persistent Save (Supabase)
                </span>
              </div>
              <span
                className={`text-[11px] font-mono-tabular font-semibold ${
                  cloudSyncStatus === 'synced'
                    ? 'text-emerald-400'
                    : cloudSyncStatus === 'syncing'
                    ? 'text-amber-400'
                    : cloudSyncStatus === 'error'
                    ? 'text-red-400'
                    : 'text-slate-400'
                }`}
              >
                {cloudEmail
                  ? cloudSyncStatus === 'synced'
                    ? 'CLOUD SYNCED'
                    : cloudSyncStatus === 'syncing'
                    ? 'SYNCING...'
                    : 'SYNC RETRY NEEDED'
                  : cloudConfigured
                  ? 'LOCAL GUEST'
                  : 'LOCAL SAVE ONLY'}
              </span>
            </div>

            {cloudEmail ? (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#090c12] border border-white/10 rounded-lg p-3">
                <div className="text-xs text-slate-300">
                  Signed in as <strong className="text-sky-300">{cloudEmail}</strong>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Coins, gems, weapons, upgrades, skins, and stats auto-sync to Postgres.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void onSyncNow()}
                    disabled={cloudSyncStatus === 'syncing'}
                    className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Sync Now
                  </button>
                  <button
                    onClick={() => void onSignOut()}
                    className="px-3 py-1.5 rounded-lg bg-[#1d1419] hover:bg-[#2c1922] border border-red-900/50 text-red-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            ) : cloudConfigured ? (
              <form onSubmit={handleAuthSubmit} className="space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('signin');
                      setAuthFeedback(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                      authTab === 'signin'
                        ? 'bg-sky-700 border-sky-500 text-white'
                        : 'bg-[#090c12] border-white/10 text-slate-400'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('signup');
                      setAuthFeedback(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                      authTab === 'signup'
                        ? 'bg-sky-700 border-sky-500 text-white'
                        : 'bg-[#090c12] border-white/10 text-slate-400'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    required
                    className="bg-[#090c12] border border-white/15 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min 6 chars)"
                    minLength={6}
                    required
                    className="bg-[#090c12] border border-white/15 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-400"
                  />
                </div>

                {authFeedback && (
                  <div
                    className={`text-xs px-3 py-2 rounded-lg border ${
                      authFeedback.ok
                        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                        : 'bg-red-950/50 border-red-500/40 text-red-200'
                    }`}
                  >
                    {authFeedback.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {authTab === 'signin' ? (
                    <LogIn className="w-3.5 h-3.5" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  {authBusy
                    ? 'Processing...'
                    : authTab === 'signin'
                    ? 'Sign In & Sync Progress'
                    : 'Create Cloud Account'}
                </button>
              </form>
            ) : (
              <p className="text-xs text-slate-400">
                Guest progression is saved locally. Set <code className="text-slate-300">VITE_SUPABASE_URL</code> and{' '}
                <code className="text-slate-300">VITE_SUPABASE_ANON_KEY</code> in Vercel to enable free cloud accounts & persistent saves.
              </p>
            )}
          </div>

          {/* Callsign & Avatar Customizer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#101521] border border-white/10 rounded-xl p-4 space-y-3">
              <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-300">
                Operator Callsign
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={16}
                className="w-full bg-[#090c12] border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-400/60"
              />
              <button
                onClick={() => onUpdateProfile({ username, avatarId })}
                className="w-full py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save Identity
              </button>
            </div>

            <div className="bg-[#101521] border border-white/10 rounded-xl p-4">
              <div className="text-xs font-display font-bold uppercase tracking-wider text-slate-300 mb-3">
                Tactical Emblem
              </div>
              <div className="grid grid-cols-3 gap-2">
                {AVATAR_PRESETS.map((ap) => (
                  <button
                    key={ap.id}
                    onClick={() => {
                      setAvatarId(ap.id);
                      onUpdateProfile({ avatarId: ap.id });
                    }}
                    className={`p-2 rounded-lg border flex flex-col items-center gap-1 cursor-pointer ${
                      avatarId === ap.id
                        ? 'bg-[#192234] border-amber-400'
                        : 'bg-[#090c12] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <AvatarBadge avatarId={ap.id} size={34} />
                    <span className="text-[10px] text-slate-300">{ap.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Unlocked Outfits Quick Switcher */}
          <div>
            <div className="text-xs font-display font-bold uppercase tracking-wider text-slate-300 mb-2">
              Equipped Combat Uniform
            </div>
            <div className="flex flex-wrap gap-2">
              {CHARACTER_SKINS.filter((s) => saveData.unlockedCharacterSkins.includes(s.id)).map(
                (skin) => {
                  const active = saveData.profile.selectedCharacterSkin === skin.id;
                  return (
                    <button
                      key={skin.id}
                      onClick={() => onSelectSkin(skin.id)}
                      className={`px-3 py-2 rounded-lg border flex items-center gap-2 text-xs font-semibold cursor-pointer ${
                        active
                          ? 'bg-[#182235] border-amber-400 text-white'
                          : 'bg-[#101521] border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded border border-white/25"
                        style={{ background: skin.swatchCss }}
                      />
                      {skin.name}
                      {active && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Career Telemetry */}
          <div>
            <div className="text-xs font-display font-bold uppercase tracking-wider text-slate-300 mb-2.5">
              Career Combat Statistics
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono-tabular">
              <div className="p-3 rounded-lg bg-[#101521] border border-white/10">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Skull className="w-3.5 h-3.5 text-red-400" />
                  Total Eliminations
                </div>
                <div className="text-xl font-bold text-slate-100 mt-1">
                  {saveData.totalKills.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#101521] border border-white/10">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  Highest Wave
                </div>
                <div className="text-xl font-bold text-slate-100 mt-1">{saveData.highestWave}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#101521] border border-white/10">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Award className="w-3.5 h-3.5 text-emerald-400" />
                  Matches Won / Played
                </div>
                <div className="text-xl font-bold text-slate-100 mt-1">
                  {saveData.profile.matchesWon} / {saveData.profile.matchesPlayed}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#101521] border border-white/10">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  Best Survival Run
                </div>
                <div className="text-lg font-bold text-slate-100 mt-1">
                  {formatHoursMin(saveData.bestSurvivalTime)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#101521] border border-white/10">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Total Playtime
                </div>
                <div className="text-lg font-bold text-slate-100 mt-1">
                  {formatHoursMin(saveData.profile.totalPlaytimeSec)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#101521] border border-white/10">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                  Weapons Unlocked
                </div>
                <div className="text-lg font-bold text-slate-100 mt-1">
                  {saveData.unlockedWeapons.length} / 9
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
