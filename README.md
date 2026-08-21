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

## Ce qui est construit

**Lot 1 — Noyau jouable** et **Lot 2 — La chaîne**, en entier :

- Grille, caméra, zoom continu, vue schématique au dézoom
- Moteur de flux à pas fixe (4 Hz), rendu interpolé à 60 fps
- Trois postes de départ (laveuse-éplucheuse, trancheuse, friteuse), puis
  tambour d'assaisonnement, ensacheuse et bacs de stockage
- Convoyeurs en **réseau** : les bandes se branchent les unes aux autres, on
  bâtit un trajet par tronçons et plusieurs bandes peuvent converger vers un
  même poste. Latence, bouchons, chevrons de sens et marchandise visible sur
  la bande. Une bande ne prend que ce que son aval finira par consommer.
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

Le lot 3 est fait (la qualité, les gros clients). Restent les lots 4 et 5.
Adaptés au métier, ils donneraient :

- **Âge 4 — L'industrie** : la saisonnalité. Récolte, silos, contrats avec les
  producteurs, prix qui s'effondrent en septembre. Plus les RH avancées et la
  R&D recettes et arômes.
- **Âge 5 — Le groupe** : multi-sites, logistique inter-usines, export, et une
  deuxième famille de produits (snacks soufflés, biscuits apéritif).

Les âges 4 et 5 sont déjà déclarés dans la table `AGES` avec leur surface et
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
