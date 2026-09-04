// Stub de audio/audio.js : horloge simulée pilotée par le test.
let t = 0; export const counters = { duck: 0, lowpass: 0 };
export async function initAudio() {} export async function unlock() {}
export function ctx() { return null; } export function now() { return t; }
export function busNode() { return null; } export function setVolume() {}
export async function loadBuffer() { return null; } export function getBuffer() { return undefined; }
export function setLowpass() { counters.lowpass++; } export function duck() { counters.duck++; }
export function __advance(dt) { t += dt; } export function __setTime(v) { t = v; }
