// Pilote Playwright (agent E) : node src/ui/_test/ui-shot.js <dossier> [étapes…]
// étape = key:Enter | key:A+B (séquence) | click:x,y | move:x,y | wait:ms | shot:nom | eval:code | type:texte
// Prérequis : serveur ./serve.sh lancé (http://localhost:8080/carillon/index.html).
// usage : node ui-shot.js <outDir> [steps...]  où step = "key:Enter" | "click:x,y" | "wait:ms" | "shot:name" | "eval:code"
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const [outDir, ...steps] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.goto('http://localhost:8080/carillon/index.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.carillon && window.carillon.states.topName() === 'unlock', null, { timeout: 30000 }).catch(() => errors.push('timeout: écran unlock'));
  for (const s of steps) {
    const i = s.indexOf(':');
    const kind = s.slice(0, i), arg = s.slice(i + 1);
    if (kind === 'key') { for (const k of arg.split('+')) { await page.keyboard.press(k); await page.waitForTimeout(70); } }
    else if (kind === 'down') await page.keyboard.down(arg);
    else if (kind === 'up') await page.keyboard.up(arg);
    else if (kind === 'click') { const [x, y] = arg.split(',').map(Number); await page.mouse.click(x, y); }
    else if (kind === 'move') { const [x, y] = arg.split(',').map(Number); await page.mouse.move(x, y); }
    else if (kind === 'wait') await page.waitForTimeout(Number(arg));
    else if (kind === 'shot') await page.screenshot({ path: path.join(outDir, arg + '.png') });
    else if (kind === 'eval') { const r = await page.evaluate(arg); console.log('eval →', JSON.stringify(r)); }
    else if (kind === 'type') await page.keyboard.type(arg);
    else if (kind === 'beat') { // N frappes Espace calées sur la Mesure (conductor.nextBeatAt)
      for (let n = 0; n < Number(arg); n++) {
        const ms = await page.evaluate(() => { const c = window.carillon.conductor; return Math.max(0, (c.nextBeatAt(1) - window.carillon.audio.now()) * 1000); });
        await page.waitForTimeout(ms); await page.keyboard.press('Space'); await page.waitForTimeout(120);
      }
    }
  }
  const state = await page.evaluate(() => window.carillon ? { top: window.carillon.states.topName(), base: window.carillon.states.baseName(), fps: window.carillon.loop && window.carillon.loop.stats.fps } : null).catch(() => null);
  console.log('state:', JSON.stringify(state));
  console.log('errors:', errors.length ? '\n' + errors.join('\n') : 'none');
  await browser.close();
})();
