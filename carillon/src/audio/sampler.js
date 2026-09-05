// audio/sampler.js — instrument échantillonné (couche basse de music.js et sfx.js).
// Un instrument = une entrée `samples` du manifeste audio (§ 9.2) : `pitched` (un fichier par note,
// boucles facultatives) ou `percussion` (round-robins par variante). Chaque note jouée est un
// AudioBufferSourceNode transposé par playbackRate, avec une enveloppe de release ≥ 30 ms.
import { ctx, busNode, loadBuffer, getBuffer, assetUrl, acquireVoice, releaseVoice } from './audio.js';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const RELEASE_ONE_SHOT = 0.03;     // 30 ms minimum (contrat)
const RELEASE_LOOP = 0.12;         // tenues bouclées : relâchement plus doux
const ATTACK = 0.006;

/** 'F#3' → 54 (A4 = 69). */
export function noteToMidi(name) {
  const m = /^([A-Ga-g])(#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`sampler: note invalide « ${name} »`);
  return NOTES.indexOf(m[1].toUpperCase() + m[2]) + 12 * (Number(m[3]) + 1);
}

/** Crée un instrument à partir de sa définition de manifeste. */
export function createInstrument(def) {
  const pitched = def.kind === 'pitched';
  // table des échantillons : pitched → [{midi, url, loop}] ; percussion → clé → [{url, loop}]
  let notes = null;
  let variants = null;
  if (pitched) {
    notes = Object.entries(def.files).map(([n, f]) => ({ midi: noteToMidi(n), url: assetUrl(f), loop: def.loop?.[n] || null }));
    notes.sort((a, b) => a.midi - b.midi);
  } else {
    variants = {};
    for (const [key, list] of Object.entries(def.files)) {
      variants[key] = list.map((f) => {
        const name = f.split('/').pop().replace(/\.ogg$/, '');
        return { url: assetUrl(f), loop: def.loop?.[name] || null };
      });
    }
  }
  const lastPick = {};                       // round-robin : jamais deux fois de suite le même fichier

  function urls() {
    return pitched ? notes.map((n) => n.url) : Object.values(variants).flat().map((v) => v.url);
  }

  /** Pré-décode tous les fichiers de l'instrument. */
  async function load() { await Promise.all(urls().map(loadBuffer)); }

  /** Échantillon le plus proche (pitched) ou variante aléatoire sans répétition (percussion). */
  function pick(noteOrKey) {
    if (pitched) {
      const midi = noteToMidi(noteOrKey);
      let best = notes[0];
      for (const s of notes) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
      return { url: best.url, rate: Math.pow(2, (midi - best.midi) / 12), loop: best.loop };
    }
    const list = variants[noteOrKey];
    if (!list) return null;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === lastPick[noteOrKey]) i = (i + 1) % list.length;
    lastPick[noteOrKey] = i;
    return { url: list[i].url, rate: 1, loop: list[i].loop };
  }

  /** Joue une note (nom) ou une variante (clé) à `at` (temps audio).
   *  duration (s) : null = jusqu'à la fin du fichier ; sinon la note est tenue (bouclée si possible)
   *  puis relâchée. `dest` (facultatif) remplace le bus : nœud de destination (couche de music.js).
   *  `release` (s, facultatif) : durée du relâchement (≥ 30 ms) — les Timbres laissent sonner les cloches. */
  function play(noteOrKey, at, { gain = 1, pitchSemis = 0, duration = null, bus = 'music', pan = 0, dest = null, release = null, detune = null } = {}) {
    const s = pick(noteOrKey);
    const buf = s && getBuffer(s.url);
    const ac = ctx();
    if (!buf || !ac || !acquireVoice()) return { stop() {}, detune() {}, live: false };
    const src = ac.createBufferSource();
    src.buffer = buf;
    const rate = s.rate * Math.pow(2, pitchSemis / 12);
    src.playbackRate.value = rate;
    // désaccord (cents) : valeur de départ puis retour à 0 (ennemi désaccordeur, music.setDetune)
    if (detune && src.detune) { src.detune.setValueAtTime(detune.cents, at); if (detune.backAt > at) src.detune.linearRampToValueAtTime(0, detune.backAt); }
    const looped = Boolean(s.loop && duration !== null);
    if (looped) { src.loop = true; src.loopStart = s.loop[0]; src.loopEnd = s.loop[1]; }
    const env = ac.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + ATTACK);
    src.connect(env);                    // (sans ce lien, aucune note du sampler n'est audible)
    let tail = env;
    if (pan) {
      const p = ac.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      env.connect(p);
      tail = p;
    }
    tail.connect(dest || busNode(bus));
    src.start(at);
    src.onended = () => { releaseVoice(); src.disconnect(); env.disconnect(); if (tail !== env) tail.disconnect(); };
    const rel = release !== null ? Math.max(RELEASE_ONE_SHOT, release) : looped ? RELEASE_LOOP : RELEASE_ONE_SHOT;
    let stopped = false;
    function stop(when = ac.currentTime) {
      if (stopped) return;
      stopped = true;
      const t = Math.max(when, ac.currentTime, at + ATTACK);
      env.gain.cancelScheduledValues(t);
      env.gain.setValueAtTime(gain, t);
      env.gain.linearRampToValueAtTime(0, t + rel);
      src.stop(t + rel + 0.005);
    }
    const natural = at + buf.duration / rate + 0.01;
    if (duration !== null && (looped || at + duration < natural)) stop(at + duration);
    else if (!looped) src.stop(natural);
    /** Désaccord d'une note vivante : `cents` à `t`, retour à 0 en `backSec`. */
    function detuneTo(cents, t = ac.currentTime, backSec = 1) {
      if (!src.detune) return;
      src.detune.cancelScheduledValues(t);
      src.detune.setValueAtTime(cents, t);
      src.detune.linearRampToValueAtTime(0, t + backSec);
    }
    const handle = { stop, detune: detuneTo, live: true, endAt: duration !== null ? at + duration + rel : at + buf.duration / rate };
    return handle;
  }

  return { def, load, play, pick, urls };
}
