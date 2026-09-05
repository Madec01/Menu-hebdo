// ui/options-items.js — définition déclarative des lignes de l'écran d'options :
// sections, curseurs, choix cycliques, interrupteurs, liaisons de touches,
// actions. Chaque changement est écrit dans save.options, commité, puis annoncé
// par options:change (main.js applique). Les volumes sont appliqués par audio.js.

import { bus } from '../core/events.js';
import { getSave, commit } from '../core/save.js';
import { ACTIONS, getBindings, hasGamepad } from '../core/input.js';
import { t, has } from './i18n.js';
import { TOUCH_DEFAULTS } from './touch.js';

const pct = (v) => t('ui.options.percent', { value: Math.round(v * 100) });
let layoutMap = null;   // KeyboardLayoutMap (Chromium) : KeyW → « z » sur un clavier AZERTY

/** Charge la disposition du clavier si le navigateur l'expose (sinon les codes physiques suffisent). */
export function initKeyNames() {
  try {
    if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then((m) => { layoutMap = m; }).catch(() => {});
  } catch (e) { /* API absente */ }
}

/** Libellé lisible d'un KeyboardEvent.code ou 'MouseN'. */
export function keyName(code) {
  if (!code) return t('ui.options.key_none');
  const k = 'ui.options.key_' + code;
  if (has(k)) return t(k);
  if (layoutMap && layoutMap.has(code)) { const v = layoutMap.get(code); if (v && v.length === 1) return v.toUpperCase(); }
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

/** Texte des liaisons d'une action : « Espace / A · Bouton 0 ». */
export function bindingLabel(action) {
  const b = getBindings()[action];
  const keys = b.keys.map(keyName).join(' / ');
  const pads = b.buttons.map((n) => t('ui.options.pad_button', { n })).join(' / ');
  return keys + (pads ? ' · ' + pads : '');
}

/** Écrit une option, la commite et l'annonce. */
export function setOption(key, value) {
  const o = getSave().options;
  o[key] = value;
  commit();
  bus.emit('options:change', { key, value });
}

export function getOption(key) { const v = getSave().options[key]; return v === undefined && key in TOUCH_DEFAULTS ? TOUCH_DEFAULTS[key] : v; }

/** Échelles de pixel proposées : auto + celles qui tiennent dans la fenêtre (au moins ×2). */
function scaleValues() {
  const max = Math.max(2, Math.floor(Math.min(window.innerWidth / 480, window.innerHeight / 270)));
  return [0, 2, 3, 4].filter((v) => v === 0 || v <= max);
}

/** Construit la liste des lignes (fonctions de libellé pour suivre la langue). */
export function buildItems(handlers) {
  const items = [];
  const section = (id) => items.push({ type: 'section', label: () => t('ui.options.section_' + id) });
  const slider = (key, labelKey, fmt = pct, step = 0.05) => items.push({ type: 'slider', key, label: () => t('ui.options.' + labelKey), value: () => fmt(getOption(key)), step,
    adjust(d) { const v = Math.round(Math.max(0, Math.min(1, getOption(key) + d * step)) * 100) / 100; setOption(key, v); } });
  // values : tableau ou fonction renvoyant le tableau (échelles qui tiennent dans la fenêtre).
  const choice = (key, labelKey, values, labelOf, note = null) => items.push({ type: 'choice', key, label: () => t('ui.options.' + labelKey), value: () => labelOf(getOption(key)), note,
    adjust(d) { const vs = typeof values === 'function' ? values() : values; const i = Math.max(0, vs.indexOf(getOption(key))); setOption(key, vs[(i + d + vs.length) % vs.length]); } });
  const toggle = (key, labelKey, onChange = null, note = null) => items.push({ type: 'toggle', key, label: () => t('ui.options.' + labelKey), value: () => t(getOption(key) ? 'ui.common.on' : 'ui.common.off'), note,
    adjust() { setOption(key, !getOption(key)); if (onChange) onChange(getOption(key)); } });
  const action = (labelKey, fn, valueFn = null) => items.push({ type: 'action', label: () => t('ui.options.' + labelKey), value: valueFn || (() => ''), adjust: fn });

  section('audio');
  slider('volMaster', 'vol_master'); slider('volMusic', 'vol_music'); slider('volSfx', 'vol_sfx');
  section('display');
  choice('lang', 'lang', ['fr', 'en'], (v) => t('ui.options.lang_' + v));
  choice('scale', 'scale', scaleValues, (v) => (v ? t('ui.options.scale_n', { n: v }) : t('ui.options.scale_auto')));
  toggle('fullscreen', 'fullscreen', null, () => t('ui.options.fullscreen_note'));
  slider('shake', 'shake'); slider('particles', 'particles');
  toggle('reduceFlash', 'reduce_flash');
  toggle('showFps', 'show_fps');
  section('game');
  choice('beatIndicator', 'beat_indicator', ['both', 'visual', 'audio', 'none'], (v) => t('ui.options.beat_' + v));
  choice('assist', 'assist', ['none', 'assisted', 'norhythm'], (v) => t('ui.options.assist_' + v), () => t('ui.options.assist_note'));
  items.push({ type: 'action', label: () => t('ui.options.latency'), value: () => t('ui.options.latency_value', { ms: Math.round(getOption('latencyMs') || 0) }), note: () => t('ui.options.latency_note'), adjust: handlers.calibrate });
  section('touch');
  choice('touch', 'touch', ['auto', 'on', 'off'], (v) => t('ui.options.touch_' + v), () => t('ui.options.touch_note'));
  choice('touchSize', 'touch_size', ['small', 'normal', 'large'], (v) => t('ui.options.touch_size_' + v));
  choice('touchHand', 'touch_hand', ['right', 'left'], (v) => t('ui.options.touch_hand_' + v));
  toggle('vibrate', 'vibrate', null, () => t('ui.options.vibrate_note'));
  section('controls');
  items.push({ type: 'info', label: () => t('ui.options.gamepad'), value: () => t(hasGamepad() ? 'ui.options.gamepad_yes' : 'ui.options.gamepad_no') });
  for (const a of ACTIONS) items.push({ type: 'binding', action: a, label: () => t('ui.options.action_' + a), value: () => bindingLabel(a), adjust: () => handlers.capture(a) });
  action('bindings_reset', handlers.resetBindings);
  section('save');
  action('export', handlers.exportSave);
  action('import', handlers.importSave);
  action('reset', handlers.resetSave);
  return items;
}
