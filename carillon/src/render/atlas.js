// render/atlas.js — feuilles de sprites décrites par assets/manifest.json
// (ARCHITECTURE.md § 7 et § 9.1). Toutes les images sont décodées au chargement
// (createImageBitmap) ; le dessin est un seul drawImage par appel, sans
// save/restore (flipX par scale(-1,1) aller-retour). Les teintes sont des copies
// de la feuille pré-générées par couleur (prepareTint) ; jamais de traitement
// par pixel à la frame.
//
// Conventions du manifeste : anim = { row, frames, fps, loop, col? } ; `col`
// décale la première colonne (cellules uniques : echo.small/medium/large,
// pickups.heal…) ; `directional: true` signifie que le sprite possède des anims
// `<base>_up/_left/_down/_right` en plus des alias `<base>` (voir dirAnim).

let manifest = null;
let base = 'assets/';
const bitmaps = new Map();   // fichier → ImageBitmap | HTMLImageElement
const tints = new Map();     // spriteId → Map(couleur → canvas teinté)
const warned = new Set();    // avertissements émis une seule fois
const NO_OPTS = Object.freeze({});
const TINT_ALPHA = 0.6;      // force de la colorisation (source-atop)
const animInfo = { frames: 1, fps: 1, loop: true }; // objet réutilisé par animFrames
let shadowSprite = null;     // ombre elliptique pré-rendue (64×32)

function warnOnce(key, msg) { if (!warned.has(key)) { warned.add(key); console.warn('[atlas]', msg, key); } }

async function loadImage(file) {
  const url = base + file;
  const res = await fetch(url);
  if (!res.ok) throw new Error('404 ' + url);
  const blob = await res.blob();
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { premultiplyAlpha: 'premultiply', colorSpaceConversion: 'none' }); }
    catch (e) { /* repli ci-dessous */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode ' + url));
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Charge le manifeste (objet déjà parsé ou URL) et décode toutes les images.
 * @param {object|string} src  manifeste ou URL de manifest.json
 * @param {{ baseUrl?: string, tints?: Record<string, string[]> }} opts
 *   baseUrl : dossier des assets (défaut : dossier du manifeste, sinon 'assets/')
 *   tints   : teintes à pré-générer par sprite, ex. { feutre: ['#8f8d93', '#ffffff'] }
 */
export async function loadAtlas(src, opts = NO_OPTS) {
  if (typeof src === 'string') {
    const res = await fetch(src);
    if (!res.ok) throw new Error('manifest ' + src);
    manifest = await res.json();
    base = opts.baseUrl || src.slice(0, src.lastIndexOf('/') + 1);
  } else { manifest = src; base = opts.baseUrl || 'assets/'; }
  const files = new Set();
  for (const group of ['sprites', 'tiles', 'ui']) {
    const defs = manifest[group] || {};
    for (const id of Object.keys(defs)) if (defs[id].file) files.add(defs[id].file);
  }
  await Promise.all([...files].map(async (f) => { bitmaps.set(f, await loadImage(f)); }));
  if (opts.tints) for (const id of Object.keys(opts.tints)) for (const c of opts.tints[id]) prepareTint(id, c);
  buildShadow();
}

// Ombre elliptique douce pré-rendue une fois (VFX : dessinée par drawImage).
function buildShadow() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32;
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 0.5, 0, 0); // espace 64×64 écrasé en 64×32
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  shadowSprite = c;
}

export function getManifest() { return manifest; }
export function baseUrl() { return base; }
export function spriteDef(id) { return manifest ? manifest.sprites[id] : undefined; }
export function tileDef(id) { return manifest ? manifest.tiles[id] : undefined; }
export function uiDef(id) { return manifest ? manifest.ui[id] : undefined; }

/** Image décodée d'un sprite (ou d'un tileset / élément UI via son id). */
export function image(id) {
  const d = (manifest && (manifest.sprites[id] || manifest.tiles[id] || manifest.ui[id])) || null;
  return d ? bitmaps.get(d.file) : undefined;
}

/** Pré-génère (une fois) la feuille teintée `color` du sprite. Renvoie le canvas. */
export function prepareTint(spriteId, color) {
  let byColor = tints.get(spriteId);
  if (!byColor) { byColor = new Map(); tints.set(spriteId, byColor); }
  let c = byColor.get(color);
  if (c) return c;
  const sp = manifest.sprites[spriteId];
  const img = sp && bitmaps.get(sp.file);
  if (!img) return null;
  c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = TINT_ALPHA; g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  byColor.set(color, c);
  return c;
}

/** Descripteur d'une animation { frames, fps, loop } (objet réutilisé). */
export function animFrames(spriteId, animName) {
  const sp = manifest.sprites[spriteId];
  const a = sp && (sp.anims[animName] || sp.anims.idle);
  animInfo.frames = a ? a.frames : 1; animInfo.fps = a ? a.fps : 1; animInfo.loop = a ? a.loop !== false : true;
  return animInfo;
}

/** Index de frame à l'instant t (secondes depuis le début de l'anim). */
export function frameAt(spriteId, animName, t) {
  const a = animFrames(spriteId, animName);
  if (a.frames <= 1 || !a.fps) return 0;
  const f = Math.floor(t * a.fps);
  return a.loop ? f % a.frames : Math.min(f, a.frames - 1);
}

/** Vrai si l'animation non bouclée est terminée à t. */
export function animDone(spriteId, animName, t) {
  const a = animFrames(spriteId, animName);
  return !a.loop && t * a.fps >= a.frames;
}

export function isDirectional(spriteId) { const sp = manifest.sprites[spriteId]; return !!(sp && sp.directional); }

/**
 * Nom d'anim orienté : 'walk' + direction → 'walk_left' si le sprite est
 * directionnel et possède cette anim, sinon 'walk' (utiliser flipX pour la gauche).
 */
export function dirAnim(spriteId, baseName, dirX, dirY) {
  const sp = manifest.sprites[spriteId];
  if (!sp || !sp.directional) return baseName;
  let suffix;
  if (Math.abs(dirX) >= Math.abs(dirY)) suffix = dirX < 0 ? '_left' : '_right';
  else suffix = dirY < 0 ? '_up' : '_down';
  const name = baseName + suffix;
  return sp.anims[name] ? name : baseName;
}

/**
 * Dessine la frame d'un sprite ancré en (x, y) monde (ctx déjà transformé).
 * frameIndex est enroulé (loop) ou borné (non loop). opts : flipX, alpha, tint, scale.
 */
export function draw(ctx, spriteId, animName, frameIndex, x, y, opts = NO_OPTS) {
  const sp = manifest.sprites[spriteId];
  if (!sp) { warnOnce(spriteId, 'sprite inconnu'); return; }
  const a = sp.anims[animName] || sp.anims.idle;
  if (!a) { warnOnce(spriteId + '/' + animName, 'anim inconnue'); return; }
  const n = a.frames || 1;
  let f = frameIndex | 0;
  if (a.loop === false) f = f < 0 ? 0 : f >= n ? n - 1 : f; else f = ((f % n) + n) % n;
  const fw = sp.frameW, fh = sp.frameH;
  const sx = ((a.col || 0) + f) * fw, sy = a.row * fh;
  const scale = opts.scale || 1;
  const dw = fw * scale, dh = fh * scale;
  const dx = Math.round(x - sp.anchor[0] * dw), dy = Math.round(y - sp.anchor[1] * dh);
  let img = opts.tint ? prepareTint(spriteId, opts.tint) : null;
  if (!img) img = bitmaps.get(sp.file);
  if (!img) return;
  const alpha = opts.alpha === undefined ? 1 : opts.alpha;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (opts.flipX) {
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, fw, fh, -dx - dw, dy, dw, dh);
    ctx.scale(-1, 1);
  } else ctx.drawImage(img, sx, sy, fw, fh, dx, dy, dw, dh);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

/** Ombre au sol d'un sprite (rayon `shadow` du manifeste). Rien si shadow = 0. */
export function drawShadow(ctx, spriteId, x, y, alpha = 1) {
  const sp = manifest.sprites[spriteId];
  const r = sp ? sp.shadow : 0;
  if (!r || !shadowSprite) return;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(shadowSprite, Math.round(x - r), Math.round(y - r * 0.5), r * 2, r);
  if (alpha !== 1) ctx.globalAlpha = 1;
}

/** Tuile d'un tileset en (x, y) monde (coin haut-gauche). */
export function drawTile(ctx, tilesetId, tileIndex, x, y) {
  const t = manifest.tiles[tilesetId];
  if (!t) { warnOnce(tilesetId, 'tileset inconnu'); return; }
  const img = bitmaps.get(t.file);
  if (!img) return;
  const cols = t.columns || Math.floor(img.width / t.tileW);
  const sx = (tileIndex % cols) * t.tileW, sy = Math.floor(tileIndex / cols) * t.tileH;
  ctx.drawImage(img, sx, sy, t.tileW, t.tileH, x, y, t.tileW, t.tileH);
}

/** Cadre 9-slice (slice = [haut, droite, bas, gauche]) étiré sur w×h. */
export function drawNineSlice(ctx, uiId, x, y, w, h) {
  const u = manifest.ui[uiId];
  if (!u) { warnOnce(uiId, 'ui inconnue'); return; }
  const img = bitmaps.get(u.file);
  if (!img) return;
  const s = u.slice || [0, 0, 0, 0];
  const W = img.width, H = img.height;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  // Bords bornés à la moitié de la cible : un cadre de 10 px sur une barre de 7 px ne déborde plus.
  const hy = Math.floor(h / 2), hx = Math.floor(w / 2);
  const t = Math.min(s[0], hy), b = Math.min(s[2], hy), r = Math.min(s[1], hx), l = Math.min(s[3], hx);
  const cw = W - s[3] - s[1], ch = H - s[0] - s[2], iw = w - l - r, ih = h - t - b;
  // coins
  if (t && l) ctx.drawImage(img, 0, 0, l, t, x, y, l, t);
  if (t && r) ctx.drawImage(img, W - r, 0, r, t, x + w - r, y, r, t);
  if (b && l) ctx.drawImage(img, 0, H - b, l, b, x, y + h - b, l, b);
  if (b && r) ctx.drawImage(img, W - r, H - b, r, b, x + w - r, y + h - b, r, b);
  // bords
  if (iw > 0 && t) ctx.drawImage(img, s[3], 0, cw, t, x + l, y, iw, t);
  if (iw > 0 && b) ctx.drawImage(img, s[3], H - b, cw, b, x + l, y + h - b, iw, b);
  if (ih > 0 && l) ctx.drawImage(img, 0, s[0], l, ch, x, y + t, l, ih);
  if (ih > 0 && r) ctx.drawImage(img, W - r, s[0], r, ch, x + w - r, y + t, r, ih);
  // centre
  if (iw > 0 && ih > 0) ctx.drawImage(img, s[3], s[0], cw, ch, x + l, y + t, iw, ih);
}

/** Vrai si le manifeste marque ce sprite `important` (Échos, projectiles de Silence, Fêlures…). */
export function isImportant(spriteId) { const sp = manifest && manifest.sprites[spriteId]; return !!(sp && sp.important); }

/** Feuille « silhouette » pleine d'une couleur (pré-générée une fois, jamais par pixel à la frame). */
function silhouette(spriteId, color) {
  const key = color + '|o';
  let byColor = tints.get(spriteId);
  if (!byColor) { byColor = new Map(); tints.set(spriteId, byColor); }
  let c = byColor.get(key);
  if (c) return c;
  const sp = manifest.sprites[spriteId];
  const img = sp && bitmaps.get(sp.file);
  if (!img) return null;
  c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  byColor.set(key, c);
  return c;
}

const outlineOpts = { flipX: false, alpha: 1, tint: null, scale: 1 };
/**
 * Sprite avec un contour de 1 px (4 passes de la silhouette décalée, puis le sprite) : lisibilité
 * des entités importantes hors du halo. opts comme draw() + { outline: couleur (défaut os clair),
 * outlineAlpha (défaut 0.85), thickness (1 ou 2 px) }.
 */
export function drawOutlined(ctx, spriteId, animName, frameIndex, x, y, opts = NO_OPTS) {
  const sp = manifest.sprites[spriteId];
  if (!sp) { warnOnce(spriteId, 'sprite inconnu'); return; }
  const color = opts.outline || '#f2e6c8';
  const sil = silhouette(spriteId, color);
  if (sil) {
    const a = sp.anims[animName] || sp.anims.idle;
    const n = (a && a.frames) || 1;
    let f = frameIndex | 0;
    if (a && a.loop === false) f = f < 0 ? 0 : f >= n ? n - 1 : f; else f = ((f % n) + n) % n;
    const fw = sp.frameW, fh = sp.frameH, sx = (((a && a.col) || 0) + f) * fw, sy = ((a && a.row) || 0) * fh;
    const scale = opts.scale || 1, dw = fw * scale, dh = fh * scale;
    const dx = Math.round(x - sp.anchor[0] * dw), dy = Math.round(y - sp.anchor[1] * dh);
    const th = opts.thickness || 1;
    ctx.globalAlpha = (opts.outlineAlpha === undefined ? 0.85 : opts.outlineAlpha) * (opts.alpha === undefined ? 1 : opts.alpha);
    if (opts.flipX) ctx.scale(-1, 1);
    const bx = opts.flipX ? -dx - dw : dx;
    ctx.drawImage(sil, sx, sy, fw, fh, bx - th, dy, dw, dh);
    ctx.drawImage(sil, sx, sy, fw, fh, bx + th, dy, dw, dh);
    ctx.drawImage(sil, sx, sy, fw, fh, bx, dy - th, dw, dh);
    ctx.drawImage(sil, sx, sy, fw, fh, bx, dy + th, dw, dh);
    if (opts.flipX) ctx.scale(-1, 1);
    ctx.globalAlpha = 1;
  }
  outlineOpts.flipX = !!opts.flipX; outlineOpts.alpha = opts.alpha === undefined ? 1 : opts.alpha; outlineOpts.tint = opts.tint || null; outlineOpts.scale = opts.scale || 1;
  draw(ctx, spriteId, animName, frameIndex, x, y, outlineOpts);
}

/** Icône nommée d'une planche UI à `map` (icons, cursor) ; (x, y) = coin haut-gauche. */
export function drawIcon(ctx, uiId, name, x, y, scale = 1) {
  const u = manifest.ui[uiId];
  if (!u || !u.map || u.map[name] === undefined) { warnOnce(uiId + '/' + name, 'icône inconnue'); return; }
  const img = bitmaps.get(u.file);
  if (!img) return;
  const i = u.map[name];
  const cols = u.columns || Math.floor(img.width / u.frameW);
  const sx = (i % cols) * u.frameW, sy = Math.floor(i / cols) * u.frameH;
  ctx.drawImage(img, sx, sy, u.frameW, u.frameH, Math.round(x), Math.round(y), u.frameW * scale, u.frameH * scale);
}
