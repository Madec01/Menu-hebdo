/* CORE — records locaux. */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';
  var KEY = 'core.records.v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || { levels: {}, total: null }; }
    catch (e) { return { levels: {}, total: null }; }
  }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

  CORE.SAVE = {
    all: load,
    record: function (levelId, time, medal) {
      var d = load();
      var cur = d.levels[levelId];
      if (!cur || time < cur.time) d.levels[levelId] = { time: time, medal: medal };
      save(d);
    },
    recordTotal: function (t) {
      var d = load();
      if (d.total === null || t < d.total) d.total = t;
      save(d);
    },
    best: function (levelId) { return load().levels[levelId] || null; },
    bestTotal: function () { return load().total; }
  };
})(window.CORE);
