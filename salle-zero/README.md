# SUJET NEUF — roguelite à salles (phase 1)

Un roguelite d'action 2D vue de dessus, dans le navigateur, en un seul fichier `index.html` (Canvas 2D, JS vanilla, Web Audio, localStorage) + un dossier `assets/` (sprites CC0, musiques CC-BY).

## Jouer
Servir le dossier `salle-zero/` (ex. `python3 -m http.server`) et ouvrir `index.html`. Ouvrir directement le fichier fonctionne aussi, mais certains navigateurs bloquent alors les musiques.

- ZQSD / WASD / flèches : déplacement · souris : visée · clic gauche : attaque (maintenir pour l'arc : charge)
- clic droit / Espace / Maj : compétence active · E : interagir (coffre) · Échap / P : pause · F1 : panneau debug (mode Test)

## Modes
- **Normal** : sauvegarde locale, 1 sujet et 2 armes débloqués, économie normale.
- **Test** : tout débloqué, passifs au maximum, panneau debug (difficulté 0,5× → 3×, saut de salle, multiplicateurs XP/crédits, rareté forcée, invulnérabilité, spawn d'ennemi/piège, hitboxes, scores en direct, écran de test audio, autoplay).

## Harness de test
Dans la console : `await __autoplay({ seed: 42, timeScale: 20, render: false, weapon: 'weapon_pistol', skill: 'skill_dash', difficulty: 1 })`
renvoie les stats de la run (salle atteinte, niveau, kills, dégâts subis, temps par salle, cause de fin).

## Développement
Les sources sont dans `dev/` (un fichier par module) et assemblées par `node dev/build.js` en `index.html`. Contenu déclaratif : `dev/content.js` (schéma dans `SCHEMA.md`). Documents : `PLAN.md`, `LORE.md`, `CONTENT.md`, `ASSETS.md`, `CREDITS.md`, `TEST-REPORT.md`.
