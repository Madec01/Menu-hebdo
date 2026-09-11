// Éléments à activation par proximité (phase 1 : bulle, ballon, fusée).
import { coord, dans, nouvelleBille, tombe } from './grille.js';
import { trajetFusee, vecteur } from './gravite.js';

function evenement(ctx, i, c, action, extra = {}) {
  const [x, y] = coord(ctx.grille, i);
  ctx.emettre({ t: 'element', x, y, id: c.id, type: c.element.type, activations: c.element.activations, max: c.element.max, action, ...extra });
}

/** L'élément en i a atteint son nombre d'activations : il réagit. `file` reçoit d'éventuelles salves. */
export function declencherElement(ctx, i, c, file) {
  const g = ctx.grille;
  switch (c.element.type) {
    case 'bulle': {
      const contenu = c.element.contenu ?? nouvelleBille(g, ctx.rng.entier(ctx.etat.couleurs));
      g.cellules[i] = contenu;
      evenement(ctx, i, c, 'libere');
      const [x, y] = coord(g, i);
      ctx.emettre({ t: 'apparition', cellules: [{ x, y, id: contenu.id, couleur: contenu.couleur, type: contenu.type, speciale: contenu.speciale }] });
      break;
    }
    case 'ballon':
      g.cellules[i] = null;
      if (ctx.etat.objectif.type === 'ballons') ctx.etat.objectif.progres++;
      evenement(ctx, i, c, 'eclate');
      break;
    case 'fusee': {
      g.cellules[i] = null;
      evenement(ctx, i, c, 'fusee');
      const [x, y] = coord(g, i);
      file.push({ cellules: trajetFusee(g.w, g.h, ctx.etat.gravite, x, y), cause: 'fusee', origine: { x, y }, profondeur: 1 });
      break;
    }
  }
}

/**
 * Après une rotation : chaque ballon monte d'une case contre la nouvelle gravité.
 * Au bord (plafond), il éclate. Traités du haut vers le bas pour qu'ils ne se bloquent pas entre eux.
 */
export function monteeBallons(ctx) {
  const g = ctx.grille, [gx, gy] = vecteur(ctx.etat.gravite);
  const ballons = [];
  for (let i = 0; i < g.cellules.length; i++) { const c = g.cellules[i]; if (c && c.type === 'element' && c.element.type === 'ballon') ballons.push(i); }
  // Ordre : du plus haut (le plus loin dans -G) au plus bas.
  const hauteur = (i) => { const [x, y] = coord(g, i); return -(x * gx + y * gy); };
  ballons.sort((a, b) => hauteur(b) - hauteur(a));
  for (const i of ballons) {
    const c = g.cellules[i];
    const [x, y] = coord(g, i), nx = x - gx, ny = y - gy;
    if (!dans(g, nx, ny)) {
      g.cellules[i] = null;
      if (ctx.etat.objectif.type === 'ballons') ctx.etat.objectif.progres++;
      evenement(ctx, i, c, 'eclate');
      continue;
    }
    const j = ny * g.w + nx, cible = g.cellules[j];
    if (cible && !tombe(cible)) continue; // un autre ballon au-dessus : il attend
    g.cellules[j] = c; g.cellules[i] = cible;
    evenement(ctx, j, c, 'monte', { de: { x, y } });
    if (cible) ctx.emettre({ t: 'chute', deplacements: [{ id: cible.id, de: { x: nx, y: ny }, vers: { x, y } }] });
  }
}
