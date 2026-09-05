// ui/codex-records.js — onglet Records du codex (vague 2) : une entrée par paroisse et par sonneur
// (save.records.parish / .character : meilleur temps, niveau, tués, Sourdine la plus haute sonnée, aubes /
// nuits ; veillée record par paroisse save.records.vigil), puis le classement de la Nuit du jour.

import { getSave } from '../core/save.js';
import { t, fmtTime } from './i18n.js';
import { parishes, characters } from './gamedata.js';
import { text, paragraph, heading, C } from './widgets.js';
import { roman, sourdineUnlocked } from './sourdine.js';
import { dailyBoard } from './daily.js';

/** Entrées de l'onglet : paroisses (ouvertes ou non), sonneurs, Nuit du jour. */
export function recordItems() {
  const s = getSave();
  const rp = (s.records && s.records.parish) || {}, rc = (s.records && s.records.character) || {};
  const out = [];
  for (const p of parishes()) out.push({ id: 'p:' + p.id, def: p, kind: 'parish', known: !!rp[p.id], label: t(p.name), icon: 'ui_lanterne', rec: rp[p.id] || null });
  for (const c of characters()) out.push({ id: 'c:' + c.id, def: c, kind: 'character', known: !!rc[c.id], label: t(c.name), icon: 'ui_coeur', rec: rc[c.id] || null });
  out.push({ id: 'daily', def: null, kind: 'daily', known: dailyBoard().length > 0, label: t('ui.codex.daily'), icon: 'ui_sceau', rec: null });
  return out;
}

/** Détail d'une entrée dans le rectangle r. */
export function renderRecordDetail(ui, item, r) {
  const cx = r.x + r.w / 2;
  heading(ui, item.label, cx, r.y + 12, 14);
  let y = r.y + 40;
  const row = (label, value) => { text(ui, label, r.x + 14, y, { size: 9, color: C.encreClaire }); text(ui, value, r.x + r.w - 14, y, { size: 9, align: 'right', color: C.encre }); y += 12; };
  if (item.kind === 'daily') {
    const board = dailyBoard();
    if (!board.length) { paragraph(ui, t('ui.codex.daily_empty'), r.x + 12, y, r.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 4 }); return; }
    for (let i = 0; i < board.length; i++) {
      const e = board[i];
      row((i + 1) + '. ' + e.date + ' · ' + t('parish.' + e.parish + '.name') + ' · ' + t('char.' + e.character + '.name'), t('ui.codex.score', { score: e.score }));
    }
    return;
  }
  const rec = item.rec;
  if (!rec) { paragraph(ui, t('ui.codex.record_none'), r.x + 12, y, r.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 3 }); return; }
  row(t('ui.codex.record_nights'), t('ui.title.runs', { runs: rec.runs || 0, wins: rec.wins || 0 }));
  row(t('ui.codex.record_time'), fmtTime(rec.bestTime || 0) + (rec.character && item.kind === 'parish' ? ' · ' + t('char.' + rec.character + '.name') : ''));
  row(t('ui.codex.record_level'), String(rec.bestLevel || 0));
  row(t('ui.codex.record_kills'), String(rec.bestKills || 0));
  if (item.kind === 'parish') {
    const s = getSave();
    row(t('ui.codex.record_sourdine'), rec.bestSourdine > 0 ? roman(rec.bestSourdine) : t('ui.pause.empty'));
    row(t('ui.codex.record_sourdine_open'), roman(sourdineUnlocked(item.def.id)));
    const v = (s.records && s.records.vigil && s.records.vigil[item.def.id]) || 0;
    row(t('ui.codex.record_vigil'), v > 0 ? fmtTime(v) : t('ui.pause.empty'));
  }
}
