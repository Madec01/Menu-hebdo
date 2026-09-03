/* ---------- canvas & caméra ---------- */
const canvas = $('c');
const ctx = canvas.getContext('2d');
const lightC = document.createElement('canvas');
const lctx = lightC.getContext('2d');
const LS = 0.5;   // résolution de la couche de lumière
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  lightC.width = Math.max(1, Math.round(W * LS)); lightC.height = Math.max(1, Math.round(H * LS));
  ZOOM = clamp(Math.min(W, H) / 13 / TILE, 0.7, 1.9);
  const cs = getComputedStyle(document.documentElement);
  SA.t = parseFloat(cs.getPropertyValue('--sat')) || 0; SA.b = parseFloat(cs.getPropertyValue('--sab')) || 0;
  SA.l = parseFloat(cs.getPropertyValue('--sal')) || 0; SA.r = parseFloat(cs.getPropertyValue('--sar')) || 0;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
resize();
function updateCamera(snap) {
  const vw = W / ZOOM, vh = H / ZOOM, rw = RW * TILE, rh = RH * TILE;
  const tx = rw <= vw ? (rw - vw) / 2 : clamp(P.x - vw / 2, 0, rw - vw);
  const ty = rh <= vh ? (rh - vh) / 2 : clamp(P.y - vh / 2, 0, rh - vh);
  if (snap) { camX = tx; camY = ty; } else { camX = lerp(camX, tx, 0.16); camY = lerp(camY, ty, 0.16); }
}
function hash2(x, y) { let h = (x * 374761393 + y * 668265263 + G.room.gx * 1274126177 + G.room.gy * 2246822519 + G.floor * 7919) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; }

/* ---------- cache de la salle ---------- */
/* décors de sol propres à chaque biome (dessinés une fois dans le cache) */
function drawDecor(g, biome, x, y, h, lights) {
  const pal = biome.pal, px = x * TILE, py = y * TILE, k = pal.decoKind, r = h % 100;
  const cx = px + 6 + (h % 20), cy = py + 6 + ((h >> 3) % 20);
  const glow = (gx, gy, rad, col) => { const gr = g.createRadialGradient(gx, gy, 1, gx, gy, rad); gr.addColorStop(0, col + '55'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(gx - rad, gy - rad, rad * 2, rad * 2); lights.push({ x: gx, y: gy, r: rad * 1.6 }); };
  const line = (x1, y1, x2, y2, col, w) => { g.strokeStyle = col; g.lineWidth = w || 1; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const dot = (dx, dy, rad, col) => { g.fillStyle = col; g.beginPath(); g.arc(dx, dy, rad, 0, TAU); g.fill(); };
  if (k === 'bones') {
    if (r < 6) { line(cx - 5, cy + 3, cx + 5, cy - 3, '#c9c2b0', 2); dot(cx - 5, cy + 3, 1.6, '#e0dacc'); dot(cx + 5, cy - 3, 1.6, '#e0dacc'); }
    else if (r < 9) { dot(cx, cy, 4, '#d8d0bc'); dot(cx - 1.5, cy - 0.5, 1, '#2a2a30'); dot(cx + 1.5, cy - 0.5, 1, '#2a2a30'); }
    else if (r < 16) { g.fillStyle = pal.deco; g.fillRect(cx - 4, cy - 2, 7, 4); g.fillRect(cx - 1, cy - 4, 4, 3); }
  } else if (k === 'forest') {
    if (r < 10) { for (let i = -1; i <= 1; i++) { g.strokeStyle = '#4f8a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy + 4); g.quadraticCurveTo(cx + i * 6, cy - 2, cx + i * 9, cy - 8); g.stroke(); } }
    else if (r < 18) { for (let i = 0; i < 4; i++) dot(cx + ((h >> i) % 9) - 4, cy + ((h >> (i + 2)) % 7) - 3, 1.6, i % 2 ? '#a8622a' : '#c98a3a'); }
    else if (r < 22) { dot(cx, cy - 2, 3.5, '#b8433a'); g.fillStyle = '#e8d8b0'; g.fillRect(cx - 1, cy - 1, 2, 4); dot(cx - 1, cy - 3, 0.8, '#fff'); }
    else if (r < 30) { g.strokeStyle = '#3a2a16'; g.lineWidth = 2; g.beginPath(); g.moveTo(px + 2, cy); g.bezierCurveTo(px + 10, cy - 6, px + 20, cy + 6, px + 30, cy); g.stroke(); }
    else if (r < 36) { for (let i = 0; i < 3; i++) line(cx + i * 3 - 3, cy + 4, cx + i * 3 - 4 + (i % 2) * 2, cy - 4, '#6aa04a', 1); }
  } else if (k === 'garden') {
    if (r < 9) { line(cx, cy + 5, cx, cy - 2, '#5fa04a', 1.5); dot(cx, cy - 4, 2.5, ['#ff7bd5', '#ffd97a', '#7fd7ff', '#ff9f43'][h % 4]); }
    else if (r < 20) { g.fillStyle = 'rgba(120,200,90,0.25)'; g.beginPath(); g.ellipse(cx, cy, 8, 5, 0, 0, TAU); g.fill(); }
    else if (r < 24) { dot(cx, cy, 2, '#d8ffb0'); glow(cx, cy, 9, biome.glow || '#b8ff7a'); }
    else if (r < 30) { g.strokeStyle = '#2f5a2a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px + 2, py + 28); g.quadraticCurveTo(px + 14, py + 14, px + 30, py + 26); g.stroke(); }
  } else if (k === 'reeds') {
    if (r < 12) { for (let i = 0; i < 3; i++) { line(cx + i * 3 - 3, cy + 6, cx + i * 3 - 2, cy - 6, '#6a8a3a', 1.2); dot(cx + i * 3 - 2, cy - 6, 1.3, '#4a3a18'); } }
    else if (r < 18) { g.fillStyle = 'rgba(40,80,60,0.35)'; g.beginPath(); g.ellipse(cx, cy, 7, 4, 0, 0, TAU); g.fill(); }
    else if (r < 22) dot(cx, cy, 1.5, '#b8ff6a');
  } else if (k === 'skulls') {
    if (r < 8) { dot(cx, cy, 5, '#e0d8c4'); dot(cx - 2, cy - 1, 1.3, '#2a2420'); dot(cx + 2, cy - 1, 1.3, '#2a2420'); g.fillStyle = '#2a2420'; g.fillRect(cx - 2, cy + 2, 4, 1); }
    else if (r < 16) { line(cx - 5, cy + 2, cx + 5, cy - 2, '#d0c8b4', 2); dot(cx - 5, cy + 2, 1.5, '#e8e0cc'); dot(cx + 5, cy - 2, 1.5, '#e8e0cc'); }
    else if (r < 22) { for (let i = 0; i < 3; i++) dot(cx + i * 4 - 4, cy + (i % 2) * 3, 2, '#c8c0ac'); }
  } else if (k === 'mushrooms') {
    if (r < 10) { const col = ['#d98cff', '#8fd8c8', '#ffb0e0'][h % 3]; g.fillStyle = '#e8e0d0'; g.fillRect(cx - 1, cy - 1, 2, 5); dot(cx, cy - 2, 3.5, col); dot(cx + 3, cy + 2, 2, col); glow(cx, cy - 2, 12, col); }
    else if (r < 18) { g.fillStyle = 'rgba(176,122,216,0.18)'; g.beginPath(); g.ellipse(cx, cy, 7, 4, 0, 0, TAU); g.fill(); }
    else if (r < 24) { for (let i = 0; i < 3; i++) dot(cx + i * 4 - 4, cy + (i % 2) * 3 - 1, 1.2, '#c8b0e0'); }
  } else if (k === 'forge') {
    if (r < 8) { for (let i = 0; i < 3; i++) dot(cx + i * 4 - 4, cy + (i % 2) * 3, 1.3, '#ff9f43'); glow(cx, cy, 8, '#ff7b3a'); }
    else if (r < 16) { g.fillStyle = '#1a1414'; g.fillRect(px + 8, py + 8, 16, 16); g.fillStyle = '#3a2c28'; for (let i = 0; i < 3; i++) g.fillRect(px + 9, py + 10 + i * 5, 14, 2); }
    else if (r < 22) { g.fillStyle = 'rgba(80,70,70,0.6)'; g.beginPath(); g.ellipse(cx, cy, 7, 3, 0, 0, TAU); g.fill(); }
  } else if (k === 'cascade') {
    if (r < 12) { for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? '#6a7a86' : '#8a98a4'; g.beginPath(); g.ellipse(cx + i * 4 - 4, cy + (i % 2) * 3, 2.5, 1.8, 0, 0, TAU); g.fill(); } }
    else if (r < 22) { g.fillStyle = 'rgba(90,160,210,0.28)'; g.beginPath(); g.ellipse(cx, cy, 8, 4, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(200,230,255,0.25)'; g.fillRect(cx - 4, cy - 1, 5, 1); }
    else if (r < 27) { g.fillStyle = 'rgba(80,140,70,0.35)'; g.beginPath(); g.ellipse(cx, cy, 5, 3, 0, 0, TAU); g.fill(); }
  } else if (k === 'crystals') {
    if (r < 9) { const col = h % 2 ? '#ff7bd5' : '#7bffea'; g.fillStyle = col; g.beginPath(); g.moveTo(cx, cy - 8); g.lineTo(cx + 3, cy + 2); g.lineTo(cx - 3, cy + 2); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(cx - 1, cy - 5, 1, 5); glow(cx, cy - 2, 11, col); }
    else if (r < 16) { for (let i = 0; i < 3; i++) dot(cx + i * 4 - 4, cy + (i % 2) * 3, 1.2, '#c8b0ff'); }
  } else if (k === 'ice') {
    if (r < 12) { g.fillStyle = 'rgba(230,245,255,0.5)'; g.beginPath(); g.ellipse(cx, cy, 8, 4, 0, 0, TAU); g.fill(); }
    else if (r < 18) { line(cx - 4, cy + 4, cx + 3, cy - 5, '#e8f8ff', 1.5); line(cx - 2, cy - 4, cx + 4, cy + 3, '#e8f8ff', 1); }
  } else if (k === 'drowned') {
    if (r < 10) { for (let i = -1; i <= 1; i++) { g.strokeStyle = '#3a8a6a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx + i * 4, cy + 6); g.quadraticCurveTo(cx + i * 4 + 3, cy, cx + i * 4 - 1, cy - 8); g.stroke(); } }
    else if (r < 16) { g.fillStyle = '#e8d8c0'; g.beginPath(); g.ellipse(cx, cy, 3.5, 2.5, 0, 0, TAU); g.fill(); line(cx - 2, cy - 1, cx + 2, cy + 1, '#a89880', 1); }
    else if (r < 22) { g.fillStyle = '#5a4a3a'; g.beginPath(); g.moveTo(cx - 5, cy + 3); g.lineTo(cx - 3, cy - 4); g.lineTo(cx + 4, cy - 2); g.lineTo(cx + 2, cy + 4); g.closePath(); g.fill(); }
  } else if (k === 'runes') {
    if (r < 7) { const col = biome.glow || '#c77dff'; g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 5, cy + 5); g.lineTo(cx, cy - 5); g.lineTo(cx + 5, cy + 5); g.moveTo(cx - 3, cy + 1); g.lineTo(cx + 3, cy + 1); g.stroke(); glow(cx, cy, 10, col); }
    else if (r < 14) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx, cy, 7, 4, 0, 0, TAU); g.fill(); }
  }
}
/* styles de murs */
function drawWallStyle(g, pal, x, y, h, front) {
  const px = x * TILE, py = y * TILE, st = pal.wallStyle;
  if (st === 'brick') {
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(px, py + 10, TILE, 1); g.fillRect(px, py + 21, TILE, 1);
    g.fillRect(px + 8 + (h % 5), py, 1, 10); g.fillRect(px + 22 - (h % 5), py + 11, 1, 10);
  } else if (st === 'rough') {
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.beginPath();
    g.moveTo(px + 2, py + 8 + (h % 6)); g.lineTo(px + 12 + (h % 5), py + 6 + (h % 9)); g.lineTo(px + 20, py + 16 + (h % 5)); g.lineTo(px + 30, py + 12 + (h % 7));
    g.moveTo(px + 12 + (h % 5), py + 6 + (h % 9)); g.lineTo(px + 8 + (h % 7), py + 26); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(px + 3 + (h % 7), py + 3, 6, 3);
  } else if (st === 'bone') {
    g.fillStyle = 'rgba(255,250,235,0.16)'; g.beginPath(); g.ellipse(px + 9 + (h % 6), py + 9 + (h % 5), 5, 4, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(px + 7 + (h % 6), py + 8 + (h % 5), 1.2, 0, TAU); g.arc(px + 11 + (h % 6), py + 8 + (h % 5), 1.2, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,250,235,0.14)'; g.fillRect(px + 16, py + 20 + (h % 6), 12, 2);
  } else if (st === 'crystal') {
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 4 + (h % 8), py + 30); g.lineTo(px + 14 + (h % 6), py + 4); g.lineTo(px + 26, py + 18 + (h % 8)); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(px + 14 + (h % 6), py + 4); g.lineTo(px + 20, py + 12); g.lineTo(px + 10, py + 14); g.closePath(); g.fill();
  } else if (st === 'roots') {
    g.strokeStyle = 'rgba(40,70,30,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py + 6 + (h % 10)); g.bezierCurveTo(px + 10, py + 2 + (h % 8), px + 20, py + 20 + (h % 6), px + TILE, py + 14 + (h % 9)); g.stroke();
    if (h % 3 === 0) { g.fillStyle = 'rgba(120,200,90,0.5)'; g.beginPath(); g.ellipse(px + 8 + (h % 14), py + 8 + (h % 12), 3, 1.8, 0.6, 0, TAU); g.fill(); }
  }
  if (front && st === 'roots') { g.strokeStyle = 'rgba(40,70,30,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px + 6 + (h % 12), py + TILE * 0.55); g.lineTo(px + 8 + (h % 10), py + TILE); g.stroke(); }
  // touches propres au biome sur les murs
  if (pal.decoKind === 'forest') {   // cimes vues du dessus
    g.fillStyle = h % 3 ? 'rgba(46,92,44,0.9)' : 'rgba(58,110,50,0.9)'; g.beginPath(); g.arc(px + 16 + (h % 5) - 2, py + 14 + (h % 5) - 2, 13 + (h % 4), 0, TAU); g.fill();
    g.fillStyle = 'rgba(120,190,90,0.35)'; g.beginPath(); g.arc(px + 12 + (h % 6), py + 10 + (h % 6), 5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(px + 20 + (h % 4), py + 20 + (h % 5), 4, 0, TAU); g.fill();
  } else if (pal.decoKind === 'cascade' && front && h % 4 === 0) {   // filets d'eau sur la face
    g.fillStyle = 'rgba(160,220,255,0.45)'; g.fillRect(px + 6 + (h % 14), py + TILE * 0.55, 2, TILE * 0.45); g.fillRect(px + 10 + (h % 14), py + TILE * 0.62, 1, TILE * 0.38);
  } else if (pal.decoKind === 'mushrooms' && h % 5 === 0) {
    g.fillStyle = h % 2 ? '#d98cff' : '#8fd8c8'; g.beginPath(); g.arc(px + 8 + (h % 16), py + 8 + (h % 14), 2, 0, TAU); g.fill();
  } else if (pal.decoKind === 'garden' && h % 4 === 0) {
    g.fillStyle = ['#ff7bd5', '#ffd97a', '#7fd7ff'][h % 3]; g.beginPath(); g.arc(px + 8 + (h % 16), py + 6 + (h % 12), 1.8, 0, TAU); g.fill();
  }
}
function buildRoomCache(room) {
  const biome = G.floorData.biome, pal = biome.pal, S = 2, envers = G.world === 'envers', lights = [];
  const c = document.createElement('canvas'); c.width = RW * TILE * S; c.height = RH * TILE * S;
  const g = c.getContext('2d'); g.scale(S, S);
  const t = curTiles(room);
  const isWall = (x, y) => x < 0 || y < 0 || x >= RW || y >= RH || t[y][x] === T_WALL;
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    const v = t[y][x], px = x * TILE, py = y * TILE, h = hash2(x, y);
    if (v !== T_WALL) {
      g.fillStyle = (h % 5 === 0) ? pal.floor2 : pal.floor; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(255,255,255,0.025)'; if (h % 3 === 0) g.fillRect(px + (h % 7) * 3, py + (h % 11) * 2, 5, 3);
      g.fillStyle = 'rgba(0,0,0,0.12)'; if (h % 4 === 1) g.fillRect(px + (h % 13) * 2, py + (h % 5) * 5, 8, 2);
      if (h % 9 === 2) { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 4, py + 10 + (h % 8)); g.lineTo(px + 14 + (h % 6), py + 18); g.lineTo(px + 26, py + 12 + (h % 9)); g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      if (v === T_FLOOR) drawDecor(g, biome, x, y, h, lights);
    }
    if (v === T_MUD) {
      g.fillStyle = 'rgba(70,45,22,0.85)'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(40,25,10,0.6)'; g.beginPath(); g.ellipse(px + 10 + (h % 12), py + 10 + (h % 10), 7, 4, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(120,90,50,0.3)'; g.beginPath(); g.ellipse(px + 20 - (h % 8), py + 22 - (h % 7), 4, 2.5, 0, 0, TAU); g.fill();
      if (!isWall(x, y - 1) && t[y - 1][x] !== v) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py, TILE, 3); }
    } else if (v === T_SPIKES) {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      g.fillStyle = '#4a4a52'; g.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      g.fillStyle = '#2a2a30'; for (const [ox, oy] of [[9, 9], [23, 9], [9, 23], [23, 23], [16, 16]]) { g.beginPath(); g.arc(px + ox, py + oy, 2.2, 0, TAU); g.fill(); }
    } else if (v === T_WATER || v === T_POISON) {
      g.fillStyle = v === T_WATER ? 'rgba(40,90,140,0.8)' : 'rgba(80,150,40,0.75)'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = v === T_WATER ? 'rgba(120,180,220,0.25)' : 'rgba(180,255,90,0.25)';
      g.beginPath(); g.ellipse(px + 10 + (h % 10), py + 8 + (h % 12), 6, 2, 0, 0, TAU); g.fill();
      if (!isWall(x, y - 1) && t[y - 1][x] !== v) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py, TILE, 3); }
    } else if (v === T_LAVA) {
      const gr = g.createRadialGradient(px + 16, py + 16, 2, px + 16, py + 16, 24); gr.addColorStop(0, '#ffb347'); gr.addColorStop(0.5, '#ff6a2a'); gr.addColorStop(1, '#8a2a10');
      g.fillStyle = gr; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(60,10,0,0.5)'; g.beginPath(); g.arc(px + 8 + (h % 14), py + 8 + (h % 12), 4, 0, TAU); g.fill();
    } else if (v === T_ICE) {
      g.fillStyle = 'rgba(180,225,255,0.55)'; g.fillRect(px, py, TILE, TILE);
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px + (h % 10), py + 4); g.lineTo(px + 14 + (h % 8), py + 16); g.lineTo(px + 8 + (h % 12), py + 28); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(px + 3, py + 3, 8, 2);
    } else if (v === T_SHADOW) {
      g.fillStyle = 'rgba(40,20,70,0.85)'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(180,140,255,0.12)'; g.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      g.strokeStyle = 'rgba(200,170,255,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 6, py + 20 + (h % 6)); g.quadraticCurveTo(px + 16, py + 6 + (h % 9), px + 26, py + 18); g.stroke();
    } else if (v === T_BRIDGE || v === T_GLYPHE) {
      g.fillStyle = '#5a4030'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 4; i++) g.fillRect(px, py + 6 + i * 8, TILE, 2);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(px, py + 2, TILE, 2);
      if (v === T_GLYPHE) { g.fillStyle = '#c77dff'; g.fillRect(px + 9, py + 9, 14, 14); g.fillStyle = '#fff'; g.fillRect(px + 13, py + 13, 6, 6); }
    } else if (v === T_PIT || v === T_GLYPH) {
      g.fillStyle = '#05040a'; g.fillRect(px, py, TILE, TILE);
      const gr = g.createLinearGradient(px, py, px, py + 10); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      if (!isWall(x, y - 1) && t[y - 1][x] !== T_PIT && t[y - 1][x] !== T_GLYPH) { g.fillStyle = gr; g.fillRect(px, py, TILE, 10); }
    }
  }
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    if (t[y][x] !== T_WALL) continue;
    const px = x * TILE, py = y * TILE, h = hash2(x, y);
    g.fillStyle = pal.wallTop; g.fillRect(px, py, TILE, TILE);
    g.fillStyle = 'rgba(0,0,0,0.12)'; if (h % 2) g.fillRect(px + 2 + (h % 9), py + 4 + (h % 13), 10, 4);
    drawWallStyle(g, pal, x, y, h, !isWall(x, y + 1));
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    if (!isWall(x, y + 1)) {   // face avant
      g.fillStyle = pal.wall; g.fillRect(px, py + TILE * 0.55, TILE, TILE * 0.45);
      g.fillStyle = pal.wallEdge; g.fillRect(px, py + TILE * 0.55, TILE, 2);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py + TILE * 0.85, TILE, TILE * 0.15);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(px + 6 + (h % 8), py + TILE * 0.7, 10, 2);
    }
    if (!isWall(x, y - 1)) { g.fillStyle = pal.wallEdge; g.fillRect(px, py, TILE, 2); }
    if (!isWall(x - 1, y)) { g.fillStyle = pal.wallEdge; g.fillRect(px, py, 2, TILE); }
    if (!isWall(x + 1, y)) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px + TILE - 2, py, 2, TILE); }
  }
  // ombre portée des murs sur le sol
  g.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 0; y < RH - 1; y++) for (let x = 0; x < RW; x++) if (t[y][x] === T_WALL && t[y + 1][x] !== T_WALL) g.fillRect(x * TILE, (y + 1) * TILE, TILE, 6);
  room.decoLights = lights;
  if (envers) room.cacheE = c; else room.cache = c;
}

/* ---------- salle ---------- */
function drawRoom() {
  const room = G.room, t = curTiles(room), pal = G.floorData.biome.pal, tk = P.tick, envers = G.world === 'envers';
  if (envers ? !room.cacheE : !room.cache) buildRoomCache(room);
  ctx.drawImage(envers ? room.cacheE : room.cache, 0, 0, RW * TILE, RH * TILE);
  const vw = W / ZOOM, vh = H / ZOOM;
  const x0 = Math.max(0, Math.floor(camX / TILE)), x1 = Math.min(RW - 1, Math.floor((camX + vw) / TILE));
  const y0 = Math.max(0, Math.floor(camY / TILE)), y1 = Math.min(RH - 1, Math.floor((camY + vh) / TILE));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const v = t[y][x], px = x * TILE, py = y * TILE;
    if (v === T_WATER || v === T_POISON) {
      const ph = tk * 1.5 + hash2(x, y) % 7;
      ctx.strokeStyle = v === T_WATER ? 'rgba(160,210,255,0.35)' : 'rgba(200,255,120,0.3)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px + 6, py + 16 + Math.sin(ph) * 4); ctx.quadraticCurveTo(px + 16, py + 12 + Math.sin(ph + 1) * 4, px + 26, py + 16 + Math.sin(ph + 2) * 4); ctx.stroke();
      if (v === T_POISON && Math.random() < 0.01) burst(px + Math.random() * TILE, py + Math.random() * TILE, 1, '#b8ff6a', 20, { shape: 'dot', life: 0.8, grav: -40 });
    } else if (v === T_LAVA) {
      ctx.fillStyle = 'rgba(255,200,80,' + (0.12 + 0.1 * Math.sin(tk * 3 + hash2(x, y) % 5)) + ')'; ctx.fillRect(px, py, TILE, TILE);
      if (Math.random() < 0.02) burst(px + Math.random() * TILE, py + Math.random() * TILE, 1, '#ffb347', 30, { shape: 'dot', glow: 1, life: 0.9, grav: -60 });
    } else if (v === T_ICE) {
      if (((hash2(x, y) + Math.floor(tk * 2)) % 11) === 0) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(px + 12, py + 12, 3, 3); }
    } else if (v === T_MUD) {
      if (((hash2(x, y) + Math.floor(tk * 1.5)) % 13) === 0) { ctx.strokeStyle = 'rgba(160,120,70,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px + 8 + hash2(x, y) % 16, py + 8 + (hash2(x, y) >> 4) % 16, 2 + (tk * 4 % 2), 0, TAU); ctx.stroke(); }
    } else if (v === T_SPIKES) {
      const ph = G.time % 3.2, up = ph < 1.3, warn = ph > 2.85;
      if (up || warn) {
        const hgt = up ? 9 : 3;
        ctx.fillStyle = up ? '#c8c8d0' : '#8a8a94';
        for (const [ox, oy] of [[9, 9], [23, 9], [9, 23], [23, 23], [16, 16]]) { ctx.beginPath(); ctx.moveTo(px + ox - 3, py + oy + 2); ctx.lineTo(px + ox, py + oy - hgt); ctx.lineTo(px + ox + 3, py + oy + 2); ctx.closePath(); ctx.fill(); }
        if (up) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (const [ox, oy] of [[9, 9], [23, 9], [9, 23], [23, 23], [16, 16]]) ctx.fillRect(px + ox - 1, py + oy - 6, 1, 4); }
      }
    } else if (v === T_DOOR) {
      ctx.fillStyle = '#07060c'; ctx.fillRect(px, py, TILE, TILE);
      const g = ctx.createRadialGradient(px + TILE / 2, py + TILE / 2, 2, px + TILE / 2, py + TILE / 2, TILE);
      g.addColorStop(0, pal.accent.replace(')', ',0.35)').replace('#', 'rgba(').replace(/rgba\((\w\w)(\w\w)(\w\w)/, (m, r, gg, b) => `rgba(${parseInt(r, 16)},${parseInt(gg, 16)},${parseInt(b, 16)}`)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(px - TILE / 2, py - TILE / 2, TILE * 2, TILE * 2);
      ctx.fillStyle = pal.wallEdge; if (y === 0 || y === RH - 1) { ctx.fillRect(px - 2, py, 3, TILE); ctx.fillRect(px + TILE - 1, py, 3, TILE); } else { ctx.fillRect(px, py - 2, TILE, 3); ctx.fillRect(px, py + TILE - 1, TILE, 3); }
    } else if (v === T_SEALED) {
      ctx.fillStyle = '#0d0c14'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#4a3a6a'; const vert2 = y === 0 || y === RH - 1;
      for (let i = 0; i < 3; i++) { if (vert2) ctx.fillRect(px + 5 + i * 9, py + 3, 4, TILE - 6); else ctx.fillRect(px + 3, py + 5 + i * 9, TILE - 6, 4); }
      ctx.strokeStyle = 'rgba(199,125,255,' + (0.6 + 0.3 * Math.sin(tk * 3)) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px + 5, py + 5); ctx.lineTo(px + TILE - 5, py + TILE - 5); ctx.moveTo(px + TILE - 5, py + 5); ctx.lineTo(px + 5, py + TILE - 5); ctx.stroke();
    } else if (v === T_GLYPHE) {
      ctx.fillStyle = 'rgba(199,125,255,' + (0.15 + 0.15 * Math.sin(tk * 4 + x)) + ')'; ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
    } else if (v === T_DOORC) {
      ctx.fillStyle = '#0d0c14'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#6b6f86'; const vert = y === 0 || y === RH - 1;
      for (let i = 0; i < 3; i++) { if (vert) ctx.fillRect(px + 5 + i * 9, py + 3, 4, TILE - 6); else ctx.fillRect(px + 3, py + 5 + i * 9, TILE - 6, 4); }
      ctx.fillStyle = '#9a9eb8'; if (vert) ctx.fillRect(px + 3, py + TILE / 2 - 2, TILE - 6, 4); else ctx.fillRect(px + TILE / 2 - 2, py + 3, 4, TILE - 6);
    }
  }
  drawTorches(room, tk);
  // accessoires de la salle
  const cx = RW * TILE / 2, cy = RH * TILE / 2;
  for (const pr of room.props) if (pr.world === 'both' || (pr.world || 'normal') === G.world) drawProp(pr, tk);
  // flèche vers la fissure quand le Voile suffit
  if (G.world === 'normal') { const fis = room.props.find(p => p.kind === 'fissure'); if (fis && G.voile >= 30 * (P.voileCostMul || 1) && dist(fis.x, fis.y, P.x, P.y) > 110) {
    const a = Math.atan2(fis.y - P.y, fis.x - P.x), d0 = 34 + Math.sin(tk * 5) * 4, ax = P.x + Math.cos(a) * d0, ay = P.y + Math.sin(a) * d0;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.fillStyle = 'rgba(199,125,255,' + (0.55 + 0.35 * Math.sin(tk * 5)) + ')'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.restore();
  } }
  if (room.stairs) {
    drawSprite('stairs', 0, cx, cy, { anchor: 'center', scale: 1.25 });
    ctx.strokeStyle = 'rgba(127,215,255,' + (0.5 + 0.4 * Math.sin(tk * 5)) + ')'; ctx.lineWidth = 2; ctx.strokeRect(cx - 22, cy - 22, 44, 44);
  }
  // mares
  for (const p of pools) {
    const a = clamp(p.life / 1.2, 0, 1) * 0.75;
    ctx.fillStyle = p.type === 'poison' ? `rgba(120,220,60,${a})` : `rgba(255,120,40,${a})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.75, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = p.type === 'poison' ? `rgba(200,255,120,${a * 0.5})` : `rgba(255,220,120,${a * 0.6})`;
    ctx.beginPath(); ctx.ellipse(p.x + Math.sin(tk * 2 + p.ph) * 6, p.y - 3, p.r * 0.4, p.r * 0.25, 0, 0, TAU); ctx.fill();
  }
  // zones télégraphiées
  for (const z of zones) {
    const k = clamp(z.t / z.dur, 0, 1);
    ctx.strokeStyle = z.color; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
    if (z.kind === 'circle') {
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke();
      ctx.fillStyle = z.color; ctx.globalAlpha = 0.25 + 0.25 * k; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * k, 0, TAU); ctx.fill();
    } else {
      ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(z.x1, z.y1); ctx.lineTo(z.x2, z.y2); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.2 + 0.4 * k; ctx.lineWidth = z.w * k; ctx.beginPath(); ctx.moveTo(z.x1, z.y1); ctx.lineTo(z.x2, z.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
/* ---------- lumière ---------- */
function drawLighting() {
  const biome = G.floorData.biome;
  let dark = G.world === 'envers' ? 0.42 : biome.dark + ((G.oath && G.oath.dark) || 0);
  if (G.room.type === 'boss' && !G.room.cleared) dark = Math.min(0.92, dark + 0.05);
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = `rgba(3,2,8,${clamp(dark, 0, 0.95)})`; lctx.fillRect(0, 0, lightC.width, lightC.height);
  lctx.globalCompositeOperation = 'destination-out';
  const light = (x, y, r, i) => {
    const sx = (x - camX) * ZOOM * LS, sy = (y - camY) * ZOOM * LS, sr = r * ZOOM * LS;
    if (sx + sr < 0 || sy + sr < 0 || sx - sr > lightC.width || sy - sr > lightC.height) return;
    const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, sr); g.addColorStop(0, `rgba(0,0,0,${i})`); g.addColorStop(0.5, `rgba(0,0,0,${i * 0.5})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g; lctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  };
  const brume = G.oath && G.oath.dark;
  light(P.x, P.y, brume ? 150 : 250, 1);
  for (const tc of G.room.torches) light(tc.x, tc.y - 4, 120 + Math.sin(P.tick * 11 + tc.x) * 8, 0.85);
  if (G.room.decoLights) for (const dl of G.room.decoLights) light(dl.x, dl.y, dl.r + Math.sin(P.tick * 3 + dl.x) * 3, 0.45);
  const t = curTiles();
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) { const v = t[y][x]; if (v === T_GLYPHE) light((x + 0.5) * TILE, (y + 0.5) * TILE, 40, 0.5); else if (v === T_LAVA) light((x + 0.5) * TILE, (y + 0.5) * TILE, 52, 0.55); else if (v === T_DOOR) light((x + 0.5) * TILE, (y + 0.5) * TILE, 70, 0.7); }
  for (const b of bullets) light(b.x, b.y, b.friendly ? 26 : 22, 0.6);
  for (const e of enemies) if (e.spawnT <= 0 && inWorld(e)) light(e.x, e.y, e.boss ? 120 : e.elite || e.hunter ? 70 : e.r + 34, e.boss ? 0.75 : e.elite || e.hunter ? 0.7 : 0.4);
  for (const p of pools) if (p.type === 'fire') light(p.x, p.y, p.r * 1.6, 0.6);
  for (const pr of G.room.props) if (!pr.used && (pr.world === 'both' || (pr.world || 'normal') === G.world)) light(pr.x, pr.y, pr.kind === 'fissure' ? 60 : pr.kind === 'tablet' ? 50 : 80, 0.8);
  if (G.room.stairs) light(RW * TILE / 2, RH * TILE / 2, 90, 0.9);
  for (const pt of parts) if (pt.glow) light(pt.x, pt.y, pt.size * 6, 0.5 * clamp(pt.life / pt.max, 0, 1));
  for (const pet of G.pets) light(pet.x, pet.y, 45, 0.7);
  for (const z of zones) light(z.kind === 'circle' ? z.x : z.x1, z.kind === 'circle' ? z.y : z.y1, 60, 0.5);
  for (const bm of beams) if (bm.t > bm.warm) for (let i = 0; i < 6; i++) light(bm.x + Math.cos(bm.ang) * bm.len * i / 6, bm.y + Math.sin(bm.ang) * bm.len * i / 6, 70, 0.6);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.drawImage(lightC, 0, 0, W, H);
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

/* ---------- HUD ---------- */
function heartPath(x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + s);
  ctx.bezierCurveTo(x - s * 1.15, y + s * 0.25, x - s * 0.7, y - s * 0.55, x, y - s * 0.05);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 0.55, x + s * 1.15, y + s * 0.25, x, y + s); ctx.closePath();
}
function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const left = 14 + SA.l, top = 12 + SA.t, biome = G.floorData.biome;
  const F = '"Nunito", system-ui, sans-serif', FD = '"Cinzel", Georgia, serif';
  // cœurs
  const hearts = P.maxHp / 2, hs = 9, perRow = 10, rows = Math.ceil(hearts / perRow);
  for (let i = 0; i < hearts; i++) {
    const x = left + 12 + (i % perRow) * 24, y = top + 10 + Math.floor(i / perRow) * 22;
    heartPath(x, y, hs); ctx.fillStyle = '#3a2030'; ctx.fill();
    const v = P.hp - i * 2;
    if (v >= 2) { heartPath(x, y, hs); ctx.fillStyle = '#ff4f6d'; ctx.fill(); }
    else if (v === 1) { ctx.save(); ctx.beginPath(); ctx.rect(x - hs * 1.3, y - hs, hs * 1.3, hs * 2.2); ctx.clip(); heartPath(x, y, hs); ctx.fillStyle = '#ff4f6d'; ctx.fill(); ctx.restore(); }
    heartPath(x, y, hs); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  let y = top + 24 + (rows - 1) * 22;
  // arme
  ctx.font = '16px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
  ctx.fillText(curWeapon().ic, left, y);
  ctx.font = 'bold 12px ' + F; ctx.fillStyle = '#ece6d8'; ctx.fillText(curWeapon().name, left + 22, y + 2);
  y += 22;
  // dash & surcharge
  const bw = 120;
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(left, y, bw, 5);
  const ready = P.dashCdT <= 0 && !P.noDash;
  ctx.fillStyle = P.noDash ? '#555' : ready ? '#7fd7ff' : 'rgba(127,215,255,0.5)';
  ctx.fillRect(left, y, bw * (P.noDash ? 1 : ready ? 1 : clamp(1 - P.dashCdT / P.dashCd, 0, 1)), 5);
  ctx.font = '9px ' + F; ctx.fillStyle = 'rgba(236,230,216,0.7)'; ctx.fillText(P.noDash ? 'DASH (serment)' : 'DASH', left, y + 7);
  y += 20;
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(left, y, bw, 5);
  const sr = G.surge >= 100;
  ctx.fillStyle = sr ? '#ffd97a' : 'rgba(255,217,122,0.55)'; ctx.fillRect(left, y, bw * clamp(G.surge / 100, 0, 1), 5);
  if (sr) { ctx.strokeStyle = 'rgba(255,217,122,' + (0.5 + 0.5 * Math.sin(P.tick * 8)) + ')'; ctx.lineWidth = 1; ctx.strokeRect(left - 1, y - 1, bw + 2, 7); }
  ctx.fillStyle = 'rgba(236,230,216,0.7)'; ctx.fillText(sr ? 'SURCHARGE PRÊTE' : 'SURCHARGE', left, y + 7);
  y += 20;
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(left, y, bw, 5);
  const vc = G.world === 'normal' ? crossCost() : 0, vr = G.voile >= Math.max(1, vc);
  ctx.fillStyle = G.world === 'envers' ? '#e0d0ff' : vr ? '#c77dff' : 'rgba(199,125,255,0.5)'; ctx.fillRect(left, y, bw * clamp(G.voile / 100, 0, 1), 5);
  if (G.world === 'normal' && vc <= 100) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(left + bw * vc / 100 - 1, y - 2, 2, 9); }
  const fisHere = G.world === 'normal' && G.room.props.some(p => p.kind === 'fissure');
  ctx.fillStyle = (G.world === 'normal' && vr && fisHere) ? 'rgba(224,208,255,' + (0.6 + 0.4 * Math.sin(P.tick * 6)) + ')' : 'rgba(236,230,216,0.7)';
  ctx.fillText(G.world === 'envers' ? 'VOILE (drain)' : nearFissure() ? (vr ? 'VOILE — V pour traverser (' + vc + ')' : 'VOILE — il manque ' + Math.ceil(vc - G.voile)) : (vr && fisHere) ? 'VOILE PRÊT — rejoins la fissure ◐' : vr ? 'VOILE PRÊT (' + vc + ' à une fissure)' : 'VOILE', left, y + 7);
  if (P.shield) { ctx.font = '10px ' + F; ctx.fillText(P.shieldT <= 0 ? '🛡️ prêt' : '🛡️ ' + Math.ceil(P.shieldT) + 's', left + bw + 10, y - 13); }
  y += 22;
  if (G.relics.length) { ctx.font = '14px system-ui, sans-serif'; let s = ''; for (const r of G.relics) s += r.ic; ctx.fillText(s, left, y); y += 20; }
  if (G.oath) { ctx.font = '11px ' + F; ctx.fillStyle = '#c77dff'; ctx.fillText(G.oath.ic + ' ' + G.oath.n, left, y); }
  // droite
  const right = W - 14 - SA.r - (document.body.classList.contains('playing') ? 44 : 0);
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffd97a'; ctx.font = 'bold 15px ' + FD; ctx.fillText('Étage ' + G.floor, right, top);
  ctx.fillStyle = 'rgba(236,230,216,0.75)'; ctx.font = '11px ' + F; ctx.fillText(biome.name, right, top + 19);
  ctx.fillStyle = '#ece6d8'; ctx.font = 'bold 13px ' + F; ctx.fillText(Math.floor(G.essence) + ' ◆   ' + G.kills + ' ☠', right, top + 34);
  // menace
  const mk = clamp(G.menaceT / G.menaceMax, 0, 1), mx = right - 9, my = top + 62;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mx, my, 8, 0, TAU); ctx.stroke();
  ctx.strokeStyle = G.hunterAlive ? '#ff2244' : mk > 0.75 ? '#ff5e7a' : '#c77dff'; ctx.beginPath(); ctx.arc(mx, my, 8, -Math.PI / 2, -Math.PI / 2 + TAU * mk); ctx.stroke();
  ctx.fillStyle = 'rgba(236,230,216,0.7)'; ctx.font = '9px ' + F; ctx.fillText(G.hunterAlive ? 'TRAQUEUR' : 'MENACE', mx - 12, my - 5);
  // minimap
  const fd = G.floorData, cs = 9, gap = 2;
  const known = fd.list.filter(r => r.visited || DIRS.some(d => { const n = fd.rooms.get(fd.key(r.gx + d[0], r.gy + d[1])); return n && n.visited; }));
  let minx = 1e9, maxx = -1e9, miny = 1e9;
  for (const r of known) { minx = Math.min(minx, r.gx); maxx = Math.max(maxx, r.gx); miny = Math.min(miny, r.gy); }
  const mw = (maxx - minx + 1) * (cs + gap), ox = right - mw, oy = my + 16;
  const typeCol = { boss: '#ff5e7a', treasure: '#ffd97a', shop: '#8fe388', shrine: '#c77dff', challenge: '#ff9f43', armory: '#7fd7ff' };
  if (G.world === 'envers') { ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(199,125,255,' + (0.7 + 0.3 * Math.sin(P.tick * 3)) + ')'; ctx.font = 'bold 14px ' + FD; ctx.fillText("L'ENVERS", W / 2, top + (enemies.some(e => e.boss && !e.dead) ? 36 : 6)); ctx.font = '11px ' + F; ctx.fillStyle = 'rgba(236,230,216,0.8)'; ctx.fillText(Math.ceil(G.voile / 4) + ' s de Voile', W / 2, top + (enemies.some(e => e.boss && !e.dead) ? 54 : 24)); ctx.textAlign = 'right'; }
  for (const r of known) {
    const x = ox + (r.gx - minx) * (cs + gap), yy = oy + (r.gy - miny) * (cs + gap);
    const base = typeCol[r.type];
    ctx.fillStyle = base ? base : 'rgba(236,230,216,0.6)'; ctx.globalAlpha = r.visited ? 1 : 0.4; ctx.fillRect(x, yy, cs, cs); ctx.globalAlpha = 1;
    if (r.fissure && r.visited) { ctx.fillStyle = '#c77dff'; ctx.fillRect(x + cs - 4, yy, 4, 4); }
    if (r.sealed && !r.visited && r.type !== 'boss') { ctx.strokeStyle = 'rgba(199,125,255,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, yy + 0.5, cs - 1, cs - 1); }
    if (r === G.room) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 1, yy - 1, cs + 2, cs + 2); }
  }
  // combo
  if (G.combo >= 3 && G.comboT > 0) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const k = clamp(G.comboT / (3 + P.comboWindow), 0, 1), sz = 26 + Math.min(14, G.combo);
    ctx.font = 'bold ' + sz + 'px ' + FD; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(G.combo + '×', W - 60 - SA.r + 1, H * 0.4 + 1);
    ctx.fillStyle = '#ffd97a'; ctx.globalAlpha = 0.5 + 0.5 * k; ctx.fillText(G.combo + '×', W - 60 - SA.r, H * 0.4); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(W - 90 - SA.r, H * 0.4 + sz * 0.7, 60, 3); ctx.fillStyle = '#ffd97a'; ctx.fillRect(W - 90 - SA.r, H * 0.4 + sz * 0.7, 60 * k, 3);
  }
  // barre de boss
  const boss = enemies.find(e => e.boss && !e.dead);
  if (boss) {
    const bw2 = Math.min(380, W * 0.55), bx = W / 2 - bw2 / 2, by = top + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 2, by - 2, bw2 + 4, 14);
    ctx.fillStyle = boss.hp < boss.maxHp * 0.45 ? '#ff2244' : '#ff5e7a'; ctx.fillRect(bx, by, bw2 * clamp(boss.hp / boss.maxHp, 0, 1), 10);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx, by, bw2 * clamp(boss.hp / boss.maxHp, 0, 1), 3);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px ' + FD; ctx.textAlign = 'center'; ctx.fillText(boss.name, W / 2, by + 15);
  }
  // vagues d'épreuve
  if (G.room.challengeOn) { ctx.textAlign = 'center'; ctx.fillStyle = '#ff9f43'; ctx.font = 'bold 13px ' + FD; ctx.fillText('Épreuve — vague ' + G.room.wave + ' / ' + G.room.waves, W / 2, top + (boss ? 34 : 6)); }
  // bannière
  if (banner) {
    const a = banner.life > banner.max - 0.4 ? (banner.max - banner.life) / 0.4 : banner.life < 0.5 ? banner.life / 0.5 : 1;
    ctx.globalAlpha = clamp(a, 0, 1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.2, 'rgba(0,0,0,0.6)'); g.addColorStop(0.8, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.3 - 34, W, 70);
    const age = banner.max - banner.life, sc = 1 + Math.max(0, 0.35 - age) * 0.6;
    ctx.save(); ctx.translate(W / 2, H * 0.3 - 8); ctx.scale(sc, sc); ctx.fillStyle = banner.color; ctx.font = 'bold 26px ' + FD; ctx.fillText(banner.t, 0, 0); ctx.restore();
    ctx.fillStyle = '#ece6d8'; ctx.font = '13px ' + F; ctx.fillText(banner.s.slice(0, Math.floor(Math.max(0, age - 0.25) * 60)), W / 2, H * 0.3 + 18);
    ctx.globalAlpha = 1;
  }
  if (hint) {
    ctx.globalAlpha = clamp(hint.life, 0, 1); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.font = 'bold 13px ' + F;
    const maxW = W - 40 - SA.l - SA.r, lines = [];
    let cur = '';
    for (const word of hint.t.split(' ')) { const test = cur ? cur + ' ' + word : word; if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; } else cur = test; }
    if (cur) lines.push(cur);
    const tw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width))) + 24;
    const hy = H - 22 - SA.b - (document.body.classList.contains('touch') ? 110 : 0);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W / 2 - tw / 2, hy - 8 - 18 * lines.length, tw, 12 + 18 * lines.length);
    if (!hint.t0) hint.t0 = performance.now();
    let budget = Math.floor((performance.now() - hint.t0) / 16);
    ctx.fillStyle = '#ffd97a'; lines.forEach((l, i) => { const part = l.slice(0, Math.max(0, budget)); budget -= l.length + 1; ctx.textAlign = 'left'; const lw = ctx.measureText(l).width; ctx.fillText(part, W / 2 - lw / 2, hy - 18 * (lines.length - 1 - i)); }); ctx.textAlign = 'center'; ctx.globalAlpha = 1;
  }
  // joysticks
  for (const o of touches.values()) {
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.sx, o.sy, 52, 0, TAU); ctx.stroke();
    ctx.fillStyle = o.side === 'L' ? 'rgba(255,255,255,0.35)' : 'rgba(255,217,122,0.5)'; ctx.beginPath(); ctx.arc(o.x, o.y, 22, 0, TAU); ctx.fill();
  }
  drawTutorial();
  if (flash > 0) { ctx.fillStyle = `rgba(${flashColor},${flash * 0.55})`; ctx.fillRect(0, 0, W, H); }
  if (transT > 0) { ctx.fillStyle = 'rgba(0,0,0,' + clamp(transT / 0.3, 0, 1) * 0.85 + ')'; ctx.fillRect(0, 0, W, H); }
}

/* ---------- rendu principal ---------- */
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, W, H);
  if (!G) {
    const t = performance.now() / 1000;
    for (let i = 0; i < 50; i++) {
      const x = ((i * 137.5) % W + Math.sin(t * 0.3 + i) * 20), y = ((i * 91.3 + t * (8 + i % 5) * 3) % (H + 40)) - 20;
      ctx.fillStyle = 'rgba(127,215,255,' + (0.04 + (i % 4) * 0.03) + ')'; ctx.beginPath(); ctx.arc(x, y, 1.5 + i % 3, 0, TAU); ctx.fill();
    }
    return;
  }
  const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
  ctx.setTransform(DPR * ZOOM, 0, 0, DPR * ZOOM, (-camX + sx) * DPR * ZOOM, (-camY + sy) * DPR * ZOOM);
  drawRoom();
  const tk = P.tick;
  drawPickups(tk);
  for (const p of parts) {
    if (p.glow) continue;
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * 0.9; ctx.fillStyle = p.color;
    if (p.ring) { ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - p.life / p.max), 0, TAU); ctx.stroke(); }
    else if (p.shape === 'dot') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, TAU); ctx.fill(); }
    else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  const sorted = enemies.slice().sort((a, b) => (a.y + (a.fly ? 40 : 0)) - (b.y + (b.fly ? 40 : 0)));
  let playerDrawn = false;
  for (const e of sorted) { if (!playerDrawn && e.y > P.y) { drawPlayer(); playerDrawn = true; } drawEnemy(e); }
  if (!playerDrawn) drawPlayer();
  for (const s of slashes) {
    const k = s.t / s.dur;
    ctx.strokeStyle = 'rgba(223,230,240,' + (1 - k) * 0.9 + ')'; ctx.lineWidth = 6 * (1 - k * 0.5); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.range * (0.6 + 0.4 * k), s.a - s.arc / 2, s.a + s.arc / 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) * 0.6 + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, s.range * (0.7 + 0.3 * k), s.a - s.arc / 2, s.a + s.arc / 2); ctx.stroke();
  }
  for (const b of bullets) {
    if (b.friendly) {
      if (b.kind === 'bow') { ctx.strokeStyle = '#e9e4d0'; ctx.lineWidth = 2.5; const a = Math.atan2(b.vy, b.vx); ctx.beginPath(); ctx.moveTo(b.x - Math.cos(a) * 10, b.y - Math.sin(a) * 10); ctx.lineTo(b.x + Math.cos(a) * 6, b.y + Math.sin(a) * 6); ctx.stroke(); ctx.fillStyle = '#ffd97a'; ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * 6, b.y + Math.sin(a) * 6, 2.5, 0, TAU); ctx.fill(); continue; }
      if (b.kind === 'storm') { ctx.strokeStyle = '#dff4ff'; ctx.lineWidth = 2; ctx.shadowColor = '#7fd7ff'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); for (let i = 1; i <= 3; i++) ctx.lineTo(b.x - b.vx * 0.03 * (1 - i / 3) + (Math.random() - 0.5) * 6, b.y - b.vy * 0.03 * (1 - i / 3) + (Math.random() - 0.5) * 6); ctx.stroke(); ctx.shadowBlur = 0; continue; }
      ctx.fillStyle = b.kind === 'orb' ? '#ff9f43' : b.crit ? '#fff3b0' : b.kind === 'pet' ? '#dff4ff' : '#ffd97a';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = b.kind === 'orb' ? 14 : 8;
    } else { ctx.fillStyle = b.color || '#ff5e7a'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; }
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    if (!b.friendly) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU); ctx.fill(); }
  }
  ctx.shadowBlur = 0;
  for (const bm of beams) {
    const x2 = bm.x + Math.cos(bm.ang) * bm.len, y2 = bm.y + Math.sin(bm.ang) * bm.len;
    if (bm.t < bm.warm) { ctx.strokeStyle = bm.color; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(tk * 30); ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    else { ctx.strokeStyle = bm.color; ctx.lineWidth = bm.w; ctx.lineCap = 'round'; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = bm.w * 0.35; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  for (const p of parts) {
    if (!p.glow) continue;
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size / 2, 0, TAU); ctx.fill();
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of texts) {
    ctx.globalAlpha = clamp(t.life * 2, 0, 1);
    ctx.font = 'bold ' + t.size + 'px "Nunito", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(t.txt, t.x + 1, t.y + 1);
    ctx.fillStyle = t.color; ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  if (G.world === 'envers') {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'color'; ctx.fillStyle = '#7b5cc9'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  drawLighting();
  if (G.crossT > 0) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const k = clamp(G.crossT / 0.7, 0, 1);
    ctx.fillStyle = `rgba(150,110,255,${k * 0.45})`; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(255,255,255,${k * 0.5})`;
    for (let i = 0; i < 26; i++) { const xx = (i * 97.3) % W, hh = H * (0.3 + ((i * 37) % 70) / 100) * k; ctx.fillRect(xx, H / 2 - hh / 2, 2, hh); }
  }
  drawHUD();
  $('dashBtn').classList.toggle('ready', P.dashCdT <= 0 && !P.noDash);
  $('crossBtn').classList.toggle('ready', G.voile >= (G.world === 'normal' ? crossCost() : 1));
  $('surgeBtn').classList.toggle('ready', G.surge >= 100);
}
