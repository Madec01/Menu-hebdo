'use strict';
/* =====================================================================================
   Bêtes de Papier — js/core.js
   Moteur du jeu : modèle des pièces, projection des ombres, masques et score,
   rendu canvas 2D, entrées unifiées (pointeur / clavier), mode représentation,
   et sauvegarde locale (BP.save).

   Ce fichier n'expose que `BP.engine` et `BP.save`. Tous les appels vers les autres
   modules (BP.shapes, BP.audio, BP.levels) sont gardés par une vérification.
   ===================================================================================== */
window.BP = window.BP || {};
(function (BP) {

  /* ===================================================================================
     0. Petits utilitaires internes
     =================================================================================== */

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function isFn(f) { return typeof f === 'function'; }

  /** Appel défensif d'un effet sonore. */
  function sfx(name) {
    if (BP.audio && isFn(BP.audio.sfx)) { try { BP.audio.sfx(name); } catch (e) { /* silencieux */ } }
  }
  function audioIntensity(v) {
    if (BP.audio && isFn(BP.audio.setIntensity)) { try { BP.audio.setIntensity(v); } catch (e) { } }
  }

  /* ===================================================================================
     1. Sauvegarde — BP.save
     =================================================================================== */

  var SAVE_KEY = 'bp_save_v1';

  function saveDefaults() {
    return {
      levels: {},                 // { [id]: { best, stars, bestMoves, done } }
      achievements: {},           // { [id]: timestamp }
      settings: { music: 0.7, sfx: 0.9, muted: false, reduceMotion: false, sideView: true },
      improv: {},                 // { [dateKey]: { best, moves } }
      tournee: { best: 0, bestScore: 0 },
      seen: {}                    // { [unlock]: true }
    };
  }

  /** Fusion profonde : les clés absentes de `src` prennent la valeur par défaut. */
  function deepMerge(def, src) {
    if (src === null || src === undefined) return def;
    if (Object.prototype.toString.call(def) !== '[object Object]') {
      return (typeof src === typeof def) ? src : def;
    }
    if (Object.prototype.toString.call(src) !== '[object Object]') return def;
    var out = {}, k;
    for (k in def) if (Object.prototype.hasOwnProperty.call(def, k)) out[k] = deepMerge(def[k], src[k]);
    for (k in src) if (Object.prototype.hasOwnProperty.call(src, k) && !(k in out)) out[k] = src[k];
    return out;
  }

  var saveData = null;

  function saveLoad() {
    var def = saveDefaults(), raw = null;
    try { raw = window.localStorage ? window.localStorage.getItem(SAVE_KEY) : null; } catch (e) { raw = null; }
    if (!raw) return def;
    var parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
    return deepMerge(def, parsed);
  }

  function savePersist() {
    try {
      if (window.localStorage) window.localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    } catch (e) { /* mode privé / quota : on continue en mémoire */ }
  }

  BP.save = {
    /** Objet persistant (toujours complété par la structure par défaut). */
    get: function () {
      if (!saveData) saveData = saveLoad();
      return saveData;
    },
    /** Applique un mutateur puis persiste. Renvoie l'objet. */
    set: function (mutator) {
      var d = BP.save.get();
      if (isFn(mutator)) { try { mutator(d); } catch (e) { console.error('[BP.save]', e); } }
      savePersist();
      return d;
    },
    /** Remet la sauvegarde à zéro. */
    reset: function () {
      saveData = saveDefaults();
      try { if (window.localStorage) window.localStorage.removeItem(SAVE_KEY); } catch (e) { }
      return saveData;
    },
    KEY: SAVE_KEY
  };

  /* ===================================================================================
     2. Découpes — accès défensif à BP.shapes
     =================================================================================== */

  // Polygone de secours (octogone avec un petit trou) si BP.shapes n'est pas chargé.
  var FALLBACK = (function () {
    var outer = [], hole = [], i, a;
    for (i = 0; i < 8; i++) { a = i / 8 * TAU; outer.push([Math.cos(a) * 30, Math.sin(a) * 24]); }
    for (i = 0; i < 6; i++) { a = i / 6 * TAU; hole.push([Math.cos(a) * 9, Math.sin(a) * 8]); }
    return { id: '?', name: 'découpe', polys: [outer, hole], w: 60, h: 48 };
  })();

  var shapeCache = {};

  /** Renvoie la découpe `id`, ou un polygone de secours (jamais null). */
  function getShape(id) {
    if (shapeCache[id]) return shapeCache[id];
    var s = null;
    if (BP.shapes && isFn(BP.shapes.get)) { try { s = BP.shapes.get(id); } catch (e) { s = null; } }
    if (!s || !s.polys || !s.polys.length) {
      s = { id: id || '?', name: (id || FALLBACK.name), polys: FALLBACK.polys, w: FALLBACK.w, h: FALLBACK.h };
    }
    shapeCache[id] = s;
    return s;
  }

  /** Construit le tracé d'une découpe dans le contexte courant (sans remplir). */
  function pathShape(ctx, shape) {
    ctx.beginPath();
    if (BP.shapes && isFn(BP.shapes.path)) {
      try { BP.shapes.path(ctx, shape); return; } catch (e) { ctx.beginPath(); }
    }
    var ps = shape.polys, i, j, p;
    for (i = 0; i < ps.length; i++) {
      p = ps[i];
      if (!p || p.length < 2) continue;
      ctx.moveTo(p[0][0], p[0][1]);
      for (j = 1; j < p.length; j++) ctx.lineTo(p[j][0], p[j][1]);
      ctx.closePath();
    }
  }

  /* ===================================================================================
     3. Modèle : pièces, lampes, projection
     =================================================================================== */

  var uidSeq = 1;

  var DEFAULT_LAMPS = [{ x: BP.DRAP_W / 2, y: BP.DRAP_H / 2, tint: 'warm' }];

  function lampsOf(level) {
    if (level && level.lamps && level.lamps.length) return level.lamps;
    return DEFAULT_LAMPS;
  }

  function tintIndex(lamps, tint) {
    for (var j = 0; j < lamps.length; j++) if (lamps[j].tint === tint) return j;
    return -1;
  }

  /** Normalise une description de pièce (solution ou pose) en pièce complète. */
  function makePiece(spec, uid) {
    return {
      uid: uid || ('p' + (uidSeq++)),
      shape: spec.shape,
      sx: (spec.sx === undefined ? BP.DRAP_W / 2 : spec.sx),
      sy: (spec.sy === undefined ? BP.DRAP_H / 2 : spec.sy),
      depth: clamp(spec.depth | 0, 0, BP.DEPTHS.length - 1),
      rot: ((spec.rot || 0) % 360 + 360) % 360,
      tilt: clamp(spec.tilt | 0, 0, BP.TILTS.length - 1),
      flip: !!spec.flip,
      material: spec.material === 'oiled' ? 'oiled' : 'paper'
    };
  }

  /**
   * Matrice affine « local de la découpe -> coordonnées drap » sous la lampe j.
   * out = [a, b, c, d, e, f]  avec  X = a*px + c*py + e ; Y = b*px + d*py + f.
   * Strictement équivalente à BP.projectPoint (mêmes formules).
   */
  var MAT = new Float64Array(6);
  function pieceMatrix(piece, lamps, j, out) {
    var k = BP.scaleOf(piece.depth);
    var ft = (piece.flip ? -1 : 1) * BP.TILTS[piece.tilt];
    var a = piece.rot * DEG, co = Math.cos(a), si = Math.sin(a);
    var C = BP.shadowCenter(piece, lamps, j);
    out[0] = k * ft * co; out[1] = k * ft * si;
    out[2] = -k * si; out[3] = k * co;
    out[4] = C.x; out[5] = C.y;
    return out;
  }

  /** Étendue de l'ombre principale autour de son centre : {minx, miny, maxx, maxy}. */
  var extentBuf = { minx: 0, miny: 0, maxx: 0, maxy: 0 };
  function shadowExtent(piece, lamps, out) {
    out = out || extentBuf;
    var sh = getShape(piece.shape);
    pieceMatrix(piece, lamps, 0, MAT);
    var a = MAT[0], b = MAT[1], c = MAT[2], d = MAT[3];
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    var ps = sh.polys, i, q, p, x, y;
    for (i = 0; i < ps.length; i++) {
      p = ps[i]; if (!p) continue;
      for (q = 0; q < p.length; q++) {
        x = a * p[q][0] + c * p[q][1];
        y = b * p[q][0] + d * p[q][1];
        if (x < minx) minx = x; if (x > maxx) maxx = x;
        if (y < miny) miny = y; if (y > maxy) maxy = y;
      }
    }
    if (minx === Infinity) { minx = miny = -10; maxx = maxy = 10; }
    out.minx = minx; out.miny = miny; out.maxx = maxx; out.maxy = maxy;
    return out;
  }

  /** Contraint le centre pour que l'ombre principale reste sur le drap (marge). */
  var CLAMP_MARGIN = 4;
  function clampPiece(piece, lamps) {
    var e = shadowExtent(piece, lamps, extentBuf);
    var m = CLAMP_MARGIN;
    var loX = m - e.minx, hiX = BP.DRAP_W - m - e.maxx;
    var loY = m - e.miny, hiY = BP.DRAP_H - m - e.maxy;
    piece.sx = (loX > hiX) ? (BP.DRAP_W / 2 - (e.minx + e.maxx) / 2) : clamp(piece.sx, loX, hiX);
    piece.sy = (loY > hiY) ? (BP.DRAP_H / 2 - (e.miny + e.maxy) / 2) : clamp(piece.sy, loY, hiY);
  }

  function snapGrid(v) { return Math.round(v / BP.GRID) * BP.GRID; }

  /**
   * Snap sur la grille, mais relativement au « réseau » de la pièce : si une pièce a été
   * posée hors grille (configuration de départ d'une représentation, niveau généré), elle
   * reste atteignable exactement. Pour une pièce déjà sur la grille, c'est le snap normal.
   */
  function snapTo(v, lattice) { return Math.round((v - lattice) / BP.GRID) * BP.GRID + lattice; }
  function latticeOf(v) { return v - snapGrid(v); }

  /* ===================================================================================
     4. Masques et score
     =================================================================================== */

  var maskCanvas = null, maskCtx = null;
  var MSX = BP.MASK_W / BP.DRAP_W, MSY = BP.MASK_H / BP.DRAP_H;

  function ensureMaskCanvas() {
    if (maskCanvas) return;
    maskCanvas = document.createElement('canvas');
    maskCanvas.width = BP.MASK_W; maskCanvas.height = BP.MASK_H;
    try { maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true }); }
    catch (e) { maskCtx = maskCanvas.getContext('2d'); }
  }

  /** Rend le masque (0..1 par pixel) des pièces sous la lampe j. */
  function renderMask(pieces, lamps, j, out) {
    ensureMaskCanvas();
    var c = maskCtx, n = BP.MASK_W * BP.MASK_H, i;
    if (!out || out.length !== n) out = new Float32Array(n);
    if (!c) { for (i = 0; i < n; i++) out[i] = 0; return out; }

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.fillStyle = '#000';
    c.fillRect(0, 0, BP.MASK_W, BP.MASK_H);
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = '#fff';

    for (i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      pieceMatrix(p, lamps, j, MAT);
      c.setTransform(MSX * MAT[0], MSY * MAT[1], MSX * MAT[2], MSY * MAT[3], MSX * MAT[4], MSY * MAT[5]);
      c.globalAlpha = (p.material === 'oiled') ? 0.5 : 1;
      pathShape(c, getShape(p.shape));
      c.fill('evenodd');
    }

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;

    var data;
    try { data = c.getImageData(0, 0, BP.MASK_W, BP.MASK_H).data; }
    catch (e) { for (i = 0; i < n; i++) out[i] = 0; return out; }
    for (i = 0; i < n; i++) out[i] = data[i * 4] / 255;
    return out;
  }

  /** Ensemble de masques { byLamp[], main, red, blue, umbra } ; réutilise les tampons. */
  function masksFor(pieces, lamps, store) {
    store = store || { byLamp: [] };
    if (!store.byLamp) store.byLamp = [];
    var j, n;
    for (j = 0; j < lamps.length; j++) store.byLamp[j] = renderMask(pieces, lamps, j, store.byLamp[j]);
    store.byLamp.length = lamps.length;
    store.main = store.byLamp[0] || null;
    var ri = tintIndex(lamps, 'red'), bi = tintIndex(lamps, 'blue');
    store.red = ri >= 0 ? store.byLamp[ri] : null;
    store.blue = bi >= 0 ? store.byLamp[bi] : null;
    if (store.red && store.blue) {
      n = store.red.length;
      if (!store.umbra || store.umbra.length !== n) store.umbra = new Float32Array(n);
      for (j = 0; j < n; j++) { var a = store.red[j], b = store.blue[j]; store.umbra[j] = a < b ? a : b; }
    } else {
      store.umbra = null;
    }
    return store;
  }

  function readingMask(store, name) {
    if (name === 'main') return store.main;
    if (name === 'red') return store.red || store.main;
    if (name === 'blue') return store.blue || store.main;
    if (name === 'umbra') return store.umbra || store.main;
    return store.main;
  }

  /** Score IoU souple : 1 - Σ|T-M| / max(Σ max(T,M), 1). */
  function iouScore(T, M) {
    if (!T || !M || T.length !== M.length) return 0;
    var d = 0, u = 0, i, t, m;
    for (i = 0; i < T.length; i++) {
      t = T[i]; m = M[i];
      d += t > m ? t - m : m - t;
      u += t > m ? t : m;
    }
    if (u < 1) u = 1;
    var s = 1 - d / u;
    return s < 0 ? 0 : (s > 1 ? 1 : s);
  }

  /* ===================================================================================
     5. État du moteur
     =================================================================================== */

  var E = new BP.Emitter();

  var S = {
    level: null,
    mode: 'story',
    lamps: DEFAULT_LAMPS,
    readings: ['main'],
    pieces: [],
    coffre: [],            // [{ index, shape, material, name, pieceUid }]
    selected: null,
    moves: 0,
    undoCount: 0,
    undo: [],
    score: 0,
    scores: {},
    status: 'playing',     // 'playing' | 'won' | 'lost'
    view: 'all',
    showTarget: true,
    bestStars: 0,
    rev: 0,                // compteur de révision du modèle (invalide les caches de rendu)
    beat: null,            // { index, remaining, total, scores:[] }
    perfPhase: 'prep'      // 'prep' | 'run' | 'over'  (mode représentation)
  };

  var curMasks = { byLamp: [] };
  var tgtMasks = { byLamp: [] };
  var targetPieces = [];      // pièces de la cible courante (solution ou beat)

  var opts = { reduceMotion: false, showSideView: true };

  var canvas = null, ctx = null, dpr = 1;
  var running = false, paused = false, initialised = false;
  var rafId = 0, lastTime = 0, clock = 0, sizeCheck = 0;

  /* ===================================================================================
     6. Mise en page (drap + coffre)
     =================================================================================== */

  var L = {
    w: 0, h: 0,                    // taille CSS du canvas
    drapX: 0, drapY: 0, drapW: 0, drapH: 0, scale: 1,
    coffre: { x: 0, y: 0, w: 0, h: 0, vertical: false },
    side: { x: 0, y: 0, w: 0, h: 0, on: false }
  };
  var slots = [];                  // rectangles des cases du coffre (réutilisés)
  var gradSheet = null, gradVign = null, gradHalo = null, gradSpill = null, gradWood = null;

  function computeLayout() {
    var w = L.w, h = L.h;
    var pad = clamp(Math.round(Math.min(w, h) * 0.022), 6, 18);
    var portrait = h >= w;
    var band;

    if (portrait) {
      // En portrait, le drap est limité par la largeur (il est 4:3) : le surplus de hauteur
      // profite d'abord au coffre (cibles tactiles confortables), le reste sert de coulisses
      // et laisse la place au HUD (DOM) posé par l'UI.
      var wDrapH = (w - pad * 2) * BP.DRAP_H / BP.DRAP_W;
      var rest = h - wDrapH - pad * 2;
      band = clamp(Math.round(rest * 0.5), 88, 260);
      if (band > h * 0.42) band = Math.round(h * 0.42);
      L.coffre.vertical = false;
      L.coffre.x = 0; L.coffre.y = h - band; L.coffre.w = w; L.coffre.h = band;
    } else {
      band = clamp(Math.round(w * 0.17), 96, 180);
      L.coffre.vertical = true;
      L.coffre.x = w - band; L.coffre.y = 0; L.coffre.w = band; L.coffre.h = h;
    }

    var availW = (portrait ? w : w - band) - pad * 2;
    var availH = (portrait ? h - band : h) - pad * 2;
    availW = Math.max(40, availW); availH = Math.max(30, availH);

    var s = Math.min(availW / BP.DRAP_W, availH / BP.DRAP_H);
    L.scale = s;
    L.drapW = BP.DRAP_W * s; L.drapH = BP.DRAP_H * s;
    L.drapX = pad + (availW - L.drapW) / 2;
    // Le drap remonte un peu en portrait : la place libre sous lui accueille le HUD (DOM).
    L.drapY = pad + (availH - L.drapH) * (portrait ? 0.34 : 0.5);

    // Vue de côté : de préférence dans les coulisses (sous le drap en portrait),
    // sinon dans le coin bas-gauche du drap.
    var sw = Math.min(L.drapW * 0.34, 168), sh2 = Math.min(L.drapH * 0.22, 82);
    L.side.on = !!opts.showSideView && L.drapW > 200 && L.drapH > 130;
    L.side.w = sw; L.side.h = sh2;
    // La vue de côté ne recouvre jamais le drap : elle vit dans les coulisses (sous le drap)
    // quand il y a de la place, sinon elle disparaît.
    var freeBelow = (portrait ? L.coffre.y : h) - (L.drapY + L.drapH);
    if (freeBelow >= 46) {
      sh2 = Math.min(sh2, freeBelow - 16);
      L.side.h = sh2;
      L.side.x = L.drapX; L.side.y = L.drapY + L.drapH + 8;
      L.side.inRoom = true;
    } else {
      L.side.on = false;
      L.side.inRoom = false;
    }

    gradSheet = gradVign = gradHalo = gradSpill = gradWood = null;
    bgDirty = true; coffreSig = null; umbraRev = -1;
    layoutCoffre();
    targetPathDirty = true;
  }

  function layoutCoffre() {
    var c = L.coffre, n = S.coffre.length, i;
    slots.length = 0;
    if (!n || c.w <= 0 || c.h <= 0) return;
    var pad = 6, cols, rows, iw = c.w - pad * 2, ih = c.h - pad * 2;

    if (c.vertical) {
      cols = 1; rows = n;
      if (ih / rows < 62 && n > 1) { cols = 2; rows = Math.ceil(n / 2); }
      if (ih / rows < 42 && n > 2) { cols = 3; rows = Math.ceil(n / 3); }
    } else {
      cols = n; rows = 1;
      if (iw / cols < 62 && n > 1) { rows = 2; cols = Math.ceil(n / 2); }
      if (iw / cols < 42 && n > 2) { rows = 3; cols = Math.ceil(n / 3); }
    }
    var sw = iw / cols, sh = ih / rows;
    // Les cartes gardent des proportions de découpe (jamais des rubans très allongés).
    var cw = Math.min(sw, sh * 1.5), ch = Math.min(sh, sw * 1.5);
    var offx = (sw - cw) / 2, offy = (sh - ch) / 2;
    for (i = 0; i < n; i++) {
      var col = i % cols, row = Math.floor(i / cols);
      slots.push({
        x: c.x + pad + col * sw + offx, y: c.y + pad + row * sh + offy,
        w: cw, h: ch, index: i
      });
    }
  }

  function worldToScreenX(x) { return L.drapX + x * L.scale; }
  function worldToScreenY(y) { return L.drapY + y * L.scale; }
  function screenToWorldX(x) { return (x - L.drapX) / L.scale; }
  function screenToWorldY(y) { return (y - L.drapY) / L.scale; }
  function inDrap(px, py) {
    return px >= L.drapX && px <= L.drapX + L.drapW && py >= L.drapY && py <= L.drapY + L.drapH;
  }

  /* ===================================================================================
     7. Texture de papier (générée une seule fois)
     =================================================================================== */

  var grainCanvas = null, grainPattern = null;

  function ensureGrain() {
    if (grainCanvas) return;
    var N = 128;
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = N; grainCanvas.height = N;
    var g = grainCanvas.getContext('2d');
    if (!g) { grainCanvas = null; return; }
    var img = g.createImageData(N, N), d = img.data, i, v;
    var rnd = BP.rng('grain-betes-de-papier');
    for (i = 0; i < N * N; i++) {
      // Bruit doux + quelques fibres plus marquées.
      v = 128 + (rnd() - 0.5) * 46;
      if (rnd() > 0.994) v -= 40;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  function grain(c) {
    if (grainPattern) return grainPattern;
    ensureGrain();
    if (!grainCanvas) return null;
    try { grainPattern = c.createPattern(grainCanvas, 'repeat'); } catch (e) { grainPattern = null; }
    return grainPattern;
  }

  /* ===================================================================================
     8. Vacillement de flamme (bruit lissé, sans allocation)
     =================================================================================== */

  var FLICK_N = 64;
  var flickA = new Float32Array(FLICK_N), flickB = new Float32Array(FLICK_N);
  (function () {
    var r = BP.rng('flamme'), i;
    for (i = 0; i < FLICK_N; i++) { flickA[i] = r() * 2 - 1; flickB[i] = r() * 2 - 1; }
  })();

  function smoothNoise(arr, t) {
    var x = t % FLICK_N; if (x < 0) x += FLICK_N;
    var i0 = Math.floor(x), i1 = (i0 + 1) % FLICK_N, f = x - i0;
    f = f * f * (3 - 2 * f);
    return arr[i0] * (1 - f) + arr[i1] * f;
  }

  var flickX = 0, flickY = 0, flickI = 1;
  function updateFlicker(t) {
    if (opts.reduceMotion) { flickX = 0; flickY = 0; flickI = 1; return; }
    flickX = smoothNoise(flickA, t * 0.9);
    flickY = smoothNoise(flickB, t * 0.75);
    flickI = 1 + smoothNoise(flickA, t * 1.7 + 11) * 0.06;
  }

  /* ===================================================================================
     9. Cible (fantôme) — chemins en coordonnées écran, recalculés à la demande
     =================================================================================== */

  var targetPaths = null;          // [{ lamp:j, path:Path2D }]
  var targetPathDirty = true;

  function buildTargetPaths() {
    targetPaths = [];
    targetPathDirty = false;
    if (!window.Path2D || !targetPieces.length) return;
    var lamps = S.lamps, j, i;
    for (j = 0; j < lamps.length; j++) {
      var pth = new Path2D();
      for (i = 0; i < targetPieces.length; i++) {
        addPieceToPath(pth, targetPieces[i], lamps, j);
      }
      targetPaths.push({ lamp: j, tint: lamps[j].tint, path: pth });
    }
  }

  /** Ajoute la silhouette d'une pièce (coordonnées écran CSS) à un Path2D. */
  function addPieceToPath(pth, piece, lamps, j) {
    var sh = getShape(piece.shape);
    pieceMatrix(piece, lamps, j, MAT);
    var a = MAT[0], b = MAT[1], c = MAT[2], d = MAT[3], e = MAT[4], f = MAT[5];
    var ps = sh.polys, i, q, p, wx, wy;
    for (i = 0; i < ps.length; i++) {
      p = ps[i]; if (!p || p.length < 2) continue;
      for (q = 0; q < p.length; q++) {
        wx = a * p[q][0] + c * p[q][1] + e;
        wy = b * p[q][0] + d * p[q][1] + f;
        if (q === 0) pth.moveTo(worldToScreenX(wx), worldToScreenY(wy));
        else pth.lineTo(worldToScreenX(wx), worldToScreenY(wy));
      }
      pth.closePath();
    }
  }

  /* ===================================================================================
     10. Palette
     =================================================================================== */

  var COL = {
    room: '#120c07',
    roomEdge: '#0a0705',
    sheet0: '#f2e2bb',
    sheet1: '#d9bf8c',
    sheetEdge: '#c2a374',
    ink: '#2a1c10',
    chalk: 'rgba(255,246,225,0.85)',
    amber: 'rgba(255,208,130,',
    red: '#8e1f28',
    blue: '#20386e',
    wood: '#241a12',
    wood2: '#1a120c',
    cream: '#efe1c2',
    creamEdge: '#c8b489',
    text: '#e8d9b8'
  };

  /* ===================================================================================
     11. Rendu
     =================================================================================== */

  // Le décor fixe (salle, drap, grain, vignette) est peint une fois par mise en page
  // dans un canvas hors écran : la boucle de rendu ne fait plus qu'un `drawImage`.
  var bgCanvas = null, bgCtx = null, bgDirty = true;

  function paintBackground() {
    var pw = Math.max(1, Math.round(L.w * dpr)), ph = Math.max(1, Math.round(L.h * dpr));
    if (!bgCanvas) { bgCanvas = document.createElement('canvas'); bgCtx = bgCanvas.getContext('2d'); }
    if (!bgCtx) return;
    if (bgCanvas.width !== pw || bgCanvas.height !== ph) { bgCanvas.width = pw; bgCanvas.height = ph; }
    var c = bgCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, L.w, L.h);
    paintRoomAndSheet(c);
    paintVignette(c);
    bgDirty = false;
  }

  function drawSheet(c) {
    if (bgDirty || !bgCanvas) paintBackground();
    if (bgCanvas) c.drawImage(bgCanvas, 0, 0, L.w, L.h);
    else paintRoomAndSheet(c);
    drawHalo(c);
  }

  function paintRoomAndSheet(c) {
    var x = L.drapX, y = L.drapY, w = L.drapW, h = L.drapH;

    // Fond de salle
    c.fillStyle = COL.room;
    c.fillRect(0, 0, L.w, L.h);

    // Débordement de lumière sur les murs de la salle
    if (!gradSpill) {
      gradSpill = c.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.36,
        x + w / 2, y + h / 2, Math.max(w, h) * 1.05);
      gradSpill.addColorStop(0, 'rgba(214,158,84,0.20)');
      gradSpill.addColorStop(0.45, 'rgba(160,106,52,0.10)');
      gradSpill.addColorStop(1, 'rgba(120,72,32,0)');
    }
    c.fillStyle = gradSpill;
    c.fillRect(0, 0, L.w, L.h);

    // Ombre portée du drap tendu
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.65)';
    c.shadowBlur = Math.max(8, Math.min(w, h) * 0.05);
    c.shadowOffsetY = Math.max(2, Math.min(w, h) * 0.012);
    c.fillStyle = '#000';
    c.fillRect(x, y, w, h);
    c.restore();

    // Le drap
    if (!gradSheet) {
      gradSheet = c.createRadialGradient(x + w * 0.5, y + h * 0.42, Math.min(w, h) * 0.06,
        x + w * 0.5, y + h * 0.5, Math.max(w, h) * 0.72);
      gradSheet.addColorStop(0, COL.sheet0);
      gradSheet.addColorStop(0.62, '#e2caa0');
      gradSheet.addColorStop(1, COL.sheet1);
    }
    c.fillStyle = gradSheet;
    c.fillRect(x, y, w, h);

    // Grain de papier
    var gp = grain(c);
    if (gp) {
      c.save();
      c.globalCompositeOperation = 'multiply';
      c.globalAlpha = 0.30;
      c.fillStyle = gp;
      c.fillRect(x, y, w, h);
      c.restore();
    }

  }

  function drawHalo(c) {
    var x = L.drapX, y = L.drapY, w = L.drapW, h = L.drapH;
    // Halo de lampe (chaud ou bicolore) — gradients construits une fois par mise en page,
    // l'intensité du vacillement passe par globalAlpha (aucune allocation par image).
    var lamps = S.lamps, j;
    if (!gradHalo) {
      gradHalo = [];
      for (j = 0; j < lamps.length; j++) {
        var lx = worldToScreenX(lamps[j].x), ly = worldToScreenY(lamps[j].y);
        var rr = Math.max(w, h) * (lamps.length > 1 ? 0.5 : 0.66);
        var g = c.createRadialGradient(lx, ly, 0, lx, ly, rr);
        var col = lamps[j].tint === 'red' ? '255,120,110' : (lamps[j].tint === 'blue' ? '110,150,255' : '255,206,138');
        g.addColorStop(0, 'rgba(' + col + ',1)');
        g.addColorStop(0.55, 'rgba(' + col + ',0.34)');
        g.addColorStop(1, 'rgba(' + col + ',0)');
        gradHalo.push(g);
      }
    }
    c.save();
    c.globalCompositeOperation = 'lighter';
    var inten = (lamps.length > 1 ? 0.13 : 0.20) * flickI;
    c.globalAlpha = inten;
    for (j = 0; j < gradHalo.length; j++) { c.fillStyle = gradHalo[j]; c.fillRect(x, y, w, h); }
    c.restore();
  }

  function paintVignette(c) {
    var x = L.drapX, y = L.drapY, w = L.drapW, h = L.drapH;
    if (!gradVign) {
      gradVign = c.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.30,
        x + w / 2, y + h / 2, Math.max(w, h) * 0.70);
      gradVign.addColorStop(0, 'rgba(60,40,20,0)');
      gradVign.addColorStop(1, 'rgba(48,30,14,0.34)');
    }
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = gradVign;
    c.fillRect(x, y, w, h);
    c.restore();

    // Bord du drap : ourlet + petite ombre portée
    c.save();
    c.lineWidth = 1.5;
    c.strokeStyle = 'rgba(90,64,34,0.55)';
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    c.restore();
  }

  /** Applique la transformation d'une pièce (coordonnées locales -> pixels device). */
  function setPieceTransform(c, piece, lamps, j, grow, offx, offy) {
    pieceMatrix(piece, lamps, j, MAT);
    var s = L.scale * dpr * (grow || 1);
    var ox = L.drapX * dpr, oy = L.drapY * dpr;
    var sg = L.scale * dpr;
    c.setTransform(
      MAT[0] * s, MAT[1] * s,
      MAT[2] * s, MAT[3] * s,
      ox + (MAT[4] + (offx || 0)) * sg,
      oy + (MAT[5] + (offy || 0)) * sg
    );
  }

  // Couleur de l'ombre d'une lampe : ce qui reste de lumière quand cette lampe est bloquée.
  function shadowColorFor(lamps, j, view) {
    if (lamps.length < 2) return '30,20,12';
    if (view === 'red' || view === 'blue' || view === 'umbra') return '26,16,10';
    // Deux lampes : bloquer la rouge laisse le bleu, et inversement.
    return lamps[j].tint === 'red' ? '52,74,150' : '150,52,48';
  }

  function drawShadows(c) {
    var lamps = S.lamps, view = S.view, i, j, p;
    var pieces = S.pieces;
    if (!pieces.length) return;

    // Quelles lampes contribuent à la vue courante ?
    var only = -1;
    if (view === 'red') only = tintIndex(lamps, 'red');
    else if (view === 'blue') only = tintIndex(lamps, 'blue');

    c.save();
    // Les ombres ne débordent jamais du drap.
    c.beginPath();
    c.rect(L.drapX, L.drapY, L.drapW, L.drapH);
    c.clip();
    c.globalCompositeOperation = 'multiply';

    var fx = flickX * 0.5, fy = flickY * 0.4;

    for (j = 0; j < lamps.length; j++) {
      if (only >= 0 && j !== only) continue;
      if (view === 'umbra' && lamps.length > 1) continue;  // traité plus bas
      var col = shadowColorFor(lamps, j, view);
      for (i = 0; i < pieces.length; i++) {
        p = pieces[i];
        var base = (p.material === 'oiled') ? 0.5 : 1;
        // Plus la découpe est près de la lampe, plus sa pénombre est large.
        var soft = 0.008 + (BP.scaleOf(p.depth) - 1) * 0.020;
        // 3 couches de pénombre, de la plus large à la plus serrée
        drawOneShadow(c, p, lamps, j, col, 1 + soft * 2.6, base * 0.09, fx * 2.4, fy * 2.4);
        drawOneShadow(c, p, lamps, j, col, 1 + soft * 1.5, base * 0.13, fx * 1.5, fy * 1.5);
        drawOneShadow(c, p, lamps, j, col, 1 + soft * 0.7, base * 0.19, fx * 0.8, fy * 0.8);
        // umbra
        drawOneShadow(c, p, lamps, j, col, 1.0, base * 0.88, 0, 0);
      }
    }

    // Vue « œil nu » à deux lampes ou lecture umbra : intersection uniquement.
    if (lamps.length > 1) {
      var ri = tintIndex(lamps, 'red'), bi = tintIndex(lamps, 'blue');
      // En vue normale, la superposition des deux ombres teintées (multiplication)
      // produit déjà l'umbra noire : le calque dédié n'est nécessaire qu'au verre neutre.
      if (ri >= 0 && bi >= 0 && view === 'umbra') {
        drawUmbraIntersection(c, pieces, lamps, ri, bi, 0.92);
      }
    }

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.restore();
  }

  function drawOneShadow(c, p, lamps, j, col, grow, alpha, offx, offy) {
    if (alpha <= 0.002) return;
    setPieceTransform(c, p, lamps, j, grow, offx, offy);
    c.globalAlpha = alpha;
    c.fillStyle = 'rgb(' + col + ')';
    pathShape(c, getShape(p.shape));
    c.fill('evenodd');
  }

  /**
   * Intersection des deux ombres (l'umbra noire). Réalisée par découpe :
   * on dessine l'ombre rouge dans un calque temporaire, on la coupe par l'ombre bleue.
   */
  var interCanvas = null, interCtx = null, maskCanvas2 = null, maskCtx2 = null;
  function ensureScratch(w, h) {
    if (!interCanvas) {
      interCanvas = document.createElement('canvas'); interCtx = interCanvas.getContext('2d');
      maskCanvas2 = document.createElement('canvas'); maskCtx2 = maskCanvas2.getContext('2d');
    }
    if (interCanvas.width !== w || interCanvas.height !== h) {
      interCanvas.width = w; interCanvas.height = h;
      maskCanvas2.width = w; maskCanvas2.height = h;
      umbraRev = -1;
    }
    return interCtx;
  }

  /** Dessine l'union des ombres des pièces sous la lampe j dans un contexte hors écran. */
  function paintUnion(g, pieces, lamps, j, w, h, sub) {
    var sg = L.scale * dpr * sub, i, p;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#000';
    for (i = 0; i < pieces.length; i++) {
      p = pieces[i];
      pieceMatrix(p, lamps, j, MAT);
      g.setTransform(MAT[0] * sg, MAT[1] * sg, MAT[2] * sg, MAT[3] * sg, MAT[4] * sg, MAT[5] * sg);
      g.globalAlpha = (p.material === 'oiled') ? 0.5 : 1;
      pathShape(g, getShape(p.shape));
      g.fill('evenodd');
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
  }

  var umbraRev = -1;

  var UMBRA_MAX = 512;   // l'intersection est une tache pleine : une demi-résolution suffit

  function drawUmbraIntersection(c, pieces, lamps, ri, bi, alpha) {
    var full = L.drapW * dpr;
    var sub = full > UMBRA_MAX ? UMBRA_MAX / full : 1;
    var w = Math.max(2, Math.round(L.drapW * dpr * sub));
    var h = Math.max(2, Math.round(L.drapH * dpr * sub));
    var ic = ensureScratch(w, h);
    if (!ic || !maskCtx2) return;

    // L'intersection ne dépend pas du vacillement : elle n'est repeinte qu'après
    // une modification des pièces (ou de la mise en page).
    if (umbraRev !== S.rev) {
      // Union des ombres rouges, puis découpe par l'union (et non pièce à pièce) des bleues.
      paintUnion(ic, pieces, lamps, ri, w, h, sub);
      paintUnion(maskCtx2, pieces, lamps, bi, w, h, sub);
      ic.globalCompositeOperation = 'destination-in';
      ic.drawImage(maskCanvas2, 0, 0);
      ic.globalCompositeOperation = 'source-over';
      umbraRev = S.rev;
    }

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = alpha;
    c.globalCompositeOperation = 'multiply';
    c.drawImage(interCanvas, 0, 0, w, h,
      Math.round(L.drapX * dpr), Math.round(L.drapY * dpr),
      Math.round(L.drapW * dpr), Math.round(L.drapH * dpr));
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1;
  }

  /** Voile coloré du verre teinté. */
  function drawGlassVeil(c) {
    var view = S.view;
    if (view === 'all') return;
    var x = L.drapX, y = L.drapY, w = L.drapW, h = L.drapH;
    c.save();
    c.globalCompositeOperation = 'multiply';
    if (view === 'red') c.fillStyle = 'rgba(196,74,64,0.30)';
    else if (view === 'blue') c.fillStyle = 'rgba(70,104,190,0.32)';
    else c.fillStyle = 'rgba(120,110,98,0.20)';
    c.fillRect(x, y, w, h);
    c.restore();

    // Cercle du verre, discret, en haut à droite du drap
    c.save();
    c.globalAlpha = 0.8;
    c.strokeStyle = view === 'red' ? 'rgba(190,90,80,0.7)' : (view === 'blue' ? 'rgba(110,140,220,0.7)' : 'rgba(230,220,196,0.5)');
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x + w - 22, y + 22, 10, 0, TAU);
    c.stroke();
    c.restore();
  }

  function drawTargetGhost(c, phase) {
    if (!S.showTarget || !targetPieces.length) return;
    if (targetPathDirty || !targetPaths) buildTargetPaths();
    if (!targetPaths || !targetPaths.length) return;
    var lamps = S.lamps, k, tp, col;

    c.save();
    c.beginPath();
    c.rect(L.drapX, L.drapY, L.drapW, L.drapH);
    c.clip();

    for (k = 0; k < targetPaths.length; k++) {
      tp = targetPaths[k];
      if (S.view === 'red' && tp.tint === 'blue') continue;
      if (S.view === 'blue' && tp.tint === 'red') continue;
      col = tp.tint === 'red' ? '150,46,44' : (tp.tint === 'blue' ? '46,70,150' : '90,66,40');
      if (phase === 'fill') {
        // Remplissage très léger, en multiplication : la teinte du papier est préservée.
        c.globalCompositeOperation = 'multiply';
        c.globalAlpha = lamps.length > 1 ? 0.18 : 0.24;
        c.fillStyle = 'rgb(' + col + ')';
        c.fill(tp.path, 'evenodd');
        c.globalCompositeOperation = 'source-over';
      } else {
        c.globalAlpha = 0.9;
        c.setLineDash(DASH);
        c.lineDashOffset = -clock * 8;
        c.lineWidth = L.scale < 1 ? 2 : 1.6;   // trait plus épais sur petit écran
        c.strokeStyle = lamps.length > 1 ? 'rgba(' + col + ',0.85)' : COL.chalk;
        c.stroke(tp.path);
        c.setLineDash(EMPTY_DASH);
      }
    }
    c.restore();
    c.globalAlpha = 1;
  }
  var DASH = [5, 4], EMPTY_DASH = [];

  function drawSelection(c) {
    if (!S.selected) return;
    var p = pieceByUid(S.selected);
    if (!p) return;
    var lamps = S.lamps;

    c.save();
    c.beginPath();
    c.rect(L.drapX - 2, L.drapY - 2, L.drapW + 4, L.drapH + 4);
    c.clip();
    // Liseré autour de l'ombre principale
    setPieceTransform(c, p, lamps, 0, 1.0, 0, 0);
    var sc = L.scale * dpr * BP.scaleOf(p.depth);
    c.lineWidth = Math.max(0.6, 2.2 * dpr / Math.max(0.001, sc));
    c.strokeStyle = 'rgba(255,214,140,0.95)';
    c.setLineDash(EMPTY_DASH);
    pathShape(c, getShape(p.shape));
    c.stroke();
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Poignée au centre de l'ombre
    var hx = worldToScreenX(p.sx), hy = worldToScreenY(p.sy);
    c.beginPath(); c.arc(hx, hy, 7, 0, TAU);
    c.fillStyle = 'rgba(26,17,10,0.55)'; c.fill();
    c.beginPath(); c.arc(hx, hy, 7, 0, TAU);
    c.lineWidth = 1.6; c.strokeStyle = 'rgba(255,214,140,0.95)'; c.stroke();
    c.beginPath(); c.arc(hx, hy, 2.2, 0, TAU);
    c.fillStyle = 'rgba(255,224,168,0.95)'; c.fill();

    // Petite étiquette de profondeur
    c.font = '11px Georgia, serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(40,26,14,0.8)';
    c.fillText(String(p.depth), hx, hy + 18);
    c.restore();
  }

  /* --- Coffre --------------------------------------------------------------------- */

  var coffreCanvas = null, coffreCtx = null, coffreSig = null;

  /** Signature bon marché : la vignette du coffre ne change qu'à la pose/au retrait. */
  function coffreSignature() {
    var s = L.coffre.x + '|' + L.coffre.y + '|' + L.coffre.w + '|' + L.coffre.h + '|' + slots.length + '|';
    for (var i = 0; i < S.coffre.length; i++) s += (S.coffre[i].pieceUid ? '1' : '0');
    return s;
  }

  function drawCoffre(c) {
    var b = L.coffre;
    if (b.w <= 0 || b.h <= 0) return;
    var sig = coffreSignature();
    var pw = Math.max(1, Math.round(b.w * dpr)), ph = Math.max(1, Math.round(b.h * dpr));
    if (!coffreCanvas) { coffreCanvas = document.createElement('canvas'); coffreCtx = coffreCanvas.getContext('2d'); }
    if (coffreCtx) {
      if (coffreCanvas.width !== pw || coffreCanvas.height !== ph) {
        coffreCanvas.width = pw; coffreCanvas.height = ph; coffreSig = null;
      }
      if (sig !== coffreSig) {
        var g2 = coffreCtx;
        g2.setTransform(dpr, 0, 0, dpr, -b.x * dpr, -b.y * dpr);
        g2.globalAlpha = 1; g2.globalCompositeOperation = 'source-over';
        g2.clearRect(b.x, b.y, b.w, b.h);
        paintCoffre(g2);
        coffreSig = sig;
      }
      c.drawImage(coffreCanvas, b.x, b.y, b.w, b.h);
      return;
    }
    paintCoffre(c);
  }

  function paintCoffre(c) {
    var b = L.coffre;

    // Panneau bois (gradient mis en cache)
    if (!gradWood) {
      gradWood = c.createLinearGradient(b.x, b.y, b.vertical ? b.x + b.w : b.x, b.vertical ? b.y : b.y + b.h);
      gradWood.addColorStop(0, COL.wood);
      gradWood.addColorStop(1, COL.wood2);
    }
    c.fillStyle = gradWood;
    c.fillRect(b.x, b.y, b.w, b.h);

    c.save();
    c.strokeStyle = 'rgba(120,88,52,0.5)';
    c.lineWidth = 1;
    c.beginPath();
    if (b.vertical) { c.moveTo(b.x + 0.5, b.y); c.lineTo(b.x + 0.5, b.y + b.h); }
    else { c.moveTo(b.x, b.y + 0.5); c.lineTo(b.x + b.w, b.y + 0.5); }
    c.stroke();
    c.restore();

    var i;
    for (i = 0; i < slots.length; i++) drawSlot(c, slots[i], S.coffre[i]);
  }

  function drawSlot(c, r, entry) {
    if (!entry) return;
    var used = entry.pieceUid !== null && entry.pieceUid !== undefined;
    var pad = 5;
    var x = r.x + pad, y = r.y + pad, w = r.w - pad * 2, h = r.h - pad * 2;
    if (w <= 4 || h <= 4) return;
    var nameH = h > 46 ? 13 : 0;
    var iw = w, ih = h - nameH;

    c.save();

    if (used) {
      // Case vide du coffre : la découpe est sur le drap.
      c.globalAlpha = 1;
      c.fillStyle = 'rgba(0,0,0,0.22)';
      roundRect(c, x, y, iw, ih, 4);
      c.fill();
      c.setLineDash([4, 4]);
      c.strokeStyle = 'rgba(150,116,68,0.45)';
      c.lineWidth = 1;
      roundRect(c, x + 0.5, y + 0.5, iw - 1, ih - 1, 4);
      c.stroke();
      c.setLineDash(EMPTY_DASH);
      c.globalAlpha = 0.32;
    } else {
      // Carte de papier
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.5)';
      c.shadowBlur = 6; c.shadowOffsetY = 2;
      c.fillStyle = COL.cream;
      roundRect(c, x, y, iw, ih, 4);
      c.fill();
      c.restore();
      c.strokeStyle = COL.creamEdge;
      c.lineWidth = 1;
      roundRect(c, x + 0.5, y + 0.5, iw - 1, ih - 1, 4);
      c.stroke();
    }

    // Silhouette de la découpe
    var sh = getShape(entry.shape);
    var ext = shapeExtent(sh);
    var m = 6;
    var s = Math.min((iw - m * 2) / Math.max(1, ext.w), (ih - m * 2) / Math.max(1, ext.h));
    c.save();
    c.translate(x + iw / 2, y + ih / 2);
    c.scale(s, s);
    c.translate(-ext.cx, -ext.cy);
    c.fillStyle = entry.material === 'oiled' ? (used ? 'rgba(58,42,26,0.4)' : 'rgba(58,42,26,0.42)') : (used ? '#8a7350' : '#3a2a19');
    pathShape(c, sh);
    c.fill('evenodd');
    c.restore();

    // Marque « huilé » : petite pastille translucide dans le coin
    if (entry.material === 'oiled') {
      c.save();
      c.globalAlpha = used ? 0.35 : 0.9;
      c.beginPath();
      c.arc(x + iw - 9, y + ih - 9, 4.5, 0, TAU);
      c.fillStyle = 'rgba(120,92,50,0.45)'; c.fill();
      c.lineWidth = 1; c.strokeStyle = 'rgba(120,92,50,0.8)'; c.stroke();
      c.restore();
    }

    // Nom
    if (nameH) {
      c.fillStyle = used ? 'rgba(200,180,150,0.5)' : COL.text;
      c.font = '10px Georgia, serif';
      c.textAlign = 'center'; c.textBaseline = 'top';
      if (entry._lab === undefined || entry._labW !== iw) {
        entry._lab = ellipsize(c, sh.name || entry.shape, iw);
        entry._labW = iw;
      }
      c.fillText(entry._lab, x + iw / 2, y + ih + 2);
    }

    c.restore();
  }

  function ellipsize(c, text, maxW) {
    if (c.measureText(text).width <= maxW) return text;
    var t = text;
    while (t.length > 1 && c.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  var extentCache = {};
  function shapeExtent(sh) {
    var key = sh.id || 'x';
    if (extentCache[key]) return extentCache[key];
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity, i, q, p;
    for (i = 0; i < sh.polys.length; i++) {
      p = sh.polys[i]; if (!p) continue;
      for (q = 0; q < p.length; q++) {
        if (p[q][0] < minx) minx = p[q][0]; if (p[q][0] > maxx) maxx = p[q][0];
        if (p[q][1] < miny) miny = p[q][1]; if (p[q][1] > maxy) maxy = p[q][1];
      }
    }
    if (minx === Infinity) { minx = miny = -10; maxx = maxy = 10; }
    var e = { w: maxx - minx, h: maxy - miny, cx: (minx + maxx) / 2, cy: (miny + maxy) / 2 };
    extentCache[key] = e;
    return e;
  }

  /* --- Vue de côté ----------------------------------------------------------------- */

  function drawSideView(c) {
    if (!L.side.on) return;
    var r = L.side;
    c.save();
    c.globalAlpha = 0.82;
    c.fillStyle = 'rgba(28,19,11,0.72)';
    roundRect(c, r.x, r.y, r.w, r.h, 5);
    c.fill();
    c.strokeStyle = 'rgba(160,124,70,0.45)';
    c.lineWidth = 1;
    c.stroke();

    var pad = 9;
    var x0 = r.x + pad, x1 = r.x + r.w - pad;
    var yc = r.y + r.h / 2;

    // Drap (à droite) et lampe (à gauche)
    c.strokeStyle = 'rgba(232,214,176,0.85)';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(x1, r.y + pad * 0.7); c.lineTo(x1, r.y + r.h - pad * 0.7); c.stroke();

    var lampCol = S.lamps.length > 1 ? ['rgba(216,90,80,0.95)', 'rgba(110,150,235,0.95)'] : ['rgba(255,206,138,0.95)'];
    var j;
    for (j = 0; j < S.lamps.length; j++) {
      var ly = yc + (S.lamps.length > 1 ? (j === 0 ? -7 : 7) : 0);
      c.fillStyle = lampCol[j] || lampCol[0];
      c.beginPath(); c.arc(x0, ly, 3.4, 0, TAU); c.fill();
    }

    // Plans de profondeur
    var d;
    for (d = 0; d < BP.DEPTHS.length; d++) {
      var t = BP.DEPTHS[d];
      var px = x0 + (x1 - x0) * t;
      c.strokeStyle = 'rgba(200,170,120,0.16)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(px, r.y + pad); c.lineTo(px, r.y + r.h - pad); c.stroke();
    }

    // Pièces posées
    var i;
    for (i = 0; i < S.pieces.length; i++) {
      var p = S.pieces[i];
      var px2 = x0 + (x1 - x0) * BP.DEPTHS[p.depth];
      var py = r.y + pad + (r.h - pad * 2) * clamp(p.sy / BP.DRAP_H, 0, 1);
      var sel = (p.uid === S.selected);
      c.strokeStyle = sel ? 'rgba(255,214,140,0.95)' : 'rgba(238,222,190,0.6)';
      c.lineWidth = sel ? 2.4 : 1.6;
      c.beginPath(); c.moveTo(px2, py - 4); c.lineTo(px2, py + 4); c.stroke();
    }

    c.fillStyle = 'rgba(226,208,172,0.6)';
    c.font = '9px Georgia, serif';
    c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText('profondeur', r.x + pad, r.y + 3);
    c.restore();
  }

  /* --- Représentation : barre de compte à rebours ---------------------------------- */

  function drawBeatBar(c) {
    if (!S.beat || S.perfPhase !== 'run') return;
    var b = S.beat;
    var w = L.drapW * 0.5, x = L.drapX + (L.drapW - w) / 2, y = L.drapY + 10, h = 4;
    var t = b.total > 0 ? clamp(b.remaining / b.total, 0, 1) : 0;
    c.save();
    c.globalAlpha = 0.85;
    c.fillStyle = 'rgba(60,40,20,0.28)';
    roundRect(c, x, y, w, h, h / 2); c.fill();
    c.fillStyle = t < 0.25 ? 'rgba(170,44,40,0.95)' : 'rgba(70,48,26,0.75)';
    roundRect(c, x, y, Math.max(2, w * t), h, h / 2); c.fill();
    c.font = '11px Georgia, serif';
    c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillStyle = 'rgba(60,42,22,0.8)';
    c.fillText('frappe ' + (b.index + 1) + ' / ' + (S.level.beats ? S.level.beats.length : 1), x + w / 2, y + h + 3);
    c.restore();
  }

  /* --- Fantôme de glisser depuis le coffre ------------------------------------------ */

  function drawDragGhost(c) {
    if (!drag.active || drag.kind !== 'coffre') return;
    var entry = S.coffre[drag.coffreIndex];
    if (!entry) return;
    var sh = getShape(entry.shape);
    var ext = shapeExtent(sh);
    var s = L.scale;
    c.save();
    c.globalAlpha = 0.55;
    c.translate(drag.px, drag.py - (drag.lift || 0));
    c.scale(s, s);
    c.translate(-ext.cx, -ext.cy);
    c.fillStyle = entry.material === 'oiled' ? 'rgba(40,28,16,0.5)' : 'rgba(40,28,16,0.85)';
    pathShape(c, sh);
    c.fill('evenodd');
    c.restore();
  }

  /* --- Frame complète --------------------------------------------------------------- */

  function render() {
    if (!ctx) return;
    var c = ctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    drawSheet(c);
    drawTargetGhost(c, 'fill');
    drawShadows(c);
    drawGlassVeil(c);
    drawTargetGhost(c, 'line');
    drawSelection(c);
    drawBeatBar(c);
    drawSideView(c);
    drawCoffre(c);
    drawDragGhost(c);
  }

  /* ===================================================================================
     12. Boucle
     =================================================================================== */

  function frame(t) {
    rafId = 0;
    if (!running) return;
    if (paused) { running = false; return; }   // la boucle pourra être relancée
    var dt = lastTime ? Math.min(0.1, (t - lastTime) / 1000) : 0;
    lastTime = t;
    clock += dt;
    // Filet de sécurité (navigateurs sans ResizeObserver, panneaux d'UI qui apparaissent) :
    // on vérifie la taille du canvas une fois toutes les 20 images.
    if ((sizeCheck = (sizeCheck + 1) % 20) === 0 &&
        (canvas.clientWidth !== L.w || canvas.clientHeight !== L.h) &&
        canvas.clientWidth > 0 && canvas.clientHeight > 0) resize();
    updateFlicker(clock);
    tickPerformance(dt);
    tickCurtain(dt);
    render();
    rafId = window.requestAnimationFrame(frame);
  }

  function startLoop() {
    if (running || paused || !ctx) return;
    running = true; lastTime = 0;
    rafId = window.requestAnimationFrame(frame);
  }
  function stopLoop() {
    running = false;
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
  }

  /* ===================================================================================
     13. Score, victoire, sauvegarde du résultat
     =================================================================================== */

  function recompute(emitScore) {
    if (!S.level) return;
    S.rev++;
    masksFor(S.pieces, S.lamps, curMasks);
    var reads = S.readings, i, name, sc, min = 1;
    var out = S.scores;
    for (name in out) delete out[name];
    for (i = 0; i < reads.length; i++) {
      name = reads[i];
      sc = iouScore(readingMask(tgtMasks, name), readingMask(curMasks, name));
      out[name] = sc;
      if (sc < min) min = sc;
    }
    if (!reads.length) min = 0;
    S.score = min;
    audioIntensity(min);
    if (paused) render();   // en pause, on garde l'image à jour
    if (emitScore !== false) E.emit('score', { score: S.score, scores: S.scores });
    checkWin();
  }

  function starsFor(score, moves, par) {
    if (score < BP.PASS) return 0;
    if (score < BP.GOLD) return 1;
    return (par && moves <= par) ? 3 : 2;
  }

  // Temps d'attente avant que le rideau ne tombe quand le seuil de réussite est franchi mais
  // que l'ombre peut encore être améliorée : le monteur doit pouvoir finir son geste (poser la
  // dernière pièce, la tourner) et viser l'ovation sans être interrompu. Toute manipulation
  // relance le compte ; l'ovation, elle, fait tomber le rideau tout de suite.
  var CURTAIN_SETTLE = 5;
  var curtainWait = 0;

  function checkWin() {
    if (!S.level || S.level.type === 'performance') return;
    if (S.status === 'won') return;
    if (S.score < BP.PASS) { curtainWait = 0; return; }
    if (S.score >= BP.GOLD) { finishTableau(); return; }
    curtainWait = CURTAIN_SETTLE;
  }

  /** Décompte du rideau (appelé par la boucle ; la pause le suspend d'elle-même). */
  function tickCurtain(dt) {
    if (curtainWait <= 0) return;
    curtainWait -= dt;
    if (curtainWait <= 0) { curtainWait = 0; finishTableau(); }
  }

  function finishTableau() {
    curtainWait = 0;
    if (!S.level || S.status === 'won') return;
    var stars = starsFor(S.score, S.moves, S.level.par);
    S.bestStars = stars;
    S.status = 'won';
    saveResult(S.score, stars, S.moves);
    sfx(S.score >= BP.GOLD ? 'gold' : 'success');
    E.emit('won', { score: S.score, stars: stars, moves: S.moves, par: S.level.par, level: S.level });
  }

  function saveResult(score, stars, moves) {
    if (!S.level || S.mode !== 'story') return;
    var id = S.level.id;
    if (!id) return;
    BP.save.set(function (d) {
      var r = d.levels[id] || (d.levels[id] = { best: 0, stars: 0, bestMoves: 0, done: false });
      if (score > (r.best || 0)) r.best = score;
      if (stars > (r.stars || 0)) r.stars = stars;
      if (!r.bestMoves || moves < r.bestMoves) r.bestMoves = moves;
      r.done = true;
    });
  }

  /* ===================================================================================
     14. Chargement d'un tableau
     =================================================================================== */

  function parseCoffre(list) {
    var out = [], i;
    list = list || [];
    for (i = 0; i < list.length; i++) {
      var raw = String(list[i]), material = 'paper', id = raw;
      var k = raw.indexOf(':');
      if (k >= 0) { id = raw.slice(0, k); material = (raw.slice(k + 1) === 'oiled') ? 'oiled' : 'paper'; }
      out.push({ index: i, key: raw, shape: id, material: material, pieceUid: null });
    }
    return out;
  }

  /** Trouve une entrée libre du coffre correspondant à (shape, material). */
  function takeCoffreEntry(shape, material) {
    var i;
    for (i = 0; i < S.coffre.length; i++) {
      var e = S.coffre[i];
      if (e.pieceUid === null && e.shape === shape && e.material === material) return e;
    }
    // Repli : même découpe, matière différente.
    for (i = 0; i < S.coffre.length; i++) {
      if (S.coffre[i].pieceUid === null && S.coffre[i].shape === shape) return S.coffre[i];
    }
    return null;
  }

  function setTarget(solution) {
    targetPieces.length = 0;
    var i, list = solution || [];
    for (i = 0; i < list.length; i++) targetPieces.push(makePiece(list[i], 't' + i));
    masksFor(targetPieces, S.lamps, tgtMasks);
    targetPathDirty = true;
  }

  function loadLevel(level, options) {
    if (!level) return;
    options = options || {};
    S.level = level;
    S.mode = options.mode || 'story';
    S.lamps = lampsOf(level);
    S.readings = (level.readings && level.readings.length) ? level.readings.slice() : ['main'];
    S.pieces = [];
    S.coffre = parseCoffre(level.coffre);
    S.selected = null;
    S.moves = 0;
    S.undoCount = 0;
    S.undo.length = 0;
    S.status = 'playing';
    S.bestStars = 0;
    curtainWait = 0;
    S.view = 'all';
    S.showTarget = true;
    S.beat = null;
    S.perfPhase = (level.type === 'performance') ? 'prep' : 'none';
    uidSeq = 1;

    setTarget(level.solution);

    // Représentation : la configuration de départ est posée d'office.
    if (level.type === 'performance' && level.solution) {
      var i;
      for (i = 0; i < level.solution.length; i++) {
        var spec = level.solution[i];
        var p = makePiece(spec);
        var e = takeCoffreEntry(p.shape, p.material);
        if (e) e.pieceUid = p.uid;
        clampPiece(p, S.lamps);
        S.pieces.push(p);
      }
    }

    if (canvas) resize(); else computeLayout();   // re-mesure (l'UI a pu changer la mise en page)
    emitUnlocks(level);
    recompute();
    E.emit('select', null);
    startLoop();
    if (paused) render();   // en pause, on montre tout de même le tableau chargé
  }

  function emitUnlocks(level) {
    var list = level.unlocks || [], i, fresh = [];
    var d = BP.save.get();
    for (i = 0; i < list.length; i++) if (!d.seen[list[i]]) fresh.push(list[i]);
    // Le marquage « vu » est fait par l'UI après le tutoriel ; le moteur se contente de signaler.
    for (i = 0; i < fresh.length; i++) E.emit('unlock', fresh[i]);
  }

  /* ===================================================================================
     15. Historique (undo)
     =================================================================================== */

  function snapshot() {
    var ps = [], i, p;
    for (i = 0; i < S.pieces.length; i++) {
      p = S.pieces[i];
      ps.push({ uid: p.uid, shape: p.shape, sx: p.sx, sy: p.sy, depth: p.depth, rot: p.rot, tilt: p.tilt, flip: p.flip, material: p.material });
    }
    var cf = [];
    for (i = 0; i < S.coffre.length; i++) cf.push(S.coffre[i].pieceUid);
    return { pieces: ps, coffre: cf, selected: S.selected, moves: S.moves };
  }

  function pushUndo() {
    S.undo.push(snapshot());
    if (S.undo.length > 120) S.undo.shift();
  }

  function restoreSnapshot(sn) {
    S.pieces = sn.pieces;
    var i;
    for (i = 0; i < S.coffre.length; i++) S.coffre[i].pieceUid = (i < sn.coffre.length ? sn.coffre[i] : null);
    S.selected = sn.selected;
    S.moves = sn.moves;
  }

  function countMove() {
    S.moves++;
    E.emit('move', { moves: S.moves });
  }

  /* ===================================================================================
     16. Actions
     =================================================================================== */

  function pieceByUid(uid) {
    for (var i = 0; i < S.pieces.length; i++) if (S.pieces[i].uid === uid) return S.pieces[i];
    return null;
  }

  function selectedPiece() { return S.selected ? pieceByUid(S.selected) : null; }

  function setSelected(uid) {
    if (S.selected === uid) return;
    S.selected = uid;
    E.emit('select', uid);
  }

  function coffreEntryOfPiece(uid) {
    for (var i = 0; i < S.coffre.length; i++) if (S.coffre[i].pieceUid === uid) return S.coffre[i];
    return null;
  }

  /** Pose la pièce du coffre `index` à (wx, wy) — centre du drap par défaut. */
  function placeFromCoffre(index, wx, wy) {
    var e = S.coffre[index];
    if (!e) { sfx('error'); return null; }
    if (e.pieceUid !== null) { sfx('error'); return null; }
    pushUndo();
    var p = makePiece({
      shape: e.shape,
      sx: snapGrid(wx === undefined ? BP.DRAP_W / 2 : wx),
      sy: snapGrid(wy === undefined ? BP.DRAP_H / 2 : wy),
      depth: 0, rot: 0, tilt: 0, flip: false, material: e.material
    });
    clampPiece(p, S.lamps);
    S.pieces.push(p);
    e.pieceUid = p.uid;
    setSelected(p.uid);
    countMove();
    sfx('place');
    E.emit('place', { uid: p.uid, shape: p.shape });
    recompute();
    return p;
  }

  function removePiece(uid) {
    var p = pieceByUid(uid);
    if (!p) { sfx('error'); return; }
    pushUndo();
    var e = coffreEntryOfPiece(uid);
    if (e) e.pieceUid = null;
    var i = S.pieces.indexOf(p);
    if (i >= 0) S.pieces.splice(i, 1);
    if (S.selected === uid) setSelected(null);
    countMove();
    sfx('remove');
    E.emit('remove', { uid: uid });
    recompute();
  }

  function actOnSelected(name, arg) {
    var p = selectedPiece();
    if (!p) { sfx('error'); return false; }
    var changed = false;
    switch (name) {
      case 'depth+':
        if (p.depth < BP.DEPTHS.length - 1) { pushUndo(); p.depth++; clampPiece(p, S.lamps); changed = true; sfx('depth'); E.emit('depth', { uid: p.uid, depth: p.depth }); }
        break;
      case 'depth-':
        if (p.depth > 0) { pushUndo(); p.depth--; clampPiece(p, S.lamps); changed = true; sfx('depth'); E.emit('depth', { uid: p.uid, depth: p.depth }); }
        break;
      case 'rot+':
      case 'rot-':
        pushUndo();
        p.rot = ((p.rot + (name === 'rot+' ? BP.ROT_STEP : -BP.ROT_STEP)) % 360 + 360) % 360;
        clampPiece(p, S.lamps);
        changed = true; sfx('rotate'); E.emit('rotate', { uid: p.uid, rot: p.rot });
        break;
      case 'tilt':
        pushUndo();
        p.tilt = (p.tilt + 1) % BP.TILTS.length;
        clampPiece(p, S.lamps);
        changed = true; sfx('tilt'); E.emit('tilt', { uid: p.uid, tilt: p.tilt });
        break;
      case 'flip':
        pushUndo();
        p.flip = !p.flip;
        clampPiece(p, S.lamps);
        changed = true; sfx('flip'); E.emit('flip', { uid: p.uid, flip: p.flip });
        break;
      case 'nudge':
        var dx = (arg && arg.dx) || 0, dy = (arg && arg.dy) || 0;
        if (!dx && !dy) return false;
        pushUndo();
        p.sx = p.sx + dx * BP.GRID;   // déplacement relatif : conserve le réseau de la pièce
        p.sy = p.sy + dy * BP.GRID;
        clampPiece(p, S.lamps);
        changed = true; sfx('pick'); E.emit('place', { uid: p.uid, nudge: true });
        break;
      case 'remove':
        removePiece(p.uid);
        return true;
    }
    if (changed) { countMove(); recompute(); }
    else if (name !== 'remove') sfx('error');
    return changed;
  }

  function undo() {
    if (!S.undo.length) { sfx('error'); return; }
    var sn = S.undo.pop();
    var prevSel = S.selected;
    restoreSnapshot(sn);
    S.undoCount++;
    sfx('undo');
    if (prevSel !== S.selected) E.emit('select', S.selected);
    E.emit('undo', { undoCount: S.undoCount });
    recompute();
  }

  function reset() {
    if (!S.level) return;
    S.pieces = [];
    S.coffre = parseCoffre(S.level.coffre);
    S.selected = null;
    S.moves = 0;
    S.undo.length = 0;
    if (S.level.type === 'performance' && S.level.solution) {
      var i;
      for (i = 0; i < S.level.solution.length; i++) {
        var p = makePiece(S.level.solution[i]);
        var e = takeCoffreEntry(p.shape, p.material);
        if (e) e.pieceUid = p.uid;
        clampPiece(p, S.lamps);
        S.pieces.push(p);
      }
    }
    layoutCoffre();
    sfx('undo');
    E.emit('select', null);
    E.emit('reset', {});
    recompute();
  }

  function selectNext() {
    if (!S.pieces.length) { setSelected(null); return; }
    var i = -1, k;
    for (k = 0; k < S.pieces.length; k++) if (S.pieces[k].uid === S.selected) { i = k; break; }
    var next = S.pieces[(i + 1) % S.pieces.length];
    setSelected(next.uid);
    sfx('select');
  }

  /* ===================================================================================
     17. Mode représentation
     =================================================================================== */

  function startCurtain() {
    if (!S.level || S.level.type !== 'performance') { sfx('error'); return; }
    var beats = S.level.beats || [];
    if (!beats.length) { sfx('error'); return; }
    S.perfPhase = 'run';
    S.status = 'playing';
    S.beat = { index: 0, remaining: beats[0].seconds || 8, total: beats[0].seconds || 8, scores: [] };
    setTarget(beats[0].solution);
    sfx('curtain');
    if (BP.audio && isFn(BP.audio.drum)) { try { BP.audio.drum(S.level.drum || 'performance'); } catch (e) { } }
    recompute();
  }

  function tickPerformance(dt) {
    if (S.perfPhase !== 'run' || !S.beat) return;
    var beats = S.level.beats || [];
    S.beat.remaining -= dt;
    if (S.beat.remaining > 0) return;

    // Fin du beat : on fige le score.
    recompute(false);
    var sc = S.score;
    S.beat.scores.push(sc);
    // Mémorise aussi les scores par lecture de cette frappe (pour l'épilogue et l'écran de fin).
    S.beat.readingScores = S.beat.readingScores || [];
    S.beat.readingScores.push(S.scores ? JSON.parse(JSON.stringify(S.scores)) : {});
    E.emit('beat', { index: S.beat.index, score: sc, scores: S.beat.scores.slice() });
    sfx('beat');

    var next = S.beat.index + 1;
    if (next < beats.length) {
      S.beat.index = next;
      S.beat.total = beats[next].seconds || 8;
      S.beat.remaining = S.beat.total;
      setTarget(beats[next].solution);
      recompute();
    } else {
      finishPerformance();
    }
  }

  function finishPerformance() {
    var list = S.beat ? S.beat.scores : [];
    var sum = 0, worst = 1, i;
    for (i = 0; i < list.length; i++) { sum += list[i]; if (list[i] < worst) worst = list[i]; }
    var avg = list.length ? sum / list.length : 0;
    S.perfPhase = 'over';
    S.beat.remaining = 0;
    S.score = avg;
    // Score moyen par lecture sur l'ensemble des frappes (objet {main|red|blue|umbra}).
    var rs = S.beat.readingScores || [], byReading = {}, r, k;
    for (r = 0; r < rs.length; r++) for (k in rs[r]) if (rs[r].hasOwnProperty(k)) byReading[k] = (byReading[k] || 0) + rs[r][k] / rs.length;
    S.scores = byReading;
    if (BP.audio && isFn(BP.audio.stopDrum)) { try { BP.audio.stopDrum(); } catch (e) { } }
    var ok = (avg >= BP.PASS && worst >= 0.75);
    if (ok) {
      var stars = starsFor(avg, S.moves, S.level.par);
      if (stars < 1) stars = 1;
      S.status = 'won';
      S.bestStars = stars;
      saveResult(avg, stars, S.moves);
      sfx(avg >= BP.GOLD ? 'gold' : 'success');
      E.emit('won', { score: avg, stars: stars, moves: S.moves, par: S.level.par, level: S.level, scores: byReading, beatScores: list.slice() });
    } else {
      S.status = 'lost';
      sfx('error');
      E.emit('lost', { scores: list.slice(), score: avg });
    }
    E.emit('score', { score: S.score, scores: S.scores });
  }

  /* ===================================================================================
     18. Test de survol (point dans polygone, règle evenodd)
     =================================================================================== */

  // Tampon réutilisé pour les points projetés.
  var hitBuf = new Float64Array(4096);

  function pieceHit(piece, wx, wy) {
    var sh = getShape(piece.shape);
    pieceMatrix(piece, S.lamps, 0, MAT);
    var a = MAT[0], b = MAT[1], c = MAT[2], d = MAT[3], e = MAT[4], f = MAT[5];
    var ps = sh.polys, i, q, p, n, inside = false;
    for (i = 0; i < ps.length; i++) {
      p = ps[i]; if (!p || p.length < 3) continue;
      n = p.length;
      if (n * 2 > hitBuf.length) hitBuf = new Float64Array(n * 2 * 2);
      for (q = 0; q < n; q++) {
        hitBuf[q * 2] = a * p[q][0] + c * p[q][1] + e;
        hitBuf[q * 2 + 1] = b * p[q][0] + d * p[q][1] + f;
      }
      var j2 = n - 1;
      for (q = 0; q < n; q++) {
        var xi = hitBuf[q * 2], yi = hitBuf[q * 2 + 1];
        var xj = hitBuf[j2 * 2], yj = hitBuf[j2 * 2 + 1];
        if ((yi > wy) !== (yj > wy)) {
          var xint = (xj - xi) * (wy - yi) / (yj - yi) + xi;
          if (wx < xint) inside = !inside;
        }
        j2 = q;
      }
    }
    return inside;
  }

  /** Pièce la plus « en avant » sous le point monde donné (ou null). */
  function pickPieceAt(wx, wy) {
    var i;
    for (i = S.pieces.length - 1; i >= 0; i--) {
      if (pieceHit(S.pieces[i], wx, wy)) return S.pieces[i];
    }
    // Tolérance : proximité de la poignée (doigt épais)
    var bestD = 18 / Math.max(0.0001, L.scale), best = null;
    for (i = S.pieces.length - 1; i >= 0; i--) {
      var p = S.pieces[i];
      var dx = p.sx - wx, dy = p.sy - wy, dd = Math.sqrt(dx * dx + dy * dy);
      if (dd < bestD) { bestD = dd; best = p; }
    }
    return best;
  }

  function slotAt(px, py) {
    for (var i = 0; i < slots.length; i++) {
      var r = slots[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
    }
    return -1;
  }

  /* ===================================================================================
     19. Entrées : pointeur, molette, clavier
     =================================================================================== */

  var drag = {
    active: false, kind: null, id: null,
    coffreIndex: -1, uid: null,
    offx: 0, offy: 0, latx: 0, laty: 0, px: 0, py: 0, snapshotTaken: false, movedLast: false,
    startX: 0, startY: 0, moved: false
  };

  function localPoint(ev) {
    var r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  var TOUCH_LIFT = 34;   // px CSS : hauteur à laquelle flotte la pièce au-dessus du doigt

  function onPointerDown(ev) {
    if (paused || !S.level) return;
    if (ev.button !== undefined && ev.button !== 0 && ev.pointerType === 'mouse') return;
    if (ev.cancelable) ev.preventDefault();
    canvas.focus && canvas.focus();
    var pt = localPoint(ev);
    drag.startX = pt.x; drag.startY = pt.y; drag.moved = false;
    drag.px = pt.x; drag.py = pt.y;
    drag.id = ev.pointerId;

    // Au doigt, ce que l'on tient flotte un peu au-dessus du point de contact pour rester visible.
    drag.lift = ev.pointerType === 'touch' ? TOUCH_LIFT : 0;

    var si = slotAt(pt.x, pt.y);
    if (si >= 0) {
      var e = S.coffre[si];
      if (!e || e.pieceUid !== null) { sfx('error'); return; }
      drag.active = true; drag.kind = 'coffre'; drag.coffreIndex = si;
      sfx('pick');
      E.emit('pick', { from: 'coffre', index: si, shape: e.shape });
      try { canvas.setPointerCapture(ev.pointerId); } catch (err) { }
      return;
    }

    // Hors du drap et hors du coffre (les coulisses) : on désélectionne, comme dans le vide du drap.
    if (!inDrap(pt.x, pt.y)) {
      if (S.selected) { setSelected(null); sfx('ui'); }
      return;
    }

    var wx = screenToWorldX(pt.x), wy = screenToWorldY(pt.y);
    var p = pickPieceAt(wx, wy);
    if (p) {
      if (S.selected !== p.uid) { setSelected(p.uid); sfx('select'); }
      drag.active = true; drag.kind = 'piece'; drag.uid = p.uid;
      drag.offx = p.sx - wx; drag.offy = p.sy - wy - drag.lift / L.scale;
      drag.latx = latticeOf(p.sx); drag.laty = latticeOf(p.sy);
      drag.snapshotTaken = false;
      E.emit('pick', { from: 'drap', uid: p.uid, shape: p.shape });
      try { canvas.setPointerCapture(ev.pointerId); } catch (err) { }
    } else {
      if (S.selected) { setSelected(null); sfx('ui'); }
    }
  }

  function onPointerMove(ev) {
    if (!drag.active || ev.pointerId !== drag.id) return;
    if (ev.cancelable) ev.preventDefault();
    var pt = localPoint(ev);
    drag.px = pt.x; drag.py = pt.y;
    var dx = pt.x - drag.startX, dy = pt.y - drag.startY;
    if (!drag.moved && (dx * dx + dy * dy) > 16) drag.moved = true;

    if (drag.kind === 'piece') {
      var p = pieceByUid(drag.uid);
      if (!p) return;
      if (!drag.snapshotTaken) { pushUndo(); drag.snapshotTaken = true; }
      var wx = screenToWorldX(pt.x) + drag.offx;
      var wy = screenToWorldY(pt.y) + drag.offy;
      p.sx = snapTo(wx, drag.latx);
      p.sy = snapTo(wy, drag.laty);
      clampPiece(p, S.lamps);
      S.rev++;
    }
  }

  function onPointerUp(ev) {
    if (!drag.active || (drag.id !== null && ev.pointerId !== drag.id)) return;
    if (ev.cancelable) ev.preventDefault();
    try { canvas.releasePointerCapture(ev.pointerId); } catch (err) { }
    var pt = localPoint(ev);

    if (drag.kind === 'coffre') {
      var idx = drag.coffreIndex;
      endDrag();
      if (!drag.movedLast || inDrap(pt.x, pt.y)) {
        if (inDrap(pt.x, pt.y)) placeFromCoffre(idx, screenToWorldX(pt.x), screenToWorldY(pt.y - drag.lift));
        else placeFromCoffre(idx);       // tap simple : pose au centre
      }
      return;
    }

    if (drag.kind === 'piece') {
      var changedPos = drag.snapshotTaken;
      var uid = drag.uid;
      endDrag();
      // Seule la position après aimantation décide : sur un petit écran, un pas de grille ne
      // représente que trois ou quatre pixels — exiger un « vrai » glisser rendrait la
      // correction fine impossible au doigt. Un simple tap laisse la pièce à sa case : rien
      // n'est compté.
      if (changedPos) {
        var sn = S.undo[S.undo.length - 1];
        var p = pieceByUid(uid);
        var same = sn && sameAtUid(sn, p);
        if (same) { S.undo.pop(); }
        else { countMove(); sfx('place'); E.emit('place', { uid: uid }); recompute(); }
      }
      return;
    }
    endDrag();
  }

  function sameAtUid(sn, p) {
    if (!p) return false;
    for (var i = 0; i < sn.pieces.length; i++) {
      if (sn.pieces[i].uid === p.uid) return sn.pieces[i].sx === p.sx && sn.pieces[i].sy === p.sy;
    }
    return false;
  }

  function endDrag() {
    drag.movedLast = drag.moved;
    drag.active = false; drag.kind = null; drag.id = null;
    drag.coffreIndex = -1; drag.uid = null; drag.snapshotTaken = false;
  }

  function onPointerCancel(ev) {
    if (!drag.active) return;
    if (drag.kind === 'piece' && drag.snapshotTaken) { var sn = S.undo.pop(); if (sn) restoreSnapshot(sn); }
    endDrag();
  }

  function onWheel(ev) {
    if (paused || !S.level) return;
    if (!S.selected) return;
    if (ev.cancelable) ev.preventDefault();
    actOnSelected(ev.deltaY < 0 ? 'depth+' : 'depth-');
  }

  function onTouchStart(ev) { if (ev.cancelable) ev.preventDefault(); }

  var KEYMAP = {
    'ArrowLeft': ['nudge', { dx: -1, dy: 0 }], 'ArrowRight': ['nudge', { dx: 1, dy: 0 }],
    'ArrowUp': ['nudge', { dx: 0, dy: -1 }], 'ArrowDown': ['nudge', { dx: 0, dy: 1 }]
  };

  function onKeyDown(ev) {
    if (paused || !S.level) return;
    var t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var k = ev.key, handled = true;

    if (KEYMAP[k]) { actOnSelected(KEYMAP[k][0], KEYMAP[k][1]); }
    else {
      switch (k.length === 1 ? k.toLowerCase() : k) {
        case 'w': case '+': case '=': actOnSelected('depth+'); break;
        case 's': case '-': actOnSelected('depth-'); break;
        case 'q': actOnSelected('rot-'); break;
        case 'e': actOnSelected('rot+'); break;
        case 't': actOnSelected('tilt'); break;
        case 'f': actOnSelected('flip'); break;
        case 'Delete': case 'Backspace': actOnSelected('remove'); break;
        case 'z': undo(); break;
        case 'r': reset(); break;
        case '1': setView('all'); break;
        case '2': setView('red'); break;
        case '3': setView('blue'); break;
        case '4': setView('umbra'); break;
        case 'Tab': selectNext(); break;
        case 'h': setShowTarget(!S.showTarget); break;
        case 'Escape': if (S.selected) setSelected(null); else handled = false; break;
        default: handled = false;
      }
    }
    if (handled && ev.cancelable) ev.preventDefault();
  }

  function setView(v) {
    if (v !== 'all' && v !== 'red' && v !== 'blue' && v !== 'umbra') return;
    if (S.view === v) return;
    S.view = v;
    sfx('ui');
    E.emit('view', v);
  }

  function setShowTarget(b) {
    S.showTarget = !!b;
    sfx('ui');
    E.emit('showTarget', S.showTarget);
  }

  /* ===================================================================================
     20. Dimensionnement du canvas
     =================================================================================== */

  function resize() {
    if (!canvas) return;
    var r = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width || canvas.clientWidth || 320));
    var h = Math.max(1, Math.round(r.height || canvas.clientHeight || 240));
    dpr = Math.min(3, window.devicePixelRatio || 1);
    var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    L.w = w; L.h = h;
    grainPattern = null;
    computeLayout();
    if (!running) render();
  }

  /* ===================================================================================
     21. Miniature de la cible (menus)
     =================================================================================== */

  function renderThumb(cv, level) {
    if (!cv || !level) return;
    var c = cv.getContext('2d');
    if (!c) return;
    var d = Math.min(3, window.devicePixelRatio || 1);
    var w = cv.clientWidth || cv.width / d || 120, h = cv.clientHeight || cv.height / d || 90;
    if (cv.clientWidth) {
      cv.width = Math.round(w * d); cv.height = Math.round(h * d);
    } else { d = 1; w = cv.width; h = cv.height; }
    c.setTransform(d, 0, 0, d, 0, 0);

    // Papier
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#efdfb8'); g.addColorStop(1, '#d8bf8e');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    ensureGrain();
    if (grainCanvas) {
      try {
        var pat = c.createPattern(grainCanvas, 'repeat');
        c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.2;
        c.fillStyle = pat; c.fillRect(0, 0, w, h); c.restore();
      } catch (e) { }
    }

    var lamps = lampsOf(level);
    var sol = level.solution || [];
    var sc = Math.min(w / BP.DRAP_W, h / BP.DRAP_H);
    var ox = (w - BP.DRAP_W * sc) / 2, oy = (h - BP.DRAP_H * sc) / 2;

    var i, j;
    c.save();
    c.globalCompositeOperation = 'multiply';
    for (j = 0; j < lamps.length; j++) {
      var col = lamps.length > 1
        ? (lamps[j].tint === 'red' ? 'rgba(52,74,150,0.85)' : 'rgba(150,52,48,0.85)')
        : 'rgba(38,26,16,0.92)';
      c.fillStyle = col;
      for (i = 0; i < sol.length; i++) {
        var p = makePiece(sol[i], 'th' + i);
        pieceMatrix(p, lamps, j, MAT);
        c.setTransform(
          MAT[0] * sc * d, MAT[1] * sc * d, MAT[2] * sc * d, MAT[3] * sc * d,
          (ox + MAT[4] * sc) * d, (oy + MAT[5] * sc) * d
        );
        c.globalAlpha = (p.material === 'oiled') ? 0.5 : 1;
        pathShape(c, getShape(p.shape));
        c.fill('evenodd');
      }
    }
    c.restore();
    c.setTransform(d, 0, 0, d, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';

    // Vignette légère
    var vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.68);
    vg.addColorStop(0, 'rgba(60,40,20,0)');
    vg.addColorStop(1, 'rgba(48,30,14,0.35)');
    c.fillStyle = vg; c.fillRect(0, 0, w, h);
  }

  /* ===================================================================================
     22. API publique
     =================================================================================== */

  var resizeObs = null;

  BP.engine = {

    init: function (cv) {
      if (initialised && cv === canvas) { resize(); return; }
      canvas = cv || document.getElementById('stage');
      if (!canvas) { console.error('[BP.engine] canvas introuvable'); return; }
      ctx = canvas.getContext('2d');
      if (!ctx) { console.error('[BP.engine] contexte 2d indisponible'); return; }
      initialised = true;

      var d = BP.save.get();
      opts.reduceMotion = !!d.settings.reduceMotion;
      opts.showSideView = d.settings.sideView !== false;

      canvas.style.touchAction = 'none';
      if (!canvas.hasAttribute('tabindex')) canvas.setAttribute('tabindex', '0');
      canvas.style.outline = 'none';

      canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp, { passive: false });
      window.addEventListener('pointercancel', onPointerCancel, { passive: false });
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchStart, { passive: false });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', resize);

      if (window.ResizeObserver) {
        try {
          resizeObs = new window.ResizeObserver(function () { resize(); });
          resizeObs.observe(canvas);
        } catch (e) { resizeObs = null; }
      }
      resize();
    },

    loadLevel: loadLevel,

    getState: function () {
      return {
        level: S.level,
        mode: S.mode,
        pieces: S.pieces,
        coffre: S.coffre,
        lamps: S.lamps,
        readings: S.readings,
        selected: S.selected,
        moves: S.moves,
        undoCount: S.undoCount,
        canUndo: S.undo.length > 0,
        score: S.score,
        scores: S.scores,
        stars: starsFor(S.score, S.moves, S.level ? S.level.par : 0),
        status: S.status,
        view: S.view,
        showTarget: S.showTarget,
        perfPhase: S.perfPhase,
        beat: S.beat ? { index: S.beat.index, remaining: S.beat.remaining, total: S.beat.total, scores: S.beat.scores } : null
      };
    },

    on: function (ev, fn) { E.on(ev, fn); return BP.engine; },
    off: function (ev, fn) { E.off(ev, fn); return BP.engine; },

    act: function (name, arg) {
      if (!S.level && name !== 'view') return;
      switch (name) {
        case 'depth+': case 'depth-': case 'rot+': case 'rot-':
        case 'tilt': case 'flip': case 'nudge': case 'remove':
          return actOnSelected(name, arg);
        case 'undo': return undo();
        case 'reset': return reset();
        case 'select':
          if (arg === null || arg === undefined) { setSelected(null); }
          else if (pieceByUid(arg)) { setSelected(arg); sfx('select'); }
          else sfx('error');
          return;
        case 'selectNext': return selectNext();
        case 'placeFromCoffre':
          return placeFromCoffre(arg | 0);
        case 'view': return setView(arg);
        case 'showTarget': return setShowTarget(arg === undefined ? !S.showTarget : !!arg);
        case 'curtain': return startCurtain();
        default:
          console.warn('[BP.engine] action inconnue :', name);
      }
    },

    setPaused: function (b) {
      var was = paused;
      paused = !!b;
      if (paused) { stopLoop(); return; }
      if (!was || !ctx) return;
      if (S.level) startLoop();
      if (!running) render();
    },

    setOptions: function (o) {
      if (!o) return;
      if (o.reduceMotion !== undefined) opts.reduceMotion = !!o.reduceMotion;
      if (o.showSideView !== undefined) opts.showSideView = !!o.showSideView;
      computeLayout();
      if (!running) render();
    },

    renderThumb: renderThumb,

    /** Utilitaire pur : masques d'une configuration (nouveaux tampons à chaque appel). */
    /** Accesseurs de diagnostic (tests) : mise en page courante et cartes du coffre, en px CSS. */
    _layout: function () { return { drapX: L.drapX, drapY: L.drapY, drapW: L.drapW, drapH: L.drapH, scale: L.scale, coffre: L.coffre, side: L.side }; },
    _coffreRects: function () { return slots.map(function (s) { return { x: s.x, y: s.y, w: s.w, h: s.h, index: s.index }; }); },

    computeMasks: function (pieces, lamps) {
      lamps = (lamps && lamps.length) ? lamps : DEFAULT_LAMPS;
      var norm = [], i;
      for (i = 0; i < (pieces || []).length; i++) norm.push(makePiece(pieces[i], 'm' + i));
      var st = masksFor(norm, lamps, { byLamp: [] });
      return { main: st.main, red: st.red, blue: st.blue, umbra: st.umbra };
    },

    /** Score d'une lecture entre deux masques (utile aux tests et au contenu). */
    scoreMasks: iouScore,

    /** Force un recalcul (utile après un changement externe). */
    refresh: function () { recompute(); },

    /** Rend une image immédiatement (hors boucle). */
    redraw: function () { render(); },

    starsFor: starsFor
  };

})(window.BP);
