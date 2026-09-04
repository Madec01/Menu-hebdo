// render/ground.js — sol pré-rendu par chunks de 512 px (ARCHITECTURE.md § 13).
// Chaque chunk est un offscreen canvas peint UNE fois à partir d'un tileset du
// manifeste et d'un rng seedé (déterministe par seed + coordonnées de chunk) ;
// renderGround ne fait qu'un drawImage par chunk visible. Les petits props du
// tileset (touffes, cailloux, os) sont cuits dans le chunk ; les grands props
// sprites (arbres, stèles) sont listés par propsAt(chunk) pour que le jeu les
// trie par y avec les entités (et y accroche une lumière si prop.light).
//
// API :
//   initGround({ tilesetId, seed, groups, props, propDensity, sprites, spriteDensity })
//     groups   : noms de groundGroups ; le premier est la base, les suivants forment
//                des nappes par bruit (ex. ['ash', 'dirt', 'grass_dead']).
//     props    : noms de tiles.props à cuire (défaut : tous sauf clôtures/murs).
//     sprites  : ids de sprites `kind: 'prop'` à disperser (défaut : ceux de la
//                paroisse du tileset), spriteDensity ≈ nombre par chunk.
//   renderGround(ctx, camera)  camera = module render/camera.js (viewRect()).
//   propsAt(cx, cy) → [{ sprite, x, y, light }]   (ou propsAt({cx, cy}))
//   visibleProps(camera, out) → out (tableau réutilisé, tous les props visibles)
//   chunkOf(x, y) → { cx, cy } (objet réutilisé)

import * as atlas from './atlas.js';
import { makeRng, hash3, hash3f } from '../core/rng.js';

export const CHUNK = 512;
const MAX_CHUNKS = 16;
const chunks = new Map();     // clé → { canvas, cx, cy, props: [] }
const chunkRef = { cx: 0, cy: 0 };
let cfg = null;
let tileset = null, tileW = 32, tilesPerChunk = 16;
let seed = 1;

function key(cx, cy) { return cx * 65536 + cy; }

// Bruit de valeur doux sur les coordonnées de tuiles (période libre, déterministe).
function noise(s, x, y, cell) {
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
  const fx = x / cell - gx, fy = y / cell - gy;
  const tx = fx * fx * (3 - 2 * fx), ty = fy * fy * (3 - 2 * fy);
  const a = hash3f(s, gx, gy), b = hash3f(s, gx + 1, gy), c = hash3f(s, gx, gy + 1), d = hash3f(s, gx + 1, gy + 1);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

export function initGround({ tilesetId, seed: s = 1, groups = null, props = null, propDensity = 0.05, sprites = null, spriteDensity = 3 }) {
  tileset = atlas.tileDef(tilesetId);
  if (!tileset) throw new Error('tileset inconnu ' + tilesetId);
  seed = s >>> 0;
  tileW = tileset.tileW; tilesPerChunk = Math.floor(CHUNK / tileW);
  const gg = tileset.groundGroups || {};
  const groupNames = groups && groups.length ? groups : [Object.keys(gg)[0]];
  const propNames = props || Object.keys(tileset.props || {}).filter((n) => !/fence|post|wall/.test(n));
  const manifest = atlas.getManifest();
  const parish = tilesetId === 'beffroi' ? 'beffroi' : tilesetId;
  const spriteIds = sprites || Object.keys(manifest.sprites).filter((id) => {
    const sp = manifest.sprites[id]; return sp.kind === 'prop' && sp.parish === parish;
  });
  cfg = {
    tilesetId,
    groups: groupNames.map((n) => gg[n] || tileset.ground.slice(0, 1)),
    propTiles: propNames.map((n) => tileset.props[n]).filter((v) => v !== undefined),
    propDensity, spriteIds, spriteDensity,
  };
  chunks.clear();
}

// Peint un chunk : base + nappes par bruit + petits props ; liste les grands props.
function buildChunk(cx, cy) {
  const canvas = document.createElement('canvas');
  canvas.width = CHUNK; canvas.height = CHUNK;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const rng = makeRng(hash3(seed, cx, cy));
  const n = tilesPerChunk;
  const groups = cfg.groups;
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      const wx = cx * n + tx, wy = cy * n + ty;
      // Choix du groupe : la nappe la plus « haute » qui dépasse son seuil.
      let gi = 0;
      for (let k = groups.length - 1; k >= 1; k--) {
        const v = noise(seed + k * 7919, wx, wy, 5 + k);
        if (v > 0.62 + 0.03 * k) { gi = k; break; }
      }
      const tiles = groups[gi];
      // Variante : les premières tuiles d'un groupe sont les plus unies → pondération.
      const r = rng.next();
      const idx = r < 0.6 ? Math.floor(rng.next() * Math.min(2, tiles.length)) : Math.floor(rng.next() * tiles.length);
      atlas.drawTile(g, cfg.tilesetId, tiles[idx], tx * tileW, ty * tileW);
      if (cfg.propTiles.length && rng.chance(cfg.propDensity)) {
        atlas.drawTile(g, cfg.tilesetId, rng.pick(cfg.propTiles), tx * tileW, ty * tileW);
      }
    }
  }
  const props = [];
  if (cfg.spriteIds.length) {
    const count = Math.round(cfg.spriteDensity * rng.range(0.6, 1.4));
    for (let i = 0; i < count; i++) {
      const id = rng.pick(cfg.spriteIds);
      const sp = atlas.spriteDef(id);
      props.push({ sprite: id, x: cx * CHUNK + rng.range(24, CHUNK - 24), y: cy * CHUNK + rng.range(24, CHUNK - 24), light: !!(sp && sp.light), r: sp ? sp.frameW * 0.25 : 8 });
    }
    props.sort((a, b) => a.y - b.y);
  }
  return { canvas, cx, cy, props, last: 0 };
}

function getChunk(cx, cy) {
  const k = key(cx, cy);
  let c = chunks.get(k);
  if (!c) {
    c = buildChunk(cx, cy);
    if (chunks.size >= MAX_CHUNKS) evict();
    chunks.set(k, c);
  }
  return c;
}

let frame = 0;
// Éviction du chunk le moins récemment vu.
function evict() {
  let oldestKey = null, oldest = Infinity;
  for (const [k, c] of chunks) if (c.last < oldest) { oldest = c.last; oldestKey = k; }
  if (oldestKey !== null) chunks.delete(oldestKey);
}

/** Chunk contenant (x, y) monde (objet réutilisé). */
export function chunkOf(x, y) { chunkRef.cx = Math.floor(x / CHUNK); chunkRef.cy = Math.floor(y / CHUNK); return chunkRef; }

/** Dessine les chunks visibles (ctx caméra). Construit ceux qui manquent. */
export function renderGround(ctx, cam) {
  if (!cfg) return;
  frame++;
  const v = cam.viewRect();
  const cx0 = Math.floor(v.x / CHUNK), cy0 = Math.floor(v.y / CHUNK);
  const cx1 = Math.floor((v.x + v.w) / CHUNK), cy1 = Math.floor((v.y + v.h) / CHUNK);
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const c = getChunk(cx, cy);
      c.last = frame;
      ctx.drawImage(c.canvas, cx * CHUNK, cy * CHUNK);
    }
  }
}

/** Grands props d'un chunk (cx, cy) ou ({cx, cy}). */
export function propsAt(cx, cy) {
  if (typeof cx === 'object') { cy = cx.cy; cx = cx.cx; }
  if (!cfg) return [];
  return getChunk(cx, cy).props;
}

/** Remplit `out` (vidé) avec les props des chunks visibles ; renvoie out. */
export function visibleProps(cam, out) {
  out.length = 0;
  if (!cfg) return out;
  const v = cam.viewRect();
  const cx0 = Math.floor((v.x - 96) / CHUNK), cy0 = Math.floor((v.y - 96) / CHUNK);
  const cx1 = Math.floor((v.x + v.w + 96) / CHUNK), cy1 = Math.floor((v.y + v.h + 96) / CHUNK);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const props = getChunk(cx, cy).props;
    for (let i = 0; i < props.length; i++) out.push(props[i]);
  }
  return out;
}

/** Dessine un prop (idle animé si le sprite a plusieurs frames). */
export function drawProp(ctx, prop, timeSec = 0) {
  atlas.draw(ctx, prop.sprite, 'idle', atlas.frameAt(prop.sprite, 'idle', timeSec), prop.x, prop.y);
}

export function chunkCount() { return chunks.size; }
