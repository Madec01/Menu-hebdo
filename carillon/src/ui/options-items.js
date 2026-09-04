// ui/options-items.js — définition déclarative des lignes de l'écran d'options :
// sections, curseurs, choix cycliques, interrupteurs, liaisons de touches,
// actions. Chaque changement est écrit dans save.options, commité, puis annoncé
// par options:change (main.js applique). Les volumes sont appliqués par audio.js.

import { bus } from '../core/events.js';
import { getSave, commit } from '../core/save.js';
import { ACTIONS, getBindings, hasGamepad } from '../core/input.js';
import { t, has } from './i18n.js';

const pct = (v) => t('ui.options.percent', { value: Math.round(v * 100) });

/** Libellé lisible d'un KeyboardEvent.code ou 'MouseN'. */
export function keyName(code) {
  if (!code) return t('ui.options.key_none');
  const k = 'ui.options.key_' + code;
  if (has(k)) return t(k);
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

export function getOption(key) { return getSave().options[key]; }

/** Construit la liste des lignes (fonctions de libellé pour suivre la langue). */
export function buildItems(handlers) {
  const items = [];
  const section = (id) => items.push({ type: 'section', label: () => t('ui.options.section_' + id) });
  const slider = (key, labelKey, fmt = pct, step = 0.05) => items.push({ type: 'slider', key, label: () => t('ui.options.' + labelKey), value: () => fmt(getOption(key)), step,
    adjust(d) { const v = Math.round(Math.max(0, Math.min(1, getOption(key) + d * step)) * 100) / 100; setOption(key, v); } });
  const choice = (key, labelKey, values, labelOf, note = null) => items.push({ type: 'choice', key, label: () => t('ui.options.' + labelKey), value: () => labelOf(getOption(key)), note,
    adjust(d) { const i = Math.max(0, values.indexOf(getOption(key))); setOption(key, values[(i + d + values.length) % values.length]); } });
  const toggle = (key, labelKey, onChange = null) => items.push({ type: 'toggle', key, label: () => t('ui.options.' + labelKey), value: () => t(getOption(key) ? 'ui.common.on' : 'ui.common.off'),
    adjust() { setOption(key, !getOption(key)); if (onChange) onChange(getOption(key)); } });
  const action = (labelKey, fn, valueFn = null) => items.push({ type: 'action', label: () => t('ui.options.' + labelKey), value: valueFn || (() => ''), adjust: fn });

  section('audio');
  slider('volMaster', 'vol_master'); slider('volMusic', 'vol_music'); slider('volSfx', 'vol_sfx');
  section('display');
  choice('lang', 'lang', ['fr', 'en'], (v) => t('ui.options.lang_' + v));
  choice('scale', 'scale', [0, 2, 3, 4], (v) => (v ? t('ui.options.scale_n', { n: v }) : t('ui.options.scale_auto')));
  toggle('fullscreen', 'fullscreen');
  slider('shake', 'shake'); slider('particles', 'particles');
  toggle('reduceFlash', 'reduce_flash');
  toggle('showFps', 'show_fps');
  section('game');
  choice('beatIndicator', 'beat_indicator', ['both', 'visual', 'audio', 'none'], (v) => t('ui.options.beat_' + v));
  choice('assist', 'assist', ['none', 'assisted', 'norhythm'], (v) => t('ui.options.assist_' + v), () => t('ui.options.assist_note'));
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
