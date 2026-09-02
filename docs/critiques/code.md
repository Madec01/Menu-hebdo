# CORE — revue de code

Revue portant uniquement sur le code (`src/*.js`, `build.js`), pas sur le game design ni
sur l'art. Toutes les affirmations ci-dessous ont été vérifiées en lisant le code et, quand
c'était possible, en l'exécutant sous node avec le harnais suivant :

```js
// boot.js
global.window = { addEventListener: function () {} };
global.performance = { now: function () { return Date.now(); } };
var store = {};
global.localStorage = {
  getItem: function (k) { return store[k] === undefined ? null : store[k]; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
['config','rng','content','world','audio','drill','save','game']
  .forEach(function (f) { require('/home/user/Menu-hebdo/src/' + f + '.js'); });
module.exports = { C: window.CORE, store: store };
```

Constat général sur l'état : `node build.js` ne produit aucun diff, `core.html` est donc à
jour. Le simulateur headless enchaîne les 14 niveaux sans lever d'exception. La génération
de monde ne lève jamais d'exception sur 2 800 tirages (14 niveaux × 200 graines) et aucun
niveau `gisement` ne génère moins de minerai que son quota. Les problèmes sont ailleurs.

---

## 1. Bugs à corriger

### CRITIQUE

#### B1 — L'écran de fin plante avec le métier « Le Parieur »

`CFG.LEVELS` compte 14 entrées, mais `MT-7` démarre au niveau d'index 2
(`src/content.js:213`, `skip: 2`), donc `G.run.splits` n'en contient que 12.
`buildEnd` itère pourtant sur les 14 niveaux et fait `fmt(run.splits[i])`
(`src/ui.js:296`), où `fmt` appelle `t.toFixed(1)`.

Preuve :

```
job MT-7 skip = 2
levelIndex initial = 2 | splits = 0
splits.length = 12  LEVELS.length = 14
splits[12] = undefined  -> TypeError: Cannot read properties of undefined (reading 'toFixed')
```

L'exception est levée dans le `onclick` de `#stNext` (`src/ui.js:431-434`), après
`GAME.nextLevel()` : l'état est déjà passé à `end`, l'écran de fin ne se construit jamais
et le joueur reste bloqué sur la station avec un écran vide. La partie entière est perdue.

Correction (`src/ui.js:290-298`) — n'afficher que les niveaux réellement joués :

```js
var first = CFG.LEVELS.length - run.splits.length;
CFG.LEVELS.forEach(function (def, i) {
  if (i < first) return;                       // niveaux sautés par le métier
  var k = i - first;
  var med = run.medals[k] || 'none';
  tr.innerHTML = ... + '<td>' + fmt(run.splits[k]) + 's</td>';
```

Mieux : stocker l'index dans le split (`G.run.splits.push({ i: levelIndex, t: t })`) plutôt
que de reconstruire la correspondance par soustraction. `run.medals[i]` souffre du même
décalage mais est masqué par le `|| 'none'` — les médailles sont donc affichées en face des
mauvais niveaux, même quand ça ne plante pas.

#### B2 — Une sauvegarde `core.records.v2` corrompue bloque définitivement le jeu

`load()` (`src/save.js:41`) fait `JSON.parse(...) || def` : seul un résultat *falsy* déclenche
le repli sur la valeur par défaut. Une valeur JSON valide mais de mauvaise forme (`5`,
`"x"`, `{"total":3}` sans `levels`, une écriture tronquée puis re-parsable, un ancien format
v1) passe la garde, et `d.levels[levelId]` (`src/save.js:51`) explose.

```
record() sur sauvegarde corrompue -> TypeError: Cannot read properties of undefined (reading '1-1')
best()   sur sauvegarde partielle -> Cannot read properties of undefined (reading '1-1')
```

`SAVE.record` est appelé depuis `finishLevel` (`src/game.js:912`) et `SAVE.best` depuis
`buildStation` (`src/ui.js:187`) : la station ne se construit plus, le jeu est mort à la fin
du premier niveau, et à chaque rechargement, puisque la donnée fautive persiste. Il n'existe
aucune UI pour appeler `SAVE.reset()`.

Correction — normaliser à la lecture plutôt qu'au coup par coup :

```js
function load(key, def) {
  var v;
  try { v = JSON.parse(localStorage.getItem(key)); } catch (e) { return def; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return def;
  for (var k in def) if (v[k] === undefined || (def[k] && typeof def[k] === 'object' && typeof v[k] !== 'object')) v[k] = def[k];
  return v;
}
```

`carnet()` fait déjà ce travail à la main (`src/save.js:80-86`) : c'est le signe que la
garde manque au bon endroit.

#### B3 — La foreuse traverse la roche indestructible dès que la vitesse monte

`src/drill.js:128-161` ne teste la collision qu'à la position d'arrivée, sans balayage. Le
pas maximal est `vitesse × dt`, avec `dt` plafonné à 0,05 s (`src/main.js:192`). Or les
vitesses de déplacement montent très haut : `roll` de base 9, `chenilles` ×6 en boutique
(+15) puis `P-01` ×4 (×1,5⁴), soit **121,5 blocs/s**, ×1,4 sous turbo.

```
roll max = 121.5 blocs/s ; climb = 55.7
pas horizontal a dt=0.05 avec turbo : 8.51 blocs (DRILL_W=2)
```

Test sur un mur de socle de 2 blocs d'épaisseur, `chenilles x6 + P-01 x4` :

```
step 0 x = 21.07 | encastre ? false
step 1 x = 27.15 | encastre ? false      <- le mur est en x=25..26
step 2 x = 33.23 | encastre ? false
mur en x=25..26 : la foreuse est passee au travers = true
```

Le seuil de traversée d'un mur d'un bloc est `vitesse × dt ≥ 2`, soit `roll ≥ 40` à 20 fps
ou `roll ≥ 120` à 60 fps. Un joueur qui achète 4 chenilles et prend deux `P-01` est à
`roll ≈ 42` : **toute chute d'images à 20 fps lui fait traverser les murs du dédale et le
socle du niveau**. Le `Math.max(0.05, Math.min(world.w - DW - 0.05, d.x))` de la
ligne 162 ne protège que les bords extérieurs.

Correction — sous-pas de collision, quelques lignes seulement :

```js
function step(world, d, dx, dy) {              // sous-pas ≤ 1 bloc
  var n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (var k = 0; k < n; k++) { /* logique actuelle avec dx/n, dy/n */ }
}
```

Alternative moins invasive si on veut éviter de toucher la résolution : plafonner
`vitesse × dt` à `DRILL_W - epsilon` dans `update`, en découpant le déplacement.
Ne pas se contenter de baisser `dt` : la cause est le pas, pas l'horloge.

#### B4 — Le recalage après collision peut encastrer la foreuse dans le socle

Indépendamment de B3, le recalage `d.y = Math.floor(ny) + 1` (`src/drill.js:158`) et
`d.x = Math.floor(nx + DW) - DW` (`src/drill.js:134`) supposent que le bloc bloquant est
celui de la cellule où atterrit l'arête avant. Dès que le déplacement franchit plus d'une
cellule, le recalage place la foreuse **à l'intérieur** de la deuxième rangée solide :

```
apres 1 pas (dt=0.05, climb=55.7) : y = 31.00
rangees occupees : 31 et 32 ; type(31)= 5 (BEDROCK)
overlapsSolid = true <- foreuse encastree dans le socle
```

Le garde-fou de `src/game.js:718-732` ne sauve pas la situation : il appelle `destroyAt` sur
les cases occupées, or `BEDROCK` n'est pas dans `DESTRUCTIBLE`, l'appel est un no-op et
`G.embedT` est remis à zéro toutes les secondes sans rien débloquer. La foreuse ne s'en sort
que par hasard, en continuant de traverser.

Correction — reculer jusqu'à la dernière position libre au lieu de calculer une arête :

```js
} else if (d.vy < 0) {
  var y = Math.floor(ny) + 1;
  while (y < d.y && overlapsSolid(world, d.x, y)) y++;   // borné par d.y
  d.y = y;
}
```

Le sous-pas de B3 rend ce correctif largement inutile ; les deux se corrigent ensemble.

### MAJEUR

#### B5 — Forer en diagonale coûte deux fois moins de carburant

`targets()` (`src/drill.js:33-55`) empile les cellules de la colonne **et** de la rangée
quand `fx` et `fy` sont tous deux non nuls, alors que la facturation du carburant
(`src/drill.js:198`) utilise `area = round(s.width) * round(s.length)`, qui ignore la
direction.

```
dir(1,0) largeur 6 longueur 4 -> cases visees  24 | carburant facture pour 24 cases
dir(1,1) largeur 6 longueur 4 -> cases visees  48 | carburant facture pour 24 cases  <-- ECART x2.0
```

Le commentaire de `src/drill.js:193-196` annonce explicitement l'intention inverse (« le
carburant punit la largeur de taille »). Tenir deux directions à la fois donne une remise de
50 % sur le carburant, et le défi `fuel50` comme la carte `U-01` s'en trouvent triviaux.

Correction — facturer le nombre réel de cellules cassables :

```js
hooks.onBurn(CFG.FUEL.burnPerBlock * breakable * mult * (rate / hits) * dt);
```

`breakable` est déjà calculé ligne 95. Cela corrige aussi le cas où la taille dépasse en
partie dans le vide : aujourd'hui on paye pour des cases vides.

#### B6 — La touche R remet le chrono et le carburant à zéro sans coût

`src/main.js:168` appelle directement `GAME.startLevel(G.run.levelIndex)`, en contournant
`restartLevel()` (`src/game.js:298-307`) qui, lui, fait `G.run.total += G.levelTime`,
`G.run.lost += G.levelTime` et `G.run.restarts++`. Résultat : le joueur relance autant de
fois qu'il veut, gratuitement, sans que ni le total de l'expédition ni le compteur de
relances (utilisé pour le déblocage `cleanRuns`, `src/game.js:997`) n'en gardent trace. Le
carburant est également restauré à `G.run.fuelCarry`, c'est-à-dire au plein du début de
niveau. Le classement par temps total et le déblocage « expédition sans relance » sont donc
sans valeur.

Correction : `if (e.code === 'KeyR' && G.state === 'play') { GAME.restartLevel(); return; }`
et exporter `restartLevel` depuis `CORE.GAME`.

#### B7 — L'événement COUP DE GRISOU n'existe pas, EBOULEMENT non plus

Recherche de chaque identifiant d'événement hors `config.js` :

```
grisou     : (aucune occurrence)
eboulement : src/game.js:644 : world.ceilingRow = Math.floor(G.drill.y) - 26;
```

`grisou` (« la roche explose », 10 s) n'est implémenté nulle part : c'est une bannière et un
son, sans le moindre effet. `eboulement` (« le plafond se referme », 14 s) écrit
`world.ceilingRow`, qui n'est **jamais lu** — ni dans `game.js`, ni dans `render.js`, ni
dans `world.js` (les seules autres occurrences sont l'initialisation
`src/world.js:291`). Deux des sept événements de couche sont donc décoratifs, et comme
`fireEvent` tire uniformément dans le pool (`src/game.js:634-635`), près d'un événement sur
trois ne fait rien.

Correction : soit implémenter les effets, soit retirer les deux entrées de `CFG.EVENTS` —
mais pas les laisser mentir au joueur.

#### B8 — L'événement COUPURE est appliqué deux fois

`src/game.js:65` fait `s.vision = 4`, et `src/render.js:30` refait
`g.stats.vision * (… 'coupure' ? 0.4 : 1)`. La vision effective tombe à 1,6 bloc au lieu
de 4. Deux sources de vérité pour la même règle. Garder celle de `computeStats` et supprimer
le facteur de `render.js:30`.

#### B9 — Le passif « Turbocompresseur » (P-07) est sans effet

`CFG.BASE.turboCd` (`src/config.js:79`) et `P-07` (`src/content.js:85-87`, qui fait
`s.turboCd *= 0.5ⁿ`) portent sur une statistique que `drill.js` ne lit jamais : le
rechargement est codé en dur, `d.turboCd = 1.5 + s.turboDur` (`src/drill.js:82`).

```
BASE.turboCd = 15 -> utilise dans drill.js ? false
```

Une carte rare achetable jusqu'à ×2 ne fait rien. Correction :
`d.turboCd = s.turboCd * (…)`, ou supprimer `turboCd` de `BASE` et la carte.

#### B10 — Le passif « Sismographe » (T-01) est sans effet

`flag: 'seismo'` (`src/content.js:121-123`) n'est lu nulle part. Les masses instables ne se
colorent pas plus qu'avant. Même remède que B9 : implémenter dans `render.js` (les cellules
en `state === 'shake'` sont déjà distinguées, `src/render.js:199-211`, il suffit d'étendre
au rendu de `looseMass` en pré-visualisation) ou retirer la carte.

#### B11 — Le métier « L'Ascète » affiche « Frénésie undefined »

`addBuff` renvoie `0` quand l'Ascète bloque le bonus (`src/game.js:160`), et `collect` fait
ensuite `['I','II','III'][lvl - 1]` (`src/game.js:855`), soit l'index `-1`.

```
stats.ascete = true
toast affiche : "Frenesie undefined"
```

`src/ui.js:345` protège le même calcul par `|| 'I'`, pas `collect`. Correction : sortir tôt
si `lvl === 0` (aucun toast, aucun `hitstop`, aucun `SFX`), ce qui est de toute façon le
comportement attendu — aujourd'hui l'Ascète déclenche quand même l'arrêt sur image, le
`shake`, le son et le compteur `G.st.bonus`, pour un bonus qui ne s'applique pas.

#### B12 — La branche « bonus rare » de `collect` est morte

`src/game.js:852` teste `p.bonus.rar === 2`, mais aucun objet de `CONTENT.BONUS` ne porte de
champ `rar` :

```
champs d un BONUS : id,name,icon,color,dur,weight,desc,tiers,apply
BONUS avec un champ rar : 0 / 8
```

Le ralenti ne se déclenche donc que via `lvl >= 3`. Soit ajouter `rar` aux bonus, soit
supprimer la condition (le poids `weight` joue déjà le rôle de rareté).

### MINEUR

#### B13 — La Faille détruit la matière des masses en train de tomber

`liftMass` (`src/game.js:347-356`) vide les cellules d'une masse pour la faire tomber, en
mémorisant types et duretés. `updateFaille` s'exécute **avant** `updateFalls`
(`src/game.js:780-782`) et remplit toute cellule `EMPTY` des nouvelles rangées avec du
`HARD` (`src/game.js:446-453`). Les cellules d'une masse en vol sont vides à ce
moment-là : elles sont bouchées. À l'atterrissage, `landMass` fait
`if (world.type[i] !== W.T.EMPTY) return;` (`src/game.js:365`) et **abandonne
silencieusement le bloc**. Visuellement, des rochers qui tombent s'évaporent quand la Faille
les rattrape.

Correction : soit exclure les cellules des `G.falls` en vol du remplissage de la Faille,
soit, dans `landMass`, écraser la case au lieu de renoncer.

#### B14 — `G.fallSeen` fuit et stérilise des coordonnées

`checkCollapse` marque toutes les cellules d'une masse (`src/game.js:327`) et `landMass` ne
retire la marque que pour les cellules **effectivement reposées** (`src/game.js:371`, dans
le corps du `forEach`, après les deux `return` de garde). Chaque bloc perdu (B13, ou bloc
bloqué par la foreuse) laisse une coordonnée marquée à vie : plus aucun effondrement ne
pourra jamais y être détecté pour le reste du niveau. Le `Set` grossit aussi sans borne.
Correction : déplacer le `delete` avant les gardes, ou reconstruire `fallSeen` à partir des
`G.falls` actifs.

#### B15 — Aucune couverture de `levelToken` sur les chemins hors `update`

Le mécanisme de `levelToken` (`src/game.js:123`) est correct pour les trois chemins qu'il
couvre : `updateBombs` (`:278`), `updateFaille` (`:462`), `updateFalls` (`:416`) — tous les
appels à `damage()` susceptibles de déclencher `restartLevel()` sont bien suivis d'un test,
et les gardes de `update` (`:779, :781, :783`) rattrapent la sortie. J'ai vérifié
qu'aucun autre chemin d'`update` ne peut appeler `startLevel` : ni `DRILL.update` et ses
hooks, ni `onCellBroken`, ni `collect`, ni `craft`, ni `checkCollapse` n'appellent `damage`.

Le trou est ailleurs : **rien ne protège les chemins déclenchés depuis le DOM**.
`GAME.startLevel` est appelé directement par `main.js:165` (KeyN), `main.js:168` (KeyR),
`GAME.testJump` (`src/game.js:1015`) et `GAME.startTest`. Ces handlers s'exécutent entre
deux images, donc sans réentrance aujourd'hui — mais la garantie est accidentelle, pas
structurelle. Le jour où un de ces chemins passe par un `setTimeout` ou un `await`, le bug
revient sans que le jeton le signale. Voir la proposition `phase()` en section 3.

Deuxième faiblesse : `startLevel` appelle `computeStats()` (`src/game.js:100`) **avant** de
réinitialiser `G.buffs`, `G.reserve`, `G.souffle` et `G.event`, et n'utilise le résultat que
pour `pre.luck`, qui pilote le nombre d'objets générés (`src/world.js:228`). Aujourd'hui
aucun bonus ni événement ne touche `luck`, donc la génération reste reproductible — je l'ai
vérifié. Mais c'est une bombe à retardement : le premier bonus qui modifiera `luck` fera
qu'un même niveau relancé avec la même graine produira un monde différent.

#### B16 — Le mode test double la génération de monde

`startTest` (`src/game.js:1008-1013`) appelle `startRun`, qui appelle déjà `startLevel(0)`,
puis rappelle `startLevel(levelIndex)`. Deux mondes complets générés pour un seul lancement.
Passer l'index à `startRun`.

#### B17 — Couper le son avant la première note perd le réglage

`SFX.toggle` (`src/audio.js:48`) bascule `enabled` mais ne peut écrire dans `master.gain`
que si le contexte existe. Presser `M` en tout premier met `enabled = false`, puis le
premier `blip` appelle `init()` qui refixe `master.gain.value = 0.5`. Le son revient.
Correction : `master.gain.value = enabled ? 0.5 : 0;` dans `init()`.

#### B18 — `world.oreTotal` est faux et inutilisé

`vein()` et le bloc `filon` incrémentent `oreTotal` sans vérifier si la cellule était déjà
du minerai (`src/world.js:146` et `:174`), donc le compteur sur-compte les recouvrements.
Il n'est lu nulle part. Soit le corriger et l'utiliser pour valider les quotas de niveau
`gisement`, soit le supprimer.

Dans le même bloc, `vein()` appelle `setRock(ax, ay, T.ORE)` puis réécrit immédiatement
`world.type` et `world.hard` (`src/world.js:143-145`) : l'appel à `setRock` est du travail
jeté. Et le minerai posé par la variante `filon` (`src/world.js:173`) passe par `setRock`
seul, donc avec une dureté ×1 au lieu de ×1,1 — deux duretés différentes pour le même type
de bloc selon le générateur qui l'a posé.

#### B19 — Fenêtre plus large que le niveau : le monde est collé à gauche

`src/render.js:88` : `g.cam.x = Math.max(0, Math.min(world.w * T - vw, g.cam.x))`. Le monde
fait `LEVEL_W × TILE = 60 × 22 = 1320 px`. Sur tout écran plus large que 1320 px CSS — la
majorité des écrans de bureau — la borne haute devient négative et la caméra est clouée à 0.

```
vue 1920px, monde 1320px -> cam.x force a 0  (monde colle a gauche, 600px de vide a droite)
vue 2560px, monde 1320px -> cam.x force a 0  (monde colle a gauche, 1240px de vide a droite)
```

Correction : `g.cam.x = world.w * T <= vw ? (world.w * T - vw) / 2 : Math.max(0, Math.min(world.w * T - vw, g.cam.x));`

#### B20 — Canvas très petit : la jauge latérale dessine à l'envers

`drawSideGauge` (`src/render.js:527`) calcule `h = vh - 210`. En dessous de 210 px de
hauteur, `h` est négatif et `fillRect(x, top, 10, h)` remonte au-dessus de `top`, tout comme
`rowToY` qui renvoie des valeurs hors jauge. Borner : `var h = Math.max(40, vh - 210);`
Idem pour la position `top = 96`, qui suppose une hauteur de HUD fixe.

---

## 2. Performance

Mesures faites sous node avec un contexte 2D factice (toutes les méthodes sont des no-op) :
on ne mesure donc que le **travail JavaScript**, pas la rastérisation. Viewport 1920×1080,
`dpr = 1`, niveau 1-1 partiellement creusé (605 gravats, 40 objets enfouis).

```
RENDER.draw (JS pur, 1920x1080, dpr 1) : 0.55 - 0.66 ms/frame
  par frame -> fillRect: 5773   fillStyle=: 5245   gradients: 152   beginPath: 3
GAME.update                            : 0.013 - 0.027 ms/frame
allocation rendu  : ~2.2 Ko/frame  (~0.1 Mo/s a 60 fps)
allocation update : ~0.64 Ko/frame
```

### P1 — La pression GC n'est pas le problème ; le nombre d'appels canvas l'est

Contrairement à ce qu'on pourrait craindre, les allocations par image sont modestes
(≈ 2,2 Ko de rendu + 0,6 Ko de logique, soit ~0,17 Mo/s) : pas de quoi provoquer une pause
GC visible. `GAME.update` à 0,02 ms/image est négligeable, et le budget de 16,6 ms est loin
d'être consommé côté JS.

Le vrai coût est celui que mon banc d'essai ne peut pas mesurer : **5 245 affectations de
`ctx.fillStyle` par image**, soit ~315 000 analyses de chaîne CSS par seconde. Chaque
`'rgb(112,81,51)'` doit être re-parsé par le moteur de rendu. C'est le poste dominant d'un
jeu de tuiles écrit ainsi, et c'est là qu'il faut travailler.

### P2 — `shade()` est appelée une fois par tuile visible

`src/render.js:10-16` fait un `hex.slice(1)` (allocation), un `parseInt`, trois `Math.min` /
`Math.max` et une concaténation de cinq morceaux — pour chacune des ~4 400 tuiles à l'écran
(en pratique bornée à 60 colonnes par la largeur du monde, mais le principe reste).

```
shade() direct  : 0.490 ms/frame (4400 tuiles)
table 13x32     : 0.088 ms/frame  -> x5.5
```

C'est ~40 % du temps JS de `draw`, pour un résultat qui ne prend que quelques centaines de
valeurs distinctes. Correction : construire une table une fois par niveau, indexée par
(type de bloc, palier de luminosité), et quantifier `v` sur 32 paliers.

```js
// une fois par niveau, dans draw() quand layer change
var LUT = [];                                  // LUT[type][palier]
for (var t = 0; t < 14; t++) {
  LUT[t] = [];
  for (var s = 0; s < 32; s++) LUT[t][s] = shade(TYPE_COLOR[t] || layer.med, (s + 0.5) / 32 * 1.3);
}
// dans la boucle de tuiles
ctx.fillStyle = LUT[t][(v / 1.3 * 32) | 0];
```

Bénéfice secondaire, plus important que le gain CPU mesuré : les chaînes sont **identiques
par référence** d'une tuile à l'autre, ce qui permet au moteur de mettre en cache la couleur
analysée. Ajouter un `if (fs !== lastFs) ctx.fillStyle = fs;` fait tomber les affectations de
~5 245 à quelques centaines, puisque des tuiles voisines partagent type et palier.

### P3 — Un dégradé radial créé par tuile de minerai visible

`src/render.js:151-155` appelle `ctx.createRadialGradient` pour **chaque** tuile `ORE` à
l'écran, à chaque image. Idem `src/render.js:240` pour chaque objet enfoui visible. Le banc
compte 152 gradients par image. La création d'un dégradé est une des opérations les plus
chères de l'API canvas 2D : elle alloue un objet côté moteur et invalide le cache de motif.

Correction : pré-rendre une fois par niveau un halo de minerai sur un `OffscreenCanvas` (ou
un `<canvas>` détaché) de `TILE * 1.6` de côté, puis `ctx.drawImage(halo, px - T*0.3, py - T*0.3)`.
Même traitement pour le halo des objets, en trois variantes de couleur. On passe de
152 dégradés/image à zéro.

### P4 — `world.debris` est parcouru intégralement à chaque image et ne se vide jamais

`src/render.js:184` fait `world.debris.forEach` sur l'ensemble du niveau, puis rejette
hors-champ. Le `Set` grossit d'une entrée par bloc cassé avec 55 % de chance
(`src/game.js:551-553`) et n'est jamais purgé — ni quand la Faille reboucle la case
(`src/game.js:450`), ni à la chute d'une masse. Sur un niveau bien creusé cela monte à
plusieurs milliers d'entrées parcourues 60 fois par seconde pour n'en dessiner qu'une
poignée.

Correction : stocker le gravat comme un bit dans un `Uint8Array` parallèle à `world.type`,
et le lire **dans la boucle de tuiles existante**, qui itère déjà exactement la fenêtre
visible. Coût d'itération : zéro. La purge devient un simple `debris[i] = 0` dans `setRock`.

### P5 — Allocations par image, par ordre d'importance

Aucune n'est critique au vu des mesures, mais elles sont toutes évitables :

- `CORE.DRILL.targets()` alloue un tableau de tableaux à chaque image dans `drill.js:91` et
  **une seconde fois** dans `render.js:254` pour dessiner la surbrillance. Jusqu'à
  48 sous-tableaux × 2. Réutiliser un tampon plat `Int16Array` de taille fixe (`6*4*2*2`)
  et le repasser au rendu via `G` plutôt que de recalculer.
- `computeStats()` (`src/game.js:32`) alloue un objet et parcourt 7 pièces + ~35 passifs à
  chaque image (`src/game.js:682`). Les pièces et passifs ne changent qu'à la station :
  calculer une base une fois par niveau, et n'appliquer par image que ce qui varie (buffs,
  événement, souffle, réserve).
- Les chaînes `'rgba(255,240,215,' + (0.05 + 0.22 * lit) + ')'` des quatre faces
  (`src/render.js:134-147`) : deux d'entre elles sont des constantes
  (`rgba(0,0,0,0.34)`, `rgba(0,0,0,0.16)`) — les sortir de la boucle — et la première se
  quantifie sur 16 paliers.
- `makeLight` (`src/render.js:27`) alloue une fermeture par image et fait un `Math.sqrt` par
  tuile. Le `sqrt` peut disparaître : comparer les carrés pour le test `dist > vis * 2.1`,
  et n'extraire la racine que pour les tuiles qui passent.
- `updateHud` (`src/ui.js:303`) fait ~35 `document.getElementById` et 5 réécritures
  d'`innerHTML` toutes les 60 ms. Mettre les nœuds en cache dans un objet au premier appel,
  et ne réécrire `#buffs` / `#challenges` que quand leur contenu change réellement (comparer
  une chaîne de signature).

### P6 — Ce qui n'est PAS un problème, contrairement à ce qu'on pourrait croire

Le système d'effondrement est bon marché, y compris dans le pire cas mesuré (bombe abyssale,
rayon 9, 23 colonnes analysées dans la même image) :

```
scan rayon 3 (11 colonnes) : 0.002 ms
scan rayon 9 (23 colonnes) : 0.003 ms
looseMass seul             : 0.0001 ms
```

Le `queue.shift()` en O(n²) de `looseMass` (`src/world.js:338`) est sans conséquence grâce
au plafond `CFG.FALL.maxMass = 150`. Ne pas l'optimiser : ce serait du temps perdu.

---

## 3. Structure et dette

### S1 — Découpage concret de `game.js` (1 045 lignes)

`game.js` cumule aujourd'hui : l'état global, le calcul de statistiques, le cycle de vie
des runs et niveaux, l'économie de carburant, la destruction de blocs et les chaînes,
les explosifs, les effondrements, la Faille, les événements, la boucle d'update, le
ramassage, les particules, la fin de niveau, la boutique et le mode test.

Le découpage ci-dessous respecte le chargement par `<script src>` en cascade et
`window.CORE` : aucun module ne se réécrit, on déplace des fonctions déjà existantes. Ordre
à insérer dans `index.html` entre `world.js` et `game.js`.

| Fichier | Contenu déplacé | ~lignes | Dépend de |
|---|---|---|---|
| `src/state.js` | le littéral `G` (`:8-29`) + `reset*()` extraits de `startLevel` | 70 | rien |
| `src/stats.js` | `computeStats` (`:32-78`), `tier` (`:95`) | 60 | config, content |
| `src/fx.js` | `toast`, `flash`, `burst`, `spawnPickup`, `addTurbo`, `damage` (`:153-201`, `:284-294`, `:309-311`) | 90 | state, audio |
| `src/fuel.js` | `burn`, `refuel`, `rescueCan`, `dryRestart`, `dryBuy` (`:479-522`, `:964-980`) | 80 | state, fx, world |
| `src/dig.js` | `destroyAt`, `onCellBroken`, `blast`, `bumpCombo`, `craft`, `placeCharge`, `updateBombs` (`:206-281`, `:525-629`) | 220 | state, fx, fuel, world |
| `src/hazard.js` | `checkCollapse`, `massCanOccupy`, `liftMass`, `landMass`, `updateFalls`, `updateFaille` (`:316-476`) | 190 | state, fx, dig |
| `src/level.js` | `startRun`, `startLevel`, `restartLevel`, `finishLevel`, `nextLevel`, `medalFor`, `chooseCard`, `buyPart`, `buyFuel`, `shopOpen`, mode test | 260 | tout ce qui précède |
| `src/game.js` | ne garde que `update()` et `collect()`, plus la ré-exportation de `CORE.GAME` pour ne rien casser côté `ui.js` / `main.js` | 200 | tout |

Deux frontières comptent plus que le reste :

1. **`level.js` est le seul module autorisé à appeler `startLevel`.** Tout le reste signale
   « le niveau a changé » et laisse la boucle décider. Cela remplace les six tests
   `if (G.levelToken !== tok) return;` disséminés par un seul point de contrôle :

   ```js
   // src/game.js
   function phase(fn, dt) {                  // false => le niveau a ete remplace
     var tok = G.levelToken;
     fn(dt);
     return G.levelToken === tok;
   }
   // dans update()
   if (!phase(HAZARD.checkCollapse, dt)) return;
   if (!phase(DIG.updateBombs, dt)) return;
   if (!phase(HAZARD.updateFaille, dt)) return;
   if (!phase(HAZARD.updateFalls, dt)) return;
   ```

   Aujourd'hui, ajouter une phase qui peut infliger des dégâts oblige à se souvenir d'écrire
   le test à la main : c'est exactement le genre d'oubli que B15 décrit.

2. **`stats.js` ne doit lire que `G.run`, `G.buffs` et un contexte explicite**, pas
   `G.world` ni `G.drill` (voir `src/game.js:59`, `s.daredevil && G.world.failleRow > G.drill.y - 15`).
   Passer `{ failleNear: bool, souffle: bool, reserve: bool }` en argument rend
   `computeStats` pur et testable, et permet la mise en cache décrite en P5.

Ce que je ne recommande **pas** : introduire des modules ES, un bundler, ou remplacer
`window.CORE` par de l'injection de dépendances. Le projet tire une grande partie de sa
simplicité de son absence de build ; `build.js` fait 27 lignes et fonctionne.

### S2 — Duplications réelles

- **La règle « durée d'un bonus à paliers »** est écrite trois fois, à l'identique :
  `src/game.js:167`, `src/game.js:172`, `src/ui.js:343`.
  `def.tiers && (def.freeze || def.noBurn) ? def.tiers[level - 1] : def.dur`.
  Trois occurrences d'une règle subtile qui dérivera. Extraire `CONTENT.buffDur(def, level)`.
- **Le test « ce bonus est-il un malus »** est écrit trois fois avec trois formes
  différentes : `src/game.js:160` (`!def.stun && !def.leak && def.id.charAt(0) !== 'M'`),
  `src/game.js:173` (`!!def.stun || !!def.leak || def.id.charAt(0) === 'M'`),
  `src/game.js:842` (idem sur `p.bonus`). Ajouter un champ `malus: true` dans
  `CONTENT.MALUS` et tester `def.malus`.
- **La boîte englobante de la foreuse** est réécrite quatre fois :
  `src/game.js:341-342`, `src/game.js:367-368` (avec les mêmes marges 0,95 / 0,05),
  `src/game.js:444-445` (avec d'autres marges), `src/game.js:466-467`.
  Extraire `DRILL.covers(d, x, y, margin)`.
- **Le calcul du nombre de coups** est dupliqué entre logique et rendu :
  `src/drill.js:185` et `src/render.js:255`. Le rendu ignore `d.crit`, donc la barre de
  progression est fausse pendant un coup critique. Exposer `DRILL.hitsFor(hard, force, crit)`.

### S3 — Code mort

- `drawForeground` (`src/render.js:506-522`) n'est appelé nulle part, et les données qu'il
  consomme, `world.fore` (`src/world.js:309-312`), sont générées à chaque niveau pour rien.
- `SFX.bonus` (`src/audio.js:57`) et `SFX.faille` (`src/audio.js:115`) : jamais appelés.
- `G.comboBest` (`src/game.js:628`) : écrit, jamais lu.
- `world.oreTotal` (voir B18), `world.ceilingRow` (voir B7), `s.seismo` (B10),
  `s.turboCd` (B9), `s.perpetual` (le flag est inerte, seul `apply` agit),
  `s.secondSouffle` (le flag est inerte, `src/game.js:756` teste `G.run.passives['V-04']`
  en dur).
- `rollBonus(rng, allowMalus)` : le second paramètre vaut `false` sur les deux seuls sites
  d'appel (`src/world.js:229`, `src/game.js:582`). La branche `BONUS.concat(MALUS)` est
  morte.
- `src/game.js:82` puis `:91` : `G.meta = { runs: 1, … }` immédiatement suivi de
  `G.meta.runs = 0`.
- `src/ui.js:29` : un `if` dont le corps est vide, avec un commentaire.

### S4 — Constantes en dur qui devraient être dans `config.js`

`config.js` fait un travail sérieux, mais `game.js` conserve des valeurs de gameplay :

| Valeur | Emplacement | Ce que c'est |
|---|---|---|
| `320` | `game.js:193` | plafond de particules |
| `{ n: 300 }`, `{ n: 60 }`, `{ n: 80 }`, `{ n: 8 }`, `{ n: 6 }` | `game.js:247, 588, 743, 726, 469` | budgets de propagation des chaînes, cinq valeurs sans nom |
| `3` (dégâts), `1.5` (mult combo max), `5` (blocs par palier de combo), `0.15` | `game.js:627` | courbe de combo |
| `60` | `game.js:124, 742` | intervalle du passif « Noyau instable » |
| `-26`, `18`, `26`, `8` | `game.js:644-647` | géométrie des événements |
| `0.55` | `game.js:551` | probabilité de gravat |
| `22`, `5`, `12`, `250` | `game.js:514-515, 513` | fenêtre du bidon de secours |
| `4000` | `game.js:792` | taille max de l'enregistrement fantôme |
| `1.5 + s.turboDur` | `drill.js:82` | rechargement du turbo (voir B9) |
| `7919`, `5711`, `131` | `game.js:102, 136, 928` | décalages de graines, à regrouper dans `CFG.SEED` |

Aucune n'est urgente ; la ligne de partage utile est : **tout ce qu'un équilibrage voudra
toucher va dans `config.js`**, ce qui inclut au minimum le plafond de particules, les
budgets de chaîne et la courbe de combo.

### S5 — Incohérences de nommage

Le code mélange trois conventions et deux langues, parfois dans la même structure :

- `CFG.RECIPES` a des champs français (`nom`, `cout`, `rayon`, `poussee`, `effondre`,
  `desc`) tandis que `CFG.LEVELS` a des champs anglais (`name`, `height`, `top`) plus un
  français (`faille`). `CFG.INGREDIENTS` mélange `nom` et `icon`/`color`/`poids`/`couche`.
- Les objets de bonus utilisent `name`, les recettes `nom`, les déblocages `nom` :
  `src/ui.js` doit donc savoir lequel employer selon la collection.
- `G.st` (statistiques de défi) contre `G.stats` (statistiques de foreuse) contre
  `G.meta` (compteurs de carnet) : trois noms très proches pour trois choses sans rapport.
  Renommer en `G.challengeStats`, `G.drillStats`, `G.carnetDelta`.
- `world.top` (rangée du ciel) contre `def.top` (profondeur en mètres) : deux unités
  différentes sous le même nom, utilisées côte à côte dans `depthAt`.
- `src/render.js` déclare `var gi` deux fois dans `draw` (`:296` et `:320`) et `var gx`/`gy`
  trois fois : légal en `var`, mais un `'use strict'` avec `let` refuserait. La fonction
  `draw` fait 405 lignes et devrait être découpée en `drawTiles` / `drawEntities` /
  `drawOverlays` — c'est le premier refactor à faire dans `render.js`, avant toute
  optimisation.

### S6 — Déterminisme : la graine ne garantit pas ce qu'elle promet

Le déblocage `graine` propose un « Mode : Graine du jour — tout le monde creuse la même
planète » (`src/config.js:246`). Ce n'est pas atteignable en l'état :

- `d.crit = Math.random() < s.crit` (`src/drill.js:184`) : les coups critiques ne sont pas
  seedés.
- `burst()` (`src/game.js:196-198`), `rescueCan()` (`src/game.js:514-515`) et la pose de
  gravats (`src/game.js:551`) utilisent `Math.random()`, et `rescueCan` **modifie le monde**.
- `fireEvent` (`src/game.js:635`) et le contenu des coffres (`src/game.js:582`) consomment
  `world.rng`, c'est-à-dire le générateur de *génération* : son état diverge selon ce que le
  joueur casse, donc deux parties sur la même graine ne tirent pas les mêmes événements.

Correction : un second générateur `G.rng` seedé par niveau, réservé au gameplay, et
laisser `world.rng` figé après la génération. Le purement cosmétique (particules) peut
rester sur `Math.random()`.

---

## 4. Tests

Il n'y a aucun test automatisé. Le simulateur headless existant est bon mais ne vérifie
rien : il imprime. Stratégie minimale, sans aucune dépendance (`node:test` est intégré
depuis Node 18), en réutilisant le harnais `boot.js` du haut de ce document.

Arborescence proposée :

```
test/
  boot.js          le harnais ci-dessus
  gen.test.js      generation
  pure.test.js     fonctions pures
  physics.test.js  collision (fuzz)
  run.test.js      partie complete
  save.test.js     robustesse de la sauvegarde
```

`package.json` minimal : `{ "scripts": { "test": "node --test test/" } }`.

### T1 — Génération, par propriétés (le meilleur rapport effort/rendement)

`W.generate` est pur et seedé : 14 niveaux × 200 graines s'exécutent en quelques secondes.
Invariants à affirmer :

- ne lève jamais d'exception (déjà vérifié : 2 800 cas OK) ;
- `world.startX` dans `[1, w - DRILL_W - 1]` et `world.at(startX, 1) === EMPTY` ;
- la sortie est atteignable : flood fill depuis le départ à travers tout ce qui n'est ni
  `BEDROCK` ni `LOCK`, doit toucher `exitRow` — **c'est le test qui protège le dédale**,
  dont les trois passages par mur sont tirés au hasard ;
- pour un niveau `gisement` : `oreTotal >= def.quota * 2` (une fois B18 corrigé) ;
- pour un niveau `starter` : les trois ingrédients de la dynamite sont présents dans
  `world.items` ;
- pour un niveau `sceau` : la bande de sceau est continue sur toute la largeur ;
- déterminisme : `generate(def, layer, 42, 1)` deux fois de suite donne des `type` et `hard`
  identiques octet à octet.

Cas de test à figer en premier, parce qu'ils décrivent les contraintes tacites du
générateur : un niveau de `height` inférieur à ~25 casse `rng.int(top + 14, top + height - 10)`
(borne inversée). Aujourd'hui aucun niveau n'est aussi court ; un test le documente.

### T2 — Fonctions pures

Rapides à écrire, elles verrouillent le contrat de `config.js` et `content.js` :

- `DRILL.targets` — **le test qui attrape B5** :
  ```js
  for (const [fx, fy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]])
    for (const [w, l] of [[2,1],[4,2],[6,4]])
      assert.equal(DRILL.targets({x:10,y:10}, fx, fy, w, l).length, w * l);
  ```
- `computeStats` : bornes respectées (`width` dans 1..6, `length` dans 1..4, `crit ≤ 0.6`),
  et un passif appliqué `n` fois donne bien `pow(base, n)` ;
- `CONTENT.draw` : ne renvoie jamais plus de `count` cartes, jamais deux fois la même,
  jamais un passif déjà au max ;
- `medalFor`, `partCost`, `CFG.layerAt`, `CFG.hardnessAt` : tables de valeurs attendues ;
- chaque `CHALLENGES[i].check` sur un état limite (`st.up === 0`, `st.bigFall === 30`).

### T3 — Fuzz de collision (la catégorie qui aurait attrapé B3 et B4)

C'est le test à écrire en priorité, parce que les deux bugs les plus graves y vivent :

```js
test('la foreuse ne traverse jamais un mur et ne finit jamais encastree', () => {
  const rng = makeRng(1);
  for (let k = 0; k < 2000; k++) {
    const w = mondeAvecMurs(rng);                 // salle vide + murs de socle 1 et 2 blocs
    const d = DRILL.create(w); d.x = 15; d.y = 22;
    const s = statsAleatoires(rng);               // roll/climb jusqu'aux valeurs max reelles
    for (let f = 0; f < 40; f++) {
      const dt = 1/240 + rng.f() * (0.05 - 1/240);
      const cote = Math.sign(d.x - 25);
      DRILL.update(d, w, entreeAleatoire(rng), s, dt, {});
      assert.ok(!DRILL.overlapsSolid(w, d.x, d.y), 'encastree');
      assert.equal(Math.sign(d.x - 25), cote, 'mur traverse');
    }
  }
});
```

Faire varier `dt` sur toute la plage autorisée est essentiel : les deux bugs n'apparaissent
qu'aux grands pas, et un test à `dt = 1/60` fixe ne les verrait pas.

### T4 — Partie complète, avec assertions

Transformer `sim.js` en test. Le bot par pathfinding existe déjà ; il suffit d'ajouter les
affirmations, à chaque image :

- aucune valeur non finie : `drill.x`, `drill.y`, `drill.vx`, `drill.vy`, `G.fuel`,
  `G.levelTime`, `G.run.gold` ;
- `G.fuel` dans `[0, G.fuelMax]`, `G.hp` dans `[0, maxHp]` ;
- la foreuse reste dans les bornes du monde ;
- conservation de la matière : le nombre de cellules solides ne peut augmenter que par la
  Faille ou l'atterrissage d'une masse — **c'est le test qui attrape B13** ;
- pas de blocage : chaque niveau se termine en moins de N images.

Et en fin de partie, ce qui attrape B1 sans avoir besoin du DOM :

```js
for (const job of CONTENT.JOBS) {
  jouerUnePartieComplete(job);
  assert.equal(G.run.splits.length, CFG.LEVELS.length - (job.skip || 0));
  G.run.splits.forEach(t => assert.ok(Number.isFinite(t)));
}
```

Boucler sur **tous** les métiers, y compris ceux qui sont verrouillés par défaut : c'est
précisément parce que `MT-7` est verrouillé qu'il n'a jamais été joué et que B1 est passé.

### T5 — Robustesse de la sauvegarde (attrape B2)

Table de valeurs hostiles, chaque méthode publique de `SAVE` doit renvoyer sans lever :

```js
const poisons = [null, '', 'null', '5', '"x"', '[]', '{}', '{"levels":null}',
                 '{"total":3}', '{invalide', '{"levels":{"1-1":{"time":"abc"}}}'];
for (const p of poisons)
  for (const clef of ['core.records.v2', 'core.ghosts.v2', 'core.carnet.v1']) {
    store[clef] = p;
    assert.doesNotThrow(() => {
      SAVE.all(); SAVE.best('1-1'); SAVE.bestTotal(); SAVE.ghost('1-1');
      SAVE.carnet(); SAVE.proches(3); SAVE.record('1-1', 12, 'or'); SAVE.addStats({ ore: 1 });
    }, `${clef} = ${p}`);
  }
```

Ajouter le cas « `localStorage` inaccessible » : remplacer le stub par un objet dont les
accesseurs lèvent (navigation privée Safari, iframe tierce). Le `try/catch` actuel couvre ce
cas, mais rien ne l'empêche de régresser.

### T6 — Garde-fou de build

Une ligne en CI, qui empêche `core.html` de diverger de `src/` :

```
node build.js && git diff --exit-code core.html
```

---

## Les cinq corrections prioritaires

| # | Correction | Pourquoi d'abord | Effort |
|---|---|---|---|
| 1 | **B2** — normaliser `load()` dans `save.js` et vérifier la forme des objets chargés | Une sauvegarde corrompue rend le jeu injouable **définitivement**, sans recours pour le joueur. Sept lignes. | ~30 min, plus T5 |
| 2 | **B1** — indexer `splits` / `medals` sur le niveau réellement joué dans `buildEnd` | Écran de fin planté pour tout métier avec `skip`, donc partie entière perdue. | ~30 min, plus le test de T4 sur tous les métiers |
| 3 | **B3 + B4** — sous-pas de collision dans `DRILL.update` et recalage par recul | Traversée du socle et des murs du dédale dès qu'un joueur monte ses chenilles, ou à la moindre chute d'images. Casse les variantes `dedale` et `sceau`. | ~2 h avec le fuzz T3 |
| 4 | **P2 + P3 + P4** — table de couleurs quantifiées, halos pré-rendus, gravats dans un `Uint8Array` | Divise par un ordre de grandeur le nombre d'affectations de `fillStyle` et supprime 152 dégradés par image, c'est-à-dire le seul poste de rendu réellement coûteux. | ~3 h |
| 5 | **B5, B7, B8, B9, B10, B11, B12** — le lot « ça ne fait rien / ça fait deux fois » | Sept règles annoncées au joueur qui ne s'appliquent pas, ou s'appliquent en double. Chacune est une correction de moins de dix lignes ; ensemble, elles rendent au jeu une carte, deux événements, un métier et l'équilibre du carburant. | ~3 h pour l'ensemble |

Au-delà : le découpage S1 (une demi-journée, mécanique, sans réécriture) et le socle de
tests T1 à T5 (une journée) — dans cet ordre, parce que le découpage rend `computeStats`,
`targets` et la génération testables sans DOM.
