// Stub de audio/sfx.js : compte les lectures par identifiant (played / stats()). Ambiances, jingles : inertes.
export const played = {};
export async function loadSfx() {} export function setListener() {}
export function play(id) { played[id] = (played[id] || 0) + 1; } export function playUi(id) { play(id); }
export async function playAmbience() {} export function setAmbienceVolume() {} export function stopAmbience() {} export function stopAllAmbiences() {}
export function activeAmbiences() { return []; }
export function stats() { return { ...played }; }
export function has() { return true; }
export function isJingle() { return false; }
