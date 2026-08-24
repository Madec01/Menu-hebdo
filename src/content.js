/* CORE — catalogue : bonus, malus, passifs, pactes, pieces, metiers.
   Reference complete : docs/bonus-et-passifs.md */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';

  /* ---------------------------------------------------------------- BONUS */
  var BONUS = [
    { id: 'B-01', name: 'Frenesie',    icon: '>>', color: '#ff8a3d', dur: 20, weight: 20,
      desc: 'Vitesse de forage', tiers: [1.8, 2.2, 2.8], apply: function (s, t) { s.speed *= t; } },
    { id: 'B-02', name: 'Titan',       icon: '##', color: '#ff4d5e', dur: 15, weight: 18,
      desc: 'Force', tiers: [2.5, 3.5, 5.0], apply: function (s, t) { s.force *= t; } },
    { id: 'B-03', name: 'Expansion',   icon: '<>', color: '#5ddc7a', dur: 20, weight: 16,
      desc: 'Largeur de taille', tiers: [2, 3, 4], apply: function (s, t) { s.width += t; } },
    { id: 'B-04', name: 'Perforation', icon: '=>', color: '#7ec8ff', dur: 20, weight: 13,
      desc: 'Longueur de taille', tiers: [1, 2, 3], apply: function (s, t) { s.length += t; } },
    { id: 'B-05', name: 'Aimant',      icon: '(o)', color: '#b48dff', dur: 30, weight: 12,
      desc: 'Ramassage a distance', tiers: [6, 10, 15], apply: function (s, t) { s.magnet = Math.max(s.magnet, t); } },
    { id: 'B-20', name: 'Nitro',       icon: '^^', color: '#4ad9ff', dur: 12, weight: 12,
      desc: 'Consommation nulle', tiers: [12, 16, 20], noBurn: true, apply: function (s) { s.noBurn = true; } },
    { id: 'B-09', name: 'Surregime',   icon: '!>', color: '#ffce3d', dur: 12, weight: 8,
      desc: 'Vitesse x2, consommation x3', tiers: [2, 2.4, 3],
      apply: function (s, t) { s.speed *= t; s.burn *= 3; } },
    { id: 'B-14', name: 'Sablier fele', icon: '[]', color: '#5ff0e0', dur: 10, weight: 5,
      desc: 'Le chrono se fige', tiers: [10, 13, 16], freeze: true, apply: function () {} }
  ];

  var MALUS = [
    { id: 'M-01', name: 'Etourdissement', icon: '!!', color: '#8a8f98', dur: 2, weight: 10,
      desc: 'Foreuse a l\'arret', stun: true, apply: function (s) { s.speed = 0; s.roll = 0; } },
    { id: 'M-02', name: 'Rouille', icon: '~~', color: '#9c6b3f', dur: 8, weight: 12,
      desc: 'Vitesse divisee par deux', apply: function (s) { s.speed *= 0.5; } },
    { id: 'M-07', name: 'Fuite', icon: 'vv', color: '#8ac46a', dur: 10, weight: 9,
      desc: 'Le reservoir fuit', leak: 1.6, apply: function () {} }
  ];

  var BONUS_BY_ID = {};
  BONUS.concat(MALUS).forEach(function (b) { BONUS_BY_ID[b.id] = b; });

  /* -------------------------------------------------------------- PASSIFS */
  var PASSIVES = [
    { id: 'V-01', fam: 'MOTEUR', name: 'Injection', rar: 0, max: 99,
      desc: 'Vitesse de forage +12 %',
      apply: function (s, n) { s.speed *= Math.pow(1.12, n); } },

    { id: 'V-04', fam: 'MOTEUR', name: 'Second souffle', rar: 0, max: 1,
      desc: 'A l\'expiration d\'un bonus : +30 % de vitesse pendant 5 s',
      flag: 'secondSouffle', apply: function () {} },

    { id: 'V-05', fam: 'MOTEUR', name: 'Metronome', rar: 1, max: 1,
      desc: 'L\'elan monte deux fois plus vite',
      apply: function (s) { s.elanRise *= 0.5; } },

    { id: 'V-06', fam: 'MOTEUR', name: 'Volant d\'inertie', rar: 1, max: 1,
      desc: 'On ne perd plus que 20 % d\'elan en changeant de direction',
      apply: function (s) { s.elanLoss = 0.2; } },

    { id: 'F-01', fam: 'TETE', name: 'Bras de fer', rar: 0, max: 99,
      desc: 'Force +2', apply: function (s, n) { s.force += 2 * n; } },

    { id: 'F-02', fam: 'TETE', name: 'Carbure', rar: 0, max: 99,
      desc: 'Force +15 %', apply: function (s, n) { s.force *= Math.pow(1.15, n); } },

    { id: 'F-05', fam: 'TETE', name: 'Brise-roche', rar: 1, max: 3,
      desc: '15 % de chance de detruire un bloc d\'un seul coup',
      apply: function (s, n) { s.crit = (s.crit || 0) + 0.15 * n; } },

    { id: 'Z-01', fam: 'ZONE', name: 'Tunnelier', rar: 0, max: 4,
      desc: 'Largeur +1, vitesse -10 %',
      apply: function (s, n) { s.width += n; s.speed *= Math.pow(0.9, n); } },

    { id: 'Z-03', fam: 'ZONE', name: 'Elargisseur', rar: 1, max: 4,
      desc: 'Largeur de taille +1 (max 6)', apply: function (s, n) { s.width += n; } },

    { id: 'Z-04', fam: 'ZONE', name: 'Perforateur', rar: 1, max: 3,
      desc: 'Longueur de taille +1 (max 4)', apply: function (s, n) { s.length += n; } },

    { id: 'P-01', fam: 'PILOTAGE', name: 'Chenilles crantees', rar: 0, max: 4,
      desc: 'Deplacement dans les galeries x1,5',
      apply: function (s, n) { s.roll *= Math.pow(1.5, n); s.climb *= Math.pow(1.4, n); } },

    { id: 'P-06', fam: 'PILOTAGE', name: 'Gyroscope', rar: 1, max: 1,
      desc: 'La tete pivote instantanement', apply: function (s) { s.rot = 0.02; } },

    { id: 'P-07', fam: 'PILOTAGE', name: 'Turbocompresseur', rar: 1, max: 2,
      desc: 'Recharge du turbo divisee par deux',
      apply: function (s, n) { s.turboCd *= Math.pow(0.5, n); } },

    { id: 'O-01', fam: 'BUTIN', name: 'Aimant permanent', rar: 0, max: 4,
      desc: 'Rayon de ramassage +4', apply: function (s, n) { s.magnet += 4 * n; } },

    { id: 'O-02', fam: 'BUTIN', name: 'Cupidite', rar: 0, max: 3,
      desc: 'Valeur du minerai +40 %, vitesse -10 %',
      apply: function (s, n) { s.value *= Math.pow(1.4, n); s.speed *= Math.pow(0.9, n); } },

    { id: 'C-01', fam: 'CHANCE', name: 'Flair', rar: 0, max: 4,
      desc: '+25 % de bonus generes dans les niveaux suivants',
      apply: function (s, n) { s.luck *= Math.pow(1.25, n); } },

    /* --- famille RESERVOIR : tout ce qui touche au carburant -------------- */
    { id: 'U-01', fam: 'RESERVOIR', name: 'Econome', rar: 0, max: 5,
      desc: 'Consommation -12 %', apply: function (s, n) { s.burn *= Math.pow(0.88, n); } },

    { id: 'U-02', fam: 'RESERVOIR', name: 'Reserve profonde', rar: 0, max: 4,
      desc: 'Reservoir +30 L', apply: function (s, n) { s.fuelMax += 30 * n; } },

    { id: 'U-06', fam: 'RESERVOIR', name: 'Jerricane', rar: 0, max: 2,
      desc: 'Les bidons rendent le double', flag: 'bigCans', apply: function () {} },

    { id: 'U-03', fam: 'RESERVOIR', name: 'Goutte a goutte', rar: 1, max: 2,
      desc: 'Chaque bloc de minerai rend 1 L', flag: 'oreFuel', apply: function () {} },

    { id: 'U-05', fam: 'RESERVOIR', name: 'Recuperateur', rar: 1, max: 1,
      desc: 'Chaque chute de 10 m rend 3 L : tomber devient une ressource',
      flag: 'fallFuel', apply: function () {} },

    { id: 'U-04', fam: 'RESERVOIR', name: 'Turbo sec', rar: 1, max: 1,
      desc: 'Le turbo ne consomme plus de carburant', flag: 'dryTurbo', apply: function () {} },

    /* --- famille TERRAIN : des cartes qui changent les REGLES ------------- */
    { id: 'T-01', fam: 'TERRAIN', name: 'Sismographe', rar: 0, max: 1,
      desc: 'Les masses instables se colorent avant de lacher',
      flag: 'seismo', apply: function () {} },

    { id: 'T-02', fam: 'TERRAIN', name: 'Etayeur', rar: 1, max: 1,
      desc: 'Plus rien ne s\'effondre derriere toi, seulement devant',
      flag: 'propper', apply: function () {} },

    { id: 'T-03', fam: 'TERRAIN', name: 'Charognard', rar: 1, max: 1,
      desc: 'La roche qui te tombe dessus se transforme en minerai',
      flag: 'scavenger', apply: function () {} },

    { id: 'T-04', fam: 'TERRAIN', name: 'Casse-cou', rar: 1, max: 1,
      desc: '+40 % de vitesse tant que la Faille est a moins de 15 lignes',
      flag: 'daredevil', apply: function () {} },

    { id: 'T-05', fam: 'TERRAIN', name: 'Onde sismique', rar: 1, max: 2,
      desc: 'Chaque effondrement declenche recharge le turbo',
      apply: function (s, n) { s.quakeTurbo = 3 * n; } },

    { id: 'T-06', fam: 'TERRAIN', name: 'Casque renforce', rar: 1, max: 2,
      desc: 'Integrite +1',
      apply: function (s, n) { s.hpBonus = (s.hpBonus || 0) + n; } },

    { id: 'P-09', fam: 'PILOTAGE', name: 'Foreuse gravitationnelle', rar: 2, max: 1,
      desc: 'En chute, on fore vers le bas a pleine vitesse sans ralentir',
      flag: 'gravDrill', apply: function () {} },

    { id: 'L-02', fam: 'LEGENDAIRE', name: 'Noyau instable', rar: 2, max: 1,
      desc: 'Tous les 60 m, une explosion creuse un rayon de 5',
      flag: 'unstable', apply: function () {} },

    { id: 'L-06', fam: 'LEGENDAIRE', name: 'Perpetuel', rar: 2, max: 1,
      desc: 'L\'elan ne retombe jamais a l\'interieur d\'un niveau',
      flag: 'perpetual', apply: function (s) { s.elanLoss = 0; } }
  ];

  /* ---------------------------------------------------------------- PACTES */
  /* Une carte sur six est remplacee par un pacte : gros gain, vrai prix. */
  var PACTS = [
    { id: 'PA-1', fam: 'PACTE', name: 'Pacte du fondeur', rar: 1, max: 1, pact: true,
      desc: 'Force x2 — mais forer vers le haut devient impossible',
      flag: 'noUp', apply: function (s) { s.force *= 2; } },
    { id: 'PA-2', fam: 'PACTE', name: 'Pacte de l\'avare', rar: 1, max: 1, pact: true,
      desc: 'Valeur x3 — mais la boutique est fermee au prochain passage',
      flag: 'shopClosed', apply: function (s) { s.value *= 3; } },
    { id: 'PA-3', fam: 'PACTE', name: 'Pacte de vitesse', rar: 1, max: 1, pact: true,
      desc: 'Vitesse x1,5 — mais l\'elan retombe a zero a chaque changement de sens',
      apply: function (s) { s.speed *= 1.5; s.elanLoss = 1; } },
    { id: 'PA-4', fam: 'PACTE', name: 'Pacte du colosse', rar: 1, max: 1, pact: true,
      desc: 'Largeur +3 — mais le roulage est divise par deux',
      apply: function (s) { s.width += 3; s.roll *= 0.5; } },
    { id: 'PA-7', fam: 'PACTE', name: 'Moteur deux temps', rar: 1, max: 1, pact: true,
      desc: 'Vitesse x1,5 — mais consommation x2',
      apply: function (s) { s.speed *= 1.5; s.burn *= 2; } }
  ];

  var ALL = PASSIVES.concat(PACTS);
  var PASSIVE_BY_ID = {};
  ALL.forEach(function (p) { PASSIVE_BY_ID[p.id] = p; });

  /* --------------------------------------------------------- PIECES (shop) */
  var PARTS = [
    { id: 'tete', name: 'Tete de forage', desc: 'Force +2,5', cost: 170, growth: 1.62, max: 14,
      apply: function (s, n) { s.force += 2.5 * n; } },
    { id: 'moteur', name: 'Moteur', desc: 'Vitesse +0,35', cost: 170, growth: 1.62, max: 14,
      apply: function (s, n) { s.speed += 0.35 * n; } },
    { id: 'reservoir', name: 'Reservoir', desc: 'Carburant +40 L', cost: 210, growth: 1.75, max: 6,
      apply: function (s, n) { s.fuelMax += 40 * n; } },
    { id: 'injection', name: 'Injection propre', desc: 'Consommation -15 %', cost: 280, growth: 1.8, max: 5,
      apply: function (s, n) { s.burn *= Math.pow(0.85, n); } },
    { id: 'elargisseur', name: 'Elargisseur', desc: 'Largeur +1', cost: 620, growth: 2.4, max: 4,
      apply: function (s, n) { s.width += n; } },
    { id: 'chenilles', name: 'Chenilles', desc: 'Deplacement +2,5', cost: 160, growth: 1.6, max: 6,
      apply: function (s, n) { s.roll += 2.5 * n; s.climb += 1.5 * n; } }
  ];

  /* ------------------------------------------------------------- METIERS */
  var JOBS = [
    { id: 'MT-1', name: 'Le Bourrin', desc: 'Force x2, vitesse -10 %',
      apply: function (s) { s.force *= 2; s.speed *= 0.9; } },
    { id: 'MT-2', name: 'Le Furieux', desc: 'Vitesse de forage x1,5',
      apply: function (s) { s.speed *= 1.5; } },
    { id: 'MT-3', name: 'Le Chanceux', desc: '50 % de bonus en plus dans la roche',
      apply: function (s) { s.luck *= 1.5; } },
    { id: 'MT-9', name: 'Le Camionneur', desc: 'Reservoir +60 L, consommation -20 %',
      apply: function (s) { s.fuelMax += 60; s.burn *= 0.8; } }
  ];

  /* --------------------------------------------------------------- TIRAGE */
  function rarityWeights(layerId) {
    var t = Math.min(1, (layerId - 1) / 5);
    return [60 - 25 * t, 30 + 10 * t, 9 + 11 * t];
  }

  function draw(rng, owned, layerId, count) {
    var w = rarityWeights(layerId);
    var pool = PASSIVES.filter(function (p) { return (owned[p.id] || 0) < p.max; });
    var out = [];
    for (var k = 0; k < count && pool.length; k++) {
      var weighted = [];
      pool.forEach(function (p) {
        var n = Math.max(1, Math.round(w[p.rar]));
        for (var i = 0; i < n; i++) weighted.push(p);
      });
      var chosen = rng.pick(weighted);
      out.push(chosen);
      pool = pool.filter(function (p) { return p !== chosen; });
    }
    // une carte sur six devient un pacte
    var pactPool = PACTS.filter(function (p) { return !(owned[p.id] || 0); });
    if (pactPool.length && out.length && rng.chance(1 / 6)) {
      out[rng.int(0, out.length - 1)] = rng.pick(pactPool);
    }
    return out;
  }

  function rollBonus(rng, allowMalus) {
    var table = allowMalus ? BONUS.concat(MALUS) : BONUS;
    var weighted = [];
    table.forEach(function (b) {
      for (var i = 0; i < b.weight; i++) weighted.push(b);
    });
    return rng.pick(weighted);
  }

  CORE.CONTENT = {
    BONUS: BONUS, MALUS: MALUS, BONUS_BY_ID: BONUS_BY_ID,
    PASSIVES: PASSIVES, PACTS: PACTS, ALL: ALL, PASSIVE_BY_ID: PASSIVE_BY_ID,
    PARTS: PARTS, JOBS: JOBS,
    draw: draw, rollBonus: rollBonus,
    RAR_NAME: ['commun', 'rare', 'legendaire'],
    partCost: function (part, owned) {
      return Math.round(part.cost * Math.pow(part.growth, owned));
    }
  };
})(window.CORE);
