import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GraphicsQuality } from '../types/game';
import { ForestTextureSet } from './ProceduralTextures';

export interface ObstacleCollider {
  type: 'circle' | 'box';
  x: number;
  z: number;
  radius?: number;
  halfW?: number;
  halfD?: number;
  blocksBullets: boolean;
  maxY: number;
}

export const ARENA_RADIUS = 54;

export function groundHeightAt(x: number, z: number): number {
  // Subtle organic forest terrain undulations, flat near spawn clearing (r < 12)
  const dist = Math.hypot(x, z);
  const clearingBlend = THREE.MathUtils.smoothstep(dist, 8, 22);
  const hills =
    Math.sin(x * 0.06) * Math.cos(z * 0.055) * 1.15 +
    Math.sin(x * 0.14 + z * 0.11) * 0.35;
  // Gentle outer ridge beyond playable perimeter so horizon looks naturally enclosed
  const outerRim = Math.max(0, dist - (ARENA_RADIUS + 4)) * 0.18;
  return hills * clearingBlend + outerRim;
}

export class ForestEnvironment {
  readonly root = new THREE.Group();
  readonly obstacles: ObstacleCollider[] = [];
  readonly bulletBlockMeshes: THREE.Object3D[] = [];
  readonly spawnPoints: THREE.Vector3[] = [];

  private moonLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private campfireLight!: THREE.PointLight;
  private campfireEmbers!: THREE.Mesh;
  private lanternLights: THREE.PointLight[] = [];
  private dustPoints!: THREE.Points;
  private grassMesh!: THREE.InstancedMesh;
  private textures: ForestTextureSet;
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    textures: ForestTextureSet,
    isSoftwareGl: boolean,
    quality: GraphicsQuality
  ) {
    this.textures = textures;

    // Studio environment reflection for metallic weapons & wet surfaces
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Permanent nighttime dark blue moonlit atmosphere + horizon-matched fog
    const fogColor = 0x070d16;
    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.FogExp2(fogColor, 0.023);

    this.setupLighting(isSoftwareGl, quality);
    this.buildSkyAndMoon();
    this.buildTerrain();
    this.buildCampfireAndCabin();
    this.buildFencesAndProps();
    this.buildTreesAndRocks(quality);
    this.buildGrassAndParticles(quality);

    scene.add(this.root);
  }

  private setupLighting(isSoftwareGl: boolean, quality: GraphicsQuality): void {
    // Cool sky / dark forest-floor hemisphere fill
    this.hemiLight = new THREE.HemisphereLight(0x4b6e9e, 0x161b14, 0.72);
    this.root.add(this.hemiLight);

    // Moon directional key light
    this.moonLight = new THREE.DirectionalLight(0x9ec0f5, 1.45);
    this.moonLight.position.set(36, 58, -42);

    const shadowRes =
      quality === 'ultra' ? 2048 : quality === 'high' ? 1024 : quality === 'medium' ? 512 : 512;
    this.moonLight.castShadow = !isSoftwareGl && quality !== 'low';
    this.moonLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.moonLight.shadow.camera.near = 5;
    this.moonLight.shadow.camera.far = 160;
    const d = 48;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.moonLight.shadow.bias = -0.0005;
    this.moonLight.shadow.normalBias = 0.02;
    this.root.add(this.moonLight);

    // Subtle cool moonlight rim from opposite horizon
    const rimLight = new THREE.DirectionalLight(0x3a5478, 0.42);
    rimLight.position.set(-40, 20, 45);
    this.root.add(rimLight);
  }

  private buildSkyAndMoon(): void {
    // Glowing full moon in the night sky
    const moonGeo = new THREE.SphereGeometry(5.5, 24, 24);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xdbeafe,
      fog: false,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(68, 92, -88);
    this.root.add(moon);
    this.disposables.push(moonGeo, moonMat);

    // Distant starfield points
    const starCount = 320;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.42;
      const r = 175;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) + 10;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 0.75,
      sizeAttenuation: true,
      fog: false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    this.root.add(stars);
    this.disposables.push(starGeo, starMat);
  }

  private buildTerrain(): void {
    const size = 260;
    const segs = 96;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = groundHeightAt(x, z);
      pos.setY(i, y);

      // Dirt crossroads paths along X and Z axes + central clearing
      const onPathX = Math.abs(z) < 3.4;
      const onPathZ = Math.abs(x) < 3.4;
      const inClearing = Math.hypot(x, z) < 10.5;
      const pathFactor = onPathX || onPathZ || inClearing ? 1 : 0;

      if (pathFactor > 0) {
        colors[i * 3] = 0.62;
        colors[i * 3 + 1] = 0.52;
        colors[i * 3 + 2] = 0.42;
      } else {
        colors[i * 3] = 0.46;
        colors[i * 3 + 1] = 0.54;
        colors[i * 3 + 2] = 0.44;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: this.textures.groundAlbedo,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.02,
    });
    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    this.root.add(terrain);
    this.disposables.push(geo, mat);
  }

  private buildCampfireAndCabin(): void {
    // Spawn clearing campfire (offset at x=5.5, z=-4.5 so spawn at 0,0 is clear)
    const cx = 5.5;
    const cz = -4.5;
    const cy = groundHeightAt(cx, cz);
    const fireGroup = new THREE.Group();
    fireGroup.position.set(cx, cy, cz);

    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.textures.rockAlbedo,
      color: 0x555b66,
      roughness: 0.9,
      metalness: 0.05,
    });
    const stoneGeo = new THREE.DodecahedronGeometry(0.24, 0);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const st = new THREE.Mesh(stoneGeo, stoneMat);
      st.position.set(Math.cos(a) * 0.72, 0.14, Math.sin(a) * 0.72);
      st.scale.set(1.1, 0.7, 1);
      st.castShadow = true;
      fireGroup.add(st);
    }

    const logMat = new THREE.MeshStandardMaterial({
      map: this.textures.barkAlbedo,
      color: 0x2b1d14,
      roughness: 0.92,
    });
    const logGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.9, 8);
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(logGeo, logMat);
      log.position.y = 0.14;
      log.rotation.z = Math.PI / 2 - 0.25;
      log.rotation.y = (i * Math.PI) / 4;
      fireGroup.add(log);
    }

    const emberGeo = new THREE.ConeGeometry(0.28, 0.55, 7);
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff6b21 });
    this.campfireEmbers = new THREE.Mesh(emberGeo, emberMat);
    this.campfireEmbers.position.y = 0.34;
    fireGroup.add(this.campfireEmbers);

    this.campfireLight = new THREE.PointLight(0xff7426, 5.5, 22, 1.7);
    this.campfireLight.position.set(0, 0.85, 0);
    fireGroup.add(this.campfireLight);

    this.root.add(fireGroup);
    this.obstacles.push({
      type: 'circle',
      x: cx,
      z: cz,
      radius: 1.0,
      blocksBullets: false,
      maxY: cy + 0.6,
    });
    this.disposables.push(stoneGeo, stoneMat, logGeo, logMat, emberGeo, emberMat);

    // Abandoned Wooden Cabin / Watch Shelter at (-16, -14)
    this.buildAbandonedCabin(-16, -14);
    // Second ruined outpost shed at (20, 16)
    this.buildRuinedShed(20, 16);
  }

  private buildAbandonedCabin(cx: number, cz: number): void {
    const cy = groundHeightAt(cx, cz);
    const cabin = new THREE.Group();
    cabin.position.set(cx, cy, cz);

    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodAlbedo,
      color: 0x6b5642,
      roughness: 0.88,
      metalness: 0.04,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodAlbedo,
      color: 0x2d241c,
      roughness: 0.94,
    });
    const postMat = new THREE.MeshStandardMaterial({
      map: this.textures.barkAlbedo,
      color: 0x3b2c20,
      roughness: 0.9,
    });

    // Raised timber deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.3, 6.2), woodMat);
    deck.position.y = 0.15;
    deck.receiveShadow = true;
    cabin.add(deck);

    // 4 Corner pillars
    [
      [-3.1, -2.8],
      [3.1, -2.8],
      [-3.1, 2.8],
      [3.1, 2.8],
    ].forEach(([px, pz]) => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.3, 0.32), postMat);
      pillar.position.set(px, 1.8, pz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      cabin.add(pillar);
    });

    // Back wall + side walls (leave front open for doorway look)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.9, 0.25), woodMat);
    backWall.position.set(0, 1.75, -2.85);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    cabin.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.9, 5.6), woodMat);
    leftWall.position.set(-3.15, 1.75, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    cabin.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 5.6), woodMat);
    rightWall.position.set(3.15, 1.4, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    cabin.add(rightWall);

    // Pitched roof slopes
    const roofL = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 6.8), roofMat);
    roofL.position.set(-1.75, 4.0, 0);
    roofL.rotation.z = 0.42;
    roofL.castShadow = true;
    cabin.add(roofL);

    const roofR = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 6.8), roofMat);
    roofR.position.set(1.75, 4.0, 0);
    roofR.rotation.z = -0.42;
    roofR.castShadow = true;
    cabin.add(roofR);

    // Hanging porch lantern with warm amber light
    const lantern = new THREE.PointLight(0xffa94d, 3.2, 16, 1.6);
    lantern.position.set(0, 2.8, 2.7);
    cabin.add(lantern);
    this.lanternLights.push(lantern);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc069 })
    );
    bulb.position.copy(lantern.position);
    cabin.add(bulb);

    this.root.add(cabin);
    this.bulletBlockMeshes.push(backWall, leftWall, rightWall);

    // Register solid wall colliders
    this.obstacles.push(
      { type: 'box', x: cx, z: cz - 2.85, halfW: 3.3, halfD: 0.35, blocksBullets: true, maxY: cy + 3.4 },
      { type: 'box', x: cx - 3.15, z: cz, halfW: 0.35, halfD: 2.95, blocksBullets: true, maxY: cy + 3.4 },
      { type: 'box', x: cx + 3.15, z: cz, halfW: 0.35, halfD: 2.95, blocksBullets: true, maxY: cy + 3.4 }
    );
    this.disposables.push(woodMat, roofMat, postMat);
  }

  private buildRuinedShed(sx: number, sz: number): void {
    const sy = groundHeightAt(sx, sz);
    const shed = new THREE.Group();
    shed.position.set(sx, sy, sz);

    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodAlbedo,
      color: 0x524132,
      roughness: 0.9,
    });

    const wallA = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.6, 0.25), woodMat);
    wallA.position.set(0, 1.3, 2.0);
    wallA.castShadow = true;
    wallA.receiveShadow = true;
    shed.add(wallA);

    const wallB = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 4.0), woodMat);
    wallB.position.set(-2.1, 1.1, 0);
    wallB.castShadow = true;
    shed.add(wallB);

    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), woodMat);
    crate1.position.set(0.8, 0.55, 0.6);
    crate1.rotation.y = 0.25;
    crate1.castShadow = true;
    shed.add(crate1);

    this.root.add(shed);
    this.bulletBlockMeshes.push(wallA, wallB, crate1);
    this.obstacles.push(
      { type: 'box', x: sx, z: sz + 2.0, halfW: 2.35, halfD: 0.35, blocksBullets: true, maxY: sy + 2.7 },
      { type: 'box', x: sx - 2.1, z: sz, halfW: 0.35, halfD: 2.1, blocksBullets: true, maxY: sy + 2.3 },
      { type: 'box', x: sx + 0.8, z: sz + 0.6, halfW: 0.65, halfD: 0.65, blocksBullets: true, maxY: sy + 1.2 }
    );
    this.disposables.push(woodMat);
  }

  private buildFencesAndProps(): void {
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodAlbedo,
      color: 0x544435,
      roughness: 0.9,
    });

    // Broken fence segments framing paths
    const fencePositions: Array<[number, number, number]> = [
      [-10, 6.5, 0],
      [-15.5, 6.5, 0.12],
      [9, -7.2, -0.08],
      [14.5, -7.4, 0.05],
      [7.2, 12, Math.PI / 2],
      [-7.2, -14, Math.PI / 2],
    ];

    fencePositions.forEach(([fx, fz, rot]) => {
      const fy = groundHeightAt(fx, fz);
      const fence = new THREE.Group();
      fence.position.set(fx, fy, fz);
      fence.rotation.y = rot;

      [-1.8, 0, 1.8].forEach((px) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.25, 0.18), woodMat);
        post.position.set(px, 0.62, 0);
        post.castShadow = true;
        fence.add(post);
      });
      [0.45, 0.95].forEach((ry) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 0.08), woodMat);
        rail.position.set(0, ry, 0);
        rail.castShadow = true;
        fence.add(rail);
      });

      this.root.add(fence);
      this.bulletBlockMeshes.push(fence);
      const isRot90 = Math.abs(Math.sin(rot)) > 0.7;
      this.obstacles.push({
        type: 'box',
        x: fx,
        z: fz,
        halfW: isRot90 ? 0.35 : 2.1,
        halfD: isRot90 ? 2.1 : 0.35,
        blocksBullets: true,
        maxY: fy + 1.3,
      });
    });

    // 4 Lantern posts along the forest crossroads
    const lanternCoords: Array<[number, number]> = [
      [15, 3.8],
      [-15, -3.8],
      [3.8, 18],
      [-3.8, -18],
    ];
    const postMat = new THREE.MeshStandardMaterial({
      map: this.textures.barkAlbedo,
      color: 0x2d241c,
      roughness: 0.9,
    });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });

    lanternCoords.forEach(([lx, lz]) => {
      const ly = groundHeightAt(lx, lz);
      const g = new THREE.Group();
      g.position.set(lx, ly, lz);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 3.1, 8), postMat);
      post.position.y = 1.55;
      post.castShadow = true;
      g.add(post);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.09, 0.09), postMat);
      arm.position.set(-0.26, 2.95, 0);
      g.add(arm);

      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), bulbMat);
      bulb.position.set(-0.5, 2.75, 0);
      g.add(bulb);

      const light = new THREE.PointLight(0xffa447, 2.6, 15, 1.8);
      light.position.set(-0.5, 2.65, 0);
      g.add(light);
      this.lanternLights.push(light);

      this.root.add(g);
      this.obstacles.push({
        type: 'circle',
        x: lx,
        z: lz,
        radius: 0.3,
        blocksBullets: true,
        maxY: ly + 3.2,
      });
    });

    this.disposables.push(woodMat, postMat, bulbMat);
  }

  private buildTreesAndRocks(quality: GraphicsQuality): void {
    // Seeded deterministic PRNG so forest layout is rich & consistent
    let seed = 4219;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const trunkMat = new THREE.MeshStandardMaterial({
      map: this.textures.barkAlbedo,
      color: 0x3b2d22,
      roughness: 0.92,
      metalness: 0.02,
    });
    const pineMat1 = new THREE.MeshStandardMaterial({
      color: 0x16271b,
      roughness: 0.85,
      metalness: 0.02,
    });
    const pineMat2 = new THREE.MeshStandardMaterial({
      color: 0x1c3121,
      roughness: 0.82,
      metalness: 0.02,
    });
    const rockMat = new THREE.MeshStandardMaterial({
      map: this.textures.rockAlbedo,
      color: 0x4b525c,
      roughness: 0.88,
      metalness: 0.08,
    });
    const bushMat = new THREE.MeshStandardMaterial({
      color: 0x1f301d,
      roughness: 0.9,
    });

    // Playable-zone composite pine & dead oak trees (cast shadows, collide, block bullets)
    const innerTrees: Array<{ x: number; z: number; scale: number; dead: boolean }> = [];
    const targetInner = quality === 'low' ? 42 : 68;
    let attempts = 0;
    while (innerTrees.length < targetInner && attempts < 800) {
      attempts++;
      const angle = rand() * Math.PI * 2;
      const dist = 10.5 + rand() * (ARENA_RADIUS - 12);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      // Keep dirt paths & cabin clearing open
      if (Math.abs(x) < 3.6 || Math.abs(z) < 3.6) continue;
      if (Math.hypot(x + 16, z + 14) < 7.5) continue;
      if (Math.hypot(x - 20, z - 16) < 6.0) continue;
      if (innerTrees.some((t) => Math.hypot(t.x - x, t.z - z) < 4.5)) continue;

      innerTrees.push({
        x,
        z,
        scale: 0.85 + rand() * 0.48,
        dead: rand() < 0.2,
      });
    }

    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 4.2, 8);
    const rootFlareGeo = new THREE.CylinderGeometry(0.36, 0.65, 1.0, 7);
    const coneLow = new THREE.ConeGeometry(2.1, 3.1, 8);
    const coneMid = new THREE.ConeGeometry(1.65, 2.7, 8);
    const coneTop = new THREE.ConeGeometry(1.1, 2.2, 8);
    const limbGeo = new THREE.CylinderGeometry(0.08, 0.15, 2.0, 6);

    innerTrees.forEach((t) => {
      const y = groundHeightAt(t.x, t.z);
      const tree = new THREE.Group();
      tree.position.set(t.x, y, t.z);
      tree.scale.setScalar(t.scale);
      tree.rotation.y = rand() * Math.PI * 2;

      const flare = new THREE.Mesh(rootFlareGeo, trunkMat);
      flare.position.y = 0.5;
      flare.castShadow = true;
      flare.receiveShadow = true;
      tree.add(flare);

      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.1;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);

      if (t.dead) {
        // Gnarled dead oak branches
        for (let b = 0; b < 3; b++) {
          const limb = new THREE.Mesh(limbGeo, trunkMat);
          const ba = b * ((Math.PI * 2) / 3) + 0.4;
          limb.position.set(Math.cos(ba) * 0.55, 3.6 + b * 0.35, Math.sin(ba) * 0.55);
          limb.rotation.z = -Math.cos(ba) * 0.78;
          limb.rotation.x = Math.sin(ba) * 0.78;
          limb.castShadow = true;
          tree.add(limb);
        }
      } else {
        const c1 = new THREE.Mesh(coneLow, pineMat1);
        c1.position.y = 3.5;
        c1.castShadow = true;
        c1.receiveShadow = true;
        tree.add(c1);

        const c2 = new THREE.Mesh(coneMid, pineMat2);
        c2.position.y = 5.1;
        c2.castShadow = true;
        tree.add(c2);

        const c3 = new THREE.Mesh(coneTop, pineMat1);
        c3.position.y = 6.6;
        c3.castShadow = true;
        tree.add(c3);
      }

      this.root.add(tree);
      this.bulletBlockMeshes.push(trunk);
      this.obstacles.push({
        type: 'circle',
        x: t.x,
        z: t.z,
        radius: 0.48 * t.scale,
        blocksBullets: true,
        maxY: y + 4.5 * t.scale,
      });
    });

    // Dense outer perimeter pine ring (InstancedMesh for crisp horizon & low draw calls)
    const outerCount = quality === 'low' ? 110 : 180;
    const outerTrunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, outerCount);
    const outerCanopyInst = new THREE.InstancedMesh(coneLow, pineMat1, outerCount);
    const outerTopInst = new THREE.InstancedMesh(coneMid, pineMat2, outerCount);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < outerCount; i++) {
      const a = (i / outerCount) * Math.PI * 2 + (rand() - 0.5) * 0.14;
      const r = ARENA_RADIUS + 1.5 + rand() * 34;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = groundHeightAt(x, z);
      const sc = 1.05 + rand() * 0.65;

      dummy.position.set(x, y + 2.1 * sc, z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      outerTrunkInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, y + 4.2 * sc, z);
      dummy.scale.set(sc * 1.15, sc * 1.2, sc * 1.15);
      dummy.updateMatrix();
      outerCanopyInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, y + 6.3 * sc, z);
      dummy.scale.set(sc * 1.1, sc * 1.15, sc * 1.1);
      dummy.updateMatrix();
      outerTopInst.setMatrixAt(i, dummy.matrix);

      color.setHex(0x16271b).offsetHSL(0, 0, (rand() - 0.5) * 0.04);
      outerCanopyInst.setColorAt(i, color);
      outerTopInst.setColorAt(i, color);
    }
    outerTrunkInst.instanceMatrix.needsUpdate = true;
    outerCanopyInst.instanceMatrix.needsUpdate = true;
    outerTopInst.instanceMatrix.needsUpdate = true;
    if (outerCanopyInst.instanceColor) outerCanopyInst.instanceColor.needsUpdate = true;
    if (outerTopInst.instanceColor) outerTopInst.instanceColor.needsUpdate = true;
    outerTrunkInst.computeBoundingSphere();
    outerCanopyInst.computeBoundingSphere();
    outerTopInst.computeBoundingSphere();

    this.root.add(outerTrunkInst, outerCanopyInst, outerTopInst);

    // Rocks & boulders inside playable arena
    const rockGeo = new THREE.DodecahedronGeometry(1, 1);
    const rockCount = 26;
    for (let i = 0; i < rockCount; i++) {
      const a = rand() * Math.PI * 2;
      const dist = 12 + rand() * (ARENA_RADIUS - 15);
      const rx = Math.cos(a) * dist;
      const rz = Math.sin(a) * dist;
      if (Math.abs(rx) < 3.4 || Math.abs(rz) < 3.4) continue;
      if (Math.hypot(rx + 16, rz + 14) < 6) continue;

      const ry = groundHeightAt(rx, rz);
      const sx = 0.7 + rand() * 1.1;
      const sy = 0.55 + rand() * 0.8;
      const sz = 0.7 + rand() * 1.0;

      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(rx, ry + sy * 0.4, rz);
      rock.scale.set(sx, sy, sz);
      rock.rotation.set(rand() * 0.4, rand() * Math.PI, rand() * 0.4);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.root.add(rock);
      this.bulletBlockMeshes.push(rock);

      this.obstacles.push({
        type: 'circle',
        x: rx,
        z: rz,
        radius: Math.max(sx, sz) * 0.85,
        blocksBullets: true,
        maxY: ry + sy * 1.2,
      });
    }

    // Forest bushes (InstancedMesh, non-blocking low foliage)
    const bushCount = quality === 'low' ? 60 : 120;
    const bushGeo = new THREE.DodecahedronGeometry(0.65, 0);
    const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, bushCount);
    for (let i = 0; i < bushCount; i++) {
      const a = rand() * Math.PI * 2;
      const d = 9 + rand() * (ARENA_RADIUS - 10);
      const bx = Math.cos(a) * d;
      const bz = Math.sin(a) * d;
      const by = groundHeightAt(bx, bz);
      const sc = 0.7 + rand() * 0.8;
      dummy.position.set(bx, by + 0.32 * sc, bz);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.set(sc * 1.2, sc * 0.85, sc * 1.2);
      dummy.updateMatrix();
      bushInst.setMatrixAt(i, dummy.matrix);
      color.setHex(0x1f301d).offsetHSL(0, 0, (rand() - 0.5) * 0.05);
      bushInst.setColorAt(i, color);
    }
    bushInst.instanceMatrix.needsUpdate = true;
    if (bushInst.instanceColor) bushInst.instanceColor.needsUpdate = true;
    bushInst.computeBoundingSphere();
    this.root.add(bushInst);

    // Precompute valid outer zombie spawn ring points
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = ARENA_RADIUS - 5;
      const sx = Math.cos(a) * r;
      const sz = Math.sin(a) * r;
      this.spawnPoints.push(new THREE.Vector3(sx, groundHeightAt(sx, sz), sz));
    }

    this.disposables.push(
      trunkMat,
      pineMat1,
      pineMat2,
      rockMat,
      bushMat,
      trunkGeo,
      rootFlareGeo,
      coneLow,
      coneMid,
      coneTop,
      limbGeo,
      rockGeo,
      bushGeo
    );
  }

  private buildGrassAndParticles(quality: GraphicsQuality): void {
    const grassCount =
      quality === 'ultra' ? 750 : quality === 'high' ? 500 : quality === 'medium' ? 280 : 120;

    const grassGeo = new THREE.ConeGeometry(0.11, 0.52, 4);
    grassGeo.translate(0, 0.26, 0);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x243821,
      roughness: 0.9,
      metalness: 0.0,
    });
    this.grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < grassCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 5 + Math.random() * (ARENA_RADIUS - 6);
      const gx = Math.cos(a) * r;
      const gz = Math.sin(a) * r;
      const gy = groundHeightAt(gx, gz);
      const sc = 0.75 + Math.random() * 0.7;
      dummy.position.set(gx, gy, gz);
      dummy.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI, (Math.random() - 0.5) * 0.2);
      dummy.scale.set(sc, sc * (0.8 + Math.random() * 0.6), sc);
      dummy.updateMatrix();
      this.grassMesh.setMatrixAt(i, dummy.matrix);
      color.setHex(0x243821).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
      this.grassMesh.setColorAt(i, color);
    }
    this.grassMesh.instanceMatrix.needsUpdate = true;
    if (this.grassMesh.instanceColor) this.grassMesh.instanceColor.needsUpdate = true;
    this.grassMesh.computeBoundingSphere();
    this.root.add(this.grassMesh);

    // Floating moonlit dust / ash particles
    const dustCount = quality === 'low' ? 140 : 320;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 90;
      dustPositions[i * 3 + 1] = 0.4 + Math.random() * 9.5;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      map: this.textures.sparkSprite,
      color: 0x9bb4d4,
      size: 0.16,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.root.add(this.dustPoints);

    this.disposables.push(grassGeo, grassMat, dustGeo, dustMat);
  }

  applyGraphicsQuality(quality: GraphicsQuality, isSoftwareGl: boolean): void {
    this.moonLight.castShadow = !isSoftwareGl && quality !== 'low';
  }

  update(dt: number, elapsed: number): void {
    // Flicker campfire & embers subtly
    const flicker =
      Math.sin(elapsed * 11.3) * 0.55 +
      Math.sin(elapsed * 23.7) * 0.25 +
      Math.cos(elapsed * 7.1) * 0.3;
    this.campfireLight.intensity = 5.2 + flicker * 1.1;
    this.campfireEmbers.scale.set(1 + flicker * 0.05, 1 + flicker * 0.12, 1 + flicker * 0.05);

    for (let i = 0; i < this.lanternLights.length; i++) {
      this.lanternLights[i].intensity = 2.6 + Math.sin(elapsed * 6.5 + i * 2.1) * 0.25;
    }

    // Drift atmospheric dust particles slowly
    const pos = this.dustPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + dt * 0.28;
      let y = pos.getY(i) + Math.sin(elapsed + i) * dt * 0.12;
      if (x > 45) x = -45;
      if (y < 0.3) y = 9.0;
      pos.setXY(i, x, y);
    }
    pos.needsUpdate = true;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
