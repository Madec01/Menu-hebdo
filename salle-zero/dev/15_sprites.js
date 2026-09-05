/* =========================================================================
   SALLE ZÉRO — 15_sprites.js
   Sprites (0x72 Dungeon Tileset II, CC0) avec fallback Canvas marqué TODO_SPRITE ; sol/murs ; musique.
   ========================================================================= */

const ASSET_BASE = 'assets/';
const SHEET_URL = ASSET_BASE + 'sprites/0x72_dungeon_tileset_ii/0x72_DungeonTilesetII_v1.4.png';
const SCALE = 3;
/* Coordonnées (voir ASSETS.md §5.2). idle/run : x y w h, 4 frames à droite. */
const SPRITE_DEFS = {
  player:          { idle: [128, 100, 16, 28], run: [192, 100, 16, 28], hit: [256, 100, 16, 28], n: 4, foot: true },
  player2:         { idle: [128, 36, 16, 28],  run: [192, 36, 16, 28],  hit: [256, 36, 16, 28],  n: 4, foot: true },
  enemy_rusher:    { idle: [368, 48, 16, 16],  run: [432, 48, 16, 16],  n: 4 },
  enemy_shooter:   { idle: [368, 236, 16, 20], run: [432, 236, 16, 20], n: 4 },
  enemy_tank:      { idle: [368, 172, 16, 20], run: [432, 172, 16, 20], n: 4 },
  enemy_kamikaze:  { idle: [368, 16, 16, 16],  run: [432, 16, 16, 16],  n: 4 },
  enemy_summoner:  { idle: [368, 268, 16, 20], run: [368, 268, 16, 20], n: 4 },
  enemy_swarm:     { idle: [432, 112, 16, 16], run: [432, 112, 16, 16], n: 4 },
  enemy_dasher:    { idle: [368, 32, 16, 16],  run: [432, 32, 16, 16],  n: 4 },
  boss:            { idle: [16, 364, 32, 36],  run: [144, 364, 32, 36], n: 4, foot: true },
  chest:           { idle: [304, 304, 16, 16], run: [304, 304, 16, 16], n: 3 },
  coin:            { idle: [288, 272, 8, 8],   run: [288, 272, 8, 8],   n: 4 },
  npc_doc:         { idle: [128, 100, 16, 28], run: [128, 100, 16, 28], n: 4, foot: true },
};
const TILES = { floor: [[16, 64], [32, 64], [48, 64], [16, 80], [32, 80], [48, 80], [16, 96], [32, 96]], wallTop: [32, 0], wallFace: [32, 16], wallLeft: [0, 128], wallRight: [16, 128], cornerTL: [32, 112], cornerTR: [48, 112], cornerBL: [32, 144], cornerBR: [48, 144], column: [[80, 80], [80, 96], [80, 112]], banner: [32, 32], hole: [48, 32], goo: [64, 80] };

const Sprites = (() => {
  let sheet = null, ready = false, failed = false; const floorCache = new Map();
  function load() {
    return new Promise(res => {
      sheet = new Image();
      sheet.onload = () => { ready = true; res(true); };
      sheet.onerror = () => { failed = true; console.warn('[Sprites] spritesheet indisponible, placeholders TODO_SPRITE'); res(false); };
      sheet.src = SHEET_URL;
    });
  }
  /* dessine un sprite nommé centré en (x, y) ; opts : flip, walk (temps de marche, anim run si > 0), flash, scale, fallback() */
  function draw(ctx, key, x, y, opts = {}) {
    const d = SPRITE_DEFS[key];
    if (!ready || !d) { if (opts.fallback) opts.fallback(); return false; }   // TODO_SPRITE : fallback Canvas
    const moving = opts.walk != null && opts.walk > 0 && (opts.walkFrame == null); const set = opts.flash && d.hit ? d.hit : (moving ? d.run : d.idle);
    const frame = opts.flash && d.hit ? 0 : Math.floor(((opts.walk != null ? opts.walk : Time.now) * (moving ? 10 : 6)) % d.n);
    const [sx, sy, sw, sh] = set; const s = SCALE * (opts.scale || 1); const dw = sw * s, dh = sh * s;
    const oy = d.foot ? dh / 2 - 14 * (opts.scale || 1) * 1 : 0;   // ancrage au pied : le corps déborde vers le haut
    ctx.save(); ctx.translate(x, y - (d.foot ? oy * 0.5 : 0)); if (opts.flip) ctx.scale(-1, 1);
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(sheet, sx + frame * sw, sy, sw, sh, -dw / 2, -dh / 2 - (d.foot ? 8 : 0), dw, dh);
    if (opts.flash) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(-dw / 2, -dh / 2 - (d.foot ? 8 : 0), dw, dh); }
    ctx.restore(); return true;
  }
  function tile(ctx, t, dx, dy, w = TILE, h = TILE) { if (!ready) return false; ctx.drawImage(sheet, t[0], t[1], 16, 16, dx, dy, w, h); return true; }
  /* sol + murs, mis en cache par salle dans un canvas hors écran */
  function drawFloor(ctx, room) {
    let c = floorCache.get(room.floorSeed);
    if (!c) {
      c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      const rng = makeRng(room.floorSeed);
      g.fillStyle = '#07080d'; g.fillRect(0, 0, W, H);
      for (let ty = 0; ty < ROOM_ROWS; ty++) for (let tx = 0; tx < ROOM_COLS; tx++) {
        const x = ROOM_X + tx * TILE, y = ROOM_Y + ty * TILE;
        if (!tile(g, rng.chance(0.75) ? TILES.floor[0] : rng.pick(TILES.floor), x, y)) { g.fillStyle = (tx + ty) % 2 ? '#141826' : '#161b2b'; g.fillRect(x, y, TILE, TILE); }
      }
      /* teinte froide (labo) + vignette */
      g.fillStyle = 'rgba(40,70,110,.28)'; g.fillRect(ROOM_X, ROOM_Y, ROOM_W, ROOM_H);
      const v = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 760); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = v; g.fillRect(ROOM_X, ROOM_Y, ROOM_W, ROOM_H);
      /* grille discrète */
      g.strokeStyle = 'rgba(110,231,255,.06)'; g.lineWidth = 1; for (let tx = 0; tx <= ROOM_COLS; tx++) { g.beginPath(); g.moveTo(ROOM_X + tx * TILE, ROOM_Y); g.lineTo(ROOM_X + tx * TILE, ROOM_Y + ROOM_H); g.stroke(); } for (let ty = 0; ty <= ROOM_ROWS; ty++) { g.beginPath(); g.moveTo(ROOM_X, ROOM_Y + ty * TILE); g.lineTo(ROOM_X + ROOM_W, ROOM_Y + ty * TILE); g.stroke(); }
      /* murs */
      for (let tx = -1; tx <= ROOM_COLS; tx++) { const x = ROOM_X + tx * TILE; if (!tile(g, TILES.wallFace, x, ROOM_Y - TILE)) { g.fillStyle = '#232a44'; g.fillRect(x, ROOM_Y - TILE, TILE, TILE); } if (!tile(g, TILES.wallTop, x, ROOM_Y + ROOM_H)) { g.fillStyle = '#1a2036'; g.fillRect(x, ROOM_Y + ROOM_H, TILE, TILE); } }
      for (let ty = 0; ty < ROOM_ROWS; ty++) { const y = ROOM_Y + ty * TILE; if (!tile(g, TILES.wallLeft, ROOM_X - TILE, y)) { g.fillStyle = '#1a2036'; g.fillRect(ROOM_X - TILE, y, TILE, TILE); } if (!tile(g, TILES.wallRight, ROOM_X + ROOM_W, y)) { g.fillStyle = '#1a2036'; g.fillRect(ROOM_X + ROOM_W, y, TILE, TILE); } }
      g.fillStyle = 'rgba(40,70,110,.35)'; g.fillRect(ROOM_X - TILE, ROOM_Y - TILE, ROOM_W + 2 * TILE, TILE); g.fillRect(ROOM_X - TILE, ROOM_Y + ROOM_H, ROOM_W + 2 * TILE, TILE); g.fillRect(ROOM_X - TILE, ROOM_Y, TILE, ROOM_H); g.fillRect(ROOM_X + ROOM_W, ROOM_Y, TILE, ROOM_H);
      /* néons sur le mur du haut */
      for (let i = 0; i < 5; i++) { const x = ROOM_X + (i + 0.5) * ROOM_W / 5; g.fillStyle = i % 2 ? '#6ee7ff' : '#ff9a3c'; g.shadowColor = g.fillStyle; g.shadowBlur = 16; g.fillRect(x - 30, ROOM_Y - 8, 60, 3); g.shadowBlur = 0; }
      g.strokeStyle = 'rgba(110,231,255,.35)'; g.lineWidth = 2; g.strokeRect(ROOM_X - 1, ROOM_Y - 1, ROOM_W + 2, ROOM_H + 2);
      floorCache.set(room.floorSeed, c); if (floorCache.size > 12) floorCache.delete(floorCache.keys().next().value);
    }
    ctx.drawImage(c, 0, 0);
  }
  function drawBlock(ctx, o) {
    ctx.save();
    for (let ty = 0; ty < o.h; ty++) for (let tx = 0; tx < o.w; tx++) {
      const x = o.px + tx * TILE, y = o.py + ty * TILE;
      const t = o.h > 1 ? (ty === 0 ? TILES.column[0] : ty === o.h - 1 ? TILES.column[2] : TILES.column[1]) : TILES.column[2];
      if (!tile(ctx, t, x, y)) { ctx.fillStyle = '#2b3350'; ctx.fillRect(x, y, TILE, TILE); ctx.strokeStyle = '#6ee7ff55'; ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2); }
    }
    ctx.fillStyle = 'rgba(40,70,110,.25)'; ctx.fillRect(o.px, o.py, o.pw, o.ph);
    ctx.strokeStyle = 'rgba(110,231,255,.3)'; ctx.lineWidth = 1; ctx.strokeRect(o.px + 0.5, o.py + 0.5, o.pw - 1, o.ph - 1);
    ctx.restore();
  }
  function drawChest(ctx, ch) {
    ctx.save(); const near = ch.near && !ch.opened;
    ctx.shadowColor = '#ffb347'; ctx.shadowBlur = near ? 26 + Math.sin(Time.now * 6) * 8 : 12;
    const d = SPRITE_DEFS.chest;
    if (ready) { const f = ch.opened ? 2 : 0; ctx.drawImage(sheet, d.idle[0] + f * 16, d.idle[1], 16, 16, ch.x - 24, ch.y - 24, 48, 48); }
    else { ctx.fillStyle = ch.opened ? '#5a4a2a' : '#b8862b'; ctx.fillRect(ch.x - 22, ch.y - 16, 44, 32); ctx.fillStyle = '#ffd166'; ctx.fillRect(ch.x - 4, ch.y - 4, 8, 8); } // TODO_SPRITE
    ctx.shadowBlur = 0;
    if (near) { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(STR.interact, ch.x, ch.y - 36); }
    ctx.restore();
  }
  return { load, draw, tile, drawFloor, drawBlock, drawChest, get ready() { return ready; }, get failed() { return failed; } };
})();

/* ---------- Musique : pistes CC-BY (voir CREDITS.md), fallback génératif ---------- */
const Music = (() => {
  const TRACKS = { hub: ASSET_BASE + 'music/hub_basement_floor.mp3', biome: ASSET_BASE + 'music/biome1_latin_industries.mp3', boss: ASSET_BASE + 'music/boss_in_a_heartbeat.mp3' };
  let current = null, generative = false, enabled = true;
  function play(key) {
    if (!enabled || current === key) return; current = key;
    if (!AudioEngine.isReady || !AudioEngine.isReady()) return;
    const p = AudioEngine.playMusic(TRACKS[key], { fadeIn: 1.2, fadeOut: 1.2, loop: true });
    if (p && p.then) p.then(ok => { if (!ok && current === key) { generative = true; AudioEngine.startGenerativeMusic(key === 'boss' ? 'boss' : key === 'hub' ? 'hub' : 'biome'); } });
  }
  function stop() { current = null; AudioEngine.stopMusic && AudioEngine.stopMusic(1); AudioEngine.stopGenerativeMusic && AudioEngine.stopGenerativeMusic(1); }
  function setEnabled(v) { enabled = v; if (!v) stop(); }
  function restart() { const k = current; current = null; if (k) play(k); }
  return { play, stop, setEnabled, restart, get current() { return current; }, TRACKS };
})();
