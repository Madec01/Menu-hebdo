# Carnet de bord

À lire en premier au démarrage d'une session. Les consignes de travail sont
dans `CLAUDE.md`.

## Où en est le projet

- **v6.13**, branche `claude/architecte-logique-v5-vntfkp`, **203 tests verts**
  (`npm test`).
- `logicgates.html` : ~12 500 lignes, un seul `<script>`, aucune dépendance.
- Copies figées dans `versions/` (v5.1 → v6.13), avec leur tableau dans
  `versions/README.md`.
- Catalogue : **148 leçons en 30 chapitres** — 63 à table de vérité (dont 8
  boîtes noires) et 85 libres.

## Ce qui vient d'être fait

**⚡ Énergie & ondes, lot 1 sur 10 : le socle du continu** (v6.11). L'atelier
🔌 n'est plus grisé. Il contient quatre composants — `PILE`, `INTERP`
(interrupteur de puissance), `LAMPE` (ampoule à filament), `MASSE` — et un
**vrai solveur nodal** qui résout tout le circuit d'un coup.

Ce qu'on peut faire : la boucle pile → interrupteur → ampoule → masse → pile.
Deux ampoules en parallèle et la pile s'affaisse, visiblement. On ouvre la
boucle et tout s'éteint.

**⚡ Lot 2 : mesurer, régler, regarder** (v6.13). Sept composants :
`RESIS` (anneaux de couleur), `POTP` (potentiomètre à trois bornes, un vrai
diviseur), `VOLT`, `AMP`, `GENE` (alimentation réglable à la souris avec
limitation de courant), `OSCILLO` (deux sondes de tension + une entrée de
mesure, base de temps réelle), et le court-circuit signalé.

**v6.12 — les trois défauts trouvés par l'auteur en essayant le lot 1**, tous
corrigés : les câbles qui serpentaient (trois causes, dont un vieux bug
d'écartement cumulatif qui touchait TOUS les domaines), l'éclat des ampoules
qui se figeait au-delà de deux, et le circuit qui refusait de fonctionner sans
masse. Voir « Décisions » ci-dessous.

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
- **Un composant peut déclarer PLUSIEURS branches.** `branche(c)` rend soit un
  objet, soit un tableau. Le potentiomètre en a deux, de part et d'autre de son
  curseur — c'est ce qui en fait un vrai diviseur. Les branches au-delà de la
  première rangent leur résultat dans `c.brs[k]`, pas dans `c.u`/`c.i`.
- **La limitation de courant force à itérer.** Une source qui limite n'est pas
  linéaire : on résout, on regarde qui a franchi sa limite, on la remplace par
  une source de courant et on recommence (6 tours maximum). `br.mode` dit dans
  quel régime elle est, `c.limite` le publie pour l'affichage. Le relâchement
  se fait quand la tension demandée redescend sous la consigne.
- **`POT` était déjà pris** par le potentiomètre de mesure du Process
  (`defSensor('POT')`). Le nouveau s'appelle `POTP`. Vérifier les collisions
  d'identifiants avant d'écrire un `defComp` : l'écrasement est silencieux et
  fait tomber une dizaine de tests d'un coup, très loin de la cause.
- **La masse n'est PAS nécessaire.** Erreur du premier jet, corrigée en v6.12 :
  le solveur refusait de calculer sans masse, et une masse abandonnée dans un
  coin suffisait à réveiller le circuit. Désormais chaque circuit indépendant
  posé sur le plan choisit son propre zéro — la masse si elle en fait partie,
  sinon le `−` d'une de ses sources. La leçon « un circuit est une boucle »
  vient de la boucle ouverte, pas de l'absence d'un symbole.
  `elecOn` dit si le solveur a du travail (il sort immédiatement quand aucun
  composant de puissance n'est sur le plan — coût nul pour l'existant).
- **Toutes les bornes de puissance sont à la même hauteur** (`ENER_Y = 40`, via
  `enerPinPos`), quelle que soit la taille du boîtier : sans ça, deux
  composants côte à côte n'ont jamais leurs bornes en face et le fil décroche.
  Un composant qui pose ses bornes lui-même doit aussi les étiqueter lui-même
  (`enerLabels`) — le rendu générique ne le fait plus pour lui.
- **`spreadRoutes` repart de `_raw`, jamais de `_rp`.** Bug historique trouvé
  en v6.12 : l'écartement des couloirs relisait le tracé DÉJÀ écarté et
  s'ajoutait à chaque image. Les fils dérivaient selon l'historique
  d'affichage. C'était la cause principale des « câbles qui font n'importe
  quoi », toutes familles confondues.
- **L'éclat d'un filament suit la puissance^2,2**, pas la puissance. Sinon la
  baisse d'éclat quand on ajoute des ampoules en parallèle passe sous le seuil
  de perception. La couleur va du rouge-orangé au blanc chaud (`filColor`) :
  c'est le levier visuel le plus efficace, et il est physiquement juste.

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

## Défauts connus, à corriger plus tard

- **Dans un cadre de commentaire (la « zone »), on ne peut pas tirer de câble
  entre deux composants.** Signalé par l'auteur. Le cadre doit intercepter le
  geste de câblage — regarder le `pointerdown` du canvas et la façon dont
  `ZONE` capte le clic (`hit`, `noDrag`, ordre de dessin : les cadres passent
  derrière, mais le test de survol les voit peut-être en premier).

## Ce qui reste : ⚡ Énergie & ondes, lots 2 à 10

Découpage validé avec l'auteur. Un lot, on livre, il teste, il valide.

**Phase 1 — le continu.** Lot 3 : le chapitre 31 du cours (les leçons, les
tuiles, le tuteur, les « pourquoi »).
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
