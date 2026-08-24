# CORE — Game Design Document (v2)

> Jeu de minage 2D en vue de coupe. **Objectif : atteindre le centre de la planète le plus
> vite possible.** Pas de gestion d'énergie, pas de gestion de survie : on creuse, on
> ramasse des bonus, on choisit des passifs, on va de plus en plus vite.
> Titres alternatifs : *Core*, *6000*, *Plein Centre*, *Vers le Noyau*.

---

## 1. Pitch

6 000 mètres de roche vous séparent du cœur de la planète. Vous avez une pioche et un
chrono qui tourne.

Chaque couche est plus dure que la précédente — mais chaque couche cache aussi des
**surprises** : géodes, cristaux de puissance, cavités, marchands, filons-mères. Vous
montez en niveau en descendant, et à chaque niveau vous **choisissez un passif** parmi
trois. À la fin d'une bonne partie, vous ne creusez plus la roche : vous la **traversez**,
en détruisant 5 blocs de large sur 3 de profondeur à chaque coup, en chute libre, aimant
l'or à travers la pierre.

**Fantasme du joueur** : partir avec une pioche ridicule et finir en foreuse vivante qui
perce une planète en 12 minutes.

---

## 2. Le principe fondateur : tout se paie en secondes

Il n'y a **qu'une seule ressource : le temps.** C'est ce qui rend le jeu simple à
comprendre et facile à équilibrer.

- Un bloc plus dur = plus de secondes.
- Un bonus de vitesse = des secondes gagnées.
- Un piège = des secondes perdues (jamais une mort, jamais un game over).
- Un détour pour ramasser de l'or = des secondes investies, à rentabiliser.

**Formule unique du jeu :**

```
temps_pour_casser_un_bloc = ceil(dureté / force) / vitesse
blocs_détruits_par_coup   = largeur × longueur
```

Tout le reste — passifs, buffs, équipement, surprises — n'est qu'une façon d'agir sur
`force`, `vitesse`, `largeur`, `longueur`. Quatre chiffres. C'est tout le jeu.

**Il n'y a pas de mort.** On ne peut pas perdre une partie, seulement la finir lentement.
C'est ce qui autorise la prise de risque permanente et supprime toute frustration.

---

## 3. Boucle de jeu

```
   [DESCENDRE en creusant]
            │
            ├─► surprise dans un bloc ──► BUFF temporaire (10–30 s de folie)
            ├─► minerai ──────────────► or + XP
            ├─► palier franchi ───────► NIVEAU ──► choix d'1 passif parmi 3
            ├─► marchand rencontré ───► dépenser l'or (permanent)
            ▼
      [CENTRE DE LA PLANÈTE] ──► temps final + récompenses méta
```

Boucle de seconde en seconde : *creuser → un truc brille → l'attraper → aller plus vite*.
Boucle de minute en minute : *palier → level-up → nouvelle build qui se dessine*.
Boucle de partie en partie : *battre son chrono avec une build différente*.

**Durée d'une partie : 15 à 30 min.** Une partie = une descente complète, sans interruption.

---

## 4. Les couches de la planète

8 couches, 6 000 m. La dureté monte par paliers nets, avec une identité visuelle et
sonore forte pour chacune : le joueur doit savoir où il est d'un coup d'œil.

| Couche | Profondeur | Dureté | Identité | Surprises typiques |
|---|---|---|---|---|
| 1. **Terre** | 0–500 m | 1–3 | Brun, racines, vers | Coffres de jardin, tunnels de taupe |
| 2. **Roche sédimentaire** | 500–1200 m | 4–8 | Gris strié, fossiles | Fossiles, veines de charbon explosives |
| 3. **Grottes de cristal** | 1200–2000 m | 9–16 | Violet lumineux | Géodes, cristaux de puissance, grands vides |
| 4. **Ruines englouties** | 2000–3000 m | 17–28 | Pierre taillée, eau | Autels, salles au trésor, marchands |
| 5. **Manteau supérieur** | 3000–4000 m | 29–45 | Basalte noir, braises | Filons-mères d'or, roche vivante |
| 6. **Rivières de magma** | 4000–5000 m | 46–65 | Orange incandescent | Toboggans de lave, cœurs de magma |
| 7. **Noyau externe** | 5000–5800 m | 66–90 | Métal liquide, doré | Mithril, forge ancienne |
| 8. **Le Cœur** | 5800–6000 m | 100 | Blanc aveuglant | Ligne d'arrivée |

**Dureté** : `dureté(p) = 1 + (p / 60)^1.55`, arrondie, ±15 % de bruit.
Elle est calibrée pour qu'**une build correcte progresse à vitesse constante** : la roche
durcit à peu près au même rythme que le joueur monte en puissance. Le joueur ne ralentit
pas — il a juste l'impression de courir de plus en plus vite dans du sirop de plus en plus
épais. Quand il rate ses choix, il le sent immédiatement : ça freine.

**Largeur du puits : 60 blocs.** Bords infranchissables. Assez large pour explorer
latéralement, assez étroit pour ne pas se perdre.

---

## 5. Les surprises (le cœur du fun)

Chaque bloc a une petite chance de cacher quelque chose. La fréquence est calibrée pour
**une surprise toutes les 15–25 secondes** — assez souvent pour que le joueur creuse en se
disant « le prochain, peut-être ».

### 5.1 Surprises « puissance » — donnent un buff temporaire

| Surprise | Effet |
|---|---|
| **Cristal de frénésie** | Vitesse de minage ×2 |
| **Cœur de titan** | Force ×3 — tout casse en un coup |
| **Charge d'expansion** | Largeur de taille : 1 → 3 → 5 blocs |
| **Foret perforant** | Longueur de taille : 1 → 2 → 3 blocs de profondeur |
| **Sablier fêlé** | **Le chrono se fige 10 secondes** (le graal) |
| **Plume de gravité** | Chute libre contrôlée + traverse la roche tendre |
| **Aimant** | Attire tout le loot dans un grand rayon |
| **Fièvre de l'or** | Valeur des minerais ×2 |

### 5.2 Surprises « valeur » — se revendent cher

| Surprise | Rareté | Valeur | Note |
|---|---|---|---|
| Géode | Fréquente | 150–400 | S'ouvre en 2 coups, contenu aléatoire |
| Fossile | Fréquente | 200 | Collection : compléter une série donne un bonus permanent |
| Coffre abandonné | Moyenne | 500 + 1 buff | |
| **Filon-mère** | Rare | 2 000–5 000 | Grosse veine dorée, visible de loin, vaut le détour |
| Artefact ancien | Rare | 3 000 | Débloque un passif définitivement (méta) |
| Cœur de magma | Très rare | 8 000 | Entouré de lave — vrai pari sur le temps |

### 5.3 Surprises « terrain » — modifient la descente

- **Grande caverne** — plusieurs centaines de mètres de chute libre gratuite. Le jackpot du speedrun.
- **Rivière souterraine / toboggan de lave** — transport rapide vers le bas, direction imposée.
- **Wagonnet et rails** — une ligne toute tracée, très rapide, mais horizontale.
- **Champignons rebondissants** — renvoient vers le haut (piège… ou raccourci latéral).
- **Tunnel de ver de roche** — galerie déjà creusée qui serpente vers le bas.
- **Marchand nain** — boutique en pleine descente, dépense ton or maintenant ou jamais.
- **Autel ancien** — choix cornélien : « un passif rare contre 45 secondes de chrono ».

### 5.4 Surprises « pièges » — coûtent des secondes, jamais la partie

- **Nid de chauves-souris** — 2 s d'étourdissement, l'écran part en vrille.
- **Sables mouvants** — vitesse divisée par 2 tant qu'on n'en sort pas.
- **Roche vivante** — les blocs repoussent derrière vous.
- **Éboulement** — la galerie du dessus se rebouche.
- **Poche de gaz** — explosion : projette vers le haut de 10 m.

Design : un piège doit être **drôle et lisible**, pas punitif. On doit avoir envie de dire
« ah, l'enfoiré », pas de fermer le jeu.

### 5.5 Règles des buffs (là où naît le pic de fun)

- Durée de base **20 s**, affichée par des icônes avec compte à rebours.
- Ramasser un buff déjà actif le **relance et le monte d'un niveau** (I → II → III).
- Les buffs **différents se cumulent multiplicativement**.
- Le pic recherché : Frénésie III + Titan II + Expansion III + Perforation II →
  **écran qui tremble, roche pulvérisée sur 5×3, 300 m avalés en 20 secondes.**
  C'est le moment que le joueur voudra reproduire. Tout le jeu est construit pour le rendre
  possible sans le rendre garanti.
- Un compteur de **combo** monte quand on enchaîne les blocs sans pause : plus la build
  est bonne, plus le combo tient, plus il rapporte.

---

## 6. Niveaux et passifs (la build)

### 6.1 Rythme

- **Choix de départ** : avant la partie, 1 métier parmi 3 (tirés aléatoirement) — définit la
  première orientation.
- **XP** : gagnée en profondeur (constante) **et** en minerai (bonus). Ramasser de l'or fait
  donc monter de niveau plus vite → l'exploration n'est jamais du temps pur perdu.
- **Niveau tous les ~250 m** au rythme de base, soit **~24 niveaux** pour une partie complète.
- À chaque niveau : **le jeu se met en pause**, 3 cartes de passifs, on en choisit une.
  Pause volontaire : c'est un moment de respiration et de décision, pas de stress.
- **Reroll** : 1 gratuit par partie, puis payable en or.

### 6.2 Métiers de départ (exemples)

| Métier | Départ |
|---|---|
| **Le Bourrin** | Force ×2, vitesse −20 % |
| **Le Furieux** | Vitesse ×1.5 |
| **Le Chanceux** | +50 % de surprises, stats de base |
| **Le Prospecteur** | Voit les minerais à travers la roche, or ×1.5 |
| **Le Parieur** | Commence 500 m plus bas, mais aucun passif au niveau 1 |

### 6.3 Arbre de passifs — 6 familles + légendaires

**VITESSE**
- *Poignets d'acier* — +12 % vitesse (cumulable à l'infini)
- *Métronome* — chaque bloc miné sans pause : +2 % vitesse, max +50 %, remis à zéro après 2 s d'inactivité
- *Second souffle* — quand un buff expire, +30 % vitesse pendant 5 s

**FORCE**
- *Bras de fer* — +2 force
- *Brise-roche* — 15 % de chance de casser un bloc d'un seul coup, quelle que soit sa dureté
- *Sismique* — la force compte double contre la couche actuelle

**ZONE**
- *Élargisseur* — +1 largeur de taille en permanence (max 5)
- *Perforateur* — +1 longueur de taille en permanence (max 3)
- *Onde de choc* — tous les 10 blocs, détruit un cercle de rayon 2

**MOBILITÉ**
- *Plume* — chutes sans pénalité, chute plus rapide
- *Foreuse gravitationnelle* — **en tombant, on creuse les blocs traversés** (si la force suffit)
- *Rebond* — traverser un vide relance l'élan vers le bas

**BUTIN**
- *Filon élargi* — les veines de minerai contiennent 50 % de blocs en plus
- *Aimant permanent* — ramassage à distance, plus besoin de toucher le loot
- *Prospecteur* — les minerais brillent à travers la roche dans un rayon de 10
- *Cupidité* — valeur +40 %, vitesse −10 %

**CHANCE**
- *Flair* — +25 % de surprises générées
- *Porte-bonheur* — les buffs durent +40 %
- *Collectionneur* — les buffs peuvent monter jusqu'au niveau IV
- *Poussière d'étoile* — 8 % de chance qu'un bloc banal lâche un mini-buff

**LÉGENDAIRES** (rares dans le tirage, changent la partie)
- *Ver de roche* — traverse la roche la plus tendre de la couche sans la miner
- *Noyau instable* — tous les 100 m, une explosion creuse 5 m automatiquement
- *Pacte du magma* — immunité à la lave, et la lave devient un toboggan ultra-rapide
- *Cascade* — chaque buff ramassé en déclenche un second, aléatoire, au niveau I
- *Chronophage* — chaque filon-mère miné retire 20 s au chrono final

**Intention de design** : les familles doivent se **combiner** de façon lisible.
Zone + Force = tout pulvériser. Vitesse + Métronome = fondre la roche tendre.
Chance + Porte-bonheur + Cascade = buffs quasi permanents. Le joueur doit pouvoir dire,
au niveau 10, « ok, ma build c'est **ça** » — et jouer les 14 niveaux suivants pour elle.

---

## 7. L'or et l'équipement

L'or ne sert plus à préparer la descente suivante : il se dépense **pendant** la descente.

- **Marchands nains** rencontrés dans les couches 2, 4, 6 (et parfois ailleurs).
  Vendent des **améliorations permanentes pour la partie en cours** : pioche supérieure
  (+force), gants (+vitesse), tête de foreuse (+largeur/longueur), potion de buff au choix,
  reroll de niveau, ou une **téléportation de 200 m vers le bas**.
- Arbitrage permanent : ramasser de l'or coûte des secondes maintenant, mais en fait gagner
  beaucoup plus tard. Le joueur qui ignore totalement l'or finira lentement ; celui qui
  ramasse tout aussi.
- L'or non dépensé en fin de partie devient de la **monnaie méta**.

---

## 8. Progression méta (entre les parties)

Légère et facultative — le jeu doit être complet dès la première partie.

- **Débloquer de nouveaux passifs et métiers**, qui entreront ensuite dans les tirages.
- **Collections** (fossiles, artefacts) → petits bonus permanents.
- **Tableau des records** : meilleur temps global, meilleur temps par couche (comme les
  *splits* d'un speedrun), meilleur temps par métier.
- **Seed du jour** : tout le monde joue la même planète, classement quotidien.
- **Modes** :
  - *Course* — 0 → 6000 m, chrono, le mode principal.
  - *Balade* — pas de chrono, on explore, on collectionne.
  - *Sprint* — 1 000 m seulement, parties de 3 min.

---

## 9. Commandes et interface

**Desktop** — `Z/Q/S/D` pour se déplacer, `Espace` pour sauter. On mine **automatiquement**
le bloc dans la direction où l'on va : pas de clic répété, pas de crampe. Se diriger = miner.
`Tab` pour la carte.

**Mobile** — un pouce sur un joystick virtuel. Rien d'autre. Le jeu doit être jouable
entièrement à une main.

**HUD minimal**
- En haut au centre : **la profondeur en gros** et **le chrono**. Ce sont les deux seules
  informations vitales.
- En haut à gauche : barre d'XP + niveau.
- En haut à droite : or, et les icônes de buffs actifs avec leur compte à rebours.
- Sur le côté : liste discrète des passifs acquis.
- Rien d'autre. Pendant une partie, aucun menu ne s'ouvre à part le choix de niveau.

**Feedback** — c'est là que se joue le fun :
fissures progressives, éclats de roche à la couleur de la couche, écran qui tremble sous
les gros coups, ralenti de 0,2 s quand un filon-mère apparaît, distorsion de l'écran en
pleine frénésie, musique dont les couches d'instruments s'ajoutent quand le combo monte, et
un **son unique et jubilatoire pour l'or**. La sensation de creuser doit être bonne au bout
de trois secondes de jeu, avant même le premier bonus.

---

## 10. Périmètre

### MVP — le jeu est déjà fun

- Descente, gravité, minage automatique directionnel, chrono.
- 3 couches (0–2000 m), dureté progressive.
- 4 buffs : vitesse, force, largeur, longueur, avec cumul et niveaux I–III.
- Level-up tous les 250 m, 12 passifs répartis dans 4 familles.
- 6 surprises, dont la grande caverne et le coffre.
- Or, minerai, un marchand.
- Écran de fin : temps total + splits.

### V1

- Les 8 couches jusqu'au Cœur, tous les buffs dont le Sablier.
- ~30 passifs, 6 familles + légendaires, 5 métiers de départ.
- Tout le bestiaire de surprises : autels, wagonnets, toboggans de lave, filons-mères, pièges.
- Records, splits par couche, mode Sprint.

### V2

- Seed du jour et classements.
- Collections et progression méta.
- Événements de couche (pluie de météores, ruée vers l'or, couche entièrement en cristal).
- Deuxième planète : gravité, couches et surprises différentes.
- Fantômes de course : le replay de son meilleur temps creuse à côté de soi.

---

## 11. Ce qui a changé depuis la v1, et pourquoi

| v1 | v2 | Raison |
|---|---|---|
| Jauge d'énergie | **Supprimée** | Une seule ressource : le temps. Plus simple, plus nerveux. |
| Gestion du poids du sac | **Supprimée** | De la logistique, pas du fun. |
| Descentes / remontées répétées | **Une seule descente continue** | L'objectif est une course vers le centre, les allers-retours la cassent. |
| Boutique en surface entre les runs | **Marchands en cours de descente** | Garde le joueur dans la mine. |
| Progression par achats | **Progression par passifs choisis** | Des décisions, pas des paliers de prix. |
| Dangers punitifs | **Pièges qui coûtent des secondes** | Aucun échec possible, donc prise de risque libre. |
| Butin = argent | **Butin = argent + XP + buffs** | L'exploration doit toujours récompenser. |

---

## 12. Questions encore ouvertes

1. **Faut-il des checkpoints ?** Proposition : non en mode Course (l'intérêt est le run
   complet), oui en mode Balade.
2. **Le chrono s'arrête-t-il pendant le choix de passif ?** Proposition : oui — sinon le
   joueur choisit sous pression et prend toujours la même carte.
3. **Descente strictement verticale ou exploration latérale ?** Proposition : le chemin le
   plus court est vertical, mais les meilleures surprises sont sur les côtés. C'est
   l'arbitrage central du jeu, à équilibrer finement.
4. **Longueur cible d'une partie parfaite** : proposition 12–15 min pour un très bon joueur,
   ~30 min pour une première partie.
5. **Un boss au centre ?** Proposition : non — juste une ligne d'arrivée spectaculaire.
   Le jeu ne parle pas de combat.
