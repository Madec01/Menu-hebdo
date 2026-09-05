// audio/conductor.js — LA MESURE. Une seule source de vérité temporelle pour le rythme.
// Implémentation imposée (§ 8) : un setTimeout(tickMs) qui, à chaque tick, planifie tous les
// points de grille tombant dans [now, now + lookaheadSec] en appelant les callbacks `schedule`
// avec le temps audio exact. Jamais setInterval, jamais de son déclenché depuis le timer :
// les événements `beat`/`bar` du bus partent de conductorTick(), appelé par la boucle 60 Hz.
import { bus } from '../core/events.js';
import { now } from './audio.js';

const BASE_WINDOW_MS = 110;

const st = {
  bpm: 96, beatsPerBar: 4, lookaheadSec: 0.12, tickMs: 25,
  running: false, startAt: 0, beatDur: 60 / 96,
  pending: null,                 // { bpm, applyAt, beatAtApply } : changement de tempo à la prochaine mesure
  timer: null,
  entries: new Set(),            // { sub, fn, nextK }
  windowMs: BASE_WINDOW_MS,
  inputLatencyMs: 0,           // § 8 bis : décalage soustrait à inputAt dans judge() (calibration, −150…+150 ms)
  lastEmittedBeat: -1,
};

export function initConductor({ bpm = 96, beatsPerBar = 4, lookaheadSec = 0.12, tickMs = 25 } = {}) {
  stop();
  st.bpm = bpm; st.beatsPerBar = beatsPerBar; st.lookaheadSec = lookaheadSec; st.tickMs = tickMs;
  st.beatDur = 60 / bpm; st.pending = null; st.entries.clear(); st.lastEmittedBeat = -1;
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
  if (!(newBpm > 0) || newBpm === st.bpm) { st.pending = null; return; }
  if (!st.running) { st.bpm = newBpm; st.beatDur = 60 / newBpm; st.pending = null; return; }
  const applyAt = nextBeatAt(st.beatsPerBar);
  st.pending = { bpm: newBpm, applyAt, beatAtApply: Math.round((applyAt - st.startAt) / st.beatDur) };
}

function applyPending(t) {
  if (st.pending && t >= st.pending.applyAt) {
    const { bpm: b, applyAt, beatAtApply } = st.pending;
    st.bpm = b; st.beatDur = 60 / b;
    st.startAt = applyAt - beatAtApply * st.beatDur;   // le temps `beatAtApply` reste exactement à applyAt
    st.pending = null;
  }
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
  // tempo en attente : on planifie l'ancienne grille jusqu'au point d'application, puis on bascule
  // (les indices de grille sont absolus, le point d'application garde le même indice : aucun trou)
  const limit = st.pending ? Math.min(horizon, st.pending.applyAt - 1e-6) : horizon;
  scheduleUpTo(t, limit);
  if (st.pending && horizon >= st.pending.applyAt) {
    applyPending(st.pending.applyAt);
    scheduleUpTo(t, horizon);
  }
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

/** Juge une frappe (temps audio de l'entrée, corrigé de la latence d'entrée) contre le temps le plus
 *  proche. `early` = la frappe est arrivée AVANT le temps (retour « avance / retard » du HUD). */
export function judge(inputAt) {
  const bf = beatFloat(inputAt - st.inputLatencyMs / 1000);
  const nearest = Math.round(bf);
  const offsetMs = (bf - nearest) * st.beatDur * 1000;
  const a = Math.abs(offsetMs);
  const grade = a <= st.windowMs / 3 ? 'parfait' : a <= st.windowMs ? 'bon' : 'rate';
  return { grade, offsetMs, beat: nearest, early: offsetMs < 0 };
}

export function setWindowMs(ms) { st.windowMs = ms; }
export function windowMs() { return st.windowMs; }
/** Latence d'entrée (ms, −150…+150) : positive = le geste est mesuré en retard sur le son (Bluetooth,
 *  écran tactile) et judge() le ramène vers le temps ; réglée dans les options. */
export function setInputLatencyMs(ms) { st.inputLatencyMs = Math.max(-150, Math.min(150, Number(ms) || 0)); }
export function inputLatencyMs() { return st.inputLatencyMs; }
export function beatsPerBar() { return st.beatsPerBar; }
export function startAt() { return st.startAt; }
