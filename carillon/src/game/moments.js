// game/moments.js — Moments scriptés de la nuit (sous-module game/, documenté ici). Entre deux
// paliers de Sourdine, la nuit enchaîne des événements courts (10–25 s) lus dans waves.json
// (`moments` par paroisse : { at, id, sec, kind?, count?, radius? }). L'instant exact est tiré au rng du
// run (±balance.moments.jitterSec) puis les moments sont espacés d'au moins minGapSec.
// Motifs : cercle (anneau qui se referme depuis le bord), nuee (essaim de Chœurs depuis un côté, qui ne
// meurent que sur le temps ET n'avancent que d'un pas par temps : mouvement quantifié sur la Mesure),
// meute (groupe qui bondit ensemble), ligne (rang qui crache en salve), pluie_de_suie (Rampes qui tombent
// en cercle), procession (file d'ennemis : Écho doublé seulement si le coup mortel tombe sur le temps —
// pickups.dropFor lit world.moments.ids et enemy.lastOnBeat), accalmie (aucun spawn ; un Écho géant
// apparaît au centre, ramassable seulement par une Volée sur le temps — pickups.spawnGiantEcho),
// cierge_errant (élite qui fuit, Bronze en prime), veuves_en_cercle (Veuves téléportées autour du joueur).
// API : createMoments(waveDef, rng) → world.moments ; updateMoments(world, dt, p) (world.js) ;
// world.moments.noSpawn est lu par le spawner ; bus `run:moment {id, phase:'start'|'end'}`.
// Le HUD lit world.moments.active / .t pour le compte à rebours.

import { bus } from '../core/events.js';
import { play as playSfx } from '../audio/sfx.js';
import { emit as emitParticles } from '../render/particles.js';
import { beatDuration } from '../audio/conductor.js';
import { balance } from './data.js';
import { spawnEnemy } from './enemies.js';
import { spawnGiantEcho } from './pickups.js';
import { holdDecay } from './resonance.js';

const payload = { id: '', phase: 'start' };
const pos = { x: 0, y: 0 };
const TWO_PI = Math.PI * 2;

/** État des moments d'une nuit (attaché à world.moments). */
export function createMoments(waveDef, rng) {
  const M = balance().moments;
  const src = waveDef.moments || [];
  const list = [];
  for (let i = 0; i < src.length; i++) {
    const d = src[i];
    list.push({ id: d.id, at: d.at + rng.range(-M.jitterSec, M.jitterSec), sec: d.sec, kind: d.kind || '', count: d.count || 0, radius: d.radius || 0 });
  }
  list.sort((a, b) => a.at - b.at);
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    if (list[i].at < prev.at + prev.sec + M.minGapSec) list[i].at = prev.at + prev.sec + M.minGapSec;
  }
  return {
    list, idx: 0, active: null, t: 0, noSpawn: false,
    angle: 0, side: 0, spawnAcc: 0, spawned: 0, ids: [], targetId: 0, rewarded: false, done: 0,
  };
}

// ---- Positions -------------------------------------------------------------------------------------
/** Point sur l'anneau elliptique autour du joueur (rayon r, y aplati). */
function ringPos(p, a, r, out) {
  out.x = p.x + Math.cos(a) * r; out.y = p.y + Math.sin(a) * r * balance().moments.ringYScale;
  return out;
}
/** Point juste hors écran sur un côté (0 droite, 1 bas, 2 gauche, 3 haut), u ∈ [-1, 1] le long du bord. */
function edgePos(p, side, u, out) {
  const E = balance().moments.edgeDist;
  if (side === 0) { out.x = p.x + E.x; out.y = p.y + u * E.y * 0.8; }
  else if (side === 2) { out.x = p.x - E.x; out.y = p.y + u * E.y * 0.8; }
  else if (side === 1) { out.x = p.x + u * E.x * 0.8; out.y = p.y + E.y; }
  else { out.x = p.x + u * E.x * 0.8; out.y = p.y - E.y; }
  return out;
}
function spawnTracked(world, st, kind, x, y, preset) {
  const e = spawnEnemy(world, kind, x, y);
  if (!e) return null;
  st.ids.push(e.id);
  emitParticles(preset || 'silence', x, y - 6);
  return e;
}
function findById(world, id) {
  const items = world.enemies.items;
  for (let i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
  return null;
}
/** Spawn progressif : n ennemis répartis sur `fraction` de la durée du moment. */
function progressive(st, m, dt, fraction) {
  if (st.spawned >= m.count) return 0;
  st.spawnAcc += m.count / (m.sec * fraction) * dt;
  const n = Math.min(Math.floor(st.spawnAcc), m.count - st.spawned);
  st.spawnAcc -= n;
  return n;
}

// ---- Motifs ------------------------------------------------------------------------------------------
function cercleStart(world, st, m, p) {
  for (let k = 0; k < m.count; k++) { ringPos(p, st.angle + (k / m.count) * TWO_PI, m.radius, pos); spawnTracked(world, st, m.kind, pos.x, pos.y); }
}
function nueeTick(world, st, m, dt, p) {
  const n = progressive(st, m, dt, 0.5);
  for (let k = 0; k < n; k++) { edgePos(p, st.side, world.rng.range(-1, 1), pos); if (spawnTracked(world, st, m.kind, pos.x, pos.y)) st.spawned++; else st.spawned = m.count; }
  // Mouvement quantifié : la vitesse continue du comportement est annulée (slow = 0) et, à chaque temps,
  // chaque Chœur reçoit une impulsion de recul qui l'avance d'un pas = vitesse × durée du temps.
  const step = world.beatChanged ? (balance().moments.nueeStepMult || 1) * (beatDuration() || 0.625) * balance().combat.knockFriction : 0;
  const items = world.enemies.items;
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (e.state !== 'alive' || st.ids.indexOf(e.id) < 0) continue;
    e.slow = 0; e.slowT = 1;
    if (step > 0) {
      let dx = e.vx, dy = e.vy, d = Math.hypot(dx, dy);
      if (d < 1) { dx = p.x - e.x; dy = p.y - e.y; d = Math.hypot(dx, dy) || 1; }
      e.kx += dx / d * e.speed * step; e.ky += dy / d * e.speed * step;
      emitParticles('ash', e.x, e.y);
    }
  }
}
function nueeEnd(world, st) {
  const items = world.enemies.items;
  for (let i = 0; i < items.length; i++) { const e = items[i]; if (e.state === 'alive' && st.ids.indexOf(e.id) >= 0) { e.slow = 1; e.slowT = 0; } }
}
function meuteStart(world, st, m, p) {
  edgePos(p, st.side, world.rng.range(-0.4, 0.4), pos);
  const cx = pos.x, cy = pos.y;
  for (let k = 0; k < m.count; k++) {
    const e = spawnTracked(world, st, m.kind, cx + world.rng.range(-28, 28), cy + world.rng.range(-20, 20));
    if (e) e.aiBeat = world.beat;   // même mesure d'origine : la meute bondit ensemble
  }
}
function ligneStart(world, st, m, p) {
  for (let k = 0; k < m.count; k++) {
    const u = m.count > 1 ? ((k / (m.count - 1)) * 2 - 1) * 0.9 : 0;
    edgePos(p, st.side, u, pos);
    const e = spawnTracked(world, st, m.kind, pos.x, pos.y);
    if (e) e.aiBeat = world.beat;   // salve synchronisée
  }
}
function pluieTick(world, st, m, dt, p) {
  const n = progressive(st, m, dt, 0.6);
  for (let k = 0; k < n; k++) {
    ringPos(p, st.angle + (st.spawned / m.count) * TWO_PI, m.radius, pos);
    if (spawnTracked(world, st, m.kind, pos.x, pos.y, 'ash')) st.spawned++; else st.spawned = m.count;
  }
}
function processionTick(world, st, m, dt, p) {
  const n = progressive(st, m, dt, 0.55);
  for (let k = 0; k < n; k++) {
    edgePos(p, st.side, 0.15, pos);
    const e = spawnTracked(world, st, m.kind, pos.x + world.rng.range(-6, 6), pos.y + world.rng.range(-6, 6), 'ember');
    if (!e) { st.spawned = m.count; break; }
    st.spawned++;   // l'Écho est doublé à la mort seulement si le coup tombe sur le temps (pickups.dropFor)
  }
}
function accalmieStart(world, st, m, p) {
  st.noSpawn = true;
  // Un Écho géant au centre de la scène (à quelques pas devant le sonneur) : il faut aller le chercher et
  // faire une Volée sur le temps à sa portée. Rien à frapper pendant l'Accalmie : la jauge ne retombe pas.
  const M = balance().moments;
  const fx = p.facing.x || 0, fy = p.facing.y || 1;
  spawnGiantEcho(world, p.x + fx * 120, p.y + fy * 80, M.accalmieEchoXp || 60, m.sec + 4);
  holdDecay(m.sec + 2);
}
function accalmieEnd(world, st) { st.noSpawn = false; }
function ciergeStart(world, st, m, p) {
  edgePos(p, st.side, world.rng.range(-0.5, 0.5), pos);
  const e = spawnTracked(world, st, m.kind, pos.x, pos.y, 'ember');
  st.targetId = e ? e.id : 0; st.rewarded = false;
}
function ciergeTick(world, st, m, dt, p) {
  if (!st.targetId) return;
  const e = findById(world, st.targetId);
  if (!e || e.state !== 'alive') {
    if (!st.rewarded) { st.rewarded = true; world.bronzePicked += balance().moments.ciergeBronze; if (e) emitParticles('bell', e.x, e.y - 8); }
    return;
  }
  // Fuite : le recul (kx/ky) annule l'approche du comportement et pousse l'élite loin du joueur.
  const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
  const f = Math.exp(-balance().combat.knockFriction * dt);
  const v = (balance().moments.ciergeFleeSpeed + e.speed) / f;
  e.kx = dx / d * v; e.ky = dy / d * v;
}
function ciergeEnd(world, st) {
  const e = st.targetId ? findById(world, st.targetId) : null;
  if (e && e.state === 'alive') { emitParticles('silence', e.x, e.y - 8); world.enemies.release(e); }   // il s'enfuit
  st.targetId = 0;
}
function veuvesStart(world, st, m, p) {
  for (let k = 0; k < m.count; k++) {
    ringPos(p, st.angle + (k / m.count) * TWO_PI, m.radius, pos);
    const e = spawnTracked(world, st, m.kind, pos.x, pos.y);
    if (!e) continue;
    e.aiState = 1; e.aiT = 0; e.aiBeat = world.beat; e.animBase = 'attack';   // arrivée par téléportation : télégraphie puis charge
  }
}

const PATTERNS = {
  cercle: { sfx: 'silence_cry', start: cercleStart },
  nuee: { sfx: 'silence_cry', tick: nueeTick, end: nueeEnd },
  meute: { sfx: 'silence_cry', start: meuteStart },
  ligne: { sfx: 'silence_cry', start: ligneStart },
  pluie_de_suie: { sfx: 'silence_cry', tick: pluieTick },
  procession: { sfx: 'bell_tier', tick: processionTick },
  accalmie: { sfx: 'bell_tier', start: accalmieStart, end: accalmieEnd },
  cierge_errant: { sfx: 'bell_tier', start: ciergeStart, tick: ciergeTick, end: ciergeEnd },
  veuves_en_cercle: { sfx: 'silence_cry', start: veuvesStart },
};
/** Identifiants des motifs connus (tests). */
export const MOMENT_IDS = Object.keys(PATTERNS);

// ---- Cycle ------------------------------------------------------------------------------------------
function startMoment(world, st, m, p) {
  const pat = PATTERNS[m.id];
  st.active = m; st.t = 0; st.spawnAcc = 0; st.spawned = 0; st.ids.length = 0;
  st.angle = world.rng.range(0, TWO_PI); st.side = world.rng.int(0, 3);
  if (pat.start) pat.start(world, st, m, p);
  payload.id = m.id; payload.phase = 'start';
  bus.emit('run:moment', payload);
  playSfx(pat.sfx);
}
function endMoment(world, st) {
  const m = st.active, pat = PATTERNS[m.id];
  if (pat.end) pat.end(world, st, m);
  st.active = null; st.t = 0; st.ids.length = 0; st.done++;
  payload.id = m.id; payload.phase = 'end';
  bus.emit('run:moment', payload);
}

/** Tick logique (world.updateWorld, après le spawner). */
export function updateMoments(world, dt, p) {
  const st = world.moments;
  if (!st) return;
  if (st.active) {
    st.t += dt;
    const pat = PATTERNS[st.active.id];
    if (pat.tick && !p.dead) pat.tick(world, st, st.active, dt, p);
    if (st.t >= st.active.sec || world.ended || p.dead) endMoment(world, st);
    return;
  }
  if (p.dead || world.ended || world.boss) return;   // rien pendant le Bourdon
  if (st.idx < st.list.length && world.time >= st.list[st.idx].at) {
    const m = st.list[st.idx++];
    if (PATTERNS[m.id]) startMoment(world, st, m, p);
    else console.warn('[moments] motif inconnu', m.id);
  }
}
