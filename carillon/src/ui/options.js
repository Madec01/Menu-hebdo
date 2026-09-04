// ui/options.js — écran d'options empilable au-dessus de n'importe quel état :
// volumes, langue, secousses, particules, flashs, plein écran, échelle, ips,
// indicateur de rythme, Mesure assistée / Sans rythme, remappage complet
// (clavier + manette), export/import/reset de la sauvegarde. Liste défilante ;
// ↑↓ choisir, ◄► régler, Entrée activer, Échap retour.

import { playUi } from '../audio/sfx.js';
import { t } from './i18n.js';
import * as states from './states.js';
import { buildItems } from './options-items.js';
import { capture, beginCapture, resetBindings, confirmReset } from './options-data.js';
import { panel, text, hit, backdrop, heading, C } from './widgets.js';

const W = 480, H = 270;
const LIST = { x: 20, y: 28, w: 440, h: 206, rowH: 13 };

export function createOptions() {
  const items = buildItems({
    capture: beginCapture,
    resetBindings,
    exportSave: () => { playUi('ui_confirm'); states.push('savetext', { mode: 'export' }); },
    importSave: () => { playUi('ui_confirm'); states.push('savetext', { mode: 'import' }); },
    resetSave: confirmReset,
  });
  let sel = firstSelectable(0, 1), scroll = 0;
  const visibleRows = Math.floor((LIST.h - 10) / LIST.rowH);

  function firstSelectable(from, d) {
    let i = from;
    for (let n = 0; n < items.length; n++) {
      i = (i + items.length) % items.length;
      if (items[i].type !== 'section' && items[i].type !== 'info') return i;
      i += d;
    }
    return 0;
  }
  function move(d) {
    sel = firstSelectable(sel + d, d);
    if (sel < scroll) scroll = sel; else if (sel >= scroll + visibleRows) scroll = sel - visibleRows + 1;
    if (sel <= 1) scroll = 0;
    playUi('ui_move');
  }
  function adjust(d) {
    const it = items[sel];
    if (!it.adjust) return;
    if (it.type === 'slider' || it.type === 'choice') { it.adjust(d); playUi('ui_move'); }
  }
  function activate() {
    const it = items[sel];
    if (!it.adjust) return;
    if (it.type === 'slider') { it.adjust(1); playUi('ui_move'); }
    else if (it.type === 'choice' || it.type === 'toggle') { it.adjust(1); playUi('ui_confirm'); }
    else it.adjust();
  }
  function rowRect(i) { return { x: LIST.x, y: LIST.y + 5 + (i - scroll) * LIST.rowH, w: LIST.w, h: LIST.rowH }; }

  return {
    freezes: true,
    opaque: true,
    enter() { sel = firstSelectable(0, 1); scroll = 0; playUi('ui_confirm'); },
    exit() {},
    update() {
      if (capture.action) return;
      const m = states.mouse;
      const end = Math.min(items.length, scroll + visibleRows);
      if (m.moved) for (let i = scroll; i < end; i++) {
        if (items[i].type !== 'section' && items[i].type !== 'info' && hit(rowRect(i), m.x, m.y) && sel !== i) { sel = i; playUi('ui_move'); }
      }
      if (m.clicked) {
        for (let i = scroll; i < end; i++) {
          if (!hit(rowRect(i), m.x, m.y) || items[i].type === 'section' || items[i].type === 'info') continue;
          sel = i;
          if (items[i].type === 'slider' || items[i].type === 'choice') adjust(m.x < LIST.x + LIST.w * 0.72 ? -1 : 1); else activate();
          return;
        }
        if (m.y < LIST.y || m.y > LIST.y + LIST.h) { playUi('ui_cancel'); states.pop(); }
      }
    },
    handleAction(a) {
      if (capture.action) return true;
      if (a === 'menuUp') move(-1); else if (a === 'menuDown') move(1);
      else if (a === 'menuLeft') adjust(-1); else if (a === 'menuRight') adjust(1);
      else if (a === 'confirm') activate();
      else if (a === 'cancel' || a === 'pause') { playUi('ui_cancel'); states.pop(); }
      else return false;
      return true;
    },
    render(ui) {
      backdrop(ui, W, H, states.rampOf('options'));
      panel(ui, 6, 4, W - 12, H - 8, 'parchment');
      heading(ui, t('ui.options.title'), W / 2, 6, 16);
      panel(ui, LIST.x, LIST.y, LIST.w, LIST.h, 'dark');
      const end = Math.min(items.length, scroll + visibleRows);
      for (let i = scroll; i < end; i++) {
        const it = items[i], r = rowRect(i), focused = i === sel;
        if (it.type === 'section') { text(ui, it.label(), r.x + 8, r.y + 1, { kind: 'display', size: 11, color: C.bronze }); continue; }
        if (focused) { ui.globalAlpha = 0.22; ui.fillStyle = C.bronze; ui.fillRect(r.x + 4, r.y, r.w - 8, r.h); ui.globalAlpha = 1; }
        text(ui, it.label(), r.x + 14, r.y + 2, { size: 9, color: focused ? C.clair : C.os });
        let val = capture.action && it.type === 'binding' && it.action === capture.action ? t('ui.options.press_key') : it.value();
        if (focused && (it.type === 'slider' || it.type === 'choice')) val = '◄ ' + val + ' ►';
        text(ui, val, r.x + r.w - 14, r.y + 2, { size: 9, align: 'right', color: focused ? C.bronze : C.os, maxWidth: r.w * 0.5 });
      }
      if (items.length > visibleRows) {
        const trackH = LIST.h - 10, knob = Math.max(8, trackH * visibleRows / items.length);
        ui.fillStyle = C.bronze; ui.fillRect(LIST.x + LIST.w - 6, LIST.y + 5 + (trackH - knob) * (scroll / (items.length - visibleRows)), 2, knob);
      }
      const it = items[sel];
      const note = it && it.note ? it.note() : t('ui.options.hint');
      text(ui, note, W / 2, H - 27, { size: 8, align: 'center', color: C.encreClaire });
    },
  };
}
