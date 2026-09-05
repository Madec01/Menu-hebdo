// audio/conductor.js — LA MESURE. Une seule source de vérité temporelle pour le rythme.
// Implémentation imposée (§ 8) : un setTimeout(tickMs) qui, à chaque tick, planifie tous les
// points de grille tombant dans [now, now + lookaheadSec] en appelant les callbacks `schedule`
// avec le temps audio exact. Jamais setInterval, jamais de son déclenché depuis le timer :
// les événements `beat`/`bar` du bus partent de conductorTick(), appelé par la boucle 60 Hz.
// Changements différés (tempo à la mesure suivante, décalage de grille du Bourdon Fêlé) : une file
// d'intentions ; la tête est matérialisée en { switchBeat, switchAt, newStartAt, bpm } — l'ancienne grille
// est planifiée pour les indices < switchBeat, la nouvelle à partir de switchBeat ; les indices restent
// monotones, aucun point n'est joué deux fois. `boss:phase {phase:'cri'}` : la grille recule d'une croche
// pendant 8 temps puis revient en phase à la mesure suivante (le « 1 » arrive une croche plus tôt).
import { bus } from '../core/events.js';
import { now } from './audio.js';

// Le cri du Bourdon Fêlé fausse la Mesure : la grille recule d'une croche pendant 8 temps.
bus.on('boss:phase', (e) => { if (e && e.phase === 'cri') shiftGrid(0.5, 8); });

const BASE_WINDOW_MS = 110;

const st = {
  bpm: 96, beatsPerBar: 4, lookaheadSec: 0.12, tickMs: 25,
  running: false, startAt: 0, beatDur: 60 / 96,
  pending: null,                 // tête matérialisée : { bpm, switchBeat, switchAt, newStartAt }
  queue: [],                     // intentions : { kind:'bpm', bpm } | { kind:'shift', beats } | { kind:'unshift', beats, fromBeat, holdBeats }
  shifted: 0,                    // décalage de grille en cours (temps), pour le HUD / les tests
  timer: null,
  entries: new Set(),            // { sub, fn, nextK }
  windowMs: BASE_WINDOW_MS,
  inputLatencyMs: 0,           // § 8 bis : décalage soustrait à inputAt dans judge() (calibration, −150…+150 ms)
  lastEmittedBeat: -1,
};

export function initConductor({ bpm = 96, beatsPerBar = 4, lookaheadSec = 0.12, tickMs = 25 } = {}) {
  stop();
  st.bpm = bpm; st.beatsPerBar = beatsPerBar; st.lookaheadSec = lookaheadSec; st.tickMs = tickMs;
  st.beatDur = 60 / bpm; st.pending = null; st.queue.length = 0; st.shifted = 0; st.entries.clear(); st.lastEmittedBeat = -1;
}

/** Lance la Mesure : le temps 0 (mesure 0, temps 0) est `atTime` (temps audio). */
export function start(atTime = now() + 0.05) {
  if (st.running) return;
  st.startAt = atTime;
  st.running = true;
  st.lastEmittedBeat = -1;
  for (const e of st.entries) e.nextK = 0;
  tick();
}

export function stop() {
  st.running = false;
  if (st.timer !== null) { clearTimeout(st.timer); st.timer = null; }
}

export function isRunning() { return st.running; }
export function bpm() { return st.bpm; }
export function beatDuration() { return st.beatDur; }

/** Nouveau tempo, appliqué à la prochaine mesure (continuité de la grille garantie). */
export function setBpm(newBpm) {
  if (!(newBpm > 0)) return;
  st.queue = st.queue.filter((q) => q.kind !== 'bpm');
  if (st.pending && st.pending.kind === 'bpm') st.pending = null;
  if (!st.running) { st.bpm = newBpm; st.beatDur = 60 / newBpm; return; }
  if (newBpm !== st.bpm) st.queue.push({ kind: 'bpm', bpm: newBpm });
}

/** Décale la grille de `beats` (croche = 0,5) à partir du prochain temps, puis la ramène en phase à la
 *  première mesure après `holdBeats` temps (le « 1 » arrive alors `beats` plus tôt). Bourdon Fêlé, « cri ». */
export function shiftGrid(beats = 0.5, holdBeats = 8) {
  if (!st.running || !(beats > 0) || st.shifted) return;
  st.queue = st.queue.filter((q) => q.kind === 'bpm');
  st.queue.push({ kind: 'shift', beats, holdBeats });
}
export function gridShift() { return st.shifted; }

/** Premier indice de grille (multiple de `sub`) strictement après maintenant. */
function nextIndex(sub) { return (Math.floor((now() - st.startAt) / (st.beatDur * sub) + 1e-6) + 1) * sub; }

/** Matérialise la tête de la file : indices et temps de bascule calculés sur la grille courante. */
function materialize() {
  if (st.pending || !st.queue.length || !st.running) return;
  const it = st.queue.shift();
  const bd = st.beatDur;
  let bpm = st.bpm, switchBeat, anchorBeat, offset = 0;
  if (it.kind === 'bpm') { bpm = it.bpm; switchBeat = anchorBeat = nextIndex(st.beatsPerBar); }
  else if (it.kind === 'shift') { switchBeat = anchorBeat = nextIndex(1); offset = it.beats * bd; }
  else {                                           // unshift : le « 1 » de la mesure kb arrive à la place de kb − beats
    const first = it.fromBeat + it.holdBeats;
    let kb = Math.ceil(first / st.beatsPerBar) * st.beatsPerBar;
    while (kb - it.beats <= nextIndex(0.25)) kb += st.beatsPerBar;
    switchBeat = kb - it.beats; anchorBeat = kb;
  }
  const switchAt = st.startAt + switchBeat * bd;             // temps (grille courante) du point de bascule
  st.pending = { kind: it.kind, bpm, switchBeat, switchAt, newStartAt: switchAt + offset - anchorBeat * (60 / bpm), it };
}

function applyPending(t) {
  if (!st.pending || t < st.pending.switchAt) return;
  const p = st.pending;
  st.bpm = p.bpm; st.beatDur = 60 / p.bpm;
  st.startAt = p.newStartAt;
  st.pending = null;
  if (p.kind === 'shift') { st.shifted = p.it.beats; st.queue.unshift({ kind: 'unshift', beats: p.it.beats, fromBeat: p.switchBeat, holdBeats: p.it.holdBeats }); }
  else if (p.kind === 'unshift') st.shifted = 0;
  materialize();
}

/** Position flottante en temps (peut être négative avant le départ). */
function beatFloat(t = now()) { return (t - st.startAt) / st.beatDur; }
export function beatIndex() { return st.running ? Math.max(0, Math.floor(beatFloat())) : 0; }
export function beatInBar() { return beatIndex() % st.beatsPerBar; }
export function bar() { return Math.floor(beatIndex() / st.beatsPerBar); }
export function phase() {
  if (!st.running) return 0;
  const b = beatFloat();
  return b < 0 ? 0 : b - Math.floor(b);
}

/** Temps audio du prochain point de grille (0.5 = croche, 1 = temps, 2 = blanche, 4 = ronde…). */
export function nextBeatAt(subdivision = 1) {
  const step = st.beatDur * subdivision;
  const t = now();
  const k = Math.floor((t - st.startAt) / step + 1e-6) + 1;
  return st.startAt + Math.max(k, 0) * step;
}

/** fn(at, beatIndex) est appelé ~lookahead AVANT chaque point de grille `subdivision`.
 *  `beatIndex` est la position en temps (entière pour subdivision ≥ 1, fractionnaire sinon). */
export function schedule(subdivision, fn) {
  const entry = { sub: subdivision, fn, nextK: null };
  st.entries.add(entry);
  return () => { st.entries.delete(entry); };
}

function scheduleUpTo(t, limit) {
  for (const e of st.entries) {
    const step = st.beatDur * e.sub;
    if (e.nextK === null) e.nextK = Math.max(0, Math.ceil((t - st.startAt) / step - 1e-6));
    let at = st.startAt + e.nextK * step;
    while (at <= limit) {
      if (at >= t - 0.005) e.fn(at, e.nextK * e.sub);     // les points déjà passés (retard machine) sont sautés
      e.nextK++;
      at = st.startAt + e.nextK * step;
    }
  }
}

function tick() {
  if (!st.running) return;
  const t = now();
  const horizon = t + st.lookaheadSec;
  materialize();
  // bascule en attente : l'ancienne grille est planifiée jusqu'au point de bascule (exclu), puis on bascule
  // (les indices sont absolus : aucun point n'est joué deux fois ; ceux qui tombent dans le passé sont sautés)
  for (let guard = 0; guard < 4 && st.pending && horizon >= st.pending.switchAt; guard++) {
    scheduleUpTo(t, st.pending.switchAt - 1e-6);
    applyPending(st.pending.switchAt);
  }
  scheduleUpTo(t, st.pending ? Math.min(horizon, st.pending.switchAt - 1e-6) : horizon);
  st.timer = setTimeout(tick, st.tickMs);
}

/** À appeler depuis le tick logique 60 Hz : émet `beat` et `bar` quand beatIndex() change. */
export function conductorTick() {
  if (!st.running) return;
  applyPending(now());
  const b = beatIndex();
  if (b === st.lastEmittedBeat || beatFloat() < 0) return;
  st.lastEmittedBeat = b;
  const at = st.startAt + b * st.beatDur;
  const barIdx = Math.floor(b / st.beatsPerBar);
  const inBar = b % st.beatsPerBar;
  bus.emit('beat', { beat: b, bar: barIdx, beatInBar: inBar, at });
  if (inBar === 0) bus.emit('bar', { bar: barIdx, at });
}

/** Juge une frappe (temps audio de l'entrée, corrigé de la latence d'entrée) contre le point de grille le plus
 *  proche de `subdivision` temps (1 = le temps ; 0,5 = temps OU croche : « frappe au contretemps », quand un
 *  Contretemps est à portée). `early` = la frappe est arrivée AVANT le point ; `offbeat` = le point retenu est
 *  une croche (beat fractionnaire). */
export function judge(inputAt, subdivision = 1) {
  const sub = subdivision > 0 ? subdivision : 1;
  const bf = beatFloat(inputAt - st.inputLatencyMs / 1000);
  const nearest = Math.round(bf / sub) * sub;
  const offsetMs = (bf - nearest) * st.beatDur * 1000;
  const a = Math.abs(offsetMs);
  const grade = a <= st.windowMs / 3 ? 'parfait' : a <= st.windowMs ? 'bon' : 'rate';
  return { grade, offsetMs, beat: nearest, early: offsetMs < 0, offbeat: nearest !== Math.round(nearest) };
}

export function setWindowMs(ms) { st.windowMs = ms; }
export function windowMs() { return st.windowMs; }
/** Latence d'entrée (ms, −150…+150) : positive = le geste est mesuré en retard sur le son (Bluetooth,
 *  écran tactile) et judge() le ramène vers le temps ; réglée dans les options. */
export function setInputLatencyMs(ms) { st.inputLatencyMs = Math.max(-150, Math.min(150, Number(ms) || 0)); }
export function inputLatencyMs() { return st.inputLatencyMs; }
export function beatsPerBar() { return st.beatsPerBar; }
export function startAt() { return st.startAt; }
