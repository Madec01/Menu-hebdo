# Architecte Logique

Jeu d'apprentissage de la logique numérique et de l'automatisme : des portes
élémentaires jusqu'aux capteurs, aux régulateurs et aux automates. 142 missions
guidées, de « allume une ampoule » au processeur 1 bit, puis du thermostat au
feu tricolore programmé et au circuit hydraulique.

L'appli tient deux ateliers dans le même plan de travail : **⚡ Électronique**
(le signal et la logique) et **🏭 Process** (l'installation : capteurs,
régulation, actionneurs, tuyauterie). Le sélecteur en tête de la barre d'outils
filtre la palette — sans rien verrouiller : un montage peut mélanger les deux et
la recherche traverse toujours l'ensemble du catalogue.

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
| Temps & automatisme | TON, TOF, impulsion calibrée, détecteur de fronts, mémoire SR, diviseur ÷N, chien de garde, machine à états |
| Régulation | CAN, CNA, PWM, thermostat à hystérésis, Schmitt, limiteur, rampe, régulateur proportionnel, **PID complet** (anti-emballement, RAZ) |
| Sorties | ampoule, afficheurs (hex, décimal, octet), LED RVB, matrice 8×8, oscilloscope, sonde, buzzer, note, jauge, **écran de mesure 4 voies** et **enregistreur de courbes** |
| Actionneurs & procédés | relais, moteur (vitesse + tachymètre), vérin (position + fins de course), électrovanne et pompe proportionnelles, sirène, pas-à-pas, servo, feu, barrière — et les procédés qui réagissent vraiment : **four**, **cuve**, **réservoir d'air comprimé**, **convoyeur**, plus la fluidique (**tuyau** qui bride le débit, **té** de répartition) |

**Le tuteur.** Pendant une mission, le panneau indique en direct combien de
lignes de la table sont justes et laquelle cloche. Le bouton « Guide-moi sur le
schéma » calcule une solution complète (implicants premiers, couverture,
conversion en base NAND ou NOR si la mission l'impose) et la pose en fantômes,
étape par étape, en expliquant chaque geste. Désactivé sur les missions boîte
noire.

**Des schémas tout prêts.** Le menu 📦 propose 27 montages chargeables, dont treize
procédés complets : station de pompage, four régulé en tout ou rien / proportionnel
/ PID, poste pneumatique, convoyeur avec évacuation, vitesse moteur asservie, serre
automatisée, carrefour piloté par automate, capteurs en prise directe, circuit
hydraulique à deux branches, remplissage automatique à deux seuils, et un
**atelier complet** où trois boucles tournent en parallèle.

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

**Confort.** Infobulle au survol (état de chaque pin, réglages, valeur d'un
câble), rotation par quarts de tour et miroir (`R`, `M`), noms de composants
masquables (`N`), recadrage automatique (`F`), niveau de détail au zoom,
mise en évidence du voisinage, encapsulation d'une sélection en puce,
annuler/refaire, export PNG recadré.

## Tests

```sh
npm test                          # ou : node test/run.js [fichier.html]
node test/run.js fichier --smoke  # contrôle de démarrage seulement
```

Le harnais est *headless* : `test/run.js` extrait le `<script>` du HTML, le
concatène entre `test/pre.js` (stubs DOM / Canvas / Audio / localStorage, plus
une horloge `Date.now` pilotable) et `test/post.js` (les tests), puis exécute le
tout dans un contexte `vm`. Aucun navigateur, aucune dépendance npm.

148 tests couvrent le moteur, le séquentiel, les blocs numériques, l'analogique
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
| `al2_progress` | missions réussies et meilleurs scores (v3) |
| `al2_chips` | puces créées par le joueur |
| `al2_saves` | montages nommés |
| `al2_sandbox` | bac à sable courant (auto-sauvegardé) |
| `al2_mode` | atelier courant (électronique / process / tout) |
| `al2_mute`, `al2_snap`, `al2_labels` | préférences |

`versions/` conserve des copies figées des versions précédentes ; elles restent
vérifiables (`node test/run.js versions/<fichier> --smoke`).
