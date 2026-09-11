// Générateur déterministe (mulberry32), même convention que terra-nova.
// L'état tient dans un entier 32 bits : il se sérialise avec le run.
export function creerRng(seed) {
  let a = seed >>> 0;
  const rng = {
    suivant() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    entier(n) { return Math.floor(rng.suivant() * n); },
    choix(tableau) { return tableau[rng.entier(tableau.length)]; },
    melanger(tableau) {
      for (let i = tableau.length - 1; i > 0; i--) {
        const j = rng.entier(i + 1);
        const t = tableau[i]; tableau[i] = tableau[j]; tableau[j] = t;
      }
      return tableau;
    },
    get etat() { return a >>> 0; },
    set etat(v) { a = v >>> 0; },
  };
  return rng;
}

/** Transforme une chaîne ou un nombre en seed 32 bits. */
export function seedDepuis(valeur) {
  if (typeof valeur === 'number' && Number.isFinite(valeur)) return valeur >>> 0;
  const s = String(valeur ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
