// ui/codex-pages.js — contenu des onglets du codex : listes d'entrées et
// panneau de détail (bestiaire rempli par save.codex, Timbres, Accords,
// fusions découvertes, hauts-faits). Les Feuillets sont rendus par ui/lore.js.

import { getSave } from '../core/save.js';
import * as atlas from '../render/atlas.js';
import { t, has } from './i18n.js';
import { enemies, weapons, passives, fusions } from './gamedata.js';
import { achievementList } from './achievements.js';
import { text, paragraph, icon, pips, heading, C } from './widgets.js';

export const TABS = ['bestiary', 'weapons', 'passives', 'fusions', 'leaves', 'achievements'];

function nameKey(def) { return has('enemy.' + def.id + '.name') ? 'enemy.' + def.id + '.name' : def.name; }
function loreKey(def) { return has('enemy.' + def.id + '.lore') ? 'enemy.' + def.id + '.lore' : def.lore; }

/** Entrées d'un onglet : [{ id, label, icon, known, def, kind }]. */
export function pageItems(tab) {
  const save = getSave();
  switch (tab) {
    case 'bestiary': {
      const list = enemies().slice().sort((a, b) => (a.boss ? 2 : a.elite ? 1 : 0) - (b.boss ? 2 : b.elite ? 1 : 0));
      return list.map((d) => {
        const kills = d.boss ? (save.codex.bosses[d.id] || 0) : (save.codex.enemies[d.id] || 0);
        const known = kills > 0;
        return { id: d.id, def: d, kind: d.boss ? 'boss' : d.elite ? 'elite' : 'enemy', known, kills, label: known ? t(nameKey(d)) : t('ui.common.unknown'), icon: d.boss ? 'ui_mort' : null };
      });
    }
    case 'weapons': return weapons().map((d) => ({ id: d.id, def: d, kind: 'weapon', known: true, label: t(d.name), icon: d.icon }));
    case 'passives': return passives().map((d) => ({ id: d.id, def: d, kind: 'passive', known: true, label: t(d.name), icon: d.icon }));
    case 'fusions': return fusions().map((d) => {
      const known = save.unlocked.fusions.indexOf(d.id) >= 0;
      return { id: d.id, def: d, kind: 'fusion', known, label: known ? t(d.name) : t('ui.common.unknown'), icon: known ? d.icon : 'ui_sceau' };
    });
    case 'achievements': return achievementList().map((a) => ({ id: a.id, def: a, kind: 'achievement', known: a.unlocked, label: a.name, icon: a.unlocked ? 'ui_sceau' : null }));
    default: return [];
  }
}

/** Progression affichée dans l'onglet (x / total). */
export function pageProgress(tab) {
  const items = pageItems(tab);
  return { done: items.filter((i) => i.known).length, total: items.length };
}

function weaponParams(def) {
  return { damage: def.base ? def.base.damage : 0, count: def.base ? def.base.count : 1, area: def.base ? Math.round(def.base.area * 100) : 100 };
}

/** Détail d'une entrée dans le rectangle donné (parchemin déjà dessiné). */
export function renderDetail(ui, tab, item, r, time) {
  if (!item) return;
  const d = item.def;
  const cx = r.x + r.w / 2;
  if (tab === 'bestiary') {
    const sprite = d.sprite || d.id;
    const anim = atlas.isDirectional(sprite) ? 'idle_down' : 'idle';
    const scale = d.boss ? 0.75 : 1;
    atlas.draw(ui, sprite, anim, atlas.frameAt(sprite, anim, time), cx, r.y + 70, { scale, tint: item.known ? null : '#16130f', alpha: item.known ? 1 : 0.5 });
    heading(ui, item.known ? t(nameKey(d)) : t('ui.common.unknown'), cx, r.y + 74, 14);
    text(ui, t(item.kind === 'boss' ? 'ui.codex.boss' : item.kind === 'elite' ? 'ui.codex.elite' : 'ui.codex.kills', { count: item.kills }), cx, r.y + 92, { size: 9, align: 'center', color: C.encreClaire });
    if (item.kind !== 'enemy' && item.known) text(ui, t('ui.codex.kills', { count: item.kills }), cx, r.y + 102, { size: 8, align: 'center', color: C.encreClaire });
    paragraph(ui, item.known ? t(loreKey(d)) : t('ui.codex.never_seen'), r.x + 12, r.y + 114, r.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 8 });
    return;
  }
  if (tab === 'weapons' || tab === 'fusions') {
    if (!item.known) {
      icon(ui, 'ui_sceau', cx - 16, r.y + 30, 1);
      heading(ui, t('ui.common.unknown'), cx, r.y + 70, 14);
      text(ui, t('ui.codex.recipe_hidden'), cx, r.y + 92, { size: 9, align: 'center', color: C.encreClaire });
      return;
    }
    icon(ui, d.icon, cx - 16, r.y + 30, 1);
    heading(ui, t(d.name), cx, r.y + 70, 14);
    const rk = 'ui.codex.rhythm_' + d.rhythm;
    text(ui, t('ui.codex.rhythm', { rhythm: has(rk) ? t(rk) : String(d.rhythm) }), cx, r.y + 90, { size: 9, align: 'center', color: C.encreClaire });
    if (tab === 'fusions') text(ui, t('ui.codex.recipe', { weapon: t('weapon.' + d.weapon + '.name'), passive: t('passive.' + d.passive + '.name') }), cx, r.y + 100, { size: 9, align: 'center', color: C.bronze });
    let y = r.y + 114;
    y += paragraph(ui, t(d.desc, weaponParams(d)), r.x + 12, y, r.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 5 });
    const vk = (tab === 'fusions' ? 'fusion.' : 'weapon.') + d.id + '.voice';
    if (has(vk)) paragraph(ui, t(vk), r.x + 12, y + 6, r.w - 24, { size: 8, color: C.encreClaire, lineHeight: 9, maxLines: 3 });
    return;
  }
  if (tab === 'passives') {
    icon(ui, d.icon, cx - 16, r.y + 30, 1);
    heading(ui, t(d.name), cx, r.y + 70, 14);
    const sk = 'ui.codex.stat_' + d.stat;
    text(ui, t('ui.codex.stat', { stat: has(sk) ? t(sk) : d.stat, value: d.perLevel }), cx, r.y + 90, { size: 9, align: 'center', color: C.encreClaire });
    pips(ui, cx - d.maxLevel * 2.5, r.y + 102, d.maxLevel, d.maxLevel);
    paragraph(ui, t(d.desc), r.x + 12, r.y + 114, r.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 6 });
    return;
  }
  if (tab === 'achievements') {
    icon(ui, item.known ? 'ui_sceau' : 'ui_mort', cx - 16, r.y + 30, 1);
    heading(ui, d.name, cx, r.y + 70, 14);
    text(ui, t(item.known ? 'ui.codex.unlocked' : 'ui.codex.locked'), cx, r.y + 90, { size: 9, align: 'center', color: item.known ? C.bronze : C.encreClaire });
    paragraph(ui, d.desc, r.x + 12, r.y + 110, r.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 6 });
  }
}
