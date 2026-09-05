// ui/screens.js — fabrique tous les écrans (§ 11 : create(deps) → écran) et les
// renvoie sous forme { nom → écran } pour la pile d'états (ui/states.js).
// Écrans de base : unlock, title, hub, run, results. Empilables : tutorial,
// levelup, relicpick, pause, options, savetext, codex, credits, tree, altar, leaf, confirm.

import { createUnlock, createTitle } from './menu.js';
import { createHub } from './hub.js';
import { createTree } from './hub-tree.js';
import { createAltar } from './hub-altar.js';
import { createLeafReader } from './lore.js';
import { createRun } from './run-screen.js';
import { createTutorial } from './tutorial.js';
import { createLevelUp } from './levelup.js';
import { createRelicPick } from './relic-pick.js';
import { createPause } from './pause.js';
import { createResults } from './results.js';
import { createCodex } from './codex.js';
import { createOptions } from './options.js';
import { createSaveText } from './options-data.js';
import { createCredits } from './credits.js';
import { createConfirm } from './dialog.js';
import { createCalibration } from './calibration.js';

export function createScreens(deps) {
  return {
    unlock: createUnlock(deps),
    title: createTitle(deps),
    hub: createHub(deps),
    tree: createTree(deps),
    altar: createAltar(deps),
    leaf: createLeafReader(deps),
    run: createRun(deps),
    tutorial: createTutorial(deps),
    levelup: createLevelUp(deps),
    relicpick: createRelicPick(deps),
    pause: createPause(deps),
    results: createResults(deps),
    codex: createCodex(deps),
    options: createOptions(deps),
    savetext: createSaveText(deps),
    credits: createCredits(deps),
    confirm: createConfirm(deps),
    calibration: createCalibration(deps),
  };
}
