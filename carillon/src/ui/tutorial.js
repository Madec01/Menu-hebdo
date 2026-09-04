// ui/tutorial.js — tutoriel interactif (~90 s) posé au-dessus de la run :
// déplacement → première vague → la Mesure ressentie (« tape Espace sur trois
// temps » avec anneau autour du joueur et compteur de réussites ; la percussion
// entre avec la Résonance) → montée de niveau → objectif → fin. Textes
// tutorial.* (fr.json). La boîte de dialogue est posée en BAS de l'écran pour ne
// jamais couvrir le joueur (au centre) ; à l'étape `move`, une flèche désigne le
// joueur et les touches de déplacement sont dessinées. Échap passe le tutoriel ;
// rejouable depuis le titre ; flag save.tutorialDone.

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
const STEPS = ['move', 'wave', 'beat1', 'beat2', 'beat3', 'levelup', 'goal', 'done'];
const BEAT_GOAL = { beat1: 1, beat2: 2, beat3: 3 };
const MIN_SEC = { move: 3, wave: 4, beat1: 2, beat2: 2, beat3: 2, levelup: 3, goal: 7, done: 5 };
const MAX_SEC = { move: 9, wave: 10, beat1: 25, beat2: 25, beat3: 25, levelup: 25, goal: 7, done: 5 };
const BOX = { x: 60, y: 172, w: 360, h: 62 };   // sous le joueur, au-dessus de la jauge de Résonance
const TEXT_W = BOX.w - 24;
const CHARS_PER_SEC = 45;

export function createTutorial(deps) {
  let step = 0, stepT = 0, typed = 0, hits = 0, moved = 0, kills = 0, leveled = false, time = 0;
  let lastX = 0, lastY = 0;
  const unsubs = [];

  const id = () => STEPS[step];
  const player = () => { const g = deps.game ? deps.game.gameState() : null; return g && g.player ? g.player : null; };
  const firstKey = (action) => { const b = getBindings()[action]; return b && b.keys.length ? keyName(b.keys[0]) : '?'; };

  function subscribe() {
    unsubs.push(bus.on('rhythm:input', (e) => { if (e.action === 'dash' && e.grade !== 'rate' && BEAT_GOAL[id()]) hits++; }));
    unsubs.push(bus.on('enemy:death', () => { kills++; }));
    unsubs.push(bus.on('level:choice', () => { leveled = true; }));
  }

  function stepDone() {
    const s = id();
    if (stepT >= MAX_SEC[s]) return true;
    if (stepT < MIN_SEC[s]) return false;
    switch (s) {
      case 'move': return moved >= 60;
      case 'wave': return kills >= 2;
      case 'beat1': case 'beat2': case 'beat3': return hits >= BEAT_GOAL[s];
      case 'levelup': return leveled;
      default: return false;
    }
  }

  function next() {
    step++; stepT = 0; typed = 0;
    if (step >= STEPS.length) finish(false);
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

  return {
    freezes: false,
    enter() {
      step = 0; stepT = 0; typed = 0; hits = 0; moved = 0; kills = 0; leveled = false; time = 0;
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
      if (a === 'confirm' && stepT >= MIN_SEC[id()] && !BEAT_GOAL[id()] && id() !== 'levelup') { next(); return true; }
      return false;
    },
    render(ui) {
      const s = id();
      if (!s || states.isFrozen()) return; // cartes ou pause au-dessus : la boîte se retire
      const goal = BEAT_GOAL[s];
      const textW = (s === 'move' || goal) ? TEXT_W - 70 : TEXT_W;
      panel(ui, BOX.x, BOX.y, BOX.w, BOX.h, 'parchment');
      icon(ui, 'ui_lanterne', BOX.x + 8, BOX.y + 6, 0.5);
      text(ui, t('ui.tutorial.title'), BOX.x + 28, BOX.y + 7, { size: 9, color: C.encreClaire });
      text(ui, t('ui.tutorial.step', { step: step + 1, total: STEPS.length }), BOX.x + BOX.w - 12, BOX.y + 7, { size: 9, align: 'right', color: C.encreClaire });
      // En mode tactile, la variante « _touch » du texte est utilisée quand elle existe (pas de ZQSD/Espace).
      const full = (touchActive() && hasKey('tutorial.' + s + '_touch')) ? t('tutorial.' + s + '_touch') : t('tutorial.' + s);
      const shown = typed >= full.length ? full : full.slice(0, Math.floor(typed));
      paragraph(ui, shown, BOX.x + 12, BOX.y + 20, textW, { size: 9, color: C.encre, lineHeight: 10, maxLines: 3 });
      const canSkipStep = stepT >= MIN_SEC[s] && !goal && s !== 'levelup';
      text(ui, t(canSkipStep ? 'ui.tutorial.next' : 'ui.tutorial.skip'), BOX.x + 12, BOX.y + BOX.h - 15, { size: 7, color: C.encreClaire });
      if (s === 'move') renderMoveHelper(ui);
      if (goal) renderBeatHelper(ui, goal);
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
}
