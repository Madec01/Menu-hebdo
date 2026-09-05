#!/usr/bin/env node
// tests/checks.mjs — contrôles statiques de CARILLON (agent G). Aucune dépendance, aucun navigateur.
//   node tests/checks.mjs            # liste [OK]/[KO], code de sortie 1 s'il y a un KO
//   node tests/checks.mjs --json     # résultat JSON
// Vérifie : JSON valides ; identifiants du registre (ARCHITECTURE.md § 10 bis) ; clés i18n référencées par
// les JSON et par les appels t('…') présentes dans fr ET en ; mêmes clés dans fr/en et ui-fr/ui-en ;
// sprites, tuiles, icônes, bruitages, pistes, presets de particules référencés existent dans les manifestes
// et sur le disque ; aucun src/**/*.js > 400 lignes ; aucun Math.random hors src/audio ; aucun
// OscillatorNode ; aucun alert/prompt/confirm ; aucune chaîne française en dur dans src/ui et src/main.js.
// Vague 2 : registre à jour (9 fusions et leurs couples, 11 ennemis dont contretemps / voleur_de_cran / desaccordeur,
// 19–20 hauts-faits réels, 9 motifs de Moments) ; aucun `duck()` par tir (audio.js n'écoute que enemy:hit crit et
// weapon:fusion) ; `bell_minute` joué par bell-hour.js seulement ; clés i18n des nouveaux contenus (fusion.<id>.hint,
// enemy.<nouveaux>.name|lore, relic.<id>.*, moment.<id>.name, boss.<id>.phase_<phase> — informatif) ;
// balance.mark.perAccordLevel (Requiem : sans lui, dégâts NaN) ; `special` requis par les comportements des ennemis.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let failed = 0;
function check(name, ok, detail = '') { results.push({ name, ok: !!ok, detail }); if (!ok) failed++; }

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
function rel(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }
function readJson(p) { return JSON.parse(readFileSync(p, 'utf8')); }
function flat(obj, prefix = '', out = {}) {
  for (const k of Object.keys(obj)) {
    const v = obj[k], key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out); else out[key] = v;
  }
  return out;
}

// ---- 1. JSON valides ----------------------------------------------------------------------------
const jsonFiles = [...walk(path.join(ROOT, 'src', 'data')), path.join(ROOT, 'assets', 'manifest.json'), path.join(ROOT, 'assets', 'audio', 'manifest.json')].filter((f) => f.endsWith('.json'));
const J = {};
for (const f of jsonFiles) {
  try { J[rel(f)] = readJson(f); check('JSON valide : ' + rel(f), true); }
  catch (e) { check('JSON valide : ' + rel(f), false, e.message); }
}
const D = (name) => J['src/data/' + name + '.json'];
const manifest = J['assets/manifest.json'] || { sprites: {}, tiles: {}, ui: {}, fonts: {} };
const audioManifest = J['assets/audio/manifest.json'] || { sfx: {}, samples: {}, tracks: {} };

// ---- 2. Registre des identifiants (§ 10 bis) --------------------------------------------------------
const REG = {
  characters: ['wren', 'osric', 'maren', 'le_muet'],
  weapons: ['battant', 'clarine', 'bourdon', 'grelots', 'tocsin', 'cor_de_brume', 'crecelle', 'chaine_d_angelus', 'diapason'],
  passives: ['ferrure', 'souffle', 'contrepoids', 'corde_de_chanvre', 'cire_d_abeille', 'metronome', 'etain', 'echo'],
  fusions: { glas: ['tocsin', 'contrepoids'], carillon: ['clarine', 'echo'], tonnerre: ['bourdon', 'etain'], requiem: ['diapason', 'metronome'],
    grande_volee: ['battant', 'corde_de_chanvre'], transhumance: ['grelots', 'souffle'], corne_de_guet: ['cor_de_brume', 'ferrure'],
    crecelle_du_vendredi: ['crecelle', 'etain'], angelus_de_veillee: ['chaine_d_angelus', 'cire_d_abeille'] },
  enemies: ['feutre', 'baillon', 'ouateux', 'fossoyeur', 'choeur_muet', 'rampe_suie', 'veuve_grise', 'cierge', 'contretemps', 'voleur_de_cran', 'desaccordeur'],
  bosses: ['bourdon_fele', 'veuve_suie', 'maitre'],
  parishes: ['cendrelune', 'tourbes', 'val_des_cordes', 'nef_noyee', 'beffroi_mere'],
  upgrades: ['coeur_de_bronze', 'semelles_de_cuir', 'ferrure_du_beffroi', 'oreille_fine', 'battant_lourd', 'aimant_d_echos', 'reliquaire', 'cire_de_veillee', 'main_sure', 'bourse_de_cuivre', 'second_souffle', 'contrepoids_de_fonte', 'corde_neuve', 'troisieme_carte'],
  achievements: ['premiere_aube', 'sonneur_confirme', 'cent_echos', 'mille_silences', 'plein_timbre', 'plein_accord', 'premiere_fusion', 'quatre_fusions', 'resonance_parfaite', 'sans_faute', 'fele_vaincu', 'veuve_vaincue', 'maitre_vaincu', 'toutes_paroisses', 'tous_sonneurs', 'feuillets_complets', 'sans_rythme_victoire', 'muet_victoire', 'tous_timbres', 'repondre_a_la_cloche'],
  relics: ['chapelet_de_cire', 'clef_du_beffroi', 'langue_de_cloche', 'suif_de_veillee', 'bronze_fele', 'oreille_du_maitre', 'bourse_percee', 'corde_usee', 'cierge_noir', 'voile_de_brume'],
  sfx: ['hit_light', 'hit_heavy', 'hit_crit', 'enemy_die', 'enemy_die_big', 'boss_hit', 'boss_roar', 'player_step', 'player_hurt', 'player_death', 'dash', 'parry_ok', 'parry_miss', 'resonance_1', 'resonance_2', 'resonance_3', 'resonance_4', 'resonance_drop', 'level_up', 'card_flip', 'card_pick', 'xp_pickup', 'xp_pickup_big', 'bell_minute', 'bell_tier', 'silence_cry', 'silence_burst', 'ui_move', 'ui_confirm', 'ui_cancel', 'weapon_battant', 'weapon_clarine', 'weapon_bourdon', 'weapon_grelots', 'weapon_tocsin', 'weapon_cor', 'weapon_crecelle', 'weapon_chaine', 'weapon_diapason', 'fusion', 'achievement', 'lore_unlock', 'victory_bell'],
  tracks: ['menu', 'hub', 'cendrelune', 'tourbes', 'val_des_cordes', 'nef_noyee', 'beffroi_mere', 'boss', 'victory', 'death'],
};
const ids = (arr) => new Set((arr || []).map((x) => x.id));
function checkIds(label, list, have) {
  const missing = list.filter((id) => !have.has(id));
  check(`identifiants ${label} (${list.length})`, missing.length === 0, missing.length ? 'manquants : ' + missing.join(', ') : '');
}
checkIds('sonneurs', REG.characters, ids(D('characters')));
checkIds('Timbres', REG.weapons, ids(D('weapons')));
checkIds('Accords', REG.passives, ids(D('passives')));
checkIds('fusions', Object.keys(REG.fusions), ids(D('fusions')));
for (const f of D('fusions') || []) {
  const exp = REG.fusions[f.id];
  if (exp) check(`fusion ${f.id} = ${exp[0]} + ${exp[1]}`, f.weapon === exp[0] && f.passive === exp[1], `${f.weapon} + ${f.passive}`);
}
checkIds('ennemis', REG.enemies, ids(D('enemies')));
checkIds('boss', REG.bosses, ids(D('enemies')));
checkIds('paroisses', REG.parishes, ids(D('parishes')));
checkIds('améliorations du Beffroi', REG.upgrades, ids(D('upgrades')));
checkIds('hauts-faits', REG.achievements, ids(D('achievements')));
{
  const ach = D('achievements') || [];
  const extra = ach.map((a) => a.id).filter((id) => !REG.achievements.includes(id));
  const dup = ach.map((a) => a.id).filter((id, i, arr) => arr.indexOf(id) !== i);
  check(`achievements.json : ≥ 19 hauts-faits réels (${ach.length}), ids uniques, chacun avec une condition`, ach.length >= 19 && dup.length === 0 && ach.every((a) => a.condition && a.condition.type), (dup.length ? 'doublons : ' + dup.join(', ') : '') + (extra.length ? ' hors registre § 10 bis (méta) : ' + extra.join(', ') : ''));
}
check('fusions.json : exactement 9 fusions, chaque Timbre fusionne une fois', (D('fusions') || []).length === 9 && new Set((D('fusions') || []).map((f) => f.weapon)).size === 9, '');
// Ennemis rythmiques (vague 1) : chaque comportement d'enemy-behaviors.js a ses paramètres `special`.
{
  const NEED = { contretemps: ['keepDistance', 'fireBeats', 'projSpeed', 'projRadius', 'projLife', 'openTint', 'openScale'], voleur: ['leapRange', 'leapSpeed', 'leapBeats', 'fleeDistance', 'fleeSpeedMult', 'carryTint'],
    desaccordeur: ['detuneRadius', 'detuneCents', 'fireBeats', 'fireRange', 'projSpeed', 'projRadius', 'projLife', 'wobble', 'wobbleHz'], leap: ['leapRange', 'leapSpeed', 'leapBeats', 'silenceSec'],
    ranged: ['keepDistance', 'fireBeats', 'projSpeed', 'projRadius', 'projLife'], explode: ['cloudRadius', 'cloudSec', 'blockSec', 'triggerRange'], crawl: ['trailRadius', 'trailSec', 'trailEvery', 'slow'],
    veuve_grise: ['teleportBeats', 'teleportDist', 'chargeSpeed', 'chargeSec', 'pauseSec'], summon: ['summonKind', 'summonCount', 'summonBeats', 'keepDistance'], chase: ['auraRadius'], swarm: ['wobble', 'wobbleHz'] };
  const bad = [];
  for (const e of D('enemies') || []) { const need = NEED[e.behavior]; if (!need) continue; for (const k of need) if (!e.special || e.special[k] === undefined) bad.push(e.id + '.' + k); }
  check('enemies.json : paramètres `special` requis par chaque comportement', bad.length === 0, bad.join(', '));
  const bal = (D('waves') || {}).balance || {};
  check('waves.json : balance.mark.perAccordLevel présent (Requiem sans `special` : sinon dégâts NaN, weapon-behaviors.js:334)', !!(bal.mark && typeof bal.mark.perAccordLevel === 'number'), '');
  check('waves.json : balance.player.parryCooldownBeats et pulseRadius (parade avec recharge, battement sur place)', !!(bal.player && bal.player.parryCooldownBeats >= 1 && bal.player.pulseRadius > 0), '');
  const W0 = D('waves') || {}; const parishesWithNew = Object.keys(W0).filter((k) => k !== 'balance' && (W0[k].spawns || []).some((s) => ['contretemps', 'voleur_de_cran', 'desaccordeur'].includes(s.kind)));
  check('waves.json : les nouveaux ennemis apparaissent dans les 5 paroisses', parishesWithNew.length === 5, parishesWithNew.join(', '));
}
checkIds('Reliques (§ 11 bis)', REG.relics, ids(D('relics')));
check('relics.json : ≥ 10 Reliques avec effets et revers', (D('relics') || []).length >= 10 && (D('relics') || []).every((r) => r.effects && r.drawbacks && r.icon), '');
checkIds('Feuillets', Array.from({ length: 24 }, (_, i) => 'f' + String(i + 1).padStart(2, '0')), ids(D('lore')));
checkIds('bruitages (§ 8)', REG.sfx, new Set(Object.keys(audioManifest.sfx || {})));
checkIds('pistes (§ 8)', REG.tracks, new Set(Object.keys(audioManifest.tracks || {})));
// Élites et boss référencés par les vagues.
const enemyIds = ids(D('enemies'));
const waves = D('waves') || {};
const badWave = [];
for (const pid of REG.parishes) {
  const w = waves[pid];
  if (!w) { badWave.push(pid + ' : bloc absent'); continue; }
  for (const s of w.spawns || []) if (!enemyIds.has(s.kind)) badWave.push(pid + ' spawn ' + s.kind);
  for (const e of w.events || []) if (!enemyIds.has(e.boss)) badWave.push(pid + ' event ' + e.boss);
}
check('vagues : ennemis/boss référencés existent', badWave.length === 0, badWave.join(', '));
// Rythme de la nuit : durées par paroisse, Fêlures à 40 % / 70 %, boss à 100 %, Moments scriptés (5 à 8 par
// paroisse, motifs du registre, toutes les 40–60 s ±8 s, 10–25 s chacun) et leurs clés i18n.
const NIGHT = { cendrelune: 240, tourbes: 270, val_des_cordes: 300, nef_noyee: 330, beffroi_mere: 360 };
const MOMENTS = ['cercle', 'nuee', 'meute', 'ligne', 'pluie_de_suie', 'procession', 'accalmie', 'cierge_errant', 'veuves_en_cercle'];
const badNight = [];
for (const pid of REG.parishes) {
  const w = waves[pid];
  if (!w) continue;
  const D = w.duration;
  if (D !== NIGHT[pid]) badNight.push(pid + ' durée ' + D + ' ≠ ' + NIGHT[pid]);
  if (!(w.tierEvery >= 35 && w.tierEvery <= 75)) badNight.push(pid + ' tierEvery ' + w.tierEvery);
  if (!w.difficulty || !(w.difficulty.hp >= 1) || !(w.difficulty.damage >= 1)) badNight.push(pid + ' difficulty absente');
  const fis = (w.events || []).filter((e) => e.type === 'fissure').map((e) => e.at), boss = (w.events || []).filter((e) => e.type === 'boss').map((e) => e.at);
  if (fis.length !== 2 || Math.abs(fis[0] - D * 0.4) > 1 || Math.abs(fis[1] - D * 0.7) > 1) badNight.push(pid + ' Fêlures ' + fis.join('/'));
  if (boss.length !== 1 || boss[0] !== D) badNight.push(pid + ' boss ' + boss.join('/'));
  for (const s of w.spawns || []) if (s.to > D) badNight.push(pid + ' spawn ' + s.kind + ' au-delà de la nuit');
  const kinds20 = new Set((w.spawns || []).filter((s) => s.from <= 20).map((s) => s.kind)), kinds45 = new Set((w.spawns || []).filter((s) => s.from <= 45).map((s) => s.kind)), kinds90 = new Set((w.spawns || []).filter((s) => s.from <= 90).map((s) => s.kind));
  if (kinds20.size < 2 || kinds45.size < 3 || kinds90.size < 4) badNight.push(pid + ' variété ' + kinds20.size + '/' + kinds45.size + '/' + kinds90.size + ' types à 20/45/90 s');
  const ms = w.moments || [];
  if (ms.length < 5 || ms.length > 8) badNight.push(pid + ' ' + ms.length + ' moments');
  let prev = 0;
  for (const m of ms) {
    if (!MOMENTS.includes(m.id)) badNight.push(pid + ' motif ' + m.id);
    if (!(m.sec >= 10 && m.sec <= 25)) badNight.push(pid + ' ' + m.id + ' durée ' + m.sec);
    if (m.kind && !enemyIds.has(m.kind)) badNight.push(pid + ' ' + m.id + ' ennemi ' + m.kind);
    if (prev && (m.at - prev < 25 - 8 || m.at - prev > 45 + 8)) badNight.push(pid + ' ' + m.id + '@' + m.at + ' écart ' + (m.at - prev));
    if (m.at + m.sec > D) badNight.push(pid + ' ' + m.id + ' déborde sur le boss');
    prev = m.at;
  }
}
check('rythme de la nuit : durées 240→360, Fêlures 40/70 %, boss 100 %, variété initiale, 5–8 Moments toutes les 25–45 s', badNight.length === 0, badNight.join(', '));
check('waves.json : bloc balance.moments et balance.bronze', !!(waves.balance && waves.balance.moments && waves.balance.moments.jitterSec >= 0 && waves.balance.bronze), '');
try {
  const src = readFileSync(path.join(ROOT, 'src', 'game', 'moments.js'), 'utf8');
  const missing = MOMENTS.filter((id) => !new RegExp('^\\s*' + id + ':\\s*\\{', 'm').test(src));
  check('game/moments.js : les 9 motifs du registre sont implémentés', missing.length === 0, missing.join(', '));
} catch (e) { check('game/moments.js présent', false, e.message); }
for (const c of D('lore') || []) if (c.unlock && c.unlock.type === 'run_minute') {
  const w = waves[c.unlock.parish];
  check(`Feuillet ${c.id} : minute ${c.unlock.minute} atteignable avant le boss de ${c.unlock.parish}`, !!w && c.unlock.minute * 60 < w.duration, w ? 'nuit de ' + w.duration + ' s' : 'paroisse inconnue');
}
check('waves.json : bloc balance', !!waves.balance && !!waves.balance.xp && !!waves.balance.spawn && !!waves.balance.resonance, '');
for (const p of D('parishes') || []) check(`paroisse ${p.id} : boss ${p.boss} existe`, enemyIds.has(p.boss));
for (const c of D('characters') || []) check(`sonneur ${c.id} : Timbre de départ ${c.startWeapon} existe`, ids(D('weapons')).has(c.startWeapon));
for (const u of D('upgrades') || []) for (const r of u.requires || []) check(`amélioration ${u.id} requiert ${r} (existe)`, ids(D('upgrades')).has(r));

// ---- 3. i18n --------------------------------------------------------------------------------------
const fr = Object.assign({}, flat(D('fr') || {}), flat(D('ui-fr') || {}));
const en = Object.assign({}, flat(D('en') || {}), flat(D('ui-en') || {}));
function sameKeys(label, a, b) {
  const ka = new Set(Object.keys(a)), kb = new Set(Object.keys(b));
  const onlyA = [...ka].filter((k) => !kb.has(k)), onlyB = [...kb].filter((k) => !ka.has(k));
  check(`${label} : mêmes clés`, onlyA.length === 0 && onlyB.length === 0, (onlyA.length ? 'fr seulement : ' + onlyA.slice(0, 8).join(', ') : '') + (onlyB.length ? ' en seulement : ' + onlyB.slice(0, 8).join(', ') : ''));
}
sameKeys('fr.json / en.json', flat(D('fr') || {}), flat(D('en') || {}));
sameKeys('ui-fr.json / ui-en.json', flat(D('ui-fr') || {}), flat(D('ui-en') || {}));
const KEY_RE = /^[a-z]+(\.[a-z0-9_]+)+$/;
const refKeys = new Set();
function collectKeys(o) {
  if (Array.isArray(o)) { for (const x of o) collectKeys(x); return; }
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'string' && ['name', 'desc', 'lore', 'title', 'text', 'trait', 'hint'].includes(k) && KEY_RE.test(v)) refKeys.add(v);
    else if (v && typeof v === 'object') collectKeys(v);
  }
}
for (const name of ['weapons', 'passives', 'fusions', 'enemies', 'parishes', 'characters', 'upgrades', 'achievements', 'lore', 'relics']) collectKeys(D(name));
// Clés dérivées par le code : parish.<id>.desc, char.<id>.trait, boss.<id>.name/lore.
for (const p of D('parishes') || []) refKeys.add('parish.' + p.id + '.desc');
for (const id of MOMENTS) { refKeys.add('moment.' + id + '.name'); refKeys.add('ui.moment.' + id); }
const missFr = [...refKeys].filter((k) => !(k in fr)), missEn = [...refKeys].filter((k) => !(k in en));
check(`clés i18n des JSON présentes dans fr (${refKeys.size})`, missFr.length === 0, missFr.slice(0, 10).join(', '));
check(`clés i18n des JSON présentes dans en (${refKeys.size})`, missEn.length === 0, missEn.slice(0, 10).join(', '));
// Appels t('…') littéraux dans le code.
const jsFiles = walk(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js'));
const tKeys = new Map();
for (const f of jsFiles) {
  const src = readFileSync(f, 'utf8');
  // Seuls les appels à clé littérale complète (t('a.b') ou t('a.b', …)) ; les préfixes concaténés sont ignorés.
  for (const m of src.matchAll(/\bt\(\s*'([a-z][a-z0-9_.]*[a-z0-9])'\s*[,)]/g)) if (!tKeys.has(m[1])) tKeys.set(m[1], rel(f));
}
const missT = [...tKeys.keys()].filter((k) => !(k in fr) || !(k in en));
check(`clés t('…') du code présentes dans fr et en (${tKeys.size})`, missT.length === 0, missT.slice(0, 10).map((k) => k + ' (' + tKeys.get(k) + ')').join(', '));
// Nouveaux contenus (vague 1) : fusions (name/desc/hint), ennemis rythmiques, Reliques, Moments, phases de boss.
{
  const want = [];
  for (const f of D('fusions') || []) want.push('fusion.' + f.id + '.name', 'fusion.' + f.id + '.desc', 'fusion.' + f.id + '.hint');
  for (const id of ['contretemps', 'voleur_de_cran', 'desaccordeur']) want.push('enemy.' + id + '.name', 'enemy.' + id + '.lore');
  for (const r of D('relics') || []) want.push('relic.' + r.id + '.name', 'relic.' + r.id + '.desc');
  for (const id of MOMENTS) want.push('moment.' + id + '.name');
  const miss = want.filter((k) => !(k in fr) || !(k in en));
  check(`clés i18n des nouveaux contenus (fusions name/desc/hint, ennemis rythmiques, Reliques, Moments : ${want.length})`, miss.length === 0, miss.slice(0, 10).join(', '));
  // Phases de boss : boss.js émet boss:phase {phase} ; hud-banners lit boss.<id>.phase_<phase> si la clé existe (repli générique sinon).
  let bossSrc = '';
  try { bossSrc = readFileSync(path.join(ROOT, 'src', 'game', 'boss.js'), 'utf8'); } catch (e) { /* absent */ }
  const phases = new Set([...bossSrc.matchAll(/emitPhase\(e\.kind, '([a-z]+)'/g)].map((m) => m[1]));
  const PHASE_BOSS = { cri: ['bourdon_fele'], double: ['bourdon_fele'], envers: ['bourdon_fele'], enfants: ['veuve_suie'], deuil: ['veuve_suie'], coda: ['maitre'], annonce: ['maitre'], expose: ['maitre'], enrage: ['maitre'] };
  const missP = [];
  for (const ph of phases) for (const b of PHASE_BOSS[ph] || []) { const k = 'boss.' + b + '.phase_' + ph; if (!(k in fr) || !(k in en)) missP.push(k); }
  check(`phases de boss nommées (boss.<id>.phase_<phase>, ${phases.size} phases émises par boss.js) — informatif : repli ui.hud.boss_phase sinon`, true, missP.length ? 'sans nom : ' + missP.join(', ') : 'toutes nommées');
}

// ---- 4. Assets référencés ---------------------------------------------------------------------------
const sprites = new Set(Object.keys(manifest.sprites || {})), tiles = new Set(Object.keys(manifest.tiles || {}));
const iconMap = new Set(Object.keys((manifest.ui && manifest.ui.icons && manifest.ui.icons.map) || {}));
const sfxIds = new Set(Object.keys(audioManifest.sfx || {})), trackIds = new Set(Object.keys(audioManifest.tracks || {}));
const badSprite = [], badIcon = [], badSfx = [], badTrack = [], badTile = [];
for (const e of D('enemies') || []) if (!sprites.has(e.sprite)) badSprite.push(e.id + '→' + e.sprite);
for (const c of D('characters') || []) if (!sprites.has(c.sprite)) badSprite.push(c.id + '→' + c.sprite);
for (const w of [...(D('weapons') || []), ...(D('fusions') || [])]) {
  if (w.projectileSprite && !sprites.has(w.projectileSprite)) badSprite.push(w.id + '→' + w.projectileSprite);
  if (!iconMap.has(w.icon)) badIcon.push(w.id + '→' + w.icon);
  if (!sfxIds.has(w.sfx)) badSfx.push(w.id + '→' + w.sfx);
}
for (const p of [...(D('passives') || []), ...(D('relics') || [])]) if (!iconMap.has(p.icon)) badIcon.push(p.id + '→' + p.icon);
for (const p of D('parishes') || []) {
  if (!tiles.has(p.tileset)) badTile.push(p.id + '→' + p.tileset);
  if (!trackIds.has(p.track)) badTrack.push(p.id + '→' + p.track);
  for (const s of [...(p.props || []), ...(p.lights || [])]) if (!sprites.has(s)) badSprite.push(p.id + '→' + s);
}
// Sprites, icônes, bruitages et presets nommés en dur dans le code.
const codeSprites = new Set(), codeIcons = new Set(), codeSfx = new Set(), codePresets = new Set();
for (const f of jsFiles) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:playSfx|playUi|sfx\.play|play)\(\s*'([a-z_0-9]+)'/g)) codeSfx.add(m[1]);
  for (const m of src.matchAll(/emitParticles\(\s*'([a-z_0-9]+)'/g)) codePresets.add(m[1]);
  for (const m of src.matchAll(/(?:drawIcon\(ctx, 'icons',|icon\(ui,)\s*'([a-z_0-9]+)'/g)) codeIcons.add(m[1]);
  for (const m of src.matchAll(/SPRITE\s*=\s*'([a-z_0-9]+)'|sprite\s*=\s*'([a-z_0-9]+)'|SPEC\.sprite\s*=\s*'([a-z_0-9]+)'/g)) codeSprites.add(m[1] || m[2] || m[3]);
}
for (const s of codeSprites) if (s && !sprites.has(s)) badSprite.push('code→' + s);
for (const s of codeIcons) if (!iconMap.has(s)) badIcon.push('code→' + s);
for (const s of codeSfx) if (!sfxIds.has(s) && !/^ambience_/.test(s) && !trackIds.has(s)) badSfx.push('code→' + s);
let presets = new Set();
try { const pj = readFileSync(path.join(ROOT, 'src', 'render', 'particles.js'), 'utf8'); const m = pj.match(/const PRESETS\s*=\s*\{([\s\S]*?)\n\};/); if (m) for (const k of m[1].matchAll(/^\s*([a-z_0-9]+)\s*:/gm)) presets.add(k[1]); } catch (e) { /* absent */ }
const badPreset = presets.size ? [...codePresets].filter((p) => !presets.has(p)) : [];
check('sprites référencés existent dans assets/manifest.json', badSprite.length === 0, badSprite.join(', '));
check('tilesets des paroisses existent', badTile.length === 0, badTile.join(', '));
check('icônes référencées existent (ui.icons.map)', badIcon.length === 0, badIcon.join(', '));
check('bruitages référencés existent (audio/manifest.json)', badSfx.length === 0, badSfx.join(', '));
check('pistes des paroisses existent', badTrack.length === 0, badTrack.join(', '));
check(`presets de particules utilisés existent (${codePresets.size})`, badPreset.length === 0, badPreset.join(', '));
// Fichiers des manifestes présents sur le disque.
const missingFiles = [];
function fileOk(p) { return existsSync(path.join(ROOT, 'assets', p)) || existsSync(path.join(ROOT, p)); }
for (const g of ['sprites', 'tiles', 'ui', 'fonts']) for (const [id, d] of Object.entries(manifest[g] || {})) if (d.file && !fileOk(d.file)) missingFiles.push(g + '/' + id + '→' + d.file);
for (const [id, d] of Object.entries(audioManifest.sfx || {})) for (const f of d.files || []) if (!fileOk(f)) missingFiles.push('sfx/' + id + '→' + f);
for (const [id, d] of Object.entries(audioManifest.samples || {})) for (const v of Object.values(d.files || {})) for (const f of Array.isArray(v) ? v : [v]) if (!fileOk(f)) missingFiles.push('samples/' + id + '→' + f);
for (const [id, d] of Object.entries(audioManifest.tracks || {})) { if (d.file && !fileOk(d.file)) missingFiles.push('track/' + id + '→' + d.file); if (d.score && !fileOk(d.score)) missingFiles.push('track/' + id + '→' + d.score); }
check(`fichiers des manifestes présents sur le disque`, missingFiles.length === 0, missingFiles.slice(0, 10).join(', '));

// ---- 5. Règles de code ---------------------------------------------------------------------------------
const tooLong = jsFiles.filter((f) => readFileSync(f, 'utf8').split('\n').length > 400).map((f) => rel(f) + ' (' + readFileSync(f, 'utf8').split('\n').length + ')');
check('aucun src/**/*.js > 400 lignes', tooLong.length === 0, tooLong.join(', '));
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\'"`])\/\/.*$/gm, (m, p) => p);
}
const rnd = [], osc = [], dlg = [], hard = [];
const ACCENT = /[àâäéèêëîïôöùûüçœÀÂÄÉÈÊËÎÏÔÖÙÛÜÇŒ]/;
for (const f of jsFiles) {
  const r = rel(f), raw = readFileSync(f, 'utf8'), src = stripComments(raw), lines = src.split('\n');
  if (!r.startsWith('src/audio/')) lines.forEach((l, i) => { if (/\bMath\.random\b/.test(l)) rnd.push(r + ':' + (i + 1)); });
  lines.forEach((l, i) => { if (/OscillatorNode|createOscillator/.test(l)) osc.push(r + ':' + (i + 1)); });
  const local = /function\s+(alert|prompt|confirm)\s*\(|(?:const|let|var)\s+(alert|prompt|confirm)\b/.test(src);
  lines.forEach((l, i) => {
    if (/\bwindow\.(alert|prompt|confirm)\s*\(/.test(l)) dlg.push(r + ':' + (i + 1));
    else if (!local && /(^|[^.\w])(alert|prompt|confirm)\s*\(/.test(l)) dlg.push(r + ':' + (i + 1));
  });
  if (r.startsWith('src/ui/') || r === 'src/main.js') {
    if (r.includes('/_test/')) continue;
    lines.forEach((l, i) => {
      if (/console\./.test(l)) return;
      for (const m of l.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
        const s = m[1] ?? m[2] ?? m[3];
        if (ACCENT.test(s)) { hard.push(r + ':' + (i + 1) + ' ' + JSON.stringify(s.slice(0, 40))); break; }
      }
    });
  }
}
check('aucun Math.random hors src/audio', rnd.length === 0, rnd.join(', '));
// § 8 bis : ducking seulement sur enemy:hit {crit} et weapon:fusion (jamais par tir) ; bell_minute seulement dans bell-hour.js.
{
  const duckCalls = [], fireDuck = [], bellMinute = [];
  for (const f of jsFiles) {
    const r = rel(f), src = stripComments(readFileSync(f, 'utf8')), lines = src.split('\n');
    lines.forEach((l, i) => {
      if (/\bduck(Now)?\s*\(/.test(l) && !/function\s+duck(Now)?\s*\(/.test(l) && r !== 'src/audio/audio.js') duckCalls.push(r + ':' + (i + 1));
      if (/'bell_minute'/.test(l) && r !== 'src/game/bell-hour.js') bellMinute.push(r + ':' + (i + 1));
    });
    if (r.startsWith('src/audio/')) for (const m of src.matchAll(/bus\.on\(\s*'weapon:fire'[^\n]*\n?[^\n]*/g)) if (/duck/.test(m[0])) fireDuck.push(r);
  }
  check("aucun duck() par tir : duck/duckNow appelés seulement dans src/audio/audio.js, jamais sur weapon:fire", duckCalls.length === 0 && fireDuck.length === 0, [...duckCalls, ...fireDuck].join(', '));
  check("bell_minute joué seulement par src/game/bell-hour.js", bellMinute.length === 0, bellMinute.join(', '));
}
check('aucun OscillatorNode', osc.length === 0, osc.join(', '));
check('aucun alert/prompt/confirm', dlg.length === 0, dlg.join(', '));
check('aucune chaîne française en dur dans src/ui et src/main.js', hard.length === 0, hard.slice(0, 12).join(' ; '));

// ---- Sortie -----------------------------------------------------------------------------------------------
if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: failed === 0, failed, results }, null, 1));
else {
  for (const r of results) console.log((r.ok ? '[OK] ' : '[KO] ') + r.name + (r.detail ? ' — ' + r.detail : ''));
  console.log(`\n${results.length - failed}/${results.length} contrôles passés${failed ? ', ' + failed + ' KO' : ''}.`);
}
process.exit(failed ? 1 : 0);
