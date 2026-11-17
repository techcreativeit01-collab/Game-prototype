import React from 'react';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<Props> = ({ onClose }) => {
  const desktopControls: Array<[string, string]> = [
    ['W A S D', 'Move across forest terrain'],
    ['Mouse', 'Look around (click viewport to lock cursor)'],
    ['Left Click', 'Swing Katana / Fire firearm'],
    ['Right Click', 'Aim down sights / Sniper Scope (M107)'],
    ['Space', 'Jump (with coyote time & buffering)'],
    ['Shift', 'Sprint (uses stamina)'],
    ['C / Shift + C', 'Crouch / Tactical Sprint Slide'],
    ['L', 'Toggle tactical weapon flashlight'],
    ['R', 'Reload firearm'],
    ['1 – 9 / Wheel', 'Switch unlocked weapons'],
    ['E', 'Pick up nearby loot drops'],
    ['G / B / T', 'Throw Grenade / Place Barricade / Deploy Turret'],
    ['H / V / F / X', 'Use Medkit / Armor / Ammo Pack / Adrenaline'],
    ['ESC', 'Pause & open Armory / Upgrades'],
  ];

  const mobileControls: Array<[string, string]> = [
    ['Left Joystick', 'Move, strafe, and push up to Auto-Sprint'],
    ['Right Touch Area', 'Drag anywhere to aim and look around'],
    ['FIRE (Drag-Aim)', 'Hold & drag thumb to track infected while firing'],
    ['L-FIRE / AIM', 'Left-thumb claw fire / Precision ADS toggle'],
    ['JUMP / SPRINT / SLIDE', 'Traversal, crouch & tactical sprint-slide'],
    ['Flashlight / < Weapon >', 'Toggle beam & cycle/select unlocked weapons'],
    ['Tactical Tray', 'Reload, Frag, Medkit, Ammo, Barricade & Turret'],
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#0c1018] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c12]">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-100 tracking-wide">
              HOW TO PLAY
            </h2>
            <p className="text-xs text-slate-400">
              Controls, zombie classes, and tactical survival tips
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Guide"
            className="p-2 rounded-lg bg-[#151b26] hover:bg-[#1e2636] text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto survival-scroll space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-4 rounded-xl bg-[#10141d] border border-white/10">
              <h3 className="font-display text-sm font-bold text-red-400 uppercase tracking-wider mb-3">
                Desktop Controls
              </h3>
              <div className="space-y-2 text-xs">
                {desktopControls.map(([k, desc]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <span className="font-mono-tabular font-semibold text-amber-400 shrink-0">
                      {k}
                    </span>
                    <span className="text-slate-300 text-right">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#10141d] border border-white/10">
              <h3 className="font-display text-sm font-bold text-red-400 uppercase tracking-wider mb-3">
                Mobile Touch Controls
              </h3>
              <div className="space-y-2 text-xs">
                {mobileControls.map(([k, desc]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-amber-400 shrink-0">{k}</span>
                    <span className="text-slate-300 text-right">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#10141d] border border-white/10">
            <h3 className="font-display text-sm font-bold text-slate-200 uppercase tracking-wider mb-2">
              Infected Classes & Wave Survival
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              You enter the forest armed with a Katana. Eliminate Walkers, Sprinters, Banshees,
              armored Brute Tanks, and every-5th-wave Abominations to earn coins. Press ESC
              between waves to purchase firearms, upgrade survivor traits, and stock up on
              Grenades, Timber Barricades, and Automated Robot Turrets. All coins, weapons,
              upgrades, and highest wave records save automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
