/**
 * Test de fumée : build de production, serveur statique, Chromium headless, scénario joué,
 * toute erreur de console fait échouer.   node tools/smoke.mjs [--shot] [--keep]
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const SHOT_DIR = process.env.SHOT_DIR || '/tmp/vertige-shots';
const wantShots = process.argv.includes('--shot');
const PORT = 5300 + Math.floor(Math.random() * 300);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.map': 'application/json' };

function build() {
  return new Promise((resolve, reject) => {
    const p = spawn('npx', ['vite', 'build', '--logLevel', 'warn'], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
    p.on('exit', (c) => (c === 0 ? resolve(out) : reject(new Error('Échec du build :\n' + out))));
  });
}

function servir(racine) {
  const srv = createServer((req, res) => {
    let p = join(racine, decodeURIComponent(req.url.split('?')[0]));
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(readFileSync(p));
  });
  return new Promise((r) => srv.listen(PORT, () => r(srv)));
}

const chemin = ['/opt/pw-browsers/chromium', process.env.CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean).find((c) => existsSync(c));

async function main() {
  await build();
  const srv = await servir(join(process.cwd(), 'dist'));
  const browser = await chromium.launch({ executablePath: chemin });
  const page = await browser.newPage({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 2 });
  const erreurs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erreurs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => erreurs.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => erreurs.push('requête échouée: ' + r.url()));
  page.on('request', (r) => { if (!r.url().startsWith('http://localhost') && !r.url().startsWith('http://127.0.0.1')) erreurs.push('appel réseau externe: ' + r.url()); });
  if (wantShots) mkdirSync(SHOT_DIR, { recursive: true });
  const shot = async (nom) => { if (wantShots) await page.screenshot({ path: join(SHOT_DIR, nom + '.png') }); };

  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.vertige && document.querySelector('#ui button'), null, { timeout: 15000 });
  await shot('01-menu');
  await page.getByRole('button', { name: /nouveau run/i }).click();
  await page.waitForFunction(() => window.vertige.run !== null);

  const attendre = () => page.waitForFunction(() => !window.vertige.occupe, null, { timeout: 20000 });
  let taps = 0, rotations = 0, choix = 0, shotsNiveau = 0, shotJeu = 0;
  for (let i = 0; i < 40; i++) {
    await attendre();
    const etat = await page.evaluate(() => {
      const r = window.vertige.run; if (!r) return null;
      const e = r.etat, g = e.grille; let meilleur = null;
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (r.peutTaper(x, y)) { const n = r.groupeA(x, y).length; if (!meilleur || n > meilleur.n) meilleur = { x, y, n }; }
      return { attente: e.enAttente?.type ?? null, meilleur, coups: e.coups, jauge: e.jauge, w: g.w, h: g.h, gravite: e.gravite, salle: e.salle.nom };
    });
    if (!etat) break;
    if (etat.attente === 'finRun') break;
    if (etat.attente) {
      if (etat.attente === 'niveau' && shotsNiveau++ === 0) await shot('03-niveau');
      if (etat.attente === 'finSalle') await shot('05-fin-salle');
      const boutons = page.locator('#ui button:visible');
      await boutons.first().click(); choix++;
      continue;
    }
    if (i >= 3 && !shotJeu++) await shot('02-jeu');
    if (i % 5 === 4 && etat.jauge > 0) { await page.locator('#btn-rotation-droite').click(); rotations++; continue; }
    if (!etat.meilleur) { await page.locator('#btn-rotation-gauche').click(); rotations++; continue; }
    // Un vrai tap par le pointeur : la case est projetée comme le rendu le fait (centrage, marge 6 %, rotation).
    const boite = await page.locator('#plateau').boundingBox();
    const [we, he] = etat.gravite % 2 === 0 ? [etat.w, etat.h] : [etat.h, etat.w];
    const taille = Math.min((boite.width * 0.94) / we, (boite.height * 0.94) / he);
    const cx = boite.x + boite.width / 2, cy = boite.y + boite.height / 2;
    const lx = (etat.meilleur.x + 0.5 - etat.w / 2) * taille, ly = (etat.meilleur.y + 0.5 - etat.h / 2) * taille;
    const a = (etat.gravite * Math.PI) / 2, sx = cx + lx * Math.cos(a) - ly * Math.sin(a), sy = cy + lx * Math.sin(a) + ly * Math.cos(a);
    const coupsAvant = etat.coups;
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(80);
    const coupsApres = await page.evaluate(() => window.vertige.run?.etat.coups);
    if (coupsApres === coupsAvant) erreurs.push(`tap pointeur sans effet en (${etat.meilleur.x},${etat.meilleur.y}) gravité ${etat.gravite}`);
    taps++;
  }
  await attendre();
  await shot('04-fin');
  // Panneau Test
  await page.evaluate(() => window.vertige.ui.afficherMenu({ profil: { runs: 1 }, runEnCours: false }));
  await page.getByRole('button', { name: /mode test/i }).click();
  await shot('06-test');

  await browser.close(); srv.close();
  const propres = erreurs.filter((e) => !/favicon/.test(e));
  console.log(`taps ${taps}, rotations ${rotations}, choix ${choix}, erreurs ${propres.length}`);
  for (const e of propres) console.log('  ' + e);
  if (wantShots) console.log('captures dans ' + SHOT_DIR);
  process.exit(propres.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
