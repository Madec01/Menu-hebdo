# CARILLON — tests (agent G : équilibrage & QA)

Tout se lance depuis la racine du projet (`carillon/`) avec Node ≥ 22, sans installation :
les simulations tournent sous Node grâce à des stubs des modules navigateur (`tests/stubs/`),
seul `perf.mjs` a besoin de Playwright et de Chromium.

| Script | Rôle | Commande |
|---|---|---|
| `checks.mjs` | Contrôles statiques (JSON, identifiants § 10 bis, i18n fr/en, assets référencés, règles de code) | `node tests/checks.mjs` |
| `sim.mjs` | Simulation déterministe d'une run complète (12 min + boss) avec un joueur robot | `node tests/sim.mjs --matrix` |
| `dps.mjs` | DPS théorique de chaque Timbre (niv 1 et 7) et de chaque fusion, cible seule et groupe | `node tests/dps.mjs` |
| `perf.mjs` | Run réelle en navigateur, saut à la minute 10, fps/frameMs sur 10 s, 404 et erreurs console | `node tests/perf.mjs` |
| `game-test.html` | Page de test manuelle de l'agent D (`src/game/_test/`), inchangée | `http://localhost:8080/carillon/src/game/_test/game-test.html` |
| `timbres-audio.mjs` | Enregistre à l'oreille (MediaRecorder) 8 mesures de Timbres qui chantent : Battant seul, 4 armes, 6 armes → `tests/results/timbres/` | `node tests/timbres-audio.mjs` |
| `timbres-analyze.py` | Analyse des prises (soundfile/numpy) : hauteurs mesurées vs journal, gamme, variation par mesure, crête < −1 dBFS, ≤ 3 voix par temps | `python3 tests/timbres-analyze.py` |

Résultats de référence (JSON bruts des matrices avant/après) : `tests/results/`. Rapport de playtest : `tests/PLAYTEST.md`.

## checks.mjs — contrôles statiques

```
node tests/checks.mjs          # liste [OK]/[KO] ; code de sortie 1 s'il y a un KO
node tests/checks.mjs --json
```

Vérifie : tous les JSON de `src/data/` et les deux manifestes sont valides ; les identifiants du registre
(sonneurs, Timbres, Accords, fusions et leurs couples, ennemis, boss, paroisses, 14 améliorations, 18 hauts-faits,
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
```

Options : `--seed N`, `--seeds N` (matrice), `--chars a,b`, `--profiles a,b`, `--parish id`,
`--cards honnete|premiere|fusion`, `--upgrades coeur_de_bronze:2,battant_lourd:1`,
`--secondWeapon clarine` (arme supplémentaire au départ : variante « Le Muet corrigé »),
`--weapons N` (Timbres visés par le build, 4 par défaut), `--minutes 14.5`, `--jobs 4`, `--json`, `--quiet`.

Profils du robot (`PROFILES` en tête du fichier) :

| profil | frappes (parfait / bon / raté) | mode | rôle |
|---|---|---|---|
| `parfait` | 100 / 0 / 0 | normal | joueur expert |
| `moyen` | 10 / 50 / 40 | normal | joueur moyen (50 % de « bon ») |
| `norhythm` | aucune frappe rythmique | Sans rythme (cran 2 fixe) | accessibilité |
| `passif` | 0 / 20 / 80, cartes « première proposée », se tourne peu vers l'ennemi | normal | joueur qui joue mal |
| `lead` | 100 / 0 / 0 mais Volée sur chaque temps | normal | diagnostic du style « dash permanent » |

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
