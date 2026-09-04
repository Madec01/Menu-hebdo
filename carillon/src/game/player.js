// game/player.js — le sonneur (ARCHITECTURE.md § 11).
// Déplacement (axis), Volée = dash sur `dash` (i-frames), Contre-battement = parade sur `parry`
// (fenêtre courte : renvoie les projectiles de Silence, annule un contact). Chaque action rythmique
// est jugée par conductor.judge(pressedAt(action)) et émet `rhythm:input`. Les stats agrègent le
// sonneur, les améliorations du Beffroi (upgradesApplied) et les Accords (passives.js).
// `unique` du sonneur : 'cuirasse' (Osric, déjà dans ses stats), 'aimant' (Maren, magnet), 'sans_voix'
// (Le Muet : immunisé au silence des Bâillons).

import { bus } from '../core/events.js';
import { axis, justPressed, pressedAt } from '../core/input.js';
import { judge, setWindowMs } from '../audio/conductor.js';
import { play as playSfx } from '../audio/sfx.js';
import { draw, drawShadow, frameAt, animDone } from '../render/atlas.js';
import { addLight } from '../render/lighting.js';
import { emit as emitParticles } from '../render/particles.js';
import { flash, slowMo, dashTrail } from '../render/fx.js';
import { shake } from '../render/camera.js';
import { balance, upgradeDef } from './data.js';
import { onRhythmInput, assistWindowMult, tier as resonanceTier } from './resonance.js';

const STAT_KEYS = ['maxHp', 'speed', 'armor', 'windowMult', 'resonanceGain', 'damageMult', 'area', 'cadence',
  'regen', 'crit', 'bounce', 'magnet', 'xpGain', 'bronzeGain', 'revive', 'rerolls'];
// Stats multiplicatives (valeur de base 1) : les bonus s'ajoutent à 1.
const MULT_STATS = { area: 1, magnet: 1, xpGain: 1, bronzeGain: 1, windowMult: 1, damageMult: 1, resonanceGain: 1 };

const rhythmPayload = { action: 'dash', grade: 'bon', offsetMs: 0 };
const hitPayload = { damage: 0, from: '', hp: 0, maxHp: 0 };
const dashPayload = { x: 0, y: 0, dirX: 0, dirY: 0 };
const parryPayload = { x: 0, y: 0, success: false };
const healPayload = { amount: 0 };
const deathPayload = { at: 0, killer: '' };

let current = null; // joueur courant (pour les écouteurs du bus)
let listening = false;

function listen() {
  if (listening) return;
  listening = true;
  bus.on('player:silenced', (e) => { if (current && current.unique !== 'sans_voix') current.silencedT = Math.max(current.silencedT, e.durationSec); });
  bus.on('player:inAura', (e) => { if (current) current.auraDepth = e.depth; });
}

/** Crée le joueur. upgradesApplied : { [upgradeId]: level } (améliorations du Beffroi achetées). */
export function createPlayer(characterDef, upgradesApplied = {}) {
  listen();
  const p = {
    id: 'player', x: 0, y: 0, px: 0, py: 0, r: 10, vx: 0, vy: 0,
    hp: 0, maxHp: 0, stats: {}, base: {}, upgradeBonus: {},
    weapons: [], passives: [], fusions: [],
    facing: { x: 0, y: 1 }, state: 'idle', anim: 'idle_down', animT: 0, moving: false,
    dashT: 0, dashDirX: 0, dashDirY: 0, iframesT: 0, parryT: 0, parryHits: 0, hitInvulnT: 0,
    silencedT: 0, auraDepth: 0, attackT: 0, slowMult: 1, slowT: 0, regenAcc: 0,
    revives: 0, dead: false, killer: '', markedT: 0, trailTick: 0,
    def: characterDef, sprite: characterDef.sprite, unique: characterDef.unique || null,
    stepAcc: 0,
  };
  // Base = stats du sonneur (les stats manquantes prennent 0 ou 1 selon leur nature).
  for (let i = 0; i < STAT_KEYS.length; i++) {
    const k = STAT_KEYS[i];
    p.base[k] = characterDef.stats[k] !== undefined ? characterDef.stats[k] : (MULT_STATS[k] || 0);
    p.upgradeBonus[k] = 0;
  }
  for (const id in upgradesApplied) {
    const def = upgradeDef(id);
    const lvl = upgradesApplied[id] | 0;
    if (def && lvl > 0 && p.upgradeBonus[def.stat] !== undefined) p.upgradeBonus[def.stat] += def.perLevel * lvl;
  }
  recomputeStats(p);
  p.hp = p.stats.maxHp;
  p.revives = p.stats.revive;
  current = p;
  return p;
}

/** Recalcule stats = base + Beffroi + Accords ; ajuste la fenêtre de jugement. */
export function recomputeStats(p) {
  const s = p.stats;
  for (let i = 0; i < STAT_KEYS.length; i++) {
    const k = STAT_KEYS[i];
    s[k] = p.base[k] + p.upgradeBonus[k];
  }
  for (let i = 0; i < p.passives.length; i++) {
    const pa = p.passives[i];
    const stat = pa.def.stat === 'window' ? 'windowMult' : pa.def.stat;
    if (s[stat] !== undefined) s[stat] += pa.def.perLevel * pa.level;
  }
  const oldMax = p.maxHp;
  p.maxHp = s.maxHp;
  if (oldMax > 0 && p.maxHp > oldMax) p.hp += p.maxHp - oldMax;
  setWindowMs(balance().resonance.windowMs * s.windowMult * assistWindowMult());
}

function judgeAction(action) {
  const j = judge(pressedAt(action));
  rhythmPayload.action = action; rhythmPayload.grade = j.grade; rhythmPayload.offsetMs = j.offsetMs;
  bus.emit('rhythm:input', rhythmPayload);
  onRhythmInput(j.grade);
  return j.grade;
}

/** Tick logique du joueur. */
export function updatePlayer(p, dt, world) {
  const B = balance().player;
  p.px = p.x; p.py = p.y;
  if (p.dead) { p.animT += dt; return; }
  const a = axis();
  p.moving = a.x !== 0 || a.y !== 0;
  if (p.moving) { p.facing.x = a.x; p.facing.y = a.y; }

  // Volée (dash) : jugée sur la grille, i-frames, traînée.
  if (p.dashT <= 0 && justPressed('dash')) {
    judgeAction('dash');
    p.dashT = B.dashSec; p.iframesT = B.iframesSec;
    const len = Math.hypot(p.facing.x, p.facing.y) || 1;
    p.dashDirX = p.facing.x / len; p.dashDirY = p.facing.y / len;
    dashPayload.x = p.x; dashPayload.y = p.y; dashPayload.dirX = p.dashDirX; dashPayload.dirY = p.dashDirY;
    bus.emit('player:dash', dashPayload);
    playSfx('dash');
  }
  // Contre-battement (parade) : fenêtre courte, résolue dans collision.js.
  if (p.parryT <= 0 && justPressed('parry')) {
    judgeAction('parry');
    p.parryT = B.parrySec; p.parryHits = 0;
    emitParticles('parry', p.x, p.y);
  }
  if (p.parryT > 0) {
    p.parryT -= dt;
    if (p.parryT <= 0) {
      parryPayload.x = p.x; parryPayload.y = p.y; parryPayload.success = p.parryHits > 0;
      bus.emit('player:parry', parryPayload);
      if (p.parryHits === 0) playSfx('parry_miss');
    }
  }

  // Déplacement.
  let speed = p.stats.speed * (1 - B.auraSlow * p.auraDepth) * p.slowMult;
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDirX * B.dashSpeed; p.vy = p.dashDirY * B.dashSpeed;
    emitParticles('dash_trail', p.x, p.y);
    // Traînée de Volée : un fantôme bronze de la frame courante un tick sur deux.
    p.trailTick ^= 1;
    if (p.trailTick) dashTrail(p.sprite, p.anim, frameAt(p.sprite, p.anim, p.animT), p.x, p.y, false);
  } else {
    p.vx = a.x * speed; p.vy = a.y * speed;
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (p.slowT > 0) { p.slowT -= dt; if (p.slowT <= 0) p.slowMult = 1; }
  if (p.iframesT > 0) p.iframesT -= dt;
  if (p.hitInvulnT > 0) p.hitInvulnT -= dt;
  if (p.silencedT > 0) p.silencedT -= dt;
  if (p.markedT > 0) p.markedT -= dt;
  if (p.attackT > 0) p.attackT -= dt;
  p.auraDepth = 0; // réémis chaque tick par les Feutres

  // Régénération (Cire d'abeille, Beffroi).
  if (p.stats.regen > 0 && p.hp < p.maxHp) {
    p.regenAcc += p.stats.regen * dt;
    if (p.regenAcc >= 1) { const n = Math.floor(p.regenAcc); p.regenAcc -= n; p.hp = Math.min(p.maxHp, p.hp + n); }
  }
  // Pas (bruitage discret).
  if (p.moving && p.dashT <= 0) { p.stepAcc += dt; if (p.stepAcc > 0.36) { p.stepAcc = 0; playSfx('player_step', { volume: 0.5 }); } }

  updateAnim(p, dt);
}

function updateAnim(p, dt) {
  const fx = p.facing.x, fy = p.facing.y;
  const dir = Math.abs(fx) >= Math.abs(fy) ? (fx < 0 ? 'left' : 'right') : (fy < 0 ? 'up' : 'down');
  let state = 'idle';
  if (p.hitInvulnT > 0 && p.state === 'hurt' && !animDone(p.sprite, 'hurt', p.animT)) state = 'hurt';
  else if (p.attackT > 0) state = 'attack';
  else if (p.moving || p.dashT > 0) state = 'walk';
  const anim = state === 'hurt' ? 'hurt' : state + '_' + dir;
  if (anim !== p.anim) { p.anim = anim; p.animT = 0; }
  else p.animT += dt;
  p.state = state;
  p.dir = dir;
}

/** Déclenche l'animation d'attaque (appelé par les armes de mêlée). */
export function playerAttack(p) { p.attackT = 0.3; }

/** Applique une ralentissement temporaire (traînée de suie, toile). */
export function slowPlayer(p, mult, sec) { if (mult < p.slowMult || p.slowT <= 0) p.slowMult = mult; p.slowT = Math.max(p.slowT, sec); }

/** Un projectile renvoyé ou un contact annulé pendant la parade. */
export function notifyParry(p) { if (p.parryHits === 0) playSfx('parry_ok'); p.parryHits++; }

/** Inflige des dégâts (armure, i-frames, parade). Renvoie true si le coup a porté. */
export function hitPlayer(p, damage, fromKind) {
  if (p.dead || p.iframesT > 0 || p.hitInvulnT > 0) return false;
  if (p.parryT > 0) { notifyParry(p); return false; }
  let dmg = Math.max(1, damage - p.stats.armor);
  if (p.markedT > 0) dmg = Math.round(dmg * balance().combat.markMult);
  p.hp -= dmg;
  p.hitInvulnT = balance().player.hitInvulnSec;
  p.state = 'hurt'; p.anim = 'hurt'; p.animT = 0;
  hitPayload.damage = dmg; hitPayload.from = fromKind; hitPayload.hp = Math.max(0, p.hp); hitPayload.maxHp = p.maxHp;
  bus.emit('player:hit', hitPayload);
  playSfx('player_hurt');
  shake(4, 0.25);
  flash('#e0603a', 1);
  if (p.hp <= 0) {
    if (p.revives > 0) {
      p.revives--; p.hp = Math.ceil(p.maxHp * balance().player.reviveHp); p.iframesT = 1.5;
      emitParticles('bell', p.x, p.y);
    } else {
      p.hp = 0; p.dead = true; p.killer = fromKind; p.anim = 'die'; p.animT = 0;
      deathPayload.at = 0; deathPayload.killer = fromKind;
      bus.emit('player:death', deathPayload);
      playSfx('player_death');
      slowMo(balance().boss.slowMoDeath, balance().boss.slowMoSec);
    }
  }
  return true;
}

/** Soigne (émet player:heal). */
export function healPlayer(p, amount) {
  if (p.dead || amount <= 0) return;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  healPayload.amount = p.hp - before;
  if (healPayload.amount > 0) bus.emit('player:heal', healPayload);
}

/** Rendu interpolé + halo du Battant. */
export function renderPlayer(ctx, p, alpha) {
  const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha;
  const B = balance().player;
  drawShadow(ctx, p.sprite, x, y, 0.8);
  const blink = p.hitInvulnT > 0 && !p.dead && ((p.hitInvulnT * 20) | 0) % 2 === 0;
  const frame = frameAt(p.sprite, p.anim, p.animT);
  drawOpts.alpha = blink ? 0.4 : (p.dashT > 0 ? 0.75 : 1);
  drawOpts.tint = p.parryT > 0 ? '#c9973f' : null;
  draw(ctx, p.sprite, p.anim, frame, x, y, drawOpts);
  // Halo du Battant : cœur bronze net + large halo doux (lisibilité autour du sonneur),
  // tous deux élargis par le cran de Résonance. Rayon de base : balance.player.lightRadius.
  const t = resonanceTier();
  const r = B.lightRadius + t * 15;
  addLight(x, y - 12, r, '#c9973f', 0.8 + t * 0.05, 0.08);
  addLight(x, y - 12, r * 2.4, '#c9973f', 0.55, 0.04, true);
}
const drawOpts = { flipX: false, alpha: 1, tint: null, scale: 1 };

export function currentPlayer() { return current; }
