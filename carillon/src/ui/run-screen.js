// ui/run-screen.js — l'écran de base « run » : relie la façade game/game.js
// (startGame / updateGame / renderGame / endGame) à la pile d'états, au HUD,
// à la musique de la paroisse (couches par Résonance, boss, victoire, mort),
// aux écrans de cartes (level:up → 'levelup'), à la pause et au bilan
// (run:end → 'results'). À la mort : ralenti (fx.slowMo, joueur), voile qui
// s'assombrit et « Le Battant se tait » avant le bilan ; à l'aube : « L'aube est
// sonnée » sur victory_bell. enter({ parishId, characterId, seed, seedText, tutorial, weaponId }) ;
// weaponId = Timbre de départ choisi au hub, transmis tel quel à startGame.

import { bus } from '../core/events.js';
import { getSave } from '../core/save.js';
import * as renderer from '../render/renderer.js';
import * as camera from '../render/camera.js';
import * as lighting from '../render/lighting.js';
import * as music from '../audio/music.js';
import { t } from './i18n.js';
import { def as dataDef } from './gamedata.js';
import * as states from './states.js';
import { toast } from './toasts.js';
import { createHud } from './hud.js';
import { startMetronome, stopMetronome } from './metronome.js';
import { text, C } from './widgets.js';

const W = 480, H = 270;
const END_TO_RESULTS_SEC = 0.8;

export function createRun(deps) {
  const hud = createHud();
  let params = null, unsubs = [], endStats = null, endT = -1, tier3 = false, active = false;
  let overlay = null, overlayT = 0, killer = '';   // 'death' | 'victory' : texte de fin avant le bilan

  function playTrack(id, layers) {
    music.loadTrack(id).then(() => music.play(id, { layers: layers || music.layers(), fadeSec: 1 })).catch((e) => console.warn('[music]', e));
  }

  function applyMetronome() {
    const opt = getSave().options.beatIndicator;
    if (active && (opt === 'audio' || opt === 'both')) startMetronome(); else stopMetronome();
  }

  function subscribe() {
    unsubs.push(bus.on('level:up', (e) => { if (active) states.push('levelup', { level: e.level, choices: e.choices }); }));
    unsubs.push(bus.on('run:end', (e) => { endStats = { victory: e.victory, stats: e.stats }; endT = END_TO_RESULTS_SEC; }));
    unsubs.push(bus.on('run:boss', (e) => { if (e.phase === 'intro') playTrack('boss'); }));
    unsubs.push(bus.on('player:death', (e) => {
      playTrack('death', 1);
      const g = deps.game.gameState();
      killer = (e && e.killer) || (g && g.player ? g.player.killer : '') || '';
      overlay = 'death'; overlayT = 0;
    }));
    unsubs.push(bus.on('run:tier', (e) => { renderer.setVignette(Math.min(0.75, 0.35 + (e.tier - 1) * 0.07)); renderer.setGrain(Math.min(0.5, 0.25 + (e.tier - 1) * 0.04)); }));
    unsubs.push(bus.on('resonance:change', (e) => { tier3 = e.tier >= 3; }));
    unsubs.push(bus.on('beat', () => { if (tier3 && active) camera.shake(1.5, 0.08); }));
    unsubs.push(bus.on('options:change', (e) => { if (e.key === 'beatIndicator') applyMetronome(); }));
  }

  function unsubscribe() { for (const u of unsubs) u(); unsubs.length = 0; }

  return {
    cursor: 'target',
    enter(p) {
      params = p; endStats = null; endT = -1; tier3 = false; overlay = null; overlayT = 0; killer = '';
      if (!deps.game) {
        toast({ title: t('ui.hub.start'), body: t('ui.hub.error_game'), icon: 'ui_mort' });
        states.replace('hub', null, { sound: 'ui_cancel' });
        return;
      }
      const parish = dataDef('parishes', p.parishId) || {};
      lighting.setAmbient(parish.ambient || '#16130f');
      renderer.setFog(1); renderer.setAshes(0.6); renderer.setVignette(0.35); renderer.setGrain(0.25);
      camera.setZoom(1, 0);
      try {
        deps.game.startGame({ parishId: p.parishId, characterId: p.characterId, seed: p.seed, weaponId: p.weaponId || null });
      } catch (e) {
        console.error('[run]', e);
        toast({ title: t('ui.hub.start'), body: t('ui.hub.error_game'), icon: 'ui_mort' });
        states.replace('hub', null, { sound: 'ui_cancel' });
        return;
      }
      active = true;
      hud.reset();
      subscribe();
      playTrack(parish.track || p.parishId, 1);
      applyMetronome();
      bus.emit('run:start', { parishId: p.parishId, characterId: p.characterId, seed: p.seed, tutorial: !!p.tutorial });
      if (p.tutorial) states.push('tutorial', { forced: !!p.forceTutorial });
    },
    exit() {
      active = false;
      stopMetronome();
      unsubscribe();
      hud.dispose();
      if (deps.game) deps.game.endGame();
      camera.setZoom(1, 0);
      renderer.setVignette(0.35); renderer.setGrain(0.25);
    },
    update(dt, realDt) {
      if (!active) return;
      if (!states.isFrozen() && deps.game.isGameActive()) deps.game.updateGame(dt);
      hud.update(realDt);
      if (!overlay) { const g = deps.game.gameState(); if (g.world && g.world.ended && g.world.victory) { overlay = 'victory'; overlayT = 0; } }
      if (overlay) overlayT += realDt;
      if (endT >= 0) {
        endT -= realDt;
        if (endT <= 0 && !states.isTransitioning()) {
          endT = -1;
          states.replace('results', { victory: endStats.victory, stats: endStats.stats, params, killer }, { sound: endStats.victory ? 'victory_bell' : null });
        }
      }
    },
    handleAction(a) {
      if (a === 'pause' && active && deps.game.isGameActive() && endT < 0) { states.push('pause'); return true; }
      return false;
    },
    renderWorld(ctx, alpha) {
      if (!active) return;
      deps.game.renderGame(ctx, alpha); // le halo de la Mesure au sol est dessiné par game/world.js juste après le sol
    },
    render(ui) {
      if (!active) return;
      hud.render(ui, deps.game.gameState());
      if (overlay) renderOverlay(ui);
    },
    /** Accès au HUD (tutoriel : compteur de temps réussis, Résonance). */
    hud,
  };

  /** Voile et texte de fin : mort (suie qui monte, « Le Battant se tait ») ou aube (bronze). */
  function renderOverlay(ui) {
    const death = overlay === 'death';
    const k = Math.min(1, overlayT / 1.4);
    // Mort : la suie monte ; aube : lueur de bronze qui s'étend depuis le haut.
    if (death) { ui.globalAlpha = 0.55 * k; ui.fillStyle = C.suie; ui.fillRect(0, 0, W, H); ui.globalAlpha = 1; }
    else {
      const g = ui.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(201,151,63,' + (0.35 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(201,151,63,' + (0.08 * k).toFixed(3) + ')');
      ui.fillStyle = g; ui.fillRect(0, 0, W, H);
    }
    const a = Math.min(1, Math.max(0, (overlayT - 0.4) / 0.8));
    if (a <= 0) return;
    const y = H / 2 - 40 - (1 - a) * 6;
    text(ui, t(death ? 'ui.hud.death_title' : 'ui.results.victory'), W / 2, y, { kind: 'display', size: 26, align: 'center', color: death ? C.gris : C.clair, shadow: true, alpha: a });
    if (death && killer) text(ui, t('ui.results.killer', { name: t('enemy.' + killer + '.name') }), W / 2, y + 30, { size: 9, align: 'center', color: C.os, shadow: true, alpha: a });
  }
}
