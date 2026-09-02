# Problèmes rencontrés

Chaque problème rencontré pendant la construction, sa cause et sa correction.
Ce fichier sert de mémoire : un problème consigné ici ne sera pas re-découvert dans six mois.

---

## Version 1.2.0 — 2 septembre 2026

### B-015 — Le plafond du bac était à l'envers du besoin
**Symptôme.** « La partie chose à faire est trop petite. »
**Cause.** Le bac « À faire » était plafonné à 190 pixels sur **tout** écran, alors que la
grille horaire, elle, n'était pas plafonnée du tout. Mesure : à 1920×1080, le bac recevait
25 % de la zone centrale et la grille 75 %, pour 81 % et 19 % du contenu respectivement.
**Ce qui rendait le défaut pervers.** Plus l'écran est étroit, plus les titres passent à la
ligne, donc plus le bac aurait besoin de hauteur. Le contenu réel d'un jour chargé mesurait
264 pixels à 1920 mais **431 à 1280**, toujours dans le même cadre de 190. Le plafond serrait
d'autant plus fort qu'il fallait qu'il cède.
**Correction.** Le bac prend la hauteur de son contenu sans dépasser sa part, et ce qu'il
n'utilise pas revient aux heures. Une poignée arbitre entre les deux zones.
**Piège rencontré en corrigeant.** Une part *fixe* de 60 % s'est révélée presque aussi rigide
qu'un plafond fixe : un lundi à six tâches occupait 230 pixels dans un bac de 350, et les
120 pixels perdus manquaient à la grille, qui coupait le déjeuner de midi. C'est la mesure sur
capture d'écran qui l'a montré, pas le raisonnement.

### B-016 — Quatre-vingt-quatre pixels de décoration sur chaque tâche
**Symptôme.** « Les affichages ne se font pas bien dans les cases. »
**Cause.** Poignée, case à cocher, pastille de priorité et croix occupaient 84 pixels par
tâche, valeur **constante quelle que soit la largeur de l'écran** : 33 % de la largeur utile à
1920, 45 % à 1440, 51 % à 1280. Il restait treize caractères par ligne sur un portable.
**Correction.** Les commandes passent dans une barre superposée qui ne paraît qu'au survol.
La pastille peut disparaître au repos sans rien coûter en information : la priorité est déjà
portée par la bordure gauche colorée et par la teinte de fond. Décor : 84 pixels avant, 34
après ; texte par tâche multiplié par 2,5 sur un portable.
**Leçon.** Un coût constant dans une largeur variable est un défaut de conception, pas un
détail de style : sa part grandit exactement là où la place manque.

### B-017 — Pastille et croix se recouvraient sur une tâche d'une seule ligne
**Symptôme.** Le clic destiné à la pastille de priorité tombait sur la croix de suppression.
**Cause.** En superposant les commandes, la pastille avait été placée en bas à droite et la
croix en haut à droite. Sur une tâche de vingt pixels de haut, deux éléments de treize pixels
placés ainsi se recouvrent, et c'est le dernier du document qui reçoit le clic.
**Correction.** Les deux voyagent côte à côte dans la même barre, jamais l'une sur l'autre.
**Détection.** La suite de vérification, dès la première exécution. C'est exactement le
scénario du faux problème F-001, mais cette fois le défaut était réel.

### B-018 — Le repère « + n autres » recouvrait la dernière tâche
**Cause.** Collé en bas du bac sur toute la largeur, il interceptait les clics destinés à la
tâche située dessous.
**Correction.** Une pastille étroite calée à droite.

### B-019 — Un rendez-vous hors de la plage réglée disparaissait
**Symptôme.** Un rendez-vous à 7 h, avec une journée réglée à partir de 8 h, n'apparaissait
nulle part.
**Cause.** Le rendu écartait purement et simplement les éléments dont la ligne tombait hors
de la grille.
**Correction.** Le repli de la grille sur les heures occupées **étend** la plage pour inclure
ces rendez-vous. Un défaut ancien corrigé par un chemin détourné.

### B-020 — L'impression demandait près de trois pages
**Symptôme.** 2 088 pixels pour 734 disponibles, alors que le README promet une page.
**Cause.** Aucun plafond n'était neutralisé à l'impression, et les créneaux gardaient leur
hauteur d'écran de 22 pixels alors qu'on ne clique pas sur du papier.
**Correction.** Plafonds et replis neutralisés — une tâche hors du cadre à l'écran aurait été
absente de la feuille — et créneaux resserrés à 14 pixels le temps de la photographie.
**Fausse piste écartée.** Le faire en CSS, par `--slot-h` dans `@media print`, ne fonctionne
pas : la hauteur des créneaux est calculée en JavaScript et posée en pixels sur la gouttière
comme sur chaque rendez-vous. Une règle de style aurait déplacé la grille sans déplacer les
rendez-vous. C'est le procédé du bug B-005 qui a été repris : préparer la page, laisser le
navigateur la photographier, tout remettre en place.
**Résultat honnête.** Une semaine normale tient sur une page (680 pixels). Une semaine très
chargée en demande 991 et déborde encore. Le mode d'emploi le dit désormais.

---

## Version 1.1.0 — 2 septembre 2026

Défauts trouvés par les trois audits (rapports complets dans `audits/`). Tous ont été
reproduits dans un vrai navigateur avant d'être corrigés : un défaut qu'on ne sait pas
déclencher n'est pas un défaut.

### B-006 — La sauvegarde annonçait « réussi » quand elle avait échoué
**Symptôme.** La pastille affichait « Sauvegardé aujourd'hui » alors qu'aucun fichier
n'arrivait dans le dossier Téléchargements.
**Cause.** `telecharger()` renvoyait `true` dès l'instant où le clic n'avait pas levé
d'erreur. Or un téléchargement refusé par le navigateur échoue de façon **asynchrone et
silencieuse** : aucun événement, aucune exception. La fonction renvoyait donc « réussi »
dans tous les cas.
**Pourquoi c'était le plus grave.** La sauvegarde quotidienne est la seule protection réelle
contre un effacement des données du navigateur. Quelqu'un ayant répondu « Bloquer » à la
demande d'autorisation — celle que le mode d'emploi lui dit d'accepter, une seule fois, sans
jamais revenir — se retrouvait sans aucune protection, avec un indicateur rassurant sous les
yeux, tous les matins, indéfiniment.
**Correction.** La tentative et la confirmation sont devenues deux champs distincts. La
pastille ne reflète que la confirmation. Deux sources de confirmation seulement : la fenêtre
d'enregistrement du navigateur, qui confirme ou rejette l'écriture, ou une question posée à
l'utilisateur au plus une fois toutes les deux semaines.
**Leçon.** Ne jamais transformer « la demande est partie » en « c'est fait ». Quand on ne peut
pas savoir, on le dit.

### B-007 — Un onglet oublié écrasait tout en se fermant
**Symptôme.** Neuf tâches ramenées à une, mesuré.
**Cause.** Deux onglets travaillent sur deux copies indépendantes de l'état. Le second à se
fermer écrivait la sienne par-dessus le travail du premier. L'avertissement « ouvert dans un
autre onglet » prévenait mais n'empêchait rien.
**Correction.** Un jeton renouvelé à chaque écriture, comparé avant d'écrire. L'onglet périmé
refuse d'écrire, définitivement, et propose « Afficher et copier » pour ne pas laisser
l'utilisateur sans issue.
**Leçon.** Un avertissement n'est pas une protection.

### B-008 — Le pointeur d'emplacement perdu renvoyait les données les plus anciennes
**Cause.** `storeLire()` se rabattait sur l'emplacement « A » quand le pointeur était absent,
alors que `savedAt` figure dans chaque enveloppe et n'était jamais lu.
**Correction.** Les deux emplacements sont validés, le plus récent l'emporte.

### B-009 — Les instantanés provoquaient la panne qu'ils devaient prévenir
**Symptôme.** Saturation du stockage vers 974 tâches, soit environ un an d'usage.
**Cause.** Sept instantanés quotidiens, quatre hebdomadaires et deux emplacements : chaque
tâche était rangée treize fois. Mesuré : 406 octets par tâche, 5 025 Ko de quota.
**Correction.** Les tâches sont rangées une seule fois dans un réservoir commun adressé par
empreinte ; un instantané n'est plus qu'une liste de renvois. Coût des instantanés : 3 489 Ko
avant, 629 Ko après. Plafond : 974 tâches avant, 4 455 après.
**Piège évité.** L'empreinte est un FNV-1a sur 32 bits, donc sujette aux collisions. On ne s'y
fie jamais seule : si la case est prise par un contenu différent, on prend la suivante, et la
clé retenue est inscrite dans l'instantané.

### B-010 — La copie de sécurité d'avant restauration n'était pas vérifiée
**Cause.** Le résultat de l'export était ignoré : si la copie échouait, le remplacement avait
lieu quand même, alors que le panneau promet noir sur blanc que la restauration reste
réversible.
**Correction.** La restauration s'interrompt sans rien toucher et renvoie vers
« Afficher et copier ».

### B-011 — Tout rendez-vous passé était reporté et perdait son heure
**Symptôme.** Contraire à ce qu'annoncent le README et le mode d'emploi.
**Cause.** Le champ `kind` n'a **jamais** reçu d'autre valeur que sa valeur par défaut
« task » dans le code de production. Le test `kind === "task"` était donc toujours vrai et
laissait passer les rendez-vous.
**Correction.** C'est l'emplacement qui décide : un élément posé sur un créneau horaire est un
rendez-vous, et rien ne le déplace.
**Ce que ça a révélé.** La suite de vérification se contredisait elle-même : une ligne exigeait
qu'un élément posé sur un créneau soit reporté, une autre exigeait l'inverse, et les deux ne se
distinguaient que par ce champ jamais renseigné. La documentation diverge de la même façon —
`MODE-EMPLOI.md` promet qu'un rendez-vous passé ne bouge jamais, `HISTORIQUE.md` décrit une
tâche reportée qui perd son heure. C'est la promesse du mode d'emploi qui a été appliquée.

### B-012 — Les tâches étaient écrasées par leur bac, le texte débordant sur la suivante
**Symptôme.** « Appeler le comptable pour le bilan » se lisait « Appeler le comptable pour
le ». Quinze tâches sur seize concernées sur un bac chargé.
**Cause.** Les bacs sont des colonnes flexibles. Sans `flex:0 0 auto`, une tâche prend la
valeur par défaut `flex-shrink:1` : dès que le contenu dépasse, le navigateur **comprime** les
tâches au lieu de les faire défiler. Mesure : boîte à 34 pixels pour un texte de 53.
**Ce n'est pas le retour de B-003.** Le correctif de B-003 fonctionne : le champ de titre se
dimensionne correctement. C'est son conteneur qui l'écrasait — un second mécanisme, indépendant,
produisant le même symptôme.
**Pourquoi le contrôle ne l'a pas vu.** Il mesurait la hauteur du **champ** (53 pixels,
correct) et non celle de la **boîte** (34 pixels, faux). Il passait au vert sur un défaut
visible à l'œil nu.
**Leçon.** Un contrôle qui mesure le mauvais objet est pire qu'un contrôle absent : il donne
une confiance imméritée.

### B-013 — Deux rendez-vous simultanés rendaient la journée inclicable
**Symptôme.** Impossible de cliquer sur un créneau pour poser un rendez-vous dès que deux
autres se chevauchaient dans la journée.
**Cause.** Le code plaçait les rendez-vous par leur rangée et ne leur donnait **jamais** de
colonne. Le navigateur en fabriquait donc de nouvelles à la volée et répartissait l'espace
entre elles. Les pistes mesuraient `0px 98px 98px` : la première, celle des quarante-huit
cases cliquables, tombait à zéro.
**Correction.** Une colonne explicite, et les rendez-vous posés en absolu avec de vrais
couloirs : les simultanés se partagent la largeur, un rendez-vous isolé la reprend entière.
**Défaut associé.** Sur un couloir partagé de 54 pixels, les 84 pixels de décoration ne
laissaient **rien** au texte, mesuré à zéro pixel. La décoration passe en superposition et
revient au survol : texte à 38 pixels.
**Pourquoi il a traversé toute la version 1.0.0.** Aucun des cinquante-sept contrôles ne créait
deux rendez-vous simultanés.

### B-014 — La barre d'alerte cassait toute la mise en page
**Symptôme.** À l'apparition d'un avertissement, le bandeau urgent s'étirait et ses pastilles
se dessinaient par-dessus les en-têtes de jours.
**Cause.** La grille de `.app` déclarait quatre rangées pour six enfants, dont un — la barre
d'alerte — qui apparaît et disparaît. Chaque apparition décalait toutes les rangées d'un cran :
la rangée souple tombait sur le bandeau urgent.
**Correction.** Une colonne souple, qui ne compte pas ses enfants.
**Leçon.** Une grille à rangées numérotées et des enfants qui apparaissent ou disparaissent ne
vont pas ensemble.

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
