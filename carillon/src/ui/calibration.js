// ui/calibration.js — écran « Calibration de latence » (empilable depuis les options) : le woodblock du
// métronome bat sur la Mesure, le joueur tape Espace (ou Volée / un toucher) sur 8 temps ; on mesure
// l'écart brut de chaque frappe au temps le plus proche (temps audio de l'entrée, input:action) et on
// affiche la médiane (> 0 = en retard). « Appliquer » écrit options.latencyMs (setOption → main.js →
// conductor.setInputLatencyMs si le cœur l'expose, § 8 bis). Fige la logique ; la musique continue.

import { bus } from '../core/events.js';
import * as conductor from '../audio/conductor.js';
import { playUi } from '../audio/sfx.js';
import { t } from './i18n.js';
import * as states from './states.js';
import { isActive as touchActive } from './touch.js';
import { getBindings, hasGamepad } from '../core/input.js';
import { keyName, setOption, getOption } from './options-items.js';
import { startMetronome, stopMetronome, metronomeRunning } from './metronome.js';
import { toast } from './toasts.js';
import { panel, text, paragraph, button, hit, backdrop, heading, keycap, C } from './widgets.js';

const W = 480, H = 270;
const TAPS = 8, MIN_MS = -150, MAX_MS = 150;
const AREA = { x: 60, y: 26, w: 360, h: 218 };
const ACTIONS = { dash: true, confirm: true, parry: true };

export function createCalibration() {
  const samples = [];
  let median = 0, wasRunning = false, unsub = null, flashT = 0, lastBeat = -1;
  const applyRect = { x: AREA.x + 24, y: AREA.y + AREA.h - 32, w: 110, h: 20 };
  const retryRect = { x: AREA.x + AREA.w / 2 - 50, y: AREA.y + AREA.h - 32, w: 100, h: 20 };
  const backRect = { x: AREA.x + AREA.w - 134, y: AREA.y + AREA.h - 32, w: 110, h: 20 };
  const done = () => samples.length >= TAPS;
  let focus = 0;   // 0 appliquer · 1 recommencer · 2 retour

  /** Écart brut (ms) d'un temps audio au point de grille le plus proche (sans la latence déjà réglée). */
  function rawOffset(at) {
    if (!conductor.isRunning()) return null;
    const bd = conductor.beatDuration();
    const bf = (at - conductor.startAt()) / bd;
    return (bf - Math.round(bf)) * bd * 1000;
  }

  function onInput(e) {
    if (!e.pressed || !ACTIONS[e.action] || done()) return;
    const off = rawOffset(e.at);
    if (off === null) return;
    samples.push(Math.max(MIN_MS * 2, Math.min(MAX_MS * 2, off)));
    flashT = 0.15;
    playUi('ui_move');
    if (done()) {
      const s = samples.slice().sort((a, b) => a - b);
      median = Math.round((s[3] + s[4]) / 2);
      median = Math.max(MIN_MS, Math.min(MAX_MS, median));
      playUi('ui_confirm');
    }
  }

  function apply() {
    if (!done()) return;
    setOption('latencyMs', median);
    toast({ title: t('ui.calib.title'), body: t('ui.calib.applied', { ms: median }), icon: 'ui_options' });
    playUi('ui_confirm');
    close();
  }
  function retry() { samples.length = 0; median = 0; playUi('ui_move'); }
  function close() { states.pop(); }

  return {
    freezes: true,
    opaque: true,
    enter() {
      samples.length = 0; median = 0; focus = 0; flashT = 0;
      wasRunning = metronomeRunning();
      startMetronome();
      unsub = bus.on('input:action', onInput);
      playUi('ui_confirm');
    },
    exit() {
      if (unsub) { unsub(); unsub = null; }
      if (!wasRunning) stopMetronome();
    },
    update(_, realDt) {
      if (flashT > 0) flashT -= realDt;
      const m = states.mouse;
      if (m.moved) {
        if (hit(applyRect, m.x, m.y)) focus = 0; else if (hit(retryRect, m.x, m.y)) focus = 1; else if (hit(backRect, m.x, m.y)) focus = 2;
      }
      if (m.clicked) {
        if (hit(applyRect, m.x, m.y)) apply();
        else if (hit(retryRect, m.x, m.y)) retry();
        else if (hit(backRect, m.x, m.y)) { playUi('ui_cancel'); close(); }
      }
    },
    handleAction(a) {
      if (a === 'cancel' || a === 'pause') { playUi('ui_cancel'); close(); return true; }
      if (a === 'menuLeft') { focus = (focus + 2) % 3; playUi('ui_move'); return true; }
      if (a === 'menuRight') { focus = (focus + 1) % 3; playUi('ui_move'); return true; }
      if (a === 'confirm') {
        if (!done()) return true;                      // pendant la mesure, Entrée est une frappe (input:action)
        if (focus === 0) apply(); else if (focus === 1) retry(); else { playUi('ui_cancel'); close(); }
        return true;
      }
      return false;
    },
    render(ui) {
      backdrop(ui, W, H, states.rampOf('calibration'));
      panel(ui, AREA.x, AREA.y, AREA.w, AREA.h, 'parchment');
      heading(ui, t('ui.calib.title'), W / 2, AREA.y + 6, 16);
      const key = touchActive() ? t('ui.touch.dash') : hasGamepad() ? t('ui.tutorial.pad_dash') : (getBindings().dash && getBindings().dash.keys.length ? keyName(getBindings().dash.keys[0]) : t('ui.tutorial.press_dash'));
      paragraph(ui, t(touchActive() ? 'ui.calib.intro_touch' : 'ui.calib.intro', { key }), AREA.x + 20, AREA.y + 30, AREA.w - 40, { size: 9, color: C.encre, lineHeight: 10, maxLines: 3 });
      // Anneau du temps : se referme sur le temps, éclair quand une frappe est prise.
      const phase = conductor.isRunning() ? conductor.phase() : 0, pulse = Math.pow(1 - phase, 2);
      const beat = conductor.isRunning() ? conductor.beatIndex() : 0;
      if (beat !== lastBeat) lastBeat = beat;
      const cx = W / 2, cy = AREA.y + 104;
      ui.strokeStyle = flashT > 0 ? C.clair : C.bronze; ui.lineWidth = 2 + pulse * 2; ui.globalAlpha = 0.35 + 0.65 * pulse;
      ui.beginPath(); ui.arc(cx, cy, 14 + 22 * (1 - pulse), 0, Math.PI * 2); ui.stroke();
      ui.globalAlpha = 1;
      ui.fillStyle = flashT > 0 ? C.clair : C.bronze; ui.beginPath(); ui.arc(cx, cy, 5 + pulse * 3, 0, Math.PI * 2); ui.fill();
      if (!touchActive()) keycap(ui, key, cx, cy + 46, { size: 8, align: 'center', hot: pulse > 0.7, dark: true });
      // 8 points : remplis au fur et à mesure, avec l'écart de chaque frappe en dessous (fin trait signé).
      const px0 = cx - (TAPS - 1) * 14 / 2;
      for (let i = 0; i < TAPS; i++) {
        const x = px0 + i * 14, y = AREA.y + 138;
        ui.fillStyle = i < samples.length ? C.bronze : C.gris; ui.globalAlpha = i < samples.length ? 1 : 0.4;
        ui.beginPath(); ui.arc(x, y, 3.5, 0, Math.PI * 2); ui.fill(); ui.globalAlpha = 1;
        if (i < samples.length) { const o = Math.max(-40, Math.min(40, samples[i])) / 40 * 6; ui.fillStyle = C.encreClaire; ui.fillRect(Math.round(x + Math.min(0, o)), y + 7, Math.max(1, Math.round(Math.abs(o))), 2); }
      }
      text(ui, t('ui.calib.progress', { done: samples.length, total: TAPS }), cx, AREA.y + 152, { size: 8, align: 'center', color: C.encreClaire });
      const cur = getOption('latencyMs') || 0;
      if (done()) {
        const dir = median > 8 ? t('ui.calib.late') : median < -8 ? t('ui.calib.early') : t('ui.calib.on_time');
        text(ui, t('ui.calib.result', { ms: median }), cx, AREA.y + 164, { kind: 'display', size: 14, align: 'center', color: C.bronze });
        text(ui, dir, cx, AREA.y + 180, { size: 8, align: 'center', color: C.encre });
      } else text(ui, t('ui.calib.current', { ms: cur }), cx, AREA.y + 168, { size: 8, align: 'center', color: C.encreClaire });
      button(ui, { ...applyRect, label: t('ui.calib.apply', { ms: median }), size: 9, focused: focus === 0 && done(), disabled: !done() });
      button(ui, { ...retryRect, label: t('ui.calib.retry'), size: 9, focused: focus === 1 && done(), disabled: samples.length === 0 });
      button(ui, { ...backRect, label: t('ui.common.back'), size: 9, focused: focus === 2 || !done() });
    },
  };
}
