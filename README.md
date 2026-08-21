# Cadence

Jeu de gestion d'usine en navigateur. On démarre seul dans un garage à souder
des cadres de vélo à la main, et on regarde l'atelier grandir.

**Le jeu tient dans un seul fichier : [`cadence.html`](cadence.html).**
Double-clic pour jouer. Aucune installation, aucune dépendance, aucun réseau —
il fonctionne hors ligne.

---

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

## Ce qui est construit

**Lot 1 — Noyau jouable** et **Lot 2 — La chaîne**, en entier :

- Grille, caméra, zoom continu, vue schématique au dézoom
- Moteur de flux à pas fixe (4 Hz), rendu interpolé à 60 fps
- Trois machines de départ (scie, poste à souder, établi) puis cintreuse,
  cabine de peinture et caisses de stockage
- Convoyeurs : modèle par arête, avec latence, bouchons et pièces visibles
  sur la bande
- Ouvriers simulés individuellement : déplacement A\*, portage, tenue de poste,
  fatigue, moral, compétences qui montent, embauche et démission
- Trésorerie complète (salaires, loyer, électricité, emprunts, découvert,
  dépôt de bilan), marché des matières fluctuant, commandes avec délai et
  pénalité de retard, réputation
- Phase de décision du vendredi soir : bilan, graphique, 4 décisions maximum,
  jauge d'objectif
- Le contremaître, qui porte tout le didacticiel et tout le diagnostic
- Usure, pannes, révision · saleté de l'atelier et nettoyage
- Audio entièrement synthétisé (Web Audio), particules, cycle de lumière
- Sauvegarde automatique, 3 emplacements manuels, export/import de fichier,
  champ `version` et fonction de migration

**Progression disponible** : âge 1 (Le garage) → âge 2 (L'atelier), avec le
VTC, la peinture et les convoyeurs. Une fois l'âge 2 bouclé, la partie
continue en mode libre.

## Ce qui reste à faire

Les lots 3 à 5 du document de game design ne sont pas construits : qualité et
rebut, contrôle qualité, VAE et composants électroniques, ressources humaines
avancées (équipes, formation, grève), R&D, multi-sites et logistique
inter-usines, scooter et véhicule électrique, écran de bilan à 30 ans.

Les âges 3 à 5 sont déjà déclarés dans la table `AGES` avec leur surface et
leur objectif ; il reste à écrire les systèmes correspondants.

## Deux écarts assumés avec le document

Le document se contredit sur deux points chiffrés. Les arbitrages retenus sont
commentés en tête du fichier, dans la section `CONFIG` :

1. **Durée d'une journée.** Le §6.1 annonce « 1 journée = 40 s réelles » et
   « 1 minute de jeu = 12 ticks », ce qui donnerait 24 minutes réelles par
   journée. On garde **40 s par journée**, qui est la contrainte de rythme du
   §14 — soit 3 minutes de jeu par tick.
2. **Durées des machines.** Le §14 donne « établi : 1 vélo / 5 min », ce qui
   ferait 96 vélos par jour et par établi, contre l'objectif d'environ 1 vélo
   par jour et par ouvrier du §5.3. Les **prix sont conservés tels quels**
   (c'est ce que le joueur lit) ; les **durées ont été recalées**.

Rythme mesuré après recalage : l'âge 1 se boucle en **30 journées de jeu, soit
20 minutes réelles** à la vitesse ×1 — la cible du §14 étant 20 à 30 minutes.

## Organisation du code

Un seul fichier, découpé en sections commentées comme le prévoit le §16 :
`CONFIG`, `DONNÉES`, `ÉTAT`, `SIMULATION` (2 parties), `RENDU` (3 parties),
`UI` (3 parties), `AUDIO`, `SAUVEGARDE`, `INIT`.

Tout l'équilibrage est déclaratif et regroupé en haut du fichier (`ITEMS`,
`RECETTES`, `MACHINES`, `AGES`, `CLIENTS`, `TRAITS`, `BANQUES`) : on peut le
retoucher sans lire une ligne de logique.

Français pour les identifiants métier, anglais pour la technique. Ce qui est
purement visuel (particules, pièces figuratives sur les convoyeurs, textes
flottants) vit hors de l'objet `etat` et n'est jamais sauvegardé.
