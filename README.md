# VEILLEUR — Sept nuits au phare d’Ys

Un jeu d’arcade dans **un seul fichier HTML**. Aucune dépendance, aucun asset :
le son est synthétisé à la volée (Web Audio), tout le rendu est en canvas 2D.

**Jouer :** ouvrez `index.html` dans un navigateur de bureau.

## Le jeu

Vous tenez la lampe d’un phare. Des navires perdus dérivent vers vos récifs.
Le faisceau ne les tire pas : il les **convainc**.

- **Souris** — le faisceau suit le curseur.
  Immobile, il se resserre et convainc vite. En balayage, il s’élargit et pâlit :
  vous voyez tout le monde, vous ne sauvez personne.
- **Shift** — focus : cône étroit, longue portée, charge doublée.
  La lentille chauffe ; à fond, la lampe s’éteint deux secondes et demie.
  C’est aussi la seule façon d’éteindre les feux d’Ys.
- **Espace** — fusée : troue la brume, rassure tout un secteur. Coûte de l’huile.
- **R** rejouer · **Échap** pause · **M** son

Sept nuits, trois lanternes, une sœur portée disparue.

## Construction

Le fichier est assemblé à partir de quatre modules écrits séparément
(contenu, audio, effets, moteur) puis concaténés dans `index.html`.
