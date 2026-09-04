// game/ground.js — sol pré-rendu par chunks de 512 px (ARCHITECTURE.md § 13) et décor.
// Module de sol UNIQUE du jeu (l'ancien render/ground.js a été fusionné ici) : état par monde
// (createGround), nappes de terrain par bruit de valeur (groupes de `groundGroups` du tileset),
// petits props cuits dans le chunk, grands props sprites et props lumineux listés par chunk et
// triés par y avec les entités (world.js). Tout est déterministe (hash3f de la seed et des
// coordonnées) : jamais Math.random. Un chunk est peint une seule fois dans un canvas hors-écran ;
// les chunks trop éloignés sont évincés (MAX_CHUNKS).
//
// parishDef : { tileset, props: [spriteId], lights: [spriteId], groundGroups?: [nom] }.
// Sans `groundGroups`, les nappes utilisent les groupes du tileset sauf les transitions
// (edge_*, bank_*, river_*, deep), la première étant la base.

import { hash3f } from '../core/rng.js';
import { drawTile, tileDef, draw, spriteDef, frameAt } from '../render/atlas.js';
import { viewRect } from '../render/camera.js';
import { addLight, addGlow } from '../render/lighting.js';

export const CHUNK = 512;
const TILE = 32;
const MAX_CHUNKS = 36;
const MAX_GROUPS = 4;
const TRANSITION = /^(edge|bank|river)_|^deep$/;

export function createGround(parishDef, seed) {
  const td = tileDef(parishDef.tileset);
  const gg = (td && td.groundGroups) || {};
  let names = parishDef.groundGroups && parishDef.groundGroups.length ? parishDef.groundGroups : Object.keys(gg).filter((n) => !TRANSITION.test(n));
  names = names.filter((n) => gg[n] && gg[n].length).slice(0, MAX_GROUPS);
  const groups = names.map((n) => gg[n]);
  if (!groups.length && td) groups.push(td.ground);
  const propKeys = td && td.props ? Object.keys(td.props).filter((n) => !/fence|post|wall/.test(n)) : [];
  return {
    tileset: parishDef.tileset, seed: seed >>> 0, chunks: new Map(), tallProps: parishDef.props || [],
    lightProps: parishDef.lights || [], propList: [], lightList: [],
    groups, propTiles: propKeys.map((n) => td.props[n]),
  };
}

function key(cx, cy) { return cx * 65536 + cy; }

// Bruit de valeur doux sur les coordonnées de tuiles (déterministe, sans allocation).
function noise(s, x, y, cell) {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
  const fx = x / cell - gx, fy = y / cell - gy;
  const tx = fx * fx * (3 - 2 * fx), ty = fy * fy * (3 - 2 * fy);
  const a = hash3f(s, gx, gy), b = hash3f(s, gx + 1, gy), c = hash3f(s, gx, gy + 1), d = hash3f(s, gx + 1, gy + 1);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

function smooth(v, a, b) { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); }

/**
 * Peint une case : la tuile de base partout (uniforme, jamais de tirage par case), puis les
 * variantes du groupe de base et les nappes des autres groupes FONDUES par bruit basse fréquence
 * (alpha progressif) : aucun bord franc de carreau, aucun damier haute fréquence.
 */
function paintCell(g, ground, tx, ty, px, py) {
  const groups = ground.groups, seed = ground.seed;
  const base = groups[0];
  drawCellTile(g, ground, base[0], tx, ty, px, py);
  // Variantes du groupe de base : nappes larges (cellule 6), fondu doux, jamais plus de 70 %.
  if (base.length > 1) {
    const n = noise(seed + 101, tx, ty, 6);
    const a = smooth(n, 0.52, 0.8) * 0.7;
    if (a > 0.02) {
      const vi = 1 + Math.floor(noise(seed + 103, tx, ty, 9) * (base.length - 1)) % base.length;
      g.globalAlpha = a; drawCellTile(g, ground, base[Math.min(vi, base.length - 1)], tx, ty, px, py); g.globalAlpha = 1;
    }
  }
  // Nappes des autres groupes : bruit fractal (2 octaves, façon Perlin) → zones organiques
  // qui s'estompent progressivement vers la base ; la densité des petits props suit ce bruit.
  for (let k = 1; k < groups.length; k++) {
    const n = zoneNoise(ground, k, tx, ty);
    const a = smooth(n, 0.58 + 0.03 * k, 0.8 + 0.03 * k);
    if (a <= 0.02) continue;
    const tiles = groups[k];
    const ti = Math.floor(noise(seed + 200 + k, tx, ty, 7) * tiles.length) % tiles.length;
    g.globalAlpha = a; drawCellTile(g, ground, tiles[ti], tx, ty, px, py); g.globalAlpha = 1;
  }
}

/** Dessine une tuile avec un miroir horizontal/vertical déterministe par case : quatre
 *  orientations de la même tuile suffisent à casser la répétition du motif tous les 32 px. */
function drawCellTile(g, ground, idx, tx, ty, px, py) {
  const h = hash3f(ground.seed + 500, tx, ty);
  const fx = h < 0.5, fy = (h * 4) % 1 < 0.5;
  if (!fx && !fy) { drawTile(g, ground.tileset, idx, px, py); return; }
  g.save();
  g.translate(px + (fx ? TILE : 0), py + (fy ? TILE : 0));
  g.scale(fx ? -1 : 1, fy ? -1 : 1);
  drawTile(g, ground.tileset, idx, 0, 0);
  g.restore();
}

/** Texture de bruit fin (256×256, 2 octaves, assombrissement seul) générée une fois par sol :
 *  posée en multiply dans le repère monde, elle casse la régularité de la grille de tuiles. */
function noiseTexture(ground) {
  if (ground.noiseCanvas) return ground.noiseCanvas;
  const N = 256, c = document.createElement('canvas'); c.width = N; c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data, s = ground.seed + 900;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    // Bruit périodique (les coordonnées sont repliées sur N pour que la texture se raccorde).
    const n = 0.6 * pnoise(s, x, y, 32, N) + 0.4 * pnoise(s + 1, x, y, 8, N);
    const v = Math.round(255 - 44 * n);           // 211..255 : n'assombrit que légèrement
    // Teinte tiède : le bleu s'assombrit un peu plus que le rouge (multiply → sol brun, jamais gris).
    const i = (y * N + x) * 4; d[i] = v; d[i + 1] = Math.round(v - 3 * n); d[i + 2] = Math.round(v - 9 * n); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  ground.noiseCanvas = c;
  return c;
}

/** Bruit de valeur périodique (période N) pour la texture. */
function pnoise(s, x, y, cell, N) {
  const per = N / cell;
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
  const fx = x / cell - gx, fy = y / cell - gy;
  const tx = fx * fx * (3 - 2 * fx), ty = fy * fy * (3 - 2 * fy);
  const a = hash3f(s, gx % per, gy % per), b = hash3f(s, (gx + 1) % per, gy % per);
  const c = hash3f(s, gx % per, (gy + 1) % per), d = hash3f(s, (gx + 1) % per, (gy + 1) % per);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/** Bruit de zone fractal (2 octaves) du groupe k, dans [0, 1]. */
function zoneNoise(ground, k, tx, ty) {
  const seed = ground.seed;
  return 0.68 * noise(seed + k * 7919, tx, ty, 9 + k) + 0.32 * noise(seed + k * 7919 + 17, tx, ty, 4);
}

/** Ombrage doux du sol (multiply) : taches brunes larges qui cassent la grille des carreaux.
 *  Les taches des 8 chunks voisins sont aussi peintes (décalées) pour qu'aucune couture n'apparaisse. */
function shadeChunk(g, ground, cx, cy) {
  g.save();
  g.globalCompositeOperation = 'multiply';
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const ox = dx * CHUNK, oy = dy * CHUNK, ncx = cx + dx, ncy = cy + dy;
    const n = 7 + Math.floor(hash3f(ground.seed + 300, ncx, ncy) * 4);
    for (let i = 0; i < n; i++) {
      const x = ox + hash3f(ground.seed + 310 + i, ncx, ncy) * CHUNK, y = oy + hash3f(ground.seed + 320 + i, ncx, ncy) * CHUNK;
      const r = 70 + hash3f(ground.seed + 330 + i, ncx, ncy) * 130;
      if (x + r < 0 || x - r > CHUNK || y + r < 0 || y - r > CHUNK) continue;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      const k = 0.2 + hash3f(ground.seed + 340 + i, ncx, ncy) * 0.14;
      // Ombre brune (tourbe chaude), jamais noir pur : les taches restent des taches de terre.
      grad.addColorStop(0, `rgba(58, 40, 26, ${k})`); grad.addColorStop(1, 'rgba(58, 40, 26, 0)');
      g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  g.restore();
}

function buildChunk(ground, cx, cy) {
  const td = tileDef(ground.tileset);
  const canvas = document.createElement('canvas');
  canvas.width = CHUNK; canvas.height = CHUNK;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (td) {
    const n = CHUNK / TILE;
    const propTiles = ground.propTiles;
    for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
      const wx = cx * n + tx, wy = cy * n + ty;
      paintCell(g, ground, wx, wy, tx * TILE, ty * TILE);
      // Petits props au sol (rochers, os, touffes) : rares.
      const veg = ground.groups.length > 1 ? smooth(zoneNoise(ground, ground.groups.length - 1, wx, wy), 0.45, 0.85) : 0;
      if (propTiles.length && hash3f(ground.seed + 7, wx, wy) < 0.01 + 0.11 * veg) {
        drawTile(g, ground.tileset, propTiles[Math.floor(hash3f(ground.seed + 8, wx, wy) * propTiles.length)], tx * TILE, ty * TILE);
      }
    }
    // Bruit fin en multiply, aligné sur le repère monde (texture périodique : aucune couture).
    g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.55;
    const tex = noiseTexture(ground);
    for (let y = 0; y < CHUNK; y += 256) for (let x = 0; x < CHUNK; x += 256) g.drawImage(tex, x, y);
    g.restore();
    shadeChunk(g, ground, cx, cy);
  }
  // Props hauts (2 à 4 par chunk) et lumières (0 à 2), positions déterministes.
  const entry = { canvas, props: [], x: cx * CHUNK, y: cy * CHUNK };
  const nTall = ground.tallProps.length ? 2 + Math.floor(hash3f(ground.seed + 11, cx, cy) * 3) : 0;
  for (let i = 0; i < nTall; i++) {
    const sprite = ground.tallProps[Math.floor(hash3f(ground.seed + 20 + i, cx, cy) * ground.tallProps.length)];
    if (!spriteDef(sprite)) continue;
    entry.props.push({ sprite, x: cx * CHUNK + 40 + hash3f(ground.seed + 30 + i, cx, cy) * (CHUNK - 80), y: cy * CHUNK + 40 + hash3f(ground.seed + 40 + i, cx, cy) * (CHUNK - 80), light: false, r: 60 });
  }
  const nLight = ground.lightProps.length ? Math.floor(hash3f(ground.seed + 12, cx, cy) * 2.6) : 0;
  for (let i = 0; i < nLight; i++) {
    const sprite = ground.lightProps[Math.floor(hash3f(ground.seed + 50 + i, cx, cy) * ground.lightProps.length)];
    if (!spriteDef(sprite)) continue;
    entry.props.push({ sprite, x: cx * CHUNK + 30 + hash3f(ground.seed + 60 + i, cx, cy) * (CHUNK - 60), y: cy * CHUNK + 30 + hash3f(ground.seed + 70 + i, cx, cy) * (CHUNK - 60), light: true, r: 30 });
  }
  entry.props.sort((a, b) => a.y - b.y);
  return entry;
}

function evict(ground, cx, cy) {
  if (ground.chunks.size < MAX_CHUNKS) return;
  for (const [k, c] of ground.chunks) {
    const dx = c.x / CHUNK - cx, dy = c.y / CHUNK - cy;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) ground.chunks.delete(k);
  }
}

/** Dessine le sol visible ; remplit ground.propList / lightList avec les props visibles. */
export function renderGround(ctx, ground, time) {
  const v = viewRect();
  const cx0 = Math.floor((v.x - 64) / CHUNK), cy0 = Math.floor((v.y - 64) / CHUNK);
  const cx1 = Math.floor((v.x + v.w + 64) / CHUNK), cy1 = Math.floor((v.y + v.h + 64) / CHUNK);
  ground.propList.length = 0; ground.lightList.length = 0;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const k = key(cx, cy);
    let c = ground.chunks.get(k);
    if (!c) { evict(ground, cx, cy); c = buildChunk(ground, cx, cy); ground.chunks.set(k, c); }
    // Le chunk n'est dessiné que s'il touche la vue ; ses props (arbres hauts) sont testés à part.
    if (c.x + CHUNK >= v.x && c.x <= v.x + v.w && c.y + CHUNK >= v.y && c.y <= v.y + v.h) ctx.drawImage(c.canvas, c.x, c.y);
    for (let i = 0; i < c.props.length; i++) {
      const pr = c.props[i];
      if (pr.x + 80 < v.x || pr.x - 80 > v.x + v.w || pr.y + 20 < v.y || pr.y - 160 > v.y + v.h) continue;
      ground.propList.push(pr);
      if (pr.light) ground.lightList.push(pr);
    }
  }
}

/** Dessine un prop (appelé par world.js dans l'ordre trié par y) ; les props lumineux éclairent. */
export function drawProp(ctx, pr, time) {
  draw(ctx, pr.sprite, 'idle', frameAt(pr.sprite, 'idle', time), pr.x, pr.y);
  // Feu de suif : large, ambré, qui vacille franchement ; braise additive plus présente.
  if (pr.light) { addLight(pr.x, pr.y - 10, 104, '#e8874a', 0.95, 0.32); addGlow(pr.x, pr.y - 12, 14, '#e0603a', 0.55); }
}

export function chunkCount(ground) { return ground.chunks.size; }
