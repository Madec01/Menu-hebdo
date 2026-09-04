// game/enemy-behaviors.js — les 8 comportements d'ennemis. Signature : fn(e, dt, world, p).
// Chaque comportement écrit e.vx/e.vy (vitesse voulue) et gère ses états internes (e.aiState,
// e.aiT, e.aiX/aiY, e.aiBeat). Les cadences sont comptées en temps de la Mesure (world.beat).
// Paramètres `special` d'enemies.json documentés au-dessus de chaque comportement.

import { bus } from '../core/events.js';
import { emit as emitParticles } from '../render/particles.js';
import { play as playSfx } from '../audio/sfx.js';
import { SPEC, resetSpec, spawnProjectile } from './projectiles.js';
import { hitPlayer } from './player.js';
import { spawnHazard, HAZARD_OPTS } from './hazards.js';
import { spawnEnemy, killEnemy } from './enemies.js';
import { block as blockResonance } from './resonance.js';

const silencedPayload = { durationSec: 0 };
const blockedPayload = { durationSec: 0 };
const SILENCE_SPRITE = 'proj_onde';
const dir = { x: 0, y: 0, d: 1 };

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

/** Bâillon — { leapRange, leapSpeed, leapBeats, silenceSec } : bondit sur le joueur et coupe ses attaques. */
function leap(e, dt, world, p) {
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
      if (hitPlayer(p, e.damage, e.kind)) { silencedPayload.durationSec = s.silenceSec; bus.emit('player:silenced', silencedPayload); }
      e.aiState = 2; e.aiT = 0; e.aiBeat = world.beat;
    } else if (e.aiT > 0.5) { e.aiState = 2; e.aiT = 0; e.aiBeat = world.beat; }
  } else { // récupération
    e.aiT += dt;
    if (e.aiT > 0.4) e.aiState = 0;
  }
}

/** Ouateux — { cloudRadius, cloudSec, blockSec, triggerRange } : explose en nuage qui bloque la Résonance. */
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
  HAZARD_OPTS.slow = 1; HAZARD_OPTS.blockSec = s.blockSec; HAZARD_OPTS.damage = 0; HAZARD_OPTS.from = e.kind;
  spawnHazard(world, 'cloud', e.x, e.y, s.cloudRadius * size, s.cloudSec, HAZARD_OPTS);
  emitParticles('silence', e.x, e.y);
  playSfx('silence_burst', { x: e.x, y: e.y });
  blockedPayload.durationSec = s.blockSec;
  bus.emit('resonance:blocked', blockedPayload);
  const dx = p.x - e.x, dy = p.y - e.y;
  if (dx * dx + dy * dy < s.cloudRadius * s.cloudRadius * size * size) { hitPlayer(p, e.damage, e.kind); blockResonance(s.blockSec); }
  if (e.state === 'alive') { e.aiState = 2; killEnemy(world, e, ''); }
}

/** Fossoyeur — { keepDistance, fireBeats, projSpeed, projRadius, projLife, spread? } : tirs lents de Silence. */
function ranged(e, dt, world, p) {
  const s = e.def.special;
  const t = toward(e, p);
  if (t.d > s.keepDistance) moveTo(e, t.x, t.y, e.speed);
  else if (t.d < s.keepDistance * 0.7) moveTo(e, -t.x, -t.y, e.speed * 0.8);
  else moveTo(e, -t.y, t.x, e.speed * 0.5);
  if (world.beat - e.aiBeat >= s.fireBeats && world.beatChanged && t.d < 420) {
    e.aiBeat = world.beat; e.animBase = 'attack';
    const n = s.spread || 1;
    for (let k = 0; k < n; k++) {
      const a = Math.atan2(t.y, t.x) + (k - (n - 1) / 2) * 0.35;
      fireSilence(world, e, Math.cos(a), Math.sin(a), s.projSpeed, s.projRadius, s.projLife, e.damage);
    }
    playSfx('silence_cry', { x: e.x, y: e.y, volume: 0.6 });
  }
}

/** Chœur Muet — { wobble, wobbleHz } : nuée rapide et ondulante ; ne meurt que sur un coup sur le temps. */
function swarm(e, dt, world, p) {
  const t = toward(e, p);
  e.aiT += dt;
  const w = Math.sin(e.aiT * e.def.special.wobbleHz * Math.PI * 2 + e.id) * e.def.special.wobble;
  moveTo(e, t.x * e.speed - t.y * w, t.y * e.speed + t.x * w, 1);
}

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

/** Veuve grise — { teleportBeats, teleportDist, chargeSpeed, chargeSec, pauseSec } : se téléporte près du joueur puis charge. */
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
  } else if (e.aiState === 1) { // pause de télégraphie
    e.aiT += dt;
    if (e.aiT >= s.pauseSec) { e.aiState = 2; e.aiT = 0; e.aiX = t.x; e.aiY = t.y; }
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

export const BEHAVIORS = { chase, leap, explode, ranged, swarm, crawl, veuve_grise: veuveGrise, summon };
