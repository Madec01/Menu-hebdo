# SUJET NEUF — Rapport de l'Agent Test (phase 1, salles 1-5)

Date : 2026-09-05. Périmètre : équilibrage des données (`dev/content.js`), bugs moteur consignés sans correction.
Fichiers modifiés : `dev/content.js` (valeurs chiffrées uniquement), `index.html` (régénéré par `dev/build.js`), ce rapport.

---

## 1. Méthode

- **Harness** : `window.__autoplay(config)` piloté par Playwright/Chromium headless (`timeScale 40`, `render:false`, `maxSeconds 420`). Un run dure 1-2 s réel (10 s en cas de timeout). Aucune erreur JS, aucun warning console sur les ~330 runs.
- **Instrumentation ajoutée côté page (sans toucher au moteur)** : enveloppes sur `Combat.hitPlayer` (dégâts par salle et par source : contact/projectile/piège/explosion, identifiant du piège ou de l'ennemi), `Combat.hitEnemy` (dégâts au boss, coups dans le dos, coups pendant la faiblesse, durée réelle du combat), `Skills.use` (usages par compétence), `UI.showChoice` (raretés proposées, sous-titre du coffre, `G.run.scores`), `Run.checkpoint` (`coinsPending` → `coinsValidated`), `Run.onPlayerDeath` (salle, cause, pièces attendues vs `Meta.profile.coins`), `Run.endLevel`.
- **Plan de mesure** (bot aléatoire, `pickStrategy:'random'`, personnage `char_neuf`, compétence variée par run) :
  - A : mode normal, difficulté 1, 8 armes × 6 seeds (500-547) = 48 runs, **répété à l'identique avant et après chaque itération** (mêmes seeds) ;
  - B : mode normal, 4 armes (lame, arc, pistolet, boomerang) × 2 seeds, difficultés 0,75 et 1,5 ;
  - C : mode test (méta au max), difficultés 1 et 2, mêmes 4 armes × 2 seeds ;
  - baseline initiale supplémentaire : 8 armes × 3 seeds (200-223).
- **Métriques par run** : salle atteinte, salle de mort, temps et coups par salle, DPS observé (`damageDealt/durationSec`), durée du combat de boss (premier coup → mort), niveau atteint, dégâts subis par source.
- **Trois itérations** de réglage (≤ 30 % par valeur, une cause par levier), chacune re-mesurée sur le plan A ; le plan B/C n'a été rejoué qu'à l'état final.
- Scripts : `scratchpad/bench2.js` (balayage instrumenté), `analyze.js` (agrégats), `sources.js` (sources de dégâts, boss, coffre, morts), `diag_orb.js` (échantillonnage d'état), `patch_iter{1,2,3}.js` (modifications appliquées, rejouables).

Limites du bot à garder en tête (elles biaisent les chiffres, pas les conclusions) : il tire 100 % du temps quand une cible est à portée (uptime d'un humain ≈ 50-60 %), il se place à 40 px des ennemis avec une arme de mêlée (dans la portée de bond du Rôdeur, et **au contact du boss** : 40 px < 36 + 14), il ne charge pas l'arc volontairement, il traverse la salle 2 en 6 s sans ramasser les 3 derniers fragments.

---

## 2. Tableaux avant / après

### 2.1 Mode normal, difficulté 1, 48 runs (mêmes seeds avant/après)

| Global | Avant | Après (it. 3) | Cible |
|---|---|---|---|
| Runs atteignant la salle 4 | 50 % | **60 %** | 50-65 % |
| Runs battant le boss | 48 % | 52 % (toutes armes) · 78 % hors orbe/lame/marteau | 30-45 % |
| Morts par salle (S1/S2/S3/S5) | 6 / 7 / 11 / 1 | 7 / 1 / 11 / 4 | — |
| Boss : durée du combat (hors flamme) | 13,4 s (boomerang 6,6 · pistolet 10,7 · chaîne 15,5 · arc 18,6) | **27,8 s** (boomerang 19,2 · pistolet 30,9 · chaîne 30,8 · arc 30,7) | 30-70 s |
| Boss : coups reçus / dégâts subis par combat | 0,8 / 16 | 2,0 / 37 | — |
| Boss : tués par le boss / combats | 1 / 24 | 4 / 29 | ~25-40 % |
| Niveau moyen atteint | 4,7 | 5,0 | — |
| Dégâts subis par run | 103 | 95 | — |

Par arme (victoire = boss tué ; S4+ = coffre atteint ; « boss » = durée réelle premier coup → mort) :

| Arme | Avant : victoires / S4+ | Avant : morts | Avant : DPS obs. | Avant : boss | Après : victoires / S4+ | Après : morts | Après : DPS obs. | Après : boss |
|---|---|---|---|---|---|---|---|---|
| Lame d'essai | 0 % / 0 % | S1:1 S2:3 S3:2 | 25,8 | — | 0 % / 0 % | S2:1 S3:5 | 31,8 | — |
| Masse de pression | 0 % / 17 % | S3:5 S5:1 | 51,2 | 0/1 | 0 % / 33 % | S3:4 S5:2 | 55,0 | 0/2 |
| Arc tendeur | 83 % / 83 % | S3:1 | 31,7 | 18,6 s | 50 % / 67 % | S1:1 S3:1 S5:1 | 33,2 | 30,7 s |
| Pistolet à ricochet | 67 % / 67 % | S3:2 | 28,3 | 10,7 s | 83 % / 100 % | S5:1 | 37,6 | 30,9 s |
| Boomerang de rappel | 67 % / 67 % | S2:2 | 27,5 | 6,6 s | 83 % / 83 % | S3:1 | 38,0 | 19,2 s |
| Orbe orbitale | 0 % / 0 % | S1:5 S2:1 | 6,1 | — | 0 % / 0 % | S1:6 | 11,4 | — |
| Arc voltaïque | 100 % / 100 % | — | 36,7 | 15,5 s | 100 % / 100 % | — | 47,5 | 30,8 s |
| Brûleur court | 67 % / 67 % | S2:1 S3:1 | 37,0 | **0,6 s** (bug) | 100 % / 100 % | — | 74,4 | **1,4 s** (bug) |

Par salle (temps moyen / coups moyens sur les runs qui y sont passés ; refTime 45/60/75/20/120) :

| Salle | Avant | Après | Cible bot |
|---|---|---|---|
| S1 Préparation + combat | 15,8 s / 1,7 coup | 16,3 s / 1,7 | 25-50 s |
| S2 Pièges | 9,1 s / **3,3 coups** | 6,4 s / **1,4 coup** | 0-2 coups |
| S3 Combat + pièges | 17,7 s / 2,4 | 17,6 s / 2,6 | 40-80 s |
| S4 Coffre | 4,1 s / 0 | 4,0 s / 0 | — |
| S5 Mini-boss (salle entière) | 16,5 s / 0,8 | 25,6 s / 2,0 | boss 30-70 s |

Sources de dégâts par run (moyenne sur les runs qui visitent la salle), avant → après :
- S1 : Rôdeur contact 20,9 → 15,0 (lame seule : 55,8 → 45,3) ; Nuée 3,5 → 10,0 (elle survit plus longtemps à 10 PV) ; Sentinelle 1,4 → 1,0.
- S2 : dalles 23,2 (1,98 coup) → 9,9 (0,83) ; balayage 14,0 (1,02) → 0 (0) ; scie 9,8 → 9,2 ; tourniquet 1,9 → 3,5.
- S3 : tourniquet 9,9 → 7,3 ; Bloc 8,4 → 11,2 (175 PV, il vit plus longtemps) ; tourelles 6,9 → 8,8 ; dalles 6,3 → 2,0 ; Rôdeur 2,0 → 5,2.
- S5 : contact boss 8,2 → 16,7 (marteau : 89,6 dès l'avant) ; projectiles 7,7 → 15,2 ; slam 0 → 5,2.

### 2.2 Difficultés et mode test (4 armes × 2 seeds, avant = baseline initiale, après = it. 3)

| Config | Avant : victoires / S4+ | Avant : boss (salle) | Après : victoires / S4+ | Après : boss (salle) |
|---|---|---|---|---|
| Normal d0,75 | 75 % / 88 % | 11,9 s | 75 % / 100 % (lame 0/2, morte au boss) | 25,6 s |
| Normal d1,5 | 13 % / 13 % | 13,7 s | 13 % / 25 % | 43,7 s |
| Test d1 | 100 % / 100 % | 9,8 s | 88 % / 100 % (lame 1/2) | 24,5 s |
| Test d2 | 25 % / 38 % | 16,5 s | 50 % / 63 % | 30,3 s |

Note : en d1,5 et d2 les pièges frappent au carré de la difficulté (bug §4.3) : dalles 26,6/coup en d1,5 (attendu 15), balayage 52/coup en d2 (attendu 28), ce qui explique la falaise entre d1 et d1,5.

### 2.3 Trajectoire des itérations (plan A, 48 runs)

| | Baseline | It. 1 | It. 2 | It. 3 |
|---|---|---|---|---|
| S4+ | 50 % | 60 % | 63 % | 60 % |
| Victoires | 48 % | 54 % | 56 % | 52 % |
| Combat de boss (toutes armes, flamme incluse) | 10,9 s | 13,1 s | 18,5 s | 20,5 s |
| Coups en S2 | 3,3 | 1,6 | 1,3 | 1,4 |
| Boomerang : coups dans le dos / combat | 7-10 | 11-17 | 14-22 | 23-34 (×1,6, fenêtre 0,6 s) |

---

## 3. Changements appliqués à `dev/content.js`

Toutes les valeurs sont chiffrées, aucun id/champ/objet ajouté ou retiré. `index.html` régénéré, syntaxe vérifiée après chaque itération.

| It. | Objet | Champ | Avant → Après | Raison mesurée |
|---|---|---|---|---|
| 1 | boss_etalon_07 | hp | 900 → 1170 | boss tué en 10,9 s (cible 30-70) |
| 2 | boss_etalon_07 | hp | 1170 → 1500 | encore 13 s après it. 1 |
| 3 | boss_etalon_07 | hp | 1500 → **1900** | 18,5 s après it. 2 ; bot à 100 % d'uptime |
| 1 | boss_etalon_07 | weakness.damageMul | 2,0 → 1,6 | boomerang/ricochet : 7-10 coups dans le dos par combat, boss tué en 2-8 s |
| 1 | boss_etalon_07 | weakness.stunCooldown | 3,0 → 4,0 | idem (stun toutes les 3 s = boss passif) |
| 3 | boss_etalon_07 | weakness.window | 0,8 → 0,6 | boomerang toujours à 13-26 s avec 1500 PV |
| 1 | boss phase 1 | ring.cooldown / charge.cooldown / slam.cooldown | 3,5 → 2,6 / 5,0 → 3,8 / 6,0 → 4,5 | boss inoffensif : 16 dégâts par combat, 0,8 coup |
| 1 | boss phase 2 | fan / spiral / summon / charge cooldown | 2,5 → 1,9 / 6,0 → 4,5 / 9,0 → 7,0 / 5,0 → 3,8 | idem |
| 3 | boss phase 1 | ring.projDamage / charge.damage / slam.damage | 12 → 15 / 20 → 25 / 25 → 31 | 2 coups par combat ne menacent pas (25 dégâts) |
| 3 | boss phase 2 | fan.projDamage / spiral.projDamage / charge.damage | 12 → 15 / 10 → 13 / 22 → 27 | idem |
| 2 | boss_etalon_07 | damage (contact) | 18 → 14 | le bot mêlée reste au contact : 40-90 dégâts de contact par combat (marteau) ; le danger doit venir des patterns |
| 1 | enemy_rodeur | damage | 10 → 8 | contact Rôdeur = 56-77 dégâts/run en S1 pour lame/orbe |
| 1 | enemy_bloc | damage | 15 → 12 | contact Bloc = 43 dégâts/run en S3 pour le marteau (charge ×1,5 → 18) |
| 2 | enemy_rodeur / sentinelle / bloc / meche / nuee | hp | 30 → 38 / 26 → 32 / 140 → 175 / 18 → 22 / 8 → 10 | salles 1 et 3 trop courtes (16-18 s) ; effet nul sur la durée (voir §5.1), conservé car il ramène pistolet/chaîne/arc vers 80 % |
| 2 | weapon_blade | damage | 18 → 22 | compense les +25 % PV : Rôdeur toujours en 2 coups, Nuée en 1 |
| 1 | weapon_orb | range / size / special.radius / special.angularSpeed | 90 → 65 / 14 → 18 / 90 → 65 / 4,5 → 5,8 | anneau creux (§4.2) ; atténuation partielle, insuffisante sans correctif moteur |
| 1 | trap_dalles | period | 2,0 → 2,6 | 1,98 coup/run en S2 (cible 0-2 au total) |
| 1 | trap_balayage | period | 4,0 → 5,0 | 1,02 coup/run en S2 |

Descriptions désormais obsolètes (chaînes, non modifiées) : `weapon_blade.desc` « (54 DPS) » → 66 DPS ; `weapon_orb.desc` « 2 orbes… » rayon 90 ; `boss.weakness.desc` « ×2 … 0,8 s » → ×1,6 / 0,6 s ; `boss.revenge.desc` « 1440 PV » → 3040 PV (1900 × 1,6) ; CONTENT.md §13.8 (« 900 PV »).

---

## 4. Bugs moteur trouvés (non corrigés)

### 4.1 Brûleur court : 14× trop de projectiles (bloquant pour le boss)
- Fichier : `dev/30_entities.js`, `Weapons.flame` : `pl.flameAcc = (pl.flameAcc || 0) + dt * rate * 14;` puis chaque particule fait `Weapons.dmgOf(pl)` (6 dégâts pleins) avec `pierce: 2 + st.pierce`.
- Symptôme : 140 particules/s × 6 = 840 DPS nominal contre toute cible qui remplit le cône. Le boss (rayon 36) meurt en **0,6 s (900 PV) / 0,9-1,9 s (1900 PV)**, 159-318 impacts, quel que soit le niveau. Sur les petits ennemis la dispersion masque le problème (DPS observé 37-74, dans la norme).
- Reproduction : `await __autoplay({seed:507, weapon:'weapon_flame', skill:'skill_magnet', mode:'normal', difficulty:1, timeScale:40})` → `roomTimes[4].time ≈ 4,7 s` ; ou panneau debug → Aller salle 5 avec le Brûleur : le boss meurt avant la fin de son intro.
- Correctif proposé : `dt * rate` (10 ticks/s comme dans la desc) en gardant `damage: 6`, ou garder 14 particules par tick mais `damage / 14` par particule. Aucune valeur de contenu n'a été changée pour la flamme : après correctif, 60 DPS nominal est correct.

### 4.2 Orbe orbitale : anneau creux, dilaté quand on tire
- Fichier : `dev/30_entities.js`, `Weapons.orbital` : `targetR = range * st.range * (firing ? (w.special.expand || 1.35) : 1)` ; les orbes ne touchent que dans la couronne `orbR ± (size + e.r)`.
- Symptôme : la Nuée et le Rôdeur collent le joueur à 22-30 px (échantillonné : `nuee(chase,d23..31)` pendant 30 s), la Sentinelle reste à 300-400 px ; rien n'est jamais dans la couronne (62-114 px avec rayon 65 dilaté à 88). Résultat bot : **0/12 sorties de la salle 1, 1 timeout à 420 s**, 6-11 DPS observé (48 annoncé par orbe). Un humain ne peut pas non plus toucher un ennemi au contact.
- Reproduction : `await __autoplay({seed:213, weapon:'weapon_orb', skill:'skill_dash', mode:'normal', timeScale:40, maxSeconds:120})` → `outcome:'timeout'`, `roomReached:1`.
- Correctif proposé : contracter (0,75) au lieu de dilater l'anneau en tir, ou compter comme touché tout ennemi à distance ≤ orbR + size du joueur (disque plein) ; et dans `70_debug.js` `botControl`, `wantDist` pour `orbital` = `range * 0,9` maintient les cibles sur le bord de l'anneau.

### 4.3 Dégâts des pièges multipliés deux fois par la difficulté
- Fichiers : `dev/34_traps.js:18` `this.damage = Math.round(def.damage * d.damageMul)` (d = `G.difficulty`, déjà × `G.debug.difficulty`) **et** `dev/30_entities.js` `Combat.hitPlayer` : `if (info.type === 'trap') dmg *= pl.stats.trapDamageMul * G.debug.difficulty`.
- Symptôme mesuré : d0,75 → dalles 6,2/coup (attendu 7,5) ; d1,5 → dalles 26,6 et tourniquet 28,2/coup (attendus 15 et 18) ; d2 → balayage 52/coup (attendu 28). Avec le malus « Sol instable » (×2) une dalle fait 80 en d2. Le rayon `laser_sweep` du boss revanche passe par le même chemin (`type:'trap'`). Les projectiles de pièges (`proj:trap`) ne sont comptés qu'une fois (12,6/coup en d1,5) : incohérent avec les lasers/dalles.
- Reproduction : `await __autoplay({seed:301, weapon:'weapon_bow', skill:'skill_shockwave', mode:'normal', difficulty:1.5})` puis comparer les floaters « -27 » sur les dalles (10 × 1,5 attendu = 15).
- Correctif : supprimer le facteur `G.debug.difficulty` dans `hitPlayer` (garder `trapDamageMul`), ou ne pas multiplier dans le constructeur de `Trap`.

### 4.4 Cause de mort jamais renseignée
- `dev/40_room.js:250` : `r.stats.deathCause = Run.lastDamageSource || 'inconnu'` mais `Run.lastDamageSource` n'est assigné nulle part (`grep lastDamageSource dev/*.js` → une seule occurrence). Toutes les morts sont « inconnu » dans l'écran de fin et les stats. Correctif : renseigner `Run.lastDamageSource` dans `Combat.hitPlayer` à partir de `info` (`type`, `source`).

### 4.5 L'autoplay en mode normal écrit dans la vraie sauvegarde
- `dev/70_debug.js` `autoplay()` fait `Meta.setMode(c.mode)` ; en `'normal'`, `Meta.addCoins` / `Meta.recordRun` / `unlockLore` passent par `save()` → localStorage. Après 48 runs de test le profil réel affiche 4 181 crédits, 48 runs, fragments de lore débloqués. Reproduction : lancer `__autoplay({mode:'normal'})` puis recharger la page et ouvrir le hub. Correctif : profil jetable (`fresh()` sans passifs) pendant `G.autoplay`, ou inhiber `save()` tant que `G.autoplay` est non nul.

### 4.6 Divers (mineurs)
- `dev/32_enemies.js` : `contactDamage()` est défini deux fois (méthode de classe puis `Enemy.prototype.contactDamage = …`) ; le second gagne et code en dur ×1,5 pour la charge du Bloc : le champ de contenu `behavior.chargeDamageMul` est ignoré. `contactDamageTank()` est mort.
- `dev/40_room.js` `finishRoom` : la salle 2 vaut 1,0 (score « parfait ») dès que `hits === 0`, même en traversant en 6 s sans les fragments 3-5 ; le coffre affiche alors « Sans dégât : Colossal garanti » (run chaîne #506 : S2 en 8 s, 0 fragment, colossal). Note d'équilibrage CONTENT.md §13.7 confirmée : le score de S2 doit tenir compte des fragments.
- `dev/70_debug.js` bot : `wantDist = 40` pour la mêlée est inférieur à `boss.r + pl.r = 50` → contact permanent avec le boss (14 dégâts / 0,7 s) ; les morts de la Masse en S5 viennent de là, pas du contenu.
- Le résultat d'`__autoplay` n'expose pas `skillUses` ni `deathCause` (présents dans `G.run.stats`) ; ajoutés par enveloppe pour ce rapport.

---

## 5. Déséquilibres restants et recommandations

### 5.1 Salles 1 et 3 trop courtes : c'est structurel, pas une affaire de PV
+25 % de PV sur les cinq ennemis n'a changé ni S1 (15,8 → 16,3 s) ni S3 (17,7 → 17,6 s) : le temps de salle est dominé par les déplacements et les délais de vague (spawn 0,6 s + 0,5 s après « clear »), pas par le temps de kill (< 1 s par ennemi à 50 DPS). Pour atteindre 25-50 s en S1 et 40-80 s en S3 il faut plus d'ennemis par vague ou une 4e vague (champs `count`/`waves`, hors périmètre de ce passage), ou des vagues déclenchées au temps (`at: <s>`) plutôt qu'au « clear ». Recommandation : S1 +1 Rôdeur et +1 Sentinelle par vague 2/3, S3 une 4e vague (Éclipse ×2 + Nuée) ; puis reprendre les PV à 30/26/140/18/8 si la durée dépasse la cible.

### 5.2 Boss : encore sous la cible pour le bot, probablement bon pour un humain
1900 PV donnent 28 s de combat pour un bot à 100 % d'uptime (boomerang 19 s, arc/pistolet/chaîne 31 s). Un humain qui esquive (uptime 50-60 %) et exploite le dos (×1,6) devrait être vers 40-60 s : je recommande de **ne pas dépasser 1900** sans playtest humain ; s'il faut allonger, baisser le `cooldown` de charge (plus de charges dans les murs = plus d'occasions dans le dos) plutôt que les PV (CONTENT.md §13.8). Le boss ne tue encore que 14 % des arrivants (cible ~25-40 %) : le levier suivant est la télégraphie (`telegraph` 0,8 → 0,6 sur ring/fan) ou `projSpeed` du ring 260 → 320, à essayer un à la fois.

### 5.3 Boomerang de rappel : le passage retour est toujours un coup dans le dos
23-34 coups dans le dos par combat (chaque retour vient de derrière si le boss regarde le joueur). Avec ×1,6 et fenêtre 0,6 s le boss tombe encore en 13-26 s. Options : (a) moteur : ne pas compter le passage retour (`p.returning`) comme coup dans le dos, ou limiter la règle `back` aux projectiles dont l'origine est derrière le boss ; (b) contenu : `damage` 22 → 18 (le boomerang est déjà 100 % en normal avec le boss facile). Je recommande (a) : c'est une exploitation involontaire de la règle, pas un problème de chiffres.

### 5.4 Armes de mêlée : 0 % avec le bot, à valider en jeu humain
Lame, Masse et Orbe ne sortent pas de la salle 3 avec le bot (S1 : 5,8 coups de Rôdeur pour la lame). Les changements appliqués (Rôdeur 8, Bloc 12, contact boss 14, lame 22) réduisent la punition sans rendre le bot compétent. À rejouer à la main : si la Lame reste < 15 % chez un humain, monter `knockback` 1,0 → 1,3 (repousse hors de la portée de bond) avant de toucher aux dégâts. La Masse a le meilleur DPS observé (55) : son problème est uniquement l'exposition.

### 5.5 Pistolet, chaîne, arc entre 83 et 100 %
Après it. 3 : chaîne 100 %, pistolet 83 %, boomerang 83 % (arc 50 %). Ces armes bénéficient du bot qui esquive bien et tire sans arrêt ; la cible « aucune arme > 80 % » n'est pas atteinte. Ne pas les nerfer avant le correctif §4.1-4.3 et un playtest : la chaîne (48 DPS solo) est dans la norme, sa force vient des groupes (Nuée) et de la sécurité à 420 px.

### 5.6 Difficulté
d0,75 : 75 % de victoires, boss 26 s ; d1,5 : 13-25 % ; d2 (test) : 50 %. La marche d1 → d1,5 est trop raide **à cause du bug §4.3** (pièges ×2,25) ; à re-mesurer après correctif. La formule `speedMul = 0,7 + 0,3·d` est douce, la formule `hpMul = d` est raide : envisager `hpMul = 0,5 + 0,5·d` si la marche reste trop forte.

### 5.7 Méta et malus de niveau
« Fragile » (−25 % PV) apparaît dans 10 des 22 morts en S1-S3 après it. 3, « Protocole d'urgence » dans 8 (le contact répété du Bloc/boss profite de l'invulnérabilité à 0,3 s). « Sol instable » ×2 devient ×8 en d2 avec le bug §4.3. Rien à changer côté contenu tant que le bug est là ; plafonner ensuite `trapDamageMul` effectif à 3.

### 5.8 Vérifications fonctionnelles (toutes OK)
- **8 compétences utilisées** : dash 7, bouclier 16, onde 14, dilatation 12, tourelle 18, saut 10, aimant 14, surrégime 14 (105 usages / 48 runs).
- **4 raretés** vues dans 219 écrans de choix : commun 341, rare 177, épique 111, colossal 28 (≈ 52/27/17/4 %, cohérent avec luck 4).
- **Coffre S4** : sous-titre = fenêtre S1-3 · qualité · plancher ; vérifié sur 27 coffres : qualité 38-49 % → « Tirage normal », 54-79 % → « Rare garanti » (≥ 1 rare proposé), 81-91 % → « Épique garanti » (≥ 1 épique), 100 % → « Colossal garanti » (colossal proposé). `G.run.scores` cohérent avec les `roomTimes` (score 0,1 = 5 coups, 0,58 = 2 coups, 1 = 0 coup).
- **Checkpoint S4** : `coinsPending` 44-55 → 0, `coinsValidated` = montant, `lastCheckpoint` = 4 (27/27).
- **Mort** : pièces conservées = `floor(pending × 0,1 × (salle − checkpoint))` : S2 19 → 3, S3 39 → 11, S5 après checkpoint → 0 + 45-53 validés ; `Meta.profile.coins` augmente exactement du montant (48/48). **Victoire** : validés + pending + 60 (157-179).
- **Bonus S2 « Traversée parfaite »** (+30 XP) déclenché à 0 coup ; XP de S2 sans fragments : voir §4.6.

---

## 6. Ce qu'il reste pour la phase 2

- **Salles 6-9** : `Run.nextRoom` s'arrête à `maxPhase1 = 5` et `Room.load` refuse `ROOM_TYPES.phase > 1` ; les squelettes existent dans `content.js` (S6 combat modulaire avec Éclipse/Incubateur, S7 grille + nappe de gaz, S8 coffre final, S9 boss revanche). Aucun de ces ennemis (Éclipse, Incubateur) ni pièges (grille, nappe) n'a été mesuré : les valeurs sont brutes. Prévoir pour l'Incubateur le plafond `max 3` (CONTENT.md §13.11) et un test dédié de la Nuée × Fragile × Protocole d'urgence (§13.4).
- **Salles modulaires** : champ `modular: []` vide partout, crochet présent mais aucun module à tester.
- **Biome 2** : un seul biome ; `biomes[].difficulty` multiplicateurs jamais ≠ 1 en jeu.
- **Boss revanche** (`revenge`) : `hpMul 1,6` → 3040 PV avec le nouveau socle ; réviser (1,3 ?) après playtest humain de S5 ; `laser_sweep` passe par `type:'trap'` (bug §4.3) ; la plaque dorsale (6 impacts) et les patterns copiés de la compétence ne sont pas implémentés.
- **Manette / mobile** : `Input` clavier-souris uniquement (`Input.axis`, `Input.mouse`) ; pas de mapping gamepad ni de pointeur tactile / sticks virtuels (`grep gamepad|touch dev/*.js` : aucune occurrence) ; `shell.html` a bien un `meta viewport`, mais le rendu reste en 1280×720 logique.
- **Moteur, à corriger avant tout nouvel équilibrage** : §4.1 (flamme), §4.2 (orbe), §4.3 (pièges × difficulté²), §4.5 (autoplay et sauvegarde), puis rejouer `bench2.js plan_A6.json` pour ré-étalonner ; ensuite seulement revisiter le boomerang (§5.3) et les PV du boss (§5.2).
- **Harness** : exposer `skillUses`, `deathCause`, sources de dégâts et durée du combat de boss dans le résultat d'`__autoplay` (tout existe dans les enveloppes de `scratchpad/bench2.js`) ; bot mêlée : `wantDist` ≥ `e.r + pl.r + 10` ; bot S2 : ramasser les fragments jusqu'à 30 s.

---

## Résumé (10 lignes)

1. ~330 runs automatisés (8 armes, 3 difficultés, 2 modes), 0 erreur JS ; harness instrumenté pour les sources de dégâts, le boss, les compétences, les raretés, le coffre et les pièces.
2. Baseline : boss tué en 11 s (flamme 0,6 s, boomerang 7 s), inoffensif (16 dégâts/combat), 100 % de victoire dès la salle 4 ; salle 2 à 3,3 coups/run ; orbe incapable de sortir de la salle 1.
3. Trois itérations sur `content.js` : boss 900 → 1900 PV, faiblesse ×2/0,8 s → ×1,6/0,6 s, cooldowns −25 %, dégâts de patterns +25 %, contact 18 → 14 ; Rôdeur 10 → 8 et Bloc 15 → 12 de dégâts ; PV ennemis S1/S3 +25 % ; lame 18 → 22 ; orbe 90/14/4,5 → 65/18/5,8 ; dalles 2,0 → 2,6 s et balayage 4,0 → 5,0 s.
4. Résultat (normal d1) : 60 % des runs atteignent le coffre (cible 50-65 ✓), salle 2 à 1,4 coup ✓, combat de boss 13 → 28 s (arc/pistolet/chaîne ≈ 31 s, boomerang 19 s), boss 2× plus dangereux.
5. Non atteint : 52 % de victoires (cible 30-45) parce que les armes à distance restent à 83-100 % avec un bot qui tire en continu ; mêlée et orbe à 0 % (limite du bot + bug orbe).
6. Salles 1 et 3 restent à 16-18 s : +25 % de PV n'a rien changé, il faut plus d'ennemis/vagues (hors périmètre données).
7. Bugs moteur bloquants : flamme ×14 projectiles (boss en 1 s), orbe à anneau creux et dilaté au tir, pièges multipliés deux fois par la difficulté (×4 en d2).
8. Bugs mineurs : cause de mort jamais renseignée, autoplay normal qui écrit dans la sauvegarde réelle, `chargeDamageMul` ignoré, score parfait de S2 sans fragments.
9. Fonctionnel validé : 8 compétences, 4 raretés, plancher du coffre cohérent avec les scores, checkpoint et pourcentage de pièces à la mort exacts sur 48/48 runs.
10. Priorités : corriger §4.1-4.3 et 4.5, rejouer le plan A, playtest humain de la lame et du boss avant tout nouveau réglage ; phase 2 = salles 6-9, modules, biome 2, boss revanche, manette/mobile.

---

## 7. Suite donnée par l'agent principal (après le rapport)

Bugs moteur corrigés dans `dev/` et vérifiés par un nouveau balayage (8 armes × 8 compétences, mode normal, difficulté 1, 0 erreur JS) :

| Bug | Correctif |
|---|---|
| 4.1 Brûleur ×14 projectiles | 3 particules par tick à 1/3 des dégâts chacune, sans crit : DPS nominal = dégâts × cadence. Le boss n'est plus tué en 0,6 s (le bot Brûleur meurt en salle 3 à 44 s). |
| 4.2 Orbe à anneau creux | Tirer resserre l'anneau (×0,7) au lieu de le dilater ; le bot vise le bord de l'anneau. L'orbe atteint la salle 3 avec 26 kills (0 sortie de salle 1 auparavant). |
| 4.3 Pièges ×difficulté² | Le facteur `G.debug.difficulty` est retiré de `Combat.hitPlayer` ; seule la construction du piège applique la difficulté. |
| 4.4 Cause de mort | `Run.lastDamageSource` renseigné à chaque coup subi (type + nom de l'ennemi ou du piège), exposé dans `__autoplay` (`deathCause`, `skillUses`). |
| 4.5 Autoplay et sauvegarde | Le mode `normal` de l'autoplay utilise un profil jetable (`Meta.setMode('sandbox')`) ; la sauvegarde réelle n'est plus touchée. |
| 4.6 `chargeDamageMul` ignoré | Méthode unique `contactDamage()` qui lit `behavior.chargeDamageMul`. |
| 4.6 Score parfait de la salle 2 sans fragments | Le score d'une salle de pièges est pondéré par les fragments ramassés (sans dégât : 1,0 seulement si tous les fragments sont pris, sinon 0,8 → 0,99). |
| 4.6 Bot au contact du boss | Distance visée en mêlée = rayon du boss + rayon du joueur + 14 px. |
| 5.3 Boomerang | Le passage retour d'un projectile ne compte plus comme un coup dans le dos. |
| 5.1 Salles 1 et 3 courtes | Une 4e vague ajoutée à chaque salle (Éclipse, Nuée, Incubateur en renfort). Salle 1 dure désormais 25-50 s pour le bot. |

Balayage final (mode normal, difficulté 1, bot aléatoire, 1 seed par arme) : pistolet, boomerang et foudre battent le boss (82-121 s de run) ; lame, orbe, brûleur meurent en salle 3 ; masse en salle 2 ; arc meurt sur le boss. À confirmer par un playtest humain avant tout nouveau réglage.
