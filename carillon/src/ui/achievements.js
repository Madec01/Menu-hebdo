// ui/achievements.js — notifications de déblocage (hauts-faits, Feuillets,
// fusions, paroisses) sous forme de toasts, et liste des hauts-faits pour le
// codex. Les conditions sont évaluées côté gameplay (game/unlocks.js) ; ici on
// ne fait qu'écouter le bus et afficher.

import { bus } from '../core/events.js';
import { getSave } from '../core/save.js';
import { t } from './i18n.js';
import { achievements } from './gamedata.js';
import { toast } from './toasts.js';
import { initStartWeaponToasts } from './start-weapons.js';

/** Abonne les notifications. */
export function initAchievements() {
  initStartWeaponToasts();
  bus.on('achievement:unlock', ({ id }) => {
    toast({ title: t('ui.toast.achievement'), body: t('achievement.' + id + '.name'), icon: 'ui_sceau' });
  });
  bus.on('lore:unlock', ({ leafId }) => {
    toast({ title: t('ui.toast.leaf'), body: t('lore.' + leafId + '.title'), icon: 'ui_lanterne' });
  });
  bus.on('weapon:fusion', ({ fusionId }) => {
    toast({ title: t('ui.toast.fusion'), body: t('fusion.' + fusionId + '.name'), icon: 'fusion_' + fusionId });
  });
  // Paroisses ouvertes par une victoire : comparées avant/après la sauvegarde.
  let known = getSave().unlocked.parishes.slice();
  bus.on('save:changed', ({ save }) => {
    for (const p of save.unlocked.parishes) {
      if (known.indexOf(p) < 0) toast({ title: t('ui.toast.parish_unlocked'), body: t('parish.' + p + '.name'), icon: 'ui_lanterne' });
    }
    known = save.unlocked.parishes.slice();
  });
}

/** Définitions des hauts-faits (achievements.json). */
export function achievementDefs() { return achievements(); }

/** Liste pour le codex : [{ id, name, desc, unlocked }]. */
export function achievementList() {
  const save = getSave();
  return achievementDefs().map((a) => ({
    id: a.id, name: t(a.name), desc: t(a.desc), unlocked: save.unlocked.achievements.indexOf(a.id) >= 0,
  }));
}
