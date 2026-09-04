// ui/credits.js — écran de crédits défilant : chaque auteur et licence lus
// dans les sections `credits` des deux manifestes (assets/manifest.json et
// assets/audio/manifest.json), polices, musique originale, fabrication. ↓
// accélère, Échap revient. Écran empilable.

import { playUi } from '../audio/sfx.js';
import { isDown } from '../core/input.js';
import { t } from './i18n.js';
import * as states from './states.js';
import { text, wrap, backdrop, C } from './widgets.js';

const W = 480, H = 270;
const SPEED = 18, FAST = 90, LINE = 11, COL_W = 400, COL_X = 40;

export function createCredits(deps) {
  let lines = [], y = H, total = 0;

  /** Construit la liste des lignes { text, style } à partir des manifestes. */
  function build(ctx) {
    const out = [];
    const push = (str, style) => out.push({ text: str, style });
    const para = (str, style, size) => { for (const l of wrap(ctx, str, COL_W, style.kind || 'ui', size)) push(l, style); };
    const head = (str) => { push('', {}); push(str, { kind: 'display', size: 16, color: C.bronze }); push('', {}); };
    const entry = (c) => {
      push(c.title || '', { size: 10, color: C.clair });
      if (c.authors && c.authors.length) para(t('ui.credits.by', { authors: c.authors.join(', ') }), { size: 9, color: C.os }, 9);
      if (c.license) para(t('ui.credits.license', { license: c.license }), { size: 8, color: C.gris }, 8);
      if (c.source) para(t('ui.credits.source', { source: c.source }), { size: 8, color: C.gris }, 8);
      push('', {});
    };
    push('CARILLON', { kind: 'display', size: 30, color: C.bronze });
    push(t('title.tagline'), { kind: 'display', size: 13, color: C.os });
    push('', {});
    para(t('ui.credits.intro'), { size: 9, color: C.os }, 9);
    const vis = (deps.manifest && deps.manifest.credits) || {};
    const fontsIds = new Set(Object.values((deps.manifest && deps.manifest.fonts) || {}).map((f) => f.credit));
    head(t('ui.credits.section_visual'));
    for (const id of Object.keys(vis)) if (!fontsIds.has(id)) entry(vis[id]);
    head(t('ui.credits.section_fonts'));
    for (const id of fontsIds) if (vis[id]) entry(vis[id]);
    head(t('ui.credits.section_audio'));
    const aud = (deps.audioManifest && deps.audioManifest.credits) || {};
    for (const id of Object.keys(aud)) entry(aud[id]);
    head(t('ui.credits.section_music'));
    para(t('ui.credits.music_text'), { size: 9, color: C.os }, 9);
    const tracks = (deps.audioManifest && deps.audioManifest.tracks) || {};
    for (const id of Object.keys(tracks)) if (tracks[id].title) push(tracks[id].title, { size: 9, color: C.clair });
    head(t('ui.credits.section_tools'));
    para(t('ui.credits.tools_text'), { size: 9, color: C.os }, 9);
    push('', {}); push('', {});
    push(t('ui.credits.thanks'), { kind: 'display', size: 14, color: C.bronze });
    return out;
  }

  return {
    freezes: true,
    opaque: true,
    enter() { lines = []; y = H - 70; total = 0; },
    exit() {},
    update(_, realDt) {
      const fast = isDown('menuDown') || isDown('down') || states.mouse.down;
      y -= (fast ? FAST : SPEED) * realDt;
      if (total > 0 && y < -total) y = H - 70;
      if (states.mouse.clicked && states.mouse.y < 20) { playUi('ui_cancel'); states.pop(); }
    },
    handleAction(a) {
      if (a === 'cancel' || a === 'pause' || a === 'confirm') { playUi('ui_cancel'); states.pop(); return true; }
      if (a === 'menuUp') { y = Math.min(H - 70, y + 40); return true; }
      return false;
    },
    render(ui) {
      backdrop(ui, W, H, states.rampOf('credits'));
      if (!lines.length) { lines = build(ui); total = 0; for (const l of lines) total += l.style.size ? Math.max(LINE, l.style.size + 3) : LINE; }
      let cy = y;
      for (const l of lines) {
        const h = l.style.size ? Math.max(LINE, l.style.size + 3) : LINE;
        if (cy > -20 && cy < H + 10 && l.text) text(ui, l.text, W / 2, cy, { ...l.style, align: 'center', shadow: true });
        cy += h;
      }
      // Bandes de fondu haut/bas.
      ui.fillStyle = C.suie;
      ui.globalAlpha = 0.9; ui.fillRect(0, 0, W, 14); ui.fillRect(0, H - 16, W, 16); ui.globalAlpha = 1;
      text(ui, t('ui.credits.title'), 8, 3, { kind: 'display', size: 11, color: C.bronze });
      text(ui, t('ui.credits.hint'), W - 8, H - 12, { size: 8, align: 'right', color: C.gris });
    },
  };
}
