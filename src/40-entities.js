/* ---------- helpers d'effets ---------- */
function ft(x, y, txt, color, size, life) { texts.push({ x, y, txt, color: color || '#fff', size: size || 12, life: life || 0.8, max: life || 0.8 }); }
function burst(x, y, n, color, spd, opts) {
  opts = opts || {};
  if (parts.length > 900) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = Math.random() * spd;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: (opts.life || 0.55) * (0.5 + Math.random() * 0.8), max: opts.life || 0.55, color, size: (opts.size || 3) * (0.6 + Math.random() * 0.8), grav: opts.grav || 0, shape: opts.shape || 'sq', glow: opts.glow || 0 });
  }
}
function addZone(z) { z.t = 0; zones.push(z); SFX('telegraph'); }
function addPool(x, y, type, r, life) { pools.push({ x, y, type, r, life, max: life, ph: Math.random() * TAU }); }
const activeEnemies = () => enemies.filter(e => !e.dead && e.spawnT <= 0 && inWorld(e));
const bestiaryMul = type => 1 + Math.min(0.25, Math.floor((save.bestiary[type] || 0) / 25) * 0.05);
const curWeapon = () => WEAPONS[P.weapon];
function playerDamage() { const w = curWeapon(); return (w.dmg + P.dmgFlat) * P.dmgMul * (P.surgeT > 0 ? 1.5 : 1); }
function shakeIt(v) { shake = Math.max(shake, v * save.shakeAmt); }

/* ---------- joueur ---------- */
function makePlayer() {
  return {
    x: 0, y: 0, r: 11, hp: 6, maxHp: 6, spd: 175, vx: 0, vy: 0,
    dmgFlat: 0, dmgMul: 1, rateMul: 1, bSpdMul: 1, bLife: 0.95, bSize: 0, multi: 1, pierce: 0, bounce: 0, crit: 0, lifesteal: 0,
    shield: false, shieldT: 0, explode: false, slow: false, thorns: 0, magnet: 70, orbit: 0, pet: 0, fireDash: false, ricochet: 0,
    homing: 0, luck: 0, dodge: 0, revive: 0, venom: 0, surgeGain: 1, greed: 0, comboWindow: 0, noDash: false,
    weapon: save.weapons.includes(save.startWeapon) ? save.startWeapon : 'wand',
    dashCd: 1.5, dashCdT: 0, dashT: 0, ddx: 1, ddy: 0, inv: 0, fireT: 0, fx: 1, fy: 0, aim: 0, tick: 0, moving: false, walk: 0,
    safeX: 0, safeY: 0, safeT: 0, fallT: 0, hazT: 0, surgeT: 0, webT: 0, slowT: 0, onIce: false, inWater: false,
    stunT: 0, voileCostMul: 1, voileDrainMul: 1, refletBonus: false, enversSpeed: false,
  };
}

/* ---------- ennemis ---------- */
function makeEnemy(type, x, y, opts) {
  opts = opts || {};
  const b = ETYPES[type], f = G.floor;
  const hpScale = (1 + 0.28 * (f - 1) + 0.5 * cycleOf(f)) * ((G.oath && G.oath.enemyHp) || 1) * (opts.minion ? 0.6 : 1);
  const e = {
    id: nextId++, type, name: b.name, shape: b.shape, x, y, r: b.r, hp: Math.ceil(b.hp * hpScale), maxHp: 0, spd: b.spd * (1 + 0.025 * (f - 1)),
    color: b.color, dark: b.dark, contact: b.contact, ai: b.ai, fly: !!b.fly, fireCd: b.fireCd || 0, bSpd: (b.bSpd || 200) * (1 + 0.03 * (f - 1)),
    spread: b.spread || 1, slowShot: !!b.slowShot, homing: !!b.homing, shooter: !!b.shooter, dashSpd: b.dashSpd || 400, windT: b.windT || 0.5,
    ringOnWall: !!b.ringOnWall, hunter: !!b.hunter, spawnT: opts.instant ? 0 : 0.6 + Math.random() * 0.5, fireT: R(0.9, 2.2), cd: R(0, 1),
    state: 'idle', stT: 0, dirx: 0, diry: 0, tx: 0, ty: 0, flash: 0, slowT: 0, ph: R(0, TAU), alpha: 1, poisonT: 0, poisonTick: 0,
    minion: !!opts.minion, elite: null, dead: false, hitCd: 0, fuse: 0, boss: false, noCount: !!b.hunter,
    world: b.hunter ? 'both' : opts.reflet ? 'envers' : 'normal', reflet: !!opts.reflet,
  };
  if (e.reflet) { e.hp = Math.max(1, Math.ceil(e.hp * 0.6)); e.spd *= 1.3; e.fly = true; e.color = '#d8c8ff'; e.dark = '#5b2a8a'; e.alpha = 0.9; e.name = 'Reflet de ' + e.name; }
  e.maxHp = e.hp;
  if (!e.reflet && (opts.elite || (!opts.minion && !b.hunter && f >= 2 && chance(0.1 + 0.012 * f)))) {
    const el = pick(ELITES); e.elite = el; el.f(e); e.maxHp = Math.max(e.maxHp, e.hp); e.r += 2;
  }
  return e;
}
function spawnEnemies(room) {
  room.spawned = true;
  if (room.type === 'boss') { enemies.push(makeBoss()); return; }
  spawnWave(3 + Math.min(G.floor, 7) + RI(0, 2), false);
}
function spawnWave(n, instant) {
  const biome = G.floorData.biome, pool = biome.enemies.slice();
  const caps = { turret: 2, toad: 2, shaman: 1, yeti: 2, golem: 2 };
  const counts = {};
  for (let i = 0; i < n; i++) {
    let type = pick(pool);
    if (caps[type] && (counts[type] || 0) >= caps[type]) type = pool.find(t => !caps[t]) || 'slime';
    counts[type] = (counts[type] || 0) + 1;
    const pos = randomFloorTile(TILE * 4.5, ETYPES[type].fly ? 'fly' : 'ground');
    enemies.push(makeEnemy(type, pos.x, pos.y, { instant }));
  }
}
function summon(type, x, y, n) {
  const live = enemies.filter(e => !e.dead && !e.boss).length;
  for (let i = 0; i < n && live + i < 7; i++) {
    const a = Math.random() * TAU, px = clamp(x + Math.cos(a) * 60, TILE * 1.5, (RW - 1.5) * TILE), py = clamp(y + Math.sin(a) * 60, TILE * 1.5, (RH - 1.5) * TILE);
    const e = makeEnemy(type, px, py, { minion: true }); e.spawnT = 0.5; enemies.push(e);
  }
  burst(x, y, 16, '#c77dff', 160);
}
function makeBoss() {
  const biome = G.floorData.biome, bd = BOSSES[biome.boss], f = G.floor, cyc = cycleOf(f);
  const hp = Math.round(bd.hp * (1 + 0.42 * (f - 1) + 0.8 * cyc) * ((G.oath && G.oath.enemyHp) || 1));
  const name = bd.name + (cyc ? ' ' + ROMAN[Math.min(cyc, 7)] : '');
  G.bossName = name;
  return {
    id: nextId++, type: 'boss', name, shape: bd.shape, boss: true, bossId: biome.boss, world: 'both', veiled: false, veilDone: false, x: RW * TILE / 2, y: RH * TILE / 2 - TILE * 2.5, r: bd.r, hp, maxHp: hp,
    spd: bd.spd + 4 * f, color: bd.color, dark: bd.dark, contact: 2, ai: 'boss', fly: bd.shape === 'eye', attacks: bd.attacks, ak: 0,
    phase: 'idle', phT: 1.6, sub: 0, count: 0, rot: 0, tx: 0, ty: 0, dirx: 0, diry: 0, flash: 0, slowT: 0, ph: 0, alpha: 1, spawnT: 1.4,
    state: 'idle', stT: 0, fireT: 0, cd: 0, poisonT: 0, poisonTick: 0, hitCd: 0, fuse: 0, dead: false, elite: null, minion: false, noCount: false, airT: 0,
  };
}

function enemyShoot(e, ang, spd, o) {
  o = o || {};
  bullets.push({ x: e.x + Math.cos(ang) * e.r * 0.8, y: e.y + Math.sin(ang) * e.r * 0.8, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
    r: o.r || 5, dmg: o.dmg == null ? 1 : o.dmg, life: o.life || 4, friendly: false, color: o.color || e.color, web: !!o.web, slowShot: !!o.slowShot,
    homingE: !!o.homing, pool: o.pool || null, hit: [] });
}

function updateEnemy(e, dt) {
  if (e.spawnT > 0) { e.spawnT -= dt; return; }
  e.flash -= dt; e.slowT -= dt; e.cd -= dt; e.ph += dt; e.hitCd -= dt;
  if (e.poisonT > 0) { e.poisonT -= dt; e.poisonTick -= dt; if (e.poisonTick <= 0) { e.poisonTick = 0.5; damageEnemy(e, 0.5 * P.venom, false, true); } if (e.dead) return; }
  const sm = (e.slowT > 0 ? 0.5 : 1) * (!e.fly && tileAt(e.x, e.y) === T_WATER ? 0.7 : 1);
  const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const f = G.floor;
  switch (e.ai) {
    case 'chase': { const w = Math.sin(e.ph * 3) * 0.4; moveCircle(e, (ux - uy * w) * e.spd * sm * dt, (uy + ux * w) * e.spd * sm * dt); break; }
    case 'zigzag': {
      const s = Math.sin(e.ph * 5) * 1.1;
      moveCircle(e, (ux - uy * s) * e.spd * sm * dt, (uy + ux * s) * e.spd * sm * dt);
      if (e.shooter) { e.fireT -= dt * sm; if (e.fireT <= 0) { e.fireT = e.fireCd; enemyShoot(e, Math.atan2(uy, ux), e.bSpd, { r: 4 }); } }
      break;
    }
    case 'archer': {
      if (d > 250) moveCircle(e, ux * e.spd * sm * dt, uy * e.spd * sm * dt);
      else if (d < 140) moveCircle(e, -ux * e.spd * sm * dt, -uy * e.spd * sm * dt);
      e.fireT -= dt * sm;
      if (e.fireT <= 0 && d < 420) { e.fireT = e.fireCd; enemyShoot(e, Math.atan2(uy, ux), e.bSpd, { r: 4 }); }
      break;
    }
    case 'turret': {
      e.fireT -= dt * sm;
      if (e.fireT <= 0 && d < 460) {
        e.fireT = e.fireCd; const n = f >= 4 ? 3 : 1, base = Math.atan2(uy, ux);
        for (let i = 0; i < n; i++) enemyShoot(e, base + (i - (n - 1) / 2) * 0.28, e.bSpd, { r: 6 });
      }
      break;
    }
    case 'kite': {
      let vx = 0, vy = 0;
      if (d < 150) { vx = -ux; vy = -uy; } else if (d > 260) { vx = ux; vy = uy; } else { const s = Math.sin(e.ph * 1.5); vx = -uy * s; vy = ux * s; }
      moveCircle(e, vx * e.spd * sm * dt, vy * e.spd * sm * dt);
      e.fireT -= dt * sm;
      if (e.fireT <= 0 && d < 460) {
        e.fireT = e.fireCd; const base = Math.atan2(uy, ux);
        for (let i = 0; i < e.spread; i++) enemyShoot(e, base + (i - (e.spread - 1) / 2) * 0.3, e.bSpd, { r: 6, slowShot: e.slowShot, homing: e.homing, color: e.color });
      }
      break;
    }
    case 'spider': {
      const w = Math.sin(e.ph * 7) * 0.5;
      moveCircle(e, (ux - uy * w) * e.spd * sm * dt, (uy + ux * w) * e.spd * sm * dt);
      e.fireT -= dt * sm;
      if (e.fireT <= 0 && d < 300 && d > 60) { e.fireT = e.fireCd; enemyShoot(e, Math.atan2(uy, ux), 170, { r: 7, dmg: 0, web: true, color: '#e9e4d0', life: 2 }); SFX('web'); }
      break;
    }
    case 'hop': {
      if (e.state === 'idle') { e.stT -= dt; if (e.stT <= 0 && d < 380) { e.state = 'wind'; e.stT = 0.45; } }
      else if (e.state === 'wind') {
        e.stT -= dt;
        if (e.stT <= 0) { const jd = Math.min(d, 230); e.tx = e.x + ux * jd; e.ty = e.y + uy * jd; e.state = 'air'; e.stT = 0.5; e.airT = 0.5; e.fly = true; }
      } else {
        e.stT -= dt; const k = clamp(1 - e.stT / 0.5, 0, 1);
        const nx = lerp(e.x, e.tx, Math.min(1, dt / Math.max(e.stT, 0.001))), ny = lerp(e.y, e.ty, Math.min(1, dt / Math.max(e.stT, 0.001)));
        e.x = clamp(nx, TILE * 1.2, (RW - 1.2) * TILE); e.y = clamp(ny, TILE * 1.2, (RH - 1.2) * TILE);
        if (e.stT <= 0) {
          e.state = 'idle'; e.stT = 1.2 + Math.random() * 0.8; e.fly = false;
          if (hitsWall(e.x, e.y, e.r, 'ground')) { const p = randomFloorTile(0, 'ground'); e.x = p.x; e.y = p.y; }
          SFX('hop'); shakeIt(5); burst(e.x, e.y, 10, '#9db97a', 120);
          for (let i = 0; i < 8; i++) enemyShoot(e, i / 8 * TAU, 150 + 6 * f, { r: 5 });
        }
        void k;
      }
      break;
    }
    case 'shaman': {
      let vx = 0, vy = 0;
      if (d < 170) { vx = -ux; vy = -uy; } else if (d > 280) { vx = ux; vy = uy; } else { const s = Math.sin(e.ph * 1.2); vx = -uy * s; vy = ux * s; }
      moveCircle(e, vx * e.spd * sm * dt, vy * e.spd * sm * dt);
      e.fireT -= dt * sm;
      if (e.fireT <= 0) {
        e.fireT = e.fireCd;
        const hurt = enemies.filter(o => !o.dead && o !== e && o.hp < o.maxHp && dist(o.x, o.y, e.x, e.y) < 200);
        if (hurt.length) { for (const o of hurt) { o.hp = Math.min(o.maxHp, o.hp + Math.ceil(o.maxHp * 0.25)); burst(o.x, o.y, 8, '#8fe388', 80, { shape: 'dot', glow: 1 }); } burst(e.x, e.y, 20, '#d1a54a', 140, { shape: 'dot' }); SFX('heart'); }
        else enemyShoot(e, Math.atan2(uy, ux), 200, { r: 5 });
      }
      break;
    }
    case 'ghost': {
      if (!e.hunter) e.alpha = 0.2 + 0.8 * clamp(Math.sin(e.ph * 1.1) * 1.6 + 0.5, 0, 1);
      const w = Math.sin(e.ph * 2) * 0.3;
      const spd = e.spd * (e.alpha < 0.5 ? 1.4 : 1) * sm;
      moveCircle(e, (ux - uy * w) * spd * dt, (uy + ux * w) * spd * dt, 'ghost');
      e.x = clamp(e.x, TILE * 0.6, (RW - 0.6) * TILE); e.y = clamp(e.y, TILE * 0.6, (RH - 0.6) * TILE);
      break;
    }
    case 'bomber': {
      if (e.state === 'idle') {
        const w = Math.sin(e.ph * 6) * 0.3;
        moveCircle(e, (ux - uy * w) * e.spd * sm * dt, (uy + ux * w) * e.spd * sm * dt);
        if (d < 48) { e.state = 'fuse'; e.fuse = 0.55; }
      } else {
        e.fuse -= dt; moveCircle(e, ux * e.spd * 0.3 * dt, uy * e.spd * 0.3 * dt);
        if (e.fuse <= 0) { e.dead = true; e.noDrop = true; explodeAt(e.x, e.y, 72, 2, '#ff3b6b', { player: true, enemies: true, edmg: 3 }); }
      }
      break;
    }
    case 'charge': {
      if (e.state === 'idle') {
        moveCircle(e, ux * e.spd * sm * dt, uy * e.spd * sm * dt);
        if (d < 250 && e.cd <= 0) { e.state = 'wind'; e.stT = e.windT; }
      } else if (e.state === 'wind') {
        e.stT -= dt; e.dirx = ux; e.diry = uy;
        if (e.stT <= 0) { e.state = 'dash'; e.stT = 0.45; }
      } else {
        e.stT -= dt;
        const h = moveCircle(e, e.dirx * e.dashSpd * sm * dt, e.diry * e.dashSpd * sm * dt);
        if (h.hx || h.hy || e.stT <= 0) {
          e.state = 'idle'; e.cd = 2 + Math.random();
          if (h.hx || h.hy) { shakeIt(4); SFX('thud'); if (e.ringOnWall) for (let i = 0; i < 6; i++) enemyShoot(e, i / 6 * TAU, 170, { r: 5, color: '#bfe9ff', slowShot: true }); }
        }
      }
      break;
    }
    case 'boss': updateBoss(e, dt, ux, uy, d); break;
  }
}

/* ---------- boss ---------- */
function updateBoss(e, dt, ux, uy, d) {
  const f = G.floor, enraged = e.hp < e.maxHp * 0.45, sm = e.slowT > 0 ? 0.7 : 1;
  e.phT -= dt;
  const idle = t => { e.phase = 'idle'; e.phT = t * (enraged ? 0.7 : 1); };
  switch (e.phase) {
    case 'idle': {
      if (!e.veilDone && G.floor >= 2 && e.hp < e.maxHp * 0.5) {
        e.veilDone = true; e.veiled = true; burst(e.x, e.y, 40, '#c77dff', 260, { glow: 1, life: 0.8 }); SFX('cross');
        banner = { t: 'Le boss se voile', s: 'Frappe son reflet dans l\'Envers (V, Ctrl ou ◐)', color: '#c77dff', life: 3.5, max: 3.5 };
        hint = { t: STORY.envers.veiled, life: 6 };
        if (G.voile < 34) G.voile = 34;
      }
      if (e.spd > 0) moveCircle(e, ux * e.spd * (enraged ? 1.3 : 1) * sm * dt, uy * e.spd * (enraged ? 1.3 : 1) * sm * dt);
      if (e.phT <= 0) {
        const atk = e.attacks[e.ak % e.attacks.length]; e.ak++;
        e.count = 0; e.sub = 0;
        if (atk.startsWith('summon:')) {
          summon(atk.split(':')[1], e.x, e.y, enraged ? 3 : 2); SFX('blink'); idle(1.6);
        } else if (atk === 'ring') { e.phase = 'ring'; e.phT = 0.45; e.count = enraged ? 4 : 3; }
        else if (atk === 'dash') { e.phase = 'wind'; e.phT = 0.65; }
        else if (atk === 'hop') { e.phase = 'hopwind'; e.phT = 0.55; const jd = Math.min(d, 300); e.tx = e.x + ux * jd; e.ty = e.y + uy * jd; addZone({ kind: 'circle', x: e.tx, y: e.ty, r: e.r + 24, dur: 1.05, color: e.color }); }
        else if (atk === 'spit') { e.phase = 'spit'; e.phT = 0.1; e.count = 3; }
        else if (atk === 'erupt') {
          e.phase = 'erupt'; e.phT = 1.3;
          const spots = [[P.x, P.y]]; for (let i = 0; i < (enraged ? 6 : 4); i++) { const a = Math.random() * TAU, rr = 50 + Math.random() * 130; spots.push([clamp(P.x + Math.cos(a) * rr, TILE * 1.5, (RW - 1.5) * TILE), clamp(P.y + Math.sin(a) * rr, TILE * 1.5, (RH - 1.5) * TILE)]); }
          for (const [x, y] of spots) addZone({ kind: 'circle', x, y, r: 46, dur: 1.0, color: '#ff7b3a', dmg: 2, onEnd: z => { burst(z.x, z.y, 22, '#ff9f43', 220, { glow: 1, life: 0.7 }); SFX('boom'); shakeIt(6); } });
        }
        else if (atk === 'wall') { e.phase = 'wall'; e.phT = 0.2; e.count = 2; }
        else if (atk === 'spikes') {
          e.phase = 'spikes'; e.phT = 1.2; const base = Math.atan2(uy, ux);
          for (const off of (enraged ? [-0.8, -0.4, 0, 0.4, 0.8] : [-0.5, 0, 0.5])) {
            const a = base + off; addZone({ kind: 'line', x1: e.x, y1: e.y, x2: e.x + Math.cos(a) * 520, y2: e.y + Math.sin(a) * 520, w: 24, dur: 0.95, color: '#bfe9ff', dmg: 1, onEnd: z => { for (let i = 0; i < 12; i++) { const t = i / 12; burst(lerp(z.x1, z.x2, t), lerp(z.y1, z.y2, t), 3, '#dff4ff', 120, { shape: 'dot', glow: 1 }); } SFX('iceCrack'); shakeIt(4); } });
          }
        }
        else if (atk === 'blink') {
          burst(e.x, e.y, 30, e.color, 200, { shape: 'dot', glow: 1 }); const p = randomFloorTile(180, 'fly'); e.x = p.x; e.y = p.y; burst(e.x, e.y, 30, e.color, 200, { shape: 'dot', glow: 1 }); SFX('blink'); idle(0.9);
        }
        else if (atk === 'laser') {
          const ang = Math.atan2(uy, ux); const dir = Math.random() < 0.5 ? 1 : -1;
          beams.push({ x: e.x, y: e.y, ang: ang - dir * 0.6, angVel: dir * (enraged ? 1.5 : 1.1), t: 0, warm: 0.9, dur: 1.5, len: 760, w: 20, color: e.color, owner: e });
          e.phase = 'laser'; e.phT = 2.5; SFX('laser');
        }
        else if (atk === 'spiral') { e.phase = 'spiral'; e.phT = enraged ? 2.6 : 2.0; e.sub = 0; }
      }
      break;
    }
    case 'ring': {
      if (e.phT <= 0) {
        const n = 10 + f + (enraged ? 4 : 0);
        for (let i = 0; i < n; i++) enemyShoot(e, e.rot + i / n * TAU, 140 + 10 * f, { r: 6 });
        e.rot += 0.37; e.count--; e.phT = 0.55; SFX('shoot_orb');
        if (e.count <= 0) idle(1.8);
      }
      break;
    }
    case 'wind': { e.dirx = ux; e.diry = uy; if (e.phT <= 0) { e.phase = 'dash'; e.phT = 0.7; SFX('dash'); } break; }
    case 'dash': {
      const h = moveCircle(e, e.dirx * (420 + 12 * f) * sm * dt, e.diry * (420 + 12 * f) * sm * dt);
      if (h.hx || h.hy || e.phT <= 0) {
        if (h.hx || h.hy) { shakeIt(10); burst(e.x, e.y, 18, e.color, 200); SFX('thud'); }
        if (enraged) { const base = Math.atan2(uy, ux); for (let i = -2; i <= 2; i++) enemyShoot(e, base + i * 0.22, 190 + 10 * f, { r: 6 }); }
        idle(1.7);
      }
      break;
    }
    case 'hopwind': { if (e.phT <= 0) { e.phase = 'hop'; e.phT = 0.5; e.fly = true; e.airT = 0.5; } break; }
    case 'hop': {
      const k = Math.min(1, dt / Math.max(e.phT, 0.001));
      e.x = lerp(e.x, e.tx, k); e.y = lerp(e.y, e.ty, k);
      if (e.phT <= 0) {
        e.fly = false; if (hitsWall(e.x, e.y, e.r, 'ground')) { const p = randomFloorTile(0, 'ground'); e.x = p.x; e.y = p.y; }
        SFX('hop'); shakeIt(12); burst(e.x, e.y, 30, '#9db97a', 220);
        const n = 12 + f; for (let i = 0; i < n; i++) enemyShoot(e, i / n * TAU, 160 + 8 * f, { r: 6 });
        if (dist(e.x, e.y, P.x, P.y) < e.r + P.r + 10) hurtPlayer(2, e);
        idle(1.5);
      }
      break;
    }
    case 'spit': {
      if (e.phT <= 0) {
        const a = Math.atan2(uy, ux) + (Math.random() - 0.5) * 0.5;
        enemyShoot(e, a, 230, { r: 8, color: '#a3ff5e', pool: 'poison', life: Math.min(2.2, d / 230 + 0.1) }); SFX('shoot_orb');
        e.count--; e.phT = 0.35; if (e.count <= 0) idle(1.7);
      }
      break;
    }
    case 'wall': {
      if (e.phT <= 0) {
        const base = Math.atan2(uy, ux), px = -Math.sin(base), py = Math.cos(base), gap = RI(-3, 3);
        for (let i = -4; i <= 4; i++) { if (i === gap || i === gap + 1) continue; bullets.push({ x: e.x + px * i * 40, y: e.y + py * i * 40, vx: Math.cos(base) * 175, vy: Math.sin(base) * 175, r: 7, dmg: 1, life: 4, friendly: false, color: '#ff7b3a', hit: [] }); }
        SFX('boom'); e.count--; e.phT = 0.85; if (e.count <= 0) idle(1.6);
      }
      break;
    }
    case 'spikes': { if (e.phT <= 0) idle(1.4); break; }
    case 'erupt': { if (e.phT <= 0) idle(1.5); break; }
    case 'laser': { if (e.phT <= 0) idle(1.4); break; }
    case 'spiral': {
      e.sub -= dt;
      if (e.sub <= 0) { e.sub = 0.09; for (const off of [0, Math.PI]) enemyShoot(e, e.rot + off, 165, { r: 5 }); e.rot += 0.33; }
      if (e.phT <= 0) idle(1.5);
      break;
    }
  }
}

/* ---------- tirs du joueur ---------- */
function fire(a) {
  Tutorial.event('shoot');
  const w = curWeapon(), dmg = playerDamage();
  if (w.melee) {
    slashes.push({ x: P.x, y: P.y, a, t: 0, dur: 0.16, range: w.range + P.bSize * 2, arc: w.arc, dmg, hit: [], crit: Math.random() < P.crit });
    SFX(w.sfx); return;
  }
  const n = P.multi, spread = w.spread || 0.16, spd = w.bSpd * P.bSpdMul;
  for (let i = 0; i < n; i++) {
    const ang = a + (i - (n - 1) / 2) * spread, crit = Math.random() < P.crit;
    bullets.push({ x: P.x + Math.cos(a) * P.r, y: P.y + Math.sin(a) * P.r, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      r: (w.r || 4) + P.bSize, dmg: dmg * (crit ? 2 : 1), crit, life: P.bLife * (w.lifeMul || 1) * P.bSpdMul, friendly: true,
      pierce: P.pierce + (w.pierce || 0), bounce: P.bounce, hit: [], aoe: w.aoe || 0, chain: (w.chain || 0) + P.ricochet, homing: P.homing, venom: P.venom, kind: P.weapon, ph: Math.random() * TAU });
  }
  SFX(w.sfx);
}
function explodeAt(x, y, r, dmg, color, o) {
  o = o || {};
  burst(x, y, 26, color, 240, { glow: 1, life: 0.6, size: 4 });
  burst(x, y, 10, '#fff4d6', 120, { shape: 'dot', life: 0.3 });
  parts.push({ x, y, vx: 0, vy: 0, life: 0.28, max: 0.28, color, size: r, ring: true });
  SFX('explode'); shakeIt(6);
  if (o.enemies) for (const e of enemies.slice()) if (!e.dead && e.spawnT <= 0 && inWorld(e) && dist(e.x, e.y, x, y) < r + e.r) damageEnemy(e, o.edmg || dmg, false);
  if (o.player && dist(P.x, P.y, x, y) < r + P.r) hurtPlayer(dmg, { x, y });
}
function damageEnemy(e, d, crit, silent) {
  if (e.dead || (e.alpha < 0.5 && !e.boss)) return;
  if (e.boss && e.veiled && G.world === 'normal') { if (!silent) { burst(e.x, e.y, 4, '#c77dff', 90, { shape: 'dot' }); if (Math.random() < 0.12) ft(e.x, e.y - e.r - 12, 'Voilé', '#c77dff', 12); } return; }
  if (e.boss) G.voile = Math.min(100, G.voile + 1.2);
  d *= bestiaryMul(e.type);
  e.hp -= d; e.flash = 0.12;
  if (P.slow) e.slowT = 1.2;
  if (!silent) {
    ft(e.x + (Math.random() - 0.5) * 10, e.y - e.r, fmtNum(d), crit ? '#ffd97a' : '#fff', crit ? 15 : 11, 0.6);
    burst(e.x, e.y, 4, e.color, 90);
    SFX(crit ? 'crit' : 'hit');
  }
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  if (!e.noCount || e.hunter) { G.kills++; save.bestiary[e.type] = (save.bestiary[e.type] || 0) + 1; }
  burst(e.x, e.y, e.boss ? 70 : 14, e.color, e.boss ? 280 : 150, { size: e.boss ? 5 : 3 });
  burst(e.x, e.y, e.boss ? 24 : 4, e.dark, 90, { size: 4, life: 0.9, grav: 200 });
  SFX(e.boss ? 'killBoss' : 'kill');
  shakeIt(e.boss ? 20 : 3);
  // combo & surcharge
  G.combo = G.comboT > 0 ? G.combo + 1 : 1; G.comboT = 3 + P.comboWindow; G.maxCombo = Math.max(G.maxCombo, G.combo);
  // Voile
  const vg = (e.boss ? 100 : e.elite ? 16 : e.reflet ? (P.refletBonus ? 24 : 12) : 6) * (1 + Math.min(G.combo, 20) * 0.02) * (G.floor === 1 ? 1.6 : 1);
  G.voile = Math.min(100, G.voile + vg);
  if (!G.voileHinted && G.voile >= 34 && G.world === 'normal') { G.voileHinted = true; hint = { t: 'Le Voile est assez plein : trouve une fissure (point violet sur la carte) et appuie sur V, Ctrl ou ◐.', life: 7 }; }
  if (e.reflet && P.refletBonus) for (let i = 0; i < 2; i++) dropPickup(e.x, e.y, 'coin');
  if (G.combo >= 3) { ft(P.x, P.y - 28, G.combo + '× combo', '#ffd97a', 11 + Math.min(8, G.combo * 0.5), 0.7); SFX('combo', G.combo); }
  const wasReady = G.surge >= 100;
  G.surge = Math.min(100, G.surge + (e.boss ? 40 : e.elite ? 16 : 8) * P.surgeGain);
  if (!wasReady && G.surge >= 100) { hint = { t: 'Surcharge prête ! (E, clic droit ou ⚡)', life: 3 }; SFX('surge'); }
  if (P.lifesteal && Math.random() < P.lifesteal && P.hp < P.maxHp) { P.hp = Math.min(P.maxHp, P.hp + 1); ft(P.x, P.y - 20, '+½ ❤', '#ff7a9a', 12); }
  // butin
  const noHearts = G.oath && G.oath.noHearts, coinMul = (G.oath && G.oath.coinMul) || 1;
  const coin = n => { for (let i = 0; i < n * coinMul; i++) dropPickup(e.x, e.y, 'coin'); };
  const heart = () => { if (noHearts) coin(1); else dropPickup(e.x, e.y, 'heart'); };
  if (!e.noDrop) {
    if (e.boss) { coin(6); dropPickup(e.x, e.y, 'gem'); heart(); }
    else if (e.hunter) { coin(5); dropPickup(e.x, e.y, 'gem'); }
    else {
      if (e.elite) { coin(3); if (Math.random() < 0.4) heart(); }
      if (Math.random() < 0.42 + P.luck * 0.3) coin(1);
      if (Math.random() < (P.hp < P.maxHp ? 0.07 : 0.015) * (1 + P.luck)) heart();
    }
  }
  if (e.explodeOnDeath) explodeAt(e.x, e.y, 70, 1, '#ff7b3a', { player: true, enemies: true, edmg: 3 });
  else if (P.explode && !e.boss) { explodeAt(e.x, e.y, 75, 3, '#ffb347', { enemies: true, edmg: 3 }); }
  if (e.summonOnDeath) summon('bat', e.x, e.y, 2);
  if (e.hunter) { G.hunterAlive = false; G.menaceT = G.menaceMax * 0.45; ft(e.x, e.y - 30, 'Le Traqueur est repoussé', '#ff2244', 14, 1.5); }
}
function hurtPlayer(d, src, force) {
  if (state !== 'play' || P.god) return false;
  if (!force && (P.inv > 0 || P.dashT > 0)) return false;
  if (P.dodge && Math.random() < P.dodge) { ft(P.x, P.y - 22, 'Esquive', '#8fe388', 13); SFX('dodge'); P.inv = 0.35; return false; }
  if (P.shield && P.shieldT <= 0) {
    P.shieldT = 15; P.inv = 0.5; SFX('shield');
    ft(P.x, P.y - 22, 'Bloqué !', '#7fd7ff', 13); burst(P.x, P.y, 14, '#7fd7ff', 170, { shape: 'dot', glow: 1 });
    return false;
  }
  if (src && src.x != null) {
    const kx = P.x - src.x, ky = P.y - src.y, kl = Math.hypot(kx, ky) || 1;
    moveCircle(P, kx / kl * 30, ky / kl * 30, 'player');
    if (src.r && !src.boss && src.ai) moveCircle(src, -kx / kl * 22, -ky / kl * 22);
    if (src.vampire) { src.hp = Math.min(src.maxHp, src.hp + 2); burst(src.x, src.y, 8, '#ff3b6b', 80, { shape: 'dot' }); }
  }
  P.hp -= d; P.inv = force ? 0.6 : 1.0; shakeIt(9); flash = 0.3; flashColor = '255,40,70'; SFX('hurt');
  burst(P.x, P.y, 10, '#ff5e7a', 150);
  G.combo = 0; G.comboT = 0;
  if (P.hp <= 0) {
    if (P.revive > 0) { P.revive--; P.hp = 4; P.inv = 2.5; SFX('revive'); burst(P.x, P.y, 60, '#ffd97a', 260, { glow: 1, life: 1 }); ft(P.x, P.y - 30, 'Le phénix renaît', '#ffd97a', 16, 1.6); flashColor = '255,217,122'; flash = 0.6; return true; }
    P.hp = 0; die();
  }
  return true;
}
function dropPickup(x, y, type) {
  const a = Math.random() * TAU, s = 60 + Math.random() * 130;
  pickups.push({ x, y, type, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: type === 'heart' ? 8 : type === 'gem' ? 8 : 6, t: Math.random() * 6, life: 0 });
}
function addEssence(n) {
  const mul = (1 + 0.25 * metaLv('or')) * (1 + P.greed) * ((G.oath && G.oath.essMul) || 1) * (1 + Math.min(G.combo, 20) * 0.04) * (G.world === 'envers' ? 2 : 1);
  G.essence += n * mul;
}

/* ---------- mises à jour des sous-systèmes ---------- */
function updateBullets(dt) {
  const act = activeEnemies();
  for (const b of bullets) {
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; if (b.pool) addPool(b.x, b.y, b.pool, 34, 6); if (b.aoe) explodeAt(b.x, b.y, b.aoe, b.dmg, '#ff9f43', { enemies: true, edmg: b.dmg }); continue; }
    if (b.friendly && b.homing > 0 && act.length) {
      let best = null, bd = 220; for (const e of act) { if (e.alpha < 0.5 || b.hit.includes(e.id)) continue; const d = dist(e.x, e.y, b.x, b.y); if (d < bd) { bd = d; best = e; } }
      if (best) { const cur = Math.atan2(b.vy, b.vx), want = Math.atan2(best.y - b.y, best.x - b.x); let da = want - cur; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; const na = cur + clamp(da, -1, 1) * b.homing * 3.2 * dt; const sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; }
    }
    if (!b.friendly && b.homingE && b.life > 2.2) {
      const cur = Math.atan2(b.vy, b.vx), want = Math.atan2(P.y - b.y, P.x - b.x); let da = want - cur; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; const na = cur + clamp(da, -1, 1) * 2.4 * dt; const sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
    }
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt / (TILE * 0.5)));
    for (let s = 0; s < steps && !b.dead; s++) {
      const sdt = dt / steps, nx = b.x + b.vx * sdt, ny = b.y + b.vy * sdt;
      const wallHit = axis => {
        if (b.friendly && b.bounce > 0) { b.bounce--; if (axis === 'x') b.vx = -b.vx; else b.vy = -b.vy; return false; }
        b.dead = true;
        if (b.aoe) explodeAt(b.x, b.y, b.aoe, b.dmg, '#ff9f43', { enemies: true, edmg: b.dmg });
        else burst(b.x, b.y, 3, b.friendly ? '#ffd97a' : b.color, 60);
        if (b.pool) addPool(b.x, b.y, b.pool, 34, 6);
        return true;
      };
      if (hitsWall(nx, b.y, b.r, 'bullet') && wallHit('x')) break;
      if (hitsWall(b.x, ny, b.r, 'bullet') && wallHit('y')) break;
      b.x += b.vx * sdt; b.y += b.vy * sdt;
      if (b.friendly) {
        for (const e of enemies) {
          if (e.dead || e.spawnT > 0 || b.hit.includes(e.id) || (e.alpha < 0.5 && !e.boss) || !inWorld(e)) continue;
          if (dist(e.x, e.y, b.x, b.y) < e.r + b.r) {
            b.hit.push(e.id);
            if (b.aoe) { b.dead = true; explodeAt(b.x, b.y, b.aoe, b.dmg, '#ff9f43', { enemies: true, edmg: b.dmg }); break; }
            damageEnemy(e, b.dmg, b.crit);
            if (b.venom) { e.poisonT = 3; }
            if (b.chain > 0) {
              let best = null, bd = 260;
              for (const o of act) { if (o.dead || b.hit.includes(o.id) || o.alpha < 0.5) continue; const d = dist(o.x, o.y, b.x, b.y); if (d < bd) { bd = d; best = o; } }
              if (best) { b.chain--; const a = Math.atan2(best.y - b.y, best.x - b.x), sp = Math.hypot(b.vx, b.vy); b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.life = Math.max(b.life, 0.6); burst(b.x, b.y, 6, '#bfe9ff', 120, { shape: 'dot', glow: 1 }); if (b.kind === 'storm') SFX('zap'); continue; }
            }
            if (b.pierce > 0) b.pierce--; else { b.dead = true; break; }
          }
        }
      } else if (dist(b.x, b.y, P.x, P.y) < P.r + b.r - 2) {
        if (P.dashT <= 0) {
          b.dead = true;
          if (b.web) { P.webT = 1.6; ft(P.x, P.y - 20, 'Englué', '#e9e4d0', 11); SFX('web'); }
          else { if (b.slowShot) P.slowT = 1.3; hurtPlayer(b.dmg, b); }
          if (b.pool) addPool(b.x, b.y, b.pool, 34, 6);
        }
      }
    }
  }
  bullets = bullets.filter(b => !b.dead);
}
function updateSlashes(dt) {
  for (const s of slashes) {
    s.t += dt;
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0 || s.hit.includes(e.id) || (e.alpha < 0.5 && !e.boss) || !inWorld(e)) continue;
      const d = dist(e.x, e.y, s.x, s.y); if (d > s.range + e.r) continue;
      let da = Math.atan2(e.y - s.y, e.x - s.x) - s.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      if (Math.abs(da) < s.arc / 2 + 0.2) {
        s.hit.push(e.id); damageEnemy(e, s.dmg * (s.crit ? 2 : 1), s.crit);
        if (!e.boss) moveCircle(e, Math.cos(s.a) * 14, Math.sin(s.a) * 14);
      }
    }
    for (const b of bullets) {
      if (b.friendly || b.dead) continue;
      const d = dist(b.x, b.y, s.x, s.y); if (d > s.range + 6) continue;
      let da = Math.atan2(b.y - s.y, b.x - s.x) - s.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      if (Math.abs(da) < s.arc / 2 + 0.2) { b.dead = true; burst(b.x, b.y, 5, '#fff', 120, { shape: 'dot', glow: 1 }); }
    }
  }
  slashes = slashes.filter(s => s.t < s.dur);
}
function updateZones(dt) {
  for (const z of zones) {
    z.t += dt;
    if (z.t >= z.dur) {
      z.done = true;
      if (z.dmg) {
        const inside = z.kind === 'circle' ? dist(P.x, P.y, z.x, z.y) < z.r + P.r * 0.5 : segCircle(z.x1, z.y1, z.x2, z.y2, P.x, P.y, z.w / 2 + P.r * 0.6);
        if (inside) hurtPlayer(z.dmg, z.kind === 'circle' ? { x: z.x, y: z.y } : null);
      }
      if (z.onEnd) z.onEnd(z);
    }
  }
  zones = zones.filter(z => !z.done);
  for (const b of beams) {
    b.t += dt;
    if (b.t > b.warm) {
      b.ang += b.angVel * dt;
      const x2 = b.x + Math.cos(b.ang) * b.len, y2 = b.y + Math.sin(b.ang) * b.len;
      if (segCircle(b.x, b.y, x2, y2, P.x, P.y, b.w / 2 + P.r * 0.6)) hurtPlayer(1, null);
      if (Math.random() < 0.5) { const t = Math.random(); burst(lerp(b.x, x2, t), lerp(b.y, y2, t), 1, b.color, 60, { shape: 'dot', glow: 1, life: 0.3 }); }
    }
    if (b.owner && b.owner.dead) b.t = 99;
  }
  beams = beams.filter(b => b.t < b.warm + b.dur);
  for (const p of pools) {
    p.life -= dt;
    if (p.type === 'fire') {
      p.tick = (p.tick || 0) - dt;
      if (p.tick <= 0) { p.tick = 0.4; for (const e of enemies) if (!e.dead && e.spawnT <= 0 && !e.fly && dist(e.x, e.y, p.x, p.y) < p.r + e.r * 0.5) damageEnemy(e, 1.2 * P.dmgMul, false, true); }
      if (Math.random() < 0.3) burst(p.x + (Math.random() - 0.5) * p.r * 1.4, p.y + (Math.random() - 0.5) * p.r * 1.4, 1, '#ff9f43', 30, { shape: 'dot', glow: 1, life: 0.5, grav: -80 });
    }
  }
  pools = pools.filter(p => p.life > 0);
}
function updatePickups(dt) {
  for (const p of pickups) {
    p.t += dt; p.life += dt;
    const d = dist(p.x, p.y, P.x, P.y);
    if (d < P.magnet && p.life > 0.25) { const s = 260 + (P.magnet - d) * 3; p.vx = (P.x - p.x) / d * s; p.vy = (P.y - p.y) / d * s; }
    else { p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt); }
    moveCircle(p, p.vx * dt, p.vy * dt, 'ground');
    if (d < P.r + p.r + 2) {
      p.dead = true;
      if (p.type === 'coin') { addEssence(1); SFX('coin'); ft(P.x, P.y - 18, '+1 ◆', '#ffd97a', 11, 0.6); }
      else if (p.type === 'gem') { addEssence(5); SFX('relic'); ft(P.x, P.y - 22, '+5 ◆', '#ffd97a', 14); }
      else { P.hp = Math.min(P.maxHp, P.hp + 2); SFX('heart'); ft(P.x, P.y - 18, '+1 ❤', '#ff7a9a', 12); }
    }
  }
  pickups = pickups.filter(p => !p.dead);
}
function updateCompanions(dt) {
  // orbes satellites
  if (P.orbit) {
    for (let i = 0; i < P.orbit; i++) {
      const a = P.tick * 2.6 + i * TAU / P.orbit, ox = P.x + Math.cos(a) * 44, oy = P.y + Math.sin(a) * 44;
      for (const e of enemies) if (!e.dead && e.spawnT <= 0 && inWorld(e) && e.hitCd <= 0 && (e.alpha >= 0.5 || e.boss) && dist(e.x, e.y, ox, oy) < e.r + 8) { e.hitCd = 0.5; damageEnemy(e, 1.2 * P.dmgMul, false); }
      for (const b of bullets) if (!b.friendly && !b.dead && dist(b.x, b.y, ox, oy) < b.r + 9) { b.dead = true; burst(b.x, b.y, 4, '#fff', 100, { shape: 'dot' }); }
    }
    bullets = bullets.filter(b => !b.dead);
  }
  // esprits familiers
  while (G.pets.length < P.pet) G.pets.push({ x: P.x, y: P.y, fireT: 0.5, ph: Math.random() * TAU });
  const act = activeEnemies();
  G.pets.forEach((pet, i) => {
    pet.ph += dt;
    const tx = P.x - P.fx * 34 + Math.cos(pet.ph + i * 2) * 12, ty = P.y - P.fy * 34 - 14 + Math.sin(pet.ph * 1.3) * 6;
    pet.x = lerp(pet.x, tx, 1 - Math.pow(0.02, dt)); pet.y = lerp(pet.y, ty, 1 - Math.pow(0.02, dt));
    pet.fireT -= dt;
    if (pet.fireT <= 0 && act.length) {
      let best = null, bd = 320; for (const e of act) { if (e.alpha < 0.5) continue; const d = dist(e.x, e.y, pet.x, pet.y); if (d < bd) { bd = d; best = e; } }
      if (best) { pet.fireT = 0.85; const a = Math.atan2(best.y - pet.y, best.x - pet.x); bullets.push({ x: pet.x, y: pet.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, r: 3.5, dmg: 0.8 * P.dmgMul, crit: false, life: 1, friendly: true, pierce: 0, bounce: 0, hit: [], aoe: 0, chain: 0, homing: 0.6, venom: 0, kind: 'pet', ph: 0 }); }
    }
  });
}
function spawnHunter() {
  const p = randomFloorTile(220, 'fly');
  const h = makeEnemy('hunter', p.x, p.y, { instant: false });
  h.hp = h.maxHp = Math.round(28 * (1 + 0.3 * (G.floor - 1))); h.spawnT = 1.2;
  enemies.push(h); G.hunterAlive = true;
  SFX('hunter'); shakeIt(6);
  banner = { t: 'Le Traqueur', s: 'Tu as trop traîné. Fuis ou affronte-le.', color: '#ff2244', life: 3, max: 3 };
  hint = { t: STORY.envers.hunter, life: 6 };
}
function activateSurge() {
  Tutorial.event('surge');
  G.surge = 0; P.surgeT = 4; P.inv = Math.max(P.inv, 0.8);
  SFX('surge'); shakeIt(10); flash = 0.35; flashColor = '255,217,122';
  const dmg = playerDamage() * 1.5, n = 22;
  for (let i = 0; i < n; i++) { const a = i / n * TAU; bullets.push({ x: P.x, y: P.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: 5 + P.bSize, dmg, crit: false, life: 1.1, friendly: true, pierce: 1, bounce: 1, hit: [], aoe: 0, chain: 0, homing: 0, venom: P.venom, kind: 'surge', ph: 0 }); }
  for (const b of bullets) if (!b.friendly) { b.dead = true; burst(b.x, b.y, 3, '#fff', 60, { shape: 'dot' }); }
  bullets = bullets.filter(b => !b.dead);
  burst(P.x, P.y, 40, '#ffd97a', 300, { glow: 1, life: 0.8 });
  parts.push({ x: P.x, y: P.y, vx: 0, vy: 0, life: 0.5, max: 0.5, color: '#ffd97a', size: 120, ring: true });
  ft(P.x, P.y - 34, 'SURCHARGE', '#ffd97a', 20, 1.2);
}
