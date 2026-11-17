import * as THREE from 'three';
import { EquipmentId, ZombieType } from '../types/game';
import { ZOMBIE_CONFIGS, getWaveZombieCount } from '../data/GameData';
import { ARENA_RADIUS, ObstacleCollider, groundHeightAt } from './ForestEnvironment';

export interface ZombieInstance {
  id: number;
  type: ZombieType;
  root: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  hitMeshes: THREE.Mesh[];
  position: THREE.Vector3;
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
  state: 'idle' | 'walk' | 'run' | 'attack' | 'dead';
  deathTimer: number;
  coinReward: number;
  radius: number;
  scale: number;
  animPhase: number;
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

  private spawnTimer = 0;
  private nextId = 1;
  private nextLootId = 1;
  private scene: THREE.Scene;
  private spawnPoints: THREE.Vector3[];

  // Shared geometries for zombie parts to avoid heavy GC & memory churn
  private boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private headGeo = new THREE.BoxGeometry(0.38, 0.42, 0.38);
  private eyeGeo = new THREE.SphereGeometry(0.038, 6, 6);
  private coinGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12);
  private crateGeo = new THREE.BoxGeometry(0.42, 0.34, 0.42);

  constructor(scene: THREE.Scene, spawnPoints: THREE.Vector3[]) {
    this.scene = scene;
    this.spawnPoints = spawnPoints;
  }

  reset(): void {
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
    // Boss encounter at every 5th wave (first spawn of that wave)
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
    // Wave 4+
    if (r < 0.32) return ZombieType.NORMAL;
    if (r < 0.55) return ZombieType.FEMALE;
    if (r < 0.82) return ZombieType.FAST;
    return ZombieType.TANK;
  }

  private buildZombieMesh(type: ZombieType, id: number): Omit<
    ZombieInstance,
    | 'position'
    | 'yaw'
    | 'health'
    | 'maxHealth'
    | 'speed'
    | 'runSpeed'
    | 'damage'
    | 'attackRange'
    | 'attackCooldown'
    | 'attackTimer'
    | 'attackAnimTimer'
    | 'hitFlashTimer'
    | 'state'
    | 'deathTimer'
    | 'coinReward'
    | 'radius'
    | 'scale'
    | 'animPhase'
    | 'rewarded'
  > {
    const cfg = ZOMBIE_CONFIGS[type];
    const root = new THREE.Group();
    const hitMeshes: THREE.Mesh[] = [];

    const skinMat = new THREE.MeshStandardMaterial({
      color: cfg.bodyColor,
      roughness: 0.78,
      metalness: 0.04,
    });
    const clothMat = new THREE.MeshStandardMaterial({
      color: cfg.clothColor,
      roughness: 0.88,
      metalness: 0.05,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c20,
      roughness: 0.85,
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: cfg.eyeColor });

    const registerHitMesh = (m: THREE.Mesh, isHead: boolean) => {
      m.userData.zombieId = id;
      m.userData.isHead = isHead;
      m.castShadow = true;
      m.receiveShadow = true;
      hitMeshes.push(m);
      this.raycastTargets.push(m);
    };

    const torsoWidth = type === ZombieType.TANK || type === ZombieType.BOSS ? 0.68 : type === ZombieType.FEMALE ? 0.42 : 0.5;
    const torsoDepth = type === ZombieType.TANK || type === ZombieType.BOSS ? 0.4 : 0.28;

    // Legs (pivoted at hip y = 0.85)
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-torsoWidth * 0.26, 0.86, 0);
    const lThigh = new THREE.Mesh(this.boxGeo, darkMat);
    lThigh.scale.set(0.18, 0.86, 0.19);
    lThigh.position.y = -0.43;
    registerHitMesh(lThigh, false);
    leftLeg.add(lThigh);
    root.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(torsoWidth * 0.26, 0.86, 0);
    const rThigh = new THREE.Mesh(this.boxGeo, darkMat);
    rThigh.scale.set(0.18, 0.86, 0.19);
    rThigh.position.y = -0.43;
    registerHitMesh(rThigh, false);
    rightLeg.add(rThigh);
    root.add(rightLeg);

    // Torso group (pivoted at waist y = 0.86)
    const torso = new THREE.Group();
    torso.position.set(0, 0.86, 0);
    root.add(torso);

    const chest = new THREE.Mesh(this.boxGeo, clothMat);
    chest.scale.set(torsoWidth, 0.72, torsoDepth);
    chest.position.y = 0.36;
    registerHitMesh(chest, false);
    torso.add(chest);

    // Exposed rib/wound accent on chest
    const wound = new THREE.Mesh(
      this.boxGeo,
      new THREE.MeshStandardMaterial({ color: 0x6b1414, roughness: 0.45 })
    );
    wound.scale.set(torsoWidth * 0.42, 0.24, torsoDepth + 0.02);
    wound.position.set(0.05, 0.38, 0);
    torso.add(wound);

    if (type === ZombieType.BOSS || type === ZombieType.TANK) {
      // Heavy shoulder plates / humps
      [-1, 1].forEach((side) => {
        const hump = new THREE.Mesh(this.boxGeo, skinMat);
        hump.scale.set(0.26, 0.26, 0.32);
        hump.position.set(side * (torsoWidth * 0.45), 0.65, 0);
        registerHitMesh(hump, false);
        torso.add(hump);
      });
    }

    // Head (pivoted at neck y = 0.74 above torso)
    const head = new THREE.Group();
    head.position.set(0, 0.74, 0);
    torso.add(head);

    const skull = new THREE.Mesh(this.headGeo, skinMat);
    skull.position.y = 0.21;
    registerHitMesh(skull, true);
    head.add(skull);

    // Glowing sunken eyes
    [-0.085, 0.085].forEach((ex) => {
      const eye = new THREE.Mesh(this.eyeGeo, eyeMat);
      eye.position.set(ex, 0.24, 0.19);
      head.add(eye);
    });

    // Jaw accent
    const jaw = new THREE.Mesh(this.boxGeo, darkMat);
    jaw.scale.set(0.24, 0.09, 0.2);
    jaw.position.set(0, 0.07, 0.11);
    head.add(jaw);

    if (type === ZombieType.FEMALE) {
      // Long dark hair silhouette
      const hair = new THREE.Mesh(this.boxGeo, darkMat);
      hair.scale.set(0.42, 0.54, 0.24);
      hair.position.set(0, 0.16, -0.1);
      head.add(hair);
    } else if (type === ZombieType.BOSS) {
      // Jagged bone spikes on boss head/shoulders
      [-0.14, 0.14].forEach((hx) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 6), darkMat);
        horn.position.set(hx, 0.46, 0);
        horn.rotation.z = -hx * 1.4;
        head.add(horn);
      });
    }

    // Left & Right Arms (pivoted at shoulders)
    const armOffsetX = torsoWidth * 0.5 + 0.09;
    const armScale = type === ZombieType.TANK || type === ZombieType.BOSS ? 0.2 : 0.13;

    const leftArm = new THREE.Group();
    leftArm.position.set(-armOffsetX, 0.64, 0);
    const lArmMesh = new THREE.Mesh(this.boxGeo, skinMat);
    lArmMesh.scale.set(armScale, 0.72, armScale);
    lArmMesh.position.y = -0.32;
    registerHitMesh(lArmMesh, false);
    leftArm.add(lArmMesh);
    torso.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(armOffsetX, 0.64, 0);
    const rArmMesh = new THREE.Mesh(this.boxGeo, skinMat);
    rArmMesh.scale.set(armScale, 0.72, armScale);
    rArmMesh.position.y = -0.32;
    registerHitMesh(rArmMesh, false);
    rightArm.add(rArmMesh);
    torso.add(rightArm);

    root.scale.setScalar(cfg.scale);

    return {
      id,
      type,
      root,
      torso,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      hitMeshes,
    };
  }

  private spawnZombie(type: ZombieType, playerPos: THREE.Vector3): void {
    // Pick a spawn point away from player (>= 24m)
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

    const cfg = ZOMBIE_CONFIGS[type];
    const waveHpScale = 1 + (this.wave - 1) * 0.18;
    const waveDmgScale = 1 + (this.wave - 1) * 0.09;
    const waveSpdScale = 1 + Math.min(0.45, (this.wave - 1) * 0.035);

    const id = this.nextId++;
    const parts = this.buildZombieMesh(type, id);
    parts.root.position.set(sx, sy, sz);
    this.scene.add(parts.root);

    const z: ZombieInstance = {
      ...parts,
      position: new THREE.Vector3(sx, sy, sz),
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
      state: 'walk',
      deathTimer: 0,
      coinReward: cfg.coinReward + (this.wave - 1) * 2,
      radius: 0.48 * cfg.scale,
      scale: cfg.scale,
      animPhase: Math.random() * Math.PI * 2,
      rewarded: false,
    };

    this.zombies.push(z);
  }

  getZombieById(id: number): ZombieInstance | undefined {
    return this.zombies.find((z) => z.id === id);
  }

  damageZombie(
    z: ZombieInstance,
    amount: number,
    onKill: (z: ZombieInstance) => void
  ): boolean {
    if (z.state === 'dead') return false;
    z.health -= amount;
    z.hitFlashTimer = 0.12;

    // Tint hit flash briefly
    z.hitMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x661111);
    });

    if (z.health <= 0) {
      z.health = 0;
      z.state = 'dead';
      z.deathTimer = 0;
      // Remove from raycast targets immediately so corpses don't soak shots
      for (const hm of z.hitMeshes) {
        const idx = this.raycastTargets.indexOf(hm);
        if (idx !== -1) this.raycastTargets.splice(idx, 1);
      }
      this.zombiesRemaining = Math.max(0, this.zombiesRemaining - 1);
      this.maybeDropLoot(z.position);
      onKill(z);
      return true;
    }
    return false;
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

  update(
    dt: number,
    playerPos: THREE.Vector3,
    obstacles: ObstacleCollider[],
    barricades: BarricadeTarget[],
    onPlayerHit: (damage: number) => void,
    onWaveCleared: (waveCompleted: number, bonusCoins: number) => void,
    onWaveStarted: (wave: number) => void
  ): void {
    // 1. Wave management
    if (this.waveState === 'countdown') {
      this.waveCountdown -= dt;
      if (this.waveCountdown <= 0) {
        this.waveState = 'active';
        this.waveBanner = this.wave % 5 === 0 ? `BOSS WAVE ${this.wave}` : `WAVE ${this.wave}`;
        onWaveStarted(this.wave);
      }
    } else if (this.waveState === 'active') {
      const livingCount = this.zombies.filter((z) => z.state !== 'dead').length;
      const maxSimultaneous = Math.min(24, 10 + this.wave * 2);

      if (this.zombiesSpawnedThisWave < this.waveTotalZombies && livingCount < maxSimultaneous) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          const type = this.chooseZombieType(this.wave);
          this.spawnZombie(type, playerPos);
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

    // 2. Update loot pickups (spin + bob + expire)
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

    // 3. Update every zombie AI & animation
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

      if (z.state === 'dead') {
        z.deathTimer += dt;
        const fallAlpha = Math.min(1, z.deathTimer / 0.45);
        z.root.rotation.x = -fallAlpha * (Math.PI * 0.48);
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

      const toPlayerX = playerPos.x - z.position.x;
      const toPlayerZ = playerPos.z - z.position.z;
      const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);

      // Desired direction toward player
      let dirX = distToPlayer > 0.001 ? toPlayerX / distToPlayer : 0;
      let dirZ = distToPlayer > 0.001 ? toPlayerZ / distToPlayer : 0;

      // Obstacle avoidance steering (avoid trees/rocks/cabin walls)
      for (let o = 0; o < obstacles.length; o++) {
        const obs = obstacles[o];
        const ox = z.position.x - obs.x;
        const oz = z.position.z - obs.z;
        const avoidR = (obs.type === 'circle' ? obs.radius ?? 0.6 : Math.max(obs.halfW ?? 1, obs.halfD ?? 1)) + z.radius + 0.9;
        const dSq = ox * ox + oz * oz;
        if (dSq < avoidR * avoidR && dSq > 1e-4) {
          const d = Math.sqrt(dSq);
          const strength = (avoidR - d) / avoidR;
          dirX += (ox / d) * strength * 1.45;
          dirZ += (oz / d) * strength * 1.45;
        }
      }

      // Separation from nearby zombies so hordes spread organically
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

      // Check if a barricade blocks path or is within attack range
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

      z.attackTimer = Math.max(0, z.attackTimer - dt);

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
          onPlayerHit(z.damage);
        }
      } else {
        // Chase player (run when within 18m or wave >= 3)
        const isRunning = distToPlayer < 18 || z.type === ZombieType.FAST;
        z.state = isRunning ? 'run' : 'walk';
        const moveSpd = isRunning ? z.runSpeed : z.speed;
        z.position.x += dirX * moveSpd * dt;
        z.position.z += dirZ * moveSpd * dt;

        // Hard resolve solid collisions so zombies never walk through walls/trees/barricades
        this.resolveZombieCollisions(z, obstacles, barricades);
      }

      // Snap flush to rolling forest ground
      z.position.y = groundHeightAt(z.position.x, z.position.z);
      z.root.position.copy(z.position);

      // Face player smoothly
      const targetYaw = Math.atan2(toPlayerX, toPlayerZ);
      let diff = targetYaw - z.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      z.yaw += diff * Math.min(1, dt * 8);
      z.root.rotation.y = z.yaw;

      // Procedural articulated animations (idle, walk, run, attack)
      this.animateZombie(z, dt);
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

    if (z.state === 'attack') {
      z.attackAnimTimer = Math.max(0, z.attackAnimTimer - dt);
      const swing = Math.sin((z.attackAnimTimer / 0.35) * Math.PI);
      z.torso.rotation.x = 0.25 + swing * 0.32;
      z.leftArm.rotation.x = -1.45 - swing * 0.9;
      z.rightArm.rotation.x = -1.45 - swing * 0.9;
      z.leftLeg.rotation.x = 0;
      z.rightLeg.rotation.x = 0;
    } else if (z.state === 'walk' || z.state === 'run') {
      const amp = z.state === 'run' ? 0.72 : 0.45;
      z.leftLeg.rotation.x = Math.sin(z.animPhase) * amp;
      z.rightLeg.rotation.x = -Math.sin(z.animPhase) * amp;
      z.torso.rotation.z = Math.cos(z.animPhase) * 0.06;
      z.torso.rotation.x = z.state === 'run' ? 0.26 : 0.14;
      // Shambling outstretched arms
      z.leftArm.rotation.x = -1.25 + Math.sin(z.animPhase * 0.9) * 0.18;
      z.rightArm.rotation.x = -1.32 - Math.sin(z.animPhase * 0.9) * 0.18;
      z.head.rotation.z = Math.sin(z.animPhase * 0.5) * 0.14;
    } else {
      z.torso.rotation.x = 0.06 + Math.sin(z.animPhase) * 0.04;
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
    this.boxGeo.dispose();
    this.headGeo.dispose();
    this.eyeGeo.dispose();
    this.coinGeo.dispose();
    this.crateGeo.dispose();
  }
}
