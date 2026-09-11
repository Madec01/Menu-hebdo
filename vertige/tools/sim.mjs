/**
 * Simulateur headless : joue des runs complets sans DOM avec une politique simple,
 * et rapporte les statistiques utiles à l'équilibrage.
 *   node tools/sim.mjs                  # 200 runs, seeds 1..200
 *   node tools/sim.mjs --runs 50 --seed 7 --politique gourmande|aleatoire --competences vertige,domino
 *   node tools/sim.mjs --verbose        # journal du premier run
 */
import { creerRun } from '../src/moteur/run.js';
import { tousGroupes } from '../src/moteur/grille.js';
import { colonnes } from '../src/moteur/gravite.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const RUNS = +opt('runs', 200), SEED0 = +opt('seed', 1), POLITIQUE = opt('politique', 'gourmande');
const COMPETENCES = (opt('competences', '') || '').split(',').filter(Boolean);
const VERBOSE = args.includes('--verbose');

/** Politique : tap du plus gros groupe ; tourne si aucun groupe ≥ 3 et jauge disponible. */
function agir(run, rng) {
  const e = run.etat;
  if (e.enAttente) {
    const a = e.enAttente;
    if (a.type === 'niveau' || a.type === 'competence') return run.choisir(a.propositions[Math.floor(rng() * a.propositions.length)].id);
    return run.choisir(null);
  }
  const groupes = tousGroupes(e.grille).sort((a, b) => b.length - a.length);
  const specialeSeule = e.grille.cellules.findIndex((c) => c && c.speciale);
  if (POLITIQUE === 'aleatoire' && groupes.length && rng() < 0.8) {
    const g = groupes[Math.floor(rng() * groupes.length)];
    return run.tap(g[0] % e.grille.w, (g[0] / e.grille.w) | 0);
  }
  if ((!groupes.length || groupes[0].length < 3) && run.peutTourner(1)) return run.tourner(rng() < 0.5 ? 1 : -1);
  if (groupes.length) return run.tap(groupes[0][0] % e.grille.w, (groupes[0][0] / e.grille.w) | 0);
  if (specialeSeule >= 0) return run.tap(specialeSeule % e.grille.w, (specialeSeule / e.grille.w) | 0);
  if (run.peutTourner(1)) return run.tourner(1);
  return null;
}

function verifierPleine(e) {
  const g = e.grille;
  for (const col of colonnes(g.w, g.h, e.gravite)) {
    let sousBallon = false;
    for (const i of col) {
      const c = g.cellules[i];
      if (c && c.type === 'element' && c.element.type === 'ballon') sousBallon = true;
      else if (c === null && !sousBallon) throw new Error('case vide hors ombre de ballon, tour ' + e.tour + ' salle ' + e.salle.id);
    }
  }
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const stats = { runs: 0, victoires: 0, parSalle: {}, speciales: {}, niveauxMax: [], xpTotale: 0, tours: 0, erreurs: 0 };
const salleStat = (id) => (stats.parSalle[id] ??= { jouees: 0, gagnees: 0, xp: 0, niveau: 0, coupsRestants: 0, raisons: {} });

for (let s = 0; s < RUNS; s++) {
  const run = creerRun({ seed: SEED0 + s, competences: COMPETENCES });
  const rng = mulberry(SEED0 + s);
  let garde = 0, journal = run.evenementsInitiaux;
  try {
    while (garde++ < 5000) {
      const e = run.etat;
      if (e.enAttente?.type === 'finRun') break;
      const avant = e.salleIndex;
      const ev = agir(run, rng);
      if (ev === null) { stats.erreurs++; break; }
      if (VERBOSE && s === 0) for (const x of ev) console.log(JSON.stringify(x).slice(0, 160));
      for (const x of ev) {
        if (x.t === 'speciale') stats.speciales[x.type] = (stats.speciales[x.type] ?? 0) + 1;
        if (x.t === 'finSalle') {
          const st = salleStat(e.salle.id);
          st.jouees++; if (x.victoire) st.gagnees++; st.xp += e.xpSalle; st.niveau += e.niveau; st.coupsRestants += e.coups;
          st.raisons[x.raison] = (st.raisons[x.raison] ?? 0) + 1;
          stats.tours += e.tour;
        }
      }
      // Invariant : aucune case vide après un tour joué, sauf sous un ballon (qui flotte et fait sol).
      if (!e.enAttente) verifierPleine(e);
    }
    stats.runs++;
    if (run.etat.enAttente?.victoire) stats.victoires++;
    stats.xpTotale += run.etat.xpTotale;
  } catch (err) { stats.erreurs++; console.error('seed', SEED0 + s, err.message); if (VERBOSE) console.error(err.stack); }
}

console.log(`\n${stats.runs} runs, politique ${POLITIQUE}, compétences [${COMPETENCES.join(', ')}]`);
console.log(`victoires : ${stats.victoires} (${((100 * stats.victoires) / Math.max(1, stats.runs)).toFixed(0)} %) — XP moyenne par run ${(stats.xpTotale / Math.max(1, stats.runs)).toFixed(0)} — erreurs ${stats.erreurs}`);
console.log('spéciales créées :', stats.speciales);
console.table(Object.fromEntries(Object.entries(stats.parSalle).map(([id, s]) => [id, {
  jouees: s.jouees, 'gagnées %': ((100 * s.gagnees) / s.jouees).toFixed(0), 'xp moy': (s.xp / s.jouees).toFixed(0),
  'niveau moy': (s.niveau / s.jouees).toFixed(1), 'coups restants': (s.coupsRestants / s.jouees).toFixed(1), raisons: JSON.stringify(s.raisons) }])));
