import React from 'react';
import {
  Coins,
  Heart,
  Pause,
  Shield,
  Skull,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DamageNumberEvent, EquipmentId, HUDState } from '../types/game';
import { WEAPON_LIST } from '../data/WeaponData';

interface Props {
  hud: HUDState;
  damageNumbers: DamageNumberEvent[];
  isMuted: boolean;
  showMobileControls: boolean;
  onPause: () => void;
  onToggleMute: () => void;
  onUseEquipment: (id: EquipmentId) => void;
  onSelectWeapon: (slot: number) => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const GameHUD: React.FC<Props> = ({
  hud,
  damageNumbers,
  isMuted,
  showMobileControls,
  onPause,
  onToggleMute,
  onUseEquipment,
  onSelectWeapon,
}) => {
  const hpPct = Math.max(0, Math.min(100, (hud.health / Math.max(1, hud.maxHealth)) * 100));
  const armorPct = Math.max(0, Math.min(100, (hud.armor / Math.max(1, hud.maxArmor)) * 100));
  const lowHealthAlpha = hud.health < 35 ? ((35 - hud.health) / 35) * 0.45 : 0;
  const vignetteOpacity = Math.max(lowHealthAlpha, hud.damageFlash * 0.55);

  const quickSlots: Array<{ id: EquipmentId; key: string; label: string }> = [
    { id: EquipmentId.GRENADE, key: 'G', label: 'Frag' },
    { id: EquipmentId.BARRICADE, key: 'B', label: 'Wall' },
    { id: EquipmentId.TURRET, key: 'T', label: 'Turret' },
    { id: EquipmentId.MEDKIT, key: 'H', label: 'Heal' },
    { id: EquipmentId.AMMO_CRATE, key: 'F', label: 'Ammo' },
  ];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Low Health & Damage Screen Vignette */}
      {vignetteOpacity > 0.01 && (
        <div
          className="absolute inset-0 transition-opacity duration-100"
          style={{
            opacity: vignetteOpacity,
            background:
              'radial-gradient(circle at center, transparent 42%, rgba(160, 14, 14, 0.85) 100%)',
          }}
        />
      )}

      {/* Floating Damage Numbers */}
      {damageNumbers.map((dn) => (
        <div
          key={dn.id}
          className={`absolute font-mono-tabular font-bold text-sm pointer-events-none -translate-x-1/2 -translate-y-full transition-transform duration-300 ${
            dn.headshot ? 'text-amber-400 text-base' : 'text-slate-100'
          }`}
          style={{ left: dn.x, top: dn.y - 12 }}
        >
          {dn.amount}
          {dn.headshot ? '!' : ''}
        </div>
      ))}

      {/* Top-Left Wave & Combat Telemetry */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-3 bg-[#090c12]/85 border border-white/10 rounded-lg px-3.5 py-2">
        <div>
          <div className="text-[11px] text-slate-400 uppercase tracking-wider">Wave</div>
          <div className="font-display text-xl font-bold text-red-400 tabular-nums leading-none">
            {hud.wave}
          </div>
        </div>
        <div className="h-7 w-px bg-white/10" />
        <div>
          <div className="text-[11px] text-slate-400 uppercase tracking-wider">
            {hud.waveState === 'countdown' ? 'Next Wave' : 'Infected'}
          </div>
          <div className="font-mono-tabular text-lg font-bold text-slate-100 leading-none">
            {hud.waveState === 'countdown' ? `${hud.waveCountdown}s` : hud.zombiesRemaining}
          </div>
        </div>
        <div className="h-7 w-px bg-white/10" />
        <div className="flex items-center gap-1.5 text-sm font-mono-tabular text-slate-200">
          <Skull className="w-4 h-4 text-red-400" />
          <span>{hud.kills}</span>
        </div>
        <div className="hidden sm:block h-7 w-px bg-white/10" />
        <div className="hidden sm:block text-xs font-mono-tabular text-slate-400">
          {formatTime(hud.survivalTime)}
        </div>
      </div>

      {/* Top-Right Coins & Pause/Mute Controls */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-1.5 bg-[#090c12]/85 border border-white/10 rounded-lg px-3 py-2 font-mono-tabular text-sm font-semibold text-amber-400">
          <Coins className="w-4 h-4" />
          <span>{hud.coins.toLocaleString()}</span>
        </div>
        <button
          onClick={onToggleMute}
          aria-label="Toggle Mute"
          className="p-2.5 rounded-lg bg-[#090c12]/85 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={onPause}
          aria-label="Pause Game"
          className="p-2.5 rounded-lg bg-[#090c12]/85 border border-white/10 text-slate-200 hover:bg-[#141925] cursor-pointer"
        >
          <Pause className="w-4 h-4" />
        </button>
      </div>

      {/* Wave Announcement Banner */}
      {hud.waveBanner && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-[#0b0e16]/90 border border-red-600/40 rounded-lg px-6 py-2 text-center">
          <div className="font-display text-lg sm:text-2xl font-bold tracking-[0.2em] text-red-400">
            {hud.waveBanner}
          </div>
        </div>
      )}

      {/* Center Dynamic Crosshair & Hit Marker */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative w-1 h-1">
          <div className="absolute w-1 h-1 -left-0.5 -top-0.5 rounded-full bg-white/90" />
          {/* 4 reticle ticks */}
          <div
            className="absolute left-0 -translate-x-1/2 w-[2px] h-2.5 bg-white/85"
            style={{ bottom: hud.crosshairSpread }}
          />
          <div
            className="absolute left-0 -translate-x-1/2 w-[2px] h-2.5 bg-white/85"
            style={{ top: hud.crosshairSpread }}
          />
          <div
            className="absolute top-0 -translate-y-1/2 h-[2px] w-2.5 bg-white/85"
            style={{ right: hud.crosshairSpread }}
          />
          <div
            className="absolute top-0 -translate-y-1/2 h-[2px] w-2.5 bg-white/85"
            style={{ left: hud.crosshairSpread }}
          />

          {/* Hit Marker X */}
          {hud.hitMarkerType !== 'none' && (
            <svg
              viewBox="0 0 24 24"
              className={`absolute -left-3 -top-3 w-6 h-6 ${
                hud.hitMarkerType === 'kill'
                  ? 'text-red-500'
                  : hud.hitMarkerType === 'headshot'
                  ? 'text-amber-400'
                  : 'text-white'
              }`}
              stroke="currentColor"
              strokeWidth="2.4"
            >
              <line x1="4" y1="4" x2="9" y2="9" />
              <line x1="20" y1="4" x2="15" y2="9" />
              <line x1="4" y1="20" x2="9" y2="15" />
              <line x1="20" y1="20" x2="15" y2="15" />
            </svg>
          )}
        </div>
      </div>

      {/* Reload Progress Indicator */}
      {hud.isReloading && (
        <div className="absolute top-[57%] left-1/2 -translate-x-1/2 w-28">
          <div className="text-[10px] text-center uppercase tracking-widest text-amber-400 mb-1 font-semibold">
            Reloading
          </div>
          <div className="h-1 bg-black/70 rounded-full overflow-hidden border border-white/15">
            <div
              className="h-full bg-amber-400"
              style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Interaction / Pointer Lock Prompt */}
      {(hud.interactPrompt || (!hud.pointerLocked && !showMobileControls)) && (
        <div className="absolute top-[63%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
          {hud.interactPrompt && (
            <div className="bg-[#090c12]/90 border border-amber-500/40 rounded px-3 py-1 text-xs font-medium text-amber-300">
              {hud.interactPrompt}
            </div>
          )}
          {!hud.pointerLocked && !showMobileControls && (
            <div className="bg-[#090c12]/80 border border-white/10 rounded px-3 py-1 text-xs text-slate-300">
              Click game view to lock mouse cursor · Press ESC to pause
            </div>
          )}
        </div>
      )}

      {/* Bottom-Left Health & Armor Cluster */}
      {!showMobileControls && (
        <div className="absolute bottom-4 left-4 w-60 bg-[#090c12]/85 border border-white/10 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5 text-red-400 font-semibold">
              <Heart className="w-3.5 h-3.5 fill-current" />
              HP
            </span>
            <span className="font-mono-tabular text-slate-100 font-bold">
              {hud.health} / {hud.maxHealth}
            </span>
          </div>
          <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 transition-[width] duration-100"
              style={{ width: `${hpPct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs mt-2.5 mb-1">
            <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
              <Shield className="w-3.5 h-3.5" />
              Armor
            </span>
            <span className="font-mono-tabular text-slate-300">{hud.armor}</span>
          </div>
          <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-[width] duration-100"
              style={{ width: `${armorPct}%` }}
            />
          </div>

          {hud.adrenalineTimer > 0 && (
            <div className="mt-2 text-[11px] font-mono-tabular text-emerald-400">
              Adrenaline: {hud.adrenalineTimer.toFixed(1)}s
            </div>
          )}
        </div>
      )}

      {/* Bottom-Center Quick Equipment & Weapon Slot Bar (Desktop) */}
      {!showMobileControls && (
        <div className="hidden md:flex absolute bottom-4 left-1/2 -translate-x-1/2 flex-col items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 bg-[#090c12]/85 border border-white/10 rounded-lg px-2 py-1.5">
            {quickSlots.map((qs) => {
              const count = hud.inventory[qs.id] ?? 0;
              return (
                <button
                  key={qs.id}
                  onClick={() => onUseEquipment(qs.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                    count > 0
                      ? 'bg-[#121824] border-white/15 text-slate-200 hover:border-amber-400/50'
                      : 'bg-[#0b0e15] border-white/5 text-slate-600'
                  }`}
                >
                  <span className="text-amber-400 font-mono-tabular mr-1">[{qs.key}]</span>
                  {qs.label}
                  <span className="ml-1 font-mono-tabular text-slate-400">x{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            {WEAPON_LIST.map((w) => {
              const unlocked = hud.unlockedWeapons.includes(w.id);
              const active = hud.weaponId === w.id;
              if (!unlocked) return null;
              return (
                <button
                  key={w.id}
                  onClick={() => onSelectWeapon(w.slot)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono-tabular cursor-pointer transition-colors ${
                    active
                      ? 'bg-red-700 text-white font-bold'
                      : 'bg-[#090c12]/80 text-slate-400 hover:text-white border border-white/10'
                  }`}
                >
                  {w.slot}. {w.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom-Right Weapon & Ammo Cluster */}
      {!showMobileControls && (
        <div className="absolute bottom-4 right-4 bg-[#090c12]/85 border border-white/10 rounded-lg px-4 py-3 text-right min-w-[175px]">
          <div className="font-display text-sm font-bold text-slate-200 tracking-wide">
            {hud.weaponName}
          </div>
          {hud.isMelee ? (
            <div className="mt-1 font-mono-tabular text-lg font-bold text-slate-300">
              MELEE
            </div>
          ) : (
            <div className="mt-0.5 font-mono-tabular leading-none">
              <span
                className={`text-2xl font-bold ${
                  hud.ammoInMag === 0 ? 'text-red-500' : 'text-slate-100'
                }`}
              >
                {hud.ammoInMag}
              </span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-sm text-slate-400">{hud.ammoReserve}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
