/* CORE — rendu canvas. */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';

  var CFG = CORE.CFG, W = CORE.WORLD;

  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, Math.max(0, ((n >> 16) & 255) * k));
    var g = Math.min(255, Math.max(0, ((n >> 8) & 255) * k));
    var b = Math.min(255, Math.max(0, (n & 255) * k));
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  function hash(x, y) {
    var h = (x * 374761393 + y * 668265263) ^ 0;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  function draw(ctx, cv, g, dt) {
    var world = g.world, d = g.drill, layer = world.layer, T = CFG.TILE;
    var vw = cv.width / g.dpr, vh = cv.height / g.dpr;

    // --- camera ------------------------------------------------------------
    var tx = (d.x + CFG.DRILL_W / 2) * T - vw / 2;
    var ty = (d.y + CFG.DRILL_H / 2) * T - vh / 2.1;
    g.cam.x += (tx - g.cam.x) * Math.min(1, dt * 9);
    g.cam.y += (ty - g.cam.y) * Math.min(1, dt * 9);
    g.cam.x = Math.max(0, Math.min(world.w * T - vw, g.cam.x));
    g.cam.y = Math.max(-40, Math.min(world.h * T - vh, g.cam.y));

    var sx = 0, sy = 0;
    if (g.shake > 0) {
      sx = (Math.random() - 0.5) * g.shake;
      sy = (Math.random() - 0.5) * g.shake;
      g.shake = Math.max(0, g.shake - dt * 26);
    }
    var camX = Math.round(g.cam.x + sx), camY = Math.round(g.cam.y + sy);

    // --- fond ---------------------------------------------------------------
    var grd = ctx.createLinearGradient(0, 0, 0, vh);
    grd.addColorStop(0, layer.fog);
    grd.addColorStop(1, layer.bg);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.translate(-camX, -camY);

    var c0 = Math.max(0, Math.floor(camX / T)), c1 = Math.min(world.w - 1, Math.ceil((camX + vw) / T));
    var r0 = Math.max(0, Math.floor(camY / T)), r1 = Math.min(world.h - 1, Math.ceil((camY + vh) / T));
    var x, y, t, px, py;

    // --- blocs ---------------------------------------------------------------
    for (y = r0; y <= r1; y++) {
      for (x = c0; x <= c1; x++) {
        t = world.type[y * world.w + x];
        if (t === W.T.EMPTY) continue;
        px = x * T; py = y * T;
        var col;
        if (t === W.T.SOFT) col = layer.soft;
        else if (t === W.T.MED) col = layer.med;
        else if (t === W.T.HARD) col = layer.hard;
        else if (t === W.T.ORE) col = layer.ore;
        else if (t === W.T.BEDROCK) col = '#2b2b33';
        else if (t === W.T.SEAL) col = '#b04a5e';
        else col = '#4a4f8a';

        var v = 0.86 + hash(x, y) * 0.28;
        ctx.fillStyle = shade(col, v);
        ctx.fillRect(px, py, T, T);

        // relief
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(px, py, T, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(px, py + T - 2, T, 2);

        if (t === W.T.ORE) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(px + 5, py + 5, 4, 4);
          ctx.fillRect(px + T - 9, py + T - 10, 3, 3);
        }
      }
    }

    // --- bonus enfouis : ils doivent attirer -------------------------------
    var pulse = 0.55 + 0.45 * Math.sin(g.time * 4);
    world.items.forEach(function (item, idx) {
      var ix = idx % world.w, iy = (idx / world.w) | 0;
      if (ix < c0 - 1 || ix > c1 + 1 || iy < r0 - 1 || iy > r1 + 1) return;
      var color = item.kind === W.KIND.BONUS ? item.bonus.color
        : (item.kind === W.KIND.PEPITE ? '#ffd24a' : '#5ff0e0');
      px = ix * T + T / 2; py = iy * T + T / 2;
      var rg = ctx.createRadialGradient(px, py, 1, px, py, T * 1.5);
      rg.addColorStop(0, color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.22 + 0.3 * pulse;
      ctx.fillStyle = rg;
      ctx.fillRect(px - T * 1.5, py - T * 1.5, T * 3, T * 3);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(px - 3, py - 3, 6, 6);
    });

    // --- cellules en cours de forage ---------------------------------------
    if (d.drilling) {
      var stats = g.stats;
      var cells = CORE.DRILL.targets(d, d.fx, d.fy, stats.width, stats.length);
      var hits = Math.max(1, Math.ceil(g.currentHard / Math.max(0.1, stats.force)));
      var frac = Math.min(1, d.prog / hits);
      for (var ci = 0; ci < cells.length; ci++) {
        var cx = cells[ci][0], cy = cells[ci][1];
        if (!world.inside(cx, cy)) continue;
        if (!W.DESTRUCTIBLE[world.type[world.idx(cx, cy)]]) continue;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.10 + frac * 0.35) + ')';
        ctx.fillRect(cx * T, cy * T, T, T);
        ctx.strokeStyle = 'rgba(0,0,0,' + (0.2 + frac * 0.5) + ')';
        ctx.lineWidth = 1 + frac * 2;
        ctx.beginPath();
        ctx.moveTo(cx * T + 3, cy * T + T - 4);
        ctx.lineTo(cx * T + T * 0.5, cy * T + 4);
        ctx.lineTo(cx * T + T - 3, cy * T + T - 5);
        ctx.stroke();
      }
    }

    // --- sortie --------------------------------------------------------------
    var ex = world.exitX * T, ey = world.exitRow * T;
    var ew = world.exitW * T;
    ctx.fillStyle = world.locked ? 'rgba(255,90,110,' + (0.25 + 0.2 * pulse) + ')'
      : 'rgba(120,255,180,' + (0.20 + 0.25 * pulse) + ')';
    ctx.fillRect(ex, ey - 6, ew, T + 12);
    ctx.strokeStyle = world.locked ? '#ff5a6e' : '#78ffb4';
    ctx.lineWidth = 2;
    ctx.strokeRect(ex + 1, ey - 5, ew - 2, T + 10);

    // --- pickups au sol -------------------------------------------------------
    for (var pi = 0; pi < g.pickups.length; pi++) {
      var p = g.pickups[pi];
      var s2 = 5 + Math.sin(g.time * 6 + pi) * 1.5;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * T, p.y * T, s2 + 3, 0, 6.284);
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.x * T, p.y * T, s2, 0, 6.284);
      ctx.fill();
      if (p.label) {
        ctx.fillStyle = '#0d0d10';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.label, p.x * T, p.y * T + 3);
      }
    }
    ctx.textAlign = 'left';

    // --- particules ------------------------------------------------------------
    for (var qi = 0; qi < g.parts.length; qi++) {
      var q = g.parts[qi];
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x * T, q.y * T, q.s, q.s);
    }
    ctx.globalAlpha = 1;

    // --- la foreuse ---------------------------------------------------------
    drawDrill(ctx, g, T);

    ctx.restore();

    // --- obscurite -------------------------------------------------------------
    var dark = layer.dark + (g.stats.visionPenalty || 0);
    if (dark > 0.01) {
      var dx = (d.x + CFG.DRILL_W / 2) * T - camX;
      var dy = (d.y + CFG.DRILL_H / 2) * T - camY;
      var rad = g.stats.vision * T;
      var vg = ctx.createRadialGradient(dx, dy, rad * 0.25, dx, dy, rad);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,' + Math.min(0.94, dark * 3.6) + ')');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, vw, vh);
    }

    // --- surchauffe (4 bonus et plus) --------------------------------------
    if (g.buffs.filter(function (b) { return !b.def.stun && !b.malus; }).length >= 3) {
      ctx.fillStyle = 'rgba(255,140,60,' + (0.05 + 0.05 * pulse) + ')';
      ctx.fillRect(0, 0, vw, vh);
    }
  }

  function drawDrill(ctx, g, T) {
    var d = g.drill;
    var cx = (d.x + CFG.DRILL_W / 2) * T;
    var cy = (d.y + CFG.DRILL_H / 2) * T;
    var ang = Math.atan2(d.fy, d.fx);

    ctx.save();
    ctx.translate(cx, cy);

    // halo turbo
    if (d.turboT > 0) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ffb03d';
      ctx.beginPath();
      ctx.arc(0, 0, T * 1.6, 0, 6.284);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.rotate(ang);
    // chassis
    ctx.fillStyle = '#3a4048';
    ctx.fillRect(-T * 0.95, -T * 0.9, T * 1.9, T * 1.8);
    ctx.fillStyle = '#565f6b';
    ctx.fillRect(-T * 0.85, -T * 0.8, T * 1.5, T * 1.6);
    ctx.fillStyle = '#ffcf5c';
    ctx.fillRect(-T * 0.5, -T * 0.35, T * 0.7, T * 0.7);
    // chenilles
    ctx.fillStyle = '#22262c';
    ctx.fillRect(-T * 0.95, -T * 0.95, T * 1.9, T * 0.22);
    ctx.fillRect(-T * 0.95, T * 0.73, T * 1.9, T * 0.22);
    // tete de forage
    var spin = Math.sin(d.bit) * 0.5 + 0.5;
    ctx.fillStyle = d.rotT > 0 ? '#7a7f88' : '#d8dde4';
    ctx.beginPath();
    ctx.moveTo(T * 0.85, -T * 0.62);
    ctx.lineTo(T * 1.55 + spin * 3, 0);
    ctx.lineTo(T * 0.85, T * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(T * 0.9, -T * 0.5 + spin * T * 0.4, T * 0.5, 3);
    ctx.restore();
  }

  CORE.RENDER = { draw: draw };
})(window.CORE);
