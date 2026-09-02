'use strict';
/* Bêtes de Papier — bibliothèque des découpes (BP.shapes).
 *
 * Toutes les formes sont GÉNÉRÉES PAR CODE : cercles, ellipses, courbes de Bézier,
 * profils tracés le long d'une ligne moyenne, et pour les formes organiques un contour
 * extrait d'un champ de distance signé par « marching squares ».
 *
 * Convention (SPEC §4) :
 *   - un polygone = [[x, y], …] en unités-monde, centré sur (0,0) (centre du rectangle englobant) ;
 *   - polys[0] = contour extérieur, les suivants = trous ou parties disjointes (règle evenodd) ;
 *   - taille indicative entre 20 et 120 unités.
 */
window.BP = window.BP || {};
(function (BP) {

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;

  /* =================================================================================
   * 1. Petits utilitaires de courbes
   * ================================================================================= */

  /** Arc d'ellipse : angles en degrés, n segments. Renvoie n+1 points (bornes incluses). */
  function arcPts(cx, cy, rx, ry, a0, a1, n) {
    var out = [], i;
    for (i = 0; i <= n; i++) {
      var a = (a0 + (a1 - a0) * (i / n)) * DEG;
      out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return out;
  }

  /** Ellipse complète (n points, sans doublon de fermeture). */
  function ellipsePts(cx, cy, rx, ry, n) {
    var out = [], i;
    for (i = 0; i < n; i++) {
      var a = (i / n) * TAU;
      out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return out;
  }

  /** Bézier quadratique échantillonnée (n+1 points). */
  function quadPts(p0, p1, p2, n) {
    var out = [], i;
    for (i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      out.push([
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]
      ]);
    }
    return out;
  }

  /** Contour radial : r(θ) donné par une fonction, n points. */
  function radialPts(cx, cy, fn, n) {
    var out = [], i;
    for (i = 0; i < n; i++) {
      var a = (i / n) * TAU, r = fn(a);
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return out;
  }

  /** Épaissit une ligne moyenne : renvoie un polygone fermé (aller par la gauche, retour par la droite).
   *  hw : nombre, tableau (même longueur) ou fonction de u ∈ [0,1]. */
  function stroke(line, hw) {
    var n = line.length, left = [], right = [], i;
    for (i = 0; i < n; i++) {
      var p = line[i];
      var a = line[Math.max(0, i - 1)], b = line[Math.min(n - 1, i + 1)];
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var L = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / L, ny = dx / L;
      var w = typeof hw === 'function' ? hw(i / (n - 1)) : (typeof hw === 'number' ? hw : hw[i]);
      left.push([p[0] + nx * w, p[1] + ny * w]);
      right.push([p[0] - nx * w, p[1] - ny * w]);
    }
    right.reverse();
    return left.concat(right);
  }

  /** Ligne moyenne le long d'un arc de cercle. */
  function arcLine(cx, cy, r, a0, a1, n) { return arcPts(cx, cy, r, r, a0, a1, n); }

  /* =================================================================================
   * 2. Champs de distance signés (positif = intérieur) et opérations booléennes
   * ================================================================================= */

  function fCircle(cx, cy, r) {
    return function (x, y) { return r - Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)); };
  }
  function fEllipse(cx, cy, rx, ry) {
    var m = Math.min(rx, ry);
    return function (x, y) {
      var u = (x - cx) / rx, v = (y - cy) / ry;
      return (1 - Math.sqrt(u * u + v * v)) * m;
    };
  }
  /** Boîte à coins arrondis (hw, hh = demi-dimensions ; r = rayon de congé). */
  function fBox(cx, cy, hw, hh, r) {
    r = r || 0;
    return function (x, y) {
      var dx = Math.abs(x - cx) - (hw - r), dy = Math.abs(y - cy) - (hh - r);
      var ax = Math.max(dx, 0), ay = Math.max(dy, 0);
      var d = Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(dx, dy), 0) - r;
      return -d;
    };
  }
  /** Capsule (segment épaissi). */
  function fSeg(ax, ay, bx, by, r) {
    var bax = bx - ax, bay = by - ay, ll = bax * bax + bay * bay || 1;
    return function (x, y) {
      var pax = x - ax, pay = y - ay;
      var h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / ll));
      var qx = pax - bax * h, qy = pay - bay * h;
      return r - Math.sqrt(qx * qx + qy * qy);
    };
  }
  function fUnion() {
    var fs = Array.prototype.slice.call(arguments);
    return function (x, y) {
      var m = -1e9;
      for (var i = 0; i < fs.length; i++) { var v = fs[i](x, y); if (v > m) m = v; }
      return m;
    };
  }
  function fSub(a, b) { return function (x, y) { return Math.min(a(x, y), -b(x, y)); }; }

  /* --- Marching squares : extraction des contours du champ (valeur 0) --------------- */

  var MS_TABLE = [
    [], [[3, 0]], [[0, 1]], [[3, 1]],
    [[1, 2]], null, [[0, 2]], [[3, 2]],
    [[2, 3]], [[2, 0]], null, [[2, 1]],
    [[1, 3]], [[1, 0]], [[0, 3]], []
  ];

  /** Extrait les boucles du contour f = 0 sur la boîte donnée. Renvoie [[ [x,y], … ], …]. */
  function contourOf(f, x0, y0, x1, y1, cell) {
    cell = cell || 1.6;
    var nx = Math.max(8, Math.min(160, Math.ceil((x1 - x0) / cell)));
    var ny = Math.max(8, Math.min(160, Math.ceil((y1 - y0) / cell)));
    var dx = (x1 - x0) / nx, dy = (y1 - y0) / ny;
    var vals = new Float64Array((nx + 1) * (ny + 1));
    var i, j;
    for (j = 0; j <= ny; j++) {
      for (i = 0; i <= nx; i++) vals[j * (nx + 1) + i] = f(x0 + i * dx, y0 + j * dy);
    }
    function V(a, b) { return vals[b * (nx + 1) + a]; }

    var pts = {}, link = {};
    function edge(e, i, j) {
      var v0 = V(i, j), v1 = V(i + 1, j), v2 = V(i + 1, j + 1), v3 = V(i, j + 1), t, k, px, py;
      if (e === 0) { t = v0 / (v0 - v1); k = 'h' + i + ',' + j; px = x0 + (i + t) * dx; py = y0 + j * dy; }
      else if (e === 1) { t = v1 / (v1 - v2); k = 'v' + (i + 1) + ',' + j; px = x0 + (i + 1) * dx; py = y0 + (j + t) * dy; }
      else if (e === 2) { t = v3 / (v3 - v2); k = 'h' + i + ',' + (j + 1); px = x0 + (i + t) * dx; py = y0 + (j + 1) * dy; }
      else { t = v0 / (v0 - v3); k = 'v' + i + ',' + j; px = x0 + i * dx; py = y0 + (j + t) * dy; }
      pts[k] = [px, py];
      return k;
    }
    function connect(ka, kb) {
      (link[ka] = link[ka] || []).push(kb);
      (link[kb] = link[kb] || []).push(ka);
    }

    for (j = 0; j < ny; j++) {
      for (i = 0; i < nx; i++) {
        var v0 = V(i, j), v1 = V(i + 1, j), v2 = V(i + 1, j + 1), v3 = V(i, j + 1);
        var c = (v0 > 0 ? 1 : 0) | (v1 > 0 ? 2 : 0) | (v2 > 0 ? 4 : 0) | (v3 > 0 ? 8 : 0);
        if (c === 0 || c === 15) continue;
        var segs = MS_TABLE[c];
        if (segs === null) {                       // cas ambigus (selle) : arbitrage par le centre
          var mid = (v0 + v1 + v2 + v3) / 4;
          if (c === 5) segs = mid > 0 ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
          else segs = mid > 0 ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]];
        }
        for (var s = 0; s < segs.length; s++) connect(edge(segs[s][0], i, j), edge(segs[s][1], i, j));
      }
    }

    var used = {}, loops = [];
    Object.keys(link).forEach(function (start) {
      if (used[start]) return;
      var loop = [], cur = start;
      while (cur && !used[cur]) {
        used[cur] = 1;
        loop.push(pts[cur]);
        var ns = link[cur], nxt = null;
        for (var q = 0; q < ns.length; q++) if (!used[ns[q]]) { nxt = ns[q]; break; }
        cur = nxt;
      }
      if (loop.length >= 4) loops.push(loop);
    });
    return loops;
  }

  function polyArea(p) {
    var a = 0;
    for (var i = 0, n = p.length; i < n; i++) {
      var q = p[(i + 1) % n];
      a += p[i][0] * q[1] - q[0] * p[i][1];
    }
    return a / 2;
  }

  /** Ré-échantillonne une boucle fermée à intervalle constant (12 à 40 points). */
  function resample(pts, forced) {
    var n = pts.length, seg = [], per = 0, i;
    for (i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      var d = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
      seg.push(d); per += d;
    }
    if (per <= 0) return pts;
    var N = forced || Math.max(12, Math.min(40, Math.round(per / 7)));
    var out = [], acc = 0, idx = 0, step = per / N;
    for (var k = 0; k < N; k++) {
      var t = k * step;
      while (idx < n - 1 && acc + seg[idx] < t) { acc += seg[idx]; idx++; }
      var u = seg[idx] > 1e-9 ? (t - acc) / seg[idx] : 0;
      var p = pts[idx], q = pts[(idx + 1) % n];
      out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]);
    }
    return out;
  }

  /** Forme organique : contour du champ f dans la boîte donnée, lissé et ré-échantillonné. */
  function csg(f, x0, y0, x1, y1, cell) {
    var loops = contourOf(f, x0, y0, x1, y1, cell);
    loops = loops.map(function (l) { return resample(l); });
    loops.sort(function (a, b) { return Math.abs(polyArea(b)) - Math.abs(polyArea(a)); });
    return loops;
  }

  /* =================================================================================
   * 3. Enregistrement des découpes
   * ================================================================================= */

  var REG = {};
  var LIST = [];

  function round2(v) { return Math.round(v * 100) / 100; }

  /** Normalise (centrage sur le milieu du rectangle englobant) et enregistre une découpe. */
  function def(id, name, polys) {
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    polys.forEach(function (p) {
      p.forEach(function (q) {
        if (q[0] < minx) minx = q[0];
        if (q[0] > maxx) maxx = q[0];
        if (q[1] < miny) miny = q[1];
        if (q[1] > maxy) maxy = q[1];
      });
    });
    var cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    var out = polys.map(function (p) {
      return p.map(function (q) { return [round2(q[0] - cx), round2(q[1] - cy)]; });
    });
    var shape = {
      id: id, name: name, polys: out,
      w: round2(maxx - minx), h: round2(maxy - miny)
    };
    REG[id] = shape;
    LIST.push(id);
    return shape;
  }

  /* --------------------------------------------------------------- formes de base */

  // Disque — la lune pleine, la tête, la roue.
  def('disc', 'Disque', [ellipsePts(0, 0, 30, 30, 32)]);

  // Anneau — un vrai trou (règle evenodd).
  def('ring', 'Anneau', [ellipsePts(0, 0, 34, 34, 34), ellipsePts(0, 0, 21, 21, 26)]);

  // Goutte — cercle du bas + pointe en haut, raccordés par les tangentes.
  (function () {
    var cx = 0, cy = 12, r = 24, tx = 0, ty = -46;
    var d = Math.sqrt((tx - cx) * (tx - cx) + (ty - cy) * (ty - cy));
    var base = Math.atan2(ty - cy, tx - cx) / DEG;      // -90°
    var half = Math.acos(r / d) / DEG;
    var a0 = base + half, a1 = base - half + 360;
    var p = arcPts(cx, cy, r, r, a0, a1, 26);
    p.push([tx, ty]);
    def('drop', 'Goutte', [p]);
  })();

  // Croissant — disque extérieur moins disque décalé.
  (function () {
    var R = 36, r = 31, dx = 16;
    var xi = (dx * dx + R * R - r * r) / (2 * dx);
    var yi = Math.sqrt(Math.max(0, R * R - xi * xi));
    var aOut = Math.atan2(yi, xi) / DEG;
    var aIn = Math.atan2(yi, xi - dx) / DEG;
    var p = arcPts(0, 0, R, R, aOut, 360 - aOut, 18)
      .concat(arcPts(dx, 0, r, r, 360 - aIn, aIn, 14));
    def('crescent', 'Croissant', [p]);
  })();

  // Feuille — pointue aux deux bouts (verticale).
  (function () {
    var L = 82, W = 34, N = 16, p = [], i;
    for (i = 0; i <= N; i++) {
      var u = -1 + 2 * i / N;
      p.push([Math.pow(Math.max(0, 1 - u * u), 0.62) * W / 2, u * L / 2]);
    }
    for (i = N - 1; i >= 1; i--) {
      var v = -1 + 2 * i / N;
      p.push([-Math.pow(Math.max(0, 1 - v * v), 0.62) * W / 2, v * L / 2]);
    }
    def('leaf', 'Feuille', [p]);
  })();

  // Lame — courbée, épaisse au talon, pointue à la pointe (cimeterre).
  (function () {
    var N = 18, line = [], i;
    for (i = 0; i <= N; i++) {
      var t = i / N;
      line.push([-52 + 104 * t, -13 * Math.sin(Math.PI * t)]);
    }
    def('blade', 'Lame', [stroke(line, function (u) { return 8.5 * Math.pow(1 - u, 0.55) + 0.6; })]);
  })();

  // Aiguille — triangle très fin.
  def('thin_tri', 'Aiguille', [[[0, -50], [8, 50], [-8, 50]]]);

  // Triangle.
  def('tri', 'Triangle', [[[0, -34], [34, 28], [-34, 28]]]);

  // Carré.
  def('square', 'Carré', [[[-24, -24], [24, -24], [24, 24], [-24, 24]]]);

  // Barre.
  def('bar', 'Barre', [[[-32, -7], [32, -7], [32, 7], [-32, 7]]]);

  // Longue barre.
  def('long_bar', 'Longue barre', [[[-64, -5.5], [64, -5.5], [64, 5.5], [-64, 5.5]]]);

  // Arc — bande annulaire ouverte vers la droite.
  (function () {
    var p = arcPts(0, 0, 40, 40, 40, 320, 20).concat(arcPts(0, 0, 27, 27, 320, 40, 16));
    def('arc', 'Arc', [p]);
  })();

  // Crochet — hampe droite puis boucle.
  (function () {
    var line = [[12, -48], [12, -20], [12, 2]];
    line = line.concat(arcLine(0, 2, 12, 0, 215, 14).slice(1));
    def('hook', 'Crochet', [stroke(line, function (u) { return 6.5 - 2.2 * u; })]);
  })();

  // Peigne — barre dentée.
  (function () {
    var p = [[-40, -10], [40, -10], [40, 4]];
    var centres = [32, 16, 0, -16, -32];
    centres.forEach(function (c) { p.push([c + 4, 4], [c + 4, 28], [c - 4, 28], [c - 4, 4]); });
    p.push([-40, 4]);
    def('comb', 'Peigne', [p]);
  })();

  // Coin — part de tarte pointant vers la droite.
  (function () {
    var p = [[0, 0]].concat(arcPts(0, 0, 56, 56, -25, 25, 12));
    def('wedge', 'Coin', [p]);
  })();

  // Masse — trois disques fondus, forme de corps.
  def('blob', 'Masse', csg(fUnion(fCircle(0, 0, 26), fCircle(17, -11, 20), fCircle(-15, 13, 18)),
    -50, -50, 50, 50, 2.0));

  // Étoile à cinq branches.
  (function () {
    var p = [], i;
    for (i = 0; i < 10; i++) {
      var a = -90 * DEG + i * Math.PI / 5;
      var r = (i % 2 === 0) ? 40 : 16.5;
      p.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    def('star', 'Étoile', [p]);
  })();

  // Croix.
  (function () {
    var a = 9, b = 34;
    def('cross', 'Croix', [[
      [-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a],
      [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a]
    ]]);
  })();

  // Cœur — feuille cordiforme.
  (function () {
    var p = [], i, N = 34;
    for (i = 0; i < N; i++) {
      var t = (i / N) * TAU;
      var x = 16 * Math.pow(Math.sin(t), 3);
      var y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      p.push([x * 2.1, y * 2.1]);
    }
    def('heart_leaf', 'Cœur', [p]);
  })();

  // Éventail — secteur festonné.
  (function () {
    var apex = [0, 30], N = 30, p = [apex], i;
    for (i = 0; i <= N; i++) {
      var u = i / N;
      var a = (-145 + 110 * u) * DEG;
      var r = 62 + 4 * Math.cos(u * 5 * TAU);
      p.push([apex[0] + Math.cos(a) * r, apex[1] + Math.sin(a) * r]);
    }
    def('fan', 'Éventail', [p]);
  })();

  // Clé — anneau percé, tige, panneton.
  def('key', 'Clé', csg(fSub(
    fUnion(fCircle(-44, 0, 18), fBox(0, 0, 46, 5, 2), fBox(21, 10, 4.5, 10, 1.5), fBox(35, 10, 4.5, 10, 1.5)),
    fCircle(-44, 0, 8.5)
  ), -66, -24, 46, 24, 1.5));

  // Os — barre et quatre lobes.
  def('bone', 'Os', csg(fUnion(
    fBox(0, 0, 25, 7, 3),
    fCircle(-24, -9, 12), fCircle(24, -9, 12), fCircle(-24, 9, 12), fCircle(24, 9, 12)
  ), -40, -24, 40, 24, 1.7));

  // Vague — ruban sinusoïdal.
  (function () {
    var N = 18, line = [], i;
    for (i = 0; i <= N; i++) {
      var x = -60 + 120 * (i / N);
      line.push([x, 15 * Math.sin(x / 60 * Math.PI * 1.5)]);
    }
    def('wave', 'Vague', [stroke(line, 5.5)]);
  })();

  // Œuf — ovoïde (plus étroit en haut).
  (function () {
    var p = [], i, N = 30;
    for (i = 0; i < N; i++) {
      var t = (i / N) * TAU;
      var taper = 1 - 0.26 * Math.cos(t);
      p.push([26 * Math.sin(t) * taper, -34 * Math.cos(t)]);
    }
    def('egg', 'Œuf', [p]);
  })();

  // Dent — couronne et deux racines.
  def('tooth', 'Dent', csg(fUnion(
    fBox(0, -10, 21, 15, 9),
    fSeg(-11, -2, -14, 32, 6.5), fSeg(11, -2, 14, 32, 6.5)
  ), -32, -30, 32, 42, 1.7));

  // Caillou — contour radial doux.
  def('pebble', 'Caillou', [radialPts(0, 0, function (a) {
    return 28 + 4.5 * Math.cos(2 * a + 1) + 3 * Math.cos(3 * a + 2.2) + 1.8 * Math.cos(5 * a + 0.4);
  }, 28)]);

  /* ------------------------------------------- formes figuratives partielles */

  // Tête de profil (museau à droite), avec l'œil percé.
  def('head', 'Tête de profil', csg(fSub(
    fUnion(
      fEllipse(0, 0, 30, 26),
      fCircle(-9, -6, 22),
      fSeg(14, 2, 40, 7, 11),
      fBox(-20, 20, 14, 13, 6)
    ),
    fCircle(15, -7, 4.6)
  ), -46, -36, 56, 40, 1.5));

  // Oreille — pointue, légèrement courbe.
  (function () {
    var outer = quadPts([-13, 25], [24, 4], [2, -27], 13);
    var inner = quadPts([2, -27], [-17, 0], [-14, 25], 13).slice(1);
    def('ear', 'Oreille', [outer.concat(inner)]);
  })();

  // Patte — coussinet et quatre doigts (les doigts ne se touchent pas : pas de trou parasite).
  def('paw', 'Patte', csg(fUnion(
    fEllipse(0, 6, 23, 18),
    fCircle(-19, -7, 5.4), fCircle(-7, -10.5, 6.5), fCircle(7, -10.5, 6.5), fCircle(19, -7, 5.4)
  ), -34, -26, 34, 32, 1.2));

  // Aile — plume échancrée, racine à gauche.
  def('wing', 'Aile', csg(fSub(
    fUnion(fEllipse(0, 0, 46, 21), fSeg(-40, -8, 32, -14, 10)),
    fUnion(fCircle(-30, 26, 11), fCircle(-14, 28, 11), fCircle(2, 29, 11), fCircle(18, 27, 11), fCircle(34, 24, 11))
  ), -60, -40, 60, 34, 1.8));

  // Queue — fouet courbe qui s'affine.
  (function () {
    var line = arcLine(0, 44, 46, 202, 340, 18);
    def('tail', 'Queue', [stroke(line, function (u) { return 12 * Math.pow(1 - u, 0.8) + 1.2; })]);
  })();

  // Bec — pointe vers la droite, légèrement recourbé.
  (function () {
    var top = quadPts([-20, -11], [4, -11], [24, 1], 10);
    var bot = quadPts([24, 1], [2, 9], [-20, 11], 10).slice(1);
    var back = quadPts([-20, 11], [-15, 0], [-20, -11], 6).slice(1);
    def('beak', 'Bec', [top.concat(bot, back)]);
  })();

  // Couronne — bandeau, trois pointes, deux pierres percées.
  (function () {
    var body = [
      [-38, 20], [38, 20], [38, 2], [26, -20], [13, 4], [0, -24],
      [-13, 4], [-26, -20], [-38, 2]
    ];
    var g1 = ellipsePts(-16, 12, 4.5, 4.5, 10);
    var g2 = ellipsePts(16, 12, 4.5, 4.5, 10);
    def('crown', 'Couronne', [body, g1, g2]);
  })();

  // Main — paume et cinq doigts.
  def('hand', 'Main', csg(fUnion(
    fBox(0, 14, 19, 15, 8),
    fSeg(-13, 4, -15, -18, 4.6),
    fSeg(-4, 2, -5, -25, 4.8),
    fSeg(5, 2, 6, -23, 4.8),
    fSeg(14, 5, 17, -13, 4.4),
    fSeg(-16, 14, -32, 0, 5.4)
  ), -42, -34, 28, 34, 0.9));

  // Plateau de balance — coupe très évasée.
  def('pan', 'Plateau', csg(fSub(
    fBox(0, 0, 34, 12, 4),
    fCircle(0, -42, 42)
  ), -40, -18, 40, 18, 1.3));

  // Barreau — tige fine (grille, cage, hampe).
  def('rod', 'Barreau', [[[-55, -2.6], [55, -2.6], [55, 2.6], [-55, 2.6]]]);

  // Corne — cône recourbé.
  (function () {
    var line = arcLine(24, 14, 42, 152, 238, 16);
    def('horn', 'Corne', [stroke(line, function (u) { return 11.5 * Math.pow(1 - u, 0.75) + 0.8; })]);
  })();

  // Griffe — petit crochet acéré.
  (function () {
    var line = arcLine(14, -8, 28, 62, 158, 14);
    def('claw', 'Griffe', [stroke(line, function (u) { return 7.5 * Math.pow(1 - u, 0.7) + 0.5; })]);
  })();

  /* =================================================================================
   * 4. API publique
   * ================================================================================= */

  var shapes = {
    /** Liste des identifiants disponibles. */
    list: LIST.slice(),

    /** Renvoie la découpe { id, name, polys, w, h } ou null. */
    get: function (id) { return REG[id] || null; },

    /** Vrai si l'identifiant existe. */
    has: function (id) { return !!REG[id]; },

    /** Construit le tracé des polygones dans le contexte (sans remplir ni tracer). */
    path: function (ctx, shape) {
      if (typeof shape === 'string') shape = REG[shape];
      if (!shape) return;
      var polys = shape.polys;
      for (var i = 0; i < polys.length; i++) {
        var p = polys[i];
        if (!p.length) continue;
        ctx.moveTo(p[0][0], p[0][1]);
        for (var j = 1; j < p.length; j++) ctx.lineTo(p[j][0], p[j][1]);
        ctx.closePath();
      }
    }
  };

  BP.shapes = shapes;
})(window.BP);
