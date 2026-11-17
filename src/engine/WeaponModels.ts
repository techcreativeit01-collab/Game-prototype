import * as THREE from 'three';
import { AttachmentId, WeaponId, WeaponSkinId } from '../types/game';
import { WEAPON_SKINS_BY_ID } from '../data/WeaponData';

export interface WeaponViewModel {
  root: THREE.Group;
  muzzlePoint: THREE.Object3D;
  ejectPoint: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  flashlightLens?: THREE.Mesh;
  applyCustomization: (attachments: AttachmentId[], skinId: WeaponSkinId) => void;
  dispose: () => void;
}

function makeMat(
  color: number,
  roughness: number,
  metalness: number,
  emissive = 0x000000
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
  });
}

function makeBrushedMetal(
  color: number,
  roughness: number,
  metalness: number,
  roughnessMap?: THREE.Texture
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    roughnessMap: roughnessMap ?? null,
    anisotropy: 0.72,
    clearcoat: 0.22,
    clearcoatRoughness: 0.28,
  });
}

function addBox(
  group: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  group.add(mesh);
  return mesh;
}

function addCyl(
  group: THREE.Group,
  rt: number,
  rb: number,
  len: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  rx = Math.PI / 2,
  ry = 0,
  rz = 0,
  segs = 12
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, segs), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  group.add(mesh);
  return mesh;
}

function addPicatinnyRail(
  group: THREE.Group,
  zStart: number,
  teeth: number,
  yPos: number,
  mat: THREE.Material
): void {
  for (let i = 0; i < teeth; i++) {
    addBox(group, 0.02, 0.008, 0.01, 0, yPos, zStart - i * 0.018, mat);
  }
}

function addTacticalHands(root: THREE.Group, weaponId: WeaponId): void {
  const sleeveMat = makeMat(0x212722, 0.88, 0.04);
  const gloveMat = makeMat(0x16181d, 0.72, 0.12);
  const knuckleMat = makeMat(0x2e333c, 0.45, 0.35);

  if (weaponId === WeaponId.KATANA) {
    addCyl(root, 0.036, 0.046, 0.34, 0.04, -0.32, 0.09, sleeveMat, 0.6, 0, -0.22, 10);
    addBox(root, 0.056, 0.075, 0.064, 0, -0.14, 0.01, gloveMat);
    addBox(root, 0.058, 0.02, 0.02, 0, -0.11, -0.025, knuckleMat);
    return;
  }

  const gripZ = weaponId === WeaponId.M1911 ? 0.045 : weaponId === WeaponId.M2 ? 0.26 : 0.1;
  const gripY = weaponId === WeaponId.M2 ? 0.01 : -0.055;
  addBox(root, 0.052, 0.068, 0.068, 0.008, gripY, gripZ, gloveMat, 0.2, 0, 0);
  addBox(root, 0.054, 0.018, 0.024, 0.008, gripY + 0.015, gripZ - 0.02, knuckleMat);
  addCyl(
    root,
    0.038,
    0.048,
    0.34,
    0.09,
    gripY - 0.08,
    gripZ + 0.16,
    sleeveMat,
    1.15,
    0,
    -0.38,
    10
  );

  if (weaponId !== WeaponId.M1911) {
    const supZ = weaponId === WeaponId.M2 ? 0.26 : weaponId === WeaponId.UZI ? -0.22 : -0.21;
    const supX = weaponId === WeaponId.M2 ? -0.05 : -0.015;
    const supY = weaponId === WeaponId.M2 ? 0.01 : -0.012;
    addBox(root, 0.058, 0.048, 0.072, supX, supY, supZ, gloveMat);
    addBox(root, 0.06, 0.016, 0.022, supX - 0.005, supY - 0.012, supZ, knuckleMat);
    addCyl(
      root,
      0.038,
      0.048,
      0.38,
      supX - 0.13,
      supY - 0.09,
      supZ + 0.22,
      sleeveMat,
      1.18,
      0,
      0.48,
      10
    );
  }
}

export function createWeaponViewModel(
  weaponId: WeaponId,
  brushedMetalTex?: THREE.Texture,
  isSoftwareGl = false
): WeaponViewModel {
  const root = new THREE.Group();
  const receiverMetal = makeBrushedMetal(0x2a303a, 0.28, 0.9, brushedMetalTex);
  const darkSteel = makeBrushedMetal(0x20242c, 0.3, 0.9, brushedMetalTex);
  const gunmetal = makeBrushedMetal(0x3a404a, 0.24, 0.92, brushedMetalTex);
  const brightSteel = makeBrushedMetal(0xc9d2dc, 0.14, 0.96, brushedMetalTex);
  const polymer = makeMat(0x16181c, 0.78, 0.08);
  const wood = makeMat(0x5b3720, 0.72, 0.04);
  const brass = makeBrushedMetal(0xc4973c, 0.22, 0.94, brushedMetalTex);
  const opticRed = makeMat(0xef4444, 0.2, 0.2, 0xb91c1c);
  const wrapDark = makeMat(0x1e1918, 0.88, 0.05);
  const lensGlass = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.05,
    metalness: 0.1,
    clearcoat: 1.0,
    transmission: isSoftwareGl ? 0 : 0.82,
    transparent: true,
    opacity: isSoftwareGl ? 0.45 : 1.0,
    ior: 1.52,
  });

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.03, -0.55);
  root.add(muzzlePoint);

  const ejectPoint = new THREE.Object3D();
  ejectPoint.position.set(0.032, 0.038, -0.02);
  root.add(ejectPoint);

  let flashlightLens: THREE.Mesh | undefined;
  let opticY = 0.068;
  let opticZ = 0.0;
  let suppressorZ = -0.6;
  let suppressorY = 0.025;
  let magMesh: THREE.Mesh | undefined;
  let gripZ = -0.22;
  let gripY = -0.02;

  switch (weaponId) {
    case WeaponId.KATANA: {
      addCyl(root, 0.017, 0.019, 0.24, 0, -0.14, 0, wrapDark, 0, 0, 0, 10);
      for (let i = 0; i < 6; i++) {
        addBox(root, 0.037, 0.012, 0.024, 0, -0.22 + i * 0.032, 0, brass, 0, Math.PI / 4, 0);
      }
      addCyl(root, 0.02, 0.018, 0.024, 0, -0.265, 0, brass, 0, 0, 0, 12);
      addCyl(root, 0.054, 0.054, 0.012, 0, -0.01, 0, brass, 0, 0, 0, 16);
      addBox(root, 0.024, 0.026, 0.034, 0, 0.012, 0, brass);
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(0, 0.025);
      bladeShape.lineTo(0.026, 0.025);
      bladeShape.quadraticCurveTo(0.032, 0.36, 0.016, 0.72);
      bladeShape.lineTo(-0.008, 0.76);
      bladeShape.quadraticCurveTo(0.005, 0.38, 0, 0.025);
      const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.005,
        bevelEnabled: true,
        bevelThickness: 0.002,
        bevelSize: 0.002,
        bevelSegments: 2,
      });
      bladeGeo.center();
      const bladeMesh = new THREE.Mesh(bladeGeo, brightSteel);
      bladeMesh.position.set(0, 0.38, -0.01);
      bladeMesh.rotation.y = Math.PI / 2;
      root.add(bladeMesh);

      root.position.set(0.28, -0.24, -0.45);
      root.rotation.set(-0.45, -0.25, 0.18);
      break;
    }

    case WeaponId.M1911: {
      addBox(root, 0.036, 0.032, 0.24, 0, 0.035, -0.06, receiverMetal);
      addBox(root, 0.032, 0.022, 0.19, 0, 0.01, -0.04, darkSteel);
      addBox(root, 0.03, 0.11, 0.044, 0, -0.05, 0.035, wood, 0.22, 0, 0);
      addBox(root, 0.014, 0.025, 0.045, 0, -0.015, -0.02, darkSteel);
      addCyl(root, 0.009, 0.009, 0.06, 0, 0.036, -0.19, brightSteel);
      addBox(root, 0.006, 0.01, 0.012, 0, 0.055, -0.16, opticRed);
      addBox(root, 0.018, 0.009, 0.01, 0, 0.055, 0.04, darkSteel);
      for (let s = 0; s < 5; s++) {
        addBox(root, 0.038, 0.024, 0.005, 0, 0.035, 0.01 + s * 0.01, darkSteel);
      }
      muzzlePoint.position.set(0, 0.036, -0.23);
      ejectPoint.position.set(0.024, 0.042, -0.05);
      opticY = 0.056;
      opticZ = -0.04;
      suppressorZ = -0.26;
      suppressorY = 0.036;
      break;
    }

    case WeaponId.UZI: {
      addBox(root, 0.046, 0.062, 0.28, 0, 0.02, -0.05, receiverMetal);
      addBox(root, 0.034, 0.12, 0.048, 0, -0.06, -0.02, polymer, 0.1, 0, 0);
      magMesh = addBox(root, 0.024, 0.18, 0.034, 0, -0.14, -0.03, gunmetal, 0.1, 0, 0);
      addBox(root, 0.04, 0.042, 0.12, 0, 0.012, -0.22, polymer);
      addCyl(root, 0.012, 0.012, 0.14, 0, 0.022, -0.29, brightSteel);
      addBox(root, 0.018, 0.018, 0.14, 0, 0.015, 0.15, gunmetal);
      addBox(root, 0.01, 0.018, 0.014, 0, 0.06, -0.16, brightSteel);
      addPicatinnyRail(root, 0.02, 7, 0.055, gunmetal);
      muzzlePoint.position.set(0, 0.022, -0.37);
      ejectPoint.position.set(0.028, 0.03, -0.05);
      opticY = 0.064;
      opticZ = -0.03;
      suppressorZ = -0.43;
      suppressorY = 0.022;
      gripZ = -0.22;
      gripY = -0.02;
      break;
    }

    case WeaponId.BENELLI_M4: {
      addBox(root, 0.048, 0.065, 0.24, 0, 0.02, 0.02, receiverMetal);
      addCyl(root, 0.014, 0.014, 0.48, 0, 0.036, -0.32, gunmetal);
      addCyl(root, 0.012, 0.012, 0.44, 0, 0.01, -0.3, darkSteel);
      addBox(root, 0.044, 0.042, 0.19, 0, 0.008, -0.22, polymer);
      addBox(root, 0.036, 0.09, 0.044, 0, -0.045, 0.12, polymer, 0.28, 0, 0);
      addBox(root, 0.038, 0.065, 0.22, 0, -0.005, 0.24, polymer);
      addPicatinnyRail(root, 0.08, 6, 0.058, gunmetal);
      addBox(root, 0.008, 0.014, 0.014, 0, 0.055, -0.53, opticRed);
      for (let s = 0; s < 4; s++) {
        addCyl(
          root,
          0.007,
          0.007,
          0.042,
          -0.028,
          0.022,
          -0.04 + s * 0.022,
          opticRed,
          0,
          0,
          0,
          8
        );
      }
      muzzlePoint.position.set(0, 0.036, -0.58);
      ejectPoint.position.set(0.028, 0.032, 0.0);
      opticY = 0.068;
      opticZ = 0.02;
      gripZ = -0.22;
      gripY = -0.02;
      break;
    }

    case WeaponId.AK74: {
      addBox(root, 0.044, 0.062, 0.28, 0, 0.018, 0.02, receiverMetal);
      addBox(root, 0.042, 0.046, 0.2, 0, 0.012, -0.22, wood);
      addBox(root, 0.038, 0.068, 0.24, 0, -0.012, 0.26, wood, -0.08, 0, 0);
      addBox(root, 0.03, 0.095, 0.04, 0, -0.05, 0.1, wood, 0.24, 0, 0);
      addCyl(root, 0.01, 0.01, 0.34, 0, 0.02, -0.38, gunmetal);
      addCyl(root, 0.011, 0.011, 0.2, 0, 0.04, -0.24, darkSteel);
      addCyl(root, 0.015, 0.013, 0.055, 0, 0.02, -0.55, darkSteel);
      magMesh = addBox(
        root,
        0.028,
        0.12,
        0.055,
        0,
        -0.07,
        -0.07,
        makeMat(0x7c3f1c, 0.65, 0.08),
        -0.18,
        0,
        0
      );
      addBox(
        root,
        0.028,
        0.1,
        0.052,
        0,
        -0.15,
        -0.1,
        makeMat(0x7c3f1c, 0.65, 0.08),
        -0.38,
        0,
        0
      );
      muzzlePoint.position.set(0, 0.02, -0.59);
      ejectPoint.position.set(0.028, 0.035, -0.01);
      opticY = 0.058;
      opticZ = 0.01;
      suppressorZ = -0.64;
      suppressorY = 0.02;
      gripZ = -0.22;
      gripY = -0.02;
      break;
    }

    case WeaponId.M4: {
      addBox(root, 0.044, 0.066, 0.24, 0, 0.02, 0.02, receiverMetal);
      addBox(root, 0.048, 0.048, 0.22, 0, 0.024, -0.21, gunmetal);
      addCyl(root, 0.01, 0.01, 0.26, 0, 0.024, -0.4, darkSteel);
      addCyl(root, 0.013, 0.013, 0.045, 0, 0.024, -0.53, gunmetal);
      magMesh = addBox(root, 0.028, 0.14, 0.056, 0, -0.08, -0.05, gunmetal, -0.12, 0, 0);
      addBox(root, 0.032, 0.095, 0.04, 0, -0.05, 0.1, polymer, 0.25, 0, 0);
      addBox(root, 0.04, 0.07, 0.2, 0, 0.01, 0.24, polymer);
      addPicatinnyRail(root, -0.11, 8, 0.056, darkSteel);
      muzzlePoint.position.set(0, 0.024, -0.56);
      ejectPoint.position.set(0.028, 0.032, -0.02);
      opticY = 0.068;
      opticZ = 0.01;
      suppressorZ = -0.61;
      suppressorY = 0.024;
      gripZ = -0.22;
      gripY = -0.018;
      break;
    }

    case WeaponId.M107: {
      addBox(root, 0.056, 0.076, 0.34, 0, 0.02, 0.02, receiverMetal);
      addCyl(root, 0.015, 0.017, 0.62, 0, 0.034, -0.44, gunmetal);
      addBox(root, 0.044, 0.032, 0.085, 0, 0.034, -0.77, darkSteel);
      magMesh = addBox(root, 0.034, 0.11, 0.09, 0, -0.07, -0.06, darkSteel);
      addBox(root, 0.032, 0.095, 0.042, 0, -0.05, 0.12, polymer, 0.22, 0, 0);
      addBox(root, 0.048, 0.078, 0.24, 0, 0.012, 0.28, polymer);
      addCyl(root, 0.02, 0.02, 0.26, 0, 0.085, -0.04, darkSteel);
      addCyl(root, 0.028, 0.022, 0.08, 0, 0.085, -0.19, gunmetal);
      addCyl(root, 0.024, 0.024, 0.006, 0, 0.085, -0.23, lensGlass);
      addCyl(root, 0.018, 0.018, 0.006, 0, 0.085, 0.09, lensGlass);
      addPicatinnyRail(root, 0.16, 12, 0.06, gunmetal);
      addBox(root, 0.016, 0.025, 0.16, -0.028, -0.01, -0.35, gunmetal);
      addBox(root, 0.016, 0.025, 0.16, 0.028, -0.01, -0.35, gunmetal);
      muzzlePoint.position.set(0, 0.034, -0.83);
      ejectPoint.position.set(0.034, 0.035, -0.04);
      opticY = 0.095;
      opticZ = -0.02;
      suppressorZ = -0.87;
      suppressorY = 0.034;
      gripZ = -0.28;
      gripY = -0.015;
      break;
    }

    case WeaponId.M249: {
      addBox(root, 0.068, 0.08, 0.32, 0, 0.02, 0.0, receiverMetal);
      addBox(root, 0.058, 0.056, 0.26, 0, 0.028, -0.28, gunmetal);
      addCyl(root, 0.013, 0.013, 0.34, 0, 0.028, -0.44, brightSteel);
      magMesh = addBox(
        root,
        0.08,
        0.11,
        0.12,
        -0.05,
        -0.06,
        -0.08,
        makeMat(0x2e4028, 0.72, 0.12)
      );
      for (let b = 0; b < 4; b++) {
        addCyl(
          root,
          0.005,
          0.005,
          0.035,
          -0.045 + b * 0.012,
          0.018,
          -0.08,
          brass,
          0,
          0,
          Math.PI / 2,
          6
        );
      }
      addBox(root, 0.018, 0.05, 0.12, 0.025, 0.08, -0.15, polymer);
      addBox(root, 0.032, 0.095, 0.04, 0, -0.05, 0.1, polymer, 0.2, 0, 0);
      addBox(root, 0.048, 0.075, 0.22, 0, 0.01, 0.25, polymer);
      addPicatinnyRail(root, 0.1, 8, 0.064, gunmetal);
      muzzlePoint.position.set(0, 0.028, -0.63);
      ejectPoint.position.set(0.042, 0.03, -0.04);
      opticY = 0.074;
      opticZ = 0.01;
      gripZ = -0.28;
      gripY = -0.015;
      break;
    }

    case WeaponId.M2: {
      addBox(root, 0.095, 0.105, 0.42, 0, 0.02, 0.04, receiverMetal);
      addCyl(root, 0.026, 0.028, 0.26, 0, 0.03, -0.28, gunmetal);
      addCyl(root, 0.017, 0.018, 0.56, 0, 0.03, -0.52, brightSteel);
      addCyl(root, 0.024, 0.024, 0.06, 0, 0.03, -0.8, darkSteel);
      addCyl(root, 0.012, 0.012, 0.11, -0.048, 0.01, 0.27, polymer, 0, 0, 0);
      addCyl(root, 0.012, 0.012, 0.11, 0.048, 0.01, 0.27, polymer, 0, 0, 0);
      addBox(root, 0.055, 0.022, 0.03, 0, 0.02, 0.26, brass);
      magMesh = addBox(
        root,
        0.095,
        0.12,
        0.14,
        -0.095,
        -0.04,
        -0.04,
        makeMat(0x283525, 0.72, 0.15)
      );
      for (let b = 0; b < 4; b++) {
        addCyl(
          root,
          0.006,
          0.006,
          0.045,
          -0.065 + b * 0.014,
          0.032,
          -0.04,
          brass,
          0,
          0,
          Math.PI / 2,
          6
        );
      }
      muzzlePoint.position.set(0, 0.03, -0.84);
      ejectPoint.position.set(0.055, 0.03, 0.0);
      opticY = 0.084;
      opticZ = 0.04;
      break;
    }
  }

  // Modular 3D Attachment Sub-assemblies (toggled cleanly by player loadout)
  const redDotGroup = new THREE.Group();
  const scopeGroup = new THREE.Group();
  const suppressorGroup = new THREE.Group();
  const foregripGroup = new THREE.Group();

  if (weaponId !== WeaponId.KATANA) {
    // Red Dot Reflex Optic
    addBox(redDotGroup, 0.034, 0.03, 0.052, 0, opticY, opticZ, darkSteel);
    addBox(redDotGroup, 0.024, 0.02, 0.004, 0, opticY, opticZ - 0.024, lensGlass);
    addBox(redDotGroup, 0.004, 0.005, 0.004, 0, opticY + 0.002, opticZ, opticRed);
    redDotGroup.visible = weaponId === WeaponId.M4;
    root.add(redDotGroup);

    // 4x ACOG Magnified Scope
    addCyl(scopeGroup, 0.016, 0.016, 0.15, 0, opticY + 0.006, opticZ, darkSteel);
    addCyl(scopeGroup, 0.021, 0.017, 0.05, 0, opticY + 0.006, opticZ - 0.085, gunmetal);
    addCyl(scopeGroup, 0.017, 0.017, 0.005, 0, opticY + 0.006, opticZ - 0.11, lensGlass);
    scopeGroup.visible = false;
    root.add(scopeGroup);

    // Tactical Suppressor Cylinder
    addCyl(
      suppressorGroup,
      0.016,
      0.016,
      0.16,
      0,
      suppressorY,
      suppressorZ,
      darkSteel,
      Math.PI / 2,
      0,
      0,
      12
    );
    suppressorGroup.visible = false;
    root.add(suppressorGroup);

    // Angled Foregrip
    addBox(foregripGroup, 0.026, 0.072, 0.032, 0, gripY - 0.038, gripZ, polymer, -0.28, 0, 0);
    foregripGroup.visible = false;
    root.add(foregripGroup);

    // Side-mounted tactical flashlight module
    const flZ = weaponId === WeaponId.M1911 ? -0.11 : -0.28;
    const flX = weaponId === WeaponId.M2 ? 0.058 : 0.028;
    const flY = weaponId === WeaponId.M1911 ? 0.002 : 0.014;
    addCyl(root, 0.011, 0.011, 0.09, flX, flY, flZ, darkSteel, Math.PI / 2, 0, 0, 10);
    flashlightLens = addCyl(
      root,
      0.0095,
      0.0095,
      0.006,
      flX,
      flY,
      flZ - 0.046,
      makeMat(0xdbeafe, 0.1, 0.1, 0x93c5fd),
      Math.PI / 2,
      0,
      0,
      10
    );
  }

  addTacticalHands(root, weaponId);

  if (weaponId !== WeaponId.KATANA) {
    root.position.set(0.24, -0.22, -0.44);
  }

  const flashGeo = new THREE.OctahedronGeometry(0.075, 0);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffd07a,
    transparent: true,
    opacity: 0.94,
  });
  const muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlash.position.copy(muzzlePoint.position);
  muzzleFlash.scale.set(1.1, 1.1, 2.5);
  muzzleFlash.visible = false;
  root.add(muzzleFlash);

  const applyCustomization = (attachments: AttachmentId[], skinId: WeaponSkinId) => {
    const skin = WEAPON_SKINS_BY_ID[skinId] ?? WEAPON_SKINS_BY_ID.standard;
    receiverMetal.color.setHex(skin.tintHex);
    if (weaponId === WeaponId.KATANA) {
      brightSteel.color.setHex(skinId === 'standard' ? 0xc9d2dc : skin.accentHex);
    }

    if (weaponId !== WeaponId.KATANA) {
      const hasRedDot = attachments.includes('red_dot');
      const hasScope = attachments.includes('scope');
      const hasSupp = attachments.includes('suppressor');
      const hasExtMag = attachments.includes('extended_mag');
      const hasGrip = attachments.includes('foregrip');

      redDotGroup.visible = hasRedDot || (weaponId === WeaponId.M4 && !hasScope);
      scopeGroup.visible = hasScope && weaponId !== WeaponId.M107;
      suppressorGroup.visible = hasSupp;
      foregripGroup.visible = hasGrip;

      if (magMesh) {
        magMesh.scale.y = hasExtMag ? 1.38 : 1.0;
      }
    }
  };

  const dispose = () => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material.dispose();
      }
    });
  };

  return {
    root,
    muzzlePoint,
    ejectPoint,
    muzzleFlash,
    flashlightLens,
    applyCustomization,
    dispose,
  };
}

export function createGrenadeMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 10),
    makeMat(0x2c3b29, 0.68, 0.25)
  );
  body.scale.set(1, 1.25, 1);
  g.add(body);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.092, 0.092, 0.025, 10),
    makeMat(0xd97706, 0.4, 0.6)
  );
  g.add(band);
  const fuse = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.032, 0.05, 8),
    makeMat(0x7c828d, 0.35, 0.85)
  );
  fuse.position.y = 0.11;
  g.add(fuse);
  const spoon = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.09, 0.02),
    makeMat(0xa1a8b3, 0.3, 0.9)
  );
  spoon.position.set(0.05, 0.07, 0);
  spoon.rotation.z = -0.25;
  g.add(spoon);
  return g;
}

export function createBarricadeMesh(woodTex: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: 0x8b6c50,
    roughness: 0.85,
    metalness: 0.05,
  });
  const metalMat = makeMat(0x3a4048, 0.4, 0.85);

  [-1.1, 1.1].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.35, 0.18), woodMat);
    post.position.set(x, 0.675, 0);
    post.castShadow = true;
    post.receiveShadow = true;
    g.add(post);

    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.12), woodMat);
    brace.position.set(x, 0.5, -0.35);
    brace.rotation.x = 0.55;
    brace.castShadow = true;
    g.add(brace);

    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.16, 0.21), metalMat);
    bracket.position.set(x, 0.9, 0.04);
    g.add(bracket);
  });

  [0.35, 0.78, 1.18].forEach((y) => {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.22, 0.12), woodMat);
    plank.position.set(0, y, 0.08);
    plank.castShadow = true;
    plank.receiveShadow = true;
    g.add(plank);
  });

  for (let i = -3; i <= 3; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.24, 6), metalMat);
    spike.position.set(i * 0.35, 1.38, 0.08);
    g.add(spike);
  }

  return g;
}

export function createTurretMesh(): {
  group: THREE.Group;
  head: THREE.Group;
  muzzleFlash: THREE.Mesh;
} {
  const group = new THREE.Group();
  const darkMetal = makeMat(0x242933, 0.42, 0.85);
  const oliveArmor = makeMat(0x374334, 0.58, 0.35);
  const brightSteel = makeMat(0x9ca6b3, 0.22, 0.94);
  const sensorRed = makeMat(0xff2a2a, 0.2, 0.1, 0xdc2626);

  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), darkMetal);
    leg.position.set(Math.sin(angle) * 0.28, 0.42, Math.cos(angle) * 0.28);
    leg.rotation.x = Math.cos(angle) * 0.42;
    leg.rotation.z = -Math.sin(angle) * 0.42;
    leg.castShadow = true;
    group.add(leg);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.05, 8), darkMetal);
    pad.position.set(Math.sin(angle) * 0.44, 0.025, Math.cos(angle) * 0.44);
    group.add(pad);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.24, 12), darkMetal);
  hub.position.y = 0.85;
  hub.castShadow = true;
  group.add(hub);

  const head = new THREE.Group();
  head.position.y = 1.06;
  group.add(head);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.44), oliveArmor);
  housing.castShadow = true;
  head.add(housing);

  const ammoDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 10), darkMetal);
  ammoDrum.rotation.z = Math.PI / 2;
  ammoDrum.position.set(-0.24, -0.02, 0.04);
  head.add(ammoDrum);

  const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 10), brightSteel);
  barrelL.rotation.x = Math.PI / 2;
  barrelL.position.set(-0.07, 0.01, -0.45);
  head.add(barrelL);

  const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 10), brightSteel);
  barrelR.rotation.x = Math.PI / 2;
  barrelR.position.set(0.07, 0.01, -0.45);
  head.add(barrelR);

  const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), sensorRed);
  sensor.position.set(0, 0.14, -0.16);
  head.add(sensor);

  const muzzleFlash = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.11, 0),
    new THREE.MeshBasicMaterial({ color: 0xffd27a })
  );
  muzzleFlash.position.set(0, 0.01, -0.78);
  muzzleFlash.visible = false;
  head.add(muzzleFlash);

  return { group, head, muzzleFlash };
}
