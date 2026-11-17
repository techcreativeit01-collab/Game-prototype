import React, { useEffect, useState } from 'react';

interface Props {
  onComplete: () => void;
}

const TIPS = [
  'Headshots deal 1.75x critical damage — aim high through the fog.',
  'Use Timber Barricades (B) and Robot Turrets (T) to hold off later waves.',
  'Katana slashes strike multiple close-range infected without spending ammo.',
  'Press R to reload early before entering a dense swarm.',
];

export const LoadingScreen: React.FC<Props> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [tipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));

  useEffect(() => {
    const start = performance.now();
    const duration = 1250;
    let raf = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.round(eased * 100));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        window.setTimeout(onComplete, 180);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#06080c] px-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-3 text-xs font-medium tracking-[0.28em] text-red-500 uppercase">
          Sector 09 · Moonlit Pine Perimeter
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-wider text-slate-100">
          ZOMBIE SHOOTER
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Generating nighttime forest terrain, weapons, and survival systems
        </p>

        <div className="mt-8 w-full bg-[#121620] h-2 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-red-600 transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400 font-mono-tabular">
          <span>Preparing forest environment</span>
          <span>{progress}%</span>
        </div>

        <div className="mt-10 border-t border-white/10 pt-5 text-xs text-slate-400 leading-relaxed">
          <span className="text-amber-500 font-semibold">Survival Tip: </span>
          {TIPS[tipIndex]}
        </div>
      </div>
    </div>
  );
};
