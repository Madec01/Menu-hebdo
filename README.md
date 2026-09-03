# Crypte Infinie

Un roguelite d'action en HTML/JS, dans un seul fichier, jouable sur PC et sur téléphone. Aucune dépendance, aucun serveur.

## Jouer

Ouvre `index.html` dans un navigateur, ou héberge le dépôt sur GitHub Pages.

## Contrôles

**PC** : `ZQSD` / `WASD` / flèches pour bouger, souris pour viser (visée automatique sinon), clic gauche pour tirer, `Espace` ou `Maj` pour le dash, `E` ou clic droit pour la Surcharge, `P` pour la pause.

**Téléphone** : glisser sur la moitié gauche pour bouger, sur la moitié droite pour viser et tirer (tir automatique sinon), boutons DASH et ⚡.

## Ce qu'il y a dedans

- **Cinq biomes** de deux étages chacun, qui bouclent ensuite en plus difficile : Catacombes, Marais Putride (eau qui ralentit, mares de poison), Forge Ardente (lave), Cavernes de Givre (sol glissant), Abîme (gouffres, ténèbres).
- **Cinq boss** aux patterns propres : anneaux, charges, bonds, crachats de poison, éruptions télégraphiées, murs de feu, pics de glace, téléportation, laser rotatif, spirales, invocations.
- **Dix-neuf types d'ennemis** avec des comportements distincts (archers, araignées qui engluent, crapauds sauteurs, chamans soigneurs, spectres qui traversent les murs, kamikazes, loups en meute…) et des **élites** à modificateurs.
- **Cinq armes** au feeling différent : baguette, arc perforant, lames de mêlée qui parent les projectiles, orbe explosif, sceptre à éclairs en chaîne. On les trouve en armurerie ou chez le marchand, et on les débloque au Sanctuaire pour commencer avec.
- **Serments** : à chaque étage, une contrainte contre une récompense.
- **Menace** : un chrono par étage. Traîne trop, et le Traqueur vient te chercher.
- **Combo et Surcharge** : enchaîne les kills pour remplir la jauge, puis déclenche une explosion de projectiles.
- **Salles spéciales** : coffres, marchand, autel (sacrifice, offrande, prière), épreuves en vagues, armurerie.
- **Trente reliques** cumulables.
- **Méta-progression** : l'essence ◆ ramassée est conservée et sert aux bénédictions permanentes, aux armes et au bestiaire (bonus de dégâts contre les ennemis souvent vaincus).
- **Bande-son adaptative** générée en temps réel : un morceau par biome et un thème de boss, percussions et basse qui n'entrent qu'au combat, ambiances sonores et bruitages en couches avec réverbération.
- Éclairage dynamique, torches, textures, animations par créature.

## Développement

Le code source est découpé dans `src/` et assemblé par :

```
node build.js
```

qui régénère `index.html`.
