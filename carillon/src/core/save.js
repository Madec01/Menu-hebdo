// core/save.js — sauvegarde persistante dans localStorage 'carillon.save'
// (ARCHITECTURE.md § 6). Schéma versionné ; loadSave() migre les anciennes
// versions en complétant les champs manquants depuis les valeurs par défaut.
// Les modules mutent getSave() puis appellent commit(), qui émet save:changed.
// v2 : `unlocked.weapons` = Timbres de départ débloqués (niveau max en run ou achat
// en Bronze) et `lastWeaponByCharacter` = { sonneur: Timbre choisi } (hub).
// v3 (vague 2, méta) : `sourdine` { unlocked: { paroisse: 1..5 }, chosen: { paroisse: 1..5 } } ;
// `records` { parish: { id: { bestTime, bestLevel, bestKills, bestSourdine, wins, seed, character } },
//   character: { id: {…} }, vigil: { paroisse: secondes tenues après l'aube } } ;
// `daily` { board: [ { date, score, parish, character, victory, time } ] (5 max) } ;
// `leavesPending` = Feuillets dont la condition est remplie mais retenus par le plafond de 2 par nuit ;
// `battantSeen` = répliques du Battant déjà dites ; `ending` { seen, muet } ;
// `stats.contracts` { offered, accepted, done }, `stats.deathsByCharacter`, `stats.tierHold` (record de
// secondes d'affilée au cran 3 : quête du Muet). Une sauvegarde v1/v2 reste valide : tout est complété.

import { bus } from './events.js';

export const SAVE_VERSION = 3;
const STORAGE_KEY = 'carillon.save';

/** Valeurs par défaut du schéma courant (source unique de vérité). */
function defaults() {
  return {
    version: SAVE_VERSION,
    bronze: 0,
    seedManual: null,
    unlocked: {
      characters: ['wren'], weapons: ['battant'], upgrades: [], leaves: [],
      achievements: [], fusions: [], parishes: ['cendrelune'],
    },
    codex: { enemies: {}, bosses: {} },
    stats: {
      runs: 0, wins: 0, kills: 0, bestTime: 0, bestResonance: 0, bellAnswers: 0,
      contracts: { offered: 0, accepted: 0, done: 0 }, deathsByCharacter: {}, tierHold: 0,
    },
    options: {
      lang: 'fr', volMaster: 0.8, volMusic: 0.8, volSfx: 0.9, shake: 1, particles: 1,
      reduceFlash: false, fullscreen: false, scale: 0, beatIndicator: 'both', assist: 'none',
      showFps: false, bindings: {},
    },
    tutorialDone: false,
    lastParish: null,
    lastCharacter: null,
    lastWeaponByCharacter: {},
    sourdine: { unlocked: {}, chosen: {} },
    records: { parish: {}, character: {}, vigil: {} },
    daily: { board: [] },
    leavesPending: [],
    battantSeen: [],
    ending: { seen: false, muet: false },
  };
}

let current = null;

function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

// Fusion récursive : les champs de `src` écrasent `base` quand leur type est compatible.
function mergeInto(base, src) {
  if (!isObject(src)) return base;
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (isObject(base[k]) && isObject(v)) mergeInto(base[k], v);
    else if (Array.isArray(base[k])) { if (Array.isArray(v)) base[k] = v.slice(); }
    else if (base[k] === undefined || typeof base[k] === typeof v || base[k] === null || v === null) base[k] = v;
  }
  return base;
}

/** Migre un objet brut (toute version) vers le schéma courant. */
function migrate(raw) {
  const save = defaults();
  if (!isObject(raw)) return save;
  // v0 (sans version) et v1 partagent la même forme : compléter suffit.
  mergeInto(save, raw);
  // v1 → v2 : Timbres de départ. `unlocked.weapons` existait déjà (jamais lu avant la v2) mais
  // pouvait être vide ou absent ; `lastWeaponByCharacter` est nouveau (valeur par défaut : {}).
  if (!(raw.version >= 2)) {
    if (!Array.isArray(save.unlocked.weapons)) save.unlocked.weapons = [];
    if (save.unlocked.weapons.indexOf('battant') < 0) save.unlocked.weapons.unshift('battant');
    if (!isObject(save.lastWeaponByCharacter)) save.lastWeaponByCharacter = {};
  }
  // v2 → v3 : méta (Sourdine, records, contrats, Battant). Les nouveaux blocs viennent des défauts ;
  // on reconstruit ce qui peut l'être depuis les stats existantes : une paroisse déjà gagnée ouvre la
  // Sourdine II, et les Feuillets déjà retrouvés restent acquis (jamais repris).
  if (!(raw.version >= 3)) {
    const wins = (save.stats && save.stats.winsByParish) || {};
    for (const pid of Object.keys(wins)) if (wins[pid] > 0 && !(save.sourdine.unlocked[pid] >= 2)) save.sourdine.unlocked[pid] = 2;
    for (const pid of Object.keys(save.sourdine.chosen)) if (!(save.sourdine.chosen[pid] >= 1)) delete save.sourdine.chosen[pid];
  }
  // Les migrations futures s'enchaînent ici : if (raw.version < 4) { … }
  save.version = SAVE_VERSION;
  return save;
}

function readStorage() {
  try {
    const txt = localStorage.getItem(STORAGE_KEY);
    return txt ? JSON.parse(txt) : null;
  } catch (e) {
    console.warn('[save] lecture impossible, valeurs par défaut', e);
    return null;
  }
}

function writeStorage(save) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); return true; }
  catch (e) { console.warn('[save] écriture impossible', e); return false; }
}

/** Charge (et migre) la sauvegarde depuis localStorage ; devient l'instance courante. */
export function loadSave() {
  const raw = readStorage();
  current = migrate(raw);
  if (!raw || raw.version !== SAVE_VERSION) writeStorage(current);
  return current;
}

/** Instance courante (mutable). Charge à la demande. */
export function getSave() {
  if (!current) loadSave();
  return current;
}

/** Sérialise l'instance courante et émet save:changed. */
export function commit() {
  const save = getSave();
  writeStorage(save);
  bus.emit('save:changed', { save });
}

/** JSON lisible de la sauvegarde courante (export utilisateur). */
export function exportSave() {
  return JSON.stringify(getSave(), null, 2);
}

/**
 * Importe un JSON ; renvoie { ok, error }. `error` est un code (pas une phrase) :
 * 'invalid_json' | 'invalid_shape' | 'newer_version'. L'import remplace la sauvegarde.
 */
export function importSave(json) {
  let raw;
  try { raw = typeof json === 'string' ? JSON.parse(json) : json; }
  catch (e) { return { ok: false, error: 'invalid_json' }; }
  if (!isObject(raw) || !isObject(raw.unlocked) || !isObject(raw.options)) return { ok: false, error: 'invalid_shape' };
  if (typeof raw.version === 'number' && raw.version > SAVE_VERSION) return { ok: false, error: 'newer_version' };
  current = migrate(raw);
  commit();
  return { ok: true, error: null };
}

/** Remet la sauvegarde à zéro (les options sont conservées). */
export function resetSave() {
  const options = getSave().options;
  current = defaults();
  current.options = options;
  commit();
}

/** Valeurs par défaut (copie neuve) pour l'écran d'options. */
export function defaultSave() { return defaults(); }
