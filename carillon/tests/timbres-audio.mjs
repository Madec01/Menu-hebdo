#!/usr/bin/env node
// tests/timbres-audio.mjs — vérification À L'OREILLE des Timbres qui chantent (agent B3).
// Lance le jeu servi sur http://localhost:8080/carillon/ (Playwright + Chromium, audio réel via
// --autoplay-policy), démarre une run à Cendrelune, puis enregistre 8 mesures (MediaRecorder sur un
// MediaStreamDestination) deux fois : Battant seul, puis 4 Timbres (Battant, Clarine, Bourdon, Chaîne).
// Trois prises par phase : la sortie des voix seule (timbresNode), le bus musique et le master. Les notes planifiées
// (événement bus `timbre:note`) sont journalisées. Les WAV et le journal sont écrits dans tests/results/
// et analysés par tests/timbres-analyze.py (hauteurs, gamme, crête, variation).
//   node tests/timbres-audio.mjs [--url http://localhost:8080/carillon/index.html] [--headed]
// Prérequis : Playwright dans /opt/node22/lib/node_modules/playwright, Chromium dans /opt/pw-browsers.
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
function opt(name, def) { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; }
const URL_ = opt('url', 'http://localhost:8080/carillon/index.html');
const HEADED = args.includes('--headed');
const PW = process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs';
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'results', 'timbres');
mkdirSync(OUT, { recursive: true });

const report = { url: URL_, consoleErrors: [], pageErrors: [], badResponses: [], phases: {} };

/** WAV flottant 32 bits mono (lu par soundfile). */
function wav(float32, sampleRate) {
  const n = float32.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) buf.writeFloatLE(float32[i], 44 + i * 4);
  return buf;
}

async function main() {
  if (!existsSync(PW)) throw new Error('Playwright introuvable : ' + PW);
  const { chromium } = await import(PW);
  const browser = await chromium.launch({
    headless: !HEADED,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => report.pageErrors.push(String(e.message || e).slice(0, 300)));
  page.on('response', (r) => { if (r.status() >= 400) report.badResponses.push(r.status() + ' ' + r.url()); });

  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForFunction(() => window.carillon && window.carillon.loop, null, { timeout: 60000 });
  await page.mouse.click(720, 405);   // geste → déblocage audio → titre
  await page.waitForFunction(() => window.carillon.states.topName() === 'title' && !window.carillon.states.isTransitioning(), null, { timeout: 20000 });
  await page.evaluate(() => window.carillon.states.replace('run', { parishId: 'cendrelune', characterId: 'wren', seed: 4242, tutorial: false, noRelic: true }, { fade: false, sound: null }));
  await page.waitForFunction(() => window.carillon.deps.game && window.carillon.deps.game.isGameActive(), null, { timeout: 20000 });
  await page.waitForTimeout(1200);

  // Préparation : voix chargées, sonneur invulnérable, plus d'apparitions (prise propre), enregistreurs.
  const prep = await page.evaluate(async () => {
    const T = await import('./src/audio/timbres.js');
    const A = await import('./src/audio/audio.js');
    const M = await import('./src/audio/music.js');
    const { bus } = await import('./src/core/events.js');
    await T.loadTimbres();
    const game = window.carillon.deps.game;
    const g = game.gameState();
    g.player.iframesT = 1e9; g.run.nextXp = 1e12;
    game.gameBalance().spawn.globalCap = 0;
    for (const e of g.world.enemies.items) if (e.state === 'alive') e.state = 'dead';
    window.__notes = [];
    bus.on('timbre:note', (n) => { window.__notes.push({ ...n, wall: A.now() }); });
    const ac = A.ctx();
    window.__rec = { ac, A, T, M };
    return { ready: T.isReady(), track: M.current(), chord: M.currentChord().name, sampleRate: ac.sampleRate, mediaRecorder: typeof MediaRecorder !== 'undefined' };
  });
  report.prep = prep;
  console.log('préparation :', JSON.stringify(prep));
  if (!prep.ready) throw new Error('voix des Timbres non chargées');

  async function record(label, weapons, bars, tier = 0) {
    await page.evaluate(async ({ ws, tier }) => {
      const game = window.carillon.deps.game;
      game.debugGiveWeapon(ws[0], true);
      for (const w of ws.slice(1)) game.debugGiveWeapon(w);
      const R = await import('./src/game/resonance.js');
      const cur = R.tier(); if (tier > cur) R.bump(tier - cur);
      if (tier > 0 && !window.__hold) window.__hold = setInterval(() => { try { R.onRhythmInput('parfait', true); } catch (e) {} }, 1000);
    }, { ws: weapons, tier });
    await page.waitForTimeout(tier > 0 ? 600 : 0);
    const res = await page.evaluate(async ({ bars, label }) => {
      const { ac, A, T } = window.__rec;
      const C = await import('./src/audio/conductor.js');
      const mk = (node) => {
        const dest = ac.createMediaStreamDestination();
        node.connect(dest);
        const rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 });
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        return { dest, rec, chunks, node };
      };
      const voices = mk(T.timbresNode());
      const master = mk(A.busNode('master'));
      const musicTap = mk(A.busNode('music'));
      // départ sur une mesure : on attend la prochaine mesure puis on enregistre `bars` mesures + 1 temps de queue
      const barSec = C.beatDuration() * C.beatsPerBar();
      const startAt = C.nextBeatAt(C.beatsPerBar());
      while (A.now() < startAt - 0.02) await new Promise((r) => setTimeout(r, 5));
      window.__notes.length = 0;
      const t0 = A.now();
      let maxVoices = 0;
      const poll = setInterval(() => { maxVoices = Math.max(maxVoices, A.voiceCount()); }, 50);
      voices.rec.start(); master.rec.start(); musicTap.rec.start();
      await new Promise((r) => setTimeout(r, (bars * barSec + C.beatDuration()) * 1000));
      clearInterval(poll);
      // diagnostic : un écran superposé (montée de niveau, relique…) ou un contexte suspendu tronque la prise
      const screen = window.carillon.states.topName(), acState = ac.state, gameActive = window.carillon.deps.game.isGameActive();
      const stop = (m) => new Promise((resolve) => { m.rec.onstop = () => resolve(); m.rec.stop(); });
      await Promise.all([stop(voices), stop(master), stop(musicTap)]);
      const t1 = A.now();
      voices.node.disconnect(voices.dest); master.node.disconnect(master.dest); musicTap.node.disconnect(musicTap.dest);
      const decode = async (m) => {
        const blob = new Blob(m.chunks, { type: 'audio/webm' });
        const ab = await blob.arrayBuffer();
        const buf = await ac.decodeAudioData(ab);
        const ch = buf.getChannelData(0);
        // mono (moyenne des canaux) → base64 de Float32
        let mono = ch;
        if (buf.numberOfChannels > 1) { const r = buf.getChannelData(1); mono = new Float32Array(ch.length); for (let i = 0; i < ch.length; i++) mono[i] = (ch[i] + r[i]) / 2; }
        const bytes = new Uint8Array(mono.buffer);
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return { b64: btoa(s), sampleRate: buf.sampleRate, seconds: buf.duration };
      };
      const [v, m, mu] = await Promise.all([decode(voices), decode(master), decode(musicTap)]);
      const notes = window.__notes.map((n) => ({ weaponId: n.weaponId, midi: n.midi, t: n.at - t0, bar: n.bar, degree: n.degree, gain: n.gain }));
      return { label, t0, t1, screen, acState, gameActive, elapsedAudio: t1 - t0, bpm: C.bpm(), beatDur: C.beatDuration(), barSec, maxVoices, voices: v, master: m, music: mu, notes, roster: T.currentRoster(), weapons: window.carillon.deps.game.gameState().player.weapons.map((w) => w.id + ':' + w.rhythm) };
    }, { bars, label });
    for (const k of ['voices', 'master', 'music']) {
      const f32 = new Float32Array(Buffer.from(res[k].b64, 'base64').buffer.slice(0));
      const raw = Buffer.from(res[k].b64, 'base64');
      const arr = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
      writeFileSync(path.join(OUT, `${label}-${k}.wav`), wav(arr, res[k].sampleRate));
      res[k] = { sampleRate: res[k].sampleRate, seconds: res[k].seconds, samples: f32.length };
    }
    writeFileSync(path.join(OUT, `${label}-notes.json`), JSON.stringify(res.notes));
    delete res.notes;
    report.phases[label] = res;
    console.log(`phase ${label} :`, JSON.stringify({ weapons: res.weapons, roster: res.roster, bpm: res.bpm, maxVoices: res.maxVoices, secondsVoices: res.voices.seconds, elapsedAudio: res.elapsedAudio, screen: res.screen, acState: res.acState, gameActive: res.gameActive }));
  }

  await record('battant', ['battant'], 8);
  // 4 Timbres au cran 3 : c'est là que la lisibilité voix / musique se juge (masquage par bande)
  await record('quatre', ['battant', 'clarine', 'bourdon', 'chaine_d_angelus'], 8, 3);
  // bonus : 6 armes (plafond du mélangeur : ≤ 3 voix tonales par point de grille)
  await record('six', ['battant', 'clarine', 'bourdon', 'chaine_d_angelus', 'tocsin', 'grelots'], 4);

  await browser.close();
  report.ok = report.consoleErrors.length === 0 && report.pageErrors.length === 0 && report.badResponses.length === 0;
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log('erreurs console :', report.consoleErrors.length, '| erreurs page :', report.pageErrors.length, '| HTTP ≥ 400 :', report.badResponses.length);
  if (report.consoleErrors.length) console.log(report.consoleErrors.slice(0, 5));
  if (report.pageErrors.length) console.log(report.pageErrors.slice(0, 5));
  console.log('fichiers →', OUT);
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => { console.error('ÉCHEC :', e); process.exit(2); });
