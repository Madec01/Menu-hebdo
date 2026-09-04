// ui/states.js — pile d'écrans (ARCHITECTURE.md § 4). L'écran de base (titre,
// hub, run…) est remplacé par replace() avec un fondu au noir sonorisé ; les
// écrans empilables (pause, cartes, options, codex, crédits, tutoriel) sont
// posés par push() au-dessus de n'importe quel état. Les actions abstraites
// (menuUp/Down/Left/Right, confirm, cancel, pause) sont distribuées à l'écran du
// sommet ; la souris est suivie ici (clic = front descendant du pointeur).
//
// Un écran : { enter(params), exit(), update(dt, realDt), render(ctx, alpha),
//   handleAction(action) → bool, renderWorld?(ctx, alpha), freezes?: bool, cursor?: string }.
// freezes = true fige la logique de jeu (main.js met la boucle à timeScale 0).

import { bus } from '../core/events.js';
import { justPressed, pointer } from '../core/input.js';
import * as renderer from '../render/renderer.js';
import { playUi } from '../audio/sfx.js';

const FADE_SEC = 0.3;
const ACTIONS = ['menuUp', 'menuDown', 'menuLeft', 'menuRight', 'confirm', 'cancel', 'pause'];

let screens = {};
const stack = [];             // [{ name, screen }]
const fade = { phase: null, t: 0, next: null, params: null, sound: null };
let generation = 0;           // incrémenté à chaque changement de pile (coupe la distribution d'actions)

/** État de la souris en pixels logiques (objet réutilisé). */
export const mouse = { x: 0, y: 0, down: false, clicked: false, moved: false, inside: false, wasDown: false, lastX: -1, lastY: -1 };

/** screens : { nom → écran créé }. */
export function initStates(defs) { screens = defs; }

export function screenOf(name) { return screens[name]; }
export function top() { return stack.length ? stack[stack.length - 1] : null; }
export function topName() { const s = top(); return s ? s.name : null; }
export function baseName() { return stack.length ? stack[0].name : null; }
export function depth() { return stack.length; }
export function has(name) { for (let i = 0; i < stack.length; i++) if (stack[i].name === name) return true; return false; }
export function isTransitioning() { return fade.phase !== null; }

/** Vrai si un écran de la pile fige la logique de jeu. */
export function isFrozen() {
  for (let i = 0; i < stack.length; i++) if (stack[i].screen.freezes) return true;
  return false;
}

/** Empile un écran (options, codex, pause…) sans fondu. */
export function push(name, params = null) {
  const screen = screens[name];
  if (!screen) { console.warn('[states] écran inconnu', name); return; }
  stack.push({ name, screen });
  generation++;
  screen.enter(params || {});
  bus.emit('ui:open', { screen: name });
}

/** Retire l'écran du sommet (jamais l'écran de base). */
export function pop() {
  if (stack.length <= 1) return;
  const e = stack.pop();
  generation++;
  e.screen.exit();
  bus.emit('ui:close', { screen: e.name });
}

/** Retire tout ce qui se trouve au-dessus de l'écran de base. */
export function popAll() { while (stack.length > 1) pop(); }

/**
 * Remplace toute la pile par `name` après un fondu au noir (300 ms) sonorisé.
 * fade:false = bascule immédiate (démarrage).
 */
export function replace(name, params = null, { fade: withFade = true, sound = 'ui_confirm' } = {}) {
  if (!screens[name]) { console.warn('[states] écran inconnu', name); return; }
  if (!withFade || stack.length === 0) { swap(name, params); return; }
  if (fade.phase === 'out') return; // une transition est déjà en cours
  fade.phase = 'out'; fade.t = 0; fade.next = name; fade.params = params; fade.sound = sound;
  if (sound) playUi(sound);
}

function swap(name, params) {
  const from = baseName();
  while (stack.length) { const e = stack.pop(); e.screen.exit(); }
  stack.push({ name, screen: screens[name] });
  generation++;
  screens[name].enter(params || {});
  bus.emit('state:change', { from, to: name });
}

function updateMouse() {
  const p = pointer();
  mouse.moved = p.x !== mouse.lastX || p.y !== mouse.lastY;
  mouse.lastX = p.x; mouse.lastY = p.y;
  mouse.x = p.x; mouse.y = p.y; mouse.inside = p.inside;
  mouse.clicked = p.down && !mouse.wasDown && p.inside;
  mouse.wasDown = p.down;
  mouse.down = p.down;
}

/** Tick : fondu, souris, actions vers le sommet, update de chaque écran de la pile. */
export function update(dt, realDt) {
  updateMouse();
  if (fade.phase === 'out') {
    fade.t += realDt;
    if (fade.t >= FADE_SEC) { swap(fade.next, fade.params); fade.phase = 'in'; fade.t = 0; }
  } else if (fade.phase === 'in') {
    fade.t += realDt;
    if (fade.t >= FADE_SEC) fade.phase = null;
  }
  if (fade.phase !== 'out') {
    const gen = generation;
    const t = top();
    if (t) for (let i = 0; i < ACTIONS.length; i++) {
      if (!justPressed(ACTIONS[i])) continue;
      t.screen.handleAction(ACTIONS[i]);
      if (generation !== gen) break; // la pile a changé : les autres actions attendront le prochain tick
    }
  } else mouse.clicked = false;
  for (let i = 0; i < stack.length; i++) {
    const e = stack[i];
    if (e.screen.update) e.screen.update(dt, realDt);
    if (!stack.includes(e)) break; // l'écran s'est retiré pendant son update
  }
}

/** Rendu : monde de l'écran de base, puis chaque écran sur le calque HUD, puis le fondu. */
export function render(alpha) {
  const ctx = renderer.getCtx();
  const ui = renderer.getUiCtx();
  const size = renderer.logicalSize();
  if (stack.length && stack[0].screen.renderWorld) stack[0].screen.renderWorld(ctx, alpha);
  for (let i = 0; i < stack.length; i++) {
    ui.globalAlpha = 1;
    stack[i].screen.render(ui, alpha);
  }
  if (fade.phase) {
    const a = fade.phase === 'out' ? Math.min(1, fade.t / FADE_SEC) : 1 - Math.min(1, fade.t / FADE_SEC);
    ui.globalAlpha = a; ui.fillStyle = '#000000'; ui.fillRect(0, 0, size.w, size.h); ui.globalAlpha = 1;
  }
}

/** Curseur souhaité par l'écran du sommet ('pointer' par défaut, 'target' en jeu). */
export function cursorKind() {
  const t = top();
  return t && t.screen.cursor ? t.screen.cursor : 'pointer';
}
