# Architecte Logique

Jeu d'apprentissage de la logique numérique : portes, mémoire, bus, puces
réutilisables et 106 missions guidées, du simple fil jusqu'au processeur 1 bit.

`logicgates.html` est un **fichier HTML autonome** : aucune dépendance, aucun
serveur, aucun réseau. Ouvre-le dans un navigateur, c'est tout.
Canvas 2D pour le rendu, Web Audio pour le son, `localStorage` pour la
progression, les puces, les sauvegardes et le bac à sable.

## Tests

```sh
npm test              # ou : node test/run.js [chemin/du/fichier.html]
```

Le harnais est *headless* : `test/run.js` extrait le `<script>` du HTML, le
concatène entre `test/pre.js` (stubs DOM / Canvas / Audio / localStorage, plus
une horloge `Date.now` pilotable) et `test/post.js` (les tests), puis exécute le
tout dans un contexte `vm`. Aucun navigateur, aucune dépendance npm.

51 tests couvrent le moteur (portes, câblage, coûts), le séquentiel (bascule D,
retard n cycles, compteur 4 bits, sonde, horloge paramétrée), les blocs v5
(ROM, soustracteur, comparateur, démultiplexeur, bus), l'édition (sérialisation,
copier-coller, annuler/refaire, alignement, puces, sauvegardes, exemples),
l'analyseur d'équations, les 106 missions (structure, chargement, solutions,
vérification, boîtes noires) et la couverture du guide.

## Sauvegarde locale

| Clé `localStorage` | Contenu |
| --- | --- |
| `al2_progress` | missions réussies et meilleurs scores (v3) |
| `al2_chips` | puces créées par le joueur |
| `al2_saves` | montages nommés |
| `al2_sandbox` | bac à sable courant (auto-sauvegardé) |
| `al2_mute`, `al2_snap` | préférences son et magnétisme |
