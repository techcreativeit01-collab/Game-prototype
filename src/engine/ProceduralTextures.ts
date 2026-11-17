import * as THREE from 'three';
import { TextureQuality } from '../types/game';

export interface ForestTextureSet {
  groundAlbedo: THREE.CanvasTexture;
  groundBump: THREE.CanvasTexture;
  groundRoughness: THREE.CanvasTexture;
  barkAlbedo: THREE.CanvasTexture;
  barkBump: THREE.CanvasTexture;
  woodAlbedo: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  rockAlbedo: THREE.CanvasTexture;
  rockBump: THREE.CanvasTexture;
  metalBrushed: THREE.CanvasTexture;
  zombieSkinBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  sparkSprite: THREE.CanvasTexture;
  mistSprite: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createForestTextures(
  maxAnisotropy: number,
  textureQuality: TextureQuality = 'high'
): ForestTextureSet {
  // Adaptive texture resolution for ~1GB–2GB RAM mobile GPUs
  const groundSize = textureQuality === 'low' ? 256 : textureQuality === 'medium' ? 384 : 512;
  const propSize = textureQuality === 'low' ? 128 : 256;
  const anisoCap = textureQuality === 'low' ? 1 : textureQuality === 'medium' ? 2 : 8;
  const gs = groundSize / 512;
  const ps = propSize / 256;

  // 1. Forest Floor Albedo + Bump + Roughness
  const [gCanvas, gCtx] = makeCanvas(groundSize);
  const [gbCanvas, gbCtx] = makeCanvas(groundSize);
  const [grCanvas, grCtx] = makeCanvas(groundSize);
  gCtx.fillStyle = '#141a12';
  gCtx.fillRect(0, 0, groundSize, groundSize);
  gbCtx.fillStyle = '#707070';
  gbCtx.fillRect(0, 0, groundSize, groundSize);
  grCtx.fillStyle = '#d8d8d8';
  grCtx.fillRect(0, 0, groundSize, groundSize);

  const specks = Math.round(5200 * gs);
  for (let i = 0; i < specks; i++) {
    const x = Math.random() * groundSize;
    const y = Math.random() * groundSize;
    const r = (1 + Math.random() * 4.5) * gs;
    const roll = Math.random();
    if (roll < 0.42) {
      gCtx.fillStyle = 'rgba(18, 22, 15, 0.72)';
      gbCtx.fillStyle = 'rgba(40, 40, 40, 0.55)';
      grCtx.fillStyle = 'rgba(140, 140, 140, 0.45)';
    } else if (roll < 0.74) {
      gCtx.fillStyle = 'rgba(30, 44, 24, 0.58)';
      gbCtx.fillStyle = 'rgba(165, 165, 165, 0.45)';
      grCtx.fillStyle = 'rgba(220, 220, 220, 0.4)';
    } else if (roll < 0.92) {
      gCtx.fillStyle = 'rgba(46, 34, 23, 0.55)';
      gbCtx.fillStyle = 'rgba(120, 120, 120, 0.4)';
    } else {
      gCtx.fillStyle = 'rgba(56, 68, 42, 0.44)';
      gbCtx.fillStyle = 'rgba(210, 210, 210, 0.4)';
    }
    gCtx.fillRect(x, y, r, r);
    gbCtx.fillRect(x, y, r, r);
    grCtx.fillRect(x, y, r * 1.4, r * 1.4);
  }

  gCtx.strokeStyle = 'rgba(45, 36, 22, 0.6)';
  gbCtx.strokeStyle = 'rgba(230, 230, 230, 0.48)';
  gCtx.lineWidth = Math.max(0.8, 1.2 * gs);
  gbCtx.lineWidth = Math.max(0.8, 1.2 * gs);
  const twigs = Math.round(760 * gs);
  for (let i = 0; i < twigs; i++) {
    const x = Math.random() * groundSize;
    const y = Math.random() * groundSize;
    const a = Math.random() * Math.PI * 2;
    const len = (5 + Math.random() * 7) * gs;
    gCtx.beginPath();
    gCtx.moveTo(x, y);
    gCtx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    gCtx.stroke();

    gbCtx.beginPath();
    gbCtx.moveTo(x, y);
    gbCtx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    gbCtx.stroke();
  }

  const groundAlbedo = new THREE.CanvasTexture(gCanvas);
  groundAlbedo.colorSpace = THREE.SRGBColorSpace;
  groundAlbedo.wrapS = THREE.RepeatWrapping;
  groundAlbedo.wrapT = THREE.RepeatWrapping;
  groundAlbedo.repeat.set(30, 30);
  groundAlbedo.anisotropy = Math.min(anisoCap, maxAnisotropy);

  const groundBump = new THREE.CanvasTexture(gbCanvas);
  groundBump.wrapS = THREE.RepeatWrapping;
  groundBump.wrapT = THREE.RepeatWrapping;
  groundBump.repeat.set(30, 30);

  const groundRoughness = new THREE.CanvasTexture(grCanvas);
  groundRoughness.wrapS = THREE.RepeatWrapping;
  groundRoughness.wrapT = THREE.RepeatWrapping;
  groundRoughness.repeat.set(30, 30);

  // 2. Tree Bark Albedo + Deep Furrow Bump
  const [bCanvas, bCtx] = makeCanvas(propSize);
  const [bbCanvas, bbCtx] = makeCanvas(propSize);
  bCtx.fillStyle = '#241b15';
  bCtx.fillRect(0, 0, propSize, propSize);
  bbCtx.fillStyle = '#808080';
  bbCtx.fillRect(0, 0, propSize, propSize);

  const step = Math.max(2, Math.round(4 * ps));
  for (let x = 0; x < propSize; x += step) {
    const shade = 20 + Math.floor(Math.random() * 26);
    bCtx.fillStyle = `rgb(${shade + 10}, ${shade + 2}, ${shade - 4})`;
    bCtx.fillRect(x, 0, Math.max(2, step - 1), propSize);
    const bVal = 95 + Math.floor(Math.random() * 110);
    bbCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bbCtx.fillRect(x, 0, Math.max(2, step - 1), propSize);
  }
  for (let i = 0; i < Math.round(280 * ps); i++) {
    const x = Math.random() * propSize;
    const y = Math.random() * propSize;
    const h = (14 + Math.random() * 44) * ps;
    bCtx.fillStyle = 'rgba(8, 6, 4, 0.75)';
    bCtx.fillRect(x, y, 2, h);
    bbCtx.fillStyle = 'rgba(15, 15, 15, 0.85)';
    bbCtx.fillRect(x, y, 2, h);
  }

  const barkAlbedo = new THREE.CanvasTexture(bCanvas);
  barkAlbedo.colorSpace = THREE.SRGBColorSpace;
  barkAlbedo.wrapS = THREE.RepeatWrapping;
  barkAlbedo.wrapT = THREE.RepeatWrapping;
  barkAlbedo.anisotropy = Math.min(4, maxAnisotropy, anisoCap);

  const barkBump = new THREE.CanvasTexture(bbCanvas);
  barkBump.wrapS = THREE.RepeatWrapping;
  barkBump.wrapT = THREE.RepeatWrapping;

  // 3. Weathered Wood Planks Albedo + Bump
  const [wCanvas, wCtx] = makeCanvas(propSize);
  const [wbCanvas, wbCtx] = makeCanvas(propSize);
  wCtx.fillStyle = '#36281c';
  wCtx.fillRect(0, 0, propSize, propSize);
  wbCtx.fillStyle = '#a0a0a0';
  wbCtx.fillRect(0, 0, propSize, propSize);
  const rowH = propSize / 4;
  for (let row = 0; row < 4; row++) {
    const y = row * rowH;
    wCtx.fillStyle = row % 2 === 0 ? '#3a2b1e' : '#2f2318';
    wCtx.fillRect(0, y + 2, propSize, rowH - 4);
    wCtx.fillStyle = '#140e0a';
    wCtx.fillRect(0, y, propSize, 2);
    wbCtx.fillStyle = '#151515';
    wbCtx.fillRect(0, y, propSize, 2);
    for (let g = 0; g < Math.round(42 * ps); g++) {
      const gy = y + 3 + Math.random() * (rowH - 6);
      wCtx.fillStyle = 'rgba(18, 12, 7, 0.45)';
      wCtx.fillRect(0, gy, propSize, 1.4);
      wbCtx.fillStyle = 'rgba(65, 65, 65, 0.48)';
      wbCtx.fillRect(0, gy, propSize, 1.4);
    }
  }
  const woodAlbedo = new THREE.CanvasTexture(wCanvas);
  woodAlbedo.colorSpace = THREE.SRGBColorSpace;
  woodAlbedo.wrapS = THREE.RepeatWrapping;
  woodAlbedo.wrapT = THREE.RepeatWrapping;
  woodAlbedo.anisotropy = Math.min(4, maxAnisotropy, anisoCap);

  const woodBump = new THREE.CanvasTexture(wbCanvas);
  woodBump.wrapS = THREE.RepeatWrapping;
  woodBump.wrapT = THREE.RepeatWrapping;

  // 4. Rock Albedo + Bump
  const [rCanvas, rCtx] = makeCanvas(propSize);
  const [rbCanvas, rbCtx] = makeCanvas(propSize);
  rCtx.fillStyle = '#393e46';
  rCtx.fillRect(0, 0, propSize, propSize);
  rbCtx.fillStyle = '#808080';
  rbCtx.fillRect(0, 0, propSize, propSize);
  for (let i = 0; i < Math.round(1400 * ps); i++) {
    const x = Math.random() * propSize;
    const y = Math.random() * propSize;
    const s = (2 + Math.random() * 10) * ps;
    const v = 40 + Math.floor(Math.random() * 44);
    rCtx.fillStyle = `rgba(${v}, ${v + 4}, ${v + 8}, 0.5)`;
    rCtx.fillRect(x, y, s, s);
    const bv = 50 + Math.floor(Math.random() * 165);
    rbCtx.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.52)`;
    rbCtx.fillRect(x, y, s, s);
  }
  const rockAlbedo = new THREE.CanvasTexture(rCanvas);
  rockAlbedo.colorSpace = THREE.SRGBColorSpace;
  rockAlbedo.wrapS = THREE.RepeatWrapping;
  rockAlbedo.wrapT = THREE.RepeatWrapping;

  const rockBump = new THREE.CanvasTexture(rbCanvas);
  rockBump.wrapS = THREE.RepeatWrapping;
  rockBump.wrapT = THREE.RepeatWrapping;

  // 5. Brushed Gunmetal Roughness Map
  const [mbCanvas, mbCtx] = makeCanvas(propSize);
  mbCtx.fillStyle = '#585858';
  mbCtx.fillRect(0, 0, propSize, propSize);
  for (let y = 0; y < propSize; y++) {
    const v = 50 + Math.floor(Math.random() * 75);
    mbCtx.fillStyle = `rgba(${v}, ${v}, ${v}, 0.55)`;
    mbCtx.fillRect(0, y, propSize, 1);
  }
  const metalBrushed = new THREE.CanvasTexture(mbCanvas);
  metalBrushed.wrapS = THREE.RepeatWrapping;
  metalBrushed.wrapT = THREE.RepeatWrapping;
  metalBrushed.anisotropy = Math.min(anisoCap, maxAnisotropy);

  // 6. Organic Zombie Skin Bump
  const [zbCanvas, zbCtx] = makeCanvas(propSize);
  zbCtx.fillStyle = '#808080';
  zbCtx.fillRect(0, 0, propSize, propSize);
  for (let i = 0; i < Math.round(750 * ps); i++) {
    const x = Math.random() * propSize;
    const y = Math.random() * propSize;
    const r = (1 + Math.random() * 4) * ps;
    const val = Math.random() < 0.5 ? 50 : 195;
    zbCtx.fillStyle = `rgba(${val}, ${val}, ${val}, 0.35)`;
    zbCtx.fillRect(x, y, r, r);
  }
  zbCtx.strokeStyle = 'rgba(25, 25, 25, 0.55)';
  zbCtx.lineWidth = 1.2;
  for (let i = 0; i < Math.round(42 * ps); i++) {
    let vx = Math.random() * propSize;
    let vy = Math.random() * propSize;
    zbCtx.beginPath();
    zbCtx.moveTo(vx, vy);
    for (let s = 0; s < 5; s++) {
      vx += (Math.random() - 0.5) * 24 * ps;
      vy += (Math.random() - 0.5) * 24 * ps;
      zbCtx.lineTo(vx, vy);
    }
    zbCtx.stroke();
  }
  const zombieSkinBump = new THREE.CanvasTexture(zbCanvas);
  zombieSkinBump.wrapS = THREE.RepeatWrapping;
  zombieSkinBump.wrapT = THREE.RepeatWrapping;

  // 7. Soft Radial Contact Shadow Decal
  const [csCanvas, csCtx] = makeCanvas(96);
  const csGrad = csCtx.createRadialGradient(48, 48, 6, 48, 48, 45);
  csGrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  csGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
  csGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  csCtx.fillStyle = csGrad;
  csCtx.fillRect(0, 0, 96, 96);
  const contactShadow = new THREE.CanvasTexture(csCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  // 8. Soft Radial Spark / Ash Sprite
  const [sCanvas, sCtx] = makeCanvas(64);
  const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,230,180,0.75)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 64, 64);
  const sparkSprite = new THREE.CanvasTexture(sCanvas);
  sparkSprite.colorSpace = THREE.SRGBColorSpace;

  // 9. Soft Billowing Ground Mist Sprite
  const [mCanvas, mCtx] = makeCanvas(128);
  const mGrad = mCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  mGrad.addColorStop(0, 'rgba(170, 198, 232, 0.35)');
  mGrad.addColorStop(0.55, 'rgba(130, 165, 208, 0.14)');
  mGrad.addColorStop(1, 'rgba(100, 130, 175, 0)');
  mCtx.fillStyle = mGrad;
  mCtx.fillRect(0, 0, 128, 128);
  const mistSprite = new THREE.CanvasTexture(mCanvas);
  mistSprite.colorSpace = THREE.SRGBColorSpace;

  return {
    groundAlbedo,
    groundBump,
    groundRoughness,
    barkAlbedo,
    barkBump,
    woodAlbedo,
    woodBump,
    rockAlbedo,
    rockBump,
    metalBrushed,
    zombieSkinBump,
    contactShadow,
    sparkSprite,
    mistSprite,
    dispose: () => {
      groundAlbedo.dispose();
      groundBump.dispose();
      groundRoughness.dispose();
      barkAlbedo.dispose();
      barkBump.dispose();
      woodAlbedo.dispose();
      woodBump.dispose();
      rockAlbedo.dispose();
      rockBump.dispose();
      metalBrushed.dispose();
      zombieSkinBump.dispose();
      contactShadow.dispose();
      sparkSprite.dispose();
      mistSprite.dispose();
    },
  };
}
