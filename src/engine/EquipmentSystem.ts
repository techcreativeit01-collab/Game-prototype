import * as THREE from 'three';
import { createBarricadeMesh, createGrenadeMesh, createTurretMesh } from './WeaponModels';
import { groundHeightAt } from './ForestEnvironment';
import { BarricadeTarget, ZombieInstance, ZombieManager } from './ZombieManager';

interface ActiveGrenade {
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  fuse: number;
}

interface ActiveExplosion {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  age: number;
  maxAge: number;
}

interface ActiveBarricade extends BarricadeTarget {
  mesh: THREE.Group;
  maxHealth: number;
}

interface ActiveTurret {
  group: THREE.Group;
  head: THREE.Group;
  muzzleFlash: THREE.Mesh;
  position: THREE.Vector3;
  ammo: number;
  fireCooldown: number;
  flashTimer: number;
  lifetime: number;
}

export class EquipmentSystem {
  private grenades: ActiveGrenade[] = [];
  private explosions: ActiveExplosion[] = [];
  readonly barricades: ActiveBarricade[] = [];
  readonly turrets: ActiveTurret[] = [];
  private nextBarricadeId = 1;

  private scene: THREE.Scene;
  private woodTex: THREE.Texture;

  constructor(scene: THREE.Scene, woodTex: THREE.Texture) {
    this.scene = scene;
    this.woodTex = woodTex;
  }

  reset(): void {
    this.grenades.forEach((g) => this.scene.remove(g.mesh));
    this.grenades.length = 0;

    this.explosions.forEach((e) => {
      this.scene.remove(e.mesh);
      this.scene.remove(e.light);
    });
    this.explosions.length = 0;

    this.barricades.forEach((b) => this.scene.remove(b.mesh));
    this.barricades.length = 0;

    this.turrets.forEach((t) => this.scene.remove(t.group));
    this.turrets.length = 0;
  }

  throwGrenade(origin: THREE.Vector3, forwardDir: THREE.Vector3): void {
    const mesh = createGrenadeMesh();
    const pos = origin.clone().addScaledVector(forwardDir, 0.7);
    pos.y -= 0.15;
    mesh.position.copy(pos);
    this.scene.add(mesh);

    const vel = forwardDir.clone().multiplyScalar(15.5);
    vel.y += 4.2;

    this.grenades.push({
      mesh,
      position: pos,
      velocity: vel,
      fuse: 1.45,
    });
  }

  placeBarricade(playerPos: THREE.Vector3, playerYaw: number): void {
    const dirX = -Math.sin(playerYaw);
    const dirZ = -Math.cos(playerYaw);
    const bx = playerPos.x + dirX * 2.4;
    const bz = playerPos.z + dirZ * 2.4;
    const by = groundHeightAt(bx, bz);

    const mesh = createBarricadeMesh(this.woodTex);
    mesh.position.set(bx, by, bz);
    mesh.rotation.y = playerYaw;
    this.scene.add(mesh);

    const isAxisZ = Math.abs(Math.cos(playerYaw)) >= Math.abs(Math.sin(playerYaw));
    const bar: ActiveBarricade = {
      id: this.nextBarricadeId++,
      mesh,
      x: bx,
      z: bz,
      halfW: isAxisZ ? 1.45 : 0.45,
      halfD: isAxisZ ? 0.45 : 1.45,
      health: 350,
      maxHealth: 350,
      damage: (amt: number) => {
        bar.health -= amt;
      },
    };
    this.barricades.push(bar);
  }

  placeTurret(playerPos: THREE.Vector3, playerYaw: number): void {
    const dirX = -Math.sin(playerYaw);
    const dirZ = -Math.cos(playerYaw);
    const tx = playerPos.x + dirX * 2.1;
    const tz = playerPos.z + dirZ * 2.1;
    const ty = groundHeightAt(tx, tz);

    const built = createTurretMesh();
    built.group.position.set(tx, ty, tz);
    built.head.rotation.y = playerYaw;
    this.scene.add(built.group);

    this.turrets.push({
      group: built.group,
      head: built.head,
      muzzleFlash: built.muzzleFlash,
      position: new THREE.Vector3(tx, ty + 1.06, tz),
      ammo: 120,
      fireCooldown: 0,
      flashTimer: 0,
      lifetime: 55,
    });
  }

  update(
    dt: number,
    zombieManager: ZombieManager,
    onExplosion: (distOrigin: THREE.Vector3) => void,
    onTurretShot: (from: THREE.Vector3, to: THREE.Vector3) => void,
    onZombieKill: (z: ZombieInstance) => void,
    onEquipmentHit?: (
      z: ZombieInstance,
      damage: number,
      dir: THREE.Vector3,
      source: 'grenade' | 'turret',
      killed: boolean
    ) => void
  ): void {
    // 1. Grenades
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.fuse -= dt;
      g.velocity.y -= 18 * dt;
      g.position.addScaledVector(g.velocity, dt);
      g.mesh.rotation.x += dt * 9;
      g.mesh.rotation.z += dt * 6;

      const gy = groundHeightAt(g.position.x, g.position.z) + 0.1;
      if (g.position.y < gy) {
        g.position.y = gy;
        g.velocity.y = Math.abs(g.velocity.y) * 0.35;
        g.velocity.x *= 0.65;
        g.velocity.z *= 0.65;
      }
      g.mesh.position.copy(g.position);

      if (g.fuse <= 0) {
        this.detonateGrenade(g.position, zombieManager, onZombieKill, onEquipmentHit);
        onExplosion(g.position);
        this.scene.remove(g.mesh);
        this.grenades.splice(i, 1);
      }
    }

    // 2. Explosions visual decay
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.age += dt;
      const t = e.age / e.maxAge;
      const scale = 0.5 + t * 6.5;
      e.mesh.scale.setScalar(scale);
      (e.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.85 * (1 - t));
      e.light.intensity = Math.max(0, 14 * (1 - t));
      if (e.age >= e.maxAge) {
        this.scene.remove(e.mesh);
        this.scene.remove(e.light);
        e.mesh.geometry.dispose();
        (e.mesh.material as THREE.Material).dispose();
        this.explosions.splice(i, 1);
      }
    }

    // 3. Barricades destruction check
    for (let i = this.barricades.length - 1; i >= 0; i--) {
      const b = this.barricades[i];
      if (b.health <= 0) {
        this.scene.remove(b.mesh);
        this.barricades.splice(i, 1);
      }
    }

    // 4. Automated Robot Turrets
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i];
      t.lifetime -= dt;
      t.fireCooldown = Math.max(0, t.fireCooldown - dt);
      if (t.flashTimer > 0) {
        t.flashTimer -= dt;
        if (t.flashTimer <= 0) t.muzzleFlash.visible = false;
      }

      if (t.ammo <= 0 || t.lifetime <= 0) {
        this.scene.remove(t.group);
        this.turrets.splice(i, 1);
        continue;
      }

      // Find nearest living zombie within 24m
      let nearest: ZombieInstance | null = null;
      let nearestDistSq = 24 * 24;
      for (const z of zombieManager.zombies) {
        if (z.state === 'dead') continue;
        const dSq = t.position.distanceToSquared(z.position);
        if (dSq < nearestDistSq) {
          nearestDistSq = dSq;
          nearest = z;
        }
      }

      if (nearest) {
        const dx = nearest.position.x - t.position.x;
        const dz = nearest.position.z - t.position.z;
        const desiredYaw = Math.atan2(-dx, -dz);
        let diff = desiredYaw - t.head.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        t.head.rotation.y += diff * Math.min(1, dt * 10);

        if (Math.abs(diff) < 0.28 && t.fireCooldown <= 0) {
          t.fireCooldown = 0.16;
          t.ammo--;
          t.muzzleFlash.visible = true;
          t.muzzleFlash.rotation.z = Math.random() * Math.PI;
          t.flashTimer = 0.05;

          const hitPoint = nearest.position.clone().add(new THREE.Vector3(0, 1.2 * nearest.scale, 0));
          onTurretShot(t.position, hitPoint);
          const shotDir = hitPoint.clone().sub(t.position).normalize();
          if (zombieManager.localSpawnPaused) {
            zombieManager.applyLocalVisualHit(nearest);
            onEquipmentHit?.(nearest, 26, shotDir, 'turret', false);
          } else {
            const killed = zombieManager.damageZombie(nearest, 26, onZombieKill, shotDir, 1.2);
            onEquipmentHit?.(nearest, 26, shotDir, 'turret', killed);
          }
        }
      } else {
        // Idle sentry sweep
        t.head.rotation.y += dt * 0.55;
      }
    }
  }

  private detonateGrenade(
    center: THREE.Vector3,
    zombieManager: ZombieManager,
    onZombieKill: (z: ZombieInstance) => void,
    onEquipmentHit?: (
      z: ZombieInstance,
      damage: number,
      dir: THREE.Vector3,
      source: 'grenade' | 'turret',
      killed: boolean
    ) => void
  ): void {
    const sphereGeo = new THREE.SphereGeometry(1, 14, 14);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff7b24,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.position.copy(center);
    this.scene.add(mesh);

    const light = new THREE.PointLight(0xff8c2b, 14, 22);
    light.position.copy(center).add(new THREE.Vector3(0, 0.8, 0));
    this.scene.add(light);

    this.explosions.push({ mesh, light, age: 0, maxAge: 0.45 });

    const blastRadius = 7.5;
    for (const z of zombieManager.zombies) {
      if (z.state === 'dead') continue;
      const dist = z.position.distanceTo(center);
      if (dist <= blastRadius) {
        const falloff = 1 - (dist / blastRadius) * 0.65;
        const dmg = Math.round(280 * falloff);
        const dir = z.position.clone().sub(center);
        if (dir.lengthSq() < 1e-4) dir.set(0, 0.4, 1);
        else dir.normalize();
        if (zombieManager.localSpawnPaused) {
          zombieManager.applyLocalVisualHit(z);
          onEquipmentHit?.(z, dmg, dir, 'grenade', false);
        } else {
          const killed = zombieManager.damageZombie(z, dmg, onZombieKill, dir, 7.5 * falloff);
          onEquipmentHit?.(z, dmg, dir, 'grenade', killed);
        }
      }
    }
  }
}
