// Stub de audio/audio.js : horloge simulée avancée par le test (__advance).
let t = 0; export const counters = { duck: 0, lowpass: 0 };
export async function initAudio() {} export async function unlock() {}
export function ctx() { return null; } export function now() { return t; }
export function busNode() { return null; } export function setVolume() {} export function volume() { return 1; }
export function setAssetsBase() {} export function assetUrl(p) { return p; }
export async function loadBuffer() { return null; } export function getBuffer() { return undefined; }
export function setLowpass() { counters.lowpass++; } export function duck() { counters.duck++; } export function duckCounter() { return counters.duck; }
export function acquireVoice() { return true; } export function releaseVoice() {} export function voiceCount() { return 0; } export function maxVoices() { return 48; }
export function __advance(dt) { t += dt; } export function __setTime(v) { t = v; }
