// audio/sfx.js — bruitages. Variantes sans répétition immédiate, hauteur ±pitchVar, atténuation
// et panoramique par distance au joueur, limite de 6 voix par identifiant et par 100 ms (§ 13),
// `at` facultatif pour caler un son sur la grille de la Mesure. Bus 'ui' pour l'interface.
import { ctx, now, busNode, loadBuffer, getBuffer, assetUrl, acquireVoice, releaseVoice } from './audio.js';

const MAX_SAME_PER_100MS = 6;
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
  await Promise.all(urls.map(loadBuffer));
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

/** Joue un bruitage. x,y (pixels monde) : atténuation et pan par rapport au joueur. */
export function play(id, { volume = 1, pitchVar = null, x = null, y = null, bus = 'sfx', at = null } = {}) {
  const def = defs[id];
  const ac = ctx();
  if (!def || !ac || !allowed(id)) return;
  let gain = volume * (def.gain ?? 1);
  let pan = 0;
  if (x !== null && y !== null) {
    const dx = x - listener.x;
    const d = Math.hypot(dx, y - listener.y);
    if (d >= HEAR_MAX) return;
    if (d > HEAR_FULL) gain *= 1 - (d - HEAR_FULL) / (HEAR_MAX - HEAR_FULL);
    pan = Math.max(-1, Math.min(1, dx / PAN_RANGE)) * 0.8;
  }
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
export function has(id) { return Boolean(defs[id]); }
