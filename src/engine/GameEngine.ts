import * as THREE from 'three';
import {
  DamageNumberEvent,
  EquipmentId,
  GameOverStats,
  GameScreen,
  HUDState,
  SettingsData,
  UpgradeId,
  WeaponId,
} from '../types/game';
import { WEAPONS_BY_ID, WEAPON_LIST, getEffectiveWeaponDamage } from '../data/WeaponData';
import { ProgressionManager } from '../managers/EconomyManager';
import { AudioManager } from '../managers/AudioManager';
import { ForestTextureSet, createForestTextures } from './ProceduralTextures';
import { WeaponViewModel, createWeaponViewModel } from './WeaponModels';
import { ForestEnvironment, groundHeightAt } from './ForestEnvironment';
import { PlayerController } from './PlayerController';
import { ZombieInstance, ZombieManager } from './ZombieManager';
import { EquipmentSystem } from './EquipmentSystem';

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

interface TracerBeam {
  line: THREE.Line;
  life: number;
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
}

// Pre-allocated math helpers (zero GC in render loop)
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

  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private elapsed = 0;

  private screenMode: GameScreen = 'menu';
  private settings: SettingsData;

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
  private meleeSwingTimer = 0;
  private muzzleFlashTimer = 0;
  private muzzleLight = new THREE.PointLight(0xffb85c, 0, 12);

  // Pooled blood/impact particles & bullet tracers
  private particles: PooledParticle[] = [];
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

  // Run stats
  private kills = 0;
  private sessionCoins = 0;
  private waveBonusAccum = 0;
  private survivalTime = 0;
  private hitstopTimer = 0;
  private hitMarkerType: HUDState['hitMarkerType'] = 'none';
  private hitMarkerTimer = 0;
  private nextDamageNumId = 1;
  private hudEmitTimer = 0;
  private waveBannerTimer = 0;

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
    this.callbacks = callbacks;

    this.initThree();
    this.initParticlePool();
    this.initViewModels();
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

  private initThree(): void {
    this.isSoftwareGl = this.detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.settings.graphicsQuality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, w / h, 0.08, 220);
    this.scene.add(this.camera);

    // Mount weapon group to FPS camera
    this.camera.add(this.weaponMount);
    this.muzzleLight.position.set(0.2, -0.1, -0.7);
    this.camera.add(this.muzzleLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createForestTextures(maxAniso);
    this.forest = new ForestEnvironment(
      this.scene,
      this.renderer,
      this.textures,
      this.isSoftwareGl,
      this.settings.graphicsQuality
    );
    this.zombies = new ZombieManager(this.scene, this.forest.spawnPoints);
    this.equipment = new EquipmentSystem(this.scene, this.textures.woodAlbedo);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private initParticlePool(): void {
    const geo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    for (let i = 0; i < 90; i++) {
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

  private spawnParticles(pos: THREE.Vector3, colorHex: number, count: number, speed = 4.5): void {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = 0.28 + Math.random() * 0.25;
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
    this.tracers.push({ line, life: 0.065 });
  }

  private initViewModels(): void {
    for (const w of WEAPON_LIST) {
      const vm = createWeaponViewModel(w.id);
      vm.root.visible = false;
      this.weaponMount.add(vm.root);
      this.viewModels.set(w.id, vm);
    }
  }

  private resetAmmoPool(): void {
    const save = this.progression.getData();
    const ammoMult = 1 + (save.upgrades[UpgradeId.MAX_AMMO] ?? 0) * 0.15;
    this.ammoMap.clear();
    for (const w of WEAPON_LIST) {
      this.ammoMap.set(w.id, {
        inMag: w.magSize,
        reserve: Math.round(w.maxReserve * ammoMult),
      });
    }
  }

  startNewGame(): void {
    this.audio.unlock();
    const save = this.progression.getData();
    this.progression.resetSessionTracking();

    this.player.reset(save.upgrades);
    this.zombies.reset();
    this.equipment.reset();
    this.resetAmmoPool();

    this.kills = 0;
    this.sessionCoins = 0;
    this.waveBonusAccum = 0;
    this.survivalTime = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.hitMarkerType = 'none';
    this.hitMarkerTimer = 0;
    this.waveBannerTimer = 3.2;

    this.equipWeapon(save.equippedWeapon, false);
    this.weaponMount.visible = true;
    this.screenMode = 'playing';
    this.emitHUD();
    this.requestPointerLock();
  }

  setScreenMode(mode: GameScreen): void {
    this.screenMode = mode;
    if (mode !== 'playing') {
      this.keys.clear();
      this.mouseFireHeld = false;
      this.mouseAimHeld = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
    }
    this.weaponMount.visible = mode === 'playing' || mode === 'paused';
    this.emitHUD();
  }

  resumeGame(): void {
    this.screenMode = 'playing';
    this.weaponMount.visible = true;
    this.requestPointerLock();
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

  updateSettings(next: SettingsData): void {
    this.settings = { ...next };
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && next.graphicsQuality !== 'low';
    this.forest.applyGraphicsQuality(next.graphicsQuality, this.isSoftwareGl);
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
    if (playSound) this.audio.playUIClick();
    this.emitHUD();
  }

  syncProgressionAfterShop(): void {
    const save = this.progression.getData();
    this.player.refreshMaxHealth(save.upgrades);
    if (save.equippedWeapon !== this.currentWeaponId) {
      this.equipWeapon(save.equippedWeapon, false);
    }
    // Top up reserve cap if MAX_AMMO upgraded
    const ammoMult = 1 + (save.upgrades[UpgradeId.MAX_AMMO] ?? 0) * 0.15;
    for (const w of WEAPON_LIST) {
      const st = this.ammoMap.get(w.id);
      if (st) {
        const maxRes = Math.round(w.maxReserve * ammoMult);
        if (st.reserve < maxRes && w.id === save.equippedWeapon) {
          st.reserve = Math.max(st.reserve, Math.min(maxRes, st.reserve + w.magSize));
        }
      }
    }
    this.emitHUD();
  }

  // Mobile Controls Hooks
  setMobileInput(partial: Partial<MobileInputState>): void {
    Object.assign(this.mobileInput, partial);
  }

  triggerMobileFire(): void {
    this.mobileFireJustPressed = true;
    this.mobileInput.fireHeld = true;
  }

  triggerMobileLook(dx: number, dy: number): void {
    if (this.screenMode !== 'playing') return;
    const isAiming = this.mouseAimHeld || this.mobileInput.aim;
    this.player.applyLook(dx, dy, this.settings, isAiming, true);
  }

  triggerMobileJump(): void {
    if (this.screenMode === 'playing') {
      this.keys.add('Space_MOBILE');
      window.setTimeout(() => this.keys.delete('Space_MOBILE'), 80);
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
    if (this.screenMode !== 'playing') return;
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

  private startReload(): void {
    const spec = WEAPONS_BY_ID[this.currentWeaponId];
    if (spec.isMelee || this.isReloading) return;
    const st = this.ammoMap.get(this.currentWeaponId);
    if (!st || st.inMag >= spec.magSize || st.reserve <= 0) return;

    const reloadBonus = 1 + (this.progression.getData().upgrades[UpgradeId.RELOAD_SPEED] ?? 0) * 0.07;
    this.reloadDuration = Math.max(0.45, spec.reloadTime / reloadBonus);
    this.reloadTimer = this.reloadDuration;
    this.isReloading = true;
    this.audio.playReload();
  }

  private completeReload(): void {
    const spec = WEAPONS_BY_ID[this.currentWeaponId];
    const st = this.ammoMap.get(this.currentWeaponId);
    if (!st) return;
    const needed = spec.magSize - st.inMag;
    const loaded = Math.min(needed, st.reserve);
    st.inMag += loaded;
    st.reserve -= loaded;
    this.isReloading = false;
    this.reloadTimer = 0;
  }

  private tryInteractPickup(): void {
    for (let i = this.zombies.lootDrops.length - 1; i >= 0; i--) {
      const drop = this.zombies.lootDrops[i];
      if (drop.position.distanceTo(this.player.position) <= 3.0) {
        this.collectDrop(drop, i);
        break;
      }
    }
  }

  private collectDrop(drop: { kind: 'coins' | EquipmentId; amount: number; mesh: THREE.Group }, index: number): void {
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
      if (st.reserve > 0) {
        this.startReload();
      } else {
        this.fireCooldown = 0.25;
        this.audio.playUIClick();
        this.callbacks.onToast('No ammunition remaining!', true);
      }
      return;
    }

    st.inMag--;
    this.fireCooldown = 1 / effectiveRate;
    this.performFirearmShot();

    if (st.inMag === 0 && st.reserve > 0) {
      this.startReload();
    }
  }

  private performMeleeAttack(): void {
    const spec = WEAPONS_BY_ID[WeaponId.KATANA];
    const save = this.progression.getData();
    const weaponLvl = save.weaponLevels[WeaponId.KATANA] ?? 1;
    const dmgUpgrade = save.upgrades[UpgradeId.WEAPON_DAMAGE] ?? 0;
    const damage = getEffectiveWeaponDamage(spec, weaponLvl, dmgUpgrade);

    this.meleeSwingTimer = 0.28;
    this.audio.playWeaponFire(WeaponId.KATANA);

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
        this.spawnParticles(hitPos, 0x991b1b, 7, 4.2);
        this.emitDamageNumber(hitPos, damage, false);

        const killed = this.zombies.damageZombie(z, damage, (deadZ) => {
          this.handleZombieKilled(deadZ);
          killedAny = true;
        });
        if (killed) killedAny = true;
      }
    }

    if (hitAny) {
      this.audio.playMeleeHit();
      this.hitstopTimer = 0.045; // Crisp 45ms melee impact hitstop
      this.player.addShake(0.035);
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

    this.audio.playWeaponFire(this.currentWeaponId);
    this.player.addRecoil(spec.recoil, accUpgrade);
    this.recoilOffsetZ = Math.min(0.11, this.recoilOffsetZ + 0.065);

    const vm = this.viewModels.get(this.currentWeaponId);
    if (vm) {
      vm.muzzleFlash.visible = true;
      vm.muzzleFlash.rotation.z = Math.random() * Math.PI;
      this.muzzleFlashTimer = 0.045;
      this.muzzleLight.intensity = 6.5;
      vm.muzzlePoint.getWorldPosition(_v3C);
    } else {
      _v3C.copy(this.camera.position);
    }

    const isAiming = this.mouseAimHeld || this.mobileInput.aim;
    const accFactor = Math.max(0.4, 1 - accUpgrade * 0.07);
    const movePenalty = this.player.isMoving ? 1.45 : 1.0;
    const spread = spec.spreadRad * accFactor * movePenalty * (isAiming ? 0.35 : 1.0);

    let hitSomething = false;
    let hitHead = false;
    let killedSomething = false;

    const allTargets = [...this.zombies.raycastTargets, ...this.forest.bulletBlockMeshes];

    for (let p = 0; p < spec.pellets; p++) {
      this.camera.getWorldDirection(_v3A);
      _v3A.x += (Math.random() - 0.5) * spread * 2;
      _v3A.y += (Math.random() - 0.5) * spread * 2;
      _v3A.z += (Math.random() - 0.5) * spread * 2;
      _v3A.normalize();

      this.raycaster.set(this.camera.position, _v3A);
      this.raycaster.near = 0.1;
      this.raycaster.far = spec.range;

      const hits = this.raycaster.intersectObjects(allTargets, true);
      let endPoint = this.camera.position.clone().addScaledVector(_v3A, Math.min(spec.range, 55));

      let piercedZombies = 0;
      const hitZombieIds = new Set<number>();

      for (const hit of hits) {
        const zId = hit.object.userData.zombieId as number | undefined;
        if (zId === undefined) {
          // Hit solid tree, rock, or cabin wall — STOP bullet immediately (cannot shoot through walls!)
          endPoint = hit.point;
          this.spawnParticles(hit.point, 0xcbd5e1, 3, 2.5);
          break;
        }

        if (hitZombieIds.has(zId)) continue;
        const zombie = this.zombies.getZombieById(zId);
        if (!zombie || zombie.state === 'dead') continue;

        hitZombieIds.add(zId);
        const isHeadshot = Boolean(hit.object.userData.isHead);
        const dmg = isHeadshot ? Math.round(baseDmg * 1.75) : baseDmg;

        hitSomething = true;
        if (isHeadshot) hitHead = true;
        endPoint = hit.point;

        this.spawnParticles(hit.point, isHeadshot ? 0xdc2626 : 0x881313, isHeadshot ? 8 : 5, 4.5);
        this.emitDamageNumber(hit.point, dmg, isHeadshot);

        const killed = this.zombies.damageZombie(zombie, dmg, (deadZ) => {
          this.handleZombieKilled(deadZ);
          killedSomething = true;
        });
        if (killed) killedSomething = true;

        piercedZombies++;
        if (piercedZombies >= spec.penetration) break;
      }

      if (p === 0 || spec.pellets > 1) {
        this.spawnTracer(_v3C, endPoint);
      }
    }

    if (hitSomething) {
      this.audio.playHit(hitHead);
      this.triggerHitMarker(killedSomething ? 'kill' : hitHead ? 'headshot' : 'normal');
    }
  }

  private handleZombieKilled(z: ZombieInstance): void {
    this.kills++;
    const rewarded = this.progression.rewardZombieKill(z.id, z.coinReward);
    if (rewarded) {
      this.sessionCoins += z.coinReward;
    }
  }

  private triggerHitMarker(type: HUDState['hitMarkerType']): void {
    this.hitMarkerType = type;
    this.hitMarkerTimer = 0.16;
  }

  private emitDamageNumber(worldPos: THREE.Vector3, amount: number, headshot: boolean): void {
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

    const isAiming = this.mouseAimHeld || this.mobileInput.aim;
    const isKatana = this.currentWeaponId === WeaponId.KATANA;

    const targetX = isAiming && !isKatana ? 0.0 : isKatana ? 0.28 : 0.23;
    const targetY =
      (isAiming && !isKatana ? -0.15 : isKatana ? -0.24 : -0.21) -
      (this.switchAnimTimer / 0.24) * 0.22 -
      (this.isReloading ? Math.sin((this.reloadTimer / this.reloadDuration) * Math.PI) * 0.14 : 0);
    const targetZ = (isAiming && !isKatana ? -0.34 : -0.44) + this.recoilOffsetZ;

    // Walk sway
    const swayAmt = this.player.isMoving ? (this.player.isSprinting ? 0.018 : 0.009) : 0.002;
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

  private emitHUD(): void {
    const save = this.progression.getData();
    const spec = WEAPONS_BY_ID[this.currentWeaponId];
    const ammo = this.ammoMap.get(this.currentWeaponId) ?? { inMag: 0, reserve: 0 };
    const isAiming = this.mouseAimHeld || this.mobileInput.aim;

    // Check nearby loot drop prompt
    let interactPrompt: string | null = null;
    for (const drop of this.zombies.lootDrops) {
      if (drop.position.distanceTo(this.player.position) <= 3.0) {
        interactPrompt =
          drop.kind === 'coins'
            ? `[E] Collect ${drop.amount} Coins`
            : `[E] Pick up ${drop.kind.replace('_', ' ')}`;
        break;
      }
    }

    const spreadPx = spec.isMelee
      ? 10
      : Math.round(
          (spec.spreadRad * 420 + (this.player.isMoving ? 10 : 0) + this.recoilOffsetZ * 160) *
            (isAiming ? 0.4 : 1)
        );

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
      magSize: spec.magSize,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading
        ? Math.min(1, 1 - this.reloadTimer / this.reloadDuration)
        : 0,
      isAiming,
      isCrouching: this.player.isCrouching,
      crosshairSpread: Math.max(6, spreadPx),
      coins: save.coins,
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
      adrenalineTimer: this.player.adrenalineTimer,
      inventory: { ...save.inventory },
      unlockedWeapons: [...save.unlockedWeapons],
      activeTurrets: this.equipment.turrets.length,
      activeBarricades: this.equipment.barricades.length,
      waveBanner: this.waveBannerTimer > 0 ? this.zombies.waveBanner : null,
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
      const rawDt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      this.elapsed += dt;

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
    this.forest.update(dt, this.elapsed);

    if (this.screenMode === 'menu' || this.screenMode === 'loading') {
      // Subtle cinematic camera pan through the dark moonlit forest
      const panAngle = this.elapsed * 0.09;
      const camX = Math.sin(panAngle) * 16;
      const camZ = Math.cos(panAngle) * 16;
      const camY = groundHeightAt(camX, camZ) + 4.4 + Math.sin(this.elapsed * 0.3) * 0.4;
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(-4, groundHeightAt(-4, -4) + 1.5, -4);
      this.weaponMount.visible = false;
      return;
    }

    if (this.screenMode !== 'playing') {
      return;
    }

    // Brief hitstop on heavy melee impact
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

    // Gather unified desktop + mobile movement input
    const kbX = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const kbZ = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const inputX = THREE.MathUtils.clamp(kbX + this.mobileInput.moveX, -1, 1);
    const inputZ = THREE.MathUtils.clamp(kbZ + this.mobileInput.moveZ, -1, 1);

    const wantJump = this.keys.has('Space') || this.keys.has('Space_MOBILE');
    const wantSprint =
      this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.mobileInput.sprint;
    const wantCrouch = this.keys.has('KeyC') || this.mobileInput.crouch;
    const isAiming = this.mouseAimHeld || this.mobileInput.aim;

    const save = this.progression.getData();
    const spec = WEAPONS_BY_ID[this.currentWeaponId];

    this.player.update(
      dt,
      inputX,
      inputZ,
      wantJump,
      wantSprint,
      wantCrouch,
      isAiming,
      spec.adsFov,
      save.upgrades,
      this.forest.obstacles,
      this.equipment.barricades,
      this.camera,
      (sprinting) => this.audio.playFootstep(sprinting)
    );

    // Auto-collect nearby coins on walk-over
    for (let i = this.zombies.lootDrops.length - 1; i >= 0; i--) {
      const drop = this.zombies.lootDrops[i];
      if (drop.kind === 'coins' && drop.position.distanceTo(this.player.position) <= 1.7) {
        this.collectDrop(drop, i);
      }
    }

    this.handleCombatInput(dt);
    this.animateWeaponViewModel(dt);

    // Update zombies & wave progression
    this.zombies.update(
      dt,
      this.player.position,
      this.forest.obstacles,
      this.equipment.barricades,
      (dmg) => {
        this.player.takeDamage(dmg, this.progression.getData().upgrades);
        this.audio.playZombieAttack();
        this.audio.playPlayerHurt();
        if (this.player.health <= 0) {
          this.handlePlayerDeath();
        }
      },
      (waveCompleted, bonusCoins) => {
        this.progression.addCoins(bonusCoins);
        this.sessionCoins += bonusCoins;
        this.waveBonusAccum += bonusCoins;
        this.waveBannerTimer = 3.2;
        this.audio.playPurchase(true);
        this.callbacks.onToast(`Wave ${waveCompleted} Cleared! +${bonusCoins} Coins`);
      },
      () => {
        this.waveBannerTimer = 3.2;
        this.audio.playWaveBanner();
      }
    );

    // Update Grenades, Barricades, Robot Turrets
    this.equipment.update(
      dt,
      this.zombies,
      (origin) => {
        this.audio.playExplosion();
        const dist = origin.distanceTo(this.player.position);
        if (dist < 16) {
          this.player.addShake(0.11 * (1 - dist / 16));
        }
      },
      (from, to) => {
        this.spawnTracer(from, to, 0xff5a36);
        this.audio.playWeaponFire(WeaponId.M4);
      },
      (deadZ) => this.handleZombieKilled(deadZ)
    );

    // Update pooled particles & tracers
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        (tr.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Throttle React HUD updates (~24Hz) for butter-smooth FPS
    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.042) {
      this.hudEmitTimer = 0;
      this.emitHUD();
    }
  }

  private handlePlayerDeath(): void {
    this.screenMode = 'gameover';
    this.audio.playGameOver();
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }

    const isNewRecord = this.progression.recordRunEnd(this.zombies.wave, this.survivalTime);
    const save = this.progression.getData();

    this.callbacks.onGameOver({
      finalWave: this.zombies.wave,
      highestWave: save.highestWave,
      kills: this.kills,
      coinsEarned: this.sessionCoins,
      survivalTime: this.survivalTime,
      waveBonusCoins: this.waveBonusAccum,
      isNewRecord,
    });
  }

  // Event listeners
  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
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
    // Ignore clicks on UI buttons layered over canvas
    if (e.target !== this.renderer.domElement) return;

    this.audio.unlock();
    if (!this.pointerLocked && !this.isTouchDevice()) {
      this.requestPointerLock();
    }

    if (e.button === 0) {
      this.mouseFireHeld = true;
      this.mouseFireJustPressed = true;
    } else if (e.button === 2) {
      this.mouseAimHeld = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseFireHeld = false;
    else if (e.button === 2) this.mouseAimHeld = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.screenMode !== 'playing') return;
    if (!this.pointerLocked && !this.mouseFireHeld && !this.mouseAimHeld) return;
    const isAiming = this.mouseAimHeld || this.mobileInput.aim;
    this.player.applyLook(e.movementX, e.movementY, this.settings, isAiming, false);
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

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
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

    window.removeEventListener('resize', this.onResize);
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

    this.viewModels.forEach((vm) => vm.dispose());
    this.zombies.dispose();
    this.forest.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
