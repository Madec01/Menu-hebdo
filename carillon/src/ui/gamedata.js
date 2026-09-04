// ui/gamedata.js — lecture des JSON de src/data/ pour l'interface (hub, codex,
// bilan). Indépendant de src/game/data.js : le hub et le codex fonctionnent
// même si le gameplay n'est pas chargé. Aucune valeur n'est interprétée ici,
// seulement lue et indexée par id.

const FILES = ['characters', 'parishes', 'upgrades', 'lore', 'achievements', 'weapons', 'passives', 'fusions', 'enemies'];
const data = { loaded: false };
for (const f of FILES) data[f] = [];
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
      data[name] = Array.isArray(arr) ? arr : [];
    } catch (e) { console.warn('[ui/gamedata]', name, e); data[name] = []; }
    const map = new Map();
    for (const d of data[name]) if (d && d.id) map.set(d.id, d);
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
