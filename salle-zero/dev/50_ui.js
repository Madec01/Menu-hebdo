/* =========================================================================
   SALLE ZÉRO — 50_ui.js
   Écrans DOM (menu, hub, préparation, choix, pause, fin, crédits) et HUD canvas.
   ========================================================================= */

const UI = (() => {
  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  let root, screens = {}, banners = [], toasts = [], fade = { t: 0, dir: 0, cb: null };
  const state = { choice: null, prep: null };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function init() {
    root = $('#ui');
    for (const s of ['menu', 'hub', 'prep', 'choice', 'pause', 'end', 'credits', 'lore']) { const d = el('div', 'screen', ''); d.id = 'screen-' + s; d.hidden = true; root.appendChild(d); screens[s] = d; }
    root.addEventListener('mouseover', e => { if (e.target.closest('button, .card')) AudioEngine.uiHover({ intensity: 0.4 }); });
    window.addEventListener('keydown', e => {
      if (e.code === 'F1' && G.mode === 'test') { e.preventDefault(); Debug.toggle(); }
      if (G.state === 'run' && (e.code === 'Escape' || e.code === 'KeyP') && !G.overlay) togglePause();
      else if (G.state === 'run' && e.code === 'Escape' && G.overlay === 'pause') togglePause();
      if (G.overlay === 'choice' && state.choice) { const k = parseInt(e.key); if (k >= 1 && k <= state.choice.choices.length) state.choice.pick(state.choice.choices[k - 1]); if (e.code === 'KeyR') state.choice.reroll && state.choice.reroll(); }
    });
  }
  function show(name) { for (const k in screens) screens[k].hidden = k !== name; G.overlay = name === null ? null : name; root.classList.toggle('active', name !== null); }
  function hideAll() { show(null); }

  /* ---------- Menu ---------- */
  function showMenu() {
    G.state = 'menu'; G.paused = false;
    const s = screens.menu; s.innerHTML = `
      <div class="panel center menu">
        <div class="eyebrow">${esc(LORE.subtitle)}</div>
        <h1 class="title">${esc(LORE.title)}</h1>
        <p class="muted synopsis">${esc(LORE.synopsis)}</p>
        <div class="row">
          <button class="btn primary" id="btn-normal">Mode Normal</button>
          <button class="btn" id="btn-test">Mode Test</button>
        </div>
        <div class="row small">
          <button class="btn ghost" id="btn-credits">Crédits</button>
          <button class="btn ghost" id="btn-reset">Réinitialiser la sauvegarde</button>
        </div>
        <p class="muted tiny">ZQSD / WASD : déplacement · souris : visée · clic gauche : attaque · clic droit / Espace : compétence · E : interagir · Échap : pause${G.mode === 'test' ? ' · F1 : debug' : ''}</p>
        <p class="muted tiny">Sauvegarde : ${Meta.profile.runs} run(s), ${Meta.profile.wins} victoire(s), ${fmt(Meta.profile.coins)} crédits.</p>
      </div>`;
    s.querySelector('#btn-normal').onclick = () => { Meta.setMode('normal'); Debug.hide(); Run.toHub(); };
    s.querySelector('#btn-test').onclick = () => { Meta.setMode('test'); Run.toHub(); toast('Mode Test : tout est débloqué. F1 : panneau debug.', 5); };
    s.querySelector('#btn-credits').onclick = showCredits;
    s.querySelector('#btn-reset').onclick = () => { if (confirm('Effacer la sauvegarde du mode Normal ?')) { Meta.reset(); showMenu(); } };
    show('menu'); Music.play('hub');
  }

  /* ---------- Hub ---------- */
  let hubTab = 'passifs';
  function showHub() {
    G.state = 'hub'; const p = Meta.profile; const s = screens.hub;
    const chars = Content.characters(); const cur = Content.character(p.character);
    const biome = Content.biomes()[0];
    const tabs = ['passifs', 'armes', 'sujets', 'fragments'];
    s.innerHTML = `
      <div class="hub">
        <header class="hubbar panel">
          <div><div class="eyebrow">Salle Zéro — hub</div><div class="muted small">${esc(Content.pick('hub'))}</div></div>
          <div class="coins">◈ ${fmt(p.coins)} <span class="muted small">crédits</span> ${G.mode === 'test' ? '<span class="tag test">MODE TEST</span>' : ''}</div>
          <div class="row small"><button class="btn ghost" id="hub-menu">Menu</button></div>
        </header>
        <section class="panel col left">
          <h3>Sujet</h3>
          <div class="cards vertical" id="hub-chars"></div>
          <h3>Palier</h3>
          <div class="card level">
            <div class="cardtitle">${esc(biome.name)}</div>
            <div class="muted small">${esc(biome.desc)}</div>
            <div class="muted tiny">À l'entrée, une variable stimulée et une variable inhibée sont tirées parmi ${biome.levelPassives.length} paires.</div>
            <div class="pairs">${biome.levelPassives.map(lp => `<div class="pair"><span class="good">+ ${esc(lp.bonus.name)}</span> <span class="bad">− ${esc(lp.malus.name)}</span></div>`).join('')}</div>
          </div>
          <button class="btn primary big" id="hub-enter">Entrer dans ${esc(biome.name)}</button>
        </section>
        <section class="panel col right">
          <nav class="tabs">${tabs.map(t => `<button class="tab ${hubTab === t ? 'on' : ''}" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</nav>
          <div id="hub-shop" class="shop"></div>
        </section>
      </div>`;
    const cc = s.querySelector('#hub-chars');
    for (const c of chars) {
      const owned = Meta.characterUnlocked(c.id); const sel = c.id === p.character;
      const card = el('div', 'card char' + (sel ? ' selected' : '') + (owned ? '' : ' locked'), `<div class="cardtitle">${esc(c.name)}</div><div class="muted small">${esc(c.desc)}</div><div class="trait"><b>${esc(c.trait.name)}</b> — ${esc(c.trait.desc)}</div><div class="stats muted tiny">PV ${c.stats.maxHp} · vitesse ${c.stats.speed} · chance ${c.stats.luck}</div>${owned ? '' : `<button class="btn small buy" ${p.coins < c.price ? 'disabled' : ''}>Réactiver — ◈ ${c.price}</button>`}`);
      card.onclick = e => { if (e.target.classList.contains('buy')) { if (Meta.buyCharacter(c.id)) showHub(); return; } if (owned) { p.character = c.id; Meta.save(); showHub(); } };
      cc.appendChild(card);
    }
    s.querySelectorAll('.tab').forEach(t => t.onclick = () => { hubTab = t.dataset.tab; showHub(); });
    s.querySelector('#hub-menu').onclick = showMenu;
    s.querySelector('#hub-enter').onclick = () => { hideAll(); Run.start({ character: p.character, biome: biome.id }); };
    renderShop(s.querySelector('#hub-shop'));
    show('hub');
  }
  function renderShop(box) {
    const p = Meta.profile; box.innerHTML = '';
    if (hubTab === 'passifs') {
      for (const m of Content.metaPassives()) {
        const t = Meta.tierOf(m.id); const next = m.tiers[t]; const maxed = !next;
        const card = el('div', 'card meta' + (maxed ? ' maxed' : ''), `<div class="cardtitle">${esc(m.name)} <span class="tier">${'●'.repeat(t)}${'○'.repeat(m.tiers.length - t)}</span></div><div class="muted small">${esc(m.desc)}</div><div class="muted tiny">${m.tiers.map((tier, i) => `<span class="${i < t ? 'good' : ''}">${i + 1}: ${esc(describeTier(tier))}</span>`).join(' · ')}</div>${maxed ? '<div class="good small">Calibration maximale</div>' : `<button class="btn small buy" ${p.coins < next.price ? 'disabled' : ''}>Palier ${t + 1} — ◈ ${next.price}</button>`}`);
        const b = card.querySelector('.buy'); if (b) b.onclick = () => { if (Meta.buy(m.id)) showHub(); };
        box.appendChild(card);
      }
    } else if (hubTab === 'armes') {
      for (const w of Content.weapons()) {
        const owned = Meta.weaponUnlocked(w.id);
        const card = el('div', 'card weapon' + (owned ? '' : ' locked'), `<div class="cardtitle">${esc(w.name)} <span class="tag">${esc(w.family)}</span></div><div class="muted small">${esc(w.desc)}</div><div class="muted tiny">${weaponStats(w)}</div>${owned ? '<div class="good small">Outillage disponible</div>' : `<button class="btn small buy" ${p.coins < w.price ? 'disabled' : ''}>Racheter — ◈ ${w.price}</button>`}`);
        const b = card.querySelector('.buy'); if (b) b.onclick = () => { if (Meta.buyWeapon(w.id)) showHub(); };
        box.appendChild(card);
      }
    } else if (hubTab === 'sujets') {
      box.appendChild(el('div', 'muted small', 'Les compétences actives sont proposées deux par deux à l\'entrée du palier. Catalogue :'));
      for (const sk of Content.skills()) box.appendChild(el('div', 'card', `<div class="cardtitle">${esc(sk.name)}</div><div class="muted small">${esc(sk.desc)}</div>`));
    } else if (hubTab === 'fragments') {
      for (const f of LORE.fragments) {
        const ok = Meta.loreUnlocked(f.id);
        const card = el('div', 'card lore' + (ok ? '' : ' locked'), `<div class="cardtitle">${ok ? esc(f.title) : 'Document scellé'}</div><div class="muted small">${ok ? esc(f.text).replace(/\n/g, '<br>') : 'Condition : ' + esc(f.cond)}</div>`);
        box.appendChild(card);
      }
      box.appendChild(el('div', 'muted tiny', `Runs : ${p.runs} · victoires : ${p.wins} · réimpressions : ${p.deaths} · meilleur niveau : ${p.bestLevel}`));
    }
  }
  function describeTier(t) { const parts = (t.mods || []).map(m => `${STAT_LABELS[m.stat] || m.stat} ${m.add != null ? (m.add > 0 ? '+' : '') + (Math.abs(m.add) < 1 ? Math.round(m.add * 100) + ' %' : m.add) : pct(m.mul - 1)}`); if (t.special) parts.push({ resurrect: 'résurrection', selective_memory: 'mémoire sélective', chest_preview: 'aperçu du coffre', fourth_choice: '4e choix', reroll: '+1 re-roll' }[t.special] || t.special); for (const h in (t.hooks || {})) for (const e of t.hooks[h]) if (!t.special) parts.push(e.effect); return parts.join(', ') || '—'; }
  function weaponStats(w) { return `dégâts ${w.damage} · cadence ${w.fireRate}/s · portée ${w.range}${w.pierce ? ' · perforation ' + w.pierce : ''}${w.bounce ? ' · rebonds ' + w.bounce : ''}${w.projectiles > 1 ? ' · ×' + w.projectiles : ''}`; }

  /* ---------- Préparation (salle 1) ---------- */
  function showPrep() {
    const r = G.run; const s = screens.prep; const lp = r.levelPassive;
    const weapons = Content.weapons().filter(w => Meta.weaponUnlocked(w.id));
    let selW = r.char.startWeapon && Meta.weaponUnlocked(r.char.startWeapon) ? r.char.startWeapon : weapons[0].id; let selS = null;
    const metaList = Content.metaPassives().filter(m => Meta.tierOf(m.id) > 0).map(m => `${esc(m.name)} ${Meta.tierOf(m.id)}`).join(', ') || 'aucune calibration';
    const render = () => {
      s.innerHTML = `
        <div class="panel prep">
          <div class="eyebrow">Salle 1 — préparation</div>
          <h2>${esc(Content.pick('levelEnter'))}</h2>
          <div class="passives">
            <div class="pair big"><span class="good">+ ${esc(lp.bonus.name)}</span> <span class="muted small">${esc(lp.bonus.desc)}</span></div>
            <div class="pair big"><span class="bad">− ${esc(lp.malus.name)}</span> <span class="muted small">${esc(lp.malus.desc)}</span></div>
            <div class="muted tiny">Trait : <b>${esc(r.char.trait.name)}</b> — ${esc(r.char.trait.desc)} · Calibrations : ${metaList}</div>
          </div>
          <h3>${STR.chooseWeapon}</h3>
          <div class="cards" id="prep-weapons">${weapons.map(w => `<div class="card pick ${w.id === selW ? 'selected' : ''}" data-w="${w.id}"><div class="cardtitle">${esc(w.name)} <span class="tag">${esc(w.family)}</span></div><div class="muted small">${esc(w.desc)}</div></div>`).join('')}</div>
          <h3>${STR.chooseSkill}</h3>
          <div class="cards" id="prep-skills">${r.skillChoices.map(sk => `<div class="card pick ${sk.id === selS ? 'selected' : ''}" data-s="${sk.id}"><div class="cardtitle">${esc(sk.name)}</div><div class="muted small">${esc(sk.desc)}</div><div class="muted tiny">Cooldown ${sk.cooldown} s</div></div>`).join('')}</div>
          <div class="row"><button class="btn primary big" id="prep-go" ${selS ? '' : 'disabled'}>${STR.enter}</button><button class="btn ghost" id="prep-abort">${STR.toHub}</button></div>
        </div>`;
      s.querySelectorAll('[data-w]').forEach(c => c.onclick = () => { selW = c.dataset.w; AudioEngine.uiClick({}); render(); });
      s.querySelectorAll('[data-s]').forEach(c => c.onclick = () => { selS = c.dataset.s; AudioEngine.uiClick({}); render(); });
      s.querySelector('#prep-go').onclick = () => go();
      s.querySelector('#prep-abort').onclick = () => { Run.toHub(); };
    };
    const go = () => { if (!selS) return; Run.equip(selW, selS); hideAll(); G.paused = false; Room.begin(); AudioEngine.uiConfirm({}); };
    state.prep = { pick: (w, sk) => { selW = w; selS = sk; go(); }, weapons, skills: r.skillChoices };
    render(); show('prep');
    if (G.autoplay) Debug.autoPrep();
  }

  /* ---------- Choix (level-up / coffre) ---------- */
  function showChoice({ title, subtitle, choices, reroll, onPick, onReroll }) {
    const s = screens.choice; const pl = G.player;
    const render = () => {
      s.innerHTML = `
        <div class="panel choice">
          <div class="eyebrow">${esc(subtitle || '')}</div><h2>${esc(title)}</h2>
          <div class="cards" id="choice-cards">${choices.map((u, i) => cardHtml(u, i)).join('')}</div>
          <div class="row small">${reroll && pl.rerollsLeft > 0 ? `<button class="btn ghost" id="choice-reroll">Re-roll (${pl.rerollsLeft}) — R</button>` : ''}<span class="muted tiny">1-${choices.length} : choisir</span></div>
        </div>`;
      s.querySelectorAll('[data-i]').forEach(c => c.onclick = () => pick(choices[+c.dataset.i]));
      const rb = s.querySelector('#choice-reroll'); if (rb) rb.onclick = doReroll;
    };
    const pick = u => { state.choice = null; onPick(u); };
    const doReroll = () => { if (!onReroll || pl.rerollsLeft <= 0) return; pl.rerollsLeft--; choices = onReroll(); AudioEngine.uiClick({}); render(); state.choice.choices = choices; };
    state.choice = { choices, pick, reroll: reroll ? doReroll : null };
    render(); show('choice');
    if (G.autoplay) Debug.autoChoice();
  }
  function cardHtml(u, i) {
    const r = RARITY[u.rarity]; const ex = G.run.upgrades.find(x => x.def.id === u.id);
    return `<div class="card upg r-${u.rarity}" data-i="${i}" style="--rc:${r.color};--rg:${r.glow}"><div class="rarity">${r.label}</div><div class="cardtitle">${esc(u.name)}</div><div class="desc">${esc(u.desc)}</div><div class="muted tiny">${u.category}${u.weaponFamily ? ' · synergie ' + u.weaponFamily : ''}${ex ? ` · possédé ×${ex.stacks}` : ''}${u.maxStacks > 1 ? ` · max ${u.maxStacks}` : ''}</div><div class="key">${i + 1}</div></div>`;
  }
  function hideChoice() { state.choice = null; hideAll(); }

  /* ---------- Pause ---------- */
  function togglePause() {
    if (G.overlay === 'pause') { hideAll(); G.paused = false; return; }
    if (G.overlay) return;
    G.paused = true; const s = screens.pause; const v = Meta.profile.volume; const pl = G.player;
    s.innerHTML = `<div class="panel center pause"><h2>${STR.paused}</h2>
      <div class="muted small">${esc(pl.weapon.name)} · ${esc(pl.skill.name)} · niveau ${G.run.level}</div>
      <div class="upglist">${G.run.upgrades.map(u => `<span class="pill" style="--rc:${RARITY[u.def.rarity].color}">${esc(u.def.name)}${u.stacks > 1 ? ' ×' + u.stacks : ''}</span>`).join('') || '<span class="muted tiny">aucune greffe</span>'}</div>
      <div class="sliders">
        <label>Master <input type="range" min="0" max="1" step="0.05" value="${v.master}" data-v="master"></label>
        <label>Effets <input type="range" min="0" max="1" step="0.05" value="${v.sfx}" data-v="sfx"></label>
        <label>Musique <input type="range" min="0" max="1" step="0.05" value="${v.music}" data-v="music"></label>
      </div>
      <div class="row"><button class="btn primary" id="pause-resume">${STR.resume}</button><button class="btn ghost" id="pause-quit">${STR.quit}</button></div></div>`;
    s.querySelectorAll('input[type=range]').forEach(i => i.oninput = () => { v[i.dataset.v] = +i.value; AudioEngine.setVolume(v); Meta.save(); });
    s.querySelector('#pause-resume').onclick = togglePause;
    s.querySelector('#pause-quit').onclick = () => { hideAll(); Run.abort(); };
    show('pause');
  }

  /* ---------- Fin de run ---------- */
  function showEnd({ victory, kept, pending, validated, total, bonus }) {
    const s = screens.end; const st = G.run.stats;
    s.innerHTML = `<div class="panel center end">
      <div class="eyebrow">${victory ? 'Case 5 cochée' : 'Réimpression'}</div>
      <h2 class="${victory ? 'good' : 'bad'}">${victory ? STR.victory : STR.dead}</h2>
      <p class="muted">${esc(Content.pick(victory ? 'bossWin' : 'death'))}</p>
      <div class="grid2">
        <div>Crédits consignés (salle 4)</div><div>◈ ${fmt(validated)}</div>
        <div>${victory ? 'Crédits en attente validés' : `Crédits en attente conservés (${Math.round(clamp(0.1 * (st.deathRoom - G.run.lastCheckpoint), 0, 1) * 100)} % de ${fmt(pending)})`}</div><div>◈ ${fmt(kept)}</div>
        ${bonus ? `<div>Prime de fin de protocole</div><div>◈ ${fmt(bonus)}</div>` : ''}
        <div><b>Total</b></div><div><b>◈ ${fmt(total)}</b></div>
        <div>Niveau atteint</div><div>${st.levelReached}</div>
        <div>Ennemis neutralisés</div><div>${st.kills}</div>
        <div>Dégâts subis / coups</div><div>${fmt(st.damageTaken)} / ${st.hitsTaken}</div>
        <div>Salles</div><div class="small">${st.roomTimes.map(r => `S${r.room} ${r.time}s ${r.hits} coup(s) q${Math.round(r.score * 100)}`).join(' · ') || '—'}</div>
      </div>
      <div class="row"><button class="btn primary big" id="end-hub">${STR.toHub}</button></div></div>`;
    s.querySelector('#end-hub').onclick = () => { hideAll(); Run.toHub(); };
    show('end');
    if (G.autoplay) Debug.autoEnd();
  }

  /* ---------- Crédits ---------- */
  function showCredits() {
    const s = screens.credits;
    s.innerHTML = `<div class="panel center credits"><h2>Crédits</h2>
      <p class="small"><b>Sprites</b> : 0x72 — Dungeon Tileset II (CC0). Kenney — Tiny Dungeon, Particle Pack, UI Pack, Pixel Shmup, Game Icons (CC0). Icônes game-icons.net (CC BY 3.0).</p>
      <p class="small"><b>Musique</b> : Kevin MacLeod (incompetech.com) — « Basement Floor », « Latin Industries », « In a Heartbeat », « Ouroboros ». Licensed under Creative Commons: By Attribution 4.0 — creativecommons.org/licenses/by/4.0/</p>
      <p class="small"><b>Polices</b> : Silkscreen, VT323, Pixelify Sans (SIL Open Font License).</p>
      <p class="small"><b>Sons</b> : synthèse organique Web Audio (bruit filtré, FM, convolution), module AudioEngine.</p>
      <p class="muted tiny">Détails et liens dans CREDITS.md et ASSETS.md.</p>
      <div class="row"><button class="btn primary" id="credits-back">Retour</button></div></div>`;
    s.querySelector('#credits-back').onclick = () => G.state === 'run' ? hideAll() : showMenu();
    show('credits');
  }

  /* ---------- Bannières, toasts, transitions ---------- */
  function banner(text, color = '#fff', sub = '') { banners.push({ text, color, sub, t: 0, life: 2.2 }); if (banners.length > 3) banners.shift(); }
  function toast(text, secs = 3.5) { toasts.push({ text, t: 0, life: secs }); if (toasts.length > 4) toasts.shift(); }
  function transition(cb) { fade.dir = 1; fade.cb = cb; }
  function update(dt) {
    for (let i = banners.length - 1; i >= 0; i--) { banners[i].t += dt; if (banners[i].t > banners[i].life) banners.splice(i, 1); }
    for (let i = toasts.length - 1; i >= 0; i--) { toasts[i].t += dt; if (toasts[i].t > toasts[i].life) toasts.splice(i, 1); }
    if (fade.dir === 1) { fade.t += dt * 4; if (fade.t >= 1) { fade.t = 1; fade.dir = -1; if (fade.cb) { const cb = fade.cb; fade.cb = null; cb(); } } }
    else if (fade.dir === -1) { fade.t -= dt * 3; if (fade.t <= 0) { fade.t = 0; fade.dir = 0; } }
  }

  /* ---------- HUD ---------- */
  function renderHud(ctx) {
    const pl = G.player, r = G.run, rm = G.room; if (!pl || !r || !rm || !pl.weapon || !pl.skill) return;
    ctx.save(); ctx.textBaseline = 'middle';
    /* PV */
    const bx = 24, by = 14, bw = 260, bh = 18;
    ctx.fillStyle = 'rgba(8,10,18,.75)'; roundRect(ctx, bx - 6, by - 6, bw + 12, bh + 30, 8); ctx.fill();
    ctx.fillStyle = '#2b1a24'; ctx.fillRect(bx, by, bw, bh);
    const hpk = clamp(pl.hp / pl.stats.maxHp, 0, 1); ctx.fillStyle = hpk > 0.5 ? '#ff5e7a' : hpk > 0.25 ? '#ff8c42' : '#ff3b3b'; ctx.fillRect(bx, by, bw * hpk, bh);
    if (pl.shield > 0) { ctx.fillStyle = 'rgba(140,255,255,.7)'; ctx.fillRect(bx, by + bh - 5, bw * clamp(pl.shield / pl.stats.maxHp, 0, 1), 5); }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${STR.hp} ${Math.ceil(pl.hp)} / ${pl.stats.maxHp}${pl.shield > 0 ? '  +' + Math.ceil(pl.shield) : ''}`, bx + 6, by + bh / 2);
    /* XP */
    ctx.fillStyle = '#12203a'; ctx.fillRect(bx, by + bh + 4, bw, 8); ctx.fillStyle = '#6ee7ff'; ctx.fillRect(bx, by + bh + 4, bw * clamp(r.xp / r.xpNext, 0, 1), 8);
    ctx.fillStyle = '#9aa4c4'; ctx.font = '11px "Segoe UI", system-ui, sans-serif'; ctx.fillText(`${STR.level} ${r.level}`, bx + bw + 8, by + bh + 8);
    /* salle + temps + qualité */
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(8,10,18,.75)'; roundRect(ctx, W / 2 - 200, 8, 400, 36, 8); ctx.fill();
    ctx.fillStyle = '#e8ecf7'; ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif'; ctx.fillText(rm.label, W / 2, 20);
    const q = Run.qualityAvg(); const qs = Room.score();
    const preview = Meta.chestPreview() && rm.index < 4 ? ' · coffre : ' + Progression.chestOptions(Run.qualityAvg(), r.scores.some(s => s.died) || rm.died).label : '';
    ctx.font = '11px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = '#9aa4c4'; ctx.fillText(`${Math.floor(rm.time)} s · ${STR.quality} run ${Math.round(q * 100)} % · salle ${Math.round(qs * 100)} % · ${rm.hits} coup(s)${rm.combo > 1 ? ' · combo ' + rm.combo : ''}${preview}`, W / 2, 36);
    /* jauge qualité */
    ctx.fillStyle = '#1a2036'; ctx.fillRect(W / 2 - 180, 42, 360, 3); ctx.fillStyle = q >= 0.999 ? '#ffb347' : q >= 0.8 ? '#b46bff' : q >= 0.5 ? '#4fb3ff' : '#cfd6e6'; ctx.fillRect(W / 2 - 180, 42, 360 * q, 3);
    /* crédits */
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(8,10,18,.75)'; roundRect(ctx, W - 250, 8, 226, 36, 8); ctx.fill();
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif'; ctx.fillText(`◈ ${fmt(r.coinsValidated)} consignés`, W - 34, 20);
    ctx.fillStyle = '#9aa4c4'; ctx.font = '11px "Segoe UI", system-ui, sans-serif'; ctx.fillText(`+ ${fmt(r.coinsPending)} ${STR.pending} (${Math.round(clamp(0.1 * (rm.index - r.lastCheckpoint), 0, 1) * 100)} % si perte)`, W - 34, 36);
    /* arme + compétence */
    const sy = H - 40;
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(8,10,18,.75)'; roundRect(ctx, 18, sy - 22, 420, 44, 8); ctx.fill();
    ctx.fillStyle = WEAPON_COLORS[pl.weapon.family] || '#fff'; ctx.beginPath(); ctx.arc(40, sy, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8ecf7'; ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif'; ctx.fillText(pl.weapon.name, 58, sy - 7);
    ctx.fillStyle = '#9aa4c4'; ctx.font = '11px "Segoe UI", system-ui, sans-serif'; ctx.fillText(`${Math.round(pl.weapon.damage * pl.stats.damage)} dmg · ${(pl.weapon.fireRate * pl.stats.fireRate).toFixed(1)}/s · crit ${Math.round(pl.stats.critChance * 100)} %`, 58, sy + 9);
    /* compétence : cercle de cooldown */
    const cx = 270, cd = Skills.cooldownOf(pl); const ready = pl.skillCharges > 0; const k = ready ? 1 : 1 - clamp(pl.skillCd / Math.max(0.01, cd), 0, 1);
    ctx.fillStyle = '#1a2036'; ctx.beginPath(); ctx.arc(cx, sy, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = ready ? '#7fff9a' : '#4fb3ff'; ctx.beginPath(); ctx.moveTo(cx, sy); ctx.arc(cx, sy, 14, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.fill();
    ctx.fillStyle = '#e8ecf7'; ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif'; ctx.fillText(pl.skill.name + (pl.skillMaxCharges > 1 ? ` ×${pl.skillCharges}` : ''), cx + 22, sy - 7);
    ctx.fillStyle = '#9aa4c4'; ctx.font = '11px "Segoe UI", system-ui, sans-serif'; ctx.fillText(ready ? STR.ready + ' · clic droit / Espace' : `${pl.skillCd.toFixed(1)} s`, cx + 22, sy + 9);
    /* greffes */
    ctx.textAlign = 'right'; let gx = W - 24; ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    for (const u of r.upgrades.slice(-8).reverse()) { const t = u.def.name + (u.stacks > 1 ? ' ×' + u.stacks : ''); const w = ctx.measureText(t).width + 12; ctx.fillStyle = 'rgba(8,10,18,.7)'; roundRect(ctx, gx - w, sy - 10, w, 20, 6); ctx.fill(); ctx.strokeStyle = RARITY[u.def.rarity].color; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = RARITY[u.def.rarity].color; ctx.fillText(t, gx - 6, sy); gx -= w + 6; if (gx < 520) break; }
    /* boss */
    const boss = rm.boss; if (boss && !boss.dead) { const bw2 = 520, bx2 = W / 2 - bw2 / 2, by2 = H - 88; ctx.fillStyle = 'rgba(8,10,18,.8)'; roundRect(ctx, bx2 - 8, by2 - 22, bw2 + 16, 44, 8); ctx.fill(); ctx.textAlign = 'center'; ctx.fillStyle = '#ff3b5c'; ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif'; ctx.fillText(boss.name + ' — phase ' + (boss.phaseIdx + 1), W / 2, by2 - 10); ctx.fillStyle = '#2b1a24'; ctx.fillRect(bx2, by2 + 2, bw2, 12); ctx.fillStyle = '#ff3b5c'; ctx.fillRect(bx2, by2 + 2, bw2 * clamp(boss.hp / boss.maxHp, 0, 1), 12); if (boss.weakActive) { ctx.fillStyle = '#ffd166'; ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif'; ctx.fillText('PRISE EXPOSÉE ×' + boss.weakMul, W / 2, by2 + 8); } }
    /* bannières */
    for (const b of banners) { const k = b.t / b.life; const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1; ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif'; ctx.shadowColor = b.color; ctx.shadowBlur = 24; ctx.fillStyle = b.color; ctx.fillText(b.text, W / 2, H * 0.3 - (1 - a) * 10); if (b.sub) { ctx.font = '14px "Segoe UI", system-ui, sans-serif'; ctx.fillStyle = '#e8ecf7'; ctx.fillText(b.sub, W / 2, H * 0.3 + 28); } ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
    ctx.restore();
  }
  function renderToasts(ctx) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    toasts.forEach((t, i) => { const a = Math.min(1, t.t * 3, (t.life - t.t) * 2); ctx.globalAlpha = clamp(a, 0, 1); const w = ctx.measureText(t.text).width + 24; const y = H - 110 - i * 30; ctx.fillStyle = 'rgba(8,10,18,.85)'; roundRect(ctx, W / 2 - w / 2, y - 12, w, 24, 8); ctx.fill(); ctx.strokeStyle = '#6ee7ff88'; ctx.stroke(); ctx.fillStyle = '#e8ecf7'; ctx.fillText(t.text, W / 2, y); });
    ctx.restore();
  }
  function renderFade(ctx) { if (fade.t > 0) { ctx.fillStyle = `rgba(4,5,9,${fade.t})`; ctx.fillRect(0, 0, W, H); } }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  /* fond animé pour menu/hub */
  function renderBackdrop(ctx) {
    ctx.fillStyle = '#07080d'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.5; for (let i = 0; i < 14; i++) { const t = Time.now * 0.05 + i * 0.37; const x = ((i * 137.5) % W + Math.sin(t) * 40 + W) % W, y = ((i * 91.7) % H + Math.cos(t * 1.3) * 30 + H) % H; const g = ctx.createRadialGradient(x, y, 0, x, y, 160); g.addColorStop(0, i % 3 ? 'rgba(110,231,255,.10)' : 'rgba(255,154,60,.08)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 160, y - 160, 320, 320); } ctx.restore();
    ctx.strokeStyle = 'rgba(110,231,255,.05)'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }
  return { init, show, hideAll, showMenu, showHub, showPrep, showChoice, hideChoice, togglePause, showEnd, showCredits, banner, toast, transition, update, renderHud, renderToasts, renderFade, renderBackdrop, state, esc, roundRect };
})();
