# Crypte Infinie

Un roguelite d'action en HTML/JS, dans un seul fichier, jouable sur PC et sur téléphone. Aucune dépendance, aucun serveur.

## Jouer

Sur téléphone, pour jouer en plein écran : sur iPhone, ouvrir le lien dans Safari puis Partager → « Sur l'écran d'accueil » ; sur Android, Chrome propose « Ajouter à l'écran d'accueil » (ou « Installer »), sinon le bouton « ⛶ Plein écran » du menu suffit. Le fichier `manifest.webmanifest` et les icônes du dossier `icons/` servent à cette installation.


Ouvre `index.html` dans un navigateur, ou héberge le dépôt sur GitHub Pages.

## Histoire

Sous la ville, une crypte sans fin où l’on descend et d’où personne ne remonte. Ce qui y meurt laisse une essence que la crypte garde en mémoire, et avec laquelle elle se rebâtit sans cesse. Entre la pierre et son reflet s’étend le Voile : chaque mort le déchire, et quand il cède, on passe dans l’Envers, où rien n’est encore reflété et où tout vaut double. Le Traqueur, premier descendu et premier parjure, y chasse ceux qui traînent ; les serments se prêtent à une voix qui parle derrière le Voile et qui tient ses comptes. Au dixième étage, la vérité affleure : la pierre n’est que l’ombre de l’Envers, et derrière l’Abîme attendent une porte, trois sceaux, et celui qui tisse le Voile. Puis la boucle recommence, car la crypte se souvient.

Le récit se découvre en jeu : quatre écrans d'introduction à la première descente, un texte d'arrivée à chaque étage, vingt-quatre stèles gravées à lire dans les salles (leur lecture est conservée entre les parties), les voix des boss, des serments, du marchand et de l'autel, et une révélation au dixième étage.

## Contrôles

**PC** : `ZQSD` / `WASD` / flèches pour bouger, souris pour viser (visée automatique sinon), clic gauche pour tirer, `Espace` ou `Maj` pour le dash, `E` ou clic droit pour la Surcharge, `V` ou `Ctrl` pour traverser le Voile, `P` pour la pause.

**Téléphone** : glisser sur la moitié gauche pour bouger, sur la moitié droite pour viser et tirer (tir automatique sinon), boutons DASH, ⚡ et ◐ (traversée).

## Ce qu'il y a dedans

- **Douze biomes** de deux étages chacun, qui bouclent ensuite en plus difficile, avec chacun sa palette, ses décors de sol et de murs, ses dangers, son bestiaire et son boss : Catacombes, Forêt des Racines (boue, loups, corbeaux, sangliers, le Grand Cerf), Jardin Suspendu (ronces, guêpes, tréants, la Mère des Ronces), Marais Putride (eau, poison, la Reine des Marais), Ossuaire (piques, golems d'os, la Liche), Grotte Fongique (spores, myconides luminescents, Mère Mycélium), Forge Ardente (lave, le Colosse), Gorges des Cascades (eau vive, gouffres, harpies, la Salamandre), Grottes de Cristal (glace, prismes, le Prisme Éveillé), Cavernes de Givre (le Roi de Givre), Cité Noyée (le Léviathan), Abîme (l'Œil).
- **Cinq boss** aux patterns propres : anneaux, charges, bonds, crachats de poison, éruptions télégraphiées, murs de feu, pics de glace, téléportation, laser rotatif, spirales, invocations.
- **Dix-neuf types d'ennemis** avec des comportements distincts (archers, araignées qui engluent, crapauds sauteurs, chamans soigneurs, spectres qui traversent les murs, kamikazes, loups en meute…) et des **élites** à modificateurs.
- **Cinq armes** au feeling différent : baguette, arc perforant, lames de mêlée qui parent les projectiles, orbe explosif, sceptre à éclairs en chaîne. On les trouve en armurerie ou chez le marchand, et on les débloque au Sanctuaire pour commencer avec.
- **Serments** : à chaque étage, une contrainte contre une récompense.
- **Menace** : un chrono par étage. Traîne trop, et le Traqueur vient te chercher.
- **Combo et Surcharge** : enchaîne les kills pour remplir la jauge, puis déclenche une explosion de projectiles.
- **Salles spéciales** : coffres, marchand, autel (sacrifice, offrande, prière), épreuves en vagues, armurerie.
- **L'Envers** : le reflet de la crypte. Tuer remplit le Voile ; quand il suffit, une fissure permet de passer de l'autre côté, où les murs deviennent des ombres traversables, les gouffres des ponts, et où des Reflets rôdent. Le Voile s'y vide lentement : on tient en tuant, ou on revient par une fissure, sinon on est rejeté avec un demi-cœur en moins. L'essence y vaut double et des reliques uniques s'y trouvent.
- **Énigmes entre les deux mondes** : salles scellées accessibles seulement par l'Envers, glyphes qui révèlent le chemin sûr à travers un champ de gouffres, leviers de l'Envers qui effacent des murs du monde normal, boss qui se voilent à mi-vie et ne peuvent plus être frappés que par leur reflet, Échos qui rendent une relique perdue lors d'une mort précédente.
- **Trente-quatre reliques** cumulables, dont quatre propres à l'Envers.
- **Méta-progression** : l'essence ◆ ramassée est conservée et sert aux bénédictions permanentes, aux armes et au bestiaire (bonus de dégâts contre les ennemis souvent vaincus).
- **Bande-son adaptative** : deux morceaux par biome (le second étage et chaque nouveau cycle changent de morceau), deux thèmes de boss, deux thèmes de menu, dont des valses à trois temps, percussions et basse qui n'entrent qu'au combat, ambiances sonores par biome, réverbération à convolution.
- **Sprites pixel-art** dessinés pour le jeu (planche générée par `tools/sprites.py`), avec variantes recolorées par biome, animations et éclairage dynamique.
- **Bruitages** : échantillons Kenney (CC0, voir `src/assets/sfx/LICENSE-Kenney-CC0.txt`) mélangés à de la synthèse.
- **Musique** générée en temps réel : luth, harpe et clavecin (cordes pincées Karplus-Strong), chœur à formants, cordes frottées, violoncelle, hautbois, flûte, flûte de pan, ocarina, accordéon, cuivres, kalimba, marimba, boîte à musique, bourdons, percussions à main, tambours de bois, os, cymbales ; motifs mélodiques écrits par biome, conduite des voix, humanisation du jeu.

## Développement

Le code source est découpé dans `src/`, les assets (planche de sprites, sons) sont embarqués en data URI, et le tout est assemblé par :

```
python3 tools/sprites.py   # régénère src/assets/sprites.png à partir des dessins ASCII
node build.js              # régénère index.html
```
