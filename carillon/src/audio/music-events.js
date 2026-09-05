// audio/music-events.js — la musique écoute le jeu (§ 8 bis). Installé par music.js au premier play().
//   resonance:change {tier}          → music.setLayers(tier + 1)
//   player:inAura {depth}            → audio.setLowpass(depth)         (bus music + sfx seulement)
//   run:start {parishId}             → ambiance de la paroisse (parishes.json `ambience`) en fondu, palier 0
//   run:tier {tier}                  → music.setTier : intensité par palier, tempo +2 bpm/palier, section B dès 4
//   run:fissure {phase:'start'}      → pont de 4 mesures à la mesure suivante
//   run:boss {phase:'intro'}         → piste boss (sa section `intro` = levée de 2 mesures)
//   run:moment {id:'accalmie'}       → intensité 0,1 pendant l'accalmie, retour à 0,5
//   run:end {victory}                → arrêt de l'ambiance ; victoire → piste victory (volée, toutes couches)
//   enemy:desaccord {x, y, depth}    → music.setDetune(−30 cents × depth, x, y)
//   music:track {id}                 → menu / hub : vent léger ; bilan : silence d'ambiance
import { bus } from '../core/events.js';
import { setLowpass } from './audio.js';
import * as music from './music.js';
import * as sfx from './sfx.js';

const AMBIENCE_FADE = 2;
const PARISH_VOLUME = 1;
const MENU_VOLUME = 0.45;
const LULL_INTENSITY = 0.1, BASE_INTENSITY = 0.5;
const DETUNE_CENTS = -30;
const MENU_TRACKS = new Set(['menu', 'hub']);

let installed = false;
let parishesPromise = null;
let current = [];                          // ambiances en cours (ids)
let inRun = false;

function parishes() {
  if (!parishesPromise) parishesPromise = fetch(new URL('../data/parishes.json', import.meta.url)).then((r) => { if (!r.ok) throw new Error(`music-events: parishes HTTP ${r.status}`); return r.json(); }).catch(() => []);
  return parishesPromise;
}

/** `ambience` d'une paroisse : chaîne ('wind'), tableau (['wind', 'storm']) ou objets ({ id, volume }). */
function ambienceList(field) {
  const list = Array.isArray(field) ? field : field ? [field] : [];
  return list.map((a) => (typeof a === 'string' ? { id: a, volume: 1 } : { id: a.id, volume: a.volume ?? 1 }));
}

function setAmbiences(list, volume, fadeSec = AMBIENCE_FADE) {
  const wanted = list.map((a) => ({ id: 'ambience_' + a.id, volume: volume * a.volume })).filter((a) => sfx.has(a.id));
  for (const id of current) if (!wanted.some((a) => a.id === id)) sfx.stopAmbience(id, fadeSec);
  for (const a of wanted) {
    if (current.includes(a.id)) sfx.setAmbienceVolume(a.id, a.volume, fadeSec);
    else sfx.playAmbience(a.id, { volume: a.volume, fadeSec }).catch(() => {});
  }
  current = wanted.map((a) => a.id);
}

export function stopAmbiences(fadeSec = AMBIENCE_FADE) { setAmbiences([], 0, fadeSec); }
export function currentAmbiences() { return current.slice(); }

async function onRunStart(e) {
  inRun = true;
  music.setTier(0);
  const list = await parishes();
  if (!inRun) return;
  const p = Array.isArray(list) ? list.find((x) => x.id === (e && e.parishId)) : null;
  setAmbiences(ambienceList(p ? p.ambience : 'wind'), PARISH_VOLUME);
}

function onRunEnd(e) {
  inRun = false;
  stopAmbiences();
  if (e && e.victory) music.play('victory', { layers: 4, fadeSec: 1 }).catch(() => {});
}

function onTrack(e) {
  if (!e || inRun) return;
  if (e.id && MENU_TRACKS.has(e.id)) setAmbiences([{ id: 'wind', volume: 1 }], MENU_VOLUME, 3);
  else if (e.id) stopAmbiences(1.5);
}

export function installMusicEvents() {
  if (installed) return;
  installed = true;
  bus.on('resonance:change', ({ tier }) => music.setLayers(tier + 1));
  bus.on('player:inAura', ({ depth }) => setLowpass(depth));
  bus.on('run:start', (e) => { onRunStart(e).catch(() => {}); });
  bus.on('run:end', onRunEnd);
  bus.on('run:tier', (e) => { if (e && typeof e.tier === 'number') music.setTier(e.tier); });
  bus.on('run:fissure', (e) => { if (e && e.phase === 'start') music.requestBridge(); });
  bus.on('run:boss', (e) => { if (e && e.phase === 'intro') music.play('boss', { layers: music.layers(), fadeSec: 1 }).catch(() => {}); });
  bus.on('run:moment', (e) => {
    if (!e || e.id !== 'accalmie') return;
    music.setIntensity(e.phase === 'start' ? LULL_INTENSITY : BASE_INTENSITY);
  });
  bus.on('enemy:desaccord', (e) => { const depth = e && typeof e.depth === 'number' ? Math.max(0, Math.min(1, e.depth)) : 1; music.setDetune(DETUNE_CENTS * depth, e ? e.x : null, e ? e.y : null); });
  bus.on('music:track', onTrack);
}
