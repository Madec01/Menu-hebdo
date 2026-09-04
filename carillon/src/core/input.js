// core/input.js — entrées abstraites (ARCHITECTURE.md § 6) : clavier (codes physiques, donc
// ZQSD = WASD), souris, manette (Gamepad API) et tactile (Pointer Events multi-doigts), remappables.
//
// Cycle : main.js appelle tickInput() au début de CHAQUE pas logique. justPressed(a) est vrai
// pendant le seul pas qui suit l'appui ; pressedAt(a) donne le temps audio exact de l'appui
// (mesuré dans l'événement DOM, pas au tick) pour le jugement rythmique — le tactile passe par
// le même chemin (press()) que le clavier. Les transitions émettent input:action sur le bus.
//
// initInput({ canvas, getAudioTime, screenToWorld?, logicalSize? }) : screenToWorld(x, y) → {x, y}
// (camera.screenToWorld) pour pointer().worldX/Y ; logicalSize() → {w, h} (renderer.logicalSize).
//
// Tactile : ui/touch.js décrit la disposition (setTouchLayout) ; ici on suit chaque doigt : posé sur
// un bouton virtuel = press(action) ; posé dans la zone du stick = joystick flottant (axis()) ; tout
// autre doigt = « tap » (clic latché au relâchement s'il n'a pas bougé) ou glissement (dragX/dragY).

import { bus } from './events.js';

export const ACTIONS = ['up', 'down', 'left', 'right', 'dash', 'parry', 'pause', 'confirm', 'cancel', 'menuUp', 'menuDown', 'menuLeft', 'menuRight'];

// Liaisons par défaut : `keys` = KeyboardEvent.code ou 'MouseN' ; `buttons` = index Gamepad.
const DEFAULT_BINDINGS = {
  up:        { keys: ['KeyW', 'ArrowUp'],    buttons: [12] },
  down:      { keys: ['KeyS', 'ArrowDown'],  buttons: [13] },
  left:      { keys: ['KeyA', 'ArrowLeft'],  buttons: [14] },
  right:     { keys: ['KeyD', 'ArrowRight'], buttons: [15] },
  dash:      { keys: ['Space'],              buttons: [0] },
  parry:     { keys: ['ShiftLeft', 'ShiftRight', 'Mouse2'], buttons: [1, 5] },
  pause:     { keys: ['Escape'],             buttons: [9] },
  confirm:   { keys: ['Enter', 'Space'],     buttons: [0] },
  cancel:    { keys: ['Escape', 'Backspace'], buttons: [1] },
  menuUp:    { keys: ['KeyW', 'ArrowUp'],    buttons: [12] },
  menuDown:  { keys: ['KeyS', 'ArrowDown'],  buttons: [13] },
  menuLeft:  { keys: ['KeyA', 'ArrowLeft'],  buttons: [14] },
  menuRight: { keys: ['KeyD', 'ArrowRight'], buttons: [15] },
};
const DEADZONE = 0.22;
const STICK_THRESHOLD = 0.5; // le stick déclenche aussi les actions de direction/menu
const TAP_SLOP = 6;          // px logiques : au-delà, un doigt « tap » devient un glissement

let bindings = cloneBindings(DEFAULT_BINDINGS);
const keyToActions = new Map();    // code → [actions]
const buttonToActions = new Map(); // index → [actions]

// État par action (objets plats, alloués une fois).
const down = {}, pending = {}, just = {}, at = {}, keyCount = {};
for (const a of ACTIONS) { down[a] = false; pending[a] = false; just[a] = false; at[a] = 0; keyCount[a] = 0; }

const axisOut = { x: 0, y: 0 };
// clicks = clics gauches (mousedown dans le canvas, ou tap tactile) depuis le tick précédent : un clic
// bref entre deux ticks n'est jamais perdu ; clickX/Y = position du dernier. dragX/dragY = glissement
// (px logiques) des doigts « tap » depuis le tick précédent ; touch = dernière interaction tactile.
const pointerState = { x: 0, y: 0, down: false, worldX: 0, worldY: 0, inside: false, clicks: 0, clickX: 0, clickY: 0, dragX: 0, dragY: 0, touch: false };
let pendingClicks = 0, pendingClickX = 0, pendingClickY = 0, pendingDragX = 0, pendingDragY = 0;
const tmpWorld = { x: 0, y: 0 };
let deps = { canvas: null, getAudioTime: () => 0, screenToWorld: null, logicalSize: null };
let capture = null;              // { action, onDone } pendant un remappage
let gamepadIndex = -1;
const padButtons = new Array(32).fill(false); // état précédent des boutons manette
const stickDir = { up: false, down: false, left: false, right: false };
let stickX = 0, stickY = 0;

// Tactile : disposition (ui/touch.js), doigts suivis, stick virtuel flottant.
let touchLayout = null;          // { stickZone:{x,y,w,h}, buttons:[{action,x,y,r}], radius, deadzone }
const touches = new Map();       // pointerId → { kind:'stick'|'button'|'tap', action, ox, oy, x, y, moved }
const stick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };   // origine et position du pouce (px logiques)
const touchButtons = {};         // action → nombre de doigts posés
const touchInfo = { stick, buttons: touchButtons, seen: false, count: 0 };
let touchX = 0, touchY = 0;      // axe du stick virtuel (-1..1)

function cloneBindings(src) {
  const out = {};
  for (const a of ACTIONS) out[a] = { keys: (src[a]?.keys || []).slice(), buttons: (src[a]?.buttons || []).slice() };
  return out;
}

// Reconstruit les tables inverses touche → actions.
function rebuildMaps() {
  keyToActions.clear(); buttonToActions.clear();
  for (const a of ACTIONS) {
    for (const k of bindings[a].keys) { if (!keyToActions.has(k)) keyToActions.set(k, []); keyToActions.get(k).push(a); }
    for (const b of bindings[a].buttons) { if (!buttonToActions.has(b)) buttonToActions.set(b, []); buttonToActions.get(b).push(a); }
  }
}

// Appui/relâchement d'une source physique pour une action (compte les sources
// pour qu'une action tenue par deux touches ne se relâche pas trop tôt).
function press(action, pressed) {
  if (pressed) {
    keyCount[action]++;
    if (keyCount[action] > 1) return;
    down[action] = true; pending[action] = true;
    at[action] = deps.getAudioTime();
    bus.emit('input:action', { action, pressed: true, at: at[action] });
  } else {
    if (keyCount[action] <= 0) return;
    keyCount[action]--;
    if (keyCount[action] > 0) return;
    down[action] = false;
    bus.emit('input:action', { action, pressed: false, at: deps.getAudioTime() });
  }
}

function applyList(list, pressed) { if (list) for (let i = 0; i < list.length; i++) press(list[i], pressed); }

function isTypingTarget(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}

function onKeyDown(e) {
  if (isTypingTarget(e)) return;
  if (capture) { e.preventDefault(); finishCapture(e.code === 'Escape' ? null : e.code, null); return; }
  const list = keyToActions.get(e.code);
  if (!list) return;
  e.preventDefault();
  if (e.repeat) return;
  applyList(list, true);
}

function onKeyUp(e) { const list = keyToActions.get(e.code); if (list) { e.preventDefault(); applyList(list, false); } }

// Perte de focus : tout relâcher pour éviter les touches « collées » (doigts compris).
function releaseAll() {
  for (const a of ACTIONS) { if (down[a]) { keyCount[a] = 1; press(a, false); } keyCount[a] = 0; }
  for (const a of Object.keys(touchButtons)) touchButtons[a] = 0;
  touches.clear(); stick.active = false; touchX = touchY = 0; pointerState.down = false;
}

// Position d'un événement en pixels logiques (souris : sans borne ; doigts : bornée au canvas).
function toLogical(e, clampIt) {
  const c = deps.canvas;
  const r = c.getBoundingClientRect();
  const size = deps.logicalSize ? deps.logicalSize() : null;
  const lw = size ? size.w : c.width, lh = size ? size.h : c.height;
  let x = (e.clientX - r.left) / (r.width || 1) * lw, y = (e.clientY - r.top) / (r.height || 1) * lh;
  if (clampIt) { x = Math.max(0, Math.min(lw, x)); y = Math.max(0, Math.min(lh, y)); }
  pointerState.inside = clampIt || (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
  return { x, y };
}

function updatePointer(e) {
  if (!deps.canvas) return;
  const p = toLogical(e, false);
  pointerState.x = p.x; pointerState.y = p.y;
  if (e.type === 'mousemove' && !(e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents)) pointerState.touch = false;
}

function onMouseDown(e) {
  updatePointer(e);
  if (e.button === 0) {
    pointerState.down = true;
    if (pointerState.inside) { pendingClicks++; pendingClickX = pointerState.x; pendingClickY = pointerState.y; }
  }
  const code = 'Mouse' + e.button;
  if (capture) { finishCapture(code, null); return; }
  const list = keyToActions.get(code);
  if (list) { e.preventDefault(); applyList(list, true); }
}

function onMouseUp(e) {
  updatePointer(e);
  if (e.button === 0) pointerState.down = false;
  applyList(keyToActions.get('Mouse' + e.button), false);
}

// ---- Tactile (Pointer Events, pointerType ≠ 'mouse') --------------------------------------------

function touchButtonAt(x, y) {
  if (!touchLayout) return null;
  const list = touchLayout.buttons;
  for (let i = 0; i < list.length; i++) {
    const b = list[i], rr = b.r + (b.pad || 0);
    if ((x - b.x) * (x - b.x) + (y - b.y) * (y - b.y) <= rr * rr) return b;
  }
  return null;
}

function inZone(z, x, y) { return !!z && x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h; }

function onPointerDown(e) {
  if (e.pointerType === 'mouse' || !deps.canvas || isTypingTarget(e)) return;
  e.preventDefault();                 // pas d'événements souris de compatibilité, pas de zoom
  touchInfo.seen = true; pointerState.touch = true;
  const p = toLogical(e, true);
  pointerState.x = p.x; pointerState.y = p.y; pointerState.down = true;
  const tch = { kind: 'tap', action: null, ox: p.x, oy: p.y, x: p.x, y: p.y, moved: false };
  const b = touchButtonAt(p.x, p.y);
  if (b && !capture) { tch.kind = 'button'; tch.action = b.action; touchButtons[b.action] = (touchButtons[b.action] || 0) + 1; press(b.action, true); }
  else if (touchLayout && !stick.active && inZone(touchLayout.stickZone, p.x, p.y)) {
    tch.kind = 'stick'; stick.active = true; stick.ox = stick.x = p.x; stick.oy = stick.y = p.y; touchX = touchY = 0;
  }
  touches.set(e.pointerId, tch);
  touchInfo.count = touches.size;
}

function onPointerMove(e) {
  const tch = touches.get(e.pointerId);
  if (!tch) return;
  e.preventDefault();
  const p = toLogical(e, true);
  pointerState.x = p.x; pointerState.y = p.y;
  if (tch.kind === 'stick') {
    const R = touchLayout ? touchLayout.radius : 40, dz = touchLayout ? touchLayout.deadzone : 0.12;
    let dx = p.x - stick.ox, dy = p.y - stick.oy;
    let len = Math.hypot(dx, dy);
    if (len > R) { stick.ox = p.x - dx / len * R; stick.oy = p.y - dy / len * R; dx = p.x - stick.ox; dy = p.y - stick.oy; len = R; } // la base suit le pouce
    stick.x = p.x; stick.y = p.y;
    const k = len < R * dz ? 0 : Math.min(1, (len - R * dz) / (R - R * dz));
    touchX = len > 0 ? dx / len * k : 0; touchY = len > 0 ? dy / len * k : 0;
  } else if (tch.kind === 'tap') {
    pendingDragX += p.x - tch.x; pendingDragY += p.y - tch.y;
    if (!tch.moved && Math.hypot(p.x - tch.ox, p.y - tch.oy) > TAP_SLOP) tch.moved = true;
  }
  tch.x = p.x; tch.y = p.y;
}

function onPointerUp(e) {
  const tch = touches.get(e.pointerId);
  if (!tch) return;
  e.preventDefault();
  touches.delete(e.pointerId);
  touchInfo.count = touches.size;
  if (tch.kind === 'button') { touchButtons[tch.action] = Math.max(0, (touchButtons[tch.action] || 1) - 1); press(tch.action, false); }
  else if (tch.kind === 'stick') { stick.active = false; touchX = touchY = 0; }
  else if (!tch.moved && e.type === 'pointerup') { pendingClicks++; pendingClickX = tch.x; pendingClickY = tch.y; }
  pointerState.down = touches.size > 0;
}

// Bloque le zoom par pincement / double-tap et le défilement de la page (hors champs de saisie).
function blockTouchDefault(e) { if (!isTypingTarget(e)) e.preventDefault(); }

/**
 * Disposition des commandes tactiles (ui/touch.js), ou null hors jeu : les doigts déjà posés sur
 * un bouton ou le stick sont relâchés proprement (aucun clic fantôme).
 */
export function setTouchLayout(layout) {
  if (layout === touchLayout) return;
  touchLayout = layout;
  if (layout) return;
  for (const tch of touches.values()) {
    if (tch.kind === 'button') { touchButtons[tch.action] = 0; press(tch.action, false); }
    tch.kind = 'tap'; tch.moved = true;
  }
  stick.active = false; touchX = touchY = 0;
}

/** État tactile pour le rendu (objet réutilisé) : stick {active, ox, oy, x, y}, buttons {action → doigts}, seen. */
export function touchState() { return touchInfo; }

/** Annule les clics latchés de ce tick (voile « tourne ton téléphone »). */
export function consumeClicks() { pointerState.clicks = 0; pendingClicks = 0; }

function finishCapture(key, button) {
  const c = capture; capture = null;
  if (!c) return;
  if (key === null && button === null) { c.onDone(null); return; }
  const b = bindings[c.action];
  if (key !== null) b.keys = [key]; else b.buttons = [button];
  rebuildMaps();
  c.onDone({ action: c.action, key, button });
}

// Lecture de la manette (au tick logique). Les boutons passent par press().
function pollGamepad() {
  let pads = null;
  try { pads = navigator.getGamepads ? navigator.getGamepads() : null; } catch (e) { pads = null; }
  let pad = null;
  if (pads) {
    if (gamepadIndex >= 0 && pads[gamepadIndex]) pad = pads[gamepadIndex];
    else for (let i = 0; i < pads.length; i++) if (pads[i]) { pad = pads[i]; gamepadIndex = i; break; }
  }
  if (!pad) { if (gamepadIndex >= 0) { gamepadIndex = -1; releaseAll(); } stickX = stickY = 0; return; }
  const btns = pad.buttons;
  for (let i = 0; i < btns.length && i < 32; i++) {
    const p = btns[i].pressed || btns[i].value > 0.5;
    if (p === padButtons[i]) continue;
    padButtons[i] = p;
    if (capture && p) { finishCapture(null, i); continue; }
    applyList(buttonToActions.get(i), p);
  }
  const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
  const len = Math.hypot(ax, ay);
  if (len < DEADZONE) { stickX = 0; stickY = 0; }
  else { const k = Math.min(1, (len - DEADZONE) / (1 - DEADZONE)) / len; stickX = ax * k; stickY = ay * k; }
  // Le stick simule aussi les directions (menus et déplacement sans dpad).
  setStickDir('left', stickX < -STICK_THRESHOLD, 'menuLeft');
  setStickDir('right', stickX > STICK_THRESHOLD, 'menuRight');
  setStickDir('up', stickY < -STICK_THRESHOLD, 'menuUp');
  setStickDir('down', stickY > STICK_THRESHOLD, 'menuDown');
}

function setStickDir(dir, on, menuAction) {
  if (stickDir[dir] === on) return;
  stickDir[dir] = on;
  press(dir, on); press(menuAction, on);
}

/** Initialise les écouteurs. À appeler une fois. */
export function initInput({ canvas, getAudioTime, screenToWorld = null, logicalSize = null }) {
  deps = { canvas, getAudioTime: getAudioTime || (() => 0), screenToWorld, logicalSize };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  if (canvas) {
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', updatePointer);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // Doigts : écoutés sur la fenêtre (les bandes noires autour du canvas comptent aussi).
    window.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerUp, { passive: false });
    for (const ev of ['touchstart', 'touchmove', 'touchend', 'gesturestart']) document.addEventListener(ev, blockTouchDefault, { passive: false });
    canvas.addEventListener('dblclick', (e) => e.preventDefault());
  }
  rebuildMaps();
}

/** À appeler au début de chaque pas logique : fige justPressed et lit la manette. */
export function tickInput() {
  pollGamepad();
  for (let i = 0; i < ACTIONS.length; i++) {
    const a = ACTIONS[i];
    just[a] = pending[a]; pending[a] = false;
  }
  pointerState.clicks = pendingClicks; pendingClicks = 0;
  if (pointerState.clicks) { pointerState.clickX = pendingClickX; pointerState.clickY = pendingClickY; }
  pointerState.dragX = pendingDragX; pointerState.dragY = pendingDragY; pendingDragX = pendingDragY = 0;
  if (deps.screenToWorld) {
    const w = deps.screenToWorld(pointerState.x, pointerState.y, tmpWorld);
    pointerState.worldX = w.x; pointerState.worldY = w.y;
  } else { pointerState.worldX = pointerState.x; pointerState.worldY = pointerState.y; }
}

export function isDown(action) { return down[action] === true; }
export function justPressed(action) { return just[action] === true; }
export function pressedAt(action) { return at[action] || 0; }

/** Direction normalisée (-1..1) : clavier prioritaire, sinon stick tactile, sinon stick gauche manette. */
export function axis() {
  let x = (down.right ? 1 : 0) - (down.left ? 1 : 0);
  let y = (down.down ? 1 : 0) - (down.up ? 1 : 0);
  if (x === 0 && y === 0) { x = touchX; y = touchY; }
  if (x === 0 && y === 0) { x = stickX; y = stickY; }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  axisOut.x = x; axisOut.y = y;
  return axisOut;
}

/** Pointeur en pixels logiques + coordonnées monde + clics latchés (objet réutilisé). */
export function pointer() { return pointerState; }

/**
 * Vibration légère de la manette (cran 4 de Résonance, boss…) si l'API le permet ;
 * silencieux sinon. strength 0..1, durée en ms.
 */
export function rumble(strength = 0.3, ms = 120) {
  if (gamepadIndex < 0) return;
  let pad = null;
  try { const pads = navigator.getGamepads ? navigator.getGamepads() : null; pad = pads ? pads[gamepadIndex] : null; } catch (e) { pad = null; }
  if (!pad) return;
  try {
    const act = pad.vibrationActuator;
    if (act && act.playEffect) { act.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: strength, strongMagnitude: strength * 0.5 }).catch(() => {}); return; }
    const h = pad.hapticActuators && pad.hapticActuators[0];
    if (h && h.pulse) h.pulse(strength, ms).catch(() => {});
  } catch (e) { /* manette sans retour haptique */ }
}

export function setBinding(action, { keys, buttons } = {}) {
  if (!bindings[action]) return;
  if (Array.isArray(keys)) bindings[action].keys = keys.slice();
  if (Array.isArray(buttons)) bindings[action].buttons = buttons.slice();
  rebuildMaps();
}

/** Copie des liaisons (sérialisable dans save.options.bindings). */
export function getBindings() { return cloneBindings(bindings); }

/** Applique un objet partiel { action: {keys, buttons} } (ex. save.options.bindings). */
export function applyBindings(map) {
  if (!map) return;
  for (const a of Object.keys(map)) setBinding(a, map[a]);
}

export function resetBindings() { bindings = cloneBindings(DEFAULT_BINDINGS); rebuildMaps(); }

/** Capture la prochaine touche/bouton pour action ; Échap annule (onDone(null)). */
export function beginCapture(action, onDone) {
  if (!bindings[action]) { onDone(null); return; }
  capture = { action, onDone };
}

export function cancelCapture() { if (capture) finishCapture(null, null); }
export function isCapturing() { return capture !== null; }
export function hasGamepad() { return gamepadIndex >= 0; }
