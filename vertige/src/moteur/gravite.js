// Gravité mobile sur données fixes (décision D1).
// gravite ∈ {0,1,2,3} = quarts de tour horaires du plateau à l'écran.
// G est le vecteur de chute en coordonnées plateau ; -G est le « haut visuel ».
export const VECTEURS = [[0, 1], [1, 0], [0, -1], [-1, 0]];

export function vecteur(gravite) { return VECTEURS[gravite]; }

export function tourner(gravite, sens) { return (gravite + sens + 4) % 4; }

const cache = new Map();

/**
 * Colonnes au sens de la gravité : tableau de tableaux d'indices, chaque colonne
 * ordonnée du haut visuel (anti-G) vers le bas (G). Mis en cache par (w,h,g).
 */
export function colonnes(w, h, gravite) {
  const cle = w + 'x' + h + '/' + gravite;
  let c = cache.get(cle);
  if (c) return c;
  c = [];
  if (gravite % 2 === 0) {
    for (let x = 0; x < w; x++) {
      const col = [];
      if (gravite === 0) for (let y = 0; y < h; y++) col.push(y * w + x);
      else for (let y = h - 1; y >= 0; y--) col.push(y * w + x);
      c.push(col);
    }
  } else {
    for (let y = 0; y < h; y++) {
      const col = [];
      if (gravite === 1) for (let x = 0; x < w; x++) col.push(y * w + x);
      else for (let x = w - 1; x >= 0; x--) col.push(y * w + x);
      c.push(col);
    }
  }
  cache.set(cle, c);
  return c;
}

/** Indices de la ligne parallèle à G passant par (x,y). */
export function ligneAxe(w, h, gravite, x, y) {
  const r = [];
  if (gravite % 2 === 0) for (let j = 0; j < h; j++) r.push(j * w + x);
  else for (let i = 0; i < w; i++) r.push(y * w + i);
  return r;
}

/** Indices de la ligne perpendiculaire à G passant par (x,y). */
export function lignePerp(w, h, gravite, x, y) {
  const r = [];
  if (gravite % 2 === 0) for (let i = 0; i < w; i++) r.push(y * w + i);
  else for (let j = 0; j < h; j++) r.push(j * w + x);
  return r;
}

/** Cases traversées par une fusée partant de (x,y) dans le sens de G, hors la case de départ. */
export function trajetFusee(w, h, gravite, x, y) {
  const [gx, gy] = VECTEURS[gravite];
  const r = [];
  let cx = x + gx, cy = y + gy;
  while (cx >= 0 && cx < w && cy >= 0 && cy < h) { r.push(cy * w + cx); cx += gx; cy += gy; }
  return r;
}

/** Dimensions apparentes à l'écran (largeur, hauteur) pour cette orientation. */
export function dimensionsEcran(w, h, gravite) {
  return gravite % 2 === 0 ? [w, h] : [h, w];
}
