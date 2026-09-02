# Agenda semainier de bureau

Un agenda de semaine dans **un seul fichier HTML**, à ouvrir par double-clic.
Pas d'installation, pas de compte, pas d'internet. Vos données restent sur votre ordinateur.

## Démarrer

1. Téléchargez `agenda.html` et rangez-le dans un dossier **définitif**.
2. Double-cliquez dessus. Il s'ouvre dans votre navigateur.
3. Utilisez **Chrome ou Edge**. Voir la règle de survie ci-dessous.

## La règle à ne jamais oublier

**Ce fichier contient le programme, pas vos données.**
Vos tâches sont rangées par le navigateur, dans un espace attaché à ce fichier.

| Navigateur | Si vous renommez ou déplacez le fichier |
|---|---|
| **Chrome / Edge** | Vos données sont conservées. C'est le choix recommandé. |
| Firefox | L'agenda s'ouvre vide. Les données ne sont pas détruites : remettez le fichier à son nom et son emplacement exacts et elles reviennent. |
| Safari | Refuse de stocker quoi que ce soit pour un fichier local. Inutilisable. |

Une sauvegarde datée tombe automatiquement dans votre dossier Téléchargements
à la première ouverture de chaque journée. C'est votre vraie protection.

Un navigateur qui refuse un téléchargement ne le dit à personne. L'agenda vous demande donc,
au plus une fois toutes les deux semaines, si vous retrouvez bien le fichier. La pastille en
haut à droite ne compte que les sauvegardes ainsi vérifiées : si elle affiche
« Sauvegarde non vérifiée », considérez que vous n'êtes pas protégé.

## Les fichiers du dépôt

| Fichier | Contenu |
|---|---|
| `agenda.html` | L'agenda. C'est le seul fichier dont vous avez besoin. |
| `MODE-EMPLOI.md` | Comment s'en servir au quotidien, raccourcis, restauration. |
| `HISTORIQUE.md` | Journal daté de toutes les modifications. |
| `IDEES.md` | Idées proposées : retenues, en réserve, écartées. |
| `BUGS.md` | Problèmes rencontrés, leur cause, leur correction. |
| `tests/verification.mjs` | Suite de vérification automatique (139 contrôles). |
| `audits/` | Audits du code, de l'interface et de l'ergonomie, avec leur synthèse. |
