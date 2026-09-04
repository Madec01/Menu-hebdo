// Stub de render/atlas.js : aucun dessin ; les anims non bouclées « finissent » après 0,5 s.
const INFO = { frames: 1, fps: 1, loop: true };
export async function loadAtlas() {} export function getManifest() { return null; } export function baseUrl() { return ''; }
export function spriteDef() { return undefined; } export function tileDef() { return undefined; } export function uiDef() { return undefined; }
export function image() { return undefined; } export function prepareTint() { return null; }
export function animFrames() { return INFO; } export function frameAt() { return 0; }
export function animDone(id, anim, t) { return t >= 0.5; }
export function isDirectional() { return false; } export function dirAnim(id, base) { return base; }
export function draw() {} export function drawShadow() {} export function drawTile() {} export function drawNineSlice() {} export function drawIcon() {}
