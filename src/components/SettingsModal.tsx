import React, { useState } from 'react';
import { RotateCcw, Save, X } from 'lucide-react';
import {
  GraphicsQuality,
  MobileControlsMode,
  SettingsData,
} from '../types/game';
import { getDefaultSettings } from '../managers/SaveManager';

interface Props {
  settings: SettingsData;
  onApply: (next: SettingsData) => void;
  onResetSaveData: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  settings,
  onApply,
  onResetSaveData,
  onClose,
}) => {
  const [draft, setDraft] = useState<SettingsData>({ ...settings });
  const [confirmWipe, setConfirmWipe] = useState(false);

  const handleResetSettings = () => {
    const def = getDefaultSettings();
    setDraft(def);
    onApply(def);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#0c1018] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c12]">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-100 tracking-wide">
              SETTINGS
            </h2>
            <p className="text-xs text-slate-400">
              Graphics, audio levels, aiming sensitivity, and touch controls
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

        <div className="p-6 overflow-y-auto survival-scroll space-y-6">
          {/* Graphics */}
          <section>
            <h3 className="font-display text-sm font-bold text-slate-200 uppercase tracking-wider mb-3">
              Graphics Quality
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => setDraft({ ...draft, graphicsQuality: q })}
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
          </section>

          {/* Audio */}
          <section className="space-y-3">
            <h3 className="font-display text-sm font-bold text-slate-200 uppercase tracking-wider">
              Audio
            </h3>
            {(
              [
                ['masterVolume', 'Master Volume'],
                ['musicVolume', 'Ambience & Music'],
                ['sfxVolume', 'Combat SFX'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <label className="text-xs text-slate-300 w-36">{label}</label>
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
          </section>

          {/* Sensitivity & Gameplay */}
          <section className="space-y-3">
            <h3 className="font-display text-sm font-bold text-slate-200 uppercase tracking-wider">
              Gameplay & Sensitivity
            </h3>
            {(
              [
                ['mouseSensitivity', 'Mouse Sensitivity'],
                ['cameraSensitivity', 'Camera Multiplier'],
                ['aimSensitivity', 'ADS Aim Multiplier'],
                ['mobileSensitivity', 'Touch Look Sensitivity'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <label className="text-xs text-slate-300 w-40">{label}</label>
                <input
                  type="range"
                  min={0.2}
                  max={3.0}
                  step={0.05}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: parseFloat(e.target.value) })}
                  className="flex-1 accent-red-600"
                />
                <span className="w-12 text-right font-mono-tabular text-xs text-slate-300">
                  {draft[key].toFixed(2)}×
                </span>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-300">Invert Y Axis</span>
              <button
                onClick={() => setDraft({ ...draft, invertY: !draft.invertY })}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  draft.invertY
                    ? 'bg-red-700 border-red-500 text-white'
                    : 'bg-[#121722] border-white/10 text-slate-300'
                }`}
              >
                {draft.invertY ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </section>

          {/* Mobile Controls */}
          <section>
            <h3 className="font-display text-sm font-bold text-slate-200 uppercase tracking-wider mb-3">
              Mobile Touch Controls
            </h3>
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
          </section>

          {/* Save Reset Danger Zone */}
          <section className="pt-3 border-t border-white/10 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-200">Reset Saved Progression</div>
              <div className="text-[11px] text-slate-400">
                Clears coins, unlocked weapons, upgrades, and best wave
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
          </section>
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
