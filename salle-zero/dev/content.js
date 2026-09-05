const CONTENT = {

  // =====================================================================
  // PERSONNAGES
  // =====================================================================
  characters: [
    {
      id: 'char_neuf', name: 'Neuf (Sujet 09)',
      desc: 'Neuvième impression du lot standard. Le modèle par défaut du Site : il accepte toutes les greffes.',
      stats: { maxHp: 100, speed: 260, damage: 1.0, luck: 2 },
      trait: {
        id: 'trait_tolerance_tissulaire', name: 'Tolérance tissulaire',
        desc: 'Les greffes prennent mieux : +20 % XP, +2 chance. Cicatrise 10 % des PV max à chaque nouvelle salle.',
        mods: [{ stat: 'xpGain', mul: 1.2 }, { stat: 'luck', add: 2 }],
        hooks: { onRoomStart: [{ effect: 'heal_on_room', fraction: 0.1 }] }
      },
      startWeapon: 'weapon_blade', unlocked: true, price: 0
    },
    {
      id: 'char_marge', name: 'Marge',
      desc: 'Ancienne technicienne des pièges d\'ADMISSION, reclassée sujet. Moins robuste, mais le Site la blesse moins.',
      stats: { maxHp: 80, speed: 280, damage: 1.0, luck: 0 },
      trait: {
        id: 'trait_connaissance_du_site', name: 'Connaissance du Site',
        desc: 'Pièges : -50 % dégâts subis. Fragments d\'énergie doublés. +20 % vitesse pendant 2 s quand un piège vous touche.',
        mods: [{ stat: 'trapDamageMul', mul: 0.5 }],
        hooks: { passive: [{ effect: 'fragments_double' }], onTrapDamage: [{ effect: 'speed_burst', speedMul: 1.2, duration: 2 }] }
      },
      startWeapon: 'weapon_pistol', unlocked: false, price: 400
    }
  ],

  // =====================================================================
  // ARMES  (DPS théorique nu entre parenthèses dans desc)
  // =====================================================================
  weapons: [
    {
      id: 'weapon_blade', name: 'Lame d\'essai',
      desc: 'Lame courte et rapide. Arc de 125° devant vous, 3 coups/s. Sûre, sans portée. (54 DPS)',
      family: 'blade', type: 'melee',
      damage: 18, fireRate: 3.0, range: 70, projSpeed: 0, projectiles: 0, spread: 0,
      pierce: 0, bounce: 0, knockback: 1.0, size: 60,
      charge: null,
      special: { kind: 'sweep', arc: 2.18, hitAllInArc: true },
      unlocked: true, price: 0
    },
    {
      id: 'weapon_hammer', name: 'Masse de pression',
      desc: 'Marteau lent : 60 dégâts en zone, 0,8 coup/s, recul énorme, étourdit 0,4 s. (48 DPS / cible)',
      family: 'hammer', type: 'area',
      damage: 60, fireRate: 0.8, range: 95, projSpeed: 0, projectiles: 0, spread: 0,
      pierce: 0, bounce: 0, knockback: 2.5, size: 85,
      charge: null,
      special: { kind: 'slam', stunTime: 0.4, windup: 0.25 },
      unlocked: false, price: 150
    },
    {
      id: 'weapon_bow', name: 'Arc tendeur',
      desc: 'Tir rapide 30 dégâts, ou charge 1 s pour ×3 et perforation. (48 DPS spam, 72 DPS chargé)',
      family: 'bow', type: 'ranged',
      damage: 30, fireRate: 1.6, range: 720, projSpeed: 900, projectiles: 1, spread: 0,
      pierce: 1, bounce: 0, knockback: 1.2, size: 6,
      charge: { min: 0.25, max: 1.0, damageMul: 3.0 },
      special: { kind: null, chargedPierceBonus: 2, chargedProjSpeedMul: 1.4 },
      unlocked: false, price: 200
    },
    {
      id: 'weapon_pistol', name: 'Pistolet à ricochet',
      desc: 'Balles rapides qui rebondissent 2 fois sur les murs et cherchent une cible proche. (56 DPS)',
      family: 'pistol', type: 'ranged',
      damage: 14, fireRate: 4.0, range: 620, projSpeed: 760, projectiles: 1, spread: 0.06,
      pierce: 0, bounce: 2, knockback: 0.8, size: 5,
      charge: null,
      special: { kind: 'ricochet', seekRadius: 220, seekOnBounce: true },
      unlocked: true, price: 0
    },
    {
      id: 'weapon_boomerang', name: 'Boomerang de rappel',
      desc: 'Traverse tout, revient vers vous : 2 passages par lancer. 1 lancer à la fois. (62 DPS)',
      family: 'boomerang', type: 'ranged',
      damage: 22, fireRate: 1.4, range: 380, projSpeed: 620, projectiles: 1, spread: 0,
      pierce: 99, bounce: 0, knockback: 1.0, size: 12,
      charge: null,
      special: { kind: 'return', passes: 2, maxInFlight: 1, returnSpeedMul: 1.15 },
      unlocked: false, price: 220
    },
    {
      id: 'weapon_orb', name: 'Orbe orbitale',
      desc: '2 orbes tournent autour de vous. 12 dégâts, 4 ticks/s au contact. Pas de visée. (48 DPS / orbe)',
      family: 'orb', type: 'orbital',
      damage: 12, fireRate: 4.0, range: 90, projSpeed: 0, projectiles: 2, spread: 0,
      pierce: 99, bounce: 0, knockback: 0.6, size: 14,
      charge: null,
      special: { kind: 'orbit', radius: 90, angularSpeed: 4.5, tickRate: 4, blocksProjectiles: false },
      unlocked: false, price: 250
    },
    {
      id: 'weapon_chain', name: 'Arc voltaïque',
      desc: 'Éclair instantané 24 dégâts, saute sur 2 ennemis proches à 60 %. Fort en groupe. (48 DPS solo)',
      family: 'chain', type: 'ranged',
      damage: 24, fireRate: 2.0, range: 420, projSpeed: 1400, projectiles: 1, spread: 0,
      pierce: 0, bounce: 0, knockback: 0.5, size: 6,
      charge: null,
      special: { kind: 'chain', jumps: 2, radius: 160, damageMul: 0.6 },
      unlocked: false, price: 300
    },
    {
      id: 'weapon_flame', name: 'Brûleur court',
      desc: 'Cône de flammes 40°, portée 170 px, 10 ticks/s de 6 dégâts + brûlure 4/s. Très court. (60 DPS)',
      family: 'flame', type: 'area',
      damage: 6, fireRate: 10.0, range: 170, projSpeed: 0, projectiles: 0, spread: 0.7,
      pierce: 99, bounce: 0, knockback: 0.3, size: 170,
      charge: null,
      special: { kind: 'cone', angle: 0.7, burnDps: 4, burnDuration: 2.0 },
      unlocked: false, price: 280
    }
  ],

  // =====================================================================
  // COMPÉTENCES ACTIVES
  // =====================================================================
  skills: [
    { id: 'skill_dash', name: 'Dash', desc: 'Ruée de 220 px, invulnérable pendant 0,2 s. Cooldown 6 s.',
      cooldown: 6, duration: 0.2, effect: { kind: 'dash', distance: 220, invulnerable: true }, icon: 'dash' },
    { id: 'skill_shield', name: 'Bouclier', desc: 'Bouclier de 40 PV gris pendant 4 s. Cooldown 14 s.',
      cooldown: 14, duration: 4, effect: { kind: 'shield', amount: 40 }, icon: 'shield' },
    { id: 'skill_shockwave', name: 'Onde de choc', desc: 'Repousse et inflige 45 dégâts dans 180 px. Cooldown 10 s.',
      cooldown: 10, duration: 0.3, effect: { kind: 'shockwave', radius: 180, damage: 45, knockback: 2.5 }, icon: 'shockwave' },
    { id: 'skill_slowtime', name: 'Dilatation', desc: 'Le monde ralentit à 35 % pendant 3 s, pas vous. Cooldown 20 s.',
      cooldown: 20, duration: 3, effect: { kind: 'slowtime', scale: 0.35, playerScale: 1.0 }, icon: 'slowtime' },
    { id: 'skill_turret', name: 'Tourelle', desc: 'Tourelle 60 PV, 10 dégâts ×3/s, portée 360 px, 8 s. Cooldown 16 s.',
      cooldown: 16, duration: 8, effect: { kind: 'turret', damage: 10, fireRate: 3, range: 360, hp: 60 }, icon: 'turret' },
    { id: 'skill_blink', name: 'Saut de phase', desc: 'Téléportation de 260 px vers le curseur, 0,15 s invulnérable. CD 8 s.',
      cooldown: 8, duration: 0, effect: { kind: 'blink', distance: 260, invulnerable: 0.15, ignoreObstacles: true }, icon: 'blink' },
    { id: 'skill_magnet', name: 'Aimant', desc: 'Attire tous les pickups de la salle pendant 2 s. Cooldown 12 s.',
      cooldown: 12, duration: 2, effect: { kind: 'magnet', radius: 1400, pullSpeed: 900 }, icon: 'magnet' },
    { id: 'skill_overdrive', name: 'Surrégime', desc: '+50 % dégâts et cadence 5 s, mais 2 PV/s perdus. Cooldown 18 s.',
      cooldown: 18, duration: 5, effect: { kind: 'overdrive', damageMul: 1.5, fireRateMul: 1.5, selfDamagePerSec: 2 }, icon: 'overdrive' }
  ],

  // =====================================================================
  // AMÉLIORATIONS EN RUN  (50 : 20 communes, 15 rares, 10 épiques, 5 colossales)
  // =====================================================================
  upgrades: [
    // ---- COMMUNES (20) ----
    { id: 'upg_tranchant', name: 'Tranchant', desc: '+15 % dégâts.', rarity: 'common', category: 'offense', weaponFamily: null, maxStacks: 5,
      mods: [{ stat: 'damage', mul: 1.15 }], hooks: {} },
    { id: 'upg_gachette', name: 'Gâchette', desc: '+12 % cadence d\'attaque.', rarity: 'common', category: 'offense', weaponFamily: null, maxStacks: 5,
      mods: [{ stat: 'fireRate', mul: 1.12 }], hooks: {} },
    { id: 'upg_oeil_vif', name: 'Œil vif', desc: '+6 % chance de critique.', rarity: 'common', category: 'offense', weaponFamily: null, maxStacks: 5,
      mods: [{ stat: 'critChance', add: 0.06 }], hooks: {} },
    { id: 'upg_coup_critique', name: 'Coup critique', desc: '+40 % dégâts des critiques (×1,5 → ×1,9).', rarity: 'common', category: 'offense', weaponFamily: null, maxStacks: 3,
      mods: [{ stat: 'critMult', add: 0.4 }], hooks: {} },
    { id: 'upg_longue_portee', name: 'Longue portée', desc: '+15 % portée.', rarity: 'common', category: 'offense', weaponFamily: null, maxStacks: 3,
      mods: [{ stat: 'range', mul: 1.15 }], hooks: {} },
    { id: 'upg_calibrage', name: 'Calibrage', desc: '+20 % vitesse des projectiles.', rarity: 'common', category: 'offense', weaponFamily: null, maxStacks: 3,
      mods: [{ stat: 'projSpeed', mul: 1.2 }], hooks: {} },
    { id: 'upg_plaque', name: 'Plaque', desc: '+20 PV max.', rarity: 'common', category: 'defense', weaponFamily: null, maxStacks: 5,
      mods: [{ stat: 'maxHp', add: 20 }], hooks: {} },
    { id: 'upg_peau_dure', name: 'Peau dure', desc: '+1 armure (dégâts plats retirés par coup).', rarity: 'common', category: 'defense', weaponFamily: null, maxStacks: 4,
      mods: [{ stat: 'armor', add: 1 }], hooks: {} },
    { id: 'upg_cicatrisation', name: 'Cicatrisation', desc: '+0,8 PV/s de régénération.', rarity: 'common', category: 'defense', weaponFamily: null, maxStacks: 4,
      mods: [{ stat: 'regen', add: 0.8 }], hooks: {} },
    { id: 'upg_reflexes', name: 'Réflexes', desc: '+5 % d\'esquive.', rarity: 'common', category: 'defense', weaponFamily: null, maxStacks: 4,
      mods: [{ stat: 'dodge', add: 0.05 }], hooks: {} },
    { id: 'upg_semelles', name: 'Semelles', desc: '+10 % vitesse de déplacement.', rarity: 'common', category: 'mobility', weaponFamily: null, maxStacks: 4,
      mods: [{ stat: 'speed', mul: 1.10 }], hooks: {} },
    { id: 'upg_aimant_de_poche', name: 'Aimant de poche', desc: '+40 px de rayon d\'aimantation des pickups.', rarity: 'common', category: 'mobility', weaponFamily: null, maxStacks: 3,
      mods: [{ stat: 'pickupRadius', add: 40 }], hooks: {} },
    { id: 'upg_recuperation', name: 'Récupération', desc: '-6 % de cooldown de compétence.', rarity: 'common', category: 'mobility', weaponFamily: null, maxStacks: 4,
      mods: [{ stat: 'cooldownReduction', add: 0.06 }], hooks: {} },
    { id: 'upg_tirelire', name: 'Tirelire', desc: '+20 % pièces gagnées.', rarity: 'common', category: 'economy', weaponFamily: null, maxStacks: 4,
      mods: [{ stat: 'coinGain', mul: 1.2 }], hooks: {} },
    { id: 'upg_apprentissage', name: 'Apprentissage', desc: '+15 % XP gagnée.', rarity: 'common', category: 'economy', weaponFamily: null, maxStacks: 4,
      mods: [{ stat: 'xpGain', mul: 1.15 }], hooks: {} },
    { id: 'upg_trefle', name: 'Trèfle', desc: '+2 chance (raretés décalées vers épique/colossal).', rarity: 'common', category: 'economy', weaponFamily: null, maxStacks: 4,
      mods: [{ stat: 'luck', add: 2 }], hooks: {} },
    { id: 'upg_butin', name: 'Butin', desc: '15 % de chance qu\'un kill lâche 1 pièce bonus.', rarity: 'common', category: 'economy', weaponFamily: null, maxStacks: 3,
      mods: [], hooks: { onKill: [{ effect: 'coin_on_kill', chance: 0.15, amount: 1 }] } },
    { id: 'upg_etincelle', name: 'Étincelle', desc: '15 % de chance de brûler : 5 dégâts/s pendant 2 s.', rarity: 'common', category: 'special', weaponFamily: null, maxStacks: 3,
      mods: [], hooks: { onHit: [{ effect: 'burn', chance: 0.15, dps: 5, duration: 2 }] } },
    { id: 'upg_givre', name: 'Givre', desc: '12 % de chance de geler : -50 % vitesse pendant 1,2 s.', rarity: 'common', category: 'special', weaponFamily: null, maxStacks: 3,
      mods: [], hooks: { onHit: [{ effect: 'freeze', chance: 0.12, duration: 1.2, slow: 0.5 }] } },
    { id: 'upg_toxine', name: 'Toxine', desc: '15 % de chance d\'empoisonner : 3 dégâts/s, 4 s, cumulable ×3.', rarity: 'common', category: 'special', weaponFamily: null, maxStacks: 3,
      mods: [], hooks: { onHit: [{ effect: 'poison', chance: 0.15, dps: 3, duration: 4, stacks: 3 }] } },

    // ---- RARES (15) ----
    { id: 'upg_frappe_lourde', name: 'Frappe lourde', desc: '+30 % dégâts, -8 % cadence.', rarity: 'rare', category: 'offense', weaponFamily: null, maxStacks: 3,
      mods: [{ stat: 'damage', mul: 1.3 }, { stat: 'fireRate', mul: 0.92 }], hooks: {} },
    { id: 'upg_double_canon', name: 'Double canon', desc: '+1 projectile, -15 % dégâts.', rarity: 'rare', category: 'offense', weaponFamily: null, maxStacks: 2,
      mods: [{ stat: 'projectiles', add: 1 }, { stat: 'damage', mul: 0.85 }], hooks: {} },
    { id: 'upg_perforation', name: 'Perforation', desc: '+1 ennemi traversé par les tirs.', rarity: 'rare', category: 'offense', weaponFamily: null, maxStacks: 3,
      mods: [{ stat: 'pierce', add: 1 }], hooks: {} },
    { id: 'upg_rebond', name: 'Rebond', desc: '+1 rebond sur les murs.', rarity: 'rare', category: 'offense', weaponFamily: null, maxStacks: 3,
      mods: [{ stat: 'bounce', add: 1 }], hooks: {} },
    { id: 'upg_vampirisme', name: 'Vampirisme', desc: '4 % des dégâts infligés rendus en PV.', rarity: 'rare', category: 'defense', weaponFamily: null, maxStacks: 3,
      mods: [{ stat: 'lifesteal', add: 0.04 }], hooks: {} },
    { id: 'upg_epines', name: 'Épines', desc: 'Renvoie 8 dégâts à tout ennemi qui vous touche.', rarity: 'rare', category: 'defense', weaponFamily: null, maxStacks: 3,
      mods: [{ stat: 'thorns', add: 8 }], hooks: {} },
    { id: 'upg_isolant', name: 'Isolant', desc: '-40 % dégâts subis des pièges.', rarity: 'rare', category: 'defense', weaponFamily: null, maxStacks: 2,
      mods: [{ stat: 'trapDamageMul', mul: 0.6 }], hooks: {} },
    { id: 'upg_convalescence', name: 'Convalescence', desc: 'Au début de chaque salle : +20 % PV et 15 PV de bouclier.', rarity: 'rare', category: 'defense', weaponFamily: null, maxStacks: 2,
      mods: [], hooks: { onRoomStart: [{ effect: 'heal_on_room', fraction: 0.2 }, { effect: 'shield_on_room', amount: 15 }] } },
    { id: 'upg_adrenaline', name: 'Adrénaline', desc: 'Chaque kill : +20 % vitesse pendant 2 s.', rarity: 'rare', category: 'mobility', weaponFamily: null, maxStacks: 2,
      mods: [], hooks: { onKill: [{ effect: 'kill_speed', speedMul: 1.2, duration: 2 }] } },
    { id: 'upg_enchainement', name: 'Enchaînement', desc: 'Chaque kill : 20 % de chance de réduire le cooldown restant de 50 %.', rarity: 'rare', category: 'mobility', weaponFamily: null, maxStacks: 2,
      mods: [], hooks: { onKill: [{ effect: 'skill_reset_on_kill', chance: 0.2, fraction: 0.5 }] } },
    { id: 'upg_chaine_eclair', name: 'Chaîne éclair', desc: '20 % de chance qu\'un coup saute sur 2 ennemis (150 px) à 50 %.', rarity: 'rare', category: 'special', weaponFamily: null, maxStacks: 3,
      mods: [], hooks: { onHit: [{ effect: 'chain', chance: 0.2, jumps: 2, radius: 150, damageMul: 0.5 }] } },
    { id: 'upg_detonation', name: 'Détonation', desc: 'Les ennemis tués explosent : 60 % de vos dégâts dans 70 px.', rarity: 'rare', category: 'special', weaponFamily: null, maxStacks: 2,
      mods: [], hooks: { onKill: [{ effect: 'explode', radius: 70, damageMul: 0.6 }] } },
    // synergies rares
    { id: 'upg_syn_lame_dansante', name: 'Lame dansante', desc: 'Lame : +25 % cadence, chaque kill +15 % vitesse 1,5 s.', rarity: 'rare', category: 'synergy', weaponFamily: 'blade', maxStacks: 2,
      mods: [{ stat: 'fireRate', mul: 1.25 }], hooks: { onKill: [{ effect: 'kill_speed', speedMul: 1.15, duration: 1.5 }] } },
    { id: 'upg_syn_balles_chercheuses', name: 'Balles chercheuses', desc: 'Pistolet : +2 rebonds, +10 % dégâts.', rarity: 'rare', category: 'synergy', weaponFamily: 'pistol', maxStacks: 2,
      mods: [{ stat: 'bounce', add: 2 }, { stat: 'damage', mul: 1.1 }], hooks: {} },
    { id: 'upg_syn_corde_tendue', name: 'Corde tendue', desc: 'Arc : charge 40 % plus vite, +2 perforation, +30 % vitesse de flèche.', rarity: 'rare', category: 'synergy', weaponFamily: 'bow', maxStacks: 2,
      mods: [{ stat: 'pierce', add: 2 }, { stat: 'projSpeed', mul: 1.3 }], hooks: { passive: [{ effect: 'charge_speed', mul: 1.4 }] } },

    // ---- ÉPIQUES (10) ----
    { id: 'upg_amplificateur', name: 'Amplificateur', desc: '+30 % effet des compétences, -10 % de cooldown.', rarity: 'epic', category: 'mobility', weaponFamily: null, maxStacks: 2,
      mods: [{ stat: 'skillPower', mul: 1.3 }, { stat: 'cooldownReduction', add: 0.1 }], hooks: {} },
    { id: 'upg_double_charge', name: 'Double charge', desc: 'Votre compétence a 2 charges.', rarity: 'epic', category: 'mobility', weaponFamily: null, maxStacks: 1,
      mods: [], hooks: { passive: [{ effect: 'double_skill' }] } },
    { id: 'upg_crit_explosif', name: 'Crit explosif', desc: 'Les critiques explosent : 80 % des dégâts dans 60 px. +5 % crit.', rarity: 'epic', category: 'special', weaponFamily: null, maxStacks: 1,
      mods: [{ stat: 'critChance', add: 0.05 }], hooks: { onHit: [{ effect: 'crit_explode', radius: 60, damageMul: 0.8 }] } },
    { id: 'upg_orbes_gardiennes', name: 'Orbes gardiennes', desc: '2 orbes (10 dégâts) tournent à 70 px et bloquent les projectiles.', rarity: 'epic', category: 'defense', weaponFamily: null, maxStacks: 2,
      mods: [], hooks: { passive: [{ effect: 'orbit_shield', count: 2, damage: 10, radius: 70 }] } },
    { id: 'upg_attraction', name: 'Attraction', desc: 'Tous les pickups viennent à vous. Fragments d\'énergie doublés. +20 % XP.', rarity: 'epic', category: 'economy', weaponFamily: null, maxStacks: 1,
      mods: [{ stat: 'xpGain', mul: 1.2 }], hooks: { passive: [{ effect: 'xp_magnet' }, { effect: 'fragments_double' }] } },
    { id: 'upg_sang_froid', name: 'Sang-froid', desc: 'Touché : ralenti 0,8 s à 40 % et +0,3 s d\'invulnérabilité. +2 armure.', rarity: 'epic', category: 'defense', weaponFamily: null, maxStacks: 1,
      mods: [{ stat: 'invulnTime', add: 0.3 }, { stat: 'armor', add: 2 }], hooks: { onDamaged: [{ effect: 'time_slow_on_damage', duration: 0.8, scale: 0.4 }] } },
    // synergies épiques
    { id: 'upg_syn_onde_tellurique', name: 'Onde tellurique', desc: 'Marteau : +35 % zone, +20 % dégâts, les kills explosent (80 %, 90 px).', rarity: 'epic', category: 'synergy', weaponFamily: 'hammer', maxStacks: 1,
      mods: [{ stat: 'areaSize', mul: 1.35 }, { stat: 'damage', mul: 1.2 }], hooks: { onKill: [{ effect: 'explode', radius: 90, damageMul: 0.8 }] } },
    { id: 'upg_syn_constellation', name: 'Constellation', desc: 'Orbe : +2 orbes, rayon d\'orbite +20 %, +15 % dégâts.', rarity: 'epic', category: 'synergy', weaponFamily: 'orb', maxStacks: 1,
      mods: [{ stat: 'projectiles', add: 2 }, { stat: 'range', mul: 1.2 }, { stat: 'damage', mul: 1.15 }], hooks: {} },
    { id: 'upg_syn_surtension', name: 'Surtension', desc: 'Foudre : chaque coup saute sur 3 ennemis (200 px) à 70 %.', rarity: 'epic', category: 'synergy', weaponFamily: 'chain', maxStacks: 1,
      mods: [], hooks: { onHit: [{ effect: 'chain', chance: 1.0, jumps: 3, radius: 200, damageMul: 0.7 }] } },
    { id: 'upg_syn_triple_rappel', name: 'Triple rappel', desc: 'Boomerang : +1 boomerang en vol, +15 % dégâts, +15 % cadence.', rarity: 'epic', category: 'synergy', weaponFamily: 'boomerang', maxStacks: 1,
      mods: [{ stat: 'projectiles', add: 1 }, { stat: 'damage', mul: 1.15 }, { stat: 'fireRate', mul: 1.15 }], hooks: {} },
    // synergie flamme (rare) placée ici pour lisibilité du bloc synergies
    { id: 'upg_syn_combustion', name: 'Combustion', desc: 'Flammes : brûlure garantie 8 dégâts/s 3 s, +20 % taille de cône.', rarity: 'rare', category: 'synergy', weaponFamily: 'flame', maxStacks: 2,
      mods: [{ stat: 'areaSize', mul: 1.2 }], hooks: { onHit: [{ effect: 'burn', chance: 1.0, dps: 8, duration: 3 }] } },

    // ---- COLOSSALES (5) ----
    { id: 'upg_rappel', name: 'Rappel', desc: 'Vos projectiles reviennent vers vous : un second passage sur tout.', rarity: 'colossal', category: 'special', weaponFamily: null, maxStacks: 1,
      mods: [], hooks: { passive: [{ effect: 'projectiles_return' }] } },
    { id: 'upg_sillage', name: 'Sillage', desc: 'Chaque dash laisse une traînée de feu 2,5 s (25 dégâts/s). +10 % vitesse.', rarity: 'colossal', category: 'mobility', weaponFamily: null, maxStacks: 1,
      mods: [{ stat: 'speed', mul: 1.1 }], hooks: { onDash: [{ effect: 'fire_trail', duration: 2.5, dps: 25 }] } },
    { id: 'upg_symbiose', name: 'Symbiose', desc: 'Les pièges vous soignent au lieu de vous blesser (100 % des dégâts).', rarity: 'colossal', category: 'defense', weaponFamily: null, maxStacks: 1,
      mods: [], hooks: { passive: [{ effect: 'traps_heal', fraction: 1.0 }] } },
    { id: 'upg_coeur_de_verre', name: 'Cœur de verre', desc: 'Dégâts ×2, PV max ×0,5.', rarity: 'colossal', category: 'offense', weaponFamily: null, maxStacks: 1,
      mods: [], hooks: { passive: [{ effect: 'glass_cannon', damageMul: 2.0, hpMul: 0.5 }] } },
    { id: 'upg_resonance', name: 'Résonance', desc: 'Chaque compétence : onde de choc 60 dégâts (200 px) + ralenti 1,5 s à 30 %.', rarity: 'colossal', category: 'special', weaponFamily: null, maxStacks: 1,
      mods: [], hooks: { onSkill: [{ effect: 'shockwave', radius: 200, damage: 60, knockback: 3 }, { effect: 'bullet_time_skill', duration: 1.5, scale: 0.3 }] } }
  ],

  // =====================================================================
  // PASSIFS MÉTA (hub)  — 16
  // =====================================================================
  metaPassives: [
    { id: 'meta_vitalite', name: 'Vitalité', desc: 'PV de départ.', tiers: [
      { price: 60,  mods: [{ stat: 'maxHp', add: 10 }], hooks: {}, special: null },
      { price: 140, mods: [{ stat: 'maxHp', add: 10 }], hooks: {}, special: null },
      { price: 260, mods: [{ stat: 'maxHp', add: 15 }], hooks: {}, special: null },
      { price: 450, mods: [{ stat: 'maxHp', add: 15 }], hooks: {}, special: null } ] },
    { id: 'meta_puissance', name: 'Puissance', desc: 'Dégâts de base.', tiers: [
      { price: 80,  mods: [{ stat: 'damage', mul: 1.05 }], hooks: {}, special: null },
      { price: 160, mods: [{ stat: 'damage', mul: 1.05 }], hooks: {}, special: null },
      { price: 260, mods: [{ stat: 'damage', mul: 1.05 }], hooks: {}, special: null },
      { price: 400, mods: [{ stat: 'damage', mul: 1.06 }], hooks: {}, special: null },
      { price: 600, mods: [{ stat: 'damage', mul: 1.06 }], hooks: {}, special: null } ] },
    { id: 'meta_chance', name: 'Chance', desc: 'Décale les raretés vers épique et colossal.', tiers: [
      { price: 50,  mods: [{ stat: 'luck', add: 2 }], hooks: {}, special: null },
      { price: 120, mods: [{ stat: 'luck', add: 2 }], hooks: {}, special: null },
      { price: 240, mods: [{ stat: 'luck', add: 3 }], hooks: {}, special: null },
      { price: 400, mods: [{ stat: 'luck', add: 3 }], hooks: {}, special: null } ] },
    { id: 'meta_cupidite', name: 'Cupidité', desc: 'Argent gagné.', tiers: [
      { price: 40,  mods: [{ stat: 'coinGain', mul: 1.1 }], hooks: {}, special: null },
      { price: 100, mods: [{ stat: 'coinGain', mul: 1.1 }], hooks: {}, special: null },
      { price: 200, mods: [{ stat: 'coinGain', mul: 1.1 }], hooks: {}, special: null },
      { price: 350, mods: [{ stat: 'coinGain', mul: 1.15 }], hooks: {}, special: null } ] },
    { id: 'meta_etude', name: 'Étude', desc: 'XP gagnée.', tiers: [
      { price: 40,  mods: [{ stat: 'xpGain', mul: 1.1 }], hooks: {}, special: null },
      { price: 100, mods: [{ stat: 'xpGain', mul: 1.1 }], hooks: {}, special: null },
      { price: 200, mods: [{ stat: 'xpGain', mul: 1.1 }], hooks: {}, special: null },
      { price: 350, mods: [{ stat: 'xpGain', mul: 1.15 }], hooks: {}, special: null } ] },
    { id: 'meta_reactivite', name: 'Réactivité', desc: 'Réduction des cooldowns de compétence.', tiers: [
      { price: 70,  mods: [{ stat: 'cooldownReduction', add: 0.05 }], hooks: {}, special: null },
      { price: 150, mods: [{ stat: 'cooldownReduction', add: 0.05 }], hooks: {}, special: null },
      { price: 280, mods: [{ stat: 'cooldownReduction', add: 0.05 }], hooks: {}, special: null },
      { price: 450, mods: [{ stat: 'cooldownReduction', add: 0.05 }], hooks: {}, special: null } ] },
    { id: 'meta_resurrection', name: 'Résurrection', desc: 'Une seconde vie par run.', tiers: [
      { price: 120, mods: [], hooks: { passive: [{ effect: 'second_chance', hpFraction: 0.25 }] }, special: 'resurrect' },
      { price: 300, mods: [], hooks: { passive: [{ effect: 'second_chance', hpFraction: 0.4 }] }, special: 'resurrect' },
      { price: 550, mods: [], hooks: { passive: [{ effect: 'second_chance', hpFraction: 0.6 }] }, special: 'resurrect' } ] },
    { id: 'meta_memoire_selective', name: 'Mémoire sélective', desc: 'Commencer la run avec une amélioration de la run précédente.', tiers: [
      { price: 100, mods: [], hooks: {}, special: 'selective_memory' },
      { price: 250, mods: [], hooks: {}, special: 'selective_memory' },
      { price: 450, mods: [], hooks: {}, special: 'selective_memory' } ] },
    { id: 'meta_apercu_coffre', name: 'Aperçu du coffre', desc: 'Voir le contenu du prochain coffre.', tiers: [
      { price: 80,  mods: [], hooks: {}, special: 'chest_preview' },
      { price: 200, mods: [], hooks: {}, special: 'chest_preview' },
      { price: 380, mods: [], hooks: {}, special: 'chest_preview' } ] },
    { id: 'meta_quatrieme_choix', name: 'Quatrième choix', desc: 'Un 4e choix au level-up.', tiers: [
      { price: 120, mods: [], hooks: {}, special: 'fourth_choice' },
      { price: 300, mods: [], hooks: {}, special: 'fourth_choice' },
      { price: 500, mods: [], hooks: {}, special: 'fourth_choice' } ] },
    { id: 'meta_reroll', name: 'Re-roll', desc: 'Relancer les choix de level-up.', tiers: [
      { price: 90,  mods: [], hooks: { onLevelUp: [{ effect: 'reroll_on_levelup', count: 1 }] }, special: 'reroll' },
      { price: 220, mods: [], hooks: { onLevelUp: [{ effect: 'reroll_on_levelup', count: 1 }] }, special: 'reroll' },
      { price: 420, mods: [], hooks: { onLevelUp: [{ effect: 'reroll_on_levelup', count: 1 }] }, special: 'reroll' } ] },
    { id: 'meta_celerite', name: 'Célérité', desc: 'Vitesse de déplacement.', tiers: [
      { price: 60,  mods: [{ stat: 'speed', mul: 1.04 }], hooks: {}, special: null },
      { price: 150, mods: [{ stat: 'speed', mul: 1.04 }], hooks: {}, special: null },
      { price: 300, mods: [{ stat: 'speed', mul: 1.04 }], hooks: {}, special: null } ] },
    { id: 'meta_carapace', name: 'Carapace', desc: 'Armure de base.', tiers: [
      { price: 80,  mods: [{ stat: 'armor', add: 1 }], hooks: {}, special: null },
      { price: 200, mods: [{ stat: 'armor', add: 1 }], hooks: {}, special: null },
      { price: 380, mods: [{ stat: 'armor', add: 1 }], hooks: {}, special: null } ] },
    { id: 'meta_isolation', name: 'Isolation', desc: 'Dégâts des pièges subis.', tiers: [
      { price: 70,  mods: [{ stat: 'trapDamageMul', mul: 0.85 }], hooks: {}, special: null },
      { price: 170, mods: [{ stat: 'trapDamageMul', mul: 0.85 }], hooks: {}, special: null },
      { price: 320, mods: [{ stat: 'trapDamageMul', mul: 0.85 }], hooks: {}, special: null } ] },
    { id: 'meta_aimantation', name: 'Aimantation', desc: 'Rayon de ramassage.', tiers: [
      { price: 40,  mods: [{ stat: 'pickupRadius', add: 30 }], hooks: {}, special: null },
      { price: 100, mods: [{ stat: 'pickupRadius', add: 30 }], hooks: {}, special: null },
      { price: 220, mods: [{ stat: 'pickupRadius', add: 40 }], hooks: {}, special: null } ] },
    { id: 'meta_precision', name: 'Précision', desc: 'Chance de critique de base.', tiers: [
      { price: 70,  mods: [{ stat: 'critChance', add: 0.03 }], hooks: {}, special: null },
      { price: 150, mods: [{ stat: 'critChance', add: 0.03 }], hooks: {}, special: null },
      { price: 280, mods: [{ stat: 'critChance', add: 0.03 }], hooks: {}, special: null },
      { price: 450, mods: [{ stat: 'critChance', add: 0.03 }], hooks: {}, special: null } ] }
  ],

  // =====================================================================
  // BIOMES
  // =====================================================================
  biomes: [
    {
      id: 'biome_1', name: 'ADMISSION', order: 1,
      desc: 'Palier -1, Protocole H-9. L\'ancien service d\'accueil du Site réaménagé en parcours : guichets devenus couverts, bancs devenus obstacles, rails de brancards devenus rails de pièges. Néons qui clignotent, sols humides. Taux de perte : 71 %.',
      levelPassives: [
        { bonus: { name: 'Stimulant', desc: '+15 % vitesse de déplacement.', mods: [{ stat: 'speed', mul: 1.15 }], hooks: {} },
          malus: { name: 'Sol instable', desc: 'Les pièges infligent le double de dégâts.', mods: [{ stat: 'trapDamageMul', mul: 2.0 }], hooks: {} } },
        { bonus: { name: 'Surcharge', desc: '+25 % dégâts.', mods: [{ stat: 'damage', mul: 1.25 }], hooks: {} },
          malus: { name: 'Fragile', desc: '-25 % PV max.', mods: [{ stat: 'maxHp', mul: 0.75 }], hooks: {} } },
        { bonus: { name: 'Prime d\'essai', desc: '+30 % pièces, +20 % XP.', mods: [{ stat: 'coinGain', mul: 1.3 }, { stat: 'xpGain', mul: 1.2 }], hooks: {} },
          malus: { name: 'Protocole d\'urgence', desc: 'Invulnérabilité après un coup réduite de 0,6 s à 0,3 s.', mods: [{ stat: 'invulnTime', add: -0.3 }], hooks: {} } }
      ],
      enemyPool: ['enemy_rodeur', 'enemy_sentinelle', 'enemy_bloc', 'enemy_meche', 'enemy_incubateur', 'enemy_nuee', 'enemy_eclipse'],
      trapPool: ['trap_balayage', 'trap_tourniquet', 'trap_grille', 'trap_bouche', 'trap_dalles', 'trap_nappe', 'trap_rail', 'trap_tourelle'],
      miniboss: 'boss_etalon_07',
      difficulty: { hpMul: 1, damageMul: 1, speedMul: 1 }
    }
  ],

  // =====================================================================
  // ENNEMIS — biome 1
  // =====================================================================
  enemies: [
    { id: 'enemy_rodeur', name: 'Rôdeur', archetype: 'rusher',
      desc: 'Court vers vous ; à 90 px il se fige 0,35 s puis bondit. Le bond peut être esquivé de côté.',
      hp: 30, speed: 200, damage: 10, radius: 14, xp: 4, coins: 1, color: '#e05a4a',
      behavior: { lungeRange: 90, lungeWindup: 0.35, lungeSpeed: 520, lungeDuration: 0.25, lungeCooldown: 1.2 },
      telegraph: { time: 0.35, color: '#ffd166' } },
    { id: 'enemy_sentinelle', name: 'Sentinelle', archetype: 'shooter',
      desc: 'Garde 300 px de distance, vise 0,5 s (ligne pointillée) puis tire une balle lente de 10 dégâts.',
      hp: 26, speed: 130, damage: 8, radius: 14, xp: 6, coins: 2, color: '#4fa3e0',
      behavior: { fireRate: 0.7, projSpeed: 320, projDamage: 10, projSize: 7, keepDistance: 300, aimTime: 0.5, burst: 1 },
      telegraph: { time: 0.5, color: '#7bd3ff' } },
    { id: 'enemy_bloc', name: 'Bloc', archetype: 'tank',
      desc: 'Lent et massif. S\'arrête, tremble 0,8 s, puis charge en ligne droite. S\'il percute un mur : étourdi 1,2 s.',
      hp: 140, speed: 90, damage: 15, radius: 24, xp: 14, coins: 4, color: '#8c6d4f',
      behavior: { chargeWindup: 0.8, chargeSpeed: 560, chargeDuration: 0.7, chargeCooldown: 3.0, stunOnWallHit: 1.2, chargeDamageMul: 1.5 },
      telegraph: { time: 0.8, color: '#ff8c42' } },
    { id: 'enemy_meche', name: 'Mèche', archetype: 'kamikaze',
      desc: 'Fonce sur vous ; à 60 px la mèche s\'allume (0,9 s, clignote) puis explose sur 80 px. Tuez-la loin de vous.',
      hp: 18, speed: 240, damage: 6, radius: 12, xp: 5, coins: 1, color: '#ff5f3b',
      behavior: { fuse: 0.9, radius: 80, explosionDamage: 22, triggerRange: 60, explodeOnDeath: true },
      telegraph: { time: 0.9, color: '#ff3b3b' } },
    { id: 'enemy_incubateur', name: 'Incubateur', archetype: 'summoner',
      desc: 'Reste à 350 px, gonfle 0,7 s puis libère une Nuée (toutes les 4 s, max 4 vivantes). Priorité de tir.',
      hp: 80, speed: 60, damage: 8, radius: 20, xp: 20, coins: 5, color: '#9b6fd6',
      behavior: { summon: 'enemy_nuee', every: 4.0, max: 4, keepDistance: 350, summonWindup: 0.7 },
      telegraph: { time: 0.7, color: '#b98cff' } },
    { id: 'enemy_nuee', name: 'Nuée', archetype: 'swarm',
      desc: 'Groupe de 5 petits organismes rapides et fragiles. Tremblent 0,2 s avant de mordre. Zone et chaîne les balaient.',
      hp: 8, speed: 300, damage: 5, radius: 8, xp: 3, coins: 1, color: '#7ed957',
      behavior: { groupSize: 5, jitter: 40, biteWindup: 0.2, biteCooldown: 0.8 },
      telegraph: { time: 0.2, color: '#9cff57' } },
    { id: 'enemy_eclipse', name: 'Éclipse', archetype: 'dasher',
      desc: 'Rôde à 260 px, se dissipe 0,45 s (silhouette) puis réapparaît et fonce sur vous. Vulnérable 0,6 s après la ruée.',
      hp: 40, speed: 180, damage: 12, radius: 14, xp: 10, coins: 3, color: '#d64fbf',
      behavior: { blinkRange: 260, blinkWindup: 0.45, blinkCooldown: 2.2, dashSpeed: 700, dashDuration: 0.3, postDashPause: 0.6 },
      telegraph: { time: 0.45, color: '#ff6bd6' } }
  ],

  // =====================================================================
  // BOSS — mini-boss biome 1
  // =====================================================================
  bosses: [
    {
      id: 'boss_etalon_07', name: 'Étalon 07, dit « le Portier »',
      desc: 'Le sujet de référence d\'ADMISSION, gardé comme mètre-étalon. Vérin hydraulique au bras droit, prise de calibration à nu dans le dos. Lourd, prévisible : il faut le faire pivoter.',
      hp: 900, speed: 120, radius: 36, damage: 18, xp: 120, coins: 40,
      phases: [
        { hpBelow: 1.0, patterns: [
          { kind: 'ring', telegraph: 0.8, duration: 0.3, cooldown: 3.5, count: 12, projSpeed: 260, projDamage: 12, projSize: 8 },
          { kind: 'charge', telegraph: 0.9, duration: 0.8, cooldown: 5.0, speed: 620, damage: 20, stopOnWall: true, stunTime: 1.5 },
          { kind: 'slam', telegraph: 1.0, duration: 0.4, cooldown: 6.0, radius: 140, damage: 25, knockback: 3.0 }
        ] },
        { hpBelow: 0.5, patterns: [
          { kind: 'fan', telegraph: 0.6, duration: 0.5, cooldown: 2.5, count: 7, spread: 1.2, projSpeed: 300, projDamage: 12, projSize: 8 },
          { kind: 'spiral', telegraph: 0.7, duration: 3.0, cooldown: 6.0, arms: 2, rate: 12, angularSpeed: 2.0, projSpeed: 220, projDamage: 10, projSize: 7 },
          { kind: 'summon', telegraph: 0.8, duration: 0.5, cooldown: 9.0, enemy: 'enemy_nuee', count: 4 },
          { kind: 'charge', telegraph: 0.7, duration: 0.8, cooldown: 5.0, speed: 700, damage: 22, stopOnWall: true, stunTime: 1.5 }
        ] }
      ],
      weakness: { desc: 'Sa prise de calibration dorsale est à nu : tout coup porté dans un cône de 90° derrière lui fait ×2 et le "débranche" 0,8 s (étourdi, ne se retourne pas). Une charge finie dans un mur (1,5 s d\'étourdissement) est le moyen le plus sûr d\'atteindre son dos.', rule: 'back', damageMul: 2.0, window: 0.8, coneAngle: 1.57, stunCooldown: 3.0 },
      revenge: {
        hpMul: 1.6,
        extraPhases: [
          { hpBelow: 0.3, patterns: [
            { kind: 'laser_sweep', telegraph: 1.0, duration: 2.5, cooldown: 7.0, angularSpeed: 1.6, length: 700, damage: 20 },
            { kind: 'ring', telegraph: 0.5, duration: 0.3, cooldown: 2.0, count: 16, projSpeed: 300, projDamage: 14, projSize: 8 },
            { kind: 'charge', telegraph: 0.5, duration: 0.6, cooldown: 3.0, speed: 800, damage: 26, stopOnWall: false, stunTime: 0.6 }
          ] }
        ],
        desc: 'PRÉVU (salle 9) : ÉTALON 07 / rév. B, reconditionné entre les salles 5 et 9. 1440 PV. Une plaque de tôle vissée à la va-vite couvre la prise dorsale : la faiblesse est inactive jusqu\'à 6 impacts dans le dos, puis la plaque saute et la faiblesse revient avec une fenêtre de 0,4 s au lieu de 0,8. Ses charges ne s\'arrêtent plus dans les murs (0,6 s d\'étourdissement). Il a chargé vos données de consignation : en phase 2 il reproduit votre compétence de salle 1 (dash → charge courte, tourelle → summon, onde → slam, blink → téléportation dans votre dos) et ses patterns sous 30 % PV s\'inspirent des greffes refusées aux level-ups (proposition lore, à trancher en phase 2).'
      }
    }
  ],

  // =====================================================================
  // PIÈGES — biome 1 (8 kinds)
  // =====================================================================
  traps: [
    { id: 'trap_balayage', name: 'Balayage laser', kind: 'laser_sweep',
      desc: 'Un rayon vertical parcourt la zone de gauche à droite en 1,6 s, puis revient au cycle suivant.',
      damage: 14, telegraph: 0.8, period: 4.0, active: 1.6,
      params: { orientation: 'vertical', pingpong: true, thickness: 0.5, hitOnce: true } },
    { id: 'trap_tourniquet', name: 'Tourniquet', kind: 'laser_rotate',
      desc: '2 bras laser de 5 tuiles tournent (1,2 rad/s). Pause de 1 s tous les 6 s : la fenêtre pour traverser.',
      damage: 12, telegraph: 1.0, period: 6.0, active: 5.0,
      params: { arms: 2, lengthTiles: 5, angularSpeed: 1.2, startAngle: 0, thickness: 0.4 } },
    { id: 'trap_grille', name: 'Grille', kind: 'laser_grid',
      desc: 'Lignes laser espacées de 4 tuiles. Cycles alternés : verticales puis horizontales. 1 s allumé, 2 s éteint.',
      damage: 10, telegraph: 0.5, period: 3.0, active: 1.0,
      params: { spacingTiles: 4, alternate: true, thickness: 0.3 } },
    { id: 'trap_bouche', name: 'Bouche de feu', kind: 'wall_fireball',
      desc: 'Une bouche murale crache une boule de feu droite toutes les 2,5 s. Se décale avec phase.',
      damage: 12, telegraph: 0.6, period: 2.5, active: 0.2,
      params: { dir: 'down', projSpeed: 320, size: 12, count: 1, lifetime: 3.0 } },
    { id: 'trap_dalles', name: 'Dalles à pointes', kind: 'spike_tiles',
      desc: 'Damier : les cases paires sortent leurs pointes 0,8 s, puis les impaires. Toujours une case sûre à côté.',
      damage: 10, telegraph: 0.5, period: 2.0, active: 0.8,
      params: { pattern: 'checker', groups: 2, hitOnce: true } },
    { id: 'trap_nappe', name: 'Nappe de gaz', kind: 'gas_zone',
      desc: 'Une bouche siffle 1,2 s puis libère un nuage de 2,5 tuiles pendant 3 s : 8 dégâts/s et -30 % vitesse.',
      damage: 8, telegraph: 1.2, period: 7.0, active: 3.0,
      params: { radiusTiles: 2.5, tickRate: 4, slow: 0.3, dps: true } },
    { id: 'trap_rail', name: 'Scie sur rail', kind: 'saw_rail',
      desc: 'Scie circulaire qui fait des allers-retours sur un rail de 8 tuiles à 6 tuiles/s. Jamais de pause.',
      damage: 18, telegraph: 0.4, period: 3.2, active: 3.2,
      params: { axis: 'x', lengthTiles: 8, speedTiles: 6, pingpong: true, radiusTiles: 0.6, hitOnce: true } },
    { id: 'trap_tourelle', name: 'Tourelle fixe', kind: 'turret_fixed',
      desc: 'Tourelle murale : 0,7 s de visée (rayon rouge) puis 1 balle vers le joueur toutes les 2,4 s. Destructible ? Non.',
      damage: 9, telegraph: 0.7, period: 2.4, active: 0.3,
      params: { mode: 'aim', angle: 0, projSpeed: 380, count: 1, spread: 0, projSize: 6 } }
  ],

  // =====================================================================
  // SALLES — biome 1 (grille 24×13, x 0..23, y 0..12 ; entrée à gauche x=0 y=6, sortie à droite x=23 y=6)
  // =====================================================================
  rooms: [
    // ---------- SALLE 1 : PRÉPARATION + COMBAT ----------
    { id: 'room_b1_1', biome: 'biome_1', index: 1, type: 'PREP_COMBAT', refTime: 45,
      obstacles: [
        { x: 6, y: 3, w: 1, h: 1 }, { x: 6, y: 9, w: 1, h: 1 },
        { x: 17, y: 3, w: 1, h: 1 }, { x: 17, y: 9, w: 1, h: 1 },
        { x: 11, y: 6, w: 2, h: 1 }
      ],
      waves: [
        { at: 'start', spawns: [
          { enemy: 'enemy_rodeur', count: 2, x: 20, y: 3 },
          { enemy: 'enemy_rodeur', count: 1, x: 20, y: 9 } ] },
        { at: 'clear', spawns: [
          { enemy: 'enemy_rodeur', count: 3, x: -1, y: -1 },
          { enemy: 'enemy_sentinelle', count: 1, x: 21, y: 6 } ] },
        { at: 'clear', spawns: [
          { enemy: 'enemy_nuee', count: 1, x: 21, y: 2 },
          { enemy: 'enemy_sentinelle', count: 2, x: 21, y: 10 },
          { enemy: 'enemy_rodeur', count: 2, x: 2, y: 1 } ] }
      ],
      traps: [], fragments: [], modular: [] },

    // ---------- SALLE 2 : PIÈGES + FRAGMENTS D'ÉNERGIE ----------
    { id: 'room_b1_2', biome: 'biome_1', index: 2, type: 'TRAP', refTime: 60,
      obstacles: [
        { x: 9, y: 0, w: 1, h: 3 }, { x: 9, y: 10, w: 1, h: 3 },
        { x: 15, y: 0, w: 1, h: 3 }, { x: 15, y: 10, w: 1, h: 3 }
      ],
      waves: [],
      traps: [
        // Zone A (x 3..8) : damier de pointes, on avance en suivant les cases éteintes
        { trap: 'trap_dalles', x: 3, y: 3, w: 6, h: 7, phase: 0 },
        // Zone B (x 10..14) : deux balayages verticaux décalés d'un demi-cycle
        { trap: 'trap_balayage', x: 10, y: 0, w: 5, h: 13, phase: 0 },
        { trap: 'trap_balayage', x: 10, y: 0, w: 5, h: 13, phase: 2.0 },
        // Zone C (x 16..21) : bouches de feu depuis le haut + scie en travers
        { trap: 'trap_bouche', x: 16, y: 0, phase: 0 },
        { trap: 'trap_bouche', x: 18, y: 0, phase: 0.8 },
        { trap: 'trap_bouche', x: 20, y: 0, phase: 1.6 },
        { trap: 'trap_rail', x: 16, y: 6, w: 6, h: 1, phase: 0 },
        // Sortie : tourniquet devant la porte
        { trap: 'trap_tourniquet', x: 21, y: 6, phase: 0 }
      ],
      fragments: [
        { x: 5, y: 6, at: 0 },     // au milieu du damier de pointes
        { x: 12, y: 6, at: 0 },    // au centre du double balayage
        { x: 18, y: 2, at: 8 },    // juste sous une bouche de feu
        { x: 19, y: 6, at: 16 },   // sur le rail de la scie
        { x: 21, y: 4, at: 24 }    // dans le rayon du tourniquet
      ],
      modular: [] },

    // ---------- SALLE 3 : COMBAT + PIÈGES ----------
    { id: 'room_b1_3', biome: 'biome_1', index: 3, type: 'COMBAT_TRAP', refTime: 75,
      obstacles: [
        { x: 4, y: 2, w: 2, h: 1 }, { x: 4, y: 10, w: 2, h: 1 },
        { x: 18, y: 2, w: 2, h: 1 }, { x: 18, y: 10, w: 2, h: 1 }
      ],
      waves: [
        { at: 'start', spawns: [
          { enemy: 'enemy_rodeur', count: 3, x: 20, y: 6 },
          { enemy: 'enemy_sentinelle', count: 2, x: 21, y: 2 } ] },
        { at: 'clear', spawns: [
          { enemy: 'enemy_bloc', count: 1, x: 21, y: 6 },
          { enemy: 'enemy_rodeur', count: 4, x: -1, y: -1 } ] },
        { at: 'clear', spawns: [
          { enemy: 'enemy_meche', count: 2, x: 2, y: 1 },
          { enemy: 'enemy_sentinelle', count: 2, x: 21, y: 10 },
          { enemy: 'enemy_nuee', count: 1, x: 21, y: 2 } ] }
      ],
      traps: [
        { trap: 'trap_tourniquet', x: 11, y: 6, phase: 0 },
        { trap: 'trap_dalles', x: 1, y: 1, w: 3, h: 3, phase: 0 },
        { trap: 'trap_dalles', x: 20, y: 9, w: 3, h: 3, phase: 1.0 },
        { trap: 'trap_tourelle', x: 8, y: 0, phase: 0 },
        { trap: 'trap_tourelle', x: 15, y: 0, phase: 1.2 }
      ],
      fragments: [], modular: [] },

    // ---------- SALLE 4 : COFFRE (checkpoint) ----------
    { id: 'room_b1_4', biome: 'biome_1', index: 4, type: 'CHEST', refTime: 20,
      obstacles: [
        { x: 8, y: 4, w: 1, h: 1 }, { x: 8, y: 8, w: 1, h: 1 },
        { x: 15, y: 4, w: 1, h: 1 }, { x: 15, y: 8, w: 1, h: 1 }
      ],
      waves: [], traps: [], fragments: [], modular: [] },

    // ---------- SALLE 5 : MINI-BOSS ----------
    { id: 'room_b1_5', biome: 'biome_1', index: 5, type: 'MINIBOSS', refTime: 120,
      obstacles: [
        { x: 5, y: 3, w: 2, h: 2 }, { x: 17, y: 3, w: 2, h: 2 },
        { x: 5, y: 8, w: 2, h: 2 }, { x: 17, y: 8, w: 2, h: 2 }
      ],
      waves: [
        { at: 'start', spawns: [ { enemy: 'boss_etalon_07', count: 1, x: 18, y: 6 } ] }
      ],
      traps: [], fragments: [], modular: [] },

    // ---------- SALLES 6-9 : squelettes (phase 2) ----------
    { id: 'room_b1_6', biome: 'biome_1', index: 6, type: 'COMBAT_MODULAR', refTime: 80,
      obstacles: [ { x: 11, y: 5, w: 2, h: 3 } ],
      waves: [
        { at: 'start', spawns: [ { enemy: 'enemy_eclipse', count: 2, x: -1, y: -1 }, { enemy: 'enemy_sentinelle', count: 2, x: -1, y: -1 } ] },
        { at: 'clear', spawns: [ { enemy: 'enemy_incubateur', count: 1, x: 21, y: 6 }, { enemy: 'enemy_rodeur', count: 4, x: -1, y: -1 } ] },
        { at: 'clear', spawns: [ { enemy: 'enemy_bloc', count: 2, x: -1, y: -1 }, { enemy: 'enemy_meche', count: 3, x: -1, y: -1 } ] }
      ],
      traps: [], fragments: [], modular: [] },
    { id: 'room_b1_7', biome: 'biome_1', index: 7, type: 'COMBAT_TRAP_MODULAR', refTime: 90,
      obstacles: [ { x: 6, y: 6, w: 1, h: 1 }, { x: 17, y: 6, w: 1, h: 1 } ],
      waves: [
        { at: 'start', spawns: [ { enemy: 'enemy_incubateur', count: 1, x: 21, y: 3 }, { enemy: 'enemy_eclipse', count: 2, x: -1, y: -1 } ] },
        { at: 'clear', spawns: [ { enemy: 'enemy_bloc', count: 1, x: 21, y: 6 }, { enemy: 'enemy_sentinelle', count: 3, x: -1, y: -1 }, { enemy: 'enemy_nuee', count: 2, x: -1, y: -1 } ] },
        { at: 'clear', spawns: [ { enemy: 'enemy_meche', count: 4, x: -1, y: -1 }, { enemy: 'enemy_eclipse', count: 2, x: -1, y: -1 } ] }
      ],
      traps: [
        { trap: 'trap_grille', x: 2, y: 1, w: 20, h: 11, phase: 0 },
        { trap: 'trap_nappe', x: 11, y: 6, phase: 0 }
      ],
      fragments: [], modular: [] },
    { id: 'room_b1_8', biome: 'biome_1', index: 8, type: 'CHEST_FINAL', refTime: 20,
      obstacles: [], waves: [], traps: [], fragments: [], modular: [] },
    { id: 'room_b1_9', biome: 'biome_1', index: 9, type: 'BOSS_REVENGE', refTime: 150,
      obstacles: [ { x: 5, y: 3, w: 2, h: 2 }, { x: 17, y: 3, w: 2, h: 2 }, { x: 5, y: 8, w: 2, h: 2 }, { x: 17, y: 8, w: 2, h: 2 } ],
      waves: [ { at: 'start', spawns: [ { enemy: 'boss_etalon_07', count: 1, x: 18, y: 6 } ] } ],
      traps: [ { trap: 'trap_tourelle', x: 11, y: 0, phase: 0 }, { trap: 'trap_tourelle', x: 12, y: 12, phase: 1.2 } ],
      fragments: [], modular: [] }
  ]
};
