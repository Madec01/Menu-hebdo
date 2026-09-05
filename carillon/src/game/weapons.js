// game/weapons.js — Timbres du sonneur (ARCHITECTURE.md § 11).
// Chaque arme s'abonne à conductor.schedule(rhythm, fn) : le tir est planifié SUR la grille
// (jamais de cooldown en secondes). Le callback audio arrive ~lookahead avant le point de grille :
// il fait CHANTER le Timbre à l'instant exact (audio/timbres.js : note de l'accord courant, motif par
// mesure ; repli sur le bruitage `sfx` si la voix manque) et empile le tir dans une file (anneau préalloué) ;
// updateWeapons() déclenche le comportement au tick logique où le temps audio atteint ce point.
// Stats d'arme = base + deltas de niveaux (7 niveaux) + Accords :
//   Corde de chanvre : la grille est affinée d'un cran (noire → croche…) et 20 % × niveau des points
//     intermédiaires tirent (niveau 5 : tous → cadence ×2, plafond « croche → double ») ;
//   Étain (niveau ≥ 3) : le tir du temps fort (temps 1, une fois par mesure) est critique garanti (w.forceCrit) ;
//   Écho : une frappe instantanée a 20 % × niveau de chance de « faire écho » une croche plus tard (dégâts ×0,5).
// Dégâts × Résonance × damageMult dans weapon-behaviors.js.

import { bus } from '../core/events.js';
import { schedule, isRunning, beatDuration, beatsPerBar, startAt } from '../audio/conductor.js';
import { now } from '../audio/audio.js';
import { duck } from '../audio/audio.js';
import { play as playSfx } from '../audio/sfx.js';
import { playTimbre, loadTimbres } from '../audio/timbres.js';
import { tier as resonanceTier } from './resonance.js';
import { weaponDef, fusionDef } from './data.js';
import { BEHAVIORS as TIMBRES, UPDATES as TIMBRE_UPDATES, INSTANT } from './weapon-behaviors.js';
import { FUSION_BEHAVIORS, FUSION_UPDATES } from './fusion-behaviors.js';
import { renderProjectiles } from './projectiles.js';
import { cadenceLevel, critGuaranteed, passiveLevel, passiveSpecial, updatePassives } from './passives.js';

const BEHAVIORS = Object.assign({}, TIMBRES, FUSION_BEHAVIORS);
const UPDATES = Object.assign({}, TIMBRE_UPDATES, FUSION_UPDATES);
const QUEUE = 8;
const STAT_KEYS = ['damage', 'area', 'count', 'speed', 'duration', 'knockback', 'pierce', 'range', 'bounces', 'markBonus', 'executeBelow'];
const firePayload = { weaponId: '', x: 0, y: 0, count: 1, big: false };
const report = {};       // dégâts cumulés par arme (dpsReport)
let currentWorldRef = null; // monde courant (rendu des projectiles, Accords)
let fallbackT = 0;       // horloge de secours quand la Mesure ne tourne pas

function makeWeapon(def, isFusion) {
  return {
    id: def.id, def, level: 1, fusion: isFusion, rhythm: def.rhythm, baseRhythm: def.rhythm, stats: {},
    unschedule: null, queueAt: new Float64Array(QUEUE), queueB: new Float64Array(QUEUE), queueHead: 0, queueTail: 0,
    orbits: [], fireCount: 0, damageTotal: 0, lastAt: 0, cadence: 0, offN: 0, forceCrit: false, dmgMult: 1, echoAt: 0,
    gridB: 0, auraX: 0, auraY: 0, auraInit: false, pending: 0, lastBar: -1, healed: 0,
  };
}

/** Stats effectives de l'arme pour ce joueur (niveaux + Accords). */
export function computeWeaponStats(w, p) {
  const s = w.stats, def = w.def;
  for (let i = 0; i < STAT_KEYS.length; i++) s[STAT_KEYS[i]] = def.base[STAT_KEYS[i]] !== undefined ? def.base[STAT_KEYS[i]] : 0;
  if (def.levels) for (let l = 1; l < w.level && l < def.levels.length; l++) {
    const d = def.levels[l];
    for (const k in d) s[k] = (s[k] || 0) + d[k];
  }
  s.area *= p.stats.area;
  // Corde de chanvre : grille affinée d'un cran, points intermédiaires tirés à 20 % × niveau (voir subscribe).
  const C = passiveSpecial('corde_de_chanvre');
  w.cadence = cadenceLevel(p);
  let rhythm = def.rhythm;
  if (w.cadence > 0 && rhythm / 2 >= (C.minRhythm || 0.25)) rhythm /= 2;
  if (rhythm !== w.rhythm) { w.rhythm = rhythm; subscribe(w, p); }
}

/** Le point de grille `b` (position en temps) est-il un point intermédiaire ajouté par la Corde ? */
function isOffPoint(w, b) { return w.rhythm !== w.baseRhythm && Math.round(b / w.rhythm) % 2 === 1; }

function subscribe(w, p) {
  if (w.unschedule) w.unschedule();
  w.unschedule = schedule(w.rhythm, (at, b) => {
    if (p.silencedT > 0 || p.dead) return;
    if (isOffPoint(w, b)) {
      // Corde de chanvre niveau L : L/5 des points intermédiaires tirent, répartis régulièrement.
      const f = w.cadence * (passiveSpecial('corde_de_chanvre').fractionPerLevel || 0.2);
      w.offN++;
      if (Math.floor(w.offN * f + 1e-9) === Math.floor((w.offN - 1) * f + 1e-9)) return;
    }
    const n = (w.queueTail + 1) % QUEUE;
    if (n === w.queueHead) return; // file pleine : le tir est perdu (jamais deux tirs empilés)
    w.queueAt[w.queueTail] = at; w.queueB[w.queueTail] = b; w.queueTail = n;
    // la voix du Timbre (note de la musique) ; bruitage de repli si les voix ne sont pas chargées
    if (!playTimbre(w.id, { at, x: p.x, y: p.y, rhythm: w.rhythm, tier: resonanceTier(), level: w.level, fusion: w.fusion })) {
      playSfx(w.def.sfx, { at, x: p.x, y: p.y, volume: w.fusion ? 1 : 0.8 });
    }
  });
}

/** Ajoute un Timbre (niveau 1) ou monte son niveau s'il est déjà possédé. */
export function addWeapon(p, weaponId) {
  const existing = findWeapon(p, weaponId);
  if (existing) return upgradeWeapon(p, weaponId);
  const def = weaponDef(weaponId) || fusionDef(weaponId);
  if (!def) return null;
  const w = makeWeapon(def, !weaponDef(weaponId));
  loadTimbres().catch(() => {});   // idempotent : voix déjà chargées au déblocage audio en jeu réel
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

/** Le point de grille `b` est-il le temps fort d'une mesure où ce Timbre a droit à son critique (Étain) ?
 *  Une fois par mesure pour les rythmes ≤ 1, une mesure sur `rhythm` pour les blanches et rondes. */
function tempsFort(w, b) {
  const bpb = beatsPerBar();
  if (Math.abs(b - Math.round(b)) > 1e-6 || Math.round(b) % bpb !== 0) return false;
  const bar = Math.round(b) / bpb, every = Math.max(1, Math.round(w.baseRhythm));
  return bar % every === 0;
}

function fire(w, p, world, at, b, echo) {
  w.gridB = b;
  w.forceCrit = !echo && critGuaranteed(p) && tempsFort(w, b);
  w.dmgMult = echo ? passiveSpecial('echo').echoDamage : 1;
  const big = BEHAVIORS[w.def.behavior](w, p, world, at) === true;
  w.dmgMult = 1; w.forceCrit = false;
  w.fireCount++; w.lastAt = at;
  firePayload.weaponId = w.id; firePayload.x = p.x; firePayload.y = p.y; firePayload.count = w.stats.count; firePayload.big = big;
  bus.emit('weapon:fire', firePayload);
  if (big) duck();
  // Écho : une frappe instantanée peut être rejouée une croche plus tard (dégâts réduits).
  if (!echo && INSTANT[w.def.behavior] && w.echoAt <= 0) {
    const l = passiveLevel(p, 'echo');
    if (l > 0 && world.rng.chance(l * passiveSpecial('echo').echoChancePerLevel)) w.echoAt = at + (beatDuration() || 0.625) * 0.5;
  }
}

/** Tick logique : déclenche les tirs dont le point de grille est atteint. */
export function updateWeapons(p, dt, world) {
  currentWorldRef = world;
  if (p.dead) return;
  updatePassives(p, dt);
  const running = isRunning();
  const t = running ? now() : fallbackT;
  if (!running) fallbackT += dt;
  for (let i = 0; i < p.weapons.length; i++) {
    const w = p.weapons[i];
    const upd = UPDATES[w.def.behavior];
    if (upd) upd(w, p, world, dt);
    if (running) {
      while (w.queueHead !== w.queueTail && w.queueAt[w.queueHead] <= t + 0.004) {
        const at = w.queueAt[w.queueHead], b = w.queueB[w.queueHead];
        w.queueHead = (w.queueHead + 1) % QUEUE;
        fire(w, p, world, at, b, false);
      }
      if (w.echoAt > 0 && w.echoAt <= t + 0.004) { const at = w.echoAt; w.echoAt = 0; if (p.silencedT <= 0) fire(w, p, world, at, w.gridB + 0.5, true); }
    } else if (p.silencedT <= 0) {
      // Secours (Mesure arrêtée, ex. avant le déblocage audio) : cadence dérivée du tempo et de la Corde.
      const step = (beatDuration() || 0.625) * w.baseRhythm / (1 + w.cadence * (passiveSpecial('corde_de_chanvre').fractionPerLevel || 0.2));
      if (fallbackT - w.lastAt >= step) fire(w, p, world, fallbackT, Math.round(fallbackT / (beatDuration() || 0.625)), false);
    }
  }
}

/** Rendu des projectiles et effets d'armes (après les entités triées, avant les particules). */
export function renderWeapons(ctx, alpha) {
  if (currentWorldRef) renderProjectiles(ctx, currentWorldRef, alpha);
}

/** Monde courant (Accords comportementaux : Souffle, Ferrure). */
export function currentWorld() { return currentWorldRef; }

/** Position en temps (grille) d'un temps audio. */
export function beatPosOf(at) { return (at - startAt()) / (beatDuration() || 0.625); }

/** Cumule les dégâts infligés par une arme (appelé par collision.js). Seuls les identifiants de
 *  Timbre ou de fusion sont crédités ('parry', 'carillon_pickup'… n'apparaissent pas au bilan). */
export function recordDamage(weaponId, amount) {
  if (!weaponId || !(weaponDef(weaponId) || fusionDef(weaponId))) return;
  report[weaponId] = (report[weaponId] || 0) + amount;
}

/** { [weaponId]: dégâts cumulés } depuis resetReport(). */
export function dpsReport() { return report; }

export function resetReport() { for (const k in report) delete report[k]; fallbackT = 0; }
