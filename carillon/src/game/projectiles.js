// game/projectiles.js — pool de projectiles (joueur et ennemis) : mouvement, durée de vie, rendu.
// Sous-module du périmètre game/. Types (`kind`) :
//   'linear' : ligne droite (Crécelle, Silence des Fossoyeurs)      'homing' : poursuit sa cible (Grelots)
//   'orbit'  : tourne autour du joueur (Clarine, Carillon)          'chain'  : rebondit d'ennemi en ennemi
//   'fx'     : purement visuel (onde, cône, aura, marque), sans collision
// Les collisions sont résolues dans collision.js ; ici on ne fait que déplacer et dessiner.
// spawnProjectile copie un objet `spec` réutilisable (voir SPEC) : aucune allocation par tir.

import { createPool } from '../core/pool.js';
import { draw, frameAt } from '../render/atlas.js';
import { isVisible } from '../render/camera.js';
import { addGlow } from '../render/lighting.js';

const MAX_HITS = 24;
let nextId = 1;

function factory() {
  return {
    id: 0, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 6, kind: 'linear', owner: 'player',
    sprite: null, anim: 'idle', t: 0, life: 1, damage: 0, pierce: 1, bounce: 0, bounces: 0,
    hits: new Int32Array(MAX_HITS), hitCount: 0, weaponId: '', big: false, crit: false,
    knockback: 0, speed: 0, angle: 0, orbitR: 0, orbitSpeed: 0, target: null, targetId: 0,
    scale: 1, alpha: 1, tint: null, flipX: false, collides: true, mark: false, markSec: 0, markBonus: 0,
    growTo: 0, fadeOut: false, followPlayer: false, hitOnBeat: false, dead: false, parried: false,
  };
}

function reset(o) {
  o.id = nextId++; o.t = 0; o.hitCount = 0; o.target = null; o.targetId = 0; o.dead = false;
  o.big = false; o.crit = false; o.mark = false; o.collides = true; o.fadeOut = false; o.followPlayer = false;
  o.growTo = 0; o.alpha = 1; o.scale = 1; o.tint = null; o.flipX = false; o.parried = false; o.bounce = 0; o.bounces = 0;
  o.angle = 0; o.orbitR = 0; o.orbitSpeed = 0; o.vx = 0; o.vy = 0; o.markSec = 0; o.markBonus = 0; o.hitOnBeat = false;
}

/** Spécification réutilisable remplie par les comportements d'armes avant spawnProjectile. */
export const SPEC = factory();

/** Remet SPEC à une valeur neutre avant de le remplir. */
export function resetSpec() {
  reset(SPEC);
  SPEC.owner = 'player'; SPEC.kind = 'linear'; SPEC.sprite = null; SPEC.anim = 'idle'; SPEC.r = 6;
  SPEC.life = 1; SPEC.damage = 0; SPEC.pierce = 1; SPEC.knockback = 0; SPEC.speed = 0; SPEC.weaponId = '';
  SPEC.x = 0; SPEC.y = 0;
  return SPEC;
}

export function createProjectilePool(initial = 300) { return createPool(factory, reset, initial); }

/** Copie SPEC dans un projectile du pool et le renvoie (null si le pool est plein au-delà de 1200). */
export function spawnProjectile(world, spec = SPEC) {
  const pool = world.projectiles;
  if (pool.active >= 1200) return null;
  const o = pool.acquire();
  const id = o.id;
  o.x = spec.x; o.y = spec.y; o.px = spec.x; o.py = spec.y; o.vx = spec.vx; o.vy = spec.vy; o.r = spec.r;
  o.kind = spec.kind; o.owner = spec.owner; o.sprite = spec.sprite; o.anim = spec.anim; o.life = spec.life;
  o.damage = spec.damage; o.pierce = spec.pierce; o.bounce = spec.bounce; o.bounces = spec.bounces;
  o.weaponId = spec.weaponId; o.big = spec.big; o.crit = spec.crit; o.knockback = spec.knockback;
  o.speed = spec.speed; o.angle = spec.angle; o.orbitR = spec.orbitR; o.orbitSpeed = spec.orbitSpeed;
  o.target = spec.target; o.targetId = spec.target ? spec.target.id : 0;
  o.scale = spec.scale; o.alpha = spec.alpha; o.tint = spec.tint; o.collides = spec.collides;
  o.mark = spec.mark; o.markSec = spec.markSec; o.markBonus = spec.markBonus;
  o.growTo = spec.growTo; o.fadeOut = spec.fadeOut; o.followPlayer = spec.followPlayer; o.hitOnBeat = spec.hitOnBeat;
  o.id = id; o.hitCount = 0; o.dead = false;
  return o;
}

/** A-t-on déjà touché cet ennemi ? */
export function hasHit(o, enemyId) {
  for (let i = 0; i < o.hitCount; i++) if (o.hits[i] === enemyId) return true;
  return false;
}
export function recordHit(o, enemyId) { if (o.hitCount < MAX_HITS) o.hits[o.hitCount++] = enemyId; }
export function clearHits(o) { o.hitCount = 0; }

// Recherche de la cible la plus proche non encore touchée (sans closure par appel).
let qx = 0, qy = 0, qBest = null, qBestD = 0, qProj = null;
function pickCandidate(e) {
  if (e.state !== 'alive') return;
  if (qProj && hasHit(qProj, e.id)) return;
  const dx = e.x - qx, dy = e.y - qy, d = dx * dx + dy * dy;
  if (qBest === null || d < qBestD) { qBest = e; qBestD = d; }
}

/** Ennemi vivant le plus proche de (x, y) dans `range`, non touché par `proj` (ou null). */
export function nearestEnemy(world, x, y, range, proj = null) {
  qx = x; qy = y; qBest = null; qBestD = 0; qProj = proj;
  world.grid.query(x, y, range, pickCandidate);
  if (qBest !== null && qBestD > range * range) qBest = null;
  return qBest;
}

/** Oriente un projectile vers un ennemi (poursuite ou rebond). Renvoie false si aucune cible. */
export function retarget(world, o, range) {
  const t = nearestEnemy(world, o.x, o.y, range, o);
  if (!t) return false;
  o.target = t; o.targetId = t.id;
  const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 1;
  o.vx = dx / d * o.speed; o.vy = dy / d * o.speed;
  return true;
}

export function updateProjectiles(world, dt, player) {
  const items = world.projectiles.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const o = items[i];
    o.px = o.x; o.py = o.y;
    o.t += dt;
    if (o.dead || (o.life > 0 && o.t >= o.life)) { world.projectiles.release(o); continue; }
    switch (o.kind) {
      case 'orbit': {
        o.angle += o.orbitSpeed * dt;
        o.x = player.x + Math.cos(o.angle) * o.orbitR;
        o.y = player.y + Math.sin(o.angle) * o.orbitR * 0.7;
        break;
      }
      case 'homing':
      case 'chain': {
        const tgt = o.target;
        if (tgt && tgt.active && tgt.id === o.targetId && tgt.state === 'alive') {
          const dx = tgt.x - o.x, dy = tgt.y - o.y, d = Math.hypot(dx, dy) || 1;
          const turn = o.kind === 'chain' ? 1 : Math.min(1, 6 * dt);
          o.vx += (dx / d * o.speed - o.vx) * turn; o.vy += (dy / d * o.speed - o.vy) * turn;
        } else if (!retarget(world, o, 260)) {
          if (o.kind === 'chain') { o.dead = true; }
        }
        o.x += o.vx * dt; o.y += o.vy * dt;
        break;
      }
      case 'fx': {
        if (o.followPlayer) { o.x = player.x; o.y = player.y; }
        else { o.x += o.vx * dt; o.y += o.vy * dt; }
        break;
      }
      default: // linear
        o.x += o.vx * dt; o.y += o.vy * dt;
    }
    if (o.kind !== 'orbit' && o.kind !== 'fx' && Math.abs(o.x - player.x) + Math.abs(o.y - player.y) > 900) o.dead = true;
  }
}

const drawOpts = { flipX: false, alpha: 1, tint: null, scale: 1 };

export function renderProjectiles(ctx, world, alpha) {
  const items = world.projectiles.items;
  for (let i = 0; i < items.length; i++) {
    const o = items[i];
    if (!o.sprite) continue;
    const x = o.px + (o.x - o.px) * alpha, y = o.py + (o.y - o.py) * alpha;
    const k = o.life > 0 ? Math.min(1, o.t / o.life) : 0;
    let scale = o.scale;
    if (o.growTo > 0) scale = o.scale + (o.growTo - o.scale) * k;
    const rr = Math.max(o.r, 40 * scale);
    if (!isVisible(x, y, rr)) continue;
    drawOpts.scale = scale;
    drawOpts.alpha = o.fadeOut ? o.alpha * (1 - k) : o.alpha;
    drawOpts.tint = o.tint;
    drawOpts.flipX = o.vx < 0;
    draw(ctx, o.sprite, o.anim, frameAt(o.sprite, o.anim, o.t), x, y, drawOpts);
    if (o.owner === 'player' && o.kind !== 'fx') addGlow(x, y, 14 * scale, '#c9973f', 0.35);
  }
}
