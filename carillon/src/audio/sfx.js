// audio/sfx.js — bruitages. Variantes sans répétition immédiate, hauteur ±pitchVar, atténuation
// et panoramique par distance au joueur, limite de 6 voix par identifiant et par 100 ms (§ 13),
// `at` facultatif pour caler un son sur la grille de la Mesure. Bus 'ui' pour l'interface.
// Impacts RARES : les Timbres chantent (timbres.js), les coups ne sont plus le premier plan sonore —
// au plus 1 hit_light/heavy/crit audible par temps (et par `source` = arme, si fournie), 2 morts par temps.
// Jingles (resonance_1..4, level_up, achievement, fusion, lore_unlock, victory_bell), levée `moment_start`
// et grelot `pickup` / `xp_pickup` : rejoués par le sampler sur l'accord courant (jingles.js) ; les fichiers
// du manifeste restent le repli hors partition ou avant le chargement des instruments.
import { ctx, now, busNode, loadBuffer, getBuffer, assetUrl, acquireVoice, releaseVoice, voiceCount } from './audio.js';
import { isRunning, beatIndex, beatDuration } from './conductor.js';
import * as jingles from './jingles.js';

const MAX_SAME_PER_100MS = 6;
const RARE_PER_BEAT = { hit_light: 1, hit_heavy: 1, hit_crit: 1, enemy_die: 2, enemy_die_big: 2, silence_burst: 2, silence_cry: 2, resonance_drop: 1, boss_hit: 1 };   // les anneaux du boss n'éclatent pas 16 fois par seconde
const SOFT_CAP = 40;         // budget de voix en combat : au-delà, impacts et grelots d'Échos (déjà portés par les Timbres) se taisent d'abord
const SHEDDABLE = { hit_light: 1, hit_heavy: 1, hit_crit: 1, enemy_die: 1, enemy_die_big: 1, xp_pickup: 1, pickup: 1, player_step: 1, boss_hit: 1 };
const counts = {};           // id → lectures effectives (sondes / tests : stats())
const rareSeen = new Map();  // id[:source] → { beat, n }
const HEAR_FULL = 64;        // px : pleine puissance en deçà
const HEAR_MAX = 520;        // px : silence au-delà
const PAN_RANGE = 260;       // px : pan complet à cette distance latérale

let defs = {};               // id → entrée du manifeste
const lastVariant = {};      // id → index du dernier fichier joué
const recent = {};           // id → temps (ms) des dernières lectures
const listener = { x: 0, y: 0 };
const ambiences = {};        // id → { src, gain }

/** Pré-décode tous les bruitages. `manifest` = manifeste audio complet ou sa section `sfx`. */
export async function loadSfx(manifest) {
  defs = manifest.sfx ? manifest.sfx : manifest;
  const urls = [];
  for (const e of Object.values(defs)) if (e.kind !== 'ambience') for (const f of e.files) urls.push(assetUrl(f));
  const jinglesReady = manifest.samples ? jingles.load(manifest) : Promise.resolve(false);
  await Promise.all([...urls.map(loadBuffer), jinglesReady]);
}

/** Position du joueur, pour l'atténuation/pan des sons localisés (appelé par le gameplay). */
export function setListener(x, y) { listener.x = x; listener.y = y; }

function pickFile(id) {
  const list = defs[id].files;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === lastVariant[id]) i = (i + 1) % list.length;
  lastVariant[id] = i;
  return assetUrl(list[i]);
}

function allowed(id) {
  const t = performance.now();
  const r = (recent[id] = (recent[id] || []).filter((x) => t - x < 100));
  if (r.length >= MAX_SAME_PER_100MS) return false;
  r.push(t);
  return true;
}

/** Temps courant de la Mesure (ou tranches de la durée d'un temps quand elle ne tourne pas). */
function currentBeat() {
  return isRunning() ? beatIndex() : Math.floor(performance.now() / ((beatDuration() || 0.625) * 1000));
}

/** Plafond par temps des bruitages « rares » (impacts, morts) : le premier passe, les suivants se taisent. */
function rareAllowed(id, source) {
  const max = RARE_PER_BEAT[id];
  if (!max) return true;
  const key = source ? id + ':' + source : id;
  const beat = currentBeat();
  let r = rareSeen.get(key);
  if (!r) { r = { beat, n: 0 }; rareSeen.set(key, r); }
  if (r.beat !== beat) { r.beat = beat; r.n = 0; }
  if (r.n >= max) return false;
  r.n++;
  return true;
}

/** Joue un bruitage. x,y (pixels monde) : atténuation et pan par rapport au joueur.
 *  `source` (facultatif) : identifiant de l'arme à l'origine d'un impact (plafond par temps ET par arme). */
export function play(id, { volume = 1, pitchVar = null, x = null, y = null, bus = 'sfx', at = null, source = null } = {}) {
  const def = defs[id];
  const ac = ctx();
  if (!def || !ac || !rareAllowed(id, source) || !allowed(id)) return;
  if (SHEDDABLE[id] && voiceCount() >= SOFT_CAP) return;   // la musique et les voix passent avant les coups
  counts[id] = (counts[id] || 0) + 1;
  let atten = 1;
  let pan = 0;
  if (x !== null && y !== null) {
    const dx = x - listener.x;
    const d = Math.hypot(dx, y - listener.y);
    if (d >= HEAR_MAX) return;
    if (d > HEAR_FULL) atten = 1 - (d - HEAR_FULL) / (HEAR_MAX - HEAR_FULL);
    pan = Math.max(-1, Math.min(1, dx / PAN_RANGE)) * 0.8;
  }
  // jingle sur l'accord courant (sampler) ; le fichier n'est joué qu'en repli
  if (def.jingle !== false && jingles.handles(id) && jingles.ready() && jingles.play(id, { gain: volume * atten, at, pan, bus: def.bus || bus })) return;
  const gain = volume * atten * (def.gain ?? 1);
  const buf = getBuffer(pickFile(id));
  if (!buf || !acquireVoice()) return;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const pv = pitchVar === null ? (def.pitchVar ?? 0.08) : pitchVar;
  src.playbackRate.value = 1 + (Math.random() * 2 - 1) * pv;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(g);
  let tail = g;
  if (pan) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
  tail.connect(busNode(def.bus || bus));
  src.onended = () => { releaseVoice(); src.disconnect(); g.disconnect(); if (tail !== g) tail.disconnect(); };
  src.start(at === null ? ac.currentTime : Math.max(at, ac.currentTime));
}

/** Raccourci bus 'ui'. */
export function playUi(id) { play(id, { bus: 'ui', pitchVar: 0.02 }); }

/** Ambiance bouclée (vent, pluie, feu…) : entrée en fondu ; `stopAmbience` pour l'éteindre. */
export async function playAmbience(id, { volume = 1, fadeSec = 2 } = {}) {
  const def = defs[id];
  const ac = ctx();
  if (!def || !ac || ambiences[id]) return;
  const buf = await loadBuffer(assetUrl(def.files[0]));
  if (ambiences[id]) return;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = def.loop ? def.loop[0] : 0;
  src.loopEnd = def.loop ? Math.min(def.loop[1], buf.duration) : buf.duration;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(volume * (def.gain ?? 0.5), ac.currentTime + fadeSec);
  src.connect(g);
  g.connect(busNode('sfx'));
  src.start();
  ambiences[id] = { src, g };
}

/** Nouveau volume d'une ambiance en cours (fondu). */
export function setAmbienceVolume(id, volume, fadeSec = 2) {
  const a = ambiences[id], def = defs[id];
  if (!a || !def) return;
  const t = now();
  a.g.gain.cancelScheduledValues(t);
  a.g.gain.setValueAtTime(a.g.gain.value, t);
  a.g.gain.linearRampToValueAtTime(volume * (def.gain ?? 0.5), t + fadeSec);
}

export function stopAmbience(id, fadeSec = 2) {
  const a = ambiences[id];
  if (!a) return;
  const t = now();
  a.g.gain.cancelScheduledValues(t);
  a.g.gain.setValueAtTime(a.g.gain.value, t);
  a.g.gain.linearRampToValueAtTime(0, t + fadeSec);
  a.src.stop(t + fadeSec + 0.05);
  delete ambiences[id];
}

export function stopAllAmbiences(fadeSec = 1) { for (const id of Object.keys(ambiences)) stopAmbience(id, fadeSec); }
export function activeAmbiences() { return Object.keys(ambiences); }
/** Lectures effectives par identifiant depuis le départ (sondes / tests). */
export function stats() { return { ...counts }; }
/** L'identifiant existe dans le manifeste (fichier de repli) ou comme jingle du sampler. */
export function has(id) { return Boolean(defs[id]) || (jingles.handles(id) && jingles.ready()); }
/** L'identifiant est actuellement rendu par le sampler sur l'accord courant (et non par son fichier). */
export function isJingle(id) { return jingles.handles(id) && jingles.ready() && !(defs[id] && defs[id].jingle === false); }
