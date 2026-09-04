// ui/hud.js — HUD de la nuit : vie, XP, timer, tués, jauge de Résonance à 4
// crans qui pulse sur le temps, icônes de Timbres/Accords avec niveau,
// sonnerie visuelle à chaque minute, bannière de Fêlure/Bourdon avec barre de
// vie, indicateur de rythme visuel (option beatIndicator : balancier avec la
// fenêtre de frappe), retour Parfait/Bon/Raté sous le joueur, rappel des
// commandes pendant les 30 premières secondes des premières nuits, vibration
// légère de la manette au cran 4. Lit gameState() et les événements du bus.

import { bus } from '../core/events.js';
import { getSave } from '../core/save.js';
import * as conductor from '../audio/conductor.js';
import { getBindings, hasGamepad, rumble } from '../core/input.js';
import { t, fmtTime } from './i18n.js';
import { keyName } from './options-items.js';
import { panel, text, gauge, icon, keycap, C } from './widgets.js';
import { drawNineSlice } from '../render/atlas.js';

const W = 480, H = 270;
const RES_X = W / 2 - 74, RES_Y = H - 24, SEG_W = 34, SEG_H = 8, SEG_GAP = 4;
const HINT_SEC = 30;        // durée du rappel des commandes
const HINT_RUNS = 3;        // … affiché tant que le joueur a fini moins de 3 nuits

export function createHud() {
  const res = { tier: 0, mult: 1, value: 0 };
  const st = { minuteT: 0, minute: 0, bannerT: 0, bannerKind: '', bannerName: '', judgeT: 0, judge: '', beatFlash: 0, blockedT: 0, lastBeat: -1, hintT: 0 };
  const unsubs = [];

  function listen() {
    unsubs.push(bus.on('resonance:change', (e) => {
      if (e.tier >= 3 && res.tier < 3 && e.direction > 0) rumble(0.4, 160);   // cran 4 atteint
      res.tier = e.tier; res.mult = e.mult; res.value = e.value;
    }));
    unsubs.push(bus.on('run:minute', (e) => { st.minute = e.minute; st.minuteT = 2.5; }));
    unsubs.push(bus.on('run:fissure', (e) => { if (e.phase === 'start') { st.bannerKind = 'fissure'; st.bannerName = t('enemy.' + e.bossId + '.name'); st.bannerT = 3; } }));
    unsubs.push(bus.on('run:boss', (e) => { if (e.phase === 'intro') { st.bannerKind = 'boss'; st.bannerName = t('boss.' + e.bossId + '.name'); st.bannerT = 4; } }));
    unsubs.push(bus.on('rhythm:input', (e) => { st.judge = e.grade; st.judgeT = 0.6; }));
    unsubs.push(bus.on('resonance:blocked', (e) => { st.blockedT = e.durationSec; }));
    unsubs.push(bus.on('beat', () => { st.beatFlash = 1; if (res.tier >= 3) rumble(0.12, 40); }));
  }

  /** Rappel discret des commandes (premières nuits, 30 s) sous la barre de vie. */
  function renderControls(ui) {
    if (st.hintT <= 0) return;
    const a = Math.min(1, st.hintT / 0.8);
    ui.globalAlpha = a;
    const y = 31;
    if (hasGamepad()) { text(ui, t('ui.hud.controls_pad'), 6, y + 2, { size: 8, color: C.os, shadow: true }); ui.globalAlpha = 1; return; }
    const b = getBindings();
    const first = (act) => (b[act] && b[act].keys.length ? keyName(b[act].keys[0]) : '?');
    let x = 6;
    for (const act of ['up', 'left', 'down', 'right']) x += keycap(ui, first(act), x, y, { size: 7, minWidth: 12 }) + 1;
    x += 3 + text(ui, t('ui.hud.ctrl_move'), x, y + 2, { size: 8, color: C.os, shadow: true }) + 8;
    x += keycap(ui, first('dash'), x, y, { size: 7 }) + 4;
    x += text(ui, t('ui.hud.ctrl_dash'), x, y + 2, { size: 8, color: C.bronze, shadow: true }) + 8;
    x += keycap(ui, first('parry'), x, y, { size: 7 }) + 4;
    x += text(ui, t('ui.hud.ctrl_parry'), x, y + 2, { size: 8, color: C.os, shadow: true }) + 8;
    x += keycap(ui, first('pause'), x, y, { size: 7 }) + 4;
    text(ui, t('ui.hud.ctrl_pause'), x, y + 2, { size: 8, color: C.os, shadow: true });
    ui.globalAlpha = 1;
  }

  function renderTop(ui, g) {
    const p = g.player, run = g.run, world = g.world;
    // Vie et XP.
    icon(ui, 'ui_coeur', 4, 4, 0.5);
    const hpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 0;
    gauge(ui, 22, 6, 110, 11, hpRatio, { hot: hpRatio < 0.3, label: Math.ceil(p.hp) + ' / ' + p.maxHp, size: 9 });
    gauge(ui, 22, 20, 110, 7, run.nextXp > 0 ? run.xp / run.nextXp : 0);
    text(ui, t('ui.hud.level', { level: run.level }), 136, 19, { size: 9, color: C.bronze, shadow: true });
    // Timer et palier.
    const tt = fmtTime(run.timeSec);
    text(ui, tt, W / 2, 4, { kind: 'display', size: 18, align: 'center', color: st.minuteT > 0 ? C.clair : C.os, shadow: true });
    if (world.tier > 1) text(ui, t('ui.hud.tier', { tier: world.tier }), W / 2, 26, { size: 9, align: 'center', color: C.gris, shadow: true });
    // Tués et assistance.
    icon(ui, 'ui_mort', W - 20, 4, 0.5);
    text(ui, t('ui.hud.kills', { kills: run.kills }), W - 24, 8, { size: 12, align: 'right', color: C.os, shadow: true });
    const assist = getSave().options.assist;
    if (assist !== 'none') text(ui, t('ui.hud.assist_' + assist), W - 6, 22, { size: 8, align: 'right', color: C.gris, shadow: true });
    // Statuts.
    if (p.silencedT > 0) text(ui, t('ui.hud.silenced'), W / 2, 40, { size: 10, align: 'center', color: C.gris, shadow: true });
    else if (st.blockedT > 0) text(ui, t('ui.hud.blocked'), W / 2, 40, { size: 10, align: 'center', color: C.gris, shadow: true });
  }

  function renderMinute(ui) {
    if (st.minuteT <= 0) return;
    const a = Math.min(1, st.minuteT / 0.6);
    const y = 54 - (2.5 - st.minuteT) * 6;
    text(ui, t('ui.hud.minute', { minute: st.minute }), W / 2, y, { kind: 'display', size: 20, align: 'center', color: C.bronze, shadow: true, alpha: a });
  }

  function renderBanner(ui, g) {
    const world = g.world;
    const boss = world.boss && world.boss.state === 'alive' ? world.boss : null;
    const fissure = !boss && world.fissure && world.fissure.state === 'alive' ? world.fissure : null;
    const e = boss || fissure;
    if (e) {
      const name = boss ? t('boss.' + world.bossKind + '.name') : t('enemy.' + e.kind + '.name');
      panel(ui, W / 2 - 100, 30, 200, 26, 'dark');
      text(ui, (boss ? t('ui.hud.boss') : t('ui.hud.fissure')) + ' · ' + name, W / 2, 34, { size: 9, align: 'center', color: C.braise });
      gauge(ui, W / 2 - 92, 45, 184, 8, e.maxHp > 0 ? e.hp / e.maxHp : 0, { hot: true });
    }
    if (st.bannerT > 0) {
      const a = Math.min(1, st.bannerT / 0.5);
      text(ui, st.bannerName, W / 2, 96, { kind: 'display', size: 26, align: 'center', color: C.braise, shadow: true, alpha: a });
      text(ui, t(st.bannerKind === 'boss' ? 'ui.hud.boss' : 'ui.hud.fissure'), W / 2, 124, { size: 11, align: 'center', color: C.os, shadow: true, alpha: a });
    }
  }

  function renderResonance(ui) {
    const phase = conductor.isRunning() ? conductor.phase() : 0;
    const pulse = Math.pow(1 - phase, 3);
    const hot = res.tier >= 3;
    text(ui, t('ui.hud.resonance'), RES_X - 6, RES_Y - 1, { size: 8, align: 'right', color: C.gris, shadow: true });
    for (let i = 0; i < 4; i++) {
      const x = RES_X + i * (SEG_W + SEG_GAP);
      const fill = i < res.tier ? 1 : i === res.tier ? res.value : 0;
      const grow = i === res.tier ? Math.round(pulse * 2) : 0;
      gauge(ui, x, RES_Y - grow, SEG_W, SEG_H + grow * 2, fill, { hot });
    }
    const mx = RES_X + 4 * (SEG_W + SEG_GAP) + 4;
    text(ui, t('ui.hud.mult', { mult: res.mult }), mx, RES_Y - 4, { kind: 'display', size: 13 + Math.round(pulse * 2), color: hot ? C.braise : C.bronze, shadow: true });
    // Indicateur visuel : balancier sur 4 temps sous la jauge, avec la fenêtre de frappe
    // (bande bronze autour de chaque temps) et le curseur qui s'éclaire sur le temps.
    const opt = getSave().options.beatIndicator;
    if (opt === 'visual' || opt === 'both') {
      const bx = RES_X, bw = 4 * (SEG_W + SEG_GAP) - SEG_GAP, by = RES_Y + SEG_H + 6;
      const beatPx = bw / 4;
      const winPx = conductor.isRunning() ? Math.min(beatPx / 2, (conductor.windowMs() / 1000) / conductor.beatDuration() * beatPx) : 4;
      text(ui, t('ui.hud.beat'), bx - 6, by - 3, { size: 8, align: 'right', color: C.gris, shadow: true });
      ui.fillStyle = C.tourbe; ui.fillRect(bx, by - 1, bw, 4);
      ui.globalAlpha = 0.45; ui.fillStyle = C.bronze;
      for (let i = 0; i <= 4; i++) {
        const cx = bx + Math.round(i * beatPx);
        const x0 = Math.max(bx, Math.round(cx - winPx)), x1 = Math.min(bx + bw, Math.round(cx + winPx));
        ui.fillRect(x0, by - 1, x1 - x0, 4);
      }
      ui.globalAlpha = 1;
      for (let i = 0; i < 4; i++) { ui.fillStyle = i === 0 ? C.bronze : C.os; ui.fillRect(bx + Math.round(i * beatPx), by - 2, 2, 6); }
      const pos = conductor.isRunning() ? (conductor.beatInBar() + phase) / 4 : 0;
      const on = st.beatFlash > 0.5;
      ui.fillStyle = on ? C.clair : C.bronze;
      ui.fillRect(bx + Math.round(pos * bw) - 2, by - (on ? 5 : 4), 4, on ? 12 : 10);
    }
    // Jugement rythmique, flottant sous le joueur (au centre de l'écran).
    if (st.judgeT > 0) {
      const key = st.judge === 'parfait' ? 'ui.hud.perfect' : st.judge === 'bon' ? 'ui.hud.good' : 'ui.hud.miss';
      const col = st.judge === 'parfait' ? C.bronze : st.judge === 'bon' ? C.os : C.gris;
      text(ui, t(key), W / 2, H / 2 + 14 - (0.6 - st.judgeT) * 14, { kind: 'display', size: 13, align: 'center', color: col, shadow: true, alpha: Math.min(1, st.judgeT * 3) });
    }
  }

  function renderBuild(ui, g) {
    const p = g.player;
    for (let i = 0; i < p.weapons.length; i++) {
      const w = p.weapons[i], x = 4 + i * 20, y = H - 22;
      drawNineSlice(ui, 'gauge_bg', x, y, 18, 18);
      icon(ui, w.def && w.def.icon ? w.def.icon : w.id, x + 1, y + 1, 0.5);
      text(ui, String(w.level), x + 17, y + 18, { size: 8, align: 'right', baseline: 'bottom', color: C.bronze, shadow: true });
    }
    for (let i = 0; i < p.passives.length; i++) {
      const pa = p.passives[i], x = W - 22 - i * 20, y = H - 22;
      drawNineSlice(ui, 'gauge_bg', x, y, 18, 18);
      icon(ui, pa.def && pa.def.icon ? pa.def.icon : pa.id, x + 1, y + 1, 0.5);
      text(ui, String(pa.level), x + 17, y + 18, { size: 8, align: 'right', baseline: 'bottom', color: C.bronze, shadow: true });
    }
  }

  return {
    reset() {
      res.tier = 0; res.mult = 1; res.value = 0; st.minuteT = 0; st.bannerT = 0; st.judgeT = 0; st.blockedT = 0;
      st.hintT = getSave().stats.runs < HINT_RUNS ? HINT_SEC : 0;
      if (!unsubs.length) listen();
    },
    dispose() { for (const u of unsubs) u(); unsubs.length = 0; },
    update(realDt) {
      if (st.minuteT > 0) st.minuteT -= realDt;
      if (st.bannerT > 0) st.bannerT -= realDt;
      if (st.judgeT > 0) st.judgeT -= realDt;
      if (st.blockedT > 0) st.blockedT -= realDt;
      if (st.beatFlash > 0) st.beatFlash -= realDt * 6;
      if (st.hintT > 0) st.hintT -= realDt;
    },
    render(ui, g) {
      if (!g || !g.player || !g.run || !g.world) return;
      renderTop(ui, g);
      renderControls(ui);
      renderMinute(ui);
      renderBanner(ui, g);
      renderResonance(ui);
      renderBuild(ui, g);
    },
    resonance: res,
  };
}
