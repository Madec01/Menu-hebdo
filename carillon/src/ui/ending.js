// ui/ending.js — scène de fin (vague 2) : écran de base 'ending' posé par run-screen.js après le boss du
// Beffroi Mère (RunStats.ending), sur la musique de victoire. Texte défilant sur parchemin : le registre de
// Cendrelune, le nom du maître, les sonneurs tombés lus dans la sauvegarde (save.stats.deathsByCharacter),
// puis la lettre finale ; fin alternative avec Le Muet (il pose le Diapason : trois paragraphes ending.muet_*).
// Entrée / clic accélère puis termine ; à la fin, les crédits s'enchaînent, puis le bilan.
// enter({ stats, params, killer, offsetAvgMs, muet }) — les paramètres du bilan sont transmis tels quels.
// Débogage / tests : window.carillon.states.replace('ending', { stats: {...}, muet: true }).

import { getSave } from '../core/save.js';
import { bus } from '../core/events.js';
import * as renderer from '../render/renderer.js';
import * as camera from '../render/camera.js';
import * as lighting from '../render/lighting.js';
import * as music from '../audio/music.js';
import { isDown } from '../core/input.js';
import { t, has } from './i18n.js';
import { characters } from './gamedata.js';
import * as states from './states.js';
import { panel, text, wrap, C } from './widgets.js';

const W = 480, H = 270;
const PX = 48, PY = 10, PW = W - 96, PH = H - 20, TX = PX + 20, TW = PW - 40, LH = 12;
const SPEED = 14, FAST = 70, HOLD_END = 2.5;

/** Paragraphes de la fin (clés ending.*), selon le sonneur et la sauvegarde. */
export function endingParagraphs(muet) {
  const s = getSave();
  const out = [];
  const push = (k, params) => { if (has(k)) out.push(t(k, params || null)); };
  push('ending.register_title');
  push('ending.register');
  push('ending.master');
  // Les sonneurs tombés : chaque sonneur mort au moins une fois, avec son compte de nuits perdues.
  const deaths = (s.stats && s.stats.deathsByCharacter) || {};
  const fallen = characters().filter((c) => deaths[c.id] > 0);
  if (fallen.length) {
    push('ending.fallen_title');
    for (const c of fallen) push('ending.fallen_line', { name: t(c.name), count: deaths[c.id] });
  } else push('ending.fallen_none');
  push('ending.nights', { runs: s.stats.runs, wins: s.stats.wins });
  if (muet) { push('ending.muet_1'); push('ending.muet_2'); push('ending.muet_3'); }
  else { push('ending.letter_1'); push('ending.letter_2'); }
  push('ending.last_line');
  return out;
}

export function createEnding(deps) {
  let params = null, lines = [], y = 0, total = 0, done = false, holdT = 0, chained = false;

  function build(ctx) {
    const paras = endingParagraphs(!!(params && params.muet));
    const out = [];
    for (let i = 0; i < paras.length; i++) {
      const isTitle = i === 0;
      for (const l of wrap(ctx, paras[i], TW, isTitle ? 'display' : 'ui', isTitle ? 14 : 10)) out.push({ text: l, title: isTitle });
      out.push({ text: '', title: false });
    }
    return out;
  }

  function toResults() {
    if (chained) return;
    chained = true;
    const p = params || {};
    states.replace('results', { victory: true, stats: p.stats || {}, params: p.params || null, killer: '', offsetAvgMs: p.offsetAvgMs || 0 }, { sound: null });
  }

  function onCreditsClosed(e) { if (e.screen === 'credits' && done) toResults(); }
  let unsub = null;

  function renderWorld(ctx) {
    camera.snap(0, 0);
    renderer.setAshes(0.15); renderer.setFog(0.4); renderer.setVignette(0.45);
    lighting.setAmbient('#2a241c');
    ctx.fillStyle = '#1a1610'; ctx.fillRect(-W / 2, -H / 2, W, H);
    lighting.addLight(0, -20, 340, '#c9973f', 0.7, 0.05);
  }

  return {
    enter(p) {
      params = p || {}; lines = []; y = PH - 20; total = 0; done = false; holdT = 0; chained = false;
      if (music.current() !== 'victory') music.loadTrack('victory').then(() => music.play('victory', { layers: 2, fadeSec: 1.5 })).catch(() => {});
      unsub = bus.on('ui:close', onCreditsClosed);
    },
    exit() { if (unsub) unsub(); unsub = null; },
    update(_, realDt) {
      if (chained) return;
      const m = states.mouse;
      const fast = isDown('menuDown') || isDown('down') || isDown('confirm') || m.down;
      if (!done) {
        y -= (fast ? FAST : SPEED) * realDt;
        if (total > 0 && y < PH - 30 - total) { done = true; y = PH - 30 - total; }
      } else {
        holdT += realDt;
        if (holdT >= HOLD_END && !states.has('credits')) states.push('credits');
      }
      if (m.clicked && !done) { y = Math.max(y - 60, total > 0 ? PH - 30 - total : y); }
    },
    handleAction(a) {
      if (a === 'cancel') { if (!done) { done = true; y = PH - 30 - total; } else toResults(); return true; }
      if (a === 'confirm' && done) { if (states.has('credits')) return false; toResults(); return true; }
      return false;
    },
    renderWorld,
    render(ui) {
      panel(ui, PX, PY, PW, PH, 'parchment');
      if (!lines.length) { lines = build(ui); total = lines.length * LH; }
      ui.save(); ui.beginPath(); ui.rect(PX + 6, PY + 8, PW - 12, PH - 16); ui.clip();
      let cy = PY + y;
      for (const l of lines) {
        if (cy > PY - LH && cy < PY + PH && l.text) text(ui, l.text, l.title ? W / 2 : TX, cy, l.title ? { kind: 'display', size: 14, align: 'center', color: C.bronze } : { size: 10, color: C.encre });
        cy += LH;
      }
      ui.restore();
      text(ui, t(done ? 'ui.ending.hint_done' : 'ui.ending.hint'), W / 2, H - 9, { size: 8, align: 'center', color: C.gris, shadow: true });
    },
  };
}
