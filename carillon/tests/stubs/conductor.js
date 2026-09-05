// Stub de audio/conductor.js : grille de la Mesure simulée. __advance() (après audio.__advance)
// appelle les callbacks schedule() pour tous les points de grille jusqu'à now + lookahead.
// § 8 bis : setInputLatencyMs / inputLatencyMs (soustrait dans judge, qui renvoie aussi `early`) ;
// shiftGrid(beats, holdBeats) / gridShift() : le cri fêlé du Bourdon (`boss:phase 'cri'`) recule la grille d'une
// croche à partir du prochain temps, puis la ramène en phase à la première mesure après holdBeats temps — les
// indices restent monotones (les callbacks calculent `at` depuis startAt courant, comme le vrai conducteur).
import { now } from './audio.js';
import { bus } from '../../src/core/events.js';
const st = { bpm: 96, bpb: 4, beatDur: 60 / 96, running: false, startAt: 0, entries: new Set(), windowMs: 110, last: -1, latency: 0, shifted: 0, shiftAt: -1, shiftBeats: 0, unshiftAt: -1, baseStartAt: 0, shifts: 0 };
const beatPayload = { beat: 0, bar: 0, beatInBar: 0, at: 0 }; const barPayload = { bar: 0, at: 0 };
bus.on('boss:phase', (e) => { if (e && e.phase === 'cri') shiftGrid(0.5, 8); });
export function initConductor({ bpm = 96, beatsPerBar = 4 } = {}) { st.bpm = bpm; st.bpb = beatsPerBar; st.beatDur = 60 / bpm; st.entries.clear(); st.last = -1; st.shifted = 0; st.shiftAt = -1; st.unshiftAt = -1; st.shifts = 0; }
export function start(atTime = now()) { st.startAt = atTime; st.baseStartAt = atTime; st.running = true; for (const e of st.entries) e.nextK = null; }
export function stop() { st.running = false; }
export function isRunning() { return st.running; }
export function setBpm(b) { st.bpm = b; st.beatDur = 60 / b; } export function bpm() { return st.bpm; }
export function beatDuration() { return st.beatDur; }
function bf(t = now()) { return (t - st.startAt) / st.beatDur; }
export function beatIndex() { return st.running ? Math.max(0, Math.floor(bf())) : 0; }
export function beatInBar() { return beatIndex() % st.bpb; } export function bar() { return Math.floor(beatIndex() / st.bpb); }
export function beatsPerBar() { return st.bpb; }
export function phase() { if (!st.running) return 0; const b = bf(); return b < 0 ? 0 : b - Math.floor(b); }
export function nextBeatAt(sub = 1) { const step = st.beatDur * sub; const k = Math.floor((now() - st.startAt) / step + 1e-6) + 1; return st.startAt + Math.max(k, 0) * step; }
export function schedule(sub, fn) { const e = { sub, fn, nextK: null }; st.entries.add(e); return () => st.entries.delete(e); }
export function judge(inputAt) {
  const b = bf(inputAt - st.latency / 1000); const n = Math.round(b); const offsetMs = (b - n) * st.beatDur * 1000; const a = Math.abs(offsetMs);
  return { grade: a <= st.windowMs / 3 ? 'parfait' : a <= st.windowMs ? 'bon' : 'rate', offsetMs, beat: n, early: offsetMs < 0 };
}
export function setWindowMs(ms) { st.windowMs = ms; } export function windowMs() { return st.windowMs; }
export function setInputLatencyMs(ms) { st.latency = Math.max(-150, Math.min(150, Number(ms) || 0)); }
export function inputLatencyMs() { return st.latency; }
/** Cri fêlé : la grille recule de `beats` au prochain temps, revient en phase à la première mesure après holdBeats. */
export function shiftGrid(beats = 0.5, holdBeats = 8) {
  if (!st.running || !(beats > 0) || st.shifted || st.shiftAt >= 0) return;
  const k = Math.floor(bf() + 1e-6) + 1;                     // prochain temps (grille courante)
  st.shiftAt = st.startAt + k * st.beatDur; st.shiftBeats = beats;
  const first = k + holdBeats, kb = Math.ceil(first / st.bpb) * st.bpb;   // première mesure après la tenue
  st.unshiftAt = st.startAt + (kb - beats) * st.beatDur + beats * st.beatDur;   // sur la grille décalée, le « 1 » de kb arrive à kb − beats
}
export function gridShift() { return st.shifted; }
/** Nombre de décalages appliqués depuis le départ (tests). */
export function gridShiftCount() { return st.shifts; }
function applyShift(t) {
  if (st.shiftAt >= 0 && t >= st.shiftAt) { st.startAt += st.shiftBeats * st.beatDur; st.shifted = st.shiftBeats; st.shiftAt = -1; st.shifts++; }
  if (st.shifted && st.unshiftAt >= 0 && t >= st.unshiftAt) { st.startAt -= st.shifted * st.beatDur; st.shifted = 0; st.unshiftAt = -1; }
}
export function conductorTick() {
  if (!st.running) return; applyShift(now()); const b = beatIndex(); if (b === st.last) return; st.last = b;
  beatPayload.beat = b; beatPayload.bar = Math.floor(b / st.bpb); beatPayload.beatInBar = b % st.bpb; beatPayload.at = st.startAt + b * st.beatDur;
  bus.emit('beat', beatPayload);
  if (b % st.bpb === 0) { barPayload.bar = beatPayload.bar; barPayload.at = beatPayload.at; bus.emit('bar', barPayload); }
}
export function __advance() {
  if (!st.running) return; const t = now(); applyShift(t); const horizon = t + 0.12;
  for (const e of st.entries) {
    const step = st.beatDur * e.sub;
    if (e.nextK === null) e.nextK = Math.max(0, Math.ceil((t - st.startAt) / step - 1e-6));
    let at = st.startAt + e.nextK * step;
    while (at <= horizon) { e.fn(at, e.nextK * e.sub); e.nextK++; at = st.startAt + e.nextK * step; }
  }
}
export function startAt() { return st.startAt; }
/** Temps audio exact du temps n (robot). */
export function beatTime(n) { return st.startAt + n * st.beatDur; }
