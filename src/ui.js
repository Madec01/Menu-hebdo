/* CORE — HUD et ecrans (DOM). */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';

  var CFG = CORE.CFG, C = CORE.CONTENT, GAME = CORE.GAME, G = GAME.G;
  var $ = function (id) { return document.getElementById(id); };

  function fmt(t) { return t.toFixed(1); }
  function fmtLong(t) {
    var m = Math.floor(t / 60), s = t - m * 60;
    return m > 0 ? m + 'm ' + s.toFixed(1) + 's' : s.toFixed(1) + 's';
  }

  function show(id) {
    ['scMenu', 'scStation', 'scEnd', 'scCarnet', 'scTest'].forEach(function (s) { $(s).classList.remove('on'); });
    if (id) $(id).classList.add('on');
    $('hud').style.display = id ? 'none' : 'block';
  }

  /* ---------------------------------------------------------------- MENU */
  var chosenTier = 0;

  function buildTiers() {
    var host = $('tiers');
    host.innerHTML = '';
    CFG.DEPTHS.forEach(function (dp, i) {
      var open = i === 0 || CORE.SAVE.isUnlocked(i === 1 ? 'profondeur2' : 'profondeur3');
      if (!open && i > 0 && !CORE.SAVE.isUnlocked('profondeur2')) { /* affiche quand meme, grise */ }
      var el = document.createElement('div');
      el.className = 'tier' + (open ? (i === chosenTier ? ' on' : '') : ' no');
      el.textContent = dp.nom + (open ? '' : ' (verrouille)');
      el.onclick = function () { if (!open) return; chosenTier = i; buildTiers(); };
      host.appendChild(el);
    });
  }

  function progressRow(p) {
    var pct = Math.round(p.part * 100);
    return '<div class="prog' + (p.part >= 1 ? ' done' : '') + '">' +
      '<span class="pl">' + p.u.nom + '</span>' +
      '<span class="pb"><i style="width:' + pct + '%"></i></span>' +
      '<span class="pv">' + Math.min(p.valeur, p.u.but) + ' / ' + p.u.but + '</span></div>';
  }

  function buildCarnet() {
    var m = CORE.SAVE.carnet();
    var st = m.stats;
    $('carnetStats').innerHTML =
      'expeditions <b>' + (st.runs || 0) + '</b> &nbsp;·&nbsp; terminees <b>' + (st.finished || 0) + '</b>' +
      ' &nbsp;·&nbsp; profondeur record <b>' + (st.bestDepth || 0) + ' m</b><br>' +
      'minerai <b>' + (st.ore || 0) + '</b> &nbsp;·&nbsp; bidons <b>' + (st.cans || 0) + '</b>' +
      ' &nbsp;·&nbsp; bonus <b>' + (st.bonuses || 0) + '</b> &nbsp;·&nbsp; effondrements <b>' +
      (st.collapses || 0) + '</b> &nbsp;·&nbsp; ensevelissements <b>' + (st.buried || 0) + '</b>';
    $('carnetList').innerHTML = CFG.UNLOCKS.map(function (u) {
      var v = st[u.stat] || 0;
      var done = !!m.unlocked[u.id];
      return '<div class="prog' + (done ? ' done' : '') + '">' +
        '<span class="pl">' + (done ? '[x] ' : '') + u.nom +
        '<span style="color:var(--dim)"> — ' + u.desc + '</span></span>' +
        '<span class="pb"><i style="width:' + Math.round(Math.min(1, v / u.but) * 100) + '%"></i></span>' +
        '<span class="pv">' + Math.min(v, u.but) + ' / ' + u.but + '</span></div>';
    }).join('');
    show('scCarnet');
  }

  /* ------------------------------------------------------------ MODE TEST */
  var TOGGLES = [
    { id: 'fuel', nom: 'Carburant infini' },
    { id: 'invincible', nom: 'Invincible' },
    { id: 'faille', nom: 'Faille desactivee' },
    { id: 'reveal', nom: 'Tout reveler' },
    { id: 'fast', nom: 'Forage x3' },
    { id: 'belt', nom: 'Charges infinies' }
  ];
  var testTier = 0;

  function buildTest() {
    var enJeu = !!(G.run && G.state === 'play');

    var lv = $('testLevels');
    lv.innerHTML = '';
    CFG.LEVELS.forEach(function (def, i) {
      var el = document.createElement('div');
      el.className = 'lvlbtn';
      el.innerHTML = '<b>' + def.id + '</b><span>' + def.name + '<br>' + def.type + '</span>';
      el.onclick = function () {
        CORE.SFX.init();
        if (enJeu) { GAME.testJump(i); }
        else { GAME.startTest(i, testTier); }
        G.paused = false;
        show(null);
      };
      lv.appendChild(el);
    });

    var tr = $('testTiers');
    tr.innerHTML = '';
    CFG.DEPTHS.forEach(function (dp, i) {
      var el = document.createElement('div');
      el.className = 'tier' + (i === testTier ? ' on' : '');
      el.textContent = dp.nom;
      el.onclick = function () {
        testTier = i;
        if (G.run) G.run.depth = i;
        buildTest();
      };
      tr.appendChild(el);
    });

    var tg = $('testToggles');
    tg.innerHTML = '';
    TOGGLES.forEach(function (t) {
      var el = document.createElement('div');
      el.className = 'tg' + (G.test[t.id] ? ' on' : '');
      el.innerHTML = '<span class="box2"></span>' + t.nom;
      el.onclick = function () { G.test[t.id] = !G.test[t.id]; buildTest(); };
      tg.appendChild(el);
    });

    var gv = $('testGives');
    gv.innerHTML = '';
    var dons = [['ing', 'Tous les ingredients'], ['fuel', 'Plein de carburant'],
                ['gold', '+5000 $'], ['hp', 'Integrite au max']];
    CFG.RECIPES.forEach(function (r) { dons.push([r.id, r.icon + ' ' + r.nom]); });
    dons.forEach(function (d) {
      var el = document.createElement('div');
      el.className = 'give';
      el.textContent = d[1];
      el.onclick = function () { if (G.run) { GAME.testGive(d[0]); buildTest(); } };
      gv.appendChild(el);
    });

    $('testGo').textContent = enJeu ? 'REPRENDRE' : 'LANCER AU NIVEAU 1-1';
    $('testGo').onclick = function () {
      CORE.SFX.init();
      if (!enJeu) GAME.startTest(0, testTier);
      G.paused = false;
      show(null);
    };
    show('scTest');
  }

  function toggleTest() {
    if (G.state !== 'play') return;
    if ($('scTest').classList.contains('on')) { G.paused = false; show(null); }
    else { G.paused = true; buildTest(); }
  }

  function buildMenu() {
    var host = $('jobs');
    host.innerHTML = '';
    var rng = CORE.makeRng((Math.random() * 1e9) | 0);
    var pool = C.JOBS.filter(C.ouvert);
    rng.shuffle(pool);
    pool.slice(0, 3).forEach(function (job) {
      var el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = '<div class="fam">METIER</div><div class="nm">' + job.name +
        '</div><div class="ds">' + job.desc + '</div>';
      el.onclick = function () {
        CORE.SFX.init();
        GAME.startRun(job, chosenTier);
        show(null);
      };
      host.appendChild(el);
    });
    buildTiers();
    var bt = CORE.SAVE.bestTotal();
    var pr = CORE.SAVE.proches(2);
    $('bestTotal').innerHTML =
      (bt ? 'Meilleure expedition : ' + fmtLong(bt) + '<br>' : '') +
      (pr.length ? '<span style="color:var(--dim)">a debloquer : ' +
        pr.map(function (p) { return p.u.nom + ' (' + Math.min(p.valeur, p.u.but) + '/' + p.u.but + ')'; })
          .join(' &nbsp;·&nbsp; ') + '</span>' : '');
    show('scMenu');
  }

  /* -------------------------------------------------------------- STATION */
  function buildStation() {
    var r = G.lastResult;
    $('stTime').textContent = fmt(r.time);
    var med = r.medal || 'none';
    $('stMedal').className = 'medal m-' + med;
    $('stMedal').textContent = (r.medal ? 'medaille ' + r.medal : 'hors delai') +
      (r.record ? ' · RECORD' : '');
    var best = CORE.SAVE.best(r.def.id);
    $('stBest').textContent = 'record ' + (best ? fmt(best.time) + 's' : '-') +
      '  ·  or ' + r.def.gold + 's  ·  minerai ' + r.ore;

    $('stChallenges').innerHTML = r.challenges.map(function (c) {
      return '<span style="color:' + (c.done ? '#78ffb4' : '#5f6673') + ';margin:0 10px">' +
        (c.done ? '[x] ' : '[ ] ') + c.def.label +
        (c.done ? ' <b>+' + c.def.gold + ' $</b>' : '') + '</span>';
    }).join('');

    var cards = $('stCards');
    cards.innerHTML = '';
    G.drawnCards.forEach(function (p) {
      var owned = G.run.passives[p.id] || 0;
      var el = document.createElement('div');
      el.className = 'card' + (p.pact ? ' pact' : '');
      el.innerHTML = '<span class="rar r' + (p.pact ? 'p' : p.rar) + '">' +
        (p.pact ? 'pacte' : C.RAR_NAME[p.rar]) + '</span>' +
        '<div class="fam">' + p.fam + (owned ? ' · deja x' + owned : '') + '</div>' +
        '<div class="nm">' + p.name + '</div><div class="ds">' + p.desc + '</div>';
      el.onclick = function () {
        if (G.cardChosen) return;
        GAME.chooseCard(p);
        Array.prototype.forEach.call(cards.children, function (c) { c.classList.add('off'); });
        el.classList.remove('off');
        el.classList.add('sel');
        CORE.SFX.bonusTier(2);
        refreshNext();
        buildShop();
      };
      cards.appendChild(el);
    });

    buildShop();
    refreshNext();
    show('scStation');
  }

  function refreshNext() {
    var btn = $('stNext');
    btn.disabled = !G.cardChosen;
    btn.textContent = G.cardChosen
      ? (G.lastResult.last ? 'PERCER LE COEUR' : 'NIVEAU SUIVANT — PLEIN FAIT')
      : 'CHOISIS UNE CARTE';
  }

  function buildShop() {
    $('stGold').textContent = G.run.gold + ' $';
    var open = GAME.shopOpen();
    $('stShopNote').textContent = open ? '' : '  — fermee : pacte de l\'avare';
    var host = $('stShop');
    host.innerHTML = '';

    // Le carburant ne se remplit plus tout seul : on l'achete ici, ou on le
    // trouve dans la roche pendant la descente.
    var stats = GAME.computeStats();
    var carry = G.run.fuelCarry === undefined ? stats.fuelMax : G.run.fuelCarry;
    var full = carry >= stats.fuelMax;
    var canBuy = open && !full && G.run.gold >= CFG.FUEL.canPrice;
    var fuelEl = document.createElement('div');
    fuelEl.className = 'part fuel' + (canBuy ? '' : ' no');
    fuelEl.innerHTML = '<div class="pn">Bidon de carburant</div>' +
      '<div class="pd">+' + CFG.FUEL.canSize + ' L &nbsp;·&nbsp; reservoir ' +
      Math.round(carry) + ' / ' + Math.round(stats.fuelMax) + ' L</div>' +
      '<div class="pc">' + (full ? 'PLEIN' : CFG.FUEL.canPrice + ' $') + '</div>';
    fuelEl.onclick = function () {
      if (GAME.buyFuel()) { CORE.SFX.fuel(); buildShop(); }
    };
    host.appendChild(fuelEl);
    C.PARTS.filter(C.ouvert).forEach(function (part) {
      var owned = G.run.parts[part.id] || 0;
      var cost = C.partCost(part, owned);
      var maxed = owned >= part.max;
      var can = open && !maxed && G.run.gold >= cost;
      var el = document.createElement('div');
      el.className = 'part' + (can ? '' : ' no');
      el.innerHTML = '<div class="pn">' + part.name + ' <span style="color:var(--dim)">x' + owned + '</span></div>' +
        '<div class="pd">' + part.desc + '</div>' +
        '<div class="pc">' + (maxed ? 'MAX' : cost + ' $') + '</div>';
      el.onclick = function () {
        if (GAME.buyPart(part)) { CORE.SFX.gold(); buildShop(); }
      };
      host.appendChild(el);
    });
  }

  /* ------------------------------------------------------------------ FIN */
  function buildEnd() {
    var run = G.run;
    var neufs = (G.endUnlocked || []).concat(G.unlocked || []);
    $('endUnlocks').innerHTML = neufs.length
      ? neufs.map(function (u) {
          return '<div class="unlock"><div class="un">DEBLOQUE — ' + u.nom + '</div>' +
            '<div class="ud">' + u.desc + '</div></div>';
        }).join('')
      : '';
    $('endProgress').innerHTML = CORE.SAVE.proches(3).map(progressRow).join('') ||
      '<div class="prog"><span class="pl">tout est debloque</span></div>';
    $('endSub').innerHTML = 'Expedition terminee en <b style="color:var(--acc);font-size:20px">' +
      fmtLong(run.total) + '</b>' +
      (CORE.SAVE.bestTotal() === run.total ? '<br><span style="color:var(--or)">nouveau record</span>' : '');
    var t = $('endTable');
    t.innerHTML = '';
    CFG.LEVELS.forEach(function (def, i) {
      var tr = document.createElement('tr');
      var med = run.medals[i] || 'none';
      tr.innerHTML = '<td>' + def.id + ' · ' + def.name + '</td>' +
        '<td style="color:var(--dim)">' + def.type + '</td>' +
        '<td class="medal m-' + med + '" style="font-size:11px">' + (run.medals[i] || '-') + '</td>' +
        '<td>' + fmt(run.splits[i]) + 's</td>';
      t.appendChild(tr);
    });
    show('scEnd');
  }

  /* ------------------------------------------------------------------ HUD */
  function updateHud() {
    if (G.state !== 'play') return;
    var d = G.drill, w = G.world, def = w.def, s = G.stats;
    var depth = Math.max(0, Math.round(def.top + d.y - w.top));
    $('mDepth').textContent = depth;
    $('mTime').textContent = fmt(G.levelTime);
    var goal = G.levelTime <= def.gold ? 'OR ' + def.gold + 's'
      : (G.levelTime <= def.silver ? 'ARGENT ' + def.silver + 's'
        : (G.levelTime <= def.bronze ? 'BRONZE ' + def.bronze + 's' : 'hors delai'));
    $('mGoal').textContent = goal;
    $('mTime').style.color = G.buffs.some(function (b) { return b.def.freeze; }) ? '#5ff0e0' : '';

    $('lvlName').textContent = def.id + ' · ' + def.name;
    $('lvlSub').innerHTML = w.layer.name + '<br>force ' + s.force.toFixed(1) +
      ' · vitesse ' + s.speed.toFixed(1) + '<br>taille ' + s.width + ' x ' + s.length;
    $('gold').textContent = G.run.gold + ' $';
    $('oreCount').textContent = 'minerai ' + G.ore;

    $('quota').textContent = w.locked
      ? 'SORTIE SCELLEE — ' + G.ore + ' / ' + def.quota + ' minerai'
      : (def.type === 'sceau' ? 'un sceau barre le fond du puits' : '');

    $('combo').textContent = G.combo >= 3 ? 'COMBO ' + G.combo + '  x' + G.comboMult.toFixed(2) : '';

    var ban = $('eventBanner');
    if (G.event) {
      ban.style.display = 'block';
      ban.style.color = G.event.color;
      ban.style.borderColor = G.event.color;
      ban.textContent = G.event.name + '  ' + Math.ceil(G.eventT) + 's';
    } else {
      ban.style.display = 'none';
    }

    $('challenges').innerHTML = G.challenges.map(function (c) {
      var done = c.def.check(liveStats());
      return '<div class="' + (done ? 'ok' : 'ko') + '">' + c.def.label + '</div>';
    }).join('');

    var el = G.buffs.map(function (b) {
      var total = b.def.tiers && (b.def.freeze || b.def.noBurn) ? b.def.tiers[b.level - 1] : b.def.dur;
      var pct = Math.max(0, Math.min(1, b.t / total)) * 100;
      var lvl = ['I', 'II', 'III'][b.level - 1] || 'I';
      var blink = b.t < 3 ? 'opacity:' + (0.45 + 0.55 * Math.abs(Math.sin(G.time * 9))) + ';' : '';
      return '<div class="buff" style="' + blink + 'border-color:' + b.def.color + '">' +
        '<span class="ic" style="color:' + b.def.color + '">' + b.def.icon + '</span>' +
        b.def.name + ' ' + lvl +
        '<span class="bar"><i style="width:' + pct + '%;background:' + b.def.color + '"></i></span></div>';
    }).join('');
    $('buffs').innerHTML = el;

    var fw = $('fuelWrap');
    var fpct = Math.max(0, G.fuel / G.fuelMax);
    $('fuelBar').style.width = (fpct * 100).toFixed(0) + '%';
    $('fuelBar').style.background = G.reserve ? '#ff3b52'
      : (G.fuel < CFG.FUEL.alertAt ? 'linear-gradient(90deg,#c07820,#ffb03d)'
        : 'linear-gradient(90deg,#5f9c3a,#9be08a)');
    $('fuelLab').textContent = G.reserve ? 'PANNE SECHE' : Math.ceil(G.fuel) + ' / ' + Math.round(G.fuelMax) + ' L';
    fw.className = G.reserve ? 'dry' : (G.fuel < CFG.FUEL.alertAt ? 'low' : '');

    $('elanBar').style.width = (d.elan * 100).toFixed(0) + '%';
    var tb = d.turboT > 0 ? 100 : G.turboCharge * 100;
    $('turboBar').style.width = tb.toFixed(0) + '%';
    $('turboBar').style.background = G.turboCharge >= 1
      ? 'linear-gradient(90deg,#ffd24a,#fff2a8)' : 'linear-gradient(90deg,#5ff0e0,#7ec8ff)';
    $('turboLab').textContent = d.turboT > 0 ? 'ACTIF' : (G.turboCharge >= 1 ? 'PRET' : '');

    var belt = '';
    for (var bi = 0; bi < CFG.BELT_MAX; bi++) {
      var ch = G.belt[bi];
      belt += ch
        ? '<div class="ch" style="border-color:' + ch.color + ';color:' + ch.color +
          '" title="' + ch.nom + '">' + ch.icon + '</div>'
        : '<div class="ch empty">·</div>';
    }
    $('belt').innerHTML = belt;

    var sac = [];
    CFG.INGREDIENTS.forEach(function (g2) {
      var n = G.ing[g2.id] || 0;
      if (n > 0) sac.push('<span style="color:' + g2.color + '">' + g2.icon + n + '</span>');
    });
    $('sacoche').innerHTML = sac.join('');

    var pips = '';
    var maxHp = CFG.HP + (s.hpBonus || 0);
    for (var h = 0; h < maxHp; h++) pips += '<i class="' + (h < G.hp ? 'on' : 'off') + '"></i>';
    $('hp').innerHTML = pips;
    $('hp').style.opacity = G.iframes > 0 ? (0.4 + 0.6 * Math.abs(Math.sin(G.time * 20))) : 1;
    $('restartMsg').style.display = G.justRestarted > 0 ? 'block' : 'none';
    $('testBadge').style.display = G.test.on ? 'block' : 'none';

    var dry = $('dry');
    if (G.dryChoice && !dry.classList.contains('on')) {
      dry.classList.add('on');
      var can = G.run.gold >= CFG.FUEL.emergencyPrice;
      var btn = $('dryBuy');
      btn.disabled = !can;
      btn.textContent = can
        ? 'BIDON D\'URGENCE — ' + CFG.FUEL.emergencyPrice + ' $  (+' + CFG.FUEL.emergency + ' L)'
        : 'PAS ASSEZ D\'OR (' + CFG.FUEL.emergencyPrice + ' $)';
    } else if (!G.dryChoice && dry.classList.contains('on')) {
      dry.classList.remove('on');
    }

    var list = [];
    for (var id in G.run.passives) {
      var p = C.PASSIVE_BY_ID[id];
      if (p) list.push(p.name + (G.run.passives[id] > 1 ? ' x' + G.run.passives[id] : ''));
    }
    $('passivelist').textContent = list.join(' · ');
  }

  /* etat courant pour l'affichage des defis en cours de niveau */
  function liveStats() {
    var st = G.st;
    return {
      up: st.up, bonus: st.bonus, reserve: st.reserve, ore: st.ore,
      bigFall: st.bigFall, fuelEnd: G.fuel,
      straight: Math.max(st.straight, G.drill ? G.drill.straightBest : 0)
    };
  }

  CORE.UI = {
    buildMenu: buildMenu, buildStation: buildStation, buildEnd: buildEnd,
    updateHud: updateHud, show: show, fmt: fmt, fmtLong: fmtLong,
    buildTest: buildTest, toggleTest: toggleTest,
    bind: function () {
      $('stNext').onclick = function () {
        GAME.nextLevel();
        if (G.state === 'end') buildEnd(); else show(null);
      };
      $('endAgain').onclick = function () { buildMenu(); };
      $('openCarnet').onclick = function () { buildCarnet(); };
      $('openTest').onclick = function () { G.test.on = true; buildTest(); };
      $('testBack').onclick = function () {
        G.test.on = false; G.paused = false;
        for (var k in G.test) if (k !== 'on') G.test[k] = false;
        buildMenu();
      };
      $('closeCarnet').onclick = function () { buildMenu(); };
      $('dryBuy').onclick = function () { GAME.dryBuy(); $('dry').classList.remove('on'); };
      $('dryRestart').onclick = function () { GAME.dryRestart(); $('dry').classList.remove('on'); };
    }
  };
})(window.CORE);
