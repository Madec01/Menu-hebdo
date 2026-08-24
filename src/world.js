/* CORE — generation d'un niveau.
   Grille de blocs, veines, cavernes, blocs a comportement, bidons, bonus,
   variantes de niveaux (filon, dedale, chute, effondrement), sceau et sortie. */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';

  var CFG = CORE.CFG;

  var T = {
    EMPTY: 0, SOFT: 1, MED: 2, HARD: 3, ORE: 4, BEDROCK: 5, SEAL: 6, LOCK: 7,
    FRIABLE: 8, CHARBON: 9, CRISTAL: 10, COFFRE: 11, REBOND: 12, GLUANTE: 13
  };
  var DESTRUCTIBLE = {};
  [1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 13].forEach(function (t) { DESTRUCTIBLE[t] = true; });

  // comportement des blocs speciaux
  var BEHAVIOUR = {
    8:  { cascade: 6,  hard: 0.5, name: 'friable' },   // s'effondre de proche en proche
    9:  { blast: 2,    hard: 0.9, name: 'charbon' },   // explose et enflamme ses voisines
    10: { cascade: 10, hard: 0.8, gold: 0.5, name: 'cristal' },
    11: { hard: 4,     chest: true, name: 'coffre' },
    12: { hard: 2.5,   bounce: 22, name: 'rebond' },
    13: { hard: 1.0,   slow: 0.5, name: 'gluante' }
  };

  var KIND = { BONUS: 1, PEPITE: 2, TEMPS: 3, CARBURANT: 4 };

  function valueNoise(rng, w, h, cell) {
    var gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
    var g = new Float32Array(gw * gh);
    for (var i = 0; i < g.length; i++) g[i] = rng.f();
    return function (x, y) {
      var fx = x / cell, fy = y / cell;
      var x0 = Math.floor(fx), y0 = Math.floor(fy);
      var tx = fx - x0, ty = fy - y0;
      tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      function at(cx, cy) {
        cx = Math.min(gw - 1, Math.max(0, cx)); cy = Math.min(gh - 1, Math.max(0, cy));
        return g[cy * gw + cx];
      }
      var a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
      var top = a + (b - a) * tx, bot = c + (d - c) * tx;
      return top + (bot - top) * ty;
    };
  }

  function generate(def, layer, seed, luck) {
    var rng = CORE.makeRng(seed);
    var W = CFG.LEVEL_W;
    var top = CFG.SURFACE_ROWS;
    var H = top + def.height + CFG.BEDROCK_ROWS;
    var special = T[layer.special];

    var world = {
      def: def, layer: layer, w: W, h: H, top: top, rng: rng,
      type: new Uint8Array(W * H),
      hard: new Float32Array(W * H),
      items: new Map(),
      debris: new Set(),
      oreTotal: 0, hardMul: 1, ceilingRow: 0, failleRow: -99, filledTo: undefined,
      exitX: 0, exitW: 7, exitRow: top + def.height,
      idx: function (x, y) { return y * W + x; },
      inside: function (x, y) { return x >= 0 && y >= 0 && x < W && y < H; },
      at: function (x, y) { return (x < 0 || y < 0 || x >= W || y >= H) ? T.BEDROCK : world.type[y * W + x]; },
      solid: function (x, y) { return world.at(x, y) !== T.EMPTY; },
      depthAt: function (row) { return def.top + Math.max(0, row - top); }
    };

    function setRock(x, y, t) {
      var i = y * W + x;
      world.type[i] = t;
      var b = BEHAVIOUR[t];
      var mult = t === T.SOFT ? 0.8 : (t === T.MED ? 1.15 : (t === T.HARD ? 1.7 : (b ? b.hard : 1)));
      world.hard[i] = Math.max(1, CFG.hardnessAt(world.depthAt(y)) * mult);
    }

    var noise = valueNoise(rng, W, H, 5);
    var chute = def.type === 'chute';
    var wSoft = layer.wSoft, wMed = layer.wMed, wHard = layer.wHard, wSp = layer.wSpecial;
    if (chute) { wSoft *= 1.25; wHard *= 0.5; }

    // Le bruit n'est pas uniforme : il se concentre autour de 0,5. On echantillonne
    // ses quantiles pour que les proportions de roche correspondent exactement aux
    // poids de la couche, tout en gardant le regroupement par paquets.
    var sample = [];
    for (var q0 = 0; q0 < 1500; q0++) {
      sample.push(noise(rng.int(1, W - 2), rng.int(top, top + def.height - 1)));
    }
    sample.sort(function (a, b) { return a - b; });
    var wTot = wSoft + wMed + wHard + wSp;
    function quant(p) { return sample[Math.min(sample.length - 1, Math.floor(p * sample.length))]; }
    var qSoft = quant(wSoft / wTot);
    var qMed = quant((wSoft + wMed) / wTot);
    var qHard = quant((wSoft + wMed + wHard) / wTot);

    // --- roche de base -----------------------------------------------------
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = y * W + x;
        if (y < top) { world.type[i] = T.EMPTY; continue; }
        if (x === 0 || x === W - 1 || y >= top + def.height) { world.type[i] = T.BEDROCK; continue; }
        var n = noise(x, y) + (rng.f() - 0.5) * 0.03;
        var t;
        if (n < qSoft) t = T.SOFT;
        else if (n < qMed) t = T.MED;
        else if (n < qHard) t = T.HARD;
        else t = special;
        setRock(x, y, t);
      }
    }

    // --- cavernes ----------------------------------------------------------
    var caves = chute ? 13 : layer.caves;
    for (var c = 0; c < caves; c++) {
      var cx = rng.int(6, W - 7);
      var cy = rng.int(top + 14, top + def.height - 10);
      var rx = chute ? rng.int(6, 13) : rng.int(4, 11);
      var ry = chute ? rng.int(5, 11) : rng.int(3, 8);
      for (var oy = -ry; oy <= ry; oy++) {
        for (var ox = -rx; ox <= rx; ox++) {
          if ((ox * ox) / (rx * rx) + (oy * oy) / (ry * ry) > 1) continue;
          var px = cx + ox, py = cy + oy;
          if (px <= 0 || px >= W - 1 || py < top + 2 || py >= top + def.height) continue;
          world.type[py * W + px] = T.EMPTY;
        }
      }
    }

    // --- veines de minerai (marche aleatoire orientee) ---------------------
    function vein(vx, vy, len, thick, dir, type) {
      for (var s = 0; s < len; s++) {
        dir += rng.range(-0.5, 0.5);
        vx += Math.cos(dir) * 1.2;
        vy += Math.sin(dir) * 0.55;
        var ix = Math.round(vx), iy = Math.round(vy);
        for (var k = 0; k < thick; k++) {
          var ax = ix + (k % 2), ay = iy + (k > 1 ? 1 : 0);
          if (ax <= 0 || ax >= W - 1 || ay < top + 4 || ay >= top + def.height) continue;
          var ai = ay * W + ax;
          if (world.type[ai] === T.EMPTY || world.type[ai] === T.BEDROCK) continue;
          if (k > 0 && !rng.chance(0.5)) continue;
          setRock(ax, ay, T.ORE);
          world.type[ai] = T.ORE;
          world.hard[ai] = Math.max(1, CFG.hardnessAt(world.depthAt(ay)) * 1.1);
          world.oreTotal++;
        }
      }
      return { x: vx, y: vy };
    }

    var veins = def.type === 'filon' ? Math.round(layer.veins * 0.4)
      : (def.type === 'gisement' ? Math.round(layer.veins * 1.7) : layer.veins);
    for (var v = 0; v < veins; v++) {
      vein(rng.int(3, W - 4), rng.int(top + 8, top + def.height - 6),
           rng.int(6, 16), 3, rng.f() * Math.PI * 2);
    }

    // --- variante FILON : une veine geante qui serpente jusqu'au fond -------
    if (def.type === 'filon') {
      var fx = rng.int(10, W - 10), fy = top + 6;
      world.filonPath = [];
      while (fy < top + def.height - 6) {
        fx += rng.range(-3.2, 3.2);
        fx = Math.max(4, Math.min(W - 5, fx));
        fy += rng.range(2, 4);
        world.filonPath.push([fx, fy]);
        for (var fo = -2; fo <= 2; fo++) {
          for (var fv = 0; fv < 4; fv++) {
            var gx = Math.round(fx) + fo, gy = Math.round(fy) + fv;
            if (gx <= 0 || gx >= W - 1 || gy >= top + def.height) continue;
            if (rng.chance(0.72)) {
              setRock(gx, gy, T.ORE);
              world.oreTotal++;
            }
          }
        }
      }
    }

    // --- variante DEDALE : des murs infranchissables, un seul passage -------
    if (def.type === 'dedale') {
      // trois passages par mur, assez larges pour etre reperables dans le noir :
      // le niveau doit se lire, pas s'endurer
      world.gaps = [];
      for (var by = top + 14; by < top + def.height - 10; by += 19) {
        var gaps = [rng.int(2, 18), rng.int(20, 36), rng.int(38, W - 9)];
        for (var gg = 0; gg < gaps.length; gg++) world.gaps.push([gaps[gg] + 3, by]);
        for (var bx = 1; bx < W - 1; bx++) {
          var inGap = false;
          for (var gk = 0; gk < gaps.length; gk++) {
            if (bx >= gaps[gk] && bx < gaps[gk] + 6) { inGap = true; break; }
          }
          if (inGap) continue;
          for (var bt = 0; bt < 2; bt++) world.type[(by + bt) * W + bx] = T.BEDROCK;
        }
      }
    }

    // --- blocs a comportement ponctuels ------------------------------------
    function scatterRock(count, type) {
      var placed = 0, guard = 0;
      while (placed < count && guard++ < count * 80) {
        var sx = rng.int(2, W - 3), sy = rng.int(top + 8, top + def.height - 4);
        var si = sy * W + sx;
        if (!DESTRUCTIBLE[world.type[si]] || world.type[si] === T.ORE) continue;
        setRock(sx, sy, type);
        placed++;
      }
    }
    scatterRock(layer.coffres, T.COFFRE);
    scatterRock(rng.int(3, 7), T.REBOND);
    if (layer.id >= 2) scatterRock(rng.int(6, 14), T.GLUANTE);

    // --- objets enfouis ----------------------------------------------------
    function scatter(count, kindFn) {
      var placed = 0, guard = 0;
      while (placed < count && guard++ < count * 60) {
        var bx = rng.int(2, W - 3), by = rng.int(top + 6, top + def.height - 4);
        var bi = by * W + bx;
        if (!DESTRUCTIBLE[world.type[bi]]) continue;
        if (world.items.has(bi)) continue;
        world.items.set(bi, kindFn(rng));
        placed++;
      }
    }

    scatter(Math.round(layer.bonuses * (luck || 1)), function (r) {
      return { kind: KIND.BONUS, bonus: CORE.CONTENT.rollBonus(r, false) };
    });
    scatter(layer.traps, function (r) {
      return { kind: KIND.BONUS, bonus: r.pick(CORE.CONTENT.MALUS) };
    });
    scatter(Math.round(layer.bonuses * 0.8), function () { return { kind: KIND.PEPITE }; });
    scatter(3, function () { return { kind: KIND.TEMPS }; });
    scatter(layer.bidons, function () { return { kind: KIND.CARBURANT }; });

    // --- le Sceau ----------------------------------------------------------
    if (def.type === 'sceau') {
      var sealTop = top + def.height - 6;
      for (var sy2 = sealTop; sy2 < top + def.height; sy2++) {
        for (var sx2 = 1; sx2 < W - 1; sx2++) {
          var si2 = sy2 * W + sx2;
          world.type[si2] = T.SEAL;
          world.hard[si2] = def.sealHard;
          world.items.delete(si2);
        }
      }
    }

    // --- la sortie ---------------------------------------------------------
    world.exitX = rng.int(6, W - 8 - world.exitW);
    var exitType = (def.type === 'gisement') ? T.LOCK : T.EMPTY;
    for (var ey = world.exitRow; ey < H; ey++) {
      for (var ex = world.exitX; ex < world.exitX + world.exitW; ex++) {
        world.type[ey * W + ex] = ey === world.exitRow ? exitType : T.EMPTY;
      }
    }
    world.locked = (def.type === 'gisement');
    // On ne demarre jamais au-dessus de la sortie : il y a toujours du chemin
    // lateral a faire, sinon un niveau peut se boucler en chute libre.
    var offs = rng.int(14, 26) * (world.exitX < W / 2 ? 1 : -1);
    world.startX = Math.max(3, Math.min(W - 5, world.exitX + offs));
    world.ceilingRow = top - 2;
    world.setRock = setRock;

    // Plans d'arriere-plan : cavernes lointaines, colonnes, strates.
    // C'est ce qui donne la sensation d'etre DANS quelque chose.
    world.bg = [];
    for (var b = 0; b < 90; b++) {
      world.bg.push({
        x: rng.range(-0.15, 1.15), y: rng.range(0, 1),
        rx: rng.range(0.03, 0.16), ry: rng.range(0.01, 0.05),
        d: rng.pick([0.22, 0.38, 0.55]),
        kind: rng.f() < 0.55 ? 'blob' : 'column'
      });
    }
    world.strata = [];
    for (var st = 0; st < 26; st++) {
      world.strata.push({ y: rng.f(), h: rng.range(0.004, 0.02), d: rng.pick([0.3, 0.5]) });
    }
    world.fore = [];
    for (var fo = 0; fo < 16; fo++) {
      world.fore.push({ x: rng.range(0, 1), y: rng.range(0, 1), r: rng.range(0.02, 0.06) });
    }

    return world;
  }

  /* ------------------------------------------------------ EFFONDREMENTS */
  /* Largeur du vide sous une case : c'est elle qui decide si le plafond tient.
     Creuser 2 de large ne fait rien tomber, creuser 4 fait ceder la voute. */
  function emptySpanBelow(world, x, y) {
    if (world.at(x, y + 1) !== T.EMPTY) return 0;
    var span = 1, k;
    for (k = 1; k < 12; k++) { if (world.at(x - k, y + 1) !== T.EMPTY) break; span++; }
    for (k = 1; k < 12; k++) { if (world.at(x + k, y + 1) !== T.EMPTY) break; span++; }
    return span;
  }

  /* La masse qui lache au-dessus d'un vide, ou null si la voute tient. */
  function looseMass(world, x, y, minSpan, cap) {
    var span = emptySpanBelow(world, x, y);
    if (span < minSpan) return null;
    if (!DESTRUCTIBLE[world.at(x, y)]) return null;

    var spread = Math.min(7, Math.ceil(span / 2) + 1);
    var height = Math.min(8, 2 + Math.floor(span / 2));
    var seen = new Set(), cells = [], queue = [[x, y]];
    while (queue.length && cells.length < cap) {
      var c = queue.shift();
      var cx = c[0], cy = c[1];
      if (Math.abs(cx - x) > spread || y - cy > height || cy > y) continue;
      var key = cy * world.w + cx;
      if (seen.has(key)) continue;
      if (!DESTRUCTIBLE[world.at(cx, cy)]) continue;
      seen.add(key);
      cells.push([cx, cy]);
      queue.push([cx, cy - 1], [cx - 1, cy], [cx + 1, cy]);
    }
    if (cells.length >= cap) return null;   // trop gros : c'est le terrain, il porte

    // On retire ce qui repose encore sur du solide exterieur a la masse, jusqu'a
    // ne garder que ce qui pend vraiment dans le vide.
    for (var pass = 0; pass < 4; pass++) {
      var inMass = new Set();
      cells.forEach(function (cc) { inMass.add(cc[1] * world.w + cc[0]); });
      var kept = cells.filter(function (cc) {
        var below = (cc[1] + 1) * world.w + cc[0];
        if (inMass.has(below)) return true;
        return world.at(cc[0], cc[1] + 1) === T.EMPTY;
      });
      if (kept.length === cells.length) break;
      cells = kept;
    }
    return cells.length >= (CFG.FALL.minMass || 2) ? cells : null;
  }

  function unlockExit(world) {
    if (!world.locked) return;
    world.locked = false;
    for (var ex = world.exitX; ex < world.exitX + world.exitW; ex++) {
      world.type[world.exitRow * world.w + ex] = T.EMPTY;
    }
  }

  /* Le plus proche objet d'un certain type, ou null. */
  function nearestItem(world, kind, cx, cy, maxDist) {
    var best = null, bestD = maxDist * maxDist;
    world.items.forEach(function (item, idx) {
      if (item.kind !== kind) return;
      var ix = idx % world.w, iy = (idx / world.w) | 0;
      var dx = ix - cx, dy = iy - cy, d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = { x: ix, y: iy, idx: idx }; }
    });
    return best;
  }

  CORE.WORLD = {
    generate: generate, unlockExit: unlockExit, nearestItem: nearestItem,
    emptySpanBelow: emptySpanBelow, looseMass: looseMass,
    T: T, KIND: KIND, DESTRUCTIBLE: DESTRUCTIBLE, BEHAVIOUR: BEHAVIOUR
  };
})(window.CORE);
