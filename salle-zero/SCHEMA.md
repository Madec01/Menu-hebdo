# SALLE ZÉRO — Schéma de données `Content` (contrat moteur ⇄ contenu)

Tout le contenu du jeu est un objet JS déclaratif `CONTENT` dans `index.html`. Les agents de contenu
écrivent leurs tables **dans ce format**. Le moteur n'implémente que les clés listées ici ; une valeur
hors liste est ignorée avec un avertissement console. Tous les `id` sont en `snake_case`, stables (sauvegarde).

Unités : pixels, secondes, points de vie entiers. Résolution logique 1280×720, tuile 48 px,
salle = 24×13 tuiles jouables (1152×624), murs d'une tuile autour. Coordonnées de salle en **tuiles** (0..23, 0..12).

## 1. Stats du joueur (clés autorisées dans `mods`)

Un modificateur : `{stat, add?, mul?}`. `add` s'additionne, `mul` se multiplie (1.15 = +15 %). Ordre : somme des add, puis produit des mul.

| stat | base | sens |
|---|---|---|
| `maxHp` | 100 | PV max |
| `speed` | 260 | vitesse px/s |
| `damage` | 1.0 | multiplicateur de dégâts de l'arme |
| `fireRate` | 1.0 | multiplicateur de cadence |
| `critChance` | 0.05 | 0..1 |
| `critMult` | 1.5 | multiplicateur de crit |
| `pierce` | 0 | ennemis traversés (tir) |
| `bounce` | 0 | rebonds sur murs (tir) |
| `projectiles` | 0 | projectiles supplémentaires |
| `projSpeed` | 1.0 | multiplicateur vitesse projectile |
| `range` | 1.0 | multiplicateur portée |
| `areaSize` | 1.0 | multiplicateur taille de zone / mêlée |
| `knockback` | 1.0 | multiplicateur recul |
| `armor` | 0 | dégâts plats retirés par coup (min 1 dégât) |
| `regen` | 0 | PV / s |
| `dodge` | 0 | 0..1, chance d'esquiver un coup |
| `lifesteal` | 0 | fraction des dégâts infligés rendue en PV |
| `thorns` | 0 | dégâts renvoyés au contact |
| `trapDamageMul` | 1.0 | multiplicateur des dégâts de pièges subis |
| `xpGain` | 1.0 | multiplicateur d'XP |
| `coinGain` | 1.0 | multiplicateur d'argent |
| `luck` | 0 | décale les poids de rareté (+1 luck ≈ +1 % épique/colossal) |
| `cooldownReduction` | 0 | 0..0.8, réduction des cooldowns de compétence |
| `pickupRadius` | 60 | rayon d'aimantation des pickups |
| `skillPower` | 1.0 | multiplicateur d'effet des compétences |
| `invulnTime` | 0.6 | secondes d'invulnérabilité après un coup |

## 2. Effets à hooks (ids implémentés par le moteur)

Un `hooks` est un objet `{ <hook>: [{effect, ...params}] }`. Hooks : `onHit` (un projectile/coup touche un ennemi), `onKill`, `onDash`, `onSkill`, `onDamaged` (joueur touché), `onRoomStart`, `onLevelUp`, `onTrapDamage`, `passive` (flag permanent).

| effect | hook | params | sens |
|---|---|---|---|
| `burn` | onHit | `chance, dps, duration` | brûlure (dégâts sur la durée) |
| `freeze` | onHit | `chance, duration, slow` | gel : `slow` = fraction de vitesse retirée |
| `poison` | onHit | `chance, dps, duration, stacks` | poison cumulable |
| `chain` | onHit | `chance, jumps, radius, damageMul` | foudre en chaîne |
| `explode` | onKill | `radius, damageMul` | explosion à la mort |
| `heal_on_kill` | onKill | `amount` | PV rendus par kill |
| `coin_on_kill` | onKill | `chance, amount` | pièces bonus |
| `fire_trail` | onDash | `duration, dps` | traînée de feu derrière le dash |
| `shockwave` | onDash / onSkill / onDamaged | `radius, damage, knockback` | onde de choc |
| `shield_on_room` | onRoomStart | `amount` | bouclier temporaire (PV gris) |
| `heal_on_room` | onRoomStart | `fraction` | soin au début de salle |
| `reroll_on_levelup` | onLevelUp | `count` | re-rolls offerts |
| `traps_heal` | passive | `fraction` | les pièges soignent au lieu de blesser (Colossal) |
| `projectiles_return` | passive | — | les projectiles reviennent vers le joueur (2e passage) |
| `orbit_shield` | passive | `count, damage, radius` | orbes qui tournent et bloquent les projectiles |
| `glass_cannon` | passive | `damageMul, hpMul` | verre : gros dégâts, PV réduits |
| `double_skill` | passive | — | 2 charges de compétence |
| `time_slow_on_damage` | onDamaged | `duration, scale` | ralenti bref quand touché |
| `fragments_double` | passive | — | fragments d'énergie doublés |
| `second_chance` | passive | `hpFraction` | résurrection unique en run |
| `crit_explode` | onHit | `radius, damageMul` | les crits explosent |
| `kill_speed` | onKill | `speedMul, duration` | vitesse après kill |
| `xp_magnet` | passive | — | tous les pickups sont aimantés en permanence |
| `bullet_time_skill` | onSkill | `duration, scale` | ralenti à l'usage de compétence |

Un agent de contenu peut proposer **au maximum 6 effets nouveaux**, marqués `NEW:` avec une description précise ; ils seront implémentés ou remplacés.

## 3. Objets

```js
CONTENT = {
  characters: [{ id, name, desc, stats: { maxHp, speed, damage, luck },  // surcharge la base
                 trait: { id, name, desc, mods: [], hooks: {} }, startWeapon: 'weapon_id', unlocked: bool, price }],

  weapons: [{ id, name, desc, family: 'blade'|'hammer'|'bow'|'pistol'|'boomerang'|'orb'|'chain'|'flame',
              type: 'melee'|'ranged'|'area'|'orbital',
              damage, fireRate /*attaques/s*/, range /*px*/, projSpeed /*px/s, tir*/, projectiles /*nb*/, spread /*rad*/,
              pierce, bounce, knockback, size /*rayon projectile ou arc*/,
              charge: { min, max, damageMul } | null,     // arc : temps de charge
              special: { kind: 'ricochet'|'return'|'orbit'|'chain'|'cone'|'sweep'|'slam'|null, ...params },
              unlocked: bool, price }],

  skills: [{ id, name, desc, cooldown, duration,
             effect: { kind: 'dash'|'shield'|'shockwave'|'slowtime'|'turret'|'blink'|'magnet'|'decoy'|'overdrive', ...params },
             icon }],

  upgrades: [{ id, name, desc, rarity: 'common'|'rare'|'epic'|'colossal',
               category: 'offense'|'defense'|'mobility'|'economy'|'synergy'|'special',
               weaponFamily: 'blade'|... | null,   // synergie : proposée seulement si l'arme équipée est de cette famille
               maxStacks, mods: [], hooks: {} }],

  metaPassives: [{ id, name, desc, tiers: [{ price, mods: [], hooks: {}, special: 'selective_memory'|'chest_preview'|'fourth_choice'|'reroll'|'resurrect'|null }] }],

  biomes: [{ id, name, desc, order,
             levelPassives: [{ bonus: { name, desc, mods, hooks }, malus: { name, desc, mods, hooks } }],  // 3 paires
             enemyPool: [ids], trapPool: [ids], miniboss: 'boss_id',
             difficulty: { hpMul, damageMul, speedMul } }],

  enemies: [{ id, name, desc, archetype: 'rusher'|'shooter'|'tank'|'kamikaze'|'summoner'|'swarm'|'dasher',
              hp, speed, damage /*contact*/, radius, xp, coins, color,
              behavior: { /* selon archétype, ex. shooter: { fireRate, projSpeed, projDamage, keepDistance }, tank: { chargeWindup, chargeSpeed },
                            kamikaze: { fuse, radius, explosionDamage }, summoner: { summon: 'enemy_id', every, max }, swarm: { groupSize, jitter } */ },
              telegraph: { time, color } }],

  bosses: [{ id, name, desc, hp, speed, radius, damage, xp, coins,
             phases: [{ hpBelow /*fraction*/, patterns: [{ kind: 'ring'|'fan'|'spiral'|'charge'|'summon'|'laser_sweep'|'slam',
                                                          telegraph, duration, cooldown, ...params }] }],
             weakness: { desc, rule: 'after_charge'|'during_reload'|'back'|'while_stunned', damageMul, window },
             revenge: { hpMul, extraPhases: [...], desc }   // salle 9, PRÉVU, non implémenté
           }],

  traps: [{ id, name, desc, kind: 'laser_sweep'|'laser_rotate'|'laser_grid'|'wall_fireball'|'spike_tiles'|'gas_zone'|'saw_rail'|'turret_fixed',
            damage, telegraph /*s*/, period /*s*/, active /*s*/, params: { /* selon kind */ } }],

  rooms: [{ id, biome, index /*1..9*/, type: 'PREP_COMBAT'|'TRAP'|'COMBAT_TRAP'|'CHEST'|'MINIBOSS'|'COMBAT_MODULAR'|'COMBAT_TRAP_MODULAR'|'CHEST_FINAL'|'BOSS_REVENGE',
            refTime /*s, temps de référence pour le score*/,
            obstacles: [{ x, y, w, h }] /*tuiles, blocs solides*/,
            waves: [{ at: 'start'|'clear'|number /*s*/, spawns: [{ enemy, count, x, y /*tuiles, -1 = bord aléatoire*/ }] }],
            traps: [{ trap, x, y, w?, h?, phase? /*décalage temporel*/, params? }],
            fragments: [{ x, y, at /*s, apparition*/ }],
            modular: [] /*phase 2*/ }],
}
```

## 4. Raretés et coffres (implémentés dans `Progression`)

Poids de base : commun 60, rare 27, épique 10, colossal 3. `luck` décale : +luck retiré au commun, réparti 60/40 entre épique et colossal.
Plancher coffre selon score moyen : 1.0 → 1 colossal garanti + tirage décalé ; ≥0.8 → 1 épique ; ≥0.5 → 1 rare ; <0.5 → normal ; mort → colossal = 0.

## 5. Argent (règle validée)

Pièces "en attente" depuis le dernier checkpoint. Mort en salle N conserve `10 % × (N − dernier checkpoint)` des pièces en attente.
Salle 4 (coffre) = checkpoint : tout ce qui est en attente est validé. Fin de niveau = tout validé.
