// audio/music.js — pistes construites à partir des partitions JSON (§ 9.3) et d'instruments échantillonnés.
// Chaque couche a son GainNode vers le bus music : les 4 crans de Résonance ouvrent les couches en fondu
// (200 ms à l'entrée, 700 ms à la sortie), sans jamais couper une note. Le séquençage passe par
// conductor.schedule(0.25, …) : tout est calé sur la grille de la Mesure (double-croche).
// Vague « approfondissement » (§ 8 bis) : sections (intro → A ⇄ B, pont de 4 mesures inséré à la mesure
// suivante), seules les couches audibles sont planifiées (les notes tenues d'une couche qui s'ouvre sont
// rattrapées), tempo relevé de +2 bpm par palier de Sourdine, désaccord des couches mélodiques
// (setDetune), pistes « toutes couches » (menu, hub, bilan). L'écoute du bus est dans music-events.js.
import { bus } from '../core/events.js';
import { busNode, ctx, now, assetUrl } from './audio.js';
import * as conductor from './conductor.js';
import { createInstrument } from './sampler.js';
import { DEFAULT_CHORD } from './harmony.js';
import { STEP, compileScore, layerTarget, nextSectionName, effectiveIntensity } from './music-score.js';
import { installMusicEvents } from './music-events.js';

const XFADE_IN = 0.2;                    // fondu d'ouverture d'une couche (contrat)
const XFADE_OUT = 0.7;                   // fondu de fermeture : un chœur qui s'éteint ne doit pas « couper »
const AUDIBLE = 0.01;                    // gain cible au-delà duquel une couche est planifiée
const DETUNE_BACK_SEC = 1;               // retour à l'accord après un désaccord
const tracks = new Map();                // trackId → { score, compiled, instruments }
let manifestPromise = null;
let manifestBase = 'audio/manifest.json';
let active = null;                       // piste en cours (voir play)
let layersWanted = 1;
let intensity = 0.5;
let tier = 0;                            // palier de Sourdine courant (run:tier)
let detune = { cents: 0, at: 0 };        // désaccord courant (ennemi désaccordeur)
let listening = false;

function getManifest() {
  if (!manifestPromise) manifestPromise = fetch(assetUrl(manifestBase)).then((r) => { if (!r.ok) throw new Error(`music: manifeste HTTP ${r.status}`); return r.json(); });
  return manifestPromise;
}

/** Permet de fournir le manifeste déjà chargé (évite un second fetch). */
export function setManifest(manifest) { manifestPromise = Promise.resolve(manifest); }
/** Manifeste audio (promesse) : partagé avec timbres.js et jingles.js pour créer les instruments. */
export function manifest() { return getManifest(); }

/** Charge la partition et pré-décode les échantillons de tous ses instruments (toutes sections). */
export async function loadTrack(trackId) {
  if (tracks.has(trackId)) return;
  const manifest = await getManifest();
  const entry = manifest.tracks[trackId];
  if (!entry || !entry.score) throw new Error(`music: piste inconnue « ${trackId} »`);
  const score = await fetch(entry.score.startsWith('src/') ? assetUrl('../' + entry.score) : entry.score).then((r) => { if (!r.ok) throw new Error(`music: partition HTTP ${r.status}`); return r.json(); });
  const compiled = compileScore(score);
  const instruments = {};
  for (const name of compiled.instrumentNames) {
    if (!manifest.samples[name]) throw new Error(`music: instrument inconnu « ${name} »`);
    instruments[name] = createInstrument(manifest.samples[name]);
  }
  await Promise.all(Object.values(instruments).map((i) => i.load()));
  tracks.set(trackId, { score, compiled, instruments });
}

function targetOf(me, layer) { return layerTarget(layer, layersWanted, effectiveIntensity(intensity, tier), me.track.compiled.allLayers); }

/** Position en temps (flottante) de `at` sur la grille de la Mesure. */
function beatPosAt(at) {
  const bd = conductor.beatDuration() || 0.625;
  return conductor.isRunning() ? (at - conductor.startAt()) / bd : 0;
}

/** Section et mesure jouées à la position `beatPos` (prédit d'une section quand la suivante n'est pas encore entamée). */
function sectionAt(me, beatPos) {
  const S = me.track.compiled.sections;
  let name = me.section, start = me.segStart;
  let rel = beatPos - start;
  if (rel < 0) return { sec: S[name], loopBar: 0 };
  let sec = S[name];
  if (rel >= sec.loopBeats) { rel -= sec.loopBeats; name = nextSectionName(name, S, me.altB); sec = S[name]; }
  const bpb = conductor.beatsPerBar();
  return { sec, loopBar: Math.min(sec.bars - 1, Math.floor(((rel % sec.loopBeats) / bpb) + 1e-6)) };
}

function detuneFor(at) {
  if (!detune.cents) return null;
  const left = detune.at + DETUNE_BACK_SEC - at;
  if (left <= 0) return null;
  return { cents: detune.cents * (left / DETUNE_BACK_SEC), backAt: detune.at + DETUNE_BACK_SEC };
}

function playEvent(me, e, at, durationBeats) {
  const layer = me.track.compiled.layers[e.li];
  const bd = conductor.beatDuration();
  const melodic = me.track.compiled.melodicLayers.has(e.li);
  const h = me.track.instruments[layer.instrument].play(e.note, at, { gain: e.gain, duration: durationBeats === null ? null : durationBeats * bd, dest: me.gains[e.li], detune: melodic ? detuneFor(at) : null });
  if (melodic && h.live) { me.live.add(h); if (me.live.size > 64) for (const x of me.live) { if (x.endAt < at) me.live.delete(x); } }
}

/** Callback de grille : avance de section au besoin (fin de boucle, pont demandé sur la mesure), puis joue les
 *  notes des couches audibles de la double-croche courante. */
function onGrid(me, at, beatPos) {
  const S = me.track.compiled.sections;
  const bpb = conductor.beatsPerBar();
  let rel = beatPos - me.segStart;
  if (rel < -1e-6) return;
  let sec = S[me.section];
  if (rel >= sec.loopBeats - 1e-6) {                       // fin de section : la suivante commence ici
    me.segStart += sec.loopBeats; me.section = nextSectionName(me.section, S, me.altB); sec = S[me.section]; rel = beatPos - me.segStart;
    bus.emit('music:section', { id: me.id, section: me.section });
  }
  const onBar = Math.abs(rel / bpb - Math.round(rel / bpb)) < 1e-6;
  if (me.bridgeRequested && S.bridge && onBar && me.section !== 'bridge' && me.section !== 'intro') {
    me.bridgeRequested = false; me.segStart = beatPos; me.section = 'bridge'; sec = S.bridge; rel = 0;
    bus.emit('music:section', { id: me.id, section: 'bridge' });
  }
  const k = Math.round((rel % sec.loopBeats) / STEP);
  const list = sec.buckets.get(k);
  if (!list) return;
  for (const e of list) {
    if (me.targets[e.li] <= AUDIBLE) continue;              // couche muette : rien n'est planifié (budget de voix)
    playEvent(me, e, at, e.dur);
  }
}

/** Une couche vient de s'ouvrir : ses notes tenues en cours reprennent au prochain point de grille. */
function catchUp(me, li) {
  const sec = me.track.compiled.sections[me.section];
  const longs = sec.longEvents.get(li);
  if (!longs || !conductor.isRunning()) return;
  const at = conductor.nextBeatAt(STEP);
  const pos = ((beatPosAt(at) - me.segStart) % sec.loopBeats + sec.loopBeats) % sec.loopBeats;
  for (const e of longs) {
    const end = e.start + e.dur;
    if (pos > e.start + 1e-3 && pos < end - STEP) playEvent(me, { li, note: e.note, gain: e.gain }, at, end - pos);
  }
}

function applyLayers() {
  if (!active) return;
  const t = now();
  active.track.compiled.layers.forEach((layer, li) => {
    const g = active.gains[li].gain;
    const target = targetOf(active, layer);
    const was = active.targets[li];
    active.targets[li] = target;
    if (target === was) return;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(target, t + (target > was ? XFADE_IN : XFADE_OUT));
    if (was <= AUDIBLE && target > AUDIBLE && layer.section === active.section) catchUp(active, li);
  });
}

function bpmFor(track) { return track.score.bpm + (track.compiled.followsTier ? 2 * tier : 0); }

/** Démarre une piste calée sur la Mesure : tempo de la partition (+2 bpm par palier) appliqué à la prochaine
 *  mesure, départ sur cette mesure (section `intro` d'abord si la partition en a une) ; l'éventuelle piste
 *  précédente s'éteint en `fadeSec`. Rejouer la piste déjà active ne fait que régler ses couches. */
export async function play(trackId, { layers = 1, fadeSec = 1 } = {}) {
  await loadTrack(trackId);
  listen();
  const track = tracks.get(trackId);
  if (active && active.id === trackId) { setLayers(layers); return; }
  layersWanted = Math.max(1, Math.min(4, layers));
  const prev = active;
  if (prev) fadeOut(prev, fadeSec);
  active = null;
  const wasRunning = conductor.isRunning();
  conductor.setBpm(bpmFor(track));               // Mesure lancée : prend effet à la prochaine mesure
  if (!wasRunning) conductor.start(now() + 0.1);
  const firstAt = wasRunning ? conductor.nextBeatAt(conductor.beatsPerBar()) : conductor.startAt();
  const startBeat = Math.round((firstAt - conductor.startAt()) / conductor.beatDuration());
  const ac = ctx();
  const gains = track.compiled.layers.map(() => { const g = ac.createGain(); g.gain.value = 0; g.connect(busNode('music')); return g; });
  const me = { id: trackId, track, gains, targets: [], unschedule: null, segStart: startBeat, section: track.compiled.sections.intro ? 'intro' : 'A', altB: tier >= 4, bridgeRequested: false, live: new Set() };
  me.targets = track.compiled.layers.map((l) => targetOf(me, l));
  me.unschedule = conductor.schedule(STEP, (at, beatPos) => onGrid(me, at, beatPos));
  active = me;
  const t = Math.max(now(), firstAt - 0.01);
  track.compiled.layers.forEach((layer, li) => {
    gains[li].gain.setValueAtTime(0, t);
    gains[li].gain.linearRampToValueAtTime(me.targets[li], t + Math.max(0.05, fadeSec));
  });
  bus.emit('music:track', { id: trackId, section: me.section });
}

function fadeOut(inst, fadeSec) {
  if (inst.unschedule) inst.unschedule();
  const t = now();
  for (const g of inst.gains) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + Math.max(0.05, fadeSec));
  }
  const stopAt = t + Math.max(0.05, fadeSec) + 0.05;
  for (const h of inst.live) h.stop(stopAt);           // les tenues mélodiques s'arrêtent avec le fondu (budget de voix)
  inst.live.clear();
  setTimeout(() => { for (const g of inst.gains) g.disconnect(); }, (fadeSec + 6) * 1000);   // laisse finir les queues
}

export function stop(fadeSec = 1) {
  if (!active) return;
  fadeOut(active, fadeSec);
  active = null;
  bus.emit('music:track', { id: null, section: null });
}

/** Nombre de couches audibles (1..4) : crossfade 200 ms par couche, jamais de coupure sèche. */
export function setLayers(n) {
  layersWanted = Math.max(1, Math.min(4, Math.round(n)));
  applyLayers();
}

export function current() { return active ? active.id : null; }
/** Section jouée ('intro' | 'A' | 'B' | 'bridge') ou null. */
export function section() { return active ? active.section : null; }

/**
 * Accord de la partition active à l'instant audio `at` (harmony.js) : { name, root, quality, third,
 * fifth, tones, scale, bar (mesure absolue de la Mesure), loopBar (mesure dans la section) }.
 * Sans piste (ou avant son départ) : accord par défaut, ré mineur dorien. Les Timbres appellent
 * chordAtTime(at) avec le temps de grille du tir, qui peut être la mesure suivante.
 */
export function chordAtTime(at) {
  const bpb = conductor.beatsPerBar();
  const beatPos = beatPosAt(at);
  const bar = Math.max(0, Math.floor(beatPos / bpb + 1e-6));
  if (!active) return { ...DEFAULT_CHORD, bar, loopBar: 0 };
  const { sec, loopBar } = sectionAt(active, beatPos);
  return { ...sec.chords[loopBar], bar, loopBar };
}
/** Accord de la mesure en cours (chordAtTime(now())). */
export function currentChord() { return chordAtTime(now()); }
export function layers() { return layersWanted; }
/** Gains des couches de la piste active (tests / HUD de debug). `layerGains()` lit AudioParam.value,
 *  que Chromium ne met à jour que pour les nœuds qui reçoivent du signal (couches clairsemées : valeur
 *  périmée) ; `layerTargets()` donne les cibles des fondus en cours. */
export function layerGains() { return active ? active.gains.map((g) => g.gain.value) : []; }
export function layerTargets() { return active ? active.targets.slice() : []; }
/** Noms des couches de la piste active, avec leur section (tests). */
export function layerInfo() { return active ? active.track.compiled.layers.map((l) => ({ name: l.name, tier: l.tier, section: l.section })) : []; }

/** Variation continue 0..1 : gains `intensityGain` des couches et couches `minIntensity` (ornements). */
export function setIntensity(v) {
  intensity = Math.max(0, Math.min(1, v));
  applyLayers();
}
export function getIntensity() { return intensity; }

/** Palier de Sourdine (run:tier) : relève l'intensité effective, le tempo (+2 bpm par palier, à la mesure
 *  suivante) et, dès le palier 4, alterne les sections A et B des paroisses qui en ont une. */
export function setTier(n) {
  tier = Math.max(0, Math.round(n) || 0);
  if (active) {
    active.altB = tier >= 4;
    if (active.track.compiled.followsTier) conductor.setBpm(bpmFor(active.track));
  }
  applyLayers();
}
export function getTier() { return tier; }

/** Demande le pont (Fêlure) : inséré à la prochaine mesure, 4 mesures, puis retour au début de A. */
export function requestBridge() { if (active && active.track.compiled.sections.bridge) active.bridgeRequested = true; }

/** Désaccord des couches mélodiques (cents, ennemi désaccordeur en x, y) ; retour à 0 en 1 s. */
export function setDetune(cents, x = null, y = null) {   // eslint-disable-line no-unused-vars
  const t = now();
  detune = { cents: Math.max(-100, Math.min(100, Number(cents) || 0)), at: t };
  if (!active) return;
  for (const h of active.live) { if (h.endAt < t) active.live.delete(h); else h.detune(detune.cents, t, DETUNE_BACK_SEC); }
}
/** Désaccord courant (cents), décroissant vers 0. */
export function getDetune() { const d = detuneFor(now()); return d ? d.cents : 0; }

function listen() {
  if (listening) return;
  listening = true;
  installMusicEvents();
}
