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

    // --- integrite : 3 coups, puis le NIVEAU redemarre (jamais la partie) --
    HP: 3,
    IFRAMES: 1.3,          // secondes d'invulnerabilite apres un coup

    // --- la Faille : le chrono a enfin un visage ---------------------------
    FAILLE: {
      delay: 15,           // secondes avant qu'elle ne demarre
      speed: 2.0,          // lignes par seconde au depart
      accel: 0.06,         // acceleration, en lignes/s^2
      sealBoost: 2.2,      // acceleration brutale une fois le Sceau perce
      catchPush: 6,        // de combien elle enfonce la foreuse quand elle rattrape
      warn: 14             // distance a laquelle l'ecran commence a alerter
    },

    // --- roche qui s'effondre ----------------------------------------------
    FALL: {
      shake: 0.4,          // duree du tremblement d'avertissement
      minSpan: 4,          // largeur de vide a partir de laquelle la voute cede
      minMass: 5,          // en dessous, ce n'est pas un effondrement, c'est un caillou
      maxMass: 150,        // au-dela, la masse est consideree comme portante
      speed: 26,           // vitesse de chute d'une masse, en blocs/s
      damage: 1            // integrite perdue si elle nous tombe dessus
    },

    // --- turbo : il ne se recharge qu'en jouant bien ------------------------
    TURBO: {
      ore: 0.14,           // par bloc de minerai perce
      bonus: 0.30,         // par bonus ramasse
      block: 0.010,        // par bloc casse pendant un combo
      collapse: 0.05       // par masse effondree
    },

    // --- carburant : il brule a l'action, jamais au temps ------------------
    FUEL: {
      burnPerBlock: 0.20,  // L par bloc reellement excave
      burnTurbo: 3,        // le turbo triple la consommation
      burnUp: 1.5,         // forer vers le haut consomme plus
      burnRoll: 0.05,      // L/s en roulant dans une galerie
      bidon: 32,           // L rendus par un bidon
      emergency: 50,       // litres du bidon d'urgence, en pleine panne
      emergencyPrice: 150, // il se paie plus cher qu'a la station
      alertAt: 20,         // seuil du filet de securite et de l'alarme
      rescueRadius: 20,    // sous le seuil, un bidon est garanti dans ce rayon
      freeTop: 35,         // ration de secours offerte au depart d'un niveau
      canSize: 40,         // litres par bidon achete a la station
      canPrice: 110        // prix du bidon
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
      id: 1, name: 'LA TERRE', from: 0, to: 220,
      bg: '#1a110c', fog: '#2c1d13', dark: 0.30,
      soft: '#5b3d26', med: '#6f5133', hard: '#6a675f',
      ore: '#d68b3f', oreName: 'cuivre', oreValue: 13,
      wSoft: 0.56, wMed: 0.26, wHard: 0.08,
      special: 'FRIABLE', wSpecial: 0.10,   // s'effondre en cascade
      veins: 8, caves: 3, bonuses: 8, traps: 2, bidons: 5, coffres: 2
    },
    {
      id: 2, name: 'LES SEDIMENTS', from: 220, to: 880,
      bg: '#12151a', fog: '#232a2f', dark: 0.55,
      soft: '#6f685e', med: '#4f4b45', hard: '#828a91',
      ore: '#e0b23c', oreName: 'fer', oreValue: 22,
      wSoft: 0.44, wMed: 0.30, wHard: 0.14,
      special: 'CHARBON', wSpecial: 0.12,   // explose et enflamme ses voisines
      veins: 9, caves: 4, bonuses: 9, traps: 3, bidons: 6, coffres: 2
    },
    {
      id: 3, name: 'LES GROTTES DE CRISTAL', from: 880, to: 1600,
      bg: '#0e0a18', fog: '#241b3a', dark: 0.68,
      soft: '#584a85', med: '#3b3160', hard: '#7787bb',
      ore: '#c8e6ff', oreName: 'argent', oreValue: 38,
      wSoft: 0.38, wMed: 0.28, wHard: 0.16,
      special: 'CRISTAL', wSpecial: 0.18,   // reaction en chaine, et ca paye
      veins: 10, caves: 4, bonuses: 10, traps: 4, bidons: 7, coffres: 3
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
  /* 14 niveaux courts. Une nouveaute par niveau, jamais de remplissage.
     faille : multiplicateur de vitesse de la Faille pour ce niveau. */
  CFG.LEVELS = [
    { id: '1-1', layer: 1, name: 'Premiere coupe',   type: 'descente',     top: 0,    height: 100, gold: 22, silver: 32, bronze: 46, faille: 0.75 },
    { id: '1-2', layer: 1, name: 'La croute',        type: 'sceau',        top: 100,  height: 120, sealHard: 5, gold: 25, silver: 36, bronze: 52, faille: 0.85 },

    { id: '2-1', layer: 2, name: 'Bancs de gres',    type: 'descente',     top: 220,  height: 110, gold: 18, silver: 26, bronze: 39, faille: 1.0 },
    { id: '2-2', layer: 2, name: 'La grande veine',  type: 'filon',        top: 330,  height: 110, gold: 21, silver: 30, bronze: 44, faille: 1.0 },
    { id: '2-3', layer: 2, name: 'Le gisement',      type: 'gisement',     top: 440,  height: 110, quota: 10, gold: 20, silver: 29, bronze: 43, faille: 0.9 },
    { id: '2-4', layer: 2, name: 'Effondrement',     type: 'effondrement', top: 550,  height: 110, gold: 18, silver: 25, bronze: 37, faille: 1.35 },
    { id: '2-5', layer: 2, name: 'Le grand vide',    type: 'chute',        top: 660,  height: 110, gold: 15, silver: 21, bronze: 31, faille: 1.1 },
    { id: '2-6', layer: 2, name: 'Le Sceau calcaire', type: 'sceau',       top: 770,  height: 110, sealHard: 14, gold: 17, silver: 24, bronze: 35, faille: 1.1 },

    { id: '3-1', layer: 3, name: 'Eclats',           type: 'descente',     top: 880,  height: 115, gold: 19, silver: 27, bronze: 39, faille: 1.15 },
    { id: '3-2', layer: 3, name: 'Le dedale',        type: 'dedale',       top: 995,  height: 120, gold: 50, silver: 71, bronze: 105, faille: 0.8 },
    { id: '3-3', layer: 3, name: 'Coeur de geode',   type: 'gisement',     top: 1115, height: 120, quota: 14, gold: 18, silver: 25, bronze: 37, faille: 1.0 },
    { id: '3-4', layer: 3, name: 'La faille vive',   type: 'effondrement', top: 1235, height: 120, gold: 13, silver: 18, bronze: 27, faille: 1.5 },
    { id: '3-5', layer: 3, name: 'Le puits',         type: 'chute',        top: 1355, height: 125, gold: 11, silver: 16, bronze: 24, faille: 1.25 },
    { id: '3-6', layer: 3, name: 'Le Sceau de quartz', type: 'sceau',      top: 1480, height: 120, sealHard: 26, gold: 12, silver: 17, bronze: 25, faille: 1.3 }
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
    { id: 'noup',     label: 'Ne jamais forer vers le haut',   gold: 120, check: function (st) { return st.up === 0; } },
    { id: 'bonus3',   label: 'Ramasser 3 bonus',               gold: 100, check: function (st) { return st.bonus >= 3; } },
    { id: 'noreserve', label: 'Ne jamais passer en reserve',   gold: 90, check: function (st) { return st.reserve === 0; } },
    { id: 'fuel50',   label: 'Finir avec plus de 50 L',        gold: 110, check: function (st) { return st.fuelEnd > 50; } },
    { id: 'straight', label: '25 blocs sans changer de sens',  gold: 110, check: function (st) { return st.straight >= 25; } },
    { id: 'ore10',    label: 'Ramasser 10 minerais',           gold: 85, check: function (st) { return st.ore >= 10; } },
    { id: 'fall30',   label: 'Chuter de 30 blocs d\'un coup',  gold: 100, check: function (st) { return st.bigFall >= 30; } }
  ];

  /* ------------------------------------------------------------- CARNET */
  /* Ce qui se debloque d'une expedition a l'autre. C'est la seule chose qui
     donne une raison de relancer : on voit toujours ce qui est a une partie. */
  CFG.UNLOCKS = [
    { id: 'pactes',    nom: 'Les pactes',              stat: 'runs',      but: 3,
      desc: 'Des cartes noires : gros gain, vrai prix' },
    { id: 'sablier',   nom: 'Le Sablier fele',         stat: 'bonuses',   but: 20,
      desc: 'Un bonus qui fige le chrono' },
    { id: 'elargisseur', nom: 'Elargisseur',           stat: 'ore',       but: 260,
      desc: 'Une piece de boutique : largeur de taille +1' },
    { id: 'camionneur', nom: 'Metier : Le Camionneur', stat: 'cans',      but: 15,
      desc: 'Reservoir +60 L, consommation -20 %' },
    { id: 'recuperateur', nom: 'Passif : Recuperateur', stat: 'cans',     but: 30,
      desc: 'Chaque chute de 10 m rend du carburant' },
    { id: 'cassecou',  nom: 'Passif : Casse-cou',      stat: 'buried',    but: 8,
      desc: '+40 % de vitesse quand la Faille est proche' },
    { id: 'gravitationnelle', nom: 'Passif : Foreuse gravitationnelle', stat: 'collapses', but: 220,
      desc: 'En chute, on fore a pleine vitesse' },
    { id: 'instable',  nom: 'Passif : Noyau instable', stat: 'collapses', but: 700,
      desc: 'Une explosion creuse tous les 60 m' },
    { id: 'perpetuel', nom: 'Passif : Perpetuel',      stat: 'medOr',     but: 14,
      desc: 'L\'elan ne retombe jamais' },
    { id: 'tunnelier', nom: 'Metier : Le Tunnelier',   stat: 'bestLayer', but: 2,
      desc: 'Largeur 4 d\'entree de jeu, vitesse -25 %' },
    { id: 'parieur',   nom: 'Metier : Le Parieur',     stat: 'bestLayer', but: 3,
      desc: 'Demarre une couche plus bas' },
    { id: 'stellaire', nom: 'Piece : Tete stellaire',  stat: 'bestDepth', but: 1300,
      desc: 'La meilleure tete de forage de la boutique' },
    { id: 'graine',    nom: 'Mode : Graine du jour',   stat: 'finished',  but: 1,
      desc: 'Tout le monde creuse la meme planete' },
    { id: 'profondeur2', nom: 'PROFONDEUR II',         stat: 'finished',  but: 1,
      desc: 'Roche plus dure, Faille plus rapide — et une carte de plus a chaque station' },
    { id: 'ascete',    nom: 'Metier : L\'Ascete',      stat: 'cleanRuns', but: 1,
      desc: 'Aucun bonus ne t\'affecte, mais +1 carte a chaque choix' },
    { id: 'profondeur3', nom: 'PROFONDEUR III',        stat: 'deepWins',  but: 1,
      desc: 'Le vrai test : deux points d\'integrite seulement' }
  ];

  /* Modificateurs des paliers de difficulte. */
  CFG.DEPTHS = [
    { id: 0, nom: 'PROFONDEUR I',   hard: 1,    faille: 1,    cards: 3, hp: 0 },
    { id: 1, nom: 'PROFONDEUR II',  hard: 1.3,  faille: 1.25, cards: 4, hp: 0 },
    { id: 2, nom: 'PROFONDEUR III', hard: 1.55, faille: 1.45, cards: 4, hp: -1 }
  ];

  CORE.CFG = CFG;
})(window.CORE);
