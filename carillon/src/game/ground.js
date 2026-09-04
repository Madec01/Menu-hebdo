// game/ground.js — sol pré-rendu par chunks de 512 px (ARCHITECTURE.md § 13) et décor.
// Les tuiles viennent du tileset de la paroisse (assets/manifest.json : groundGroups, props) ;
// le choix est déterministe (hash3f de la seed et des coordonnées), jamais Math.random.
// Un chunk est rendu une seule fois dans un canvas hors-écran ; les props hauts (arbres, stèles)
// sont enregistrés dans world.props (triés par y avec les entités) et les props lumineux
// (feu de camp, torches) reçoivent une lumière au rendu (world.js).

import { hash3f } from '../core/rng.js';
import { drawTile, tileDef, draw, spriteDef, frameAt } from '../render/atlas.js';
import { viewRect } from '../render/camera.js';
import { addLight } from '../render/lighting.js';

const CHUNK = 512;
const TILE = 32;
const MAX_CHUNKS = 36;

export function createGround(parishDef, seed) {
  return {
    tileset: parishDef.tileset, seed: seed >>> 0, chunks: new Map(), tallProps: parishDef.props || [],
    lightProps: parishDef.lights || [], propList: [], lightList: [],
  };
}

function key(cx, cy) { return cx * 65536 + cy; }

function pickGround(td, seed, tx, ty) {
  const groups = td.groundGroups;
  if (!groups) return td.ground[Math.floor(hash3f(seed, tx, ty) * td.ground.length)];
  const names = Object.keys(groups);
  const main = groups[names[0]];
  const r = hash3f(seed, tx, ty);
  if (r < 0.82 || names.length === 1) return main[Math.floor(hash3f(seed + 1, tx, ty) * main.length)];
  const g = groups[names[1 + Math.floor(hash3f(seed + 2, tx, ty) * (names.length - 1))]];
  return g[Math.floor(hash3f(seed + 3, tx, ty) * g.length)];
}

function buildChunk(ground, cx, cy) {
  const td = tileDef(ground.tileset);
  const canvas = document.createElement('canvas');
  canvas.width = CHUNK; canvas.height = CHUNK;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (td) {
    const n = CHUNK / TILE;
    const propKeys = td.props ? Object.keys(td.props) : [];
    for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
      const wx = cx * n + tx, wy = cy * n + ty;
      drawTile(g, ground.tileset, pickGround(td, ground.seed, wx, wy), tx * TILE, ty * TILE);
      // Petits props au sol (rochers, os, touffes) : rares.
      if (propKeys.length && hash3f(ground.seed + 7, wx, wy) < 0.035) {
        const pk = propKeys[Math.floor(hash3f(ground.seed + 8, wx, wy) * propKeys.length)];
        drawTile(g, ground.tileset, td.props[pk], tx * TILE, ty * TILE);
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
    ctx.drawImage(c.canvas, c.x, c.y);
    for (let i = 0; i < c.props.length; i++) {
      const pr = c.props[i];
      if (pr.x + 80 < v.x || pr.x - 80 > v.x + v.w || pr.y + 20 < v.y || pr.y - 160 > v.y + v.h) continue;
      ground.propList.push(pr);
      if (pr.light) ground.lightList.push(pr);
    }
  }
}

/** Dessine un prop (appelé par world.js dans l'ordre trié par y). */
export function drawProp(ctx, pr, time) {
  draw(ctx, pr.sprite, 'idle', frameAt(pr.sprite, 'idle', time), pr.x, pr.y);
  if (pr.light) addLight(pr.x, pr.y - 10, 70, '#e0603a', 0.8, 0.25);
}
