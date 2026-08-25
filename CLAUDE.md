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
