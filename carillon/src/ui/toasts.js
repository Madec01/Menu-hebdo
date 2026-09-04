// ui/toasts.js — notifications discrètes (hauts-faits, Feuillets, fusions,
// messages d'options). File d'attente ; chaque toast glisse depuis le bord
// droit sur un cadre suie, reste ~3 s, puis s'efface. Dessiné en dernier sur
// le calque HUD, au-dessus de tout écran (main.js).

import { panel, text, icon, C } from './widgets.js';

const SHOW_SEC = 3.2, SLIDE_SEC = 0.25, W = 170, H = 30, GAP = 4, MAX_VISIBLE = 3;
const queue = [];   // { title, body, icon, t }

/** Ajoute une notification : { title, body, icon } (textes déjà traduits). */
export function toast({ title = '', body = '', icon: ic = null } = {}) {
  queue.push({ title, body, icon: ic, t: 0 });
  if (queue.length > 12) queue.shift();
}

export function updateToasts(dt) {
  const n = Math.min(MAX_VISIBLE, queue.length);
  for (let i = 0; i < n; i++) queue[i].t += dt;
  while (queue.length && queue[0].t >= SHOW_SEC) queue.shift();
}

function easeOut(v) { return 1 - (1 - v) * (1 - v); }

/** Dessine les toasts visibles (coin supérieur droit). */
export function renderToasts(ctx, w) {
  const n = Math.min(MAX_VISIBLE, queue.length);
  for (let i = 0; i < n; i++) {
    const q = queue[i];
    let k = 1;
    if (q.t < SLIDE_SEC) k = easeOut(q.t / SLIDE_SEC);
    else if (q.t > SHOW_SEC - SLIDE_SEC) k = easeOut((SHOW_SEC - q.t) / SLIDE_SEC);
    const x = Math.round(w - 4 - W * k);
    const y = 4 + i * (H + GAP);
    panel(ctx, x, y, W, H, 'dark');
    let tx = x + 8;
    if (q.icon) { icon(ctx, q.icon, x + 6, y + 7, 0.5); tx = x + 26; }
    text(ctx, q.title, tx, y + 5, { size: 9, color: C.bronze });
    text(ctx, q.body, tx, y + 15, { size: 10, color: C.os, maxWidth: W - (tx - x) - 6 });
  }
}

export function hasToasts() { return queue.length > 0; }
export function clearToasts() { queue.length = 0; }
