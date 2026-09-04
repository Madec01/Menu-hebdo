// ui/lore.js — Feuillets du Battant : liste des 24 Feuillets (lore.json via
// les données de jeu, repli f01…f24), état lu/non lu (extension documentée du
// schéma Save : save.leavesRead = [ids]) et lecteur en parchemin défilant,
// écran empilable 'leaf' : enter({ leafId }).

import { getSave, commit } from '../core/save.js';
import { playUi } from '../audio/sfx.js';
import { t } from './i18n.js';
import { lore as loreDefs } from './gamedata.js';
import * as states from './states.js';
import { panel, text, wrap, dimmer, heading, icon, C } from './widgets.js';

const W = 480, H = 270;
const TOTAL = 24;

/** Ids des Feuillets dans l'ordre. */
export function leafIds() {
  const defs = loreDefs();
  if (defs && defs.length) return defs.map((l) => l.id);
  const out = [];
  for (let i = 1; i <= TOTAL; i++) out.push('f' + (i < 10 ? '0' + i : i));
  return out;
}

export function isUnlocked(id) { return getSave().unlocked.leaves.indexOf(id) >= 0; }
export function isRead(id) { const s = getSave(); return !!(s.leavesRead && s.leavesRead.indexOf(id) >= 0); }
export function unreadCount() { let n = 0; for (const id of leafIds()) if (isUnlocked(id) && !isRead(id)) n++; return n; }

function markRead(id) {
  const s = getSave();
  if (!s.leavesRead) s.leavesRead = [];
  if (s.leavesRead.indexOf(id) < 0) { s.leavesRead.push(id); commit(); }
}

/**
 * Grille de Feuillets (8 colonnes) ; renvoie les rectangles pour la navigation.
 * sel = index sélectionné, time = pour la pulsation des non-lus.
 */
export function renderLeafGrid(ui, x, y, cols, cellW, cellH, sel, time, rects) {
  const ids = leafIds();
  rects.length = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const cx = x + (i % cols) * cellW, cy = y + Math.floor(i / cols) * cellH;
    const r = { x: cx, y: cy, w: cellW - 4, h: cellH - 4, id };
    rects.push(r);
    const open = isUnlocked(id), read = isRead(id);
    panel(ui, r.x, r.y, r.w, r.h, open ? 'parchment' : 'dark');
    if (i === sel) panel(ui, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 'bronze');
    icon(ui, open ? 'ui_lanterne' : 'ui_sceau', r.x + r.w / 2 - 8, r.y + 4, 0.5);
    text(ui, String(i + 1), r.x + r.w / 2, r.y + r.h - 11, { size: 9, align: 'center', color: open ? C.encre : C.gris });
    if (open && !read) {
      ui.globalAlpha = 0.5 + 0.5 * Math.sin(time * 5);
      ui.fillStyle = C.braise; ui.fillRect(r.x + r.w - 7, r.y + 3, 4, 4);
      ui.globalAlpha = 1;
    }
  }
}

/** Lecteur : page de parchemin avec titre et texte replié, défilement ↑↓ / molette. */
export function createLeafReader() {
  let id = 'f01', scroll = 0, lines = null, maxScroll = 0;
  const PX = 60, PY = 14, PW = W - 120, PH = H - 28, TX = PX + 18, TW = PW - 36, LH = 11, TOP = 44;
  const onWheel = (e) => { scroll = clamp(scroll + Math.sign(e.deltaY) * LH * 2); };
  function clamp(v) { return Math.max(0, Math.min(maxScroll, v)); }
  return {
    freezes: true,
    enter(p) { id = p.leafId; scroll = 0; lines = null; markRead(id); window.addEventListener('wheel', onWheel); },
    exit() { window.removeEventListener('wheel', onWheel); },
    update() { if (states.mouse.clicked && !hitPanel(states.mouse.x, states.mouse.y)) { playUi('ui_cancel'); states.pop(); } },
    handleAction(a) {
      if (a === 'menuUp') { scroll = clamp(scroll - LH); return true; }
      if (a === 'menuDown') { scroll = clamp(scroll + LH); return true; }
      if (a === 'cancel' || a === 'confirm' || a === 'pause') { playUi('ui_cancel'); states.pop(); return true; }
      return false;
    },
    render(ui) {
      dimmer(ui, W, H, 0.85, states.rampOf('leaf'));
      panel(ui, PX, PY, PW, PH, 'parchment');
      const n = leafIds().indexOf(id) + 1;
      text(ui, t('ui.altar.leaf_number', { n }), TX, PY + 8, { size: 9, color: C.encreClaire });
      heading(ui, t('lore.' + id + '.title'), W / 2, PY + 14, 16);
      if (!lines) { lines = wrap(ui, t('lore.' + id + '.text'), TW, 'ui', 10); maxScroll = Math.max(0, lines.length * LH - (PH - TOP - 28)); }
      ui.save(); ui.beginPath(); ui.rect(PX + 4, PY + TOP, PW - 8, PH - TOP - 26); ui.clip();
      for (let i = 0; i < lines.length; i++) text(ui, lines[i], TX, PY + TOP + i * LH - scroll, { size: 10, color: C.encre });
      ui.restore();
      text(ui, t('ui.altar.read_hint'), W / 2, PY + PH - 22, { size: 8, align: 'center', color: C.encreClaire });
      if (maxScroll > 0) {
        const trackH = PH - TOP - 16, knob = Math.max(10, trackH * (trackH / (trackH + maxScroll)));
        ui.fillStyle = C.bronze; ui.fillRect(PX + PW - 10, PY + TOP + (trackH - knob) * (scroll / maxScroll), 3, knob);
      }
    },
  };
  function hitPanel(x, y) { return x >= PX && x < PX + PW && y >= PY && y < PY + PH; }
}
