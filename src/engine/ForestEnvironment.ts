import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SettingsData } from '../types/game';
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
  const dist = Math.hypot(x, z);
  const clearingBlend = THREE.MathUtils.smoothstep(dist, 8, 22);
  const hills =
    Math.sin(x * 0.06) * Math.cos(z * 0.055) * 1.15 +
    Math.sin(x * 0.14 + z * 0.11) * 0.35;
  const outerRim = Math.max(0, dist - (ARENA_RADIUS + 4)) * 0.18;
  return hills * clearingBlend + outerRim;
}

export class ForestEnvironment {
  readonly root = new THREE.Group();
  readonly obstacles: ObstacleCollider[] = [];
  readonly bulletBlockMeshes: THREE.Object3D[] = [];
  readonly spawnPoints: THREE.Vector3[] = [];

  // Active Supply Drop in world
  supplyDropGroup: THREE.Group | null = null;
  supplyDropPos: THREE.Vector3 | null = null;

  private moonLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private campfireLight!: THREE.PointLight;
  private campfireEmbers!: THREE.Mesh;
  private emberPoints!: THREE.Points;
  private lanternLights: THREE.PointLight[] = [];
  private dustPoints!: THREE.Points;
  private rainPoints!: THREE.Points;
  private mistSprites: THREE.Sprite[] = [];
  private grassMesh!: THREE.InstancedMesh;
  private maxGrassCount = 0;
  private bushInst!: THREE.InstancedMesh;
  private maxBushCount = 0;
  private treeLods: THREE.LOD[] = [];
  private treeBaseScales: number[] = [];
  private textures: ForestTextureSet;
  private sceneRef: THREE.Scene;
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    textures: ForestTextureSet,
    isSoftwareGl: boolean,
    settings: SettingsData
  ) {
    this.textures = textures;
    this.sceneRef = scene;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const fogColor = 0x060b14;
    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.FogExp2(fogColor, 0.02);

    this.setupLighting(isSoftwareGl, settings);
    this.buildSkyAndMoon();
    this.buildTerrain();
    this.buildCampfireAndCabin();
    this.buildWatchtower(-24, 15);
    this.buildAbandonedSuv(18, -15);
    this.buildFencesAndProps();
    this.buildTreesAndRocks(settings);
    this.buildGrassMistAndParticles(settings);
    this.buildRainSystem();

    this.applySettings(settings, isSoftwareGl);
    scene.add(this.root);
  }

  private setupLighting(isSoftwareGl: boolean, settings: SettingsData): void {
    this.hemiLight = new THREE.HemisphereLight(0x5b82b8, 0x161b14, 0.8);
    this.root.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(0xa8c8fa, 1.62);
    this.moonLight.position.set(36, 58, -42);

    const shadowRes =
      settings.shadowQuality === 'high'
        ? 2048
        : settings.shadowQuality === 'medium'
        ? 1024
        : 512;
    this.moonLight.castShadow = !isSoftwareGl && settings.shadowQuality !== 'off';
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

    const rimLight = new THREE.DirectionalLight(0x3a5478, 0.48);
    rimLight.position.set(-40, 20, 45);
    this.root.add(rimLight);
  }

  private addContactShadow(x: number, z: number, radius: number, opacity = 0.55): void {
    const y = groundHeightAt(x, z) + 0.025;
    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: this.textures.contactShadow,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    this.root.add(m);
    this.disposables.push(geo, mat);
  }

  private buildSkyAndMoon(): void {
    const moonGeo = new THREE.SphereGeometry(5.5, 24, 24);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xe6f0ff,
      fog: false,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(68, 92, -88);
    this.root.add(moon);

    const haloMat = new THREE.SpriteMaterial({
      map: this.textures.mistSprite,
      color: 0x9ec4ff,
      transparent: true,
      opacity: 0.58,
      fog: false,
      depthWrite: false,
    });
    const halo = new THREE.Sprite(haloMat);
    halo.position.copy(moon.position);
    halo.scale.set(38, 38, 1);
    this.root.add(halo);
    this.disposables.push(moonGeo, moonMat, haloMat);

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
      color: 0xdbeafe,
      size: 0.72,
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

      const onPathX = Math.abs(z) < 3.4;
      const onPathZ = Math.abs(x) < 3.4;
      const inClearing = Math.hypot(x, z) < 10.5;
      const pathFactor = onPathX || onPathZ || inClearing ? 1 : 0;

      if (pathFactor > 0) {
        colors[i * 3] = 0.64;
        colors[i * 3 + 1] = 0.54;
        colors[i * 3 + 2] = 0.43;
      } else {
        colors[i * 3] = 0.46;
        colors[i * 3 + 1] = 0.56;
        colors[i * 3 + 2] = 0.44;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: this.textures.groundAlbedo,
      bumpMap: this.textures.groundBump,
      bumpScale: 0.2,
      roughnessMap: this.textures.groundRoughness,
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.04,
    });
    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    this.root.add(terrain);
    this.disposables.push(geo, mat);
  }

  private buildCampfireAndCabin(): void {
    const cx = 5.5;
    const cz = -4.5;
    const cy = groundHeightAt(cx, cz);
    const fireGroup = new THREE.Group();
    fireGroup.position.set(cx, cy, cz);

    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.textures.rockAlbedo,
      bumpMap: this.textures.rockBump,
      bumpScale: 0.14,
      color: 0x555b66,
      roughness: 0.88,
      metalness: 0.06,
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
      bumpMap: this.textures.barkBump,
      bumpScale: 0.15,
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

    const emberGeo = new THREE.ConeGeometry(0.28, 0.62, 7);
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xff7024 });
    this.campfireEmbers = new THREE.Mesh(emberGeo, emberMat);
    this.campfireEmbers.position.y = 0.34;
    fireGroup.add(this.campfireEmbers);

    this.campfireLight = new THREE.PointLight(0xff7426, 6.4, 26, 1.65);
    this.campfireLight.position.set(0, 0.9, 0);
    fireGroup.add(this.campfireLight);

    const emberCount = 26;
    const emberPos = new Float32Array(emberCount * 3);
    for (let i = 0; i < emberCount; i++) {
      emberPos[i * 3] = (Math.random() - 0.5) * 0.65;
      emberPos[i * 3 + 1] = 0.3 + Math.random() * 2.8;
      emberPos[i * 3 + 2] = (Math.random() - 0.5) * 0.65;
    }
    const emberPtsGeo = new THREE.BufferGeometry();
    emberPtsGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    const emberPtsMat = new THREE.PointsMaterial({
      map: this.textures.sparkSprite,
      color: 0xff9a3c,
      size: 0.16,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.emberPoints = new THREE.Points(emberPtsGeo, emberPtsMat);
    fireGroup.add(this.emberPoints);

    this.root.add(fireGroup);
    this.addContactShadow(cx, cz, 1.35, 0.55);
    this.obstacles.push({
      type: 'circle',
      x: cx,
      z: cz,
      radius: 1.0,
      blocksBullets: false,
      maxY: cy + 0.6,
    });
    this.disposables.push(
      stoneGeo,
      stoneMat,
      logGeo,
      logMat,
      emberGeo,
      emberMat,
      emberPtsGeo,
      emberPtsMat
    );

    this.buildAbandonedCabin(-16, -14);
    this.buildRuinedShed(20, 16);
  }

  private buildAbandonedCabin(cx: number, cz: number): void {
    const cy = groundHeightAt(cx, cz);
    const cabin = new THREE.Group();
    cabin.position.set(cx, cy, cz);

    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodAlbedo,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.16,
      color: 0x6b5642,
      roughness: 0.86,
      metalness: 0.05,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodAlbedo,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.14,
      color: 0x2d241c,
      roughness: 0.92,
    });
    const postMat = new THREE.MeshStandardMaterial({
      map: this.textures.barkAlbedo,
      bumpMap: this.textures.barkBump,
      bumpScale: 0.16,
      color: 0x3b2c20,
      roughness: 0.9,
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x272c35,
      roughness: 0.42,
      metalness: 0.85,
    });

    const deck = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.3, 6.2), woodMat);
    deck.position.y = 0.15;
    deck.receiveShadow = true;
    cabin.add(deck);

    const step = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.6), woodMat);
    step.position.set(0, 0.08, 3.35);
    step.receiveShadow = true;
    cabin.add(step);

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

    [-0.18, 0.18].forEach((offset, idx) => {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.08), postMat);
      plank.position.set(3.28, 1.6 + offset, -0.8);
      plank.rotation.x = idx === 0 ? 0.32 : -0.24;
      cabin.add(plank);
    });

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

    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.4, 10), ironMat);
    chimney.position.set(-1.6, 4.7, -1.4);
    chimney.castShadow = true;
    cabin.add(chimney);

    const lantern = new THREE.PointLight(0xffa94d, 3.8, 18, 1.6);
    lantern.position.set(0, 2.8, 2.7);
    cabin.add(lantern);
    this.lanternLights.push(lantern);

    const cage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.13, 0.34, 6, 1, true),
      ironMat
    );
    cage.position.copy(lantern.position);
    cabin.add(cage);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc069 })
    );
    bulb.position.copy(lantern.position);
    cabin.add(bulb);

    this.root.add(cabin);
    this.addContactShadow(cx, cz, 4.5, 0.52);
    this.bulletBlockMeshes.push(backWall, leftWall, rightWall);

    this.obstacles.push(
      {
        type: 'box',
        x: cx,
        z: cz - 2.85,
        halfW: 3.3,
        halfD: 0.35,
        blocksBullets: true,
        maxY: cy + 3.4,
      },
      {
        type: 'box',
        x: cx - 3.15,
        z: cz,
        halfW: 0.35,
        halfD: 2.95,
        blocksBullets: true,
        maxY: cy + 3.4,
      },
      {
        type: 'box',
        x: cx + 3.15,
        z: cz,
        halfW: 0.35,
        halfD: 2.95,
        blocksBullets: true,
        maxY: cy + 3.4,
      }
    );
    this.disposables.push(woodMat, roofMat, postMat, ironMat);
  }

  private buildWatchtower(wx: number, wz: number): void {
    const wy = groundHeightAt(wx, wz);
    const tower = new THREE.Group();
    tower.position.set(wx, wy, wz);

    const timberMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodAlbedo,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.14,
      color: 0x5c4632,
      roughness: 0.88,
    });
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x262b34,
      roughness: 0.45,
      metalness: 0.8,
    });

    // 4 heavy angled legs
    [
      [-1.5, -1.5],
      [1.5, -1.5],
      [-1.5, 1.5],
      [1.5, 1.5],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 7.6, 0.28), timberMat);
      leg.position.set(lx * 0.9, 3.8, lz * 0.9);
      leg.castShadow = true;
      tower.add(leg);
    });

    // Cross braces
    [2.0, 4.2].forEach((by) => {
      const braceA = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 0.16), timberMat);
      braceA.position.set(0, by, 1.35);
      tower.add(braceA);
      const braceB = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 0.16), timberMat);
      braceB.position.set(0, by, -1.35);
      tower.add(braceB);
    });

    // Elevated deck + guardrails
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.25, 3.8), timberMat);
    deck.position.set(0, 5.5, 0);
    deck.castShadow = true;
    tower.add(deck);

    [
      [0, 6.2, 1.8, 3.8, 0.15],
      [0, 6.2, -1.8, 3.8, 0.15],
      [1.8, 6.2, 0, 0.15, 3.8],
      [-1.8, 6.2, 0, 0.15, 3.8],
    ].forEach(([rx, ry, rz, rw, rd]) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.2, rd), timberMat);
      rail.position.set(rx, ry, rz);
      tower.add(rail);
    });

    // Roof & spotlight bulb
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.4, 4), ironMat);
    roof.position.set(0, 8.2, 0);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    tower.add(roof);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc670 })
    );
    bulb.position.set(0, 7.35, 0);
    tower.add(bulb);

    const towerLight = new THREE.PointLight(0xffb454, 4.5, 22, 1.6);
    towerLight.position.set(0, 7.1, 0);
    tower.add(towerLight);
    this.lanternLights.push(towerLight);

    this.root.add(tower);
    this.addContactShadow(wx, wz, 3.4, 0.52);
    this.bulletBlockMeshes.push(tower);
    this.obstacles.push({
      type: 'box',
      x: wx,
      z: wz,
      halfW: 1.85,
      halfD: 1.85,
      blocksBullets: true,
      maxY: wy + 7.6,
    });
    this.disposables.push(timberMat, ironMat);
  }

  private buildAbandonedSuv(vx: number, vz: number): void {
    const vy = groundHeightAt(vx, vz);
    const suv = new THREE.Group();
    suv.position.set(vx, vy, vz);
    suv.rotation.y = -0.52;

    const bodyMat = new THREE.MeshStandardMaterial({
      map: this.textures.metalBrushed,
      color: 0x3b4438,
      roughness: 0.56,
      metalness: 0.45,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x181b20,
      roughness: 0.82,
      metalness: 0.2,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x64748b,
      roughness: 0.18,
      metalness: 0.1,
      transparent: true,
      opacity: 0.58,
    });
    const headLightMat = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });

    // Lower chassis & hood
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.86, 4.6), bodyMat);
    chassis.position.y = 0.78;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    suv.add(chassis);

    // Cabin upper greenhouse
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.76, 2.75), bodyMat);
    cabin.position.set(0, 1.54, -0.35);
    cabin.castShadow = true;
    suv.add(cabin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.56, 2.58), glassMat);
    windshield.position.set(0, 1.52, -0.35);
    suv.add(windshield);

    // Roof rack + emergency bar
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 2.2), trimMat);
    rack.position.set(0, 1.98, -0.4);
    suv.add(rack);

    // 4 wheels
    const wheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.3, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    [
      [-1.08, 0.44, 1.38],
      [1.08, 0.44, 1.38],
      [-1.08, 0.44, -1.38],
      [1.08, 0.44, -1.38],
    ].forEach(([wx, wyLocal, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, trimMat);
      wheel.position.set(wx, wyLocal, wz);
      wheel.castShadow = true;
      suv.add(wheel);
    });

    // Headlights glowing weakly + point light pool
    [-0.72, 0.72].forEach((hx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), headLightMat);
      hl.position.set(hx, 0.85, 2.31);
      suv.add(hl);
    });
    const suvLight = new THREE.SpotLight(0xfef3c7, 3.2, 16, Math.PI / 4, 0.65, 1.5);
    suvLight.position.set(0, 0.9, 2.35);
    const target = new THREE.Object3D();
    target.position.set(0, 0.2, 10);
    suv.add(suvLight);
    suv.add(target);
    suvLight.target = target;

    this.root.add(suv);
    this.addContactShadow(vx, vz, 3.1, 0.58);
    this.bulletBlockMeshes.push(chassis, cabin);
    this.obstacles.push({
      type: 'box',
      x: vx,
      z: vz,
      halfW: 1.75,
      halfD: 2.35,
      blocksBullets: true,
      maxY: vy + 2.2,
    });
    this.disposables.push(bodyMat, trimMat, glassMat, headLightMat, wheelGeo);
  }

  private buildRuinedShed(sx: number, sz: number): void {
    const sy = groundHeightAt(sx, sz);
    const shed = new THREE.Group();
    shed.position.set(sx, sy, sz);

    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodAlbedo,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.14,
      color: 0x524132,
      roughness: 0.88,
    });
    const tinMat = new THREE.MeshStandardMaterial({
      map: this.textures.metalBrushed,
      color: 0x4b5563,
      roughness: 0.45,
      metalness: 0.82,
    });
    const drumMat = new THREE.MeshStandardMaterial({
      map: this.textures.metalBrushed,
      color: 0x612b20,
      roughness: 0.48,
      metalness: 0.72,
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

    const tinRoof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.08, 4.4), tinMat);
    tinRoof.position.set(0, 2.68, 0);
    tinRoof.rotation.x = -0.14;
    tinRoof.castShadow = true;
    shed.add(tinRoof);

    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), woodMat);
    crate1.position.set(0.8, 0.55, 0.6);
    crate1.rotation.y = 0.25;
    crate1.castShadow = true;
    shed.add(crate1);

    const drumProfile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.36, 0),
      new THREE.Vector2(0.36, 0.3),
      new THREE.Vector2(0.39, 0.34),
      new THREE.Vector2(0.36, 0.38),
      new THREE.Vector2(0.36, 0.66),
      new THREE.Vector2(0.39, 0.7),
      new THREE.Vector2(0.36, 0.74),
      new THREE.Vector2(0.36, 1.05),
      new THREE.Vector2(0, 1.05),
    ];
    const drumGeo = new THREE.LatheGeometry(drumProfile, 14);
    const drum = new THREE.Mesh(drumGeo, drumMat);
    drum.position.set(-1.1, 0, 1.1);
    drum.castShadow = true;
    shed.add(drum);

    this.root.add(shed);
    this.addContactShadow(sx, sz, 3.2, 0.5);
    this.bulletBlockMeshes.push(wallA, wallB, crate1, drum);
    this.obstacles.push(
      {
        type: 'box',
        x: sx,
        z: sz + 2.0,
        halfW: 2.35,
        halfD: 0.35,
        blocksBullets: true,
        maxY: sy + 2.7,
      },
      {
        type: 'box',
        x: sx - 2.1,
        z: sz,
        halfW: 0.35,
        halfD: 2.1,
        blocksBullets: true,
        maxY: sy + 2.3,
      },
      {
        type: 'box',
        x: sx + 0.8,
        z: sz + 0.6,
        halfW: 0.65,
        halfD: 0.65,
        blocksBullets: true,
        maxY: sy + 1.2,
      },
      {
        type: 'circle',
        x: sx - 1.1,
        z: sz + 1.1,
        radius: 0.45,
        blocksBullets: true,
        maxY: sy + 1.2,
      }
    );
    this.disposables.push(woodMat, tinMat, drumMat, drumGeo);
  }

  private buildFencesAndProps(): void {
    const woodMat = new THREE.MeshStandardMaterial({
      map: this.textures.woodAlbedo,
      bumpMap: this.textures.woodBump,
      bumpScale: 0.14,
      color: 0x544435,
      roughness: 0.9,
    });

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

    // Military supply crates around clearing
    const milMat = new THREE.MeshStandardMaterial({
      color: 0x354731,
      roughness: 0.72,
      metalness: 0.18,
    });
    const crateSpots: Array<[number, number, number]> = [
      [-5.2, 4.8, 0.3],
      [-4.1, 5.4, -0.2],
      [8.5, 4.5, 0.5],
    ];
    crateSpots.forEach(([cx, cz, rot]) => {
      const cy = groundHeightAt(cx, cz);
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.75, 0.8), milMat);
      crate.position.set(cx, cy + 0.375, cz);
      crate.rotation.y = rot;
      crate.castShadow = true;
      crate.receiveShadow = true;
      this.root.add(crate);
      this.bulletBlockMeshes.push(crate);
      this.obstacles.push({
        type: 'circle',
        x: cx,
        z: cz,
        radius: 0.65,
        blocksBullets: true,
        maxY: cy + 0.9,
      });
    });

    const logMat = new THREE.MeshStandardMaterial({
      map: this.textures.barkAlbedo,
      bumpMap: this.textures.barkBump,
      bumpScale: 0.18,
      color: 0x35291e,
      roughness: 0.92,
    });
    const fallenCoords: Array<[number, number, number]> = [
      [11, 8, 0.6],
      [-9, 17, -0.4],
      [-21, 9, 1.1],
    ];
    fallenCoords.forEach(([lx, lz, rot]) => {
      const ly = groundHeightAt(lx, lz);
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 3.8, 9), logMat);
      log.position.set(lx, ly + 0.3, lz);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = rot;
      log.castShadow = true;
      log.receiveShadow = true;
      this.root.add(log);
      this.addContactShadow(lx, lz, 1.2, 0.45);
      this.bulletBlockMeshes.push(log);
      this.obstacles.push({
        type: 'circle',
        x: lx,
        z: lz,
        radius: 0.9,
        blocksBullets: true,
        maxY: ly + 0.85,
      });
    });

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
    const ironMat = new THREE.MeshStandardMaterial({
      color: 0x22262e,
      roughness: 0.45,
      metalness: 0.85,
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

      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.14, 6), ironMat);
      cap.position.set(-0.5, 2.9, 0);
      g.add(cap);

      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), bulbMat);
      bulb.position.set(-0.5, 2.74, 0);
      g.add(bulb);

      const light = new THREE.PointLight(0xffa447, 3.1, 17, 1.75);
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

    this.disposables.push(woodMat, milMat, logMat, postMat, ironMat, bulbMat);
  }

  private buildTreesAndRocks(settings: SettingsData): void {
    let seed = 4219;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const trunkMat = new THREE.MeshStandardMaterial({
      map: this.textures.barkAlbedo,
      bumpMap: this.textures.barkBump,
      bumpScale: 0.18,
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
      bumpMap: this.textures.rockBump,
      bumpScale: 0.2,
      color: 0x4b525c,
      roughness: 0.85,
      metalness: 0.1,
    });
    const bushMat = new THREE.MeshStandardMaterial({
      color: 0x1f301d,
      roughness: 0.9,
    });

    const innerTrees: Array<{ x: number; z: number; scale: number; dead: boolean }> = [];
    const targetInner = settings.graphicsQuality === 'low' ? 48 : 68;
    let attempts = 0;
    while (innerTrees.length < targetInner && attempts < 800) {
      attempts++;
      const angle = rand() * Math.PI * 2;
      const dist = 10.5 + rand() * (ARENA_RADIUS - 12);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      if (Math.abs(x) < 3.6 || Math.abs(z) < 3.6) continue;
      if (Math.hypot(x + 16, z + 14) < 7.5) continue;
      if (Math.hypot(x - 20, z - 16) < 6.0) continue;
      if (Math.hypot(x + 24, z - 15) < 6.0) continue;
      if (Math.hypot(x - 18, z + 15) < 6.0) continue;
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
    const lowCanopyGeo = new THREE.ConeGeometry(2.0, 4.8, 5);
    const limbGeo = new THREE.CylinderGeometry(0.08, 0.15, 2.0, 6);

    innerTrees.forEach((t) => {
      const y = groundHeightAt(t.x, t.z);
      const lod = new THREE.LOD();
      lod.position.set(t.x, y, t.z);
      lod.scale.setScalar(t.scale);
      lod.rotation.y = rand() * Math.PI * 2;

      // High-detail LOD level (0m..28m)
      const highGroup = new THREE.Group();
      const flare = new THREE.Mesh(rootFlareGeo, trunkMat);
      flare.position.y = 0.5;
      flare.castShadow = true;
      flare.receiveShadow = true;
      highGroup.add(flare);

      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.1;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      highGroup.add(trunk);

      if (t.dead) {
        for (let b = 0; b < 3; b++) {
          const limb = new THREE.Mesh(limbGeo, trunkMat);
          const ba = b * ((Math.PI * 2) / 3) + 0.4;
          limb.position.set(Math.cos(ba) * 0.55, 3.6 + b * 0.35, Math.sin(ba) * 0.55);
          limb.rotation.z = -Math.cos(ba) * 0.78;
          limb.rotation.x = Math.sin(ba) * 0.78;
          limb.castShadow = true;
          highGroup.add(limb);
        }
      } else {
        const c1 = new THREE.Mesh(coneLow, pineMat1);
        c1.position.y = 3.5;
        c1.castShadow = true;
        c1.receiveShadow = true;
        highGroup.add(c1);

        const c2 = new THREE.Mesh(coneMid, pineMat2);
        c2.position.y = 5.1;
        c2.castShadow = true;
        highGroup.add(c2);

        const c3 = new THREE.Mesh(coneTop, pineMat1);
        c3.position.y = 6.6;
        c3.castShadow = true;
        highGroup.add(c3);
      }

      // Low-detail LOD level (beyond 28m * lodDistance)
      const lowGroup = new THREE.Group();
      const lowTrunk = new THREE.Mesh(trunkGeo, trunkMat);
      lowTrunk.position.y = 2.1;
      lowGroup.add(lowTrunk);
      if (!t.dead) {
        const simpleCone = new THREE.Mesh(lowCanopyGeo, pineMat1);
        simpleCone.position.y = 4.6;
        lowGroup.add(simpleCone);
      }

      const lodDist = 28 * settings.lodDistance;
      lod.addLevel(highGroup, 0);
      lod.addLevel(lowGroup, lodDist);

      this.root.add(lod);
      this.treeLods.push(lod);
      this.treeBaseScales.push(28);
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

    const outerCount = settings.graphicsQuality === 'low' ? 110 : 175;
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
      this.addContactShadow(rx, rz, Math.max(sx, sz) * 1.15, 0.45);
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

    this.maxBushCount = 120;
    const bushGeo = new THREE.DodecahedronGeometry(0.65, 0);
    this.bushInst = new THREE.InstancedMesh(bushGeo, bushMat, this.maxBushCount);
    for (let i = 0; i < this.maxBushCount; i++) {
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
      this.bushInst.setMatrixAt(i, dummy.matrix);
      color.setHex(0x1f301d).offsetHSL(0, 0, (rand() - 0.5) * 0.05);
      this.bushInst.setColorAt(i, color);
    }
    this.bushInst.instanceMatrix.needsUpdate = true;
    if (this.bushInst.instanceColor) this.bushInst.instanceColor.needsUpdate = true;
    this.bushInst.computeBoundingSphere();
    this.root.add(this.bushInst);

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
      lowCanopyGeo,
      limbGeo,
      rockGeo,
      bushGeo
    );
  }

  private buildGrassMistAndParticles(settings: SettingsData): void {
    this.maxGrassCount = 720;
    const grassGeo = new THREE.ConeGeometry(0.11, 0.52, 4);
    grassGeo.translate(0, 0.26, 0);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x243821,
      roughness: 0.9,
      metalness: 0.0,
    });
    this.grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, this.maxGrassCount);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < this.maxGrassCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 5 + Math.random() * (ARENA_RADIUS - 6);
      const gx = Math.cos(a) * r;
      const gz = Math.sin(a) * r;
      const gy = groundHeightAt(gx, gz);
      const sc = 0.75 + Math.random() * 0.7;
      dummy.position.set(gx, gy, gz);
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.2,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.2
      );
      dummy.scale.set(sc, sc * (0.8 + Math.random() * 0.6), sc);
      dummy.updateMatrix();
      this.grassMesh.setMatrixAt(i, dummy.matrix);
      color.setHex(0x243821).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
      this.grassMesh.setColorAt(i, color);
    }
    this.grassMesh.instanceMatrix.needsUpdate = true;
    if (this.grassMesh.instanceColor) this.grassMesh.instanceColor.needsUpdate = true;
    this.grassMesh.computeBoundingSphere();
    this.grassMesh.count = Math.round(this.maxGrassCount * settings.vegetationDensity);
    this.root.add(this.grassMesh);

    const mistCount = 20;
    const mistMat = new THREE.SpriteMaterial({
      map: this.textures.mistSprite,
      color: 0x9ebce0,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    for (let i = 0; i < mistCount; i++) {
      const sprite = new THREE.Sprite(mistMat);
      const a = Math.random() * Math.PI * 2;
      const d = 10 + Math.random() * (ARENA_RADIUS - 12);
      const mx = Math.cos(a) * d;
      const mz = Math.sin(a) * d;
      const my = groundHeightAt(mx, mz) + 1.1;
      sprite.position.set(mx, my, mz);
      const w = 10 + Math.random() * 10;
      sprite.scale.set(w, w * 0.42, 1);
      this.root.add(sprite);
      this.mistSprites.push(sprite);
    }

    const dustCount = 280;
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

    this.disposables.push(grassGeo, grassMat, mistMat, dustGeo, dustMat);
  }

  private buildRainSystem(): void {
    const rainCount = 650;
    const pos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 44;
      pos[i * 3 + 1] = Math.random() * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.09,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    this.rainPoints = new THREE.Points(geo, mat);
    this.rainPoints.visible = false;
    this.root.add(this.rainPoints);
    this.disposables.push(geo, mat);
  }

  spawnSupplyDrop(x: number, z: number): void {
    this.clearSupplyDrop();
    const y = groundHeightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const crateMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.45,
      metalness: 0.55,
      emissive: 0x451a03,
    });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.9), crateMat);
    crate.position.y = 0.4;
    crate.castShadow = true;
    group.add(crate);

    const beaconGeo = new THREE.CylinderGeometry(0.06, 0.14, 18, 8, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 9.2;
    group.add(beacon);

    const dropLight = new THREE.PointLight(0xfbbf24, 4.2, 16);
    dropLight.position.y = 1.4;
    group.add(dropLight);

    this.root.add(group);
    this.supplyDropGroup = group;
    this.supplyDropPos = new THREE.Vector3(x, y, z);
  }

  clearSupplyDrop(): void {
    if (this.supplyDropGroup) {
      this.root.remove(this.supplyDropGroup);
      this.supplyDropGroup.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const m = o as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
          else m.material.dispose();
        }
      });
      this.supplyDropGroup = null;
      this.supplyDropPos = null;
    }
  }

  applySettings(settings: SettingsData, isSoftwareGl: boolean): void {
    this.moonLight.castShadow = !isSoftwareGl && settings.shadowQuality !== 'off';
    const shadowRes =
      settings.shadowQuality === 'high'
        ? 2048
        : settings.shadowQuality === 'medium'
        ? 1024
        : 512;
    if (this.moonLight.shadow.mapSize.x !== shadowRes) {
      this.moonLight.shadow.mapSize.set(shadowRes, shadowRes);
      this.moonLight.shadow.map?.dispose();
      this.moonLight.shadow.map = null;
    }

    if (this.grassMesh) {
      this.grassMesh.count = Math.max(
        20,
        Math.round(this.maxGrassCount * settings.vegetationDensity)
      );
    }
    if (this.bushInst) {
      this.bushInst.count = Math.max(
        16,
        Math.round(this.maxBushCount * settings.vegetationDensity)
      );
    }

    // Fog density scales gently with renderDistance so closer render limits feel cohesive
    if (this.sceneRef.fog instanceof THREE.FogExp2) {
      this.sceneRef.fog.density = THREE.MathUtils.lerp(
        0.028,
        0.015,
        THREE.MathUtils.clamp((settings.renderDistance - 45) / 105, 0, 1)
      );
    }

    // Update LOD distances
    for (let i = 0; i < this.treeLods.length; i++) {
      const lod = this.treeLods[i];
      if (lod.levels.length > 1) {
        lod.levels[1].distance = this.treeBaseScales[i] * settings.lodDistance;
      }
    }

    if (this.rainPoints) {
      this.rainPoints.visible = settings.rainEnabled;
    }
    this.dustPoints.visible = settings.effectsQuality !== 'low';
  }

  update(dt: number, elapsed: number, playerPos?: THREE.Vector3): void {
    const flicker =
      Math.sin(elapsed * 11.3) * 0.55 +
      Math.sin(elapsed * 23.7) * 0.25 +
      Math.cos(elapsed * 7.1) * 0.3;
    this.campfireLight.intensity = 6.0 + flicker * 1.3;
    this.campfireEmbers.scale.set(
      1 + flicker * 0.05,
      1 + flicker * 0.12,
      1 + flicker * 0.05
    );

    const ePos = this.emberPoints.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < ePos.count; i++) {
      let y = ePos.getY(i) + dt * (0.9 + (i % 4) * 0.25);
      const x = ePos.getX(i) + Math.sin(elapsed * 3 + i) * dt * 0.18;
      if (y > 3.2) y = 0.3;
      ePos.setXY(i, x, y);
    }
    ePos.needsUpdate = true;

    for (let i = 0; i < this.lanternLights.length; i++) {
      this.lanternLights[i].intensity = 3.0 + Math.sin(elapsed * 6.5 + i * 2.1) * 0.28;
    }

    for (let i = 0; i < this.mistSprites.length; i++) {
      const m = this.mistSprites[i];
      m.position.x += dt * 0.35;
      if (m.position.x > ARENA_RADIUS - 4) m.position.x = -(ARENA_RADIUS - 4);
    }

    if (this.dustPoints.visible) {
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

    if (this.rainPoints.visible) {
      const centerX = playerPos ? playerPos.x : 0;
      const centerZ = playerPos ? playerPos.z : 0;
      this.rainPoints.position.set(centerX, 0, centerZ);
      const rPos = this.rainPoints.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < rPos.count; i++) {
        let ry = rPos.getY(i) - dt * 24;
        if (ry < 0) ry += 18;
        rPos.setY(i, ry);
      }
      rPos.needsUpdate = true;
    }

    if (this.supplyDropGroup) {
      this.supplyDropGroup.children[1].rotation.y += dt * 1.4;
    }
  }

  dispose(): void {
    this.clearSupplyDrop();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
