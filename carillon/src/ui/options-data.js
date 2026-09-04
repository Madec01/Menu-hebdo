// ui/options-data.js — sous-écrans de l'écran d'options : remappage (capture
// de la prochaine touche/bouton via input.beginCapture), export/import de la
// sauvegarde (zone de texte DOM) et remise à zéro avec confirmation.

import { bus } from '../core/events.js';
import { getSave, commit, exportSave, importSave, resetSave } from '../core/save.js';
import * as input from '../core/input.js';
import { playUi } from '../audio/sfx.js';
import { t } from './i18n.js';
import * as states from './states.js';
import { showTextarea, hideDom, domValue, copyText } from './dom.js';
import { toast } from './toasts.js';
import { panel, text, button, hit, backdrop, heading, C } from './widgets.js';

const W = 480, H = 270;
const AREA = { x: 40, y: 30, w: 400, h: 210 };
const TA = { x: AREA.x + 12, y: AREA.y + 34, w: AREA.w - 24, h: AREA.h - 76 };

/** Persiste les liaisons courantes et les annonce. */
function saveBindings() {
  const s = getSave();
  s.options.bindings = input.getBindings();
  commit();
  bus.emit('options:change', { key: 'bindings', value: s.options.bindings });
}

/** Réapplique toutes les options après un import (main.js écoute options:change). */
function announceAll() {
  const o = getSave().options;
  for (const k of Object.keys(o)) bus.emit('options:change', { key: k, value: o[k] });
  input.applyBindings(o.bindings);
}

/** État de capture partagé avec options.js : { action } ou null. */
export const capture = { action: null };

export function beginCapture(action) {
  if (capture.action) return;
  capture.action = action;
  playUi('ui_confirm');
  input.beginCapture(action, (res) => {
    capture.action = null;
    if (res) { saveBindings(); playUi('ui_confirm'); } else playUi('ui_cancel');
  });
}

export function resetBindings() {
  input.resetBindings();
  saveBindings();
  playUi('ui_confirm');
  toast({ title: t('ui.options.bindings'), body: t('ui.options.bindings_reset'), icon: 'ui_options' });
}

export function confirmReset() {
  playUi('ui_confirm');
  states.push('confirm', {
    text: t('ui.options.confirm_reset'),
    onYes() { resetSave(); toast({ title: t('ui.options.title'), body: t('ui.options.reset_done'), icon: 'ui_sceau' }); },
  });
}

/** Écran 'savetext' : zone de texte DOM pour exporter (lecture seule) ou importer. enter({ mode }). */
export function createSaveText() {
  let mode = 'export';
  const closeRect = { x: AREA.x + AREA.w - 100, y: AREA.y + AREA.h - 30, w: 88, h: 20 };
  const mainRect = { x: AREA.x + 12, y: AREA.y + AREA.h - 30, w: 120, h: 20 };

  function close() { hideDom(); playUi('ui_cancel'); states.pop(); }
  async function primary() {
    if (mode === 'export') {
      const ok = await copyText(exportSave());
      toast({ title: t('ui.options.export'), body: t(ok ? 'ui.common.copied' : 'ui.common.copy_failed'), icon: 'ui_sceau' });
      return;
    }
    const res = importSave(domValue());
    if (res.ok) { announceAll(); playUi('ui_confirm'); toast({ title: t('ui.options.import'), body: t('ui.options.import_ok'), icon: 'ui_sceau' }); hideDom(); states.pop(); }
    else { playUi('ui_cancel'); toast({ title: t('ui.options.import'), body: t('ui.options.import_error_' + res.error), icon: 'ui_mort' }); }
  }

  return {
    freezes: true,
    opaque: true,
    enter(p) {
      mode = p.mode || 'export';
      showTextarea({
        ...TA, value: mode === 'export' ? exportSave() : '', readOnly: mode === 'export',
        placeholder: mode === 'import' ? t('ui.options.textarea_import_hint') : '', onEscape: close,
      });
    },
    exit() { hideDom(); },
    update() {
      const m = states.mouse;
      if (!m.clicked) return;
      if (hit(closeRect, m.x, m.y)) close();
      else if (hit(mainRect, m.x, m.y)) primary();
    },
    handleAction(a) {
      if (a === 'cancel' || a === 'pause') { close(); return true; }
      if (a === 'confirm') { primary(); return true; }
      return false;
    },
    render(ui) {
      backdrop(ui, W, H, states.rampOf('savetext'));
      panel(ui, AREA.x, AREA.y, AREA.w, AREA.h, 'parchment');
      heading(ui, t(mode === 'export' ? 'ui.options.export' : 'ui.options.import'), W / 2, AREA.y + 6, 15);
      text(ui, t(mode === 'export' ? 'ui.options.textarea_export_hint' : 'ui.options.textarea_import_hint'), W / 2, AREA.y + 24, { size: 8, align: 'center', color: C.encreClaire });
      button(ui, { ...mainRect, label: t(mode === 'export' ? 'ui.options.textarea_copy' : 'ui.options.textarea_apply'), size: 10, focused: true });
      button(ui, { ...closeRect, label: t('ui.options.textarea_close'), size: 10 });
    },
  };
}
