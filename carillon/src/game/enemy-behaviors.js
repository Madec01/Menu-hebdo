// game/enemy-behaviors.js — les 11 comportements d'ennemis. Signature : fn(e, dt, world, p).
// Chaque comportement écrit e.vx/e.vy (vitesse voulue) et gère ses états internes (e.aiState,
// e.aiT, e.aiX/aiY, e.aiBeat). Les cadences sont comptées en temps de la Mesure (world.beat).
// Paramètres `special` d'enemies.json documentés au-dessus de chaque comportement.
// Ennemis rythmiques (audit § 3.2) :
//   contretemps  — invulnérable sauf dans la fenêtre de la croche entre deux temps (e.vulnMult 0 → 1 dégât
//                  minimal, voir hook demandé au cœur) ; une frappe du sonneur SUR la croche l'ouvre un temps
//                  (et, à portée, elle est jugée contre la croche : bon/parfait, pas un raté — player.judgeAction) ;
//                  il tire sur le contretemps.
//   voleur       — au contact, vole un cran de Résonance qu'il emporte (e.carry, halo bronze) puis fuit à
//                  distance ; le tuer rend le cran (enemies.killEnemy).
//   desaccordeur — fausse la musique quand il est proche : `enemy:desaccord {x, y, depth}` (une fois par tick,
//                  profondeur max) et music.setDetune(cents, x, y) si l'audio le fournit ; tire une croche
//                  après le temps (projectiles hors grille : parer coûte un raté).

import { bus } from '../core/events.js';
import { emit as emitParticles } from '../render/particles.js';
import { play as playSfx } from '../audio/sfx.js';
import { phase, beatDuration, windowMs } from '../audio/conductor.js';
import { SPEC, resetSpec, spawnProjectile } from './projectiles.js';
import { hitPlayer } from './player.js';
import { spawnHazard, HAZARD_OPTS } from './hazards.js';
import { spawnEnemy, killEnemy } from './enemies.js';
import { block as blockResonance, bump as bumpResonance, tier as resonanceTier } from './resonance.js';

const silencedPayload = { durationSec: 0 };
const blockedPayload = { durationSec: 0 };
const desaccordPayload = { x: 0, y: 0, depth: 0 };
const SILENCE_SPRITE = 'proj_onde';
const dir = { x: 0, y: 0, d: 1 };
let openUntil = -1;          // temps (world.time) jusqu'auquel les Contretemps sont ouverts par une frappe du sonneur
let musicMod = null;         // audio/music.js (chargé à la demande : setDetune est fourni par l'agent audio)
import('../audio/music.js').then((m) => { musicMod = m; }).catch(() => {});

// Une frappe rythmique tombée SUR la croche ouvre les Contretemps un temps : « frappe au contretemps » jugée
// bon/parfait contre la croche (player.judgeAction, quand un Contretemps est à portée — elle n'est PAS un raté),
// ou frappe dans la fenêtre de la croche (Contretemps hors de portée : elle reste jugée contre le temps).
bus.on('rhythm:input', (e) => {
  const bd = beatDuration() || 0.625;
  if (e && e.offbeat && e.grade !== 'rate') { openUntil = bd; return; }
  if (Math.abs(phase() - 0.5) * bd * 1000 <= windowMs()) openUntil = bd;
});

/** Direction normalisée de e vers p (objet réutilisé) et distance. */
function toward(e, p) {
  const dx = p.x - e.x, dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  dir.x = dx / d; dir.y = dy / d; dir.d = d;
  return dir;
}

function moveTo(e, dx, dy, speed) { e.vx = dx * speed; e.vy = dy * speed; }

/** Projectile de Silence (parable) tiré par un ennemi. */
export function fireSilence(world, e, dx, dy, speed, r, life, damage) {
  resetSpec();
  SPEC.kind = 'linear'; SPEC.owner = 'enemy'; SPEC.sprite = SILENCE_SPRITE; SPEC.x = e.x; SPEC.y = e.y - 10; SPEC.r = r;
  SPEC.speed = speed; SPEC.vx = dx * speed; SPEC.vy = dy * speed; SPEC.life = life; SPEC.damage = damage;
  SPEC.scale = r / 18; SPEC.tint = '#8f8d93'; SPEC.pierce = 1; SPEC.weaponId = e.kind;
  return spawnProjectile(world);
}

/** Feutre — { auraRadius } : poursuite ; son aura étouffe la musique (player:inAura). */
function chase(e, dt, world, p) {
  const t = toward(e, p);
  moveTo(e, t.x, t.y, e.speed);
  const ar = e.def.special.auraRadius;
  if (t.d < ar) { const depth = 1 - t.d / ar; if (depth > world.auraDepth) world.auraDepth = depth; }
}

/** Bâillon — { leapRange, leapSpeed, leapBeats, silenceSec } : bondit sur le joueur et coupe ses attaques.
 *  onTouch(e, p) : effet du bond qui porte (Bâillon : silence ; Voleur : vol d'un cran). */
function leapCore(e, dt, world, p, onTouch) {
  const s = e.def.special;
  const t = toward(e, p);
  if (e.aiState === 0) { // approche
    moveTo(e, t.x, t.y, e.speed);
    if (t.d < s.leapRange && world.beat - e.aiBeat >= s.leapBeats) {
      e.aiState = 1; e.aiT = 0; e.aiX = t.x; e.aiY = t.y; e.animBase = 'attack';
    }
  } else if (e.aiState === 1) { // bond
    e.aiT += dt;
    moveTo(e, e.aiX, e.aiY, s.leapSpeed);
    if (t.d < e.r + p.r + 4) {
      if (hitPlayer(p, e.damage, e.kind)) onTouch(e, p);
      e.aiState = 2; e.aiT = 0; e.aiBeat = world.beat;
    } else if (e.aiT > 0.5) { e.aiState = 2; e.aiT = 0; e.aiBeat = world.beat; }
  } else { // récupération
    e.aiT += dt;
    if (e.aiT > 0.4) e.aiState = 0;
  }
}
function silenceTouch(e) { silencedPayload.durationSec = e.def.special.silenceSec; bus.emit('player:silenced', silencedPayload); }
function leap(e, dt, world, p) { leapCore(e, dt, world, p, silenceTouch); }

/** Voleur de cran — { leapRange, leapSpeed, leapBeats, fleeDistance, fleeSpeedMult, carryTint } : le bond qui porte
 *  vole un cran de Résonance ; chargé, il fuit et rôde à fleeDistance (le tuer rend le cran). */
function stealTouch(e, p) {
  if (e.carry > 0 || resonanceTier() <= 0) return;
  bumpResonance(-1);
  e.carry = 1; e.tint = e.def.special.carryTint;
  emitParticles('bell', p.x, p.y - 8);
  playSfx('resonance_drop', { x: e.x, y: e.y });
}
function voleur(e, dt, world, p) {
  if (e.carry <= 0) { leapCore(e, dt, world, p, stealTouch); return; }
  const s = e.def.special;
  const t = toward(e, p);
  if (t.d < s.fleeDistance) moveTo(e, -t.x, -t.y, e.speed * s.fleeSpeedMult);
  else moveTo(e, -t.y, t.x, e.speed * 0.6);   // rôde autour, hors de portée de mêlée
  // (flashT n'est pas touché : les coups reçus doivent clignoter, la teinte bronze du cran emporté reste e.tint)
}

/** Ouateux — { cloudRadius, cloudSec, blockSec, triggerRange, drainBeats } : explose en nuage qui bloque la Résonance
 *  et avale un cran au sonneur qui y reste drainBeats temps (hazards.js). */
function explode(e, dt, world, p) {
  const s = e.def.special;
  const t = toward(e, p);
  if (e.aiState === 0) {
    moveTo(e, t.x, t.y, e.speed);
    if (t.d < s.triggerRange) { e.aiState = 1; e.aiT = 0; e.animBase = 'attack'; }
  } else {
    e.aiT += dt;
    e.flashT = 0.03; // clignote pendant la mèche
    if (e.aiT >= 0.6) burstCloud(world, e, p, 1);
  }
}

/** Nuage d'Ouateux (aussi déclenché à sa mort, plus petit). */
export function burstCloud(world, e, p, size) {
  const s = e.def.special;
  HAZARD_OPTS.slow = 1; HAZARD_OPTS.blockSec = s.blockSec; HAZARD_OPTS.damage = 0; HAZARD_OPTS.from = e.kind; HAZARD_OPTS.drainBeats = s.drainBeats || 0;
  spawnHazard(world, 'cloud', e.x, e.y, s.cloudRadius * size, s.cloudSec, HAZARD_OPTS);
  emitParticles('silence', e.x, e.y);
  playSfx('silence_burst', { x: e.x, y: e.y });
  blockedPayload.durationSec = s.blockSec;
  bus.emit('resonance:blocked', blockedPayload);
  const dx = p.x - e.x, dy = p.y - e.y;
  if (dx * dx + dy * dy < s.cloudRadius * s.cloudRadius * size * size) { hitPlayer(p, e.damage, e.kind); blockResonance(s.blockSec); }
  if (e.state === 'alive') { e.aiState = 2; killEnemy(world, e, ''); }
}

/** Garde la distance (Fossoyeur, Contretemps, Désaccordeur) et renvoie toward(). */
function keepDistance(e, p, keep, strafe) {
  const t = toward(e, p);
  if (t.d > keep) moveTo(e, t.x, t.y, e.speed);
  else if (t.d < keep * 0.7) moveTo(e, -t.x, -t.y, e.speed * 0.8);
  else moveTo(e, -t.y, t.x, e.speed * strafe);
  return t;
}

/** Tir(s) de Silence vers le joueur, `n` en éventail. */
function volley(world, e, t, n, s) {
  e.animBase = 'attack';
  for (let k = 0; k < n; k++) {
    const a = Math.atan2(t.y, t.x) + (k - (n - 1) / 2) * 0.35;
    fireSilence(world, e, Math.cos(a), Math.sin(a), s.projSpeed, s.projRadius, s.projLife, e.damage);
  }
  playSfx('silence_cry', { x: e.x, y: e.y, volume: 0.6 });
}

/** Fossoyeur — { keepDistance, fireBeats, projSpeed, projRadius, projLife, spread? } : tirs lents de Silence sur le temps. */
function ranged(e, dt, world, p) {
  const s = e.def.special;
  const t = keepDistance(e, p, s.keepDistance, 0.5);
  if (world.beat - e.aiBeat >= s.fireBeats && world.beatChanged && t.d < 420) { e.aiBeat = world.beat; volley(world, e, t, s.spread || 1, s); }
}

/** Contretemps — { keepDistance, fireBeats, projSpeed, projRadius, projLife, openBeats, openTint, openScale } :
 *  vulnérable seulement dans la fenêtre de la croche (phase ≈ 0,5), ou un temps après une frappe du sonneur sur
 *  la croche ; visuel qui « s'ouvre » (teinte claire, plus grand) ; tire sur le contretemps. */
function contretemps(e, dt, world, p) {
  const s = e.def.special;
  const t = keepDistance(e, p, s.keepDistance, 0.5);
  const ph = phase();
  const open = openUntil > 0 || Math.abs(ph - 0.5) * (beatDuration() || 0.625) * 1000 <= windowMs();
  e.vulnMult = open ? 1 : 0;
  e.tint = open ? s.openTint : e.def.tint;
  e.scale = (e.def.scale || 1) * (open ? s.openScale : 1);
  if (world.beat - e.aiBeat >= s.fireBeats && world.offbeatChanged && t.d < 420) { e.aiBeat = world.beat; volley(world, e, t, 1, s); }
}

/** Chœur Muet — { wobble, wobbleHz } : nuée rapide et ondulante ; ne meurt que sur un coup sur le temps. */
function swarm(e, dt, world, p) {
  const t = toward(e, p);
  e.aiT += dt;
  const w = Math.sin(e.aiT * e.def.special.wobbleHz * Math.PI * 2 + e.id) * e.def.special.wobble;
  moveTo(e, t.x * e.speed - t.y * w, t.y * e.speed + t.x * w, 1);
}

/** Désaccordeur — { detuneRadius, detuneCents, fireBeats, fireRange, projSpeed, projRadius, projLife, wobble, wobbleHz } :
 *  approche en ondulant, fausse la musique dans son rayon, tire une croche après le temps. */
function desaccordeur(e, dt, world, p) {
  const s = e.def.special;
  const t = keepDistance(e, p, s.detuneRadius * 0.6, 0.7);
  e.aiT += dt;
  const w = Math.sin(e.aiT * s.wobbleHz * Math.PI * 2 + e.id) * s.wobble;
  e.vx += -t.y * w; e.vy += t.x * w;
  if (t.d < s.detuneRadius) {
    const depth = 1 - t.d / s.detuneRadius;
    if (depth > world.detuneDepth) { world.detuneDepth = depth; world.detuneX = e.x; world.detuneY = e.y; world.detuneCents = s.detuneCents * depth; }
  }
  if (world.beat - e.aiBeat >= s.fireBeats && world.offbeatChanged && t.d < s.fireRange) { e.aiBeat = world.beat; volley(world, e, t, 1, s); }
}

/** Fin de tick (enemies.updateEnemies) : émet `enemy:desaccord` et applique le désaccord à la musique. */
export function applyDetune(world) {
  const depth = Math.min(1, world.detuneDepth || 0);
  if (depth <= 0 && !world.detuneWasIn) return;
  desaccordPayload.x = world.detuneX || 0; desaccordPayload.y = world.detuneY || 0; desaccordPayload.depth = depth;
  bus.emit('enemy:desaccord', desaccordPayload);
  if (musicMod && typeof musicMod.setDetune === 'function') musicMod.setDetune(depth > 0 ? world.detuneCents : 0, desaccordPayload.x, desaccordPayload.y);
  world.detuneWasIn = depth > 0;
}

/** Tick global des comportements (enemies.updateEnemies) : fenêtre d'ouverture des Contretemps. */
export function tickBehaviors(dt) { if (openUntil > 0) openUntil -= dt; }

/** Rampe de suie — { trailRadius, trailSec, trailEvery, slow } : lente, laisse une traînée qui ralentit. */
function crawl(e, dt, world, p) {
  const t = toward(e, p);
  moveTo(e, t.x, t.y, e.speed);
  e.aiT += dt;
  if (e.aiT >= e.def.special.trailEvery) {
    e.aiT = 0;
    HAZARD_OPTS.slow = e.def.special.slow; HAZARD_OPTS.blockSec = 0; HAZARD_OPTS.damage = 0; HAZARD_OPTS.from = e.kind;
    spawnHazard(world, 'trail', e.x, e.y + 4, e.def.special.trailRadius, e.def.special.trailSec, HAZARD_OPTS);
  }
}

/** Veuve grise — { teleportBeats, teleportDist, chargeSpeed, chargeSec, pauseSec, chargeOnBar } : se téléporte près du
 *  joueur sur un temps, télégraphie au moins pauseSec, puis charge SUR LE TEMPS FORT (parable en rythme). */
function veuveGrise(e, dt, world, p) {
  const s = e.def.special;
  const t = toward(e, p);
  if (e.aiState === 0) { // rôde
    moveTo(e, t.x, t.y, e.speed * 0.6);
    if (world.beat - e.aiBeat >= s.teleportBeats && world.beatChanged) {
      emitParticles('silence', e.x, e.y - 8);
      const a = world.rng.range(0, Math.PI * 2);
      e.x = p.x + Math.cos(a) * s.teleportDist; e.y = p.y + Math.sin(a) * s.teleportDist;
      e.px = e.x; e.py = e.y;
      emitParticles('silence', e.x, e.y - 8);
      playSfx('silence_cry', { x: e.x, y: e.y, volume: 0.5 });
      e.aiState = 1; e.aiT = 0; e.animBase = 'attack';
    }
  } else if (e.aiState === 1) { // télégraphie : au moins pauseSec, puis le prochain temps fort (ou temps si chargeOnBar est faux)
    e.aiT += dt;
    e.flashT = ((e.aiT * 8) | 0) % 2 === 0 ? 0.03 : 0;   // bat avec la Mesure
    const grid = world.beatChanged && (!s.chargeOnBar || world.beatInBar === 0);
    if (e.aiT >= s.pauseSec && grid) { e.aiState = 2; e.aiT = 0; e.aiX = t.x; e.aiY = t.y; e.flashT = 0; }
  } else { // charge
    e.aiT += dt;
    moveTo(e, e.aiX, e.aiY, s.chargeSpeed);
    if (e.aiT >= s.chargeSec) { e.aiState = 0; e.aiBeat = world.beat; }
  }
}

/** Cierge — { summonKind, summonCount, summonBeats, keepDistance, lightRadius } : élite qui invoque des Feutres. */
function summon(e, dt, world, p) {
  const s = e.def.special;
  const t = toward(e, p);
  if (t.d > s.keepDistance) moveTo(e, t.x, t.y, e.speed);
  else if (t.d < s.keepDistance * 0.6) moveTo(e, -t.x, -t.y, e.speed);
  if (world.beat - e.aiBeat >= s.summonBeats && world.beatChanged) {
    e.aiBeat = world.beat; e.animBase = 'attack';
    for (let k = 0; k < s.summonCount; k++) {
      const a = (k / s.summonCount) * Math.PI * 2;
      const m = spawnEnemy(world, s.summonKind, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30);
      if (m) emitParticles('ember', m.x, m.y);
    }
    playSfx('silence_cry', { x: e.x, y: e.y });
  }
}

export const BEHAVIORS = { chase, leap, explode, ranged, swarm, crawl, veuve_grise: veuveGrise, summon, contretemps, voleur, desaccordeur };
