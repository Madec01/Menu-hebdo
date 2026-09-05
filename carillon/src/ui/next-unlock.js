// ui/next-unlock.js — « Prochain déblocage » (vague 2) : une phrase pour le bilan qui dit ce que le joueur
// vise ensuite, dans l'ordre : quête d'un sonneur encore verrouillé, prochain Feuillet fermé de la paroisse
// (avec son indice), paroisse suivante à ouvrir, niveau de Sourdine suivant. Aussi `unlockHint(u)` : indice
// lisible d'une condition de Feuillet (lore.json `unlock`), partagé avec le codex.

import { getSave } from '../core/save.js';
import { t, has } from './i18n.js';
import { characters, parishes, lore as loreDefs, def as dataDef } from './gamedata.js';
import { characterQuestProgress } from '../game/unlocks.js';
import { sourdineUnlocked, sourdineMax, roman } from './sourdine.js';

/** Indice de déblocage d'un Feuillet non retrouvé (lore.json `unlock`). */
export function unlockHint(u) {
  const key = 'ui.codex.unlock_' + u.type;
  if (!has(key)) return '';
  return t(key, {
    parish: u.parish ? t('parish.' + u.parish + '.name') : '', minute: u.minute || 0, count: u.count || 0,
    enemy: u.enemy ? t('enemy.' + u.enemy + '.name') : '', boss: u.boss ? t('boss.' + u.boss + '.name') : '',
    character: u.character ? t('char.' + u.character + '.name') : '', fusion: u.fusion ? t('fusion.' + u.fusion + '.name') : '',
    sec: u.seconds || 0, runs: u.count || 0,
  });
}

/** Texte de la quête d'un sonneur verrouillé : « Osric : sonne l'aube de Cendrelune (0 / 1) ». */
export function questText(c) {
  const s = getSave();
  const p = characterQuestProgress(c.unlock, s);
  const desc = has(c.quest || '') ? t(c.quest) : '';
  return t('ui.hub.quest', { name: t(c.name), quest: desc, progress: p.progress, goal: p.goal });
}

/** Prochain Feuillet fermé de la paroisse, ou null. */
export function nextLeafOf(parishId) {
  const s = getSave();
  const p = dataDef('parishes', parishId);
  const list = p && p.leaves ? p.leaves : [];
  for (let i = 0; i < list.length; i++) if (s.unlocked.leaves.indexOf(list[i]) < 0) return loreDefs().find((l) => l.id === list[i]) || { id: list[i] };
  return null;
}

/** Phrase du bilan. */
export function nextUnlockText(parishId) {
  const s = getSave();
  for (const c of characters()) if (c.unlock && s.unlocked.characters.indexOf(c.id) < 0) return t('ui.results.next_char', { text: questText(c) });
  const leaf = nextLeafOf(parishId);
  if (leaf) {
    const idx = loreDefs().findIndex((l) => l.id === leaf.id) + 1;
    return t('ui.results.next_leaf', { n: idx || 0, hint: leaf.unlock ? unlockHint(leaf.unlock) : '' });
  }
  for (const p of parishes()) {
    if (s.unlocked.parishes.indexOf(p.id) >= 0 || !p.unlock) continue;
    if (p.unlock.type === 'win' && s.unlocked.parishes.indexOf(p.unlock.parish) >= 0) return t('ui.results.next_parish', { parish: t(p.name), from: t('parish.' + p.unlock.parish + '.name') });
  }
  const u = sourdineUnlocked(parishId);
  if (u < sourdineMax(parishId)) return t('ui.results.next_sourdine', { level: roman(u + 1), parish: t('parish.' + parishId + '.name') });
  return t('ui.results.next_done');
}
