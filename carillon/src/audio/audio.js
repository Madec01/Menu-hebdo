// audio/audio.js — moteur audio de CARILLON (contrat ARCHITECTURE.md § 8 et § 8 bis).
// Graphe : sources → (bus music → ducking → passe-bas | bus sfx → passe-bas | bus ui | bus voices)
//          → coupe-bas 35 Hz → limiteur doux → master → destination.
// Le passe-bas des auras de Feutre n'agit que sur la musique et les bruitages : le clic (bus `ui`) et les
// Timbres qui chantent (bus `voices`, dont le gain suit le volume « sfx ») gardent leur repère rythmique.
// Le limiteur (DynamicsCompressorNode, seuil −6 dB, ratio 12) est un traitement, jamais une source :
// tout est AudioBufferSourceNode ; aucun OscillatorNode, nulle part.
import { bus } from '../core/events.js';

const DB = (v) => Math.pow(10, v / 20);
const LOWPASS_OPEN = 20000;
const LOWPASS_CLOSED = 600;
const HIGHPASS_HZ = 35;
const MAX_VOICES = 48;                    // § 13 : ≤ 48 voix simultanées
const DUCK_DB = -4;
const DUCK_MIN_INTERVAL = 0.3;            // s : jamais deux duckings dans le même souffle

let ac = null;
let nodes = null;                          // { master, limiter, highpass, lowpass, duck, music, sfx, ui, voices }
let assetsBase = 'assets/';                // préfixe des chemins du manifeste (relatifs à assets/)
const buffers = new Map();                 // url → AudioBuffer (décodé) ou Promise (en cours)
let activeVoices = 0;
let lastDuckAt = -1;
let duckCount = 0;
const volumes = { master: 0.8, music: 0.8, sfx: 0.9, ui: 0.9 };
const OPTION_KEYS = { volMaster: 'master', volMusic: 'music', volSfx: 'sfx' };

/** Crée l'AudioContext (suspendu tant qu'aucun geste utilisateur), les bus et les volumes.
 *  `options` (facultatif) : l'objet `options` de la sauvegarde (volMaster, volMusic, volSfx). */
export async function initAudio({ options = null } = {}) {
  if (ac) return;
  ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  const master = ac.createGain();
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -6; limiter.knee.value = 4; limiter.ratio.value = 12;
  limiter.attack.value = 0.003; limiter.release.value = 0.2;
  const highpass = ac.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = HIGHPASS_HZ;
  highpass.Q.value = 0.7;
  const lowpass = ac.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = LOWPASS_OPEN;
  lowpass.Q.value = 0.5;
  const duckGain = ac.createGain();       // nœud de ducking (ne pas nommer « duck » : masquerait la fonction exportée)
  const music = ac.createGain();
  const sfx = ac.createGain();
  const ui = ac.createGain();
  const voices = ac.createGain();         // Timbres qui chantent : hors passe-bas, volume « sfx »
  music.connect(duckGain);
  duckGain.connect(lowpass);
  sfx.connect(lowpass);
  lowpass.connect(highpass);
  ui.connect(highpass);
  voices.connect(highpass);
  highpass.connect(limiter);
  limiter.connect(master);
  master.connect(ac.destination);
  nodes = { master, limiter, highpass, lowpass, duck: duckGain, music, sfx, ui, voices };
  if (options) {
    for (const [key, name] of Object.entries(OPTION_KEYS)) {
      if (typeof options[key] === 'number') volumes[name] = options[key];
    }
  }
  for (const name of ['master', 'music', 'sfx', 'ui']) nodes[name].gain.value = volumes[name];
  nodes.voices.gain.value = volumes.sfx;
  bus.on('options:change', ({ key, value }) => { if (OPTION_KEYS[key]) setVolume(OPTION_KEYS[key], value); });
  // § 8 bis : ducking uniquement sur les coups critiques et les fusions (plus jamais sur chaque tir « big »)
  bus.on('enemy:hit', (p) => { if (p && p.crit) duckNow(); });
  bus.on('weapon:fusion', () => duckNow());
}

/** À appeler dans un handler de clic/touche : reprend le contexte puis annonce `audio:unlocked`. */
export async function unlock() {
  if (!ac) await initAudio();
  if (ac.state !== 'running') await ac.resume();
  bus.emit('audio:unlocked', {});
}

export function ctx() { return ac; }
export function now() { return ac ? ac.currentTime : 0; }
/** 'master' | 'music' | 'sfx' | 'ui' | 'voices' (Timbres) | 'limiter' | 'lowpass' | 'highpass'. */
export function busNode(name) { return nodes ? nodes[name] : null; }

/** Volume d'un bus (0..1), lissé en 20 ms. Le bus des Timbres suit le volume « sfx ». */
export function setVolume(name, v) {
  volumes[name] = Math.max(0, Math.min(1, v));
  if (nodes && nodes[name]) nodes[name].gain.setTargetAtTime(volumes[name], ac.currentTime, 0.02);
  if (name === 'sfx' && nodes) nodes.voices.gain.setTargetAtTime(volumes.sfx, ac.currentTime, 0.02);
}
export function volume(name) { return volumes[name]; }

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

/** 0 = ouvert (20 kHz), 1 = étouffé (~600 Hz) ; courbe exponentielle, lissage 80 ms (auras de Feutre).
 *  N'agit que sur les bus music et sfx (le clic et les Timbres restent clairs). */
export function setLowpass(amount) {
  if (!nodes) return;
  const a = Math.max(0, Math.min(1, amount));
  const f = LOWPASS_OPEN * Math.pow(LOWPASS_CLOSED / LOWPASS_OPEN, a);
  nodes.lowpass.frequency.setTargetAtTime(f, ac.currentTime, 0.08);
}

/** Ducking de la musique : −4 dB en 10 ms, retour en 250 ms ; au plus un toutes les 300 ms.
 *  Piloté par le bus uniquement (enemy:hit {crit}, weapon:fusion) : l'export `duck()` est conservé pour la
 *  compatibilité des appelants (game/weapons.js sur chaque tir « big ») mais n'agit plus — § 8 bis interdit le
 *  pompage à chaque onde du Bourdon. */
export function duck() { /* volontairement sans effet : voir duckNow() et les écouteurs de initAudio() */ }
function duckNow() {
  if (!nodes) return;
  const t = ac.currentTime;
  if (t - lastDuckAt < DUCK_MIN_INTERVAL) return;
  lastDuckAt = t; duckCount++;
  const g = nodes.duck.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(DB(DUCK_DB), t + 0.01);
  g.linearRampToValueAtTime(1, t + 0.01 + 0.25);
}
/** Nombre de duckings déclenchés depuis le départ (sondes / tests). */
export function duckCounter() { return duckCount; }

/** Budget de voix (§ 13). Le sampler et sfx appellent acquireVoice() avant de créer une source
 *  et releaseVoice() à sa fin ; au-delà de 48 voix, acquireVoice() refuse. */
export function acquireVoice() {
  if (activeVoices >= MAX_VOICES) return false;
  activeVoices++;
  return true;
}
export function releaseVoice() { activeVoices = Math.max(0, activeVoices - 1); }
export function voiceCount() { return activeVoices; }
export function maxVoices() { return MAX_VOICES; }
