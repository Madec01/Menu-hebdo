# Historique des modifications

Journal daté de tout ce qui a été fait, dans l'ordre. La version la plus récente est en haut.

---

## Version 1.2.0 — 2 septembre 2026

La réponse au reproche d'origine : « la partie chose à faire est trop petite ».

### Le chiffre qui explique tout

Sur chaque tâche, **quatre-vingt-quatre pixels étaient consommés par la décoration** —
poignée de glissement, case à cocher, pastille de priorité, croix de suppression — et cette
valeur ne bougeait pas d'un écran à l'autre.

| Écran | Largeur d'une tâche | Texte | Décor | Caractères par ligne |
|---|---|---|---|---|
| 1920 | 257 px | 173 px | 84 px (33 %) | 28 |
| 1440 | 188 px | 105 px | 84 px (45 %) | 17 |
| 1280 | 166 px | 82 px | 84 px (**51 %**) | **13** |

Sur un portable, plus de la moitié de la place d'une tâche servait à montrer des commandes
dont aucune n'est utilisée en lisant.

### Et le plafond était à l'envers du besoin

Le bac « À faire » était plafonné à 190 pixels sur **tout** écran. Or plus l'écran est étroit,
plus les titres passent à la ligne, donc plus le bac aurait besoin de hauteur. Le contenu réel
d'un jour chargé mesurait 264 pixels à 1920 mais **431 à 1280** — toujours dans le même cadre
de 190. Le plafond grandissait en importance exactement quand il fallait qu'il cède.

Pendant ce temps, la grille horaire, elle, n'était pas plafonnée : à 1920×1080 elle prenait
75 % de la zone centrale pour 19 % du contenu.

### Ce qui a été fait

**Les 84 pixels sont rendus au texte.** Les commandes vivent maintenant dans une petite barre
superposée qui ne paraît qu'au survol. La pastille de priorité peut disparaître au repos sans
rien coûter en information : la priorité est déjà portée par la bordure gauche colorée et par
la teinte de fond. Décor : **84 pixels avant, 34 après**.

**Le plafond a disparu.** Le bac prend la hauteur de son contenu sans dépasser sa part, et ce
qu'il n'utilise pas revient aux heures. Une part fixe aurait été presque aussi rigide qu'un
plafond fixe — un lundi à six tâches occupait 230 pixels dans un bac de 350, et les 120 pixels
perdus manquaient à la grille, qui coupait le déjeuner de midi.

**Une poignée arbitre entre les deux zones.** Elle agit dans les deux sens, se mémorise, et
un double-clic rend la main à l'ajustement automatique.

**Le week-end est replié par défaut** : cinq colonnes au lieu de sept élargissent chaque jour
de 40 %. Le bouton, logé dans la case vide au-dessus de « À FAIRE » — le seul endroit qui ne
coûte aucune largeur aux jours — annonce ce qui attend le samedi et le dimanche.

**La grille horaire ne montre plus que les heures occupées**, avec une heure de marge, jamais
moins de quatre heures, et l'heure courante toujours incluse. Un rendez-vous posé hors de la
plage réglée étend la plage au lieu d'être masqué — il disparaissait purement et simplement
auparavant.

**Le bandeau urgent est borné à deux lignes.** Il pouvait s'étaler sur trois rangées et
138 pixels pris sur la zone de travail.

### Le résultat, mesuré

| Écran | Texte par tâche | Caractères par ligne |
|---|---|---|
| 1920 | 173 → **329 px** | 28 → **54** |
| 1440 | 105 → **233 px** | 17 → **38** |
| 1280 | 82 → **201 px** | 13 → **33** |

Sur un portable, une tâche affiche deux fois et demie plus de texte qu'avant.

### L'impression

Elle demandait 2 088 pixels pour 734 disponibles, soit près de trois pages. Sur le papier,
plus aucun plafond ni repli ne s'applique — une tâche hors du cadre à l'écran aurait été
absente de la feuille — et les créneaux sont resserrés de 22 à 14 pixels le temps de la
photographie, puis restaurés.

**Une semaine normale tient maintenant sur une page : 680 pixels.** Une semaine très chargée —
vingt tâches sur un jour, neuf urgences — en demande 991 et déborde encore. Ce volume ne tient
pas sur une page, et il vaut mieux le dire que le prétendre.

### Vérification

**130 contrôles automatiques**, contre 100, tous verts, aucune erreur JavaScript. Trente
ajoutés, dont l'absence de plafond, la poignée dans les deux sens et sa mémorisation, le
double-clic, le repli de la grille et ses garde-fous, le bouton du week-end, le bandeau urgent
borné puis déplié, et huit contrôles d'impression là où il n'y en avait que deux.

### Ce qui reste

C'est maintenant à l'usage de trancher. Si les tâches sont redevenues lisibles et que le bac
respire, la nouvelle disposition « jour au centre, semaine en rail » — étape 4 des audits,
une semaine de travail et un changement d'identité de l'outil — devient inutile.
**Ce serait le meilleur résultat possible.**
L'horizon glissant sur dix jours vient ensuite, quelle que soit l'issue.

---

## Version 1.1.0 — 2 septembre 2026

Trois audits, puis la réparation de ce qu'ils ont trouvé de plus grave.

### Pourquoi cette version

Après une semaine d'usage réel, le constat était : « je le trouve peu pratique finalement,
la partie chose à faire est trop petite, les affichages ne se font pas bien dans les cases,
ça manque de beaucoup d'ergonomie ».

Trois audits ont donc été lancés en parallèle et sans coordination entre eux — code,
interface visuelle, ergonomie — avec obligation pour chacun de manipuler réellement l'agenda
dans un navigateur et de fournir une mesure pour chaque constat. Leurs rapports complets sont
dans `audits/`, avec une synthèse.

Ils arrivent séparément à la même conclusion : **le moteur est sain, la présentation est
structurellement fausse.** Le report est resté idempotent face à douze scénarios, dont une
absence de dix-sept jours à cheval sur une fin d'année en semaine ISO 53. Aucun des trois ne
recommande de repartir de zéro.

### La cause racine des trois reproches

Une seule mesure les explique tous. Sur chaque tâche, **quatre-vingt-quatre pixels sont
consommés par la décoration** — poignée, case à cocher, pastille de priorité, croix — et cette
valeur est une constante, quelle que soit la taille de l'écran.

| Écran | Colonne d'un jour | Largeur qui porte du texte | Part perdue |
|---|---|---|---|
| 1920 px | 266 px | 173 px | 32 % |
| 1440 px | 197 px | 105 px | 43 % |
| 1366 px | 187 px | 94 px | **45 %** |

Sur un portable, il restait quinze caractères par ligne.

### Ce qui a été réparé : les données d'abord

Six défauts pouvant coûter des données, tous reproduits dans un navigateur avant correction.

**La sauvegarde annonçait un succès qu'elle ignorait.** C'est le plus grave des trois audits.
Un téléchargement refusé par le navigateur échoue de façon asynchrone et silencieuse : aucun
événement, aucune exception. La fonction renvoyait donc « réussi » dans tous les cas, la date
était inscrite, la pastille passait au vert. Quelqu'un ayant répondu « Bloquer » à la demande
d'autorisation — celle que le mode d'emploi lui dit d'accepter, une seule fois, sans jamais
revenir — se retrouvait sans aucune protection avec un indicateur rassurant sous les yeux,
tous les matins.

La tentative et la confirmation sont désormais deux choses distinctes, et la pastille ne
reflète que la seconde. Deux sources de confirmation, et deux seulement : le navigateur, via
la fenêtre d'enregistrement qui confirme ou rejette l'écriture ; ou vous-même, à qui la
question est posée au plus une fois toutes les deux semaines, jamais sur un agenda vide.
Si vous répondez que vous ne trouvez pas le fichier, un écran explique la cause la plus
fréquente et comment la lever.

**Un onglet oublié écrasait tout en se fermant** — mesuré : neuf tâches ramenées à une.
Un jeton renouvelé à chaque écriture permet maintenant de détecter qu'un autre onglet est
passé. L'onglet périmé refuse alors d'écrire, définitivement, et le dit.

**Le pointeur d'emplacement perdu pouvait renvoyer les données les plus anciennes.** Les deux
emplacements sont désormais validés et le plus récent l'emporte.

**Le stockage saturait vers 974 tâches**, soit environ un an. Chaque tâche était rangée treize
fois. Elles sont maintenant rangées une seule fois dans un réservoir commun adressé par
empreinte ; un instantané n'est plus qu'une liste de renvois. Coût des instantanés : 3 489 Ko
avant, 629 Ko après. **Plafond : 974 tâches avant, 4 455 après**, soit environ quatre ans.
Un avertissement prévient désormais à 75 % d'occupation.

**La copie de sécurité d'avant restauration n'était pas vérifiée** : si elle échouait, le
remplacement avait lieu quand même, alors que le panneau promet la réversibilité. La
restauration s'interrompt maintenant sans rien toucher.

**Tout rendez-vous passé était reporté et perdait son heure.** Le champ `kind` n'a jamais reçu
d'autre valeur que sa valeur par défaut dans le code de production, si bien que le test qui
devait exclure les rendez-vous était toujours vrai. C'est désormais l'emplacement qui décide.

### Ce qui a été réparé : l'affichage

**Les tâches étaient écrasées par leur bac** et leur texte débordait par-dessus la suivante :
boîte à 34 pixels pour un texte qui en réclamait 53. Les bacs sont des colonnes flexibles, et
sans instruction contraire le navigateur comprime les tâches au lieu de faire défiler. Le champ
de titre, lui, se dimensionnait correctement depuis toujours.

**Deux rendez-vous simultanés rendaient la journée inclicable.** Les pistes de la colonne
mesuraient `0px 98px 98px` : la première, celle des quarante-huit cases cliquables, tombait à
zéro. Les rendez-vous ont maintenant de vrais couloirs. Sur un couloir partagé, la décoration
ne laissait rien au texte, mesuré à zéro pixel ; elle passe en superposition et revient au
survol. Texte : 0 pixel avant, 38 après.

**La barre d'alerte cassait tout l'écran** — un simple avertissement « ouvert dans un autre
onglet » suffisait à faire dessiner les pastilles urgentes par-dessus les en-têtes de jours.

Corriger le premier point rendait les tâches lisibles mais en montrait moins. Un repère
**« + n autres »** annonce donc ce qui dépasse du cadre et y mène d'un clic.

### Vérification

**100 contrôles automatiques**, contre 57, tous verts, aucune erreur JavaScript.

Le plus instructif : le contrôle censé surveiller la troncature des titres mesurait le champ
de texte, qui a toujours été correct, et non la boîte qui le contient. Il passait au vert sur
un défaut visible à l'œil nu. Et rien ne créait deux rendez-vous simultanés — c'est
exactement pourquoi ce défaut a traversé toute la version 1.0.0. Un test qui mesure le mauvais
objet est pire qu'un test absent : il donne une confiance imméritée.

### Ce qui reste à faire

La répartition de l'espace n'est pas engagée : le bac « À faire » reste plafonné à 190 pixels
pendant que la grille horaire garde des centaines de pixels de vide. C'est le cœur du reproche
« la partie chose à faire est trop petite », et c'est l'étape suivante.
L'horizon glissant sur dix jours est reporté après elle : le faire avant reviendrait à le
construire deux fois.

---

## Version 1.0.0 — 2 septembre 2026

Première version. Création complète de l'agenda à partir d'un dépôt vide.

### Avant de coder : trois analyses préalables

Trois agents spécialisés ont été consultés pour éviter de découvrir les problèmes en cours de route.

1. **Ergonomie et fonctionnalités.** A produit la liste des fonctions indispensables, les
   pièges du report automatique, et la liste de ce qu'il ne faut surtout pas faire.
   Conclusion la plus structurante : séparer les tâches sans heure des rendez-vous à heure fixe.
2. **Architecture technique.** A défini le modèle de données, la logique de report idempotente,
   les pièges de date (heure d'été, semaine 53, fuseaux) et l'organisation du fichier unique.
3. **Stratégie de sauvegarde.** A vérifié directement dans le code source de Chrome, Firefox et
   Safari comment chaque navigateur rattache les données à un fichier local. C'est de là que
   vient la recommandation d'utiliser Chrome ou Edge.

### Décisions prises avec vous

| Question | Décision |
|---|---|
| Navigateur | Chrome ou Edge |
| Périmètre de départ | Vague 1 (le socle), puis ajustement à l'usage |
| Sauvegarde automatique | Oui, chaque jour, dans le dossier Téléchargements |
| Priorités | Trois niveaux, ajoutés au socle car indissociables du report |
| Tâche « cette semaine » non faite le dimanche | Arbitrage obligé le lundi matin |
| Troisième niveau | « Quand je peux », report libre, signalé une fois passé un mois |

### Ce qui a été construit

**Structure de l'écran**
- Barre du haut : navigation par semaine, bouton Aujourd'hui, indicateur de sauvegarde, réglages, aide.
- Bandeau « Urgent » traversant toute la semaine.
- Grille de sept jours. Chaque jour a deux étages : un bac « À faire » sans heure, puis la grille horaire.
- Grille découpée en heures et demi-heures, plage horaire réglable (8h–19h par défaut).
- Ligne rouge de l'heure actuelle, traversant la colonne du jour.
- Bas de page : notes de la semaine à gauche, parking à droite. Hauteur ajustable à la souris.

**Les trois priorités**
- Urgent (rouge) : apparaît dans le bandeau de la semaine.
- Cette semaine (orange) : ne franchit pas le dimanche sans arbitrage.
- Quand je peux (gris-bleu) : niveau par défaut, report libre.
- On passe de l'un à l'autre en cliquant sur la pastille ronde, ou avec Alt+1, Alt+2, Alt+3.

**Report automatique**
- Cible toujours « aujourd'hui », jamais « demain ». C'est ce qui garantit qu'ouvrir la page
  dix fois ne duplique rien et ne re-reporte pas en boucle.
- La tâche est déplacée, jamais copiée : un doublon est structurellement impossible.
- La date d'origine n'est jamais modifiée. Le retour en arrière reste donc toujours possible.
- Une tâche reportée perd son heure et va dans le bac « À faire », pour ne pas se poser
  sur un créneau déjà occupé.
- Marqueur ↩ avec le nombre de reports ; un clic dessus la renvoie à sa date d'origine.
- Au-delà de trois reports, la tâche pâlit et se borde de pointillés orange.
- Au-delà de 60 jours (réglable), elle part au parking plutôt que sur la journée. Jamais supprimée.
- Un rendez-vous passé ne se reporte jamais.

**Trois écrans de décision**
- *Le point du lundi* : les tâches « cette semaine » qui n'ont pas passé le dimanche, plus
  celles qui traînent depuis plus d'un mois. Quatre actions par ligne.
- *Le point de fin de journée* : à partir de 17h30 (réglable), les tâches non faites du jour,
  avec Fait / Demain / Date précise / Parking / Abandonner.
- *Le rattrapage après absence* : au-delà de douze tâches en attente, un écran de tri groupé
  par jour d'origine, avec un bouton « tout envoyer au parking ».

**Sauvegarde, en quatre couches**
1. Enregistrement continu dans le navigateur, avec écriture en double emplacement A/B :
   une écriture interrompue ne peut jamais détruire l'état précédent.
2. Instantanés internes : sept quotidiens, quatre hebdomadaires.
3. Fichier `.json` daté déposé automatiquement dans Téléchargements, une fois par jour.
4. Archive HTML autonome mensuelle, qui se rouvre seule dans plusieurs années.

Contrôles à l'import : format, version, présence des tâches, empreinte de contrôle,
cohérence des comptes. Une sauvegarde contenant moins de la moitié des tâches actuelles
déclenche un avertissement explicite. L'état courant est toujours exporté avant tout remplacement.

**Confort**
- Saisie en place, jamais de fenêtre. Entrée valide et ouvre la ligne suivante.
- Titres sur plusieurs lignes : un titre long n'est jamais tronqué.
- Glisser-déposer par la poignée à gauche, vers un jour, un créneau, le bandeau urgent ou le parking.
- Étirement du bas d'un rendez-vous pour changer sa durée.
- Annulation des 25 dernières actions par Ctrl+Z.
- Compteur de charge par jour, qui passe à l'orange au-delà d'un seuil réglable.
- Thème clair ou sombre, couleur d'accent, taille du texte, hauteur des créneaux.
- Impression en paysage, une page, barre d'outils masquée.

**Robustesse**
- Toute manipulation de date confinée dans une seule section, avec interdiction d'en écrire ailleurs.
- Dates stockées en chaînes locales `AAAA-MM-JJ`, comparées comme des chaînes.
- Aucune arithmétique en millisecondes : les jours de changement d'heure font 23 ou 25 heures.
- Détection du changement de jour par comparaison toutes les minutes, ce qui résiste à la
  mise en veille et au changement d'heure.
- Détection d'une horloge système incohérente : aucun report vers le passé.
- Avertissement si deux onglets sont ouverts sur le même agenda.
- Avertissement bloquant si le navigateur refuse d'enregistrer (navigation privée).
- Auto-test intégré : tapez `autoTest()` dans la console du navigateur (touche F12).

### Vérification

Suite de 57 contrôles automatiques dans `tests/verification.mjs`, exécutée dans un vrai
navigateur **en protocole file://**, c'est-à-dire exactement comme en double-clic. Passer par
un serveur local aurait masqué la catégorie de problèmes qui vous frapperait en usage réel.

Résultat : 57 contrôles réussis, aucune erreur JavaScript. Dont 29 assertions internes couvrant
les changements d'heure, les fins d'année, les années bissextiles, la semaine ISO 53,
l'idempotence du report et la détection des sauvegardes corrompues.

### Non inclus dans cette version

- L'horizon glissant sur 10 jours (vous l'aviez retenu ; reporté à la vague suivante).
- Étiquettes de couleur, recherche dans l'historique, tâches récurrentes, modèle de semaine type,
  sous-tâches, note courte par jour, journal automatique de la semaine, plages d'énergie.
