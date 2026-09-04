// core/rng.js — générateur déterministe mulberry32 (ARCHITECTURE.md § 6).
// Toute génération de jeu (vagues, cartes, sol) passe par un rng seedé pour être rejouable.

/** Mélange un entier 32 bits (hash de Wang / mulberry) : sert aux seeds dérivées. */
export function mix32(a) {
  a = (a ^ 61) ^ (a >>> 16);
  a = Math.imul(a, 9);
  a = a ^ (a >>> 4);
  a = Math.imul(a, 0x27d4eb2d);
  a = a ^ (a >>> 15);
  return a >>> 0;
}

/** Hash déterministe de trois entiers (seed, x, y) → uint32. Sans allocation. */
export function hash3(seed, x, y) {
  let h = (seed ^ Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77)) >>> 0;
  return mix32(h);
}

/** Même chose normalisé dans [0,1). */
export function hash3f(seed, x, y) {
  return hash3(seed, x, y) / 4294967296;
}

/** Crée un rng mulberry32. `seed` est réduit en uint32. */
export function makeRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  const rng = {
    seed: state,
    /** Flottant dans [0,1). */
    next() {
      state = (state + 0x6d2b79f5) | 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Flottant dans [a,b). */
    range(a, b) { return a + (b - a) * rng.next(); },
    /** Entier dans [a,b] inclus. */
    int(a, b) { return a + Math.floor(rng.next() * (b - a + 1)); },
    /** Élément aléatoire d'un tableau (undefined si vide). */
    pick(arr) { return arr.length ? arr[Math.floor(rng.next() * arr.length)] : undefined; },
    /** Vrai avec probabilité p. */
    chance(p) { return rng.next() < p; },
    /** Nouveau rng dérivé (indépendant) : utile pour un sous-système. */
    fork() { return makeRng(mix32((rng.next() * 4294967296) >>> 0)); },
  };
  return rng;
}

/** Texte de seed manuelle → uint32 (FNV-1a). Un nombre décimal est pris tel quel. */
export function hashSeed(text) {
  const s = String(text == null ? '' : text).trim();
  if (/^\d{1,10}$/.test(s)) return Number(s) >>> 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return mix32(h >>> 0);
}
