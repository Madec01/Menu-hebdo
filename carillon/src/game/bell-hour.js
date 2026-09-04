// game/bell-hour.js — la Cloche horaire (ARCHITECTURE.md § 11 bis). À chaque `run:minute`, la
// cloche de la paroisse sonne 4 coups sur les 4 temps de la mesure suivante (sfx bell_minute calé
// sur la grille, volume croissant, dernier plus fort). Un Contre-battement jugé dans la fenêtre du
// 4ᵉ coup « répond à la cloche » : `bell:answered {minute, grade, bonus}` puis bonus selon la minute :
//   minutes impaires → soin 15 % ; 2, 6, 10 → +1 cran de Résonance ; 4, 8 → carte offerte ;
//   12 → Bronze de la paroisse ×1. Manqué : rien. `bell:ring {minute, at}` ouvre la sonnerie (HUD).
// L'état (bellState) est lu par le HUD via gameState().bell : coups allumés, réponse, chrono.

import { bus } from '../core/events.js';
import { pressedAt } from '../core/input.js';
import { now } from '../audio/audio.js';
import { isRunning, nextBeatAt, beatDuration, startAt, judge } from '../audio/conductor.js';
import { play as playSfx, has as hasSfx } from '../audio/sfx.js';
import { parishDef } from './data.js';
import { healPlayer } from './player.js';
import { bump as resonanceBump } from './resonance.js';
import { grantBonusLevel } from './progression.js';

const STRIKES = 4;
const VOLUME = [0.45, 0.6, 0.75, 1];   // coups croissants, le 4ᵉ plus fort
const LOOKAHEAD = 0.15;                 // s : les coups sont planifiés juste avant leur temps
const WINDOW_AFTER = 0.7;               // s après le 4ᵉ coup : la parade (0,2 s) arrive après la frappe
const HEAL_PCT = 0.15;
const ANSWER_SHOW = 1.6;

const ringPayload = { minute: 0, at: 0 };
const answerPayload = { minute: 0, grade: 'bon', bonus: '' };
const st = {
  run: null, player: null, world: null, unsubs: [],
  ringing: false, minute: 0, strikeAt: new Float64Array(STRIKES), scheduled: [false, false, false, false],
  lit: 0, fourthBeat: -1, windowUntil: 0, answered: false, answerT: 0, grade: '', bonus: '', rings: 0, answers: 0,
};

export function initBellHour(run, player, world) {
  disposeBellHour();
  st.run = run; st.player = player; st.world = world;
  st.ringing = false; st.lit = 0; st.answered = false; st.answerT = 0; st.rings = 0; st.answers = 0; st.minute = 0;
  st.unsubs.push(bus.on('run:minute', onMinute));
  st.unsubs.push(bus.on('player:parry', onParry));
}

export function disposeBellHour() {
  for (let i = 0; i < st.unsubs.length; i++) st.unsubs[i]();
  st.unsubs.length = 0;
  st.run = null; st.player = null; st.world = null; st.ringing = false;
}

/** État lisible par le HUD (objet réutilisé, ne pas modifier). */
export function bellState() { return st; }

/** Bonus de la minute (déterministe, lisible dans le HUD). */
export function bonusFor(minute) {
  if (minute % 12 === 0) return 'bronze';
  if (minute % 4 === 0) return 'card';
  if (minute % 2 === 0) return 'resonance';
  return 'heal';
}

function onMinute(e) {
  if (!st.run || !isRunning()) return;
  const bd = beatDuration();
  let barAt = nextBeatAt(4);
  if (barAt - now() < 0.05) barAt += STRIKES * bd;   // trop proche : la mesure d'après
  for (let k = 0; k < STRIKES; k++) { st.strikeAt[k] = barAt + k * bd; st.scheduled[k] = false; }
  st.fourthBeat = Math.round((st.strikeAt[STRIKES - 1] - startAt()) / bd);
  st.windowUntil = st.strikeAt[STRIKES - 1] + WINDOW_AFTER;
  st.ringing = true; st.lit = 0; st.answered = false; st.minute = e.minute; st.rings++;
  ringPayload.minute = e.minute; ringPayload.at = barAt;
  bus.emit('bell:ring', ringPayload);
}

function onParry() {
  if (!st.ringing || st.answered || !st.run || st.run.finished) return;
  const j = judge(pressedAt('parry'));
  if (j.beat !== st.fourthBeat || j.grade === 'rate') return;
  st.answered = true; st.answerT = ANSWER_SHOW; st.grade = j.grade; st.answers++;
  st.bonus = bonusFor(st.minute);
  answerPayload.minute = st.minute; answerPayload.grade = j.grade; answerPayload.bonus = st.bonus;
  bus.emit('bell:answered', answerPayload);
  applyBonus(st.bonus);
}

function applyBonus(bonus) {
  const p = st.player, run = st.run, world = st.world;
  switch (bonus) {
    case 'heal': if (p) healPlayer(p, Math.ceil(p.maxHp * HEAL_PCT)); break;
    case 'resonance': resonanceBump(1); break;
    case 'card': grantBonusLevel(run); break;
    case 'bronze': { const parish = parishDef(run.parishId); if (world) world.bronzePicked += parish ? parish.bronzeReward : 0; break; }
  }
}

/** Tick logique (game.updateGame) : planification des coups, fermeture de la fenêtre. */
export function updateBellHour(dt) {
  if (st.answerT > 0) st.answerT -= dt;
  if (!st.ringing) return;
  const t = now();
  let lit = 0;
  for (let k = 0; k < STRIKES; k++) {
    const at = st.strikeAt[k];
    if (!st.scheduled[k] && at <= t + LOOKAHEAD) {
      st.scheduled[k] = true;
      if (at >= t - 0.05 && hasSfx('bell_minute')) playSfx('bell_minute', { at, volume: VOLUME[k] });
    }
    if (at <= t) lit = k + 1;
  }
  st.lit = lit;
  if (t > st.windowUntil) st.ringing = false;   // manqué ou répondu : la sonnerie se referme
}
