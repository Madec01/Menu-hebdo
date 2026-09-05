// game/unlocks.js — déblocages de fin de run (sous-module de progression.js) : Feuillets du
// Battant (lore.json), hauts-faits (achievements.json) et sonneurs par quête (characters.json `unlock`).
// Les conditions sont évaluées contre la sauvegarde déjà mise à jour par la run qui vient de finir.
// Vague 2 : · tout Feuillet appartient à une paroisse (parishes.json `leaves`) et ne s'ouvre que lors d'une
// nuit dans cette paroisse ; · toute condition accepte un champ `parish` (la run doit s'y dérouler) ;
// · plafond de LEAVES_PER_NIGHT Feuillets par nuit — les autres, dont la condition est remplie, attendent
// dans save.leavesPending et sortent en premier la nuit suivante (dans la même paroisse) ; · un Feuillet
// peut être offert directement (récompense de contrat : grantParishLeaf) ; · les sonneurs se gagnent par
// une quête (run_win, bell_answers, leaf_read_tier) ou, en repli, s'achètent au hub.
// Émet lore:unlock {leafId} et achievement:unlock {id} ; joue lore_unlock / achievement. Les sonneurs
// débloqués sont annoncés par l'UI (différence sur save:changed).
// Timbres de départ (save.unlocked.weapons) : unlockStartWeapon / syncStartWeapons, appelés par
// progression.js (niveau max en run, fusion découverte, Timbres des sonneurs débloqués).

import { bus } from '../core/events.js';
import { play as playSfx } from '../audio/sfx.js';
import { loreDefs, achievementDefs, weaponDef, fusionDef, allCharacters, allParishes } from './data.js';

export const LEAVES_PER_NIGHT = 2;
const lorePayload = { leafId: '' };
const achPayload = { id: '' };

function count(map, key) { return (map && map[key]) || 0; }
function keys(map) { return map ? Object.keys(map).length : 0; }

/** Paroisse d'un Feuillet d'après parishes.json `leaves` (ou null s'il n'est distribué nulle part). */
export function leafParish(leafId) {
  for (const p of allParishes().values()) if (p.leaves && p.leaves.indexOf(leafId) >= 0) return p.id;
  return null;
}

/** Condition d'un Feuillet. `f` = faits de la run (voir progression.finishRun). */
export function leafCondition(c, f, save) {
  if (c.parish && f.parishId !== c.parish) return false;
  switch (c.type) {
    case 'run_minute': return f.timeSec >= c.minute * 60;
    case 'kills': return count(save.codex.enemies, c.enemy) >= c.count;
    case 'boss_kill': return f.bossKilled === c.boss || count(save.codex.bosses, c.boss) > 0;
    case 'run_win': return f.victory && (!c.character || f.characterId === c.character);
    case 'character': return f.characterId === c.character;
    case 'fusion': return f.fusions.indexOf(c.fusion) >= 0 || save.unlocked.fusions.indexOf(c.fusion) >= 0;
    case 'resonance_max_time': return f.maxTierTime >= c.seconds;
    case 'runs': return save.stats.runs >= c.count;
    case 'bell_answers': return f.bellAnswers >= c.count || (save.stats.bellAnswers || 0) >= c.count;
    case 'bell_answers_run': return f.bellAnswers >= c.count;
    default: return false;
  }
}

/** Condition d'un haut-fait. */
export function achievementCondition(c, f, save) {
  switch (c.type) {
    case 'run_win': return save.stats.wins >= c.count;
    case 'runs': return save.stats.runs >= c.count;
    case 'echoes_run': return f.echoes >= c.count;
    case 'kills_total': return save.stats.kills >= c.count;
    case 'weapons_run': return f.weaponCount >= c.count;
    case 'passives_run': return f.passiveCount >= c.count;
    case 'fusions_run': return f.fusions.length >= c.count;
    case 'fusions_unlocked': return save.unlocked.fusions.length >= c.count;
    case 'perfects_run': return f.perfects >= c.count;
    case 'run_win_no_miss': return f.victory && f.misses === 0 && f.inputs > 0 && f.assist !== 'norhythm';
    case 'boss_kill': return f.bossKilled === c.boss;
    case 'parishes_won': return keys(save.stats.winsByParish) >= c.count;
    case 'characters_won': return keys(save.stats.winsByCharacter) >= c.count;
    case 'leaves': return save.unlocked.leaves.length >= c.count;
    case 'run_win_assist': return f.victory && f.assist === c.assist;
    case 'run_win_character': return f.victory && f.characterId === c.character;
    case 'weapons_unlocked': return save.unlocked.weapons.length >= c.count;
    case 'bell_answers': return (save.stats.bellAnswers || 0) >= c.count;
    case 'run_win_sourdine': return f.victory && f.parishId === c.parish && (f.sourdine || 1) >= c.level;
    case 'vigil_seconds': return (f.vigilSec || 0) >= c.seconds;
    case 'daily_done': return !!f.daily;
    case 'contracts_done': return ((save.stats.contracts && save.stats.contracts.done) || 0) >= c.count;
    default: return false;
  }
}

/** Quête d'un sonneur (characters.json `unlock`). */
export function characterCondition(c, f, save) {
  if (!c) return false;
  switch (c.type) {
    case 'run_win': return f.victory && (!c.parish || f.parishId === c.parish);
    case 'bell_answers': return (save.stats.bellAnswers || 0) >= c.count;
    case 'leaf_read_tier': {
      const read = !!(save.leavesRead && save.leavesRead.indexOf(c.leaf) >= 0);
      const held = Math.max((f.tierHold && f.tierHold[c.tier]) || 0, save.stats.tierHold || 0);
      return read && held >= c.seconds;
    }
    default: return false;
  }
}

/** Progression lisible d'une quête de sonneur : { progress, goal } (hub). */
export function characterQuestProgress(c, save) {
  if (!c) return { progress: 0, goal: 1 };
  if (c.type === 'run_win') return { progress: Math.min(1, count(save.stats.winsByParish, c.parish)), goal: 1 };
  if (c.type === 'bell_answers') return { progress: Math.min(c.count, save.stats.bellAnswers || 0), goal: c.count };
  if (c.type === 'leaf_read_tier') {
    const read = !!(save.leavesRead && save.leavesRead.indexOf(c.leaf) >= 0);
    return { progress: (read ? 1 : 0) + ((save.stats.tierHold || 0) >= c.seconds ? 1 : 0), goal: 2 };
  }
  return { progress: 0, goal: 1 };
}

function pushLeaf(save, out, id) {
  if (save.unlocked.leaves.indexOf(id) >= 0) return false;
  save.unlocked.leaves.push(id); out.leaves.push(id);
  const i = save.leavesPending ? save.leavesPending.indexOf(id) : -1;
  if (i >= 0) save.leavesPending.splice(i, 1);
  return true;
}

/** Offre le prochain Feuillet fermé de la paroisse (récompense de contrat) ; renvoie l'id ou null. */
export function grantParishLeaf(save, parishId, out) {
  const p = allParishes().get(parishId);
  const list = p && p.leaves ? p.leaves : [];
  for (let i = 0; i < list.length; i++) if (pushLeaf(save, out, list[i])) return list[i];
  return null;
}

/** Évalue tout ; ajoute les nouveaux déblocages à la sauvegarde ; renvoie { leaves, achievements, characters }. */
export function evaluateUnlocks(f, save, out) {
  out.leaves.length = 0; out.achievements.length = 0; out.characters.length = 0;
  save.leavesPending = save.leavesPending || [];
  const lore = loreDefs();
  let released = 0;
  // 1. Feuillets en attente (plafond de la nuit précédente), dans la paroisse de cette nuit.
  for (let i = 0; i < save.leavesPending.length && released < LEAVES_PER_NIGHT; i++) {
    const id = save.leavesPending[i], lp = leafParish(id);
    if (lp && lp !== f.parishId) continue;
    if (pushLeaf(save, out, id)) { released++; i--; }
  }
  // 2. Conditions remplies cette nuit : ouverts jusqu'au plafond, retenus au-delà.
  for (let i = 0; i < lore.length; i++) {
    const l = lore[i];
    if (save.unlocked.leaves.indexOf(l.id) >= 0 || !l.unlock || save.leavesPending.indexOf(l.id) >= 0) continue;
    const lp = leafParish(l.id);
    if (lp && lp !== f.parishId) continue;
    if (!leafCondition(l.unlock, f, save)) continue;
    if (released < LEAVES_PER_NIGHT) { pushLeaf(save, out, l.id); released++; }
    else save.leavesPending.push(l.id);
  }
  // 3. Sonneurs par quête.
  for (const c of allCharacters().values()) {
    if (save.unlocked.characters.indexOf(c.id) >= 0 || !c.unlock) continue;
    if (characterCondition(c.unlock, f, save)) { save.unlocked.characters.push(c.id); out.characters.push(c.id); }
  }
  // 4. Hauts-faits, deux passes : l'un peut dépendre des Feuillets qui viennent de s'ouvrir.
  const achs = achievementDefs();
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < achs.length; i++) {
      const a = achs[i];
      if (save.unlocked.achievements.indexOf(a.id) >= 0) continue;
      if (achievementCondition(a.condition, f, save)) { save.unlocked.achievements.push(a.id); out.achievements.push(a.id); }
    }
  }
  for (let i = 0; i < out.leaves.length; i++) { lorePayload.leafId = out.leaves[i]; bus.emit('lore:unlock', lorePayload); }
  for (let i = 0; i < out.achievements.length; i++) { achPayload.id = out.achievements[i]; bus.emit('achievement:unlock', achPayload); }
  if (out.leaves.length) playSfx('lore_unlock');
  if (out.achievements.length || out.characters.length) playSfx('achievement');
  return out;
}

/** Ajoute un Timbre aux Timbres de départ débloqués ; renvoie true s'il est nouveau. */
export function unlockStartWeapon(save, weaponId) {
  if (!weaponDef(weaponId)) return false;
  const list = save.unlocked.weapons;
  if (list.indexOf(weaponId) >= 0) return false;
  list.push(weaponId);
  return true;
}

/**
 * Cohérence des Timbres de départ avec le reste de la sauvegarde : le Timbre de chaque sonneur
 * débloqué et le Timbre composant de chaque fusion découverte sont toujours disponibles.
 * Renvoie le nombre de Timbres ajoutés (0 = rien à faire).
 */
export function syncStartWeapons(save) {
  let n = 0;
  for (const c of allCharacters().values()) if (save.unlocked.characters.indexOf(c.id) >= 0 && unlockStartWeapon(save, c.startWeapon)) n++;
  for (let i = 0; i < save.unlocked.fusions.length; i++) { const f = fusionDef(save.unlocked.fusions[i]); if (f && unlockStartWeapon(save, f.weapon)) n++; }
  return n;
}
