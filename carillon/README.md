# CARILLON

Survivor-like cadencé par la musique. Vue du dessus, une main sur ZQSD, des vagues qui enflent
et une bande-son qui monte quand tu joues dans le rythme. Folk-horror rural : boue, bronze, brume.

Tu es le dernier apprenti du Beffroi Mère. Ton maître est parti reconsacrer la paroisse de
Cendrelune il y a trois mois. Il n'est pas revenu. Tu commences par là.

## Lancer le jeu

Le jeu charge des JSON et des modules ES : il faut un serveur HTTP local (pas de `file://`).

```
./serve.sh        # Linux / macOS
serve.bat         # Windows
```
Puis ouvrir http://localhost:8080/ et cliquer pour « sonner » (déblocage audio du navigateur).
Aucune dépendance, aucun build : JavaScript vanilla, Canvas 2D, Web Audio API.

## Contrôles (par défaut, tout est remappable dans les options)

| Action | Clavier | Manette |
|---|---|---|
| Se déplacer | ZQSD / WASD / flèches | Stick gauche |
| Volée (dash, sur le temps) | Espace | A / Croix |
| Contre-battement (parade, sur le temps) | Shift ou clic droit | B / Rond |
| Pause | Échap | Start |

Toutes les armes tirent sur les temps. Volée et Contre-battement exécutés dans la fenêtre du
temps (± 110 ms) chargent la Résonance : 4 crans (×1, ×1.4, ×1.8, ×2.5) qui multiplient les
dégâts et font entrer une couche de musique à chaque cran. Options d'accessibilité : « Mesure
assistée » (fenêtre ×3) et « Sans rythme » (Résonance fixe).

## Structure

```
index.html  src/main.js          bootstrap, machine à états, boucle à pas fixe 60 Hz
src/core/     boucle, entrées (clavier, souris, manette), rng seedé, pools, grille spatiale, sauvegarde
src/render/   renderer, atlas, caméra, lumière (multiply/screen), particules, VFX, polices
src/audio/    moteur, Conductor (la Mesure), sampler, musique en couches, bruitages
src/game/     joueur, Résonance, Timbres, Accords, fusions, ennemis, boss, spawner, progression
src/ui/       titre, hub, tutoriel, HUD, cartes, pause, bilan, codex, options, crédits, i18n
src/data/     équilibrage, vagues, paroisses, sonneurs, lore, textes FR/EN, partitions
assets/       sprites, tuiles, UI, polices, audio (échantillons, bruitages) + manifestes
tests/        simulation déterministe, DPS, contrôles statiques, perf (voir tests/README.md)
```

Documents : `PROMPT.md` (brief), `ARCHITECTURE.md` (contrats des modules), `SOURCING.md`
(provenance des assets), `CREDITS.md` (auteur, licence et URL de chaque fichier),
`tests/PLAYTEST.md` (rapport d'équilibrage).

## Tests

```
node tests/checks.mjs          # contrôles statiques (JSON, i18n, manifestes, règles du projet)
node tests/sim.mjs --matrix    # runs simulées (voir tests/README.md pour les profils)
node tests/perf.mjs            # run réelle en navigateur headless, mesure à la minute 10
```

## Licences

Le code du jeu est publié sous licence MIT. Les assets ont chacun leur licence (CC0, CC-BY,
CC-BY-SA, OGA-BY, OFL, CC Sampling Plus), listée dans `CREDITS.md` et dans l'écran de crédits.
