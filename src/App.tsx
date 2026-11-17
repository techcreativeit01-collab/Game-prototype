import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AttachmentId,
  CharacterSkinId,
  ChatMessage,
  DamageNumberEvent,
  EquipmentId,
  GameOverStats,
  GameScreen,
  HUDState,
  LobbyPlayer,
  MenuModalType,
  MultiplayerRoomState,
  SaveData,
  SettingsData,
  UpgradeId,
  WeaponId,
  WeaponSkinId,
} from './types/game';
import { CloudSyncStatus, ProgressionManager } from './managers/EconomyManager';
import { SettingsManager } from './managers/SettingsManager';
import { AudioManager } from './managers/AudioManager';
import {
  InviteNotice,
  MpConnectionStatus,
  MultiplayerClient,
} from './managers/MultiplayerClient';
import {
  getCurrentSupabaseSession,
  isSupabaseConfigured,
  signInWithEmail,
  signOutSupabase,
  signUpWithEmail,
  subscribeSupabaseAuth,
} from './lib/supabase';
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
import { MultiplayerModal } from './components/MultiplayerModal';
import { ShopModal } from './components/ShopModal';
import { ProfileModal } from './components/ProfileModal';

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
  const mpClient = useMemo(() => {
    const data = progression.getData();
    const maxHp = 100 + (data.upgrades[UpgradeId.MAX_HEALTH] ?? 0) * 20;
    return new MultiplayerClient(data.profile, maxHp);
  }, [progression]);

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
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  // Multiplayer & Supabase Cloud UI state
  const [mpStatus, setMpStatus] = useState<MpConnectionStatus>('disconnected');
  const [mpAuthMode, setMpAuthMode] = useState<'supabase' | 'guest'>('guest');
  const [mpError, setMpError] = useState<string | null>(null);
  const [cloudEmail, setCloudEmail] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>(() =>
    progression.getCloudSyncStatus()
  );
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [rooms, setRooms] = useState<MultiplayerRoomState[]>([]);
  const [currentRoom, setCurrentRoom] = useState<MultiplayerRoomState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pendingInvite, setPendingInvite] = useState<InviteNotice | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [voiceDeafened, setVoiceDeafened] = useState(false);
  const lastMpProfileKeyRef = useRef('');

  const pushToast = useCallback((text: string, isError = false) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-2), { id, text, isError }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2600);
  }, []);

  const attemptLandscapeLock = useCallback(async () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const touchLike =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;
    if (!touchLike) return;

    try {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen().catch(() => {});
        }
      }
      const orient = window.screen.orientation as ScreenOrientation & {
        lock?: (mode: 'landscape' | 'landscape-primary') => Promise<void>;
      };
      if (orient && typeof orient.lock === 'function') {
        await orient.lock('landscape').catch(() => {});
      }
    } catch {
      // Orientation lock blocked on unsupported browsers; CSS landscape fallback handles it automatically
    }
  }, []);

  useEffect(() => {
    const updateViewportAndTouch = () => {
      const vv = window.visualViewport;
      const w = Math.round(vv ? vv.width : window.innerWidth);
      const h = Math.round(vv ? vv.height : window.innerHeight);
      setViewport({ width: w, height: h });
      setIsTouchEnv(
        window.matchMedia('(pointer: coarse)').matches ||
          'ontouchstart' in window ||
          navigator.maxTouchPoints > 0
      );
    };
    updateViewportAndTouch();
    window.addEventListener('resize', updateViewportAndTouch);
    window.addEventListener('orientationchange', updateViewportAndTouch);
    window.visualViewport?.addEventListener('resize', updateViewportAndTouch);
    return () => {
      window.removeEventListener('resize', updateViewportAndTouch);
      window.removeEventListener('orientationchange', updateViewportAndTouch);
      window.visualViewport?.removeEventListener('resize', updateViewportAndTouch);
    };
  }, []);

  useEffect(() => {
    const unsubSave = progression.subscribe((next) => {
      setSaveData({ ...next });
      const maxHp = 100 + (next.upgrades[UpgradeId.MAX_HEALTH] ?? 0) * 20;
      const key = `${next.profile.username}|${next.profile.avatarId}|${next.profile.level}|${next.profile.selectedCharacterSkin}|${maxHp}`;
      if (key !== lastMpProfileKeyRef.current) {
        lastMpProfileKeyRef.current = key;
        mpClient.updateProfile(next.profile, maxHp);
      }
    });
    const unsubCloud = progression.subscribeCloudSync((nextStatus) => {
      setCloudSyncStatus(nextStatus);
    });
    const unsubSettings = settingsMgr.subscribe((next) => {
      setSettings(next);
      audioMgr.updateSettings(next);
      progression.updateSettings(next);
      engineRef.current?.updateSettings(next);
    });
    return () => {
      unsubSave();
      unsubCloud();
      unsubSettings();
    };
  }, [progression, settingsMgr, audioMgr, mpClient]);

  // Supabase Free Authentication & Cloud Save Binding
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;

    const applySession = async (
      session: { user: { id: string; email?: string; user_metadata?: Record<string, unknown> }; accessToken: string } | null
    ) => {
      if (cancelled) return;
      if (session) {
        setCloudEmail(session.user.email ?? 'Verified Operator');
        mpClient.setAccessToken(session.accessToken);
        const preferredName =
          typeof session.user.user_metadata?.username === 'string'
            ? session.user.user_metadata.username
            : undefined;
        await progression.bindCloudUser(session.user.id, preferredName);
      } else {
        setCloudEmail(null);
        mpClient.setAccessToken(null);
        await progression.bindCloudUser(null);
      }
    };

    void getCurrentSupabaseSession().then((sess) => applySession(sess));
    const unsubAuth = subscribeSupabaseAuth((sess) => {
      void applySession(sess);
    });

    return () => {
      cancelled = true;
      unsubAuth();
    };
  }, [mpClient, progression]);

  // Multiplayer WebSocket subscription
  useEffect(() => {
    const unsub = mpClient.subscribe({
      onStatusChange: (status) => {
        setMpStatus(status);
        if (status === 'connected') setMpError(null);
      },
      onAuthModeChange: (mode) => {
        setMpAuthMode(mode);
      },
      onLobbyUpdate: (players, nextRooms) => {
        setLobbyPlayers(players);
        setRooms(nextRooms);
      },
      onRoomUpdate: (room) => {
        setCurrentRoom(room);
        setMpError(null);
      },
      onChatMessage: (msg) => {
        setChatMessages((prev) => [...prev.slice(-49), msg]);
        audioMgr.playChatPing();
      },
      onInvited: (invite) => {
        setPendingInvite(invite);
        audioMgr.playChatPing();
      },
      onMatchStarted: (_roomId, mode, meta) => {
        audioMgr.unlock();
        void attemptLandscapeLock();
        setActiveModal(null);
        setGameOverStats(null);
        setMpError(null);
        setScreen('playing');
        engineRef.current?.startMultiplayerGame(mode, mpClient.getNetworkPlayerId(), meta);
        pushToast(
          meta?.isReconnect
            ? `Reconnected to ${mode.toUpperCase()} match`
            : `Squad deployed (${mode.toUpperCase()})`
        );
      },
      onMatchSnapshot: (snapshot) => {
        engineRef.current?.applyServerMatchSnapshot(snapshot);
      },
      onZombieKilled: (zombieId, killerId, coinReward, xpReward) => {
        engineRef.current?.handleServerZombieKilled(zombieId, killerId, coinReward, xpReward);
      },
      onPlayerDamaged: (damage, attackerX, attackerZ, serverHealth, serverArmor) => {
        engineRef.current?.handleServerPlayerDamaged(
          damage,
          attackerX,
          attackerZ,
          serverHealth,
          serverArmor
        );
      },
      onMatchEnded: (winnerId, reason, bonusCoins, bonusXp) => {
        engineRef.current?.endMultiplayerMatch(winnerId, reason, bonusCoins, bonusXp);
      },
      onError: (msg) => {
        setMpError(msg);
        pushToast(msg, true);
      },
    });

    const initialMaxHp = 100 + (progression.getData().upgrades[UpgradeId.MAX_HEALTH] ?? 0) * 20;
    mpClient.connect(initialMaxHp);
    return () => {
      unsub();
      mpClient.disconnect();
    };
  }, [mpClient, audioMgr, progression, pushToast, attemptLandscapeLock]);

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
        onMultiplayerStateSend: (payload) => mpClient.sendPlayerState(payload),
        onMultiplayerShotHit: (zombieId, damage, headshot, weaponId, source) =>
          mpClient.sendShotHit(zombieId, damage, headshot, weaponId, source),
        onMultiplayerUseConsumable: (kind) => mpClient.sendUseConsumable(kind),
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

  const isPortrait = viewport.height > viewport.width;
  const isRotatedLandscape = isTouchEnv && isPortrait;
  const stageStyle: React.CSSProperties = isRotatedLandscape
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: `${viewport.height}px`,
        height: `${viewport.width}px`,
        transform: 'translate(-50%, -50%) rotate(90deg)',
        transformOrigin: 'center center',
      }
    : {
        position: 'relative',
        width: '100%',
        height: '100%',
      };

  const handlePlaySolo = useCallback(() => {
    audioMgr.unlock();
    audioMgr.playUIClick();
    void attemptLandscapeLock();
    if (mpClient.currentRoom) {
      mpClient.leaveRoom();
    }
    setActiveModal(null);
    setGameOverStats(null);
    setScreen('playing');
    engineRef.current?.startNewGame();
  }, [audioMgr, attemptLandscapeLock, mpClient]);

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
    if (mpClient.currentRoom) {
      mpClient.leaveRoom();
    }
    setActiveModal(null);
    setGameOverStats(null);
    setScreen('menu');
    engineRef.current?.setScreenMode('menu');
  }, [audioMgr, mpClient]);

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

  const handleBuyAttachment = (weaponId: WeaponId, attId: AttachmentId) => {
    audioMgr.unlock();
    const res = progression.buyAttachment(weaponId, attId);
    audioMgr.playPurchase(res.success);
    pushToast(res.message, !res.success);
    if (res.success) engineRef.current?.syncProgressionAfterShop();
  };

  const handleToggleAttachment = (weaponId: WeaponId, attId: AttachmentId) => {
    audioMgr.unlock();
    const res = progression.toggleAttachment(weaponId, attId);
    audioMgr.playUIClick();
    pushToast(res.message, !res.success);
    if (res.success) engineRef.current?.syncProgressionAfterShop();
  };

  const handleWeaponSkin = (weaponId: WeaponId, skinId: WeaponSkinId) => {
    audioMgr.unlock();
    const res = progression.buyOrEquipWeaponSkin(weaponId, skinId);
    audioMgr.playPurchase(res.success);
    pushToast(res.message, !res.success);
    if (res.success) engineRef.current?.syncProgressionAfterShop();
  };

  const handleCharacterSkin = (skinId: CharacterSkinId) => {
    audioMgr.unlock();
    const res = progression.buyOrEquipCharacterSkin(skinId);
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

  const handleToggleMic = async () => {
    if (mpStatus !== 'connected' || !currentRoom) {
      pushToast('Join a multiplayer squad to use voice chat.');
      return;
    }
    const active = await mpClient.toggleMicrophone();
    setMicActive(active);
    pushToast(active ? 'Squad mic live' : 'Microphone muted');
  };

  const handleToggleDeafen = () => {
    const deaf = mpClient.toggleDeafen();
    setVoiceDeafened(deaf);
    pushToast(deaf ? 'Squad voice deafened' : 'Squad voice unmuted');
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[#07090d]"
      onPointerDown={() => {
        if (isTouchEnv && isPortrait) {
          void attemptLandscapeLock();
        }
      }}
    >
      <div
        style={stageStyle}
        className="overflow-hidden bg-[#07090d]"
      >
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
          mpStatus={mpStatus}
          onlineCount={lobbyPlayers.length}
          onPlay={handlePlaySolo}
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
            settings={settings}
            damageNumbers={damageNumbers}
            isMuted={settings.muted}
            showMobileControls={showMobileControls}
            mpConnected={mpStatus === 'connected' && Boolean(currentRoom)}
            micActive={micActive}
            voiceDeafened={voiceDeafened}
            chatMessages={chatMessages.filter((c) => c.channel === 'room')}
            onPause={handlePause}
            onToggleMute={() => settingsMgr.toggleMute()}
            onToggleFlashlight={() => engineRef.current?.toggleFlashlight()}
            onUseEquipment={(id) => engineRef.current?.useEquipment(id)}
            onSelectWeapon={(slot) => {
              const found = WEAPON_LIST.find((w) => w.slot === slot);
              if (found) engineRef.current?.equipWeapon(found.id);
            }}
            onToggleMic={handleToggleMic}
            onToggleDeafen={handleToggleDeafen}
            onSendChat={(text) => mpClient.sendChat('room', text)}
            onOpenSettings={() => {
              engineRef.current?.setScreenMode('paused');
              setScreen('paused');
              setActiveModal('settings');
            }}
          />
          {showMobileControls && (
            <MobileControls
              hud={hud}
              settings={settings}
              isRotatedLandscape={isRotatedLandscape}
              onMobileInput={(p) => engineRef.current?.setMobileInput(p)}
              onLookDelta={(dx, dy) => engineRef.current?.triggerMobileLook(dx, dy)}
              onFireStart={() => engineRef.current?.triggerMobileFire()}
              onFireEnd={() => engineRef.current?.setMobileInput({ fireHeld: false })}
              onJump={() => engineRef.current?.triggerMobileJump()}
              onReload={() => engineRef.current?.triggerReload()}
              onToggleFlashlight={() => engineRef.current?.toggleFlashlight()}
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
          gameMode={hud?.gameMode ?? 'solo'}
          onResume={handleResume}
          onRestart={handlePlaySolo}
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
          onRetry={handlePlaySolo}
          onMainMenu={handleReturnToMenu}
        />
      )}

      {/* Sub-Modals */}
      {activeModal === 'multiplayer' && (
        <MultiplayerModal
          saveData={saveData}
          localPlayerId={mpClient.getNetworkPlayerId()}
          status={mpStatus}
          authMode={mpAuthMode}
          cloudEmail={cloudEmail}
          mpError={mpError}
          lobbyPlayers={lobbyPlayers}
          rooms={rooms}
          currentRoom={currentRoom}
          chatMessages={chatMessages}
          onConnect={() => mpClient.connect()}
          onOpenProfile={() => {
            audioMgr.playUIClick();
            setActiveModal('profile');
          }}
          onQuickMatch={(mode) => {
            setMpError(null);
            mpClient.quickMatch(mode);
          }}
          onCreateRoom={(name, mode) => {
            setMpError(null);
            mpClient.createRoom(name, mode);
          }}
          onJoinRoom={(code) => {
            setMpError(null);
            mpClient.joinRoom(code);
          }}
          onLeaveRoom={() => {
            setMpError(null);
            mpClient.leaveRoom();
          }}
          onToggleReady={(ready) => mpClient.setReady(ready)}
          onStartMatch={() => mpClient.startMatch()}
          onInvitePlayer={(pid) => {
            mpClient.invitePlayer(pid);
            pushToast('Squad invite dispatched');
          }}
          onSendChat={(ch, txt) => mpClient.sendChat(ch, txt)}
          onClose={() => {
            audioMgr.playUIClick();
            setActiveModal(null);
          }}
        />
      )}

      {activeModal === 'weapons' && (
        <WeaponShopModal
          saveData={saveData}
          onBuy={handleBuyWeapon}
          onEquip={handleEquipWeapon}
          onUpgrade={handleUpgradeWeapon}
          onBuyAttachment={handleBuyAttachment}
          onToggleAttachment={handleToggleAttachment}
          onWeaponSkin={handleWeaponSkin}
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

      {activeModal === 'shop' && (
        <ShopModal
          saveData={saveData}
          onBuyOrEquipCharacterSkin={handleCharacterSkin}
          onBuyOrEquipWeaponSkin={handleWeaponSkin}
          onClose={() => {
            audioMgr.playUIClick();
            setActiveModal(null);
          }}
        />
      )}

      {activeModal === 'profile' && (
        <ProfileModal
          saveData={saveData}
          cloudConfigured={isSupabaseConfigured()}
          cloudEmail={cloudEmail}
          cloudSyncStatus={cloudSyncStatus}
          onUpdateProfile={(partial) => {
            const res = progression.updateProfile(partial);
            audioMgr.playPurchase(res.success);
            pushToast(res.message, !res.success);
          }}
          onSelectSkin={handleCharacterSkin}
          onSignIn={async (email, password) => {
            const res = await signInWithEmail(email, password);
            if (res.ok) pushToast(res.message);
            return { ok: res.ok, message: res.message };
          }}
          onSignUp={async (email, password, username) => {
            const res = await signUpWithEmail(email, password, username);
            if (res.ok) pushToast(res.message);
            return { ok: res.ok, message: res.message };
          }}
          onSignOut={async () => {
            await signOutSupabase();
            pushToast('Signed out from cloud account');
          }}
          onSyncNow={async () => {
            const ok = await progression.syncCloudNow();
            pushToast(ok ? 'Cloud save synced' : 'Cloud sync failed', !ok);
          }}
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

      {/* Squad Invite Popup */}
      {pendingInvite && screen === 'menu' && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#0d1420] border border-sky-500/60 rounded-xl p-4 shadow-2xl max-w-xs">
          <div className="text-xs font-display font-bold text-sky-400 uppercase tracking-wider">
            Squad Invite
          </div>
          <div className="text-xs text-slate-200 mt-1">
            <strong>{pendingInvite.fromName}</strong> invited you to{' '}
            <strong>{pendingInvite.roomName}</strong> ({pendingInvite.roomCode})
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                mpClient.joinRoom(pendingInvite.roomCode);
                setPendingInvite(null);
                setActiveModal('multiplayer');
              }}
              className="flex-1 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold cursor-pointer"
            >
              Accept
            </button>
            <button
              onClick={() => setPendingInvite(null)}
              className="px-3 py-1.5 rounded bg-[#182132] text-slate-300 text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
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
    </div>
  );
}
