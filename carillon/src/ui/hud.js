// ui/hud.js — HUD de la nuit : vie (avec « ghost » des PV perdus) et XP sur deux lignes séparées,
// chrono, barre de nuit (durée réelle de waves.json, repères des Fêlures, losanges des Moments à venir,
// compte à rebours du prochain Moment et du Moment en cours), tués, jauge de Résonance à 4 segments
// plats qui pulsent sur le temps, compteur de Parfaits, balancier (option beatIndicator) avec chevron
// « en avance / en retard », icônes de Timbres/Accords avec niveau (portée du Timbre au survol :
// hud-markers.js), Relique portée (info-bulle), rappel des commandes (premières nuits, retiré pendant
// une bannière), statuts Bâillonné/Étouffé au-dessus de la tête.
// Sous-modules : hud-banners.js (file unique de bannières + barres de vie boss/Fêlure), hud-feedback.js
// (Parfait/Bon/Raté, cran, coup reçu, cloche), hud-markers.js (hors-écran, portée).
// Mode tactile (ui/touch.js) : rien sous les pouces — Résonance décalée, Timbres/Accords en rangée sous
// la vie, tués décalés à gauche du bouton pause.

import { bus } from '../core/events.js';
import { getSave } from '../core/save.js';
import * as conductor from '../audio/conductor.js';
import { getBindings, hasGamepad, rumble } from '../core/input.js';
import * as camera from '../render/camera.js';
import { t, fmtTime } from './i18n.js';
import { def as dataDef } from './gamedata.js';
import { keyName } from './options-items.js';
import { mouse } from './states.js';
import { isActive as touchActive } from './touch.js';
import { panel, text, paragraph, gauge, icon, keycap, hit, chevron, C } from './widgets.js';
import { createBanners } from './hud-banners.js';
import { createFeedback } from './hud-feedback.js';
import { renderOffscreen, renderWeaponRange } from './hud-markers.js';

const W = 480, H = 270;
const HUD_RES_X = W / 2 - 74, RES_X_TOUCH = W / 2 - 110, RES_Y = H - 24, SEG_W = 34, SEG_H = 8, SEG_GAP = 4;
const HINT_SEC = 30;        // durée du rappel des commandes
const HINT_RUNS = 3;        // … affiché tant que le joueur a fini moins de 3 nuits
const RELIC_RECT = { x: 4, y: 46, w: 18, h: 18 }, RELIC_RECT_TOUCH = { x: 4, y: 54, w: 18, h: 18 };
const NIGHT_W = 120, NIGHT_Y = 25;
const NEXT_MOMENT_SEC = 10;  // le compte à rebours du prochain Moment s'affiche sous ce seuil
const GHOST_DECAY = 0.35;    // vitesse à laquelle le ghost de vie rattrape la vie

export function createHud() {
  const res = { tier: 0, mult: 1, value: 0 };
  const st = { beatFlash: 0, blockedT: 0, hintT: 0, ghostHp: 1, hover: null, hoverRect: { x: 0, y: 0 }, quiet: false };
  const banners = createBanners();
  const feedback = createFeedback();
  const unsubs = [];

  function listen() {
    unsubs.push(bus.on('resonance:change', (e) => {
      if (e.tier >= 3 && res.tier < 3 && e.direction > 0) rumble(0.4, 160);   // cran 4 atteint
      res.tier = e.tier; res.mult = e.mult; res.value = e.value;
    }));
    unsubs.push(bus.on('resonance:blocked', (e) => { st.blockedT = e.durationSec; }));
    unsubs.push(bus.on('beat', () => { st.beatFlash = 1; if (res.tier >= 3) rumble(0.12, 40); }));
  }

  /** Barre de nuit : progression, repères des Fêlures, losanges des Moments à venir, aube ; compte à rebours. */
  function renderNight(ui, g) {
    const def = g.world.waveDef, dur = def && def.duration > 0 ? def.duration : 1;
    const w = NIGHT_W, x = W / 2 - w / 2, y = NIGHT_Y;
    const now = g.run.timeSec;
    ui.fillStyle = C.tourbe; ui.fillRect(x, y, w, 3);
    ui.fillStyle = C.bronze; ui.fillRect(x, y, Math.round(w * Math.min(1, now / dur)), 3);
    const mo = g.world.moments;
    if (mo && mo.list) {
      for (let i = mo.idx || 0; i < mo.list.length; i++) {
        const m = mo.list[i];
        if (m.at < now) continue;
        const mx = x + Math.round(w * Math.min(1, m.at / dur));
        chevron(ui, mx, y - 3, -Math.PI / 2, 3, m.id === 'accalmie' ? C.os : C.gris, 0.9);
      }
    }
    ui.fillStyle = C.braise;
    if (def && def.events) for (let i = 0; i < def.events.length; i++) if (def.events[i].type === 'fissure') ui.fillRect(x + Math.round(w * def.events[i].at / dur), y - 1, 1, 5);
    ui.fillStyle = C.clair; ui.fillRect(x + w - 1, y - 1, 1, 5);
    // Moment en cours : temps restant ; sinon prochain Moment sous 10 s.
    if (mo && mo.active) {
      const left = Math.max(0, mo.active.sec - mo.t);
      const bw = 40, bx = x + w + 6;   // à droite de la barre de nuit, hors du chrono et des bannières
      ui.fillStyle = C.tourbe; ui.fillRect(bx, y + 6, bw, 2);
      ui.fillStyle = mo.active.id === 'accalmie' ? C.os : C.bronze; ui.fillRect(bx, y + 6, Math.round(bw * left / Math.max(0.01, mo.active.sec)), 2);
      text(ui, t('moment.' + mo.active.id + '.name') + ' · ' + t('ui.moment.remaining', { sec: Math.ceil(left) }), x + w + 6, y - 3, { size: 7, color: C.gris, shadow: true, maxWidth: 110 });
    } else if (mo && mo.list && mo.idx < mo.list.length) {
      const next = mo.list[mo.idx], left = next.at - now;
      if (left > 0 && left <= NEXT_MOMENT_SEC) text(ui, t('ui.hud.next_moment', { name: t('moment.' + next.id + '.name'), sec: Math.ceil(left) }), x + w + 6, y - 3, { size: 7, color: C.gris, shadow: true, maxWidth: 110, alpha: 0.5 + 0.5 * Math.min(1, (NEXT_MOMENT_SEC - left) / 2) });
    }
  }

  /** Icône de la Relique portée, info-bulle (nom + description) au survol. */
  function renderRelic(ui, g) {
    const id = g.run.relicId;
    if (!id) return;
    const d = dataDef('relics', id);
    const r = touchActive() ? RELIC_RECT_TOUCH : RELIC_RECT;
    slot(ui, r.x, r.y, r.w, r.h);
    icon(ui, d && d.icon ? d.icon : 'ui_sceau', r.x + 1, r.y + 1, 0.5);
    if (!mouse.inside || !hit(r, mouse.x, mouse.y)) return;
    const tx = r.x + r.w + 6, tw = 170;
    panel(ui, tx - 6, r.y - 6, tw + 12, 46, 'dark');
    text(ui, t('ui.relic.hud'), tx, r.y - 2, { size: 7, color: C.gris });
    text(ui, t(d ? d.name : 'relic.' + id + '.name'), tx, r.y + 7, { size: 9, color: C.bronze });
    paragraph(ui, t(d ? d.desc : 'relic.' + id + '.desc'), tx, r.y + 19, tw, { size: 7, color: C.os, lineHeight: 8, maxLines: 2 });
  }

  /** Rappel discret des commandes (premières nuits, 30 s), retiré tant qu'une bannière est affichée. */
  function renderControls(ui) {
    if (st.hintT <= 0 || banners.current()) return;
    const a = Math.min(1, st.hintT / 0.8);
    ui.globalAlpha = a;
    const y = 31;
    if (touchActive()) { text(ui, t('ui.touch.hint'), W / 2, 66, { size: 8, align: 'center', color: C.os, shadow: true, maxWidth: W - 40 }); ui.globalAlpha = 1; return; }
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
    const p = g.player, run = g.run;
    // Vie (ghost des PV perdus) puis XP, sur deux lignes distinctes.
    icon(ui, 'ui_coeur', 4, 4, 0.5);
    const hpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 0;
    gauge(ui, 22, 6, 110, 11, hpRatio, { hot: hpRatio < 0.3, ghost: st.ghostHp, label: Math.ceil(p.hp) + ' / ' + p.maxHp, size: 9 });
    gauge(ui, 22, 19, 110, 5, run.nextXp > 0 ? run.xp / run.nextXp : 0, { color: '#a88a4e', border: C.tourbe });
    text(ui, t('ui.hud.level', { level: run.level }), 136, 17, { size: 9, color: C.bronze, shadow: true });
    // Chrono et barre de nuit.
    text(ui, fmtTime(run.timeSec), W / 2, 4, { kind: 'display', size: 18, align: 'center', color: C.os, shadow: true });
    renderNight(ui, g);
    // Tués et assistance (décalés à gauche du bouton pause tactile).
    const kx = touchActive() ? W - 60 : W;
    icon(ui, 'ui_mort', kx - 20, 4, 0.5);
    text(ui, t('ui.hud.kills', { kills: run.kills }), kx - 24, 8, { size: 12, align: 'right', color: C.os, shadow: true });
    const assist = getSave().options.assist;
    if (assist !== 'none') text(ui, t('ui.hud.assist_' + assist), kx - 6, 22, { size: 8, align: 'right', color: C.gris, shadow: true });
    // Statuts au-dessus de la tête du sonneur (jamais dans l'emplacement des bannières).
    if (p.silencedT > 0 || st.blockedT > 0) {
      const s = camera.worldToScreen(p.x, p.y);
      text(ui, t(p.silencedT > 0 ? 'ui.hud.silenced' : 'ui.hud.blocked'), Math.round(s.x), Math.round(s.y) - 78 * camera.get().zoom, { size: 9, align: 'center', color: C.gris, shadow: true });
    }
  }

  function renderResonance(ui) {
    const phase = conductor.isRunning() ? conductor.phase() : 0;
    const pulse = Math.pow(1 - phase, 3);
    const hot = res.tier >= 3;
    const RES_X = touchActive() ? RES_X_TOUCH : HUD_RES_X;
    text(ui, t('ui.hud.resonance'), RES_X - 6, RES_Y - 1, { size: 8, align: 'right', color: C.gris, shadow: true });
    for (let i = 0; i < 4; i++) {
      const x = RES_X + i * (SEG_W + SEG_GAP);
      const fill = i < res.tier ? 1 : i === res.tier ? res.value : 0;
      const grow = i === res.tier ? Math.round(pulse * 2) : 0;
      gauge(ui, x, RES_Y - grow, SEG_W, SEG_H + grow * 2, fill, { hot, color: hot ? C.braise : i < res.tier ? C.bronze : '#b08640', border: i < res.tier || (i === res.tier && fill > 0) ? C.bronze : C.encreClaire });
    }
    const mx = RES_X + 4 * (SEG_W + SEG_GAP) + 4;
    text(ui, t('ui.hud.mult', { mult: res.mult }), mx, RES_Y - 4, { kind: 'display', size: 13 + Math.round(pulse * 2), color: hot ? C.braise : C.bronze, shadow: true });
    const streak = feedback.streak();
    if (streak >= 3) text(ui, t('ui.hud.streak', { count: streak }), mx + 34, RES_Y + 1, { size: 7, color: hot ? C.braise : C.os, shadow: true, alpha: 0.85 });
    // Indicateur visuel : balancier sur 4 temps sous la jauge, avec la fenêtre de frappe
    // (bande bronze autour de chaque temps), le curseur qui s'éclaire sur le temps et le chevron du
    // dernier jugement (◄ en avance / ► en retard) à côté du balancier.
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
      const ja = feedback.judgeAlpha();
      if (ja > 0 && Math.abs(feedback.last().offset) >= 8) {
        const early = feedback.last().early;
        chevron(ui, early ? bx + bw + 8 : bx + bw + 8, by + 1, early ? Math.PI : 0, 4, early ? C.os : C.bronze, ja);
      }
    }
  }

  /** Emplacement d'icône (fond plat, liseré). */
  function slot(ui, x, y, w, h) {
    ui.globalAlpha = 0.7; ui.fillStyle = C.suie; ui.fillRect(x, y, w, h); ui.globalAlpha = 1;
    ui.fillStyle = C.encreClaire; ui.fillRect(x, y, w, 1); ui.fillRect(x, y + h - 1, w, 1); ui.fillRect(x, y, 1, h); ui.fillRect(x + w - 1, y, 1, h);
  }

  function buildIcon(ui, it, x, y) {
    slot(ui, x, y, 18, 18);
    icon(ui, it.def && it.def.icon ? it.def.icon : it.id, x + 1, y + 1, 0.5);
    text(ui, String(it.level), x + 17, y + 18, { size: 8, align: 'right', baseline: 'bottom', color: C.bronze, shadow: true });
  }

  function renderBuild(ui, g) {
    const p = g.player;
    st.hover = null;
    const hoverable = mouse.inside && !touchActive();
    const place = (it, x, y, weapon) => {
      buildIcon(ui, it, x, y);
      if (weapon && hoverable && hit({ x, y, w: 18, h: 18 }, mouse.x, mouse.y)) { st.hover = it; st.hoverRect.x = x; st.hoverRect.y = y; }
    };
    if (touchActive()) {
      let x = 4;
      const y = 31;
      for (const list of [p.weapons, p.passives]) { for (let i = 0; i < list.length; i++) { place(list[i], x, y, list === p.weapons); x += 20; } x += 6; }
      return;
    }
    for (let i = 0; i < p.weapons.length; i++) place(p.weapons[i], 4 + i * 20, H - 22, true);
    for (let i = 0; i < p.passives.length; i++) place(p.passives[i], W - 22 - i * 20, H - 22, false);
  }

  return {
    reset() {
      res.tier = 0; res.mult = 1; res.value = 0; st.blockedT = 0; st.ghostHp = 1; st.hover = null; st.quiet = false;
      st.hintT = getSave().stats.runs < HINT_RUNS ? HINT_SEC : 0;
      banners.reset(); feedback.reset();
      if (!unsubs.length) listen();
    },
    dispose() { for (const u of unsubs) u(); unsubs.length = 0; banners.dispose(); feedback.dispose(); },
    update(realDt, g) {
      if (st.blockedT > 0) st.blockedT -= realDt;
      if (st.beatFlash > 0) st.beatFlash -= realDt * 6;
      if (st.hintT > 0 && !banners.current()) st.hintT -= realDt;   // le rappel ne s'use pas sous une bannière
      banners.update(realDt, g);
      feedback.update(realDt);
      if (g && g.player) {
        const hp = g.player.maxHp > 0 ? g.player.hp / g.player.maxHp : 0;
        if (hp >= st.ghostHp) st.ghostHp = hp; else st.ghostHp = Math.max(hp, st.ghostHp - GHOST_DECAY * realDt);
      }
    },
    render(ui, g) {
      if (!g || !g.player || !g.run || !g.world) return;
      banners.renderVeil(ui);
      renderTop(ui, g);
      renderControls(ui);
      banners.renderBars(ui, g);
      banners.render(ui, g);
      renderOffscreen(ui, g);
      if (!st.quiet) feedback.render(ui, g);
      renderResonance(ui);
      renderBuild(ui, g);
      if (st.hover) renderWeaponRange(ui, g, st.hover, st.hoverRect);
      renderRelic(ui, g);
    },
    /** Fin de run (mort / aube) : bannières et retours se taisent, le texte de fin a la place. */
    setQuiet(on) { banners.quiet(on); st.quiet = !!on; },
    resonance: res,
    feedback,
    banners,
  };
}
