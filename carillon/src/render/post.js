// render/post.js — post-traitements du renderer (sous-module de render/,
// importé uniquement par renderer.js) : brume en 2 couches parallaxe, cendres
// qui tombent, grain et vignette. Toutes les textures sont générées UNE fois en
// offscreen à partir de bruit doux seedé (VFX, autorisé) ; à la frame il ne reste
// que des fillRect de motifs et des drawImage.

import { makeRng } from '../core/rng.js';

const FOG_SIZE = 256, GRAIN_SIZE = 128, ASH_COUNT = 110;
let fogPattern = null, grainPattern = null, vignetteCanvas = null;
let fogTime = 0;
// Cendres en espace écran : tableaux typés, aucune allocation à la frame.
const ashX = new Float32Array(ASH_COUNT), ashY = new Float32Array(ASH_COUNT);
const ashVx = new Float32Array(ASH_COUNT), ashVy = new Float32Array(ASH_COUNT);
const ashSize = new Uint8Array(ASH_COUNT), ashAlpha = new Float32Array(ASH_COUNT), ashPhase = new Float32Array(ASH_COUNT);
let lastCamX = 0, lastCamY = 0, ashW = 480, ashH = 270;
let grainSeed = 1;

// Bruit de valeur lissé (interpolation cosinus) sur une grille périodique.
function valueNoise(rng, size, cell) {
  const n = size / cell;
  const lattice = new Float32Array(n * n);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng.next();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const gy = Math.floor(y / cell), fy = (y % cell) / cell, ty = (1 - Math.cos(fy * Math.PI)) / 2;
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / cell), fx = (x % cell) / cell, tx = (1 - Math.cos(fx * Math.PI)) / 2;
      const a = lattice[gy * n + gx], b = lattice[gy * n + ((gx + 1) % n)];
      const c = lattice[((gy + 1) % n) * n + gx], d = lattice[((gy + 1) % n) * n + ((gx + 1) % n)];
      out[y * size + x] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
    }
  }
  return out;
}

/** Génère brume, grain, vignette. `fogColor` = [r,g,b] (gris-silence par défaut). */
export function initPost(ctx, w, h, seed = 7, fogColor = [143, 141, 147]) {
  const rng = makeRng(seed);
  // Brume : 3 octaves de bruit doux, alpha seul (couleur constante).
  const fog = document.createElement('canvas'); fog.width = FOG_SIZE; fog.height = FOG_SIZE;
  const fg = fog.getContext('2d');
  const img = fg.createImageData(FOG_SIZE, FOG_SIZE);
  const o1 = valueNoise(rng, FOG_SIZE, 64), o2 = valueNoise(rng, FOG_SIZE, 32), o3 = valueNoise(rng, FOG_SIZE, 16);
  for (let i = 0; i < FOG_SIZE * FOG_SIZE; i++) {
    let v = o1[i] * 0.6 + o2[i] * 0.3 + o3[i] * 0.1;
    v = Math.max(0, (v - 0.35) / 0.65);          // creuse les vides entre nappes
    img.data[i * 4] = fogColor[0]; img.data[i * 4 + 1] = fogColor[1]; img.data[i * 4 + 2] = fogColor[2];
    img.data[i * 4 + 3] = Math.round(v * v * 255);
  }
  fg.putImageData(img, 0, 0);
  fogPattern = ctx.createPattern(fog, 'repeat');

  // Grain : pixels clairs/sombres épars.
  const gr = document.createElement('canvas'); gr.width = GRAIN_SIZE; gr.height = GRAIN_SIZE;
  const gg = gr.getContext('2d');
  const gi = gg.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  for (let i = 0; i < GRAIN_SIZE * GRAIN_SIZE; i++) {
    const r = rng.next();
    const light = r > 0.5;
    const c = light ? 255 : 0;
    gi.data[i * 4] = c; gi.data[i * 4 + 1] = c; gi.data[i * 4 + 2] = c;
    gi.data[i * 4 + 3] = Math.round(Math.abs(r - 0.5) * 2 * 90);
  }
  gg.putImageData(gi, 0, 0);
  grainPattern = ctx.createPattern(gr, 'repeat');

  // Vignette : transparent au centre, suie aux bords.
  vignetteCanvas = document.createElement('canvas'); vignetteCanvas.width = w; vignetteCanvas.height = h;
  const vg = vignetteCanvas.getContext('2d');
  const grad = vg.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
  grad.addColorStop(0, 'rgba(22,19,15,0)'); grad.addColorStop(0.6, 'rgba(22,19,15,0.55)'); grad.addColorStop(1, 'rgba(22,19,15,1)');
  vg.fillStyle = grad; vg.fillRect(0, 0, w, h);

  // Cendres.
  ashW = w; ashH = h;
  for (let i = 0; i < ASH_COUNT; i++) {
    ashX[i] = rng.range(0, w); ashY[i] = rng.range(0, h);
    ashSize[i] = rng.chance(0.25) ? 2 : 1;
    ashVx[i] = rng.range(-6, 4); ashVy[i] = rng.range(8, 22) * (ashSize[i] === 2 ? 1.4 : 1);
    ashAlpha[i] = rng.range(0.25, 0.6); ashPhase[i] = rng.range(0, 6.28);
  }
}

/** Deux nappes de brume en parallaxe (camX/camY = centre caméra monde). */
export function drawFog(ctx, camX, camY, dt, intensity) {
  if (!fogPattern || intensity <= 0) return;
  fogTime += dt;
  ctx.fillStyle = fogPattern;
  // Couche lointaine : lente, transparente ; couche proche : plus rapide, plus dense.
  drawFogLayer(ctx, -camX * 0.25 - fogTime * 5, -camY * 0.25 + fogTime * 1.5, intensity * 0.35);
  drawFogLayer(ctx, -camX * 0.55 + 97 - fogTime * 11, -camY * 0.55 + 41 + fogTime * 3, intensity * 0.22);
}

function drawFogLayer(ctx, ox, oy, alpha) {
  ox = ((ox % FOG_SIZE) + FOG_SIZE) % FOG_SIZE; oy = ((oy % FOG_SIZE) + FOG_SIZE) % FOG_SIZE;
  ctx.globalAlpha = alpha;
  ctx.setTransform(1, 0, 0, 1, ox, oy);
  ctx.fillRect(-ox, -oy, ashW, ashH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}

/** Cendres qui tombent (espace écran, parallaxe légère avec la caméra). */
export function drawAshes(ctx, camX, camY, dt, density) {
  if (density <= 0) return;
  const dx = (camX - lastCamX) * 0.6, dy = (camY - lastCamY) * 0.6;
  lastCamX = camX; lastCamY = camY;
  const n = Math.min(ASH_COUNT, Math.round(ASH_COUNT * density));
  ctx.fillStyle = '#d8cdb4';
  for (let i = 0; i < n; i++) {
    ashPhase[i] += dt * 1.3;
    ashX[i] += (ashVx[i] + Math.sin(ashPhase[i]) * 9) * dt - dx;
    ashY[i] += ashVy[i] * dt - dy;
    if (ashY[i] > ashH + 2) { ashY[i] = -2; ashX[i] = (ashX[i] * 7 + i * 31) % ashW; }
    else if (ashY[i] < -4) ashY[i] = ashH + 2;
    if (ashX[i] < -2) ashX[i] += ashW + 4; else if (ashX[i] > ashW + 2) ashX[i] -= ashW + 4;
    ctx.globalAlpha = ashAlpha[i] * (0.7 + 0.3 * Math.sin(ashPhase[i] * 0.5));
    ctx.fillRect(ashX[i] | 0, ashY[i] | 0, ashSize[i], ashSize[i]);
  }
  ctx.globalAlpha = 1;
}

export function drawVignette(ctx, amount) {
  if (!vignetteCanvas || amount <= 0) return;
  ctx.globalAlpha = Math.min(1, amount);
  ctx.drawImage(vignetteCanvas, 0, 0);
  ctx.globalAlpha = 1;
}

/** Grain : motif décalé aléatoirement à chaque frame (LCG, sans allocation). */
export function drawGrain(ctx, amount) {
  if (!grainPattern || amount <= 0) return;
  grainSeed = (Math.imul(grainSeed, 1664525) + 1013904223) >>> 0;
  const ox = grainSeed & (GRAIN_SIZE - 1), oy = (grainSeed >>> 8) & (GRAIN_SIZE - 1);
  ctx.globalAlpha = amount * 0.5;
  ctx.fillStyle = grainPattern;
  ctx.setTransform(1, 0, 0, 1, ox, oy);
  ctx.fillRect(-ox, -oy, ashW, ashH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}
