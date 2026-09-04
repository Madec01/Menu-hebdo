// Audio manager (Web Audio): music with crossfade, layered ambience, pooled SFX with random variations.
window.Audio2 = (function () {
  let ctx = null, master, musicBus, sfxBus, ambBus;
  const buffers = {};
  const loading = {};
  let current = null; // { src, gain, name }
  let ambLayers = {};
  let vol = { music: 0.7, sfx: 0.9, ambience: 0.6 };
  let muted = false;
  const lastPlayed = {};

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.connect(master);
    applyVolumes();
    return ctx;
  }
  function unlock() { ensure(); if (ctx.state === 'suspended') ctx.resume(); }
  function applyVolumes() {
    if (!ctx) return;
    musicBus.gain.value = muted ? 0 : vol.music * vol.music;
    sfxBus.gain.value = muted ? 0 : vol.sfx;
    ambBus.gain.value = muted ? 0 : vol.ambience;
  }
  function setVolumes(v) { Object.assign(vol, v); applyVolumes(); }
  function setMuted(m) { muted = m; applyVolumes(); }

  function load(name, url) {
    if (buffers[name]) return Promise.resolve(buffers[name]);
    if (loading[name]) return loading[name];
    ensure();
    loading[name] = fetch(url).then(r => r.arrayBuffer()).then(ab => ctx.decodeAudioData(ab)).then(b => { buffers[name] = b; delete loading[name]; return b; })
      .catch(e => { console.warn('audio load failed', name, url, e); delete loading[name]; return null; });
    return loading[name];
  }
  function loadAll(map, onProgress) {
    const names = Object.keys(map); let done = 0;
    return Promise.all(names.map(n => load(n, map[n]).then(() => { done++; if (onProgress) onProgress(done / names.length); })));
  }

  // ---- SFX ----
  function sfx(name, opts = {}) {
    if (!ctx || muted) return;
    // name may be an array of variants or a prefix with numbered variants registered as name_1..N
    let key = name;
    if (Array.isArray(name)) key = name[Math.floor(Math.random() * name.length)];
    else if (!buffers[key]) {
      const variants = Object.keys(buffers).filter(k => k.startsWith(name + '_'));
      if (variants.length) key = variants[Math.floor(Math.random() * variants.length)];
    }
    const buf = buffers[key];
    if (!buf) return;
    const now = ctx.currentTime;
    const minGap = opts.minGap != null ? opts.minGap : 0.03;
    if (lastPlayed[key] && now - lastPlayed[key] < minGap) return;
    lastPlayed[key] = now;
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = (opts.rate || 1) * (1 + (Math.random() * 2 - 1) * (opts.detune != null ? opts.detune : 0.06));
    const g = ctx.createGain();
    let v = (opts.volume != null ? opts.volume : 1);
    if (opts.dist != null) { v *= Math.max(0, 1 - opts.dist / (opts.range || 900)); if (v <= 0.02) return; }
    g.gain.value = v;
    let node = src;
    if (opts.pan != null && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, opts.pan)); node.connect(p); node = p; }
    node.connect(g); g.connect(sfxBus);
    if (opts.offset) src.start(0, opts.offset, opts.duration); else src.start(0);
    return src;
  }

  // ---- Music ----
  function playMusic(name, opts = {}) {
    if (!ctx) return;
    if (current && current.name === name) return;
    const fade = opts.fade != null ? opts.fade : 1.5;
    const buf = buffers[name];
    if (current) { const old = current; const t = ctx.currentTime; old.gain.gain.cancelScheduledValues(t); old.gain.gain.setValueAtTime(old.gain.gain.value, t); old.gain.gain.linearRampToValueAtTime(0, t + fade); setTimeout(() => { try { old.src.stop(); } catch (e) { } }, fade * 1000 + 100); current = null; }
    if (!buf) { current = null; return; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = opts.loop !== false;
    if (opts.loopStart != null) { src.loopStart = opts.loopStart; src.loopEnd = opts.loopEnd || buf.duration; }
    const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(musicBus);
    src.start(0, opts.offset || 0);
    const t = ctx.currentTime; g.gain.linearRampToValueAtTime(opts.volume != null ? opts.volume : 1, t + fade);
    current = { src, gain: g, name };
    src.onended = () => { if (current && current.src === src && !src.loop) { current = null; if (opts.onEnd) opts.onEnd(); } };
  }
  function stopMusic(fade = 1.0) { playMusic('__none__', { fade }); }
  function duck(amount, time = 0.3) { if (!ctx || !current) return; const t = ctx.currentTime; current.gain.gain.cancelScheduledValues(t); current.gain.gain.setValueAtTime(current.gain.gain.value, t); current.gain.gain.linearRampToValueAtTime(amount, t + time); }
  function currentMusic() { return current ? current.name : null; }

  // ---- Ambience layers (looping, individually faded) ----
  function ambience(name, target, fade = 2.0) {
    if (!ctx) return;
    let L = ambLayers[name];
    if (!L) {
      const buf = buffers[name]; if (!buf) return;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(ambBus); src.start(0, Math.random() * buf.duration);
      L = ambLayers[name] = { src, gain: g };
    }
    const t = ctx.currentTime; L.gain.gain.cancelScheduledValues(t); L.gain.gain.setValueAtTime(L.gain.gain.value, t); L.gain.gain.linearRampToValueAtTime(target, t + fade);
    if (target <= 0) { const old = L; delete ambLayers[name]; setTimeout(() => { try { old.src.stop(); } catch (e) { } }, fade * 1000 + 100); }
  }
  function stopAllAmbience(fade = 1.5) { for (const n of Object.keys(ambLayers)) ambience(n, 0, fade); }

  return { ensure, unlock, load, loadAll, sfx, playMusic, stopMusic, duck, currentMusic, ambience, stopAllAmbience, setVolumes, setMuted, has: (n) => !!buffers[n], get ctx() { return ctx; } };
})();
