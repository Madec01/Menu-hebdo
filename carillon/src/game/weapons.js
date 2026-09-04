// game/weapons.js — Timbres du sonneur (ARCHITECTURE.md § 11).
// Chaque arme s'abonne à conductor.schedule(rhythm, fn) : le tir est planifié SUR la grille
// (jamais de cooldown en secondes). Le callback audio arrive ~lookahead avant le point de grille :
// il joue le bruitage à l'instant exact et empile le tir dans une file (anneau préalloué) ;
// updateWeapons() déclenche le comportement au tick logique où le temps audio atteint ce point.
// Stats d'arme = base + deltas de niveaux (7 niveaux) + Accords (cadence → tirs supplémentaires
// / grille plus fine, area, bounce). Dégâts × Résonance × damageMult dans weapon-behaviors.js.

import { bus } from '../core/events.js';
import { schedule, isRunning, beatDuration } from '../audio/conductor.js';
import { now } from '../audio/audio.js';
import { duck } from '../audio/audio.js';
import { play as playSfx } from '../audio/sfx.js';
import { weaponDef, fusionDef, balance } from './data.js';
import { BEHAVIORS, INSTANT } from './weapon-behaviors.js';
import { renderProjectiles } from './projectiles.js';

const QUEUE = 8;
const STAT_KEYS = ['damage', 'area', 'count', 'speed', 'duration', 'knockback', 'pierce', 'range', 'bounces', 'markBonus', 'executeBelow'];
const firePayload = { weaponId: '', x: 0, y: 0, count: 1, big: false };
const report = {};       // dégâts cumulés par arme (dpsReport)
let currentWorld = null; // monde courant (rendu des projectiles)
let fallbackT = 0;       // horloge de secours quand la Mesure ne tourne pas

function makeWeapon(def, isFusion) {
  return {
    id: def.id, def, level: 1, fusion: isFusion, rhythm: def.rhythm, stats: {},
    unschedule: null, queueAt: new Float64Array(QUEUE), queueHead: 0, queueTail: 0,
    orbits: [], fireCount: 0, damageTotal: 0, lastAt: 0,
  };
}

/** Stats effectives de l'arme pour ce joueur (niveaux + Accords). */
export function computeWeaponStats(w, p) {
  const s = w.stats, def = w.def, B = balance().cadence;
  for (let i = 0; i < STAT_KEYS.length; i++) s[STAT_KEYS[i]] = def.base[STAT_KEYS[i]] !== undefined ? def.base[STAT_KEYS[i]] : 0;
  if (def.levels) for (let l = 1; l < w.level && l < def.levels.length; l++) {
    const d = def.levels[l];
    for (const k in d) s[k] = (s[k] || 0) + d[k];
  }
  s.count += Math.floor(p.stats.cadence / B.countEvery);
  s.area *= p.stats.area;
  if (INSTANT[def.behavior]) s.area *= 1 + p.stats.bounce * B.bounceAreaBonus;
  let rhythm = def.rhythm;
  if (p.stats.cadence >= B.halveRhythmAt && rhythm >= 1) rhythm /= 2;
  if (rhythm !== w.rhythm) { w.rhythm = rhythm; subscribe(w, p); }
}

function subscribe(w, p) {
  if (w.unschedule) w.unschedule();
  w.unschedule = schedule(w.rhythm, (at) => {
    if (p.silencedT > 0 || p.dead) return;
    const n = (w.queueTail + 1) % QUEUE;
    if (n === w.queueHead) return; // file pleine : le tir est perdu (jamais deux tirs empilés)
    w.queueAt[w.queueTail] = at; w.queueTail = n;
    playSfx(w.def.sfx, { at, x: p.x, y: p.y, volume: w.fusion ? 1 : 0.8 });
  });
}

/** Ajoute un Timbre (niveau 1) ou monte son niveau s'il est déjà possédé. */
export function addWeapon(p, weaponId) {
  const existing = findWeapon(p, weaponId);
  if (existing) return upgradeWeapon(p, weaponId);
  const def = weaponDef(weaponId) || fusionDef(weaponId);
  if (!def) return null;
  const w = makeWeapon(def, !weaponDef(weaponId));
  p.weapons.push(w);
  report[w.id] = report[w.id] || 0;
  subscribe(w, p);
  computeWeaponStats(w, p);
  return w;
}

export function upgradeWeapon(p, weaponId) {
  const w = findWeapon(p, weaponId);
  if (!w) return addWeapon(p, weaponId);
  if (w.level < (w.def.maxLevel || 1)) w.level++;
  computeWeaponStats(w, p);
  return w;
}

/** Retire une arme (fusion) : désabonne et libère ses orbites. */
export function removeWeapon(p, weaponId) {
  const i = p.weapons.findIndex((w) => w.id === weaponId);
  if (i < 0) return;
  const w = p.weapons[i];
  if (w.unschedule) w.unschedule();
  for (let k = 0; k < w.orbits.length; k++) w.orbits[k].dead = true;
  w.orbits.length = 0;
  p.weapons.splice(i, 1);
}

export function findWeapon(p, weaponId) {
  for (let i = 0; i < p.weapons.length; i++) if (p.weapons[i].id === weaponId) return p.weapons[i];
  return null;
}

/** Recalcule toutes les armes (après un Accord ou une amélioration). */
export function refreshWeapons(p) { for (let i = 0; i < p.weapons.length; i++) computeWeaponStats(p.weapons[i], p); }

function fire(w, p, world, at) {
  const big = BEHAVIORS[w.def.behavior](w, p, world, at) === true;
  w.fireCount++; w.lastAt = at;
  firePayload.weaponId = w.id; firePayload.x = p.x; firePayload.y = p.y; firePayload.count = w.stats.count; firePayload.big = big;
  bus.emit('weapon:fire', firePayload);
  if (big) duck();
}

/** Tick logique : déclenche les tirs dont le point de grille est atteint. */
export function updateWeapons(p, dt, world) {
  currentWorld = world;
  if (p.dead) return;
  const running = isRunning();
  const t = now();
  if (!running) fallbackT += dt;
  for (let i = 0; i < p.weapons.length; i++) {
    const w = p.weapons[i];
    if (running) {
      while (w.queueHead !== w.queueTail && w.queueAt[w.queueHead] <= t + 0.004) {
        const at = w.queueAt[w.queueHead];
        w.queueHead = (w.queueHead + 1) % QUEUE;
        fire(w, p, world, at);
      }
    } else if (p.silencedT <= 0) {
      // Secours (Mesure arrêtée, ex. avant le déblocage audio) : cadence dérivée du tempo.
      const step = (beatDuration() || 0.625) * w.rhythm;
      if (fallbackT - w.lastAt >= step) fire(w, p, world, fallbackT);
    }
  }
}

/** Rendu des projectiles et effets d'armes (après les entités triées, avant les particules). */
export function renderWeapons(ctx, alpha) {
  if (currentWorld) renderProjectiles(ctx, currentWorld, alpha);
}

/** Cumule les dégâts infligés par une arme (appelé par collision.js). Seuls les identifiants de
 *  Timbre ou de fusion sont crédités ('parry', 'carillon_pickup'… n'apparaissent pas au bilan). */
export function recordDamage(weaponId, amount) {
  if (!weaponId || !(weaponDef(weaponId) || fusionDef(weaponId))) return;
  report[weaponId] = (report[weaponId] || 0) + amount;
}

/** { [weaponId]: dégâts cumulés } depuis resetReport(). */
export function dpsReport() { return report; }

export function resetReport() { for (const k in report) delete report[k]; fallbackT = 0; }
