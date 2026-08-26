# Carnet de bord

À lire en premier au démarrage d'une session. Les consignes de travail sont
dans `CLAUDE.md`.

## Où en est le projet

- **v6.30 — l'appli s'appelle maintenant NodeFlow.**
  Branche `claude/architecte-logique-v5-vntfkp`, **255 tests verts**
  (`npm test`).
- `logicgates.html` : ~14 400 lignes, un seul `<script>`, aucune dépendance.
- Copies figées dans `versions/` (v5.1 → v6.30), avec leur tableau dans
  `versions/README.md`.
- Catalogue : **188 leçons en 36 chapitres** — 63 à table de vérité (dont 8
  boîtes noires), 85 libres, et 30 à **condition de réussite** (chapitres 31 à 34).

## Ce qui vient d'être fait

### v6.30 — NodeFlow, et le lot 1 de la refonte de l'overlay

**Le nom.** L'appli s'appelle NodeFlow. Changé : le titre de l'onglet, l'en-tête,
le nom du fichier d'export PNG, le message d'import, le README.
**Les clés `localStorage` restent en `al2_*`** — les toucher effacerait les
sauvegardes et les réglages de l'auteur.

**Le logo.** Il est dans le fichier, **en dur, en vectoriel** : les lettres sont
des tracés SVG, pas du texte. Aucune police à télécharger, identique sur toutes
les machines, net à toutes les tailles, ~2,8 Ko.
Les tracés ont été extraits de Poppins ExtraBold avec `fontTools` ; le script
qui les a produits est jetable, le résultat est figé dans le HTML.
Trois couches, chacune avec sa classe pour régler l'opacité séparément :
`.mq-lettres` (.12), `.mq-anneau` (.58), `.mq-cable` (.68), `.mq-point` (.76).
Le logo est **accroché au haut de l'écran** (`#marque`, `position:fixed`), donc
il ne bouge ni au zoom ni au déplacement. Dessous, `#marque-sous` dit où on est :
le chapitre et la leçon, ou « simulateur de circuits & missions ».
**En bac à sable, le cartouche d'énoncé s'efface** (il ne disait rien) : le plan
de travail est nu, avec le logo pour seul repère.

**Lot 1 — le panneau des composants.**
- Il est ancré **en bas à gauche** et prend **toute la largeur**
  (`left:12px; right:12px`). Essai raté au passage : je l'avais fait épouser
  son contenu pour supprimer le vide à droite — l'auteur l'a lu comme un bug
  (« il ne prend que la moitié de l'écran »). Il veut la pleine largeur, et une
  ligne incomplète simplement centrée. **Ne pas y revenir.**
- **Replié, il devient un seul bouton de 48 px** dans le coin, avec un
  pictogramme de puce au trait. C'est la « grille nue ».
- Les ateliers sont devenus de **vrais onglets collés au corps** du panneau :
  même fond, pas de trait entre eux, liseré de la couleur de l'atelier.
  Inactifs, ils portent déjà leur teinte.
- **Un quatrième onglet ★ Rapide**, en tête. Attention : `favOnglet` est un
  drapeau à part, **`appMode` ne change pas** quand on y va — sinon tout le
  moteur (formes de bornes, filtrage des leçons) aurait suivi. Deux catégories :
  « Mes épingles » et « Les plus posés ». L'ancienne rangée de favoris a disparu.
- Les **tuiles gardent une taille fixe** (92×86, symbole 40 px, nom en 10 px),
  passent à la ligne, et une ligne incomplète est **centrée**. Elles étaient à
  62×60 avec un nom en 8 px : illisible, l'auteur l'a signalé. La rangée est
  plafonnée à trois lignes (`max-height:272px`), au-delà elle défile.
- **Les symboles suivent.** Les composants sans dessin à eux affichaient un
  caractère posé par `glyphIcon()` en corps 13 dans une boîte de 32×24 : perdu
  au milieu d'une tuile agrandie. La taille dépend maintenant du nombre de
  caractères (22 / 19 / 15 / 12) et le centrage vertical passe par
  `dominant-baseline` au lieu d'une ligne de base posée à la main.
  Cinq composants ont reçu un **vrai dessin** au lieu d'un caractère, parce
  qu'aucune taille de police ne les aurait sauvés : le rail (`▤`), le cadre et
  l'écran (`▭`, `🖵`), le tunnel (`⇢`) et le convoyeur. Ils sont dans `ICO`,
  préfixés `__`, et référencés par `icon:ICO.__NOM` dans leur `defComp`.
  **Piège** : `TUNP` avait déjà sa clé `icon` ; ajouter la mienne a créé un
  doublon silencieux (la seconde gagne). Vérifier qu'un `defComp` n'a qu'une
  seule clé `icon` avant d'en poser une.
- L'ouverture s'anime (`@keyframes panneauOuvre`, 0,19 s). **On n'anime que
  `transform` et `opacity`** : la grille se redessine 60 fois par seconde
  derrière, animer une largeur la ferait saccader. `prefers-reduced-motion`
  coupe tout.

## Décisions qui expliquent le code

- **Une diode s'ouvre sur la TENSION et se ferme sur le COURANT.** Fermer sur
  la tension aussi faisait osciller les quatre diodes d'un pont entre deux
  états au passage par zéro : le calcul s'arrêtait au bout de ses douze tours
  sur un état incohérent, et la sortie plongeait à −0,6 V.
- **`poseDiode` écrit `br.g` et `br.e` DANS la branche**, pas seulement dans
  la matrice. Première version : la matrice était juste, mais le bloc qui
  publie les résultats relisait la résistance d'origine et annonçait −12 A à
  contresens. Toute non-linéarité doit poser ses valeurs pour de bon.
- **Le `−` d'un pont redresseur est une ENTRÉE.** Déclaré en sortie, le
  montage était incâblable : on ne branche pas une sortie sur une sortie, et
  le courant doit bien revenir quelque part.

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
- **Deux variables de temps, et pas une.** `simNow` (l'horloge du circuit)
  n'est **PAS** plafonnée : les temporisations comparent des échéances, et un
  plafond leur ferait rater un saut dans le temps — c'est ce qui a permis aux
  48 tests qui pilotent `Date.now` de passer sans être touchés. `simDt` reste
  plafonné à 200 ms : il sert à intégrer, un pas énorme ferait diverger.
  Restent en temps réel, à raison : dates de sauvegarde, annulation, appui
  long, dé du composant ALÉA, cadence du panneau d'aide, export PNG.
- **Le modèle compagnon met la mémoire dans le moule existant.** Sur UN pas de
  temps, un condensateur se comporte comme une résistance en série avec une
  pile (`r = dt/C`, `e = −u_précédent`) ; une bobine pareil (`r = rs + L/dt`,
  `e = (L/dt)·i_précédent`). Le solveur ignore donc jusqu'à leur existence.
  Méthode d'Euler implicite : elle ne s'emballe jamais, même à pas grossier —
  une méthode plus fine ferait osciller l'affichage au moindre réglage.
- **Une branche peut réclamer un pas de temps.** `br.dtMax` : le générateur
  alternatif demande 1/(40·hz), soit quarante points par période. `br.dyn`
  dit que sa tension change à chaque sous-pas, et le crochet `pas(c, dt)` la
  recalcule. `avant(c)` ne fait plus qu'exposer la valeur de l'instant — c'est
  `pas` qui fait avancer la phase, sinon les 32 sous-pas verraient tous la
  même tension et l'onde redeviendrait un escalier.
- **`elecSous`** vaut 0 quand aucune mémoire n'est sur le plan : c'est la
  garantie que l'existant est inchangé, et c'est aussi ce qui empêche
  l'oscilloscope de compter deux fois ses points.
- **Trois causes de plus au « les câbles font n'importe quoi »**, corrigées en
  v6.14 :
  1. `recalcFan` ne classait les fils que par borne de DÉPART. Deux fils qui
     rejoignent le même côté d'un composant (les deux entrées d'un voltmètre)
     prenaient la même colonne d'approche et la même hauteur de contournement.
     Il y a maintenant un `fanIn`, rang d'ARRIVÉE, qui allonge l'amorce
     d'arrivée et écarte la ligne de contournement. Ne jamais l'appliquer dans
     le cas `enFace`, sinon un montage droit se remet à décrocher (T192b).
  2. `spreadRoutes` regroupait par CASE FIXE de 11 px : deux fils distants de
     3 px pouvaient tomber de part et d'autre d'une frontière et n'être jamais
     écartés. C'est maintenant un regroupement par voisinage. `WIRE_ECART` est
     passé de 7 à 11 px — il faut dépasser le halo de 8 px d'un câble de
     puissance.
  3. `bypassY` ne regardait que les DEUX boîtiers reliés : un composant posé
     entre les deux était invisible et le fil lui passait dessous. Elle survole
     maintenant tout ce qui se trouve sur le passage. Conséquence : le cache
     des tracés dépend de la position des autres composants — d'où `compSig()`,
     une signature grossière du plan recalculée une fois par image.
- **Le clic simple sélectionne ET actionne.** Ne jamais supprimer l'appel à
  `clickComp` dans le `pointerup` : c'est lui qui bascule les interrupteurs, et
  T56 le vérifie. Maj ou Ctrl + clic ne fait QUE (dé)sélectionner, sans
  actionner. Maj + glisser passe par `dupliquerPourGlisser`.
- **Un montage de référence doit être JOUABLE, pas seulement bien câblé.** T207
  place la démo de chaque leçon ⚡, puis **joue le montage** (promène les
  aimants dans les bobines, tourne les manivelles, laisse le temps passer) et
  exige que la condition de réussite soit remplie. C'est ce test qui a révélé
  que `spawnGroup` REFUSE de coller un interrupteur dans une leçon (les entrées
  sont fournies par l'énoncé) : un montage de référence ne peut donc pas en
  contenir. D'où la chauffe à la main de la chaudière.
- **La turbine a un régulateur**, comme les vraies : sous charge elle ouvre la
  vapeur pour tenir sa vitesse. Tant que la chaudière suit, la vitesse ne bouge
  presque pas — c'est la consommation qui monte. Quand la chaudière ne suit
  plus, tout s'écroule d'un coup. C'est la leçon m163.
- **Les sources qui dépendent du temps préparent leur tension dans `avant(c)`**,
  appelé une fois par image en tête de `solveElec` — pas dans `branche`, qui
  doit rester pure (elle est rejouée à chaque tour de la limitation de courant).
  C'est là que sert `simDt`.
- **`manipHit` / `manipMove` / `manipEnd`** : une pièce qui se MANŒUVRE à la
  souris (la manivelle) au lieu de se régler. Le boîtier se déplace toujours
  par ses bords. `libre:true` sur un composant le dispense de la grille et des
  guides d'alignement — indispensable pour l'aimant, dont le geste EST la
  physique.
- **La main TIENT la manivelle tant que le bouton est enfoncé.** Trois pièges
  successivement rencontrés, tous les trois corrigés : (1) un ressort sans
  amortisseur fait osciller le volant jusqu'à se faire doubler d'un tour ;
  (2) la souris n'envoie pas un événement par image, donc la vitesse de la main
  doit être LISSÉE, sinon l'amortisseur freine une image sur deux ; (3) l'effort
  affiché doit être l'énergie réellement absorbée (électricité + frottements),
  pas « couple de la main × vitesse », sinon les à-coups du poignet le font
  osciller et les deux jauges ne se ressemblent plus.
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

*(Les règles de travail — vérifier dans Chromium, ancrer les scripts,
nettoyer avant de committer — sont dans `CLAUDE.md`. Ici, les faits sur le
fichier lui-même.)*

1. Le stub de test renvoie **toujours** `[]` pour `querySelectorAll` et **des
   zéros** pour `getBoundingClientRect` ; `requestAnimationFrame` ne tourne
   pas, donc `render()` n'est jamais appelée en test. Un code testable est un
   code en **fonctions nommées** appelables directement.
2. Attention aux **apostrophes typographiques** `’` dans les ancres de
   recherche : le fichier en contient des vraies, pas des `'`.
3. `bw`/`bh` sont des **getters** qui tiennent compte de la rotation ; `w`/`h`
   sont les valeurs brutes. Pour tout rectangle, c'est `bw`/`bh`.
4. Trois ids sont **dupliqués** dans le HTML (`quick-head`, `quick-title`,
   `quick-hint`, dans `#find` et `#quick`). Bug latent, ne pas s'en inspirer.
5. **Les nouvelles leçons s'ajoutent à la FIN du tableau `missions`.** T178,
   T179 et T48 supposent que la première leçon du cours est celle d'aujourd'hui.
6. Un composant ajouté au registre doit être **complet** (nom, nom court,
   famille, icône, couleur, w/h ≥ 40, entrée de guide de plus de 40 signes,
   présence dans un onglet) : T66 et T57 le vérifient tout seuls. Une nouvelle
   famille exige une entrée dans `FAM_SECTIONS`, sinon son guide n'est jamais
   rendu et T57 tombe.

## Défauts connus, à corriger plus tard

- **Il reste 10 câbles qui traversent un boîtier** (sur 722) et 339 avec un
  demi-tour, dont la plupart sont légitimes (une cible derrière soi impose un
  contournement). Les cas restants viennent des approches VERTICALES (broches
  en haut ou en bas d'un boîtier), que `barreH`/`barreV` ne couvrent pas
  encore. Script de mesure : `mesure.js` dans le bac à sable de la session —
  à réécrire si besoin, il compare deux versions du fichier.
- **`spreadRoutes` écarte dès que deux câbles se frôlent en un point.** Un
  écartement qui ne tiendrait compte que des recouvrements sur la LONGUEUR
  serait moins bavard. Non fait, c'était le troisième point du lot câbles.
- **Le routage A\* proposé pour le bouton « Ranger les câbles »** : bonne idée,
  mais il faudrait une carte d'occupation (router séquentiellement en
  pénalisant les cases déjà prises), sinon tous les fils prennent le même
  chemin optimal et se superposent. `bypassY` ne doit PAS être touché : elle
  sert au tracé vivant, pas au bouton.

- **Dans un cadre de commentaire (la « zone »), on ne peut pas tirer de câble
  entre deux composants.** Signalé par l'auteur. Le cadre doit intercepter le
  geste de câblage — regarder le `pointerdown` du canvas et la façon dont
  `ZONE` capte le clic (`hit`, `noDrag`, ordre de dessin : les cadres passent
  derrière, mais le test de survol les voit peut-être en premier).

- **Le cartouche du tuteur recouvre le schéma sur sa dernière page.** Vu en
  v6.16 sur la leçon m152 : à la page du « pourquoi », plus aucune cible n'est
  désignée, et `placeLecon()` n'a donc plus rien à éviter — il se pose au
  milieu, sur les composants. Pas bloquant (on le déplace à la main). Piste :
  à défaut de cible, éviter l'encombrement de TOUS les composants.

## L'AUDIT DU MOTEUR — vérifié, chiffré, et en grande partie à NE PAS suivre

Deux visions techniques (ChatGPT, Gemini) ont été recoupées et **vérifiées ligne
par ligne, avec des mesures**. Le résultat principal : l'essentiel de ce qu'elles
proposent résout des problèmes que cette application n'a pas.

**Les chiffres de référence, à ressortir avant tout chantier de performance :**
- les 129 montages livrés font en moyenne **5,3 composants / 6,1 fils** (le plus
  gros : 12 / 15) ;
- profondeur logique des 58 solutions : médiane **3 étages**, maximum 8 ;
- le moteur ENTIER coûte **0,285 ms sur les 16,7 ms d'une image** (1,7 %) à
  30 composants / 40 fils, et 0,73 ms sur un pire cas de 200 composants ;
- **la plus grosse matrice électrique de tout le catalogue fait 3 × 3.**

### Ce qui est vraiment cassé (mesuré, par gravité)

1. **`liveCheck` fait sauter des images.** Toutes les 700 ms, `liveTick`
   (`:13753`) rejoue toute la table de vérité **même si rien n'a changé** :
   mesuré **20,2 ms** sur 29 composants / 49 fils, contre 0,06 ms pour une
   image temps réel. C'est de loin la dépense la plus lourde du fichier — plus
   que tous les autres points d'optimisation réunis. Correction : un compteur
   `logicVersion` invalidé sur connexion / suppression / ajout / réglage / **et
   basculement d'interrupteur** (sinon le retour en direct décroche du joueur).
2. **L'anneau d'inverseurs bat à la fréquence de l'ÉCRAN.** Mesuré avec
   `simulate(5)` : 3, 5 et 9 inverseurs donnent tous `10101010…`, une bascule
   par image. Or un anneau de 9 portes est trois fois plus lent qu'un anneau de
   3. C'est la seule fausseté du moteur logique qui se voie.
3. **Une entrée oubliée est indiscernable d'un zéro** (`:4925`,
   `pin.state = 0`). Le piège le plus coûteux en temps pour un élève.
4. **Le sens du courant dessiné sur les fils de puissance est arbitraire**
   (`:1782`, `this.inPin.comp.i`). Pire depuis `relierBornes` (v6.23) : « inPin »
   n'est plus que le bout cliqué en second. Faux dès qu'il y a une dérivation.
   → Correction saine : animation symétrique dont seule la VITESSE dépend de
   l'intensité. Ne PAS tenter les courants de branche : le solveur raisonne par
   nœuds, il ne les connaît pas.
5. ~~**Un mur faisait dévier les câbles**~~ — **CORRIGÉ v6.27** (`DECOR`).
6. **Aucune accessibilité clavier ni lecteur d'écran** — 0 `aria-label`,
   0 `tabindex`, 0 `role`. Chantier à part.
7. **Zones de clic minuscules au zoom reculé** : broche 13 unités MONDE
   (`:1285`) = 4,6 px à zoom 0,35 ; fil 9 (`:1997`) ; poignée au double-clic 10
   (`:5222`). Et `ALIGN_SEUIL = 7` en monde (`:16462`), sans hystérésis, sans
   `Alt` (0 occurrence dans le fichier).

### Trois défauts qu'AUCUNE des deux visions n'avait vus

- **`compSig` ignore la taille** (`:1449` — seulement `x`, `y`, `id`) :
  redimensionner un cadre ou un mur ne réveille pas le cache des tracés.
- **Une bascule RS en portes est jugée « combinatoire »** : `boardCombinatoire()`
  (`:13697`) teste une LISTE DE TYPES (`SEQ_MARKERS`), pas la présence d'un
  cycle. Vérifié : deux NOR rebouclés → `true`. La vérification en continu la
  traite donc comme une table de vérité figée.
- **`elecTrop` échoue en silence** (`:4746`) : au-delà de 160 nœuds plus rien
  n'est résolu et aucun message n'est affiché.
- Bonus : **un tunnel coûte une passe entière de retard** (`:10068`,
  `c.val = TUN_PREV[n]`).

### Ce qui est VRAI mais sans aucune conséquence à cette échelle

À ne pas entreprendre, et à ressortir si la question revient :
tri topologique + Tarjan à la place des 5 passes (33 ms de stabilisation sur le
circuit le PLUS profond du catalogue — invisible) · index amont/aval pour la
vitesse (0,05 ms/image) · `spreadRoutes` (0,089 ms, et **le cache de tracé existe
déjà**, `:1561`) · `compSig` (**0,0008 ms**) · hachage spatial pour le survol
(0,144 ms) · séparation compilation/résolution du solveur (noyée dans 0,06 ms) ·
solveur creux ou Gauss-Seidel (**matrices 3 × 3**) · pré-calcul des ondes ·
couches Canvas multiples (gain non démontré — mesurer le DESSIN dans Chromium
d'abord, c'est le seul poste non chiffré).

### Ce qui est faux ou déjà fait dans les deux visions

- « le retour de mission dit où, pas pourquoi » → **déjà fait** (`:13746`,
  `:13678`) ;
- « ajouter un mode suivre le signal » → **à moitié fait** (`focusSet` +
  `neighbourhood(comp, 3)`, `:16090`) ;
- « `openQuick` s'ouvre à tort » → **déjà protégé** par `moved` (`:5155`) ;
- « 3 px au zoom mini » → 4,6 px, le zoom s'arrête à 0,35 (`:1197`) ;
- Gemini : « une seule passe hors éléments séquentiels » → **casserait**
  l'anneau d'inverseurs et la bascule RS en portes. ChatGPT avait vu le piège.

### Le plan retenu, en trois lots (à faire APRÈS le lot 10)

**Lot A — ce qui se voit tout de suite : FAIT, v6.29.**
**Lot B — dire la vérité sur les signaux** (effort gros, risque moyen) : index
amont/aval (comme OUTIL, pas comme optimisation) · `pin.status`
`valid/floating/conflict` (exceptions : broches masquées de rail, bornes de
puissance, entrées optionnelles) · conflits de tunnels · sens du courant ·
détection de cycle réelle dans `boardCombinatoire` (passer les 63 leçons à
table de vérité au crible d'abord) · cône causal · « suivre le signal » au clic
droit.
**Lot C — le temps du circuit** (effort moyen, risque ÉLEVÉ sur un point) :
pause sur `visibilitychange` (**ne PAS plafonner `simNow`** : décision
documentée, et `post.js:5257` l'exige) · transport ⏸ ⏭ ▶ · **délai de porte
simulé** — une passe par tranche de temps de circuit plutôt que 5 par image,
pour que l'anneau de 5 batte plus lentement que celui de 3. Ce dernier point
touche TOUT (bascules, GRAFCET, procédés, tunnels, 246 tests) : à livrer seul,
avec T207 comme garde-fou.

## Chantiers demandés, hors feuille de route

- **Refonte complète de l'overlay, APRÈS la phase 4.** Demandé explicitement.
  L'overlay, c'est tout ce qui flotte au-dessus du plan : l'en-tête et ses
  treize boutons, le bandeau `#enonce`, la colonne `#actions`, le bloc
  `#infos`, le cartouche de leçon, le bandeau de victoire, la barre du bas.
  Ça s'est empilé lot après lot sans jamais être repensé d'un bloc.
  **Avant de coder, demander à l'auteur ce qui le gêne précisément** — la même
  erreur que pour la barre du bas serait de refondre à l'aveugle.

- **VISION D'ENSEMBLE POUR LA REFONTE DE L'OVERLAY** (donnée par l'auteur,
  à garder telle quelle jusqu'à la refonte). Direction : une interface de
  logiciel métier moderne — très peu de commandes toujours visibles, les
  fonctions avancées au bon endroit et au bon moment, le plan de travail
  clairement principal.

  **En-tête épuré** : `⚡ ARCHITECTE LOGIQUE · Chap.12 · XOR   ↶ ↷ 🔍 💾 ⋯`.
  Tout le reste passe dans le menu `⋯`, rangé en cinq sections : AFFICHAGE
  (grille, noms, mini-plan, focus, recentrer) · SIMULATION (lecture, pause,
  un pas, vitesse) · CIRCUIT (analyser, organiser, ranger les câbles) ·
  FICHIER (montages, exemples, PNG, importer) · AIDE (guide, raccourcis,
  tutoriel).

  **Ctrl+K, centre de commande** : composants, leçons, commandes, montages,
  exemples, outils, aide — une seule entrée qui évite d'ajouter un bouton à
  chaque nouveauté.

  **Barre du bas à deux niveaux maximum** : un sélecteur d'atelier compact
  (`⚡ Électronique ▾`) puis les catégories, avec « ★ Rapide » en page
  d'accueil (favoris épinglés + derniers utilisés + les plus fréquents).

  **Panneau de mission compact** : titre, une phrase, l'objectif, `[Vérifier]`.
  Le reste (table de vérité, contraintes, indice, solution) se déplie.

  **Écran de performance après réussite** : étoiles, portes utilisées contre
  optimal, objectifs secondaires, `[Comparer avec l'idéal]`.

  **Comparaison avec la solution sur le plan** : solution en fantômes, vert =
  équivalent, ambre = inutile, cyan = manquant, plus un panneau qui explique.

  **Diagnostic cliquable** : entrée inutilisée, branche isolée, simplification
  possible — un clic centre la caméra et surligne.

  **Le reste** : isoler le chemin d'un signal, mode focus plein écran,
  alignement et espacement façon Figma, `🪄 Organiser le circuit` (auto-layout
  entrées → logique → mémoire → sorties), inspecteur latéral à sections
  repliables, clic droit court et contextuel, mini-plan seulement quand utile,
  panneau de transport de simulation (⏮ ⏸ ⏭ ×1), chronogramme optionnel,
  vraie UX mobile (feuille du bas, appui long, pincement), historique de
  versions dans « Mes montages », onboarding interactif, astuces contextuelles.

  Quatre vagues proposées : 1) dépolluer · 2) fluidifier · 3) renforcer le
  pédagogique · 4) fonctions avancées.

  **CE QUI EXISTE DÉJÀ — vérifié dans le code, à ne pas redévelopper :**
  mini-plan (`drawMini`, `miniClick`), guides d'alignement (`alignGuides`),
  mise en évidence du voisinage au survol (`focusSet`, dès 10 composants),
  favoris + fréquence d'usage (`favPins`, `favFreq`), recherche dans tout le
  catalogue (barre du bas), analyseur (`#analyze-modal`), « Ranger les câbles »
  (`btn-route` → `autoRoute`, aussi au clic droit), système d'étoiles au nombre
  de portes (`m.par` + `progress.best`), ralenti ×1/×10/×100, export PNG,
  montages, exemples, guide, menu contextuel (`#ctxmenu`), et la solution
  posée en direct sur le schéma.
  **N'existe pas** : Ctrl+K, le menu `⋯`, pause / un pas, l'auto-layout des
  composants, l'écran de performance, le diagnostic cliquable, l'inspecteur
  latéral, l'historique de versions, l'onboarding, le chronogramme global.

  **MON AVIS FRANC, à relire avant de coder :**
  1. **L'en-tête est le bon premier chantier** : 11 boutons + logo + pastille,
     c'est exactement ce que les deux audits ont mesuré comme débordant. Passer
     à cinq commandes règle l'encombrement ET la surcharge d'un seul geste.
  2. **Attention à `⋯`** : cinq sections × cinq entrées = vingt-cinq lignes
     dans un menu déroulant, c'est-à-dire le même problème déplacé. Le critère
     de ce qui reste visible doit être la FRÉQUENCE d'usage, pas le rangement :
     dans cette appli, « ralenti » et « ranger les câbles » servent en
     permanence, autant qu'annuler/refaire.
  3. **Ctrl+K est un geste d'expert** — l'auteur ne code pas, et ses lecteurs
     encore moins. Excellent comme accélérateur, dangereux comme rangement :
     règle à tenir, **rien ne doit exister UNIQUEMENT dans Ctrl+K**.
  4. **L'écran de performance : garder ce qui se mesure.** Portes utilisées
     contre optimal (objectif, déjà là) et « aucun câble croisé » (mesurable,
     le compteur de traversées existe depuis le lot câbles). En revanche
     « lisibilité : bonne » est un jugement esthétique de la machine : difficile
     à rendre juste, et une note fausse enseigne le contraire de ce qu'on veut.
  5. **`🪄 Organiser le circuit` est le morceau le plus lourd de la liste**
     (placement en couches + réduction des croisements). Il vaut le coup, mais
     c'est un lot à lui seul, pas une ligne de la vague 2.
  6. **Le chronogramme fait double emploi** avec l'OSCILLOSCOPE, qui trace déjà
     les signaux. À garder en dernier, ou à abandonner.
  7. **Réponse de l'auteur : NON, pas de téléphone** — « pas tout de suite, on
     verra plus tard ». La vraie UX mobile sort donc de la vague 4.
     Il a aussi confirmé : « on fera une refonte quoi qu'il arrive des menus,
     je n'aime pas ».
  8. **L'historique de versions est bon marché** (`localStorage` est déjà là) et
     rassure beaucoup : je le remonterais en vague 1.
  9. **Le croquis de barre du bas sous-estime le catalogue réel** : 97
     composants, 20 onglets, dont 7 pour l'atelier Électronique, 8 pour Process
     et 6 pour ⚡. « Deux niveaux maximum » reste juste, mais il faudra vérifier
     que neuf catégories tiennent vraiment sur une ligne.

- **Refondre la barre du bas.** L'auteur la trouve « peu ergonomique à
  l'usage », même après la refonte de la v6.6. À reprendre en entier, pas à
  rafistoler.
  Ce qu'elle contient aujourd'hui : trois boutons d'atelier + recherche +
  repli (`buildToolbar`), une rangée d'onglets (`modeTabs` / `TOOL_TABS`), une
  barre de favoris qui se compose seule (`favPins` / `favFreq`), et les tuiles
  de composants avec cadenas de progression (`toolState` / `updateToolbar`).
  Le catalogue compte maintenant ~90 composants pour 3 ateliers et 16 onglets —
  c'est probablement là que le bât blesse.
  **Piège vérifié en v6.18** : `.tool-row` a `overflow-x:auto` mais
  `scrollbar-width:none`. Une rangée trop longue défile donc en silence, sans
  autre indice qu'un dégradé discret au bord (`.more-right`). Un composant au-delà
  du bord devient introuvable. T149 refuse maintenant plus de 10 tuiles par
  onglet — mais l'affordance de défilement reste à revoir dans la refonte.
  **Avant de coder, demander à l'auteur ce qui le gêne précisément** : trop de
  clics pour changer d'onglet ? les favoris qui bougent tout seuls ? la
  recherche qu'on oublie ? la barre qui mange l'écran ? Une refonte à l'aveugle
  coûterait cher pour rien.

## LA REFONTE DE L'OVERLAY — cahier des charges VALIDÉ avec l'auteur

Maquette cliquable : **`maquettes/la-grille-nue.html`** (fichier autonome, six états).
Rien n'est encore codé dans l'appli. Tout ce qui suit est validé point par point.

### La règle qui commande tout
**« Je veux que la grille soit le plus épurée possible. »** Tout ce qui n'est pas le
circuit se range, se replie, ou part dans le menu.

### L'écran
- **En haut : plus de barre du tout.** Un bouton **Menu** seul en haut à gauche, la boîte
  à **Outils** en haut à droite.
- **Le titre passe sur la grille**, en filigrane, opacité faible, stylisé, **accroché au
  haut de l'écran** (il ne bouge pas au zoom ni au déplacement).
  Bac à sable → « ARCHITECTE LOGIQUE ». Leçon → chapitre + titre de la leçon.
- **La progression « 0/188 » disparaît de l'écran.** Elle ne vit plus que dans l'écran de
  choix des leçons. (Donc `#progress-pill` et `updateProgressPill` sortent de l'en-tête.)

### Le panneau des objets (bas gauche)
- Au repos : **un seul bouton**, pictogramme au trait (surtout pas un emoji — verdict de
  l'auteur : « ça fait jouet, on est adulte »).
- Déplié : **onglets d'atelier grands**, en vrais onglets collés au corps du panneau
  (même fond, pas de trait entre eux) — c'est ça qui dit « ce qui est en dessous
  appartient à l'onglet ».
- **Quatre ateliers**, chacun sa couleur, qui se propage au soulignement de la catégorie,
  aux symboles des tuiles et à leur survol :
  ★ Rapide (ambre) · ⚡ Électronique (cyan) · 🏭 Process (violet) · 🔌 Énergie & ondes (vert).
- **Tuiles de taille FIXE**, jamais étirées. Elles se rangent sur plusieurs lignes ;
  **une ligne incomplète est centrée**. Plus de vide à droite.
- La recherche occupe toute la place restante à droite des onglets.

### La zone Outils (haut droite) — validée telle quelle
```
OUTILS
  ↶  ↷  |  🩹 Gomme  📷            ▸
  ───────────────────────────────────
  Portes 4    Câbles 7    Zoom 100%
  ───────────────────────────────────
  🗑 Tout effacer            (rouge, en bas, à l'écart)
```
**Repliée, elle garde ↶ ↷ visibles** — annuler est un geste d'urgence, il ne doit jamais
demander d'ouvrir quoi que ce soit.

### Le mode leçon
- Menu haut gauche, Outils haut droite, **chapitre + titre en filigrane** sur la grille.
- **Sous le Menu : un panneau d'actions pliable.**
  - Plié : trois icônes nues — **ampoule** (la leçon), **cible** (la réponse),
    **coche verte** (vérifier). Décision de l'auteur, contre mon avis ; le garde-fou est
    alors entièrement dans la couleur (neutre / ambre / vert).
  - Déplié : les trois boutons en entier **+ l'énoncé**.
- **Le suivi est posé sur la grille**, en bas à droite : objectif, étapes faites, étape en
  cours, étapes restantes. Il **remonte au-dessus du panneau des objets** quand celui-ci
  s'ouvre, et **s'efface pendant qu'on fait glisser un composant**.
- Pas de doublon : le filigrane porte chapitre + titre, le panneau porte l'énoncé.

### Les animations
Demandées explicitement. Tout s'ouvre **depuis son bouton**, en ~0,18 s.
**Piège à ne pas rater** : la grille se redessine 60 fois par seconde. Animer `width`,
`height`, `left` ou `top` force un recalcul de mise en page à chaque image et ça saccade.
On n'anime que `transform` et `opacity`. Et `prefers-reduced-motion` coupe tout.

### La gomme — validée
- Dans les Outils. **Efface au GLISSER**, pas au clic un par un : sinon elle n'apporte
  rien de plus que survol + Suppr, qui existe déjà (`logicgates.html`, touche `Delete`).
- Quatre garde-fous obligatoires : curseur en gomme · liseré rouge autour de la grille ·
  sortie par Échap / clic droit / re-clic · **chaque effacement passe par l'historique**.
- Elle refuse les composants verrouillés des leçons **et le montre** (curseur « interdit »).

### DÉFAUT TROUVÉ EN CHEMIN, à corriger avant de déplacer le bouton
**« Tout effacer » n'est pas annulable.** `logicgates.html:15527` appelle `clearBoard()`
(ou `loadMission`) sans `pushUndo()`, et `loadMission` fait `undoStack = [snapshotState()]`
(ligne ~15139) qui écrase l'historique. Aucune confirmation non plus. Un clic, tout est
parti. Tant que c'est vrai, ce bouton ne doit pas voisiner ↶ ↷.

### Livraison en cinq lots
| Lot | Contenu | Risque |
|---|---|---|
| ~~1 · le panneau~~ | **FAIT en v6.30** | — |
| 2 · le haut | en-tête supprimé, Menu, Outils, filigrane | moyen (14 boutons à déplacer) |
| 3 · la leçon | panneau d'actions pliable, suivi sur la grille | faible |
| 4 · la gomme | effacement au glisser + « tout effacer » annulable | moyen |
| 5 · plus tard | « la leçon sur le schéma » montre les objets **un par un** | élevé — à part |

### À noter pour plus tard (demandé par l'auteur)
« La leçon sur le schéma » **affiche tout d'un coup**. Elle devrait montrer les objets à
poser **au fur et à mesure**. Deux lectures : une simple animation, ou — bien meilleur —
ne montrer que **l'objet suivant**, le suivant n'apparaissant qu'une fois le précédent
posé. La seconde demande que le moteur reconnaisse ce qu'on vient de poser : vrai travail,
lot séparé.

## Ce qui reste

Découpage validé avec l'auteur. Un lot, on livre, il teste, il valide.

**Phase 1 — le continu : TERMINÉE.**
→ le lot 3 devra ajouter **une vraie condition de réussite** : aujourd'hui une
leçon sans table de vérité est gagnée dès qu'on clique sur « Vérifier »
(`logicgates.html`, gestionnaire de `btn-verify`, la ligne `if (!m.tt.length)`).
Prévoir un champ `m.check(components, wires)`.

**Phase 2 — produire : TERMINÉE.**

**Phase 3 — l'alternatif : TERMINÉE** (lots 6 et 7, v6.20 et v6.22).
→ il manque encore des **montages d'exemple ⚡ pour l'alternatif** dans le
menu 📦 (les quatre existants ne couvrent que le continu).

**Phase 4 — l'éther : TERMINÉE.** Lot 8 (distance et obstacles) v6.24,
lot 9 (accord, bande passante, AM/FM, bruit) v6.26, lot 10 (Morse, trame
numérique, haut-parleur, chapitre final) v6.28.

**➡️ LA FEUILLE DE ROUTE ⚡ EST TERMINÉE.** La suite du travail est dans
« Chantiers demandés » et « L'audit du moteur » ci-dessus. L'ordre convenu avec
l'auteur : le **lot A** de l'audit (petit, sans risque, gain immédiat), puis la
**refonte de l'overlay et des menus**.
→ **Un audit UI/UX complet de l'overlay a été demandé** pendant le lot 8
(hiérarchie visuelle, ergonomie, accessibilité/responsive, technique). Son
rapport alimentera la refonte de l'overlay prévue après la phase 4.
