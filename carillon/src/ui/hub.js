// ui/hub.js — Le Beffroi Mère : carte des 5 paroisses en parchemin (nœuds
// reliés, verrouillage selon save.unlocked.parishes), sélection du sonneur
// (sprite animé, stats, quête de déblocage ou rachat en Bronze), sélecteur du Timbre de
// départ (hub-weapon.js), accès à l'arbre du Beffroi (hub-tree.js), à l'autel
// des Feuillets (hub-altar.js) et aux contrats de nuit (hub-contracts.js), seed manuelle
// (champ DOM discret) et bouton « Sonner la nuit ».
// Vague 2 : la seed de la nuit est fixée dès l'entrée au hub (manuelle ou fraîche) pour que les contrats
// proposés (game/contracts.js → offerContracts) soient ceux du run ; Sourdine I–V choisie par paroisse
// (ui/sourdine.js) ; le Battant parle à l'arrivée (ui/battant.js).
// Navigation : ↑↓ change de rangée (paroisses / Sourdine / sonneur / Timbre / boutons), ◄► choisit.

import { getSave, commit } from '../core/save.js';
import { mix32, hashSeed } from '../core/rng.js';
import * as atlas from '../render/atlas.js';
import * as renderer from '../render/renderer.js';
import * as camera from '../render/camera.js';
import * as lighting from '../render/lighting.js';
import * as music from '../audio/music.js';
import { playUi, play as playSfx } from '../audio/sfx.js';
import { t } from './i18n.js';
import { characters, parishes, waveOf } from './gamedata.js';
import * as states from './states.js';
import { showInput } from './dom.js';
import { toast } from './toasts.js';
import { leafIds, isUnlocked as leafUnlocked, unreadCount } from './lore.js';
import { createWeaponPicker } from './hub-weapon.js';
import { syncStartWeapons } from './start-weapons.js';
import { upgradeLevel } from './hub-tree.js';
import { sourdineUnlocked, sourdineChosen, setSourdine, sourdineSummary } from './sourdine.js';
import { battantSpeak } from './battant.js';
import { questText } from './next-unlock.js';
import { offerContracts } from '../game/contracts.js';
import { panel, text, paragraph, button, icon, hit, heading, C } from './widgets.js';

const W = 480, H = 270;
// Positions des nœuds sur la carte (pixels logiques, dans le panneau de gauche).
const NODES = { cendrelune: [44, 138], tourbes: [98, 92], val_des_cordes: [152, 130], nef_noyee: [200, 84], beffroi_mere: [130, 44] };
const ORDER = ['cendrelune', 'tourbes', 'val_des_cordes', 'nef_noyee', 'beffroi_mere'];
const MAP = { x: 6, y: 22, w: 250, h: 190 };
const SIDE = { x: 262, y: 22, w: 212, h: 190 };
const BTN = [ // rangée du bas
  { id: 'upgrades', x: 6, w: 84 }, { id: 'altar', x: 94, w: 84 }, { id: 'contracts', x: 182, w: 84 }, { id: 'seed', x: 270, w: 56 }, { id: 'start', x: 330, w: 144 },
];
const BTN_Y = 220, BTN_H = 22;
// Stats en mini-jauges sur deux colonnes : [clé, stat, max, colonne, rangée].
const STATS = [['stat_hp', 'maxHp', 160, 0, 0], ['stat_speed', 'speed', 140, 0, 1], ['stat_armor', 'armor', 5, 0, 2], ['stat_window', 'windowMult', 1.5, 1, 0], ['stat_damage', 'damageMult', 1.3, 1, 1]];
const STAT_COL = [{ label: 12, gauge: 56, w: 40 }, { label: 104, gauge: 146, w: 54 }];
const ROWS = 5; // 0 paroisses · 1 Sourdine · 2 sonneur · 3 Timbre de départ · 4 boutons
const ROW_BTN = 4;
const BASE_CONTRACTS = 2;

export function createHub(deps) {
  let row = 0, parish = 0, charIdx = 0, btn = 4, time = 0, seedEditing = false, seed = 0;
  const offer = { ids: [], accepted: [], key: '' };
  const arrows = { prev: { x: SIDE.x + 8, y: SIDE.y + 40, w: 16, h: 20 }, next: { x: SIDE.x + SIDE.w - 24, y: SIDE.y + 40, w: 16, h: 20 } };
  const unlockRect = { x: SIDE.x + 30, y: SIDE.y + 168, w: SIDE.w - 60, h: 16 };
  const sourdineRects = { prev: { x: MAP.x + 10, y: MAP.y + MAP.h - 17, w: 14, h: 13 }, next: { x: MAP.x + MAP.w - 24, y: MAP.y + MAP.h - 17, w: 14, h: 13 } };
  const picker = createWeaponPicker(SIDE);
  const save = () => getSave();
  const parishList = () => (parishes().length ? parishes() : ORDER.map((id) => ({ id })));
  const charList = () => (characters().length ? characters() : [{ id: 'wren', sprite: 'wren', stats: {}, unlockCost: 0 }]);
  const curParish = () => parishList()[parish];
  const curChar = () => charList()[charIdx];
  const parishOpen = (id) => save().unlocked.parishes.indexOf(id) >= 0;
  const charOpen = (id) => save().unlocked.characters.indexOf(id) >= 0;
  const canStart = () => !!deps.game && parishOpen(curParish().id) && charOpen(curChar().id) && picker.ok();
  const contractCount = () => BASE_CONTRACTS + upgradeLevel('contrat_en_plus');
  const sourdineRow = () => sourdineUnlocked(curParish().id) > 1;

  /** Seed de la nuit : manuelle (hashée) ou fraîche ; les contrats en dépendent. */
  function refreshSeed() { const s = save(); seed = s.seedManual ? hashSeed(s.seedManual) : freshSeed(); refreshOffer(); }

  /** Contrats proposés pour (seed, paroisse, sonneur) ; les acceptations sont remises à zéro si l'offre change. */
  function refreshOffer() {
    const p = curParish(), c = curChar();
    const key = seed + '|' + p.id + '|' + c.id + '|' + contractCount();
    if (key === offer.key) return;
    const wave = waveOf(p.id);
    const moments = wave && wave.moments ? wave.moments.map((m) => m.id) : null;
    offer.ids = offerContracts(seed, contractCount(), { parishId: p.id, characterId: c.id, moments });
    offer.accepted.length = 0; offer.key = key;
  }

  function selectParish(i) {
    if (i === parish) return;
    parish = (i + parishList().length) % parishList().length; playUi('ui_move'); refreshOffer();
  }
  function cycleChar(d) { charIdx = (charIdx + d + charList().length) % charList().length; picker.setChar(curChar()); playUi('ui_move'); refreshOffer(); }
  function cycleSourdine(d) {
    const id = curParish().id, n = setSourdine(id, sourdineChosen(id) + d);
    playUi(d > 0 ? 'ui_confirm' : 'ui_move');
    return n;
  }
  /** Change de rangée en sautant la Sourdine (un seul niveau) et le Timbre (sonneur verrouillé). */
  function moveRow(d) {
    let r = row;
    do { r = (r + d + ROWS) % ROWS; } while ((r === 3 && !charOpen(curChar().id)) || (r === 1 && !sourdineRow()));
    row = r; playUi('ui_move');
  }

  function tryUnlockChar() {
    const c = curChar(), s = save();
    if (charOpen(c.id)) return;
    if (s.bronze < c.unlockCost) { playUi('ui_cancel'); toast({ title: t('ui.hub.bell_ringer'), body: t('ui.hub.not_enough_bronze'), icon: 'ui_bronze' }); return; }
    s.bronze -= c.unlockCost; s.unlocked.characters.push(c.id); syncStartWeapons(); commit();
    picker.setChar(c);
    playSfx('achievement'); toast({ title: t('ui.hub.bell_ringer'), body: t('ui.hub.unlocked_char', { name: t(c.name) }), icon: 'ui_coeur' });
  }

  function editSeed() {
    if (seedEditing) return;
    seedEditing = true;
    const s = save();
    const r = BTN[3];
    showInput({
      x: r.x, y: BTN_Y, w: r.w, h: BTN_H, value: s.seedManual || '', placeholder: t('ui.hub.seed_placeholder'), maxLength: 24,
      onDone(v) { seedEditing = false; if (v === null) return; const txt = v.trim(); s.seedManual = txt || null; commit(); playUi('ui_confirm'); refreshSeed(); },
    });
  }

  function start() {
    if (!deps.game) { playUi('ui_cancel'); toast({ title: t('ui.hub.start'), body: t('ui.hub.error_game'), icon: 'ui_mort' }); return; }
    if (!canStart()) { playUi('ui_cancel'); return; }
    const s = save();
    s.lastParish = curParish().id; s.lastCharacter = curChar().id;
    s.stats.contracts = s.stats.contracts || { offered: 0, accepted: 0, done: 0 };
    s.stats.contracts.offered += offer.ids.length;
    commit();
    states.replace('run', {
      parishId: curParish().id, characterId: curChar().id, seed, seedText: s.seedManual, tutorial: !s.tutorialDone, weaponId: picker.selected(),
      sourdine: sourdineChosen(curParish().id), contracts: offer.accepted.slice(), holdVictory: true,
    }, { sound: 'bell_tier' });
  }

  function activate(id) {
    if (id === 'upgrades') { playUi('ui_confirm'); states.push('tree'); }
    else if (id === 'altar') { playUi('ui_confirm'); states.push('altar'); }
    else if (id === 'contracts') { playUi('ui_confirm'); states.push('contracts', { offer, count: contractCount() }); }
    else if (id === 'seed') { playUi('ui_confirm'); editSeed(); }
    else if (id === 'start') start();
  }

  function confirm() {
    if (row === 0) { if (parishOpen(curParish().id)) { row = ROW_BTN; btn = 4; playUi('ui_confirm'); } else playUi('ui_cancel'); }
    else if (row === 1) { cycleSourdine(1); }
    else if (row === 2) { if (charOpen(curChar().id)) { row = 3; playUi('ui_confirm'); } else tryUnlockChar(); }
    else if (row === 3) { if (picker.confirm()) { row = ROW_BTN; btn = 4; } }
    else activate(BTN[btn].id);
  }

  function renderWorld(ctx, alpha) {
    camera.snap(0, 0);
    renderer.setAshes(0.4); renderer.setFog(0.5); renderer.setVignette(0.5);
    lighting.setAmbient('#1a1712');
    ctx.fillStyle = '#0e0c09'; ctx.fillRect(-W / 2, -H / 2, W, H);
    lighting.addLight(0, -30, 320, '#8f7a58', 0.6, 0.05);
    lighting.setBeatPulse(0);
  }

  function renderMap(ui) {
    panel(ui, MAP.x, MAP.y, MAP.w, MAP.h, 'parchment');
    text(ui, t('ui.hub.map'), MAP.x + 12, MAP.y + 7, { size: 9, color: C.encreClaire });
    // Chemins au fusain entre paroisses successives.
    ui.strokeStyle = C.encreClaire; ui.lineWidth = 1; ui.setLineDash([3, 3]); ui.beginPath();
    for (let i = 1; i < ORDER.length; i++) { const a = NODES[ORDER[i - 1]], b = NODES[ORDER[i]]; ui.moveTo(a[0], a[1]); ui.lineTo(b[0], b[1]); }
    ui.stroke(); ui.setLineDash([]);
    const list = parishList();
    for (let i = 0; i < list.length; i++) {
      const p = list[i], pos = NODES[p.id] || [40 + i * 40, 100];
      const open = parishOpen(p.id), sel = i === parish;
      if (sel) { ui.globalAlpha = 0.35 + 0.25 * Math.sin(time * 4); ui.fillStyle = C.bronze; ui.fillRect(pos[0] - 12, pos[1] - 12, 24, 24); ui.globalAlpha = 1; }
      panel(ui, pos[0] - 11, pos[1] - 11, 22, 22, open ? (sel && row === 0 ? 'bronze' : 'dark') : 'dark');
      icon(ui, open ? 'ui_lanterne' : 'ui_sceau', pos[0] - 8, pos[1] - 8, 0.5);
      text(ui, t('parish.' + p.id + '.name'), pos[0], pos[1] + 13, { size: 9, align: 'center', color: open ? C.encre : C.gris });
      // Record de la paroisse (temps tenu) sous le nom, en petit.
      const r = save().records && save().records.parish ? save().records.parish[p.id] : null;
      if (r && r.bestTime > 0) text(ui, t('ui.hub.record_short', { time: Math.floor(r.bestTime / 60) + ':' + String(r.bestTime % 60).padStart(2, '0') }), pos[0], pos[1] + 22, { size: 7, align: 'center', color: C.encreClaire });
    }
    const p = curParish();
    const desc = parishOpen(p.id) ? t('parish.' + p.id + '.desc') : t('ui.hub.locked_parish', { parish: t('parish.' + (p.unlock ? p.unlock.parish : 'cendrelune') + '.name') });
    heading(ui, t('parish.' + p.id + '.name'), MAP.x + MAP.w / 2, MAP.y + MAP.h - 62, 14);
    paragraph(ui, desc, MAP.x + 14, MAP.y + MAP.h - 44, MAP.w - 28, { size: 8, color: C.encre, lineHeight: 9, maxLines: 3 });
    // Sourdine de la paroisse : niveau choisi, multiplicateurs, flèches si plusieurs niveaux sont ouverts.
    if (parishOpen(p.id)) {
      const n = sourdineChosen(p.id), open = sourdineUnlocked(p.id) > 1;
      if (open) { button(ui, { ...sourdineRects.prev, label: t('ui.hub.prev'), focused: row === 1, size: 8 }); button(ui, { ...sourdineRects.next, label: t('ui.hub.next'), focused: row === 1, size: 8 }); }
      text(ui, sourdineSummary(p.id, n), MAP.x + MAP.w / 2, MAP.y + MAP.h - 14, { size: 8, align: 'center', color: row === 1 ? C.bronze : C.encreClaire, maxWidth: MAP.w - 56 });
    }
  }

  function renderChar(ui) {
    panel(ui, SIDE.x, SIDE.y, SIDE.w, SIDE.h, 'parchment');
    const c = curChar(), open = charOpen(c.id);
    text(ui, t('ui.hub.bell_ringer'), SIDE.x + 12, SIDE.y + 7, { size: 9, color: C.encreClaire });
    const cx = SIDE.x + SIDE.w / 2;
    // Sprite animé (idle_down) dessiné sur le calque HUD ; sépia si verrouillé.
    const anim = 'idle_down';
    atlas.draw(ui, c.sprite || c.id, anim, atlas.frameAt(c.sprite || c.id, anim, time), cx, SIDE.y + 62, { alpha: open ? 1 : 0.4, scale: 1 });
    heading(ui, t('char.' + c.id + '.name'), cx, SIDE.y + 66, 15);
    button(ui, { ...arrows.prev, label: t('ui.hub.prev'), focused: row === 2, size: 10 });
    button(ui, { ...arrows.next, label: t('ui.hub.next'), focused: row === 2, size: 10 });
    paragraph(ui, t('char.' + c.id + '.trait'), SIDE.x + 12, SIDE.y + 84, SIDE.w - 24, { size: 8, color: C.encre, lineHeight: 8, maxLines: 3 });
    // Stats en mini-jauges (deux colonnes).
    for (let i = 0; i < STATS.length; i++) {
      const [key, stat, max, col, r] = STATS[i];
      const v = c.stats && c.stats[stat] !== undefined ? c.stats[stat] : (stat === 'windowMult' || stat === 'damageMult' ? 1 : 0);
      const y = SIDE.y + 112 + r * 8, L = STAT_COL[col];
      text(ui, t('ui.hub.' + key), SIDE.x + L.label, y, { size: 8, color: C.encre, maxWidth: L.gauge - L.label - 2 });
      miniGauge(ui, SIDE.x + L.gauge, y + 1, L.w, 5, v / max);
    }
    // Sonneur débloqué : sélecteur de Timbre de départ ; sinon : sa quête, et le rachat en Bronze en repli.
    if (open) picker.render(ui, row === 3);
    else {
      if (c.unlock) paragraph(ui, questText(c), SIDE.x + 12, SIDE.y + 138, SIDE.w - 24, { size: 8, color: C.braise, lineHeight: 9, maxLines: 3 });
      else text(ui, t('ui.hub.start_weapon', { weapon: c.startWeapon ? t('weapon.' + c.startWeapon + '.name') : '' }), cx, SIDE.y + 140, { size: 8, align: 'center', color: C.encreClaire });
      button(ui, { ...unlockRect, label: t(c.unlock ? 'ui.hub.buy_char' : 'ui.hub.unlock_char', { cost: c.unlockCost }), focused: row === 2, size: 8, disabled: save().bronze < c.unlockCost });
    }
  }

  function renderButtons(ui) {
    const s = save();
    icon(ui, 'ui_bronze', 6, 4, 0.5);
    text(ui, t('ui.common.bronze', { value: s.bronze }), 24, 8, { size: 11, color: C.bronze, shadow: true });
    heading(ui, t('ui.hub.title'), W / 2, 2, 16);
    const found = leafIds().filter(leafUnlocked).length;
    text(ui, t('ui.hub.leaves_count', { found, total: leafIds().length }), W - 6, 8, { size: 9, align: 'right', color: C.os });
    for (let i = 0; i < BTN.length; i++) {
      const b = BTN[i];
      let label = t('ui.hub.' + b.id);
      if (b.id === 'seed') label = s.seedManual ? t('ui.hub.seed_manual', { seed: s.seedManual }) : t('ui.hub.seed_random');
      if (b.id === 'altar' && unreadCount() > 0) label += ' •';
      if (b.id === 'contracts') label = t('ui.hub.contracts_n', { count: offer.accepted.length, total: offer.ids.length });
      button(ui, { x: b.x, y: BTN_Y, w: b.w, h: BTN_H, label, focused: row === ROW_BTN && btn === i, size: b.id === 'start' ? 12 : 9, disabled: b.id === 'start' && !canStart(), icon: b.id === 'start' ? picker.icon() : null });
    }
    const hint = charOpen(curChar().id) && !picker.ok() ? t('ui.hub.weapon_locked_start') : !s.tutorialDone ? t('ui.hub.tutorial_first') : t('ui.hub.seed_hint');
    text(ui, hint, W / 2, H - 20, { size: 9, align: 'center', color: C.gris });
  }

  return {
    enter() {
      const s = save();
      parish = Math.max(0, ORDER.indexOf(s.lastParish || 'cendrelune'));
      charIdx = Math.max(0, charList().findIndex((c) => c.id === (s.lastCharacter || 'wren')));
      if (syncStartWeapons()) commit();
      picker.setChar(curChar());
      row = ROW_BTN; btn = 4; time = 0;
      offer.key = ''; refreshSeed();
      if (music.current() !== 'hub') music.play('hub', { layers: 2, fadeSec: 1.2 }).catch(() => {});
      battantSpeak();
    },
    exit() {},
    update(_, realDt) {
      time += realDt;
      const m = states.mouse;
      if (seedEditing) return;
      if (m.moved) {
        for (let i = 0; i < BTN.length; i++) if (hit({ x: BTN[i].x, y: BTN_Y, w: BTN[i].w, h: BTN_H }, m.x, m.y) && (row !== ROW_BTN || btn !== i)) { row = ROW_BTN; btn = i; playUi('ui_move'); }
      }
      if (!m.clicked) return;
      for (let i = 0; i < BTN.length; i++) if (hit({ x: BTN[i].x, y: BTN_Y, w: BTN[i].w, h: BTN_H }, m.x, m.y)) { row = ROW_BTN; btn = i; activate(BTN[i].id); return; }
      const list = parishList();
      for (let i = 0; i < list.length; i++) { const pos = NODES[list[i].id]; if (pos && hit({ x: pos[0] - 12, y: pos[1] - 12, w: 24, h: 24 }, m.x, m.y)) { row = 0; selectParish(i); return; } }
      if (sourdineRow() && hit(sourdineRects.prev, m.x, m.y)) { row = 1; cycleSourdine(-1); return; }
      if (sourdineRow() && hit(sourdineRects.next, m.x, m.y)) { row = 1; cycleSourdine(1); return; }
      if (hit(arrows.prev, m.x, m.y)) { row = 2; cycleChar(-1); return; }
      if (hit(arrows.next, m.x, m.y)) { row = 2; cycleChar(1); return; }
      if (charOpen(curChar().id)) { if (picker.click(m.x, m.y)) row = 3; }
      else if (hit(unlockRect, m.x, m.y)) { row = 2; tryUnlockChar(); }
    },
    handleAction(a) {
      if (seedEditing) return false;
      if (a === 'menuUp') { moveRow(-1); return true; }
      if (a === 'menuDown') { moveRow(1); return true; }
      if (a === 'menuLeft' || a === 'menuRight') {
        const d = a === 'menuLeft' ? -1 : 1;
        if (row === 0) selectParish(parish + d); else if (row === 1) cycleSourdine(d); else if (row === 2) cycleChar(d); else if (row === 3) picker.cycle(d);
        else { btn = (btn + d + BTN.length) % BTN.length; playUi('ui_move'); }
        return true;
      }
      if (a === 'confirm') { confirm(); return true; }
      if (a === 'cancel') { playUi('ui_cancel'); states.replace('title', null, { sound: null }); return true; }
      return false;
    },
    renderWorld,
    render(ui) { renderMap(ui); renderChar(ui); renderButtons(ui); },
    /** Offre de contrats de la nuit (tests) : { ids, accepted }. */
    contractOffer: () => offer,
    /** Seed retenue pour la prochaine nuit (tests). */
    seed: () => seed,
  };
}

/** Mini-jauge de stat (trop petite pour le 9-slice) : fond tourbe, remplissage bronze. */
function miniGauge(ui, x, y, w, h, v) {
  ui.fillStyle = C.tourbe; ui.fillRect(x, y, w, h);
  const k = v < 0 ? 0 : v > 1 ? 1 : v;
  if (k > 0) { ui.fillStyle = C.bronze; ui.fillRect(x + 1, y + 1, Math.max(1, Math.round((w - 2) * k)), h - 2); }
}

/** Seed « au hasard » : dérivée de l'horloge (aucun tirage non seedé, conformément aux règles du projet). */
function freshSeed() { return mix32((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0) >>> 0; }
