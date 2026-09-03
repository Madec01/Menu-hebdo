/* ---------- déroulement d'une partie ---------- */
function newRun() {
  const seed = (Math.random() * 2147483647) | 0;
  rng = mulberry32(seed); nextId = 1;
  save.lastSeed = seed;
  G = { seed, floor: 1, kills: 0, essence: 0, time: 0, relics: [], floorData: null, room: null, bossName: '', oath: null,
    menaceT: 0, menaceMax: 150, hunterAlive: false, hunterDelay: 0, combo: 0, comboT: 0, maxCombo: 0, surge: 0, pets: [], floorT: 0, bossesKilled: 0 };
  P = makePlayer();
  P.maxHp += 2 * metaLv('vit'); P.hp = P.maxHp;
  P.dmgMul += 0.1 * metaLv('force');
  P.spd *= 1 + 0.06 * metaLv('agi');
  if (metaLv('relic')) applyRelic(pick(RELICS.filter(r => !r.consumable && !r.once)), true);
  enemies = []; bullets = []; parts = []; pickups = []; texts = []; zones = []; pools = []; slashes = []; beams = [];
  banner = null; hint = null; shake = 0; flash = 0;
  document.body.classList.add('playing');
  hideAll(); state = 'play';
  startFloor();
}
function startFloor() {
  G.floorData = genFloor(G.floor);
  G.menaceT = 0; G.floorT = 0; G.hunterAlive = false;
  G.menaceMax = (150 + 10 * G.floor) * (1 + 0.25 * metaLv('calm'));
  if (metaLv('spark')) G.surge = Math.max(G.surge, 40);
  const biome = G.floorData.biome;
  const begin = () => {
    enterRoom(G.floorData.start, null);
    Audio.play(biome.track, { root: biome.root }); Audio.setAmbience(biome.amb);
    banner = { t: 'Étage ' + G.floor + ' — ' + biome.name, s: biome.sub, color: '#ffd97a', life: 3, max: 3 };
    if (G.floor === 1 && !save.tutorial) hint = { t: 'Nettoie chaque salle pour ouvrir les portes. Le boss garde l\'escalier.', life: 6 };
  };
  if (G.floor >= 2) { enterRoom(G.floorData.start, null); offerOath(begin); } else begin();
}
function nextFloor() {
  if (G.oath && G.oath.undo) G.oath.undo(P);
  G.oath = null;
  G.floor++;
  if (G.floor > save.bestFloor) { save.bestFloor = G.floor; writeSave(); }
  startFloor();
}
function setupProps(room) {
  room.props = room.props || [];
  if (room.propsDone) return;
  room.propsDone = true;
  const cx = RW * TILE / 2, cy = RH * TILE / 2;
  if (room.type === 'treasure') room.props.push({ kind: 'chest', x: cx, y: cy, used: false });
  if (room.type === 'armory') room.props.push({ kind: 'armory', x: cx, y: cy, used: false });
  if (room.type === 'shrine') room.props.push({ kind: 'altar', x: cx, y: cy, used: false });
  if (room.type === 'shop') { room.props.push({ kind: 'merchant', x: cx, y: cy - 10, used: false }); room.shopItems = makeShopItems(); }
  if (room.type === 'challenge') room.props.push({ kind: 'pedestal', x: cx, y: cy, used: false });
}
function enterRoom(room, fromDir) {
  // le Traqueur suit le joueur
  const h = enemies.find(e => e.hunter && !e.dead);
  if (h) { G.hunterHpFrac = h.hp / h.maxHp; G.hunterDelay = 2; } else if (G.hunterAlive) G.hunterDelay = 2;
  for (const p of pickups) if (p.type === 'coin') addEssence(1); else if (p.type === 'gem') addEssence(5);
  G.room = room; room.visited = true;
  if (!room.gen) genTiles(room);
  setupProps(room);
  bullets = []; enemies = []; pickups = []; parts = []; texts = []; zones = []; pools = []; slashes = []; beams = [];
  const mx = (RW - 1) / 2 | 0, my = (RH - 1) / 2 | 0;
  if (fromDir) {
    const op = OPP[fromDir], d = room.doorTiles.find(t => t.dir === op), [dx, dy] = op.split(',').map(Number);
    P.x = (d.x + 0.5) * TILE - dx * TILE * 1.7; P.y = (d.y + 0.5) * TILE - dy * TILE * 1.7;
  } else { P.x = (mx + 0.5) * TILE; P.y = (my + 0.5) * TILE + (room.type === 'start' ? 0 : TILE * 2.5); }
  P.dashT = 0; P.vx = P.vy = 0; P.safeX = P.x; P.safeY = P.y; P.fallT = 0;
  for (const pet of G.pets) { pet.x = P.x; pet.y = P.y; }
  transT = 0.3;
  if (!room.cleared && (room.type === 'normal' || room.type === 'boss')) {
    setDoors(room, false); spawnEnemies(room); SFX('doorClose');
    if (room.type === 'boss') { SFX('boss'); banner = { t: G.bossName, s: 'Boss — ' + G.floorData.biome.name, color: '#ff5e7a', life: 3.2, max: 3.2 }; shakeIt(12); Audio.play('boss', { root: G.floorData.biome.root }); }
  } else {
    setDoors(room, true);
    if (room.type === 'shop' && !room.shopSeen) { room.shopSeen = true; hint = { t: 'Un marchand. Approche-toi de lui pour dépenser ton essence.', life: 4 }; }
    if (room.type === 'shrine' && !room.seen) { room.seen = true; hint = { t: 'Un autel ancien. Il demande, et il donne.', life: 4 }; }
    if (room.type === 'challenge' && !room.seen && !room.cleared) { room.seen = true; hint = { t: 'Une épreuve : touche le piédestal pour affronter des vagues.', life: 4 }; }
  }
  updateCamera(true);
}
function clearRoom() {
  const room = G.room;
  room.cleared = true; setDoors(room, true); SFX('clear'); SFX('doorOpen');
  ft(P.x, P.y - 30, 'Salle nettoyée', '#7fd7ff', 14, 1.2);
  const cx = RW * TILE / 2, cy = RH * TILE / 2;
  for (let i = 0; i < 2; i++) dropPickup(cx, cy, 'coin');
  if (room.type === 'boss') {
    room.stairs = true; G.bossesKilled++; save.bossKills++;
    SFX('stairs'); banner = { t: 'Boss vaincu', s: 'L\'escalier est ouvert', color: '#7fd7ff', life: 3, max: 3 };
    Audio.play(G.floorData.biome.track, { root: G.floorData.biome.root });
  }
  if (G.floor === 1 && !save.tutorial) { save.tutorial = 1; writeSave(); hint = { t: 'Les portes sont ouvertes. Cherche le coffre (jaune) et le boss (rouge) sur la carte.', life: 5 }; }
}
function endRun() {
  state = 'dead'; document.body.classList.remove('playing'); clearTouches(); keys.clear();
  save.runs++; save.kills += G.kills;
  const gained = Math.floor(G.essence); save.essence += gained;
  const newBest = G.floor > save.bestFloor; if (newBest) save.bestFloor = G.floor;
  writeSave();
  Audio.setIntensity(0);
  return { gained, newBest };
}
function die() {
  const r = endRun();
  SFX('die'); burst(P.x, P.y, 50, '#ffd97a', 220); shakeIt(14); flash = 0.5;
  $('dFloor').textContent = G.floor; $('dKills').textContent = G.kills; $('dTime').textContent = fmtTime(G.time); $('dEss').textContent = '+' + r.gained + ' ◆';
  $('deadTitle').textContent = r.newBest ? 'Nouveau record.' : 'La crypte te garde.';
  $('deadSub').textContent = `Tombé à l'étage ${G.floor} (${G.floorData.biome.name}) avec ${curWeapon().name}. Combo max : ${G.maxCombo}.`;
  $('deadRelics').textContent = G.relics.length ? 'Reliques : ' + G.relics.map(r => r.ic + ' ' + r.n).join(', ') : 'Aucune relique.';
  const u = $('deadUnlock'); u.hidden = true;
  if (save.essence >= 45 && save.weapons.length < Object.keys(WEAPONS).length) { u.hidden = false; u.textContent = 'Tu as assez d\'essence pour débloquer une nouvelle arme au Sanctuaire.'; }
  setTimeout(() => { show('dead'); if (Audio.ready) { Audio.play('menu'); Audio.setAmbience('drip'); } }, 900);
}

/* ---------- offres : reliques, serments, autel, marchand, armurerie ---------- */
function relicChoices(n) {
  const owned = new Set(G.relics.map(r => r.id));
  let pool = RELICS.filter(r => !(r.once && owned.has(r.id)));
  if (P.hp >= P.maxHp) pool = pool.filter(r => r.id !== 'heal');
  if (P.noDash) pool = pool.filter(r => r.id !== 'dash' && r.id !== 'firedash');
  const out = [];
  while (out.length < n && pool.length) { const i = Math.floor(rng() * pool.length); out.push(pool.splice(i, 1)[0]); }
  return out;
}
function applyRelic(r, silent) { r.f(P); if (!r.consumable) G.relics.push(r); if (!silent) SFX('relic'); }
function offerRelics(title, sub, n, cb) {
  openChoice({ title, sub, cards: relicChoices(n).map(r => ({ ic: r.ic, n: r.n, d: r.d, onPick: () => { applyRelic(r); } })), onClose: () => { if (cb) cb(); } });
}
function offerOath(cb) {
  const opts = shuffle(OATHS.slice()).slice(0, 2);
  const cards = opts.map(o => ({ ic: o.ic, n: o.n, d: o.d, tag: '→ ' + o.reward, cls: 'oath', onPick: () => { G.oath = o; if (o.apply) o.apply(P); SFX('relic'); } }));
  cards.push({ ic: '🕊️', n: 'Sans serment', d: 'Descendre librement, sans contrainte ni récompense.', cls: 'oath neutral', onPick: () => { G.oath = null; SFX('click'); } });
  openChoice({ title: 'Étage ' + G.floor + ' — Prête serment', sub: 'Un serment dure tout l\'étage. La récompense tombe au boss ou pendant la descente.', cards, onClose: cb });
}
function makeShopItems() {
  const f = G.floor, items = [];
  for (const r of relicChoices(2)) items.push({ kind: 'relic', relic: r, price: 16 + 3 * f, sold: false });
  items.push({ kind: 'heart', price: 8 + f, sold: false });
  const others = Object.keys(WEAPONS).filter(w => w !== P.weapon);
  items.push({ kind: 'weapon', weapon: pick(others), price: 22 + 2 * f, sold: false });
  if (chance(0.5)) items.push({ kind: 'maxhp', price: 24 + 3 * f, sold: false });
  return items;
}
function openShop(room) {
  const cards = room.shopItems.map(it => {
    const base = { tag: () => it.sold ? 'Vendu' : it.price + ' ◆', disabled: () => it.sold || G.essence < it.price };
    const buy = fn => () => { if (it.sold || G.essence < it.price) { SFX('deny'); return true; } G.essence -= it.price; it.sold = true; fn(); SFX('buy'); return true; };
    if (it.kind === 'relic') return Object.assign(base, { ic: it.relic.ic, n: it.relic.n, d: it.relic.d, onPick: buy(() => applyRelic(it.relic, true)) });
    if (it.kind === 'heart') return Object.assign(base, { ic: '❤️', n: 'Cœur', d: 'Soigne 1 cœur', onPick: buy(() => { P.hp = Math.min(P.maxHp, P.hp + 2); }) });
    if (it.kind === 'maxhp') return Object.assign(base, { ic: '💗', n: 'Cœur vital', d: '+1 cœur maximum', onPick: buy(() => { P.maxHp += 2; P.hp += 2; }) });
    const w = WEAPONS[it.weapon];
    return Object.assign(base, { ic: w.ic, n: w.name, d: w.desc, onPick: buy(() => { dropWeapon(P.weapon, P.x, P.y + 40); P.weapon = it.weapon; SFX('swap'); }) });
  });
  openChoice({ title: 'Le marchand', sub: `Tu as ${Math.floor(G.essence)} ◆. L'essence dépensée ici ne sera pas conservée pour le Sanctuaire.`, cards, footer: [{ label: 'Partir', primary: true }] });
}
function openShrine(prop) {
  const cards = [
    { ic: '🩸', n: 'Sacrifice', d: 'Offre 1 cœur maximum. Reçois une relique.', disabled: () => P.maxHp <= 2, onPick: () => { P.maxHp -= 2; P.hp = Math.min(P.hp, P.maxHp); prop.used = true; SFX('hurt'); setTimeout(() => offerRelics('L\'autel accepte', 'Choisis ta relique', 3, null), 50); } },
    { ic: '◆', n: 'Offrande', d: 'Donne 15 ◆. Sois entièrement soigné et gagne ½ cœur max.', tag: '15 ◆', disabled: () => G.essence < 15, onPick: () => { G.essence -= 15; P.maxHp += 1; P.hp = P.maxHp; prop.used = true; SFX('heart'); } },
    { ic: '🙏', n: 'Prière', d: 'Le hasard décide : relique, essence… ou la colère de l\'autel.', onPick: () => {
      prop.used = true; const r = Math.random();
      if (r < 0.45) setTimeout(() => offerRelics('L\'autel est clément', 'Choisis ta relique', 2, null), 50);
      else if (r < 0.75) { for (let i = 0; i < 8; i++) dropPickup(prop.x, prop.y, 'coin'); dropPickup(prop.x, prop.y, 'gem'); SFX('coin'); }
      else { G.menaceT = Math.min(G.menaceMax, G.menaceT + G.menaceMax * 0.4); banner = { t: 'L\'autel gronde', s: 'La Menace bondit', color: '#ff5e7a', life: 2.5, max: 2.5 }; SFX('hunter'); }
    } },
    { ic: '🚶', n: 'Partir', d: 'Ne rien demander.', cls: 'neutral', onPick: () => {} },
  ];
  openChoice({ title: 'Autel des profondeurs', sub: 'Il demande, et il donne. Une seule fois.', cards });
}
function openArmory(prop) {
  const others = shuffle(Object.keys(WEAPONS).filter(w => w !== P.weapon)).slice(0, 2);
  openChoice({ title: 'Armurerie oubliée', sub: 'Choisis une arme. L\'actuelle restera au sol si tu changes d\'avis.', cards: others.map(id => { const w = WEAPONS[id]; return { ic: w.ic, n: w.name, d: w.desc, onPick: () => { dropWeapon(P.weapon, prop.x, prop.y + 44); P.weapon = id; prop.used = true; SFX('swap'); } }; }).concat([{ ic: '🚶', n: 'Garder ' + curWeapon().name, d: 'Refermer le coffre.', cls: 'neutral', onPick: () => { prop.used = true; } }]) });
}
function dropWeapon(id, x, y) { G.room.props.push({ kind: 'weapon', id, x, y, used: false, cd: 1 }); }
function startChallenge(room) {
  room.challengeOn = true; room.waves = 3; room.wave = 0; room.waveDelay = 0.8;
  setDoors(room, false); SFX('doorClose'); banner = { t: 'Épreuve', s: 'Trois vagues. Tiens bon.', color: '#ff9f43', life: 2.5, max: 2.5 };
}
function nextWave(room) {
  room.wave++; spawnWave(3 + G.floor + room.wave * 2, false); SFX('wave');
  ft(P.x, P.y - 30, 'Vague ' + room.wave, '#ff9f43', 16, 1.2);
}
function finishChallenge(room) {
  room.challengeOn = false; room.cleared = true; setDoors(room, true); SFX('clear'); SFX('doorOpen');
  const cx = RW * TILE / 2, cy = RH * TILE / 2;
  for (let i = 0; i < 5; i++) dropPickup(cx, cy, 'coin'); dropPickup(cx, cy, 'gem');
  offerRelics('Épreuve réussie', 'Quatre reliques. Une seule.', 4, null);
}
function interactProps() {
  const room = G.room;
  for (const pr of room.props) {
    if (pr.used) continue;
    if (pr.cd > 0) continue;
    if (dist(P.x, P.y, pr.x, pr.y) > P.r + 20) continue;
    if (pr.kind === 'chest') { pr.used = true; burst(pr.x, pr.y, 30, '#ffd97a', 200, { glow: 1 }); SFX('relic'); offerRelics('Un coffre ancien', 'Choisis une relique', 3, null); return true; }
    if (pr.kind === 'armory') { burst(pr.x, pr.y, 30, '#9fd8ff', 200, { glow: 1 }); openArmory(pr); return true; }
    if (pr.kind === 'altar') { openShrine(pr); return true; }
    if (pr.kind === 'merchant') { pr.cd = 1.5; openShop(room); return true; }
    if (pr.kind === 'pedestal') { pr.used = true; startChallenge(room); return true; }
    if (pr.kind === 'weapon') { const old = P.weapon; P.weapon = pr.id; pr.id = old; pr.cd = 1.2; SFX('swap'); ft(P.x, P.y - 26, WEAPONS[P.weapon].name, '#ffd97a', 13, 1.2); return true; }
  }
  return false;
}

/* ---------- boucle de mise à jour ---------- */
function update(dt) {
  G.time += dt; G.floorT += dt; P.tick += dt;
  const room = G.room;
  for (const pr of room.props) if (pr.cd > 0) pr.cd -= dt;

  /* --- déplacement --- */
  let mx = 0, my = 0;
  if (keys.has('KeyW') || keys.has('KeyZ') || keys.has('ArrowUp')) my -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
  if (keys.has('KeyA') || keys.has('KeyQ') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  const sm = stick('L'); if (sm.active) { mx += sm.dx; my += sm.dy; }
  let ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; ml = 1; }
  if (ml > 0.05) { P.fx = mx / ml; P.fy = my / ml; }
  P.moving = ml > 0.05; if (P.moving) P.walk += dt;
  P.dashCdT -= dt; P.inv -= dt; P.shieldT -= dt; P.fireT -= dt; P.webT -= dt; P.slowT -= dt; P.surgeT -= dt;
  const tile = tileAt(P.x, P.y);
  P.inWater = tile === T_WATER; P.onIce = tile === T_ICE;
  let spd = P.spd * (P.inWater ? 0.55 : 1) * (P.webT > 0 ? 0.5 : 1) * (P.slowT > 0 ? 0.65 : 1);
  if (P.fallT > 0) {
    P.fallT -= dt;
    if (!P.fell && P.fallT <= 0.25) { P.fell = true; hurtPlayer(1, null, true); P.x = P.safeX; P.y = P.safeY; P.vx = P.vy = 0; }
  } else {
    if (wantDash && !P.noDash && P.dashCdT <= 0 && P.dashT <= 0) { P.dashT = 0.18; P.dashCdT = P.dashCd; P.ddx = P.fx; P.ddy = P.fy; SFX('dash'); burst(P.x, P.y, 6, '#cfd8e6', 60, { life: 0.4 }); }
    if (P.dashT > 0) {
      P.dashT -= dt; moveCircle(P, P.ddx * 640 * dt, P.ddy * 640 * dt, 'player');
      parts.push({ x: P.x, y: P.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#7fd7ff', size: P.r * 2, shape: 'dot' });
      if (P.fireDash && (P.fireT2 = (P.fireT2 || 0) - dt) <= 0) { P.fireT2 = 0.05; addPool(P.x, P.y, 'fire', 20, 2.2); }
    } else {
      const dvx = mx * spd, dvy = my * spd;
      if (P.onIce) { const k = 1 - Math.pow(0.08, dt); P.vx = lerp(P.vx, dvx, k); P.vy = lerp(P.vy, dvy, k); } else { P.vx = dvx; P.vy = dvy; }
      const h = moveCircle(P, P.vx * dt, P.vy * dt, 'player');
      if (h.hx) P.vx = 0; if (h.hy) P.vy = 0;
    }
    // dangers de terrain
    const t2 = tileAt(P.x, P.y);
    const inPoison = t2 === T_POISON || pools.some(p => p.type === 'poison' && dist(p.x, p.y, P.x, P.y) < p.r);
    if (P.dashT <= 0 && inPoison) { P.hazT += dt; if (P.hazT >= 1) { P.hazT = 0; hurtPlayer(1, null, true); SFX('poison'); burst(P.x, P.y, 8, '#b8ff6a', 80, { shape: 'dot' }); } }
    else if (P.dashT <= 0 && t2 === T_LAVA) { P.hazT += dt * 1.6; if (P.hazT >= 1) { P.hazT = 0; hurtPlayer(1, null, true); SFX('sizzle'); burst(P.x, P.y, 10, '#ff9f43', 120, { glow: 1 }); } }
    else P.hazT = Math.max(0, P.hazT - dt * 2);
    if (t2 === T_PIT && P.dashT <= 0) { P.fallT = 0.5; P.fell = false; SFX('fall'); }
    else if (t2 !== T_PIT && t2 !== T_LAVA) { P.safeT += dt; if (P.safeT > 0.3 && !hitsWall(P.x, P.y, P.r, 'ground')) { P.safeX = P.x; P.safeY = P.y; } } else P.safeT = 0;
    if (P.inWater && P.moving && Math.random() < 0.2) burst(P.x, P.y + 6, 1, 'rgba(160,210,255,0.8)', 40, { shape: 'dot', life: 0.4 });
    if (P.inWater && !P.wasWater) SFX('splash'); P.wasWater = P.inWater;
  }
  wantDash = false;
  if (wantSurge && G.surge >= 100) activateSurge();
  wantSurge = false;

  /* --- visée & tir --- */
  const active = activeEnemies().filter(e => e.alpha >= 0.5 || e.boss);
  let aimA = null, wantFire = false;
  const sa = stick('R');
  if (sa.active && sa.len > 0.25) { aimA = Math.atan2(sa.dy, sa.dx); wantFire = true; }
  else if (mouse.down || (mouse.active && performance.now() - mouse.t < 1500)) {
    const wx = mouse.x / ZOOM + camX, wy = mouse.y / ZOOM + camY;
    aimA = Math.atan2(wy - P.y, wx - P.x); wantFire = mouse.down || active.length > 0;
  } else if (active.length) {
    let best = null, bd = 1e9; for (const e of active) { const d = dist(e.x, e.y, P.x, P.y); if (d < bd) { bd = d; best = e; } }
    aimA = Math.atan2(best.y - P.y, best.x - P.x); wantFire = true;
  }
  P.aim = aimA !== null ? aimA : Math.atan2(P.fy, P.fx);
  if (wantFire && P.fireT <= 0 && P.dashT <= 0 && P.fallT <= 0) { P.fireT = 1 / (curWeapon().rate * P.rateMul * (P.surgeT > 0 ? 2 : 1)); fire(P.aim); }

  /* --- ennemis --- */
  for (const e of enemies) updateEnemy(e, dt);
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j]; if (a.dead || b.dead || a.spawnT > 0 || b.spawnT > 0 || a.fly !== b.fly) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = a.r + b.r;
    if (d < min) { const push = (min - d) / 2, ux = dx / d, uy = dy / d; if (!a.boss) moveCircle(a, -ux * push, -uy * push); if (!b.boss) moveCircle(b, ux * push, uy * push); }
  }
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0 || (e.alpha < 0.5 && !e.boss) || e.state === 'air' || e.phase === 'hop') continue;
    if (dist(e.x, e.y, P.x, P.y) < e.r + P.r - 2 && hurtPlayer(e.contact, e) && P.thorns) damageEnemy(e, P.thorns, false);
  }
  if (state !== 'play') return;

  /* --- projectiles, coups, zones, objets, compagnons --- */
  updateBullets(dt); updateSlashes(dt); updateZones(dt); updatePickups(dt); updateCompanions(dt);
  if (state !== 'play') return;
  enemies = enemies.filter(e => !e.dead);
  const fighting = enemies.filter(e => !e.noCount);
  if (!room.cleared && room.spawned && !room.challengeOn && fighting.length === 0) clearRoom();
  if (room.challengeOn && fighting.length === 0) {
    room.waveDelay -= dt;
    if (room.waveDelay <= 0) { if (room.wave < room.waves) { nextWave(room); room.waveDelay = 1.2; } else finishChallenge(room); }
  }

  /* --- menace & traqueur --- */
  const menaceRate = ((G.oath && G.oath.menace) || 1) * (1 - 0.25 * metaLv('calm'));
  G.menaceT += dt * menaceRate;
  if (G.menaceT >= G.menaceMax && !G.hunterAlive) spawnHunter();
  if (G.hunterAlive && !enemies.some(e => e.hunter)) { G.hunterDelay -= dt; if (G.hunterDelay <= 0) { const p = randomFloorTile(200, 'fly'); const h = makeEnemy('hunter', p.x, p.y); h.hp = Math.max(1, Math.round(h.maxHp * (G.hunterHpFrac || 1))); enemies.push(h); } }
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  Audio.setIntensity(fighting.length > 0 || enemies.some(e => e.hunter) ? 1 : 0);

  /* --- particules & textes --- */
  for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; if (p.grav) p.vy += p.grav * dt; }
  parts = parts.filter(p => p.life > 0);
  for (const t of texts) { t.life -= dt; t.y -= 28 * dt; }
  texts = texts.filter(t => t.life > 0);
  if (banner) { banner.life -= dt; if (banner.life <= 0) banner = null; }
  if (hint) { hint.life -= dt; if (hint.life <= 0) hint = null; }
  shake = Math.max(0, shake - 40 * dt); flash = Math.max(0, flash - dt); transT = Math.max(0, transT - dt);

  /* --- portes, accessoires, escalier --- */
  if (transT <= 0 && !room.challengeOn) for (const d of room.doorTiles) {
    if (room.tiles[d.y][d.x] === T_DOOR && circleRect(P.x, P.y, P.r, d.x * TILE, d.y * TILE, TILE, TILE)) {
      const [dx, dy] = d.dir.split(',').map(Number);
      const nr = G.floorData.rooms.get(G.floorData.key(room.gx + dx, room.gy + dy));
      if (nr) { enterRoom(nr, d.dir); return; }
    }
  }
  if (interactProps()) return;
  const cx = RW * TILE / 2, cy = RH * TILE / 2;
  if (room.stairs && dist(P.x, P.y, cx, cy) < P.r + 16) {
    room.stairs = false;
    const bonus = G.oath && G.oath.bonusRelic;
    offerRelics('Étage ' + G.floor + ' terminé', 'Choisis une relique avant de descendre', 3, () => {
      if (bonus) offerRelics('Serment honoré', G.oath.n + ' : une relique bonus', 3, nextFloor); else nextFloor();
    });
    return;
  }
  updateCamera(false);
}

/* ---------- boucle ---------- */
let lastFrame = performance.now();
function loop(now) {
  const dt = Math.min((now - lastFrame) / 1000, 1 / 30);
  lastFrame = now;
  if (state === 'play') update(dt);
  else if (G) {
    for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    parts = parts.filter(p => p.life > 0);
    if (P) P.tick += dt;
  }
  Audio.update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// hook de test (non utilisé par le jeu)
window.__crypteDebug = { get G() { return G; }, get P() { return P; }, get enemies() { return enemies; }, get state() { return state; }, get room() { return G && G.room; },
  killAll() { for (const e of enemies.slice()) killEnemy(e); }, enterRoom, spawnHunter, activateSurge, startFloor, get bullets() { return bullets; }, get pickups() { return pickups; }, WEAPONS, RELICS, applyRelic, relicById };
