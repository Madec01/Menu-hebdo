/* =========================================================================
   SALLE ZÉRO — 40_room.js
   État global G, Room (chargement, vagues, portes, transitions), Run (déroulé d'un niveau).
   ========================================================================= */

const G = {
  state: 'boot',           // boot | menu | hub | run
  mode: 'normal',          // normal | test
  player: null, enemies: [], room: null, run: null,
  paused: false, overlay: null, shake: 0,
  difficulty: { hpMul: 1, damageMul: 1, speedMul: 1, fireRateMul: 1 },
  debug: { difficulty: 1, xpMul: 1, coinMul: 1, forceRarity: null, invuln: false, hitboxes: false, showScores: false, open: false },
  autoplay: null,
};
function applyDifficulty() {
  const d = G.debug.difficulty; const b = (G.run && G.run.biome && G.run.biome.difficulty) || {};
  G.difficulty = { hpMul: d * (b.hpMul || 1), damageMul: d * (b.damageMul || 1), speedMul: (0.7 + 0.3 * d) * (b.speedMul || 1), fireRateMul: 0.75 + 0.25 * d };
}

/* ---------- Room ---------- */
const Room = {
  create(def) {
    const r = {
      def, index: def.index, type: def.type, state: 'intro', time: 0, stateT: 0, refTime: def.refTime || 45,
      obstacles: (def.obstacles || []).map(o => ({ x: o.x, y: o.y, w: o.w, h: o.h, px: ROOM_X + o.x * TILE, py: ROOM_Y + o.y * TILE, pw: o.w * TILE, ph: o.h * TILE })),
      traps: [], waves: (def.waves || []).map(w => Object.assign({ done: false }, w)), waveIdx: 0,
      fragmentsDef: (def.fragments || []).slice(), fragmentsSpawned: 0, fragments: 0,
      hits: 0, kills: 0, combo: 0, comboUntil: 0, bestCombo: 0, comboTarget: 8, died: false,
      doorOpen: false, chest: null, boss: null,
      beams: [], blasts: [], slashes: [], hazards: [], turrets: [], decoys: [],
      modular: (def.modular || []).map(m => Object.assign({ t: 0 }, m)),   // phase 2 : éléments de décor animés avec collision (murs coulissants, plateformes, zone sûre mobile)
      floorSeed: (def.index * 7919) ^ 0x5bd1, label: `${STR.room} ${def.index}/9 — ${ROOM_TYPES[def.type] ? ROOM_TYPES[def.type].label : def.type}`,
    };
    for (const t of (def.traps || [])) { const td = Content.trap(t.trap); if (!td) { console.warn('piège inconnu', t.trap); continue; } r.traps.push(new Trap(td, t)); }
    return r;
  },
  load(index) {
    const def = G.run.rooms.find(r => r.index === index);
    if (!def) { console.error('Salle absente', index); return false; }
    if (ROOM_TYPES[def.type] && ROOM_TYPES[def.type].phase > 1) { UI.toast(`Salle ${index} (${ROOM_TYPES[def.type].label}) : prévue en phase 2.`); return false; }
    applyDifficulty();
    G.enemies = []; Projectiles.list = []; Pickups.list = []; Particles.list = []; Floaters.list = [];
    G.room = Room.create(def);
    const pl = G.player; pl.x = ROOM_X + TILE * 1.5; pl.y = ROOM_Y + ROOM_H / 2; pl.dashing = false; pl.orbs = null; pl.charge = 0;
    for (const h of pl.hooks.onRoomStart) { if (h.effect === 'shield_on_room') { pl.shield = Math.max(pl.shield, h.amount * (h.stacks || 1)); pl.shieldUntil = Time.now + 999; } else if (h.effect === 'heal_on_room') pl.heal(pl.stats.maxHp * h.fraction * (h.stacks || 1)); }
    G.run.roomIndex = index; G.run.stats.roomsEntered++;
    if (def.type === 'CHEST') { G.room.chest = { x: W / 2, y: H / 2, r: 22, opened: false }; G.room.doorOpen = false; }
    if (def.type === 'TRAP') { G.room.doorOpen = true; }
    UI.banner(G.room.label, '#6ee7ff'); AudioEngine.uiConfirm({});
    if (def.type === 'MINIBOSS') Music.play('boss'); else Music.play('biome');
    return true;
  },
  begin() { G.room.state = 'fight'; G.room.stateT = 0; },
  spawnEnemy(def, x, y, opts = {}) {
    if (!def) return null;
    if (G.enemies.filter(e => !e.dead).length > 60) return null;
    const e = new Enemy(def, x, y, opts); resolveRoomCollision(e); G.enemies.push(e); return e;
  },
  spawnAt(spawn) {
    const bdef = Content.boss(spawn.enemy); if (bdef) { Room.spawnBoss(bdef, spawn.x >= 0 ? tileX(spawn.x) : null, spawn.y >= 0 ? tileY(spawn.y) : null); return; }
    const def = Content.enemy(spawn.enemy); if (!def) { console.warn('ennemi inconnu', spawn.enemy); return; }
    const n = spawn.count || 1; const pl = G.player; let x = W / 2, y = H / 2;
    for (let i = 0; i < n; i++) {
      if (spawn.x == null || spawn.x < 0) { /* bord aléatoire loin du joueur */
        for (let k = 0; k < 12; k++) { const side = RNG.int(0, 3); x = side === 0 ? ROOM_X + 30 : side === 1 ? ROOM_X + ROOM_W - 30 : RNG.range(ROOM_X + 40, ROOM_X + ROOM_W - 40); y = side === 2 ? ROOM_Y + 30 : side === 3 ? ROOM_Y + ROOM_H - 30 : RNG.range(ROOM_Y + 40, ROOM_Y + ROOM_H - 40); if (dist(x, y, pl.x, pl.y) > 220 && !pointBlocked(x, y, 16)) break; }
      } else { x = tileX(spawn.x) + RNG.range(-20, 20) * (n > 1 ? 1 : 0); y = tileY(spawn.y) + RNG.range(-20, 20) * (n > 1 ? 1 : 0); }
      if (def.archetype === 'swarm') { const g = (def.behavior && def.behavior.groupSize) || 1; for (let j = 0; j < g; j++) { const a = j * TAU / g; Room.spawnEnemy(def, x + Math.cos(a) * 24, y + Math.sin(a) * 24, { elite: spawn.elite }); } }
      else Room.spawnEnemy(def, x, y, { elite: spawn.elite });
    }
    Particles.spawn(x, y, { count: 10, color: '#ff6b6b', glow: true });
  },
  spawnBoss(def, x, y) {
    def = def || Content.boss(G.run.biome.miniboss); if (!def) { UI.toast('Mini-boss absent du contenu'); G.room.doorOpen = true; return; }
    if (G.room.boss) return;
    const b = new Boss(def, x || ROOM_X + ROOM_W * 0.72, y || ROOM_Y + ROOM_H / 2); G.enemies.push(b); G.room.boss = b;
    UI.banner(def.name, '#ff3b5c', def.subtitle || ''); AudioEngine.bossRoar({});
  },
  onBossDefeated(b) { G.room.bossDead = true; G.run.stats.bossKilled = true; G.shake = 14; UI.banner(Content.pick('bossWin') || 'Étalon neutralisé', '#ffd166'); AudioEngine.roomClear({}); for (let i = 0; i < 12; i++) Pickups.spawn(b.x, b.y, 'coin', 1); },
  alive() { return G.enemies.filter(e => !e.dead).length; },
  update(dt) {
    const r = G.room; const pl = G.player;
    r.time += dt; r.stateT += dt;
    if (r.combo > 0 && Time.now > r.comboUntil) r.combo = 0;
    if (r.state === 'intro') { if (r.stateT >= 0.8) Room.begin(); return; }
    /* vagues */
    if (r.state === 'fight') {
      const alive = Room.alive();
      for (const w of r.waves) {
        if (w.done) continue;
        const trig = w.at === 'start' ? r.stateT >= 0 : w.at === 'clear' ? (alive === 0 && r.wavesStarted && r.lastWaveT < r.stateT - 0.5) : typeof w.at === 'number' ? r.stateT >= w.at : false;
        if (trig) { w.done = true; r.wavesStarted = true; r.lastWaveT = r.stateT; for (const s of w.spawns) Room.spawnAt(s); if (w.at !== 'start') { UI.banner(STR.wave + ' ' + (++r.waveIdx + 1), '#ff6b6b'); } else r.waveIdx = 0; break; }
      }
      if (r.type === 'MINIBOSS' && !r.boss && r.stateT > 0.2 && !r.waves.length) Room.spawnBoss();
      /* fragments d'énergie */
      for (const f of r.fragmentsDef) { if (!f.spawned && r.stateT >= (f.at || 0)) { f.spawned = true; Pickups.spawn(tileX(f.x), tileY(f.y), 'fragment', f.xp || 12); r.fragmentsSpawned++; } }
      /* condition de fin */
      const allWaves = r.waves.every(w => w.done);
      if (r.type === 'CHEST') { /* fin par interaction */ }
      else if (r.type === 'TRAP') { /* porte ouverte dès le début */ }
      else if (r.type === 'MINIBOSS') { if (r.bossDead && Room.alive() === 0) Room.clear(); }
      else if (allWaves && Room.alive() === 0 && r.wavesStarted) Room.clear();
    }
    /* coffre */
    if (r.chest && !r.chest.opened) { const near = dist(pl.x, pl.y, r.chest.x, r.chest.y) < r.chest.r + pl.r + 16; r.chest.near = near; if (near && (Input.wasPressed('interact') || (pl.bot && r.stateT > 1))) Run.openChest(); }
    /* porte */
    if (r.doorOpen && !pl.dead) { const dx = ROOM_X + ROOM_W, dy = ROOM_Y + ROOM_H / 2; if (pl.x > dx - pl.r - 26 && Math.abs(pl.y - dy) < TILE * 0.9) Run.nextRoom(); }
    /* pièges */
    for (const t of r.traps) t.update(dt, r.time);
    /* salles modulaires (phase 2) : Modular.update(r, dt) déplacera les obstacles et recalculera px/py */
    if (r.modular.length && typeof Modular !== 'undefined') Modular.update(r, dt);
    /* zones de dégâts (traînées de feu, gaz du joueur…) */
    for (let i = r.hazards.length - 1; i >= 0; i--) {
      const h = r.hazards[i]; if (Time.now > h.until) { r.hazards.splice(i, 1); continue; }
      if (h.owner === 'player') for (const e of G.enemies) { if (e.dead || dist(h.x, h.y, e.x, e.y) > h.r + e.r) continue; const last = h.cd.get(e) || -9; if (Time.now - last < 0.25) continue; h.cd.set(e, Time.now); Combat.hitEnemy(e, h.dps * 0.25, { dot: true, x: e.x, y: e.y }); }
    }
    /* tourelles */
    for (let i = r.turrets.length - 1; i >= 0; i--) { const t = r.turrets[i]; if (Time.now > t.until) { r.turrets.splice(i, 1); continue; } t.cd -= dt; if (t.cd <= 0) { const e = nearestEnemy(t.x, t.y, t.range); if (e) { t.cd = 1 / t.rate; const a = angleTo(t.x, t.y, e.x, e.y); Projectiles.spawn({ x: t.x, y: t.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 4, damage: t.damage, owner: 'player', life: 1.2, color: '#9ff', knockback: 0.3 }); } } }
    /* leurres */
    for (let i = r.decoys.length - 1; i >= 0; i--) { const d = r.decoys[i]; if (Time.now > d.until || d.hp <= 0) { if (d.explode) Combat.explosion(d.x, d.y, 110, 40 * pl.stats.damage, '#c9a3ff', true); r.decoys.splice(i, 1); } }
    /* cosmétique */
    const tick = a => { for (let i = a.length - 1; i >= 0; i--) { a[i].t += dt; if (a[i].t > a[i].life) a.splice(i, 1); } };
    tick(r.beams); tick(r.blasts); tick(r.slashes);
  },
  clear() {
    const r = G.room; if (r.state === 'clear') return; r.state = 'clear'; r.stateT = 0; r.doorOpen = true;
    AudioEngine.roomClear({}); UI.banner('Salle sécurisée — sortie ouverte', '#7fff9a');
    for (const p of Pickups.list) p.magnet = true;
  },
  /* score de la salle courante */
  score() { const r = G.room; return Progression.roomScore({ hits: r.hits, time: r.time, refTime: r.refTime, bestCombo: r.bestCombo, comboTarget: r.comboTarget, died: r.died, fragments: r.fragments, fragmentsTotal: r.fragmentsDef.length }); },
  /* danger pour le bot */
  dangerAt(x, y) { let d = 0; const r = G.room; for (const t of r.traps) d = Math.max(d, t.dangerAt(x, y, r.time)); return d; },

  render(ctx) {
    const r = G.room; if (!r) return;
    Sprites.drawFloor(ctx, r);
    /* obstacles */
    for (const o of r.obstacles) Sprites.drawBlock(ctx, o);
    /* porte */
    const dx = ROOM_X + ROOM_W, dy = ROOM_Y + ROOM_H / 2;
    ctx.save(); ctx.fillStyle = r.doorOpen ? '#0b0d14' : '#2b3350'; ctx.fillRect(dx - 4, dy - TILE, TILE + 8, TILE * 2);
    if (r.doorOpen) { ctx.strokeStyle = '#7fff9a'; ctx.shadowColor = '#7fff9a'; ctx.shadowBlur = 16 + Math.sin(Time.now * 4) * 6; ctx.lineWidth = 3; ctx.strokeRect(dx - 2, dy - TILE + 2, TILE + 4, TILE * 2 - 4); ctx.fillStyle = '#7fff9a'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('▶', dx + TILE / 2, dy + 8); }
    else { ctx.strokeStyle = '#ff5e7a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(dx + 6, dy - TILE + 8); ctx.lineTo(dx + TILE - 2, dy + TILE - 8); ctx.moveTo(dx + TILE - 2, dy - TILE + 8); ctx.lineTo(dx + 6, dy + TILE - 8); ctx.stroke(); }
    ctx.restore();
    /* zones */
    for (const h of r.hazards) { ctx.save(); ctx.globalAlpha = 0.45 * clamp((h.until - Time.now) / 1, 0.3, 1); ctx.fillStyle = h.color; ctx.shadowColor = h.color; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill(); ctx.restore(); }
    for (const t of r.traps) t.render(ctx, r.time);
    /* coffre */
    if (r.chest) Sprites.drawChest(ctx, r.chest);
    /* tourelles & leurres */
    for (const t of r.turrets) { ctx.save(); ctx.fillStyle = '#3a3f55'; ctx.beginPath(); ctx.arc(t.x, t.y, 12, 0, TAU); ctx.fill(); ctx.fillStyle = '#9ff'; ctx.shadowColor = '#9ff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(t.x, t.y, 5, 0, TAU); ctx.fill(); ctx.restore(); }
    for (const d of r.decoys) { ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#c9a3ff'; ctx.shadowColor = '#c9a3ff'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill(); ctx.restore(); }
  },
  renderFx(ctx) {
    const r = G.room; if (!r) return;
    for (const s of r.slashes) { const k = s.t / s.life; ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = s.color; ctx.shadowColor = s.color; ctx.shadowBlur = 14; ctx.lineWidth = s.slam ? 6 : 4; ctx.beginPath(); if (s.slam) ctx.arc(s.cx, s.cy, s.range * (0.5 + 0.5 * k), 0, TAU); else ctx.arc(s.x, s.y, s.range * (0.7 + 0.3 * k), s.a - s.arc / 2, s.a + s.arc / 2); ctx.stroke(); ctx.restore(); }
    for (const b of r.beams) { const k = b.t / b.life; ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = b.color; ctx.shadowColor = b.color; ctx.shadowBlur = 16; ctx.lineWidth = b.width; ctx.beginPath(); ctx.moveTo(b.ax, b.ay); if (b.jag) { const n = 6; for (let i = 1; i < n; i++) { const t = i / n; ctx.lineTo(lerp(b.ax, b.bx, t) + VFX_RNG.range(-8, 8), lerp(b.ay, b.by, t) + VFX_RNG.range(-8, 8)); } } ctx.lineTo(b.bx, b.by); ctx.stroke(); ctx.restore(); }
    for (const b of r.blasts) { const k = b.t / b.life; ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = b.color; ctx.lineWidth = 6 * (1 - k) + 1; ctx.shadowColor = b.color; ctx.shadowBlur = 20; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (0.3 + 0.7 * k), 0, TAU); ctx.stroke(); ctx.restore(); }
  },
};

/* ---------- Run : un niveau du début à la fin ---------- */
const Run = {
  start({ character, biome, weapon, skill, seed }) {
    if (seed != null) RNG.reseed(seed);
    const charDef = Content.character(character); const biomeDef = Content.biome(biome);
    const rooms = Content.roomsOf(biomeDef.id);
    const pair = RNG.pick(biomeDef.levelPassives || [{ bonus: { name: '—', desc: '', mods: [] }, malus: { name: '—', desc: '', mods: [] } }]);
    G.run = {
      biome: biomeDef, char: charDef, rooms, roomIndex: 0, levelPassive: { bonus: Object.assign({ id: 'lp_bonus' }, pair.bonus), malus: Object.assign({ id: 'lp_malus' }, pair.malus) },
      level: 1, xp: 0, xpNext: Progression.xpForLevel(1), upgrades: [], pendingLevelUps: 0, rerolls: 0,
      scores: [], coinsPending: 0, coinsValidated: 0, lastCheckpoint: 0, startedAt: Time.now, ended: false,
      stats: { kills: 0, damageDealt: 0, damageTaken: 0, hitsTaken: 0, shots: 0, skillUses: 0, coins: 0, roomsEntered: 0, roomTimes: [], bossKilled: false, deathCause: null, deathRoom: null, levelReached: 1 },
      skillChoices: null,
    };
    G.player = new Player(charDef);
    G.player.hp = 0; G.player.recompute(); G.player.hp = G.player.stats.maxHp;
    G.state = 'run'; G.paused = false;
    const startW = weapon || charDef.startWeapon;
    if (weapon && skill) { Run.equip(startW, skill); }
    G.run.skillChoices = RNG.shuffle(Content.skillsAvailable().slice()).slice(0, 2);
    applyDifficulty();
    if (!Room.load(1)) return;
    if (!(weapon && skill)) { G.paused = true; UI.showPrep(); } else Room.begin();
  },
  equip(weaponId, skillId) {
    const pl = G.player; pl.weapon = Content.weapon(weaponId) || Content.weapons()[0]; pl.skill = Content.skill(skillId) || Content.skills()[0];
    pl.rerollsLeft = Meta.rerolls(); pl.skillCharges = 1; pl.skillCd = 0; pl.recompute(); pl.skillCharges = pl.skillMaxCharges;
    G.run.weapon = pl.weapon.id; G.run.skill = pl.skill.id;
  },
  addXp(n) {
    const r = G.run; if (r.ended) return; r.xp += n;
    while (r.xp >= r.xpNext) { r.xp -= r.xpNext; r.level++; r.xpNext = Progression.xpForLevel(r.level); r.pendingLevelUps++; r.stats.levelReached = r.level; }
    if (r.pendingLevelUps > 0 && !G.overlay) Run.levelUp();
  },
  upgradePool() {
    const pl = G.player; const fam = pl.weapon ? pl.weapon.family : null; const counts = {}; for (const u of G.run.upgrades) counts[u.def.id] = u.stacks;
    return Content.upgrades().filter(u => (!u.weaponFamily || u.weaponFamily === fam) && (counts[u.id] || 0) < (u.maxStacks || 1));
  },
  levelUp() {
    const r = G.run; if (r.pendingLevelUps <= 0) return; r.pendingLevelUps--;
    const pl = G.player; AudioEngine.levelUp({});
    for (const h of pl.hooks.onLevelUp) if (h.effect === 'reroll_on_levelup') pl.rerollsLeft += h.count * (h.stacks || 1);
    const n = Meta.fourthChoice() ? 4 : 3;
    const opts = { force: G.debug.forceRarity };
    const choices = Progression.drawUpgrades(Run.upgradePool(), n, pl.stats.luck, opts);
    G.paused = true; UI.showChoice({ title: STR.levelUp, subtitle: `${STR.level} ${r.level}`, choices, reroll: true, onPick: u => { Run.takeUpgrade(u); UI.hideChoice(); G.paused = false; if (r.pendingLevelUps > 0) Run.levelUp(); }, onReroll: () => Progression.drawUpgrades(Run.upgradePool(), n, pl.stats.luck, opts) });
  },
  takeUpgrade(def) {
    const r = G.run; const ex = r.upgrades.find(u => u.def.id === def.id); if (ex) ex.stacks++; else r.upgrades.push({ def, stacks: 1 });
    G.player.recompute(); AudioEngine.uiConfirm({}); Floaters.add(G.player.x, G.player.y - 40, def.name, RARITY[def.rarity].color, 16);
    if (def.rarity === 'colossal') Meta.unlockLore('first_colossal');
  },
  /* fenêtre de scores pour un coffre */
  chestWindow() {
    const r = G.run; const idx = G.room.index; const scores = r.scores.filter(s => s.index < idx && (idx <= 4 ? s.index >= 1 : s.index >= 1));
    let vals = scores.map(s => s.score); let label = `Salles 1-${idx - 1}`;
    if (idx >= 8 && Meta.selectiveMemory()) { vals = Progression.bestN(vals, 3); label = '3 meilleures salles'; }
    const died = scores.some(s => s.died);
    return { avg: Progression.avgScore(vals), died, label, count: vals.length };
  },
  openChest() {
    const r = G.room; if (!r.chest || r.chest.opened) return; r.chest.opened = true; AudioEngine.chestOpen({});
    const win = Run.chestWindow(); const opts = Progression.chestOptions(win.avg, win.died); if (G.debug.forceRarity) opts.force = G.debug.forceRarity;
    const n = Meta.fourthChoice() ? 4 : 3; const pl = G.player;
    const choices = Progression.drawUpgrades(Run.upgradePool(), n, pl.stats.luck, opts);
    G.paused = true;
    UI.showChoice({ title: STR.chest, subtitle: `${win.label} · qualité ${Math.round(win.avg * 100)} % · ${opts.label}`, choices, reroll: false, onPick: u => { Run.takeUpgrade(u); UI.hideChoice(); G.paused = false; Room.clear(); } });
    /* checkpoint : consignation des pièces */
    if (r.index === 4 || r.index === 8) Run.checkpoint();
  },
  checkpoint() { const r = G.run; if (r.coinsPending > 0) { r.coinsValidated += r.coinsPending; UI.toast(`Consignation : ${r.coinsPending} crédits validés`); r.coinsPending = 0; } r.lastCheckpoint = G.room.index; Meta.addCoins(0); },
  finishRoom() {
    const r = G.room; const s = Room.score();
    G.run.scores.push({ index: r.index, score: s, hits: r.hits, time: r.time, died: r.died });
    G.run.stats.roomTimes.push({ room: r.index, time: Math.round(r.time * 10) / 10, hits: r.hits, score: Math.round(s * 100) / 100 });
    if (r.type === 'TRAP' && r.hits === 0) { const bonus = Math.round(30 * G.player.stats.xpGain * G.debug.xpMul); Run.addXp(bonus); UI.toast(`Traversée parfaite : +${bonus} XP`); }
    if (r.index === 3) Meta.unlockLore('room3_done');
    if (r.index === 5) { Meta.unlockLore('room5_reached'); if (r.hits === 0) Meta.unlockLore('boss_no_hit'); }
  },
  nextRoom() {
    if (G.overlay || G.room.leaving) return; G.room.leaving = true;
    Run.finishRoom();
    const next = G.room.index + 1; const maxPhase1 = 5;
    if (next > maxPhase1 || !G.run.rooms.find(x => x.index === next) || ROOM_TYPES[G.run.rooms.find(x => x.index === next).type].phase > 1) { Run.endLevel(true); return; }
    UI.transition(() => { Room.load(next); });
  },
  onPlayerDeath() {
    const r = G.run; if (r.ended) return; r.ended = true;
    G.room.died = true; r.stats.deathRoom = G.room.index; r.stats.deathCause = Run.lastDamageSource || 'inconnu';
    const kept = Progression.coinsKeptOnDeath(r.coinsPending, G.room.index, r.lastCheckpoint);
    const total = r.coinsValidated + kept; Meta.addCoins(total); Meta.recordRun(false);
    Meta.unlockLore('deaths_3');
    G.paused = true; UI.showEnd({ victory: false, kept, pending: r.coinsPending, validated: r.coinsValidated, total });
    Music.play('hub');
  },
  endLevel(victory) {
    const r = G.run; if (r.ended) return; r.ended = true;
    const total = r.coinsValidated + r.coinsPending + (victory ? 60 : 0); Meta.addCoins(total); Meta.recordRun(true);
    G.paused = true; UI.showEnd({ victory: true, kept: r.coinsPending, pending: 0, validated: r.coinsValidated, total, bonus: 60 });
    Music.play('hub');
  },
  abort() { const r = G.run; if (!r || r.ended) return; r.ended = true; const kept = Progression.coinsKeptOnDeath(r.coinsPending, G.room.index, r.lastCheckpoint); Meta.addCoins(r.coinsValidated + kept); Meta.recordRun(false); Run.toHub(); },
  toHub() { G.state = 'hub'; G.paused = false; G.overlay = null; G.run = null; G.player = null; G.enemies = []; G.room = null; Projectiles.list = []; Pickups.list = []; UI.showHub(); Music.play('hub'); },
  qualityAvg() { const r = G.run; if (!r) return 1; const vals = r.scores.map(s => s.score); const cur = G.room && G.room.state !== 'clear' ? [Room.score()] : []; return Progression.avgScore(vals.concat(cur)); },

  update(dt) {
    if (!G.run || G.paused) return;
    const pl = G.player;
    pl.update(dt);
    for (const e of G.enemies) e.update(dt);
    G.enemies = G.enemies.filter(e => !e.dead);
    Projectiles.update(dt); Pickups.update(dt); Room.update(dt); Particles.update(dt); Floaters.update(dt);
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
  },
};
