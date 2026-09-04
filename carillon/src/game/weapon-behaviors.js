// game/weapon-behaviors.js — les 9 comportements de Timbres et les 4 comportements de fusion.
// Chaque comportement est `fire(w, p, world, at)` appelé par weapons.js SUR la grille rythmique.
// Les dégâts instantanés (arc, onde, aura, cône, marque) passent par collision.damageEnemy ;
// les autres créent des projectiles (projectiles.js) résolus ensuite par collision.js.
// Aucune allocation par tir : SPEC et HIT sont des objets réutilisés, les requêtes de grille
// utilisent des variables de module au lieu de closures.

import { emit as emitParticles } from '../render/particles.js';
import { shake } from '../render/camera.js';
import { beatDuration } from '../audio/conductor.js';
import { SPEC, resetSpec, spawnProjectile, spawnRing, nearestEnemy, hasHit, recordHit, clearHits } from './projectiles.js';
import { damageEnemy, markEnemy } from './collision.js';
import { playerAttack } from './player.js';
import { mult as resonanceMult } from './resonance.js';
import { balance } from './data.js';

const HIT = { crit: false, onBeat: true, knockX: 0, knockY: 0, source: '' };
const TWO_PI = Math.PI * 2;

// Contexte de la requête instantanée courante (arc / onde / aura / cône).
let cw = null, cp = null, cworld = null, cx = 0, cy = 0, cr2 = 0, cInner2 = 0, cDirX = 0, cDirY = 0, cCosHalf = -2;
let cDamage = 0, cKnock = 0, cCritChance = 0, cSource = '', cHits = 0, cChainAfter = false, cForceCrit = false;

/** Dégâts de base d'un tir : arme × sonneur × Résonance. */
export function baseDamage(w, p) { return w.stats.damage * p.stats.damageMult * resonanceMult(); }

function rollCrit(world, chance) { return chance > 0 && world.rng.chance(chance); }

// Callback de grille pour les frappes instantanées.
function instantHit(e) {
  if (e.state !== 'alive') return;
  const dx = e.x - cx, dy = e.y - cy;
  const d2 = dx * dx + dy * dy;
  const rr = e.r;
  if (d2 > cr2 + rr * rr + 2 * Math.sqrt(cr2) * rr) return;
  if (cInner2 > 0 && d2 < cInner2) return;
  if (cCosHalf > -2) {
    const d = Math.sqrt(d2) || 1;
    if ((dx / d) * cDirX + (dy / d) * cDirY < cCosHalf && d > rr) return;
  }
  const d = Math.sqrt(d2) || 1;
  const crit = cForceCrit || rollCrit(cworld, cCritChance);
  HIT.crit = crit; HIT.onBeat = true; HIT.knockX = dx / d * cKnock; HIT.knockY = dy / d * cKnock; HIT.source = cSource;
  damageEnemy(cworld, e, crit ? cDamage * balance().combat.critMult : cDamage, HIT);
  cHits++;
  if (cChainAfter) chainFrom(cworld, cw, cp, e, cDamage * 0.5, 3);
}

/** Frappe instantanée dans un disque (ou un secteur si cosHalf > -1, ou un anneau si inner > 0). */
function instantArea(w, p, world, x, y, range, dirX, dirY, cosHalf, inner, damage, knock, chainAfter) {
  cw = w; cp = p; cworld = world; cx = x; cy = y; cr2 = range * range; cInner2 = inner * inner;
  cDirX = dirX; cDirY = dirY; cCosHalf = cosHalf; cDamage = damage; cKnock = knock;
  cCritChance = p.stats.crit; cSource = w.id; cHits = 0; cChainAfter = chainAfter; cForceCrit = w.def.behavior === 'shockwave_chain';
  world.grid.query(x, y, range, instantHit);
  return cHits;
}

/** Projectile visuel (onde, cône, marque…). */
function fxSprite(world, sprite, x, y, life, scale, growTo, followPlayer, vx, vy, alpha = 1) {
  resetSpec();
  SPEC.kind = 'fx'; SPEC.collides = false; SPEC.sprite = sprite; SPEC.x = x; SPEC.y = y; SPEC.life = life; SPEC.alpha = alpha;
  SPEC.scale = scale; SPEC.growTo = growTo; SPEC.fadeOut = true; SPEC.followPlayer = followPlayer; SPEC.vx = vx; SPEC.vy = vy;
  return spawnProjectile(world);
}

/** Éclair de chaîne parti d'un ennemi vers ses voisins (Chaîne d'Angélus, Tonnerre, Carillon). */
function chainFrom(world, w, p, from, damage, bounces) {
  const t = nearestEnemy(world, from.x, from.y, w.stats.range, null);
  if (!t || t === from) return;
  resetSpec();
  SPEC.kind = 'chain'; SPEC.sprite = w.def.projectileSprite; SPEC.x = from.x; SPEC.y = from.y; SPEC.r = 8;
  SPEC.speed = 420 * w.stats.speed; SPEC.life = 2; SPEC.damage = damage; SPEC.bounces = bounces; SPEC.weaponId = w.id;
  SPEC.knockback = w.stats.knockback; SPEC.target = t; SPEC.crit = rollCrit(world, p.stats.crit);
  const o = spawnProjectile(world);
  if (o) { recordHit(o, from.id); const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 1; o.vx = dx / d * o.speed; o.vy = dy / d * o.speed; }
}

function facing(p) { const l = Math.hypot(p.facing.x, p.facing.y) || 1; fdir.x = p.facing.x / l; fdir.y = p.facing.y / l; return fdir; }
const fdir = { x: 0, y: 1 };
const ARC_OFFSETS = [0, Math.PI, -Math.PI / 2, Math.PI / 2];

// ---- Les 9 Timbres --------------------------------------------------------------------------

const ARC_HALF = 1.22;          // demi-ouverture de l'arc (rad) : le secteur frappé et dessiné
const slashOpts = { angle: 0, spread: 1.4 };

/** Arc VFX du Battant (projectile 'fx' de forme 1, suit le sonneur, ~1/4 de temps). */
function arcFx(world, p, angle, range, life) {
  resetSpec();
  SPEC.kind = 'fx'; SPEC.collides = false; SPEC.shape = 1; SPEC.sprite = 'proj_cloche';
  SPEC.x = p.x; SPEC.y = p.y; SPEC.r = range; SPEC.angle = angle; SPEC.spread = ARC_HALF; SPEC.life = life; SPEC.followPlayer = true;
  spawnProjectile(world);
}

/** Battant : arc de mêlée devant le sonneur ; count > 1 ajoute des arcs derrière / sur les côtés. */
function arc(w, p, world) {
  const f = facing(p);
  const range = w.stats.range * w.stats.area;
  const dmg = baseDamage(w, p);
  playerAttack(p);
  const base = Math.atan2(f.y, f.x);
  const life = Math.min(w.stats.duration, beatDuration() * 0.45);
  for (let k = 0; k < w.stats.count; k++) {
    const a = base + ARC_OFFSETS[k % 4]; // devant, derrière, gauche, droite
    const hits = instantArea(w, p, world, p.x, p.y, range, Math.cos(a), Math.sin(a), Math.cos(ARC_HALF), 0, dmg, w.stats.knockback, false);
    arcFx(world, p, a, range, life);
    slashOpts.angle = a;
    emitParticles('slash', p.x + Math.cos(a) * range * 0.55, p.y - 4 + Math.sin(a) * range * 0.4, slashOpts);
    if (hits > 0) emitParticles('bell', p.x + Math.cos(a) * range * 0.7, p.y - 4 + Math.sin(a) * range * 0.5, halfBell);
  }
  return false;
}
const halfBell = { count: 0.5 };
const dustRing = { count: 3 };

/** Clarine : cloches orbitales ; chaque temps réarme les cloches (une touche par ennemi par temps). */
function orbit(w, p, world) {
  const want = w.stats.count;
  const radius = w.stats.range * w.stats.area;
  for (let i = w.orbits.length - 1; i >= 0; i--) {
    const o = w.orbits[i];
    if (!o.active || o.weaponId !== w.id) w.orbits.splice(i, 1);
  }
  while (w.orbits.length < want) {
    resetSpec();
    SPEC.kind = 'orbit'; SPEC.sprite = w.def.projectileSprite; SPEC.x = p.x; SPEC.y = p.y; SPEC.r = 12; SPEC.life = 0;
    SPEC.weaponId = w.id; SPEC.orbitR = radius; SPEC.knockback = w.stats.knockback;
    const o = spawnProjectile(world);
    if (!o) break;
    o.angle = (w.orbits.length / want) * TWO_PI;
    w.orbits.push(o);
  }
  const speed = (TWO_PI / (beatDuration() * 4)) * w.stats.speed;
  for (let i = 0; i < w.orbits.length; i++) {
    const o = w.orbits[i];
    o.orbitR = radius; o.orbitSpeed = speed;
    o.damage = baseDamage(w, p); o.pierce = 99; o.bounces = w.stats.bounces || 0;
    clearHits(o);
  }
  return false;
}

/** Bourdon : anneau d'onde de choc au sol ; count > 1 = anneaux successifs (chacun frappe tout le disque, plus large). */
function shockwave(w, p, world) {
  const dmg = baseDamage(w, p);
  const chain = w.def.behavior === 'shockwave_chain';
  for (let k = 0; k < w.stats.count; k++) {
    const range = w.stats.range * w.stats.area * (1 + 0.35 * k);
    instantArea(w, p, world, p.x, p.y, range, 0, 0, -2, 0, dmg, w.stats.knockback, chain);
    spawnRing(world, p.x, p.y + 2, range, w.stats.duration * (1 + 0.4 * k)); // onde au sol (VFX)
  }
  fxSprite(world, w.def.projectileSprite, p.x, p.y - 30, 0.35, 0.6, 1, true, 0, -30); // glyphe sonore au-dessus du sonneur
  emitParticles('dust', p.x, p.y, dustRing);
  shake(chain ? 5 : 3, 0.2);
  return true;
}

/** Grelots : projectiles à tête chercheuse vers les ennemis les plus proches. */
function homing(w, p, world) {
  const dmg = baseDamage(w, p);
  let t = null;
  for (let k = 0; k < w.stats.count; k++) {
    resetSpec();
    SPEC.kind = 'homing'; SPEC.sprite = w.def.projectileSprite; SPEC.x = p.x; SPEC.y = p.y - 8; SPEC.r = 7;
    SPEC.speed = 170 * w.stats.speed; SPEC.life = w.stats.duration; SPEC.damage = dmg; SPEC.pierce = w.stats.pierce;
    SPEC.bounce = p.stats.bounce; SPEC.weaponId = w.id; SPEC.knockback = w.stats.knockback;
    SPEC.crit = rollCrit(world, p.stats.crit);
    const a = (k / w.stats.count) * TWO_PI + world.rng.range(0, 0.5);
    SPEC.vx = Math.cos(a) * SPEC.speed; SPEC.vy = Math.sin(a) * SPEC.speed;
    const o = spawnProjectile(world);
    if (!o) break;
    t = nearestEnemy(world, p.x, p.y, w.stats.range * w.stats.area, t ? o : null);
    if (t) { o.target = t; o.targetId = t.id; }
  }
  return false;
}

/** Tocsin : aura continue, dégâts à chaque temps sur tout ce qui est dedans. */
function aura(w, p, world) {
  const screen = w.def.behavior === 'aura_screen';
  const range = w.stats.range * (screen ? 1 : w.stats.area);
  const dmg = baseDamage(w, p);
  const n = instantArea(w, p, world, p.x, p.y, range, 0, 0, -2, 0, dmg, w.stats.knockback, false);
  if (screen) { shake(6, 0.3); fxSprite(world, w.def.projectileSprite, p.x, p.y, 0.5, 1, (range * 2) / 64, true, 0, 0, 0.7); }
  else fxSprite(world, w.def.projectileSprite, p.x, p.y, 0.3, (range * 2) / 64, (range * 2.3) / 64, true, 0, 0, 0.65);
  return screen || n >= 6;
}

/** Cor de Brume : cône perforant devant ; count > 1 ajoute des cônes décalés de ±20° (l'avant reste couvert). */
function cone(w, p, world) {
  const f = facing(p);
  const range = w.stats.range * w.stats.area;
  const dmg = baseDamage(w, p);
  const base = Math.atan2(f.y, f.x);
  for (let k = 0; k < w.stats.count; k++) {
    const a = base + (k === 0 ? 0 : (k % 2 ? 1 : -1) * 0.35 * Math.ceil(k / 2));
    instantArea(w, p, world, p.x, p.y, range, Math.cos(a), Math.sin(a), Math.cos(0.52), 0, dmg, w.stats.knockback, false);
    // Cône VFX (forme 2) qui s'étend devant le sonneur, sprite de brume à la pointe.
    resetSpec();
    SPEC.kind = 'fx'; SPEC.collides = false; SPEC.shape = 2; SPEC.sprite = w.def.projectileSprite;
    SPEC.x = p.x; SPEC.y = p.y; SPEC.r = range; SPEC.angle = a; SPEC.spread = 0.52; SPEC.life = w.stats.duration; SPEC.followPlayer = true;
    spawnProjectile(world);
    slashOpts.angle = a;
    emitParticles('dust', p.x + Math.cos(a) * 24, p.y - 6 + Math.sin(a) * 16, slashOpts);
  }
  playerAttack(p);
  return true;
}

/** Crécelle : rafale courte portée sur les croches, projectiles perçants. */
function burst(w, p, world) {
  const f = facing(p);
  const dmg = baseDamage(w, p);
  const speed = 260 * w.stats.speed;
  const base = Math.atan2(f.y, f.x);
  for (let k = 0; k < w.stats.count; k++) {
    resetSpec();
    SPEC.kind = 'linear'; SPEC.sprite = w.def.projectileSprite; SPEC.x = p.x; SPEC.y = p.y - 6; SPEC.r = 7;
    SPEC.speed = speed; SPEC.life = (w.stats.range * w.stats.area) / speed; SPEC.damage = dmg; SPEC.pierce = w.stats.pierce;
    SPEC.bounce = p.stats.bounce; SPEC.weaponId = w.id; SPEC.knockback = w.stats.knockback; SPEC.crit = rollCrit(world, p.stats.crit);
    const a = base + (k - (w.stats.count - 1) / 2) * 0.26 + world.rng.range(-0.08, 0.08);
    SPEC.vx = Math.cos(a) * speed; SPEC.vy = Math.sin(a) * speed;
    spawnProjectile(world);
  }
  return false;
}

/** Chaîne d'Angélus : éclair qui rebondit entre ennemis. */
function chain(w, p, world) {
  const dmg = baseDamage(w, p);
  for (let k = 0; k < w.stats.count; k++) {
    const t = nearestEnemy(world, p.x, p.y, w.stats.range * w.stats.area, null);
    if (!t) return false;
    resetSpec();
    SPEC.kind = 'chain'; SPEC.sprite = w.def.projectileSprite; SPEC.x = p.x; SPEC.y = p.y - 8; SPEC.r = 8;
    SPEC.speed = 400 * w.stats.speed; SPEC.life = w.stats.duration; SPEC.damage = dmg; SPEC.bounces = w.stats.bounces + p.stats.bounce;
    SPEC.weaponId = w.id; SPEC.knockback = w.stats.knockback; SPEC.target = t; SPEC.crit = rollCrit(world, p.stats.crit);
    const o = spawnProjectile(world);
    if (!o) break;
    const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 1;
    o.vx = dx / d * o.speed; o.vy = dy / d * o.speed;
  }
  return false;
}

/** Diapason : marque les ennemis (+dégâts subis), aucun dégât direct. Requiem : exécute sous le seuil. */
function mark(w, p, world) {
  const range = w.stats.range * w.stats.area;
  let last = null;
  for (let k = 0; k < w.stats.count; k++) {
    const t = nearestUnmarked(world, p.x, p.y, range);
    if (!t) break;
    markEnemy(world, t, w.stats.duration, w.stats.markBonus, w.id, w.stats.executeBelow || 0);
    fxSprite(world, w.def.projectileSprite, t.x, t.y - 20, 0.5, 0.6, 1.2, false, 0, -30);
    last = t;
  }
  return last !== null && w.def.behavior === 'mark_execute';
}

let ux = 0, uy = 0, uBest = null, uBestD = 0;
function pickUnmarked(e) {
  if (e.state !== 'alive' || e.markedT > 0) return;
  const dx = e.x - ux, dy = e.y - uy, d = dx * dx + dy * dy;
  if (uBest === null || d < uBestD) { uBest = e; uBestD = d; }
}
function nearestUnmarked(world, x, y, range) {
  ux = x; uy = y; uBest = null; uBestD = 0;
  world.grid.query(x, y, range, pickUnmarked);
  return uBest !== null && uBestD <= range * range ? uBest : null;
}

/** Carillon (fusion) : cloches orbitales qui, au contact, lancent un éclair rebondissant. */
export function orbitBounceHit(world, w, p, o, enemy) {
  if (o.bounces > 0) chainFrom(world, w, p, enemy, o.damage * 0.6, o.bounces);
}

export const BEHAVIORS = {
  arc, orbit, shockwave, homing, aura, cone, burst, chain, mark,
  aura_screen: aura, orbit_bounce: orbit, shockwave_chain: shockwave, mark_execute: mark,
};
/** Comportements sans projectile de collision (bonus de zone via l'Accord Écho). */
export const INSTANT = { arc: 1, shockwave: 1, aura: 1, cone: 1, mark: 1, aura_screen: 1, shockwave_chain: 1, mark_execute: 1 };
export { hasHit };
