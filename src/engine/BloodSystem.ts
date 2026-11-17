import * as THREE from 'three';
import { EffectsQuality, ZombieType } from '../types/game';
import { groundHeightAt } from './ForestEnvironment';

export interface BloodProfile {
  particleHex: number;
  splatHex: number;
  intensity: number;
  dropletScale: number;
  splatScale: number;
}

const BLOOD_PROFILES: Record<ZombieType, BloodProfile> = {
  [ZombieType.NORMAL]: {
    particleHex: 0xa61212,
    splatHex: 0x6b0909,
    intensity: 1.0,
    dropletScale: 1.0,
    splatScale: 1.0,
  },
  [ZombieType.FAST]: {
    particleHex: 0xef2323,
    splatHex: 0x991111,
    intensity: 1.2,
    dropletScale: 0.9,
    splatScale: 1.08,
  },
  [ZombieType.TANK]: {
    particleHex: 0x581316,
    splatHex: 0x3b120c,
    intensity: 1.85,
    dropletScale: 1.45,
    splatScale: 1.55,
  },
  [ZombieType.FEMALE]: {
    particleHex: 0xbe185d,
    splatHex: 0x6f0b34,
    intensity: 1.25,
    dropletScale: 0.95,
    splatScale: 1.12,
  },
  [ZombieType.BOSS]: {
    particleHex: 0xe11d48,
    splatHex: 0x430417,
    intensity: 2.35,
    dropletScale: 1.65,
    splatScale: 1.85,
  },
};

interface BloodDroplet {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  splatHex: number;
  splatScale: number;
  canSplat: boolean;
  active: boolean;
}

interface BloodDecal {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  baseOpacity: number;
  active: boolean;
}

const UP_AXIS = new THREE.Vector3(0, 0, 1);
const _tmpDir = new THREE.Vector3();
const _dirNorm = new THREE.Vector3();
const _tmpNormal = new THREE.Vector3();
const _tmpOrigin = new THREE.Vector3();
const _normalMatrix = new THREE.Matrix3();

function createSplatterTexture(variant: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Main irregular pool
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  const lobes = 14 + variant * 3;
  for (let i = 0; i <= lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2;
    const wobble =
      0.52 +
      0.26 * Math.sin(angle * (3 + variant) + variant * 1.7) +
      0.16 * Math.cos(angle * 7 - variant * 2.3);
    const rad = size * 0.28 * wobble;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // Radial directional streaks & satellite droplets
  const streakCount = 9 + variant * 4;
  for (let i = 0; i < streakCount; i++) {
    const a = ((i + variant * 0.37) / streakCount) * Math.PI * 2 + Math.sin(i * 4.1) * 0.25;
    const dist = size * (0.2 + ((i * 37) % 100) / 360);
    const r = 3 + ((i * 19 + variant * 7) % 7);
    const sx = cx + Math.cos(a) * dist;
    const sy = cy + Math.sin(a) * dist;

    ctx.beginPath();
    ctx.ellipse(sx, sy, r * 1.45, r * 0.72, a, 0, Math.PI * 2);
    ctx.fill();

    // Small outer satellite drop
    if (i % 2 === 0) {
      const d2 = dist + r * 2.1;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d2, cy + Math.sin(a) * d2, Math.max(1.5, r * 0.42), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export class BloodSystem {
  private scene: THREE.Scene;
  private droplets: BloodDroplet[] = [];
  private decals: BloodDecal[] = [];
  private decalCursor = 0;
  private raycaster = new THREE.Raycaster();

  private dropletGeo = new THREE.SphereGeometry(0.036, 5, 5);
  private decalGeo = new THREE.PlaneGeometry(1, 1);
  private textures: THREE.CanvasTexture[] = [];

  constructor(scene: THREE.Scene, maxDecals = 110) {
    this.scene = scene;
    this.textures = [
      createSplatterTexture(0),
      createSplatterTexture(1),
      createSplatterTexture(2),
    ];

    // Pooled blood droplets
    for (let i = 0; i < 95; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x991b1b });
      const mesh = new THREE.Mesh(this.dropletGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.droplets.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.45,
        splatHex: 0x6b0909,
        splatScale: 1,
        canSplat: true,
        active: false,
      });
    }

    // Pooled ground/wall splatter decals
    for (let i = 0; i < maxDecals; i++) {
      const tex = this.textures[i % this.textures.length];
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        color: 0x6b0909,
        roughness: 0.28,
        metalness: 0.08,
        transparent: true,
        opacity: 0.9,
        alphaTest: 0.12,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const mesh = new THREE.Mesh(this.decalGeo, mat);
      mesh.visible = false;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.decals.push({
        mesh,
        age: 0,
        maxAge: 20,
        baseOpacity: 0.9,
        active: false,
      });
    }
  }

  getProfile(type: ZombieType): BloodProfile {
    return BLOOD_PROFILES[type] ?? BLOOD_PROFILES[ZombieType.NORMAL];
  }

  spawnBloodImpact(
    zombieType: ZombieType,
    hitPoint: THREE.Vector3,
    shotDir: THREE.Vector3,
    headshot: boolean,
    wallTargets: THREE.Object3D[],
    effectsQuality: EffectsQuality,
    isKill = false
  ): void {
    const profile = this.getProfile(zombieType);
    const fxMult =
      effectsQuality === 'low' ? 0.45 : effectsQuality === 'medium' ? 0.75 : 1.0;
    const mult =
      profile.intensity * (headshot ? 1.45 : 1.0) * (isKill ? 1.35 : 1.0) * fxMult;

    // 1. Directional airborne blood droplets (exit spray + arc)
    const dropletCount = Math.max(3, Math.round(9 * mult));
    const dirNorm = _dirNorm.copy(shotDir);
    if (dirNorm.lengthSq() < 1e-6) dirNorm.set(0, 0, -1);
    else dirNorm.normalize();
    let spawned = 0;

    for (let i = 0; i < this.droplets.length && spawned < dropletCount; i++) {
      const d = this.droplets[i];
      if (d.active) continue;

      d.active = true;
      d.life = 0;
      d.maxLife = 0.42 + Math.random() * 0.45;
      d.splatHex = profile.splatHex;
      d.splatScale = profile.splatScale * (headshot ? 1.25 : 1.0);
      // Every 2nd or 3rd droplet stamps a ground blood drop on landing
      d.canSplat = spawned % (effectsQuality === 'low' ? 3 : 2) === 0;

      d.mesh.position.copy(hitPoint);
      (d.mesh.material as THREE.MeshBasicMaterial).color.setHex(profile.particleHex);
      const s = profile.dropletScale * (0.7 + Math.random() * 0.9);
      d.mesh.scale.setScalar(s);

      const spraySpeed = (3.4 + Math.random() * 4.6) * Math.min(1.5, profile.intensity * 0.75 + 0.35);
      d.vel.set(
        dirNorm.x * spraySpeed * 0.75 + (Math.random() - 0.5) * 3.4,
        0.9 + Math.random() * 2.8 + (headshot ? 1.2 : 0),
        dirNorm.z * spraySpeed * 0.75 + (Math.random() - 0.5) * 3.4
      );
      d.mesh.visible = true;
      spawned++;
    }

    // 2. Immediate exit-spray raycasts onto nearby walls, obstacles & structures
    const wallRayCount = effectsQuality === 'low' ? 1 : headshot || isKill ? 3 : 2;
    if (wallTargets.length > 0) {
      for (let r = 0; r < wallRayCount; r++) {
        _tmpOrigin.copy(hitPoint);
        _tmpDir
          .copy(shotDir)
          .normalize()
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.48,
              (Math.random() - 0.4) * 0.36,
              (Math.random() - 0.5) * 0.48
            )
          )
          .normalize();

        this.raycaster.set(_tmpOrigin, _tmpDir);
        this.raycaster.near = 0.05;
        this.raycaster.far = 4.4 * Math.min(1.4, profile.intensity * 0.65 + 0.55);

        const hits = this.raycaster.intersectObjects(wallTargets, true);
        const firstHit = hits[0];
        if (firstHit && firstHit.face) {
          _normalMatrix.getNormalMatrix(firstHit.object.matrixWorld);
          _tmpNormal.copy(firstHit.face.normal).applyMatrix3(_normalMatrix).normalize();

          const size =
            (0.65 + Math.random() * 0.65) *
            profile.splatScale *
            (headshot ? 1.25 : 1.0);
          this.placeDecal(firstHit.point, _tmpNormal, profile.splatHex, size, 0.92);
        }
      }
    }

    // 3. Immediate ground splatter directly beneath / behind hit trajectory
    const groundCount = isKill ? 2 : 1;
    for (let g = 0; g < groundCount; g++) {
      const spreadX = dirNorm.x * (0.35 + Math.random() * 1.1) + (Math.random() - 0.5) * 0.7;
      const spreadZ = dirNorm.z * (0.35 + Math.random() * 1.1) + (Math.random() - 0.5) * 0.7;
      const gx = hitPoint.x + spreadX;
      const gz = hitPoint.z + spreadZ;
      const gy = groundHeightAt(gx, gz);
      const groundNormal = this.computeGroundNormal(gx, gz);
      const size =
        (0.55 + Math.random() * 0.6) *
        profile.splatScale *
        (isKill ? 1.35 : 0.92) *
        (headshot ? 1.2 : 1.0);
      this.placeDecal(
        new THREE.Vector3(gx, gy, gz),
        groundNormal,
        profile.splatHex,
        size,
        0.9
      );
    }
  }

  private computeGroundNormal(x: number, z: number): THREE.Vector3 {
    const eps = 0.25;
    const hL = groundHeightAt(x - eps, z);
    const hR = groundHeightAt(x + eps, z);
    const hD = groundHeightAt(x, z - eps);
    const hU = groundHeightAt(x, z + eps);
    return _tmpNormal.set(hL - hR, 2 * eps, hD - hU).normalize();
  }

  private placeDecal(
    pos: THREE.Vector3,
    normal: THREE.Vector3,
    colorHex: number,
    size: number,
    opacity: number
  ): void {
    const limit = this.decals.length;
    if (limit === 0) return;

    const d = this.decals[this.decalCursor % limit];
    this.decalCursor = (this.decalCursor + 1) % limit;

    d.active = true;
    d.age = 0;
    d.maxAge = 16 + Math.random() * 8;
    d.baseOpacity = opacity;

    d.mesh.position.copy(pos).addScaledVector(normal, 0.018 + (this.decalCursor % 4) * 0.002);
    d.mesh.quaternion.setFromUnitVectors(UP_AXIS, normal);
    d.mesh.rotateZ(Math.random() * Math.PI * 2);
    d.mesh.scale.set(size, size * (0.8 + Math.random() * 0.45), 1);

    const mat = d.mesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(colorHex);
    mat.opacity = opacity;
    d.mesh.visible = true;
  }

  update(dt: number, effectsQuality: EffectsQuality): void {
    for (const d of this.droplets) {
      if (!d.active) continue;
      d.life += dt;
      if (d.life >= d.maxLife) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }

      d.vel.y -= 15.5 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);

      const gy = groundHeightAt(d.mesh.position.x, d.mesh.position.z);
      if (d.mesh.position.y <= gy + 0.02) {
        if (d.canSplat && effectsQuality !== 'low') {
          const n = this.computeGroundNormal(d.mesh.position.x, d.mesh.position.z);
          this.placeDecal(
            new THREE.Vector3(d.mesh.position.x, gy, d.mesh.position.z),
            n,
            d.splatHex,
            (0.28 + Math.random() * 0.28) * d.splatScale,
            0.84
          );
        }
        d.active = false;
        d.mesh.visible = false;
      }
    }

    for (const dec of this.decals) {
      if (!dec.active) continue;
      dec.age += dt;
      if (dec.age >= dec.maxAge) {
        dec.active = false;
        dec.mesh.visible = false;
        continue;
      }
      if (dec.age > dec.maxAge - 4.0) {
        const fade = Math.max(0, (dec.maxAge - dec.age) / 4.0);
        (dec.mesh.material as THREE.MeshStandardMaterial).opacity = dec.baseOpacity * fade;
      }
    }
  }

  clear(): void {
    for (const d of this.droplets) {
      d.active = false;
      d.mesh.visible = false;
    }
    for (const dec of this.decals) {
      dec.active = false;
      dec.mesh.visible = false;
    }
  }

  dispose(): void {
    this.clear();
    for (const d of this.droplets) {
      this.scene.remove(d.mesh);
      (d.mesh.material as THREE.Material).dispose();
    }
    for (const dec of this.decals) {
      this.scene.remove(dec.mesh);
      (dec.mesh.material as THREE.Material).dispose();
    }
    this.dropletGeo.dispose();
    this.decalGeo.dispose();
    this.textures.forEach((t) => t.dispose());
    this.droplets.length = 0;
    this.decals.length = 0;
  }
}
