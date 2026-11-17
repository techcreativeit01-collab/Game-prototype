import * as THREE from 'three';
import {
  CharacterSkinId,
  DamageNumberEvent,
  EquipmentId,
  GameMode,
  GameOverStats,
  GameScreen,
  HUDState,
  MinimapBlip,
  MultiplayerMatchSnapshot,
  ObjectiveItem,
  RemotePlayerSnapshot,
  SettingsData,
  SquadMemberHUD,
  TargetZombieHUD,
  UpgradeId,
  WeaponId,
} from '../types/game';
import {
  WEAPONS_BY_ID,
  WEAPON_LIST,
  getEffectiveWeaponDamage,
  getEffectiveWeaponStats,
} from '../data/WeaponData';
import { getXpForNextLevel } from '../data/GameData';
import { ProgressionManager } from '../managers/EconomyManager';
import { AudioManager } from '../managers/AudioManager';
import { ForestTextureSet, createForestTextures } from './ProceduralTextures';
import { WeaponViewModel, createWeaponViewModel } from './WeaponModels';
import { ARENA_RADIUS, ForestEnvironment, groundHeightAt } from './ForestEnvironment';
import { PlayerController } from './PlayerController';
import { ZombieInstance, ZombieManager } from './ZombieManager';
import { EquipmentSystem } from './EquipmentSystem';
import { BloodSystem } from './BloodSystem';
import {
  HumanCharacterRig,
  animateHumanRig,
  createHumanCharacterRig,
} from './CharacterModels';

interface WeaponAmmoState {
  inMag: number;
  reserve: number;
}

interface PooledParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

interface BrassCasing {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  bounced: boolean;
  active: boolean;
}

interface BallisticProjectile {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  knockback: number;
  penetrationLeft: number;
  hitIds: Set<number>;
  life: number;
}

interface TracerBeam {
  line: THREE.Line;
  life: number;
}

interface RemotePlayerVisual {
  rig: HumanCharacterRig;
  curPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  curYaw: number;
  targetYaw: number;
  alive: boolean;
  isMoving: boolean;
  isSprinting: boolean;
  isFiring: boolean;
  weaponId: WeaponId;
  skin: CharacterSkinId;
  phase: number;
  flashTimer: number;
}

export interface MobileInputState {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  crouch: boolean;
  aim: boolean;
  fireHeld: boolean;
}

export interface GameEngineCallbacks {
  onHUDUpdate: (hud: HUDState) => void;
  onDamageNumber: (dmg: DamageNumberEvent) => void;
  onGameOver: (stats: GameOverStats) => void;
  onPauseRequest: () => void;
  onToast: (msg: string, isError?: boolean) => void;
  onContextLost: (lost: boolean) => void;
  onMultiplayerStateSend?: (payload: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    weaponId: WeaponId;
    isMoving: boolean;
    isSprinting: boolean;
    isCrouching: boolean;
    isFiring: boolean;
  }) => void;
  onMultiplayerShotHit?: (
    zombieId: number,
    damage: number,
    headshot: boolean,
    weaponId: WeaponId,
    source?: 'weapon' | 'grenade' | 'turret'
  ) => void;
  onMultiplayerUseConsumable?: (kind: 'medkit' | 'armor') => void;
}

const _v3A = new THREE.Vector3();
const _v3B = new THREE.Vector3();
const _v3C = new THREE.Vector3();
const _projVec = new THREE.Vector3();

export class GameEngine {
  private container: HTMLElement;
  private progression: ProgressionManager;
  private audio: AudioManager;
  private callbacks: GameEngineCallbacks;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: ForestTextureSet;
  private forest!: ForestEnvironment;
  private player = new PlayerController();
  private zombies!: ZombieManager;
  private equipment!: EquipmentSystem;
  private blood!: BloodSystem;

  // Main menu 3D character showcase
  private menuHero!: HumanCharacterRig;
  private menuHeroSkin: CharacterSkinId = 'ranger';
  private menuHeroWeapon: WeaponId = WeaponId.M4;

  // Multiplayer state & remote squadmates
  private gameMode: GameMode = 'solo';
  private localPlayerId = '';
  private mpDowned = false;
  private mpNeedsSnapshotSync = false;
  private remotePlayers = new Map<string, RemotePlayerVisual>();
  private latestSquadHUD: SquadMemberHUD[] = [];
  private mpStateSendTimer = 0;

  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private lastRenderTime = performance.now();
  private elapsed = 0;

  // Performance monitoring
  private fpsSamples: number[] = [];
  private currentFps = 60;
  private adaptiveScale = 1.0;
  private lowFpsTimer = 0;
  private lastTextureQuality = 'high';

  private screenMode: GameScreen = 'menu';
  private settings: SettingsData;

  // Tactical weapon flashlight + atmospheric beam cone
  private flashlight!: THREE.SpotLight;
  private flashlightTarget = new THREE.Object3D();
  private flashlightCone!: THREE.Mesh;
  private flashlightOn = true;

  // Weapon Viewmodel & Combat
  private weaponMount = new THREE.Group();
  private viewModels = new Map<WeaponId, WeaponViewModel>();
  private currentWeaponId: WeaponId = WeaponId.KATANA;
  private ammoMap = new Map<WeaponId, WeaponAmmoState>();
  private fireCooldown = 0;
  private isReloading = false;
  private reloadTimer = 0;
  private reloadDuration = 1.5;
  private switchAnimTimer = 0;
  private recoilOffsetZ = 0;
  private weaponSwayX = 0;
  private weaponSwayY = 0;
  private meleeSwingTimer = 0;
  private muzzleFlashTimer = 0;
  private muzzleLight = new THREE.PointLight(0xffb85c, 0, 14);
  private aimToggledOn = false;

  // Physics Pools: particles, brass casings, ballistic projectiles, tracers
  private particles: PooledParticle[] = [];
  private casings: BrassCasing[] = [];
  private projectiles: BallisticProjectile[] = [];
  private bulletGeo = new THREE.SphereGeometry(0.032, 6, 6);
  private bulletMat = new THREE.MeshBasicMaterial({ color: 0xffdf99 });
  private tracers: TracerBeam[] = [];
  private raycaster = new THREE.Raycaster();

  // Desktop & Mobile inputs
  private keys = new Set<string>();
  private mouseFireHeld = false;
  private mouseFireJustPressed = false;
  private mouseAimHeld = false;
  private mobileInput: MobileInputState = {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    crouch: false,
    aim: false,
    fireHeld: false,
  };
  private mobileFireJustPressed = false;
  private pointerLocked = false;
  private lastGyroBeta: number | null = null;
  private lastGyroGamma: number | null = null;

  // Run stats & target lock telemetry
  private kills = 0;
  private sessionCoins = 0;
  private sessionXp = 0;
  private sessionGems = 0;
  private waveBonusAccum = 0;
  private survivalTime = 0;
  private supplyDropsCollected = 0;
  private hitstopTimer = 0;
  private hitMarkerType: HUDState['hitMarkerType'] = 'none';
  private hitMarkerTimer = 0;
  private nextDamageNumId = 1;
  private hudEmitTimer = 0;
  private waveBannerTimer = 0;
  private targetZombie: TargetZombieHUD | null = null;
  private targetScanTimer = 0;

  constructor(
    container: HTMLElement,
    progression: ProgressionManager,
    audio: AudioManager,
    initialSettings: SettingsData,
    callbacks: GameEngineCallbacks
  ) {
    this.container = container;
    this.progression = progression;
    this.audio = audio;
    this.settings = { ...initialSettings };
    this.lastTextureQuality = initialSettings.textureQuality;
    this.callbacks = callbacks;

    this.initThree();
    this.initParticlePool();
    this.initCasingPool();
    this.initViewModels();
    this.initMenuHero();
    this.bindEvents();
    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return false;
    }
  }

  private applyRendererResolution(): void {
    if (!this.renderer) return;
    const baseDpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const scale = this.settings.resolutionScale * this.adaptiveScale;
    this.renderer.setPixelRatio(Math.max(0.5, Math.min(2.2, baseDpr * scale)));
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
  }

  private initThree(): void {
    this.isSoftwareGl = this.detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && this.settings.antiAliasing,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled =
      !this.isSoftwareGl && this.settings.shadowQuality !== 'off';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.applyRendererResolution();
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      this.settings.fov || 74,
      w / h,
      0.08,
      this.settings.renderDistance + 75
    );
    this.scene.add(this.camera);

    // Weapon mount + muzzle light + tactical weapon flashlight
    this.camera.add(this.weaponMount);
    this.muzzleLight.position.set(0.2, -0.1, -0.7);
    this.camera.add(this.muzzleLight);

    this.flashlight = new THREE.SpotLight(0xdbeafe, 6.8, 44, Math.PI / 5.5, 0.55, 1.35);
    this.flashlight.position.set(0.18, -0.12, -0.2);
    this.flashlightTarget.position.set(0, -0.1, -10);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;

    const coneGeo = new THREE.ConeGeometry(2.1, 11.5, 18, 1, true);
    coneGeo.translate(0, -5.75, 0);
    coneGeo.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xcbe3ff,
      transparent: true,
      opacity: 0.032,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.flashlightCone = new THREE.Mesh(coneGeo, coneMat);
    this.flashlightCone.position.copy(this.flashlight.position);
    this.camera.add(this.flashlightCone);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createForestTextures(maxAniso, this.settings.textureQuality);
    this.forest = new ForestEnvironment(
      this.scene,
      this.renderer,
      this.textures,
      this.isSoftwareGl,
      this.settings
    );
    this.zombies = new ZombieManager(this.scene, this.forest.spawnPoints, this.textures);
    this.equipment = new EquipmentSystem(this.scene, this.textures.woodAlbedo);
    this.blood = new BloodSystem(this.scene, this.settings.graphicsQuality === 'low' ? 60 : 110);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private getBloodWallTargets(): THREE.Object3D[] {
    if (this.equipment.barricades.length === 0) {
      return this.forest.bulletBlockMeshes;
    }
    return [
      ...this.forest.bulletBlockMeshes,
      ...this.equipment.barricades.map((b) => b.mesh),
    ];
  }

  private initMenuHero(): void {
    const save = this.progression.getData();
    this.menuHeroSkin = save.profile.selectedCharacterSkin;
    this.menuHeroWeapon =
      save.equippedWeapon === WeaponId.KATANA ? WeaponId.M4 : save.equippedWeapon;
    this.menuHero = createHumanCharacterRig(this.menuHeroSkin, this.menuHeroWeapon);
    const hx = 2.8;
    const hz = -3.4;
    this.menuHero.root.position.set(hx, groundHeightAt(hx, hz), hz);
    this.menuHero.root.rotation.y = 0.65;
    this.scene.add(this.menuHero.root);
  }

  private initParticlePool(): void {
    const geo = new THREE.BoxGeometry(0.065, 0.065, 0.065);
    for (let i = 0; i < 110; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x991b1b });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.4,
        active: false,
      });
    }
  }

  private initCasingPool(): void {
    const geo = new THREE.CylinderGeometry(0.008, 0.008, 0.032, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd4a446,
      metalness: 0.9,
      roughness: 0.25,
    });
    for (let i = 0; i < 36; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.casings.push({
        mesh,
        vel: new THREE.Vector3(),
        rotVel: new THREE.Vector3(),
        life: 0,
        bounced: false,
        active: false,
      });
    }
  }

  private ejectBrassCasing(originWorld: THREE.Vector3): void {
    for (const c of this.casings) {
      if (!c.active) {
        c.active = true;
        c.bounced = false;
        c.life = 1.6;
        c.mesh.position.copy(originWorld);
        c.mesh.visible = true;
        _v3B.set(1.6 + Math.random() * 1.1, 1.8 + Math.random() * 0.9, 0.35).applyQuaternion(
          this.camera.quaternion
        );
        c.vel.copy(_v3B);
        c.rotVel.set(Math.random() * 18, Math.random() * 18, Math.random() * 18);
        break;
      }
    }
  }

  private spawnParticles(pos: THREE.Vector3, colorHex: number, count: number, speed = 4.5): void {
    const fxScale =
      this.settings.effectsQuality === 'low'
        ? 0.45
        : this.settings.effectsQuality === 'medium'
        ? 0.75
        : 1.0;
    const targetCount = Math.max(1, Math.round(count * fxScale));
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < targetCount; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.28 + Math.random() * 0.28;
        p.mesh.position.copy(pos);
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
        p.mesh.scale.setScalar(0.8 + Math.random() * 0.8);
        p.vel.set(
          (Math.random() - 0.5) * speed,
          1.2 + Math.random() * speed * 0.7,
          (Math.random() - 0.5) * speed
        );
        p.mesh.visible = true;
        spawned++;
      }
    }
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3, colorHex = 0xffe49e): void {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.055 });
  }

  private initViewModels(): void {
    for (const w of WEAPON_LIST) {
      const vm = createWeaponViewModel(w.id, this.textures.metalBrushed, this.isSoftwareGl);
      vm.root.visible = false;
      this.weaponMount.add(vm.root);
      this.viewModels.set(w.id, vm);
    }
    this.refreshViewModelCustomizations();
  }

  private refreshViewModelCustomizations(): void {
    const save = this.progression.getData();
    this.viewModels.forEach((vm, wId) => {
      const atts = save.equippedAttachments[wId] ?? [];
      const skin = save.equippedWeaponSkins[wId] ?? 'standard';
      vm.applyCustomization(atts, skin);
    });
    if (this.menuHero) {
      if (save.profile.selectedCharacterSkin !== this.menuHeroSkin) {
        this.menuHeroSkin = save.profile.selectedCharacterSkin;
        this.menuHero.setSkin(this.menuHeroSkin);
      }
      const nextHeroW =
        save.equippedWeapon === WeaponId.KATANA ? WeaponId.M4 : save.equippedWeapon;
      if (nextHeroW !== this.menuHeroWeapon) {
        this.menuHeroWeapon = nextHeroW;
        this.menuHero.setWeapon(this.menuHeroWeapon);
      }
    }
  }

  private resetAmmoPool(): void {
    const save = this.progression.getData();
    const ammoMult = 1 + (save.upgrades[UpgradeId.MAX_AMMO] ?? 0) * 0.15;
    this.ammoMap.clear();
    for (const w of WEAPON_LIST) {
      const eff = getEffectiveWeaponStats(w, save.equippedAttachments[w.id] ?? []);
      this.ammoMap.set(w.id, {
        inMag: eff.magSize,
        reserve: Math.round(w.maxReserve * ammoMult),
      });
    }
  }

  private clearRemotePlayers(): void {
    this.remotePlayers.forEach((rp) => {
      this.scene.remove(rp.rig.root);
      rp.rig.dispose();
    });
    this.remotePlayers.clear();
    this.latestSquadHUD = [];
  }

  startNewGame(): void {
    this.gameMode = 'solo';
    this.localPlayerId = this.progression.getData().profile.playerId;
    this.mpNeedsSnapshotSync = false;
    this.clearRemotePlayers();
    this.initRunCommon(false);
  }

  startMultiplayerGame(
    mode: 'coop' | 'competitive',
    localPlayerId: string,
    options?: { isReconnect?: boolean; spawnX?: number; spawnZ?: number }
  ): void {
    if (
      options?.isReconnect &&
      (this.screenMode === 'playing' || this.screenMode === 'paused') &&
      this.gameMode === mode
    ) {
      this.localPlayerId = localPlayerId;
      this.mpNeedsSnapshotSync = false;
      return;
    }

    this.gameMode = mode;
    this.localPlayerId = localPlayerId;
    this.mpNeedsSnapshotSync = Boolean(options?.isReconnect);
    this.clearRemotePlayers();
    this.initRunCommon(true);

    if (typeof options?.spawnX === 'number' && typeof options?.spawnZ === 'number') {
      const gy = groundHeightAt(options.spawnX, options.spawnZ);
      this.player.position.set(options.spawnX, gy, options.spawnZ);
    }
  }

  private initRunCommon(isMultiplayer: boolean): void {
    this.audio.unlock();
    const save = this.progression.getData();
    this.progression.resetSessionTracking();

    this.player.reset(save.upgrades, this.settings.fov);
    this.zombies.reset(isMultiplayer);
    this.equipment.reset();
    this.blood.clear();
    this.forest.clearSupplyDrop();
    this.resetAmmoPool();
    this.refreshViewModelCustomizations();

    for (const pr of this.projectiles) this.scene.remove(pr.mesh);
    this.projectiles.length = 0;

    this.mpDowned = false;
    this.kills = 0;
    this.sessionCoins = 0;
    this.sessionXp = 0;
    this.sessionGems = 0;
    this.waveBonusAccum = 0;
    this.survivalTime = 0;
    this.supplyDropsCollected = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.aimToggledOn = false;
    this.hitMarkerType = 'none';
    this.hitMarkerTimer = 0;
    this.waveBannerTimer = 3.2;
    this.flashlightOn = true;
    this.flashlight.visible = true;
    this.flashlightCone.visible = true;
    if (this.menuHero) this.menuHero.root.visible = false;

    this.equipWeapon(save.equippedWeapon, false);
    this.weaponMount.visible = true;
    this.screenMode = 'playing';
    this.emitHUD();
    this.requestPointerLock();
  }

  applyServerMatchSnapshot(snapshot: MultiplayerMatchSnapshot): void {
    if (
      this.gameMode === 'solo' ||
      (this.screenMode !== 'playing' && this.screenMode !== 'paused')
    ) {
      return;
    }

    this.zombies.syncFromServerSnapshots(
      snapshot.zombies,
      snapshot.wave,
      snapshot.waveState,
      snapshot.waveCountdown,
      snapshot.zombiesRemaining,
      snapshot.waveTotalZombies,
      this.settings.lodDistance
    );

    const activeIds = new Set<string>();
    const squad: SquadMemberHUD[] = [];

    for (const p of snapshot.players) {
      squad.push({
        playerId: p.playerId,
        username: p.username,
        avatarId: p.avatarId,
        health: p.health,
        maxHealth: p.maxHealth,
        alive: p.alive,
        score: p.score,
      });

      if (p.playerId === this.localPlayerId) {
        if (this.mpNeedsSnapshotSync) {
          this.mpNeedsSnapshotSync = false;
          this.player.position.set(p.x, Math.max(p.y, groundHeightAt(p.x, p.z)), p.z);
          this.kills = p.kills;
        }
        this.player.health = Math.max(0, Math.min(this.player.maxHealth, p.health));
        if (typeof p.armor === 'number') {
          this.player.armor = Math.max(0, p.armor);
        }
        if ((!p.alive || p.health <= 0) && !this.mpDowned) {
          this.mpDowned = true;
          this.callbacks.onToast('You are DOWNED — waiting for squad outcome or Pause to exit.', true);
          this.emitHUD();
        }
        continue;
      }

      activeIds.add(p.playerId);
      let vis = this.remotePlayers.get(p.playerId);
      if (!vis) {
        const isAlly = this.gameMode === 'coop';
        const rig = createHumanCharacterRig(p.skin, p.weaponId, p.username, isAlly);
        rig.root.position.set(p.x, p.y, p.z);
        this.scene.add(rig.root);
        vis = {
          rig,
          curPos: new THREE.Vector3(p.x, p.y, p.z),
          targetPos: new THREE.Vector3(p.x, p.y, p.z),
          curYaw: p.yaw,
          targetYaw: p.yaw,
          alive: p.alive,
          isMoving: p.isMoving,
          isSprinting: p.isSprinting,
          isFiring: p.isFiring,
          weaponId: p.weaponId,
          skin: p.skin,
          phase: 0,
          flashTimer: 0,
        };
        this.remotePlayers.set(p.playerId, vis);
      } else {
        vis.targetPos.set(p.x, p.y, p.z);
        vis.targetYaw = p.yaw;
        vis.alive = p.alive;
        vis.isMoving = p.isMoving;
        vis.isSprinting = p.isSprinting;
        vis.isFiring = p.isFiring;
        if (vis.weaponId !== p.weaponId) {
          vis.weaponId = p.weaponId;
          vis.rig.setWeapon(p.weaponId);
        }
        if (vis.skin !== p.skin) {
          vis.skin = p.skin;
          vis.rig.setSkin(p.skin);
        }
      }
    }

    this.latestSquadHUD = squad;

    // Remove disconnected players
    for (const [id, vis] of this.remotePlayers.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(vis.rig.root);
        vis.rig.dispose();
        this.remotePlayers.delete(id);
      }
    }
  }

  handleServerZombieKilled(
    zombieId: number,
    killerId: string,
    coinReward: number,
    xpReward: number
  ): void {
    const z = this.zombies.getZombieById(zombieId);
    if (z && z.state !== 'dead') {
      z.state = 'dead';
      z.deathTimer = 0;
      for (const hm of z.hitMeshes) {
        const idx = this.zombies.raycastTargets.indexOf(hm);
        if (idx !== -1) this.zombies.raycastTargets.splice(idx, 1);
      }
      const burstOrigin = z.position.clone().add(new THREE.Vector3(0, 1.15 * z.scale, 0));
      this.blood.spawnBloodImpact(
        z.type,
        burstOrigin,
        new THREE.Vector3(0, -0.4, 0),
        false,
        this.getBloodWallTargets(),
        this.settings.effectsQuality,
        true
      );
      this.audio.playZombieSound(z.type, z.position.distanceTo(this.player.position), true);
    }

    if (killerId === this.localPlayerId) {
      this.kills++;
      this.sessionCoins += coinReward;
      this.sessionXp += xpReward;
      this.progression.rewardZombieKill(zombieId + 100000, coinReward, xpReward);
      this.triggerHitMarker('kill');
    }
  }

  handleServerPlayerDamaged(
    damage: number,
    attackerX: number,
    attackerZ: number,
    serverHealth: number,
    serverArmor?: number
  ): void {
    if (this.screenMode !== 'playing' && this.screenMode !== 'paused') return;
    const save = this.progression.getData();
    this.player.takeDamage(
      damage,
      save.upgrades,
      new THREE.Vector3(attackerX, this.player.position.y, attackerZ)
    );
    this.player.health = Math.max(0, serverHealth);
    if (typeof serverArmor === 'number') {
      this.player.armor = Math.max(0, serverArmor);
    }
    this.audio.playZombieAttack();
    this.audio.playPlayerHurt();
    this.vibrate(85);
    if (this.player.health <= 0 && !this.mpDowned) {
      this.mpDowned = true;
      this.callbacks.onToast('You are DOWNED — waiting for squad outcome or Pause to exit.', true);
      this.emitHUD();
    }
  }

  endMultiplayerMatch(
    winnerId: string | null,
    reason: string,
    bonusCoins: number,
    bonusXp: number
  ): void {
    if (this.screenMode !== 'playing' && this.screenMode !== 'paused') return;
    const won = winnerId === this.localPlayerId;
    if (bonusCoins > 0) {
      this.progression.addCoins(bonusCoins);
      this.sessionCoins += bonusCoins;
    }
    if (bonusXp > 0) {
      this.progression.addXpAndGems(bonusXp, won ? 6 : 2);
      this.sessionXp += bonusXp;
      this.sessionGems += won ? 6 : 2;
    }
    this.callbacks.onToast(reason);
    this.finishRun(won);
  }

  setScreenMode(mode: GameScreen): void {
    this.screenMode = mode;
    if (mode !== 'playing') {
      this.keys.clear();
      this.mouseFireHeld = false;
      this.mouseAimHeld = false;
      this.aimToggledOn = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
    }
    if (mode === 'menu') {
      this.clearRemotePlayers();
      this.gameMode = 'solo';
      if (this.menuHero) this.menuHero.root.visible = true;
    } else if (this.menuHero) {
      this.menuHero.root.visible = mode === 'loading';
    }

    this.weaponMount.visible = mode === 'playing' || mode === 'paused';
    this.flashlight.visible = mode === 'playing' && this.flashlightOn;
    this.flashlightCone.visible = mode === 'playing' && this.flashlightOn;
    this.emitHUD();
  }

  resumeGame(): void {
    this.screenMode = 'playing';
    this.weaponMount.visible = true;
    this.flashlight.visible = this.flashlightOn;
    this.flashlightCone.visible = this.flashlightOn;
    this.requestPointerLock();
    this.emitHUD();
  }

  toggleFlashlight(): void {
    this.flashlightOn = !this.flashlightOn;
    this.flashlight.visible = this.screenMode === 'playing' && this.flashlightOn;
    this.flashlightCone.visible = this.screenMode === 'playing' && this.flashlightOn;
    const vm = this.viewModels.get(this.currentWeaponId);
    if (vm?.flashlightLens) {
      (vm.flashlightLens.material as THREE.MeshStandardMaterial).emissive.setHex(
        this.flashlightOn ? 0x93c5fd : 0x000000
      );
    }
    this.audio.playFlashlightClick();
    this.emitHUD();
  }

  requestPointerLock(): void {
    if (this.screenMode !== 'playing') return;
    try {
      const el = this.renderer.domElement;
      if (el.requestPointerLock && !this.isTouchDevice()) {
        const res = el.requestPointerLock() as unknown as Promise<void> | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch {
      // Ignore pointer lock rejection
    }
  }

  private isTouchDevice(): boolean {
    return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  }

  private vibrate(ms: number): void {
    if (!this.settings.vibration) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(ms);
      }
    } catch {
      // ignore unsupported vibration API
    }
  }

  updateSettings(next: SettingsData): void {
    const texChanged = next.textureQuality !== this.lastTextureQuality;
    this.settings = { ...next };
    this.lastTextureQuality = next.textureQuality;

    this.renderer.shadowMap.enabled = !this.isSoftwareGl && next.shadowQuality !== 'off';
    this.camera.far = next.renderDistance + 75;
    this.camera.updateProjectionMatrix();
    this.adaptiveScale = 1.0;
    this.applyRendererResolution();

    if (texChanged) {
      // Rebuild texture resolution tier cleanly when texture quality changes
      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      this.textures.dispose();
      this.textures = createForestTextures(maxAniso, next.textureQuality);
    }

    this.forest.applySettings(next, this.isSoftwareGl);
  }

  equipWeapon(weaponId: WeaponId, playSound = true): void {
    const save = this.progression.getData();
    if (!save.unlockedWeapons.includes(weaponId)) return;

    this.viewModels.forEach((vm, id) => {
      vm.root.visible = id === weaponId;
      vm.muzzleFlash.visible = false;
    });

    this.currentWeaponId = weaponId;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.switchAnimTimer = 0.24;
    this.progression.equipWeapon(weaponId);
    this.refreshViewModelCustomizations();
    if (playSound) this.audio.playWeaponSwitch();
    this.emitHUD();
  }

  syncProgressionAfterShop(): void {
    const save = this.progression.getData();
    this.player.refreshMaxHealth(save.upgrades);
    if (save.equippedWeapon !== this.currentWeaponId) {
      this.equipWeapon(save.equippedWeapon, false);
    }
    this.refreshViewModelCustomizations();
    const ammoMult = 1 + (save.upgrades[UpgradeId.MAX_AMMO] ?? 0) * 0.15;
    for (const w of WEAPON_LIST) {
      const st = this.ammoMap.get(w.id);
      if (st) {
        const eff = getEffectiveWeaponStats(w, save.equippedAttachments[w.id] ?? []);
        const maxRes = Math.round(w.maxReserve * ammoMult);
        if (st.inMag > eff.magSize) st.inMag = eff.magSize;
        if (st.reserve < maxRes && w.id === save.equippedWeapon) {
          st.reserve = Math.max(st.reserve, Math.min(maxRes, st.reserve + eff.magSize));
        }
      }
    }
    this.emitHUD();
  }

  setMobileInput(partial: Partial<MobileInputState>): void {
    Object.assign(this.mobileInput, partial);
  }

  triggerMobileFire(): void {
    this.mobileFireJustPressed = true;
    this.mobileInput.fireHeld = true;
  }

  triggerMobileLook(dx: number, dy: number): void {
    if (this.screenMode !== 'playing') return;
    const isAiming = this.isCurrentlyAiming();
    this.player.applyLook(dx, dy, this.settings, isAiming, true);
    this.weaponSwayX = THREE.MathUtils.clamp(this.weaponSwayX - dx * 0.0012, -0.04, 0.04);
    this.weaponSwayY = THREE.MathUtils.clamp(this.weaponSwayY + dy * 0.0012, -0.04, 0.04);
  }

  triggerMobileJump(): void {
    if (this.screenMode === 'playing') {
      this.keys.add('Space_MOBILE');
      window.setTimeout(() => this.keys.delete('Space_MOBILE'), 90);
    }
  }

  triggerReload(): void {
    if (this.screenMode !== 'playing') return;
    this.startReload();
  }

  triggerInteract(): void {
    if (this.screenMode !== 'playing') return;
    this.tryInteractPickup();
  }

  cycleWeapon(dir: 1 | -1): void {
    const unlocked = this.progression.getData().unlockedWeapons;
    if (unlocked.length <= 1) return;
    const ordered = WEAPON_LIST.map((w) => w.id).filter((id) => unlocked.includes(id));
    const idx = ordered.indexOf(this.currentWeaponId);
    const nextIdx = (idx + dir + ordered.length) % ordered.length;
    this.equipWeapon(ordered[nextIdx]);
  }

  useEquipment(itemId: EquipmentId): void {
    if (this.screenMode !== 'playing' || this.mpDowned) return;
    const count = this.progression.getData().inventory[itemId] ?? 0;
    if (count <= 0) {
      this.callbacks.onToast('Out of item — buy more in Inventory.', true);
      this.audio.playPurchase(false);
      return;
    }

    switch (itemId) {
      case EquipmentId.MEDKIT: {
        if (!this.player.heal(60)) {
          this.callbacks.onToast('Health is already full.');
          return;
        }
        this.progression.consumeInventoryItem(itemId);
        if (this.gameMode !== 'solo') {
          this.callbacks.onMultiplayerUseConsumable?.('medkit');
        }
        this.audio.playPurchase(true);
        this.callbacks.onToast('+60 HP Restored');
        break;
      }
      case EquipmentId.ARMOR_PLATE: {
        if (!this.player.addArmor(50)) {
          this.callbacks.onToast('Armor is already full.');
          return;
        }
        this.progression.consumeInventoryItem(itemId);
        if (this.gameMode !== 'solo') {
          this.callbacks.onMultiplayerUseConsumable?.('armor');
        }
        this.audio.playReload();
        this.callbacks.onToast('+50 Kevlar Armor');
        break;
      }
      case EquipmentId.AMMO_CRATE: {
        const spec = WEAPONS_BY_ID[this.currentWeaponId];
        if (spec.isMelee) {
          this.callbacks.onToast('Switch to a firearm to use Ammo Pack.', true);
          return;
        }
        const ammoMult = 1 + (this.progression.getData().upgrades[UpgradeId.MAX_AMMO] ?? 0) * 0.15;
        const maxRes = Math.round(spec.maxReserve * ammoMult);
        const st = this.ammoMap.get(this.currentWeaponId)!;
        if (st.reserve >= maxRes) {
          this.callbacks.onToast('Reserve ammo already full.');
          return;
        }
        st.reserve = maxRes;
        this.progression.consumeInventoryItem(itemId);
        this.audio.playReload();
        this.callbacks.onToast(`Resupplied ${spec.name} ammo`);
        break;
      }
      case EquipmentId.GRENADE: {
        this.progression.consumeInventoryItem(itemId);
        this.camera.getWorldDirection(_v3A);
        this.equipment.throwGrenade(this.camera.position, _v3A);
        this.audio.playWeaponFire(WeaponId.KATANA);
        break;
      }
      case EquipmentId.BARRICADE: {
        this.progression.consumeInventoryItem(itemId);
        this.equipment.placeBarricade(this.player.position, this.player.yaw);
        this.audio.playReload();
        this.callbacks.onToast('Timber Barricade deployed');
        break;
      }
      case EquipmentId.TURRET: {
        this.progression.consumeInventoryItem(itemId);
        this.equipment.placeTurret(this.player.position, this.player.yaw);
        this.audio.playPurchase(true);
        this.callbacks.onToast('Auto Robot Turret deployed');
        break;
      }
      case EquipmentId.ADRENALINE: {
        this.progression.consumeInventoryItem(itemId);
        this.player.adrenalineTimer = 12.0;
        this.player.stamina = 100;
        this.audio.playPurchase(true);
        this.callbacks.onToast('Adrenaline Surge active (12s)');
        break;
      }
    }
    this.emitHUD();
  }

  private isCurrentlyAiming(): boolean {
    if (this.settings.aimMode === 'toggle') {
      return this.aimToggledOn || this.mobileInput.aim;
    }
    return this.mouseAimHeld || this.mobileInput.aim;
  }

  private startReload(): void {
    const spec = WEAPONS_BY_ID[this.currentWeaponId];
    if (spec.isMelee || this.isReloading) return;
    const save = this.progression.getData();
    const eff = getEffectiveWeaponStats(spec, save.equippedAttachments[this.currentWeaponId] ?? []);
    const st = this.ammoMap.get(this.currentWeaponId);
    if (!st || st.inMag >= eff.magSize || st.reserve <= 0) return;

    const reloadBonus = 1 + (save.upgrades[UpgradeId.RELOAD_SPEED] ?? 0) * 0.07;
    this.reloadDuration = Math.max(0.45, spec.reloadTime / reloadBonus);
    this.reloadTimer = this.reloadDuration;
    this.isReloading = true;
    this.audio.playReload(this.reloadDuration);
  }

  private completeReload(): void {
    const spec = WEAPONS_BY_ID[this.currentWeaponId];
    const save = this.progression.getData();
    const eff = getEffectiveWeaponStats(spec, save.equippedAttachments[this.currentWeaponId] ?? []);
    const st = this.ammoMap.get(this.currentWeaponId);
    if (!st) return;
    const needed = eff.magSize - st.inMag;
    const loaded = Math.min(needed, st.reserve);
    st.inMag += loaded;
    st.reserve -= loaded;
    this.isReloading = false;
    this.reloadTimer = 0;
  }

  private collectSupplyDrop(): void {
    if (!this.forest.supplyDropPos) return;
    this.forest.clearSupplyDrop();
    this.supplyDropsCollected++;
    const bonusCoins = 65 + this.zombies.wave * 15;
    const bonusGems = 3;
    this.progression.addCoins(bonusCoins);
    this.progression.addXpAndGems(55, bonusGems);
    this.progression.grantLootItem(EquipmentId.MEDKIT);
    this.sessionCoins += bonusCoins;
    this.sessionXp += 55;
    this.sessionGems += bonusGems;

    // Top up current gun reserve
    const spec = WEAPONS_BY_ID[this.currentWeaponId];
    if (!spec.isMelee) {
      const st = this.ammoMap.get(this.currentWeaponId);
      if (st) st.reserve += spec.magSize * 2;
    }

    this.audio.playPurchase(true);
    this.vibrate(40);
    this.callbacks.onToast(`Supply Drop: +${bonusCoins} Coins, +${bonusGems} Gems & Medkit`);
  }

  private tryInteractPickup(): void {
    if (
      this.forest.supplyDropPos &&
      this.forest.supplyDropPos.distanceTo(this.player.position) <= 3.4
    ) {
      this.collectSupplyDrop();
      return;
    }
    for (let i = this.zombies.lootDrops.length - 1; i >= 0; i--) {
      const drop = this.zombies.lootDrops[i];
      if (drop.position.distanceTo(this.player.position) <= 3.0) {
        this.collectDrop(drop, i);
        break;
      }
    }
  }

  private collectDrop(
    drop: { kind: 'coins' | EquipmentId; amount: number; mesh: THREE.Group },
    index: number
  ): void {
    if (drop.kind === 'coins') {
      this.progression.addCoins(drop.amount);
      this.sessionCoins += drop.amount;
      this.callbacks.onToast(`+${drop.amount} Coins`);
    } else {
      const granted = this.progression.grantLootItem(drop.kind);
      if (!granted) {
        this.callbacks.onToast('Inventory full for pickup');
        return;
      }
      this.callbacks.onToast(`Picked up ${drop.kind.replace('_', ' ')}`);
    }
    this.audio.playPurchase(true);
    this.scene.remove(drop.mesh);
    this.zombies.lootDrops.splice(index, 1);
  }

  private handleCombatInput(dt: number): void {
    const spec = WEAPONS_BY_ID[this.currentWeaponId];
    const save = this.progression.getData();

    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.completeReload();
      }
      return;
    }

    const fireTrigger = spec.automatic
      ? this.mouseFireHeld || this.mobileInput.fireHeld
      : this.mouseFireJustPressed || this.mobileFireJustPressed;

    this.mouseFireJustPressed = false;
    this.mobileFireJustPressed = false;

    if (!fireTrigger || this.fireCooldown > 0 || this.switchAnimTimer > 0.08) return;

    const rateBonus = 1 + (save.upgrades[UpgradeId.FIRE_RATE] ?? 0) * 0.06;
    const effectiveRate = spec.fireRate * rateBonus;

    if (spec.isMelee) {
      this.fireCooldown = 1 / effectiveRate;
      this.performMeleeAttack();
      return;
    }

    const st = this.ammoMap.get(this.currentWeaponId)!;
    if (st.inMag <= 0) {
      if (st.reserve > 0 && this.settings.autoReload) {
        this.startReload();
      } else {
        this.fireCooldown = 0.25;
        this.audio.playUIClick();
        this.callbacks.onToast(
          st.reserve > 0 ? 'Press [R] to reload!' : 'No ammunition remaining!',
          true
        );
      }
      return;
    }

    st.inMag--;
    this.fireCooldown = 1 / effectiveRate;
    this.performFirearmShot();

    if (st.inMag === 0 && st.reserve > 0 && this.settings.autoReload) {
      this.startReload();
    }
  }

  private applyAimAssistLock(): void {
    if (!this.settings.aimAssist) return;
    this.camera.getWorldDirection(_v3A);
    let bestZombie: ZombieInstance | null = null;
    let bestDot = 0.94;
    for (const z of this.zombies.zombies) {
      if (z.state === 'dead') continue;
      _v3B.copy(z.position).sub(this.player.position);
      const dist = _v3B.length();
      if (dist > 38) continue;
      _v3B.divideScalar(Math.max(0.001, dist));
      const dot = _v3B.x * _v3A.x + _v3B.z * _v3A.z;
      if (dot > bestDot) {
        bestDot = dot;
        bestZombie = z;
      }
    }
    if (bestZombie) {
      this.player.applyAimAssistNudge(bestZombie.position, 0.28);
    }
  }

  private performMeleeAttack(): void {
    const spec = WEAPONS_BY_ID[WeaponId.KATANA];
    const save = this.progression.getData();
    const weaponLvl = save.weaponLevels[WeaponId.KATANA] ?? 1;
    const dmgUpgrade = save.upgrades[UpgradeId.WEAPON_DAMAGE] ?? 0;
    const damage = getEffectiveWeaponDamage(spec, weaponLvl, dmgUpgrade);

    this.meleeSwingTimer = 0.28;
    this.audio.playWeaponFire(WeaponId.KATANA, false);

    this.camera.getWorldDirection(_v3A);
    let hitAny = false;
    let killedAny = false;

    for (const z of this.zombies.zombies) {
      if (z.state === 'dead') continue;
      _v3B.copy(z.position).sub(this.player.position);
      _v3B.y = 0;
      const dist = _v3B.length();
      if (dist > spec.range) continue;

      _v3B.normalize();
      _v3C.set(_v3A.x, 0, _v3A.z).normalize();
      const dot = _v3B.dot(_v3C);
      if (dot > 0.42 || dist < 1.25) {
        hitAny = true;
        const hitPos = z.position.clone().add(new THREE.Vector3(0, 1.3 * z.scale, 0));
        this.emitDamageNumber(hitPos, damage, false);

        let killedThis = false;
        if (this.gameMode !== 'solo') {
          this.zombies.applyLocalVisualHit(z);
          this.callbacks.onMultiplayerShotHit?.(z.id, damage, false, WeaponId.KATANA, 'weapon');
        } else {
          killedThis = this.zombies.damageZombie(
            z,
            damage,
            (deadZ) => {
              this.handleZombieKilled(deadZ);
              killedAny = true;
            },
            _v3B,
            5.2
          );
          if (killedThis) killedAny = true;
        }

        this.blood.spawnBloodImpact(
          z.type,
          hitPos,
          _v3B,
          false,
          this.getBloodWallTargets(),
          this.settings.effectsQuality,
          killedThis
        );
      }
    }

    if (hitAny) {
      this.audio.playMeleeHit();
      this.hitstopTimer = 0.045;
      this.player.addShake(0.038);
      this.vibrate(28);
      this.triggerHitMarker(killedAny ? 'kill' : 'normal');
    }
  }

  private performFirearmShot(): void {
    const spec = WEAPONS_BY_ID[this.currentWeaponId];
    const save = this.progression.getData();
    const weaponLvl = save.weaponLevels[this.currentWeaponId] ?? 1;
    const dmgUpgrade = save.upgrades[UpgradeId.WEAPON_DAMAGE] ?? 0;
    const accUpgrade = save.upgrades[UpgradeId.ACCURACY] ?? 0;
    const baseDmg = getEffectiveWeaponDamage(spec, weaponLvl, dmgUpgrade);
    const effStats = getEffectiveWeaponStats(
      spec,
      save.equippedAttachments[this.currentWeaponId] ?? []
    );

    if (this.settings.aimAssist) {
      this.applyAimAssistLock();
    }

    this.audio.playWeaponFire(this.currentWeaponId, effStats.suppressed);
    this.player.addRecoil(effStats.recoil, accUpgrade);
    this.recoilOffsetZ = Math.min(0.12, this.recoilOffsetZ + 0.072);
    this.vibrate(spec.id === WeaponId.M107 || spec.id === WeaponId.BENELLI_M4 ? 42 : 18);

    const vm = this.viewModels.get(this.currentWeaponId);
    if (vm) {
      if (!effStats.suppressed) {
        vm.muzzleFlash.visible = true;
        vm.muzzleFlash.rotation.z = Math.random() * Math.PI;
        this.muzzleFlashTimer = 0.045;
        this.muzzleLight.intensity = 7.2;
      }
      vm.muzzlePoint.getWorldPosition(_v3C);
      vm.ejectPoint.getWorldPosition(_v3B);
      this.ejectBrassCasing(_v3B);
    } else {
      _v3C.copy(this.camera.position);
    }

    const isAiming = this.isCurrentlyAiming();
    const accFactor = Math.max(0.38, 1 - accUpgrade * 0.07);
    const movePenalty = this.player.isMoving ? 1.45 : 1.0;
    const crouchBonus = this.player.isCrouching ? 0.72 : 1.0;
    const spread =
      effStats.spreadRad * accFactor * movePenalty * crouchBonus * (isAiming ? 0.32 : 1.0);

    const muzzleSpeed =
      spec.id === WeaponId.M107
        ? 195
        : spec.id === WeaponId.M4 || spec.id === WeaponId.AK74 || spec.id === WeaponId.M2
        ? 145
        : 105;
    const knockback =
      spec.id === WeaponId.BENELLI_M4
        ? 4.6
        : spec.id === WeaponId.M107
        ? 8.5
        : spec.id === WeaponId.M2
        ? 4.2
        : 1.8;

    for (let p = 0; p < spec.pellets; p++) {
      this.camera.getWorldDirection(_v3A);
      _v3A.x += (Math.random() - 0.5) * spread * 2;
      _v3A.y += (Math.random() - 0.5) * spread * 2;
      _v3A.z += (Math.random() - 0.5) * spread * 2;
      _v3A.normalize();

      const startPos = this.camera.position.clone().addScaledVector(_v3A, 0.35);
      const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
      mesh.position.copy(startPos);
      this.scene.add(mesh);

      this.projectiles.push({
        mesh,
        pos: startPos.clone(),
        prevPos: startPos.clone(),
        vel: _v3A.clone().multiplyScalar(muzzleSpeed),
        damage: baseDmg,
        knockback,
        penetrationLeft: spec.penetration,
        hitIds: new Set<number>(),
        life: spec.range / muzzleSpeed + 0.08,
      });

      if (p === 0) {
        const tracerEnd = startPos.clone().addScaledVector(_v3A, Math.min(28, spec.range));
        this.spawnTracer(_v3C, tracerEnd);
      }
    }
  }

  private updateBallisticProjectiles(dt: number): void {
    const allTargets = [...this.zombies.raycastTargets, ...this.forest.bulletBlockMeshes];

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.life <= 0) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      pr.prevPos.copy(pr.pos);
      pr.vel.y -= 9.81 * dt;
      pr.vel.multiplyScalar(1 - 0.12 * dt);
      pr.pos.addScaledVector(pr.vel, dt);
      pr.mesh.position.copy(pr.pos);

      _v3A.copy(pr.pos).sub(pr.prevPos);
      const segLen = _v3A.length();
      if (segLen < 1e-4) continue;
      _v3A.divideScalar(segLen);

      this.raycaster.set(pr.prevPos, _v3A);
      this.raycaster.near = 0;
      this.raycaster.far = segLen;

      const hits = this.raycaster.intersectObjects(allTargets, true);
      let destroyBullet = false;

      for (const hit of hits) {
        const zId = hit.object.userData.zombieId as number | undefined;
        if (zId === undefined) {
          this.spawnParticles(hit.point, 0xfbbf24, 5, 3.8);
          this.audio.playBulletImpact(Math.random() < 0.4 ? 'stone' : 'wood', false);
          destroyBullet = true;
          break;
        }

        if (pr.hitIds.has(zId)) continue;
        const zombie = this.zombies.getZombieById(zId);
        if (!zombie || zombie.state === 'dead') continue;

        pr.hitIds.add(zId);
        const isHeadshot = Boolean(hit.object.userData.isHead);
        const dmg = isHeadshot ? Math.round(pr.damage * 1.75) : pr.damage;

        this.emitDamageNumber(hit.point, dmg, isHeadshot);

        let killed = false;
        if (this.gameMode !== 'solo') {
          this.zombies.applyLocalVisualHit(zombie);
          this.callbacks.onMultiplayerShotHit?.(
            zombie.id,
            dmg,
            isHeadshot,
            this.currentWeaponId,
            'weapon'
          );
        } else {
          this.zombies.damageZombie(
            zombie,
            dmg,
            (deadZ) => {
              this.handleZombieKilled(deadZ);
              killed = true;
            },
            _v3A,
            pr.knockback
          );
        }

        this.blood.spawnBloodImpact(
          zombie.type,
          hit.point,
          _v3A,
          isHeadshot,
          this.getBloodWallTargets(),
          this.settings.effectsQuality,
          killed
        );

        this.audio.playBulletImpact('flesh', isHeadshot);
        this.audio.playHit(isHeadshot);
        this.triggerHitMarker(killed ? 'kill' : isHeadshot ? 'headshot' : 'normal');

        pr.penetrationLeft--;
        if (pr.penetrationLeft <= 0) {
          destroyBullet = true;
          break;
        }
      }

      if (!destroyBullet && pr.pos.y <= groundHeightAt(pr.pos.x, pr.pos.z)) {
        this.spawnParticles(pr.pos, 0x57534e, 3, 2.2);
        destroyBullet = true;
      }

      if (destroyBullet) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private handleZombieKilled(z: ZombieInstance): void {
    this.kills++;
    const dist = z.position.distanceTo(this.player.position);
    this.audio.playZombieSound(z.type, dist, true);
    const rewarded = this.progression.rewardZombieKill(z.id, z.coinReward, z.xpReward);
    if (rewarded) {
      this.sessionCoins += z.coinReward;
      this.sessionXp += z.xpReward;
    }
  }

  private triggerHitMarker(type: HUDState['hitMarkerType']): void {
    if (!this.settings.hitMarkers) return;
    this.hitMarkerType = type;
    this.hitMarkerTimer = 0.16;
  }

  private emitDamageNumber(worldPos: THREE.Vector3, amount: number, headshot: boolean): void {
    if (!this.settings.damageIndicators) return;
    _projVec.copy(worldPos);
    _projVec.project(this.camera);
    if (_projVec.z > 1) return;

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const x = ((_projVec.x + 1) / 2) * w;
    const y = ((-_projVec.y + 1) / 2) * h;

    this.callbacks.onDamageNumber({
      id: this.nextDamageNumId++,
      x,
      y,
      amount,
      headshot,
      createdAt: performance.now(),
    });
  }

  private animateWeaponViewModel(dt: number): void {
    const vm = this.viewModels.get(this.currentWeaponId);
    if (!vm) return;

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        vm.muzzleFlash.visible = false;
        this.muzzleLight.intensity = 0;
      }
    }

    if (this.switchAnimTimer > 0) {
      this.switchAnimTimer = Math.max(0, this.switchAnimTimer - dt);
    }
    this.recoilOffsetZ = THREE.MathUtils.damp(this.recoilOffsetZ, 0, 16, dt);
    this.weaponSwayX = THREE.MathUtils.damp(this.weaponSwayX, 0, 10, dt);
    this.weaponSwayY = THREE.MathUtils.damp(this.weaponSwayY, 0, 10, dt);

    const isAiming = this.isCurrentlyAiming();
    const isKatana = this.currentWeaponId === WeaponId.KATANA;
    const save = this.progression.getData();
    const hasScope =
      this.currentWeaponId === WeaponId.M107 ||
      (save.equippedAttachments[this.currentWeaponId] ?? []).includes('scope');
    const isSniperAds = isAiming && hasScope;
    vm.root.visible = !isSniperAds;

    const targetX = (isAiming && !isKatana ? 0.0 : isKatana ? 0.28 : 0.23) + this.weaponSwayX;
    const targetY =
      (isAiming && !isKatana ? -0.15 : isKatana ? -0.24 : -0.21) -
      (this.switchAnimTimer / 0.24) * 0.22 -
      (this.isReloading ? Math.sin((this.reloadTimer / this.reloadDuration) * Math.PI) * 0.14 : 0) +
      this.weaponSwayY;
    const targetZ = (isAiming && !isKatana ? -0.34 : -0.44) + this.recoilOffsetZ;

    const swayAmt = this.player.isMoving
      ? this.player.isSprinting
        ? 0.018
        : 0.009
      : isAiming
      ? 0.0008
      : 0.0022;
    const swayX = Math.cos(this.elapsed * 6.5) * swayAmt;
    const swayY = Math.sin(this.elapsed * 13) * swayAmt;

    vm.root.position.x = THREE.MathUtils.damp(vm.root.position.x, targetX + swayX, 16, dt);
    vm.root.position.y = THREE.MathUtils.damp(vm.root.position.y, targetY + swayY, 16, dt);
    vm.root.position.z = THREE.MathUtils.damp(vm.root.position.z, targetZ, 18, dt);

    if (isKatana) {
      if (this.meleeSwingTimer > 0) {
        this.meleeSwingTimer = Math.max(0, this.meleeSwingTimer - dt);
        const swingProg = 1 - this.meleeSwingTimer / 0.28;
        const arc = Math.sin(swingProg * Math.PI);
        vm.root.rotation.x = -0.45 - arc * 1.15;
        vm.root.rotation.y = -0.25 + arc * 1.35;
        vm.root.rotation.z = 0.18 + arc * 0.85;
      } else {
        vm.root.rotation.x = THREE.MathUtils.damp(vm.root.rotation.x, -0.45, 14, dt);
        vm.root.rotation.y = THREE.MathUtils.damp(vm.root.rotation.y, -0.25, 14, dt);
        vm.root.rotation.z = THREE.MathUtils.damp(vm.root.rotation.z, 0.18, 14, dt);
      }
    } else {
      const reloadTilt = this.isReloading ? -0.42 : 0;
      vm.root.rotation.x = THREE.MathUtils.damp(
        vm.root.rotation.x,
        this.recoilOffsetZ * 1.5 + reloadTilt,
        16,
        dt
      );
      vm.root.rotation.z = THREE.MathUtils.damp(vm.root.rotation.z, this.isReloading ? 0.35 : 0, 12, dt);
    }
  }

  private updateTargetZombieScan(dt: number): void {
    this.targetScanTimer -= dt;
    if (this.targetScanTimer > 0) return;
    this.targetScanTimer = 0.08;

    this.camera.getWorldDirection(_v3A);
    this.raycaster.set(this.camera.position, _v3A);
    this.raycaster.near = 0.2;
    this.raycaster.far = 45;

    const hits = this.raycaster.intersectObjects(this.zombies.raycastTargets, false);
    if (hits.length > 0) {
      const zId = hits[0].object.userData.zombieId as number | undefined;
      const z = zId ? this.zombies.getZombieById(zId) : undefined;
      if (z && z.state !== 'dead') {
        this.targetZombie = {
          name: z.label,
          health: Math.ceil(z.health),
          maxHealth: z.maxHealth,
          isBoss: z.type === 'boss',
        };
        return;
      }
    }
    this.targetZombie = null;
  }

  private buildObjectives(): ObjectiveItem[] {
    const waveGoal = this.zombies.waveTotalZombies;
    const killedThisWave = Math.max(0, waveGoal - this.zombies.zombiesRemaining);
    const items: ObjectiveItem[] = [
      {
        id: 'survive',
        label: `Survive Wave ${this.zombies.wave}`,
        completed: this.zombies.waveState === 'cleared',
      },
      {
        id: 'elim',
        label: `Eliminate infected (${killedThisWave}/${waveGoal})`,
        completed: this.zombies.zombiesRemaining === 0,
      },
    ];
    if (this.forest.supplyDropPos || this.supplyDropsCollected > 0) {
      items.push({
        id: 'supply',
        label: this.forest.supplyDropPos
          ? 'Collect Supply Drop'
          : `Supply Drops Secured (${this.supplyDropsCollected})`,
        completed: !this.forest.supplyDropPos && this.supplyDropsCollected > 0,
      });
    }
    return items;
  }

  private buildMinimapBlips(): MinimapBlip[] {
    const blips: MinimapBlip[] = [];
    const maxRangeSq = 48 * 48;
    for (const z of this.zombies.zombies) {
      if (z.state === 'dead') continue;
      if (z.position.distanceToSquared(this.player.position) <= maxRangeSq) {
        blips.push({
          x: z.position.x,
          z: z.position.z,
          kind: z.type === 'boss' ? 'boss' : 'zombie',
        });
      }
      if (blips.length >= 24) break;
    }
    this.remotePlayers.forEach((rp) => {
      if (rp.alive) {
        blips.push({ x: rp.curPos.x, z: rp.curPos.z, kind: 'teammate' });
      }
    });
    if (this.forest.supplyDropPos) {
      blips.push({
        x: this.forest.supplyDropPos.x,
        z: this.forest.supplyDropPos.z,
        kind: 'supply',
      });
    }
    for (const d of this.zombies.lootDrops) {
      blips.push({ x: d.position.x, z: d.position.z, kind: 'drop' });
    }
    return blips;
  }

  private emitHUD(): void {
    const save = this.progression.getData();
    const spec = WEAPONS_BY_ID[this.currentWeaponId];
    const effStats = getEffectiveWeaponStats(
      spec,
      save.equippedAttachments[this.currentWeaponId] ?? []
    );
    const ammo = this.ammoMap.get(this.currentWeaponId) ?? { inMag: 0, reserve: 0 };
    const isAiming = this.isCurrentlyAiming();

    let interactPrompt: string | null = null;
    let supplyDropDistance: number | null = null;
    if (this.forest.supplyDropPos) {
      const dist = this.forest.supplyDropPos.distanceTo(this.player.position);
      supplyDropDistance = Math.round(dist);
      if (dist <= 3.4) {
        interactPrompt = '[E] Open Supply Drop';
      }
    }

    if (!interactPrompt) {
      for (const drop of this.zombies.lootDrops) {
        if (drop.position.distanceTo(this.player.position) <= 3.0) {
          interactPrompt =
            drop.kind === 'coins'
              ? `[E] Collect ${drop.amount} Coins`
              : `[E] Pick up ${drop.kind.replace('_', ' ')}`;
          break;
        }
      }
    }

    const spreadPx = spec.isMelee
      ? 10
      : Math.round(
          (effStats.spreadRad * 420 + (this.player.isMoving ? 10 : 0) + this.recoilOffsetZ * 160) *
            (isAiming ? 0.35 : 1)
        );

    const hasScope =
      this.currentWeaponId === WeaponId.M107 ||
      (save.equippedAttachments[this.currentWeaponId] ?? []).includes('scope');

    const xpNeeded = getXpForNextLevel(save.profile.level);
    const playerXpPct = Math.min(100, Math.round((save.profile.xp / Math.max(1, xpNeeded)) * 100));

    this.callbacks.onHUDUpdate({
      health: Math.ceil(this.player.health),
      maxHealth: this.player.maxHealth,
      armor: Math.ceil(this.player.armor),
      maxArmor: this.player.maxArmor,
      stamina: Math.round(this.player.stamina),
      weaponId: this.currentWeaponId,
      weaponName: spec.name,
      isMelee: spec.isMelee,
      ammoInMag: ammo.inMag,
      ammoReserve: ammo.reserve,
      magSize: effStats.magSize,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading
        ? Math.min(1, 1 - this.reloadTimer / this.reloadDuration)
        : 0,
      isAiming,
      scopeActive: isAiming && hasScope,
      isCrouching: this.player.isCrouching,
      isSprinting: this.player.isSprinting,
      isSliding: this.player.isSliding,
      flashlightOn: this.flashlightOn,
      crosshairSpread: Math.max(6, spreadPx),
      coins: save.coins,
      gems: save.gems,
      sessionCoins: this.sessionCoins,
      wave: this.zombies.wave,
      zombiesRemaining: this.zombies.zombiesRemaining,
      waveTotalZombies: this.zombies.waveTotalZombies,
      waveState: this.zombies.waveState,
      waveCountdown: Math.max(0, Math.ceil(this.zombies.waveCountdown)),
      kills: this.kills,
      survivalTime: this.survivalTime,
      pointerLocked: this.pointerLocked,
      interactPrompt,
      hitMarkerType: this.hitMarkerType,
      damageFlash: this.player.damageFlash,
      hitDirectionDeg: this.player.hitDirectionDeg,
      adrenalineTimer: this.player.adrenalineTimer,
      inventory: { ...save.inventory },
      unlockedWeapons: [...save.unlockedWeapons],
      activeTurrets: this.equipment.turrets.length,
      activeBarricades: this.equipment.barricades.length,
      waveBanner: this.waveBannerTimer > 0 ? this.zombies.waveBanner : null,
      targetZombie: this.targetZombie,
      yaw: this.player.yaw,
      playerX: this.player.position.x,
      playerZ: this.player.position.z,
      objectives: this.buildObjectives(),
      squadMembers: this.latestSquadHUD,
      minimapBlips: this.buildMinimapBlips(),
      supplyDropDistance,
      fps: Math.round(this.currentFps),
      qualityTier: this.settings.graphicsQuality,
      gameMode: this.gameMode,
      playerName: save.profile.username,
      playerLevel: save.profile.level,
      playerXpPct,
      playerAvatarId: save.profile.avatarId,
    });
  }

  private startLoop(): void {
    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();

      // Enforce user FPS Cap (e.g. 30, 45, 60, 90, 120) on hardware GPUs
      const minFrameMs =
        !this.isSoftwareGl && this.settings.fpsLimit > 0 ? 1000 / this.settings.fpsLimit : 0;
      if (minFrameMs > 0 && now - this.lastRenderTime < minFrameMs * 0.92) {
        this.frameId = requestAnimationFrame(tick);
        return;
      }
      this.lastRenderTime = now;

      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
      this.elapsed += dt;

      // Rolling FPS telemetry & Dynamic Adaptive Resolution Scaling
      if (rawDt > 0.001) {
        const instFps = Math.min(240, 1 / rawDt);
        this.fpsSamples.push(instFps);
        if (this.fpsSamples.length > 24) this.fpsSamples.shift();
        this.currentFps =
          this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;

        if (!this.isSoftwareGl && this.screenMode === 'playing') {
          if (this.currentFps < 26) {
            this.lowFpsTimer += dt;
            if (this.lowFpsTimer > 2.5 && this.adaptiveScale > 0.7) {
              this.adaptiveScale = Math.max(0.7, this.adaptiveScale - 0.12);
              this.applyRendererResolution();
              this.lowFpsTimer = 0;
            }
          } else {
            this.lowFpsTimer = Math.max(0, this.lowFpsTimer - dt * 0.5);
          }
        }
      }

      this.stepSimulation(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private stepSimulation(dt: number): void {
    this.forest.update(dt, this.elapsed, this.player.position);

    if (this.screenMode === 'menu' || this.screenMode === 'loading') {
      const panAngle = this.elapsed * 0.12;
      const focusX = 2.8;
      const focusZ = -3.4;
      const camX = focusX + Math.sin(panAngle) * 5.2 + 2.2;
      const camZ = focusZ + Math.cos(panAngle) * 5.2 + 2.5;
      const camY = groundHeightAt(camX, camZ) + 1.85 + Math.sin(this.elapsed * 0.4) * 0.12;
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(focusX - 0.8, groundHeightAt(focusX, focusZ) + 1.15, focusZ);
      this.weaponMount.visible = false;
      this.flashlight.visible = false;
      this.flashlightCone.visible = false;
      if (this.menuHero) {
        this.menuHero.root.visible = true;
        animateHumanRig(this.menuHero, dt, 'idle', this.elapsed * 1.4);
      }
      return;
    }

    if (this.screenMode !== 'playing') {
      return;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.animateWeaponViewModel(dt);
      return;
    }

    this.survivalTime += dt;
    if (this.waveBannerTimer > 0) this.waveBannerTimer -= dt;
    if (this.hitMarkerTimer > 0) {
      this.hitMarkerTimer -= dt;
      if (this.hitMarkerTimer <= 0) this.hitMarkerType = 'none';
    }

    const kbX = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const kbZ = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const inputX = this.mpDowned
      ? 0
      : THREE.MathUtils.clamp(kbX + this.mobileInput.moveX, -1, 1);
    const inputZ = this.mpDowned
      ? 0
      : THREE.MathUtils.clamp(kbZ + this.mobileInput.moveZ, -1, 1);

    const wantJump =
      !this.mpDowned && (this.keys.has('Space') || this.keys.has('Space_MOBILE'));
    const wantSprint =
      !this.mpDowned &&
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.mobileInput.sprint);
    const wantCrouch = !this.mpDowned && (this.keys.has('KeyC') || this.mobileInput.crouch);
    const isAiming = !this.mpDowned && this.isCurrentlyAiming();

    const save = this.progression.getData();
    const spec = WEAPONS_BY_ID[this.currentWeaponId];
    const effStats = getEffectiveWeaponStats(
      spec,
      save.equippedAttachments[this.currentWeaponId] ?? []
    );

    this.player.update(
      dt,
      inputX,
      inputZ,
      wantJump,
      wantSprint,
      wantCrouch,
      isAiming,
      effStats.adsFov,
      this.settings,
      save.upgrades,
      this.forest.obstacles,
      this.equipment.barricades,
      this.camera,
      (sprinting) => this.audio.playFootstep(sprinting),
      () => this.audio.playJump(),
      (impactSpeed) => this.audio.playLand(impactSpeed),
      () => this.audio.playSlide()
    );

    if (!this.mpDowned) {
      this.handleCombatInput(dt);
    }
    this.animateWeaponViewModel(dt);
    this.updateBallisticProjectiles(dt);
    this.updateTargetZombieScan(dt);
    this.blood.update(dt, this.settings.effectsQuality);

    // Update remote multiplayer squadmates interpolation & animation
    this.remotePlayers.forEach((rp) => {
      rp.curPos.lerp(rp.targetPos, Math.min(1, dt * 14));
      rp.curPos.y = Math.max(rp.curPos.y, groundHeightAt(rp.curPos.x, rp.curPos.z));
      rp.rig.root.position.copy(rp.curPos);
      let diff = rp.targetYaw - rp.curYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rp.curYaw += diff * Math.min(1, dt * 12);
      rp.rig.root.rotation.y = rp.curYaw;

      const animState = !rp.alive
        ? 'dead'
        : rp.isMoving
        ? rp.isSprinting
          ? 'run'
          : 'walk'
        : 'idle';
      rp.phase += dt * (rp.isSprinting ? 10 : rp.isMoving ? 6 : 2);
      animateHumanRig(rp.rig, dt, animState, rp.phase);

      if (rp.isFiring) {
        rp.flashTimer = 0.06;
        rp.rig.muzzleFlash.visible = true;
      } else if (rp.flashTimer > 0) {
        rp.flashTimer -= dt;
        if (rp.flashTimer <= 0) rp.rig.muzzleFlash.visible = false;
      }
    });

    // Send local state at ~20Hz during multiplayer matches
    if (this.gameMode !== 'solo' && this.callbacks.onMultiplayerStateSend) {
      this.mpStateSendTimer += dt;
      if (this.mpStateSendTimer >= 0.05) {
        this.mpStateSendTimer = 0;
        this.callbacks.onMultiplayerStateSend({
          x: this.player.position.x,
          y: this.player.position.y,
          z: this.player.position.z,
          yaw: this.player.yaw,
          pitch: this.player.pitch,
          weaponId: this.currentWeaponId,
          isMoving: this.player.isMoving,
          isSprinting: this.player.isSprinting,
          isCrouching: this.player.isCrouching,
          isFiring: this.mouseFireHeld || this.mobileInput.fireHeld,
        });
      }
    }

    // Auto walk-over pickup for coins drops & supply drop
    if (
      this.forest.supplyDropPos &&
      this.forest.supplyDropPos.distanceTo(this.player.position) <= 2.3
    ) {
      this.collectSupplyDrop();
    }
    for (let i = this.zombies.lootDrops.length - 1; i >= 0; i--) {
      const drop = this.zombies.lootDrops[i];
      if (drop.kind === 'coins' && drop.position.distanceTo(this.player.position) <= 1.8) {
        this.collectDrop(drop, i);
      }
    }

    // Update particle pool
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
    }

    // Update brass shell casing physics pool
    for (const c of this.casings) {
      if (!c.active) continue;
      c.life -= dt;
      if (c.life <= 0) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }
      c.vel.y -= 15.5 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.rotVel.x * dt;
      c.mesh.rotation.y += c.rotVel.y * dt;
      c.mesh.rotation.z += c.rotVel.z * dt;
      const gy = groundHeightAt(c.mesh.position.x, c.mesh.position.z) + 0.015;
      if (c.mesh.position.y <= gy) {
        c.mesh.position.y = gy;
        if (!c.bounced) {
          c.bounced = true;
          c.vel.y = Math.abs(c.vel.y) * 0.36;
          c.vel.x *= 0.55;
          c.vel.z *= 0.55;
          this.audio.playShellCasingBounce();
        } else {
          c.vel.set(0, 0, 0);
          c.rotVel.set(0, 0, 0);
        }
      }
    }

    // Update tracer fade
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / 0.055);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Equipment (grenades, barricades, robot turrets)
    this.equipment.update(
      dt,
      this.zombies,
      (origin) => {
        this.audio.playExplosion();
        const d = origin.distanceTo(this.player.position);
        if (d < 16) {
          this.player.addShake(Math.max(0.02, (1 - d / 16) * 0.14));
          this.vibrate(70);
        }
      },
      (from, to) => {
        this.spawnTracer(from, to, 0xff8a3c);
        this.audio.playTurretFire();
      },
      (deadZ) => this.handleZombieKilled(deadZ),
      (z, dmg, dir, source, killed) => {
        const hitPos = z.position.clone().add(new THREE.Vector3(0, 1.15 * z.scale, 0));
        this.blood.spawnBloodImpact(
          z.type,
          hitPos,
          dir,
          false,
          this.getBloodWallTargets(),
          this.settings.effectsQuality,
          killed
        );
        if (this.gameMode !== 'solo') {
          this.callbacks.onMultiplayerShotHit?.(z.id, dmg, false, this.currentWeaponId, source);
        }
      }
    );

    // Zombies AI + Wave progression
    this.zombies.update(
      dt,
      this.player.position,
      this.camera,
      this.settings,
      this.forest.obstacles,
      this.equipment.barricades,
      (damage, attackerPos) => {
        if (this.gameMode !== 'solo') return;
        this.player.takeDamage(damage, save.upgrades, attackerPos);
        this.audio.playZombieAttack();
        this.audio.playPlayerHurt();
        this.vibrate(85);
        if (this.player.health <= 0) {
          this.finishRun(false);
        }
      },
      (waveCompleted, bonusCoins) => {
        this.progression.addCoins(bonusCoins);
        this.progression.addXpAndGems(waveCompleted * 45, 2);
        this.sessionCoins += bonusCoins;
        this.sessionXp += waveCompleted * 45;
        this.sessionGems += 2;
        this.waveBonusAccum += bonusCoins;
        this.waveBannerTimer = 3.2;
        this.audio.playPurchase(true);
        this.callbacks.onToast(`Wave ${waveCompleted} Cleared! +${bonusCoins} Coins & +2 Gems`);
      },
      (newWave) => {
        this.waveBannerTimer = 3.2;
        this.audio.playWaveBanner();
        if (newWave % 2 === 0 && !this.forest.supplyDropPos) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 12 + Math.random() * (ARENA_RADIUS * 0.45);
          this.forest.spawnSupplyDrop(Math.cos(angle) * dist, Math.sin(angle) * dist);
          this.callbacks.onToast('Supply Drop incoming — follow the green beacon!');
        }
      },
      (zType, dist) => {
        this.audio.playZombieSound(zType, dist, false);
      }
    );

    // Emit HUD at ~20Hz
    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.05) {
      this.hudEmitTimer = 0;
      this.emitHUD();
    }
  }

  private finishRun(won: boolean): void {
    this.setScreenMode('gameover');
    this.audio.playGameOver();
    const isNewRecord = this.progression.recordRunEnd(
      this.zombies.wave,
      this.survivalTime,
      won
    );
    const save = this.progression.getData();
    const waveGems = Math.floor(this.zombies.wave / 3) + (won ? 5 : 0);
    this.callbacks.onGameOver({
      finalWave: this.zombies.wave,
      highestWave: save.highestWave,
      kills: this.kills,
      coinsEarned: this.sessionCoins,
      xpEarned: this.sessionXp,
      gemsEarned: this.sessionGems + waveGems,
      survivalTime: this.survivalTime,
      waveBonusCoins: this.waveBonusAccum,
      isNewRecord,
      gameMode: this.gameMode,
      victory: won,
    });
  }

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.applyRendererResolution();
  };

  private onDeviceOrientation = (e: DeviceOrientationEvent) => {
    if (!this.settings.gyroscope || this.screenMode !== 'playing') {
      this.lastGyroBeta = null;
      this.lastGyroGamma = null;
      return;
    }
    if (typeof e.beta !== 'number' || typeof e.gamma !== 'number') return;
    if (this.lastGyroBeta !== null && this.lastGyroGamma !== null) {
      const dx = (e.gamma - this.lastGyroGamma) * 2.2;
      const dy = (this.lastGyroBeta - e.beta) * 1.8;
      this.player.applyLook(dx, dy, this.settings, this.isCurrentlyAiming(), true);
    }
    this.lastGyroBeta = e.beta;
    this.lastGyroGamma = e.gamma;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      if (this.screenMode === 'playing') {
        this.callbacks.onPauseRequest();
      }
      return;
    }

    if (this.screenMode !== 'playing') return;
    this.keys.add(e.code);

    if (e.code === 'KeyR') this.startReload();
    else if (e.code === 'KeyL') this.toggleFlashlight();
    else if (e.code === 'KeyE') this.tryInteractPickup();
    else if (e.code === 'KeyH') this.useEquipment(EquipmentId.MEDKIT);
    else if (e.code === 'KeyV') this.useEquipment(EquipmentId.ARMOR_PLATE);
    else if (e.code === 'KeyF') this.useEquipment(EquipmentId.AMMO_CRATE);
    else if (e.code === 'KeyG') this.useEquipment(EquipmentId.GRENADE);
    else if (e.code === 'KeyB') this.useEquipment(EquipmentId.BARRICADE);
    else if (e.code === 'KeyT') this.useEquipment(EquipmentId.TURRET);
    else if (e.code === 'KeyX') this.useEquipment(EquipmentId.ADRENALINE);
    else if (e.code.startsWith('Digit')) {
      const slot = parseInt(e.code.replace('Digit', ''), 10);
      const weapon = WEAPON_LIST.find((w) => w.slot === slot);
      if (weapon) {
        this.equipWeapon(weapon.id);
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onWindowBlur = () => {
    this.keys.clear();
    this.mouseFireHeld = false;
    this.mouseAimHeld = false;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.screenMode !== 'playing') return;
    if (e.target !== this.renderer.domElement) return;

    this.audio.unlock();
    if (!this.pointerLocked && !this.isTouchDevice()) {
      this.requestPointerLock();
    }

    if (e.button === 0) {
      this.mouseFireHeld = true;
      this.mouseFireJustPressed = true;
    } else if (e.button === 2) {
      if (this.settings.aimMode === 'toggle') {
        this.aimToggledOn = !this.aimToggledOn;
      } else {
        this.mouseAimHeld = true;
      }
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseFireHeld = false;
    else if (e.button === 2) this.mouseAimHeld = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.screenMode !== 'playing') return;
    if (!this.pointerLocked && !this.mouseFireHeld && !this.mouseAimHeld) return;
    const isAiming = this.isCurrentlyAiming();
    this.player.applyLook(e.movementX, e.movementY, this.settings, isAiming, false);
    this.weaponSwayX = THREE.MathUtils.clamp(this.weaponSwayX - e.movementX * 0.0007, -0.035, 0.035);
    this.weaponSwayY = THREE.MathUtils.clamp(this.weaponSwayY + e.movementY * 0.0007, -0.035, 0.035);
  };

  private onWheel = (e: WheelEvent) => {
    if (this.screenMode !== 'playing') return;
    if (e.deltaY > 0) this.cycleWeapon(1);
    else if (e.deltaY < 0) this.cycleWeapon(-1);
  };

  private onContextMenu = (e: MouseEvent) => {
    if (this.screenMode === 'playing') e.preventDefault();
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHUD();
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private onContextRestored = () => {
    this.callbacks.onContextLost(false);
  };

  private resizeObserver: ResizeObserver | null = null;

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.container);
    }
    window.addEventListener('deviceorientation', this.onDeviceOrientation);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);

    this.clearRemotePlayers();
    if (this.menuHero) this.menuHero.dispose();
    this.viewModels.forEach((vm) => vm.dispose());
    this.flashlightCone.geometry.dispose();
    (this.flashlightCone.material as THREE.Material).dispose();
    this.bulletGeo.dispose();
    this.bulletMat.dispose();
    this.blood.dispose();
    this.zombies.dispose();
    this.forest.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
