// Stub de render/fx.js : compte hit-stop, flashs, nombres de dégâts.
export const counters = { hitStop: 0, slowMo: 0, flash: 0, numbers: 0 };
export function hitStop() { counters.hitStop++; } export function slowMo() { counters.slowMo++; } export function flash() { counters.flash++; }
export function damageNumber() { counters.numbers++; } export function updateFx() {} export function renderFx() {}
