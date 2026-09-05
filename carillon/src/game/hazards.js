// game/hazards.js — zones au sol (sous-module game/) : nuage d'Ouateux (bloque la Résonance et, si le
// sonneur y reste un temps, lui avale un cran), traînée de suie (ralentit), toile de la Veuve de Suie
// (ralentit fort), traînée de Volée du Souffle (`volee` : blesse les ennemis), zone d'onde du Bourdon
// avec Contrepoids (`onde` : ralentit les ennemis). Pool dédié dans world.hazards. Rendu : disque
// translucide (VFX autorisé) + quelques particules.
// Options (HAZARD_OPTS) : slow/blockSec/damage/drainBeats s'appliquent au joueur ; enemySlow/enemyDamage aux ennemis.

import { createPool } from '../core/pool.js';
import { isVisible } from '../render/camera.js';
import { emit as emitParticles } from '../render/particles.js';
import { beatDuration } from '../audio/conductor.js';
import { block as blockResonance, bump as bumpResonance, tier as resonanceTier } from './resonance.js';
import { slowPlayer, hitPlayer } from './player.js';
import { damageEnemy } from './collision.js';

const COLORS = { cloud: 'rgba(216,205,180,0.28)', trail: 'rgba(22,19,15,0.55)', web: 'rgba(143,141,147,0.35)', volee: 'rgba(201,151,63,0.35)', onde: 'rgba(201,151,63,0.16)' };
const ENEMY_TICK = 0.5;   // s entre deux dégâts d'une zone sur un même ennemi (par zone)
const HIT = { crit: false, onBeat: true, knockX: 0, knockY: 0, source: '' };

function factory() { return { x: 0, y: 0, r: 20, kind: 'trail', t: 0, life: 3, slow: 0.5, blockSec: 0, damage: 0, from: '', pAcc: 0, enemySlow: 1, enemyDamage: 0, eAcc: 0, inT: 0, drainBeats: 0, drained: false }; }
function reset(o) { o.t = 0; o.pAcc = 0; o.damage = 0; o.blockSec = 0; o.enemySlow = 1; o.enemyDamage = 0; o.eAcc = 0; o.inT = 0; o.drainBeats = 0; o.drained = false; }

export function createHazardPool() { return createPool(factory, reset, 200); }

/** Options réutilisables pour spawnHazard (évite une allocation par appel) ; les champs « ennemis »
 *  sont remis à neutre après chaque spawn pour qu'un appelant qui ne les renseigne pas n'en hérite pas. */
export const HAZARD_OPTS = { slow: 1, blockSec: 0, damage: 0, from: '', enemySlow: 1, enemyDamage: 0, drainBeats: 0 };
const HZ = { slow: 1, blockSec: 0, damage: 0, from: '', enemySlow: 1, enemyDamage: 0, drainBeats: 0 };

/** Crée une zone. kind ∈ 'cloud' | 'trail' | 'web' | 'volee' | 'onde'. */
export function spawnHazard(world, kind, x, y, r, life, opts = HZ) {
  if (world.hazards.active >= 400) return null;
  const h = world.hazards.acquire();
  h.kind = kind; h.x = x; h.y = y; h.r = r; h.life = life; h.slow = opts.slow; h.blockSec = opts.blockSec; h.damage = opts.damage; h.from = opts.from;
  h.enemySlow = opts.enemySlow === undefined ? 1 : opts.enemySlow; h.enemyDamage = opts.enemyDamage || 0; h.drainBeats = opts.drainBeats || 0;
  if (opts === HAZARD_OPTS) { opts.enemySlow = 1; opts.enemyDamage = 0; opts.drainBeats = 0; }
  return h;
}

// Effet sur les ennemis (requête de grille sans closure).
let hz = null, hzWorld = null, hzDamage = false;
function enemyIn(e) {
  if (e.state !== 'alive') return;
  const dx = e.x - hz.x, dy = e.y - hz.y, rr = hz.r + e.r * 0.5;
  if (dx * dx + dy * dy > rr * rr) return;
  if (hz.enemySlow < 1 && !e.boss) { if (hz.enemySlow < e.slow || e.slowT <= 0) e.slow = hz.enemySlow; e.slowT = Math.max(e.slowT, 0.15); }
  if (hzDamage) { HIT.source = hz.from; HIT.knockX = 0; HIT.knockY = 0; damageEnemy(hzWorld, e, hz.enemyDamage, HIT); }
}

export function updateHazards(world, dt, p) {
  const items = world.hazards.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const h = items[i];
    h.t += dt;
    if (h.t >= h.life) { world.hazards.release(h); continue; }
    const dx = p.x - h.x, dy = p.y - h.y;
    const inside = dx * dx + dy * dy < (h.r + p.r * 0.5) * (h.r + p.r * 0.5);
    if (inside && !p.dead) {
      if (h.slow < 1) slowPlayer(p, h.slow, 0.15);
      if (h.blockSec > 0) blockResonance(h.blockSec);
      if (h.damage > 0) { h.pAcc += dt; if (h.pAcc >= 0.5) { h.pAcc = 0; hitPlayer(p, h.damage, h.from); } }
      // Nuage d'Ouateux : rester dedans un temps entier lui fait avaler un cran de Résonance (une fois par nuage).
      if (h.drainBeats > 0 && !h.drained) {
        h.inT += dt;
        if (h.inT >= h.drainBeats * (beatDuration() || 0.625)) { h.drained = true; if (resonanceTier() > 0) { bumpResonance(-1); emitParticles('silence', p.x, p.y - 10); } }
      }
    } else h.inT = 0;
    if (h.enemySlow < 1 || h.enemyDamage > 0) {
      hz = h; hzWorld = world; hzDamage = false;
      if (h.enemyDamage > 0) { h.eAcc += dt; if (h.eAcc >= ENEMY_TICK || h.t <= dt) { h.eAcc = 0; hzDamage = true; } }
      world.grid.query(h.x, h.y, h.r + 24, enemyIn);
    }
    if (h.kind === 'cloud' && ((h.t * 6) | 0) !== (((h.t - dt) * 6) | 0) && isVisible(h.x, h.y, h.r)) {
      emitParticles('silence', h.x + world.rng.range(-h.r, h.r) * 0.7, h.y + world.rng.range(-h.r, h.r) * 0.5);
    }
    if (h.kind === 'volee' && ((h.t * 12) | 0) !== (((h.t - dt) * 12) | 0) && isVisible(h.x, h.y, h.r)) emitParticles('ember', h.x + world.rng.range(-h.r, h.r) * 0.6, h.y);
  }
}

export function renderHazards(ctx, world) {
  const items = world.hazards.items;
  for (let i = 0; i < items.length; i++) {
    const h = items[i];
    if (!isVisible(h.x, h.y, h.r)) continue;
    const k = h.t / h.life;
    const fade = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.globalAlpha = fade;
    ctx.fillStyle = COLORS[h.kind] || COLORS.trail;
    ctx.beginPath();
    ctx.ellipse(h.x, h.y, h.r, h.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (h.kind === 'web') {
      ctx.strokeStyle = 'rgba(216,205,180,0.5)';
      ctx.lineWidth = 1;
      for (let s = 0; s < 6; s++) {
        const a = s * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r * 0.6); ctx.stroke();
      }
    } else if (h.kind === 'onde' || h.kind === 'volee') {
      ctx.strokeStyle = 'rgba(242,230,200,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
