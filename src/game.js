/* CORE — etat de jeu : run, niveaux, stats effectives, bonus, butin. */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';

  var CFG = CORE.CFG, W = CORE.WORLD, C = CORE.CONTENT, SFX = CORE.SFX;

  var G = {
    state: 'menu',          // menu | play | station | end
    run: null,
    world: null, drill: null,
    buffs: [], pickups: [], parts: [],
    time: 0, levelTime: 0, freeze: 0, souffle: 0,
    ore: 0, shake: 0, currentHard: 1,
    cam: { x: 0, y: 0 }, dpr: 1,
    stats: null, drawnCards: [], cardChosen: false, lastResult: null
  };

  /* ------------------------------------------------------------- STATS */
  function computeStats() {
    var s = {};
    for (var k in CFG.BASE) s[k] = CFG.BASE[k];
    s.crit = 0; s.gravDrill = false; s.visionPenalty = 0;
    var run = G.run;
    if (!run) return s;

    // pieces de foreuse
    C.PARTS.forEach(function (p) {
      var n = run.parts[p.id] || 0;
      if (n > 0) p.apply(s, n);
    });

    // passifs
    C.PASSIVES.forEach(function (p) {
      var n = run.passives[p.id] || 0;
      if (n <= 0) return;
      if (p.flag) s[p.flag] = true;
      p.apply(s, n);
    });

    // metier
    if (run.job) run.job.apply(s);

    // bonus temporaires
    G.buffs.forEach(function (b) {
      var tier = b.def.tiers ? b.def.tiers[b.level - 1] : undefined;
      b.def.apply(s, tier);
    });

    if (G.souffle > 0) s.speed *= 1.3;

    s.width = Math.max(1, Math.min(6, Math.round(s.width)));
    s.length = Math.max(1, Math.min(4, Math.round(s.length)));
    s.crit = Math.min(0.6, s.crit);
    return s;
  }

  /* --------------------------------------------------------------- RUN */
  function startRun(job) {
    G.run = {
      job: job, parts: {}, passives: {}, gold: 0,
      levelIndex: 0, splits: [], medals: [], total: 0,
      seed: (Math.random() * 1e9) | 0
    };
    startLevel(0);
  }

  function startLevel(index) {
    var def = CFG.LEVELS[index];
    var layer = CFG.LAYERS[def.layer - 1];
    var stats = computeStats();
    G.run.levelIndex = index;
    G.world = W.generate(def, layer, G.run.seed + index * 7919, stats.luck);
    G.drill = CORE.DRILL.create(G.world);
    G.buffs = []; G.pickups = []; G.parts = [];
    G.levelTime = 0; G.freeze = 0; G.souffle = 0; G.ore = 0; G.shake = 0;
    G.cam.x = G.drill.x * CFG.TILE - 300;
    G.cam.y = 0;
    G.stats = computeStats();
    G.state = 'play';
  }

  /* ------------------------------------------------------------- BONUS */
  function addBuff(def) {
    var found = null;
    for (var i = 0; i < G.buffs.length; i++) if (G.buffs[i].def.id === def.id) found = G.buffs[i];
    var maxLvl = def.tiers ? def.tiers.length : 1;
    if (found) {
      found.level = Math.min(maxLvl, found.level + 1);
      found.t = def.freeze ? def.tiers[found.level - 1] : def.dur;
    } else {
      G.buffs.push({
        def: def, level: 1,
        t: def.freeze ? def.tiers[0] : def.dur,
        malus: def.stun || def.id.charAt(0) === 'M'
      });
    }
  }

  function spawnPickup(cx, cy, item) {
    var p = { x: cx + 0.5, y: cy + 0.5, kind: item.kind, bonus: item.bonus, t: 0 };
    if (item.kind === W.KIND.BONUS) {
      p.color = item.bonus.color; p.label = item.bonus.icon;
    } else if (item.kind === W.KIND.PEPITE) {
      p.color = '#ffd24a'; p.label = '$';
    } else {
      p.color = '#5ff0e0'; p.label = '-5';
    }
    G.pickups.push(p);
  }

  function burst(cx, cy, color, n) {
    for (var i = 0; i < n; i++) {
      if (G.parts.length > 260) return;
      G.parts.push({
        x: cx + 0.5, y: cy + 0.5,
        vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.9) * 9,
        s: 2 + Math.random() * 3, color: color,
        life: 0.35 + Math.random() * 0.4, max: 0.75
      });
    }
  }

  /* ------------------------------------------------------------ UPDATE */
  function update(dt, input) {
    if (G.state !== 'play') return;
    G.time += dt;

    var stats = computeStats();
    G.stats = stats;
    var world = G.world, d = G.drill;

    var hooks = {
      onBreak: function (cx, cy, type, item) {
        burst(cx, cy, type === W.T.ORE ? world.layer.ore : world.layer.med, type === W.T.ORE ? 7 : 3);
        if (type === W.T.ORE) {
          G.ore++;
          G.run.gold += Math.round(world.layer.oreValue * stats.value);
          SFX.ore();
          G.shake = Math.max(G.shake, 3);
          if (world.locked && G.ore >= (world.def.quota || 0)) {
            W.unlockExit(world);
            SFX.level();
          }
        } else {
          SFX.breakBlock();
        }
        if (item) spawnPickup(cx, cy, item);
      },
      onStall: function () { G.shake = Math.max(G.shake, 7); SFX.stall(); },
      onLand: function (v) { G.shake = Math.max(G.shake, Math.min(9, v * 0.28)); SFX.land(); },
      onTurbo: function () { G.shake = Math.max(G.shake, 6); SFX.turbo(); }
    };

    CORE.DRILL.update(d, world, input, stats, dt, hooks);
    G.currentHard = d.lastHard || 1;
    SFX.drill(d.drilling, d.elan);

    // --- bonus actifs -----------------------------------------------------
    for (var i = G.buffs.length - 1; i >= 0; i--) {
      var b = G.buffs[i];
      b.t -= dt;
      if (b.t <= 0) {
        G.buffs.splice(i, 1);
        if (!b.malus && G.run.passives['V-04']) G.souffle = 5;
      }
    }
    if (G.souffle > 0) G.souffle -= dt;

    // --- chrono ------------------------------------------------------------
    var frozen = false;
    G.buffs.forEach(function (b) { if (b.def.freeze) frozen = true; });
    if (!frozen) G.levelTime += dt;

    // --- ramassage ---------------------------------------------------------
    var dcx = d.x + CFG.DRILL_W / 2, dcy = d.y + CFG.DRILL_H / 2;
    for (var pi = G.pickups.length - 1; pi >= 0; pi--) {
      var p = G.pickups[pi];
      p.t += dt;
      var dx = dcx - p.x, dy = dcy - p.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < stats.magnet + 1.2) {
        var pull = Math.min(1, dt * 9);
        p.x += dx * pull; p.y += dy * pull;
      }
      if (dist < 1.4) {
        G.pickups.splice(pi, 1);
        if (p.kind === W.KIND.BONUS) {
          addBuff(p.bonus);
          if (p.bonus.stun || p.bonus.id.charAt(0) === 'M') { SFX.malus(); G.shake = 10; }
          else { SFX.bonus(); G.shake = Math.max(G.shake, 5); }
        } else if (p.kind === W.KIND.PEPITE) {
          G.run.gold += Math.round(world.layer.oreValue * 2 * stats.value);
          SFX.gold();
        } else {
          G.levelTime = Math.max(0, G.levelTime - 5);
          SFX.gold();
        }
      }
    }

    // --- particules --------------------------------------------------------
    for (var qi = G.parts.length - 1; qi >= 0; qi--) {
      var q = G.parts[qi];
      q.life -= dt;
      if (q.life <= 0) { G.parts.splice(qi, 1); continue; }
      q.vy += 30 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
    }

    // --- sortie ------------------------------------------------------------
    if (!world.locked && d.y + CFG.DRILL_H > world.exitRow + 0.6) {
      var cx0 = Math.floor(d.x), cx1 = Math.floor(d.x + CFG.DRILL_W - 0.01);
      if (cx0 >= world.exitX - 1 && cx1 <= world.exitX + world.exitW) finishLevel();
    }
  }

  /* ------------------------------------------------------- FIN DE NIVEAU */
  function medalFor(def, t) {
    if (t <= def.gold) return 'or';
    if (t <= def.silver) return 'argent';
    if (t <= def.bronze) return 'bronze';
    return null;
  }

  function finishLevel() {
    var def = CFG.LEVELS[G.run.levelIndex];
    var t = G.levelTime;
    var medal = medalFor(def, t);
    G.run.splits.push(t);
    G.run.medals.push(medal);
    G.run.total += t;
    CORE.SAVE.record(def.id, t, medal);
    SFX.drill(false, 0);
    SFX.level();

    var rng = CORE.makeRng((G.run.seed + G.run.levelIndex * 131) | 0);
    G.drawnCards = C.draw(rng, G.run.passives, def.layer, 3);
    G.cardChosen = false;
    G.lastResult = { def: def, time: t, medal: medal, ore: G.ore, last: G.run.levelIndex >= CFG.LEVELS.length - 1 };
    G.state = 'station';
  }

  function chooseCard(passive) {
    if (G.cardChosen) return;
    G.run.passives[passive.id] = (G.run.passives[passive.id] || 0) + 1;
    G.cardChosen = true;
  }

  function buyPart(part) {
    var owned = G.run.parts[part.id] || 0;
    if (owned >= part.max) return false;
    var cost = C.partCost(part, owned);
    if (G.run.gold < cost) return false;
    G.run.gold -= cost;
    G.run.parts[part.id] = owned + 1;
    return true;
  }

  function nextLevel() {
    if (G.run.levelIndex >= CFG.LEVELS.length - 1) {
      CORE.SAVE.recordTotal(G.run.total);
      G.state = 'end';
      return;
    }
    startLevel(G.run.levelIndex + 1);
  }

  CORE.GAME = {
    G: G, startRun: startRun, startLevel: startLevel, update: update,
    computeStats: computeStats, chooseCard: chooseCard, buyPart: buyPart,
    nextLevel: nextLevel, medalFor: medalFor
  };
})(window.CORE);
