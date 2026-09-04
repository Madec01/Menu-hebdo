// ui/relic-pick.js — écran de Reliques de paroisse (§ 11 bis) : deux cartes de missel
// retournées (style levelup) et un bouton « Aucune relique ». Posé par run-screen.js après le
// tutoriel (ou dès le départ), avant la première vague ; fige la logique. Le choix va à
// deps.game.pickRelic(id | null) (game/relics.js émet relic:pick). Échap = aucune.
// enter({ choices: [relicId, relicId] }).

import { playUi, play as playSfx } from '../audio/sfx.js';
import { hasGamepad } from '../core/input.js';
import { t } from './i18n.js';
import { def as dataDef } from './gamedata.js';
import * as states from './states.js';
import { card, text, button, dimmer, hit, heading, C } from './widgets.js';

const W = 480, H = 270;
const CARD_W = 96, CARD_H = 128, GAP = 40, CARD_Y = 70, FLIP_SEC = 0.35, STAGGER = 0.25;

export function createRelicPick(deps) {
  let choices = [], sel = 0, time = 0, flips = [0, 0], chosen = false;
  const noneRect = { x: W / 2 - 60, y: CARD_Y + CARD_H + 12, w: 120, h: 20 };
  const cardX = (i) => Math.round(W / 2 - (2 * CARD_W + GAP) / 2 + i * (CARD_W + GAP));
  const cardRect = (i) => ({ x: cardX(i), y: CARD_Y, w: CARD_W, h: CARD_H });
  const allFlipped = () => flips.every((f) => f >= 1);
  const count = () => choices.length + 1;   // + « Aucune »

  function finish(id) {
    if (chosen) return;
    chosen = true;
    if (deps.game && deps.game.pickRelic) deps.game.pickRelic(id);
    playUi(id ? 'ui_confirm' : 'ui_cancel');
    if (id) playSfx('card_pick');
    states.pop();
  }

  function choose(i) {
    if (!allFlipped()) return;
    if (i >= choices.length) { finish(null); return; }
    if (choices[i]) finish(choices[i]);
  }

  return {
    freezes: true,
    enter(p) {
      choices = (p && p.choices ? p.choices : []).filter((id) => !!dataDef('relics', id)).slice(0, 2);
      sel = 0; chosen = false; time = 0; flips = choices.map(() => 0);
      if (!choices.length) { finish(null); return; }
    },
    exit() {},
    update(_, realDt) {
      if (chosen) return;
      const prev = time;
      time += realDt;
      for (let i = 0; i < choices.length; i++) {
        const t0 = i * STAGGER;
        if (time >= t0 && flips[i] < 1) {
          if (prev < t0) playSfx('card_flip', { volume: 0.8 });
          flips[i] = Math.min(1, (time - t0) / FLIP_SEC);
        }
      }
      const m = states.mouse;
      if (m.moved) {
        for (let i = 0; i < choices.length; i++) if (hit(cardRect(i), m.x, m.y) && sel !== i) { sel = i; playUi('ui_move'); }
        if (hit(noneRect, m.x, m.y) && sel !== choices.length) { sel = choices.length; playUi('ui_move'); }
      }
      if (m.clicked) {
        for (let i = 0; i < choices.length; i++) if (hit(cardRect(i), m.x, m.y)) { sel = i; choose(i); return; }
        if (hit(noneRect, m.x, m.y)) { sel = choices.length; choose(sel); }
      }
    },
    handleAction(a) {
      if (a === 'menuLeft' || a === 'menuUp') { sel = (sel + count() - 1) % count(); playUi('ui_move'); return true; }
      if (a === 'menuRight' || a === 'menuDown') { sel = (sel + 1) % count(); playUi('ui_move'); return true; }
      if (a === 'confirm') { choose(sel); return true; }
      if (a === 'cancel') { if (allFlipped()) finish(null); return true; }
      return false;
    },
    render(ui) {
      dimmer(ui, W, H, 0.7, states.rampOf('relicpick'));
      ui.globalAlpha = 0.75; ui.fillStyle = C.suie; ui.fillRect(W / 2 - 130, 26, 260, 40); ui.globalAlpha = 1;
      heading(ui, t('ui.relic.title'), W / 2, 28, 20);
      text(ui, t('ui.relic.subtitle'), W / 2, 53, { size: 9, align: 'center', color: C.os, shadow: true });
      for (let i = 0; i < choices.length; i++) {
        const d = dataDef('relics', choices[i]);
        if (!d) continue;
        const lift = i === sel && flips[i] >= 1 ? -6 : 0;
        card(ui, cardX(i), CARD_Y + lift, { flip: flips[i], focused: i === sel, icon: d.icon, kind: t('ui.relic.kind'), title: t(d.name), level: '', isNew: false, desc: t(d.desc) });
      }
      button(ui, { ...noneRect, label: t('ui.relic.none'), size: 9, focused: sel === choices.length, icon: 'ui_mort' });
      text(ui, t(hasGamepad() ? 'ui.relic.hint_pad' : 'ui.relic.hint'), W / 2, H - 22, { size: 8, align: 'center', color: C.gris, shadow: true });
    },
  };
}
