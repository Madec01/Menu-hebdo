// game/world.js — le monde d'une nuit (ARCHITECTURE.md § 11) : pools (ennemis, projectiles,
// ramassables, zones), grille, temps, palier, suivi de la Mesure (beat/bar/contretemps), et rendu
// dans l'ordre du § 3 : sol → halo de la Mesure → zones → ramassables → ombres+entités triées
// par y → projectiles. Le tri par y est un tri par comptage dans des tableaux préalloués (aucune allocation).

import { createGrid } from '../core/grid.js';
import { beatIndex, beatsPerBar, phase } from '../audio/conductor.js';
import { isVisible, viewRect } from '../render/camera.js';
import { drawBeatHalo } from '../render/lighting.js';
import { balance, allParishes } from './data.js';
import { createEnemyPool, updateEnemies, drawEnemy } from './enemies.js';
import { createProjectilePool, updateProjectiles } from './projectiles.js';
import { createPickupPool, updatePickups, renderPickups } from './pickups.js';
import { createHazardPool, updateHazards, renderHazards } from './hazards.js';
import { buildGrid, collideProjectiles, collideEnemiesPlayer } from './collision.js';
import { createSpawner, updateSpawner } from './spawner.js';
import { updateBoss } from './boss.js';
import { createGround, renderGround, drawProp } from './ground.js';
import { renderPlayer } from './player.js';
import { renderWeapons } from './weapons.js';

export { spawnEnemy } from './enemies.js';
export { damageEnemy } from './collision.js';

const BANDS = 96;         // bandes de tri (≈ 4 px sur une vue de 270 + marges)
let listObj = [], listY = new Float32Array(1024), listType = new Int16Array(1024), order = new Int32Array(1024);
const bandCount = new Int32Array(BANDS + 1);

/** Crée le monde d'une run. */
export function createWorld({ parishDef, rng, waveDef }) {
  const world = {
    parishDef, waveDef, rng, time: 0, tier: 0, minute: 0,
    enemies: createEnemyPool(), projectiles: createProjectilePool(), pickups: createPickupPool(), hazards: createHazardPool(),
    grid: createGrid(64), spawner: createSpawner(waveDef), ground: createGround(parishDef, rng.seed),
    beat: -1, bar: -1, beatInBar: 0, beatChanged: false, barChanged: false, offbeatChanged: false, lastPhase: 0,
    kills: 0, killsByKind: {}, spawned: 0, echoes: 0, bronzePicked: 0, auraDepth: 0, auraWasIn: false,
    fissure: null, fissureId: 0, boss: null, bossId: 0, bossKind: '', bossKilled: null, victory: false, ended: false,
    player: null, allParishes: Array.from(allParishes().values()),
    // Règles modifiées par une Relique (game/relics.js) : lues par spawner, collision et le rendu.
    fissureEarlySec: 0, knockbackMult: 1, parryTwice: false, hideRadius: 0,
  };
  return world;
}

function trackBeat(world) {
  const b = beatIndex();
  world.beatChanged = b !== world.beat;
  if (world.beatChanged) { world.beat = b; world.beatInBar = b % beatsPerBar(); }
  const bar = Math.floor(b / beatsPerBar());
  world.barChanged = bar !== world.bar;
  world.bar = bar;
  const ph = phase();
  world.offbeatChanged = world.lastPhase < 0.5 && ph >= 0.5;
  world.lastPhase = ph;
}

/** Tick logique du monde (le joueur et ses armes sont mis à jour par l'appelant / game.js). */
export function updateWorld(world, dt, player) {
  world.player = player;
  world.time += dt;
  trackBeat(world);
  updateSpawner(world, dt, player);
  buildGrid(world);
  updateEnemies(world, dt, player);
  buildGrid(world);
  updateProjectiles(world, dt, player);
  collideProjectiles(world, player);
  collideEnemiesPlayer(world, player);
  updatePickups(world, dt, player);
  updateHazards(world, dt, player);
  updateBoss(world, dt, player);
}

function ensureCapacity(n) {
  if (n <= listY.length) return;
  let cap = listY.length;
  while (cap < n) cap *= 2;
  listY = new Float32Array(cap); listType = new Int16Array(cap); order = new Int32Array(cap);
}

/** Rendu du monde (ctx déjà transformé par la caméra). */
export function renderWorld(ctx, world, alpha) {
  const player = world.player;
  const v = viewRect();
  renderGround(ctx, world.ground, world.time);
  drawBeatHalo(ctx); // halo de bronze de la Mesure : au sol, sous les zones et les entités
  renderHazards(ctx, world);
  renderPickups(ctx, world, alpha);

  // Liste des entités visibles : 0 = ennemi, 1 = joueur, 2 = prop.
  let n = 0;
  const enemies = world.enemies.items;
  ensureCapacity(enemies.length + world.ground.propList.length + 1);
  const hideR2 = world.hideRadius > 0 && player ? world.hideRadius * world.hideRadius : 0;   // Voile de brume
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    const y = e.py + (e.y - e.py) * alpha;
    if (!isVisible(e.px + (e.x - e.px) * alpha, y, e.r * 3)) continue;
    if (hideR2 > 0) { const dx = e.x - player.x, dy = (e.y - player.y) * 1.6; if (dx * dx + dy * dy > hideR2) continue; }
    listObj[n] = e; listY[n] = y; listType[n] = 0; n++;
  }
  const props = world.ground.propList;
  for (let i = 0; i < props.length; i++) { listObj[n] = props[i]; listY[n] = props[i].y; listType[n] = 2; n++; }
  if (player) { listObj[n] = player; listY[n] = player.py + (player.y - player.py) * alpha; listType[n] = 1; n++; }

  // Tri par comptage sur des bandes horizontales.
  const y0 = v.y - 64, scale = BANDS / (v.h + 192);
  bandCount.fill(0);
  for (let i = 0; i < n; i++) {
    let b = ((listY[i] - y0) * scale) | 0;
    if (b < 0) b = 0; else if (b >= BANDS) b = BANDS - 1;
    listType[i] |= b << 2;
    bandCount[b + 1]++;
  }
  for (let b = 0; b < BANDS; b++) bandCount[b + 1] += bandCount[b];
  for (let i = 0; i < n; i++) { const b = listType[i] >> 2; order[bandCount[b]++] = i; }
  for (let k = 0; k < n; k++) {
    const i = order[k], t = listType[i] & 3;
    if (t === 0) drawEnemy(ctx, listObj[i], alpha);
    else if (t === 1) renderPlayer(ctx, listObj[i], alpha);
    else drawProp(ctx, listObj[i], world.time);
    listObj[i] = null;
  }
  renderWeapons(ctx, alpha);
}

/** Nombre d'entités actives (stats de la boucle). */
export function entityCount(world) {
  return world.enemies.active + world.projectiles.active + world.pickups.active + world.hazards.active;
}
