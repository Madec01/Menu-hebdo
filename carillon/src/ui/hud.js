// ui/hud.js — HUD de la nuit : vie, XP, timer, tués, jauge de Résonance à 4
// crans qui pulse sur le temps, icônes de Timbres/Accords avec niveau,
// sonnerie visuelle à chaque minute, bannière de Fêlure/Bourdon avec barre de
// vie, indicateur de rythme visuel (option beatIndicator : balancier avec la
// fenêtre de frappe), retour Parfait/Bon/Raté sous le joueur, rappel des
// commandes pendant les 30 premières secondes des premières nuits, vibration
// légère de la manette au cran 4. Lit gameState() et les événements du bus.
// § 11 bis : icône de la Relique portée (info-bulle au survol), bannière « La cloche sonne »
// avec 4 points (gameState().bell), anneau qui pulse autour du sonneur pendant la sonnerie,
// « Répondu ! » sur bell:answered, ligne de tutoriel (tutorial.bell) à la 1re cloche de la 1re nuit.

import { bus } from '../core/events.js';
import { getSave } from '../core/save.js';
import * as conductor from '../audio/conductor.js';
import { getBindings, hasGamepad, rumble } from '../core/input.js';
import * as camera from '../render/camera.js';
import { t, fmtTime } from './i18n.js';
import { def as dataDef } from './gamedata.js';
import { keyName } from './options-items.js';
import { mouse } from './states.js';
import { panel, text, paragraph, gauge, icon, keycap, hit, C } from './widgets.js';
import { drawNineSlice } from '../render/atlas.js';

const W = 480, H = 270;
const RES_X = W / 2 - 74, RES_Y = H - 24, SEG_W = 34, SEG_H = 8, SEG_GAP = 4;
const HINT_SEC = 30;        // durée du rappel des commandes
const HINT_RUNS = 3;        // … affiché tant que le joueur a fini moins de 3 nuits
const RELIC_RECT = { x: 4, y: 46, w: 18, h: 18 };
const BELL_HINT_SEC = 7;

export function createHud() {
  const res = { tier: 0, mult: 1, value: 0 };
  const st = { minuteT: 0, minute: 0, bannerT: 0, bannerKind: '', bannerName: '', judgeT: 0, judge: '', beatFlash: 0, blockedT: 0, lastBeat: -1, hintT: 0,
    answerT: 0, answerBonus: '', bellHintT: 0, bellHintShown: false };
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
    unsubs.push(bus.on('bell:ring', () => { if (!st.bellHintShown && getSave().stats.runs === 0) { st.bellHintShown = true; st.bellHintT = BELL_HINT_SEC; } }));
    unsubs.push(bus.on('bell:answered', (e) => { st.answerT = 1.6; st.answerBonus = e.bonus || ''; rumble(0.3, 120); }));
  }

  /** Icône de la Relique portée, info-bulle (nom + description) au survol. */
  function renderRelic(ui, g) {
    const id = g.run.relicId;
    if (!id) return;
    const d = dataDef('relics', id);
    const r = RELIC_RECT;
    drawNineSlice(ui, 'gauge_bg', r.x, r.y, r.w, r.h);
    icon(ui, d && d.icon ? d.icon : 'ui_sceau', r.x + 1, r.y + 1, 0.5);
    if (!mouse.inside || !hit(r, mouse.x, mouse.y)) return;
    const tx = r.x + r.w + 6, tw = 170;
    panel(ui, tx - 6, r.y - 6, tw + 12, 46, 'dark');
    text(ui, t('ui.relic.hud'), tx, r.y - 2, { size: 7, color: C.gris });
    text(ui, t(d ? d.name : 'relic.' + id + '.name'), tx, r.y + 7, { size: 9, color: C.bronze });
    paragraph(ui, t(d ? d.desc : 'relic.' + id + '.desc'), tx, r.y + 19, tw, { size: 7, color: C.os, lineHeight: 8, maxLines: 2 });
  }

  /** La cloche sonne : bannière à 4 points, anneau autour du sonneur, « Répondu ! », ligne de tutoriel. */
  function renderBell(ui, g) {
    const b = g.bell, world = g.world;
    const busy = (world.boss && world.boss.state === 'alive') || (world.fissure && world.fissure.state === 'alive');
    let y = busy ? 60 : st.hintT > 0 ? 46 : 32;   // sous la bannière de Fêlure/Bourdon ou le rappel des commandes
    if (b && b.ringing) {
      const phase = conductor.isRunning() ? conductor.phase() : 0;
      const pulse = Math.pow(1 - phase, 3);
      panel(ui, W / 2 - 76, y, 152, 34, 'dark');
      text(ui, t('ui.bell.ring') + ' · ' + t('ui.hud.minute', { minute: b.minute }), W / 2, y + 8, { size: 9, align: 'center', color: C.clair, shadow: true });
      for (let k = 0; k < 4; k++) {
        const lit = k < b.lit, last = k === 3;
        const cx = W / 2 - 27 + k * 18, cy = y + 25;
        const rad = (last ? 3.5 : 2.5) + (lit && k === b.lit - 1 ? pulse * 1.5 : 0);
        ui.globalAlpha = lit ? 1 : 0.35;
        ui.fillStyle = lit ? (last ? C.braise : C.bronze) : C.gris;
        ui.beginPath(); ui.arc(cx, cy, rad, 0, Math.PI * 2); ui.fill();
      }
      ui.globalAlpha = 1;
      // Anneau qui pulse autour du sonneur (plus fort sur le 4ᵉ coup).
      const p = g.player, ps = camera.worldToScreen(p.x, p.y);
      const px = Math.round(ps.x), py = Math.round(ps.y);
      const strong = b.lit >= 3;
      ui.strokeStyle = strong ? C.braise : C.bronze; ui.lineWidth = strong ? 3 : 2; ui.globalAlpha = 0.25 + 0.65 * pulse;
      ui.beginPath(); ui.ellipse(px, py, 18 + 30 * (1 - pulse), 9 + 15 * (1 - pulse), 0, 0, Math.PI * 2); ui.stroke();
      ui.globalAlpha = 1;
      y += 38;
    }
    if (st.answerT > 0) {
      const a = Math.min(1, st.answerT * 2);
      const ty = H / 2 - 34 - (1.6 - st.answerT) * 8;
      text(ui, t('ui.bell.answered'), W / 2, ty, { kind: 'display', size: 16, align: 'center', color: C.braise, shadow: true, alpha: a });
      if (st.answerBonus) text(ui, t('ui.bell.bonus_' + st.answerBonus), W / 2, ty + 18, { size: 9, align: 'center', color: C.clair, shadow: true, alpha: a });
    }
    if (st.bellHintT > 0) {
      const a = Math.min(1, st.bellHintT / 0.6);
      ui.globalAlpha = a;
      panel(ui, W / 2 - 140, y, 280, 34, 'parchment');
      icon(ui, 'ui_lanterne', W / 2 - 132, y + 9, 0.5);
      paragraph(ui, t('tutorial.bell'), W / 2 - 112, y + 9, 244, { size: 8, color: C.encre, lineHeight: 9, maxLines: 2 });
      ui.globalAlpha = 1;
    }
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

  function renderMinute(ui, g) {
    if (st.minuteT <= 0 || (g.bell && g.bell.ringing)) return;
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
      st.answerT = 0; st.bellHintT = 0; st.bellHintShown = false;
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
      if (st.answerT > 0) st.answerT -= realDt;
      if (st.bellHintT > 0) st.bellHintT -= realDt;
    },
    render(ui, g) {
      if (!g || !g.player || !g.run || !g.world) return;
      renderTop(ui, g);
      renderControls(ui);
      renderMinute(ui, g);
      renderBanner(ui, g);
      renderBell(ui, g);
      renderResonance(ui);
      renderBuild(ui, g);
      renderRelic(ui, g);
    },
    resonance: res,
  };
}
