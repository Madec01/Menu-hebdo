// ui/widgets.js — primitives d'interface dessinées sur le calque HUD (pixels
// logiques 480×270) : cadres 9-slice parchemin/bronze/suie, boutons avec focus
// clavier/manette et survol souris, jauges, cartes de missel (recto/verso,
// retournement), texte en CarillonDisplay/CarillonUi, curseur sprite, menus
// navigables. Aucune chaîne utilisateur ici : les libellés arrivent traduits.

import { drawNineSlice, drawIcon, uiDef } from '../render/atlas.js';
import { font } from '../render/fonts.js';

/** Palette de la DA (PROMPT.md § 2). */
export const C = Object.freeze({
  suie: '#16130f', tourbe: '#2a241c', mousse: '#4a5540', os: '#d8cdb4', bronze: '#c9973f',
  braise: '#e0603a', gris: '#8f8d93', clair: '#f2e6c8', encre: '#2a241c', encreClaire: '#5a4a34',
});
const FRAME = { parchment: 'frame_parchment', bronze: 'frame_bronze', dark: 'frame_dark' };
const fontCache = new Map();
const wrapCache = new Map();
let textBump = 0;   // px ajoutés à toutes les tailles de police (mode tactile sur petit écran : +1)

/** Chaîne ctx.font mémorisée. kind : 'ui' | 'display'. La taille inclut le décalage tactile. */
export function fontOf(kind, size) {
  const k = kind + (size + textBump);
  let f = fontCache.get(k);
  if (!f) { f = font(kind === 'display' ? 'CarillonDisplay' : 'CarillonUi', size + textBump); fontCache.set(k, f); }
  return f;
}

/** Décalage global des tailles de police (ui/touch.js) ; vide le cache de repliement. */
export function setTextBump(n) {
  const v = Math.max(0, n | 0);
  if (v === textBump) return;
  textBump = v; wrapCache.clear();
}
export function textBumpValue() { return textBump; }

/** Cadre 9-slice. style : 'parchment' | 'bronze' | 'dark'. */
export function panel(ctx, x, y, w, h, style = 'parchment') {
  drawNineSlice(ctx, FRAME[style] || style, x, y, w, h);
}

/** Voile sombre plein écran (pause, cartes) ; `ramp` 0..1 = fondu d'apparition (states.topAge). */
export function dimmer(ctx, w, h, alpha = 0.6, ramp = 1) {
  ctx.globalAlpha = alpha * ramp; ctx.fillStyle = C.suie; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
}

/**
 * Fond opaque des écrans empilés plein écran (arbre, autel, codex, options, crédits) : suie
 * pleine et légère vignette de tourbe, pour que rien de l'écran du dessous ne transparaisse
 * (les bords des cadres 9-slice sont partiellement transparents).
 */
export function backdrop(ctx, w, h, ramp = 1) {
  ctx.globalAlpha = ramp;
  ctx.fillStyle = C.suie; ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.9);
  g.addColorStop(0, 'rgba(42,36,28,0.55)'); g.addColorStop(1, 'rgba(22,19,15,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
}

/** Touche dessinée (capuchon) : « Espace », « A »… opts : size, minWidth, align, hot, dark. Renvoie la largeur. */
export function keycap(ctx, label, x, y, opts = EMPTY) {
  const size = opts.size || 8;
  ctx.font = fontOf('ui', size);
  const w = Math.max(opts.minWidth || 14, Math.ceil(ctx.measureText(label).width) + 8), h = size + 6;
  const px = opts.align === 'center' ? Math.round(x - w / 2) : opts.align === 'right' ? Math.round(x - w) : Math.round(x);
  const dark = !!opts.dark;   // capuchon sombre sur fond parchemin
  ctx.fillStyle = opts.hot ? C.bronze : dark ? C.encre : C.os; ctx.fillRect(px, y, w, h);
  ctx.fillStyle = opts.hot ? '#7a5620' : dark ? C.suie : C.encreClaire; ctx.fillRect(px + 1, y + h - 2, w - 2, 2);
  text(ctx, label, px + w / 2, y + h / 2 - 1, { size, align: 'center', baseline: 'middle', color: dark && !opts.hot ? C.os : C.suie });
  return w;
}

/**
 * Texte. style : { kind:'ui'|'display', size, color, align, baseline, shadow, alpha, maxWidth }.
 * Renvoie la largeur mesurée.
 */
export function text(ctx, str, x, y, style = EMPTY) {
  const size = style.size || 10;
  ctx.font = fontOf(style.kind || 'ui', size);
  ctx.textAlign = style.align || 'left';
  ctx.textBaseline = style.baseline || 'top';
  if (style.alpha !== undefined) ctx.globalAlpha = style.alpha;
  const mw = style.maxWidth || undefined;
  if (style.shadow) {
    ctx.fillStyle = typeof style.shadow === 'string' ? style.shadow : C.suie;
    ctx.fillText(str, x + 1, y + 1, mw);
  }
  ctx.fillStyle = style.color || C.os;
  ctx.fillText(str, x, y, mw);
  if (style.alpha !== undefined) ctx.globalAlpha = 1;
  return ctx.measureText(str).width;
}
const EMPTY = Object.freeze({});

/** Découpe str en lignes tenant dans maxWidth (mémorisé par police). */
export function wrap(ctx, str, maxWidth, kind = 'ui', size = 10) {
  const key = kind + (size + textBump) + '|' + maxWidth + '|' + str;
  let lines = wrapCache.get(key);
  if (lines) return lines;
  ctx.font = fontOf(kind, size);
  lines = [];
  for (const para of String(str).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    }
    lines.push(line);
  }
  if (wrapCache.size > 400) wrapCache.clear();
  wrapCache.set(key, lines);
  return lines;
}

/** Paragraphe replié ; renvoie la hauteur occupée. style comme text() + lineHeight, maxLines. */
export function paragraph(ctx, str, x, y, w, style = EMPTY) {
  const size = style.size || 10;
  const lh = style.lineHeight || Math.round(size * 1.1);
  const lines = wrap(ctx, str, w, style.kind || 'ui', size);
  const n = style.maxLines ? Math.min(lines.length, style.maxLines) : lines.length;
  for (let i = 0; i < n; i++) text(ctx, lines[i], x, y + i * lh, style);
  return n * lh;
}

/** Icône de la planche `icons` (32×32) à l'échelle voulue. */
export function icon(ctx, name, x, y, scale = 1) { drawIcon(ctx, 'icons', name, x, y, scale); }

/** Test point/rectangle. */
export function hit(r, px, py) { return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h; }

/**
 * Bouton : b = { x, y, w, h, label, focused, disabled, pressed, icon, size, align }.
 * Le focus se marque d'un cadre bronze et d'un libellé clair.
 */
export function button(ctx, b) {
  const pressed = b.pressed;
  drawNineSlice(ctx, pressed ? 'button_pressed' : 'button', b.x, b.y, b.w, b.h);
  if (b.focused && !b.disabled) drawNineSlice(ctx, 'frame_bronze', b.x - 2, b.y - 2, b.w + 4, b.h + 4);
  const size = b.size || 12;
  let tx = b.x + b.w / 2, align = 'center';
  if (b.icon && b.align !== 'left') {
    // Groupe icône + libellé centré dans le bouton.
    ctx.font = fontOf('ui', size);
    const tw = Math.min(ctx.measureText(b.label).width, b.w - 28);
    const start = Math.round(b.x + (b.w - (20 + tw)) / 2);
    icon(ctx, b.icon, start, b.y + (b.h - 16) / 2, 0.5); tx = start + 20; align = 'left';
  } else if (b.icon) { icon(ctx, b.icon, b.x + 4, b.y + (b.h - 16) / 2, 0.5); tx = b.x + 24; align = 'left'; }
  if (b.align === 'left') { tx = b.x + (b.icon ? 24 : 8); align = 'left'; }
  text(ctx, b.label, tx, b.y + b.h / 2 + (pressed ? 1 : 0), {
    size, align, baseline: 'middle', color: b.disabled ? C.gris : b.focused ? C.clair : C.os, shadow: !b.disabled, maxWidth: b.w - (b.icon ? 28 : 8),
  });
}

/**
 * Jauge horizontale dessinée à plat (les 9-slice à bords de 10 px débordaient sur les barres
 * fines) : fond suie, liseré 1 px, remplissage bronze (hot = braise, color = couleur imposée),
 * reflet 1 px, « ghost » (valeur perdue récemment, en os translucide), segments (séparateurs)
 * et libellé centré. value 0..1. opts : { hot, color, ghost, segments, label, size, alpha, border }.
 */
export function gauge(ctx, x, y, w, h, value, opts = EMPTY) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const v = value < 0 ? 0 : value > 1 ? 1 : value;
  const a = opts.alpha === undefined ? 1 : opts.alpha;
  ctx.globalAlpha = 0.82 * a; ctx.fillStyle = C.suie; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = a; ctx.fillStyle = opts.border || C.encreClaire;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  const ix = x + 1, iy = y + 1, iw = w - 2, ih = h - 2;
  if (iw > 0 && ih > 0) {
    if (opts.ghost !== undefined && opts.ghost > v) {
      ctx.globalAlpha = 0.35 * a; ctx.fillStyle = C.os; ctx.fillRect(ix, iy, Math.round(iw * Math.min(1, opts.ghost)), ih); ctx.globalAlpha = a;
    }
    const fw = v > 0 ? Math.max(1, Math.round(iw * v)) : 0;
    if (fw > 0) {
      ctx.fillStyle = opts.color || (opts.hot ? C.braise : C.bronze); ctx.fillRect(ix, iy, fw, ih);
      if (ih >= 5) { ctx.globalAlpha = 0.28 * a; ctx.fillStyle = C.clair; ctx.fillRect(ix, iy, fw, 1); ctx.globalAlpha = a; }
    }
    if (opts.segments > 1) {
      ctx.fillStyle = C.suie;
      for (let i = 1; i < opts.segments; i++) ctx.fillRect(ix + Math.round(iw * i / opts.segments), iy, 1, ih);
    }
  }
  ctx.globalAlpha = 1;
  if (opts.label) text(ctx, opts.label, x + w / 2, y + h / 2, { size: opts.size || 9, align: 'center', baseline: 'middle', color: C.clair, shadow: true, alpha: a });
}

/** Petit chevron plein (flèche) pointant vers l'angle `ang` (rad), taille s, en (x, y). */
export function chevron(ctx, x, y, ang, s, color, alpha = 1) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + c * s, y + sn * s);
  ctx.lineTo(x - c * s * 0.6 - sn * s * 0.7, y - sn * s * 0.6 + c * s * 0.7);
  ctx.lineTo(x - c * s * 0.2, y - sn * s * 0.2);
  ctx.lineTo(x - c * s * 0.6 + sn * s * 0.7, y - sn * s * 0.6 - c * s * 0.7);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Carte de missel 96×128. c = { flip 0..1 (0 = dos), focused, icon, title, kind, level, desc, isNew, scale }.
 * Le retournement écrase la carte horizontalement (cosinus) ; la face apparaît à mi-course.
 */
export function card(ctx, x, y, c) {
  const w = 96, h = 128;
  const flip = c.flip === undefined ? 1 : c.flip;
  const sx = Math.abs(Math.cos(flip * Math.PI));
  const face = flip >= 0.5;
  ctx.save();
  ctx.translate(x + w / 2, y);
  ctx.scale(sx < 0.04 ? 0.04 : sx, 1);
  const lx = -w / 2;
  if (!face) { drawNineSlice(ctx, 'card_back', lx, 0, w, h); ctx.restore(); return; }
  drawNineSlice(ctx, 'card_face', lx, 0, w, h);
  if (c.focused) drawNineSlice(ctx, 'frame_bronze', lx - 3, -3, w + 6, h + 6);
  if (c.icon) icon(ctx, c.icon, lx + w / 2 - 16, 14, 1);
  if (c.kind) text(ctx, c.kind, lx + w / 2, 6, { size: 9, align: 'center', color: C.encreClaire });
  text(ctx, c.title, lx + w / 2, 50, { kind: 'display', size: 14, align: 'center', color: C.encre, maxWidth: w - 12 });
  if (c.level) text(ctx, c.level, lx + w / 2, 66, { size: 9, align: 'center', color: c.isNew ? C.braise : C.bronze });
  if (c.desc) paragraph(ctx, c.desc, lx + 8, 75, w - 16, { size: 8, color: C.encre, lineHeight: 8, maxLines: 5 });
  ctx.restore();
}

/** Curseur sprite : kind 'pointer' | 'hand' | 'target'. */
export function drawCursor(ctx, x, y, kind = 'pointer') {
  const def = uiDef('cursor');
  const hs = def && def.hotspot ? def.hotspot : [0, 0];
  drawIcon(ctx, 'cursor', kind, Math.round(x - hs[0]), Math.round(y - hs[1]), 1);
}

/** Petit rang de points de niveau (● ○). */
export function pips(ctx, x, y, level, max, color = C.bronze) {
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < level ? color : C.gris;
    ctx.globalAlpha = i < level ? 1 : 0.5;
    ctx.fillRect(x + i * 5, y, 3, 3);
  }
  ctx.globalAlpha = 1;
}

/**
 * Menu navigable : items = [{ label():string, rect:{x,y,w,h}, action, disabled?():bool, icon? }].
 * move(d) déplace le focus (boucle) ; hover(px,py) suit la souris ; render() dessine les boutons.
 */
export function createMenu(items, opts = EMPTY) {
  const m = {
    items, index: 0, size: opts.size || 12,
    current() { return items[m.index]; },
    move(d) {
      if (!items.length) return false;
      const start = m.index;
      for (let n = 0; n < items.length; n++) {
        m.index = (m.index + d + items.length) % items.length;
        if (!(items[m.index].disabled && items[m.index].disabled())) break;
      }
      return m.index !== start;
    },
    hover(px, py) {
      for (let i = 0; i < items.length; i++) {
        if (hit(items[i].rect, px, py)) { const changed = i !== m.index; m.index = i; return changed; }
      }
      return false;
    },
    at(px, py) {
      for (let i = 0; i < items.length; i++) if (hit(items[i].rect, px, py)) return items[i];
      return null;
    },
    render(ctx) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i], r = it.rect;
        button(ctx, { x: r.x, y: r.y, w: r.w, h: r.h, label: it.label(), focused: i === m.index, disabled: it.disabled && it.disabled(), icon: it.icon, size: it.size || m.size, align: it.align });
      }
    },
  };
  return m;
}

/** Titre d'écran gravé : relief clair au-dessus, ombre suie en dessous. */
export function heading(ctx, str, x, y, size = 22, align = 'center') {
  text(ctx, str, x, y + 2, { kind: 'display', size, align, color: C.suie });
  text(ctx, str, x, y - 1, { kind: 'display', size, align, color: C.clair, alpha: 0.35 });
  text(ctx, str, x, y, { kind: 'display', size, align, color: C.bronze });
}
