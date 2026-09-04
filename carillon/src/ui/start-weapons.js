// ui/start-weapons.js — Timbres de départ (méta, PROMPT.md § 1) côté interface :
// lecture de save.unlocked.weapons et de start-weapons.json (niveau requis en
// run, prix en Bronze), liste des choix par sonneur (le Muet garde son Diapason
// et choisit un second Timbre), choix mémorisé (save.lastWeaponByCharacter),
// achat au hub, et toast par différence sur save:changed (déblocages faits par
// game/progression.js pendant une run). Le gameplay ne dépend pas de ce module.

import { bus } from '../core/events.js';
import { getSave, commit } from '../core/save.js';
import { play as playSfx } from '../audio/sfx.js';
import { t } from './i18n.js';
import { weapons, characters, achievements, startWeaponRules, def as dataDef } from './gamedata.js';
import { toast } from './toasts.js';

let known = null;   // instantané des Timbres débloqués (pour ne notifier que les nouveaux)

const rules = () => startWeaponRules() || {};
/** Niveau à atteindre en run pour débloquer un Timbre. */
export function unlockLevel() { const r = rules(); return r.unlockLevel || 7; }
/** Prix en Bronze d'un Timbre (achat au hub). */
export function weaponCost(id) { const c = rules().costs || {}; return c[id] !== undefined ? c[id] : 0; }

/** Le Timbre est-il disponible au départ ? (sauvegarde, ou Timbre d'un sonneur débloqué). */
export function isStartWeaponUnlocked(id) {
  const s = getSave();
  if (s.unlocked.weapons.indexOf(id) >= 0) return true;
  for (const c of characters()) if (c.startWeapon === id && s.unlocked.characters.indexOf(c.id) >= 0) return true;
  return false;
}

/** Complète save.unlocked.weapons avec les Timbres des sonneurs débloqués ; renvoie true si modifié (sans commit). */
export function syncStartWeapons() {
  const s = getSave();
  let changed = false;
  for (const c of characters()) {
    if (s.unlocked.characters.indexOf(c.id) >= 0 && c.startWeapon && s.unlocked.weapons.indexOf(c.startWeapon) < 0) { s.unlocked.weapons.push(c.startWeapon); changed = true; }
  }
  if (changed) known = s.unlocked.weapons.slice();
  return changed;
}

/** Icône d'un Timbre (planche icons). */
export function weaponIcon(id) { const d = dataDef('weapons', id); return d ? d.icon : 'ui_sceau'; }

/** Texte de la condition de déblocage d'un Timbre verrouillé. */
export function conditionText(id) { return t('ui.hub.weapon_condition', { level: unlockLevel(), cost: weaponCost(id) }); }

/** Paramètres de la description d'un Timbre ({damage}, {count}, {area}, {bonus}) au niveau 1. */
export function weaponParams(def) {
  const b = (def && def.base) || {};
  return { damage: b.damage || 0, count: b.count || 1, area: Math.round((b.area || 1) * 100), bonus: Math.round((b.markBonus || 0) * 100) };
}

/**
 * Choix proposés par le sélecteur pour un sonneur : tous les Timbres sauf celui qui lui est imposé
 * (startWeaponFixed) ; dans ce cas une entrée { id: null } (« Diapason seul ») ferme la liste.
 */
export function choicesFor(charDef) {
  const fixed = charDef && charDef.startWeaponFixed ? charDef.startWeapon : null;
  const out = [];
  for (const w of weapons()) if (w.id !== fixed) out.push({ id: w.id, def: w });
  if (fixed) out.push({ id: null, def: null });
  return out;
}

/** Timbre mémorisé pour ce sonneur (ou défaut : son Timbre ; pour le Muet, le premier Timbre débloqué). */
export function chosenWeapon(charDef) {
  if (!charDef) return null;
  const s = getSave();
  const saved = s.lastWeaponByCharacter ? s.lastWeaponByCharacter[charDef.id] : undefined;
  if (saved === null && charDef.startWeaponFixed) return null;
  if (saved && dataDef('weapons', saved) && saved !== (charDef.startWeaponFixed ? charDef.startWeapon : '') && isStartWeaponUnlocked(saved)) return saved;
  if (!charDef.startWeaponFixed) return charDef.startWeapon;
  for (const c of choicesFor(charDef)) if (c.id && isStartWeaponUnlocked(c.id)) return c.id;
  return null;
}

/** Mémorise le choix (id ou null) pour ce sonneur. */
export function rememberWeapon(charId, id) {
  const s = getSave();
  if (!s.lastWeaponByCharacter) s.lastWeaponByCharacter = {};
  if (s.lastWeaponByCharacter[charId] === id) return;
  s.lastWeaponByCharacter[charId] = id;
  commit();
}

/** Achat d'un Timbre de départ en Bronze ; renvoie true si débloqué. Toast et haut-fait éventuel. */
export function buyStartWeapon(id) {
  const s = getSave();
  if (isStartWeaponUnlocked(id)) return false;
  const cost = weaponCost(id);
  if (s.bronze < cost) { toast({ title: t('ui.hub.start_weapon_label'), body: t('ui.hub.not_enough_bronze'), icon: 'ui_bronze' }); return false; }
  s.bronze -= cost;
  s.unlocked.weapons.push(id);
  known = s.unlocked.weapons.slice();
  // Haut-fait « tous les Timbres » (condition lisible depuis la seule sauvegarde).
  for (const a of achievements()) {
    if (a.condition && a.condition.type === 'weapons_unlocked' && s.unlocked.weapons.length >= a.condition.count && s.unlocked.achievements.indexOf(a.id) < 0) {
      s.unlocked.achievements.push(a.id); bus.emit('achievement:unlock', { id: a.id });
    }
  }
  commit();
  playSfx('achievement');
  toast({ title: t('ui.toast.start_weapon'), body: t('weapon.' + id + '.name'), icon: weaponIcon(id) });
  return true;
}

/** Abonne le toast « Timbre de départ débloqué » aux déblocages faits pendant une run. */
export function initStartWeaponToasts() {
  known = getSave().unlocked.weapons.slice();
  bus.on('save:changed', ({ save }) => {
    const list = save.unlocked.weapons || [];
    for (const id of list) if (known.indexOf(id) < 0) toast({ title: t('ui.toast.start_weapon'), body: t('weapon.' + id + '.name'), icon: weaponIcon(id) });
    known = list.slice();
  });
}
