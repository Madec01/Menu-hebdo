// game/cards.js — tirage des 3 cartes de montée de niveau (sous-module de progression.js).
// Pondération (ARCHITECTURE.md § 11) : 60 % Timbres non maxés, 40 % Accords, fusions disponibles
// très prioritaires ; jamais deux fois la même carte ; max 6 Timbres + 6 Accords ; à défaut, cartes
// bonus (soin, bronze). Tout aléa passe par run.cardRng (déterministe).
// Carte : { type: 'weapon'|'passive'|'fusion'|'bonus', id, level, name, desc, icon, isNew, params }.

import { allWeapons, allPassives, balance } from './data.js';
import { findWeapon } from './weapons.js';
import { findPassive } from './passives.js';
import { availableFusions } from './fusions.js';

const pool = [];   // candidats (réutilisé)
const weights = []; // poids parallèles

function levelParams(def, level) {
  const s = { damage: def.base.damage, count: def.base.count, area: def.base.area };
  if (def.levels) for (let l = 1; l < level && l < def.levels.length; l++) {
    const d = def.levels[l];
    if (d.damage) s.damage += d.damage; if (d.count) s.count += d.count; if (d.area) s.area += d.area;
  }
  s.area = Math.round(s.area * 100);
  return s;
}

function weaponCard(def, level, isNew) {
  return { type: 'weapon', id: def.id, level, name: def.name, desc: def.desc, icon: def.icon, isNew, params: levelParams(def, level) };
}
function passiveCard(def, level, isNew) {
  return { type: 'passive', id: def.id, level, name: def.name, desc: def.desc, icon: def.icon, isNew, params: { value: def.perLevel * level, level } };
}
function fusionCard(def) {
  return { type: 'fusion', id: def.id, level: 1, name: def.name, desc: def.desc, icon: def.icon, isNew: true, params: levelParams(def, 1) };
}
function bonusCard(id, value) {
  return { type: 'bonus', id, level: 0, name: 'ui.card.bonus_' + id, desc: 'ui.card.bonus_' + id + '_desc', icon: id === 'heal' ? 'ui_coeur' : 'ui_bronze', isNew: false, params: { value } };
}

/** Construit la liste des candidats pondérés pour ce joueur. */
function buildCandidates(p) {
  const C = balance().cards;
  pool.length = 0; weights.length = 0;
  const fus = availableFusions(p);
  for (let i = 0; i < fus.length; i++) { pool.push(fusionCard(fus[i])); weights.push(C.fusionWeight); }
  const nWeapons = p.weapons.length;
  for (const def of allWeapons().values()) {
    const w = findWeapon(p, def.id);
    if (w) { if (w.level < def.maxLevel) { pool.push(weaponCard(def, w.level + 1, false)); weights.push(C.weaponWeight); } }
    else if (nWeapons < C.maxWeapons && !fusedFrom(p, def.id)) { pool.push(weaponCard(def, 1, true)); weights.push(C.weaponWeight); }
  }
  const nPassives = p.passives.length;
  for (const def of allPassives().values()) {
    const pa = findPassive(p, def.id);
    if (pa) { if (pa.level < def.maxLevel) { pool.push(passiveCard(def, pa.level + 1, false)); weights.push(C.passiveWeight); } }
    else if (nPassives < C.maxPassives) { pool.push(passiveCard(def, 1, true)); weights.push(C.passiveWeight); }
  }
}

// Une arme consommée par une fusion ne revient pas.
function fusedFrom(p, weaponId) {
  for (let i = 0; i < p.fusions.length; i++) {
    const w = findWeapon(p, p.fusions[i]);
    if (w && w.def.weapon === weaponId) return true;
  }
  return false;
}

/** Tire `n` cartes distinctes dans `out` (tableau vidé puis rempli). */
export function drawCards(run, p, out, n = 3) {
  const C = balance().cards;
  buildCandidates(p);
  out.length = 0;
  while (out.length < n && pool.length > 0) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = run.cardRng.next() * total, idx = 0;
    for (; idx < weights.length - 1; idx++) { r -= weights[idx]; if (r < 0) break; }
    out.push(pool[idx]);
    pool.splice(idx, 1); weights.splice(idx, 1);
  }
  if (out.length < n) out.push(bonusCard('heal', Math.round(C.bonusHeal * 100)));
  if (out.length < n) out.push(bonusCard('bronze', C.bonusBronze));
  while (out.length < n) out.push(bonusCard('heal', Math.round(C.bonusHeal * 100)));
  return out;
}
