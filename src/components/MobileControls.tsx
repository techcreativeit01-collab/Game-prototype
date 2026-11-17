import React, { useRef, useState } from 'react';
import {
  Backpack,
  Box,
  Crosshair,
  Flame,
  Flashlight,
  Heart,
  Package,
  RotateCw,
  Zap,
} from 'lucide-react';
import { EquipmentId, HUDState, SettingsData } from '../types/game';
import { MobileInputState } from '../engine/GameEngine';

interface Props {
  hud: HUDState;
  settings: SettingsData;
  onMobileInput: (partial: Partial<MobileInputState>) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onFireStart: () => void;
  onFireEnd: () => void;
  onJump: () => void;
  onReload: () => void;
  onToggleFlashlight: () => void;
  onUseEquipment: (id: EquipmentId) => void;
  onInteract: () => void;
}

export const MobileControls: React.FC<Props> = ({
  hud,
  settings,
  onMobileInput,
  onLookDelta,
  onFireStart,
  onFireEnd,
  onJump,
  onReload,
  onToggleFlashlight,
  onUseEquipment,
  onInteract,
}) => {
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [autoSprintActive, setAutoSprintActive] = useState(false);
  const [backpackOpen, setBackpackOpen] = useState(false);
  const joyTouchId = useRef<number | null>(null);
  const joyCenter = useRef({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });
  const fireDragTouchId = useRef<number | null>(null);
  const lastFireDragPos = useRef({ x: 0, y: 0 });

  const [sprintOn, setSprintOn] = useState(false);
  const [crouchOn, setCrouchOn] = useState(false);
  const [aimOn, setAimOn] = useState(false);

  const maxRadius = 42;
  const swapSides = settings.joystickSide === 'right';
  const fireSizePx = Math.round(70 * settings.fireButtonScale);

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
        setAutoSprintActive(false);
        onMobileInput({ moveX: 0, moveZ: 0, sprint: sprintOn });
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
    const moveZ = -dy / maxRadius;
    const autoSprint = moveZ > 0.85;
    setAutoSprintActive(autoSprint);
    onMobileInput({
      moveX: dx / maxRadius,
      moveZ,
      sprint: sprintOn || autoSprint,
    });
  };

  // Camera look touch surface
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

  const handleFireTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const t = e.changedTouches[0];
    fireDragTouchId.current = t.identifier;
    lastFireDragPos.current = { x: t.clientX, y: t.clientY };
    onFireStart();
  };

  const handleFireTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === fireDragTouchId.current) {
        const dx = t.clientX - lastFireDragPos.current.x;
        const dy = t.clientY - lastFireDragPos.current.y;
        lastFireDragPos.current = { x: t.clientX, y: t.clientY };
        onLookDelta(dx, dy);
      }
    }
  };

  const handleFireTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === fireDragTouchId.current) {
        fireDragTouchId.current = null;
        onFireEnd();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-15 pointer-events-none game-touch-surface"
      style={{ opacity: settings.hudOpacity }}
    >
      {/* Full-half Camera Look Drag Area */}
      <div
        className={`absolute top-14 bottom-0 pointer-events-auto game-touch-surface ${
          swapSides ? 'left-0 right-[38%]' : 'left-[38%] right-0'
        }`}
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
        onTouchCancel={handleLookEnd}
      />

      {/* Movement Cluster (Joystick + Sprint + Backpack) */}
      <div
        className={`absolute bottom-3 flex items-end gap-2.5 pointer-events-auto ${
          swapSides ? 'right-3 flex-row-reverse' : 'left-3'
        }`}
      >
        <div className="flex flex-col items-start gap-2">
          {backpackOpen && (
            <div className="flex flex-wrap gap-1.5 max-w-[180px] bg-[#090c12]/92 border border-white/20 rounded-lg p-1.5 shadow-xl">
              <button
                onClick={() => {
                  onUseEquipment(EquipmentId.TURRET);
                  setBackpackOpen(false);
                }}
                className="px-2 py-1 rounded bg-[#141a26] border border-white/10 text-[11px] text-slate-200 flex items-center gap-1"
              >
                <Crosshair className="w-3 h-3 text-red-400" />
                {hud.inventory[EquipmentId.TURRET] ?? 0}
              </button>
              <button
                onClick={() => {
                  onUseEquipment(EquipmentId.BARRICADE);
                  setBackpackOpen(false);
                }}
                className="px-2 py-1 rounded bg-[#141a26] border border-white/10 text-[11px] text-slate-200 flex items-center gap-1"
              >
                <Box className="w-3 h-3 text-orange-400" />
                {hud.inventory[EquipmentId.BARRICADE] ?? 0}
              </button>
              <button
                onClick={() => {
                  onUseEquipment(EquipmentId.AMMO_CRATE);
                  setBackpackOpen(false);
                }}
                className="px-2 py-1 rounded bg-[#141a26] border border-white/10 text-[11px] text-slate-200 flex items-center gap-1"
              >
                <Package className="w-3 h-3 text-emerald-400" />
                {hud.inventory[EquipmentId.AMMO_CRATE] ?? 0}
              </button>
              <button
                onClick={() => {
                  onUseEquipment(EquipmentId.ADRENALINE);
                  setBackpackOpen(false);
                }}
                className="px-2 py-1 rounded bg-[#141a26] border border-white/10 text-[11px] text-slate-200 flex items-center gap-1"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                {hud.inventory[EquipmentId.ADRENALINE] ?? 0}
              </button>
              <button
                onClick={onToggleFlashlight}
                className="px-2 py-1 rounded bg-[#141a26] border border-white/10 text-[11px] text-amber-300 flex items-center gap-1"
              >
                <Flashlight className="w-3 h-3" />
              </button>
            </div>
          )}
          <button
            onClick={() => setBackpackOpen((b) => !b)}
            aria-label="Open Tactical Backpack"
            className={`w-11 h-11 rounded-full border flex items-center justify-center ${
              backpackOpen
                ? 'bg-amber-600 border-amber-400 text-white'
                : 'bg-[#090c12]/88 border-white/25 text-slate-100'
            }`}
          >
            <Backpack className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const next = !sprintOn;
                setSprintOn(next);
                onMobileInput({ sprint: next });
              }}
              className={`w-10 h-10 rounded-full text-[10px] font-bold border flex items-center justify-center ${
                sprintOn || autoSprintActive
                  ? 'bg-amber-600 text-white border-amber-400'
                  : 'bg-[#090c12]/88 text-slate-200 border-white/25'
              }`}
              title="Sprint"
            >
              RUN
            </button>
            {hud.interactPrompt && (
              <button
                onClick={onInteract}
                className="px-2.5 h-10 rounded-full text-[11px] font-bold bg-amber-600 text-white border border-amber-300"
              >
                Pick Up
              </button>
            )}
          </div>

          <div
            onTouchStart={handleJoyStart}
            onTouchMove={handleJoyMove}
            onTouchEnd={handleJoyEnd}
            onTouchCancel={handleJoyEnd}
            className={`w-28 h-28 rounded-full border-2 flex items-center justify-center game-touch-surface ${
              autoSprintActive
                ? 'bg-amber-500/12 border-amber-400/70'
                : 'bg-white/5 border-white/25'
            }`}
          >
            <div
              className="w-12 h-12 rounded-full bg-slate-200/75 border-2 border-white/60 shadow-lg"
              style={{ transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)` }}
            />
          </div>
        </div>
      </div>

      {/* Combat Action Cluster (Grenade, Medkit, Aim, Jump, Fire, Reload, Crouch) */}
      <div
        className={`absolute bottom-3 flex flex-col items-end gap-2 pointer-events-auto ${
          swapSides ? 'left-3 items-start' : 'right-3 items-end'
        }`}
      >
        {/* Top Row: Grenade + Medkit */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUseEquipment(EquipmentId.GRENADE)}
            className="relative w-11 h-11 rounded-full bg-[#090c12]/88 border border-white/25 text-amber-400 flex items-center justify-center"
            aria-label="Throw Grenade"
          >
            <Flame className="w-5 h-5" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#111622] border border-white/25 text-[9px] font-mono-tabular text-white flex items-center justify-center">
              {hud.inventory[EquipmentId.GRENADE] ?? 0}
            </span>
          </button>
          <button
            onClick={() => onUseEquipment(EquipmentId.MEDKIT)}
            className="relative w-11 h-11 rounded-full bg-[#090c12]/88 border border-white/25 text-red-400 flex items-center justify-center"
            aria-label="Use Medkit"
          >
            <Heart className="w-5 h-5" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#111622] border border-white/25 text-[9px] font-mono-tabular text-white flex items-center justify-center">
              {hud.inventory[EquipmentId.MEDKIT] ?? 0}
            </span>
          </button>
        </div>

        {/* Middle Row: Reload + Jump + Aim + Large Fire */}
        <div className="flex items-end gap-2">
          <button
            onClick={() => {
              const next = !crouchOn;
              setCrouchOn(next);
              onMobileInput({ crouch: next });
            }}
            className={`w-11 h-11 rounded-full border text-[10px] font-bold flex items-center justify-center ${
              crouchOn
                ? 'bg-sky-600 border-sky-400 text-white'
                : 'bg-[#090c12]/88 border-white/25 text-slate-200'
            }`}
          >
            {hud.isSprinting ? 'SLIDE' : 'DUCK'}
          </button>
          <button
            onClick={onReload}
            className="w-11 h-11 rounded-full bg-[#090c12]/88 border border-white/25 text-slate-100 active:bg-white/20 flex items-center justify-center"
            aria-label="Reload"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          <button
            onClick={onJump}
            className="w-11 h-11 rounded-full bg-[#090c12]/88 border border-white/25 text-[10px] font-bold text-slate-100 active:bg-white/20"
          >
            JUMP
          </button>
          <button
            onTouchStart={() => {
              if (settings.aimMode === 'hold') {
                setAimOn(true);
                onMobileInput({ aim: true });
              }
            }}
            onTouchEnd={() => {
              if (settings.aimMode === 'hold') {
                setAimOn(false);
                onMobileInput({ aim: false });
              }
            }}
            onClick={() => {
              if (settings.aimMode === 'toggle') {
                const next = !aimOn;
                setAimOn(next);
                onMobileInput({ aim: next });
              }
            }}
            className={`w-12 h-12 rounded-full border flex items-center justify-center ${
              aimOn
                ? 'bg-amber-600 border-amber-400 text-white'
                : 'bg-[#090c12]/88 border-white/25 text-slate-100'
            }`}
            aria-label="Aim"
          >
            <Crosshair className="w-5 h-5" />
          </button>

          <button
            onTouchStart={handleFireTouchStart}
            onTouchMove={handleFireTouchMove}
            onTouchEnd={handleFireTouchEnd}
            onTouchCancel={handleFireTouchEnd}
            onMouseDown={onFireStart}
            onMouseUp={onFireEnd}
            onMouseLeave={onFireEnd}
            style={{ width: fireSizePx, height: fireSizePx }}
            className="rounded-full bg-red-700/95 active:bg-red-500 border-2 border-white/65 text-xs font-display font-bold text-white tracking-wider shadow-xl select-none"
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  );
};
