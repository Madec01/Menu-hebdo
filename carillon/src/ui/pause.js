// ui/pause.js — pause (timeScale 0 via freezes) : reprendre, options, build
// courant (Timbres, Accords, dégâts par arme), abandonner avec dialogue de
// confirmation. Échap / pause reprend.

import { hasGamepad } from '../core/input.js';
import { playUi } from '../audio/sfx.js';
import { t, fmtTime } from './i18n.js';
import * as states from './states.js';
import { panel, text, icon, createMenu, dimmer, heading, pips, C } from './widgets.js';

const W = 480, H = 270;

export function createPause(deps) {
  let showBuild = false;
  const PX = 20, PY = 24, PW = 150, PH = 222;
  const rect = (i) => ({ x: PX + 15, y: PY + 46 + i * 26, w: PW - 30, h: 20 });
  const items = [
    { label: () => t('ui.pause.resume'), rect: rect(0), action: resume, icon: 'ui_coeur' },
    { label: () => t('ui.pause.build'), rect: rect(1), action: () => { showBuild = !showBuild; playUi('ui_confirm'); }, icon: 'ui_sceau' },
    { label: () => t('ui.pause.options'), rect: rect(2), action: () => { playUi('ui_confirm'); states.push('options'); }, icon: 'ui_options' },
    { label: () => t('ui.pause.abandon'), rect: rect(3), action: abandon, icon: 'ui_mort' },
  ];
  const menu = createMenu(items, { size: 10 });

  function resume() { playUi('ui_cancel'); states.pop(); }

  function abandon() {
    playUi('ui_confirm');
    states.push('confirm', {
      text: t('ui.pause.confirm_abandon'),
      onYes() {
        const g = deps.game ? deps.game.gameState() : null;
        states.pop(); // retire la pause ; run:end enchaînera sur le bilan
        if (deps.game && deps.game.abandonGame) deps.game.abandonGame();
        else if (g && g.run && deps.gameExtra) deps.gameExtra.finishRun(g.run, false);
      },
    });
  }

  function renderBuild(ui) {
    const g = deps.game ? deps.game.gameState() : null;
    if (!g || !g.player) return;
    const BX = PX + PW + 12, BY = PY, BW = W - BX - 20, BH = PH;
    panel(ui, BX, BY, BW, BH, 'parchment');
    heading(ui, t('ui.pause.build_title'), BX + BW / 2, BY + 6, 14);
    const dps = deps.gameExtra ? deps.gameExtra.dpsReport() : {};
    let y = BY + 32;
    text(ui, t('ui.pause.weapons'), BX + 12, y, { size: 9, color: C.encreClaire }); y += 11;
    for (const w of g.player.weapons) {
      icon(ui, w.def && w.def.icon ? w.def.icon : w.id, BX + 12, y - 2, 0.5);
      text(ui, t(w.def ? w.def.name : 'weapon.' + w.id + '.name'), BX + 32, y + 2, { size: 9, color: C.encre });
      pips(ui, BX + 120, y + 5, w.level, w.def && w.def.maxLevel ? w.def.maxLevel : 7);
      text(ui, t('ui.pause.damage', { value: Math.round(dps[w.id] || 0) }), BX + BW - 12, y + 2, { size: 8, align: 'right', color: C.encreClaire });
      y += 15;
    }
    if (!g.player.weapons.length) { text(ui, t('ui.pause.empty'), BX + 32, y, { size: 9, color: C.encre }); y += 15; }
    y += 4;
    text(ui, t('ui.pause.passives'), BX + 12, y, { size: 9, color: C.encreClaire }); y += 11;
    for (const pa of g.player.passives) {
      icon(ui, pa.def && pa.def.icon ? pa.def.icon : pa.id, BX + 12, y - 2, 0.5);
      text(ui, t(pa.def ? pa.def.name : 'passive.' + pa.id + '.name'), BX + 32, y + 2, { size: 9, color: C.encre });
      pips(ui, BX + 120, y + 5, pa.level, pa.def && pa.def.maxLevel ? pa.def.maxLevel : 5);
      y += 15;
    }
    if (!g.player.passives.length) text(ui, t('ui.pause.empty'), BX + 32, y, { size: 9, color: C.encre });
  }

  return {
    freezes: true,
    enter() { menu.index = 0; playUi('ui_confirm'); },
    exit() {},
    update() {
      const m = states.mouse;
      if (m.moved && menu.hover(m.x, m.y)) playUi('ui_move');
      if (m.clicked) { const it = menu.at(m.x, m.y); if (it) it.action(); }
    },
    handleAction(a) {
      if (a === 'menuUp') { if (menu.move(-1)) playUi('ui_move'); return true; }
      if (a === 'menuDown') { if (menu.move(1)) playUi('ui_move'); return true; }
      if (a === 'confirm') { menu.current().action(); return true; }
      if (a === 'cancel' || a === 'pause') { resume(); return true; }
      return false;
    },
    render(ui) {
      dimmer(ui, W, H, 0.6, states.rampOf('pause'));
      panel(ui, PX, PY, PW, PH, 'parchment');
      heading(ui, t('ui.pause.title'), PX + PW / 2, PY + 8, 18);
      menu.render(ui);
      const g = deps.game ? deps.game.gameState() : null;
      if (g && g.run) {
        text(ui, t('ui.pause.time', { time: fmtTime(g.run.timeSec) }), PX + PW / 2, PY + PH - 56, { size: 9, align: 'center', color: C.encreClaire });
        text(ui, t('ui.pause.parish', { parish: t('parish.' + g.run.parishId + '.name'), character: t('char.' + g.run.characterId + '.name') }), PX + PW / 2, PY + PH - 44, { size: 8, align: 'center', color: C.encreClaire });
      }
      if (showBuild) renderBuild(ui);
      text(ui, t(hasGamepad() ? 'ui.common.nav_hint_pad' : 'ui.common.nav_hint'), PX + PW / 2, PY + PH - 24, { size: 7, align: 'center', color: C.encreClaire });
    },
  };
}
