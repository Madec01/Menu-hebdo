# Recherche — Rendre le creusement réellement fun

> Question : comment un jeu de minage, activité intrinsèquement répétitive, devient-il
> addictif ? Que font ceux qui réussissent, exactement là où les autres ennuient ?
> Cible : **CORE** (foreuse 2D en coupe, 14 niveaux de 15–50 s, chrono adversaire).

**Convention de lecture.** Tout ce qui est sourcé porte une URL. Tout ce qui est mon
jugement est préfixé par **[opinion]**. Aucune affirmation chiffrée n'est inventée.

**Limite méthodologique à connaître.** L'accès direct aux pages (WebFetch) est bloqué par
le proxy réseau de cette session pour `gamedeveloper.com`, `wikipedia.org`,
`steamcommunity.com`, `killscreen.com`, `web.archive.org` et `reddit.com`. Les contenus
ci-dessous ont donc été récoltés via le moteur de recherche, qui restitue des extraits et
synthèses de ces pages. **Trois articles-clés n'ont pas pu être lus intégralement** et sont
signalés comme tels : le deep dive SteamWorld Dig, l'article Dome Keeper de Game Developer,
et le post-mortem GDC de SteamWorld Dig. Leurs URL sont données pour lecture directe.

---

## 0. Ce que CORE a déjà (et qu'on ne re-proposera pas)

Carburant au volume excavé · Faille (front d'effondrement descendant) · 3 points
d'intégrité · effondrement de la roche non soutenue · bonus temporaires cumulables I–III ·
31 passifs tirés 3/3 · boutique · explosifs craftés · carnet de déblocages persistants ·
niveaux de 15–50 s · élan · turbo qui se mérite · médailles et splits.

Autrement dit : CORE a déjà **la pression**, **la conséquence**, **la variance de build**
et **la méta-progression**. Les manques réels sont ailleurs, et le §5 s'y tient.

---

## 1. Les jeux de référence — LA mécanique anti-répétition de chacun

### 1.1 Mr. Driller (Namco, 1999)

**LA mécanique : l'air.** Une jauge d'oxygène se vide en continu ; on la remplit avec des
capsules enfouies. Les blocs « X » coûtent 5 coups à percer **et retirent 20 % d'air**, et
les niveaux profonds entourent délibérément les capsules de blocs X.
Sources : [Blocks — Mr. Driller Wiki](https://mrdriller.fandom.com/wiki/Blocks) ·
[StrategyWiki](https://strategywiki.org/wiki/Mr._Driller/Walkthrough) ·
[HonestGamers review](https://www.honestgamers.com/2508/dreamcast/mr-driller/review.html)

**Pourquoi ça marche.** La ressource vitale est **placée à l'endroit dangereux**. Ce n'est
pas la jauge qui crée la tension, c'est la géographie de la jauge : « il faut collecter les
capsules, mais pour toutes les prendre, il faut souvent se mettre en danger »
([HonestGamers](https://www.honestgamers.com/2508/dreamcast/mr-driller/review.html)).

**Le deuxième étage.** Mr. Driller a « un game design en surface, et le vrai jeu caché
juste en dessous : pour dominer le classement, atteindre le fond ne suffit pas — il faut
le faire sans perdre de vie et avoir ramassé chaque capsule »
([Games From The Black Hole](https://gamesfromtheblackhole.wordpress.com/2021/11/21/mr-driller/)).
Et l'analyse de *Drill Land* résume la boucle : « Mr. Driller fonctionne surtout comme un
test de la tentation »
([Jeremy Signor, *Dissecting the Sublime Mr. Driller Drill Land*](https://thelifeofgame.wordpress.com/2020/07/02/dissecting-the-sublime-mr-driller-drill-land/)).

**Chaînes.** Les blocs de même couleur qui tombent fusionnent et disparaissent par 4+,
déstabilisant ce qui est au-dessus ; le score passe de 10 pts par bloc isolé à 40 pts en
chaîne. Le jeu paie **massivement** le fait de provoquer une réaction plutôt que de forer
([Drill Land analysis](https://thelifeofgame.wordpress.com/2020/07/02/dissecting-the-sublime-mr-driller-drill-land/) ·
[Grokipedia — Mr. Driller](https://grokipedia.com/page/Mr._Driller)).

### 1.2 Motherload (XGen, 2004) et Super Motherload (2013)

**LA mécanique : le carburant comme laisse élastique.** Descendre coûte du carburant ;
remonter en coûte aussi ; il faut revenir vendre en surface. Panne sèche = mort et perte.
Source : [Motherload Wiki](https://motherload.fandom.com/wiki/Motherload) ·
[Wikipedia — Super Motherload](https://en.wikipedia.org/wiki/Super_Motherload) ·
[JayIsGames](https://jayisgames.com/review/motherload.php).

**Pourquoi ça a marché en 2004.** Boucle propre : miner → vendre → améliorer → descendre
plus profond, avec des minerais de plus en plus précieux avec la profondeur. Décrite comme
« un mélange de profit obsessionnel-compulsif et de gameplay addictif »
([JayIsGames](https://jayisgames.com/review/motherload.php)).

**Pourquoi ça n'a pas survécu au passage 2013.** C'est le cas d'école. Critiques
récurrentes de *Super Motherload* : « la nature répétitive du fait de creuser puis de
remonter pour refaire le plein devient fastidieuse » ; « la première heure est répliquée
encore et encore » ; « le forage est sans poids, les blocs disparaissent sans animation » ;
« aucun minerai inédit dans les couches successives — les mêmes minerais sur tout le jeu ».
Metacritic 65, « mixed ».
Sources : [Metacritic — Super Motherload](https://www.metacritic.com/game/super-motherload/) ·
[OpenCritic](https://opencritic.com/game/311/super-motherload/reviews) ·
[Push Square](https://www.pushsquare.com/reviews/ps4/super_motherload) ·
[3rd-strike](https://3rd-strike.com/super-motherload-review/)

> **Leçon directe pour CORE.** Le trajet retour est le poison n°1 du genre, et l'absence de
> nouveauté matérielle par couche est le poison n°2. CORE est déjà immunisé au premier
> (pas d'aller-retour) et se protège du second par les mécaniques signature de couche.

### 1.3 SteamWorld Dig 1 & 2 (Image & Form, 2013 / 2017)

**LA mécanique : le forage est un investissement d'infrastructure.** Le tunnel qu'on creuse
est la route qu'on empruntera dix fois. Le deep dive officiel est écrit par Olle Hakansson,
programmeur-designer : l'équipe « voulait créer un ensemble de mécaniques de forage qui
rendent cette partie du jeu amusante et excitante en soi », et non un simple transit vers
la boutique.
Source (non lisible depuis cette session, à ouvrir directement) :
[Game Design Deep Dive: The digging mechanic in SteamWorld Dig](https://www.gamedeveloper.com/design/game-design-deep-dive-the-digging-mechanic-in-i-steamworld-dig-i-) ·
post-mortem : [GDC Vault](https://www.gdcvault.com/play/1020909/SteamWorld-Dig-Postmortem-How-to)

**Ce que SW Dig 2 corrige, selon la critique.** « Du chemin que le joueur choisit de
creuser jusqu'à la personnalisation du personnage, le **choix signifiant** est au centre du
design de SteamWorld Dig 2. C'est ce qui l'élève au-dessus des jeux mobiles à boucle
comparable »
([Goomba Stomp](https://goombastomp.com/steamworld-dig-2-review/)).

**Les reproches, très constants sur le 1.** « Le backtracking est fastidieux » ; « plus on
descend, plus il faut de temps pour remonter refaire sa lumière ou faire ses courses » ;
« la première heure est la plus dure — plusieurs coups par bloc avec la pioche de départ,
progression lente et laborieuse ».
Sources : [Nintendo Life](https://www.nintendolife.com/reviews/3ds-eshop/steamworld_dig) ·
[Destructoid](https://www.destructoid.com/reviews/review-steamworld-dig/) ·
[Cat with Monocle](https://catwithmonocle.com/news/2018/02/19/steamworld-dig-review/)

> **Leçon.** Le début d'un jeu de minage est structurellement son pire moment : outil
> faible, roche lente, aucun pouvoir. C'est pourtant là que se joue la rétention J1.

### 1.4 Dome Keeper (Bippinbits, 2022)

**LA mécanique : deux horloges qui se contredisent.** « La tension de deux exigences
simultanées — le timer de minage et le timer de survie — tournaient toujours en même temps.
Aucune ne pouvait être satisfaite en ignorant l'autre ; le jeu exigeait une triangulation
permanente. »
([Shacknews review](https://www.shacknews.com/article/132448/dome-keeper-review))

Formulation encore plus utile, côté design système : « le timer de la mine était aussi un
système de ressource, **et aussi** un problème de calibration du risque » — Bippinbits
s'intéresse aux systèmes qui font plusieurs choses à la fois.
([Game Developer — How Dome Keeper focuses on systems that feed into one another](https://www.gamedeveloper.com/business/how-dome-keeper-focuses-on-systems-that-feed-into-one-another),
non lisible depuis cette session, extrait via moteur ·
[GameDaily](https://gamedaily.com/news/dome-keeper-blends-roguelike-mining-and-tower-defense-into-a-unique-sci-fi-survival-game))

**Le rythme est en vagues, pas continu.** La pression est périodique et annoncée. Le son
suit : « pendant la phase de minage, la musique est relativement clairsemée, jouée toutes
les 2 ou 3 cycles seulement, pour qu'elle reste une friandise » ; à l'inverse, « la musique
pendant le combat réduisait la tension » et a été retirée au profit du sound design pur.
([indiegame.com preview / interview Bippinbits](https://indiegame.com/en/archives/31688))

**La variance vient du départ de run, pas du terrain.** Un gadget principal choisi au
début, 22 gadgets secondaires trouvables, 2 types de dôme, planètes à paysages/palettes/
ennemis mixables, plus des modificateurs.
([Dome Keeper Wiki — Gadgets](https://domekeeper.wiki.gg/wiki/Gadgets) ·
[Modifiers](https://dome-keeper.fandom.com/wiki/Modifiers) ·
[Indiecator](https://indiecator.org/2024/11/29/indietail-dome-keeper/))

**Et pourtant, les critiques négatives.** « Trop lent, répétitif, grindy » ; « répétitif au
bout de 4 h » ; « transporter les ressources au début est extrêmement lent et casse
l'élan » ; « la rejouabilité est faible parce que chaque run se ressemble : on priorise les
mêmes améliorations » ; « ça ne devient vraiment fun qu'après quelques upgrades ». Malgré
92 % d'avis positifs sur ~18 000 avis.
Sources : [Metacritic user reviews](https://www.metacritic.com/game/dome-keeper/user-reviews/) ·
[Oortrain](https://www.oortrain.com/doomkeeper/how-good-is-dome-keeper) ·
[Gideon's Gaming](https://gideonsgaming.com/dome-keeper-review/)

> **Leçon double.** (a) Le rythme en vagues annoncées bat la pression continue.
> (b) Même un excellent jeu meurt de « on priorise toujours les mêmes upgrades » : c'est la
> **convergence des builds** qui tue la rejouabilité, pas le manque de contenu.

### 1.5 Downwell (Ojiro Fumoto, 2015)

**LA mécanique : la ressource ne se recharge qu'en prenant un risque.** Les gunboots ne se
rechargent qu'au contact du sol ou de certains objets, « créant une boucle risque/récompense
à enjeu élevé pour les joueurs qui tentent de longs combos aériens ».
([Wikipedia — Ojiro Fumoto](https://en.wikipedia.org/wiki/Ojiro_Fumoto) ·
[Thumbsticks — GDC 2016](https://www.thumbsticks.com/gdc-2016-ojiro-fumoto-on-polishing-downwells-gun-boots/) ·
[Kill Screen — The tricky brilliance of Downwell's gunboots](https://www.killscreen.com/the-tricky-brilliance-of-downwells-gunboots/))

**Le combo enseigne la bonne façon de jouer sans tutoriel.** « Quand on tue un certain
nombre d'ennemis, un compteur de combo apparaît et s'arrête quand on touche le sol —
ça apprend au joueur, avec le temps, que **tomber en continu est la bonne façon de
jouer** ». Le combo donne des gemmes, des charges et de la vie en bonus. Et surtout :
« le vrai génie du système de combo, c'est qu'il ajoute un défi pour ceux qui veulent
jouer vite, sans jamais être nécessaire pour finir le jeu ».
([Let's Make a Game — Downwell Design Review](https://letsmakeagame.net/downwell-design-review/) ·
[Downwell Wikia — Combos](https://downwell.fandom.com/wiki/Combos) ·
[Game Developer — Downwell Design Analysis](https://www.gamedeveloper.com/design/downwell-design-analysis))

**Les boutiques ne cassent pas le combo** : elles sont protégées par une bulle. La
respiration n'est pas punie.
([Let's Make a Game](https://letsmakeagame.net/downwell-design-review/))

**L'apprentissage est étagé** : chaque nouvel ennemi est introduit un étage avant son étage
« officiel », et chaque étage ajoute une mécanique d'environnement.
([Let's Make a Game](https://letsmakeagame.net/downwell-design-review/))

> **Leçon.** Un compteur visible de continuité, facultatif mais payant, transforme
> « descendre » en « descendre proprement ». C'est le levier le plus proche de CORE.

### 1.6 Deep Rock Galactic (Ghost Ship, 2018)

**LA mécanique : le terrain est 100 % consommable, et cette destruction est un outil
tactique.** « Environnements 100 % destructibles : on peut creuser des tunnels, faire
s'effondrer des stalagmites et fermer des goulets pour se faciliter le travail ». Le moteur
supprime les morceaux de terrain qui ne sont plus connectés — rien ne flotte.
([Page Steam DRG](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/) ·
[DRG Wiki — Terrain](https://deeprockgalactic.fandom.com/wiki/Terrain))

**La structure de mission a un climax obligatoire** : l'objectif atteint, la fuite vers la
capsule d'extraction sous chrono.
([DRG Wiki — Missions](https://deeprockgalactic.wiki.gg/wiki/Missions))

**Le jeu est explicitement conçu en trois parts égales** : exploration, gestion de
ressources, combat.
([Grokipedia — Deep Rock Galactic](https://grokipedia.com/page/Deep_Rock_Galactic))

> **Leçon.** Une session sans fin dramatisée n'est pas une session, c'est un tableau de
> score. C'est exactement le diagnostic du §4 de `v4-retention.md`.

### 1.7 Spelunky (Derek Yu, 2008/2012)

**LA mécanique : le fantôme.** Passé un délai, un fantôme invincible apparaît. « Sa
présence transforme le temps en ressource. Sans une limite de temps derrière soi, les
joueurs avancent à la vitesse d'un escargot et fouillent chaque recoin. » Il « ajoute de la
tension à l'exploration, force parfois des décisions difficiles, et t'apprend à
hiérarchiser ta façon d'aborder les objets ».
([Steam — Spelunky 2 discussions](https://steamcommunity.com/app/418530/discussions/0/4462460605171360862/) ·
[A Spelunky Game Design Analysis Pt. 2](https://www.gamedeveloper.com/design/a-spelunky-game-design-analysis---pt-2))
Derek Yu revendique la filiation arcade et « la tension montante chez le joueur à mesure
qu'il progresse » comme principe de design
([Sprites and Dice — critique du livre Boss Fight](https://www.spritesanddice.com/reviews/boss-fight-books-spelunky-review/) ·
[GameDevPills — The Arcade Spirit Behind Spelunky](https://www.gamedevpills.com/p/the-arcade-spirit-behind-spelunky)).

**Le Daily Challenge.** Une tentative par jour, graine identique pour la planète entière,
pas de retry. « L'idée qu'un seul faux pas coûte toute la journée et te ridiculise au
classement amplifie le risque » ; le mode a fait émerger une compétition sociale à partir
d'un jeu purement solo.
([Game Developer — The understated genius of the Spelunky Daily Challenge](https://www.gamedeveloper.com/design/the-understated-genius-of-the-i-spelunky-i-daily-challenge) ·
[spelunkyworld.com](https://spelunkyworld.com/dailychallenge/) ·
[Spelunky Wiki](https://spelunky.fandom.com/wiki/Daily_Challenge_Mode))

> **Note honnête.** CORE a déjà la Faille, qui est le fantôme de Spelunky. Ce qui n'est pas
> pris, c'est le **Daily**.

### 1.8 Terraria (Re-Logic, 2011)

**LA mécanique : la distribution du minerai en fonction de la profondeur, avec une
génération de veine fortement randomisée.** Les couches basses contiennent les meilleurs
métaux **en veines plus grandes** ; la couche Cavern affiche 4 à 5× plus de minerai que la
surface ; « la génération de chaque veine est fortement randomisée, ce qui rend difficile
de donner des valeurs exactes pour une veine optimale ».
([Terraria Wiki — Ores](https://terraria.wiki.gg/wiki/Ores) ·
[Carl's Guides — Mining](https://www.carlsguides.com/terraria/mining/) ·
[Guide: Mining techniques](https://terraria.fandom.com/wiki/Guide:Mining_techniques))

> **Leçon.** Le renforcement à ratio variable de Terraria n'est pas dans le drop, il est
> dans la **taille de la veine**. On sait ce qu'on va trouver, jamais combien.
> **[opinion]** C'est le levier le moins cher du genre : pas de nouveau système, juste une
> loi de distribution à queue longue sur une valeur qui existe déjà.

### 1.9 Dig Dug (Namco, 1982)

**LA mécanique : deux verbes qui se concurrencent économiquement.** Gonfler un ennemi à la
pompe (lent, sûr, peu payant) ou l'écraser avec un rocher en creusant juste en dessous
(rapide, risqué, très payant) : « faire tomber un rocher sur plusieurs ennemis rapporte
bien plus que de les gonfler un par un ».
([StrategyWiki — Dig Dug Gameplay](https://strategywiki.org/wiki/Dig_Dug/Gameplay) ·
[PrimeTime Amusements — Getting Good: Dig Dug](https://primetimeamusements.com/getting-good-dig-dug/) ·
[The Game Hoard](https://thegamehoard.com/2020/01/26/dig-dug-arcade/))

De plus, **le tunnel qu'on creuse est un choix stratégique** : « creuser des zones pour
naviguer plus vite, préparer des pièges à rochers, tromper les ennemis rend la construction
de tunnels stratégique »
([The Game Hoard](https://thegamehoard.com/2020/01/26/dig-dug-arcade/)).

> **Leçon.** La gravité doit être une **arme**, pas seulement une sanction. CORE a
> l'effondrement en punition ; il ne l'a pas encore en outil récompensé.

### 1.10 Boulder Dash (First Star, 1984)

**LA mécanique : une physique déterministe et minuscule, dont les interactions sont
imprévisibles.** « La physique est simple et essentiellement déterministe, mais ce sont les
interactions entre les nombreux éléments du niveau qui rendent le résultat difficile à
prédire et la solution difficile à trouver. »
([Data Driven Gamer](https://datadrivengamer.blogspot.com/2021/10/game-293-boulder-dash.html))
Les gemmes sont placées « à des endroits qui demandent de la planification, souvent en
utilisant la physique des rochers qui tombent pour bloquer ou dégager des zones »
([Raspberry Pi / Wireframe #30](https://www.raspberrypi.com/news/code-a-boulder-dash-mining-game-wireframe-30/)).

Détail de production remarquable : le moteur physique de base a été écrit en deux jours ;
tout le reste du travail a été le **level design**, et « en contrôlant la densité de
rochers et de gemmes on obtenait un gameplay intéressant » avec des cavernes générées
([Retro Gamer via boulder-dash.com](https://boulder-dash.com/retro-gamer-magazine-the-evolution-of-boulder-dash/)).

> **Leçon.** Le fun ne vient pas du nombre de règles mais de la **densité d'interaction
> entre trois règles**. Et le paramètre de tuning le plus rentable est la densité.

### 1.11 Miner Dig Deep (Zaphod Studios, 2009)

**LA mécanique : la lisibilité du retour sur investissement.** « Chaque amélioration
incrémentale rapporte un retour satisfaisant sur l'investissement, et ça garde le jeu
engageant pendant 6 à 8 heures », mouvement porté par « le désir de la prochaine
amélioration et la découverte de l'inconnu en dessous ».
([Giant Bomb — Indie Reviews](https://www.giantbomb.com/profile/starfoxa/blog/indie-reviews-miner-dig-deep/62078/) ·
[Indie Gamer Chick](https://indiegamerchick.com/2012/03/06/miner-dig-deep/) ·
[VentureBeat](https://venturebeat.com/community/2009/12/31/miner-dig-deep-a-paragraph-review/))

**Sa faille documentée** : « il y a un sentiment de progrès et d'accomplissement, mais
aucun objectif final visé, et le jeu semble n'avoir aucun point d'arrivée »
([RotoRob](https://videogamerrob.wordpress.com/2011/04/07/xblig-review-miner-dig-deep/)).

> **Leçon.** Une boucle d'amélioration seule tient 6–8 h et pas plus, en l'absence de
> destination. CORE a une destination (le Cœur) mais, selon `v4-retention.md` §4, pas
> encore de climax.

### 1.12 Drill Dozer (Game Freak, 2005)

**LA mécanique : le forage est un geste continu qu'on entretient, avec un retour tactile.**
Le foret a des vitesses ; il faut le monter en régime ; certains tunnels exigent une
rotation à droite (R), d'autres à gauche (L). La cartouche contient un vibreur : « avoir ce
retour tactile instantané sous forme de vibration dans la main est très utile, sans parler
du plaisir quand on déchire l'environnement en troisième ».
([GameSpot review](https://www.gamespot.com/reviews/drill-dozer-review/1900-6143274/) ·
[SuperPhillip Central](https://www.superphillipcentral.com/2015/12/drill-dozer-gba-retro-review.html) ·
[Cheaper Gamer](https://cheapergamer.co.uk/drill-dozer-review/))

> **Leçon.** Le forage doit être un **état** avec une montée en régime perceptible, pas un
> événement binaire. CORE a l'élan comme chiffre ; la question est de savoir s'il se *sent*.

### 1.13 Les hors-genre qu'il faut voler

**Downwell / Risk of Rain — le temps qui pèse.** Dans Risk of Rain, la difficulté monte
avec le temps écoulé : « le timer est littéralement la force motrice du défi », créant une
tension constante entre s'équiper et aller vite.
([Risk of Rain Returns Wiki — Difficulty](https://riskofrainreturns.wiki.gg/wiki/Difficulty) ·
[Dualshockers](https://www.dualshockers.com/risk-of-rain-returns-difficulty-setting-differences-explained/))

**Vampire Survivors — l'escalade de puissance comme récompense.** « Chaque session commence
avec un personnage vulnérable et une seule attaque ; par les gemmes d'expérience, on se
transforme en force imparable » ; effets clinquants et sons stimulants créent un
« sentiment de gagnant ».
([Kokutech — Vampire Survivors Design Analysis](https://www.kokutech.com/blog/gamedev/design-patterns/power-fantasy/vampire-survivors) ·
[Nat Rowley](https://www.natrowley.com/the-addictive-nature-of-vampire-survivors/))

**Teardown — la destruction comme gameplay et non comme effet.** « La destruction est venue
en premier, et le cadre a été rétro-ajusté à la technologie ; il était important que la
destruction serve un gameplay réel et pas seulement un effet. »
([Game Developer — How beautiful voxels laid the way for Teardown](https://www.gamedeveloper.com/design/how-beautiful-voxels-laid-the-way-for-i-teardown-s-i-heist-y-framework))

**PowerWash Simulator — la répétition assumée comme flow.** « Localiser chaque petit
composant d'un chantier, le nettoyer sous tous les angles, et voir le flash joyeux et le
*ding* qui signalent qu'un objet est complètement propre est un cercle pavlovien
efficace. » Les jeux de simulation produiraient des états de flow plus fiablement que les
shooters selon une étude citée par Galaxus.
([Galaxus — Why we like boring busywork in our games](https://www.galaxus.at/en/page/powerwash-simulator-and-many-more-why-we-like-boring-busywork-in-our-games-40050) ·
[The Gamer](https://www.thegamer.com/power-wash-simulator-review/))

---

## 2. La théorie applicable

### 2.1 Renforcement à ratio variable

Un schéma à ratio variable délivre la récompense après un nombre imprévisible d'actions ;
c'est le schéma **le plus résistant à l'extinction**, parce que l'imprévisibilité empêche
le comportement de s'éteindre.
([Simply Psychology](https://www.simplypsychology.org/schedules-of-reinforcement.html) ·
[AdinaABA](https://www.adinaaba.com/post/variable-ratio-schedule-examples))
Point neurologique important : « la libération de dopamine culmine pendant l'anticipation
incertaine, pas pendant la récompense garantie »
([Neurolaunch — Variable Reward Psychology](https://neurolaunch.com/variable-reward-psychology/)).

**Effet de quasi-succès (near miss).** « Les joueurs qui vivent un quasi-succès le prennent
comme un signe qu'ils devraient continuer », et un article de *Neuron* (2009) a montré que
les quasi-succès activent les mêmes circuits de récompense que les gains réels.
([The Psychology of Games — The Near Miss Effect and Game Rewards](https://www.psychologyofgames.com/2016/09/the-near-miss-effect-and-game-rewards/) ·
[Reid, *The Psychology of the Near Miss*, PDF Berkeley](https://www.stat.berkeley.edu/~aldous/157/Papers/near_miss.pdf))

**Traduction CORE.** Le carnet qui affiche « Le Camionneur — 14/15 bidons » **est** un
générateur de quasi-succès, et c'est légitime : le joueur voit exactement ce qu'il reste à
faire et le coût est borné.

### 2.2 Compulsion loop

Définition : une boucle de compulsion est « conçue pour guider le joueur vers
l'anticipation de la récompense potentielle d'activités spécifiques » et « peut être
renforcée en ajoutant un schéma à ratio variable ».
([Wikipedia — Compulsion loop](https://en.wikipedia.org/wiki/Compulsion_loop))
Les loot boxes en sont l'application prédatrice : renforcement à taux variable pour
produire de la dopamine par l'imprévisibilité (même source).

### 2.3 Flow et courbe de difficulté

Jenova Chen a fondé son mémoire de MFA sur le flow de Csikszentmihalyi : maintenir
l'équilibre entre défi et compétence pour éviter frustration et ennui, et surtout —
c'est la partie originale — **laisser au joueur des choix inconscients qui règlent
eux-mêmes la difficulté**, plutôt qu'un DDA automatique piloté par des données partielles.
([Chen, *Flow in Games*, PDF](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf) ·
[abstract](https://www.jenovachen.com/flowingames/abstract.htm) ·
[Engadget](https://www.engadget.com/2006-09-12-flow-in-games-an-interactive-thesis-on-dynamic-difficulty/))

**Pacing.** L'intensité d'un niveau se représente en courbe ; « les creux sont aussi
importants que les pics » ; trop de pics épuisent, des creux trop longs ennuient ; l'art
est dans la pente générale montante avec un plongeon entre chaque temps fort pour que
chaque pic garde son mordant.
([World of Level Design — Pete Ellis, Pacing and Gameplay Beats](https://www.worldofleveldesign.com/categories/wold-members-tutorials/peteellis/level-design-pacing-gameplay-beats-part2.php) ·
[Game Developer — Harnessed Pacing & Intensity](https://www.gamedeveloper.com/design/gameplay-fundamentals-revisited-harnessed-pacing-intensity) ·
[The Design Lab](https://thedesignlab.blog/2025/06/16/designing-for-emotional-pacing-crafting-moments-that-matter/))
Métriques proposées pour scorer une section : menace, tension, tempo, incitation au
mouvement (même source World of Level Design).

### 2.4 Game feel (Swink) et juice

Swink : le game feel est « le contrôle en temps réel d'objets virtuels dans un espace
simulé, avec des interactions soulignées par le polish », en trois briques : contrôle temps
réel, espace simulé, polish.
([Wikipedia — Game feel](https://en.wikipedia.org/wiki/Game_feel) ·
[Liz England — Review: Game Feel](https://lizengland.com/blog/review-game-feel-by-steve-swink/) ·
[Chapitre 1, PDF](https://www.scribd.com/document/611285692/Game-Feel-Steve-Swink-chapter-1))

Jonasson & Purho : « un jeu juicy semble vivant et répond à tout ce que tu fais : des tonnes
d'actions et de réponses en cascade pour un input minimal ».
([Juice it or lose it, vidéo](https://www.youtube.com/watch?v=Fy0aCDmgnxg) ·
[GDC Vault](https://www.gdcvault.com/play/1016487/Juice-It-or-Lose) ·
[Roblog résumé](https://roblog.co.uk/2024/03/juicy-games/))

Nijman (Vlambeer) : liste d'une trentaine de trucs, dont le **hit-stop** (geler le jeu 40 à
100 ms sur un impact lourd — « ça vend le poids mieux que n'importe quelle animation ») et
le screenshake **proportionné à l'événement** (« un pistolet ne secoue pas l'écran comme
une roquette »).
([The Art of Screenshake, vidéo](https://www.youtube.com/watch?v=AJdEqssNZ-U) ·
[Internet Archive](https://archive.org/details/the-art-of-screenshake) ·
[Dawnosaur — 7 Game Feel Tricks](https://dawnosaur.substack.com/p/7-game-feel-tricks-to-improve-your))

**Contrepoint sourcé, à garder en tête** : Game Developer a publié « Indies, resist the urge
to 'juice it or lose it' » — le juice ne sauve pas une mécanique creuse.
([lien](https://www.gamedeveloper.com/design/video-indies-resist-the-urge-to-juice-it-or-lose-it-))

### 2.5 Structure roguelite : méta-progression, longueur de run, variance

- **Le débat méta-progression est réel et documenté.** *Slay the Spire* « figure parmi les
  indés les mieux notés de l'histoire et n'a aucune méta-progression significative » : la
  progression y est horizontale (débloquer des cartes) et non verticale (gagner de la
  puissance), ce qui garde chaque run équilibré.
  ([Switchblade Gaming — Roguelike vs Roguelite](https://www.switchbladegaming.com/strategy-games/roguelike-vs-roguelite-explained/) ·
  [fil ResetEra](https://www.resetera.com/threads/im-starting-to-feel-that-stat-based-meta-progression-is-starting-to-ruin-roguelites-generally-speaking.1509337/page-2))
- **À l'inverse**, l'argument pro-méta est la mitigation de la perte : « perdre un run de
  45 minutes dans Hades 2 fait moins mal quand ta jauge vient d'augmenter et que tu as
  débloqué de nouvelles options d'Arcana ».
  ([Switchblade Gaming](https://www.switchbladegaming.com/strategy-games/roguelike-vs-roguelite-explained/))
- **Forcer l'engagement avec le système** : Giovannetti (Slay the Spire) sur le choix de ne
  pas laisser choisir ses cartes de départ — « on ne veut pas faire ça. On veut te forcer à
  t'engager avec le système et à essayer de nouvelles choses à chaque fois. »
  ([Maintainers Anonymous](https://maintainersanonymous.com/games/) ·
  [GDC — Metrics Driven Design and Balance](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics))

> **[opinion]** CORE est déjà du bon côté : la méta est **horizontale** (le Carnet débloque
> du contenu qui entre dans les tirages, pas des +5 % permanents). C'est exactement le
> modèle Slay the Spire, et il faut le protéger de la dérive vers des bonus de stats.

### 2.6 Rétention J1 / J7 — les ordres de grandeur

Benchmarks mobile 2024-2025 (GameAnalytics, 11 600 apps, 16 genres) :

| | Bottom 25 % | Médiane | Top 25 % |
|---|---|---|---|
| **D1** | 10–11,5 % | ~ | 26,5–27,7 % (iOS 31–33 %) |
| **D7** | ~1,5 % | 3,4–3,9 % | 7–8 % |

Les jeux d'arcade dominent la rétention court terme (D1) et s'effondrent en long terme ;
puzzle / board / cartes tiennent le D7-D30.
Sources : [GameAnalytics 2025 Mobile Gaming Benchmarks](https://www.gameanalytics.com/reports/2025-mobile-gaming-benchmarks) ·
[Segwise](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies) ·
[AppAgent](https://appagent.com/blog/mobile-game-retention-benchmarks/) ·
[GameDevReports](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks)
**Réserve honnête** : ces chiffres sont mobile F2P, et les tables par genre remontent en
grande partie à AppsFlyer Q3 2022 (signalé par [AppAgent](https://appagent.com/blog/mobile-game-retention-benchmarks/)).
**[opinion]** À transposer avec prudence pour un jeu PC/premium ; l'enseignement
transférable est structurel, pas numérique : **CORE est un profil « arcade »**, donc bon D1
naturel et D7 fragile. C'est le D7 qui doit être construit, et c'est précisément le rôle du
Carnet, du Daily et des paliers de Profondeur.

---

## 3. Addictif sans être malhonnête

### 3.1 Le repère académique

Zagal, Björk & Lewis (*Dark Patterns in the Design of Games*) classent les dark patterns en
trois familles : **temporels**, **monétaires**, **capital social**. Le **grinding** y est
défini comme « des tâches répétées ou fastidieuses qui *escroquent* le joueur de son
temps ». Le cadre est construit en traitant l'interaction système-joueur comme un contrat,
d'où l'on dérive des frontières éthiques.
([deceptive.design](https://deceptive.design/articles/dark-patterns-in-the-design-of-games/) ·
[PDF via CORE](https://core.ac.uk/reader/301007767) ·
[Semantic Scholar](https://www.semanticscholar.org/paper/Dark-patterns-in-the-design-of-games-Zagal-Bj%C3%B6rk/19a241378b06d868eb5f6b76027172c3aaca86f4))

### 3.2 Le repère motivationnel

Self-Determination Theory (Ryan, Rigby, Przybylski) : le moteur intrinsèque tient à trois
besoins — **autonomie, compétence, lien social**. L'autonomie et la compétence perçues sont
corrélées au plaisir, aux préférences et aux variations de bien-être avant/après jeu ; la
compétence perçue est liée au caractère intuitif des contrôles.
([Przybylski, Rigby & Ryan, PDF officiel SDT](https://selfdeterminationtheory.org/SDT/documents/2010_PrzybylskiRigbyRyan_ROGP.pdf) ·
[Motivational Pull of Video Games, Springer](https://link.springer.com/article/10.1007/s11031-006-9051-8) ·
[SDT in Digital Games, ResearchGate](https://www.researchgate.net/publication/303948263_Self-Determination_Theory_in_Digital_Games))

### 3.3 La ligne de partage, opérationnelle

**[opinion, mais dérivée des deux cadres ci-dessus]** Le même outil — récompense variable,
compteur de progression, palier « à une partie » — est honnête ou prédateur selon quatre
tests :

| Test | Boucle honnête | Mécanique prédatrice |
|---|---|---|
| **Où est le plaisir ?** | Dans l'acte lui-même (conduire, percer) ; la récompense souligne | Dans l'attente de la récompense ; l'acte est un péage |
| **Le coût est-il visible ?** | « 14/15 bidons » : borné, lisible, atteignable en une partie | Progression opaque, seuil qui recule |
| **Peut-on s'arrêter proprement ?** | Point d'arrêt naturel toutes les 30–50 s | Punir l'arrêt (énergie, appointment, streak qui casse) |
| **Le temps investi produit-il de la compétence ?** | Oui : on joue mieux | Non : on joue plus longtemps (= grinding au sens Zagal) |

CORE passe les quatre par construction : niveaux de 15–50 s, stations qui gèlent le chrono,
carnet à seuils affichés, et une courbe de progression qui est d'abord une courbe de skill
(pilotage, élan, lecture du terrain). **La seule dérive à surveiller** est de transformer le
Carnet en tapis roulant de +% : ce serait passer du modèle Slay the Spire au modèle
grinding.

---

## 4. Les erreurs classiques des jeux de minage qui échouent

Post-mortems et critiques récurrentes, croisés. Aucun de ces points n'est mon opinion :
chacun est un reproche documenté, adressé à un jeu nommé.

1. **Le trajet retour.** Super Motherload : « creuser puis remonter pour refaire le plein
   devient fastidieux »
   ([OpenCritic](https://opencritic.com/game/311/super-motherload/reviews)).
   SteamWorld Dig : « plus on descend, plus il faut de temps pour remonter »
   ([Nintendo Life](https://www.nintendolife.com/reviews/3ds-eshop/steamworld_dig)).
   Dome Keeper : « le transport des ressources au début est extrêmement lent et casse
   l'élan »
   ([Oortrain](https://www.oortrain.com/doomkeeper/how-good-is-dome-keeper)).
   **Trois jeux, trois notes différentes, exactement le même reproche.**
2. **La première heure est le pire moment.** SteamWorld Dig : « plusieurs coups par bloc
   avec la pioche de départ, progression lente et laborieuse »
   ([Destructoid](https://www.destructoid.com/reviews/review-steamworld-dig/)).
   Dome Keeper : « ça ne devient vraiment fun qu'après quelques upgrades »
   ([Metacritic user reviews](https://www.metacritic.com/game/dome-keeper/user-reviews/)).
3. **La convergence des builds.** Dome Keeper : « la rejouabilité est faible parce que
   chaque run se ressemble : on priorise les mêmes améliorations »
   ([Oortrain](https://www.oortrain.com/doomkeeper/how-good-is-dome-keeper)).
4. **Aucune nouveauté matérielle en profondeur.** Super Motherload : « aucun minerai inédit
   dans les différentes couches — les mêmes minerais sur tout le jeu »
   ([3rd-strike](https://3rd-strike.com/super-motherload-review/)).
5. **Le forage sans poids.** Super Motherload : « le forage semble sans poids, les blocs
   disparaissent simplement sans animation »
   ([3rd-strike](https://3rd-strike.com/super-motherload-review/)).
6. **La difficulté qui bascule d'obstacle à péage.** Super Motherload : « les niveaux
   profonds deviennent fastidieux, quantités croissantes de blocs de danger qui exigent des
   bombes, on ne peut plus creuser librement son propre chemin »
   ([OpenCritic](https://opencritic.com/game/311/super-motherload/reviews)).
7. **Pas de destination.** Miner Dig Deep : « il y a un sentiment de progrès, mais aucun
   objectif final, et le jeu semble n'avoir aucun point d'arrivée »
   ([RotoRob](https://videogamerrob.wordpress.com/2011/04/07/xblig-review-miner-dig-deep/)).
8. **Le plafond de contenu réel se situe entre 4 et 15 h** pour un jeu de minage
   roguelite : Dome Keeper est jugé répétitif « au bout de 4 h » par certains, « au bout de
   10–15 h sans plus de contenu » par d'autres
   ([Oortrain](https://www.oortrain.com/doomkeeper/how-good-is-dome-keeper) ·
   [Gideon's Gaming](https://gideonsgaming.com/dome-keeper-review/)).

**Sur les post-mortems formels : résultat négatif honnête.** Les recherches ciblées sur des
post-mortems d'indés de minage n'ont produit que des cas mineurs (un jeu de minage cosy,
*Money Mines*, dont le développeur a suspendu le développement faute de traction —
[itch.io](https://makerofgames.itch.io/money-mines/community)) et des retours de game jam.
Les seuls post-mortems structurés du genre trouvés sont ceux de SteamWorld Dig
([GDC Vault](https://www.gdcvault.com/play/1020909/SteamWorld-Dig-Postmortem-How-to)) et
l'article Dome Keeper de Game Developer, tous deux inaccessibles en lecture directe depuis
cette session. **Les critiques Steam/Metacritic ci-dessus sont donc la meilleure source
disponible ici, et elles sont convergentes.**

---

## 5. Mécaniques transférables à CORE

Chaque entrée : **d'où ça vient** → **pourquoi ça marche** → **adaptation concrète** →
**coût**. Tri par rapport impact/effort décroissant. Rien de ce qui est déjà implémenté
n'apparaît.

### A. Compteur de continuité visible et récompensé (« Veine »)

- **Origine.** Downwell : le combo n'existe que tant qu'on ne touche pas le sol ; il donne
  gemmes, munitions, vie ; il apprend au joueur que « tomber en continu est la bonne façon
  de jouer », et il est **facultatif**
  ([Let's Make a Game](https://letsmakeagame.net/downwell-design-review/) ·
  [Downwell Wikia](https://downwell.fandom.com/wiki/Combos)).
  Mr. Driller : 10 pts par bloc isolé, 40 pts en chaîne
  ([Grokipedia](https://grokipedia.com/page/Mr._Driller)).
- **Pourquoi.** CORE a l'élan (un chiffre interne qui modifie la vitesse) mais pas de
  **compteur affiché que le joueur essaie de ne pas casser**. La différence est énorme :
  l'élan est une conséquence, un combo est un objectif.
- **Adaptation.** Compteur « Veine ×N » incrémenté par bloc percé sans changement de
  direction ni arrêt ; il se casse en s'arrêtant ou en heurtant l'indestructible, **pas** en
  entrant dans une caverne ni en ramassant (règle « bulle de boutique » de Downwell).
  Paliers ×10/×25/×50 → carburant, or, ou 1 s retirée du chrono. Affiché gros, sous le
  chrono.
- **Coût.** Faible. Un compteur, trois seuils, un son montant. Aucun nouveau système.

### B. Tentation géographique : la ressource est dans l'endroit dangereux

- **Origine.** Mr. Driller : les capsules d'air sont entourées de blocs X qui coûtent 20 %
  d'air ([Blocks Wiki](https://mrdriller.fandom.com/wiki/Blocks)) ; « pour toutes les
  prendre il faut souvent se mettre en danger »
  ([HonestGamers](https://www.honestgamers.com/2508/dreamcast/mr-driller/review.html)).
  Boulder Dash : gemmes « à des endroits qui demandent de la planification, souvent en
  utilisant la physique des rochers »
  ([Wireframe #30](https://www.raspberrypi.com/news/code-a-boulder-dash-mining-game-wireframe-30/)).
- **Pourquoi.** C'est la règle de placement, pas la règle de système, qui crée la décision.
  Un bidon posé sur le chemin ne vaut rien ; le même bidon sous une masse non soutenue vaut
  une décision par seconde.
- **Adaptation.** Règle de génération : **au moins un bidon et un ingrédient d'explosif par
  niveau doivent être sous une masse instable, derrière de l'indestructible, ou en position
  qui coûte de la Faille.** Zéro nouveau système : c'est du placement.
- **Coût.** Très faible (générateur). Impact très élevé. **[opinion] C'est le meilleur ratio
  de toute cette liste.**

### C. L'effondrement comme outil, pas seulement comme sanction

- **Origine.** Dig Dug : écraser plusieurs ennemis d'un rocher rapporte bien plus que la
  pompe ([StrategyWiki](https://strategywiki.org/wiki/Dig_Dug/Gameplay)) ; « préparer des
  pièges à rochers rend la construction de tunnels stratégique »
  ([The Game Hoard](https://thegamehoard.com/2020/01/26/dig-dug-arcade/)).
  DRG : faire s'effondrer des stalagmites et fermer des goulets « pour se faciliter le
  travail » ([Steam](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/)).
- **Pourquoi.** CORE a la physique d'effondrement mais elle n'a qu'un signe : négatif. Une
  mécanique qui ne peut que punir est apprise une fois puis évitée à vie ; une mécanique à
  double signe est rejouée indéfiniment.
- **Adaptation.** Deux règles :
  (1) **Puits gratuit** — une colonne effondrée laisse un tunnel roulable, donc de la
  vitesse gratuite et zéro carburant (cohérent avec la règle « les explosifs ne consomment
  pas de carburant » de v4 §3).
  (2) **Bouchon** — un effondrement au-dessus de soi **retarde la Faille de X secondes**
  sur cette colonne. Sacrifier le retour en arrière pour gagner du temps : c'est la
  décision la plus intéressante que CORE puisse offrir.
- **Coût.** Moyen (règles de propagation + UI de feedback). Impact très élevé.

### D. Le climax : la remontée / la fuite finale

- **Origine.** DRG : la mission n'est pas finie à l'objectif, elle est finie à l'extraction
  sous chrono ([DRG Wiki — Missions](https://deeprockgalactic.wiki.gg/wiki/Missions)).
  Miner Dig Deep meurt de l'inverse : « aucun objectif final, aucun point d'arrivée »
  ([RotoRob](https://videogamerrob.wordpress.com/2011/04/07/xblig-review-miner-dig-deep/)).
- **Pourquoi.** Le carnet donne le « encore une » ; seul un climax donne le « il faut que je
  refasse ça » — c'est déjà le diagnostic de `v4-retention.md` §4, et il est corroboré par
  DRG et Miner Dig Deep.
- **Adaptation.** Exactement la piste 1 de v4 §4 : Faille à vitesse maximale, roche qui
  s'ouvre, 20 s de chute en lumière blanche. **Ajout par rapport à v4** : ne pas la garder
  pour la toute fin. DRG met un climax **à chaque mission**. Mettre une micro-fuite de 5 s
  à chaque **Sceau** (fin de couche) — Faille ×3 pendant les 5 dernières secondes après la
  perce — donne 6 climax au lieu d'un, pour un coût quasi nul une fois le système écrit.
- **Coût.** Moyen-élevé pour le Cœur, faible pour la micro-fuite de Sceau.

### E. Modificateurs de run et de couche (variance structurelle)

- **Origine.** Dome Keeper : gadget principal choisi au départ, 22 gadgets secondaires,
  2 dômes, planètes à paysages/palettes/ennemis mixables, modificateurs
  ([Gadgets Wiki](https://domekeeper.wiki.gg/wiki/Gadgets) ·
  [Modifiers](https://dome-keeper.fandom.com/wiki/Modifiers) ·
  [Indiecator](https://indiecator.org/2024/11/29/indietail-dome-keeper/)).
  Et le reproche inverse quand ça ne suffit pas : « on priorise les mêmes améliorations »
  ([Oortrain](https://www.oortrain.com/doomkeeper/how-good-is-dome-keeper)).
- **Pourquoi.** La variance de CORE est aujourd'hui dans le tirage des passifs, donc
  **en aval** de la décision : le joueur subit sa variance. Un modificateur annoncé **en
  amont** change la façon dont il joue tout le niveau.
- **Adaptation.** Un **modificateur de couche** tiré et annoncé à la station, visible sur la
  carte : *Pluie de gravats* (effondrements plus fréquents), *Filon riche* (veines ×2, roche
  +20 % de dureté), *Faille impatiente* (Faille +30 %, or ×1,5), *Poches sèches* (moitié
  moins de bidons, carburant de départ ×1,5). 6–8 modificateurs suffisent à décorréler les
  runs.
- **Coût.** Faible à moyen : ce sont des multiplicateurs sur des paramètres qui existent
  déjà dans `config.js`.

### F. La loi de distribution des veines (renforcement variable propre)

- **Origine.** Terraria : mêmes types de minerai par profondeur, mais « la génération de
  chaque veine est fortement randomisée »
  ([Terraria Wiki](https://terraria.wiki.gg/wiki/Ores)), veines plus grandes en profondeur
  ([Carl's Guides](https://www.carlsguides.com/terraria/mining/)).
  Cadre théorique : le ratio variable est le schéma le plus résistant à l'extinction
  ([Simply Psychology](https://www.simplypsychology.org/schedules-of-reinforcement.html)) et
  la dopamine culmine sur l'anticipation incertaine
  ([Neurolaunch](https://neurolaunch.com/variable-reward-psychology/)).
- **Pourquoi.** C'est le renforcement variable **honnête** : l'incertitude porte sur
  l'ampleur d'une chose sûre, pas sur l'existence d'une chose promise. Le joueur n'est jamais
  privé, il est parfois surpris.
- **Adaptation.** Remplacer une taille de veine à peu près constante par une loi à queue
  longue : 70 % de veines petites, 25 % moyennes, 5 % de filon-mère qui vaut à lui seul 3
  veines. Idem pour les ingrédients d'explosif.
- **Coût.** Très faible (une table de probabilités). Impact moyen-élevé, durable.

### G. Le Défi du jour

- **Origine.** Spelunky : une tentative par jour, graine mondiale identique, pas de retry ;
  « un seul faux pas coûte toute la journée » ; a transformé un jeu solo en expérience
  compétitive
  ([Game Developer](https://www.gamedeveloper.com/design/the-understated-genius-of-the-i-spelunky-i-daily-challenge) ·
  [spelunkyworld](https://spelunkyworld.com/dailychallenge/)).
- **Pourquoi.** C'est un mécanisme de **D7**, pas de D1 — exactement le point faible
  structurel d'un jeu au profil arcade
  ([GameAnalytics](https://www.gameanalytics.com/reports/2025-mobile-gaming-benchmarks)).
  Et c'est honnête au sens de Zagal : une tentative, bornée, sans coût, sans punition de
  l'absence.
- **Adaptation.** Déjà prévu en V2 du GDD. Version minimale sans serveur : graine dérivée de
  la date, historique local, tableau des 30 derniers jours. Le classement en ligne peut
  venir plus tard sans rien changer.
- **Coût.** Faible sans classement, moyen avec. **Attention** : ne pas y mettre de streak
  punitive — ce serait un dark pattern temporel au sens de Zagal
  ([deceptive.design](https://deceptive.design/articles/dark-patterns-in-the-design-of-games/)).

### H. Le second étage de maîtrise (objectifs secondaires par niveau)

- **Origine.** Mr. Driller : « un game design en surface, et le vrai jeu caché juste en
  dessous — pour dominer le classement il faut le faire sans perdre de vie et avoir ramassé
  chaque capsule »
  ([Games From The Black Hole](https://gamesfromtheblackhole.wordpress.com/2021/11/21/mr-driller/)).
  Downwell : le combo « ajoute un défi pour ceux qui veulent jouer vite, sans jamais être
  nécessaire »
  ([Let's Make a Game](https://letsmakeagame.net/downwell-design-review/)).
- **Pourquoi.** Fournit la progression de **compétence** (au sens SDT :
  [Przybylski/Rigby/Ryan](https://selfdeterminationtheory.org/SDT/documents/2010_PrzybylskiRigbyRyan_ROGP.pdf))
  au joueur qui a déjà fini le jeu, sans ajouter une ligne de contenu.
- **Adaptation.** Sur chaque niveau, en plus de la médaille de temps : 2 rubans (intégrité
  intacte · tous les bidons du niveau). Affichés sur la carte de la planète. Ils ne
  débloquent rien de puissant — c'est le point.
- **Coût.** Très faible.

### I. La montée en régime perceptible du forage

- **Origine.** Drill Dozer : régimes de foret + vibration qui s'intensifie, « retour tactile
  instantané, très utile, sans parler du plaisir »
  ([GameSpot](https://www.gamespot.com/reviews/drill-dozer-review/1900-6143274/) ·
  [SuperPhillip Central](https://www.superphillipcentral.com/2015/12/drill-dozer-gba-retro-review.html)).
  Swink : contrôle temps réel + polish
  ([Game feel](https://en.wikipedia.org/wiki/Game_feel)).
  Nijman : hit-stop de 40–100 ms sur impact lourd, screenshake proportionné
  ([Art of Screenshake](https://www.youtube.com/watch?v=AJdEqssNZ-U)).
  Contre-exemple sourcé : Super Motherload, « forage sans poids, blocs qui disparaissent
  sans animation » ([3rd-strike](https://3rd-strike.com/super-motherload-review/)).
- **Adaptation.** L'élan de CORE doit être **audible et visible avant d'être efficace** :
  hauteur du son de forage qui monte avec l'élan, poussière qui s'allonge, hit-stop de 60 ms
  sur le dernier coup d'un bloc dur, screenshake calibré sur la dureté du bloc et non
  constant, ding montant sur minerais consécutifs (mécanique pavlovienne documentée dans
  PowerWash Simulator :
  [Galaxus](https://www.galaxus.at/en/page/powerwash-simulator-and-many-more-why-we-like-boring-busywork-in-our-games-40050)).
- **Coût.** Faible. **Réserve** : Game Developer publie aussi l'avertissement inverse
  (« résistez à l'envie de juicer »,
  [lien](https://www.gamedeveloper.com/design/video-indies-resist-the-urge-to-juice-it-or-lose-it-)) —
  le juice amplifie une bonne mécanique, il n'en crée pas.

### J. Discipline de pacing : jamais deux niveaux de même intensité de suite

- **Origine.** Dome Keeper : pression **périodique et annoncée**, musique clairsemée en
  phase de minage « pour rester une friandise », absence de musique en combat pour ne pas
  diluer la tension ([indiegame.com](https://indiegame.com/en/archives/31688)).
  Théorie du pacing : « les creux sont aussi importants que les pics », trop de pics
  épuisent
  ([World of Level Design](https://www.worldofleveldesign.com/categories/wold-members-tutorials/peteellis/level-design-pacing-gameplay-beats-part2.php)).
- **Adaptation.** Contrainte formelle sur l'ordre des 14 niveaux : après tout niveau à haute
  pression (Effondrement, Sceau), le suivant est un niveau à basse pression (Chute,
  Gisement large). Écrire la courbe d'intensité cible des 14 niveaux dans un tableau, et
  vérifier chaque variante contre elle. Sur la bande son : couches qui s'ajoutent avec
  l'élan (déjà au GDD) **plus** un silence total les 3 s avant l'arrivée de la Faille.
- **Coût.** Nul en code, tout en décision. Impact élevé.

### K. Ce qu'il ne faut surtout PAS ajouter

- **Aucun trajet retour, jamais.** Trois jeux du corpus s'en font reprocher
  ([Super Motherload](https://opencritic.com/game/311/super-motherload/reviews),
  [SteamWorld Dig](https://www.nintendolife.com/reviews/3ds-eshop/steamworld_dig),
  [Dome Keeper](https://www.oortrain.com/doomkeeper/how-good-is-dome-keeper)). C'est
  l'avantage structurel n°1 de CORE : le protéger vaut plus que n'importe quel ajout.
- **Aucun passif ou déblocage en +% de stat permanent hors run.** Voir Slay the Spire
  ([Switchblade](https://www.switchbladegaming.com/strategy-games/roguelike-vs-roguelite-explained/))
  et le débat ResetEra
  ([lien](https://www.resetera.com/threads/im-starting-to-feel-that-stat-based-meta-progression-is-starting-to-ruin-roguelites-generally-speaking.1509337/page-2)).
  Le Carnet doit rester horizontal.
- **Aucune zone où le forage libre devient impossible.** Reproche explicite fait à Super
  Motherload en profondeur
  ([OpenCritic](https://opencritic.com/game/311/super-motherload/reviews)). Cohérent avec la
  règle du GDD : « il y a toujours un autre chemin ».
- **Aucun streak / connexion quotidienne punitive** — dark pattern temporel au sens de
  Zagal ([deceptive.design](https://deceptive.design/articles/dark-patterns-in-the-design-of-games/)).

---

## 6. Les 8 recommandations, classées impact / effort

1. **Placer les ressources dans le danger** (bidon, ingrédient : sous une masse instable,
   derrière l'indestructible, ou à contre-Faille). Règle de génération, zéro système neuf.
   Source : Mr. Driller, capsules d'air cernées de blocs X à −20 % d'air —
   [Blocks Wiki](https://mrdriller.fandom.com/wiki/Blocks).

2. **Compteur « Veine ×N » affiché, cassé par l'arrêt, jamais par la respiration.**
   Paliers ×10/×25/×50 payés en carburant, or ou secondes. Facultatif pour finir le jeu.
   Source : combo Downwell, qui enseigne le bon style sans tutoriel —
   [Let's Make a Game](https://letsmakeagame.net/downwell-design-review/).

3. **Micro-fuite de 5 s à chaque Sceau** (Faille ×3 après la perce), avant même de coder le
   Cœur. Six climax pour le prix d'un.
   Source : structure de mission DRG, l'extraction sous chrono —
   [DRG Wiki](https://deeprockgalactic.wiki.gg/wiki/Missions).

4. **Loi de distribution à queue longue sur les veines** (70/25/5, le filon-mère vaut 3
   veines). Une table de probabilités.
   Source : Terraria, veines fortement randomisées —
   [Terraria Wiki](https://terraria.wiki.gg/wiki/Ores) ; et le ratio variable comme schéma
   le plus résistant à l'extinction —
   [Simply Psychology](https://www.simplypsychology.org/schedules-of-reinforcement.html).

5. **Courbe d'intensité écrite pour les 14 niveaux**, jamais deux pics consécutifs, plus 3 s
   de silence total avant l'arrivée de la Faille. Aucun code, que de la décision.
   Source : « les creux sont aussi importants que les pics » —
   [World of Level Design](https://www.worldofleveldesign.com/categories/wold-members-tutorials/peteellis/level-design-pacing-gameplay-beats-part2.php)
   et le retrait de la musique de combat dans Dome Keeper —
   [interview Bippinbits](https://indiegame.com/en/archives/31688).

6. **Rendre l'élan sensoriel avant de le rendre efficace** : pitch montant, hit-stop 60 ms
   sur le coup final d'un bloc dur, screenshake proportionné à la dureté.
   Source : Nijman, *The Art of Screenshake* —
   [vidéo](https://www.youtube.com/watch?v=AJdEqssNZ-U) ; contre-exemple : « forage sans
   poids » de Super Motherload — [3rd-strike](https://3rd-strike.com/super-motherload-review/).

7. **Modificateur de couche annoncé à la station** (6–8 variantes, multiplicateurs sur des
   paramètres existants) pour casser la convergence des builds.
   Source : Dome Keeper, gadget de départ + modificateurs —
   [Wiki](https://domekeeper.wiki.gg/wiki/Gadgets) ; et le reproche inverse « on priorise
   toujours les mêmes upgrades » — [Oortrain](https://www.oortrain.com/doomkeeper/how-good-is-dome-keeper).

8. **Effondrement à double signe** : puits roulable gratuit, et bouchon qui retarde la
   Faille sur sa colonne. Le seul ajout à effort moyen de cette liste, et le plus profond.
   Source : Dig Dug, le rocher comme arme plus payante que la pompe —
   [StrategyWiki](https://strategywiki.org/wiki/Dig_Dug/Gameplay) ; DRG, effondrer pour
   fermer un goulet — [Steam](https://store.steampowered.com/app/548430/Deep_Rock_Galactic/).

**Hors classement, à coût nul : les trois interdits.** Pas de trajet retour, pas de méta en
+% de stat, pas de zone où le forage libre est impossible. Chacun est un reproche
documenté adressé à un jeu du corpus (§4, points 1, 6 et §2.5).

---

## Annexe — sources non lues intégralement (proxy)

À ouvrir directement, elles contiennent le matériau le plus dense du sujet :

- [Game Design Deep Dive: The digging mechanic in SteamWorld Dig](https://www.gamedeveloper.com/design/game-design-deep-dive-the-digging-mechanic-in-i-steamworld-dig-i-)
- [SteamWorld Dig Postmortem — GDC Vault](https://www.gdcvault.com/play/1020909/SteamWorld-Dig-Postmortem-How-to)
- [How Dome Keeper focuses on systems that feed into one another](https://www.gamedeveloper.com/business/how-dome-keeper-focuses-on-systems-that-feed-into-one-another)
- [Downwell Design Analysis — Game Developer](https://www.gamedeveloper.com/design/downwell-design-analysis)
- [The understated genius of the Spelunky Daily Challenge](https://www.gamedeveloper.com/design/the-understated-genius-of-the-i-spelunky-i-daily-challenge)
- [A Spelunky Game Design Analysis Pt. 2](https://www.gamedeveloper.com/design/a-spelunky-game-design-analysis---pt-2)
- [Slay the Spire: Metrics Driven Design and Balance — GDC Vault](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics)
- [Zagal, Björk & Lewis — Dark Patterns in the Design of Games (PDF)](https://core.ac.uk/reader/301007767)
- [Jenova Chen — Flow in Games (PDF)](https://www.jenovachen.com/flowingames/Flow_in_games_final.pdf)
- [GameAnalytics — 2025 Mobile Gaming Benchmarks](https://www.gameanalytics.com/reports/2025-mobile-gaming-benchmarks)
