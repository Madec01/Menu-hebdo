// Test automatisé des modules src/audio/ avec Playwright (Chromium headless).
//   NODE_PATH=/opt/node22/lib/node_modules CHROMIUM=/chemin/chrome node src/audio/_test/run-playwright.mjs
// Vérifie : aucun 404, aucune erreur console, lecture d'une piste, événements beat/bar, changement de
// cran (gains de couches), judge() sur des frappes simulées (+ early, latence d'entrée), changement de piste
// en fondu sans casser la grille (beatIndex monotone, tempo appliqué à la mesure suivante), limite de voix,
// et la vague « approfondissement » : couches audibles seules planifiées, pont de Fêlure, levée du boss,
// palier → tempo, jingles sur l'accord, ambiance de paroisse, désaccord, pistes « toutes couches », bus.
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
  // (AudioParam.value n'est fiable que pour les couches qui reçoivent du signal en continu : on lit les
  //  cibles des fondus, et on vérifie la valeur réelle sur la couche 0, le bourdon tenu)
  const g1 = await page.evaluate(`${T}.music.layerTargets()`);
  await page.evaluate(`${T}.music.setLayers(4)`);
  await sleep(400);
  const g4 = await page.evaluate(`${T}.music.layerTargets()`);
  const v4 = await page.evaluate(`${T}.music.layerGains()`);
  const info = await page.evaluate(`${T}.music.layerInfo()`);
  check('cran 0 : seules les couches tier 0 sont ouvertes', g1.filter((g) => g > 0.01).length < g1.length && g1[0] > 0.01, `cibles=${g1.map((g) => g.toFixed(2))}`);
  // les couches `minIntensity` (mains dans les assauts) restent fermées à l'intensité de base : elles sont exclues
  check('cran 3 : toutes les couches ouvertes (crossfade 200 ms)', g4.every((g, i) => g > 0.01 || info[i].minIntensity !== null) && Math.abs(v4[0] - g4[0]) < 0.02, `cibles=${g4.map((g) => g.toFixed(2))} bourdon=${v4[0].toFixed(2)}`);
  await page.evaluate(`${T}.bus.emit('resonance:change', { tier: 1, mult: 1.4, value: 0.4, direction: 1 })`);
  await sleep(350);
  const g2 = await page.evaluate(`${T}.music.layerTargets()`);
  check('resonance:change → setLayers(tier+1)', g2.filter((g) => g > 0.01).length < g4.length && g2.filter((g) => g > 0.01).length > g1.filter((g) => g > 0.01).length, `cibles=${g2.map((g) => g.toFixed(2))}`);

  // judge() sur des frappes simulées autour du prochain temps
  const j = await page.evaluate(`(() => { const c = ${T}.conductor; const at = c.nextBeatAt(1); return [c.judge(at).grade, c.judge(at + 0.02).grade, c.judge(at - 0.08).grade, c.judge(at + 0.2).grade, c.windowMs()]; })()`);
  check('judge : parfait / parfait / bon / rate', j[0] === 'parfait' && j[1] === 'parfait' && j[2] === 'bon' && j[3] === 'rate', j.join(', '));
  const je = await page.evaluate(`(() => { const c = ${T}.conductor; const at = c.nextBeatAt(1); const a = c.judge(at - 0.05), b = c.judge(at + 0.05); c.setInputLatencyMs(60); const d = c.judge(at + 0.06); c.setInputLatencyMs(0); return [a.early, b.early, Math.round(d.offsetMs), c.inputLatencyMs()]; })()`);
  check('judge : early (avance) / retard, latence d\'entrée soustraite', je[0] === true && je[1] === false && Math.abs(je[2]) <= 2 && je[3] === 0, JSON.stringify(je));

  // seules les couches audibles sont planifiées : au cran 0 le budget de voix reste bas
  await page.evaluate(`${T}.music.setLayers(1)`);
  await sleep(1500);
  const v0 = await page.evaluate(`${T}.audio.voiceCount()`);
  check('cran 0 : couches muettes non planifiées (≤ 14 voix)', v0 <= 14, `voix=${v0}`);
  await page.evaluate(`${T}.music.setLayers(4)`);
  await sleep(600);
  const vCatch = await page.evaluate(`${T}.audio.voiceCount()`);
  check('ouverture des couches : notes tenues rattrapées (voix en hausse)', vCatch > v0, `voix=${vCatch}`);
  check('sections : la paroisse joue la section A', (await page.evaluate(`${T}.music.section()`)) === 'A');

  // pont de Fêlure : inséré à la mesure suivante, accord de dominante, retour à A après 4 mesures
  await page.evaluate(`${T}.bus.emit('run:fissure', { bossId: 'bourdon_fele', phase: 'start' })`);
  let sec = null;
  for (let i = 0; i < 70 && sec !== 'bridge'; i++) { await sleep(50); sec = await page.evaluate(`${T}.music.section()`); }
  const chordB = await page.evaluate(`${T}.music.currentChord().name`);
  check('run:fissure start → section « pont » à la mesure suivante', sec === 'bridge', `section=${sec}`);
  check('pont : accord de dominante (Am / A)', chordB === 'Am' || chordB === 'A', chordB);
  for (let i = 0; i < 260 && sec === 'bridge'; i++) { await sleep(50); sec = await page.evaluate(`${T}.music.section()`); }
  check('pont : retour à la section A après 4 mesures', sec === 'A', `section=${sec}`);

  // palier de Sourdine : tempo +2 bpm par palier appliqué à la mesure suivante, intensité effective relevée
  await page.evaluate(`${T}.bus.emit('run:tier', { tier: 3 })`);
  await sleep(2800);
  const bpmTier = await page.evaluate(`${T}.conductor.bpm()`);
  check('run:tier 3 → 96 + 2·3 = 102 bpm à la mesure suivante', bpmTier === 102, `bpm=${bpmTier}`);
  await page.evaluate(`${T}.bus.emit('run:tier', { tier: 0 })`);

  // cri du Bourdon Fêlé : la grille recule d'une croche pendant 8 temps puis revient en phase ; indices monotones
  for (let i = 0; i < 80 && (await page.evaluate(`${T}.conductor.bpm()`)) !== 96; i++) await sleep(50);   // le retour à 96 (palier 0) est appliqué à la mesure suivante
  const shiftRes = await page.evaluate(`(async () => { const c = ${T}.conductor; const bpm0 = c.bpm(); const seen = []; const beats = []; const t0 = ${T}.audio.now();
    ${T}.bus.emit('boss:phase', { bossId: 'bourdon_fele', phase: 'cri' });
    for (let i = 0; i < 160; i++) { await new Promise((r) => setTimeout(r, 50)); seen.push(c.gridShift()); beats.push(c.beatIndex()); }
    const mono = beats.every((b, i) => i === 0 || (b >= beats[i - 1] && b - beats[i - 1] <= 1));
    return { shifted: seen.some((x) => x === 0.5), back: seen[seen.length - 1] === 0, mono, bpm: c.bpm(), bpm0, beats: beats[beats.length - 1] - beats[0], voices: ${T}.audio.voiceCount(), secs: ${T}.audio.now() - t0 }; })()`);
  check('boss:phase cri → grille décalée d\'une croche puis retour en phase, beatIndex monotone, tempo intact', shiftRes.shifted && shiftRes.back && shiftRes.mono && shiftRes.bpm === shiftRes.bpm0 && shiftRes.voices > 0, JSON.stringify(shiftRes));

  // jingles : rejoués par le sampler sur l'accord courant (plus de fichier en majeur)
  const jg = await page.evaluate(`(() => { const s = ${T}.sfx; const before = ${T}.audio.voiceCount(); s.play('resonance_3'); s.play('level_up'); s.play('pickup'); s.play('moment_start'); return [s.isJingle('resonance_3'), s.isJingle('xp_pickup'), s.has('pickup'), s.has('moment_start'), s.isJingle('hit_light')]; })()`);
  check('jingles : resonance_3 / xp_pickup rendus par le sampler, pickup et moment_start connus, hit_light reste un fichier', jg[0] && jg[1] && jg[2] && jg[3] && !jg[4], JSON.stringify(jg));

  // désaccord (ennemi désaccordeur) : −30 cents puis retour à 0 en 1 s
  await page.evaluate(`${T}.bus.emit('enemy:desaccord', { x: 0, y: 0, depth: 1 })`);
  const d0 = await page.evaluate(`${T}.music.getDetune()`);
  await sleep(1200);
  const d1 = await page.evaluate(`${T}.music.getDetune()`);
  check('enemy:desaccord → setDetune(−30) puis retour à 0 en 1 s', d0 < -15 && d1 === 0, `${d0.toFixed(1)} → ${d1}`);

  // ambiance de paroisse sur run:start, arrêt sur run:end
  await page.evaluate(`${T}.bus.emit('run:start', { parishId: 'tourbes', characterId: 'wren', seed: 1, tutorial: false })`);
  await sleep(800);
  const amb = await page.evaluate(`${T}.sfx.activeAmbiences()`);
  check('run:start tourbes → ambiance pluie en fondu', amb.includes('ambience_rain'), amb.join(','));
  await page.evaluate(`${T}.bus.emit('run:end', { victory: false, stats: {} })`);
  await sleep(300);
  const amb2 = await page.evaluate(`${T}.sfx.activeAmbiences()`);
  check('run:end → ambiance arrêtée', amb2.length === 0, amb2.join(','));

  // changement de piste en fondu : grille continue, tempo à la mesure suivante
  const before = await page.evaluate(`${T}.conductor.beatIndex()`);
  await page.evaluate(`${T}.music.play('boss', { layers: 4, fadeSec: 0.5 })`);
  const samples = [];
  for (let i = 0; i < 70; i++) { samples.push(await page.evaluate(`[${T}.conductor.beatIndex(), ${T}.conductor.bpm(), ${T}.audio.now()]`)); await sleep(50); }
  const monotone = samples.every((s, i) => i === 0 || (s[0] >= samples[i - 1][0] && s[0] - samples[i - 1][0] <= 1));
  check('changement de piste : beatIndex monotone sans saut', monotone && samples[samples.length - 1][0] > before, `de ${before} à ${samples[samples.length - 1][0]}`);
  check('tempo 110 appliqué à la mesure suivante', samples.some((s) => s[1] === 96) && samples[samples.length - 1][1] === 110, `bpm final=${samples[samples.length - 1][1]}`);
  check('piste courante = boss', (await page.evaluate(`${T}.music.current()`)) === 'boss');
  let bsec = await page.evaluate(`${T}.music.section()`);
  check('boss : levée de 2 mesures (section intro) d\'abord', bsec === 'intro', `section=${bsec}`);
  for (let i = 0; i < 140 && bsec === 'intro'; i++) { await sleep(50); bsec = await page.evaluate(`${T}.music.section()`); }
  check('boss : la piste enchaîne sur A après la levée', bsec === 'A', `section=${bsec}`);
  await page.evaluate(`${T}.music.play('boss', { layers: 2, fadeSec: 0.5 })`);
  await sleep(200);
  check('rejouer la piste active ne la redémarre pas', (await page.evaluate(`${T}.music.section()`)) === 'A' && (await page.evaluate(`${T}.music.current()`)) === 'boss');
  await page.evaluate(`${T}.music.play('menu', { layers: 1, fadeSec: 0.5 })`);
  await sleep(300);
  const menuT = await page.evaluate(`${T}.music.layerTargets()`);
  check('menu : toutes les couches jouent (allLayers) malgré layers = 1', menuT.length > 0 && menuT.every((g) => g > 0.01), `cibles=${menuT.map((g) => g.toFixed(2))}`);
  const buses = await page.evaluate(`['voices', 'limiter', 'highpass', 'lowpass', 'ui'].map((b) => !!${T}.audio.busNode(b))`);
  check('bus voices (Timbres hors passe-bas), limiteur et coupe-bas présents', buses.every(Boolean), buses.join(','));
  const ducks = await page.evaluate(`(() => { const n0 = ${T}.audio.duckCounter(); ${T}.bus.emit('weapon:fire', { big: true }); ${T}.bus.emit('enemy:hit', { big: true }); const n1 = ${T}.audio.duckCounter(); ${T}.bus.emit('enemy:hit', { crit: true }); return [n1 - n0, ${T}.audio.duckCounter() - n1]; })()`);
  check('ducking : ni weapon:fire big ni enemy:hit big, seulement crit (et fusion)', ducks[0] === 0 && ducks[1] === 1, ducks.join('/'));
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
