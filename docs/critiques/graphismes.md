# CORE — critique visuelle et sensorielle

Direction artistique / game feel. Rédigé après avoir joué les 3 couches via le MODE TEST
(Playwright, 1280×800), captures dans `docs/critiques/captures/`.

Périmètre : rendu, lisibilité, HUD, animation, son, écrans. Rien sur l'équilibrage.

---

## Verdict en une phrase

Le jeu est **propre mais muet**. La grille de 22 px est honnête, la palette par couche
est juste sur le papier, mais rien ne se détache : la foreuse disparaît dans la roche,
le minerai disparaît dans le noir, un piège ressemble à un bidon de carburant, une bombe
de rayon 9 fait moins de bruit visuel qu'un ramassage de bonus, et la roche de la couche 3
est un carrelage de salle de bain. Creuser ne procure aucune sensation parce que **casser
un bloc ne déclenche strictement rien** (`src/game.js:571-573` : 3 particules, aucune
secousse, aucun arrêt sur image).

---

# 1. CE QUI GÊNE LA LECTURE DU JEU

Classé du plus visible au plus fin. Ce sont des bugs de lisibilité, pas des goûts.

---

### 1.1 — La foreuse est invisible. C'est le problème n°1.

**Le problème.** L'avatar fait 44×44 px sur 1 280×800, soit **0,19 % de l'écran**, il est
gris moyen (`#6b7684` / `#8e9bab`, `src/render.js:701-704`) et son contour noir `#0e1013`
fait **1,5 px effectif** (`render.js:700` : `fillRect(-T*1.02, …)` sur un corps de `T*0.95`).
Sur roche brune éclairée par le phare, la valeur du corps et la valeur de la roche sont
identiques. On perd son propre personnage des yeux en permanence.

**La preuve.** `captures/03-couche1-terre.png` : cherchez la foreuse. Elle est à
(307, 380), noyée. `captures/10-foreuse-zoom.png` (zoom ×1, crop 260×200) : le triangle
blanc de la tête et le surlignage blanc des cases en cours de forage
(`render.js:262-265`, `rgba(255,255,255,0.10→0.45)`) **fusionnent en une tache blanche
illisible** — on ne sait plus où finit la machine et où commence la roche.

**La correction.**
- Contour extérieur **noir pur `#000000`, 3 px**, dessiné en `strokeRect` après le corps,
  jamais assombri par l'éclairage (la foreuse doit être exclue de `lightAt`).
- Corps beaucoup plus chaud et plus clair que toute roche du jeu :
  `#e8b04a` (carrosserie) / `#a8722a` (ombre) / `#3a2a18` (châssis). Aucune couche n'a
  cette saturation → la foreuse devient la seule chose orange saturée à l'écran.
- Surlignage de forage : passer de blanc à **`rgba(255,196,80,α)`** avec α `0.08 → 0.30`,
  pour ne plus concurrencer la tête blanche.
- Halo de contact : cercle `rgba(255,220,150,0.10)` de rayon `T*2.4` **derrière** la
  foreuse, déjà présent (`render.js:651-655`) mais à 0,22 d'alpha sur `T*3` — trop diffus.
  Réduire à `T*1.8` et monter à 0,32 pour qu'il fasse office de détourage.

Coût : ~20 lignes dans `drawDrill`. Impact : maximal.

---

### 1.2 — Un piège vert et un bidon de carburant sont exactement la même chose

**Le problème.** Les 5 familles d'objets enfouis (BONUS, PEPITE, TEMPS, CARBURANT,
INGREDIENT) sont **toutes** rendues par le même primitif : un carré de 6 px + un halo
radial pulsant (`render.js:228-249`). Seule la teinte change. Or un malus de
`src/content.js` porte la couleur **`#8ac46a`** — la couleur **exacte** du bidon de
carburant (`render.js:233`). Le joueur fonce sur un piège en croyant faire le plein.

**La preuve.** `captures/03-couche1-terre.png` : 5 pastilles cyan et 1 verte, aucune
n'indique ce qu'elle est. `captures/08-explosion.png` : pastilles verte, bleue, rose,
cyan, jaune, toutes identiques en forme et en taille.

**La correction.** Forme avant couleur. Une silhouette par famille, 12 px, toujours la
même quel que soit le contenu :
| famille | forme | couleur |
|---|---|---|
| CARBURANT | **bidon** : rect 10×12 + goulot 4×3 | `#8ac46a` |
| PEPITE | **losange** 12×12 | `#ffd24a` |
| TEMPS | **sablier** : 2 triangles opposés | `#5ff0e0` |
| INGREDIENT | **cercle** 10 px + glyphe `ing.icon` | `ing.color` |
| BONUS | **hexagone** 12 px | `bonus.color` |
| MALUS | **hexagone + croix noire 2 px par-dessus**, halo `#ff4d5e` imposé | `#ff4d5e` |

Le malus ne doit **jamais** hériter de `bonus.color`. Forcer `#ff4d5e` + croix.
Coût : ~40 lignes. Impact : élimine la seule vraie injustice du jeu.

---

### 1.3 — Le minerai de la couche 1 est invisible (et celui de la couche 3 se confond avec le cristal)

**Le problème.** Chaque tuile est multipliée par `(0.28 + 0.95 * lit)` (`render.js:127`)
avec un plancher d'éclairage de 0,25 en couche 1. Le cuivre `#d68b3f` × 0,52 donne
`#6f4820` — soit **très exactement** la couleur de la roche `med` `#6f5133` en pleine
lumière. Le minerai hors du faisceau est littéralement de la roche.

En couche 3 c'est l'inverse : l'argent `#c8e6ff` (quasi blanc) et le losange blanc du
CRISTAL (`render.js:160-164`, `rgba(255,255,255,0.25→0.50)`) sont indiscernables.

**La preuve.** `captures/03-couche1-terre.png` : je ne vois **aucun** bloc de cuivre alors
que la couche en contient 8 veines. `captures/16-damier-couche3.png` : les losanges blancs
sont partout — un vrai bloc d'argent ne se remarquerait pas.

**La correction.**
- Le minerai est le seul type de bloc **exempté du plancher d'obscurité** : dans la boucle,
  `if (t === W.T.ORE) lit = Math.max(lit, 0.62)`. Un filon doit briller dans le noir,
  c'est tout l'intérêt d'un filon.
- Cuivre : `#d68b3f` → **`#ff9a2e`** (plus saturé, aucune roche brune ne l'approche).
- Argent : `#c8e6ff` → **`#7fe8ff`** (cyan franc), pour sortir du blanc du cristal.
- Ajouter un liseré 1 px `rgba(0,0,0,0.55)` sur les 4 côtés de chaque tuile ORE : ça
  découpe le filon de la roche même à faible luminosité.

---

### 1.4 — Le HUD est posé à même la roche, sans fond, en gris 10 px

**Le problème.** `#bars` (`index.html:36`) est en `font-size:10px; color:var(--dim)`
(`#8b93a1`) sans fond, sans ombre portée. Sur roche claire ou sur cristal violet, le
carburant — l'information la plus critique du jeu — devient illisible.

**La preuve.** `captures/15-hud-coin.png` (crop 420×200) : « CARBURANT 120 / 120 L » sur
du cristal ; le **L final est mangé par un bloc**. `captures/05-couche3-cristal.png` :
les trois barres passent sur des blocs violets clairs.

**La correction.**
- Un panneau derrière : `#bars{background:rgba(8,9,12,.82); border:1px solid #2a2f39;
  border-radius:6px; padding:10px 12px; backdrop-filter:blur(3px); width:236px}`.
- Libellés : `11px`, `#c3cad6`, `letter-spacing:1.5px`.
- Valeurs : **`16px`, `700`, `#e8eaee`, `font-variant-numeric:tabular-nums`** — le nombre
  de litres est ce qu'on cherche des yeux, il doit être le plus gros du bloc.
- Barre carburant : hauteur `11px` → **`14px`**, `border-radius:2px`.

---

### 1.5 — On ne distingue pas le sol du vide

**Le problème.** Une case vide est du noir de fond (`#12151a`) et rien d'autre : pas de
mur de fond, pas de paroi arrière, pas d'ombre de contact. Une galerie creusée est un
rectangle noir à bords parfaitement droits. Une grande caverne naturelle et un trou de
bombe se ressemblent, et les deux ressemblent au bedrock.

**La preuve.** `captures/03-couche1-terre.png` : la grande zone noire au centre (400×300 px)
est un vide, mais rien ne le dit. `captures/09-explosion-cratere.png` : le cratère est un
rectangle arrondi noir, sans suie, sans bord brûlé.

**La correction.** Un **mur du fond** dessiné avant les blocs, sur toute case `EMPTY` :
`fillStyle = shade(layer.med, 0.18 + 0.10 * lightAt(x,y))` + une bande supérieure
`rgba(0,0,0,0.45)` de 6 px sous chaque plafond (ombre portée du surplomb). Ça donne
instantanément l'impression que le vide a été **creusé dans la matière**, pas effacé.
C'est ~12 lignes dans la boucle de tuiles et ça change tout le jeu.

---

### 1.6 — La Faille est un filtre Photoshop, pas une menace

**Le problème.** `render.js:277-291` : un dégradé rouge translucide sur 6 tuiles de haut
+ une ligne de 3 px + 26 pixels de 3 px qui défilent. **La roche reste parfaitement
visible sous le voile** — donc la Faille ne semble rien détruire. Et l'alerte de proximité
(`render.js:414-420`) teinte tout l'écran en rouge, HUD compris, ce qui **dégrade la
lisibilité au moment où on en a le plus besoin**.

**La preuve.** `captures/07b-faille-alerte.png` : la Faille est à **1,5 bloc** de la
foreuse. Zéro tension. On voit encore le filon jaune, les pastilles, la roche. Le voile
rouge recouvre aussi « CARBURANT » et les défis en haut à gauche.

**La correction.**
- Au-dessus de `failleRow`, ne pas teinter : **remplir en opaque** `#1a0d0b` avec un bruit
  de gravats (2 000 px de 2-3 px en `#4a2a1e`/`#6b3a28`, décalés de `time*90` px/s).
  Ce qui est passé n'existe plus. C'est la définition d'un mur qui avale.
- Bord d'attaque : **liseré `#ff6a3d` de 4 px** + 6 px de dégradé `#ff2a1a → transparent`
  vers le bas, et **20 particules/s** qui tombent depuis la ligne.
- Alerte : remplacer le voile plein écran par un **vignettage** — dégradé radial des bords
  vers le centre, transparent au centre sur 55 % du rayon. Le centre de l'écran reste net.
- Ajouter une **secousse continue** `G.shake = max(G.shake, 4 + 8 * near)` tant que
  `fdist < 14`. Aujourd'hui la Faille arrive dans un silence visuel total.

---

### 1.7 — Le charbon fait une grille de boutons

**Le problème.** `render.js:165-167` : chaque tuile CHARBON reçoit un carré orange de
`T-12 = 10 px` **au centre exact**. Sur un amas de 30 blocs, ça produit une grille
régulière de points orange, parfaitement alignée. Ce n'est pas de la roche, c'est un
clavier.

**La preuve.** `captures/06-effondrement.png` — la moitié de l'écran. `captures/08-explosion.png`.

**La correction.** Décaler par `hash(x,y)` : `px + 4 + hash(x,y)*8`, `py + 4 + hash(y,x)*8`,
taille `4 + hash(x+7,y)*4`, et n'en dessiner **que sur 60 % des tuiles**
(`if (hash(x, y+31) < 0.6)`). Même logique pour le CRISTAL (voir §2.1).

---

# 2. CE QUI MANQUE DE CARACTÈRE

---

### 2.1 — La couche 3 est un carrelage. C'est le pire défaut d'identité du jeu.

**Le problème.** `render.js:159-164` dessine sur chaque tuile CRISTAL un losange blanc
**identique, centré, même taille, même orientation**. Un amas de 8×6 blocs devient un
motif de papier peint parfaitement périodique. La grotte de cristal, censée être le climax
visuel, ressemble à une nappe.

**La preuve.** `captures/16-damier-couche3.png` (crop 480×360) — c'est sans appel.
`captures/05-couche3-cristal.png` en pleine page.

**La correction.** Casser la périodicité avec le hash déjà disponible :
```
var h1 = hash(x, y), h2 = hash(y, x), h3 = hash(x + 91, y + 17);
ctx.save();
ctx.translate(px + T/2 + (h1 - .5) * 8, py + T/2 + (h2 - .5) * 8);
ctx.rotate(h3 * 1.57);                       // 0 à 90°, 4 orientations perçues
var r = T * (0.22 + h1 * 0.16);              // 5 à 8,4 px de rayon
// losange, puis 1 seul éclat secondaire si h3 > 0.55
ctx.restore();
```
Ajouter 1 arête claire `rgba(255,255,255,0.5)` de 1 px sur le côté haut-gauche du losange
seulement → la facette attrape la lumière, le cristal devient minéral.

---

### 2.2 — La roche n'a aucune texture : ce sont des aplats de 22 px

**Le problème.** `render.js:125-129` : une tuile = un `fillRect` uni. Le « bruit » est
`(hash - 0.5) * 0.10` soit **± 5 % de luminosité**, invisible à l'œil, et les bandes
sédimentaires (`0.07 * sin(y*0.33)`) donnent ± 7 % — également sous le seuil de
perception. Résultat : la matière est plate, et le seul relief perçu est le **saut de
valeur entre `soft`/`med`/`hard` posés au hasard**, ce qui produit exactement l'effet
« damier de bruit ».

**La preuve.** `captures/04-couche2-sediments.png` : bouillie grise. Les trois valeurs de
la couche 2 (`#6f685e`, `#4f4b45`, `#828a91`) sont à moins de 1,8:1 de contraste entre
elles — elles ne lisent pas comme trois roches, elles lisent comme du bruit.

**La correction.**
- **Monter les strates, baisser le bruit** : bandes `0.07 → 0.16` sur `sin(y*0.28)` et
  bruit par tuile `0.10 → 0.05`. Des strates horizontales franches, visibles sur toute la
  largeur — c'est ce qui dit « coupe géologique ».
- **2 mouchetures par tuile** (pas plus), positionnées par hash, 2×2 px,
  `rgba(0,0,0,0.22)` et `rgba(255,255,255,0.10)`. Coût : 2 `fillRect`, gain énorme.
- **Élargir l'écart de valeur** entre les 3 duretés jusqu'à ~2,5:1 minimum. Couche 2
  proposée : `soft #7d766a`, `med #454139`, `hard #9aa4ad`. On doit lire la dureté d'un
  coup d'œil, c'est une information de jeu.

---

### 2.3 — La couche 2 n'a pas de couleur

**Le problème.** LA TERRE est brune et chaleureuse, LES GROTTES DE CRISTAL sont violettes
et froides. Entre les deux, LES SEDIMENTS sont… gris. Pas gris-bleu, pas gris-vert : gris
béton neutre (`bg #12151a`, `fog #232a2f`). C'est le tiers du jeu (6 niveaux sur 14) et
c'est le tiers sans identité.

**La preuve.** `captures/04-couche2-sediments.png` vs `03` et `05`.

**La correction.** Donner un parti pris : **le gris-vert humide, la pierre mouillée**.
`bg #0f1614`, `fog #1e2e2a`, `soft #7a7a68`, `med #414a44`, `hard #93a8a0`, `ore #ffc93c`.
Le jaune du fer ressort déjà bien — on garde. Et 3-4 filets d'eau qui suintent des plafonds
(1 px de large, `rgba(150,200,210,0.25)`, 40 px de haut) suffiraient à raconter la couche.

---

### 2.4 — On ne sent pas qu'on est sous terre : le premier plan est du code mort

**Le problème.** `render.js:506-522` définit `drawForeground` — « quelques rochers qui
passent devant la caméra », parallaxe 1,18. **Cette fonction n'est jamais appelée.**
Vérifié : `grep -rn "drawForeground" src/` ne retourne que sa définition. Il n'existe donc
aucun plan devant le joueur. Et les plans arrière sont à `globalAlpha 0.13` (strates,
`render.js:478`) et `0.16-0.34` (halos, `render.js:498`) — invisibles.

**La preuve.** `captures/03` à `05` : entre le premier et le dernier plan, l'écran est
strictement plat. Aucun mouvement différentiel perceptible en jouant.

**La correction.**
1. **Appeler `drawForeground(ctx, g, vw, vh, camX, camY, T)` après `ctx.restore()`**
   (render.js:385), et monter son opacité : `rgba(3,4,6,0.9)` au centre. 1 ligne.
2. Strates arrière : `globalAlpha 0.13 → 0.30`, et leur donner **une teinte plus froide
   que la couche** (`shade(layer.fog, 1.6)`) pour créer de la perspective atmosphérique.
3. Ajouter un **vignettage permanent** : dégradé radial `rgba(0,0,0,0)` au centre →
   `rgba(0,0,0,0.55)` aux angles, rayon `0.75 * max(vw,vh)`. Une ligne, et l'écran cesse
   d'être une fenêtre pour devenir un tunnel.

---

### 2.5 — Le phare n'est pas un faisceau

**Le problème.** L'éclairage par tuile (`makeLight`, `render.js:27-47`) est bien
directionnel (`beam = dot²`), mais le halo dessiné en `lighter` (`render.js:396-407`) est
une **chaîne de 5 disques radiaux** dont le premier est centré sur la foreuse. À l'écran,
ça lit comme une lampe-tempête omnidirectionnelle, pas comme un phare de mine.

**La preuve.** `captures/04-couche2-sediments.png` : la foreuse regarde vers le bas, la
tache lumineuse est un blob à peu près rond. `captures/06-effondrement.png` : idem vers
la gauche.

**La correction.** Remplacer les 5 disques par **un cône** : un `ctx.arc` avec
`startAngle = ang - 0.42`, `endAngle = ang + 0.42`, rayon `vision * T * 1.15`, rempli d'un
`createRadialGradient` `rgba(255,226,160,0.10) → transparent`, plus un cône intérieur plus
étroit (`± 0.18 rad`) à `0.07`. Ajouter **2 poussières en suspension par 100 px²** dans le
cône (points de 1 px, `rgba(255,235,200,0.35)`, dérive lente vers le haut) — c'est le seul
détail qui fait « air chargé de poussière » et il coûte 6 lignes.

---

### 2.6 — L'explosion la plus puissante du jeu ne se voit pas

**Le problème.** À la détonation d'une **bombe abyssale (rayon 9, effondrement, ~250 blocs)**,
j'ai mesuré en direct : `shake 13`, `flash 0.18 s`, `hitstop 0`, `slowmo 0`, 321 particules
de 2-5 px. Il n'y a **ni boule de feu, ni onde de choc, ni fumée**. Le flash est plafonné à
`alpha 0.3` (`render.js:457`) et décroît immédiatement — invisible.

**La preuve.** `captures/08-explosion.png`, capturée à 855 ms (mèche = 850 ms), donc à
l'instant même de la détonation : un cratère déjà creusé et une poignée de pixels orange.
Rien d'autre. `captures/09-explosion-cratere.png` : trou à bords nets, sans suie.

**La correction (par ordre de rendement).**
1. **Boule de feu** : 3 disques concentriques qui grandissent de `0 → rayon*T*1.4` en
   **180 ms**, couleurs `#fff4c8` → `#ff8a3d` → `#8a2a10`, alpha `1 → 0`, en
   `globalCompositeOperation:'lighter'`.
2. **Onde de choc** : anneau `strokeStyle #ffe0a0`, `lineWidth 6 → 1`, rayon
   `0 → rayon*T*2.2` en **260 ms**.
3. **Arrêt sur image** : `G.hitstop = 0.07` puis `G.slowmo = 0.22`. Aujourd'hui c'est 0,
   alors qu'un simple bonus commun déclenche `hitstop 0.10` (`game.js:851`). L'échelle
   d'impact est inversée.
4. **Flash** : plafond `0.3 → 0.55` et durée `0.18 → 0.28 s`.
5. **Secousse** : `13 → 34`, et changer la décroissance (voir §3.1).
6. **Cratère brûlé** : sur les tuiles restantes en bordure du rayon, un `fillRect`
   `rgba(0,0,0,0.35)` permanent stocké dans un `Set` `world.scorched`.

---

# 3. GAME FEEL — LE CŒUR DU PROBLÈME

---

### 3.1 — Casser un bloc ne produit **rien**

C'est le constat central. Le joueur passe 95 % du temps à casser des blocs ordinaires, et
voici tout ce qui se produit (`src/game.js:571-573`) :

```
burst(cx, cy, layer.med, 3);   // 3 particules
if (!chain) SFX.breakBlock();  // un blip
```

**Pas de secousse. Pas d'arrêt sur image. Pas de recul de la foreuse. Pas d'éclat au point
de contact.** Le minerai fait à peine mieux : `shake 3` — soit une amplitude de **± 1,5 px
pendant 115 ms** (`render.js:93-95`, décroissance `dt*26`), c'est-à-dire rien.

**La correction, chiffrée.** Une **échelle d'impact** cohérente à construire, aujourd'hui
inexistante :

| événement | hitstop | slowmo | shake (amplitude px) | particules | flash |
|---|---|---|---|---|---|
| bloc `soft` cassé | **20 ms** | — | **3** (±1,5 px, 80 ms) | 4 | — |
| bloc `hard` cassé | **35 ms** | — | **6** (±3 px, 110 ms) | 7 | — |
| minerai cassé | **45 ms** | — | **8** (±4 px, 130 ms) | 12 | 0,10 s |
| masse qui atterrit | **60 ms** | — | **22** (±11 px, 300 ms) | 30 | — |
| bonus ramassé | 100 ms *(ok)* | 300 ms *(ok)* | 7-11 *(ok)* | — | ok |
| **coup encaissé** | **120 ms** | **350 ms** | **30** | 25 | 0,45 s *(ok)* |
| **explosion rayon 9** | **70 ms** | **220 ms** | **34** | 60 | 0,28 s |

Aujourd'hui le **coup encaissé** — l'événement le plus important du jeu, celui qui coûte un
point d'intégrité sur 3 — n'a **ni hitstop ni slowmo** (`game.js:288-291`), alors qu'un
bonus commun en a. À corriger en priorité : c'est une ligne.

**Décroissance de la secousse.** `g.shake -= dt * 26` (`render.js:95`) est **linéaire** :
un shake de 30 traîne 1,15 s en s'éteignant mollement. Passer en exponentiel :
`g.shake *= Math.pow(0.001, dt)` (chute à 0,1 % en 1 s) puis `-= dt * 8`. On obtient une
frappe sèche au lieu d'un tremblement de gélatine.

**Secousse directionnelle.** `sx`/`sy` sont deux `Math.random()` indépendants
(`render.js:93-94`). Une secousse de forage doit être **alignée sur l'axe de forage** :
`sx = -d.fx * amp * (Math.random()*0.4 + 0.6)` — le monde recule dans l'axe du coup. C'est
ce qui fait qu'on *sent* la direction.

---

### 3.2 — La foreuse ne recule pas, ne vibre pas, ne pivote pas

**Le problème.** Pendant tout le forage, `drawDrill` translate la foreuse exactement à sa
position logique. La seule animation est `reach = T*1.55 + spin*3` (`render.js:714`) :
la pointe s'allonge de **3 px sur 34**, soit un frémissement invisible. Le corps ne bouge
pas d'un pixel. La rotation de tête (`d.rotT`, 0,2 s) ne fait que **changer la couleur** du
triangle en `#7a7f88` (`render.js:715`) — il n'y a aucune interpolation d'angle : la tête
**téléporte** d'une direction à l'autre.

**La preuve.** `captures/10-foreuse-zoom.png` : rectangle + triangle, figés.

**La correction (par ordre de rendement, tout est dans `drawDrill`).**
1. **Recul (recoil)** — 4 lignes, l'effet le plus rentable du jeu.
   `var kick = d.drilling ? Math.sin(d.bit * 2) * 2.2 : 0;` puis
   `ctx.translate(-d.fx * kick, -d.fy * kick);`
   La machine pousse et repousse dans son axe, à la fréquence des coups. Amplitude ± 2,2 px,
   période = celle de `d.bit`.
2. **Interpolation de l'angle.** Stocker `d.angDraw` et faire
   `d.angDraw += angleDiff(ang, d.angDraw) * Math.min(1, dt * 14)` — pivot en ~110 ms au
   lieu d'un saut. Coût : 5 lignes, et c'est la différence entre « un sprite » et « une
   machine ».
3. **Tête en 3 pales.** Remplacer le triangle unique par 3 triangles à
   `d.bit + i * 2.09 rad` autour de l'axe, projetés (`sin` sur la largeur). On voit la
   mèche tourner. ~10 lignes.
4. **Chenilles.** 5 carrés de 4×4 px le long des flancs, décalés de
   `(g.time * 90) % 8` px. Ça coûte une boucle et ça donne un véhicule.
5. **Écrasement à l'atterrissage** : sur `onLand`, `ctx.scale(1.25, 0.75)` qui revient à
   `(1,1)` en **140 ms** en `easeOutBack`. Le classique, et il manque.

---

### 3.3 — Les particules sont de la poussière de pixels

**Le problème.** `burst` (`game.js:191-201`) : carrés de 2-5 px, couleur unie prise sur le
bloc, `vy` initial `(rand - 0.9) * 9` (donc surtout vers le haut), gravité 30, **pas de
rebond au sol, pas de rotation, pas de réduction de taille, pas de traînée**. À l'écran ce
sont des pixels qui montent et disparaissent en fondu.

**La correction.**
- **Deux populations** au lieu d'une :
  - *éclats* (6 par bloc) : 3-6 px, couleur du bloc **éclaircie ×1,4**, `life 0.5 s`,
    rebond une fois au sol (`vy *= -0.35` quand la case dessous est solide).
  - *poussière* (10 par bloc) : 2 px, `rgba(200,190,175,0.45)`, gravité **8** au lieu de 30,
    `life 0.9 s`, dérive latérale `± 1.5`. C'est elle qui fait le nuage.
- **Réduction de taille** : `s * (life/max)` au dessin — les éclats s'éteignent au lieu de
  se téléporter.
- **Émettre au point de contact**, pas au centre de la case détruite : décaler l'origine de
  `-fx * 0.5, -fy * 0.5`. Aujourd'hui les éclats jaillissent *derrière* la roche.

---

### 3.4 — La caméra ne regarde pas où on va

**Le problème.** `render.js:84-87` : la caméra vise le centre de la foreuse avec un lerp
`dt*9` (~110 ms). Aucun **look-ahead** dans la direction de forage, aucun **zoom**, aucun
recul en chute. On fore vers le bas et on ne voit pas plus loin vers le bas.

**La correction.**
- Look-ahead : `tx += d.fx * T * 3.5; ty += d.fy * T * 4.5;` (3-4 tuiles d'avance dans
  l'axe de la tête). Interpolé au même lerp, ça se lit comme de l'anticipation.
- En chute libre (`d.vy > 18`), pousser à `ty += Math.min(T*7, d.vy * T * 0.22)` : la
  caméra s'ouvre vers le bas quand ça va vite. C'est gratuit et c'est de la vitesse pure.
- Turbo : `ctx.scale(0.96)` pendant `d.turboT > 0`, transition **120 ms** — un léger
  dézoom = accélération ressentie.

---

# 4. HUD

`captures/03`, `05`, `07`, `15`.

### 4.1 — La hiérarchie est fausse

Ce qui est **le plus gros à l'écran** : la profondeur (`44 px`, `index.html:22`).
Ce qu'on **cherche des yeux** : le carburant restant (`10 px`, gris, en bas à gauche) et
le temps (`20 px` cyan, sous la profondeur).

La profondeur en mètres est une information **contemplative** ; le carburant est une
information **de survie**. Inversion à corriger :

| élément | actuel | proposé |
|---|---|---|
| profondeur | 44 px, centre haut | **26 px**, centre haut |
| chrono | 20 px cyan | **34 px**, centre haut, `tabular-nums` |
| carburant (valeur) | 10 px gris | **20 px blanc**, dans un panneau opaque |
| or | 20 px | 16 px |
| nom du niveau | 18 px | **13 px** (on le lit une fois, au départ) |
| défis | 10 px, 3 lignes permanentes | 11 px, **repliés** en 3 pastilles `[x]/[ ]` |

### 4.2 — Ce qui est superflu à l'écran en permanence

- `#left` affiche `force 4.0 · vitesse 2.7 / taille 2 x 1` (`captures/03`) — des stats de
  fiche technique, jamais consultées en action. À déplacer dans le panneau `T`, ou à
  n'afficher que **2 s après un achat**, en surbrillance.
- `#challenges` : 3 lignes de défis affichées 100 % du temps. Les afficher **repliés** et
  ne développer la ligne que **1,2 s** au moment où un défi bascule sur `ok`.
- `#passivelist` (bas droite) : liste des passifs, jamais lue en jeu.

### 4.3 — La jauge de descente est un trait de 10 px collé au bord

`drawSideGauge` (`render.js:525-557`) dessine une colonne de **10 px de large** à
`vw - 26`. C'est pourtant la seule chose qui dit « où suis-je dans le niveau, où est la
sortie, où est la Faille » — l'information stratégique n°1.
**Correction** : largeur `10 → 18 px`, `x = vw - 40`, fond `rgba(10,11,14,0.8)`, et la
**zone déjà avalée par la Faille remplie en `#5a1a12` opaque**. Le curseur foreuse passe de
`#ffcf5c` à `#ff9a2e` avec un contour noir 1 px.

### 4.4 — Les points d'intégrité sont mal placés

`#hp` (`index.html:38-42`) : 3 carrés de 16 px, collés sous le compteur de profondeur, au
**centre haut** — la zone la plus chargée de l'écran (`captures/03` : ils se retrouvent
entre le chrono et le badge MODE TEST).
**Correction** : les déplacer **en bas au centre**, `bottom: 22px`, taille `22 px`, et
faire clignoter le carré perdu à `#ff3b52` → transparent, **3 cycles de 120 ms**, à
l'instant du dégât. Aujourd'hui un point qui disparaît ne s'annonce pas.

---

# 5. SON — `src/audio.js`

Le fichier est correct pour ce qu'il fait : 25 sons de synthèse, aucun fichier, une
enveloppe propre. Mais il est **entièrement composé de `blip()`** — un oscillateur unique,
une enveloppe exponentielle. D'où : tout sonne pareil, tout sonne petit, tout sonne
« bipeur ». Ce qui manque, par ordre de rendement :

1. **Une nappe de fond par couche.** Le jeu est **silencieux** entre deux actions. Deux
   oscillateurs `sine` désaccordés (par ex. 42 Hz et 42,7 Hz en couche 1, 33 Hz et 33,4 Hz
   en couche 3) dans un `lowpass` à 180 Hz, gain 0,05, joués en continu. Le battement
   produit un grondement souterrain. **~15 lignes, et c'est ce qui change le plus.**
2. **Une réverbération.** On est dans une mine, tout sonne à sec. Une `ConvolverNode` avec
   un buffer de bruit décroissant sur **1,8 s** (généré en 8 lignes), envoi à 0,22, sur un
   bus parallèle au master. C'est la différence entre « un jeu web » et « sous terre ».
3. **Un impact à basse fréquence sur les gros événements.** `blast()`, `rockfall()` et
   `hurt()` culminent à 70-120 Hz avec un `sawtooth` — ça claque, ça ne pèse pas. Ajouter
   une couche `sine` **28 Hz → 18 Hz en 400 ms**, gain 0,35 : le sub qu'on ressent.
4. **La variation du son de forage.** `drill()` (ligne 50-53) ne fait que régler un gain
   sur un bruit blanc filtré à 700 Hz fixe. **Moduler la fréquence du lowpass selon la
   dureté** : `lp.frequency = 380 + hardness * 45` (grave dans la roche dure, aigu dans le
   tendre) et ajouter un LFO carré à **la fréquence des coups** (`stats.speed` Hz) sur le
   gain, amplitude ± 40 %. Le forage doit **pulser au rythme de la mèche**, pas ronronner.
5. **Le son de la Faille manque totalement de présence.** `faille(near)` (ligne 115-118) est
   un blip de 0,5 s à 55-95 Hz. Il faudrait un **bruit rose filtré qui monte en continu** :
   lowpass `120 → 900 Hz` et gain `0 → 0,20` interpolés sur `near`. Une menace qui approche
   doit s'entendre approcher, pas biper.
6. **Pas de panoramique.** Tout est mono. Un `StereoPannerNode` sur les événements localisés
   (effondrement, explosion, ramassage) piloté par `(worldX - camCenterX) / (vw/2)`, borné
   à ± 0,7. ~5 lignes, gros gain de spatialisation.
7. **Pas de ducking.** Quand `hurt()` ou `blast()` part, le bruit de forage continue au même
   niveau. Baisser `master.gain` à **0,25 pendant 90 ms** puis remonter en 250 ms.
   L'explosion « pousse » le reste du mix.

---

# 6. LES ÉCRANS

### 6.1 — Menu (`captures/01-menu.png`)

- **Fond noir vide.** Rien ne dit qu'on va sous terre. 40 % de la hauteur est vide sous les
  boutons. → Un **canvas de fond animé** : une coupe géologique qui descend lentement
  (2 px/s), les 3 couches en dégradé vertical avec leur palette, la silhouette d'une foreuse
  en `#ff9a2e` en bas à droite. On réutilise `drawParallax` : ~25 lignes.
- **Mur de texte.** 4 lignes de `13 px` gris centré (`index.html:220-223`) que personne ne
  lit. → Garder **une** ligne : *« Le centre de la planète est à 1 300 mètres. Ton seul
  adversaire est le chrono. »* Le reste va dans le carnet.
- **`CORE` avec `letter-spacing: 10px` et le `O` orange** casse le mot en deux
  (`C O` / `R E`). → `letter-spacing: 4px`, taille `52 → 68 px`, et poser le orange sur le
  `O` **avec un halo** `text-shadow: 0 0 24px rgba(255,138,61,.5)` plutôt qu'un simple
  changement de teinte.
- Les 3 cartes métier sont identiques (même tag gris « METIER »). → Une **couleur de bord
  par métier** et un glyphe de 28 px.

### 6.2 — Station (`captures/11-station.png`)

- **Aucun moment de récompense.** On vient de finir un niveau en médaille or et la médaille
  est écrite en `13 px` à côté du chrono. → Un bandeau de médaille : **56 px de haut**,
  fond `linear-gradient(90deg, transparent, rgba(255,210,74,.18), transparent)`, texte
  `MÉDAILLE OR` en `24 px`, `#ffd24a`, apparition en **300 ms** (`scale 0.9 → 1`,
  `opacity 0 → 1`).
- Le titre de l'écran (`STATION DE FORAGE`) est en `13 px` gris — **plus petit que tout le
  reste de l'écran**. → `h2` → un vrai `h1` de `28 px`, et ajouter **la couche et la
  profondeur atteintes**, absentes aujourd'hui.
- `record - · or 22s · minerai 0` : `12 px` gris, avec un tiret vide. Illisible et vide de
  sens. → Une ligne de 3 blocs `label / valeur`, valeur en `18 px` blanc.
- Le bouton principal `CHOISIS UNE CARTE` est **désactivé et gris** — le plus gros élément
  de l'écran est un état mort. → Le masquer tant qu'aucune carte n'est choisie, et le faire
  **apparaître en orange** au moment du choix (fondu 180 ms).
- Le canvas de jeu transparaît derrière à 93 % → bruit gris sale. Passer `.screen` à
  `rgba(7,8,11,.985)` **ou** assumer avec un `backdrop-filter: blur(8px)`. Pas d'entre-deux.

### 6.3 — Carnet (`captures/12-carnet.png`)

17 lignes typographiquement identiques, `12 px`, toutes les barres à zéro. Écran mort, zéro
envie de revenir.
- **Grouper** par famille (Métiers / Passifs / Pièces / Modes) avec des `h2`. Le préfixe
  textuel `Metier :` devient un **tag coloré** de 9 px (comme `.rar` qui existe déjà,
  `index.html:102`).
- **Trier par proximité de déblocage** — le plus proche en haut. Aujourd'hui l'ordre est
  celui du tableau.
- Le **prochain déblocage** en carte pleine largeur, `border: 1px solid var(--acc)`, barre
  de progression de `10 px` de haut. Les autres restent en lignes.
- Les entrées non déverrouillées : garder le nom lisible mais **masquer la description**
  (`•••`). Une récompense qu'on connaît déjà n'est plus une récompense.

### 6.4 — Fin (`captures/13-fin.png`)

C'est un **tableur**. On atteint le centre de la planète et on reçoit un relevé bancaire de
14 lignes.
- **Il manque la coupe.** L'objet le plus évident : une **bande verticale de 1 300 m**,
  largeur `70 px`, hauteur `520 px`, les 3 couches dans leurs couleurs, et **14 traits
  horizontaux** aux profondeurs des niveaux, colorés par la médaille obtenue. On lit sa
  partie entière en un regard. C'est l'image qu'on partage.
- Manquent aussi : **l'or total gagné**, la **profondeur max**, le **nombre de relances**.
  Aucun n'est affiché.
- Médailles en `11 px` : `BRONZE #c08050` et `OR #ffd24a` sont **trop proches à cette
  taille**. → Pastilles de `16 px` avec un fond (`or #ffd24a` sur `#3a2e08`, `argent
  #c9d3dd` sur `#232830`, `bronze #c08050` sur `#2e1e12`) et remplacer `NONE` (anglais) par
  un tiret gris.
- `LE COEUR` avec `letter-spacing: 10px` + le span orange sur `OE` → le titre se lit
  `LE CO EU R`. Même correction qu'au menu.

---

# 7. LES 5 CHANGEMENTS AU MEILLEUR RAPPORT IMPACT / EFFORT

Classés. Tout est faisable dans `render.js` + quelques lignes de `game.js`.

---

**1. Rendre la foreuse visible.** *(~25 lignes, `drawDrill`)*
Contour noir 3 px non éclairé, carrosserie `#e8b04a`/`#a8722a`, surlignage de forage passé
du blanc à `rgba(255,196,80,α)`. On arrête de chercher son propre personnage des yeux.
C'est le prérequis de tout le reste. → §1.1

**2. Une échelle d'impact au forage.** *(~15 lignes, `game.js` + `render.js:95`)*
`hitstop` 20/35/45 ms selon la dureté, `shake` 3/6/8 en décroissance **exponentielle**
(`shake *= pow(0.001, dt)`) et **alignée sur l'axe de forage** (`sx = -d.fx * amp`), plus le
**recul de la foreuse** (`translate(-d.fx * sin(d.bit*2) * 2.2)`). Et surtout :
`G.hitstop = 0.12; G.slowmo = 0.35` sur le **coup encaissé** (`game.js:289`), qui n'en a
aucun aujourd'hui alors qu'un bonus commun en a. Creuser devient physique. → §3.1, §3.2

**3. Un mur du fond + le vignettage + le premier plan.** *(~18 lignes)*
Remplir les cases vides avec `shade(layer.med, 0.18 + 0.10*lit)` + ombre de plafond de 6 px,
**appeler `drawForeground` qui existe déjà et qui n'est jamais appelé** (`render.js:506`),
et ajouter un vignettage radial `0 → 0.55`. Trois ajouts, et on passe d'un plan flottant à
un souterrain. → §1.5, §2.4

**4. Casser le damier : cristal et charbon décalés par hash.** *(~14 lignes)*
`translate((hash-0.5)*8)`, `rotate(hash*1.57)`, rayon variable `T*(0.22 → 0.38)`, et ne
décorer que 60 % des tuiles. La couche 3 cesse d'être un carrelage — c'est le défaut
d'identité le plus visible du jeu. → §2.1, §1.7

**5. Lisibilité des objets et du HUD.** *(~50 lignes)*
Une **forme par famille** d'objet (bidon / losange / sablier / cercle / hexagone) au lieu
d'un carré unique de 6 px, malus forcé en `#ff4d5e` + croix (aujourd'hui un piège peut être
`#8ac46a`, la couleur exacte du carburant), minerai exempté du plancher d'obscurité
(`lit = max(lit, 0.62)`), et un panneau opaque `rgba(8,9,12,.82)` sous les jauges avec la
valeur de carburant en `20 px` blanc. → §1.2, §1.3, §1.4

---

**Hors classement, à faire en même temps que le n°2 parce que ça coûte 30 lignes et que
c'est ce qui manque le plus au ressenti global :** la nappe de fond par couche et la
réverbération dans `audio.js` (§5.1, §5.2). Le jeu est silencieux entre deux actions.
