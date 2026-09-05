// game/resonance.js — la jauge de Résonance, le hook du jeu (ARCHITECTURE.md § 11, § 8 bis, PROMPT § 1).
// Jauge à 4 crans (×1 → ×1.4 → ×1.8 → ×2.5). Chaque frappe rythmique (Volée, Contre-battement)
// ajoute ou retire des « pas » de valeur : parfait +2, bon +1. Un cran = N pas
// (balance.resonance.stepsPerTier). Résonance STRICTE (§ 8 bis) :
//   · un « raté » fait perdre un cran immédiatement, à tout cran : la jauge retombe juste sous la limite
//     du cran (un « bon » le rend) — sauf au cran maximal, d'où l'on retombe au DÉBUT du cran 2 ; au cran 0
//     (rien à perdre) : −lossRate pas ;
//   · le cran maximal ne se TIENT qu'avec des « parfait » : un « bon » au cran 3 n'ajoute rien et ne
//     retient pas la décroissance (en mode 'assisted', un « bon » y compte comme un parfait) ;
//   · sans action rythmique chargée pendant decayAfterBeats temps, la jauge décroît d'un pas par temps
//     (suspendu par holdDecay : l'Accalmie, où il n'y a rien à frapper) ;
//   · `resonance:streak {count}` : Parfaits consécutifs ; à streakBonusAt (8) et au-delà, bonus de zone
//     +streakAreaBonus (10 %) tant que la streak dure (annoncé par `streakBonus` dans resonance:change,
//     appliqué par player.recomputeStats via areaBonus()).
// Modes d'assistance : 'assisted' (fenêtre ×3, appliquée par player.js via assistWindowMult()) et
// 'norhythm' (cran fixe, aucune montée ni descente).
// Traits des sonneurs (characters.json `traits`) : perfectOnly/perfectTiers (Le Muet : seuls les Parfaits
// chargent, mais de perfectTiers crans), resonanceDecay (Maren : décroissance ×1,5 ; son gain ×2 est la
// stat resonanceGain). Relique « Oreille du Maître » : setDecayMult(2) = décroissance ×2 ET délai ÷2.
// Les Ouateux bloquent la jauge (block) : aucun gain pendant la durée.

import { bus } from '../core/events.js';
import { beatDuration } from '../audio/conductor.js';
import { play as playSfx } from '../audio/sfx.js';
import { balance } from './data.js';

const st = {
  assist: 'none',
  raw: 0,            // valeur continue en pas (0 .. stepsPerTier × 4)
  tier: 0,
  sinceInput: 0,     // secondes depuis la dernière action rythmique qui tient la jauge
  blockT: 0,         // secondes de blocage restantes (Ouateux)
  gain: 1,           // multiplicateur de gain (stat resonanceGain du sonneur)
  maxTimeSec: 0,     // temps cumulé passé au cran maximal (Feuillet f19)
  perfectStreak: 0,
  streakBonusOn: false,
  decayMult: 1,      // Relique « Oreille du Maître » : décroissance ×2
  charDecay: 1,      // trait du sonneur (Maren ×1,5)
  perfectOnly: false, // trait du Muet
  perfectTiers: 0,
  holdT: 0,          // secondes sans décroissance (Accalmie : rien à frapper, la jauge ne tombe pas)
  emitAcc: 0,
  cfg: null,
};

const payload = { tier: 0, mult: 1, value: 0, direction: 1, streakBonus: 0 }; // réutilisé, jamais réalloué
const streakPayload = { count: 0 };
const SFX_TIER = ['resonance_1', 'resonance_2', 'resonance_3', 'resonance_4'];

function cfg() { return st.cfg || (st.cfg = balance().resonance); }
function maxTier() { return cfg().mults.length - 1; }
function maxRaw() { return cfg().stepsPerTier * cfg().mults.length; }

/**
 * Initialise la jauge pour une run. assist ∈ 'none' | 'assisted' | 'norhythm'.
 * gain : stat resonanceGain du sonneur ; traits : characters.json `traits` (ou null).
 */
export function initResonance({ assist = 'none', gain = 1, traits = null } = {}) {
  st.cfg = balance().resonance;
  st.assist = assist;
  st.gain = gain;
  st.sinceInput = 0; st.blockT = 0; st.maxTimeSec = 0; st.perfectStreak = 0; st.streakBonusOn = false; st.decayMult = 1; st.emitAcc = 0; st.holdT = 0;
  st.charDecay = traits && traits.resonanceDecay > 0 ? traits.resonanceDecay : 1;
  st.perfectOnly = !!(traits && traits.perfectOnly);
  st.perfectTiers = traits && traits.perfectTiers > 0 ? traits.perfectTiers : 0;
  st.raw = assist === 'norhythm' ? cfg().norhythmTier * cfg().stepsPerTier : 0;
  st.tier = Math.min(maxTier(), Math.floor(st.raw / cfg().stepsPerTier));
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
  payload.streakBonus = areaBonus();
  bus.emit('resonance:change', payload);
}

function setRaw(next, direction) {
  const c = cfg();
  const cap = maxRaw();
  if (next < 0) next = 0;
  if (next > cap) next = cap;
  st.raw = next;
  const t = Math.min(maxTier(), Math.floor(st.raw / c.stepsPerTier));
  const old = st.tier;
  st.tier = t;
  if (t > old) playSfx(SFX_TIER[t]);
  else if (t < old) playSfx('resonance_drop');
  emitChange(t > old ? 1 : t < old ? -1 : direction);
}

/** Streak de Parfaits : compteur, événement, bonus de zone (émis dans resonance:change au franchissement). */
function setStreak(n) {
  if (n === st.perfectStreak) return;
  st.perfectStreak = n;
  streakPayload.count = n;
  bus.emit('resonance:streak', streakPayload);
  const on = n >= (cfg().streakBonusAt || 8);
  if (on !== st.streakBonusOn) { st.streakBonusOn = on; emitChange(on ? 1 : -1); }
}

/**
 * Applique un jugement rythmique ('parfait' | 'bon' | 'rate'). charge = false : action qui ne porte pas
 * (Volée sans menace proche, parade qui n'a rien paré) — la frappe est jugée pour le retour visuel mais
 * ne charge ni ne vide la jauge, ne compte pas dans la streak et ne retient PAS la décroissance : seule
 * une frappe qui porte tient la Mesure (sinon la parade à vide sur chaque temps tiendrait le cran acquis).
 */
export function onRhythmInput(grade, charge = true) {
  const c = cfg();
  const atMax = st.tier >= maxTier();
  if (st.assist === 'norhythm') { st.sinceInput = 0; return; }
  if (!charge) return;
  if (grade === 'rate') {
    setStreak(0);
    st.sinceInput = 0;
    // Un raté = perte d'un cran immédiate : sous la limite du cran courant (lossRate pas, au moins la
    // limite − 1) ; au cran maximal, retour au début du cran précédent (le sommet exige des Parfaits).
    const floor = st.tier * c.stepsPerTier;
    if (atMax) setRaw(floor - c.stepsPerTier, -1);
    else if (st.tier === 0) setRaw(st.raw - c.lossRate, -1);   // rien à perdre : simple recul
    else setRaw(Math.min(st.raw - c.lossRate, floor - 1), -1);
    return;
  }
  let perfect = grade === 'parfait';
  if (st.assist === 'assisted' && atMax) perfect = true;   // assisté : le cran 3 se tient aussi avec des « bon »
  setStreak(grade === 'parfait' ? st.perfectStreak + 1 : 0);
  if (st.perfectOnly && !perfect) return;                   // Le Muet : un « bon » ne fait rien
  if (atMax && !perfect) return;                            // cran max : un « bon » n'ajoute ni ne retient rien
  if (st.blockT > 0) return; // jauge étouffée par un Ouateux : ni gain ni maintien (la décroissance court)
  st.sinceInput = 0;
  let g;
  if (st.perfectOnly && st.perfectTiers > 0) g = st.perfectTiers * c.stepsPerTier * st.gain;
  else g = (perfect ? c.gainParfait : c.gainBon) * st.gain;
  setRaw(st.raw + g, 1);
}

/** Multiplicateur de la décroissance (Relique « Oreille du Maître » : ×2 = plus vite ET plus tôt). */
export function setDecayMult(m) { st.decayMult = m > 0 ? m : 1; }

/** Ajoute `tiers` crans entiers (réponse à la cloche) ; sans effet en 'norhythm'. */
export function bump(tiers = 1) {
  if (st.assist === 'norhythm') return;
  st.sinceInput = 0;
  setRaw(st.raw + cfg().stepsPerTier * tiers, 1);
}

/** Cran courant 0..3. */
export function tier() { return st.tier; }
/** Cran maximal (index). */
export function maxTierIndex() { return maxTier(); }
/** Multiplicateur de dégâts du cran courant. */
export function mult() { return cfg().mults[st.tier]; }
/** Remplissage 0..1 à l'intérieur du cran courant (1 au cran max plein). */
export function value() {
  const c = cfg();
  if (st.tier >= maxTier()) return Math.min(1, (st.raw - st.tier * c.stepsPerTier) / c.stepsPerTier);
  return (st.raw - st.tier * c.stepsPerTier) / c.stepsPerTier;
}
/** Valeur brute normalisée 0..1 sur toute la jauge (HUD). */
export function total() { return st.raw / maxRaw(); }
export function isBlocked() { return st.blockT > 0; }
export function perfectStreak() { return st.perfectStreak; }
/** Bonus de zone dû à la streak de Parfaits (0 ou streakAreaBonus). */
export function areaBonus() { return st.streakBonusOn ? (cfg().streakAreaBonus || 0) : 0; }
/** Secondes cumulées au cran maximal (déblocage de Feuillet). */
export function maxTierTime() { return st.maxTimeSec; }

/** Bloque les gains pendant sec secondes (nuage d'Ouateux). */
export function block(sec) { if (sec > st.blockT) st.blockT = sec; }
/** Suspend la décroissance pendant sec secondes (Accalmie : aucune menace à frapper). */
export function holdDecay(sec) { if (sec > st.holdT) st.holdT = sec; }

/** Tick logique : décroissance et compteurs. */
export function update(dt) {
  const c = cfg();
  if (st.blockT > 0) st.blockT -= dt;
  if (st.tier >= maxTier()) st.maxTimeSec += dt;
  if (st.assist === 'norhythm') return;
  if (st.holdT > 0) { st.holdT -= dt; st.sinceInput = 0; return; }
  st.sinceInput += dt;
  const beat = beatDuration() || 0.625;
  const decay = st.decayMult * st.charDecay;
  if (st.sinceInput > c.decayAfterBeats * beat / decay && st.raw > 0) {
    // Décroissance continue mais émission limitée : au changement de cran ou 4 fois par seconde.
    const before = st.tier;
    st.raw = Math.max(0, st.raw - c.decayPerBeat * decay * dt / beat);
    const t = Math.min(maxTier(), Math.floor(st.raw / c.stepsPerTier));
    st.emitAcc += dt;
    if (t !== before) { st.emitAcc = 0; setRaw(st.raw, -1); }
    else if (st.emitAcc >= 0.25) { st.emitAcc = 0; emitChange(-1); }
  }
}

/** Remise à zéro complète (fin de run). */
export function resetResonance() { st.raw = 0; st.tier = 0; st.blockT = 0; st.sinceInput = 0; st.perfectStreak = 0; st.streakBonusOn = false; }
