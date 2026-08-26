# NodeFlow

Jeu d'apprentissage de la logique numérique et de l'automatisme : des portes
élémentaires jusqu'aux capteurs, aux régulateurs et aux automates. 148 missions
guidées, de « allume une ampoule » au processeur 1 bit, puis du thermostat au
feu tricolore programmé, au circuit hydraulique et au diagnostic de pannes.

L'appli tient trois ateliers dans le même plan de travail : **⚡ Électronique**
(le signal et la logique), **🏭 Process** (l'installation : pupitre, capteurs,
actionneurs, régulation, supervision) et **🔌 Énergie & ondes** (le courant :
tension, intensité, puissance, résolus d'un seul coup par un solveur nodal). Chacun
a ses propres onglets et retient celui où on l'a laissé ; sa couleur se retrouve
sur l'onglet actif. Le choix ne filtre que la palette, sans rien verrouiller :
la recherche, la **barre de favoris** et le menu d'ajout rapide traversent
toujours tout le catalogue. Les favoris se composent seuls — les épingles qu'on
pose au clic droit, puis les composants qu'on emploie le plus.

`logicgates.html` est un **fichier HTML autonome** : aucune dépendance, aucun
serveur, aucun réseau. Ouvre-le dans un navigateur, c'est tout.
Canvas 2D pour le rendu, Web Audio pour le son, `localStorage` pour la
progression, les puces, les sauvegardes et le bac à sable.

## Ce que contient le jeu

**~92 composants** répartis en neuf familles, avec une recherche dans la barre
d'outils :

| Famille | Contenu |
| --- | --- |
| Entrées | interrupteurs, boutons, horloge, séquenceur, clavier 4 bits, DIP 8, sélecteur, arrêt d'urgence… |
| Capteurs | lumière, température, thermocouple haute T°, distance, humidité, niveau, pression, son, potentiomètre, présence, fin de course — **branchables sur un procédé pour mesurer en direct**, avec saturation hors gamme, une sortie de mesure et **deux contacts de seuil** (haut et bas) |
| Portes | les 7 portes de base, versions à 3 entrées, NAND·3, NOR·3 |
| Mémoire | retard, bascule D, registre, registre à décalage, RAM 16×4 |
| Calcul & bus | MUX/DEMUX (2 et 4 voies), additionneur, soustracteur, comparateur, décodeurs, encodeur, BCD→7 segments, ROM, bus, tunnels |
| Câblage | tunnels (nœuds nommés), **rails de distribution** 4 / 8 / 12 bornes ou longueur libre, **cadres de commentaire** titrés |
| Temps & automatisme | TON, TOF, impulsion calibrée, détecteur de fronts, mémoire SR, diviseur ÷N, chien de garde, machine à états, **GRAFCET** (étapes, réceptivités, temporisations, choix de séquence) |
| Régulation | CAN, CNA, PWM, thermostat à hystérésis, Schmitt, limiteur, rampe, régulateur proportionnel, **PID complet** (anti-emballement, RAZ) |
| Sorties | ampoule (**sept couleurs de voyant normalisées**), afficheurs (hex, décimal, octet), LED RVB, matrice 8×8, oscilloscope, sonde, buzzer, note, jauge, **écran de mesure 4 voies** et **enregistreur de courbes** |
| Actionneurs & procédés | relais, moteur (vitesse + tachymètre), vérin (position + fins de course), électrovanne et pompe proportionnelles, sirène, pas-à-pas, servo, feu, barrière — et les procédés qui réagissent vraiment : **four**, **cuve**, **réservoir d'air comprimé**, **convoyeur**, plus la fluidique (**tuyau** qui bride le débit, **té** de répartition) |

**L'écran est au circuit.** Il n'y a plus de colonne latérale : l'énoncé est un
bandeau fin en haut (repliable d'un clic), la table de vérité et les compteurs
un petit bloc repliable en bas à droite, les boutons d'action une colonne
étroite. Le milieu de l'écran appartient au schéma.

**Le cartouche de leçon.** L'explication n'est plus rangée sur le côté : c'est
une carte posée **sur le plan, à côté des composants dont la page parle**, et
reliée à eux par un trait. Elle garde une taille lisible quel que soit le zoom,
et se replace à chaque page : elle cherche le coin le plus vide, **rétrécit
quand aucun trou n'est assez large**, compte double les entrées et sorties
verrouillées — ce sont elles qu'on actionne — et ne recouvre **jamais** ce
qu'elle désigne. Si elle gêne quand même, on l'attrape par sa barre de titre
pour la poser ailleurs ; un double-clic sur cette barre la remet en placement
automatique.

**La leçon sur le schéma.** Pendant une mission, le bandeau indique en direct
combien de lignes de la table sont justes et laquelle cloche. Le bouton « La
leçon sur le schéma » déroule la marche à suivre **sur le plan de travail**,
**page par page** et au rythme du lecteur : les flèches `‹` et `›` avancent et
reculent, et **chaque page éclaire la partie du schéma dont elle parle** — ce
qu'elle nomme s'entoure d'un halo, le reste s'estompe. « Montre-moi » pose
l'étape en fantômes, « Tout poser » pose tout, et « Je sèche : donne-moi la
solution » fait le montage. **La page où l'on s'est arrêté est retenue leçon par
leçon.** Sur une mission à table de vérité la solution est calculée (implicants
premiers, couverture, conversion en base NAND ou NOR si la mission l'impose) ;
sur une mission libre — les quatre cinquièmes du catalogue — ce sont les étapes
écrites, avec le montage de référence quand la mission en fournit un (63 en ont
un aujourd'hui). Sur une boîte noire, la leçon refuse de guider mais livre
l'explication si on la demande.

**La victoire n'interrompt plus.** Un bandeau annonce le résultat sans
recouvrir le schéma, et la leçon enchaîne aussitôt sur le **« pourquoi ça
marche »**, page par page, sur le circuit que l'on vient de construire.

**La carte du cours.** En tête du bandeau, un fil d'Ariane situe la leçon
(*chapitre, leçon n / total*) ; ses flèches passent à la voisine, et un clic
ouvre la carte du cours : **30 tuiles de chapitre**, chacune avec son **anneau
de progression** (le numéro au centre, la part réussie tout autour, doré quand
le chapitre est bouclé) et ses leçons en **pastilles numérotées** — grise à
faire, verte réussie, dorée au nombre de portes visé, cerclée de cyan pour la
leçon en cours. Tout le parcours tient sur un écran. Une recherche par mot-clé
bascule la vue en liste de titres, et le bouton **Reprendre** saute à la
première leçon non réussie.

**Des schémas tout prêts.** Le menu 📦 propose 28 montages chargeables, dont quatorze
procédés complets : station de pompage, four régulé en tout ou rien / proportionnel
/ PID, poste pneumatique, convoyeur avec évacuation, vitesse moteur asservie, serre
automatisée, carrefour piloté par automate, capteurs en prise directe, circuit
hydraulique à deux branches, remplissage automatique à deux seuils, perceuse
pilotée en GRAFCET, et un
**atelier complet** où trois boucles tournent en parallèle.

**Le temps, et le ralenti.** Deux horloges cohabitent : celle de l'affichage,
qui anime et clignote à la vitesse du monde, et celle du **circuit**, qui le
fait vieillir. Le bouton ⏱ de l'en-tête étire la seconde — ×1, ×10, ×100 — et
il les étire **toutes ensemble** : la sinusoïde, la temporisation, la montée en
température du four. C'est ce qui rend regardable un secteur à 50 Hz.

**Ce qui a de la mémoire.** Une résistance ne se souvient de rien. Un
**condensateur** et une **bobine d'inductance**, si : leur état dépend de tout
ce qui a précédé. Le premier se remplit en courbe et garde sa charge ; la
seconde s'oppose aux changements de courant et fabrique une surtension quand on
coupe. Pour eux, le solveur **découpe chaque image en sous-pas** — jusqu'à
trente-deux — parce qu'un condensateur se charge en une milliseconde et qu'une
image en dure seize. Sans mémoire ni source rapide sur le plan, un seul pas :
le calcul reste exactement celui d'avant.

**Trier le courant.** Une **diode** est un clapet : elle laisse passer dans un
sens et bloque dans l'autre, à partir d'une tension de seuil. Seule, elle jette
la moitié d'une onde alternative. En **pont** — quatre diodes en losange — elle
la *retourne* : les deux alternances ressortent du même côté. Ajoute un gros
condensateur en sortie et les bosses se comblent : c'est l'intérieur d'un
chargeur de téléphone.

**La fréquence préférée.** Une bobine s'oppose d'autant plus au courant que ça
change vite ; un condensateur, exactement l'inverse. À une fréquence précise
les deux s'annulent, et le courant s'envole — la **résonance**. Elle ne dépend
que de la bobine et du condensateur, et c'est ce qui permet à une radio de
choisir une station.

**L'alternatif.** Le **générateur alternatif** ne pousse pas toujours dans le
même sens : amplitude, fréquence jusqu'à 100 Hz, et forme de l'onde au choix
(sinus, carré, triangle). Il réclame lui-même le pas de temps qu'il lui faut —
une quarantaine de points par période — pour que son onde reste une onde et non
un escalier. L'oscilloscope échantillonne au même rythme, avec une fenêtre qui
descend à 20 ms.

**La radio.** Premier domaine où **la position des boîtiers compte**. Un
**émetteur** s'alimente comme une ampoule et rayonne ce qu'il consomme ; un
**récepteur** capte, sans le moindre fil entre les deux. Deux lois, toutes deux
vraies : la distance (deux fois plus loin, quatre fois moins de puissance — la
tension, elle, n'est divisée que par deux) et les obstacles (un **mur** posé
sur le trajet en retient sa part, selon sa matière : bois, brique, béton,
métal). L'échelle du plan est fixée à **50 pixels pour un mètre**. Le récepteur
n'est pas qu'un afficheur : c'est une source, quelques millivolts avec la
résistance de son antenne en série — assez pour un oscilloscope, pas pour une
ampoule.

**Choisir sa station.** Chaque émetteur a une **fréquence**, chaque récepteur
un **bouton d'accord** et une **bande passante**. Accordé au bon endroit tout
passe, à côté presque rien — et c'est ce « presque rien » qui permet à des
milliers de stations de partager le même air. Derrière ce bouton, il y a le
circuit accordé du chapitre 33 : l'infobulle dit quel condensateur il faudrait
avec une bobine de 1 µH, calculé avec la vraie formule.

**AM et FM.** Une porteuse nue ne dit rien. En **AM** c'est sa force qui suit le
signal, en **FM** sa fréquence — et l'amplitude ne bouge pas d'un poil. Le
bruit d'une liaison s'ajoutant à l'amplitude, l'AM le reçoit en plein et
grésille de plus en plus loin ; la FM l'ignore, jusqu'au moment où elle
**décroche d'un coup**. C'est l'effet de seuil, et il est reproduit. Une
porteuse de 100 MHz ne se calcule pas point par point — deux millions de fois
trop de travail : on simule ce que la liaison fait au signal, avec les vraies
formules.

**Transmettre quelque chose.** Le **manipulateur Morse** envoie un message en
points et en traits, le **décodeur** le réécrit — à partir de rien d'autre que
des durées, et à condition que les deux soient réglés sur la même vitesse.
L'**émetteur numérique** envoie un octet bit par bit avec un bit de départ ; le
récepteur le remonte, en échantillonnant au milieu de chaque case, et dit
`ERR` quand la trame est cassée. Branchés sur une liaison radio, ils traversent
la pièce sans le moindre fil — et le numérique montre sa falaise : parfait,
puis d'un coup plus rien.

**Le son.** Le **haut-parleur** transforme le courant qui le traverse en son,
dont la hauteur est la **fréquence mesurée** de ce courant — comptée sur les
sous-pas du solveur, parce qu'on ne peut pas reconnaître du 50 Hz en regardant
soixante fois par seconde. C'est là que le domaine se referme : un haut-parleur
et une antenne font la même chose, à deux vitesses différentes.

**Les pannes.** Une installation qui marche n'apprend rien : ce qu'on apprend,
c'est à trouver *pourquoi* elle ne marche plus. Tout composant accepte une
panne — hors service, mesure figée, dérive, organe bloqué — et rien ne se voit
sur le schéma : la touche `P` révèle les défauts, mais on ne s'en sert
qu'après avoir cherché. Les pannes voyagent avec les sauvegardes, de quoi en
piéger une et la faire chercher à quelqu'un. Le chapitre 30 apprend la méthode :
remonter la chaîne depuis la demande jusqu'à l'effet, et trouver le premier
maillon où « ce qui est ordonné » cesse de correspondre à « ce qui se produit ».

**Le GRAFCET, avec sa page dédiée.** Un cycle de machine ne se décrit pas en
équations mais en étapes reliées par des transitions : une étape est active ou
non, et les actions qu'on lui associe durent exactement le temps où elle l'est.
Double-cliquer le bloc ouvre un **éditeur graphique** où l'on pose les étapes à
la souris, on les glisse, on les relie, et l'on écrit les réceptivités en clair
— `R1`, `R1·/R2`, `R2+X3` — avec temporisation `t/5s` facultative. Le modèle est
celui de la norme (CEI 60848), pas une simplification linéaire : plusieurs
étapes peuvent être actives à la fois, une transition peut avoir plusieurs
amont (**convergence ET**) et plusieurs aval (**divergence ET**, dessinée en
double barre), et deux transitions partant d'une même étape font une
**divergence OU**. Un **temps de scrutation** réglable donne le rythme, comme
sur un vrai automate — c'est lui qui empêche le graphe de s'emballer. Le
boîtier n'en montre qu'une miniature, mais fidèle, avec le jeton en direct.

**La mesure ne perd rien en chemin.** Un fil de mesure porte une valeur
continue dans l'échelle 0-255 : une consigne de `100,4 °C` vise 100,4 °C, pas
le palier le plus proche. Seuls les blocs qui travaillent sur des bits
arrondissent — et c'est leur rôle : brancher un CAN sur une sonde, c'est
précisément choisir de découper l'étendue en 256 crans.

**Les réglages parlent en unités réelles.** Une consigne se donne en `°C`, en
`bar`, en `%` ou en `tr/min`, jamais en valeur brute : chaque régulateur reprend
l'unité et l'étendue de la mesure branchée sur son entrée, et l'inspecteur
comme la glissière se graduent dedans. Branche un four gradué de 0 à 250 °C et
le thermostat demande une consigne entre 0 et 250 °C ; sans rien de branché, le
réglage s'exprime en % de l'échelle. En interne le circuit continue de
transporter une grandeur numérique — c'est exactement la **mise à l'échelle**
d'un automate réel.

**La tuyauterie se raccorde.** Les ports fluides sont **carrés** et refusent de
se brancher sur une borne électrique. Ce qui circule dedans est un débit : la
pompe pousse, la vanne dose, le tuyau limite selon sa section (et affiche
`BRIDÉ`), le té réunit ou répartit, la cuve refuse d'avaler quoi que ce soit une
fois pleine. Chaque élément annonce à son amont ce qu'il peut accepter, et
garde à côté une sortie de mesure électrique — c'est par là que le procédé
rejoint la commande.

**Commander et mesurer.** Tout actionneur accepte la même commande en tout ou
rien (`1` = pleine puissance) ou dosée (`2`…`255`, depuis un PWM, un CNA ou un
régulateur), et **renvoie ce qu'il fait vraiment** : vitesse et tours d'un
moteur, position d'un vérin ou d'un servo, débit d'une vanne, niveau et pression
d'une cuve, angle d'une barrière. C'est ce retour qui permet de fermer une
boucle — et l'**enregistreur de courbes** trace deux mesures dans le temps pour
juger une régulation à sa forme : montée, dépassement, oscillation, écart
résiduel.

**Le tracé des câbles.** Un schéma se lit parce que ses fils sont horizontaux
ou verticaux : le regard suit un couloir, et un croisement se repère parce
qu'il est à angle droit. C'est le tracé par défaut — amorce dans la direction
de chaque broche, segments à angle droit, angles arrondis — et les câbles qui
empruntent le même couloir s'écartent automatiquement au lieu de se
superposer. Un fil qui revient en arrière contourne les boîtiers. Trois modes
au choix (`⌐` angles droits, `∿` courbes, `／` direct), et le double-clic sur
un câble pose une poignée à glisser pour reprendre la main.

Quand un boîtier barre le passage, le fil **cherche le couloir libre le plus
proche** — y compris *entre* deux obstacles, ce qu'il ne savait pas faire : il
grimpait au-dessus de tout le plan pour éviter deux pièces entre lesquelles il
y avait toute la place voulue. Et le chemin le plus court est désormais
**vérifié** avant d'être pris : un fil ne traverse plus une pièce posée entre
ses deux bornes. Mesuré sur les 722 câbles des montages livrés : les traversées
passent de 61 à 10, et le pire détour de 282 à 114 pixels.

**Câbler vite, ranger le plan.** Tirer un fil et le **lâcher dans le vide**
propose les composants qui savent recevoir ce signal, et celui qu'on choisit
arrive posé *et* câblé — du bon côté, donc sans fil qui repart en arrière. Les
**guides d'alignement** collent les blocs sur leurs voisins pendant le
déplacement. Les **cadres titrés** (`▭` dans le bandeau de sélection)
regroupent une fonction et l'emportent quand on les déplace. Le **rail de
distribution** remplace vingt fils convergents par vingt moignons. `Ctrl+F`
cherche parmi les composants posés et s'y rend ; un **plan miniature** apparaît
dès que le montage déborde de l'écran.

**Confort.** Infobulle au survol (état de chaque pin dans son unité, réglages,
valeur d'un câble), **menu contextuel au clic droit** avec les raccourcis,
rotation par quarts de tour et miroir (`R`, `M`), noms de composants masquables
(`N`), recadrage automatique (`F`), révélation des pannes (`P`), niveau de
détail au zoom, mise en évidence du voisinage, encapsulation d'une sélection en
puce, annuler/refaire (boutons et `Ctrl+Z`/`Ctrl+Y`), export PNG recadré.

## Tests

```sh
npm test                          # ou : node test/run.js [fichier.html]
node test/run.js fichier --smoke  # contrôle de démarrage seulement
```

Le harnais est *headless* : `test/run.js` extrait le `<script>` du HTML, le
concatène entre `test/pre.js` (stubs DOM / Canvas / Audio / localStorage, plus
une horloge `Date.now` pilotable) et `test/post.js` (les tests), puis exécute le
tout dans un contexte `vm`. Aucun navigateur, aucune dépendance npm.

231 tests couvrent le moteur, le séquentiel, les blocs numériques, l'analogique
et la régulation (dont une boucle fermée four + thermostat), l'édition,
l'orientation, les tunnels, les puces, l'interface, le balisage et le guide.
Deux tests valident automatiquement **tout** nouveau composant du registre
(complétude, publication, instanciation, simulation, dessin, sérialisation), et
le solveur est vérifié en résolvant réellement 54 missions du catalogue.

## Ajouter un composant

Un composant est un objet déclaratif passé à `defComp()` : identité, famille,
couleur, icône, pins, coût, réglages d'inspecteur, `eval`, `commit`, dessin
facultatif, équation pour l'analyseur, entrée de guide.
`registerComponents()` le publie dans toutes les tables du moteur — barre
d'outils, inspecteur, analyseur, guide et sérialisation compris.

## Sauvegarde locale

| Clé `localStorage` | Contenu |
| --- | --- |
| `al2_progress` | missions réussies, meilleurs scores et dernière page de leçon consultée (v3) |
| `al2_chips` | puces créées par le joueur |
| `al2_saves` | montages nommés |
| `al2_sandbox` | bac à sable courant (auto-sauvegardé) |
| `al2_mode` | atelier courant (électronique / process) |
| `al2_tabs` | dernier onglet visité dans chaque atelier |
| `al2_fav`, `al2_freq` | favoris épinglés et compteur d'usage |
| `al2_barre` | barre d'outils repliée ou non |
| `al2_wire` | mode de tracé des câbles |
| `al2_mute`, `al2_snap`, `al2_labels` | préférences |

`versions/` conserve des copies figées des versions précédentes ; elles restent
vérifiables (`node test/run.js versions/<fichier> --smoke`).
