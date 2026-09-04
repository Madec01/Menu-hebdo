// Test automatisé des modules src/audio/ avec Playwright (Chromium headless).
//   NODE_PATH=/opt/node22/lib/node_modules CHROMIUM=/chemin/chrome node src/audio/_test/run-playwright.mjs
// Vérifie : aucun 404, aucune erreur console, lecture d'une piste, événements beat/bar, changement de
// cran (gains de couches), judge() sur des frappes simulées, changement de piste en fondu sans casser
// la grille (beatIndex monotone, tempo appliqué à la mesure suivante), limite de voix.
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// playwright local (node_modules) ou global (npm root -g) : aucune dépendance n'est ajoutée au projet
async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    const root = execSync('npm root -g').toString().trim();
    return import(pathToFileURL(path.join(root, 'playwright', 'index.mjs')).href);
  }
}
const { chromium } = await loadPlaywright();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT = 8791;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'OK ' : 'KO '} ${name}${detail ? ' — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await sleep(800);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-gpu'],
});
try {
  const page = await browser.newPage();
  const consoleErrors = [];
  const failed = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${m.text()} @ ${m.location().url}`); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => failed.push(`échec ${r.url()}`));
  if (!existsSync(path.join(ROOT, 'src/core/events.js'))) {
    console.log('src/core/events.js absent : stub servi à sa place (agent C non livré)');
    await page.route('**/src/core/events.js', (route) => route.fulfill({ path: path.join(ROOT, 'src/audio/_test/events-stub.js'), contentType: 'text/javascript' }));
  }
  await page.goto(`http://127.0.0.1:${PORT}/src/audio/_test/audio-test.html`);
  await page.click('#unlock');
  await page.waitForFunction(() => window.carillonTest && window.carillonTest.manifest(), null, { timeout: 60000 });
  const T = 'window.carillonTest';
  check('audio:unlocked émis', await page.evaluate(`${T}.events.unlocked === 1`));
  check('AudioContext running', await page.evaluate(`${T}.audio.ctx().state`) === 'running');

  // bruitage + limite de voix
  await page.evaluate(`for (let i = 0; i < 20; i++) ${T}.sfx.play('hit_light', { x: 100 * i, y: 0 }); ${T}.sfx.playUi('ui_confirm');`);
  const voices = await page.evaluate(`${T}.audio.voiceCount()`);
  check('limite 6 voix identiques / 100 ms', voices <= 8, `voix actives = ${voices}`);

  // lecture d'une piste, Mesure lancée, événements beat/bar depuis conductorTick()
  await page.evaluate(`${T}.music.play('cendrelune', { layers: 1, fadeSec: 0.3 })`);
  await sleep(2600);
  const s1 = await page.evaluate(`({ running: ${T}.conductor.isRunning(), bpm: ${T}.conductor.bpm(), beat: ${T}.conductor.beatIndex(), ev: { ...${T}.events }, cur: ${T}.music.current(), voices: ${T}.audio.voiceCount() })`);
  check('Mesure lancée à 96 BPM', s1.running && s1.bpm === 96, JSON.stringify(s1));
  check('beat/bar émis par conductorTick', s1.ev.beat >= 3 && s1.ev.bar >= 1, `beat=${s1.ev.beat} bar=${s1.ev.bar}`);
  check('des voix jouent (cendrelune)', s1.voices > 0 && s1.cur === 'cendrelune', `voix=${s1.voices}`);

  // crans : gains de couches après crossfade 200 ms
  const g1 = await page.evaluate(`${T}.music.layerGains()`);
  await page.evaluate(`${T}.music.setLayers(4)`);
  await sleep(400);
  const g4 = await page.evaluate(`${T}.music.layerGains()`);
  check('cran 0 : seules les couches tier 0 sont ouvertes', g1.filter((g) => g > 0.01).length < g1.length && g1.some((g) => g > 0.01), `gains=${g1.map((g) => g.toFixed(2))}`);
  check('cran 3 : toutes les couches ouvertes', g4.every((g) => g > 0.01), `gains=${g4.map((g) => g.toFixed(2))}`);
  await page.evaluate(`${T}.bus.emit('resonance:change', { tier: 1, mult: 1.4, value: 0.4, direction: 1 })`);
  await sleep(350);
  const g2 = await page.evaluate(`${T}.music.layerGains()`);
  check('resonance:change → setLayers(tier+1)', g2.filter((g) => g > 0.01).length < g4.length, `gains=${g2.map((g) => g.toFixed(2))}`);

  // judge() sur des frappes simulées autour du prochain temps
  const j = await page.evaluate(`(() => { const c = ${T}.conductor; const at = c.nextBeatAt(1); return [c.judge(at).grade, c.judge(at + 0.02).grade, c.judge(at - 0.08).grade, c.judge(at + 0.2).grade, c.windowMs()]; })()`);
  check('judge : parfait / parfait / bon / rate', j[0] === 'parfait' && j[1] === 'parfait' && j[2] === 'bon' && j[3] === 'rate', j.join(', '));

  // changement de piste en fondu : grille continue, tempo à la mesure suivante
  const before = await page.evaluate(`${T}.conductor.beatIndex()`);
  await page.evaluate(`${T}.music.play('boss', { layers: 4, fadeSec: 0.5 })`);
  const samples = [];
  for (let i = 0; i < 70; i++) { samples.push(await page.evaluate(`[${T}.conductor.beatIndex(), ${T}.conductor.bpm(), ${T}.audio.now()]`)); await sleep(50); }
  const monotone = samples.every((s, i) => i === 0 || (s[0] >= samples[i - 1][0] && s[0] - samples[i - 1][0] <= 1));
  check('changement de piste : beatIndex monotone sans saut', monotone && samples[samples.length - 1][0] > before, `de ${before} à ${samples[samples.length - 1][0]}`);
  check('tempo 110 appliqué à la mesure suivante', samples.some((s) => s[1] === 96) && samples[samples.length - 1][1] === 110, `bpm final=${samples[samples.length - 1][1]}`);
  check('piste courante = boss', (await page.evaluate(`${T}.music.current()`)) === 'boss');
  await page.evaluate(`${T}.music.setIntensity(1); ${T}.audio.setLowpass(1); ${T}.bus.emit('player:inAura', { depth: 0.5 }); ${T}.audio.duck(); ${T}.bus.emit('options:change', { key: 'volMusic', value: 0.5 })`);
  await sleep(300);
  check('lowpass / ducking / options sans erreur', true);
  await page.evaluate(`${T}.music.stop(0.5)`);
  await sleep(800);
  check('stop() : plus de piste courante', (await page.evaluate(`${T}.music.current()`)) === null);
  check('aucune erreur console', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
  check('aucun 404 / échec réseau', failed.length === 0, failed.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.kill();
}
const ko = results.filter((r) => !r.ok);
console.log(`\n${results.length - ko.length}/${results.length} contrôles OK`);
process.exit(ko.length ? 1 : 0);
