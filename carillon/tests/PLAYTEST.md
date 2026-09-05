# CARILLON — rapport de playtest et d'équilibrage (agent G)

Date : 2026-09-04 (§ 1–9 : agent G ; § 10 : agent P, rythme de la nuit ; § 11 : vague 2, agent G, 2026-09-05). Périmètre G : valeurs de `src/data/*.json` et `tests/**`. Aucun `.js` hors `tests/` n'a été
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

## 10. Rythme de la nuit (agent P) — nuits courtes, variété immédiate, Moments scriptés

Retour du commanditaire : « 12 minutes c'est beaucoup trop long car hyper répétitif ». Constat : Cendrelune
durait 720 s, Feutres seuls pendant 60 s puis un type par minute, deux Fêlures (240 / 480 s), boss à 720 s,
palier toutes les 120 s et rien entre deux paliers. Périmètre : `src/game/spawner.js`, nouveau
`src/game/moments.js`, hooks dans `world.js`, `waves.json`, `enemies.json` (PV des boss), `lore.json`
(minutes), i18n (`moment.<id>.name`, `ui.moment.*`), HUD (bannière + barre de nuit), `run-screen.js`
(accent musical), `tests/sim.mjs`, `tests/checks.mjs`, nouveau `tests/night.mjs`. JSON bruts :
`tests/results/before-rythme.json` (nuit de 12 min rejouée avec le robot actuel, Reliques comprises) et
`tests/results/after-rythme.json` (valeurs livrées).

### 10.1 Ce qui change

- **Durées** (`waves.json → duration`) : Cendrelune 360 s, Les Tourbes 420, Val-des-Cordes 480, La Nef Noyée
  540, Le Beffroi Mère 600. Paliers de Sourdine toutes les 60 / 64 / 68 / 72 / 75 s (6 paliers atteints à
  300–375 s, puis le palier 6 tient jusqu'au boss). Fêlures à 40 % et 70 % de la nuit, boss à 100 %. Cloche
  horaire inchangée (chaque minute). Le HUD (barre de nuit sous le chrono, repères des Fêlures et de l'aube),
  la Sourdine, le bilan et la sim lisent `duration` ; `grep -rn 720 src tests` ne renvoie plus que
  `src/game/_test/game-test.js` (page de test manuelle de D, hors périmètre : son contrôle « 6 paliers, 12
  minutes » est à ramener à `duration`) et la Cloche horaire (`bell-hour.js`, minute 12 → Bronze : n'arrive
  plus qu'au Beffroi Mère si le boss dure ; à faire suivre à D : bonus de la dernière minute = `duration / 60`).
- **Variété dès le début** : 2 types d'ennemis avant 20 s, 3 avant 45 s, 4 avant 90 s dans chaque paroisse,
  ordre propre à chacune et ennemi signature (Tourbes : Rampes de suie dès 12 s et Ouateux à 40 s ; Val :
  Bâillons dès 0 s, en meute ; Nef : Chœur Muet dès 0 s et Fossoyeurs à 35 s ; Beffroi : tout, Cierges à 90 s).
- **Moments scriptés** (`src/game/moments.js`, `waves.<paroisse>.moments`) : toutes les 40–65 s, un événement
  de 12 à 20 s avec bannière HUD (titre en display + sous-titre, entrée/sortie animées, barre de temps
  restant), sfx `bell_tier` (procession, accalmie, cierge errant) ou `silence_cry` (assauts) et accent musical
  (`music.setIntensity` 1 pendant un assaut, 0,1 pendant l'accalmie, retour à 0,5 ensuite ; les crans de
  Résonance ne sont pas touchés). Neuf motifs paramétrés par type, nombre et rayon : `cercle`, `nuee`,
  `meute` (même mesure d'origine → bond synchronisé), `ligne` (salve synchronisée), `pluie_de_suie`,
  `procession` (Échos ×2 tant que dure le moment), `accalmie` (15 s sans flux régulier, Échos ×2 sur tout ce
  qui est vivant, cendres calmées, voile pâle), `cierge_errant` (élite qui fuit via le recul, +25 de Bronze si
  tuée, disparaît sinon), `veuves_en_cercle` (télégraphie puis charge). Chaque paroisse en enchaîne 7 ou 8 dans
  un ordre propre ; instant tiré au rng du run (±8 s), espacement minimal 5 s après le moment précédent ;
  aucun moment ne démarre pendant le Bourdon. Événement `run:moment {id, phase}` ; `balance.moments` porte
  les constantes (jitter, multiplicateurs d'Échos, prime de Bronze, vitesse de fuite, distances de bord).
- **Progression** : `balance.xp` base 22 → 34, growth 1,06 → 1,045 (niveau ≈ toutes les 18–20 s : 5–6 à 90 s,
  10–11 à 3 min, 18–19 à l'aube de Cendrelune). Densité par palier 0,30 → 0,28 et PV par palier 1,35 → 1,32
  (le sonneur arrive au boss au niveau 18–19 au lieu de 25 : la foule du palier 6 a été ramenée pour rester
  franchissable ; les dégâts par palier sont inchangés, 1,16). Soins au sol 3 % → 2 % des morts. Boss :
  `bourdon_fele` 16 000 → 8 000 PV, `veuve_suie` et `maitre` 24 000 → 13 000 (build de niveau 18 au lieu de
  25 ; durée du combat robot 48 s → 45–60 s). Bronze : perMinute 5 → 10, perKill 0,03 → 0,05 (nuit deux fois
  plus courte, mêmes ordres de grandeur : voir tableau).
- **Feuillets** `run_minute` : f01 4 → 2, f02 8 → 4 (Cendrelune), f06 4 → 3 (Tourbes), f11 4 → 3 (Val), f16 et
  f21 restent à 4 (Nef, Beffroi ; nuits de 9 et 10 min). Hauts-faits : aucun n'est lié au temps de nuit
  (`repondre_a_la_cloche` = 10 réponses cumulées, `cent_echos` = 100 Échos par run : atteignables en 6 min),
  valeurs inchangées.
- **Tests** : `sim.mjs` lit `duration` (durée par défaut = nuit + 2 min 30), traverse et liste les Moments,
  colonnes niv 90 s / 3 min / fin ; `checks.mjs` vérifie durées, Fêlures 40/70 %, boss 100 %, variété initiale,
  5–8 Moments toutes les 40–60 s ±8 s de 10–25 s, motifs du registre implémentés dans `moments.js`, clés
  i18n des Moments, Feuillets `run_minute` atteignables ; `night.mjs` (Playwright) joue une vraie run accélérée
  ×3 (`loop.setTimeScale`), prend la première carte, journalise `run:moment` / `run:fissure` / `run:tier` /
  `run:minute`, capture les bannières et échoue sur toute erreur console ou 404.

### 10.2 Cendrelune minute par minute (360 s)

| minute | Sourdine | nouveaux ennemis | Moment (±8 s) | Fêlure / boss | cloche |
|---|---|---|---|---|---|
| 0–1 | 1 | Feutres 0 s, Chœur Muet 10 s, Bâillons 40 s | 40 s **La Procession** — 12 Feutres en file, Échos ×2 (18 s) | – | – |
| 1–2 | 2 à 60 s | Fossoyeurs 80 s | 85 s **Le Cercle se referme** — 10 Feutres en anneau à 260 px (15 s) | – | 60 s |
| 2–3 | 3 à 120 s | Ouateux 130 s | 125 s **La Nuée** — 24 Chœur Muet depuis un côté (12 s) | 144 s Fêlure : Veuve aînée | 120 s |
| 3–4 | 4 à 180 s | Rampes de suie 180 s | 175 s **Accalmie** — 15 s sans vague, Échos ×2 ; 215 s **La Meute** — 6 Bâillons qui bondissent ensemble (12 s) | – | 180 s |
| 4–5 | 5 à 240 s | Veuves grises 230 s | 270 s **Le Rang des Fossoyeurs** — 5 Fossoyeurs alignés, salve synchronisée (15 s) | 252 s Fêlure : Cierge pascal | 240 s |
| 5–6 | 6 à 300 s | Cierges 290 s | 315 s **Les Trois Veuves** — 4 Veuves grises téléportées autour du sonneur (12 s) | 360 s **Le Bourdon Fêlé** | 300 s |

Avec la Relique `clef_du_beffroi`, les Fêlures arrivent 60 s plus tôt (84 s et 192 s) : elles tombent alors
sur le Cercle et la Meute, ce qui est voulu.

### 10.3 Structure des autres paroisses

| paroisse | durée / palier | ordre d'apparition (s) | Fêlures | Moments (s) |
|---|---|---|---|---|
| Les Tourbes | 420 / 64 | Feutre 0, **Rampe 12**, **Ouateux 40**, Chœur 75, Bâillon 130, Fossoyeur 190, Veuve 260, Cierge 330 | Rampe mère 168, Bâillon double 294 | pluie_de_suie 40 (5), cercle 90 (8 Ouateux), procession 140 (14), accalmie 190, nuee 245 (28), meute 305 (7), pluie_de_suie 350 (8), cierge_errant 392 |
| Val-des-Cordes | 480 / 68 | **Bâillon 0**, Feutre 6, Chœur 40, Fossoyeur 80, Veuve 140, Ouateux 200, Rampe 260, Cierge 330 | Fossoyeur ancien 192, Veuve aînée 336 | meute 35 (6), procession 85 (14), cercle 135 (18), meute 180 (8), accalmie 235, ligne 290 (6), veuves_en_cercle 350 (3), meute 410 (10) |
| La Nef Noyée | 540 / 72 | **Chœur 0**, Feutre 10, **Fossoyeur 35**, Veuve 85, Ouateux 140, Bâillon 200, Rampe 280, Cierge 340 | Cierge pascal 216, Fossoyeur ancien 378 | nuee 40 (24), ligne 100 (5), cercle 160 (18), nuee 220 (32), accalmie 280, veuves_en_cercle 340 (3), ligne 400 (7), pluie_de_suie 460 (7) |
| Le Beffroi Mère | 600 / 75 | Feutre 0, Chœur 8, Bâillon 30, Fossoyeur 60, **Cierge 90**, Rampe 130, Veuve 170, Ouateux 210 | Bâillon double 240, Rampe mère 420 | cercle 40 (18), meute 108 (8), cierge_errant 176, nuee 244 (30), accalmie 312, ligne 380 (7), pluie_de_suie 448 (8), veuves_en_cercle 516 (3) |

Difficulté par paroisse (`waves.<paroisse>.difficulty`, PV / dégâts des ennemis hors boss, appliquée par
`spawner.scaleNewEnemies` à toute apparition, y compris Moments, Fêlures et invocations) : Cendrelune 1 / 1,
Tourbes 1,25 / 1,12, Val 1,55 / 1,25, Nef 1,7 / 1,3, Beffroi 2 / 1,4. Sans elle, les nuits plus longues laissaient
le sonneur dépasser le palier 6 (atteint à 300–375 s) : 3/3 partout et niveau 31 au Beffroi (proposition § 7.4).

### 10.4 Avant / après (Cendrelune, 5 seeds par ligne, Relique = première proposée)

Avant = nuit de 12 min (`before-rythme.json`, valeurs d'origine rejouées aujourd'hui, Reliques et cloche
comprises — d'où un Bronze plus haut que dans § 3.2). Après = valeurs livrées (`after-rythme.json`).
« timeouts » = boss vivant 2 min 30 après son arrivée avec un joueur vivant (le robot fuit la foule de 400 au lieu
de la traverser, § 7.3 : ces runs comptent comme non gagnées). Colonne PV % au boss : moyenne (médiane).

Avant (12 min) :

| sonneur/profil | n | vict. | morts | timeouts | min. mort | niv 90 s | niv 3 min | niv fin (720 s) | PV % au boss (méd.) | boss (s) | tués | ennemis max | bronze vict. | bronze déf. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| le_muet/moyen | 5 | 3 | 1 | 1 | 10.2 | 4.4 | 8.6 | 25.5 | 67.5 (80) | 12.9 | 2455 | 125 | 463.3 | 107 |
| le_muet/norhythm | 5 | 2 | 0 | 3 | – | 4.2 | 8.4 | 23.8 | 69.8 (80) | 18.6 | 2834.2 | 182.8 | 400.5 | – |
| le_muet/parfait | 5 | 4 | 0 | 1 | – | 4.4 | 8.4 | 25.8 | 76.8 (80) | 29.8 | 2566.4 | 72 | 516.8 | – |
| wren/moyen | 5 | 5 | 0 | 0 | – | 5 | 9 | 26 | 87.6 (83) | 48.8 | 2835.2 | 228 | 472.4 | – |
| wren/norhythm | 5 | 4 | 1 | 0 | 13 | 4.8 | 9 | 25.8 | 95.2 (100) | 61.5 | 2874 | 219.8 | 380.8 | 175 |
| wren/parfait | 5 | 5 | 0 | 0 | – | 4.8 | 8.8 | 26.4 | 96 (100) | 28.5 | 2665.2 | 120.4 | 498.2 | – |

Après (6 min) :

| sonneur/profil | n | vict. | morts | timeouts | min. mort | niv 90 s | niv 3 min | niv fin (360 s) | PV % au boss (méd.) | boss (s) | tués | ennemis max | bronze vict. | bronze déf. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| le_muet/moyen | 5 | 5 | 0 | 0 | – | 5 | 10.4 | 18.2 | 70 (80) | 67.2 | 1331.6 | 163.4 | 326.6 | – |
| le_muet/norhythm | 5 | 2 | 1 | 2 | 5.2 | 5.2 | 10.6 | 18.3 | 45.3 (63) | 17 | 1198.2 | 213 | 310 | 87 |
| le_muet/parfait | 5 | 5 | 0 | 0 | – | 5 | 10.6 | 19 | 75.4 (80) | 77.1 | 1267.6 | 110.2 | 345.4 | – |
| le_muet/passif | 5 | 0 | 4 | 1 | 3.1 | 5.2 | 10.5 | 17 | 21 (21) | – | 620.6 | 88.4 | – | 58.5 |
| wren/moyen | 5 | 3 | 0 | 2 | – | 5.8 | 10.8 | 19.2 | 53.8 (41) | 61.7 | 1227.6 | 262.4 | 321 | – |
| wren/norhythm | 5 | 1 | 4 | 0 | 6.2 | 5.8 | 10.8 | 18.7 | 42.7 (42) | 130.1 | 1123 | 210.6 | 364 | 104.5 |
| wren/parfait | 5 | 3 | 2 | 0 | 6.1 | 5.6 | 10.6 | 20.5 | 99 (100) | 27.8 | 1154 | 132 | 334.7 | 125 |
| wren/passif | 5 | 0 | 5 | 0 | 2.7 | 5.5 | 10 | – | – (–) | – | 281.6 | 64.8 | – | 40.8 |

Cibles et lecture :
- Wren moyen : **3 victoires sur 5** (cible 3–4), aucune mort, 2 timeouts de foule ; niveau 5,8 à 90 s, 10,8 à
  3 min, **19,2 à l'aube** (cible 18–20, soit un niveau toutes les ≈ 19 s) ; PV à l'arrivée au boss 19–100 %
  (médiane 41 %, cible 20–35 % : le robot ramasse tous les soins ; sur les 5 runs, 3 arrivent entre 19 et
  41 %) ; boss battu en 62 s (48 s avant, avec un build de niveau 26 contre 19 aujourd'hui).
- Mort possible tôt en jouant mal : Wren passif meurt entre 1 min 28 et 4 min 11 (moyenne 2,7 min ; avant :
  minute 8 sur 12), Le Muet passif entre 2,6 et 4,6 min.
- Bronze : victoire 306–364 (cible 250–400), défaite 35–139 (cible 40–120 ; 139 = mort pendant le boss).
- Sans rythme (Wren) : 1/5 contre 4/5 avant — c'est la régression à surveiller. Le robot Sans rythme ne pare
  ni ne dashe : au niveau 19 (au lieu de 26) il met 130 s à user le Bourdon et y meurt (4 morts sur 5 à la
  minute 6–7). Le Muet Sans rythme reste à 2/5 (comme avant). Pistes JSON si les humains le confirment :
  `resonance.norhythmTier` 2 → 3 (×2,5 fixe) ou `bourdon_fele.hp` 8 000 → 6 500 ; ne pas retoucher la densité,
  qui cale déjà le profil moyen.
- Le Muet : 5/5 (moyen) et 5/5 (parfait) — le Diapason + Clarine de départ est devenu le sonneur le plus sûr
  sur 6 min ; à rééquilibrer par D si c'est trop (§ 6.1 tenait pour 12 min).

Courbe type (Wren moyen, seed 3) : niveau 2 à 30 s, 4 à 60 s, 6 à 90 s, 9 à 150 s, 11 à 180 s, 13 à 240 s,
16 à 300 s, 19 à 360 s ; PV 100 → 70 (150 s, Nuée + Fêlure) → 100 → 73 (300 s) → 24 (minimum à 363 s) → 41 à
l'arrivée du boss ; 7 Moments traversés (procession 46, cercle 81, nuée 122, accalmie 175, meute 214, ligne 262,
Veuves 323) ; 1 347 tués (2 835 en moyenne avant).

### 10.5 Paroisses suivantes (Wren moyen, 3 seeds, Beffroi « 2 runs » : cœur de bronze 2, battant lourd 1, ferrure 1)

| paroisse | nuit (s) | vict. | morts (min) | niv 90 s / 3 min / fin | PV mini | PV % boss | boss (s) | tués | ennemis max | Moments | bronze |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cendrelune (sans Beffroi, 5 seeds) | 360 | 3/5 | 0 | 5,8 / 10,8 / 19,2 | 34 | 54 | 62 | 1 228 | 262 | 7/7 | 321 |
| Les Tourbes | 420 | 3/3 | 0 | 6 / 12,3 / 22,3 | 32 | 114 | 44,5 | 1 770 | 236 | 8/8 | 430 |
| Val-des-Cordes | 480 | 3/3 | 0 | 5,7 / 10 / 22,3 | 12 | 94 | 42,5 | 1 657 | 380 | 8/8 | 464 |
| La Nef Noyée | 540 | 2/3 | 1 (6,2) | 4,7 / 10,3 / 21,5 | 17 | 72 | 37 | 1 539 | 384 | 7,3/8 | 375 |
| Le Beffroi Mère | 600 | 1/3 | 2 (4,2 ; 4,2) | 5,7 / 11,3 / 33 | 25 | 120 | 8 | 1 585 | 400 | 5,3/8 | 334 |

Le « +25 % par paroisse » se lit dans les PV minimum (32 → 12 → 17 → 25 avec 20 PV de plus au Beffroi) et
dans les morts (aucune → Nef 1/3 → Beffroi 2/3, toutes autour de 4 min : Fêlure Bâillon double à 240 s + Nuée
de 30 Chœur Muet à 244 s, la fin de nuit reste à durcir si le Maître tombe en 8 s avec un build de niveau 33).
Bruts : `tests/results/after-rythme-parishes.jsonl` (une matrice JSON par ligne).

### 10.6 Run réelle (`tests/night.mjs`, Chromium headless, ×3, Cendrelune, Wren, seed 1717)

200 s de jeu : Moments procession 47 s, cercle 89 s, nuée 130 s, accalmie 177 s ; Fêlure Veuve aînée à 144 s ;
paliers 2/3/4 à 60/120/180 s ; cloche aux minutes 1, 2, 3 ; 10 niveaux. **0 erreur console, 0 erreur de page,
0 réponse ≥ 400, 0 requête échouée.** Captures dans `tests/results/night/` : `moment-procession.png`,
`moment-cercle.png`, `moment-nuee.png`, `moment-accalmie.png` (voile pâle, compte à rebours, cendres calmées),
`fissure-veuve_grise_elite.png`, `final.png`.

### 10.7 À transmettre (hors périmètre P)

- D : `bell-hour.bonusFor` — le Bronze de la « 12ᵉ minute » n'existe plus (nuits de 6 à 10 min) : bonus de la
  dernière minute = `Math.round(duration / 60)` ; `src/game/_test/game-test.js` (contrôle « 6 paliers, 12
  minutes » et `duration: 720` du banc DPS) à aligner sur `waveDef.duration`.
- Lead : `waves.<paroisse>.difficulty` et `moments`, `balance.moments`, l'événement `run:moment {id, phase}` et
  les clés `moment.<id>.name` / `ui.moment.*` sont à inscrire dans ARCHITECTURE.md § 5 et § 10.
- E/tutoriel : une ligne sur les Moments (« la bannière annonce l'assaut ; l'accalmie double les Échos »).


## 11. Vague 2 — QA et équilibrage après la Résonance stricte (agent G)

Date : 2026-09-05. Périmètre : `weapons/passives/fusions/enemies/relics.json` (valeurs), `waves.json` (`balance`, `spawns`,
`moments`, `events`, `tierEvery` — pas `difficulty`), `tests/**`. Aucun `.js` hors `tests/` modifié ; bugs JS rapportés en § 11.6.
JSON bruts : `tests/results/v2-before*.json` (valeurs de la vague 1 rejouées avec le robot final), `v2-after*.json` (valeurs
livrées), `v2-dps-before/after.json`. Point de départ : constat du lead (robot naïf, Espace sur chaque temps + cercle → mort à
92 s, niveau 2, 156 ennemis) reproduit par le profil `naif` : mort à 1,0 min, niveau 2, 70 ennemis vivants (avant).

### 11.1 Outils

- **Stubs** (`tests/stubs/`) : `conductor` (setInputLatencyMs / inputLatencyMs, `early` dans judge, shiftGrid / gridShift qui
  décale vraiment la grille sur `boss:phase 'cri'`, gridShiftCount), `sfx` (setAmbienceVolume, isJingle, has, stats,
  activeAmbiences), `audio` (voiceCount, volume, duckCounter, maxVoices), `lighting` (addStrongGlow, setHaloColor),
  `atlas` (drawOutlined, isImportant), nouveaux `timbres.js` et `music.js` (plus d'avertissement « voix indisponibles »).
  `game-test.html` (stubs de D) charge sans erreur console ; ses 7 KO sont ses attentes obsolètes (« 6 paliers, 12 minutes »,
  Feuillets f04/f05, « 3 min sans mort ») : page hors périmètre, à rafraîchir par D.
- **Robot** (`tests/sim.mjs`) : profils `parfait` / `moyen` (20-55-25) / `faible` / `norhythm` / `passif` / `parade_seule` /
  `lead` / `naif` ; parade **à vide** posée sur la croche quand un Contretemps fermé est à portée (elle l'ouvre un temps sans
  coûter de cran — 715 parades sur la croche dans la matrice) ; poursuite du Voleur qui emporte un cran (chasse mesurée) ;
  Désaccordeur ignoré ; `boss:phase` journalisé et cri fêlé subi (497 décalages de grille, réadaptation en 1/2/3/4 temps selon
  le profil) ; fusions (couples de `fusions.json`, instant de la première fusion) ; le robot cesse de fuir une foule après 4 s
  au-dessus de 50 % de PV et traverse les anneaux du boss (Volée, parade) au lieu de les fuir ; Sans rythme : Volée d'esquive
  hors grille sur projectile ou bond imminent. Colonnes ajoutées : niveau à 60 s / 2 min, ennemis à 2 min / au boss / max,
  phases de boss, fusions, bronze victoire / défaite, part des Contretemps dans les tués, durée de chasse du Voleur ;
  `--out` / `--summary [--md]`.
- **checks.mjs** (112/112) : 9 fusions et leurs couples, 11 ennemis (contretemps, voleur_de_cran, desaccordeur) et leurs
  `special`, ≥ 19 hauts-faits (25 aujourd'hui avec ceux de la méta), Moments, `fusion.<id>.hint`, clés des nouveaux contenus,
  phases de boss nommées (informatif : aucune `boss.<id>.phase_<phase>` n'existe, le HUD replie sur « Le bronze se fend »),
  « aucun duck() par tir », « bell_minute joué seulement par bell-hour.js », `balance.mark.perAccordLevel`, nouveaux ennemis
  dans les 5 paroisses.
- **perf.mjs** : « minute 3, bloc réel » (saut à 178 s, palier 5, Fêlure et Moments du vrai bloc, rien d'injecté) puis « minute
  10, foule injectée » ; contrôle sur la **capacité** fps = min(60, 1000 / frameMs p95) — le compteur rAF headless est bridé
  (18 fps au repos pour 1,1 ms de frame).
- **night.mjs** : nuit complète ×4 (×1 pendant le boss), robot clavier Espace / Shift / ZQSD, journal `bell:*`, `run:boss`,
  `boss:phase`, `run:end`, `sfx.stats()`.

### 11.2 Avant / après — Cendrelune, 4 sonneurs × profils × 5 seeds

« boss non achevé » = boss vivant 2 min 30 après son arrivée avec un sonneur vivant (souvent à 100 % de PV : le robot
tourne autour de la foule ; à lire comme « non gagnée »). Réso = multiplicateur moyen de Résonance sur la nuit.

Avant (valeurs de la vague 1, `v2-before.json`) :

| sonneur/profil | vict. | morts | boss non achevé | min. mort | niv 60 s | niv 2 min | niv fin | enn. 2 min | enn. boss | PV % au boss | boss (s) | réso | bronze vict. | bronze déf. | Contretemps % tués | Voleur repris (s) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| le_muet/moyen | 5 | 0 | 0 | – | 4.8 | 9.2 | 14.2 | 37 | 256.2 | 68 | 73.8 | 1.7 | 356.2 | – | 1.1 | 0.4 |
| le_muet/norhythm | 1 | 3 | 1 | 4.9 | 5 | 9.2 | 14.2 | 36.4 | 243.4 | 64.6 | 72.3 | 1.8 | 296 | 89.3 | 0.7 | 0.5 |
| le_muet/parade_seule | 3 | 2 | 0 | 2.7 | 4.6 | 8.3 | 13.7 | 49.8 | 287 | 43 | 38.1 | 1.2 | 329.7 | 45 | 0.4 | – |
| le_muet/parfait | 5 | 0 | 0 | – | 4.4 | 9.2 | 14.8 | 22.6 | 192 | 100 | 34.1 | 2.5 | 373.4 | – | 1.3 | – |
| le_muet/passif | 0 | 5 | 0 | 1.8 | 2.4 | – | – | – | – | – | – | 1 | – | 25.8 | 0 | – |
| maren/moyen | 5 | 0 | 0 | – | 4.6 | 9.6 | 15.8 | 44.2 | 266.6 | 92.4 | 67.4 | 1.9 | 324.4 | – | 1 | 0.5 |
| maren/norhythm | 4 | 1 | 0 | 4.7 | 5 | 9.4 | 15.8 | 29.8 | 226.6 | 84.7 | 63.2 | 1.8 | 292.5 | 62 | 0.9 | 0.2 |
| maren/parade_seule | 1 | 4 | 0 | 2.5 | 4.6 | 8 | 12.5 | 61.3 | 399 | 100 | 35.1 | 1.1 | 304 | 43.5 | 0 | – |
| maren/parfait | 5 | 0 | 0 | – | 4.8 | 10.2 | 16.4 | 17 | 169.4 | 96.2 | 28.8 | 2.4 | 374.4 | – | 1.2 | 0.4 |
| maren/passif | 0 | 5 | 0 | 1.5 | 3.6 | – | – | – | – | – | – | 1 | – | 28.8 | 0 | – |
| osric/moyen | 4 | 0 | 1 | – | 4.6 | 8.6 | 14.6 | 68 | 276.8 | 74 | 64.2 | 1.5 | 337.8 | – | 0.7 | 0.3 |
| osric/norhythm | 5 | 0 | 0 | – | 4.6 | 8.6 | 15 | 42.8 | 261.2 | 89.3 | 79.2 | 1.8 | 275.2 | – | 1 | 3.5 |
| osric/parade_seule | 2 | 0 | 3 | – | 4.4 | 7.6 | 13.6 | 73.6 | 300.4 | 53.1 | 73.5 | 1.1 | 338.5 | – | 0.4 | – |
| osric/parfait | 5 | 0 | 0 | – | 4.6 | 9.4 | 15.6 | 50 | 213.6 | 92.3 | 42.4 | 2.4 | 377.4 | – | 1.2 | 0.2 |
| osric/passif | 0 | 5 | 0 | 3.8 | 5 | 8.2 | 9.5 | 73.2 | 399.5 | 73.1 | – | 1 | – | 51.4 | 0 | – |
| wren/moyen | 3 | 0 | 2 | – | 4.8 | 9.4 | 16.2 | 48 | 257.8 | 64.9 | 48.5 | 1.4 | 322.3 | – | 0.6 | 0.2 |
| wren/norhythm | 1 | 1 | 3 | 4.8 | 4.8 | 8.8 | 15 | 51.2 | 286.2 | 57.7 | 60.4 | 1.8 | 313 | 61 | 0.4 | 0.4 |
| wren/parade_seule | 0 | 4 | 1 | 3.1 | 5 | 8.6 | 15 | 58.4 | 222 | 30 | 147.1 | 1 | – | 48 | 0.2 | – |
| wren/parfait | 4 | 1 | 0 | 2.7 | 5 | 9.6 | 17.8 | 34 | 163 | 100 | 53.7 | 2.4 | 397.8 | 60 | 1.1 | – |
| wren/passif | 0 | 5 | 0 | 1.2 | 1 | – | – | – | – | – | – | 1 | – | 20.8 | 0 | – |
| wren/faible | 2 | 0 | 3 | – | 4.6 | 8.6 | 14.8 | 58.2 | 300.4 | 35.6 | 68.5 | 1.1 | 349 | – | 0.5 | 0.5 |
| wren/lead | 1 | 3 | 1 | 3.5 | 4.8 | 10 | 16.3 | 30.6 | 203.5 | 78.8 | 18.9 | 2.4 | 377 | 92.3 | 0.4 | 0.2 |
| wren/naif | 0 | 5 | 0 | 1 | 2 | – | – | – | – | – | – | 1.7 | – | 31.4 | 0 | – |

Après (`v2-after.json`) :

| sonneur/profil | vict. | morts | boss non achevé | min. mort | niv 60 s | niv 2 min | niv fin | enn. 2 min | enn. boss | PV % au boss | boss (s) | réso | bronze vict. | bronze déf. | Contretemps % tués | Voleur repris (s) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| le_muet/moyen | 4 | 1 | 0 | 5.9 | 4 | 9.2 | 15.6 | 12.2 | 96.8 | 90.3 | 40.6 | 1.8 | 330 | 206 | 1.5 | – |
| le_muet/norhythm | 4 | 0 | 1 | – | 4 | 8.8 | 14.2 | 12 | 138.8 | 100 | 72.3 | 2 | 270 | – | 1.3 | – |
| le_muet/parade_seule | 4 | 1 | 0 | 5.3 | 4 | 8.2 | 14.8 | 21.4 | 144.4 | 75 | 33.9 | 1.2 | 280 | 85 | 0.9 | – |
| le_muet/parfait | 5 | 0 | 0 | – | 3.8 | 9.2 | 16 | 10.2 | 69.4 | 100 | 23 | 2.5 | 366.6 | – | 2.3 | – |
| le_muet/passif | 0 | 5 | 0 | 2.6 | 1.6 | 1.8 | – | 101.8 | – | – | – | 1 | – | 37.8 | 0 | – |
| maren/moyen | 5 | 0 | 0 | – | 4.4 | 10.2 | 17.6 | 13.8 | 93.2 | 97.3 | 31.2 | 1.8 | 312.6 | – | 1.7 | 0.3 |
| maren/norhythm | 5 | 0 | 0 | – | 4.6 | 9.6 | 16.8 | 3.8 | 59.6 | 100 | 43.4 | 2 | 265.8 | – | 1.7 | – |
| maren/parade_seule | 5 | 0 | 0 | – | 4.4 | 9 | 15 | 17.6 | 158 | 86 | 69.3 | 1.1 | 277 | – | 1 | – |
| maren/parfait | 5 | 0 | 0 | – | 4.2 | 10.4 | 17.2 | 5.8 | 84 | 100 | 21.1 | 2.3 | 367.4 | – | 2.1 | – |
| maren/passif | 0 | 5 | 0 | 3.7 | 4.2 | 8.8 | 16.7 | 27 | 59.5 | 79.9 | – | 1 | – | 68.6 | 0.8 | – |
| osric/moyen | 3 | 0 | 2 | – | 3.6 | 8.8 | 14.8 | 28 | 137.2 | 93.6 | 66.1 | 1.7 | 284.7 | – | 0.9 | 0.4 |
| osric/norhythm | 4 | 0 | 1 | – | 3.8 | 8.6 | 14.8 | 14.4 | 103 | 100 | 68.5 | 2 | 272.8 | – | 1.4 | – |
| osric/parade_seule | 5 | 0 | 0 | – | 3.8 | 7.6 | 13.8 | 31.4 | 150.4 | 85.7 | 58.4 | 1.1 | 267.8 | – | 0.9 | 0.2 |
| osric/parfait | 5 | 0 | 0 | – | 3.6 | 9.4 | 16 | 15.8 | 86.8 | 100 | 29.5 | 2.5 | 353.4 | – | 1.7 | – |
| osric/passif | 3 | 2 | 0 | 5.3 | 4 | 7.8 | 13.2 | 29.2 | 199.2 | 73.5 | 97.2 | 1 | 323.3 | 70 | 0.4 | – |
| wren/moyen | 4 | 0 | 1 | – | 4.2 | 10 | 16.8 | 22.2 | 140.2 | 81 | 34.4 | 1.7 | 354.5 | – | 1.3 | 0.3 |
| wren/norhythm | 2 | 0 | 3 | – | 4.2 | 9.2 | 14.6 | 23.8 | 179.2 | 100 | 81.9 | 2 | 275.5 | – | 1.1 | – |
| wren/parade_seule | 1 | 2 | 2 | 4.8 | 4.4 | 8.2 | 15.3 | 27.4 | 174.5 | 96.5 | 37.6 | 1.1 | 334 | 74 | 0.4 | – |
| wren/parfait | 4 | 1 | 0 | 4.2 | 4.2 | 10.2 | 17.4 | 9.8 | 72.8 | 99 | 47.6 | 2.5 | 378.8 | 225 | 1.7 | 0.3 |
| wren/passif | 0 | 5 | 0 | 1.5 | 1 | – | – | – | – | – | – | 1 | – | 30.2 | 0 | – |
| wren/faible | 2 | 0 | 3 | – | 3.6 | 7.8 | 14.8 | 38.4 | 181 | 54.8 | 44 | 1.2 | 316 | – | 0.7 | – |
| wren/lead | 2 | 3 | 0 | 3.5 | 4.4 | 10 | 18 | 9.8 | 66.3 | 79 | 48.9 | 2.5 | 382 | 159.7 | 1.3 | 0.1 |
| wren/naif | 0 | 5 | 0 | 1.5 | 1.6 | 9 | – | 23 | – | – | – | 2 | – | 52.8 | 0.1 | – |

Wren moyen en visant une fusion (`--cards fusion`) : | wren/moyen | 5 | 4 | 0 | 1 | – | 4.4 | 10.4 | 16.8 | 21.6 | 149 | 169 | 73.2 | 42.6 | 4@204 | 562.4 | 1.7 | 350 | – | 0.9 | 0.6 |

### 11.3 Cibles

| cible | avant | après |
|---|---|---|
| Wren moyen 3–4 victoires / 5 | 3 (+ 2 non achevées) | **4** (+ 1 non achevée), 0 mort |
| PV 25–45 % à l'arrivée au boss | 65 % | 81 % (le robot ramasse tous les soins ; PV mini moyen 45–60 % vers 110 s) |
| boss 40–70 s | 48 s | 34 s (moyen), 48 s (parfait), 82 s (Sans rythme), 38 s (parade seule) |
| parfait 5/5, Réso ≥ 2,2 | 4/5, 2,4 | 4/5 (1 mort à 4,2 min : Bâillons + Veuve aînée), **2,5** |
| Sans rythme 2–3/5 | 1/5 (1 mort, 3 non achevées) | **2/5**, 0 mort, 3 non achevées (boss à 100 % PV, ×2,0 fixe) |
| passif mort entre 1,5 et 3 min | 1,2 min | **1,5 min** (Le Muet 2,6, Maren 3,7, Osric 5,3) ; naïf 1,0 → 1,5 min |
| parade seule ≤ 1/5 | 0/5 (Réso 1,0) | **1/5** (Réso 1,1 ; 2 morts, 2 non achevées) |
| Le Muet moyen 2–3/5 | 5/5 | 4/5 (1 mort au boss) — voir § 11.7 |
| niveau ≈ 5 à 60 s, 10 à 2 min, 16–18 à la fin | 4,8 / 9,4 / 16,2 | 4,2 / **10** / **16,8** |
| ennemis ≤ 90 avant 2 min, ≤ 150 au boss | 48 / 258 (max 308) | **22 / 140** (max 149) |
| DPS niv 1 15–25, niv 7 95–110 homogènes | 16–22 / 99–108 | inchangés (Diapason 14 → 10 / 37 → 29, mesuré seul) |
| aucun Accord > +25 %/niveau | Diapason × Étain +28 % (niv 3) | **25 % max** (grelots × etain, niv 3) |
| fusion vers 70 % de la nuit en la visant | 1 fusion / 5 à 261 s | 4 / 5 à 204 s (85 %) — goulot de cartes, § 11.6 n° 2 |
| Bronze défaite 40–120, victoire 250–400 | 20–92 / 322–398 | défaite 30–85 (passif à 1,5 min : 30), victoire 268–379 |
| Contretemps ≤ 8 % des tués | 0,4–1,3 % | 0,4–2,3 % |
| Voleur repris en < 6 s | 0,2–3,5 s | 0,1–0,6 s (rarement volé : 0–2 vols par nuit) |
| boss en phases | cri / double / envers | cri / double / envers observés dans 96 runs sur 100 ; Veuve : enfants / deuil ; Maître : annonce / coda |

### 11.4 Paroisses (Wren moyen, 5 seeds, arbre du Beffroi : aucune / 6 crans / arbre complet ; Beffroi Mère aussi à 10 crans)

6 crans = cœur de bronze 2, battant lourd 1, ferrure 1, semelles 1, oreille fine 1 ; 10 crans = cœur 3, battant lourd 2,
ferrure 2, semelles 1, oreille fine 1, cire 1 ; arbre complet = les 14 nœuds historiques au maximum (+ deuxième chance).
La difficulté par paroisse (`waves.<paroisse>.difficulty`, méta) est celle du jour : 1 / 1,25 / 1,55 / 1,7 / 2,0 de PV.

| paroisse | arbre | vict. | morts | boss non achevé | min. mort | niv 60 s / 2 min / fin | enn. 2 min | enn. boss | PV % au boss | boss (s) | tués | bronze vict. | bronze déf. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cendrelune | aucune | 4 | 0 | 1 | – | 4.2 / 10.0 / 16.8 | 22.2 | 140.2 | 81.0 | 34.4 | 667.4 | 354.5 | – |
| cendrelune | 6 crans | 5 | 0 | 0 | – | 4.2 / 9.2 / 14.4 | 26.0 | 167.2 | 95.5 | 61.6 | 583.2 | 352.2 | – |
| cendrelune | arbre complet (36 crans) | 4 | 0 | 1 | – | 5.2 / 12.6 / 20.8 | 4.8 | 60.0 | 98.8 | 11.0 | 485.6 | 423.8 | – |
| tourbes | aucune | 1 | 3 | 1 | 4.8 | 5.4 / 10.2 / 17.5 | 42.6 | 192.0 | 73.5 | 55.7 | 589.0 | 452.0 | 154.0 |
| tourbes | 6 crans | 4 | 0 | 1 | – | 5.8 / 10.4 / 18.0 | 44.6 | 189.2 | 84.0 | 71.0 | 741.2 | 459.2 | – |
| tourbes | arbre complet (36 crans) | 5 | 0 | 0 | – | 7.4 / 13.8 / 25.8 | 20.0 | 54.4 | 100.0 | 44.0 | 816.4 | 570.4 | – |
| val_des_cordes | aucune | 4 | 1 | 0 | 4.0 | 5.0 / 9.0 / 20.0 | 72.4 | 200.5 | 74.5 | 47.9 | 635.0 | 517.8 | 75.0 |
| val_des_cordes | 6 crans | 5 | 0 | 0 | – | 5.2 / 9.2 / 17.6 | 73.2 | 195.4 | 92.7 | 58.4 | 538.2 | 475.2 | – |
| val_des_cordes | arbre complet (36 crans) | 4 | 0 | 1 | – | 6.4 / 12.0 / 22.6 | 54.2 | 147.0 | 100.0 | 19.6 | 613.0 | 582.5 | – |
| nef_noyee | aucune | 5 | 0 | 0 | – | 4.4 / 7.6 / 17.8 | 83.6 | 217.0 | 64.8 | 50.5 | 668.4 | 559.8 | – |
| nef_noyee | 6 crans | 5 | 0 | 0 | – | 4.6 / 8.8 / 19.2 | 72.6 | 217.0 | 97.7 | 37.1 | 766.2 | 560.4 | – |
| nef_noyee | arbre complet (36 crans) | 5 | 0 | 0 | – | 5.8 / 11.4 / 25.6 | 51.4 | 137.8 | 100.0 | 25.1 | 884.6 | 699.2 | – |
| beffroi_mere | aucune | 1 | 4 | 0 | 3.1 | 5.0 / 10.0 / 26.0 | 169.5 | 203.0 | 70.0 | 22.0 | 564.0 | 859.0 | 144.5 |
| beffroi_mere | 6 crans | 2 | 3 | 0 | 4.1 | 5.0 / 9.2 / 13.3 | 183.4 | 220.3 | 86.9 | 91.0 | 310.2 | 754.0 | 173.7 |
| beffroi_mere | arbre complet (36 crans) | 4 | 0 | 1 | – | 7.2 / 12.8 / 21.4 | 136.6 | 175.8 | 100.0 | 52.2 | 706.4 | 784.0 | – |
| beffroi_mere | 10 crans | 4 | 1 | 0 | 2.8 | 5.4 / 9.6 / 20.5 | 162.8 | 194.2 | 98.1 | 34.7 | 751.8 | 718.5 | 72.0 |

Lecture : Cendrelune 4/5 sans arbre ; Tourbes bascule (1/5 sans arbre, 4/5 avec 6 crans) ; Val et Nef restent gagnées par le
robot dès 0 cran (mais avec 200–220 ennemis vivants au boss : le plafond `globalCap` 220 mord, et la Nef laisse le sonneur à
65 % de PV) ; le Beffroi Mère tue 4 fois sur 5 sans arbre (mort à 3,1 min), 3 fois sur 5 à 6 crans, et n'est régulier qu'à
partir de 10 crans (4/5). Le « +25 % par paroisse » se lit dans les morts et les PV au boss, pas dans les victoires du robot
(qui monte aussi plus vite : niveau 26 à l'aube du Beffroi sans arbre). Le Bronze des paroisses suivantes (452–859) dépasse la
fourchette 250–400 de Cendrelune : `bronzeReward` des paroisses (méta) et la cloche de la dernière minute (§ 11.6 n° 5).

### 11.5 Changements de valeurs

`waves.json → balance` : `xp` base 26 → 20, perLevel 4 → 3, growth 1,045 → 1,04 (niveau 17 pour ≈ 970 XP au lieu de 1 370) ;
`enemyHp.perTier` 1,32 → 1,30 ; `spawn.densityPerTier` 0,28 → 0,18 (palier 6 : ×1,9 au lieu de ×2,4), `globalCap` 400 → 220 ;
`resonance.mults` [1, 1.4, 1.8, 2.5] → **[1, 1.5, 2, 2.6]** (la jauge pèse plus : parade seule 1,1 contre moyen 1,7) ;
`player.parryCooldownBeats` 1 → **2** (la parade sur chaque temps ne rend plus quasi invulnérable au contact) ;
`cards.ownedWeight` 3 → 4, `fusionPartnerWeight` 6 → 12 ; `mark.perAccordLevel` 0,03 (ajouté : Requiem, bug n° 1) ;
`bronze.lossMult` 0,5 → 0,6, `perResonance` 30 → 35.

`waves.json → cendrelune` : `tierEvery` 40 → **45** (palier 6 à 225 s) ; première minute allégée (Feutres 0,8/s → 0,45/s
jusqu'à 60 s puis 0,6/s, Chœurs 0,3 → 0,2 dès 10 s puis 0,4, Bâillons à partir de 40 s au lieu de 27) ; caps ramenés
(Feutres 60 → 28/30, Chœurs 40 → 15/20, Bâillons 12 → 8, Fossoyeurs 8 → 5) ; Moments : procession 12 → 10, cercle 10 → 8,
nuée 24 → 18, meute 6 → 5, Veuves 4 → 3 ; Désaccordeur introduit à 170 s (0,03/s, cap 1). Autres paroisses : `tierEvery`
41/42/44/45 → 51/57/62/68 (≈ durée / 5,3) et −25 % sur les Feutres / Chœurs / Bâillons des 45 premières secondes.

`enemies.json` : `bourdon_fele` PV 6 500 → **7 500**, dégâts des anneaux 10 → **8** (le robot Sans rythme mourait au boss
4 fois sur 5) ; `veuve_grise_elite` dégâts 22 → 16 (la Fêlure de 96 s tuait le profil parfait : 2 charges = 60 PV au
palier 3) ; `baillon_elite` 18 → 15.

`fusions.json` : seuils `unlock` 5/3 → **4/3** (Timbre 4 + Accord 3) pour les 9 fusions. `weapons.json` : Diapason dégâts de
marque 6 → 4 et niveaux +2/+2/+3 → +2/+2/+2 (Le Muet, § 11.7). `passives.json`, `relics.json` : inchangés (Reliques : aucune
n'a fait dévier une cellule de la matrice ; `clef_du_beffroi` avance la Fêlure de 96 → 36 s : à surveiller chez les humains).

DPS théorique (`tests/dps.mjs`, Résonance ×1) :

| arme | seul niv 1 av→ap | seul niv 7 av→ap | groupe (12) niv 1 av→ap | groupe niv 7 av→ap |
|---|---|---|---|---|
| battant | 22 → 22 | 99 → 99 | 67 → 67 | 992 → 992 |
| clarine | 16 → 16 | 108 → 108 | 96 → 96 | 741 → 741 |
| bourdon | 20 → 20 | 99 → 99 | 240 → 240 | 1190 → 1190 |
| grelots | 22 → 22 | 102 → 102 | 22 → 22 | 128 → 128 |
| tocsin | 16 → 16 | 99 → 99 | 192 → 192 | 1190 → 1190 |
| cor_de_brume | 22 → 22 | 104 → 104 | 22 → 22 | 156 → 156 |
| crecelle | 19 → 19 | 102 → 102 | 19 → 19 | 118 → 118 |
| chaine_d_angelus | 22 → 22 | 102 → 102 | 67 → 67 | 512 → 512 |
| diapason | 14 → 10 | 37 → 29 | 94 → 63 | 435 → 340 |
| glas (fusion) | – → – | 80 → 80 | – → – | 960 → 960 |
| carillon (fusion) | – → – | 91 → 91 | – → – | 814 → 814 |
| tonnerre (fusion) | – → – | 96 → 96 | – → – | 1152 → 1152 |
| requiem (fusion) | – → – | – → 26 | – → – | – → 302 |
| grande_volee (fusion) | – → – | 109 → 109 | – → – | 1088 → 1088 |
| transhumance (fusion) | – → – | 106 → 106 | – → – | 141 → 141 |
| corne_de_guet (fusion) | – → – | 80 → 80 | – → – | 240 → 240 |
| crecelle_du_vendredi (fusion) | – → – | 128 → 128 | – → – | 153 → 153 |
| angelus_de_veillee (fusion) | – → – | 83 → 83 | – → – | 749 → 749 |
| diapason (+battant 7) | – → – | 106 → 98 | – → – | 1110 → 1015 |
| requiem (+battant 7) | – → – | – → 95 | – → – | – → 978 |

### 11.6 Bugs à transmettre (aucune correction faite hors JSON et tests)

1. **Requiem : dégâts NaN, ennemis immortels** — `src/game/weapon-behaviors.js:334` lit `balance.mark.perAccordLevel`, absent de
   `waves.json` : `dmg = NaN`, `enemy.hp -= NaN`, tout marqué devient immortel (et un boss NaN n'a plus de phases).
   Scénario : Diapason 5 + Métronome 3 → carte Requiem → premier tir. Mesure : `dps.mjs` affichait NaN pour le Requiem.
   Contourné par JSON (`perAccordLevel: 0.03`) ; le code doit prévoir un repli (`?? 0`) — D.
2. **Fusion : l'Accord partenaire non possédé n'est pas pondéré** — `src/game/cards.js:317` : `partnerReady`/`engaged` ne
   s'appliquent qu'aux Accords déjà possédés ; la première carte de l'Accord (poids 40 sur ≈ 900) est le goulot : en visant
   une fusion, 4 runs sur 5 y arrivent mais à 204 s (85 % de la nuit). Proposition : pondérer × `fusionPartnerWeight` la carte
   « nouvel Accord » dont le Timbre est au seuil — D.
3. **Frapper le Contretemps coûte un cran** — `src/game/enemy-behaviors.js:36-39` ouvre les Contretemps sur une frappe dans la
   fenêtre de la croche, mais `conductor.judge()` note cette frappe contre le temps le plus proche → « raté » → −1 cran
   (`resonance.js:120`) si une menace est à portée (toujours : le Contretemps est là). Seule une parade à vide est gratuite
   (le robot fait ainsi). Le texte (« c'est là qu'il faut frapper ») et le HUD du cri promettent l'inverse. Proposition :
   `charge = false` (ou jugement en croches) quand la frappe tombe dans la fenêtre de la croche — D.
4. **Voleur chargé sans flash** — `src/game/enemy-behaviors.js` (`voleur`, `e.flashT = 0` à chaque tick quand `carry > 0`) :
   les coups reçus ne clignotent plus ; le joueur ne voit pas qu'il le touche — D (lisibilité).
5. **Bronze de la dernière cloche conservé en cas de mort** — `src/game/bell-hour.js` (`applyBonus 'bronze'` →
   `world.bronzePicked += bronzeReward`) : une mort pendant le boss après avoir répondu à la cloche rapporte 145–311 de Bronze
   (Beffroi, Nef, Wren parfait Cendrelune 225) — à trancher (design), sinon `lossMult` devrait s'appliquer — D/méta.
6. **Caps de spawn multipliés par la densité** — `src/game/spawner.js:88` : `Math.ceil(s.cap * density)` en plus du `perSec ×
   density` : double échelle, les caps ne mordent presque jamais (Feutres : 30 → 57 au palier 6). Design ; les valeurs livrées
   supposent l'échelle actuelle — D.
7. **Relique ramassée = 2 Parfaits fictifs** — `src/game/pickups.js:104` (`onRhythmInput('parfait')` ×2) : allonge la streak de
   Parfaits (bonus de zone à 8, `sans_faute`) et tient la décroissance sans frappe — D (mineur).
8. **Le Carillon (objet) ne tue pas un Contretemps fermé** — `collision.js:606` (`vulnMult <= 0 → 0`) avant le coup mortel du
   `chime` — mineur, à trancher.
9. **Phases de boss sans nom** — aucune clé `boss.<id>.phase_<phase>` dans fr/en (cri, double, envers, enfants, deuil, coda,
   annonce, expose, enrage) : le HUD replie sur « Le bronze se fend » — F (contenu ; check informatif).
10. `src/game/_test/game-test.js` attend encore « 6 paliers, 12 minutes » et les Feuillets f04/f05 : 7 KO propres à la page
    (elle charge sans erreur) — D.

Non-bugs constatés : `bell_minute` n'est joué que par bell-hour.js (4 coups par sonnerie : 14,8 lectures par run pour 3,7
sonneries) ; aucun `duck()` par tir ; `moment_start` joué 2 fois par nuit (procession, accalmie) ; les 3 phases du Bourdon Fêlé et
le décalage de grille du cri sont observés dans la sim (stub) et en navigateur (§ 11.8).

### 11.7 Limites et recommandations

- Le robot arrive au boss à 80–100 % de PV (il ramasse tous les soins, esquive au tick) : la cible 25–45 % est à vérifier chez
  les humains ; les courbes de PV mini (45–60 % vers 110 s : Nuée + Fêlure) montrent que la pression existe. Si les humains
  arrivent trop hauts : `enemyHp.damagePerTier` 1,16 → 1,18 ; s'ils meurent au boss : `bourdon_fele.damage` 8 → 7.
- « Boss non achevé » (Wren moyen 1/5, Sans rythme 3/5) : le sonneur est vivant, souvent à 100 %, mais le robot ne tient pas
  l'aura face à 140–180 ennemis + anneaux ; un humain traverse. À confirmer en jeu réel ; sinon `afterBossRate` 0,3 → 0,2.
- Le Muet moyen 4/5 (cible 2–3) : sa force vient du robot qui n'encaisse rien (100 % de PV au boss) et de `perfectTiers: 2`
  (+2 crans par Parfait : Réso 1,8 avec 20 % de Parfaits). Leviers hors périmètre (characters.json, méta) : PV 80 → 70 ou
  `perfectTiers` 2 → 1. Le Diapason a été baissé (marque 6 → 4) sans effet sur ses victoires.
- Maren et Osric : 5/5 en moyen et même en parade seule (Réso 1,1) — Osric encaisse (130 PV, cuirasse), Maren gagne ×2 de
  Résonance. Wren est le seul sonneur où la parade seule échoue : les autres sont à durcir par la méta si c'est voulu.
- Paroisses : la Nef Noyée et le Val se gagnent sans arbre (4–5/5) alors que les Tourbes tombent à 1/5 : la progression
  `difficulty` (1,25 → 1,55 → 1,7) est moins sentie que l'ordre d'apparition (Bâillons dès 0 s au Val, Chœurs dès 0 s à la Nef
  qui nourrissent l'XP : niveau 20 à l'aube du Val sans arbre). Proposition méta : Tourbes 1,25 → 1,15, Nef 1,7 → 1,85.
- `globalCap` 220 mord dans les paroisses longues (Val, Nef, Beffroi : 195–220 au boss). Perf : minute 10 injectée 505 entités à
  7,7 ms de frame en rendu logiciel — le plafond pourrait remonter à 260 si la lisibilité l'accepte.
- Tutoriel / HUD (D, E) : dire qu'une **parade à vide** sur la croche ouvre le Contretemps (jusqu'au correctif n° 3, la Volée y
  coûte un cran).

### 11.8 Navigateur (Chromium headless, SwiftShader)

- `night.mjs` (Cendrelune, Wren, seed 1717, ×4 puis ×1 au boss) : **0 erreur console / page / réseau** ; 7 Moments, Fêlures
  96 / 168 s, paliers 2–6 à 45 / 90 / 135 / 180 / 225 s, minutes 1–4, cloche 4 sonneries / **4 réponses** (soin, carte, soin,
  bronze), boss intro 240 s → start 242 → phases **cri@244, cri@245, double@246, envers@246** → victoire à 249 s
  (build complet donné après le premier cri), niveau 15, 243 tués, bronze 311 ; `moment_start` joué 2 fois, `bell_minute`
  16, `victory_bell` 1 ; 135 Espace / 4 Shift, 118 Parfaits. Captures : `tests/results/night/` (Moments, Fêlure, boss, phases).
- `perf.mjs` : 0 erreur ; référence 1,1 ms de frame ; **minute 3, bloc réel** (palier 5, 32 ennemis, 30 projectiles, 584
  particules, 83 entités) : frame 2,65 ms (p95 3,8) → capacité 60 fps ; minute 10 injectée (505 entités, 135 ennemis, 148
  projectiles, 3 210 particules) : frame 7,7 ms (p95 10,6) → capacité 60 fps. Le compteur rAF (18 / 13 / 6 fps) n'est pas
  significatif en headless.
- `checks.mjs` : 112/112 (les KO transitoires du matin — clés `upgrade.*`, `ui.contracts.*` — étaient la méta en cours).
