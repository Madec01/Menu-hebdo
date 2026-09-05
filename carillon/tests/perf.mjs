#!/usr/bin/env node
// tests/perf.mjs — test de performance en navigateur réel (Playwright + Chromium headless).
// Charge le jeu servi par serve.sh, débloque l'audio (geste), lance une vraie run (Cendrelune, Wren), puis deux
// mesures de fps / frameMs / updateMs / renderMs et du compteur d'entités (loop.stats) :
//   · « minute 3, bloc réel » : saut à 178 s de nuit (palier 5 avec tierEvery 40 s), build d'un sonneur de niveau
//     ≈ 14 (4 Timbres 4–5, 2 Accords), sonneur invulnérable, Fêlure et Moments du bloc réel de waves.json laissés
//     tourner 8 s (la foule se forme d'elle-même : rien n'est injecté) ; cible : capacité ≥ 55 fps (--min-fps), capacité =
//     min(60, 1000 / frameMs p95) — le compteur rAF headless est bridé (≈ 15 fps au repos) et n'est qu'indicatif ;
//   · « foule injectée » (stress, comme avant) : minute 10, build complet, 380 ennemis injectés.
// Échec si une erreur console / de page, une requête en 404/échec, ou fps < --min-fps à la minute 3 (headless :
// SwiftShader ; `--no-fps-check` pour ne garder que l'avertissement).
//   node tests/perf.mjs                       # serveur attendu sur http://localhost:8080/carillon/
//   node tests/perf.mjs --url http://localhost:8080/carillon/index.html --seconds 10 --json
//   node tests/perf.mjs --headed              # fenêtre visible (débogage)
//   node tests/perf.mjs --min-fps 55 --no-fps-check
// Prérequis : Playwright dans /opt/node22/lib/node_modules/playwright, Chromium dans /opt/pw-browsers
// (variables PLAYWRIGHT_MODULE / PLAYWRIGHT_BROWSERS_PATH pour d'autres emplacements).

import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
function opt(name, def) { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; }
const URL_ = opt('url', 'http://localhost:8080/carillon/index.html');
const SECONDS = +opt('seconds', 10);
const JSON_OUT = args.includes('--json');
const HEADED = args.includes('--headed');
const MIN_FPS = +opt('min-fps', 55);
const FPS_CHECK = !args.includes('--no-fps-check');
const PW = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';

function log(...a) { if (!JSON_OUT) console.log(...a); }

const report = { url: URL_, ok: true, consoleErrors: [], pageErrors: [], badResponses: [], failedRequests: [], warnings: [], boot: {}, idle: null, minute3: null, minute10: null };

async function main() {
  if (!existsSync(PW)) throw new Error('Playwright introuvable : ' + PW);
  const { chromium } = await import(PW);
  const browser = await chromium.launch({
    headless: !HEADED,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300)); else if (m.type() === 'warning') report.warnings.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => report.pageErrors.push(String(e.message || e).slice(0, 300)));
  page.on('response', (r) => { if (r.status() >= 400) report.badResponses.push(r.status() + ' ' + r.url()); });
  page.on('requestfailed', (r) => report.failedRequests.push(r.url() + ' ' + (r.failure() ? r.failure().errorText : '')));

  const t0 = Date.now();
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForFunction(() => window.carillon && window.carillon.loop, null, { timeout: 60000 });
  report.boot.ms = Date.now() - t0;
  log('démarrage en', report.boot.ms, 'ms');
  // Geste utilisateur → déblocage audio → écran titre.
  await page.mouse.click(720, 405);
  await page.waitForFunction(() => window.carillon.states.topName() === 'title' && !window.carillon.states.isTransitioning(), null, { timeout: 20000 });
  // Lancement direct d'une run (sans tutoriel).
  await page.evaluate(() => window.carillon.states.replace('run', { parishId: 'cendrelune', characterId: 'wren', seed: 4242, tutorial: false, noRelic: true }, { fade: false, sound: null }));
  await page.waitForFunction(() => window.carillon.deps.game && window.carillon.deps.game.isGameActive(), null, { timeout: 20000 });
  await page.waitForTimeout(1500);

  async function sample(label, seconds) {
    const out = await page.evaluate(async (sec) => {
      const loop = window.carillon.loop;
      const s = { fps: [], frameMs: [], updateMs: [], renderMs: [], entities: [], enemies: [], projectiles: [], particles: [] };
      const g = window.carillon.deps.game.gameState();
      const pmod = await import('./src/render/particles.js');
      const start = performance.now();
      let lastFrames = loop.stats.frames, lastT = start;
      await new Promise((resolve) => {
        const id = setInterval(() => {
          const now = performance.now();
          const frames = loop.stats.frames;
          s.fps.push((frames - lastFrames) * 1000 / (now - lastT)); lastFrames = frames; lastT = now;
          s.frameMs.push(loop.stats.frameMs); s.updateMs.push(loop.stats.updateMs); s.renderMs.push(loop.stats.renderMs);
          s.entities.push(loop.stats.entities);
          if (g.world) { s.enemies.push(g.world.enemies.active); s.projectiles.push(g.world.projectiles.active); }
          s.particles.push(pmod.activeCount ? pmod.activeCount() : 0);
          if (now - start >= sec * 1000) { clearInterval(id); resolve(); }
        }, 250);
      });
      const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
      const p95 = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * 0.95))] : 0; };
      return {
        fpsAvg: +avg(s.fps).toFixed(1), fpsMin: +Math.min(...s.fps).toFixed(1), frameMsAvg: +avg(s.frameMs).toFixed(2), frameMsP95: +p95(s.frameMs).toFixed(2),
        // Capacité : fps que le budget d'une frame (p95) permettrait à 60 Hz — en headless, rAF est bridé (≈ 15 fps au repos), seul frameMs compte.
        fpsCapacity: +Math.min(60, 1000 / Math.max(0.01, p95(s.frameMs))).toFixed(1),
        updateMsAvg: +avg(s.updateMs).toFixed(2), renderMsAvg: +avg(s.renderMs).toFixed(2), entitiesAvg: Math.round(avg(s.entities)), entitiesMax: Math.max(...s.entities),
        enemiesMax: Math.max(0, ...s.enemies), projectilesMax: Math.max(0, ...s.projectiles), particlesMax: Math.max(0, ...s.particles), samples: s.fps.length,
      };
    }, seconds);
    log(`${label} : ${out.fpsAvg} fps rAF (min ${out.fpsMin}) ; capacité ${out.fpsCapacity} fps (p95), frame ${out.frameMsAvg} ms (p95 ${out.frameMsP95}), update ${out.updateMsAvg} ms, rendu ${out.renderMsAvg} ms, entités ${out.entitiesAvg} (max ${out.entitiesMax} ; ennemis ${out.enemiesMax}, projectiles ${out.projectilesMax}, particules ${out.particlesMax})`);
    return out;
  }

  report.idle = await sample('début de run (référence)', 3);

  // Minute 3, bloc réel : saut à 178 s (palier 5), Fêlure de 168 s et Moments à venir laissés au spawner réel,
  // build d'un niveau ≈ 14, invulnérabilité, plus de montée de niveau ; 8 s pour que la foule se forme.
  await page.evaluate(async () => {
    const game = window.carillon.deps.game;
    const g = game.gameState();
    const T = 178;
    g.player.iframesT = 1e9;
    g.run.nextXp = 1e12;
    g.world.time = T; g.run.timeSec = T; g.world.spawner.nextMinute = 3;
    const ev = g.world.spawner.def.events; let k = 0; while (k < ev.length && ev[k].at < T - 10) k++; g.world.spawner.eventIdx = k;   // la Fêlure de 168 s arrive tout de suite
    const ms = g.world.moments.list; let m = 0; while (m < ms.length && ms[m].at < T) m++; g.world.moments.idx = m;
    for (const [id, lv] of [['battant', 5], ['bourdon', 4], ['chaine_d_angelus', 4], ['clarine', 4]]) for (let l = 0; l < lv; l++) game.debugGiveWeapon(id);
    const passives = await import('./src/game/passives.js');
    for (let l = 0; l < 3; l++) passives.addPassive(g.player, 'contrepoids');
    for (let l = 0; l < 2; l++) passives.addPassive(g.player, 'etain');
  });
  await page.waitForTimeout(8000);
  report.minute3 = await sample('minute 3, bloc réel (palier 5, aucune injection)', SECONDS);
  report.minute3.tier = await page.evaluate(() => window.carillon.deps.game.gameState().world.tier);
  report.minute3.gameSec = await page.evaluate(() => Math.round(window.carillon.deps.game.gameState().run.timeSec));

  // Minute 10 : saut de temps, build complet, invulnérabilité, plus de montée de niveau, foule injectée.
  await page.evaluate(async () => {
    const game = window.carillon.deps.game;
    const g = game.gameState();
    const enemies = await import('./src/game/enemies.js');
    g.player.iframesT = 1e9;
    g.run.nextXp = 1e12;
    g.world.time = 598; g.run.timeSec = 598; g.world.spawner.nextMinute = 10;
    for (const id of ['bourdon', 'grelots', 'chaine_d_angelus', 'tocsin', 'clarine']) for (let l = 0; l < 7; l++) game.debugGiveWeapon(id);
    for (let l = 0; l < 6; l++) game.debugGiveWeapon('battant');
    const kinds = ['feutre', 'feutre', 'feutre', 'choeur_muet', 'choeur_muet', 'baillon', 'fossoyeur', 'ouateux', 'rampe_suie', 'veuve_grise', 'cierge'];
    const p = g.player;
    for (let i = 0; i < 380; i++) {
      const a = (i / 380) * Math.PI * 2 * 7, d = 120 + (i % 40) * 8;
      enemies.spawnEnemy(g.world, kinds[i % kinds.length], p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * 0.75);
    }
  });
  await page.waitForTimeout(3000); // la foule converge, les projectiles s'accumulent
  report.minute10 = await sample('minute 10, foule injectée', SECONDS);
  report.minute10.tier = await page.evaluate(() => window.carillon.deps.game.gameState().world.tier);

  if (!JSON_OUT) {
    const shot = '/tmp/carillon-perf-minute10.png';
    try { await page.screenshot({ path: shot }); log('capture :', shot); } catch (e) { /* facultatif */ }
  }
  await browser.close();

  const errors = report.consoleErrors.length + report.pageErrors.length + report.badResponses.length + report.failedRequests.length;
  report.ok = errors === 0;
  // Le compteur rAF n'est pas significatif en headless (≈ 15–18 fps au repos avec 0,7 ms de frame) : le contrôle porte sur la capacité (1000 / frameMs p95, plafonnée à 60).
  if (report.minute3.fpsCapacity < MIN_FPS) { report.warnings.push('capacité fps à la minute 3 (bloc réel) < ' + MIN_FPS + ' (' + report.minute3.fpsCapacity + ', frame p95 ' + report.minute3.frameMsP95 + ' ms) — rendu logiciel headless, à confirmer sur machine réelle'); if (FPS_CHECK) report.ok = false; }
  if (report.minute10.fpsCapacity < 55) report.warnings.push('capacité fps à la minute 10 (foule injectée) < 55 (' + report.minute10.fpsCapacity + ', frame p95 ' + report.minute10.frameMsP95 + ' ms) — rendu logiciel headless, à confirmer sur machine réelle');
  if (JSON_OUT) console.log(JSON.stringify(report, null, 1));
  else {
    log('erreurs console :', report.consoleErrors.length, '; erreurs de page :', report.pageErrors.length, '; réponses ≥ 400 :', report.badResponses.length, '; requêtes échouées :', report.failedRequests.length);
    for (const e of [...report.consoleErrors, ...report.pageErrors, ...report.badResponses, ...report.failedRequests]) log('  -', e);
    for (const w of report.warnings.filter((w) => w.startsWith('fps') || w.startsWith('capacité'))) log('avertissement :', w);
    log(report.ok ? 'RÉSULTAT : OK' : 'RÉSULTAT : ÉCHEC');
  }
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => { console.error('perf.mjs :', e && e.stack || e); process.exit(2); });
