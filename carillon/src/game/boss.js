// game/boss.js — Fêlures (élites, 40 % et 70 % de la nuit) et les 3 boss (ARCHITECTURE.md § 11, audit § 4).
// Phases calées sur les temps forts (world.barChanged / beatChanged / offbeatChanged) :
//   bourdon_fele : chaque mesure, un double anneau de Silence (deux couches décalées d'un demi-pas : on ne
//                  passe qu'en Volée — les i-frames traversent — ou en parant un segment) ; invocation de
//                  Feutres ; toutes les criBars mesures, le CRI FÊLÉ (`boss:phase 'cri'`, 2 mesures : le
//                  conducteur décale la Mesure d'une croche — voir rapport) ; phase 2 (≤ 50 %) : second anneau
//                  sur le 3e temps et Chœurs Muets invoqués ; phase 3 (≤ 20 %) : il « sonne à l'envers », les
//                  anneaux partent du bord (inverseRadius) vers lui.
//   veuve_suie   : toiles sur le 2e temps, téléportation sur le 4e temps puis charge sur le temps fort suivant ;
//                  enfants à 66 % (`enfants`) ; à 33 % (`deuil`) : toiles en couronne et double charge.
//   maitre       : rejoue les 9 Timbres à l'envers (diapason → battant), une attaque par mesure sur le
//                  CONTRETEMPS ; annonce le Timbre suivant une mesure à l'avance (`boss:phase 'annonce'`,
//                  champ `timbre`) ; phases selon le cran de Résonance (exposé ×exposedMult au cran 3, enragé
//                  au cran 0) ; coda (≤ codaAt) : attaque aussi sur le temps.
// Événements : run:fissure {bossId, phase}, run:boss {bossId, phase, index} (inchangé) et
// boss:phase {bossId, phase, index, timbre} à chaque changement lisible (bannière). Zoom via camera.setZoom.

import { bus } from '../core/events.js';
import { play as playSfx } from '../audio/sfx.js';
import { beatDuration } from '../audio/conductor.js';
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
const phasePayload = { bossId: '', phase: '', index: 0, timbre: '' };
const pos = { x: 0, y: 0 };
const TWO_PI = Math.PI * 2;
// Les 9 Timbres que le Maître rejoue, du dernier (index 8) au premier.
const TIMBRE_ORDER = ['battant', 'clarine', 'bourdon', 'grelots', 'tocsin', 'cor_de_brume', 'crecelle', 'chaine_d_angelus', 'diapason'];
const TIER_PHASE = ['enrage', 'normal', 'normal', 'expose'];

function emitBoss(id, phase, index) { bossPayload.bossId = id; bossPayload.phase = phase; bossPayload.index = index; bus.emit('run:boss', bossPayload); }
function emitPhase(id, phase, index = 0, timbre = '') { phasePayload.bossId = id; phasePayload.phase = phase; phasePayload.index = index; phasePayload.timbre = timbre; bus.emit('boss:phase', phasePayload); }

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

function summonRing(world, e, kind, count, r) {
  for (let k = 0; k < count; k++) {
    const a = (k / count) * TWO_PI;
    spawnEnemy(world, kind, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.8);
  }
}

// ---- Le Bourdon Fêlé ------------------------------------------------------------------------------

/** Anneau à `layers` couches décalées d'un demi-pas (la seconde suit à layerGap px : infranchissable sans i-frames). */
function ring(world, e, count, offset, s) {
  const layers = s.ringLayers || 1;
  for (let L = 0; L < layers; L++) {
    for (let k = 0; k < count; k++) {
      const a = offset + (k / count) * TWO_PI + (L % 2) * Math.PI / count;
      const o = fireSilence(world, e, Math.cos(a), Math.sin(a), s.ringSpeed, s.ringRadius, s.ringLife, e.damage);
      if (o && L > 0) { o.x -= Math.cos(a) * s.layerGap * L; o.y -= Math.sin(a) * s.layerGap * L; o.px = o.x; o.py = o.y; }
    }
  }
  e.animBase = 'attack';
  playSfx('silence_cry', { x: e.x, y: e.y });
}

/** Phase 3 : l'anneau part du bord (inverseRadius) et se referme sur le boss. */
function ringInverse(world, e, count, offset, s) {
  const R = s.inverseRadius, speed = s.ringSpeed * 1.2;
  const layers = s.ringLayers || 1;
  for (let L = 0; L < layers; L++) {
    for (let k = 0; k < count; k++) {
      const a = offset + (k / count) * TWO_PI + (L % 2) * Math.PI / count;
      const o = fireSilence(world, e, -Math.cos(a), -Math.sin(a), speed, s.ringRadius, R / speed + 0.4, e.damage);
      if (o) { const r = R + s.layerGap * L; o.x = e.x + Math.cos(a) * r; o.y = e.y - 10 + Math.sin(a) * r * 0.8; o.px = o.x; o.py = o.y; }
    }
  }
  e.animBase = 'attack';
  playSfx('silence_cry', { x: e.x, y: e.y });
}

function bourdonFele(e, dt, world, p) {
  const s = e.def.special;
  const d = chase(e, p, e.speed);
  if (d < e.r + p.r + 6) { e.vx = 0; e.vy = 0; }
  const ratio = e.hp / e.maxHp;
  if (e.phase === 0 && ratio <= s.phase2At) {
    e.phase = 1; emitBoss(e.kind, 'phase', 2); emitPhase(e.kind, 'double', 2); shake(6, 0.5); emitParticles('silence', e.x, e.y);
    summonRing(world, e, s.summonKind2, s.summonCount2, 60);
  }
  if (e.phase === 1 && ratio <= (s.phase3At || 0)) { e.phase = 2; emitBoss(e.kind, 'phase', 3); emitPhase(e.kind, 'envers', 3); shake(8, 0.6); emitParticles('bell', e.x, e.y - 20); }
  if (e.criT > 0) { e.criT -= dt; if (e.criT <= 0) e.tint = e.def.elite ? '#c9973f' : null; }
  const fire = e.phase === 2 ? ringInverse : ring;
  if (world.barChanged) {
    e.aiT++;
    if (s.criBars && e.aiT % s.criBars === 0) {
      // Le cri fêlé : deux mesures où la Mesure elle-même boite (décalage d'une croche par le conducteur).
      e.criT = (s.criBeats || 8) * (beatDuration() || 0.625); e.tint = '#e0603a';
      emitPhase(e.kind, 'cri', e.phase + 1);
      playSfx('boss_roar', { x: e.x, y: e.y });
      shake(8, 0.6); emitParticles('silence', e.x, e.y - 10); emitParticles('hit_big', e.x, e.y - 20);
    } else fire(world, e, s.ringCount, 0, s);
    if (e.aiT % s.summonBars === 0) {
      summonRing(world, e, s.summonKind, s.summonCount, 50);
      if (e.phase >= 1) summonRing(world, e, s.summonKind2, Math.ceil(s.summonCount2 / 2), 70);
    }
  }
  if (e.phase >= 1 && world.beatChanged && world.beatInBar === 2 && e.criT <= 0) fire(world, e, s.ringCount, Math.PI / s.ringCount, s);
}

// ---- La Veuve de Suie -----------------------------------------------------------------------------

function veuveWeb(world, e, p, s, x, y) {
  HAZARD_OPTS.slow = s.slow; HAZARD_OPTS.blockSec = 0; HAZARD_OPTS.damage = 0; HAZARD_OPTS.from = e.kind;
  spawnHazard(world, 'web', x, y, s.webRadius, s.webSec, HAZARD_OPTS);
}

function veuveTeleport(world, e, p) {
  emitParticles('silence', e.x, e.y);
  const a = world.rng.range(0, TWO_PI);
  e.x = p.x + Math.cos(a) * 130; e.y = p.y + Math.sin(a) * 90; e.px = e.x; e.py = e.y;
  emitParticles('silence', e.x, e.y);
  playSfx('silence_cry', { x: e.x, y: e.y, volume: 0.6 });
  e.aiState = 1; e.animBase = 'attack';
}

function veuveSuie(e, dt, world, p) {
  const s = e.def.special;
  // Enfants aux seuils de PV ; le second seuil ouvre le deuil (toiles en couronne, double charge).
  const ratio = e.hp / e.maxHp;
  while (e.phase < s.childAt.length && ratio <= s.childAt[e.phase]) {
    e.phase++;
    emitBoss(e.kind, 'phase', e.phase + 1);
    emitPhase(e.kind, e.phase === 1 ? 'enfants' : 'deuil', e.phase + 1);
    for (let k = 0; k < s.childCount; k++) spawnEnemy(world, s.childKind, e.x + (k ? 40 : -40), e.y + 20);
    shake(5, 0.5);
  }
  const deuil = e.phase >= s.childAt.length;
  if (e.aiState === 0) {
    chase(e, p, e.speed);
    if (world.beatChanged) {
      if (world.beatInBar === s.webBeat && world.bar % s.webBars === 0) {
        if (deuil) for (let k = 0; k < s.deuilWebs; k++) { const a = (k / s.deuilWebs) * TWO_PI + world.time; veuveWeb(world, e, p, s, p.x + Math.cos(a) * 70, p.y + Math.sin(a) * 45); }
        else veuveWeb(world, e, p, s, p.x + world.rng.range(-30, 30), p.y + world.rng.range(-20, 20));
        e.animBase = 'attack';
      }
      if (world.beatInBar === s.chargeBeat && world.bar % s.chargeBars === 0) { e.charges = deuil ? s.deuilCharges : 1; veuveTeleport(world, e, p); }
    }
  } else if (e.aiState === 1) { // télégraphie jusqu'au prochain temps (le temps fort après un 4e temps), puis charge
    e.vx = 0; e.vy = 0;
    e.flashT = ((world.time * 8) | 0) % 2 === 0 ? 0.03 : 0;
    if (world.beatChanged) { const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1; e.aiX = dx / d; e.aiY = dy / d; e.aiState = 2; e.stateT = 0; e.animBase = 'attack'; e.flashT = 0; }
  } else {
    e.stateT += dt;
    e.vx = e.aiX * s.chargeSpeed; e.vy = e.aiY * s.chargeSpeed;
    if (e.stateT >= s.chargeSec) { e.charges--; if (e.charges > 0) veuveTeleport(world, e, p); else e.aiState = 0; }
  }
}

// ---- Ce qui reste du Maître -------------------------------------------------------------------------

function maitre(e, dt, world, p) {
  const s = e.def.special;
  const t = resonanceTier();
  if (t !== e.phase) {
    e.phase = t; emitBoss(e.kind, 'phase', t); emitPhase(e.kind, TIER_PHASE[t] || 'normal', t);
    e.vulnMult = t === 3 ? s.exposedMult : 1;
    e.tint = t === 3 ? '#d8cdb4' : t === 0 ? '#e0603a' : null;
  }
  if (!e.coda && e.hp / e.maxHp <= (s.codaAt || 0)) { e.coda = true; emitPhase(e.kind, 'coda', 9); shake(6, 0.5); emitParticles('bell', e.x, e.y - 20); }
  const speed = e.speed * (t === 0 ? s.enrageSpeed : 1);
  const d = chase(e, p, e.aiState === 2 ? 320 : speed);
  if (d < e.r + p.r + 6 && e.aiState !== 2) { e.vx = 0; e.vy = 0; }
  if (world.barChanged) {
    e.aiT = (e.aiT + 8) % 9; e.aiState = 0;   // aiT = timbre courant, décrémenté
    const next = (e.aiT + 8) % 9;
    emitPhase(e.kind, 'annonce', next, TIMBRE_ORDER[next]);   // le Timbre de la mesure suivante, une mesure à l'avance
  }
  if (e.aiState === 2) { e.stateT += dt; if (e.stateT > 0.5) e.aiState = 0; }
  if (!world.offbeatChanged && !(e.coda && world.beatChanged)) return;
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
