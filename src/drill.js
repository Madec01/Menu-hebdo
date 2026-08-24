/* CORE — la foreuse : physique, forage directionnel, elan, turbo. */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';

  var CFG = CORE.CFG, W = CORE.WORLD;
  var DW = CFG.DRILL_W, DH = CFG.DRILL_H;

  function create(world) {
    return {
      x: world.exitX + 1, y: 1,
      vx: 0, vy: 0,
      fx: 0, fy: 1,          // direction de la tete
      rotT: 0, elan: 0,
      turboT: 0, turboCd: 0,
      prog: 0, progKey: '', crit: false,
      drilling: false, grounded: false, falling: false,
      stall: 0, bit: 0
    };
  }

  function overlapsSolid(world, x, y) {
    var x0 = Math.floor(x + 1e-6), x1 = Math.floor(x + DW - 1e-6);
    var y0 = Math.floor(y + 1e-6), y1 = Math.floor(y + DH - 1e-6);
    for (var cy = y0; cy <= y1; cy++) {
      for (var cx = x0; cx <= x1; cx++) if (world.solid(cx, cy)) return true;
    }
    return false;
  }

  /* Cellules visees par la tete, selon la direction, la largeur et la longueur. */
  function targets(d, fx, fy, width, length) {
    var cells = [];
    var x0 = Math.floor(d.x + 1e-6), x1 = Math.floor(d.x + DW - 1e-6);
    var y0 = Math.floor(d.y + 1e-6), y1 = Math.floor(d.y + DH - 1e-6);
    var extra = Math.max(0, Math.round(width) - 2);
    var padA = Math.floor(extra / 2), padB = extra - padA;
    var L = Math.max(1, Math.round(length));
    var l, cx, cy;

    if (fx !== 0) {
      var col = fx > 0 ? x1 + 1 : x0 - 1;
      for (l = 0; l < L; l++) {
        for (cy = y0 - padA; cy <= y1 + padB; cy++) cells.push([col + fx * l, cy]);
      }
    }
    if (fy !== 0) {
      var row = fy > 0 ? y1 + 1 : y0 - 1;
      for (l = 0; l < L; l++) {
        for (cx = x0 - padA; cx <= x1 + padB; cx++) cells.push([cx, row + fy * l]);
      }
    }
    return cells;
  }

  function update(d, world, input, s, dt, hooks) {
    var i;

    // ---- direction de la tete -------------------------------------------
    if (input.dx !== 0 || input.dy !== 0) {
      if (input.dx !== d.fx || input.dy !== d.fy) {
        d.fx = input.dx; d.fy = input.dy;
        d.rotT = s.rot;
        d.elan *= (1 - s.elanLoss);
        d.prog = 0; d.progKey = '';
      }
    }
    if (d.rotT > 0) d.rotT -= dt;

    // ---- turbo ------------------------------------------------------------
    if (d.turboCd > 0) d.turboCd -= dt;
    if (input.turbo && d.turboT <= 0 && d.turboCd <= 0) {
      d.turboT = s.turboDur; d.turboCd = s.turboCd + s.turboDur;
      if (hooks.onTurbo) hooks.onTurbo();
    }
    if (d.turboT > 0) d.turboT -= dt;
    var turbo = d.turboT > 0 ? s.turboMult : 1;

    // ---- cible de forage (calculee avant le deplacement) -------------------
    var cells = null, solidCount = 0, breakable = 0, maxHard = 0;
    if (input.dx !== 0 || input.dy !== 0) {
      cells = targets(d, d.fx, d.fy, s.width, s.length);
      for (i = 0; i < cells.length; i++) {
        var ct = world.at(cells[i][0], cells[i][1]);
        if (ct === W.T.EMPTY) continue;
        solidCount++;
        if (W.DESTRUCTIBLE[ct]) {
          breakable++;
          var ch = world.hard[world.idx(cells[i][0], cells[i][1])];
          if (ch > maxHard) maxHard = ch;
        }
      }
    }
    d.lastHard = maxHard || 1;
    // Tant qu'il reste de la roche a percer, la foreuse s'ancre : elle ne glisse
    // pas le long de l'obstacle. C'est ce qui rend le forage en diagonale possible.
    var anchored = breakable > 0 && d.rotT <= 0;

    // ---- deplacement ------------------------------------------------------
    d.vx = anchored ? 0 : input.dx * s.roll * (d.turboT > 0 ? 1.4 : 1);
    if (input.dy < 0) {
      d.vy = -s.climb;
    } else {
      d.vy += CFG.GRAVITY * dt;
      if (input.dy > 0) d.vy = Math.max(d.vy, s.roll * 0.9);
      if (d.vy > CFG.TERMINAL) d.vy = CFG.TERMINAL;
    }

    var nx = d.x + d.vx * dt;
    if (!overlapsSolid(world, nx, d.y)) {
      d.x = nx;
    } else if (d.vx !== 0) {
      d.x = d.vx > 0 ? Math.floor(nx + DW) - DW - 0.002 : Math.floor(nx) + 1 + 0.002;
      d.vx = 0;
    }

    var ny = d.y + d.vy * dt;
    var wasFalling = d.vy > 8;
    if (!overlapsSolid(world, d.x, ny)) {
      d.y = ny;
    } else {
      if (d.vy > 0) {
        d.y = Math.floor(ny + DH) - DH - 0.002;
        if (wasFalling && hooks.onLand) hooks.onLand(d.vy);
      } else if (d.vy < 0) {
        d.y = Math.floor(ny) + 1 + 0.002;
      }
      d.vy = 0;
    }
    d.x = Math.max(0.05, Math.min(world.w - DW - 0.05, d.x));

    d.grounded = overlapsSolid(world, d.x, d.y + 0.08);
    d.falling = !d.grounded && d.vy > 6;

    // ---- forage -----------------------------------------------------------
    d.drilling = false;
    if (d.stall > 0) d.stall -= dt;

    if (cells) {
      if (solidCount > 0 && breakable === 0) {
        if (d.stall <= 0) { d.stall = 0.35; d.elan *= 0.5; if (hooks.onStall) hooks.onStall(); }
      } else if (breakable > 0 && d.rotT <= 0) {
        var key = d.fx + ',' + d.fy + ',' + cells[0][0] + ',' + cells[0][1];
        if (key !== d.progKey) {
          d.progKey = key; d.prog = 0;
          d.crit = Math.random() < (s.crit || 0);
        }
        var hits = d.crit ? 1 : Math.max(1, Math.ceil(maxHard / Math.max(0.1, s.force)));
        var rate = s.speed * (1 + d.elan * s.elanMax) * turbo;
        if (d.fy < 0) rate *= CFG.UP_PENALTY;
        if (s.gravDrill && d.falling && d.fy > 0) rate *= 2;
        d.prog += rate * dt;
        d.drilling = true;
        d.bit += rate * dt * 12;

        if (d.prog >= hits) {
          d.prog = 0; d.progKey = '';
          var keepFall = s.gravDrill && d.falling;
          for (i = 0; i < cells.length; i++) {
            var bx = cells[i][0], by = cells[i][1];
            if (!world.inside(bx, by)) continue;
            var bi = world.idx(bx, by);
            var bt = world.type[bi];
            if (!W.DESTRUCTIBLE[bt]) continue;
            world.type[bi] = W.T.EMPTY;
            if (hooks.onBreak) hooks.onBreak(bx, by, bt, world.items.get(bi));
            world.items.delete(bi);
          }
          if (keepFall) d.vy = Math.max(d.vy, 12);
        }
      }
    } else {
      d.progKey = '';
    }

    // ---- elan -------------------------------------------------------------
    var moving = Math.abs(d.vx) > 0.5 || Math.abs(d.vy) > 0.5;
    if (d.drilling || moving) {
      d.elan = Math.min(1, d.elan + dt / s.elanRise);
    } else {
      d.elan = Math.max(0, d.elan - dt * 0.4);
    }
  }

  CORE.DRILL = { create: create, update: update, targets: targets, overlapsSolid: overlapsSolid };
})(window.CORE);
