import * as THREE from 'three';
import {
  EquipmentId,
  ServerZombieSnapshot,
  SettingsData,
  ZombieType,
} from '../types/game';
import { ZOMBIE_CONFIGS, getWaveZombieCount } from '../data/GameData';
import { ARENA_RADIUS, ObstacleCollider, groundHeightAt } from './ForestEnvironment';
import { ForestTextureSet } from './ProceduralTextures';

export interface ZombieInstance {
  id: number;
  type: ZombieType;
  label: string;
  root: THREE.Group;
  lod: THREE.LOD;
  highGroup: THREE.Group;
  lowGroup: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  hitMeshes: THREE.Mesh[];
  position: THREE.Vector3;
  targetPos: THREE.Vector3;
  targetYaw: number;
  knockbackVel: THREE.Vector3;
  yaw: number;
  health: number;
  maxHealth: number;
  speed: number;
  runSpeed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  attackAnimTimer: number;
  hitFlashTimer: number;
  staggerTimer: number;
  recoveryTimer: number;
  vocalTimer: number;
  state: 'idle' | 'walk' | 'run' | 'attack' | 'dead';
  deathTimer: number;
  deathDir: number;
  coinReward: number;
  xpReward: number;
  radius: number;
  scale: number;
  animPhase: number;
  aiThrottleAccum: number;
  rewarded: boolean;
}

export interface LootDrop {
  id: number;
  kind: 'coins' | EquipmentId;
  amount: number;
  mesh: THREE.Group;
  position: THREE.Vector3;
  life: number;
}

export interface BarricadeTarget {
  id: number;
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  health: number;
  damage: (amt: number) => void;
}

export class ZombieManager {
  readonly zombies: ZombieInstance[] = [];
  readonly lootDrops: LootDrop[] = [];
  readonly raycastTargets: THREE.Object3D[] = [];

  wave = 1;
  waveState: 'countdown' | 'active' | 'cleared' = 'countdown';
  waveCountdown = 4.0;
  waveTotalZombies = 20;
  zombiesSpawnedThisWave = 0;
  zombiesRemaining = 20;
  waveBanner: string | null = null;
  localSpawnPaused = false;

  private spawnTimer = 0;
  private nextId = 1;
  private nextLootId = 1;
  private scene: THREE.Scene;
  private spawnPoints: THREE.Vector3[];
  private textures: ForestTextureSet;

  private torsoGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.64, 10);
  private pelvisGeo = new THREE.CylinderGeometry(0.19, 0.17, 0.2, 8);
  private limbUpperGeo = new THREE.CapsuleGeometry(0.075, 0.34, 4, 8);
  private limbLowerGeo = new THREE.CapsuleGeometry(0.062, 0.34, 4, 8);
  private skullGeo = new THREE.SphereGeometry(0.18, 12, 10);
  private jawGeo = new THREE.BoxGeometry(0.16, 0.11, 0.16);
  private eyeGeo = new THREE.SphereGeometry(0.03, 6, 6);
  private shoulderGeo = new THREE.SphereGeometry(0.125, 8, 8);
  private lowBodyGeo = new THREE.CapsuleGeometry(0.26, 1.05, 3, 6);
  private lowHeadGeo = new THREE.SphereGeometry(0.18, 6, 6);
  private shadowGeo = new THREE.PlaneGeometry(1.3, 1.3);
  private coinGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12);
  private crateGeo = new THREE.BoxGeometry(0.42, 0.34, 0.42);

  constructor(scene: THREE.Scene, spawnPoints: THREE.Vector3[], textures: ForestTextureSet) {
    this.scene = scene;
    this.spawnPoints = spawnPoints;
    this.textures = textures;
    this.shadowGeo.rotateX(-Math.PI / 2);
  }

  reset(pauseLocalSpawns = false): void {
    this.localSpawnPaused = pauseLocalSpawns;
    for (const z of this.zombies) {
      this.scene.remove(z.root);
      this.disposeZombieMaterials(z);
    }
    this.zombies.length = 0;
    this.raycastTargets.length = 0;

    for (const d of this.lootDrops) {
      this.scene.remove(d.mesh);
    }
    this.lootDrops.length = 0;

    this.wave = 1;
    this.startWavePrep(1, 3.5);
  }

  private startWavePrep(waveNum: number, delay: number): void {
    this.wave = waveNum;
    this.waveState = 'countdown';
    this.waveCountdown = delay;
    this.waveTotalZombies = getWaveZombieCount(waveNum);
    this.zombiesRemaining = this.waveTotalZombies;
    this.zombiesSpawnedThisWave = 0;
    this.waveBanner = `WAVE ${waveNum} INCOMING`;
  }

  private chooseZombieType(wave: number): ZombieType {
    if (wave % 5 === 0 && this.zombiesSpawnedThisWave === 0) {
      return ZombieType.BOSS;
    }
    const r = Math.random();
    if (wave === 1) {
      return r < 0.72 ? ZombieType.NORMAL : ZombieType.FEMALE;
    }
    if (wave === 2) {
      if (r < 0.55) return ZombieType.NORMAL;
      if (r < 0.8) return ZombieType.FEMALE;
      return ZombieType.FAST;
    }
    if (wave === 3) {
      if (r < 0.42) return ZombieType.NORMAL;
      if (r < 0.66) return ZombieType.FEMALE;
      if (r < 0.9) return ZombieType.FAST;
      return ZombieType.TANK;
    }
    if (r < 0.32) return ZombieType.NORMAL;
    if (r < 0.55) return ZombieType.FEMALE;
    if (r < 0.82) return ZombieType.FAST;
    return ZombieType.TANK;
  }

  private buildZombieMesh(
    type: ZombieType,
    id: number,
    lodDistanceScale = 1.0
  ): Pick<
    ZombieInstance,
    | 'id'
    | 'type'
    | 'label'
    | 'root'
    | 'lod'
    | 'highGroup'
    | 'lowGroup'
    | 'torso'
    | 'head'
    | 'leftArm'
    | 'rightArm'
    | 'leftLeg'
    | 'rightLeg'
    | 'hitMeshes'
  > {
    const cfg = ZOMBIE_CONFIGS[type];
    const root = new THREE.Group();
    const lod = new THREE.LOD();
    const highGroup = new THREE.Group();
    const lowGroup = new THREE.Group();
    const hitMeshes: THREE.Mesh[] = [];

    const skinMat = new THREE.MeshStandardMaterial({
      color: cfg.bodyColor,
      bumpMap: this.textures.zombieSkinBump,
      bumpScale: 0.08,
      roughness: 0.72,
      metalness: 0.04,
    });
    const clothMat = new THREE.MeshStandardMaterial({
      color: cfg.clothColor,
      roughness: 0.88,
      metalness: 0.05,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x16181c,
      roughness: 0.85,
    });
    const bloodMat = new THREE.MeshStandardMaterial({
      color: 0x6b1111,
      roughness: 0.32,
      metalness: 0.1,
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: cfg.eyeColor });
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.contactShadow,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    const contactShadow = new THREE.Mesh(this.shadowGeo, shadowMat);
    contactShadow.position.y = 0.025;
    root.add(contactShadow);

    const registerHitMesh = (m: THREE.Mesh, isHead: boolean) => {
      m.userData.zombieId = id;
      m.userData.isHead = isHead;
      m.castShadow = true;
      m.receiveShadow = true;
      hitMeshes.push(m);
      this.raycastTargets.push(m);
    };

    const widthScale =
      type === ZombieType.TANK || type === ZombieType.BOSS
        ? 1.32
        : type === ZombieType.FEMALE
        ? 0.82
        : type === ZombieType.FAST
        ? 0.9
        : 1.0;

    const hipSpread = 0.125 * widthScale;
    const buildLeg = (xOffset: number) => {
      const leg = new THREE.Group();
      leg.position.set(xOffset, 0.9, 0);
      const thigh = new THREE.Mesh(this.limbUpperGeo, darkMat);
      thigh.position.y = -0.22;
      registerHitMesh(thigh, false);
      leg.add(thigh);

      const shin = new THREE.Mesh(this.limbLowerGeo, skinMat);
      shin.position.y = -0.6;
      registerHitMesh(shin, false);
      leg.add(shin);

      const foot = new THREE.Mesh(this.jawGeo, darkMat);
      foot.scale.set(0.7, 0.6, 1.35);
      foot.position.set(0, -0.84, 0.05);
      leg.add(foot);
      highGroup.add(leg);
      return leg;
    };

    const leftLeg = buildLeg(-hipSpread);
    const rightLeg = buildLeg(hipSpread);

    const pelvis = new THREE.Mesh(this.pelvisGeo, darkMat);
    pelvis.scale.set(widthScale, 1, 0.85);
    pelvis.position.y = 0.9;
    highGroup.add(pelvis);

    const torso = new THREE.Group();
    torso.position.set(0, 0.96, 0);
    highGroup.add(torso);

    const chest = new THREE.Mesh(this.torsoGeo, clothMat);
    chest.scale.set(widthScale, 1, widthScale * 0.76);
    chest.position.y = 0.33;
    registerHitMesh(chest, false);
    torso.add(chest);

    // Tattered jacket lapels & ribs laceration detail
    const wound = new THREE.Mesh(this.jawGeo, bloodMat);
    wound.scale.set(1.05 * widthScale, 1.5, 0.42);
    wound.position.set(0.03, 0.36, 0.15 * widthScale);
    torso.add(wound);

    if (type === ZombieType.BOSS || type === ZombieType.TANK) {
      [-1, 1].forEach((side) => {
        const hump = new THREE.Mesh(this.shoulderGeo, skinMat);
        hump.scale.set(1.28, 1.15, 1.25);
        hump.position.set(side * 0.28 * widthScale, 0.6, 0.02);
        registerHitMesh(hump, false);
        torso.add(hump);
      });
    }

    const neck = new THREE.Mesh(this.limbLowerGeo, skinMat);
    neck.scale.set(0.85, 0.25, 0.85);
    neck.position.set(0, 0.67, 0.02);
    torso.add(neck);

    const head = new THREE.Group();
    head.position.set(0, 0.72, 0.04);
    torso.add(head);

    const skull = new THREE.Mesh(this.skullGeo, skinMat);
    skull.scale.set(0.92, 1.14, 1.0);
    skull.position.y = 0.19;
    registerHitMesh(skull, true);
    head.add(skull);

    const jaw = new THREE.Mesh(this.jawGeo, skinMat);
    jaw.position.set(0, 0.05, 0.08);
    registerHitMesh(jaw, true);
    head.add(jaw);

    const mouth = new THREE.Mesh(this.jawGeo, bloodMat);
    mouth.scale.set(0.68, 0.34, 0.3);
    mouth.position.set(0, 0.1, 0.15);
    head.add(mouth);

    [-0.068, 0.068].forEach((ex) => {
      const eye = new THREE.Mesh(this.eyeGeo, eyeMat);
      eye.position.set(ex, 0.22, 0.16);
      head.add(eye);
    });

    if (type === ZombieType.FEMALE) {
      const hair = new THREE.Mesh(this.skullGeo, darkMat);
      hair.scale.set(1.06, 1.5, 0.96);
      hair.position.set(0, 0.16, -0.06);
      head.add(hair);
    } else if (type === ZombieType.BOSS) {
      [-0.13, 0.13].forEach((hx) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 6), darkMat);
        horn.position.set(hx, 0.42, 0);
        horn.rotation.z = -hx * 1.4;
        head.add(horn);
      });
    }

    const shoulderX = 0.24 * widthScale + 0.06;
    const buildArm = (xOffset: number) => {
      const arm = new THREE.Group();
      arm.position.set(xOffset, 0.6, 0);

      const shoulder = new THREE.Mesh(this.shoulderGeo, clothMat);
      shoulder.scale.setScalar(0.68);
      arm.add(shoulder);

      const upper = new THREE.Mesh(this.limbUpperGeo, skinMat);
      upper.scale.set(0.75, 0.85, 0.75);
      upper.position.y = -0.2;
      registerHitMesh(upper, false);
      arm.add(upper);

      const forearm = new THREE.Mesh(this.limbLowerGeo, skinMat);
      forearm.scale.set(0.72, 0.88, 0.72);
      forearm.position.set(0, -0.48, 0.08);
      forearm.rotation.x = -0.35;
      registerHitMesh(forearm, false);
      arm.add(forearm);

      const claw = new THREE.Mesh(this.jawGeo, bloodMat);
      claw.scale.set(0.36, 0.52, 0.52);
      claw.position.set(0, -0.68, 0.15);
      arm.add(claw);

      torso.add(arm);
      return arm;
    };

    const leftArm = buildArm(-shoulderX);
    const rightArm = buildArm(shoulderX);

    // Low-detail LOD silhouette (for > 24m)
    const lowBody = new THREE.Mesh(this.lowBodyGeo, clothMat);
    lowBody.position.y = 0.95;
    lowBody.scale.set(widthScale, 1, widthScale * 0.85);
    lowGroup.add(lowBody);

    const lowHead = new THREE.Mesh(this.lowHeadGeo, skinMat);
    lowHead.position.y = 1.72;
    lowGroup.add(lowHead);

    lod.addLevel(highGroup, 0);
    lod.addLevel(lowGroup, 24 * lodDistanceScale);
    root.add(lod);

    root.scale.setScalar(cfg.scale);

    return {
      id,
      type,
      label: cfg.label,
      root,
      lod,
      highGroup,
      lowGroup,
      torso,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      hitMeshes,
    };
  }

  private createZombieRecord(
    id: number,
    type: ZombieType,
    sx: number,
    sy: number,
    sz: number,
    lodDistanceScale = 1.0
  ): ZombieInstance {
    const cfg = ZOMBIE_CONFIGS[type];
    const waveHpScale = 1 + (this.wave - 1) * 0.18;
    const waveDmgScale = 1 + (this.wave - 1) * 0.09;
    const waveSpdScale = 1 + Math.min(0.45, (this.wave - 1) * 0.035);

    const parts = this.buildZombieMesh(type, id, lodDistanceScale);
    parts.root.position.set(sx, sy, sz);
    this.scene.add(parts.root);

    const z: ZombieInstance = {
      ...parts,
      position: new THREE.Vector3(sx, sy, sz),
      targetPos: new THREE.Vector3(sx, sy, sz),
      targetYaw: 0,
      knockbackVel: new THREE.Vector3(),
      yaw: 0,
      health: Math.round(cfg.baseHealth * waveHpScale),
      maxHealth: Math.round(cfg.baseHealth * waveHpScale),
      speed: cfg.baseSpeed * waveSpdScale,
      runSpeed: cfg.runSpeed * waveSpdScale,
      damage: Math.round(cfg.baseDamage * waveDmgScale),
      attackRange: cfg.attackRange,
      attackCooldown: cfg.attackCooldown,
      attackTimer: 0.4,
      attackAnimTimer: 0,
      hitFlashTimer: 0,
      staggerTimer: 0,
      recoveryTimer: 0,
      vocalTimer: 1.5 + Math.random() * 5.0,
      state: 'walk',
      deathTimer: 0,
      deathDir: -1,
      coinReward: cfg.coinReward + (this.wave - 1) * 2,
      xpReward: cfg.xpReward,
      radius: 0.48 * cfg.scale,
      scale: cfg.scale,
      animPhase: Math.random() * Math.PI * 2,
      aiThrottleAccum: 0,
      rewarded: false,
    };
    this.zombies.push(z);
    return z;
  }

  private spawnZombie(type: ZombieType, playerPos: THREE.Vector3, lodDist: number): void {
    let chosen = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
    for (let tries = 0; tries < 6; tries++) {
      const candidate = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
      if (candidate.distanceToSquared(playerPos) > 22 * 22) {
        chosen = candidate;
        break;
      }
    }

    const jitterX = (Math.random() - 0.5) * 4;
    const jitterZ = (Math.random() - 0.5) * 4;
    const sx = THREE.MathUtils.clamp(chosen.x + jitterX, -ARENA_RADIUS + 3, ARENA_RADIUS - 3);
    const sz = THREE.MathUtils.clamp(chosen.z + jitterZ, -ARENA_RADIUS + 3, ARENA_RADIUS - 3);
    const sy = groundHeightAt(sx, sz);

    const id = this.nextId++;
    this.createZombieRecord(id, type, sx, sy, sz, lodDist);
  }

  getZombieById(id: number): ZombieInstance | undefined {
    return this.zombies.find((z) => z.id === id);
  }

  damageZombie(
    z: ZombieInstance,
    amount: number,
    onKill: (z: ZombieInstance) => void,
    impulseDir?: THREE.Vector3,
    knockbackForce = 0
  ): boolean {
    if (z.state === 'dead') return false;
    z.health -= amount;
    z.hitFlashTimer = 0.12;
    z.staggerTimer = Math.min(0.24, 0.08 + knockbackForce * 0.015);
    z.recoveryTimer = 0.32;

    if (impulseDir && knockbackForce > 0) {
      const massFactor = z.type === ZombieType.TANK || z.type === ZombieType.BOSS ? 0.35 : 1.0;
      z.knockbackVel.addScaledVector(impulseDir, knockbackForce * massFactor);
      z.knockbackVel.y = 0;
    }

    z.hitMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x661111);
    });

    if (z.health <= 0) {
      z.health = 0;
      z.state = 'dead';
      z.deathTimer = 0;
      z.deathDir = -1;
      for (const hm of z.hitMeshes) {
        const idx = this.raycastTargets.indexOf(hm);
        if (idx !== -1) this.raycastTargets.splice(idx, 1);
      }
      this.zombiesRemaining = Math.max(0, this.zombiesRemaining - 1);
      if (!this.localSpawnPaused) {
        this.maybeDropLoot(z.position);
      }
      onKill(z);
      return true;
    }
    return false;
  }

  applyLocalVisualHit(z: ZombieInstance): void {
    z.hitFlashTimer = 0.1;
    z.staggerTimer = 0.14;
    z.hitMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x661111);
    });
  }

  private maybeDropLoot(pos: THREE.Vector3): void {
    const r = Math.random();
    if (r > 0.26) return;

    const group = new THREE.Group();
    let kind: LootDrop['kind'] = 'coins';
    let amount = 25;

    if (r < 0.14) {
      kind = 'coins';
      amount = 20 + this.wave * 5;
      const coin = new THREE.Mesh(
        this.coinGeo,
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0x78350f,
          metalness: 0.85,
          roughness: 0.25,
        })
      );
      coin.position.y = 0.42;
      coin.rotation.x = Math.PI / 2;
      group.add(coin);
    } else if (r < 0.21) {
      kind = EquipmentId.AMMO_CRATE;
      amount = 1;
      const box = new THREE.Mesh(
        this.crateGeo,
        new THREE.MeshStandardMaterial({
          color: 0x3b6e3b,
          emissive: 0x122b12,
          roughness: 0.6,
        })
      );
      box.position.y = 0.36;
      group.add(box);
    } else {
      kind = EquipmentId.MEDKIT;
      amount = 1;
      const box = new THREE.Mesh(
        this.crateGeo,
        new THREE.MeshStandardMaterial({
          color: 0xdc2626,
          emissive: 0x450a0a,
          roughness: 0.5,
        })
      );
      box.position.y = 0.36;
      group.add(box);
    }

    const gy = groundHeightAt(pos.x, pos.z);
    group.position.set(pos.x, gy, pos.z);
    this.scene.add(group);
    this.lootDrops.push({
      id: this.nextLootId++,
      kind,
      amount,
      mesh: group,
      position: new THREE.Vector3(pos.x, gy, pos.z),
      life: 24,
    });
  }

  /**
   * Authoritative Multiplayer Snapshot Sync
   */
  syncFromServerSnapshots(
    snapshots: ServerZombieSnapshot[],
    wave: number,
    waveState: 'countdown' | 'active' | 'cleared',
    waveCountdown: number,
    zombiesRemaining: number,
    waveTotalZombies: number,
    lodDistanceScale: number
  ): void {
    this.wave = wave;
    this.waveState = waveState;
    this.waveCountdown = waveCountdown;
    this.zombiesRemaining = zombiesRemaining;
    this.waveTotalZombies = waveTotalZombies;

    const seenIds = new Set<number>();
    for (const snap of snapshots) {
      seenIds.add(snap.id);
      let z = this.getZombieById(snap.id);
      if (!z && snap.state !== 'dead') {
        z = this.createZombieRecord(
          snap.id,
          snap.type,
          snap.x,
          snap.y,
          snap.z,
          lodDistanceScale
        );
      }
      if (!z) continue;

      z.targetPos.set(snap.x, snap.y, snap.z);
      z.targetYaw = snap.yaw;
      z.health = snap.health;
      z.maxHealth = snap.maxHealth;

      if (snap.state === 'dead' && z.state !== 'dead') {
        z.state = 'dead';
        z.deathTimer = 0;
        for (const hm of z.hitMeshes) {
          const idx = this.raycastTargets.indexOf(hm);
          if (idx !== -1) this.raycastTargets.splice(idx, 1);
        }
      } else if (snap.state !== 'dead') {
        if (snap.state === 'attack' && z.state !== 'attack') {
          z.attackAnimTimer = 0.35;
        }
        z.state = snap.state;
      }
    }

    // Cleanup zombies missing from server snapshot
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (!seenIds.has(z.id) && z.state !== 'dead') {
        z.state = 'dead';
        z.deathTimer = 2.0;
        for (const hm of z.hitMeshes) {
          const idx = this.raycastTargets.indexOf(hm);
          if (idx !== -1) this.raycastTargets.splice(idx, 1);
        }
      }
    }
  }

  updateMultiplayerVisuals(
    dt: number,
    camera: THREE.PerspectiveCamera,
    settings: SettingsData
  ): void {
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];

      if (z.hitFlashTimer > 0) {
        z.hitFlashTimer -= dt;
        if (z.hitFlashTimer <= 0) {
          z.hitMeshes.forEach((m) => {
            (m.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
          });
        }
      }
      if (z.staggerTimer > 0) z.staggerTimer -= dt;

      if (z.state === 'dead') {
        z.deathTimer += dt;
        const fallAlpha = Math.min(1, z.deathTimer / 0.4);
        z.root.rotation.x = z.deathDir * fallAlpha * (Math.PI * 0.48);
        if (z.deathTimer > 2.0) z.root.position.y -= dt * 0.7;
        if (z.deathTimer > 3.2) {
          this.scene.remove(z.root);
          this.disposeZombieMaterials(z);
          this.zombies.splice(i, 1);
        }
        continue;
      }

      z.position.lerp(z.targetPos, Math.min(1, dt * 14));
      z.root.position.copy(z.position);

      let diff = z.targetYaw - z.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      z.yaw += diff * Math.min(1, dt * 12);
      z.root.rotation.y = z.yaw;

      const distCam = z.position.distanceTo(camera.position);
      z.root.visible = distCam <= settings.renderDistance;
      if (z.root.visible) {
        z.lod.levels[1].distance = 24 * settings.lodDistance;
        z.lod.update(camera);
        this.animateZombie(z, dt);
      }
    }
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    settings: SettingsData,
    obstacles: ObstacleCollider[],
    barricades: BarricadeTarget[],
    onPlayerHit: (damage: number, attackerPos: THREE.Vector3) => void,
    onWaveCleared: (waveCompleted: number, bonusCoins: number) => void,
    onWaveStarted: (wave: number) => void,
    onZombieVocal?: (type: ZombieType, dist: number) => void
  ): void {
    if (this.localSpawnPaused) {
      this.updateMultiplayerVisuals(dt, camera, settings);
      return;
    }

    if (this.waveState === 'countdown') {
      this.waveCountdown -= dt;
      if (this.waveCountdown <= 0) {
        this.waveState = 'active';
        this.waveBanner = this.wave % 5 === 0 ? `BOSS WAVE ${this.wave}` : `WAVE ${this.wave}`;
        onWaveStarted(this.wave);
      }
    } else if (this.waveState === 'active') {
      const livingCount = this.zombies.filter((z) => z.state !== 'dead').length;
      const maxSimultaneous =
        settings.graphicsQuality === 'low'
          ? Math.min(14, 7 + this.wave)
          : Math.min(24, 10 + this.wave * 2);

      if (this.zombiesSpawnedThisWave < this.waveTotalZombies && livingCount < maxSimultaneous) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          const type = this.chooseZombieType(this.wave);
          this.spawnZombie(type, playerPos, settings.lodDistance);
          this.zombiesSpawnedThisWave++;
          const baseInterval = Math.max(0.28, 1.15 - this.wave * 0.08);
          this.spawnTimer = baseInterval * (0.7 + Math.random() * 0.6);
        }
      } else if (this.zombiesRemaining <= 0 && livingCount === 0) {
        const bonus = 60 + this.wave * 35;
        onWaveCleared(this.wave, bonus);
        this.startWavePrep(this.wave + 1, 6.0);
      }
    }

    for (let i = this.lootDrops.length - 1; i >= 0; i--) {
      const drop = this.lootDrops[i];
      drop.life -= dt;
      drop.mesh.rotation.y += dt * 2.2;
      drop.mesh.position.y = drop.position.y + Math.sin(drop.life * 3.5) * 0.08;
      if (drop.life <= 0) {
        this.scene.remove(drop.mesh);
        this.lootDrops.splice(i, 1);
      }
    }

    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];

      if (z.hitFlashTimer > 0) {
        z.hitFlashTimer -= dt;
        if (z.hitFlashTimer <= 0) {
          z.hitMeshes.forEach((m) => {
            const mat = m.material as THREE.MeshStandardMaterial;
            mat.emissive.setHex(0x000000);
          });
        }
      }

      if (z.knockbackVel.lengthSq() > 0.001) {
        z.position.x += z.knockbackVel.x * dt;
        z.position.z += z.knockbackVel.z * dt;
        z.knockbackVel.multiplyScalar(Math.exp(-9 * dt));
        this.resolveZombieCollisions(z, obstacles, barricades);
        z.position.y = groundHeightAt(z.position.x, z.position.z);
        z.root.position.copy(z.position);
      }

      if (z.state === 'dead') {
        z.deathTimer += dt;
        const fallAlpha = Math.min(1, z.deathTimer / 0.4);
        z.root.rotation.x = z.deathDir * fallAlpha * (Math.PI * 0.48);
        if (z.deathTimer > 2.2) {
          z.root.position.y -= dt * 0.65;
        }
        if (z.deathTimer > 3.6) {
          this.scene.remove(z.root);
          this.disposeZombieMaterials(z);
          this.zombies.splice(i, 1);
        }
        continue;
      }

      if (z.staggerTimer > 0) {
        z.staggerTimer -= dt;
      } else if (z.recoveryTimer > 0) {
        z.recoveryTimer -= dt;
      }

      const toPlayerX = playerPos.x - z.position.x;
      const toPlayerZ = playerPos.z - z.position.z;
      const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);

      // Distance culling for visual mesh
      z.root.visible = distToPlayer <= settings.renderDistance;

      z.vocalTimer -= dt;
      if (z.vocalTimer <= 0 && distToPlayer < 26) {
        z.vocalTimer = 4.0 + Math.random() * 6.5;
        onZombieVocal?.(z.type, distToPlayer);
      }

      // Distant AI throttling (> 28m updates steering at 15Hz instead of full rate)
      const isFar = distToPlayer > 28;
      z.aiThrottleAccum += dt;
      const aiStep = isFar ? (z.aiThrottleAccum >= 0.066 ? z.aiThrottleAccum : 0) : dt;
      if (isFar && aiStep === 0) {
        continue;
      }
      if (isFar) z.aiThrottleAccum = 0;

      let dirX = distToPlayer > 0.001 ? toPlayerX / distToPlayer : 0;
      let dirZ = distToPlayer > 0.001 ? toPlayerZ / distToPlayer : 0;

      for (let o = 0; o < obstacles.length; o++) {
        const obs = obstacles[o];
        const ox = z.position.x - obs.x;
        const oz = z.position.z - obs.z;
        const avoidR =
          (obs.type === 'circle'
            ? obs.radius ?? 0.6
            : Math.max(obs.halfW ?? 1, obs.halfD ?? 1)) +
          z.radius +
          0.9;
        const dSq = ox * ox + oz * oz;
        if (dSq < avoidR * avoidR && dSq > 1e-4) {
          const d = Math.sqrt(dSq);
          const strength = (avoidR - d) / avoidR;
          dirX += (ox / d) * strength * 1.45;
          dirZ += (oz / d) * strength * 1.45;
        }
      }

      for (let j = 0; j < this.zombies.length; j++) {
        if (i === j) continue;
        const other = this.zombies[j];
        if (other.state === 'dead') continue;
        const sx = z.position.x - other.position.x;
        const sz = z.position.z - other.position.z;
        const minSep = z.radius + other.radius + 0.2;
        const sSq = sx * sx + sz * sz;
        if (sSq < minSep * minSep && sSq > 1e-4) {
          const sd = Math.sqrt(sSq);
          dirX += (sx / sd) * ((minSep - sd) / minSep) * 1.2;
          dirZ += (sz / sd) * ((minSep - sd) / minSep) * 1.2;
        }
      }

      const dirLen = Math.hypot(dirX, dirZ);
      if (dirLen > 0.001) {
        dirX /= dirLen;
        dirZ /= dirLen;
      }

      let blockingBarricade: BarricadeTarget | null = null;
      for (let b = 0; b < barricades.length; b++) {
        const bar = barricades[b];
        const dx = Math.abs(z.position.x - bar.x) - bar.halfW;
        const dz = Math.abs(z.position.z - bar.z) - bar.halfD;
        if (dx < z.attackRange && dz < z.attackRange) {
          blockingBarricade = bar;
          break;
        }
      }

      z.attackTimer = Math.max(0, z.attackTimer - aiStep);

      if (blockingBarricade) {
        z.state = 'attack';
        if (z.attackTimer <= 0) {
          z.attackTimer = z.attackCooldown;
          z.attackAnimTimer = 0.35;
          blockingBarricade.damage(z.damage);
        }
      } else if (distToPlayer <= z.attackRange) {
        z.state = 'attack';
        if (z.attackTimer <= 0) {
          z.attackTimer = z.attackCooldown;
          z.attackAnimTimer = 0.35;
          onPlayerHit(z.damage, z.position);
        }
      } else {
        const isRunning = distToPlayer < 18 || z.type === ZombieType.FAST;
        z.state = isRunning ? 'run' : 'walk';
        const staggerSlow = z.staggerTimer > 0 ? 0.3 : z.recoveryTimer > 0 ? 0.72 : 1.0;
        const moveSpd = (isRunning ? z.runSpeed : z.speed) * staggerSlow;
        z.position.x += dirX * moveSpd * aiStep;
        z.position.z += dirZ * moveSpd * aiStep;
        this.resolveZombieCollisions(z, obstacles, barricades);
      }

      z.position.y = groundHeightAt(z.position.x, z.position.z);
      z.root.position.copy(z.position);

      const targetYaw = Math.atan2(toPlayerX, toPlayerZ);
      let diff = targetYaw - z.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      z.yaw += diff * Math.min(1, aiStep * 8);
      z.root.rotation.y = z.yaw;

      if (z.root.visible) {
        z.lod.levels[1].distance = 24 * settings.lodDistance;
        z.lod.update(camera);
        this.animateZombie(z, aiStep);
      }
    }
  }

  private resolveZombieCollisions(
    z: ZombieInstance,
    obstacles: ObstacleCollider[],
    barricades: BarricadeTarget[]
  ): void {
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (obs.type === 'circle' && obs.radius) {
        const dx = z.position.x - obs.x;
        const dz = z.position.z - obs.z;
        const minD = z.radius + obs.radius;
        const dSq = dx * dx + dz * dz;
        if (dSq < minD * minD && dSq > 1e-5) {
          const d = Math.sqrt(dSq);
          const push = (minD - d) / d;
          z.position.x += dx * push;
          z.position.z += dz * push;
        }
      } else if (obs.type === 'box' && obs.halfW && obs.halfD) {
        const cx = THREE.MathUtils.clamp(z.position.x, obs.x - obs.halfW, obs.x + obs.halfW);
        const cz = THREE.MathUtils.clamp(z.position.z, obs.z - obs.halfD, obs.z + obs.halfD);
        const dx = z.position.x - cx;
        const dz = z.position.z - cz;
        const dSq = dx * dx + dz * dz;
        if (dSq < z.radius * z.radius && dSq > 1e-5) {
          const d = Math.sqrt(dSq);
          const push = (z.radius - d) / d;
          z.position.x += dx * push;
          z.position.z += dz * push;
        }
      }
    }

    for (let b = 0; b < barricades.length; b++) {
      const bar = barricades[b];
      const cx = THREE.MathUtils.clamp(z.position.x, bar.x - bar.halfW, bar.x + bar.halfW);
      const cz = THREE.MathUtils.clamp(z.position.z, bar.z - bar.halfD, bar.z + bar.halfD);
      const dx = z.position.x - cx;
      const dz = z.position.z - cz;
      const dSq = dx * dx + dz * dz;
      if (dSq < z.radius * z.radius && dSq > 1e-5) {
        const d = Math.sqrt(dSq);
        const push = (z.radius - d) / d;
        z.position.x += dx * push;
        z.position.z += dz * push;
      }
    }
  }

  private animateZombie(z: ZombieInstance, dt: number): void {
    const strideFreq = z.state === 'run' ? 9.5 : z.state === 'walk' ? 5.6 : 2.0;
    z.animPhase += dt * strideFreq;

    const staggerLean = z.staggerTimer > 0 ? -0.38 : z.recoveryTimer > 0 ? -0.14 : 0;

    if (z.state === 'attack') {
      z.attackAnimTimer = Math.max(0, z.attackAnimTimer - dt);
      const swing = Math.sin((z.attackAnimTimer / 0.35) * Math.PI);
      z.torso.rotation.x = 0.25 + swing * 0.32 + staggerLean;
      z.leftArm.rotation.x = -1.45 - swing * 0.9;
      z.rightArm.rotation.x = -1.45 - swing * 0.9;
      z.leftLeg.rotation.x = 0;
      z.rightLeg.rotation.x = 0;
    } else if (z.state === 'walk' || z.state === 'run') {
      const amp = z.state === 'run' ? 0.72 : 0.45;
      z.leftLeg.rotation.x = Math.sin(z.animPhase) * amp;
      z.rightLeg.rotation.x = -Math.sin(z.animPhase) * amp;
      z.torso.rotation.z = Math.cos(z.animPhase) * 0.06;
      z.torso.rotation.x = (z.state === 'run' ? 0.26 : 0.14) + staggerLean;
      z.leftArm.rotation.x = -1.25 + Math.sin(z.animPhase * 0.9) * 0.18;
      z.rightArm.rotation.x = -1.32 - Math.sin(z.animPhase * 0.9) * 0.18;
      z.head.rotation.z = Math.sin(z.animPhase * 0.5) * 0.14;
    } else {
      z.torso.rotation.x = 0.06 + Math.sin(z.animPhase) * 0.04 + staggerLean;
      z.leftArm.rotation.x = -0.35;
      z.rightArm.rotation.x = -0.35;
    }
  }

  private disposeZombieMaterials(z: ZombieInstance): void {
    const seen = new Set<THREE.Material>();
    z.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (!Array.isArray(m.material) && !seen.has(m.material)) {
          seen.add(m.material);
          m.material.dispose();
        }
      }
    });
  }

  dispose(): void {
    for (const z of this.zombies) {
      this.scene.remove(z.root);
      this.disposeZombieMaterials(z);
    }
    this.zombies.length = 0;
    this.torsoGeo.dispose();
    this.pelvisGeo.dispose();
    this.limbUpperGeo.dispose();
    this.limbLowerGeo.dispose();
    this.skullGeo.dispose();
    this.jawGeo.dispose();
    this.eyeGeo.dispose();
    this.shoulderGeo.dispose();
    this.lowBodyGeo.dispose();
    this.lowHeadGeo.dispose();
    this.shadowGeo.dispose();
    this.coinGeo.dispose();
    this.crateGeo.dispose();
  }
}
