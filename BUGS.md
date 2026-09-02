# Problèmes rencontrés

Chaque problème rencontré pendant la construction, sa cause et sa correction.
Ce fichier sert de mémoire : un problème consigné ici ne sera pas re-découvert dans six mois.

---

## Version 1.0.0 — 2 septembre 2026

### B-001 — Variable de couleur corrompue dans le thème sombre
**Symptôme.** La couleur orange du thème sombre était écrite `#e0a martes` : une valeur invalide,
glissée par erreur pendant l'écriture du fichier.
**Cause.** Faute de frappe à la saisie.
**Correction.** Valeur remplacée par `#e0a44a`. Une règle de rattrapage ajoutée dans la foulée
a également été supprimée, pour ne pas laisser deux définitions concurrentes de la même couleur.
**Détection.** Relecture immédiate après écriture.

### B-002 — Première étiquette d'heure coupée en haut de la grille
**Symptôme.** L'heure la plus haute (par exemple `08:00`) était tronquée par le bord supérieur
de la zone de défilement.
**Cause.** Les étiquettes sont positionnées en absolu sur la ligne de l'heure, avec un décalage
vers le haut. La première se retrouvait donc à moitié hors du cadre.
**Correction.** Ajout d'une marge haute de 8 pixels sur la grille entière — appliquée à toutes
les colonnes en même temps, donc sans désaligner quoi que ce soit — et centrage vertical exact
de l'étiquette sur sa ligne.
**Détection.** Capture d'écran du rendu réel.

### B-003 — Les titres longs étaient tronqués et illisibles
**Symptôme.** « Relancer le fournisseur » s'affichait « Relancer le fourniss ».
**Cause.** Le titre était un champ de saisie sur une seule ligne. Un champ de ce type ne
peut pas revenir à la ligne : le texte défile et devient illisible.
**Correction.** Le titre est devenu un champ multi-ligne dont la hauteur est recalculée à
chaque frappe. Un titre long revient à la ligne et reste entièrement visible, tout en restant
modifiable directement sur place.
**Pourquoi c'était grave.** Sur un agenda ouvert tous les jours, ne pas pouvoir lire sa propre
tâche est rédhibitoire. C'est le genre de défaut qui fait abandonner l'outil en une semaine.
**Détection.** Capture d'écran avec des libellés réalistes, plutôt que des libellés courts de test.

### B-004 — Boutons de suppression mal habillés dans le bandeau urgent
**Symptôme.** En thème sombre, les croix de suppression du bandeau urgent apparaissaient comme
des rectangles gris clair au lieu de discrètes croix.
**Cause.** Les règles de style visaient `.item .del`, c'est-à-dire uniquement les croix placées
à l'intérieur d'une tâche. Les puces du bandeau urgent ne sont pas des tâches au sens du style :
leurs boutons gardaient donc l'apparence par défaut du navigateur, très visible en thème sombre.
**Correction.** Les règles visent désormais `.del` partout, avec les nuances propres à chaque
contexte. Même correction pour les cases à cocher.
**Leçon.** Un style écrit pour un contexte précis doit être vérifié dans tous les contextes où
l'élément est réutilisé, et dans les deux thèmes.
**Détection.** Capture d'écran en thème sombre.

---

## Faux problèmes — erreurs de test, pas erreurs de code

Consignés parce qu'ils reviendront : ils ont fait croire à des anomalies inexistantes.

### F-001 — « Le cycle des priorités ne fonctionne pas »
Le test cliquait deux fois sur « la deuxième tâche de la liste ». Or changer la priorité d'une
tâche la fait remonter dans le tri : le deuxième clic tombait sur une autre tâche.
**À retenir.** Toujours cibler une tâche par son identifiant, jamais par sa position à l'écran.

### F-002 — « Le bouton Demain du point de fin de journée ne marche pas »
Même cause : le test cliquait sur « la première ligne » sans savoir laquelle c'était.

### F-003 — « Le point de fin de journée ne se referme pas tout seul »
Le test traitait trois tâches et attendait la fermeture. Mais d'autres tâches ouvertes de la
même journée, créées par les étapes précédentes du test, étaient encore listées.
Le comportement était correct : l'écran ne se ferme que lorsque plus rien n'attend une décision.

---

## Points de vigilance connus, non résolus par nature

Ce ne sont pas des défauts du code, mais des limites du contexte. Ils sont documentés dans
l'agenda lui-même et dans `MODE-EMPLOI.md`.

| Point | Conséquence | Ce qui est fait |
|---|---|---|
| Sous Firefox, l'espace de stockage est attaché au chemin complet du fichier | Renommer ou déplacer le fichier fait apparaître un agenda vide | Avertissement au premier lancement et dans l'aide ; les données ne sont pas détruites, remettre le fichier à son emplacement les fait revenir |
| Sous Chrome, tous les fichiers HTML locaux partagent le même espace | Un autre fichier local pourrait écrire dans les mêmes données | Toutes les clés sont préfixées `agendaHebdo:` |
| Safari refuse tout stockage pour un fichier local | L'agenda ne peut pas fonctionner | Détecté au démarrage, bandeau rouge bloquant |
| « Effacer les cookies et données de sites » efface tout | Perte totale des données du navigateur | Sauvegarde automatique quotidienne vers un vrai fichier, plus instantanés internes |
| Le navigateur peut expulser les données sous pression disque | Perte silencieuse | Même parade ; `navigator.storage.persist()` ne fonctionne pas pour un fichier local |
| Deux onglets ouverts sur le même agenda | Le second peut écraser le premier | Détection et avertissement invitant à recharger |
| OneDrive peut déplacer votre dossier Documents sans vous prévenir | Sous Firefox uniquement : agenda vide un matin, sans que vous ayez rien fait | Documenté dans le mode d'emploi ; raison supplémentaire de préférer Chrome ou Edge |

### B-005 — L'archive autonome se rouvrait sur l'écran de sauvegarde
**Symptôme.** L'archive HTML mensuelle, en se rouvrant, affichait le panneau de sauvegarde
par-dessus l'agenda, au lieu de l'agenda seul.
**Cause.** L'archive est fabriquée en photographiant la page telle qu'elle est à l'écran.
Or on la déclenche depuis le panneau de sauvegarde : ce panneau, encore ouvert, se retrouvait
donc figé dans la photographie.
**Correction.** La page est remise dans un état neutre juste avant la capture — panneau vidé,
messages flottants masqués, données d'une archive précédente retirées — puis remise comme elle
était aussitôt après. Vous ne voyez rien clignoter.
**Détection.** Test d'aller-retour complet : créer l'archive, la rouvrir dans un navigateur
totalement neuf sans aucune donnée héritée, vérifier que les tâches et les notes sont là.
Ce contrôle fait désormais partie de la suite de vérification.
