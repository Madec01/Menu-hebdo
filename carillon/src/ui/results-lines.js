// ui/results-lines.js — lignes du bilan (sous-module de results.js, vague 2) : à partir des RunStats,
// construit la liste des faits de la nuit à afficher sous le Bronze — Sourdine et multiplicateur,
// contrats (réussis / ratés, Bronze en prime), veillée et record, record de la paroisse, Nuit du jour,
// TOUS les Feuillets retrouvés, hauts-faits, sonneurs rejoints, Timbres de départ, et « prochain
// déblocage ». Chaque ligne : { text, color }. results.js les dessine jusqu'à la place disponible.

import { t, fmtTime } from './i18n.js';
import { C } from './widgets.js';
import { roman } from './sourdine.js';
import { nextUnlockText } from './next-unlock.js';
import { contractLine } from './hub-contracts.js';

/** Lignes de gauche (sous le Bronze). */
export function infoLines(s, victory, killer) {
  const out = [];
  const add = (text, color) => out.push({ text, color: color || C.encreClaire });
  if (!victory && killer) add(t('ui.results.killer', { name: t('enemy.' + killer + '.name') }));
  // D'abord ce qui est nouveau (tous les Feuillets de la nuit, sonneurs, hauts-faits), puis les chiffres.
  for (const id of s.leaves || []) add(t('ui.results.leaf', { title: t('lore.' + id + '.title') }), C.braise);
  for (const id of s.characters || []) add(t('ui.hub.unlocked_char', { name: t('char.' + id + '.name') }), C.braise);
  for (const id of s.achievements || []) add(t('ui.results.achievement', { name: t('achievement.' + id + '.name') }), C.braise);
  if (s.sourdineNext > 0) add(t('ui.results.sourdine_next', { level: roman(s.sourdineNext) }), C.braise);
  if (s.vigil) add(t('ui.results.vigil', { time: fmtTime(s.vigilSec || 0) }) + (s.isVigilRecord ? ' · ' + t('ui.results.record') : ''), C.braise);
  if (s.daily) add(t('ui.results.daily', { score: s.dailyScore || 0, rank: s.dailyRank || 0 }), C.bronze);
  if (s.isRecord) add(t('ui.results.parish_record', { time: fmtTime(s.recordTime || s.timeSec) }), C.braise);
  if (s.sourdine > 1) add(t('ui.results.sourdine', { level: roman(s.sourdine || 1), bronze: s.sourdineBronzeMult || 1 }), C.bronze);
  if (s.contractBronze > 0) add(t('ui.results.contract_bronze', { bronze: s.contractBronze }), C.bronze);
  for (const id of s.startWeapons || []) add(t('ui.results.start_weapon', { name: t('weapon.' + id + '.name') }), C.bronze);
  return out;
}

/** Lignes des contrats (colonne de droite) : [{ text, color }]. */
export function contractLines(s) {
  const out = [];
  for (const c of s.contracts || []) out.push({ text: (c.done ? '+ ' : '- ') + contractLine(c), color: c.done ? C.bronze : C.encreClaire });
  return out;
}

/** « Prochain : … » */
export function nextLine(s) { return t('ui.results.next', { text: nextUnlockText(s.parishId) }); }
