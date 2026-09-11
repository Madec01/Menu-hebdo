// Seuils de création des spéciales (décision D6 : 4/6/8/10, mesurés par tools/seuils.mjs).
export const SEUILS = { bombe: 4, ligne: 6, croix: 8, couleur: 10 };
export const ORDRE_SPECIALES = ['couleur', 'croix', 'ligne', 'bombe']; // du plus fort au plus faible
export const NOMS_SPECIALES = { bombe: 'Bombe', ligne: 'Ligne', croix: 'Croix', couleur: 'Bombe de couleur' };
