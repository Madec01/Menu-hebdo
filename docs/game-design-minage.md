# CORE — Game Design Document (v3)

> On pilote une **foreuse** au clavier. On perce la planète couche par couche, en
> **niveaux courts et enchaînés**, jusqu'à son centre — le plus vite possible.
> Pas d'énergie, pas de survie : le seul adversaire est le chrono.
> Titres alternatifs : *Core*, *4000*, *Foreuse*, *Plein Centre*.

---

## 1. Le principe fondateur : tout se paie en secondes

Une seule ressource : **le temps**. Un bloc dur coûte des secondes, un bonus en fait gagner,
un piège en fait perdre. Il n'y a pas de mort, pas de game over — seulement un chrono plus
ou moins bon.

**Les deux formules qui gouvernent tout le jeu :**

```
temps_pour_percer_un_bloc = ceil(dureté / force) / (vitesse × élan)
blocs_percés_par_coup     = largeur × longueur
```

Tout le contenu — bonus, passifs, pièces de foreuse — n'agit que sur **quatre chiffres** :
`force`, `vitesse`, `largeur`, `longueur`. C'est compréhensible en dix secondes de jeu et
équilibrable sur un tableur.

**Invariant d'équilibrage** : à tout moment de la partie, un joueur qui fait des choix
corrects doit casser un bloc en **1 à 4 coups**. Jamais 1 (plus aucune résistance),
jamais 10 (mur infranchissable).

---

## 2. La foreuse et les commandes

C'est le cœur de la sensation de jeu. Tout doit passer par la **conduite**.

### 2.1 La machine

- La foreuse occupe **2 × 2 blocs** et creuse donc une galerie de **2 blocs de large** par défaut.
- Elle possède une **tête de forage orientable** : un gros foret visible, toujours tourné
  dans la direction où l'on va.
- Elle a des **chenilles** : elle roule au sol et dans les galeries déjà creusées, et
  **tombe** dans le vide.

### 2.2 Commandes — huit directions, un seul bouton

```
        Z / ↑              ↖ Z+Q      Z / ↑     ↗ Z+D
    Q ←   ✚   → D            Q ←     [FOREUSE]    → D
        S / ↓              ↙ S+Q      S / ↓     ↘ S+D
```

| Touche | Effet |
|---|---|
| `Z Q S D` / flèches | Dirige la foreuse. **La direction pressée est la direction de forage.** Pas de bouton « miner » : avancer, c'est percer. |
| Deux touches | Forage en **diagonale** — creuse un escalier, très utile pour longer un filon. |
| `Espace` | **Turbo** : 2 s à vitesse ×2, recharge 15 s. Le seul bouton d'action du jeu. |
| Direction opposée | **Marche arrière** rapide, sans forer, pour se dégager dans un tunnel existant. |
| `Tab` | Carte du niveau. |

Sur mobile : un pouce, un joystick virtuel, un bouton turbo. Rien d'autre.

### 2.3 Les règles de conduite (là où se joue le skill)

Cinq règles simples qui créent toute la profondeur du pilotage :

1. **Rotation de la tête — 0,2 s.** Changer de direction fait pivoter le foret, visiblement.
   Le zigzag n'est pas gratuit : les trajectoires propres sont récompensées.
2. **Élan.** Forer dans la même direction fait monter une jauge d'élan de 0 à 100 %, qui
   augmente la vitesse de forage jusqu'à **+50 %**. Changer de direction en fait perdre la
   moitié. C'est le combo, incarné dans la conduite plutôt qu'affiché dans un coin.
3. **Forer vers le haut coûte le double.** Gravité, débris qui retombent. Remonter est donc
   une vraie décision, jamais un réflexe.
4. **Rouler dans une galerie déjà creusée est ~4× plus rapide que forer.** Les tunnels
   qu'on laisse derrière soi deviennent des autoroutes — un joueur qui creuse proprement se
   déplace vite ; un joueur qui creuse en gruyère se perd dans son propre gruyère.
5. **La chute libre est gratuite.** Dans le vide, on tombe vite, on garde le contrôle
   latéral, et on peut forer vers le bas à pleine vitesse : la vitesse de chute s'ajoute à
   l'élan. Trouver une caverne, c'est trouver un raccourci.

**Contre un bloc indestructible** : la foreuse cale, l'écran tremble, l'élan retombe.
Sanction lisible, jamais bloquante — il y a toujours un autre chemin.

### 2.4 Pièces de foreuse (achetées entre les niveaux)

| Pièce | Améliore | Ce que le joueur ressent |
|---|---|---|
| **Tête de forage** | `force` | « Cette roche ne me résiste plus » |
| **Moteur** | `vitesse` | Tout fond plus vite |
| **Élargisseur** | `largeur` 2 → 5 | Le tunnel devient un boulevard |
| **Lances perforantes** | `longueur` 1 → 3 | On mord 3 blocs de profondeur d'un coup |
| **Chenilles** | Vitesse dans les galeries | Les allers-retours ne coûtent plus rien |
| **Gyroscope** | Rotation quasi instantanée | Le zigzag devient viable |
| **Aspirateur** | Ramasse le minerai à distance | Plus besoin de toucher le loot |
| **Turbo amélioré** | Durée ↑ / recharge ↓ | |
| **Phares** | Rayon de vision | Indispensable en couches profondes |

---

## 3. Structure : des niveaux courts, beaucoup de niveaux

**6 couches × 3 niveaux = 18 niveaux**, du sol au centre (4 000 m).
**Un niveau dure 45 à 90 secondes.** Une partie complète : **15 à 25 minutes.**

```
COUCHE (650 m)
 ├── Niveau 1 — 200 m — variante
 ├── Niveau 2 — 200 m — variante
 └── Niveau 3 — 250 m — LE SCEAU (fin de couche)
        │
        ▼  [ STATION DE FORAGE ]  ← le chrono s'arrête
             • split du niveau + médaille (bronze / argent / or)
             • choix d'1 passif parmi 3
             • boutique : dépenser l'or en pièces de foreuse
             • sauvegarde
        │
        ▼  COUCHE SUIVANTE
```

Chaque niveau se termine sur une **station de forage** : une plateforme creusée dans le
socle, où le chrono se fige. C'est le moment de respiration, de décision et de sauvegarde.

**Ce que la structure en niveaux courts apporte :**
- On peut **s'arrêter entre deux niveaux** — le jeu devient jouable par tranches de 2 min.
- Chaque niveau a **son propre chrono et sa médaille** : on rejoue un niveau seul pour
  améliorer son split, sans refaire toute la partie.
- **18 choix de passifs** par partie au lieu d'une longue montée molle : la build se
  dessine vite et se ressent tout du long.
- Les pics de difficulté sont **cadrés** : une couche rate, ce n'est pas une partie perdue.

### 3.1 Variantes de niveaux (pour que 18 niveaux ne se ressemblent pas)

| Variante | Règle | Ce que ça provoque |
|---|---|---|
| **Descente** | Atteindre le fond. | Le niveau de base : ligne droite ou détours ? |
| **Gisement** | La sortie est scellée tant qu'on n'a pas ramassé X minerai. | Force l'exploration latérale. |
| **Effondrement** | Le plafond descend en continu. | Pression pure, pas le temps de fouiller. |
| **Dédale** | Beaucoup de roche indestructible, un seul passage. | Lecture du terrain plutôt que force brute. |
| **Filon** | Une immense veine d'or serpente vers le fond. La suivre paie, la quitter va plus vite. | L'arbitrage central du jeu, en un niveau. |
| **Chute** | Une grande caverne, presque pas de roche. | Défouloir de 20 s, récompense. |
| **Le Sceau** | Fin de couche : un bouchon massif à percer. | Vérifie que la foreuse a été améliorée. |

### 3.2 Le Sceau (fin de couche)

Le socle qui sépare deux couches est indestructible, sauf un **bouchon de dureté fixe et
élevée**. Si la force de la foreuse est insuffisante, ce n'est pas bloqué — c'est
**lent**, et le chrono le fait sentir. C'est le seul point du jeu qui vérifie la
progression, et il le fait sans jamais fermer la porte.

Petit rituel à chaque fois : la roche se fissure, le bouchon cède, la foreuse bascule dans
le vide de la couche suivante — un plan large, une nouvelle palette, une nouvelle musique.

---

## 4. Les couches

Chaque couche apporte **une mécanique signature** et une identité visuelle et sonore
tranchée. Le joueur doit savoir où il est d'un coup d'œil, et apprendre une chose nouvelle
à chaque fois.

**Dureté du terrain** : `dureté(p) = 1 + 100 × (p / 4000)²`.
La force de la foreuse doit suivre la même courbe (voir l'invariant du §1).

---

### Couche 1 — LA TERRE · 0 à 650 m · dureté 1–4
*Brun, racines, vers de terre, lumière du jour qui s'éloigne.*

- **Blocs** : terre (1), argile (2), caillou (4), **racines** (élastiques : on rebondit dessus).
- **Minerai** : cuivre.
- **Mécanique signature** : aucune — c'est le tutoriel. Tout cède, on apprend à conduire.
- **Surprises** : coffres de jardin, tunnels de taupe, vieux puits.
- **Sceau** : bouchon de béton (dureté 6).

### Couche 2 — LES SÉDIMENTS · 650 à 1 300 m · dureté 5–12
*Gris strié en couches horizontales, fossiles, poussière.*

- **Blocs** : grès (5), schiste (8), calcaire dur (12), **poche de charbon** (explose et
  détruit tout autour d'elle).
- **Minerai** : charbon, fer.
- **Mécanique signature** : **les explosions en chaîne**. Une poche de charbon en allume une
  autre. On apprend à provoquer des réactions plutôt qu'à forer.
- **Surprises** : fossiles (collection), veines de fer, premiers marchands.
- **Sceau** : dalle calcaire (dureté 16).

### Couche 3 — LES GROTTES DE CRISTAL · 1 300 à 1 950 m · dureté 13–24
*Violet lumineux, reflets, grands vides, sons cristallins.*

- **Blocs** : cristal tendre (13, **se brise en réaction en chaîne** avec ses voisins),
  quartz (20), géode (24).
- **Minerai** : argent, gemmes.
- **Mécanique signature** : **les cascades de cristal**. Un bon angle d'attaque effondre
  vingt blocs d'un coup. La couche la plus jouissive du jeu.
- **Surprises** : géodes, cristaux de puissance (les meilleurs bonus), immenses cavernes.
- **Sceau** : cœur de quartz (dureté 30).

### Couche 4 — LES RUINES ENGLOUTIES · 1 950 à 2 600 m · dureté 25–42
*Pierre taillée, colonnes, eau stagnante, écho.*

- **Blocs** : brique ancienne (25), pierre gravée (40), **murs indestructibles** qui
  dessinent des salles et des couloirs.
- **Minerai** : or (première apparition en quantité).
- **Mécanique signature** : **la navigation**. On ne peut plus tout percer : il faut lire
  l'architecture, trouver les portes, choisir un chemin.
- **Surprises** : salles au trésor, autels (« un passif rare contre 30 secondes »),
  pièges à fléchettes, marchand installé dans un temple.
- **Sceau** : porte scellée (dureté 50).

### Couche 5 — LE MANTEAU · 2 600 à 3 250 m · dureté 43–66
*Basalte noir, braises, coulées orange, grondement continu.*

- **Blocs** : basalte (43), obsidienne (60), **roche vivante** (repousse derrière vous),
  **lave** (liquide : dégâts de temps, mais aussi toboggan si on est immunisé).
- **Minerai** : or riche, rubis.
- **Mécanique signature** : **la lave**. Obstacle mortel pour le chrono, autoroute pour qui
  a le bon passif. La même chose est un piège ou un raccourci selon la build.
- **Surprises** : filons-mères, cœurs de magma (très gros butin, entourés de lave).
- **Sceau** : croûte de magma refroidie (dureté 75).

### Couche 6 — LE NOYAU EXTERNE · 3 250 à 3 900 m · dureté 67–96
*Métal en fusion, doré, aveuglant, bourdonnement électrique.*

- **Blocs** : métal en fusion (67), alliage stellaire (90), **plaques magnétiques** qui
  attirent ou repoussent violemment la foreuse.
- **Minerai** : mithril, métal stellaire.
- **Mécanique signature** : **le magnétisme**. La trajectoire n'appartient plus tout à fait
  au joueur : il faut composer avec les champs, s'en servir pour être projeté vers le bas.
- **Surprises** : forge ancienne (améliore une pièce gratuitement), veines de mithril.
- **Sceau** : le dernier — la coque du Cœur (dureté 100).

### LE CŒUR · 3 900 à 4 000 m
*Blanc. Silence. Puis tout s'illumine.*

Pas de combat, pas de boss : une **ligne d'arrivée spectaculaire**. Le chrono s'arrête, les
splits des 18 niveaux défilent, les médailles tombent, le temps total s'affiche.

---

## 5. Les bonus temporaires

Trouvés dans les blocs, à raison d'**un toutes les 15 à 25 secondes**. Ce sont eux qui
créent les pics de fun.

| Bonus | Effet | Durée |
|---|---|---|
| **Frénésie** | Vitesse de forage ×2 | 20 s |
| **Titan** | Force ×3 — presque tout cède en un coup | 15 s |
| **Expansion** | Largeur de taille 2 → 4 → 6 | 20 s |
| **Perforation** | Longueur de taille 1 → 2 → 3 | 20 s |
| **Sablier fêlé** | **Le chrono se fige 10 secondes** | 10 s |
| **Plume** | Chute rapide et contrôlée, traverse la roche tendre | 15 s |
| **Aimant** | Ramasse tout le minerai à grande distance | 30 s |
| **Fièvre de l'or** | Valeur du minerai ×2 | 30 s |

**Règles de cumul :**
- Ramasser un bonus déjà actif le **relance et le monte d'un cran** (I → II → III).
- Les bonus **différents se cumulent multiplicativement**.
- Le pic recherché : *Frénésie III + Titan II + Expansion III + Perforation II* — la foreuse
  ne creuse plus, elle **efface** la roche sur 6 blocs de large et 3 de profondeur.
  Tout le jeu est construit pour rendre ce moment atteignable sans jamais le garantir.

**Pièges** (jamais mortels, seulement coûteux en secondes) : nid de chauves-souris
(2 s d'étourdissement), sables mouvants (vitesse ÷2), roche vivante, éboulement,
poche de gaz (projection vers le haut). Un piège doit faire dire « ah, l'enfoiré », pas
faire fermer le jeu.

---

## 6. Passifs : un choix à chaque niveau

- **Avant la partie** : un métier parmi 3 (Bourrin : force ×2, vitesse −20 % · Furieux :
  vitesse ×1,5 · Chanceux : +50 % de bonus · Prospecteur : voit le minerai à travers la
  roche · Parieur : commence une couche plus bas, sans passif de départ).
- **À la fin de chaque niveau** : 3 cartes, on en choisit une. **18 choix par partie.**
  Le chrono est arrêté : on décide au calme.
- **1 reroll gratuit** par partie, les suivants coûtent de l'or.

**Six familles, qui doivent se combiner de façon lisible :**

- **VITESSE** — *Poignets d'acier* (+12 % cumulable) · *Métronome* (l'élan monte deux fois
  plus vite et retombe deux fois moins) · *Second souffle* (+30 % pendant 5 s à l'expiration
  d'un bonus)
- **FORCE** — *Bras de fer* (+2 force) · *Brise-roche* (15 % de casser un bloc d'un coup,
  quelle que soit sa dureté) · *Sismique* (force doublée contre la couche en cours)
- **ZONE** — *Élargisseur* (+1 largeur permanent) · *Perforateur* (+1 longueur permanent) ·
  *Onde de choc* (tous les 10 blocs, détruit un cercle de rayon 2)
- **PILOTAGE** — *Gyroscope* (rotation instantanée) · *Foreuse gravitationnelle* (**on fore
  en tombant, à pleine vitesse**) · *Turbocompresseur* (turbo deux fois plus souvent) ·
  *Marche arrière sportive* (on fore aussi en reculant)
- **BUTIN** — *Filon élargi* (+50 % de blocs par veine) · *Aimant permanent* ·
  *Prospecteur* (le minerai brille à travers la roche) · *Cupidité* (+40 % de valeur,
  −10 % de vitesse)
- **CHANCE** — *Flair* (+25 % de bonus générés) · *Porte-bonheur* (bonus +40 % de durée) ·
  *Collectionneur* (les bonus montent jusqu'au niveau IV) · *Poussière d'étoile* (8 % qu'un
  bloc banal lâche un mini-bonus)

**LÉGENDAIRES** (rares dans le tirage, réorientent la partie) — *Ver de roche* (traverse la
roche la plus tendre de la couche sans la percer) · *Noyau instable* (une explosion creuse
5 m tous les 100 m) · *Pacte du magma* (immunité à la lave, qui devient un toboggan) ·
*Cascade* (chaque bonus ramassé en déclenche un second, aléatoire) · *Chronophage*
(−20 s au chrono final par filon-mère percé).

---

## 7. L'or

L'or se ramasse pendant les niveaux et se dépense **à la station**, entre deux niveaux, en
pièces de foreuse (§2.4) et en rerolls.

Arbitrage permanent, et c'est la vraie question du jeu : **un détour de 8 secondes vers un
filon fait-il gagner plus de 8 secondes plus tard ?** Le joueur qui ignore tout l'or finira
lent, faute de foreuse ; celui qui ramasse tout finira lent, faute de temps. La bonne
réponse est entre les deux, et elle dépend de la build — donc elle change à chaque partie.

L'or non dépensé en fin de partie devient de la monnaie méta.

---

## 8. Interface

**Pendant un niveau, l'écran ne contient presque rien :**
- En haut au centre : **profondeur** en gros, **chrono** juste dessous.
- En haut à gauche : niveau en cours (ex. `3-2`) et médaille visée.
- En haut à droite : or, et les icônes des bonus actifs avec leur compte à rebours.
- Discrètement sur le côté : la jauge d'élan et la recharge du turbo.
- Aucun menu ne s'ouvre pendant un niveau. Toutes les décisions se prennent à la station.

**Feedback** — c'est là que se gagne le jeu : fissures progressives, éclats à la couleur de
la couche, écran qui tremble sous les gros coups, ralenti de 0,2 s à l'apparition d'un
filon-mère, distorsion en pleine frénésie, couches de musique qui s'ajoutent quand l'élan
monte, **son unique et jubilatoire pour l'or**. Conduire la foreuse doit être agréable dès
la troisième seconde, avant même le premier bonus.

**Carte de la planète** (écran d'accueil) : les 18 niveaux empilés verticalement, avec pour
chacun son meilleur temps et sa médaille. C'est le tableau de bord de la progression et
l'invitation à rejouer.

---

## 9. Modes

- **Expédition** — les 18 niveaux d'affilée, chrono total. Le mode principal.
- **Niveau seul** — rejouer n'importe quel niveau débloqué pour battre son split et sa médaille.
- **Sprint** — une couche entière (3 niveaux), ~5 min.
- **Balade** — sans chrono, pour explorer et compléter les collections.
- **Seed du jour** — tout le monde creuse la même planète, classement quotidien.

---

## 10. Périmètre

### MVP — le jeu est déjà fun
- La foreuse : 8 directions, rotation, élan, chute, marche arrière, turbo.
- **Couche 1 et 2, 6 niveaux**, avec 3 variantes (Descente, Gisement, Sceau).
- 4 bonus (Frénésie, Titan, Expansion, Perforation) avec cumul I–III.
- Station entre les niveaux : split, choix d'1 passif parmi 3, boutique de 4 pièces.
- 12 passifs sur 4 familles.
- Chrono, médailles, sauvegarde entre niveaux.

### V1
- Les 6 couches et les 18 niveaux, jusqu'au Cœur.
- Toutes les mécaniques signatures : explosions en chaîne, cascades de cristal, murs,
  lave, magnétisme.
- Les 7 variantes de niveaux, tous les bonus, ~30 passifs + légendaires, 5 métiers.
- Carte de la planète, records et splits, mode Niveau seul et mode Sprint.

### V2
- Seed du jour et classements, fantôme de son meilleur run.
- Collections (fossiles, artefacts), progression méta.
- Événements de couche (pluie de météores, ruée vers l'or).
- Deuxième planète : gravité, couches et mécaniques différentes.

---

## 11. Questions encore ouvertes

1. **La foreuse peut-elle forer vers le haut sans limite ?** Proposition : oui, mais à
   vitesse ÷2. Suffisant pour dissuader sans jamais bloquer.
2. **Le chrono tourne-t-il à la station ?** Proposition : non. Les décisions doivent être
   prises au calme, sinon le joueur reprend toujours la même carte.
3. **Les niveaux sont-ils générés à chaque partie ou fixes ?** Proposition : **structure
   fixe** (le niveau 3-2 est toujours le Dédale de cristal, donc apprenable et
   speedrunnable) mais **détail généré** (position des veines, bonus, surprises). On
   apprend un niveau sans le mémoriser par cœur.
4. **Faut-il perdre ses pièces de foreuse entre deux parties ?** Proposition : oui — la
   foreuse se reconstruit à chaque expédition, c'est ce qui rend les choix vivants. Seuls
   les passifs et métiers *débloqués* sont permanents.
5. **Largeur de base de la galerie : 2 blocs.** À tester — 3 est peut-être plus lisible à
   l'écran, mais rend les gains de largeur moins spectaculaires.
