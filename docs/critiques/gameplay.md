# CORE — critique de gameplay

Critique du gameplay seul. Ni code, ni graphismes.

## Méthode

Tout ce qui suit est vérifié dans le code (fichier:ligne) ou mesuré. Trois sources :

1. **Simulateur headless** (`sim.js`) : un bot idiot — pathfinding Dijkstra, descente,
   achat glouton de toutes les pièces, première carte non-pacte à chaque station.
   12 graines × 14 niveaux = 168 niveaux joués.
2. **Banc d'essai isolé** (`banc.js`) : monde artificiel de roche MED uniforme,
   descente verticale pure, une variable à la fois. C'est de là que viennent les
   chiffres de vitesse de descente et de consommation.
3. **Lecture directe** des formules de `drill.js` et `config.js`.

Référence pour tout le rapport, les temps moyens du bot sur 12 graines :

| niv | type | temps bot | seuil OR | médailles OR/AR/BR |
|---|---|---|---|---|
| 1-1 | descente | 19,3 s | 22 s | 11/1/0 |
| 1-2 | sceau | 23,2 s | 25 s | 9/3/0 |
| 2-1 | descente | 19,1 s | 18 s | 4/7/1 |
| 2-2 | filon | 18,5 s | 21 s | 11/1/0 |
| 2-3 | gisement | 19,1 s | 20 s | 7/5/0 |
| 2-4 | effondrement | 15,9 s | 18 s | 9/3/0 |
| 2-5 | chute | 11,6 s | 15 s | 10/2/0 |
| 2-6 | sceau | 14,6 s | 17 s | 10/2/0 |
| 3-1 | descente | 14,9 s | 19 s | 11/1/0 |
| 3-2 | dedale | 40,1 s | 50 s | 11/1/0 |
| 3-3 | gisement | 16,6 s | 18 s | 8/3/1 |
| 3-4 | effondrement | 13,8 s | 13 s | 4/6/2 |
| 3-5 | chute | 10,6 s | 11 s | 6/6/0 |
| 3-6 | sceau | 12,5 s | 12 s | 5/7/0 |

**Un bot qui ne fait que descendre décroche 9 médailles d'or sur 14, ne perd jamais un
point d'intégrité, ne relance jamais un niveau, et boucle l'expédition en 233 s.**

---

# A. Ce qui casse le jeu

## A1. La Faille — le seul adversaire du jeu — n'a jamais touché personne

**Le problème.** Sur 168 niveaux simulés, le compteur `buried` vaut **0**. Pas une fois.

**La preuve.** Écart entre la foreuse et la Faille au moment de sortir du niveau,
moyenne sur 12 graines (hauteur d'un niveau : 100 à 125 lignes) :

| niv | mult. Faille | avance à la sortie | pire cas |
|---|---|---|---|
| 1-1 | 0,75 | 95 lignes | 85 |
| 2-4 | 1,35 | 106 lignes | 85 |
| 3-2 (dedale) | 0,80 | **56 lignes** | **3** |
| 3-4 « la faille vive » | 1,50 | 120 lignes | 110 |
| 3-5 | 1,25 | 127 lignes | 125 |
| 3-6 | 1,30 | 120 lignes | 111 |

Analytiquement (`config.js:23-30`, `game.js:429-476`) : `delay` 15 s, puis
`2,0 + 0,06·e` lignes/s. Pour parcourir 110 lignes il faut résoudre
`0,03·e² + 2·e = 110` → e = 35,8 s, soit **t = 50,8 s**. Le joueur sort en 10 à 20 s.
Même à `faille: 1,5` (niveau 3-4) la Faille met 41 s à atteindre la sortie, pour un
niveau bouclé en 13,8 s : **facteur 3**.

**Le pire : l'inversion.** Le seul niveau où la Faille approche est le dedale (3-2,
40 s de moyenne) — et c'est celui à qui on a donné le multiplicateur **le plus lent
du jeu** (`faille: 0.8`, `config.js:150`). Le niveau 3-4, baptisé « La faille vive » et
doté du multiplicateur le plus rapide (1,5), est celui où la Faille est le plus loin.

**Conséquence en cascade.** Deux systèmes entiers sont morts par ricochet :
- `sealBoost: 2.2` (`config.js:27`) : la Faille accélère brutalement quand le Sceau est
  percé. Mais le Sceau occupe les 6 dernières lignes du niveau (`world.js:248`) : quand
  il cède, on est à 6 lignes de la sortie. L'accélération n'existe pas.
- `catchPush`, `IFRAMES`, `stun 0.7`, le passif `T-04 Casse-cou` (« +40 % tant que la
  Faille est à moins de 15 lignes ») et le déblocage `cassecou` (`buried: 8`) : tout ce
  bloc est du code qui ne s'exécute jamais.

**Correction.** Calibrer la Faille sur le barème, pas sur une constante :
`vitesse = def.height / def.bronze` lignes/s, `delay: 4`, `accel: 0`. Le contrat
devient lisible : **« sous le bronze, ou tu es enseveli »**. Avec les seuils actuels
ça donne 2,2 lignes/s en 1-1 et 4,8 en 3-6 — donc il faut aussi resserrer les seuils
(voir A3). Avec les seuils proposés en A3 : 4,5 lignes/s en 1-1, 8,6 en 3-6, et la
Faille arrive sur le joueur si celui-ci hésite plus de 3 secondes.

---

## A2. `R` efface le chrono. Gratuitement, à volonté.

**Le problème.** La touche `R` relance le niveau **sans que le temps écoulé soit
comptabilisé nulle part**.

**La preuve.** `main.js:42` :
```js
if (e.code === 'KeyR' && G.state === 'play') { GAME.startLevel(G.run.levelIndex); return; }
```
Elle appelle `startLevel` directement, court-circuitant `restartLevel` (`game.js:298-307`)
qui est le seul endroit où `run.lost`, `run.total` et `run.restarts` sont incrémentés.
Et la graine est déterministe (`G.run.seed + index * 7919`, `game.js:102`) : on retente
**le même niveau, déjà connu, sans aucun coût**.

Corollaire : `run.restarts` reste à 0, donc le déblocage `cleanRuns` → *L'Ascète*
(`game.js:997`) est décerné même après cent relances.

Dans un jeu dont le pitch est « ton seul adversaire est le chrono », le chrono est
annulable par une touche. Tout le barème de médailles, tous les records, tous les
fantômes sont invalides.

**Correction.** `R` doit passer par `restartLevel()` (donc +`levelTime` sur `run.total`,
+1 sur `restarts`). Ou plus radical : supprimer `R` en jeu et n'offrir la relance que
via la panne sèche / l'intégrité à 0, qui elles facturent déjà le temps.

---

## A3. La courbe de difficulté est décroissante

**Le problème.** Les niveaux ne deviennent pas plus durs, ils deviennent plus **courts**.
La courbe de puissance dépasse la courbe de dureté et ne la relâche plus.

**La preuve.** Temps du bot : 19,3 → 23,2 → 19,1 → 18,5 → 19,1 → 15,9 → 11,6 → 14,6 →
14,9 → *(40,1 dedale)* → 16,6 → 13,8 → 10,6 → **12,5 s**. Le dernier niveau du jeu se
boucle en 12,5 s, le premier en 19,3.

La cause est arithmétique. Dureté maximale rencontrée (`config.js:91`, `world.js:74`) :

| profondeur | HARD (×1,7) | force nécessaire pour 1 coup |
|---|---|---|
| 100 m (niv. 1-1) | **1,81** | 2 — c'est-à-dire la force de départ |
| 1600 m (niv. 3-6) | 28,9 | 29 |

La force du bot en fin de partie : **35 à 41**. Il perce donc tout le jeu à
**1 coup par bloc**, y compris le tout dernier mètre. Le document `v3-challenge.md` §1
dénonce déjà cet invariant en toutes lettres (« 1 à 4 coups par bloc, du début à la fin…
ce n'est pas un bug d'équilibrage, c'est le résultat exact de la règle qu'on s'est
donnée ») — la règle est toujours là.

Pire, **le niveau 1-1 n'oppose littéralement aucune résistance** : dureté max 1,81 <
force 2. Les 20 premières secondes du jeu, chaque bloc tombe en un coup.

**Correction.**
1. Reprofiler les seuils de médaille sur les temps mesurés : or = 0,70 × temps bot,
   argent = 0,90 ×, bronze = 1,15 ×. Concrètement : 1-1 → 14/17/22 ; 2-1 → 13/17/22 ;
   3-1 → 10/13/17 ; 3-6 → 9/11/14 ; 3-2 → 28/36/46.
2. Découpler la dureté de la force (voir A4) pour que la profondeur pèse à nouveau.
3. Faire monter la courbe de dureté plus vite que la boutique : passer
   `hardnessAt` de `1 + 100·r²` à `1 + 220·r²` (dureté HARD à 1600 m : 60 au lieu
   de 28,9) et plafonner `tete` à `max: 8` au lieu de 14.

---

## A4. `Math.ceil` : la moitié des cartes de Force ne fait rien, l'autre moitié fait +45 %

**Le problème.** Le nombre de coups par bloc est `Math.ceil(dureté / force)`
(`drill.js:185`). C'est un escalier. Entre deux marches, **toute augmentation de force
vaut exactement zéro**.

**La preuve** (banc, roche dureté 19,6, largeur 2, longueur 1, vitesse 5, 116 lignes) :

| force | coups/bloc | temps | gain |
|---|---|---|---|
| 6 | 4 | 56,4 s | — |
| 7 | 3 | 48,1 s | −14,7 % |
| **8** | 3 | **48,1 s** | **0,0 %** |
| 10 | 2 | 32,9 s | −31,6 % |
| **12** | 2 | **32,9 s** | **0,0 %** |
| **14** | 2 | **32,9 s** | **0,0 %** |
| **15** | 2 | **32,9 s** | **0,0 %** |
| 20 | 1 | 17,8 s | −44,9 % |
| 25 → 40 | 1 | 17,8 s | **0,0 %** |

De force 8 à force 15 — presque un doublement, plusieurs milliers de dollars de
boutique — le gain est **nul**. Puis un cran de +1 vaut −45 %.

Sont concernés : `F-01 Bras de fer`, `F-02 Carbure`, `F-05 Brise-roche`, les pièces
`tete` et `stellaire`, le métier `MT-1 Le Bourrin`, le pacte `PA-1 Pacte du fondeur`,
le bonus `B-02 Titan`. Soit **8 objets de contenu dont la valeur est illisible et
souvent nulle**. Une fois force ≥ dureté max (ce que la boutique atteint dès la couche
3, cf. A3), ils valent tous **0** définitivement.

Cas emblématique : au niveau 1-1, dureté max 1,81. Le métier **Le Bourrin (force ×2)
est un no-op complet sur tout le premier niveau**, alors que Le Furieux (vitesse ×1,5)
donne +50 %. Le tout premier choix demandé au joueur est un piège.

**Correction.** Rendre la progression continue :
```js
// drill.js:185
var hits = d.crit ? 0.001 : maxHard / Math.max(0.1, s.force);
```
(supprimer `Math.ceil` et le `Math.max(1, …)`). Chaque point de force compte alors
linéairement. Mais force et vitesse deviennent le même stat ; pour les garder distincts,
faire de la force un **seuil de passage** : si `maxHard > s.force`, la taille cale
(comme du socle) au lieu de prendre N coups. La force répond alors à « est-ce que je
peux traverser ça ? » et la vitesse à « à quelle allure ? ». C'est ce qui rendrait les
veines de granit contournables — et donc la navigation intéressante.

---

## A5. La largeur de taille est un malus déguisé — et 6 objets de contenu la vendent comme un bonus

**Le problème.** Augmenter la largeur de taille **ne fait pas descendre plus vite du
tout**, et multiplie la consommation.

**La preuve.** La descente avance de `L` lignes par taille complétée, en `hits/rate`
secondes — la largeur `w` n'apparaît nulle part (`drill.js:185-222`). Le carburant, lui,
est `burnPerBlock × w × L` par taille, soit `0,20 × w` **par ligne** (`drill.js:197-203`).

Banc, couche 3, 116 lignes, force 14, vitesse 5 :

| taille | temps | lignes/s | L consommés | L/ligne |
|---|---|---|---|---|
| **2 × 1** | **32,9 s** | 3,49 | **46 L** | 0,40 |
| 3 × 1 | 32,9 s | 3,49 | 69 L | 0,60 |
| 4 × 1 | 32,9 s | 3,49 | 92 L | 0,80 |
| 5 × 1 | 32,9 s | 3,49 | 115 L | 1,00 |
| **6 × 1** | **32,9 s** | 3,49 | **137 L** | 1,20 |
| 2 × 2 | 21,5 s | 5,36 | 60 L | 0,52 |
| 2 × 3 | 17,6 s | 6,55 | 74 L | 0,64 |
| **2 × 4** | **14,9 s** | **7,76** | 82 L | 0,71 |

Largeur 2 → 6 : **+198 % de carburant, 0 % de vitesse**. Longueur 1 → 4 : **−55 % de
temps** pour +78 % de L/ligne. La longueur est le stat le plus fort du jeu ; la largeur
en est le plus mauvais.

Objets concernés, tous vendus comme des gains :
- `Z-01 Tunnelier` (largeur +1, **vitesse −10 %**) — strictement négatif.
- `Z-03 Élargisseur` (largeur +1, ×4) — coût pur.
- pièce `elargisseur`, 620 $, croissance ×2,4 — on paie 620 $ pour ralentir.
- `PA-4 Pacte du colosse` (largeur +3, roulage /2) — double malus.
- métier `MT-6 Le Tunnelier` (largeur 4, vitesse −25 %) — piège d'entrée de jeu.
- bonus `B-03 Expansion` (largeur +2/+3/+4) — une récompense qui coûte 3× le carburant.

Le seul vrai bénéfice de la largeur (dégager latéralement, ramasser plus large, ne pas
caler sur du socle) n'est jamais énoncé et n'est pas ce que les descriptions promettent.

**Correction.** Faire payer la largeur en temps et la rendre utile :
1. `drill.js:186` — `rate` divisé par la largeur relative :
   `rate *= 2 / Math.max(2, s.width)` … non : le plus propre est d'appliquer
   `hits` sur la **somme** des duretés de la taille plutôt que sur le max
   (`drill.js:99` : `maxHard` → moyenne × nombre de cases / 2). Une taille large met
   plus longtemps, exactement comme dans Mr. Driller.
2. Et lui donner une raison d'exister : c'est la largeur qui déclenche les
   effondrements (`minSpan: 4`, cf. A6) et qui ramasse. Le choix devient « large =
   lent, riche et dangereux » contre « étroit = rapide, pauvre et sûr ». Aujourd'hui
   il n'y a pas de choix.

---

## A6. L'effondrement : 374 masses qui tombent par partie, 0 à 7 points de dégât, et un type de niveau qui n'existe pas

**Trois problèmes empilés.**

**(a) Le type de niveau `effondrement` n'a aucun code.** `world.js:48-315` traite
`chute`, `filon`, `dedale`, `gisement`, `sceau`. `effondrement` n'apparaît **nulle
part**. Les niveaux 2-4 et 3-4 sont des `descente` avec un multiplicateur de Faille
différent — et la Faille ne fait rien (A1). Deux des sept variantes annoncées sont donc
la même chose que la variante de base.

**(b) À largeur 2, un effondrement est mathématiquement impossible.**
`emptySpanBelow` (`world.js:320-326`) mesure la largeur du vide sous une case ;
`looseMass` refuse si `span < CFG.FALL.minSpan = 4` (`world.js:330-331`, `config.js:35`).
Une descente en largeur 2 creuse un puits de 2 : la voûte ne cède jamais. Le système ne
s'allume que si le joueur achète de la largeur — c'est-à-dire s'il achète le pire
upgrade du jeu (A5).

**(c) Quand il s'allume, il ne fait rien.** Le bot déclenche **374 effondrements par
partie** (~27 par niveau) et perd **0 à 7 points d'intégrité sur 10 parties, médiane 0**.
Raison : `massCanOccupy` (`game.js:333-345`) interdit à une masse d'avancer sur une case
occupée par la foreuse. Une masse ne peut donc **jamais** écraser un joueur immobile ;
seul un joueur qui fonce dans une masse déjà en chute se blesse. La menace est
auto-annulée par sa propre sécurité.

Résultat : les effondrements sont un effet sonore et visuel à haute fréquence, sans
conséquence. Et les quatre cartes bâties dessus sont mortes : `T-01 Sismographe`
(colorer un danger qui n'en est pas un), `T-02 Étayeur`, `T-03 Charognard`,
`T-05 Onde sismique`.

**Correction.**
1. Écrire la variante `effondrement` : voûtes pré-fracturées, `minSpan: 2` sur ce
   type de niveau, `FALL.speed` 26 → 40, et des masses déclenchées par la **descente**
   et non par la largeur de taille.
2. Faire que le danger soit réel : au lieu de bloquer la masse, l'autoriser à écraser
   et infliger `damage` + immobilisation. Les 0,4 s de `FALL.shake` sont déjà
   l'avertissement — c'est un geste à réussir, exactement ce que `v3-challenge.md` §3
   demandait.
3. `FALL.damage: 1` → 1, mais retirer les i-frames de 1,3 s sur les chutes de roche
   (`config.js:20`) : deux masses successives doivent pouvoir coûter 2 PV.

---

## A7. Le carburant, l'or et la boutique n'imposent aucune décision

**Carburant.** Mesures sur 12 graines :

| niveau | L brûlés | réservoir max à ce stade |
|---|---|---|
| 1-1 | 52 L | 120 L |
| 2-3 | 86 L | ~200 L |
| 3-1 | 96 L | ~280 L |
| 3-6 | 70 L | 320-360 L |

La consommation stagne à 40-140 L pendant que le réservoir triple. Sources
d'approvisionnement cumulées par niveau : `freeTop: 35` L offerts au départ
(`config.js:61`), 5 à 7 bidons de 32 L enfouis (`config.js:105/114/123`), un bidon
**garanti** sous le seuil de 20 L (`rescueCan`, `game.js:507-522`), et l'achat en
station. Le bot finit régulièrement un niveau à **305 L sur 320**.

La panne sèche existe (`dryChoice`) mais propose « payer 150 $ » contre « relancer le
niveau » alors qu'on a 8 000 $ en poche : ce n'est pas un choix.

**Or.** Or gagné par niveau, moyenne sur 10 graines : 325 $ → 237 → 620 → 2 574 →
1 413 → 939 → 556 → 933 → **8 151** → 10 848 → **14 903** → 7 618 → 7 193 → 12 326 $.
**Inflation ×46 en 11 niveaux.** Cause principale : la roche CRISTAL de la couche 3
(18 % des blocs, `config.js:122`) a `cascade: 10, gold: 0.5` (`world.js:21`), donc un
seul coup peut enchaîner jusqu'à 60 cases à `38 × 0,5 = 19 $` la case, soit **1 140 $
en une frappe**.

Face à ça, la boutique croît en ×1,62 : coût cumulé d'une tête de forage au rang n :
170 / 445 / 891 / 1 614 / 2 785 / 4 682 / 7 755 / 12 733 $. Le résultat est un jeu à
deux régimes :
- niveaux 1 à 3 : on encaisse 325 $, une pièce coûte 170 $ → on achète **une** chose,
  la décision est intéressante ;
- niveaux 9 à 14 : on encaisse 8 000 à 15 000 $, on achète **tout** et il reste
  1 258 à 1 672 $ de monnaie qui ne sert plus à rien.

**Défis.** Trois défis par niveau, 85 à 120 $ pièce. Taux de réussite du bot **sans
aucun effort** :

| défi | réussite |
|---|---|
| `noup` — ne jamais forer vers le haut | **100 %** (60/60) |
| `straight` — 25 blocs sans changer de sens | **100 %** (65/65) |
| `noreserve` — ne jamais passer en réserve | **96 %** |
| `fuel50` — finir avec plus de 50 L | **87 %** |
| `ore10` — ramasser 10 minerais | 60 % |
| `bonus3` — ramasser 3 bonus | 18 % |
| `fall30` — chuter de 30 blocs d'un coup | **0 %** (0/61) |

Cinq défis sur sept sont un revenu passif (~200 $/niveau garanti). Un est
inaccessible en pratique.

**Correction.**
- Carburant : `freeTop` 35 → 0, `bidon` 32 → 20, `burnPerBlock` 0,20 → 0,30,
  pièce `reservoir` `max: 6` → `max: 3` et `+40 L` → `+25 L`. Et **coupler la
  consommation à la dureté** (`burn *= 1 + maxHard/40`) : la profondeur redevient une
  pression économique, ce qui donne enfin un rôle à toute la famille RESERVOIR.
- Or : `BEHAVIOUR[10].gold` 0,5 → 0,12 et plafond de cascade payante à 15 cases ;
  valeurs de minerai 13/22/38 → 13/19/26 ; croissance des pièces 1,62 → 1,45.
- Défis : remplacer les cinq défis passifs. Propositions : « aucun bloc HARD percé »,
  « sortir sans avoir dévié de plus de 8 colonnes », « déclencher 3 effondrements »,
  « poser 2 charges », « finir sans jamais forer plus de 2 s dans la même direction ».
  Et indexer la prime sur le minerai du niveau (+30 % de l'or ramassé) plutôt qu'un
  forfait, pour qu'elle ne soit ni dominante au début ni ridicule à la fin.

---

# B. Ce qui l'affaiblit

## B1. Sur 31 passifs, 11 sont inertes et 6 sont des pièges

Recensement, en croisant les mesures ci-dessus :

**Morts (l'effet ne se produit jamais)**
| carte | pourquoi |
|---|---|
| `T-04 Casse-cou` | condition « Faille à moins de 15 lignes » : jamais vraie (A1). Doublement mort : son déblocage exige `buried: 8`, or `buried` vaut toujours 0. |
| `T-01 Sismographe` | signale des masses qui ne blessent pas (A6) |
| `T-02 Étayeur` | empêche des effondrements sans conséquence |
| `T-06 Casque renforcé` | +1 PV alors qu'on n'en perd 0 |
| `T-05 Onde sismique` | recharge un turbo déjà toujours plein |
| `U-01 Économe`, `U-02 Réserve profonde`, `U-06 Jerricane`, `U-03 Goutte à goutte`, `U-05 Récupérateur`, `U-04 Turbo sec` | **toute la famille RESERVOIR, 6 cartes = 19 % du pool**, dans un jeu où le carburant est surabondant (A7) |

**Pièges (l'effet est négatif)** : `Z-01 Tunnelier`, `Z-03 Élargisseur`,
`PA-4 Pacte du colosse` (A5), `O-02 Cupidité` (−10 % de vitesse contre de l'or qui ne
sert plus), `PA-2 Pacte de l'avare` (×3 la valeur, boutique fermée : on échange une
ressource inutile contre la seule qui compte), `PA-1 Pacte du fondeur` (force ×2 = 0 %
la moitié du temps, A4).

**Dominantes** : `Z-04 Perforateur` (longueur +1, ×3 → −55 % de temps de descente),
`V-01 Injection` (`max: 99`, seul stat linéaire et non plafonné), `P-01 Chenilles
crantées`, `F-05 Brise-roche` (le crit court-circuite le `Math.ceil`).

Il reste donc **environ 8 cartes qui font quelque chose de non trivial**, dont 2
obligatoires. Les tirages proposent 3 cartes : la probabilité qu'un tirage ne contienne
aucun choix réel est élevée. Mesuré sur 10 runs × 14 stations : `Perforateur` proposé
10 fois sur 140, `Foreuse gravitationnelle` **1 fois sur 140**.

**Correction.** Deux leviers, dans cet ordre :
1. **Ne pas soigner les cartes, soigner les systèmes.** Si A1/A6/A7 sont corrigés,
   11 des 17 cartes mortes reviennent à la vie sans qu'on y touche. C'est le meilleur
   rapport effort/gain du rapport.
2. Retirer les 3 pièges non réparables (`Z-01`, `PA-2`, `O-02` sous sa forme actuelle)
   et rééquilibrer le pool par famille : RESERVOIR à 6 cartes sur 31 est deux fois trop
   pour son poids réel dans la partie.

## B2. Le Sceau de quartz — le climax du jeu — est plus tendre que la roche autour

`config.js:154` : `sealHard: 26`. À 1600 m, la roche HARD normale vaut
`hardnessAt(1600) × 1,7 = 28,9` (`world.js:74`). **Le Sceau final est 10 % plus tendre
que le granit ordinaire du même niveau.** Il occupe 6 lignes sur 120, soit 5 % du
niveau. Avec une force de 35-41, il tombe en 1 coup par bloc comme tout le reste.

Le Sceau 1-2 (`sealHard: 5`) arrive quand la force vaut 2 à 4,5 : c'est le seul des
trois qui se sente, et c'est le premier.

**Correction.** `sealHard` en multiple de la roche locale, pas en absolu :
`sealHard: 3.5` × `hardnessAt(profondeur)` → 17,8 / 42 / 60. Épaissir à 10 lignes.
Et rendre le franchissement actif : le Sceau ne cède que sur une charge explosive, ou
il repousse d'une ligne toutes les 2 s si on arrête de forer.

## B3. Le dedale est le seul pic de la partie, et c'est un pic d'attente

40,1 s de moyenne contre 15 s pour tout le reste. Répartition du temps mesurée sur ce
niveau : **22,5 s de forage, 15,1 s de roulage latéral**. C'est le seul niveau où le
joueur passe 40 % de son temps à longer un mur en cherchant une ouverture.

Cause (`world.js:182-198`) : 5 murs de socle infranchissable de 58 blocs de large avec
3 ouvertures de 6 blocs, tirées au hasard, dans un niveau où la vision vaut 13 blocs
(`config.js:82`). Chercher une ouverture est du balayage, pas de la navigation.

**Correction.** Rendre les ouvertures **lisibles à distance** : une lueur visible à
travers le socle sur toute la largeur (le rendu le fait déjà pour les objets enfouis,
`render.js:227-245`). Et attacher un vrai choix aux trois ouvertures : la plus proche
donne sur un couloir de granit, la plus lointaine sur du vide. Le joueur choisit entre
« court et dur » et « long et rapide ». Aujourd'hui les trois ouvertures sont
identiques, donc le seul travail est de trouver la moins loin.

## B4. Le Carnet se vide en une partie

`v4-retention.md` §2 annonce « un déblocage toutes les une à trois parties ». Mesure
réelle des compteurs après **une seule** expédition complète du bot :
`{ore: 292, cans: 15, bonuses: 16, collapses: 374, medOr: 12, bestDepth: 1600,
bestLayer: 3, buried: 0, bombes: 4, finished: 1, cleanRuns: 1}`.

Confronté aux seuils de `config.js:221-256` :

| seuil | valeur après 1 run | verdict |
|---|---|---|
| `ore: 260` → Élargisseur | 292 | tombé |
| `cans: 15` → Camionneur | 15 | tombé pile |
| `collapses: 220` → Gravitationnelle | 374 | tombé |
| `bestLayer: 2` et `3` → Tunnelier, Parieur | 3 | tombés |
| `bestDepth: 1300` → Tête stellaire | 1600 | tombé |
| `finished: 1` → Graine du jour, PROFONDEUR II | 1 | tombés |
| `cleanRuns: 1` → L'Ascète | 1 | tombé |
| `medOr: 14` → Perpétuel | 12 | ~1,2 run |
| `bonuses: 20` → Sablier | 16 | ~1,3 run |
| `collapses: 700` → Noyau instable | 374 | 2 runs |
| `cans: 30` → Récupérateur | 15 | 2 runs |
| `bombes: 25` → L'Artificier | 4 | **6 runs** |
| **`buried: 8` → Casse-cou** | **0** | **jamais** |

**13 des 17 déblocages tombent dans la première partie.** La promesse « on voit
toujours ce qui est à une partie » tient exactement une partie, après quoi il reste
trois cibles dont une inatteignable.

**Correction.** Recaler sur la mesure, pas sur l'estimation : `ore: 260 → 800`,
`cans: 15 → 40`, `collapses: 220 → 900` (ou 220 si A6 est corrigé et que les
effondrements deviennent rares et graves), `medOr: 14 → 30`, `bonuses: 20 → 60`,
`bestDepth: 1300 → 1600 puis un palier PROFONDEUR II`. Et `buried: 8` ne redevient
atteignable que si A1 est corrigé.

## B5. Les explosifs : 4 charges posées par expédition, et aucune décision

Mesure : le bot ramasse ~55 ingrédients par expédition et pose **4 charges sur
14 niveaux**, soit 0,3 par niveau, alors qu'il termine avec des dizaines d'ingrédients
inutilisés en poche.

Deux causes.
1. `craft()` (`game.js:206-224`) fabrique **automatiquement**, en parcourant les recettes
   de la plus puissante à la plus simple. Le joueur ne choisit jamais quoi fabriquer :
   ses ingrédients sont consommés par la première recette complétable dans un ordre fixe.
   Il n'y a aucune décision dans un système de craft.
2. Le rendement est faible : une dynamite (rayon 4) dégage ~50 blocs, soit **~4 lignes
   sur 110**. Pour 0,85 s de mèche et un détour de ramassage. La « Bombe abyssale »
   (rayon 9, ~250 blocs, ~18 lignes) est la seule qui change quelque chose, et elle
   demande `dent` (poids 5/127 dans le sac de la couche 3, soit 4 % des tirages).

Le seul explosif mécaniquement intéressant est le `Pet de champignon` (`poussee: 26`) :
il déplace la foreuse. C'est celui dont le rayon est le plus petit.

**Correction.** Rendre le craft manuel (un panneau à la station, ou un cycle à la
touche), et repositionner les charges comme un **outil de traversée** plutôt que de
minage : plafonner le rayon à 4 pour tout le monde, mais généraliser la poussée
(`poussee` sur toutes les recettes) et la `Charge dirigée` (couloir de 15 blocs = 15
lignes gratuites, sans carburant). L'explosif devient « je saute 15 lignes » au lieu
de « je gagne 4 lignes ».

## B6. La densité de contenu réelle est trois fois plus basse que celle configurée

Un niveau fait 60 × 110 = 6 600 blocs. Une descente en largeur 2 en excave 220, soit
**3,3 %**. Les 8 à 10 bonus, 13 ingrédients et 5 à 7 bidons semés par niveau
(`config.js:105-123`) sont donc dilués dans un volume que le joueur ne visite pas.

Mesuré : **0,3 à 2,7 bonus ramassés par niveau** (moyenne ~1,3), ~1 bidon, ~4
ingrédients sur 13. Le défi `bonus3` échoue à 82 % pour cette seule raison.

**Correction.** Semer dans une bande autour du couloir probable plutôt qu'uniformément :
`scatter` (`world.js:216-226`) tire `bx = rng.int(2, W-3)` ; le remplacer par une
marche aléatoire qui part de `startX` et dérive vers `exitX`, avec ±10 colonnes de
dispersion. À nombre d'objets constant, le joueur en rencontre 3 à 4 fois plus, et les
détours redeviennent le cœur de la boucle (cf. C1).

## B7. Le turbo se mérite, puis ne sert à rien

`TURBO` (`config.js:43-48`) : 0,14 par minerai, 0,30 par bonus, 0,05 par effondrement.
Avec 15 minerais + 27 effondrements par niveau, on gagne **~3,5 charges** par niveau
pour une jauge plafonnée à 1. Le turbo est donc toujours disponible — le « il se mérite »
de `v3-challenge.md` §2 n'est pas vrai en pratique.

Et son effet est faible : ×2 pendant 2 s, cooldown 3,5 s + rechargement.
Banc : sur un niveau de 33 s, un ×2 permanent donne 17,8 s ; 2 s de turbo par niveau
valent donc **~1 s, soit 5 %**.

**Correction.** Soit on assume : turbo gratuit sur cooldown court, et on supprime la
jauge (un système de moins). Soit on le rend réellement rare et puissant : gains divisés
par 4, `turboDur` 2 → 4 s, `turboMult` 2 → 3,5, et le turbo traverse la roche que la
force ne peut pas casser (cf. A4). C'est alors une clé, pas un boost.

---

# C. Détails

## C1. Le coût d'un détour est bien réglé — la récompense ne l'est pas

C'est le seul endroit où la boucle seconde-par-seconde fonctionne, il faut le dire.
Banc, 116 lignes, force 14, vitesse 5 :

| comportement | temps |
|---|---|
| tout droit | 32,9 s |
| 1 changement de direction toutes les 6 s | 44,3 s (**+35 %**) |
| toutes les 3 s | 47,1 s (+43 %) |
| toutes les 1,5 s | 69,2 s (+110 %) |

Entre le pivot de tête (`rot: 0,20`), la perte d'élan (`elanLoss: 0,5`, soit −25 % de
vitesse) et les 3 s de remontée (`elanRise: 3,0`), **chaque écart coûte 1 à 2 secondes
réelles**. La question « est-ce que ça vaut le détour ? » est parfaitement posée par la
mécanique.

Le problème est de l'autre côté : au bout du détour il y a un bonus qui dure 20 s dans
un niveau qui en dure 15, du minerai qui vaut un or dont on ne sait que faire, ou un
bidon d'un carburant surabondant. **Corriger A7 et B6 suffit à faire exister ce choix**,
sans toucher au pilotage.

## C2. Le pitch du menu contredit le jeu

`index.html:220-223` : « Il n'y a pas de vie et pas de game over : ton seul adversaire
est le chrono. » Le jeu a 3 points d'intégrité (`config.js:19`), une panne sèche qui
relance le niveau, et une Faille qui ensevelit. Ces trois systèmes ne sont expliqués
nulle part au joueur avant qu'il les rencontre.

Le même écran annonce « le centre de la planète est à 1 300 mètres » alors que le
dernier niveau s'arrête à 1 600 m (`config.js:154` : `top: 1480 + height: 120`).

Et il demande de choisir un métier avant la première partie, sans que le joueur puisse
savoir ce que « force ×2 » veut dire — alors qu'au niveau 1-1, force ×2 ne veut rien
dire du tout (A4).

**Correction.** Ne proposer le choix de métier qu'à partir de la deuxième expédition
(la première impose Le Furieux, le seul dont l'effet est immédiatement perceptible), et
remplacer le paragraphe de pitch par les trois règles qui vont réellement tuer le joueur.

## C3. La position horizontale de la sortie est invisible jusqu'à la dernière seconde

`world.js:260-271` : la sortie est tirée au hasard et le point de départ est
volontairement décalé de 14 à 26 colonnes (« il y a toujours du chemin latéral à
faire »). L'intention est bonne — mais la jauge latérale (`render.js:527-560`) n'affiche
que la **profondeur** de la sortie, jamais sa **colonne**. Le joueur ne peut pas dériver
progressivement pendant la descente ; il découvre la sortie dans les 15 dernières lignes
et doit alors corriger latéralement d'un coup, au moment où c'est le plus cher (C1).

**Correction.** Une flèche de cap en bas de l'écran, ou une graduation horizontale sur
la jauge. Le trajet optimal (une diagonale douce) devient alors jouable au lieu d'être
un rattrapage.

## C4. Le forage en diagonale est une mécanique entière, non documentée et non équilibrée

`drill.js:42-53` : quand `fx` et `fy` sont tous deux non nuls, la taille vise
**à la fois** la colonne latérale et la ligne du dessous — donc 2×`w` cases par
complétion, pour +1 ligne et +1 colonne. Le menu mentionne « 2 touches — forer en
diagonale » sans dire ce que ça fait. Aucun texte, aucune carte, aucun défi ne s'y
rapporte. Et ça consomme le double.

## C5. `Injection`, `Bras de fer` et `Carbure` sont à `max: 99`, tout le reste à 1-5

`content.js:42-62`. Trois cartes empilables à l'infini dans un pool où tout le reste
plafonne. Sur une partie de 14 stations ce n'est pas exploitable, mais c'est une
incohérence de design qui deviendra un problème dès qu'un mode long existera.

## C6. Le multiplicateur de combo est de l'or, uniquement

`bumpCombo` (`game.js:624-629`) monte jusqu'à ×2,5 et alimente **seulement** la valeur
du minerai. Dans un jeu où l'or est saturé (A7), le combo — qui a une fenêtre de 3 s et
demande donc de la lecture — ne récompense rien. Le brancher sur la vitesse de forage
ou sur la jauge de turbo lui donnerait un sens immédiat.

## C7. `EVENT_FIRST: 12` contre des niveaux de 15 s

`config.js:167-168` : premier événement de couche à 12 s, écart minimum de 22 s entre
deux. Les niveaux durent 10 à 20 s. **La plupart des niveaux ne voient donc aucun
événement**, et jamais deux. Sur une expédition complète, le bot en a vu 5 sur 7 types
existants — dont `filonrev` qui fait apparaître un filon 8 à 26 lignes plus bas, souvent
après la sortie. Baisser `EVENT_FIRST` à 4 s et `EVENT_GAP` à 10 s, ou allonger les
niveaux.

---

# Les 5 changements qui apporteraient le plus

Classés par gain, avec l'effort estimé.

### 1. Calibrer la Faille sur le barème de médailles — et resserrer le barème
**Gain : maximal.** C'est le seul adversaire du jeu et il n'a jamais touché personne
(0 ensevelissement sur 168 niveaux). Le rendre menaçant réactive d'un coup : la tension
seconde par seconde, le `sealBoost`, `Casse-cou`, le déblocage `buried`, la valeur du
détour (un détour coûte enfin quelque chose de visible), et la signification du bronze.
**Effort : 1 à 2 h.** `vitesse = def.height / def.bronze`, `delay: 4`, `accel: 0`, plus
les 42 valeurs de seuils recalculées (or/argent/bronze = 0,70/0,90/1,15 × temps mesuré).
À faire avec le correctif `R` (A2), sans quoi la menace est annulable par une touche —
2 minutes de plus.

### 2. Supprimer le `Math.ceil` sur les coups par bloc, et faire de la force un seuil
**Gain : très élevé.** Aujourd'hui, entre force 8 et force 15, la progression vaut
exactement 0 %. Huit objets de contenu (cartes, pièces, métier, pacte, bonus) ont une
valeur illisible ou nulle. Rendre la force continue les répare tous ; en faire un seuil
de passage crée en plus une vraie navigation (« ce granit, je le contourne ou je le
casse ? »), ce qui est le geste qui manque à la boucle.
**Effort : 30 min pour le `ceil` (une ligne, `drill.js:185`), 1 jour pour le seuil**
(garde-fous anti-blocage, veines de granit dans `world.js`, retour visuel).

### 3. Refaire l'économie du carburant, et lui donner la profondeur pour ennemi
**Gain : élevé.** Cela ressuscite **6 cartes sur 31** (toute la famille RESERVOIR),
2 pièces de boutique sur 7, un métier, et redonne un sens à la panne sèche, aux bidons,
aux détours, et à la largeur de taille. C'est la ressource la moins chère à réparer par
carte ranimée.
**Effort : 2 à 3 h.** `freeTop` 35→0, `bidon` 32→20, `burnPerBlock` 0,20→0,30,
`reservoir` max 6→3 et +40→+25 L, et surtout `burn *= 1 + maxHard/40` dans
`drill.js:199` pour coupler consommation et profondeur. Puis une passe de simulation
pour vérifier qu'on ne bloque personne.

### 4. Rendre l'effondrement dangereux, et écrire la variante qui porte son nom
**Gain : élevé.** 374 masses tombent par partie pour 0 dégât médian, et deux des sept
variantes de niveaux (2-4, 3-4) n'ont aucun code — ce sont des `descente`. C'est le
chantier n°1 de `v3-challenge.md`, annoncé comme implémenté, et il ne l'est qu'à moitié.
Ranime 4 cartes TERRAIN et donne enfin un rôle positif à la largeur de taille.
**Effort : 1 jour.** Autoriser l'écrasement dans `massCanOccupy`/`updateFalls`
(`game.js:333-425`), `minSpan` 4→2 sur les niveaux `effondrement`, `FALL.speed` 26→40,
retirer les i-frames sur les chutes de roche, et écrire ~40 lignes de génération dans
`world.js` (voûtes pré-fracturées, cavernes plafonnées).

### 5. Densifier ce que le joueur rencontre réellement, et purger le pool de cartes
**Gain : moyen mais large.** Le joueur ne visite que 3 % du niveau et ramasse ~1,3 bonus
par niveau sur 9 semés. Semer le long du couloir probable multiplie par 3 ce qu'il
rencontre, à contenu constant — et c'est ce qui donne enfin une raison de payer les
+35 % de temps que coûte un détour. En parallèle, retirer les 3 pièges non réparables
(`Z-01 Tunnelier`, `PA-2 Pacte de l'avare`, `O-02 Cupidité`) et recaler les 13 seuils
du Carnet qui tombent tous dans la première partie.
**Effort : 3 à 4 h** pour le semis dirigé (`world.js:216-226`, une marche aléatoire de
`startX` vers `exitX`), **1 h** pour le pool de cartes, **1 h** pour les seuils du Carnet.

---

## Ce qui marche, et qu'il ne faut pas casser

- **Le coût d'un changement de direction** (+35 % de temps par détour toutes les 6 s)
  est le meilleur réglage du jeu. Toute la boucle peut être reconstruite dessus.
- **La longueur de taille** est un stat propre : −55 % de temps, effet lisible,
  plafond net à 4.
- **La lisibilité des objets enfouis à travers la roche** (`render.js:227-245`) : c'est
  ce qui rend un détour désirable avant d'être payé. C'est exactement le bon principe.
- **Les niveaux de 15 secondes** : le rythme station-tous-les-15-secondes est bon. Le
  problème n'est pas leur longueur, c'est qu'il ne s'y passe rien.
