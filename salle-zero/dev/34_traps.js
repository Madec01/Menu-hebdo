/* =========================================================================
   SALLE ZÉRO — 34_traps.js
   Pièges : patterns déterministes pilotés par le temps de salle, télégraphe avant activation.
   Chaque piège expose update(dt, rt), render(ctx), dangerAt(x, y) (pour le bot) et hitPlayer.
   ========================================================================= */

const TRAP_KINDS = ['laser_sweep', 'laser_rotate', 'laser_grid', 'wall_fireball', 'spike_tiles', 'gas_zone', 'saw_rail', 'turret_fixed'];

class Trap {
  constructor(def, inst) {
    this.def = def; this.kind = def.kind; this.id = def.id; this.name = def.name;
    this.p = Object.assign({}, def.params || {}, inst.params || {});
    this.tx = inst.x; this.ty = inst.y; this.tw = inst.w || 1; this.th = inst.h || 1;
    this.x = ROOM_X + inst.x * TILE; this.y = ROOM_Y + inst.y * TILE; this.w = this.tw * TILE; this.h = this.th * TILE;
    this.cx = this.x + this.w / 2; this.cy = this.y + this.h / 2;
    this.phase = inst.phase || 0;
    const d = G.difficulty;
    this.damage = Math.round(def.damage * d.damageMul);
    this.period = (def.period || 3) / d.fireRateMul; this.telegraph = def.telegraph != null ? def.telegraph : 0.6; this.active = def.active != null ? def.active : 1;
    this.speedMul = d.speedMul; this.hitCd = 0; this.warned = -1; this.fireCount = 0; this.color = def.color || '#ff5e7a';
    this.disabled = false;
    /* --- adaptation des paramètres de contenu --- */
    const p = this.p;
    switch (this.kind) {
      case 'laser_sweep': p.axis = p.orientation === 'horizontal' ? 'y' : (p.axis || 'x'); break;
      case 'laser_rotate': if (p.lengthTiles) p.length = p.lengthTiles * TILE; if (p.startAngle != null) p.a0 = p.startAngle; break;
      case 'laser_grid': if (p.spacingTiles) p.spacing = p.spacingTiles; break;
      case 'wall_fireball': if (typeof p.dir === 'string') p.dir = { down: Math.PI / 2, up: -Math.PI / 2, left: Math.PI, right: 0 }[p.dir]; if (p.projSpeed) p.speed = p.projSpeed; if (p.every == null) p.every = def.period; if (!p.pattern) p.pattern = 'straight'; break;
      case 'gas_zone': if (p.radiusTiles) p.radius = p.radiusTiles * TILE; break;
      case 'saw_rail': if (p.speedTiles) p.speed = p.speedTiles * TILE; if (p.radiusTiles) p.radius = p.radiusTiles * TILE; if (!p.points) { const ax = p.axis || (this.th > this.tw ? 'y' : 'x'); const n = ax === 'y' ? Math.max(this.th, p.lengthTiles || 1) : Math.max(this.tw, p.lengthTiles || 1); p.points = ax === 'y' ? [{ x: 0, y: 0 }, { x: 0, y: n - 1 }] : [{ x: 0, y: 0 }, { x: n - 1, y: 0 }]; } break;
      case 'turret_fixed': if (p.mode) p.aim = p.mode === 'aim' ? 'player' : 'fixed'; if (p.projSpeed) p.speed = p.projSpeed; if (p.projSize) p.size = p.projSize; if (p.every == null) p.every = def.period; break;
    }
  }
  /* temps local du piège (avec décalage de phase) */
  lt(rt) { return Math.max(0, rt - this.phase); }
  /* cycle : renvoie {stage:'idle'|'warn'|'on', k} */
  cycle(rt) {
    const t = this.lt(rt) % this.period; const on0 = this.period - this.active;
    if (t >= on0) return { stage: 'on', k: (t - on0) / this.active, idx: Math.floor(this.lt(rt) / this.period) };
    if (t >= on0 - this.telegraph) return { stage: 'warn', k: (t - (on0 - this.telegraph)) / this.telegraph, idx: Math.floor(this.lt(rt) / this.period) };
    return { stage: 'idle', k: t / Math.max(0.01, on0 - this.telegraph), idx: Math.floor(this.lt(rt) / this.period) };
  }
  warn(idx, snd = 'trapWarn') { if (this.warned !== idx) { this.warned = idx; AudioEngine[snd]({ x: (this.cx - W / 2) / (W / 2), intensity: 0.5 }); } }
  hit(pl) { if (this.hitCd > 0) return; if (Combat.hitPlayer(this.damage, { type: 'trap', x: this.cx, y: this.cy })) this.hitCd = 0.5; }
  update(dt, rt) { this.hitCd -= dt; if (this.disabled) return; this['u_' + this.kind](dt, rt, G.player); }
  render(ctx, rt) { if (this.disabled) return; this['r_' + this.kind](ctx, rt); }
  dangerAt(x, y, rt) { const f = this['d_' + this.kind]; return f ? f.call(this, x, y, rt) : 0; }

  /* --- laser_sweep : rayon qui traverse la zone pendant la phase active (aller, puis retour au cycle suivant) --- */
  sweepSeg(rt) {
    const c = this.cycle(rt); const len = this.p.axis === 'y' ? this.h : this.w;
    let k = c.stage === 'on' ? c.k : 0; if (this.p.pingpong !== false && c.idx % 2 === 1) k = 1 - k;
    const o = k * len; const seg = this.p.axis === 'y' ? { ax: this.x, ay: this.y + o, bx: this.x + this.w, by: this.y + o } : { ax: this.x + o, ay: this.y, bx: this.x + o, by: this.y + this.h };
    seg.stage = c.stage; seg.k = c.k; seg.idx = c.idx; return seg;
  }
  u_laser_sweep(dt, rt, pl) { const s = this.sweepSeg(rt); if (s.stage === 'warn') this.warn(s.idx, 'trapLaser'); if (s.stage === 'on' && !pl.dead && segCircle(s.ax, s.ay, s.bx, s.by, pl.x, pl.y, pl.r - 2)) this.hit(pl); }
  r_laser_sweep(ctx, rt) {
    ctx.save(); ctx.strokeStyle = this.color; ctx.globalAlpha = 0.12; ctx.lineWidth = 1; ctx.strokeRect(this.x, this.y, this.w, this.h);
    const s = this.sweepSeg(rt);
    if (s.stage === 'idle') { ctx.globalAlpha = 0.25; ctx.setLineDash([4, 10]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke(); ctx.restore(); return; }
    const on = s.stage === 'on'; ctx.globalAlpha = on ? 1 : 0.4 + 0.4 * Math.sin(Time.now * 25);
    ctx.lineWidth = on ? 5 : 2; ctx.shadowColor = this.color; ctx.shadowBlur = on ? 20 : 6; if (!on) ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = this.color; [[s.ax, s.ay], [s.bx, s.by]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); });
    ctx.restore();
  }
  d_laser_sweep(x, y, rt) { const s = this.sweepSeg(rt + 0.2); if (s.stage === 'idle') return 0; return segCircle(s.ax, s.ay, s.bx, s.by, x, y, 44) ? 1 : 0; }

  /* --- laser_rotate : barre qui tourne autour du centre --- */
  rotA(rt) { return (this.p.a0 || 0) + this.lt(rt) * (this.p.angularSpeed || 1) * this.speedMul; }
  rotSeg(rt, i = 0) { const a = this.rotA(rt) + i * TAU / (this.p.arms || 1); const len = (this.p.length || 200); const inner = this.p.inner || 0; return { ax: this.cx + Math.cos(a) * inner, ay: this.cy + Math.sin(a) * inner, bx: this.cx + Math.cos(a) * len, by: this.cy + Math.sin(a) * len }; }
  u_laser_rotate(dt, rt, pl) { const c = this.cycle(rt); if (c.stage === 'warn') this.warn(c.idx, 'trapLaser'); if (c.stage !== 'on') return; for (let i = 0; i < (this.p.arms || 1); i++) { const s = this.rotSeg(rt, i); if (!pl.dead && segCircle(s.ax, s.ay, s.bx, s.by, pl.x, pl.y, pl.r - 2)) { this.hit(pl); break; } } }
  r_laser_rotate(ctx, rt) {
    ctx.save(); const c = this.cycle(rt); const arm = c.stage === 'on'; ctx.fillStyle = '#556'; ctx.beginPath(); ctx.arc(this.cx, this.cy, 12, 0, TAU); ctx.fill();
    ctx.globalAlpha = c.stage === 'idle' ? 0.25 : c.stage === 'warn' ? 0.4 + 0.4 * Math.sin(Time.now * 25) : 1;
    ctx.strokeStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = arm ? 16 : 6; ctx.lineWidth = arm ? 5 : 2; if (!arm) ctx.setLineDash([6, 6]);
    for (let i = 0; i < (this.p.arms || 1); i++) { const s = this.rotSeg(rt, i); ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke(); }
    ctx.restore();
  }
  d_laser_rotate(x, y, rt) { if (this.cycle(rt + 0.3).stage === 'idle') return 0; for (let i = 0; i < (this.p.arms || 1); i++) { const s = this.rotSeg(rt + 0.3, i); if (segCircle(s.ax, s.ay, s.bx, s.by, x, y, 40)) return 1; } return 0; }

  /* --- laser_grid : lignes parallèles qui s'allument par cycle (alternance paire/impaire) --- */
  gridLines() { const p = this.p; const sp = (p.spacing || 2) * TILE; const out = []; if (p.axis === 'y') { for (let y = this.y + sp / 2; y < this.y + this.h; y += sp) out.push({ ax: this.x, ay: y, bx: this.x + this.w, by: y }); } else { for (let x = this.x + sp / 2; x < this.x + this.w; x += sp) out.push({ ax: x, ay: this.y, bx: x, by: this.y + this.h }); } return out; }
  gridActive(rt) { const c = this.cycle(rt); const par = c.idx % 2; return { c, par }; }
  u_laser_grid(dt, rt, pl) { const { c, par } = this.gridActive(rt); if (c.stage === 'warn') this.warn(c.idx, 'trapLaser'); if (c.stage !== 'on' || pl.dead) return; this.gridLines().forEach((s, i) => { if (i % 2 === par && segCircle(s.ax, s.ay, s.bx, s.by, pl.x, pl.y, pl.r - 2)) this.hit(pl); }); }
  r_laser_grid(ctx, rt) {
    const { c, par } = this.gridActive(rt); ctx.save(); ctx.strokeStyle = this.color; ctx.shadowColor = this.color;
    this.gridLines().forEach((s, i) => {
      const mine = i % 2 === par; const on = c.stage === 'on' && mine; const warn = c.stage === 'warn' && mine;
      ctx.globalAlpha = on ? 1 : warn ? 0.35 + 0.35 * Math.sin(Time.now * 25) : 0.12; ctx.lineWidth = on ? 4 : 2; ctx.shadowBlur = on ? 14 : 0; ctx.setLineDash(on ? [] : [4, 8]);
      ctx.beginPath(); ctx.moveTo(s.ax, s.ay); ctx.lineTo(s.bx, s.by); ctx.stroke();
    });
    ctx.restore();
  }
  d_laser_grid(x, y, rt) { const { c, par } = this.gridActive(rt + 0.3); if (c.stage === 'idle') return 0; let d = 0; this.gridLines().forEach((s, i) => { if (i % 2 === par && segCircle(s.ax, s.ay, s.bx, s.by, x, y, 30)) d = 1; }); return d; }

  /* --- wall_fireball : émetteur au mur, tire des boules de feu (straight / fan / spiral) --- */
  u_wall_fireball(dt, rt, pl) {
    const p = this.p; const every = (p.every || 1.2) / G.difficulty.fireRateMul; const t = this.lt(rt); if (t < 0) return;
    const idx = Math.floor(t / every); const inCycle = t - idx * every;
    if (inCycle < this.telegraph && this.warned !== idx) { this.warned = idx; AudioEngine.trapWarn({ x: (this.cx - W / 2) / (W / 2), intensity: 0.3 }); }
    if (idx > this.fireCount - 1 && inCycle >= this.telegraph) {
      this.fireCount = idx + 1; const dir = p.dir != null ? p.dir : angleTo(this.cx, this.cy, W / 2, H / 2); const n = p.count || 1; const sp = (p.speed || 200) * this.speedMul;
      const pattern = p.pattern || 'straight';
      for (let i = 0; i < n; i++) {
        let a = dir; if (pattern === 'fan') a = dir + lerp(-(p.spread || 0.8) / 2, (p.spread || 0.8) / 2, n > 1 ? i / (n - 1) : 0.5); else if (pattern === 'spiral') a = dir + idx * (p.step || 0.4) + i * TAU / n; else if (pattern === 'aimed') a = angleTo(this.cx, this.cy, pl.x, pl.y);
        Projectiles.spawn({ x: this.cx + Math.cos(a) * 10, y: this.cy + Math.sin(a) * 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: p.size || 9, damage: this.damage, owner: 'enemy', life: 6, color: this.color, kind: 'fireball', trap: true });
      }
      AudioEngine.trapFire({ x: (this.cx - W / 2) / (W / 2), intensity: 0.5 });
    }
  }
  r_wall_fireball(ctx, rt) {
    const p = this.p; const every = (p.every || 1.2) / G.difficulty.fireRateMul; const t = this.lt(rt); const inCycle = t - Math.floor(t / every) * every; const warm = inCycle < this.telegraph ? inCycle / this.telegraph : 0;
    ctx.save(); ctx.fillStyle = '#3a3f55'; ctx.fillRect(this.x + 6, this.y + 6, this.w - 12, this.h - 12);
    ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 8 + warm * 18; ctx.beginPath(); ctx.arc(this.cx, this.cy, 8 + warm * 6, 0, TAU); ctx.fill(); ctx.restore();
  }
  d_wall_fireball(x, y) { return dist(x, y, this.cx, this.cy) < 70 ? 0.6 : 0; }

  /* --- spike_tiles : zone de dalles qui sortent des piques à rythme --- */
  spikeActive(tx, ty, idx) { return this.p.pattern === 'checker' ? ((tx + ty) % 2 === idx % 2) : true; }
  u_spike_tiles(dt, rt, pl) { const c = this.cycle(rt); if (c.stage === 'warn') this.warn(c.idx, 'trapSpike'); if (c.stage !== 'on' || pl.dead) return; for (let ty = 0; ty < this.th; ty++) for (let tx = 0; tx < this.tw; tx++) { if (!this.spikeActive(tx, ty, c.idx)) continue; if (circleRect(pl.x, pl.y, pl.r - 5, this.x + tx * TILE, this.y + ty * TILE, TILE, TILE)) { this.hit(pl); return; } } }
  r_spike_tiles(ctx, rt) {
    const c = this.cycle(rt); ctx.save();
    for (let ty = 0; ty < this.th; ty++) for (let tx = 0; tx < this.tw; tx++) {
      const x = this.x + tx * TILE, y = this.y + ty * TILE; const act = this.spikeActive(tx, ty, c.idx);
      if (!act) { ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4); ctx.strokeStyle = 'rgba(255,94,122,.2)'; ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5); continue; }
      ctx.fillStyle = c.stage === 'on' ? '#4a1f2a' : c.stage === 'warn' ? `rgba(255,94,122,${0.15 + 0.25 * c.k})` : 'rgba(255,255,255,.04)'; ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = 'rgba(255,94,122,.35)'; ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
      if (c.stage !== 'idle') { const h = c.stage === 'on' ? 1 : c.k * 0.3; ctx.fillStyle = c.stage === 'on' ? '#e8ecf7' : '#888'; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const px = x + 8 + i * 16, py = y + 8 + j * 16; ctx.beginPath(); ctx.moveTo(px - 5, py + 5); ctx.lineTo(px, py + 5 - 12 * h); ctx.lineTo(px + 5, py + 5); ctx.fill(); } }
    }
    ctx.restore();
  }
  d_spike_tiles(x, y, rt) { const c = this.cycle(rt + 0.3); if (c.stage === 'idle') return 0; for (let ty = 0; ty < this.th; ty++) for (let tx = 0; tx < this.tw; tx++) if (this.spikeActive(tx, ty, c.idx) && circleRect(x, y, 16, this.x + tx * TILE, this.y + ty * TILE, TILE, TILE)) return 1; return 0; }

  /* --- gas_zone : nuage circulaire périodique, dégâts continus --- */
  u_gas_zone(dt, rt, pl) { const c = this.cycle(rt); if (c.stage === 'warn') this.warn(c.idx, 'trapGas'); if (c.stage === 'on' && !pl.dead && dist(pl.x, pl.y, this.cx, this.cy) < (this.p.radius || 90) + pl.r * 0.5) { if (this.p.slow) pl.gasSlowUntil = Time.now + 0.1; this.acc = (this.acc || 0) + dt; if (this.acc >= 0.5) { this.acc = 0; Combat.hitPlayer(Math.max(1, Math.round(this.damage * 0.5)), { type: 'trap', x: this.cx, y: this.cy }); } } }
  r_gas_zone(ctx, rt) {
    const c = this.cycle(rt); const R = this.p.radius || 90; ctx.save();
    ctx.fillStyle = '#2f3a2a'; ctx.beginPath(); ctx.arc(this.cx, this.cy, 10, 0, TAU); ctx.fill();
    if (c.stage === 'warn') { ctx.strokeStyle = '#9f6'; ctx.setLineDash([6, 6]); ctx.globalAlpha = 0.3 + 0.4 * c.k; ctx.beginPath(); ctx.arc(this.cx, this.cy, R * (0.6 + 0.4 * c.k), 0, TAU); ctx.stroke(); }
    if (c.stage === 'on') { const g = ctx.createRadialGradient(this.cx, this.cy, R * 0.2, this.cx, this.cy, R); g.addColorStop(0, 'rgba(150,255,100,.45)'); g.addColorStop(1, 'rgba(150,255,100,.05)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.cx, this.cy, R * Math.min(1, 0.7 + c.k), 0, TAU); ctx.fill(); for (let i = 0; i < 5; i++) { const a = Time.now * 0.7 + i * 1.3, rr = R * 0.5 + Math.sin(Time.now * 2 + i) * 10; ctx.fillStyle = 'rgba(180,255,120,.12)'; ctx.beginPath(); ctx.arc(this.cx + Math.cos(a) * rr, this.cy + Math.sin(a) * rr, R * 0.35, 0, TAU); ctx.fill(); } }
    ctx.restore();
  }
  d_gas_zone(x, y, rt) { const c = this.cycle(rt + 0.4); return c.stage !== 'idle' && dist(x, y, this.cx, this.cy) < (this.p.radius || 90) + 20 ? 0.8 : 0; }

  /* --- saw_rail : scie qui suit des points de passage --- */
  sawPos(rt) {
    const pts = (this.p.points || [{ x: 0, y: 0 }, { x: this.tw - 1, y: 0 }]).map(q => ({ x: ROOM_X + (this.tx + q.x + 0.5) * TILE, y: ROOM_Y + (this.ty + q.y + 0.5) * TILE }));
    const loop = this.p.loop; const segs = []; let total = 0;
    const n = loop ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const l = dist(a.x, a.y, b.x, b.y); segs.push({ a, b, l }); total += l; }
    if (!total) return pts[0];
    const sp = (this.p.speed || 160) * this.speedMul; let d = this.lt(rt) * sp; d = loop ? d % total : (d % (2 * total) < total ? d % (2 * total) : 2 * total - d % (2 * total));
    for (const s of segs) { if (d <= s.l) { const k = d / s.l; return { x: lerp(s.a.x, s.b.x, k), y: lerp(s.a.y, s.b.y, k), pts }; } d -= s.l; }
    return Object.assign({}, pts[pts.length - 1], { pts });
  }
  u_saw_rail(dt, rt, pl) { const s = this.sawPos(rt); if (this.lt(rt) < this.telegraph) { this.warn(0, 'trapSaw'); return; } if (!pl.dead && dist(s.x, s.y, pl.x, pl.y) < (this.p.radius || 22) + pl.r - 3) this.hit(pl); if (Math.floor(rt * 2) !== this.sawT) { this.sawT = Math.floor(rt * 2); AudioEngine.trapSaw({ x: (s.x - W / 2) / (W / 2), intensity: 0.25 }); } }
  r_saw_rail(ctx, rt) {
    const s = this.sawPos(rt); const R = this.p.radius || 22; ctx.save();
    if (s.pts) { ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 4; ctx.beginPath(); s.pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); if (this.p.loop) ctx.closePath(); ctx.stroke(); }
    ctx.translate(s.x, s.y); ctx.rotate(rt * 14); ctx.fillStyle = '#cfd6e6'; ctx.shadowColor = this.color; ctx.shadowBlur = 10;
    ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i * TAU / 16, rr = i % 2 ? R : R * 0.75; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a3f55'; ctx.beginPath(); ctx.arc(0, 0, R * 0.35, 0, TAU); ctx.fill(); ctx.restore();
  }
  d_saw_rail(x, y, rt) { const s = this.sawPos(rt + 0.25); return dist(x, y, s.x, s.y) < (this.p.radius || 22) + 34 ? 1 : 0; }

  /* --- turret_fixed : tourelle à pattern (visée joueur ou angle fixe) --- */
  u_turret_fixed(dt, rt, pl) {
    const p = this.p; const every = (p.every || 1.5) / G.difficulty.fireRateMul; const t = this.lt(rt); if (t < 0) return; const idx = Math.floor(t / every); const inCycle = t - idx * every;
    if (inCycle < this.telegraph && this.warned !== idx) { this.warned = idx; AudioEngine.trapWarn({ x: (this.cx - W / 2) / (W / 2), intensity: 0.3 }); }
    this.aimA = p.aim === 'player' ? angleTo(this.cx, this.cy, pl.x, pl.y) : (p.angle || 0) + (p.rotate ? t * p.rotate : 0);
    if (idx > this.fireCount - 1 && inCycle >= this.telegraph) {
      this.fireCount = idx + 1; const n = p.count || 3, sp = (p.speed || 260) * this.speedMul, spread = p.spread || 0.5; const burst = p.burst || 1;
      for (let i = 0; i < n; i++) { const a = this.aimA + (n > 1 ? lerp(-spread / 2, spread / 2, i / (n - 1)) : 0); Projectiles.spawn({ x: this.cx + Math.cos(a) * 14, y: this.cy + Math.sin(a) * 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: p.size || 6, damage: this.damage, owner: 'enemy', life: 5, color: this.color, bounce: p.bounce || 0, trap: true }); }
      AudioEngine.shootPistol({ x: (this.cx - W / 2) / (W / 2), intensity: 0.35 });
    }
  }
  r_turret_fixed(ctx, rt) {
    const p = this.p; const every = (p.every || 1.5) / G.difficulty.fireRateMul; const t = this.lt(rt); const inCycle = t - Math.floor(t / every) * every; const warm = inCycle < this.telegraph ? inCycle / this.telegraph : 0;
    ctx.save(); ctx.translate(this.cx, this.cy); ctx.fillStyle = '#3a3f55'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
    ctx.rotate(this.aimA || 0); ctx.fillStyle = warm ? `rgb(255,${Math.round(200 - warm * 120)},80)` : '#8890aa'; ctx.fillRect(0, -5, 24, 10);
    ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = warm * 16; ctx.beginPath(); ctx.arc(0, 0, 6 + warm * 3, 0, TAU); ctx.fill(); ctx.restore();
  }
  d_turret_fixed(x, y) { return dist(x, y, this.cx, this.cy) < 60 ? 0.5 : 0; }
}
