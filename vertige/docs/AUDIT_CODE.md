# Audit code — fin de phase 1

Vérifié par lecture + sondes (`tools/_sonde_*.mjs`, supprimées après usage), `npm test` (8/8 OK) et `node tools/sim.mjs --runs 100` (0 erreur, 100 runs, politique gourmande).

## BLOQUANT
- `chute.js:15-26` (`appliquerGravite`) + `chute.js:35-53` (`remplir`) : une case vidée directement ou indirectement sous un **ballon fixe** n'est jamais comblée — `appliquerGravite` traite le ballon comme un sol qui coupe la colonne, et `remplir` ne regarde que le segment touchant le haut visuel, jamais le dessous d'une cellule fixe (confirmé par sonde : le trou reste vide après `appliquerGravite`). En salle Tempête/Pendule (ballons présents), la grille perd des cases jouables au fil de la partie et l'objectif peut devenir irréalisable. **Correction** : généraliser `remplir` pour combler aussi le sommet de chaque segment délimité par une cellule fixe (pas seulement le haut de la colonne), ou faire redescendre le ballon sur le nouveau sol avant de le figer.

## IMPORTANT
- `tour.js:164-171` (`verifierFin`) : quand un niveau est atteint et que l'objectif de la salle est atteint au même tour, `enAttente` passe directement de `'niveau'` à `'finSalle'` — le choix d'effet (déjà proposé, événement `niveau` émis) est perdu, le joueur monte de niveau sans jamais choisir de bonus (confirmé par sonde). **Correction** : ne vérifier l'objectif qu'une fois le choix de niveau en attente résolu.
- `rendu.js:216-226` (boucle `tick`/`demarrerBoucle`) : la boucle `rAF` (décor animé) tourne en continu dès la première `synchroniser()`, y compris après `quitter()`/retour au menu — aucune méthode `pause()` n'est exposée ni appelée par `main.js`. Rendu hors écran permanent, coût CPU/batterie inutile sur mobile. **Correction** : exposer `pause()`/`reprendre()` sur le rendu, les appeler dans `quitter()`/`afficherMenu()`.
- `rendu.js:179` (`dessinerFrame`) : construit une chaîne `` `${x},${y}` `` par bille à chaque frame (jusqu'à ~140 billes en Puits, 60 fps) même quand `surligneesSet` est vide. **Correction** : sortir tôt si `surligneesSet.size === 0` ; indexer par entier plutôt que par clé chaîne.
- `speciales.js:105-112` : une pierre détruite via la chaîne `cause:'pierre'` n'active pas les éléments adjacents (`if (s.cause !== 'pierre')`), contrairement à une destruction `'groupe'`/explosion — incohérent avec la règle « activation par adjacence » (CLAUDE.md §5). **Correction** : retirer l'exclusion ou documenter explicitement le choix.

## MINEUR
- `particules.js:94` (`dessiner`) : `ctx.fillStyle = \`rgb(${r},${g},${b})\`` recomposé par particule et par frame (jusqu'à 800 actives). **Correction** : mettre en cache la chaîne couleur au spawn de la particule.
- `competences.js:76-82` (`double_amorce`) : le réducteur `zoneExplosion` remplace entièrement la zone 3×3 de la bombe par celle de la croix au lieu d'unir les deux — effet probablement plus faible que prévu. **Correction** : `zoneSpeciale(...).forEach(k => zone.add(k))` puis renvoyer `zone`.
- `gravite.js:10` : cache module `colonnes` jamais vidé — borné en pratique (~20 entrées pour 5 salles × 4 gravités), sans risque en phase 1 mais à surveiller si les tailles de grille se multiplient (phase 2+).
- `hud.js:83,132,144` : jauge / prochaines entrées / effets actifs reconstruits en `innerHTML=''` + re-création de nœuds à chaque `majHud()` (chaque tour) au lieu d'une mise à jour en diff — gaspillage DOM/GC mineur, hors boucle 60 fps donc sans impact perf réel.

## Ce qui est bien
- Sérialisation complète et fiable : `memo`, `prochainesEntrees`, `effetsVus`, `rngEtat` sont bien dans `etat` ; recharger au milieu d'un choix en attente fonctionne (`chargerRun` réinstalle hooks de compétences et d'effets à durée, `gererAttente()` réaffiche le choix en attente).
- Résolution des destructions (`speciales.js`) saine : aucun double comptage XP/objectif/spéciale trouvé, chaînes bornées par `declenchees`/`activesCeTour`, aucune boucle infinie sur 100 runs simulés (0 erreur, y compris salles à rotation automatique).
- Rendu bien conçu côté perf : particules et textes flottants en pools à taille fixe (zéro allocation dans l'intégration physique), sprites pré-rendus hors écran, jamais de `filter` recalculé par frame, garde correcte sur canvas de taille nulle.

## Estimation
Environ 30 à 50 lignes à modifier pour lever le point bloquant (généralisation de `remplir`/`appliquerGravite` sur les segments sous cellule fixe + cas de test dédié en salle à ballons).
