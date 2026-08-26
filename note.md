# Carnet de bord

À lire en premier au démarrage d'une session. Les consignes de travail sont
dans `CLAUDE.md`.

## Où en est le projet

- **v6.21**, branche `claude/architecte-logique-v5-vntfkp`, **228 tests verts**
  (`npm test`).
- `logicgates.html` : ~12 800 lignes, un seul `<script>`, aucune dépendance.
- Copies figées dans `versions/` (v5.1 → v6.21), avec leur tableau dans
  `versions/README.md`.
- Catalogue : **166 leçons en 32 chapitres** — 63 à table de vérité (dont 8
  boîtes noires), 85 libres, et 18 à **condition de réussite** (chapitres 31 et 32).

## Ce qui vient d'être fait

**Le tracé des câbles, deux défauts de fond** (v6.21). Mesuré sur les 722
câbles de tous les montages livrés : **traversées 61 → 10**, **pire détour
282 → 114 px**.

1. `bypassY` n'avait que deux choix : au-dessus de TOUT, ou en dessous de
   TOUT. Il ne savait pas se faufiler ENTRE deux obstacles — un fil dont les
   deux bornes étaient à la même hauteur grimpait de 186 px et survolait
   l'écran entier pour éviter deux ampoules entre lesquelles il y avait toute
   la place. Il cherche maintenant le **couloir libre le plus proche**
   (`bouchons()` fusionne les bandes occupées ; `bypassY` prend le meilleur
   couloir). Et il **serre sa marge** (26 → 16 → 10 px) plutôt que de renoncer
   quand tous les couloirs sont trop étroits.
2. Le chemin vers l'AVANT ne regardait rien : un fil traversait tranquillement
   un boîtier posé entre ses deux bornes dès qu'elles étaient à la même
   hauteur. `barreH` / `barreV` le vérifient désormais avant de tracer.

**⚡ Lot 6 : l'alternatif** (v6.20). Phase 3 entamée. Trois morceaux :

1. **Une horloge pour le circuit.** Le simulateur lisait l'heure de la machine
   à 54 endroits ; 45 lignes sont passées sur `simNow`. Deux temps cohabitent
   désormais : l'AFFICHAGE (animations, clignotements — vraie montre, toujours)
   et la SIMULATION (`simNow`, que le ralenti étire). Le bouton ⏱ de l'en-tête
   cycle ×1 / ×10 / ×100 et ralentit **tout** — vérifié : une temporisation
   d'une seconde demande douze secondes réelles en ×10.
2. **Les sous-pas.** `solveElec` découpe l'image en jusqu'à 32 pas dès qu'une
   branche a de la mémoire ou réclame de la finesse. Sans elles : **un seul
   pas**, calcul identique à avant.
3. **`CONDO`, `INDUC`, `GENEAC`** (sinus / carré / triangle, jusqu'à 100 Hz),
   et l'oscilloscope qui échantillonne au sous-pas, fenêtre jusqu'à 20 ms.

**⚡ Énergie & ondes, lot 1 sur 10 : le socle du continu** (v6.11). L'atelier
🔌 n'est plus grisé. Il contient quatre composants — `PILE`, `INTERP`
(interrupteur de puissance), `LAMPE` (ampoule à filament), `MASSE` — et un
**vrai solveur nodal** qui résout tout le circuit d'un coup.

Ce qu'on peut faire : la boucle pile → interrupteur → ampoule → masse → pile.
Deux ampoules en parallèle et la pile s'affaisse, visiblement. On ouvre la
boucle et tout s'éteint.

**⚡ Lot 5 : produire autrement, et rejoindre le Process** (v6.19). Phase 2
terminée. `CHAUD` (la chaudière — elle n'avait JAMAIS été écrite, la feuille de
route la promettait depuis le début), `TURBINE` à vapeur avec régulateur,
`SOLAIRE` (source de COURANT, qui voit les ampoules posées à côté de lui),
`SEEBECK` (thermopile). Chapitre 32, huit leçons.

**Six onglets débordaient de l'écran**, dans les trois ateliers (`calc` et
`act` en avaient seize). Dégonflés : deux onglets de plus (« Données & bus »,
« Procédés ») et une règle nouvelle — un composant rangé À LA MAIN dans un
onglet n'est plus rangé une seconde fois par sa famille. Un onglet marqué
`emprunt:true` fait exception (il emprunte sans priver l'atelier d'origine).

**v6.18 — l'atelier ⚡ passe à quatre onglets** : Le continu (8), Mesure (3),
Produire (3), Câblage (7). Une seule rangée de quinze tuiles débordait de
l'écran, et l'auteur ne retrouvait plus l'aimant. Trois familles nouvelles
(`mesu`, `prod`, `wirp`) avec chacune sa section de guide.

**⚡ Lot 4 : produire du courant** (v6.17). `AIMANT` (se promène à la souris,
aucune borne — il agit par sa position), `BOBINE` (loi de Faraday : la tension
suit la VITESSE à laquelle le champ change ; immobile au centre = zéro), et
`DYNAMO` à manivelle qu'on tourne à la souris, dont l'effort et le retard sur
la main augmentent avec la charge. Deux jauges côte à côte : effort fourni et
électricité produite. L'oscilloscope montre enfin le NÉGATIF (il écrêtait) —
sans quoi la moitié de l'alternatif était invisible.

**⚡ Lot 3 : le chapitre du continu** (v6.16). Le **chapitre 31 « Le courant
continu »**, dix leçons à la fin du catalogue, chacune avec son montage de
référence et sa **vraie condition de réussite** — c'est le premier chapitre où
« Vérifier » regarde le circuit au lieu de croire le joueur sur parole. Quatre
**montages d'exemple ⚡** dans le menu 📦 (la boucle, le banc de mesure, le
variateur, les deux barres et un fusible).

**v6.15 — le câblage de l'atelier ⚡, et le fusible.** L'onglet Câblage de
l'atelier énergie est maintenant le sien (`wirep`) : les barres et le tunnel de
PUISSANCE en tête, ceux de signal en dessous pour les sorties de mesure.
Avant, il n'offrait que les rails logiques, qui refusent la puissance à juste
titre — d'où la confusion. Les barres de puissance sont aussi **redessinées**
en jeu de barres épais à têtes de vis hexagonales, impossibles à confondre avec
le mince liseré ambre du rail de signal. Et quand on se trompe malgré tout, le
message de refus **nomme le jumeau à prendre**.

Nouveau composant : le **FUSIBLE** (calibre réglable, fond au-delà, se remplace
au clic).

Les deux mécanismes du chapitre :
- `m.check(components, wires)` — la troisième façon de gagner, pour les leçons
  sans table de vérité. Rend `true`, ou **la phrase qui dit ce qui manque** —
  c'est elle que le joueur lit, donc elle doit être utile, pas décorative.
  Vocabulaire d'appui : `ckTous`, `ckUn`, `ckAllumees`, `ckSources`,
  `ckDebite`, `ckBoucle`, juste avant `const missions`.
- `m.dom` — l'atelier de la leçon ; `loadMission` y bascule tout seul.
**T207 est le garde-fou du chapitre** : il pose le montage de référence de
chaque leçon et exige qu'il passe sa propre condition. Toute nouvelle leçon à
`check` doit y survivre.

**v6.14 — confort et câblage.** Rail et tunnel de puissance (`RAILP4`,
`RAILP8`, `TUNP`). Le **clic simple sélectionne** (et actionne toujours le
composant), **Maj + glisser duplique**, **Ctrl+X** coupe. Le tracé des câbles
corrigé sur trois points de plus (voir « Décisions »).

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

## Chantiers demandés, hors feuille de route

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

## Ce qui reste : ⚡ Énergie & ondes, lots 4 à 10

Découpage validé avec l'auteur. Un lot, on livre, il teste, il valide.

**Phase 1 — le continu : TERMINÉE.**
→ le lot 3 devra ajouter **une vraie condition de réussite** : aujourd'hui une
leçon sans table de vérité est gagnée dès qu'on clique sur « Vérifier »
(`logicgates.html`, gestionnaire de `btn-verify`, la ligne `if (!m.tt.length)`).
Prévoir un champ `m.check(components, wires)`.

**Phase 2 — produire : TERMINÉE.**

**Phase 3 — l'alternatif.** Lot 6 : **FAIT** (v6.20). Reste le **lot 7** :
résonance (un circuit LC a une fréquence préférée), pont redresseur
(transformer l'alternatif en continu), et le **chapitre 33** avec ses leçons à
condition de réussite — plus des montages d'exemple. Le socle est là : les
sous-pas, la mémoire et le générateur alternatif marchent, il ne reste que du
catalogue et de la pédagogie.

**Phase 4 — l'éther.** Lot 8 : la distance et les obstacles. Lot 9 : accord
LC, AM et FM. Lot 10 : Morse, numérique, le son, chapitre final.
