// core/pool.js — pool d'objets réutilisables (ARCHITECTURE.md § 1.7 et § 6).
// Les objets actifs sont gardés dans un tableau dense ; release() fait un
// « swap-remove » en O(1). forEach parcourt à l'envers : on peut donc
// relâcher l'objet courant pendant l'itération sans rien sauter.

/**
 * @param {() => object} factory  crée un objet neuf
 * @param {(obj: object) => void} reset  remet un objet à zéro avant réutilisation
 * @param {number} initialSize  objets pré-alloués
 */
export function createPool(factory, reset, initialSize = 0) {
  const free = [];     // objets disponibles
  const active = [];   // objets en service (dense)

  for (let i = 0; i < initialSize; i++) free.push(factory());

  const pool = {
    /** Nombre d'objets actifs (lecture). */
    get active() { return active.length; },
    /** Taille totale allouée (actifs + libres). */
    get size() { return active.length + free.length; },
    /** Tableau dense des actifs (lecture seule : ne pas le modifier). */
    items: active,

    /** Sort un objet du pool (le crée si nécessaire), le réinitialise et l'active. */
    acquire() {
      const obj = free.length ? free.pop() : factory();
      reset(obj);
      obj._poolIndex = active.length;
      obj.active = true;
      active.push(obj);
      return obj;
    },

    /** Rend un objet au pool. Ignoré s'il n'est pas actif. */
    release(obj) {
      const i = obj._poolIndex;
      if (i === undefined || i < 0 || active[i] !== obj) return;
      const last = active.pop();
      if (last !== obj) { active[i] = last; last._poolIndex = i; }
      obj._poolIndex = -1;
      obj.active = false;
      free.push(obj);
    },

    /** Appelle fn(obj, index) sur chaque actif, à l'envers (release sûr). */
    forEach(fn) {
      for (let i = active.length - 1; i >= 0; i--) fn(active[i], i);
    },

    /** Relâche tout. */
    clearAll() {
      for (let i = active.length - 1; i >= 0; i--) {
        const obj = active[i];
        obj._poolIndex = -1;
        obj.active = false;
        free.push(obj);
      }
      active.length = 0;
    },
  };
  return pool;
}
