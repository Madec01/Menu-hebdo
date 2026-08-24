/* CORE — generation d'un niveau.
   Grille de blocs, veines de minerai, cavernes, bonus enfouis, sceau et sortie. */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';

  var CFG = CORE.CFG;

  var T = { EMPTY: 0, SOFT: 1, MED: 2, HARD: 3, ORE: 4, BEDROCK: 5, SEAL: 6, LOCK: 7 };
  var DESTRUCTIBLE = { 1: true, 2: true, 3: true, 4: true, 6: true };

  var KIND = { BONUS: 1, PEPITE: 2, TEMPS: 3 };

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
      return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
    };
  }

  function generate(def, layer, seed, luck) {
    var rng = CORE.makeRng(seed);
    var W = CFG.LEVEL_W;
    var top = CFG.SURFACE_ROWS;
    var H = top + def.height + CFG.BEDROCK_ROWS;

    var world = {
      def: def, layer: layer, w: W, h: H, top: top, rng: rng,
      type: new Uint8Array(W * H),
      hard: new Float32Array(W * H),
      prog: new Float32Array(W * H),
      items: new Map(),
      oreTotal: 0,
      exitX: 0, exitW: 5, exitRow: top + def.height,
      idx: function (x, y) { return y * W + x; },
      inside: function (x, y) { return x >= 0 && y >= 0 && x < W && y < H; },
      at: function (x, y) { return (x < 0 || y < 0 || x >= W || y >= H) ? T.BEDROCK : world.type[y * W + x]; },
      solid: function (x, y) { return world.at(x, y) !== T.EMPTY; },
      depthAt: function (row) { return def.top + Math.max(0, row - top); }
    };

    var noise = valueNoise(rng, W, H, 5);

    // --- roche de base -----------------------------------------------------
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = y * W + x;
        if (y < top) { world.type[i] = T.EMPTY; continue; }
        if (x === 0 || x === W - 1 || y >= top + def.height) { world.type[i] = T.BEDROCK; continue; }
        var n = noise(x, y) * 0.75 + rng.f() * 0.25;
        var t = n < layer.wSoft ? T.SOFT : (n < layer.wSoft + layer.wMed ? T.MED : T.HARD);
        world.type[i] = t;
        var base = CFG.hardnessAt(world.depthAt(y));
        var mult = t === T.SOFT ? 0.8 : (t === T.MED ? 1.15 : 1.7);
        world.hard[i] = Math.max(1, base * mult);
      }
    }

    // --- cavernes ----------------------------------------------------------
    for (var c = 0; c < layer.caves; c++) {
      var cx = rng.int(6, W - 7);
      var cy = rng.int(top + 20, top + def.height - 12);
      var rx = rng.int(4, 11), ry = rng.int(3, 8);
      for (var oy = -ry; oy <= ry; oy++) {
        for (var ox = -rx; ox <= rx; ox++) {
          if ((ox * ox) / (rx * rx) + (oy * oy) / (ry * ry) > 1) continue;
          var px = cx + ox, py = cy + oy;
          if (px <= 0 || px >= W - 1 || py < top || py >= top + def.height) continue;
          world.type[py * W + px] = T.EMPTY;
        }
      }
    }

    // --- veines de minerai (marche aleatoire orientee) ---------------------
    var veins = Math.round(layer.veins);
    for (var v = 0; v < veins; v++) {
      var vx = rng.int(3, W - 4);
      var vy = rng.int(top + 8, top + def.height - 6);
      var dir = rng.f() * Math.PI * 2;
      var len = rng.int(6, 16);
      for (var s = 0; s < len; s++) {
        dir += rng.range(-0.5, 0.5);
        // les veines sont majoritairement horizontales : on ecrase le dy
        vx += Math.cos(dir) * 1.2;
        vy += Math.sin(dir) * 0.55;
        var ix = Math.round(vx), iy = Math.round(vy);
        for (var k = 0; k < 3; k++) {
          var ax = ix + (k === 1 ? 1 : 0), ay = iy + (k === 2 ? 1 : 0);
          if (ax <= 0 || ax >= W - 1 || ay < top + 4 || ay >= top + def.height) continue;
          var ai = ay * W + ax;
          if (world.type[ai] === T.EMPTY || world.type[ai] === T.BEDROCK) continue;
          if (k > 0 && !rng.chance(0.45)) continue;
          world.type[ai] = T.ORE;
          world.hard[ai] = Math.max(1, CFG.hardnessAt(world.depthAt(ay)) * 1.1);
          world.oreTotal++;
        }
      }
    }

    // --- bonus et pieges enfouis ------------------------------------------
    function scatter(count, kindFn) {
      var placed = 0, guard = 0;
      while (placed < count && guard++ < count * 60) {
        var bx = rng.int(2, W - 3);
        var by = rng.int(top + 6, top + def.height - 4);
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
    scatter(Math.round(layer.bonuses * 0.8), function () {
      return { kind: KIND.PEPITE };
    });
    scatter(3, function () { return { kind: KIND.TEMPS }; });

    // --- le Sceau ----------------------------------------------------------
    if (def.type === 'sceau') {
      var sealTop = top + def.height - 6;
      for (var sy = sealTop; sy < top + def.height; sy++) {
        for (var sx = 1; sx < W - 1; sx++) {
          var si = sy * W + sx;
          world.type[si] = T.SEAL;
          world.hard[si] = def.sealHard;
          world.items.delete(si);
        }
      }
    }

    // --- la sortie ---------------------------------------------------------
    world.exitX = rng.int(6, W - 6 - world.exitW);
    var exitType = (def.type === 'gisement') ? T.LOCK : T.EMPTY;
    for (var ey = world.exitRow; ey < H; ey++) {
      for (var ex = world.exitX; ex < world.exitX + world.exitW; ex++) {
        world.type[ey * W + ex] = ey === world.exitRow ? exitType : T.EMPTY;
      }
    }
    world.locked = (def.type === 'gisement');

    return world;
  }

  function unlockExit(world) {
    if (!world.locked) return;
    world.locked = false;
    for (var ex = world.exitX; ex < world.exitX + world.exitW; ex++) {
      world.type[world.exitRow * world.w + ex] = T.EMPTY;
    }
  }

  CORE.WORLD = { generate: generate, unlockExit: unlockExit, T: T, KIND: KIND, DESTRUCTIBLE: DESTRUCTIBLE };
})(window.CORE);
