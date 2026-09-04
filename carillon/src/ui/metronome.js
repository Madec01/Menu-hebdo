// ui/metronome.js — indicateur de rythme audio (option beatIndicator 'audio' |
// 'both') : un woodblock échantillonné (manifeste audio) planifié sur chaque
// temps par conductor.schedule, accent sur le premier temps de la mesure. Bus
// 'ui' pour rester discret sous la musique.

import { createInstrument } from '../audio/sampler.js';
import * as conductor from '../audio/conductor.js';

let instrument = null, unschedule = null, ready = false;

/** Prépare l'instrument (décodage) ; sans échantillon woodblock, l'indicateur audio reste muet. */
export async function initMetronome(audioManifest) {
  const def = audioManifest && audioManifest.samples ? audioManifest.samples.woodblock : null;
  if (!def) return;
  instrument = createInstrument(def);
  try { await instrument.load(); ready = true; } catch (e) { console.warn('[metronome]', e); }
}

/** Démarre le tic sur la grille (idempotent). */
export function startMetronome() {
  if (!ready || unschedule) return;
  unschedule = conductor.schedule(1, (at, beat) => {
    const first = (beat % conductor.beatsPerBar()) === 0;
    instrument.play(first ? 'hit' : 'soft', at, { gain: first ? 0.7 : 0.45, bus: 'ui' });
  });
}

export function stopMetronome() { if (unschedule) { unschedule(); unschedule = null; } }
export function metronomeRunning() { return unschedule !== null; }
