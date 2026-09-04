// game/unlocks.js — déblocages de fin de run (sous-module de progression.js) : Feuillets du
// Battant (lore.json, 8 types de conditions) et hauts-faits (achievements.json). Les conditions
// sont évaluées contre la sauvegarde déjà mise à jour par la run qui vient de finir.
// Extension du schéma Save (documentée) : save.stats.winsByParish et save.stats.winsByCharacter
// ({ id: nombre }) servent aux conditions « toutes les paroisses » / « tous les sonneurs ».
// Émet lore:unlock {leafId} et achievement:unlock {id} ; joue lore_unlock / achievement.
// Timbres de départ (save.unlocked.weapons) : unlockStartWeapon / syncStartWeapons, appelés par
// progression.js (niveau max en run, fusion découverte, Timbres des sonneurs débloqués).

import { bus } from '../core/events.js';
import { play as playSfx } from '../audio/sfx.js';
import { loreDefs, achievementDefs, weaponDef, fusionDef, allCharacters } from './data.js';

const lorePayload = { leafId: '' };
const achPayload = { id: '' };

function count(map, key) { return (map && map[key]) || 0; }
function keys(map) { return map ? Object.keys(map).length : 0; }

/** Condition d'un Feuillet. `f` = faits de la run (voir progression.finishRun). */
export function leafCondition(c, f, save) {
  switch (c.type) {
    case 'run_minute': return f.parishId === c.parish && f.timeSec >= c.minute * 60;
    case 'kills': return count(save.codex.enemies, c.enemy) >= c.count;
    case 'boss_kill': return f.bossKilled === c.boss || count(save.codex.bosses, c.boss) > 0;
    case 'run_win': return f.victory && f.parishId === c.parish && (!c.character || f.characterId === c.character);
    case 'character': return f.characterId === c.character;
    case 'fusion': return f.fusions.indexOf(c.fusion) >= 0 || save.unlocked.fusions.indexOf(c.fusion) >= 0;
    case 'resonance_max_time': return f.maxTierTime >= c.seconds;
    case 'runs': return save.stats.runs >= c.count;
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
    default: return false;
  }
}

/** Évalue tout ; ajoute les nouveaux déblocages à la sauvegarde ; renvoie { leaves, achievements } (ids nouveaux). */
export function evaluateUnlocks(f, save, out) {
  out.leaves.length = 0; out.achievements.length = 0;
  const lore = loreDefs();
  for (let i = 0; i < lore.length; i++) {
    const l = lore[i];
    if (save.unlocked.leaves.indexOf(l.id) >= 0 || !l.unlock) continue;
    if (leafCondition(l.unlock, f, save)) { save.unlocked.leaves.push(l.id); out.leaves.push(l.id); }
  }
  // Deux passes : un haut-fait peut dépendre des Feuillets qui viennent de s'ouvrir.
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
  if (out.achievements.length) playSfx('achievement');
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
