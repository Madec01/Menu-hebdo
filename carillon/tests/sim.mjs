#!/usr/bin/env node
// tests/sim.mjs — simulation déterministe d'une run complète de CARILLON sous Node (sans navigateur).
// Les modules navigateur (input, audio, conducteur, sfx, atlas, lumière, particules, fx) sont remplacés par
// tests/stubs/* via un hook de résolution ; tout src/game/** et core/{events,pool,grid,rng,save} est réel.
// Un « joueur robot » pilote le sonneur : il fuit vers la zone la moins dense, se tourne vers l'ennemi le
// plus proche au tick où une arme directionnelle tire, presse Volée/Contre-battement sur les temps avec un
// taux de réussite paramétrable (profil), répond à la cloche horaire sur le 4ᵉ coup, prend la première
// Relique proposée (--relic) et choisit les cartes selon une stratégie.
// § 8 bis : la parade a une recharge (p.parryCdT) et ne charge la Résonance que si elle pare : le robot ne
// pare que si c'est « utile » (contact imminent ou projectile de Silence qui arrive), sinon il bat sur place
// (Volée sans direction) quand une menace est à portée, ou dash s'il fuit. Profil `parade_seule` : parade sur
// chaque temps quoi qu'il arrive, jamais de Volée (diagnostic : ne doit pas dépasser le cran 1 en moyenne).
//
//   node tests/sim.mjs                                  # une run : Wren, parfait, seed 1, Cendrelune
//   node tests/sim.mjs --char le_muet --profile moyen --seed 3 --parish tourbes
//   node tests/sim.mjs --matrix                         # 5 seeds × 3 profils × 2 sonneurs (4 processus)
//   node tests/sim.mjs --matrix --chars wren,osric,maren,le_muet --profiles parfait,moyen,norhythm,passif
//   node tests/sim.mjs --data /chemin/vers/data          # autre jeu de JSON (comparaison avant/après)
//   node tests/sim.mjs --json                           # sortie JSON brute (une ligne)
//   node tests/sim.mjs --relic none|first|<id>          # Relique de paroisse (défaut : la première proposée)
// Options : --seeds N, --cards honnete|premiere|fusion, --upgrades coeur_de_bronze:3,battant_lourd:2,
//           --secondWeapon <id> (variante : arme supplémentaire au départ), --inputEvery 1 (frappe à chaque temps),
//           --minutes 13 (défaut : durée de la
//           paroisse waves.json + 2 min 30 pour le boss), --jobs 4. Les Moments scriptés (run:moment) sont traversés
//           et listés (id@seconde) ; le bilan agrégé lit la durée de la nuit (niv@fin = niveau à `duration`).

import { register } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import './stubs/globals.mjs';

register('./stubs/hooks.mjs', import.meta.url);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DT = 1 / 60;
const PROFILES = {
  // Probabilités de grade par frappe ; faceRate = part des tirs directionnels où le robot se tourne vers
  // l'ennemi ; emergency = dash hors temps quand un ennemi touche et PV bas ; inputEvery = temps entre 2
  // frappes (1 = à chaque temps, comme un joueur qui tient la Mesure ; 0 = seulement des Volées d'urgence) ;
  // fleeThreat = menace cumulée (Σ (dégâts+4)/d²) qui fait
  // passer en fuite ; fleeHp = fraction de PV sous laquelle le robot devient prudent.
  parfait: { parfait: 1, bon: 0, rate: 0, faceRate: 1, emergency: false, inputEvery: 1, assist: 'none', cards: 'honnete', fleeThreat: 0.12, fleeHp: 0.35 },
  // moyen : un joueur qui tombe presque toujours dans la fenêtre (Wren ±143 ms) mais rarement dans le Parfait ;
  // faible : l'ancien « moyen » (40 % de ratés), gardé comme référence basse.
  moyen: { parfait: 0.2, bon: 0.55, rate: 0.25, faceRate: 0.6, emergency: true, inputEvery: 1, assist: 'none', cards: 'honnete', fleeThreat: 0.1, fleeHp: 0.35 },
  faible: { parfait: 0.1, bon: 0.5, rate: 0.4, faceRate: 0.6, emergency: true, inputEvery: 1, assist: 'none', cards: 'honnete', fleeThreat: 0.1, fleeHp: 0.35 },
  norhythm: { parfait: 0, bon: 0, rate: 1, faceRate: 0.6, emergency: true, inputEvery: 0, assist: 'norhythm', cards: 'honnete', fleeThreat: 0.1, fleeHp: 0.35 },
  passif: { parfait: 0, bon: 0.2, rate: 0.8, faceRate: 0.35, emergency: false, inputEvery: 8, assist: 'none', cards: 'premiere', fleeThreat: 0.2, fleeHp: 0.2 },
  // Diagnostic : le style « Volée sur chaque temps » observé par le lead (dash permanent, jamais de parade).
  lead: { parfait: 1, bon: 0, rate: 0, faceRate: 1, emergency: false, inputEvery: 1, dashAlways: true, assist: 'none', cards: 'honnete', fleeThreat: 0.1, fleeHp: 0.35 },
  // Diagnostic : la stratégie dominante de l'audit — se déplacer comme « parfait » mais presser la parade sur
  // CHAQUE temps, jamais de Volée (parryAlways). Avec la recharge et le gain conditionnel, elle ne doit pas
  // dépasser le cran 1 en moyenne.
  parade_seule: { parfait: 1, bon: 0, rate: 0, faceRate: 1, emergency: false, inputEvery: 1, parryAlways: true, assist: 'none', cards: 'honnete', fleeThreat: 0.12, fleeHp: 0.35 },
};
const WEAPON_PREF = ['bourdon', 'grelots', 'clarine', 'tocsin', 'chaine_d_angelus', 'cor_de_brume', 'crecelle', 'battant', 'diapason'];
const PASSIVE_PREF = ['ferrure', 'contrepoids', 'cire_d_abeille', 'corde_de_chanvre', 'souffle', 'etain', 'echo', 'metronome'];

function parseArgs(argv) {
  const o = { seed: 1, seeds: 5, char: 'wren', profile: 'parfait', parish: 'cendrelune', cards: null, data: null, upgrades: '', secondWeapon: null, trace: null,
    minutes: 0, json: false, matrix: false, chars: 'wren,le_muet', profiles: 'parfait,moyen,norhythm', jobs: 4, quiet: false, weapons: 4, relic: 'first', inputEvery: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    if (k === 'json' || k === 'matrix' || k === 'quiet') { o[k] = true; continue; }
    o[k] = argv[++i];
  }
  for (const k of ['seed', 'seeds', 'minutes', 'jobs', 'weapons', 'inputEvery']) o[k] = +o[k] || 0;
  return o;
}

function loadData(dir) {
  const out = {};
  for (const f of readdirSync(dir)) if (f.endsWith('.json')) out[f.slice(0, -5)] = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
  return out;
}

// ---- Robot ------------------------------------------------------------------------------------------
function makeRobot(profile, opts, mods, rng) {
  const { input, audio, conductor } = mods;
  const R = {
    dirX: 0, dirY: 0, lastBeat: -1, grades: { parfait: 0, bon: 0, rate: 0 }, dashes: 0, parries: 0, pulses: 0,
    lastFire: -1, facing: false, flee: false, hpHist: new Array(180), hpIdx: 0,
  };
  function grade() {
    const r = rng.next();
    return r < profile.parfait ? 'parfait' : r < profile.parfait + profile.bon ? 'bon' : 'rate';
  }
  // Offset (s) correspondant au grade voulu, d'après la fenêtre courante du conducteur.
  function offsetFor(g) {
    const w = conductor.windowMs() / 1000, s = rng.next() < 0.5 ? -1 : 1;
    if (g === 'parfait') return s * rng.range(0, w / 3 * 0.9);
    if (g === 'bon') return s * rng.range(w / 3 * 1.05, w * 0.95);
    return s * rng.range(w * 1.3, Math.min(w * 2.5, 0.28));
  }
  function press(action, beatT) {
    const g = grade();
    R.grades[g]++;
    input.__press(action, beatT + offsetFor(g));
    if (action === 'dash') R.dashes++; else R.parries++;   // (les battements sur place sont comptés à part dans R.pulses, inclus dans dashes)
  }
  const DIRS = 16;
  return {
    R,
    think(g) {
      const p = g.player, world = g.world;
      if (p.dead) { input.__setAxis(0, 0); return; }
      // 0. Portée d'engagement : la plus grande portée des armes de contact (arc, cône, aura, onde, orbite).
      let engage = 0, hasMelee = false;
      for (let i = 0; i < p.weapons.length; i++) {
        const w = p.weapons[i], b = w.def.behavior;
        if (b === 'arc' || b === 'cone' || b === 'aura' || b === 'shockwave' || b === 'orbit' || b === 'aura_screen' || b === 'shockwave_chain' || b === 'orbit_bounce') {
          hasMelee = true; engage = Math.max(engage, w.stats.range * (b === 'aura_screen' ? 1 : w.stats.area));
        }
      }
      if (!hasMelee) engage = 120;
      // 1. Menaces : répulsion 1/d² pondérée par les dégâts (ennemis, projectiles de Silence, zones).
      let sx = 0, sy = 0, nearest = null, nd = 1e9, boss = null, threat = 0, nearTouch = false, parryContact = false;
      const items = world.enemies.items;
      for (let i = 0; i < items.length; i++) {
        const e = items[i];
        if (e.state !== 'alive') continue;
        const dx = e.x - p.x, dy = e.y - p.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1;
        if (e.boss) boss = e;
        if (d < nd) { nd = d; nearest = e; }
        if (d > 260) continue;
        const w = (e.damage + 4) / (d2 + 400) * (e.boss ? 4 : e.elite ? 2 : 1);
        sx -= dx / d * w; sy -= dy / d * w; threat += w;
        if (d < e.r + p.r + 10) nearTouch = true;
        if (d < e.r + p.r + 22) parryContact = true;   // contact imminent (0,2 s de parade) : parade utile
      }
      let px = 0, py = 0, projThreat = 0, parryUseful = false;
      const B = mods.data.balance().player;
      const projs = world.projectiles.items;
      for (let i = 0; i < projs.length; i++) {
        const o = projs[i];
        if (o.owner !== 'enemy' || !o.collides || o.dead) continue;
        // Parade utile : le projectile passera à portée de parade (parryRadius) pendant la fenêtre (0,2 s).
        for (let k = 1; k <= 2 && !parryUseful; k++) {
          const ex = o.x + o.vx * 0.1 * k - p.x, ey = o.y + o.vy * 0.1 * k - (p.y - 8);
          if (ex * ex + ey * ey <= (B.parryRadius + o.r) * (B.parryRadius + o.r)) parryUseful = true;
        }
        const fx = o.x + o.vx * 0.5, fy = o.y + o.vy * 0.5; // position dans 0,5 s
        const dx = fx - p.x, dy = fy - p.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1;
        if (d > 120) continue;
        const w = 40 / (d2 + 200);
        px -= dx / d * w; py -= dy / d * w; projThreat += w;
      }
      if (nearTouch || parryContact) parryUseful = true;   // un ennemi au contact : la parade annule le coup et le repousse
      // Bâillon en plein bond (aiState 1) vers le sonneur : la parade est la réponse enseignée par le jeu.
      if (!parryUseful) for (let i = 0; i < items.length; i++) {
        const e = items[i];
        if (e.state !== 'alive' || e.def.behavior !== 'leap' || e.aiState !== 1) continue;
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < 110 * 110) { parryUseful = true; break; }
      }
      const threatNear = nd < mods.data.balance().resonance.threatRadius || projThreat > 0;
      const hz = world.hazards.items;
      for (let i = 0; i < hz.length; i++) {
        const h = hz[i];
        const dx = h.x - p.x, dy = h.y - p.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1;
        if (d > h.r + 40) continue;
        const w = 30 / (d2 + 200);
        px -= dx / d * w; py -= dy / d * w;
      }
      // 2. Échos proches : attraction.
      const pk = world.pickups.items;
      let ax = 0, ay = 0;
      for (let i = 0; i < pk.length; i++) {
        const o = pk[i];
        const dx = o.x - p.x, dy = o.y - p.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1;
        if (d > 220) continue;
        const w = (o.kind === 'xp' ? 2 + o.value : 12) / (d2 + 900);
        ax += dx / d * w; ay += dy / d * w;
      }
      // 3. Mode : fuite si la menace cumulée est forte ou les PV bas ; sinon engagement à portée.
      const lowHp = p.hp < p.maxHp * profile.fleeHp;
      // Pendant le combat de boss, la cible d'engagement est le boss (sa menace propre ne fait pas fuir).
      const bossFight = boss && boss.aiState >= 0;
      if (bossFight) { const d = Math.hypot(boss.x - p.x, boss.y - p.y) || 1; threat -= (boss.damage + 4) / (d * d + 400) * 3; }
      // PV perdus sur les 3 dernières secondes (fenêtre glissante) : on recule quand on PREND des dégâts,
      // pas quand la foule approche — comme un humain qui tient sa zone d'aura tant que ça va.
      R.hpHist[R.hpIdx] = p.hp; R.hpIdx = (R.hpIdx + 1) % R.hpHist.length;
      const hp3s = R.hpHist[R.hpIdx] === undefined ? p.hp : R.hpHist[R.hpIdx];
      const hurting = hp3s - p.hp > p.maxHp * 0.12;
      const th = profile.fleeThreat * (R.flee ? 0.6 : 1); // hystérésis : on cesse de fuir sous 60 % du seuil
      const flee = (threat > th && hurting) || threat > th * 2.5 || (lowHp && threat > th * 0.4) || projThreat > (bossFight ? 0.15 : 0.05);
      R.flee = flee; R.threat = threat; R.projThreat = projThreat; R.bossD = bossFight ? Math.hypot(boss.x - p.x, boss.y - p.y) : -1;
      let mx = 0, my = 0;
      if (flee) { mx = sx * 4 + px * 4 + ax * 0.3; my = sy * 4 + py * 4 + ay * 0.3; }
      else {
        const xpW = bossFight ? 0.1 : 1, pw = bossFight ? 1.5 : 4; // boss : on esquive localement, on n'abandonne pas l'approche
        mx = px * pw + ax * xpW; my = py * pw + ay * xpW;
        const target = bossFight ? boss : nearest;
        if (target) {
          const td = Math.hypot(target.x - p.x, target.y - p.y) || 1;
          const ux = (target.x - p.x) / td, uy = (target.y - p.y) / td;
          const contact = target.r + p.r + 6;
          const reach = engage + (bossFight ? target.r : 0);
          const approach = bossFight ? 0.15 : 0.02;
          if (td > reach * 0.85) { mx += ux * approach; my += uy * approach; }    // approcher
          else if (td < contact) { mx -= ux * 0.03; my -= uy * 0.03; }               // reculer d'un pas
          else if (!hasMelee || td < reach * 0.5) { mx -= ux * 0.005; my -= uy * 0.005; } // rester à distance
        }
      }
      let len = Math.hypot(mx, my);
      if (len < 0.003) { mx = 0; my = 0; len = 0; }
      // Encerclement (résultante nulle mais forte menace) : direction la moins dense sur 16 secteurs.
      if (flee && len < 0.004) {
        let best = 0, bestScore = 1e9;
        for (let k = 0; k < DIRS; k++) {
          const a = (k / DIRS) * Math.PI * 2, cx = Math.cos(a), cy = Math.sin(a);
          let score = 0;
          for (let i = 0; i < items.length; i++) {
            const e = items[i]; if (e.state !== 'alive') continue;
            const dx = e.x - p.x, dy = e.y - p.y, d2 = dx * dx + dy * dy; if (d2 > 200 * 200) continue;
            const d = Math.sqrt(d2) || 1, c = (dx * cx + dy * cy) / d;
            if (c > 0.3) score += c / (d2 + 100);
          }
          if (score < bestScore) { bestScore = score; best = k; }
        }
        mx = Math.cos((best / DIRS) * Math.PI * 2); my = Math.sin((best / DIRS) * Math.PI * 2); len = 1;
      }
      if (len > 0) { R.dirX = mx / len; R.dirY = my / len; }
      let axisX = len > 0 ? R.dirX : 0, axisY = len > 0 ? R.dirY : 0;

      // 4. Tick de tir d'une arme directionnelle : se tourner vers la cible (boss prioritaire).
      const t = audio.now();
      let firing = false;
      for (let i = 0; i < p.weapons.length; i++) {
        const w = p.weapons[i];
        const b = w.def.behavior;
        if (b !== 'arc' && b !== 'cone' && b !== 'burst') continue;
        if (w.queueHead !== w.queueTail && w.queueAt[w.queueHead] <= t + 0.004) { firing = true; break; }
      }
      let faceTarget = null;
      if (firing) {
        const tgt = boss && Math.hypot(boss.x - p.x, boss.y - p.y) < 140 ? boss : nearest;
        if (tgt && Math.hypot(tgt.x - p.x, tgt.y - p.y) < 140 && rng.next() < profile.faceRate) faceTarget = tgt;
      }

      // 5. Frappes rythmiques sur les temps : Volée (dash) si l'on fuit, Contre-battement s'il est utile ET
      //    rechargé (p.parryCdT), sinon battement sur place (Volée sans direction) si une menace est à portée.
      const beat = Math.floor((t - conductor.startAt()) / conductor.beatDuration());
      let dashNow = false, pulseNow = false;
      const fleeDx = sx + px, fleeDy = sy + py, fleeLen = Math.hypot(fleeDx, fleeDy);
      const parryOk = p.parryT <= 0 && p.parryCdT <= 0;
      if (beat !== R.lastBeat) {
        R.lastBeat = beat;
        const beatT = conductor.beatTime(beat);
        const bell = g.bell;
        const bellNext = bell && bell.ringing && beat === bell.fourthBeat - 1;   // garder la parade pour le 4ᵉ coup
        // Cloche horaire (§ 11 bis) : Contre-battement sur le 4ᵉ coup, avec le grade du profil.
        if (bell && bell.ringing && beat === bell.fourthBeat && profile.inputEvery > 0 && parryOk) press('parry', beatT);
        else if (profile.parryAlways) { if (parryOk) press('parry', beatT); }
        else if (profile.inputEvery > 0 && beat % profile.inputEvery === 0 && beat > 0) {
          if (profile.dashAlways && p.dashT <= 0) { press('dash', beatT); dashNow = true; R.dashDir = len > 0 ? 1 : 0; }
          else if ((flee || nearTouch) && !parryUseful && p.dashT <= 0 && fleeLen > 0) { press('dash', beatT); dashNow = true; }
          else if (parryUseful && parryOk && !bellNext) press('parry', beatT);
          else if (threatNear && p.dashT <= 0) { press('dash', beatT); pulseNow = true; R.pulses++; }
        } else if (profile.inputEvery === 0 && (flee || nearTouch) && p.dashT <= 0 && fleeLen > 0) {
          input.__press('dash', beatT); R.dashes++; dashNow = true;
        }
      }
      if (profile.still) { input.__setAxis(0, 0); return; }
      if (!dashNow && profile.emergency && nearTouch && p.dashT <= 0 && p.iframesT <= 0 && fleeLen > 0 && lowHp) {
        input.__press('dash', t); R.dashes++; dashNow = true;
      }
      if (pulseNow) { axisX = 0; axisY = 0; }   // battement sur place : aucune direction ce tick
      else if (dashNow) {
        if (profile.dashAlways && !(flee || nearTouch)) { if (len === 0 && nearest) { axisX = (nearest.x - p.x) / nd; axisY = (nearest.y - p.y) / nd; } }
        else { axisX = fleeDx / fleeLen; axisY = fleeDy / fleeLen; }
      }
      else if (faceTarget) { const d = Math.hypot(faceTarget.x - p.x, faceTarget.y - p.y) || 1; axisX = (faceTarget.x - p.x) / d; axisY = (faceTarget.y - p.y) / d; }
      input.__setAxis(axisX, axisY);
    },
    // Stratégie de cartes.
    choose(choices, p, strategy, wantWeapons) {
      if (strategy === 'premiere') return choices[0];
      const fus = choices.find((c) => c.type === 'fusion');
      if (fus) return fus;
      const PAIRS = { tocsin: 'contrepoids', clarine: 'echo', bourdon: 'etain', diapason: 'metronome' };
      if (strategy === 'fusion') {
        // Vise une fusion : prend la première arme fusionnable offerte, puis monte ce couple en priorité.
        const fw = p.weapons.find((w) => PAIRS[w.id] && w.id !== 'diapason');
        if (!fw) { const c = choices.find((x) => x.type === 'weapon' && x.isNew && PAIRS[x.id] && x.id !== 'diapason'); if (c) return c; }
        else {
          const cw = choices.find((x) => x.type === 'weapon' && x.id === fw.id);
          const cp = choices.find((x) => x.type === 'passive' && x.id === PAIRS[fw.id]);
          if (cw) return cw; if (cp) return cp;
        }
      }
      const hasDamage = p.weapons.some((w) => w.def.base.damage > 0 || w.def.behavior === 'mark_execute');
      const newW = choices.filter((c) => c.type === 'weapon' && c.isNew && c.id !== 'diapason');
      const upW = choices.filter((c) => c.type === 'weapon' && !c.isNew);
      const pas = choices.filter((c) => c.type === 'passive');
      const byPref = (arr, pref) => arr.slice().sort((a, b) => pref.indexOf(a.id) - pref.indexOf(b.id))[0];
      if (!hasDamage && newW.length) return byPref(newW, WEAPON_PREF);
      if (p.weapons.length < wantWeapons && newW.length && p.weapons.length <= 1) return byPref(newW, WEAPON_PREF);
      // Monter l'arme la plus basse (croissance homogène), sinon nouvelle arme, sinon Accord préféré.
      if (upW.length && (rng.next() < 0.65 || !newW.length || p.weapons.length >= wantWeapons)) return upW.slice().sort((a, b) => a.level - b.level)[0];
      if (newW.length && p.weapons.length < wantWeapons) return byPref(newW, WEAPON_PREF);
      if (pas.length) {
        // Accord apparié (fusion) à l'arme possédée la plus haute, sinon préférence générale.
        const owned = p.weapons.slice().sort((a, b) => b.level - a.level);
        for (const w of owned) { const c = pas.find((x) => x.id === PAIRS[w.id]); if (c) return c; }
        return byPref(pas, PASSIVE_PREF);
      }
      if (upW.length) return upW[0];
      return choices[0];
    },
  };
}

// ---- Une run --------------------------------------------------------------------------------------------
export async function runOne(o) {
  const dataDir = o.data ? path.resolve(o.data) : path.join(ROOT, 'src', 'data');
  const mods = {
    input: await import('../src/core/input.js'), audio: await import('../src/audio/audio.js'),
    conductor: await import('../src/audio/conductor.js'), camera: await import('../src/render/camera.js'),
    data: await import('../src/game/data.js'), game: await import('../src/game/game.js'),
    weapons: await import('../src/game/weapons.js'), resonance: await import('../src/game/resonance.js'),
    rngMod: await import('../src/core/rng.js'), bus: (await import('../src/core/events.js')).bus,
  };
  const { input, audio, conductor, game, weapons, resonance, bus } = mods;
  await mods.data.loadGameData(loadData(dataDir));
  mods.camera.initCamera({ w: 480, h: 270 });
  audio.__setTime(0);
  conductor.initConductor({ bpm: 96 });
  conductor.start(0.05);
  let profile = PROFILES[o.profile];
  if (!profile) throw new Error('profil inconnu ' + o.profile);
  if (o.inputEvery > 0) profile = Object.assign({}, profile, { inputEvery: o.inputEvery });   // --inputEvery N : cadence de frappe forcée
  const strategy = o.cards || profile.cards;
  const robot = makeRobot(profile, o, mods, mods.rngMod.makeRng(o.seed * 7919 + 13));
  const upgrades = {};
  if (o.upgrades) for (const kv of o.upgrades.split(',')) { const [k, v] = kv.split(':'); if (k) upgrades[k] = +(v || 1); }

  const out = {
    seed: o.seed, char: o.char, profile: o.profile, parish: o.parish, cards: strategy, upgrades,
    samples: [], xpTotal: 0, outcome: 'timeout', endSec: 0, kills: 0, level: 1, levelUps: 0, hitsTaken: 0, dmgTaken: {}, dmgTakenTotal: 0,
    boss: { startSec: null, endSec: null, hpAtStart: null, fightSec: null }, fissures: [], dps: {}, resonanceAvg: 0, bronze: 0,
    grades: null, dashes: 0, parries: 0, pulses: 0, parriesOk: 0, maxEnemies: 0, tierHist: [0, 0, 0, 0], streakMax: 0, build: null, achievements: [], leaves: [], firstDeathRisk: null, minHp: 1e9, minHpSec: 0,
    relic: null, relicOffer: null, bellRings: 0, bellAnswers: 0, duration: 0, moments: [], momentsTotal: 0,
  };
  const offs = [];
  offs.push(bus.on('level:up', (e) => {
    out.levelUps++;
    const card = robot.choose(e.choices, g.player, strategy, o.weapons);
    bus.emit('level:choice', { card });
  }));
  offs.push(bus.on('pickup:xp', (e) => { out.xpTotal += e.amount; }));
  offs.push(bus.on('bell:ring', () => { out.bellRings++; }));
  offs.push(bus.on('bell:answered', () => { out.bellAnswers++; }));
  offs.push(bus.on('player:parry', (e) => { if (e.success) out.parriesOk++; }));
  offs.push(bus.on('resonance:streak', (e) => { if (e.count > out.streakMax) out.streakMax = e.count; }));
  offs.push(bus.on('player:hit', (e) => { out.hitsTaken++; out.dmgTaken[e.from] = (out.dmgTaken[e.from] || 0) + e.damage; out.dmgTakenTotal += e.damage; }));
  offs.push(bus.on('run:boss', (e) => {
    if (e.phase === 'start') { out.boss.startSec = g.run.timeSec; out.boss.hpAtStart = g.player.hp; }
    if (e.phase === 'end') { out.boss.endSec = g.run.timeSec; out.boss.fightSec = +(out.boss.endSec - out.boss.startSec).toFixed(1); }
  }));
  offs.push(bus.on('run:fissure', (e) => out.fissures.push(e.bossId + ':' + e.phase + '@' + Math.round(g.run.timeSec))));
  offs.push(bus.on('run:moment', (e) => { if (e.phase === 'start') out.moments.push(e.id + '@' + Math.round(g.run.timeSec)); }));
  if (o.trace === 'boss') {
    offs.push(bus.on('enemy:hit', (e) => { const b = g.world.boss; if (b && e.id === b.id) console.error(`[boss] t=${g.run.timeSec.toFixed(2)} -${e.damage} crit=${e.crit} hp=${b.hp} src=${b.killedBy}`); }));
    offs.push(bus.on('enemy:death', (e) => { if (e.boss) console.error(`[boss] mort t=${g.run.timeSec.toFixed(2)}`); }));
    offs.push(bus.on('run:boss', (e) => console.error(`[boss] ${e.phase} ${e.index} t=${g.run.timeSec.toFixed(2)} hp=${g.world.boss ? g.world.boss.hp : '?'}`)));
  }
  offs.push(bus.on('run:end', (e) => {
    const s = e.stats;
    out.outcome = s.victory ? 'victory' : 'death';
    out.bronze = s.bronze; out.resonanceAvg = s.resonanceAvg; out.build = s.build; out.level = s.level; out.kills = s.kills;
    out.achievements = s.achievements; out.leaves = s.leaves; out.endSec = s.timeSec;
    for (const k in s.dpsByWeapon) out.dps[k] = Math.round(s.dpsByWeapon[k] / Math.max(1, s.timeSec) * 10) / 10;
  }));

  const g = game.startGame({ parishId: o.parish, characterId: o.char, seed: o.seed, assist: profile.assist, upgrades });
  // Relique de paroisse (§ 11 bis) : le robot prend la première proposée (--relic none|first|<id>).
  out.relicOffer = (g.run.relicOffer || []).slice();
  const relicChoice = o.relic === 'first' ? out.relicOffer[0] || null : o.relic === 'none' ? null : o.relic;
  if (!game.pickRelic(relicChoice) && relicChoice) throw new Error('Relique inconnue ' + relicChoice);
  out.relic = g.run.relicId;
  if (o.secondWeapon) weapons.addWeapon(g.player, o.secondWeapon);
  const p = g.player, world = g.world;
  out.duration = world.waveDef.duration; out.momentsTotal = world.moments.list.length;
  const minutes = o.minutes > 0 ? o.minutes : out.duration / 60 + 2.5;
  const maxTicks = Math.round(minutes * 60 * 60);
  let nextSample = 0;
  const t0 = performance.now();
  for (let i = 0; i < maxTicks && game.isGameActive(); i++) {
    audio.__advance(DT);
    conductor.__advance();
    robot.think(g);
    game.updateGame(DT);
    input.tickInput();
    if (world.enemies.active > out.maxEnemies) out.maxEnemies = world.enemies.active;
    if (o.trace === 'boss' && world.boss && i % 60 === 0) console.error(`[robot] t=${g.run.timeSec.toFixed(1)} dBoss=${robot.R.bossD.toFixed(0)} flee=${robot.R.flee} threat=${robot.R.threat.toFixed(3)} proj=${robot.R.projThreat.toFixed(3)} hp=${p.hp} alive=${world.enemies.active} bossHp=${world.boss.hp} bossState=${world.boss.aiState}`);
    if (!p.dead && p.hp < out.minHp) { out.minHp = p.hp; out.minHpSec = Math.round(g.run.timeSec); }
    out.tierHist[resonance.tier()]++;
    if (g.run.timeSec >= nextSample) {
      out.samples.push({ t: nextSample, level: g.run.level, xp: Math.round(out.xpTotal), hp: Math.max(0, Math.round(p.hp)), maxHp: p.maxHp, kills: world.kills, spawned: world.spawned, enemies: world.enemies.active,
        tier: resonance.tier(), bossHp: world.boss ? Math.round(world.boss.hp) : null, weapons: p.weapons.map((w) => w.id + ':' + w.level).join(' ') });
      nextSample += 30;
    }
  }
  out.simMs = Math.round(performance.now() - t0);
  if (game.isGameActive()) {
    out.endSec = Math.round(g.run.timeSec); out.level = g.run.level; out.kills = world.kills;
    out.resonanceAvg = Math.round(g.run.resonanceSum / Math.max(1e-6, g.run.resonanceSamples) * 100) / 100;
    const rep = weapons.dpsReport();
    for (const k in rep) out.dps[k] = Math.round(rep[k] / Math.max(1, g.run.timeSec) * 10) / 10;
    out.build = { weapons: p.weapons.map((w) => ({ id: w.id, level: w.level })), passives: p.passives.map((x) => ({ id: x.id, level: x.level })) };
    if (world.boss) out.boss.hpLeft = Math.round(world.boss.hp);
  }
  out.grades = robot.R.grades; out.dashes = robot.R.dashes; out.parries = robot.R.parries; out.pulses = robot.R.pulses;
  const th = out.tierHist.reduce((a, b) => a + b, 0) || 1;
  out.tierPct = out.tierHist.map((n) => Math.round(n / th * 100));
  out.minHp = out.minHp === 1e9 ? p.maxHp : Math.round(out.minHp);
  offs.forEach((f) => f());
  game.endGame();
  return out;
}

// ---- Affichage ------------------------------------------------------------------------------------------
function levelAt(r, t) { const s = r.samples.find((x) => x.t === t); return s ? s.level : null; }
function hpAt(r, t) { const s = r.samples.find((x) => x.t === t); return s ? s.hp : null; }
function fmtRun(r) {
  const lines = [];
  lines.push(`Run ${r.char}/${r.profile}/seed ${r.seed}/${r.parish} → ${r.outcome.toUpperCase()} à ${Math.round(r.endSec)} s (${(r.endSec / 60).toFixed(1)} min), niveau ${r.level}, ${r.kills} tués, Résonance moy. ${r.resonanceAvg}, bronze ${r.bronze}, ${r.simMs} ms de calcul`);
  lines.push('  t(s)   niv    XP   PV        vivants  tués/appar.  cran  boss PV  armes');
  for (const s of r.samples) lines.push(`  ${String(s.t).padStart(4)}   ${String(s.level).padStart(3)} ${String(s.xp).padStart(5)}   ${String(s.hp + '/' + s.maxHp).padEnd(9)} ${String(s.enemies).padStart(5)}   ${String(s.kills + '/' + s.spawned).padStart(10)}   ${s.tier}    ${String(s.bossHp === null ? '' : s.bossHp).padStart(6)}   ${s.weapons}`);
  lines.push('  DPS par arme : ' + Object.entries(r.dps).map(([k, v]) => k + ' ' + v).join(', '));
  lines.push('  frappes : ' + JSON.stringify(r.grades) + ` (${r.dashes} volées dont ${r.pulses} battements sur place, ${r.parries} parades dont ${r.parriesOk} utiles ; streak max ${r.streakMax}) ; temps par cran % ${(r.tierPct || []).join('/')} ; coups reçus ${r.hitsTaken} (${r.dmgTakenTotal} PV) : ` + Object.entries(r.dmgTaken).map(([k, v]) => k + ' ' + v).join(', '));
  lines.push(`  PV mini ${r.minHp} à ${r.minHpSec} s ; ennemis max ${r.maxEnemies} ; Fêlures ${r.fissures.join(' ')}`);
  lines.push(`  nuit de ${r.duration} s ; Moments ${r.moments.length}/${r.momentsTotal} : ${r.moments.join(' ')}`);
  lines.push(`  Relique : ${r.relic || 'aucune'} (proposées : ${(r.relicOffer || []).join(', ')}) ; cloche : ${r.bellAnswers}/${r.bellRings} réponses`);
  if (r.boss.startSec !== null) lines.push(`  boss : début ${Math.round(r.boss.startSec)} s avec ${r.boss.hpAtStart} PV, durée ${r.boss.fightSec === null ? 'non vaincu (' + r.boss.hpLeft + ' PV restants)' : r.boss.fightSec + ' s'}`);
  if (r.build) lines.push('  build : ' + r.build.weapons.map((w) => w.id + ':' + w.level).join(' ') + ' | ' + r.build.passives.map((w) => w.id + ':' + w.level).join(' '));
  return lines.join('\n');
}

function mean(arr) { const a = arr.filter((x) => x !== null && x !== undefined && !Number.isNaN(x)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; }
function f1(v) { return v === null ? '–' : (Math.round(v * 10) / 10).toString(); }

/** Tableau agrégé par (sonneur, profil). Exporté pour PLAYTEST.md. */
export function summarize(results) {
  const groups = new Map();
  for (const r of results) { const k = r.char + '/' + r.profile; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const rows = [];
  for (const [k, rs] of groups) {
    rows.push({
      key: k, n: rs.length, victoires: rs.filter((r) => r.outcome === 'victory').length, morts: rs.filter((r) => r.outcome === 'death').length,
      minuteMort: mean(rs.filter((r) => r.outcome === 'death').map((r) => r.endSec / 60)),
      niv90: mean(rs.map((r) => levelAt(r, 90))), niv180: mean(rs.map((r) => levelAt(r, 180))), nivEnd: mean(rs.map((r) => levelAt(r, r.duration) ?? (r.endSec >= r.duration - 20 ? r.level : null))),
      moments: mean(rs.map((r) => r.moments.length)), duration: rs[0].duration,
      pvBoss: mean(rs.map((r) => r.boss.hpAtStart !== null ? r.boss.hpAtStart / (r.samples[0] ? r.samples[r.samples.length - 1].maxHp : 100) * 100 : null)),
      bossSec: mean(rs.map((r) => r.boss.fightSec)), kills: mean(rs.map((r) => r.kills)), reso: mean(rs.map((r) => r.resonanceAvg)),
      bronze: mean(rs.map((r) => r.bronze)), minHp: mean(rs.map((r) => r.minHp)),
    });
  }
  return rows;
}
export function tableText(rows) {
  const h = 'sonneur/profil        n  vict  morts  min.mort  niv@90s  niv@3min  niv@fin  PV%boss  boss(s)  tués   réso  bronze  moments';
  const lines = [h];
  for (const r of rows) lines.push(`${r.key.padEnd(20)} ${String(r.n).padStart(2)}  ${String(r.victoires).padStart(4)}  ${String(r.morts).padStart(5)}  ${f1(r.minuteMort).padStart(8)}  ${f1(r.niv90).padStart(7)}  ${f1(r.niv180).padStart(8)}  ${f1(r.nivEnd).padStart(7)}  ${f1(r.pvBoss).padStart(7)}  ${f1(r.bossSec).padStart(7)}  ${f1(r.kills).padStart(5)}  ${f1(r.reso).padStart(4)}  ${f1(r.bronze).padStart(6)}  ${f1(r.moments).padStart(7)}`);
  return lines.join('\n');
}
export function markdownTable(rows) {
  const lines = ['| sonneur/profil | n | vict. | morts | min. mort | niv 90 s | niv 3 min | niv fin | PV % au boss | boss (s) | tués | réso | bronze | moments |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of rows) lines.push(`| ${r.key} | ${r.n} | ${r.victoires} | ${r.morts} | ${f1(r.minuteMort)} | ${f1(r.niv90)} | ${f1(r.niv180)} | ${f1(r.nivEnd)} | ${f1(r.pvBoss)} | ${f1(r.bossSec)} | ${f1(r.kills)} | ${f1(r.reso)} | ${f1(r.bronze)} | ${f1(r.moments)} |`);
  return lines.join('\n');
}

// ---- Matrice (processus enfants) -------------------------------------------------------------------------
function runChild(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...args, '--json'], { stdio: ['ignore', 'pipe', 'inherit'] });
    let buf = '';
    child.stdout.on('data', (d) => { buf += d; });
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error('sim enfant code ' + code + ' ' + args.join(' ')));
      try { resolve(JSON.parse(buf.trim().split('\n').pop())); } catch (e) { reject(new Error('JSON enfant invalide : ' + buf.slice(0, 300))); }
    });
  });
}

export async function runMatrix(o) {
  const jobs = [];
  for (const c of o.chars.split(',')) for (const pr of o.profiles.split(',')) for (let s = 1; s <= o.seeds; s++) {
    const args = ['--char', c, '--profile', pr, '--seed', String(s), '--parish', o.parish, '--weapons', String(o.weapons), '--relic', o.relic];
    if (o.minutes > 0) args.push('--minutes', String(o.minutes));
    if (o.data) args.push('--data', o.data);
    if (o.cards) args.push('--cards', o.cards);
    if (o.upgrades) args.push('--upgrades', o.upgrades);
    if (o.secondWeapon) args.push('--secondWeapon', o.secondWeapon);
    if (o.inputEvery > 0) args.push('--inputEvery', String(o.inputEvery));
    jobs.push(args);
  }
  const results = [];
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const args = jobs[next++];
      const r = await runChild(args);
      results.push(r);
      if (!o.quiet) console.error(`[${results.length}/${jobs.length}] ${r.char}/${r.profile}/${r.seed} → ${r.outcome} ${Math.round(r.endSec)} s niv ${r.level} (${r.simMs} ms)`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(o.jobs, jobs.length) }, worker));
  results.sort((a, b) => a.char.localeCompare(b.char) || a.profile.localeCompare(b.profile) || a.seed - b.seed);
  return results;
}

// ---- Entrée -------------------------------------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const o = parseArgs(process.argv.slice(2));
  if (o.matrix) {
    const results = await runMatrix(o);
    if (o.json) console.log(JSON.stringify({ options: o, results, summary: summarize(results) }));
    else {
      for (const r of results) console.log(fmtRun(r) + '\n');
      console.log(tableText(summarize(results)));
    }
  } else {
    const r = await runOne(o);
    console.log(o.json ? JSON.stringify(r) : fmtRun(r));
  }
}
