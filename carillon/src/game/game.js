// game/game.js — façade d'une run pour main.js (sous-module game/, documenté ici).
// Assemble player, world, weapons, resonance, progression dans l'ordre correct et relie les
// événements : pickup:xp → addXp, level:choice → applyCard, player:death / boss vaincu → finishRun.
// main.js : await loadGameData() ; startGame({...}) ; à chaque tick updateGame(dt) ; à chaque
// frame beginFrame(alpha) → renderGame(ctx, alpha) → endFrame(). La pause = loop.setTimeScale(0)
// (rien à faire ici) ; pendant l'écran de cartes, main ne tick plus updateGame.

import { bus } from '../core/events.js';
import { makeRng } from '../core/rng.js';
import { getSave } from '../core/save.js';
import { conductorTick, phase } from '../audio/conductor.js';
import { setListener } from '../audio/sfx.js';
import { follow, snap } from '../render/camera.js';
import { setBeatPulse, setHaloPos, setAmbient, floorAmbient } from '../render/lighting.js';
import { renderParticles } from '../render/particles.js';
import { renderFx } from '../render/fx.js';
import { prepareTint } from '../render/atlas.js';
import { balance, parishDef, characterDef, waveDef, allEnemies, weaponDef, fusionDef } from './data.js';
import { createPlayer, updatePlayer } from './player.js';
import { createWorld, updateWorld, renderWorld, entityCount } from './world.js';
import { addWeapon, removeWeapon, updateWeapons } from './weapons.js';
import { initResonance, update as updateResonance } from './resonance.js';
import { initRun, updateRun, addXp, applyCard, finishRun, rerollCards } from './progression.js';

/** Relance des cartes (bouton de l'écran de cartes, E) : renvoie les nouvelles cartes ou null. */
export function rerollLevelUp() { return st.run && st.player ? rerollCards(st.run, st.player) : null; }

const st = { run: null, player: null, world: null, endT: -1, unsubs: [], active: false };
const END_DELAY_DEATH = 2.2;   // ralenti de mort (0,4×) puis bilan
const END_DELAY_VICTORY = 3.0;

/** Améliorations du Beffroi achetées, sous forme { id: niveau } (à partir de save.unlocked.upgrades). */
function upgradeLevels(save) {
  const out = {};
  const list = save.unlocked.upgrades || [];
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (typeof u === 'string') out[u] = (out[u] || 0) + 1;
    else if (u && u.id) out[u.id] = u.level || 1;
  }
  return out;
}

/**
 * Démarre une run. Renvoie { run, player, world }.
 * `weaponId` : Timbre de départ choisi au hub (repli sur cDef.startWeapon s'il est absent ou inconnu).
 * Un sonneur à `startWeaponFixed` (le Muet) reçoit toujours son Timbre, puis `weaponId` en second.
 */
export function startGame({ parishId, characterId, seed, assist = null, upgrades = null, weaponId = null }) {
  endGame();
  const save = getSave();
  const pDef = parishDef(parishId), cDef = characterDef(characterId), wDef = waveDef(parishId);
  if (!pDef || !cDef || !wDef) throw new Error('startGame : paroisse ou sonneur inconnu');
  const mode = assist || save.options.assist || 'none';
  const run = initRun({ parishId, characterId, seed, assist: mode });
  const player = createPlayer(cDef, upgrades || upgradeLevels(save));
  initResonance({ assist: mode, gain: player.stats.resonanceGain });
  const world = createWorld({ parishDef: pDef, rng: makeRng(run.rng.seed ^ 0x5bd1e995), waveDef: wDef });
  const chosen = weaponId && weaponDef(weaponId) ? weaponId : null;
  if (cDef.startWeaponFixed) { addWeapon(player, cDef.startWeapon); if (chosen && chosen !== cDef.startWeapon) addWeapon(player, chosen); }
  else addWeapon(player, chosen || cDef.startWeapon);
  snap(player.x, player.y);
  setHaloPos(player.x, player.y);
  // Nuit de la paroisse, relevée par la « lune grise » (lisibilité hors du halo).
  setAmbient(floorAmbient(pDef.ambient || '#16130f'));
  prepareTints();
  st.run = run; st.player = player; st.world = world; st.endT = -1; st.active = true;
  st.unsubs.push(bus.on('pickup:xp', (e) => { if (st.run) addXp(st.run, e.amount); }));
  st.unsubs.push(bus.on('level:choice', (e) => { if (st.run && st.player) applyCard(st.run, st.player, e.card); }));
  st.unsubs.push(bus.on('player:death', () => { if (st.endT < 0) st.endT = END_DELAY_DEATH; }));
  return st;
}

/** Pré-génère les feuilles teintées (flash blanc, marque, élite) pour ne pas les créer au premier coup. */
function prepareTints() {
  for (const def of allEnemies().values()) { prepareTint(def.sprite, '#ffffff'); prepareTint(def.sprite, '#c9973f'); }
}

/** Tick logique complet. */
export function updateGame(dt) {
  if (!st.active) return;
  const { run, player, world } = st;
  conductorTick();
  updatePlayer(player, dt, world);
  updateWorld(world, dt, player);
  updateWeapons(player, dt, world);
  updateResonance(dt);
  updateRun(run, dt, player, world);
  follow(player.x, player.y, dt);
  setListener(player.x, player.y);
  if (world.ended && world.victory && st.endT < 0) st.endT = END_DELAY_VICTORY;
  if (st.endT >= 0) {
    st.endT -= dt;
    if (st.endT <= 0) { st.endT = -1; finishRun(run, world.victory && !player.dead); st.active = false; }
  }
}

/** Rendu complet du monde (ctx = calque principal déjà transformé). Le halo de la Mesure
 *  (lighting.drawBeatHalo) est dessiné par world.renderWorld juste après le sol ; drawBeatHalo et
 *  la lueur automatique de lighting sont inertes quand la pulsation vaut 0 (option beatIndicator). */
export function renderGame(ctx, alpha) {
  if (!st.world) return;
  const p = st.player;
  if (p) setHaloPos(p.px + (p.x - p.px) * alpha, p.py + (p.y - p.py) * alpha);
  // Option beatIndicator ('visual' | 'audio' | 'both') : le halo (et sa lueur) n'existe qu'en visuel.
  const bi = getSave().options.beatIndicator;
  setBeatPulse(bi === 'audio' || bi === 'none' ? 0 : 1 - phase());
  renderWorld(ctx, st.world, alpha);
  renderParticles(ctx, alpha);
  renderFx(ctx, alpha);
}

/**
 * Abandon (menu pause → « Abandonner ») : termine proprement la run avec victory = false
 * (RunStats, Bronze de défaite, sauvegarde, `run:end`), puis libère la run. Sans effet si aucune
 * run active ou déjà terminée. Renvoie les RunStats ou null.
 */
export function abandonGame() {
  if (!st.run) return null;
  const stats = st.run.finished ? st.run.stats : finishRun(st.run, false);
  st.active = false; st.endT = -1;
  return stats;
}

/**
 * Débogage / tests : donne (ou monte d'un niveau) un Timbre ou une fusion au joueur courant ;
 * only = true retire d'abord les autres armes (capture d'une arme seule). Renvoie l'arme ou null.
 * Ex. window.carillon.deps.game.debugGiveWeapon('tocsin', true).
 */
export function debugGiveWeapon(id, only = false) {
  if (!st.player || !(weaponDef(id) || fusionDef(id))) return null;
  if (only) for (let i = st.player.weapons.length - 1; i >= 0; i--) if (st.player.weapons[i].id !== id) removeWeapon(st.player, st.player.weapons[i].id);
  return addWeapon(st.player, id);
}

/** Libère la run courante (désabonnements). */
export function endGame() {
  for (let i = 0; i < st.unsubs.length; i++) st.unsubs[i]();
  st.unsubs.length = 0;
  if (st.player) for (let i = 0; i < st.player.weapons.length; i++) if (st.player.weapons[i].unschedule) st.player.weapons[i].unschedule();
  st.run = null; st.player = null; st.world = null; st.active = false; st.endT = -1;
}

export function gameState() { return st; }
export function isGameActive() { return st.active; }
export function gameEntityCount() { return st.world ? entityCount(st.world) : 0; }
export function gameBalance() { return balance(); }
