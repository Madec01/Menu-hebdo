// ui/levelup.js — écran de cartes de missel : 3 cartes retournées une à une
// (card_flip), choix au clavier / à la souris / à la manette, description via
// t(desc, params), relance si l'amélioration « Troisième carte » le permet.
// Fige la logique (freezes) ; la musique continue. enter({ level, choices }).

import { bus } from '../core/events.js';
import { playUi, play as playSfx } from '../audio/sfx.js';
import { hasGamepad } from '../core/input.js';
import { t } from './i18n.js';
import { def as dataDef } from './gamedata.js';
import * as states from './states.js';
import { isActive as touchActive } from './touch.js';
import { card, text, button, dimmer, hit, heading, C } from './widgets.js';

const W = 480, H = 270;
const CARD_W = 96, GAP = 24, CARD_Y = 76, FLIP_SEC = 0.35, STAGGER = 0.22;
const KIND_KEY = { weapon: 'ui.levelup.weapon', passive: 'ui.levelup.passive', fusion: 'ui.levelup.fusion', bonus: 'ui.levelup.bonus' };

export function createLevelUp(deps) {
  let level = 1, choices = [], sel = 1, time = 0, flips = [0, 0, 0], chosen = false;
  const rerollRect = { x: W / 2 - 50, y: CARD_Y + 128 + 8, w: 100, h: 18 };
  const cardX = (i) => Math.round(W / 2 - (3 * CARD_W + 2 * GAP) / 2 + i * (CARD_W + GAP));
  const rerolls = () => { const g = deps.game ? deps.game.gameState() : null; return g && g.run ? g.run.rerolls : 0; };
  const allFlipped = () => flips.every((f) => f >= 1);

  function startFlips() { flips = [0, 0, 0]; time = 0; }

  function choose(i) {
    if (chosen || !allFlipped() || !choices[i]) return;
    chosen = true;
    playUi('ui_confirm');
    bus.emit('level:choice', { card: choices[i] });
    states.pop();
  }

  function reroll() {
    if (rerolls() <= 0 || !allFlipped() || !deps.game || !deps.game.rerollLevelUp) { playUi('ui_cancel'); return; }
    const next = deps.game.rerollLevelUp();
    if (!next) { playUi('ui_cancel'); return; }
    choices = next;
    startFlips();
  }

  /** Paramètres de la description : ceux de la carte + bonus de marque (Diapason) lu dans les données. */
  function cardParams(c) {
    const p = Object.assign({}, c.params || {});
    const d = dataDef(c.type === 'fusion' ? 'fusions' : 'weapons', c.id);
    if (d && d.base && d.base.markBonus !== undefined) p.bonus = Math.round(d.base.markBonus * 100);
    return p;
  }

  return {
    freezes: true,
    enter(p) {
      level = p.level; choices = p.choices; sel = 1; chosen = false;
      startFlips();
    },
    exit() {},
    update(_, realDt) {
      const prev = time;
      time += realDt;
      for (let i = 0; i < 3; i++) {
        const t0 = i * STAGGER;
        if (time >= t0 && flips[i] < 1) {
          if (prev < t0) playSfx('card_flip', { volume: 0.8 });
          flips[i] = Math.min(1, (time - t0) / FLIP_SEC);
        }
      }
      const m = states.mouse;
      if (m.moved) for (let i = 0; i < 3; i++) if (hit({ x: cardX(i), y: CARD_Y, w: CARD_W, h: 128 }, m.x, m.y) && sel !== i) { sel = i; playUi('ui_move'); }
      if (m.clicked) {
        for (let i = 0; i < 3; i++) if (hit({ x: cardX(i), y: CARD_Y, w: CARD_W, h: 128 }, m.x, m.y)) { sel = i; choose(i); return; }
        if (rerolls() > 0 && hit(rerollRect, m.x, m.y)) reroll();
      }
    },
    handleAction(a) {
      if (a === 'menuLeft') { sel = (sel + 2) % 3; playUi('ui_move'); return true; }
      if (a === 'menuRight') { sel = (sel + 1) % 3; playUi('ui_move'); return true; }
      if (a === 'confirm') { choose(sel); return true; }
      if (a === 'menuDown' || a === 'menuUp') { reroll(); return true; }
      return false; // pas d'annulation : il faut choisir
    },
    render(ui) {
      dimmer(ui, W, H, 0.65, states.rampOf('levelup'));
      // Bandeau sombre sous le titre pour ne pas se mêler au chronomètre du HUD.
      ui.globalAlpha = 0.75; ui.fillStyle = C.suie; ui.fillRect(W / 2 - 120, 30, 240, 42); ui.globalAlpha = 1;
      heading(ui, t('ui.levelup.title', { level }), W / 2, 32, 20);
      text(ui, t('ui.levelup.subtitle'), W / 2, 58, { size: 10, align: 'center', color: C.os, shadow: true });
      for (let i = 0; i < 3; i++) {
        const c = choices[i]; if (!c) continue;
        const lift = i === sel && flips[i] >= 1 ? -6 : 0;
        const levelLabel = c.type === 'bonus' ? '' : c.isNew ? t('ui.common.new') : t('ui.common.level_short', { level: c.level });
        card(ui, cardX(i), CARD_Y + lift, {
          flip: flips[i], focused: i === sel, icon: c.icon, kind: t(KIND_KEY[c.type] || KIND_KEY.bonus),
          title: t(c.name), level: levelLabel, isNew: c.isNew, desc: t(c.desc, cardParams(c)),
        });
      }
      const n = rerolls();
      if (n > 0) button(ui, { ...rerollRect, label: t('ui.levelup.reroll', { count: n }), size: 9, focused: false });
      text(ui, t(touchActive() ? 'ui.touch.card_hint' : hasGamepad() ? 'ui.levelup.hint_pad' : 'ui.levelup.hint'), W / 2, H - 36, { size: 8, align: 'center', color: C.gris, shadow: true });
    },
  };
}
