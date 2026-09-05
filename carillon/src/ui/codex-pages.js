// ui/codex-pages.js — contenu des onglets du codex : listes d'entrées et
// panneau de détail (bestiaire rempli par save.codex, Timbres, Accords,
// fusions découvertes, hauts-faits). Les Feuillets sont rendus par ui/lore.js.
// L'onglet Timbres indique si le Timbre est débloqué en départ (start-weapons.js).
// Onglet Reliques (§ 11 bis) : découvertes = portées au moins une nuit (save.codex.relics).

import { getSave } from '../core/save.js';
import * as atlas from '../render/atlas.js';
import { t, has } from './i18n.js';
import { enemies, weapons, passives, fusions, relics, lore as loreDefs } from './gamedata.js';
import { achievementList } from './achievements.js';
import { leafIds, isUnlocked as leafUnlocked, isRead as leafRead } from './lore.js';
import { isStartWeaponUnlocked, unlockLevel, weaponCost, weaponParams } from './start-weapons.js';
import { text, paragraph, icon, pips, heading, C } from './widgets.js';

export const TABS = ['bestiary', 'weapons', 'passives', 'fusions', 'relics', 'leaves', 'achievements'];

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
    case 'relics': return relics().map((d) => {
      const n = (save.codex.relics && save.codex.relics[d.id]) || 0;
      return { id: d.id, def: d, kind: 'relic', known: n > 0, count: n, label: n > 0 ? t(d.name) : t('ui.common.unknown'), icon: n > 0 ? d.icon : 'ui_sceau' };
    });
    case 'achievements': return achievementList().map((a) => ({ id: a.id, def: a, kind: 'achievement', known: a.unlocked, label: a.name, icon: a.unlocked ? 'ui_sceau' : null }));
    // Feuillets : le codex LISTE (titre, trouvé / lu) ; la lecture se fait à l'Autel des Feuillets.
    case 'leaves': return leafIds().map((id, i) => {
      const known = leafUnlocked(id), read = known && leafRead(id);
      const def = loreDefs().find((l) => l.id === id) || { id };
      return { id, def, kind: 'leaf', known, read, index: i, label: known ? t('lore.' + id + '.title') : t('ui.altar.leaf_number', { n: i + 1 }), icon: known ? 'ui_lanterne' : null };
    });
    default: return [];
  }
}

/** Progression affichée dans l'onglet (x / total). */
export function pageProgress(tab) {
  const items = pageItems(tab);
  return { done: items.filter((i) => i.known).length, total: items.length };
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
  if (tab === 'weapons' || tab === 'fusions') { renderWeapon(ui, tab, item, r); return; }
  if (tab === 'passives') {
    icon(ui, d.icon, r.x + 14, r.y + 10, 1);
    heading(ui, t(d.name), r.x + 54, r.y + 14, 14, 'left');
    const sk = 'ui.codex.stat_' + d.stat;
    text(ui, t('ui.codex.stat', { stat: has(sk) ? t(sk) : d.stat, value: statValue(d.stat, d.perLevel) }), r.x + 54, r.y + 34, { size: 9, color: C.encreClaire });
    pips(ui, r.x + 54, r.y + 46, d.maxLevel, d.maxLevel);
    text(ui, t('ui.codex.max_level', { max: d.maxLevel }), r.x + 54 + d.maxLevel * 5 + 6, r.y + 44, { size: 8, color: C.encreClaire });
    let y = r.y + 58;
    y += paragraph(ui, t(d.desc), r.x + 12, y, r.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 5 });
    // Effet cumulé au niveau max et fusion possible (fusions.json : weapon + passive).
    text(ui, t('ui.codex.stat_total', { stat: has(sk) ? t(sk) : d.stat, value: statValue(d.stat, d.perLevel * d.maxLevel) }), r.x + 12, y + 6, { size: 8, color: C.bronze });
    const fu = fusions().find((f) => f.passive === d.id);
    text(ui, fu ? t('ui.codex.fusion_with', { fusion: fusionName(fu), other: t('weapon.' + fu.weapon + '.name') }) : t('ui.codex.no_fusion'), r.x + 12, y + 18, { size: 8, color: fu ? C.bronze : C.encreClaire, maxWidth: r.w - 24 });
    return;
  }
  if (tab === 'leaves') {
    const known = item.known;
    icon(ui, known ? 'ui_lanterne' : 'ui_sceau', r.x + 14, r.y + 10, 1);
    heading(ui, known ? t('lore.' + d.id + '.title') : t('ui.altar.leaf_number', { n: item.index + 1 }), r.x + 54, r.y + 14, 13, 'left');
    text(ui, t(known ? (item.read ? 'ui.altar.read' : 'ui.altar.unread') : 'ui.codex.leaf_missing'), r.x + 54, r.y + 34, { size: 9, color: known ? (item.read ? C.encreClaire : C.braise) : C.encreClaire });
    paragraph(ui, t(known ? 'ui.codex.leaf_read_at' : 'ui.altar.locked'), r.x + 12, r.y + 58, r.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 3 });
    if (!known && d.unlock) paragraph(ui, unlockHint(d.unlock), r.x + 12, r.y + 92, r.w - 24, { size: 8, color: C.encreClaire, lineHeight: 9, maxLines: 3 });
    return;
  }
  if (tab === 'relics') {
    icon(ui, item.known ? d.icon : 'ui_sceau', cx - 16, r.y + 30, 1);
    heading(ui, item.known ? t(d.name) : t('ui.common.unknown'), cx, r.y + 70, 14);
    text(ui, item.known ? t('ui.codex.relic_taken', { count: item.count }) : t('ui.codex.locked'), cx, r.y + 90, { size: 9, align: 'center', color: item.known ? C.bronze : C.encreClaire });
    paragraph(ui, item.known ? t(d.desc) : t('ui.codex.relic_hidden'), r.x + 12, r.y + 110, r.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 6 });
    return;
  }
  if (tab === 'achievements') {
    icon(ui, item.known ? 'ui_sceau' : 'ui_mort', cx - 16, r.y + 30, 1);
    heading(ui, d.name, cx, r.y + 70, 14);
    text(ui, t(item.known ? 'ui.codex.unlocked' : 'ui.codex.locked'), cx, r.y + 90, { size: 9, align: 'center', color: item.known ? C.bronze : C.encreClaire });
    paragraph(ui, d.desc, r.x + 12, r.y + 110, r.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 6 });
  }
}

/** Stats exprimées en pourcentage (valeur < 1 par niveau) plutôt qu'en points. */
const PERCENT_STATS = { area: true, window: true, crit: true, windowMult: true, damageMult: true, magnet: true, xpGain: true, bronzeGain: true };
function statValue(stat, v) { return PERCENT_STATS[stat] ? Math.round(v * 100) + ' %' : String(Math.round(v * 100) / 100); }
function fusionName(fu) { return getSave().unlocked.fusions.indexOf(fu.id) >= 0 ? t(fu.name) : t('ui.common.unknown'); }

/** Texte d'un palier de Timbre : « +8 dégâts, +20 % zone » depuis weapons.json levels[i]. */
function levelEffects(lvl) {
  const parts = [];
  for (const k of Object.keys(lvl)) {
    const v = lvl[k], key = 'ui.codex.lvl_' + k;
    const shown = (k === 'area' || k === 'speed' || k === 'markBonus') ? Math.round(v * 100) : Math.round(v * 100) / 100;
    parts.push(has(key) ? t(key, { v: shown }) : k + ' +' + shown);
  }
  return parts.join(', ');
}

/** « Tocsin niv. 5 + Contrepoids niv. 3 » (seuils `unlock` de fusions.json ; recette simple sans seuils). */
function recipeText(f) {
  const w = t('weapon.' + f.weapon + '.name'), p = t('passive.' + f.passive + '.name');
  return f.unlock ? t('ui.codex.recipe_levels', { weapon: w, wl: f.unlock.weapon || 1, passive: p, pl: f.unlock.passive || 1 }) : t('ui.codex.recipe', { weapon: w, passive: p });
}

/** Détail d'un Timbre ou d'une fusion : identité, cadence/portée, description, table des niveaux, fusion, voix. */
function renderWeapon(ui, tab, item, r) {
  const d = item.def, isFusion = tab === 'fusions';
  const fu = isFusion ? d : fusions().find((f) => f.weapon === d.id);
  if (!item.known) {
    icon(ui, 'ui_sceau', r.x + 14, r.y + 10, 1);
    heading(ui, t('ui.common.unknown'), r.x + 54, r.y + 14, 14, 'left');
    // La recette et ses seuils restent lisibles même si la fusion n'a jamais été faite : c'est le but d'un codex.
    text(ui, recipeText(d), r.x + 54, r.y + 34, { size: 9, color: C.bronze, maxWidth: r.w - 66 });
    paragraph(ui, t('ui.codex.recipe_how'), r.x + 12, r.y + 58, r.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 4 });
    return;
  }
  icon(ui, d.icon, r.x + 14, r.y + 10, 1);
  heading(ui, t(d.name), r.x + 54, r.y + 14, 14, 'left');
  const rk = 'ui.codex.rhythm_' + d.rhythm;
  const base = d.base || {};
  text(ui, t('ui.codex.rhythm', { rhythm: has(rk) ? t(rk) : String(d.rhythm) }) + ' · ' + t('ui.codex.range', { range: Math.round((base.range || 0) / 32 * 10) / 10 }), r.x + 54, r.y + 34, { size: 8, color: C.encreClaire, maxWidth: r.w - 66 });
  if (isFusion) { text(ui, recipeText(d), r.x + 54, r.y + 44, { size: 8, color: C.bronze, maxWidth: r.w - 66 }); if (d.hint && has(d.hint)) text(ui, t(d.hint), r.x + 54, r.y + 53, { size: 7, color: C.encreClaire, maxWidth: r.w - 66 }); }
  else if (isStartWeaponUnlocked(d.id)) text(ui, t('ui.codex.start_unlocked'), r.x + 54, r.y + 44, { size: 8, color: C.bronze });
  else text(ui, t('ui.codex.start_locked', { level: unlockLevel(), cost: weaponCost(d.id) }), r.x + 54, r.y + 44, { size: 8, color: C.encreClaire, maxWidth: r.w - 66 });
  let y = r.y + 58;
  y += paragraph(ui, t(d.desc, weaponParams(d)), r.x + 12, y, r.w - 24, { size: 9, color: C.encre, lineHeight: 10, maxLines: 3 });
  // Table des niveaux (weapons.json `levels`), sur deux colonnes.
  const levels = d.levels || [];
  if (levels.length > 1) {
    y += 4;
    text(ui, t('ui.codex.levels'), r.x + 12, y, { size: 8, color: C.encreClaire }); y += 10;
    const colW = (r.w - 24) / 2;
    for (let i = 1; i < levels.length; i++) {
      const col = (i - 1) % 2, row = Math.floor((i - 1) / 2);
      text(ui, t('ui.codex.level_line', { level: i + 1, effects: levelEffects(levels[i]) }), r.x + 12 + col * colW, y + row * 9, { size: 7, color: C.encre, maxWidth: colW - 4 });
    }
    y += Math.ceil((levels.length - 1) / 2) * 9 + 4;
  }
  if (!isFusion) text(ui, fu ? t('ui.codex.fusion_with', { fusion: fusionName(fu), other: t('passive.' + fu.passive + '.name') }) : t('ui.codex.no_fusion'), r.x + 12, y, { size: 8, color: fu ? C.bronze : C.encreClaire, maxWidth: r.w - 24 });
  const vk = (isFusion ? 'fusion.' : 'weapon.') + d.id + '.voice';
  if (has(vk) && y + 12 < r.y + r.h - 20) paragraph(ui, t(vk), r.x + 12, y + 12, r.w - 24, { size: 8, color: C.encreClaire, lineHeight: 9, maxLines: 2 });
}

/** Indice de déblocage d'un Feuillet non retrouvé (lore.json `unlock`). */
function unlockHint(u) {
  const key = 'ui.codex.unlock_' + u.type;
  if (!has(key)) return '';
  return t(key, {
    parish: u.parish ? t('parish.' + u.parish + '.name') : '', minute: u.minute || 0, count: u.count || 0,
    enemy: u.enemy ? t('enemy.' + u.enemy + '.name') : '', boss: u.boss ? t('boss.' + u.boss + '.name') : '',
    character: u.character ? t('char.' + u.character + '.name') : '', fusion: u.fusion ? t('fusion.' + u.fusion + '.name') : '',
    sec: u.seconds || 0, runs: u.count || 0,
  });
}
