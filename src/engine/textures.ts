import * as THREE from 'three';

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number,
  generateMipmaps = true,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(4, maxAnisotropy);
  if (!generateMipmaps) {
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
  }
  tex.needsUpdate = true;
  return tex;
}

export function createCobblestoneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#E9DCC8';
  ctx.fillRect(0, 0, 128, 128);

  const colors = ['#DFCBB0', '#E8D5B9', '#D6BEA0', '#EDDDC5'];
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 === 0 ? 0 : 16;
    for (let col = -1; col < 4; col++) {
      ctx.fillStyle = colors[(row * 3 + col + 4) % colors.length];
      ctx.beginPath();
      ctx.roundRect(col * 32 + offset + 2, row * 32 + 2, 28, 28, 5);
      ctx.fill();
    }
  }
  return finalizeColorTexture(canvas, 34, 34, maxAnisotropy);
}

export function createGrassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#4B9B46';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 240; i++) {
    const x = (i * 53) % 128;
    const y = (i * 97) % 128;
    ctx.fillStyle = i % 3 === 0 ? '#57AD4F' : i % 3 === 1 ? '#3D8839' : '#65BA5C';
    ctx.fillRect(x, y, 3, 5);
  }
  return finalizeColorTexture(canvas, 28, 28, maxAnisotropy);
}

export function createPitchTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2F8F3D' : '#389F46';
    ctx.fillRect(0, i * 25.6, 256, 25.6);
  }
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 236, 236);
  ctx.beginPath();
  ctx.moveTo(10, 128);
  ctx.lineTo(246, 128);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 128, 28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(73, 10, 110, 42);
  ctx.strokeRect(73, 204, 110, 42);
  const tex = finalizeColorTexture(canvas, 1, 1, maxAnisotropy);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createBasketballCourtTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 128);
  ctx.fillStyle = '#C96A3B';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#FFFBEB';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 240, 112);
  ctx.beginPath();
  ctx.moveTo(128, 8);
  ctx.lineTo(128, 120);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 64, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(8, 38, 48, 52);
  ctx.strokeRect(200, 38, 48, 52);
  const tex = finalizeColorTexture(canvas, 1, 1, maxAnisotropy);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createSignboardTexture(
  title: string,
  subtitle: string,
  bgA: string,
  bgB: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 96);
  const grad = ctx.createLinearGradient(0, 0, 256, 96);
  grad.addColorStop(0, bgA);
  grad.addColorStop(1, bgB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 96);

  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 88);

  ctx.fillStyle = '#1E1B18';
  ctx.fillRect(8, 8, 240, 80);

  ctx.fillStyle = bgA;
  ctx.fillRect(10, 10, 236, 76);

  ctx.fillStyle = '#FFFDF7';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 21px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(title.slice(0, 24), 128, 38);

  ctx.fillStyle = '#FEF08A';
  ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subtitle.slice(0, 34), 128, 65);

  const tex = finalizeColorTexture(canvas, 1, 1, maxAnisotropy, false);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createRadialShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
  grad.addColorStop(0.6, 'rgba(15, 23, 42, 0.22)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function createGlowHaloTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(64, 64);
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
  grad.addColorStop(0.35, 'rgba(251, 146, 60, 0.42)');
  grad.addColorStop(0.75, 'rgba(245, 158, 11, 0.12)');
  grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

export function createRangoliTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  const cx = 64;
  const cy = 64;

  const palette = ['#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#EF4444'];
  for (let ring = 0; ring < 2; ring++) {
    const petals = ring === 0 ? 16 : 12;
    const rad = ring === 0 ? 53 : 39;
    const pr = ring === 0 ? 9 : 8;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      ctx.fillStyle = palette[(i + ring * 2) % palette.length];
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 47, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#F97316';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 31, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAnisotropy);
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createNameTagTexture(
  name: string,
  badgeText: string | null,
  bubbleText: string | null,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(192, 72);
  ctx.clearRect(0, 0, 192, 72);

  if (bubbleText) {
    ctx.fillStyle = 'rgba(255, 251, 242, 0.96)';
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(6, 4, 180, 32, 9);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const clipped = bubbleText.length > 30 ? `${bubbleText.slice(0, 28)}…` : bubbleText;
    ctx.fillText(clipped, 96, 20);
  }

  ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
  ctx.beginPath();
  ctx.roundRect(36, 42, 120, 22, 6);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = badgeText ? `${badgeText} ${name}` : name;
  ctx.fillText(label.slice(0, 22), 96, 53);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
