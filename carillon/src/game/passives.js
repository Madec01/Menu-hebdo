// game/passives.js — les 8 Accords, niveaux 1–5 (ARCHITECTURE.md § 10/11). Un Accord ajoute
// perLevel × niveau à une stat du joueur (player.recomputeStats) ET change un comportement
// (paramètres `special` de passives.json, lus ici et dans weapons.js / weapon-behaviors.js) :
//   ferrure → armor ; un coup reçu renvoie 20 %/niv du recul de parade aux ennemis au contact (ici)
//   souffle → speed ; la Volée laisse une traînée de bronze qui blesse (ici, hazards.js)
//   contrepoids → area ; l'aura du Tocsin suit le sonneur avec retard et gonfle sur le temps fort,
//                 l'onde du Bourdon laisse une zone qui ralentit (weapon-behaviors.js)
//   corde_de_chanvre → cadence ; +20 %/niv de points de grille (croche → double au niveau 5) (weapons.js)
//   cire_d_abeille → regen ; régénération doublée pendant une série de Parfaits (ici)
//   metronome → window ; élargit aussi la fenêtre de la cloche horaire (conductor.windowMs, bell-hour.js)
//   etain → crit ; à partir du niveau 3, le coup du temps fort est toujours critique (weapons.js)
//   echo → bounce ; Grelots/Crécelle rebondissent, la Clarine relance un éclair, les frappes
//          instantanées peuvent « faire écho » une croche plus tard (weapons.js, weapon-behaviors.js)

import { bus } from '../core/events.js';
import { beatDuration } from '../audio/conductor.js';
import { emit as emitParticles } from '../render/particles.js';
import { passiveDef } from './data.js';
import { recomputeStats, healPlayer } from './player.js';
import { refreshWeapons, currentWorld } from './weapons.js';
import { perfectStreak, mult as resonanceMult } from './resonance.js';
import { spawnHazard, HAZARD_OPTS } from './hazards.js';

let current = null;      // joueur courant (écouteurs du bus)
let cireAcc = 0;
let listening = false;

export function findPassive(p, passiveId) {
  for (let i = 0; i < p.passives.length; i++) if (p.passives[i].id === passiveId) return p.passives[i];
  return null;
}

/** Ajoute un Accord (niveau 1) ou le monte d'un niveau. Renvoie l'instance. */
export function addPassive(p, passiveId) {
  const def = passiveDef(passiveId);
  if (!def) return null;
  listen();
  current = p;
  let pa = findPassive(p, passiveId);
  if (pa) { if (pa.level < def.maxLevel) pa.level++; }
  else { pa = { id: def.id, def, level: 1 }; p.passives.push(pa); }
  recomputeStats(p);
  refreshWeapons(p);
  return pa;
}

export function upgradePassive(p, passiveId) { return addPassive(p, passiveId); }

/** Retire un Accord (consommé par une fusion). */
export function removePassive(p, passiveId) {
  const i = p.passives.findIndex((pa) => pa.id === passiveId);
  if (i < 0) return;
  p.passives.splice(i, 1);
  recomputeStats(p);
  refreshWeapons(p);
}

export function passiveLevel(p, passiveId) { const pa = findPassive(p, passiveId); return pa ? pa.level : 0; }
export function isPassiveMaxed(p, passiveId) { const pa = findPassive(p, passiveId); return !!pa && pa.level >= pa.def.maxLevel; }
/** Paramètres `special` d'un Accord (objet vide si absent). */
export function passiveSpecial(passiveId) { const d = passiveDef(passiveId); return (d && d.special) || EMPTY; }
const EMPTY = {};

/** Niveau de Corde de chanvre effectif (stat cadence : Accord + Beffroi + Relique), plafonné à 5. */
export function cadenceLevel(p) { return Math.min(5, Math.max(0, Math.floor(p.stats.cadence || 0))); }
/** Étain : le coup du temps fort est-il garanti critique pour ce joueur ? */
export function critGuaranteed(p) { const l = passiveLevel(p, 'etain'); return l > 0 && l >= (passiveSpecial('etain').guaranteeAtLevel || 3); }
/** Métronome : fenêtre de la cloche horaire en ms (la même que conductor.windowMs ; exposée pour le HUD). */
export function metronomeWindowMult(p) { return p.stats.windowMult || 1; }

function listen() {
  if (listening) return;
  listening = true;
  bus.on('player:dash', onDash);
  bus.on('player:hit', onHit);
}

/** Souffle : la Volée laisse une traînée de bronze qui blesse ce qu'elle traverse. */
function onDash(e) {
  const p = current, world = currentWorld();
  if (!p || !world || p.dead) return;
  const l = passiveLevel(p, 'souffle');
  if (l <= 0) return;
  const s = passiveSpecial('souffle');
  const dmg = s.trailDamage * l * p.stats.damageMult * resonanceMult();
  const life = (beatDuration() || 0.625) * s.trailBeats;
  for (let k = 1; k <= s.trailPoints; k++) {
    HAZARD_OPTS.slow = 1; HAZARD_OPTS.blockSec = 0; HAZARD_OPTS.damage = 0; HAZARD_OPTS.from = 'souffle';
    HAZARD_OPTS.enemyDamage = dmg; HAZARD_OPTS.enemySlow = 1;
    spawnHazard(world, 'volee', e.x + e.dirX * s.trailStep * k, e.y + e.dirY * s.trailStep * k + 2, s.trailRadius, life, HAZARD_OPTS);
  }
}

// Ferrure : le coup reçu renvoie une part du recul de parade aux ennemis au contact.
let fx = 0, fy = 0, fr2 = 0, fForce = 0, fMult = 1;
function reflectHit(en) {
  if (en.state !== 'alive' || en.boss) return;
  const dx = en.x - fx, dy = en.y - fy, d2 = dx * dx + dy * dy;
  if (d2 > fr2) return;
  const d = Math.sqrt(d2) || 1, m = fMult / Math.max(0.2, en.mass);
  en.kx += dx / d * fForce * m; en.ky += dy / d * fForce * m;
}
function onHit() {
  const p = current, world = currentWorld();
  if (!p || !world || !world.grid) return;
  const l = passiveLevel(p, 'ferrure');
  if (l <= 0) return;
  const s = passiveSpecial('ferrure');
  fx = p.x; fy = p.y; fr2 = (s.reflectRadius + p.r) * (s.reflectRadius + p.r);
  fForce = s.reflectKnock * s.reflectPerLevel * l; fMult = world.knockbackMult || 1;
  world.grid.query(p.x, p.y, s.reflectRadius + p.r, reflectHit);
  emitParticles('parry', p.x, p.y - 4);
}

/** Tick logique des Accords (appelé par weapons.updateWeapons) : Cire d'abeille en série de Parfaits. */
export function updatePassives(p, dt) {
  current = p;
  const l = passiveLevel(p, 'cire_d_abeille');
  if (l <= 0 || p.dead || p.hp >= p.maxHp) { cireAcc = 0; return; }
  const s = passiveSpecial('cire_d_abeille');
  if (perfectStreak() < s.streakMin) return;
  cireAcc += l * passiveDef('cire_d_abeille').perLevel * (s.streakMult - 1) * dt;
  if (cireAcc >= 1) { const n = Math.floor(cireAcc); cireAcc -= n; healPlayer(p, n); }
}
