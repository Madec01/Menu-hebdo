# Bêtes de Papier — SPÉCIFICATION TECHNIQUE (contrat entre modules)

Tous les modules sont des scripts classiques (pas de modules ES, pas de bundler, pas de dépendance
externe, aucun asset externe). Le jeu doit fonctionner ouvert en `file://` ET via GitHub Pages.
Un seul espace de noms global : `window.BP`. Chaque fichier ajoute sa partie (`BP.engine`, `BP.audio`,
`BP.levels`, `BP.shapes`, `BP.story`, `BP.ui`, `BP.save`). Langue de l'interface : français.

Ordre de chargement (index.html) :
```
js/bp.js        (constantes, utilitaires partagés, émetteur d'événements, RNG à graine)   [écrit par le chef de projet]
js/shapes.js    (bibliothèque des découpes)                                            [agent Contenu]
js/levels.js    (tableaux, actes, générateur d'improvisation / tournée)                [agent Contenu]
js/story.js     (textes narratifs)                                                     [agent Contenu]
js/audio.js     (Web Audio : sons, musique, ambiance)                                  [agent Audio]
js/core.js      (moteur : modèle, projection, rendu, entrées, score, sauvegarde)       [agent Moteur]
js/ui.js        (écrans, HUD, tutoriel, succès, modes)                                 [agent UI]
```
`index.html` et `style.css` appartiennent à l'agent UI (le squelette initial est fourni).

---------------------------------------------------------------------------------------------------
## 1. Géométrie du théâtre d'ombres

- Le **drap** est un rectangle de `BP.DRAP_W = 400` × `BP.DRAP_H = 300` unités-monde, origine en haut
  à gauche, y vers le bas. Il est à la profondeur `z = 1`. Les **lampes** sont à `z = 0`.
- Une lampe : `{ x, y, tint }` en coordonnées drap. `tint` ∈ `'warm'` (une seule lampe, ambre),
  `'red'`, `'blue'` (deux lampes). La lampe d'indice 0 est la **lampe principale**.
- Une **pièce** (découpe posée) : 
  ```
  { uid, shape, sx, sy, depth, rot, tilt, flip, material }
  ```
  - `shape` : id dans `BP.shapes` ;
  - `sx, sy` : **centre de l'ombre sous la lampe principale**, en coordonnées drap (c'est ce que
    l'on manipule au doigt) ; snap sur grille `BP.GRID = 4` ;
  - `depth` : entier 0..4 (`BP.DEPTHS = [1, 0.85, 0.72, 0.6, 0.5]` = distance lampe→pièce ; 0 = collée
    au drap). Facteur d'agrandissement `k = 1 / BP.DEPTHS[depth]` ≈ `[1, 1.18, 1.39, 1.67, 2]` ;
  - `rot` : degrés, multiple de 15, dans [0, 360[ ;
  - `tilt` : entier 0..2 → `BP.TILTS = [1, 0.7, 0.35]`, facteur d'écrasement de l'axe X local
    (avant rotation) : « vue de profil » ;
  - `flip` : booléen, miroir sur l'axe X local (avant tilt et rotation) ;
  - `material` : `'paper'` (opaque, valeur 1) ou `'oiled'` (translucide, valeur 0.5 ; deux couches
    huilées superposées → 1).
- **Projection d'une pièce sous la lampe j** (formule unique, à utiliser partout) :
  ```
  k   = 1 / BP.DEPTHS[depth]
  Sj  = ( sx + (L0.x - Lj.x) * (k - 1),  sy + (L0.y - Lj.y) * (k - 1) )   // centre de l'ombre
  point local (px, py) du polygone  →  px' = px * (flip ? -1 : 1) * BP.TILTS[tilt] ;  py' = py
                                    →  rotation de rot degrés
                                    →  × k, puis + Sj
  ```
  Sous la lampe principale, `Sj = (sx, sy)`. Changer la profondeur d'une pièce ne déplace **pas**
  son ombre principale (elle grossit sur place) mais écarte ses ombres secondaires.
- Ordre de dessin : sans importance pour le masque (union). Les trous des découpes sont de vrais
  trous (règle evenodd) ; une autre pièce derrière remplit le trou dans l'ombre — c'est voulu.

## 2. Masques et score

- Masques rendus hors écran en `BP.MASK_W = 128` × `BP.MASK_H = 96` (échelle 0.32).
- Pour chaque lampe j : canvas noir, on dessine chaque pièce en blanc avec
  `globalCompositeOperation = 'lighter'`, `globalAlpha = 1` (paper) ou `0.5` (oiled), remplissage
  `evenodd`. Le masque est le canal rouge / 255 (valeur 0..1 par pixel).
- **Lectures** (`readings`) :
  - `'main'`  : masque de la lampe 0 (niveaux à une lampe) ;
  - `'red'`   : masque de la lampe de teinte `red` ; `'blue'` : masque de la lampe `blue` ;
  - `'umbra'` : min pixel à pixel des masques rouge et bleu (ce que voit l'œil nu).
- Score d'une lecture : `1 - Σ|T - M| / max(Σ max(T, M), 1)` (IoU souple), T = cible, M = courant.
- Score du tableau = **minimum** des lectures demandées. Seuils : `BP.PASS = 0.90` (réussi),
  `BP.GOLD = 0.97` (ovation). Étoiles : 1 = réussi, 2 = ovation, 3 = ovation ET `moves <= par`.
- Les cibles sont **toujours** rendues à partir de `solution` (donc toujours atteignables à 100 %).

## 3. Schéma d'un tableau (`BP.levels`)

```js
{
  id: 'a1t03',            // acte 1, tableau 3 — unique, stable (clé de sauvegarde)
  act: 1, index: 3,       // index 1..n dans l'acte
  title: 'Le Lièvre',
  type: 'tableau',        // ou 'performance'
  intro: 'texte...',      // 1 à 4 phrases affichées avant (peut contenir \n). Optionnel.
  outro: 'texte...',      // affiché après réussite. Optionnel.
  hint: 'texte...',       // indice sur demande. Optionnel.
  lamps: [{ x: 200, y: 150, tint: 'warm' }],           // 1 ou 2 lampes
  readings: ['main'],                                   // ou ['red','blue'] ou ['red','blue','umbra'] …
  coffre: ['drop', 'crescent', 'thin_tri', 'disc:oiled'],   // inventaire ; 'id' ou 'id:oiled'; doublons permis
  unlocks: ['depth'],      // contrôles introduits ICI (tutoriel) : 'move','depth','rotate','flip','tilt','oiled','twolamps','performance'
  par: 5,                  // nombre de manipulations de référence
  solution: [              // une configuration qui produit la cible
    { shape: 'drop', sx: 200, sy: 170, depth: 1, rot: 0, tilt: 0, flip: false, material: 'paper' },
    …
  ],
  // ---- uniquement si type === 'performance' ----
  beats: [ { solution: [ … ], seconds: 10 }, { solution: [ … ], seconds: 8 }, … ],
  // en représentation : la cible du temps t est celle du beat courant ; à la fin de chaque beat le
  // score est figé ; score final = moyenne des beats ; réussi si moyenne ≥ PASS et aucun beat < 0.75.
  // Les pièces disponibles sont celles de `coffre` ; `solution` = configuration de départ posée d'office.
}
```
API :
```js
BP.levels.acts      // [{ act:1, title:'Les foires', levels:[…] }, …]
BP.levels.all       // liste plate ordonnée
BP.levels.byId(id)
BP.levels.next(id)  // tableau suivant ou null
BP.levels.makeImprov(seed)            // tableau généré (id 'improv-<seed>', act 0), déterministe
BP.levels.makeTournee(seed, stage)    // tableau généré pour l'étape `stage` (1..∞) d'une tournée ;
                                      // difficulté croissante, coffre qui s'appauvrit, id 'tour-<seed>-<stage>'
```
Le générateur choisit des pièces et une configuration aléatoire (RNG à graine `BP.rng(seed)`),
vérifie que toutes les ombres tiennent dans le drap (marge 10), rend `solution`, et ajoute 0–2
pièces leurres dans `coffre`.

## 4. Découpes (`BP.shapes`)

```js
BP.shapes.list            // ids
BP.shapes.get(id)         // { id, name:'Goutte', polys:[ [[x,y],…], … ], w, h }
```
- Un polygone = tableau de points `[x,y]` en unités-monde, **centré sur (0,0)** (le centre du
  rectangle englobant). `polys[0]` est le contour extérieur ; les suivants sont des trous ou des
  parties disjointes (remplissage evenodd). Taille indicative : entre 20 et 120 unités.
- Ids obligatoires (le moteur et le générateur y font référence) : `disc, ring, drop, crescent,
  leaf, blade, thin_tri, tri, square, bar, long_bar, arc, hook, comb, wedge, blob, star, cross,
  heart_leaf, fan, key, bone, wave, egg, tooth, pebble`. Le contenu peut en ajouter d'autres.
- `BP.shapes.path(ctx, shape)` construit le tracé (moveTo/lineTo/closePath pour chaque poly) sans
  remplir — utilitaire partagé par le rendu et les masques.

## 5. Moteur (`BP.engine`) — API publique

```js
BP.engine.init(canvas)                 // une seule fois. Gère le resize (devicePixelRatio), les entrées.
BP.engine.loadLevel(level, opts)       // opts: { mode:'story'|'improv'|'tournee' }. Réinitialise.
BP.engine.getState()                   // { level, pieces:[…], selected:uid|null, moves, undoCount,
                                       //   score, scores:{main|red|blue|umbra: 0..1}, status:'playing'|'won',
                                       //   view:'all'|'red'|'blue'|'umbra', beat:{index, remaining, scores:[…]}|null }
BP.engine.on(event, fn) / off(event, fn)
// événements :  'move' (toute manipulation comptée), 'score' ({score, scores}), 'select' (uid|null),
//               'won' ({score, stars, moves, par, level}), 'beat' ({index, score}), 'unlock' (name),
//               'pick' | 'place' | 'rotate' | 'depth' | 'tilt' | 'flip' | 'remove' | 'undo' | 'reset'
// Actions (toutes appliquées à la pièce sélectionnée quand il y en a une) :
BP.engine.act(name, arg)   // 'depth+' 'depth-' 'rot+' 'rot-' 'tilt' (cycle) 'flip' 'remove'
                           // 'nudge' arg={dx,dy} (en unités grille) 'undo' 'reset' 'select' arg=uid
                           // 'placeFromCoffre' arg=coffreIndex (pose au centre) 'view' arg='all'|'red'|'blue'|'umbra'
                           // 'showTarget' arg=bool (fantôme de la cible) 'curtain' (représentation : démarrer)
BP.engine.setPaused(bool)
BP.engine.setOptions({ reduceMotion:bool, showSideView:bool })
BP.engine.renderThumb(canvas, level)   // dessine la cible (silhouette) dans un petit canvas — pour le menu
BP.engine.computeMasks(pieces, lamps)  // utilitaire pur : { main|red|blue: Float32Array }  (pour tests)
```
- Compte de **manipulations** (`moves`) : pose depuis le coffre, fin de glisser (si déplacé),
  depth±, rot±, tilt, flip, retrait. `undo` n'incrémente pas mais compte dans `undoCount`. Nudge = 1.
- **Entrées** : pointeur unifié (souris + tactile via Pointer Events). Tap/clic sur une ombre :
  sélection ; glisser : déplacement (snap `BP.GRID`) ; tap dans le vide : désélection ; glisser une
  découpe depuis le coffre vers le drap : pose. Molette sur pièce sélectionnée : profondeur.
  Clavier : flèches = nudge, `W/S` ou `+/-` = profondeur, `Q/E` = rotation, `T` = tilt, `F` = flip,
  `Suppr`/`Backspace` = retrait, `Z` = undo, `R` = reset, `1/2/3/4` = vue all/red/blue/umbra,
  `Tab` = pièce suivante, `H` = afficher/masquer la cible.
- **Mise en page dans le canvas** (le moteur possède tout le canvas) : le drap occupe la plus
  grande zone 4:3 possible ; le **coffre** (bandeau de découpes disponibles, avec miniatures en
  papier) est en bas si portrait, à droite si paysage. En option (`showSideView`), une petite vue de
  côté schématique (lampe → pièces → drap) montre les profondeurs. Une **jauge de ressemblance**
  n'est PAS dessinée par le moteur : c'est l'UI (DOM) qui l'affiche via l'événement `score`.
- **Rendu** : drap ocre clair avec grain de papier (texture de bruit générée une fois), vignette ;
  halo de lampe ; ombres = umbra noire + 3 couches de pénombre (`globalAlpha` faible) décalées
  selon un vacillement de flamme lent (visuel uniquement, le score utilise la position nominale) ;
  avec deux lampes, les ombres sont teintées (rouge/bleu, l'intersection est noire) et la vue
  `'red'|'blue'|'umbra'` simule le verre teinté (n'affiche qu'une lecture). La **cible** est dessinée
  en fantôme (contour craie + remplissage très léger) ; pour deux lampes, cible tricolore.
  Pièce sélectionnée : liseré et poignée discrète. Les pièces hors drap sont refusées (clamp).
  Le moteur doit rester à 60 fps sur mobile : masques recalculés seulement après une manipulation.
- Sauvegarde `BP.save` (dans core.js) :
  ```js
  BP.save.get()         // objet persistant (localStorage 'bp_save_v1'), avec structure par défaut :
  // { levels:{ [id]:{ best:0..1, stars:0..3, bestMoves:n, done:bool } }, achievements:{ [id]:timestamp },
  //   settings:{ music:0.7, sfx:0.9, muted:false, reduceMotion:false, sideView:true },
  //   improv:{ [dateKey]:{ best, moves } }, tournee:{ best:stages, bestScore }, seen:{ [unlock]:true } }
  BP.save.set(mutatorFn) // applique et persiste ; BP.save.reset()
  ```

## 6. Audio (`BP.audio`)

Tout est synthétisé. Objectif : timbres organiques, jamais « bip de navigateur ».
```js
BP.audio.init()                    // à appeler dans un geste utilisateur ; idempotent ; crée le contexte
BP.audio.resume()
BP.audio.setMuted(bool) ; BP.audio.setVolumes({ music:0..1, sfx:0..1 })
BP.audio.sfx(name)                 // 'pick' 'place' 'rotate' 'depth' 'tilt' 'flip' 'remove' 'undo' 'ui'
                                   // 'select' 'error' 'success' 'gold' 'star' 'beat' 'curtain' 'achievement'
                                   // 'page' (papier tourné, écrans d'histoire) 'unlock'
BP.audio.playMusic(theme)          // 'menu' | 'act1' | 'act2' | 'act3' | 'performance' | 'ending' — fondu enchaîné
BP.audio.stopMusic()
BP.audio.setIntensity(v)           // 0..1 : suit le score courant (la musique s'étoffe quand l'ombre se précise)
BP.audio.setAudience(v)            // 0..1 : densité du murmure du public
BP.audio.applause(v)               // 0..1 : applaudissements (granulaire), plus longs si v grand
BP.audio.drum(pattern)             // représentation : lance un motif de tambour ; BP.audio.stopDrum()
BP.audio.ambience(on)              // grésillement de lampe + salle
```
Recettes attendues : réverbération par convolution (RI générée), cordes Karplus-Strong (saz/oud,
mode hijaz/phrygien, deux cordes doublées légèrement désaccordées), tambour à main (sinus à hauteur
descendante + peau bruitée, micro-décalages ±12 ms), papier (grains de bruit passe-bande 2–6 kHz),
bois (synthèse modale inharmonique), lampe (bruit rose passe-bas modulé brownien + crépitements),
public (bruit granulaire à formants ~500/1500 Hz), applaudissements (grains de bruit à densité
décroissante). Planification avec `AudioContext.currentTime`, jamais `setTimeout` pour le rythme.

## 7. Interface (`BP.ui`)

`BP.ui.init()` — monte tout. Écrans : 
- **Titre** (nom du jeu, « Jouer », « Improvisation du jour », « Tournée », « Succès », « Options »),
- **Carte de la tournée** (sélection des tableaux par acte, étoiles, verrouillage progressif : un
  tableau se débloque quand le précédent est réussi ; les actes 2 et 3 quand la représentation
  précédente est réussie),
- **Interlude** (texte d'acte / intro de tableau, style page de carnet, bouton « Lever le rideau »),
- **Jeu** : HUD = titre, jauge de ressemblance (par lecture pour 2 lampes), manipulations / par,
  boutons d'action (profondeur ±, rotation ±, basculer, miroir, retirer, annuler, recommencer,
  indice, cible on/off, vues verre rouge/bleu/œil nu, menu). Les boutons n'apparaissent que
  lorsque le contrôle est débloqué (`unlocks` cumulés dans `BP.save.seen`).
- **Tutoriel** : bulle contextuelle déclenchée par `unlocks` du tableau (première fois), en une ou
  deux phrases, pointant le bouton concerné. Doit être passable d'un tap.
- **Fin de tableau** : étoiles animées, score en %, manipulations, outro, « Suivant » / « Rejouer ».
- **Succès** (liste avec état), **Options** (musique, effets, muet, mouvements réduits, vue de côté,
  effacer la sauvegarde avec confirmation), **Épilogue** (fin, selon les 3 lectures de la finale).
- Modes : Improvisation du jour (graine = `AAAAMMJJ`), Tournée (graine aléatoire, enchaînement,
  fin quand un tableau est raté ou abandonné, score = étapes + Σ scores).
- Responsive : mobile portrait (boutons ≥ 44 px, sous le canvas), paysage et PC (panneau latéral).
  Empêcher le zoom/scroll tactile sur le canvas (`touch-action: none`). `100dvh`.
- Succès (ids fixés) :
  `premier_rideau` (1er tableau réussi), `minimaliste` (ovation avec moves < par), `sans_retour`
  (ovation sans undo), `ovation` (3 étoiles), `acte1`, `acte2`, `acte3` (acte terminé),
  `double_lecture` (1er tableau à deux lampes réussi), `trois_lectures` (finale : toutes lectures ≥ 0.95),
  `oeil_de_lynx` (score ≥ 0.995), `improvisateur` (une improvisation réussie), `tournee_5` (5 étapes de
  tournée), `tournee_10`, `repertoire` (3 étoiles partout), `coffre_ouvert` (toutes les découpes utilisées
  au moins une fois), `patient` (un tableau réussi après ≥ 3 échecs de représentation… ou 40 manipulations).

## 8. Style visuel
Deux couleurs et demie : ocre/crème du drap, noir-brun des ombres, ambre de la lampe ; rouge
carmin et bleu de Prusse pour les lampes de l'Acte II. Typographie : serif (Georgia/`'Iowan Old
Style'`, fallback serif) pour les textes, caractères « carnet ». UI sobre, papier, pas de néon.

## 9. Qualité
- Aucune erreur console. `'use strict'` partout. Pas de `setTimeout` pour le rythme audio.
- Chaque module vérifie l'existence des autres avant d'appeler (`BP.audio && BP.audio.sfx(...)`).
- Testé : Chrome desktop, mobile portrait 390×844 (émulé), paysage 844×390.
