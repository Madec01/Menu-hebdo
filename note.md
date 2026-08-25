# Carnet de bord

À lire en premier au démarrage d'une session. Les consignes de travail sont
dans `CLAUDE.md`.

## Où en est le projet

- **v6.11**, branche `claude/architecte-logique-v5-vntfkp`, **194 tests verts**
  (`npm test`).
- `logicgates.html` : ~12 500 lignes, un seul `<script>`, aucune dépendance.
- Copies figées dans `versions/` (v5.1 → v6.11), avec leur tableau dans
  `versions/README.md`.
- Catalogue : **148 leçons en 30 chapitres** — 63 à table de vérité (dont 8
  boîtes noires) et 85 libres.

## Ce qui vient d'être fait

**⚡ Énergie & ondes, lot 1 sur 10 : le socle du continu** (v6.11). L'atelier
🔌 n'est plus grisé. Il contient quatre composants — `PILE`, `INTERP`
(interrupteur de puissance), `LAMPE` (ampoule à filament), `MASSE` — et un
**vrai solveur nodal** qui résout tout le circuit d'un coup.

Ce qu'on peut faire : la boucle pile → interrupteur → ampoule → masse → pile.
Deux ampoules en parallèle et la pile s'affaisse, visiblement. On débranche le
retour à la masse et tout s'éteint.

Avant ça (v6.8 → v6.10) : la refonte de l'affichage en trois lots — bandeau
`#enonce`, `#infos` repliable, `#actions` ; cartouche de leçon posé sur le
plan ; sommaire devenu carte du cours.

## Décisions qui expliquent le code

- **Le solveur tourne AVANT les passes, une seule fois.** `solveElec()` est
  appelé en tête de `simulate()`, pas dans la boucle des 5 passes. Les
  composants de puissance ne calculent donc rien dans leur `eval()` : ils
  *déclarent* leur branche (`branche(c)` → `{a, b, r, e}`) et lisent ensuite
  `c.u`, `c.i`, `c.p` que le solveur a posés. Deux conséquences : le résultat
  ne dépend pas de l'ordre des composants, et les mesures qui en découlent
  n'ont aucun retard.
- **Toute source a une résistance interne** — sans exception. C'est ce qui
  permet de remplacer chaque générateur par un courant en parallèle d'une
  conductance : le système ne contient alors que des conductances, sans le
  moindre cas particulier. Une pile parfaite (`ri = 0`) casserait le calcul ;
  `ri` est borné à 0,05 Ω minimum.
- **Une borne de puissance accepte plusieurs fils.** La règle « une entrée,
  une seule arrivée » ne vaut plus pour le `kind === 'pui'` : c'est une borne
  à vis, tout ce qui s'y raccorde n'est qu'un seul point électrique. C'est ce
  qui rend le rail de masse utilisable.
- **Les bornes de puissance ne sont pas remises à zéro entre les passes**
  (ligne du `forEach` de `simulate`), sinon les tensions posées par le solveur
  seraient effacées avant d'être lues.
- **`simDt`, une horloge unique pour tout le circuit.** Créée mais pas encore
  utilisée : elle servira aux composants à mémoire (phase 3). Les composants
  existants gardent chacun leur `c.lastT` — ne pas les convertir sans raison.
- **Sans masse, rien ne se calcule.** C'est voulu : un circuit est une boucle.
  `elecMasse` dit si une masse est posée, `elecOn` si le solveur a du travail
  (il sort immédiatement quand aucun composant de puissance n'est sur le plan
  — coût nul pour tous les circuits existants).

## Pièges du fichier (durement acquis)

1. **Le harnais de test ne voit pas un élément manquant.** `test/pre.js`
   fabrique n'importe quel `getElementById` à la demande. Supprimer un élément
   du HTML **sans** supprimer les `getElementById` correspondants donne des
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
   Attention aux apostrophes typographiques `’` : le fichier en contient des
   vraies, pas des `’`.
4. `bw`/`bh` sont des **getters** qui tiennent compte de la rotation ; `w`/`h`
   sont les valeurs brutes. Pour tout rectangle, c'est `bw`/`bh`.
5. Trois ids sont **dupliqués** dans le HTML (`quick-head`, `quick-title`,
   `quick-hint`, dans `#find` et `#quick`). Bug latent, ne pas s'en inspirer.
6. Toujours `rm -rf node_modules package-lock.json` avant de committer
   (Playwright n'est installé que le temps des captures).
7. **Les nouvelles leçons s'ajoutent à la FIN du tableau `missions`.** T178,
   T179 et T48 supposent que la première leçon du cours est celle d'aujourd'hui.
8. Un composant ajouté au registre doit être **complet** (nom, nom court,
   famille, icône, couleur, w/h ≥ 40, entrée de guide de plus de 40 signes,
   présence dans un onglet) : T66 et T57 le vérifient tout seuls. Une nouvelle
   famille exige une entrée dans `FAM_SECTIONS`, sinon son guide n'est jamais
   rendu et T57 tombe.

## Ce qui reste : ⚡ Énergie & ondes, lots 2 à 10

Découpage validé avec l'auteur. Un lot, on livre, il teste, il valide.

**Phase 1 — le continu.** Lot 2 : résistance, potentiomètre, voltmètre,
ampèremètre, court-circuit signalé. Lot 3 : le chapitre 31 du cours.
→ le lot 3 devra ajouter **une vraie condition de réussite** : aujourd'hui une
leçon sans table de vérité est gagnée dès qu'on clique sur « Vérifier »
(`logicgates.html`, gestionnaire de `btn-verify`, la ligne `if (!m.tt.length)`).
Prévoir un champ `m.check(components, wires)`.

**Phase 2 — produire.** Lot 4 : aimant + bobine à la souris, dynamo à
manivelle. Lot 5 : turbine reliée au four et à la chaudière, panneau solaire,
thermocouple, chapitre.

**Phase 3 — l'alternatif.** Lot 6 : condensateur et bobine (c'est là que
`simDt` sert, avec des sous-pas de temps). Lot 7 : source alternative,
résonance, pont redresseur, chapitre.

**Phase 4 — l'éther.** Lot 8 : la distance et les obstacles. Lot 9 : accord
LC, AM et FM. Lot 10 : Morse, numérique, le son, chapitre final.
