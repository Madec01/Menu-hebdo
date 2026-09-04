// Stub de core/input.js pour les tests headless : entrées scriptées par le test.
export const ACTIONS = ['up','down','left','right','dash','parry','pause','confirm','cancel','menuUp','menuDown','menuLeft','menuRight'];
const ax = { x: 0, y: 0 }; const just = {}; const at = {}; const down = {};
export function initInput() {}
export function tickInput() { for (const k in just) just[k] = false; }
export function isDown(a) { return !!down[a]; }
export function justPressed(a) { return !!just[a]; }
export function pressedAt(a) { return at[a] || 0; }
export function axis() { return ax; }
export function pointer() { return { x: 0, y: 0, down: false, worldX: 0, worldY: 0 }; }
export function setBinding() {} export function getBindings() { return {}; } export function resetBindings() {}
export function beginCapture() {} export function hasGamepad() { return false; }
// Pilotage par le test.
export function __setAxis(x, y) { ax.x = x; ax.y = y; }
export function __press(action, t) { just[action] = true; at[action] = t; }
