import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerRun, chargerRun } from '../src/moteur/run.js';
import { creerGrille, nouvelleBille, nouvellePierre, nouvelElement, groupe } from '../src/moteur/grille.js';
import { appliquerGravite, remplir } from '../src/moteur/chute.js';
import { colonnes, tourner } from '../src/moteur/gravite.js';

test('gravité : colonnes ordonnées du haut visuel vers le bas pour les 4 orientations', () => {
  const c0 = colonnes(3, 2, 0); assert.deepEqual(c0[0], [0, 3]);          // x=0 : y 0→1
  const c1 = colonnes(3, 2, 1); assert.deepEqual(c1[0], [0, 1, 2]);       // y=0 : x 0→2 (bas = droite)
  const c2 = colonnes(3, 2, 2); assert.deepEqual(c2[0], [3, 0]);          // bas = haut du plateau
  const c3 = colonnes(3, 2, 3); assert.deepEqual(c3[0], [2, 1, 0]);       // bas = gauche
  assert.equal(tourner(3, 1), 0); assert.equal(tourner(0, -1), 3); assert.equal(tourner(1, 2), 3);
});

test('chute : compaction vers G, le ballon sert de sol, remplissage par le haut visuel', () => {
  const g = creerGrille(1, 4);
  g.cellules[0] = nouvelleBille(g, 0); g.cellules[1] = null; g.cellules[2] = nouvelElement(g, 'ballon'); g.cellules[3] = null;
  const dep = appliquerGravite(g, 0);
  assert.equal(dep.length, 1); assert.deepEqual(dep[0].vers, { x: 0, y: 1 });
  assert.equal(g.cellules[1].couleur, 0); assert.equal(g.cellules[2].element.type, 'ballon'); assert.equal(g.cellules[3], null);
  let k = 0;
  const entrees = remplir(g, 0, () => nouvelleBille(g, k++));
  assert.equal(entrees.length, 1); assert.deepEqual(entrees[0].depuis, { x: 0, y: -1 });
  assert.equal(g.cellules[3], null, 'sous le ballon, pas de remplissage');
  // gravité inversée : le trou sous le ballon devient le haut, il se remplit
  const e2 = remplir(g, 2, () => nouvelleBille(g, 9));
  assert.equal(e2.length, 1); assert.deepEqual(e2[0].depuis, { x: 0, y: 4 });
});

test('groupe : flood fill orthogonal de même couleur', () => {
  const g = creerGrille(3, 3);
  const cols = [1, 1, 0, 1, 0, 0, 2, 2, 2];
  cols.forEach((c, i) => { g.cellules[i] = nouvelleBille(g, c); });
  assert.deepEqual(groupe(g, 0).sort(), [0, 1, 3]);
  assert.deepEqual(groupe(g, 6).sort(), [6, 7, 8]);
});

test('run : un tap détruit un groupe, décrémente les coups, la grille reste pleine', () => {
  const run = creerRun({ seed: 42 });
  const e = run.etat;
  const coups = e.coups;
  let joue = false;
  for (let y = 0; y < e.grille.h && !joue; y++) for (let x = 0; x < e.grille.w && !joue; x++) if (run.peutTaper(x, y)) {
    const ev = run.tap(x, y);
    assert.ok(ev.some((v) => v.t === 'tap')); assert.ok(ev.some((v) => v.t === 'detruit'));
    joue = true;
  }
  assert.ok(joue);
  assert.equal(e.coups, coups - 1);
  assert.ok(e.grille.cellules.every((c) => c !== null));
});

test('run : rotation consomme la jauge et change la gravité ; refusée à jauge 0', () => {
  const run = creerRun({ seed: 3, options: { jauge: 1 } });
  const e = run.etat;
  assert.equal(e.jauge, 1);
  const ev = run.tourner(1);
  assert.ok(ev.some((v) => v.t === 'rotation' && v.vers === 1));
  assert.equal(e.jauge, 0);
  assert.equal(run.tourner(1).length, 0);
  assert.ok(e.grille.cellules.every((c) => c !== null));
});

test('sérialisation : même seed, même journal ; recharger reproduit la suite', () => {
  const a = creerRun({ seed: 99 }), b = creerRun({ seed: 99 });
  assert.equal(JSON.stringify(a.etat.grille.cellules), JSON.stringify(b.etat.grille.cellules));
  const jouer = (r) => { const e = r.etat; for (let y = 0; y < e.grille.h; y++) for (let x = 0; x < e.grille.w; x++) if (r.peutTaper(x, y)) return r.tap(x, y); };
  const ea = jouer(a), eb = jouer(b);
  assert.equal(JSON.stringify(ea), JSON.stringify(eb));
  const c = chargerRun(a.serialiser());
  assert.equal(JSON.stringify(jouer(a)), JSON.stringify(jouer(c)));
});

test('spéciale : un groupe ≥ 4 crée une bombe sur la case tapée', () => {
  const run = creerRun({ seed: 5 });
  const e = run.etat, g = e.grille;
  // Force une colonne de 4 rouges en bas à gauche.
  for (let y = 6; y < 10; y++) g.cellules[y * g.w] = nouvelleBille(g, 0);
  for (let y = 6; y < 10; y++) if (g.w > 1) g.cellules[y * g.w + 1].couleur = 1;
  const ev = run.tap(0, 9);
  const sp = ev.find((v) => v.t === 'speciale');
  assert.ok(sp && sp.type === 'bombe' && sp.x === 0 && sp.y === 9);
  assert.equal(g.cellules[9 * g.w].speciale, 'bombe');
});

test('pierre : détruite par adjacence à un groupe', () => {
  const run = creerRun({ seed: 11 });
  const e = run.etat, g = e.grille;
  g.cellules[9 * g.w] = nouvelleBille(g, 2); g.cellules[9 * g.w + 1] = nouvelleBille(g, 2); g.cellules[8 * g.w] = nouvellePierre(g);
  g.cellules[8 * g.w + 1].couleur = 3; g.cellules[9 * g.w + 2].couleur = 3;
  const ev = run.tap(0, 9);
  assert.ok(ev.some((v) => v.t === 'detruit' && v.cause === 'pierre'));
});
