// Le run : enchaînement des salles, compétences, sérialisation. API publique : docs/CONTRATS.md §3.
import { creerRng, seedDepuis } from './rng.js';
import { creerBus } from './hooks.js';
import { creerGrille, groupe, estTapable, existeCoup, nouvelleBille, nouvellePierre, nouvelElement, idx, coord } from './grille.js';
import { retomber, detruire, jouerRotation, jouerTap, jouerRotationJoueur, verifierNiveau, verifierFin, majSeuilsXp } from './tour.js';
import { appliquerEffet, retirerEffet, SEUILS_NIVEAU, NIVEAU_MAX } from './progression.js';
import { SALLES, ORDRE_PHASE1 } from '../data/salles.js';
import { COMPETENCES, POIDS_RARETE } from '../data/competences.js';

const VERSION = 1;

function creerCtx(etat, rng) {
  const bus = creerBus();
  const ctx = {
    etat, rng, bus, evenements: [], activesCeTour: new Set(),
    get grille() { return etat.grille; },
    get memo() { return etat.memo; },
    emettre(evt) { ctx.evenements.push(evt); },
    nb(id) { return etat.competences.filter((c) => c === id).length; },
    retomber() { retomber(ctx); },
    detruire(indices, cause) { detruire(ctx, indices, cause); },
    tourner(sens, options) { return jouerRotation(ctx, sens, options); },
    retirerEffet(id) { retirerEffet(ctx, id); },
  };
  return ctx;
}

function installerCompetences(ctx) {
  for (const id of new Set(ctx.etat.competences)) {
    const c = COMPETENCES.find((x) => x.id === id);
    if (c) c.installer(ctx);
  }
}

/** Grille de départ : billes aléatoires, éléments et pierres placés au hasard, au moins un groupe tapable. */
function genererGrille(ctx, def) {
  const e = ctx.etat;
  for (let essai = 0; essai < 20; essai++) {
    const g = creerGrille(def.grille.w, def.grille.h);
    for (let i = 0; i < g.cellules.length; i++) g.cellules[i] = nouvelleBille(g, ctx.rng.entier(e.couleurs));
    const libres = ctx.rng.melanger([...Array(g.cellules.length).keys()]);
    for (const el of def.elements ?? []) {
      for (let k = 0; k < el.n && libres.length; k++) {
        const i = libres.pop();
        if (el.type === 'pierre') g.cellules[i] = nouvellePierre(g);
        else if (el.type === 'bulle') g.cellules[i] = nouvelElement(g, 'bulle', { contenu: nouvelleBille(g, ctx.rng.entier(e.couleurs)) });
        else g.cellules[i] = nouvelElement(g, el.type);
      }
    }
    if (existeCoup(g)) return g;
  }
  return creerGrille(def.grille.w, def.grille.h);
}

function entrerSalle(ctx, index) {
  const e = ctx.etat;
  const def = SALLES.find((s) => s.id === e.ordre[index]);
  // Les effets de la salle précédente sont retirés ; les compétences restent.
  for (const a of e.effetsActifs) ctx.bus.off('effet:' + a.id);
  e.effetsActifs = []; e.effetsVus = [];
  e.salleIndex = index;
  e.salle = { id: def.id, nom: def.nom, type: def.type, desc: def.desc, index, total: e.ordre.length, regles: def.regles ?? {} };
  e.couleurs = e.options.couleurs ?? def.couleurs;
  e.gravite = 0; e.tour = 0; e.xpSalle = 0; e.niveau = 1; majSeuilsXp(e);
  e.coupsMax = ctx.bus.reduire('coupsInitiaux', Math.max(5, Math.round(def.coups / e.difficulte)), ctx, { salle: def });
  e.coups = e.coupsMax;
  e.jaugeMax = ctx.bus.reduire('jaugeInitiale', e.options.jauge ?? def.jauge ?? 3, ctx, { salle: def });
  e.jauge = e.jaugeMax;
  e.objectif = { type: def.objectif.type, cible: Math.round(def.objectif.cible * e.difficulte), progres: 0 };
  if (def.objectif.type === 'couleur') e.objectif.couleur = ctx.rng.entier(e.couleurs);
  e.prochainesEntrees = [];
  e.grille = genererGrille(ctx, def);
  e.annonce = def.regles?.rotationAuto ? (def.regles.rotationAuto === 'pendule' ? { sens: 1 } : { sens: ctx.rng.choix([-1, 1, 2]) }) : null;
  e.enAttente = null;
  ctx.activesCeTour.clear();
  ctx.emettre({ t: 'salle', index, nom: def.nom });
  ctx.emettre({ t: 'coups', coups: e.coups, jauge: e.jauge });
  ctx.emettre({ t: 'objectif', progres: 0, cible: e.objectif.cible, atteint: false });
  ctx.bus.emettre('debutSalle', ctx, { salle: def });
}

function proposerCompetences(ctx, n = 3) {
  const e = ctx.etat;
  const pool = COMPETENCES.filter((c) => {
    const nb = ctx.nb(c.id);
    if (!nb) return true;
    if (c.stackable === true) return true;
    if (typeof c.stackable === 'number') return nb < c.stackable;
    return false;
  });
  const choisies = [];
  while (choisies.length < n && pool.length) {
    const total = pool.reduce((s, c) => s + POIDS_RARETE[c.rarete], 0);
    let r = ctx.rng.suivant() * total, k = 0;
    while (k < pool.length - 1 && (r -= POIDS_RARETE[pool[k].rarete]) > 0) k++;
    choisies.push(pool.splice(k, 1)[0]);
  }
  return choisies.map((c) => ({ id: c.id, nom: c.nom, desc: c.desc, rarete: c.rarete }));
}

function finirRun(ctx, victoire) {
  const e = ctx.etat;
  const monnaieMeta = Math.floor((e.xpTotale / 100) * (victoire ? 1.5 : 1));
  e.enAttente = { type: 'finRun', victoire, xpTotale: e.xpTotale, monnaieMeta, salleIndex: e.salleIndex };
  ctx.emettre({ t: 'finRun', victoire });
}

function choisir(ctx, id) {
  const e = ctx.etat, att = e.enAttente;
  if (!att) return false;
  switch (att.type) {
    case 'niveau': {
      if (!att.propositions.some((p) => p.id === id)) return false;
      e.enAttente = null;
      appliquerEffet(ctx, id);
      verifierNiveau(ctx);
      verifierFin(ctx);
      return true;
    }
    case 'competence': {
      if (id !== null && !att.propositions.some((p) => p.id === id)) return false;
      e.enAttente = null;
      if (id) {
        e.competences.push(id);
        const c = COMPETENCES.find((x) => x.id === id);
        if (ctx.nb(id) === 1) c.installer(ctx);
        ctx.emettre({ t: 'competence', id, nom: c.nom });
      }
      entrerSalle(ctx, e.salleIndex + 1);
      return true;
    }
    case 'finSalle': {
      e.enAttente = null;
      if (!att.victoire) { finirRun(ctx, false); return true; }
      if (e.salleIndex + 1 >= e.ordre.length) { finirRun(ctx, true); return true; }
      e.enAttente = { type: 'competence', propositions: proposerCompetences(ctx) };
      return true;
    }
    default: return false;
  }
}

function envelopper(ctx) {
  const e = ctx.etat;
  const collecter = (fn) => { ctx.evenements = []; fn(); const ev = ctx.evenements; ctx.evenements = []; e.rngEtat = ctx.rng.etat; return ev; };
  const run = {
    get etat() { return e; },
    tap(x, y) { return collecter(() => jouerTap(ctx, x, y)); },
    tourner(sens) { return collecter(() => jouerRotationJoueur(ctx, sens)); },
    choisir(id) { return collecter(() => choisir(ctx, id)); },
    groupeA(x, y) {
      const g = e.grille, i = idx(g, x, y);
      if (x < 0 || x >= g.w || y < 0 || y >= g.h || !estTapable(g, i)) return [];
      return groupe(g, i).map((k) => { const [cx, cy] = coord(g, k); return { x: cx, y: cy }; });
    },
    peutTaper(x, y) { return !e.enAttente && e.coups > 0 && x >= 0 && x < e.grille.w && y >= 0 && y < e.grille.h && estTapable(e.grille, idx(e.grille, x, y)); },
    peutTourner(sens = 1) { return !e.enAttente && ctx.bus.reduire('coutRotation', 1, ctx, { sens }) <= e.jauge; },
    serialiser() { e.rngEtat = ctx.rng.etat; return JSON.stringify({ version: VERSION, etat: e }); },
    /** Événements de démarrage (salle initiale) à jouer une fois par l'appelant. */
    evenementsInitiaux: [],
    ctx,
  };
  return run;
}

/**
 * Crée un run. options : { couleurs, jauge } pour le mode Test.
 * salles : liste d'ids (défaut : ORDRE_PHASE1).
 */
export function creerRun({ seed = Date.now(), salles = null, competences = [], difficulte = 1, options = {} } = {}) {
  const s = seedDepuis(seed);
  const rng = creerRng(s);
  const etat = {
    version: VERSION, seed: s, rngEtat: s, ordre: salles ?? ORDRE_PHASE1.slice(), difficulte, options,
    salleIndex: 0, salle: null, grille: null, gravite: 0,
    coups: 0, coupsMax: 0, jauge: 0, jaugeMax: 0, tour: 0,
    xpSalle: 0, niveau: 1, xpTotale: 0, couleurs: 5,
    objectif: null, competences: competences.slice(), effetsActifs: [], effetsVus: [],
    prochainesEntrees: [], annonce: null, enAttente: null, memo: {},
  };
  const ctx = creerCtx(etat, rng);
  installerCompetences(ctx);
  ctx.evenements = [];
  entrerSalle(ctx, 0);
  const run = envelopper(ctx);
  run.evenementsInitiaux = ctx.evenements.slice();
  ctx.evenements = [];
  return run;
}

export function chargerRun(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || data.version !== VERSION) return null;
  const etat = data.etat;
  const rng = creerRng(etat.seed); rng.etat = etat.rngEtat;
  const ctx = creerCtx(etat, rng);
  installerCompetences(ctx);
  for (const a of etat.effetsActifs) appliquerEffet(ctx, a.id, { reprise: true, restant: a.restant });
  ctx.evenements = [];
  return envelopper(ctx);
}

export { SEUILS_NIVEAU, NIVEAU_MAX };
