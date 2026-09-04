// Persistent save (localStorage) : options, campaign progress, meta upgrades, codex, stats.
window.Save = (function () {
  const KEY = 'veille-aurelune-v1';
  const defaults = () => ({
    version: 1,
    options: { music: 0.7, sfx: 0.9, ambience: 0.6, shake: true, layout: 'azerty', lang: 'fr', particles: 'high', showFps: false, autoAim: true, tutorialHints: true },
    campaign: { unlocked: 1, completed: {}, best: {} },
    meta: { braises: 0, totalBraises: 0, upgrades: {} },
    codex: {},
    stats: { nightsSurvived: 0, goblinsSlain: 0, goldEarned: 0, buildingsBuilt: 0, deaths: 0, playTime: 0, endlessBest: 0 },
    seen: { intro: false, tutorial: false },
    endingsSeen: {},
  });
  let data = null;
  function deepMerge(a, b) { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) { a[k] = deepMerge(a[k] && typeof a[k] === 'object' ? a[k] : {}, b[k]); } else a[k] = b[k]; } return a; }
  function load() {
    data = defaults();
    try { const raw = localStorage.getItem(KEY); if (raw) deepMerge(data, JSON.parse(raw)); } catch (e) { console.warn('save load failed', e); }
    return data;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('save failed', e); } }
  function reset() { data = defaults(); save(); return data; }
  function get() { return data || load(); }
  return { load, save, reset, get };
})();
