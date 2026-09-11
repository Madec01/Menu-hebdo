// Palette « Cartoon pop » (docs/CONTRATS.md §2). L'index est la couleur logique dans le moteur.
export const COULEURS = [
  { id: 0, nom: 'rouge',  hex: '#ff3b5c', contour: '#8a1030' },
  { id: 1, nom: 'vert',   hex: '#3ad24f', contour: '#12702a' },
  { id: 2, nom: 'bleu',   hex: '#2f8cff', contour: '#123f9a' },
  { id: 3, nom: 'jaune',  hex: '#ffcc1f', contour: '#9a6a00' },
  { id: 4, nom: 'violet', hex: '#b04cff', contour: '#4f1a8a' },
  { id: 5, nom: 'cyan',   hex: '#22d3ee', contour: '#0b6a7a' },
];
export const ENCRE = '#1d1b3a';
export const CIEL_HAUT = '#38b6ff';
export const CIEL_BAS = '#8fe1ff';
export const CHAMP_HAUT = '#3a2f8f';
export const CHAMP_BAS = '#2b2270';
export const CADRE = '#ffb347';
export const CADRE_CLAIR = '#ffd27a';
export const CADRE_FONCE = '#e0801a';
export const PANNEAU = '#fff8e7';
export const VERT_ACTION = '#5ad341';
export const ORANGE = '#ff9f1c';
export const ROSE = '#ff5fa2';
// Compatibilité avec le rendu Atelier en cours de remplacement :
export const PAPIER = CIEL_BAS, BOIS_CLAIR = CADRE, BOIS_FONCE = CADRE_FONCE, KRAFT = PANNEAU, ACCENT = ORANGE;
