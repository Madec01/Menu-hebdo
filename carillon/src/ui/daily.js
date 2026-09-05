// ui/daily.js — Nuit du jour (vague 2) : une nuit dont la seed est la date (hashSeed('carillon-AAAA-MM-JJ')),
// paroisse imposée (les paroisses ouvertes tournent avec le jour), sonneur = le dernier joué (s'il est
// débloqué), Relique et contrats du tirage de la seed, les contrats proposés étant tous acceptés. Le score
// (game/meta.js : temps + tués + niveau ×10 + 1000 si l'aube est sonnée + veillée ×2) entre au classement
// local des 5 meilleurs (save.daily.board, une entrée par date). Lancée depuis l'écran-titre.

import { getSave } from '../core/save.js';
import { hashSeed } from '../core/rng.js';
import { parishes, waveOf } from './gamedata.js';
import { offerContracts } from '../game/contracts.js';

const DAY_MS = 86400000;

/** Date locale du jour : 'AAAA-MM-JJ'. */
export function dailyDate(now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
  return y + '-' + (m < 10 ? '0' + m : m) + '-' + (d < 10 ? '0' + d : d);
}

/** Meilleure entrée du classement pour la date (ou null). */
export function dailyBest(date = dailyDate()) {
  const s = getSave();
  const board = (s.daily && s.daily.board) || [];
  for (let i = 0; i < board.length; i++) if (board[i].date === date) return board[i];
  return null;
}

/** Classement local (5 max), trié par score décroissant. */
export function dailyBoard() { const s = getSave(); return ((s.daily && s.daily.board) || []).slice(); }

/** Paramètres de l'écran 'run' pour la Nuit du jour. */
export function dailyParams(date = dailyDate()) {
  const s = getSave();
  const open = parishes().filter((p) => s.unlocked.parishes.indexOf(p.id) >= 0);
  const dayIndex = Math.floor(new Date(date + 'T12:00:00').getTime() / DAY_MS);
  const parish = open.length ? open[dayIndex % open.length] : { id: 'cendrelune' };
  const character = s.lastCharacter && s.unlocked.characters.indexOf(s.lastCharacter) >= 0 ? s.lastCharacter : 'wren';
  const seed = hashSeed('carillon-' + date);
  const wave = waveOf(parish.id);
  const moments = wave && wave.moments ? wave.moments.map((m) => m.id) : null;
  const contracts = offerContracts(seed, 2, { parishId: parish.id, characterId: character, moments });
  return {
    parishId: parish.id, characterId: character, seed, seedText: date, tutorial: false, weaponId: null,
    sourdine: 1, contracts, daily: date, holdVictory: true,
  };
}
