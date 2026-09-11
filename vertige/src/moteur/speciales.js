// Résolution des destructions : groupes, explosions de spéciales, chaînes, pierres, activation d'éléments.
import { voisins, coord, dans } from './grille.js';
import { ligneAxe, lignePerp } from './gravite.js';
import { declencherElement } from './elements.js';

export const TYPES_SPECIALES = ['bombe', 'ligne', 'croix', 'couleur'];

/** Zone (Set d'indices) couverte par l'explosion de la spéciale située en i. Orientée par la gravité. */
export function zoneSpeciale(ctx, i, c) {
  const g = ctx.grille, gr = ctx.etat.gravite, [x, y] = coord(g, i), r = c.rayon ?? 1;
  const zone = new Set([i]);
  const perp = gr % 2 === 0 ? [1, 0] : [0, 1]; // épaisseur des lignes, perpendiculaire à G
  const ligne = (fn) => {
    for (let t = -(r - 1); t <= r - 1; t++) {
      const px = x + perp[0] * t, py = y + perp[1] * t;
      if (dans(g, px, py)) for (const k of fn(g.w, g.h, gr, px, py)) if (g.forme[k] === 1) zone.add(k);
    }
  };
  switch (c.speciale) {
    case 'bombe':
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dans(g, x + dx, y + dy)) zone.add((y + dy) * g.w + x + dx);
      break;
    case 'ligne': ligne(ligneAxe); break;
    case 'croix': ligne(ligneAxe); ligne(lignePerp); break;
    case 'couleur':
      for (let k = 0; k < g.cellules.length; k++) { const ck = g.cellules[k]; if (ck && ck.type === 'bille' && ck.couleur === c.couleur) zone.add(k); }
      break;
  }
  return ctx.bus.reduire('zoneExplosion', zone, ctx, { type: c.speciale, i, x, y, cellule: c });
}

/** Marque un élément comme activé ce tour (une seule activation par élément et par tour). */
function activer(ctx, i, activations) {
  const c = ctx.grille.cellules[i];
  if (!c || c.type !== 'element') return;
  if (ctx.activesCeTour.has(c.id)) return;
  ctx.activesCeTour.add(c.id);
  activations.push(i);
}

function xpSalve(ctx, salve, nBilles, nPierres) {
  let xp;
  if (salve.cause === 'groupe') {
    const n = nBilles + (salve.tapee !== undefined ? 1 : 0); // la bille devenue spéciale compte
    const te = ctx.bus.reduire('tailleGroupe', n, ctx, salve);
    xp = 10 * n * (1 + 0.15 * Math.max(0, te - 2));
  } else {
    xp = (10 * nBilles + 5 * nPierres) * (1 + 0.25 * Math.min(8, salve.profondeur)); // chaîne plafonnée
  }
  xp = Math.round(ctx.bus.reduire('xpGain', xp, ctx, salve));
  if (xp <= 0) return;
  ctx.etat.xpSalle += xp; ctx.etat.xpTotale += xp;
  ctx.emettre({ t: 'xp', gain: xp, xpSalle: ctx.etat.xpSalle, niveau: ctx.etat.niveau, profondeur: salve.profondeur });
}

/**
 * Résout une salve initiale et tout ce qu'elle entraîne (chaînes, pierres adjacentes, éléments, fusées).
 * salve = { cellules:[idx], cause, origine:{x,y}, profondeur:0, tapee?:idx }
 */
export function resoudre(ctx, initiale) {
  const g = ctx.grille, file = [initiale], declenchees = new Set();
  const objectif = ctx.etat.objectif;
  while (file.length) {
    const activations = [];
    while (file.length) {
      const s = file.shift();
      const explosion = s.cause !== 'groupe' && s.cause !== 'pierre';
      const aDetruire = new Set();
      const conversions = [];
      for (const i of s.cellules) {
        const c = g.cellules[i];
        if (!c) continue;
        if (c.type === 'element') { if (explosion) activer(ctx, i, activations); continue; }
        if (c.type === 'pierre' && s.cause === 'groupe') continue;
        if (c.type === 'pierre') {
          const sort = ctx.bus.reduire('sortPierre', 'detruite', ctx, { i, cause: s.cause });
          if (sort === 'bille') {
            // Fossoyeur : la pierre devient une bille ; pour l'objectif « pierres », elle compte comme éliminée.
            c.type = 'bille'; c.couleur = ctx.rng.entier(ctx.etat.couleurs);
            if (objectif.type === 'pierres') objectif.progres++;
            const [x, y] = coord(g, i); conversions.push({ x, y, id: c.id, couleur: c.couleur, type: 'bille' }); continue;
          }
        }
        aDetruire.add(i);
      }
      if (conversions.length) ctx.emettre({ t: 'conversion', cellules: conversions });
      // Une spéciale adjacente à une explosion s'enclenche avec elle.
      if (explosion) for (const i of [...aDetruire]) for (const v of voisins(g, i)) { const cv = g.cellules[v]; if (cv && cv.speciale && !aDetruire.has(v)) aDetruire.add(v); }
      if (!aDetruire.size) continue;
      const evt = [], pierresAdj = new Set();
      let nBilles = 0, nPierres = 0;
      for (const i of aDetruire) {
        const c = g.cellules[i], [x, y] = coord(g, i);
        evt.push({ x, y, id: c.id, couleur: c.couleur, type: c.type });
        if (c.type === 'pierre') { nPierres++; if (objectif.type === 'pierres') objectif.progres++; }
        else { nBilles++; if (objectif.type === 'couleur' && c.couleur === objectif.couleur) objectif.progres++; }
        if (c.speciale && !declenchees.has(c.id)) {
          declenchees.add(c.id);
          file.push({ cellules: [...zoneSpeciale(ctx, i, c)], cause: c.speciale, origine: { x, y }, profondeur: s.profondeur + 1 });
        }
      }
      for (const i of aDetruire) g.cellules[i] = null;
      ctx.emettre({ t: 'detruit', cellules: evt, cause: s.cause, origine: s.origine, profondeur: s.profondeur });
      xpSalve(ctx, s, nBilles, nPierres);
      // Choix assumé : une pierre détruite par adjacence ne propage rien (ni pierres voisines, ni éléments),
      // sinon un amas de pierres disparaîtrait d'un coup.
      if (s.cause !== 'pierre') {
        for (const i of aDetruire) for (const v of voisins(g, i)) {
          const cv = g.cellules[v];
          if (!cv) continue;
          if (cv.type === 'element') activer(ctx, v, activations);
          else if (cv.type === 'pierre') pierresAdj.add(v);
        }
        if (pierresAdj.size) file.push({ cellules: [...pierresAdj], cause: 'pierre', origine: s.origine, profondeur: s.profondeur + 1 });
      }
      const info = { cellules: evt, cause: s.cause, couleur: s.couleur, taille: evt.length, profondeur: s.profondeur, origine: s.origine };
      ctx.bus.emettre(s.cause === 'groupe' ? 'groupeDetruit' : 'explosion', ctx, info);
    }
    for (const i of activations) {
      const c = g.cellules[i];
      if (!c || c.type !== 'element') continue;
      c.element.activations++;
      const [x, y] = coord(g, i);
      ctx.emettre({ t: 'element', x, y, id: c.id, type: c.element.type, activations: c.element.activations, max: c.element.max, action: 'activation' });
      if (c.element.activations >= c.element.max) declencherElement(ctx, i, c, file);
    }
  }
}

/** Force l'activation immédiate (+1) de tous les éléments présents (effet « éléments avancés »). */
export function avancerElements(ctx) {
  const g = ctx.grille, file = [];
  for (let i = 0; i < g.cellules.length; i++) {
    const c = g.cellules[i];
    if (!c || c.type !== 'element') continue;
    c.element.activations++;
    const [x, y] = coord(g, i);
    ctx.emettre({ t: 'element', x, y, id: c.id, type: c.element.type, activations: c.element.activations, max: c.element.max, action: 'activation' });
    if (c.element.activations >= c.element.max) declencherElement(ctx, i, c, file);
  }
  while (file.length) resoudre(ctx, file.shift());
}
