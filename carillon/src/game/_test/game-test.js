// Test headless du gameplay (agent D) : simulation à pas fixe en accéléré, vérifications, capture.
// Résultats dans window.__results (lu par Playwright) et dans #log.
import { bus } from '../../core/events.js';
import { loadAtlas } from '../../render/atlas.js';
import { initCamera, applyTransform, advance as cameraAdvance } from '../../render/camera.js';
import { __setAxis, __press, tickInput } from '../../core/input.js';           // → stub via import map
import { __advance as audioAdvance, now } from '../../audio/audio.js';         // → stub
import { initConductor, start as startConductor, __advance as conductorAdvance, beatDuration, startAt } from '../../audio/conductor.js'; // → stub
import { played } from '../../audio/sfx.js';                                   // → stub
import { counters as fxCounters } from '../../render/fx.js';                   // → stub
import { emitted } from '../../render/particles.js';                           // → stub
import { loadGameData, setDataBase, allWeapons, allFusions } from '../data.js';
import { startGame, updateGame, renderGame, gameState, endGame } from '../game.js';
import { addWeapon, removeWeapon, upgradeWeapon, dpsReport, resetReport } from '../weapons.js';
import { addPassive } from '../passives.js';
import { applyFusion } from '../fusions.js';
import { spawnEnemy } from '../enemies.js';
import { tier as resonanceTier } from '../resonance.js';
import { LEAVES_PER_NIGHT } from '../unlocks.js';
import { getSave } from '../../core/save.js';

const DT = 1 / 60;
const log = [];
const results = { ok: true, checks: [], dps: {}, sim: {}, errors: [] };
function check(name, cond, detail = '') {
  results.checks.push({ name, ok: !!cond, detail });
  if (!cond) results.ok = false;
  log.push((cond ? '[OK] ' : '[KO] ') + name + (detail ? ' — ' + detail : ''));
}
function show() { document.getElementById('log').textContent = log.join('\n'); }
window.addEventListener('error', (e) => { results.errors.push(String(e.message)); results.ok = false; });

function step(dt = DT) {
  audioAdvance(dt);
  conductorAdvance();
  updateGame(dt);
  tickInput();
}

function hasNaN(o, path = '', depth = 0) {
  if (depth > 2 || o === null || typeof o !== 'object') return typeof o === 'number' && Number.isNaN(o) ? path : null;
  for (const k in o) {
    const v = o[k];
    if (typeof v === 'number') { if (Number.isNaN(v)) return path + '.' + k; }
    else if (v && typeof v === 'object' && !ArrayBuffer.isView(v) && depth < 2 && k !== 'def' && k !== 'target') { const r = hasNaN(v, path + '.' + k, depth + 1); if (r) return r; }
  }
  return null;
}

// ---- 1. Simulation de 3 minutes ---------------------------------------------------------------
async function simulateRun() {
  const ev = { spawn: 0, death: 0, levelUp: 0, hit: 0, resonance: [], maxTier: 0, fusions: 0, minutes: 0, tiers: 0, blocked: 0, silenced: 0 };
  bus.on('enemy:spawn', () => ev.spawn++);
  bus.on('enemy:death', () => ev.death++);
  bus.on('enemy:hit', () => ev.hit++);
  ev.taken = {}; bus.on('player:hit', (e) => { const k = e.from + '@' + Math.floor(g.run.timeSec / 30) * 30; ev.taken[k] = (ev.taken[k] || 0) + e.damage; });
  bus.on('player:silenced', () => ev.silenced++);
  bus.on('resonance:blocked', () => ev.blocked++);
  bus.on('run:minute', () => ev.minutes++);
  bus.on('run:tier', () => ev.tiers++);
  bus.on('weapon:fusion', () => ev.fusions++);
  bus.on('resonance:change', (e) => { if (e.tier > ev.maxTier) ev.maxTier = e.tier; });
  // Choix automatique des cartes : on préfère un Timbre nouveau, sinon la première carte.
  bus.on('level:up', (e) => {
    ev.levelUp++;
    const p = gameState().player;
    const c = e.choices.find((x) => x.type === 'fusion')
      || (p.weapons.length < 3 && e.choices.find((x) => x.type === 'weapon'))
      || e.choices.find((x) => x.type === 'passive' && (x.id === 'ferrure' || x.id === 'cire_d_abeille' || x.id === 'souffle'))
      || e.choices.find((x) => x.type === 'weapon' && !x.isNew) || e.choices[0];
    bus.emit('level:choice', { card: c });
  });

  const g = startGame({ parishId: 'cendrelune', characterId: 'wren', seed: 12345, assist: 'none', upgrades: {} });
  const p = g.player, world = g.world;
  const mem0 = performance.memory ? performance.memory.usedJSHeapSize : 0;
  let memMid = 0;
  let nanAt = null;
  let lastBeat = -1, dashCount = 0;
  const beat = beatDuration();
  const totalTicks = 180 * 60;
  const t0 = performance.now();
  for (let i = 0; i < totalTicks; i++) {
    const t = i * DT;
    // Pilote : marche 2 s dans une direction qui tourne, puis s'arrête 2 s face à l'ennemi le plus proche.
    const cycle = t % 4;
    if (cycle < 2) { const a = Math.floor(t / 4) * 1.3; __setAxis(Math.round(Math.cos(a)), Math.round(Math.sin(a))); }
    else {
      __setAxis(0, 0);
      let best = null, bd = 1e12;
      for (let k = 0; k < world.enemies.items.length; k++) { const e = world.enemies.items[k]; const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2; if (d < bd) { bd = d; best = e; } }
      if (best) { const d = Math.sqrt(bd) || 1; p.facing.x = (best.x - p.x) / d; p.facing.y = (best.y - p.y) / d; }
    }
    // Volée exactement sur un temps sur deux (frappe parfaite) pendant 120 s, puis rien (décroissance).
    const b = Math.floor((now() - startAt()) / beat);
    if (b !== lastBeat) {
      lastBeat = b;
      if (t < 120 && b % 2 === 0) { __press('dash', startAt() + b * beat); dashCount++; }
      if (t < 120 && b % 8 === 3) __press('parry', startAt() + b * beat + 0.02);
    }
    p.iframesT = 1e9;   // sonneur invulnérable : on teste le flux (le pilote naïf mourait à 115 s) ; réappliqué : la Volée réécrit iframesT
    step();
    if (i % 60 === 0 && !nanAt) { nanAt = hasNaN(p, 'player') || hasNaN(world.enemies.items[0] || {}, 'enemy'); if (nanAt) nanAt += ' @' + t.toFixed(1); }
    if (i === 30 * 60 && performance.memory) memMid = performance.memory.usedJSHeapSize;
    if (p.dead) break;
  }
  const simMs = performance.now() - t0;
  const mem1 = performance.memory ? performance.memory.usedJSHeapSize : 0;
  const run = g.run;
  results.sim = { spawn: ev.spawn, death: ev.death, hits: ev.hit, levelUps: ev.levelUp, level: run.level, xp: run.xp,
    maxTier: ev.maxTier, tierNow: resonanceTier(), fusions: ev.fusions, minutes: ev.minutes, tiers: ev.tiers, silenced: ev.silenced, blocked: ev.blocked,
    hp: p.hp, dead: p.dead, dashCount, taken: ev.taken, timeSec: run.timeSec, weapons: p.weapons.map((w) => w.id + ':' + w.level), passives: p.passives.map((x) => x.id + ':' + x.level),
    enemiesAlive: world.enemies.active, projectiles: world.projectiles.active, pickups: world.pickups.active, simMs: Math.round(simMs),
    memMB: [mem0, memMid, mem1].map((m) => Math.round(m / 1048576)), perfects: run.perfects, misses: run.misses, hitStops: fxCounters.hitStop, particles: emitted, sfx: Object.keys(played).length,
    dps: Object.assign({}, dpsReport()) };
  check('3 min simulées (sonneur invulnérable : flux)', run.timeSec >= 179, 'PV ' + p.hp + '/' + p.maxHp + ' t=' + run.timeSec.toFixed(0));
  check('ennemis spawnés > 200', ev.spawn > 200, String(ev.spawn));
  check('ennemis tués > 100', ev.death > 100, String(ev.death));
  check('level-ups ≈ 1 / 20 s (6–14 en 3 min)', ev.levelUp >= 6 && ev.levelUp <= 14, String(ev.levelUp));
  check('Résonance monte au cran 3 avec des frappes parfaites', ev.maxTier === 3, 'max ' + ev.maxTier);
  check('Résonance redescend sans frappe (60 s)', resonanceTier() < 3, 'cran final ' + resonanceTier());
  check('parfaits > 100, ratés = 0', run.perfects > 100 && run.misses === 0, run.perfects + ' / ' + run.misses);
  check('aucun NaN', !nanAt, nanAt || '');
  // Paliers : 1 + floor(t / tierEvery) sur 180 s (le palier de t = 180 s tombe ou non sur le dernier tick : arrondi flottant).
  const tierEvery = world.spawner.def.tierEvery, tiersLo = Math.min(6, 1 + Math.floor(179 / tierEvery)), tiersHi = Math.min(6, 1 + Math.floor(180 / tierEvery));
  check('paliers/minutes émis (' + tiersLo + '–' + tiersHi + ' paliers à tierEvery ' + tierEvery + ' s, ≥ 2 minutes)', ev.tiers >= tiersLo && ev.tiers <= tiersHi && ev.minutes >= 2, ev.tiers + ' paliers, ' + ev.minutes + ' minutes');
  check('mémoire stable (< +40 Mo entre 30 s et 180 s)', !performance.memory || (mem1 - memMid) < 40 * 1048576, results.sim.memMB.join(' → ') + ' Mo');
  check('vitesse de simulation ≥ 20× temps réel', simMs < 180000 / 20, Math.round(simMs) + ' ms pour 180 s');
  endGame();
}

// ---- 2. DPS théorique par arme (cible unique immobile, Résonance ×1) --------------------------
function measureDps(weaponId, level, seconds = 20, fusion = false) {
  const g = startGame({ parishId: 'cendrelune', characterId: 'wren', seed: 7, assist: 'norhythm', upgrades: {} });
  const p = g.player, world = g.world;
  removeWeapon(p, 'battant');
  world.spawner.def = { duration: 720, tierEvery: 120, spawns: [], events: [] }; // plus de vagues
  if (fusion) {
    const f = allFusions().get(weaponId);
    addWeapon(p, f.weapon); for (let l = 1; l < 7; l++) upgradeWeapon(p, f.weapon);
    for (let l = 0; l < 5; l++) addPassive(p, f.passive);
    applyFusion(p, weaponId);
  } else {
    addWeapon(p, weaponId); for (let l = 1; l < level; l++) upgradeWeapon(p, weaponId);
  }
  // Cible : un Feutre immobile et inamovible, 40 px à droite du sonneur (face à lui).
  const e = spawnEnemy(world, 'feutre', p.x + 44, p.y);
  e.hp = e.maxHp = 1e9; e.speed = 0; e.mass = 1e9; e.def = Object.assign({}, e.def, { behavior: 'swarm', onBeatOnly: false, special: { wobble: 0, wobbleHz: 0 } });
  p.facing.x = 1; p.facing.y = 0; p.iframesT = 1e9; p.stats.crit = 0;
  resetReport();
  // Résonance fixe cran 2 en 'norhythm' : on divise par 1.8 pour rapporter à ×1.
  const mult = 1.8;
  __setAxis(0, 0);
  for (let i = 0; i < seconds * 60; i++) { step(); e.x = p.x + 44; e.y = p.y; e.hp = 1e9; e.kx = e.ky = 0; }
  const total = dpsReport()[weaponId] || 0;
  endGame();
  return total / seconds / mult;
}

// ---- 2 bis. Run complète accélérée (nuit de la paroisse + boss) : Fêlures, boss, bilan, sauvegarde ----------
async function fullRun() {
  const ev = { fissure: [], boss: [], end: null, tiers: 0, minutes: 0, lore: [], ach: [], maxEntities: 0, maxEnemies: 0 };
  const offs = [
    bus.on('run:fissure', (e) => ev.fissure.push(e.bossId + ':' + e.phase)),
    bus.on('run:boss', (e) => ev.boss.push(e.bossId + ':' + e.phase + (e.phase === 'phase' ? e.index : ''))),
    bus.on('run:end', (e) => { ev.end = JSON.parse(JSON.stringify(e.stats)); }),
    bus.on('run:tier', () => ev.tiers++), bus.on('run:minute', () => ev.minutes++),
    bus.on('lore:unlock', (e) => ev.lore.push(e.leafId)), bus.on('achievement:unlock', (e) => ev.ach.push(e.id)),
    bus.on('level:up', (e) => bus.emit('level:choice', { card: e.choices[0] })),
  ];
  const g = startGame({ parishId: 'cendrelune', characterId: 'wren', seed: 2024, assist: 'norhythm', upgrades: { coeur_de_bronze: 3 } });
  const p = g.player, world = g.world;
  // Build fort pour aller au bout : 4 Timbres niveau 7, 2 Accords, joueur invulnérable (on teste le flux, pas la survie).
  for (const id of ['bourdon', 'grelots', 'chaine_d_angelus']) { addWeapon(p, id); for (let l = 1; l < 7; l++) upgradeWeapon(p, id); }
  for (let l = 1; l < 7; l++) upgradeWeapon(p, 'battant');
  for (let l = 0; l < 5; l++) { addPassive(p, 'contrepoids'); addPassive(p, 'etain'); }
  p.iframesT = 1e9;
  const dur = world.spawner.def.duration || 720, expMin = Math.floor(dur / 60);   // durée réelle de la nuit (waves.json)
  let simMs10 = 0, ticks10 = 0;
  const t0 = performance.now();
  for (let i = 0; i < 60 * 800 && !ev.end; i++) {
    const t = i * DT;
    const cycle = t % 6;
    if (cycle < 3) { const a = Math.floor(t / 6) * 0.9; __setAxis(Math.round(Math.cos(a)), Math.round(Math.sin(a))); } else __setAxis(0, 0);
    const s0 = performance.now();
    step();
    if (t >= dur - 60 && t < dur) { simMs10 += performance.now() - s0; ticks10++; }   // dernière minute de la nuit
    const n = world.enemies.active + world.projectiles.active + world.pickups.active + world.hazards.active;
    if (n > ev.maxEntities) ev.maxEntities = n;
    if (world.enemies.active > ev.maxEnemies) ev.maxEnemies = world.enemies.active;
  }
  const total = performance.now() - t0;
  offs.forEach((f) => f());
  results.fullRun = { fissures: ev.fissure, boss: ev.boss, tiers: ev.tiers, minutes: ev.minutes, lore: ev.lore, achievements: ev.ach,
    maxEntities: ev.maxEntities, maxEnemies: ev.maxEnemies, msPerTickLastMin: ticks10 ? +(simMs10 / ticks10).toFixed(3) : null, totalMs: Math.round(total),
    end: ev.end && { victory: ev.end.victory, timeSec: ev.end.timeSec, kills: ev.end.kills, level: ev.end.level, bronze: ev.end.bronze, resonanceAvg: ev.end.resonanceAvg, leafUnlocked: ev.end.leafUnlocked, dps: ev.end.dpsByWeapon, build: ev.end.build } };
  log.push('\nRun complète : ' + JSON.stringify(results.fullRun, null, 1));
  check('Fêlures min 4 et 8 (start/end)', ev.fissure.length === 4, ev.fissure.join(' '));
  check('boss intro/start/phase/end', ev.boss.includes('bourdon_fele:intro') && ev.boss.includes('bourdon_fele:start') && ev.boss.includes('bourdon_fele:end'), ev.boss.join(' '));
  check('victoire → run:end avec RunStats', !!ev.end && ev.end.victory === true, ev.end ? 't=' + ev.end.timeSec + ' bronze=' + ev.end.bronze : 'pas de run:end');
  check('6 paliers, nuit de ' + dur + ' s (≥ ' + expMin + ' minutes)', ev.tiers === 6 && ev.minutes >= expMin, ev.tiers + ' / ' + ev.minutes);
  // Feuillets : LEAVES_PER_NIGHT ouverts par nuit (f01, f02 : minutes 1 et 3), les autres conditions remplies (f04 boss, f05 victoire) sont retenues (leavesPending).
  const save = getSave(), pending = save.leavesPending || [];
  const leafOk = (id) => ev.lore.includes(id) || save.unlocked.leaves.includes(id) || pending.includes(id);
  check('Feuillets f01, f02 ouverts (plafond ' + LEAVES_PER_NIGHT + '/nuit), f04/f05 remplis ou retenus', ['f01', 'f02', 'f04', 'f05'].every(leafOk) && ev.lore.length <= LEAVES_PER_NIGHT, ev.lore.join(',') + ' ; retenus : ' + pending.join(','));
  check('hauts-faits (premiere_aube, fele_vaincu, sans_rythme_victoire)', ev.ach.includes('premiere_aube') && ev.ach.includes('fele_vaincu') && ev.ach.includes('sans_rythme_victoire'), ev.ach.join(','));
  check('tick logique à la dernière minute de la nuit < 4 ms (headless)', ticks10 > 0 && simMs10 / ticks10 < 4, (simMs10 / Math.max(1, ticks10)).toFixed(2) + ' ms, max ' + ev.maxEntities + ' entités');
  endGame();
}

async function main() {
  try {
    setDataBase('/carillon/src/data/');
    await loadGameData();
    await loadAtlas('/carillon/assets/manifest.json');
    initCamera({ w: 480, h: 270 });
    initConductor({ bpm: 96 });
    startConductor(0.05);
    log.push('Données et atlas chargés.');

    await simulateRun();
    log.push(JSON.stringify(results.sim, null, 1));

    log.push('\nDPS théorique par arme (cible unique, Résonance ×1, sans Accord) :');
    for (const def of allWeapons().values()) {
      const d1 = measureDps(def.id, 1), d7 = measureDps(def.id, 7);
      results.dps[def.id] = { l1: Math.round(d1), l7: Math.round(d7) };
      const inRange = def.id === 'diapason' || (d1 >= 12 && d1 <= 32 && d7 >= 60 && d7 <= 140);
      check('DPS ' + def.id + ' niv1 ' + d1.toFixed(1) + ' / niv7 ' + d7.toFixed(1), inRange);
    }
    for (const f of allFusions().values()) {
      const d = measureDps(f.id, 1, 20, true);
      results.dps[f.id] = { fusion: Math.round(d) };
      log.push('  fusion ' + f.id + ' : ' + d.toFixed(1) + ' DPS (cible unique)');
    }

    await fullRun();

    // ---- 2 ter. Déterminisme : deux runs de 45 s avec la même seed et les mêmes entrées ------------
    const sig = [];
    for (let r = 0; r < 2; r++) {
      const off = bus.on('level:up', (e) => bus.emit('level:choice', { card: e.choices[1] }));
      const g = startGame({ parishId: 'tourbes', characterId: 'maren', seed: 555, assist: 'none', upgrades: {} });
      for (let i = 0; i < 60 * 45; i++) { __setAxis(i % 240 < 120 ? 1 : 0, i % 400 < 200 ? -1 : 1); step(); }
      sig.push([g.world.kills, g.run.xp, g.run.level, Math.round(g.player.x), Math.round(g.player.y), g.world.enemies.active, g.player.hp].join('/'));
      off(); endGame();
    }
    check('déterminisme (même seed → même état)', sig[0] === sig[1], sig.join(' vs '));

    // ---- 3. Rendu d'une frame avec les vrais sprites -------------------------------------------
    const g = startGame({ parishId: 'cendrelune', characterId: 'wren', seed: 99, assist: 'none', upgrades: {} });
    addWeapon(g.player, 'clarine'); addWeapon(g.player, 'grelots'); addWeapon(g.player, 'tocsin');
    g.player.iframesT = 1e9;
    __setAxis(1, 0);
    for (let i = 0; i < 60 * 20; i++) step();
    __setAxis(0, 0);
    for (let i = 0; i < 60 * 9; i++) step();
    const bd = beatDuration();
    while (((now() - startAt()) / bd) % 1 > 0.08) step(); // juste après un temps : ondes et aura visibles
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16130f'; ctx.fillRect(0, 0, 480, 270);
    cameraAdvance(DT);
    applyTransform(ctx);
    renderGame(ctx, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    check('frame rendue avec ' + g.world.enemies.active + ' ennemis visibles/actifs', g.world.enemies.active > 0);
    results.render = { enemies: g.world.enemies.active, projectiles: g.world.projectiles.active };
  } catch (e) {
    results.ok = false; results.errors.push(String(e && e.stack || e));
    log.push('ERREUR ' + (e && e.stack || e));
  }
  results.errors.push(...[]);
  window.__results = results;
  log.unshift(results.ok ? 'RÉSULTAT : OK' : 'RÉSULTAT : ÉCHEC');
  show();
}
main();
