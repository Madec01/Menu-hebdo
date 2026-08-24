# Cadence

Jeu de gestion d'usine agroalimentaire, en navigateur. On démarre seul dans un
hangar à éplucher des pommes de terre, et on regarde la ligne grandir.

**Le jeu tient dans un seul fichier : [`cadence.html`](cadence.html).**
Double-clic pour jouer. Aucune installation, aucune dépendance, aucun réseau —
il fonctionne hors ligne.

---

## La chaîne

```
pommes de terre  ──▶ LAVEUSE-ÉPLUCHEUSE ──▶ TRANCHEUSE ──▶ FRITEUSE ──▶ chips
                        30 kg → 25 kg       en rondelles    + huile
                                                       4 kg de rondelles = 1 kg

chips ──▶ TAMBOUR D'ASSAISONNEMENT ──▶ ENSACHEUSE ──▶ sachets de 125 g
             + sel + arôme                + film
```

Il faut environ 4,8 kg de pommes de terre pour 1 kg de chips. Le rendement
matière est le premier levier du jeu : tout ce qui part à l'eau ou en vapeur
est payé et jamais vendu.

Tout ce qui se transforme est en **kilos**, comme dans le métier ; seuls les
sachets se comptent à l'unité.

## Commandes

| Action | Comment |
|---|---|
| Poser une machine | La choisir en bas, puis clic gauche sur la grille |
| Tourner une machine | `R` avant de poser |
| Tracer un convoyeur | Clic gauche maintenu, de la machine de départ à celle d'arrivée |
| Sélectionner | Clic gauche sur une machine, un convoyeur ou le quai |
| Démolir | Clic droit sur l'élément, ou l'outil Démolir (rendu 60 %) |
| Se déplacer | Clic droit glissé, ou les flèches |
| Zoomer | Molette (`+` / `−` au clavier) |
| Pause | `Espace` · vitesses `1` `2` `3` |
| Couper le son | `M` |
| Demander conseil | Clic sur le contremaître, en bas à gauche |
| Tout savoir | Onglet **Guide**, dans le panneau de droite |
| Statistiques | <kbd>S</kbd>, ou l'icône ▤ en haut à droite |
| Recherche (âge 4) | <kbd>R</kbd>, ou l'icône ✦ en haut à droite |
| Masquer la cadence | <kbd>C</kbd> |
| Outils de développement | <kbd>F2</kbd> |

## Ce qui est construit

**Lot 1 — Noyau jouable** et **Lot 2 — La chaîne**, en entier :

- Grille, caméra, zoom continu, vue schématique au dézoom
- Moteur de flux à pas fixe (4 Hz), rendu interpolé à 60 fps
- Trois postes de départ (laveuse-éplucheuse, trancheuse, friteuse), puis
  tambour d'assaisonnement, ensacheuse et bacs de stockage
- **Deux quais dès le départ** : l'entrée à gauche pour ce qu'on achète, la
  sortie à droite pour ce qu'on vend. Chaque marchandise sait où elle va. Les
  deux s'agrandissent contre espèces, et le quai d'entrée ne bouge jamais quand
  l'atelier grandit — ce qui y est raccordé le reste.
- **Trois rangements** : le bac de stockage prend tout en vrac, le **bac dédié**
  (âge 3) ne prend qu'une marchandise mais en tient deux fois et demie plus, et
  le **silo** (âge 4) tient une saison entière. Un bac dédié se règle sur la
  première marchandise reçue, ou à la main.
- **Filtre de convoyeur** : quand un poste sort deux choses — la friteuse et son
  rebut — on dit à chaque bande ce qu'elle emporte.
- **Se brancher ou croiser** : un interrupteur à côté de l'outil Convoyeur
  (touche <kbd>X</kbd>) décide de ce qui arrive quand un tracé rencontre une
  bande existante — il la contourne, ou il l'enjambe sur une passerelle. Un
  croisement ne relie jamais rien : c'est là où l'on s'arrête qui fait le
  raccord. La tuile reste à la bande du dessous, et un pont dont on démolit le
  dessous redescend tout seul.
- **Le réapprovisionnement, en quatre phrases** : dès qu'il en reste moins de
  tant, en faire livrer tant, sans jamais dépasser tant, et jamais au-dessus de
  tel prix. Le plafond évite le stock dormant, le prix maximum laisse passer les
  coups de chaud du marché. Chaque matière affiche son **autonomie en jours**, et
  « Régler sur la consommation » cale tout d'un coup. L'automatique ne met jamais
  la maison en faillite.
- **Affecter tout le monde** d'un bouton : chacun sur le poste où il est le
  meilleur, sans traverser l'atelier, une machine par personne ; le reste passe
  au portage.
- **La sortie d'une recette est un moment** : quand l'étude aboutit, tout
  s'arrête et l'écran montre la note, ce qu'en disent les gens, les pistes pour
  la suite — et un bouton qui met la recette en production sur les ensacheuses
  dans la foulée.
- Convoyeurs en **réseau**, d'**une seule tuile ou de cinquante** : les bandes se branchent les unes aux autres, on
  bâtit un trajet par tronçons et plusieurs bandes peuvent converger vers un
  même poste. Elles se dessinent jointives — une bande touche sa voisine et la
  machine qu'elle alimente, la marchandise circule sans rupture. Latence,
  bouchons, chevrons de sens. Une bande ne prend que ce que son aval finira
  par consommer.
- **Cadence et rendement en direct**, en surimpression sur l'atelier : ce que
  la ligne sort par seconde, et combien de kilos de pommes de terre il faut
  réellement pour un kilo de chips vendables (la recette en demande 4,8 ; tout
  ce qui dépasse est du gâchis ou de l'en-cours).
- **Réapprovisionnement programmable** : pour chaque matière, le seuil de
  déclenchement et la taille du lot se règlent, avec le rappel de ce que
  l'atelier consomme par jour et de ce que le lot coûtera.
- Ouvriers simulés individuellement : déplacement A\*, portage au bac roulant,
  tenue de poste, fatigue, moral, compétences qui montent, embauche et
  démission. Un ouvrier lâche son poste quand un poste en aval crie famine.
- Trésorerie complète (salaires, loyer, électricité, emprunts, découvert,
  dépôt de bilan), marché des matières fluctuant, commandes avec délai et
  pénalité de retard, réputation, vente du surplus aux commerces du coin
- Phase de décision du vendredi soir : bilan, graphique, 4 décisions maximum,
  jauge d'objectif
- Le contremaître, qui porte tout le didacticiel et tout le diagnostic
- Un **onglet Guide** : schéma de la chaîne, fiche de chaque recette, prix de
  revient matière par produit, tableau des machines, et dix sections
  dépliables sur les mécaniques (le temps, l'argent, les commandes, l'équipe,
  les convoyeurs, l'entretien, la lecture visuelle de l'usine, la sauvegarde,
  les raccourcis). Tout y est **calculé depuis les données** : recettes,
  rendements et prix de revient ne peuvent pas se désynchroniser de
  l'équilibrage réel. Ce qui n'est pas encore débloqué reste masqué, avec une
  case à cocher pour l'afficher quand même.
- Usure, pannes, révision · saleté de l'atelier et nettoyage
- **La qualité** (âge 3) : une part de la production part au rebut, d'autant
  plus grande que l'huile fatigue, que l'atelier est sale, que la machine est
  usée ou que la personne au poste débute. Le bain d'huile se refait (coût et
  immobilisation) et fonce visiblement en vieillissant. La marchandise ratée
  ne se vend pas : laissée sur le quai, elle part mélangée aux livraisons et
  le client réclame. La **table de tri** l'écarte.
- **Quatre modes de partie**, choisis à l'écran-titre et changeables en cours
  de partie : *Partie normale*, *Tranquille* (ni dépôt de bilan ni pénalités),
  *Exigeant* (matériel fragile, marché nerveux, pas de vente au comptant) et
  *Bac à sable* (argent illimité, tout débloqué, construction gratuite).
- **Un écran de statistiques** : résultat semaine par semaine, production par
  produit, part partie au rebut, répartition des dépenses et palmarès des
  clients. Les graphiques réagissent au survol et n'utilisent jamais la couleur
  seule pour porter une information.
- **Des outils de développement** (<kbd>F2</kbd>) : sauter à n'importe quel âge,
  changer de mode, remplir le quai, user ou réviser le matériel, avancer d'une
  semaine, et lancer les **auto-vérifications** de la partie.
- **La marque, et trois jauges qui se contredisent** : la *notoriété* (combien
  de gens vous connaissent), la *confiance* (est-ce qu'on peut compter sur vous)
  et le *standing* (bas ou haut de gamme). Le standing suit le sachet, le logo
  et surtout le prix auquel on vend — et il met des semaines à bouger.
- **Cinq marchés qui lisent ces jauges chacun à leur façon** : le coin, la
  région, le national, l'épicerie fine, l'export. L'épicerie fine veut du
  standing ; la centrale d'achat veut du volume et **se ferme si la marque est
  trop chic**. On ne peut pas être les deux, et c'est tout le jeu. Un marché
  fermé dit toujours ce qui lui manque, un marché ouvert ce qu'il paie.
- **Des clients qui se souviennent** : livré à l'heure et sans réclamation
  plusieurs fois de suite, un client devient fidèle — il revient plus souvent,
  commande plus gros, paie mieux. Déçu deux fois, il part chez le concurrent et
  ne repropose rien pendant six semaines. La régularité vaut mieux que la
  puissance.
- **Trois cadres** — commercial, responsable qualité, directeur marketing. Chacun
  occupe un bureau d'études, donc en embaucher un ralentit la recherche, et
  chacun coûte son salaire tous les jours.
- **Un concurrent qui réagit** : une marque rivale, avec son nom et son sachet,
  se partage le rayon avec vous. Ce que vous n'y prenez pas, elle le prend —
  moins de propositions de commande, et les commerces du coin paient moins bien.
  Elle se démarque : montez en gamme, elle descend vers le volume ; bradez, elle
  passe au-dessus. Et elle fait ses coups — campagne radio, rappel de lot,
  linéaire gagné.
- **Quatre labels qui ne s'achètent pas, qui se tiennent** : atelier certifié,
  zéro gaspillage, huile fraîche garantie, fabriqué ici. Chacun impose une
  condition dans l'atelier, tenue plusieurs semaines de suite ; c'est ensuite le
  joueur qui fait venir l'auditeur et paie. Et le label se perd le jour où la
  condition lâche. Sans **Atelier certifié**, l'export reste fermé — ce qui fait
  du ménage et de l'entretien autre chose qu'une corvée.
- **Le nom, le logo et le sachet** se dessinent dans l'onglet Marque : huit
  logos tracés au code, huit fonds, six motifs, quatre styles de nom, deux
  couleurs. Le tout est **peint en grand sur le mur de l'atelier** — l'usine
  devient la vôtre.
- **Un garde-manger de 97 ingrédients** répartis sur **sept axes** (le goût, la
  coupe, la cuisson, la texture, le sel, la touche en plus, le sachet) et **91
  accords** entre eux. Presque tout est fermé au départ : un ingrédient s'ouvre
  parce que la maison s'est fait un nom, parce qu'elle a sorti tant de recettes,
  parce qu'elle en a osé une d'un certain genre, ou parce qu'elle en a réussi
  une. Le labo liste en permanence ce qui reste à débloquer, avec la condition
  et où on en est — jamais de verrou muet. Et le farfelu n'est pas une
  décoration : la sardine, la barbe à papa ou la fourmi citronnée notent bas
  posées au hasard et très haut bien mariées (la sardine au feu de bois, la
  tarte au citron avec de la poudre pétillante, le cassoulet en seau à
  partager). C'est un pari, et on ne le gagne qu'en essayant.
- **La recherche** (âge 4), dans l'onglet **Labo** : on compose une recette maison en mélangeant cinq
  axes (le goût, la coupe, la cuisson, le sel, le format du sachet). L'étude
  coûte et prend des jours. À la sortie, le public tranche : une note, des avis
  de consommateurs qui pointent chacun une décision, et des pistes
  d'amélioration. La recette devient une **vraie matière** avec sa recette
  d'ensachage ; son prix découle de sa note, et la notoriété de la maison tire
  les prix vers le haut. Certains mariages marchent, d'autres non — le joueur
  les découvre en essayant, et le contremaître s'en souvient. Une **mode du
  marché** tourne toutes les six semaines.
- **Une cour tout autour de l'atelier** : le terrain déborde les murs d'une
  bande de cinq tuiles, et c'est de la nature — pelouse tondue, arbres vus du
  dessus, haie le long de la clôture, allée de gravier au pied des murs. Le
  seul enrobé est celui qui sert : le parvis de chaque quai et la voie que
  prennent les camions jusqu'au portail. Le décor est tiré d'un bruit
  déterministe, calculé une fois dans une image, et refait seulement quand la
  cour change — rien n'est dessiné par image. Les machines et les convoyeurs restent à
  l'intérieur ; **les bâtiments se posent dehors, et seulement dehors**. Le mur
  est la frontière, et le jeu explique son refus au lieu de le subir. L'atelier
  a **quatre portes**, une par façade : les ouvriers ne traversent pas les
  murs, ils sortent par là — une salle plantée à l'opposé de la porte la plus
  proche, c'est de la marche perdue à chaque pause. Quand on pousse le mur, la
  cour recule devant lui et les bâtiments de ce côté suivent : aucun n'est
  jamais avalé.
- **Trois bâtiments qui ne fabriquent rien** mais changent l'atelier, posés
  dans la cour depuis la catégorie « Bâtiments » :
  - la **salle de pause** (âge 2) — un ouvrier à bout va vraiment s'y asseoir
    et y récupère sept fois plus vite qu'affalé contre un mur ; sa seule
    présence remonte le moral de toute l'équipe ;
  - la **salle de formation** (âge 3) — on envoie quelqu'un se former sur une
    compétence précise : il quitte son poste six jours durant, et revient
    nettement meilleur ;
  - le **bureau d'études** (âge 4) — sans lui, pas de recherche. Chaque bureau
    supplémentaire fait avancer l'étude en cours d'une journée de plus par
    jour.
- **La paie** : les primes se versent au cas par cas ou à toute l'équipe d'un
  coup — de l'argent tout de suite contre du moral tout de suite, à arbitrer
  contre l'augmentation, qui coûte tous les jours.
- **Les gros clients** (âge 3) : centrales d'achat, gros volumes, prix serrés
  et **paiement à 30 jours** — on avance la matière et les salaires un mois
  durant.
- Audio entièrement synthétisé (Web Audio) : le brassage de la laveuse, la
  lame de la trancheuse, le grésillement de l'huile, le roulement du tambour,
  le chuintement de l'ensacheuse
- Sauvegarde automatique, 3 emplacements manuels, export/import de fichier,
  champ `version` et fonction de migration

**Progression disponible** : âge 1 (La friterie) → âge 2 (La fabrique) →
âge 3 (La PME). Une fois l'âge 3 bouclé, la partie continue en mode libre.

## Ce qui reste à faire

Les lots 3 et 4 sont faits (la qualité, les gros clients, la recherche).
Reste le lot 5, et l'amont agricole.
Adaptés au métier, ils donneraient :

- **L'amont agricole** : contrats pluriannuels avec les producteurs, variétés
  de pommes de terre, récolte saisonnière, silos. De quoi donner du sens au
  prix de la matière, qui n'est aujourd'hui qu'un cours qui oscille.
- **Âge 5 — Le groupe** : multi-sites, logistique inter-usines, export, et une
  deuxième famille de produits (snacks soufflés, biscuits apéritif).

L'âge 5 est déjà déclaré dans la table `AGES` avec leur surface et
leur objectif ; il reste à écrire les systèmes correspondants.

Autres pistes laissées de côté : la date limite de consommation et le rappel
de lot (l'un des deux systèmes « fraîcheur » du métier — la qualité couvre
déjà l'essentiel), et la division d'un convoyeur vers deux postes.

Autre piste laissée de côté volontairement : les **sous-produits**. Les
épluchures se revendent en alimentation animale, mais les modéliser ajoutait
des allers-retours de portage à un âge 1 où la main-d'œuvre est déjà le
goulot. Le rendement reste donc implicite dans les quantités des recettes.

## Deux écarts assumés avec le document

Le document se contredit sur deux points chiffrés. Les arbitrages retenus sont
commentés en tête du fichier, dans la section `CONFIG` :

1. **Durée d'une journée.** Le §6.1 annonce « 1 journée = 40 s réelles » et
   « 1 minute de jeu = 12 ticks », ce qui donnerait 24 minutes réelles par
   journée. On garde **40 s par journée**, qui est la contrainte de rythme du
   §14 — soit 3 minutes de jeu par tick.
2. **Durées et quantités des machines.** Les valeurs du §14 étaient écrites
   pour une chaîne de vélos, à la pièce. Elles ont été refondues pour un flux
   continu au kilo, en gardant la contrainte qui compte : sortir de l'âge 1 en
   20 à 30 minutes réelles.

Rythme mesuré : l'âge 1 se boucle en **30 journées de jeu, soit 20 minutes
réelles** à la vitesse ×1.

## Tests

`node tests/suite.mjs` pilote le jeu dans un vrai navigateur : vingt-cinq cas qui
couvrent le didacticiel, la chaîne, la conservation de la matière, le réseau de
convoyeurs, la qualité, les modes, les cinq âges, les auto-vérifications, la
sauvegarde, le rythme, la performance, la recherche, le raccord entre bandes,
les quais et rangements, les bâtiments d'équipe, la cour, le garde-manger du
labo, les raccords courts, les croisements, l'équipe, les stocks, la marque, les labels, le concurrent, les clients et les cadres. Voir [`tests/README.md`](tests/README.md).

## Organisation du code

Un seul fichier, découpé en sections commentées comme le prévoit le §16 :
`CONFIG`, `DONNÉES`, `ÉTAT`, `SIMULATION` (2 parties), `RENDU` (3 parties),
`UI` (3 parties), `AUDIO`, `SAUVEGARDE`, `INIT`.

Tout l'équilibrage est déclaratif et regroupé en haut du fichier (`ITEMS`,
`RECETTES`, `MACHINES`, `AGES`, `CLIENTS`, `TRAITS`, `BANQUES`) : on peut
changer une recette, un prix ou un rendement sans lire une ligne de logique.
Le moteur ignore ce qu'il fabrique — c'est ce qui a permis de passer d'une
chaîne de vélos à une ligne de chips sans y toucher.

Français pour les identifiants métier, anglais pour la technique. Ce qui est
purement visuel (particules, marchandise figurative sur les convoyeurs, textes
flottants) vit hors de l'objet `etat` et n'est jamais sauvegardé.
