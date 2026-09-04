// main.js — bootstrap de CARILLON (ARCHITECTURE.md § 4, § 7 bis) : chargement des
// manifestes, de l'atlas, des polices, de l'audio, des langues et des données ;
// écran « Cliquez pour sonner » (déblocage audio dans le geste) ; boucle à pas fixe
// avec l'ordre par frame du § 7 bis ; pile d'états (ui/states.js) ; application des
// options au démarrage et sur options:change.

import { bus } from './core/events.js';
import { createLoop } from './core/loop.js';
import * as input from './core/input.js';
import { loadSave, getSave, commit } from './core/save.js';
import * as renderer from './render/renderer.js';
import * as atlas from './render/atlas.js';
import * as camera from './render/camera.js';
import * as lighting from './render/lighting.js';
import * as particles from './render/particles.js';
import * as fx from './render/fx.js';
import { loadFonts } from './render/fonts.js';
import * as audio from './audio/audio.js';
import * as conductor from './audio/conductor.js';
import * as music from './audio/music.js';
import * as sfx from './audio/sfx.js';
import { loadLang, t } from './ui/i18n.js';
import * as states from './ui/states.js';
import { text, drawCursor, C, gauge } from './ui/widgets.js';
import { updateToasts, renderToasts, toast } from './ui/toasts.js';
import { initAchievements } from './ui/achievements.js';
import { loadUiData } from './ui/gamedata.js';
import { initMetronome } from './ui/metronome.js';
import { createScreens } from './ui/screens.js';
import { initKeyNames } from './ui/options-items.js';

const W = 480, H = 270;
const canvas = document.getElementById('game');
const deps = { loop: null, manifest: null, audioManifest: null, game: null, gameData: null, gameExtra: null, canvas };
let loop = null;
let wasFrozen = false;
let bootProgress = { done: 0, total: 6, label: '' };
let booted = false;

// ---- Options -----------------------------------------------------------------------------------

/** Applique une option (au démarrage et sur options:change). Les volumes sont gérés par audio.js. */
function applyOption(key, value) {
  switch (key) {
    case 'scale': renderer.resize(value | 0); break;
    case 'shake': camera.setShakeScale(+value); break;
    case 'particles': particles.setDensity(+value); break;
    case 'fullscreen': setFullscreen(!!value); break;
    case 'lang': loadLang(value).catch((e) => console.warn('[i18n]', e)); break;
    default: break; // reduceFlash, showFps, beatIndicator, assist, bindings : lus à l'usage
  }
}

function applyAllOptions() {
  const o = getSave().options;
  for (const k of ['scale', 'shake', 'particles']) applyOption(k, o[k]);
  input.applyBindings(o.bindings);
  if (o.fullscreen && !document.fullscreenElement) o.fullscreen = false; // pas de plein écran sans geste
}

function setFullscreen(on) {
  try {
    if (on && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch (e) { /* navigateur sans API plein écran */ }
}

document.addEventListener('fullscreenchange', () => {
  const o = getSave().options;
  const on = !!document.fullscreenElement;
  if (o.fullscreen !== on) { o.fullscreen = on; commit(); }
  if ((o.scale | 0) === 0) renderer.resize(0);
});

bus.on('options:change', ({ key, value }) => applyOption(key, value));

// ---- Boucle (§ 7 bis) --------------------------------------------------------------------------

function update(dt) {
  input.tickInput();
  const frozen = states.isFrozen();
  if (frozen !== wasFrozen) { wasFrozen = frozen; loop.setTimeScale(frozen ? 0 : 1); }
  // updateGame() (ui/run-screen.js) appelle conductorTick() lui-même quand la run tourne.
  if (frozen || !(deps.game && deps.game.isGameActive())) conductor.conductorTick();
  if (!frozen) fx.updateFx(dt);
  states.update(dt, loop.stepSec);           // écrans : jeu, caméra, HUD, menus
  if (!frozen) particles.updateParticles(dt);
  updateToasts(loop.stepSec);
  loop.stats.entities = deps.game ? deps.game.gameEntityCount() : 0;
}

function render(alpha) {
  renderer.beginFrame(alpha);
  states.render(alpha);
  const ui = renderer.getUiCtx();
  renderToasts(ui, W);
  if (getSave().options.showFps) text(ui, t('ui.common.fps', { fps: loop.stats.fps }), W - 4, 32, { size: 8, align: 'right', color: C.gris, shadow: true });
  if (states.mouse.inside) drawCursor(ui, states.mouse.x, states.mouse.y, states.cursorKind());
  renderer.endFrame();
}

// ---- Chargement --------------------------------------------------------------------------------

function step(label) { bootProgress.done++; bootProgress.label = label; }

function renderBoot(msg) {
  renderer.beginFrame(0);
  const ui = renderer.getUiCtx();
  ui.fillStyle = C.suie; ui.fillRect(0, 0, W, H);
  text(ui, 'CARILLON', W / 2, H / 2 - 40, { kind: 'display', size: 28, align: 'center', color: C.bronze, shadow: true });
  text(ui, msg, W / 2, H / 2 + 4, { size: 11, align: 'center', color: C.os });
  gauge(ui, W / 2 - 80, H / 2 + 22, 160, 10, bootProgress.done / bootProgress.total);
  renderer.endFrame();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url + ' (' + res.status + ')');
  return res.json();
}

async function loadGameModules() {
  try {
    const [game, data, weapons, progression] = await Promise.all([
      import('./game/game.js'), import('./game/data.js'), import('./game/weapons.js'), import('./game/progression.js'),
    ]);
    await data.loadGameData();
    deps.game = game; deps.gameData = data;
    deps.gameExtra = { dpsReport: weapons.dpsReport, finishRun: progression.finishRun };
  } catch (e) {
    console.error('[main] gameplay indisponible', e);
    deps.game = null; deps.gameData = null;
  }
}

async function boot() {
  const save = loadSave();
  renderer.initRenderer({ canvas, width: W, height: H });
  lighting.initLighting({ w: W, h: H, ambient: '#16130f' });
  particles.initParticles(4000);
  input.initInput({ canvas, getAudioTime: audio.now, screenToWorld: camera.screenToWorld, logicalSize: renderer.logicalSize });
  initKeyNames();
  applyAllOptions();
  const bootTimer = setInterval(() => renderBoot(t('ui.boot.loading', { percent: Math.round(100 * bootProgress.done / bootProgress.total) })), 100);

  await loadLang(save.options.lang); step(t('ui.boot.loading_lang'));
  const [manifest, audioManifest] = await Promise.all([fetchJson('assets/manifest.json'), fetchJson('assets/audio/manifest.json')]);
  deps.manifest = manifest; deps.audioManifest = audioManifest;
  await audio.initAudio({ options: save.options });
  audio.setAssetsBase('assets/');
  music.setManifest(audioManifest);
  conductor.initConductor({ bpm: 96 });
  await Promise.all([
    loadFonts(manifest, 'assets/').then(() => step(t('ui.boot.loading_fonts'))),
    atlas.loadAtlas(manifest, { baseUrl: 'assets/' }).then(() => step(t('ui.boot.loading_atlas'))),
    sfx.loadSfx(audioManifest).then(() => step(t('ui.boot.loading_audio'))),
    initMetronome(audioManifest),
    music.loadTrack('menu').then(() => step(t('ui.boot.loading_music'))).catch((e) => { console.warn('[music]', e); step(''); }),
  ]);
  await Promise.all([loadGameModules(), loadUiData()]); step(t('ui.boot.loading_data'));
  clearInterval(bootTimer);

  loop = createLoop({ update, render });
  deps.loop = loop;
  fx.initFx({ loop, getOptions: () => getSave().options });
  states.initStates(createScreens(deps));
  initAchievements();
  states.replace('unlock', null, { fade: false });
  loop.start();
  booted = true;
}

// ---- Déblocage audio : dans le geste utilisateur -----------------------------------------------

let unlocked = false;
function onFirstGesture(e) {
  if (unlocked || !booted) return;
  if (e.type === 'keydown' && (e.key === 'Escape' || e.key === 'Tab')) return;
  unlocked = true;
  window.removeEventListener('pointerdown', onFirstGesture);
  window.removeEventListener('keydown', onFirstGesture);
  audio.unlock().then(() => {
    music.play('menu', { layers: 2, fadeSec: 1.5 }).catch((err) => console.warn('[music]', err));
    states.replace('title', null, { sound: 'bell_tier' });
  });
}
window.addEventListener('pointerdown', onFirstGesture);
window.addEventListener('keydown', onFirstGesture);

// ---- Erreurs fatales --------------------------------------------------------------------------

boot().catch((e) => {
  console.error('[main] démarrage impossible', e);
  try {
    renderer.beginFrame(0);
    const ui = renderer.getUiCtx();
    text(ui, t('ui.common.error_title'), W / 2, H / 2 - 20, { kind: 'display', size: 22, align: 'center', color: C.braise });
    text(ui, t('ui.common.error_reload'), W / 2, H / 2 + 8, { size: 11, align: 'center', color: C.os });
    text(ui, String(e && e.message || e), W / 2, H / 2 + 24, { size: 9, align: 'center', color: C.gris, maxWidth: W - 20 });
    renderer.endFrame();
  } catch (e2) { /* le canvas lui-même a échoué */ }
});

/** Accès de débogage / tests (Playwright). */
window.carillon = { states, bus, getSave, deps, toast, get loop() { return loop; }, audio, music, conductor };
