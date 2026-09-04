// render/fx.js — « juice » (ARCHITECTURE.md § 7 et PROMPT § 2) : hit-stop,
// ralenti, flash (respecte reduceFlash), nombres de dégâts en police locale et
// traînée de dash (fantômes du sprite teintés bronze). Les minuteries de
// hit-stop/ralenti sont en temps réel (performance.now) puisque dt logique vaut 0
// pendant un gel ; les nombres et traînées avancent avec dt logique.
//
// initFx({ loop, getOptions }) : loop = createLoop(...) pour setTimeScale ;
// getOptions() → save.options (reduceFlash, shake…).

import * as renderer from './renderer.js';
import * as camera from './camera.js';
import * as atlas from './atlas.js';
import { font } from './fonts.js';

const MAX_NUMBERS = 128, MAX_TRAILS = 48;
const COLOR_NORMAL = '#d8cdb4', COLOR_CRIT = '#e0603a', COLOR_BEAT = '#c9973f', COLOR_SHADOW = '#16130f';
const TRAIL_TINT = '#c9973f';
const NUM_STR = []; // cache des chaînes d'entiers (aucune allocation par frame)

let loop = null, getOptions = null;
let stopUntil = 0, slowUntil = 0, slowScale = 1, baseScale = 1;
let fontNormal = '10px monospace', fontCrit = '13px monospace';

// Nombres flottants (SoA).
const nx = new Float32Array(MAX_NUMBERS), ny = new Float32Array(MAX_NUMBERS), nvy = new Float32Array(MAX_NUMBERS);
const nlife = new Float32Array(MAX_NUMBERS), nkind = new Uint8Array(MAX_NUMBERS);
const ntext = new Array(MAX_NUMBERS).fill('');
let numCount = 0;
// Traînées de dash.
const tx = new Float32Array(MAX_TRAILS), ty = new Float32Array(MAX_TRAILS), tlife = new Float32Array(MAX_TRAILS), tframe = new Uint8Array(MAX_TRAILS), tflip = new Uint8Array(MAX_TRAILS);
const tsprite = new Array(MAX_TRAILS).fill(''), tanim = new Array(MAX_TRAILS).fill('');
let trailCount = 0;
const trailOpts = { alpha: 1, tint: TRAIL_TINT, flipX: false };

export function initFx({ loop: l, getOptions: g } = {}) {
  loop = l || null; getOptions = g || null;
  fontNormal = font('CarillonUi', 10); fontCrit = font('CarillonUi', 14);
  for (let i = 0; i < 1000; i++) NUM_STR[i] = String(i);
}

function numStr(v) {
  const n = Math.round(v);
  if (n >= 0 && n < 1000) return NUM_STR[n];
  return NUM_STR[n] || (NUM_STR[n] = String(n)); // hors cache : allocation rare
}

function opt(key, def) { const o = getOptions ? getOptions() : null; return o && o[key] !== undefined ? o[key] : def; }

/** Gèle la logique ms millisecondes (timeScale 0), le rendu continue. */
export function hitStop(ms) {
  if (!loop) return;
  const until = performance.now() + ms;
  if (until <= stopUntil) return;
  if (stopUntil === 0) baseScale = loop.getTimeScale();
  stopUntil = until;
  loop.setTimeScale(0);
}

/** Ralenti : scale (ex. 0.4) pendant sec secondes réelles. */
export function slowMo(scale, sec) {
  if (!loop) return;
  slowScale = scale; slowUntil = performance.now() + sec * 1000;
  if (stopUntil === 0) { baseScale = 1; loop.setTimeScale(scale); }
}

/** Flash plein écran une ou plusieurs frames ; atténué si reduceFlash. */
export function flash(color = '#ffffff', frames = 1) {
  const reduce = opt('reduceFlash', false);
  renderer.setFlash(color, reduce ? 1 : frames, reduce ? 0.15 : 0.85);
}

/** Nombre de dégâts flottant en (x, y) monde. kind : crit (braise), onBeat (bronze). */
export function damageNumber(x, y, value, { crit = false, onBeat = false } = {}) {
  if (numCount >= MAX_NUMBERS) return;
  const i = numCount++;
  nx[i] = x + (Math.random() - 0.5) * 8; ny[i] = y; nvy[i] = -38;
  nlife[i] = crit ? 0.9 : 0.6; nkind[i] = crit ? 1 : onBeat ? 2 : 0;
  ntext[i] = numStr(value);
}

/** Fantôme d'une frame de sprite (traînée de dash), s'efface en ~0,3 s. */
export function dashTrail(spriteId, animName, frame, x, y, flipX = false) {
  if (trailCount >= MAX_TRAILS) return;
  const i = trailCount++;
  tx[i] = x; ty[i] = y; tlife[i] = 0.3; tframe[i] = frame; tflip[i] = flipX ? 1 : 0;
  tsprite[i] = spriteId; tanim[i] = animName;
}

/** Avance minuteries (temps réel) et animations (dt logique). */
export function updateFx(dt) {
  if (loop) {
    const now = performance.now();
    if (stopUntil > 0 && now >= stopUntil) { stopUntil = 0; loop.setTimeScale(slowUntil > now ? slowScale : baseScale); }
    if (slowUntil > 0 && now >= slowUntil) { slowUntil = 0; if (stopUntil === 0) loop.setTimeScale(baseScale); }
  }
  for (let i = numCount - 1; i >= 0; i--) {
    nlife[i] -= dt;
    if (nlife[i] <= 0) { const l = --numCount; if (i !== l) { nx[i] = nx[l]; ny[i] = ny[l]; nvy[i] = nvy[l]; nlife[i] = nlife[l]; nkind[i] = nkind[l]; ntext[i] = ntext[l]; } continue; }
    nvy[i] += 120 * dt; ny[i] += nvy[i] * dt;
  }
  for (let i = trailCount - 1; i >= 0; i--) {
    tlife[i] -= dt;
    if (tlife[i] <= 0) { const l = --trailCount; if (i !== l) { tx[i] = tx[l]; ty[i] = ty[l]; tlife[i] = tlife[l]; tframe[i] = tframe[l]; tflip[i] = tflip[l]; tsprite[i] = tsprite[l]; tanim[i] = tanim[l]; } }
  }
}

/** Dessine traînées puis nombres (ctx caméra). */
export function renderFx(ctx, alpha) {
  for (let i = 0; i < trailCount; i++) {
    if (!camera.isVisible(tx[i], ty[i], 48)) continue;
    trailOpts.alpha = (tlife[i] / 0.3) * 0.6; trailOpts.flipX = tflip[i] === 1;
    atlas.draw(ctx, tsprite[i], tanim[i], tframe[i], tx[i], ty[i], trailOpts);
  }
  if (numCount === 0) return;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  let curKind = -1;
  for (let i = 0; i < numCount; i++) {
    if (!camera.isVisible(nx[i], ny[i], 16)) continue;
    const k = nkind[i];
    if (k !== curKind) { curKind = k; ctx.font = k === 1 ? fontCrit : fontNormal; }
    const x = Math.round(nx[i]), y = Math.round(ny[i]);
    ctx.globalAlpha = nlife[i] < 0.2 ? nlife[i] * 5 : 1;
    ctx.fillStyle = COLOR_SHADOW; ctx.fillText(ntext[i], x + 1, y + 1);
    ctx.fillStyle = k === 1 ? COLOR_CRIT : k === 2 ? COLOR_BEAT : COLOR_NORMAL;
    ctx.fillText(ntext[i], x, y);
  }
  ctx.globalAlpha = 1;
}

export function isFrozen() { return stopUntil > 0; }
export function counts() { return { numbers: numCount, trails: trailCount }; }
