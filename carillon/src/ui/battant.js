// ui/battant.js — le Battant parle (vague 2) : répliques courtes (battant.* dans fr.json / en.json)
// affichées en toast au hub selon l'état de la sauvegarde — première nuit, première mort, première aube,
// un sonneur qui rejoint le Beffroi, cinq et dix nuits, Sourdine V, premier contrat, premier Feuillet lu,
// Bronze qui dort, fin du jeu… Chaque réplique n'est dite qu'une fois (save.battantSeen) et une seule par
// visite du hub. `leafComment(id)` = commentaire optionnel d'un Feuillet à sa première lecture
// (battant.leaf_<id>), affiché par ui/lore.js.

import { getSave, commit } from '../core/save.js';
import { t, has } from './i18n.js';
import { toast } from './toasts.js';

const has1 = (arr, id) => Array.isArray(arr) && arr.indexOf(id) >= 0;
const anyAtLeast = (map, n) => { for (const k in (map || {})) if (map[k] >= n) return true; return false; };

/** Répliques du hub, de la plus rare à la plus commune (la première non dite qui s'applique est retenue). */
const LINES = [
  { id: 'ending_seen', when: (s) => !!(s.ending && s.ending.seen) },
  { id: 'ending_muet', when: (s) => !!(s.ending && s.ending.muet) },
  { id: 'sourdine_v', when: (s) => anyAtLeast(s.sourdine && s.sourdine.unlocked, 5) },
  { id: 'muet_joins', when: (s) => has1(s.unlocked.characters, 'le_muet') },
  { id: 'beffroi_open', when: (s) => has1(s.unlocked.parishes, 'beffroi_mere') },
  { id: 'maren_joins', when: (s) => has1(s.unlocked.characters, 'maren') },
  { id: 'osric_joins', when: (s) => has1(s.unlocked.characters, 'osric') },
  { id: 'first_win', when: (s) => s.stats.wins >= 1 },
  { id: 'first_contract', when: (s) => !!(s.stats.contracts && s.stats.contracts.done >= 1) },
  { id: 'first_leaf_read', when: (s) => !!(s.leavesRead && s.leavesRead.length >= 1) },
  { id: 'daily_done', when: (s) => !!(s.daily && s.daily.board && s.daily.board.length >= 1) },
  { id: 'ten_nights', when: (s) => s.stats.runs >= 10 },
  { id: 'five_nights', when: (s) => s.stats.runs >= 5 },
  { id: 'wall', when: (s) => s.stats.runs >= 4 && s.stats.wins === 0 },
  { id: 'first_death', when: (s) => s.stats.runs >= 1 && s.stats.wins === 0 },
  { id: 'bronze_idle', when: (s) => s.bronze >= 600 },
  { id: 'first_night', when: (s) => s.stats.runs === 0 },
];

/** Dit (en toast) la première réplique applicable non encore dite ; renvoie son id ou null. */
export function battantSpeak() {
  const s = getSave();
  if (!Array.isArray(s.battantSeen)) s.battantSeen = [];
  for (let i = 0; i < LINES.length; i++) {
    const L = LINES[i];
    if (s.battantSeen.indexOf(L.id) >= 0 || !has('battant.' + L.id)) continue;
    let ok = false;
    try { ok = L.when(s); } catch (e) { ok = false; }
    if (!ok) continue;
    s.battantSeen.push(L.id); commit();
    toast({ title: t('ui.toast.battant'), body: t('battant.' + L.id), icon: 'ui_coeur' });
    return L.id;
  }
  return null;
}

/** Commentaire du Battant sur un Feuillet (ou '' s'il n'en a pas). */
export function leafComment(leafId) {
  const k = 'battant.leaf_' + leafId;
  return has(k) ? t(k) : '';
}

/** Ids des répliques (tests). */
export function battantLineIds() { return LINES.map((l) => l.id); }
