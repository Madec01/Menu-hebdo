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

/** Tuile d'une case : la nappe la plus « haute » qui dépasse son seuil, sinon la base. */
function pickGround(ground, tx, ty) {
  const groups = ground.groups, seed = ground.seed;
  let gi = 0;
  for (let k = groups.length - 1; k >= 1; k--) {
    if (noise(seed + k * 7919, tx, ty, 5 + k) > 0.62 + 0.03 * k) { gi = k; break; }
  }
  const tiles = groups[gi];
  // Les premières tuiles d'un groupe sont les plus unies : pondération vers elles.
  const r = hash3f(seed + 1, tx, ty);
  const idx = r < 0.6 ? Math.floor(hash3f(seed + 2, tx, ty) * Math.min(2, tiles.length)) : Math.floor(hash3f(seed + 3, tx, ty) * tiles.length);
  return tiles[idx];
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
      drawTile(g, ground.tileset, pickGround(ground, wx, wy), tx * TILE, ty * TILE);
      // Petits props au sol (rochers, os, touffes) : rares.
      if (propTiles.length && hash3f(ground.seed + 7, wx, wy) < 0.04) {
        drawTile(g, ground.tileset, propTiles[Math.floor(hash3f(ground.seed + 8, wx, wy) * propTiles.length)], tx * TILE, ty * TILE);
      }
    }
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
  if (pr.light) { addLight(pr.x, pr.y - 10, 80, '#e0603a', 0.85, 0.25); addGlow(pr.x, pr.y - 12, 10, '#e0603a', 0.4); }
}

export function chunkCount(ground) { return ground.chunks.size; }
