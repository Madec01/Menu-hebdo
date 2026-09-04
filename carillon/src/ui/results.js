// ui/results.js — bilan de la nuit : temps, tués, niveau, DPS par Timbre,
// Résonance moyenne, Bronze gagné avec compteur animé, Feuillet et hauts-faits
// débloqués, seed copiable, Rejouer / Retour au Beffroi.
// enter({ victory, stats: RunStats, params }) — le Bronze est déjà crédité (D).

import * as renderer from '../render/renderer.js';
import * as camera from '../render/camera.js';
import * as lighting from '../render/lighting.js';
import * as music from '../audio/music.js';
import { playUi, play as playSfx } from '../audio/sfx.js';
import { t, fmtTime } from './i18n.js';
import { def as dataDef } from './gamedata.js';
import * as states from './states.js';
import { copyText } from './dom.js';
import { toast } from './toasts.js';
import { panel, text, icon, gauge, createMenu, heading, C } from './widgets.js';

const W = 480, H = 270;
const COUNT_SEC = 1.6;

export function createResults() {
  let victory = false, stats = null, params = null, time = 0, shown = 0, lastTick = 0, killer = '';
  const PX = 16, PY = 12, PW = W - 32, PH = H - 24;
  const btn = (i) => ({ x: PX + 20 + i * 150, y: PY + PH - 30, w: 136, h: 20 });
  const items = [
    { label: () => t('ui.results.retry'), rect: btn(0), action: () => states.replace('run', params, { sound: 'bell_tier' }), icon: 'ui_coeur' },
    { label: () => t('ui.results.copy_seed'), rect: btn(1), action: copySeed, icon: 'ui_sceau' },
    { label: () => t('ui.results.hub'), rect: btn(2), action: () => states.replace('hub'), icon: 'ui_lanterne' },
  ];
  const menu = createMenu(items, { size: 10 });

  function seedLabel() { return params && params.seedText ? params.seedText : String(stats ? stats.seed : ''); }
  async function copySeed() {
    playUi('ui_confirm');
    const ok = await copyText(seedLabel());
    toast({ title: t('ui.hub.seed'), body: t(ok ? 'ui.common.copied' : 'ui.common.copy_failed'), icon: 'ui_sceau' });
  }

  function renderWorld(ctx) {
    camera.snap(0, 0);
    renderer.setAshes(victory ? 0.2 : 0.8); renderer.setFog(0.6); renderer.setVignette(0.5);
    lighting.setAmbient(victory ? '#2a241c' : '#16130f');
    ctx.fillStyle = victory ? '#1a1610' : '#0b0a08'; ctx.fillRect(-W / 2, -H / 2, W, H);
    lighting.addLight(0, -40, 300, victory ? '#c9973f' : '#8f8d93', victory ? 0.7 : 0.35, 0.05);
  }

  function renderStats(ui) {
    const s = stats;
    const lx = PX + 18, vx = PX + 190;
    let y = PY + 40;
    const row = (label, value, color = C.encre) => { text(ui, label, lx, y, { size: 10, color: C.encreClaire }); text(ui, value, vx, y, { size: 10, align: 'right', color }); y += 13; };
    row(t('ui.results.time'), fmtTime(s.timeSec));
    row(t('ui.results.kills'), String(s.kills));
    row(t('ui.results.level'), String(s.level));
    row(t('ui.results.resonance'), t('ui.hud.mult', { mult: s.resonanceAvg }), C.bronze);
    y += 2;
    text(ui, t('ui.results.perfects', { perfects: s.perfects || 0, misses: s.misses || 0 }), lx, y, { size: 8, color: C.encreClaire }); y += 14;
    // Bronze : compteur animé.
    const target = s.bronze || 0;
    const k = Math.min(1, time / COUNT_SEC);
    shown = Math.round(target * (1 - Math.pow(1 - k, 3)));
    icon(ui, 'ui_bronze', lx, y - 4, 0.6);
    text(ui, t('ui.results.bronze'), lx + 24, y, { size: 10, color: C.encreClaire });
    text(ui, String(shown), vx, y - 4, { kind: 'display', size: 18, align: 'right', color: C.bronze });
    y += 20;
    if (!victory && killer) { text(ui, t('ui.results.killer', { name: t('enemy.' + killer + '.name') }), lx, y, { size: 9, color: C.encreClaire, maxWidth: 190 }); y += 11; }
    if (s.leafUnlocked) { text(ui, t('ui.results.leaf', { title: t('lore.' + s.leafUnlocked + '.title') }), lx, y, { size: 9, color: C.braise, maxWidth: 180 }); y += 11; }
    if (s.achievements) for (const id of s.achievements.slice(0, 2)) { text(ui, t('ui.results.achievement', { name: t('achievement.' + id + '.name') }), lx, y, { size: 9, color: C.braise, maxWidth: 180 }); y += 11; }
    text(ui, t('ui.results.seed', { seed: seedLabel() }), lx, PY + PH - 44, { size: 8, color: C.encreClaire, maxWidth: 200 });
  }

  function renderDps(ui) {
    const s = stats;
    const bx = PX + 214, bw = PW - 230;
    let y = PY + 40;
    text(ui, t('ui.results.dps'), bx, y, { size: 10, color: C.encreClaire }); y += 14;
    const entries = Object.entries(s.dpsByWeapon || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = entries.length ? entries[0][1] : 1;
    const dur = Math.max(1, s.timeSec);
    for (const [id, dmg] of entries) {
      const fusion = !!dataDef('fusions', id);
      icon(ui, fusion ? 'fusion_' + id : id, bx, y - 3, 0.5);
      text(ui, t((fusion ? 'fusion.' : 'weapon.') + id + '.name'), bx + 20, y, { size: 9, color: C.encre, maxWidth: 90 });
      gauge(ui, bx + 112, y + 1, bw - 112, 8, dmg / max);
      text(ui, t('ui.results.dps_value', { dps: Math.round(dmg / dur) }), bx + bw, y + 10, { size: 7, align: 'right', color: C.encreClaire });
      y += 17;
    }
    if (!entries.length) text(ui, t('ui.pause.empty'), bx + 20, y, { size: 9, color: C.encre });
    // Build final.
    const b = s.build || { weapons: [], passives: [] };
    let x = bx;
    const by = PY + PH - 62;
    text(ui, t('ui.results.build'), bx, by - 11, { size: 8, color: C.encreClaire });
    for (const w of b.weapons) { icon(ui, dataDef('fusions', w.id) ? 'fusion_' + w.id : w.id, x, by, 0.5); text(ui, String(w.level), x + 16, by + 8, { size: 8, color: C.bronze }); x += 22; }
    x = bx;
    for (const p of b.passives) { icon(ui, p.id, x, by + 16, 0.5); text(ui, String(p.level), x + 16, by + 24, { size: 8, color: C.bronze }); x += 22; }
  }

  return {
    enter(p) {
      victory = !!p.victory; stats = p.stats || {}; params = p.params; killer = p.killer || ''; time = 0; shown = 0; lastTick = 0; menu.index = 2;
      const track = victory ? 'victory' : 'death';
      if (music.current() !== track) music.loadTrack(track).then(() => music.play(track, { layers: 2, fadeSec: 1 })).catch(() => {});
    },
    exit() {},
    update(_, realDt) {
      time += realDt;
      if (time < COUNT_SEC && time - lastTick > 0.12 && (stats.bronze || 0) > 0) { lastTick = time; playSfx('xp_pickup', { volume: 0.35 }); }
      const m = states.mouse;
      if (m.moved && menu.hover(m.x, m.y)) playUi('ui_move');
      if (m.clicked) { const it = menu.at(m.x, m.y); if (it) it.action(); }
    },
    handleAction(a) {
      if (a === 'menuLeft' || a === 'menuUp') { if (menu.move(-1)) playUi('ui_move'); return true; }
      if (a === 'menuRight' || a === 'menuDown') { if (menu.move(1)) playUi('ui_move'); return true; }
      if (a === 'confirm') { menu.current().action(); return true; }
      if (a === 'cancel') { states.replace('hub', null, { sound: 'ui_cancel' }); return true; }
      return false;
    },
    renderWorld,
    render(ui) {
      if (!stats) return;
      panel(ui, PX, PY, PW, PH, 'parchment');
      heading(ui, t(victory ? 'ui.results.victory' : 'ui.results.defeat'), W / 2, PY + 6, 20);
      text(ui, t('ui.pause.parish', { parish: t('parish.' + stats.parishId + '.name'), character: t('char.' + stats.characterId + '.name') }), W / 2, PY + 30, { size: 8, align: 'center', color: C.encreClaire });
      renderStats(ui);
      renderDps(ui);
      menu.render(ui);
    },
  };
}
