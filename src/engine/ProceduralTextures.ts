import * as THREE from 'three';

export interface ForestTextureSet {
  groundAlbedo: THREE.CanvasTexture;
  barkAlbedo: THREE.CanvasTexture;
  woodAlbedo: THREE.CanvasTexture;
  rockAlbedo: THREE.CanvasTexture;
  sparkSprite: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createForestTextures(maxAnisotropy: number): ForestTextureSet {
  // 1. Forest Floor Albedo (dark soil, moss, pine needles)
  const [gCanvas, gCtx] = makeCanvas(512);
  gCtx.fillStyle = '#182016';
  gCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 4;
    const roll = Math.random();
    if (roll < 0.45) gCtx.fillStyle = 'rgba(20, 26, 17, 0.65)';
    else if (roll < 0.78) gCtx.fillStyle = 'rgba(34, 46, 26, 0.55)';
    else if (roll < 0.94) gCtx.fillStyle = 'rgba(48, 36, 24, 0.5)';
    else gCtx.fillStyle = 'rgba(58, 68, 40, 0.45)';
    gCtx.fillRect(x, y, r, r);
  }
  // Scattered pine needles
  gCtx.strokeStyle = 'rgba(42, 34, 20, 0.5)';
  gCtx.lineWidth = 1;
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const a = Math.random() * Math.PI * 2;
    gCtx.beginPath();
    gCtx.moveTo(x, y);
    gCtx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
    gCtx.stroke();
  }
  const groundAlbedo = new THREE.CanvasTexture(gCanvas);
  groundAlbedo.colorSpace = THREE.SRGBColorSpace;
  groundAlbedo.wrapS = THREE.RepeatWrapping;
  groundAlbedo.wrapT = THREE.RepeatWrapping;
  groundAlbedo.repeat.set(28, 28);
  groundAlbedo.anisotropy = Math.min(8, maxAnisotropy);

  // 2. Tree Bark Texture
  const [bCanvas, bCtx] = makeCanvas(256);
  bCtx.fillStyle = '#292019';
  bCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 4) {
    const shade = 22 + Math.floor(Math.random() * 24);
    bCtx.fillStyle = `rgb(${shade + 10}, ${shade + 2}, ${shade - 4})`;
    bCtx.fillRect(x, 0, 3, 256);
  }
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const h = 14 + Math.random() * 38;
    bCtx.fillStyle = 'rgba(10, 8, 6, 0.65)';
    bCtx.fillRect(x, y, 2, h);
  }
  const barkAlbedo = new THREE.CanvasTexture(bCanvas);
  barkAlbedo.colorSpace = THREE.SRGBColorSpace;
  barkAlbedo.wrapS = THREE.RepeatWrapping;
  barkAlbedo.wrapT = THREE.RepeatWrapping;
  barkAlbedo.anisotropy = Math.min(4, maxAnisotropy);

  // 3. Weathered Wood Planks Texture
  const [wCanvas, wCtx] = makeCanvas(256);
  wCtx.fillStyle = '#3a2c20';
  wCtx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    wCtx.fillStyle = row % 2 === 0 ? '#3e2f22' : '#33261b';
    wCtx.fillRect(0, y + 2, 256, 60);
    wCtx.fillStyle = '#18110c';
    wCtx.fillRect(0, y, 256, 2);
    for (let g = 0; g < 35; g++) {
      wCtx.fillStyle = 'rgba(20, 14, 9, 0.35)';
      wCtx.fillRect(0, y + 4 + Math.random() * 54, 256, 1.5);
    }
  }
  const woodAlbedo = new THREE.CanvasTexture(wCanvas);
  woodAlbedo.colorSpace = THREE.SRGBColorSpace;
  woodAlbedo.wrapS = THREE.RepeatWrapping;
  woodAlbedo.wrapT = THREE.RepeatWrapping;
  woodAlbedo.anisotropy = Math.min(4, maxAnisotropy);

  // 4. Rock Texture
  const [rCanvas, rCtx] = makeCanvas(256);
  rCtx.fillStyle = '#3b4048';
  rCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const s = 2 + Math.random() * 9;
    const v = 42 + Math.floor(Math.random() * 38);
    rCtx.fillStyle = `rgba(${v}, ${v + 4}, ${v + 8}, 0.45)`;
    rCtx.fillRect(x, y, s, s);
  }
  const rockAlbedo = new THREE.CanvasTexture(rCanvas);
  rockAlbedo.colorSpace = THREE.SRGBColorSpace;
  rockAlbedo.wrapS = THREE.RepeatWrapping;
  rockAlbedo.wrapT = THREE.RepeatWrapping;

  // 5. Soft Radial Particle / Muzzle Glow Sprite
  const [sCanvas, sCtx] = makeCanvas(64);
  const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,230,180,0.75)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 64, 64);
  const sparkSprite = new THREE.CanvasTexture(sCanvas);
  sparkSprite.colorSpace = THREE.SRGBColorSpace;

  return {
    groundAlbedo,
    barkAlbedo,
    woodAlbedo,
    rockAlbedo,
    sparkSprite,
    dispose: () => {
      groundAlbedo.dispose();
      barkAlbedo.dispose();
      woodAlbedo.dispose();
      rockAlbedo.dispose();
      sparkSprite.dispose();
    },
  };
}
