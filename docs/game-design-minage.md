# Deep Vein — Game Design Document

> Jeu de minage 2D en vue de coupe. On commence au sol avec une pioche minable ;
> on creuse, on revend, on s'équipe, on descend plus profond.
> Titres alternatifs : *Filon*, *Descente*, *Le Puits*, *Carotte d'Or*.

---

## 1. Pitch

Vous héritez d'une concession minière épuisée. Une pioche en bois, un sac troué, une
lampe à huile. Sous vos pieds : 1 000 mètres de roche et, quelque part là-dedans, des
**filons d'or** capables de vous rendre riche.

Chaque descente est un pari : plus vous allez bas, plus la roche est dure, plus votre
énergie fond vite — mais plus le minerai vaut cher. Remonter trop tôt, c'est perdre son
temps. Remonter trop tard, c'est tout perdre.

**Fantasme du joueur** : le moment où la lampe éclaire une paroi et révèle une veine
dorée qui s'enfonce dans le noir.

---

## 2. Boucle de jeu principale

```
        ┌──────────────────────────────────────────────┐
        │                                              │
   [SURFACE] ──► [DESCENDRE] ──► [MINER / EXPLORER] ──►│
        ▲                              │              │
        │                              ▼              │
   [ACHETER] ◄── [VENDRE] ◄──── [REMONTER] ◄──────────┘
```

1. **Préparer** — acheter/équiper, prendre des consommables, choisir une profondeur de départ.
2. **Descendre** — via le puits ; les paliers d'ascenseur déjà débloqués sont accessibles directement.
3. **Miner** — casser des blocs, suivre les veines, gérer énergie / sac / lumière.
4. **Remonter** — avant la panne d'énergie, avant que le sac soit plein pour rien.
5. **Vendre** — au comptoir, à un cours qui fluctue.
6. **Améliorer** — pioche, sac, lampe, énergie, mobilité, automatisation.
7. Retour en 1, **une strate plus bas**.

**Durée d'une descente** : 3–6 min au début, 8–15 min en fin de partie.
**Durée d'une session** : 20–40 min (3 à 5 descentes).
**Durée de vie visée** : 8–12 h pour atteindre le fond du premier puits.

---

## 3. Le monde : la carte

### 3.1 Structure

- Grille 2D en **vue de coupe** (side view), un bloc = 1 m.
- Largeur du puits : **40 blocs** (fini, bords infranchissables — c'est une concession).
- Profondeur : **1 000 m** pour le puits n°1, générée procéduralement à la création de la partie (seed sauvegardée : la mine est *votre* mine, on la re-creuse au fil des descentes).
- Les blocs cassés **restent cassés** : le joueur creuse son propre réseau de galeries, ce qui donne un sentiment d'appropriation et rend les descentes suivantes plus rapides.
- Gravité : le joueur tombe dans les vides. Chute > 4 blocs = dégâts (perte d'énergie).

### 3.2 Strates (le cœur de la difficulté)

| Profondeur | Strate | Dureté | Minerais dominants | Particularité |
|---|---|---|---|---|
| 0–25 m | Terre meuble | 1–2 | Cailloux, charbon (rare) | Tutoriel, tout se casse vite |
| 25–75 m | Roche sédimentaire | 3–6 | Charbon, cuivre | Premières veines à suivre |
| 75–150 m | Calcaire humide | 7–12 | Cuivre, fer, argent | Poches d'eau (noient la galerie) |
| 150–300 m | Granite | 13–22 | Fer, argent, **premier or** | Blocs de granite pur infranchissables sans pioche fer+ |
| 300–500 m | Basalte | 23–40 | **Or**, quartz, gemmes | Poches de gaz (explosives près de la lampe) |
| 500–750 m | Roche volcanique | 41–65 | Or riche, obsidienne | Chaleur : coût d'énergie ×1.5 sans combinaison |
| 750–1000 m | Abysse | 66–100 | Mithril, cristaux, artefacts | Obscurité totale, lampe indispensable |

**Règle de dureté** : `dureté(p) = 1 + (p / 12)^1.4`, arrondie, ±20 % de bruit local.
Courbe volontairement **super-linéaire** : sans upgrade, descendre de 100 m double
quasiment le nombre de coups par bloc. C'est ce qui force l'achat d'équipement.

**Coups nécessaires** : `ceil(dureté_bloc / dégâts_pioche)`.
**Coût énergie d'un coup** : `1 + dureté_bloc / 20` (arrondi au dixième).

Conséquence de design : une pioche trop faible ne bloque pas seulement la vitesse, elle
**vide l'énergie**. Un palier de pioche franchi, c'est une descente qui passe de « 3 blocs
et demi-tour » à « 40 blocs et un filon ».

### 3.3 Les filons d'or (mécanique signature)

Le minerai précieux n'est **jamais un bloc isolé**. Il est généré en **veines** :

- Point de départ aléatoire dans la strate, puis propagation en marche aléatoire
  **orientée** (direction dominante + serpentement) sur 5 à 20 blocs.
- Une veine d'or est **majoritairement horizontale ou diagonale**.
  → Creuser tout droit vers le bas ne trouve presque jamais d'or.
  → Le joueur doit **explorer latéralement**, ce qui crée des choix (énergie vs curiosité).
- Chaque veine a une **richesse** (blocs pauvres en bordure, cœur riche au centre).
- **Indices environnementaux** : quartz blanc, veines de pyrite, roche décolorée sont
  générés autour d'une veine d'or à 3–6 blocs. Le joueur apprend à lire la roche —
  compétence de joueur, pas de personnage.
- Le **détecteur** (équipement) ajoute un signal sonore + une pulsation à l'écran dont la
  fréquence augmente avec la proximité d'un filon non miné, dans un rayon donné.

C'est le vrai contenu du jeu : la lecture de terrain, pas le clic sur le bloc.

---

## 4. Ressources et économie

### 4.1 Minerais

| Minerai | Poids (kg) | Prix base | Profondeur d'apparition |
|---|---|---|---|
| Cailloux | 2 | 1 | 0 m+ (déchet, à jeter) |
| Charbon | 3 | 6 | 20 m+ |
| Cuivre | 4 | 15 | 50 m+ |
| Fer | 5 | 35 | 110 m+ |
| Argent | 5 | 90 | 140 m+ |
| **Or** | 8 | **300** | 180 m+ |
| Quartz / gemmes | 2 | 250 | 320 m+ |
| Obsidienne | 7 | 500 | 520 m+ |
| Mithril | 6 | 1 200 | 780 m+ |
| Artefact | 1 | 2 000–8 000 | 800 m+ (unique, très rare) |

Le **poids** est le vrai régulateur : l'or est lourd. Un sac de départ (30 kg) ne contient
que 3 pépites. Le joueur doit **jeter** du minerai commun pour faire de la place — décision
active, souvent douloureuse, toujours intéressante.

### 4.2 Cours du marché

Le prix de chaque minerai fluctue de **±25 %** selon un cycle de quelques descentes,
affiché à la surface. Deux conséquences :

- On peut **stocker** dans un coffre à la surface (capacité limitée, améliorable) et vendre au bon moment.
- Un « pic de l'or » est un événement qui donne envie de relancer une descente immédiatement.

### 4.3 Sources de revenus secondaires

- **Contrats de la guilde** : « 40 charbon en 3 descentes → 500 $ + plan de pioche ».
  Renouvelés à chaque retour en surface, 3 disponibles.
- **Découvertes** : première fois qu'on atteint −100 / −250 / −500 m → prime.
- **Fossiles / artefacts** : revendus au musée, débloquent des bonus permanents.

---

## 5. Équipement et progression

### 5.1 Pioches (dégâts par coup)

| Niveau | Pioche | Dégâts | Prix | Débloque en pratique |
|---|---|---|---|---|
| 1 | Bois | 2 | — (départ) | 0–40 m |
| 2 | Pierre | 5 | 250 | 40–90 m |
| 3 | Cuivre | 10 | 900 | 90–160 m |
| 4 | Fer | 20 | 3 000 | 160–280 m |
| 5 | Acier | 38 | 9 000 | 280–430 m |
| 6 | Diamant | 70 | 26 000 | 430–620 m |
| 7 | Foreuse à vapeur | 120 | 70 000 | 620–820 m |
| 8 | Foreuse mithril | 200 | 180 000 | 820–1000 m |

Chaque palier est un **saut ressenti** (× ~2), pas un +5 %. On veut le « ah enfin ».

### 5.2 Autres axes d'amélioration

| Axe | Effet | Pourquoi c'est intéressant |
|---|---|---|
| **Sac** (30 → 400 kg) | Capacité de transport | Rentabilité par descente |
| **Batterie / énergie** (100 → 600) | Nombre de coups par descente | Durée de descente |
| **Lampe** (rayon 3 → 12) | Vision dans le noir | Sécurité + lecture des indices |
| **Bottes** | Réduit dégâts de chute, permet de sauter plus haut | Mobilité verticale |
| **Combinaison** | Résistance chaleur / gaz / eau | Accès aux strates 500 m+ |
| **Détecteur** (rayon 5 → 20) | Repère les filons non minés | Change la façon d'explorer |
| **Ascenseur** | Débloque un palier tous les 50 m | Supprime le trajet de retour |
| **Treuil / monte-charge** | Envoie du minerai en surface sans remonter | Prolonge la descente |

### 5.3 Consommables

- **Dynamite** — détruit un rayon de 3 blocs, quelle que soit la dureté. Bruyante : risque d'effondrement.
- **Échelle / plateforme** — remonter à la verticale, poser un chemin.
- **Ration** — restaure 30 % d'énergie.
- **Fusée de rappel** — téléportation instantanée à la surface, garde la cargaison. Chère, c'est l'assurance.
- **Charge de forage dirigée** — creuse un tunnel horizontal de 8 blocs.

### 5.4 Camp de base (méta-progression)

À la surface, on améliore des bâtiments qui bénéficient à **toutes** les descentes :

- **Comptoir** : meilleur prix de vente (+2 % par niveau).
- **Atelier** : débloque le craft (fer + charbon → acier) au lieu d'acheter.
- **Dortoir des mineurs** : recruter des PNJ qui minent automatiquement les strates
  déjà maîtrisées et déposent du minerai commun pendant que vous êtes en bas ou hors-jeu
  *(couche « idle » optionnelle, voir §9)*.
- **Cartographie** : la carte des galeries déjà creusées reste visible.
- **Infirmerie** : réduit la pénalité d'évanouissement.

---

## 6. Tension et risque

Sans risque, miner est une corvée. Sources de tension, par ordre d'introduction :

1. **Énergie** (dès 0 m) — jauge principale. À 0 : évanouissement → réveil à la surface,
   **perte de 50 % de la cargaison**, pas de perte d'équipement. Jamais de game over sec.
2. **Poids du sac** (dès 30 m) — plein = on ne ramasse plus ; surcharge volontaire possible
   (jusqu'à +20 %) au prix d'un coût d'énergie doublé par déplacement.
3. **Chutes** (60 m+) — creuser sous ses pieds sans échelle est une erreur classique.
4. **Poches d'eau** (100 m+) — inondent la galerie, ralentissent, coupent la lampe.
5. **Effondrements** (200 m+) — creuser trop large sans étai fait tomber le plafond ; blocs
   de soutènement à poser.
6. **Poches de gaz** (350 m+) — s'enflamment près d'une lampe à flamme ; force à passer
   à la lampe électrique ou à ventiler.
7. **Chaleur / lave** (550 m+) — drain d'énergie continu, zones à traverser vite.
8. **Le noir** (800 m+) — au-delà du rayon de lampe, on ne voit littéralement rien.

**Anti-frustration (non négociable)** : sauvegarde automatique à chaque remontée,
l'équipement acheté n'est jamais perdu, et une fusée de rappel est toujours achetable pour
une somme modique. Le joueur perd du **temps** et du **butin**, jamais sa progression.

---

## 7. Commandes et ergonomie

**Clavier / souris (desktop)**

- `Z/Q/S/D` ou flèches : déplacement, `Espace` : saut.
- Clic ou direction maintenue : miner le bloc visé (le personnage mine automatiquement le bloc adjacent dans la direction regardée).
- `E` : poser une échelle, `1–4` : consommables, `Tab` : carte, `M` : détecteur.

**Tactile (mobile)**

- Joystick virtuel à gauche, bouton miner à droite, appui sur un bloc adjacent pour cibler.
- Priorité : une seule main doit suffire pour une descente tranquille.

**HUD**

- Haut-gauche : énergie (barre), sac (kg / max), profondeur (grand chiffre, c'est le score).
- Haut-droite : argent, cargaison résumée par icônes.
- Bas : consommables.
- Le reste de l'écran : la mine. Pas de menus pendant la descente.

**Feedback (là où se joue le « juice »)**

- Fissures progressives sur le bloc en cours de minage.
- Écran qui tremble légèrement sur les gros coups, particules à la couleur du minerai.
- Son distinct par matériau ; **son unique et jubilatoire pour l'or**.
- Pulsation lumineuse quand un filon apparaît dans le champ de la lampe.

---

## 8. Structure de la partie (courbe d'expérience)

| Phase | Profondeur | Ce que le joueur apprend / vit |
|---|---|---|
| **Découverte** (0–30 min) | 0–100 m | Creuser, revendre, premier upgrade. Trouve son premier cuivre. |
| **Le mur** (30–90 min) | 100–200 m | La roche devient dure, l'énergie ne suit plus. Comprend qu'il faut optimiser. Premier or → moment fort. |
| **Le métier** (1–4 h) | 200–500 m | Lit les indices, planifie les descentes, joue avec le marché, débloque les ascenseurs. |
| **L'industrie** (4–8 h) | 500–800 m | Automatise le haut, dynamite, monte-charge. La mine devient une usine. |
| **L'abysse** (8 h+) | 800–1000 m | Zone dangereuse, artefacts, fin du puits n°1. |

**Fin de partie / rejouabilité** : atteindre le socle à −1000 m ouvre une **nouvelle
concession** (nouveau puits, nouvelle seed, strates plus dures, minerais inédits) en
conservant une partie de l'équipement et un bonus permanent — un *New Game+* qui donne du
sens au grind final.

---

## 9. Périmètre : MVP puis extensions

### MVP (le jeu est déjà bon)

- Grille 2D, minage, gravité, blocs persistants.
- 4 strates (0–300 m), 5 minerais dont l'or.
- Génération de **veines** + indices visuels.
- Énergie, sac avec poids, remontée manuelle.
- Boutique : pioche, sac, énergie, lampe, échelles.
- Vente à prix fixe, sauvegarde locale.

### V1

- 7 strates jusqu'à 1000 m, tous les minerais.
- Ascenseurs et paliers, détecteur, dynamite, fusée de rappel.
- Dangers : eau, gaz, effondrement, chaleur.
- Cours du marché fluctuant, contrats de guilde.
- Camp de base et améliorations permanentes.

### V2 et au-delà

- **Mineurs PNJ / couche idle** : production hors-ligne sur les strates maîtrisées.
- **Craft** : fondre le minerai pour fabriquer soi-même l'équipement.
- **Événements** : filon-mère, éboulement majeur, visite d'un acheteur qui surpaye l'argent.
- **Deuxième concession** (New Game+), succès, statistiques de carrière.
- **Mode défi** : seed partagée, meilleure valeur ramenée en 10 minutes → classement.
- **Coop locale** : un mineur + un opérateur de treuil.

---

## 10. Notes de faisabilité technique

Rien à coder pour l'instant, mais pour cadrer les choix futurs :

- Grille de blocs = simple tableau typé (`Uint8Array` de 40 × 1000 = 40 000 cases) : trivial en mémoire.
- Rendu : canvas 2D avec culling (n'afficher que les ~30 × 20 blocs visibles) — pas besoin de moteur lourd.
- Génération : bruit type Perlin/simplex pour les strates + marche aléatoire orientée pour les veines, à partir d'une seed stockée.
- Sauvegarde : seed + liste des blocs modifiés + inventaire + upgrades → `localStorage` suffit au début.
- Cible naturelle : **web (HTML/Canvas ou React + canvas)**, jouable desktop et mobile, sans installation.

---

## 11. Décisions de design à trancher avant de coder

1. **Run-based ou continu ?** — proposition retenue : run-based (descente → remontée), car
   ça crée un rythme et rend chaque upgrade lisible.
2. **Combats ou pas ?** — proposition : **non**. Les dangers sont environnementaux. Le jeu
   parle de roche, de poids et de lumière, pas de créatures. (Réversible en V2.)
3. **Idle/automatisation** — puissante pour la rétention, mais peut vider le cœur du jeu si
   introduite trop tôt : à réserver aux strates **déjà maîtrisées**.
4. **Perte à la mort** — 50 % de la cargaison seulement. Punir l'équipement casserait la
   boucle d'amélioration.
5. **Taille du puits** — 40 blocs de large : assez pour explorer latéralement, assez peu pour
   qu'on ne se perde pas.
