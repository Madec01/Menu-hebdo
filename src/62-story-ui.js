/* ---------- récit : écrans, stèles, arrivées ---------- */
OVS.push('story');
let storyQueue = [], storyCb = null, storyPrevState = 'menu';
function showStory(screens, cb) {
  storyQueue = screens.slice(); storyCb = cb || null;
  storyPrevState = state === 'play' ? 'play' : state;
  if (state === 'play') { state = 'choice'; clearTouches(); keys.clear(); mouse.down = false; }
  storyNext();
}
function storyNext() {
  const s = storyQueue.shift();
  if (!s) {
    hideAll();
    if (storyPrevState === 'play') { state = 'play'; lastFrame = performance.now(); }
    const cb = storyCb; storyCb = null; if (cb) cb();
    return;
  }
  $('stTitle').textContent = s.title; $('stText').textContent = s.text;
  $('stNext').textContent = storyQueue.length ? 'Continuer' : (storyPrevState === 'play' ? 'Reprendre' : 'Descendre');
  show('story');
}
$('stNext').addEventListener('click', () => { SFX('click'); storyNext(); });
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
  const total = STORY.tablets.length, read = save.tabletsRead.length;
  openChoice({ title: 'Stèle gravée', sub: '« ' + t.text + ' »' + '   —   fragment ' + read + ' / ' + total, cards: [], footer: [{ label: 'Refermer', primary: true }] });
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
