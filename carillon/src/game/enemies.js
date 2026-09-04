// game/enemies.js — pool d'ennemis, spawn, mise à jour commune (séparation, recul, flash, mort),
// rendu (ARCHITECTURE.md § 11). Les comportements (chase, leap, explode, ranged, swarm, crawl,
// veuve_grise, summon) sont dans enemy-behaviors.js ; le boss est délégué à boss.js.
// PV mis à l'échelle par palier de Sourdine (balance.enemyHp). Mort → particules `deathParticles`,
// Écho (pickups.dropFor), `enemy:death`. `player:inAura` est émis une fois par tick avec la
// profondeur maximale accumulée par les Feutres.

import { bus } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { play as playSfx } from '../audio/sfx.js';
import { draw, drawShadow, frameAt, animDone, dirAnim, isDirectional } from '../render/atlas.js';
import { addLight, addGlow } from '../render/lighting.js';
import { emit as emitParticles } from '../render/particles.js';
import { enemyDef, balance } from './data.js';
import { BEHAVIORS as AI } from './enemy-behaviors.js';
import { updateBossEnemy } from './boss.js';
import { dropFor } from './pickups.js';

let nextId = 1;
const spawnPayload = { kind: '', id: 0 };
const deathPayload = { id: 0, kind: '', x: 0, y: 0, boss: false };
const auraPayload = { depth: 0 };

function factory() {
  return {
    id: 0, kind: '', def: null, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 12, mass: 1,
    hp: 1, maxHp: 1, speed: 0, damage: 0, xp: 0, state: 'alive', stateT: 0,
    anim: 'walk', animT: 0, animBase: 'walk', dirX: 0, dirY: 1, moving: false,
    flashT: 0, kx: 0, ky: 0, slow: 1, slowT: 0, contactT: 0, markedT: 0, markBonus: 0, markBy: '', executeBelow: 0,
    aiT: 0, aiState: 0, aiX: 0, aiY: 0, aiBeat: 0, lastBar: -1, boss: false, elite: false, scale: 1,
    phase: 0, hitById: 0, spawnT: 0, silenceWave: 0, tint: null, _gridStamp: 0, _gridStamp1: 0, _gridStamp2: 0, _gridStamp3: 0, killedBy: '', vulnMult: 1,
  };
}

function reset(e) {
  e.vulnMult = 1;
  e.id = nextId++; e.state = 'alive'; e.stateT = 0; e.animT = 0; e.anim = 'walk'; e.animBase = 'walk';
  e.flashT = 0; e.kx = 0; e.ky = 0; e.slow = 1; e.slowT = 0; e.contactT = 0; e.markedT = 0; e.markBonus = 0; e.markBy = '';
  e.executeBelow = 0; e.aiT = 0; e.aiState = 0; e.aiX = 0; e.aiY = 0; e.aiBeat = 0; e.lastBar = -1; e.phase = 0;
  e.vx = 0; e.vy = 0; e.dirX = 0; e.dirY = 1; e.moving = false; e.spawnT = 0; e.killedBy = ''; e.tint = null;
}

export function createEnemyPool() { return createPool(factory, reset, 200); }

/** Multiplicateur de PV du palier courant. */
export function hpScale(world) { return Math.pow(balance().enemyHp.perTier, Math.max(0, world.tier - 1)); }

/** Fait apparaître un ennemi de type `kind` en (x, y). Renvoie l'ennemi (ou null si cap atteint). */
export function spawnEnemy(world, kind, x, y) {
  const def = enemyDef(kind);
  if (!def) { console.warn('[enemies] type inconnu', kind); return null; }
  if (world.enemies.active >= balance().spawn.globalCap && !def.boss && !def.elite) return null;
  const e = world.enemies.acquire();
  const S = balance().enemyHp;
  const t = def.boss ? 0 : Math.max(0, world.tier - 1); // boss : ni PV ni dégâts au palier ; élites : les deux
  e.kind = kind; e.def = def; e.x = x; e.y = y; e.px = x; e.py = y; e.r = def.radius; e.mass = def.mass;
  e.maxHp = Math.round(def.hp * Math.pow(S.perTier, t));
  e.hp = e.maxHp;
  e.speed = def.speed * Math.pow(S.speedPerTier, t);
  e.damage = Math.round(def.damage * Math.pow(S.damagePerTier, t));
  e.xp = def.xp; e.boss = !!def.boss; e.elite = !!def.elite; e.scale = def.scale || 1;
  e.tint = def.elite ? '#c9973f' : null;
  e.aiBeat = world.beat;
  world.spawned++;
  spawnPayload.kind = kind; spawnPayload.id = e.id;
  bus.emit('enemy:spawn', spawnPayload);
  return e;
}

// Séparation entre ennemis via la grille (aucune closure par tick : contexte de module).
let sep = null, sepForce = 0;
function separate(o) {
  if (o === sep || o.state !== 'alive') return;
  const dx = sep.x - o.x, dy = sep.y - o.y;
  const min = sep.r + o.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min || d2 === 0) return;
  const d = Math.sqrt(d2);
  const push = (min - d) / d * sepForce * (o.mass / (o.mass + sep.mass));
  sep.vx += dx * push; sep.vy += dy * push;
}

/** Tick logique de tous les ennemis. */
export function updateEnemies(world, dt, p) {
  const C = balance().combat;
  const items = world.enemies.items;
  world.auraDepth = 0;
  sepForce = C.separationForce * dt;
  for (let i = items.length - 1; i >= 0; i--) {
    const e = items[i];
    e.px = e.x; e.py = e.y;
    if (e.state === 'dying') {
      e.stateT += dt; e.animT += dt;
      if (animDone(e.def.sprite, e.anim, e.animT) || e.stateT > 1.2) world.enemies.release(e);
      continue;
    }
    e.spawnT += dt;
    if (e.flashT > 0) e.flashT -= dt;
    if (e.contactT > 0) e.contactT -= dt;
    if (e.markedT > 0) { e.markedT -= dt; if (e.markedT <= 0) e.markBonus = 0; }
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 1; }
    e.vx = 0; e.vy = 0;
    if (e.boss) updateBossEnemy(e, dt, world, p);
    else AI[e.def.behavior](e, dt, world, p);
    if (!e.boss) { sep = e; world.grid.query(e.x, e.y, e.r + 24, separate); }
    // Recul (friction exponentielle) + vitesse de comportement.
    const f = Math.exp(-C.knockFriction * dt);
    e.kx *= f; e.ky *= f;
    e.x += (e.vx * e.slow + e.kx) * dt; e.y += (e.vy * e.slow + e.ky) * dt;
    e.moving = e.vx !== 0 || e.vy !== 0;
    if (e.moving) { const l = Math.hypot(e.vx, e.vy); e.dirX = e.vx / l; e.dirY = e.vy / l; }
    if (e.hp <= 0 && e.state === 'alive') killEnemy(world, e, e.killedBy);
    else updateAnim(e, dt);
  }
  auraPayload.depth = Math.min(1, world.auraDepth);
  if (auraPayload.depth > 0 || world.auraWasIn) bus.emit('player:inAura', auraPayload);
  world.auraWasIn = auraPayload.depth > 0;
}

function updateAnim(e, dt) {
  const base = e.animBase;
  const name = dirAnim(e.def.sprite, base, e.dirX, e.dirY);
  if (name !== e.anim) { e.anim = name; e.animT = 0; } else e.animT += dt;
  if (base === 'attack' && animDone(e.def.sprite, e.anim, e.animT)) e.animBase = 'walk';
}

/** Tue un ennemi : anim de mort, particules, Écho, événement. */
export function killEnemy(world, e, source = '') {
  if (e.state !== 'alive') return;
  e.state = 'dying'; e.stateT = 0; e.hp = 0;
  e.animBase = 'die'; e.anim = dirAnim(e.def.sprite, 'die', e.dirX, e.dirY); e.animT = 0;
  emitParticles(e.def.deathParticles || 'silence', e.x, e.y - 8);
  playSfx(e.boss || e.elite ? 'enemy_die_big' : 'enemy_die', { x: e.x, y: e.y });
  world.kills++;
  world.killsByKind[e.kind] = (world.killsByKind[e.kind] || 0) + 1;
  dropFor(world, e);
  deathPayload.id = e.id; deathPayload.kind = e.kind; deathPayload.x = e.x; deathPayload.y = e.y; deathPayload.boss = e.boss;
  bus.emit('enemy:death', deathPayload);
}

/** Nombre d'ennemis vivants de ce type. */
export function countKind(world, kind) {
  let n = 0;
  const items = world.enemies.items;
  for (let i = 0; i < items.length; i++) if (items[i].kind === kind && items[i].state === 'alive') n++;
  return n;
}

const drawOpts = { flipX: false, alpha: 1, tint: null, scale: 1 };
// Lueur froide portée par chaque ennemi vivant (gris-bleu désaturé) : la silhouette se détache
// de la nuit en approche ; addLight fait le culling hors écran.
const COLD_LIGHT = '#6a6e7c';

/** Dessine un ennemi (appelé par world.js dans l'ordre trié par y). */
export function drawEnemy(ctx, e, alpha) {
  const x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
  const sprite = e.def.sprite;
  const dying = e.state === 'dying';
  drawShadow(ctx, sprite, x, y, dying ? 0.4 : 0.8);
  drawOpts.scale = e.scale;
  drawOpts.alpha = dying ? Math.max(0, 1 - e.stateT / 1.0) : Math.min(1, e.spawnT * 3);
  drawOpts.tint = e.flashT > 0 ? '#ffffff' : (e.markedT > 0 ? '#c9973f' : e.tint);
  drawOpts.flipX = !isDirectional(sprite) && e.dirX < 0;
  draw(ctx, sprite, e.anim, frameAt(sprite, e.anim, e.animT), x, y, drawOpts);
  if (e.def.special && e.def.special.lightRadius) addLight(x, y - 10, e.def.special.lightRadius, '#e0603a', 0.7, 0.2);
  else if (!dying) addLight(x, y - 8, 22 + e.r * 1.4 * e.scale, COLD_LIGHT, e.boss ? 0.8 : 0.5, 0, true);
  if (e.markedT > 0) addGlow(x, y - 12, 18, '#c9973f', 0.5);
  if (e.boss) addLight(x, y - 20, 120, '#8f8d93', 0.5, 0.05);
}
