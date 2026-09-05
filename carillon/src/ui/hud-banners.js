// ui/hud-banners.js — file d'attente UNIQUE des bannières du HUD (sous-module de hud.js).
// Un seul emplacement, en haut au centre (y = SLOT_Y), jamais deux textes à la fois, jamais sur le
// sonneur (la zone centrale est interdite). Priorité : boss > Fêlure > cloche > Moment >
// tutoriel-cloche > Sourdine. Une bannière plus prioritaire interrompt celle qui s'affiche ; une
// bannière qui attend trop longtemps (STALE_SEC) est abandonnée. Les barres de vie du Bourdon et de
// la Fêlure ne sont PAS des bannières : elles sont empilées sous le chrono, le Bourdon d'abord.
// Écoute : run:boss, boss:phase (repli : run:boss phase), run:fissure, run:moment, run:minute,
// bell:ring, bell:answered, run:tier. Le voile pâle de l'accalmie et le compte à rebours du Moment
// restent visibles hors bannière (renderVeil, moment actif lu dans world.moments).

import { bus } from '../core/events.js';
import { getSave } from '../core/save.js';
import * as conductor from '../audio/conductor.js';
import { bonusFor } from '../game/bell-hour.js';
import { t, has as hasKey } from './i18n.js';
import { def as dataDef } from './gamedata.js';
import { isActive as touchActive } from './touch.js';
import { panel, text, paragraph, gauge, icon, C } from './widgets.js';

const W = 480, H = 270;
const SLOT_Y = 60, SLOT_Y_BARS = 66;   // haut de l'emplacement (plus bas sous les barres de vie) ; tout reste au-dessus de y = 100 (tête du sonneur)
const BAR_Y = 28;                // barres de vie boss / Fêlure
const FADE = 0.3, STALE_SEC = 6;
const PRIO = { boss: 6, fissure: 5, bell: 4, answered: 4.5, minute: 3.5, moment: 2, tutobell: 1, tier: 0 };

export function createBanners() {
  const queue = [];                 // { kind, prio, dur, wait, data, live }
  let cur = null, curT = 0, out = 0;   // bannière affichée, âge, temps de sortie (0 = pas en sortie)
  let lull = false, bellHintShown = false, hasBossPhaseEvent = false, barsShown = false, quietOn = false, criT = 0;   // criT : secondes restantes du cri fêlé   // boss:phase reçu : run:boss phase n'est plus doublé
  const unsubs = [];

  function push(kind, dur, data = null, live = null) {
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].kind === kind) queue.splice(i, 1);
    queue.push({ kind, prio: PRIO[kind] || 0, dur, wait: 0, data, live });
  }
  function drop(kind) {
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].kind === kind) queue.splice(i, 1);
    if (cur && cur.kind === kind && !out) out = 0.0001;
  }

  function listen() {
    unsubs.push(bus.on('run:boss', (e) => {
      if (e.phase === 'intro') push('boss', 4, { name: t('boss.' + e.bossId + '.name'), sub: t('ui.hud.boss') });
      else if (e.phase === 'phase' && !hasBossPhaseEvent) push('boss', 2.5, { name: t('ui.hud.boss_phase'), sub: t('ui.hud.boss_phase_n', { phase: e.index }), small: true });
    }));
    unsubs.push(bus.on('boss:phase', (e) => {
      hasBossPhaseEvent = true;
      const k = 'boss.' + e.bossId + '.phase_' + e.phase, named = hasKey(k) ? t(k) : '';
      if (e.phase === 'cri') {   // la Mesure glisse d'une croche pendant 2 mesures : bannière courte + balancier rouge (hud.js lit criT)
        criT = conductor.isRunning() ? conductor.beatDuration() * conductor.beatsPerBar() * 2 : 5;
        push('boss', 1.6, { name: named || t('ui.hud.boss_cri'), sub: t('ui.hud.boss_cri_sub'), small: true });
      } else if (e.phase === 'annonce' && e.timbre) {
        const wd = dataDef('weapons', e.timbre), tn = t('weapon.' + e.timbre + '.name');
        push('boss', 2.2, { name: named || t('ui.hud.boss_annonce', { timbre: tn }), sub: named ? tn : '', icon: wd && wd.icon ? wd.icon : e.timbre, small: true });
      } else if (named) push('boss', 2.5, { name: named, sub: typeof e.index === 'number' && e.index > 0 ? t('ui.hud.boss_phase_n', { phase: e.index }) : '', small: true });
      else if (e.bossId === 'bourdon_fele') push('boss', 2.5, { name: t('ui.hud.boss_phase'), sub: '', small: true });
    }));
    unsubs.push(bus.on('run:fissure', (e) => { if (e.phase === 'start') push('fissure', 3, { name: t('enemy.' + e.bossId + '.name'), sub: t('ui.hud.fissure') }); }));
    unsubs.push(bus.on('run:moment', (e) => {
      if (e.phase === 'start') { lull = e.id === 'accalmie'; push('moment', 3.6, { id: e.id }); }
      else { if (e.id === 'accalmie') lull = false; drop('moment'); if (e.id !== 'accalmie') push('moment', 1.4, { end: true }); }
    }));
    unsubs.push(bus.on('run:minute', (e) => push('minute', 2, { minute: e.minute })));
    unsubs.push(bus.on('bell:ring', () => {
      drop('minute');
      if (!bellHintShown && getSave().stats.runs === 0) { bellHintShown = true; push('tutobell', 7); }
    }));
    unsubs.push(bus.on('bell:answered', (e) => { push('answered', 1.6, { bonus: e.bonus || '' }); }));
    unsubs.push(bus.on('run:tier', (e) => push('tier', 2, { tier: e.tier })));
  }

  /** Choisit la bannière à afficher : la plus prioritaire de la file (la cloche « live » compte tant qu'elle sonne). */
  function pick(g) {
    const bell = g.bell && g.bell.ringing;
    let best = null;
    for (let i = queue.length - 1; i >= 0; i--) {
      const q = queue[i];
      if (q.wait > STALE_SEC) { queue.splice(i, 1); continue; }
      if (!best || q.prio > best.prio) best = q;
    }
    if (bell && (!best || PRIO.bell > best.prio)) return { kind: 'bell', prio: PRIO.bell, dur: 99, live: true };
    return best;
  }

  return {
    reset() { queue.length = 0; cur = null; curT = 0; out = 0; lull = false; quietOn = false; criT = 0; bellHintShown = false; hasBossPhaseEvent = false; if (!unsubs.length) listen(); },
    dispose() { for (const u of unsubs) u(); unsubs.length = 0; },
    /** Bannière affichée (ou '') : le HUD s'en sert pour retirer le rappel des commandes. */
    current() { return cur ? cur.kind : ''; },
    /** Mort ou aube : la file se tait (le texte de fin a la place). */
    quiet(on) { quietOn = !!on; },
    /** Cri fêlé du Bourdon en cours (la Mesure est décalée d'une croche) : le balancier rougit. */
    criActive() { return criT > 0; },
    update(dt, g) {
      if (criT > 0) criT -= dt;
      for (let i = 0; i < queue.length; i++) if (queue[i] !== cur) queue[i].wait += dt;
      const bell = g && g.bell && g.bell.ringing;
      if (cur) {
        curT += dt;
        if (cur.live) { if (!bell) out = out || 0.0001; }
        else if (curT >= cur.dur && !out) out = 0.0001;
        const next = pick(g);
        if (next && next !== cur && next.prio > cur.prio && !out) out = 0.0001;   // interruption
        if (out) { out += dt; if (out >= FADE) { const i = queue.indexOf(cur); if (i >= 0) queue.splice(i, 1); cur = null; out = 0; } }
        return;
      }
      const next = pick(g);
      if (next) { cur = next; curT = 0; out = 0; }
    },
    /** Voile pâle de l'accalmie (indépendant de la file). */
    renderVeil(ui) {
      if (!lull) return;
      ui.globalAlpha = 0.1; ui.fillStyle = C.os; ui.fillRect(0, 0, W, H); ui.globalAlpha = 1;
    },
    /** Barres de vie : Bourdon (prioritaire, nom en display) puis Fêlure en mini-jauge dessous. */
    renderBars(ui, g) {
      const world = g.world;
      const boss = world.boss && world.boss.state === 'alive' ? world.boss : null;
      const fissure = world.fissure && world.fissure.state === 'alive' ? world.fissure : null;
      let y = BAR_Y;
      barsShown = !!(boss || fissure);
      if (boss) {
        const name = t('boss.' + world.bossKind + '.name');
        const ratio = boss.maxHp > 0 ? boss.hp / boss.maxHp : 0;
        panel(ui, W / 2 - 110, y, 220, 26, 'dark');
        text(ui, name, W / 2, y + 2, { kind: 'display', size: 11, align: 'center', color: C.braise, shadow: true });
        const phase = boss.phase || 0;
        gauge(ui, W / 2 - 100, y + 16, 200, 6, ratio, { color: phase > 0 ? C.braise : '#b8442a', segments: 2, border: C.gris });
        y += 27;
      }
      if (fissure) {
        const ratio = fissure.maxHp > 0 ? fissure.hp / fissure.maxHp : 0;
        const w = boss ? 120 : 184, h = boss ? 4 : 8;
        if (!boss) { panel(ui, W / 2 - 100, y, 200, 26, 'dark'); text(ui, t('ui.hud.fissure') + ' · ' + t('enemy.' + fissure.kind + '.name'), W / 2, y + 4, { size: 9, align: 'center', color: C.braise }); }
        else text(ui, t('enemy.' + fissure.kind + '.name'), W / 2 - w / 2 - 4, y - 1, { size: 7, align: 'right', color: C.gris, shadow: true });
        gauge(ui, W / 2 - w / 2, y + (boss ? 1 : 15), w, h, ratio, { hot: true, border: boss ? C.tourbe : C.gris });
      }
    },
    /** La bannière courante, dans son emplacement. */
    render(ui, g) {
      if (!cur || quietOn) return;
      const k = out ? Math.max(0, 1 - out / FADE) : Math.min(1, curT / FADE);
      const a = k * k, dy = (1 - a) * -6;
      const y = (barsShown ? SLOT_Y_BARS : SLOT_Y) + dy;
      switch (cur.kind) {
        case 'boss': case 'fissure': {
          const d = cur.data;
          if (d.small) {
            if (d.icon) { ui.globalAlpha = a; icon(ui, d.icon, W / 2 - 100, y + 4, 0.6); ui.globalAlpha = 1; }
            text(ui, d.name, W / 2, y + 4, { kind: 'display', size: 18, align: 'center', color: C.braise, shadow: true, alpha: a });
            if (d.sub) text(ui, d.sub, W / 2, y + 24, { size: 8, align: 'center', color: C.os, shadow: true, alpha: a });
          } else {
            text(ui, d.name, W / 2, y, { kind: 'display', size: 22, align: 'center', color: C.braise, shadow: true, alpha: a });
            text(ui, d.sub, W / 2, y + 24, { size: 9, align: 'center', color: C.os, shadow: true, alpha: a });
          }
          break;
        }
        case 'moment': {
          const d = cur.data;
          if (d.end) { text(ui, t('ui.moment.end'), W / 2, y + 8, { size: 8, align: 'center', color: C.gris, shadow: true, alpha: a }); break; }
          text(ui, t('moment.' + d.id + '.name'), W / 2, y, { kind: 'display', size: 18, align: 'center', color: d.id === 'accalmie' ? C.os : C.bronze, shadow: true, alpha: a });
          text(ui, t('ui.moment.' + d.id), W / 2, y + 21, { size: 8, align: 'center', color: C.os, shadow: true, alpha: a, maxWidth: W - 120 });
          break;
        }
        case 'minute':
          text(ui, t('ui.hud.minute', { minute: cur.data.minute }), W / 2, y + 2, { kind: 'display', size: 20, align: 'center', color: C.bronze, shadow: true, alpha: a });
          break;
        case 'tier':
          text(ui, t('ui.hud.tier', { tier: cur.data.tier }), W / 2, y + 6, { size: 10, align: 'center', color: C.gris, shadow: true, alpha: a });
          break;
        case 'answered':
          text(ui, t('ui.bell.answered'), W / 2, y + 2, { kind: 'display', size: 16, align: 'center', color: C.braise, shadow: true, alpha: a });
          if (cur.data.bonus) text(ui, t('ui.bell.bonus_' + cur.data.bonus), W / 2, y + 20, { size: 9, align: 'center', color: C.clair, shadow: true, alpha: a });
          break;
        case 'bell': renderBell(ui, g, y, a); break;
        case 'tutobell':
          ui.globalAlpha = a;
          panel(ui, W / 2 - 140, y, 280, 34, 'parchment');
          icon(ui, 'ui_lanterne', W / 2 - 132, y + 9, 0.5);
          paragraph(ui, t(touchActive() && hasKey('tutorial.bell_touch') ? 'tutorial.bell_touch' : 'tutorial.bell'), W / 2 - 112, y + 9, 244, { size: 8, color: C.encre, lineHeight: 9, maxLines: 2 });
          ui.globalAlpha = 1;
          break;
        default: break;
      }
    },
  };

  /** « La cloche sonne · Minute N » : 4 points qui s'allument, le 4ᵉ en braise ; anneau autour du sonneur (hud-feedback). */
  function renderBell(ui, g, y, a) {
    const b = g.bell;
    if (!b) return;
    const phase = conductor.isRunning() ? conductor.phase() : 0;
    const pulse = Math.pow(1 - phase, 3);
    ui.globalAlpha = a;
    panel(ui, W / 2 - 76, y, 152, 48, 'dark');
    text(ui, t('ui.bell.ring') + ' · ' + t('ui.hud.minute', { minute: b.minute }), W / 2, y + 8, { size: 9, align: 'center', color: C.clair, shadow: true });
    // Le bonus est annoncé dès la sonnerie (bell-hour.bonusFor est déterministe par minute).
    text(ui, t('ui.bell.answer_hint', { bonus: t('ui.bell.bonus_' + bonusFor(b.minute)) }), W / 2, y + 35, { size: 7, align: 'center', color: C.bronze, shadow: true, maxWidth: 144 });
    for (let k = 0; k < 4; k++) {
      const lit = k < b.lit, last = k === 3;
      const cx = W / 2 - 27 + k * 18, cy = y + 25;
      const rad = (last ? 3.5 : 2.5) + (lit && k === b.lit - 1 ? pulse * 1.5 : 0);
      ui.globalAlpha = (lit ? 1 : 0.35) * a;
      ui.fillStyle = lit ? (last ? C.braise : C.bronze) : C.gris;
      ui.beginPath(); ui.arc(cx, cy, rad, 0, Math.PI * 2); ui.fill();
    }
    ui.globalAlpha = 1;
  }
}
