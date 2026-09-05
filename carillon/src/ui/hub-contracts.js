// ui/hub-contracts.js — Contrats de nuit (vague 2) : écran empilable 'contracts' posé par le hub.
// Les contrats proposés sont tirés au rng de la seed (game/contracts.js → offerContracts) : `offer.ids` ;
// le joueur en accepte 0, 1 ou 2 (3 avec le nœud « Contrat en plus »). enter({ offer, count }) où
// offer = { ids: [id], accepted: [id] } est partagé avec le hub et muté ici. Cartes de missel : difficulté
// (S/M/L), titre, description, récompense (Bronze ou Feuillet) ; Entrée / clic = accepter ou refuser.
// Aussi : `contractLine(status)` → texte d'une ligne de suivi (bilan, HUD) et `rewardText(def)`.

import { playUi } from '../audio/sfx.js';
import { hasGamepad } from '../core/input.js';
import { t } from './i18n.js';
import { def as dataDef } from './gamedata.js';
import * as states from './states.js';
import { isActive as touchActive } from './touch.js';
import { card, text, button, backdrop, hit, heading, C } from './widgets.js';

const W = 480, H = 270;
const CARD_W = 96, CARD_H = 128, GAP = 22, CARD_Y = 58;
const MAX_ACCEPT_DEFAULT = 2;

/** Récompense lisible d'un contrat. */
export function rewardText(def) {
  if (!def || !def.reward) return '';
  if (def.reward.leaf) return t('ui.contracts.reward_leaf');
  return t('ui.contracts.reward_bronze', { bronze: def.reward.bronze || 0 });
}

/** Ligne de suivi : « Trente Chœurs sur le temps · 12 / 30 » (+ état). */
export function contractLine(c) {
  const name = t('contract.' + c.id + '.name');
  const state = c.done ? t('ui.contracts.done') : c.failed ? t('ui.contracts.failed') : t('ui.contracts.progress', { progress: c.progress, goal: c.goal });
  return name + ' · ' + state;
}

export function createContracts() {
  let offer = { ids: [], accepted: [] }, sel = 0, maxAccept = MAX_ACCEPT_DEFAULT;
  const backRect = { x: W / 2 - 60, y: CARD_Y + CARD_H + 34, w: 120, h: 20 };
  const n = () => offer.ids.length;
  const cardX = (i) => Math.round(W / 2 - (n() * CARD_W + (n() - 1) * GAP) / 2 + i * (CARD_W + GAP));
  const cardRect = (i) => ({ x: cardX(i), y: CARD_Y, w: CARD_W, h: CARD_H });
  const isOn = (id) => offer.accepted.indexOf(id) >= 0;

  function toggle(i) {
    const id = offer.ids[i];
    if (!id) return;
    const k = offer.accepted.indexOf(id);
    if (k >= 0) { offer.accepted.splice(k, 1); playUi('ui_cancel'); return; }
    if (offer.accepted.length >= maxAccept) { playUi('ui_cancel'); return; }
    offer.accepted.push(id); playUi('ui_confirm');
  }

  function back() { playUi('ui_cancel'); states.pop(); }

  return {
    freezes: true,
    opaque: true,
    enter(p) { offer = (p && p.offer) || { ids: [], accepted: [] }; maxAccept = (p && p.count) || MAX_ACCEPT_DEFAULT; sel = 0; },
    exit() {},
    update() {
      const m = states.mouse;
      if (m.moved) {
        for (let i = 0; i < n(); i++) if (hit(cardRect(i), m.x, m.y) && sel !== i) { sel = i; playUi('ui_move'); }
        if (hit(backRect, m.x, m.y) && sel !== n()) { sel = n(); playUi('ui_move'); }
      }
      if (m.clicked) {
        for (let i = 0; i < n(); i++) if (hit(cardRect(i), m.x, m.y)) { sel = i; toggle(i); return; }
        if (hit(backRect, m.x, m.y) || m.y < 20) back();
      }
    },
    handleAction(a) {
      const count = n() + 1;
      if (a === 'menuLeft' || a === 'menuUp') { sel = (sel + count - 1) % count; playUi('ui_move'); return true; }
      if (a === 'menuRight' || a === 'menuDown') { sel = (sel + 1) % count; playUi('ui_move'); return true; }
      if (a === 'confirm') { if (sel >= n()) back(); else toggle(sel); return true; }
      if (a === 'cancel' || a === 'pause') { back(); return true; }
      return false;
    },
    render(ui) {
      backdrop(ui, W, H, states.rampOf('contracts'));
      heading(ui, t('ui.contracts.title'), W / 2, 8, 18);
      text(ui, t('ui.contracts.subtitle', { max: maxAccept }), W / 2, 32, { size: 9, align: 'center', color: C.os, shadow: true });
      for (let i = 0; i < n(); i++) {
        const id = offer.ids[i], d = dataDef('contracts', id);
        if (!d) continue;
        const on = isOn(id);
        const lift = i === sel ? -6 : 0;
        card(ui, cardX(i), CARD_Y + lift, {
          flip: 1, focused: i === sel, icon: on ? 'ui_sceau' : 'ui_lanterne', kind: t('ui.contracts.difficulty_' + (d.difficulty || 'S').toLowerCase()),
          title: t(d.name), level: on ? t('ui.contracts.accepted') : rewardText(d), isNew: on, desc: t(d.desc), hint: on ? rewardText(d) : '',
        });
      }
      if (!n()) text(ui, t('ui.contracts.none'), W / 2, CARD_Y + 40, { size: 10, align: 'center', color: C.gris, shadow: true });
      text(ui, t('ui.contracts.count', { count: offer.accepted.length, max: maxAccept }), W / 2, CARD_Y + CARD_H + 16, { size: 9, align: 'center', color: C.bronze, shadow: true });
      button(ui, { ...backRect, label: t('ui.common.back'), size: 9, focused: sel === n(), icon: 'ui_lanterne' });
      text(ui, t(touchActive() ? 'ui.touch.card_hint' : hasGamepad() ? 'ui.contracts.hint_pad' : 'ui.contracts.hint'), W / 2, H - 16, { size: 8, align: 'center', color: C.gris, shadow: true });
    },
  };
}
