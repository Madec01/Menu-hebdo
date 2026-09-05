// audio/jingles.js — les jingles (crans de Résonance, niveau, haut-fait, fusion, Feuillet, victoire), la
// levée de Moment et le grelot des Échos sont REJOUÉS PAR LE SAMPLER sur l'accord courant de la partition
// (music.chordAtTime) : plus de fichiers figés en majeur dans un jeu en mode mineur. sfx.play() délègue ici
// quand l'identifiant est connu et les instruments chargés ; sinon il joue le fichier du manifeste (repli).
// Tout est échantillonné (hand_chimes, tubular_bells, bell_tree, sleigh_bells, gong, finger_cymbals,
// woodblock) ; aucune synthèse.
//   load(manifest) → Promise<boolean>   ready()   handles(id)   play(id, { gain, at, pan, volume }) → boolean
// Chaque note : { i: instrument, d: degré de l'accord (1 fondamentale, 3, 5, 8 octave, 10, 12), o: octave,
// t: décalage (s) ou tb: décalage en temps de la Mesure, g: gain, k: clé de percussion, dur: durée (s) }.
import { busNode, ctx, now } from './audio.js';
import * as conductor from './conductor.js';
import { createInstrument } from './sampler.js';
import { degreeToMidi, midiToName } from './harmony.js';
import * as music from './music.js';

const RELEASE = 0.3;
const PICKUP_DEGREES = [8, 10, 12];       // trois variantes : octave, tierce et quinte au-dessus
const HC = 'hand_chimes', TB = 'tubular_bells', BT = 'bell_tree', SB = 'sleigh_bells';
const STROKE = 'stroke', HIT = 'hit', SOFT = 'soft', SHAKE = 'shake';

const JINGLES = {
  resonance_1: [{ i: TB, d: 1, o: 4, t: 0, g: 0.6 }],
  resonance_2: [{ i: TB, d: 1, o: 4, t: 0, g: 0.55 }, { i: HC, d: 1, o: 5, t: 0.06, g: 0.4 }, { i: HC, d: 5, o: 5, t: 0.12, g: 0.4 }],
  resonance_3: [{ i: TB, d: 5, o: 4, t: 0, g: 0.5 }, { i: HC, d: 1, o: 5, t: 0.02, g: 0.4 }, { i: HC, d: 3, o: 5, t: 0.07, g: 0.4 }, { i: HC, d: 5, o: 5, t: 0.12, g: 0.4 }],
  resonance_4: [{ i: TB, d: 1, o: 4, t: 0, g: 0.55 }, { i: TB, d: 1, o: 5, t: 0.04, g: 0.4 }, { i: HC, d: 1, o: 5, t: 0.02, g: 0.38 }, { i: HC, d: 3, o: 5, t: 0.07, g: 0.38 }, { i: HC, d: 5, o: 5, t: 0.12, g: 0.38 }, { i: HC, d: 8, o: 5, t: 0.17, g: 0.38 }, { i: BT, k: STROKE, t: 0.1, g: 0.3 }],
  level_up: [{ i: HC, d: 1, o: 4, t: 0, g: 0.45 }, { i: HC, d: 3, o: 4, t: 0.09, g: 0.45 }, { i: HC, d: 5, o: 4, t: 0.18, g: 0.45 }, { i: HC, d: 8, o: 4, t: 0.27, g: 0.5 }, { i: BT, k: STROKE, t: 0.3, g: 0.28 }],
  achievement: [{ i: HC, d: 5, o: 4, t: 0, g: 0.42 }, { i: HC, d: 8, o: 4, t: 0.08, g: 0.42 }, { i: HC, d: 10, o: 4, t: 0.16, g: 0.42 }, { i: HC, d: 12, o: 4, t: 0.24, g: 0.46 }, { i: 'finger_cymbals', k: HIT, t: 0.24, g: 0.3 }],
  fusion: [{ i: 'gong', k: SOFT, t: 0, g: 0.45 }, { i: TB, d: 1, o: 4, t: 0.05, g: 0.5 }, { i: TB, d: 5, o: 4, t: 0.35, g: 0.45 }, { i: BT, k: STROKE, t: 0.2, g: 0.3 }],
  lore_unlock: [{ i: 'woodblock', k: SOFT, t: 0, g: 0.3 }, { i: HC, d: 1, o: 4, t: 0.02, g: 0.35 }, { i: HC, d: 5, o: 4, t: 0.14, g: 0.3 }],
  victory_bell: [{ i: TB, d: 1, o: 4, t: 0, g: 0.6 }, { i: TB, d: 3, o: 4, t: 0.3, g: 0.55 }, { i: TB, d: 5, o: 4, t: 0.6, g: 0.55 }, { i: TB, d: 8, o: 4, t: 0.9, g: 0.65 }, { i: BT, k: STROKE, t: 0.9, g: 0.32 }, { i: HC, d: 8, o: 5, t: 1.2, g: 0.4 }, { i: HC, d: 10, o: 5, t: 1.3, g: 0.4 }, { i: HC, d: 12, o: 5, t: 1.4, g: 0.42 }],
  // levée courte d'un Moment : grelots + deux clochettes en croches (dominante → tonique)
  moment_start: [{ i: SB, k: SHAKE, t: 0, g: 0.35 }, { i: HC, d: 5, o: 5, t: 0, g: 0.35 }, { i: HC, d: 8, o: 5, tb: 0.5, g: 0.45 }],
  // grelot bref d'un Écho ramassé : calé sur la double-croche suivante, un seul par double-croche, trois hauteurs
  pickup: [{ i: SB, k: HIT, t: 0, g: 0.22, dur: 0.35 }, { i: HC, d: 'pickup', o: 5, t: 0, g: 0.3, dur: 0.45 }],
};
JINGLES.xp_pickup = JINGLES.pickup;
const QUANTIZED = { pickup: 0.25, xp_pickup: 0.25, moment_start: 0.5 };   // subdivision de la grille

let insts = null;                        // nom → Instrument
let loading = null;
let pickupIdx = 0;
let lastPickupAt = -1;

/** Charge les instruments nécessaires (une fois ; false si le manifeste ne les a pas). */
export function load(manifest) {
  if (loading) return loading;
  loading = (async () => {
    try {
      const names = new Set();
      for (const notes of Object.values(JINGLES)) for (const n of notes) names.add(n.i);
      const made = {};
      for (const name of names) {
        if (!manifest.samples || !manifest.samples[name]) throw new Error(`jingles: instrument inconnu « ${name} »`);
        made[name] = createInstrument(manifest.samples[name]);
      }
      await Promise.all(Object.values(made).map((i) => i.load()));
      insts = made;
      return true;
    } catch (e) {
      console.warn('[jingles] repli sur les fichiers :', e && e.message ? e.message : e);
      return false;
    }
  })();
  return loading;
}

export function ready() { return Boolean(insts && ctx()); }
export function handles(id) { return Object.prototype.hasOwnProperty.call(JINGLES, id); }
export function list() { return Object.keys(JINGLES); }

/** Joue le jingle `id` sur l'accord courant. `gain` multiplie les gains des notes ; `at` (temps audio)
 *  facultatif ; les identifiants quantifiés sont calés sur la grille de la Mesure. Renvoie false si le
 *  jingle n'a pas pu être pris en charge (l'appelant joue alors le fichier). */
export function play(id, { gain = 1, at = null, pan = 0, bus = 'sfx' } = {}) {
  const notes = JINGLES[id];
  const ac = ctx();
  if (!notes || !insts || !ac) return false;
  const bd = conductor.beatDuration() || 0.625;
  let t0 = at === null ? ac.currentTime : Math.max(at, ac.currentTime);
  const q = QUANTIZED[id];
  if (q && conductor.isRunning()) {
    t0 = conductor.nextBeatAt(q);
    if (t0 - ac.currentTime < 0.02) t0 += q * bd;
  }
  if (id === 'pickup' || id === 'xp_pickup') {
    if (Math.abs(t0 - lastPickupAt) < 1e-3) return true;      // un grelot par double-croche
    lastPickupAt = t0;
    pickupIdx = (pickupIdx + 1) % PICKUP_DEGREES.length;
  }
  const chord = music.chordAtTime(t0);
  const dest = busNode(bus);
  for (const n of notes) {
    const inst = insts[n.i];
    if (!inst) continue;
    const when = t0 + (n.tb !== undefined ? n.tb * bd : n.t || 0);
    const opts = { gain: n.g * gain, pan, dest, release: RELEASE, duration: n.dur === undefined ? null : n.dur };
    if (n.k) inst.play(n.k, when, opts);
    else {
      const deg = n.d === 'pickup' ? PICKUP_DEGREES[pickupIdx] : n.d;
      inst.play(midiToName(degreeToMidi(chord, deg, n.o)), when, opts);
    }
  }
  return true;
}
