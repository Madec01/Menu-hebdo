// game/spawner.js — lit waves.json : spawns par fenêtre temporelle (perSec × densité du palier,
// cap par type), paliers de Sourdine toutes les tierEvery s (`run:tier`), sonnerie horaire
// (`run:minute`, sans son : la sonnerie est à bell-hour.js), Fêlures (élites) et boss aux `events`.
// Les ennemis apparaissent hors écran,
// sur un anneau autour du joueur (angle tiré au rng du run). Après le boss, le flux régulier
// est réduit (balance.spawn.afterBossRate). Les Moments scriptés (moments.js) vivent à côté : une
// accalmie suspend le flux régulier (world.moments.noSpawn) ; la durée de la nuit est `duration`.
// Difficulté par paroisse (`waves.<paroisse>.difficulty: { hp, damage }`) : appliquée par scaleNewEnemies
// (hook de world.js après updateEnemies) à tout ennemi nouvellement apparu, boss exclus — quelle que soit sa
// source (flux, Moment, Fêlure, invocation) — pour tenir le « +25 % par paroisse » indépendamment de l'XP.

import { bus } from '../core/events.js';
import { play as playSfx } from '../audio/sfx.js';
import { balance } from './data.js';
import { spawnEnemy, countKind } from './enemies.js';
import { startFissure, startBoss } from './boss.js';

const minutePayload = { minute: 0 };
const tierPayload = { tier: 1 };

/** État du spawner, attaché au monde (world.spawner). */
export function createSpawner(waveDef) {
  return {
    def: waveDef, acc: new Float64Array(waveDef.spawns.length), nextMinute: 1, eventIdx: 0, bossStarted: false, scaledId: 0,
  };
}

/** Difficulté de la paroisse sur les ennemis apparus depuis le dernier appel (ids croissants). */
export function scaleNewEnemies(world) {
  const sp = world.spawner, d = sp.def.difficulty;
  const items = world.enemies.items;
  let maxId = sp.scaledId;
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (e.id <= sp.scaledId) continue;
    if (e.id > maxId) maxId = e.id;
    if (e.boss || !d) continue;
    e.maxHp = Math.max(1, Math.round(e.maxHp * (d.hp || 1))); e.hp = e.maxHp;
    e.damage = Math.round(e.damage * (d.damage || 1));
  }
  sp.scaledId = maxId;
}

/** Position hors écran autour du joueur (écrit dans out). */
export function offscreenPos(world, p, out) {
  const S = balance().spawn;
  const a = world.rng.range(0, Math.PI * 2);
  const d = world.rng.range(S.minDist, S.maxDist);
  out.x = p.x + Math.cos(a) * d; out.y = p.y + Math.sin(a) * d * 0.75;
  return out;
}
const pos = { x: 0, y: 0 };

/** Instant d'un événement ; les Fêlures peuvent être avancées par une Relique (world.fissureEarlySec). */
function eventAt(world, ev) { return ev.type === 'fissure' ? ev.at - (world.fissureEarlySec || 0) : ev.at; }

export function updateSpawner(world, dt, p) {
  const sp = world.spawner, def = sp.def, S = balance().spawn;
  const t = world.time;
  // Palier de Sourdine.
  const tier = Math.min(6, 1 + Math.floor(t / def.tierEvery));
  if (tier !== world.tier) {
    world.tier = tier;
    tierPayload.tier = tier;
    bus.emit('run:tier', tierPayload);
    playSfx('bell_tier');
  }
  // Sonnerie horaire.
  if (t >= sp.nextMinute * 60) {
    minutePayload.minute = sp.nextMinute;
    world.minute = sp.nextMinute;
    bus.emit('run:minute', minutePayload);   // la cloche (bell_minute) est jouée par bell-hour.js seulement
    sp.nextMinute++;
  }
  // Événements (Fêlures, boss).
  while (sp.eventIdx < def.events.length && t >= eventAt(world, def.events[sp.eventIdx])) {
    const ev = def.events[sp.eventIdx++];
    if (ev.type === 'fissure') startFissure(world, ev.boss, p);
    else if (ev.type === 'boss') { startBoss(world, ev.boss, p); sp.bossStarted = true; }
  }
  // Flux régulier (suspendu pendant une accalmie).
  if (p.dead || world.ended || (world.moments && world.moments.noSpawn)) return;
  const density = (1 + S.densityPerTier * (tier - 1)) * (sp.bossStarted ? S.afterBossRate : 1);
  for (let i = 0; i < def.spawns.length; i++) {
    const s = def.spawns[i];
    if (t < s.from || t >= s.to) continue;
    sp.acc[i] += s.perSec * density * dt;
    if (sp.acc[i] < 1) continue;
    const n = Math.floor(sp.acc[i]);
    sp.acc[i] -= n;
    if (countKind(world, s.kind) >= Math.ceil(s.cap * density)) continue;
    for (let k = 0; k < n; k++) {
      offscreenPos(world, p, pos);
      if (!spawnEnemy(world, s.kind, pos.x, pos.y)) break;
    }
  }
}
