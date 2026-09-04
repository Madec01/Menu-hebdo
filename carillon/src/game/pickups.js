// game/pickups.js — Échos (XP, 3 tailles, aimantés selon la stat magnet), soin, carillon (vide
// l'écran), relique (un cran de Résonance + soin), lingot de bronze. Pool dans world.pickups.
// Les ramassages émettent `pickup:xp` / `pickup:item` ; l'XP est comptée par progression.js
// (game.js relie les deux). Sprites : `echo` (small/medium/large) et `pickups` (heal/chime/relic/bronze).

import { bus } from '../core/events.js';
import { createPool } from '../core/pool.js';
import { play as playSfx } from '../audio/sfx.js';
import { draw, frameAt } from '../render/atlas.js';
import { isVisible, viewRect } from '../render/camera.js';
import { addGlow } from '../render/lighting.js';
import { emit as emitParticles } from '../render/particles.js';
import { flash } from '../render/fx.js';
import { balance } from './data.js';
import { healPlayer } from './player.js';
import { onRhythmInput } from './resonance.js';
import { damageEnemy } from './collision.js';

const xpPayload = { amount: 0 };
const itemPayload = { kind: '' };
const HIT = { crit: true, onBeat: true, knockX: 0, knockY: 0, source: 'carillon_pickup' };

function factory() { return { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, kind: 'xp', value: 0, t: 0, anim: 'small', sprite: 'echo', magnet: false, bob: 0 }; }
function reset(o) { o.t = 0; o.magnet = false; o.vx = 0; o.vy = 0; o.bob = 0; }

export function createPickupPool() { return createPool(factory, reset, 300); }

/** Crée un ramassable. kind ∈ 'xp' | 'heal' | 'chime' | 'relic' | 'bronze'. */
export function spawnPickup(world, kind, x, y, value = 0) {
  const P = balance().pickups;
  const pool = world.pickups;
  if (pool.active >= P.maxActive) {
    // Plein : on fusionne l'XP dans un Écho existant choisi par le rng (déterministe).
    if (kind === 'xp') { const o = pool.items[world.rng.int(0, pool.active - 1)]; if (o.kind === 'xp') { o.value += value; sizeOf(o); } }
    return null;
  }
  const o = pool.acquire();
  o.kind = kind; o.x = x; o.y = y; o.px = x; o.py = y; o.value = value;
  o.vx = world.rng.range(-30, 30); o.vy = world.rng.range(-40, -10);
  if (kind === 'xp') { o.sprite = 'echo'; sizeOf(o); } else { o.sprite = 'pickups'; o.anim = kind; }
  return o;
}

function sizeOf(o) {
  const P = balance().pickups;
  o.anim = o.value >= P.largeAt ? 'large' : o.value >= P.mediumAt ? 'medium' : 'small';
}

/** Butin d'un ennemi mort : Écho + objets rares (tirés au rng du run). */
export function dropFor(world, e) {
  const P = balance().pickups;
  if (e.xp > 0) spawnPickup(world, 'xp', e.x, e.y, e.xp);
  if (e.elite) { spawnPickup(world, 'relic', e.x + 10, e.y, 0); spawnPickup(world, 'heal', e.x - 10, e.y, 0); return; }
  if (e.boss) return;
  const r = world.rng.next();
  if (r < P.chimeChance) spawnPickup(world, 'chime', e.x, e.y, 0);
  else if (r < P.chimeChance + P.healChance) spawnPickup(world, 'heal', e.x, e.y, 0);
  else if (r < P.chimeChance + P.healChance + P.bronzeChance) spawnPickup(world, 'bronze', e.x, e.y, P.bronzeValue);
}

function collect(world, o, p) {
  const P = balance().pickups;
  switch (o.kind) {
    case 'xp':
      xpPayload.amount = o.value * p.stats.xpGain;
      bus.emit('pickup:xp', xpPayload);
      world.echoes++;
      playSfx(o.anim === 'large' ? 'xp_pickup_big' : 'xp_pickup', { volume: o.anim === 'small' ? 0.5 : 0.9 });
      emitParticles('xp', o.x, o.y);
      return;
    case 'heal': healPlayer(p, Math.ceil(p.maxHp * P.healPct)); break;
    case 'chime': chime(world, p); break;
    case 'relic': onRhythmInput('parfait'); onRhythmInput('parfait'); healPlayer(p, Math.ceil(p.maxHp * P.relicHealPct)); break;
    case 'bronze': world.bronzePicked += o.value; break;
  }
  itemPayload.kind = o.kind;
  bus.emit('pickup:item', itemPayload);
  playSfx('bell_tier', { volume: 0.7 });
  emitParticles('bell', o.x, o.y);
}

/** Carillon : tout ce qui est à l'écran (sauf boss) est frappé d'un coup mortel. */
function chime(world, p) {
  const v = viewRect();
  const items = world.enemies.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const e = items[i];
    if (e.state !== 'alive' || e.boss) continue;
    if (e.x < v.x - 16 || e.x > v.x + v.w + 16 || e.y < v.y - 16 || e.y > v.y + v.h + 16) continue;
    HIT.knockX = 0; HIT.knockY = 0;
    damageEnemy(world, e, e.elite ? e.maxHp * 0.25 : e.hp + 1, HIT);
  }
  flash('#d8cdb4', 2);
  playSfx('victory_bell');
}

export function updatePickups(world, dt, p) {
  const P = balance().pickups;
  const magnetR = P.magnetRadius * p.stats.magnet;
  const items = world.pickups.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const o = items[i];
    o.px = o.x; o.py = o.y; o.t += dt;
    if (o.t > P.lifeSec && o.kind === 'xp') { world.pickups.release(o); continue; }
    const dx = p.x - o.x, dy = p.y - o.y, d2 = dx * dx + dy * dy;
    const pull = o.kind === 'xp' ? magnetR : magnetR * 0.6;
    if (!p.dead && (o.magnet || d2 < pull * pull)) {
      o.magnet = true;
      const d = Math.sqrt(d2) || 1;
      const sp = P.magnetSpeed * (1 + o.t * 0.5);
      o.vx = dx / d * sp; o.vy = dy / d * sp;
      o.bob += dt;
      if (o.bob >= 0.05) { o.bob = 0; emitParticles('echo_trail', o.x, o.y); } // traînée de bronze
      if (d < P.collectRadius) { collect(world, o, p); world.pickups.release(o); continue; }
    } else {
      // Petit rebond d'apparition puis immobile.
      o.vx *= 0.85; o.vy = o.t < 0.35 ? o.vy + 300 * dt : 0;
    }
    o.x += o.vx * dt; o.y += o.vy * dt;
  }
}

const drawOpts = { flipX: false, alpha: 1, tint: null, scale: 1 };

export function renderPickups(ctx, world, alpha) {
  const items = world.pickups.items;
  for (let i = 0; i < items.length; i++) {
    const o = items[i];
    const x = o.px + (o.x - o.px) * alpha, y = o.py + (o.y - o.py) * alpha - Math.abs(Math.sin(o.t * 3 + o.x)) * 2;
    if (!isVisible(x, y, 16)) continue;
    drawOpts.scale = o.kind === 'xp' ? 0.75 : 1;
    draw(ctx, o.sprite, o.anim, frameAt(o.sprite, o.anim, o.t), x, y, drawOpts);
    if (o.kind !== 'xp') addGlow(x, y, 12, '#e0603a', 0.45);
    else if (o.anim !== 'small') addGlow(x, y, 10, '#c9973f', 0.25); // lueurs additives : discrètes, les Échos s'empilent
  }
}
