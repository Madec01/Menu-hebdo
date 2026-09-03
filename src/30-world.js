/* ---------- génération d'un étage ---------- */
function genFloor(n) {
  const rooms = new Map();
  const key = (x, y) => x + ',' + y;
  const list = [];
  const add = (x, y) => {
    const r = { gx: x, gy: y, type: 'normal', cleared: false, visited: false, gen: false, spawned: false, chestUsed: false, stairs: false,
      propsDone: false, tiles: null, doors: {}, doorTiles: [], torches: [], cache: null, template: 'open', wave: 0, waves: 0, challengeOn: false };
    rooms.set(key(x, y), r); list.push(r); return r;
  };
  const start = add(0, 0); start.type = 'start'; start.cleared = true;
  const target = 7 + Math.min(n, 6) + RI(0, 2);
  let guard = 0;
  while (list.length < target && guard++ < 900) {
    const base = pick(list), d = pick(DIRS);
    const nx = base.gx + d[0], ny = base.gy + d[1];
    if (rooms.has(key(nx, ny))) continue;
    let nb = 0; for (const dd of DIRS) if (rooms.has(key(nx + dd[0], ny + dd[1]))) nb++;
    if (nb > 1 && rng() < 0.85) continue;
    add(nx, ny);
  }
  const dm = new Map([[key(0, 0), 0]]); const q = [start];
  while (q.length) {
    const r = q.shift(); const d = dm.get(key(r.gx, r.gy));
    for (const dd of DIRS) { const k = key(r.gx + dd[0], r.gy + dd[1]); if (rooms.has(k) && !dm.has(k)) { dm.set(k, d + 1); q.push(rooms.get(k)); } }
  }
  let boss = null, bd = -1;
  for (const r of list) { const d = dm.get(key(r.gx, r.gy)); if (d > bd) { bd = d; boss = r; } }
  boss.type = 'boss';
  const neighbors = r => DIRS.filter(dd => rooms.has(key(r.gx + dd[0], r.gy + dd[1]))).length;
  const free = shuffle(list.filter(r => r !== start && r !== boss));
  free.sort((a, b) => neighbors(a) - neighbors(b));           // les culs-de-sac d'abord
  const specials = ['treasure'];
  if (n >= 2) specials.push('shop');
  if (n >= 2 && chance(0.65)) specials.push('shrine');
  if (n >= 3 && chance(0.6)) specials.push('challenge');
  if (n >= 2 && (n % 3 === 2 || chance(0.3))) specials.push('armory');
  for (const t of specials) { const r = free.shift(); if (!r) break; r.type = t; if (t !== 'challenge') r.cleared = true; }
  // Envers : salle scellée (accessible seulement par l'autre côté), énigmes, fissures
  if (n === 1) { const c = free.filter(r => neighbors(r) === 1); const r = c.length ? c[0] : free[0]; if (r) { free.splice(free.indexOf(r), 1); r.type = 'treasure'; r.cleared = true; r.sealed = true; } }
  else if (n >= 2 && chance(0.75)) { const c = list.filter(r => (r.type === 'treasure' || r.type === 'armory' || r.type === 'shop') && neighbors(r) === 1); if (c.length) pick(c).sealed = true; }
  const normals = shuffle(list.filter(r => r.type === 'normal'));
  if (n >= 3 && normals.length) normals.pop().puzzle = 'glyph';
  if (n >= 2 && normals.length && chance(0.8)) normals.pop().puzzle = 'alcove';
  boss.fissure = true;
  const sealedRoom = list.find(r => r.sealed);
  if (sealedRoom) { for (const [dx, dy] of DIRS) { const nb = rooms.get(key(sealedRoom.gx + dx, sealedRoom.gy + dy)); if (nb && nb !== boss) { nb.fissure = true; break; } } }
  const fisCand = shuffle(list.filter(r => r !== start && r !== boss && !r.sealed && !r.fissure));
  for (let i = 0; i < Math.min(sealedRoom ? 1 : 2, fisCand.length); i++) fisCand[i].fissure = true;
  for (const r of list) for (const [dx, dy] of DIRS) r.doors[dx + ',' + dy] = rooms.has(key(r.gx + dx, r.gy + dy));
  return { rooms, list, start, boss, key, biome: biomeFor(n) };
}

/* ---------- tuiles d'une salle ---------- */
function genTiles(room) {
  const biome = G.floorData.biome;
  const t = [];
  for (let y = 0; y < RH; y++) { t.push([]); for (let x = 0; x < RW; x++) t[y].push((x === 0 || y === 0 || x === RW - 1 || y === RH - 1) ? T_WALL : T_FLOOR); }
  const mx = (RW - 1) / 2 | 0, my = (RH - 1) / 2 | 0;
  const doorPos = { '0,-1': [mx, 0], '0,1': [mx, RH - 1], '-1,0': [0, my], '1,0': [RW - 1, my] };
  room.doorTiles = [];
  for (const k in doorPos) if (room.doors[k]) { const [x, y] = doorPos[k]; t[y][x] = room.cleared ? T_DOOR : T_DOORC; room.doorTiles.push({ x, y, dir: k }); }
  const onLane = (x, y) => x === mx || y === my;
  const nearCenter = (x, y) => Math.abs(x - mx) <= 2 && Math.abs(y - my) <= 2;
  const nearDoor = (x, y) => room.doorTiles.some(d => Math.abs(d.x - x) <= 1 && Math.abs(d.y - y) <= 1);
  const wall = (x, y) => { if (x > 0 && y > 0 && x < RW - 1 && y < RH - 1 && !nearCenter(x, y) && !nearDoor(x, y)) t[y][x] = T_WALL; };

  if (room.type === 'normal' || room.type === 'challenge') {
    room.template = pick(TEMPLATES);
    switch (room.template) {
      case 'pillars': for (let y = 3; y < RH - 2; y += 3) for (let x = 3; x < RW - 2; x += 4) if (!onLane(x, y)) wall(x, y); break;
      case 'cross': for (let i = 3; i < RW - 3; i++) if (Math.abs(i - mx) > 2 && i % 4 !== 0) wall(i, my - 3), wall(i, my + 3); break;
      case 'ring': for (let x = 5; x <= RW - 6; x++) { if (x !== mx && x !== mx - 1 && x !== mx + 1) { wall(x, 3); wall(x, RH - 4); } } for (let y = 4; y < RH - 4; y++) if (y !== my) { wall(5, y); wall(RW - 6, y); } break;
      case 'corridors': for (let x = 4; x < RW - 4; x += 5) for (let y = 2; y < RH - 2; y++) if (y !== my && y !== my - 1 && y !== my + 1 && !onLane(x, y)) wall(x, y); break;
      case 'islands': for (const [cx, cy] of [[4, 3], [RW - 5, 3], [4, RH - 4], [RW - 5, RH - 4]]) { wall(cx, cy); wall(cx + 1, cy); wall(cx, cy + 1); wall(cx + 1, cy + 1); } break;
      case 'random': {
        const n = RI(3, 6);
        for (let i = 0; i < n; i++) {
          const w = RI(1, 3), h = RI(1, 2), x = RI(2, RW - 3 - w), y = RI(2, RH - 3 - h);
          let ok = true;
          for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (onLane(xx, yy)) ok = false;
          if (ok) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) wall(xx, yy);
        }
        break;
      }
    }
    // dangers de terrain propres au biome
    if (biome.hazards.length && chance(0.75)) {
      const nb = RI(1, 3);
      for (let b = 0; b < nb; b++) {
        const hz = pick(biome.hazards);
        const code = { water: T_WATER, poison: T_POISON, lava: T_LAVA, ice: T_ICE, pit: T_PIT }[hz];
        const blocking = code === T_LAVA || code === T_PIT;
        let x = RI(2, RW - 3), y = RI(2, RH - 3);
        const len = code === T_ICE ? RI(10, 22) : RI(4, 11);
        for (let i = 0; i < len; i++) {
          if (t[y][x] === T_FLOOR && !nearCenter(x, y) && !nearDoor(x, y) && !(blocking && onLane(x, y))) t[y][x] = code;
          const d = pick(DIRS); x = clamp(x + d[0], 1, RW - 2); y = clamp(y + d[1], 1, RH - 2);
        }
      }
    }
  } else if (room.type === 'boss') {
    for (const [x, y] of [[3, 3], [RW - 4, 3], [3, RH - 4], [RW - 4, RH - 4]]) t[y][x] = T_WALL;
    if (biome.hazards.includes('lava')) for (const [x, y] of [[2, my], [RW - 3, my]]) t[y][x] = T_LAVA;
    if (biome.hazards.includes('ice')) for (let x = mx - 3; x <= mx + 3; x++) for (let y = my - 1; y <= my + 1; y++) t[y][x] = T_ICE;
    if (biome.hazards.includes('pit')) for (const [x, y] of [[6, 2], [RW - 7, 2], [6, RH - 3], [RW - 7, RH - 3]]) t[y][x] = T_PIT;
    if (biome.hazards.includes('water')) for (let x = 2; x < RW - 2; x++) { if (Math.abs(x - mx) > 4) { t[2][x] = T_WATER; t[RH - 3][x] = T_WATER; } }
  } else if (room.type === 'shop' || room.type === 'shrine' || room.type === 'armory' || room.type === 'treasure') {
    for (const [x, y] of [[mx - 4, my - 3], [mx + 4, my - 3], [mx - 4, my + 3], [mx + 4, my + 3]]) t[y][x] = T_WALL;
  }
  // accessibilité : tout ce qui n'est pas atteignable depuis le centre devient mur
  const seen = new Set(); const stack = [[mx, my]]; seen.add(mx + ',' + my);
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= RW || ny >= RH) continue;
      const k = nx + ',' + ny; if (seen.has(k)) continue;
      const v = t[ny][nx]; if (v === T_WALL || v === T_DOORC || v === T_DOOR) continue;
      seen.add(k); stack.push([nx, ny]);
    }
  }
  for (let y = 1; y < RH - 1; y++) for (let x = 1; x < RW - 1; x++) if (t[y][x] !== T_WALL && !seen.has(x + ',' + y)) t[y][x] = T_WALL;
  // torches sur les murs
  room.torches = [];
  for (const x of [3, 7, RW - 8, RW - 4]) if (t[0][x] === T_WALL) room.torches.push({ x: x * TILE + TILE / 2, y: TILE * 0.55, side: 'top' });
  for (const y of [3, RH - 4]) { room.torches.push({ x: TILE * 0.6, y: y * TILE + TILE / 2, side: 'left' }); room.torches.push({ x: (RW - 1) * TILE + TILE * 0.4, y: y * TILE + TILE / 2, side: 'right' }); }
  // énigmes de l'Envers
  if (room.puzzle === 'glyph') {
    const x0 = mx - 2, x1 = mx + 2;
    for (let y = 1; y < RH - 1; y++) for (let x = x0; x <= x1; x++) if (t[y][x] !== T_WALL) t[y][x] = T_PIT;
    let py = RI(2, RH - 3);
    for (let x = x0; x <= x1; x++) {
      t[py][x] = T_GLYPH;
      if (x < x1) { const ny = clamp(py + RI(-1, 1), 1, RH - 2); if (ny !== py) t[ny][x] = T_GLYPH; py = ny; }
    }
  } else if (room.puzzle === 'alcove') {
    const ax = RW - 6;
    for (let y = 1; y <= 2; y++) for (let x = ax; x <= ax + 2; x++) t[y][x] = T_FLOOR;
    for (let y = 1; y <= 3; y++) { t[y][ax - 1] = T_WALL; t[y][ax + 3] = T_WALL; }
    room.gate = [[ax, 3], [ax + 1, 3], [ax + 2, 3]]; room.gateOpen = false;
    for (const [x, y] of room.gate) t[y][x] = T_WALL;
    room.pocket = { x0: ax, x1: ax + 2, y0: 1, y1: 2 };
  }
  room.tiles = t; room.gen = true; room.cache = null;
  buildEnvers(room);
}

function setDoors(room, open) {
  const fd = G.floorData;
  for (const d of room.doorTiles) {
    const [dx, dy] = d.dir.split(',').map(Number);
    const nb = fd.rooms.get(fd.key(room.gx + dx, room.gy + dy));
    const sealed = (room.sealed && !room.visited) || (nb && nb.sealed && !nb.visited);
    if (G.world === 'envers') room.tilesE[d.y][d.x] = open ? T_DOOR : T_DOORC;
    else room.tiles[d.y][d.x] = sealed ? T_SEALED : open ? T_DOOR : T_DOORC;
  }
}

/* ---------- collisions ---------- */
function tileAt(x, y) {
  const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
  if (cx < 0 || cy < 0 || cx >= RW || cy >= RH) return T_WALL;
  return curTiles()[cy][cx];
}
// who : 'player' | 'ground' | 'fly' | 'bullet'
function solidFor(tx, ty, who) {
  if (tx < 0 || ty < 0 || tx >= RW || ty >= RH) return true;
  if (who === 'ghost') return tx === 0 || ty === 0 || tx === RW - 1 || ty === RH - 1;
  const v = curTiles()[ty][tx];
  if (v === T_WALL || v === T_DOORC || v === T_SEALED) return true;
  if (who === 'ground' && (v === T_PIT || v === T_LAVA || v === T_GLYPH)) return true;
  return false;
}
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
function hitsWall(x, y, r, who) {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++)
    if (solidFor(tx, ty, who) && circleRect(x, y, r, tx * TILE, ty * TILE, TILE, TILE)) return true;
  return false;
}
function moveCircle(e, dx, dy, who) {
  who = who || (e.reflet ? 'ghost' : e.fly ? 'fly' : 'ground');
  const res = { hx: false, hy: false };
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (TILE * 0.45)));
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (sx) { e.x += sx; if (hitsWall(e.x, e.y, e.r, who)) { e.x -= sx; res.hx = true; } }
    if (sy) { e.y += sy; if (hitsWall(e.x, e.y, e.r, who)) { e.y -= sy; res.hy = true; } }
  }
  return res;
}
// segment - cercle
function segCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((cx - x1) * dx + (cy - y1) * dy) / l2, 0, 1);
  return dist(x1 + dx * t, y1 + dy * t, cx, cy) < r;
}
function randomFloorTile(minDistFromPlayer, who) {
  for (let tries = 0; tries < 80; tries++) {
    const x = RI(1, RW - 2), y = RI(1, RH - 2);
    const v = curTiles()[y][x];
    if (v === T_WALL || v === T_DOOR || v === T_DOORC || v === T_SEALED || v === T_SHADOW) continue;
    if (who !== 'fly' && (v === T_PIT || v === T_LAVA || v === T_GLYPH)) continue;
    const wx = (x + 0.5) * TILE, wy = (y + 0.5) * TILE;
    if (P && dist(wx, wy, P.x, P.y) < minDistFromPlayer) continue;
    return { x: wx, y: wy };
  }
  return { x: RW * TILE / 2, y: RH * TILE / 2 };
}
