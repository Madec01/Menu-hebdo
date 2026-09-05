// game/bell-hour.js — la Cloche horaire (ARCHITECTURE.md § 11 bis, § 8 bis). À chaque `run:minute`, la
// cloche de la paroisse sonne 4 coups sur les 4 temps de la mesure suivante (sfx bell_minute — joué ICI
// seulement, calé sur la grille, volume croissant, dernier plus fort). Un Contre-battement jugé dans la
// fenêtre du 4ᵉ coup « répond à la cloche » : `bell:answered {minute, grade, bonus, effect}` puis bonus :
//   · 'heal' (minutes impaires) : soin balance.bell.healPct ;
//   · 'resonance' (minutes paires) : +1 cran, ou soin balance.bell.maxTierHealPct si déjà au cran max
//     (effect = 'heal') ;
//   · 'card' : carte offerte — minutes de la table balance.bell.cardMinutes[nb de minutes de la nuit]
//     (nuit de 4 min : minute 2 ; 5 min : 2 et 4 ; 6 min : 2 et 4) ;
//   · 'bronze' : dernière cloche de la nuit, qui sonne balance.bell.lastLeadSec (8 s) AVANT l'arrivée du
//     boss (jamais pendant son intro) : `run:minute` de cette minute-là est ignoré.
// Manqué : rien. `bell:ring {minute, at}` ouvre la sonnerie (HUD). L'état (bellState) est lu par le HUD
// via gameState().bell : coups allumés, réponse, chrono.

import { bus } from '../core/events.js';
import { pressedAt } from '../core/input.js';
import { now } from '../audio/audio.js';
import { isRunning, nextBeatAt, beatDuration, startAt, judge } from '../audio/conductor.js';
import { play as playSfx, has as hasSfx } from '../audio/sfx.js';
import { parishDef, balance } from './data.js';
import { healPlayer } from './player.js';
import { bump as resonanceBump, tier as resonanceTier, maxTierIndex } from './resonance.js';
import { grantBonusLevel } from './progression.js';

const STRIKES = 4;
const VOLUME = [0.45, 0.6, 0.75, 1];   // coups croissants, le 4ᵉ plus fort
const LOOKAHEAD = 0.15;                 // s : les coups sont planifiés juste avant leur temps
const ANSWER_SHOW = 1.6;
const DEFAULTS = { lastLeadSec: 8, healPct: 0.15, maxTierHealPct: 0.25, windowAfterSec: 0.7, cardMinutes: { 4: [2], 5: [2, 4], 6: [2, 4] } };

const ringPayload = { minute: 0, at: 0 };
const answerPayload = { minute: 0, grade: 'bon', bonus: '', effect: '' };
const st = {
  run: null, player: null, world: null, unsubs: [],
  ringing: false, minute: 0, strikeAt: new Float64Array(STRIKES), scheduled: [false, false, false, false],
  lit: 0, fourthBeat: -1, windowUntil: 0, answered: false, answerT: 0, grade: '', bonus: '', effect: '', rings: 0, answers: 0,
  lastRung: false, pending: 0,   // pending : minute à sonner dès que la Mesure tourne (écran de cartes au même instant)
};

function cfg() { return balance().bell || DEFAULTS; }

export function initBellHour(run, player, world) {
  disposeBellHour();
  st.run = run; st.player = player; st.world = world;
  st.ringing = false; st.lit = 0; st.answered = false; st.answerT = 0; st.rings = 0; st.answers = 0; st.minute = 0; st.lastRung = false; st.pending = 0;
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

/** Durée de la nuit (s) et instant d'arrivée du boss (s) d'après le monde (12 min par défaut). */
function nightDuration() {
  const w = st.world;
  return (w && (w.duration || (w.waveDef && w.waveDef.duration))) || 720;
}
function bossAt() {
  const w = st.world;
  const evs = w && w.waveDef && w.waveDef.events;
  if (evs) for (let i = 0; i < evs.length; i++) if (evs[i].type === 'boss') return evs[i].at;
  return nightDuration();
}
/** Numéro de la dernière cloche : celle de la minute du boss (arrondie au-dessus). */
export function lastMinute() { return Math.max(1, Math.ceil(bossAt() / 60 - 1e-6)); }

/** Bonus de la minute (déterministe, lisible dans le HUD). */
export function bonusFor(minute) {
  const last = lastMinute();
  if (minute === last) return 'bronze';
  const table = cfg().cardMinutes || DEFAULTS.cardMinutes;
  const cards = table[last] || table[String(last)] || (last > 6 ? table[6] || table['6'] : null) || [];
  if (cards.indexOf(minute) >= 0) return 'card';
  if (minute % 2 === 0) return 'resonance';
  return 'heal';
}

function ring(minute) {
  if (!st.run) return;
  if (!isRunning()) { st.pending = minute; return; }   // la Mesure est arrêtée (écran de cartes) : on sonnera à la reprise
  st.pending = 0;
  const bd = beatDuration();
  let barAt = nextBeatAt(4);
  if (barAt - now() < 0.05) barAt += STRIKES * bd;   // trop proche : la mesure d'après
  for (let k = 0; k < STRIKES; k++) { st.strikeAt[k] = barAt + k * bd; st.scheduled[k] = false; }
  st.fourthBeat = Math.round((st.strikeAt[STRIKES - 1] - startAt()) / bd);
  st.windowUntil = st.strikeAt[STRIKES - 1] + (cfg().windowAfterSec || DEFAULTS.windowAfterSec);
  st.ringing = true; st.lit = 0; st.answered = false; st.minute = minute; st.rings++;
  ringPayload.minute = minute; ringPayload.at = barAt;
  bus.emit('bell:ring', ringPayload);
}

function onMinute(e) {
  if (!st.run) return;
  if (e.minute >= lastMinute()) { st.lastRung = true; return; }   // la dernière cloche a sonné (ou sonne) avant le boss
  ring(e.minute);
}

function onParry() {
  if (!st.ringing || st.answered || !st.run || st.run.finished) return;
  const j = judge(pressedAt('parry'));
  if (j.beat !== st.fourthBeat || j.grade === 'rate') return;
  st.answered = true; st.answerT = ANSWER_SHOW; st.grade = j.grade; st.answers++;
  st.bonus = bonusFor(st.minute);
  st.effect = applyBonus(st.bonus);
  answerPayload.minute = st.minute; answerPayload.grade = j.grade; answerPayload.bonus = st.bonus; answerPayload.effect = st.effect;
  bus.emit('bell:answered', answerPayload);
}

/** Applique le bonus ; renvoie l'effet réellement produit ('heal' quand +1 cran est converti en soin). */
function applyBonus(bonus) {
  const p = st.player, run = st.run, world = st.world, B = cfg();
  switch (bonus) {
    case 'heal': if (p) healPlayer(p, Math.ceil(p.maxHp * (B.healPct || DEFAULTS.healPct))); return 'heal';
    case 'resonance':
      if (resonanceTier() >= maxTierIndex()) { if (p) healPlayer(p, Math.ceil(p.maxHp * (B.maxTierHealPct || DEFAULTS.maxTierHealPct))); return 'heal'; }
      resonanceBump(1); return 'resonance';
    case 'card': grantBonusLevel(run); return 'card';
    case 'bronze': { const parish = parishDef(run.parishId); if (world) world.bronzePicked += parish ? parish.bronzeReward : 0; return 'bronze'; }
  }
  return bonus;
}

/** Tick logique (game.updateGame) : dernière cloche avant le boss, planification des coups, fenêtre. */
export function updateBellHour(dt) {
  if (st.answerT > 0) st.answerT -= dt;
  // Dernière cloche : lastLeadSec avant l'arrivée du boss, hors de son intro.
  if (!st.lastRung && st.world && !st.ringing && st.world.time >= bossAt() - (cfg().lastLeadSec || DEFAULTS.lastLeadSec)) {
    st.lastRung = true;
    if (!st.world.boss && !st.world.ended) ring(lastMinute());
  }
  if (st.pending && !st.ringing && isRunning()) ring(st.pending);
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
