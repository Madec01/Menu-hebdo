// render/renderer.js — possède les canvases (ARCHITECTURE.md § 7) et compose
// la frame. Résolution logique 480×270 ; tout le jeu est rendu à cette taille
// dans des offscreens puis agrandi d'un facteur ENTIER (nearest) vers le canvas
// visible. Calques : principal (jeu), lumière (multiply), écran (glows en
// 'screen'), UI (résolution d'affichage, transform = échelle, cleared à chaque
// beginFrame : le HUD se dessine ENTRE beginFrame et endFrame).
//
// Un calque « overlay » monde (caméra appliquée, composé APRÈS la lumière) sert
// aux textes et marqueurs qui doivent rester lisibles la nuit (nombres de dégâts).
//
// Composition dans endFrame : lumière multiply → glows screen → overlay →
// brume ×2 → cendres → flash → vignette → grain → blit → UI.

import * as camera from './camera.js';
import { initPost, drawFog, drawAshes, drawVignette, drawGrain } from './post.js';

let display = null, dctx = null;       // canvas visible
let main = null, mctx = null;          // calque jeu (logique)
let light = null, lctx = null;         // calque lumière
let glow = null, gctx = null;          // calque écran (screen)
let over = null, octx = null;          // calque overlay monde (après lumière)
let ui = null, uctx = null;            // calque HUD (affichage)
let W = 480, H = 270, scale = 1, scaleOption = 0;
let pixelRatio = 1;                    // > 1 en mode tactile : échelle entière en pixels PHYSIQUES (setPixelRatio)
let ambient = '#16130f';
let vignette = 0.35, grain = 0.25, fog = 1, ashes = 1, desaturate = 0;
let fractionalOk = false;              // tactile : échelle non entière autorisée si le letterbox dépasse 15 %
const LETTERBOX_MAX = 0.15;
let flashColor = '#ffffff', flashFrames = 0, flashAlpha = 0.85;
let lastNow = 0, frameDt = 0, elapsed = 0;
// scale = pixels physiques du canvas par pixel logique ; cssScale = pixels CSS par pixel logique.
const size = { w: 480, h: 270, scale: 1, cssScale: 1 };
const frameHooks = [];                 // fn(dt) appelés au début d'endFrame (lighting)

function makeCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { alpha: true });
  g.imageSmoothingEnabled = false;
  return [c, g];
}

/** Crée les calques ; `canvas` est l'élément visible (index.html). */
export function initRenderer({ canvas, width = 480, height = 270, seed = 7 }) {
  W = width; H = height; display = canvas;
  dctx = canvas.getContext('2d', { alpha: false });
  [main, mctx] = makeCanvas(W, H);
  [light, lctx] = makeCanvas(W, H);
  [glow, gctx] = makeCanvas(W, H);
  [over, octx] = makeCanvas(W, H);
  [ui, uctx] = makeCanvas(W, H);
  canvas.style.imageRendering = 'pixelated';
  initPost(mctx, W, H, seed);
  camera.initCamera({ w: W, h: H });
  resize(scaleOption);
  // Redimensionnement, rotation du téléphone, barre d'adresse mobile : l'échelle est recalculée.
  const onResize = () => resize(scaleOption);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  lastNow = performance.now();
}

/** Calque principal (translaté par la caméra entre beginFrame et endFrame). */
export function getCtx() { return mctx; }
/** HUD en pixels logiques (transform = échelle), jamais translaté. */
export function getUiCtx() { return uctx; }
/** Calque lumière (utilisé par lighting.js). */
export function getLightCtx() { return lctx; }
/** Calque écran/glows (utilisé par lighting.js et particles.js). */
export function getGlowCtx() { return gctx; }
/** Calque monde composé après la lumière (nombres de dégâts, marqueurs). */
export function getOverlayCtx() { return octx; }
export function displayCanvas() { return display; }

/** Espace disponible (px CSS) dans le conteneur du canvas, marges de sécurité (safe-area) déduites. */
function available() {
  const parent = display.parentElement;
  let w = (parent && parent.clientWidth) || window.innerWidth, h = (parent && parent.clientHeight) || window.innerHeight;
  if (parent) {
    const cs = getComputedStyle(parent);
    w -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    h -= (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

/**
 * 0 = automatique (plus grande échelle entière qui tient dans la fenêtre, ×1 compris sur un petit
 * écran), sinon 2/3/4 — bornée à ce qui tient. Le canvas est centré par la CSS (#stage, fond suie).
 * En mode tactile (pixelRatio > 1), l'échelle est entière en pixels physiques : le canvas est plus
 * grand sur un écran dense tout en gardant des pixels nets.
 */
export function resize(opt) {
  scaleOption = opt | 0;
  const avail = available();
  const exact = Math.min(avail.w * pixelRatio / W, avail.h * pixelRatio / H);
  let fit = Math.max(1, Math.floor(exact));
  // Tactile uniquement (accepté par le lead) : si l'échelle entière laisse plus de 15 % de bandes
  // noires, on prend une échelle au quart près (×2,5), avec imageSmoothingEnabled = false partout.
  if (fractionalOk && scaleOption === 0 && exact >= 1 && (exact - fit) / exact > LETTERBOX_MAX) fit = Math.floor(exact * 4) / 4;
  scale = scaleOption > 0 ? Math.max(1, Math.min(fit, Math.round(scaleOption * pixelRatio))) : fit;
  const cssScale = scale / pixelRatio;
  display.width = Math.round(W * scale); display.height = Math.round(H * scale);
  display.style.width = W * cssScale + 'px'; display.style.height = H * cssScale + 'px';
  ui.width = display.width; ui.height = display.height;
  dctx.imageSmoothingEnabled = false; uctx.imageSmoothingEnabled = false;
  size.w = W; size.h = H; size.scale = scale; size.cssScale = cssScale;
}

/** Densité de pixels prise en compte par resize() (1 = échelle en px CSS, comme sur bureau). */
export function setPixelRatio(r, allowFractional = false) {
  const v = Math.max(1, +r || 1);
  const f = !!allowFractional;
  if (v === pixelRatio && f === fractionalOk) return;
  pixelRatio = v; fractionalOk = f;
  if (display) resize(scaleOption);
}

/** Désaturation globale 0..1 de la scène (coup reçu) ; à poser chaque frame par l'appelant. */
export function setDesaturate(v) { desaturate = Math.max(0, Math.min(1, +v || 0)); }

export function logicalSize() { return size; }

/** Temps réel écoulé depuis initRenderer (s), et durée de la dernière frame. */
export function time() { return elapsed; }
export function frameDelta() { return frameDt; }

export function setAmbient(color) { ambient = color; }
export function setVignette(v) { vignette = Math.max(0, Math.min(1, +v || 0)); }
export function setGrain(v) { grain = Math.max(0, Math.min(1, +v || 0)); }
export function setFog(v) { fog = Math.max(0, Math.min(1, +v || 0)); }
export function setAshes(v) { ashes = Math.max(0, Math.min(1, +v || 0)); }
export function getVignette() { return vignette; }

/** Enregistre fn(dtSec) appelé à chaque endFrame, avant la composition (lighting). */
export function addFrameHook(fn) { if (!frameHooks.includes(fn)) frameHooks.push(fn); }

/** Flash plein écran (utilisé par fx.flash). */
export function setFlash(color, frames, alpha = 0.85) { flashColor = color; flashFrames = frames | 0; flashAlpha = alpha; }

/** Prépare les calques et applique la caméra. */
export function beginFrame(alpha) {
  const now = performance.now();
  frameDt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now; elapsed += frameDt;
  camera.advance(frameDt);
  // Jeu : fond noir, caméra.
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.globalCompositeOperation = 'source-over';
  mctx.globalAlpha = 1;
  mctx.fillStyle = '#000000';
  mctx.fillRect(0, 0, W, H);
  camera.applyTransform(mctx);
  // Lumière : ambiance puis addition des sources en coordonnées monde.
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.globalAlpha = 1;
  lctx.fillStyle = ambient;
  lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = 'lighter';
  camera.applyTransform(lctx);
  // Glows : transparent, additif.
  gctx.setTransform(1, 0, 0, 1, 0, 0);
  gctx.globalCompositeOperation = 'source-over';
  gctx.globalAlpha = 1;
  gctx.clearRect(0, 0, W, H);
  gctx.globalCompositeOperation = 'lighter';
  camera.applyTransform(gctx);
  // Overlay monde : transparent, caméra.
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalAlpha = 1;
  octx.clearRect(0, 0, W, H);
  camera.applyTransform(octx);
  // HUD : pixels logiques.
  uctx.setTransform(scale, 0, 0, scale, 0, 0);
  uctx.clearRect(0, 0, W, H);
  uctx.globalAlpha = 1;
}

/** Compose les calques et affiche. */
export function endFrame() {
  for (let i = 0; i < frameHooks.length; i++) frameHooks[i](frameDt);
  const cam = camera.get();
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.globalAlpha = 1;
  mctx.globalCompositeOperation = 'multiply';
  mctx.drawImage(light, 0, 0);
  mctx.globalCompositeOperation = 'screen';
  mctx.drawImage(glow, 0, 0);
  mctx.globalCompositeOperation = 'source-over';
  mctx.drawImage(over, 0, 0);
  drawFog(mctx, cam.x, cam.y, frameDt, fog);
  drawAshes(mctx, cam.x, cam.y, frameDt, ashes);
  if (desaturate > 0.01) {   // un seul fillRect en mode de fusion 'saturation' : la scène perd ses couleurs
    mctx.globalCompositeOperation = 'saturation';
    mctx.globalAlpha = desaturate; mctx.fillStyle = '#808080';
    mctx.fillRect(0, 0, W, H); mctx.globalAlpha = 1;
    mctx.globalCompositeOperation = 'source-over';
  }
  if (flashFrames > 0) {
    flashFrames--;
    mctx.globalAlpha = flashAlpha; mctx.fillStyle = flashColor;
    mctx.fillRect(0, 0, W, H); mctx.globalAlpha = 1;
  }
  drawVignette(mctx, vignette);
  mctx.globalCompositeOperation = 'overlay';
  drawGrain(mctx, grain);
  mctx.globalCompositeOperation = 'source-over';
  // Blit entier vers l'écran, puis HUD par-dessus.
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.imageSmoothingEnabled = false;
  dctx.drawImage(main, 0, 0, W, H, 0, 0, display.width, display.height);
  dctx.drawImage(ui, 0, 0);
}
