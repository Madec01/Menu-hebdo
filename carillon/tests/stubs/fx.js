// Stub de render/fx.js : compte hit-stop, ralentis, flashs, nombres de dégâts.
export const counters = { hitStop: 0, slowMo: 0, flash: 0, numbers: 0 };
export function initFx() {} export function hitStop() { counters.hitStop++; } export function slowMo() { counters.slowMo++; } export function flash() { counters.flash++; }
export function damageNumber() { counters.numbers++; } export function dashTrail() {} export function updateFx() {} export function renderFx() {} export function isFrozen() { return false; }
export function counts() { return { numbers: counters.numbers, trails: 0 }; }
