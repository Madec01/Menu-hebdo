/* CORE — etat de jeu : run, niveaux, carburant, evenements, butin, ressenti. */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';

  var CFG = CORE.CFG, W = CORE.WORLD, C = CORE.CONTENT, SFX = CORE.SFX;

  var G = {
    state: 'menu',          // menu | play | station | end
    run: null,
    world: null, drill: null,
    buffs: [], pickups: [], parts: [], toasts: [],
    time: 0, levelTime: 0, freeze: 0, souffle: 0, rescueT: 0,
    ore: 0, shake: 0, currentHard: 1,
    fuel: 100, fuelMax: 100, reserve: false, lowWarned: false,
    hp: 3, iframes: 0, stun: 0, falls: [], failleCd: 0, sealBroken: false,
    justRestarted: 0, turboCharge: 0,
    event: null, eventT: 0, eventNext: 0, marker: null,
    combo: 0, comboT: 0, comboMult: 1,
    challenges: [], st: null,
    hitstop: 0, slowmo: 0, flash: null, desat: 0,
    ghost: null, ghostRec: null, ghostT: 0,
    nextBlast: 0,
    cam: { x: 0, y: 0 }, dpr: 1,
    stats: null, drawnCards: [], cardChosen: false, lastResult: null
  };

  /* ------------------------------------------------------------- STATS */
  function computeStats() {
    var s = {};
    for (var k in CFG.BASE) s[k] = CFG.BASE[k];
    s.crit = 0; s.turboBlocked = false;
    var run = G.run;
    if (!run) return s;

    C.PARTS.forEach(function (p) {
      var n = run.parts[p.id] || 0;
      if (n > 0) p.apply(s, n);
    });

    C.ALL.forEach(function (p) {
      var n = run.passives[p.id] || 0;
      if (n <= 0) return;
      if (p.flag) s[p.flag] = true;
      p.apply(s, n);
    });

    if (run.job) run.job.apply(s);

    G.buffs.forEach(function (b) {
      var tier = b.def.tiers ? b.def.tiers[b.level - 1] : undefined;
      b.def.apply(s, tier);
    });

    if (G.souffle > 0) s.speed *= 1.3;
    if (s.daredevil && G.world && G.world.failleRow > G.drill.y - 15) s.speed *= 1.4;

    // evenements de couche
    if (G.event) {
      if (G.event.id === 'ruee') s.value *= 2;
      if (G.event.id === 'vapeurs') s.burn *= 2;
      if (G.event.id === 'coupure') s.vision = 4;
    }

    // panne seche : la foreuse est a l'arret, le joueur doit choisir
    if (G.reserve) { s.speed = 0; s.turboBlocked = true; }

    s.width = Math.max(1, Math.min(6, Math.round(s.width)));
    s.length = Math.max(1, Math.min(4, Math.round(s.length)));
    s.crit = Math.min(0.6, s.crit);
    return s;
  }

  /* --------------------------------------------------------------- RUN */
  function startRun(job, depthTier) {
    G.meta = { runs: 1, ore: 0, cans: 0, bonuses: 0, collapses: 0, buried: 0 };
    G.run = {
      depth: depthTier || 0,
      job: job, parts: {}, passives: {}, gold: 0,
      levelIndex: 0, splits: [], medals: [], total: 0,
      shopClosedFor: 0, restarts: 0, lost: 0, fuelCarry: undefined,
      seed: (Math.random() * 1e9) | 0
    };
    CORE.SAVE.addStats({ runs: 1 });
    G.meta.runs = 0;
    startLevel(job && job.skip ? job.skip : 0);
  }

  function tier() { return CFG.DEPTHS[G.run ? (G.run.depth || 0) : 0]; }

  function startLevel(index) {
    var def = CFG.LEVELS[index];
    var layer = CFG.LAYERS[def.layer - 1];
    var pre = computeStats();
    G.run.levelIndex = index;
    G.world = W.generate(def, layer, G.run.seed + index * 7919, pre.luck);
    var tr = tier();
    if (tr.hard !== 1) {
      for (var hi = 0; hi < G.world.hard.length; hi++) G.world.hard[hi] *= tr.hard;
    }
    G.drill = CORE.DRILL.create(G.world);
    G.buffs = []; G.pickups = []; G.parts = []; G.toasts = [];
    G.levelTime = 0; G.freeze = 0; G.souffle = 0; G.ore = 0; G.shake = 0;
    G.event = null; G.eventT = 0; G.eventNext = CFG.EVENT_FIRST; G.marker = null;
    G.combo = 0; G.comboT = 0; G.comboMult = 1;
    G.hitstop = 0; G.slowmo = 0; G.flash = null; G.desat = 0;
    G.lowWarned = false; G.reserve = false; G.rescueT = 0;
    G.dryChoice = false;
    G.hp = Math.max(1, CFG.HP + (pre.hpBonus || 0) + tier().hp); G.iframes = 0; G.stun = 0; G.falls = [];
    G.failleCd = 0; G.sealBroken = false; G.turboCharge = 0;
    G.world.failleRow = G.world.top - 3;
    G.fallSeen = new Set();
    G.scan = null;
    G.levelToken = (G.levelToken || 0) + 1;
    G.nextBlast = def.top + 60;
    G.st = { up: 0, bonus: 0, reserve: 0, straight: 0, ore: 0, bigFall: 0, fuelEnd: 0 };

    var stats = computeStats();
    G.fuelMax = stats.fuelMax;
    // Le carburant ne se remplit plus tout seul : il se reporte d'un niveau a
    // l'autre, s'achete a la station et se trouve dans la roche. Seule une
    // ration de secours est offerte, pour qu'on ne parte jamais a sec.
    if (G.run.fuelCarry === undefined) G.run.fuelCarry = stats.fuelMax;
    G.fuel = Math.min(stats.fuelMax, Math.max(G.run.fuelCarry, CFG.FUEL.freeTop));

    // defis du niveau
    var crng = CORE.makeRng((G.run.seed + index * 5711) | 0);
    var pool = CFG.CHALLENGES.slice();
    crng.shuffle(pool);
    G.challenges = pool.slice(0, 3).map(function (c) { return { def: c, done: false }; });

    // fantome : lecture du meilleur passage, enregistrement du nouveau
    G.ghost = CORE.SAVE.ghost(def.id);
    G.ghostRec = []; G.ghostT = 0;

    G.cam.x = G.drill.x * CFG.TILE - 300;
    G.cam.y = 0;
    G.stats = stats;
    G.levelStartFuel = G.fuel;
    G.state = 'play';
  }

  /* ------------------------------------------------------- RESSENTI */
  function toast(text, color, big) {
    G.toasts.push({ text: text, color: color, t: 0, dur: big ? 1.1 : 0.8, big: !!big });
  }
  function flash(color, dur) { G.flash = { color: color, t: dur, max: dur }; }

  /* ------------------------------------------------------------- BONUS */
  function addBuff(def) {
    if (G.stats && G.stats.ascete && !def.stun && !def.leak && def.id.charAt(0) !== 'M') return 0;
    var found = null;
    for (var i = 0; i < G.buffs.length; i++) if (G.buffs[i].def.id === def.id) found = G.buffs[i];
    var maxLvl = def.tiers ? def.tiers.length : 1;
    var level = 1;
    if (found) {
      found.level = Math.min(maxLvl, found.level + 1);
      found.t = def.tiers && (def.freeze || def.noBurn) ? def.tiers[found.level - 1] : def.dur;
      level = found.level;
    } else {
      G.buffs.push({
        def: def, level: 1,
        t: def.tiers && (def.freeze || def.noBurn) ? def.tiers[0] : def.dur,
        malus: !!def.stun || !!def.leak || def.id.charAt(0) === 'M'
      });
    }
    return level;
  }

  function spawnPickup(cx, cy, item) {
    var p = { x: cx + 0.5, y: cy + 0.5, kind: item.kind, bonus: item.bonus, t: 0 };
    if (item.kind === W.KIND.BONUS) { p.color = item.bonus.color; p.label = item.bonus.icon; }
    else if (item.kind === W.KIND.PEPITE) { p.color = '#ffd24a'; p.label = '$'; }
    else if (item.kind === W.KIND.CARBURANT) { p.color = '#8ac46a'; p.label = 'L'; }
    else { p.color = '#5ff0e0'; p.label = '-5'; }
    G.pickups.push(p);
  }

  function burst(cx, cy, color, n) {
    for (var i = 0; i < n; i++) {
      if (G.parts.length > 320) return;
      G.parts.push({
        x: cx + 0.5, y: cy + 0.5,
        vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.9) * 9,
        s: 2 + Math.random() * 3, color: color,
        life: 0.35 + Math.random() * 0.4, max: 0.75
      });
    }
  }

  /* -------------------------------------------------------- INTEGRITE */
  function damage(n, label) {
    if (G.iframes > 0 || G.state !== 'play') return;
    G.hp -= n;
    G.iframes = CFG.IFRAMES;
    G.shake = 18;
    flash('#ff3b52', 0.45);
    toast(label, '#ff3b52', true);
    SFX.hurt();
    if (G.hp <= 0) restartLevel();
  }

  /* On perd un niveau, jamais une partie : l'or, les passifs et les pieces
     restent acquis. Seul le temps deja passe est perdu, et il compte. */
  function restartLevel() {
    G.run.lost += G.levelTime;
    G.run.fuelCarry = G.levelStartFuel;
    G.run.total += G.levelTime;
    G.run.restarts++;
    SFX.fail();
    var idx = G.run.levelIndex;
    startLevel(idx);
    G.justRestarted = 2.6;
  }

  function addTurbo(x) {
    G.turboCharge = Math.min(1, G.turboCharge + x);
  }

  /* ------------------------------------------------------- EFFONDREMENTS */
  /* Une masse privee d'appui tremble, puis lache. Le danger est toujours
     annonce : 0,4 s de fissures avant la chute. */
  function checkCollapse() {
    var sc = G.scan;
    G.scan = null;
    if (!sc) return;
    if (G.stats.propper && sc.y < G.drill.y - 3) return;
    for (var x = sc.x0 - 2; x <= sc.x1 + 2; x++) {
      var y = sc.y - 1;
      if (!G.world.inside(x, y)) continue;
      if (G.fallSeen.has(y * G.world.w + x)) continue;
      var mass = W.looseMass(G.world, x, y, CFG.FALL.minSpan, CFG.FALL.maxMass);
      if (!mass) continue;
      mass.forEach(function (c) { G.fallSeen.add(c[1] * G.world.w + c[0]); });
      G.falls.push({ cells: mass, state: 'shake', t: CFG.FALL.shake, off: 0, dy: 0 });
      SFX.creak();
    }
  }

  function massCanOccupy(fall, dy) {
    var world = G.world, d = G.drill;
    for (var i = 0; i < fall.cells.length; i++) {
      var x = fall.cells[i][0], y = fall.cells[i][1] + dy;
      if (y >= world.h) return false;
      if (world.at(x, y) !== W.T.EMPTY) return false;
      // La foreuse fait obstacle : une masse s'arrete SUR elle, elle ne
      // l'engloutit jamais — sinon on se retrouve emmure dans la roche.
      if (x >= d.x - 0.95 && x <= d.x + CFG.DRILL_W - 0.05 &&
          y >= d.y - 0.95 && y <= d.y + CFG.DRILL_H - 0.05) return false;
    }
    return true;
  }

  function liftMass(fall) {
    var world = G.world;
    fall.types = []; fall.hards = [];
    fall.cells.forEach(function (c) {
      var i = world.idx(c[0], c[1]);
      fall.types.push(world.type[i]);
      fall.hards.push(world.hard[i]);
      world.type[i] = W.T.EMPTY;
    });
  }

  function landMass(fall) {
    var world = G.world, dy = fall.dy;
    var d = G.drill;
    fall.cells.forEach(function (c, k) {
      var x = c[0], y = c[1] + dy;
      if (!world.inside(x, y)) return;
      var i = world.idx(x, y);
      if (world.type[i] !== W.T.EMPTY) return;
      // par securite : jamais de bloc pose dans la foreuse
      if (x >= d.x - 0.95 && x <= d.x + CFG.DRILL_W - 0.05 &&
          y >= d.y - 0.95 && y <= d.y + CFG.DRILL_H - 0.05) return;
      world.type[i] = fall.types[k];
      world.hard[i] = fall.hards[k];
      G.fallSeen.delete(c[1] * world.w + c[0]);
    });
    burst(fall.cells[0][0], fall.cells[0][1] + dy, '#8a7a68', 12);
    G.shake = Math.max(G.shake, 9);
    G.meta.collapses++;
    addTurbo(CFG.TURBO.collapse * (G.stats.quakeTurbo || 1));
    SFX.rockfall();
  }

  function updateFalls(dt) {
    // Un degat peut relancer le niveau au milieu de la boucle : le jeton nous
    // dit que G.falls et G.drill viennent d'etre remplaces.
    var tok = G.levelToken;
    var d = G.drill;
    for (var i = G.falls.length - 1; i >= 0; i--) {
      var f = G.falls[i];
      if (!f) continue;
      if (f.state === 'shake') {
        f.t -= dt;
        if (f.t <= 0) {
          f.state = 'fall';
          liftMass(f);
          if (!massCanOccupy(f, 1)) { landMass(f); G.falls.splice(i, 1); continue; }
        }
        continue;
      }

      f.off += CFG.FALL.speed * dt;
      var want = Math.floor(f.off);
      while (f.dy < want) {
        if (!massCanOccupy(f, f.dy + 1)) break;
        f.dy++;
      }
      if (f.dy < want) { landMass(f); G.falls.splice(i, 1); continue; }

      // ecrasement : la masse pousse la foreuse vers le bas
      for (var k = 0; k < f.cells.length; k++) {
        var mx = f.cells[k][0], my = f.cells[k][1] + f.dy;
        if (mx >= d.x - 0.9 && mx <= d.x + CFG.DRILL_W - 0.1 &&
            my >= d.y - 0.9 && my <= d.y + CFG.DRILL_H - 0.1) {
          if (G.stats.scavenger) {
            G.run.gold += Math.round(G.world.layer.oreValue * 3 * G.stats.value);
            SFX.gold();
          } else {
            damage(CFG.FALL.damage, 'ECRASE');
            if (G.levelToken !== tok) return;
          }
          d.vy = Math.max(d.vy, 16);
          f.crushed = true;
          break;
        }
      }
      if (f.dy > 400) { landMass(f); G.falls.splice(i, 1); }
    }
  }

  /* ------------------------------------------------------------ LA FAILLE */
  /* Le chrono a un visage : un front d'effondrement qui descend en accelerant. */
  function updateFaille(dt) {
    var world = G.world, d = G.drill, def = world.def;
    var F = CFG.FAILLE;
    var tok = G.levelToken;
    if (G.failleCd > 0) G.failleCd -= dt;
    if (G.levelTime < F.delay) return;

    var el = G.levelTime - F.delay;
    var mult = (def.faille || 1) * tier().faille * (G.sealBroken ? F.sealBoost : 1);
    world.failleRow += (F.speed + F.accel * el) * mult * dt;

    var row = Math.min(Math.floor(world.failleRow), world.top + def.height - 1);
    if (world.filledTo === undefined) world.filledTo = world.top - 1;
    if (row > world.filledTo) {
      var px0 = Math.floor(d.x) - 1, px1 = Math.floor(d.x + CFG.DRILL_W) + 1;
      var py0 = Math.floor(d.y) - 1, py1 = Math.floor(d.y + CFG.DRILL_H) + 1;
      for (var y = Math.max(world.top, world.filledTo + 1); y <= row; y++) {
        for (var x = 1; x < world.w - 1; x++) {
          if (x >= px0 && x <= px1 && y >= py0 && y <= py1) continue;
          var i = world.idx(x, y);
          if (world.type[i] === W.T.EMPTY) world.setRock(x, y, W.T.HARD);
        }
      }
      world.filledTo = row;
    }

    // rattrapage : on est enseveli, pousse vers le bas, et ca coute cher
    if (world.failleRow > d.y - 0.3 && G.failleCd <= 0) {
      G.failleCd = 3;
      G.stun = 0.7;
      G.meta.buried++;
      damage(1, 'ENSEVELI');
      if (G.levelToken !== tok) return;
      var push = CFG.FAILLE.catchPush;
      for (var p = 0; p < push; p++) {
        var ny = d.y + 1;
        var bx0 = Math.floor(d.x), bx1 = Math.floor(d.x + CFG.DRILL_W - 1e-6);
        var by = Math.floor(ny + CFG.DRILL_H - 1e-6);
        for (var bx = bx0; bx <= bx1; bx++) {
          if (W.DESTRUCTIBLE[world.at(bx, by)]) destroyAt(bx, by, true, { n: 6 });
        }
        if (!CORE.DRILL.overlapsSolid(world, d.x, ny)) d.y = ny;
      }
      world.failleRow = Math.max(world.top - 1, d.y - 11);
      world.filledTo = Math.floor(world.failleRow);
    }
  }

  /* ---------------------------------------------------------- CARBURANT */
  function burn(amount) {
    if (G.fuel <= 0) return;
    G.fuel -= amount;
    if (G.fuel <= 0) {
      G.fuel = 0;
      G.reserve = true;
      G.dryChoice = true;
      G.st.reserve++;
      toast('PANNE SECHE', '#ff5a6e', true);
      flash('#ff5a6e', 0.5);
      G.shake = 12;
      SFX.alarm();
    } else if (!G.lowWarned && G.fuel < CFG.FUEL.alertAt) {
      G.lowWarned = true;
      SFX.alarm();
      toast('RESERVE BASSE', '#ffb03d', false);
      rescueCan();
    }
  }

  function refuel(litres) {
    G.fuel = Math.min(G.fuelMax, G.fuel + litres);
    if (G.reserve && G.fuel > 0) G.reserve = false;
    if (G.fuel > CFG.FUEL.alertAt) G.lowWarned = false;
  }

  /* Filet de securite : sous le seuil, un bidon est garanti a portee. */
  function rescueCan() {
    var d = G.drill, world = G.world;
    var cx = Math.floor(d.x), cy = Math.floor(d.y);
    if (W.nearestItem(world, W.KIND.CARBURANT, cx, cy, CFG.FUEL.rescueRadius)) return;
    // Le filet de securite se pose devant, pas derriere : remonter pour se
    // ravitailler couterait plus cher que la panne.
    for (var tries = 0; tries < 250; tries++) {
      var bx = Math.round(cx + (Math.random() - 0.5) * 22);
      var by = Math.round(cy + 5 + Math.random() * 12);
      if (!world.inside(bx, by)) continue;
      var bi = world.idx(bx, by);
      if (!W.DESTRUCTIBLE[world.type[bi]] || world.items.has(bi)) continue;
      world.items.set(bi, { kind: W.KIND.CARBURANT, rescue: true });
      return;
    }
  }

  /* --------------------------------------------------- CASSE ET CHAINES */
  function destroyAt(cx, cy, chain, budget) {
    var world = G.world;
    if (!world.inside(cx, cy)) return;
    var idx = world.idx(cx, cy);
    var type = world.type[idx];
    if (!W.DESTRUCTIBLE[type]) return;
    world.type[idx] = W.T.EMPTY;
    onCellBroken(cx, cy, type, world.items.get(idx), chain, budget);
    world.items.delete(idx);
  }

  function onCellBroken(cx, cy, type, item, chain, budget) {
    var world = G.world, layer = world.layer, stats = G.stats;
    var beh = W.BEHAVIOUR[type];

    if (type === W.T.SEAL) G.sealBroken = true;
    // On n'analyse pas la voute case par case : une taille de 5x3 declencherait
    // quinze analyses par coup. On note l'emprise du coup et on l'examine une
    // seule fois par image.
    if (!G.scan) G.scan = { x0: cx, x1: cx, y: cy };
    else {
      if (cx < G.scan.x0) G.scan.x0 = cx;
      if (cx > G.scan.x1) G.scan.x1 = cx;
      if (cy < G.scan.y) G.scan.y = cy;
    }
    // gravats au fond des galeries : un tunnel doit avoir l'air creuse
    if (world.at(cx, cy + 1) !== W.T.EMPTY && Math.random() < 0.55) {
      world.debris.add(world.idx(cx, cy));
    }
    if (G.combo > 0) addTurbo(CFG.TURBO.block);

    if (type === W.T.ORE) {
      G.ore++; G.st.ore++; G.meta.ore++;
      addTurbo(CFG.TURBO.ore);
      bumpCombo();
      G.run.gold += Math.round(layer.oreValue * stats.value * G.comboMult);
      if (stats.oreFuel) refuel(1);
      burst(cx, cy, layer.ore, 7);
      SFX.ore();
      G.shake = Math.max(G.shake, 3);
      if (world.locked && G.ore >= (world.def.quota || 0)) {
        W.unlockExit(world);
        toast('SORTIE OUVERTE', '#78ffb4', true);
        SFX.level();
      }
    } else {
      burst(cx, cy, beh && beh.name === 'cristal' ? layer.hard : layer.med, 3);
      if (!chain) SFX.breakBlock();
    }

    if (beh && beh.chest) {
      G.run.gold += Math.round(layer.oreValue * 8 * stats.value * G.comboMult);
      burst(cx, cy, '#ffd24a', 18);
      toast('COFFRE', '#ffd24a', true);
      flash('#ffd24a', 0.25);
      G.shake = Math.max(G.shake, 9);
      SFX.gold();
      spawnPickup(cx, cy, { kind: W.KIND.BONUS, bonus: C.rollBonus(world.rng, false) });
    }

    if (item) spawnPickup(cx, cy, item);

    // --- comportements en chaine -----------------------------------------
    if (!budget) budget = { n: 60 };
    if (beh && beh.cascade && budget.n > 0) {
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
      for (var i = 0; i < dirs.length && budget.n > 0; i++) {
        var nx = cx + dirs[i][0], ny = cy + dirs[i][1];
        if (world.at(nx, ny) !== type) continue;
        budget.n--;
        if (beh.gold) G.run.gold += Math.round(world.layer.oreValue * beh.gold * stats.value);
        destroyAt(nx, ny, true, budget);
      }
      if (!chain) { SFX.cascade(); G.shake = Math.max(G.shake, 6); }
    }

    if (beh && beh.blast && budget.n > 0) {
      blast(cx, cy, beh.blast, budget, type);
      if (!chain) { SFX.blast(); G.shake = Math.max(G.shake, 10); flash('#ff8a3d', 0.18); }
    }
  }

  function blast(cx, cy, radius, budget, chainType) {
    var world = G.world;
    burst(cx, cy, '#ffb03d', 14);
    for (var oy = -radius; oy <= radius; oy++) {
      for (var ox = -radius; ox <= radius; ox++) {
        if (ox * ox + oy * oy > radius * radius) continue;
        if (budget.n <= 0) return;
        var nx = cx + ox, ny = cy + oy;
        if (!world.inside(nx, ny)) continue;
        var t = world.type[world.idx(nx, ny)];
        if (!W.DESTRUCTIBLE[t]) continue;
        budget.n--;
        destroyAt(nx, ny, true, budget);
      }
    }
  }

  function bumpCombo() {
    G.combo++;
    G.comboT = 3;
    G.comboMult = 1 + Math.min(1.5, Math.floor(G.combo / 5) * 0.15);
    if (G.combo > (G.comboBest || 0)) G.comboBest = G.combo;
  }

  /* -------------------------------------------------------- EVENEMENTS */
  function fireEvent() {
    var world = G.world;
    var pool = CFG.EVENTS.filter(function (e) { return world.layer.id >= e.minLayer; });
    var ev = world.rng.pick(pool);
    G.event = ev; G.eventT = ev.dur;
    G.eventNext = G.levelTime + ev.dur + CFG.EVENT_GAP;
    toast(ev.name, ev.color, true);
    flash(ev.color, 0.35);
    G.shake = Math.max(G.shake, 8);
    SFX.event();

    if (ev.id === 'secousse') world.hardMul = 0.7;
    if (ev.id === 'eboulement') world.ceilingRow = Math.floor(G.drill.y) - 26;
    if (ev.id === 'filonrev') {
      var fx = Math.max(4, Math.min(world.w - 5, Math.floor(G.drill.x) + world.rng.int(-18, 18)));
      var fy = Math.floor(G.drill.y) + world.rng.int(8, 26);
      for (var oy = -3; oy <= 3; oy++) {
        for (var ox = -4; ox <= 4; ox++) {
          var nx = fx + ox, ny = fy + oy;
          if (!world.inside(nx, ny)) continue;
          var idx = world.idx(nx, ny);
          if (!W.DESTRUCTIBLE[world.type[idx]]) continue;
          if (world.rng.chance(0.65)) {
            world.type[idx] = W.T.ORE;
            world.hard[idx] = Math.max(1, CFG.hardnessAt(world.depthAt(ny)) * 1.1);
          }
        }
      }
      G.marker = { x: fx, y: fy, t: ev.dur };
    }
  }

  function endEvent() {
    if (!G.event) return;
    if (G.event.id === 'secousse') G.world.hardMul = 1;
    G.event = null;
    G.marker = null;
  }

  /* ------------------------------------------------------------ UPDATE */
  function update(dt, input) {
    if (G.state !== 'play') return;

    // en panne seche, tout s'arrete : le chrono aussi, le temps de decider
    if (G.dryChoice) return;
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    if (G.slowmo > 0) { G.slowmo -= dt; dt *= 0.35; }

    G.time += dt;

    var stats = computeStats();
    G.stats = stats;
    G.fuelMax = stats.fuelMax;
    var world = G.world, d = G.drill;

    if (G.iframes > 0) G.iframes -= dt;
    if (G.justRestarted > 0) G.justRestarted -= dt;
    if (G.stun > 0) {
      G.stun -= dt;
      input = { dx: 0, dy: 0, turbo: false };
    }
    stats.turboReady = G.turboCharge >= 1;

    var hooks = {
      onBreak: function (cx, cy, type, item) { onCellBroken(cx, cy, type, item, false, null); },
      onStall: function () { G.shake = Math.max(G.shake, 7); SFX.stall(); },
      onLand: function (v, dist) {
        G.shake = Math.max(G.shake, Math.min(9, v * 0.28));
        SFX.land();
        if (dist > 0) {
          if (dist > G.st.bigFall) G.st.bigFall = dist;
          if (stats.fallFuel) refuel(Math.floor(dist / 10) * 3);
        }
      },
      onBounce: function () { G.shake = Math.max(G.shake, 10); SFX.bounce(); flash('#7ec8ff', 0.15); },
      onTurbo: function () { G.shake = Math.max(G.shake, 6); SFX.turbo(); G.turboCharge = 0; },
      onBurn: function (a) { burn(a); },
      onDrillUp: function () { G.st.up++; }
    };

    CORE.DRILL.update(d, world, input, stats, dt, hooks);
    G.currentHard = (d.lastHard || 1);

    // Garde-fou : si la foreuse se retrouvait malgre tout encastree dans la
    // roche sans rien a forer, on degage ses propres cases. Une partie ne doit
    // jamais pouvoir se bloquer.
    if (CORE.DRILL.overlapsSolid(world, d.x, d.y)) {
      G.embedT = (G.embedT || 0) + dt;
      if (G.embedT > 1) {
        G.embedT = 0;
        var ex0 = Math.floor(d.x), ex1 = Math.floor(d.x + CFG.DRILL_W - 1e-6);
        var ey0 = Math.floor(d.y), ey1 = Math.floor(d.y + CFG.DRILL_H - 1e-6);
        for (var cy = ey0; cy <= ey1; cy++) {
          for (var cx = ex0; cx <= ex1; cx++) {
            if (W.DESTRUCTIBLE[world.at(cx, cy)]) destroyAt(cx, cy, true, { n: 8 });
          }
        }
      }
    } else {
      G.embedT = 0;
    }
    SFX.drill(d.drilling, d.elan);

    // fuite de carburant (malus)
    G.buffs.forEach(function (b) { if (b.def.leak) burn(b.def.leak * dt); });

    // legendaire : explosion tous les 60 m
    if (stats.unstable) {
      var depth = world.depthAt(d.y);
      if (depth > G.nextBlast) {
        G.nextBlast = depth + 60;
        blast(Math.floor(d.x + 1), Math.floor(d.y + 3), 5, { n: 80 }, null);
        SFX.blast(); G.shake = 12; flash('#ffb03d', 0.2);
      }
    }

    // --- bonus actifs -----------------------------------------------------
    for (var i = G.buffs.length - 1; i >= 0; i--) {
      var b = G.buffs[i];
      b.t -= dt;
      if (b.t <= 0) {
        G.buffs.splice(i, 1);
        G.desat = 0.35;
        SFX.expire();
        if (!b.malus && G.run.passives['V-04']) G.souffle = 5;
      }
    }
    if (G.souffle > 0) G.souffle -= dt;

    // --- combo -------------------------------------------------------------
    if (G.comboT > 0) {
      G.comboT -= dt;
      if (G.comboT <= 0) { G.combo = 0; G.comboMult = 1; }
    }

    // --- evenements --------------------------------------------------------
    if (G.event) {
      G.eventT -= dt;
      if (G.eventT <= 0) endEvent();
    } else if (G.levelTime > G.eventNext) {
      fireEvent();
    }
    if (G.marker) G.marker.t -= dt;
    var tok0 = G.levelToken;
    checkCollapse();
    updateFaille(dt);
    if (G.levelToken !== tok0) return;
    updateFalls(dt);
    if (G.levelToken !== tok0) return;

    // --- chrono ------------------------------------------------------------
    var frozen = false;
    G.buffs.forEach(function (b) { if (b.def.freeze) frozen = true; });
    if (!frozen) G.levelTime += dt;

    // --- fantome ------------------------------------------------------------
    G.ghostT += dt;
    if (G.ghostRec.length < 4000 && G.ghostT >= 0.08) {
      G.ghostT = 0;
      G.ghostRec.push(Math.round(d.x * 10) / 10, Math.round(d.y * 10) / 10);
    }

    // --- ramassage ---------------------------------------------------------
    var dcx = d.x + CFG.DRILL_W / 2, dcy = d.y + CFG.DRILL_H / 2;
    for (var pi = G.pickups.length - 1; pi >= 0; pi--) {
      var p = G.pickups[pi];
      p.t += dt;
      var dx = dcx - p.x, dy = dcy - p.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      p.near = dist < 7;
      if (dist < stats.magnet + 1.2) {
        var pull = Math.min(1, dt * 9);
        p.x += dx * pull; p.y += dy * pull;
      }
      if (dist < 1.4) {
        G.pickups.splice(pi, 1);
        collect(p, stats);
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

    // --- messages ----------------------------------------------------------
    for (var ti = G.toasts.length - 1; ti >= 0; ti--) {
      G.toasts[ti].t += dt;
      if (G.toasts[ti].t > G.toasts[ti].dur) G.toasts.splice(ti, 1);
    }
    if (G.flash) { G.flash.t -= dt; if (G.flash.t <= 0) G.flash = null; }
    if (G.desat > 0) G.desat -= dt;

    // --- sortie ------------------------------------------------------------
    if (!world.locked && d.y + CFG.DRILL_H > world.exitRow + 0.6) {
      var cx0 = Math.floor(d.x), cx1 = Math.floor(d.x + CFG.DRILL_W - 0.01);
      if (cx0 >= world.exitX - 1 && cx1 <= world.exitX + world.exitW) finishLevel();
    }
  }

  function collect(p, stats) {
    if (p.kind === W.KIND.BONUS) {
      var lvl = addBuff(p.bonus);
      var malus = p.bonus.stun || p.bonus.leak || p.bonus.id.charAt(0) === 'M';
      if (malus) {
        SFX.malus(); G.shake = 11;
        toast(p.bonus.name, p.bonus.color, false);
        flash(p.bonus.color, 0.3);
      } else {
        G.st.bonus++; G.meta.bonuses++;
        addTurbo(CFG.TURBO.bonus);
        bumpCombo();
        G.hitstop = 0.10;                       // arret sur image
        if (p.bonus.rar === 2 || lvl >= 3) G.slowmo = 0.3;
        SFX.bonusTier(lvl);
        G.shake = Math.max(G.shake, 5 + lvl * 2);
        toast(p.bonus.name + ' ' + ['I', 'II', 'III'][lvl - 1], p.bonus.color, true);
        flash(p.bonus.color, 0.22);
      }
    } else if (p.kind === W.KIND.PEPITE) {
      bumpCombo();
      G.run.gold += Math.round(G.world.layer.oreValue * 2 * stats.value * G.comboMult);
      SFX.gold();
      toast('+ or', '#ffd24a', false);
    } else if (p.kind === W.KIND.CARBURANT) {
      var l = CFG.FUEL.bidon * (stats.bigCans ? 2 : 1);
      G.meta.cans++;
      refuel(l);
      SFX.fuel();
      toast('+' + l + ' L', '#8ac46a', false);
      flash('#8ac46a', 0.15);
    } else {
      G.levelTime = Math.max(0, G.levelTime - 5);
      SFX.gold();
      toast('-5 s', '#5ff0e0', true);
      flash('#5ff0e0', 0.2);
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

    // defis
    G.st.straight = G.drill.straightBest;
    G.st.fuelEnd = G.fuel;
    var bonusGold = 0;
    G.challenges.forEach(function (c) {
      c.done = c.def.check(G.st);
      if (c.done) bonusGold += c.def.gold;
    });
    G.run.gold += bonusGold;

    G.run.fuelCarry = G.fuel;
    G.run.splits.push(t);
    G.run.medals.push(medal);
    G.run.total += t;
    var isRecord = CORE.SAVE.record(def.id, t, medal);

    // On verse au carnet a chaque niveau : la progression survit meme si on
    // quitte au milieu d'une expedition.
    var neufs = CORE.SAVE.addStats(G.meta);
    G.meta = { runs: 0, ore: 0, cans: 0, bonuses: 0, collapses: 0, buried: 0 };
    if (medal === 'or') neufs = neufs.concat(CORE.SAVE.addStats({ medOr: 1 }));
    neufs = neufs.concat(CORE.SAVE.setBest('bestDepth', def.top + def.height));
    neufs = neufs.concat(CORE.SAVE.setBest('bestLayer', def.layer));
    G.unlocked = neufs;
    if (isRecord) CORE.SAVE.saveGhost(def.id, t, G.ghostRec);
    SFX.drill(false, 0);
    SFX.level();

    var rng = CORE.makeRng((G.run.seed + G.run.levelIndex * 131) | 0);
    var nCards = tier().cards + (G.stats.extraCard || 0);
    G.drawnCards = C.draw(rng, G.run.passives, def.layer, nCards);
    G.cardChosen = false;
    G.lastResult = {
      def: def, time: t, medal: medal, ore: G.ore, record: isRecord,
      challenges: G.challenges.slice(), bonusGold: bonusGold,
      restarts: G.run.restarts, lost: G.run.lost, unlocked: G.unlocked || [],
      last: G.run.levelIndex >= CFG.LEVELS.length - 1
    };
    G.state = 'station';
  }

  function chooseCard(passive) {
    if (G.cardChosen) return;
    G.run.passives[passive.id] = (G.run.passives[passive.id] || 0) + 1;
    G.cardChosen = true;
    if (passive.flag === 'shopClosed') G.run.shopClosedFor = G.run.levelIndex + 3;
  }

  function shopOpen() {
    return G.run.levelIndex >= G.run.shopClosedFor;
  }

  function buyPart(part) {
    if (!shopOpen()) return false;
    var owned = G.run.parts[part.id] || 0;
    if (owned >= part.max) return false;
    var cost = C.partCost(part, owned);
    if (G.run.gold < cost) return false;
    G.run.gold -= cost;
    G.run.parts[part.id] = owned + 1;
    return true;
  }

  /* Panne seche : relancer le niveau, ou payer un bidon d'urgence. */
  function dryRestart() {
    G.dryChoice = false;
    G.reserve = false;
    restartLevel();
  }

  function dryBuy() {
    if (G.run.gold < CFG.FUEL.emergencyPrice) return false;
    G.run.gold -= CFG.FUEL.emergencyPrice;
    G.fuel = Math.min(G.fuelMax, CFG.FUEL.emergency);
    G.reserve = false;
    G.dryChoice = false;
    G.lowWarned = false;
    SFX.fuel();
    toast('+' + CFG.FUEL.emergency + ' L', '#8ac46a', true);
    return true;
  }

  function buyFuel() {
    if (!shopOpen()) return false;
    if (G.run.gold < CFG.FUEL.canPrice) return false;
    var max = computeStats().fuelMax;
    if (G.run.fuelCarry >= max) return false;
    G.run.gold -= CFG.FUEL.canPrice;
    G.run.fuelCarry = Math.min(max, G.run.fuelCarry + CFG.FUEL.canSize);
    return true;
  }

  function nextLevel() {
    if (G.run.levelIndex >= CFG.LEVELS.length - 1) {
      CORE.SAVE.recordTotal(G.run.total);
      var fin = { finished: 1 };
      if (G.run.restarts === 0) fin.cleanRuns = 1;
      if ((G.run.depth || 0) >= 1) fin.deepWins = 1;
      G.endUnlocked = CORE.SAVE.addStats(fin);
      G.state = 'end';
      return;
    }
    startLevel(G.run.levelIndex + 1);
  }

  CORE.GAME = {
    G: G, startRun: startRun, startLevel: startLevel, update: update,
    computeStats: computeStats, chooseCard: chooseCard, buyPart: buyPart,
    nextLevel: nextLevel, medalFor: medalFor, shopOpen: shopOpen, buyFuel: buyFuel, tier: tier,
    dryRestart: dryRestart, dryBuy: dryBuy
  };
})(window.CORE);
