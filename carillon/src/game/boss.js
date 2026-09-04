// game/boss.js — Fêlures (élites, min 4 et 8) et les 3 boss (ARCHITECTURE.md § 11).
// Phases calées sur les temps forts (world.barChanged / beatChanged / offbeatChanged) :
//   bourdon_fele : anneau d'ondes de Silence à chaque mesure, invocation de Feutres, phase 2 à 50 % PV
//                  (double anneau décalé).
//   veuve_suie   : toiles qui ralentissent, charge après téléportation, enfants (Veuves grises) à 66/33 %.
//   maitre       : rejoue les 9 Timbres à l'envers (diapason → battant), une attaque par mesure,
//                  frappée SUR LE CONTRETEMPS (la croche entre les temps) : la parade sur le temps fort
//                  reste lisible. Ses phases suivent le cran de Résonance du joueur : cran 3 = exposé
//                  (dégâts subis ×exposedMult), cran 0 = enragé (vitesse ×enrageSpeed).
// Événements : run:fissure {bossId, phase}, run:boss {bossId, phase, index}. Zoom via camera.setZoom.

import { bus } from '../core/events.js';
import { play as playSfx } from '../audio/sfx.js';
import { setZoom, shake } from '../render/camera.js';
import { emit as emitParticles } from '../render/particles.js';
import { balance } from './data.js';
import { spawnEnemy } from './enemies.js';
import { fireSilence } from './enemy-behaviors.js';
import { spawnHazard, HAZARD_OPTS } from './hazards.js';
import { hitPlayer } from './player.js';
import { tier as resonanceTier } from './resonance.js';
import { offscreenPos } from './spawner.js';

const fissurePayload = { bossId: '', phase: 'start' };
const bossPayload = { bossId: '', phase: 'intro', index: 0 };
const pos = { x: 0, y: 0 };
const TWO_PI = Math.PI * 2;

function emitBoss(id, phase, index) { bossPayload.bossId = id; bossPayload.phase = phase; bossPayload.index = index; bus.emit('run:boss', bossPayload); }

/** Fêlure : un élite apparaît hors écran. */
export function startFissure(world, kind, p) {
  offscreenPos(world, p, pos);
  const e = spawnEnemy(world, kind, pos.x, pos.y);
  if (!e) return;
  world.fissure = e; world.fissureId = e.id;
  fissurePayload.bossId = kind; fissurePayload.phase = 'start';
  bus.emit('run:fissure', fissurePayload);
  playSfx('boss_roar', { volume: 0.7 });
  shake(3, 0.4);
}

/** Boss : intro (immobile), zoom, puis combat. */
export function startBoss(world, bossId, p) {
  const B = balance().boss;
  offscreenPos(world, p, pos);
  const e = spawnEnemy(world, bossId, pos.x, pos.y);
  if (!e) return;
  e.aiState = -1; e.aiT = 0; e.vulnMult = 1;
  world.boss = e; world.bossId = e.id; world.bossKind = bossId;
  emitBoss(bossId, 'intro', 0);
  setZoom(B.zoom, B.zoomSec);
  playSfx('boss_roar');
  shake(6, 0.8);
}

/** Tick de la gestion boss/Fêlure (fin de Fêlure, fin de boss). */
export function updateBoss(world, dt, p) {
  const B = balance().boss;
  const f = world.fissure;
  if (f && (!f.active || f.id !== world.fissureId || f.state !== 'alive')) {
    fissurePayload.bossId = f.kind; fissurePayload.phase = 'end';
    bus.emit('run:fissure', fissurePayload);
    world.fissure = null;
  }
  const b = world.boss;
  if (!b) return;
  if (b.aiState === -1) {
    b.aiT += dt;
    if (b.aiT >= B.introSec) { b.aiState = 0; b.aiT = 0; b.lastBar = world.bar; emitBoss(world.bossKind, 'start', 0); }
    return;
  }
  if (!b.active || b.id !== world.bossId || b.state !== 'alive') {
    emitBoss(world.bossKind, 'end', 0);
    setZoom(1, B.zoomSec);
    world.bossKilled = world.bossKind;
    world.boss = null; world.victory = true; world.ended = true;
  }
}

/** Comportement 'boss' (appelé par enemies.js). */
export function updateBossEnemy(e, dt, world, p) {
  if (e.aiState === -1) { e.flashT = 0; return; }
  const kind = e.kind;
  if (kind === 'bourdon_fele') bourdonFele(e, dt, world, p);
  else if (kind === 'veuve_suie') veuveSuie(e, dt, world, p);
  else maitre(e, dt, world, p);
}

function chase(e, p, speed) {
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
  e.vx = dx / d * speed; e.vy = dy / d * speed;
  return d;
}

function ring(world, e, count, offset, s) {
  for (let k = 0; k < count; k++) {
    const a = offset + (k / count) * TWO_PI;
    fireSilence(world, e, Math.cos(a), Math.sin(a), s.ringSpeed, s.ringRadius, s.ringLife, e.damage);
  }
  e.animBase = 'attack';
  playSfx('silence_cry', { x: e.x, y: e.y });
}

function bourdonFele(e, dt, world, p) {
  const s = e.def.special;
  const d = chase(e, p, e.speed);
  if (d < e.r + p.r + 6) { e.vx = 0; e.vy = 0; }
  if (e.phase === 0 && e.hp / e.maxHp <= s.phase2At) { e.phase = 1; emitBoss(e.kind, 'phase', 2); shake(6, 0.5); emitParticles('silence', e.x, e.y); }
  if (world.barChanged) {
    ring(world, e, s.ringCount, 0, s);
    e.aiT++;
    if (e.aiT % s.summonBars === 0) {
      for (let k = 0; k < s.summonCount; k++) {
        const a = (k / s.summonCount) * TWO_PI;
        spawnEnemy(world, s.summonKind, e.x + Math.cos(a) * 50, e.y + Math.sin(a) * 40);
      }
    }
  }
  if (e.phase === 1 && world.beatChanged && world.beatInBar === 2) ring(world, e, s.ringCount, Math.PI / s.ringCount, s);
}

function veuveSuie(e, dt, world, p) {
  const s = e.def.special;
  // Enfants aux seuils de PV.
  const ratio = e.hp / e.maxHp;
  while (e.phase < s.childAt.length && ratio <= s.childAt[e.phase]) {
    e.phase++;
    emitBoss(e.kind, 'phase', e.phase + 1);
    for (let k = 0; k < s.childCount; k++) spawnEnemy(world, s.childKind, e.x + (k ? 40 : -40), e.y + 20);
  }
  if (e.aiState === 0) {
    chase(e, p, e.speed);
    if (world.barChanged) {
      e.aiT++;
      if (e.aiT % s.webBars === 0) {
        HAZARD_OPTS.slow = s.slow; HAZARD_OPTS.blockSec = 0; HAZARD_OPTS.damage = 0; HAZARD_OPTS.from = e.kind;
        spawnHazard(world, 'web', p.x + world.rng.range(-30, 30), p.y + world.rng.range(-20, 20), s.webRadius, s.webSec, HAZARD_OPTS);
        e.animBase = 'attack';
      }
      if (e.aiT % s.chargeBars === 0) {
        emitParticles('silence', e.x, e.y);
        const a = world.rng.range(0, TWO_PI);
        e.x = p.x + Math.cos(a) * 130; e.y = p.y + Math.sin(a) * 90; e.px = e.x; e.py = e.y;
        emitParticles('silence', e.x, e.y);
        e.aiState = 1; e.aiX = 0;
      }
    }
  } else if (e.aiState === 1) { // télégraphie jusqu'au prochain temps, puis charge
    e.vx = 0; e.vy = 0;
    if (world.beatChanged) { const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1; e.aiX = dx / d; e.aiY = dy / d; e.aiState = 2; e.stateT = 0; e.animBase = 'attack'; }
  } else {
    e.stateT += dt;
    e.vx = e.aiX * s.chargeSpeed; e.vy = e.aiY * s.chargeSpeed;
    if (e.stateT >= s.chargeSec) e.aiState = 0;
  }
}

// Les 9 Timbres du Maître, du dernier au premier (index 8 → 0).
function maitre(e, dt, world, p) {
  const s = e.def.special;
  const t = resonanceTier();
  if (t !== e.phase) {
    e.phase = t; emitBoss(e.kind, 'phase', t);
    e.vulnMult = t === 3 ? s.exposedMult : 1;
    e.tint = t === 3 ? '#d8cdb4' : t === 0 ? '#e0603a' : null;
  }
  const speed = e.speed * (t === 0 ? s.enrageSpeed : 1);
  const d = chase(e, p, e.aiState === 2 ? 320 : speed);
  if (d < e.r + p.r + 6 && e.aiState !== 2) { e.vx = 0; e.vy = 0; }
  if (world.barChanged) { e.aiT = (e.aiT + 8) % 9; e.aiState = 0; } // aiT = timbre courant, décrémenté
  if (e.aiState === 2) { e.stateT += dt; if (e.stateT > 0.5) e.aiState = 0; }
  if (!world.offbeatChanged) return;
  const first = world.beatInBar === 0;
  const dx = p.x - e.x, dy = p.y - e.y, dd = Math.hypot(dx, dy) || 1, ux = dx / dd, uy = dy / dd;
  const timbre = e.aiT;
  e.animBase = 'attack';
  switch (timbre) {
    case 8: if (first) { p.markedT = s.markSec; emitParticles('parry', p.x, p.y); } break;                  // diapason : marque le joueur
    case 7: if (first) fireSilence(world, e, ux, uy, s.projSpeed * 1.6, s.projRadius, s.projLife, e.damage); break; // chaîne : trait rapide
    case 6: fireSilence(world, e, ux, uy, s.projSpeed * 1.3, s.projRadius * 0.8, 1.5, Math.round(e.damage * 0.5)); break; // crécelle : chaque contretemps
    case 5: if (first) for (let k = -2; k <= 2; k++) { const a = Math.atan2(uy, ux) + k * 0.25; fireSilence(world, e, Math.cos(a), Math.sin(a), s.projSpeed, s.projRadius, s.projLife, e.damage); } break; // cor : cône
    case 4: if (first && dd < 90) hitPlayer(p, e.damage, e.kind); if (first) emitParticles('silence', e.x, e.y); break; // tocsin : aura
    case 3: if (first || world.beatInBar === 2) fireSilence(world, e, ux, uy, s.projSpeed * 0.6, s.projRadius * 1.2, s.projLife * 1.5, e.damage); break; // grelots : lents
    case 2: if (first) for (let k = 0; k < 8; k++) { const a = k / 8 * TWO_PI; fireSilence(world, e, Math.cos(a), Math.sin(a), s.projSpeed * 0.7, s.projRadius, s.projLife, e.damage); } break; // bourdon : anneau
    case 1: for (let k = 0; k < 2; k++) { const a = world.beatInBar * Math.PI / 2 + k * Math.PI; fireSilence(world, e, Math.cos(a), Math.sin(a), s.projSpeed * 0.5, s.projRadius, 2, e.damage); } break; // clarine : spirale
    default: if (first) { e.aiState = 2; e.stateT = 0; } // battant : charge
  }
  playSfx('silence_cry', { x: e.x, y: e.y, volume: 0.5 });
}
