/* =========================================================================
   SALLE ZÉRO — 20_progression.js
   Stats (agrégation des modificateurs), raretés, XP, scores de salle, argent.
   ========================================================================= */

const BASE_STATS = {
  maxHp: 100, speed: 260, damage: 1, fireRate: 1, critChance: 0.05, critMult: 1.5,
  pierce: 0, bounce: 0, projectiles: 0, projSpeed: 1, range: 1, areaSize: 1, knockback: 1,
  armor: 0, regen: 0, dodge: 0, lifesteal: 0, thorns: 0, trapDamageMul: 1,
  xpGain: 1, coinGain: 1, luck: 0, cooldownReduction: 0, pickupRadius: 60, skillPower: 1, invulnTime: 0.6,
};
const STAT_LABELS = {
  maxHp: 'PV max', speed: 'Vitesse', damage: 'Dégâts', fireRate: 'Cadence', critChance: 'Chance de crit', critMult: 'Dégâts de crit',
  pierce: 'Perforation', bounce: 'Rebonds', projectiles: 'Projectiles', projSpeed: 'Vitesse de tir', range: 'Portée', areaSize: 'Zone',
  knockback: 'Recul', armor: 'Armure', regen: 'Régénération', dodge: 'Esquive', lifesteal: 'Vol de vie', thorns: 'Épines',
  trapDamageMul: 'Dégâts de pièges subis', xpGain: 'Gain d\'XP', coinGain: 'Gain de crédits', luck: 'Chance', cooldownReduction: 'Réduction de cooldown',
  pickupRadius: 'Rayon de ramassage', skillPower: 'Puissance de compétence', invulnTime: 'Invulnérabilité',
};
const HOOK_NAMES = ['onHit', 'onKill', 'onDash', 'onSkill', 'onDamaged', 'onRoomStart', 'onLevelUp', 'onTrapDamage', 'passive'];
const KNOWN_EFFECTS = new Set(['burn', 'freeze', 'poison', 'chain', 'explode', 'heal_on_kill', 'coin_on_kill', 'fire_trail', 'shockwave',
  'shield_on_room', 'heal_on_room', 'reroll_on_levelup', 'traps_heal', 'projectiles_return', 'orbit_shield', 'glass_cannon', 'double_skill',
  'time_slow_on_damage', 'fragments_double', 'second_chance', 'crit_explode', 'kill_speed', 'xp_magnet', 'bullet_time_skill', 'skill_reset_on_kill', 'charge_speed', 'speed_burst']);

const Progression = (() => {
  /* --- Agrégation : sources = [{mods:[], hooks:{}, stacks}] --- */
  function computeStats(sources) {
    const add = {}, mul = {};
    for (const src of sources) {
      const n = src.stacks || 1;
      for (const m of (src.mods || [])) {
        if (!(m.stat in BASE_STATS)) { console.warn('[Content] stat inconnue', m.stat); continue; }
        if (m.add) add[m.stat] = (add[m.stat] || 0) + m.add * n;
        if (m.mul) mul[m.stat] = (mul[m.stat] || 1) * Math.pow(m.mul, n);
      }
    }
    const out = {};
    for (const k in BASE_STATS) out[k] = (BASE_STATS[k] + (add[k] || 0)) * (mul[k] || 1);
    out.maxHp = Math.max(1, Math.round(out.maxHp));
    out.critChance = clamp(out.critChance, 0, 1); out.dodge = clamp(out.dodge, 0, 0.75);
    out.cooldownReduction = clamp(out.cooldownReduction, 0, 0.8); out.pierce = Math.round(out.pierce); out.bounce = Math.round(out.bounce);
    out.projectiles = Math.round(out.projectiles); out.trapDamageMul = Math.max(0, out.trapDamageMul);
    return out;
  }
  function collectHooks(sources) {
    const hooks = {}; for (const h of HOOK_NAMES) hooks[h] = [];
    for (const src of sources) {
      const n = src.stacks || 1;
      for (const h in (src.hooks || {})) {
        if (!hooks[h]) { console.warn('[Content] hook inconnu', h); continue; }
        for (const e of src.hooks[h]) {
          if (!KNOWN_EFFECTS.has(e.effect)) { console.warn('[Content] effet inconnu', e.effect); continue; }
          hooks[h].push(Object.assign({ stacks: n, source: src.id }, e));
        }
      }
    }
    return hooks;
  }
  const hasPassive = (hooks, effect) => hooks.passive.find(e => e.effect === effect);

  /* --- Raretés --- */
  function rarityWeights(luck, opts = {}) {
    const w = { common: 60, rare: 27, epic: 10, colossal: 3 };
    const shift = clamp(luck, -30, 40);       // +1 luck ≈ +1 % retiré au commun
    w.common -= shift; w.epic += shift * 0.6; w.colossal += shift * 0.4;
    if (opts.shiftEpic) { w.common *= 0.4; w.rare *= 0.8; w.epic *= 2.2; w.colossal *= 1.5; }
    if (opts.noColossal) w.colossal = 0;
    if (opts.force && RARITY[opts.force]) { for (const k in w) w[k] = 0; w[opts.force] = 1; }
    for (const k in w) w[k] = Math.max(0, w[k]);
    return w;
  }
  function rollRarity(luck, opts, rng = RNG) {
    const w = rarityWeights(luck, opts); const total = RARITY_ORDER.reduce((s, k) => s + w[k], 0);
    let r = rng() * total;
    for (const k of RARITY_ORDER) { r -= w[k]; if (r <= 0) return k; }
    return 'common';
  }
  /* Tirage de N améliorations. pool = upgrades applicables (déjà filtrées). counts = {id: stacks}. */
  function drawUpgrades(pool, n, luck, opts = {}, rng = RNG) {
    const picked = []; const used = new Set();
    const byRarity = r => pool.filter(u => u.rarity === r && !used.has(u.id));
    const takeAt = rarity => {
      let idx = RARITY_ORDER.indexOf(rarity);
      while (idx >= 0) { const c = byRarity(RARITY_ORDER[idx]); if (c.length) { const u = rng.pick(c); used.add(u.id); return u; } idx--; }
      const c = pool.filter(u => !used.has(u.id)); if (c.length) { const u = rng.pick(c); used.add(u.id); return u; } return null;
    };
    const guaranteed = opts.guarantee ? [opts.guarantee] : [];
    for (const g of guaranteed) { const u = takeAt(g); if (u) picked.push(u); }
    while (picked.length < n) {
      const u = takeAt(rollRarity(luck, opts, rng)); if (!u) break; picked.push(u);
    }
    return rng.shuffle(picked);
  }
  /* Plancher de coffre selon score moyen */
  function chestOptions(avgScore, diedInWindow) {
    if (diedInWindow) return { noColossal: true, label: 'Sujet perdu : tirage dégradé' };
    if (avgScore >= 0.999) return { guarantee: 'colossal', shiftEpic: true, label: 'Sans dégât : Colossal garanti' };
    if (avgScore >= 0.8) return { guarantee: 'epic', shiftEpic: true, label: 'Épique garanti' };
    if (avgScore >= 0.5) return { guarantee: 'rare', label: 'Rare garanti' };
    return { label: 'Tirage normal' };
  }

  /* --- XP --- */
  const xpForLevel = lvl => Math.round(14 + 9 * lvl + 1.3 * lvl * lvl);

  /* --- Score de salle --- */
  function roomScore(r) {
    if (r.died) return 0;
    const fragK = r.fragmentsTotal ? clamp(r.fragments / r.fragmentsTotal, 0, 1) : 1;   // salle de pièges : les fragments comptent
    if (r.hits === 0) return fragK >= 1 ? 1 : clamp(0.8 + 0.2 * fragK, 0, 0.99);
    const dmg = Math.max(0, 1 - r.hits * 0.2);
    const time = r.refTime ? clamp(r.refTime / Math.max(1, r.time), 0, 1) : 1;
    const combo = clamp(r.bestCombo / Math.max(1, r.comboTarget || 8), 0, 1);
    return clamp((dmg * 0.8 + time * 0.1 + combo * 0.1) * (0.85 + 0.15 * fragK), 0, 0.99);
  }
  function avgScore(scores) { return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1; }
  function bestN(scores, n) { return scores.slice().sort((a, b) => b - a).slice(0, n); }

  /* --- Argent : règle validée. checkpoint = index de la dernière salle checkpoint (0 au départ). --- */
  function coinsKeptOnDeath(pending, roomIndex, lastCheckpoint) {
    const frac = clamp(0.1 * (roomIndex - lastCheckpoint), 0, 1);
    return Math.floor(pending * frac);
  }

  return { computeStats, collectHooks, hasPassive, rarityWeights, rollRarity, drawUpgrades, chestOptions, xpForLevel, roomScore, avgScore, bestN, coinsKeptOnDeath };
})();
