// game/weapon-behaviors.js — les 9 comportements de Timbres et les 4 fusions historiques (les 5 nouvelles
// fusions vivent dans fusion-behaviors.js, qui réutilise les helpers exportés ici).
// Chaque comportement est `fire(w, p, world, at)` appelé par weapons.js SUR la grille rythmique ;
// UPDATES[behavior] = `update(w, p, world, dt)` optionnel appelé à chaque tick (aura qui suit le sonneur).
// Les dégâts instantanés (arc, onde, aura, cône, marque) passent par collision.damageEnemy ;
// les autres créent des projectiles (projectiles.js) résolus ensuite par collision.js.
// « Sur le temps » (Chœur Muet) : une frappe instantanée compte sur le temps si le Timbre est lourd
// (blanche/ronde) ou si le sonneur vient lui-même de frapper juste (dernière entrée rythmique non ratée
// il y a moins d'un temps) — jamais automatiquement. Les projectiles sont jugés par collision.nowOnBeat.
// Aucune allocation par tir : SPEC et HIT sont des objets réutilisés, les requêtes de grille
// utilisent des variables de module au lieu de closures.

import { bus } from '../core/events.js';
import { emit as emitParticles } from '../render/particles.js';
import { shake } from '../render/camera.js';
import { beatDuration, beatsPerBar } from '../audio/conductor.js';
import { now } from '../audio/audio.js';
import { SPEC, resetSpec, spawnProjectile, spawnRing, nearestEnemy, hasHit, recordHit, clearHits } from './projectiles.js';
import { damageEnemy, markEnemy } from './collision.js';
import { playerAttack } from './player.js';
import { mult as resonanceMult, assist as resonanceAssist } from './resonance.js';
import { balance, weaponDef } from './data.js';
import { passiveLevel, passiveSpecial } from './passives.js';
import { spawnHazard, HAZARD_OPTS } from './hazards.js';

const HIT = { crit: false, onBeat: true, knockX: 0, knockY: 0, source: '' };
const TWO_PI = Math.PI * 2;

// Dernière frappe rythmique du sonneur (Chœur Muet : « sur le temps » exige un vrai coup juste).
let lastInputAt = -1e9, lastInputOk = false;
bus.on('rhythm:input', (e) => { lastInputAt = now(); lastInputOk = e.grade !== 'rate'; });
/** Le sonneur vient-il de frapper juste (moins d'un temps) ? Toujours vrai en mode « sans rythme ». */
export function playerOnBeat() { return resonanceAssist() === 'norhythm' || (lastInputOk && now() - lastInputAt <= (beatDuration() || 0.625) * 1.05); }
/** Le coup d'un Timbre compte-t-il « sur le temps » ? Timbre lourd (blanche, ronde) ou sonneur juste. */
export function weaponOnBeat(w) { return w.baseRhythm >= 2 || playerOnBeat(); }

// Contexte de la requête instantanée courante (arc / onde / aura / cône).
let cw = null, cp = null, cworld = null, cx = 0, cy = 0, cr2 = 0, cInner2 = 0, cDirX = 0, cDirY = 0, cCosHalf = -2;
let cDamage = 0, cKnock = 0, cCritChance = 0, cSource = '', cHits = 0, cChainAfter = false, cForceCrit = false, cOnBeat = true, cSlow = 1, cSlowSec = 0;

/** Dégâts de base d'un tir : arme × sonneur × Résonance (× écho). */
export function baseDamage(w, p) { return w.stats.damage * p.stats.damageMult * resonanceMult() * (w.dmgMult || 1); }

function rollCrit(world, chance) { return chance > 0 && world.rng.chance(chance); }
/** Critique d'un projectile : Étain garanti sur le temps fort, sinon tirage. */
export function critFor(w, p, world) { return !!w.forceCrit || rollCrit(world, p.stats.crit); }

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
  HIT.crit = crit; HIT.onBeat = cOnBeat; HIT.knockX = dx / d * cKnock; HIT.knockY = dy / d * cKnock; HIT.source = cSource;
  const dealt = damageEnemy(cworld, e, crit ? cDamage * balance().combat.critMult : cDamage, HIT);
  if (cSlow < 1 && dealt > 0 && e.state === 'alive') { const sec = e.boss ? cSlowSec * 0.25 : cSlowSec; if (cSlow < e.slow || e.slowT <= 0) e.slow = cSlow; e.slowT = Math.max(e.slowT, sec); }
  cHits++;
  if (cChainAfter) chainFrom(cworld, cw, cp, e, cDamage * 0.5, 3);
}

/** Frappe instantanée dans un disque (ou un secteur si cosHalf > -1, ou un anneau si inner > 0).
 *  slow < 1 : ralentit (0 = fige) ce qui est touché pendant slowSec. */
export function instantArea(w, p, world, x, y, range, dirX, dirY, cosHalf, inner, damage, knock, chainAfter, slow = 1, slowSec = 0) {
  cw = w; cp = p; cworld = world; cx = x; cy = y; cr2 = range * range; cInner2 = inner * inner;
  cDirX = dirX; cDirY = dirY; cCosHalf = cosHalf; cDamage = damage; cKnock = knock;
  cCritChance = p.stats.crit; cSource = w.id; cHits = 0; cChainAfter = chainAfter; cForceCrit = !!w.forceCrit || w.def.behavior === 'shockwave_chain';
  cOnBeat = weaponOnBeat(w); cSlow = slow; cSlowSec = slowSec;
  world.grid.query(x, y, range, instantHit);
  return cHits;
}

/** Projectile visuel (onde, cône, marque…). */
export function fxSprite(world, sprite, x, y, life, scale, growTo, followPlayer, vx, vy, alpha = 1) {
  resetSpec();
  SPEC.kind = 'fx'; SPEC.collides = false; SPEC.sprite = sprite; SPEC.x = x; SPEC.y = y; SPEC.life = life; SPEC.alpha = alpha;
  SPEC.scale = scale; SPEC.growTo = growTo; SPEC.fadeOut = true; SPEC.followPlayer = followPlayer; SPEC.vx = vx; SPEC.vy = vy;
  return spawnProjectile(world);
}

/** Éclair de chaîne parti d'un ennemi vers ses voisins (Chaîne d'Angélus, Tonnerre, Carillon, Écho de Clarine). */
export function chainFrom(world, w, p, from, damage, bounces) {
  const t = nearestEnemy(world, from.x, from.y, w.stats.range, null);
  if (!t || t === from) return;
  resetSpec();
  SPEC.kind = 'chain'; SPEC.sprite = w.def.projectileSprite; SPEC.x = from.x; SPEC.y = from.y; SPEC.r = 8;
  SPEC.speed = 420 * w.stats.speed; SPEC.life = 2; SPEC.damage = damage; SPEC.bounces = bounces; SPEC.weaponId = w.id;
  SPEC.knockback = w.stats.knockback; SPEC.target = t; SPEC.crit = critFor(w, p, world);
  const o = spawnProjectile(world);
  if (o) { recordHit(o, from.id); const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 1; o.vx = dx / d * o.speed; o.vy = dy / d * o.speed; }
}

export function facing(p) { const l = Math.hypot(p.facing.x, p.facing.y) || 1; fdir.x = p.facing.x / l; fdir.y = p.facing.y / l; return fdir; }
const fdir = { x: 0, y: 1 };
const ARC_OFFSETS = [0, Math.PI, -Math.PI / 2, Math.PI / 2];

// ---- Les 9 Timbres --------------------------------------------------------------------------

export const ARC_HALF = 1.22;          // demi-ouverture de l'arc (rad) : le secteur frappé et dessiné
const slashOpts = { angle: 0, spread: 1.4 };

/** Arc VFX du Battant (projectile 'fx' de forme 1, suit le sonneur, ~1/4 de temps). */
export function arcFx(world, p, angle, range, life, spread = ARC_HALF) {
  resetSpec();
  SPEC.kind = 'fx'; SPEC.collides = false; SPEC.shape = 1; SPEC.sprite = 'proj_cloche';
  SPEC.x = p.x; SPEC.y = p.y; SPEC.r = range; SPEC.angle = angle; SPEC.spread = spread; SPEC.life = life; SPEC.followPlayer = true;
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

/** Ennemi vivant d'identifiant `id` (rebond d'Écho depuis une cloche orbitale). */
function enemyById(world, id) {
  const items = world.enemies.items;
  for (let i = 0; i < items.length; i++) if (items[i].id === id && items[i].state === 'alive') return items[i];
  return null;
}

/** Clarine : cloches orbitales ; chaque temps réarme les cloches (une touche par ennemi par temps).
 *  Écho : ce que la cloche a touché pendant le temps relance un éclair vers les voisins (rebonds = niveau). */
function orbit(w, p, world) {
  const want = w.stats.count;
  const radius = w.stats.range * w.stats.area;
  const echo = w.def.behavior === 'orbit' ? passiveLevel(p, 'echo') : 0;
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
    if (echo > 0 && o.hitCount > 0) {
      const from = enemyById(world, o.hits[o.hitCount - 1]);
      if (from) chainFrom(world, w, p, from, o.damage * passiveSpecial('echo').orbitChainDamage, echo);
    }
    o.orbitR = radius; o.orbitSpeed = speed;
    o.damage = baseDamage(w, p); o.pierce = 99; o.bounces = w.stats.bounces || 0;
    clearHits(o);
  }
  return false;
}

/** Bourdon : anneau d'onde de choc au sol ; count > 1 = anneaux successifs (chacun frappe tout le disque, plus large).
 *  Contrepoids : l'onde laisse au sol une zone qui ralentit (10 %/niv) pendant un temps. */
function shockwave(w, p, world) {
  const dmg = baseDamage(w, p);
  const chain = w.def.behavior === 'shockwave_chain';
  let range = 0;
  for (let k = 0; k < w.stats.count; k++) {
    range = w.stats.range * w.stats.area * (1 + 0.35 * k);
    instantArea(w, p, world, p.x, p.y, range, 0, 0, -2, 0, dmg, w.stats.knockback, chain);
    spawnRing(world, p.x, p.y + 2, range, w.stats.duration * (1 + 0.4 * k)); // onde au sol (VFX)
  }
  const cl = passiveLevel(p, 'contrepoids');
  if (cl > 0) {
    const s = passiveSpecial('contrepoids');
    HAZARD_OPTS.slow = 1; HAZARD_OPTS.blockSec = 0; HAZARD_OPTS.damage = 0; HAZARD_OPTS.from = w.id;
    HAZARD_OPTS.enemySlow = Math.max(0.3, 1 - s.waveSlowPerLevel * cl); HAZARD_OPTS.enemyDamage = 0;
    spawnHazard(world, 'onde', p.x, p.y + 2, range, (beatDuration() || 0.625) * s.waveBeats * w.baseRhythm, HAZARD_OPTS);
  }
  fxSprite(world, w.def.projectileSprite, p.x, p.y - 30, 0.35, 0.6, 1, true, 0, -30); // glyphe sonore au-dessus du sonneur
  emitParticles('dust', p.x, p.y, dustRing);
  shake(chain ? 5 : 3, 0.2);
  return true;
}

/** Grelots : projectiles à tête chercheuse vers les ennemis les plus proches (Écho : rebonds). */
function homing(w, p, world) {
  const dmg = baseDamage(w, p);
  let t = null;
  for (let k = 0; k < w.stats.count; k++) {
    resetSpec();
    SPEC.kind = 'homing'; SPEC.sprite = w.def.projectileSprite; SPEC.x = p.x; SPEC.y = p.y - 8; SPEC.r = 7;
    SPEC.speed = 170 * w.stats.speed; SPEC.life = w.stats.duration; SPEC.damage = dmg; SPEC.pierce = w.stats.pierce;
    SPEC.bounce = p.stats.bounce; SPEC.weaponId = w.id; SPEC.knockback = w.stats.knockback;
    SPEC.crit = critFor(w, p, world);
    const a = (k / w.stats.count) * TWO_PI + world.rng.range(0, 0.5);
    SPEC.vx = Math.cos(a) * SPEC.speed; SPEC.vy = Math.sin(a) * SPEC.speed;
    const o = spawnProjectile(world);
    if (!o) break;
    t = nearestEnemy(world, p.x, p.y, w.stats.range * w.stats.area, t ? o : null);
    if (t) { o.target = t; o.targetId = t.id; }
  }
  return false;
}

/** Tocsin : aura continue, dégâts à chaque temps sur tout ce qui est dedans.
 *  Contrepoids : le centre de l'aura suit le sonneur avec retard (0,06 s/niv) et gonfle sur le temps fort (+8 %/niv). */
function aura(w, p, world) {
  const screen = w.def.behavior === 'aura_screen';
  const cl = screen ? 0 : passiveLevel(p, 'contrepoids');
  const swell = cl > 0 && Math.round(w.gridB) % beatsPerBar() === 0 ? 1 + passiveSpecial('contrepoids').auraSwell * cl : 1;
  const range = w.stats.range * (screen ? 1 : w.stats.area) * swell;
  const x = cl > 0 && w.auraInit ? w.auraX : p.x, y = cl > 0 && w.auraInit ? w.auraY : p.y;
  const dmg = baseDamage(w, p);
  const n = instantArea(w, p, world, x, y, range, 0, 0, -2, 0, dmg, w.stats.knockback, false);
  // VFX : anneau de bronze au sol qui s'ouvre sur le temps (jamais l'icône agrandie), plus quelques éclats.
  if (screen) { shake(6, 0.3); spawnRing(world, x, y + 2, range, 0.55); spawnRing(world, x, y + 2, range * 0.6, 0.4); }
  else spawnRing(world, x, y + 2, range, Math.min(0.45, beatDuration() * w.def.rhythm * 0.9));
  for (let k = 0; k < (screen ? 10 : 4); k++) {
    const a = (k / (screen ? 10 : 4)) * Math.PI * 2 + world.time;
    emitParticles('bell', x + Math.cos(a) * range * 0.7, y + Math.sin(a) * range * 0.42);
  }
  return screen || n >= 6;
}
/** Tick de l'aura : le centre rattrape le sonneur (retard proportionnel au Contrepoids). */
function auraUpdate(w, p, world, dt) {
  if (!w.auraInit) { w.auraX = p.x; w.auraY = p.y; w.auraInit = true; return; }
  const cl = passiveLevel(p, 'contrepoids');
  const lag = cl > 0 ? passiveSpecial('contrepoids').auraLagSec * cl : 0;
  const k = lag > 0 ? 1 - Math.exp(-dt / lag) : 1;
  w.auraX += (p.x - w.auraX) * k; w.auraY += (p.y - w.auraY) * k;
}

/** Cor de Brume : cône perforant devant qui ralentit ce qu'il touche (×0,6 pendant un temps) ;
 *  count > 1 ajoute des cônes décalés de ±20° (l'avant reste couvert). */
function cone(w, p, world) {
  const f = facing(p);
  const range = w.stats.range * w.stats.area;
  const dmg = baseDamage(w, p);
  const base = Math.atan2(f.y, f.x);
  const B = w.def.special || CONE_DEFAULT;
  for (let k = 0; k < w.stats.count; k++) {
    const a = base + (k === 0 ? 0 : (k % 2 ? 1 : -1) * 0.35 * Math.ceil(k / 2));
    instantArea(w, p, world, p.x, p.y, range, Math.cos(a), Math.sin(a), Math.cos(0.52), 0, dmg, w.stats.knockback, false, B.slow, (beatDuration() || 0.625) * B.slowBeats);
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
const CONE_DEFAULT = { slow: 0.6, slowBeats: 1 };

/** Crécelle : rafale courte portée sur les croches, projectiles perçants (Écho : rebonds). */
function burst(w, p, world) {
  const f = facing(p);
  const dmg = baseDamage(w, p);
  const speed = 260 * w.stats.speed;
  const base = Math.atan2(f.y, f.x);
  for (let k = 0; k < w.stats.count; k++) {
    resetSpec();
    SPEC.kind = 'linear'; SPEC.sprite = w.def.projectileSprite; SPEC.x = p.x; SPEC.y = p.y - 6; SPEC.r = 7;
    SPEC.speed = speed; SPEC.life = (w.stats.range * w.stats.area) / speed; SPEC.damage = dmg; SPEC.pierce = w.stats.pierce;
    SPEC.bounce = p.stats.bounce; SPEC.weaponId = w.id; SPEC.knockback = w.stats.knockback; SPEC.crit = critFor(w, p, world);
    const a = base + (k - (w.stats.count - 1) / 2) * 0.26 + world.rng.range(-0.08, 0.08);
    SPEC.vx = Math.cos(a) * speed; SPEC.vy = Math.sin(a) * speed;
    spawnProjectile(world);
  }
  return false;
}

/** Chaîne d'Angélus : éclair qui rebondit entre ennemis (Écho : +1 rebond par niveau). */
function chain(w, p, world) {
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

/**
 * Diapason : marque les ennemis (+dégâts subis) et la marque « résonne » : à chaque tir (chaque temps),
 * tout marqué subit damage × (1 + perAccordLevel × niveaux d'Accords) × Résonance (weapons.json diapason.special
 * .perAccordLevel, repli balance.mark : plafonné bas pour qu'aucun Accord ne dépasse +25 % de DPS par niveau).
 * Étain (crit) s'applique ; Contrepoids (area) étend la marque aux voisins (spreadPx × (area − 1)).
 * Requiem : exécute sous le seuil (collision.damageEnemy).
 */
const MARK_PER_ACCORD_DEFAULT = 0.03, MARK_FALLBACK_DAMAGE = 8;
// Taux « + dégâts de marque par niveau d'Accord » : special.perAccordLevel du Timbre, sinon celui du Timbre d'origine
// de la fusion (Requiem → weapons.json diapason.special), sinon balance.mark, sinon 0,03 — toujours fini (jamais NaN).
function markPerAccordLevel(w, M) {
  const src = w.def.weapon ? weaponDef(w.def.weapon) : null;
  for (const v of [w.def.special && w.def.special.perAccordLevel, src && src.special && src.special.perAccordLevel, M && M.perAccordLevel]) if (Number.isFinite(v)) return v;
  return MARK_PER_ACCORD_DEFAULT;
}

function mark(w, p, world) {
  const M = balance().mark;
  const range = w.stats.range * w.stats.area;
  const spread = (p.stats.area - 1) * M.spreadPx;
  let last = null;
  for (let k = 0; k < w.stats.count; k++) {
    const t = nearestUnmarked(world, p.x, p.y, range);
    if (!t) break;
    markEnemy(world, t, w.stats.duration, w.stats.markBonus, w.id, w.stats.executeBelow || 0);
    fxSprite(world, w.def.projectileSprite, t.x, t.y - 20, 0.5, 0.6, 1.2, false, 0, -30);
    if (spread > 0) spreadMark(world, w, t, spread);
    last = t;
  }
  // Résonance de la marque : un tick de dégâts sur chaque marqué par ce Timbre.
  let accords = 0;
  for (let i = 0; i < p.passives.length; i++) accords += p.passives[i].level;
  const base = w.stats.damage > 0 ? w.stats.damage : (Number.isFinite(M.fallbackDamage) ? M.fallbackDamage : MARK_FALLBACK_DAMAGE);
  const perLevel = markPerAccordLevel(w, M);
  let dmg = base * (1 + perLevel * accords) * p.stats.damageMult * resonanceMult() * (w.dmgMult || 1);
  if (!Number.isFinite(dmg)) dmg = 0;   // garde-fou : un NaN rendrait tout marqué immortel
  const items = world.enemies.items;
  const onBeat = weaponOnBeat(w);
  let hits = 0;
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (e.state !== 'alive' || e.markedT <= 0 || e.markBy !== w.id) continue;
    const crit = critFor(w, p, world);
    HIT.crit = crit; HIT.onBeat = onBeat; HIT.knockX = 0; HIT.knockY = 0; HIT.source = w.id;
    damageEnemy(world, e, crit ? dmg * balance().combat.critMult : dmg, HIT);
    hits++;
  }
  return (last !== null && w.def.behavior === 'mark_execute') || hits >= 8;
}

// Contrepoids : la marque gagne les voisins du marqué (rayon `spread`).
let sx = 0, sy = 0, sr2 = 0, sw = null, sworld = null;
function spreadHit(e) {
  if (e.state !== 'alive' || e.markedT > 0) return;
  const dx = e.x - sx, dy = e.y - sy;
  if (dx * dx + dy * dy > sr2) return;
  markEnemy(sworld, e, sw.stats.duration, sw.stats.markBonus, sw.id, sw.stats.executeBelow || 0);
}
function spreadMark(world, w, from, radius) {
  sx = from.x; sy = from.y; sr2 = radius * radius; sw = w; sworld = world;
  world.grid.query(from.x, from.y, radius, spreadHit);
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

/** Carillon (fusion) : cloches orbitales qui, au contact, lancent un éclair rebondissant (appelé par collision.js). */
export function orbitBounceHit(world, w, p, o, enemy) {
  if (o.bounces > 0) chainFrom(world, w, p, enemy, o.damage * 0.6, o.bounces);
}

/** Les 9 Timbres et les 4 fusions historiques ; weapons.js y ajoute FUSION_BEHAVIORS (fusion-behaviors.js). */
export const BEHAVIORS = {
  arc, orbit, shockwave, homing, aura, cone, burst, chain, mark,
  aura_screen: aura, orbit_bounce: orbit, shockwave_chain: shockwave, mark_execute: mark,
};
/** Ticks par comportement (facultatifs). */
export const UPDATES = { aura: auraUpdate };
/** Comportements sans projectile de collision (Écho : la frappe peut être rejouée une croche plus tard). */
export const INSTANT = { arc: 1, shockwave: 1, aura: 1, cone: 1, mark: 1, aura_screen: 1, shockwave_chain: 1, mark_execute: 1, arc_volee: 1, cone_parry: 1 };
export { hasHit };
