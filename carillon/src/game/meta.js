// game/meta.js — mise à jour de la sauvegarde en fin de run (sous-module de progression.js, vague 2) :
// records par paroisse et par sonneur (save.records), veillée (save.records.vigil), Sourdine débloquée par la
// victoire (save.sourdine.unlocked), morts par sonneur (save.stats.deathsByCharacter), Nuit du jour
// (save.daily.board : 5 meilleurs scores, un par date), fin du jeu (victoire au Beffroi Mère : save.ending,
// tous les Feuillets restants s'ouvrent). Renvoie ce que le bilan affiche : { isRecord, recordTime, sourdineNext,
// dailyScore, dailyRank, ending }. Ne commit pas : progression.finishRun le fait.

import { loreDefs, parishDef } from './data.js';
import { sourdineLevels } from './night-rules.js';

const DAILY_BOARD = 5;

/** Score de la Nuit du jour : temps tenu + tués + niveau ×10 + 1000 si l'aube est sonnée. */
export function dailyScore(run, victory) {
  return Math.round(run.timeSec) + run.kills + run.level * 10 + (victory ? 1000 : 0) + Math.round((run.vigilSec || 0) * 2);
}

function record(map, id, run, victory) {
  const r = map[id] || (map[id] = { bestTime: 0, bestLevel: 0, bestKills: 0, bestSourdine: 0, wins: 0, runs: 0, seed: 0, character: '', parish: '' });
  r.runs++;
  if (victory) r.wins++;
  const t = Math.round(run.timeSec);
  let isRecord = false;
  if (t > r.bestTime) { r.bestTime = t; r.seed = run.seed; r.character = run.characterId; r.parish = run.parishId; isRecord = true; }
  if (run.level > r.bestLevel) r.bestLevel = run.level;
  if (run.kills > r.bestKills) r.bestKills = run.kills;
  if (victory && (run.sourdine || 1) > r.bestSourdine) r.bestSourdine = run.sourdine || 1;
  return isRecord;
}

/** Applique tout ; `out` reçoit les champs du bilan. */
export function applyMeta(run, save, victory, out) {
  const parish = parishDef(run.parishId);
  save.records = save.records || { parish: {}, character: {}, vigil: {} };
  const prev = (save.records.parish[run.parishId] || {}).bestTime || 0;
  out.isRecord = record(save.records.parish, run.parishId, run, victory) && prev > 0;
  record(save.records.character, run.characterId, run, victory);
  out.recordTime = save.records.parish[run.parishId].bestTime;
  // Veillée : record de secondes tenues après l'aube.
  if (run.vigil) {
    const v = Math.round(run.vigilSec || 0);
    if (v > (save.records.vigil[run.parishId] || 0)) { save.records.vigil[run.parishId] = v; out.isVigilRecord = true; }
  }
  // Sourdine : la victoire au niveau n ouvre le niveau n + 1.
  save.sourdine = save.sourdine || { unlocked: {}, chosen: {} };
  out.sourdineNext = 0;
  if (victory) {
    const max = sourdineLevels(parish);
    const next = Math.min(max, (run.sourdine || 1) + 1);
    if (next > (save.sourdine.unlocked[run.parishId] || 1)) { save.sourdine.unlocked[run.parishId] = next; out.sourdineNext = next; }
  }
  // Morts par sonneur (lues par la scène de fin).
  if (!victory) {
    save.stats.deathsByCharacter = save.stats.deathsByCharacter || {};
    save.stats.deathsByCharacter[run.characterId] = (save.stats.deathsByCharacter[run.characterId] || 0) + 1;
  }
  // Nuit du jour : classement local.
  if (run.daily) {
    save.daily = save.daily || { board: [] };
    const score = dailyScore(run, victory);
    const board = save.daily.board;
    const same = board.findIndex((e) => e.date === run.daily);
    const entry = { date: run.daily, score, parish: run.parishId, character: run.characterId, victory, time: Math.round(run.timeSec) };
    if (same >= 0) { if (board[same].score < score) board[same] = entry; }
    else board.push(entry);
    board.sort((a, b) => b.score - a.score);
    if (board.length > DAILY_BOARD) board.length = DAILY_BOARD;
    out.dailyScore = score;
    out.dailyRank = board.findIndex((e) => e.date === run.daily && e.score >= score) + 1;
    save.daily.lastDate = run.daily;
  }
  // Fin : le Beffroi Mère sonné → scène de fin, Feuillets restants offerts.
  out.ending = null;
  if (victory && run.parishId === 'beffroi_mere') {
    save.ending = save.ending || { seen: false, muet: false };
    const muet = run.characterId === 'le_muet';
    out.ending = { muet, first: !save.ending.seen };
    save.ending.seen = true;
    if (muet) save.ending.muet = true;
    const lore = loreDefs();
    out.endingLeaves = [];
    for (let i = 0; i < lore.length; i++) if (save.unlocked.leaves.indexOf(lore[i].id) < 0) { save.unlocked.leaves.push(lore[i].id); out.endingLeaves.push(lore[i].id); }
    save.leavesPending = [];
  }
  return out;
}
