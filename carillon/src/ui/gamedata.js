// ui/gamedata.js — lecture des JSON de src/data/ pour l'interface (hub, codex,
// bilan). Indépendant de src/game/data.js : le hub et le codex fonctionnent
// même si le gameplay n'est pas chargé. Aucune valeur n'est interprétée ici,
// seulement lue et indexée par id. `start-weapons` et `waves` sont des objets (règles des
// Timbres de départ ; vagues par paroisse, lues pour les Moments et la difficulté), les autres
// fichiers sont des listes. `contracts` = contrats de nuit (vague 2).

const FILES = ['characters', 'parishes', 'upgrades', 'lore', 'achievements', 'weapons', 'passives', 'fusions', 'enemies', 'start-weapons', 'relics', 'contracts', 'waves'];
const OBJECT_FILES = { 'start-weapons': true, waves: true };
const data = { loaded: false };
for (const f of FILES) data[f] = OBJECT_FILES[f] ? {} : [];
const byId = {};
let base = 'src/data/';

export function setUiDataBase(url) { base = url.endsWith('/') ? url : url + '/'; }

/** Charge (une fois) les fichiers de données utiles à l'interface. */
export async function loadUiData() {
  if (data.loaded) return data;
  await Promise.all(FILES.map(async (name) => {
    try {
      const res = await fetch(base + name + '.json');
      if (!res.ok) throw new Error(res.status);
      const arr = await res.json();
      data[name] = OBJECT_FILES[name] ? (arr && typeof arr === 'object' ? arr : {}) : (Array.isArray(arr) ? arr : []);
    } catch (e) { console.warn('[ui/gamedata]', name, e); data[name] = OBJECT_FILES[name] ? {} : []; }
    const map = new Map();
    if (Array.isArray(data[name])) for (const d of data[name]) if (d && d.id) map.set(d.id, d);
    byId[name] = map;
  }));
  data.loaded = true;
  return data;
}

export function list(name) { return data[name] || []; }
export function def(name, id) { return byId[name] ? byId[name].get(id) : undefined; }
export const characters = () => data.characters;
export const parishes = () => data.parishes;
export const upgrades = () => data.upgrades;
export const lore = () => data.lore;
export const achievements = () => data.achievements;
export const weapons = () => data.weapons;
export const passives = () => data.passives;
export const fusions = () => data.fusions;
export const enemies = () => data.enemies;
export const relics = () => data.relics;
export const startWeaponRules = () => data['start-weapons'];
export const contracts = () => data.contracts;
export const waves = () => data.waves;
/** Vague d'une paroisse (waves.json) ou null. */
export function waveOf(parishId) { const w = data.waves && data.waves[parishId]; return w && typeof w === 'object' ? w : null; }
