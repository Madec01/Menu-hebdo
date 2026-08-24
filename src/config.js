/* CORE — constantes de gameplay.
   Tout ce qui s'equilibre est ici. Voir docs/game-design-minage.md. */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';

  var CFG = {
    TILE: 22,              // px par bloc
    LEVEL_W: 60,           // largeur du puits, en blocs
    DRILL_W: 2,            // la foreuse fait 2x2
    DRILL_H: 2,
    GRAVITY: 46,           // blocs/s^2
    TERMINAL: 30,          // vitesse de chute max
    UP_PENALTY: 0.5,       // forer vers le haut coute le double
    SURFACE_ROWS: 4,       // ciel au depart d'un niveau
    BEDROCK_ROWS: 3,       // socle en bas
    PICKUP_MAGNET_BASE: 1.6,

    // Stats de depart de la foreuse
    BASE: {
      force: 2,
      speed: 3.0,          // coups par seconde
      width: 2,            // largeur de taille (blocs)
      length: 1,           // profondeur mordue par coup
      roll: 9,             // deplacement dans les galeries (blocs/s)
      climb: 5.5,          // remontee (blocs/s)
      rot: 0.20,           // temps de pivot de la tete (s)
      elanMax: 0.5,        // plafond du bonus d'elan
      elanRise: 3.0,       // secondes pour atteindre le plafond
      elanLoss: 0.5,       // part d'elan perdue en changeant de direction
      turboDur: 2.0,
      turboCd: 15.0,
      turboMult: 2.0,
      magnet: 1.6,
      vision: 13,
      luck: 1.0,
      value: 1.0
    }
  };

  // durete(p) = 1 + 100 * (p / 4000)^2
  CFG.hardnessAt = function (depth) {
    var r = depth / 4000;
    return 1 + 100 * r * r;
  };

  // Les couches. MVP : les deux premieres.
  CFG.LAYERS = [
    {
      id: 1, name: 'LA TERRE', from: 0, to: 650,
      bg: '#20150f', fog: '#2c1d13', dark: 0.0,
      soft: '#6b4a2f', med: '#82603c', hard: '#77736c',
      ore: '#d68b3f', oreName: 'cuivre', oreValue: 19,
      wSoft: 0.62, wMed: 0.28, wHard: 0.10,
      veins: 13, caves: 4, bonuses: 13, traps: 3
    },
    {
      id: 2, name: 'LES SEDIMENTS', from: 650, to: 1300,
      bg: '#171a1d', fog: '#232a2f', dark: 0.18,
      soft: '#8a8175', med: '#666158', hard: '#9ba3ab',
      ore: '#e0b23c', oreName: 'fer', oreValue: 33,
      wSoft: 0.50, wMed: 0.33, wHard: 0.17,
      veins: 15, caves: 5, bonuses: 15, traps: 5
    }
  ];

  CFG.layerAt = function (depth) {
    for (var i = 0; i < CFG.LAYERS.length; i++) {
      if (depth < CFG.LAYERS[i].to) return CFG.LAYERS[i];
    }
    return CFG.LAYERS[CFG.LAYERS.length - 1];
  };

  // Les 6 niveaux du MVP. or/argent/bronze = objectifs de temps en secondes.
  CFG.LEVELS = [
    { id: '1-1', layer: 1, name: 'Premiere coupe',  type: 'descente', top: 0,    height: 200, gold: 28, silver: 40, bronze: 56 },
    { id: '1-2', layer: 1, name: 'Le gisement',     type: 'gisement', top: 200,  height: 200, quota: 12, gold: 42, silver: 58, bronze: 82 },
    { id: '1-3', layer: 1, name: 'Le Sceau d\'argile', type: 'sceau', top: 400,  height: 250, sealHard: 6,  gold: 35, silver: 49, bronze: 69 },
    { id: '2-1', layer: 2, name: 'Bancs de gres',   type: 'descente', top: 650,  height: 200, gold: 29, silver: 41, bronze: 57 },
    { id: '2-2', layer: 2, name: 'Veines de fer',   type: 'gisement', top: 850,  height: 200, quota: 18, gold: 52, silver: 74, bronze: 104 },
    { id: '2-3', layer: 2, name: 'Le Sceau calcaire', type: 'sceau',  top: 1050, height: 250, sealHard: 16, gold: 36, silver: 52, bronze: 73 }
  ];

  CORE.CFG = CFG;
})(window.CORE);
