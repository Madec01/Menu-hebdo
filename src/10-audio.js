/* ---------- moteur audio : musique adaptative, ambiances, bruitages ---------- */
const Audio = (() => {
  let ac = null, master, musicBus, sfxBus, revIn, noiseBuf;
  const layers = {};
  const samples = {};          // sons Kenney décodés
  const pluckCache = new Map();
  const waves = {};
  let amb = null, dripT = 0;
  const M = { id: null, tpl: null, nextT: 0, step: 0, bar: 0, intensity: 0, targetInt: 0, rand: Math.random, fadeGain: null, voicing: null, phrase: 0 };

  function init() {
    if (ac) return true;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ac.createGain();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ac.destination);
    musicBus = ac.createGain(); sfxBus = ac.createGain(); musicBus.connect(master); sfxBus.connect(master);
    const conv = ac.createConvolver(); conv.buffer = makeIR(3.2, 2.4);
    revIn = ac.createGain(); revIn.connect(conv);
    const revOut = ac.createGain(); revOut.gain.value = 0.6; conv.connect(revOut); revOut.connect(master);
    noiseBuf = makeNoise(2);
    M.fadeGain = ac.createGain();
    M.filter = ac.createBiquadFilter(); M.filter.type = 'lowpass'; M.filter.frequency.value = 18000; M.filter.Q.value = 0.5;
    M.fadeGain.connect(M.filter); M.filter.connect(musicBus);
    for (const l of ['pad', 'bass', 'arp', 'lead', 'drums', 'amb']) {
      layers[l] = ac.createGain(); layers[l].gain.value = (l === 'bass' || l === 'drums') ? 0 : 1;
      layers[l].connect(l === 'amb' ? musicBus : M.fadeGain);
    }
    // formes d'onde à harmoniques (cordes frottées, hautbois)
    const mk = (n, f) => { const re = new Float32Array(n + 1), im = new Float32Array(n + 1); for (let i = 1; i <= n; i++) im[i] = f(i); return ac.createPeriodicWave(re, im, { disableNormalization: false }); };
    waves.strings = mk(14, i => 1 / Math.pow(i, 1.25));
    waves.oboe = mk(12, i => (i % 2 ? 1 : 0.35) / Math.pow(i, 0.9));
    waves.organ = mk(8, i => [1, 0.6, 0.3, 0.5, 0.15, 0.1, 0.05, 0.1][i - 1]);
    setVolumes();
    decodeSamples();
    return true;
  }
  function decodeSamples() {
    for (const name in ASSETS.sfx) {
      try {
        const b64 = ASSETS.sfx[name].split(',')[1], bin = atob(b64), arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        ac.decodeAudioData(arr.buffer.slice(0), buf => { samples[name] = buf; }, () => {});
      } catch (e) {}
    }
  }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }
  function setVolumes() {
    if (!ac) return;
    musicBus.gain.setTargetAtTime(save.musicVol * 0.6, ac.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(save.sfxVol * 0.8, ac.currentTime, 0.05);
  }
  function makeIR(dur, decay) {
    const rate = ac.sampleRate, len = Math.floor(rate * dur), buf = ac.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 400 ? i / 400 : 1); }
    return buf;
  }
  function makeNoise(dur) {
    const rate = ac.sampleRate, len = rate * dur, buf = ac.createBuffer(1, len, rate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function sendRev(node, amt) { if (!amt) return; const g = ac.createGain(); g.gain.value = amt; node.connect(g); g.connect(revIn); }

  /* ---------- voix génériques ---------- */
  function voice(o) {
    const t = o.t, dur = o.dur, vel = o.vel == null ? 0.5 : o.vel, a = o.a == null ? 0.01 : o.a, d = o.d == null ? 0.1 : o.d, s = o.s == null ? 0.7 : o.s, r = o.r == null ? 0.2 : o.r;
    const osc = ac.createOscillator();
    if (o.wave) osc.setPeriodicWave(o.wave); else osc.type = o.type || 'triangle';
    osc.frequency.value = o.freq; if (o.detune) osc.detune.value = o.detune;
    const end = t + Math.max(a + d, dur) + r;
    if (o.slide) { osc.frequency.setValueAtTime(o.freq, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq * o.slide), t + dur); }
    if (o.fm) {
      const mod = ac.createOscillator(); mod.frequency.value = o.freq * (o.fmRatio || 2);
      const mg = ac.createGain(); mg.gain.setValueAtTime(o.freq * (o.fmDepth || 1), t); mg.gain.exponentialRampToValueAtTime(o.freq * 0.02, t + Math.max(0.05, dur * 0.8 + d));
      mod.connect(mg); mg.connect(osc.frequency); mod.start(t); mod.stop(end + 0.05);
    }
    if (o.vib) {
      const l = ac.createOscillator(); l.frequency.value = o.vibRate || 5;
      const lg = ac.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib, t + (o.vibDelay || 0.3));
      l.connect(lg); lg.connect(osc.detune); l.start(t); l.stop(end + 0.05);
    }
    let node = osc;
    if (o.cutoff) {
      const f = ac.createBiquadFilter(); f.type = o.ftype || 'lowpass'; f.Q.value = o.q || 0.7;
      f.frequency.setValueAtTime(o.cutoff * (o.fenv || 1), t);
      if (o.fenv) f.frequency.exponentialRampToValueAtTime(o.cutoff, t + Math.max(0.02, o.fdec || d));
      node.connect(f); node = f;
    }
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + a); g.gain.linearRampToValueAtTime(vel * s + 0.0001, t + a + d);
    g.gain.setValueAtTime(vel * s + 0.0001, t + Math.max(a + d, dur)); g.gain.exponentialRampToValueAtTime(0.0001, end);
    node.connect(g);
    let out = g;
    if (o.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); out = p; }
    out.connect(o.dest || sfxBus); sendRev(out, o.rev);
    osc.start(t); osc.stop(end + 0.05);
  }
  function noise(o) {
    const t = o.t, dur = o.dur, vel = o.vel == null ? 0.3 : o.vel;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = o.rate || 1;
    const f = ac.createBiquadFilter(); f.type = o.ftype || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.cutoff || 1000, t); if (o.cutEnd) f.frequency.exponentialRampToValueAtTime(o.cutEnd, t + dur);
    const g = ac.createGain(); const a = o.a == null ? 0.005 : o.a;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus); sendRev(g, o.rev);
    src.start(t); src.stop(t + dur + 0.05);
  }
  // corde pincée (Karplus-Strong), mise en cache par hauteur
  function pluckBuffer(freq, dur, bright) {
    const key = Math.round(freq) + ':' + bright;
    if (pluckCache.has(key)) return pluckCache.get(key);
    const sr = ac.sampleRate, N = Math.max(2, Math.round(sr / freq)), len = Math.floor(sr * dur);
    const buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0), ring = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) { const n = Math.random() * 2 - 1; ring[i] = bright ? n : (n + prev) * 0.5; prev = n; }
    const decay = bright ? 0.9975 : 0.994 + Math.min(0.004, N / 60000);
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx], nxt = ring[(idx + 1) % N];
      d[i] = cur; ring[idx] = 0.5 * (cur + nxt) * decay; idx = (idx + 1) % N;
    }
    if (pluckCache.size > 90) pluckCache.delete(pluckCache.keys().next().value);
    pluckCache.set(key, buf); return buf;
  }
  function pluck(o) {
    const src = ac.createBufferSource(); src.buffer = pluckBuffer(o.freq, o.dur || 2, !!o.bright);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.cutoff || 2800; f.Q.value = 0.5;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, o.t); g.gain.linearRampToValueAtTime(o.vel, o.t + 0.004); g.gain.setValueAtTime(o.vel, o.t + Math.max(0.05, (o.hold || 0.6))); g.gain.exponentialRampToValueAtTime(0.0001, o.t + (o.hold || 0.6) + (o.rel || 0.8));
    src.connect(f); f.connect(g);
    let out = g; if (o.pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = o.pan; g.connect(p); out = p; }
    out.connect(o.dest || sfxBus); sendRev(out, o.rev);
    src.start(o.t); src.stop(o.t + (o.hold || 0.6) + (o.rel || 0.8) + 0.1);
  }
  // chœur : deux dents de scie détunées à travers trois formants
  function choirVoice(t, f, dur, vel, dest, vowel) {
    const F = vowel === 'o' ? [450, 800, 2600] : [660, 1120, 2500];
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.7); g.gain.setValueAtTime(vel, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.6);
    g.connect(dest); sendRev(g, 0.8);
    for (const dt of [-7, 6]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt;
      const l = ac.createOscillator(); l.frequency.value = 4.5 + Math.random(); const lg = ac.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(5, t + 0.8); l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + dur + 1.8);
      for (let i = 0; i < 3; i++) { const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = F[i]; bp.Q.value = 7; const fg = ac.createGain(); fg.gain.value = [0.5, 0.35, 0.12][i]; o.connect(bp); bp.connect(fg); fg.connect(g); }
      o.start(t); o.stop(t + dur + 1.8);
    }
  }

  /* ---------- instruments ---------- */
  const INST = {
    strings(t, f, dur, vel, dest) { for (const dt of [-6, 6]) voice({ wave: waves.strings, freq: f, detune: dt, t, dur, vel: vel * 0.16, a: 0.9, d: 0.5, s: 0.85, r: 1.6, cutoff: 1300, q: 0.5, vib: 4, vibRate: 5, vibDelay: 1, dest, rev: 0.75 }); },
    choir(t, f, dur, vel, dest) { choirVoice(t, f, dur, vel * 0.22, dest, 'a'); },
    choirLow(t, f, dur, vel, dest) { choirVoice(t, f, dur, vel * 0.26, dest, 'o'); },
    organ(t, f, dur, vel, dest) { for (const dt of [-4, 4]) voice({ wave: waves.organ, freq: f, detune: dt, t, dur, vel: vel * 0.14, a: 0.5, d: 0.4, s: 0.9, r: 1.2, cutoff: 1800, dest, rev: 0.7 }); },
    lute(t, f, dur, vel, dest, pan) { pluck({ t, freq: f, vel: vel * 0.55, hold: 0.5, rel: 0.9, cutoff: 2600, dest, rev: 0.35, pan }); },
    harp(t, f, dur, vel, dest, pan) { pluck({ t, freq: f, vel: vel * 0.45, hold: 0.9, rel: 1.4, cutoff: 5000, bright: true, dest, rev: 0.55, pan }); },
    bass(t, f, dur, vel, dest) { pluck({ t, freq: f, vel: vel * 0.8, hold: dur, rel: 0.5, cutoff: 900, dest, rev: 0.1 }); voice({ type: 'sine', freq: f, t, dur, vel: vel * 0.45, a: 0.01, d: 0.2, s: 0.7, r: 0.15, dest }); },
    flute(t, f, dur, vel, dest, pan) {
      voice({ type: 'sine', freq: f, t, dur, vel: vel * 0.6, a: 0.1, d: 0.2, s: 0.85, r: 0.35, vib: 8, vibRate: 5.2, vibDelay: 0.35, dest, rev: 0.6, pan });
      voice({ type: 'triangle', freq: f, t, dur, vel: vel * 0.12, a: 0.14, d: 0.2, s: 0.8, r: 0.3, cutoff: 2200, dest, rev: 0.4, pan });
      noise({ t, dur: Math.min(dur, 0.3), vel: vel * 0.06, cutoff: f * 2, q: 5, a: 0.06, dest });
    },
    oboe(t, f, dur, vel, dest, pan) { voice({ wave: waves.oboe, freq: f, t, dur, vel: vel * 0.28, a: 0.06, d: 0.2, s: 0.8, r: 0.3, cutoff: 2600, q: 1.5, fenv: 1.6, fdec: 0.25, vib: 7, vibRate: 5.5, vibDelay: 0.4, dest, rev: 0.5, pan }); },
    bell(t, f, dur, vel, dest, pan) { voice({ type: 'sine', freq: f, t, dur: 0.08, vel: vel * 0.7, a: 0.003, d: 0.9, s: 0.06, r: 1.6, fm: true, fmRatio: 2.4, fmDepth: 0.7, dest, rev: 0.65, pan }); voice({ type: 'sine', freq: f * 3.01, t, dur: 0.05, vel: vel * 0.08, a: 0.003, d: 0.4, s: 0, r: 0.4, dest, rev: 0.4, pan }); },
    glass(t, f, dur, vel, dest, pan) { voice({ type: 'sine', freq: f, t, dur: 0.08, vel: vel * 0.6, a: 0.005, d: 1.4, s: 0.04, r: 2, fm: true, fmRatio: 5.02, fmDepth: 0.4, dest, rev: 0.8, pan }); },
    // percussions
    frame(t, vel, dest) { voice({ type: 'sine', freq: 72, t, dur: 0.25, vel: vel * 1.1, a: 0.003, d: 0.35, s: 0.2, r: 0.3, slide: 0.7, dest, rev: 0.35 }); noise({ t, dur: 0.06, vel: vel * 0.18, cutoff: 900, ftype: 'lowpass', dest }); },
    taiko(t, vel, dest) { voice({ type: 'sine', freq: 95, t, dur: 0.3, vel: vel * 1.2, a: 0.003, d: 0.4, s: 0.2, r: 0.4, slide: 0.55, dest, rev: 0.5 }); noise({ t, dur: 0.12, vel: vel * 0.3, cutoff: 600, ftype: 'lowpass', q: 1, dest, rev: 0.3 }); },
    rim(t, vel, dest) { noise({ t, dur: 0.09, vel: vel * 0.5, cutoff: 2400, q: 1.2, dest, rev: 0.35 }); voice({ type: 'triangle', freq: 420, t, dur: 0.02, vel: vel * 0.25, a: 0.001, d: 0.05, s: 0, r: 0.04, slide: 0.6, dest }); },
    tamb(t, vel, dest) { for (let i = 0; i < 3; i++) noise({ t: t + i * 0.012, dur: 0.16, vel: vel * 0.18, cutoff: 6500 + i * 900, q: 4, ftype: 'bandpass', dest, rev: 0.3 }); },
    shaker(t, vel, dest) { noise({ t, dur: 0.07, vel: vel * 0.2, cutoff: 6000, q: 1.6, cutEnd: 9000, dest }); },
    wood(t, vel, dest) { voice({ type: 'sine', freq: 1100, t, dur: 0.02, vel: vel * 0.35, a: 0.001, d: 0.06, s: 0, r: 0.04, slide: 0.8, dest, rev: 0.3 }); noise({ t, dur: 0.03, vel: vel * 0.15, cutoff: 2500, q: 3, dest }); },
    anvil(t, vel, dest) { voice({ type: 'sine', freq: 1568, t, dur: 0.04, vel: vel * 0.4, a: 0.001, d: 0.5, s: 0.04, r: 0.6, fm: true, fmRatio: 2.76, fmDepth: 2.2, dest, rev: 0.65 }); noise({ t, dur: 0.05, vel: vel * 0.22, cutoff: 5200, q: 3, dest }); },
  };

  /* ---------- écriture musicale ---------- */
  const CHORD = { m: [0, 3, 7], M: [0, 4, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], sus: [0, 5, 7], dim: [0, 3, 6], m9: [0, 3, 7, 10, 14], mM7: [0, 3, 7, 11], add9: [0, 4, 7, 14] };
  const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11] };
  // motifs mélodiques : [degré (0 = tonique, 7 = octave), durée en doubles-croches], null = silence ; chaque phrase = 32 pas
  const MOTIFS = {
    lament:  [[4, 6], [3, 2], [2, 4], [0, 4], [null, 4], [2, 3], [3, 3], [4, 6], [null, 4]],
    rise:    [[0, 2], [2, 2], [4, 4], [7, 6], [null, 2], [6, 2], [4, 4], [2, 2], [3, 6], [null, 2]],
    hymn:    [[7, 8], [6, 4], [4, 4], [5, 6], [4, 2], [2, 8]],
    dance:   [[0, 2], [null, 2], [2, 2], [4, 2], [3, 2], [null, 2], [2, 2], [0, 2], [null, 4], [4, 2], [5, 2], [4, 2], [2, 2], [null, 4]],
    echo:    [[4, 4], [null, 4], [4, 2], [2, 2], [0, 8], [null, 4], [3, 2], [2, 2], [0, 4]],
    call:    [[7, 3], [9, 3], [7, 2], [4, 8], [null, 4], [2, 2], [4, 2], [5, 4], [4, 4]],
    stalk:   [[0, 6], [1, 2], [0, 4], [null, 4], [3, 4], [1, 2], [0, 2], [null, 8]],
    battle:  [[7, 2], [7, 2], [null, 2], [4, 2], [7, 2], [9, 2], [7, 4], [null, 2], [4, 2], [3, 2], [4, 2], [2, 4], [null, 2], [0, 4]],
  };
  const TRACKS = {
    menu:   { bpm: 58, root: 57, scale: 'minor', prog: [[0, 'm9'], [8, 'M7'], [5, 'm7'], [7, 'sus']], pad: 'strings', arp: 'harp', arpPat: '0.2.1.3..1.2.3..', arpOct: 1, lead: 'flute', leadOct: 1, motifs: ['lament', null, 'echo', null], bass: null, drums: null, swing: 0 },
    crypte: { bpm: 84, root: 50, scale: 'minor', prog: [[0, 'm'], [0, 'm7'], [8, 'M'], [10, 'M'], [0, 'm'], [5, 'm'], [3, 'M'], [7, 'M']], pad: 'choirLow', arp: 'lute', arpPat: '0.1.2...1.2.0.2.', arpOct: 1, lead: 'oboe', leadOct: 1, motifs: ['lament', 'echo', 'lament', null], bass: 'bass', bassPat: 'x.......x...x...', drums: { frame: 'x.......x...x...', rim: '....x.......x...', shaker: '..x...x...x...x.' }, swing: 0 },
    marais: { bpm: 76, root: 52, scale: 'dorian', prog: [[0, 'm7'], [3, 'M7'], [0, 'm7'], [10, 'add9']], pad: 'strings', arp: 'harp', arpPat: '0.2.1..3.0.1.2..', arpOct: 1, lead: 'flute', leadOct: 1, motifs: ['dance', null, 'call', null], bass: 'bass', bassPat: 'x.....x...x.....', drums: { frame: 'x.....x...x.....', wood: '..x..x....x..x..', shaker: 'x.x.x.x.x.x.x.x.' }, swing: 0.14 },
    forge:  { bpm: 112, root: 48, scale: 'phrygian', prog: [[0, 'm'], [1, 'M'], [0, 'm'], [8, 'M'], [0, 'm'], [1, 'M'], [3, 'm'], [7, 'M']], pad: 'choir', arp: 'lute', arpPat: '0.0.2.0.1.0.2.2.', arpOct: 0, lead: 'oboe', leadOct: 1, motifs: ['stalk', 'battle', 'stalk', 'rise'], bass: 'bass', bassPat: 'x.x.x.x.x.x.x.x.', drums: { taiko: 'x..x..x.x..x....', rim: '....x.......x...', anvil: '....x.......x..x' }, swing: 0 },
    givre:  { bpm: 68, root: 54, scale: 'minor', prog: [[0, 'm9'], [10, 'M7'], [8, 'M7'], [3, 'M']], pad: 'strings', arp: 'bell', arpPat: '0...2...1...3...', arpOct: 2, lead: 'flute', leadOct: 1, motifs: ['hymn', null, 'echo', null], bass: 'bass', bassPat: 'x.......x.......', drums: { frame: 'x.......x.......', tamb: '....x.......x...' }, swing: 0 },
    abime:  { bpm: 94, root: 47, scale: 'phrygian', prog: [[0, 'm'], [1, 'dim'], [0, 'm'], [6, 'm'], [0, 'm'], [1, 'dim'], [3, 'm'], [8, 'M']], pad: 'choirLow', arp: 'lute', arpPat: '0.2.0.1..0.2.1..', arpOct: 0, lead: 'oboe', leadOct: 1, motifs: ['stalk', null, 'lament', 'stalk'], bass: 'bass', bassPat: 'x..x....x..x..x.', drums: { taiko: 'x..x....x..x....', rim: '....x.......x...', wood: 'x..x..x..x..x..x' }, swing: 0 },
    boss:   { bpm: 126, root: 50, scale: 'harm', prog: [[0, 'm'], [0, 'm'], [8, 'M'], [7, 'M'], [0, 'm'], [1, 'M'], [6, 'dim'], [7, 'M']], pad: 'choir', arp: 'lute', arpPat: '0.2.1.2.0.2.1.3.', arpOct: 1, lead: 'oboe', leadOct: 1, motifs: ['battle', 'rise', 'battle', 'call'], bass: 'bass', bassPat: 'x.x.x.x.x.x.x.x.', drums: { taiko: 'x.x.x.x.x.x.x.xx', rim: '....x.......x..x', shaker: 'x.x.x.x.x.x.x.x.', anvil: '........x.......' }, swing: 0, full: true },
  };

  function play(id, opts) {
    if (!ac) return;
    const tpl = TRACKS[id]; if (!tpl) return;
    const key = id + ':' + ((opts && opts.root) || tpl.root);
    if (M.id === key) return;
    M.id = key; M.tpl = Object.assign({}, tpl, opts || {});
    M.step = 0; M.bar = 0; M.nextT = ac.currentTime + 0.2; M.rand = mulberry32(hashStr(key)); M.voicing = null; M.phraseNotes = null;
    M.fadeGain.gain.cancelScheduledValues(ac.currentTime); M.fadeGain.gain.setValueAtTime(0.0001, ac.currentTime); M.fadeGain.gain.exponentialRampToValueAtTime(1, ac.currentTime + 1.5);
    if (tpl.full) M.targetInt = 1;
  }
  function stop() { M.id = null; M.tpl = null; }
  function setIntensity(v) { if (!(M.tpl && M.tpl.full)) M.targetInt = M.envers ? 0 : v; }
  function setEnvers(on) { if (!ac) return; M.envers = on; M.filter.frequency.setTargetAtTime(on ? 520 : 18000, ac.currentTime, 0.4); if (on) M.targetInt = 0; }

  // voicing d'accord avec conduite des voix (chaque voix bouge le moins possible)
  function voicing(rootMidi, tones) {
    const prev = M.voicing;
    const out = tones.map((iv, i) => {
      const base = rootMidi + iv;
      if (!prev || prev[i] == null) return base + 12;
      let best = base, bd = 99;
      for (let k = -1; k <= 2; k++) { const c = base + 12 * k; const d = Math.abs(c - prev[i]); if (d < bd) { bd = d; best = c; } }
      return best;
    });
    M.voicing = out; return out;
  }
  // convertit un motif en événements {step, midi, len}
  function phraseEvents(T, motifName, transpose) {
    const m = MOTIFS[motifName]; if (!m) return [];
    const scale = SCALES[T.scale], ev = []; let s = 0;
    for (const [deg, len] of m) { if (deg != null) { const dg = deg + transpose, oct = Math.floor(dg / 7), idx = ((dg % 7) + 7) % 7; ev.push({ step: s, midi: T.root + 12 * (T.leadOct + 1) + oct * 12 + scale[idx], len }); } s += len; }
    return ev;
  }
  function scheduleStep(t) {
    const T = M.tpl, s = M.step % 16, bar = M.bar, chord = T.prog[bar % T.prog.length];
    const rootMidi = T.root + chord[0], tones = CHORD[chord[1]], stepDur = 60 / T.bpm / 4, barDur = stepDur * 16;
    const hum = () => (M.rand() - 0.5) * 0.02;
    const accent = s % 8 === 0 ? 1.15 : s % 4 === 0 ? 1 : 0.85;
    if (s === 0 && T.pad) { const v = voicing(rootMidi, tones); v.forEach((midi, i) => INST[T.pad](t + i * 0.03, mtof(midi), barDur, 0.5 * (i === 0 ? 1 : 0.85), layers.pad)); }
    if (T.arp) {
      const ch = T.arpPat[s];
      if (ch !== '.') {
        const deg = parseInt(ch, 10), iv = tones[deg % tones.length] + 12 * Math.floor(deg / tones.length);
        INST[T.arp](t + hum(), mtof(rootMidi + 12 * (T.arpOct + 1) + iv), stepDur * 2, (0.28 + 0.1 * M.rand()) * accent, layers.arp, (M.rand() - 0.5) * 0.6);
      }
    }
    if (T.bass && T.bassPat[s] === 'x') INST[T.bass](t + hum() * 0.5, mtof(rootMidi - 12 + (s >= 8 && M.rand() < 0.25 ? 7 : 0)), stepDur * 3, 0.55 * accent, layers.bass);
    if (T.drums) {
      const D = T.drums;
      for (const k in D) if (D[k][s] === 'x') INST[k](t + hum() * 0.5, (k === 'shaker' ? 0.35 : 0.7) * accent * (0.85 + 0.3 * M.rand()), layers.drums);
      if (D.shaker && s % 2 === 1) INST.shaker(t + hum(), 0.22, layers.drums);
    }
    if (T.lead && T.motifs) {
      const phraseIdx = Math.floor(bar / 2) % T.motifs.length, inPhrase = (bar % 2) * 16 + s;
      if (inPhrase === 0) { const name = T.motifs[phraseIdx]; const transpose = phraseIdx === 2 && M.rand() < 0.5 ? 2 : 0; M.phraseNotes = name ? phraseEvents(T, name, transpose) : []; }
      if (M.phraseNotes) for (const ev of M.phraseNotes) if (ev.step === inPhrase) INST[T.lead](t + hum(), mtof(ev.midi), stepDur * ev.len * 0.9, (0.3 + 0.12 * M.rand()) * accent, layers.lead, 0.15);
    }
  }
  function update(dt) {
    if (!ac) return;
    const now = ac.currentTime;
    M.intensity = lerp(M.intensity, M.targetInt, 0.04);
    layers.bass.gain.setTargetAtTime(M.intensity, now, 0.5);
    layers.drums.gain.setTargetAtTime(M.intensity, now, 0.5);
    if (M.tpl) {
      const stepDur = 60 / M.tpl.bpm / 4;
      while (M.nextT < now + 0.4) {
        scheduleStep(M.nextT);
        const sw = M.tpl.swing * stepDur;
        M.nextT += stepDur + (M.step % 2 === 0 ? sw : -sw);
        M.step++; if (M.step % 16 === 0) M.bar++;
      }
    }
    if (amb && amb.kind === 'drip') {
      dripT -= dt;
      if (dripT <= 0) { dripT = 1.5 + Math.random() * 4; voice({ type: 'sine', freq: 1400 + Math.random() * 1800, t: now, dur: 0.03, vel: 0.07, a: 0.002, d: 0.12, s: 0, r: 0.4, dest: layers.amb, rev: 0.9, pan: Math.random() * 1.6 - 0.8 }); }
    }
  }

  /* ---------- ambiances ---------- */
  function setAmbience(kind) {
    if (!ac) return;
    if (amb && amb.kind === kind) return;
    if (amb) { for (const n of amb.nodes) { try { n.stop(ac.currentTime + 1.2); } catch (e) {} } amb.gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.4); }
    const gain = ac.createGain(); gain.gain.setValueAtTime(0.0001, ac.currentTime); gain.connect(layers.amb);
    const nodes = [];
    const mkNoise = (ftype, cutoff, q, vol, lfoRate, lfoDepth) => {
      const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = ftype; f.frequency.value = cutoff; f.Q.value = q;
      const g = ac.createGain(); g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(gain);
      if (lfoRate) { const l = ac.createOscillator(); l.frequency.value = lfoRate; const lg = ac.createGain(); lg.gain.value = lfoDepth; l.connect(lg); lg.connect(f.frequency); l.start(); nodes.push(l); }
      src.start(); nodes.push(src);
    };
    const target = { drip: 0.45, swamp: 0.45, fire: 0.5, wind: 0.55, void: 0.45, none: 0 }[kind] || 0;
    if (kind === 'swamp') { mkNoise('lowpass', 260, 0.7, 0.35, 0.15, 120); mkNoise('bandpass', 900, 8, 0.05, 2.3, 500); }
    else if (kind === 'fire') { mkNoise('lowpass', 1100, 0.5, 0.25, 6.5, 700); mkNoise('bandpass', 3200, 4, 0.05, 11, 1500); }
    else if (kind === 'wind') { mkNoise('bandpass', 450, 1.2, 0.35, 0.09, 350); mkNoise('bandpass', 1400, 3, 0.08, 0.21, 800); }
    else if (kind === 'void') {
      for (const f of [55, 55.7, 82.4]) { const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = ac.createGain(); g.gain.value = 0.12; o.connect(g); g.connect(gain); o.start(); nodes.push(o); }
      mkNoise('lowpass', 180, 0.5, 0.2, 0.05, 80);
    } else if (kind === 'drip') { mkNoise('lowpass', 150, 0.5, 0.18, 0.07, 60); dripT = 1; }
    gain.gain.setTargetAtTime(target, ac.currentTime, 1.2);
    amb = { kind, nodes, gain };
  }

  /* ---------- bruitages : échantillons Kenney + synthèse ---------- */
  function sample(name, o) {
    const buf = samples[name]; if (!buf) return false;
    o = o || {};
    const t = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource(); src.buffer = buf;
    src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() - 0.5) * (o.var == null ? 0.12 : o.var));
    const g = ac.createGain(); g.gain.value = o.vol == null ? 0.5 : o.vol;
    src.connect(g);
    let out = g;
    if (o.cutoff) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.cutoff; g.connect(f); out = f; }
    out.connect(sfxBus); sendRev(out, o.rev == null ? 0.25 : o.rev);
    src.start(t); return true;
  }
  const SFX_DEFS = {
    shoot_wand: t => { voice({ type: 'sine', freq: 880, t, dur: 0.05, vel: 0.1, a: 0.002, d: 0.06, s: 0, r: 0.05, slide: 0.45 }); noise({ t, dur: 0.04, vel: 0.05, cutoff: 3000, q: 2 }); },
    shoot_bow: t => { noise({ t, dur: 0.12, vel: 0.18, cutoff: 900, cutEnd: 4000, q: 1.5 }); pluck({ t, freq: 110, vel: 0.2, hold: 0.05, rel: 0.25, cutoff: 1500 }); },
    shoot_blades: t => { noise({ t, dur: 0.16, vel: 0.2, cutoff: 500, cutEnd: 3500, q: 1.2, rev: 0.2 }); },
    shoot_orb: t => { voice({ type: 'sine', freq: 180, t, dur: 0.15, vel: 0.18, a: 0.01, d: 0.15, s: 0.2, r: 0.1, slide: 1.8 }); noise({ t, dur: 0.15, vel: 0.1, cutoff: 600, ftype: 'lowpass' }); },
    shoot_storm: t => { noise({ t, dur: 0.09, vel: 0.18, cutoff: 5000, ftype: 'highpass', q: 1 }); voice({ type: 'square', freq: 1200, t, dur: 0.04, vel: 0.06, a: 0.002, d: 0.05, s: 0, r: 0.03, slide: 0.3 }); },
    hit: t => { if (!sample('hit', { vol: 0.35, rate: 1.1, var: 0.25 })) { noise({ t, dur: 0.08, vel: 0.22, cutoff: 700, ftype: 'lowpass', q: 1 }); } },
    crit: t => { sample('hit2', { vol: 0.45, rate: 1.3, var: 0.2 }); voice({ type: 'triangle', freq: 1500, t, dur: 0.05, vel: 0.1, a: 0.002, d: 0.1, s: 0, r: 0.1, slide: 0.5 }); },
    kill: t => { sample('rockhit', { vol: 0.4, rate: 0.9, var: 0.3 }); noise({ t, dur: 0.22, vel: 0.2, cutoff: 350, ftype: 'lowpass', q: 1.5, rev: 0.3 }); },
    killBoss: t => { sample('explosion', { vol: 0.8, rate: 0.7, rev: 0.7 }); sample('lose', { vol: 0.5, rate: 0.6, delay: 0.3, rev: 0.6 }); voice({ type: 'sine', freq: 70, t, dur: 0.9, vel: 0.5, a: 0.01, d: 0.7, s: 0.3, r: 0.6, slide: 0.35, rev: 0.5 }); },
    hurt: t => { if (!sample('hurt', { vol: 0.6, rate: 1, var: 0.15 })) noise({ t, dur: 0.25, vel: 0.35, cutoff: 500, ftype: 'lowpass', q: 1 }); voice({ type: 'sine', freq: 60, t, dur: 0.25, vel: 0.3, a: 0.002, d: 0.25, s: 0, r: 0.1 }); },
    dodge: t => { sample('phase', { vol: 0.3, rate: 1.6 }); },
    shield: t => { sample('secret', { vol: 0.4, rate: 1.5, rev: 0.6 }); },
    dash: t => { if (!sample('phase', { vol: 0.35, rate: 1.25, var: 0.15 })) noise({ t, dur: 0.22, vel: 0.22, cutoff: 700, cutEnd: 2600, q: 1.4, rev: 0.15 }); },
    coin: t => { if (!sample('coin', { vol: 0.35, rate: 1.05, var: 0.2 })) for (const [f, d] of [[1760, 0], [2349, 0.07]]) voice({ type: 'sine', freq: f, t: t + d, dur: 0.03, vel: 0.1, a: 0.002, d: 0.18, s: 0, r: 0.2, rev: 0.4 }); },
    heart: t => { sample('upgrade', { vol: 0.45, rate: 1.2, rev: 0.5 }); },
    clear: t => { sample('secret', { vol: 0.5, rate: 1, rev: 0.6 }); for (const [f, d] of [[523, 0], [659, 0.09], [784, 0.18], [1046, 0.27]]) INST.harp(t + d, f, 0.2, 0.45, sfxBus); },
    doorOpen: t => { noise({ t, dur: 0.6, vel: 0.2, cutoff: 200, cutEnd: 500, ftype: 'lowpass', q: 2, a: 0.05, rev: 0.4 }); sample('rockhit', { vol: 0.3, rate: 0.5, rev: 0.6, delay: 0.35 }); },
    doorClose: t => { sample('rockhit', { vol: 0.6, rate: 0.55, rev: 0.7 }); voice({ type: 'sine', freq: 55, t, dur: 0.3, vel: 0.35, a: 0.002, d: 0.3, s: 0, r: 0.15, rev: 0.4 }); },
    boss: t => { sample('lose', { vol: 0.5, rate: 0.5, rev: 0.8 }); voice({ type: 'sawtooth', freq: 65, t, dur: 1.2, vel: 0.25, a: 0.05, d: 0.8, s: 0.4, r: 0.6, cutoff: 400, q: 2, fenv: 3, fdec: 1, rev: 0.7 }); },
    relic: t => { sample('upgrade', { vol: 0.5, rate: 1, rev: 0.6 }); for (const [f, d] of [[659, 0], [988, 0.1], [1319, 0.2], [1976, 0.32]]) INST.glass(t + d, f, 0.3, 0.3, sfxBus); },
    stairs: t => { sample('secret', { vol: 0.55, rate: 0.85, rev: 0.7 }); for (const [f, d] of [[392, 0], [494, 0.12], [587, 0.24], [784, 0.4]]) INST.bell(t + d, f, 0.3, 0.4, sfxBus); },
    boom: t => { sample('explosion', { vol: 0.5, rate: 1.3, var: 0.2, rev: 0.4 }); },
    explode: t => { if (!sample('explosion', { vol: 0.6, rate: 1, var: 0.2, rev: 0.5 })) noise({ t, dur: 0.7, vel: 0.5, cutoff: 600, cutEnd: 120, ftype: 'lowpass', q: 1, rev: 0.6 }); },
    surge: t => { sample('explosion', { vol: 0.5, rate: 0.8, rev: 0.6 }); sample('secret', { vol: 0.5, rate: 1.2, delay: 0.15, rev: 0.6 }); },
    combo: (t, n) => { voice({ type: 'sine', freq: 600 + Math.min(n, 20) * 60, t, dur: 0.03, vel: 0.08, a: 0.002, d: 0.08, s: 0, r: 0.08, fm: true, fmRatio: 2, fmDepth: 0.4 }); },
    fall: t => { sample('fall', { vol: 0.5, rate: 1, rev: 0.6 }); },
    splash: t => { noise({ t, dur: 0.2, vel: 0.12, cutoff: 1200, cutEnd: 3500, q: 1.2, rev: 0.3 }); },
    sizzle: t => { noise({ t, dur: 0.3, vel: 0.18, cutoff: 4000, q: 1.5, rev: 0.2 }); },
    poison: t => { sample('hurt', { vol: 0.3, rate: 0.7, rev: 0.4 }); noise({ t, dur: 0.3, vel: 0.1, cutoff: 800, q: 3, cutEnd: 300, rev: 0.4 }); },
    iceCrack: t => { sample('hit2', { vol: 0.4, rate: 1.8, rev: 0.5 }); noise({ t, dur: 0.15, vel: 0.15, cutoff: 5000, q: 4, cutEnd: 2000, rev: 0.4 }); },
    hop: t => { sample('jump', { vol: 0.4, rate: 0.6, rev: 0.4 }); voice({ type: 'sine', freq: 110, t, dur: 0.12, vel: 0.3, a: 0.002, d: 0.15, s: 0, r: 0.1, slide: 0.4 }); },
    web: t => { noise({ t, dur: 0.15, vel: 0.12, cutoff: 3000, cutEnd: 800, q: 2 }); },
    zap: t => { sample('laser2', { vol: 0.25, rate: 1.6, var: 0.3 }); },
    laser: t => { sample('laser', { vol: 0.35, rate: 0.4, rev: 0.5 }); voice({ type: 'sawtooth', freq: 220, t, dur: 1.2, vel: 0.1, a: 0.1, d: 0.3, s: 0.6, r: 0.3, cutoff: 1500, q: 3, vib: 20, vibRate: 12, rev: 0.4 }); },
    telegraph: t => { voice({ type: 'sine', freq: 330, t, dur: 0.15, vel: 0.1, a: 0.01, d: 0.2, s: 0, r: 0.2, rev: 0.5 }); },
    blink: t => { sample('phase', { vol: 0.4, rate: 0.9, rev: 0.6 }); },
    hunter: t => { sample('lose', { vol: 0.5, rate: 0.45, rev: 0.9 }); for (const f of [110, 116.5, 164]) voice({ type: 'sawtooth', freq: f, t, dur: 1.5, vel: 0.06, a: 0.4, d: 0.5, s: 0.6, r: 1, cutoff: 500, rev: 0.9 }); },
    buy: t => { sample('coin2', { vol: 0.45, rate: 1, rev: 0.4 }); },
    deny: t => { if (!sample('error', { vol: 0.35, rate: 1 })) voice({ type: 'square', freq: 180, t, dur: 0.12, vel: 0.08, a: 0.002, d: 0.1, s: 0.3, r: 0.05, cutoff: 800 }); },
    click: t => { voice({ type: 'sine', freq: 900, t, dur: 0.02, vel: 0.05, a: 0.001, d: 0.04, s: 0, r: 0.03 }); },
    swap: t => { sample('phase', { vol: 0.35, rate: 1.1 }); sample('coin2', { vol: 0.25, rate: 0.8, delay: 0.1 }); },
    revive: t => { sample('secret', { vol: 0.6, rate: 0.9, rev: 0.8 }); for (const [f, d] of [[392, 0], [523, 0.15], [659, 0.3], [784, 0.45], [1046, 0.6]]) INST.glass(t + d, f, 0.4, 0.4, sfxBus); },
    die: t => { sample('gameover', { vol: 0.6, rate: 1, rev: 0.7 }); },
    wave: t => { sample('upgrade', { vol: 0.4, rate: 0.8, rev: 0.5 }); },
    thud: t => { sample('rockhit', { vol: 0.5, rate: 0.7, var: 0.2 }); },
    type: t => { voice({ type: 'sine', freq: 1800 + Math.random() * 600, t, dur: 0.012, vel: 0.025, a: 0.001, d: 0.025, s: 0, r: 0.02 }); },
    cross: t => { sample('phase', { vol: 0.5, rate: 0.55, rev: 0.9 }); noise({ t, dur: 0.9, vel: 0.25, cutoff: 300, cutEnd: 5000, q: 2, a: 0.3, rev: 0.8 }); for (const f of [220, 277, 330]) voice({ type: 'sine', freq: f, t: t + 0.1, dur: 0.6, vel: 0.08, a: 0.2, d: 0.3, s: 0.5, r: 0.8, rev: 0.9 }); },
    crossBack: t => { sample('phase', { vol: 0.45, rate: 1.3, rev: 0.6 }); noise({ t, dur: 0.6, vel: 0.2, cutoff: 4000, cutEnd: 200, q: 2, rev: 0.6 }); },
    gate: t => { sample('rockhit', { vol: 0.6, rate: 0.45, rev: 0.8 }); noise({ t, dur: 0.8, vel: 0.2, cutoff: 150, cutEnd: 600, ftype: 'lowpass', q: 2, a: 0.1, rev: 0.6 }); },
  };
  const lastPlayed = {};
  function sfx(name, arg) {
    if (!ac) return;
    const now = ac.currentTime;
    if (lastPlayed[name] && now - lastPlayed[name] < 0.03) return;
    lastPlayed[name] = now;
    const f = SFX_DEFS[name]; if (f) f(now, arg);
  }

  return { init, resume, setVolumes, play, stop, setIntensity, setEnvers, update, setAmbience, sfx, get ready() { return !!ac; }, stats() { return { samples: Object.keys(samples).length, track: M.id, step: M.step, bar: M.bar, intensity: M.intensity, state: ac && ac.state }; } };
})();
const SFX = (n, a) => Audio.sfx(n, a);
