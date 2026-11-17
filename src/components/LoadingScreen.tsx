import React, { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

const TIPS = [
  'Headshots deal 1.75x ballistic damage — compensate for drop at long sniper ranges.',
  'Press Crouch [C] while sprinting to execute a tactical combat slide.',
  'Use Timber Barricades [B] and Auto Robot Turrets [T] to control chokepoints.',
  'Toggle your weapon flashlight [L] to spot Sprinters stalking through the mist.',
];

const STAGES = [
  'Generating moonlit pine terrain',
  'Building PBR bark, timber & fog shaders',
  'Calibrating ballistic & character physics',
  'Arming survival arsenal',
];

export const LoadingScreen: React.FC<Props> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);
  const [tipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));

  useEffect(() => {
    const start = performance.now();
    const duration = 1500;
    let raf = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.round(eased * 100));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        window.setTimeout(onComplete, 200);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [onComplete]);

  const stageIdx = Math.min(STAGES.length - 1, Math.floor((progress / 100) * STAGES.length));

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#05070b] overflow-hidden">
      {/* Cinematic Key-Art Backdrop */}
      {!imgFailed && (
        <img
          src="/src/assets/images/loading_forest_keyart_1794899427365.jpg"
          alt="Moonlit survival forest"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 w-full h-full object-cover opacity-55 scale-[1.03]"
        />
      )}

      {/* Measured Contrast Scrim */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(5,7,11,0.78) 0%, rgba(5,7,11,0.35) 45%, rgba(5,7,11,0.95) 100%)',
        }}
      />

      {/* Top Briefing Strip */}
      <div className="relative z-10 flex items-center justify-between px-6 sm:px-10 pt-6 text-xs text-slate-300">
        <span className="tracking-[0.26em] uppercase text-red-400 font-semibold">
          Sector 09 · Pine Ridge Perimeter
        </span>
        <span className="font-mono-tabular text-slate-400">Moonlit Night Operations</span>
      </div>

      {/* Center Title Lockup */}
      <div className="relative z-10 my-auto px-6 sm:px-10 max-w-2xl mx-auto text-center">
        <svg
          viewBox="0 0 460 88"
          className="w-full max-w-[440px] h-auto mx-auto drop-shadow-[0_6px_24px_rgba(0,0,0,0.85)]"
          role="img"
          aria-label="ZOMBIE SHOOTER"
        >
          <text
            x="230"
            y="46"
            textAnchor="middle"
            fill="#f8fafc"
            fontFamily="Chakra Petch, sans-serif"
            fontWeight="700"
            fontSize="48"
            letterSpacing="4"
          >
            ZOMBIE
          </text>
          <text
            x="230"
            y="78"
            textAnchor="middle"
            fill="#dc2626"
            fontFamily="Chakra Petch, sans-serif"
            fontWeight="700"
            fontSize="26"
            letterSpacing="10"
          >
            SHOOTER
          </text>
          <line x1="95" y1="54" x2="365" y2="54" stroke="#991b1b" strokeWidth="2" />
        </svg>
        <p className="mt-3 text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
          3D First-Person Survival Shooter
        </p>
      </div>

      {/* Bottom Deployment Progress */}
      <div className="relative z-10 px-6 sm:px-12 pb-8 max-w-3xl w-full mx-auto">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-200 font-medium">{STAGES[stageIdx]}</span>
          <span className="font-mono-tabular text-red-400 font-bold">{progress}%</span>
        </div>

        <div className="w-full h-2 bg-[#0e131c] rounded-full overflow-hidden border border-white/15">
          <div
            className="h-full bg-gradient-to-r from-red-800 via-red-600 to-amber-500 transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 flex items-start gap-2 text-xs text-slate-300 bg-[#090c12]/80 border border-white/10 rounded-lg px-4 py-2.5">
          <span className="text-amber-400 font-semibold shrink-0">Tactical Brief:</span>
          <span className="text-slate-300">{TIPS[tipIndex]}</span>
        </div>
      </div>
    </div>
  );
};
