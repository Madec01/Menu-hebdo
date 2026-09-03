/* ---------- menu de test ---------- */
OVS.push('debug');
let debugReturn = 'menu';
const DBG = { god: false, voile: false, surge: false };
function openDebug(from) {
  debugReturn = from; SFX('click');
  $('dbgFloor').value = G ? G.floor : 1;
  const sel = $('dbgWeapon'); sel.innerHTML = '';
  for (const id in WEAPONS) { const o = document.createElement('option'); o.value = id; o.textContent = WEAPONS[id].ic + ' ' + WEAPONS[id].name; if (P && P.weapon === id) o.selected = true; sel.appendChild(o); }
  $('dbgGod').checked = DBG.god; $('dbgVoile').checked = DBG.voile; $('dbgSurge').checked = DBG.surge;
  const inRun = !!(G && P && state !== 'dead');
  for (const id of ['dbgBoss', 'dbgTreasure', 'dbgSealed', 'dbgCross', 'dbgRelics', 'dbgHeal']) $(id).disabled = !inRun;
  $('dbgInfo').textContent = inRun ? `Partie en cours : étage ${G.floor}, ${G.floorData.biome.name}, ${G.world === 'envers' ? 'Envers' : 'monde de pierre'}.` : 'Aucune partie en cours : « Lancer » démarre une nouvelle descente à l\'étage choisi.';
  show('debug');
}
function debugResume() { if (debugReturn === 'pause') show('pause'); else if (G && P && state === 'pause') show('pause'); else goMenu(); }
function debugApplyFlags() { DBG.god = $('dbgGod').checked; DBG.voile = $('dbgVoile').checked; DBG.surge = $('dbgSurge').checked; if (P) P.god = DBG.god; }
function debugGoto(pred, label) {
  if (!G) return;
  const r = G.floorData.list.find(pred);
  if (!r) { $('dbgInfo').textContent = 'Pas de ' + label + ' sur cet étage.'; SFX('deny'); return; }
  if (G.world === 'envers') crossWorld(false);
  r.visited = true;
  enterRoom(r, null);
  hideAll(); state = 'play'; lastFrame = performance.now();
}
$('dbgLaunch').addEventListener('click', () => {
  debugApplyFlags();
  const f = clamp(parseInt($('dbgFloor').value, 10) || 1, 1, 40);
  const w = $('dbgWeapon').value;
  uiAudio();
  save.introSeen = true; writeSave();
  newRun();
  P.weapon = w; P.god = DBG.god;
  if (f !== 1) { G.floor = f; startFloor(); }
});
$('dbgBoss').addEventListener('click', () => debugGoto(r => r.type === 'boss', 'boss'));
$('dbgTreasure').addEventListener('click', () => debugGoto(r => r.type === 'treasure' && !r.sealed, 'coffre'));
$('dbgSealed').addEventListener('click', () => debugGoto(r => r.sealed, 'salle scellée'));
$('dbgCross').addEventListener('click', () => { if (!G) return; G.voile = 100; crossWorld(false); hideAll(); state = 'play'; lastFrame = performance.now(); });
$('dbgRelics').addEventListener('click', () => { if (!G) return; for (const r of relicChoices(3)) applyRelic(r, true); SFX('relic'); $('dbgInfo').textContent = 'Reliques : ' + G.relics.map(r => r.ic).join(' '); });
$('dbgHeal').addEventListener('click', () => { if (!P) return; P.hp = P.maxHp; G.surge = 100; G.voile = 100; SFX('heart'); });
$('dbgEssence').addEventListener('click', () => { save.essence += 500; writeSave(); SFX('coin'); $('dbgInfo').textContent = 'Essence : ' + save.essence + ' ◆'; });
$('dbgUnlock').addEventListener('click', () => { save.weapons = Object.keys(WEAPONS); for (const m of META) save.meta[m.id] = m.max; writeSave(); SFX('relic'); $('dbgInfo').textContent = 'Armes et bénédictions débloquées.'; });
for (const id of ['dbgGod', 'dbgVoile', 'dbgSurge']) $(id).addEventListener('change', debugApplyFlags);
$('dbgBack').addEventListener('click', () => { SFX('click'); debugResume(); });
$('debugBtn').addEventListener('click', () => { uiAudio(); openDebug('options'); });
$('debugBtn2').addEventListener('click', () => openDebug('pause'));
function debugTick() {
  if (!G || !P) return;
  if (DBG.voile) G.voile = 100;
  if (DBG.surge) G.surge = 100;
}
