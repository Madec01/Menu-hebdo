// game/projectiles.js — pool de projectiles (joueur et ennemis) : mouvement, durée de vie, rendu.
// Sous-module du périmètre game/. Types (`kind`) :
//   'linear' : ligne droite (Crécelle, Silence des Fossoyeurs)      'homing' : poursuit sa cible (Grelots)
//   'orbit'  : tourne autour du joueur (Clarine, Carillon)          'chain'  : rebondit d'ennemi en ennemi
//   'fx'     : purement visuel (onde, cône, aura, marque), sans collision
// `shape` : 0 = sprite, 1 = arc de mêlée (Battant) dessiné en VFX : secteur de bronze balayé par
// le sprite `proj_cloche` dans la direction `angle`, demi-ouverture `spread`, rayon `r` ;
// 2 = cône (Cor de Brume) : coin translucide qui s'étend jusqu'à `r`, sprite à la pointe ;
// 3 = éclair (Chaîne d'Angélus) : trait de (fromX, fromY) à (x, y) qui s'éteint (spawnBolt) ;
// 4 = onde (Bourdon) : anneau au sol qui s'élargit jusqu'à `r` (spawnRing).
// Les projectiles 'chain' gardent leur point de départ (fromX/fromY) pour tracer l'éclair.
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
    shape: 0, spread: 0, fromX: 0, fromY: 0,
  };
}

function reset(o) {
  o.id = nextId++; o.t = 0; o.hitCount = 0; o.target = null; o.targetId = 0; o.dead = false;
  o.big = false; o.crit = false; o.mark = false; o.collides = true; o.fadeOut = false; o.followPlayer = false;
  o.growTo = 0; o.alpha = 1; o.scale = 1; o.tint = null; o.flipX = false; o.parried = false; o.bounce = 0; o.bounces = 0;
  o.angle = 0; o.orbitR = 0; o.orbitSpeed = 0; o.vx = 0; o.vy = 0; o.markSec = 0; o.markBonus = 0; o.hitOnBeat = false;
  o.shape = 0; o.spread = 0;
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
  o.shape = spec.shape; o.spread = spec.spread; o.fromX = spec.x; o.fromY = spec.y;
  o.id = id; o.hitCount = 0; o.dead = false;
  return o;
}

/** Éclair VFX rémanent de (x0, y0) à (x1, y1) (forme 3). */
export function spawnBolt(world, x0, y0, x1, y1, life = 0.22) {
  resetSpec();
  SPEC.kind = 'fx'; SPEC.collides = false; SPEC.shape = 3; SPEC.x = x1; SPEC.y = y1; SPEC.life = life;
  const o = spawnProjectile(world);
  if (o) { o.fromX = x0; o.fromY = y0; }
  return o;
}

/** Onde de choc au sol (forme 4) centrée en (x, y), rayon final r, durée life. */
export function spawnRing(world, x, y, r, life) {
  resetSpec();
  SPEC.kind = 'fx'; SPEC.collides = false; SPEC.shape = 4; SPEC.x = x; SPEC.y = y; SPEC.r = r; SPEC.life = life;
  return spawnProjectile(world);
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
        if (o.followPlayer) { o.x = player.x + o.vx; o.y = player.y + o.vy; } // vx/vy = décalage fixe
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
const ARC_FILL = '#c9973f', ARC_EDGE = '#f2e6c8';

/** Arc de mêlée : secteur elliptique (vue de dessus) qui s'éteint, bord clair, cloche qui balaie. */
function drawArc(ctx, o, x, y, k) {
  const r = o.r * (0.85 + 0.15 * k), a0 = o.angle - o.spread, a1 = o.angle + o.spread;
  y -= 4;
  ctx.globalAlpha = 0.35 * (1 - k);
  ctx.fillStyle = ARC_FILL;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.ellipse(x, y, r, r * 0.7, 0, a0, a1); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.9 * (1 - k * k);
  ctx.strokeStyle = ARC_EDGE; ctx.lineWidth = 2.5 - 1.5 * k;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, a0, a1); ctx.stroke();
  ctx.globalAlpha = 1;
  // La cloche balaie l'arc du début à la fin du coup.
  const a = a0 + (a1 - a0) * Math.min(1, k * 1.25);
  const bx = x + Math.cos(a) * r * 0.8, by = y + Math.sin(a) * r * 0.56;
  drawOpts.scale = 1; drawOpts.alpha = 1 - k * 0.6; drawOpts.tint = null; drawOpts.flipX = Math.cos(o.angle) < 0;
  if (o.sprite) draw(ctx, o.sprite, 'idle', (k * 4) | 0, bx, by, drawOpts);
  addGlow(bx, by, 16, ARC_FILL, 0.5 * (1 - k));
}

/** Cône du Cor de Brume : coin qui s'étend du sonneur jusqu'à la portée, souffle clair au bord. */
function drawCone(ctx, o, x, y, k) {
  const reach = o.r * Math.min(1, k * 1.6), a0 = o.angle - o.spread, a1 = o.angle + o.spread;
  const fade = k < 0.7 ? 1 : (1 - k) / 0.3;
  y -= 6;
  ctx.globalAlpha = 0.28 * fade;
  ctx.fillStyle = ARC_EDGE;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.ellipse(x, y, reach, reach * 0.7, 0, a0, a1); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.7 * fade;
  ctx.strokeStyle = ARC_FILL; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(x, y, reach, reach * 0.7, 0, a0, a1); ctx.stroke();
  ctx.globalAlpha = 1;
  const bx = x + Math.cos(o.angle) * reach * 0.85, by = y + Math.sin(o.angle) * reach * 0.6;
  drawOpts.scale = 1.2; drawOpts.alpha = fade; drawOpts.tint = null; drawOpts.flipX = Math.cos(o.angle) < 0;
  if (o.sprite) draw(ctx, o.sprite, 'idle', frameAt(o.sprite, 'idle', o.t), bx, by, drawOpts);
  addGlow(bx, by, 22, ARC_FILL, 0.45 * fade);
}

/** Éclair de la Chaîne d'Angélus : trait clair du point de départ au projectile, halo bronze. */
function drawChain(ctx, o, x, y) {
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = ARC_EDGE; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(o.fromX, o.fromY - 8); ctx.lineTo(x, y); ctx.stroke();
  ctx.globalAlpha = 1;
  addGlow((o.fromX + x) / 2, (o.fromY - 8 + y) / 2, Math.max(12, Math.hypot(x - o.fromX, y - o.fromY + 8) * 0.5), ARC_FILL, 0.25);
}

/** Éclair rémanent (forme 3) : trait clair qui s'éteint, halo bronze au milieu. */
function drawBolt(ctx, o, x, y, k) {
  const a = 1 - k;
  ctx.globalAlpha = 0.9 * a;
  ctx.strokeStyle = ARC_EDGE; ctx.lineWidth = 1 + 1.5 * a;
  ctx.beginPath(); ctx.moveTo(o.fromX, o.fromY - 8); ctx.lineTo(x, y - 8); ctx.stroke();
  ctx.globalAlpha = 1;
  addGlow((o.fromX + x) / 2, (o.fromY + y) / 2 - 8, Math.max(14, Math.hypot(x - o.fromX, y - o.fromY) * 0.5), ARC_FILL, 0.3 * a);
}

/** Onde de choc (forme 4) : anneau elliptique qui s'élargit et s'éteint, disque intérieur discret. */
function drawRing(ctx, o, x, y, k) {
  const e = 1 - (1 - k) * (1 - k);          // easeOutQuad
  const r = o.r * e, a = 1 - k;
  ctx.globalAlpha = 0.18 * a;
  ctx.fillStyle = ARC_FILL;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.9 * a;
  ctx.strokeStyle = ARC_EDGE; ctx.lineWidth = 1 + 2.5 * a;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.6 * a;
  ctx.strokeStyle = ARC_FILL; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r * 0.48, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  addGlow(x, y, r * 0.9, ARC_FILL, 0.3 * a);
}

export function renderProjectiles(ctx, world, alpha) {
  const items = world.projectiles.items;
  for (let i = 0; i < items.length; i++) {
    const o = items[i];
    if (!o.sprite && !o.shape) continue;
    const x = o.px + (o.x - o.px) * alpha, y = o.py + (o.y - o.py) * alpha;
    const k = o.life > 0 ? Math.min(1, o.t / o.life) : 0;
    if (o.shape === 1) { if (isVisible(x, y, o.r)) drawArc(ctx, o, x, y, k); continue; }
    if (o.shape === 2) { if (isVisible(x, y, o.r)) drawCone(ctx, o, x, y, k); continue; }
    if (o.shape === 3) { if (isVisible(x, y, 200)) drawBolt(ctx, o, x, y, k); continue; }
    if (o.shape === 4) { if (isVisible(x, y, o.r)) drawRing(ctx, o, x, y, k); continue; }
    if (o.kind === 'chain' && !o.dead) drawChain(ctx, o, x, y);
    let scale = o.scale;
    if (o.growTo > 0) scale = o.scale + (o.growTo - o.scale) * k;
    const rr = Math.max(o.r, 40 * scale);
    if (!isVisible(x, y, rr)) continue;
    drawOpts.scale = scale;
    drawOpts.alpha = o.fadeOut ? o.alpha * (1 - k) : o.alpha;
    drawOpts.tint = o.tint;
    drawOpts.flipX = o.vx < 0;
    draw(ctx, o.sprite, o.anim, frameAt(o.sprite, o.anim, o.t), x, y, drawOpts);
    if (o.owner === 'player' && o.kind !== 'fx') addGlow(x, y, 14 * scale, '#c9973f', 0.25);
  }
}
