/* =========================================================================
   SALLE ZÉRO — 70_debug.js
   Panneau debug (mode Test), écran de test audio, harness window.__autoplay(config).
   ========================================================================= */

const Debug = (() => {
  let panel, open = false, audioOpen = false;
  const $ = s => panel.querySelector(s);
  function init() {
    panel = document.getElementById('debug'); panel.hidden = true;
    panel.innerHTML = `
      <div class="dhead"><b>DEBUG</b> <span class="muted tiny">F1 pour fermer</span><button class="btn small ghost" id="d-close">×</button></div>
      <label>Difficulté <span id="d-diff-v">1.0×</span><input type="range" min="0.5" max="3" step="0.1" value="1" id="d-diff"></label>
      <label>XP <span id="d-xp-v">1×</span><input type="range" min="0.25" max="10" step="0.25" value="1" id="d-xp"></label>
      <label>Crédits <span id="d-coin-v">1×</span><input type="range" min="0.25" max="10" step="0.25" value="1" id="d-coin"></label>
      <label>Rareté forcée <select id="d-rarity"><option value="">aucune</option>${RARITY_ORDER.map(r => `<option value="${r}">${RARITY[r].label}</option>`).join('')}</select></label>
      <div class="drow"><label class="chk"><input type="checkbox" id="d-invuln"> Invulnérable</label><label class="chk"><input type="checkbox" id="d-hit"> Hitboxes</label><label class="chk"><input type="checkbox" id="d-scores"> Scores</label></div>
      <div class="drow"><label>Salle <select id="d-room">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<option value="${i}">${i}</option>`).join('')}</select></label><button class="btn small" id="d-goto">Aller</button><button class="btn small" id="d-kill">Tuer tout</button><button class="btn small" id="d-lvl">+ niveau</button><button class="btn small" id="d-heal">Soigner</button></div>
      <div class="drow"><label>Ennemi <select id="d-enemy">${Content.enemies().map(e => `<option value="${e.id}">${e.name}</option>`).join('')}</select></label><button class="btn small" id="d-spawn">Spawn</button><label class="chk"><input type="checkbox" id="d-elite"> élite</label></div>
      <div class="drow"><label>Piège <select id="d-trap">${Content.traps().map(t => `<option value="${t.id}">${t.name}</option>`).join('')}</select></label><button class="btn small" id="d-spawntrap">Poser</button><button class="btn small" id="d-cleartraps">Retirer pièges</button></div>
      <div class="drow"><label>Arme <select id="d-weapon">${Content.weapons().map(w => `<option value="${w.id}">${w.name}</option>`).join('')}</select></label><label>Comp. <select id="d-skill">${Content.skills().map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></label><button class="btn small" id="d-equip">Équiper</button></div>
      <div class="drow"><label>Greffe <select id="d-upg">${Content.upgrades().map(u => `<option value="${u.id}">[${RARITY[u.rarity].label[0]}] ${u.name}</option>`).join('')}</select></label><button class="btn small" id="d-give">Donner</button></div>
      <div class="drow"><label>Vitesse <span id="d-ts-v">1×</span><input type="range" min="0.25" max="4" step="0.25" value="1" id="d-ts"></label></div>
      <div class="drow"><button class="btn small" id="d-audio">Test audio</button><button class="btn small" id="d-auto">Autoplay ×1</button><button class="btn small" id="d-auto5">Autoplay ×5</button></div>
      <pre id="d-out" class="dout"></pre>
      <div id="d-audiopanel" hidden></div>`;
    const bind = (id, fn) => { const e = $(id); e.oninput = e.onchange = () => fn(e); };
    bind('#d-diff', e => { G.debug.difficulty = +e.value; $('#d-diff-v').textContent = (+e.value).toFixed(1) + '×'; if (G.run) applyDifficulty(); });
    bind('#d-xp', e => { G.debug.xpMul = +e.value; $('#d-xp-v').textContent = e.value + '×'; });
    bind('#d-coin', e => { G.debug.coinMul = +e.value; $('#d-coin-v').textContent = e.value + '×'; });
    bind('#d-rarity', e => { G.debug.forceRarity = e.value || null; });
    bind('#d-invuln', e => { G.debug.invuln = e.checked; }); bind('#d-hit', e => { G.debug.hitboxes = e.checked; }); bind('#d-scores', e => { G.debug.showScores = e.checked; });
    bind('#d-ts', e => { Time.scale = +e.value; $('#d-ts-v').textContent = e.value + '×'; });
    $('#d-close').onclick = hide;
    $('#d-goto').onclick = () => gotoRoom(+$('#d-room').value);
    $('#d-kill').onclick = () => { if (!G.run) return; for (const e of G.enemies) if (!e.dead) Combat.killEnemy(e); };
    $('#d-lvl').onclick = () => { if (G.run) Run.addXp(G.run.xpNext - G.run.xp); };
    $('#d-heal').onclick = () => { if (G.player) G.player.hp = G.player.stats.maxHp; };
    $('#d-spawn').onclick = () => { if (!G.run) return; const def = Content.enemy($('#d-enemy').value); const pl = G.player; const a = RNG.range(0, TAU); Room.spawnEnemy(def, pl.x + Math.cos(a) * 220, pl.y + Math.sin(a) * 220, { elite: $('#d-elite').checked }); };
    $('#d-spawntrap').onclick = () => { if (!G.run) return; const td = Content.trap($('#d-trap').value); const pl = G.player; const tx = clamp(Math.floor((pl.x - ROOM_X) / TILE) + 2, 0, ROOM_COLS - 3), ty = clamp(Math.floor((pl.y - ROOM_Y) / TILE) - 1, 0, ROOM_ROWS - 3); G.room.traps.push(new Trap(td, { x: tx, y: ty, w: 3, h: 3, phase: G.room.time })); };
    $('#d-cleartraps').onclick = () => { if (G.room) G.room.traps = []; };
    $('#d-equip').onclick = () => { if (!G.run) return; Run.equip($('#d-weapon').value, $('#d-skill').value); UI.toast('Équipé : ' + G.player.weapon.name + ' + ' + G.player.skill.name); };
    $('#d-give').onclick = () => { if (!G.run) return; Run.takeUpgrade(Content.upgrade($('#d-upg').value)); };
    $('#d-audio').onclick = toggleAudioPanel;
    $('#d-auto').onclick = () => runAuto(1); $('#d-auto5').onclick = () => runAuto(5);
  }
  function toggle() { open ? hide() : show(); }
  function show() { if (G.mode !== 'test') { UI.toast('Panneau debug : mode Test uniquement'); return; } open = true; panel.hidden = false; G.debug.open = true; }
  function hide() { open = false; if (panel) panel.hidden = true; G.debug.open = false; }
  function gotoRoom(n) {
    if (!G.run) { Meta.setMode('test'); UI.hideAll(); Run.start({ character: Meta.profile.character, biome: Content.biomes()[0].id, weapon: Content.weapons()[0].id, skill: Content.skills()[0].id }); }
    if (!G.player.weapon) Run.equip(Content.weapons()[0].id, Content.skills()[0].id);
    UI.hideAll(); G.paused = false; if (Room.load(n)) Room.begin();
  }
  function toggleAudioPanel() {
    const box = $('#d-audiopanel'); audioOpen = !audioOpen; box.hidden = !audioOpen; if (!audioOpen) return;
    const names = AudioEngine.list ? AudioEngine.list() : [];
    box.innerHTML = `<div class="muted tiny">Écran de test audio — ${names.length} sons (synthèse organique, aucun oscillateur nu)</div><div class="abtns">${names.map(n => `<button class="btn small" data-snd="${n}">${n}</button>`).join('')}</div>
      <div class="drow"><button class="btn small" id="a-seq">Tout jouer</button><button class="btn small" id="a-gen-hub">Génératif hub</button><button class="btn small" id="a-gen-biome">Génératif biome</button><button class="btn small" id="a-gen-boss">Génératif boss</button><button class="btn small" id="a-stop">Stop musique</button></div>`;
    box.querySelectorAll('[data-snd]').forEach(b => b.onclick = () => { AudioEngine.init(); const n = b.dataset.snd; if (n === 'startFlame') { AudioEngine.startFlame({}); setTimeout(() => AudioEngine.stopFlame(), 800); } else if (typeof AudioEngine[n] === 'function') AudioEngine[n]({ intensity: 1 }); });
    box.querySelector('#a-seq').onclick = () => { AudioEngine.init(); let i = 0; const step = () => { if (i >= names.length) return; const n = names[i++]; if (typeof AudioEngine[n] === 'function' && n !== 'startFlame' && n !== 'stopFlame') AudioEngine[n]({ intensity: 1 }); UI.toast('♪ ' + n, 0.6); setTimeout(step, 550); }; step(); };
    for (const m of ['hub', 'biome', 'boss']) box.querySelector('#a-gen-' + m).onclick = () => { AudioEngine.init(); Music.stop(); AudioEngine.startGenerativeMusic(m); };
    box.querySelector('#a-stop').onclick = () => Music.stop();
  }
  async function runAuto(n) {
    const out = $('#d-out'); out.textContent = 'Autoplay en cours…'; const res = [];
    for (let i = 0; i < n; i++) { const r = await autoplay({ seed: 1000 + i, timeScale: 12, render: true }); res.push(r); out.textContent = res.map(x => `#${x.seed} ${x.outcome} salle ${x.roomReached} niv ${x.levelReached} kills ${x.kills} dégâts ${x.damageTaken} ${x.durationSec}s`).join('\n'); }
    UI.showHub();
  }
  /* ---------- Rendu overlay debug ---------- */
  function renderOverlay(ctx) {
    if (!G.run || !G.room) return;
    if (G.debug.hitboxes) {
      ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = '#0f0'; const pl = G.player; ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#f00'; for (const e of G.enemies) if (!e.dead) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = '#ff0'; for (const p of Projectiles.list) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke(); }
      ctx.strokeStyle = '#0ff'; for (const o of G.room.obstacles) ctx.strokeRect(o.px, o.py, o.pw, o.ph);
      ctx.strokeStyle = '#f0f'; for (const t of G.room.traps) ctx.strokeRect(t.x, t.y, t.w, t.h);
      ctx.restore();
    }
    if (G.debug.showScores) {
      ctx.save(); ctx.font = '12px monospace'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; let y = 70; const r = G.room;
      const lines = [`salle ${r.index} ${r.type} état ${r.state} t=${r.time.toFixed(1)} ref=${r.refTime}`, `coups ${r.hits} combo ${r.combo}/${r.bestCombo} kills ${r.kills} score ${Room.score().toFixed(2)}`, `scores: ${G.run.scores.map(s => `S${s.index}=${s.score.toFixed(2)}`).join(' ')} moy=${Run.qualityAvg().toFixed(2)}`, `diff ${JSON.stringify(G.difficulty)}`, `ennemis ${Room.alive()} proj ${Projectiles.list.length} fps ${Engine.stats.fps} pas/frame ${Engine.stats.steps}`, `stats ${JSON.stringify(Object.fromEntries(Object.entries(G.player.stats).map(([k, v]) => [k, +v.toFixed(2)])))}`];
      for (const l of lines) { ctx.fillStyle = '#000a'; ctx.fillRect(20, y - 10, Math.min(1240, ctx.measureText(l).width + 8), 16); ctx.fillStyle = '#7fff9a'; ctx.fillText(l.slice(0, 200), 24, y); y += 16; }
      ctx.restore();
    }
  }

  /* ---------- Bot ---------- */
  const DIRS = [{ x: 0, y: 0 }]; for (let i = 0; i < 16; i++) DIRS.push({ x: Math.cos(i * TAU / 16), y: Math.sin(i * TAU / 16) });
  function botControl(pl) {
    const rm = G.room; const rng = G.autoplay.rng; const w = pl.weapon; const isMelee = w && (w.type === 'melee' || w.type === 'area' || w.type === 'orbital');
    const enemy = nearestEnemy(pl.x, pl.y);
    /* objectif */
    let goal = null;
    const frag = Pickups.list.find(p => p.kind === 'fragment');
    if (rm.chest && !rm.chest.opened) goal = { x: rm.chest.x, y: rm.chest.y };
    else if (rm.type === 'TRAP' && frag && rm.time < 40) goal = frag;
    else if (rm.doorOpen && (!enemy || rm.state === 'clear' || rm.type === 'TRAP')) goal = { x: ROOM_X + ROOM_W + 10, y: ROOM_Y + ROOM_H / 2 };
    else if (enemy) goal = enemy;
    else { const pk = Pickups.list[0]; goal = pk ? { x: pk.x, y: pk.y } : { x: W / 2, y: H / 2 }; }
    const wantDist = enemy && goal === enemy ? (isMelee ? 40 : (w.family === 'flame' ? 110 : 260)) : 0;
    /* évaluation des directions */
    let best = DIRS[0], bs = -Infinity; const look = 34;
    for (const d of DIRS) {
      const nx = clamp(pl.x + d.x * look, ROOM_X + pl.r, ROOM_X + ROOM_W - pl.r), ny = clamp(pl.y + d.y * look, ROOM_Y + pl.r, ROOM_Y + ROOM_H - pl.r); let s = 0;
      if (pointBlocked(nx, ny, pl.r)) s -= 50;
      s -= Room.dangerAt(nx, ny) * 40;
      for (const p of Projectiles.list) if (p.owner === 'enemy') { const fx = p.x + p.vx * 0.35, fy = p.y + p.vy * 0.35; const dd = Math.min(dist(nx, ny, p.x, p.y), dist(nx, ny, fx, fy)); if (dd < 40) s -= 25 * (1 - dd / 40); }
      for (const e of G.enemies) { if (e.dead) continue; const dd = dist(nx, ny, e.x, e.y); const danger = e.tele ? 90 : 50; if (dd < danger + e.r && !(isMelee && e === enemy && !e.tele)) s -= 18 * (1 - dd / (danger + e.r)); if (e.archetype === 'kamikaze' && e.state === 'fuse' && dd < 120) s -= 40; }
      if (goal) { const gd = dist(nx, ny, goal.x, goal.y); s += wantDist ? -Math.abs(gd - wantDist) * 0.08 : -gd * 0.05; }
      s += rng() * 1.5;
      if (s > bs) { bs = s; best = d; }
    }
    const aim = enemy ? angleTo(pl.x, pl.y, enemy.x, enemy.y) : (goal ? angleTo(pl.x, pl.y, goal.x, goal.y) : 0);
    const inRange = enemy && dist(pl.x, pl.y, enemy.x, enemy.y) < (isMelee ? (w.range || 70) * pl.stats.range * 1.4 + enemy.r : (w.range || 500) * pl.stats.range);
    let fire = !!inRange; if (w && w.family === 'bow' && enemy) fire = (Time.frame % 60) < 45;
    const k = pl.skill && pl.skill.effect.kind; let skill = false;
    if (pl.skillCharges > 0) { const near = enemy && dist(pl.x, pl.y, enemy.x, enemy.y) < 120; const danger = Room.dangerAt(pl.x, pl.y) > 0.5; if (k === 'dash' || k === 'blink') skill = (danger || (near && enemy.tele)) && bs < -10; else if (k === 'shield' || k === 'shockwave' || k === 'slowtime' || k === 'overdrive' || k === 'decoy') skill = G.enemies.filter(e => !e.dead && dist(pl.x, pl.y, e.x, e.y) < 220).length >= 2 || (rm.boss && !rm.boss.dead && near); else if (k === 'turret') skill = !!enemy && Room.alive() >= 2; else if (k === 'magnet') skill = Pickups.list.length > 8; }
    return { move: best, aim, fire, skill };
  }
  function autoPrep() { const st = UI.state.prep; if (!st) return; const rng = G.autoplay.rng; const c = G.autoplay.config; setTimeout(() => st.pick(c.weapon || rng.pick(st.weapons).id, c.skill || rng.pick(st.skills).id), 0); }
  function autoChoice() { const st = UI.state.choice; if (!st) return; const rng = G.autoplay.rng; const c = G.autoplay.config; setTimeout(() => { if (!UI.state.choice) return; let pick = rng.pick(st.choices); if (c.pickStrategy === 'best') pick = st.choices.slice().sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity))[0]; st.pick(pick); }, 0); }
  function autoEnd() { setTimeout(() => finishAuto(), 0); }
  function finishAuto(reason) {
    const a = G.autoplay; if (!a) return; const r = G.run; const st = r ? r.stats : {};
    const res = { seed: a.config.seed, outcome: reason || (st.bossKilled && !r.ended ? 'timeout' : r && r.ended && !G.player.dead ? 'victory' : 'death'), roomReached: r ? G.room.index : 0, levelReached: st.levelReached, kills: st.kills, damageTaken: st.damageTaken, hitsTaken: st.hitsTaken, damageDealt: st.damageDealt, coins: st.coins, deathRoom: st.deathRoom, roomTimes: st.roomTimes, upgrades: r ? r.upgrades.map(u => u.def.id + (u.stacks > 1 ? '×' + u.stacks : '')) : [], weapon: r && r.weapon, skill: r && r.skill, character: r && r.char.id, durationSec: Math.round((Time.now - a.startedAt) * 10) / 10, bossKilled: !!st.bossKilled };
    G.autoplay = null; Time.scale = 1; Engine.setHeadless(false); if (G.player) G.player.bot = null;
    UI.hideAll(); if (G.run && !G.run.ended) { G.run.ended = true; } Run.toHub();
    a.resolve(res);
  }
  /* window.__autoplay(config) → Promise<stats> */
  function autoplay(config = {}) {
    if (G.autoplay) return Promise.reject(new Error('autoplay déjà en cours'));
    return new Promise(resolve => {
      const c = Object.assign({ seed: Date.now() & 0xffff, timeScale: 20, render: false, character: null, weapon: null, skill: null, difficulty: 1, maxRooms: 5, maxSeconds: 900, pickStrategy: 'random', mode: 'test' }, config);
      Meta.setMode(c.mode); G.debug.difficulty = c.difficulty; UI.hideAll();
      const rng = makeRng(c.seed); G.autoplay = { config: c, resolve, rng, startedAt: Time.now };
      Engine.setHeadless(!c.render); Time.scale = c.timeScale;
      const character = c.character || Meta.profile.character;
      Run.start({ character, biome: Content.biomes()[0].id, seed: c.seed, weapon: c.weapon, skill: c.skill });
      if (!G.run) { finishAuto('error'); return; }
      G.player.bot = botControl;
      const watchdog = () => { if (!G.autoplay) return; if (Time.now - G.autoplay.startedAt > c.maxSeconds) { finishAuto('timeout'); return; } if (G.run && G.room && G.room.index > c.maxRooms) { finishAuto('maxRooms'); return; } setTimeout(watchdog, 200); }; setTimeout(watchdog, 200);
    });
  }
  return { init, toggle, show, hide, gotoRoom, renderOverlay, autoplay, autoPrep, autoChoice, autoEnd, botControl };
})();
