// render/particles.js — pool unique de particules (ARCHITECTURE.md § 7).
// Stockage en tableaux typés (SoA), slots denses avec swap-remove : aucune
// allocation après initParticles. Rendu : carrés pleins (fillRect, cohérents
// avec le pixel art) regroupés par couleur, ou sprites `echo` / `eclat_bronze`
// du manifeste pour les Échos et les éclats de bronze. Les braises ajoutent une
// lueur sur le calque screen.

import * as camera from './camera.js';
import * as atlas from './atlas.js';
import { addGlow } from './lighting.js';

// Palette DA (index = couleur). Aucune autre couleur n'est dessinée.
const PALETTE = ['#16130f', '#2a241c', '#4a5540', '#d8cdb4', '#c9973f', '#e0603a', '#8f8d93', '#f2e6c8'];
const SUIE = 0, TOURBE = 1, MOUSSE = 2, OS = 3, BRONZE = 4, BRAISE = 5, GRIS = 6, CLAIR = 7;
const KIND_SQUARE = 0, KIND_ECHO = 1, KIND_ECLAT = 2;
const NO_OPTS = Object.freeze({});
const TWO_PI = Math.PI * 2;

// Presets : count, vitesse min/max, vie min/max, taille min/max, gravité, traînée, couleurs, kind, glow, shrink.
const PRESETS = {
  hit:        { count: 6,  speed: [50, 120],  life: [0.2, 0.4],  size: [1, 2], gravity: 60,   drag: 2, colors: [OS, BRONZE, CLAIR], shrink: true },
  hit_big:    { count: 18, speed: [90, 220],  life: [0.35, 0.7], size: [2, 3], gravity: 90,   drag: 2, colors: [BRONZE, BRAISE, CLAIR], shrink: true, glow: true },
  dust:       { count: 4,  speed: [8, 24],    life: [0.4, 0.8],  size: [1, 2], gravity: -12,  drag: 1, colors: [TOURBE, GRIS, MOUSSE], shrink: true, up: true },
  ember:      { count: 3,  speed: [6, 22],    life: [0.9, 1.8],  size: [1, 2], gravity: -28,  drag: 0.5, colors: [BRAISE, BRONZE], glow: true, up: true },
  ash:        { count: 2,  speed: [4, 14],    life: [1.5, 3],    size: [1, 1], gravity: 10,   drag: 0.3, colors: [GRIS, OS] },
  silence:    { count: 10, speed: [20, 60],   life: [0.5, 0.9],  size: [2, 3], gravity: -20,  drag: 3, colors: [GRIS, SUIE, TOURBE], shrink: true },
  dash_trail: { count: 3,  speed: [4, 16],    life: [0.25, 0.4], size: [1, 2], gravity: 0,    drag: 4, colors: [BRONZE, OS], shrink: true },
  xp:         { count: 5,  speed: [40, 90],   life: [0.4, 0.6],  size: [1, 1], gravity: 120,  drag: 2, colors: [BRONZE], kind: KIND_ECHO },
  // Sonnerie (niveau, ramassage, exécution) : anneau d'éclats de bronze en carrés (le sprite
  // eclat_bronze est un lingot, trop lourd pour une gerbe : réservé au preset `lingot`).
  bell:       { count: 12, speed: [120, 170], life: [0.4, 0.6],  size: [2, 3], gravity: 0,    drag: 3, colors: [BRONZE, CLAIR], ring: true, glow: true, shrink: true },
  lingot:     { count: 3,  speed: [40, 90],   life: [0.5, 0.8],  size: [1, 1], gravity: 160,  drag: 1, colors: [BRONZE], kind: KIND_ECLAT, glow: true },
  parry:      { count: 14, speed: [90, 140],  life: [0.25, 0.4], size: [1, 2], gravity: 0,    drag: 4, colors: [OS, BRONZE, CLAIR], ring: true, shrink: true },
  // Coup de Battant : gerbe courte dans la direction du coup (opts.angle / spread).
  slash:      { count: 7,  speed: [70, 160],  life: [0.15, 0.3], size: [1, 2], gravity: 0,    drag: 5, colors: [BRONZE, CLAIR, OS], shrink: true, glow: true },
  // Étincelle chaude à la collecte d'un Écho : deux grains clairs/braise qui montent et luisent.
  echo_spark: { count: 2,  speed: [10, 30],    life: [0.25, 0.45], size: [1, 1], gravity: -24,  drag: 1, colors: [CLAIR, BRAISE], glow: true, up: true, shrink: true },
  // Traînée d'un Écho aimanté : un grain de bronze qui s'éteint sur place.
  echo_trail: { count: 1,  speed: [0, 6],     life: [0.2, 0.35], size: [1, 1], gravity: 0,    drag: 1, colors: [BRONZE, CLAIR], shrink: true },
};

let max = 0, count = 0, density = 1, seed = 12345;
let px, py, vx, vy, life, maxLife, size, gravity, drag, color, kind, flags;
const FLAG_SHRINK = 1, FLAG_GLOW = 2;
const MAX_GLOWS = 160;
const spriteOpts = { alpha: 1 };

// Aléatoire interne rapide (LCG) : les particules n'ont pas besoin de déterminisme.
function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

export function initParticles(maxCount = 4000) {
  max = maxCount; count = 0;
  px = new Float32Array(max); py = new Float32Array(max); vx = new Float32Array(max); vy = new Float32Array(max);
  life = new Float32Array(max); maxLife = new Float32Array(max); size = new Float32Array(max);
  gravity = new Float32Array(max); drag = new Float32Array(max);
  color = new Uint8Array(max); kind = new Uint8Array(max); flags = new Uint8Array(max);
}

/** Densité (option « particules », 0..1) : multiplie le nombre émis. */
export function setDensity(v) { density = Math.max(0, Math.min(1, +v || 0)); }
export function activeCount() { return count; }
export function clearParticles() { count = 0; }

/**
 * Émet un preset en (x, y). opts : count (multiplicateur), angle (rad, direction
 * privilégiée), spread (rad, défaut 2π), speedMul, color (index palette 0..7).
 */
export function emit(preset, x, y, opts = NO_OPTS) {
  const p = PRESETS[preset];
  if (!p || density <= 0) return;
  let n = Math.round(p.count * (opts.count || 1) * density);
  if (n < 1) n = 1;
  const spread = opts.spread === undefined ? TWO_PI : opts.spread;
  const baseAngle = opts.angle === undefined ? 0 : opts.angle;
  const speedMul = opts.speedMul || 1;
  const k = p.kind || KIND_SQUARE;
  const fl = (p.shrink ? FLAG_SHRINK : 0) | (p.glow ? FLAG_GLOW : 0);
  for (let j = 0; j < n; j++) {
    if (count >= max) return; // pool plein : on ignore (jamais d'éviction coûteuse)
    const i = count++;
    const ang = p.ring ? baseAngle + (j / n) * TWO_PI : baseAngle + (rnd() - 0.5) * spread;
    const sp = (p.speed[0] + rnd() * (p.speed[1] - p.speed[0])) * speedMul;
    px[i] = x; py[i] = y;
    vx[i] = Math.cos(ang) * sp;
    vy[i] = p.up ? -Math.abs(Math.sin(ang) * sp) - sp * 0.3 : Math.sin(ang) * sp * (p.ring ? 0.55 : 1);
    maxLife[i] = life[i] = p.life[0] + rnd() * (p.life[1] - p.life[0]);
    size[i] = p.size[0] + rnd() * (p.size[1] - p.size[0]);
    gravity[i] = p.gravity; drag[i] = p.drag;
    color[i] = opts.color === undefined ? p.colors[(rnd() * p.colors.length) | 0] : opts.color;
    kind[i] = k; flags[i] = fl;
  }
}

/** Intègre les particules (dt logique : gelées pendant un hit-stop). */
export function updateParticles(dt) {
  if (dt <= 0) return;
  for (let i = count - 1; i >= 0; i--) {
    life[i] -= dt;
    if (life[i] <= 0) { // swap-remove
      const l = --count;
      if (i !== l) {
        px[i] = px[l]; py[i] = py[l]; vx[i] = vx[l]; vy[i] = vy[l]; life[i] = life[l]; maxLife[i] = maxLife[l];
        size[i] = size[l]; gravity[i] = gravity[l]; drag[i] = drag[l]; color[i] = color[l]; kind[i] = kind[l]; flags[i] = flags[l];
      }
      continue;
    }
    const d = 1 - drag[i] * dt;
    vx[i] *= d; vy[i] = vy[i] * d + gravity[i] * dt;
    px[i] += vx[i] * dt; py[i] += vy[i] * dt;
  }
}

/** Dessine (ctx caméra). Carrés par couleur, puis sprites, puis lueurs. */
export function renderParticles(ctx, alpha) {
  const view = camera.viewRect();
  const x0 = view.x - 4, y0 = view.y - 4, x1 = view.x + view.w + 4, y1 = view.y + view.h + 4;
  let hasSprites = false, hasGlow = false;
  for (let c = 0; c < PALETTE.length; c++) {
    let used = false;
    for (let i = 0; i < count; i++) {
      if (color[i] !== c || kind[i] !== KIND_SQUARE) { if (kind[i] !== KIND_SQUARE) hasSprites = true; continue; }
      const x = px[i], y = py[i];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      if (!used) { ctx.fillStyle = PALETTE[c]; used = true; }
      const t = life[i] / maxLife[i];
      let s = size[i];
      if (flags[i] & FLAG_SHRINK) s *= 0.4 + 0.6 * t;
      if (flags[i] & FLAG_GLOW) hasGlow = true;
      ctx.globalAlpha = t < 0.5 ? t * 2 : 1;
      const si = s < 1 ? 1 : Math.round(s);
      ctx.fillRect(Math.round(x - si / 2), Math.round(y - si / 2), si, si);
    }
  }
  ctx.globalAlpha = 1;
  if (hasSprites) {
    for (let i = 0; i < count; i++) {
      if (kind[i] === KIND_SQUARE) continue;
      const x = px[i], y = py[i];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const t = life[i] / maxLife[i];
      spriteOpts.alpha = t < 0.5 ? t * 2 : 1;
      if (kind[i] === KIND_ECHO) atlas.draw(ctx, 'echo', 'small', 0, x, y, spriteOpts);
      else atlas.draw(ctx, 'eclat_bronze', 'idle', (t * 8) | 0, x, y, spriteOpts);
      if (flags[i] & FLAG_GLOW) hasGlow = true;
    }
  }
  if (hasGlow) {
    let budget = MAX_GLOWS; // les lueurs sont additives : au-delà, elles saturent en blanc et coûtent cher
    for (let i = 0; i < count && budget > 0; i++) {
      if (!(flags[i] & FLAG_GLOW)) continue;
      const x = px[i], y = py[i];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      addGlow(x, y, 2 + size[i], PALETTE[color[i]], 0.22 * (life[i] / maxLife[i]));
      budget--;
    }
  }
}

/** Index de palette par nom DA ('suie','tourbe','mousse','os','bronze','braise','gris','clair'). */
export const COLOR = Object.freeze({ suie: SUIE, tourbe: TOURBE, mousse: MOUSSE, os: OS, bronze: BRONZE, braise: BRAISE, gris: GRIS, clair: CLAIR });
export function presetNames() { return Object.keys(PRESETS); }
