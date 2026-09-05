// audio/music-score.js — compilation d'une partition JSON (§ 9.3, étendue vague « approfondissement »)
// en sections prêtes à séquencer. Fonctions pures, sans AudioContext : testables sous Node.
//
// Partition : { bpm, beatsPerBar, bars, key, mode, chords[], layers[] }  = section A (boucle principale)
//   + facultatif :
//   intro    { bars, chords?, layers[] }  levée jouée une fois au départ de la piste (boss : 2 mesures)
//   bridge   { bars, chords?, layers[] }  pont inséré à la mesure suivante sur demande (Fêlure : 4 mesures)
//   sectionB { bars, chords?, layers[] }  alternée avec A quand le palier de Sourdine ≥ 4 (8 mesures)
//   allLayers: true                        toutes les couches jouent quel que soit le cran (menu, hub, bilan)
//   followsTier: false                     le tempo n'est pas relevé de +2 bpm par palier (boss, bilan, menu)
//   melodic: ["vielle"]                    couches désaccordables par l'ennemi désaccordeur (défaut : tier 2)
// Chaque couche : { tier 0..3, name, instrument, gain, intensityGain?, minIntensity?, events? | pattern? }.
// Une couche de section porte en plus `section` ('A' | 'B' | 'bridge' | 'intro') et son indice global `li`.
import { chordsOf } from './harmony.js';

export const STEP = 0.25;                 // résolution de la grille : double-croche
const LONG_NOTE_BEATS = 2;                // notes tenues rattrapées quand une couche s'ouvre

/** Aplatit les couches d'une section : pour chaque double-croche, la liste des notes à jouer. */
function bucketize(layers, bars, beatsPerBar) {
  const loopBeats = bars * beatsPerBar;
  const buckets = new Map();
  const longEvents = new Map();            // li → [{ start, dur, note, gain }]
  const push = (beat, ev) => {
    const k = Math.round(beat / STEP);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(ev);
  };
  for (const layer of layers) {
    const li = layer.li;
    for (const e of layer.events || []) {
      const start = e.bar * beatsPerBar + e.beat;
      push(start, { li, note: e.note, dur: e.dur, gain: e.gain ?? 1 });
      if (e.dur !== null && e.dur !== undefined && e.dur >= LONG_NOTE_BEATS) {
        if (!longEvents.has(li)) longEvents.set(li, []);
        longEvents.get(li).push({ start, dur: e.dur, note: e.note, gain: e.gain ?? 1 });
      }
    }
    if (layer.pattern) {
      const rep = layer.repeatBars || 1;
      const stepBeats = (beatsPerBar * rep) / layer.pattern.steps;
      for (let b = 0; b < bars; b += rep) {
        for (const [key, step, g] of layer.pattern.hits) push(b * beatsPerBar + step * stepBeats, { li, note: key, dur: null, gain: g ?? 1 });
      }
    }
  }
  return { buckets, loopBeats, longEvents };
}

function section(name, def, score, layers) {
  const bars = def.bars;
  const chords = chordsOf({ key: score.key, mode: score.mode, bars, chords: def.chords && def.chords.length ? def.chords : score.chords });
  return { name, bars, chords, ...bucketize(layers, bars, score.beatsPerBar) };
}

/**
 * Compile une partition : { layers (toutes sections, indice global li), sections {A, B?, bridge?, intro?},
 * instrumentNames, melodicLayers (Set de li), allLayers, followsTier }.
 */
export function compileScore(score) {
  const layers = [];
  const add = (list, sec) => { const out = []; for (const l of list || []) { const L = { ...l, section: sec, li: layers.length }; layers.push(L); out.push(L); } return out; };
  const a = add(score.layers, 'A');
  const sections = { A: section('A', { bars: score.bars, chords: score.chords }, score, a) };
  if (score.sectionB && score.sectionB.layers) sections.B = section('B', score.sectionB, score, add(score.sectionB.layers, 'B'));
  if (score.bridge && score.bridge.layers) sections.bridge = section('bridge', score.bridge, score, add(score.bridge.layers, 'bridge'));
  if (score.intro && score.intro.layers) sections.intro = section('intro', score.intro, score, add(score.intro.layers, 'intro'));
  const instrumentNames = Array.from(new Set(layers.map((l) => l.instrument)));
  const melodicNames = Array.isArray(score.melodic) ? new Set(score.melodic) : null;
  const melodicLayers = new Set(layers.filter((l) => (melodicNames ? melodicNames.has(l.name) : l.tier === 2 && l.events)).map((l) => l.li));
  return { layers, sections, instrumentNames, melodicLayers, allLayers: Boolean(score.allLayers), followsTier: score.followsTier !== false };
}

/** Gain cible d'une couche pour `n` couches ouvertes (1..4) et une intensité effective 0..1. */
export function layerTarget(layer, n, intensity, allLayers = false) {
  if (!allLayers && layer.tier >= n) return 0;
  if (!allLayers && layer.minIntensity !== undefined && intensity < layer.minIntensity) return 0;
  const g = layer.gain ?? 1;
  return layer.intensityGain ? g * (layer.intensityGain[0] + (layer.intensityGain[1] - layer.intensityGain[0]) * intensity) : g;
}

/** Section suivante quand la section courante s'achève. */
export function nextSectionName(current, sections, alternateB) {
  if (current === 'intro' || current === 'bridge') return 'A';
  if (current === 'A') return alternateB && sections.B ? 'B' : 'A';
  return 'A';
}

/** Intensité effective : le palier de Sourdine relève l'intensité de base (+0,08 par palier au-delà du 1er),
 *  sans toucher aux accalmies (< 0,3) ni dépasser 1. */
export function effectiveIntensity(intensity, tier) {
  if (intensity < 0.3) return intensity;
  return Math.min(1, intensity + 0.08 * Math.max(0, tier - 1));
}
