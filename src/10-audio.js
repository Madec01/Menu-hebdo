/* ---------- moteur audio : musique adaptative, ambiances, bruitages ---------- */
const Audio = (() => {
  let ac = null, master, musicBus, sfxBus, revIn, noiseBuf;
  const layers = {};
  let amb = null;              // ambiance en cours { nodes:[], kind }
  let dripT = 0;
  const M = { id: null, tpl: null, nextT: 0, step: 0, bar: 0, intensity: 0, targetInt: 0, lastDeg: 7, rand: Math.random, fadeGain: null };

  function init() {
    if (ac) return true;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    master = ac.createGain();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ac.destination);
    musicBus = ac.createGain(); sfxBus = ac.createGain(); musicBus.connect(master); sfxBus.connect(master);
    const conv = ac.createConvolver(); conv.buffer = makeIR(2.8, 2.6);
    revIn = ac.createGain(); revIn.connect(conv);
    const revOut = ac.createGain(); revOut.gain.value = 0.55; conv.connect(revOut); revOut.connect(master);
    noiseBuf = makeNoise(2);
    M.fadeGain = ac.createGain(); M.fadeGain.connect(musicBus);
    for (const l of ['pad', 'bass', 'arp', 'lead', 'drums', 'amb']) {
      layers[l] = ac.createGain(); layers[l].gain.value = (l === 'bass' || l === 'drums') ? 0 : 1;
      layers[l].connect(l === 'amb' ? musicBus : M.fadeGain);
    }
    setVolumes();
    return true;
  }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }
  function setVolumes() {
    if (!ac) return;
    musicBus.gain.setTargetAtTime(save.musicVol * 0.55, ac.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(save.sfxVol * 0.7, ac.currentTime, 0.05);
  }
  function makeIR(dur, decay) {
    const rate = ac.sampleRate, len = Math.floor(rate * dur), buf = ac.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 200 ? i / 200 : 1); }
    return buf;
  }
  function makeNoise(dur) {
    const rate = ac.sampleRate, len = rate * dur, buf = ac.createBuffer(1, len, rate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  /* voix : oscillateur + filtre + enveloppe + envoi réverb */
  function voice(o) {
    const t = o.t, dur = o.dur, vel = o.vel == null ? 0.5 : o.vel, a = o.a == null ? 0.01 : o.a, d = o.d == null ? 0.1 : o.d, s = o.s == null ? 0.7 : o.s, r = o.r == null ? 0.2 : o.r;
    const osc = ac.createOscillator(); osc.type = o.type || 'triangle'; osc.frequency.value = o.freq;
    if (o.detune) osc.detune.value = o.detune;
    let node = osc;
    const end = t + Math.max(a + d, dur) + r;
    if (o.slide) { osc.frequency.setValueAtTime(o.freq, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq * o.slide), t + dur); }
    if (o.fm) {
      const mod = ac.createOscillator(); mod.frequency.value = o.freq * (o.fmRatio || 2);
      const mg = ac.createGain(); mg.gain.setValueAtTime(o.freq * (o.fmDepth || 1), t); mg.gain.exponentialRampToValueAtTime(o.freq * 0.02, t + Math.max(0.05, dur * 0.8 + d));
      mod.connect(mg); mg.connect(osc.frequency); mod.start(t); mod.stop(end + 0.05);
    }
    if (o.vib) {
      const l = ac.createOscillator(); l.frequency.value = o.vibRate || 5.5;
      const lg = ac.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib, t + 0.25);
      l.connect(lg); lg.connect(osc.detune); l.start(t); l.stop(end + 0.05);
    }
    if (o.cutoff) {
      const f = ac.createBiquadFilter(); f.type = o.ftype || 'lowpass'; f.Q.value = o.q || 0.8;
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
    out.connect(o.dest || sfxBus);
    if (o.rev) { const rg = ac.createGain(); rg.gain.value = o.rev; out.connect(rg); rg.connect(revIn); }
    osc.start(t); osc.stop(end + 0.05);
  }
  /* bruit filtré */
  function noise(o) {
    const t = o.t, dur = o.dur, vel = o.vel == null ? 0.3 : o.vel;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = o.rate || 1;
    const f = ac.createBiquadFilter(); f.type = o.ftype || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.cutoff || 1000, t); if (o.cutEnd) f.frequency.exponentialRampToValueAtTime(o.cutEnd, t + dur);
    const g = ac.createGain(); const a = o.a == null ? 0.005 : o.a;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    if (o.rev) { const rg = ac.createGain(); rg.gain.value = o.rev; g.connect(rg); rg.connect(revIn); }
    src.start(t); src.stop(t + dur + 0.05);
  }

  /* ---------- instruments ---------- */
  const INST = {
    pad(t, f, dur, vel, dest) { for (const dt of [-8, 0, 8]) voice({ type: 'sawtooth', freq: f, detune: dt, t, dur, vel: vel * 0.16, a: 0.7, d: 0.6, s: 0.8, r: 1.6, cutoff: 850, q: 0.6, fenv: 0.55, fdec: 1.8, dest, rev: 0.7 }); },
    darkpad(t, f, dur, vel, dest) {
      for (const dt of [-6, 6]) voice({ type: 'triangle', freq: f, detune: dt, t, dur, vel: vel * 0.32, a: 0.9, d: 0.6, s: 0.9, r: 1.8, cutoff: 650, dest, rev: 0.8 });
      voice({ type: 'sine', freq: f / 2, t, dur, vel: vel * 0.28, a: 0.9, d: 0.4, s: 0.9, r: 1.6, dest, rev: 0.35 });
    },
    pluck(t, f, dur, vel, dest) { voice({ type: 'triangle', freq: f, t, dur: 0.04, vel, a: 0.003, d: 0.28, s: 0, r: 0.3, cutoff: 2400, q: 1.1, fenv: 2.6, fdec: 0.14, dest, rev: 0.4 }); },
    bell(t, f, dur, vel, dest) { voice({ type: 'sine', freq: f, t, dur: 0.08, vel: vel * 0.8, a: 0.003, d: 0.7, s: 0.08, r: 1.3, fm: true, fmRatio: 3.01, fmDepth: 1.3, dest, rev: 0.55 }); },
    glass(t, f, dur, vel, dest) {
      voice({ type: 'sine', freq: f, t, dur: 0.08, vel: vel * 0.7, a: 0.005, d: 1.3, s: 0.05, r: 1.9, fm: true, fmRatio: 5.02, fmDepth: 0.5, dest, rev: 0.75 });
      voice({ type: 'sine', freq: f * 2.005, t, dur: 0.08, vel: vel * 0.14, a: 0.005, d: 0.7, s: 0, r: 0.7, dest, rev: 0.6 });
    },
    marimba(t, f, dur, vel, dest) {
      voice({ type: 'sine', freq: f, t, dur: 0.04, vel, a: 0.002, d: 0.32, s: 0, r: 0.25, dest, rev: 0.35 });
      voice({ type: 'sine', freq: f * 4, t, dur: 0.02, vel: vel * 0.22, a: 0.002, d: 0.07, s: 0, r: 0.05, dest });
    },
    flute(t, f, dur, vel, dest) {
      voice({ type: 'sine', freq: f, t, dur, vel: vel * 0.7, a: 0.09, d: 0.2, s: 0.8, r: 0.3, vib: 7, vibRate: 5, dest, rev: 0.55 });
      voice({ type: 'triangle', freq: f, t, dur, vel: vel * 0.12, a: 0.12, d: 0.2, s: 0.8, r: 0.25, cutoff: 2500, dest, rev: 0.4 });
      noise({ t, dur: Math.min(dur, 0.25), vel: vel * 0.05, cutoff: f * 2, q: 6, a: 0.05, dest });
    },
    lead(t, f, dur, vel, dest) {
      voice({ type: 'sawtooth', freq: f, t, dur, vel: vel * 0.3, a: 0.02, d: 0.15, s: 0.7, r: 0.22, cutoff: 1700, q: 2.2, fenv: 2.2, fdec: 0.22, vib: 5, vibRate: 6, dest, rev: 0.4 });
      voice({ type: 'square', freq: f / 2, t, dur, vel: vel * 0.08, a: 0.02, d: 0.1, s: 0.7, r: 0.2, cutoff: 800, dest });
    },
    bass(t, f, dur, vel, dest) {
      voice({ type: 'sine', freq: f, t, dur, vel: vel * 0.9, a: 0.008, d: 0.2, s: 0.7, r: 0.1, dest });
      voice({ type: 'sawtooth', freq: f, t, dur, vel: vel * 0.22, a: 0.008, d: 0.15, s: 0.4, r: 0.1, cutoff: 420, q: 1.6, fenv: 3.2, fdec: 0.12, dest });
    },
    subbass(t, f, dur, vel, dest) {
      voice({ type: 'sine', freq: f, t, dur, vel, a: 0.02, d: 0.3, s: 0.8, r: 0.25, dest });
      voice({ type: 'triangle', freq: f * 2, t, dur, vel: vel * 0.18, a: 0.02, d: 0.2, s: 0.6, r: 0.2, cutoff: 480, dest });
    },
    kick(t, vel, dest) { voice({ type: 'sine', freq: 140, t, dur: 0.12, vel: vel * 1.1, a: 0.002, d: 0.1, s: 0.3, r: 0.15, slide: 0.3, dest }); noise({ t, dur: 0.025, vel: vel * 0.2, cutoff: 2500, ftype: 'lowpass', dest }); },
    snare(t, vel, dest) { noise({ t, dur: 0.17, vel: vel * 0.6, cutoff: 1900, q: 0.7, dest, rev: 0.3 }); voice({ type: 'triangle', freq: 200, t, dur: 0.04, vel: vel * 0.45, a: 0.002, d: 0.08, s: 0, r: 0.05, slide: 0.55, dest }); },
    hat(t, vel, dest, open) { noise({ t, dur: open ? 0.2 : 0.045, vel: vel * 0.3, cutoff: 8500, ftype: 'highpass', q: 0.6, dest }); },
    tom(t, vel, dest, f) { voice({ type: 'sine', freq: f || 110, t, dur: 0.14, vel, a: 0.002, d: 0.22, s: 0.2, r: 0.2, slide: 0.6, dest, rev: 0.35 }); },
    shaker(t, vel, dest) { noise({ t, dur: 0.06, vel: vel * 0.22, cutoff: 6500, q: 1.4, cutEnd: 9500, dest }); },
    anvil(t, vel, dest) { voice({ type: 'sine', freq: 1568, t, dur: 0.04, vel: vel * 0.45, a: 0.001, d: 0.5, s: 0.04, r: 0.6, fm: true, fmRatio: 2.76, fmDepth: 2.2, dest, rev: 0.65 }); noise({ t, dur: 0.05, vel: vel * 0.25, cutoff: 5200, q: 3, dest }); },
  };

  /* ---------- morceaux ---------- */
  const CHORD = { m: [0, 3, 7], M: [0, 4, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], sus: [0, 5, 7], dim: [0, 3, 6], m9: [0, 3, 7, 10, 14], mM7: [0, 3, 7, 11] };
  const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11] };
  const TRACKS = {
    menu:   { bpm: 64, root: 57, scale: 'minor', prog: [[0, 'm9'], [8, 'M7'], [5, 'm7'], [7, 'sus']], pad: 'darkpad', arp: 'glass', arpPat: [0, 2, 1, 3, 2, 1], arpDiv: 2, lead: 'flute', leadDens: 0.22, bass: null, drums: null, swing: 0 },
    crypte: { bpm: 88, root: 50, scale: 'minor', prog: [[0, 'm'], [0, 'm'], [8, 'M'], [10, 'M'], [0, 'm'], [5, 'm'], [3, 'M'], [7, 'M']], pad: 'darkpad', arp: 'pluck', arpPat: [0, 1, 2, 1, 0, 2, 1, 2], arpDiv: 1, lead: 'bell', leadDens: 0.3, bass: 'bass', bassPat: 'x..x..x.x..x..x.', drums: { kick: 'x...x...x...x..x', snare: '....x.......x...', hat: '..x...x...x...x.' }, swing: 0 },
    marais: { bpm: 82, root: 52, scale: 'dorian', prog: [[0, 'm7'], [3, 'M7'], [0, 'm7'], [10, 'M']], pad: 'pad', arp: 'marimba', arpPat: [0, 2, 1, 3, 0, 1, 2, 1], arpDiv: 1, lead: 'flute', leadDens: 0.28, bass: 'subbass', bassPat: 'x.....x...x.....', drums: { kick: 'x.....x...x.....', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.', shaker: true, tom: '..........x..x..' }, swing: 0.16 },
    forge:  { bpm: 118, root: 48, scale: 'phrygian', prog: [[0, 'm'], [1, 'M'], [0, 'm'], [8, 'M'], [0, 'm'], [1, 'M'], [3, 'm'], [7, 'M']], pad: 'pad', arp: 'lead', arpPat: [0, 0, 2, 0, 1, 0, 2, 2], arpDiv: 1, lead: 'lead', leadDens: 0.2, bass: 'bass', bassPat: 'x.x.x.x.x.x.x.x.', drums: { kick: 'x..xx..x..x.x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', anvil: '....x.......x..x' }, swing: 0 },
    givre:  { bpm: 72, root: 54, scale: 'minor', prog: [[0, 'm9'], [10, 'M7'], [8, 'M7'], [3, 'M']], pad: 'darkpad', arp: 'glass', arpPat: [0, 3, 2, 1, 3, 0, 1, 2], arpDiv: 2, lead: 'glass', leadDens: 0.2, bass: 'subbass', bassPat: 'x.......x.......', drums: { kick: 'x.......x.......', snare: '........x.......', hat: '....x.......x...' }, swing: 0 },
    abime:  { bpm: 98, root: 47, scale: 'phrygian', prog: [[0, 'm'], [1, 'dim'], [0, 'm'], [6, 'm'], [0, 'm'], [1, 'dim'], [3, 'm'], [8, 'M']], pad: 'darkpad', arp: 'pluck', arpPat: [0, 2, 0, 1, 0, 2, 1, 0], arpDiv: 1, lead: 'lead', leadDens: 0.22, bass: 'subbass', bassPat: 'x..x....x..x..x.', drums: { kick: 'x..x....x..x....', snare: '....x.......x...', hat: 'x..x..x..x..x..x', tom: '......x.......x.' }, swing: 0 },
    boss:   { bpm: 134, root: 50, scale: 'harm', prog: [[0, 'm'], [0, 'm'], [8, 'M'], [7, 'M'], [0, 'm'], [1, 'M'], [6, 'dim'], [7, 'M']], pad: 'pad', arp: 'lead', arpPat: [0, 2, 1, 2, 0, 2, 1, 3], arpDiv: 1, lead: 'lead', leadDens: 0.35, bass: 'bass', bassPat: 'xxx.x.xxx.x.x.x.', drums: { kick: 'x.x.x.x.x.x.x.xx', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', tom: '..............xx', anvil: '........x.......' }, swing: 0, full: true },
  };

  function play(id, opts) {
    if (!ac) return;
    const tpl = TRACKS[id]; if (!tpl) return;
    const key = id + ':' + ((opts && opts.root) || tpl.root);
    if (M.id === key) return;
    M.id = key; M.tpl = Object.assign({}, tpl, opts || {});
    M.step = 0; M.bar = 0; M.nextT = ac.currentTime + 0.15; M.rand = mulberry32(hashStr(key)); M.lastDeg = 7;
    M.fadeGain.gain.cancelScheduledValues(ac.currentTime); M.fadeGain.gain.setValueAtTime(0.0001, ac.currentTime); M.fadeGain.gain.exponentialRampToValueAtTime(1, ac.currentTime + 1.2);
    if (tpl.full) M.targetInt = 1;
  }
  function stop() { M.id = null; M.tpl = null; }
  function setIntensity(v) { if (!(M.tpl && M.tpl.full)) M.targetInt = v; }

  function scheduleStep(t) {
    const T = M.tpl, s = M.step % 16, bar = M.bar, chord = T.prog[bar % T.prog.length];
    const rootMidi = T.root + chord[0], tones = CHORD[chord[1]], stepDur = 60 / T.bpm / 4, barDur = stepDur * 16;
    const hum = () => (M.rand() - 0.5) * 0.014;
    if (s === 0 && T.pad) for (const iv of tones) INST[T.pad](t, mtof(rootMidi + iv), barDur, 0.5, layers.pad);
    if (T.arp) {
      const div = T.arpDiv || 1;
      if (s % div === 0) {
        const idx = (s / div) | 0, deg = T.arpPat[idx % T.arpPat.length];
        const iv = tones[deg % tones.length] + 12 * Math.floor(deg / tones.length);
        INST[T.arp](t + hum(), mtof(rootMidi + 12 + iv), stepDur * div, 0.3 + 0.12 * M.rand(), layers.arp);
      }
    }
    if (T.bass && T.bassPat[s] === 'x') INST[T.bass](t, mtof(rootMidi - 12 + (s === 10 && M.rand() < 0.3 ? 7 : 0)), stepDur * 2, 0.55, layers.bass);
    if (T.drums) {
      const D = T.drums;
      if (D.kick && D.kick[s] === 'x') INST.kick(t, 0.9, layers.drums);
      if (D.snare && D.snare[s] === 'x') INST.snare(t, 0.7, layers.drums);
      if (D.hat && D.hat[s] === 'x') INST.hat(t + hum(), 0.45 + 0.3 * M.rand(), layers.drums, s % 4 === 2);
      if (D.tom && D.tom[s] === 'x') INST.tom(t, 0.55, layers.drums, s % 8 ? 90 : 130);
      if (D.anvil && D.anvil[s] === 'x') INST.anvil(t, 0.55, layers.drums);
      if (D.shaker && s % 2 === 1) INST.shaker(t + hum(), 0.4, layers.drums);
    }
    if (T.lead && s % 2 === 0) {
      // phrase de 4 mesures dont le rythme se répète, notes en marche aléatoire sur la gamme
      const phraseSeed = hashStr(M.id) + (Math.floor(bar / 4) % 2) * 977 + (bar % 4) * 131 + s * 17;
      const r1 = mulberry32(phraseSeed)();
      if (r1 < T.leadDens) {
        const r2 = mulberry32(phraseSeed * 7 + 3)();
        const mv = r2 < 0.2 ? 0 : r2 < 0.45 ? 1 : r2 < 0.7 ? -1 : r2 < 0.85 ? 2 : -2;
        M.lastDeg = clamp(M.lastDeg + mv, 4, 15);
        const scale = SCALES[T.scale], oct = Math.floor(M.lastDeg / 7), deg = M.lastDeg % 7;
        const midi = T.root + 12 + oct * 12 + scale[deg];
        const len = stepDur * (r1 < T.leadDens * 0.3 ? 4 : 2);
        INST[T.lead](t + hum(), mtof(midi), len, 0.32 + 0.1 * M.rand(), layers.lead);
      }
    }
  }
  function update(dt) {
    if (!ac) return;
    const now = ac.currentTime;
    M.intensity = lerp(M.intensity, M.targetInt, 0.04);
    layers.bass.gain.setTargetAtTime(M.intensity, now, 0.4);
    layers.drums.gain.setTargetAtTime(M.intensity, now, 0.4);
    if (M.tpl) {
      const stepDur = 60 / M.tpl.bpm / 4;
      while (M.nextT < now + 0.35) {
        scheduleStep(M.nextT);
        const sw = M.tpl.swing * stepDur;
        M.nextT += stepDur + (M.step % 2 === 0 ? sw : -sw);
        M.step++; if (M.step % 16 === 0) M.bar++;
      }
    }
    if (amb && amb.kind === 'drip') {
      dripT -= dt;
      if (dripT <= 0) { dripT = 1.5 + Math.random() * 4; voice({ type: 'sine', freq: 1400 + Math.random() * 1800, t: now, dur: 0.03, vel: 0.08, a: 0.002, d: 0.12, s: 0, r: 0.4, dest: layers.amb, rev: 0.9, pan: Math.random() * 1.6 - 0.8 }); }
    }
  }

  /* ---------- ambiances ---------- */
  function setAmbience(kind) {
    if (!ac) return;
    if (amb && amb.kind === kind) return;
    if (amb) { for (const n of amb.nodes) { try { n.stop ? n.stop(ac.currentTime + 1) : 0; } catch (e) {} } amb.gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.4); }
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
    const target = { drip: 0.5, swamp: 0.5, fire: 0.55, wind: 0.6, void: 0.5, none: 0 }[kind] || 0;
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

  /* ---------- bruitages ---------- */
  const SFX_DEFS = {
    shoot_wand: t => { voice({ type: 'sine', freq: 880, t, dur: 0.05, vel: 0.12, a: 0.002, d: 0.06, s: 0, r: 0.05, slide: 0.45 }); noise({ t, dur: 0.04, vel: 0.06, cutoff: 3000, q: 2 }); },
    shoot_bow: t => { noise({ t, dur: 0.12, vel: 0.2, cutoff: 900, cutEnd: 4000, q: 1.5 }); voice({ type: 'triangle', freq: 220, t, dur: 0.03, vel: 0.15, a: 0.002, d: 0.12, s: 0, r: 0.1, slide: 0.7 }); },
    shoot_blades: t => { noise({ t, dur: 0.16, vel: 0.22, cutoff: 500, cutEnd: 3500, q: 1.2, rev: 0.2 }); },
    shoot_orb: t => { voice({ type: 'sine', freq: 180, t, dur: 0.15, vel: 0.2, a: 0.01, d: 0.15, s: 0.2, r: 0.1, slide: 1.8 }); noise({ t, dur: 0.15, vel: 0.1, cutoff: 600, ftype: 'lowpass' }); },
    shoot_storm: t => { noise({ t, dur: 0.09, vel: 0.2, cutoff: 5000, ftype: 'highpass', q: 1 }); voice({ type: 'square', freq: 1200, t, dur: 0.04, vel: 0.07, a: 0.002, d: 0.05, s: 0, r: 0.03, slide: 0.3 }); },
    hit: t => { noise({ t, dur: 0.08, vel: 0.22, cutoff: 700, ftype: 'lowpass', q: 1 }); voice({ type: 'sine', freq: 160, t, dur: 0.04, vel: 0.2, a: 0.002, d: 0.07, s: 0, r: 0.05, slide: 0.5 }); },
    crit: t => { SFX_DEFS.hit(t); voice({ type: 'triangle', freq: 1500, t, dur: 0.05, vel: 0.12, a: 0.002, d: 0.1, s: 0, r: 0.1, slide: 0.5 }); },
    kill: t => { noise({ t, dur: 0.22, vel: 0.28, cutoff: 350, ftype: 'lowpass', q: 1.5, rev: 0.3 }); voice({ type: 'triangle', freq: 260, t, dur: 0.1, vel: 0.2, a: 0.002, d: 0.2, s: 0, r: 0.15, slide: 0.35, rev: 0.3 }); },
    killBoss: t => { noise({ t, dur: 1.4, vel: 0.5, cutoff: 260, ftype: 'lowpass', q: 1, rev: 0.8 }); voice({ type: 'sine', freq: 80, t, dur: 0.8, vel: 0.5, a: 0.01, d: 0.6, s: 0.3, r: 0.6, slide: 0.35, rev: 0.5 }); voice({ type: 'sawtooth', freq: 120, t: t + 0.05, dur: 0.5, vel: 0.15, a: 0.01, d: 0.4, s: 0.2, r: 0.4, slide: 0.4, cutoff: 900, rev: 0.6 }); },
    hurt: t => { noise({ t, dur: 0.25, vel: 0.35, cutoff: 500, ftype: 'lowpass', q: 1 }); voice({ type: 'sawtooth', freq: 130, t, dur: 0.18, vel: 0.22, a: 0.002, d: 0.2, s: 0.1, r: 0.15, slide: 0.5, cutoff: 700 }); voice({ type: 'sine', freq: 60, t, dur: 0.25, vel: 0.35, a: 0.002, d: 0.25, s: 0, r: 0.1 }); },
    dodge: t => { noise({ t, dur: 0.12, vel: 0.15, cutoff: 2500, cutEnd: 6000, q: 2 }); },
    shield: t => { voice({ type: 'sine', freq: 1046, t, dur: 0.1, vel: 0.18, a: 0.003, d: 0.4, s: 0.1, r: 0.5, fm: true, fmRatio: 2.5, fmDepth: 0.8, rev: 0.6 }); voice({ type: 'sine', freq: 1568, t: t + 0.04, dur: 0.1, vel: 0.1, a: 0.003, d: 0.4, s: 0, r: 0.5, rev: 0.6 }); },
    dash: t => { noise({ t, dur: 0.22, vel: 0.22, cutoff: 700, cutEnd: 2600, q: 1.4, rev: 0.15 }); },
    coin: t => { for (const [f, d] of [[1760, 0], [2349, 0.07]]) voice({ type: 'sine', freq: f, t: t + d, dur: 0.03, vel: 0.1, a: 0.002, d: 0.18, s: 0, r: 0.2, fm: true, fmRatio: 3, fmDepth: 0.3, rev: 0.4 }); },
    heart: t => { for (const [f, d] of [[523, 0], [659, 0.08], [784, 0.16], [1046, 0.24]]) voice({ type: 'sine', freq: f, t: t + d, dur: 0.1, vel: 0.13, a: 0.005, d: 0.3, s: 0.1, r: 0.5, rev: 0.6 }); },
    clear: t => { for (const [f, d] of [[523, 0], [659, 0.09], [784, 0.18], [1046, 0.27]]) INST.bell(t + d, f, 0.2, 0.35, sfxBus); },
    doorOpen: t => { noise({ t, dur: 0.6, vel: 0.2, cutoff: 200, cutEnd: 500, ftype: 'lowpass', q: 2, a: 0.05, rev: 0.4 }); voice({ type: 'sine', freq: 70, t, dur: 0.5, vel: 0.15, a: 0.05, d: 0.4, s: 0.2, r: 0.2, rev: 0.3 }); },
    doorClose: t => { noise({ t, dur: 0.25, vel: 0.3, cutoff: 300, ftype: 'lowpass', q: 1, rev: 0.5 }); voice({ type: 'sine', freq: 55, t, dur: 0.3, vel: 0.35, a: 0.002, d: 0.3, s: 0, r: 0.15, rev: 0.4 }); },
    boss: t => { voice({ type: 'sawtooth', freq: 65, t, dur: 1.2, vel: 0.3, a: 0.05, d: 0.8, s: 0.4, r: 0.6, cutoff: 400, q: 2, fenv: 3, fdec: 1, rev: 0.7 }); noise({ t, dur: 1.2, vel: 0.2, cutoff: 250, ftype: 'lowpass', rev: 0.8 }); voice({ type: 'square', freq: 98, t: t + 0.1, dur: 0.9, vel: 0.08, a: 0.1, d: 0.5, s: 0.3, r: 0.5, vib: 30, vibRate: 4, cutoff: 500, rev: 0.6 }); },
    relic: t => { for (const [f, d] of [[659, 0], [988, 0.1], [1319, 0.2], [1976, 0.32]]) INST.glass(t + d, f, 0.3, 0.35, sfxBus); },
    stairs: t => { for (const [f, d] of [[392, 0], [494, 0.12], [587, 0.24], [784, 0.4]]) INST.bell(t + d, f, 0.3, 0.4, sfxBus); noise({ t, dur: 0.6, vel: 0.12, cutoff: 300, cutEnd: 900, ftype: 'lowpass', a: 0.1, rev: 0.6 }); },
    boom: t => { noise({ t, dur: 0.5, vel: 0.45, cutoff: 400, ftype: 'lowpass', q: 1, rev: 0.5 }); voice({ type: 'sine', freq: 90, t, dur: 0.35, vel: 0.4, a: 0.002, d: 0.35, s: 0, r: 0.1, slide: 0.4 }); },
    explode: t => { noise({ t, dur: 0.7, vel: 0.5, cutoff: 600, cutEnd: 120, ftype: 'lowpass', q: 1, rev: 0.6 }); voice({ type: 'sine', freq: 110, t, dur: 0.5, vel: 0.45, a: 0.002, d: 0.5, s: 0, r: 0.1, slide: 0.3 }); },
    surge: t => { noise({ t, dur: 0.6, vel: 0.3, cutoff: 400, cutEnd: 6000, q: 2, a: 0.3, rev: 0.4 }); for (const [f, d] of [[440, 0.3], [660, 0.36], [880, 0.42], [1320, 0.48]]) voice({ type: 'square', freq: f, t: t + d, dur: 0.08, vel: 0.08, a: 0.002, d: 0.15, s: 0, r: 0.2, cutoff: 3000, rev: 0.4 }); },
    combo: (t, n) => { voice({ type: 'sine', freq: 600 + Math.min(n, 20) * 60, t, dur: 0.03, vel: 0.1, a: 0.002, d: 0.08, s: 0, r: 0.08, fm: true, fmRatio: 2, fmDepth: 0.4 }); },
    fall: t => { noise({ t, dur: 0.5, vel: 0.25, cutoff: 1500, cutEnd: 200, q: 1, rev: 0.7 }); voice({ type: 'sine', freq: 500, t, dur: 0.45, vel: 0.15, a: 0.002, d: 0.45, s: 0, r: 0.1, slide: 0.2, rev: 0.6 }); },
    splash: t => { noise({ t, dur: 0.2, vel: 0.12, cutoff: 1200, cutEnd: 3500, q: 1.2, rev: 0.3 }); },
    sizzle: t => { noise({ t, dur: 0.3, vel: 0.18, cutoff: 4000, q: 1.5, rev: 0.2 }); },
    poison: t => { noise({ t, dur: 0.3, vel: 0.12, cutoff: 800, q: 3, cutEnd: 300, rev: 0.4 }); voice({ type: 'triangle', freq: 300, t, dur: 0.2, vel: 0.1, a: 0.01, d: 0.2, s: 0, r: 0.1, slide: 0.6 }); },
    iceCrack: t => { noise({ t, dur: 0.15, vel: 0.2, cutoff: 5000, q: 4, cutEnd: 2000, rev: 0.4 }); voice({ type: 'sine', freq: 2600, t, dur: 0.05, vel: 0.08, a: 0.002, d: 0.2, s: 0, r: 0.3, fm: true, fmRatio: 4.1, fmDepth: 0.6, rev: 0.6 }); },
    hop: t => { voice({ type: 'sine', freq: 110, t, dur: 0.12, vel: 0.35, a: 0.002, d: 0.15, s: 0, r: 0.1, slide: 0.4 }); noise({ t, dur: 0.12, vel: 0.2, cutoff: 500, ftype: 'lowpass' }); },
    web: t => { noise({ t, dur: 0.15, vel: 0.12, cutoff: 3000, cutEnd: 800, q: 2 }); },
    zap: t => { noise({ t, dur: 0.12, vel: 0.2, cutoff: 6000, ftype: 'highpass' }); voice({ type: 'sawtooth', freq: 900, t, dur: 0.08, vel: 0.08, a: 0.002, d: 0.08, s: 0, r: 0.05, slide: 0.4, cutoff: 4000 }); },
    laser: t => { voice({ type: 'sawtooth', freq: 220, t, dur: 1.2, vel: 0.12, a: 0.1, d: 0.3, s: 0.6, r: 0.3, cutoff: 1500, q: 3, vib: 20, vibRate: 12, rev: 0.4 }); noise({ t, dur: 1.3, vel: 0.1, cutoff: 3000, q: 1, a: 0.2, rev: 0.3 }); },
    telegraph: t => { voice({ type: 'sine', freq: 330, t, dur: 0.15, vel: 0.1, a: 0.01, d: 0.2, s: 0, r: 0.2, rev: 0.5 }); },
    blink: t => { noise({ t, dur: 0.25, vel: 0.2, cutoff: 800, cutEnd: 5000, q: 2, rev: 0.6 }); voice({ type: 'sine', freq: 400, t, dur: 0.2, vel: 0.1, a: 0.01, d: 0.2, s: 0, r: 0.2, slide: 3, rev: 0.5 }); },
    hunter: t => { for (const f of [110, 116.5, 164]) voice({ type: 'sawtooth', freq: f, t, dur: 1.5, vel: 0.08, a: 0.4, d: 0.5, s: 0.6, r: 1, cutoff: 500, rev: 0.9 }); },
    buy: t => { for (const [f, d] of [[1046, 0], [1568, 0.06]]) voice({ type: 'sine', freq: f, t: t + d, dur: 0.04, vel: 0.12, a: 0.002, d: 0.15, s: 0, r: 0.2, fm: true, fmRatio: 2, fmDepth: 0.3, rev: 0.4 }); },
    deny: t => { voice({ type: 'square', freq: 180, t, dur: 0.12, vel: 0.08, a: 0.002, d: 0.1, s: 0.3, r: 0.05, cutoff: 800 }); },
    click: t => { voice({ type: 'sine', freq: 900, t, dur: 0.02, vel: 0.06, a: 0.001, d: 0.04, s: 0, r: 0.03 }); },
    swap: t => { noise({ t, dur: 0.2, vel: 0.15, cutoff: 2000, cutEnd: 500, q: 1.5 }); voice({ type: 'triangle', freq: 500, t, dur: 0.1, vel: 0.1, a: 0.005, d: 0.15, s: 0, r: 0.1, slide: 1.5 }); },
    revive: t => { for (const [f, d] of [[392, 0], [523, 0.15], [659, 0.3], [784, 0.45], [1046, 0.6]]) INST.glass(t + d, f, 0.4, 0.4, sfxBus); noise({ t, dur: 1, vel: 0.1, cutoff: 500, cutEnd: 4000, a: 0.5, rev: 0.7 }); },
    die: t => { voice({ type: 'sawtooth', freq: 220, t, dur: 1.2, vel: 0.2, a: 0.01, d: 1, s: 0.2, r: 0.5, slide: 0.25, cutoff: 900, rev: 0.7 }); noise({ t, dur: 1.5, vel: 0.25, cutoff: 400, cutEnd: 80, ftype: 'lowpass', rev: 0.8 }); },
    wave: t => { for (const [f, d] of [[330, 0], [392, 0.1], [494, 0.2]]) voice({ type: 'square', freq: f, t: t + d, dur: 0.08, vel: 0.07, a: 0.002, d: 0.15, s: 0, r: 0.2, cutoff: 2000, rev: 0.5 }); },
    thud: t => { voice({ type: 'sine', freq: 80, t, dur: 0.12, vel: 0.3, a: 0.002, d: 0.15, s: 0, r: 0.1, slide: 0.5 }); noise({ t, dur: 0.1, vel: 0.15, cutoff: 400, ftype: 'lowpass' }); },
  };
  const lastPlayed = {};
  function sfx(name, arg) {
    if (!ac) return;
    const now = ac.currentTime;
    if (lastPlayed[name] && now - lastPlayed[name] < 0.03) return;   // anti-spam
    lastPlayed[name] = now;
    const f = SFX_DEFS[name]; if (f) f(now, arg);
  }

  return { init, resume, setVolumes, play, stop, setIntensity, update, setAmbience, sfx, get ready() { return !!ac; } };
})();
const SFX = (n, a) => Audio.sfx(n, a);
