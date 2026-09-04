// Stub de audio/sfx.js : compte les lectures par identifiant.
export const played = {};
export async function loadSfx() {} export function setListener() {}
export function play(id) { played[id] = (played[id] || 0) + 1; } export function playUi(id) { play(id); }
export async function playAmbience() {} export function stopAmbience() {} export function stopAllAmbiences() {}
export function has() { return true; }
