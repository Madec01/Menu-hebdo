/* ---------- sprites pixel-art ---------- */
const SPR = { img: new Image(), ready: false, atlas: ASSETS.atlas, white: {} };
SPR.img.onload = () => { SPR.ready = true; };
SPR.img.src = ASSETS.sprites;
const SPR_SCALE = 2;   // 1 pixel de sprite = 2 unités monde
function whiteSprite(name, f) {
  const key = name + ':' + f;
  if (SPR.white[key]) return SPR.white[key];
  const a = SPR.atlas[name], c = document.createElement('canvas'); c.width = a.w; c.height = a.h;
  const g = c.getContext('2d');
  g.drawImage(SPR.img, a.x + f * (a.w + 1), a.y, a.w, a.h, 0, 0, a.w, a.h);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, a.w, a.h);
  SPR.white[key] = c; return c;
}
// x,y : point d'ancrage (bas-centre par défaut, 'center' possible) en unités monde
function drawSprite(name, frame, x, y, o) {
  const a = SPR.atlas[name];
  if (!a || !SPR.ready) return false;
  o = o || {};
  const sc = (o.scale || 1) * SPR_SCALE, w = a.w * sc, h = a.h * sc;
  const f = a.n > 1 ? (((frame | 0) % a.n) + a.n) % a.n : 0;
  ctx.save();
  ctx.translate(x, y);
  if (o.flip) ctx.scale(-1, 1);
  if (o.sx || o.sy) ctx.scale(o.sx || 1, o.sy || 1);
  if (o.rot) ctx.rotate(o.rot);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.imageSmoothingEnabled = false;
  const dx = -w / 2, dy = o.anchor === 'center' ? -h / 2 : -h;
  if (o.white) ctx.drawImage(whiteSprite(name, f), dx, dy, w, h);
  else ctx.drawImage(SPR.img, a.x + f * (a.w + 1), a.y, a.w, a.h, dx, dy, w, h);
  ctx.restore();
  return true;
}
const SPRITE_SCALE = { hunter: 1.25, boss_colossus: 1.15, boss_eye: 1.1, boss_queen: 1.05, boss_lich: 1.05, boss_leviathan: 1.1, boss_prism: 1.05, boss_cerf: 1.1, boss_mycelium: 1.05, boss_salamandre: 1.05, treant: 1.05, crystalgolem: 1.05 };

/* ---------- créatures ---------- */
function drawEnemy(e) {
  ctx.save();
  if (!inWorld(e)) {   // silhouette de l'autre côté du Voile
    if (e.spawnT <= 0) drawSprite(e.boss ? 'boss_' + e.bossId : e.type, 0, e.x, e.y + e.r * 0.95, { white: true, alpha: 0.14, flip: P.x < e.x, scale: SPRITE_SCALE[e.boss ? 'boss_' + e.bossId : e.type] || 1 });
    ctx.restore(); return;
  }
  if (e.spawnT > 0) {
    const p = 1 - clamp(e.spawnT / 0.9, 0, 1);
    ctx.strokeStyle = e.color; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -P.tick * 40;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + 0.7 * p), 0, TAU); ctx.stroke();
    ctx.fillStyle = e.color; ctx.globalAlpha = 0.25 * p; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * p, 0, TAU); ctx.fill();
    ctx.restore(); return;
  }
  const winding = e.state === 'wind' || e.phase === 'wind' || e.phase === 'hopwind' || e.state === 'fuse';
  let ox = 0, oy = 0; if (winding) { ox = (Math.random() - 0.5) * 4; oy = (Math.random() - 0.5) * 4; }
  const air = (e.state === 'air' || e.phase === 'hop') ? Math.sin(clamp(1 - (e.state === 'air' ? e.stT : e.phT) / 0.5, 0, 1) * Math.PI) : 0;
  const flying = e.fly && e.ai !== 'hop' && e.phase !== 'hop';
  ctx.globalAlpha = e.alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.85, e.r * 0.9 * (1 - air * 0.4), e.r * 0.35 * (1 - air * 0.4), 0, 0, TAU); ctx.fill();
  ctx.translate(e.x + ox, e.y + oy - air * 46 - (flying ? 6 + Math.sin(e.ph * 4) * 3 : 0));
  if (e.elite) {
    ctx.strokeStyle = e.elite.color; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -P.tick * 30; ctx.globalAlpha = e.alpha * 0.8;
    ctx.beginPath(); ctx.arc(0, 0, e.r + 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = e.alpha;
  }
  const name = e.boss ? 'boss_' + e.bossId : e.type;
  const flip = P.x < e.x;
  const dashing = e.state === 'dash' || e.phase === 'dash';
  let frame = 0;
  if (e.shape === 'bat') frame = Math.floor(e.ph * 10) % 2;
  let sx = 1, sy = 1;
  if (e.shape === 'toad') { sy = winding ? 0.75 : 1 + air * 0.15; sx = winding ? 1.15 : 1; }
  else if (!flying && !e.boss) { const b = Math.sin(e.ph * 9) * (dashing ? 0.1 : 0.04); sy = 1 + b; sx = 1 - b * 0.6; }
  else if (e.boss && !flying) { const b = Math.sin(e.ph * 4) * 0.03; sy = 1 + b; sx = 1 - b; }
  const veiled = e.boss && e.veiled && G.world === 'normal';
  if (veiled) ctx.globalAlpha = e.alpha * 0.55;
  const drawn = drawSprite(name, frame, 0, e.r * 0.95, { flip, sx, sy, white: e.flash > 0, scale: SPRITE_SCALE[name] || 1 });
  if (veiled) { ctx.globalAlpha = e.alpha; ctx.strokeStyle = 'rgba(199,125,255,' + (0.5 + 0.4 * Math.sin(P.tick * 5)) + ')'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.lineDashOffset = -P.tick * 40; ctx.beginPath(); ctx.arc(0, 0, e.r + 12, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  if (!drawn) { ctx.fillStyle = e.flash > 0 ? '#fff' : e.color; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, TAU); ctx.fill(); }
  if (winding) { ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(0, 0, e.r + 7, 0, TAU); ctx.stroke(); }
  if (e.slowT > 0) { ctx.strokeStyle = 'rgba(160,230,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, e.r + 3, 0, TAU); ctx.stroke(); }
  if (e.poisonT > 0) { ctx.fillStyle = 'rgba(120,255,60,0.6)'; ctx.beginPath(); ctx.arc(Math.sin(e.ph * 5) * 6, -e.r - 6, 2.5, 0, TAU); ctx.fill(); }
  if (e.state === 'fuse' && Math.random() < 0.4) burst(e.x + 8, e.y - e.r - 14, 1, '#ffd97a', 40, { shape: 'dot', glow: 1, life: 0.3, size: 2 });
  ctx.restore();
  if (!e.boss && (e.hp < e.maxHp || e.elite)) {
    const w = e.r * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 13, w, 4);
    ctx.fillStyle = e.elite ? e.elite.color : '#ff5e7a'; ctx.fillRect(e.x - w / 2, e.y - e.r - 13, w * clamp(e.hp / e.maxHp, 0, 1), 4);
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
  if (P.surgeT > 0) { ctx.strokeStyle = 'rgba(255,217,122,' + (0.5 + 0.4 * Math.sin(P.tick * 20)) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, P.r + 9, 0, TAU); ctx.stroke(); }
  if (P.shield && P.shieldT <= 0) { ctx.strokeStyle = 'rgba(127,215,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, P.r + 7, P.tick * 2, P.tick * 2 + 4.5); ctx.stroke(); }
  if (P.webT > 0) { ctx.strokeStyle = 'rgba(233,228,208,0.7)'; ctx.lineWidth = 1; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(Math.cos(i * 1.26) * P.r * 1.5, Math.sin(i * 1.26) * P.r * 1.5); ctx.lineTo(Math.cos(i * 1.26 + 2.5) * P.r * 1.5, Math.sin(i * 1.26 + 2.5) * P.r * 1.5); ctx.stroke(); } }
  const a = P.aim, flip = Math.cos(a) < 0;
  const frame = P.moving ? 1 + (Math.floor(P.walk * 9) % 2) : 0;
  const bob = P.moving ? Math.abs(Math.sin(P.walk * 9)) * -2 : 0;
  const drawn = drawSprite('player', frame, 0, P.r + 4 + bob, { flip, sy: P.dashT > 0 ? 0.9 : 1, sx: P.dashT > 0 ? 1.15 : 1 });
  if (!drawn) { ctx.fillStyle = '#e8b04a'; ctx.beginPath(); ctx.arc(0, 0, P.r, 0, TAU); ctx.fill(); }
  // arme dans la main
  const w = P.weapon, hx = Math.cos(a) * P.r * 0.7, hy = Math.sin(a) * P.r * 0.4 - 2;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(a); ctx.lineCap = 'round';
  if (w === 'wand') { ctx.strokeStyle = '#e9e4d0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(P.r + 4, 0); ctx.stroke(); ctx.fillStyle = '#7fd7ff'; ctx.shadowColor = '#7fd7ff'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(P.r + 5, 0, 3, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; }
  else if (w === 'bow') { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(2, 0, 11, -1.3, 1.3); ctx.stroke(); ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(2 + Math.cos(-1.3) * 11, Math.sin(-1.3) * 11); ctx.lineTo(-2, 0); ctx.lineTo(2 + Math.cos(1.3) * 11, Math.sin(1.3) * 11); ctx.stroke(); }
  else if (w === 'blades') { ctx.strokeStyle = '#dfe6f0'; ctx.lineWidth = 3; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-2, s * 6); ctx.lineTo(P.r + 8, s * 3); ctx.stroke(); } ctx.strokeStyle = '#8a5a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(-5, 6); ctx.stroke(); }
  else if (w === 'orb') { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(P.r, 0); ctx.stroke(); ctx.fillStyle = '#ff7b3a'; ctx.shadowColor = '#ff7b3a'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(P.r + 3, 0, 5 + Math.sin(P.tick * 6), 0, TAU); ctx.fill(); ctx.shadowBlur = 0; }
  else if (w === 'storm') { ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(P.r + 2, 0); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.r + 2, 0); ctx.lineTo(P.r + 6, -4); ctx.lineTo(P.r + 8, 2); ctx.lineTo(P.r + 12, -3); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
  for (let i = 0; i < P.orbit; i++) {
    const oa = P.tick * 2.6 + i * TAU / P.orbit, ox = P.x + Math.cos(oa) * 44, oy = P.y + Math.sin(oa) * 44;
    ctx.fillStyle = '#c77dff'; ctx.shadowColor = '#c77dff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(ox, oy, 6, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox - 1.5, oy - 1.5, 2, 0, TAU); ctx.fill();
  }
  for (const pet of G.pets) drawSprite('pet', 0, pet.x, pet.y, { anchor: 'center', alpha: 0.9, flip: P.x < pet.x });
}

/* ---------- décors, torches, objets ---------- */
function drawProp(pr, tk) {
  const { x, y } = pr;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 20, 7, 0, 0, TAU); ctx.fill();
  if (pr.kind === 'chest' || pr.kind === 'armory') {
    const gold = pr.kind === 'armory' ? '#9fd8ff' : '#ffd97a';
    drawSprite(pr.used ? 'chest_open' : 'chest', 0, x, y + 14);
    if (pr.kind === 'armory') { ctx.fillStyle = gold; ctx.globalAlpha = 0.35; ctx.fillRect(x - 12, y - 8, 24, 6); ctx.globalAlpha = 1; }
    if (!pr.used) { ctx.strokeStyle = gold; ctx.globalAlpha = 0.4 + 0.3 * Math.sin(tk * 4); ctx.lineWidth = 2; ctx.strokeRect(x - 20, y - 16, 40, 32); ctx.globalAlpha = 1; }
  } else if (pr.kind === 'altar') {
    drawSprite('altar', 0, x, y + 14, { alpha: pr.used ? 0.7 : 1 });
    if (!pr.used) { ctx.fillStyle = 'rgba(199,125,255,' + (0.2 + 0.15 * Math.sin(tk * 3)) + ')'; ctx.beginPath(); ctx.arc(x, y - 16, 16, 0, TAU); ctx.fill(); }
  } else if (pr.kind === 'merchant') {
    drawSprite('merchant', 0, x, y + 18, { sy: 1 + Math.sin(tk * 2) * 0.015 });
  } else if (pr.kind === 'pedestal') {
    drawSprite('pedestal', 0, x, y + 14, { alpha: pr.used ? 0.7 : 1 });
    if (!pr.used) { ctx.strokeStyle = 'rgba(255,94,122,' + (0.4 + 0.3 * Math.sin(tk * 4)) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 18, 12 + Math.sin(tk * 4) * 2, 0, TAU); ctx.stroke(); }
  } else if (pr.kind === 'tablet') {
    drawTablet(pr, tk);
  } else if (pr.kind === 'fissure') {
    const env = G.world === 'envers', a = 0.6 + 0.4 * Math.sin(tk * 4 + x);
    ctx.strokeStyle = env ? 'rgba(255,255,255,' + a + ')' : 'rgba(199,125,255,' + a + ')'; ctx.lineWidth = env ? 3.5 : 2.5; ctx.lineJoin = 'round'; ctx.shadowColor = '#c77dff'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(x - 14, y - 20); ctx.lineTo(x - 5, y - 7); ctx.lineTo(x - 11, y + 1); ctx.lineTo(x + 2, y + 9); ctx.lineTo(x - 2, y + 20); ctx.lineTo(x + 10, y + 5); ctx.lineTo(x + 4, y - 4); ctx.lineTo(x + 15, y - 17); ctx.stroke(); ctx.shadowBlur = 0;
    if (dist(P.x, P.y, x, y) < 60) { ctx.font = 'bold 9px "Nunito", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e0d0ff'; ctx.fillText(env ? 'V : revenir' : 'V : traverser (' + crossCost() + ')', x, y + 30); }
  } else if (pr.kind === 'chestE') {
    drawSprite(pr.used ? 'chest_open' : 'chest', 0, x, y + 14);
    if (!pr.used) { ctx.strokeStyle = 'rgba(199,125,255,' + (0.5 + 0.3 * Math.sin(tk * 4)) + ')'; ctx.lineWidth = 2; ctx.strokeRect(x - 20, y - 16, 40, 32); }
  } else if (pr.kind === 'lever') {
    ctx.fillStyle = '#3a3550'; ctx.fillRect(x - 10, y - 2, 20, 10); ctx.fillStyle = '#4d4768'; ctx.fillRect(x - 12, y - 6, 24, 5);
    ctx.save(); ctx.translate(x, y - 4); ctx.rotate(pr.used ? 0.7 : -0.7); ctx.strokeStyle = '#8a8fa8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -18); ctx.stroke(); ctx.fillStyle = pr.used ? '#8fe388' : '#ff5e7a'; ctx.beginPath(); ctx.arc(0, -19, 4, 0, TAU); ctx.fill(); ctx.restore();
    if (!pr.used) { ctx.font = 'bold 9px "Nunito", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#e0d0ff'; ctx.fillText('levier', x, y + 18); }
  } else if (pr.kind === 'echo') {
    ctx.shadowColor = '#dff4ff'; ctx.shadowBlur = 16;
    drawSprite('player', 0, x, y + 14 + Math.sin(tk * 2) * 2, { alpha: 0.55 + 0.15 * Math.sin(tk * 3), flip: P.x < x }); ctx.shadowBlur = 0;
    ctx.font = 'bold 9px "Nunito", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#dff4ff'; ctx.fillText('ton écho', x, y + 26);
  } else if (pr.kind === 'weapon') {
    const w = WEAPONS[pr.id];
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill();
    ctx.font = '20px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(w.ic, x, y - 2 + Math.sin(tk * 3) * 2);
    ctx.font = 'bold 9px "Nunito", system-ui, sans-serif'; ctx.fillStyle = '#ffd97a'; ctx.fillText(w.name, x, y + 20);
  }
}
function drawTorches(room, tk) {
  for (const tc of room.torches) {
    const f = Math.floor(tk * 7 + tc.x * 0.1) % 2;
    drawSprite('torch', f, tc.x, tc.y + 12, {});
    if (Math.random() < 0.06) burst(tc.x, tc.y - 8, 1, G.floorData.biome.pal.torch, 20, { shape: 'dot', glow: 1, life: 0.7, grav: -50, size: 2 });
  }
}
function drawPickups(tk) {
  for (const p of pickups) {
    const bob = Math.sin(p.t * 5) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, 6, 2.5, 0, 0, TAU); ctx.fill();
    if (p.type === 'coin') drawSprite('coin', 0, p.x, p.y + bob, { anchor: 'center', sx: 0.6 + 0.4 * Math.abs(Math.cos(p.t * 4)) });
    else if (p.type === 'gem') { ctx.shadowColor = '#c77dff'; ctx.shadowBlur = 10; drawSprite('gem', 0, p.x, p.y + bob, { anchor: 'center' }); ctx.shadowBlur = 0; }
    else drawSprite('heart', 0, p.x, p.y + bob, { anchor: 'center', sx: 1 + Math.sin(p.t * 6) * 0.08, sy: 1 + Math.sin(p.t * 6) * 0.08 });
  }
}
