// Petits utilitaires partagés par les modules d'UI.

// Formate un nombre à la française : espace comme séparateur de milliers.
// Ex : formatNombre(1250) → "1 250".
export function formatNombre(n) {
  const entier = Math.round(Number(n) || 0);
  return entier.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
