# SALLE ZÉRO — Plan Phase 1 (à valider avant tout code)

> Nom de travail. Sera renommé une fois le lore posé.
> Ce document est le livrable de l'étape 1 (§13). Rien n'est codé tant qu'il n'est pas validé.

---

## 0. Emplacement dans le dépôt

Le dépôt héberge déjà **Crypte Infinie** (`index.html` à la racine) et **TERRA NOVA** (`terra-nova/`).
Proposition : le nouveau jeu vit dans **`salle-zero/`** avec :

```
salle-zero/
  index.html      ← le jeu, un seul fichier (Canvas 2D, JS vanilla, Web Audio, localStorage)
  assets/         ← uniquement si le base64 dépasse ~4 Mo (voir §5)
  PLAN.md         ← ce document
  LORE.md         ← livrable Agent Lore
  CONTENT.md      ← livrable Agent Design de contenu
  ASSETS.md       ← livrable Agent Assets
  CREDITS.md      ← crédits sprites + musiques
  TEST-REPORT.md  ← livrable Agent Test
```

Rien de Crypte Infinie n'est réutilisé tel quel (autre boucle, autre architecture), mais ses
contrôles tactiles pourront servir de référence en phase 2 si un mode mobile est voulu.

---

## 1. Réponses proposées aux questions du §14

Je pars sur ces défauts si tu ne dis rien ; corrige ce qui ne va pas.

| Question | Proposition | Pourquoi |
|---|---|---|
| Contrôles | **ZQSD/WASD + visée souris**, clic gauche = attaque, clic droit ou `E` = compétence active, `Espace` = dash si la compétence est un dash, sinon rien. Manette **prévue** dans l'abstraction `Input` (axes + boutons nommés) mais non branchée en phase 1. | Les patterns "Gungeon" demandent une visée libre. |
| Vue | **Top-down pur** (pas de 3/4). | Les pièges sont des puzzles de timing : une lecture plane sans ambiguïté de profondeur est indispensable. |
| Sprites | **Pixel art 16×16 rendu ×3** (personnage/ennemis en 16×16 ou 32×32 selon pack, tuiles 16×16), `imageSmoothingEnabled = false`. | Beaucoup plus de packs CC0 cohérents en 16 px (Kenney, 0x72 Dungeon Tileset II). |
| Résolution logique | **1280×720**, mise à l'échelle letterbox dans le canvas. Salle jouable = 1280×720 moins les murs (tuiles de 48 px → grille 26×15 dont 24×13 jouable). | Le brief propose 1280×720 ; la grille en tuiles donne un placement de pièges lisible. |
| Langue | **Français uniquement**, mais toutes les chaînes UI passent par une table `STR` pour permettre une traduction plus tard. | Coût nul maintenant, gain plus tard. |
| Poids max HTML | Cible **≤ 3 Mo** pour `index.html` avec sprites en base64 ; les **musiques vont dans `assets/`** (un OGG de 2-3 min pèse 2-4 Mo, trois pistes en base64 feraient exploser le fichier). Si tu veux le mono-fichier strict, on passe sur la musique générative organique (§8 du brief). | Un fichier de 3 Mo s'ouvre instantanément en local ; 12 Mo commence à ramer à l'ouverture. |

Questions supplémentaires (défauts entre parenthèses) :

1. **Salle 1 "Préparation + Combat"** : le choix arme/compétence se fait sur un écran avant le combat, puis la salle se remplit de 2-3 vagues. OK ? (défaut : oui)
2. **Mort en run** : retour au hub avec l'argent gagné jusque-là **intégralement** ou **à 50 %** ? (défaut : 100 % des pièces déjà ramassées, aucun bonus de fin de niveau)
3. **Argent** : gagné **uniquement en fin de niveau** (brief §1) ou aussi par pièces lâchées par les ennemis ? (défaut : les deux, avec la fin de niveau comme grosse part)
4. **Sauvegarde** : une seule slot localStorage ; le mode Test n'écrit jamais dans la sauvegarde Normal. (défaut : oui)
5. **Mobile** : hors phase 1. (défaut : oui, hors scope)

---

## 2. Architecture technique (un fichier, modules internes)

Tout dans `index.html`, en IIFE nommées pour garder des frontières nettes. Aucune dépendance, aucun build.

| Module | Responsabilité |
|---|---|
| `Engine` | Boucle à **pas fixe** (accumulateur, `dt = 1/60`), rendu découplé avec interpolation légère, gestion du canvas 1280×720 mis à l'échelle, `Input` (clavier + souris, abstraction manette), `Time.scale` (pour le ralenti et pour `__autoplay`). |
| `Room` | `RoomType` enum complet (PREP_COMBAT, TRAP, COMBAT_TRAP, CHEST, MINIBOSS, COMBAT_MODULAR, COMBAT_TRAP_MODULAR, CHEST_FINAL, BOSS_REVENGE). Chargement d'une définition de salle (layout en tuiles, spawns, pièges, `modularElements[]`), transitions (portes, fondu), vagues. Les types 6-9 sont déclarés et refusent de se charger avec un message clair. |
| `Entities` | `Player`, `Enemy` (machine à états par archétype, télégraphie), `Projectile`, `Trap` (pattern déterministe piloté par le temps de salle), `Pickup` (XP, pièces, fragments), `Decor` (éléments animés avec collision, pour les salles modulaires). Collisions cercle/cercle et cercle/AABB, grille spatiale uniforme. |
| `Content` | Toutes les données §5-6 en objets déclaratifs avec `id` stable : `CHARACTERS`, `WEAPONS`, `SKILLS`, `UPGRADES`, `META_PASSIVES`, `BIOMES` (passifs de niveau), `ENEMIES`, `BOSSES`, `TRAPS`, `ROOMS`. Les effets sont exprimés comme des **modificateurs de stats** (`{stat:'damage', mul:1.15}`) ou des **hooks nommés** (`onDash`, `onKill`, `onHit`, `onTrapDamage`) que le moteur appelle. Aucune logique de gameplay ne vit dans `Content`. |
| `Progression` | XP et courbe de niveaux, tirage pondéré des raretés (avec passif *Chance*), plancher des coffres, **score de salle** (dégâts subis / temps / combo) et moyenne pour les coffres, forçage de rareté (debug). |
| `Meta` | Hub, argent, achat des passifs méta (paliers), déblocage armes/personnages, sauvegarde localStorage versionnée (`{v:1, ...}`), séparation stricte Normal / Test. |
| `AudioEngine` | Bruit filtré + enveloppes, FM/AM, waveshaper, réverbe par convolution (IR générée), couches transitoire/corps/queue, variation aléatoire ±5-10 %. Une fonction par événement. Musique : lecture `assets/*.ogg` avec crossfade, ou fallback génératif organique. |
| `UI` | Écrans DOM superposés au canvas (menu, hub, prépa, level-up, coffre, pause, crédits, game over) en style sombre/néon/glassmorphism. Rareté = couleur de bordure + libellé. HUD sur canvas (PV, XP, jauge de qualité de run, cooldown, salle N/9). |
| `Debug` | Panneau `F1` : curseur difficulté 0.5×-3×, sélecteur de salle, multiplicateurs XP/argent, forçage de rareté, invulnérabilité, tuer tout, spawn ennemi/piège, hitboxes, scores de salle en direct, écran de test audio. Actif seulement en mode Test. |
| `Autoplay` | `window.__autoplay(config)` : bot (déplacement vers/évitement, tir vers l'ennemi le plus proche, choix aléatoires), `Time.scale` jusqu'à 20×, rendu optionnel, retourne un objet de stats. |

Déterminisme : les pièges lisent `room.time` (temps écoulé depuis l'entrée, en pas fixes), jamais `Date.now()`. Le RNG est un PRNG seedable (mulberry32) pour que `__autoplay` soit reproductible.

---

## 3. Jalons et critères de "ça marche"

| # | Jalon | Livrable testable |
|---|---|---|
| 1 | **Ce plan** | Validation. |
| 2 | Agents Lore + Contenu en parallèle | `LORE.md`, `CONTENT.md` avec toutes les tables chiffrées → **validation**. |
| 3 | Moteur minimal | Salle vide, joueur, arme de base, 1 ennemi rusher, HUD. Jouable au clavier. |
| 4 | Salles 1-3 | 6 ennemis + 6 pièges du biome 1, vagues, level-up à 3 choix, fragments d'énergie en salle 2. |
| 5 | Salles 4-5 | Score de salle, coffre avec plancher de rareté, mini-boss à 2-3 patterns + faiblesse. |
| 6 | Méta | Hub, argent, 15+ passifs méta, 2 personnages, modes Normal/Test, panneau debug, sauvegarde. |
| 7 | Audio + assets | `AudioEngine` + écran de test audio, sprites intégrés, musiques, `CREDITS.md`. |
| 8 | Test + équilibrage | `__autoplay` exploité par l'Agent Test, `TEST-REPORT.md`, liste phase 2. |

À chaque jalon : un commit poussé + un message court (ce qui marche / ce qui manque / comment tester).

---

## 4. Sub-agents : briefs prévus (un aller, un livrable)

1. **Agent Lore** → `LORE.md`. Piste recommandée : **l'installation d'essai** (le sujet est un prototype, les améliorations sont des greffes instables, le boss revanche est *la même entité qui a appris de vous*). Elle justifie naturellement : les salles (protocoles d'essai), les coffres (réserves de greffes des sujets précédents), l'argent (crédits de l'installation), les passifs de niveau (conditions d'essai imposées par étage), les personnages (autres prototypes). Livrables : synopsis 10 lignes, 5 fragments, nom du jeu, biome 1 détaillé, justification boss revanche + passifs de niveau.
2. **Agent Design de contenu** → `CONTENT.md`. Tables chiffrées : 2 personnages, 6+ armes, 6+ compétences, 40+ améliorations (réparties Commun/Rare/Épique/Colossal), 15+ passifs méta à paliers, 3 paires bonus/malus biome 1, 6 ennemis + mini-boss (patterns + faiblesse + version revanche décrite), 6+ pièges avec paramètres de pattern. Il reçoit le schéma de données de `Content` pour que ses tables se transposent directement.
3. **Agent Assets** → `ASSETS.md` + fichiers. Packs CC0 ciblés en priorité : 0x72 Dungeon Tileset II, Kenney (Tiny Dungeon, Particle Pack, UI Pack), et musiques CC0/CC-BY (Kevin MacLeod, OpenGameArt, Pixabay). Livre licences + liens + fichiers récupérés.
4. **Agent Audio** → module `AudioEngine` + écran de test audio, avec la contrainte "aucun son oscillateur nu".
5. **Agent Test** → `TEST-REPORT.md` après les jalons 5, 6 et 8, via `__autoplay`.

Moi : architecture, moteur, intégration, arbitrage, cohérence.

---

## 5. Risques identifiés et parti pris

- **Poids** : sprites base64 OK, musiques non. D'où `assets/` pour la musique (ou génératif). À trancher (§1).
- **Assets réseau** : la récupération de packs dépend de l'accès réseau de l'environnement. Si un asset est inaccessible, placeholder Canvas marqué `TODO_SPRITE` et lien dans `ASSETS.md` pour le récupérer à la main.
- **Volume de contenu** (40 améliorations, 15 passifs, 6 armes…) : tout est en données, donc l'ajout est linéaire, mais l'équilibrage sera grossier en phase 1. L'Agent Test sert à ça.
- **Déterminisme des pièges** avec `Time.scale` : le pas fixe garantit le même pattern quel que soit le scale ; le rendu peut sauter des frames, c'est accepté.

---

## 6. Ce que j'attends de toi

- Valider ou corriger le tableau du §1 (surtout : **musique dans `assets/` ou génératif ?**).
- Valider l'emplacement `salle-zero/`.
- Valider l'ordre des jalons. Ensuite je lance les Agents Lore + Contenu.

---

## 7. État à la fin du jalon 7 (moteur + contenu + audio + assets intégrés)

**Ce qui marche** (testé dans Chromium headless via `window.__autoplay` et par entrées clavier/souris simulées) :
- Menu → Mode Normal / Mode Test → hub (sujets, palier, boutique passifs/armes/fragments) → préparation (bonus/malus tirés, arme parmi celles débloquées, 1 compétence parmi 2) → salles 1 à 5 → fin de niveau ou mort → hub.
- 8 armes, 8 compétences, 51 greffes en 4 raretés, 16 passifs méta à paliers, 7 ennemis + Étalon 07 (2 phases, faiblesse dorsale), 8 pièges déterministes, scores de salle et plancher de coffre, checkpoint des crédits en salle 4, règle des 10 % par salle en cas de mort, 5 fragments de lore à débloquer.
- Panneau debug F1 (mode Test) : difficulté, saut de salle, multiplicateurs, rareté forcée, invulnérabilité, spawn, hitboxes, scores, test audio, autoplay.
- `AudioEngine` organique (37 sons), musiques CC-BY avec repli génératif, sprites CC0 avec placeholders `TODO_SPRITE`.

**Prévu, non implémenté** (architecture en place) : salles 6-9 (`ROOM_TYPES` phase 2, `modular[]` par salle, crochet `Modular.update`), boss revanche (`bosses[].revenge`), *Mémoire sélective* (n'agit qu'au coffre 8), manette (`Input` abstrait), mobile.

**Comment tester** : `cd salle-zero && python3 -m http.server 8765`, ouvrir `http://localhost:8765/`, Mode Test, F1. Sources dans `dev/`, assemblage `node dev/build.js`.
