import * as THREE from 'three';
import { WeaponId } from '../types/game';

export interface WeaponViewModel {
  root: THREE.Group;
  muzzlePoint: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
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

export function createWeaponViewModel(weaponId: WeaponId): WeaponViewModel {
  const root = new THREE.Group();
  const darkSteel = makeMat(0x23272e, 0.35, 0.88);
  const gunmetal = makeMat(0x3a404a, 0.32, 0.85);
  const brightSteel = makeMat(0xb8c2cc, 0.16, 0.96);
  const polymer = makeMat(0x16181c, 0.78, 0.08);
  const wood = makeMat(0x5b3720, 0.72, 0.04);
  const brass = makeMat(0xb68d3a, 0.28, 0.9);
  const opticRed = makeMat(0xef4444, 0.2, 0.2, 0xb91c1c);
  const wrapDark = makeMat(0x1e1918, 0.88, 0.05);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.03, -0.55);
  root.add(muzzlePoint);

  switch (weaponId) {
    case WeaponId.KATANA: {
      // Composite curved Japanese katana: tsuka hilt, diamond wrap rings, tsuba guard, habaki collar, forged steel blade
      addCyl(root, 0.017, 0.019, 0.24, 0, -0.14, 0, wrapDark, 0, 0, 0, 10);
      for (let i = 0; i < 6; i++) {
        addBox(root, 0.037, 0.012, 0.024, 0, -0.22 + i * 0.032, 0, brass, 0, Math.PI / 4, 0);
      }
      // Tsuba handguard
      addCyl(root, 0.052, 0.052, 0.012, 0, -0.01, 0, brass, 0, 0, 0, 16);
      // Habaki blade collar
      addBox(root, 0.024, 0.026, 0.034, 0, 0.012, 0, brass);
      // Extruded bevelled blade with subtle curve
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

      // Default ready angle for katana
      root.position.set(0.28, -0.24, -0.45);
      root.rotation.set(-0.45, -0.25, 0.18);
      break;
    }

    case WeaponId.M1911: {
      // Frame, brushed slide, wood grip panels, trigger guard, barrel, sights
      addBox(root, 0.036, 0.032, 0.24, 0, 0.035, -0.06, gunmetal); // slide
      addBox(root, 0.032, 0.022, 0.19, 0, 0.01, -0.04, darkSteel); // frame
      addBox(root, 0.03, 0.11, 0.044, 0, -0.05, 0.035, wood, 0.22, 0, 0); // grip
      addBox(root, 0.014, 0.025, 0.045, 0, -0.015, -0.02, darkSteel); // trigger guard
      addCyl(root, 0.009, 0.009, 0.06, 0, 0.036, -0.19, brightSteel); // barrel tip
      addBox(root, 0.006, 0.01, 0.012, 0, 0.055, -0.16, brightSteel); // front sight
      addBox(root, 0.018, 0.009, 0.01, 0, 0.055, 0.04, darkSteel); // rear sight
      muzzlePoint.position.set(0, 0.036, -0.23);
      break;
    }

    case WeaponId.UZI: {
      // Stamped receiver, ribbed grip + stick mag, folding stock, barrel nut & shroud
      addBox(root, 0.046, 0.062, 0.28, 0, 0.02, -0.05, darkSteel);
      addBox(root, 0.034, 0.12, 0.048, 0, -0.06, -0.02, polymer, 0.1, 0, 0);
      addBox(root, 0.024, 0.18, 0.034, 0, -0.14, -0.03, gunmetal, 0.1, 0, 0); // magazine
      addBox(root, 0.04, 0.042, 0.12, 0, 0.012, -0.22, polymer); // forend
      addCyl(root, 0.012, 0.012, 0.14, 0, 0.022, -0.29, brightSteel); // barrel
      addBox(root, 0.018, 0.018, 0.14, 0, 0.015, 0.15, gunmetal); // folded stock strut
      addBox(root, 0.01, 0.018, 0.014, 0, 0.06, -0.16, brightSteel);
      muzzlePoint.position.set(0, 0.022, -0.37);
      break;
    }

    case WeaponId.BENELLI_M4: {
      // Shotgun receiver, heavy barrel, under-barrel tube mag, ribbed pump, tactical pistol-grip stock
      addBox(root, 0.048, 0.065, 0.24, 0, 0.02, 0.02, darkSteel);
      addCyl(root, 0.014, 0.014, 0.48, 0, 0.036, -0.32, gunmetal); // barrel
      addCyl(root, 0.012, 0.012, 0.44, 0, 0.01, -0.3, darkSteel); // mag tube
      addBox(root, 0.044, 0.042, 0.19, 0, 0.008, -0.22, polymer); // forend
      addBox(root, 0.036, 0.09, 0.044, 0, -0.045, 0.12, polymer, 0.28, 0, 0); // grip
      addBox(root, 0.038, 0.065, 0.22, 0, -0.005, 0.24, polymer); // stock
      addBox(root, 0.018, 0.012, 0.06, 0, 0.058, 0.02, gunmetal); // rail
      addBox(root, 0.008, 0.014, 0.014, 0, 0.055, -0.53, opticRed); // fiber front sight
      muzzlePoint.position.set(0, 0.036, -0.58);
      break;
    }

    case WeaponId.AK74: {
      // Receiver, wood stock + handguard, curved orange/brown bakelite banana mag, gas tube, muzzle brake
      addBox(root, 0.044, 0.062, 0.28, 0, 0.018, 0.02, darkSteel);
      addBox(root, 0.042, 0.046, 0.2, 0, 0.012, -0.22, wood); // handguard
      addBox(root, 0.038, 0.068, 0.24, 0, -0.012, 0.26, wood, -0.08, 0, 0); // stock
      addBox(root, 0.03, 0.095, 0.04, 0, -0.05, 0.1, wood, 0.24, 0, 0); // grip
      addCyl(root, 0.01, 0.01, 0.34, 0, 0.02, -0.38, gunmetal); // barrel
      addCyl(root, 0.011, 0.011, 0.2, 0, 0.04, -0.24, darkSteel); // gas tube
      addCyl(root, 0.015, 0.013, 0.055, 0, 0.02, -0.55, darkSteel); // muzzle brake
      // Curved banana mag
      addBox(root, 0.028, 0.12, 0.055, 0, -0.07, -0.07, makeMat(0x7c3f1c, 0.65, 0.08), -0.18, 0, 0);
      addBox(root, 0.028, 0.1, 0.052, 0, -0.15, -0.1, makeMat(0x7c3f1c, 0.65, 0.08), -0.38, 0, 0);
      muzzlePoint.position.set(0, 0.02, -0.59);
      break;
    }

    case WeaponId.M4: {
      // Upper/lower receiver, quad rail, holographic sight, STANAG mag, collapsible stock
      addBox(root, 0.044, 0.066, 0.24, 0, 0.02, 0.02, darkSteel);
      addBox(root, 0.048, 0.048, 0.22, 0, 0.024, -0.21, gunmetal); // quad-rail
      addCyl(root, 0.01, 0.01, 0.26, 0, 0.024, -0.4, darkSteel); // barrel
      addCyl(root, 0.013, 0.013, 0.045, 0, 0.024, -0.53, gunmetal); // flash hider
      addBox(root, 0.028, 0.14, 0.056, 0, -0.08, -0.05, gunmetal, -0.12, 0, 0); // mag
      addBox(root, 0.032, 0.095, 0.04, 0, -0.05, 0.1, polymer, 0.25, 0, 0); // grip
      addBox(root, 0.04, 0.07, 0.2, 0, 0.01, 0.24, polymer); // crane stock
      // Holo optic
      addBox(root, 0.038, 0.038, 0.065, 0, 0.07, 0.02, darkSteel);
      addBox(root, 0.004, 0.008, 0.004, 0, 0.072, 0.02, opticRed);
      muzzlePoint.position.set(0, 0.024, -0.56);
      break;
    }

    case WeaponId.M107: {
      // Long anti-materiel sniper: massive receiver, fluted barrel, rectangular tank muzzle brake, optic scope, folded bipod
      addBox(root, 0.056, 0.076, 0.34, 0, 0.02, 0.02, darkSteel);
      addCyl(root, 0.015, 0.017, 0.62, 0, 0.034, -0.44, gunmetal); // heavy barrel
      addBox(root, 0.044, 0.032, 0.085, 0, 0.034, -0.77, darkSteel); // .50 cal muzzle brake
      addBox(root, 0.034, 0.11, 0.09, 0, -0.07, -0.06, darkSteel); // box mag
      addBox(root, 0.032, 0.095, 0.042, 0, -0.05, 0.12, polymer, 0.22, 0, 0); // grip
      addBox(root, 0.048, 0.078, 0.24, 0, 0.012, 0.28, polymer); // stock
      // High-power scope
      addCyl(root, 0.02, 0.02, 0.26, 0, 0.085, -0.04, darkSteel);
      addCyl(root, 0.028, 0.022, 0.08, 0, 0.085, -0.19, gunmetal); // objective bell
      addBox(root, 0.016, 0.025, 0.16, -0.028, -0.01, -0.35, gunmetal); // folded bipod left
      addBox(root, 0.016, 0.025, 0.16, 0.028, -0.01, -0.35, gunmetal); // folded bipod right
      muzzlePoint.position.set(0, 0.034, -0.83);
      break;
    }

    case WeaponId.M249: {
      // Squad Automatic Weapon: chunky receiver, perforated barrel shroud, 100-rd green ammo box + brass belt, carry handle
      addBox(root, 0.068, 0.08, 0.32, 0, 0.02, 0.0, darkSteel);
      addBox(root, 0.058, 0.056, 0.26, 0, 0.028, -0.28, gunmetal); // heat shield
      addCyl(root, 0.013, 0.013, 0.34, 0, 0.028, -0.44, brightSteel); // barrel
      addBox(root, 0.08, 0.11, 0.12, -0.05, -0.06, -0.08, makeMat(0x2e4028, 0.72, 0.12)); // ammo drum box
      addBox(root, 0.04, 0.018, 0.04, -0.035, 0.015, -0.08, brass); // brass belt feed
      addBox(root, 0.018, 0.05, 0.12, 0.025, 0.08, -0.15, polymer); // carry handle
      addBox(root, 0.032, 0.095, 0.04, 0, -0.05, 0.1, polymer, 0.2, 0, 0);
      addBox(root, 0.048, 0.075, 0.22, 0, 0.01, 0.25, polymer);
      muzzlePoint.position.set(0, 0.028, -0.63);
      break;
    }

    case WeaponId.M2: {
      // M2 Browning Heavy Machine Gun: massive rectangular receiver, perforated heavy barrel jacket, dual spade grips, ammo feed chute
      addBox(root, 0.095, 0.105, 0.42, 0, 0.02, 0.04, darkSteel);
      addCyl(root, 0.026, 0.028, 0.26, 0, 0.03, -0.28, gunmetal); // barrel support shroud
      addCyl(root, 0.017, 0.018, 0.56, 0, 0.03, -0.52, brightSteel); // heavy .50 barrel
      addCyl(root, 0.024, 0.024, 0.06, 0, 0.03, -0.8, darkSteel); // flash cone
      // Dual spade grips at rear
      addCyl(root, 0.012, 0.012, 0.11, -0.048, 0.01, 0.27, polymer, 0, 0, 0);
      addCyl(root, 0.012, 0.012, 0.11, 0.048, 0.01, 0.27, polymer, 0, 0, 0);
      addBox(root, 0.055, 0.022, 0.03, 0, 0.02, 0.26, brass); // butterfly trigger
      addBox(root, 0.095, 0.12, 0.14, -0.095, -0.04, -0.04, makeMat(0x283525, 0.72, 0.15)); // .50 cal ammo can
      addBox(root, 0.05, 0.02, 0.06, -0.055, 0.03, -0.04, brass); // ammo belt
      muzzlePoint.position.set(0, 0.03, -0.84);
      break;
    }
  }

  if (weaponId !== WeaponId.KATANA) {
    root.position.set(0.24, -0.22, -0.44);
  }

  // Muzzle flash star mesh
  const flashGeo = new THREE.OctahedronGeometry(0.065, 0);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffc66d,
    transparent: true,
    opacity: 0.92,
  });
  const muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
  muzzleFlash.position.copy(muzzlePoint.position);
  muzzleFlash.scale.set(1, 1, 2.2);
  muzzleFlash.visible = false;
  root.add(muzzleFlash);

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

  return { root, muzzlePoint, muzzleFlash, dispose };
}

export function createGrenadeMesh(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 10),
    makeMat(0x2c3b29, 0.68, 0.25)
  );
  body.scale.set(1, 1.25, 1);
  g.add(body);
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
  const metalMat = makeMat(0x3a4048, 0.45, 0.8);

  // Two A-frame posts + 3 heavy horizontal timber beams + steel brackets
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
  });

  [0.35, 0.78, 1.18].forEach((y) => {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.22, 0.12), woodMat);
    plank.position.set(0, y, 0.08);
    plank.castShadow = true;
    plank.receiveShadow = true;
    g.add(plank);
  });

  // Top spikes
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
  const brightSteel = makeMat(0x9ca6b3, 0.25, 0.92);
  const sensorRed = makeMat(0xff2a2a, 0.2, 0.1, 0xdc2626);

  // Tripod legs pivoted on ground
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), darkMetal);
    leg.position.set(Math.sin(angle) * 0.28, 0.42, Math.cos(angle) * 0.28);
    leg.rotation.x = Math.cos(angle) * 0.42;
    leg.rotation.z = -Math.sin(angle) * 0.42;
    leg.castShadow = true;
    group.add(leg);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.24, 12), darkMetal);
  hub.position.y = 0.85;
  hub.castShadow = true;
  group.add(hub);

  // Rotating turret head
  const head = new THREE.Group();
  head.position.y = 1.06;
  group.add(head);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.44), oliveArmor);
  housing.castShadow = true;
  head.add(housing);

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
