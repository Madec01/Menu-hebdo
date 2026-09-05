// ui/hud-markers.js — marqueurs du HUD (sous-module de hud.js) :
//  - flèches discrètes au bord de l'écran vers les élites (Fêlures) et le Bourdon hors champ
//    (chevron bronze pour une élite, braise et plus grand pour le boss, avec sa barre de vie miniature) ;
//  - portée du Timbre survolé (icône du build) : cercle en pointillé autour du sonneur, à l'échelle de la
//    caméra, plus le nom et le niveau en info-bulle.

import * as camera from '../render/camera.js';
import { t } from './i18n.js';
import { text, chevron, gauge, panel, icon, C } from './widgets.js';

const W = 480, H = 270;
const EDGE = 10;                 // marge du bord où les flèches se posent
const tmp = { x: 0, y: 0 };

/** Flèches vers les élites/boss vivants hors de la vue. */
export function renderOffscreen(ui, g) {
  const world = g.world;
  const items = world.enemies && world.enemies.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!e.active || e.state !== 'alive' || !(e.elite || e.boss)) continue;
    if (camera.isVisible(e.x, e.y, e.r)) continue;
    const s = camera.worldToScreen(e.x, e.y, tmp);
    const dx = s.x - W / 2, dy = s.y - H / 2;
    if (dx === 0 && dy === 0) continue;
    // Intersection du rayon centre → cible avec le rectangle intérieur (bord moins la marge).
    const hw = W / 2 - EDGE, hh = H / 2 - EDGE;
    const k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
    const px = Math.round(W / 2 + dx * k), py = Math.round(H / 2 + dy * k);
    const ang = Math.atan2(dy, dx);
    const boss = !!e.boss;
    const col = boss ? C.braise : C.bronze;
    chevron(ui, px, py, ang, boss ? 7 : 5, C.suie, 0.8);
    chevron(ui, px - Math.cos(ang), py - Math.sin(ang), ang, boss ? 6 : 4, col, 0.85);
    if (boss) {
      // Mini-jauge de vie sous la flèche, côté intérieur de l'écran.
      const bx = px - Math.cos(ang) * 14 - 10, by = py - Math.sin(ang) * 14 - 2;
      gauge(ui, bx, by, 20, 4, e.maxHp > 0 ? e.hp / e.maxHp : 0, { hot: true, border: C.tourbe, alpha: 0.9 });
    }
  }
}

/** Portée du Timbre `w` (arme du joueur : { id, def, level, stats }) autour du sonneur + info-bulle. */
export function renderWeaponRange(ui, g, w, anchor) {
  if (!w) return;
  const p = g.player;
  const s = camera.worldToScreen(p.x, p.y, tmp);
  const zoom = camera.get().zoom;
  const st = w.stats || (w.def && w.def.base) || {};
  const range = st.range || 0;   // portée effective (stats recalculées par le cœur), en px monde
  if (range > 0) {
    const r = range * zoom;
    ui.setLineDash([3, 3]); ui.strokeStyle = C.bronze; ui.lineWidth = 1; ui.globalAlpha = 0.7;
    ui.beginPath(); ui.arc(Math.round(s.x), Math.round(s.y), r, 0, Math.PI * 2); ui.stroke();
    ui.setLineDash([]);
    ui.globalAlpha = 0.12; ui.fillStyle = C.bronze;
    ui.beginPath(); ui.arc(Math.round(s.x), Math.round(s.y), r, 0, Math.PI * 2); ui.fill();
    ui.globalAlpha = 1;
  }
  // Info-bulle au-dessus de l'icône : nom, niveau, portée.
  const name = t(w.def ? w.def.name : 'weapon.' + w.id + '.name');
  const tw = 120, tx = Math.max(4, Math.min(W - tw - 4, anchor.x - 4)), ty = anchor.y - 34;
  panel(ui, tx, ty, tw, 30, 'dark');
  icon(ui, w.def && w.def.icon ? w.def.icon : w.id, tx + 4, ty + 7, 0.5);
  text(ui, name, tx + 24, ty + 5, { size: 9, color: C.bronze, maxWidth: tw - 30 });
  text(ui, t('ui.common.level_short', { level: w.level }) + (range > 0 ? ' · ' + t('ui.hud.range', { range: Math.round(range / 32 * 10) / 10 }) : ''), tx + 24, ty + 16, { size: 7, color: C.os, maxWidth: tw - 30 });
}
