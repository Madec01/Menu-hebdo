#!/usr/bin/env node
// tests/night.mjs — rythme de la nuit en navigateur réel (Playwright + Chromium headless). Lance une vraie run
// (Cendrelune, Wren, seed fixe, sans Relique), accélère la boucle (loop.setTimeScale, réappliqué après chaque
// écran de cartes, dont la première carte est prise automatiquement), rend le sonneur invulnérable pour aller au
// bout, puis suit `run:moment`, `run:fissure`, `run:tier` et `run:minute` jusqu'à --seconds de temps de jeu.
// Capture les bannières de Moments (chaque motif la première fois) et celle de la Fêlure dans --out.
// Échec si une erreur console, une erreur de page ou une requête en 404/échec est observée, si moins de deux
// motifs différents ont été vus ou si la Fêlure n'est pas arrivée à 40 % de la nuit.
//   node tests/night.mjs                       # serveur attendu sur http://localhost:8080/carillon/
//   node tests/night.mjs --seconds 200 --scale 3 --out tests/results/night --json
// Prérequis : Playwright dans /opt/node22/lib/node_modules/playwright, Chromium dans /opt/pw-browsers.

import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function opt(name, def) { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; }
const URL_ = opt('url', 'http://localhost:8080/carillon/index.html');
const SECONDS = +opt('seconds', 200);
const SCALE = +opt('scale', 3);
const OUT = path.resolve(opt('out', 'tests/results/night'));
const PARISH = opt('parish', 'cendrelune');
const JSON_OUT = args.includes('--json');
const PW = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';

function log(...a) { if (!JSON_OUT) console.log(...a); }
const report = { url: URL_, parish: PARISH, ok: true, consoleErrors: [], pageErrors: [], badResponses: [], failedRequests: [], duration: 0, moments: [], fissures: [], tiers: [], minutes: [], levels: 0, shots: [], gameSec: 0 };

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

  // Journal des événements côté page, cartes automatiques, invulnérabilité, accélération.
  report.duration = await page.evaluate((scale) => {
    const c = window.carillon, g = c.deps.game.gameState();
    const J = (window.__night = { moments: [], fissures: [], tiers: [], minutes: [], levels: 0 });
    const t = () => Math.round(g.run.timeSec * 10) / 10;
    c.bus.on('run:moment', (e) => J.moments.push({ id: e.id, phase: e.phase, t: t() }));
    c.bus.on('run:fissure', (e) => J.fissures.push({ id: e.bossId, phase: e.phase, t: t() }));
    c.bus.on('run:tier', (e) => J.tiers.push({ tier: e.tier, t: t() }));
    c.bus.on('run:minute', (e) => J.minutes.push({ minute: e.minute, t: t() }));
    c.bus.on('level:up', () => J.levels++);
    g.player.iframesT = 1e9;
    setInterval(() => {
      const top = c.states.topName();
      if (top === 'levelup' && c.states.topAge() > 1.4) { const s = c.states.screenOf('levelup'); if (s && s.handleAction) s.handleAction('confirm'); }
      else if (top === 'run' && !c.states.isFrozen() && c.loop.stats.timeScale !== scale) c.loop.setTimeScale(scale);
    }, 120);
    return g.world.waveDef.duration;
  }, SCALE);
  log('nuit de', report.duration, 's ; accélération ×' + SCALE);

  const seen = new Set();
  let momentIdx = 0, fissureIdx = 0;
  async function shot(name) {
    const file = path.join(OUT, name + '.png');
    await page.screenshot({ path: file });
    report.shots.push(file);
    log('capture', file);
  }
  const t0 = Date.now();
  while (Date.now() - t0 < (SECONDS / SCALE + 90) * 1000) {
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
    if (J.gameSec >= SECONDS || !J.active) { Object.assign(report, { moments: J.moments, fissures: J.fissures, tiers: J.tiers, minutes: J.minutes, levels: J.levels }); break; }
    await page.waitForTimeout(150);
  }
  await shot('final');
  await browser.close();

  const starts = report.moments.filter((m) => m.phase === 'start');
  const kinds = new Set(starts.map((m) => m.id));
  const fissureAt = report.fissures.find((f) => f.phase === 'start');
  const errors = report.consoleErrors.length + report.pageErrors.length + report.badResponses.length + report.failedRequests.length;
  const problems = [];
  if (errors) problems.push(errors + ' erreur(s) console / page / réseau');
  if (kinds.size < 2) problems.push('moins de 2 motifs de Moment vus (' + [...kinds].join(', ') + ')');
  if (!fissureAt || Math.abs(fissureAt.t - report.duration * 0.4) > 2) problems.push('Fêlure absente ou hors de 40 % (' + (fissureAt ? fissureAt.t : '–') + ' s)');
  if (report.gameSec < SECONDS) problems.push('run interrompue à ' + Math.round(report.gameSec) + ' s');
  report.ok = problems.length === 0;
  report.problems = problems;
  if (JSON_OUT) console.log(JSON.stringify(report, null, 1));
  else {
    log('temps de jeu atteint :', Math.round(report.gameSec), 's ; niveaux :', report.levels);
    log('Moments :', starts.map((m) => m.id + '@' + Math.round(m.t)).join(' '));
    log('Fêlures :', report.fissures.map((f) => f.id + ':' + f.phase + '@' + Math.round(f.t)).join(' '));
    log('paliers :', report.tiers.map((x) => x.tier + '@' + Math.round(x.t)).join(' '), '; minutes :', report.minutes.map((x) => x.minute).join(','));
    log('erreurs console :', report.consoleErrors.length, '; erreurs de page :', report.pageErrors.length, '; réponses ≥ 400 :', report.badResponses.length, '; requêtes échouées :', report.failedRequests.length);
    for (const e of [...report.consoleErrors, ...report.pageErrors, ...report.badResponses, ...report.failedRequests]) log('  -', e);
    for (const p of problems) log('problème :', p);
    log(report.ok ? 'RÉSULTAT : OK' : 'RÉSULTAT : ÉCHEC');
  }
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => { console.error('night.mjs :', e && e.stack || e); process.exit(2); });
