# Contexte projet

Application en fichier HTML unique, volumineux. L'auteur ne code pas :
toutes les explications doivent être en français simple, sans jargon.

## Gestion du contexte

- Ne JAMAIS lire le fichier principal en entier. Utiliser grep pour
  localiser, puis lire seulement la zone concernée.
- Tu juges seul quand un sous-agent est nécessaire. Règle : dès que la
  tâche demande de chercher "où ça se passe" dans le fichier, délègue
  l'exploration à un sous-agent en lecture seule. Pour une modification
  déjà localisée, fais-la directement, sans sous-agent.
- Le sous-agent explore et rend une carte (emplacements + explication
  simple + risques). C'est la session principale qui édite.

## Avant de coder

- Expliquer ce que tu comptes faire et attendre validation avant toute
  modification.

# Feuille de route

Cette section est **temporaire** : c'est un pense-bête, pas de la
documentation. Effacer chaque ligne dès que le travail correspondant est
fait, et **supprimer la section entière** quand tout est terminé.

## Refonte de l'affichage (en cours)

- **Lot 3** — le sommaire devient **la carte du cours** : 30 tuiles de
  chapitre avec anneau de progression, leçons en pastilles numérotées
  (grise à faire, verte réussie, dorée objectif atteint), bouton Reprendre.

## Puis LA grosse modification : le domaine ⚡ Énergie & ondes

Le bouton existe déjà dans la barre du bas, grisé, marqué « bientôt ».
Quatre phases, dans cet ordre :

1. **Le continu** — un vrai calcul de tensions et de courants (solveur
   nodal), un troisième type de liaison à côté du logique et du fluide, pile
   avec résistance interne, et le retour du courant rendu explicite en
   utilisant le rail comme masse.
2. **Produire** — aimant qu'on fait passer dans une bobine à la souris,
   dynamo à manivelle dont l'effort augmente avec la charge, turbine
   alimentée par le four ou la chaudière, panneau solaire, thermocouple.
3. **L'alternatif** — condensateur et bobine, pas de temps plus fin,
   résonance, pont redresseur.
4. **L'éther** — la radio : la position sur le plan compte vraiment, accord
   LC, modulations AM / FM / Morse / numérique, obstacles. Et le son, qui est
   le même moteur tourné beaucoup plus lentement.
