// ui/dialog.js — dialogue de confirmation (jamais window.confirm) : écran
// empilable 'confirm' figeant le jeu. enter({ text, onYes, onNo, yes, no }).

import { playUi } from '../audio/sfx.js';
import { t } from './i18n.js';
import * as states from './states.js';
import { panel, text, paragraph, dimmer, createMenu, heading, C } from './widgets.js';

const W = 480, H = 270;

export function createConfirm() {
  let params = { text: '', onYes: null, onNo: null, yes: null, no: null };
  const PW = 260, PH = 96, PX = (W - PW) / 2, PY = (H - PH) / 2;
  const items = [
    { label: () => params.no || t('ui.common.no'), rect: { x: PX + 30, y: PY + PH - 32, w: 90, h: 20 }, action: () => finish(false) },
    { label: () => params.yes || t('ui.common.yes'), rect: { x: PX + PW - 120, y: PY + PH - 32, w: 90, h: 20 }, action: () => finish(true) },
  ];
  const menu = createMenu(items);

  function finish(yes) {
    playUi(yes ? 'ui_confirm' : 'ui_cancel');
    states.pop();
    if (yes && params.onYes) params.onYes(); else if (!yes && params.onNo) params.onNo();
  }

  return {
    freezes: true,
    enter(p) { params = p; menu.index = 0; },
    exit() {},
    update() {
      const m = states.mouse;
      if (m.moved && menu.hover(m.x, m.y)) playUi('ui_move');
      if (m.clicked) { const it = menu.at(m.x, m.y); if (it) it.action(); }
    },
    handleAction(a) {
      if (a === 'menuLeft' || a === 'menuUp') { if (menu.move(-1)) playUi('ui_move'); return true; }
      if (a === 'menuRight' || a === 'menuDown') { if (menu.move(1)) playUi('ui_move'); return true; }
      if (a === 'confirm') { menu.current().action(); return true; }
      if (a === 'cancel' || a === 'pause') { finish(false); return true; }
      return false;
    },
    render(ui) {
      dimmer(ui, W, H, 0.55, states.rampOf('confirm'));
      panel(ui, PX, PY, PW, PH, 'parchment');
      heading(ui, t('ui.confirm.title'), W / 2, PY + 6, 16);
      paragraph(ui, params.text || '', PX + 14, PY + 30, PW - 28, { size: 10, color: C.encre, lineHeight: 11, maxLines: 3 });
      menu.render(ui);
    },
  };
}
