// core/input.js — entrées abstraites (ARCHITECTURE.md § 6) : clavier (codes
// physiques, donc ZQSD = WASD), souris et manette (Gamepad API), remappables.
//
// Cycle : main.js appelle tickInput() au début de CHAQUE pas logique. justPressed(a)
// est vrai pendant le seul pas qui suit l'appui ; pressedAt(a) donne le temps
// audio exact de l'appui (mesuré dans l'événement DOM, pas au tick) pour le
// jugement rythmique. Les transitions émettent input:action sur le bus.
//
// initInput({ canvas, getAudioTime, screenToWorld?, logicalSize? }) :
//   screenToWorld(x, y) → {x, y}  (camera.screenToWorld) pour pointer().worldX/Y ;
//   logicalSize() → {w, h}        (renderer.logicalSize) pour convertir la souris.

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

let bindings = cloneBindings(DEFAULT_BINDINGS);
const keyToActions = new Map();    // code → [actions]
const buttonToActions = new Map(); // index → [actions]

// État par action (objets plats, alloués une fois).
const down = {}, pending = {}, just = {}, at = {}, keyCount = {};
for (const a of ACTIONS) { down[a] = false; pending[a] = false; just[a] = false; at[a] = 0; keyCount[a] = 0; }

const axisOut = { x: 0, y: 0 };
const pointerState = { x: 0, y: 0, down: false, worldX: 0, worldY: 0, inside: false };
const tmpWorld = { x: 0, y: 0 };
let deps = { canvas: null, getAudioTime: () => 0, screenToWorld: null, logicalSize: null };
let capture = null;              // { action, onDone } pendant un remappage
let gamepadIndex = -1;
const padButtons = new Array(32).fill(false); // état précédent des boutons manette
const stickDir = { up: false, down: false, left: false, right: false };
let stickX = 0, stickY = 0;

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

function onKeyUp(e) {
  const list = keyToActions.get(e.code);
  if (list) { e.preventDefault(); applyList(list, false); }
}

// Perte de focus : tout relâcher pour éviter les touches « collées ».
function releaseAll() {
  for (const a of ACTIONS) { if (down[a]) { keyCount[a] = 1; press(a, false); } keyCount[a] = 0; }
}

function updatePointer(e) {
  const c = deps.canvas;
  if (!c) return;
  const r = c.getBoundingClientRect();
  const size = deps.logicalSize ? deps.logicalSize() : null;
  const lw = size ? size.w : c.width, lh = size ? size.h : c.height;
  pointerState.x = (e.clientX - r.left) / (r.width || 1) * lw;
  pointerState.y = (e.clientY - r.top) / (r.height || 1) * lh;
  pointerState.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

function onMouseDown(e) {
  updatePointer(e);
  if (e.button === 0) pointerState.down = true;
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
  const pads = navigator.getGamepads ? navigator.getGamepads() : null;
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
  if (deps.screenToWorld) {
    const w = deps.screenToWorld(pointerState.x, pointerState.y, tmpWorld);
    pointerState.worldX = w.x; pointerState.worldY = w.y;
  } else { pointerState.worldX = pointerState.x; pointerState.worldY = pointerState.y; }
}

export function isDown(action) { return down[action] === true; }
export function justPressed(action) { return just[action] === true; }
export function pressedAt(action) { return at[action] || 0; }

/** Direction normalisée (-1..1) : clavier prioritaire, sinon stick gauche. */
export function axis() {
  let x = (down.right ? 1 : 0) - (down.left ? 1 : 0);
  let y = (down.down ? 1 : 0) - (down.up ? 1 : 0);
  if (x === 0 && y === 0) { x = stickX; y = stickY; }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  axisOut.x = x; axisOut.y = y;
  return axisOut;
}

/** Pointeur en pixels logiques + coordonnées monde (objet réutilisé). */
export function pointer() { return pointerState; }

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
