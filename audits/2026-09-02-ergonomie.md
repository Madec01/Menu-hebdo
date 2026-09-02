# Audit ergonomie — agenda.html v1.0.0

Conditions de l'audit : Chromium 1194 en `file://`, données réalistes (58 items : titres de
40 à 90 caractères, 11 tâches semées sur le mercredi — 16 après report, 6 le jeudi, 3 le vendredi, samedi et dimanche
vides, 4 rendez-vous dont 2 qui se chevauchent, 3 tâches reportées 2 à 5 fois, parking de
20 lignes, 5 urgents). Mesures prises à 1366×768, 1440×900 et 1920×1080.
Captures dans `ergo/`. `WebFetch` est bloqué par la politique réseau de cet environnement :
les sources ont été rassemblées par recherche web, les URL sont vérifiables.

---

## 1. VERDICT

**Refondre la mise en page. Garder le moteur intact.**

1. Le moteur n'est pas en cause : report idempotent, section date confinée, sauvegarde en
   quatre couches, 57 contrôles verts. Aucun des 19 défauts relevés ci-dessous n'est un défaut
   de données ; ils sont tous dans le CSS et dans le découpage de l'écran.
2. La présentation est structurellement fausse : une colonne de jour offre **13 à 15 caractères
   par ligne** à 1366–1440 px, là où la lecture confortable en demande 45 à 75. Aucun réglage
   de taille, de hauteur ou de plage horaire ne rattrape ce chiffre. On a mis du texte long
   dans une grille conçue pour des heures.
3. Les trois reproches de l'utilisateur sont trois symptômes d'une seule cause. « Le bac est
   trop petit » = `max-height:190px` figé (l. 241). « Les affichages ne se font pas bien dans
   les cases » = les boîtes sont écrasées à 20 px pendant que leur texte en fait 120, et se
   chevauchent 15 fois sur 16. « Ça manque d'ergonomie » = 86 % de la surface du bac ne répond
   plus au clic dès que la journée est chargée.

Point aggravant : **la suite de 57 contrôles passe intégralement** (réexécutée pendant cet
audit, aucune erreur JavaScript) pendant que 15 tâches sur 16 sont illisibles à l'écran. La
suite vérifie des comportements, jamais une géométrie. Il faut lui ajouter trois assertions :
aucun `.item` dont le titre dépasse sa boîte, aucun champ de titre de moins de 60 px de large,
et une part minimale de la hauteur allouée aux bacs.

Repartir de zéro serait du gâchis : on jetterait 1 900 lignes de logique éprouvée pour un
problème de 400 lignes de CSS et de découpage. Se contenter de retouches serait insuffisant :
le nombre de caractères par ligne ne se corrige pas sans changer la géométrie de l'écran.

---

## 2. DÉFAUTS

### Bloquants

| # | Constat mesurable | Preuve | Effet quotidien | Correction | Coût |
|---|---|---|---|---|---|
| D1 | Dans le bac « À faire », **15 tâches sur 16 débordent de leur boîte et écrivent par-dessus la suivante**. Boîte mesurée : 20 px de haut. Titre à l'intérieur : 53 à 120 px. Débordement de 34 à 103 px. | `.daybin{display:flex;flex-direction:column}` (l. 239-241) + `.item` sans `flex-shrink` (l. 275-281) : l'algorithme flex écrase chaque boîte jusqu'à son `min-height:20px` pendant que le `textarea` garde sa hauteur calculée. Capture `02-bacs-afaire.png` : « Vérifier que la » avec « facture 2026-0871 » imprimé en fantôme derrière la tâche suivante. | On ne peut pas lire ses propres tâches. C'est exactement la régression décrite dans BUGS.md B-003, réintroduite par le conteneur flex. C'est ce qui fait abandonner l'outil en une semaine. | `.daybin .item{flex:0 0 auto}`. Une déclaration. Vérifié : chevauchements 15 → 0. | **S** |
| D2 | Un rendez-vous d'une journée qui en compte plusieurs est réduit à **94 px de large, dont 10 px pour le titre** : le texte s'affiche à raison d'un caractère par ligne. « Comité de pilotage trimestriel » devient `C / o / m / it`. | `.daycol` (l. 254-257) n'a pas de `grid-template-columns` : les `.slot` occupent la colonne 1 et les rendez-vous se placent automatiquement dans des colonnes implicites. Valeur calculée relevée : `grid-template-columns: 0px 98.2188px 98.2188px`. Capture `04-grille-horaire.png`. | Deux rendez-vous qui se chevauchent rendent les deux illisibles. Le chevauchement est le cas normal d'une journée de bureau, pas un cas limite. | `.daycol{grid-template-columns:minmax(0,1fr)}` + placement des chevauchements par groupes de collision (largeur égale à l'intérieur d'un groupe). Vérifié : titre 10 px → 106 px. | **M** |
| D3 | Quand le bandeau d'alerte s'affiche, **le bandeau urgent s'effondre de 106 px à 40 px et ses pastilles se dessinent par-dessus les en-têtes de jours**. Capture `07-bandeau-alerte.png` : « MER 2 » recouvert par « mer × jeu × », une pastille rouge tracée en travers des colonnes Jeu et Ven. | `.app{grid-template-rows:auto auto minmax(0,1fr) auto}` (l. 122-125) pour 6 enfants. Quand `.alertbar` cesse d'être `hidden`, tout se décale d'un rang : c'est `.urgentbar` qui hérite du `minmax(0,1fr)` et `.board` qui passe en `auto`. | Se déclenche dans trois situations réelles : stockage refusé (l. 808), horloge incohérente (l. 950), **deux onglets ouverts sur le même agenda** (l. 1716). Le troisième cas arrive à n'importe qui. L'écran devient illisible au moment précis où l'agenda essaie d'avertir. | Nommer les rangées : `grid-template-rows:auto auto auto minmax(0,1fr) auto auto` et poser `.alertbar` en rangée fixe, ou passer `.app` en `display:flex;flex-direction:column` avec `flex:1` sur `.board`. | **S** |
| D4 | **13 à 15 caractères par ligne** dans une colonne de jour (champ titre : 77 px à 1366 px, 87 px à 1440 px). Un titre de 70 caractères occupe 6 lignes et 145 px de haut. | Mesuré : colonne 187 px à 1366 px, 197 px à 1440 px ; le mobilier fixe (poignée 11 + case 13 + pastille 13 + croix 15 + espacements 20 + bordures et marges 38) consomme 110 px, il reste 77 px pour le texte. Capture `12-correctif-css-preuve.png` : une fois D1 corrigé, quatre tâches remplissent tout l'écran. | C'est la cause racine des trois plaintes. Même avec D1 et D2 corrigés, quatre tâches lisibles saturent la journée. Un semainier en sept colonnes ne peut pas afficher du texte de tâche. | Changer la géométrie : voir section 3. Aucun réglage ne suffit — même sans le week-end, on plafonne à 29 caractères par ligne. | **L** |

### Graves

| # | Constat mesurable | Preuve | Effet quotidien | Correction | Coût |
|---|---|---|---|---|---|
| D5 | Le bac « À faire » est **plafonné à 190 px sur tous les écrans**. À 1920×1080, il occupe 17,7 % de la hauteur pendant que la grille horaire en prend 48,4 % (523 px) pour quatre rendez-vous. Toute hauteur d'écran gagnée va intégralement à du vide. | `.daybin{min-height:46px;max-height:190px}` (l. 239-241). Relevés : 1366×768 → bacs 24,9 % / grille 23,2 % ; 1440×900 → 21,1 % / 34,4 % ; 1920×1080 → 17,7 % / 48,4 %. | C'est littéralement « la partie chose à faire est trop petite ». Acheter un plus grand écran agrandit le vide, pas le bac. | Supprimer le plafond fixe ; donner au bac une part *proportionnelle* de la zone centrale (section 3). | **M** |
| D6 | Sur une journée chargée, **14 % seulement de la surface du bac crée une tâche au clic**. Les 86 % restants sont couverts par des `.item` : on tombe dans le titre d'une tâche existante. | Balayage de la surface du bac du mercredi par `elementFromPoint` : 14 % des points renvoient l'élément `.daybin`. Le gestionnaire exige `cible.classList.contains("daybin")` (l. 1537). | Plus la journée est chargée, plus il est difficile d'y ajouter quelque chose. La friction de capture augmente exactement quand elle devrait diminuer. Aggravé par D1 : le texte débordant intercepte des clics destinés à la tâche du dessous. | Une ligne fantôme « + » permanente en bas du bac, et clic sur toute la zone du bac déléguée à la création. Le raccourci `N` existe déjà mais n'est pas visible à l'écran. | **S** |
| D7 | À 1366×768, la grille horaire n'affiche que **37 % de la journée** (178 px visibles pour 484 px de contenu, soit 08:00 → 11:30). Un rendez-vous à 15:00 est hors champ. | `nbCreneaux()` = 22 créneaux × 22 px = 484 px, contre `.board-scroll` mesuré à 178 px. Capture `11-1366x768.png`. | Sur le portable de bureau le plus répandu, il faut faire défiler pour voir l'après-midi, dans une grille vide à 90 %. IDEES.md écarte à juste titre l'affichage des 24 h ; le même raisonnement condamne l'affichage de 11 h fixes. | N'afficher que la plage réellement occupée (± 1 h), replier le reste. C'est exactement le principe du DayTicker de Fantastical. | **M** |
| D8 | **5 pastilles urgentes sur 7 sont tronquées** en plein mot : « …et le diffuser au », « …impérativemen », « …expiration de l'offre ». | `.uchip .utitle` est un `<input type="text">` (l. 1275-1279), pas un `textarea` : il ne peut pas revenir à la ligne. `.uchip{max-width:440px}` (l. 191-195). Mesures : 467 px de texte pour 357 px visibles. Capture `03-bandeau-urgent.png`. | B-003 n'a été corrigé que dans les tâches, pas dans le bandeau urgent — la leçon de B-004 (« un style écrit pour un contexte doit être vérifié dans tous les contextes ») s'applique mot pour mot. Ce qui est le plus important est ce qu'on lit le moins bien. | Même `textarea` auto-dimensionné que dans les bacs, et pastilles sur toute la largeur disponible. | **S** |
| D9 | Passer une tâche de « quand je peux » à « cette semaine » coûte **2 clics et traverse l'état « urgent »**. Entre les deux, la tâche **change de rang (6ᵉ → 9ᵉ)** et une autre tâche se retrouve sous le curseur. | `PRIO_ORDRE = ["urgent","semaine","libre"]` (l. 582) et cycle `(i+1)%3` (l. 1032-1035) ; `comparerItems` (l. 1072-1080) retrie après chaque changement. Vérifié : le deuxième clic au même endroit vise une autre tâche. | C'est le piège F-001 de BUGS.md, subi par l'utilisateur et pas seulement par le test. Le geste le plus courant de qualification est aussi le plus risqué : deux clics et on a promu la mauvaise tâche, après avoir polué le bandeau rouge au passage. | Ordre du cycle : libre → semaine → urgent (une promotion progressive, jamais de saut par l'urgence) ; et ne pas retrier tant que le curseur reste sur la pastille. | **S** |
| D10 | Le week-end occupe **395 px, soit 27 % de la largeur**, pour zéro contenu sur une semaine de bureau typique. | Deux colonnes de 197 px sur 1440 px. Capture `01-vue-generale.png` : Sam 5 et Dim 6 entièrement vides. | 27 % de la largeur retirés aux cinq jours qui, eux, manquent cruellement de place — et qui plafonnent à 13 caractères par ligne à cause de ça. | `afficherWeekend` existe déjà dans les réglages ; le basculer à `false` par défaut, avec un rappel discret « samedi/dimanche : 0 tâche » repliable. | **S** |
| D11 | Les tâches **faites restent dans le bac** et consomment la place rare. Lundi : 2 tâches barrées remplissent les 190 px. | `itemsDuJour()` ne filtre pas `done` ; `comparerItems` les renvoie seulement en fin de liste. Capture `02-bacs-afaire.png`, colonnes Lun et Mar. | Sur un bac plafonné à 190 px, une tâche terminée coûte aussi cher qu'une tâche à faire. La journée d'hier est un mur de texte barré. | Replier les tâches faites sous une ligne « 3 faites » dépliable. Aucune suppression : conforme à IDEES.md. | **S** |
| D12 | Le point de fin de journée présente **20 lignes et 100 boutons, dont 8 lignes visibles** (corps de 540 px pour 1 149 px de contenu), sous le titre « Trente secondes pour décider ». | Capture `08-sas-fin-journee.png`. Mesuré : 20 `.arbrow`, 5 actions par ligne, `panelbody{max-height:60vh}` (l. 375). | La promesse est fausse d'un facteur dix, et la fausse promesse est plus coûteuse que la lenteur elle-même : on ferme l'écran, donc tout est reporté, donc demain il y en a 22. La spirale est enclenchée. | Un raccourci clavier par action sur la ligne courante (Sunsama : `D` reporter, `Z` réserve) ; le bouton par défaut au clavier ne doit pas être « Fait ». Et surtout traiter la cause : 20 tâches ouvertes un soir signalent qu'il manque un plafond de charge. | **M** |
| D13 | L'écran de rattrapage dit « Prenez une minute pour envoyer au parking celles qui peuvent attendre » mais **n'offre aucune action par tâche ni par jour** : 0 bouton dans les 9 lignes, seulement « Tout au parking » / « Tout garder ». | `panneauTriage` (l. 2140-2172) : les lignes n'ont qu'un compteur, pas de `.acts`. Capture `10-rattrapage.png`. | L'écran demande un tri et ne fournit que du tout-ou-rien. On clique « Garder sur aujourd'hui » et on retombe sur la journée illisible que l'écran promettait d'éviter. | Ajouter « Au parking » sur chaque ligne de jour (déjà groupé par jour, le coût est faible). | **S** |

### Gênants

| # | Constat mesurable | Preuve | Effet quotidien | Correction | Coût |
|---|---|---|---|---|---|
| D14 | Toutes les cibles de clic d'une tâche sont **sous le minimum de 24×24 px** : pastille 13×13, case à cocher 13×13, poignée 11×12, croix 15×15, marqueur de report 12×14. | Mesures directes ; `.pdot` l. 307, `.chk` l. 296, `.grip` l. 290, `.del` l. 313. WCAG 2.2 critère 2.5.8 (AA) exige 24×24. | Cinq cibles minuscules, mitoyennes, dont l'une supprime et l'autre change la priorité. Sur un outil utilisé tous les jours, l'erreur est une question de temps. | Porter la zone cliquable à 24×24 par du `padding` transparent, sans grossir le dessin. | **S** |
| D15 | La poignée de glissement est **invisible au repos** (`opacity:0`) et n'apparaît qu'au survol. | `.item .grip{opacity:0}` (l. 290-294), `.item:hover .grip{opacity:.55}`. | Le glisser-déposer, fonction majeure annoncée dans le mode d'emploi, n'a aucun signifiant permanent. NN/g : masquer un contrôle divise sa découvrabilité par deux. | Poignée toujours visible à faible contraste ; renforcée au survol. | **S** |
| D16 | Le parking affiche **20 lignes dans un panneau de 135 px** ; 4 à 5 visibles à 1366 px. | `.bottom{height:var(--bottom-h,168px)}` (l. 334-338). Capture `11-1366x768.png`. | La « soupape » du système est un hublot. Ce qu'on y envoie disparaît de la vue, ce qui décourage de s'en servir. | Panneau redimensionnable déjà présent ; mémoriser la hauteur et afficher le compte non lu. | **S** |
| D17 | Chaîne visible sans accents : **« Doit etre fait avant dimanche »**, affichée en message flottant à chaque changement de priorité. | l. 579, `PRIO.semaine.desc`. Capture `07-bandeau-alerte.png`, message en bas. | Détail, mais visible plusieurs fois par jour sur un outil par ailleurs soigné. | `être`. | **S** |
| D18 | À l'ouverture du point de fin de journée, le focus clavier est posé sur **le bouton « ✓ Fait » de la première ligne** : une frappe d'Entrée coche une tâche non faite. | `ouvrirPanneau` (l. 1423-1430) focalise `input,textarea,button` — le premier bouton du corps. Capture `08` : anneau de focus sur « ✓ Fait ». | Action destructrice atteignable par inadvertance, sur un écran qui s'ouvre tout seul à 17h30. | Focaliser le bouton de pied de panneau (« Tout reporter à demain »), jamais une action par ligne. | **S** |
| D19 | Le champ date du point de fin de journée s'affiche **`mm/dd/yyyy`** dans le navigateur de test. | Capture `08-sas-fin-journee.png`. À nuancer : `<input type="date">` suit la locale de l'interface du navigateur, pas le `lang="fr"` de la page — sur un Chrome français l'affichage serait `jj/mm/aaaa`. | Nul si le navigateur est en français ; déroutant sinon. | Remplacer par trois boutons « demain / lundi / dans une semaine » couvrant 90 % des cas, le champ date en repli. | **S** |

---

## 3. RÉPARTITION DE L'ESPACE

### Ce que dit l'usage réel

IDEES.md pose que **~80 % de ce qu'on note n'a pas d'heure**. La semaine de test le confirme :
29 tâches sans heure contre 7 rendez-vous, soit 81 % / 19 %.

Répartition actuelle mesurée de la hauteur, à 1440×900 :

| Zone | Hauteur | Part | Contenu servi |
|---|---|---|---|
| Barre du haut | 56 px | 6,2 % | navigation |
| Bandeau urgent | 138 px | 15,3 % | 5 tâches, dont 5 tronquées |
| En-têtes de jours | 34 px | 3,8 % | — |
| **Bacs « À faire »** | **190 px** | **21,1 %** | **29 tâches (81 % du contenu)** |
| **Grille horaire** | **310 px** | **34,4 %** | **7 rendez-vous (19 % du contenu)** |
| Notes + parking | 168 px | 18,7 % | 20 lignes de parking, 4 visibles |

**81 % du contenu reçoit 21 % de l'écran ; 19 % du contenu en reçoit 34 %.** Et le rapport
empire avec la taille de l'écran, puisque le bac est plafonné en dur et la grille non : à
1920×1080 c'est 17,7 % contre 48,4 %.

### Cible chiffrée

Zone centrale (hors barre du haut et hors bas de page), à répartir ainsi :

- **tâches sans heure : 60 à 65 %**, en hauteur *proportionnelle* et non plafonnée ;
- **grille horaire : 30 à 35 %**, mais **repliée sur la plage réellement occupée** ;
- **urgent : 5 à 8 %**, deux lignes maximum, le reste replié derrière « + 3 autres ».

Justification : c'est le rapport 80/20 du contenu, corrigé du fait qu'un rendez-vous se lit
en un coup d'œil (une position verticale suffit) alors qu'une tâche doit être lue mot à mot.
C'est aussi le rapport qu'appliquent les outils cités en section 4 : Sunsama, Morgen et Akiflow
donnent la moitié ou plus de la surface à la colonne de tâches ; Outlook (volet « My Day ») et
Google Agenda placent les tâches sans heure **en haut de la journée, sur toute la largeur**,
jamais dans une case étroite.

### Disposition A — « Jour au centre, semaine en rail » (recommandée)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ › Semaine 36 · 31 août – 6 sept      [Aujourd'hui]   ● Sauvegardé  ⚙ ? │
├──────────────────────────────────────────────────────────────────────────┤
│ ★ URGENT  Envoyer la déclaration URSSAF avant vendredi 17h impérative…   │
│           Signer et retourner l'avenant au bail commercial      + 2 ⌄    │
├───────────────────────────────────────────────┬──────────────────────────┤
│ MERCREDI 2 SEPTEMBRE            20 ouvertes   │ LUN 31  ●●●○      2 / 4  │
│                                               │ MAR  1  ●●●●●     0 / 5  │
│ ┌───────────────────────────────────────────┐ │ ▸MER  2  ●●●●●●●● 4 / 20 │
│ │☐ Relancer le fournisseur Delmas sur le    │ │ JEU  3  ●●●●●●    0 / 7  │
│ │  devis de rénovation des bureaux du 2e    │ │ VEN  4  ●●●       0 / 4  │
│ │  étage                          ↩5  ● ⋮  │ │ SAM  5  —                │
│ ├───────────────────────────────────────────┤ │ DIM  6  —                │
│ │☐ Préparer la trame de l'entretien annuel  │ ├──────────────────────────┤
│ │  de Sophie et relire ses objectifs 2026   │ │ 09:00 ┃ Comité de        │
│ │                                  ●  ⋮    │ │       ┃ pilotage trim.   │
│ ├───────────────────────────────────────────┤ │ 09:30 ┃┃ Point Delmas    │
│ │☐ Répondre au mail de la mairie concernant │ │ 12:30 ┃ Déjeuner Marc    │
│ │  l'autorisation de voirie pour la livrais…│ │ 15:00 ┃ Entretien Sophie │
│ │                              ↩  ●  ⋮     │ │                          │
│ ├───────────────────────────────────────────┤ │  (seules les heures      │
│ │ + ajouter une tâche                       │ │   occupées sont          │
│ └───────────────────────────────────────────┘ │   affichées)             │
├───────────────────────────────────────────────┴──────────────────────────┤
│ NOTES DE LA SEMAINE              │ PARKING · PLUS TARD              20 ⌃ │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Ce qu'on gagne.** ~90 caractères par ligne au lieu de 13 : les titres tiennent en une ou
  deux lignes, D1/D2/D4 disparaissent par construction. Le bac respire (60 % de la zone
  centrale). La grille horaire ne montre plus que ce qui existe (D7). Le rail de droite donne
  la semaine d'un coup d'œil, avec la charge par jour, et sert de cible de glisser-déposer.
- **Ce qu'on perd.** La comparaison visuelle « à la même heure, quel jour est libre ».
  Un rendez-vous ne se pose plus en glissant dans une grille : il faut une saisie d'heure.
  Le glissé d'une tâche vers un autre jour passe par le rail, cible plus petite qu'une colonne.
- **Ce qu'il faut accepter.** C'est le modèle de Sunsama, Things et du volet « My Day »
  d'Outlook. C'est aussi un changement d'identité : ce n'est plus un semainier, c'est un
  planificateur de journée avec contexte hebdomadaire.

### Disposition B — « Semaine en lignes »

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ★ URGENT  ·  2 tâches                                            + 3 ⌄  │
├──┬───────────────────────────────────────────────────────────────────────┤
│L │ ✓ Relancer le fournisseur Delmas sur le devis de rénovation…    ●     │
│31│ ✓ Préparer la trame de l'entretien annuel de Sophie…            ●     │
│  │ 10:00 Réunion équipe support hebdomadaire                             │
├──┼───────────────────────────────────────────────────────────────────────┤
│M │ ☐ Répondre au mail de la mairie concernant l'autorisation…   ↩  ●     │
│ 2│ ☐ Relancer le fournisseur Delmas sur le devis de rénovation… ↩5 ●     │
│▸ │ ☐ Vérifier que la facture 2026-0871 a bien été réglée…          ●     │
│20│ 09:00–10:30 Comité de pilotage  ·  09:30 Point Delmas  ·  12:30 Déj.  │
│  │ + ajouter                                                             │
├──┼───────────────────────────────────────────────────────────────────────┤
│J │ ☐ Commander les fournitures : cartouches, ramettes A4…          ●     │
│ 3│ 10:00–12:00 Audit qualité Veritas — préparation documentaire          │
├──┼───────────────────────────────────────────────────────────────────────┤
│S5│ —                                                          (replié)   │
└──┴───────────────────────────────────────────────────────────────────────┘
```

- **Ce qu'on gagne.** ~190 caractères par ligne. La semaine reste entière et navigable sans
  changer de vue. Les jours vides se replient à une ligne (D10 réglé sans réglage). Chaque jour
  se dilate ou se contracte selon sa charge : la journée chargée prend la place qu'il lui faut.
- **Ce qu'on perd.** Il n'y a plus de grille horaire à proprement parler : les rendez-vous
  deviennent des lignes horodatées, ordonnées mais non proportionnelles. On perd la lecture
  « ce créneau est libre », qui est la vraie valeur d'une grille. Une semaine chargée ne tient
  plus dans un écran : il faut faire défiler.
- **À qui ça convient.** À quelqu'un dont l'agenda est fait de tâches avec quelques rendez-vous.
  D'après la semaine de test (81 % / 19 %), c'est le cas ici. Mais si le nombre de rendez-vous
  augmente, cette disposition vieillit mal.

### Disposition C — « Colonnes conservées, grille dégraissée » (le minimum viable)

Garder les sept colonnes, mais : bacs en hauteur proportionnelle et non plafonnée (60 % de la
zone centrale), grille horaire repliée sur la plage occupée, week-end masqué par défaut,
tâches faites repliées.

- **Ce qu'on gagne.** Coût faible, aucune rééducation de l'utilisateur, D1/D2/D3/D5/D7/D10/D11
  tous réglés. Cinq colonnes de 276 px au lieu de sept de 197.
- **Ce qu'on perd.** **D4 reste.** Champ titre à 166 px, soit **29 caractères par ligne** —
  toujours sous le plancher de lisibilité, toujours 3 lignes pour un titre de 70 caractères.
  On soigne les symptômes, on garde la maladie.
- **Verdict.** À faire tout de suite comme palier — les corrections sont de toute façon
  nécessaires — mais à ne pas présenter comme la solution.

### Recommandation

**A**, avec le rail de semaine à droite, et **B** conservée comme vue alternative si l'usage
montre que la comparaison entre jours compte plus que prévu. **C** est le palier à livrer
en premier parce qu'il ne coûte presque rien et qu'il arrête l'hémorragie.

---

## 4. CE QUE FONT LES MEILLEURS

| Source | Ce qu'on en retient de transposable ici | Ce qu'on laisse, et pourquoi |
|---|---|---|
| [Sunsama — Daily Planning](https://www.sunsama.com/daily-planning) et [manuel](https://help.sunsama.com/docs/usage-guides/daily-planning/) | La journée est une **liste large de tâches** posée à côté du calendrier, pas dedans. C'est la disposition A. Le rituel de planification quotidienne est le cœur du produit, pas un ajout. | La synchronisation multi-outils et le compte en ligne : hors périmètre par construction. |
| [Sunsama — rituel de fin de journée et seuil de charge](https://calmevo.com/how-to-use-sunsama/) | **Avertissement au-delà de 5–6 h de travail planifié**, et report au clavier : `D` reporter, `Z` envoyer en réserve. Directement transposable au point de fin de journée (D12), où 20 lignes × 5 boutons sont ingérables à la souris. Le `seuilCharge` existe déjà dans les réglages : il ne sert qu'à colorer un compteur, il devrait déclencher une vraie alerte. | Les estimations de durée par tâche : elles supposent qu'on chronomètre, ce que l'utilisateur n'a pas demandé. |
| [Sunsama — parti pris de conception](https://saskadhd.com/sunsama-review-a-therapist-s-take-on-the-daily-planner-that-actually-works-with-your-brain/) | « Pas d'animations, pas de gamification, pas d'IA qui décide » — et la friction délibérée du choix quotidien. **Confirme la section « Écartées » d'IDEES.md** : je ne demande pas de revenir sur le refus des statistiques et de la gamification. | Rien. |
| [Things 3 — Today / Upcoming](https://culturedcode.com/things/support/articles/4001304/) | Une date de début **n'est pas une durée** : le « Today » est une liste, pas une grille. C'est exactement la distinction bac / grille horaire déjà présente ici — elle est juste, il faut la traduire dans la géométrie de l'écran. | Le modèle Anytime / Someday : le parking joue déjà ce rôle. |
| [Fantastical — DayTicker](https://www.macstories.net/reviews/the-new-fantastical-review/) | Le ruban **n'affiche que les jours qui ont quelque chose**, avec des déchirures pour les jours vides. Transposable en deux endroits : replier les jours vides (D10) et replier les heures vides (D7), au lieu de dessiner 22 créneaux dont 20 vides. | Le ruban horizontal en tant que tel : sur un écran de bureau la place manque en hauteur, pas en largeur. |
| [Notion Calendar (ex-Cron) — modèle clavier](https://blakecrosley.com/guides/design/notion-calendar) | Le clavier d'abord : `C` créer, `T` aujourd'hui, `W` semaine, menu de commandes. Ici les raccourcis existent (`N`, `T`, `←`, `→`, `Alt+1/2/3`) mais **ne sont visibles nulle part à l'écran** — seulement dans l'aide. C'est le meilleur remède à D6 et D14 : le clavier n'a pas de problème de taille de cible. | Le style « Vim » poussé à l'extrême : l'utilisateur n'est pas développeur. |
| [Morgen / Akiflow — comparatif](https://efficient.app/compare/akiflow-vs-morgen) | Tous deux mettent les tâches **dans un panneau latéral large**, jamais dans les cases du calendrier, et le glissé va du panneau vers le créneau. Valide le sens du glisser-déposer de la disposition A. Akiflow est jugé meilleur précisément parce que son interface est moins dense. | L'agrégation multi-sources (Todoist, Asana, Slack) : sans réseau, sans objet. |
| [Google Agenda — tâches dans la vue jour](https://support.google.com/calendar/answer/9901136) | Les tâches sans heure apparaissent **en haut de la colonne du jour, avec une case à cocher**, séparées de la grille. La séparation est la bonne idée — déjà présente ici. Ce qui manque, c'est que Google ne plafonne pas cette zone à 190 px. | La colonne étroite : c'est précisément ce qui casse ici (D4), parce que Google affiche des titres courts et nous des phrases. |
| [Outlook — volet « My Day »](https://support.microsoft.com/en-us/outlook/calendar/use-my-day-with-to-do-in-outlook) | Volet latéral **permanent et large**, onglets « À faire » / « Calendrier », accessible depuis n'importe quel écran, avec « Ajouter une tâche » toujours visible. Le bouton d'ajout toujours présent est la réponse directe à D6. | Le fait que ce soit un volet rétractable : ici la journée est le sujet principal, pas un à-côté. |
| [WCAG 2.2 — critère 2.5.8 Target Size (AA)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [guide d'implémentation](https://www.allaccessible.org/blog/wcag-258-target-size-minimum-implementation-guide) | Minimum **24×24 px CSS**, ou 24 px d'écart entre cibles voisines. Ici : 11 à 15 px, cinq cibles mitoyennes, dont une supprime. Taux d'erreur jusqu'à 75 % supérieur sur les petites cibles pour les utilisateurs à motricité réduite — et la motricité se dégrade avec l'âge, sur un outil prévu pour durer dix ans. | Rien. C'est un plancher, pas une opinion. |
| [NN/g — la navigation masquée réduit la découvrabilité de moitié](https://www.nngroup.com/articles/hamburger-menus/) | Étude sur 179 participants : masquer un contrôle divise sa découvrabilité par deux, allonge le temps de tâche et augmente la difficulté perçue. S'applique mot pour mot à la poignée de glissement à `opacity:0` (D15) et à la croix de suppression, elles aussi masquées. | La conclusion sur les menus hamburger : sans objet ici. |
| [SAP Fiori — Wrapping and Truncation](https://www.sap.com/design-system/fiori-design-web/v1-136/foundations/interaction/wrapping-and-truncation) | Le retour à la ligne est **le comportement par défaut** ; la troncature est l'exception, réservée au texte statique. Un titre de tâche est de l'information critique : il doit revenir à la ligne. Condamne directement le `<input type=text>` du bandeau urgent (D8). | Rien. |
| [Carbon Design System — Overflow content](https://carbondesignsystem.com/patterns/overflow-content/) | Si l'on tronque, il faut **toujours un moyen de voir le texte entier en une seule interaction**. Ici les pastilles urgentes tronquées n'offrent ni info-bulle ni dépliage. | Rien. |
| [Todoist — Time Blocking](https://www.todoist.com/productivity-methods/time-blocking) | Le blocage de temps ne concerne qu'une fraction de la journée ; la liste sans heure reste le réceptacle principal. Chiffre cohérent avec les 81 % / 19 % mesurés ici. | Le blocage systématique de chaque minute : contraire à l'esprit de l'outil. |
| [GTD — revue hebdomadaire](https://www.asianefficiency.com/productivity/gtd-weekly-review/) et [1 à 3 tâches prioritaires par jour](https://noisydeadlines.net/gtd-journey-daily-plans-shutdown-routines-and-weekly-reviews) | La revue dure **20 à 30 minutes** avec de l'entraînement, et on retient **1 à 3 tâches prioritaires** par jour. Le point du lundi promet « deux minutes » et le point du soir « trente secondes » : les deux promesses sont fausses d'un ordre de grandeur (D12). Mieux vaut annoncer juste que rassurer à faux. | La méthode complète GTD (contextes, projets, listes) : trop lourde pour cet outil. |
| [Super Productivity — Calendar blocking vs to-do lists](https://super-productivity.com/blog/calendar-blocking-vs-to-do-lists/) | Le bon hybride tire une sélection du stock vers la journée et **montre immédiatement si l'on est sur-engagé**. Le compteur de charge existe déjà ici (« 20 » sur le mercredi) mais il est décoratif : il ne déclenche rien et il n'est pas cohérent avec ce qu'on voit (20 annoncées, 6 lisibles). | L'intégration d'un minuteur : hors sujet. |
| [Algorithmes de disposition des événements qui se chevauchent](https://github.com/thejsj/calendar-exercise) | Les événements qui se chevauchent doivent être regroupés en **groupes de collision**, la largeur étant répartie à l'intérieur d'un groupe seulement — pas sur la journée entière. C'est le correctif propre de D2 : aujourd'hui, deux rendez-vous qui se croisent rétrécissent tout ce qui les entoure. | Les implémentations à haute performance : quelques dizaines d'éléments par jour, la question ne se pose pas. |

---

## 5. PLAN

Ordonné par bénéfice ressenti ÷ risque. Aucune de ces actions ne touche au préfixe
`agendaHebdo:`, ni à la section [02], ni à l'idempotence du report, ni n'introduit de
suppression automatique ou de fenêtre modale de création.

### Vague 1 — cosmétique pure, aucun changement de données (une demi-journée)

Rapport bénéfice/risque maximal : ce sont six déclarations CSS et deux corrections de balise.
Vérifié en conditions réelles : chevauchements 15 → 0, largeur du titre d'un rendez-vous
10 px → 106 px.

| Ordre | Action | Défauts réglés | Risque |
|---|---|---|---|
| 1 | `.daybin .item{flex:0 0 auto}` | D1 | nul |
| 2 | `.daycol{grid-template-columns:minmax(0,1fr)}` + `.item.slotitem{grid-column:1}` | D2 (largeur ; le chevauchement propre vient en vague 2) | nul |
| 3 | Rangées de `.app` nommées, ou `.app` en flex colonne | D3 | nul |
| 4 | Zones cliquables portées à 24×24 par `padding` transparent ; poignée visible au repos | D14, D15 | nul |
| 5 | `.uchip .utitle` en `textarea` auto-dimensionné, comme dans les bacs | D8 | nul |
| 6 | Cycle des priorités : libre → semaine → urgent | D9 (moitié) | nul |
| 7 | « Doit **être** fait avant dimanche » ; focus par défaut sur le bouton de pied de panneau | D17, D18 | nul |

### Vague 2 — géométrie de l'écran, toujours aucun changement de données (deux à trois jours)

| Ordre | Action | Défauts réglés | Risque |
|---|---|---|---|
| 8 | Supprimer `max-height:190px` ; répartir la zone centrale en 60 % bacs / 35 % grille, avec la poignée de redimensionnement existante | D5 | faible — vérifier l'impression paysage sur une page |
| 9 | Grille horaire repliée sur la plage occupée ± 1 h | D7 | faible |
| 10 | `afficherWeekend:false` par défaut, avec ligne repliable | D10 | faible — réglage déjà existant |
| 11 | Tâches faites repliées sous « n faites » (repliées, jamais supprimées) | D11 | faible |
| 12 | Ligne « + ajouter » permanente en bas de chaque bac ; clic dans le bac délégué à la création | D6 | faible |
| 13 | Groupes de collision pour les rendez-vous qui se chevauchent | D2 (complet) | moyen — c'est du vrai algorithme, à couvrir par un test |
| 14 | Ne pas retrier tant que le curseur reste sur la pastille | D9 (complet) | faible |
| 15 | Actions par ligne dans l'écran de rattrapage | D13 | faible |
| 16 | Raccourcis clavier par ligne dans le point de fin de journée ; corriger les promesses de durée | D12 | faible |

**Après la vague 2, il faut réévaluer avec l'utilisateur.** Si les tâches redeviennent lisibles
et que le bac respire, il se peut que la plainte disparaisse et que la vague 3 soit inutile.
Ce serait le meilleur résultat possible.

### Vague 3 — nouvelle disposition, une semaine

| Ordre | Action | Défauts réglés | Risque |
|---|---|---|---|
| 17 | Disposition A : jour au centre en pleine largeur, rail de semaine à droite, grille horaire compacte | D4 | **élevé** — change l'identité de l'outil ; à livrer comme *seconde vue* commutable avant de devenir la vue par défaut |
| 18 | Bandeau urgent : deux lignes maximum, reste replié derrière « + n autres » | reliquat de D3/D8 | faible |
| 19 | Seuil de charge rendu actif : au-delà du seuil, message à la planification et non seulement une pastille orange | D12 (cause) | faible |

### Ce qui change le modèle de données — à ne pas mélanger aux vagues ci-dessus

Aucune des 19 actions ci-dessus ne touche au schéma. Les trois idées suivantes le feraient et
doivent être décidées séparément, après la vague 2 :

- **Champ durée estimée** (pour un vrai seuil de charge en heures, comme Sunsama) : ajout d'un
  champ, migration de schéma, `SCHEMA_VERSION` à incrémenter.
- **Horizon glissant sur 10 jours** (déjà retenu dans IDEES.md) : ne change pas le schéma mais
  change `joursAffiches()` et la notion de « semaine affichée » — à traiter après la refonte de
  la disposition, pas avant, sous peine de refaire le travail deux fois.
- **Repli des tâches faites** : si l'on veut le persister par jour plutôt que le recalculer,
  c'est un champ d'état d'affichage. Recommandation : le recalculer, ne rien stocker.

### Ce que je ne recommande pas, malgré la latitude donnée

Les cinq choix documentés dans la section « Écartées » d'IDEES.md tiennent après cet audit, et
la littérature les conforte plutôt qu'elle ne les infirme :

- **Pas de statistiques ni de gamification.** Sunsama, l'outil le plus abouti de la catégorie,
  fait explicitement le même choix. Aucun argument neuf.
- **Pas de suppression automatique.** Rien dans les mesures ne la justifie ; le problème est
  que les tâches sont illisibles, pas qu'elles sont trop nombreuses en base.
- **Pas de fenêtre modale pour créer une tâche.** Le parcours de saisie mesuré est excellent :
  **1 clic et 330 frappes pour 5 tâches de 65 caractères**, sans jamais quitter le clavier.
  C'est le seul parcours de l'outil qui n'a aucun défaut. Il ne faut y toucher sous aucun
  prétexte — c'est le socle sur lequel la refonte doit se poser.
- **Pas de confirmation « êtes-vous sûr ? »**, l'annulation existe. En revanche D18 (focus par
  défaut sur une action destructrice) doit être corrigé : c'est le même souci traité au bon
  endroit.
- **Pas d'affichage des 24 heures.** Et par cohérence, pas d'affichage de 11 heures fixes non
  plus : d'où D7.
