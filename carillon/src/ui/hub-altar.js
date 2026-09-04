// ui/hub-altar.js — autel des Feuillets : 24 emplacements (8 × 3), verrouillé /
// non lu (pastille braise) / lu. Entrée ouvre le lecteur (ui/lore.js, écran
// 'leaf'). Écran empilable 'altar'.

import { playUi } from '../audio/sfx.js';
import { t } from './i18n.js';
import * as states from './states.js';
import { leafIds, isUnlocked, isRead, renderLeafGrid } from './lore.js';
import { panel, text, paragraph, hit, backdrop, heading, C } from './widgets.js';

const W = 480, H = 270;
const COLS = 8, CELL_W = 56, CELL_H = 44, GX = 18, GY = 30;

export function createAltar() {
  let sel = 0, time = 0;
  const rects = [];

  function open() {
    const id = leafIds()[sel];
    if (!isUnlocked(id)) { playUi('ui_cancel'); return; }
    playUi('ui_confirm');
    states.push('leaf', { leafId: id });
  }

  function move(d) {
    const n = leafIds().length;
    const next = sel + d;
    if (next < 0 || next >= n) return;
    sel = next; playUi('ui_move');
  }

  return {
    freezes: true,
    opaque: true,
    enter() { time = 0; },
    exit() {},
    update(_, realDt) {
      time += realDt;
      const m = states.mouse;
      if (m.moved) for (let i = 0; i < rects.length; i++) if (hit(rects[i], m.x, m.y) && sel !== i) { sel = i; playUi('ui_move'); }
      if (m.clicked) {
        const i = rects.findIndex((r) => hit(r, m.x, m.y));
        if (i >= 0) { sel = i; open(); }
        else if (m.y < 20 || m.y > H - 16) { playUi('ui_cancel'); states.pop(); }
      }
    },
    handleAction(a) {
      if (a === 'menuLeft') move(-1); else if (a === 'menuRight') move(1);
      else if (a === 'menuUp') move(-COLS); else if (a === 'menuDown') move(COLS);
      else if (a === 'confirm') open();
      else if (a === 'cancel' || a === 'pause') { playUi('ui_cancel'); states.pop(); }
      else return false;
      return true;
    },
    render(ui) {
      backdrop(ui, W, H, states.rampOf('altar'));
      panel(ui, 6, 6, W - 12, H - 12, 'parchment');
      heading(ui, t('ui.altar.title'), W / 2, 8, 16);
      const ids = leafIds();
      const found = ids.filter(isUnlocked).length;
      text(ui, t('ui.altar.found', { found, total: ids.length }), W - 18, 12, { size: 9, align: 'right', color: C.encreClaire });
      renderLeafGrid(ui, GX, GY, COLS, CELL_W, CELL_H, sel, time, rects);
      const id = ids[sel];
      const y = GY + 3 * CELL_H + 6;
      if (isUnlocked(id)) {
        heading(ui, t('lore.' + id + '.title'), W / 2, y, 13);
        text(ui, t(isRead(id) ? 'ui.altar.read' : 'ui.altar.unread'), W / 2, y + 20, { size: 9, align: 'center', color: isRead(id) ? C.encreClaire : C.braise });
        paragraph(ui, t('lore.' + id + '.text'), 24, y + 32, W - 48, { size: 8, color: C.encre, lineHeight: 9, maxLines: 4 });
      } else {
        heading(ui, t('ui.altar.leaf_number', { n: sel + 1 }), W / 2, y, 13);
        text(ui, t('ui.altar.locked'), W / 2, y + 22, { size: 9, align: 'center', color: C.encreClaire });
      }
      text(ui, t('ui.altar.hint'), W / 2, H - 26, { size: 8, align: 'center', color: C.encreClaire });
    },
  };
}
