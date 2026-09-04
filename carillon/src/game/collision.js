// game/collision.js — grille spatiale et résolution des contacts (ARCHITECTURE.md § 11, § 13).
// cercle/cercle uniquement. Projectiles du joueur → ennemis (perforation, rebonds, chaînes),
// projectiles de Silence → joueur (parade : renvoi), ennemis → joueur (contact, annulé par la
// parade). damageEnemy applique marque, critique, onBeat (Chœur Muet), recul, flash, nombres de
// dégâts, hit-stop 40 ms sur les gros coups, et crédite dpsReport (weapons.recordDamage).

import { bus } from '../core/events.js';
import { play as playSfx } from '../audio/sfx.js';
import { phase, beatDuration, windowMs } from '../audio/conductor.js';
import { damageNumber, hitStop } from '../render/fx.js';
import { emit as emitParticles } from '../render/particles.js';
import { balance } from './data.js';
import { hasHit, recordHit, retarget } from './projectiles.js';
import { hitPlayer, notifyParry } from './player.js';
import { killEnemy } from './enemies.js';
import { recordDamage, findWeapon } from './weapons.js';
import { orbitBounceHit } from './weapon-behaviors.js';
import { burstCloud } from './enemy-behaviors.js';

const hitPayload = { id: 0, kind: '', damage: 0, crit: false, x: 0, y: 0, onBeat: false };
const numOpts = { crit: false, onBeat: false };
const HIT = { crit: false, onBeat: false, knockX: 0, knockY: 0, source: '' };

/** Vide et remplit la grille avec les ennemis vivants. */
export function buildGrid(world) {
  const g = world.grid;
  g.clear();
  const items = world.enemies.items;
  for (let i = 0; i < items.length; i++) if (items[i].state === 'alive') g.insert(items[i]);
}

/** Le tick courant est-il dans la fenêtre d'un temps (pour les coups de projectiles) ? */
export function nowOnBeat() {
  const ph = phase();
  const off = Math.min(ph, 1 - ph) * beatDuration() * 1000;
  return off <= windowMs();
}

/** Marque un ennemi (Diapason / Requiem) : +bonus de dégâts subis, exécution sous un seuil. */
export function markEnemy(world, e, sec, bonus, weaponId, executeBelow) {
  e.markedT = Math.max(e.markedT, sec); e.markBonus = Math.max(e.markBonus, bonus); e.markBy = weaponId; e.executeBelow = executeBelow;
}

/** Inflige `amount` à un ennemi. Renvoie les dégâts réellement appliqués. */
export function damageEnemy(world, enemy, amount, opts = HIT) {
  if (enemy.state !== 'alive') return 0;
  const C = balance().combat;
  if (enemy.def.onBeatOnly && !opts.onBeat) {
    // Chœur Muet : un coup hors du temps ne fait que l'écarter.
    enemy.kx += opts.knockX * 0.5; enemy.ky += opts.knockY * 0.5;
    enemy.flashT = 0.03;
    return 0;
  }
  let dmg = amount * (enemy.vulnMult || 1);
  let bonusPart = 0;
  if (enemy.markedT > 0 && enemy.markBonus > 0) { bonusPart = dmg * enemy.markBonus; dmg += bonusPart; }
  dmg = Math.max(1, Math.round(dmg));
  enemy.hp -= dmg;
  enemy.flashT = C.flashSec;
  const m = 1 / Math.max(0.2, enemy.mass);
  enemy.kx += opts.knockX * m; enemy.ky += opts.knockY * m;
  enemy.killedBy = opts.source;
  recordDamage(opts.source, dmg - bonusPart);
  if (bonusPart > 0 && enemy.markBy) recordDamage(enemy.markBy, bonusPart);
  hitPayload.id = enemy.id; hitPayload.kind = enemy.kind; hitPayload.damage = dmg; hitPayload.crit = opts.crit;
  hitPayload.x = enemy.x; hitPayload.y = enemy.y; hitPayload.onBeat = opts.onBeat;
  bus.emit('enemy:hit', hitPayload);
  numOpts.crit = opts.crit; numOpts.onBeat = opts.onBeat;
  damageNumber(enemy.x, enemy.y - enemy.r * 2, dmg, numOpts);
  const big = dmg >= C.bigHitThreshold;
  if (enemy.boss) playSfx('boss_hit', { x: enemy.x, y: enemy.y });
  else playSfx(opts.crit ? 'hit_crit' : big ? 'hit_heavy' : 'hit_light', { x: enemy.x, y: enemy.y });
  emitParticles(big ? 'hit_big' : 'hit', enemy.x, enemy.y - 8);
  if (big || opts.crit) hitStop(C.hitStopMs);
  // Requiem : les marqués meurent instantanément sous le seuil (jamais les boss).
  if (enemy.hp > 0 && enemy.executeBelow > 0 && enemy.markedT > 0 && !enemy.boss && enemy.hp / enemy.maxHp < enemy.executeBelow) {
    recordDamage(enemy.markBy, enemy.hp); enemy.hp = 0; emitParticles('bell', enemy.x, enemy.y);
  }
  if (enemy.hp <= 0) {
    if (enemy.def.behavior === 'explode' && enemy.aiState !== 2 && world.player) burstCloud(world, enemy, world.player, 0.6);
    killEnemy(world, enemy, opts.source);
  }
  return dmg;
}

// ---- Projectiles du joueur contre ennemis ---------------------------------------------------
let cur = null, curWorld = null, curPlayer = null, curOnBeat = false;

function projHit(e) {
  const o = cur;
  if (o.dead || e.state !== 'alive' || hasHit(o, e.id)) return;
  const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r;
  if (dx * dx + dy * dy > rr * rr) return;
  recordHit(o, e.id);
  const d = Math.hypot(dx, dy) || 1;
  const C = balance().combat;
  HIT.crit = o.crit; HIT.onBeat = o.kind === 'orbit' ? true : curOnBeat; HIT.source = o.weaponId;
  HIT.knockX = dx / d * o.knockback; HIT.knockY = dy / d * o.knockback;
  damageEnemy(curWorld, e, o.crit ? o.damage * C.critMult : o.damage, HIT);
  const w = findWeapon(curPlayer, o.weaponId);
  if (o.kind === 'orbit') { if (w && w.def.behavior === 'orbit_bounce') orbitBounceHit(curWorld, w, curPlayer, o, e); return; }
  if (o.kind === 'chain') {
    if (o.bounces > 0 && retarget(curWorld, o, 220)) { o.bounces--; o.t = 0; } else o.dead = true;
    return;
  }
  if (o.parried) { o.dead = true; return; }
  o.pierce--;
  if (o.pierce <= 0) {
    if (o.bounce > 0 && retarget(curWorld, o, 200)) { o.bounce--; o.pierce = 1; }
    else o.dead = true;
  }
}

/** Résout tous les projectiles (joueur → ennemis, ennemis → joueur). */
export function collideProjectiles(world, p) {
  curWorld = world; curPlayer = p; curOnBeat = nowOnBeat();
  const items = world.projectiles.items;
  const B = balance().player;
  for (let i = items.length - 1; i >= 0; i--) {
    const o = items[i];
    if (!o.collides || o.dead) continue;
    if (o.owner === 'player') { cur = o; world.grid.query(o.x, o.y, o.r + 24, projHit); continue; }
    // Projectile de Silence contre le joueur.
    const dx = p.x - o.x, dy = p.y - 8 - o.y;
    const rr = o.r + (p.parryT > 0 ? B.parryRadius : p.r);
    if (dx * dx + dy * dy > rr * rr || p.dead) continue;
    if (p.parryT > 0) {
      o.owner = 'player'; o.parried = true; o.damage *= 2; o.tint = '#c9973f'; o.weaponId = 'parry'; o.t = 0; o.life = 3; o.speed *= 1.5;
      if (!retarget(world, o, 400)) { o.vx = -o.vx * 1.5; o.vy = -o.vy * 1.5; }
      notifyParry(p);
      emitParticles('parry', o.x, o.y);
    } else if (p.iframesT <= 0) {
      if (hitPlayer(p, o.damage, o.weaponId)) o.dead = true;
    }
  }
}

// ---- Contact ennemis → joueur ---------------------------------------------------------------
let cp = null, cpWorld = null;
function contact(e) {
  if (e.state !== 'alive' || e.contactT > 0) return;
  const dx = e.x - cp.x, dy = e.y - cp.y, rr = e.r + cp.r;
  if (dx * dx + dy * dy > rr * rr) return;
  const d = Math.hypot(dx, dy) || 1;
  if (cp.parryT > 0) {
    // Contre-battement : le contact est annulé et l'ennemi repoussé.
    e.kx += dx / d * 260 / Math.max(0.2, e.mass); e.ky += dy / d * 260 / Math.max(0.2, e.mass);
    e.contactT = balance().player.contactCooldownSec;
    notifyParry(cp);
    return;
  }
  if (hitPlayer(cp, e.damage, e.kind)) {
    e.contactT = balance().player.contactCooldownSec;
    e.kx += dx / d * 80 / Math.max(0.2, e.mass); e.ky += dy / d * 80 / Math.max(0.2, e.mass);
  }
}

export function collideEnemiesPlayer(world, p) {
  if (p.dead) return;
  cp = p; cpWorld = world;
  world.grid.query(p.x, p.y, p.r + 48, contact);
}
