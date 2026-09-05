// ui/sourdine.js — Sourdine I–V (vague 2) côté interface : niveau débloqué et niveau choisi par paroisse
// (save.sourdine.unlocked / chosen ; I par défaut, II ouvert par la victoire au niveau I, etc.),
// multiplicateurs lus dans parishes.json `sourdineLevels[n-1]` = { difficulty, bronze }, libellés en
// chiffres romains. Le gameplay lit save.sourdine.chosen lui-même (game/game.js).

import { getSave, commit } from '../core/save.js';
import { def as dataDef } from './gamedata.js';
import { t } from './i18n.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** Nombre de niveaux d'une paroisse (5 par défaut). */
export function sourdineMax(parishId) {
  const p = dataDef('parishes', parishId);
  return p && Array.isArray(p.sourdineLevels) && p.sourdineLevels.length ? p.sourdineLevels.length : 5;
}

/** Niveau le plus haut ouvert dans cette paroisse (≥ 1). */
export function sourdineUnlocked(parishId) {
  const s = getSave();
  const n = s.sourdine && s.sourdine.unlocked ? s.sourdine.unlocked[parishId] | 0 : 0;
  return Math.max(1, Math.min(sourdineMax(parishId), n));
}

/** Niveau choisi pour la prochaine nuit (1..débloqué). */
export function sourdineChosen(parishId) {
  const s = getSave();
  const n = s.sourdine && s.sourdine.chosen ? s.sourdine.chosen[parishId] | 0 : 0;
  return Math.max(1, Math.min(sourdineUnlocked(parishId), n));
}

/** Choisit le niveau (borné) ; renvoie le niveau retenu. */
export function setSourdine(parishId, level) {
  const s = getSave();
  if (!s.sourdine) s.sourdine = { unlocked: {}, chosen: {} };
  if (!s.sourdine.chosen) s.sourdine.chosen = {};
  const n = Math.max(1, Math.min(sourdineUnlocked(parishId), level | 0));
  if (s.sourdine.chosen[parishId] !== n) { s.sourdine.chosen[parishId] = n; commit(); }
  return n;
}

/** Multiplicateurs { difficulty, bronze } du niveau. */
export function sourdineInfo(parishId, level) {
  const p = dataDef('parishes', parishId);
  const L = p && Array.isArray(p.sourdineLevels) ? p.sourdineLevels[Math.max(0, Math.min(p.sourdineLevels.length - 1, (level | 0) - 1))] : null;
  return { difficulty: L && L.difficulty > 0 ? L.difficulty : 1, bronze: L && L.bronze > 0 ? L.bronze : 1 };
}

/** « II » */
export function roman(n) { return ROMAN[Math.max(0, Math.min(ROMAN.length - 1, (n | 0) - 1))]; }

/** « Sourdine II » */
export function sourdineLabel(n) { return t('ui.sourdine.level', { level: roman(n) }); }

/** « Sourdine II · Bronze ×1,3 · difficulté ×1,25 » */
export function sourdineSummary(parishId, n) {
  const i = sourdineInfo(parishId, n);
  return t('ui.sourdine.summary', { level: roman(n), bronze: i.bronze, difficulty: i.difficulty });
}
