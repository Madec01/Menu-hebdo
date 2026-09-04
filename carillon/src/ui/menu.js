// ui/menu.js — écran-titre animé et écran « Cliquez pour sonner ». Le beffroi
// (title_beffroi) se dresse sous la pluie de cendres (renderer.setAshes), la
// cloche (title_cloche) oscille lentement, le logo CARILLON est gravé en
// CarillonDisplay avec relief et ombre, la brume roule (renderer.setFog).
// Boutons : Jouer/Continuer, Tutoriel, Codex, Options, Crédits ; bouton plein écran en haut à
// droite (ui/touch.js : conteneur #stage, verrouillage paysage, aide iOS).

import { makeRng, mix32 } from '../core/rng.js';
import { getSave } from '../core/save.js';
import * as renderer from '../render/renderer.js';
import * as atlas from '../render/atlas.js';
import * as camera from '../render/camera.js';
import * as lighting from '../render/lighting.js';
import * as particles from '../render/particles.js';
import * as music from '../audio/music.js';
import { playUi } from '../audio/sfx.js';
import { hasGamepad } from '../core/input.js';
import { t } from './i18n.js';
import * as states from './states.js';
import * as touch from './touch.js';
import { text, createMenu, hit, C } from './widgets.js';

const W = 480, H = 270;
const BELL = { x: -150, y: -50 };        // coordonnées monde de la cloche
const BEFFROI = { x: 128, y: 18 };       // coordonnées monde du beffroi
let time = 0;

/** Décor commun (titre et déblocage) sur le calque monde. */
function renderScene(ctx, alpha, dt) {
  time += dt;
  camera.snap(0, 0);
  renderer.setAshes(1); renderer.setFog(0.7); renderer.setVignette(0.45); renderer.setGrain(0.25);
  lighting.setAmbient('#1a1712');
  // Sol : bande de tourbe sombre sous le beffroi (VFX autorisé : lumière/ambiance).
  ctx.fillStyle = '#100e0b'; ctx.fillRect(-W / 2, 60, W, H);
  atlas.draw(ctx, 'title_beffroi', 'idle', 0, BEFFROI.x, BEFFROI.y);
  // Cloche qui oscille lentement (rotation autour de son axe haut).
  const swing = Math.sin(time * 0.9) * 0.07;
  ctx.save();
  ctx.translate(BELL.x, BELL.y - 80);
  ctx.rotate(swing);
  atlas.draw(ctx, 'title_cloche', 'idle', 0, 0, 80, { scale: 0.75 });
  ctx.restore();
  // Lumières : fenêtre du beffroi, lueur du bronze, halo au sol.
  lighting.addLight(BEFFROI.x + 6, BEFFROI.y - 30, 150, '#e0a050', 0.9, 0.25);
  lighting.addLight(BEFFROI.x, BEFFROI.y + 90, 220, '#8f7a58', 0.45, 0);
  lighting.addLight(BELL.x, BELL.y - 10, 170, '#c9973f', 0.85, 0.05);
  lighting.addGlow(BELL.x, BELL.y - 20, 60, '#c9973f', 0.25 + 0.1 * Math.sin(time * 1.8));
  lighting.setHaloPos(BELL.x, BELL.y + 70);
  lighting.setBeatPulse(0.5 + 0.5 * Math.sin(time * 2.4));
  lighting.drawBeatHalo(ctx);
  if (particles.activeCount() < 120) { particles.emit('ember', BEFFROI.x + (titleRng.next() - 0.5) * 60, BEFFROI.y + 100); particles.emit('ash', (titleRng.next() - 0.5) * W, -H / 2); }
  particles.renderParticles(ctx, alpha);
}

/** Logo gravé : ombre suie, relief clair, corps bronze. */
function renderLogo(ui, y) {
  const s = { kind: 'display', size: 44, align: 'center' };
  text(ui, 'CARILLON', W / 2 + 2, y + 3, { ...s, color: '#0b0908' });
  text(ui, 'CARILLON', W / 2 - 1, y - 1, { ...s, color: C.clair, alpha: 0.5 });
  text(ui, 'CARILLON', W / 2, y, { ...s, color: C.bronze });
  text(ui, t('title.tagline'), W / 2, y + 50, { kind: 'display', size: 15, align: 'center', color: C.os, shadow: true });
}

/** Écran « Cliquez pour sonner » : le premier geste débloque l'audio (main.js). */
export function createUnlock() {
  let dt = 0;
  return {
    enter() { dt = 0; },
    exit() {},
    update(_, realDt) { dt = realDt; },
    handleAction() { return false; },
    renderWorld(ctx, alpha) { renderScene(ctx, alpha, dt); dt = 0; },
    render(ui) {
      renderLogo(ui, 14);
      const a = 0.6 + 0.4 * Math.sin(time * 3);
      text(ui, t('ui.boot.click'), W / 2, 196, { kind: 'display', size: 20, align: 'center', color: C.os, shadow: true, alpha: a });
    },
  };
}

/** Écran-titre. */
export function createTitle() {
  let dt = 0;
  const X = W / 2 - 60, BW = 120, BH = 20, Y0 = 92, STEP = 24;
  const rect = (i) => ({ x: X, y: Y0 + i * STEP, w: BW, h: BH });
  const hasRuns = () => getSave().stats.runs > 0;
  const items = [
    { label: () => t(hasRuns() ? 'ui.title.continue' : 'ui.title.play'), rect: rect(0), action: () => states.replace('hub'), icon: 'ui_coeur' },
    { label: () => t('ui.title.tutorial'), rect: rect(1), action: () => startTutorial(), icon: 'ui_lanterne' },
    { label: () => t('ui.title.codex'), rect: rect(2), action: () => states.push('codex'), icon: 'ui_sceau' },
    { label: () => t('ui.title.options'), rect: rect(3), action: () => states.push('options'), icon: 'ui_options' },
    { label: () => t('ui.title.credits'), rect: rect(4), action: () => states.push('credits'), icon: 'ui_musique' },
  ];
  const menu = createMenu(items, { size: 11 });
  let fsRect = { x: W - 24, y: 6, w: 18, h: 18 };

  /** « Dernière nuit : Cendrelune · Wren » à droite du bouton Continuer. */
  function renderContinueHint(ui) {
    const s = getSave();
    if (!hasRuns()) return;
    const parish = s.lastParish || 'cendrelune', ch = s.lastCharacter || 'wren';
    const r = rect(0);
    text(ui, t('ui.title.last_night', { parish: t('parish.' + parish + '.name'), character: t('char.' + ch + '.name') }), r.x + r.w + 8, r.y + 6, { size: 8, color: C.gris, shadow: true });
  }

  function startTutorial() {
    const save = getSave();
    states.replace('run', { parishId: 'cendrelune', characterId: 'wren', seed: freshSeed(), tutorial: true, seedText: null, forceTutorial: true }, { sound: 'bell_tier' });
    save.lastParish = 'cendrelune';
  }

  return {
    enter() {
      dt = 0;
      if (music.current() !== 'menu') music.play('menu', { layers: 2, fadeSec: 1.2 }).catch(() => {});
    },
    exit() {},
    update(_, realDt) {
      dt = realDt;
      const m = states.mouse;
      if (m.moved && menu.hover(m.x, m.y)) playUi('ui_move');
      if (m.clicked) {
        if (hit(fsRect, m.x, m.y)) { playUi('ui_confirm'); touch.toggleFullscreen(); return; }
        const it = menu.at(m.x, m.y); if (it) { playUi('ui_confirm'); it.action(); }
      }
    },
    handleAction(a) {
      if (a === 'menuUp') { if (menu.move(-1)) playUi('ui_move'); return true; }
      if (a === 'menuDown') { if (menu.move(1)) playUi('ui_move'); return true; }
      if (a === 'confirm') { playUi('ui_confirm'); menu.current().action(); return true; }
      return false;
    },
    renderWorld(ctx, alpha) { renderScene(ctx, alpha, dt); dt = 0; },
    render(ui) {
      renderLogo(ui, 14);
      menu.render(ui);
      renderContinueHint(ui);
      fsRect = touch.fullscreenButton(ui, W - (touch.isActive() ? 32 : 24), 6);
      const s = getSave().stats;
      text(ui, t('ui.title.runs', { runs: s.runs, wins: s.wins }), 6, H - 12, { size: 9, color: C.gris });
      text(ui, t('ui.title.version'), W / 2, H - 12, { size: 9, align: 'center', color: C.gris });
      text(ui, t(touch.isActive() ? 'ui.touch.nav_hint' : hasGamepad() ? 'ui.common.nav_hint_pad' : 'ui.common.nav_hint'), W - 6, H - 12, { size: 9, align: 'right', color: C.gris });
    },
  };
}

/** Aléa cosmétique de l'écran-titre (cendres, braises) : rng seedé uniquement. */
const titleRng = makeRng((Date.now() >>> 0));
function freshSeed() { return mix32((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) >>> 0; }
