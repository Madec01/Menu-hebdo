// ui/dom.js — champs DOM discrets posés par-dessus le canvas (seed manuelle,
// export/import de sauvegarde). Positionnés en pixels logiques convertis par
// l'échelle entière du renderer ; input.js ignore le clavier quand un champ
// a le focus (isTypingTarget). Un seul champ visible à la fois.

import * as renderer from '../render/renderer.js';

let root = null, canvas = null, current = null, onCloseCb = null;

function ensure() {
  if (!root) { root = document.getElementById('dom'); canvas = renderer.displayCanvas(); }
  return root;
}

function place(el, x, y, w, h) {
  const s = renderer.logicalSize().scale;
  el.style.left = canvas.offsetLeft + x * s + 'px';
  el.style.top = canvas.offsetTop + y * s + 'px';
  el.style.width = w * s + 'px';
  el.style.height = h * s + 'px';
  el.style.fontSize = 7 * s + 'px';
  el.style.padding = 1 * s + 'px ' + 2 * s + 'px';
}

/**
 * Champ texte une ligne. onDone(value|null) : Entrée valide, Échap annule (null), perte de focus valide.
 */
export function showInput({ x, y, w, h, value = '', placeholder = '', maxLength = 32, onDone }) {
  hideDom();
  const r = ensure();
  const el = document.createElement('input');
  el.type = 'text'; el.value = value; el.placeholder = placeholder; el.maxLength = maxLength;
  el.autocomplete = 'off'; el.spellcheck = false;
  place(el, x, y, w, h);
  let finished = false;
  const finish = (v) => { if (finished) return; finished = true; hideDom(); if (onDone) onDone(v); };
  el.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); finish(el.value); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(null); }
  });
  el.addEventListener('blur', () => finish(el.value));
  r.appendChild(el); r.hidden = false; current = el;
  setTimeout(() => el.focus(), 0);
  return el;
}

/**
 * Zone de texte multiligne (export : lecture seule, import : saisie). Ne se ferme que par hideDom() ;
 * Échap dans la zone appelle onEscape.
 */
export function showTextarea({ x, y, w, h, value = '', placeholder = '', readOnly = false, onEscape = null }) {
  hideDom();
  const r = ensure();
  const el = document.createElement('textarea');
  el.value = value; el.placeholder = placeholder; el.readOnly = readOnly; el.spellcheck = false;
  place(el, x, y, w, h);
  el.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); if (onEscape) onEscape(); }
  });
  r.appendChild(el); r.hidden = false; current = el; onCloseCb = null;
  setTimeout(() => { el.focus(); if (readOnly) el.select(); }, 0);
  return el;
}

/** Valeur du champ courant ('' si aucun). */
export function domValue() { return current ? current.value : ''; }
export function domActive() { return current !== null; }

/** Retire tout champ DOM. */
export function hideDom() {
  if (!root) ensure();
  if (current) { const el = current; current = null; el.remove(); }
  if (root) { root.innerHTML = ''; root.hidden = true; }
  if (onCloseCb) { const cb = onCloseCb; onCloseCb = null; cb(); }
}

/** Copie dans le presse-papiers ; renvoie une promesse booléenne. */
export async function copyText(str) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(str); return true; }
  } catch (e) { /* refus du navigateur : repli ci-dessous */ }
  try {
    if (current) { current.select(); return document.execCommand('copy'); }
  } catch (e) { /* rien */ }
  return false;
}
