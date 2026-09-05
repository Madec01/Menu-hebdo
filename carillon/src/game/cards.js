// game/cards.js — tirage des 3 cartes de montée de niveau (sous-module de progression.js).
// Pondération (ARCHITECTURE.md § 11) : 60 % Timbres non maxés, 40 % Accords ; un objet déjà possédé
// pèse × ownedWeight, × fusionPartnerWeight si son partenaire de fusion est déjà au niveau requis ou si le
// couple est engagé (voir plus bas) ; une
// fusion disponible (seuils `unlock` de fusions.json) est TOUJOURS proposée en première carte ; jamais deux
// fois la même carte ; max 6 Timbres + 6 Accords ; à défaut, cartes bonus (soin, bronze). Tout aléa passe
// par run.cardRng (déterministe).
// Garantie de fusion : quand le joueur tient un couple engagé (Timbre ≥ 4 et Accord partenaire ≥ 2, ou
// l'inverse), une carte de ce couple apparaît au moins une fois toutes les 3 montées (GUARANTEE_EVERY).
// Carte : { type: 'weapon'|'passive'|'fusion'|'bonus', id, level, name, desc, icon, isNew, params }.

import { allWeapons, allPassives, allFusions, balance } from './data.js';
import { findWeapon } from './weapons.js';
import { findPassive } from './passives.js';
import { availableFusions, weaponReady, passiveReady } from './fusions.js';

const pool = [];   // candidats (réutilisé)
const weights = []; // poids parallèles
const GUARANTEE_EVERY = 3;
const ENGAGED_WEAPON = 4, ENGAGED_PASSIVE = 2;
const guard = { run: null, sincePartner: 0 };

function levelParams(def, level) {
  const s = { damage: def.base.damage, count: def.base.count, area: def.base.area, bounces: def.base.bounces || 0, bonus: def.base.markBonus || 0, execute: def.base.executeBelow || 0 };
  if (def.levels) for (let l = 1; l < level && l < def.levels.length; l++) {
    const d = def.levels[l];
    if (d.damage) s.damage += d.damage; if (d.count) s.count += d.count; if (d.area) s.area += d.area;
    if (d.bounces) s.bounces += d.bounces; if (d.markBonus) s.bonus += d.markBonus;
  }
  s.area = Math.round(s.area * 100); s.bonus = Math.round(s.bonus * 100); s.execute = Math.round(s.execute * 100);
  if (def.special) { if (def.special.healPerBar) s.heal = def.special.healPerBar; if (def.special.perfectMult) s.mult = Math.round(def.special.perfectMult * 100); }
  return s;
}

function weaponCard(def, level, isNew) {
  return { type: 'weapon', id: def.id, level, name: def.name, desc: def.desc, icon: def.icon, isNew, params: levelParams(def, level) };
}
function passiveCard(def, level, isNew) {
  const v = def.perLevel * level;
  // {value} = perLevel × niveau (points d'armure, px/s, PV/s), {pct} = la même en %, {level} = niveau,
  // {reflect} = recul renvoyé (Ferrure, %), {echo} = chance d'écho (Écho, %).
  const sp = def.special || {};
  return { type: 'passive', id: def.id, level, name: def.name, desc: def.desc, icon: def.icon, isNew, params: { value: Math.round(v * 100) / 100, level, pct: Math.round(def.perLevel * 100) * level, reflect: Math.round((sp.reflectPerLevel || 0) * 100) * level, echo: Math.round((sp.echoChancePerLevel || 0) * 100) * level } };
}
function fusionCard(def) {
  return { type: 'fusion', id: def.id, level: 1, name: def.name, desc: def.desc, icon: def.icon, isNew: true, params: levelParams(def, 1), hint: def.hint || null };
}
function bonusCard(id, value) {
  return { type: 'bonus', id, level: 0, name: 'ui.card.bonus_' + id, desc: 'ui.card.bonus_' + id + '_desc', icon: id === 'heal' ? 'ui_coeur' : 'ui_bronze', isNew: false, params: { value } };
}

// Un partenaire de fusion de cet objet est-il déjà au niveau requis ? (toutes les fusions sont parcourues :
// un Accord peut entrer dans deux recettes.)
function partnerReady(p, id, isWeapon) {
  for (const f of allFusions().values()) {
    if (isWeapon && f.weapon === id && passiveReady(p, f)) return true;
    if (!isWeapon && f.passive === id && weaponReady(p, f)) return true;
  }
  return false;
}

// Cet objet appartient-il à un couple « engagé » non encore fusionné : Timbre ≥ 4 et Accord ≥ 2 possédés,
// ou l'un des deux déjà au seuil de la fusion et l'autre possédé ?
function engaged(p, id, isWeapon) {
  for (const f of allFusions().values()) {
    if (p.fusions.indexOf(f.id) >= 0) continue;
    if ((isWeapon && f.weapon !== id) || (!isWeapon && f.passive !== id)) continue;
    const w = findWeapon(p, f.weapon), pa = findPassive(p, f.passive);
    if (!w || !pa) continue;
    if (w.level >= ENGAGED_WEAPON && pa.level >= ENGAGED_PASSIVE) return true;
    if (weaponReady(p, f) || passiveReady(p, f)) return true;
  }
  return false;
}

/** Construit la liste des candidats pondérés pour ce joueur. */
function buildCandidates(p) {
  const C = balance().cards;
  const owned = C.ownedWeight || 1, partner = C.fusionPartnerWeight || owned;
  pool.length = 0; weights.length = 0;
  const fus = availableFusions(p);
  for (let i = 0; i < fus.length; i++) { pool.push(fusionCard(fus[i])); weights.push(C.fusionWeight); }
  const nWeapons = p.weapons.length;
  for (const def of allWeapons().values()) {
    const w = findWeapon(p, def.id);
    if (w) { if (w.level < def.maxLevel) { pool.push(weaponCard(def, w.level + 1, false)); weights.push(C.weaponWeight * (partnerReady(p, def.id, true) || engaged(p, def.id, true) ? partner : owned)); } }
    else if (nWeapons < C.maxWeapons && !fusedFrom(p, def.id)) { pool.push(weaponCard(def, 1, true)); weights.push(C.weaponWeight); }
  }
  const nPassives = p.passives.length;
  for (const def of allPassives().values()) {
    const pa = findPassive(p, def.id);
    if (pa) { if (pa.level < def.maxLevel) { pool.push(passiveCard(def, pa.level + 1, false)); weights.push(C.passiveWeight * (partnerReady(p, def.id, false) || engaged(p, def.id, false) ? partner : owned)); } }
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

function isPartnerCard(p, c) { return (c.type === 'weapon' || c.type === 'passive') && !c.isNew && engaged(p, c.id, c.type === 'weapon'); }

function take(out, idx) { out.push(pool[idx]); pool.splice(idx, 1); weights.splice(idx, 1); }

/** Tire `n` cartes distinctes dans `out` (tableau vidé puis rempli). */
export function drawCards(run, p, out, n = 3) {
  const C = balance().cards;
  if (guard.run !== run) { guard.run = run; guard.sincePartner = 0; }
  buildCandidates(p);
  out.length = 0;
  // Fusion disponible : garantie en première carte.
  if (pool.length && pool[0].type === 'fusion') take(out, 0);
  // Couple engagé : une carte du couple au moins une fois toutes les GUARANTEE_EVERY montées.
  if (guard.sincePartner >= GUARANTEE_EVERY - 1) {
    let best = -1;
    for (let i = 0; i < pool.length; i++) if (isPartnerCard(p, pool[i])) { best = i; break; }
    if (best >= 0) take(out, best);
  }
  while (out.length < n && pool.length > 0) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = run.cardRng.next() * total, idx = 0;
    for (; idx < weights.length - 1; idx++) { r -= weights[idx]; if (r < 0) break; }
    take(out, idx);
  }
  let hasPartner = false;
  for (let i = 0; i < out.length; i++) if (isPartnerCard(p, out[i]) || out[i].type === 'fusion') hasPartner = true;
  guard.sincePartner = hasPartner ? 0 : guard.sincePartner + 1;
  if (out.length < n) out.push(bonusCard('heal', Math.round(C.bonusHeal * 100)));
  if (out.length < n) out.push(bonusCard('bronze', C.bonusBronze));
  while (out.length < n) out.push(bonusCard('heal', Math.round(C.bonusHeal * 100)));
  return out;
}
