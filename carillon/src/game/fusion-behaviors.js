// game/fusion-behaviors.js — les 5 fusions des Timbres orphelins (ARCHITECTURE.md § 10 bis, audit § 2.4).
// Même signature que weapon-behaviors.js : fire(w, p, world, at) sur la grille, update(w, p, world, dt) par tick.
// Paramètres `special` de fusions.json documentés au-dessus de chaque comportement. weapons.js fusionne
// FUSION_BEHAVIORS / FUSION_UPDATES avec ceux des Timbres.
//   arc_volee   (Grande Volée, battant + corde_de_chanvre) : arcs du Battant ; chaque Parfait du sonneur
//                déclenche au tir suivant un arc à 360° (dégâts × perfectMult, recul × perfectKnock).
//   herd        (Transhumance, grelots + souffle) : les grelots suivent le sonneur en troupeau et partent
//                tous ensemble sur le temps fort de chaque mesure vers les ennemis les plus proches ;
//                la Volée les lance immédiatement dans sa direction.
//   cone_parry  (Corne de Guet, cor_de_brume + ferrure) : le cône renvoie les projectiles de Silence qu'il
//                contient (×2, comme la parade) et fige un temps ce qu'il touche.
//   burst_roll  (Crécelle du Vendredi, crecelle + etain) : roulement en doubles croches ; le coup qui tombe
//                sur le temps est critique garanti et perce tout.
//   chain_heal  (Angélus de Veillée, chaine_d_angelus + cire_d_abeille) : chaîne à neuf coups ; chaque
//                ennemi touché rend 1 PV (plafond healPerBar par mesure).

import { bus } from '../core/events.js';
import { emit as emitParticles } from '../render/particles.js';
import { beatDuration } from '../audio/conductor.js';
import { SPEC, resetSpec, spawnProjectile, nearestEnemy, retarget } from './projectiles.js';
import { playerAttack, healPlayer } from './player.js';
import { instantArea, baseDamage, critFor, facing, arcFx, ARC_HALF } from './weapon-behaviors.js';

const TWO_PI = Math.PI * 2;
const ARC_OFFSETS = [0, Math.PI, -Math.PI / 2, Math.PI / 2];
const slashOpts = { angle: 0, spread: 1.4 };

// Armes vivantes suivies par les écouteurs du bus (une seule instance de chaque fusion par run).
let voleeW = null, voleeP = null;
let herdW = null, herdP = null, herdWorld = null;
let healW = null, healP = null, healWorld = null;

bus.on('rhythm:input', (e) => { if (e.grade === 'parfait' && voleeW && voleeP && !voleeP.dead) voleeW.pending = 1; });
bus.on('player:dash', (e) => { if (herdW && herdP && herdWorld && !herdP.dead) herdLaunch(herdW, herdP, herdWorld, e.dirX, e.dirY); });
bus.on('enemy:hit', (e) => {
  if (!healW || !healP || !healWorld || healP.dead || healW.healed >= (healW.def.special.healPerBar || 6)) return;
  const items = healWorld.enemies.items;
  for (let i = 0; i < items.length; i++) if (items[i].id === e.id) { if (items[i].killedBy === healW.id) { healW.healed++; healPlayer(healP, 1); } return; }
});

// ---- Grande Volée -----------------------------------------------------------------------------
function arcVoleeUpdate(w, p) { voleeW = w; voleeP = p; }
function arcVolee(w, p, world) {
  const s = w.def.special;
  const f = facing(p);
  const range = w.stats.range * w.stats.area;
  const dmg = baseDamage(w, p);
  playerAttack(p);
  const base = Math.atan2(f.y, f.x);
  const life = Math.min(w.stats.duration, beatDuration() * 0.45);
  if (w.pending > 0) {
    // Le Parfait du sonneur : un seul arc complet, plus fort, qui repousse.
    w.pending = 0;
    instantArea(w, p, world, p.x, p.y, range * 1.1, 0, 0, -2, 0, dmg * s.perfectMult, w.stats.knockback * s.perfectKnock, false);
    arcFx(world, p, base, range * 1.1, life * 1.4, Math.PI);
    emitParticles('bell', p.x, p.y - 6);
    return true;
  }
  for (let k = 0; k < w.stats.count; k++) {
    const a = base + ARC_OFFSETS[k % 4];
    instantArea(w, p, world, p.x, p.y, range, Math.cos(a), Math.sin(a), Math.cos(ARC_HALF), 0, dmg, w.stats.knockback, false);
    arcFx(world, p, a, range, life);
    slashOpts.angle = a;
    emitParticles('slash', p.x + Math.cos(a) * range * 0.55, p.y - 4 + Math.sin(a) * range * 0.4, slashOpts);
  }
  return false;
}

// ---- Transhumance -----------------------------------------------------------------------------
function herdUpdate(w, p, world) { herdW = w; herdP = p; herdWorld = world; }
function clearHerd(w) { for (let i = 0; i < w.orbits.length; i++) w.orbits[i].dead = true; w.orbits.length = 0; }
/** Le troupeau visible entre deux départs : grelots qui tournent lâchement autour du sonneur (sans collision). */
function herdShow(w, p, world) {
  clearHerd(w);
  const s = w.def.special;
  const life = (beatDuration() || 0.625) * 4 * 0.95;
  for (let k = 0; k < w.stats.count; k++) {
    resetSpec();
    SPEC.kind = 'orbit'; SPEC.collides = false; SPEC.sprite = w.def.projectileSprite; SPEC.x = p.x; SPEC.y = p.y; SPEC.r = 6;
    SPEC.life = life; SPEC.orbitR = s.herdRadius; SPEC.orbitSpeed = (TWO_PI / (beatDuration() * 8)) * (k % 2 ? 1 : -1); SPEC.weaponId = w.id;
    const o = spawnProjectile(world);
    if (!o) break;
    o.angle = (k / w.stats.count) * TWO_PI;
    w.orbits.push(o);
  }
}
/** Départ groupé : vers les ennemis les plus proches (Volée : dans sa direction, en éventail). */
function herdLaunch(w, p, world, dirX, dirY) {
  const dmg = baseDamage(w, p);
  let t = null;
  clearHerd(w);
  for (let k = 0; k < w.stats.count; k++) {
    resetSpec();
    SPEC.kind = dirX === 0 && dirY === 0 ? 'homing' : 'linear'; SPEC.sprite = w.def.projectileSprite; SPEC.x = p.x; SPEC.y = p.y - 8; SPEC.r = 7;
    SPEC.speed = 200 * w.stats.speed; SPEC.life = w.stats.duration; SPEC.damage = dmg; SPEC.pierce = w.stats.pierce;
    SPEC.bounce = p.stats.bounce; SPEC.weaponId = w.id; SPEC.knockback = w.stats.knockback; SPEC.crit = critFor(w, p, world);
    const a = SPEC.kind === 'linear' ? Math.atan2(dirY, dirX) + (k - (w.stats.count - 1) / 2) * 0.18 : (k / w.stats.count) * TWO_PI;
    SPEC.vx = Math.cos(a) * SPEC.speed; SPEC.vy = Math.sin(a) * SPEC.speed;
    const o = spawnProjectile(world);
    if (!o) break;
    if (SPEC.kind === 'homing') { t = nearestEnemy(world, p.x, p.y, w.stats.range * w.stats.area, t ? o : null); if (t) { o.target = t; o.targetId = t.id; } }
  }
  emitParticles('bell', p.x, p.y - 8);
}
function herd(w, p, world) {
  herdLaunch(w, p, world, 0, 0);
  herdShow(w, p, world);
  return true;
}

// ---- Corne de Guet ----------------------------------------------------------------------------
function coneParry(w, p, world) {
  const s = w.def.special;
  const f = facing(p);
  const range = w.stats.range * w.stats.area;
  const dmg = baseDamage(w, p);
  const a = Math.atan2(f.y, f.x), cosHalf = Math.cos(s.halfAngle);
  const bd = beatDuration() || 0.625;
  instantArea(w, p, world, p.x, p.y, range, f.x, f.y, cosHalf, 0, dmg, w.stats.knockback, false, 0, bd * s.stunBeats);
  // Parade de cône : tout projectile de Silence dans le cône est renvoyé (×2) vers l'ennemi le plus proche.
  const items = world.projectiles.items;
  let reflected = 0;
  for (let i = 0; i < items.length; i++) {
    const o = items[i];
    if (o.owner !== 'enemy' || o.dead || !o.collides) continue;
    const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d > range + o.r || (dx / d) * f.x + (dy / d) * f.y < cosHalf) continue;
    o.owner = 'player'; o.parried = true; o.damage *= s.reflectMult; o.tint = '#c9973f'; o.weaponId = w.id; o.t = 0; o.life = 3; o.speed *= 1.5; o.pierce = 1;
    if (!retarget(world, o, 400)) { o.vx = -o.vx * 1.5; o.vy = -o.vy * 1.5; }
    emitParticles('parry', o.x, o.y);
    reflected++;
  }
  resetSpec();
  SPEC.kind = 'fx'; SPEC.collides = false; SPEC.shape = 2; SPEC.sprite = w.def.projectileSprite;
  SPEC.x = p.x; SPEC.y = p.y; SPEC.r = range; SPEC.angle = a; SPEC.spread = s.halfAngle; SPEC.life = w.stats.duration; SPEC.followPlayer = true;
  spawnProjectile(world);
  slashOpts.angle = a;
  emitParticles('dust', p.x + Math.cos(a) * 24, p.y - 6 + Math.sin(a) * 16, slashOpts);
  playerAttack(p);
  return true;
}

// ---- Crécelle du Vendredi ---------------------------------------------------------------------
function burstRoll(w, p, world) {
  const s = w.def.special;
  const f = facing(p);
  const dmg = baseDamage(w, p);
  const speed = 260 * w.stats.speed;
  const base = Math.atan2(f.y, f.x);
  const onBeat = Math.abs(w.gridB - Math.round(w.gridB)) < 1e-6;   // le coup qui tombe sur le temps
  for (let k = 0; k < w.stats.count; k++) {
    resetSpec();
    SPEC.kind = 'linear'; SPEC.sprite = w.def.projectileSprite; SPEC.x = p.x; SPEC.y = p.y - 6; SPEC.r = onBeat ? 9 : 7;
    SPEC.speed = speed; SPEC.life = (w.stats.range * w.stats.area) / speed; SPEC.damage = dmg;
    SPEC.pierce = onBeat ? 99 : w.stats.pierce; SPEC.crit = onBeat || critFor(w, p, world); SPEC.scale = onBeat ? s.beatScale : 1;
    SPEC.bounce = p.stats.bounce; SPEC.weaponId = w.id; SPEC.knockback = w.stats.knockback * (onBeat ? 2 : 1);
    const a = base + (k - (w.stats.count - 1) / 2) * 0.26 + world.rng.range(-0.08, 0.08);
    SPEC.vx = Math.cos(a) * speed; SPEC.vy = Math.sin(a) * speed;
    spawnProjectile(world);
  }
  if (onBeat) emitParticles('slash', p.x + f.x * 14, p.y - 6 + f.y * 10, slashOpts);
  return onBeat;
}

// ---- Angélus de Veillée -----------------------------------------------------------------------
function chainHealUpdate(w, p, world) { healW = w; healP = p; healWorld = world; }
function chainHeal(w, p, world) {
  if (world.bar !== w.lastBar) { w.lastBar = world.bar; w.healed = 0; }
  const dmg = baseDamage(w, p);
  for (let k = 0; k < w.stats.count; k++) {
    const t = nearestEnemy(world, p.x, p.y, w.stats.range * w.stats.area, null);
    if (!t) return false;
    resetSpec();
    SPEC.kind = 'chain'; SPEC.sprite = w.def.projectileSprite; SPEC.x = p.x; SPEC.y = p.y - 8; SPEC.r = 8;
    SPEC.speed = 400 * w.stats.speed; SPEC.life = w.stats.duration; SPEC.damage = dmg; SPEC.bounces = w.stats.bounces + p.stats.bounce;
    SPEC.weaponId = w.id; SPEC.knockback = w.stats.knockback; SPEC.target = t; SPEC.crit = critFor(w, p, world);
    const o = spawnProjectile(world);
    if (!o) break;
    const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 1;
    o.vx = dx / d * o.speed; o.vy = dy / d * o.speed;
  }
  return false;
}

export const FUSION_BEHAVIORS = { arc_volee: arcVolee, herd, cone_parry: coneParry, burst_roll: burstRoll, chain_heal: chainHeal };
export const FUSION_UPDATES = { arc_volee: arcVoleeUpdate, herd: herdUpdate, chain_heal: chainHealUpdate };
