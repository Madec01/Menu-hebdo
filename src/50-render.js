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
function buildRoomCache(room) {
  const pal = G.floorData.biome.pal, S = 2;
  const c = document.createElement('canvas'); c.width = RW * TILE * S; c.height = RH * TILE * S;
  const g = c.getContext('2d'); g.scale(S, S);
  const t = room.tiles;
  const isWall = (x, y) => x < 0 || y < 0 || x >= RW || y >= RH || t[y][x] === T_WALL;
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    const v = t[y][x], px = x * TILE, py = y * TILE, h = hash2(x, y);
    if (v !== T_WALL) {
      g.fillStyle = (h % 5 === 0) ? pal.floor2 : pal.floor; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(255,255,255,0.025)'; if (h % 3 === 0) g.fillRect(px + (h % 7) * 3, py + (h % 11) * 2, 5, 3);
      g.fillStyle = 'rgba(0,0,0,0.12)'; if (h % 4 === 1) g.fillRect(px + (h % 13) * 2, py + (h % 5) * 5, 8, 2);
      if (h % 9 === 2) { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px + 4, py + 10 + (h % 8)); g.lineTo(px + 14 + (h % 6), py + 18); g.lineTo(px + 26, py + 12 + (h % 9)); g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    }
    if (v === T_WATER || v === T_POISON) {
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
    } else if (v === T_PIT) {
      g.fillStyle = '#05040a'; g.fillRect(px, py, TILE, TILE);
      const gr = g.createLinearGradient(px, py, px, py + 10); gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      if (!isWall(x, y - 1) && t[y - 1][x] !== T_PIT) { g.fillStyle = gr; g.fillRect(px, py, TILE, 10); }
    }
  }
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    if (t[y][x] !== T_WALL) continue;
    const px = x * TILE, py = y * TILE, h = hash2(x, y);
    g.fillStyle = pal.wallTop; g.fillRect(px, py, TILE, TILE);
    g.fillStyle = 'rgba(0,0,0,0.12)'; if (h % 2) g.fillRect(px + 2 + (h % 9), py + 4 + (h % 13), 10, 4);
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
  room.cache = c;
}

/* ---------- salle ---------- */
function drawRoom() {
  const room = G.room, t = room.tiles, pal = G.floorData.biome.pal, tk = P.tick;
  if (!room.cache) buildRoomCache(room);
  ctx.drawImage(room.cache, 0, 0, RW * TILE, RH * TILE);
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
    } else if (v === T_DOOR) {
      ctx.fillStyle = '#07060c'; ctx.fillRect(px, py, TILE, TILE);
      const g = ctx.createRadialGradient(px + TILE / 2, py + TILE / 2, 2, px + TILE / 2, py + TILE / 2, TILE);
      g.addColorStop(0, pal.accent.replace(')', ',0.35)').replace('#', 'rgba(').replace(/rgba\((\w\w)(\w\w)(\w\w)/, (m, r, gg, b) => `rgba(${parseInt(r, 16)},${parseInt(gg, 16)},${parseInt(b, 16)}`)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(px - TILE / 2, py - TILE / 2, TILE * 2, TILE * 2);
      ctx.fillStyle = pal.wallEdge; if (y === 0 || y === RH - 1) { ctx.fillRect(px - 2, py, 3, TILE); ctx.fillRect(px + TILE - 1, py, 3, TILE); } else { ctx.fillRect(px, py - 2, TILE, 3); ctx.fillRect(px, py + TILE - 1, TILE, 3); }
    } else if (v === T_DOORC) {
      ctx.fillStyle = '#0d0c14'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = '#6b6f86'; const vert = y === 0 || y === RH - 1;
      for (let i = 0; i < 3; i++) { if (vert) ctx.fillRect(px + 5 + i * 9, py + 3, 4, TILE - 6); else ctx.fillRect(px + 3, py + 5 + i * 9, TILE - 6, 4); }
      ctx.fillStyle = '#9a9eb8'; if (vert) ctx.fillRect(px + 3, py + TILE / 2 - 2, TILE - 6, 4); else ctx.fillRect(px + TILE / 2 - 2, py + 3, 4, TILE - 6);
    }
  }
  // torches
  for (const tc of room.torches) {
    const fl = 0.8 + 0.2 * Math.sin(tk * 13 + tc.x) + 0.1 * Math.sin(tk * 29 + tc.y);
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(tc.x - 2, tc.y - 2, 4, 10);
    ctx.fillStyle = '#2a2018'; ctx.fillRect(tc.x - 4, tc.y + 6, 8, 3);
    const fy = tc.y - 4;
    ctx.fillStyle = pal.torch; ctx.beginPath(); ctx.ellipse(tc.x, fy, 4 * fl, 7 * fl, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff3c0'; ctx.beginPath(); ctx.ellipse(tc.x, fy + 1, 2 * fl, 3.5 * fl, 0, 0, TAU); ctx.fill();
    if (Math.random() < 0.08) burst(tc.x, fy - 4, 1, pal.torch, 20, { shape: 'dot', glow: 1, life: 0.7, grav: -50, size: 2 });
  }
  // accessoires de la salle
  const cx = RW * TILE / 2, cy = RH * TILE / 2;
  for (const pr of room.props) drawProp(pr, tk);
  if (room.stairs) {
    ctx.fillStyle = '#05040a'; ctx.fillRect(cx - 20, cy - 20, 40, 40);
    ctx.fillStyle = '#3d4466'; for (let i = 0; i < 4; i++) ctx.fillRect(cx - 20 + i * 4, cy - 20 + i * 9, 40 - i * 8, 5);
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
function drawProp(pr, tk) {
  const { x, y } = pr;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 14, 22, 8, 0, 0, TAU); ctx.fill();
  if (pr.kind === 'chest' || pr.kind === 'armory') {
    const op = pr.used, gold = pr.kind === 'armory' ? '#9fd8ff' : '#ffd97a';
    ctx.fillStyle = op ? '#4a3320' : '#8a5a2b'; ctx.fillRect(x - 18, y - 8, 36, 22);
    ctx.fillStyle = op ? '#33230f' : '#a86f38'; ctx.fillRect(x - 18, y - 14, 36, 8);
    ctx.fillStyle = op ? '#55482a' : gold; ctx.fillRect(x - 4, y - 6, 8, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 18, y + 10, 36, 4);
    if (!op) { ctx.strokeStyle = gold; ctx.globalAlpha = 0.4 + 0.3 * Math.sin(tk * 4); ctx.lineWidth = 2; ctx.strokeRect(x - 20, y - 16, 40, 32); ctx.globalAlpha = 1; }
  } else if (pr.kind === 'altar') {
    ctx.fillStyle = '#3a3550'; ctx.fillRect(x - 16, y - 4, 32, 18);
    ctx.fillStyle = '#4d4768'; ctx.fillRect(x - 20, y - 10, 40, 8);
    ctx.fillStyle = pr.used ? '#555' : '#c77dff'; ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x + 7, y - 14); ctx.lineTo(x, y - 8); ctx.lineTo(x - 7, y - 14); ctx.closePath(); ctx.fill();
    if (!pr.used) { ctx.fillStyle = 'rgba(199,125,255,' + (0.25 + 0.2 * Math.sin(tk * 3)) + ')'; ctx.beginPath(); ctx.arc(x, y - 17, 14, 0, TAU); ctx.fill(); }
  } else if (pr.kind === 'merchant') {
    ctx.fillStyle = '#5a3d2b'; ctx.fillRect(x - 24, y - 2, 48, 14);
    ctx.fillStyle = '#7a553a'; ctx.fillRect(x - 26, y - 6, 52, 5);
    ctx.fillStyle = '#2b2436'; ctx.beginPath(); ctx.ellipse(x, y - 22, 11, 13, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a1622'; ctx.beginPath(); ctx.moveTo(x - 14, y - 26); ctx.lineTo(x + 14, y - 26); ctx.lineTo(x, y - 44); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd97a'; ctx.beginPath(); ctx.arc(x - 4, y - 24, 1.8, 0, TAU); ctx.arc(x + 4, y - 24, 1.8, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#ff5e7a', '#7fd7ff', '#ffd97a'][i]; ctx.beginPath(); ctx.arc(x - 14 + i * 14, y - 8 + Math.sin(tk * 3 + i) * 1.5, 4, 0, TAU); ctx.fill(); }
  } else if (pr.kind === 'pedestal') {
    ctx.fillStyle = '#3a3550'; ctx.fillRect(x - 12, y - 6, 24, 18);
    ctx.fillStyle = '#4d4768'; ctx.fillRect(x - 15, y - 10, 30, 6);
    ctx.fillStyle = pr.used ? '#555' : '#ff5e7a'; ctx.beginPath(); ctx.arc(x, y - 20, 8, 0, TAU); ctx.fill();
    if (!pr.used) { ctx.strokeStyle = 'rgba(255,94,122,' + (0.4 + 0.3 * Math.sin(tk * 4)) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 20, 13 + Math.sin(tk * 4) * 2, 0, TAU); ctx.stroke(); }
  } else if (pr.kind === 'weapon') {
    const w = WEAPONS[pr.id];
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill();
    ctx.font = '20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(w.ic, x, y - 2 + Math.sin(tk * 3) * 2);
    ctx.font = 'bold 9px "Nunito", system-ui, sans-serif'; ctx.fillStyle = '#ffd97a'; ctx.fillText(w.name, x, y + 20);
  }
}

/* ---------- créatures ---------- */
function drawEnemy(e) {
  ctx.save();
  if (e.spawnT > 0) {
    const p = 1 - clamp(e.spawnT / 0.9, 0, 1);
    ctx.strokeStyle = e.color; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -P.tick * 40;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + 0.7 * p), 0, TAU); ctx.stroke();
    ctx.fillStyle = e.color; ctx.globalAlpha = 0.25 * p; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * p, 0, TAU); ctx.fill();
    ctx.restore(); return;
  }
  const winding = e.state === 'wind' || e.phase === 'wind' || e.phase === 'hopwind' || e.state === 'fuse';
  let ox = 0, oy = 0; if (winding) { ox = (Math.random() - 0.5) * 4; oy = (Math.random() - 0.5) * 4; }
  const air = (e.state === 'air' || e.phase === 'hop') ? Math.sin(clamp(1 - e.stT / 0.5, 0, 1) * Math.PI) : 0;
  ctx.globalAlpha = e.alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.85, e.r * 0.9 * (1 - air * 0.4), e.r * 0.35 * (1 - air * 0.4), 0, 0, TAU); ctx.fill();
  ctx.translate(e.x + ox, e.y + oy - air * 46 - (e.fly && e.ai !== 'hop' ? 6 + Math.sin(e.ph * 4) * 3 : 0));
  if (e.elite) {
    ctx.strokeStyle = e.elite.color; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -P.tick * 30; ctx.globalAlpha = e.alpha * 0.8;
    ctx.beginPath(); ctx.arc(0, 0, e.r + 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = e.alpha;
  }
  const col = e.flash > 0 ? '#ffffff' : e.color, dark = e.flash > 0 ? '#dddddd' : e.dark;
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  ctx.strokeStyle = dark; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  const eyes = (sep, size, dy, red) => {
    for (const s of [-1, 1]) {
      const ex = Math.cos(a + s * 0.9) * sep, ey = Math.sin(a + s * 0.9) * sep + (dy || 0);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, size, 0, TAU); ctx.fill();
      ctx.fillStyle = red ? '#ff2244' : '#141020'; ctx.beginPath(); ctx.arc(ex + Math.cos(a) * size * 0.4, ey + Math.sin(a) * size * 0.4, size * 0.55, 0, TAU); ctx.fill();
    }
  };
  switch (e.shape) {
    case 'blob': {
      const wob = Math.sin(e.ph * 6) * 0.1;
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 2, e.r * (1 + wob), e.r * (0.9 - wob), 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(-e.r * 0.35, -e.r * 0.35, e.r * 0.3, e.r * 0.18, -0.6, 0, TAU); ctx.fill();
      if (e.boss) { ctx.fillStyle = col; for (let i = 0; i < 6; i++) { const aa = e.ph * 0.7 + i; ctx.beginPath(); ctx.arc(Math.cos(aa) * e.r * 0.9, Math.sin(aa) * e.r * 0.6 + 4, 6 + Math.sin(e.ph * 3 + i) * 2, 0, TAU); ctx.fill(); ctx.stroke(); } }
      eyes(e.r * 0.45, e.boss ? 6 : Math.max(2.5, e.r * 0.22), -2, e.boss);
      break;
    }
    case 'bat': {
      const flap = Math.sin(e.ph * 14) * 0.6;
      ctx.fillStyle = col;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * e.r * 1.4, -e.r * (0.6 + flap), s * e.r * 2.2, flap * e.r * 0.5); ctx.quadraticCurveTo(s * e.r * 1.3, e.r * 0.5, 0, e.r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(0, 0, e.r * 0.75, e.r, 0, 0, TAU); ctx.fill(); ctx.stroke();
      if (e.type === 'imp') { ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-5, -e.r); ctx.lineTo(-3, -e.r - 7); ctx.lineTo(0, -e.r + 1); ctx.moveTo(5, -e.r); ctx.lineTo(3, -e.r - 7); ctx.lineTo(0, -e.r + 1); ctx.fill(); }
      eyes(e.r * 0.4, 2.2, -2);
      break;
    }
    case 'humanoid': {
      ctx.fillStyle = col;
      ctx.fillRect(-5, -2, 10, 12); ctx.strokeRect(-5, -2, 10, 12);
      ctx.beginPath(); ctx.arc(0, -8, 6, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#141020'; ctx.fillRect(-3, -9, 2, 2); ctx.fillRect(1, -9, 2, 2);
      const bx = Math.cos(a) * 9, by = Math.sin(a) * 9;
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 9, a - 1.2, a + 1.2); ctx.stroke();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a - 1.2) * 9, by + Math.sin(a - 1.2) * 9); ctx.lineTo(bx + Math.cos(a + 1.2) * 9, by + Math.sin(a + 1.2) * 9); ctx.stroke();
      const legs = Math.sin(e.ph * 10) * 3; ctx.fillStyle = col; ctx.fillRect(-4, 10, 3, 5 + legs); ctx.fillRect(1, 10, 3, 5 - legs);
      break;
    }
    case 'brute': {
      const dashing = e.state === 'dash' || e.phase === 'dash';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, 0, e.r, e.r * 0.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-e.r * 0.9, -e.r * 0.2, e.r * 0.4, e.r * 0.45, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(e.r * 0.9, -e.r * 0.2, e.r * 0.4, e.r * 0.45, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * e.r * 0.5, -e.r * 0.6); ctx.lineTo(s * e.r * 0.9, -e.r * 1.3); ctx.lineTo(s * e.r * 0.2, -e.r * 0.8); ctx.closePath(); ctx.fill(); }
      const fx = Math.cos(a), fy = Math.sin(a), f2 = dashing ? 1.5 : 1;
      ctx.fillStyle = col; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(fx * e.r * 0.7 * f2 - fy * s * e.r * 0.7, fy * e.r * 0.7 * f2 + fx * s * e.r * 0.7, e.r * 0.32, 0, TAU); ctx.fill(); ctx.stroke(); }
      eyes(e.r * 0.4, e.boss ? 6 : 3.5, -e.r * 0.15, e.boss);
      break;
    }
    case 'mage': {
      const bob = Math.sin(e.ph * 3) * 3;
      ctx.translate(0, bob);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-e.r, e.r * 1.1); ctx.quadraticCurveTo(0, e.r * 1.5, e.r, e.r * 1.1); ctx.lineTo(e.r * 0.5, -e.r * 0.5); ctx.lineTo(-e.r * 0.5, -e.r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -e.r * 0.6, e.r * 0.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-e.r * 0.8, -e.r * 0.8); ctx.lineTo(e.r * 0.8, -e.r * 0.8); ctx.lineTo(e.r * 0.1, -e.r * 2.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = e.type === 'shaman' ? '#ff7a9a' : '#fff'; ctx.beginPath(); ctx.arc(-e.r * 0.2, -e.r * 0.6, 1.5, 0, TAU); ctx.arc(e.r * 0.2, -e.r * 0.6, 1.5, 0, TAU); ctx.fill();
      const sx = Math.cos(a + 0.6) * e.r, sy = Math.sin(a + 0.6) * e.r;
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sx, sy + 10); ctx.lineTo(sx, sy - 14); ctx.stroke();
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(sx, sy - 16, e.boss ? 7 : 4, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      if (e.boss) { ctx.fillStyle = '#ffd97a'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 5 - 3, -e.r * 1.2); ctx.lineTo(i * 5, -e.r * 1.6); ctx.lineTo(i * 5 + 3, -e.r * 1.2); ctx.fill(); } }
      break;
    }
    case 'turret': {
      ctx.fillStyle = dark; ctx.fillRect(-e.r, -e.r * 0.6, e.r * 2, e.r * 1.4);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, e.r * 0.8, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.rotate(a); ctx.fillStyle = dark; ctx.fillRect(0, -4, e.r + 6, 8); ctx.fillStyle = '#111'; ctx.fillRect(e.r + 2, -2.5, 4, 5); ctx.restore();
      ctx.fillStyle = '#ff2244'; ctx.beginPath(); ctx.arc(0, 0, 3 + Math.sin(e.ph * 8), 0, TAU); ctx.fill();
      break;
    }
    case 'spider': {
      ctx.strokeStyle = dark; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const la = s * (0.4 + i * 0.5) + Math.sin(e.ph * 12 + i) * 0.15; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(la) * e.r * 1.6 * s, Math.sin(la) * e.r * 1.4 - 4); ctx.lineTo(Math.cos(la) * e.r * 2 * s, Math.sin(la) * e.r * 1.8 + 4); ctx.stroke(); }
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 3, e.r * 0.8, e.r * 0.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(Math.cos(a) * e.r * 0.6, Math.sin(a) * e.r * 0.6, e.r * 0.45, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff2244'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(Math.cos(a) * e.r * 0.7 + Math.cos(a + 1.57) * (i - 1.5) * 3, Math.sin(a) * e.r * 0.7 + Math.sin(a + 1.57) * (i - 1.5) * 3, 1.3, 0, TAU); ctx.fill(); }
      break;
    }
    case 'toad': {
      const squash = winding ? 0.7 : 1 + air * 0.2;
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 2, e.r * 1.1 / squash * (winding ? 1.2 : 1), e.r * 0.8 * squash, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * e.r * 1.1, e.r * 0.5, e.r * 0.4, e.r * 0.25, s * 0.5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.ellipse(0, e.r * 0.3, e.r * 0.6, e.r * 0.3, 0, 0, TAU); ctx.fill();
      for (const s of [-1, 1]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s * e.r * 0.5, -e.r * 0.6, e.r * 0.32, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = e.boss ? '#ff2244' : '#ffd97a'; ctx.beginPath(); ctx.arc(s * e.r * 0.5 + Math.cos(a) * 2, -e.r * 0.6 + Math.sin(a) * 2, e.r * 0.15, 0, TAU); ctx.fill(); ctx.fillStyle = '#141020'; ctx.beginPath(); ctx.ellipse(s * e.r * 0.5 + Math.cos(a) * 2, -e.r * 0.6 + Math.sin(a) * 2, e.r * 0.05, e.r * 0.13, 0, 0, TAU); ctx.fill(); }
      if (e.boss) { ctx.fillStyle = '#ffd97a'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 8 - 4, -e.r * 0.85); ctx.lineTo(i * 8, -e.r * 1.25); ctx.lineTo(i * 8 + 4, -e.r * 0.85); ctx.fill(); } }
      break;
    }
    case 'wolf': {
      ctx.save(); ctx.rotate(a);
      const run = Math.sin(e.ph * 16) * 3;
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, e.r * 1.4, e.r * 0.7, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(e.r * 1.3, 0, e.r * 0.55, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(e.r * 1.1, -e.r * 0.4); ctx.lineTo(e.r * 1.2, -e.r * 0.9); ctx.lineTo(e.r * 1.5, -e.r * 0.4); ctx.moveTo(e.r * 1.1, e.r * 0.4); ctx.lineTo(e.r * 1.2, e.r * 0.9); ctx.lineTo(e.r * 1.5, e.r * 0.4); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-e.r * 1.3, 0); ctx.quadraticCurveTo(-e.r * 1.9, -e.r * 0.5 - run * 0.2, -e.r * 2.1, run * 0.3); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.fillStyle = col; for (const [lx, s] of [[e.r * 0.7, 1], [e.r * 0.7, -1], [-e.r * 0.7, 1], [-e.r * 0.7, -1]]) { ctx.fillRect(lx - 2 + run * s * 0.5, s * e.r * 0.5, 4, 6); }
      ctx.fillStyle = '#ff2244'; ctx.beginPath(); ctx.arc(e.r * 1.5, -3, 1.5, 0, TAU); ctx.arc(e.r * 1.5, 3, 1.5, 0, TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'ghost': {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, -2, e.r, Math.PI, 0);
      for (let i = 0; i <= 4; i++) { const x = e.r - i * e.r / 2, y = e.r * 0.8 + Math.sin(e.ph * 6 + i * 1.5) * 3 * (i % 2 ? 1 : -1); ctx.lineTo(x, y); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = e.hunter ? '#ff2244' : '#141020'; ctx.beginPath(); ctx.ellipse(-e.r * 0.35, -3, 2.5, 4, 0, 0, TAU); ctx.ellipse(e.r * 0.35, -3, 2.5, 4, 0, 0, TAU); ctx.fill();
      if (e.hunter) { ctx.strokeStyle = '#ff2244'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(0, 0, e.r + 10 + Math.sin(e.ph * 5) * 3, 0, TAU); ctx.stroke(); ctx.globalAlpha = e.alpha; }
      break;
    }
    case 'bomber': {
      const blink = e.state === 'fuse' && Math.floor(e.fuse * 20) % 2 === 0;
      ctx.fillStyle = blink ? '#fff' : col; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -e.r); ctx.quadraticCurveTo(4, -e.r - 6, 2, -e.r - 10); ctx.stroke();
      ctx.fillStyle = '#ffd97a'; ctx.beginPath(); ctx.arc(2, -e.r - 10, 2 + Math.random() * 1.5, 0, TAU); ctx.fill();
      if (Math.random() < 0.3) burst(e.x + 2, e.y - e.r - 10, 1, '#ffd97a', 40, { shape: 'dot', glow: 1, life: 0.3, size: 2 });
      eyes(e.r * 0.4, 2.5, 0);
      break;
    }
    case 'eye': {
      ctx.strokeStyle = dark; ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) { const ta = i / 7 * TAU + e.ph * 0.4, w = Math.sin(e.ph * 3 + i) * 8; ctx.beginPath(); ctx.moveTo(Math.cos(ta) * e.r * 0.8, Math.sin(ta) * e.r * 0.8); ctx.quadraticCurveTo(Math.cos(ta) * e.r * 1.4 + w, Math.sin(ta) * e.r * 1.4 - w, Math.cos(ta) * e.r * 1.9, Math.sin(ta) * e.r * 1.9 + w); ctx.stroke(); }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, e.r * 0.75, e.r * 0.55, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4b1f7a'; ctx.beginPath(); ctx.arc(Math.cos(a) * e.r * 0.25, Math.sin(a) * e.r * 0.2, e.r * 0.35, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff2244'; ctx.beginPath(); ctx.arc(Math.cos(a) * e.r * 0.3, Math.sin(a) * e.r * 0.24, e.r * 0.16, 0, TAU); ctx.fill();
      break;
    }
    default: { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill(); ctx.stroke(); eyes(e.r * 0.4, 3, 0); }
  }
  if (winding) { ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(0, 0, e.r + 7, 0, TAU); ctx.stroke(); }
  if (e.slowT > 0) { ctx.strokeStyle = 'rgba(160,230,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, e.r + 3, 0, TAU); ctx.stroke(); }
  if (e.poisonT > 0) { ctx.fillStyle = 'rgba(120,255,60,0.5)'; ctx.beginPath(); ctx.arc(Math.sin(e.ph * 5) * 6, -e.r - 4, 2.5, 0, TAU); ctx.fill(); }
  ctx.restore();
  if (!e.boss && (e.hp < e.maxHp || e.elite)) {
    const w = e.r * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 11, w, 4);
    ctx.fillStyle = e.elite ? e.elite.color : '#ff5e7a'; ctx.fillRect(e.x - w / 2, e.y - e.r - 11, w * clamp(e.hp / e.maxHp, 0, 1), 4);
  }
}

/* ---------- joueur ---------- */
function drawPlayer() {
  ctx.save();
  ctx.translate(P.x, P.y);
  const fall = P.fallT > 0 ? clamp(P.fallT / 0.5, 0, 1) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, P.r * 0.9, P.r * 0.9, P.r * 0.35, 0, 0, TAU); ctx.fill();
  if (fall) ctx.scale(1 - fall * 0.7, 1 - fall * 0.7);
  if (P.inv > 0 && Math.floor(P.inv * 12) % 2 === 0 && P.dashT <= 0) ctx.globalAlpha = 0.45;
  if (P.surgeT > 0) { ctx.strokeStyle = 'rgba(255,217,122,' + (0.5 + 0.4 * Math.sin(P.tick * 20)) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, P.r + 7, 0, TAU); ctx.stroke(); }
  if (P.shield && P.shieldT <= 0) { ctx.strokeStyle = 'rgba(127,215,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, P.r + 5, P.tick * 2, P.tick * 2 + 4.5); ctx.stroke(); }
  if (P.webT > 0) { ctx.strokeStyle = 'rgba(233,228,208,0.7)'; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(Math.cos(i * 1.26) * P.r * 1.4, Math.sin(i * 1.26) * P.r * 1.4); ctx.lineTo(Math.cos(i * 1.26 + 2.5) * P.r * 1.4, Math.sin(i * 1.26 + 2.5) * P.r * 1.4); ctx.stroke(); } }
  const bob = P.moving ? Math.sin(P.walk * 14) * 1.5 : 0;
  // cape
  const cape = P.moving ? 6 : 2, sway = Math.sin(P.walk * 7) * 2;
  ctx.fillStyle = '#3b3f9e';
  ctx.beginPath(); ctx.moveTo(-P.r * 0.85, -3 + bob); ctx.lineTo(P.r * 0.85, -3 + bob);
  ctx.quadraticCurveTo(P.r * 0.9 - P.fx * cape + sway, P.r * 0.9 - P.fy * cape, P.r * 0.7 - P.fx * cape * 1.6, P.r * 1.2 - P.fy * cape * 0.8);
  ctx.lineTo(-P.r * 0.7 - P.fx * cape * 1.6, P.r * 1.2 - P.fy * cape * 0.8);
  ctx.quadraticCurveTo(-P.r * 0.9 - P.fx * cape - sway, P.r * 0.9 - P.fy * cape, -P.r * 0.85, -3 + bob); ctx.closePath(); ctx.fill();
  // jambes
  ctx.fillStyle = '#2a2440'; const leg = P.moving ? Math.sin(P.walk * 14) * 3 : 0;
  ctx.fillRect(-5, P.r * 0.5, 4, 6 + leg); ctx.fillRect(1, P.r * 0.5, 4, 6 - leg);
  // corps
  ctx.translate(0, bob);
  ctx.fillStyle = '#e8b04a'; ctx.strokeStyle = '#8a5a1a'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(0, 0, P.r * 0.95, P.r, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c9903a'; ctx.fillRect(-P.r * 0.6, 2, P.r * 1.2, 3);
  // capuche
  ctx.fillStyle = '#5a5fd8'; ctx.beginPath(); ctx.arc(0, -3, P.r * 0.85, Math.PI * 1.05, -0.05); ctx.lineTo(P.r * 0.85, 0); ctx.lineTo(-P.r * 0.85, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3b3f9e'; ctx.beginPath(); ctx.moveTo(-P.r * 0.7, -4); ctx.lineTo(0, -P.r * 1.5); ctx.lineTo(P.r * 0.7, -4); ctx.closePath(); ctx.fill();
  const a = P.aim;
  ctx.fillStyle = '#fff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(Math.cos(a + s * 0.7) * 4.5, -3 + Math.sin(a + s * 0.7) * 3, 1.6, 0, TAU); ctx.fill(); }
  // arme
  const w = P.weapon, hx = Math.cos(a) * P.r * 0.6, hy = Math.sin(a) * P.r * 0.6;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(a); ctx.lineCap = 'round';
  if (w === 'wand') { ctx.strokeStyle = '#e9e4d0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(P.r + 4, 0); ctx.stroke(); ctx.fillStyle = '#7fd7ff'; ctx.shadowColor = '#7fd7ff'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(P.r + 5, 0, 3, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; }
  else if (w === 'bow') { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(2, 0, 11, -1.3, 1.3); ctx.stroke(); ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(2 + Math.cos(-1.3) * 11, Math.sin(-1.3) * 11); ctx.lineTo(-2, 0); ctx.lineTo(2 + Math.cos(1.3) * 11, Math.sin(1.3) * 11); ctx.stroke(); }
  else if (w === 'blades') { ctx.strokeStyle = '#dfe6f0'; ctx.lineWidth = 3; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-2, s * 6); ctx.lineTo(P.r + 8, s * 3); ctx.stroke(); } ctx.strokeStyle = '#8a5a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(-5, 6); ctx.stroke(); }
  else if (w === 'orb') { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(P.r, 0); ctx.stroke(); ctx.fillStyle = '#ff7b3a'; ctx.shadowColor = '#ff7b3a'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(P.r + 3, 0, 5 + Math.sin(P.tick * 6), 0, TAU); ctx.fill(); ctx.shadowBlur = 0; }
  else if (w === 'storm') { ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(P.r + 2, 0); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.r + 2, 0); ctx.lineTo(P.r + 6, -4); ctx.lineTo(P.r + 8, 2); ctx.lineTo(P.r + 12, -3); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
  // satellites
  for (let i = 0; i < P.orbit; i++) {
    const oa = P.tick * 2.6 + i * TAU / P.orbit, ox = P.x + Math.cos(oa) * 44, oy = P.y + Math.sin(oa) * 44;
    ctx.fillStyle = '#c77dff'; ctx.shadowColor = '#c77dff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(ox, oy, 6, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox - 1.5, oy - 1.5, 2, 0, TAU); ctx.fill();
  }
  for (const pet of G.pets) {
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#dff4ff'; ctx.shadowColor = '#7fd7ff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(pet.x, pet.y - 2, 7, Math.PI, 0); ctx.lineTo(pet.x + 7, pet.y + 6); ctx.lineTo(pet.x + 3, pet.y + 3); ctx.lineTo(pet.x, pet.y + 7); ctx.lineTo(pet.x - 3, pet.y + 3); ctx.lineTo(pet.x - 7, pet.y + 6); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#141020'; ctx.fillRect(pet.x - 3.5, pet.y - 3, 2, 3); ctx.fillRect(pet.x + 1.5, pet.y - 3, 2, 3); ctx.globalAlpha = 1;
  }
}

/* ---------- lumière ---------- */
function drawLighting() {
  const biome = G.floorData.biome;
  let dark = biome.dark + ((G.oath && G.oath.dark) || 0);
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
  const t = G.room.tiles;
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) { const v = t[y][x]; if (v === T_LAVA) light((x + 0.5) * TILE, (y + 0.5) * TILE, 52, 0.55); else if (v === T_DOOR) light((x + 0.5) * TILE, (y + 0.5) * TILE, 70, 0.7); }
  for (const b of bullets) light(b.x, b.y, b.friendly ? 26 : 22, 0.6);
  for (const e of enemies) if (e.boss || e.elite || e.hunter) light(e.x, e.y, e.boss ? 110 : 60, 0.7);
  for (const p of pools) if (p.type === 'fire') light(p.x, p.y, p.r * 1.6, 0.6);
  for (const pr of G.room.props) if (!pr.used) light(pr.x, pr.y, 80, 0.8);
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
  for (const r of known) {
    const x = ox + (r.gx - minx) * (cs + gap), yy = oy + (r.gy - miny) * (cs + gap);
    const base = typeCol[r.type];
    ctx.fillStyle = base ? base : 'rgba(236,230,216,0.6)'; ctx.globalAlpha = r.visited ? 1 : 0.4; ctx.fillRect(x, yy, cs, cs); ctx.globalAlpha = 1;
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
    ctx.fillStyle = banner.color; ctx.font = 'bold 26px ' + FD; ctx.fillText(banner.t, W / 2, H * 0.3 - 8);
    ctx.fillStyle = '#ece6d8'; ctx.font = '13px ' + F; ctx.fillText(banner.s, W / 2, H * 0.3 + 18);
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
    ctx.fillStyle = '#ffd97a'; lines.forEach((l, i) => ctx.fillText(l, W / 2, hy - 18 * (lines.length - 1 - i))); ctx.globalAlpha = 1;
  }
  // joysticks
  for (const o of touches.values()) {
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.sx, o.sy, 52, 0, TAU); ctx.stroke();
    ctx.fillStyle = o.side === 'L' ? 'rgba(255,255,255,0.35)' : 'rgba(255,217,122,0.5)'; ctx.beginPath(); ctx.arc(o.x, o.y, 22, 0, TAU); ctx.fill();
  }
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
  for (const p of pickups) {
    const bob = Math.sin(p.t * 5) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, 6, 2.5, 0, 0, TAU); ctx.fill();
    if (p.type === 'coin') { ctx.fillStyle = '#ffd97a'; ctx.strokeStyle = '#b8832a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x, p.y - 7 + bob); ctx.lineTo(p.x + 6, p.y + bob); ctx.lineTo(p.x, p.y + 7 + bob); ctx.lineTo(p.x - 6, p.y + bob); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(p.x - 2, p.y - 4 + bob, 2, 3); }
    else if (p.type === 'gem') { ctx.fillStyle = '#c77dff'; ctx.strokeStyle = '#5b2a8a'; ctx.lineWidth = 1.5; ctx.shadowColor = '#c77dff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(p.x, p.y - 9 + bob); ctx.lineTo(p.x + 8, p.y - 2 + bob); ctx.lineTo(p.x, p.y + 9 + bob); ctx.lineTo(p.x - 8, p.y - 2 + bob); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; }
    else { heartPath(p.x, p.y + bob, 7); ctx.fillStyle = '#ff4f6d'; ctx.fill(); ctx.strokeStyle = '#8a1c2e'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
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
  drawLighting();
  drawHUD();
  $('dashBtn').classList.toggle('ready', P.dashCdT <= 0 && !P.noDash);
  $('surgeBtn').classList.toggle('ready', G.surge >= 100);
}
