# Mode d'emploi

Tout ce qu'il faut savoir pour utiliser l'agenda au quotidien. Rien de technique.

---

## 1. Installation

1. Rangez `agenda.html` dans un dossier où vous le laisserez **définitivement**.
   Par exemple `Documents\Agenda\agenda.html`.
2. Double-cliquez dessus.
3. Épinglez l'onglet dans votre navigateur, ou faites-en un raccourci sur le bureau.

**Utilisez Chrome ou Edge.** Ce n'est pas un détail de confort, c'est une question de
sécurité de vos données. Voir la section 7.

---

## 2. Les trois zones de l'écran

**Le bandeau rouge « Urgent »**, tout en haut, traverse la semaine entière. Ce qui est là
n'appartient à aucun jour : c'est ce qui doit être fait maintenant.

**La grille des sept jours.** Chaque jour a deux étages :
- en haut, le bac **« À faire »** : des tâches sans heure, qu'on coche ;
- en dessous, la **grille horaire**, découpée en heures et demi-heures, pour les rendez-vous.

La distinction est importante : **seules les tâches du bac se reportent**. Un rendez-vous
passé ne se déplace jamais tout seul au lendemain.

**Le bas de page.** Vos notes de la semaine à gauche, le parking à droite.
Attrapez la fine barre au-dessus pour l'agrandir ou le réduire.

---

## 3. Écrire dans l'agenda

- **Cliquez dans un jour** et tapez. C'est tout. Aucune fenêtre ne s'ouvre jamais.
- **Entrée** valide et ouvre la ligne suivante. Vous pouvez noter dix choses d'affilée.
- **Échap** sort du champ. Une ligne laissée vide disparaît toute seule.
- **Cliquez sur un créneau horaire** pour poser un rendez-vous à cette heure précise.
- **Étirez le bas d'un rendez-vous** pour changer sa durée.
- **Attrapez la poignée** à gauche d'une tâche (elle apparaît au survol) pour la déplacer
  vers un autre jour, un créneau, le bandeau urgent ou le parking.

---

## 4. Les trois priorités

Cliquez sur la **pastille ronde** à droite d'une tâche pour passer d'un niveau au suivant.

| | Niveau | Comportement |
|---|---|---|
| 🔴 | **Urgent** | Apparaît dans le bandeau rouge de la semaine. Réservez-le à ce qui doit être fait maintenant : si tout est urgent, plus rien ne l'est. |
| 🟠 | **Cette semaine** | Se reporte de jour en jour, mais **ne franchit pas le dimanche** sans votre décision. Le lundi matin, l'agenda vous demande d'arbitrer. |
| 🔵 | **Quand je peux** | Le niveau par défaut. Report libre, aucune alerte. Signalée une seule fois si elle traîne depuis plus d'un mois. |

C'est volontairement le niveau le plus bas qui est le niveau par défaut : vous ne qualifiez
que ce qui compte, tout le reste ne vous demande rien.

---

## 5. Le report automatique

Une tâche du bac « À faire » qui n'est pas cochée réapparaît le lendemain, avec une **flèche ↩**
et le nombre de fois où elle a été reportée. Elle arrive dans le bac du jour, jamais sur un
créneau horaire.

- **Cliquez sur la flèche ↩** pour la renvoyer à sa date d'origine.
- **Au-delà de trois reports**, la tâche pâlit et se borde de pointillés orange. Ce n'est pas
  un reproche : c'est un signal que la tâche est peut-être mal formulée. Trop grosse ?
  Découpez-la. Mal datée ? Datez-la. Inutile ? Abandonnez-la.
- **Au-delà de 60 jours** (réglable), elle part au parking plutôt que sur votre journée.
  Elle n'est jamais supprimée.

**Rien n'est jamais supprimé automatiquement.** L'agenda propose, il ne décide pas.

---

## 6. Les trois écrans qui vous font décider

**Le point du lundi.** Les tâches « cette semaine » qui n'ont pas passé le dimanche.
Pour chacune : la garder pour cette semaine, la passer en urgent, la rétrograder, l'abandonner.
Un bouton « tout garder pour cette semaine » vous libère en un clic.

**Le point de fin de journée.** À partir de 17h30 (réglable), les tâches non faites du jour,
avec cinq boutons : Fait, Demain, une date précise, Parking, Abandonner. Trente secondes.
Si vous fermez l'écran, tout est simplement reporté à demain : vous ne perdez rien.

**Le rattrapage après absence.** Si vous revenez après des vacances avec beaucoup de tâches
en attente, l'agenda ne les déverse pas sur votre lundi matin. Il vous les montre groupées
par jour d'origine, avec un bouton « tout envoyer au parking ».

---

## 7. Vos données — la partie importante

### Ce qu'il faut comprendre

**Le fichier `agenda.html` ne contient pas vos données.** Il contient le programme.
Vos tâches sont rangées par le navigateur, dans un espace attaché à ce fichier.

C'est pour cette raison qu'envoyer `agenda.html` à quelqu'un, ou le copier sur un autre
ordinateur, ne transporte aucune tâche : le fichier est vide.

### La règle d'or

> **Un dossier, un nom, on n'y touche plus. Chrome ou Edge.**

| Navigateur | Si vous renommez ou déplacez le fichier |
|---|---|
| **Chrome / Edge** | Vos données sont conservées. |
| Firefox | L'agenda s'ouvre vide. Rien n'est détruit : remettez le fichier à son nom et son emplacement exacts, et tout revient. |
| Safari | Refuse de stocker quoi que ce soit pour un fichier local. |

Attention sous Windows : la fonction « Sauvegarde des dossiers » de OneDrive peut déplacer
votre dossier Documents sans vous prévenir. Sous Chrome, aucune conséquence.
Sous Firefox, votre agenda s'ouvrirait vide un matin sans que vous ayez rien fait.

### Ce qui peut effacer vos données

Par ordre de probabilité réelle :

1. **Vous videz les données de navigation.** Dans Chrome, la case *Images et fichiers en cache*
   est inoffensive. La case ***Cookies et autres données de sites* détruit tout.**
   Deux cases voisines, un clic d'écart.
2. Le réglage « Effacer les cookies et données à la fermeture », s'il est actif.
3. La navigation privée : tout est jeté à la fermeture. N'ouvrez jamais l'agenda ainsi.
4. Un changement de navigateur ou de profil.

Aucune astuce technique ne protège de cela. **Seules les sauvegardes protègent.**

### Vos sauvegardes

**À la première ouverture de chaque journée, un fichier daté tombe tout seul dans votre
dossier Téléchargements**, du type `agenda-2026-09-02.json`. C'est un vrai fichier sur votre
vrai disque : il survit à un vidage du navigateur, à un changement de navigateur, à une
réinstallation de Windows.

Votre navigateur demandera **une seule fois** l'autorisation d'enregistrer plusieurs fichiers.
Acceptez.

La pastille en haut à droite vous dit où vous en êtes : verte si c'est récent, orange au-delà
d'une semaine, rouge au-delà de deux.

**Une fois par mois**, copiez le contenu de votre dossier Téléchargements vers OneDrive,
Google Drive ou une clé USB. Vos données sortent alors de la machine.

### Restaurer

1. Ouvrez `agenda.html`.
2. Bouton **Sauvegarde** en haut à droite.
3. **Choisir un fichier…** puis prenez le plus récent : les noms sont datés.
4. Un aperçu vous montre ce que vous allez récupérer (« 342 tâches, 89 notes »). Confirmez.

Une copie de votre état actuel est téléchargée automatiquement avant tout remplacement.
La restauration est donc réversible.

**Faites cet essai une fois, tout de suite, sans attendre d'en avoir besoin.**
Une restauration jamais testée est une restauration qui ne marche pas.

---

## 8. Raccourcis clavier

| Touche | Effet |
|---|---|
| `N` | Nouvelle tâche aujourd'hui |
| `Entrée` | Valider et créer la ligne suivante |
| `Échap` | Sortir du champ de saisie |
| `Alt` + `1` `2` `3` | Priorité de la tâche en cours de saisie |
| `←` `→` | Semaine précédente / suivante |
| `T` | Revenir à aujourd'hui |
| `Ctrl` + `Z` | Annuler la dernière action |
| `Ctrl` + `P` | Imprimer la semaine |
| `?` | Aide |

---

## 9. Réglages

Bouton engrenage, en haut à droite. Tout est modifiable à tout moment, rien n'y touche
à vos tâches. Vous y trouverez le thème clair ou sombre, la couleur d'accent, la taille du
texte, la plage horaire affichée, l'affichage du week-end, le comportement du report,
l'heure du point de fin de journée et la fréquence des sauvegardes.

---

## 10. En cas de problème

**L'agenda s'ouvre vide alors que j'avais des tâches.**
Le fichier a-t-il changé de nom ou d'emplacement ? Remettez-le où il était.
Sinon, restaurez une sauvegarde (section 7).

**Un bandeau rouge dit que le stockage est indisponible.**
Vous êtes probablement en navigation privée, ou sur Safari. Ouvrez le fichier dans
une fenêtre normale de Chrome ou Edge.

**Un message dit que l'agenda est ouvert dans un autre onglet.**
Fermez l'onglet en trop, puis rechargez celui que vous gardez. Deux onglets ouverts sur
le même agenda peuvent s'écraser mutuellement.

**Rien ne se télécharge quand je clique sur Sauvegarde.**
Le navigateur a peut-être bloqué le téléchargement. Utilisez alors
**Sauvegarde → Afficher et copier**, et collez le texte dans un fichier bloc-notes.
Ce chemin fonctionne toujours.
