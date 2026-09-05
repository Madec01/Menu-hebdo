// ui/vigil.js — « Veiller encore » (vague 2) : écran empilable 'vigil' posé par run-screen.js quand
// l'aube est sonnée (holdVictory : game/game.js n'enchaîne pas sur le bilan). Deux choix : voir le bilan
// (deps.game.finishVictory) ou continuer la nuit sans fin (deps.game.startVigil : la Sourdine monte toutes
// les 45 s, score = temps tenu après l'aube, record par paroisse, la mort garde la victoire). Le récapitulatif
// rappelle le temps, le niveau, le record de veillée de la paroisse. Échap = bilan.

import { getSave } from '../core/save.js';
import { playUi } from '../audio/sfx.js';
import { t, fmtTime } from './i18n.js';
import * as states from './states.js';
import { panel, text, paragraph, dimmer, createMenu, heading, C } from './widgets.js';
import { VIGIL_STEP_SEC } from '../game/night-rules.js';

const W = 480, H = 270;

export function createVigil(deps) {
  const PW = 300, PH = 128, PX = (W - PW) / 2, PY = (H - PH) / 2;
  let parishId = '';
  const items = [
    { label: () => t('ui.vigil.results'), rect: { x: PX + 18, y: PY + PH - 32, w: 124, h: 20 }, action: () => finish(false), icon: 'ui_lanterne' },
    { label: () => t('ui.vigil.continue'), rect: { x: PX + PW - 142, y: PY + PH - 32, w: 124, h: 20 }, action: () => finish(true), icon: 'ui_coeur' },
  ];
  const menu = createMenu(items, { size: 10 });

  function finish(vigil) {
    playUi(vigil ? 'ui_confirm' : 'ui_cancel');
    states.pop();
    if (!deps.game) return;
    if (vigil && deps.game.startVigil && deps.game.startVigil()) return;
    if (deps.game.finishVictory) deps.game.finishVictory();
  }

  return {
    freezes: true,
    enter(p) { parishId = (p && p.parishId) || ''; menu.index = 1; },
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
      dimmer(ui, W, H, 0.5, states.rampOf('vigil'));
      panel(ui, PX, PY, PW, PH, 'parchment');
      heading(ui, t('ui.results.victory'), W / 2, PY + 6, 16);
      const g = deps.game ? deps.game.gameState() : null;
      const time = g && g.run ? fmtTime(g.run.timeSec) : '';
      const s = getSave();
      const best = s.records && s.records.vigil ? s.records.vigil[parishId] || 0 : 0;
      paragraph(ui, t('ui.vigil.text', { step: VIGIL_STEP_SEC }), PX + 14, PY + 30, PW - 28, { size: 9, color: C.encre, lineHeight: 10, maxLines: 3 });
      text(ui, t('ui.vigil.record', { time: best > 0 ? fmtTime(best) : t('ui.pause.empty') }) + ' · ' + t('ui.pause.time', { time }), W / 2, PY + 66, { size: 8, align: 'center', color: C.encreClaire });
      menu.render(ui);
    },
  };
}
