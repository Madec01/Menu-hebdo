// ui/hud-feedback.js — retours rythmiques et de combat du HUD (sous-module de hud.js), tout sur le
// calque HUD en coordonnées écran autour du sonneur :
//  - Parfait / Bon / Raté distincts : Parfait = anneau bronze qui claque (1,3 → 1 en 90 ms) + 4 éclats
//    + « Parfait » en display bronze ; Bon = anneau os, sans mot ; Raté = anneau gris qui se brise en
//    6 arcs + secousse 2 px + « Raté » gris.
//  - « en avance / en retard » : chevron à gauche/droite du mot (et du balancier, hud.js) d'après
//    rhythm:input.early (repli : signe d'offsetMs), avec l'écart en ms.
//  - Changement de cran : flash de vignette bronze 1 frame (fx.flash, respecte reduceFlash), onde de
//    bourdon sur tout l'écran, halo au sol qui change de couleur par cran (lighting.setHaloColor).
//  - resonance:streak {count} (repli : Parfaits consécutifs comptés ici) : compteur discret.
//  - Coup reçu : secousse dirigée (player:hit dirX/dirY, repli : 0), nombre rouge au-dessus du sonneur,
//    bord de l'écran qui s'assombrit côté impact, désaturation 0,2 s (renderer.setDesaturate).
//  - Anneau qui pulse autour du sonneur pendant la sonnerie (gameState().bell).
// Expose offsetAvgMs() (bilan) et streak().

import { bus } from '../core/events.js';
import * as conductor from '../audio/conductor.js';
import * as camera from '../render/camera.js';
import * as renderer from '../render/renderer.js';
import * as lighting from '../render/lighting.js';
import { flash } from '../render/fx.js';
import { t } from './i18n.js';
import { text, chevron, C } from './widgets.js';

const W = 480, H = 270;
const JUDGE_SEC = 0.55, RATE_SHAKE_PX = 2, WAVE_SEC = 0.55, HIT_SEC = 0.5, DESAT_SEC = 0.2;
const HALO_BY_TIER = ['#d9a54c', '#e6b45a', '#f2c86a', '#e0603a'];
const WAVE_COLOR = ['#c9973f', '#c9973f', '#e0b25c', '#e0603a'];

export function createFeedback() {
  const st = {
    grade: '', judgeT: 0, early: false, offset: 0,
    streak: 0, streakFromCore: false,
    tier: 0, waveT: 0, waveTier: 0,
    hitT: 0, hitDmg: 0, hitDirX: 0, hitDirY: 0, hitBig: false,
    offSum: 0, offCount: 0,
  };
  const unsubs = [];

  function listen() {
    unsubs.push(bus.on('rhythm:input', (e) => {
      st.grade = e.grade; st.judgeT = JUDGE_SEC; st.offset = e.offsetMs || 0;
      st.early = e.early !== undefined ? !!e.early : st.offset < 0;
      if (e.grade !== 'rate') { st.offSum += st.offset; st.offCount++; }
      if (e.grade === 'rate') camera.shake(RATE_SHAKE_PX, 0.15);
      if (!st.streakFromCore) st.streak = e.grade === 'parfait' ? st.streak + 1 : 0;
    }));
    unsubs.push(bus.on('resonance:streak', (e) => { st.streakFromCore = true; st.streak = e.count | 0; }));
    unsubs.push(bus.on('resonance:change', (e) => {
      if (e.tier !== st.tier) {
        if (e.tier > st.tier) { flash(WAVE_COLOR[Math.min(3, e.tier)], 1); st.waveT = WAVE_SEC; st.waveTier = e.tier; }
        st.tier = e.tier;
        lighting.setHaloColor(HALO_BY_TIER[Math.max(0, Math.min(3, e.tier))]);
      }
    }));
    unsubs.push(bus.on('player:hit', (e) => {
      st.hitT = HIT_SEC; st.hitDmg = e.damage | 0; st.hitBig = e.damage >= 20;
      st.hitDirX = e.dirX || 0; st.hitDirY = e.dirY || 0;
      const px = Math.min(8, 3 + (e.damage || 0) / 6);
      if (st.hitDirX || st.hitDirY) camera.kick(st.hitDirX, st.hitDirY, px, 0.25);
      else camera.shake(px, 0.25);
    }));
  }

  /** Position écran du sonneur (interpolée par la caméra). */
  function playerScreen(g, out) {
    const p = g.player;
    const s = camera.worldToScreen(p.x, p.y);
    out.x = Math.round(s.x); out.y = Math.round(s.y);
    return out;
  }
  const ps = { x: W / 2, y: H / 2 };

  function renderJudge(ui, g) {
    if (st.judgeT <= 0) return;
    playerScreen(g, ps);
    const k = 1 - st.judgeT / JUDGE_SEC;         // 0 → 1
    const zoom = camera.get().zoom;
    const cx = ps.x, cy = ps.y;
    if (st.grade === 'parfait') {
      // Anneau qui claque : 1,3 → 1 en 90 ms, puis s'estompe ; 4 éclats en croix.
      const snap = k < 0.16 ? 1.3 - 0.3 * (k / 0.16) : 1;
      const a = k < 0.16 ? 1 : Math.max(0, 1 - (k - 0.16) / 0.84);
      const r = 20 * zoom * snap;
      ui.globalAlpha = a; ui.strokeStyle = C.bronze; ui.lineWidth = 2.5;
      ui.beginPath(); ui.ellipse(cx, cy, r, r * 0.5, 0, 0, Math.PI * 2); ui.stroke();
      ui.strokeStyle = C.clair; ui.lineWidth = 1.5; ui.globalAlpha = a * 0.9;
      const len = 6 + 10 * k, off = r + 2;
      ui.beginPath();
      ui.moveTo(cx - off - len, cy); ui.lineTo(cx - off, cy); ui.moveTo(cx + off, cy); ui.lineTo(cx + off + len, cy);
      ui.moveTo(cx, cy - off * 0.5 - len); ui.lineTo(cx, cy - off * 0.5); ui.moveTo(cx, cy + off * 0.5); ui.lineTo(cx, cy + off * 0.5 + len);
      ui.stroke(); ui.globalAlpha = 1;
      // Le mot sous les pieds (jamais dans l'emplacement des bannières ni sur la tête), qui descend un peu.
      const ty = cy + 16 * zoom + k * 8;
      text(ui, t('ui.hud.perfect'), cx, ty, { kind: 'display', size: 15, align: 'center', color: C.bronze, shadow: true, alpha: Math.min(1, a * 1.5) });
      renderEarlyLate(ui, cx, ty + 4, a);
    } else if (st.grade === 'bon') {
      const a = Math.max(0, 1 - k), r = (16 + 10 * k) * zoom;
      ui.globalAlpha = a * 0.9; ui.strokeStyle = C.os; ui.lineWidth = 1.5;
      ui.beginPath(); ui.ellipse(cx, cy, r, r * 0.5, 0, 0, Math.PI * 2); ui.stroke(); ui.globalAlpha = 1;
      renderEarlyLate(ui, cx, cy + 20 * zoom, a);
    } else {
      // Anneau gris qui se brise : 6 arcs qui dérivent vers l'extérieur et s'effacent.
      const a = Math.max(0, 1 - k), r = 18 * zoom + 14 * k;
      ui.globalAlpha = a; ui.strokeStyle = C.gris; ui.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a0 = i * Math.PI / 3 + k * 0.6, a1 = a0 + Math.PI / 3 - 0.25 - k * 0.5;
        const dx = Math.cos(a0 + Math.PI / 6) * 6 * k, dy = Math.sin(a0 + Math.PI / 6) * 3 * k;
        ui.beginPath(); ui.ellipse(cx + dx, cy + dy, r, r * 0.5, 0, a0, Math.max(a0 + 0.05, a1)); ui.stroke();
      }
      ui.globalAlpha = 1;
      const ty = cy + 16 * zoom + k * 6;
      text(ui, t('ui.hud.miss'), cx, ty, { kind: 'display', size: 13, align: 'center', color: C.gris, shadow: true, alpha: a });
      renderEarlyLate(ui, cx, ty + 3, a);
    }
  }

  /** Chevron ◄ (en avance) ou ► (en retard) avec l'écart en ms, à côté du mot. */
  function renderEarlyLate(ui, cx, y, a) {
    const ms = Math.round(Math.abs(st.offset));
    if (ms < 8) return;
    const early = st.early;
    const x = early ? cx - 30 : cx + 30;
    chevron(ui, x, y + 1, early ? Math.PI : 0, 4, early ? C.os : C.bronze, a);
    text(ui, t(early ? 'ui.hud.early' : 'ui.hud.late', { ms }), early ? x - 6 : x + 6, y - 3, { size: 7, align: early ? 'right' : 'left', color: C.gris, shadow: true, alpha: a });
  }

  /** Coup de bourdon visuel : onde qui traverse l'écran depuis le sonneur au changement de cran. */
  function renderWave(ui, g) {
    if (st.waveT <= 0) return;
    playerScreen(g, ps);
    const k = 1 - st.waveT / WAVE_SEC;
    const r = 30 + 520 * k * k;
    ui.globalAlpha = (1 - k) * 0.6; ui.strokeStyle = WAVE_COLOR[Math.min(3, st.waveTier)]; ui.lineWidth = 6 * (1 - k) + 1;
    ui.beginPath(); ui.ellipse(ps.x, ps.y, r, r * 0.6, 0, 0, Math.PI * 2); ui.stroke();
    ui.globalAlpha = (1 - k) * 0.25; ui.lineWidth = 1;
    ui.beginPath(); ui.ellipse(ps.x, ps.y, r * 0.8, r * 0.48, 0, 0, Math.PI * 2); ui.stroke();
    ui.globalAlpha = 1;
  }

  /** Coup reçu : bord assombri côté impact et nombre rouge au-dessus de la tête. */
  function renderHit(ui, g) {
    if (st.hitT <= 0) return;
    const k = st.hitT / HIT_SEC;
    const dx = st.hitDirX, dy = st.hitDirY, has = dx !== 0 || dy !== 0;
    // Le coup vient de -dir : c'est ce bord-là qui s'assombrit (tous les bords si la direction manque).
    ui.globalAlpha = 0.75 * k;
    let grad;
    if (!has) { grad = ui.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.85); }
    else {
      const ex = W / 2 - dx * W / 2, ey = H / 2 - dy * H / 2;   // point du bord côté impact
      grad = ui.createRadialGradient(ex, ey, 0, ex, ey, Math.max(W, H) * 0.7);
      grad.addColorStop(0, 'rgba(70,10,8,0.9)'); grad.addColorStop(0.4, 'rgba(50,8,6,0.45)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    }
    if (!has) { grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(70,10,8,0.9)'); }
    ui.fillStyle = grad; ui.fillRect(0, 0, W, H);
    ui.globalAlpha = 1;
    playerScreen(g, ps);
    const rise = (1 - k) * 18;
    const size = st.hitBig ? 18 : 13;
    text(ui, '-' + st.hitDmg, ps.x + 14, ps.y - 40 * camera.get().zoom - rise, { kind: 'display', size, align: 'center', color: C.braise, shadow: true, alpha: Math.min(1, k * 2) });
  }

  /** Anneau qui pulse autour du sonneur pendant la sonnerie (fort sur le 4ᵉ coup). */
  function renderBellRing(ui, g) {
    const b = g.bell;
    if (!b || !b.ringing) return;
    const phase = conductor.isRunning() ? conductor.phase() : 0, pulse = Math.pow(1 - phase, 3);
    playerScreen(g, ps);
    const strong = b.lit >= 3;
    ui.strokeStyle = strong ? C.braise : C.bronze; ui.lineWidth = strong ? 3 : 2; ui.globalAlpha = 0.25 + 0.65 * pulse;
    ui.beginPath(); ui.ellipse(ps.x, ps.y, 18 + 30 * (1 - pulse), 9 + 15 * (1 - pulse), 0, 0, Math.PI * 2); ui.stroke();
    ui.globalAlpha = 1;
  }

  return {
    reset() {
      st.grade = ''; st.judgeT = 0; st.streak = 0; st.streakFromCore = false; st.tier = 0; st.waveT = 0; st.hitT = 0; st.offSum = 0; st.offCount = 0;
      lighting.setHaloColor(HALO_BY_TIER[0]);
      renderer.setDesaturate(0);
      if (!unsubs.length) listen();
    },
    dispose() { for (const u of unsubs) u(); unsubs.length = 0; renderer.setDesaturate(0); lighting.setHaloColor(HALO_BY_TIER[0]); },
    update(dt) {
      if (st.judgeT > 0) st.judgeT -= dt;
      if (st.waveT > 0) st.waveT -= dt;
      if (st.hitT > 0) st.hitT -= dt;
      renderer.setDesaturate(st.hitT > HIT_SEC - DESAT_SEC ? 0.7 * (st.hitT - (HIT_SEC - DESAT_SEC)) / DESAT_SEC : 0);
    },
    render(ui, g) {
      renderHit(ui, g);
      renderWave(ui, g);
      renderBellRing(ui, g);
      renderJudge(ui, g);
    },
    /** Compteur de Parfaits d'affilée. */
    streak() { return st.streak; },
    /** Décalage moyen signé (ms, > 0 = en retard) des frappes non ratées de la nuit. */
    offsetAvgMs() { return st.offCount ? st.offSum / st.offCount : 0; },
    /** Dernier jugement : { early, offset } pour le chevron du balancier. */
    last() { return st; },
    judgeAlpha() { return st.judgeT > 0 ? st.judgeT / JUDGE_SEC : 0; },
  };
}
