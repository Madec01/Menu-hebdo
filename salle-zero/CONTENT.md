# SALLE ZÉRO — CONTENT.md (phase 1, biome 1)

> Livrable de l'Agent Design de contenu. Ce document est la version lisible de `dev/content.js` ; les tableaux ci-dessous sont **générés depuis ce fichier**, qui fait foi. Toutes les valeurs respectent `SCHEMA.md` (stats, hooks, effets), sauf les 3 effets `NEW:` documentés en §12.

Repères : PV joueur 100, vitesse 260 px/s, tuile 48 px, salle 24×13 tuiles (x 0..23, y 0..12), entrée à gauche (x=0, y=6), sortie à droite (x=23, y=6). DPS cible arme nue : 40-70.

Volumes : characters 2 · weapons 8 · skills 8 · upgrades 51 · metaPassives 16 · biomes 1 · enemies 7 · bosses 1 · traps 8 · rooms 9.

## 1. Personnages

| id | Nom | PV | Vitesse | Dégâts | Chance | Arme de départ | Débloqué | Prix |
|---|---|---|---|---|---|---|---|---|
| `char_neuf` | Neuf (Sujet 09) | 100 | 260 | ×1 | 2 | `weapon_blade` | oui | 0 |
| `char_marge` | Marge | 80 | 280 | ×1 | 0 | `weapon_pistol` | non | 400 |

| Personnage | Trait | Effet | mods | hooks |
|---|---|---|---|---|
| Neuf (Sujet 09) | **Tolérance tissulaire** | Les greffes prennent mieux : +20 % XP, +2 chance. Cicatrise 10 % des PV max à chaque nouvelle salle. | xpGain ×1.2, luck +2 | onRoomStart:heal_on_room (fraction=0.1) |
| Marge | **Connaissance du Site** | Pièges : -50 % dégâts subis. Fragments d'énergie doublés. +20 % vitesse pendant 2 s quand un piège vous touche. | trapDamageMul ×0.5 | passive:fragments_double; onTrapDamage:speed_burst (speedMul=1.2 duration=2) |

Neuf (LORE §6, *Tolérance tissulaire*) : le personnage "école", 100 PV ; il monte de niveau 20 % plus vite et voit plus d'épiques : c'est le personnage qui **collectionne les greffes**. Marge (LORE §6, *Connaissance du Site*) : 80 PV mais les pièges ne lui font que la moitié, les fragments sont doublés et un piège qui la touche l'accélère : les salles de pièges deviennent son terrain, et *Sol instable* (×2) redevient un simple ×1 pour elle. Pistolet de départ pour rester à distance avec moins de PV.

## 2. Armes

| id | Nom | Famille | Type | Dégâts | Cadence /s | Portée px | Vit. proj. | Proj. | Perfo | Rebond | Recul | Taille | Charge | Particularité | DPS nu | Prix |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `weapon_blade` | Lame d'essai | blade | melee | 18 | 3 | 70 | — | 0 | 0 | 0 | ×1 | 60 | — | sweep arc=2.18 hitAllInArc=true | 54 | débloquée |
| `weapon_hammer` | Masse de pression | hammer | area | 60 | 0.8 | 95 | — | 0 | 0 | 0 | ×2.5 | 85 | — | slam stunTime=0.4 windup=0.25 | 48 / cible (zone) | 150 |
| `weapon_bow` | Arc tendeur | bow | ranged | 30 | 1.6 | 720 | 900 | 1 | 1 | 0 | ×1.2 | 6 | 0.25-1 s ×3 | — chargedPierceBonus=2 chargedProjSpeedMul=1.4 | 48 spam · 72 chargé | 200 |
| `weapon_pistol` | Pistolet à ricochet | pistol | ranged | 14 | 4 | 620 | 760 | 1 | 0 | 2 | ×0.8 | 5 | — | ricochet seekRadius=220 seekOnBounce=true | 56 | débloquée |
| `weapon_boomerang` | Boomerang de rappel | boomerang | ranged | 22 | 1.4 | 380 | 620 | 1 | 99 | 0 | ×1 | 12 | — | return passes=2 maxInFlight=1 returnSpeedMul=1.15 | 62 (2 passages) | 220 |
| `weapon_orb` | Orbe orbitale | orb | orbital | 12 | 4 | 90 | — | 2 | 99 | 0 | ×0.6 | 14 | — | orbit radius=90 angularSpeed=4.5 tickRate=4 blocksProjectiles=false | 48 / orbe (contact) | 250 |
| `weapon_chain` | Arc voltaïque | chain | ranged | 24 | 2 | 420 | 1400 | 1 | 0 | 0 | ×0.5 | 6 | — | chain jumps=2 radius=160 damageMul=0.6 | 48 solo · ~105 sur 3 | 300 |
| `weapon_flame` | Brûleur court | flame | area | 6 | 10 | 170 | — | 0 | 99 | 0 | ×0.3 | 170 | — | cone angle=0.7 burnDps=4 burnDuration=2 | 60 + brûlure 4/s | 280 |

Profils : Lame = sûr/soutenu sans portée ; Masse = burst lent, zone, étourdit (risqué au corps à corps) ; Arc = burst à charge, récompense la précision ; Pistolet = soutenu sûr, dégâts indirects par ricochet ; Boomerang = fenêtre de vulnérabilité pendant le retour, mais 2 passages ; Orbe = zéro visée, exige de coller les ennemis ; Foudre = faible en duel, très fort en groupe ; Brûleur = DPS max mais portée 170 px, il faut se coller.

Notes moteur : `weapon_bow.special` porte les bonus de charge (`chargedPierceBonus`, `chargedProjSpeedMul`) ; `weapon_boomerang.special.maxInFlight` limite à 1 boomerang en vol (2 avec la synergie *Triple rappel* via `projectiles`) ; `weapon_orb.projectiles` = nombre d'orbes ; `weapon_flame.fireRate` = ticks/s du cône.

## 3. Compétences actives

| id | Nom | Cooldown | Durée | kind | Paramètres | Description |
|---|---|---|---|---|---|---|
| `skill_dash` | Dash | 6 s | 0.2 s | dash | distance=220, invulnerable=true | Ruée de 220 px, invulnérable pendant 0,2 s. Cooldown 6 s. |
| `skill_shield` | Bouclier | 14 s | 4 s | shield | amount=40 | Bouclier de 40 PV gris pendant 4 s. Cooldown 14 s. |
| `skill_shockwave` | Onde de choc | 10 s | 0.3 s | shockwave | radius=180, damage=45, knockback=2.5 | Repousse et inflige 45 dégâts dans 180 px. Cooldown 10 s. |
| `skill_slowtime` | Dilatation | 20 s | 3 s | slowtime | scale=0.35, playerScale=1 | Le monde ralentit à 35 % pendant 3 s, pas vous. Cooldown 20 s. |
| `skill_turret` | Tourelle | 16 s | 8 s | turret | damage=10, fireRate=3, range=360, hp=60 | Tourelle 60 PV, 10 dégâts ×3/s, portée 360 px, 8 s. Cooldown 16 s. |
| `skill_blink` | Saut de phase | 8 s | 0 s | blink | distance=260, invulnerable=0.15, ignoreObstacles=true | Téléportation de 260 px vers le curseur, 0,15 s invulnérable. CD 8 s. |
| `skill_magnet` | Aimant | 12 s | 2 s | magnet | radius=1400, pullSpeed=900 | Attire tous les pickups de la salle pendant 2 s. Cooldown 12 s. |
| `skill_overdrive` | Surrégime | 18 s | 5 s | overdrive | damageMul=1.5, fireRateMul=1.5, selfDamagePerSec=2 | +50 % dégâts et cadence 5 s, mais 2 PV/s perdus. Cooldown 18 s. |

Le dash est une compétence : un joueur sans *Dash* ni *Saut de phase* n'a aucun déplacement d'urgence et doit compter sur les obstacles et la lecture des télégraphies. *Surrégime* est le 8e choix (préféré à decoy : plus lisible à équilibrer, et il crée un dilemme PV/DPS).

## 4. Améliorations en run (51)

Répartition : Commune 20 · Rare 16 · Épique 10 · Colossale 5. Toutes les descriptions font ≤ 90 caractères.

### 4.1 Communes

| id | Nom | Catégorie | Famille | Stacks | Description | mods | hooks |
|---|---|---|---|---|---|---|---|
| `upg_tranchant` | Tranchant | offense | — | 5 | +15 % dégâts. | damage ×1.15 | — |
| `upg_gachette` | Gâchette | offense | — | 5 | +12 % cadence d'attaque. | fireRate ×1.12 | — |
| `upg_oeil_vif` | Œil vif | offense | — | 5 | +6 % chance de critique. | critChance +0.06 | — |
| `upg_coup_critique` | Coup critique | offense | — | 3 | +40 % dégâts des critiques (×1,5 → ×1,9). | critMult +0.4 | — |
| `upg_longue_portee` | Longue portée | offense | — | 3 | +15 % portée. | range ×1.15 | — |
| `upg_calibrage` | Calibrage | offense | — | 3 | +20 % vitesse des projectiles. | projSpeed ×1.2 | — |
| `upg_plaque` | Plaque | défense | — | 5 | +20 PV max. | maxHp +20 | — |
| `upg_peau_dure` | Peau dure | défense | — | 4 | +1 armure (dégâts plats retirés par coup). | armor +1 | — |
| `upg_cicatrisation` | Cicatrisation | défense | — | 4 | +0,8 PV/s de régénération. | regen +0.8 | — |
| `upg_reflexes` | Réflexes | défense | — | 4 | +5 % d'esquive. | dodge +0.05 | — |
| `upg_semelles` | Semelles | mobilité | — | 4 | +10 % vitesse de déplacement. | speed ×1.1 | — |
| `upg_aimant_de_poche` | Aimant de poche | mobilité | — | 3 | +40 px de rayon d'aimantation des pickups. | pickupRadius +40 | — |
| `upg_recuperation` | Récupération | mobilité | — | 4 | -6 % de cooldown de compétence. | cooldownReduction +0.06 | — |
| `upg_tirelire` | Tirelire | économie | — | 4 | +20 % pièces gagnées. | coinGain ×1.2 | — |
| `upg_apprentissage` | Apprentissage | économie | — | 4 | +15 % XP gagnée. | xpGain ×1.15 | — |
| `upg_trefle` | Trèfle | économie | — | 4 | +2 chance (raretés décalées vers épique/colossal). | luck +2 | — |
| `upg_butin` | Butin | économie | — | 3 | 15 % de chance qu'un kill lâche 1 pièce bonus. | — | onKill:coin_on_kill (chance=0.15 amount=1) |
| `upg_etincelle` | Étincelle | spécial | — | 3 | 15 % de chance de brûler : 5 dégâts/s pendant 2 s. | — | onHit:burn (chance=0.15 dps=5 duration=2) |
| `upg_givre` | Givre | spécial | — | 3 | 12 % de chance de geler : -50 % vitesse pendant 1,2 s. | — | onHit:freeze (chance=0.12 duration=1.2 slow=0.5) |
| `upg_toxine` | Toxine | spécial | — | 3 | 15 % de chance d'empoisonner : 3 dégâts/s, 4 s, cumulable ×3. | — | onHit:poison (chance=0.15 dps=3 duration=4 stacks=3) |

### 4.2 Rares

| id | Nom | Catégorie | Famille | Stacks | Description | mods | hooks |
|---|---|---|---|---|---|---|---|
| `upg_frappe_lourde` | Frappe lourde | offense | — | 3 | +30 % dégâts, -8 % cadence. | damage ×1.3, fireRate ×0.92 | — |
| `upg_double_canon` | Double canon | offense | — | 2 | +1 projectile, -15 % dégâts. | projectiles +1, damage ×0.85 | — |
| `upg_perforation` | Perforation | offense | — | 3 | +1 ennemi traversé par les tirs. | pierce +1 | — |
| `upg_rebond` | Rebond | offense | — | 3 | +1 rebond sur les murs. | bounce +1 | — |
| `upg_vampirisme` | Vampirisme | défense | — | 3 | 4 % des dégâts infligés rendus en PV. | lifesteal +0.04 | — |
| `upg_epines` | Épines | défense | — | 3 | Renvoie 8 dégâts à tout ennemi qui vous touche. | thorns +8 | — |
| `upg_isolant` | Isolant | défense | — | 2 | -40 % dégâts subis des pièges. | trapDamageMul ×0.6 | — |
| `upg_convalescence` | Convalescence | défense | — | 2 | Au début de chaque salle : +20 % PV et 15 PV de bouclier. | — | onRoomStart:heal_on_room (fraction=0.2); onRoomStart:shield_on_room (amount=15) |
| `upg_adrenaline` | Adrénaline | mobilité | — | 2 | Chaque kill : +20 % vitesse pendant 2 s. | — | onKill:kill_speed (speedMul=1.2 duration=2) |
| `upg_enchainement` | Enchaînement | mobilité | — | 2 | Chaque kill : 20 % de chance de réduire le cooldown restant de 50 %. | — | onKill:skill_reset_on_kill (chance=0.2 fraction=0.5) |
| `upg_chaine_eclair` | Chaîne éclair | spécial | — | 3 | 20 % de chance qu'un coup saute sur 2 ennemis (150 px) à 50 %. | — | onHit:chain (chance=0.2 jumps=2 radius=150 damageMul=0.5) |
| `upg_detonation` | Détonation | spécial | — | 2 | Les ennemis tués explosent : 60 % de vos dégâts dans 70 px. | — | onKill:explode (radius=70 damageMul=0.6) |
| `upg_syn_lame_dansante` | Lame dansante | synergie | blade | 2 | Lame : +25 % cadence, chaque kill +15 % vitesse 1,5 s. | fireRate ×1.25 | onKill:kill_speed (speedMul=1.15 duration=1.5) |
| `upg_syn_balles_chercheuses` | Balles chercheuses | synergie | pistol | 2 | Pistolet : +2 rebonds, +10 % dégâts. | bounce +2, damage ×1.1 | — |
| `upg_syn_corde_tendue` | Corde tendue | synergie | bow | 2 | Arc : charge 40 % plus vite, +2 perforation, +30 % vitesse de flèche. | pierce +2, projSpeed ×1.3 | passive:charge_speed (mul=1.4) |
| `upg_syn_combustion` | Combustion | synergie | flame | 2 | Flammes : brûlure garantie 8 dégâts/s 3 s, +20 % taille de cône. | areaSize ×1.2 | onHit:burn (chance=1 dps=8 duration=3) |

### 4.3 Épiques

| id | Nom | Catégorie | Famille | Stacks | Description | mods | hooks |
|---|---|---|---|---|---|---|---|
| `upg_amplificateur` | Amplificateur | mobilité | — | 2 | +30 % effet des compétences, -10 % de cooldown. | skillPower ×1.3, cooldownReduction +0.1 | — |
| `upg_double_charge` | Double charge | mobilité | — | 1 | Votre compétence a 2 charges. | — | passive:double_skill |
| `upg_crit_explosif` | Crit explosif | spécial | — | 1 | Les critiques explosent : 80 % des dégâts dans 60 px. +5 % crit. | critChance +0.05 | onHit:crit_explode (radius=60 damageMul=0.8) |
| `upg_orbes_gardiennes` | Orbes gardiennes | défense | — | 2 | 2 orbes (10 dégâts) tournent à 70 px et bloquent les projectiles. | — | passive:orbit_shield (count=2 damage=10 radius=70) |
| `upg_attraction` | Attraction | économie | — | 1 | Tous les pickups viennent à vous. Fragments d'énergie doublés. +20 % XP. | xpGain ×1.2 | passive:xp_magnet; passive:fragments_double |
| `upg_sang_froid` | Sang-froid | défense | — | 1 | Touché : ralenti 0,8 s à 40 % et +0,3 s d'invulnérabilité. +2 armure. | invulnTime +0.3, armor +2 | onDamaged:time_slow_on_damage (duration=0.8 scale=0.4) |
| `upg_syn_onde_tellurique` | Onde tellurique | synergie | hammer | 1 | Marteau : +35 % zone, +20 % dégâts, les kills explosent (80 %, 90 px). | areaSize ×1.35, damage ×1.2 | onKill:explode (radius=90 damageMul=0.8) |
| `upg_syn_constellation` | Constellation | synergie | orb | 1 | Orbe : +2 orbes, rayon d'orbite +20 %, +15 % dégâts. | projectiles +2, range ×1.2, damage ×1.15 | — |
| `upg_syn_surtension` | Surtension | synergie | chain | 1 | Foudre : chaque coup saute sur 3 ennemis (200 px) à 70 %. | — | onHit:chain (chance=1 jumps=3 radius=200 damageMul=0.7) |
| `upg_syn_triple_rappel` | Triple rappel | synergie | boomerang | 1 | Boomerang : +1 boomerang en vol, +15 % dégâts, +15 % cadence. | projectiles +1, damage ×1.15, fireRate ×1.15 | — |

### 4.4 Colossales

| id | Nom | Catégorie | Famille | Stacks | Description | mods | hooks |
|---|---|---|---|---|---|---|---|
| `upg_rappel` | Rappel | spécial | — | 1 | Vos projectiles reviennent vers vous : un second passage sur tout. | — | passive:projectiles_return |
| `upg_sillage` | Sillage | mobilité | — | 1 | Chaque dash laisse une traînée de feu 2,5 s (25 dégâts/s). +10 % vitesse. | speed ×1.1 | onDash:fire_trail (duration=2.5 dps=25) |
| `upg_symbiose` | Symbiose | défense | — | 1 | Les pièges vous soignent au lieu de vous blesser (100 % des dégâts). | — | passive:traps_heal (fraction=1) |
| `upg_coeur_de_verre` | Cœur de verre | offense | — | 1 | Dégâts ×2, PV max ×0,5. | — | passive:glass_cannon (damageMul=2 hpMul=0.5) |
| `upg_resonance` | Résonance | spécial | — | 1 | Chaque compétence : onde de choc 60 dégâts (200 px) + ralenti 1,5 s à 30 %. | — | onSkill:shockwave (radius=200 damage=60 knockback=3); onSkill:bullet_time_skill (duration=1.5 scale=0.3) |

## 5. Passifs méta (hub) — 16

Économie : une run de niveau 1 réussie rapporte ~120-200 pièces (pièces d'ennemis ~60-80 + fin de niveau + mini-boss 40). Paliers 1 : 40-120. Derniers paliers : 300-600. Coût total pour tout maxer : 12670 pièces (~45-60 runs réussies : horizon long terme).

| id | Nom | Paliers | Prix | Effet par palier | Total maxé |
|---|---|---|---|---|---|
| `meta_vitalite` | Vitalité | 4 | 60 / 140 / 260 / 450 | maxHp +10 / maxHp +10 / maxHp +15 / maxHp +15 | maxHp +50 |
| `meta_puissance` | Puissance | 5 | 80 / 160 / 260 / 400 / 600 | damage ×1.05 / damage ×1.05 / damage ×1.05 / damage ×1.06 / damage ×1.06 | damage ×1.301 |
| `meta_chance` | Chance | 4 | 50 / 120 / 240 / 400 | luck +2 / luck +2 / luck +3 / luck +3 | luck +10 |
| `meta_cupidite` | Cupidité | 4 | 40 / 100 / 200 / 350 | coinGain ×1.1 / coinGain ×1.1 / coinGain ×1.1 / coinGain ×1.15 | coinGain ×1.531 |
| `meta_etude` | Étude | 4 | 40 / 100 / 200 / 350 | xpGain ×1.1 / xpGain ×1.1 / xpGain ×1.1 / xpGain ×1.15 | xpGain ×1.531 |
| `meta_reactivite` | Réactivité | 4 | 70 / 150 / 280 / 450 | cooldownReduction +0.05 / cooldownReduction +0.05 / cooldownReduction +0.05 / cooldownReduction +0.05 | cooldownReduction +0.2 |
| `meta_resurrection` | Résurrection | 3 | 120 / 300 / 550 | résurrection à 25 % PV / résurrection à 40 % PV / résurrection à 60 % PV | — |
| `meta_memoire_selective` | Mémoire sélective | 3 | 100 / 250 / 450 | T1 : garder 1 amélioration commune / T2 : jusqu'à rare / T3 : jusqu'à épique | — |
| `meta_apercu_coffre` | Aperçu du coffre | 3 | 80 / 200 / 380 | T1 : rareté du coffre / T2 : + catégorie / T3 : objet exact | — |
| `meta_quatrieme_choix` | Quatrième choix | 3 | 120 / 300 / 500 | T1 : 4e choix au 1er level-up de chaque salle / T2 : à chaque level-up / T3 : le 4e est rare ou mieux | — |
| `meta_reroll` | Re-roll | 3 | 90 / 220 / 420 | +1 re-roll par run (cumul 1) / +1 re-roll par run (cumul 2) / +1 re-roll par run (cumul 3) | — |
| `meta_celerite` | Célérité | 3 | 60 / 150 / 300 | speed ×1.04 / speed ×1.04 / speed ×1.04 | speed ×1.125 |
| `meta_carapace` | Carapace | 3 | 80 / 200 / 380 | armor +1 / armor +1 / armor +1 | armor +3 |
| `meta_isolation` | Isolation | 3 | 70 / 170 / 320 | trapDamageMul ×0.85 / trapDamageMul ×0.85 / trapDamageMul ×0.85 | trapDamageMul ×0.614 |
| `meta_aimantation` | Aimantation | 3 | 40 / 100 / 220 | pickupRadius +30 / pickupRadius +30 / pickupRadius +40 | pickupRadius +100 |
| `meta_precision` | Précision | 4 | 70 / 150 / 280 / 450 | critChance +0.03 / critChance +0.03 / critChance +0.03 / critChance +0.03 | critChance +0.12 |

Sémantique des `special` : `resurrect` = hook `second_chance` (une fois par run) ; `selective_memory` = à l'écran de prépa, le joueur choisit UNE amélioration de sa dernière run (rareté plafonnée par le palier) et démarre avec ; `chest_preview` = info affichée à l'entrée de la salle 4 ; `fourth_choice` = un 4e slot au level-up ; `reroll` = compteur de re-rolls par run (hook `reroll_on_levelup` cumule les paliers : 1/2/3).

## 6. Biome 1 — ADMISSION

Palier -1, Protocole H-9. L'ancien service d'accueil du Site réaménagé en parcours : guichets devenus couverts, bancs devenus obstacles, rails de brancards devenus rails de pièges. Néons qui clignotent, sols humides. Taux de perte : 71 %.

Difficulté : hp ×1, dégâts ×1, vitesse ×1. Mini-boss : `boss_etalon_07`.

| # | Bonus | Effet | Malus | Effet |
|---|---|---|---|---|
| 1 | **Stimulant** | +15 % vitesse de déplacement. (speed ×1.15) | **Sol instable** | Les pièges infligent le double de dégâts. (trapDamageMul ×2) |
| 2 | **Surcharge** | +25 % dégâts. (damage ×1.25) | **Fragile** | -25 % PV max. (maxHp ×0.75) |
| 3 | **Prime d'essai** | +30 % pièces, +20 % XP. (coinGain ×1.3, xpGain ×1.2) | **Protocole d'urgence** | Invulnérabilité après un coup réduite de 0,6 s à 0,3 s. (invulnTime -0.3) |

Le joueur choisit une paire à l'entrée du niveau. Paire 1 favorise les builds mobiles et punit les salles de pièges ; paire 2 est le pari "verre" ; paire 3 paie en méta mais retire la marge d'erreur (0,3 s d'i-frames : un Bloc + une Nuée peuvent enchaîner).

## 7. Ennemis du biome 1

| id | Nom | Archétype | PV | Vitesse | Contact | Rayon | XP | Pièces | Télégraphie | Comportement (params) |
|---|---|---|---|---|---|---|---|---|---|---|
| `enemy_rodeur` | Rôdeur | rusher | 30 | 200 | 10 | 14 | 4 | 1 | 0.35 s #ffd166 | lungeRange=90, lungeWindup=0.35, lungeSpeed=520, lungeDuration=0.25, lungeCooldown=1.2 |
| `enemy_sentinelle` | Sentinelle | shooter | 26 | 130 | 8 | 14 | 6 | 2 | 0.5 s #7bd3ff | fireRate=0.7, projSpeed=320, projDamage=10, projSize=7, keepDistance=300, aimTime=0.5, burst=1 |
| `enemy_bloc` | Bloc | tank | 140 | 90 | 15 | 24 | 14 | 4 | 0.8 s #ff8c42 | chargeWindup=0.8, chargeSpeed=560, chargeDuration=0.7, chargeCooldown=3, stunOnWallHit=1.2, chargeDamageMul=1.5 |
| `enemy_meche` | Mèche | kamikaze | 18 | 240 | 6 | 12 | 5 | 1 | 0.9 s #ff3b3b | fuse=0.9, radius=80, explosionDamage=22, triggerRange=60, explodeOnDeath=true |
| `enemy_incubateur` | Incubateur | summoner | 80 | 60 | 8 | 20 | 20 | 5 | 0.7 s #b98cff | summon=enemy_nuee, every=4, max=4, keepDistance=350, summonWindup=0.7 |
| `enemy_nuee` | Nuée | swarm | 8 | 300 | 5 | 8 | 3 | 1 | 0.2 s #9cff57 | groupSize=5, jitter=40, biteWindup=0.2, biteCooldown=0.8 |
| `enemy_eclipse` | Éclipse | dasher | 40 | 180 | 12 | 14 | 10 | 3 | 0.45 s #ff6bd6 | blinkRange=260, blinkWindup=0.45, blinkCooldown=2.2, dashSpeed=700, dashDuration=0.3, postDashPause=0.6 |

| Nom | Lecture du comportement |
|---|---|
| Rôdeur | Court vers vous ; à 90 px il se fige 0,35 s puis bondit. Le bond peut être esquivé de côté. |
| Sentinelle | Garde 300 px de distance, vise 0,5 s (ligne pointillée) puis tire une balle lente de 10 dégâts. |
| Bloc | Lent et massif. S'arrête, tremble 0,8 s, puis charge en ligne droite. S'il percute un mur : étourdi 1,2 s. |
| Mèche | Fonce sur vous ; à 60 px la mèche s'allume (0,9 s, clignote) puis explose sur 80 px. Tuez-la loin de vous. |
| Incubateur | Reste à 350 px, gonfle 0,7 s puis libère une Nuée (toutes les 4 s, max 4 vivantes). Priorité de tir. |
| Nuée | Groupe de 5 petits organismes rapides et fragiles. Tremblent 0,2 s avant de mordre. Zone et chaîne les balaient. |
| Éclipse | Rôde à 260 px, se dissipe 0,45 s (silhouette) puis réapparaît et fonce sur vous. Vulnérable 0,6 s après la ruée. |

Lisibilité : chaque ennemi a UNE télégraphie (couleur + durée) avant son seul coup dangereux. Le Bloc en charge fait 15 × 1,5 = 22 dégâts : c'est le seul contact > 15, justifié par 0,8 s de préavis. La Nuée vaut 3 XP par unité (15 XP le groupe) car elle n'est dangereuse qu'en enveloppement.

## 8. Mini-boss

**Étalon 07, dit « le Portier »** (`boss_etalon_07`) — Le sujet de référence d'ADMISSION, gardé comme mètre-étalon. Vérin hydraulique au bras droit, prise de calibration à nu dans le dos. Lourd, prévisible : il faut le faire pivoter.

PV 900 (≈ 18 s à 50 DPS, ~35 s réels avec l'esquive), vitesse 120, rayon 36, contact 18, XP 120, pièces 40.

| Phase | Seuil PV | Pattern | Télégraphie | Durée | Cooldown | Paramètres |
|---|---|---|---|---|---|---|
| 1 | < 100 % | ring | 0.8 s | 0.3 s | 3.5 s | count=12, projSpeed=260, projDamage=12, projSize=8 |
| 1 | < 100 % | charge | 0.9 s | 0.8 s | 5 s | speed=620, damage=20, stopOnWall=true, stunTime=1.5 |
| 1 | < 100 % | slam | 1 s | 0.4 s | 6 s | radius=140, damage=25, knockback=3 |
| 2 | < 50 % | fan | 0.6 s | 0.5 s | 2.5 s | count=7, spread=1.2, projSpeed=300, projDamage=12, projSize=8 |
| 2 | < 50 % | spiral | 0.7 s | 3 s | 6 s | arms=2, rate=12, angularSpeed=2, projSpeed=220, projDamage=10, projSize=7 |
| 2 | < 50 % | summon | 0.8 s | 0.5 s | 9 s | enemy=enemy_nuee, count=4 |
| 2 | < 50 % | charge | 0.7 s | 0.8 s | 5 s | speed=700, damage=22, stopOnWall=true, stunTime=1.5 |

**Faiblesse** (`back`, ×2, fenêtre 0.8 s) : Sa prise de calibration dorsale est à nu : tout coup porté dans un cône de 90° derrière lui fait ×2 et le "débranche" 0,8 s (étourdi, ne se retourne pas). Une charge finie dans un mur (1,5 s d'étourdissement) est le moyen le plus sûr d'atteindre son dos.

Télégraphie : ring = la plaque « 07 » s'illumine et le corps pulse ; charge = il s'accroupit, le vérin se rétracte, une ligne rouge montre la trajectoire ; slam = cercle rouge au sol qui se remplit ; fan = éventail de traits ; spiral = rotation lente visible ; summon = quatre œufs verts au sol. Son dos est dessiné avec la prise de calibration qui clignote : la faiblesse est lisible à l'écran.

Exploiter la faiblesse : (a) après une charge dans un mur, il est étourdi 1,5 s face au mur, dos exposé ; (b) pendant un slam ou une salve, contourner un bloc 2×2 de la salle 5 pour passer derrière ; (c) le Saut de phase / Dash traverse sa hitbox. Un coup dans le dos le débranche 0,8 s (pas de retournement), puis 3 s de délai avant un nouveau débranchement (`stunCooldown`) pour éviter le stun-lock.

**Revanche (salle 9, PRÉVU, non implémenté)** : PV ×1.6. PRÉVU (salle 9) : ÉTALON 07 / rév. B, reconditionné entre les salles 5 et 9. 1440 PV. Une plaque de tôle vissée à la va-vite couvre la prise dorsale : la faiblesse est inactive jusqu'à 6 impacts dans le dos, puis la plaque saute et la faiblesse revient avec une fenêtre de 0,4 s au lieu de 0,8. Ses charges ne s'arrêtent plus dans les murs (0,6 s d'étourdissement). Il a chargé vos données de consignation : en phase 2 il reproduit votre compétence de salle 1 (dash → charge courte, tourelle → summon, onde → slam, blink → téléportation dans votre dos) et ses patterns sous 30 % PV s'inspirent des greffes refusées aux level-ups (proposition lore, à trancher en phase 2).

| Phase extra | Seuil | Pattern | Télégraphie | Durée | Cooldown | Paramètres |
|---|---|---|---|---|---|---|
| R | < 30 % | laser_sweep | 1 s | 2.5 s | 7 s | angularSpeed=1.6, length=700, damage=20 |
| R | < 30 % | ring | 0.5 s | 0.3 s | 2 s | count=16, projSpeed=300, projDamage=14, projSize=8 |
| R | < 30 % | charge | 0.5 s | 0.6 s | 3 s | speed=800, damage=26, stopOnWall=false, stunTime=0.6 |

## 9. Pièges du biome 1 (8 kinds)

Tous les pièges lisent `room.time` : à `phase` près, ils sont strictement périodiques. Une salle de pièges est un puzzle de timing.

| id | Nom | kind | Dégâts | Télégraphie | Période | Actif | Paramètres | Pattern |
|---|---|---|---|---|---|---|---|---|
| `trap_balayage` | Balayage laser | laser_sweep | 14 | 0.8 s | 4 s | 1.6 s | orientation=vertical, pingpong=true, thickness=0.5, hitOnce=true | Un rayon vertical parcourt la zone de gauche à droite en 1,6 s, puis revient au cycle suivant. |
| `trap_tourniquet` | Tourniquet | laser_rotate | 12 | 1 s | 6 s | 5 s | arms=2, lengthTiles=5, angularSpeed=1.2, startAngle=0, thickness=0.4 | 2 bras laser de 5 tuiles tournent (1,2 rad/s). Pause de 1 s tous les 6 s : la fenêtre pour traverser. |
| `trap_grille` | Grille | laser_grid | 10 | 0.5 s | 3 s | 1 s | spacingTiles=4, alternate=true, thickness=0.3 | Lignes laser espacées de 4 tuiles. Cycles alternés : verticales puis horizontales. 1 s allumé, 2 s éteint. |
| `trap_bouche` | Bouche de feu | wall_fireball | 12 | 0.6 s | 2.5 s | 0.2 s | dir=down, projSpeed=320, size=12, count=1, lifetime=3 | Une bouche murale crache une boule de feu droite toutes les 2,5 s. Se décale avec phase. |
| `trap_dalles` | Dalles à pointes | spike_tiles | 10 | 0.5 s | 2 s | 0.8 s | pattern=checker, groups=2, hitOnce=true | Damier : les cases paires sortent leurs pointes 0,8 s, puis les impaires. Toujours une case sûre à côté. |
| `trap_nappe` | Nappe de gaz | gas_zone | 8 | 1.2 s | 7 s | 3 s | radiusTiles=2.5, tickRate=4, slow=0.3, dps=true | Une bouche siffle 1,2 s puis libère un nuage de 2,5 tuiles pendant 3 s : 8 dégâts/s et -30 % vitesse. |
| `trap_rail` | Scie sur rail | saw_rail | 18 | 0.4 s | 3.2 s | 3.2 s | axis=x, lengthTiles=8, speedTiles=6, pingpong=true, radiusTiles=0.6, hitOnce=true | Scie circulaire qui fait des allers-retours sur un rail de 8 tuiles à 6 tuiles/s. Jamais de pause. |
| `trap_tourelle` | Tourelle fixe | turret_fixed | 9 | 0.7 s | 2.4 s | 0.3 s | mode=aim, angle=0, projSpeed=380, count=1, spread=0, projSize=6 | Tourelle murale : 0,7 s de visée (rayon rouge) puis 1 balle vers le joueur toutes les 2,4 s. Destructible ? Non. |

Conventions de placement en salle : `x,y` = coin haut-gauche en tuiles ; `w,h` = zone couverte (balayage : largeur balayée ; dalles : damier ; rail : longueur du rail ; grille : zone quadrillée) ; sans `w,h` = piège ponctuel (tourniquet centré sur la tuile, bouche/tourelle fixées au mur adjacent, nappe centrée). `phase` décale le cycle en secondes. `hitOnce` = un seul coup par joueur et par passage (pas de dégâts continus), sauf la nappe (`dps=true`, 4 ticks/s).

## 10. Salles du biome 1

| index | id | Type | refTime | Obstacles | Vagues | Pièges | Fragments |
|---|---|---|---|---|---|---|---|
| 1 | `room_b1_1` | PREP_COMBAT | 45 s | 5 | 3 | 0 | 0 |
| 2 | `room_b1_2` | TRAP | 60 s | 4 | 0 | 8 | 5 |
| 3 | `room_b1_3` | COMBAT_TRAP | 75 s | 4 | 3 | 5 | 0 |
| 4 | `room_b1_4` | CHEST | 20 s | 4 | 0 | 0 | 0 |
| 5 | `room_b1_5` | MINIBOSS | 120 s | 4 | 1 | 0 | 0 |
| 6 | `room_b1_6` | COMBAT_MODULAR | 80 s | 1 | 3 | 0 | 0 |
| 7 | `room_b1_7` | COMBAT_TRAP_MODULAR | 90 s | 2 | 3 | 2 | 0 |
| 8 | `room_b1_8` | CHEST_FINAL | 20 s | 0 | 0 | 0 | 0 |
| 9 | `room_b1_9` | BOSS_REVENGE | 150 s | 4 | 1 | 2 | 0 |

### Salle 1 — `room_b1_1` (PREP_COMBAT, ref 45 s)

Écran de prépa (arme + compétence), puis 3 vagues faciles. Piliers 1×1 pour apprendre à casser la ligne des Sentinelles ; muret central pour bloquer les bonds de Rôdeur.

Obstacles (tuiles) : (6,3) 1×1 · (6,9) 1×1 · (17,3) 1×1 · (17,9) 1×1 · (11,6) 2×1

| Vague | Déclenchement | Spawns |
|---|---|---|
| 1 | start | 2× `enemy_rodeur` @ (20,3) ; 1× `enemy_rodeur` @ (20,9) |
| 2 | clear | 3× `enemy_rodeur` @ bord aléatoire ; 1× `enemy_sentinelle` @ (21,6) |
| 3 | clear | 1× `enemy_nuee` @ (21,2) ; 2× `enemy_sentinelle` @ (21,10) ; 2× `enemy_rodeur` @ (2,1) |

### Salle 2 — `room_b1_2` (TRAP, ref 60 s)

Aucun ennemi. Trois zones à traverser : damier de pointes (x 3-8), double balayage laser décalé d'un demi-cycle (x 10-14 : le rayon est TOUJOURS quelque part, il faut suivre le trou), couloir de bouches de feu depuis le haut avec scie en travers (x 16-21), tourniquet devant la sortie. 5 fragments d'énergie placés dans les zones dangereuses, apparition échelonnée (0/0/8/16/24 s) pour forcer des allers-retours. Murs partiels en x=9 et x=15 canalisent le passage par le centre.

Obstacles (tuiles) : (9,0) 1×3 · (9,10) 1×3 · (15,0) 1×3 · (15,10) 1×3

| Piège | x,y | w×h | phase |
|---|---|---|---|
| `trap_dalles` | 3,3 | 6×7 | 0 s |
| `trap_balayage` | 10,0 | 5×13 | 0 s |
| `trap_balayage` | 10,0 | 5×13 | 2 s |
| `trap_bouche` | 16,0 | — | 0 s |
| `trap_bouche` | 18,0 | — | 0.8 s |
| `trap_bouche` | 20,0 | — | 1.6 s |
| `trap_rail` | 16,6 | 6×1 | 0 s |
| `trap_tourniquet` | 21,6 | — | 0 s |

Fragments d'énergie : (5,6) à 0 s · (12,6) à 0 s · (18,2) à 8 s · (19,6) à 16 s · (21,4) à 24 s

### Salle 3 — `room_b1_3` (COMBAT_TRAP, ref 75 s)

Tourniquet au centre (bras de 5 tuiles : il découpe la salle en 4 quadrants tournants), dalles à pointes dans deux coins (spawn d'ennemis), deux tourelles murales déphasées. Vague 2 introduit le Bloc : sa charge le fait traverser le tourniquet, qui le blesse aussi (les ennemis subissent les pièges à 50 % — règle proposée §13).

Obstacles (tuiles) : (4,2) 2×1 · (4,10) 2×1 · (18,2) 2×1 · (18,10) 2×1

| Vague | Déclenchement | Spawns |
|---|---|---|
| 1 | start | 3× `enemy_rodeur` @ (20,6) ; 2× `enemy_sentinelle` @ (21,2) |
| 2 | clear | 1× `enemy_bloc` @ (21,6) ; 4× `enemy_rodeur` @ bord aléatoire |
| 3 | clear | 2× `enemy_meche` @ (2,1) ; 2× `enemy_sentinelle` @ (21,10) ; 1× `enemy_nuee` @ (21,2) |

| Piège | x,y | w×h | phase |
|---|---|---|---|
| `trap_tourniquet` | 11,6 | — | 0 s |
| `trap_dalles` | 1,1 | 3×3 | 0 s |
| `trap_dalles` | 20,9 | 3×3 | 1 s |
| `trap_tourelle` | 8,0 | — | 0 s |
| `trap_tourelle` | 15,0 | — | 1.2 s |

### Salle 4 — `room_b1_4` (CHEST, ref 20 s)

Coffre + checkpoint. Quatre plots décoratifs. Aucune menace : respiration.

Obstacles (tuiles) : (8,4) 1×1 · (8,8) 1×1 · (15,4) 1×1 · (15,8) 1×1

### Salle 5 — `room_b1_5` (MINIBOSS, ref 120 s)

L'Étalon 07 seul, spawn à droite. Quatre blocs 2×2 en losange : chacun bloque le ring et le fan (pas le slam ni la charge), et surtout sert de **pivot** : tourner autour d'un bloc pendant qu'il vise expose son dos. Il ne s'arrête que contre les MURS extérieurs : s'aligner mur-bloc-joueur provoque une charge qui finit étourdie face au mur, dos offert.

Obstacles (tuiles) : (5,3) 2×2 · (17,3) 2×2 · (5,8) 2×2 · (17,8) 2×2

| Vague | Déclenchement | Spawns |
|---|---|---|
| 1 | start | 1× `boss_etalon_07` @ (18,6) |

### Salle 6 — `room_b1_6` (COMBAT_MODULAR, ref 80 s)

Squelette : 3 vagues avec Éclipse et Incubateur. Éléments modulaires à définir en phase 2.

Obstacles (tuiles) : (11,5) 2×3

| Vague | Déclenchement | Spawns |
|---|---|---|
| 1 | start | 2× `enemy_eclipse` @ bord aléatoire ; 2× `enemy_sentinelle` @ bord aléatoire |
| 2 | clear | 1× `enemy_incubateur` @ (21,6) ; 4× `enemy_rodeur` @ bord aléatoire |
| 3 | clear | 2× `enemy_bloc` @ bord aléatoire ; 3× `enemy_meche` @ bord aléatoire |

### Salle 7 — `room_b1_7` (COMBAT_TRAP_MODULAR, ref 90 s)

Squelette : grille laser sur presque toute la salle + nappe de gaz centrale, 3 vagues. Modulaire phase 2.

Obstacles (tuiles) : (6,6) 1×1 · (17,6) 1×1

| Vague | Déclenchement | Spawns |
|---|---|---|
| 1 | start | 1× `enemy_incubateur` @ (21,3) ; 2× `enemy_eclipse` @ bord aléatoire |
| 2 | clear | 1× `enemy_bloc` @ (21,6) ; 3× `enemy_sentinelle` @ bord aléatoire ; 2× `enemy_nuee` @ bord aléatoire |
| 3 | clear | 4× `enemy_meche` @ bord aléatoire ; 2× `enemy_eclipse` @ bord aléatoire |

| Piège | x,y | w×h | phase |
|---|---|---|---|
| `trap_grille` | 2,1 | 20×11 | 0 s |
| `trap_nappe` | 11,6 | — | 0 s |

### Salle 8 — `room_b1_8` (CHEST_FINAL, ref 20 s)

Squelette : coffre final (plancher de rareté sur le score moyen).

### Salle 9 — `room_b1_9` (BOSS_REVENGE, ref 150 s)

Squelette : Étalon 07 / rév. B + 2 tourelles murales. Non chargeable en phase 1.

Obstacles (tuiles) : (5,3) 2×2 · (17,3) 2×2 · (5,8) 2×2 · (17,8) 2×2

| Vague | Déclenchement | Spawns |
|---|---|---|
| 1 | start | 1× `boss_etalon_07` @ (18,6) |

| Piège | x,y | w×h | phase |
|---|---|---|---|
| `trap_tourelle` | 11,0 | — | 0 s |
| `trap_tourelle` | 12,12 | — | 1.2 s |

## 11. Synergies attendues (10 combos arme × améliorations)

| # | Arme | Améliorations | Pourquoi ça devrait être fort |
|---|---|---|---|
| 1 | Pistolet à ricochet | Balles chercheuses ×2 + Rebond ×3 + Rappel | 7 rebonds chercheurs + retour : chaque balle touche 3-5 fois, DPS ×3-4 sans viser. |
| 2 | Arc voltaïque | Surtension + Chaîne éclair ×3 + Détonation | Un tir = 4 cibles + 60 % de chance de 2 sauts supplémentaires + explosions en chaîne : les Nuées et les groupes de Rôdeurs s'évaporent. |
| 3 | Masse de pression | Onde tellurique + Crit explosif + Œil vif ×5 | Zone +35 %, 35 % crit, chaque crit et chaque kill explosent : nettoyage de salle en 2 coups, étourdissement en prime. |
| 4 | Lame d'essai | Lame dansante ×2 + Gâchette ×5 + Vampirisme ×3 | ~8 coups/s × 18 = 144 DPS, 12 % de lifesteal → ~17 PV/s au contact : tank de mêlée. |
| 5 | Brûleur court | Combustion ×2 + Étincelle ×3 + Cœur de verre | 60 DPS ×2 + brûlure 16/s garantie : ~140 DPS effectifs. 50 PV seulement : build "tout ou rien" à 170 px. |
| 6 | Arc tendeur | Corde tendue ×2 + Frappe lourde ×3 + Coup critique ×3 | Charge en 0,5 s, flèche à 30×3×2,2 ≈ 198 dégâts perçant 5 ennemis, crits à ×2,7 : one-shot des Blocs (140 PV). |
| 7 | Orbe orbitale | Constellation + Orbes gardiennes ×2 + Symbiose | 4 orbes d'arme + 4 orbes gardiennes = mur roulant qui bloque les projectiles ; avec Symbiose le joueur va CHERCHER les pièges pour se soigner. |
| 8 | Boomerang de rappel | Triple rappel + Rappel + Perforation | 2 boomerangs en vol, chacun 2 passages + retour Rappel (3e passage) : ~180 DPS théoriques sur une ligne. À surveiller (§13). |
| 9 | N'importe quelle arme | Dash + Sillage + Enchaînement ×2 + Récupération ×4 | Dash toutes les ~3 s avec 40 % de reset au kill : le sol devient un tapis de feu à 25 dps, le joueur ne s'arrête jamais. |
| 10 | N'importe quelle arme | Résonance + Double charge + Amplificateur ×2 + Saut de phase | 2 blinks à 4 s chacun, chaque blink = onde de 60×1,69 ≈ 101 dégâts + ralenti 1,5 s : la compétence devient l'arme principale. |

Synergies défensives à noter : Convalescence ×2 + Cicatrisation ×4 (+40 % PV et 30 bouclier par salle, 3,2 PV/s) rend la salle de pièges quasi gratuite ; Isolant ×2 (×0,36) + Isolation méta T3 (×0,61) = pièges à 22 %, et avec Marge (×0,5) à 11 % : Sol instable (×2) devient un bonus net. Marge + Symbiose : les pièges soignent 100 % de leurs dégâts calculés APRÈS `trapDamageMul` (proposition : appliquer `traps_heal` sur les dégâts bruts, sinon Marge se soigne deux fois moins que Neuf).

## 12. Effets NEW proposés (3 sur 6 autorisés)

| Effet | Hook | Params | Sémantique précise | Utilisé par |
|---|---|---|---|---|
| `NEW: skill_reset_on_kill` | `onKill` | `chance` (0..1), `fraction` (0..1) | À chaque kill, tirage `chance` ; en cas de succès, le cooldown **restant** de la compétence est réduit de `fraction` (0,5 = moitié du temps restant). Avec `double_skill`, s'applique à la charge en cours de recharge. Plusieurs stacks : tirages indépendants. Ne déclenche pas `onSkill`. | `upg_enchainement` (rare) |
| `NEW: charge_speed` | `passive` | `mul` (>1 = plus vite) | Le temps de charge de l'arme (`charge.min` et `charge.max`) est divisé par `mul`. Sans effet sur une arme sans `charge`. Stacks multiplicatifs. | `upg_syn_corde_tendue` (rare, bow) |
| `NEW: speed_burst` | `onDamaged` / `onTrapDamage` | `speedMul`, `duration` | Identique à `kill_speed` (multiplicateur de vitesse temporaire, non cumulable : la durée est rafraîchie) mais déclenché quand le joueur **subit** un coup (ou un piège). Se déclenche même si le coup est absorbé par un bouclier ; pas si esquivé (`dodge`). | `char_marge` (trait) |

Si ces effets ne sont pas retenus : remplacer *Enchaînement* par `cooldownReduction add 0.12`, *Corde tendue* par `fireRate mul 1.2` (les autres mods restent), et le hook de Marge par `speed mul 1.05`.

## 13. Notes d'équilibrage (à surveiller)

1. **Scoping de `const`** : `dev/content.js` commence par `const CONTENT = {` comme demandé, ce qui empêche la commande de vérification `eval(...)` donnée dans le brief de voir `CONTENT` (portée lexicale de l'eval direct). Vérifié avec la même commande après `const → var`, avec `new Function(src + ';return CONTENT')` et `node --check`. À l'intégration dans `index.html`, aucun problème.
2. **Boomerang + Rappel + Triple rappel** (§11 #8) est le combo le plus risqué : `pierce 99` × 3 passages × 2 boomerangs. Garde-fou proposé au moteur : un même projectile ne touche un même ennemi qu'une fois par passage, et `projectiles_return` n'ajoute pas de passage à une arme dont `special.kind === 'return'` (il rend le retour "chercheur" à la place).
3. **Orbe orbitale** : `fireRate` = ticks/s de contact ; si les 2 orbes touchent la même cible, 96 DPS. Acceptable car contact obligatoire, mais avec Constellation (4 orbes) il faut plafonner à 2 orbes touchant la même cible par tick ou baisser `damage` à 10.
4. **Cœur de verre + Fragile** (malus paire 2) = 37 PV : c'est voulu (build à haut risque), mais avec Protocole d'urgence il faut vérifier que la Nuée (5 × 5 dégâts) ne one-shot pas en enveloppement. Si oui, plafonner `hpMul` à 0,6.
5. **Lifesteal** : 4 % × 3 stacks = 12 % : sur 144 DPS (combo #4), ~17 PV/s. Plafonner le lifesteal effectif à 15 % ou le cumul de stacks de Vampirisme à 2 si l'Agent Test voit des runs immortelles.
6. **Ennemis et pièges** : règle proposée non écrite dans le schéma : les ennemis subissent les dégâts des pièges à 50 % (le Bloc traversant le tourniquet, la Nuée dans le gaz). Ça rend les salles COMBAT_TRAP tactiques ; sans cette règle, la salle 3 est nettement plus dure.
7. **Salle 2 (pièges)** : `refTime 60` suppose que le joueur ramasse les 5 fragments (le dernier apparaît à 24 s). Un joueur qui traverse sans les fragments finit en ~25 s ; le score de salle doit compter les fragments, sinon ils sont ignorés. Les 2 balayages déphasés de 2 s (période 4) signifient qu'un rayon est toujours en mouvement : c'est le passage le plus dur, à tester avec Sol instable (14 × 2 = 28 par contact).
8. **Mini-boss** : 900 PV pour 50 DPS nominal = 18 s de tir pur ; avec ~50 % de temps en esquive et le ×2 dans le dos, cible 35-45 s. Si l'Agent Test mesure < 25 s, monter à 1100 PV ; si > 70 s, baisser le cooldown de charge (plus d'occasions de passer derrière) plutôt que les PV. La règle `back` (cône 90° derrière, `coneAngle` 1,57 rad) est plus exigeante que `after_charge` : si le bot `__autoplay` ne l'exploite jamais, élargir le cône à 120° avant de toucher aux PV. Le `stunCooldown` de 3 s empêche le stun-lock à la Lame (3 coups/s dans le dos).
9. **Économie méta** : total 9 060 pièces pour tout maxer. Avec 150 pièces/run réussie, ~60 runs. Les 4 spéciaux (Mémoire, Aperçu, 4e choix, Re-roll) totalisent 3 330 : ce sont les achats "qualité de vie" prioritaires ; si les joueurs les ignorent au profit de Puissance, baisser leurs T1 à 60-80.
10. **Chance** : Trèfle ×4 (+8) + Chance méta (+10) = +18 luck → commun 42 %, épique ~21 %, colossal ~10 %. Un joueur maxé voit un colossal presque à chaque coffre. À plafonner (`luck` max 15) si les colossales perdent leur rareté.
11. **Nuée et XP** : 15 XP par groupe est généreux pour 40 PV totaux ; l'Incubateur qui en génère jusqu'à 4 (60 XP + 20 pièces) est une "ferme" si on le laisse vivre. Voulu comme dilemme risque/récompense, mais plafonner `max` à 3 si l'Agent Test observe du farming en salle 6-7.
12. **Skill `slowtime`** à 20 s de cooldown avec Réactivité T4 (-20 %) + Récupération ×4 (-24 %) + Amplificateur ×2 (-20 %) = 0,64 de réduction → 7,2 s de cooldown pour 3 s de ralenti à 35 % : proche de l'abus. `cooldownReduction` est plafonné à 0,8 par le schéma ; envisager un plafond à 0,6.
