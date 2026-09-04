// game/resonance.js — la jauge de Résonance, le hook du jeu (ARCHITECTURE.md § 11, PROMPT § 1).
// Jauge à 4 crans (×1 → ×1.4 → ×1.8 → ×2.5). Chaque frappe rythmique (Volée, Contre-battement)
// ajoute ou retire des « pas » de valeur : parfait +2, bon +1, raté −1.5. Un cran = N pas
// (balance.resonance.stepsPerTier). Sans action rythmique pendant 4 temps, la jauge décroît
// d'un pas par temps. Modes d'assistance : 'assisted' (fenêtre ×3, appliquée par player.js via
// assistWindowMult()) et 'norhythm' (cran fixe, aucune montée ni descente).
// Les Ouateux bloquent la jauge (block) : aucun gain pendant la durée.

import { bus } from '../core/events.js';
import { beatDuration } from '../audio/conductor.js';
import { play as playSfx } from '../audio/sfx.js';
import { balance } from './data.js';

const st = {
  assist: 'none',
  raw: 0,            // valeur continue en pas (0 .. stepsPerTier × 4)
  tier: 0,
  sinceInput: 0,     // secondes depuis la dernière action rythmique
  blockT: 0,         // secondes de blocage restantes (Ouateux)
  gain: 1,           // multiplicateur de gain (stat resonanceGain du sonneur)
  maxTimeSec: 0,     // temps cumulé passé au cran maximal (Feuillet f19)
  perfectStreak: 0,
  decayMult: 1,      // Relique « Oreille du Maître » : décroissance ×2
  cfg: null,
};

const payload = { tier: 0, mult: 1, value: 0, direction: 1 }; // réutilisé, jamais réalloué
const SFX_TIER = ['resonance_1', 'resonance_2', 'resonance_3', 'resonance_4'];

function cfg() { return st.cfg || (st.cfg = balance().resonance); }
function maxRaw() { return cfg().stepsPerTier * cfg().mults.length; }

/** Initialise la jauge pour une run. assist ∈ 'none' | 'assisted' | 'norhythm'. */
export function initResonance({ assist = 'none', gain = 1 } = {}) {
  st.cfg = balance().resonance;
  st.assist = assist;
  st.gain = gain;
  st.sinceInput = 0; st.blockT = 0; st.maxTimeSec = 0; st.perfectStreak = 0; st.decayMult = 1;
  st.raw = assist === 'norhythm' ? cfg().norhythmTier * cfg().stepsPerTier : 0;
  st.tier = Math.min(cfg().mults.length - 1, Math.floor(st.raw / cfg().stepsPerTier));
  emitChange(1);
}

/** Multiplicateur de fenêtre de jugement dû à l'assistance (player.js l'applique à conductor.setWindowMs). */
export function assistWindowMult() { return st.assist === 'assisted' ? cfg().assistedWindowMult : 1; }
export function assist() { return st.assist; }

function emitChange(direction) {
  const c = cfg();
  payload.tier = st.tier;
  payload.mult = c.mults[st.tier];
  payload.value = value();
  payload.direction = direction;
  bus.emit('resonance:change', payload);
}

function setRaw(next, direction) {
  const c = cfg();
  const cap = maxRaw();
  if (next < 0) next = 0;
  if (next > cap) next = cap;
  st.raw = next;
  const t = Math.min(c.mults.length - 1, Math.floor(st.raw / c.stepsPerTier));
  const old = st.tier;
  st.tier = t;
  if (t > old) playSfx(SFX_TIER[t]);
  else if (t < old) playSfx('resonance_drop');
  emitChange(t > old ? 1 : t < old ? -1 : direction);
}

/**
 * Applique un jugement rythmique ('parfait' | 'bon' | 'rate'). charge = false : action sans menace
 * proche (player.js) — la frappe compte pour le tempo (pas de décroissance) mais ne charge ni ne vide
 * la jauge : impossible de saturer la Résonance en parant dans le vide.
 */
export function onRhythmInput(grade, charge = true) {
  const c = cfg();
  st.sinceInput = 0;
  if (grade === 'parfait') st.perfectStreak++; else st.perfectStreak = 0;
  if (st.assist === 'norhythm' || !charge) return;
  if (grade === 'rate') { setRaw(st.raw - c.lossRate, -1); return; }
  if (st.blockT > 0) return; // jauge étouffée par un Ouateux : pas de gain
  const g = (grade === 'parfait' ? c.gainParfait : c.gainBon) * st.gain;
  setRaw(st.raw + g, 1);
}

/** Multiplicateur de la décroissance (Relique). */
export function setDecayMult(m) { st.decayMult = m > 0 ? m : 1; }

/** Ajoute `tiers` crans entiers (réponse à la cloche) ; sans effet en 'norhythm'. */
export function bump(tiers = 1) {
  if (st.assist === 'norhythm') return;
  st.sinceInput = 0;
  setRaw(st.raw + cfg().stepsPerTier * tiers, 1);
}

/** Cran courant 0..3. */
export function tier() { return st.tier; }
/** Multiplicateur de dégâts du cran courant. */
export function mult() { return cfg().mults[st.tier]; }
/** Remplissage 0..1 à l'intérieur du cran courant (1 au cran max plein). */
export function value() {
  const c = cfg();
  if (st.tier >= c.mults.length - 1) return Math.min(1, (st.raw - st.tier * c.stepsPerTier) / c.stepsPerTier);
  return (st.raw - st.tier * c.stepsPerTier) / c.stepsPerTier;
}
/** Valeur brute normalisée 0..1 sur toute la jauge (HUD). */
export function total() { return st.raw / maxRaw(); }
export function isBlocked() { return st.blockT > 0; }
export function perfectStreak() { return st.perfectStreak; }
/** Secondes cumulées au cran maximal (déblocage de Feuillet). */
export function maxTierTime() { return st.maxTimeSec; }

/** Bloque les gains pendant sec secondes (nuage d'Ouateux). */
export function block(sec) { if (sec > st.blockT) st.blockT = sec; }

/** Tick logique : décroissance et compteurs. */
export function update(dt) {
  const c = cfg();
  if (st.blockT > 0) st.blockT -= dt;
  if (st.tier >= c.mults.length - 1) st.maxTimeSec += dt;
  if (st.assist === 'norhythm') return;
  st.sinceInput += dt;
  const beat = beatDuration() || 0.625;
  if (st.sinceInput > c.decayAfterBeats * beat && st.raw > 0) {
    // Décroissance continue mais émission limitée : au changement de cran ou 4 fois par seconde.
    const before = st.tier;
    st.raw = Math.max(0, st.raw - c.decayPerBeat * st.decayMult * dt / beat);
    const t = Math.min(c.mults.length - 1, Math.floor(st.raw / c.stepsPerTier));
    st.emitAcc = (st.emitAcc || 0) + dt;
    if (t !== before) { st.emitAcc = 0; setRaw(st.raw, -1); }
    else if (st.emitAcc >= 0.25) { st.emitAcc = 0; emitChange(-1); }
  }
}

/** Remise à zéro complète (fin de run). */
export function resetResonance() { st.raw = 0; st.tier = 0; st.blockT = 0; st.sinceInput = 0; }
