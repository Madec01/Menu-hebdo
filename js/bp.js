'use strict';
/* Bêtes de Papier — espace de noms partagé, constantes et utilitaires. */
window.BP = window.BP || {};
(function (BP) {
  BP.VERSION = '1.0.0';
  BP.DRAP_W = 400;
  BP.DRAP_H = 300;
  BP.GRID = 4;
  BP.DEPTHS = [1, 0.85, 0.72, 0.6, 0.5];   // distance lampe -> pièce (drap à 1)
  BP.TILTS = [1, 0.7, 0.35];               // facteur d'écrasement de l'axe X local
  BP.MASK_W = 128;
  BP.MASK_H = 96;
  BP.PASS = 0.90;
  BP.GOLD = 0.97;
  BP.ROT_STEP = 15;

  /** Facteur d'agrandissement d'une pièce à la profondeur donnée. */
  BP.scaleOf = function (depth) { return 1 / BP.DEPTHS[depth]; };

  /** Centre de l'ombre de la pièce sous la lampe j (lamps[0] = lampe principale). */
  BP.shadowCenter = function (piece, lamps, j) {
    var k = BP.scaleOf(piece.depth);
    var L0 = lamps[0], Lj = lamps[j] || lamps[0];
    return { x: piece.sx + (L0.x - Lj.x) * (k - 1), y: piece.sy + (L0.y - Lj.y) * (k - 1) };
  };

  /** Transforme un point local du polygone en point drap sous la lampe j. */
  BP.projectPoint = function (px, py, piece, lamps, j) {
    var k = BP.scaleOf(piece.depth);
    var x = px * (piece.flip ? -1 : 1) * BP.TILTS[piece.tilt];
    var y = py;
    var a = piece.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var rx = x * c - y * s, ry = x * s + y * c;
    var C = BP.shadowCenter(piece, lamps, j);
    return { x: C.x + rx * k, y: C.y + ry * k };
  };

  /** RNG déterministe (mulberry32) ; seed = entier ou chaîne. */
  BP.rng = function (seed) {
    var h = 0;
    if (typeof seed === 'string') {
      for (var i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 2654435761) >>> 0;
    } else h = (seed >>> 0);
    var a = h || 0x9E3779B9;
    var r = function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    r.int = function (lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); };
    r.pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
    r.shuffle = function (arr) { var b = arr.slice(); for (var i = b.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = b[i]; b[i] = b[j]; b[j] = t; } return b; };
    return r;
  };

  /** Petit émetteur d'événements. */
  BP.Emitter = function () { this._h = {}; };
  BP.Emitter.prototype.on = function (ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return this; };
  BP.Emitter.prototype.off = function (ev, fn) { var a = this._h[ev]; if (!a) return this; var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); return this; };
  BP.Emitter.prototype.emit = function (ev, data) { var a = this._h[ev]; if (!a) return; a.slice().forEach(function (f) { try { f(data); } catch (e) { console.error('[BP] handler ' + ev, e); } }); };

  BP.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  BP.lerp = function (a, b, t) { return a + (b - a) * t; };
  BP.dateKey = function (d) { d = d || new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
})(window.BP);
