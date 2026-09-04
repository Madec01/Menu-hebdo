// Stub de render/lighting.js.
export const counters = { lights: 0, glows: 0 };
export function initLighting() {} export function addLight() { counters.lights++; } export function addGlow() { counters.glows++; }
export function setAmbient() {} export function setBeatPulse() {}
export function setHaloPos() {} export function floorAmbient(c) { return c; } export function drawBeatHalo() {} export function prepareLight() {} export function setHaloRadius() {} export function updateLighting() {} export function ambient() { return '#000'; }
