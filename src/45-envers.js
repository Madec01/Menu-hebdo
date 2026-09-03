/* ---------- L'Envers : monde miroir, Voile, Reflets, énigmes entre mondes ---------- */
const inWorld = e => e.world === 'both' || e.world === G.world;
function curTiles(room) { room = room || G.room; return G.world === 'envers' ? room.tilesE : room.tiles; }

// construit la version Envers d'une salle : murs intérieurs → ombres traversables, gouffres → ponts, glyphes révélés
function buildEnvers(room) {
  const t = room.tiles, e = [], mx = (RW - 1) / 2 | 0, my = (RH - 1) / 2 | 0;
  for (let y = 0; y < RH; y++) {
    e.push([]);
    for (let x = 0; x < RW; x++) {
      const v = t[y][x], border = x === 0 || y === 0 || x === RW - 1 || y === RH - 1;
      let n = v;
      if (v === T_WALL) n = border ? T_WALL : T_SHADOW;
      else if (v === T_PIT) n = T_BRIDGE;
      else if (v === T_GLYPH) n = T_GLYPHE;
      else if (v === T_LAVA || v === T_POISON || v === T_ICE) n = T_FLOOR;
      else if (v === T_WATER) n = T_ICE;
      else if (v === T_DOORC || v === T_SEALED) n = T_DOOR;
      e[y].push(n);
    }
  }
  if (room.puzzle !== 'glyph') for (let y = 1; y < RH - 1; y++) for (let x = 1; x < RW - 1; x++) {
    const v = t[y][x]; if (v !== T_PIT && v !== T_LAVA) continue;
    const ox = RW - 1 - x;
    if (e[y][ox] === T_FLOOR && ox !== mx && y !== my && !(Math.abs(ox - mx) <= 2 && Math.abs(y - my) <= 2)) e[y][ox] = T_PIT;
  }
  room.tilesE = e; room.cacheE = null;
}

/* ---------- Voile & traversée ---------- */
function nearFissure() { return G.room.props.some(p => p.kind === 'fissure' && dist(p.x, p.y, P.x, P.y) < 36); }
function crossCost() {
  const fis = nearFissure();
  if (G.world === 'envers') return fis ? 0 : 25;
  return Math.round((fis ? 30 : 70) * (P.voileCostMul || 1));
}
function tryCross() {
  if (G.room.challengeOn) { SFX('deny'); ft(P.x, P.y - 26, 'Pas pendant une épreuve', '#c77dff', 12); return; }
  const cost = crossCost();
  if (G.voile < cost) { SFX('deny'); ft(P.x, P.y - 26, 'Voile insuffisant (' + cost + ')', '#c77dff', 12); return; }
  G.voile -= cost;
  if (G.world === 'normal') G.voile = Math.max(G.voile, 12);
  crossWorld(false);
}
function crossWorld(forced) {
  const room = G.room, toEnvers = G.world === 'normal';
  G.world = toEnvers ? 'envers' : 'normal';
  bullets = []; zones = []; beams = []; slashes = [];
  G.crossT = 0.7; shakeIt(6); flash = 0.35; flashColor = toEnvers ? '150,110,255' : '230,225,255';
  SFX(toEnvers ? 'cross' : 'crossBack');
  Audio.setEnvers(toEnvers);
  Tutorial.event(toEnvers ? 'cross' : 'crossBack');
  if (P.enversSpeed) P.inv = Math.max(P.inv, 1.5);
  if (toEnvers) {
    G.crossings++;
    setupEnversRoom(room);
    if (!save.tutorialEnvers) { save.tutorialEnvers = 1; writeSave(); hint = { t: STORY.envers.first, life: 8 }; }
    else if (room.puzzle === 'alcove' && !room.gateOpen) hint = { t: STORY.envers.lever, life: 6 };
  } else {
    enemies = enemies.filter(e => !e.reflet);
    if (!room.spawned && !room.cleared && (room.type === 'normal' || room.type === 'boss')) { setDoors(room, false); spawnEnemies(room); SFX('doorClose'); }
    else setDoors(room, !room.challengeOn && (room.cleared || (room.type !== 'normal' && room.type !== 'boss')));
    if (forced) { P.stunT = 0.5; hurtPlayer(1, null, true); ft(P.x, P.y - 30, 'Rejeté hors de l\'Envers', '#c77dff', 13, 1.5); hint = { t: STORY.envers.forced[Math.floor(Math.random() * STORY.envers.forced.length)], life: 5 }; }
  }
  if (hitsWall(P.x, P.y, P.r, 'player')) { const p = randomFloorTile(0, 'ground'); P.x = p.x; P.y = p.y; }
  P.safeX = P.x; P.safeY = P.y; P.vx = P.vy = 0;
}
function setupEnversRoom(room) {
  if (room.type === 'boss') { setDoors(room, !!room.cleared); return; }
  if (room.type === 'start' || room.clearedE) { setDoors(room, true); return; }
  if (!room.refletsSpawned) spawnReflets(room);
  setDoors(room, false);
}
function spawnReflets(room) {
  room.refletsSpawned = true;
  const pool = G.floorData.biome.enemies.filter(t => t !== 'turret' && t !== 'toad');
  const n = Math.min(6, 2 + Math.floor(G.floor / 2));
  for (let i = 0; i < n; i++) {
    const pos = randomFloorTile(TILE * 4, 'fly');
    enemies.push(makeEnemy(pick(pool), pos.x, pos.y, { reflet: true }));
  }
}
function clearRoomE(room) {
  room.clearedE = true; setDoors(room, true); SFX('clear');
  G.voile = Math.min(100, G.voile + 15);
  ft(P.x, P.y - 30, 'Reflets dispersés (+15 Voile)', '#c77dff', 13, 1.3);
  const cx = RW * TILE / 2, cy = RH * TILE / 2;
  for (let i = 0; i < 3; i++) dropPickup(cx, cy, 'coin');
}
function updateEnvers(dt) {
  if (G.world !== 'envers') { if (G.crossT > 0) G.crossT -= dt; return; }
  if (G.crossT > 0) G.crossT -= dt;
  const drain = 4 * (P.voileDrainMul || 1) * (G.oath && G.oath.mirror ? 0.5 : 1) * (1 - 0.15 * metaLv('veil'));
  G.voile -= dt * drain; G.enversT += dt;
  if (G.voile <= 0) { G.voile = 0; crossWorld(true); return; }
  if (G.enversT > 28 && !G.hunterAlive && !enemies.some(e => e.hunter)) { spawnHunter(); G.enversT = 0; }
  if (Math.random() < 0.12) burst(P.x + (Math.random() - 0.5) * 40, P.y + (Math.random() - 0.5) * 40, 1, '#d8c8ff', 20, { shape: 'dot', glow: 1, life: 0.8, grav: -30, size: 2 });
}

/* ---------- énigmes ---------- */
function openGate(room) {
  if (!room.gate || room.gateOpen) return;
  room.gateOpen = true;
  for (const [x, y] of room.gate) { room.tiles[y][x] = T_FLOOR; room.tilesE[y][x] = T_FLOOR; }
  room.cache = null; room.cacheE = null;
  SFX('gate'); shakeIt(6);
  ft(P.x, P.y - 30, 'Un mur s\'efface de l\'autre côté', '#c77dff', 13, 1.6);
}
function enversRelicChoices(n) {
  const owned = new Set(G.relics.map(r => r.id));
  const pool = RELICS.filter(r => r.envers && !owned.has(r.id));
  const out = []; while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  if (!out.length) out.push(relicById('heal'));
  return out;
}
function interactEnvers(pr) {
  if (pr.kind === 'chestE') {
    pr.used = true; burst(pr.x, pr.y, 30, '#c77dff', 200, { glow: 1 }); SFX('relic');
    openChoice({ title: 'Coffre de l\'Envers', sub: 'Des reliques qui n\'existent que de ce côté.', cards: enversRelicChoices(2).map(r => ({ ic: r.ic, n: r.n, d: r.d, onPick: () => applyRelic(r) })) });
    return true;
  }
  if (pr.kind === 'lever') { pr.used = true; openGate(G.room); return true; }
  if (pr.kind === 'echo') {
    pr.used = true; const r = relicById(save.echo && save.echo.relic);
    save.echo = null; writeSave();
    if (r) { applyRelic(r); ft(pr.x, pr.y - 30, 'Ton écho te rend ' + r.n, '#dff4ff', 13, 2); hint = { t: STORY.envers.echo, life: 7 }; }
    burst(pr.x, pr.y, 40, '#dff4ff', 220, { glow: 1, life: 1 }); SFX('revive');
    return true;
  }
  return false;
}
