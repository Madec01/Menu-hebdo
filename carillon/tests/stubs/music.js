// Stub de audio/music.js : la musique est inerte sous Node ; compteurs pour les tests (setDetune, setIntensity).
export const counters = { detune: 0, intensity: 0, layers: 0 };
export function setManifest() {} export function manifest() { return null; }
export async function loadTrack() {} export async function play() {} export function stop() {}
export function setLayers() { counters.layers++; } export function current() { return null; } export function section() { return null; }
export function chordAtTime() { return null; } export function currentChord() { return null; } export function layers() { return 1; }
export function layerGains() { return []; } export function layerTargets() { return []; } export function layerInfo() { return []; }
export function setIntensity() { counters.intensity++; } export function getIntensity() { return 0.5; }
export function setTier() {} export function getTier() { return 0; } export function requestBridge() {}
export function setDetune(cents) { counters.detune++; counters.lastDetune = cents; } export function getDetune() { return counters.lastDetune || 0; }
