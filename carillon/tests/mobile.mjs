#!/usr/bin/env node
// tests/mobile.mjs — jouabilité mobile (agent T) : émulation tactile Playwright (isMobile, hasTouch,
// densité 3 / 2.625) sur 812×375 (iPhone) et 915×412 (Android), en FR et EN. Parcours au doigt :
// « Cliquez pour sonner » → titre → hub → « Sonner la nuit » → Relique → run avec joystick virtuel
// (CDP Input.dispatchTouchEvent, multi-doigts) et taps Volée calés sur conductor.nextBeatAt (grades
// lus sur rhythm:input) → cartes de niveau au tap → pause au bouton → options qui défilent au doigt →
// voile portrait. Échec (code 1) : erreur console, erreur de page, réponse ≥ 400, requête échouée,
// état inattendu, ou moins de 60 % de « Parfait ».
//   node tests/mobile.mjs [--url http://localhost:8080/carillon/index.html] [--out dir]
//                         [--devices iphone,android,lowdpi] [--langs fr,en] [--beats 16] [--headed] [--json]

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const flag = (name) => args.includes('--' + name);
const URL = opt('url', 'http://localhost:8080/carillon/index.html');
const OUT = opt('out', path.join(os.tmpdir(), 'carillon-mobile'));
const DEVICES = opt('devices', 'iphone,android').split(',');
const LANGS = opt('langs', 'fr,en').split(',');
const BEATS = Math.max(4, parseInt(opt('beats', '16'), 10) || 16);
const PW = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
const { chromium, devices } = await import(PW);

const PROFILES = {
  iphone: { viewport: { width: 812, height: 375 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent },
  android: { viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent },
  // Téléphone peu dense (DPR 2) : échelle ×2 en pixels physiques, cssScale = 1, polices +1 (widgets.setTextBump).
  lowdpi: { viewport: { width: 812, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['Pixel 7'].userAgent },
};
const W = 480, H = 270;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(OUT, { recursive: true });

/** Un parcours complet sur un profil et une langue ; renvoie un rapport. */
async function run(browser, device, lang) {
  const tag = device + '-' + lang;
  const report = { tag, errors: [], steps: [], grades: {}, ok: true };
  const fail = (msg) => { report.ok = false; report.errors.push(msg); };
  const context = await browser.newContext({ ...PROFILES[device], locale: lang === 'fr' ? 'fr-FR' : 'en-US' });
  await context.addInitScript((save) => {
    if (!localStorage.getItem('carillon.save')) localStorage.setItem('carillon.save', JSON.stringify(save));
  }, { version: 2, tutorialDone: true, stats: { runs: 1 }, options: { lang } });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') fail('console: ' + m.text()); });
  page.on('pageerror', (e) => fail('pageerror: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) fail(r.status() + ' ' + r.url()); });
  page.on('requestfailed', (r) => fail('requestfailed ' + r.url()));
  const cdp = await context.newCDPSession(page);

  const top = () => page.evaluate(() => window.carillon && window.carillon.states.topName());
  const shot = (name) => page.screenshot({ path: path.join(OUT, tag + '-' + name + '.png') });
  const step = (name, ok, detail = '') => { report.steps.push({ name, ok, detail }); if (!ok) fail(name + (detail ? ' : ' + detail : '')); };
  /** Conversion pixels logiques → pixels CSS du canvas. */
  const toCss = async (x, y) => page.evaluate(([lx, ly, w, h]) => {
    const r = document.getElementById('game').getBoundingClientRect();
    return { x: r.left + lx * r.width / w, y: r.top + ly * r.height / h };
  }, [x, y, W, H]);
  const touch = async (type, points) => {
    const pts = [];
    for (const p of points) { const c = await toCss(p.x, p.y); pts.push({ x: c.x, y: c.y, id: p.id, radiusX: 4, radiusY: 4, force: 1 }); }
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  };
  const tap = async (x, y, id = 5, holdMs = 40) => { await touch('touchStart', [{ x, y, id }]); await sleep(holdMs); await touch('touchEnd', []); };
  const waitTop = async (name, ms = 6000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if ((await top()) === name) return true; await sleep(80); }
    return false;
  };

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.carillon && window.carillon.states.topName() === 'unlock', null, { timeout: 30000 });
  await sleep(600);
  report.canvas = await page.evaluate(() => { const c = document.getElementById('game'); return { width: c.width, height: c.height, css: c.style.width + ' × ' + c.style.height, dpr: window.devicePixelRatio, inner: window.innerWidth + '×' + window.innerHeight }; });
  await shot('00-unlock');

  // Déblocage audio au tap, puis titre.
  await tap(W / 2, 196);
  step('tap « Cliquez pour sonner » → titre', await waitTop('title'));
  await sleep(700);
  report.touchActive = await page.evaluate(() => window.carillon.touch.isActive());
  step('mode tactile détecté (auto)', report.touchActive === true);
  await shot('01-title');
  // Titre → hub (bouton Jouer/Continuer : x 180..300, y 92..112).
  await tap(240, 102);
  step('tap Jouer → hub', await waitTop('hub'));
  await sleep(600);
  await shot('02-hub');
  // Hub → « Sonner la nuit » (x 292..474, y 220..242).
  await tap(383, 231);
  step('tap Sonner la nuit → Relique', await waitTop('relicpick'));
  await sleep(1200);
  await shot('03-relic');
  await tap(172, 134);  // première carte (x 124..220, y 70..198)
  step('tap Relique → run', await waitTop('run'));
  await sleep(500);

  // Run : compteur de grades, disposition tactile.
  await page.evaluate(() => { window.__grades = []; window.carillon.bus.on('rhythm:input', (e) => window.__grades.push(e.grade)); });
  const layout = await page.evaluate(() => window.carillon.touch.currentLayout());
  step('commandes tactiles affichées en run', !!layout, JSON.stringify(layout && layout.buttons));
  const btn = (a) => (layout ? layout.buttons.find((b) => b.action === a) : { x: W - 34, y: H - 34 });
  const cssScale = await page.evaluate(() => { const c = document.getElementById('game'); return parseFloat(c.style.width) / 480; });
  report.cssScale = cssScale;
  step('bouton Volée ≥ 48 px CSS', btn('dash').r * 2 * cssScale >= 48, String(Math.round(btn('dash').r * 2 * cssScale)));

  // Joystick : doigt 0 posé à gauche puis glissé vers la droite ; l'axe doit suivre.
  await touch('touchStart', [{ x: 110, y: 200, id: 0 }]);
  await sleep(50);
  await touch('touchMove', [{ x: 150, y: 200, id: 0 }]);
  await sleep(120);
  const ax = await page.evaluate(() => { const a = window.carillon.input.axis(); return { x: a.x, y: a.y }; });
  step('joystick virtuel → axis().x > 0.8', ax.x > 0.8, JSON.stringify(ax));
  const p0 = await page.evaluate(() => { const g = window.carillon.deps.game.gameState(); return { x: g.player.x, y: g.player.y }; });

  // Volée sur chaque temps (doigt 1), joystick tenu et tourné (doigt 0) ; cartes de niveau au tap.
  const dirs = [[150, 200], [110, 240], [70, 200], [110, 160]];
  let levelShot = false, pauseShot = false;
  for (let i = 0; i < BEATS; i++) {
    const cur = await top();
    if (cur === 'levelup') {
      await touch('touchEnd', []);            // tous les doigts levés (CDP : touchEnd = points relâchés)
      if (!levelShot) { await sleep(1200); await shot('05-levelup'); levelShot = true; }
      await sleep(400); await tap(240, 140);   // carte du milieu (x 192..288, y 76..204)
      step('carte de niveau au tap → run', await waitTop('run', 3000));
      await touch('touchStart', [{ x: 110, y: 200, id: 0 }]); await sleep(30);
    } else if (cur !== 'run') { fail('état inattendu pendant la run : ' + cur); break; }
    if (i === 6) await page.evaluate(() => { const r = window.carillon.deps.game.gameState().run; window.carillon.bus.emit('pickup:xp', { amount: r.nextXp - r.xp + 1 }); }); // force une montée de niveau (cartes au tap)
    const wait = await page.evaluate(() => { const c = window.carillon.conductor, a = window.carillon.audio; return Math.max(0, (c.nextBeatAt(1) - a.now()) * 1000); });
    await sleep(Math.max(0, wait - 2));
    const d = btn('dash');
    // touchStart liste TOUS les points actifs (le stick déjà posé + le nouveau doigt sur Volée) ;
    // touchEnd liste les points relâchés (le doigt Volée seul : le stick reste posé).
    await touch('touchStart', [{ x: dirs[i % 4][0], y: dirs[i % 4][1], id: 0 }, { x: d.x, y: d.y, id: 1 }]);
    if (i === 3) await shot('04-run-touch');
    await sleep(40);
    await touch('touchEnd', [{ x: d.x, y: d.y, id: 1 }]);
    await touch('touchMove', [{ x: dirs[(i + 1) % 4][0], y: dirs[(i + 1) % 4][1], id: 0 }]);
  }
  await touch('touchEnd', []);
  const p1 = await page.evaluate(() => { const g = window.carillon.deps.game.gameState(); return { x: g.player.x, y: g.player.y }; });
  step('le sonneur a bougé au joystick', Math.hypot(p1.x - p0.x, p1.y - p0.y) > 20, Math.round(Math.hypot(p1.x - p0.x, p1.y - p0.y)) + ' px');
  const grades = await page.evaluate(() => window.__grades);
  for (const g of grades) report.grades[g] = (report.grades[g] || 0) + 1;
  const n = grades.length, perfect = report.grades.parfait || 0;
  step('cartes de niveau proposées au niveau forcé', levelShot);
  step('taps Volée jugés (rhythm:input)', n >= BEATS / 2, n + ' frappes');
  step('≥ 60 % de Parfait au tap calé sur le temps', n > 0 && perfect / n >= 0.6, perfect + '/' + n);

  // Pause au bouton, options depuis la pause, défilement au doigt, retour, reprise.
  if ((await top()) === 'levelup') { await sleep(1200); await tap(240, 140); await waitTop('run', 3000); }
  const pb = btn('pause');
  await tap(pb.x, pb.y);
  step('bouton pause → pause', await waitTop('pause'));
  await sleep(400); await shot('06-pause'); pauseShot = true;
  await tap(95, 132);                      // Options (x 35..155, y 122..142)
  step('pause → options', await waitTop('options'));
  await sleep(400); await shot('07-options');
  await touch('touchStart', [{ x: 240, y: 190, id: 0 }]);
  for (let k = 1; k <= 8; k++) { await sleep(30); await touch('touchMove', [{ x: 240, y: 190 - k * 12, id: 0 }]); }
  await sleep(60); await touch('touchEnd', []);
  await sleep(200);
  const scrolled = await page.evaluate(() => window.carillon.states.screenOf('options').scrollTop());
  step('options : glisser fait défiler', scrolled > 0, 'scroll = ' + scrolled);
  await shot('08-options-scrolled');
  await tap(240, 14);                      // hors de la liste : retour
  step('tap hors liste → pause', await waitTop('pause'));
  await tap(95, 80);                       // Reprendre (x 35..155, y 70..90)
  step('Reprendre → run', await waitTop('run'));

  // Portrait : voile « Tourne ton téléphone », levé au tap.
  await page.setViewportSize({ width: PROFILES[device].viewport.height, height: PROFILES[device].viewport.width });
  await sleep(500);
  await shot('09-portrait');
  const veilBlocks = await page.evaluate(() => window.carillon.touch.veilShown() && window.carillon.touch.currentLayout() === null);
  step('portrait : voile affiché, commandes retirées, nuit en pause', veilBlocks && (await top()) === 'pause');
  await tap(W / 2, H / 2);
  await sleep(300);
  const veilGone = await page.evaluate(() => !window.carillon.touch.veilShown());
  step('portrait : le tap lève le voile', veilGone);
  await page.setViewportSize(PROFILES[device].viewport);
  await sleep(300);
  report.canvasEnd = await page.evaluate(() => { const c = document.getElementById('game'); return c.width + '×' + c.height + ' (' + c.style.width + ')'; });
  if (!pauseShot) await shot('06-pause');
  await context.close();
  return report;
}

const browser = await chromium.launch({ headless: !flag('headed'), executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const reports = [];
for (const device of DEVICES) for (const lang of LANGS) {
  if (!PROFILES[device]) { console.error('profil inconnu :', device); process.exit(2); }
  try { reports.push(await run(browser, device, lang)); }
  catch (e) { reports.push({ tag: device + '-' + lang, ok: false, errors: ['exception : ' + (e && e.stack || e)], steps: [], grades: {} }); }
}
await browser.close();

if (flag('json')) console.log(JSON.stringify(reports, null, 2));
else for (const r of reports) {
  console.log('== ' + r.tag + ' ' + (r.ok ? 'OK' : 'KO') + '  canvas ' + JSON.stringify(r.canvas || {}) + '  grades ' + JSON.stringify(r.grades));
  for (const s of r.steps) console.log('  [' + (s.ok ? 'OK' : 'KO') + '] ' + s.name + (s.detail ? ' — ' + s.detail : ''));
  for (const e of r.errors) console.log('  !! ' + e);
}
console.log('captures : ' + OUT);
process.exit(reports.every((r) => r.ok) ? 0 : 1);
