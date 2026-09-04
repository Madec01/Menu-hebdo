// audio/audio.js — moteur audio de CARILLON (contrat ARCHITECTURE.md § 8).
// Graphe : sources → (bus music → ducking | bus sfx | bus ui) → passe-bas global → master → destination.
// Tout est AudioBufferSourceNode ; aucun OscillatorNode, nulle part.
import { bus } from '../core/events.js';

const DB = (v) => Math.pow(10, v / 20);
const LOWPASS_OPEN = 20000;
const LOWPASS_CLOSED = 600;
const MAX_VOICES = 48;                    // § 13 : ≤ 48 voix simultanées

let ac = null;
let nodes = null;                          // { master, lowpass, duck, music, sfx, ui }
let assetsBase = 'assets/';                // préfixe des chemins du manifeste (relatifs à assets/)
const buffers = new Map();                 // url → AudioBuffer (décodé) ou Promise (en cours)
let activeVoices = 0;
const volumes = { master: 0.8, music: 0.8, sfx: 0.9, ui: 0.9 };
const OPTION_KEYS = { volMaster: 'master', volMusic: 'music', volSfx: 'sfx' };

/** Crée l'AudioContext (suspendu tant qu'aucun geste utilisateur), les bus et les volumes.
 *  `options` (facultatif) : l'objet `options` de la sauvegarde (volMaster, volMusic, volSfx). */
export async function initAudio({ options = null } = {}) {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  const master = ac.createGain();
  const lowpass = ac.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = LOWPASS_OPEN;
  lowpass.Q.value = 0.5;
  const duck = ac.createGain();
  const music = ac.createGain();
  const sfx = ac.createGain();
  const ui = ac.createGain();
  music.connect(duck);
  duck.connect(lowpass);
  sfx.connect(lowpass);
  ui.connect(lowpass);
  lowpass.connect(master);
  master.connect(ac.destination);
  nodes = { master, lowpass, duck, music, sfx, ui };
  if (options) {
    for (const [key, name] of Object.entries(OPTION_KEYS)) {
      if (typeof options[key] === 'number') volumes[name] = options[key];
    }
  }
  for (const name of ['master', 'music', 'sfx', 'ui']) nodes[name].gain.value = volumes[name];
  bus.on('options:change', ({ key, value }) => { if (OPTION_KEYS[key]) setVolume(OPTION_KEYS[key], value); });
  bus.on('weapon:fire', (p) => { if (p && p.big) duck(); });
  bus.on('enemy:hit', (p) => { if (p && (p.big || p.crit)) duck(); });
}

/** À appeler dans un handler de clic/touche : reprend le contexte puis annonce `audio:unlocked`. */
export async function unlock() {
  if (!ac) await initAudio();
  if (ac.state !== 'running') await ac.resume();
  bus.emit('audio:unlocked', {});
}

export function ctx() { return ac; }
export function now() { return ac ? ac.currentTime : 0; }
export function busNode(name) { return nodes ? nodes[name] : null; }

/** Volume d'un bus (0..1), lissé en 20 ms. */
export function setVolume(name, v) {
  volumes[name] = Math.max(0, Math.min(1, v));
  if (nodes && nodes[name]) nodes[name].gain.setTargetAtTime(volumes[name], ac.currentTime, 0.02);
}

/** Base des chemins d'assets ('assets/' par défaut, relatif au document). */
export function setAssetsBase(base) { assetsBase = base.endsWith('/') ? base : base + '/'; }
export function assetUrl(relPath) { return assetsBase + relPath; }

/** Charge et décode un fichier ; un seul décodage par URL, les appels concurrents partagent la promesse. */
export async function loadBuffer(url) {
  const cached = buffers.get(url);
  if (cached) return cached;
  const p = fetch(url)
    .then((r) => { if (!r.ok) throw new Error(`audio: ${url} → HTTP ${r.status}`); return r.arrayBuffer(); })
    .then((ab) => ac.decodeAudioData(ab))
    .then((buf) => { buffers.set(url, buf); return buf; })
    .catch((err) => { buffers.delete(url); throw err; });
  buffers.set(url, p);
  return p;
}

/** Buffer déjà décodé, ou undefined (les promesses en cours ne sont pas renvoyées). */
export function getBuffer(url) {
  const b = buffers.get(url);
  return b && typeof b.then !== 'function' ? b : undefined;
}

/** 0 = ouvert (20 kHz), 1 = étouffé (~600 Hz) ; courbe exponentielle, lissage 80 ms (auras de Feutre). */
export function setLowpass(amount) {
  if (!nodes) return;
  const a = Math.max(0, Math.min(1, amount));
  const f = LOWPASS_OPEN * Math.pow(LOWPASS_CLOSED / LOWPASS_OPEN, a);
  nodes.lowpass.frequency.setTargetAtTime(f, ac.currentTime, 0.08);
}

/** Ducking de la musique : −4 dB en 10 ms, retour en 250 ms. */
export function duck() {
  if (!nodes) return;
  const g = nodes.duck.gain;
  const t = ac.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(DB(-4), t + 0.01);
  g.linearRampToValueAtTime(1, t + 0.01 + 0.25);
}

/** Budget de voix (§ 13). Le sampler et sfx appellent acquireVoice() avant de créer une source
 *  et releaseVoice() à sa fin ; au-delà de 48 voix, acquireVoice() refuse. */
export function acquireVoice() {
  if (activeVoices >= MAX_VOICES) return false;
  activeVoices++;
  return true;
}
export function releaseVoice() { activeVoices = Math.max(0, activeVoices - 1); }
export function voiceCount() { return activeVoices; }
