// ui/tutorial.js — tutoriel interactif posé au-dessus de la run :
// déplacement → première vague → la Mesure ressentie (« tape Espace sur trois temps » avec anneau
// autour du joueur et compteur de réussites) → Contre-battement (parade réussie sur un Bâillon ou un
// projectile de Silence) → objectif (durée réelle de la nuit lue dans waves.json) → fin.
// L'étape « Choisis un Timbre » n'attend JAMAIS un niveau qui n'arrive pas : elle n'est insérée
// qu'au level:up réel survenu pendant le tutoriel (juste après l'étape en cours) ; sinon l'objectif
// explique les Échos et les cartes (texte `goal`, ou `goal_short` si la carte a déjà été vue).
// Textes tutorial.* (fr.json / en.json). La boîte est posée en BAS de l'écran pour ne jamais couvrir
// le joueur ; à l'étape `move`, une flèche désigne le joueur et les touches sont dessinées. Échap
// passe le tutoriel ; rejouable depuis le titre ; flag save.tutorialDone.

import { bus } from '../core/events.js';
import { getSave, commit } from '../core/save.js';
import * as conductor from '../audio/conductor.js';
import * as camera from '../render/camera.js';
import { playUi } from '../audio/sfx.js';
import { getBindings, hasGamepad } from '../core/input.js';
import { isActive as touchActive } from './touch.js';
import { has as hasKey } from './i18n.js';
import { t } from './i18n.js';
import { keyName } from './options-items.js';
import * as states from './states.js';
import { toast } from './toasts.js';
import { panel, text, paragraph, icon, keycap, hit, C } from './widgets.js';

const W = 480, H = 270;
const BASE_STEPS = ['move', 'wave', 'beat1', 'beat2', 'beat3', 'parry', 'goal', 'done'];
const BEAT_GOAL = { beat1: 1, beat2: 2, beat3: 3 };
const MIN_SEC = { move: 3, wave: 4, beat1: 2, beat2: 2, beat3: 2, parry: 3, levelup: 3, goal: 7, done: 5 };
const MAX_SEC = { move: 9, wave: 10, beat1: 25, beat2: 25, beat3: 25, parry: 18, levelup: 6, goal: 8, done: 5 };
const BOX_DESK = { x: 60, y: 166, w: 360, h: 72 };   // sous le joueur, au-dessus de la jauge de Résonance
const BOX_TOUCH = { x: 24, y: 164, w: 300, h: 74 };  // tactile : laisse les boutons Volée/Parade libres à droite
let BOX = BOX_DESK;
let TEXT_W = BOX.w - 24;
const CHARS_PER_SEC = 45;

export function createTutorial(deps) {
  let steps = BASE_STEPS.slice();
  let step = 0, stepT = 0, typed = 0, hits = 0, moved = 0, kills = 0, parried = false, leveled = false, time = 0;
  let lastX = 0, lastY = 0;
  const unsubs = [];

  const id = () => steps[step];
  const game = () => (deps.game ? deps.game.gameState() : null);
  const player = () => { const g = game(); return g && g.player ? g.player : null; };
  const firstKey = (action) => { const b = getBindings()[action]; return b && b.keys.length ? keyName(b.keys[0]) : '?'; };

  /** Durée réelle de la nuit (minutes), lue dans waves.json via le monde. */
  function nightMinutes() {
    const g = game();
    const d = g && g.world && g.world.waveDef ? g.world.waveDef.duration : 0;
    return d > 0 ? Math.round(d / 60) : 4;
  }

  function subscribe() {
    unsubs.push(bus.on('rhythm:input', (e) => { if (e.action === 'dash' && e.grade !== 'rate' && BEAT_GOAL[id()]) hits++; }));
    unsubs.push(bus.on('enemy:death', () => { kills++; }));
    unsubs.push(bus.on('player:parry', (e) => { if (e.success) parried = true; }));
    // Niveau réel pendant le tutoriel : l'étape « carte » est insérée juste après l'étape en cours,
    // et se lit une fois l'écran de cartes refermé (le tutoriel est figé pendant les cartes).
    unsubs.push(bus.on('level:up', () => {
      if (leveled || steps.indexOf('levelup') >= 0) return;
      leveled = true;
      const at = Math.min(step + 1, steps.indexOf('done'));
      steps.splice(at, 0, 'levelup');
    }));
  }

  function stepDone() {
    const s = id();
    if (stepT >= MAX_SEC[s]) return true;
    if (stepT < MIN_SEC[s]) return false;
    switch (s) {
      case 'move': return moved >= 60;
      case 'wave': return kills >= 2;
      case 'beat1': case 'beat2': case 'beat3': return hits >= BEAT_GOAL[s];
      case 'parry': return parried;
      default: return false;
    }
  }

  function next() {
    step++; stepT = 0; typed = 0;
    if (step >= steps.length) finish(false);
    else playUi('ui_move');
  }

  function finish(skipped) {
    const save = getSave();
    if (!save.tutorialDone) { save.tutorialDone = true; commit(); }
    if (skipped) toast({ title: t('ui.tutorial.title'), body: t('ui.tutorial.skipped'), icon: 'ui_lanterne' });
    states.pop();
  }

  /** Position écran du joueur (centre de l'écran si la run n'est pas prête). */
  function playerScreen() {
    const p = player();
    if (!p) return { x: W / 2, y: H / 2 };
    const s = camera.worldToScreen(p.x, p.y);
    return { x: s.x, y: s.y };
  }

  /** Texte de l'étape : variante tactile si elle existe, objectif court si la carte a déjà été vue. */
  function stepText(s) {
    let key = 'tutorial.' + s;
    if (s === 'goal' && leveled && hasKey('tutorial.goal_short')) key = 'tutorial.goal_short';
    if (touchActive() && hasKey(key + '_touch')) key += '_touch';
    return t(key, { minutes: nightMinutes() });
  }

  return {
    freezes: false,
    enter() {
      steps = BASE_STEPS.slice();
      step = 0; stepT = 0; typed = 0; hits = 0; moved = 0; kills = 0; parried = false; leveled = false; time = 0;
      const p = player();
      if (p) { lastX = p.x; lastY = p.y; }
      subscribe();
    },
    exit() { for (const u of unsubs) u(); unsubs.length = 0; },
    update(_, realDt) {
      if (states.isFrozen()) return; // cartes ouvertes : le tutoriel attend
      time += realDt; stepT += realDt; typed += realDt * CHARS_PER_SEC;
      const p = player();
      if (p) { moved += Math.hypot(p.x - lastX, p.y - lastY); lastX = p.x; lastY = p.y; }
      if (stepDone()) next();
      else if (states.mouse.clicked && hit(BOX, states.mouse.x, states.mouse.y)) this.handleAction('confirm'); // clic dans la boîte = continuer
    },
    handleAction(a) {
      if (a === 'cancel' || a === 'pause') { playUi('ui_cancel'); finish(true); return true; }
      if (a === 'confirm' && stepT >= MIN_SEC[id()] && !BEAT_GOAL[id()] && id() !== 'parry') { next(); return true; }
      return false;
    },
    render(ui) {
      const s = id();
      if (!s || states.isFrozen()) return; // cartes ou pause au-dessus : la boîte se retire
      BOX = touchActive() ? BOX_TOUCH : BOX_DESK; TEXT_W = BOX.w - 24;
      const goal = BEAT_GOAL[s];
      const textW = (s === 'move' || goal || s === 'parry') ? TEXT_W - 70 : TEXT_W;
      panel(ui, BOX.x, BOX.y, BOX.w, BOX.h, 'parchment');
      icon(ui, 'ui_lanterne', BOX.x + 8, BOX.y + 6, 0.5);
      text(ui, t('ui.tutorial.title'), BOX.x + 28, BOX.y + 7, { size: 9, color: C.encreClaire });
      text(ui, t('ui.tutorial.step', { step: step + 1, total: steps.length }), BOX.x + BOX.w - 12, BOX.y + 7, { size: 9, align: 'right', color: C.encreClaire });
      const full = stepText(s);
      const shown = typed >= full.length ? full : full.slice(0, Math.floor(typed));
      paragraph(ui, shown, BOX.x + 12, BOX.y + 20, textW, { size: 9, color: C.encre, lineHeight: 10, maxLines: 3 });
      const canSkipStep = stepT >= MIN_SEC[s] && !goal && s !== 'parry';
      text(ui, t(touchActive() ? (canSkipStep ? 'ui.tutorial.next_touch' : 'ui.tutorial.skip_touch') : (canSkipStep ? 'ui.tutorial.next' : 'ui.tutorial.skip')), BOX.x + 12, BOX.y + BOX.h - 15, { size: 7, color: C.encreClaire });
      if (s === 'move') renderMoveHelper(ui);
      if (goal) renderBeatHelper(ui, goal);
      if (s === 'parry') renderParryHelper(ui);
    },
  };

  /** Étape « marche » : flèche qui rebondit au-dessus du joueur, libellé « C'est toi », touches. */
  function renderMoveHelper(ui) {
    const ps = playerScreen();
    const bounce = Math.abs(Math.sin(time * 4)) * 5;
    const ax = Math.round(ps.x), ay = Math.round(ps.y - 66 - bounce);
    ui.fillStyle = C.bronze;
    ui.beginPath(); ui.moveTo(ax, ay + 10); ui.lineTo(ax - 7, ay); ui.lineTo(ax - 2, ay); ui.lineTo(ax - 2, ay - 8); ui.lineTo(ax + 2, ay - 8); ui.lineTo(ax + 2, ay); ui.lineTo(ax + 7, ay); ui.closePath(); ui.fill();
    text(ui, t('ui.tutorial.you'), ax, ay - 20, { kind: 'display', size: 12, align: 'center', color: C.bronze, shadow: true });
    // Croix des touches de déplacement (ou stick) dans la boîte, à droite du texte.
    const kx = BOX.x + BOX.w - 44, ky = BOX.y + 22;
    if (touchActive()) { text(ui, t('ui.tutorial.touch_stick'), kx, ky + 10, { size: 8, align: 'center', color: C.encreClaire, maxWidth: 60 }); return; }
    if (hasGamepad()) { text(ui, t('ui.tutorial.stick'), kx, ky + 10, { size: 8, align: 'center', color: C.encreClaire }); return; }
    keycap(ui, firstKey('up'), kx, ky, { size: 7, align: 'center', minWidth: 13, dark: true });
    keycap(ui, firstKey('left'), kx - 15, ky + 15, { size: 7, align: 'center', minWidth: 13, dark: true });
    keycap(ui, firstKey('down'), kx, ky + 15, { size: 7, align: 'center', minWidth: 13, dark: true });
    keycap(ui, firstKey('right'), kx + 15, ky + 15, { size: 7, align: 'center', minWidth: 13, dark: true });
  }

  /** Anneau de la Mesure autour du joueur (se contracte sur le temps), touche, compteur dans la boîte. */
  function renderBeatHelper(ui, goal) {
    const phase = conductor.isRunning() ? conductor.phase() : 0;
    const pulse = Math.pow(1 - phase, 2);
    const ps = playerScreen();
    const cx = Math.round(ps.x), cy = Math.round(ps.y);
    ui.strokeStyle = C.bronze; ui.lineWidth = 2; ui.globalAlpha = 0.35 + 0.65 * pulse;
    ui.beginPath(); ui.ellipse(cx, cy, 16 + 26 * (1 - pulse), 8 + 13 * (1 - pulse), 0, 0, Math.PI * 2); ui.stroke();
    ui.globalAlpha = 1;
    // Touche à côté du joueur : chaude quand le temps tombe.
    const label = touchActive() ? t('ui.tutorial.touch_dash') : (hasGamepad() ? t('ui.tutorial.pad_dash') : firstKey('dash'));
    keycap(ui, label, cx + 48, cy - 12, { size: 8, align: 'left', hot: pulse > 0.7 });
    // Compteur dans la boîte.
    const kx = BOX.x + BOX.w - 44;
    text(ui, t('ui.tutorial.beats', { done: Math.min(hits, goal), total: goal }), kx, BOX.y + 22, { size: 9, align: 'center', color: C.encre });
    for (let i = 0; i < goal; i++) { ui.fillStyle = i < hits ? C.bronze : C.gris; ui.fillRect(kx - goal * 5 + i * 10 + 2, BOX.y + 36, 6, 6); }
  }

  /** Étape Contre-battement : touche de parade à côté du joueur, état « à parer » dans la boîte. */
  function renderParryHelper(ui) {
    const phase = conductor.isRunning() ? conductor.phase() : 0;
    const pulse = Math.pow(1 - phase, 2);
    const ps = playerScreen();
    const cx = Math.round(ps.x), cy = Math.round(ps.y);
    ui.strokeStyle = C.os; ui.lineWidth = 1.5; ui.globalAlpha = 0.25 + 0.5 * pulse; ui.setLineDash([3, 3]);
    ui.beginPath(); ui.ellipse(cx, cy, 40, 20, 0, 0, Math.PI * 2); ui.stroke();
    ui.setLineDash([]); ui.globalAlpha = 1;
    const label = touchActive() ? t('ui.touch.parry') : (hasGamepad() ? t('ui.tutorial.pad_parry') : firstKey('parry'));
    keycap(ui, label, cx + 48, cy - 12, { size: 8, align: 'left', hot: pulse > 0.7 });
    const kx = BOX.x + BOX.w - 44;
    text(ui, t(parried ? 'ui.tutorial.parry_done' : 'ui.tutorial.parry_wait'), kx, BOX.y + 24, { size: 8, align: 'center', color: parried ? C.bronze : C.encreClaire, maxWidth: 64 });
  }
}
