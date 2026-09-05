#!/usr/bin/env node
// tests/night.mjs — nuit complète en navigateur réel (Playwright + Chromium headless). Lance une vraie run
// (Cendrelune, Wren, seed fixe, sans Relique), accélère la boucle (loop.setTimeScale ×4, réappliqué après chaque
// écran de cartes, dont la première carte est prise automatiquement), rend le sonneur invulnérable et le pilote avec
// un robot CLAVIER : Espace (Volée) sur chaque temps de la Mesure, Shift (Contre-battement) sur le 4ᵉ coup de la
// cloche horaire, marche par à-coups (ZQSD) ; suit `run:moment`, `run:fissure`, `run:tier`, `run:minute`,
// `bell:ring` / `bell:answered`, `run:boss`, `boss:phase` et `run:end`. À l'arrivée du boss, la boucle repasse à ×1
// (la Mesure est en temps réel : à ×4 les Timbres tirent quatre fois moins par seconde de jeu) et, après le premier
// cri fêlé (ou 16 s), le sonneur reçoit un build complet pour finir le combat et voir les phases « double » et
// « envers ». Capture les bannières (Moments, Fêlure, boss, phases) dans --out.
// Échec si : erreur console / de page / requête ≥ 400 ou échouée ; boss non atteint ; phases cri / double / envers
// non observées ; cloche jamais répondue ; `moment_start` jamais joué (sfx.stats()) ; run non terminée en victoire.
//   node tests/night.mjs                       # serveur attendu sur http://localhost:8080/carillon/
//   node tests/night.mjs --scale 4 --out tests/results/night --json [--parish cendrelune] [--seconds N]
// Prérequis : Playwright dans /opt/node22/lib/node_modules/playwright, Chromium dans /opt/pw-browsers.

import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function opt(name, def) { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; }
const URL_ = opt('url', 'http://localhost:8080/carillon/index.html');
const SECONDS = +opt('seconds', 0);   // 0 = toute la nuit + le boss
const SCALE = +opt('scale', 4);
const OUT = path.resolve(opt('out', 'tests/results/night'));
const PARISH = opt('parish', 'cendrelune');
const JSON_OUT = args.includes('--json');
const PW = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';

function log(...a) { if (!JSON_OUT) console.log(...a); }
const report = { url: URL_, parish: PARISH, scale: SCALE, ok: true, consoleErrors: [], pageErrors: [], badResponses: [], failedRequests: [], duration: 0, moments: [], fissures: [], tiers: [], minutes: [], bells: [], answers: [], boss: [], phases: [], end: null, levels: 0, presses: { dash: 0, parry: 0 }, grades: {}, sfx: {}, shots: [], gameSec: 0, wallSec: 0 };

async function main() {
  if (!existsSync(PW)) throw new Error('Playwright introuvable : ' + PW);
  mkdirSync(OUT, { recursive: true });
  const { chromium } = await import(PW);
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => report.pageErrors.push(String(e.message || e).slice(0, 300)));
  page.on('response', (r) => { if (r.status() >= 400) report.badResponses.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', (r) => report.failedRequests.push(r.url() + ' ' + (r.failure() ? r.failure().errorText : '')));

  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForFunction(() => window.carillon && window.carillon.loop, null, { timeout: 60000 });
  await page.mouse.click(720, 405);   // geste : déblocage audio → titre
  await page.waitForFunction(() => window.carillon.states.topName() === 'title' && !window.carillon.states.isTransitioning(), null, { timeout: 20000 });
  await page.evaluate((parish) => window.carillon.states.replace('run', { parishId: parish, characterId: 'wren', seed: 1717, tutorial: false, noRelic: true }, { fade: false, sound: null }), PARISH);
  await page.waitForFunction(() => window.carillon.deps.game && window.carillon.deps.game.isGameActive(), null, { timeout: 20000 });

  // Journal des événements côté page, cartes automatiques, invulnérabilité, accélération, robot clavier.
  report.duration = await page.evaluate(async (scale) => {
    const c = window.carillon, game = c.deps.game, g = game.gameState();
    const J = (window.__night = { moments: [], fissures: [], tiers: [], minutes: [], bells: [], answers: [], boss: [], phases: [], end: null, levels: 0, presses: { dash: 0, parry: 0 }, grades: {}, bossScale: false, built: false, firstCriAt: 0 });
    const t = () => Math.round(g.run.timeSec * 10) / 10;
    c.bus.on('run:moment', (e) => J.moments.push({ id: e.id, phase: e.phase, t: t() }));
    c.bus.on('run:fissure', (e) => J.fissures.push({ id: e.bossId, phase: e.phase, t: t() }));
    c.bus.on('run:tier', (e) => J.tiers.push({ tier: e.tier, t: t() }));
    c.bus.on('run:minute', (e) => J.minutes.push({ minute: e.minute, t: t() }));
    c.bus.on('bell:ring', (e) => J.bells.push({ minute: e.minute, t: t() }));
    c.bus.on('bell:answered', (e) => J.answers.push({ minute: e.minute, grade: e.grade, bonus: e.bonus, t: t() }));
    c.bus.on('run:boss', (e) => J.boss.push({ id: e.bossId, phase: e.phase, index: e.index, t: t() }));
    c.bus.on('boss:phase', (e) => { J.phases.push({ id: e.bossId, phase: e.phase, index: e.index, timbre: e.timbre || '', t: t() }); if (e.phase === 'cri' && !J.firstCriAt) J.firstCriAt = performance.now(); });
    c.bus.on('rhythm:input', (e) => { J.grades[e.grade] = (J.grades[e.grade] || 0) + 1; });
    c.bus.on('run:end', (e) => { J.end = { victory: e.victory, t: t(), level: e.stats && e.stats.level, kills: e.stats && e.stats.kills, bronze: e.stats && e.stats.bronze }; });
    c.bus.on('level:up', () => J.levels++);
    g.player.iframesT = 1e9;
    // Robot clavier : Espace sur chaque temps (Volée), Shift sur le 4ᵉ coup de la cloche, ZQSD par à-coups.
    const key = (code, downMs) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'Space' ? ' ' : code, bubbles: true })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code === 'Space' ? ' ' : code, bubbles: true })), downMs); };
    let lastBeat = -1, moveCode = null, moveUntil = 0, lastBellMinute = -1;
    const DIRS = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
    let dirIdx = 0;
    setInterval(() => {
      if (!game.isGameActive() || c.states.topName() !== 'run' || c.states.isFrozen()) return;
      g.player.iframesT = 1e9;   // réarmé à chaque tick : la Volée (battement sur place) réécrit iframesT (player.js:372)
      const bell = g.bell;
      const nowA = c.audio.now();
      // Cloche : Contre-battement sur le 4ᵉ coup (une fois par sonnerie).
      if (bell && bell.ringing && !bell.answered && bell.minute !== lastBellMinute && nowA >= bell.strikeAt[3] - 0.004) { lastBellMinute = bell.minute; key('ShiftLeft', 40); J.presses.parry++; return; }
      const b = c.conductor.beatIndex();
      if (b !== lastBeat) {
        lastBeat = b;
        const keepForBell = bell && bell.ringing && !bell.answered && b === bell.fourthBeat - 1;
        if (!keepForBell) { key('Space', 40); J.presses.dash++; }
      }
      // Marche par à-coups : 1,2 s dans une direction, 0,8 s immobile (la Volée sans direction = battement sur place).
      const now = performance.now();
      if (now > moveUntil) {
        if (moveCode) { window.dispatchEvent(new KeyboardEvent('keyup', { code: moveCode, key: moveCode, bubbles: true })); moveCode = null; moveUntil = now + 800; }
        else { moveCode = DIRS[dirIdx++ % 4]; window.dispatchEvent(new KeyboardEvent('keydown', { code: moveCode, key: moveCode, bubbles: true })); moveUntil = now + 1200; }
      }
    }, 8);
    setInterval(async () => {
      const top = c.states.topName();
      if (top === 'levelup' && c.states.topAge() > 1.4) { const s = c.states.screenOf('levelup'); if (s && s.handleAction) s.handleAction('confirm'); return; }
      if (top !== 'run' || c.states.isFrozen() || !game.isGameActive()) return;
      // Boss : temps réel pour le combat ; build complet après le premier cri fêlé (ou 16 s) pour voir les phases suivantes.
      if (g.world && g.world.boss) {
        if (!J.bossScale) { J.bossScale = true; J.bossAt = performance.now(); }
        if (c.loop.stats.timeScale !== 1) c.loop.setTimeScale(1);
        if (!J.built && (J.firstCriAt || performance.now() - J.bossAt > 16000)) {
          J.built = true;
          for (const id of ['bourdon', 'grelots', 'chaine_d_angelus', 'tocsin', 'clarine']) for (let l = 0; l < 7; l++) game.debugGiveWeapon(id);
          for (let l = 0; l < 6; l++) game.debugGiveWeapon('battant');
        }
      } else if (c.loop.stats.timeScale !== scale) c.loop.setTimeScale(scale);
    }, 120);
    return g.world.waveDef.duration;
  }, SCALE);
  log('nuit de', report.duration, 's ; accélération ×' + SCALE + ' (×1 pendant le boss)');

  const seen = new Set();
  let momentIdx = 0, fissureIdx = 0, bossIdx = 0, phaseIdx = 0;
  async function shot(name) {
    const file = path.join(OUT, name + '.png');
    await page.screenshot({ path: file });
    report.shots.push(file);
    log('capture', file);
  }
  const t0 = Date.now();
  const limitMs = ((SECONDS > 0 ? SECONDS : report.duration) / SCALE + 150) * 1000;
  while (Date.now() - t0 < limitMs) {
    const J = await page.evaluate(() => { const g = window.carillon.deps.game.gameState(); return Object.assign({ gameSec: g.run ? g.run.timeSec : 0, active: window.carillon.deps.game.isGameActive() }, window.__night); });
    report.gameSec = J.gameSec;
    for (; momentIdx < J.moments.length; momentIdx++) {
      const m = J.moments[momentIdx];
      if (m.phase === 'start' && !seen.has(m.id)) { seen.add(m.id); await page.waitForTimeout(700); await shot('moment-' + m.id); }
    }
    for (; fissureIdx < J.fissures.length; fissureIdx++) {
      const f = J.fissures[fissureIdx];
      if (f.phase === 'start') { await page.waitForTimeout(600); await shot('fissure-' + f.id); }
    }
    for (; bossIdx < J.boss.length; bossIdx++) { const b = J.boss[bossIdx]; if (b.phase === 'intro') { await page.waitForTimeout(800); await shot('boss-intro'); } }
    for (; phaseIdx < J.phases.length; phaseIdx++) { const ph = J.phases[phaseIdx]; if (!seen.has('phase-' + ph.phase)) { seen.add('phase-' + ph.phase); await page.waitForTimeout(400); await shot('boss-phase-' + ph.phase); } }
    if ((SECONDS > 0 && J.gameSec >= SECONDS) || !J.active || J.end) { if (J.end) report.gameSec = J.end.t; Object.assign(report, { moments: J.moments, fissures: J.fissures, tiers: J.tiers, minutes: J.minutes, bells: J.bells, answers: J.answers, boss: J.boss, phases: J.phases, end: J.end, levels: J.levels, presses: J.presses, grades: J.grades }); break; }
    await page.waitForTimeout(150);
  }
  report.wallSec = Math.round((Date.now() - t0) / 10) / 100;
  try { report.sfx = await page.evaluate(async () => { const s = await import('./src/audio/sfx.js'); const st = s.stats ? s.stats() : {}; return { moment_start: st.moment_start || 0, bell_minute: st.bell_minute || 0, bell_tier: st.bell_tier || 0, boss_roar: st.boss_roar || 0, victory_bell: st.victory_bell || 0 }; }); } catch (e) { report.sfx = { error: String(e).slice(0, 120) }; }
  await shot('final');
  await browser.close();

  const starts = report.moments.filter((m) => m.phase === 'start');
  const kinds = new Set(starts.map((m) => m.id));
  const fissureAt = report.fissures.find((f) => f.phase === 'start');
  const phaseKinds = new Set(report.phases.map((p) => p.phase));
  const errors = report.consoleErrors.length + report.pageErrors.length + report.badResponses.length + report.failedRequests.length;
  const problems = [];
  if (errors) problems.push(errors + ' erreur(s) console / page / réseau');
  if (kinds.size < 2) problems.push('moins de 2 motifs de Moment vus (' + [...kinds].join(', ') + ')');
  if (!fissureAt || Math.abs(fissureAt.t - report.duration * 0.4) > 2) problems.push('Fêlure absente ou hors de 40 % (' + (fissureAt ? fissureAt.t : '–') + ' s)');
  if (SECONDS === 0 || SECONDS >= report.duration) {
    if (!report.boss.some((b) => b.phase === 'start')) problems.push('boss non atteint');
    for (const ph of ['cri', 'double', 'envers']) if (!phaseKinds.has(ph)) problems.push('phase de boss « ' + ph + ' » non observée');
    if (!report.end || !report.end.victory) problems.push('run non terminée en victoire');
  } else if (report.gameSec < SECONDS) problems.push('run interrompue à ' + Math.round(report.gameSec) + ' s');
  if (!report.answers.length) problems.push('cloche jamais répondue (' + report.bells.length + ' sonneries)');
  if (!(report.sfx.moment_start > 0)) problems.push('moment_start jamais joué');
  report.ok = problems.length === 0;
  report.problems = problems;
  if (JSON_OUT) console.log(JSON.stringify(report, null, 1));
  else {
    log('temps de jeu atteint :', Math.round(report.gameSec), 's en', report.wallSec, 's réels ; niveaux :', report.levels, '; frappes clavier :', JSON.stringify(report.presses), '; jugements :', JSON.stringify(report.grades));
    log('Moments :', starts.map((m) => m.id + '@' + Math.round(m.t)).join(' '));
    log('Fêlures :', report.fissures.map((f) => f.id + ':' + f.phase + '@' + Math.round(f.t)).join(' '));
    log('paliers :', report.tiers.map((x) => x.tier + '@' + Math.round(x.t)).join(' '), '; minutes :', report.minutes.map((x) => x.minute).join(','));
    log('cloche :', report.bells.length, 'sonneries,', report.answers.length, 'réponses (' + report.answers.map((a) => 'min ' + a.minute + ' ' + a.grade + ' → ' + a.bonus).join(', ') + ')');
    log('boss :', report.boss.map((b) => b.phase + (b.index ? ' ' + b.index : '') + '@' + Math.round(b.t)).join(' '), '; phases :', report.phases.map((p) => p.phase + (p.timbre ? ':' + p.timbre : '') + '@' + Math.round(p.t)).join(' '));
    log('fin :', report.end ? (report.end.victory ? 'VICTOIRE' : 'défaite') + ' à ' + Math.round(report.end.t) + ' s, niveau ' + report.end.level + ', ' + report.end.kills + ' tués, bronze ' + report.end.bronze : 'aucune');
    log('bruitages :', JSON.stringify(report.sfx));
    log('erreurs console :', report.consoleErrors.length, '; erreurs de page :', report.pageErrors.length, '; réponses ≥ 400 :', report.badResponses.length, '; requêtes échouées :', report.failedRequests.length);
    for (const e of [...report.consoleErrors, ...report.pageErrors, ...report.badResponses, ...report.failedRequests]) log('  -', e);
    for (const p of problems) log('problème :', p);
    log(report.ok ? 'RÉSULTAT : OK' : 'RÉSULTAT : ÉCHEC');
  }
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => { console.error('night.mjs :', e && e.stack || e); process.exit(2); });
