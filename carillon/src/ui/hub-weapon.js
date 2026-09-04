// ui/hub-weapon.js — sélecteur « Timbre de départ » du panneau Sonneur du hub
// (sous-module de hub.js) : ◄ ► parmi tous les Timbres, les verrouillés grisés
// avec leur condition (niveau max en run ou prix en Bronze) et un bouton d'achat.
// Le Muet garde son Diapason et choisit ici un second Timbre (ou « Diapason seul »).
// Le choix est mémorisé par sonneur (save.lastWeaponByCharacter) via start-weapons.js.

import { getSave } from '../core/save.js';
import { playUi } from '../audio/sfx.js';
import { t } from './i18n.js';
import { def as dataDef } from './gamedata.js';
import { text, paragraph, button, icon, hit, C } from './widgets.js';
import { choicesFor, chosenWeapon, rememberWeapon, isStartWeaponUnlocked, conditionText, weaponCost, weaponParams, weaponIcon, buyStartWeapon } from './start-weapons.js';

/** side = rectangle du panneau Sonneur ; le sélecteur occupe ses 52 derniers pixels. */
export function createWeaponPicker(side) {
  let charDef = null, choices = [], idx = 0;
  const y0 = side.y + side.h - 52;
  const prev = { x: side.x + 10, y: y0 + 10, w: 14, h: 14 };
  const next = { x: side.x + side.w - 24, y: y0 + 10, w: 14, h: 14 };
  const buy = { x: side.x + 40, y: y0 + 36, w: side.w - 80, h: 14 };
  const NONE = { id: null, def: null };
  const current = () => choices[idx] || NONE;
  const unlocked = (c) => c.id === null || isStartWeaponUnlocked(c.id);
  const fixedId = () => (charDef && charDef.startWeaponFixed ? charDef.startWeapon : null);

  /** Sonneur affiché : recharge la liste et replace le curseur sur son choix mémorisé. */
  function setChar(c) {
    charDef = c; choices = choicesFor(c);
    const want = chosenWeapon(c);
    idx = Math.max(0, choices.findIndex((x) => x.id === want));
  }

  function cycle(d) {
    if (!choices.length) return;
    idx = (idx + d + choices.length) % choices.length;
    playUi('ui_move');
    if (unlocked(current())) rememberWeapon(charDef.id, current().id);
  }

  /** Entrée sur le sélecteur : vrai si le Timbre courant est utilisable (achat tenté sinon). */
  function confirm() {
    const c = current();
    if (unlocked(c)) { playUi('ui_confirm'); return true; }
    if (buyStartWeapon(c.id)) { rememberWeapon(charDef.id, c.id); return true; }
    playUi('ui_cancel');
    return false;
  }

  function click(mx, my) {
    if (hit(prev, mx, my)) { cycle(-1); return true; }
    if (hit(next, mx, my)) { cycle(1); return true; }
    if (!unlocked(current()) && hit(buy, mx, my)) { confirm(); return true; }
    return false;
  }

  function render(ui, focused) {
    if (!charDef) return;
    const c = current(), open = unlocked(c), fixed = fixedId();
    const label = fixed ? t('ui.hub.second_weapon_label', { weapon: t('weapon.' + fixed + '.name') }) : t('ui.hub.start_weapon_label');
    text(ui, label, side.x + 12, y0, { size: 8, color: C.encreClaire, maxWidth: side.w - 24 });
    button(ui, { ...prev, label: t('ui.hub.prev'), focused, size: 9 });
    button(ui, { ...next, label: t('ui.hub.next'), focused, size: 9 });
    const ic = c.id ? weaponIcon(c.id) : weaponIcon(fixed);
    if (!open) ui.globalAlpha = 0.4;
    icon(ui, ic, side.x + 28, y0 + 9, 0.5);
    ui.globalAlpha = 1;
    const name = c.id ? t(c.def.name) : t('ui.hub.weapon_none', { weapon: t('weapon.' + fixed + '.name') });
    text(ui, name, side.x + 48, y0 + 13, { size: 9, color: open ? (focused ? C.bronze : C.encre) : C.gris, maxWidth: next.x - side.x - 52 });
    if (open) {
      const def = c.def || (fixed ? dataDef('weapons', fixed) : null);
      if (def) paragraph(ui, t(def.desc, weaponParams(def)), side.x + 12, y0 + 27, side.w - 24, { size: 8, color: C.encre, lineHeight: 8, maxLines: 2 });
    } else {
      text(ui, conditionText(c.id), side.x + 12, y0 + 27, { size: 8, color: C.encreClaire, maxWidth: side.w - 24 });
      const cost = weaponCost(c.id);
      button(ui, { ...buy, label: t('ui.hub.unlock_weapon', { cost }), focused, size: 8, disabled: getSave().bronze < cost });
    }
  }

  return {
    setChar, cycle, confirm, click, render,
    /** Timbre choisi (id, ou null = aucun second Timbre pour le Muet). */
    selected: () => current().id,
    /** Le choix courant est-il utilisable pour sonner la nuit ? */
    ok: () => unlocked(current()),
    /** Icône du Timbre courant (bouton « Sonner la nuit »). */
    icon: () => (current().id ? weaponIcon(current().id) : charDef ? weaponIcon(charDef.startWeapon) : 'battant'),
  };
}
