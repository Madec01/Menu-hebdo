// Stub de render/particles.js : compte les émissions par preset.
export const emitted = {};
export function initParticles() {} export function emit(preset) { emitted[preset] = (emitted[preset] || 0) + 1; }
export function updateParticles() {} export function renderParticles() {} export function setDensity() {}
