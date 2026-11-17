import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DamageNumberEvent,
  EquipmentId,
  GameOverStats,
  GameScreen,
  HUDState,
  MenuModalType,
  SaveData,
  SettingsData,
  UpgradeId,
  WeaponId,
} from './types/game';
import { ProgressionManager } from './managers/EconomyManager';
import { SettingsManager } from './managers/SettingsManager';
import { AudioManager } from './managers/AudioManager';
import { WEAPON_LIST } from './data/WeaponData';
import { GameEngine } from './engine/GameEngine';
import { LoadingScreen } from './components/LoadingScreen';
import { MainMenu } from './components/MainMenu';
import { GameHUD } from './components/GameHUD';
import { MobileControls } from './components/MobileControls';
import { WeaponShopModal } from './components/WeaponShopModal';
import { UpgradesModal } from './components/UpgradesModal';
import { InventoryModal } from './components/InventoryModal';
import { SettingsModal } from './components/SettingsModal';
import { PauseMenu } from './components/PauseMenu';
import { GameOverModal } from './components/GameOverModal';
import { HowToPlayModal } from './components/HowToPlayModal';

interface ToastMessage {
  id: number;
  text: string;
  isError: boolean;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const progression = useMemo(() => new ProgressionManager(), []);
  const settingsMgr = useMemo(
    () => new SettingsManager(progression.getData().settings),
    [progression]
  );
  const audioMgr = useMemo(() => new AudioManager(settingsMgr.get()), [settingsMgr]);

  const [saveData, setSaveData] = useState<SaveData>(() => progression.getData());
  const [settings, setSettings] = useState<SettingsData>(() => settingsMgr.get());
  const [screen, setScreen] = useState<GameScreen>('loading');
  const [activeModal, setActiveModal] = useState<MenuModalType>(null);
  const [standbyExited, setStandbyExited] = useState(false);
  const [hud, setHud] = useState<HUDState | null>(null);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumberEvent[]>([]);
  const [gameOverStats, setGameOverStats] = useState<GameOverStats | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [contextLost, setContextLost] = useState(false);
  const [isTouchEnv, setIsTouchEnv] = useState(false);

  const pushToast = useCallback((text: string, isError = false) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, text, isError }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2400);
  }, []);

  useEffect(() => {
    const detectTouch = () => {
      setIsTouchEnv(
        window.matchMedia('(pointer: coarse)').matches ||
          'ontouchstart' in window ||
          navigator.maxTouchPoints > 0
      );
    };
    detectTouch();
    window.addEventListener('resize', detectTouch);
    return () => window.removeEventListener('resize', detectTouch);
  }, []);

  useEffect(() => {
    const unsubSave = progression.subscribe((next) => setSaveData({ ...next }));
    const unsubSettings = settingsMgr.subscribe((next) => {
      setSettings(next);
      audioMgr.updateSettings(next);
      progression.updateSettings(next);
      engineRef.current?.updateSettings(next);
    });
    return () => {
      unsubSave();
      unsubSettings();
    };
  }, [progression, settingsMgr, audioMgr]);

  // Mount isolated 3D GameEngine once
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new GameEngine(
      container,
      progression,
      audioMgr,
      settingsMgr.get(),
      {
        onHUDUpdate: (nextHud) => setHud(nextHud),
        onDamageNumber: (dn) => {
          setDamageNumbers((prev) => [...prev.slice(-10), dn]);
          window.setTimeout(() => {
            setDamageNumbers((prev) => prev.filter((item) => item.id !== dn.id));
          }, 550);
        },
        onGameOver: (stats) => {
          setGameOverStats(stats);
          setActiveModal(null);
          setScreen('gameover');
        },
        onPauseRequest: () => {
          engineRef.current?.setScreenMode('paused');
          setScreen('paused');
        },
        onToast: pushToast,
        onContextLost: (lost) => setContextLost(lost),
      }
    );

    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
      audioMgr.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showMobileControls =
    settings.mobileControls === 'always' ||
    (settings.mobileControls === 'auto' && isTouchEnv);

  const handlePlay = useCallback(() => {
    audioMgr.unlock();
    audioMgr.playUIClick();
    setActiveModal(null);
    setGameOverStats(null);
    setScreen('playing');
    engineRef.current?.startNewGame();
  }, [audioMgr]);

  const handlePause = useCallback(() => {
    audioMgr.playUIClick();
    engineRef.current?.setScreenMode('paused');
    setScreen('paused');
  }, [audioMgr]);

  const handleResume = useCallback(() => {
    audioMgr.playUIClick();
    setActiveModal(null);
    setScreen('playing');
    engineRef.current?.resumeGame();
  }, [audioMgr]);

  const handleReturnToMenu = useCallback(() => {
    audioMgr.playUIClick();
    setActiveModal(null);
    setGameOverStats(null);
    setScreen('menu');
    engineRef.current?.setScreenMode('menu');
  }, [audioMgr]);

  const handleBuyWeapon = (id: WeaponId) => {
    audioMgr.unlock();
    const res = progression.buyWeapon(id);
    audioMgr.playPurchase(res.success);
    pushToast(res.message, !res.success);
    if (res.success) engineRef.current?.syncProgressionAfterShop();
  };

  const handleEquipWeapon = (id: WeaponId) => {
    audioMgr.unlock();
    const res = progression.equipWeapon(id);
    audioMgr.playUIClick();
    pushToast(res.message, !res.success);
    if (res.success) engineRef.current?.syncProgressionAfterShop();
  };

  const handleUpgradeWeapon = (id: WeaponId) => {
    audioMgr.unlock();
    const res = progression.upgradeWeapon(id);
    audioMgr.playPurchase(res.success);
    pushToast(res.message, !res.success);
    if (res.success) engineRef.current?.syncProgressionAfterShop();
  };

  const handleBuyPlayerUpgrade = (id: UpgradeId) => {
    audioMgr.unlock();
    const res = progression.buyPlayerUpgrade(id);
    audioMgr.playPurchase(res.success);
    pushToast(res.message, !res.success);
    if (res.success) engineRef.current?.syncProgressionAfterShop();
  };

  const handleBuyInventoryItem = (id: EquipmentId) => {
    audioMgr.unlock();
    const res = progression.buyInventoryItem(id);
    audioMgr.playPurchase(res.success);
    pushToast(res.message, !res.success);
  };

  const handleUseInventoryItem = (id: EquipmentId) => {
    if (screen === 'paused') {
      setActiveModal(null);
      setScreen('playing');
      engineRef.current?.resumeGame();
    }
    engineRef.current?.useEquipment(id);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#07090d]">
      {/* Isolated WebGL Viewport Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full game-touch-surface"
      />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06080c]/95 text-center p-6">
          <div className="max-w-sm bg-[#0e131c] border border-red-900/50 rounded-xl p-6">
            <h2 className="font-display text-xl font-bold text-red-400">
              Graphics Context Suspended
            </h2>
            <p className="mt-2 text-xs text-slate-300">
              WebGL context was interrupted. Waiting for GPU restoration or reload the page.
            </p>
          </div>
        </div>
      )}

      {screen === 'loading' && (
        <LoadingScreen
          onComplete={() => {
            setScreen('menu');
            engineRef.current?.setScreenMode('menu');
          }}
        />
      )}

      {screen === 'menu' && (
        <MainMenu
          saveData={saveData}
          isMuted={settings.muted}
          standbyExited={standbyExited}
          onPlay={handlePlay}
          onOpenModal={(m) => {
            audioMgr.unlock();
            audioMgr.playUIClick();
            setActiveModal(m);
          }}
          onExitToggle={() => {
            audioMgr.playUIClick();
            setStandbyExited((s) => !s);
          }}
          onToggleMute={() => {
            audioMgr.unlock();
            settingsMgr.toggleMute();
          }}
        />
      )}

      {screen === 'playing' && hud && (
        <>
          <GameHUD
            hud={hud}
            damageNumbers={damageNumbers}
            isMuted={settings.muted}
            showMobileControls={showMobileControls}
            onPause={handlePause}
            onToggleMute={() => settingsMgr.toggleMute()}
            onUseEquipment={(id) => engineRef.current?.useEquipment(id)}
            onSelectWeapon={(slot) => {
              const found = WEAPON_LIST.find((w) => w.slot === slot);
              if (found) engineRef.current?.equipWeapon(found.id);
            }}
          />
          {showMobileControls && (
            <MobileControls
              hud={hud}
              onMobileInput={(p) => engineRef.current?.setMobileInput(p)}
              onLookDelta={(dx, dy) => engineRef.current?.triggerMobileLook(dx, dy)}
              onFireStart={() => engineRef.current?.triggerMobileFire()}
              onFireEnd={() => engineRef.current?.setMobileInput({ fireHeld: false })}
              onJump={() => engineRef.current?.triggerMobileJump()}
              onReload={() => engineRef.current?.triggerReload()}
              onCycleWeapon={(d) => engineRef.current?.cycleWeapon(d)}
              onUseEquipment={(id) => engineRef.current?.useEquipment(id)}
              onInteract={() => engineRef.current?.triggerInteract()}
            />
          )}
        </>
      )}

      {screen === 'paused' && !activeModal && (
        <PauseMenu
          wave={hud?.wave ?? 1}
          kills={hud?.kills ?? 0}
          coins={saveData.coins}
          onResume={handleResume}
          onRestart={handlePlay}
          onOpenModal={(m) => {
            audioMgr.playUIClick();
            setActiveModal(m);
          }}
          onReturnToMenu={handleReturnToMenu}
        />
      )}

      {screen === 'gameover' && gameOverStats && (
        <GameOverModal
          stats={gameOverStats}
          onRetry={handlePlay}
          onMainMenu={handleReturnToMenu}
        />
      )}

      {/* Sub-Modals (Accessible from Main Menu & Pause Menu) */}
      {activeModal === 'weapons' && (
        <WeaponShopModal
          saveData={saveData}
          onBuy={handleBuyWeapon}
          onEquip={handleEquipWeapon}
          onUpgrade={handleUpgradeWeapon}
          onClose={() => {
            audioMgr.playUIClick();
            setActiveModal(null);
          }}
        />
      )}

      {activeModal === 'upgrades' && (
        <UpgradesModal
          saveData={saveData}
          onUpgrade={handleBuyPlayerUpgrade}
          onClose={() => {
            audioMgr.playUIClick();
            setActiveModal(null);
          }}
        />
      )}

      {activeModal === 'inventory' && (
        <InventoryModal
          saveData={saveData}
          isPlaying={screen === 'paused'}
          onBuyItem={handleBuyInventoryItem}
          onUseItem={handleUseInventoryItem}
          onEquipWeapon={handleEquipWeapon}
          onClose={() => {
            audioMgr.playUIClick();
            setActiveModal(null);
          }}
        />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          settings={settings}
          onApply={(next) => {
            settingsMgr.update(next);
            audioMgr.playPurchase(true);
            pushToast('Settings applied');
          }}
          onResetSaveData={() => {
            progression.resetSaveData();
            audioMgr.playPurchase(true);
            pushToast('Saved data wiped');
          }}
          onClose={() => {
            audioMgr.playUIClick();
            setActiveModal(null);
          }}
        />
      )}

      {activeModal === 'howtoplay' && (
        <HowToPlayModal
          onClose={() => {
            audioMgr.playUIClick();
            setActiveModal(null);
          }}
        />
      )}

      {/* Toast Feedback Strip */}
      {toasts.length > 0 && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold border shadow-lg ${
                t.isError
                  ? 'bg-[#1f0c0e] border-red-600/60 text-red-200'
                  : 'bg-[#0c131d] border-amber-500/50 text-amber-200'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
