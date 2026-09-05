// game/contracts.js — Contrats de nuit (sous-module de progression.js, vague 2). Au hub, avant
// « Sonner la nuit », `offerContracts(seed, count, ctx)` tire `count` contrats distincts au rng dérivé
// de la seed du run (même seed ⇒ mêmes contrats) parmi src/data/contracts.json ; le joueur en accepte
// 0, 1 ou 2 (3 avec le nœud « Contrat en plus »). Les définitions arrivent par setContractDefs (l'UI
// charge le JSON : ui/gamedata.js → ui/screens.js) pour rester indépendantes de game/data.js.
// En run : initContracts(run, player, world, ids) suit chaque contrat à partir des événements du bus
// (enemy:death, bell:answered, relic:pick, run:fissure, run:boss, pickup:xp, player:hit,
// resonance:streak, weapon:fusion) et de updateContracts(dt) (tenue de cran, temps sans coup).
// Réussite : `contract:done {id}` + sfx achievement ; le bilan lit run.contracts. settleContracts(...)
// évalue les contrats « de fin » (victoire sans Relique, 4 Timbres…) et renvoie la récompense.
// status() → [{ id, name, desc, progress, goal, done, failed, difficulty }] lisible par le HUD
// (la ligne sous la barre de nuit est hors périmètre de cet agent : voir le rapport).
// Types : kills_on_beat, kill_kind, tier_hold, bell_answers, weapons_end, no_relic_win, fissure_time,
// giant_echo, no_hit_seconds, perfect_streak, fusion, win_character, no_passive_win, boss_tier.

import { bus } from '../core/events.js';
import { makeRng } from '../core/rng.js';
import { play as playSfx } from '../audio/sfx.js';
import { balance } from './data.js';
import { tier as resonanceTier } from './resonance.js';

const SEED_SALT = 0x7f4a7c15;
const END_TYPES = { weapons_end: true, no_relic_win: true, win_character: true, no_passive_win: true };
const donePayload = { id: '' };
let defs = [];
const st = { run: null, player: null, world: null, items: [], unsubs: [], hold: 0, sinceHit: 0, fissureAt: -1 };

/** Définitions (contracts.json) fournies par l'interface au démarrage. */
export function setContractDefs(list) { defs = Array.isArray(list) ? list.slice() : []; }
export function contractDefs() { return defs; }
export function contractDef(id) { for (let i = 0; i < defs.length; i++) if (defs[i].id === id) return defs[i]; return null; }

/** Un contrat est-il proposable dans ce contexte ? ctx : { parishId, characterId, moments: [ids] }. */
function eligible(d, ctx) {
  if (d.character && d.character !== ctx.characterId) return false;
  if (d.moment && ctx.moments && ctx.moments.indexOf(d.moment) < 0) return false;
  return true;
}

/**
 * Tirage déterministe de `count` contrats (ids) pour la seed : au moins un « S » quand c'est possible,
 * jamais deux contrats du même type. ctx.moments = motifs de Moments présents dans la paroisse.
 */
export function offerContracts(seed, count, ctx) {
  const rng = makeRng(((seed >>> 0) ^ SEED_SALT) >>> 0);
  const pool = defs.filter((d) => eligible(d, ctx || {}));
  const out = [];
  const take = (list) => {
    const cands = list.filter((d) => out.indexOf(d.id) < 0 && !out.some((id) => contractDef(id).type === d.type));
    if (!cands.length) return false;
    out.push(cands[rng.int(0, cands.length - 1)].id);
    return true;
  };
  if (count > 0) take(pool.filter((d) => d.difficulty === 'S')) || take(pool);
  while (out.length < count && take(pool));
  return out;
}

/** Objectif chiffré d'un contrat (pour l'affichage). */
function goalOf(d) { return d.count || d.seconds || 1; }

/** Attache le suivi des contrats acceptés à la run (game.startGame). */
export function initContracts(run, player, world, ids) {
  disposeContracts();
  st.run = run; st.player = player; st.world = world; st.hold = 0; st.sinceHit = 0; st.fissureAt = -1;
  st.items = [];
  for (let i = 0; i < (ids || []).length; i++) {
    const d = contractDef(ids[i]);
    if (d) st.items.push({ id: d.id, def: d, progress: 0, goal: goalOf(d), done: false, failed: false });
  }
  run.contracts = st.items;
  if (!st.items.length) return;
  st.unsubs.push(bus.on('enemy:death', onDeath));
  st.unsubs.push(bus.on('bell:answered', () => bump('bell_answers')));
  st.unsubs.push(bus.on('relic:pick', () => fail('no_relic_win')));
  st.unsubs.push(bus.on('run:fissure', onFissure));
  st.unsubs.push(bus.on('run:boss', onBoss));
  st.unsubs.push(bus.on('pickup:xp', onXp));
  st.unsubs.push(bus.on('player:hit', () => { st.sinceHit = 0; }));
  st.unsubs.push(bus.on('resonance:streak', (e) => setProgress('perfect_streak', e.count)));
  st.unsubs.push(bus.on('weapon:fusion', () => bump('fusion')));
}

export function disposeContracts() {
  for (let i = 0; i < st.unsubs.length; i++) st.unsubs[i]();
  st.unsubs.length = 0;
  st.run = null; st.player = null; st.world = null; st.items = [];
}

function each(type, fn) { for (let i = 0; i < st.items.length; i++) { const c = st.items[i]; if (c.def.type === type && !c.done && !c.failed) fn(c); } }
function complete(c) {
  if (c.done) return;
  c.done = true; c.progress = c.goal;
  donePayload.id = c.id;
  bus.emit('contract:done', donePayload);
  playSfx('achievement');
}
function bump(type, n = 1) { each(type, (c) => { c.progress += n; if (c.progress >= c.goal) complete(c); }); }
function setProgress(type, v) { each(type, (c) => { if (v > c.progress) c.progress = v; if (c.progress >= c.goal) complete(c); }); }
function fail(type) { each(type, (c) => { c.failed = true; }); }

function findEnemy(id) {
  const items = st.world ? st.world.enemies.items : null;
  if (!items) return null;
  for (let i = items.length - 1; i >= 0; i--) if (items[i].id === id) return items[i];
  return null;
}

function onDeath(e) {
  each('kill_kind', (c) => { if (c.def.enemy === e.kind) { c.progress++; if (c.progress >= c.goal) complete(c); } });
  let en = null, looked = false;
  each('kills_on_beat', (c) => {
    if (c.def.enemy !== e.kind) return;
    if (!looked) { en = findEnemy(e.id); looked = true; }
    if (en && en.lastOnBeat) { c.progress++; if (c.progress >= c.goal) complete(c); }
  });
}

function onFissure(e) {
  if (!st.run) return;
  if (e.phase === 'start') { st.fissureAt = st.run.timeSec; return; }
  if (st.fissureAt < 0) return;
  const dt = st.run.timeSec - st.fissureAt;
  st.fissureAt = -1;
  each('fissure_time', (c) => { if (dt <= c.def.seconds) complete(c); });
}

function onBoss(e) {
  if (e.phase !== 'intro') return;
  each('boss_tier', (c) => { if (resonanceTier() >= c.def.tier) complete(c); else c.failed = true; });
}

/** Écho géant (Accalmie) : le seul Écho dont la valeur dépasse la moitié de balance.moments.accalmieEchoXp. */
function onXp(e) {
  const M = balance().moments;
  const big = ((M && M.accalmieEchoXp) || 60) * 0.5;
  if (e.amount >= big) bump('giant_echo');
}

/** Tick logique (game.updateGame) : tenue de cran, minute sans coup, Accord pris. */
export function updateContracts(dt) {
  if (!st.run || !st.items.length || st.run.finished) return;
  const p = st.player;
  if (p && p.dead) return;
  const tier = resonanceTier();
  st.sinceHit += dt;
  for (let i = 0; i < st.items.length; i++) {
    const c = st.items[i];
    if (c.done || c.failed) continue;
    switch (c.def.type) {
      case 'tier_hold':
        c.hold = tier >= c.def.tier ? (c.hold || 0) + dt : 0;
        c.progress = Math.floor(c.hold);
        if (c.hold >= c.def.seconds) complete(c);
        break;
      case 'no_hit_seconds':
        c.progress = Math.floor(st.sinceHit);
        if (st.sinceHit >= c.def.seconds) complete(c);
        break;
      case 'weapons_end': if (p) c.progress = p.weapons.length; break;
      case 'no_passive_win': if (p && p.passives.length > 0) c.failed = true; break;
      default: break;
    }
  }
}

/**
 * Fin de run : évalue les contrats « de fin », puis renvoie { done: [ids], failed: [ids], bronze, leaves }
 * (leaves = nombre de Feuillets à offrir ; progression.js les tire dans la paroisse). Idempotent.
 */
export function settleContracts(run, victory, player) {
  const out = { done: [], failed: [], bronze: 0, leaves: 0 };
  const items = (run && run.contracts) || [];
  for (let i = 0; i < items.length; i++) {
    const c = items[i], d = c.def;
    if (!c.done && !c.failed && END_TYPES[d.type]) {
      if (d.type === 'weapons_end') { if (player && player.weapons.length >= d.count) complete(c); }
      else if (d.type === 'no_relic_win') { if (victory && !run.relicId) complete(c); }
      else if (d.type === 'win_character') { if (victory && run.characterId === d.character) complete(c); }
      else if (d.type === 'no_passive_win') { if (victory && player && player.passives.length === 0) complete(c); }
    }
    if (!c.done) { c.failed = true; out.failed.push(c.id); continue; }
    out.done.push(c.id);
    if (d.reward && d.reward.leaf) out.leaves++;
    else if (d.reward && d.reward.bronze) out.bronze += d.reward.bronze;
  }
  return out;
}

/** Bronze de repli quand un Feuillet promis n'est plus disponible dans la paroisse. */
export function leafFallbackBronze(id) { const d = contractDef(id); return d && d.reward && d.reward.bronze ? d.reward.bronze : 80; }

/** État lisible (HUD, bilan) : copie légère des contrats de la run courante. */
export function status() {
  const out = [];
  for (let i = 0; i < st.items.length; i++) {
    const c = st.items[i];
    out.push({ id: c.id, name: c.def.name, desc: c.def.desc, progress: Math.min(c.progress, c.goal), goal: c.goal, done: c.done, failed: c.failed, difficulty: c.def.difficulty });
  }
  return out;
}
