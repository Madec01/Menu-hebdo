// game/night-rules.js — règles de nuit ajoutées par la vague 2 (sous-module de game.js, documenté ici) :
//  · Sourdine I–V : `sourdineMult(parishDef, level)` lit parishes.json `sourdineLevels[level-1]`
//    ({ difficulty, bronze }) ; `scaledWaveDef(waveDef, m)` renvoie une copie de la vague dont
//    `difficulty.hp/damage` et la densité (`spawns[].perSec`, `cap`) sont multipliés par m — le spawner
//    (hors périmètre) ne change pas ; les boss, exclus de scaleNewEnemies, sont mis à l'échelle ici sur
//    `enemy:spawn`.
//  · Nœuds-règles de l'arbre (upgrades.json, stats hors player.STAT_KEYS) : `timbre_niveau_2`
//    (startWeaponLevel), `deuxieme_relique` (relicChoices : Reliques proposées en plus), `cloche_qui_soigne`
//    (bellHeal : soin en % à chaque réponse à la cloche), `echo_de_felure` (fissureEcho : un Écho géant là où
//    la Fêlure tombe), `contrat_en_plus` (contracts : lu par le hub).
//  · Veiller encore : après l'aube, `startVigil(world, run)` rouvre la nuit sans fin — flux régulier prolongé
//    (copie de la vague aux fenêtres infinies), difficulté et densité qui montent toutes les VIGIL_STEP_SEC,
//    un Moment relancé toutes les VIGIL_MOMENT_SEC ; `updateVigil(dt)` ; la mort garde la victoire (game.js).

import { bus } from '../core/events.js';
import { makeRng } from '../core/rng.js';
import { allRelics } from './data.js';
import { upgradeWeapon } from './weapons.js';
import { healPlayer } from './player.js';
import { spawnGiantEcho } from './pickups.js';

export const VIGIL_STEP_SEC = 45;      // la Sourdine monte d'un pas
export const VIGIL_MOMENT_SEC = 40;    // un Moment relancé
const VIGIL_HP_STEP = 1.12, VIGIL_DMG_STEP = 1.08, VIGIL_DENSITY_STEP = 1.1;
const FISSURE_ECHO_XP = 60, FISSURE_ECHO_LIFE = 20;

const st = { run: null, player: null, world: null, unsubs: [], bossMult: 1, vigil: null, ups: {} };

/** Multiplicateurs { difficulty, bronze } d'un niveau de Sourdine (1..5) d'une paroisse. */
export function sourdineMult(parishDef, level) {
  const levels = (parishDef && parishDef.sourdineLevels) || null;
  const i = Math.max(0, Math.min((levels ? levels.length : 1) - 1, (level | 0) - 1));
  const L = levels && levels[i];
  return { difficulty: L && L.difficulty > 0 ? L.difficulty : 1, bronze: L && L.bronze > 0 ? L.bronze : 1 };
}

/** Nombre de niveaux de Sourdine d'une paroisse (5 par défaut). */
export function sourdineLevels(parishDef) { return parishDef && parishDef.sourdineLevels ? parishDef.sourdineLevels.length : 5; }

/** Copie de la vague avec la difficulté et la densité multipliées par m (m = 1 : la vague elle-même). */
export function scaledWaveDef(waveDef, m) {
  if (!(m > 1)) return waveDef;
  const d = waveDef.difficulty || { hp: 1, damage: 1 };
  return Object.assign({}, waveDef, {
    difficulty: { hp: (d.hp || 1) * m, damage: (d.damage || 1) * m },
    spawns: waveDef.spawns.map((s) => Object.assign({}, s, { perSec: s.perSec * m, cap: Math.ceil(s.cap * m) })),
  });
}

/** Attache les règles à la run : `ups` = { upgradeId: niveau }, `mult` = multiplicateur de Sourdine. */
export function initNightRules(run, player, world, ups, mult) {
  disposeNightRules();
  st.run = run; st.player = player; st.world = world; st.bossMult = mult > 1 ? mult : 1; st.vigil = null;
  st.ups = ups || {};
  if (st.bossMult > 1) st.unsubs.push(bus.on('enemy:spawn', onSpawn));
  if (st.ups.cloche_qui_soigne > 0) st.unsubs.push(bus.on('bell:answered', onBell));
  if (st.ups.echo_de_felure > 0) st.unsubs.push(bus.on('run:fissure', onFissure));
}

export function disposeNightRules() {
  for (let i = 0; i < st.unsubs.length; i++) st.unsubs[i]();
  st.unsubs.length = 0;
  st.run = null; st.player = null; st.world = null; st.vigil = null;
}

/** Timbre(s) de départ montés d'un niveau par nœud « Timbre de départ niveau 2 » (une fois par Timbre). */
export function applyStartWeaponLevel(player, ups, weaponIds) {
  const n = (ups && ups.timbre_niveau_2) | 0;
  for (let k = 0; k < n; k++) for (let i = 0; i < weaponIds.length; i++) if (weaponIds[i]) upgradeWeapon(player, weaponIds[i]);
}

/** Reliques supplémentaires proposées (nœud « Deuxième Relique »), tirées au même rng que l'offre. */
export function extendRelicOffer(run, ups) {
  const extra = (ups && ups.deuxieme_relique) | 0;
  if (!extra || !run.relicOffer) return run.relicOffer;
  const ids = Array.from(allRelics().keys()).filter((id) => run.relicOffer.indexOf(id) < 0);
  const rng = makeRng(((run.seed >>> 0) ^ 0x3c6ef372) >>> 0);
  for (let k = 0; k < extra && ids.length; k++) run.relicOffer.push(ids.splice(rng.int(0, ids.length - 1), 1)[0]);
  return run.relicOffer;
}

function onSpawn(e) {
  const items = st.world ? st.world.enemies.items : null;
  if (!items) return;
  for (let i = items.length - 1; i >= 0; i--) {
    const en = items[i];
    if (en.id !== e.id) continue;
    if (en.boss) { en.maxHp = Math.round(en.maxHp * st.bossMult); en.hp = en.maxHp; }
    return;
  }
}

function onBell() {
  const p = st.player;
  if (!p || p.dead) return;
  healPlayer(p, Math.ceil(p.maxHp * 0.1 * st.ups.cloche_qui_soigne));
}

function onFissure(e) {
  if (e.phase !== 'end' || !st.world || !st.player) return;
  const p = st.player;
  spawnGiantEcho(st.world, p.x + 60, p.y, FISSURE_ECHO_XP, FISSURE_ECHO_LIFE);
}

// ---- Veiller encore -----------------------------------------------------------------------------------

/** La nuit continue après l'aube : renvoie l'état de veillée (ou null si aucune run). */
export function startVigil() {
  const world = st.world, run = st.run;
  if (!world || !run || st.vigil) return st.vigil;
  const sp = world.spawner;
  const base = sp.def;
  sp.def = Object.assign({}, base, {
    difficulty: Object.assign({}, base.difficulty || { hp: 1, damage: 1 }),
    spawns: base.spawns.map((s) => Object.assign({}, s, { to: 1e9 })),
    events: base.events,
  });
  sp.bossStarted = false;
  world.ended = false;
  run.vigil = true; run.vigilStart = run.timeSec; run.vigilSec = 0; run.vigilLevel = 0;
  st.vigil = { t: 0, nextStep: VIGIL_STEP_SEC, nextMoment: 15, src: (base.moments || []).slice(), k: 0 };
  return st.vigil;
}

export function vigilState() { return st.vigil; }

/** Tick de veillée : paliers toutes les 45 s (PV, dégâts, densité), un Moment toutes les 40 s. */
export function updateVigil(dt) {
  const v = st.vigil, world = st.world, run = st.run;
  if (!v || !world || !run) return;
  v.t += dt;
  run.vigilSec = v.t;
  if (v.t >= v.nextStep) {
    v.nextStep += VIGIL_STEP_SEC;
    run.vigilLevel++;
    const d = world.spawner.def.difficulty;
    d.hp *= VIGIL_HP_STEP; d.damage *= VIGIL_DMG_STEP;
    const sp = world.spawner.def.spawns;
    for (let i = 0; i < sp.length; i++) { sp[i].perSec *= VIGIL_DENSITY_STEP; sp[i].cap = Math.ceil(sp[i].cap * VIGIL_DENSITY_STEP); }
  }
  const mo = world.moments;
  if (mo && v.src.length && v.t >= v.nextMoment && !mo.active) {
    v.nextMoment += VIGIL_MOMENT_SEC;
    const m = v.src[v.k++ % v.src.length];
    mo.list.push({ id: m.id, at: world.time + 1, sec: m.sec, kind: m.kind || '', count: m.count || 0, radius: m.radius || 0 });
  }
}
