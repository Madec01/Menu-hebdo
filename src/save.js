/* CORE — records locaux et fantomes. */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';
  var KEY = 'core.records.v2';
  var GKEY = 'core.ghosts.v2';

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
    reset: function () { save(KEY, { levels: {}, total: null }); save(GKEY, {}); }
  };
})(window.CORE);
