# Idées

Toutes les idées évoquées pour l'agenda : ce qui est fait, ce qui attend, ce qui est écarté et pourquoi.

---

## Retenues et faites (version 1.0.0)

| Idée | D'où elle vient |
|---|---|
| Séparer le bac « À faire » sans heure et la grille horaire | Analyse ergonomie. Environ 80 % de ce qu'on note n'a pas d'heure. Sans cette séparation, le report automatique n'a pas de sens : on ne reporte pas un rendez-vous. |
| Trois niveaux de priorité | Votre demande |
| Arbitrage obligé le lundi | Votre décision |
| Point de fin de journée | Analyse ergonomie, retenu par vous |
| Parking | Analyse ergonomie. C'est la soupape sans laquelle le report fait converger toutes les dettes vers aujourd'hui. |
| Report visible et réversible, marqueur ↩ | Analyse ergonomie. Un report silencieux détruit la confiance plus vite qu'un bug. |
| Dette de report visible au-delà de trois reports | Analyse ergonomie |
| Écran de rattrapage après absence | Analyses ergonomie et technique |
| Sauvegarde automatique quotidienne | Analyse sauvegarde, votre décision |
| Annulation par Ctrl+Z | Analyse ergonomie |
| Glisser-déposer | Analyse ergonomie |
| Compteur de charge par jour | Analyse ergonomie |
| Titres sur plusieurs lignes | Constaté en testant : un titre long était tronqué et illisible |
| Impression paysage sur une page | Analyse technique |

---

## En réserve — vague suivante

Classées par ce que j'estime être le meilleur rapport entre l'utilité au quotidien et le travail nécessaire.

### Priorité haute

**L'horizon glissant sur 10 jours** — *vous l'aviez retenu*
Une vue montrant la fin de la semaine en cours plus le début de la suivante. À partir du mercredi,
la vraie question n'est plus « que fait-on cette semaine » mais « qu'est-ce qui bascule sur la
semaine prochaine ». Un semainier strict coupe la pensée là où elle continue.

**Recherche instantanée (Ctrl+F)**
Sur tout l'historique, semaines passées et notes comprises. « J'avais noté ça il y a trois semaines. »
Devient indispensable dès que quelques mois de données se sont accumulés.

**Étiquettes de couleur, quatre à six maximum**
Perso, pro, en attente, réunion. Au-delà de six, plus personne ne s'en sert.

**Le journal automatique de la semaine** — *vous l'aviez retenu*
Un panneau « Fait cette semaine » qui se remplit tout seul avec les tâches cochées, horodatées,
groupées par jour, avec un bouton Copier. Coût pour vous : zéro. Utile pour un bilan, un point
avec quelqu'un, une facturation, ou simplement votre mémoire.

### Priorité moyenne

**Tâches récurrentes simples** — tous les lundis, tous les jours ouvrés, le 1er du mois.
Attention : une occurrence non faite ne doit pas se reporter, sinon « faire du sport » s'empile
cinq fois en une semaine. Une seule instance vivante par récurrence.

**Modèle de semaine type** — vos réunions fixes appliquées d'un clic sur une semaine vide.

**Sous-tâches** — une mini liste à cocher dépliable sous une tâche, sans changer d'écran.

**Note courte par jour**, en plus de la note de semaine.

**Champ échéance** — deux cas distincts : à faire *le* jour J (n'apparaît pas avant), et à faire
*avant* J (bascule automatiquement en urgent à J-1, reste visible « en retard » au-delà).

### Priorité basse

**Les plages d'énergie** — colorier le fond de la journée type selon votre rythme :
concentration le matin, creux après le déjeuner, administratif en fin de journée. Séduisant,
mais à ne faire qu'une fois que l'usage quotidien est bien installé.

**Zone « ça ne se fait pas »** — au-delà de cinq reports, extraire la tâche au-dessus de la
semaine avec trois questions : trop grosse (découper), mal datée (planifier), inutile (abandonner).
La version actuelle se contente de la faire pâlir, ce qui est peut-être suffisant.

**Navigation complète au clavier dans la grille** — flèches pour se déplacer de créneau en créneau.
Utile si vous préférez le clavier à la souris.

---

## Écartées

| Idée | Pourquoi |
|---|---|
| Statistiques de productivité, séries, scores | Sur un outil personnel ouvert tous les jours, la gamification devient de la culpabilisation, puis de l'évitement. |
| Suppression ou archivage automatique | L'agenda propose, il ne décide jamais. Même après trente reports. |
| Confirmation « êtes-vous sûr ? » | Action immédiate plus annulation. Vingt confirmations par jour sont insupportables. |
| Fenêtre modale pour créer une tâche | Le coût mental d'une fenêtre est supérieur au bénéfice de noter la tâche. |
| Afficher les 24 heures de la journée | Une grille vide à 90 % est illisible et donne l'impression d'un outil vide. |
| IndexedDB comme stockage | Bloqué en fichier local sous Firefox. Une fonction qui marche chez le développeur et pas chez vous est pire qu'une fonction absente. |
| File System Access API comme socle | Absente de Firefox et Safari. Utilisable en bonus, jamais comme fondation de plusieurs années de données. |
| Stocker les données dans le fichier HTML lui-même | Chaque enregistrement créerait `agenda(1).html`, `agenda(2).html`… et vous continueriez à ouvrir le fichier d'origine devenu périmé. Excellente archive figée, mauvais fichier de travail. Conservé uniquement comme archive mensuelle. |
| Mini serveur local | Techniquement supérieur, mais il faut installer Python, garder un terminal ouvert et relancer après chaque redémarrage. Chaque étape est un point d'abandon. |
| Polices ou icônes chargées depuis internet | Le fichier doit fonctionner hors ligne, sur une machine sans réseau, dans dix ans. |
| Synchronisation entre plusieurs ordinateurs | Impossible sans serveur. Copier le fichier HTML ne copie aucune donnée : il est vide. |
