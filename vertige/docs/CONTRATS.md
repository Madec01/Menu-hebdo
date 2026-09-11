# VERTIGE — contrats entre modules

Référence pour tous les modules et agents. Un module ne dépend que de ce qui est écrit ici.
Décisions actées (2026-09-11) : gravité mobile sur données fixes ; remplissage par le haut visuel ;
rotation payée par une **jauge** séparée des coups ; seuils de spéciales 4/6/8/10 ; Canvas 2D maison,
Web Audio maison, aucune dépendance à l'exécution.

## 1. Conventions de grille

- Coordonnées **plateau** : `x ∈ [0,w)`, `y ∈ [0,h)`, index `i = y*w + x`. Elles ne changent jamais.
- `gravite ∈ {0,1,2,3}` = nombre de quarts de tour **horaires** appliqués au plateau à l'écran.
  Vecteur de gravité en coordonnées plateau : `G = [[0,1],[1,0],[0,-1],[-1,0]][gravite]`.
  Le « haut visuel » est `-G`. À l'écran, le plateau est dessiné tourné de `gravite * 90°` horaire,
  donc la gravité apparaît toujours vers le bas de l'écran.
- `tourner(sens)` : `+1` = 90° horaire, `-1` = 90° antihoraire, `2` = 180°. `gravite = (gravite + sens + 4) % 4`.
- Une **colonne** au sens du jeu = une ligne de cases parallèle à `G`. Une **rangée** = perpendiculaire.
- `grille.forme[i]` : 1 si la case existe, 0 si elle est hors plateau (forme non rectangulaire). Phase 1 : tout à 1.
- `grille.cellules[i]` : `null` si vide, sinon une **Cellule** :

```js
{ id, type:'bille'|'pierre'|'element', couleur:0..5|null, speciale:null|'bombe'|'ligne'|'croix'|'couleur',
  element:null|{ type:'bulle'|'ballon'|'fusee', activations, max, contenu?:Cellule } }
```
- `id` est unique et stable pendant toute la salle : le rendu s'en sert pour suivre une bille qui bouge.
- `tombe` : bille, pierre, bulle, fusée tombent ; **ballon ne tombe pas** (il flotte, sert de sol, monte d'une case
  contre la gravité à chaque rotation, éclate au plafond ou après 2 activations).

## 2. Style « Cartoon pop » et couleurs (src/data/couleurs.js)

**Décision 2026-09-11 (remplace « Atelier », jugé trop sobre par Martin).** Référence : **Toon Blast** pour le dessin, **Candy Crush** pour le juice.
Tout est saturé, contrasté, cerné : contours épais couleur encre `#1d1b3a` sur chaque bille, chaque panneau, chaque bouton, chaque titre.
Rien de beige, rien de sobre, rien de néon.

- **Fond** : ciel bleu vif en dégradé (`#38b6ff` en haut → `#8fe1ff` en bas), nuages blancs cartoon (formes de bulles superposées, contour encre fin) qui dérivent lentement, quelques étoiles/confettis qui flottent. Un léger éventail de rayons blancs à 8 % derrière le plateau.
- **Plateau** : cadre épais peint (jaune-orange `#ffb347` avec bord clair `#ffd27a` en haut, bord foncé `#e0801a` en bas, contour encre 3 px, coins très arrondis, quatre boulons/étoiles aux coins). Intérieur : champ indigo `#3a2f8f` → `#2b2270` en bas avec cuvettes en losange un ton plus clair. Le contraste champ sombre / billes claires est ce qui fait « pop ».
- **Billes** : grosses (elles remplissent 88 % de la case), aplat saturé + dégradé léger, **contour encre 2,5 px**, gros reflet blanc en haut-gauche (goutte allongée) + petit point, ombre interne au bord bas-droit, petite ombre portée sur le champ. Style « gomme brillante ».
- **Spéciales** : bombe = bombe noire cartoon avec mèche et étincelle animée ; ligne = bille avec fusée/flèche blanche épaisse alignée sur la gravité à l'écran ; croix = étoile à 4 branches blanche sur la bille ; couleur = sucette arc-en-ciel (spirale 6 couleurs) qui tourne lentement. Pierre : rocher gris-bleu cartoon avec facettes et contour. Bulle : sphère transparente avec contour blanc et reflet, contenu miniature. Ballon : ballon rouge/rose brillant avec nœud et ficelle, contour encre. Fusée : fusée cartoon rouge et blanche pointant vers le bas de l'écran.
- **Juice (obligatoire)** : texte flottant `+XP` à chaque salve (police grasse blanche cernée d'encre, monte et s'efface) ; mots de combo sur la case tapée selon la taille (4 « Joli ! », 6 « Super ! », 8 « Énorme ! », 10+ « VERTIGE ! ») en très gros, avec rebond élastique et rotation ±6° ; confettis multicolores (rectangles qui tournent, gravité) + étoiles à 4 branches à chaque destruction ; anneau d'onde de choc sur les explosions ; le plateau entier fait un petit « squash » élastique à l'atterrissage des billes et à la fin d'une rotation ; screenshake proportionnel ; les billes rebondissent (restitution 0,25) et se déforment légèrement (squash vertical 10 %) à l'impact.
- **Interface** : boutons « bonbon » 3D (dégradé clair→saturé, bande inférieure foncée de 6 px, contour encre 3 px, texte blanc gras cerné d'encre, enfoncement au :active) — vert `#5ad341` pour l'action principale, orange `#ff9f1c`, rose `#ff5fa2`, bleu `#2f8cff`. Panneaux et cartes : blanc cassé `#fff8e7`, contour encre 3 px, coins 20 px, ombre portée nette encre à 25 %, bandeau de titre coloré. Titres en police ronde et grasse système (`"Arial Rounded MT Bold", "Trebuchet MS", "Nunito", "Segoe UI", sans-serif`, 900) avec `-webkit-text-stroke` encre et `paint-order: stroke fill`. HUD : compteurs dans des badges (coups dans un badge rouge, jauge = étoiles jaunes, XP = barre verte cernée avec le niveau dans une pastille, objectif dans un badge bleu avec icône).

| index | nom | hex | contour |
|---|---|---|---|
| 0 | rouge | `#ff3b5c` | `#8a1030` |
| 1 | vert | `#3ad24f` | `#12702a` |
| 2 | bleu | `#2f8cff` | `#123f9a` |
| 3 | jaune | `#ffcc1f` | `#9a6a00` |
| 4 | violet | `#b04cff` | `#4f1a8a` |
| 5 | cyan | `#22d3ee` | `#0b6a7a` |

Encre `#1d1b3a` · ciel `#38b6ff`/`#8fe1ff` · champ du plateau `#3a2f8f`/`#2b2270` · cadre `#ffb347`/`#e0801a` · panneau `#fff8e7` · vert action `#5ad341` · orange `#ff9f1c` · rose `#ff5fa2`.

## 3. API du moteur (src/moteur/run.js) — pur JS, aucun DOM, déterministe

```js
import { creerRun, chargerRun } from './moteur/run.js';
const run = creerRun({ seed:123, salles?:['vestibule',...], competences?:[], difficulte?:1, options?:{} });
run.etat            // objet sérialisable, lecture seule pour les autres modules
run.tap(x, y)       // → evenements[]  ([] si action refusée)
run.tourner(sens)   // → evenements[]
run.choisir(id)     // répond à etat.enAttente ('niveau' → id d'effet, 'competence' → id ou null pour passer, 'finSalle' → null)
run.groupeA(x, y)   // → [{x,y}] groupe tapable contenant (x,y), [] sinon
run.peutTaper(x,y), run.peutTourner(sens)   // booléens (faux si enAttente non nul)
run.serialiser()    // → string JSON ;  chargerRun(json) → run
```

`etat` (extrait) :
```js
{ seed, salleIndex, salle:{id,nom,type,...}, grille:{w,h,forme,cellules}, gravite,
  coups, coupsMax, jauge, jaugeMax, tour, xpSalle, niveau, xpTotale,
  objectif:{type:'score'|'couleur'|'ballons'|'pierres', cible, progres, couleur?},
  competences:[ids], effetsActifs:[{id,nom,restant}], prochainesEntrees:[couleurs],
  annonce:null|{sens:-1|1|2},          // rotation automatique annoncée pour la fin du tour (Tempête, Pendule)
  enAttente:null|{type:'niveau',niveau,propositions:[{id,nom,desc}]}
            |{type:'competence',propositions:[{id,nom,desc,rarete}]}
            |{type:'finSalle',victoire,raison,xpSalle}
            |{type:'finRun',victoire,xpTotale,monnaieMeta} }
```

## 4. Journal d'événements (retour de tap / tourner / choisir)

Liste ordonnée ; le rendu la joue séquentiellement, l'UI et l'audio y réagissent. Tous les `x,y` sont en coordonnées plateau.

| `t` | champs | sens |
|---|---|---|
| `tap` | `x,y,taille,couleur` | le joueur a tapé ce groupe |
| `detruit` | `cellules:[{x,y,id,couleur,type}], cause:'groupe'\|'bombe'\|'ligne'\|'croix'\|'couleur'\|'fusee'\|'effet'\|'maree'\|'pierre', origine:{x,y}?, profondeur:0..n` | une salve de destruction ; `profondeur` = rang dans la chaîne |
| `speciale` | `x,y,id,type` | la bille `id` devient spéciale `type` |
| `conversion` | `cellules:[{x,y,id,couleur}]` | couleurs changées (propagation, domino, teinte) |
| `element` | `x,y,id,type,activations,max,action:'activation'\|'eclate'\|'libere'\|'fusee'\|'monte'` | un élément réagit |
| `rotation` | `de,vers,sens,auto` | le plateau tourne (auto = imposé par la salle) |
| `chute` | `deplacements:[{id,de:{x,y},vers:{x,y}}]` | résultat de la gravité ; ordre quelconque, tout est simultané |
| `remplissage` | `cellules:[{id,x,y,couleur,type,depuis:{x,y}}]` | nouvelles billes ; `depuis` = case virtuelle hors plateau d'où elles entrent |
| `maree` | `deplacements:[…], entrees:[…], sorties:[{id,x,y}]` | une ligne pousse tout contre la gravité |
| `xp` | `gain,xpSalle,niveau,multiplicateur` | XP gagnée |
| `niveau` | `niveau,propositions` | montée de niveau ; `etat.enAttente` est posé |
| `effet` | `id,nom` | un effet de niveau a été appliqué |
| `competence` | `id,nom` | une compétence a été prise |
| `objectif` | `progres,cible,atteint` | progression de l'objectif |
| `coups` | `coups,jauge` | ressources mises à jour |
| `salle` | `index,nom` | nouvelle salle : l'orchestrateur appelle `synchroniser(etat)` avant `jouer()` ; le rendu joue une entrée en cascade |
| `finSalle` | `victoire,raison` | la salle est terminée |
| `finRun` | `victoire` | le run est terminé |
| `message` | `texte,duree?` | texte flottant |

## 5. Rendu (src/rendu/rendu.js) — Canvas 2D

```js
import { creerRendu } from './rendu/rendu.js';
const rendu = creerRendu(canvas, { onTap:(x,y)=>{}, onSurvol:(x,y|null)=>{} });
rendu.synchroniser(etat)          // reconstruit tous les sprites depuis etat (début de salle, chargement, mode test)
await rendu.jouer(evenements, { audio })   // anime la séquence ; appelle audio.jouer(...) aux bons moments ; résout à la fin
rendu.enAnimation                 // booléen
rendu.surligner([{x,y}])          // halo sur un groupe (survol souris) ; [] pour effacer
rendu.previsualiserRotation(sens|null)   // optionnel : fantôme de la chute
rendu.redimensionner()
rendu.pause() / rendu.reprendre()  // coupe / relance la boucle d'animation (retour au menu)
rendu.detruire()
```
- Le rendu convertit pointeur → case plateau en inversant la rotation. Il ne connaît rien au moteur : il ne lit que `etat` et les événements.
- Chute : intégrateur visuel par bille (accélération, rebond à l'arrivée avec restitution ~0.25), en unités de cases le long de `G`. Durée cible d'une chute complète ≈ 350 ms.
- Rotation : le conteneur tourne de `sens*90°` en ≈ 380 ms (ease in-out), l'échelle s'adapte au nouveau rapport largeur/hauteur pendant la rotation.
- Sprites pré-rendus par couleur sur canvas hors écran (billes cerclées, plateau), dessinés en `source-over`. Jamais de `filter` par frame. Les textes flottants et les mots de combo sont dessinés dans le canvas (police système grasse, contour encre).
- Particules : pool fixe (≤ 800), textes flottants (≤ 16), zéro allocation par frame. Screenshake proportionnel à la taille de la salve, plafonné.
- Icônes : `ligne` et `fusee` pointent le long de la gravité **à l'écran** (donc contre-rotation par rapport au plateau).

## 6. Audio (src/audio/audio.js) — Web Audio, synthèse en couches

```js
import { audio } from './audio/audio.js';
audio.init()                      // au premier geste utilisateur
audio.jouer(nom, params={})       // 'tap'{taille} 'detruit'{taille,cause,profondeur} 'speciale'{type} 'rotation'{sens}
                                  // 'chute' 'rebond'{n} 'element'{type,action} 'niveau' 'competence' 'victoire' 'echec' 'ui' 'erreur'
audio.volume(0..1) ; audio.muet(bool) ; audio.estMuet()
```
Interdit : son qui sonne 8-bit. Attendu : enveloppes, bruit filtré, couches, réverbération à convolution générée, légère variation aléatoire de hauteur.

## 7. UI (src/ui/ui.js) — HTML/CSS glassmorphism, tout le texte en français

```js
import { creerUI } from './ui/ui.js';
const ui = creerUI(document.getElementById('ui'), {
  nouveauRun(), continuerRun(), lancerTest(config), tourner(sens), choisir(id), quitter(), muet(bool)
});
ui.afficherMenu({ profil, runEnCours:bool })
ui.afficherJeu()                     // masque le menu, montre le HUD
ui.majHud(etat)                      // coups, jauge, XP/niveau, objectif, annonce, prochaines entrées (si compétence 'prevoyance')
ui.afficherAttente(etat.enAttente)   // cartes de choix (niveau / compétence), écran de fin de salle, écran de fin de run
ui.masquerAttente()
ui.message(texte)                    // toast
ui.afficherTest(config)              // panneau mode Test : salle, compétences, seed, difficulté, couleurs, jauge
```
Le panneau Test reçoit les listes depuis `src/data/*.js` (salles, compétences) pour construire ses menus.

## 8. Hooks (src/moteur/hooks.js)

`bus.on(nom, fn, {source, duree?})`, `bus.off(source)`, `bus.emettre(nom, ctx, evt)`, `bus.reduire(nom, valeur, ctx, evt)`.
Événements : `debutSalle finSalle debutTour finTour avantTap groupeDetruit explosion specialeCreee avantRotation apresRotation avantChute apresChute remplissage coupsEpuises`.
Valeurs réductibles : `seuils xpGain coupsInitiaux jaugeInitiale propositionsNiveau`.
Compétences et effets de niveau ne sont **jamais** codés en dur dans grille/chute/speciales.
