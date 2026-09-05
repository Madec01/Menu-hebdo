/* =========================================================================
   SALLE ZÉRO — 60_meta.js
   Méta-progression : profils Normal (localStorage) / Test (tout débloqué, jamais sauvegardé), argent, passifs, déblocages.
   ========================================================================= */

const SAVE_KEY = 'sujet_neuf_save_v1';
const Meta = (() => {
  const fresh = () => ({ v: 1, coins: 0, metaTiers: {}, weapons: [], characters: [], skills: [], lore: [], runs: 0, wins: 0, deaths: 0, bestLevel: 0, character: null, volume: { master: 0.8, sfx: 0.9, music: 0.6 } });
  let normal = fresh(); let test = null; let profile = normal;
  function load() {
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) { const d = JSON.parse(raw); if (d && d.v === 1) normal = Object.assign(fresh(), d); } } catch (e) { console.warn('[Meta] sauvegarde illisible', e); }
    profile = normal; ensureDefaults(normal);
  }
  function ensureDefaults(p) {
    for (const w of Content.weapons()) if (w.unlocked && !p.weapons.includes(w.id)) p.weapons.push(w.id);
    for (const c of Content.characters()) if (c.unlocked && !p.characters.includes(c.id)) p.characters.push(c.id);
    if (!p.character || !p.characters.includes(p.character)) p.character = p.characters[0];
  }
  function save() { if (profile !== normal) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(normal)); } catch (e) { /* stockage indisponible */ } }
  function reset() { normal = fresh(); ensureDefaults(normal); profile = normal; save(); }
  function setMode(mode) {
    G.mode = mode;
    if (mode === 'test') {
      test = fresh(); test.coins = 99999; test.weapons = Content.weapons().map(w => w.id); test.characters = Content.characters().map(c => c.id); test.character = test.characters[0];
      for (const m of Content.metaPassives()) test.metaTiers[m.id] = m.tiers.length; test.lore = LORE.fragments.map(f => f.id); test.volume = Object.assign({}, normal.volume); profile = test;
    } else if (mode === 'sandbox') { const sb = fresh(); ensureDefaults(sb); sb.volume = Object.assign({}, normal.volume); profile = sb; G.mode = 'normal'; }
    else profile = normal;
  }
  const tierOf = id => profile.metaTiers[id] || 0;
  function setTier(id, t) { profile.metaTiers[id] = clamp(t, 0, (Content.metaPassive(id) || { tiers: [] }).tiers.length); save(); }
  function buy(id) {
    const m = Content.metaPassive(id); if (!m) return false; const t = tierOf(id); if (t >= m.tiers.length) return false;
    const price = m.tiers[t].price; if (profile.coins < price) return false;
    profile.coins -= price; profile.metaTiers[id] = t + 1; save(); AudioEngine.uiConfirm({}); return true;
  }
  function buyWeapon(id) { const w = Content.weapon(id); if (!w || profile.weapons.includes(id) || profile.coins < w.price) return false; profile.coins -= w.price; profile.weapons.push(id); save(); AudioEngine.uiConfirm({}); return true; }
  function buyCharacter(id) { const c = Content.character(id); if (!c || profile.characters.includes(id) || profile.coins < c.price) return false; profile.coins -= c.price; profile.characters.push(id); save(); AudioEngine.uiConfirm({}); return true; }
  /* sources de stats actives (tous les paliers achetés) */
  function activeSources() {
    const out = [];
    for (const m of Content.metaPassives()) { const t = tierOf(m.id); for (let i = 0; i < t; i++) { const tier = m.tiers[i]; out.push({ id: m.id + '_' + i, mods: tier.mods || [], hooks: (tier.special === 'resurrect') ? {} : (tier.hooks || {}) }); } }
    return out;
  }
  function special(name) { let best = null; for (const m of Content.metaPassives()) { const t = tierOf(m.id); for (let i = 0; i < t; i++) if (m.tiers[i].special === name) best = m.tiers[i]; } return best; }
  function resurrectAvailable() { const t = special('resurrect'); if (!t) return null; const h = t.hooks && t.hooks.passive && t.hooks.passive.find(e => e.effect === 'second_chance'); return h || { hpFraction: 0.25 }; }
  const selectiveMemory = () => !!special('selective_memory');
  const chestPreview = () => !!special('chest_preview');
  const fourthChoice = () => !!special('fourth_choice');
  function rerolls() { let n = 0; for (const m of Content.metaPassives()) { const t = tierOf(m.id); for (let i = 0; i < t; i++) if (m.tiers[i].special === 'reroll') n++; } return n; }
  function addCoins(n) { profile.coins += Math.max(0, Math.round(n)); save(); }
  function recordRun(win) { profile.runs++; if (win) profile.wins++; else profile.deaths++; if (G.run) profile.bestLevel = Math.max(profile.bestLevel, G.run.level); save(); }
  function unlockLore(id) {
    if (id === 'deaths_3' && profile.deaths < 3) return;
    if (!LORE.fragments.find(f => f.id === id) || profile.lore.includes(id)) return;
    profile.lore.push(id); save(); const f = LORE.fragments.find(x => x.id === id); UI.toast('Fragment débloqué : ' + f.title, 6);
  }
  return { load, save, reset, setMode, tierOf, setTier, buy, buyWeapon, buyCharacter, activeSources, special, resurrectAvailable, selectiveMemory, chestPreview, fourthChoice, rerolls, addCoins, recordRun, unlockLore,
    get profile() { return profile; }, get coins() { return profile.coins; },
    weaponUnlocked: id => profile.weapons.includes(id), characterUnlocked: id => profile.characters.includes(id), skillUnlocked: () => true, loreUnlocked: id => profile.lore.includes(id) };
})();
