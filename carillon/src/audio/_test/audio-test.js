// Page de test des modules audio : expose window.carillonTest pour Playwright et des boutons manuels.
import { bus } from '../../core/events.js';
import * as audio from '../audio.js';
import * as conductor from '../conductor.js';
import * as music from '../music.js';
import * as sfx from '../sfx.js';

const log = (msg, cls = '') => { const el = document.getElementById('log'); el.innerHTML += `<div class="${cls}">${msg}</div>`; };
const events = { beat: 0, bar: 0, unlocked: 0 };
bus.on('beat', () => { events.beat++; });
bus.on('bar', () => { events.bar++; });
bus.on('audio:unlocked', () => { events.unlocked++; log('audio:unlocked', 'ok'); });

audio.setAssetsBase('../../../assets/');          // la page est dans src/audio/_test/
let manifest = null;

// boucle « 60 Hz » simulée : c'est elle qui émet beat/bar via conductorTick() (jamais le timer audio)
function frame() {
  conductor.conductorTick();
  const h = document.getElementById('halo');
  const glow = conductor.isRunning() ? Math.pow(1 - conductor.phase(), 3) : 0;
  h.style.boxShadow = `0 0 ${6 + 30 * glow}px rgba(201,151,63,${0.2 + 0.7 * glow})`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

async function unlock() {
  await audio.initAudio({ options: { volMaster: 0.8, volMusic: 0.8, volSfx: 0.9 } });
  await audio.unlock();
  manifest = await fetch('../../../assets/audio/manifest.json').then((r) => r.json());
  music.setManifest(manifest);
  await sfx.loadSfx(manifest);
  conductor.initConductor({ bpm: 96 });
  log(`bruitages décodés : ${Object.keys(manifest.sfx).length} ids`, 'ok');
}

document.getElementById('unlock').addEventListener('click', () => unlock().catch((e) => log(e.message, 'ko')));
document.getElementById('stop').addEventListener('click', () => music.stop(0.5));
document.getElementById('judge').addEventListener('click', () => { const j = conductor.judge(audio.now()); log(`judge → ${j.grade} ${j.offsetMs.toFixed(0)} ms`); });
document.querySelectorAll('[data-track]').forEach((b) => b.addEventListener('click', () => music.play(b.dataset.track, { layers: music.layers(), fadeSec: 0.8 }).then(() => log(`piste ${b.dataset.track}`, 'ok'))));
document.querySelectorAll('[data-layers]').forEach((b) => b.addEventListener('click', () => music.setLayers(Number(b.dataset.layers))));
document.querySelectorAll('[data-sfx]').forEach((b) => b.addEventListener('click', () => sfx.play(b.dataset.sfx)));

window.carillonTest = { audio, conductor, music, sfx, bus, events, unlock, log, manifest: () => manifest };
