// audio/music.js — pistes construites à partir des partitions JSON (§ 9.3) et d'instruments échantillonnés.
// Chaque couche (tier 0..3) a son GainNode vers le bus music : les 4 crans de Résonance ouvrent
// les couches en fondu de 200 ms, sans jamais couper une note. Le séquençage passe par
// conductor.schedule(0.25, …) : tout est calé sur la grille de la Mesure (double-croche).
import { bus } from '../core/events.js';
import { busNode, ctx, now, assetUrl, setLowpass } from './audio.js';
import * as conductor from './conductor.js';
import { createInstrument } from './sampler.js';

const STEP = 0.25;                       // résolution de la grille : double-croche
const XFADE_SEC = 0.2;                   // fondu par couche (contrat)
const tracks = new Map();                // trackId → { score, instruments, buckets, loopBeats }
let manifestPromise = null;
let manifestBase = 'audio/manifest.json';
let active = null;                       // { id, gains[], startBeat, unschedule, layersOn }
let layersWanted = 1;
let intensity = 0.5;
let listening = false;

function getManifest() {
  if (!manifestPromise) manifestPromise = fetch(assetUrl(manifestBase)).then((r) => { if (!r.ok) throw new Error(`music: manifeste HTTP ${r.status}`); return r.json(); });
  return manifestPromise;
}

/** Permet de fournir le manifeste déjà chargé (évite un second fetch). */
export function setManifest(manifest) { manifestPromise = Promise.resolve(manifest); }

/** Aplatit une partition : pour chaque double-croche de la boucle, la liste des notes à jouer. */
function bucketize(score) {
  const loopBeats = score.bars * score.beatsPerBar;
  const buckets = new Map();
  const push = (beat, ev) => {
    const k = Math.round(beat / STEP);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(ev);
  };
  score.layers.forEach((layer, li) => {
    for (const e of layer.events || []) push(e.bar * score.beatsPerBar + e.beat, { li, note: e.note, dur: e.dur, gain: e.gain ?? 1 });
    if (layer.pattern) {
      const rep = layer.repeatBars || 1;
      const stepBeats = (score.beatsPerBar * rep) / layer.pattern.steps;
      for (let b = 0; b < score.bars; b += rep) {
        for (const [key, step, g] of layer.pattern.hits) push(b * score.beatsPerBar + step * stepBeats, { li, note: key, dur: null, gain: g ?? 1 });
      }
    }
  });
  return { buckets, loopBeats };
}

/** Charge la partition et pré-décode les échantillons de tous ses instruments. */
export async function loadTrack(trackId) {
  if (tracks.has(trackId)) return;
  const manifest = await getManifest();
  const entry = manifest.tracks[trackId];
  if (!entry || !entry.score) throw new Error(`music: piste inconnue « ${trackId} »`);
  const score = await fetch(entry.score.startsWith('src/') ? assetUrl('../' + entry.score) : entry.score).then((r) => { if (!r.ok) throw new Error(`music: partition HTTP ${r.status}`); return r.json(); });
  const instruments = {};
  for (const layer of score.layers) {
    if (!instruments[layer.instrument]) instruments[layer.instrument] = createInstrument(manifest.samples[layer.instrument]);
  }
  await Promise.all(Object.values(instruments).map((i) => i.load()));
  tracks.set(trackId, { score, instruments, ...bucketize(score) });
}

function layerTarget(layer, n) {
  if (layer.tier >= n) return 0;
  if (layer.minIntensity !== undefined && intensity < layer.minIntensity) return 0;
  const g = layer.gain ?? 1;
  return layer.intensityGain ? g * (layer.intensityGain[0] + (layer.intensityGain[1] - layer.intensityGain[0]) * intensity) : g;
}

function applyLayers(sec = XFADE_SEC) {
  if (!active) return;
  const t = now();
  const track = tracks.get(active.id);
  track.score.layers.forEach((layer, li) => {
    const g = active.gains[li].gain;
    const target = layerTarget(layer, layersWanted);
    active.targets[li] = target;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(target, t + sec);
  });
}

/** Démarre une piste calée sur la Mesure : tempo de la partition appliqué à la prochaine mesure,
 *  départ sur cette mesure ; l'éventuelle piste précédente s'éteint en `fadeSec`. */
export async function play(trackId, { layers = 1, fadeSec = 1 } = {}) {
  await loadTrack(trackId);
  listen();
  const track = tracks.get(trackId);
  layersWanted = Math.max(1, Math.min(4, layers));
  const prev = active;
  if (prev) fadeOut(prev, fadeSec);
  active = null;
  const wasRunning = conductor.isRunning();
  conductor.setBpm(track.score.bpm);            // Mesure lancée : prend effet à la prochaine mesure
  if (!wasRunning) conductor.start(now() + 0.1);
  // premier point de grille = prochaine mesure (ou le départ lui-même si la Mesure vient d'être lancée)
  const firstAt = wasRunning ? conductor.nextBeatAt(conductor.beatsPerBar()) : conductor.startAt();
  const startBeat = Math.round((firstAt - conductor.startAt()) / conductor.beatDuration());
  const ac = ctx();
  const gains = track.score.layers.map((layer) => {
    const g = ac.createGain();
    g.gain.value = 0;
    g.connect(busNode('music'));
    return g;
  });
  const me = { id: trackId, gains, startBeat, unschedule: null, targets: track.score.layers.map((l) => layerTarget(l, layersWanted)) };
  me.unschedule = conductor.schedule(STEP, (at, beatPos) => {
    // beatPos est en temps (fractionnaire) ; la grille de tempo peut avoir changé : on se cale sur les temps
    const rel = beatPos - me.startBeat;
    if (rel < -1e-6) return;
    const k = Math.round((rel % track.loopBeats) / STEP);
    const list = track.buckets.get(k);
    if (!list) return;
    const bd = conductor.beatDuration();
    for (const e of list) {
      const layer = track.score.layers[e.li];
      if (layer.minIntensity !== undefined && intensity < layer.minIntensity && layer.tier >= 1) continue;
      track.instruments[layer.instrument].play(e.note, at, { gain: e.gain, duration: e.dur === null ? null : e.dur * bd, dest: gains[e.li] });
    }
  });
  active = me;
  // entrée en fondu (fadeSec) jusqu'aux cibles de couche
  const t = Math.max(now(), firstAt - 0.01);
  track.score.layers.forEach((layer, li) => {
    gains[li].gain.setValueAtTime(0, t);
    gains[li].gain.linearRampToValueAtTime(layerTarget(layer, layersWanted), t + Math.max(0.05, fadeSec));
  });
}

function fadeOut(inst, fadeSec) {
  if (inst.unschedule) inst.unschedule();
  const t = now();
  for (const g of inst.gains) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + Math.max(0.05, fadeSec));
  }
  setTimeout(() => { for (const g of inst.gains) g.disconnect(); }, (fadeSec + 6) * 1000);   // laisse finir les queues
}

export function stop(fadeSec = 1) {
  if (!active) return;
  fadeOut(active, fadeSec);
  active = null;
}

/** Nombre de couches audibles (1..4) : crossfade 200 ms par couche, jamais de coupure sèche. */
export function setLayers(n) {
  layersWanted = Math.max(1, Math.min(4, Math.round(n)));
  applyLayers();
}

export function current() { return active ? active.id : null; }
export function layers() { return layersWanted; }
/** Gains des couches de la piste active (tests / HUD de debug). `layerGains()` lit AudioParam.value,
 *  que Chromium ne met à jour que pour les nœuds qui reçoivent du signal (couches clairsemées : valeur
 *  périmée) ; `layerTargets()` donne les cibles des fondus en cours. */
export function layerGains() { return active ? active.gains.map((g) => g.gain.value) : []; }
export function layerTargets() { return active ? active.targets.slice() : []; }

/** Variation continue 0..1 : gains `intensityGain` des couches et couches `minIntensity` (ornements). */
export function setIntensity(v) {
  intensity = Math.max(0, Math.min(1, v));
  applyLayers();
}
export function getIntensity() { return intensity; }

function listen() {
  if (listening) return;
  listening = true;
  bus.on('resonance:change', ({ tier }) => setLayers(tier + 1));
  bus.on('player:inAura', ({ depth }) => setLowpass(depth));
}
