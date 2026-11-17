import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Coins,
  Flashlight,
  Gem,
  Heart,
  MessageSquare,
  Mic,
  MicOff,
  Pause,
  Send,
  Settings,
  Shield,
  Skull,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ChatMessage,
  DamageNumberEvent,
  EquipmentId,
  HUDState,
  SettingsData,
} from '../types/game';
import { WEAPON_LIST } from '../data/WeaponData';
import { AvatarBadge } from './AvatarBadge';
import { WeaponIllustration } from './WeaponIllustration';

interface Props {
  hud: HUDState;
  settings: SettingsData;
  damageNumbers: DamageNumberEvent[];
  isMuted: boolean;
  showMobileControls: boolean;
  mpConnected: boolean;
  micActive: boolean;
  voiceDeafened: boolean;
  chatMessages: ChatMessage[];
  onPause: () => void;
  onToggleMute: () => void;
  onToggleFlashlight: () => void;
  onUseEquipment: (id: EquipmentId) => void;
  onSelectWeapon: (slot: number) => void;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
  onSendChat: (text: string) => void;
  onOpenSettings: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const COMPASS_MARKS: Array<{ deg: number; label: string; major?: boolean }> = [
  { deg: 0, label: 'N', major: true },
  { deg: 15, label: '15' },
  { deg: 30, label: '30' },
  { deg: 45, label: 'NE', major: true },
  { deg: 60, label: '60' },
  { deg: 75, label: '75' },
  { deg: 90, label: 'E', major: true },
  { deg: 105, label: '105' },
  { deg: 120, label: '120' },
  { deg: 135, label: 'SE', major: true },
  { deg: 150, label: '150' },
  { deg: 165, label: '165' },
  { deg: 180, label: 'S', major: true },
  { deg: 195, label: '195' },
  { deg: 210, label: '210' },
  { deg: 225, label: 'SW', major: true },
  { deg: 240, label: '240' },
  { deg: 255, label: '255' },
  { deg: 270, label: 'W', major: true },
  { deg: 285, label: '285' },
  { deg: 300, label: '300' },
  { deg: 315, label: 'NW', major: true },
  { deg: 330, label: '330' },
  { deg: 345, label: '345' },
];

export const GameHUD: React.FC<Props> = ({
  hud,
  settings,
  damageNumbers,
  isMuted,
  showMobileControls,
  mpConnected,
  micActive,
  voiceDeafened,
  chatMessages,
  onPause,
  onToggleMute,
  onToggleFlashlight,
  onUseEquipment,
  onSelectWeapon,
  onToggleMic,
  onToggleDeafen,
  onSendChat,
  onOpenSettings,
}) => {
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const hpPct = Math.max(0, Math.min(100, (hud.health / Math.max(1, hud.maxHealth)) * 100));
  const armorPct = Math.max(0, Math.min(100, (hud.armor / Math.max(1, hud.maxArmor)) * 100));
  const staminaPct = Math.max(0, Math.min(100, hud.stamina));
  const lowHealthAlpha = hud.health < 35 ? ((35 - hud.health) / 35) * 0.45 : 0;
  const vignetteOpacity = settings.damageIndicators
    ? Math.max(lowHealthAlpha, hud.damageFlash * 0.55)
    : lowHealthAlpha * 0.5;

  // Player heading in degrees [0..360), matching Three.js camera facing -Z when yaw=0
  const headingDeg = useMemo(() => {
    const raw = ((-hud.yaw * 180) / Math.PI) % 360;
    return (raw + 360) % 360;
  }, [hud.yaw]);

  // Draw rotating tactical circular minimap
  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const r = size / 2;
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r - 2, 0, Math.PI * 2);
    ctx.clip();

    // Dark tactical forest radar background
    ctx.fillStyle = '#0b1116';
    ctx.fillRect(0, 0, size, size);

    // Subtle concentric distance rings
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (const rad of [r * 0.35, r * 0.68, r - 2]) {
      ctx.beginPath();
      ctx.arc(r, r, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Forward view cone
    const fovGrad = ctx.createRadialGradient(r, r, 2, r, r, r * 0.85);
    fovGrad.addColorStop(0, 'rgba(74, 222, 128, 0.28)');
    fovGrad.addColorStop(1, 'rgba(74, 222, 128, 0.02)');
    ctx.fillStyle = fovGrad;
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.arc(r, r, r * 0.85, -Math.PI / 2 - 0.52, -Math.PI / 2 + 0.52);
    ctx.closePath();
    ctx.fill();

    // Cross lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
    ctx.beginPath();
    ctx.moveTo(r, 4);
    ctx.lineTo(r, size - 4);
    ctx.moveTo(4, r);
    ctx.lineTo(size - 4, r);
    ctx.stroke();

    // Rotate blips into player heading frame (player always faces UP)
    const maxRadarMeters = 55;
    const cosY = Math.cos(hud.yaw);
    const sinY = Math.sin(hud.yaw);

    for (const blip of hud.minimapBlips) {
      const dx = blip.x - hud.playerX;
      const dz = blip.z - hud.playerZ;
      // Camera forward is (-sin(yaw), -cos(yaw)); camera right is (cos(yaw), -sin(yaw))
      const rx = dx * cosY - dz * sinY;
      const rz = dx * sinY + dz * cosY; // negative rz = in front

      const px = r + (rx / maxRadarMeters) * (r - 8);
      const py = r + (rz / maxRadarMeters) * (r - 8);

      const distFromCenter = Math.hypot(px - r, py - r);
      const clampedScale = distFromCenter > r - 6 ? (r - 6) / distFromCenter : 1;
      const bx = r + (px - r) * clampedScale;
      const by = r + (py - r) * clampedScale;

      ctx.beginPath();
      if (blip.kind === 'boss') {
        ctx.fillStyle = '#f97316';
        ctx.arc(bx, by, 4.2, 0, Math.PI * 2);
      } else if (blip.kind === 'zombie') {
        ctx.fillStyle = '#ef4444';
        ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
      } else if (blip.kind === 'teammate') {
        ctx.fillStyle = '#38bdf8';
        ctx.arc(bx, by, 3.3, 0, Math.PI * 2);
      } else if (blip.kind === 'supply') {
        ctx.fillStyle = '#facc15';
        ctx.rect(bx - 3, by - 3, 6, 6);
      } else {
        ctx.fillStyle = '#34d399';
        ctx.arc(bx, by, 2.3, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    // Center player arrow
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(r, r - 6);
    ctx.lineTo(r + 4.5, r + 5);
    ctx.lineTo(r, r + 2.5);
    ctx.lineTo(r - 4.5, r + 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Outer tactical rim
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r, r, r - 1.5, 0, Math.PI * 2);
    ctx.stroke();

    // North indicator dot on rim
    const northAngle = -Math.PI / 2 - hud.yaw;
    const nx = r + Math.cos(northAngle) * (r - 5);
    const ny = r + Math.sin(northAngle) * (r - 5);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny);
  }, [hud.minimapBlips, hud.playerX, hud.playerZ, hud.yaw]);

  const quickSlots: Array<{ id: EquipmentId; key: string; label: string }> = [
    { id: EquipmentId.GRENADE, key: 'G', label: 'Frag' },
    { id: EquipmentId.BARRICADE, key: 'B', label: 'Wall' },
    { id: EquipmentId.TURRET, key: 'T', label: 'Turret' },
    { id: EquipmentId.MEDKIT, key: 'H', label: 'Heal' },
    { id: EquipmentId.AMMO_CRATE, key: 'F', label: 'Ammo' },
    { id: EquipmentId.ADRENALINE, key: 'X', label: 'Adren' },
  ];

  const unlockedWeaponSpecs = WEAPON_LIST.filter((w) => hud.unlockedWeapons.includes(w.id));
  const quickWeaponBar = unlockedWeaponSpecs.slice(0, 4);
  if (
    unlockedWeaponSpecs.length > 4 &&
    !quickWeaponBar.some((w) => w.id === hud.weaponId)
  ) {
    const cur = unlockedWeaponSpecs.find((w) => w.id === hud.weaponId);
    if (cur) quickWeaponBar[3] = cur;
  }

  const crosshairSpread =
    settings.crosshairStyle === 'cross'
      ? 6
      : settings.crosshairStyle === 'tactical'
      ? Math.max(5, Math.min(18, hud.crosshairSpread * 0.85))
      : hud.crosshairSpread;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* M107 / Scope ADS Overlay */}
      {hud.scopeActive && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at center, transparent 27%, rgba(3,5,8,0.97) 33%)',
          }}
        >
          <div className="absolute inset-y-0 left-1/2 w-px bg-red-500/45" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-red-500/45" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-red-500" />
        </div>
      )}

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

      {/* Directional Hurt Indicator Ring */}
      {settings.damageIndicators && hud.hitDirectionDeg !== null && (
        <div
          className="absolute top-1/2 left-1/2 w-44 h-44 -ml-22 -mt-22 pointer-events-none"
          style={{ transform: `rotate(${hud.hitDirectionDeg}deg)` }}
        >
          <div className="mx-auto w-14 h-2.5 rounded-full bg-red-600/85 shadow-[0_0_12px_rgba(220,38,38,0.9)]" />
        </div>
      )}

      {/* Floating Damage Numbers */}
      {settings.damageIndicators &&
        damageNumbers.map((dn) => (
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

      {/* Scaled + Opacity-Controlled HUD Layer */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: settings.hudOpacity,
          transform: settings.hudScale !== 1 ? `scale(${settings.hudScale})` : undefined,
          transformOrigin: 'center center',
        }}
      >
        {/* TOP-LEFT: Player Card + Squad List + Objectives */}
        <div className="absolute top-2.5 left-2.5 sm:top-3.5 sm:left-3.5 flex flex-col gap-2 max-w-[230px]">
          {/* Operator Identity & XP Card */}
          <div className="flex items-center gap-2.5 bg-[#090c12]/88 border border-white/15 rounded-lg px-2.5 py-2 shadow-lg">
            <AvatarBadge avatarId={hud.playerAvatarId} size={34} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-xs sm:text-sm font-bold text-slate-100 truncate">
                  {hud.playerName}
                </span>
                <span className="font-mono-tabular text-[11px] font-bold text-amber-400 shrink-0">
                  Lv. {hud.playerLevel}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-[width] duration-200"
                  style={{ width: `${Math.round(hud.playerXpPct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Squad Members (Multiplayer) */}
          {hud.squadMembers.length > 1 && (
            <div className="bg-[#090c12]/85 border border-white/12 rounded-lg p-2 space-y-1.5 shadow-lg">
              {hud.squadMembers.slice(0, 4).map((m) => (
                <div key={m.playerId} className="flex items-center gap-2 text-[11px]">
                  <AvatarBadge avatarId={m.avatarId} size={22} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-slate-100 font-semibold truncate">{m.username}</span>
                      <span
                        className={`text-[10px] font-mono-tabular ${
                          m.alive ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {m.alive ? 'Online' : 'Down'}
                      </span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                      <div
                        className={`h-full ${m.alive ? 'bg-emerald-500' : 'bg-red-700'}`}
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, (m.health / Math.max(1, m.maxHealth)) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Objectives Panel */}
          <div className="hidden sm:block bg-[#090c12]/85 border border-white/12 rounded-lg px-2.5 py-2 shadow-lg">
            <div className="flex items-center gap-1.5 text-xs font-display font-bold text-slate-100 border-b border-white/10 pb-1 mb-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rotate-45 bg-amber-500 text-black text-[10px] font-black leading-none">
                <span className="-rotate-45">!</span>
              </span>
              <span>Objectives</span>
            </div>
            <div className="space-y-1">
              {hud.objectives.map((obj) => (
                <div key={obj.id} className="flex items-center gap-1.5 text-[11px] text-slate-200">
                  <span
                    className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center shrink-0 ${
                      obj.completed
                        ? 'bg-emerald-600/80 border-emerald-400 text-white'
                        : 'border-white/35 bg-black/30'
                    }`}
                  >
                    {obj.completed && <Check className="w-2.5 h-2.5" />}
                  </span>
                  <span className={obj.completed ? 'line-through text-slate-400' : 'text-slate-200'}>
                    {obj.label}
                    {obj.progressText ? ` ${obj.progressText}` : ''}
                  </span>
                </div>
              ))}
              {hud.supplyDropDistance !== null && (
                <div className="pt-1 text-[10px] font-mono-tabular text-amber-300">
                  Supply Drop Beacon: {hud.supplyDropDistance}m
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TOP-CENTER: Dynamic Compass + Red WAVE Banner + Zombies Remaining */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex flex-col items-center">
          {/* Dynamic Rotating Compass */}
          <div className="relative w-56 sm:w-72 h-6 overflow-hidden">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-amber-400" />
            {COMPASS_MARKS.map((mark) => {
              let diff = mark.deg - headingDeg;
              if (diff > 180) diff -= 360;
              if (diff < -180) diff += 360;
              if (Math.abs(diff) > 72) return null;
              const offsetPx = diff * 2.1;
              return (
                <div
                  key={mark.deg}
                  className="absolute top-1.5 -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `calc(50% + ${offsetPx}px)` }}
                >
                  <span
                    className={`font-mono-tabular leading-none ${
                      mark.major
                        ? 'text-[11px] font-bold text-slate-100'
                        : 'text-[9px] text-slate-400'
                    }`}
                  >
                    {mark.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Red Tactical WAVE Banner */}
          <div className="mt-0.5 px-7 py-0.5 bg-gradient-to-r from-red-950/90 via-red-700/95 to-red-950/90 border-y border-red-400/50 shadow-lg">
            <div className="font-display text-base sm:text-xl font-bold tracking-[0.18em] text-white leading-tight text-center">
              WAVE {hud.wave}
            </div>
          </div>

          {/* Zombies Remaining / Countdown Strip */}
          <div className="mt-1 flex items-center gap-2 bg-[#090c12]/88 border border-white/15 rounded px-3 py-0.5 text-xs font-mono-tabular text-slate-200 shadow">
            <Skull className="w-3.5 h-3.5 text-red-400" />
            {hud.waveState === 'countdown' ? (
              <span className="text-amber-300 font-semibold">
                Next Wave in {hud.waveCountdown}s
              </span>
            ) : (
              <span>
                Zombies Remaining:{' '}
                <strong className="text-white">{hud.zombiesRemaining}</strong>
              </span>
            )}
            <span className="hidden sm:inline text-slate-500">·</span>
            <span className="hidden sm:inline text-slate-400">{formatTime(hud.survivalTime)}</span>
          </div>
        </div>

        {/* TOP-RIGHT: Coins, Gems, Settings, Minimap & Voice/Chat Controls */}
        <div className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <div className="flex items-center gap-1.5 bg-[#090c12]/90 border border-white/15 rounded-lg px-2.5 py-1.5 font-mono-tabular text-xs sm:text-sm font-semibold text-amber-400 shadow">
              <Coins className="w-3.5 h-3.5" />
              <span>{hud.coins.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#090c12]/90 border border-white/15 rounded-lg px-2.5 py-1.5 font-mono-tabular text-xs sm:text-sm font-semibold text-sky-400 shadow">
              <Gem className="w-3.5 h-3.5" />
              <span>{hud.gems.toLocaleString()}</span>
            </div>
            {!showMobileControls && (
              <button
                onClick={onToggleFlashlight}
                title="Toggle Flashlight [L]"
                aria-label="Toggle Flashlight"
                className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                  hud.flashlightOn
                    ? 'bg-[#171d29] border-amber-400/50 text-amber-300'
                    : 'bg-[#090c12]/90 border-white/15 text-slate-400 hover:text-white'
                }`}
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onToggleMute}
              aria-label="Toggle Mute"
              className="p-2 rounded-lg bg-[#090c12]/90 border border-white/15 text-slate-300 hover:text-white cursor-pointer"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onOpenSettings}
              aria-label="Quick Settings"
              className="hidden sm:flex p-2 rounded-lg bg-[#090c12]/90 border border-white/15 text-slate-300 hover:text-white cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onPause}
              aria-label="Pause Game"
              className="p-2 rounded-lg bg-[#090c12]/90 border border-white/15 text-slate-200 hover:bg-[#141925] cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* Voice / Chat stack + Rotating Minimap */}
          <div className="flex items-start gap-2">
            <div className="flex flex-col gap-1.5 pointer-events-auto">
              <button
                onClick={onToggleMic}
                title={mpConnected ? 'Toggle Squad Microphone' : 'Voice Chat (Multiplayer)'}
                aria-label="Toggle Microphone"
                className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition-colors ${
                  micActive
                    ? 'bg-emerald-700 border-emerald-400 text-white'
                    : 'bg-[#090c12]/90 border-white/20 text-slate-300 hover:text-white'
                }`}
              >
                {micActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onToggleDeafen}
                title="Mute Incoming Voice"
                aria-label="Toggle Voice Audio"
                className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition-colors ${
                  voiceDeafened
                    ? 'bg-red-900/80 border-red-500 text-red-200'
                    : 'bg-[#090c12]/90 border-white/20 text-slate-300 hover:text-white'
                }`}
              >
                {voiceDeafened ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => setChatOpen((o) => !o)}
                title="Squad Chat"
                aria-label="Toggle Squad Chat"
                className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition-colors ${
                  chatOpen
                    ? 'bg-amber-600 border-amber-400 text-white'
                    : 'bg-[#090c12]/90 border-white/20 text-slate-300 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-1">
              <canvas
                ref={minimapRef}
                width={104}
                height={104}
                className="w-[88px] h-[88px] sm:w-[104px] sm:h-[104px] rounded-full shadow-xl"
              />
              <div className="text-[10px] font-mono-tabular text-slate-400 uppercase tracking-wider">
                {hud.fps} FPS · {hud.qualityTier}
              </div>
            </div>
          </div>

          {/* Collapsible In-Game Squad Chat Drawer */}
          {chatOpen && (
            <div className="w-64 bg-[#090c12]/95 border border-white/15 rounded-lg p-2.5 pointer-events-auto shadow-2xl">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 border-b border-white/10 pb-1 mb-1.5">
                <span>{mpConnected ? 'Squad Comms' : 'Offline Solo Mode'}</span>
                <button
                  onClick={() => setChatOpen(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="max-h-28 overflow-y-auto survival-scroll space-y-1 text-[11px] mb-2">
                {chatMessages.length === 0 ? (
                  <div className="text-slate-500">No messages yet.</div>
                ) : (
                  chatMessages.slice(-8).map((m) => (
                    <div key={m.id} className="leading-snug">
                      <span className="text-amber-400 font-semibold">{m.senderName}: </span>
                      <span className="text-slate-200">{m.text}</span>
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chatInput.trim()) return;
                  onSendChat(chatInput.trim());
                  setChatInput('');
                }}
                className="flex gap-1"
              >
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={mpConnected ? 'Send squad message...' : 'Solo mode'}
                  disabled={!mpConnected}
                  className="flex-1 bg-[#111622] border border-white/10 rounded px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-amber-500/60"
                />
                <button
                  type="submit"
                  disabled={!mpConnected}
                  className="px-2 py-1 rounded bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Wave Announcement Banner */}
        {hud.waveBanner && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-[#0b0e16]/95 border border-red-600/50 rounded-lg px-6 py-2 text-center shadow-xl">
            <div className="font-display text-lg sm:text-2xl font-bold tracking-[0.2em] text-red-400">
              {hud.waveBanner}
            </div>
          </div>
        )}

        {/* Target Infected Health Telemetry */}
        {hud.targetZombie && !hud.waveBanner && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-52 bg-[#090c12]/90 border border-white/15 rounded-md px-3 py-1.5">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span
                className={
                  hud.targetZombie.isBoss
                    ? 'text-red-400 font-bold'
                    : 'text-slate-200 font-semibold'
                }
              >
                {hud.targetZombie.name}
              </span>
              <span className="font-mono-tabular text-slate-400">
                {hud.targetZombie.health}/{hud.targetZombie.maxHealth}
              </span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-600"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, (hud.targetZombie.health / Math.max(1, hud.targetZombie.maxHealth)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* BOTTOM-LEFT (Desktop): Quick Equipment & Stamina */}
        {!showMobileControls && (
          <div className="absolute bottom-3.5 left-3.5 flex flex-col gap-2 pointer-events-auto">
            <div className="flex flex-wrap gap-1 max-w-[270px] bg-[#090c12]/88 border border-white/15 rounded-lg p-1.5 shadow-xl">
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

            <div className="w-60 bg-[#090c12]/88 border border-white/15 rounded-lg px-3 py-2 shadow-xl">
              <div className="flex items-center justify-between text-[11px] mb-1 text-slate-300">
                <span>
                  Stamina {hud.isSliding ? '· SLIDING' : hud.isCrouching ? '· CROUCH' : ''}
                </span>
                <span className="font-mono-tabular">{hud.stamina}%</span>
              </div>
              <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-[width] duration-75"
                  style={{ width: `${staminaPct}%` }}
                />
              </div>
              {hud.adrenalineTimer > 0 && (
                <div className="mt-1 text-[11px] font-mono-tabular text-emerald-400">
                  Adrenaline: {hud.adrenalineTimer.toFixed(1)}s
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOTTOM-CENTER: Weapon Quick Slots + Side-by-Side HP & Armor Bars */}
        <div className="absolute bottom-2.5 sm:bottom-3.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            {quickWeaponBar.map((w, idx) => {
              const active = hud.weaponId === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => onSelectWeapon(w.slot)}
                  className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#1a1f2b]/95 border-amber-400 shadow-lg'
                      : 'bg-[#090c12]/85 border-white/15 hover:border-white/30'
                  }`}
                >
                  <WeaponIllustration weaponId={w.id} className="w-12 sm:w-16 h-6 sm:h-7" />
                  {active && !w.isMelee && (
                    <span className="font-mono-tabular text-[11px] font-bold text-slate-100">
                      {hud.ammoInMag}/{hud.ammoReserve}
                    </span>
                  )}
                  <span className="text-[10px] font-mono-tabular text-slate-400">
                    {idx + 1}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 w-[260px] sm:w-[340px]">
            <div className="flex-1 bg-[#090c12]/90 border border-white/15 rounded px-2 py-1">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] mb-0.5">
                <span className="flex items-center gap-1 text-red-400 font-bold">
                  <Heart className="w-3 h-3 fill-current" />
                  HP {hud.health}/{hud.maxHealth}
                </span>
              </div>
              <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-[width] duration-100"
                  style={{ width: `${hpPct}%` }}
                />
              </div>
            </div>

            <div className="flex-1 bg-[#090c12]/90 border border-white/15 rounded px-2 py-1">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] mb-0.5">
                <span className="flex items-center gap-1 text-sky-400 font-bold">
                  <Shield className="w-3 h-3" />
                  Armor {hud.armor}/{hud.maxArmor}
                </span>
              </div>
              <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-[width] duration-100"
                  style={{ width: `${armorPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM-RIGHT (Desktop): Active Weapon Telemetry */}
        {!showMobileControls && (
          <div className="absolute bottom-3.5 right-3.5 bg-[#090c12]/90 border border-white/15 rounded-lg px-4 py-2.5 text-right min-w-[170px] shadow-xl">
            <div className="font-display text-sm font-bold text-slate-200 tracking-wide">
              {hud.weaponName}
            </div>
            {hud.isMelee ? (
              <div className="mt-0.5 font-mono-tabular text-base font-bold text-slate-300">
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

      {/* Center Dynamic Crosshair & Hit Marker */}
      {!hud.scopeActive && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative w-1 h-1">
            <div
              className="absolute w-1 h-1 -left-0.5 -top-0.5 rounded-full"
              style={{ backgroundColor: settings.crosshairColor }}
            />
            {settings.crosshairStyle !== 'dot' && (
              <>
                <div
                  className="absolute left-0 -translate-x-1/2 w-[2px] h-2.5"
                  style={{
                    bottom: crosshairSpread,
                    backgroundColor: settings.crosshairColor,
                  }}
                />
                <div
                  className="absolute left-0 -translate-x-1/2 w-[2px] h-2.5"
                  style={{
                    top: crosshairSpread,
                    backgroundColor: settings.crosshairColor,
                  }}
                />
                <div
                  className="absolute top-0 -translate-y-1/2 h-[2px] w-2.5"
                  style={{
                    right: crosshairSpread,
                    backgroundColor: settings.crosshairColor,
                  }}
                />
                <div
                  className="absolute top-0 -translate-y-1/2 h-[2px] w-2.5"
                  style={{
                    left: crosshairSpread,
                    backgroundColor: settings.crosshairColor,
                  }}
                />
              </>
            )}

            {settings.hitMarkers && hud.hitMarkerType !== 'none' && (
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
      )}

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
            <div className="bg-[#090c12]/85 border border-white/10 rounded px-3 py-1 text-xs text-slate-300">
              Click game view to lock cursor · Press ESC to pause
            </div>
          )}
        </div>
      )}
    </div>
  );
};
