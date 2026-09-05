# CARILLON — tests (agent G : équilibrage & QA)

Tout se lance depuis la racine du projet (`carillon/`) avec Node ≥ 22, sans installation :
les simulations tournent sous Node grâce à des stubs des modules navigateur (`tests/stubs/`),
seul `perf.mjs` a besoin de Playwright et de Chromium.

| Script | Rôle | Commande |
|---|---|---|
| `checks.mjs` | Contrôles statiques (JSON, identifiants § 10 bis, i18n fr/en, assets référencés, règles de code) | `node tests/checks.mjs` |
| `sim.mjs` | Simulation déterministe d'une run complète (durée de la paroisse dans `waves.json` + boss, Moments scriptés traversés) avec un joueur robot | `node tests/sim.mjs --matrix` |
| `dps.mjs` | DPS théorique de chaque Timbre (niv 1 et 7) et de chaque fusion, cible seule et groupe | `node tests/dps.mjs` |
| `perf.mjs` | Run réelle en navigateur : « minute 3, bloc réel » (saut à 178 s, palier 5, spawner et Moments réels, rien d'injecté ; cible fps ≥ 55) puis « minute 10, foule injectée » (stress) ; fps/frameMs/updateMs/renderMs sur 10 s, 404 et erreurs console | `node tests/perf.mjs [--min-fps 55] [--no-fps-check]` |
| `night.mjs` | Nuit complète en navigateur (Playwright) : run réelle accélérée ×4 (`loop.setTimeScale`, ×1 pendant le boss), robot clavier (Espace sur chaque temps, Shift sur le 4ᵉ coup de la cloche, ZQSD par à-coups), cartes automatiques, journal des `run:moment` / `run:fissure` / `run:tier` / `run:minute` / `bell:*` / `run:boss` / `boss:phase` / `run:end`, captures des bannières (Moments, Fêlure, boss, phases) dans `tests/results/night/` ; échec si erreur console/404, boss non atteint, phases cri/double/envers non vues, cloche jamais répondue, `moment_start` jamais joué, pas de victoire | `node tests/night.mjs [--scale 4 --parish cendrelune --seconds N]` |
| `game-test.html` | Page de test manuelle de l'agent D (`src/game/_test/`), inchangée | `http://localhost:8080/carillon/src/game/_test/game-test.html` |
| `mobile.mjs` | Jouabilité mobile (agent T) : émulation tactile Playwright 812×375 @3 (iPhone), 915×412 @2.625 (Android), FR et EN — tap « Cliquez pour sonner », titre → hub → nuit → Relique, joystick virtuel et taps Volée calés sur le temps (≥ 60 % de Parfait), cartes au tap, pause au bouton, options qui défilent au doigt, voile portrait ; captures dans `--out` | `node tests/mobile.mjs [--devices iphone,android,lowdpi] [--langs fr,en] [--out dir]` |
| `timbres-audio.mjs` | Enregistre à l'oreille (MediaRecorder) 8 mesures de Timbres qui chantent : Battant seul, 4 armes, 6 armes → `tests/results/timbres/` | `node tests/timbres-audio.mjs` |
| `timbres-analyze.py` | Analyse des prises (soundfile/numpy) : hauteurs mesurées vs journal, gamme, variation par mesure, crête < −1 dBFS, ≤ 3 voix par temps | `python3 tests/timbres-analyze.py` |

Résultats de référence (JSON bruts des matrices avant/après) : `tests/results/`. Rapport de playtest : `tests/PLAYTEST.md`.

## checks.mjs — contrôles statiques

```
node tests/checks.mjs          # liste [OK]/[KO] ; code de sortie 1 s'il y a un KO
node tests/checks.mjs --json
```

Vérifie : tous les JSON de `src/data/` et les deux manifestes sont valides ; les identifiants du registre
(sonneurs, Timbres, Accords, fusions et leurs couples, ennemis, boss, paroisses, 20 améliorations, 25 hauts-faits (dont les 20 du registre),
24 Feuillets, 43 bruitages, 10 pistes) existent ; chaque clé i18n référencée par les JSON et chaque `t('…')`
littéral du code existe dans **fr et en** ; `fr.json`/`en.json` et `ui-fr.json`/`ui-en.json` ont les mêmes clés ;
chaque sprite, tileset, icône, bruitage, piste et preset de particules référencé existe dans les manifestes, et
chaque fichier des manifestes existe sur le disque ; aucun `src/**/*.js` > 400 lignes ; aucun `Math.random`
hors `src/audio` ; aucun `OscillatorNode` ; aucun `alert/prompt/confirm` ; aucune chaîne française en dur
dans `src/ui` et `src/main.js` (heuristique : lettres accentuées dans un littéral, hors commentaires et `console.*`).

## sim.mjs — simulation d'une run

```
node tests/sim.mjs                                   # Wren, profil parfait, seed 1, Cendrelune
node tests/sim.mjs --char le_muet --profile moyen --seed 3 --parish tourbes
node tests/sim.mjs --matrix                          # 5 seeds × {parfait, moyen, norhythm} × {wren, le_muet}
node tests/sim.mjs --matrix --chars wren,osric --profiles moyen,passif --seeds 3 --json > out.json
node tests/sim.mjs --data ../autre/data              # comparer un autre jeu de JSON (avant/après)
node tests/sim.mjs --seed 2 --trace boss             # trace des coups sur le boss et de l'état du robot
node tests/sim.mjs --matrix --chars wren,osric,maren,le_muet --profiles parfait,moyen,norhythm,passif,parade_seule --out tests/results/x.json
node tests/sim.mjs --summary tests/results/x.json [--md]   # retableau d'une matrice sauvegardée
```

Options : `--seed N`, `--seeds N` (matrice), `--chars a,b`, `--profiles a,b`, `--parish id`,
`--cards honnete|premiere|fusion`, `--upgrades coeur_de_bronze:2,battant_lourd:1`,
`--secondWeapon clarine` (arme supplémentaire au départ : variante « Le Muet corrigé »),
`--weapons N` (Timbres visés par le build, 4 par défaut), `--minutes N` (défaut : durée de la paroisse + 2 min 30), `--jobs 4`, `--json`, `--quiet`.
Le tableau agrégé donne le niveau à 90 s, 3 min et à la fin de la nuit (`duration` de `waves.json`), et le nombre de
Moments traversés ; chaque run liste ses Moments (`id@seconde`).

Profils du robot (`PROFILES` en tête du fichier) :

| profil | frappes (parfait / bon / raté) | mode | rôle |
|---|---|---|---|
| `parfait` | 100 / 0 / 0 | normal | joueur expert (se réadapte au cri fêlé en 1 temps) |
| `moyen` | 20 / 55 / 25 | normal | joueur moyen : presque toujours dans la fenêtre, rarement Parfait (réadaptation 2 temps) |
| `faible` | 10 / 50 / 40 | normal | l'ancien « moyen », référence basse (3 temps) |
| `norhythm` | aucune frappe rythmique | Sans rythme (cran 2 fixe) | accessibilité |
| `passif` | 0 / 20 / 80, une frappe tous les 8 temps, cartes « première proposée », se tourne peu vers l'ennemi | normal | joueur qui joue mal |
| `parade_seule` | 100 / 0 / 0 mais Contre-battement sur chaque temps, jamais de Volée | normal | diagnostic : la parade à vide ne doit rien rapporter (réso ≈ 1) |
| `lead` | 100 / 0 / 0 mais Volée sur chaque temps | normal | diagnostic du style « dash permanent » |
| `naif` | 30 / 50 / 20, Espace sur chaque temps, marche en cercle, jamais tourné vers l'ennemi, première carte | normal | le robot du lead (borne basse : découverte du jeu) |

Vague 2 : le robot pose une parade **à vide** sur la croche quand un Contretemps fermé est à portée (elle l'ouvre un
temps sans coûter de cran ; une Volée sur la croche serait jugée « raté »), poursuit un Voleur de cran qui emporte
un cran (durée de la chasse mesurée : `voleur (s)`), ignore le Désaccordeur ; les `boss:phase` sont journalisées et le
cri fêlé décale la grille du stub (`shiftGrid`), le robot gardant l'ancienne grille `adaptBeats` temps. Colonnes
ajoutées au tableau : niveau à 60 s / 2 min, ennemis vivants à 2 min / au boss / max, phases de boss vues, fusions
(nombre de runs et instant moyen), bronze victoire / défaite, part des Contretemps dans les tués, durée de chasse du Voleur.

Le robot : engage l'ennemi le plus proche à portée de ses armes de contact, se tourne vers lui au tick où une
arme directionnelle tire, recule quand il **prend** des dégâts (12 % des PV en 3 s) ou quand la menace cumulée
explose, esquive les projectiles et les zones, ramasse les Échos, engage le boss (esquive locale des anneaux).
Frappes rythmiques : Volée (fuite) ou Contre-battement tous les 2 temps, jugées par le vrai `conductor.judge`
avec un décalage tiré selon le grade voulu. Cartes : fusion disponible > seconde arme > montée de l'arme la
plus basse > Accord apparié à l'arme la plus haute > Accord préféré.

Sortie : courbe niveau / XP / PV / vivants / tués / cran de Résonance toutes les 30 s, DPS par arme, frappes,
dégâts reçus par type, PV mini, Fêlures, combat de boss (PV à l'arrivée, durée), build, bronze, hauts-faits.
En mode `--matrix`, un tableau agrégé par (sonneur, profil) : victoires, morts, minute de mort, niveau à 90 s /
4 min / 12 min, PV % à l'arrivée au boss, durée du boss, tués, Résonance moyenne, bronze.

Déterminisme : même seed + même profil ⇒ même run (rng du jeu + rng du robot seedés).

## dps.mjs — DPS théorique

```
node tests/dps.mjs            # tableau : seul niv 1 / seul niv 7 / groupe (12) niv 1 / groupe niv 7
node tests/dps.mjs --json
```

Résonance ×1, Wren immobile, cible immobile inamovible à 40 px (ou sur le rayon d'orbite pour la Clarine),
ou 12 cibles en anneau (36–70 px). Les fusions sont mesurées niveau 1 (arme 7 + Accord 5 fusionnés) ;
le Diapason et le Requiem, sans dégât propre, sont mesurés par le gain qu'ils apportent à un Battant niveau 7.

## perf.mjs — performance en navigateur

```
./serve.sh                    # dans un autre terminal (python3 -m http.server 8080)
node tests/perf.mjs           # http://localhost:8080/carillon/index.html par défaut
node tests/perf.mjs --url http://localhost:8080/carillon/index.html --seconds 10 --json
node tests/perf.mjs --headed  # fenêtre visible
```

Prérequis : Playwright (`/opt/node22/lib/node_modules/playwright`, ou `PLAYWRIGHT_MODULE=…`) et Chromium
(`/opt/pw-browsers`, ou `PLAYWRIGHT_BROWSERS_PATH=…`). Le test charge le jeu, clique pour débloquer l'audio,
lance une run Cendrelune/Wren sans tutoriel, mesure 3 s de référence, puis saute à la minute 10
(`world.time`), donne un build complet (`debugGiveWeapon`), rend le sonneur invulnérable, bloque les montées
de niveau et injecte 380 ennemis ; il mesure ensuite `loop.stats` (fps, frameMs, updateMs, renderMs, entités)
pendant 10 s. Échec (code 1) si une erreur console, une erreur de page, une réponse ≥ 400 ou une requête
échouée est observée. Le fps mesuré en headless (rendu logiciel SwiftShader) est indicatif : à confirmer sur
une machine réelle.
