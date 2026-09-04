// ui/run-screen.js — l'écran de base « run » : relie la façade game/game.js
// (startGame / updateGame / renderGame / endGame) à la pile d'états, au HUD,
// à la musique de la paroisse (couches par Résonance, boss, victoire, mort),
// aux écrans de cartes (level:up → 'levelup'), à la pause et au bilan
// (run:end → 'results'). enter({ parishId, characterId, seed, seedText, tutorial }).

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

const END_TO_RESULTS_SEC = 0.8;

export function createRun(deps) {
  const hud = createHud();
  let params = null, unsubs = [], endStats = null, endT = -1, tier3 = false, active = false;

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
    unsubs.push(bus.on('player:death', () => { playTrack('death', 1); }));
    unsubs.push(bus.on('run:tier', (e) => { renderer.setVignette(Math.min(0.75, 0.35 + (e.tier - 1) * 0.07)); renderer.setGrain(Math.min(0.5, 0.25 + (e.tier - 1) * 0.04)); }));
    unsubs.push(bus.on('resonance:change', (e) => { tier3 = e.tier >= 3; }));
    unsubs.push(bus.on('beat', () => { if (tier3 && active) camera.shake(1.5, 0.08); }));
    unsubs.push(bus.on('options:change', (e) => { if (e.key === 'beatIndicator') applyMetronome(); }));
  }

  function unsubscribe() { for (const u of unsubs) u(); unsubs.length = 0; }

  return {
    cursor: 'target',
    enter(p) {
      params = p; endStats = null; endT = -1; tier3 = false;
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
        deps.game.startGame({ parishId: p.parishId, characterId: p.characterId, seed: p.seed });
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
      if (endT >= 0) {
        endT -= realDt;
        if (endT <= 0 && !states.isTransitioning()) {
          endT = -1;
          states.replace('results', { victory: endStats.victory, stats: endStats.stats, params }, { sound: endStats.victory ? 'victory_bell' : null });
        }
      }
    },
    handleAction(a) {
      if (a === 'pause' && active && deps.game.isGameActive() && endT < 0) { states.push('pause'); return true; }
      return false;
    },
    renderWorld(ctx, alpha) {
      if (!active) return;
      deps.game.renderGame(ctx, alpha);
      lighting.drawBeatHalo(ctx); // halo de la Mesure (le monde ne l'appelle pas encore après le sol)
    },
    render(ui) {
      if (!active) return;
      hud.render(ui, deps.game.gameState());
    },
    /** Accès au HUD (tutoriel : compteur de temps réussis, Résonance). */
    hud,
  };
}
