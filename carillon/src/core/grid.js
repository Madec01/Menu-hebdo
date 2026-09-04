// core/grid.js — hachage spatial pour les collisions (ARCHITECTURE.md § 6 et § 13).
// Les cellules sont des tableaux conservés d'une frame à l'autre (vidés par
// length = 0), donc aucune allocation après la première frame. Une entité qui
// chevauche plusieurs cellules n'est rapportée qu'une fois par requête grâce à un
// tampon (_gridStamp) posé sur l'entité.

export function createGrid(cellSize = 64) {
  const inv = 1 / cellSize;
  const cells = new Map(); // clé entière → tableau d'entités
  const used = [];         // cellules remplies depuis le dernier clear (à vider)
  let stamp = 1;           // identifiant de requête courante

  // Clé entière d'une cellule (coordonnées signées sur 16 bits chacune).
  function key(cx, cy) { return ((cx & 0xffff) << 16) | (cy & 0xffff); }

  function cell(cx, cy) {
    const k = key(cx, cy);
    let arr = cells.get(k);
    if (!arr) { arr = []; cells.set(k, arr); }
    if (arr.length === 0) used.push(arr);
    return arr;
  }

  // Parcourt les cellules couvrant le rectangle et appelle fn pour chaque entité une fois.
  function visit(x0, y0, x1, y1, fn) {
    stamp++;
    const cx0 = Math.floor(x0 * inv), cy0 = Math.floor(y0 * inv);
    const cx1 = Math.floor(x1 * inv), cy1 = Math.floor(y1 * inv);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const arr = cells.get(key(cx, cy));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const e = arr[i];
          if (e._gridStamp === stamp) continue;
          e._gridStamp = stamp;
          fn(e);
        }
      }
    }
  }

  return {
    cellSize,

    /** Vide la grille (à appeler à chaque tick avant de réinsérer). */
    clear() {
      for (let i = 0; i < used.length; i++) used[i].length = 0;
      used.length = 0;
    },

    /** Insère e (x, y, r) dans toutes les cellules que son disque couvre. */
    insert(e) {
      const r = e.r || 0;
      const cx0 = Math.floor((e.x - r) * inv), cy0 = Math.floor((e.y - r) * inv);
      const cx1 = Math.floor((e.x + r) * inv), cy1 = Math.floor((e.y + r) * inv);
      for (let cy = cy0; cy <= cy1; cy++)
        for (let cx = cx0; cx <= cx1; cx++) cell(cx, cy).push(e);
    },

    /** Candidats dans le disque (x, y, r) : fn(e), test précis à la charge de l'appelant. */
    query(x, y, r, fn) { visit(x - r, y - r, x + r, y + r, fn); },

    /** Candidats dans le rectangle (x, y, w, h). */
    queryRect(x, y, w, h, fn) { visit(x, y, x + w, y + h, fn); },

    /** Nombre de cellules occupées (diagnostic). */
    get occupied() { return used.length; },
  };
}
