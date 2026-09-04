// game/relics.js — Reliques de paroisse (ARCHITECTURE.md § 11 bis). Au début de la nuit, deux
// Reliques tirées d'un rng dérivé de la seed (indépendant des cartes) sont proposées ; le joueur en
// prend une (ou aucune). Une Relique modifie une règle de toute la run, avec un revers.
// Les effets sont appliqués d'ici sans toucher player.js / pickups.js / enemies.js :
//   · stats du joueur → p.upgradeBonus (survit à recomputeStats) ; · règles du monde → champs de
//   world lus par les hooks (spawner : Fêlures avancées ; collision : recul, parade double ; world :
//   ennemis cachés hors halo) ; · Résonance → setDecayMult ; · soin interdit → revers du player:heal ;
//   · PV des ennemis → enemy:spawn ; · régénération ×2 et halo → tick / rendu de ce module.
// API : offerRelics(run) → [id, id] (run.relicOffer), pickRelic(run, id|null), relicMods(run),
// événement relic:pick {relicId}. Codex : save.codex.relics[id] = nombre de nuits portée.

import { bus } from '../core/events.js';
import { makeRng } from '../core/rng.js';
import { getSave, commit } from '../core/save.js';
import { addLight } from '../render/lighting.js';
import { balance, relicDef, allRelics } from './data.js';
import { recomputeStats } from './player.js';
import { refreshWeapons } from './weapons.js';
import { setDecayMult, tier as resonanceTier } from './resonance.js';

const EMPTY = Object.freeze({});
const MAGNET_ALL = 60;        // × magnetRadius (90 px) : tout l'écran et bien au-delà
const pickPayload = { relicId: '' };
const st = { run: null, player: null, world: null, mods: EMPTY, unsubs: [] };

/** Attache le module à la run courante (game.startGame). */
export function initRelics(run, player, world) {
  disposeRelics();
  st.run = run; st.player = player; st.world = world; st.mods = EMPTY;
  run.relicId = null; run.relicOffer = null; run.relicPicked = false;
  st.unsubs.push(bus.on('enemy:spawn', onSpawn));
  st.unsubs.push(bus.on('player:heal', onHeal));
}

export function disposeRelics() {
  for (let i = 0; i < st.unsubs.length; i++) st.unsubs[i]();
  st.unsubs.length = 0;
  st.run = null; st.player = null; st.world = null; st.mods = EMPTY;
}

/** Deux Reliques distinctes tirées d'un rng dérivé de la seed (mémorisées dans run.relicOffer). */
export function offerRelics(run, rng = null) {
  if (run.relicOffer) return run.relicOffer;
  const ids = Array.from(allRelics().keys());
  if (ids.length < 2) { run.relicOffer = ids.slice(); return run.relicOffer; }
  const r = rng || makeRng((run.seed ^ 0x2545f491) >>> 0);
  const i = r.int(0, ids.length - 1);
  let j = r.int(0, ids.length - 2);
  if (j >= i) j++;
  run.relicOffer = [ids[i], ids[j]];
  return run.relicOffer;
}

/** Modificateurs de la Relique portée ({} sans Relique). */
export function relicMods(run) { return run && run === st.run ? st.mods : EMPTY; }
export function currentRelicId() { return st.run ? st.run.relicId : null; }

/**
 * Prend la Relique `relicId` (null = aucune). Un seul choix par nuit. Renvoie true si le choix
 * est enregistré. Applique les effets et le revers, note la découverte au codex, émet relic:pick.
 */
export function pickRelic(run, relicId) {
  if (!run || run !== st.run || run.relicPicked || run.finished) return false;
  if (relicId === null || relicId === undefined) { run.relicPicked = true; return true; }
  const def = relicDef(relicId);
  if (!def) return false;
  run.relicPicked = true;
  run.relicId = relicId;
  st.mods = Object.assign({}, def.effects || EMPTY, def.drawbacks || EMPTY);
  applyToPlayer(st.player, st.mods);
  applyToWorld(st.world, st.mods);
  if (st.mods.decayMult) setDecayMult(st.mods.decayMult);
  const save = getSave();
  save.codex.relics = save.codex.relics || {};
  save.codex.relics[relicId] = (save.codex.relics[relicId] || 0) + 1;
  commit();
  pickPayload.relicId = relicId;
  bus.emit('relic:pick', pickPayload);
  return true;
}

// Stats : les bonus vont dans p.upgradeBonus (base + Beffroi + Relique, puis Accords par-dessus).
function applyToPlayer(p, m) {
  if (!p) return;
  const b = p.upgradeBonus;
  const base = (k) => p.base[k] + b[k];
  if (m.magnetAll) b.magnet += MAGNET_ALL;
  if (m.xpGain) b.xpGain += m.xpGain;
  if (m.bronzeMult) b.bronzeGain += (m.bronzeMult - 1) * base('bronzeGain');
  if (m.windowMult) b.windowMult += m.windowMult;
  if (m.windowScale) b.windowMult += (m.windowScale - 1) * base('windowMult');
  if (m.speedMult) b.speed += m.speedMult * base('speed');
  if (m.damageMult) b.damageMult += m.damageMult;
  if (m.maxHpMult) b.maxHp += Math.round(m.maxHpMult * base('maxHp'));
  if (m.cadence) b.cadence += m.cadence;
  if (m.regenFlat) b.regen += m.regenFlat;
  recomputeStats(p);
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  refreshWeapons(p);
}

function applyToWorld(world, m) {
  if (!world) return;
  if (m.fissureEarlySec) world.fissureEarlySec = m.fissureEarlySec;
  if (m.knockbackMult !== undefined) world.knockbackMult = m.knockbackMult;
  if (m.parryTwice) world.parryTwice = true;
  if (m.hideOutsideHalo) world.hideRadius = haloRadius(m);
}

/** Rayon du halo du Battant (comme player.renderPlayer) × haloMult. */
function haloRadius(m) {
  const r = balance().player.lightRadius + resonanceTier() * 15;
  return r * 1.12 * (m.haloMult || 1);
}

// Cierge noir : PV des ennemis (−15 %) et des Fêlures (+50 %), jamais les boss.
function onSpawn(e) {
  const m = st.mods;
  if (!st.world || (!m.enemyHpMult && !m.eliteHpMult)) return;
  const items = st.world.enemies.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const en = items[i];
    if (en.id !== e.id) continue;
    if (en.boss) return;
    const k = en.elite ? (m.eliteHpMult || 1) : (m.enemyHpMult || 1);
    en.maxHp = Math.max(1, Math.round(en.maxHp * k)); en.hp = en.maxHp;
    return;
  }
}

// Bourse percée : aucun soin (le soin vient d'être appliqué : on le reprend).
function onHeal(e) {
  const p = st.player;
  if (!p || !st.mods.noHeal || p.dead) return;
  p.hp = Math.max(1, p.hp - e.amount);
}

/** Tick logique (game.updateGame) : régénération ×2, blocage de la régénération, rayon du voile. */
export function updateRelics(dt) {
  const p = st.player, m = st.mods;
  if (!p || m === EMPTY || p.dead) return;
  if (m.noHeal) p.regenAcc = 0;
  else if (m.regenMult > 1 && p.stats.regen > 0 && p.hp < p.maxHp) p.regenAcc += p.stats.regen * (m.regenMult - 1) * dt;
  if (m.hideOutsideHalo && st.world) st.world.hideRadius = haloRadius(m);
}

/** Rendu (game.renderGame) : halo élargi du Voile de brume. */
export function renderRelics(alpha) {
  const p = st.player, m = st.mods;
  if (!p || !m.haloMult) return;
  const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha;
  const r = haloRadius(m);
  addLight(x, y - 12, r, '#d9a54c', 0.7, 0.06);
  addLight(x, y - 12, r * 2.4, '#d9a54c', 0.45, 0.03, true);
}
