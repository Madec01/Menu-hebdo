// ui/touch.js — jouabilité mobile : détection du tactile, disposition des commandes
// virtuelles (joystick flottant sur une moitié de l'écran, boutons Volée / Parade sur
// l'autre, pause en haut), rendu sur le calque HUD dans la DA (9-slice bronze/parchemin,
// semi-transparents) avec retour visuel : anneau qui se referme sur le bouton Volée à
// chaque temps, halo bronze sur le temps, « Parfait / Bon / Raté » sur rhythm:input,
// vibration légère sur Parfait. Plein écran (conteneur #stage + verrouillage paysage),
// aide « Ajouter à l'écran d'accueil » sur iOS, voile « Tourne ton téléphone » en portrait.
// Le suivi des doigts est dans core/input.js (setTouchLayout / touchState) : un appui
// tactile suit exactement le chemin du clavier (pressedAt = temps audio de l'événement).

import { bus } from '../core/events.js';
import { getSave, commit } from '../core/save.js';
import * as input from '../core/input.js';
import * as renderer from '../render/renderer.js';
import * as conductor from '../audio/conductor.js';
import { drawNineSlice } from '../render/atlas.js';
import { t } from './i18n.js';
import * as states from './states.js';
import { toast } from './toasts.js';
import { text, setTextBump, C } from './widgets.js';

const W = 480, H = 270;
/** Valeurs par défaut des options tactiles (absentes des anciennes sauvegardes). */
export const TOUCH_DEFAULTS = Object.freeze({ touch: 'auto', touchSize: 'normal', touchHand: 'right', vibrate: true });
const SIZE = { small: 18, normal: 22, large: 27 };   // rayon du bouton Volée en px logiques
const MIN_CSS_PX = 48;                               // taille physique minimale d'un bouton (px CSS)
const STICK_R = 40, STICK_DEADZONE = 0.12, TOP_BAND = 28;
const JUDGE_KEY = { parfait: 'ui.hud.perfect', bon: 'ui.hud.good', rate: 'ui.hud.miss' };
const JUDGE_COLOR = { parfait: C.bronze, bon: C.os, rate: C.gris };

let deps = { isRunActive: () => false };
const st = { active: false, beat: 0, judge: '', judgeT: 0, portraitHidden: false, layout: null, layoutKey: '' };

// ---- Détection et options ----------------------------------------------------------------------

/** Écran tactile « principal » (téléphone, tablette) : pointeur grossier ou API tactile. */
export function isTouchDevice() {
  try { if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true; } catch (e) { /* rien */ }
  return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
}

/** Option tactile avec repli sur la valeur par défaut. */
export function touchOption(key) {
  const v = getSave().options[key];
  return v === undefined || v === null ? TOUCH_DEFAULTS[key] : v;
}

function wanted() {
  const o = touchOption('touch');
  if (o === 'on') return true;
  if (o === 'off') return false;
  // auto : pointeur principal grossier (téléphone/tablette) ou un doigt déjà vu (PC hybride).
  let coarse = false;
  try { coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { coarse = false; }
  return coarse || input.touchState().seen;
}

/** Mode tactile actif (commandes virtuelles, HUD décalé, curseur souris caché). */
export function isActive() { return st.active; }
export function hideCursor() { return st.active && input.pointer().touch; }
export function isPortrait() { return window.innerHeight > window.innerWidth; }

function refresh() {
  const on = wanted();
  if (on !== st.active) { st.active = on; st.layoutKey = ''; }
  renderer.setPixelRatio(on ? (window.devicePixelRatio || 1) : 1);
  // Petite échelle CSS (téléphone peu dense) : les polices de l'interface prennent +1 px.
  const css = renderer.logicalSize().cssScale || 1;
  setTextBump(on && css <= 1 ? 1 : 0);
}

// ---- Disposition -------------------------------------------------------------------------------

function buildLayout() {
  const css = renderer.logicalSize().cssScale || 1;
  const minR = Math.ceil(MIN_CSS_PX / css / 2);
  const rDash = Math.max(SIZE[touchOption('touchSize')] || SIZE.normal, minR);
  const rParry = Math.max(Math.round(rDash * 0.78), minR);
  const rPause = 11, padPause = Math.max(8, minR - rPause);
  const right = touchOption('touchHand') !== 'left';
  const dashX = right ? W - rDash - 12 : rDash + 12, dashY = H - rDash - 12;
  const parryX = right ? dashX - rDash - rParry - 8 : dashX + rDash + rParry + 8, parryY = dashY - 14;
  return {
    radius: STICK_R, deadzone: STICK_DEADZONE, right,
    stickZone: right ? { x: 0, y: TOP_BAND, w: W / 2, h: H - TOP_BAND } : { x: W / 2, y: TOP_BAND, w: W / 2, h: H - TOP_BAND },
    buttons: [
      { action: 'dash', x: dashX, y: dashY, r: rDash, pad: 6 },
      { action: 'parry', x: parryX, y: parryY, r: rParry, pad: 6 },
      { action: 'pause', x: W - 18, y: 17, r: rPause, pad: padPause },
    ],
  };
}

function layout() {
  const key = touchOption('touchSize') + '|' + touchOption('touchHand') + '|' + (renderer.logicalSize().cssScale || 1);
  if (key !== st.layoutKey) { st.layoutKey = key; st.layout = buildLayout(); }
  return st.layout;
}

/** Disposition courante (tests) : { stickZone, buttons:[{action, x, y, r}] } ou null hors jeu. */
export function currentLayout() { return inGame() && !veilShown() ? layout() : null; }
/** Voile « tourne ton téléphone » affiché (portrait, non levé par un tap). */
export function veilShown() { return st.active && isPortrait() && !st.portraitHidden; }

/** Vrai quand les commandes de jeu sont affichées (run au sommet, non figée). */
function inGame() { const top = states.topName(); return st.active && (top === 'run' || top === 'tutorial') && !states.isFrozen() && deps.isRunActive(); }

// ---- Cycle -------------------------------------------------------------------------------------

/** deps.isRunActive() → la run tourne (deps.game.isGameActive). */
export function initTouch(d) {
  deps = Object.assign(deps, d || {});
  refresh();
  bus.on('beat', () => { st.beat = 1; });
  bus.on('rhythm:input', (e) => {
    st.judge = e.grade; st.judgeT = 0.55;
    if (e.grade === 'parfait' && st.active && touchOption('vibrate') && navigator.vibrate) { try { navigator.vibrate(12); } catch (err) { /* refusé */ } }
  });
  bus.on('options:change', (e) => { if (e.key in TOUCH_DEFAULTS || e.key === 'scale') refresh(); });
  window.addEventListener('resize', refresh);
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, refresh);
}

/** À appeler après tickInput() et avant states.update() : disposition, voile portrait, minuteries. */
export function update(realDt) {
  if (!st.active && input.touchState().seen) refresh();
  if (st.beat > 0) st.beat -= realDt * 7;
  if (st.judgeT > 0) st.judgeT -= realDt;
  if (!st.active) { input.setTouchLayout(null); return; }
  if (isPortrait()) {
    if (!st.portraitHidden && input.pointer().clicks > 0) st.portraitHidden = true;
    if (veilShown()) {
      input.consumeClicks(); input.setTouchLayout(null);
      if (inGame()) states.push('pause');   // la nuit n'avance pas pendant que le téléphone est tourné
      return;
    }
  } else st.portraitHidden = false;
  input.setTouchLayout(inGame() ? layout() : null);
}

// ---- Rendu -------------------------------------------------------------------------------------

function ring(ui, x, y, r, color, width, alpha) {
  ui.globalAlpha = alpha; ui.strokeStyle = color; ui.lineWidth = width;
  ui.beginPath(); ui.arc(x, y, r, 0, Math.PI * 2); ui.stroke();
  ui.globalAlpha = 1;
}

function renderStick(ui, L) {
  const s = input.touchState().stick;
  if (!s.active) {
    // Repère discret : là où le pouce peut se poser (n'importe où dans la moitié, en fait).
    const gx = L.right ? W / 4 : W * 3 / 4, gy = H - 64;
    ring(ui, gx, gy, STICK_R * 0.55, C.os, 1, 0.16);
    ui.globalAlpha = 0.22; ui.fillStyle = C.os; ui.beginPath(); ui.arc(gx, gy, 4, 0, Math.PI * 2); ui.fill(); ui.globalAlpha = 1;
    return;
  }
  ui.globalAlpha = 0.28; ui.fillStyle = C.suie; ui.beginPath(); ui.arc(s.ox, s.oy, STICK_R, 0, Math.PI * 2); ui.fill(); ui.globalAlpha = 1;
  ring(ui, s.ox, s.oy, STICK_R, C.bronze, 2, 0.6);
  ring(ui, s.ox, s.oy, STICK_R * STICK_DEADZONE, C.os, 1, 0.3);
  const dx = s.x - s.ox, dy = s.y - s.oy, len = Math.hypot(dx, dy) || 1, k = Math.min(len, STICK_R) / len;
  const kx = s.ox + dx * k, ky = s.oy + dy * k;
  ui.globalAlpha = 0.85; ui.fillStyle = C.os; ui.beginPath(); ui.arc(kx, ky, 13, 0, Math.PI * 2); ui.fill();
  ui.fillStyle = C.bronze; ui.beginPath(); ui.arc(kx, ky, 10, 0, Math.PI * 2); ui.fill(); ui.globalAlpha = 1;
}

function renderButton(ui, b, pressed) {
  const r = b.r;
  if (b.action === 'dash') {
    // Anneau qui se referme sur le bouton à l'approche du temps, halo bronze sur le temps.
    const phase = conductor.isRunning() ? conductor.phase() : 0;
    const rr = r + 3 + 16 * (1 - phase);
    ring(ui, b.x, b.y, rr, C.bronze, 2, 0.15 + 0.6 * phase);
    if (st.beat > 0) {
      const g = ui.createRadialGradient(b.x, b.y, r * 0.6, b.x, b.y, r + 12);
      g.addColorStop(0, 'rgba(201,151,63,' + (0.55 * st.beat).toFixed(3) + ')'); g.addColorStop(1, 'rgba(201,151,63,0)');
      ui.fillStyle = g; ui.beginPath(); ui.arc(b.x, b.y, r + 12, 0, Math.PI * 2); ui.fill();
    }
  }
  ui.globalAlpha = pressed ? 0.95 : 0.78;
  drawNineSlice(ui, pressed ? 'button_pressed' : 'button', b.x - r, b.y - r, r * 2, r * 2);
  ui.globalAlpha = 1;
  if (b.action === 'pause') {
    ui.fillStyle = C.os; ui.fillRect(b.x - 4, b.y - 5, 3, 10); ui.fillRect(b.x + 1, b.y - 5, 3, 10);
    return;
  }
  const label = t(b.action === 'dash' ? 'ui.touch.dash' : 'ui.touch.parry');
  text(ui, label, b.x, b.y + (pressed ? 1 : 0), { kind: 'display', size: b.action === 'dash' ? 13 : 10, align: 'center', baseline: 'middle', color: pressed ? C.clair : C.os, shadow: true, maxWidth: r * 2 - 4 });
  if (b.action === 'dash' && st.judgeT > 0) {
    const a = Math.min(1, st.judgeT * 3);
    text(ui, t(JUDGE_KEY[st.judge] || JUDGE_KEY.rate), b.x, b.y - r - 18 - (0.55 - st.judgeT) * 10, { kind: 'display', size: 12, align: 'center', color: JUDGE_COLOR[st.judge] || C.gris, shadow: true, alpha: a });
  }
}

function renderPortraitVeil(ui) {
  ui.globalAlpha = 0.94; ui.fillStyle = C.suie; ui.fillRect(0, 0, W, H); ui.globalAlpha = 1;
  // Téléphone stylisé qui tourne (UI en code : autorisé).
  const cx = W / 2, cy = H / 2 - 30, a = Math.sin(renderer.time() * 2) * 0.35 + 0.35;
  ui.save(); ui.translate(cx, cy); ui.rotate(-a * Math.PI / 2);
  ui.strokeStyle = C.bronze; ui.lineWidth = 2; ui.strokeRect(-11, -20, 22, 40);
  ui.fillStyle = C.bronze; ui.fillRect(-3, 15, 6, 2);
  ui.restore();
  text(ui, t('ui.touch.rotate'), cx, cy + 34, { kind: 'display', size: 20, align: 'center', color: C.bronze, shadow: true });
  text(ui, t('ui.touch.rotate_sub'), cx, cy + 62, { size: 9, align: 'center', color: C.os, maxWidth: W - 40 });
}

/** Dessine les commandes tactiles (après les écrans, avant les toasts). */
export function render(ui) {
  if (!st.active) return;
  if (veilShown()) { renderPortraitVeil(ui); return; }
  if (!inGame()) return;
  const L = layout(), pressedBy = input.touchState().buttons;
  renderStick(ui, L);
  for (let i = 0; i < L.buttons.length; i++) renderButton(ui, L.buttons[i], (pressedBy[L.buttons[i].action] || 0) > 0);
}

// ---- Plein écran ---------------------------------------------------------------------------------

function stage() { return document.getElementById('stage') || document.documentElement; }
function standalone() {
  try { if (navigator.standalone === true) return true; return !!(window.matchMedia && (window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches)); }
  catch (e) { return false; }
}
export function fullscreenSupported() { const el = stage(); return !!(el.requestFullscreen || el.webkitRequestFullscreen); }
export function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement) || standalone(); }

/** Aide iOS (pas d'API plein écran) : « Ajouter à l'écran d'accueil ». */
export function homeScreenHint() {
  if (standalone()) return;
  toast({ title: t('ui.touch.a2hs_title'), body: t('ui.touch.a2hs'), icon: 'ui_lanterne' });
}

/** Une seule fois, sans bloquer : sur un écran tactile sans plein écran (iPhone), à l'arrivée au titre. */
export function homeScreenHintOnce() {
  const o = getSave().options;
  if (o.a2hsHintShown || !st.active || fullscreenSupported() || standalone()) return;
  o.a2hsHintShown = true; commit();
  homeScreenHint();
}

/** Dans le geste utilisateur : plein écran sur le conteneur, puis verrouillage paysage (échec ignoré). */
export function setFullscreen(on) {
  const el = stage();
  try {
    if (on && !document.fullscreenElement && !document.webkitFullscreenElement) {
      if (!fullscreenSupported()) { homeScreenHint(); return false; }
      const req = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
      Promise.resolve(req).then(() => {
        try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* API absente */ }
      }).catch(() => {});
    } else if (!on && (document.fullscreenElement || document.webkitFullscreenElement)) {
      const p = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen();
      Promise.resolve(p).catch(() => {});
    }
  } catch (e) { /* navigateur sans API plein écran */ }
  return true;
}

export function toggleFullscreen() { setFullscreen(!(document.fullscreenElement || document.webkitFullscreenElement)); }

/**
 * Bouton plein écran (coins de cadre) dessiné à (x, y) ; renvoie sa zone de toucher, élargie en
 * mode tactile pour atteindre 48 px CSS (le dessin, lui, reste discret). `focused` : cadre bronze.
 */
export function fullscreenButton(ui, x, y, focused = false) {
  const css = renderer.logicalSize().cssScale || 1;
  const s = st.active ? 24 : 18;
  const pad = st.active ? Math.max(0, Math.ceil((MIN_CSS_PX / css - s) / 2)) : 0;
  drawNineSlice(ui, 'button', x, y, s, s);
  if (focused) drawNineSlice(ui, 'frame_bronze', x - 2, y - 2, s + 4, s + 4);
  const m = Math.round(s * 0.28), l = Math.max(3, Math.round(s * 0.18)), x2 = x + s - m, y2 = y + s - m, x1 = x + m, y1 = y + m;
  ui.fillStyle = isFullscreen() ? C.bronze : C.os;
  ui.fillRect(x1, y1, l, 1); ui.fillRect(x1, y1, 1, l); ui.fillRect(x2 - l, y1, l, 1); ui.fillRect(x2 - 1, y1, 1, l);
  ui.fillRect(x1, y2 - 1, l, 1); ui.fillRect(x1, y2 - l, 1, l); ui.fillRect(x2 - l, y2 - 1, l, 1); ui.fillRect(x2 - 1, y2 - l, 1, l);
  return { x: x - pad, y: y - pad, w: s + pad * 2, h: s + pad * 2 };
}
