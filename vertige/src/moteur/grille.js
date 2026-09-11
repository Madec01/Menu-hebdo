// Grille en coordonnées plateau, jamais tournée. Voir docs/CONTRATS.md §1.
export function creerGrille(w, h, forme = null) {
  const cellules = new Array(w * h).fill(null);
  const f = forme ? forme.slice() : new Array(w * h).fill(1);
  return { w, h, forme: f, cellules, prochainId: 1 };
}

export function idx(g, x, y) { return y * g.w + x; }
export function dans(g, x, y) { return x >= 0 && x < g.w && y >= 0 && y < g.h && g.forme[y * g.w + x] === 1; }
export function cellule(g, x, y) { return dans(g, x, y) ? g.cellules[y * g.w + x] : null; }
export function coord(g, i) { return [i % g.w, (i / g.w) | 0]; }

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Indices des voisins orthogonaux existants de l'indice i. */
export function voisins(g, i) {
  const x = i % g.w, y = (i / g.w) | 0, r = [];
  for (const [dx, dy] of ORTHO) if (dans(g, x + dx, y + dy)) r.push((y + dy) * g.w + x + dx);
  return r;
}

/** Une cellule fait partie d'un groupe si c'est une bille (spéciale comprise) avec une couleur. */
function membre(c) { return c && c.type === 'bille' && c.couleur !== null && c.couleur !== undefined; }

/** Groupe (indices) de billes de même couleur contenant l'indice i ; [] si la case n'est pas une bille. */
export function groupe(g, i) {
  const c = g.cellules[i];
  if (!membre(c)) return [];
  const couleur = c.couleur, vu = new Set([i]), pile = [i], r = [];
  while (pile.length) {
    const p = pile.pop(); r.push(p);
    for (const v of voisins(g, p)) {
      const cv = g.cellules[v];
      if (!vu.has(v) && membre(cv) && cv.couleur === couleur) { vu.add(v); pile.push(v); }
    }
  }
  return r;
}

/** Tous les groupes tapables (taille ≥ 2), sans doublon. */
export function tousGroupes(g) {
  const vu = new Uint8Array(g.cellules.length), r = [];
  for (let i = 0; i < g.cellules.length; i++) {
    if (vu[i] || !membre(g.cellules[i])) continue;
    const gr = groupe(g, i);
    for (const k of gr) vu[k] = 1;
    if (gr.length >= 2) r.push(gr);
  }
  return r;
}

/** Une case est tapable si elle appartient à un groupe ≥ 2, ou si c'est une spéciale seule. */
export function estTapable(g, i) {
  const c = g.cellules[i];
  if (!membre(c)) return false;
  if (c.speciale) return true;
  return groupe(g, i).length >= 2;
}

export function existeCoup(g) {
  for (let i = 0; i < g.cellules.length; i++) if (estTapable(g, i)) return true;
  return false;
}

export function nouvelleBille(g, couleur) {
  return { id: g.prochainId++, type: 'bille', couleur, speciale: null, rayon: 1, element: null };
}
export function nouvellePierre(g) {
  return { id: g.prochainId++, type: 'pierre', couleur: null, speciale: null, rayon: 1, element: null };
}
export function nouvelElement(g, type, data = {}) {
  const max = { bulle: 1, ballon: 2, fusee: 1 }[type] ?? 1;
  return { id: g.prochainId++, type: 'element', couleur: null, speciale: null, rayon: 1,
    element: { type, activations: 0, max, contenu: data.contenu ?? null } };
}

/** Une cellule qui tombe : tout sauf le ballon (qui flotte). */
export function tombe(c) { return !(c && c.type === 'element' && c.element.type === 'ballon'); }

export function compter(g, pred) {
  let n = 0;
  for (const c of g.cellules) if (c && pred(c)) n++;
  return n;
}
