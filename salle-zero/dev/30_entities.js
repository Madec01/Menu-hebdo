/* =========================================================================
   SALLE ZÉRO — 30_entities.js
   Joueur, armes, projectiles, pickups, particules, effets à hooks.
   Tout lit/écrit l'état global G (défini dans 40_room.js).
   ========================================================================= */

/* ---------- Particules (cosmétique) ---------- */
const Particles = {
  list: [],
  spawn(x, y, opts = {}) {
    const n = opts.count || 6;
    for (let i = 0; i < n; i++) {
      const a = opts.angle != null ? opts.angle + VFX_RNG.range(-(opts.spread || 0.5), opts.spread || 0.5) : VFX_RNG.range(0, TAU);
      const s = VFX_RNG.range(opts.speedMin || 40, opts.speedMax || 160);
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: VFX_RNG.range(0.2, opts.life || 0.5), t: 0, r: opts.size || 3, color: opts.color || '#fff', drag: opts.drag || 4, glow: opts.glow });
    }
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]; p.t += dt; if (p.t >= p.life) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx -= p.vx * p.drag * dt; p.vy -= p.vy * p.drag * dt;
    }
    if (this.list.length > 600) this.list.splice(0, this.list.length - 600);
  },
  render(ctx) {
    for (const p of this.list) {
      const k = 1 - p.t / p.life; ctx.globalAlpha = k;
      if (p.glow) { ctx.shadowBlur = 10; ctx.shadowColor = p.color; }
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + 0.6 * k), 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  },
};
/* Textes flottants (dégâts, +XP) */
const Floaters = {
  list: [],
  add(x, y, text, color = '#fff', size = 14) { this.list.push({ x, y, text, color, size, t: 0, life: 0.8, vy: -40 }); if (this.list.length > 80) this.list.shift(); },
  update(dt) { for (let i = this.list.length - 1; i >= 0; i--) { const f = this.list[i]; f.t += dt; f.y += f.vy * dt; if (f.t > f.life) this.list.splice(i, 1); } },
  render(ctx) {
    ctx.textAlign = 'center';
    for (const f of this.list) { ctx.globalAlpha = 1 - f.t / f.life; ctx.font = `bold ${f.size}px "Segoe UI", system-ui, sans-serif`; ctx.fillStyle = '#000a'; ctx.fillText(f.text, f.x + 1, f.y + 1); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
  },
};

/* ---------- Collision avec la salle (murs + obstacles) ---------- */
function resolveRoomCollision(e) {
  const r = e.r;
  e.x = clamp(e.x, ROOM_X + r, ROOM_X + ROOM_W - r); e.y = clamp(e.y, ROOM_Y + r, ROOM_Y + ROOM_H - r);
  for (const o of G.room.obstacles) {
    if (!circleRect(e.x, e.y, r, o.px, o.py, o.pw, o.ph)) continue;
    /* pousser hors du bloc selon l'axe de moindre pénétration */
    const cx = o.px + o.pw / 2, cy = o.py + o.ph / 2;
    const dx = e.x - cx, dy = e.y - cy;
    const px = o.pw / 2 + r - Math.abs(dx), py = o.ph / 2 + r - Math.abs(dy);
    if (px < py) e.x += px * Math.sign(dx || 1); else e.y += py * Math.sign(dy || 1);
    e.hitWall = true;
  }
}
function pointBlocked(x, y, r = 0) {
  if (x < ROOM_X + r || x > ROOM_X + ROOM_W - r || y < ROOM_Y + r || y > ROOM_Y + ROOM_H - r) return true;
  for (const o of G.room.obstacles) if (circleRect(x, y, r, o.px, o.py, o.pw, o.ph)) return true;
  return false;
}
function lineOfSight(ax, ay, bx, by) {
  const n = Math.ceil(dist(ax, ay, bx, by) / 16);
  for (let i = 1; i < n; i++) { const t = i / n; if (pointBlocked(lerp(ax, bx, t), lerp(ay, by, t))) return false; }
  return true;
}

/* ---------- Projectiles ---------- */
const Projectiles = {
  list: [],
  spawn(p) {
    const d = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, r: 5, damage: 10, owner: 'player', pierce: 0, bounce: 0, life: 2, t: 0, color: '#fff', kind: 'bullet', hit: null, crit: false, homing: 0, returning: false, passes: 0, gravity: 0 }, p);
    d.hit = new Set(); this.list.push(d); return d;
  },
  update(dt) {
    const pl = G.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      let p = this.list[i]; p.t += dt;
      if (p.homing && p.owner === 'player') {
        const tgt = nearestEnemy(p.x, p.y, 400);
        if (tgt) { const a = angleTo(p.x, p.y, tgt.x, tgt.y), sp = Math.hypot(p.vx, p.vy), cur = Math.atan2(p.vy, p.vx); const na = cur + clamp(wrapAngle(a - cur), -p.homing * dt, p.homing * dt); p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; }
      }
      if (p.returning) {          // boomerang / projectiles_return : deuxième passage vers le joueur
        const a = angleTo(p.x, p.y, pl.x, pl.y), sp = p.speed || Math.hypot(p.vx, p.vy) || 400;
        p.vx = lerp(p.vx, Math.cos(a) * sp, Math.min(1, 8 * dt)); p.vy = lerp(p.vy, Math.sin(a) * sp, Math.min(1, 8 * dt));
        if (dist(p.x, p.y, pl.x, pl.y) < pl.r + p.r + 4) { this.list.splice(i, 1); continue; }
      } else if (p.range != null && p.t * Math.hypot(p.vx, p.vy) > p.range) {
        if (p.canReturn) { p.returning = true; p.hit.clear(); p.passes++; } else { this.list.splice(i, 1); continue; }
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.spin != null) p.spin += dt * 20;
      /* murs & obstacles */
      let bounced = false;
      if (p.x < ROOM_X + p.r || p.x > ROOM_X + ROOM_W - p.r) { if (p.bounce > 0) { p.vx = -p.vx; p.bounce--; bounced = true; p.x = clamp(p.x, ROOM_X + p.r, ROOM_X + ROOM_W - p.r); } else if (!p.returning) { this.list.splice(i, 1); continue; } }
      if (p.y < ROOM_Y + p.r || p.y > ROOM_Y + ROOM_H - p.r) { if (p.bounce > 0) { p.vy = -p.vy; p.bounce--; bounced = true; p.y = clamp(p.y, ROOM_Y + p.r, ROOM_Y + ROOM_H - p.r); } else if (!p.returning) { this.list.splice(i, 1); continue; } }
      if (!p.ghost) for (const o of G.room.obstacles) {
        if (!circleRect(p.x, p.y, p.r, o.px, o.py, o.pw, o.ph)) continue;
        if (p.bounce > 0 || p.returning) {
          const cx = o.px + o.pw / 2, cy = o.py + o.ph / 2; const dx = (p.x - cx) / o.pw, dy = (p.y - cy) / o.ph;
          if (Math.abs(dx) > Math.abs(dy)) { p.vx = -p.vx; p.x = cx + Math.sign(dx) * (o.pw / 2 + p.r + 1); } else { p.vy = -p.vy; p.y = cy + Math.sign(dy) * (o.ph / 2 + p.r + 1); }
          if (!p.returning) p.bounce--; bounced = true;
        } else { this.list.splice(i, 1); p = null; break; }
      }
      if (!p) continue;
      if (bounced) { p.hit.clear(); Particles.spawn(p.x, p.y, { count: 3, color: p.color, size: 2 }); if (p.seekOnBounce) { const tgt = nearestEnemy(p.x, p.y, p.seekRadius || 220); if (tgt) { const sp = Math.hypot(p.vx, p.vy), a = angleTo(p.x, p.y, tgt.x, tgt.y); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; } } }
      if (p.t > p.life && !p.returning) { this.list.splice(i, 1); continue; }
      /* collisions */
      if (p.owner === 'player') {
        for (const e of G.enemies) {
          if (e.dead || p.hit.has(e)) continue;
          if (dist(p.x, p.y, e.x, e.y) < p.r + e.r) {
            p.hit.add(e);
            Combat.hitEnemy(e, p.damage, { x: p.x, y: p.y, crit: p.crit, noCrit: p.noCrit, proj: p, knockback: p.knockback || 1, vx: p.vx, vy: p.vy });
            if (p.pierce > 0) p.pierce--; else if (!p.returning && !p.ghostHits) { this.list.splice(i, 1); break; }
          }
        }
      } else {
        if (!pl.dead && dist(p.x, p.y, pl.x, pl.y) < p.r + pl.r) {
          /* orbes de protection */
          Combat.hitPlayer(p.damage, { type: 'projectile', x: p.x, y: p.y });
          this.list.splice(i, 1); continue;
        }
        if (pl.orbitShield) { let blocked = false; for (const o of pl.orbitShield.orbs) if (dist(p.x, p.y, o.x, o.y) < p.r + 12) { blocked = true; break; } if (blocked) { Particles.spawn(p.x, p.y, { count: 4, color: '#8ff', size: 2 }); this.list.splice(i, 1); continue; } }
      }
    }
  },
  render(ctx) {
    for (const p of this.list) {
      ctx.save(); ctx.translate(p.x, p.y);
      if (p.kind === 'arrow' || p.kind === 'bullet' && p.owner === 'player') { ctx.rotate(Math.atan2(p.vy, p.vx)); }
      if (p.spin != null) ctx.rotate(p.spin);
      ctx.shadowBlur = 12; ctx.shadowColor = p.color; ctx.fillStyle = p.color;
      if (p.kind === 'arrow') { ctx.fillRect(-10, -2, 20, 4); ctx.beginPath(); ctx.moveTo(10, -5); ctx.lineTo(16, 0); ctx.lineTo(10, 5); ctx.fill(); }
      else if (p.kind === 'boomerang') { ctx.lineWidth = 5; ctx.strokeStyle = p.color; ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(0, 2); ctx.lineTo(10, -8); ctx.stroke(); }
      else if (p.kind === 'flame') { ctx.globalAlpha = 0.7 * (1 - p.t / p.life) + 0.2; ctx.beginPath(); ctx.arc(0, 0, p.r * (0.6 + p.t / p.life), 0, TAU); ctx.fill(); }
      else if (p.kind === 'fireball') { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff8'; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.45, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill(); if (p.owner === 'enemy') { ctx.fillStyle = '#fff9'; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.4, 0, TAU); ctx.fill(); } }
      ctx.restore();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  },
};
function nearestEnemy(x, y, maxD = Infinity, filter) {
  let best = null, bd = maxD;
  for (const e of G.enemies) { if (e.dead || (filter && !filter(e))) continue; const d = dist(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
  return best;
}

/* ---------- Pickups ---------- */
const Pickups = {
  list: [],
  spawn(x, y, kind, value = 1) {
    const a = RNG.range(0, TAU), s = RNG.range(40, 120);
    this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, kind, value, t: 0, magnet: false, r: kind === 'fragment' ? 10 : 6 });
  },
  update(dt) {
    const pl = G.player; if (!pl) return;
    const always = pl.flags.xpMagnet || pl.magnetUntil > Time.now;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]; p.t += dt;
      const d = dist(p.x, p.y, pl.x, pl.y);
      if (p.magnet || d < pl.stats.pickupRadius || (always && p.kind !== 'fragment')) {
        p.magnet = true; const a = angleTo(p.x, p.y, pl.x, pl.y); const sp = 420 + p.t * 300; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      } else { p.vx -= p.vx * 5 * dt; p.vy -= p.vy * 5 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!p.magnet) resolveRoomCollision(p);
      if (d < pl.r + p.r + 2) { this.list.splice(i, 1); Combat.collect(p); }
    }
  },
  render(ctx) {
    for (const p of this.list) {
      const bob = Math.sin(Time.now * 6 + p.x) * 2;
      if (p.kind === 'xp') { ctx.fillStyle = '#7ef0ff'; ctx.shadowColor = '#7ef0ff'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(p.x, p.y + bob, 4 + Math.min(3, p.value / 6), 0, TAU); ctx.fill(); }
      else if (p.kind === 'coin') { ctx.fillStyle = '#ffd166'; ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(p.x, p.y + bob, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#b8860b'; ctx.fillRect(p.x - 1, p.y + bob - 3, 2, 6); }
      else if (p.kind === 'fragment') { ctx.save(); ctx.translate(p.x, p.y + bob); ctx.rotate(Time.now * 2); ctx.fillStyle = '#c8ff5a'; ctx.shadowColor = '#c8ff5a'; ctx.shadowBlur = 16; ctx.fillRect(-7, -7, 14, 14); ctx.fillStyle = '#fff'; ctx.fillRect(-3, -3, 6, 6); ctx.restore(); }
      else if (p.kind === 'heart') { ctx.fillStyle = '#ff5e7a'; ctx.shadowColor = '#ff5e7a'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(p.x - 3, p.y + bob - 2, 4, 0, TAU); ctx.arc(p.x + 3, p.y + bob - 2, 4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(p.x - 7, p.y + bob - 1); ctx.lineTo(p.x + 7, p.y + bob - 1); ctx.lineTo(p.x, p.y + bob + 7); ctx.fill(); }
    }
    ctx.shadowBlur = 0;
  },
};

/* ---------- Statuts (brûlure, gel, poison) partagés ennemis ---------- */
function applyStatus(e, kind, params) {
  e.status = e.status || {};
  if (kind === 'burn') { const s = e.status.burn || { dps: 0, until: 0 }; s.dps = Math.max(s.dps, params.dps); s.until = Time.now + params.duration; e.status.burn = s; }
  if (kind === 'freeze') { e.status.freeze = { slow: Math.max(params.slow, e.status.freeze ? e.status.freeze.slow : 0), until: Time.now + params.duration }; }
  if (kind === 'poison') { const s = e.status.poison || { stacks: 0, dps: params.dps, until: 0 }; s.stacks = Math.min(params.stacks || 5, s.stacks + 1); s.until = Time.now + params.duration; e.status.poison = s; }
}
function updateStatus(e, dt) {
  if (!e.status) return 1;
  let slow = 1;
  const b = e.status.burn; if (b) { if (Time.now > b.until) delete e.status.burn; else { e.acc = (e.acc || 0) + b.dps * dt; } }
  const p = e.status.poison; if (p) { if (Time.now > p.until) delete e.status.poison; else { e.acc = (e.acc || 0) + p.dps * p.stacks * dt; } }
  const f = e.status.freeze; if (f) { if (Time.now > f.until) delete e.status.freeze; else slow = 1 - f.slow; }
  if (e.acc >= 1) { const d = Math.floor(e.acc); e.acc -= d; Combat.hitEnemy(e, d, { dot: true, x: e.x, y: e.y }); }
  return slow;
}

/* ---------- Combat : point d'entrée de tous les dégâts ---------- */
const Combat = {
  hitEnemy(e, dmg, info = {}) {
    if (e.dead) return;
    const pl = G.player;
    let d = dmg;
    if (!info.dot && !info.noCrit) {
      const crit = info.crit != null ? info.crit : RNG.chance(pl.stats.critChance);
      if (crit) { d *= pl.stats.critMult; info.crit = true; }
    }
    if (e.isBoss) {
      if (e.weakActive) d *= e.weakMul;
      else if (e.weak.rule === 'back' && !info.dot && info.vx != null && !(info.proj && info.proj.returning)) {   // le retour du boomerang ne compte pas comme un coup dans le dos
        const a = Math.atan2(info.vy, info.vx);
        if (Math.abs(wrapAngle(a - e.facingA)) < (e.weak.coneAngle || 1.57) / 2) {
          d *= e.weakMul; info.backHit = true;
          if (Time.now >= (e.backStunReadyAt || 0)) { e.backStunReadyAt = Time.now + (e.weak.stunCooldown || 3); e.stunUntil = Time.now + (e.weak.window || 0.8); e.weakActive = true; e.weakUntil = e.stunUntil; Floaters.add(e.x, e.y - e.r - 24, 'DÉBRANCHÉ', '#ffd166', 18); AudioEngine.bossPhase({ intensity: 0.4 }); }
        }
      }
    }
    d = Math.max(1, Math.round(d));
    e.hp -= d; e.flash = 0.12;
    if (!info.dot) {
      const kb = (info.knockback || 1) * pl.stats.knockback * (e.isBoss ? 0.1 : 1) * 160 / Math.max(1, e.mass || 1);
      const a = info.vx != null ? Math.atan2(info.vy, info.vx) : angleTo(pl.x, pl.y, e.x, e.y);
      e.kvx += Math.cos(a) * kb; e.kvy += Math.sin(a) * kb;
      if (!info.silent) { AudioEngine[info.crit ? 'hitCrit' : 'hitEnemy']({ x: (e.x - W / 2) / (W / 2) }); }
      Particles.spawn(e.x, e.y, { count: info.crit ? 8 : 4, color: info.crit ? '#ffd166' : e.color, size: 2, speedMax: 120 });
      Floaters.add(e.x + VFX_RNG.range(-8, 8), e.y - e.r - 4, String(d), info.crit ? '#ffd166' : '#fff', info.crit ? 16 : 12);
      /* hooks onHit */
      for (const h of pl.hooks.onHit) {
        const chance = h.chance != null ? h.chance : 1;
        if (h.effect === 'burn' && RNG.chance(chance)) applyStatus(e, 'burn', h);
        else if (h.effect === 'freeze' && RNG.chance(chance)) applyStatus(e, 'freeze', h);
        else if (h.effect === 'poison' && RNG.chance(chance)) applyStatus(e, 'poison', h);
        else if (h.effect === 'chain' && RNG.chance(chance) && !info.chained) Combat.chain(e, d * (h.damageMul || 0.5), h.jumps || 2, h.radius || 180);
        else if (h.effect === 'crit_explode' && info.crit && !info.explosion) Combat.explosion(e.x, e.y, (h.radius || 70) * pl.stats.areaSize, d * (h.damageMul || 0.6), '#ffb347', true);
      }
      if (pl.stats.lifesteal > 0) pl.heal(d * pl.stats.lifesteal, true);
      G.run.stats.damageDealt += d;
    }
    if (e.hp <= 0) Combat.killEnemy(e, info);
  },
  chain(from, dmg, jumps, radius) {
    let cur = from; const done = new Set([from]);
    for (let i = 0; i < jumps; i++) {
      const nxt = nearestEnemy(cur.x, cur.y, radius, x => !done.has(x));
      if (!nxt) break; done.add(nxt);
      G.room.beams.push({ ax: cur.x, ay: cur.y, bx: nxt.x, by: nxt.y, t: 0, life: 0.15, color: '#b3e5ff', width: 3 });
      Combat.hitEnemy(nxt, dmg, { chained: true, noCrit: true, x: nxt.x, y: nxt.y, silent: true });
      cur = nxt;
    }
  },
  explosion(x, y, radius, dmg, color = '#ff8c42', fromPlayer = true) {
    G.room.blasts.push({ x, y, r: radius, t: 0, life: 0.35, color });
    Particles.spawn(x, y, { count: 14, color, size: 3, speedMax: 220, glow: true });
    if (fromPlayer) { for (const e of G.enemies) if (!e.dead && dist(x, y, e.x, e.y) < radius + e.r) Combat.hitEnemy(e, dmg, { explosion: true, noCrit: true, x, y, silent: true }); }
    else { const pl = G.player; if (!pl.dead && dist(x, y, pl.x, pl.y) < radius + pl.r) Combat.hitPlayer(dmg, { type: 'explosion', x, y }); }
    AudioEngine.skillShockwave({ x: (x - W / 2) / (W / 2), intensity: 0.6 });
  },
  killEnemy(e, info = {}) {
    if (e.dead) return; e.dead = true;
    const pl = G.player;
    AudioEngine.enemyDie({ x: (e.x - W / 2) / (W / 2) });
    Particles.spawn(e.x, e.y, { count: 12, color: e.color, size: 3, speedMax: 200, glow: true });
    G.run.stats.kills++; G.room.kills++;
    G.room.combo++; G.room.comboUntil = Time.now + 2.5; G.room.bestCombo = Math.max(G.room.bestCombo, G.room.combo);
    /* drops */
    const xpMul = pl.stats.xpGain * G.debug.xpMul, coinMul = pl.stats.coinGain * G.debug.coinMul;
    let xp = Math.round(e.xp * xpMul); let n = clamp(Math.ceil(xp / 5), 1, 6);
    for (let i = 0; i < n; i++) Pickups.spawn(e.x, e.y, 'xp', Math.max(1, Math.round(xp / n)));
    const coins = Math.round(e.coins * coinMul); for (let i = 0; i < coins; i++) Pickups.spawn(e.x, e.y, 'coin', 1);
    if (!e.isBoss && RNG.chance(0.03)) Pickups.spawn(e.x, e.y, 'heart', 15);
    for (const h of pl.hooks.onKill) {
      if (h.effect === 'explode') Combat.explosion(e.x, e.y, (h.radius || 80) * pl.stats.areaSize, Math.round(e.maxHp * (h.damageMul || 0.3)) + 5, '#ff8c42', true);
      else if (h.effect === 'heal_on_kill') pl.heal(h.amount * (h.stacks || 1));
      else if (h.effect === 'coin_on_kill' && RNG.chance(h.chance || 0.2)) Pickups.spawn(e.x, e.y, 'coin', h.amount || 1);
      else if (h.effect === 'kill_speed') { pl.killSpeedUntil = Time.now + (h.duration || 2); pl.killSpeedMul = h.speedMul || 1.3; }
      else if (h.effect === 'skill_reset_on_kill' && RNG.chance(h.chance || 0.2)) { pl.skillCd = Math.max(0, pl.skillCd - Skills.cooldownOf(pl) * (h.fraction || 0.5)); if (pl.skillCd <= 0 && pl.skillCharges < pl.skillMaxCharges) { pl.skillCharges++; } Floaters.add(pl.x, pl.y - 34, 'enchaînement', '#9ff', 12); }
    }
    if (e.isBoss) Room.onBossDefeated(e);
    if (e.onDeath) e.onDeath();
  },
  hitPlayer(dmg, info = {}) {
    const pl = G.player; if (pl.dead) return false;
    if (G.debug.invuln) return false;
    if (Time.now < pl.invulnUntil) return false;
    if (pl.dashing && pl.dashInvuln) return false;
    if (info.type === 'trap') {
      dmg *= pl.stats.trapDamageMul;   // la difficulté est déjà appliquée dans Trap (G.difficulty.damageMul)
      const heal = Progression.hasPassive(pl.hooks, 'traps_heal');
      if (heal) { pl.heal(Math.max(1, dmg * (heal.fraction || 0.5))); pl.invulnUntil = Time.now + 0.3; Floaters.add(pl.x, pl.y - 30, 'greffe !', '#7fff9a'); return false; }
      for (const h of pl.hooks.onTrapDamage) { if (h.effect === 'shockwave') Combat.playerShockwave(h); else if (h.effect === 'speed_burst') { pl.killSpeedUntil = Time.now + (h.duration || 2); pl.killSpeedMul = h.speedMul || 1.2; } }
    }
    if (RNG.chance(pl.stats.dodge)) { Floaters.add(pl.x, pl.y - 30, 'esquive', '#9ff'); pl.invulnUntil = Time.now + 0.2; return false; }
    dmg = Math.max(1, Math.round(dmg - pl.stats.armor));
    if (pl.shield > 0) { const used = Math.min(pl.shield, dmg); pl.shield -= used; dmg -= used; if (dmg <= 0) { pl.invulnUntil = Time.now + 0.25; Particles.spawn(pl.x, pl.y, { count: 6, color: '#8ff', size: 2 }); return true; } }
    pl.hp -= dmg; pl.invulnUntil = Time.now + pl.stats.invulnTime; pl.hurtFlash = 0.25;
    Run.lastDamageSource = (info.type || 'inconnu') + (info.source && info.source.name ? ' : ' + info.source.name : info.trapName ? ' : ' + info.trapName : '');
    G.room.hits++; G.room.combo = 0; G.run.stats.damageTaken += dmg; G.run.stats.hitsTaken++;
    AudioEngine.playerHurt({ intensity: clamp(dmg / 30, 0.3, 1) });
    Floaters.add(pl.x, pl.y - 30, '-' + dmg, '#ff5e7a', 16);
    Particles.spawn(pl.x, pl.y, { count: 8, color: '#ff5e7a', size: 3 });
    G.shake = Math.min(12, G.shake + 4 + dmg * 0.2);
    for (const h of pl.hooks.onDamaged) {
      if (h.effect === 'shockwave') Combat.playerShockwave(h);
      else if (h.effect === 'time_slow_on_damage') { Time.slow = h.scale || 0.4; Time.slowUntil = Time.now + (h.duration || 0.6); }
      else if (h.effect === 'speed_burst') { pl.killSpeedUntil = Time.now + (h.duration || 2); pl.killSpeedMul = h.speedMul || 1.2; }
    }
    if (pl.stats.thorns > 0 && info.source && !info.source.dead) Combat.hitEnemy(info.source, pl.stats.thorns, { noCrit: true, x: pl.x, y: pl.y, silent: true });
    if (pl.hp <= 0) pl.die();
    return true;
  },
  playerShockwave(h) {
    const pl = G.player; const r = (h.radius || 120) * pl.stats.areaSize * pl.stats.skillPower;
    G.room.blasts.push({ x: pl.x, y: pl.y, r, t: 0, life: 0.4, color: '#8ff' });
    for (const e of G.enemies) if (!e.dead && dist(pl.x, pl.y, e.x, e.y) < r + e.r) { Combat.hitEnemy(e, (h.damage || 15) * pl.stats.damage, { noCrit: true, knockback: h.knockback || 3, x: pl.x, y: pl.y, silent: true }); }
    for (let i = Projectiles.list.length - 1; i >= 0; i--) { const p = Projectiles.list[i]; if (p.owner === 'enemy' && dist(pl.x, pl.y, p.x, p.y) < r) Projectiles.list.splice(i, 1); }
    AudioEngine.skillShockwave({});
  },
  collect(p) {
    const pl = G.player;
    if (p.kind === 'xp') { Run.addXp(p.value); AudioEngine.pickupXp({ x: (p.x - W / 2) / (W / 2) }); }
    else if (p.kind === 'coin') { G.run.coinsPending += p.value; G.run.stats.coins += p.value; AudioEngine.pickupCoin({}); }
    else if (p.kind === 'fragment') {
      const mul = Progression.hasPassive(pl.hooks, 'fragments_double') ? 2 : 1;
      const xp = Math.round(p.value * mul * pl.stats.xpGain * G.debug.xpMul); Run.addXp(xp); G.room.fragments++;
      Floaters.add(p.x, p.y - 16, '+' + xp + ' XP', '#c8ff5a', 16); AudioEngine.pickupFragment({});
    }
    else if (p.kind === 'heart') { pl.heal(p.value); AudioEngine.pickupXp({ intensity: 1 }); }
  },
};

/* ---------- Armes ---------- */
const WEAPON_COLORS = { blade: '#e8ecf7', hammer: '#ffb347', bow: '#c8ff5a', pistol: '#ffe9a8', boomerang: '#7ef0ff', orb: '#c9a3ff', chain: '#b3e5ff', flame: '#ff8c42' };
const Weapons = {
  /* Appelé chaque pas quand le joueur tient le tir. Retourne true si une attaque a été déclenchée. */
  update(pl, dt, firing, aim) {
    const w = pl.weapon; const st = pl.stats;
    const rate = w.fireRate * st.fireRate;
    pl.attackCd -= dt;
    if (w.type === 'orbital') { Weapons.orbital(pl, dt, firing); return; }
    if (w.family === 'bow') {
      const ch = w.charge || { min: 0.15, max: 0.9, damageMul: 3 };
      if (firing && pl.attackCd <= 0) { const cs = Progression.hasPassive(pl.hooks, 'charge_speed'); pl.charge = Math.min(ch.max, pl.charge + dt * (cs ? (cs.mul || 1.4) : 1)); }
      else if (pl.charge > 0) { const t = clamp((pl.charge - ch.min) / Math.max(0.01, ch.max - ch.min), 0, 1); Weapons.shoot(pl, aim, { damageMul: lerp(1, ch.damageMul, t), speedMul: lerp(0.8, 1.4, t), extraPierce: t >= 0.99 ? ((w.special && w.special.chargedPierceBonus) || 1) : 0, kind: 'arrow', size: 4 + 3 * t }); pl.charge = 0; pl.attackCd = 1 / rate; }
      return;
    }
    if (!firing) { if (pl.flameOn) { pl.flameOn = false; AudioEngine.stopFlame(); } return; }
    if (w.family === 'flame') { Weapons.flame(pl, dt, aim, rate); return; }
    if (pl.attackCd > 0) return;
    pl.attackCd = 1 / rate;
    if (w.family === 'chain' || (w.special && w.special.kind === 'chain')) Weapons.chainStrike(pl, aim);
    else if (w.type === 'melee' || w.type === 'area') Weapons.melee(pl, aim);
    else Weapons.shoot(pl, aim, {});
  },
  dmgOf(pl, mul = 1) { return pl.weapon.damage * pl.stats.damage * mul; },
  shoot(pl, aim, o) {
    const w = pl.weapon, st = pl.stats;
    const n = (w.projectiles || 1) + st.projectiles; const spread = (w.spread || 0) + (n > 1 ? 0.12 * (n - 1) : 0);
    const spd = (w.projSpeed || 520) * st.projSpeed * (o.speedMul || 1);
    const canReturn = w.special && w.special.kind === 'return' || !!Progression.hasPassive(pl.hooks, 'projectiles_return');
    for (let i = 0; i < n; i++) {
      const a = aim + (n > 1 ? lerp(-spread / 2, spread / 2, i / (n - 1)) : 0) + RNG.range(-0.02, 0.02);
      Projectiles.spawn({
        x: pl.x + Math.cos(a) * (pl.r + 6), y: pl.y + Math.sin(a) * (pl.r + 6), vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, speed: spd,
        r: (o.size || w.size || 5), damage: Weapons.dmgOf(pl, o.damageMul || 1), owner: 'player',
        pierce: (w.pierce || 0) + st.pierce + (o.extraPierce || 0), bounce: (w.bounce || 0) + st.bounce,
        range: (w.range || 500) * st.range, life: 3, color: w.color || WEAPON_COLORS[w.family] || '#ffe9a8', kind: o.kind || (w.family === 'boomerang' ? 'boomerang' : 'bullet'),
        canReturn, knockback: w.knockback || 1, spin: w.family === 'boomerang' ? 0 : null, ghostHits: w.family === 'boomerang',
        homing: w.special && w.special.kind === 'homing' ? (w.special.turn || 3) : 0, seekOnBounce: !!(w.special && w.special.seekOnBounce), seekRadius: w.special && w.special.seekRadius,
      });
    }
    const snd = { blade: 'shootBlade', hammer: 'shootHammer', bow: 'shootBow', pistol: 'shootPistol', boomerang: 'shootBoomerang', orb: 'shootOrb', chain: 'shootChain', flame: 'shootFlame' }[w.family] || 'shootPistol';
    AudioEngine[snd]({ x: (pl.x - W / 2) / (W / 2) });
    G.run.stats.shots++;
  },
  melee(pl, aim) {
    const w = pl.weapon, st = pl.stats;
    const slam = w.special && w.special.kind === 'slam';
    const range = (w.range || 70) * st.range * st.areaSize; const arc = slam ? TAU : (w.special && w.special.arc || 2.1) * st.areaSize;
    const cx = slam ? pl.x + Math.cos(aim) * range * 0.6 : pl.x, cy = slam ? pl.y + Math.sin(aim) * range * 0.6 : pl.y;
    G.room.slashes.push({ x: pl.x, y: pl.y, a: aim, range, arc, t: 0, life: slam ? 0.28 : 0.16, color: w.color || WEAPON_COLORS[w.family] || '#fff', slam, cx, cy });
    let hits = 0;
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (slam) { if (dist(cx, cy, e.x, e.y) > range + e.r) continue; }
      else { const d = dist(pl.x, pl.y, e.x, e.y); if (d > range + e.r) continue; const da = Math.abs(wrapAngle(angleTo(pl.x, pl.y, e.x, e.y) - aim)); if (da > arc / 2 + Math.atan2(e.r, Math.max(1, d))) continue; }
      hits++;
      Combat.hitEnemy(e, Weapons.dmgOf(pl), { x: e.x, y: e.y, knockback: w.knockback || 1, vx: Math.cos(aim), vy: Math.sin(aim) });
    }
    /* sweep : les projectiles ennemis dans l'arc sont détruits */
    if (w.special && w.special.kind === 'sweep') for (let i = Projectiles.list.length - 1; i >= 0; i--) { const p = Projectiles.list[i]; if (p.owner === 'enemy' && dist(pl.x, pl.y, p.x, p.y) < range && Math.abs(wrapAngle(angleTo(pl.x, pl.y, p.x, p.y) - aim)) < arc / 2) { Projectiles.list.splice(i, 1); Particles.spawn(p.x, p.y, { count: 3, color: '#fff', size: 2 }); } }
    if (slam) G.shake = Math.min(10, G.shake + 5);
    AudioEngine[w.family === 'hammer' ? 'shootHammer' : 'shootBlade']({ x: (pl.x - W / 2) / (W / 2), intensity: hits ? 1 : 0.5 });
    G.run.stats.shots++;
  },
  chainStrike(pl, aim) {
    const w = pl.weapon, st = pl.stats; const range = (w.range || 260) * st.range;
    /* cible : l'ennemi le plus proche de la direction visée dans la portée */
    let best = null, bs = Infinity;
    for (const e of G.enemies) { if (e.dead) continue; const d = dist(pl.x, pl.y, e.x, e.y); if (d > range + e.r) continue; const da = Math.abs(wrapAngle(angleTo(pl.x, pl.y, e.x, e.y) - aim)); const s = d + da * 120; if (da < 1.2 && s < bs) { bs = s; best = e; } }
    AudioEngine.shootChain({ x: (pl.x - W / 2) / (W / 2) }); G.run.stats.shots++;
    const ex = best ? best.x : pl.x + Math.cos(aim) * range * 0.6, ey = best ? best.y : pl.y + Math.sin(aim) * range * 0.6;
    G.room.beams.push({ ax: pl.x, ay: pl.y, bx: ex, by: ey, t: 0, life: 0.12, color: w.color || '#b3e5ff', width: 4, jag: true });
    if (!best) return;
    Combat.hitEnemy(best, Weapons.dmgOf(pl), { x: best.x, y: best.y, knockback: 0.4, silent: true });
    const jumps = (w.special && w.special.jumps || 3) + st.projectiles;
    Combat.chain(best, Weapons.dmgOf(pl, (w.special && w.special.damageMul) || 0.7), jumps, (w.special && w.special.radius || 200) * st.range);
  },
  flame(pl, dt, aim, rate) {
    const w = pl.weapon, st = pl.stats;
    if (!pl.flameOn) { pl.flameOn = true; AudioEngine.startFlame({}); }
    pl.flameAcc = (pl.flameAcc || 0) + dt * rate * 3;   // 3 particules par tick, chacune 1/3 des dégâts → DPS nominal = damage × fireRate
    const cone = (w.spread || 0.5) * st.areaSize, range = (w.range || 170) * st.range;
    while (pl.flameAcc >= 1) {
      pl.flameAcc--;
      const a = aim + RNG.range(-cone / 2, cone / 2); const spd = (w.projSpeed || 380) * st.projSpeed * RNG.range(0.8, 1.2);
      Projectiles.spawn({ x: pl.x + Math.cos(aim) * (pl.r + 4), y: pl.y + Math.sin(aim) * (pl.r + 4), vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 7 * st.areaSize, damage: Math.max(1, Weapons.dmgOf(pl) / 3), owner: 'player', pierce: 2 + st.pierce, life: range / spd, range, color: w.color || '#ff8c42', kind: 'flame', ghost: true, knockback: 0.15, noCrit: true });
    }
    G.run.stats.shots += dt;
  },
  orbital(pl, dt, firing) {
    const w = pl.weapon, st = pl.stats;
    const n = (w.projectiles || 2) + st.projectiles;
    if (!pl.orbs || pl.orbs.length !== n) pl.orbs = Array.from({ length: n }, () => ({ x: pl.x, y: pl.y, cd: new Map() }));
    pl.orbAngle = (pl.orbAngle || 0) + dt * (w.special && (w.special.angularSpeed || w.special.spin) || 3.5) * Math.sqrt(st.fireRate);
    const targetR = (w.range || 80) * st.range * (firing ? (w.special && w.special.expand || 0.7) : 1);   // tirer = resserrer l'anneau sur les ennemis au contact
    pl.orbR = lerp(pl.orbR || targetR, targetR, Math.min(1, 6 * dt));
    if (firing && pl.attackCd <= 0) { pl.attackCd = 0.5; AudioEngine.shootOrb({}); }
    const rr = (w.size || 10) * st.areaSize; const tick = 1 / Math.max(0.5, w.fireRate * st.fireRate);
    pl.orbs.forEach((o, i) => {
      const a = pl.orbAngle + i * TAU / n; o.x = pl.x + Math.cos(a) * pl.orbR; o.y = pl.y + Math.sin(a) * pl.orbR;
      for (const e of G.enemies) { if (e.dead || dist(o.x, o.y, e.x, e.y) > rr + e.r) continue; const last = o.cd.get(e) || -9; if (Time.now - last < tick) continue; o.cd.set(e, Time.now); Combat.hitEnemy(e, Weapons.dmgOf(pl), { x: o.x, y: o.y, knockback: w.knockback || 0.6, vx: Math.cos(a + 1.5), vy: Math.sin(a + 1.5) }); }
      /* les orbes détruisent aussi les projectiles ennemis (faible) */
      if (w.special && (w.special.blocks || w.special.blocksProjectiles)) for (let k = Projectiles.list.length - 1; k >= 0; k--) { const p = Projectiles.list[k]; if (p.owner === 'enemy' && dist(o.x, o.y, p.x, p.y) < rr + p.r) Projectiles.list.splice(k, 1); }
    });
  },
};

/* ---------- Compétences actives ---------- */
const Skills = {
  cooldownOf(pl) { return pl.skill.cooldown * (1 - pl.stats.cooldownReduction); },
  use(pl, aim) {
    if (pl.skillCharges <= 0) return false;
    const s = pl.skill, e = s.effect, pw = pl.stats.skillPower;
    pl.skillCharges--; if (pl.skillCharges < pl.skillMaxCharges && pl.skillCd <= 0) pl.skillCd = Skills.cooldownOf(pl);
    switch (e.kind) {
      case 'dash': {
        const d = (e.distance || 200) * pw; pl.dashing = true; pl.dashInvuln = e.invulnerable !== false; pl.dashT = 0; pl.dashDur = e.duration || s.duration || 0.18;
        const mv = pl.moveDir.x || pl.moveDir.y ? Math.atan2(pl.moveDir.y, pl.moveDir.x) : aim; pl.dashVx = Math.cos(mv) * d / pl.dashDur; pl.dashVy = Math.sin(mv) * d / pl.dashDur;
        AudioEngine.dash({}); for (const h of pl.hooks.onDash) Skills.dashHook(pl, h);
        break; }
      case 'shield': pl.shield = Math.round((e.amount || 40) * pw); pl.shieldUntil = Time.now + (s.duration || 5); AudioEngine.skillShield({}); break;
      case 'shockwave': Combat.playerShockwave({ radius: (e.radius || 160), damage: (e.damage || 25), knockback: e.knockback || 3 }); for (const en of G.enemies) if (!en.dead && dist(pl.x, pl.y, en.x, en.y) < (e.radius || 160) * pw) en.stunUntil = Time.now + (e.stun || 0.8); break;
      case 'slowtime': Time.slow = e.scale || 0.35; Time.slowUntil = Time.now + (s.duration || 3) * pw; pl.slowImmune = Time.slowUntil; AudioEngine.skillSlowtime({}); break;
      case 'turret': G.room.turrets.push({ x: pl.x, y: pl.y, until: Time.now + (s.duration || 8), cd: 0, rate: e.fireRate || 3, damage: (e.damage || 8) * pl.stats.damage * pw, range: e.range || 380, hp: 1 }); AudioEngine.skillTurret({}); break;
      case 'blink': { const d = (e.distance || 220) * pw; let tx = pl.x + Math.cos(aim) * d, ty = pl.y + Math.sin(aim) * d; for (let k = 0; k < 10 && pointBlocked(tx, ty, pl.r); k++) { tx = lerp(pl.x, tx, 0.85); ty = lerp(pl.y, ty, 0.85); } Particles.spawn(pl.x, pl.y, { count: 12, color: '#c9a3ff', glow: true }); pl.x = tx; pl.y = ty; resolveRoomCollision(pl); pl.invulnUntil = Math.max(pl.invulnUntil, Time.now + (e.invuln || 0.3)); Particles.spawn(pl.x, pl.y, { count: 12, color: '#c9a3ff', glow: true }); AudioEngine.skillBlink({}); for (const h of pl.hooks.onDash) Skills.dashHook(pl, h); break; }
      case 'magnet': pl.magnetUntil = Time.now + (s.duration || 6); for (const p of Pickups.list) p.magnet = true; AudioEngine.skillMagnet({}); break;
      case 'decoy': G.room.decoys.push({ x: pl.x, y: pl.y, until: Time.now + (s.duration || 5), hp: (e.hp || 60) * pw, r: 14, explode: e.explode }); AudioEngine.skillTurret({}); break;
      case 'overdrive': pl.overdriveUntil = Time.now + (s.duration || 5); pl.overdrive = { fireRate: e.fireRateMul || e.fireRate || 1.5, damage: e.damageMul || e.damage || 1.5, speed: e.speedMul || 1.1, selfDps: e.selfDamagePerSec || 0 }; pl.recompute(); AudioEngine.skillShield({ intensity: 1 }); break;
    }
    for (const h of pl.hooks.onSkill) {
      if (h.effect === 'shockwave') Combat.playerShockwave(h);
      else if (h.effect === 'bullet_time_skill') { Time.slow = h.scale || 0.5; Time.slowUntil = Time.now + (h.duration || 0.8); }
    }
    G.run.stats.skillUses++;
    return true;
  },
  dashHook(pl, h) {
    if (h.effect === 'fire_trail') pl.trail = { until: Time.now + 0.35, dps: h.dps || 20, duration: h.duration || 2 };
    else if (h.effect === 'shockwave') Combat.playerShockwave(h);
  },
};

/* ---------- Joueur ---------- */
class Player {
  constructor(charDef) {
    this.char = charDef; this.x = W / 2; this.y = H / 2; this.r = 14; this.vx = 0; this.vy = 0;
    this.aim = 0; this.moveDir = { x: 0, y: 0 }; this.facing = 1;
    this.hp = 100; this.shield = 0; this.shieldUntil = 0; this.invulnUntil = 0; this.hurtFlash = 0; this.dead = false;
    this.attackCd = 0; this.charge = 0; this.skillCd = 0; this.skillCharges = 1; this.skillMaxCharges = 1;
    this.dashing = false; this.dashT = 0; this.dashDur = 0; this.dashVx = 0; this.dashVy = 0; this.dashInvuln = true;
    this.magnetUntil = 0; this.killSpeedUntil = 0; this.killSpeedMul = 1; this.overdriveUntil = 0; this.overdrive = null;
    this.flags = {}; this.weapon = null; this.skill = null; this.trail = null; this.orbitShield = null; this.secondChanceUsed = false;
    this.stats = Object.assign({}, BASE_STATS); this.hooks = Progression.collectHooks([]);
    this.bot = null;  // contrôleur autoplay
  }
  sources() {
    const src = [];
    const c = this.char; if (c) { src.push({ id: c.id, mods: Object.keys(c.stats || {}).map(k => k === 'maxHp' || k === 'speed' || k === 'luck' ? { stat: k, add: c.stats[k] - BASE_STATS[k] } : { stat: k, mul: c.stats[k] / BASE_STATS[k] }) }); if (c.trait) src.push(c.trait); }
    src.push(...Meta.activeSources());
    if (G.run.levelPassive) { src.push(G.run.levelPassive.bonus); src.push(G.run.levelPassive.malus); }
    for (const u of G.run.upgrades) src.push(Object.assign({}, u.def, { stacks: u.stacks }));
    if (this.overdrive && Time.now < this.overdriveUntil) src.push({ id: 'overdrive', mods: [{ stat: 'fireRate', mul: this.overdrive.fireRate }, { stat: 'damage', mul: this.overdrive.damage }, { stat: 'speed', mul: this.overdrive.speed }] });
    return src;
  }
  recompute() {
    const src = this.sources();
    const hooks = Progression.collectHooks(src);
    const gc = Progression.hasPassive(hooks, 'glass_cannon'); if (gc) src.push({ id: 'glass', mods: [{ stat: 'damage', mul: gc.damageMul || 2 }, { stat: 'maxHp', mul: gc.hpMul || 0.5 }] });
    const oldMax = this.stats.maxHp; this.stats = Progression.computeStats(src); this.hooks = hooks;
    if (this.stats.maxHp > oldMax) this.hp += this.stats.maxHp - oldMax; this.hp = Math.min(this.hp, this.stats.maxHp);
    this.flags.xpMagnet = !!Progression.hasPassive(hooks, 'xp_magnet');
    this.skillMaxCharges = Progression.hasPassive(hooks, 'double_skill') ? 2 : 1; this.skillCharges = Math.min(this.skillCharges, this.skillMaxCharges);
    const os = Progression.hasPassive(hooks, 'orbit_shield'); this.orbitShield = os ? { count: os.count || 2, damage: os.damage || 6, radius: os.radius || 48, orbs: [], cd: new Map() } : null;
    if (this.weapon && this.weapon.type !== 'orbital') this.orbs = null;
  }
  heal(n, silent) { if (this.dead) return; const before = this.hp; this.hp = Math.min(this.stats.maxHp, this.hp + n); if (!silent && this.hp - before >= 1) Floaters.add(this.x, this.y - 30, '+' + Math.round(this.hp - before), '#7fff9a'); }
  die() {
    const sc = Progression.hasPassive(this.hooks, 'second_chance') || Meta.resurrectAvailable();
    if (sc && !this.secondChanceUsed) { this.secondChanceUsed = true; this.hp = Math.round(this.stats.maxHp * (sc.hpFraction || 0.5)); this.invulnUntil = Time.now + 2; G.room.died = true; Combat.playerShockwave({ radius: 220, damage: 30, knockback: 4 }); Floaters.add(this.x, this.y - 40, 'RÉIMPRESSION', '#ffb347', 20); AudioEngine.levelUp({}); return; }
    this.dead = true; this.hp = 0; AudioEngine.playerDie({}); Run.onPlayerDeath();
  }
  update(dt) {
    if (this.dead) return;
    /* --- intentions : humain ou bot --- */
    let mv, aim, firing, wantSkill;
    if (this.bot) { const c = this.bot(this); mv = c.move; aim = c.aim; firing = c.fire; wantSkill = c.skill; }
    else {
      mv = Input.axis(); aim = angleTo(this.x, this.y, Input.mouse.x, Input.mouse.y);
      firing = Input.mouse.down || Input.isDown('fire'); wantSkill = Input.wasPressed('skill') || Input.wasPressed('mouse2');
    }
    this.moveDir = mv; this.aim = aim; if (Math.abs(Math.cos(aim)) > 0.2) this.facing = Math.cos(aim) > 0 ? 1 : -1;
    /* --- déplacement --- */
    if (this.dashing) {
      this.dashT += dt; this.x += this.dashVx * dt; this.y += this.dashVy * dt;
      Particles.spawn(this.x, this.y, { count: 2, color: '#9ff', size: 3, speedMax: 30, life: 0.3 });
      if (this.trail && Time.now < this.trail.until) G.room.hazards.push({ x: this.x, y: this.y, r: 22, until: Time.now + this.trail.duration, dps: this.trail.dps * this.stats.damage, color: '#ff8c42', owner: 'player', cd: new Map() });
      if (this.dashT >= this.dashDur) this.dashing = false;
    } else {
      let sp = this.stats.speed; if (Time.now < this.killSpeedUntil) sp *= this.killSpeedMul;
      if (this.charge > 0) sp *= 0.6; if (this.gasSlowUntil > Time.now) sp *= 0.7;
      if (Time.now < Time.slowUntil && this.slowImmune > Time.now) sp /= Time.slow;  // ralenti du temps : le joueur garde sa vitesse
      this.vx = mv.x * sp; this.vy = mv.y * sp; this.x += this.vx * dt; this.y += this.vy * dt;
      this.walkT = (this.walkT || 0) + (mv.x || mv.y ? dt : 0);
    }
    this.hitWall = false; resolveRoomCollision(this);
    /* --- régén, boucliers, timers --- */
    if (this.stats.regen > 0) this.heal(this.stats.regen * dt, true);
    if (this.shield > 0 && Time.now > this.shieldUntil) this.shield = 0;
    if (this.overdrive) { if (Time.now > this.overdriveUntil) { this.overdrive = null; this.recompute(); } else if (this.overdrive.selfDps) this.hp = Math.max(1, this.hp - this.overdrive.selfDps * dt); }
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.skillCd > 0) { this.skillCd -= dt; if (this.skillCd <= 0 && this.skillCharges < this.skillMaxCharges) { this.skillCharges++; if (this.skillCharges < this.skillMaxCharges) this.skillCd = Skills.cooldownOf(this); AudioEngine.uiHover && AudioEngine.uiHover({ intensity: 0.3 }); } }
    /* --- arme & compétence --- */
    Weapons.update(this, dt, firing, aim);
    if (wantSkill && this.skill) Skills.use(this, aim);
    /* --- orbes de protection --- */
    if (this.orbitShield) {
      const os = this.orbitShield; os.a = (os.a || 0) + dt * 2.6;
      os.orbs = Array.from({ length: os.count }, (_, i) => ({ x: this.x + Math.cos(os.a + i * TAU / os.count) * os.radius, y: this.y + Math.sin(os.a + i * TAU / os.count) * os.radius }));
      for (const o of os.orbs) for (const e of G.enemies) { if (e.dead || dist(o.x, o.y, e.x, e.y) > 12 + e.r) continue; const last = os.cd.get(e) || -9; if (Time.now - last < 0.5) continue; os.cd.set(e, Time.now); Combat.hitEnemy(e, os.damage * this.stats.damage, { x: o.x, y: o.y, knockback: 1.5, silent: true }); }
    }
  }
  render(ctx) {
    if (this.dead) return;
    const blink = Time.now < this.invulnUntil && Math.floor(Time.now * 20) % 2 === 0 && !this.dashing;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.45;
    /* ombre */
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r - 2, this.r * 0.9, this.r * 0.4, 0, 0, TAU); ctx.fill();
    Sprites.draw(ctx, this.char && this.char.sprite || 'player', this.x, this.y, { flip: this.facing < 0, walk: this.walkT, fallback: () => {
      ctx.fillStyle = this.hurtFlash > 0 ? '#ff9db0' : '#e8ecf7'; ctx.shadowColor = '#6ee7ff'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#0b0d14'; ctx.beginPath(); ctx.arc(this.x + Math.cos(this.aim) * 6, this.y + Math.sin(this.aim) * 6, 4, 0, TAU); ctx.fill(); } });
    /* bouclier */
    if (this.shield > 0) { ctx.strokeStyle = '#8ff'; ctx.lineWidth = 2; ctx.shadowColor = '#8ff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 6, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0; }
    /* charge de l'arc */
    if (this.charge > 0) { const ch = this.weapon.charge || { min: 0.15, max: 0.9 }; const t = clamp((this.charge - ch.min) / (ch.max - ch.min), 0, 1); ctx.strokeStyle = t >= 1 ? '#ffd166' : '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * t); ctx.stroke(); }
    /* orbes d'arme */
    if (this.orbs) for (const o of this.orbs) { ctx.fillStyle = this.weapon.color || WEAPON_COLORS[this.weapon.family] || '#c9a3ff'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(o.x, o.y, (this.weapon.size || 10) * this.stats.areaSize, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; }
    if (this.orbitShield) for (const o of this.orbitShield.orbs) { ctx.fillStyle = '#8ff'; ctx.shadowColor = '#8ff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(o.x, o.y, 6, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; }
    /* indicateur de visée */
    ctx.globalAlpha = 0.35; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(this.x + Math.cos(this.aim) * (this.r + 4), this.y + Math.sin(this.aim) * (this.r + 4)); ctx.lineTo(this.x + Math.cos(this.aim) * (this.r + 18), this.y + Math.sin(this.aim) * (this.r + 18)); ctx.stroke();
    ctx.restore();
  }
}
