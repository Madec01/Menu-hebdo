// game/fusions.js — les 9 fusions (ARCHITECTURE.md § 10 bis + audit § 2.4) : glas (tocsin + contrepoids),
// carillon (clarine + echo), tonnerre (bourdon + etain), requiem (diapason + metronome), grande_volee
// (battant + corde_de_chanvre), transhumance (grelots + souffle), corne_de_guet (cor_de_brume + ferrure),
// crecelle_du_vendredi (crecelle + etain), angelus_de_veillee (chaine_d_angelus + cire_d_abeille).
// Une fusion est proposée en carte quand le Timbre et l'Accord atteignent les seuils `unlock` de
// fusions.json ({ weapon, passive }, défaut : niveaux max) ; elle remplace l'arme (l'Accord reste),
// émet `weapon:fusion`. Les comportements évolués vivent dans weapon-behaviors.js (aura_screen,
// orbit_bounce, shockwave_chain, mark_execute) et fusion-behaviors.js (arc_volee, herd, cone_parry,
// burst_roll, chain_heal). Chaque fusion porte une recette lisible : `hint` → fusion.<id>.hint (fr/en).

import { bus } from '../core/events.js';
import { play as playSfx } from '../audio/sfx.js';
import { emit as emitParticles } from '../render/particles.js';
import { flash } from '../render/fx.js';
import { allFusions, fusionDef, weaponDef, passiveDef } from './data.js';
import { findWeapon, removeWeapon, addWeapon } from './weapons.js';
import { passiveLevel } from './passives.js';

const payload = { fusionId: '', from: ['', ''] };

/** Niveau de Timbre requis par la fusion `f` (défaut : niveau max du Timbre). */
export function fusionWeaponNeed(f) { const d = weaponDef(f.weapon); return f.unlock && f.unlock.weapon ? f.unlock.weapon : (d && d.maxLevel) || 1; }
/** Niveau d'Accord requis par la fusion `f` (défaut : niveau max de l'Accord). */
export function fusionPassiveNeed(f) { const d = passiveDef(f.passive); return f.unlock && f.unlock.passive ? f.unlock.passive : (d && d.maxLevel) || 1; }

/** Le Timbre de la fusion est-il au niveau requis chez ce joueur ? */
export function weaponReady(p, f) { const w = findWeapon(p, f.weapon); return !!w && w.level >= fusionWeaponNeed(f); }
/** L'Accord de la fusion est-il au niveau requis chez ce joueur ? */
export function passiveReady(p, f) { return passiveLevel(p, f.passive) >= fusionPassiveNeed(f); }

/** Fusions actuellement disponibles pour ce joueur (tableau réutilisé). */
const available = [];
export function availableFusions(p) {
  available.length = 0;
  for (const f of allFusions().values()) {
    if (p.fusions.indexOf(f.id) >= 0) continue;
    if (!weaponReady(p, f) || !passiveReady(p, f)) continue;
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
