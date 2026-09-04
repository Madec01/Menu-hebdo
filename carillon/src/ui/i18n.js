// ui/i18n.js — textes (ARCHITECTURE.md § 11). loadLang(code) charge et fusionne
// src/data/<code>.json (contenu, agent F) et src/data/ui-<code>.json (interface,
// agent E), aplatis en clés pointées. t(key, params) remplace les {param} ; une
// clé absente renvoie la clé et loggue un avertissement une seule fois.

let table = new Map();      // 'weapon.battant.name' → chaîne
let code = 'fr';
let dataBase = 'src/data/';
const warned = new Set();
const cache = new Map();    // key → tableau [morceaux littéraux, noms de paramètres] pré-découpé

/** Dossier des JSON de données (défaut : relatif à index.html). */
export function setDataBase(url) { dataBase = url.endsWith('/') ? url : url + '/'; }

function flatten(obj, prefix, out) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const key = prefix ? prefix + '.' + k : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.set(key, v);
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('i18n ' + url + ' (' + res.status + ')');
  return res.json();
}

/** Charge la langue : contenu + interface ; le second écrase le premier en cas de doublon. */
export async function loadLang(next) {
  const [content, ui] = await Promise.all([
    fetchJson(dataBase + next + '.json').catch((e) => { console.warn('[i18n]', e.message); return {}; }),
    fetchJson(dataBase + 'ui-' + next + '.json').catch((e) => { console.warn('[i18n]', e.message); return {}; }),
  ]);
  const out = new Map();
  flatten(content, '', out);
  flatten(ui, '', out);
  table = out;
  code = next;
  cache.clear();
  warned.clear();
}

/** Code de langue courant ('fr' | 'en'). */
export function lang() { return code; }

/** Vrai si la clé existe. */
export function has(key) { return table.has(key); }

// Découpe « Frappe {damage} dégâts » en ['Frappe ', 'damage', ' dégâts'] (indices impairs = paramètres).
function compile(str) {
  const parts = [];
  let last = 0;
  const re = /\{([a-zA-Z0-9_]+)\}/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    parts.push(str.slice(last, m.index));
    parts.push(m[1]);
    last = m.index + m[0].length;
  }
  parts.push(str.slice(last));
  return parts;
}

/**
 * Texte traduit. params : { nom: valeur } substitués dans les {nom}.
 * Une valeur numérique non entière est arrondie à 2 décimales.
 */
export function t(key, params = null) {
  const raw = table.get(key);
  if (raw === undefined) {
    if (!warned.has(key)) { warned.add(key); console.warn('[i18n] clé absente', key); }
    return key;
  }
  if (typeof raw !== 'string') return String(raw);
  if (!params || raw.indexOf('{') < 0) return raw;
  let parts = cache.get(key);
  if (!parts) { parts = compile(raw); cache.set(key, parts); }
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    if ((i & 1) === 0) { out += parts[i]; continue; }
    const v = params[parts[i]];
    if (v === undefined || v === null) out += '{' + parts[i] + '}';
    else if (typeof v === 'number' && !Number.isInteger(v)) out += String(Math.round(v * 100) / 100);
    else out += String(v);
  }
  return out;
}

/** Toutes les clés commençant par un préfixe (tests, codex). */
export function keysWithPrefix(prefix) {
  const out = [];
  for (const k of table.keys()) if (k.startsWith(prefix)) out.push(k);
  return out;
}

/** Formate des secondes en mm:ss. */
export function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return (m < 10 ? '0' + m : '' + m) + ':' + (r < 10 ? '0' + r : '' + r);
}
