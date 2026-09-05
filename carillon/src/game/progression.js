// game/progression.js — XP, niveaux, cartes, fin de run (ARCHITECTURE.md § 11).
// Courbe : nextXp(niveau) = (base + perLevel × (niveau − 1)) × growth^(niveau − 1) (balance.xp),
// calibrée pour un niveau toutes les ~20 s. `level:up` porte 3 cartes (cards.js) ; les montées en
// attente sont émises une à une après chaque `level:choice` (applyCard). finishRun construit
// RunStats, calcule le Bronze, met à jour la sauvegarde (stats, codex, fusions, Feuillets, hauts-faits)
// et commit(). Les compteurs rythmiques (parfait/raté) viennent de `rhythm:input`.
// Relique et cloche (§ 11 bis) : run.relicId / run.bellAnswers → RunStats et save.stats.bellAnswers.
// Timbres de départ : un Timbre porté à son niveau max pendant la run (ou composant d'une fusion
// découverte) est débloqué immédiatement dans save.unlocked.weapons (commit → l'UI affiche le toast
// par différence sur `save:changed`) et listé dans RunStats.startWeapons pour le bilan.
// Vague 2 : Sourdine (run.sourdine, multiplicateur de Bronze lu dans parishes.json), contrats de nuit
// (contracts.js : réglés ici, Bronze ou Feuillet de la paroisse), tenue de cran (run.tierHold[t] = record de
// secondes d'affilée au cran ≥ t, quête du Muet), veillée (run.vigilSec), Nuit du jour (run.daily = date),
// records / Sourdine débloquée / fin (meta.js). RunStats porte tout ce que le bilan affiche.

import { bus } from '../core/events.js';
import { makeRng } from '../core/rng.js';
import { getSave, commit } from '../core/save.js';
import { play as playSfx } from '../audio/sfx.js';
import { emit as emitParticles } from '../render/particles.js';
import { balance, parishDef } from './data.js';
import { addWeapon } from './weapons.js';
import { addPassive } from './passives.js';
import { applyFusion } from './fusions.js';
import { healPlayer } from './player.js';
import { dpsReport, resetReport } from './weapons.js';
import { mult as resonanceMult, maxTierTime, resetResonance } from './resonance.js';
import { drawCards } from './cards.js';
import { evaluateUnlocks, unlockStartWeapon, syncStartWeapons, grantParishLeaf } from './unlocks.js';
import { tier as resonanceTier } from './resonance.js';
import { settleContracts, leafFallbackBronze } from './contracts.js';
import { applyMeta } from './meta.js';
import { sourdineMult } from './night-rules.js';

const levelPayload = { level: 1, choices: [] };
const endPayload = { victory: false, stats: null };
const unlockOut = { leaves: [], achievements: [], characters: [] };
const TIERS = 4;
let current = null;
let listening = false;

function nextXpFor(level) {
  const X = balance().xp;
  return Math.round((X.base + X.perLevel * (level - 1)) * Math.pow(X.growth, level - 1));
}

function listen() {
  if (listening) return;
  listening = true;
  bus.on('rhythm:input', (e) => {
    if (!current || current.finished) return;
    current.inputs++;
    if (e.grade === 'parfait') current.perfects++; else if (e.grade === 'rate') current.misses++;
  });
  bus.on('player:hit', () => { if (current && !current.finished) current.hitsTaken++; });
  bus.on('bell:answered', () => { if (current && !current.finished) current.bellAnswers++; });
  bus.on('weapon:fusion', (e) => {
    if (!current || current.finished) return;
    if (current.fusions.indexOf(e.fusionId) < 0) current.fusions.push(e.fusionId);
    noteStartWeapon(current, e.from[0]);
  });
}

/** Débloque `weaponId` comme Timbre de départ (si nouveau) : sauvegarde immédiate + liste du bilan. */
function noteStartWeapon(run, weaponId) {
  if (!unlockStartWeapon(getSave(), weaponId)) return;
  run.startWeapons.push(weaponId);
  commit();
}

/** Timbres (hors fusions) au niveau max → Timbre de départ débloqué. */
function checkMaxedWeapons(run, player) {
  const ws = player.weapons;
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (!w.fusion && w.level >= (w.def.maxLevel || 1) && run.startWeapons.indexOf(w.id) < 0 && getSave().unlocked.weapons.indexOf(w.id) < 0) noteStartWeapon(run, w.id);
  }
}

/** Démarre une run (état de progression). */
export function initRun({ parishId, characterId, seed, assist = 'none', sourdine = 1, daily = null }) {
  listen();
  resetReport();
  const X = balance().xp;
  const rng = makeRng(seed);
  const run = {
    parishId, characterId, seed, assist, rng, cardRng: rng.fork(),
    xp: 0, level: X.startLevel, nextXp: nextXpFor(X.startLevel), kills: 0, timeSec: 0,
    pendingLevels: 0, awaiting: false, choices: [], rerolls: 0,
    echoes: 0, perfects: 0, misses: 0, inputs: 0, hitsTaken: 0, fusions: [],
    resonanceSum: 0, resonanceSamples: 0, bossKilled: null, world: null, player: null, finished: false, stats: null,
    startWeapons: [], relicId: null, relicOffer: null, relicPicked: false, bellAnswers: 0,
    sourdine: Math.max(1, sourdine | 0), daily: daily || null, contracts: [], tierHold: [0, 0, 0, 0], holdCur: [0, 0, 0, 0],
    vigil: false, vigilStart: 0, vigilSec: 0, vigilLevel: 0,
  };
  current = run;
  return run;
}

export function currentRun() { return current; }

/** Tick : temps, moyenne de Résonance, synchronisation avec le monde. */
export function updateRun(run, dt, player, world) {
  if (run.finished) return;
  run.player = player; run.world = world;
  run.timeSec += dt;
  run.resonanceSum += resonanceMult() * dt; run.resonanceSamples += dt;
  if (world) { run.kills = world.kills; run.echoes = world.echoes; if (world.bossKilled) run.bossKilled = world.bossKilled; }
  if (player) { run.rerolls = player.stats.rerolls; checkMaxedWeapons(run, player); }
  // Tenue de cran : secondes d'affilée au cran ≥ t (t = 0..3), record conservé dans run.tierHold.
  const tier = player && player.dead ? -1 : resonanceTier();
  for (let t = 0; t < TIERS; t++) {
    if (tier >= t) { run.holdCur[t] += dt; if (run.holdCur[t] > run.tierHold[t]) run.tierHold[t] = run.holdCur[t]; }
    else run.holdCur[t] = 0;
  }
}

/** Ajoute de l'XP ; déclenche level:up (une montée à la fois). */
export function addXp(run, amount) {
  if (run.finished) return;
  run.xp += amount;
  while (run.xp >= run.nextXp) {
    run.xp -= run.nextXp;
    run.level++;
    run.nextXp = nextXpFor(run.level);
    run.pendingLevels++;
  }
  if (run.pendingLevels > 0 && !run.awaiting) emitLevelUp(run);
}

function emitLevelUp(run) {
  if (!run.player) return;
  run.awaiting = true;
  run.pendingLevels--;
  drawCards(run, run.player, run.choices, 3);
  levelPayload.level = run.level; levelPayload.choices = run.choices;
  playSfx('level_up');
  emitParticles('bell', run.player.x, run.player.y);
  bus.emit('level:up', levelPayload);
}

/** Carte offerte (réponse à la cloche, minutes 4 et 8) : une montée de niveau sans XP ni niveau. */
export function grantBonusLevel(run) {
  if (run.finished) return;
  run.pendingLevels++;
  if (!run.awaiting) emitLevelUp(run);
}

/** Retire les 3 cartes (si des rerolls restent). Renvoie les nouvelles cartes ou null. */
export function rerollCards(run, player) {
  if (run.rerolls <= 0 || !run.awaiting) return null;
  run.rerolls--;
  drawCards(run, player, run.choices, 3);
  playSfx('card_flip');
  return run.choices;
}

/** Applique la carte choisie, puis émet la montée suivante s'il en reste. */
export function applyCard(run, player, card) {
  if (!card) return;
  const C = balance().cards;
  switch (card.type) {
    case 'weapon': addWeapon(player, card.id); break;
    case 'passive': addPassive(player, card.id); break;
    case 'fusion': applyFusion(player, card.id); break;
    case 'bonus':
      if (card.id === 'heal') healPlayer(player, Math.ceil(player.maxHp * C.bonusHeal));
      else if (card.id === 'bronze' && run.world) run.world.bronzePicked += C.bonusBronze;
      break;
  }
  playSfx('card_pick');
  run.awaiting = false;
  if (run.pendingLevels > 0) emitLevelUp(run);
}

/** Termine la run : RunStats, Bronze, sauvegarde, déblocages, run:end. */
export function finishRun(run, victory) {
  if (run.finished) return run.stats;
  run.finished = true;
  const save = getSave();
  const B = balance().bronze;
  const p = run.player, world = run.world;
  const parish = parishDef(run.parishId);
  const resonanceAvg = run.resonanceSamples > 0 ? run.resonanceSum / run.resonanceSamples : 1;
  let bronze = (victory ? (parish ? parish.bronzeReward : 0) * B.win : 0)
    + (run.timeSec / 60) * B.perMinute + run.kills * B.perKill + resonanceAvg * B.perResonance;
  if (!victory) bronze *= B.lossMult;
  const sm = sourdineMult(parish, run.sourdine);
  // Bronze ramassé (toujours) + Bronze promis par la dernière cloche (bell-hour : victoire seulement).
  bronze = Math.round(bronze * (p ? p.stats.bronzeGain : 1) * sm.bronze) + (world ? world.bronzePicked + (victory ? world.bellBronze || 0 : 0) : 0);
  // Contrats de nuit : Bronze en prime, ou le prochain Feuillet fermé de la paroisse.
  const settled = settleContracts(run, victory, p);
  const contractLeaves = [];
  unlockOut.leaves.length = 0;
  for (let i = 0; i < settled.done.length; i++) {
    const d = run.contracts.find((c) => c.id === settled.done[i]);
    if (!(d && d.def.reward && d.def.reward.leaf)) continue;
    const id = grantParishLeaf(save, run.parishId, unlockOut);
    if (id) contractLeaves.push(id); else settled.bronze += leafFallbackBronze(d.id);
  }
  const contractBronze = Math.round(settled.bronze * sm.bronze);
  bronze += contractBronze;

  // Sauvegarde : stats, codex, fusions, paroisses.
  save.bronze += bronze;
  save.stats.runs++;
  save.stats.kills += run.kills;
  if (victory) {
    save.stats.wins++;
    save.stats.winsByParish = save.stats.winsByParish || {};
    save.stats.winsByCharacter = save.stats.winsByCharacter || {};
    save.stats.winsByParish[run.parishId] = (save.stats.winsByParish[run.parishId] || 0) + 1;
    save.stats.winsByCharacter[run.characterId] = (save.stats.winsByCharacter[run.characterId] || 0) + 1;
  }
  if (run.timeSec > save.stats.bestTime) save.stats.bestTime = Math.round(run.timeSec);
  save.stats.bellAnswers = (save.stats.bellAnswers || 0) + run.bellAnswers;
  save.stats.contracts = save.stats.contracts || { offered: 0, accepted: 0, done: 0 };
  save.stats.contracts.accepted += run.contracts.length;
  save.stats.contracts.done += settled.done.length;
  if (run.tierHold[2] > (save.stats.tierHold || 0)) save.stats.tierHold = Math.round(run.tierHold[2]);
  if (resonanceAvg > save.stats.bestResonance) save.stats.bestResonance = Math.round(resonanceAvg * 100) / 100;
  if (world) for (const k in world.killsByKind) save.codex.enemies[k] = (save.codex.enemies[k] || 0) + world.killsByKind[k];
  if (run.bossKilled) save.codex.bosses[run.bossKilled] = (save.codex.bosses[run.bossKilled] || 0) + 1;
  for (let i = 0; i < run.fusions.length; i++) if (save.unlocked.fusions.indexOf(run.fusions[i]) < 0) save.unlocked.fusions.push(run.fusions[i]);
  if (p) checkMaxedWeapons(run, p);
  syncStartWeapons(save);
  if (victory && parish) {
    for (const other of (world ? world.allParishes : [])) {
      if (other.unlock && other.unlock.type === 'win' && other.unlock.parish === run.parishId && save.unlocked.parishes.indexOf(other.id) < 0) save.unlocked.parishes.push(other.id);
    }
  }

  const facts = {
    parishId: run.parishId, characterId: run.characterId, timeSec: run.timeSec, victory, bossKilled: run.bossKilled,
    fusions: run.fusions, maxTierTime: maxTierTime(), echoes: run.echoes, perfects: run.perfects, misses: run.misses,
    assist: run.assist, inputs: run.inputs, weaponCount: p ? p.weapons.length : 0, passiveCount: p ? p.passives.length : 0,
    bellAnswers: run.bellAnswers, relicId: run.relicId,
    sourdine: run.sourdine, vigilSec: run.vigilSec, daily: run.daily, tierHold: run.tierHold,
  };
  const meta = applyMeta(run, save, victory, {});
  const contractLeafList = unlockOut.leaves.slice();
  evaluateUnlocks(facts, save, unlockOut);
  for (let i = 0; i < contractLeafList.length; i++) {
    if (unlockOut.leaves.indexOf(contractLeafList[i]) >= 0) continue;
    unlockOut.leaves.unshift(contractLeafList[i]);
    bus.emit('lore:unlock', { leafId: contractLeafList[i] });
  }
  if (meta.endingLeaves) for (let i = 0; i < meta.endingLeaves.length; i++) if (unlockOut.leaves.indexOf(meta.endingLeaves[i]) < 0) unlockOut.leaves.push(meta.endingLeaves[i]);
  commit();

  const stats = {
    parishId: run.parishId, characterId: run.characterId, seed: run.seed, timeSec: Math.round(run.timeSec),
    kills: run.kills, victory, dpsByWeapon: Object.assign({}, dpsReport()), resonanceAvg: Math.round(resonanceAvg * 100) / 100,
    bronze, leafUnlocked: unlockOut.leaves.length ? unlockOut.leaves[0] : null, level: run.level,
    build: {
      weapons: p ? p.weapons.map((w) => ({ id: w.id, level: w.level })) : [],
      passives: p ? p.passives.map((pa) => ({ id: pa.id, level: pa.level })) : [],
    },
    leaves: unlockOut.leaves.slice(), achievements: unlockOut.achievements.slice(), startWeapons: run.startWeapons.slice(),
    echoes: run.echoes, perfects: run.perfects, misses: run.misses, inputs: run.inputs, hitsTaken: run.hitsTaken,
    relicId: run.relicId, bellAnswers: run.bellAnswers,
    characters: unlockOut.characters.slice(),
    contracts: run.contracts.map((c) => ({ id: c.id, done: c.done, failed: !c.done, progress: Math.min(c.progress, c.goal), goal: c.goal, reward: c.def.reward, difficulty: c.def.difficulty })),
    contractBronze, contractLeaves,
    sourdine: run.sourdine, sourdineBronzeMult: sm.bronze, sourdineNext: meta.sourdineNext || 0,
    vigil: run.vigil, vigilSec: Math.round(run.vigilSec || 0), isVigilRecord: !!meta.isVigilRecord,
    isRecord: !!meta.isRecord, recordTime: meta.recordTime || 0,
    daily: run.daily, dailyScore: meta.dailyScore || 0, dailyRank: meta.dailyRank || 0,
    ending: meta.ending,
  };
  run.stats = stats;
  resetResonance();
  endPayload.victory = victory; endPayload.stats = stats;
  bus.emit('run:end', endPayload);
  return stats;
}
