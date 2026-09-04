// game/data.js — chargement et accès aux données d'équilibrage (ARCHITECTURE.md § 10).
// Sous-module du périmètre game/ : main.js appelle `await loadGameData()` avant toute
// création de run ; ensuite les modules de gameplay lisent les définitions ici.
// Aucun nombre d'équilibrage n'est codé en dur : tout vient de src/data/*.json
// (le bloc `balance` de waves.json regroupe les constantes globales de gameplay).

const FILES = ['weapons', 'passives', 'fusions', 'enemies', 'waves', 'parishes', 'characters', 'upgrades', 'achievements', 'lore'];

const data = {
  weapons: new Map(), passives: new Map(), fusions: new Map(), enemies: new Map(),
  parishes: new Map(), characters: new Map(), upgrades: new Map(),
  achievements: [], lore: [], waves: {}, balance: null, loaded: false,
};

let baseUrl = 'src/data/';

/** Définit le dossier des JSON (défaut : relatif à la page, 'src/data/'). */
export function setDataBase(url) { baseUrl = url.endsWith('/') ? url : url + '/'; }

async function fetchJson(name, optional) {
  const res = await fetch(baseUrl + name + '.json');
  if (!res.ok) {
    if (optional) return null;
    throw new Error('data ' + name + ' introuvable (' + res.status + ')');
  }
  return res.json();
}

function toMap(map, arr) {
  map.clear();
  if (!Array.isArray(arr)) return;
  for (let i = 0; i < arr.length; i++) map.set(arr[i].id, arr[i]);
}

/** Charge tous les JSON de gameplay (une seule fois). `override` permet aux tests d'injecter des objets. */
export async function loadGameData(override = null) {
  const raw = {};
  for (let i = 0; i < FILES.length; i++) {
    const name = FILES[i];
    raw[name] = override && override[name] ? override[name] : await fetchJson(name, name === 'lore');
  }
  toMap(data.weapons, raw.weapons);
  toMap(data.passives, raw.passives);
  toMap(data.fusions, raw.fusions);
  toMap(data.enemies, raw.enemies);
  toMap(data.parishes, raw.parishes);
  toMap(data.characters, raw.characters);
  toMap(data.upgrades, raw.upgrades);
  data.achievements = raw.achievements || [];
  data.lore = raw.lore || [];
  data.waves = raw.waves || {};
  data.balance = data.waves.balance;
  if (!data.balance) throw new Error('waves.json : bloc balance manquant');
  data.loaded = true;
  return data;
}

export function isLoaded() { return data.loaded; }
export function balance() { return data.balance; }
export function weaponDef(id) { return data.weapons.get(id); }
export function passiveDef(id) { return data.passives.get(id); }
export function fusionDef(id) { return data.fusions.get(id); }
export function enemyDef(id) { return data.enemies.get(id); }
export function parishDef(id) { return data.parishes.get(id); }
export function characterDef(id) { return data.characters.get(id); }
export function upgradeDef(id) { return data.upgrades.get(id); }
export function waveDef(parishId) { return data.waves[parishId]; }
export function allWeapons() { return data.weapons; }
export function allPassives() { return data.passives; }
export function allFusions() { return data.fusions; }
export function allEnemies() { return data.enemies; }
export function allParishes() { return data.parishes; }
export function allCharacters() { return data.characters; }
export function allUpgrades() { return data.upgrades; }
export function achievementDefs() { return data.achievements; }
export function loreDefs() { return data.lore; }

/** Fusion dont l'arme et l'accord correspondent (ou undefined). */
export function fusionFor(weaponId, passiveId) {
  for (const f of data.fusions.values()) if (f.weapon === weaponId && f.passive === passiveId) return f;
  return undefined;
}
