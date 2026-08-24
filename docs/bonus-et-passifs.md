# CORE — Catalogue des bonus et passifs

> Document de référence. Complète le [game design](game-design-minage.md).
> Toutes les valeurs sont des **valeurs de départ à équilibrer**, pas des vérités.
> 19 bonus temporaires · 6 malus · 49 passifs · 10 légendaires · 6 pactes · 8 métiers.

---

## 1. Les stats du jeu

Tout ce qui suit n'agit que sur ces stats. Rien d'autre n'existe.

### Stats primaires — celles des deux formules

```
temps_pour_percer_un_bloc = ceil(dureté / FORCE) / (VITESSE × élan)
blocs_percés_par_coup     = LARGEUR × LONGUEUR
```

| Stat | Départ | Plafond | Rôle |
|---|---|---|---|
| `FORCE` | 2 | ~120 | Combien de coups pour casser un bloc |
| `VITESSE` | 1.0 | ~6.0 | Coups par seconde |
| `LARGEUR` | 2 | 6 | Largeur du tunnel, en blocs |
| `LONGUEUR` | 1 | 4 | Profondeur mordue par coup |

### Stats secondaires — celles du pilotage et du butin

| Stat | Départ | Rôle |
|---|---|---|
| `ROULAGE` | ×4 | Vitesse dans une galerie déjà creusée |
| `ROTATION` | 0.20 s | Temps de pivot de la tête de forage |
| `ÉLAN_MAX` | +50 % | Plafond du bonus de vitesse en ligne droite |
| `ÉLAN_MONTÉE` | 3 s | Temps pour atteindre le plafond |
| `ÉLAN_PERTE` | 50 % | Part d'élan perdue en changeant de direction |
| `TURBO_DURÉE` | 2 s | |
| `TURBO_RECHARGE` | 15 s | |
| `AIMANT` | 1 bloc | Rayon de ramassage |
| `VISION` | 12 blocs | Rayon des phares |
| `CHANCE` | 1.0 | Multiplicateur du taux d'apparition des surprises |
| `VALEUR` | 1.0 | Multiplicateur du prix du minerai |

**Règle d'or** : la puissance vient à **~60 % des pièces de foreuse achetées avec l'or** et
à **~40 % des passifs**. Un joueur qui ignore l'or ne franchira pas les Sceaux ; un joueur
qui ignore ses cartes n'ira jamais vite. Les deux axes doivent rester indispensables.

---

## 2. Bonus temporaires

Ramassés dans les blocs. **Environ un toutes les 15 à 25 secondes** au taux de base.

### 2.1 Règles de cumul

1. Un bonus déjà actif ramassé une seconde fois **se relance et monte d'un niveau** (I → II → III).
2. Les bonus **différents se cumulent multiplicativement**. Aucune exclusion.
3. Chaque bonus a un **son et une couleur d'écran propres** : on doit savoir ce qu'on a
   ramassé sans lire l'icône.
4. Un bonus qui expire déclenche un petit « clac » sonore et une secousse — la perte doit se
   sentir autant que le gain.
5. **Plafond de folie** : au-delà de 4 bonus simultanés, l'écran passe en mode surchauffe
   (distorsion, musique saturée). C'est le moment que le joueur cherchera à reproduire.

### 2.2 Communs — 60 % des apparitions

| ID | Nom | Effet I | Effet II | Effet III | Durée | Couche |
|---|---|---|---|---|---|---|
| `B-01` | **Frénésie** | `VITESSE` ×1.8 | ×2.2 | ×2.8 | 20 s | 1+ |
| `B-02` | **Titan** | `FORCE` ×2.5 | ×3.5 | ×5 | 15 s | 1+ |
| `B-03` | **Expansion** | `LARGEUR` +2 | +3 | +4 | 20 s | 1+ |
| `B-04` | **Perforation** | `LONGUEUR` +1 | +2 | +3 | 20 s | 2+ |
| `B-05` | **Aimant** | `AIMANT` 6 | 10 | 15 | 30 s | 1+ |
| `B-06` | **Graissage** | `ROTATION` 0.1 s, `ROULAGE` ×6 | 0.05 s, ×8 | instantané, ×10 | 25 s | 1+ |

### 2.3 Rares — 30 % des apparitions

| ID | Nom | Effet | Durée | Couche |
|---|---|---|---|---|
| `B-07` | **Fièvre de l'or** | `VALEUR` ×2 / ×2.5 / ×3 | 30 s | 1+ |
| `B-08` | **Plume** | Chute très rapide et pleinement contrôlée, traverse la roche la plus tendre de la couche | 15 s | 2+ |
| `B-09` | **Surchauffe** | `VITESSE` ×3, mais `ROTATION` ×2 plus lente — pour foncer tout droit | 12 s | 2+ |
| `B-10` | **Vibration sismique** | Chaque bloc percé retire 50 % de dureté à ses voisins | 20 s | 3+ |
| `B-11` | **Boussole** | Révèle tout le niveau et trace le chemin le plus court vers la sortie | 10 s | 3+ |
| `B-12` | **Second moteur** | Turbo illimité, sans recharge | 8 s | 3+ |
| `B-13` | **Laser** | `LONGUEUR` = 5 mais `LARGEUR` = 1 — un tunnel d'aiguille, ultra rapide | 15 s | 4+ |

### 2.4 Épiques — 10 % des apparitions

| ID | Nom | Effet | Durée | Couche |
|---|---|---|---|---|
| `B-14` | **Sablier fêlé** | **Le chrono se fige** 10 / 13 / 16 s | — | 2+ |
| `B-15` | **Singularité** | Implose instantanément une sphère de rayon 6 autour de la foreuse | instantané | 3+ |
| `B-16` | **Forme liquide** | Traverse **toute** roche destructible sans la percer | 6 s | 4+ |
| `B-17` | **Ruée du noyau** | La foreuse fonce vers le bas à vitesse folle, sans contrôle latéral | 5 s | 4+ |
| `B-18` | **Éveil** | Tous les bonus actifs montent d'un niveau et leur durée est remise à zéro | instantané | 5+ |
| `B-19` | **Jackpot** | Fait apparaître 5 bonus communs autour de la foreuse | instantané | 5+ |

### 2.5 Instantanés — pas de durée, effet immédiat

| ID | Nom | Effet |
|---|---|---|
| `I-01` | **Pépite** | Or (montant selon la couche) |
| `I-02` | **Cristal d'XP** | Accélère l'arrivée du prochain choix de passif |
| `I-03` | **Éclat de temps** | **−5 s** sur le chrono du niveau |
| `I-04` | **Coffre** | Or + 1 bonus aléatoire de rareté supérieure |
| `I-05` | **Fossile / artefact** | Collection (méta) + grosse valeur de revente |

### 2.6 Malus — les pièges

Ils coûtent des secondes. **Jamais la partie.**

| ID | Nom | Effet | Durée |
|---|---|---|---|
| `M-01` | **Étourdissement** | Foreuse à l'arrêt, écran qui vibre | 2 s |
| `M-02` | **Rouille** | `VITESSE` ÷2 | 8 s |
| `M-03` | **Grippage** | `ROTATION` ×4 — la tête pivote au ralenti | 10 s |
| `M-04` | **Aveuglement** | `VISION` ÷3 | 10 s |
| `M-05` | **Inversion** | Commandes inversées (et c'est très drôle) | 5 s |
| `M-06` | **Surcharge magnétique** | La foreuse est aspirée vers le haut de 15 m | instantané |

---

## 3. Passifs

Choisis **1 parmi 3 à la fin de chaque niveau** : 18 choix par partie.
Rareté : ⬜ commun · 🟦 rare · 🟪 épique.
« Cumulable » = la carte peut ressortir et s'empiler.

### 3.1 Famille MOTEUR — la vitesse

| ID | Nom | Rar. | Effet | Cumul. |
|---|---|---|---|---|
| `V-01` | **Injection** | ⬜ | `VITESSE` +12 % | ✅ |
| `V-02` | **Rodage** | ⬜ | Les 10 premières secondes de chaque niveau : `VITESSE` ×2 | ❌ |
| `V-03` | **Marteau-pilon** | ⬜ | +25 % de vitesse contre les blocs qui cèdent en un seul coup | ✅ |
| `V-04` | **Second souffle** | ⬜ | À l'expiration d'un bonus : `VITESSE` +30 % pendant 5 s | ❌ |
| `V-05` | **Métronome** | 🟦 | `ÉLAN_MONTÉE` deux fois plus rapide | ❌ |
| `V-06` | **Volant d'inertie** | 🟦 | `ÉLAN_PERTE` 50 % → 20 % | ❌ |
| `V-07` | **Plafond relevé** | 🟦 | `ÉLAN_MAX` +50 % → +90 % | ❌ |
| `V-08` | **Chauffe** | 🟦 | +3 % de vitesse par 100 m parcourus dans le niveau, remis à zéro à la station | ❌ |

### 3.2 Famille TÊTE — la force

| ID | Nom | Rar. | Effet | Cumul. |
|---|---|---|---|---|
| `F-01` | **Bras de fer** | ⬜ | `FORCE` +2 | ✅ |
| `F-02` | **Carbure** | ⬜ | `FORCE` +15 % | ✅ |
| `F-03` | **Perce-sceau** | ⬜ | `FORCE` ×3 contre les Sceaux de fin de couche | ❌ |
| `F-04` | **Bélier** | 🟦 | Après 3 s en ligne droite : `FORCE` ×2 | ❌ |
| `F-05` | **Brise-roche** | 🟦 | 15 % de chance de détruire un bloc d'un seul coup, quelle que soit sa dureté | ✅ |
| `F-06` | **Sismique** | 🟦 | `FORCE` ×2 contre le bloc le plus répandu de la couche en cours | ❌ |
| `F-07` | **Fissuration** | 🟦 | Chaque bloc percé retire 1 de dureté à ses quatre voisins | ✅ |
| `F-08` | **Pointe fine** | 🟦 | `FORCE` ×3 mais `LARGEUR` fixée à 1 | ❌ |

### 3.3 Famille ZONE — la surface percée

| ID | Nom | Rar. | Effet | Cumul. |
|---|---|---|---|---|
| `Z-01` | **Tunnelier** | ⬜ | `LARGEUR` +1, `VITESSE` −10 % | ✅ |
| `Z-02` | **Éclats** | ⬜ | Les blocs situés juste derrière ceux qu'on perce perdent 50 % de dureté | ✅ |
| `Z-03` | **Élargisseur** | 🟦 | `LARGEUR` +1 (max 6) | ✅ |
| `Z-04` | **Perforateur** | 🟦 | `LONGUEUR` +1 (max 4) | ✅ |
| `Z-05` | **Onde de choc** | 🟦 | Tous les 10 blocs percés, détruit un cercle de rayon 2 | ❌ |
| `Z-06` | **Sillage** | 🟦 | Les blocs bordant le tunnel cèdent en un seul coup | ❌ |
| `Z-07` | **Implosion** | 🟪 | Tous les 100 m, détruit un rayon de 4 autour de la foreuse | ❌ |

### 3.4 Famille PILOTAGE — la conduite

| ID | Nom | Rar. | Effet | Cumul. |
|---|---|---|---|---|
| `P-01` | **Chenilles crantées** | ⬜ | `ROULAGE` ×1.5 | ✅ |
| `P-02` | **Turbo long** | ⬜ | `TURBO_DURÉE` ×2 | ✅ |
| `P-03` | **Marche arrière sportive** | ⬜ | On fore aussi en reculant, à 70 % de vitesse | ❌ |
| `P-04` | **Aérodynamique** | ⬜ | Contrôle latéral total en chute, chute 50 % plus rapide | ❌ |
| `P-05` | **Amortisseurs** | ⬜ | Aucune perte d'élan à l'atterrissage | ❌ |
| `P-06` | **Gyroscope** | 🟦 | `ROTATION` quasi instantanée (0.02 s) | ❌ |
| `P-07` | **Turbocompresseur** | 🟦 | `TURBO_RECHARGE` ÷2 | ✅ |
| `P-08` | **Pilote automatique** | 🟦 | Après 2 s dans la même direction, la trajectoire se verrouille : immunité aux déviations (magnétisme, explosions, gaz) | ❌ |
| `P-09` | **Foreuse gravitationnelle** | 🟪 | **En chute, on fore les blocs traversés à pleine vitesse.** Tomber devient miner | ❌ |

### 3.5 Famille BUTIN — l'or

| ID | Nom | Rar. | Effet | Cumul. |
|---|---|---|---|---|
| `O-01` | **Aimant permanent** | ⬜ | `AIMANT` +4 | ✅ |
| `O-02` | **Cupidité** | ⬜ | `VALEUR` +40 %, `VITESSE` −10 % | ✅ |
| `O-03` | **Raffinage** | ⬜ | `VALEUR` +25 % | ✅ |
| `O-04` | **Récupérateur** | ⬜ | 10 % des blocs banals lâchent une pépite | ✅ |
| `O-05` | **Contrebandier** | ⬜ | L'or non dépensé rapporte 50 % de plus en monnaie méta | ❌ |
| `O-06` | **Filon élargi** | 🟦 | Les veines de minerai contiennent 50 % de blocs en plus | ✅ |
| `O-07` | **Prospecteur** | 🟦 | Le minerai brille à travers la roche dans un rayon de 10 | ❌ |
| `O-08` | **Écrin** | 🟦 | Les géodes et coffres contiennent le double | ❌ |
| `O-09` | **Investisseur** | 🟦 | Les pièces de foreuse coûtent 25 % de moins | ✅ |

### 3.6 Famille CHANCE — les surprises

| ID | Nom | Rar. | Effet | Cumul. |
|---|---|---|---|---|
| `C-01` | **Flair** | ⬜ | `CHANCE` +25 % | ✅ |
| `C-02` | **Superstition** | ⬜ | +1 reroll gratuit par couche | ✅ |
| `C-03` | **Chasseur de primes** | ⬜ | Les malus des pièges durent 60 % moins longtemps | ❌ |
| `C-04` | **Porte-bonheur** | 🟦 | Durée des bonus +40 % | ✅ |
| `C-05` | **Poussière d'étoile** | 🟦 | 8 % des blocs banals lâchent un mini-bonus de niveau I | ✅ |
| `C-06` | **Rémanence** | 🟦 | Quand un bonus expire, 30 % de chance qu'il se relance au niveau I | ❌ |
| `C-07` | **Main chaude** | 🟦 | Le premier bonus de chaque niveau est ramassé directement au niveau III | ❌ |
| `C-08` | **Trèfle** | 🟪 | **4 cartes au lieu de 3** à chaque choix de passif | ❌ |

---

## 4. Légendaires

Très rares dans le tirage. Chacune **réoriente la partie** : on ne joue plus pareil après
l'avoir prise. Jamais plus d'une par tirage.

| ID | Nom | Effet |
|---|---|---|
| `L-01` | **Ver de roche** | Traverse la roche la plus tendre de chaque couche **sans la percer**, à pleine vitesse |
| `L-02` | **Noyau instable** | Tous les 100 m, une explosion creuse automatiquement un rayon de 5 |
| `L-03` | **Pacte du magma** | Immunité totale à la lave, qui devient un toboggan à vitesse ×3 |
| `L-04` | **Cascade** | Chaque bonus ramassé en déclenche un second, aléatoire, au niveau I |
| `L-05` | **Chronophage** | −20 s au chrono final par filon-mère entièrement percé |
| `L-06` | **Perpétuel** | L'élan ne retombe **jamais** à l'intérieur d'un niveau |
| `L-07` | **Trou noir** | Le turbo devient une implosion de rayon 8 qui aspire tout le minerai |
| `L-08` | **Symbiose** | Chaque famille dont tu possèdes ≥ 4 cartes donne +5 % à sa stat principale, cumulatif |
| `L-09` | **Foret d'étoile** | La dureté est ignorée : **tout bloc demande exactement 2 coups**. Inutile en couche 1, dévastateur en couche 6 |
| `L-10` | **Mémoire de la machine** | Un passif au hasard est conservé pour la partie suivante |

---

## 5. Pactes — le risque assumé

Un pacte remplace une carte du tirage, environ **une fois sur six**. Il est toujours
visiblement marqué (carte noire, son grave). Gros gain, vrai prix.

| ID | Nom | Gain | Prix |
|---|---|---|---|
| `PA-1` | **Pacte du fondeur** | `FORCE` ×2 | Forer vers le haut devient impossible |
| `PA-2` | **Pacte de l'avare** | `VALEUR` ×3 | La boutique est fermée pendant toute la couche suivante |
| `PA-3` | **Pacte de vitesse** | `VITESSE` ×1.5 | L'élan retombe **à zéro** à chaque changement de direction |
| `PA-4` | **Pacte du colosse** | `LARGEUR` 5 immédiatement | `ROULAGE` ÷2 : les galeries ne servent plus à rien |
| `PA-5` | **Pacte du chrono** | −60 s sur le chrono final | Aucun bonus temporaire ne t'affecte pendant la couche suivante |
| `PA-6` | **Pacte aveugle** | +2 cartes au prochain choix | `VISION` ÷2 jusqu'à la fin de la partie |

---

## 6. Métiers de départ

Avant la partie, **3 métiers tirés au hasard, on en choisit un.** Ils donnent le ton des
premières minutes et orientent la build sans la verrouiller.

| ID | Métier | Effet |
|---|---|---|
| `MT-1` | **Le Bourrin** | `FORCE` ×2, `VITESSE` −20 % |
| `MT-2` | **Le Furieux** | `VITESSE` ×1.5 |
| `MT-3` | **Le Chanceux** | `CHANCE` ×1.5 |
| `MT-4` | **Le Prospecteur** | Commence avec *Prospecteur* (`O-07`) et `VALEUR` ×1.5 |
| `MT-5` | **Le Mécano** | Commence avec 2 pièces de foreuse au choix |
| `MT-6` | **Le Tunnelier** | `LARGEUR` 4 d'entrée de jeu, `VITESSE` −25 % |
| `MT-7` | **Le Parieur** | Commence directement à la couche 2, mais sans aucun passif au premier niveau |
| `MT-8` | **L'Ascète** | Les bonus temporaires ne t'affectent plus, mais **+1 carte à chaque choix** de passif |

---

## 7. Règles de tirage

- **Poids de rareté** : commun 60 % · rare 30 % · épique 9 % · légendaire 1 %.
- Les poids **glissent avec la profondeur** : en couche 6, commun 35 % · rare 40 % ·
  épique 20 % · légendaire 5 %. Les fins de partie doivent être spectaculaires.
- **Jamais de doublon dans un même tirage.** Une carte non cumulable déjà possédée sort
  définitivement du pool.
- **Pity légendaire** : si aucune légendaire n'est apparue au niveau 12, la prochaine carte
  épique est remplacée par une légendaire.
- **Reroll** : 1 gratuit par partie, puis payant en or (200, puis 400, puis 800…).
- **Bannissement** : une fois par couche, on peut retirer une carte du pool pour le reste de
  la partie. C'est ce qui permet d'affiner une build au lieu de la subir.
- **Filtre de pertinence** : une carte inutile dans le contexte ne doit pas sortir
  (*Pacte du magma* avant la couche 5, *Perce-sceau* juste après un Sceau).

---

## 8. Archétypes de build

Le test de réussite du catalogue : au niveau 8, le joueur doit pouvoir nommer sa build.

| Archétype | Cartes clés | Sensation | Faiblesse |
|---|---|---|---|
| **Le Bulldozer** | `Z-03` `Z-04` `F-01` `F-05` `B-03` | Un tunnel de 6 de large, la roche disparaît par pans entiers | Lent, chaque coup coûte cher |
| **Le Sprinteur** | `V-05` `V-06` `V-07` `P-06` `L-06` | Ligne droite, élan au plafond, on ne s'arrête jamais | Le moindre détour casse tout |
| **Le Chirurgien** | `F-08` `Z-04` `P-06` `B-13` | Un tunnel d'une seule case, mais on traverse la planète comme du beurre | Aucun ramassage, aucune marge d'erreur |
| **Le Chercheur d'or** | `O-06` `O-07` `O-01` `O-09` | On voit tout, on ramasse tout, la boutique est un supermarché | On perd du temps à chaque niveau, il faut que ça paie |
| **Le Casino** | `C-01` `C-04` `C-05` `L-04` | Les bonus ne s'arrêtent jamais, l'écran est en surchauffe permanente | Sans chance, la build est vide |
| **Le Chuteur** | `P-09` `P-04` `P-05` `B-08` | On cherche les cavernes, on fore en tombant, on ne touche presque plus le sol | Dépend de la génération du niveau |

Chaque archétype doit être **jouable jusqu'au bout** et avoir une **couche où il brille** et
une **couche où il souffre**. Si un archétype gagne partout, il est trop fort ; s'il ne
gagne nulle part, il n'existe pas.

---

## 9. Budget de puissance

Repères de calibrage, à confronter au tableur :

| Rareté | Gain de progression effectif visé |
|---|---|
| Commun | ≈ +8 % |
| Rare | ≈ +18 % |
| Épique | ≈ +35 % |
| Légendaire | Change la façon de jouer, pas seulement le chiffre |
| Pacte | +40 % environ, contre une contrainte réelle |

Sur 18 niveaux, les passifs doivent apporter environ **×6 à ×10** de progression, et les
pièces de foreuse **×10 à ×15**. La dureté du terrain, elle, est multipliée par **~96**
entre la surface et le Cœur. Les deux courbes doivent se croiser en permanence pour tenir
l'invariant : **1 à 4 coups par bloc, du début à la fin.**

---

## 10. Contenu du MVP

Si on ne code qu'une chose, on code ça — c'est déjà un vrai jeu :

- **Bonus** : `B-01` Frénésie, `B-02` Titan, `B-03` Expansion, `B-05` Aimant, `B-14` Sablier,
  `I-01` Pépite, `I-03` Éclat de temps.
- **Malus** : `M-01` Étourdissement, `M-02` Rouille.
- **Passifs (12)** : `V-01` `V-04` `V-05` · `F-01` `F-02` `F-05` · `Z-01` `Z-03` `Z-04` ·
  `P-01` `P-06` `O-01`.
- **Légendaire (1)** : `P-09` Foreuse gravitationnelle — la carte qui donne envie de rejouer.
- **Métiers (3)** : `MT-1` Bourrin, `MT-2` Furieux, `MT-3` Chanceux.
- Tirage à 3 cartes, 1 reroll gratuit, pas encore de pity ni de bannissement.

Tout le reste est du contenu additif : le système ne change pas, seule la table grossit.
