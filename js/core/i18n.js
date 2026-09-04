// Localisation FR / EN. T('key', {vars}) — falls back to FR then to the key itself.
window.I18N = (function () {
  let lang = 'fr';
  const dict = { fr: {}, en: {} };
  function add(l, obj) { Object.assign(dict[l], obj); }
  function set(l) { lang = dict[l] ? l : 'fr'; }
  function get() { return lang; }
  function T(key, vars) {
    let s = dict[lang][key]; if (s == null) s = dict.fr[key]; if (s == null) return key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  window.T = T;
  return { add, set, get, T };
})();
