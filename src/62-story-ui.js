/* ---------- récit : écrans cinématiques, stèles, arrivées ---------- */
OVS.push('story');
const Cine = { queue: [], cb: null, prev: 'menu', typing: null, full: '', pos: 0, timer: 0, done: false };
function showStory(screens, cb) {
  Cine.queue = screens.slice(); Cine.cb = cb || null;
  Cine.prev = state === 'play' ? 'play' : state;
  if (state === 'play') { state = 'choice'; clearTouches(); keys.clear(); mouse.down = false; }
  storyNext();
}
function storyNext() {
  const s = Cine.queue.shift();
  if (Cine.typing) { clearInterval(Cine.typing); Cine.typing = null; }
  if (!s) {
    hideAll();
    if (Cine.prev === 'play') { state = 'play'; lastFrame = performance.now(); }
    const cb = Cine.cb; Cine.cb = null; if (cb) cb();
    return;
  }
  const box = $('storyBox'), title = $('stTitle'), text = $('stText'), h = $('stHint');
  box.className = 'cine' + (s.stele ? ' stele' : '');
  title.textContent = s.title || ''; title.classList.remove('show'); text.textContent = ''; h.classList.remove('show');
  $('stMeta').textContent = s.meta || '';
  show('story');
  requestAnimationFrame(() => title.classList.add('show'));
  Cine.full = s.text; Cine.pos = 0; Cine.done = false;
  const speed = s.stele ? 22 : 28;
  let wait = 380;
  Cine.typing = setInterval(() => {
    if (wait > 0) { wait -= speed; return; }
    if (Cine.pos >= Cine.full.length) { storyTypedDone(); return; }
    const ch = Cine.full[Cine.pos++];
    text.textContent = Cine.full.slice(0, Cine.pos);
    if ('.!?…'.includes(ch)) wait = 320; else if (',;:'.includes(ch)) wait = 140;
    if (Cine.pos % 3 === 0 && Audio.ready) SFX('type');
  }, speed);
}
function storyTypedDone() {
  if (Cine.typing) { clearInterval(Cine.typing); Cine.typing = null; }
  $('stText').textContent = Cine.full; Cine.done = true;
  $('stHint').textContent = Cine.queue.length ? '▸ toucher pour continuer' : (Cine.prev === 'play' ? '▸ toucher pour reprendre' : '▸ toucher pour descendre');
  $('stHint').classList.add('show');
}
function storyAdvance() { if (!Cine.done) storyTypedDone(); else { SFX('click'); storyNext(); } }
$('story').addEventListener('click', storyAdvance);
$('story').addEventListener('touchend', e => { e.preventDefault(); storyAdvance(); }, { passive: false });
window.addEventListener('keydown', e => { if ($('story').classList.contains('show') && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); storyAdvance(); } });
$('introBtn').addEventListener('click', () => { uiAudio(); showStory(STORY.intro, () => goMenu()); });

function storyArrival(biome) {
  const seen = save.biomesSeen.includes(biome.id);
  if (!seen) { save.biomesSeen.push(biome.id); writeSave(); }
  const lines = STORY.biomes[biome.id] || [];
  const t = lines[seen ? 1 : 0] || lines[0];
  if (t) hint = { t, life: 7 };
}
function readTablet(pr) {
  const biome = G.floorData.biome;
  const unread = STORY.tablets.filter(t => t.floorMin <= G.floor && !save.tabletsRead.includes(t.id) && (!t.biome || t.biome === biome.id));
  const pool = unread.length ? unread : STORY.tablets.filter(t => t.floorMin <= G.floor);
  const t = unread.length ? unread[0] : pool[Math.floor(Math.random() * pool.length)];
  if (!t) return;
  if (!save.tabletsRead.includes(t.id)) { save.tabletsRead.push(t.id); writeSave(); }
  pr.used = true; SFX('relic'); burst(pr.x, pr.y - 10, 12, '#dff4ff', 90, { shape: 'dot', glow: 1 });
  showStory([{ title: 'Stèle gravée', text: t.text, stele: true, meta: 'fragment ' + save.tabletsRead.length + ' / ' + STORY.tablets.length }]);
}
function drawTablet(pr, tk) {
  const { x, y } = pr;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 14, 5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4d4768'; ctx.fillRect(x - 10, y - 18, 20, 30);
  ctx.fillStyle = '#6b6488'; ctx.fillRect(x - 10, y - 18, 20, 3); ctx.fillRect(x - 10, y - 18, 3, 30);
  ctx.fillStyle = pr.used ? '#8a84a8' : '#dff4ff';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 6, y - 12 + i * 6, 6 + (i % 2) * 5, 2);
  if (!pr.used) { ctx.strokeStyle = 'rgba(223,244,255,' + (0.35 + 0.3 * Math.sin(tk * 3 + x)) + ')'; ctx.lineWidth = 2; ctx.strokeRect(x - 12, y - 20, 24, 34); }
}
