# CARILLON — rapport de playtest et d'équilibrage (agent G)

Date : 2026-09-04. Périmètre : valeurs de `src/data/*.json` et `tests/**`. Aucun `.js` hors `tests/` n'a été
modifié ; les bugs JS sont **rapportés** (§ 6), pas corrigés. JSON bruts des mesures : `tests/results/`
(`before.json` = valeurs d'origine rejouées avec le robot final, `after.json` = valeurs livrées).

## 1. Résumé

- La boucle « niveau ≈ 5 à 90 s / 12 à 4 min / 25 à 12 min » est atteinte (5 / 11,2 / 24–26 selon le profil).
- DPS mono-cible des 9 Timbres : niv 1 = 16–22, niv 7 = 99–108 (±5 %), contre 72–128 avant.
- Un joueur moyen (50 % de « bon ») gagne Cendrelune 4 fois sur 5, arrive au boss avec 76 % de PV en moyenne et le
  bat en 16–71 s (moyenne 48 s ; un humain, moins efficace que le robot, se situera dans les 60–90 s visés).
- Le mode « Sans rythme » permet la victoire (2/5 avec le robot, qui esquive mal les anneaux du boss ; voir § 7).
- Un joueur qui joue mal meurt entre la minute 5,8 et 10 (4 morts sur 5).
- Bronze : défaite 54–204, victoire 356–432 (cibles 40–120 / 250–400 : la victoire est au bord haut,
  `bronzeReward` de Cendrelune a été baissé à 100).
- Arbre du Beffroi : 4 860 de bronze pour les 14 nœuds (+ 900 pour les 3 sonneurs) ; premier achat à 30.
- **Le Muet est injouable en l'état** (0 tué en 12 min : le Diapason ne fait aucun dégât et rien d'autre ne tue),
  correction JS nécessaire (§ 6.1). Avec une seconde arme au départ, il est au niveau des autres sonneurs.
- Les fusions sont statistiquement inaccessibles en 12 min (0 fusion sur 60 runs, même en les visant) : § 6.6.
- 7 bugs JS à transmettre (§ 6), dont : boss vulnérable pendant son intro, requête de grille imbriquée qui casse
  Tonnerre/Carillon, ids `carillon_pickup`/`parry` affichés comme des Timbres au bilan.

## 2. Méthode

`tests/sim.mjs` rejoue le vrai code de `src/game/**` sous Node (stubs de l'entrée, de l'audio et du rendu),
à pas fixe 60 Hz, avec un joueur robot déterministe (voir `tests/README.md`). Profils : `parfait` (100 %
parfait), `moyen` (10 % parfait / 50 % bon / 40 % raté), `norhythm` (Sans rythme, cran 2 fixe), `passif`
(cartes « première proposée », 80 % de ratés, se tourne rarement vers l'ennemi). 5 seeds par cellule.
Le robot est **plus efficace qu'un humain moyen** (il se tourne vers l'ennemi au tick exact du tir, ramasse
tout, ne panique pas) : les marges mesurées sont des bornes hautes. Sa faiblesse : il esquive mal les anneaux
de projectiles du boss et fuit les grosses foules au lieu de les traverser (cas « timeout » : boss non vaincu
dans les 2 min 30 imparties, avec un joueur vivant).

Run réelle du lead (Wren, Volée sur chaque temps, frappes parfaites) : niveau 2 à 92 s, 15 tués, 40/100 PV,
77 ennemis. Le profil diagnostic `lead` (dash à chaque temps) donne niveau 5 et 83 tués à 90 s : l'écart vient
du fait qu'un dash permanent éloigne des ennemis (Battant : arc de 44 px devant soi) ; le robot se retourne
avant chaque coup, un humain qui dashe à chaque temps ne le fait pas. D'où : portée du Battant 44 → 52 px, et
la proposition § 7.1 (le Contre-battement, immobile, est la frappe rythmique « de combat » ; le tutoriel doit
le dire).

## 3. Avant / après (Wren, Cendrelune, 5 seeds par ligne)

### 3.1 Valeurs d'origine (`before.json`)

| sonneur/profil | n | vict. | morts | min. mort | niv 90 s | niv 4 min | niv 12 min | PV % au boss | boss (s) | tués | réso | bronze |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| wren/parfait | 5 | 4 | 0 | – | 4.6 | 11.6 | 29.4 | 100 | 9 | 2416 | 2.5 | 388 |
| wren/moyen | 5 | 5 | 0 | – | 5 | 11.6 | 29 | 100 | 25.5 | 2554 | 2 | 458 |
| wren/norhythm | 5 | 4 | 0 | – | 5 | 11.6 | 28.8 | 94 | 26.2 | 2458 | 1.8 | 355 |
| wren/passif | 5 | 1 | 4 | 8.5 | 5 | 11.5 | 23.5 | 63.5 | 142.5 | 1563 | 1 | 167 |
| le_muet/* (4 profils) | 20 | 0 | 19 | 3.3–9.7 | 1 | 1 | 1 | – | – | 0.2 | – | 28–61 |

(« boss (s) » = durée entre `run:boss start` et la mort ; avant correction du bug § 6.2 le boss perd déjà des PV
pendant son intro, ce qui raccourcit ces durées.)

### 3.2 Valeurs livrées (`after.json`)

| sonneur/profil | n | vict. | morts | min. mort | niv 90 s | niv 4 min | niv 12 min | PV % au boss | boss (s) | tués | réso | bronze |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| wren/parfait | 5 | 4 | 1 | 12.2 | 4.8 | 11.4 | 26.2 | 86 | 28.7 | 2462 | 2.5 | 351 |
| wren/moyen | 5 | 4 | 0 | – | 5 | 11.2 | 24.2 | 76 | 48.1 | 2888 | 2 | 305 |
| wren/norhythm | 5 | 2 | 1 | 12.4 | 5 | 11.4 | 26 | 100 | 30 | 2746 | 1.8 | 184 |
| wren/passif | 5 | 0 | 4 | 8 | 5 | 11 | 22 | 100 | – | 1474 | 1 | 55 |
| le_muet/moyen (tel quel) | 2 | 0 | 2 | 11.5 | 1 | 1 | 1 | – | – | 1 | 2.1 | 61 |
| le_muet/moyen (+ Clarine au départ, § 6.1) | 5 | 3 | 1 | 12.7 | 5 | 11.2 | 26 | 100 | 49 | 2796 | 2.3 | 278 |
| le_muet/norhythm (+ Clarine) | 5 | 1 | 2 | 12.8 | 5 | 11.2 | 25.8 | 72 | 37 | 2841 | 1.8 | 140 |
| osric/moyen | 3 | 3 | 0 | – | 5 | 11.3 | 26 | 100 | 20.6 | 2572 | 1.9 | 375 |
| maren/moyen | 3 | 2 | 1 | 12.5 | 5 | 11.7 | 27.3 | 100 | 73 | 2735 | 1.9 | 356 |

Les cases « victoires < 5 sans mort » sont des timeouts du robot (boss vivant après 2 min 30, joueur vivant, en
général dans une foule de 120–200 ennemis avec un build sans arme à longue portée) : voir § 7.3.

Courbe type (moyen, seed 4) : niveau 2 à 30 s, 5 à 90 s, 8 à 150 s, 11 à 240 s, 16 à 390 s, 20 à 510 s,
23 à 660 s, 25 à 720 s ; PV 100 → 34 (minimum à 574 s) → 50 à l'arrivée du boss.

### 3.3 Courbes de niveau visées / obtenues (moyen)

| instant | cible | avant | après |
|---|---|---|---|
| 90 s | 5 | 5 | 5 |
| 4 min | 12 | 11.6 | 11.2 |
| 12 min | 25 | 29 | 24.2 |

### 3.4 DPS théorique (Résonance ×1, `tests/dps.mjs`)

| arme | seul niv 1 av→ap | seul niv 7 av→ap | groupe (12) niv 1 av→ap | groupe niv 7 av→ap |
|---|---|---|---|---|
| battant | 21 → 22 | 72 → 99 | 62 → 67 | 720 → 992 |
| clarine | 16 → 16 | 115 → 108 | 96 → 96 | 793 → 741 |
| bourdon | 20 → 20 | 88 → 99 | 240 → 240 | 1056 → 1190 |
| grelots | 26 → 22 | 128 → 102 | 26 → 22 | 147 → 128 |
| tocsin | 16 → 16 | 88 → 99 | 192 → 192 | 1056 → 1190 |
| cor_de_brume | 22 → 22 | 112 → 104 | 22 → 22 | 168 → 156 |
| crecelle | 19 → 19 | 115 → 102 | 19 → 19 | 130 → 115 |
| chaine_d_angelus | 22 → 22 | 115 → 102 | 67 → 67 | 691 → 512 |
| diapason (gain sur un Battant 7) | – | 50 → 69 | – | 488 → 675 |
| glas / carillon / tonnerre (fusions, niv 1) | – | 80 / 91 / 96 | – | 960 / 814 / **96** (bug § 6.3) |

Cible : niv 1 ≈ 15–25, niv 7 ≈ 80–120 homogène à ±15 % → obtenu 16–22 et 99–108 (±5 %). Les écarts « groupe »
sont voulus (aura/onde/arc = zone, grelots/cor/crécelle = mono-cible ou ligne).

En run, la Chaîne d'Angélus reste l'arme dominante (260–420 DPS crédités) : elle touche à 160 px puis rebondit à
220 px, donc tue avant que les autres armes n'atteignent ; ses rebonds ont été réduits (2+1+2 → 2+1+1). Les
Grelots dominent aussi certains builds (300+). Ce sont des mesures « qui tue en premier », pas des DPS potentiels.

## 4. Changements de valeurs (JSON)

`waves.json → balance`
- `xp` : base 20 → 22, perLevel 6 → 4, growth 1.02 → 1.06 (cumul pour le niveau 5 : 120 → 124 ; 12 : 623 → 663 ;
  25 : 2 880 → 4 003). La fin de run demandait trop peu d'XP par niveau (niveau 29 à 12 min).
- `enemyHp.damagePerTier` 1.12 → 1.16 (dégâts ×2,1 au palier 6 au lieu de ×1,76) ; `spawn.densityPerTier`
  0.25 → 0.30 (densité ×2,5 au palier 6). Objectif : marge ≈ 30 % pour le joueur moyen, mort possible dès la
  minute 6 en jouant mal. `perTier` (PV) inchangé à 1.35.
- `bronze` : perKill 0.05 → 0.03, perResonance 40 → 30.

`weapons.json` (voir § 3.4) : Battant portée 44 → 52, dégâts 13 → 14 et niveaux +8/+14/+26 ; Clarine +7/+8/+8 ;
Bourdon +9/+12/+16 ; Grelots base 7, niveaux +3/+3/+3 (et plus de « damage: 0 ») ; Tocsin +7/+9/+14/+22 ;
Cor de Brume +9/+12/+16 ; Crécelle +3/+3/+4 ; Chaîne +5/+6/+7 et rebonds +1/+1.

`enemies.json` : `bourdon_fele` PV 4 000 → 16 000, dégâts 20 → 10 ; `veuve_suie` 4 200 → 24 000, 24 → 12 ;
`maitre` 4 500 → 24 000, 22 → 13. Justification : avec 4 Timbres niveau 5–7 et la Résonance (×1,8–2,5), un
build de minute 12 sort 300–700 DPS mono-cible ; 4 000 PV tombaient en 3–25 s. Les **dégâts** des boss sont
multipliés par le palier (× 2,1 à la minute 12, § 6.4) : 20 devenait 42 par anneau, d'où des morts au boss
même en « Sans rythme ». À 10 (→ 21), le boss reste dangereux (deux morts sur 15 runs) sans être injuste.
La cible « ≈ 4 000 PV » du brief n'est compatible ni avec « 60–90 s » ni avec « 80–120 DPS par arme au
niveau 7 » ; la durée a été retenue comme cible.

`parishes.json` : `bronzeReward` Cendrelune 120 → 100.

`upgrades.json` : tous les coûts × 0,6 (arrondis à 10) ; total 8 120 → 4 860, premier nœud 50 → 30.
Avec ~215 de bronze par run en moyenne (mélange de victoires et de défaites), l'arbre complet + les 3 sonneurs
(900) ≈ 27 runs ; le premier achat (30) est acquis dès la première défaite (54–84).

Inchangés (jugés corrects) : `passives.json`, `fusions.json`, `characters.json`, `achievements.json`, tables de
spawn des paroisses, `resonance`, `player`, `pickups`, `cards`, `cadence`.

## 5. Paroisses, sonneurs, hauts-faits

Paroisses (Wren moyen, 3 seeds, Beffroi niveau « 2 runs » : cœur de bronze 2, battant lourd 1, ferrure 1) :

| paroisse | vict. | morts | niv 90 s / 4 min / 12 min | PV mini moyen | boss (s) |
|---|---|---|---|---|---|
| Cendrelune | 4/5 | 0 | 5 / 11.2 / 24.2 | 51 | 48 |
| Les Tourbes | 3/3 | 0 | 6 / 13.7 / 28 | 45 | 42 |
| Val-des-Cordes | 3/3 | 0 | 6 / 13 / 28 | 18 | 46 |
| La Nef Noyée | 3/3 | 0 | 6.7 / 12 / 27.3 | 23 | 36 |
| Le Beffroi Mère | 0/3 | 3 (12.3 min) | 7.3 / 14.7 / 30 | 40 | non vaincu |

Les tables de spawn existantes échelonnent bien : XP et danger montent ensemble (+20 à +45 % d'ennemis par
paroisse), la foule atteint le plafond de 400 à la Nef Noyée, le Beffroi Mère tue au boss à chaque fois
(le Maître combine charge, cônes et anneaux ; 24 000 PV). Le « +25 % par paroisse » est difficile à
isoler puisque le joueur monte aussi plus vite ; proposition § 7.4 (multiplicateur explicite par paroisse).

Sonneurs : Osric (130 PV, Bourdon) est le plus sûr (3/3, boss en 21 s : onde + Résonance) ; Maren (90 PV,
Grelots) 2/3 ; Le Muet : § 6.1.

Hauts-faits obtenus par le robot sur 20 runs Wren : premiere_aube, cent_echos, mille_silences,
resonance_parfaite, fele_vaincu, plein_timbre, plein_accord, sans_rythme_victoire, sans_faute (profil parfait :
le Contre-battement compte comme frappe, 0 raté est atteignable). Feuillets : f01–f05, f07, f09, f14, f19.
Non atteints en 12 min : premiere_fusion / quatre_fusions (§ 6.6) et, par construction, ceux des autres
paroisses/sonneurs. `sonneur_confirme` (10 runs), `feuillets_complets` (24, dont f24 = Beffroi Mère avec Le
Muet) et `muet_victoire` dépendent de la correction § 6.1.

## 6. Bugs à transmettre (aucune correction faite ici)

### 6.1 Le Muet ne peut rien tuer (bloquant) — D
- `src/game/weapon-behaviors.js:247` (`mark`) : le Diapason marque sans infliger de dégâts, et
  `src/game/game.js:55` ne donne que `startWeapon`. Aucune autre source d'XP : `pickup:xp` n'est émis qu'à la
  mort d'un ennemi (`pickups.js:dropFor`). Scénario : Le Muet, n'importe quel profil → 0 tué, niveau 1, mort entre
  3 et 11 min (20/20 runs). `muet_victoire`, f12, f24 et `tous_sonneurs` sont inaccessibles.
- Propositions : (a) `characters.json` accepte `startWeapons: ["diapason", "clarine"]` (lu par `game.js`) —
  testé par simulation avec `--secondWeapon clarine` : Le Muet rejoint la courbe des autres (niveau 5/11/26,
  3 victoires sur 5) ; ou (b) la marque « résonne » : à chaque temps, un marqué subit `markBonus × 10 ×
  Résonance` (dégâts indirects, cohérent avec « 0 dégât direct ») ; (a) est immédiat, (b) plus fidèle au brief.

### 6.2 Le boss encaisse des dégâts pendant son intro — D
- `src/game/boss.js:83` (`updateBossEnemy` : `aiState === -1` ne fait que couper le flash) ;
  `src/game/collision.js:47` (`damageEnemy`) ne teste pas l'intro. Scénario : Wren moyen seed 2 (valeurs
  d'origine), trace `--trace boss` : 4 000 → 1 285 PV entre 720,27 s et 722,5 s, `run:boss start` émis à
  1 285 PV, boss mort 1,3 s après le début « officiel ». Proposition : `if (enemy.boss && enemy.aiState === -1)
  return 0;` en tête de `damageEnemy`, ou `vulnMult = 0` pendant l'intro.

### 6.3 Requête de grille imbriquée : Tonnerre ne touche qu'une cible, Carillon perd ses rebonds — C/D
- `src/core/grid.js:26` : `visit()` incrémente un `stamp` partagé ; une requête lancée **depuis le callback**
  d'une autre requête (`weapon-behaviors.js:46` `instantHit → chainFrom → nearestEnemy → grid.query`, et
  `collision.js:103` `projHit → orbitBounceHit → chainFrom`) change `stamp` et marque les ennemis restants :
  la requête externe les saute. Mesure : Tonnerre = 96 DPS sur 12 cibles en anneau (= mono-cible), là où
  Bourdon 7 fait 1 190. Proposition : différer les chaînes (file d'ennemis touchés, traitée après la requête)
  ou sauver/restaurer `stamp` dans `visit()` (réentrance).

### 6.4 Les dégâts des boss et des élites suivent le palier de Sourdine, pas leurs PV — D (design)
- `src/game/enemies.js` (`spawnEnemy`) : `maxHp` exempte `def.boss`, `damage` non. À la minute 12, ×2,1 :
  un anneau du Bourdon Fêlé faisait 42 PV (20 × 1,16⁵). Contourné par des dégâts de base plus bas dans
  `enemies.json` ; à trancher : exempter les boss du `damagePerTier` ou garder l'échelle (les valeurs livrées
  supposent qu'elle reste).

### 6.5 `carillon_pickup` et `parry` apparaissent dans le bilan comme des Timbres — D/E
- `src/game/pickups.js:21` (source `'carillon_pickup'`) et `src/game/collision.js:132` (`o.weaponId = 'parry'`)
  alimentent `weapons.recordDamage` → `RunStats.dpsByWeapon` ; `src/ui/results.js:83` affiche
  `t('weapon.carillon_pickup.name')` (clé absente → texte brut + avertissement `[atlas] icône inconnue`).
  Scénario : toute run où un Carillon (ramassable) ou une parade de projectile a porté (fréquent : 0,3 % des
  morts lâchent un Carillon, 7–8 par run). Proposition : ne créditer que les ids de Timbre/fusion, ou filtrer
  dans `results.js`.

### 6.6 Les fusions sont inaccessibles en une run — D (design)
- `src/game/cards.js:47-55` : poids uniformes (60 par carte de Timbre, 40 par Accord) sur ~17 candidats.
  Pour fusionner il faut ~6 tirages de la même arme et 5 du même Accord ; sur 24 montées, l'espérance est
  de 5 et 3,4. Résultat : 0 fusion sur 60 runs, y compris 5 runs avec la stratégie « viser une fusion »
  (Clarine 6–7 / Écho 1–3). `premiere_fusion`, `quatre_fusions`, f13, f22 sont donc quasi impossibles.
  Propositions : pondérer ×2 les cartes d'un objet déjà possédé et non maxé ; ou proposer la fusion dès
  arme ≥ 5 et Accord ≥ 3 ; ou garantir une carte « montée d'un objet possédé » parmi les trois. Aucune de ces
  options n'est réglable par JSON (`weaponWeight`/`passiveWeight` sont globaux).

### 6.7 `Math.random` hors `src/audio` (règle du lead) — C/E
- `src/render/fx.js:84` (jitter des nombres de dégâts), `src/ui/hub.js:79` et `src/ui/menu.js:105` (seed de
  run), `src/ui/menu.js:49` (braises du titre). Aucun n'affecte le gameplay seedé ; le seed de run tiré au
  hasard est légitime mais pourrait passer par `hashSeed(Date.now())` pour être traçable. Seul KO de
  `tests/checks.mjs` (76/77).

### 6.8 Observations mineures
- `weapons.json` Grelots niveau 7 avait `"damage": 0` (delta nul) : nettoyé.
- Le Contre-battement (parade) n'a aucun coût ni recharge notable (`parrySec` 0,2 s) : il suffit de le
  presser tous les deux temps pour saturer la Résonance sans bouger. Le robot en profite (600 parades par
  run). Volontaire ? Sinon : recharge de 1 temps, ou gain de Résonance réduit pour une parade « à vide ».
- La Résonance sature vite : gain +1 (bon) / +2 (parfait), perte −1,5 (raté) ⇒ tout joueur au-dessus de 60 %
  de réussite reste au cran 3 (moyen : ×2,0 de moyenne, parfait ×2,5, Sans rythme ×1,8). Les trois profils
  ont donc presque la même puissance ; si l'on veut une jauge plus vivante : `lossRate` 2 et `decayAfterBeats` 2.

## 7. Propositions et limites

1. Tutoriel / HUD : dire que le Contre-battement (Shift/clic droit) est la frappe rythmique **sur place** ; le
   dash à chaque temps du lead explique son niveau 2 à 92 s. Alternative JSON : réduire `player.dashSpeed` 380
   → 300 (54 px au lieu de 68) pour que la Volée reste une esquive, pas un déplacement.
2. Boss : après correction de 6.2, revérifier la durée (`node tests/sim.mjs --matrix --profiles moyen`) ; les
   PV (16 000) sont calés sur le robot, qui bat le Bourdon Fêlé en 16–71 s ; si les humains dépassent 90 s,
   redescendre à 13 000.
3. Timeouts « foule » : avec un build sans arme longue (Tocsin + Grelots + Clarine), 120–200 ennemis vivants
   dès la minute 9 et le boss n'est jamais joint. C'est en partie le robot (il fuit au lieu de tenir l'aura),
   mais aussi le signe que les auras à 64–93 px ne suivent plus le flux de 5 ennemis/s au palier 6 ; si les
   humains le confirment : `spawn.densityPerTier` 0.30 → 0.25 ou caps des `feutre`/`choeur_muet` réduits.
4. Difficulté par paroisse : ajouter un multiplicateur explicite (`waves.<paroisse>.difficulty`, appliqué aux PV
   et dégâts) plutôt que des tables de spawn seules, pour tenir le « +25 % par paroisse » indépendamment de l'XP.
5. Diapason / Requiem au banc : +69 DPS mono-cible sur un Battant 7 (marque +50 % → +80 % au niveau 7) — utile
   mais jamais un premier choix ; après 6.1, envisager `markBonus` 0,5 → 0,6.

## 8. Performance (`tests/perf.mjs`, Chromium headless, rendu logiciel SwiftShader, 1440×810)

- Démarrage : 1,4 s ; **0 erreur console, 0 erreur de page, 0 réponse ≥ 400, 0 requête échouée**.
- Référence (début de run, 2 entités) : frame 1,35 ms (update 0,23, rendu 1,12).
- Minute 10, build complet, 380 ennemis injectés (305 vivants), 113 projectiles, 3 146 particules,
  737 entités en moyenne (max 803) : frame 17,7 ms en moyenne (p95 73 ms), update 9 ms, rendu 8,7 ms.
  Le compteur de fps (3,7) n'est pas significatif en headless (rAF non synchronisé, 14 fps au repos) ; c'est
  `frameMs` qui compte : 17,7 ms est à la limite des 16,7 ms d'un 60 fps, sur un rendu **logiciel**. À mesurer
  sur une machine réelle avec GPU (`node tests/perf.mjs --headed`).
- Capture : `/tmp/carillon-perf-minute10.png`.

## 9. Contrôles statiques (`tests/checks.mjs`) : 76/77

Tout passe (JSON, registre § 10 bis, i18n fr/en et ui-fr/ui-en, 181 clés `t('…')` du code, sprites, tuiles,
icônes, bruitages, pistes, presets de particules, fichiers des manifestes, fichiers ≤ 400 lignes, aucun
OscillatorNode, aucun alert/prompt/confirm, aucune chaîne française en dur), sauf `Math.random` hors
`src/audio` (§ 6.7).
