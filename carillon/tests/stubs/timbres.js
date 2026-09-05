// Stub de audio/timbres.js : les Timbres ne chantent pas sous Node (playTimbre → false : weapons.js joue le bruitage de repli).
export function loadTimbres() { return Promise.resolve(null); }
export function isReady() { return false; }
export function timbresNode() { return null; } export function setTimbresVolume() {}
export function registerOf() { return null; } export function currentRoster() { return []; }
export function playTimbre() { return false; }
