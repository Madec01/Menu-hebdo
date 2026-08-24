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

    // --- carburant : il brule a l'action, jamais au temps ------------------
    FUEL: {
      burnPerBlock: 0.20,  // L par bloc reellement excave
      burnTurbo: 3,        // le turbo triple la consommation
      burnUp: 1.5,         // forer vers le haut consomme plus
      burnRoll: 0.05,      // L/s en roulant dans une galerie
      bidon: 32,           // L rendus par un bidon
      reserveSpeed: 1 / 3, // vitesse en panne seche
      alertAt: 20,         // seuil du filet de securite et de l'alarme
      rescueRadius: 20     // sous le seuil, un bidon est garanti dans ce rayon
    },

    // Stats de depart de la foreuse
    BASE: {
      force: 2,
      speed: 3.0,          // coups par seconde
      width: 2,            // largeur de taille (blocs)
      length: 1,           // profondeur mordue par coup
      roll: 9,             // deplacement dans les galeries (blocs/s)
      climb: 5.5,          // remontee (blocs/s)
      rot: 0.20,           // temps de pivot de la tete (s)
      elanMax: 0.5,
      elanRise: 3.0,
      elanLoss: 0.5,
      turboDur: 2.0,
      turboCd: 15.0,
      turboMult: 2.0,
      magnet: 1.6,
      vision: 13,
      luck: 1.0,
      value: 1.0,
      fuelMax: 120,
      burn: 1.0            // multiplicateur de consommation
    }
  };

  // durete(p) = 1 + 100 * (p / 4000)^2
  CFG.hardnessAt = function (depth) {
    var r = depth / 4000;
    return 1 + 100 * r * r;
  };

  /* ------------------------------------------------------------- COUCHES */
  CFG.LAYERS = [
    {
      id: 1, name: 'LA TERRE', from: 0, to: 650,
      bg: '#20150f', fog: '#2c1d13', dark: 0.0,
      soft: '#6b4a2f', med: '#82603c', hard: '#77736c',
      ore: '#d68b3f', oreName: 'cuivre', oreValue: 19,
      wSoft: 0.56, wMed: 0.26, wHard: 0.08,
      special: 'FRIABLE', wSpecial: 0.10,   // s'effondre en cascade
      veins: 13, caves: 4, bonuses: 13, traps: 3, bidons: 8, coffres: 3
    },
    {
      id: 2, name: 'LES SEDIMENTS', from: 650, to: 1300,
      bg: '#171a1d', fog: '#232a2f', dark: 0.18,
      soft: '#8a8175', med: '#666158', hard: '#9ba3ab',
      ore: '#e0b23c', oreName: 'fer', oreValue: 33,
      wSoft: 0.44, wMed: 0.30, wHard: 0.14,
      special: 'CHARBON', wSpecial: 0.12,   // explose et enflamme ses voisines
      veins: 15, caves: 5, bonuses: 15, traps: 5, bidons: 9, coffres: 3
    },
    {
      id: 3, name: 'LES GROTTES DE CRISTAL', from: 1300, to: 1950,
      bg: '#14101f', fog: '#241b3a', dark: 0.34,
      soft: '#6d5aa0', med: '#4c3f78', hard: '#8fa0d8',
      ore: '#c8e6ff', oreName: 'argent', oreValue: 58,
      wSoft: 0.38, wMed: 0.28, wHard: 0.16,
      special: 'CRISTAL', wSpecial: 0.18,   // reaction en chaine, et ca paye
      veins: 16, caves: 7, bonuses: 16, traps: 6, bidons: 10, coffres: 4
    }
  ];

  CFG.layerAt = function (depth) {
    for (var i = 0; i < CFG.LAYERS.length; i++) {
      if (depth < CFG.LAYERS[i].to) return CFG.LAYERS[i];
    }
    return CFG.LAYERS[CFG.LAYERS.length - 1];
  };

  /* -------------------------------------------------------------- NIVEAUX */
  /* 3 couches x 3 niveaux. Les 7 variantes du game design sont couvertes. */
  CFG.LEVELS = [
    { id: '1-1', layer: 1, name: 'Premiere coupe',    type: 'descente',     top: 0,    height: 200, gold: 27, silver: 39, bronze: 55 },
    { id: '1-2', layer: 1, name: 'Le gisement',       type: 'gisement',     top: 200,  height: 200, quota: 8, gold: 35, silver: 49, bronze: 70 },
    { id: '1-3', layer: 1, name: 'Le Sceau d\'argile', type: 'sceau',       top: 400,  height: 250, sealHard: 6,  gold: 32, silver: 45, bronze: 64 },
    { id: '2-1', layer: 2, name: 'La grande veine',   type: 'filon',        top: 650,  height: 200, gold: 24, silver: 34, bronze: 49 },
    { id: '2-2', layer: 2, name: 'Effondrement',      type: 'effondrement', top: 850,  height: 200, ceiling: 3.4, gold: 22, silver: 31, bronze: 44 },
    { id: '2-3', layer: 2, name: 'Le Sceau calcaire', type: 'sceau',        top: 1050, height: 250, sealHard: 16, gold: 26, silver: 37, bronze: 53 },
    { id: '3-1', layer: 3, name: 'Le grand vide',     type: 'chute',        top: 1300, height: 200, gold: 12, silver: 17, bronze: 24 },
    { id: '3-2', layer: 3, name: 'Le dedale',         type: 'dedale',       top: 1500, height: 200, gold: 64, silver: 91, bronze: 130 },
    { id: '3-3', layer: 3, name: 'Le Sceau de quartz', type: 'sceau',       top: 1700, height: 250, sealHard: 30, gold: 24, silver: 33, bronze: 48 }
  ];

  /* ---------------------------------------------------- EVENEMENTS DE COUCHE */
  CFG.EVENTS = [
    { id: 'grisou',   name: 'COUP DE GRISOU',  desc: 'la roche explose',            dur: 10, color: '#ff6a3d', minLayer: 1 },
    { id: 'ruee',     name: 'RUEE',            desc: 'minerai a double valeur',     dur: 16, color: '#ffd24a', minLayer: 1 },
    { id: 'secousse', name: 'SECOUSSE',        desc: 'la couche se fissure',        dur: 12, color: '#7ec8ff', minLayer: 1 },
    { id: 'eboulement', name: 'EBOULEMENT',    desc: 'le plafond se referme',       dur: 14, color: '#c0554a', minLayer: 1 },
    { id: 'vapeurs',  name: 'VAPEURS',         desc: 'consommation doublee',        dur: 12, color: '#9be08a', minLayer: 2 },
    { id: 'filonrev', name: 'FILON REVELE',    desc: 'un filon-mere apparait',      dur: 20, color: '#ffb03d', minLayer: 1 },
    { id: 'coupure',  name: 'COUPURE',         desc: 'les phares s\'eteignent',     dur: 10, color: '#5f6673', minLayer: 2 }
  ];
  CFG.EVENT_FIRST = 12;     // pas d'evenement avant ces secondes
  CFG.EVENT_GAP = 22;       // ecart minimum entre deux evenements

  /* ---------------------------------------------------------------- DEFIS */
  /* check(st) ou st = { up, bonus, reserve, fuelEnd, straight, falls, ore, time } */
  CFG.CHALLENGES = [
    { id: 'noup',     label: 'Ne jamais forer vers le haut',   gold: 220, check: function (st) { return st.up === 0; } },
    { id: 'bonus3',   label: 'Ramasser 3 bonus',               gold: 180, check: function (st) { return st.bonus >= 3; } },
    { id: 'noreserve', label: 'Ne jamais passer en reserve',   gold: 160, check: function (st) { return st.reserve === 0; } },
    { id: 'fuel50',   label: 'Finir avec plus de 50 L',        gold: 200, check: function (st) { return st.fuelEnd > 50; } },
    { id: 'straight', label: '25 blocs sans changer de sens',  gold: 200, check: function (st) { return st.straight >= 25; } },
    { id: 'ore10',    label: 'Ramasser 10 minerais',           gold: 150, check: function (st) { return st.ore >= 10; } },
    { id: 'fall30',   label: 'Chuter de 30 blocs d\'un coup',  gold: 180, check: function (st) { return st.bigFall >= 30; } }
  ];

  CORE.CFG = CFG;
})(window.CORE);
