import React, { useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Flame,
  Heart,
  RotateCw,
  Shield,
} from 'lucide-react';
import { EquipmentId, HUDState } from '../types/game';
import { MobileInputState } from '../engine/GameEngine';

interface Props {
  hud: HUDState;
  onMobileInput: (partial: Partial<MobileInputState>) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onFireStart: () => void;
  onFireEnd: () => void;
  onJump: () => void;
  onReload: () => void;
  onCycleWeapon: (dir: 1 | -1) => void;
  onUseEquipment: (id: EquipmentId) => void;
  onInteract: () => void;
}

export const MobileControls: React.FC<Props> = ({
  hud,
  onMobileInput,
  onLookDelta,
  onFireStart,
  onFireEnd,
  onJump,
  onReload,
  onCycleWeapon,
  onUseEquipment,
  onInteract,
}) => {
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const joyTouchId = useRef<number | null>(null);
  const joyCenter = useRef({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });
  const [sprintOn, setSprintOn] = useState(false);
  const [crouchOn, setCrouchOn] = useState(false);
  const [aimOn, setAimOn] = useState(false);

  const maxRadius = 42;

  const handleJoyStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (joyTouchId.current !== null) return;
    const t = e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    joyTouchId.current = t.identifier;
    joyCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateJoystick(t.clientX, t.clientY);
  };

  const handleJoyMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchId.current) {
        updateJoystick(t.clientX, t.clientY);
      }
    }
  };

  const handleJoyEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchId.current) {
        joyTouchId.current = null;
        setKnobOffset({ x: 0, y: 0 });
        onMobileInput({ moveX: 0, moveZ: 0 });
      }
    }
  };

  const updateJoystick = (cx: number, cy: number) => {
    let dx = cx - joyCenter.current.x;
    let dy = cy - joyCenter.current.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnobOffset({ x: dx, y: dy });
    onMobileInput({
      moveX: dx / maxRadius,
      moveZ: -dy / maxRadius,
    });
  };

  // Right-side touch camera look surface
  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current !== null) return;
    const t = e.changedTouches[0];
    lookTouchId.current = t.identifier;
    lastLookPos.current = { x: t.clientX, y: t.clientY };
  };

  const handleLookMove = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId.current) {
        const dx = t.clientX - lastLookPos.current.x;
        const dy = t.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: t.clientX, y: t.clientY };
        onLookDelta(dx, dy);
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-15 pointer-events-none game-touch-surface">
      {/* Right-half touch camera look zone */}
      <div
        className="absolute top-14 right-0 bottom-0 left-[38%] pointer-events-auto game-touch-surface"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      />

      {/* Compact Mobile Health + Ammo Header Bar */}
      <div className="absolute top-16 left-3 right-3 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-[#090c12]/85 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono-tabular">
          <Heart className="w-3.5 h-3.5 text-red-500 fill-current" />
          <span className="text-white font-bold">{hud.health}</span>
          <Shield className="w-3.5 h-3.5 text-sky-400 ml-1" />
          <span className="text-slate-300">{hud.armor}</span>
        </div>

        <div className="flex items-center gap-1.5 bg-[#090c12]/85 border border-white/10 rounded-lg px-2 py-1 pointer-events-auto">
          <button
            onClick={() => onCycleWeapon(-1)}
            className="p-1 text-slate-300 active:text-white"
            aria-label="Previous Weapon"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono-tabular text-xs font-bold text-slate-100">
            {hud.weaponName.split(' ')[0]} ·{' '}
            {hud.isMelee ? 'MELEE' : `${hud.ammoInMag}/${hud.ammoReserve}`}
          </span>
          <button
            onClick={() => onCycleWeapon(1)}
            className="p-1 text-slate-300 active:text-white"
            aria-label="Next Weapon"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Left Virtual Movement Joystick */}
      <div
        onTouchStart={handleJoyStart}
        onTouchMove={handleJoyMove}
        onTouchEnd={handleJoyEnd}
        onTouchCancel={handleJoyEnd}
        className="absolute bottom-6 left-5 w-28 h-28 rounded-full bg-white/5 border-2 border-white/20 flex items-center justify-center pointer-events-auto game-touch-surface"
      >
        <div
          className="w-12 h-12 rounded-full bg-red-600/80 border border-white/40"
          style={{ transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)` }}
        />
      </div>

      {/* Left Posture & Equipment Buttons */}
      <div className="absolute bottom-36 left-5 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => {
            const next = !sprintOn;
            setSprintOn(next);
            onMobileInput({ sprint: next });
          }}
          className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
            sprintOn
              ? 'bg-amber-600 text-white border-amber-400'
              : 'bg-[#090c12]/85 text-slate-300 border-white/15'
          }`}
        >
          Sprint
        </button>
        <button
          onClick={() => {
            const next = !crouchOn;
            setCrouchOn(next);
            onMobileInput({ crouch: next });
          }}
          className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
            crouchOn
              ? 'bg-sky-600 text-white border-sky-400'
              : 'bg-[#090c12]/85 text-slate-300 border-white/15'
          }`}
        >
          Crouch
        </button>
        {hud.interactPrompt && (
          <button
            onClick={onInteract}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-600 text-white border border-amber-400"
          >
            Pick Up
          </button>
        )}
      </div>

      {/* Right Action Cluster */}
      <div className="absolute bottom-5 right-5 flex flex-col items-end gap-2.5 pointer-events-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUseEquipment(EquipmentId.GRENADE)}
            className="px-2.5 py-2 rounded-lg bg-[#090c12]/85 border border-white/15 text-xs text-slate-200 flex items-center gap-1"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>{hud.inventory[EquipmentId.GRENADE] ?? 0}</span>
          </button>
          <button
            onClick={() => onUseEquipment(EquipmentId.MEDKIT)}
            className="px-2.5 py-2 rounded-lg bg-[#090c12]/85 border border-white/15 text-xs text-slate-200 flex items-center gap-1"
          >
            <Heart className="w-3.5 h-3.5 text-red-400" />
            <span>{hud.inventory[EquipmentId.MEDKIT] ?? 0}</span>
          </button>
          <button
            onClick={onReload}
            className="p-3 rounded-full bg-[#090c12]/85 border border-white/20 text-slate-200 active:bg-white/15"
            aria-label="Reload"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onJump}
            className="w-12 h-12 rounded-full bg-[#090c12]/85 border border-white/20 text-xs font-bold text-slate-200 active:bg-white/20"
          >
            JUMP
          </button>
          <button
            onClick={() => {
              const next = !aimOn;
              setAimOn(next);
              onMobileInput({ aim: next });
            }}
            className={`w-12 h-12 rounded-full border flex items-center justify-center ${
              aimOn
                ? 'bg-amber-600 border-amber-400 text-white'
                : 'bg-[#090c12]/85 border-white/20 text-slate-200'
            }`}
            aria-label="Aim"
          >
            <Crosshair className="w-5 h-5" />
          </button>
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              onFireStart();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              onFireEnd();
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              onFireEnd();
            }}
            onClick={onFireStart}
            className="w-16 h-16 rounded-full bg-red-700/90 active:bg-red-500 border-2 border-red-300/60 text-xs font-display font-bold text-white tracking-wider"
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  );
};
