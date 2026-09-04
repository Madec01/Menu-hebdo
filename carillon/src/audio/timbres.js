// audio/timbres.js — les Timbres CHANTENT. Chaque arme a une voix (src/data/music/timbres.json) :
// un instrument échantillonné, un registre, des motifs d'arpège sur l'accord courant de la partition
// (music.chordAtTime) et une règle d'accent. Le tir n'est pas un bruitage d'impact : c'est une note de
// la musique, calée sur la grille (`at` exact), jamais hors gamme, et différente d'une mesure à l'autre.
//
// API
//   loadTimbres() → Promise<boolean>      charge timbres.json et les instruments (auto sur `audio:unlocked`)
//   isReady() → boolean
//   playTimbre(weaponId, { at, x, y, rhythm = 1, tier = 0, level = 1, big = false, fusion = false }) → boolean
//       true  = le tir a été pris en charge (note jouée, ou tu volontairement par le mélangeur)
//       false = pas de voix disponible → l'appelant joue le bruitage `sfx` de repli
//       · note = degré du motif (choisi par mesure, jamais deux mesures identiques d'affilée) sur l'accord
//         de la mesure de `at`, transposé dans le registre de la voix ; accent temps 1 fort, 3 moyen, 2/4 doux,
//         contretemps (croches) plus doux encore ;
//       · tier ≥ 2 : appoggiature avant la note sur les temps accentués ; tier 3 : tierce ou quinte ajoutée ;
//       · fusions : accord de 2–3 notes (champ `chord`), légèrement égrené (`strum`) ;
//       · mélange : ≤ maxVoicesPerBeat voix tonales par point de grille ; au-delà, les armes les moins
//         prioritaires (timbres.json `priority`) ne chantent qu'une mesure sur deux, atténuées.
//   timbresNode() → GainNode | null       sortie des voix (avant le bus sfx) — tests / analyse
//   setTimbresVolume(v 0..1)
//   currentRoster() → [weaponId…]         armes entendues récemment, par priorité (debug HUD)
// Événement bus : `timbre:note` { weaponId, midi, at, gain, bar, degree } à chaque note planifiée.
import { bus } from '../core/events.js';
import { ctx, now, busNode } from './audio.js';
import * as conductor from './conductor.js';
import { degreeToMidi, midiToName } from './harmony.js';

const DEFAULT_DURATION_BEATS = 2;   // les cloches sonnent 2 temps puis s'éteignent en douceur (release)
const RELEASE_SEC = 0.25;
const GRACE_FRACTION = 0.25;        // double-croche avant la note (ou moins si la grille est déjà trop proche)

let cfg = null;                     // timbres.json
let voices = null;                  // weaponId → { def, inst, layerInst, sel }
let loading = null;
let deps = null;                    // { sampler, music } (imports dynamiques : les stubs de test (game/_test, tests/stubs) ne les ont pas)
let out = null;                     // { gain, comp } sortie des voix → bus sfx
const heard = new Map();            // weaponId → dernier `at` (roster du mélangeur)
const slotCount = { at: -1, n: 0 }; // voix tonales déjà planifiées sur ce point de grille

bus.on('audio:unlocked', () => { loadTimbres().catch((e) => console.warn('[timbres]', e)); });

/** Charge la configuration et pré-décode les instruments des voix. Idempotent ; false si indisponible. */
export function loadTimbres() {
  if (loading) return loading;
  loading = (async () => {
    if (typeof document === 'undefined') return false;   // simulations Node (tests/sim.mjs) : pas de voix, repli silencieux
    try {
      deps = { sampler: await import('./sampler.js'), music: await import('./music.js') };
      const [conf, manifest] = await Promise.all([
        fetch(new URL('../data/music/timbres.json', import.meta.url)).then((r) => { if (!r.ok) throw new Error(`timbres: HTTP ${r.status}`); return r.json(); }),
        deps.music.manifest(),
      ]);
      const insts = {};
      const inst = (name) => {
        if (!insts[name]) {
          if (!manifest.samples[name]) throw new Error(`timbres: instrument inconnu « ${name} »`);
          insts[name] = deps.sampler.createInstrument(manifest.samples[name]);
        }
        return insts[name];
      };
      const v = {};
      for (const [id, def] of Object.entries(conf.voices)) {
        v[id] = { def, inst: inst(def.instrument), layerInst: def.layer ? inst(def.layer.instrument) : null, sel: { bar: -1, idx: -1 } };
      }
      await Promise.all(Object.values(insts).map((i) => i.load()));
      cfg = conf; voices = v;
      return true;
    } catch (e) {
      console.warn('[timbres] voix indisponibles, repli sur les bruitages :', e && e.message ? e.message : e);
      return false;
    }
  })();
  return loading;
}

export function isReady() { return Boolean(voices && ctx()); }

function output() {
  const ac = ctx();
  const sfxBus = busNode('sfx');
  if (!ac || !sfxBus) return null;
  if (!out) {
    // sous-bus des voix : gain puis compresseur doux (jamais de saturation quand 3 cloches sonnent ensemble)
    const gain = ac.createGain();
    gain.gain.value = 0.8;             // marge : 6 Timbres + musique restent sous −1 dBFS au master
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.003; comp.release.value = 0.15;
    gain.connect(comp);
    comp.connect(sfxBus);
    out = { gain, comp };
  }
  return out.gain;
}

export function timbresNode() { return out ? out.gain : output(); }
export function setTimbresVolume(v) { const g = output(); if (g) g.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), now(), 0.02); }

// ---- Motifs : un par mesure, choisi par hachage, jamais le même que la mesure précédente ----------------

function hash(n) {
  let x = Math.imul(n + 0x9e3779b9, 0x85ebca6b) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 16;
  return x >>> 0;
}

function variantFor(v, bar, seed) {
  const n = v.def.patterns.length;
  if (n <= 1) return 0;
  const st = v.sel;
  if (st.bar > bar || bar - st.bar > 64) { st.bar = -1; st.idx = -1; }
  while (st.bar < bar) {
    st.bar++;
    const h = hash(st.bar * 131 + seed);
    st.idx = st.idx < 0 ? h % n : (st.idx + 1 + (h % (n - 1))) % n;   // pas ∈ [1, n-1] : toujours différent
  }
  return st.idx;
}

function seedOf(id) { let s = 0; for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) | 0; return s >>> 0; }

// ---- Mélangeur : roster par priorité, plafond de voix tonales par point de grille ----------------------

export function currentRoster() {
  if (!voices) return [];
  const t = now();
  const win = (cfg.ornaments.extraBars || 2) * conductor.beatsPerBar() * (conductor.beatDuration() || 0.625);
  const ids = [];
  for (const [id, at] of heard) if (t - at <= win && voices[id] && !voices[id].def.percussive) ids.push(id);
  ids.sort((a, b) => (voices[b].def.priority - voices[a].def.priority) || (a < b ? -1 : 1));
  return ids;
}

function playNote(inst, midi, at, gain, durationBeats, dest, pitchedKey = null, tuned = null) {
  const bd = conductor.beatDuration() || 0.625;
  const opts = { gain, duration: durationBeats === null ? null : durationBeats * bd, dest, release: RELEASE_SEC };
  if (pitchedKey !== null) {            // percussion « accordée » : variante + transposition par playbackRate
    opts.pitchSemis = tuned === null ? 0 : midi - tuned;
    inst.play(pitchedKey, at, opts);
  } else inst.play(midiToName(midi), at, opts);
}

/**
 * Fait chanter le Timbre `weaponId` sur le point de grille `at`. Voir l'API en tête de fichier.
 * `rhythm` = subdivision de l'arme (1 = temps, 0.5 = croche, 2 = blanche, 4 = ronde) pour lire le motif.
 */
export function playTimbre(weaponId, { at, x = null, y = null, rhythm = 1, tier = 0, level = 1, big = false, fusion = false } = {}) {
  const v = voices && voices[weaponId];
  const dest = v ? output() : null;
  if (!v || !dest || at === undefined || at === null) return false;
  const def = v.def;
  const bd = conductor.beatDuration() || 0.625;
  const bpb = conductor.beatsPerBar();
  const beatPos = conductor.isRunning() ? (at - conductor.startAt()) / bd : at / bd;
  const chord = deps.music.chordAtTime(at);
  const bar = chord.bar;
  const inBar = ((beatPos % bpb) + bpb) % bpb;
  const beatInBar = Math.floor(inBar + 1e-6);
  const offBeat = inBar - beatInBar > 0.01;
  const accent = offBeat ? cfg.accents.off : (cfg.accents.beat[beatInBar] ?? 0.7);
  const slot = Math.round(inBar / Math.max(0.125, rhythm));
  const tonal = !def.percussive;

  // roster / plafond : les armes au-delà du plafond chantent une mesure sur deux, atténuées
  heard.set(weaponId, at);
  let mix = 1;
  if (tonal) {
    const rank = currentRoster().indexOf(weaponId);
    if (rank >= cfg.maxVoicesPerBeat) {
      if (((bar + rank) & 1) !== 0) return true;
      mix = cfg.ornaments.overflowGain;
    }
    if (Math.abs(slotCount.at - at) > 0.001) { slotCount.at = at; slotCount.n = 0; }
    if (slotCount.n >= cfg.maxVoicesPerBeat) return true;
    slotCount.n++;
  }

  const pattern = def.patterns[variantFor(v, bar, seedOf(weaponId))];
  const degree = pattern[slot % pattern.length];
  const octave = def.octave ?? 5;
  const gain = def.gain * accent * mix * (1 + 0.04 * Math.max(0, level - 1)) * (big ? 1.1 : 1);
  const dur = def.duration === undefined ? DEFAULT_DURATION_BEATS : def.duration;
  const tunedKey = def.key || null;
  const midi = degreeToMidi(chord, degree, octave);
  const h = hash(bar * 7 + slot + seedOf(weaponId));

  // tier ≥ 2 : appoggiature (double-croche avant la note, ou plus court si la grille est déjà trop proche)
  if (tonal && tier >= 2 && accent >= 0.8) {
    const gDeg = degree + ((h & 1) ? -1 : 1);
    let gAt = at - bd * GRACE_FRACTION;
    if (gAt < now() + 0.01) gAt = at - bd * 0.125;
    if (gAt >= now() + 0.005) playNote(v.inst, degreeToMidi(chord, gDeg, octave), gAt, gain * cfg.ornaments.graceGain, 0.25, dest, tunedKey, def.tuned ?? null);
  }
  // note principale (ou accord des fusions, légèrement égrené)
  const tones = def.chord ? def.chord.map((c) => degree + c - 1) : [degree];
  const strum = def.strum || 0;
  tones.forEach((d, i) => {
    const m = degreeToMidi(chord, d, octave);
    playNote(v.inst, m, at + i * strum, gain * (i === 0 ? 1 : 0.8), dur, dest, tunedKey, def.tuned ?? null);
    bus.emit('timbre:note', { weaponId, midi: m, at: at + i * strum, gain, bar, degree: d });
  });
  // tier 3 : tierce ou quinte ajoutée sur les temps accentués
  if (tonal && tier >= 3 && accent >= 0.8 && !def.chord) {
    const addDeg = degree + ((h & 2) ? 2 : 4);
    const m = degreeToMidi(chord, addDeg, octave);
    playNote(v.inst, m, at + 0.012, gain * cfg.ornaments.addedGain, dur, dest, tunedKey, def.tuned ?? null);
    bus.emit('timbre:note', { weaponId, midi: m, at: at + 0.012, gain: gain * cfg.ornaments.addedGain, bar, degree: addDeg });
  }
  // couche non tonale (clochette, grelot, cliquet) ou doublure dans un autre registre
  const L = def.layer;
  if (v.layerInst && L && !(L.onlyAccents && accent < 0.8) && !(L.onlyBar && slot !== 0)) {
    if (L.key) v.layerInst.play(L.key, at, { gain: L.gain * accent, dest, release: RELEASE_SEC, duration: L.duration === undefined ? null : L.duration * bd });
    else playNote(v.layerInst, degreeToMidi(chord, degree, L.octave ?? octave), at, L.gain * accent * mix, L.duration === undefined ? dur : L.duration, dest);
  }
  return true;
}
