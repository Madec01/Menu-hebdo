/* CORE — records locaux et fantomes. */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';
  var KEY = 'core.records.v2';
  var GKEY = 'core.ghosts.v2';
  var MKEY = 'core.carnet.v1';

  function load(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) || def; }
    catch (e) { return def; }
  }
  function save(key, d) { try { localStorage.setItem(key, JSON.stringify(d)); } catch (e) {} }

  CORE.SAVE = {
    all: function () { return load(KEY, { levels: {}, total: null }); },
    /* renvoie true si c'est un nouveau record */
    record: function (levelId, time, medal) {
      var d = load(KEY, { levels: {}, total: null });
      var cur = d.levels[levelId];
      var isRecord = !cur || time < cur.time;
      if (isRecord) d.levels[levelId] = { time: time, medal: medal };
      save(KEY, d);
      return isRecord;
    },
    recordTotal: function (t) {
      var d = load(KEY, { levels: {}, total: null });
      if (d.total === null || t < d.total) d.total = t;
      save(KEY, d);
    },
    best: function (levelId) { return load(KEY, { levels: {} }).levels[levelId] || null; },
    bestTotal: function () { return load(KEY, { total: null }).total; },

    /* fantome : la trajectoire du meilleur passage, un point toutes les 80 ms */
    saveGhost: function (levelId, time, path) {
      var g = load(GKEY, {});
      g[levelId] = { t: time, p: path };
      save(GKEY, g);
    },
    ghost: function (levelId) {
      var g = load(GKEY, {})[levelId];
      return g && g.p && g.p.length >= 4 ? g : null;
    },
    reset: function () {
      save(KEY, { levels: {}, total: null }); save(GKEY, {}); save(MKEY, { stats: {}, unlocked: {} });
    },

    /* --------------------------------------------------------- LE CARNET */
    carnet: function () {
      var m = load(MKEY, null);
      if (!m) m = { stats: {}, unlocked: {} };
      if (!m.stats) m.stats = {};
      if (!m.unlocked) m.unlocked = {};
      return m;
    },
    /* Ajoute des compteurs et renvoie la liste des deblocages obtenus. */
    addStats: function (delta) {
      var m = CORE.SAVE.carnet();
      for (var k in delta) m.stats[k] = (m.stats[k] || 0) + delta[k];
      var neufs = CORE.SAVE.check(m);
      save(MKEY, m);
      return neufs;
    },
    /* Pose un record (max) plutot qu'un cumul. */
    setBest: function (key, value) {
      var m = CORE.SAVE.carnet();
      if ((m.stats[key] || 0) >= value) return [];
      m.stats[key] = value;
      var neufs = CORE.SAVE.check(m);
      save(MKEY, m);
      return neufs;
    },
    check: function (m) {
      var neufs = [];
      CORE.CFG.UNLOCKS.forEach(function (u) {
        if (m.unlocked[u.id]) return;
        if ((m.stats[u.stat] || 0) >= u.but) { m.unlocked[u.id] = 1; neufs.push(u); }
      });
      return neufs;
    },
    isUnlocked: function (id) { return !!CORE.SAVE.carnet().unlocked[id]; },
    /* Les trois deblocages les plus proches : c'est ce qui donne envie de relancer. */
    proches: function (n) {
      var m = CORE.SAVE.carnet();
      return CORE.CFG.UNLOCKS
        .filter(function (u) { return !m.unlocked[u.id]; })
        .map(function (u) {
          var v = m.stats[u.stat] || 0;
          return { u: u, valeur: v, part: Math.min(1, v / u.but) };
        })
        .sort(function (a, b) { return b.part - a.part; })
        .slice(0, n || 3);
    }
  };
})(window.CORE);
