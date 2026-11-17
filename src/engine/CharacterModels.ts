import * as THREE from 'three';
import { CharacterSkinId, WeaponId } from '../types/game';
import { CHARACTER_SKINS_BY_ID } from '../data/GameData';

export interface HumanCharacterRig {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  weaponGroup: THREE.Group;
  muzzleFlash: THREE.Mesh;
  nametag?: THREE.Sprite;
  materials: THREE.Material[];
  geometries: THREE.BufferGeometry[];
  setSkin: (skinId: CharacterSkinId) => void;
  setWeapon: (weaponId: WeaponId) => void;
  dispose: () => void;
}

export function createNametagSprite(username: string, isAlly = true): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 64);

  ctx.fillStyle = 'rgba(8, 11, 18, 0.82)';
  ctx.beginPath();
  ctx.roundRect(16, 12, 224, 38, 8);
  ctx.fill();

  ctx.strokeStyle = isAlly ? 'rgba(56, 189, 248, 0.7)' : 'rgba(239, 68, 68, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(username.slice(0, 14), 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.4, 1);
  sprite.position.set(0, 2.28, 0);
  return sprite;
}

export function createHumanCharacterRig(
  skinId: CharacterSkinId = 'ranger',
  weaponId: WeaponId = WeaponId.M4,
  nametagLabel?: string,
  isAlly = true
): HumanCharacterRig {
  const skin = CHARACTER_SKINS_BY_ID[skinId] ?? CHARACTER_SKINS_BY_ID.ranger;
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const jacketMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: skin.primaryHex,
      roughness: 0.78,
      metalness: 0.08,
    })
  );
  const armorMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: skin.secondaryHex,
      roughness: 0.56,
      metalness: 0.25,
    })
  );
  const accentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: skin.accentHex,
      roughness: 0.42,
      metalness: 0.55,
      emissive: new THREE.Color(skin.accentHex).multiplyScalar(0.12),
    })
  );
  const skinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc99c7e,
      roughness: 0.65,
      metalness: 0.02,
    })
  );
  const darkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x16191f,
      roughness: 0.75,
      metalness: 0.15,
    })
  );
  const gunMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x222730,
      roughness: 0.35,
      metalness: 0.85,
    })
  );

  const root = new THREE.Group();

  // Pelvis + Belt
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.94, 0);
  root.add(pelvis);

  const hipMesh = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.145, 0.2, 10)), armorMat);
  hipMesh.scale.set(1.12, 1, 0.82);
  hipMesh.castShadow = true;
  pelvis.add(hipMesh);

  const belt = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.172, 0.172, 0.055, 10)), darkMat);
  belt.scale.set(1.12, 1, 0.84);
  belt.position.y = 0.06;
  pelvis.add(belt);

  // Legs with thighs, knee pads, shins, and combat boots
  const buildLeg = (side: -1 | 1): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.115, 0.92, 0);

    const thigh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.072, 0.34, 4, 8)),
      jacketMat
    );
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    leg.add(thigh);

    const kneePad = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.095, 0.1, 0.08)),
      armorMat
    );
    kneePad.position.set(0, -0.43, 0.04);
    leg.add(kneePad);

    const shin = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.058, 0.32, 4, 8)),
      jacketMat
    );
    shin.position.y = -0.64;
    shin.castShadow = true;
    leg.add(shin);

    const boot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.11, 0.22)), darkMat);
    boot.position.set(0, -0.86, 0.045);
    boot.castShadow = true;
    leg.add(boot);

    root.add(leg);
    return leg;
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Torso + Ballistic Plate Carrier + Pouches
  const torso = new THREE.Group();
  torso.position.set(0, 1.0, 0);
  root.add(torso);

  const chestCore = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.195, 0.155, 0.56, 10)),
    jacketMat
  );
  chestCore.scale.set(1.15, 1, 0.78);
  chestCore.position.y = 0.28;
  chestCore.castShadow = true;
  torso.add(chestCore);

  const vest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.42, 0.28)), armorMat);
  vest.position.set(0, 0.32, 0.01);
  vest.castShadow = true;
  torso.add(vest);

  // Magazine pouches & shoulder plates
  [-0.09, 0, 0.09].forEach((px) => {
    const pouch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.068, 0.12, 0.045)), accentMat);
    pouch.position.set(px, 0.21, 0.155);
    torso.add(pouch);
  });

  const backpack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.36, 0.14)), armorMat);
  backpack.position.set(0, 0.33, -0.18);
  backpack.castShadow = true;
  torso.add(backpack);

  // Neck + Sculpted Head + Tactical Helmet + NVG Visor
  const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.056, 0.065, 0.1, 8)), skinMat);
  neck.position.set(0, 0.6, 0.01);
  torso.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.65, 0.01);
  torso.add(head);

  const cranium = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.125, 12, 10)), skinMat);
  cranium.scale.set(0.92, 1.08, 0.98);
  cranium.position.y = 0.13;
  cranium.castShadow = true;
  head.add(cranium);

  const jaw = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.09, 0.14)), skinMat);
  jaw.position.set(0, 0.06, 0.03);
  head.add(jaw);

  const mask = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.15, 0.08, 0.11)), darkMat);
  mask.position.set(0, 0.075, 0.055);
  head.add(mask);

  const helmet = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.142, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58)),
    armorMat
  );
  helmet.position.set(0, 0.155, -0.005);
  helmet.castShadow = true;
  head.add(helmet);

  const visor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.17, 0.048, 0.055)), accentMat);
  visor.position.set(0, 0.145, 0.115);
  head.add(visor);

  // Articulated Arms + Gloved Hands
  const buildArm = (side: -1 | 1) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.245, 0.51, 0);

    const shoulderPad = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.078, 8, 8)), armorMat);
    arm.add(shoulderPad);

    const upperArm = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.054, 0.24, 4, 8)),
      jacketMat
    );
    upperArm.position.y = -0.15;
    upperArm.castShadow = true;
    arm.add(upperArm);

    const forearm = new THREE.Group();
    forearm.position.set(0, -0.29, 0);
    arm.add(forearm);

    const lowerMesh = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.046, 0.22, 4, 8)),
      jacketMat
    );
    lowerMesh.position.y = -0.12;
    forearm.add(lowerMesh);

    const glove = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.072, 0.085, 0.078)), darkMat);
    glove.position.set(0, -0.26, 0.015);
    forearm.add(glove);

    torso.add(arm);
    return { arm, forearm };
  };

  const leftBuilt = buildArm(-1);
  const rightBuilt = buildArm(1);

  // Held tactical weapon attached to right forearm hand
  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(-0.02, -0.27, 0.08);
  rightBuilt.forearm.add(weaponGroup);

  const receiver = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.09, 0.42)), gunMat);
  receiver.position.set(0, 0, 0.14);
  weaponGroup.add(receiver);

  const barrel = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8)),
    gunMat
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.018, 0.48);
  weaponGroup.add(barrel);

  const mag = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.032, 0.14, 0.06)), darkMat);
  mag.position.set(0, -0.09, 0.18);
  mag.rotation.x = 0.2;
  weaponGroup.add(mag);

  const katanaBlade = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.014, 0.04, 0.78)),
    trackMat(new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.94, roughness: 0.18 }))
  );
  katanaBlade.position.set(0, 0.02, 0.42);
  katanaBlade.visible = false;
  weaponGroup.add(katanaBlade);

  const muzzleFlash = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.09, 0)),
    trackMat(new THREE.MeshBasicMaterial({ color: 0xffd07a }))
  );
  muzzleFlash.position.set(0, 0.02, 0.68);
  muzzleFlash.visible = false;
  weaponGroup.add(muzzleFlash);

  let nametag: THREE.Sprite | undefined;
  if (nametagLabel) {
    nametag = createNametagSprite(nametagLabel, isAlly);
    root.add(nametag);
  }

  const setSkin = (nextSkinId: CharacterSkinId) => {
    const s = CHARACTER_SKINS_BY_ID[nextSkinId] ?? CHARACTER_SKINS_BY_ID.ranger;
    jacketMat.color.setHex(s.primaryHex);
    armorMat.color.setHex(s.secondaryHex);
    accentMat.color.setHex(s.accentHex);
    accentMat.emissive.setHex(s.accentHex).multiplyScalar(0.12);
  };

  const setWeapon = (wId: WeaponId) => {
    const isKatana = wId === WeaponId.KATANA;
    receiver.visible = !isKatana;
    barrel.visible = !isKatana;
    mag.visible = !isKatana;
    katanaBlade.visible = isKatana;
    if (wId === WeaponId.M1911) {
      receiver.scale.set(0.75, 0.75, 0.48);
      barrel.scale.set(0.8, 0.35, 0.8);
      barrel.position.z = 0.25;
      mag.visible = false;
    } else if (wId === WeaponId.M107 || wId === WeaponId.M2) {
      receiver.scale.set(1.2, 1.15, 1.25);
      barrel.scale.set(1.2, 1.45, 1.2);
      barrel.position.z = 0.58;
      mag.visible = true;
    } else {
      receiver.scale.set(1, 1, 1);
      barrel.scale.set(1, 1, 1);
      barrel.position.z = 0.48;
      mag.visible = true;
    }
  };

  setWeapon(weaponId);

  return {
    root,
    pelvis,
    torso,
    head,
    leftArm: leftBuilt.arm,
    rightArm: rightBuilt.arm,
    leftForearm: leftBuilt.forearm,
    rightForearm: rightBuilt.forearm,
    leftLeg,
    rightLeg,
    weaponGroup,
    muzzleFlash,
    nametag,
    materials,
    geometries,
    setSkin,
    setWeapon,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      if (nametag) {
        const sm = nametag.material as THREE.SpriteMaterial;
        sm.map?.dispose();
        sm.dispose();
      }
    },
  };
}

export function animateHumanRig(
  rig: HumanCharacterRig,
  dt: number,
  state: 'idle' | 'walk' | 'run' | 'aim' | 'dead',
  phase: number
): void {
  if (state === 'dead') {
    rig.root.rotation.x = THREE.MathUtils.damp(rig.root.rotation.x, -Math.PI * 0.48, 8, dt);
    return;
  }
  rig.root.rotation.x = THREE.MathUtils.damp(rig.root.rotation.x, 0, 10, dt);

  if (state === 'walk' || state === 'run') {
    const amp = state === 'run' ? 0.65 : 0.42;
    rig.leftLeg.rotation.x = Math.sin(phase) * amp;
    rig.rightLeg.rotation.x = -Math.sin(phase) * amp;
    rig.torso.rotation.x = state === 'run' ? 0.14 : 0.06;
    rig.torso.rotation.y = Math.cos(phase) * 0.08;
    // Weapon-ready grip pose
    rig.rightArm.rotation.set(-0.95, 0.15, 0);
    rig.rightForearm.rotation.set(-0.55, 0, 0);
    rig.leftArm.rotation.set(-1.05, -0.35, 0);
    rig.leftForearm.rotation.set(-0.45, 0, 0);
  } else {
    // Tactical combat idle stance
    const breathe = Math.sin(phase) * 0.025;
    rig.leftLeg.rotation.x = THREE.MathUtils.damp(rig.leftLeg.rotation.x, -0.06, 10, dt);
    rig.rightLeg.rotation.x = THREE.MathUtils.damp(rig.rightLeg.rotation.x, 0.08, 10, dt);
    rig.torso.rotation.x = 0.03 + breathe;
    rig.torso.rotation.y = Math.sin(phase * 0.5) * 0.05;
    rig.head.rotation.y = Math.sin(phase * 0.35) * 0.12;
    rig.rightArm.rotation.set(-0.82 + breathe, 0.18, 0.05);
    rig.rightForearm.rotation.set(-0.58, 0, 0);
    rig.leftArm.rotation.set(-0.95 - breathe, -0.38, -0.05);
    rig.leftForearm.rotation.set(-0.52, 0, 0);
  }
}
