// game/passives.js — les 8 Accords (passifs sur les stats), niveaux 1–5 (ARCHITECTURE.md § 10/11).
// Un Accord ajoute perLevel × niveau à une stat du joueur (player.recomputeStats) :
//   ferrure → armor (réduction fixe)        souffle → speed (px/s)
//   contrepoids → area (+10 %/niv)          corde_de_chanvre → cadence (tirs supplémentaires tous
//   les 2 niveaux, grille deux fois plus fine au niveau 5, voir weapons.computeWeaponStats)
//   cire_d_abeille → regen (PV/s)           metronome → window (fenêtre de jugement +10 %/niv)
//   etain → crit (chance de coup critique)  echo → bounce (rebonds des projectiles, +zone des frappes)

import { passiveDef } from './data.js';
import { recomputeStats } from './player.js';
import { refreshWeapons } from './weapons.js';

export function findPassive(p, passiveId) {
  for (let i = 0; i < p.passives.length; i++) if (p.passives[i].id === passiveId) return p.passives[i];
  return null;
}

/** Ajoute un Accord (niveau 1) ou le monte d'un niveau. Renvoie l'instance. */
export function addPassive(p, passiveId) {
  const def = passiveDef(passiveId);
  if (!def) return null;
  let pa = findPassive(p, passiveId);
  if (pa) { if (pa.level < def.maxLevel) pa.level++; }
  else { pa = { id: def.id, def, level: 1 }; p.passives.push(pa); }
  recomputeStats(p);
  refreshWeapons(p);
  return pa;
}

export function upgradePassive(p, passiveId) { return addPassive(p, passiveId); }

/** Retire un Accord (consommé par une fusion). */
export function removePassive(p, passiveId) {
  const i = p.passives.findIndex((pa) => pa.id === passiveId);
  if (i < 0) return;
  p.passives.splice(i, 1);
  recomputeStats(p);
  refreshWeapons(p);
}

export function passiveLevel(p, passiveId) { const pa = findPassive(p, passiveId); return pa ? pa.level : 0; }
export function isPassiveMaxed(p, passiveId) { const pa = findPassive(p, passiveId); return !!pa && pa.level >= pa.def.maxLevel; }
