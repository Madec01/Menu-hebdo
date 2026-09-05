// render/camera.js — caméra 2D (ARCHITECTURE.md § 7) : suivi lissé, zoom
// tweené (boss), secousse pondérée par l'option screenshake, conversions et
// culling. Coordonnées monde en pixels natifs ; l'écran est la résolution
// logique (480×270). Les translations sont arrondies au pixel pour garder le
// pixel art net.
//
// Le renderer appelle advance(dtSec) à chaque frame (zoom et secousse sont des
// effets visuels, indépendants du pas logique) puis applyTransform(ctx).

const state = { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0 };
let w = 480, h = 270;
let smoothing = 8;        // vitesse du lissage exponentiel (1/s)
let shakeScale = 1;       // option screenshake (0..1)
let trauma = 0;           // intensité restante de la secousse
let traumaDecay = 0;      // perte d'intensité par seconde
let shakeSeed = 0;
let zoomFrom = 1, zoomTo = 1, zoomT = 1, zoomDur = 0; // tween de zoom
let focusX = 0, focusY = 0, focusW = 0, focusTarget = 0; // cible secondaire (boss) : poids 0..1 lissé
let kickX = 0, kickY = 0, kickAmp = 0, kickT = 0, kickDur = 0.25; // secousse dirigée (coup reçu)
const view = { x: 0, y: 0, w: 480, h: 270 };          // rectangle visible (monde), réutilisé
const tmp = { x: 0, y: 0 };

export function initCamera({ w: width = 480, h: height = 270, smoothing: s = 8 } = {}) {
  w = width; h = height; smoothing = s;
  state.x = 0; state.y = 0; state.zoom = 1; state.shakeX = 0; state.shakeY = 0;
  zoomFrom = zoomTo = 1; zoomT = 1; zoomDur = 0; trauma = 0;
  focusW = 0; focusTarget = 0; kickT = 0; kickAmp = 0;
  updateView();
}

/**
 * Cible secondaire (cadrage d'intro de boss) : la caméra vise le point situé entre la cible de
 * follow() et (x, y), pondéré par weight (0.5 = milieu). Le poids est lissé ; clearFocus() rend
 * la caméra au joueur.
 */
export function setFocus(x, y, weight = 0.5) { focusX = x; focusY = y; focusTarget = Math.max(0, Math.min(1, weight)); }
export function clearFocus() { focusTarget = 0; }
export function focusWeight() { return focusW; }

/** Secousse dirigée : décalage de `px` pixels vers (dirX, dirY) qui revient en durationSec. */
export function kick(dirX, dirY, px, durationSec = 0.25) {
  const l = Math.hypot(dirX, dirY);
  if (!(l > 0) || !(px > 0)) return;
  kickX = dirX / l; kickY = dirY / l; kickAmp = px * shakeScale; kickDur = Math.max(0.05, durationSec); kickT = kickDur;
}

/** Place la caméra sans lissage (début de run, téléport). */
export function snap(x, y) { state.x = x; state.y = y; updateView(); }

/** Suivi lissé (exponentiel, indépendant du framerate). À appeler au pas logique. */
export function follow(x, y, dt) {
  const k = 1 - Math.exp(-smoothing * dt);
  focusW += (focusTarget - focusW) * (1 - Math.exp(-3 * dt));
  const tx = focusW > 0.001 ? x + (focusX - x) * focusW : x;
  const ty = focusW > 0.001 ? y + (focusY - y) * focusW : y;
  state.x += (tx - state.x) * k;
  state.y += (ty - state.y) * k;
  updateView();
}

/** Zoom vers z en durationSec (0 = immédiat). */
export function setZoom(z, durationSec = 0) {
  zoomFrom = state.zoom; zoomTo = Math.max(0.25, z);
  zoomDur = Math.max(0, durationSec); zoomT = zoomDur > 0 ? 0 : 1;
  if (zoomT >= 1) { state.zoom = zoomTo; updateView(); }
}

/** Secousse : intensity en pixels (avant option), durationSec. Cumulable. */
export function shake(intensity, durationSec = 0.2) {
  const v = intensity * shakeScale;
  if (v <= 0) return;
  if (v > trauma) { trauma = v; traumaDecay = v / Math.max(0.016, durationSec); }
}

/** Facteur global de secousse (option « screenshake », 0..1). */
export function setShakeScale(v) { shakeScale = Math.max(0, Math.min(2, +v || 0)); }

/** Fait avancer zoom et secousse (temps réel, appelé par le renderer). */
export function advance(dt) {
  if (zoomT < 1) {
    zoomT = Math.min(1, zoomT + dt / zoomDur);
    const e = zoomT < 0.5 ? 2 * zoomT * zoomT : 1 - Math.pow(-2 * zoomT + 2, 2) / 2; // easeInOutQuad
    state.zoom = zoomFrom + (zoomTo - zoomFrom) * e;
  }
  if (trauma > 0) {
    trauma = Math.max(0, trauma - traumaDecay * dt);
    // Bruit déterministe pas cher, sans allocation : deux sinus déphasés.
    shakeSeed += dt * 61;
    state.shakeX = Math.round(Math.sin(shakeSeed * 1.7) * Math.cos(shakeSeed * 0.9) * trauma);
    state.shakeY = Math.round(Math.sin(shakeSeed * 1.3 + 2.1) * trauma);
  } else { state.shakeX = 0; state.shakeY = 0; }
  if (kickT > 0) {
    kickT = Math.max(0, kickT - dt);
    const k = kickT / kickDur;                       // recul immédiat puis retour amorti
    const off = kickAmp * k * k;
    state.shakeX += Math.round(kickX * off);
    state.shakeY += Math.round(kickY * off);
  }
  updateView();
}

function updateView() {
  const z = state.zoom;
  view.w = w / z; view.h = h / z;
  view.x = state.x - view.w / 2; view.y = state.y - view.h / 2;
}

/** État courant (objet réutilisé : ne pas le modifier). */
export function get() { return state; }

/** Rectangle monde visible {x, y, w, h} (objet réutilisé). */
export function viewRect() { return view; }

/** Taille de l'écran logique. */
export function screenSize() { tmp.x = w; tmp.y = h; return tmp; }

/** Monde → écran logique. `out` optionnel pour éviter l'allocation. */
export function worldToScreen(x, y, out = tmp) {
  out.x = (x - state.x) * state.zoom + w / 2 + state.shakeX;
  out.y = (y - state.y) * state.zoom + h / 2 + state.shakeY;
  return out;
}

/** Écran logique → monde. */
export function screenToWorld(x, y, out = tmp) {
  out.x = (x - w / 2 - state.shakeX) / state.zoom + state.x;
  out.y = (y - h / 2 - state.shakeY) / state.zoom + state.y;
  return out;
}

/** Culling : le disque (x, y, r) touche-t-il la vue (marge de 8 px) ? */
export function isVisible(x, y, r = 0) {
  return x + r >= view.x - 8 && x - r <= view.x + view.w + 8 &&
         y + r >= view.y - 8 && y - r <= view.y + view.h + 8;
}

/** Applique la transformation caméra à un contexte (translation entière). */
export function applyTransform(ctx) {
  const z = state.zoom;
  const tx = Math.round(w / 2 - state.x * z + state.shakeX);
  const ty = Math.round(h / 2 - state.y * z + state.shakeY);
  ctx.setTransform(z, 0, 0, z, tx, ty);
}
