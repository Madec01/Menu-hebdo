// game/hazards.js — zones au sol (sous-module game/) : nuage d'Ouateux (bloque la Résonance),
// traînée de suie (ralentit), toile de la Veuve de Suie (ralentit fort). Pool dédié dans
// world.hazards. Rendu : disque translucide (VFX autorisé) + quelques particules.

import { createPool } from '../core/pool.js';
import { isVisible } from '../render/camera.js';
import { emit as emitParticles } from '../render/particles.js';
import { block as blockResonance } from './resonance.js';
import { slowPlayer, hitPlayer } from './player.js';

const COLORS = { cloud: 'rgba(216,205,180,0.28)', trail: 'rgba(22,19,15,0.55)', web: 'rgba(143,141,147,0.35)' };

function factory() { return { x: 0, y: 0, r: 20, kind: 'trail', t: 0, life: 3, slow: 0.5, blockSec: 0, damage: 0, from: '', pAcc: 0 }; }
function reset(o) { o.t = 0; o.pAcc = 0; o.damage = 0; o.blockSec = 0; }

export function createHazardPool() { return createPool(factory, reset, 200); }

/** Crée une zone. kind ∈ 'cloud' | 'trail' | 'web'. */
export function spawnHazard(world, kind, x, y, r, life, { slow = 1, blockSec = 0, damage = 0, from = '' } = HZ) {
  if (world.hazards.active >= 400) return null;
  const h = world.hazards.acquire();
  h.kind = kind; h.x = x; h.y = y; h.r = r; h.life = life; h.slow = slow; h.blockSec = blockSec; h.damage = damage; h.from = from;
  return h;
}
const HZ = { slow: 1, blockSec: 0, damage: 0, from: '' };
/** Options réutilisables pour spawnHazard (évite une allocation par appel). */
export const HAZARD_OPTS = { slow: 1, blockSec: 0, damage: 0, from: '' };

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
    }
    if (h.kind === 'cloud' && ((h.t * 6) | 0) !== (((h.t - dt) * 6) | 0) && isVisible(h.x, h.y, h.r)) {
      emitParticles('silence', h.x + world.rng.range(-h.r, h.r) * 0.7, h.y + world.rng.range(-h.r, h.r) * 0.5);
    }
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
    }
  }
  ctx.globalAlpha = 1;
}
