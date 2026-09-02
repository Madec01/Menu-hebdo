'use strict';
/* Bêtes de Papier — tableaux, actes et générateurs (BP.levels).
 *
 * Voir SPEC §3. Chaque tableau porte une `solution` : une configuration qui produit la cible.
 * La cible étant toujours rendue à partir de la solution, tout tableau est atteignable à 100 %.
 *
 * Contrainte géométrique respectée partout (vérifiée par le script de contrôle) :
 * sous CHACUNE des lampes, l'ombre de chaque pièce tient dans le drap 400×300 avec 10 de marge.
 * Rappel : sous la lampe j, le centre de l'ombre est décalé de (L0 - Lj) * (k - 1) ; avec deux
 * lampes écartées de 100, une pièce à la profondeur 4 (k = 2) voit son ombre bleue décalée de 100.
 */
window.BP = window.BP || {};
(function (BP) {

  var DRAP_W = BP.DRAP_W, DRAP_H = BP.DRAP_H, MARGIN = 10;

  /* =================================================================================
   * 1. Fabriques
   * ================================================================================= */

  /** Lampe unique, ambre, au centre. */
  function warmLamps() { return [{ x: 200, y: 150, tint: 'warm' }]; }
  /** Deux lampes de couleur : cuivre rouge à gauche, verre bleu à droite. */
  function twoLamps() {
    return [{ x: 150, y: 150, tint: 'red' }, { x: 250, y: 150, tint: 'blue' }];
  }

  /** Pièce : p(forme, sx, sy, { d:profondeur, r:rotation, t:basculement, f:miroir, m:matière }). */
  function p(shape, sx, sy, o) {
    o = o || {};
    return {
      shape: shape, sx: sx, sy: sy,
      depth: o.d || 0, rot: o.r || 0, tilt: o.t || 0,
      flip: !!o.f, material: o.m || 'paper'
    };
  }

  /** Coût minimal en manipulations d'une pièce : pose, glisser, profondeurs, rotations, etc. */
  function pieceCost(pc) {
    var c = 1;                                            // pose depuis le coffre
    // (le glisser depuis le coffre dépose déjà la pièce à sa place : pas de coût supplémentaire)
    c += pc.depth;                                        // profondeur+ répétée
    var steps = (((pc.rot % 360) + 360) % 360) / 15;
    c += Math.min(steps, 24 - steps);                     // rotation dans le sens le plus court
    c += pc.tilt;                                         // le basculement cycle 0→1→2
    if (pc.flip) c += 1;
    return c;
  }

  /** Par d'un tableau : coût minimal estimé + un peu d'air. */
  function parFor(sol, slack) {
    var s = 0;
    for (var i = 0; i < sol.length; i++) s += pieceCost(sol[i]);
    return Math.round(s) + (slack == null ? 2 : slack);
  }

  /** Par d'une représentation : la pose de départ, puis deux manipulations par changement. */
  function parForBeats(beats, slack) {
    var s = parFor(beats[0].solution, 0), i, j;
    for (i = 1; i < beats.length; i++) {
      var prev = beats[i - 1].solution, cur = beats[i].solution, changed = 0;
      var n = Math.max(prev.length, cur.length);
      for (j = 0; j < n; j++) {
        var a = prev[j], b = cur[j];
        if (!a || !b || a.shape !== b.shape || a.sx !== b.sx || a.sy !== b.sy ||
          a.depth !== b.depth || a.rot !== b.rot || a.tilt !== b.tilt ||
          a.flip !== b.flip || a.material !== b.material) changed++;
      }
      s += changed * 2;
    }
    return s + (slack == null ? 3 : slack);
  }

  /** Étiquette de coffre d'une pièce ('leaf' ou 'leaf:oiled'). */
  function tag(pc) { return pc.material === 'oiled' ? pc.shape + ':oiled' : pc.shape; }

  /** Coffre = pièces de la solution + leurres, mélangé de façon déterministe
   *  (l'ordre ne doit rien révéler de la solution). */
  function makeCoffre(id, sols, leurres) {
    var i, k;
    // Doublons requis : on garde le maximum de chaque étiquette sur l'ensemble des beats.
    var need = {};
    for (i = 0; i < sols.length; i++) {
      var count = {};
      for (k = 0; k < sols[i].length; k++) { var t = tag(sols[i][k]); count[t] = (count[t] || 0) + 1; }
      Object.keys(count).forEach(function (t) { need[t] = Math.max(need[t] || 0, count[t]); });
    }
    var out = [];
    Object.keys(need).forEach(function (t) { for (var q = 0; q < need[t]; q++) out.push(t); });
    out = out.concat(leurres || []);
    // On mélange jusqu'à ce que la tête du coffre ne recopie plus l'ordre de la solution.
    var head = sols[0].map(tag).join('|'), mixed = out, attempt = 0;
    do {
      mixed = BP.rng('coffre-' + id + (attempt ? '-' + attempt : '')).shuffle(out);
      attempt++;
    } while (attempt < 6 && mixed.slice(0, sols[0].length).join('|') === head);
    return mixed;
  }

  /* =================================================================================
   * 2. Acte I — Les foires (une lampe ambre)
   * ================================================================================= */

  var A1 = [];

  A1.push({
    id: 'a1t01', title: 'La Lune sur l\'Eau',
    intro: 'Tibor pose la lampe, tend le drap et me laisse le coffre.\n' +
      'Une découpe, dit-il. Une seule. Pose-la où l\'ombre doit tomber.',
    outro: 'La lune s\'est levée sans que personne n\'y pense. C\'est cela, bien faire.',
    hint: 'Prends la découpe dans le coffre et fais-la glisser jusqu\'à la marque pâle de la cible.',
    lamps: warmLamps(), readings: ['main'], unlocks: ['move', 'target'],
    solution: [
      p('disc', 232, 112),
      p('wave', 180, 216)
    ],
    leurres: ['tri', 'square']
  });

  A1.push({
    id: 'a1t02', title: 'L\'Œuf dans le Plat',
    intro: 'Approche la découpe de la flamme : l\'ombre enfle. Éloigne-la : elle se resserre.\n' +
      'Un œuf énorme dans un petit plat, voilà le début de tous les contes.',
    outro: 'Tibor rit. « Le public ne compte pas les centimètres. Il compte les surprises. »',
    hint: 'L\'œuf doit être grand : rapproche-le de la lampe. Le plat reste au fond, contre le drap.',
    lamps: warmLamps(), readings: ['main'], unlocks: ['depth'],
    solution: [
      p('egg', 200, 132, { d: 4 }),
      p('pan', 200, 220, { d: 3 })
    ],
    leurres: ['disc', 'bar']
  });

  A1.push({
    id: 'a1t03', title: 'Le Lièvre',
    intro: 'Le premier animal qu\'on apprend, c\'est le lièvre : un corps, deux oreilles,\n' +
      'et l\'art de les incliner juste assez pour qu\'il ait l\'air d\'écouter.',
    outro: 'Un enfant a crié son nom avant que Tibor ne le prononce. Bon signe.',
    hint: 'Les oreilles ne sont pas droites : fais-les pivoter de quinze degrés vers l\'extérieur.',
    lamps: warmLamps(), readings: ['main'], unlocks: ['rotate'],
    solution: [
      p('egg', 200, 180, { d: 2 }),
      p('ear', 172, 112, { d: 2, r: 345 }),
      p('ear', 228, 112, { d: 2, r: 15 })
    ],
    leurres: ['leaf', 'disc']
  });

  A1.push({
    id: 'a1t04', title: 'La Grue',
    intro: 'Deux ailes, et l\'une est le reflet de l\'autre. Le coffre ne contient jamais\n' +
      'la paire : il contient la moitié, et le miroir.',
    outro: 'Iva a tenu une note pendant tout le vol. Le drap respirait.',
    hint: 'Pose la même aile deux fois : la seconde, retourne-la en miroir.',
    lamps: warmLamps(), readings: ['main'], unlocks: ['flip'],
    solution: [
      p('blob', 196, 196, { d: 1 }),
      p('thin_tri', 200, 120, { d: 1 }),
      p('beak', 216, 68),
      p('wing', 256, 180, { d: 1, r: 345 }),
      p('wing', 144, 180, { d: 1, r: 15, f: true })
    ],
    leurres: ['leaf', 'disc', 'bar']
  });

  A1.push({
    id: 'a1t05', title: 'Le Chien à trois têtes',
    intro: 'Trois têtes sur un seul corps. Tibor dit qu\'il garde la porte des morts ;\n' +
      'moi je crois surtout qu\'il garde l\'attention des enfants.',
    outro: 'Trois têtes, trois hurlements — et Tibor n\'a qu\'une voix. Il s\'en sort toujours.',
    hint: 'La tête du milieu regarde droit devant. Les deux autres se penchent de trente degrés.',
    lamps: warmLamps(), readings: ['main'], unlocks: [],
    solution: [
      p('blob', 200, 212, { d: 3 }),
      p('head', 200, 116, { d: 1 }),
      p('head', 120, 152, { d: 1, r: 330, f: true }),
      p('head', 280, 152, { d: 1, r: 30 })
    ],
    leurres: ['ear', 'disc', 'tri']
  });

  A1.push({
    id: 'a1t06', title: 'Le Loup et l\'Agneau',
    intro: 'Deux bêtes sur le même drap, et tout le sens tient dans l\'écart entre elles.\n' +
      'Trop loin : deux animaux. Assez près : une menace.',
    outro: 'Personne n\'a ri. Tibor appelle ça un silence réussi.',
    hint: 'Le loup vient de la gauche, l\'agneau lui fait face : sa tête est retournée en miroir.',
    lamps: warmLamps(), readings: ['main'], unlocks: [],
    solution: [
      p('blob', 104, 196, { d: 2 }),
      p('head', 168, 144, { d: 1 }),
      p('pebble', 304, 204, { d: 1 }),
      p('head', 260, 172, { f: true }),
      p('ear', 256, 136, { r: 15 })
    ],
    leurres: ['leaf', 'bar', 'tri']
  });

  A1.push({
    id: 'a1t07', title: 'L\'Échassier',
    intro: 'Une découpe qu\'on tourne de profil ne disparaît pas : elle s\'amincit.\n' +
      'C\'est ainsi qu\'on obtient des pattes de héron avec des cailloux.',
    outro: 'Tibor : « Tu as compris le plus difficile. Une ombre n\'est pas une image, c\'est une tranche. »',
    hint: 'Bascule les deux pattes et le cou de profil : ils deviendront minces comme des roseaux.',
    lamps: warmLamps(), readings: ['main'], unlocks: ['tilt'],
    solution: [
      p('pebble', 200, 164, { d: 3 }),
      p('egg', 216, 96, { d: 1, t: 2 }),
      p('beak', 240, 72),
      p('thin_tri', 184, 228, { t: 1 }),
      p('thin_tri', 216, 228, { t: 1 })
    ],
    leurres: ['bar', 'disc', 'leaf']
  });

  A1.push({
    id: 'a1t08', title: 'Le Roi',
    intro: 'Le papier huilé ne fait pas d\'ombre noire : il fait une ombre grise.\n' +
      'Deux épaisseurs l\'une sur l\'autre, et le gris redevient noir. Tibor appelle ça mentir deux fois.',
    outro: 'À la troisième rangée, un homme en manteau gris n\'a pas applaudi. Il écrivait.',
    hint: 'Le manteau est fait de deux découpes huilées qui se chevauchent : leur croisement seul est noir.',
    lamps: warmLamps(), readings: ['main'], unlocks: ['oiled'],
    solution: [
      p('disc', 200, 124, { d: 1 }),
      p('crown', 200, 76, { d: 1, m: 'oiled' }),
      p('tri', 184, 212, { d: 3, m: 'oiled' }),
      p('tri', 216, 212, { d: 3, m: 'oiled' })
    ],
    leurres: ['square:oiled', 'bar', 'disc:oiled']
  });

  A1.push({
    id: 'a1p', title: 'La Foire de Sault', type: 'performance',
    intro: 'Représentation. Le tambour d\'Iva bat trois fois ; à chaque frappe le conte avance\n' +
      'et la silhouette doit avoir changé avant la suivante. On ne s\'arrête pas. On rattrape.',
    outro: 'Le roi est devenu âne devant deux cents personnes, et l\'homme au manteau gris\n' +
      'a refermé son carnet. Il s\'appelle Delcour. Nous partons cette nuit.',
    hint: 'Anticipe : la couronne glisse d\'abord, puis se change en deux longues oreilles.',
    lamps: warmLamps(), readings: ['main'], unlocks: ['performance'],
    // Durée des frappes : il faut au moins deux secondes pour lire la nouvelle cible, puis
    // environ deux secondes par manipulation demandée. La dernière frappe change de pièces
    // (sept manipulations) : huit secondes la rendaient injouable à la main.
    beats: [
      {
        seconds: 12, solution: [
          p('disc', 200, 124, { d: 1 }),
          p('crown', 200, 76, { d: 1, m: 'oiled' }),
          p('tri', 200, 212, { d: 3, m: 'oiled' })
        ]
      },
      {
        seconds: 10, solution: [
          p('disc', 200, 124, { d: 1 }),
          p('crown', 164, 84, { d: 1, r: 330, m: 'oiled' }),
          p('tri', 200, 212, { d: 3, m: 'oiled' })
        ]
      },
      {
        seconds: 15, solution: [
          p('disc', 200, 124, { d: 1 }),
          p('leaf', 172, 68, { d: 1, r: 345 }),
          p('leaf', 228, 68, { d: 1, r: 15 }),
          p('tri', 200, 212, { d: 3, m: 'oiled' })
        ]
      }
    ],
    leurres: ['ear', 'bar']
  });

  /* =================================================================================
   * 3. Acte II — Les villes fermées (deux lampes de couleur)
   * ================================================================================= */

  var A2 = [];

  A2.push({
    id: 'a2t01', title: 'Les Deux Lampes',
    intro: 'Une lampe de cuivre rouge à gauche, une lampe à verre bleu à droite.\n' +
      'Collée au drap, une découpe n\'a qu\'une ombre : les deux lumières la disent pareille.',
    outro: 'Le boulanger portait un monocle teinté. Il a hoché la tête, puis il est parti.',
    hint: 'Garde toutes les pièces au fond, contre le drap : les deux lectures seront identiques.',
    lamps: twoLamps(), readings: ['red', 'blue'], unlocks: ['twolamps'],
    solution: [
      p('head', 200, 144),
      p('ear', 172, 96, { r: 345 }),
      p('ear', 208, 92, { r: 15 }),
      p('blob', 148, 204)
    ],
    leurres: ['disc', 'bar']
  });

  A2.push({
    id: 'a2t02', title: 'Le Chien qui tourne la tête',
    intro: 'Approche une découpe des lampes et elle se dédouble : le rouge la jette d\'un côté,\n' +
      'le bleu de l\'autre. Deux salles, deux bêtes, un seul papier.',
    outro: 'Tibor : « Ce que tu viens de faire, aucune lettre ne le fait. »',
    hint: 'Le corps reste contre le drap. La tête, elle, doit venir tout près des lampes.',
    lamps: twoLamps(), readings: ['red', 'blue'], unlocks: [],
    solution: [
      p('blob', 200, 196),
      p('head', 272, 120, { d: 4 })
    ],
    leurres: ['ear', 'disc', 'tri']
  });

  A2.push({
    id: 'a2t03', title: 'La Chèvre et le Toit',
    intro: 'Les familles nous confient des phrases entières. Ce soir : « la chèvre est passée ».\n' +
      'Au rouge une chèvre ; au bleu, un toit et une échelle.',
    outro: 'Deux personnes ont pleuré à la même seconde, pour deux raisons différentes.',
    hint: 'Mélange les profondeurs : ce qui est au fond ne bouge pas, ce qui est devant se déplace beaucoup.',
    lamps: twoLamps(), readings: ['red', 'blue'], unlocks: [],
    solution: [
      p('pebble', 196, 192, { d: 1 }),
      p('head', 248, 140, { d: 3 }),
      p('horn', 232, 92, { d: 2, r: 30 }),
      p('long_bar', 144, 240, { d: 1 })
    ],
    leurres: ['bar', 'leaf', 'disc']
  });

  A2.push({
    id: 'a2t04', title: 'Le Coffre amputé',
    intro: 'Les gendarmes ont ouvert le coffre et retiré ce qui « représente ».\n' +
      'Il nous reste des barres, des disques, des coins. Il faudra ruser.',
    outro: 'Iva n\'est pas revenue de la place. On dit qu\'elle a joué trop fort.',
    hint: 'Avec des formes neutres, tout se joue sur l\'assemblage : un disque et deux coins font une tête.',
    lamps: twoLamps(), readings: ['red', 'blue'], unlocks: [],
    solution: [
      p('disc', 196, 128, { d: 2 }),
      p('wedge', 152, 108, { d: 1, f: true }),
      p('square', 192, 200, { d: 3 }),
      p('bar', 244, 236, { d: 1, r: 75 }),
      p('long_bar', 160, 268)
    ],
    leurres: ['pebble', 'tri', 'rod']
  });

  A2.push({
    id: 'a2t05', title: 'L\'Œil nu',
    intro: 'Delcour est assis au premier rang, sans verre teinté. Il ne voit que l\'ombre franche :\n' +
      'ce que les deux lampes noircissent ensemble. Trois lectures, désormais.',
    outro: 'Il a écrit deux mots. Je crois qu\'il a écrit « rien à signaler ».',
    hint: 'L\'œil nu ne voit que le recoupement des deux ombres : ce qui est au fond du drap.',
    lamps: twoLamps(), readings: ['red', 'blue', 'umbra'], unlocks: ['umbra'],
    solution: [
      p('blob', 200, 176, { d: 1 }),
      p('ear', 176, 108, { d: 1, r: 345 }),
      p('ear', 216, 108, { d: 1, r: 15 }),
      p('tail', 268, 216, { d: 2, r: 15 }),
      p('paw', 152, 232, { d: 1 })
    ],
    leurres: ['disc', 'bar', 'leaf']
  });

  A2.push({
    id: 'a2t06', title: 'La Cage',
    intro: 'Iva est enfermée derrière des barreaux qu\'on ne peut pas nommer.\n' +
      'On les bascule de profil : le juge verra des roseaux, elle verra sa cage.',
    outro: 'Elle a entendu le tambour de l\'extérieur. C\'est déjà une adresse.',
    hint: 'Bascule les trois barreaux de profil pour les amincir ; les deux traverses les tiennent.',
    lamps: twoLamps(), readings: ['red', 'blue', 'umbra'], unlocks: [],
    solution: [
      p('egg', 200, 172, { d: 2 }),
      p('thin_tri', 144, 168, { d: 1, t: 1 }),
      p('thin_tri', 200, 168, { d: 1, t: 1 }),
      p('thin_tri', 256, 168, { d: 1, t: 1 }),
      p('long_bar', 200, 104, { d: 1 }),
      p('long_bar', 200, 232, { d: 1 })
    ],
    leurres: ['rod', 'square', 'disc']
  });

  A2.push({
    id: 'a2t07', title: 'La Lettre grise',
    intro: 'Papier huilé et deux lampes : le gris devient une troisième encre.\n' +
      'Le rouge lit une bête, le bleu lit un chemin, l\'œil nu ne lit qu\'un nuage.',
    outro: 'Quatre familles ont su, cette nuit-là, par quelle porte sortir.',
    hint: 'Superpose deux huilées au même endroit pour obtenir du noir là où il faut être lu.',
    lamps: twoLamps(), readings: ['red', 'blue', 'umbra'], unlocks: [],
    solution: [
      p('pebble', 196, 168, { d: 1, m: 'oiled' }),
      p('pebble', 204, 176, { d: 1, m: 'oiled' }),
      p('leaf', 168, 100, { d: 2, r: 330 }),
      p('leaf', 232, 100, { d: 2, r: 30 }),
      p('wave', 200, 244, { d: 1, t: 1, m: 'oiled' })
    ],
    leurres: ['disc:oiled', 'bar', 'tri:oiled']
  });

  A2.push({
    id: 'a2p', title: 'La Halle aux Grains', type: 'performance',
    intro: 'Représentation sous deux lampes. Trois frappes de tambour, trois états.\n' +
      'La ville est fermée depuis six jours ; ce que nous montrons ce soir sera répété demain.',
    outro: 'Le lendemain, la Chancellerie nous convoque. Delcour a signé lui-même la citation.',
    hint: 'Le corps ne bouge pas : ce sont les pièces proches des lampes qui racontent l\'histoire.',
    lamps: twoLamps(), readings: ['red', 'blue'], unlocks: [],
    beats: [
      {
        seconds: 12, solution: [
          p('blob', 200, 192),
          p('head', 256, 132, { d: 3 }),
          p('ear', 236, 84, { d: 1, r: 15 })
        ]
      },
      {
        seconds: 10, solution: [
          p('blob', 200, 192),
          p('head', 256, 132, { d: 3, r: 330 }),
          p('ear', 236, 84, { d: 1, r: 345 })
        ]
      },
      {
        seconds: 12, solution: [
          p('blob', 200, 192),
          p('head', 236, 156, { d: 4, r: 330 }),
          p('wing', 172, 108, { d: 1, r: 345 })
        ]
      }
    ],
    leurres: ['disc', 'bar', 'leaf']
  });

  /* =================================================================================
   * 4. Acte III — Le procès (deux lampes, trois lectures)
   * ================================================================================= */

  var A3 = [];

  A3.push({
    id: 'a3t01', title: 'La Salle d\'Audience',
    intro: 'Le tribunal a fait tendre notre drap entre deux colonnes. Les lampes sont les leurs :\n' +
      'cuivre rouge, verre bleu. Ils ne savent pas ce que cela permet.',
    outro: 'Le greffier a noté : « spectacle d\'ombres, sans importance ».',
    hint: 'Commence par le corps, au fond ; ajoute ensuite les pièces proches des lampes.',
    lamps: twoLamps(), readings: ['red', 'blue', 'umbra'], unlocks: [],
    solution: [
      p('blob', 200, 180, { d: 1 }),
      p('head', 244, 120, { d: 2, r: 345 }),
      p('paw', 156, 232, { d: 1, r: 15 }),
      p('paw', 232, 232, { d: 1, r: 345 }),
      p('tail', 128, 176, { d: 2, r: 15, f: true })
    ],
    leurres: ['disc', 'bar', 'ear']
  });

  A3.push({
    id: 'a3t02', title: 'Le Témoin',
    intro: 'Un homme jure sur un livre qu\'il n\'a pas lu. Derrière lui, sur le drap,\n' +
      'nous montrons ce qu\'il ne dira pas.',
    outro: 'Sa voix a tremblé au moment exact où l\'ombre s\'est refermée.',
    hint: 'La main jure : elle est la plus grande, donc la plus proche des lampes.',
    lamps: twoLamps(), readings: ['red', 'blue', 'umbra'], unlocks: [],
    solution: [
      p('hand', 196, 176, { d: 3 }),
      p('head', 256, 108, { d: 1, r: 345 }),
      p('crown', 256, 48, { d: 1 }),
      p('pebble', 140, 220, { d: 1 }),
      p('bar', 200, 264, { d: 1 })
    ],
    leurres: ['leaf', 'square', 'disc', 'tri']
  });

  A3.push({
    id: 'a3t03', title: 'La Balance',
    intro: 'La justice qu\'ils dessinent a deux plateaux. Nous montrerons lequel est chargé,\n' +
      'et par qui — mais seulement à qui porte un verre.',
    outro: 'Le juge a demandé qu\'on rallume la salle. Trop tard : tout le monde avait vu.',
    hint: 'Le fléau est une longue barre horizontale ; la hampe, un barreau tourné d\'un quart de tour.',
    lamps: twoLamps(), readings: ['red', 'blue', 'umbra'], unlocks: [],
    solution: [
      p('long_bar', 200, 104, { d: 2 }),
      p('rod', 200, 184, { d: 2, r: 90 }),
      p('pan', 128, 124, { d: 1 }),
      p('pan', 272, 124, { d: 1 }),
      p('square', 272, 164, { d: 2 }),
      p('pebble', 128, 152)
    ],
    leurres: ['disc', 'bar', 'tri']
  });

  A3.push({
    id: 'a3t04', title: 'Le Loup en Robe',
    intro: 'Tibor n\'a plus de voix. C\'est moi qui nomme les bêtes, maintenant.\n' +
      'Celle-ci porte une robe de magistrat et une gueule qu\'on ne peut pas montrer.',
    outro: 'On m\'a fait taire. On n\'a pas fait taire le drap.',
    hint: 'La gueule est énorme : approche-la des lampes, tout à droite. Au bleu, elle viendra se poser sur la robe.',
    lamps: twoLamps(), readings: ['red', 'blue', 'umbra'], unlocks: [],
    solution: [
      p('tri', 200, 204, { d: 3, m: 'oiled' }),
      p('disc', 200, 116, { d: 1 }),
      p('head', 296, 128, { d: 4 }),
      p('ear', 176, 76, { d: 1, r: 330 }),
      p('ear', 224, 76, { d: 1, r: 30 }),
      p('claw', 152, 236, { d: 1, r: 30 })
    ],
    leurres: ['bar', 'leaf', 'square:oiled', 'disc:oiled']
  });

  A3.push({
    id: 'a3t05', title: 'La Clé',
    intro: 'Il ne reste qu\'une chose à faire passer : la forme exacte d\'une clé,\n' +
      'lisible seulement par celle qui est dans la cage.',
    outro: 'Iva a compris. Elle a frappé deux coups sur le mur : oui.',
    hint: 'La clé est la seule pièce proche des lampes : au rouge elle mord le corps, au bleu elle s\'en détache.',
    lamps: twoLamps(), readings: ['red', 'blue', 'umbra'], unlocks: [],
    solution: [
      p('key', 208, 176, { d: 2 }),
      p('blob', 152, 120),
      p('ear', 140, 80, { r: 345 }),
      p('ear', 168, 76, { r: 15 }),
      p('paw', 264, 232, { d: 1 }),
      p('wave', 200, 264)
    ],
    leurres: ['disc', 'bar', 'tri', 'leaf']
  });

  A3.push({
    id: 'a3p', title: 'Le Verdict', type: 'performance',
    intro: 'La scène finale. Le juge regarde à l\'œil nu, la foule aux fenêtres tient des verres rouges,\n' +
      'Iva, dans sa cage, en a un bleu. Trois lectures, trois vérités, un seul drap.\n' +
      'Trois frappes de tambour. Ensuite, le coffre changera de mains.',
    outro: 'Le rideau est tombé. Ce que chacun a vu, chacun le raconte encore.',
    hint: 'Ne déplace jamais le corps : il porte l\'ombre franche que voit le juge.',
    lamps: twoLamps(), readings: ['red', 'blue', 'umbra'], unlocks: [],
    beats: [
      {
        seconds: 12, solution: [
          p('blob', 200, 184, { d: 1 }),
          p('head', 248, 124, { d: 2, r: 345 }),
          p('crown', 244, 72, { d: 1, r: 15 }),
          p('pan', 140, 216, { d: 1 })
        ]
      },
      {
        seconds: 10, solution: [
          p('blob', 200, 184, { d: 1 }),
          p('head', 280, 132, { d: 4, r: 345 }),
          p('crown', 244, 72, { d: 1, r: 15 }),
          p('pan', 140, 216, { d: 1 })
        ]
      },
      {
        seconds: 15, solution: [
          p('blob', 200, 184, { d: 1 }),
          p('key', 268, 152, { d: 3, r: 15 }),
          p('claw', 168, 100, { d: 1, r: 330 }),
          p('pan', 140, 216, { d: 1 })
        ]
      }
    ],
    leurres: ['disc', 'bar', 'leaf', 'tri']
  });

  /* =================================================================================
   * 5. Assemblage
   * ================================================================================= */

  var ACT_TITLES = { 1: 'Les foires', 2: 'Les villes fermées', 3: 'Le procès' };

  function finish(list, act) {
    return list.map(function (lv, i) {
      lv.act = act;
      lv.index = i + 1;
      lv.type = lv.type || 'tableau';
      lv.readings = lv.readings || ['main'];
      lv.unlocks = lv.unlocks || [];
      var sols = lv.type === 'performance'
        ? lv.beats.map(function (b) { return b.solution; })
        : [lv.solution];
      if (lv.type === 'performance') lv.solution = lv.beats[0].solution.map(function (q) {
        return { shape: q.shape, sx: q.sx, sy: q.sy, depth: q.depth, rot: q.rot, tilt: q.tilt, flip: q.flip, material: q.material };
      });
      lv.coffre = lv.coffre || makeCoffre(lv.id, sols, lv.leurres);
      if (lv.par == null) lv.par = lv.type === 'performance' ? parForBeats(lv.beats) : parFor(lv.solution);
      delete lv.leurres;
      return lv;
    });
  }

  var acts = [
    { act: 1, title: ACT_TITLES[1], levels: finish(A1, 1) },
    { act: 2, title: ACT_TITLES[2], levels: finish(A2, 2) },
    { act: 3, title: ACT_TITLES[3], levels: finish(A3, 3) }
  ];

  var all = [];
  acts.forEach(function (a) { all = all.concat(a.levels); });
  var index = {};
  all.forEach(function (lv) { index[lv.id] = lv; });

  /* =================================================================================
   * 6. Générateurs (improvisation, tournée)
   * ================================================================================= */

  /** Rectangle englobant de l'ombre d'une pièce sous la lampe j. */
  function projBounds(piece, lamps, j) {
    var sh = BP.shapes.get(piece.shape);
    if (!sh) return null;
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (var a = 0; a < sh.polys.length; a++) {
      var poly = sh.polys[a];
      for (var b = 0; b < poly.length; b++) {
        var q = BP.projectPoint(poly[b][0], poly[b][1], piece, lamps, j);
        if (q.x < minx) minx = q.x;
        if (q.x > maxx) maxx = q.x;
        if (q.y < miny) miny = q.y;
        if (q.y > maxy) maxy = q.y;
      }
    }
    return { minx: minx, miny: miny, maxx: maxx, maxy: maxy };
  }

  /** Vrai si l'ombre de la pièce tient dans le drap (marge 10) sous TOUTES les lampes. */
  function fits(piece, lamps) {
    for (var j = 0; j < lamps.length; j++) {
      var b = projBounds(piece, lamps, j);
      if (!b) return false;
      if (b.minx < MARGIN || b.miny < MARGIN) return false;
      if (b.maxx > DRAP_W - MARGIN || b.maxy > DRAP_H - MARGIN) return false;
    }
    return true;
  }
  var POOL_FIGURE = ['head', 'ear', 'paw', 'wing', 'tail', 'beak', 'crown', 'hand', 'horn', 'claw',
    'leaf', 'drop', 'crescent', 'blade', 'hook', 'heart_leaf', 'fan', 'key', 'bone', 'egg',
    'tooth', 'pebble', 'blob', 'star', 'wave', 'comb', 'arc'];
  var POOL_NEUTRE = ['disc', 'ring', 'square', 'bar', 'long_bar', 'rod', 'wedge', 'tri',
    'thin_tri', 'cross', 'pebble', 'egg', 'arc', 'blob'];

  var NOMS = ['sept pattes', 'la longue oreille', 'deux gueules', 'la crête de papier',
    'l\'aile cassée', 'la queue de fumée', 'la corne unique', 'la main ouverte',
    'la couronne renversée', 'trois yeux', 'la lune dans le ventre', 'la griffe patiente',
    'l\'échine courbe', 'la dent de lait', 'le bec fermé', 'la plume de suie'];

  // Rotations tirées au sort : jamais plus de quatre crans, pour que le par reste jouable.
  var ROTS = [0, 0, 0, 15, 345, 30, 330, 45, 315, 60, 300];

  /** Tire une pièce au hasard qui tient dans le drap ; null après trop d'essais. */
  function randomPiece(r, pool, lamps, maxDepth, allowTilt) {
    for (var attempt = 0; attempt < 60; attempt++) {
      var piece = p(r.pick(pool), 0, 0, {
        d: r.int(0, maxDepth),
        r: r.pick(ROTS),
        t: allowTilt ? (r() < 0.22 ? r.int(1, 2) : 0) : 0,
        f: r() < 0.35
      });
      // Position tirée autour du centre du drap (deux tirages moyennés = compositions groupées).
      piece.sx = BP.clamp(Math.round((200 + (r() + r() - 1) * 95) / 4), 14, 86) * 4;
      piece.sy = BP.clamp(Math.round((150 + (r() + r() - 1) * 72) / 4), 10, 65) * 4;
      if (fits(piece, lamps)) return piece;
      // Deuxième chance : on aplatit la profondeur avant d'abandonner ce tirage.
      while (piece.depth > 0) {
        piece.depth--;
        if (fits(piece, lamps)) return piece;
      }
    }
    return null;
  }

  /** Composition aléatoire déterministe. */
  function generate(seedKey, opts) {
    var r = BP.rng(seedKey);
    var lamps = opts.lamps;
    var sol = [], guard = 0;
    while (sol.length < opts.count && guard++ < 400) {
      var piece = randomPiece(r, opts.pool, lamps, opts.maxDepth, opts.allowTilt);
      if (piece) sol.push(piece);
    }
    if (!sol.length) sol.push(p('disc', 200, 150));
    var leurres = [];
    for (var i = 0; i < opts.leurres; i++) leurres.push(r.pick(opts.pool));
    return { solution: sol, leurres: leurres };
  }

  /** Improvisation du jour : graine libre (l'UI passe AAAAMMJJ).
   *  Le par est le coût minimal réel de la composition (au moins deux manipulations par pièce,
   *  plus les crans de profondeur et de rotation), augmenté d'une manipulation d'aisance. */
  function makeImprov(seed) {
    var key = 'improv-' + seed;
    var r = BP.rng(key + '-meta');
    var count = r.int(3, 5);
    var g = generate(key, {
      lamps: warmLamps(), pool: POOL_FIGURE, count: count,
      maxDepth: 3, allowTilt: true, leurres: r.int(1, 3)
    });
    var lv = {
      id: 'improv-' + seed, act: 0, index: 0, type: 'tableau',
      title: 'Improvisation : la bête à ' + r.pick(NOMS),
      intro: 'Personne ne l\'a jamais nommée. Trouve-lui une ombre avant que le tambour ne s\'arrête.',
      outro: 'Une bête de plus au répertoire.',
      hint: 'Regarde la cible en fantôme : les pièces les plus grandes sont les plus proches de la lampe.',
      lamps: warmLamps(), readings: ['main'], unlocks: [],
      solution: g.solution,
      coffre: makeCoffre(key, [g.solution], g.leurres),
      par: parFor(g.solution, 1)
    };
    return lv;
  }

  /** Étape de tournée : difficulté croissante, coffre qui s'appauvrit. */
  function makeTournee(seed, stage) {
    stage = Math.max(1, stage | 0);
    var key = 'tour-' + seed + '-' + stage;
    var r = BP.rng(key + '-meta');
    var count = Math.min(6, 1 + Math.ceil(stage / 2));
    var two = stage > 4;
    var lamps = two ? twoLamps() : warmLamps();
    var readings = two ? (stage > 7 ? ['red', 'blue', 'umbra'] : ['red', 'blue']) : ['main'];
    var pool = stage > 6 ? POOL_NEUTRE : POOL_FIGURE;
    var leurres = Math.max(0, 3 - Math.floor(stage / 3));
    var g = generate(key, {
      lamps: lamps, pool: pool, count: count,
      maxDepth: two ? 3 : 4, allowTilt: stage > 2, leurres: leurres
    });
    return {
      id: 'tour-' + seed + '-' + stage, act: 0, index: stage, type: 'tableau',
      title: 'Étape ' + stage + ' : la bête à ' + r.pick(NOMS),
      intro: stage === 1
        ? 'La tournée commence. Une ville, une ombre, et on repart.'
        : 'Ville suivante. Le coffre s\'allège, le public grossit.',
      outro: 'On plie le drap. La route continue.',
      hint: 'Le coffre contient exactement ce qu\'il faut — et parfois un peu de trop.',
      lamps: lamps, readings: readings, unlocks: [],
      solution: g.solution,
      coffre: makeCoffre(key, [g.solution], g.leurres),
      par: parFor(g.solution, 1)
    };
  }

  /* =================================================================================
   * 7. API publique
   * ================================================================================= */

  BP.levels = {
    acts: acts,
    all: all,
    byId: function (id) { return index[id] || null; },
    next: function (id) {
      var i = all.findIndex ? all.findIndex(function (l) { return l.id === id; }) : -1;
      if (i < 0) { for (var k = 0; k < all.length; k++) if (all[k].id === id) { i = k; break; } }
      return (i >= 0 && i + 1 < all.length) ? all[i + 1] : null;
    },
    makeImprov: makeImprov,
    makeTournee: makeTournee,
    // utilitaires partagés (rendu de miniatures, outils de contrôle)
    projBounds: projBounds,
    fits: fits,
    parFor: parFor
  };
})(window.BP);
