/* CORE — catalogue MVP : bonus, malus, passifs, pieces, metiers.
   Reference complete : docs/bonus-et-passifs.md */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';

  /* ---------------------------------------------------------------- BONUS */
  /* mult / add s'appliquent aux stats effectives ; niveaux I -> III. */
  var BONUS = [
    { id: 'B-01', name: 'Frenesie',    icon: '>>', color: '#ff8a3d', dur: 20, weight: 22,
      desc: 'Vitesse de forage', tiers: [1.8, 2.2, 2.8], apply: function (s, t) { s.speed *= t; } },
    { id: 'B-02', name: 'Titan',       icon: '##', color: '#ff4d5e', dur: 15, weight: 20,
      desc: 'Force', tiers: [2.5, 3.5, 5.0], apply: function (s, t) { s.force *= t; } },
    { id: 'B-03', name: 'Expansion',   icon: '<>', color: '#5ddc7a', dur: 20, weight: 18,
      desc: 'Largeur de taille', tiers: [2, 3, 4], apply: function (s, t) { s.width += t; } },
    { id: 'B-04', name: 'Perforation', icon: '=>', color: '#7ec8ff', dur: 20, weight: 14,
      desc: 'Longueur de taille', tiers: [1, 2, 3], apply: function (s, t) { s.length += t; } },
    { id: 'B-05', name: 'Aimant',      icon: '(o)', color: '#b48dff', dur: 30, weight: 14,
      desc: 'Ramassage a distance', tiers: [6, 10, 15], apply: function (s, t) { s.magnet = Math.max(s.magnet, t); } },
    { id: 'B-14', name: 'Sablier fele', icon: '[]', color: '#5ff0e0', dur: 10, weight: 6,
      desc: 'Le chrono se fige', tiers: [10, 13, 16], freeze: true, apply: function () {} }
  ];

  var MALUS = [
    { id: 'M-01', name: 'Etourdissement', icon: '!!', color: '#8a8f98', dur: 2, weight: 10,
      desc: 'Foreuse a l\'arret', stun: true, apply: function (s) { s.speed = 0; s.roll = 0; } },
    { id: 'M-02', name: 'Rouille', icon: '~~', color: '#9c6b3f', dur: 8, weight: 12,
      desc: 'Vitesse divisee par deux', apply: function (s) { s.speed *= 0.5; } }
  ];

  var BONUS_BY_ID = {};
  BONUS.concat(MALUS).forEach(function (b) { BONUS_BY_ID[b.id] = b; });

  /* -------------------------------------------------------------- PASSIFS */
  /* rar : 0 commun, 1 rare, 2 epique/legendaire.
     max : nombre de fois qu'on peut prendre la carte.
     apply(s, n) : n = nombre d'exemplaires possedes. */
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
      desc: 'Force +2',
      apply: function (s, n) { s.force += 2 * n; } },

    { id: 'F-02', fam: 'TETE', name: 'Carbure', rar: 0, max: 99,
      desc: 'Force +15 %',
      apply: function (s, n) { s.force *= Math.pow(1.15, n); } },

    { id: 'F-05', fam: 'TETE', name: 'Brise-roche', rar: 1, max: 3,
      desc: '15 % de chance de detruire un bloc d\'un seul coup',
      apply: function (s, n) { s.crit = (s.crit || 0) + 0.15 * n; } },

    { id: 'Z-01', fam: 'ZONE', name: 'Tunnelier', rar: 0, max: 4,
      desc: 'Largeur +1, vitesse -10 %',
      apply: function (s, n) { s.width += n; s.speed *= Math.pow(0.9, n); } },

    { id: 'Z-03', fam: 'ZONE', name: 'Elargisseur', rar: 1, max: 4,
      desc: 'Largeur de taille +1 (max 6)',
      apply: function (s, n) { s.width += n; } },

    { id: 'Z-04', fam: 'ZONE', name: 'Perforateur', rar: 1, max: 3,
      desc: 'Longueur de taille +1 (max 4)',
      apply: function (s, n) { s.length += n; } },

    { id: 'P-01', fam: 'PILOTAGE', name: 'Chenilles crantees', rar: 0, max: 4,
      desc: 'Deplacement dans les galeries x1,5',
      apply: function (s, n) { s.roll *= Math.pow(1.5, n); s.climb *= Math.pow(1.4, n); } },

    { id: 'P-06', fam: 'PILOTAGE', name: 'Gyroscope', rar: 1, max: 1,
      desc: 'La tete pivote instantanement',
      apply: function (s) { s.rot = 0.02; } },

    { id: 'P-07', fam: 'PILOTAGE', name: 'Turbocompresseur', rar: 1, max: 2,
      desc: 'Recharge du turbo divisee par deux',
      apply: function (s, n) { s.turboCd *= Math.pow(0.5, n); } },

    { id: 'O-01', fam: 'BUTIN', name: 'Aimant permanent', rar: 0, max: 4,
      desc: 'Rayon de ramassage +4',
      apply: function (s, n) { s.magnet += 4 * n; } },

    { id: 'O-02', fam: 'BUTIN', name: 'Cupidite', rar: 0, max: 3,
      desc: 'Valeur du minerai +40 %, vitesse -10 %',
      apply: function (s, n) { s.value *= Math.pow(1.4, n); s.speed *= Math.pow(0.9, n); } },

    { id: 'C-01', fam: 'CHANCE', name: 'Flair', rar: 0, max: 4,
      desc: '+25 % de bonus generes dans les niveaux suivants',
      apply: function (s, n) { s.luck *= Math.pow(1.25, n); } },

    { id: 'P-09', fam: 'PILOTAGE', name: 'Foreuse gravitationnelle', rar: 2, max: 1,
      desc: 'En chute, on fore vers le bas a pleine vitesse sans ralentir',
      flag: 'gravDrill', apply: function () {} }
  ];

  var PASSIVE_BY_ID = {};
  PASSIVES.forEach(function (p) { PASSIVE_BY_ID[p.id] = p; });

  /* --------------------------------------------------------- PIECES (shop) */
  var PARTS = [
    { id: 'tete', name: 'Tete de forage', desc: 'Force +2,5', cost: 190, growth: 1.7, max: 10,
      apply: function (s, n) { s.force += 2.5 * n; } },
    { id: 'moteur', name: 'Moteur', desc: 'Vitesse +0,35', cost: 190, growth: 1.7, max: 10,
      apply: function (s, n) { s.speed += 0.35 * n; } },
    { id: 'elargisseur', name: 'Elargisseur', desc: 'Largeur +1', cost: 700, growth: 2.3, max: 4,
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
      apply: function (s) { s.luck *= 1.5; } }
  ];

  /* --------------------------------------------------------------- TIRAGE */
  // Poids de rarete, glissant avec la profondeur (couche 1 -> 6).
  function rarityWeights(layerId) {
    var t = Math.min(1, (layerId - 1) / 5);
    return [60 - 25 * t, 30 + 10 * t, 9 + 11 * t];
  }

  function draw(rng, owned, layerId, count) {
    var w = rarityWeights(layerId);
    var pool = PASSIVES.filter(function (p) {
      return (owned[p.id] || 0) < p.max;
    });
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
    PASSIVES: PASSIVES, PASSIVE_BY_ID: PASSIVE_BY_ID,
    PARTS: PARTS, JOBS: JOBS,
    draw: draw, rollBonus: rollBonus,
    RAR_NAME: ['commun', 'rare', 'legendaire'],
    partCost: function (part, owned) {
      return Math.round(part.cost * Math.pow(part.growth, owned));
    }
  };
})(window.CORE);
