# Historique des modifications

Journal daté de tout ce qui a été fait, dans l'ordre. La version la plus récente est en haut.

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
