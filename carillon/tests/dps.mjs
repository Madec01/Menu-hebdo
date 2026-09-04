#!/usr/bin/env node
// tests/dps.mjs — DPS théorique de chaque Timbre (niveaux 1 et 7) et de chaque fusion, sous Node.
// Deux scénarios, Résonance ×1 (aucune frappe rythmique), sonneur Wren immobile face à la cible :
//   « seul »   : un Feutre immobile et inamovible à 40 px devant le sonneur ;
//   « groupe » : 12 Feutres immobiles en anneau (rayons 36–70 px) autour du sonneur.
// Les cibles ont 1e9 PV (jamais tuées) : on mesure les dégâts crédités par weapons.dpsReport().
//   node tests/dps.mjs            # tableau
//   node tests/dps.mjs --json     # JSON
//   node tests/dps.mjs --data DIR # autre jeu de JSON

import { register } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import './stubs/globals.mjs';

register('./stubs/hooks.mjs', import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DT = 1 / 60;
const SECONDS = 30;

function loadData(dir) {
  const out = {};
  for (const f of readdirSync(dir)) if (f.endsWith('.json')) out[f.slice(0, -5)] = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
  return out;
}

export async function measureAll(dataDir) {
  const input = await import('../src/core/input.js'), audio = await import('../src/audio/audio.js');
  const conductor = await import('../src/audio/conductor.js'), camera = await import('../src/render/camera.js');
  const data = await import('../src/game/data.js'), game = await import('../src/game/game.js');
  const weapons = await import('../src/game/weapons.js'), passives = await import('../src/game/passives.js');
  const fusions = await import('../src/game/fusions.js'), enemies = await import('../src/game/enemies.js');
  await data.loadGameData(loadData(dataDir));
  camera.initCamera({ w: 480, h: 270 });
  audio.__setTime(0); conductor.initConductor({ bpm: 96 }); conductor.start(0.05);

  function step() { audio.__advance(DT); conductor.__advance(); game.updateGame(DT); input.tickInput(); }
  function target(world, p, x, y) {
    const e = enemies.spawnEnemy(world, 'feutre', x, y);
    e.hp = e.maxHp = 1e9; e.speed = 0; e.mass = 1e9; e.def = Object.assign({}, e.def, { behavior: 'swarm', onBeatOnly: false, special: { wobble: 0, wobbleHz: 0 } });
    e.baseX = x; e.baseY = y;
    return e;
  }
  function measure(weaponId, level, scenario, fusion, extra = null) {
    const g = game.startGame({ parishId: 'cendrelune', characterId: 'wren', seed: 7, assist: 'none', upgrades: {} });
    const p = g.player, world = g.world;
    weapons.removeWeapon(p, 'battant');
    if (extra) { weapons.addWeapon(p, extra); for (let l = 1; l < 7; l++) weapons.upgradeWeapon(p, extra); }
    world.spawner.def = { duration: world.waveDef.duration, tierEvery: world.waveDef.tierEvery, spawns: [], events: [] };   // plus de vagues
    world.moments.list.length = 0;                                                                                         // ni de Moments scriptés
    if (fusion) {
      const f = data.allFusions().get(weaponId);
      weapons.addWeapon(p, f.weapon); for (let l = 1; l < 7; l++) weapons.upgradeWeapon(p, f.weapon);
      for (let l = 0; l < 5; l++) passives.addPassive(p, f.passive);
      fusions.applyFusion(p, weaponId);
    } else { weapons.addWeapon(p, weaponId); for (let l = 1; l < level; l++) weapons.upgradeWeapon(p, weaponId); }
    const ts = [];
    const w0 = p.weapons[p.weapons.length - 1];
    const orbit = w0 && (w0.def.behavior === 'orbit' || w0.def.behavior === 'orbit_bounce');
    // Cible unique à 40 px devant (mêlée), ou sur le rayon d'orbite pour les cloches orbitales.
    if (scenario === 'seul') ts.push(target(world, p, p.x + (orbit ? w0.stats.range * w0.stats.area : 40), p.y));
    else for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, r = 36 + (k % 3) * 17; ts.push(target(world, p, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r)); }
    p.facing.x = 1; p.facing.y = 0; p.iframesT = 1e9; p.stats.crit = 0;
    weapons.resetReport();
    input.__setAxis(0, 0);
    for (let i = 0; i < SECONDS * 60; i++) {
      step();
      for (const e of ts) { e.x = e.baseX; e.y = e.baseY; e.hp = 1e9; e.kx = e.ky = 0; }
    }
    const rep = weapons.dpsReport();
    let total = 0; for (const k in rep) total += rep[k];
    game.endGame();
    return total / SECONDS;
  }
  const rows = [];
  for (const def of data.allWeapons().values()) {
    rows.push({ id: def.id, seul1: measure(def.id, 1, 'seul'), seul7: measure(def.id, 7, 'seul'), groupe1: measure(def.id, 1, 'groupe'), groupe7: measure(def.id, 7, 'groupe') });
  }
  for (const f of data.allFusions().values()) rows.push({ id: f.id + ' (fusion)', seul1: null, seul7: measure(f.id, 1, 'seul', true), groupe1: null, groupe7: measure(f.id, 1, 'groupe', true) });
  // Diapason / Requiem : gain apporté à un Battant niveau 7 (la marque n'a pas de dégâts propres).
  const ref = { seul: measure('battant', 7, 'seul'), groupe: measure('battant', 7, 'groupe') };
  for (const [id, fusion] of [['diapason', false], ['requiem', true]]) {
    const s = measure(id, 7, 'seul', fusion, 'battant') - ref.seul, g = measure(id, 7, 'groupe', fusion, 'battant') - ref.groupe;
    rows.push({ id: id + ' (+battant 7)', seul1: null, seul7: s, groupe1: null, groupe7: g });
  }
  return rows;
}

function f(v) { return v === null ? '–' : String(Math.round(v)); }
export function tableText(rows) {
  const lines = ['arme                  seul niv1  seul niv7  groupe niv1  groupe niv7'];
  for (const r of rows) lines.push(`${r.id.padEnd(20)} ${f(r.seul1).padStart(10)} ${f(r.seul7).padStart(10)} ${f(r.groupe1).padStart(12)} ${f(r.groupe7).padStart(12)}`);
  return lines.join('\n');
}
export function markdownTable(rows) {
  const lines = ['| arme | seul niv 1 | seul niv 7 | groupe (12) niv 1 | groupe (12) niv 7 |', '|---|---|---|---|---|'];
  for (const r of rows) lines.push(`| ${r.id} | ${f(r.seul1)} | ${f(r.seul7)} | ${f(r.groupe1)} | ${f(r.groupe7)} |`);
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const i = process.argv.indexOf('--data');
  const dir = i >= 0 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, 'src', 'data');
  const rows = await measureAll(dir);
  console.log(process.argv.includes('--json') ? JSON.stringify(rows) : tableText(rows));
}
