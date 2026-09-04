// Stub de audio/conductor.js : grille simulée ; __advance(dt) appelle les callbacks schedule aux points exacts.
import { now } from './audio.js';
import { bus } from '../../../core/events.js';
const st = { bpm: 96, bpb: 4, beatDur: 60 / 96, running: false, startAt: 0, entries: new Set(), windowMs: 110, last: -1, prevT: 0 };
export function initConductor({ bpm = 96, beatsPerBar = 4 } = {}) { st.bpm = bpm; st.bpb = beatsPerBar; st.beatDur = 60 / bpm; st.entries.clear(); }
export function start(atTime = now()) { st.startAt = atTime; st.running = true; st.prevT = atTime; for (const e of st.entries) e.nextK = 0; }
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
export function judge(inputAt) { const b = bf(inputAt); const n = Math.round(b); const offsetMs = (b - n) * st.beatDur * 1000; const a = Math.abs(offsetMs); return { grade: a <= st.windowMs / 3 ? 'parfait' : a <= st.windowMs ? 'bon' : 'rate', offsetMs, beat: n }; }
export function setWindowMs(ms) { st.windowMs = ms; } export function windowMs() { return st.windowMs; }
export function conductorTick() { if (!st.running) return; const b = beatIndex(); if (b === st.last) return; st.last = b; bus.emit('beat', { beat: b, bar: Math.floor(b / st.bpb), beatInBar: b % st.bpb, at: st.startAt + b * st.beatDur }); if (b % st.bpb === 0) bus.emit('bar', { bar: Math.floor(b / st.bpb), at: st.startAt + b * st.beatDur }); }
/** Le test appelle __advance APRÈS audio.__advance : planifie les points de grille dans (prevT, now]. */
export function __advance() {
  if (!st.running) return; const t = now(); const horizon = t + 0.12;
  for (const e of st.entries) { const step = st.beatDur * e.sub; if (e.nextK === null) e.nextK = Math.max(0, Math.ceil((t - st.startAt) / step - 1e-6)); let at = st.startAt + e.nextK * step; while (at <= horizon) { e.fn(at, e.nextK * e.sub); e.nextK++; at = st.startAt + e.nextK * step; } }
  st.prevT = t;
}
export function startAt() { return st.startAt; }
