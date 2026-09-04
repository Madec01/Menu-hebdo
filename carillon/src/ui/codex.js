// ui/codex.js — codex empilable : onglets Bestiaire / Timbres / Accords /
// Fusions / Reliques / Feuillets / Hauts-faits. Liste défilante à gauche, détail à
// droite (codex-pages.js) ; les Feuillets s'ouvrent dans le lecteur (lore.js).
// ◄► onglet, ↑↓ entrée, Entrée lire, Échap retour.

import { playUi } from '../audio/sfx.js';
import { t } from './i18n.js';
import * as states from './states.js';
import { TABS, pageItems, pageProgress, renderDetail } from './codex-pages.js';
import { leafIds, isUnlocked, renderLeafGrid } from './lore.js';
import { panel, text, paragraph, icon, hit, backdrop, heading, C } from './widgets.js';

const W = 480, H = 270;
const TAB_Y = 24, TAB_H = 16;
const LIST = { x: 10, y: 46, w: 170, h: 194, rowH: 14 };
const DETAIL = { x: 188, y: 46, w: 282, h: 194 };
const LEAF_GRID = { x: 22, y: 50, cols: 8, cellW: 56, cellH: 40 };

export function createCodex() {
  let tab = 0, sel = 0, scroll = 0, time = 0, items = [];
  const tabRects = [];
  const leafRects = [];
  const tabId = () => TABS[tab];
  const visibleRows = Math.floor((LIST.h - 8) / LIST.rowH);

  function refresh() { items = tabId() === 'leaves' ? [] : pageItems(tabId()); if (sel >= Math.max(items.length, 1)) sel = 0; scroll = 0; }
  function setTab(i) { tab = (i + TABS.length) % TABS.length; sel = 0; refresh(); playUi('ui_move'); }
  function count() { return tabId() === 'leaves' ? leafIds().length : items.length; }
  function move(d) {
    const n = count(); if (!n) return;
    sel = Math.max(0, Math.min(n - 1, sel + d));
    if (sel < scroll) scroll = sel; else if (sel >= scroll + visibleRows) scroll = sel - visibleRows + 1;
    playUi('ui_move');
  }
  function confirm() {
    if (tabId() !== 'leaves') return;
    const id = leafIds()[sel];
    if (!isUnlocked(id)) { playUi('ui_cancel'); return; }
    playUi('ui_confirm'); states.push('leaf', { leafId: id });
  }

  function renderTabs(ui) {
    tabRects.length = 0;
    let x = 10;
    for (let i = 0; i < TABS.length; i++) {
      const label = t('ui.codex.tab_' + TABS[i]);
      const w = Math.round(W / TABS.length) - 4;
      const r = { x, y: TAB_Y, w, h: TAB_H };
      tabRects.push(r);
      panel(ui, r.x, r.y, r.w, r.h, i === tab ? 'bronze' : 'dark');
      text(ui, label, r.x + r.w / 2, r.y + r.h / 2, { size: 9, align: 'center', baseline: 'middle', color: i === tab ? C.clair : C.os, maxWidth: r.w - 6 });
      x += w + 4;
    }
  }

  function renderList(ui) {
    panel(ui, LIST.x, LIST.y, LIST.w, LIST.h, 'dark');
    const end = Math.min(items.length, scroll + visibleRows);
    for (let i = scroll; i < end; i++) {
      const it = items[i], y = LIST.y + 5 + (i - scroll) * LIST.rowH;
      if (i === sel) { ui.globalAlpha = 0.25; ui.fillStyle = C.bronze; ui.fillRect(LIST.x + 4, y - 1, LIST.w - 8, LIST.rowH); ui.globalAlpha = 1; }
      if (it.icon) icon(ui, it.icon, LIST.x + 6, y - 1, 0.4);
      text(ui, it.label, LIST.x + 22, y + 1, { size: 9, color: it.known ? (i === sel ? C.clair : C.os) : C.gris, maxWidth: LIST.w - 30 });
    }
    if (items.length > visibleRows) {
      const trackH = LIST.h - 10, knob = Math.max(8, trackH * visibleRows / items.length);
      ui.fillStyle = C.bronze; ui.fillRect(LIST.x + LIST.w - 6, LIST.y + 5 + (trackH - knob) * (scroll / (items.length - visibleRows)), 2, knob);
    }
  }

  return {
    freezes: true,
    opaque: true,
    enter(p) { tab = p && p.tab ? Math.max(0, TABS.indexOf(p.tab)) : 0; sel = 0; time = 0; refresh(); },
    exit() {},
    update(_, realDt) {
      time += realDt;
      const m = states.mouse;
      if (m.moved) {
        if (tabId() === 'leaves') { for (let i = 0; i < leafRects.length; i++) if (hit(leafRects[i], m.x, m.y) && sel !== i) { sel = i; playUi('ui_move'); } }
        else for (let i = scroll; i < Math.min(items.length, scroll + visibleRows); i++) {
          if (hit({ x: LIST.x, y: LIST.y + 5 + (i - scroll) * LIST.rowH, w: LIST.w, h: LIST.rowH }, m.x, m.y) && sel !== i) { sel = i; playUi('ui_move'); }
        }
      }
      if (m.clicked) {
        for (let i = 0; i < tabRects.length; i++) if (hit(tabRects[i], m.x, m.y)) { setTab(i); return; }
        if (tabId() === 'leaves') { const i = leafRects.findIndex((r) => hit(r, m.x, m.y)); if (i >= 0) { sel = i; confirm(); return; } }
        if (m.y < TAB_Y) { playUi('ui_cancel'); states.pop(); }
      }
    },
    handleAction(a) {
      if (a === 'menuLeft') { if (tabId() === 'leaves') move(-1); else setTab(tab - 1); return true; }
      if (a === 'menuRight') { if (tabId() === 'leaves') move(1); else setTab(tab + 1); return true; }
      if (a === 'menuUp') { move(tabId() === 'leaves' ? -LEAF_GRID.cols : -1); return true; }
      if (a === 'menuDown') { move(tabId() === 'leaves' ? LEAF_GRID.cols : 1); return true; }
      if (a === 'confirm') { confirm(); return true; }
      if (a === 'cancel' || a === 'pause') { playUi('ui_cancel'); states.pop(); return true; }
      return false;
    },
    render(ui) {
      backdrop(ui, W, H, states.rampOf('codex'));
      panel(ui, 4, 4, W - 8, H - 8, 'parchment');
      heading(ui, t('ui.codex.title'), 56, 7, 16);
      const pr = tabId() === 'leaves' ? { done: leafIds().filter(isUnlocked).length, total: leafIds().length } : pageProgress(tabId());
      text(ui, t('ui.codex.progress', pr), W - 16, 11, { size: 9, align: 'right', color: C.encreClaire });
      paragraph(ui, t('codex.intro'), 108, 9, W - 108 - 60, { size: 7, color: C.encreClaire, lineHeight: 8, maxLines: 2 });
      renderTabs(ui);
      if (tabId() === 'leaves') {
        renderLeafGrid(ui, LEAF_GRID.x, LEAF_GRID.y, LEAF_GRID.cols, LEAF_GRID.cellW, LEAF_GRID.cellH, sel, time, leafRects);
        const id = leafIds()[sel];
        const y = LEAF_GRID.y + 3 * LEAF_GRID.cellH + 4;
        heading(ui, isUnlocked(id) ? t('lore.' + id + '.title') : t('ui.altar.leaf_number', { n: sel + 1 }), W / 2, y, 13);
        paragraph(ui, isUnlocked(id) ? t('lore.' + id + '.text') : t('ui.altar.locked'), 24, y + 20, W - 48, { size: 8, color: C.encre, lineHeight: 9, maxLines: 4 });
      } else {
        renderList(ui);
        panel(ui, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h, 'parchment');
        renderDetail(ui, tabId(), items[sel], DETAIL, time);
      }
      text(ui, t('ui.codex.hint'), W / 2, H - 26, { size: 8, align: 'center', color: C.encreClaire });
    },
  };
}
