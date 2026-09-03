/* ---------- entrées ---------- */
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') wantDash = true;
  if (e.code === 'KeyE' || e.code === 'KeyF') wantSurge = true;
  if (e.code === 'KeyP' || e.code === 'Escape') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); }
  if (state === 'menu' && $('menu').classList.contains('show') && e.code === 'Enter') { uiAudio(); newRun(); }
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); if (state === 'play') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pauseGame(); });
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = performance.now(); mouse.active = true; });
canvas.addEventListener('mousedown', e => { if (e.button === 0) { mouse.down = true; mouse.t = performance.now(); } if (e.button === 2) wantSurge = true; });
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', e => { if (e.target === canvas) e.preventDefault(); });

function clearTouches() { touches.clear(); }
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  document.body.classList.add('touch');
  uiAudio();
  for (const t of e.changedTouches) {
    const side = t.clientX < W / 2 ? 'L' : 'R';
    let taken = false; for (const o of touches.values()) if (o.side === side) taken = true;
    if (taken) continue;
    touches.set(t.identifier, { side, sx: t.clientX, sy: t.clientY, x: t.clientX, y: t.clientY });
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) { const o = touches.get(t.identifier); if (o) { o.x = t.clientX; o.y = t.clientY; } } }, { passive: false });
const touchEnd = e => { e.preventDefault(); for (const t of e.changedTouches) touches.delete(t.identifier); };
canvas.addEventListener('touchend', touchEnd, { passive: false });
canvas.addEventListener('touchcancel', touchEnd, { passive: false });
function stick(side) {
  let o = null; for (const v of touches.values()) if (v.side === side) o = v;
  if (!o) return { active: false, dx: 0, dy: 0, len: 0 };
  const max = 52, dead = 6;
  let dx = o.x - o.sx, dy = o.y - o.sy, l = Math.hypot(dx, dy);
  if (l > max) { o.sx = o.x - dx / l * max; o.sy = o.y - dy / l * max; dx = dx / l * max; dy = dy / l * max; l = max; }
  if (l < dead) return { active: true, dx: 0, dy: 0, len: 0 };
  const len = clamp((l - dead) / (max - dead), 0, 1);
  return { active: true, dx: dx / l * len, dy: dy / l * len, len };
}
if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
const dashPress = e => { e.preventDefault(); wantDash = true; };
$('dashBtn').addEventListener('touchstart', dashPress, { passive: false });
$('dashBtn').addEventListener('mousedown', dashPress);
const surgePress = e => { e.preventDefault(); wantSurge = true; };
$('surgeBtn').addEventListener('touchstart', surgePress, { passive: false });
$('surgeBtn').addEventListener('mousedown', surgePress);
$('pauseBtn').addEventListener('click', () => { if (state === 'play') pauseGame(); });

/* ---------- overlays ---------- */
const OVS = ['menu', 'meta', 'options', 'choice', 'pause', 'dead'];
function hideAll() { for (const o of OVS) $(o).classList.remove('show'); }
function show(id) { hideAll(); $(id).classList.add('show'); }
function uiAudio() { if (Audio.init()) { Audio.resume(); if (state === 'menu' || state === 'dead') { Audio.play('menu'); Audio.setAmbience('drip'); } } }
for (const id of ['menu', 'meta', 'options']) $(id).addEventListener('pointerdown', uiAudio, { once: false });

function refreshMenu() {
  $('mBest').textContent = save.bestFloor;
  $('mRuns').textContent = save.runs;
  $('mKills').textContent = save.kills;
  $('mEss').textContent = save.essence + ' ◆';
  const chips = $('weaponChips'); chips.innerHTML = '';
  for (const id in WEAPONS) {
    const w = WEAPONS[id], owned = save.weapons.includes(id);
    const c = document.createElement('div'); c.className = 'chip' + (save.startWeapon === id ? ' on' : '') + (owned ? '' : ' locked');
    c.innerHTML = `<span>${w.ic}</span><span>${w.name}</span>${owned ? '' : '<span>🔒</span>'}`;
    c.title = w.desc;
    c.addEventListener('click', () => { if (!owned) { SFX('deny'); return; } save.startWeapon = id; writeSave(); SFX('click'); refreshMenu(); });
    chips.appendChild(c);
  }
  for (const id of ['musicVol', 'musicVol2']) $(id).value = Math.round(save.musicVol * 100);
  for (const id of ['sfxVol', 'sfxVol2']) $(id).value = Math.round(save.sfxVol * 100);
  $('shakeOpt').value = Math.round(save.shakeAmt * 100);
  $('lastSeed').textContent = save.lastSeed == null ? '—' : save.lastSeed;
}
function refreshMeta() {
  $('sEss').textContent = save.essence + ' ◆';
  const up = $('tab-upgrades'); up.innerHTML = '';
  for (const m of META) {
    const lv = metaLv(m.id), maxed = lv >= m.max, cost = maxed ? 0 : m.cost(lv);
    const row = document.createElement('div'); row.className = 'mrow';
    row.innerHTML = `<div class="mi">${m.ic}</div><div class="mt"><b>${m.n}</b><span>${m.d}</span></div><div class="lv">${lv}/${m.max}</div>`;
    const b = document.createElement('button'); b.className = 'btn small'; b.textContent = maxed ? 'MAX' : cost + ' ◆'; b.disabled = maxed || save.essence < cost;
    b.addEventListener('click', () => { if (save.essence >= cost && !maxed) { save.essence -= cost; save.meta[m.id] = lv + 1; writeSave(); SFX('buy'); refreshMeta(); } });
    row.appendChild(b); up.appendChild(row);
  }
  const ar = $('tab-armory'); ar.innerHTML = '';
  for (const id in WEAPONS) {
    const w = WEAPONS[id], owned = save.weapons.includes(id);
    const row = document.createElement('div'); row.className = 'mrow';
    row.innerHTML = `<div class="mi">${w.ic}</div><div class="mt"><b>${w.name}</b><span>${w.desc}</span></div>`;
    const b = document.createElement('button'); b.className = 'btn small'; b.textContent = owned ? 'Acquise' : w.cost + ' ◆'; b.disabled = owned || save.essence < w.cost;
    b.addEventListener('click', () => { if (!owned && save.essence >= w.cost) { save.essence -= w.cost; save.weapons.push(id); writeSave(); SFX('relic'); refreshMeta(); } });
    row.appendChild(b); ar.appendChild(row);
  }
  const be = $('tab-bestiary'); be.innerHTML = '';
  for (const id in ETYPES) {
    const t = ETYPES[id], n = save.bestiary[id] || 0, lv = Math.min(5, Math.floor(n / 25));
    const row = document.createElement('div'); row.className = 'brow';
    row.innerHTML = `<b>${n > 0 ? t.name : '???'}</b><span>${n > 0 ? n + ' vaincus · +' + lv * 5 + ' % dégâts' : 'Jamais rencontré'}</span><div class="bar"><i style="width:${Math.min(100, (n % 25) / 25 * 100 || (lv >= 5 ? 100 : 0))}%"></i></div>`;
    be.appendChild(row);
  }
}
for (const tab of document.querySelectorAll('.tab')) tab.addEventListener('click', () => {
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t === tab);
  for (const id of ['upgrades', 'armory', 'bestiary']) $('tab-' + id).hidden = tab.dataset.tab !== id;
  SFX('click');
});
function bindVolume(id, key) {
  $(id).addEventListener('input', e => { save[key] = clamp(parseInt(e.target.value, 10) / 100, 0, 1); Audio.setVolumes(); for (const o of ['musicVol', 'musicVol2', 'sfxVol', 'sfxVol2']) if (o.startsWith(key === 'musicVol' ? 'music' : 'sfx')) $(o).value = e.target.value; });
  $(id).addEventListener('change', () => { writeSave(); SFX('click'); });
}
bindVolume('musicVol', 'musicVol'); bindVolume('musicVol2', 'musicVol'); bindVolume('sfxVol', 'sfxVol'); bindVolume('sfxVol2', 'sfxVol');
$('shakeOpt').addEventListener('input', e => { save.shakeAmt = parseInt(e.target.value, 10) / 100; writeSave(); });

/* choix générique */
function openChoice(o) {
  state = 'choice'; clearTouches(); keys.clear(); mouse.down = false;
  $('chTitle').textContent = o.title; $('chSub').textContent = o.sub || '';
  const box = $('chCards'); box.innerHTML = '';
  const render = () => {
    box.innerHTML = '';
    for (const c of o.cards) {
      const el = document.createElement('div'); el.className = 'card' + (c.cls ? ' ' + c.cls : '') + (c.disabled && c.disabled() ? ' disabled' : '');
      el.innerHTML = `<div class="ic">${c.ic}</div><div class="nm">${c.n}</div><div class="ds">${c.d}</div>${c.tag ? `<div class="tag">${typeof c.tag === 'function' ? c.tag() : c.tag}</div>` : ''}`;
      el.addEventListener('click', () => {
        if (c.disabled && c.disabled()) { SFX('deny'); return; }
        const keep = c.onPick(c);
        if (keep === true) render(); else closeChoice(c);
      });
      box.appendChild(el);
    }
  };
  render();
  const foot = $('chFooter'); foot.innerHTML = '';
  for (const f of (o.footer || [])) {
    const b = document.createElement('button'); b.className = 'btn' + (f.primary ? ' primary' : ''); b.textContent = f.label;
    b.addEventListener('click', () => { closeChoice(null); if (f.onClick) f.onClick(); });
    foot.appendChild(b);
  }
  choiceCb = o.onClose || null;
  show('choice');
}
let choiceCb = null;
function closeChoice(card) {
  hideAll(); state = 'play'; lastFrame = performance.now();
  const cb = choiceCb; choiceCb = null;
  if (cb) cb(card);
}

function goMenu() {
  state = 'menu'; document.body.classList.remove('playing');
  refreshMenu(); show('menu');
  if (Audio.ready) { Audio.play('menu'); Audio.setAmbience('drip'); Audio.setIntensity(0); }
}
function pauseGame() {
  if (state !== 'play') return;
  state = 'pause'; clearTouches(); keys.clear(); mouse.down = false;
  $('pauseInfo').textContent = `Étage ${G.floor} · ${G.floorData.biome.name} · graine ${G.seed}`;
  $('pauseRelics').textContent = (G.relics.length ? 'Reliques : ' + G.relics.map(r => r.ic + ' ' + r.n).join(', ') : 'Aucune relique pour l\'instant.') + (G.oath ? ' — ' + G.oath.ic + ' ' + G.oath.n : '');
  refreshMenu(); show('pause');
}
function resumeGame() { if (state !== 'pause') return; state = 'play'; hideAll(); lastFrame = performance.now(); Audio.resume(); }
$('playBtn').addEventListener('click', () => { uiAudio(); newRun(); });
$('metaBtn').addEventListener('click', () => { uiAudio(); refreshMeta(); show('meta'); });
$('metaBack').addEventListener('click', () => { SFX('click'); goMenu(); });
$('optBtn').addEventListener('click', () => { uiAudio(); refreshMenu(); show('options'); });
$('optBack').addEventListener('click', () => { SFX('click'); goMenu(); });
$('resetBtn').addEventListener('click', () => { if (confirm('Effacer toute la progression (essence, armes, bestiaire) ?')) { save = JSON.parse(JSON.stringify(DEFAULT_SAVE)); writeSave(); refreshMenu(); } });
$('resumeBtn').addEventListener('click', resumeGame);
$('quitBtn').addEventListener('click', () => { endRun(); goMenu(); });
$('retryBtn').addEventListener('click', () => { uiAudio(); newRun(); });
$('menuBtn').addEventListener('click', goMenu);
refreshMenu();
