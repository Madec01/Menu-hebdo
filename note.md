# Carnet de bord

À lire en premier au démarrage d'une session. Les consignes de travail sont
dans `CLAUDE.md`.

## Où en est le projet

- **v6.10**, branche `claude/architecte-logique-v5-vntfkp`, **186 tests verts**
  (`npm test`).
- `logicgates.html` : ~11 900 lignes, un seul `<script>`, aucune dépendance.
- Copies figées dans `versions/` (v5.1 → v6.10), avec leur tableau dans
  `versions/README.md`.

## Ce qui vient d'être fait

**La refonte de l'affichage est terminée** (trois lots, v6.8 → v6.10) :

- **v6.8** — la colonne de droite `#mission-panel` a disparu. À la place :
  `#enonce` (bandeau haut, repliable, avec le fil d'Ariane et le diagnostic en
  direct), `#infos` (table de vérité + compteurs, bas-droite, repliable),
  `#actions` (colonne de boutons, 236 px, haut-droite).
- **v6.9** — `#tutor-box` est devenu un **cartouche posé sur le plan** : il se
  place tout seul à côté des composants dont la page parle, relié par un trait
  dessiné sur le canvas, et se laisse déplacer à la main.
- **v6.10** — le sommaire est devenu **la carte du cours** : 30 tuiles de
  chapitre, anneau de progression, leçons en pastilles numérotées.

Avant ça (v6.7) : la leçon page par page avec halo sur le schéma, mémoire de la
dernière page consultée, bandeau de victoire qui enchaîne sur le « pourquoi ».

## Décisions qui expliquent le code

- **Une seule source d'étapes par leçon.** `buildSolution` (solveur, 52
  missions à table de vérité) ou `buildFreeSolution` (88 missions libres, à
  partir des `sol.steps` écrites). L'ancienne modale montrait `m.sol.steps`
  pendant que le tuteur montrait les étapes du solveur : les deux textes
  divergeaient. Il n'y a plus qu'une surface.
- **Le « pourquoi » est découpé à l'exécution.** `m.sol.why` est une seule
  chaîne sans séparateur dans le catalogue ; `whyPages()` la coupe par phrases,
  deux par page. Ne pas transformer les 148 `why` en tableaux : T40 en dépend.
- **Le cartouche ne recouvre jamais sa cible.** C'est une règle, pas un malus :
  `placeLecon()` garde à part le meilleur emplacement à recouvrement nul et ne
  se rabat sur « le moins pire » que s'il n'en existe aucun.
- **Le placement se calcule en pixels écran**, jamais en monde : la carte garde
  une taille fixe pour rester lisible à tous les zooms.

## Pièges du fichier (durement acquis)

1. **Le harnais de test ne voit pas un élément manquant.** `test/pre.js`
   fabrique n'importe quel `getElementById` à la demande. Supprimer un élément
   du HTML **sans** supprimer les `getElementById` correspondants donne 186
   tests verts et une **page blanche dans le navigateur**. Seul T62 (contrôle
   textuel) alerte. → **Toute modification d'affichage se vérifie dans
   Chromium**, jamais seulement par les tests.
2. Le stub renvoie **toujours** `[]` pour `querySelectorAll` et **des zéros**
   pour `getBoundingClientRect` ; `requestAnimationFrame` ne tourne pas, donc
   `render()` n'est jamais appelée en test. Un code testable est un code en
   **fonctions nommées** appelables directement.
3. **Les scripts de correction Python doivent enchaîner leurs remplacements**
   (vérifier l'ancre juste avant de l'appliquer), sinon un remplacement qui
   dépend du précédent échoue. Et vérifier `grep -c` = 1 sur chaque ancre.
4. `bw`/`bh` sont des **getters** qui tiennent compte de la rotation ; `w`/`h`
   sont les valeurs brutes. Pour tout rectangle, c'est `bw`/`bh`.
5. Trois ids sont **dupliqués** dans le HTML (`quick-head`, `quick-title`,
   `quick-hint`, dans `#find` et `#quick`). Bug latent, ne pas s'en inspirer.
6. Toujours `rm -rf node_modules package-lock.json` avant de committer
   (Playwright n'est installé que le temps des captures).

## Ce qui reste

Uniquement **⚡ Énergie & ondes**, détaillé dans la feuille de route de
`CLAUDE.md`. Le bouton existe déjà dans la barre du bas, grisé, marqué
« bientôt » (`MODES`, clé `phys`).
