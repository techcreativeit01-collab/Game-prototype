import * as THREE from 'three';
import { ARENA_RADIUS, ObstacleCollider, groundHeightAt } from './ForestEnvironment';
import { SettingsData, UpgradeId } from '../types/game';

export interface ActiveBarricadeBox {
  x: number;
  z: number;
  halfW: number;
  halfD: number;
}

export class PlayerController {
  readonly position = new THREE.Vector3(0, 0, 0);
  readonly velocity = new THREE.Vector3(0, 0, 0);

  yaw = 0;
  pitch = 0;
  recoilPitch = 0;
  recoilYaw = 0;
  shakeIntensity = 0;

  health = 100;
  maxHealth = 100;
  armor = 0;
  maxArmor = 100;
  stamina = 100;
  adrenalineTimer = 0;

  isGrounded = true;
  isCrouching = false;
  isSprinting = false;
  isMoving = false;
  damageFlash = 0;

  private eyeHeight = 1.72;
  private standEyeHeight = 1.72;
  private crouchEyeHeight = 1.05;
  private playerRadius = 0.48;
  private headBobPhase = 0;
  private footstepTimer = 0;
  private currentFov = 72;

  private moveVec = new THREE.Vector3();
  private forwardVec = new THREE.Vector3();
  private rightVec = new THREE.Vector3();

  reset(upgrades: Record<UpgradeId, number>): void {
    this.position.set(0, groundHeightAt(0, 0), 4);
    this.velocity.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.shakeIntensity = 0;

    this.maxHealth = 100 + (upgrades[UpgradeId.MAX_HEALTH] ?? 0) * 20;
    this.health = this.maxHealth;
    this.armor = 25;
    this.maxArmor = 100;
    this.stamina = 100;
    this.adrenalineTimer = 0;
    this.isGrounded = true;
    this.isCrouching = false;
    this.isSprinting = false;
    this.damageFlash = 0;
    this.eyeHeight = this.standEyeHeight;
    this.currentFov = 72;
  }

  refreshMaxHealth(upgrades: Record<UpgradeId, number>): void {
    const nextMax = 100 + (upgrades[UpgradeId.MAX_HEALTH] ?? 0) * 20;
    if (nextMax > this.maxHealth) {
      this.health += nextMax - this.maxHealth;
    }
    this.maxHealth = nextMax;
    this.health = Math.min(this.health, this.maxHealth);
  }

  applyLook(dx: number, dy: number, settings: SettingsData, isAiming: boolean, isTouch: boolean): void {
    const baseSens = isTouch ? settings.mobileSensitivity * 0.0045 : settings.mouseSensitivity * 0.0022;
    const camMult = settings.cameraSensitivity;
    const aimMult = isAiming ? settings.aimSensitivity : 1.0;
    const sens = baseSens * camMult * aimMult;

    this.yaw -= dx * sens;
    const ySign = settings.invertY ? 1 : -1;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + dy * sens * ySign,
      -Math.PI * 0.46,
      Math.PI * 0.46
    );
  }

  addRecoil(amount: number, accuracyUpgradeLevel: number): void {
    const mitigation = Math.max(0.45, 1 - accuracyUpgradeLevel * 0.06);
    this.recoilPitch += amount * mitigation;
    this.recoilYaw += (Math.random() - 0.5) * amount * 0.45 * mitigation;
    this.shakeIntensity = Math.min(0.08, this.shakeIntensity + amount * 0.4);
  }

  addShake(amount: number): void {
    this.shakeIntensity = Math.min(0.14, this.shakeIntensity + amount);
  }

  takeDamage(rawDamage: number, upgrades: Record<UpgradeId, number>): number {
    const resist = Math.min(0.45, (upgrades[UpgradeId.DAMAGE_RESIST] ?? 0) * 0.05);
    let dmg = rawDamage * (1 - resist);

    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.65);
      this.armor -= absorbed;
      dmg -= absorbed;
    }

    const applied = Math.max(1, Math.round(dmg));
    this.health = Math.max(0, this.health - applied);
    this.damageFlash = 1.0;
    this.addShake(0.055);
    return applied;
  }

  heal(amount: number): boolean {
    if (this.health >= this.maxHealth) return false;
    this.health = Math.min(this.maxHealth, this.health + amount);
    return true;
  }

  addArmor(amount: number): boolean {
    if (this.armor >= this.maxArmor) return false;
    this.armor = Math.min(this.maxArmor, this.armor + amount);
    return true;
  }

  update(
    dt: number,
    inputX: number,
    inputZ: number,
    wantJump: boolean,
    wantSprint: boolean,
    wantCrouch: boolean,
    isAiming: boolean,
    targetAdsFov: number,
    upgrades: Record<UpgradeId, number>,
    obstacles: ObstacleCollider[],
    barricades: ActiveBarricadeBox[],
    camera: THREE.PerspectiveCamera,
    onFootstep: (sprinting: boolean) => void
  ): void {
    this.isCrouching = wantCrouch;
    if (this.adrenalineTimer > 0) {
      this.adrenalineTimer = Math.max(0, this.adrenalineTimer - dt);
    }
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);

    // Smooth eye height for crouch
    const targetEye = this.isCrouching ? this.crouchEyeHeight : this.standEyeHeight;
    this.eyeHeight = THREE.MathUtils.damp(this.eyeHeight, targetEye, 14, dt);

    // Compute planar forward & right from yaw
    this.forwardVec.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.rightVec.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this.moveVec.set(0, 0, 0);
    this.moveVec.addScaledVector(this.rightVec, inputX);
    this.moveVec.addScaledVector(this.forwardVec, inputZ);
    const hasMove = this.moveVec.lengthSq() > 0.001;
    if (hasMove) this.moveVec.normalize();
    this.isMoving = hasMove;

    const canSprint = wantSprint && hasMove && !this.isCrouching && !isAiming && (this.stamina > 3 || this.adrenalineTimer > 0);
    this.isSprinting = canSprint;

    if (this.isSprinting && this.adrenalineTimer <= 0) {
      this.stamina = Math.max(0, this.stamina - dt * 22);
    } else {
      this.stamina = Math.min(100, this.stamina + dt * (this.adrenalineTimer > 0 ? 45 : 16));
    }

    const speedBonus = 1 + (upgrades[UpgradeId.MOVE_SPEED] ?? 0) * 0.05;
    const adrenalineMult = this.adrenalineTimer > 0 ? 1.35 : 1.0;
    let targetSpeed = 5.4 * speedBonus * adrenalineMult;
    if (this.isSprinting) targetSpeed *= 1.48;
    else if (this.isCrouching) targetSpeed *= 0.56;
    else if (isAiming) targetSpeed *= 0.72;

    const targetVx = hasMove ? this.moveVec.x * targetSpeed : 0;
    const targetVz = hasMove ? this.moveVec.z * targetSpeed : 0;
    const accel = this.isGrounded ? 14 : 5;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetVx, accel, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetVz, accel, dt);

    // Jump & gravity
    if (wantJump && this.isGrounded) {
      this.velocity.y = 6.9;
      this.isGrounded = false;
    }
    this.velocity.y -= 19.5 * dt;

    // Integrate position
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // Resolve horizontal obstacle & barricade collisions
    this.resolveCollisions(obstacles, barricades);

    // Arena boundary perimeter clamp
    const distFromCenter = Math.hypot(this.position.x, this.position.z);
    const maxR = ARENA_RADIUS - 1.2;
    if (distFromCenter > maxR) {
      const s = maxR / distFromCenter;
      this.position.x *= s;
      this.position.z *= s;
    }

    // Ground detection
    const floorY = groundHeightAt(this.position.x, this.position.z);
    if (this.position.y <= floorY) {
      this.position.y = floorY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Footsteps & head bob
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    let bobY = 0;
    if (this.isGrounded && horizSpeed > 0.8) {
      const bobFreq = this.isSprinting ? 12.5 : 8.5;
      this.headBobPhase += dt * bobFreq;
      bobY = Math.sin(this.headBobPhase) * (this.isSprinting ? 0.055 : 0.032);
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        onFootstep(this.isSprinting);
        this.footstepTimer = this.isSprinting ? 0.31 : 0.46;
      }
    } else {
      this.footstepTimer = 0.08;
    }

    // Recoil & screen shake decay
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 14, dt);
    this.recoilYaw = THREE.MathUtils.damp(this.recoilYaw, 0, 14, dt);
    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 0.25);

    const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity;

    // Update FPS Camera
    camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight + bobY,
      this.position.z
    );
    camera.rotation.order = 'YXZ';
    camera.rotation.set(
      THREE.MathUtils.clamp(this.pitch + this.recoilPitch + shakeY, -Math.PI * 0.48, Math.PI * 0.48),
      this.yaw + this.recoilYaw + shakeX,
      0
    );

    const desiredFov = isAiming ? targetAdsFov : this.isSprinting ? 78 : 72;
    if (Math.abs(this.currentFov - desiredFov) > 0.05) {
      this.currentFov = THREE.MathUtils.damp(this.currentFov, desiredFov, 14, dt);
      camera.fov = this.currentFov;
      camera.updateProjectionMatrix();
    }
  }

  private resolveCollisions(obstacles: ObstacleCollider[], barricades: ActiveBarricadeBox[]): void {
    const r = this.playerRadius;
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      if (this.position.y > obs.maxY) continue;

      if (obs.type === 'circle' && obs.radius) {
        const dx = this.position.x - obs.x;
        const dz = this.position.z - obs.z;
        const minDist = r + obs.radius;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist && distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = (minDist - dist) / dist;
          this.position.x += dx * push;
          this.position.z += dz * push;
        }
      } else if (obs.type === 'box' && obs.halfW && obs.halfD) {
        this.pushOutAABB(obs.x, obs.z, obs.halfW, obs.halfD, r);
      }
    }

    for (let i = 0; i < barricades.length; i++) {
      const b = barricades[i];
      this.pushOutAABB(b.x, b.z, b.halfW, b.halfD, r);
    }
  }

  private pushOutAABB(cx: number, cz: number, hw: number, hd: number, r: number): void {
    const closestX = THREE.MathUtils.clamp(this.position.x, cx - hw, cx + hw);
    const closestZ = THREE.MathUtils.clamp(this.position.z, cz - hd, cz + hd);
    const dx = this.position.x - closestX;
    const dz = this.position.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < r * r) {
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = (r - dist) / dist;
        this.position.x += dx * push;
        this.position.z += dz * push;
      } else {
        // Inside AABB fallback: push along shallower axis
        const penX = hw + r - Math.abs(this.position.x - cx);
        const penZ = hd + r - Math.abs(this.position.z - cz);
        if (penX < penZ) {
          this.position.x += this.position.x >= cx ? penX : -penX;
        } else {
          this.position.z += this.position.z >= cz ? penZ : -penZ;
        }
      }
    }
  }
}
