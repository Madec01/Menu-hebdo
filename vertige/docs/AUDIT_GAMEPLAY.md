# Audit gameplay — fin de phase 1 (VERTIGE)

Méthode : lecture CLAUDE.md (§1,3-7), CONTRATS.md (§2,4), `src/data/*.js`, `tour.js`, `speciales.js`, `progression.js`, `rendu.js`/`juice.js`, puis `tools/sim.mjs` (200 runs, bot glouton et aléatoire, avec compétences) et une sonde dédiée à la fréquence de rotation.

## 1. En dessous des références (priorisé)
- **Tap trop lent vs Dream Blast** : l'input est bloqué (`occupe=true`) jusqu'à la fin de `rendu.jouer()`, qui attend séquentiellement destruction (90 ms) + chute (350 ms) + remplissage (350 ms) = jusqu'à ~800-1000 ms par tap simple. Fusionner chute+remplissage en une seule attente animée, cible <450 ms par tap sans spéciale.
- **Rotation sans télégraphe, contraire au pilier 1** : `previsualiserRotation()` (rendu.js) est un no-op, la variable n'est jamais relue. Afficher un vrai aperçu (flèches/fantômes) avant validation.
- **Salle 2 « Le Puits » plus dure que le boss** : bot glouton gagne 87 % Vestibule, seulement 47 % Puits, puis 62 % Pendule (boss) — pic hors-courbe juste après le tutoriel, échec à 92/173 par manque de coups. Passer coups 22→26 ou cible couleur 24→20.
- **Boucle Propagation verte + Avidité hors contrôle** : 18 % de victoires sans compétence → 93 % avec ces deux seules compétences (XP moyenne en Puits ×10, 2051→19909). Aucune marge d'échec, contrairement à Balatro/Slay the Spire où même les synergies fortes laissent un risque. Plafonner Avidité (+1 coup, max 3/salle) ou couper la re-propagation en chaîne.
- **Spéciales hautes trop rares** : sur 200 runs, bombe 76 %, ligne 16 %, croix 3,5 %, couleur 4,2 % des spéciales créées — la taille de groupe moyenne (4,26) est loin du seuil croix (8). Resserrer croix 8→7.
- **XP sans exutoire immédiat** : niveau plafonné à 7 (2400 XP) mais Tempête/Pendule génèrent déjà 2865-5257 XP en moyenne (baseline) — tout le surplus est gelé jusqu'à la fin du run, contrairement à Vampire Survivors où chaque XP compte tout de suite.
- **Rotation anarchique sous-exploitée** : seules 2 salles sur 5 (Tempête, Pendule) utilisent l'orientation par gravité (fusées, ballons) — le concept central n'irrigue pas assez l'acte.

## 2. Au-dessus des références
- Gravité mobile sur grille fixe + toutes les spéciales orientées par la gravité courante (ligne, croix, fusée, ballon) : un effet mécanique de la rotation qu'aucune des références (Dream Blast, Toon Blast, Candy Crush) n'a.
- Bus de hooks central, aucune compétence codée en dur : base saine pour la richesse de builds Balatro-like, déjà prouvée par le fait qu'une combo à 2 compétences suffit à casser l'équilibre — signe que le système « compose » bien.
- Simulateur headless déterministe (`tools/sim.mjs`) dès la phase 1 : équilibrage piloté par la donnée, rare à ce stade, et c'est lui qui a permis cet audit.
- Cascades automatiques volontairement absentes + chaînage des spéciales adjacentes : identité « tap-blast, pas match-3 » bien tenue, sans le chaos incontrôlable d'un Candy Crush.
- Mots de combo (Joli/Super/Énorme/VERTIGE) calés sur les mêmes seuils que les spéciales (4/6/8/10) : juice et mécanique disent la même chose, plus rigoureux que Candy Crush.

## 3. Rotation
Pas encore une vraie décision. Le bot glouton (200 runs) tourne 1 fois pour 25 taps, et seulement en dernier recours quand aucun groupe ≥3 n'existe — jamais pour repositionner une spéciale ou déclencher un ballon. La jauge (3, +1 par groupe ≥6) n'est jamais le facteur limitant : à 0 sur seulement 7,6 % des tours, jauge moyenne de 2,16/3 au moment de tourner. Pour que ça tourne plus et mieux : jaugeMax par défaut 3→2 ; un vrai télégraphe visuel (voir §1) pour transformer le choix en calcul plutôt qu'en pari ; une incitation positive (XP ×1,2 sur le tap qui suit une rotation) plutôt qu'un coût sec ; et des salles normales à l'acte 1 qui exploitent l'orientation dès le début (fusées/ballons dans Vestibule ou Puits), pas seulement en fin de séquence.

## 4. Équilibrage
- Puits trop dur pour sa position (47 % vs 87 % Vestibule, 62 % boss) ; Marée haute triviale une fois atteinte (100 %, cible pierres 8 franchie sans effort) — durcir Marée (cible 8→12) en compensation.
- Compétence dominante : Propagation verte seule déjà 52 % (vs 18 % base), 93 % avec Avidité — à nerfer en priorité.
- Compétences proches du bruit : Vertige 23 %, Domino 24 %, Fossoyeur 21 %, Prévoyance 23 %, Coup de trop 25 % (base 18 %) — cohérent avec la rareté de la rotation et le fait que pierres/coups ne sont presque jamais le facteur limitant en jeu normal.
- Seuil_abaisse solo 33 %, ×2 40 % (rendement décroissant, sain) ; Cascade 31 %, Double amorce 33 % : ces quatre sont dans une fourchette raisonnable, à garder comme référence de calibrage.
- Seuils 4/6/8/10 : bombe/ligne bien calés sur la distribution de tailles observée, croix/couleur trop hauts hors synergie (voir §1).

## 5. Les 5 corrections à faire en premier
1. Nerfer Avidité + Propagation verte (plafond ou coupure de chaîne) — **petit**.
2. Brancher un vrai télégraphe de rotation (aperçu visuel avant validation) — **moyen**.
3. Fusionner chute + remplissage en une seule attente animée pour réduire la latence d'input — **moyen**.
4. Rééquilibrer Puits (coups 22→26) et Marée haute (cible 8→12) — **petit**.
5. Resserrer jaugeMax à 2 et ajouter une incitation positive à la rotation — **moyen/gros** (implique un hook XP dédié).
