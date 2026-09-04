// ui/tutorial.js — tutoriel interactif (~90 s) posé au-dessus de la run :
// déplacement → première vague → la Mesure ressentie (« tape Espace sur trois
// temps » avec halo et compteur de réussites ; la percussion entre avec la
// Résonance) → montée de niveau → objectif → fin. Textes tutorial.* (fr.json).
// Échap passe le tutoriel ; rejouable depuis le titre ; flag save.tutorialDone.

import { bus } from '../core/events.js';
import { getSave, commit } from '../core/save.js';
import * as conductor from '../audio/conductor.js';
import { playUi } from '../audio/sfx.js';
import { t } from './i18n.js';
import * as states from './states.js';
import { toast } from './toasts.js';
import { panel, text, paragraph, icon, C } from './widgets.js';

const W = 480;
const STEPS = ['move', 'wave', 'beat1', 'beat2', 'beat3', 'levelup', 'goal', 'done'];
const BEAT_GOAL = { beat1: 1, beat2: 2, beat3: 3 };
const MIN_SEC = { move: 3, wave: 4, beat1: 2, beat2: 2, beat3: 2, levelup: 3, goal: 7, done: 5 };
const MAX_SEC = { move: 9, wave: 10, beat1: 25, beat2: 25, beat3: 25, levelup: 25, goal: 7, done: 5 };
const BOX = { x: 60, y: 52, w: 360, h: 62 };
const CHARS_PER_SEC = 45;

export function createTutorial(deps) {
  let step = 0, stepT = 0, typed = 0, hits = 0, moved = 0, kills = 0, leveled = false, time = 0;
  let lastX = 0, lastY = 0;
  const unsubs = [];

  const id = () => STEPS[step];

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

  return {
    freezes: false,
    enter() {
      step = 0; stepT = 0; typed = 0; hits = 0; moved = 0; kills = 0; leveled = false; time = 0;
      const g = deps.game ? deps.game.gameState() : null;
      if (g && g.player) { lastX = g.player.x; lastY = g.player.y; }
      subscribe();
    },
    exit() { for (const u of unsubs) u(); unsubs.length = 0; },
    update(_, realDt) {
      if (states.isFrozen()) return; // cartes ouvertes : le tutoriel attend
      time += realDt; stepT += realDt; typed += realDt * CHARS_PER_SEC;
      const g = deps.game ? deps.game.gameState() : null;
      if (g && g.player) { moved += Math.hypot(g.player.x - lastX, g.player.y - lastY); lastX = g.player.x; lastY = g.player.y; }
      if (stepDone()) next();
    },
    handleAction(a) {
      if (a === 'cancel' || a === 'pause') { playUi('ui_cancel'); finish(true); return true; }
      if (a === 'confirm' && stepT >= MIN_SEC[id()] && !BEAT_GOAL[id()] && id() !== 'levelup') { next(); return true; }
      return false;
    },
    render(ui) {
      const s = id();
      if (!s) return;
      panel(ui, BOX.x, BOX.y, BOX.w, BOX.h, 'parchment');
      icon(ui, 'ui_lanterne', BOX.x + 8, BOX.y + 6, 0.5);
      text(ui, t('ui.tutorial.title'), BOX.x + 28, BOX.y + 7, { size: 9, color: C.encreClaire });
      text(ui, t('ui.tutorial.step', { step: step + 1, total: STEPS.length }), BOX.x + BOX.w - 12, BOX.y + 7, { size: 9, align: 'right', color: C.encreClaire });
      const full = t('tutorial.' + s);
      const shown = typed >= full.length ? full : full.slice(0, Math.floor(typed));
      paragraph(ui, shown, BOX.x + 12, BOX.y + 20, BOX.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 3 });
      text(ui, t('ui.tutorial.skip'), BOX.x + BOX.w - 12, BOX.y + BOX.h - 11, { size: 7, align: 'right', color: C.encreClaire });
      if (BEAT_GOAL[s]) renderBeatHelper(ui, BEAT_GOAL[s]);
    },
  };

  /** Halo de la Mesure au centre de l'écran : anneau qui se contracte sur le temps, touche Espace, compteur. */
  function renderBeatHelper(ui, goal) {
    const phase = conductor.isRunning() ? conductor.phase() : 0;
    const pulse = Math.pow(1 - phase, 2);
    const cx = W / 2, cy = 150;
    ui.strokeStyle = C.bronze; ui.lineWidth = 2; ui.globalAlpha = 0.35 + 0.65 * pulse;
    ui.beginPath(); ui.arc(cx, cy, 14 + 22 * (1 - pulse), 0, Math.PI * 2); ui.stroke();
    ui.globalAlpha = 1; ui.fillStyle = C.bronze;
    ui.beginPath(); ui.arc(cx, cy, 5 + 3 * pulse, 0, Math.PI * 2); ui.fill();
    panel(ui, cx - 26, cy + 26, 52, 16, 'dark');
    text(ui, t('ui.tutorial.press_dash'), cx, cy + 34, { size: 9, align: 'center', baseline: 'middle', color: C.clair });
    text(ui, t('ui.tutorial.beats', { done: Math.min(hits, goal), total: goal }), cx, cy + 46, { size: 10, align: 'center', color: C.os, shadow: true });
    for (let i = 0; i < goal; i++) { ui.fillStyle = i < hits ? C.bronze : C.gris; ui.fillRect(cx - goal * 5 + i * 10 + 2, cy + 60, 6, 6); }
  }
}
