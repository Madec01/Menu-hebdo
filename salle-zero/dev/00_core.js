/* =========================================================================
   SALLE ZÉRO — 00_core.js
   Constantes, utilitaires, PRNG seedable, Input, Time, Engine (boucle à pas fixe).
   ========================================================================= */
'use strict';

const W = 1280, H = 720;            // résolution logique
const TILE = 48;                    // tuile en px (sprites 16 px rendus ×3)
const ROOM_COLS = 24, ROOM_ROWS = 13;
const ROOM_X = (W - ROOM_COLS * TILE) / 2;   // 64
const ROOM_Y = (H - ROOM_ROWS * TILE) / 2;   // 48
const ROOM_W = ROOM_COLS * TILE, ROOM_H = ROOM_ROWS * TILE;
const FIXED_DT = 1 / 60;

const RARITY = {
  common:   { label: 'Commun',   color: '#cfd6e6', glow: 'rgba(207,214,230,.35)', weight: 60 },
  rare:     { label: 'Rare',     color: '#4fb3ff', glow: 'rgba(79,179,255,.45)',  weight: 27 },
  epic:     { label: 'Épique',   color: '#b46bff', glow: 'rgba(180,107,255,.5)',  weight: 10 },
  colossal: { label: 'Colossal', color: '#ffb347', glow: 'rgba(255,179,71,.6)',   weight: 3 },
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'colossal'];

const ROOM_TYPES = {
  PREP_COMBAT: { label: 'Préparation + Combat', phase: 1 },
  TRAP: { label: 'Pièges', phase: 1 },
  COMBAT_TRAP: { label: 'Combat + Pièges', phase: 1 },
  CHEST: { label: 'Coffre', phase: 1 },
  MINIBOSS: { label: 'Mini-boss', phase: 1 },
  COMBAT_MODULAR: { label: 'Combat + Modulaire', phase: 2 },
  COMBAT_TRAP_MODULAR: { label: 'Combat + Pièges + Modulaire', phase: 2 },
  CHEST_FINAL: { label: 'Coffre final', phase: 2 },
  BOSS_REVENGE: { label: 'Boss (revanche)', phase: 2 },
};

/* ---------- Utilitaires ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const TAU = Math.PI * 2;
const wrapAngle = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const tileX = tx => ROOM_X + (tx + 0.5) * TILE;   // centre de la tuile en px
const tileY = ty => ROOM_Y + (ty + 0.5) * TILE;
const deepClone = o => JSON.parse(JSON.stringify(o));
const fmt = n => Math.round(n).toLocaleString('fr-FR');
const pct = n => `${n >= 0 ? '+' : ''}${Math.round(n * 100)} %`;

/* Cercle vs AABB */
function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
/* Segment (ax,ay)-(bx,by) vs cercle */
function segCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
  const px = ax + dx * t, py = ay + dy * t;
  return (px - cx) ** 2 + (py - cy) ** 2 < r * r;
}

/* ---------- PRNG seedable (mulberry32) ---------- */
function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  const rng = () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  rng.range = (a, b) => a + rng() * (b - a);
  rng.int = (a, b) => Math.floor(rng.range(a, b + 1));
  rng.pick = arr => arr[Math.floor(rng() * arr.length)];
  rng.chance = p => rng() < p;
  rng.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  rng.reseed = v => { s = (v >>> 0) || 1; };
  return rng;
}
const RNG = makeRng(Date.now() & 0xffffffff);   // RNG de gameplay (reseedé par __autoplay)
const VFX_RNG = makeRng(1234);                 // RNG cosmétique, jamais reseedé

/* ---------- Chaînes UI (français, centralisées) ---------- */
const STR = {
  room: 'Salle', level: 'Niveau', xp: 'XP', hp: 'PV', coins: 'Crédits', quality: 'Qualité',
  chooseWeapon: 'Choisis ton arme', chooseSkill: 'Choisis une compétence', enter: 'Entrer',
  levelUp: 'Montée de niveau', pick: 'Choisir', chest: 'Réserve de greffes', continue: 'Continuer',
  paused: 'Pause', resume: 'Reprendre', quit: 'Abandonner la run', dead: 'Sujet perdu',
  toHub: 'Retour au hub', victory: 'Protocole terminé', pending: 'en attente',
  wave: 'Vague', boss: 'Mini-boss', ready: 'Prêt', interact: 'E : interagir',
};

/* ---------- Time ---------- */
const Time = { scale: 1, slow: 1, slowUntil: 0, now: 0, frame: 0 };

/* ---------- Input ---------- */
const Input = (() => {
  const keys = new Set(), pressed = new Set();
  const mouse = { x: W / 2, y: H / 2, down: false, right: false, moved: 0 };
  let canvas = null, scale = 1, offX = 0, offY = 0;
  const KEYMAP = {
    up: ['KeyW', 'KeyZ', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'KeyQ', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    skill: ['Space', 'ShiftLeft', 'ShiftRight'], interact: ['KeyE', 'KeyF', 'Enter'], pause: ['Escape', 'KeyP'], debug: ['F1'],
    fire: ['KeyJ', 'KeyK'], mouse2: ['Mouse2'],
  };
  function attach(c, onFirstInteraction) {
    canvas = c;
    let first = false;
    const firstInt = () => { if (!first) { first = true; onFirstInteraction && onFirstInteraction(); } };
    window.addEventListener('keydown', e => {
      firstInt();
      if (e.code === 'F1' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!keys.has(e.code)) pressed.add(e.code);
      keys.add(e.code);
    });
    window.addEventListener('keyup', e => keys.delete(e.code));
    window.addEventListener('blur', () => { keys.clear(); mouse.down = false; mouse.right = false; });
    const toLogical = e => { const r = canvas.getBoundingClientRect(); mouse.x = clamp((e.clientX - r.left) / scale, 0, W); mouse.y = clamp((e.clientY - r.top) / scale, 0, H); mouse.moved = Time.now; };
    canvas.addEventListener('mousemove', toLogical);
    canvas.addEventListener('mousedown', e => { firstInt(); toLogical(e); if (e.button === 0) mouse.down = true; if (e.button === 2) { mouse.right = true; pressed.add('Mouse2'); } });
    window.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.right = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  function setScale(s, ox, oy) { scale = s; offX = ox; offY = oy; }
  const isDown = action => KEYMAP[action].some(k => keys.has(k));
  const wasPressed = action => KEYMAP[action].some(k => pressed.has(k));
  function axis() {
    let x = (isDown('right') ? 1 : 0) - (isDown('left') ? 1 : 0);
    let y = (isDown('down') ? 1 : 0) - (isDown('up') ? 1 : 0);
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }
  /* Gamepad : abstraction prévue, non branchée en phase 1. */
  function endFrame() { pressed.clear(); }
  return { attach, setScale, isDown, wasPressed, axis, mouse, endFrame, keys };
})();

/* ---------- Engine : canvas, boucle à pas fixe ---------- */
const Engine = (() => {
  let canvas, ctx, acc = 0, last = 0, running = false, rafId = 0;
  let updateFn = () => {}, renderFn = () => {};
  const stats = { fps: 0, frames: 0, fpsT: 0, steps: 0 };
  let maxStepsPerFrame = 8;
  let headless = false;   // rendu désactivé (autoplay)

  function init(c) {
    canvas = c; ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    resize(); window.addEventListener('resize', resize);
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const cw = Math.floor(W * s), ch = Math.floor(H * s);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    canvas.style.left = Math.floor((window.innerWidth - cw) / 2) + 'px';
    canvas.style.top = Math.floor((window.innerHeight - ch) / 2) + 'px';
    canvas.width = Math.floor(W * dpr * s); canvas.height = Math.floor(H * dpr * s);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    ctx.imageSmoothingEnabled = false;
    Input.setScale(s, 0, 0);
    document.documentElement.style.setProperty('--ui-scale', s.toFixed(3));
    const ui = document.getElementById('ui');
    if (ui) { ui.style.width = cw + 'px'; ui.style.height = ch + 'px'; ui.style.left = canvas.style.left; ui.style.top = canvas.style.top; }
  }
  function loop(t) {
    rafId = requestAnimationFrame(loop);
    if (!last) last = t;
    let frameDt = Math.min((t - last) / 1000, 0.25); last = t;
    stats.frames++; stats.fpsT += frameDt; if (stats.fpsT >= 0.5) { stats.fps = Math.round(stats.frames / stats.fpsT); stats.frames = 0; stats.fpsT = 0; }
    acc += frameDt * Time.scale;
    let steps = 0;
    while (acc >= FIXED_DT && steps < maxStepsPerFrame) {
      const slow = Time.now < Time.slowUntil ? Time.slow : 1;
      updateFn(FIXED_DT * slow, FIXED_DT);
      Time.now += FIXED_DT; Time.frame++;
      acc -= FIXED_DT; steps++;
    }
    if (steps === maxStepsPerFrame) acc = 0;
    stats.steps = steps;
    if (!headless) renderFn(ctx, acc / FIXED_DT);
    Input.endFrame();
  }
  function start(u, r) { updateFn = u; renderFn = r; if (!running) { running = true; last = 0; rafId = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(rafId); }
  function setHeadless(h) { headless = h; maxStepsPerFrame = h ? 400 : 8; }
  return { init, start, stop, stats, get ctx() { return ctx; }, get canvas() { return canvas; }, setHeadless };
})();
