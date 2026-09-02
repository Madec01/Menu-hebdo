# Bêtes de Papier

*Un théâtre d'ombres de poche. Entre la flamme et le drap, tout ce qu'on ne peut pas dire.*

Jeu de réflexion en HTML5 (canvas 2D + Web Audio), sans aucune dépendance ni fichier externe :
les découpes, les ombres, la musique et les sons sont dessinés et synthétisés par le navigateur.
Jouable à la souris et au clavier sur PC, au doigt sur mobile et tablette.

## Jouer

- **En ligne** : ouvrir `index.html` depuis un hébergement statique (GitHub Pages fonctionne tel quel).
- **Hors ligne** : ouvrir `index.html` dans Chrome, Firefox, Safari ou Edge, ou bien le fichier
  unique `dist/betes-de-papier.html` (généré par `node tools/build.js`).

## L'histoire

Vous êtes Nour, monteur d'ombres de la troupe ambulante des Kalamos. Entre une lampe à suif et un
drap tendu, vous disposez les découpes de papier du coffre familial : leurs ombres, combinées,
doivent former la bête que le vieux Tibor est en train de nommer. Dans un pays où la parole est
surveillée, ce que le public croit voir sur le drap devient une arme. Avec deux lampes de couleur
et un verre teinté, deux spectateurs assis dans la même salle ne voient pas la même histoire.

Trois actes, vingt-trois tableaux, trois représentations en direct, trois fins.

## La règle en une phrase

Plus une découpe est près de la lampe, plus son ombre est grande. Tout le reste en découle.

## Les mécaniques, dans l'ordre où on les apprend

1. **Poser, déplacer, régler la profondeur** : l'ombre est l'homothétie de la découpe.
2. **Tourner et retourner** la découpe.
3. **Basculer** : une découpe vue de profil projette une ombre étroite.
4. **Papier huilé** : ombre grise ; deux épaisseurs redeviennent noires. Il faut compter les couches.
5. **Deux lampes** (rouge et bleue) : une pièce collée au drap donne une seule ombre, une pièce
   proche des flammes en donne deux, écartées. La profondeur pilote à la fois la taille et
   l'écartement. Le verre rouge, le verre bleu et l'œil nu lisent trois images différentes.
6. **Le coffre amputé** : quand les formes figuratives sont confisquées, il faut ruser avec des
   barres, des disques et des coins.
7. **La représentation** : le tambour bat, la cible change à chaque frappe, on n'a que quelques
   secondes pour déplacer ses pièces.

## Rejouabilité

- Trois étoiles par tableau : réussi (≥ 90 %), ovation (≥ 97 %), et ovation en respectant le par
  de manipulations.
- Seize succès.
- **Improvisation du jour** : une silhouette générée à partir de la date, la même pour tout le monde.
- **Tournée** : un enchaînement infini de tableaux générés, avec un coffre qui s'appauvrit.

## Commandes

| Action | Souris / clavier | Tactile |
|---|---|---|
| Poser une découpe | glisser depuis le coffre | glisser depuis le coffre |
| Déplacer | glisser l'ombre, ou flèches | glisser l'ombre |
| Profondeur | molette, `W` / `S` | boutons Grandir / Rétrécir |
| Rotation | `Q` / `E` | boutons |
| Basculer / miroir | `T` / `F` | boutons |
| Retirer, annuler, recommencer | `Suppr`, `Z`, `R` | boutons |
| Vues (œil nu, rouge, bleu, ombre franche) | `1` à `4` | boutons |
| Afficher la cible, pièce suivante | `H`, `Tab` | bouton Cible |
| Pause | `Échap` | bouton Menu |

## Structure du code

```
index.html, style.css      coquille et feuille de style
js/bp.js                   constantes, projection, RNG à graine, émetteur d'événements
js/shapes.js               bibliothèque de 38 découpes (générées par code)
js/levels.js               les 23 tableaux, générateurs d'improvisation et de tournée
js/story.js                textes narratifs, tutoriel, succès
js/audio.js                synthèse Web Audio : saz, tambour, cloches, papier, public, réverbération
js/core.js                 moteur : modèle, rendu, entrées, masques et score, sauvegarde
js/ui.js                   écrans, HUD, tutoriel, succès, modes
docs/CONCEPT.md, SPEC.md   dossier de conception et contrat entre modules
tools/build.js             assemblage en un seul fichier HTML
```

La sauvegarde est locale au navigateur (`localStorage`).
