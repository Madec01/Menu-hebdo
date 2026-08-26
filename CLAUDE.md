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
- **Économiser les sous-agents.** Choisir le modèle et l'effort adaptés à la
  tâche : une simple recherche « où est telle fonction » ne demande pas le
  modèle le plus fort. Réserver les gros modèles aux cartographies qui
  demandent du jugement (analyser un moteur, peser des options, prévoir des
  risques). Grouper les questions dans une seule mission plutôt que d'en
  lancer plusieurs, et ne relancer un agent que si la carte rendue est
  vraiment insuffisante.

## Avant de coder

- Expliquer ce que tu comptes faire et attendre validation avant toute
  modification.

## Le travail par lots

- Le travail avance par **lots** : un lot livré, l'auteur l'essaie, il valide
  ou il signale, puis on passe au suivant.
- **À la fin de chaque lot**, refaire le point : la liste des lots qui restent,
  et le **détail du prochain** — ce qu'il contient exactement, ce que l'auteur
  pourra faire à la fin, et ce qui touche au moteur.

## L'auteur attend des propositions, pas seulement de l'exécution

- Il est **ouvert aux propositions d'amélioration** : si quelque chose peut
  être fait mieux, plus simple, plus juste ou plus parlant, le dire.
- Il **veut un avis franc sur ses idées** : dire quand une idée est bonne,
  dire quand elle coûte cher pour ce qu'elle rapporte, et proposer l'autre
  chemin. Ne pas approuver par politesse.
- Il **accueille les idées** qui ne viennent pas de lui : un composant qui
  manque, une leçon qui manque, un geste qui ferait gagner du temps.
- Cela ne change rien à la règle du dessus : on propose, on explique, et on
  attend la validation avant de coder.

## Le carnet de bord : note.md

`note.md` est le fichier à lire **en premier** quand une session démarre : il
dit où en est le projet, ce qui vient d'être fait, et les pièges du fichier
principal.

**Au début de chaque session**, après l'avoir lu, faire à l'auteur un point
court et en français simple :

1. les **bugs identifiés** et pas encore corrigés,
2. les **modifications qui restent à faire**, dans l'ordre prévu,
3. où on en était exactement.

Ce point s'appuie sur `note.md` — donc `note.md` doit toujours contenir de quoi
l'écrire : une section « Défauts connus » et une section « Ce qui reste ».

**Au début de chaque session**, après l'avoir lu, faire à l'auteur un point
court et en français simple :

1. les **bugs identifiés** et pas encore corrigés,
2. les **modifications qui restent à faire**, dans l'ordre prévu,
3. où on en était exactement.

Ce point s'appuie sur `note.md` — donc `note.md` doit toujours contenir de quoi
l'écrire : une section « Défauts connus » et une section « Ce qui reste ».

- Le mettre à jour **dès qu'un morceau de travail est terminé** (et pas
  seulement quand l'auteur annonce un « clear » : un clear efface la mémoire
  sans prévenir).
- Y écrire ce qui sert à reprendre le travail : l'état, les décisions prises
  et pourquoi, les pièges rencontrés. Pas l'historique détaillé — c'est le
  rôle des messages de commit.
- Le garder court. Ce qui est fini et sans conséquence, on l'efface.

# Feuille de route

Cette section est **temporaire** : c'est un pense-bête, pas de la
documentation. Effacer chaque ligne dès que le travail correspondant est
fait, et **supprimer la section entière** quand tout est terminé.

## LA grosse modification : le domaine ⚡ Énergie & ondes

Le bouton existe déjà dans la barre du bas, grisé, marqué « bientôt ».
Quatre phases, dans cet ordre :

1. ~~**Le continu**~~ — la partie technique est **faite** (solveur nodal,
   liaison de puissance, mesure, générateur, oscilloscope, rails et tunnels).
   Il ne reste que son **chapitre de cours**, suivi dans `note.md`.
2. **Produire** — aimant qu'on fait passer dans une bobine à la souris,
   dynamo à manivelle dont l'effort augmente avec la charge, turbine
   alimentée par le four ou la chaudière, panneau solaire, thermocouple.
3. **L'alternatif** — condensateur et bobine, pas de temps plus fin,
   résonance, pont redresseur.
4. **L'éther** — la radio : la position sur le plan compte vraiment, accord
   LC, modulations AM / FM / Morse / numérique, obstacles. Et le son, qui est
   le même moteur tourné beaucoup plus lentement.
