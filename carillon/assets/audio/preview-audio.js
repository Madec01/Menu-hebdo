/* Moteur de la page de contrôle audio (agent B). Vanilla, sans oscillateur.
   Préfigure les contrats src/audio/ (§ 8) : bus, sampler, séquenceur à lookahead.
   Chemins : la page est dans assets/audio/, le manifeste liste des chemins relatifs à assets/. */
'use strict';
const ASSETS = '../';
const PROJECT = '../../';
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteToMidi = (n) => { const m = /^([A-G])(#?)(-?\d)$/.exec(n); return NOTES.indexOf(m[1] + m[2]) + 12 * (+m[3] + 1); };
const $ = (s) => document.querySelector(s);

// ---------------------------------------------------------------- moteur (bus, décodage)
let ctx, buses, lowpass, manifest;
const bufferCache = new Map();
function initAudio() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  lowpass = ctx.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 20000; lowpass.Q.value = 0.5;
  const master = ctx.createGain(); master.gain.value = 0.8;
  lowpass.connect(master); master.connect(ctx.destination);
  buses = { master };
  for (const name of ['music', 'sfx', 'ui']) { const g = ctx.createGain(); g.connect(lowpass); buses[name] = g; }
  buses.music.gain.value = 0.8; buses.sfx.gain.value = 0.9; buses.ui.gain.value = 0.9;
}
async function loadBuffer(url) {
  if (bufferCache.has(url)) return bufferCache.get(url);
  const p = fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); }).then(ab => ctx.decodeAudioData(ab));
  bufferCache.set(url, p);
  p.then(buf => bufferCache.set(url, buf));   // une fois décodé, le cache contient l'AudioBuffer lui-même
  return p;
}
function setLowpass(amount) { // 0 = ouvert (20 kHz), 1 = étouffé (~600 Hz), lissage 80 ms
  const f = 20000 * Math.pow(600 / 20000, amount);
  lowpass.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
  $('#lowpass-out').textContent = f >= 1000 ? (f / 1000).toFixed(1) + ' kHz' : Math.round(f) + ' Hz';
}

// ---------------------------------------------------------------- sampler
function createInstrument(def) {
  const files = def.files, pitched = def.kind === 'pitched';
  const notes = pitched ? Object.keys(files).map(n => ({ n, midi: noteToMidi(n), url: ASSETS + files[n], loop: def.loop && def.loop[n] })) : null;
  const last = {};
  async function load() {
    const urls = pitched ? notes.map(x => x.url) : Object.values(files).flat().map(f => ASSETS + f);
    await Promise.all(urls.map(loadBuffer));
  }
  function pick(noteOrKey) {
    if (pitched) {
      const midi = noteToMidi(noteOrKey);
      let best = notes[0];
      for (const s of notes) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
      return { url: best.url, rate: Math.pow(2, (midi - best.midi) / 12), loop: best.loop };
    }
    const list = files[noteOrKey]; if (!list) return null;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === last[noteOrKey]) i = (i + 1) % list.length;
    last[noteOrKey] = i;
    const f = list[i], name = f.split('/').pop().replace('.ogg', '');
    return { url: ASSETS + f, rate: 1, loop: def.loop && def.loop[name] };
  }
  function play(noteOrKey, at, { gain = 1, duration = null, bus = 'music', dest = null, pitchSemis = 0 } = {}) {
    const s = pick(noteOrKey); if (!s) return { stop() {} };
    const buf = bufferCache.get(s.url); if (!buf || typeof buf.then === 'function') return { stop() {} };
    const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = s.rate * Math.pow(2, pitchSemis / 12);
    if (s.loop && duration !== null) { src.loop = true; src.loopStart = s.loop[0]; src.loopEnd = s.loop[1]; }
    const env = ctx.createGain(); env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(gain, at + 0.006);
    src.connect(env); env.connect(dest || buses[bus]);
    src.start(at);
    const release = s.loop ? 0.12 : 0.03;
    function stop(when) { // relâchement ≥ 30 ms (120 ms pour les tenues bouclées) : jamais de coupure sèche
      const t = Math.max(when, ctx.currentTime, at + 0.006);
      env.gain.cancelScheduledValues(t); env.gain.setValueAtTime(gain, t); env.gain.linearRampToValueAtTime(0, t + release); src.stop(t + release + 0.01);
    }
    if (duration !== null) stop(at + duration); else if (!s.loop) src.stop(at + buf.duration / src.playbackRate.value + 0.05);
    return { stop };
  }
  return { load, play, def };
}
const instruments = {};
async function getInstrument(id) {
  if (!instruments[id]) { instruments[id] = createInstrument(manifest.samples[id]); await instruments[id].load(); }
  return instruments[id];
}

// ---------------------------------------------------------------- bruitages
const sfxLast = {};
async function playSfx(id, { bus = null, at = null } = {}) {
  const e = manifest.sfx[id]; const list = e.files;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && i === sfxLast[id]) i = (i + 1) % list.length;
  sfxLast[id] = i;
  const buf = await loadBuffer(ASSETS + list[i]);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const pv = e.pitchVar ?? 0.08; src.playbackRate.value = 1 + (Math.random() * 2 - 1) * pv;
  const g = ctx.createGain(); g.gain.value = e.gain ?? 1;
  src.connect(g); g.connect(buses[bus || e.bus || 'sfx']); src.start(at ?? ctx.currentTime);
  return buf.duration;
}
const ambLoops = {};
async function toggleAmbience(id, btn) {
  if (ambLoops[id]) { const { src, g } = ambLoops[id]; g.gain.setTargetAtTime(0, ctx.currentTime, 0.3); src.stop(ctx.currentTime + 1.5); delete ambLoops[id]; btn.classList.remove('on'); return; }
  const e = manifest.sfx[id]; const buf = await loadBuffer(ASSETS + e.files[0]);
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = 0; src.loopEnd = buf.duration;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(e.gain ?? 0.5, ctx.currentTime + 1.5);
  src.connect(g); g.connect(buses.sfx); src.start();
  ambLoops[id] = { src, g }; btn.classList.add('on');
}

// ---------------------------------------------------------------- séquenceur (la Mesure)
const seq = { running: false, score: null, startAt: 0, beatDur: 0, nextEvent: 0, events: [], layerGains: {}, tier: 0, timer: null, loops: 0 };
const LOOKAHEAD = 0.12, TICK_MS = 25;
function flattenScore(score) { // événements absolus (en temps) sur une boucle de `bars` mesures
  const ev = [];
  for (const [li, layer] of score.layers.entries()) {
    for (const e of layer.events || []) ev.push({ li, beat: e.bar * score.beatsPerBar + e.beat, note: e.note, dur: e.dur, gain: e.gain ?? 1 });
    if (layer.pattern) {
      const rep = layer.repeatBars || 1, stepBeats = score.beatsPerBar * rep / layer.pattern.steps;
      for (let bar = 0; bar < score.bars; bar += rep) for (const [key, step, g] of layer.pattern.hits) ev.push({ li, beat: bar * score.beatsPerBar + step * stepBeats, note: key, dur: null, gain: g });
    }
  }
  return ev.sort((a, b) => a.beat - b.beat);
}
async function playTrack(id) {
  stopTrack();
  const score = await fetch(PROJECT + manifest.tracks[id].score).then(r => r.json());
  await Promise.all(score.layers.map(l => getInstrument(l.instrument)));
  seq.score = score; seq.events = flattenScore(score); seq.beatDur = 60 / score.bpm; seq.loopBeats = score.bars * score.beatsPerBar;
  seq.layerGains = {};
  for (const [li, layer] of score.layers.entries()) {
    const g = ctx.createGain(); g.gain.value = layer.tier <= seq.tier ? layer.gain : 0; g.connect(buses.music); seq.layerGains[li] = g;
  }
  seq.startAt = ctx.currentTime + 0.1; seq.nextEvent = 0; seq.loops = 0; seq.running = true;
  $('#bpm').textContent = score.bpm; $('#trackinfo').textContent = `${score.title} — ${score.key} ${score.mode || ''}, ${score.bars} mesures, ${score.status}`;
  renderLayers();
  tick();
}
function tick() { // planifie tout ce qui tombe dans [now, now + lookahead], puis se réarme (setTimeout, jamais setInterval)
  if (!seq.running) return;
  const horizon = ctx.currentTime + LOOKAHEAD;
  while (true) {
    const e = seq.events[seq.nextEvent];
    const at = seq.startAt + (seq.loops * seq.loopBeats + e.beat) * seq.beatDur;
    if (at > horizon) break;
    const layer = seq.score.layers[e.li], inst = instruments[layer.instrument];
    inst.play(e.note, at, { gain: e.gain, duration: e.dur === null ? null : e.dur * seq.beatDur, dest: seq.layerGains[e.li] });
    seq.nextEvent++;
    if (seq.nextEvent >= seq.events.length) { seq.nextEvent = 0; seq.loops++; }
  }
  seq.timer = setTimeout(tick, TICK_MS);
}
function stopTrack() {
  if (!seq.running) return;
  seq.running = false; clearTimeout(seq.timer);
  for (const g of Object.values(seq.layerGains)) { g.gain.setTargetAtTime(0, ctx.currentTime, 0.25); setTimeout(() => g.disconnect(), 1500); }
  seq.layerGains = {};
}
function setTier(t) { // crossfade 200 ms par couche, jamais de coupure sèche
  seq.tier = t;
  document.querySelectorAll('#tiers button').forEach(b => b.classList.toggle('on', +b.dataset.tier === t));
  if (!seq.score) return;
  for (const [li, layer] of seq.score.layers.entries()) seq.layerGains[li].gain.setTargetAtTime(layer.tier <= t ? layer.gain : 0, ctx.currentTime, 0.2 / 3);
  renderLayers();
}
function renderLayers() {
  $('#layers').innerHTML = seq.score.layers.map(l => `<span class="${l.tier <= seq.tier ? 'live' : ''}"><em>${l.name}</em><i>${l.instrument} · cran ${l.tier}</i></span>`).join('');
}
function judge(inputAt) { // fenêtre ±110 ms (« bon »), ±37 ms (« parfait »)
  const beats = (inputAt - seq.startAt) / seq.beatDur, nearest = Math.round(beats);
  const offsetMs = (beats - nearest) * seq.beatDur * 1000, a = Math.abs(offsetMs);
  return { grade: a <= 110 / 3 ? 'parfait' : a <= 110 ? 'bon' : 'raté', offsetMs };
}
function metronomeFrame() { // métronome visuel : lit le temps audio, jamais un timer
  if (seq.running && ctx) {
    const beats = (ctx.currentTime - seq.startAt) / seq.beatDur;
    if (beats >= 0) {
      const phase = beats - Math.floor(beats), idx = Math.floor(beats) % seq.score.beatsPerBar;
      const glow = Math.pow(1 - phase, 3);
      const halo = $('#halo'); halo.style.setProperty('--glow', glow.toFixed(3)); halo.style.transform = `scale(${1 + 0.12 * glow})`;
      halo.style.boxShadow = `0 0 ${20 + 50 * glow}px rgba(201,151,63,${0.15 + 0.45 * glow})`;
      document.querySelectorAll('#beats i').forEach((d, i) => d.classList.toggle('on', i === idx));
      $('#bar').textContent = Math.floor(beats / seq.score.beatsPerBar) % seq.score.bars + 1; $('#beat').textContent = idx + 1;
    }
  }
  requestAnimationFrame(metronomeFrame);
}

// ---------------------------------------------------------------- interface
const MANDATORY = new Set(['hit_light', 'hit_heavy', 'hit_crit', 'enemy_die', 'enemy_die_big', 'boss_hit', 'boss_roar', 'player_step', 'player_hurt', 'player_death', 'dash', 'parry_ok', 'parry_miss', 'resonance_1', 'resonance_2', 'resonance_3', 'resonance_4', 'resonance_drop', 'level_up', 'card_flip', 'card_pick', 'xp_pickup', 'xp_pickup_big', 'bell_minute', 'bell_tier', 'silence_cry', 'silence_burst', 'ui_move', 'ui_confirm', 'ui_cancel', 'weapon_battant', 'weapon_clarine', 'weapon_bourdon', 'weapon_grelots', 'weapon_tocsin', 'weapon_cor', 'weapon_crecelle', 'weapon_chaine', 'weapon_diapason', 'fusion', 'achievement', 'lore_unlock', 'victory_bell', 'moment_start', 'pickup']);
const GROUPS = [['Combat', /^(hit_|enemy_|boss_)/], ['Joueur & rythme', /^(player_|dash|parry_|resonance_)/], ['Timbres (armes)', /^weapon_/], ['Progression & UI', /^(level_up|card_|xp_|fusion|achievement|lore_|ui_|victory)/], ['La nuit et le Silence', /^(bell_|silence_)/]];
function buildSfx() {
  const ids = Object.keys(manifest.sfx).filter(id => manifest.sfx[id].kind !== 'ambience');
  const used = new Set(); let html = '';
  for (const [title, re] of GROUPS.concat([['Autres', /./]])) {
    const sel = ids.filter(id => !used.has(id) && re.test(id)); if (!sel.length) continue;
    sel.forEach(id => used.add(id));
    html += `<h3>${title}</h3><div class="grid">` + sel.map(id => { const e = manifest.sfx[id]; return `<button data-sfx="${id}" class="${MANDATORY.has(id) ? 'mandatory' : ''}" title="${(e.note || '').replace(/"/g, '&quot;')}">${id}<small>${e.files.length} variante${e.files.length > 1 ? 's' : ''} · gain ${e.gain}</small></button>`; }).join('') + '</div>';
  }
  $('#sfx').innerHTML = html;
  $('#sfx').addEventListener('click', async (ev) => { const b = ev.target.closest('button[data-sfx]'); if (!b) return; b.classList.add('playing'); const d = await playSfx(b.dataset.sfx); setTimeout(() => b.classList.remove('playing'), Math.min(2000, d * 1000)); });
  const amb = Object.keys(manifest.sfx).filter(id => manifest.sfx[id].kind === 'ambience');
  $('#amb').innerHTML = amb.map(id => `<button data-amb="${id}" title="${manifest.sfx[id].note || ''}">${id.replace('ambience_', '')} <small>· ${Math.round(manifest.sfx[id].loop[1])} s</small></button>`).join('');
  $('#amb').addEventListener('click', (ev) => { const b = ev.target.closest('button[data-amb]'); if (b) toggleAmbience(b.dataset.amb, b); });
}
function buildInstruments() {
  const holds = new Map();
  $('#inst').innerHTML = Object.entries(manifest.samples).map(([id, d]) => {
    const keys = d.kind === 'pitched'
      ? Object.keys(d.files).sort((a, b) => noteToMidi(a) - noteToMidi(b)).map(n => `<button data-inst="${id}" data-key="${n}" class="${d.loop && d.loop[n] ? 'loop' : ''}">${n}</button>`).join('')
      : Object.entries(d.files).map(([k, v]) => `<button data-inst="${id}" data-key="${k}" class="${d.loop && Object.keys(d.loop).some(n => n.startsWith(k + '_')) ? 'loop' : ''}">${k} ×${v.length}</button>`).join('');
    const n = Object.values(d.files).flat().length;
    return `<div class="inst"><div class="name">${id}<small>${d.kind} · ${n} fichiers · ${d.credit}${d.note ? '<br>' + d.note : ''}</small></div><div class="keys">${keys}</div></div>`;
  }).join('');
  $('#inst').addEventListener('pointerdown', async (ev) => {
    const b = ev.target.closest('button[data-inst]'); if (!b) return;
    const inst = await getInstrument(b.dataset.inst); b.classList.add('playing');
    const v = inst.play(b.dataset.key, ctx.currentTime, { gain: 0.9, duration: b.classList.contains('loop') ? 30 : null, bus: 'music' });
    holds.set(b, v);
  });
  const release = (ev) => { const b = ev.target.closest && ev.target.closest('button[data-inst]'); for (const [btn, v] of holds) { if (!b || btn === b || ev.type === 'pointerup') { v.stop(ctx.currentTime); btn.classList.remove('playing'); holds.delete(btn); } } };
  window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
}
function buildStats() {
  const nS = Object.values(manifest.samples).reduce((a, d) => a + Object.values(d.files).flat().length, 0);
  const sfxIds = Object.keys(manifest.sfx).filter(id => manifest.sfx[id].kind !== 'ambience');
  const nF = sfxIds.reduce((a, id) => a + manifest.sfx[id].files.length, 0);
  const missing = [...MANDATORY].filter(id => !manifest.sfx[id]);
  $('#stats').innerHTML = `<b>${Object.keys(manifest.samples).length}</b> instruments · <b>${nS}</b> échantillons<br><b>${sfxIds.length}</b> bruitages · <b>${nF}</b> fichiers · obligatoires ${missing.length ? 'manquants : ' + missing.join(', ') : 'tous présents'}<br><b>${Object.keys(manifest.tracks).length}</b> pistes · ${Object.values(manifest.tracks).filter(t => t.status === 'complete').length} complètes`;
}
async function main() {
  manifest = await fetch('manifest.json').then(r => r.json());
  buildStats(); buildSfx(); buildInstruments();
  const sel = $('#track'); sel.innerHTML = Object.entries(manifest.tracks).map(([id, t]) => `<option value="${id}">${id} — ${t.bpm} BPM (${t.status})</option>`).join(''); sel.value = 'cendrelune';
  $('#unlock').addEventListener('click', async () => {
    initAudio(); await ctx.resume(); $('#unlock').classList.add('gone');
    await loadBuffer(ASSETS + manifest.sfx.bell_minute.files[0]); playSfx('bell_minute');
    requestAnimationFrame(metronomeFrame);
  }, { once: true });
  $('#play').addEventListener('click', () => playTrack(sel.value));
  $('#stop').addEventListener('click', stopTrack);
  sel.addEventListener('change', () => { if (seq.running) playTrack(sel.value); });
  $('#tiers').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) setTier(+b.dataset.tier); });
  $('#lowpass').addEventListener('input', (ev) => setLowpass(+ev.target.value));
  for (const bus of ['music', 'sfx']) $('#vol-' + bus).addEventListener('input', (ev) => { buses[bus].gain.setTargetAtTime(+ev.target.value, ctx.currentTime, 0.02); $('#vol-' + bus + '-out').textContent = (+ev.target.value).toFixed(2); });
  window.addEventListener('keydown', (ev) => {
    if (ev.repeat || ev.target.tagName === 'SELECT' || ev.target.tagName === 'INPUT') return;
    if (ev.code === 'Space' && seq.running) { ev.preventDefault(); const j = judge(ctx.currentTime); const el = $('#judge'); el.textContent = `${j.grade} (${j.offsetMs > 0 ? '+' : ''}${j.offsetMs.toFixed(0)} ms)`; el.classList.toggle('rate', j.grade === 'raté'); playSfx(j.grade === 'raté' ? 'parry_miss' : 'parry_ok'); if (j.grade !== 'raté' && seq.tier < 3) setTier(seq.tier + 1); if (j.grade === 'raté' && seq.tier > 0) setTier(seq.tier - 1); }
    if (ev.key >= '1' && ev.key <= '4') setTier(+ev.key - 1);
  });
}
main().catch(e => { $('#stats').textContent = 'Erreur : ' + e.message; console.error(e); });
