// ui/hub-tree.js — arbre des améliorations du Beffroi (upgrades.json, 14
// nœuds) : colonnes par profondeur de prérequis, liens au fusain, niveaux en
// pastilles, achat en Bronze. save.unlocked.upgrades = [{ id, level }] (forme
// lue par game/game.js). Écran empilable 'tree'.

import { getSave, commit } from '../core/save.js';
import { playUi, play as playSfx } from '../audio/sfx.js';
import { t, has } from './i18n.js';
import { upgrades } from './gamedata.js';
import * as states from './states.js';
import { toast } from './toasts.js';
import { panel, text, paragraph, button, icon, pips, hit, backdrop, heading, C } from './widgets.js';

const W = 480, H = 270;
const COL_X = [22, 178, 334], COL_W = 124, NODE_H = 18, ROW_STEP = 21, TOP = 28;
const DESC = { x: 8, y: 196, w: W - 16, h: 66 };

/** Niveau acheté d'une amélioration. */
export function upgradeLevel(id) {
  const list = getSave().unlocked.upgrades || [];
  let n = 0;
  for (const u of list) { if (u === id) n++; else if (u && u.id === id) n = Math.max(n, u.level || 1); }
  return n;
}

function setLevel(id, level) {
  const s = getSave();
  const list = (s.unlocked.upgrades || []).filter((u) => u !== id && !(u && u.id === id));
  list.push({ id, level });
  s.unlocked.upgrades = list;
}

/** Stats en pourcentage (valeur par niveau < 1) ; les autres en points. */
const PERCENT_STATS = { windowMult: true, damageMult: true, magnet: true, xpGain: true, crit: true, bronzeGain: true, area: true };
function statValue(stat, v) { return PERCENT_STATS[stat] ? '+' + Math.round(v * 100) + ' %' : '+' + Math.round(v * 100) / 100; }

function depthOf(def, all, memo) {
  if (memo.has(def.id)) return memo.get(def.id);
  let d = 0;
  for (const r of def.requires || []) { const p = all.find((u) => u.id === r); if (p) d = Math.max(d, depthOf(p, all, memo) + 1); }
  memo.set(def.id, d);
  return d;
}

export function createTree() {
  let nodes = [];        // { def, col, row, rect }
  let sel = 0, time = 0;
  const buyRect = { x: DESC.x + DESC.w - 150, y: DESC.y + DESC.h - 26, w: 140, h: 20 };

  function layout() {
    const all = upgrades();
    const memo = new Map();
    const cols = [[], [], []];
    for (const def of all) cols[Math.min(2, depthOf(def, all, memo))].push(def);
    nodes = [];
    for (let c = 0; c < 3; c++) for (let r = 0; r < cols[c].length; r++) {
      nodes.push({ def: cols[c][r], col: c, row: r, rect: { x: COL_X[c], y: TOP + r * ROW_STEP, w: COL_W, h: NODE_H } });
    }
    if (sel >= nodes.length) sel = 0;
  }

  const node = () => nodes[sel];
  const maxLevel = (def) => def.cost.length;
  const prereqOk = (def) => (def.requires || []).every((r) => upgradeLevel(r) > 0);
  const missing = (def) => (def.requires || []).find((r) => upgradeLevel(r) === 0);

  function buy() {
    const n = node(); if (!n) return;
    const def = n.def, lvl = upgradeLevel(def.id), s = getSave();
    if (lvl >= maxLevel(def) || !prereqOk(def)) { playUi('ui_cancel'); return; }
    const cost = def.cost[lvl];
    if (s.bronze < cost) { playUi('ui_cancel'); toast({ title: t('ui.tree.title'), body: t('ui.hub.not_enough_bronze'), icon: 'ui_bronze' }); return; }
    s.bronze -= cost; setLevel(def.id, lvl + 1); commit();
    playSfx('level_up');
    toast({ title: t('ui.tree.title'), body: t('ui.tree.bought', { name: t(def.name) }), icon: 'ui_sceau' });
  }

  function move(dc, dr) {
    const n = node(); if (!n) return;
    let best = -1, bestScore = 1e9;
    for (let i = 0; i < nodes.length; i++) {
      const o = nodes[i]; if (i === sel) continue;
      if (dc !== 0 && (Math.sign(o.col - n.col) !== dc)) continue;
      if (dc === 0 && (o.col !== n.col || Math.sign(o.row - n.row) !== dr)) continue;
      const score = Math.abs(o.col - n.col) * 10 + Math.abs(o.row - n.row);
      if (score < bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) { sel = best; playUi('ui_move'); }
  }

  return {
    freezes: true,
    opaque: true,
    enter() { layout(); time = 0; },
    exit() {},
    update(_, realDt) {
      time += realDt;
      const m = states.mouse;
      if (m.moved) for (let i = 0; i < nodes.length; i++) if (hit(nodes[i].rect, m.x, m.y) && sel !== i) { sel = i; playUi('ui_move'); }
      if (m.clicked) {
        if (hit(buyRect, m.x, m.y)) buy();
        else if (!nodes.some((n) => hit(n.rect, m.x, m.y)) && m.y < DESC.y) { playUi('ui_cancel'); states.pop(); }
      }
    },
    handleAction(a) {
      if (a === 'menuUp') move(0, -1); else if (a === 'menuDown') move(0, 1);
      else if (a === 'menuLeft') move(-1, 0); else if (a === 'menuRight') move(1, 0);
      else if (a === 'confirm') buy();
      else if (a === 'cancel' || a === 'pause') { playUi('ui_cancel'); states.pop(); }
      else return false;
      return true;
    },
    render(ui) {
      backdrop(ui, W, H, states.rampOf('tree'));
      panel(ui, 4, 4, W - 8, 188, 'parchment');
      heading(ui, t('ui.tree.title'), W / 2, 6, 16);
      icon(ui, 'ui_bronze', W - 96, 8, 0.5);
      text(ui, t('ui.common.bronze', { value: getSave().bronze }), W - 78, 12, { size: 10, color: C.bronze, shadow: true });
      // Liens vers les prérequis.
      ui.strokeStyle = C.encreClaire; ui.lineWidth = 1; ui.beginPath();
      for (const n of nodes) for (const r of n.def.requires || []) {
        const p = nodes.find((o) => o.def.id === r); if (!p) continue;
        ui.moveTo(p.rect.x + p.rect.w, p.rect.y + p.rect.h / 2); ui.lineTo(n.rect.x, n.rect.y + n.rect.h / 2);
      }
      ui.stroke();
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i], r = n.rect, lvl = upgradeLevel(n.def.id), ok = prereqOk(n.def), full = lvl >= maxLevel(n.def);
        // Nœud : fond plat (acheté = liseré bronze, verrouillé = gris) ; le sélectionné en bronze plein.
        ui.globalAlpha = i === sel ? 1 : 0.85; ui.fillStyle = i === sel ? C.bronze : C.tourbe; ui.fillRect(r.x, r.y, r.w, r.h); ui.globalAlpha = 1;
        ui.fillStyle = i === sel ? C.clair : lvl > 0 ? C.bronze : !ok ? C.encreClaire : C.gris;
        ui.fillRect(r.x, r.y, r.w, 1); ui.fillRect(r.x, r.y + r.h - 1, r.w, 1); ui.fillRect(r.x, r.y, 1, r.h); ui.fillRect(r.x + r.w - 1, r.y, 1, r.h);
        text(ui, t(n.def.name), r.x + 6, r.y + 4, { size: 9, color: i === sel ? C.suie : !ok ? C.gris : full ? C.bronze : C.os, maxWidth: r.w - 50 });
        pips(ui, r.x + r.w - (ok ? 8 : 20) - maxLevel(n.def) * 5, r.y + 7, lvl, maxLevel(n.def), i === sel ? C.suie : C.bronze);
        if (!ok) icon(ui, 'ui_sceau', r.x + r.w - 16, r.y + 2, 0.4);
      }
      // Description et achat.
      panel(ui, DESC.x, DESC.y, DESC.w, DESC.h, 'parchment');
      const n = node();
      if (n) {
        const lvl = upgradeLevel(n.def.id), max = maxLevel(n.def), ok = prereqOk(n.def);
        heading(ui, t(n.def.name), DESC.x + 12, DESC.y + 6, 13, 'left');
        text(ui, t('ui.tree.level', { level: lvl, max }), DESC.x + DESC.w - 12, DESC.y + 10, { size: 9, align: 'right', color: C.encreClaire });
        const dh = paragraph(ui, t(n.def.desc), DESC.x + 12, DESC.y + 24, DESC.w - 170, { size: 9, color: C.encre, lineHeight: 10, maxLines: 2 });
        // Valeur chiffrée : « +10 vie max par niveau · actuellement +20 » (upgrades.json stat / perLevel).
        if (n.def.stat && n.def.perLevel !== undefined) {
          const sk = 'ui.tree.stat_' + n.def.stat, name = t(has(sk) ? sk : 'ui.tree.stat_generic', { stat: n.def.stat });
          let line = t('ui.tree.per_level', { value: statValue(n.def.stat, n.def.perLevel), stat: name });
          if (lvl > 0) line += ' · ' + t('ui.tree.total', { value: statValue(n.def.stat, n.def.perLevel * lvl) });
          text(ui, line, DESC.x + 12, DESC.y + 24 + dh + 2, { size: 8, color: C.bronze, maxWidth: DESC.w - 170 });
        }
        let label, disabled = false;
        if (lvl >= max) { label = t('ui.tree.maxed'); disabled = true; }
        else if (!ok) { label = t('ui.tree.requires', { name: t('upgrade.' + missing(n.def) + '.name') }); disabled = true; }
        else { label = t('ui.tree.buy', { cost: n.def.cost[lvl] }); disabled = getSave().bronze < n.def.cost[lvl]; }
        button(ui, { ...buyRect, label, focused: !disabled, disabled, size: 9 });
      }
      text(ui, t('ui.tree.hint'), W / 2, H - 8, { size: 8, align: 'center', color: C.gris });
    },
  };
}
