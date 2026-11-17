import React, { useState } from 'react';
import {
  Camera,
  Cpu,
  Gamepad2,
  Monitor,
  RotateCcw,
  Save,
  Smartphone,
  Volume2,
  X,
} from 'lucide-react';
import {
  AimMode,
  CrosshairStyle,
  EffectsQuality,
  FpsLimitOption,
  GraphicsQuality,
  MobileControlsMode,
  SettingsData,
  ShadowQuality,
  TextureQuality,
} from '../types/game';
import { getDefaultSettings } from '../managers/SaveManager';
import {
  detectRecommendedQuality,
  getGraphicsPresetOverrides,
} from '../managers/SettingsManager';

interface Props {
  settings: SettingsData;
  onApply: (next: SettingsData) => void;
  onResetSaveData: () => void;
  onClose: () => void;
}

type SettingsTab = 'camera' | 'graphics' | 'gameplay' | 'audio' | 'controls';

export const SettingsModal: React.FC<Props> = ({
  settings,
  onApply,
  onResetSaveData,
  onClose,
}) => {
  const [draft, setDraft] = useState<SettingsData>({ ...settings });
  const [tab, setTab] = useState<SettingsTab>('graphics');
  const [confirmWipe, setConfirmWipe] = useState(false);

  const handleResetSettings = () => {
    const def = getDefaultSettings();
    setDraft(def);
    onApply(def);
  };

  const applyPreset = (q: GraphicsQuality) => {
    const overrides = getGraphicsPresetOverrides(q);
    setDraft((prev) => ({ ...prev, ...overrides }));
  };

  const handleAutoDetect = () => {
    const rec = detectRecommendedQuality();
    applyPreset(rec);
  };

  const ToggleBtn: React.FC<{
    label: string;
    desc?: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }> = ({ label, desc, value, onChange }) => (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div>
        <div className="text-xs font-medium text-slate-200">{label}</div>
        {desc && <div className="text-[11px] text-slate-400">{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer shrink-0 ${
          value
            ? 'bg-red-700 border-red-500 text-white'
            : 'bg-[#121722] border-white/10 text-slate-300'
        }`}
      >
        {value ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    { id: 'camera', label: 'Camera', icon: <Camera className="w-3.5 h-3.5" /> },
    { id: 'graphics', label: 'Graphics', icon: <Monitor className="w-3.5 h-3.5" /> },
    { id: 'gameplay', label: 'Gameplay', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
    { id: 'audio', label: 'Audio', icon: <Volume2 className="w-3.5 h-3.5" /> },
    { id: 'controls', label: 'Controls & HUD', icon: <Smartphone className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/82 p-3 sm:p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#0c1018] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c12]">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-100 tracking-wide">
              TACTICAL SETTINGS
            </h2>
            <p className="text-xs text-slate-400">
              Hardware optimization presets, camera optics, audio mix, and touch HUD layout
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Settings"
            className="p-2 rounded-lg bg-[#151b26] hover:bg-[#1e2636] text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5-Tab Navigation Bar */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0a0e16] border-b border-white/10 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                tab === t.id
                  ? 'bg-red-700 text-white'
                  : 'bg-[#121722] text-slate-300 hover:bg-[#1a2232]'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto survival-scroll space-y-5 flex-1">
          {tab === 'camera' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs text-slate-200 w-44">Field of View (FOV)</label>
                <input
                  type="range"
                  min={60}
                  max={110}
                  step={1}
                  value={draft.fov}
                  onChange={(e) => setDraft({ ...draft, fov: parseInt(e.target.value, 10) })}
                  className="flex-1 accent-red-600"
                />
                <span className="w-14 text-right font-mono-tabular text-xs text-slate-200">
                  {draft.fov}°
                </span>
              </div>

              {(
                [
                  ['mouseSensitivity', 'Mouse Sensitivity', 0.2, 3.0],
                  ['cameraSensitivity', 'Camera Look Multiplier', 0.2, 3.0],
                  ['aimSensitivity', 'ADS Scope Multiplier', 0.2, 2.0],
                  ['horizontalSensitivity', 'Horizontal Ratio', 0.4, 2.0],
                  ['verticalSensitivity', 'Vertical Ratio', 0.4, 2.0],
                  ['cameraSmoothing', 'Camera Smoothing', 0, 0.85],
                ] as const
              ).map(([key, label, min, max]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <label className="text-xs text-slate-300 w-44">{label}</label>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={0.05}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: parseFloat(e.target.value) })}
                    className="flex-1 accent-red-600"
                  />
                  <span className="w-14 text-right font-mono-tabular text-xs text-slate-300">
                    {key === 'cameraSmoothing'
                      ? `${Math.round(draft[key] * 100)}%`
                      : `${draft[key].toFixed(2)}×`}
                  </span>
                </div>
              ))}

              <div className="pt-2 border-t border-white/10 space-y-1">
                <ToggleBtn
                  label="Invert Y-Axis"
                  value={draft.invertY}
                  onChange={(v) => setDraft({ ...draft, invertY: v })}
                />
                <ToggleBtn
                  label="Aim Assist Magnetism"
                  desc="Subtle target acquisition nudge on mobile and close engagements"
                  value={draft.aimAssist}
                  onChange={(v) => setDraft({ ...draft, aimAssist: v })}
                />
              </div>
            </div>
          )}

          {tab === 'graphics' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 bg-[#111722] border border-white/10 rounded-lg p-3">
                <div>
                  <div className="text-xs font-semibold text-slate-100">
                    Hardware Quality Tier
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Low preset targets 1GB–2GB RAM phones with dynamic scaling
                  </div>
                </div>
                <button
                  onClick={handleAutoDetect}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold cursor-pointer"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Auto-Detect
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[]).map((q) => (
                  <button
                    key={q}
                    onClick={() => applyPreset(q)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold capitalize border cursor-pointer transition-colors ${
                      draft.graphicsQuality === q
                        ? 'bg-red-700 border-red-500 text-white'
                        : 'bg-[#121722] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Shadow Quality</div>
                  <div className="grid grid-cols-4 gap-1">
                    {(['off', 'low', 'medium', 'high'] as ShadowQuality[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setDraft({ ...draft, shadowQuality: s })}
                        className={`py-1.5 rounded text-[11px] capitalize border cursor-pointer ${
                          draft.shadowQuality === s
                            ? 'bg-red-700 border-red-500 text-white'
                            : 'bg-[#121722] border-white/10 text-slate-300'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Texture Resolution</div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['low', 'medium', 'high'] as TextureQuality[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setDraft({ ...draft, textureQuality: t })}
                        className={`py-1.5 rounded text-[11px] capitalize border cursor-pointer ${
                          draft.textureQuality === t
                            ? 'bg-red-700 border-red-500 text-white'
                            : 'bg-[#121722] border-white/10 text-slate-300'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">VFX & Particles</div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['low', 'medium', 'high'] as EffectsQuality[]).map((ef) => (
                      <button
                        key={ef}
                        onClick={() => setDraft({ ...draft, effectsQuality: ef })}
                        className={`py-1.5 rounded text-[11px] capitalize border cursor-pointer ${
                          draft.effectsQuality === ef
                            ? 'bg-red-700 border-red-500 text-white'
                            : 'bg-[#121722] border-white/10 text-slate-300'
                        }`}
                      >
                        {ef}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Frame Rate Cap</div>
                  <div className="grid grid-cols-5 gap-1">
                    {([30, 45, 60, 90, 120] as FpsLimitOption[]).map((fps) => (
                      <button
                        key={fps}
                        onClick={() => setDraft({ ...draft, fpsLimit: fps })}
                        className={`py-1.5 rounded text-[11px] font-mono-tabular border cursor-pointer ${
                          draft.fpsLimit === fps
                            ? 'bg-red-700 border-red-500 text-white'
                            : 'bg-[#121722] border-white/10 text-slate-300'
                        }`}
                      >
                        {fps}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {(
                [
                  ['resolutionScale', 'Resolution Scale', 0.5, 1.25, 0.05, (v: number) => `${Math.round(v * 100)}%`],
                  ['renderDistance', 'View / Culling Distance', 45, 150, 5, (v: number) => `${v}m`],
                  ['vegetationDensity', 'Forest Grass & Shrub Density', 0.2, 1.0, 0.1, (v: number) => `${Math.round(v * 100)}%`],
                  ['lodDistance', '3D Model LOD Distance', 0.6, 1.5, 0.1, (v: number) => `${v.toFixed(1)}×`],
                ] as const
              ).map(([key, label, min, max, step, fmt]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <label className="text-xs text-slate-300 w-44">{label}</label>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: parseFloat(e.target.value) })}
                    className="flex-1 accent-red-600"
                  />
                  <span className="w-14 text-right font-mono-tabular text-xs text-slate-300">
                    {fmt(draft[key])}
                  </span>
                </div>
              ))}

              <div className="pt-2 border-t border-white/10 space-y-1">
                <ToggleBtn
                  label="Night Rain Weather"
                  desc="Atmospheric rainfall streaks across moonlight"
                  value={draft.rainEnabled}
                  onChange={(v) => setDraft({ ...draft, rainEnabled: v })}
                />
                <ToggleBtn
                  label="Anti-Aliasing"
                  value={draft.antiAliasing}
                  onChange={(v) => setDraft({ ...draft, antiAliasing: v })}
                />
              </div>
            </div>
          )}

          {tab === 'gameplay' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium text-slate-300 mb-1.5">ADS Aim Behavior</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['hold', 'toggle'] as AimMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setDraft({ ...draft, aimMode: m })}
                        className={`py-2 rounded-lg text-xs font-semibold capitalize border cursor-pointer ${
                          draft.aimMode === m
                            ? 'bg-red-700 border-red-500 text-white'
                            : 'bg-[#121722] border-white/10 text-slate-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-slate-300 mb-1.5">Crosshair Style</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['tactical', 'dot', 'cross', 'dynamic'] as CrosshairStyle[]).map((cs) => (
                      <button
                        key={cs}
                        onClick={() => setDraft({ ...draft, crosshairStyle: cs })}
                        className={`py-2 rounded-lg text-[11px] font-semibold capitalize border cursor-pointer ${
                          draft.crosshairStyle === cs
                            ? 'bg-red-700 border-red-500 text-white'
                            : 'bg-[#121722] border-white/10 text-slate-300'
                        }`}
                      >
                        {cs}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-slate-300">Crosshair Reticle Color</span>
                <div className="flex items-center gap-2">
                  {['#ffffff', '#ef4444', '#22c55e', '#facc15', '#38bdf8'].map((col) => (
                    <button
                      key={col}
                      onClick={() => setDraft({ ...draft, crosshairColor: col })}
                      className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                        draft.crosshairColor === col ? 'border-white scale-110' : 'border-white/20'
                      }`}
                      style={{ backgroundColor: col }}
                      aria-label={`Select crosshair color ${col}`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 space-y-1">
                <ToggleBtn
                  label="Auto Reload Empty Mag"
                  value={draft.autoReload}
                  onChange={(v) => setDraft({ ...draft, autoReload: v })}
                />
                <ToggleBtn
                  label="Auto Sprint"
                  desc="Sprint automatically when moving forward"
                  value={draft.autoSprint}
                  onChange={(v) => setDraft({ ...draft, autoSprint: v })}
                />
                <ToggleBtn
                  label="Floating Damage Numbers & Hurt Indicators"
                  value={draft.damageIndicators}
                  onChange={(v) => setDraft({ ...draft, damageIndicators: v })}
                />
                <ToggleBtn
                  label="Combat Hit Markers"
                  value={draft.hitMarkers}
                  onChange={(v) => setDraft({ ...draft, hitMarkers: v })}
                />
                <ToggleBtn
                  label="Mobile Gyroscope Aiming"
                  value={draft.gyroscope}
                  onChange={(v) => setDraft({ ...draft, gyroscope: v })}
                />
                <ToggleBtn
                  label="Haptic Vibration Feedback"
                  value={draft.vibration}
                  onChange={(v) => setDraft({ ...draft, vibration: v })}
                />
              </div>
            </div>
          )}

          {tab === 'audio' && (
            <div className="space-y-4">
              <ToggleBtn
                label="Mute All Game Audio"
                value={draft.muted}
                onChange={(v) => setDraft({ ...draft, muted: v })}
              />
              {(
                [
                  ['masterVolume', 'Master Volume'],
                  ['sfxVolume', 'Weapons & Combat SFX'],
                  ['ambientVolume', 'Forest Wind & Rain'],
                  ['musicVolume', 'Tension Ambience'],
                  ['voiceVolume', 'Squad Voice Chat'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <label className="text-xs text-slate-300 w-44">{label}</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: parseFloat(e.target.value) })}
                    className="flex-1 accent-red-600"
                  />
                  <span className="w-12 text-right font-mono-tabular text-xs text-slate-300">
                    {Math.round(draft[key] * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === 'controls' && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-slate-200 mb-2">
                  Mobile Touch Overlay Mode
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['auto', 'Auto Detect'],
                      ['always', 'Always On'],
                      ['off', 'Disabled'],
                    ] as Array<[MobileControlsMode, string]>
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setDraft({ ...draft, mobileControls: mode })}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                        draft.mobileControls === mode
                          ? 'bg-red-700 border-red-500 text-white'
                          : 'bg-[#121722] border-white/10 text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-200 mb-2">
                  Joystick Side Placement
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(['left', 'right'] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setDraft({ ...draft, joystickSide: side })}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold capitalize border cursor-pointer ${
                        draft.joystickSide === side
                          ? 'bg-red-700 border-red-500 text-white'
                          : 'bg-[#121722] border-white/10 text-slate-300'
                      }`}
                    >
                      {side} Thumb
                    </button>
                  ))}
                </div>
              </div>

              {(
                [
                  ['mobileSensitivity', 'Touch Look Sensitivity', 0.2, 3.0, 0.05, (v: number) => `${v.toFixed(2)}×`],
                  ['hudScale', 'HUD Scale', 0.75, 1.2, 0.05, (v: number) => `${Math.round(v * 100)}%`],
                  ['hudOpacity', 'HUD Opacity', 0.45, 1.0, 0.05, (v: number) => `${Math.round(v * 100)}%`],
                  ['fireButtonScale', 'Mobile Fire Button Scale', 0.8, 1.4, 0.05, (v: number) => `${Math.round(v * 100)}%`],
                ] as const
              ).map(([key, label, min, max, step, fmt]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <label className="text-xs text-slate-300 w-44">{label}</label>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: parseFloat(e.target.value) })}
                    className="flex-1 accent-red-600"
                  />
                  <span className="w-12 text-right font-mono-tabular text-xs text-slate-300">
                    {fmt(draft[key])}
                  </span>
                </div>
              ))}

              {/* Save Reset Danger Zone */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-200">Reset Saved Progression</div>
                  <div className="text-[11px] text-slate-400">
                    Clears coins, gems, profile, weapons, upgrades, and best wave
                  </div>
                </div>
                {confirmWipe ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onResetSaveData();
                        setConfirmWipe(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      Confirm Wipe
                    </button>
                    <button
                      onClick={() => setConfirmWipe(false)}
                      className="px-3 py-1.5 rounded-lg bg-[#182030] text-slate-300 text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmWipe(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#1a1316] border border-red-900/50 text-red-400 hover:bg-red-950/50 text-xs font-semibold cursor-pointer"
                  >
                    Wipe Save
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 bg-[#090c12] flex items-center justify-between gap-3">
          <button
            onClick={handleResetSettings}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#151b26] hover:bg-[#1e2636] text-slate-300 text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>

          <button
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
