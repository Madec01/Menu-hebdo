// game/fusions.js — les 4 fusions (ARCHITECTURE.md § 10 bis) : glas (tocsin + contrepoids),
// carillon (clarine + echo), tonnerre (bourdon + etain), requiem (diapason + metronome).
// Une fusion est proposée en carte quand le Timbre ET l'Accord sont au niveau maximal ; elle
// remplace l'arme (l'Accord reste), émet `weapon:fusion`. Les comportements évolués vivent dans
// weapon-behaviors.js (aura_screen, orbit_bounce, shockwave_chain, mark_execute).

import { bus } from '../core/events.js';
import { play as playSfx } from '../audio/sfx.js';
import { emit as emitParticles } from '../render/particles.js';
import { flash } from '../render/fx.js';
import { allFusions, fusionDef } from './data.js';
import { findWeapon, removeWeapon, addWeapon } from './weapons.js';
import { isPassiveMaxed } from './passives.js';

const payload = { fusionId: '', from: ['', ''] };

/** Fusions actuellement disponibles pour ce joueur (tableau réutilisé). */
const available = [];
export function availableFusions(p) {
  available.length = 0;
  for (const f of allFusions().values()) {
    if (p.fusions.indexOf(f.id) >= 0) continue;
    const w = findWeapon(p, f.weapon);
    if (!w || w.level < (w.def.maxLevel || 1)) continue;
    if (!isPassiveMaxed(p, f.passive)) continue;
    available.push(f);
  }
  return available;
}

/** Applique la fusion : retire l'arme d'origine, ajoute l'arme fusionnée, émet l'événement. */
export function applyFusion(p, fusionId) {
  const f = fusionDef(fusionId);
  if (!f || findWeapon(p, fusionId)) return null;
  removeWeapon(p, f.weapon);
  const w = addWeapon(p, fusionId);
  p.fusions.push(fusionId);
  payload.fusionId = fusionId; payload.from[0] = f.weapon; payload.from[1] = f.passive;
  bus.emit('weapon:fusion', payload);
  playSfx('fusion');
  emitParticles('bell', p.x, p.y);
  flash('#c9973f', 2);
  return w;
}
