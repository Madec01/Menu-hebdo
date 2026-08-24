/* CORE — rendu canvas. */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';

  var CFG = CORE.CFG, W = CORE.WORLD;

  var TYPE_COLOR = {};   // rempli par couche a chaque frame

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

  /* Ce que les bonus actifs font a l'allure de la foreuse. */
  function drillLook(g) {
    var look = { head: '#d8dde4', scale: 1, len: 1, trail: 0, flames: false, arcs: false, glow: null };
    g.buffs.forEach(function (b) {
      var id = b.def.id;
      if (id === 'B-02') { look.head = '#ff5340'; look.scale = 1.15 + b.level * 0.14; look.glow = '#ff4d5e'; }
      if (id === 'B-01' || id === 'B-09') { look.trail = Math.max(look.trail, b.level); look.glow = look.glow || '#ff8a3d'; }
      if (id === 'B-20') { look.flames = true; look.glow = look.glow || '#4ad9ff'; }
      if (id === 'B-05') look.arcs = true;
      if (id === 'M-01' || id === 'M-02') look.head = '#7a6a58';
    });
    look.width = Math.max(2, g.stats.width) / 2;
    look.len = 1 + (Math.max(1, g.stats.length) - 1) * 0.45;
    return look;
  }

  function draw(ctx, cv, g, dt) {
    var world = g.world, d = g.drill, layer = world.layer, T = CFG.TILE;
    var vw = cv.width / g.dpr, vh = cv.height / g.dpr;

    TYPE_COLOR[W.T.SOFT] = layer.soft;
    TYPE_COLOR[W.T.MED] = layer.med;
    TYPE_COLOR[W.T.HARD] = layer.hard;
    TYPE_COLOR[W.T.ORE] = layer.ore;
    TYPE_COLOR[W.T.BEDROCK] = '#2b2b33';
    TYPE_COLOR[W.T.SEAL] = '#b04a5e';
    TYPE_COLOR[W.T.LOCK] = '#4a4f8a';
    TYPE_COLOR[W.T.FRIABLE] = '#a08256';
    TYPE_COLOR[W.T.CHARBON] = '#2f3138';
    TYPE_COLOR[W.T.CRISTAL] = '#b98dff';
    TYPE_COLOR[W.T.COFFRE] = '#c8912f';
    TYPE_COLOR[W.T.REBOND] = '#3fa9a0';
    TYPE_COLOR[W.T.GLUANTE] = '#5f7a3a';

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
    var pulse = 0.55 + 0.45 * Math.sin(g.time * 4);

    // --- blocs ---------------------------------------------------------------
    for (y = r0; y <= r1; y++) {
      for (x = c0; x <= c1; x++) {
        t = world.type[y * world.w + x];
        if (t === W.T.EMPTY) continue;
        px = x * T; py = y * T;
        var col = TYPE_COLOR[t] || layer.med;
        var v = 0.86 + hash(x, y) * 0.28;
        ctx.fillStyle = shade(col, v);
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(px, py, T, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(px, py + T - 2, T, 2);

        if (t === W.T.ORE) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(px + 5, py + 5, 4, 4);
          ctx.fillRect(px + T - 9, py + T - 10, 3, 3);
        } else if (t === W.T.CRISTAL) {
          ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + pulse * 0.25) + ')';
          ctx.beginPath();
          ctx.moveTo(px + T / 2, py + 3); ctx.lineTo(px + T - 4, py + T / 2);
          ctx.lineTo(px + T / 2, py + T - 3); ctx.lineTo(px + 4, py + T / 2);
          ctx.closePath(); ctx.fill();
        } else if (t === W.T.CHARBON) {
          ctx.fillStyle = 'rgba(255,120,50,' + (0.25 + pulse * 0.2) + ')';
          ctx.fillRect(px + 6, py + 6, T - 12, T - 12);
        } else if (t === W.T.COFFRE) {
          ctx.fillStyle = '#ffd24a';
          ctx.fillRect(px + 3, py + 6, T - 6, T - 11);
          ctx.fillStyle = '#6b4a12';
          ctx.fillRect(px + T / 2 - 2, py + 9, 4, 5);
        } else if (t === W.T.REBOND) {
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(px + T / 2, py + T / 2, T * 0.3, 0, 6.284); ctx.stroke();
        } else if (t === W.T.GLUANTE) {
          ctx.fillStyle = 'rgba(160,220,110,0.28)';
          ctx.beginPath(); ctx.arc(px + T / 2, py + T / 2, T * 0.34, 0, 6.284); ctx.fill();
        }
      }
    }

    // --- objets enfouis : ils doivent attirer -------------------------------
    world.items.forEach(function (item, idx) {
      var ix = idx % world.w, iy = (idx / world.w) | 0;
      if (ix < c0 - 1 || ix > c1 + 1 || iy < r0 - 1 || iy > r1 + 1) return;
      var color = item.kind === W.KIND.BONUS ? item.bonus.color
        : (item.kind === W.KIND.PEPITE ? '#ffd24a'
          : (item.kind === W.KIND.CARBURANT ? '#8ac46a' : '#5ff0e0'));
      // plus on est pres, plus ca pulse vite : on doit le desirer avant de l'avoir
      var dd = Math.abs(ix - d.x) + Math.abs(iy - d.y);
      var sp = dd < 8 ? 11 : 4;
      var pl = 0.55 + 0.45 * Math.sin(g.time * sp + idx * 0.7);
      px = ix * T + T / 2; py = iy * T + T / 2;
      var rr = T * (dd < 8 ? 2.1 : 1.5);
      var rg = ctx.createRadialGradient(px, py, 1, px, py, rr);
      rg.addColorStop(0, color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.22 + 0.32 * pl;
      ctx.fillStyle = rg;
      ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
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
      var frenzy = g.buffs.some(function (b) { return b.def.id === 'B-01' || b.def.id === 'B-09'; });
      for (var ci = 0; ci < cells.length; ci++) {
        var cx = cells[ci][0], cy = cells[ci][1];
        if (!world.inside(cx, cy)) continue;
        if (!W.DESTRUCTIBLE[world.type[world.idx(cx, cy)]]) continue;
        ctx.fillStyle = frenzy
          ? 'rgba(255,180,80,' + (0.14 + frac * 0.4) + ')'
          : 'rgba(255,255,255,' + (0.10 + frac * 0.35) + ')';
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

    // --- plafond qui descend --------------------------------------------------
    if ((world.def.ceiling || (g.event && g.event.id === 'eboulement')) && world.ceilingRow > world.top) {
      var cyPx = world.ceilingRow * T;
      ctx.fillStyle = 'rgba(200,70,70,' + (0.25 + pulse * 0.2) + ')';
      ctx.fillRect(0, cyPx, world.w * T, 5);
    }

    // --- passages du dedale : ils laissent filtrer la lumiere ----------------
    if (world.gaps) {
      for (var gi = 0; gi < world.gaps.length; gi++) {
        var gp = world.gaps[gi];
        if (gp[1] < r0 - 30 || gp[1] > r1 + 30) continue;
        var gx = gp[0] * T, gy = gp[1] * T;
        var lg = ctx.createLinearGradient(gx, gy - T * 6, gx, gy + T * 8);
        lg.addColorStop(0, 'rgba(180,210,255,0)');
        lg.addColorStop(0.45, 'rgba(180,210,255,' + (0.16 + pulse * 0.10) + ')');
        lg.addColorStop(1, 'rgba(180,210,255,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(gx - T * 3, gy - T * 6, T * 6, T * 14);
      }
    }

    // --- sortie --------------------------------------------------------------
    var ex = world.exitX * T, ey = world.exitRow * T, ew = world.exitW * T;
    ctx.fillStyle = world.locked ? 'rgba(255,90,110,' + (0.25 + 0.2 * pulse) + ')'
      : 'rgba(120,255,180,' + (0.20 + 0.25 * pulse) + ')';
    ctx.fillRect(ex, ey - 6, ew, T + 12);
    ctx.strokeStyle = world.locked ? '#ff5a6e' : '#78ffb4';
    ctx.lineWidth = 2;
    ctx.strokeRect(ex + 1, ey - 5, ew - 2, T + 10);

    // --- fantome ---------------------------------------------------------------
    if (g.ghost) {
      var gi = Math.floor(g.levelTime / 0.08) * 2;
      if (gi + 1 < g.ghost.p.length) {
        var gx = g.ghost.p[gi] * T, gy = g.ghost.p[gi + 1] * T;
        ctx.globalAlpha = 0.32;
        ctx.fillStyle = '#7ec8ff';
        ctx.fillRect(gx, gy, CFG.DRILL_W * T, CFG.DRILL_H * T);
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#7ec8ff'; ctx.lineWidth = 1;
        ctx.strokeRect(gx, gy, CFG.DRILL_W * T, CFG.DRILL_H * T);
        ctx.globalAlpha = 1;
      }
    }

    // --- pickups au sol -------------------------------------------------------
    for (var pi = 0; pi < g.pickups.length; pi++) {
      var p = g.pickups[pi];
      var s2 = (p.near ? 7 : 5) + Math.sin(g.time * (p.near ? 12 : 6) + pi) * 1.8;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x * T, p.y * T, s2 + 5, 0, 6.284); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(p.x * T, p.y * T, s2, 0, 6.284); ctx.fill();
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

    drawDrill(ctx, g, T);
    ctx.restore();

    // --- obscurite -------------------------------------------------------------
    var dark = layer.dark + (g.event && g.event.id === 'coupure' ? 0.4 : 0);
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

    // --- reperage du filon revele ---------------------------------------------
    if (g.marker && g.marker.t > 0) drawMarker(ctx, g, camX, camY, vw, vh, T);

    // --- liseres : un par bonus actif -----------------------------------------
    var actifs = g.buffs.filter(function (b) { return !b.malus; });
    for (var bi = 0; bi < Math.min(4, actifs.length); bi++) {
      var bd = actifs[bi];
      var last = bd.t < 3;
      ctx.globalAlpha = (last ? 0.35 + 0.45 * Math.abs(Math.sin(g.time * 9)) : 0.55);
      ctx.strokeStyle = bd.def.color;
      ctx.lineWidth = 3;
      var in2 = 2 + bi * 5;
      ctx.strokeRect(in2, in2, vw - in2 * 2, vh - in2 * 2);
      ctx.globalAlpha = 1;
    }

    // --- panne seche ------------------------------------------------------------
    if (g.reserve) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(g.time * 6));
      ctx.strokeStyle = '#ff3b52'; ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, vw - 8, vh - 8);
      ctx.globalAlpha = 1;
    }

    // --- surchauffe --------------------------------------------------------------
    if (actifs.length >= 3) {
      ctx.fillStyle = 'rgba(255,140,60,' + (0.05 + 0.05 * pulse) + ')';
      ctx.fillRect(0, 0, vw, vh);
    }

    // --- flash et desaturation ----------------------------------------------------
    if (g.flash) {
      ctx.globalAlpha = (g.flash.t / g.flash.max) * 0.3;
      ctx.fillStyle = g.flash.color;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
    }
    if (g.desat > 0) {
      ctx.globalAlpha = g.desat * 0.5;
      ctx.fillStyle = '#8b93a1';
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
    }

    drawToasts(ctx, g, vw, vh);
  }

  function drawMarker(ctx, g, camX, camY, vw, vh, T) {
    var mx = g.marker.x * T - camX, my = g.marker.y * T - camY;
    var onScreen = mx > 0 && mx < vw && my > 0 && my < vh;
    ctx.save();
    if (onScreen) {
      ctx.strokeStyle = '#ffb03d'; ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(g.time * 6);
      ctx.beginPath();
      ctx.arc(mx, my, 26 + Math.sin(g.time * 4) * 5, 0, 6.284);
      ctx.stroke();
    } else {
      var cx = vw / 2, cy = vh / 2;
      var a = Math.atan2(my - cy, mx - cx);
      var r = Math.min(vw, vh) * 0.38;
      ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.rotate(a);
      ctx.fillStyle = '#ffb03d';
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(g.time * 6);
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* Le nom du bonus explose au centre, puis file vers son icone du HUD. */
  function drawToasts(ctx, g, vw, vh) {
    for (var i = 0; i < g.toasts.length; i++) {
      var t = g.toasts[i];
      var k = t.t / t.dur;
      ctx.save();
      if (t.big) {
        var scale, tx, ty, alpha;
        if (k < 0.3) {
          var e = k / 0.3;
          scale = 0.5 + e * 0.9; tx = vw / 2; ty = vh * 0.42; alpha = e;
        } else {
          var e2 = (k - 0.3) / 0.7;
          var ee = e2 * e2;
          scale = 1.4 - ee * 1.05;
          tx = vw / 2 + (vw - 110 - vw / 2) * ee;
          ty = vh * 0.42 + (72 - vh * 0.42) * ee;
          alpha = 1 - ee * 0.85;
        }
        ctx.globalAlpha = alpha;
        ctx.translate(tx, ty);
        ctx.scale(scale, scale);
        ctx.font = 'bold 26px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,.75)';
        ctx.strokeText(t.text, 0, 0);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, 0, 0);
      } else {
        ctx.globalAlpha = 1 - k;
        ctx.font = 'bold 15px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,.7)';
        ctx.strokeText(t.text, vw / 2, vh * 0.62 - k * 40);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, vw / 2, vh * 0.62 - k * 40);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawDrill(ctx, g, T) {
    var d = g.drill;
    var look = drillLook(g);
    var cx = (d.x + CFG.DRILL_W / 2) * T;
    var cy = (d.y + CFG.DRILL_H / 2) * T;
    var ang = Math.atan2(d.fy, d.fx);

    // trainee de vitesse
    if (look.trail && d.drilling) {
      for (var i = 1; i <= look.trail + 1; i++) {
        ctx.globalAlpha = 0.14 / i;
        ctx.fillStyle = '#ff8a3d';
        ctx.fillRect(cx - d.fx * i * 7 - T, cy - d.fy * i * 7 - T, T * 2, T * 2);
      }
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(cx, cy);

    if (look.glow) {
      var rg = ctx.createRadialGradient(0, 0, 2, 0, 0, T * 2.2);
      rg.addColorStop(0, look.glow);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = rg;
      ctx.fillRect(-T * 2.2, -T * 2.2, T * 4.4, T * 4.4);
      ctx.globalAlpha = 1;
    }
    if (d.turboT > 0) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ffb03d';
      ctx.beginPath(); ctx.arc(0, 0, T * 1.6, 0, 6.284); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (look.arcs) {
      ctx.strokeStyle = '#b48dff'; ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(g.time * 20);
      for (var a = 0; a < 4; a++) {
        var an = g.time * 3 + a * 1.57;
        ctx.beginPath();
        ctx.moveTo(Math.cos(an) * T * 0.9, Math.sin(an) * T * 0.9);
        ctx.lineTo(Math.cos(an) * T * 2.1, Math.sin(an) * T * 2.1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.rotate(ang);

    if (look.flames) {
      ctx.fillStyle = '#4ad9ff';
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(g.time * 30);
      ctx.beginPath();
      ctx.moveTo(-T * 0.95, -T * 0.4);
      ctx.lineTo(-T * (1.6 + Math.random() * 0.5), 0);
      ctx.lineTo(-T * 0.95, T * 0.4);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    var hw = T * 0.95 * look.width;
    ctx.fillStyle = '#3a4048';
    ctx.fillRect(-T * 0.95, -hw, T * 1.9, hw * 2);
    ctx.fillStyle = '#565f6b';
    ctx.fillRect(-T * 0.85, -hw + T * 0.1, T * 1.5, hw * 2 - T * 0.2);
    ctx.fillStyle = '#ffcf5c';
    ctx.fillRect(-T * 0.5, -T * 0.35, T * 0.7, T * 0.7);
    ctx.fillStyle = '#22262c';
    ctx.fillRect(-T * 0.95, -hw, T * 1.9, T * 0.22);
    ctx.fillRect(-T * 0.95, hw - T * 0.22, T * 1.9, T * 0.22);

    var spin = Math.sin(d.bit) * 0.5 + 0.5;
    var reach = (T * 1.55 + spin * 3) * look.len * look.scale;
    ctx.fillStyle = d.rotT > 0 ? '#7a7f88' : look.head;
    ctx.beginPath();
    ctx.moveTo(T * 0.85, -hw * 0.66);
    ctx.lineTo(reach, 0);
    ctx.lineTo(T * 0.85, hw * 0.66);
    ctx.closePath();
    ctx.fill();
    if (look.head !== '#d8dde4') {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(g.time * 18);
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.moveTo(T * 1.05, -hw * 0.3);
      ctx.lineTo(reach, 0);
      ctx.lineTo(T * 1.05, hw * 0.3);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(T * 0.9, -T * 0.5 + spin * T * 0.4, T * 0.5, 3);
    ctx.restore();
  }

  CORE.RENDER = { draw: draw };
})(window.CORE);
