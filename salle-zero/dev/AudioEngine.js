/* =====================================================================
   SALLE ZÉRO — AudioEngine
   ---------------------------------------------------------------------
   Moteur audio procédural (Web Audio API, JS vanilla, aucune dépendance).

   Principes :
   - Aucun oscillateur nu en sortie : chaque source oscillante traverse au
     moins un filtre résonant balayé, une saturation douce (WaveShaper tanh)
     ou une modulation FM/AM, et se mélange à une couche de bruit.
   - Chaque son = couches : transitoire (bruit court) + corps (filtre
     résonant / FM saturée) + queue (réverbe par convolution, IR générée).
   - Variation aléatoire de hauteur (±7 %) et de gain (±10 %) à chaque tir.
   - Polyphonie bornée (24 voix), chaque voix se nettoie (stop + disconnect).
   - Tout est silencieux (aucune exception) tant que init() n'a pas été appelé.

   Graphe :
     voix → StereoPanner → bus SFX ─┐
     voix → send → Convolver → retour réverbe ─┤→ master → Compressor → destination
     musique / génératif → duck → bus musique ─┘
   ===================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* État global                                                         */
  /* ------------------------------------------------------------------ */
  let ctx = null;
  let sr = 44100;
  let master, comp, sfxBus, musicBus, musicDuck, reverbIn, convolver, reverbReturn;
  const noiseBuf = { white: null, pink: null, brown: null };
  const vol = { master: 0.8, sfx: 1.0, music: 0.7 };
  const MAX_VOICES = 24;
  const voices = [];          // voix SFX actives (pool borné)
  const shaperCache = new Map();
  const NAMES = [];           // liste publique des sons (ordre d'enregistrement)
  const api = {};

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                         */
  /* ------------------------------------------------------------------ */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const isNum = (v) => typeof v === 'number' && isFinite(v);

  /** Normalise les options d'un événement : {x, intensity} → pan + facteurs aléatoires. */
  function norm(o) {
    o = o || {};
    const I = isNum(o.intensity) ? clamp(o.intensity, 0, 1) : 0.8;
    return {
      x: isNum(o.x) ? clamp(o.x, -1, 1) : 0,
      I,
      p: 1 + rnd(-0.07, 0.07),                       // jitter de hauteur ±7 %
      g: (1 + rnd(-0.1, 0.1)) * (0.55 + 0.45 * I),   // jitter de gain ±10 %, pondéré par l'intensité
    };
  }

  /** Enveloppe percussive : montée linéaire puis décroissance exponentielle. */
  function perc(param, t, peak, att, dec) {
    peak = Math.max(peak, 0.0002);
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + att);
    param.exponentialRampToValueAtTime(0.0001, t + att + dec);
  }

  /** Enveloppe ADSR : a/d/s puis maintien jusqu'à t+hold, relâchement r. */
  function adsr(param, t, peak, a, d, s, hold, r) {
    peak = Math.max(peak, 0.0002);
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.linearRampToValueAtTime(Math.max(peak * s, 0.0002), t + a + d);
    param.setValueAtTime(Math.max(peak * s, 0.0002), t + Math.max(hold, a + d));
    param.exponentialRampToValueAtTime(0.0001, t + Math.max(hold, a + d) + r);
  }

  /** Balayage d'un paramètre (fréquence de filtre, hauteur...) de from → to. */
  function sweep(param, t, from, to, dur, linear) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(Math.max(from, 1e-3), t);
    if (linear) param.linearRampToValueAtTime(to, t + dur);
    else param.exponentialRampToValueAtTime(Math.max(to, 1e-3), t + dur);
  }

  /** Courbe de saturation douce tanh (mise en cache par drive). */
  function tanhCurve(drive) {
    const key = Math.round(drive * 100);
    if (shaperCache.has(key)) return shaperCache.get(key);
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(x * drive) / Math.tanh(drive);
    }
    shaperCache.set(key, c);
    return c;
  }

  /* ------------------------------------------------------------------ */
  /* Génération des buffers (bruits, impulse response)                   */
  /* ------------------------------------------------------------------ */
  function makeNoise(type, seconds) {
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    if (type === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (type === 'pink') {
      // Filtre de Paul Kellet (approximation 1/f)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else { // brown : intégration du bruit blanc (fuite pour rester borné)
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }

  /** Impulse response stéréo : bruit décroissant exponentiellement, légèrement assombri. */
  function makeIR(seconds, decay) {
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-decay * t) * (i < 300 ? i / 300 : 1); // pré-délai très court
        const w = Math.random() * 2 - 1;
        lp += 0.35 * (w - lp);          // one-pole lowpass → queue plus sombre
        d[i] = lp * env * (ch ? 0.9 : 1);
      }
    }
    return buf;
  }

  /* ------------------------------------------------------------------ */
  /* Initialisation                                                      */
  /* ------------------------------------------------------------------ */
  function buildGraph() {
    sr = ctx.sampleRate;
    master = ctx.createGain(); master.gain.value = vol.master;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.18;
    master.connect(comp); comp.connect(ctx.destination);

    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music; musicBus.connect(master);
    musicDuck = ctx.createGain(); musicDuck.gain.value = 1; musicDuck.connect(musicBus);

    // Bus réverbe : convolution avec IR générée, retour vers le master
    reverbIn = ctx.createGain(); reverbIn.gain.value = 1;
    convolver = ctx.createConvolver();
    convolver.buffer = makeIR(1.8, 3.6);
    reverbReturn = ctx.createGain(); reverbReturn.gain.value = 0.55;
    reverbIn.connect(convolver); convolver.connect(reverbReturn); reverbReturn.connect(master);

    noiseBuf.white = makeNoise('white', 2);
    noiseBuf.pink = makeNoise('pink', 2);
    noiseBuf.brown = makeNoise('brown', 2);
  }

  /**
   * Crée l'AudioContext (à appeler sur un geste utilisateur). Idempotent.
   * opts.context : contexte externe (ex. OfflineAudioContext pour les tests).
   */
  function init(opts) {
    opts = opts || {};
    try {
      if (opts.context && opts.context !== ctx) {
        teardown();
        ctx = opts.context;
        buildGraph();
        return true;
      }
      if (ctx) { resume(); return true; }
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC({ latencyHint: 'interactive' });
      buildGraph();
      resume();
      return true;
    } catch (e) {
      console.warn('[AudioEngine] init impossible :', e);
      ctx = null;
      return false;
    }
  }

  function resume() {
    if (!ctx) return;
    try { if (ctx.state === 'suspended' && ctx.resume) ctx.resume(); } catch (e) { /* silencieux */ }
  }

  function teardown() {
    try {
      for (const v of voices.slice()) v.kill();
      stopGenerativeMusic(0);
      if (music.cur) { try { music.cur.stop(); } catch (e) { /* */ } music.cur = null; }
      flame.v = null;
    } catch (e) { /* silencieux */ }
  }

  function setVolume(o) {
    o = o || {};
    if (isNum(o.master)) vol.master = clamp(o.master, 0, 1);
    if (isNum(o.sfx)) vol.sfx = clamp(o.sfx, 0, 1);
    if (isNum(o.music)) vol.music = clamp(o.music, 0, 1);
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(vol.master, t, 0.02);
    sfxBus.gain.setTargetAtTime(vol.sfx, t, 0.02);
    musicBus.gain.setTargetAtTime(vol.music, t, 0.02);
  }
  function getVolume() { return { master: vol.master, sfx: vol.sfx, music: vol.music }; }

  /** Baisse brève du master (coup reçu), retour en `seconds`. */
  function duckMaster(amount, seconds) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(vol.master * (1 - amount), t + 0.015);
    master.gain.setTargetAtTime(vol.master, t + 0.05, seconds / 3);
  }

  /* ------------------------------------------------------------------ */
  /* Voix : mini-graphe jetable avec nettoyage automatique               */
  /* ------------------------------------------------------------------ */
  /**
   * @param o     options normalisées (pan)
   * @param dur   durée totale (s) après laquelle la voix est détruite (Infinity = manuelle)
   * @param prio  priorité 0..10 (plus haut = moins facilement évincée)
   * @param bus   nœud de sortie (sfxBus par défaut) ; pooled=false pour la musique
   */
  function voice(o, dur, prio, bus, pooled) {
    const now = ctx.currentTime;
    bus = bus || sfxBus;
    pooled = pooled !== false;
    if (pooled) {
      // Nettoyage des voix expirées puis éviction si la polyphonie est saturée
      for (const v of voices.slice()) if (v.end < now) v.kill();
      if (voices.length >= MAX_VOICES) {
        let victim = null;
        for (const v of voices) {
          if (v.prio <= prio && (!victim || v.prio < victim.prio || (v.prio === victim.prio && v.end < victim.end))) victim = v;
        }
        if (!victim) return null;      // la nouvelle voix est moins prioritaire : ignorée
        victim.kill();
      }
    }
    const v = { prio, end: now + (isFinite(dur) ? dur : 1e9), nodes: [], sources: [], dead: false, t: now };
    v.out = ctx.createGain(); v.out.gain.value = 1;
    v.pan = ctx.createStereoPanner(); v.pan.pan.value = o.x * 0.8;
    v.send = ctx.createGain(); v.send.gain.value = 0;
    v.out.connect(v.pan); v.pan.connect(bus);
    v.out.connect(v.send); v.send.connect(reverbIn);
    v.nodes.push(v.out, v.pan, v.send);

    v.add = (n) => { v.nodes.push(n); return n; };
    v.gain = (val) => { const g = ctx.createGain(); g.gain.value = isNum(val) ? val : 1; return v.add(g); };
    v.filter = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (isNum(q)) b.Q.value = q; return v.add(b); };
    v.shaper = (drive) => { const s = ctx.createWaveShaper(); s.curve = tanhCurve(drive || 2); s.oversample = '2x'; return v.add(s); };
    v.src = (s, t0, t1) => { s.start(t0); if (isFinite(t1)) s.stop(t1); v.sources.push(s); v.nodes.push(s); return s; };
    v.noise = (type, t0, t1) => {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf[type] || noiseBuf.white; s.loop = true;
      s.loopStart = 0; s.loopEnd = s.buffer.duration;
      s.start(t0, rnd(0, s.buffer.duration * 0.9)); if (isFinite(t1)) s.stop(t1);
      v.sources.push(s); v.nodes.push(s); return s;
    };
    v.osc = (type, f, t0, t1) => { const s = ctx.createOscillator(); s.type = type; s.frequency.value = f; return v.src(s, t0, t1); };
    /** FM : modulateur → gain(index) → carrier.frequency. Retourne {car, mod, idx}. */
    v.fm = (cf, mf, index, t0, t1, carType, modType) => {
      const car = ctx.createOscillator(); car.type = carType || 'sine'; car.frequency.value = cf;
      const mod = ctx.createOscillator(); mod.type = modType || 'sine'; mod.frequency.value = mf;
      const idx = ctx.createGain(); idx.gain.value = index;
      mod.connect(idx); idx.connect(car.frequency);
      v.add(idx); v.src(mod, t0, t1); v.src(car, t0, t1);
      return { car, mod, idx };
    };
    /** LFO : oscillateur → gain(depth) → param. */
    v.lfo = (rate, depth, param, t0, t1, type) => {
      const l = ctx.createOscillator(); l.type = type || 'sine'; l.frequency.value = rate;
      const g = ctx.createGain(); g.gain.value = depth; l.connect(g); g.connect(param);
      v.add(g); v.src(l, t0, t1); return l;
    };
    /** AM par bruit : bruit → lowpass → gain(depth) → param (crépitement). */
    v.noiseMod = (type, cutoff, depth, param, t0, t1) => {
      const n = v.noise(type, t0, t1); const f = v.filter('lowpass', cutoff, 0.7); const g = v.gain(depth);
      n.connect(f); f.connect(g); g.connect(param); return g;
    };
    v.chain = function () { for (let i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]); return arguments[arguments.length - 1]; };
    v.reverb = (amt) => { v.send.gain.value = amt; };
    v.kill = () => {
      if (v.dead) return; v.dead = true;
      for (const s of v.sources) { try { s.stop(); } catch (e) { /* déjà arrêtée */ } }
      for (const n of v.nodes) { try { n.disconnect(); } catch (e) { /* */ } }
      const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1);
      if (v.timer) clearTimeout(v.timer);
    };
    if (pooled) voices.push(v);
    if (isFinite(dur) && typeof setTimeout === 'function') v.timer = setTimeout(v.kill, (dur + 0.15) * 1000);
    return v;
  }

  /* ------------------------------------------------------------------ */
  /* Briques réutilisables (couches)                                     */
  /* ------------------------------------------------------------------ */
  /** Transitoire : bruit blanc court à travers un bandpass résonant. */
  function layerClick(v, t, o, f, q, gain, dur) {
    const n = v.noise('white', t, t + dur + 0.02);
    const b = v.filter('bandpass', f * o.p, q); const g = v.gain(0);
    v.chain(n, b, g, v.out); perc(g.gain, t, gain * o.g, 0.002, dur);
    return g;
  }
  /** Corps grave : sinus balayé → tanh → lowpass (jamais nu en sortie). */
  function layerThump(v, t, o, f0, f1, gain, dur, drive) {
    const s = v.osc('sine', f0 * o.p, t, t + dur + 0.05);
    sweep(s.frequency, t, f0 * o.p, f1 * o.p, dur * 0.8);
    const sh = v.shaper(drive || 3); const lp = v.filter('lowpass', f0 * 4, 1); const g = v.gain(0);
    v.chain(s, sh, lp, g, v.out); perc(g.gain, t, gain * o.g, 0.004, dur);
    return g;
  }
  /** Nappe : 2 dents-de-scie détunées → lowpass résonant balayé → tanh. */
  function layerPad(v, t, o, freq, gain, a, hold, r, cutoff0, cutoff1, q, drive) {
    const mix = v.gain(0.3);
    for (const det of [-7, 7]) {
      const s = v.osc('sawtooth', freq * o.p, t, t + a + hold + r + 0.05);
      s.detune.value = det + rnd(-3, 3); s.connect(mix);
    }
    const lp = v.filter('lowpass', cutoff0, q || 2); const sh = v.shaper(drive || 1.5); const g = v.gain(0);
    sweep(lp.frequency, t, cutoff0, cutoff1, a + hold * 0.7);
    v.chain(mix, lp, sh, g, v.out); adsr(g.gain, t, gain * o.g, a, 0.05, 1, a + hold, r);
    return g;
  }

  /* ------------------------------------------------------------------ */
  /* Déclaration d'un son : enveloppe protectrice + enregistrement        */
  /* ------------------------------------------------------------------ */
  /** Trim de niveau par son (équilibrage mesuré en rendu offline : pic visé ≈ 0,15-0,35, boss ≈ 0,6). */
  const LEVELS = {
    shootBlade: 4, shootBow: 2.5, shootBoomerang: 3.5, shootChain: 5, hitEnemy: 2, dash: 3.5, skillTurret: 2,
    pickupXp: 5, pickupCoin: 5, pickupFragment: 3, trapWarn: 3, trapSpike: 5, uiHover: 6, uiClick: 4, uiConfirm: 1.5,
    chestOpen: 1.5, bossRoar: 0.8, playerDie: 0.8,
  };
  function def(name, prio, fn) {
    NAMES.push(name);
    const trim = LEVELS[name] || 1;
    api[name] = function (opts) {
      if (!ctx) return;
      try { const o = norm(opts); o.g *= trim; fn(o, ctx.currentTime + 0.005); } catch (e) { console.warn('[AudioEngine] ' + name, e); }
    };
  }

  /* ==================================================================
     TIRS PAR FAMILLE D'ARME
     ================================================================== */

  // shootBlade : fouet d'air → bruit blanc bandpass balayé 3 kHz→700 Hz + click sec + queue courte.
  def('shootBlade', 4, (o, t) => {
    const v = voice(o, 0.3, 4); if (!v) return;
    const n = v.noise('white', t, t + 0.25);
    const bp = v.filter('bandpass', 3000 * o.p, 2.5); const g = v.gain(0);
    sweep(bp.frequency, t, 3200 * o.p, 700 * o.p, 0.16);
    v.chain(n, bp, g, v.out); perc(g.gain, t, 0.55 * o.g, 0.012, 0.18);
    layerClick(v, t, o, 5000, 6, 0.25, 0.02);
    v.reverb(0.12);
  });

  // shootHammer : impact lourd → bruit brun lowpass 180 Hz + sous-basse 80→38 Hz saturée + click + grande réverbe.
  def('shootHammer', 6, (o, t) => {
    const v = voice(o, 0.7, 6); if (!v) return;
    const n = v.noise('brown', t, t + 0.5);
    const lp = v.filter('lowpass', 180, 1.2); const g = v.gain(0);
    sweep(lp.frequency, t, 400, 90, 0.3);
    v.chain(n, lp, g, v.out); perc(g.gain, t, 1.0 * o.g, 0.005, 0.4);
    layerThump(v, t, o, 80, 38, 0.9, 0.45, 4);
    layerClick(v, t, o, 1800, 3, 0.5, 0.03);
    v.reverb(0.35);
  });

  // shootBow : corde relâchée → click bandpass très résonant + corde triangle bandpass Q8 saturée + sifflement highpass balayé.
  def('shootBow', 4, (o, t) => {
    const v = voice(o, 0.45, 4); if (!v) return;
    layerClick(v, t, o, 2600, 9, 0.5, 0.015);
    const s = v.osc('triangle', 210 * o.p, t, t + 0.2);
    sweep(s.frequency, t, 210 * o.p, 150 * o.p, 0.12);
    const bp = v.filter('bandpass', 900 * o.p, 8); const sh = v.shaper(2.5); const g = v.gain(0);
    sweep(bp.frequency, t, 1400 * o.p, 500 * o.p, 0.15);
    v.chain(s, bp, sh, g, v.out); perc(g.gain, t, 0.35 * o.g, 0.003, 0.12);
    const n = v.noise('white', t, t + 0.4);
    const hp = v.filter('highpass', 5000 * o.p, 1.5); const g2 = v.gain(0);
    sweep(hp.frequency, t + 0.01, 6000 * o.p, 1800 * o.p, 0.3);
    v.chain(n, hp, g2, v.out); perc(g2.gain, t + 0.01, 0.3 * o.g, 0.02, 0.28);
    v.reverb(0.15);
  });

  // shootPistol : détonation → bruit blanc lowpass 7 kHz→400 Hz très rapide + résonance grave 130→45 Hz saturée + réverbe.
  def('shootPistol', 5, (o, t) => {
    const v = voice(o, 0.45, 5); if (!v) return;
    const n = v.noise('white', t, t + 0.3);
    const lp = v.filter('lowpass', 7000, 1.5); const sh = v.shaper(3); const g = v.gain(0);
    sweep(lp.frequency, t, 7000, 400, 0.08);
    v.chain(n, lp, sh, g, v.out); perc(g.gain, t, 0.9 * o.g, 0.002, 0.14);
    layerThump(v, t, o, 130, 45, 0.7, 0.18, 4);
    v.reverb(0.3);
  });

  // shootBoomerang : whoosh tournant → bruit rose bandpass balayé + tremolo AM 11 Hz + léger souffle highpass.
  def('shootBoomerang', 4, (o, t) => {
    const v = voice(o, 0.6, 4); if (!v) return;
    const n = v.noise('pink', t, t + 0.55);
    const bp = v.filter('bandpass', 1200 * o.p, 3); const trem = v.gain(0.6); const g = v.gain(0);
    sweep(bp.frequency, t, 700 * o.p, 2200 * o.p, 0.25); bp.frequency.exponentialRampToValueAtTime(900 * o.p, t + 0.55);
    v.lfo(11 * o.p, 0.4, trem.gain, t, t + 0.55);
    v.chain(n, bp, trem, g, v.out); adsr(g.gain, t, 0.7 * o.g, 0.03, 0.05, 0.9, 0.35, 0.18);
    layerClick(v, t, o, 4000, 4, 0.15, 0.02);
    v.reverb(0.18);
  });

  // shootOrb : nappe FM douce → porteur 300 Hz / modulateur 1.5× index décroissant → lowpass balayé → tanh + souffle rose.
  def('shootOrb', 4, (o, t) => {
    const v = voice(o, 0.5, 4); if (!v) return;
    const f = v.fm(300 * o.p, 450 * o.p, 260, t, t + 0.45);
    sweep(f.idx.gain, t, 260, 20, 0.35);
    const lp = v.filter('lowpass', 1400 * o.p, 4); const sh = v.shaper(1.8); const g = v.gain(0);
    sweep(lp.frequency, t, 1800 * o.p, 350 * o.p, 0.4);
    v.chain(f.car, lp, sh, g, v.out); adsr(g.gain, t, 0.5 * o.g, 0.02, 0.05, 0.8, 0.25, 0.18);
    const n = v.noise('pink', t, t + 0.45);
    const bp = v.filter('bandpass', 1000 * o.p, 1.5); const g2 = v.gain(0);
    v.chain(n, bp, g2, v.out); perc(g2.gain, t, 0.2 * o.g, 0.02, 0.35);
    v.reverb(0.3);
  });

  // shootChain : crépitement électrique → bruit blanc highpass 3 kHz modulé en amplitude par du bruit lowpass 60 Hz + bandpass Q10 résonant.
  def('shootChain', 4, (o, t) => {
    const v = voice(o, 0.3, 4); if (!v) return;
    const n = v.noise('white', t, t + 0.25);
    const hp = v.filter('highpass', 3000 * o.p, 1); const am = v.gain(0.2); const g = v.gain(0);
    v.noiseMod('white', 60, 1.0, am.gain, t, t + 0.25);
    v.chain(n, hp, am, g, v.out); perc(g.gain, t, 0.8 * o.g, 0.004, 0.2);
    const n2 = v.noise('white', t, t + 0.25);
    const bp = v.filter('bandpass', 6500 * o.p, 12); const g2 = v.gain(0);
    sweep(bp.frequency, t, 6500 * o.p, 3500 * o.p, 0.2);
    v.chain(n2, bp, g2, v.out); perc(g2.gain, t, 0.35 * o.g, 0.003, 0.15);
    v.reverb(0.1);
  });

  /* --- Lance-flammes : souffle continu tant que shootFlame() est appelé --- */
  const flame = { v: null, watchdog: null };
  // startFlame : souffle → bruit brun lowpass 600 Hz modulé par LFO 3 Hz + crépitement highpass AM bruit. Continu.
  function startFlame(opts) {
    if (!ctx) return;
    try {
      const o = norm(opts);
      if (flame.v && !flame.v.dead) { flame.v.pan.pan.setTargetAtTime(o.x * 0.8, ctx.currentTime, 0.05); return; }
      const t = ctx.currentTime + 0.005;
      const v = voice(o, Infinity, 7); if (!v) return;
      const n = v.noise('brown', t, Infinity);
      const lp = v.filter('lowpass', 600, 2); const sh = v.shaper(2); const g = v.gain(0);
      v.lfo(3.1, 220, lp.frequency, t, Infinity);
      v.lfo(0.7, 120, lp.frequency, t, Infinity, 'triangle');
      v.chain(n, lp, sh, g, v.out);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.75 * o.g, t + 0.08);
      const n2 = v.noise('white', t, Infinity);
      const hp = v.filter('highpass', 3500, 1); const am = v.gain(0.12); const g2 = v.gain(0.35);
      v.noiseMod('white', 25, 0.6, am.gain, t, Infinity);
      v.chain(n2, hp, am, g2, v.out);
      v.reverb(0.12);
      v.fadeOut = (fade) => {
        const tt = ctx.currentTime;
        g.gain.cancelScheduledValues(tt); g.gain.setValueAtTime(g.gain.value, tt); g.gain.linearRampToValueAtTime(0.0001, tt + fade);
        g2.gain.cancelScheduledValues(tt); g2.gain.setValueAtTime(g2.gain.value, tt); g2.gain.linearRampToValueAtTime(0.0001, tt + fade);
        setTimeout(v.kill, fade * 1000 + 60);
      };
      flame.v = v;
    } catch (e) { console.warn('[AudioEngine] startFlame', e); }
  }
  function stopFlame() {
    if (!ctx) return;
    try {
      if (flame.watchdog) { clearTimeout(flame.watchdog); flame.watchdog = null; }
      if (flame.v && !flame.v.dead) flame.v.fadeOut(0.18);
      flame.v = null;
    } catch (e) { /* silencieux */ }
  }
  // shootFlame : démarre/entretient le souffle ; s'éteint seul 150 ms après le dernier appel.
  def('shootFlame', 7, (o) => {
    startFlame({ x: o.x, intensity: o.I });
    if (flame.watchdog) clearTimeout(flame.watchdog);
    flame.watchdog = setTimeout(stopFlame, 150);
  });

  /* ==================================================================
     COMBAT
     ================================================================== */

  // hitEnemy : impact chair/métal → click bandpass 1.8 kHz + thump 180→80 Hz saturé + bruit rose lowpass court.
  def('hitEnemy', 3, (o, t) => {
    const v = voice(o, 0.3, 3); if (!v) return;
    layerClick(v, t, o, 1800, 2.5, 0.6, 0.03);
    layerThump(v, t, o, 180, 80, 0.5, 0.12, 3);
    const n = v.noise('pink', t, t + 0.2);
    const lp = v.filter('lowpass', 1200 * o.p, 1); const g = v.gain(0);
    v.chain(n, lp, g, v.out); perc(g.gain, t, 0.4 * o.g, 0.003, 0.14);
    v.reverb(0.12);
  });

  // hitCrit : coup critique → hitEnemy renforcé + couche métallique FM inharmonique (ratio 1.52) bandpass Q6 + réverbe plus longue.
  def('hitCrit', 5, (o, t) => {
    const v = voice(o, 0.5, 5); if (!v) return;
    layerClick(v, t, o, 2200, 3, 0.8, 0.03);
    layerThump(v, t, o, 200, 70, 0.7, 0.18, 4);
    const f = v.fm(900 * o.p, 1370 * o.p, 700, t, t + 0.35);
    sweep(f.idx.gain, t, 700, 60, 0.25);
    const bp = v.filter('bandpass', 2500 * o.p, 6); const sh = v.shaper(2); const g = v.gain(0);
    v.chain(f.car, bp, sh, g, v.out); perc(g.gain, t, 0.35 * o.g, 0.003, 0.28);
    const n = v.noise('white', t, t + 0.3);
    const hp = v.filter('highpass', 4000, 1); const g2 = v.gain(0);
    v.chain(n, hp, g2, v.out); perc(g2.gain, t, 0.3 * o.g, 0.003, 0.2);
    v.reverb(0.3);
  });

  // enemyDie : déchirure → bruit blanc bandpass 2.2 kHz→300 Hz crépité (AM bruit) + corps brun lowpass + grave 200→45 Hz saturé.
  def('enemyDie', 5, (o, t) => {
    const v = voice(o, 0.6, 5); if (!v) return;
    const n = v.noise('white', t, t + 0.45);
    const bp = v.filter('bandpass', 2200 * o.p, 1.5); const am = v.gain(0.5); const g = v.gain(0);
    sweep(bp.frequency, t, 2200 * o.p, 280 * o.p, 0.4);
    v.noiseMod('white', 40, 0.5, am.gain, t, t + 0.45);
    v.chain(n, bp, am, g, v.out); perc(g.gain, t, 0.9 * o.g, 0.01, 0.4);
    const b = v.noise('brown', t, t + 0.45);
    const lp = v.filter('lowpass', 350, 1); const g2 = v.gain(0);
    v.chain(b, lp, g2, v.out); perc(g2.gain, t, 0.7 * o.g, 0.01, 0.35);
    layerThump(v, t, o, 200, 45, 0.5, 0.3, 3);
    v.reverb(0.28);
  });

  // playerHurt : coup reçu → brun lowpass 250 Hz + grave 90→40 Hz saturé + bruit blanc lowpass balayé 800→200 Hz + duck du master.
  def('playerHurt', 8, (o, t) => {
    const v = voice(o, 0.45, 8); if (!v) return;
    const b = v.noise('brown', t, t + 0.35);
    const lp = v.filter('lowpass', 250, 1.5); const g = v.gain(0);
    v.chain(b, lp, g, v.out); perc(g.gain, t, 1.0 * o.g, 0.004, 0.3);
    layerThump(v, t, o, 90, 40, 0.8, 0.3, 4);
    const n = v.noise('white', t, t + 0.3);
    const lp2 = v.filter('lowpass', 800, 2); const g2 = v.gain(0);
    sweep(lp2.frequency, t, 800, 200, 0.25);
    v.chain(n, lp2, g2, v.out); perc(g2.gain, t, 0.5 * o.g, 0.003, 0.22);
    v.reverb(0.2);
    duckMaster(0.45, 0.35);
  });

  // playerDie : mort → brun lowpass 400→60 Hz sur 1.2 s + FM grave (80/30 Hz) saturée descendante + souffle blanc + grande réverbe + duck long.
  def('playerDie', 10, (o, t) => {
    const v = voice(o, 1.8, 10); if (!v) return;
    const b = v.noise('brown', t, t + 1.5);
    const lp = v.filter('lowpass', 400, 2); const g = v.gain(0);
    sweep(lp.frequency, t, 500, 60, 1.2);
    v.chain(b, lp, g, v.out); adsr(g.gain, t, 1.0 * o.g, 0.01, 0.2, 0.7, 0.9, 0.5);
    const f = v.fm(80 * o.p, 30 * o.p, 90, t, t + 1.5);
    sweep(f.car.frequency, t, 80 * o.p, 32 * o.p, 1.2);
    const sh = v.shaper(4); const lp2 = v.filter('lowpass', 300, 3); const g2 = v.gain(0);
    sweep(lp2.frequency, t, 500, 90, 1.2);
    v.chain(f.car, sh, lp2, g2, v.out); adsr(g2.gain, t, 0.7 * o.g, 0.02, 0.2, 0.7, 0.9, 0.5);
    layerClick(v, t, o, 1500, 2, 0.7, 0.04);
    const n = v.noise('white', t, t + 1.2);
    const hp = v.filter('lowpass', 3000, 1); const g3 = v.gain(0);
    sweep(hp.frequency, t, 3000, 200, 1.0);
    v.chain(n, hp, g3, v.out); perc(g3.gain, t, 0.4 * o.g, 0.01, 0.9);
    v.reverb(0.5);
    duckMaster(0.6, 1.2);
  });

  // dash : whoosh → bruit rose bandpass 500→2600→700 Hz Q1.5 + souffle highpass discret.
  def('dash', 4, (o, t) => {
    const v = voice(o, 0.3, 4); if (!v) return;
    const n = v.noise('pink', t, t + 0.28);
    const bp = v.filter('bandpass', 600 * o.p, 1.5); const g = v.gain(0);
    sweep(bp.frequency, t, 500 * o.p, 2600 * o.p, 0.09); bp.frequency.exponentialRampToValueAtTime(700 * o.p, t + 0.25);
    v.chain(n, bp, g, v.out); perc(g.gain, t, 0.6 * o.g, 0.03, 0.2);
    const n2 = v.noise('white', t, t + 0.25);
    const hp = v.filter('highpass', 6000, 1); const g2 = v.gain(0);
    v.chain(n2, hp, g2, v.out); perc(g2.gain, t + 0.02, 0.12 * o.g, 0.02, 0.15);
    v.reverb(0.1);
  });

  /* ==================================================================
     COMPÉTENCES
     ================================================================== */

  // skillShield : bouclier → nappe détunée lowpass balayé 400→1800→600 Hz saturée + shimmer blanc highpass 6 kHz + grande réverbe.
  def('skillShield', 5, (o, t) => {
    const v = voice(o, 0.9, 5); if (!v) return;
    layerPad(v, t, o, 220, 0.5, 0.06, 0.3, 0.4, 400, 1800, 3, 1.5);
    layerPad(v, t, o, 330, 0.3, 0.1, 0.3, 0.4, 300, 1200, 3, 1.5);
    const n = v.noise('white', t, t + 0.7);
    const hp = v.filter('highpass', 6000, 1); const g = v.gain(0);
    v.chain(n, hp, g, v.out); adsr(g.gain, t, 0.18 * o.g, 0.08, 0.1, 0.6, 0.35, 0.3);
    layerClick(v, t, o, 3000, 5, 0.3, 0.02);
    v.reverb(0.45);
  });

  // skillShockwave : onde de choc → sous-basse 55 Hz saturée + brun lowpass 140→30 Hz + crack blanc initial + grosse réverbe.
  def('skillShockwave', 7, (o, t) => {
    const v = voice(o, 0.9, 7); if (!v) return;
    layerThump(v, t, o, 55, 30, 1.0, 0.6, 5);
    const b = v.noise('brown', t, t + 0.75);
    const lp = v.filter('lowpass', 140, 2); const g = v.gain(0);
    sweep(lp.frequency, t, 140, 30, 0.6);
    v.chain(b, lp, g, v.out); perc(g.gain, t, 1.0 * o.g, 0.01, 0.6);
    const n = v.noise('white', t, t + 0.3);
    const lp2 = v.filter('lowpass', 5000, 1); const sh = v.shaper(3); const g2 = v.gain(0);
    sweep(lp2.frequency, t, 5000, 300, 0.2);
    v.chain(n, lp2, sh, g2, v.out); perc(g2.gain, t, 0.7 * o.g, 0.002, 0.18);
    v.reverb(0.45);
  });

  // skillSlowtime : ralenti → bruit rose lowpass 4 kHz→120 Hz sur 1.5 s + nappe FM 220→110 Hz lowpass descendante + réverbe.
  def('skillSlowtime', 6, (o, t) => {
    const v = voice(o, 1.9, 6); if (!v) return;
    const n = v.noise('pink', t, t + 1.7);
    const lp = v.filter('lowpass', 4000, 3); const g = v.gain(0);
    sweep(lp.frequency, t, 4000, 120, 1.5);
    v.chain(n, lp, g, v.out); adsr(g.gain, t, 0.6 * o.g, 0.05, 0.2, 0.8, 1.2, 0.5);
    const f = v.fm(220 * o.p, 110 * o.p, 120, t, t + 1.7);
    sweep(f.car.frequency, t, 220 * o.p, 110 * o.p, 1.4); sweep(f.mod.frequency, t, 110 * o.p, 55 * o.p, 1.4);
    const lp2 = v.filter('lowpass', 1200, 4); const sh = v.shaper(1.5); const g2 = v.gain(0);
    sweep(lp2.frequency, t, 1500, 150, 1.4);
    v.chain(f.car, lp2, sh, g2, v.out); adsr(g2.gain, t, 0.35 * o.g, 0.1, 0.2, 0.8, 1.2, 0.5);
    v.reverb(0.4);
  });

  // skillTurret : tourelle → 3 clicks mécaniques bandpass espacés + servo triangle 400→700 Hz bandpass Q4 saturé + clac brun.
  def('skillTurret', 4, (o, t) => {
    const v = voice(o, 0.5, 4); if (!v) return;
    for (let i = 0; i < 3; i++) layerClick(v, t + i * 0.045, o, 2800 + i * 400, 6, 0.4, 0.015);
    const s = v.osc('triangle', 400 * o.p, t + 0.05, t + 0.3);
    sweep(s.frequency, t + 0.05, 400 * o.p, 700 * o.p, 0.18);
    const bp = v.filter('bandpass', 1200 * o.p, 4); const sh = v.shaper(3); const g = v.gain(0);
    sweep(bp.frequency, t + 0.05, 900 * o.p, 2000 * o.p, 0.18);
    v.chain(s, bp, sh, g, v.out); adsr(g.gain, t + 0.05, 0.25 * o.g, 0.01, 0.02, 0.9, 0.18, 0.05);
    const b = v.noise('brown', t + 0.25, t + 0.45);
    const lp = v.filter('lowpass', 400, 1.5); const g2 = v.gain(0);
    v.chain(b, lp, g2, v.out); perc(g2.gain, t + 0.25, 0.6 * o.g, 0.003, 0.12);
    v.reverb(0.15);
  });

  // skillBlink : téléportation → whoosh inversé (bandpass 400→5 kHz montant) + pop lowpass + shimmer FM inharmonique filtré.
  def('skillBlink', 5, (o, t) => {
    const v = voice(o, 0.5, 5); if (!v) return;
    const n = v.noise('white', t, t + 0.2);
    const bp = v.filter('bandpass', 400 * o.p, 2); const g = v.gain(0);
    sweep(bp.frequency, t, 400 * o.p, 5000 * o.p, 0.15);
    v.chain(n, bp, g, v.out); adsr(g.gain, t, 0.5 * o.g, 0.12, 0.01, 1, 0.14, 0.03);
    const n2 = v.noise('white', t + 0.15, t + 0.3);
    const lp = v.filter('lowpass', 1500, 2); const g2 = v.gain(0);
    v.chain(n2, lp, g2, v.out); perc(g2.gain, t + 0.15, 0.6 * o.g, 0.002, 0.08);
    const f = v.fm(1400 * o.p, 2000 * o.p, 500, t + 0.15, t + 0.45);
    sweep(f.idx.gain, t + 0.15, 500, 30, 0.25);
    const bp2 = v.filter('bandpass', 3000 * o.p, 5); const sh = v.shaper(1.5); const g3 = v.gain(0);
    v.chain(f.car, bp2, sh, g3, v.out); perc(g3.gain, t + 0.15, 0.2 * o.g, 0.005, 0.25);
    v.reverb(0.35);
  });

  // skillMagnet : aimant → FM 110/220 Hz index croissant → lowpass LFO 6 Hz → tanh + tremolo 8 Hz + bruit rose.
  def('skillMagnet', 4, (o, t) => {
    const v = voice(o, 0.55, 4); if (!v) return;
    const f = v.fm(110 * o.p, 220 * o.p, 30, t, t + 0.5);
    sweep(f.idx.gain, t, 30, 320, 0.35, true);
    const lp = v.filter('lowpass', 800, 5); const sh = v.shaper(2); const trem = v.gain(0.7); const g = v.gain(0);
    v.lfo(6, 350, lp.frequency, t, t + 0.5);
    v.lfo(8, 0.3, trem.gain, t, t + 0.5);
    v.chain(f.car, lp, sh, trem, g, v.out); adsr(g.gain, t, 0.4 * o.g, 0.03, 0.05, 0.9, 0.3, 0.15);
    const n = v.noise('pink', t, t + 0.5);
    const bp = v.filter('bandpass', 700, 1.2); const g2 = v.gain(0);
    sweep(bp.frequency, t, 400, 1600, 0.4);
    v.chain(n, bp, g2, v.out); adsr(g2.gain, t, 0.25 * o.g, 0.05, 0.05, 0.9, 0.3, 0.15);
    v.reverb(0.25);
  });

  /* ==================================================================
     RAMASSAGES
     ================================================================== */

  // pickupXp : tintement organique → FM 1200 Hz ratio 2.01 index bref → bandpass Q3 → tanh léger + tick blanc highpass ; très court.
  def('pickupXp', 2, (o, t) => {
    const v = voice(o, 0.2, 2); if (!v) return;
    const f = v.fm(1200 * o.p, 2412 * o.p, 900, t, t + 0.16);
    sweep(f.idx.gain, t, 900, 40, 0.05);
    const bp = v.filter('bandpass', 2000 * o.p, 3); const sh = v.shaper(1.3); const g = v.gain(0);
    v.chain(f.car, bp, sh, g, v.out); perc(g.gain, t, 0.3 * o.g, 0.003, 0.11);
    layerClick(v, t, o, 6000, 3, 0.15, 0.008);
    v.reverb(0.15);
  });

  // pickupCoin : pièce → FM 1800 Hz ratio 3.5 index décroissant, léger bend descendant → bandpass Q4 → tanh + tick + petite réverbe.
  def('pickupCoin', 2, (o, t) => {
    const v = voice(o, 0.25, 2); if (!v) return;
    const f = v.fm(1800 * o.p, 6300 * o.p, 500, t, t + 0.2);
    sweep(f.idx.gain, t, 500, 20, 0.08); sweep(f.car.frequency, t, 1800 * o.p, 1720 * o.p, 0.15);
    const bp = v.filter('bandpass', 2600 * o.p, 4); const sh = v.shaper(1.4); const g = v.gain(0);
    v.chain(f.car, bp, sh, g, v.out); perc(g.gain, t, 0.3 * o.g, 0.003, 0.15);
    layerClick(v, t, o, 4500, 6, 0.2, 0.01);
    v.reverb(0.2);
  });

  // pickupFragment : cristal → FM 2400 Hz ratio inharmonique 1.41 → highpass 1.5 kHz → tanh + double tick + réverbe généreuse.
  def('pickupFragment', 3, (o, t) => {
    const v = voice(o, 0.4, 3); if (!v) return;
    const f = v.fm(2400 * o.p, 3384 * o.p, 1200, t, t + 0.3);
    sweep(f.idx.gain, t, 1200, 60, 0.12);
    const hp = v.filter('highpass', 1500, 2); const sh = v.shaper(1.3); const g = v.gain(0);
    v.chain(f.car, hp, sh, g, v.out); perc(g.gain, t, 0.28 * o.g, 0.003, 0.25);
    layerClick(v, t, o, 7000, 5, 0.15, 0.008);
    layerClick(v, t + 0.06, o, 5500, 5, 0.1, 0.008);
    v.reverb(0.4);
  });

  // levelUp : montée → bruit rose lowpass 300→6 kHz sur 0.7 s puis accord de 3 nappes détunées (fondamentale, quinte, octave) saturées + réverbe.
  def('levelUp', 7, (o, t) => {
    const v = voice(o, 2.4, 7); if (!v) return;
    const n = v.noise('pink', t, t + 1.0);
    const lp = v.filter('lowpass', 300, 4); const g = v.gain(0);
    sweep(lp.frequency, t, 300, 6000, 0.7);
    v.chain(n, lp, g, v.out); adsr(g.gain, t, 0.45 * o.g, 0.1, 0.1, 0.9, 0.7, 0.25);
    const t2 = t + 0.55;
    layerPad(v, t2, o, 220, 0.4, 0.12, 0.9, 0.7, 500, 1500, 2, 1.5);
    layerPad(v, t2 + 0.03, o, 330, 0.3, 0.15, 0.9, 0.7, 500, 1500, 2, 1.5);
    layerPad(v, t2 + 0.06, o, 440, 0.25, 0.2, 0.9, 0.7, 700, 2000, 2, 1.5);
    layerClick(v, t2, o, 2500, 4, 0.3, 0.02);
    v.reverb(0.5);
  });

  /* ==================================================================
     ENVIRONNEMENT / PIÈGES
     ================================================================== */

  // chestOpen : coffre → 2 clunks bruns lowpass + grincement saw bandpass balayé Q8 crépité + nappe basse saturée + réverbe.
  def('chestOpen', 5, (o, t) => {
    const v = voice(o, 1.2, 5); if (!v) return;
    for (const dt of [0, 0.13]) {
      const b = v.noise('brown', t + dt, t + dt + 0.15);
      const lp = v.filter('lowpass', 320, 1.5); const g = v.gain(0);
      v.chain(b, lp, g, v.out); perc(g.gain, t + dt, 0.6 * o.g, 0.004, 0.1);
      layerClick(v, t + dt, o, 1400, 4, 0.3, 0.015);
    }
    const s = v.osc('sawtooth', 90 * o.p, t + 0.05, t + 0.45);
    const bp = v.filter('bandpass', 400 * o.p, 8); const am = v.gain(0.5); const sh = v.shaper(2.5); const g = v.gain(0);
    sweep(bp.frequency, t + 0.05, 400 * o.p, 950 * o.p, 0.35);
    v.noiseMod('white', 30, 0.5, am.gain, t + 0.05, t + 0.45);
    v.chain(s, bp, am, sh, g, v.out); adsr(g.gain, t + 0.05, 0.25 * o.g, 0.02, 0.05, 0.9, 0.3, 0.08);
    layerPad(v, t + 0.3, o, 165, 0.3, 0.15, 0.4, 0.5, 300, 900, 2, 1.5);
    v.reverb(0.35);
  });

  // trapWarn : alerte → 2 impulsions (bandpass Q12 sur bruit + sinus 900 Hz saturé bandpassé) à 0 et 180 ms.
  def('trapWarn', 6, (o, t) => {
    const v = voice(o, 0.5, 6); if (!v) return;
    for (const dt of [0, 0.18]) {
      const n = v.noise('white', t + dt, t + dt + 0.1);
      const bp = v.filter('bandpass', 1400 * o.p, 12); const g = v.gain(0);
      v.chain(n, bp, g, v.out); perc(g.gain, t + dt, 0.5 * o.g, 0.003, 0.07);
      const s = v.osc('sine', 900 * o.p, t + dt, t + dt + 0.1);
      const sh = v.shaper(4); const bp2 = v.filter('bandpass', 1800 * o.p, 3); const g2 = v.gain(0);
      v.chain(s, sh, bp2, g2, v.out); perc(g2.gain, t + dt, 0.3 * o.g, 0.003, 0.06);
    }
    v.reverb(0.12);
  });

  // trapLaser : bourdonnement → 2 saws 80 Hz détunées → lowpass 500 Hz Q6 modulé LFO 6 Hz → tanh + fil blanc highpass 5 kHz.
  def('trapLaser', 4, (o, t) => {
    const v = voice(o, 0.55, 4); if (!v) return;
    const mix = v.gain(0.5);
    const s1 = v.osc('sawtooth', 80 * o.p, t, t + 0.5); const s2 = v.osc('sawtooth', 80.8 * o.p, t, t + 0.5);
    s1.connect(mix); s2.connect(mix);
    const lp = v.filter('lowpass', 500, 6); const sh = v.shaper(3); const g = v.gain(0);
    v.lfo(6, 250, lp.frequency, t, t + 0.5);
    v.chain(mix, lp, sh, g, v.out); adsr(g.gain, t, 0.35 * o.g, 0.03, 0.05, 0.9, 0.38, 0.08);
    const n = v.noise('white', t, t + 0.5);
    const hp = v.filter('highpass', 5000, 2); const g2 = v.gain(0);
    v.chain(n, hp, g2, v.out); adsr(g2.gain, t, 0.12 * o.g, 0.03, 0.05, 0.9, 0.38, 0.08);
    v.reverb(0.15);
  });

  // trapFire : jet de flamme → brun lowpass 500 Hz LFO 5 Hz saturé + crépitement blanc highpass AM bruit lent.
  def('trapFire', 4, (o, t) => {
    const v = voice(o, 0.7, 4); if (!v) return;
    const b = v.noise('brown', t, t + 0.6);
    const lp = v.filter('lowpass', 500, 2); const sh = v.shaper(2); const g = v.gain(0);
    v.lfo(5, 200, lp.frequency, t, t + 0.6);
    v.chain(b, lp, sh, g, v.out); adsr(g.gain, t, 0.7 * o.g, 0.04, 0.05, 0.9, 0.45, 0.12);
    const n = v.noise('white', t, t + 0.6);
    const hp = v.filter('highpass', 3000, 1); const am = v.gain(0.1); const g2 = v.gain(0);
    v.noiseMod('white', 30, 0.6, am.gain, t, t + 0.6);
    v.chain(n, hp, am, g2, v.out); adsr(g2.gain, t, 0.5 * o.g, 0.04, 0.05, 0.9, 0.45, 0.12);
    v.reverb(0.15);
  });

  // trapSpike : pics → click métallique bandpass Q10 + FM 700/1000 Hz bref bandpassé + thump brun lowpass.
  def('trapSpike', 4, (o, t) => {
    const v = voice(o, 0.3, 4); if (!v) return;
    layerClick(v, t, o, 3500, 10, 0.5, 0.02);
    const f = v.fm(700 * o.p, 1000 * o.p, 400, t, t + 0.2);
    sweep(f.idx.gain, t, 400, 20, 0.08);
    const bp = v.filter('bandpass', 2000 * o.p, 5); const sh = v.shaper(2); const g = v.gain(0);
    v.chain(f.car, bp, sh, g, v.out); perc(g.gain, t, 0.3 * o.g, 0.002, 0.15);
    const b = v.noise('brown', t, t + 0.2);
    const lp = v.filter('lowpass', 400, 1); const g2 = v.gain(0);
    v.chain(b, lp, g2, v.out); perc(g2.gain, t, 0.5 * o.g, 0.003, 0.12);
    v.reverb(0.15);
  });

  // trapGas : gaz → bruit blanc highpass 2 kHz + lowpass 6 kHz, attaque lente 150 ms, bandpass parallèle balayé par LFO.
  def('trapGas', 3, (o, t) => {
    const v = voice(o, 1.0, 3); if (!v) return;
    const n = v.noise('white', t, t + 0.95);
    const hp = v.filter('highpass', 2000, 0.8); const lp = v.filter('lowpass', 6000, 0.8); const g = v.gain(0);
    v.chain(n, hp, lp, g, v.out); adsr(g.gain, t, 0.4 * o.g, 0.15, 0.1, 0.8, 0.5, 0.4);
    const n2 = v.noise('pink', t, t + 0.95);
    const bp = v.filter('bandpass', 1500, 4); const g2 = v.gain(0);
    v.lfo(2.3, 600, bp.frequency, t, t + 0.95);
    v.chain(n2, bp, g2, v.out); adsr(g2.gain, t, 0.25 * o.g, 0.2, 0.1, 0.8, 0.5, 0.4);
    v.reverb(0.3);
  });

  // trapSaw : scie → bruit blanc bandpass 1.8 kHz Q5 balayé LFO 30 Hz + AM 55 Hz + saw 110 Hz lowpass 900 saturée.
  def('trapSaw', 4, (o, t) => {
    const v = voice(o, 0.6, 4); if (!v) return;
    const n = v.noise('white', t, t + 0.55);
    const bp = v.filter('bandpass', 1800 * o.p, 5); const am = v.gain(0.6); const g = v.gain(0);
    v.lfo(30 * o.p, 500, bp.frequency, t, t + 0.55, 'triangle');
    v.lfo(55 * o.p, 0.4, am.gain, t, t + 0.55);
    v.chain(n, bp, am, g, v.out); adsr(g.gain, t, 0.5 * o.g, 0.02, 0.05, 0.9, 0.45, 0.08);
    const s = v.osc('sawtooth', 110 * o.p, t, t + 0.55);
    const lp = v.filter('lowpass', 900, 3); const sh = v.shaper(4); const g2 = v.gain(0);
    v.lfo(30 * o.p, 300, lp.frequency, t, t + 0.55);
    v.chain(s, lp, sh, g2, v.out); adsr(g2.gain, t, 0.25 * o.g, 0.02, 0.05, 0.9, 0.45, 0.08);
    v.reverb(0.15);
  });

  /* ==================================================================
     BOSS / SALLE
     ================================================================== */

  // bossRoar : rugissement → brun lowpass 250→600→150 Hz sur 1.2 s + FM grave 55/41 Hz saturée lowpass LFO + growl blanc highpass AM + grosse réverbe.
  def('bossRoar', 8, (o, t) => {
    const v = voice(o, 1.6, 8); if (!v) return;
    const b = v.noise('brown', t, t + 1.4);
    const lp = v.filter('lowpass', 250, 3); const sh = v.shaper(3); const g = v.gain(0);
    sweep(lp.frequency, t, 250, 650, 0.35); lp.frequency.exponentialRampToValueAtTime(140, t + 1.2);
    v.chain(b, lp, sh, g, v.out); adsr(g.gain, t, 1.0 * o.g, 0.05, 0.2, 0.8, 0.9, 0.4);
    const f = v.fm(55 * o.p, 41 * o.p, 90, t, t + 1.4);
    sweep(f.idx.gain, t, 90, 160, 0.4); sweep(f.car.frequency, t, 55 * o.p, 45 * o.p, 1.2);
    const sh2 = v.shaper(5); const lp2 = v.filter('lowpass', 400, 4); const g2 = v.gain(0);
    v.lfo(7, 150, lp2.frequency, t, t + 1.4);
    v.chain(f.car, sh2, lp2, g2, v.out); adsr(g2.gain, t, 0.7 * o.g, 0.08, 0.2, 0.8, 0.9, 0.4);
    const n = v.noise('white', t, t + 1.2);
    const hp = v.filter('highpass', 2500, 1); const am = v.gain(0.15); const g3 = v.gain(0);
    v.noiseMod('white', 35, 0.7, am.gain, t, t + 1.2);
    v.chain(n, hp, am, g3, v.out); adsr(g3.gain, t, 0.5 * o.g, 0.1, 0.2, 0.8, 0.8, 0.3);
    v.reverb(0.5);
  });

  // bossPhase : changement de phase → impact sous-basse + nappe dissonante montante (lowpass balayé) + balayage blanc + réverbe longue.
  def('bossPhase', 8, (o, t) => {
    const v = voice(o, 1.8, 8); if (!v) return;
    layerThump(v, t, o, 70, 35, 1.0, 0.6, 5);
    const b = v.noise('brown', t, t + 0.6);
    const lp = v.filter('lowpass', 160, 1.5); const g = v.gain(0);
    v.chain(b, lp, g, v.out); perc(g.gain, t, 0.9 * o.g, 0.01, 0.5);
    layerPad(v, t + 0.1, o, 110, 0.4, 0.4, 0.8, 0.5, 200, 1800, 3, 2.5);
    layerPad(v, t + 0.1, o, 155.6, 0.3, 0.5, 0.8, 0.5, 200, 1600, 3, 2.5); // triton : tension
    const n = v.noise('white', t + 0.1, t + 1.5);
    const bp = v.filter('bandpass', 300, 2); const g2 = v.gain(0);
    sweep(bp.frequency, t + 0.1, 300, 5000, 1.2);
    v.chain(n, bp, g2, v.out); adsr(g2.gain, t + 0.1, 0.35 * o.g, 0.3, 0.1, 0.9, 1.0, 0.3);
    v.reverb(0.5);
  });

  // roomClear : résolution brève → 2 nappes (quinte puis octave) lowpass saturées + gonflement rose + réverbe.
  def('roomClear', 6, (o, t) => {
    const v = voice(o, 1.6, 6); if (!v) return;
    layerPad(v, t, o, 196, 0.35, 0.05, 0.5, 0.5, 600, 1300, 2, 1.5);
    layerPad(v, t + 0.18, o, 294, 0.3, 0.05, 0.4, 0.5, 700, 1600, 2, 1.5);
    layerPad(v, t + 0.36, o, 392, 0.3, 0.08, 0.5, 0.6, 800, 2200, 2, 1.5);
    const n = v.noise('pink', t, t + 1.2);
    const lp = v.filter('lowpass', 800, 1.5); const g = v.gain(0);
    sweep(lp.frequency, t, 800, 4000, 0.6);
    v.chain(n, lp, g, v.out); adsr(g.gain, t, 0.25 * o.g, 0.3, 0.1, 0.8, 0.6, 0.4);
    layerClick(v, t, o, 2200, 4, 0.2, 0.02);
    layerClick(v, t + 0.36, o, 3200, 4, 0.2, 0.02);
    v.reverb(0.45);
  });

  /* ==================================================================
     INTERFACE
     ================================================================== */

  // uiHover : survol → bruit blanc bandpass 3 kHz Q6 25 ms + tick FM 1500 Hz bandpassé, très discret.
  def('uiHover', 1, (o, t) => {
    const v = voice(o, 0.12, 1); if (!v) return;
    layerClick(v, t, o, 3000, 6, 0.18, 0.025);
    const f = v.fm(1500 * o.p, 2200 * o.p, 300, t, t + 0.08);
    const bp = v.filter('bandpass', 2000 * o.p, 4); const sh = v.shaper(1.3); const g = v.gain(0);
    v.chain(f.car, bp, sh, g, v.out); perc(g.gain, t, 0.08 * o.g, 0.002, 0.05);
  });

  // uiClick : clic → bruit bandpass 1.2 kHz Q4 30 ms + sinus 600→300 Hz saturé lowpass 40 ms.
  def('uiClick', 2, (o, t) => {
    const v = voice(o, 0.15, 2); if (!v) return;
    layerClick(v, t, o, 1200, 4, 0.3, 0.03);
    layerThump(v, t, o, 600, 300, 0.2, 0.05, 3);
    v.reverb(0.06);
  });

  // uiConfirm : validation → deux tons FM filtrés (500 puis 750 Hz) + souffle rose + petite réverbe.
  def('uiConfirm', 3, (o, t) => {
    const v = voice(o, 0.45, 3); if (!v) return;
    for (const [dt, fq] of [[0, 500], [0.09, 750]]) {
      const f = v.fm(fq * o.p, fq * 2.01 * o.p, 250, t + dt, t + dt + 0.3);
      sweep(f.idx.gain, t + dt, 250, 20, 0.12);
      const lp = v.filter('lowpass', 2200 * o.p, 3); const sh = v.shaper(1.5); const g = v.gain(0);
      v.chain(f.car, lp, sh, g, v.out); perc(g.gain, t + dt, 0.22 * o.g, 0.005, 0.22);
      layerClick(v, t + dt, o, 2500, 5, 0.12, 0.012);
    }
    const n = v.noise('pink', t, t + 0.35);
    const bp = v.filter('bandpass', 1200, 1.2); const g2 = v.gain(0);
    v.chain(n, bp, g2, v.out); perc(g2.gain, t, 0.1 * o.g, 0.02, 0.25);
    v.reverb(0.2);
  });

  /* ==================================================================
     MUSIQUE : fichiers (fetch + decodeAudioData, fallback <audio>)
     ================================================================== */
  const music = { cur: null, token: 0 };

  function makeTrackFromBuffer(buf, loop) {
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = !!loop;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(musicDuck); src.start();
    return { g, stop: () => { try { src.stop(); } catch (e) { /* */ } try { src.disconnect(); g.disconnect(); } catch (e) { /* */ } } };
  }
  function makeTrackFromElement(url, loop) {
    const el = new Audio(); el.crossOrigin = 'anonymous'; el.loop = !!loop; el.src = url;
    const node = ctx.createMediaElementSource(el);
    const g = ctx.createGain(); g.gain.value = 0;
    node.connect(g); g.connect(musicDuck);
    const p = el.play(); if (p && p.catch) p.catch(() => { /* autoplay refusé : silencieux */ });
    return { g, stop: () => { try { el.pause(); el.src = ''; node.disconnect(); g.disconnect(); } catch (e) { /* */ } } };
  }
  function fadeTrack(track, to, seconds, thenStop) {
    const t = ctx.currentTime;
    track.g.gain.cancelScheduledValues(t);
    track.g.gain.setValueAtTime(Math.max(track.g.gain.value, 0.0001), t);
    track.g.gain.linearRampToValueAtTime(to, t + Math.max(seconds, 0.01));
    if (thenStop) setTimeout(track.stop, seconds * 1000 + 100);
  }

  /** Lance une piste avec crossfade depuis la précédente. Renvoie une promesse. */
  function playMusic(url, opts) {
    if (!ctx) return Promise.resolve(false);
    opts = opts || {};
    const fadeIn = isNum(opts.fadeIn) ? opts.fadeIn : 1.5;
    const fadeOut = isNum(opts.fadeOut) ? opts.fadeOut : fadeIn;
    const loop = opts.loop !== false;
    const token = ++music.token;
    stopGenerativeMusic(fadeOut);
    const start = (track) => {
      if (token !== music.token) { track.stop(); return false; }
      if (music.cur) fadeTrack(music.cur, 0.0001, fadeOut, true);
      music.cur = track;
      fadeTrack(track, 1, fadeIn, false);
      return true;
    };
    const viaElement = () => { try { return start(makeTrackFromElement(url, loop)); } catch (e) { console.warn('[AudioEngine] playMusic', e); return false; } };
    if (typeof fetch !== 'function') return Promise.resolve(viaElement());
    return fetch(url)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buf) => start(makeTrackFromBuffer(buf, loop)))
      .catch(() => viaElement());
  }
  function stopMusic(fade) {
    if (!ctx) return;
    music.token++;
    fade = isNum(fade) ? fade : 1;
    if (music.cur) { fadeTrack(music.cur, 0.0001, fade, true); music.cur = null; }
    stopGenerativeMusic(fade);
  }
  /** Baisse la musique de `amount` (0..1) pendant `seconds` puis remonte. */
  function duckMusic(amount, seconds) {
    if (!ctx) return;
    amount = clamp(isNum(amount) ? amount : 0.5, 0, 1); seconds = isNum(seconds) ? seconds : 1;
    const t = ctx.currentTime;
    musicDuck.gain.cancelScheduledValues(t);
    musicDuck.gain.setValueAtTime(musicDuck.gain.value, t);
    musicDuck.gain.linearRampToValueAtTime(1 - amount, t + 0.05);
    musicDuck.gain.setValueAtTime(1 - amount, t + 0.05 + seconds * 0.5);
    musicDuck.gain.linearRampToValueAtTime(1, t + 0.05 + seconds);
  }

  /* ==================================================================
     MUSIQUE GÉNÉRATIVE ORGANIQUE (fallback)
     Nappes : oscillateurs détunés → lowpass balayé lentement → tanh → réverbe.
     Percussions : bruit filtré sur une grille lente. Aucune mélodie.
     ================================================================== */
  const MOODS = {
    hub:   { root: 55,   bpm: 58,  chords: [[0, 7, 12, 16], [0, 5, 12, 15], [0, 7, 14, 19], [0, 3, 10, 15]], barsPerChord: 2, cutoff: [260, 900],  drive: 1.3, drums: 'soft', gain: 0.5 },
    biome: { root: 49,   bpm: 82,  chords: [[0, 3, 7, 12], [0, 5, 8, 15], [0, 3, 10, 14], [0, 2, 7, 12]],   barsPerChord: 2, cutoff: [350, 1600], drive: 1.8, drums: 'mid',  gain: 0.5 },
    boss:  { root: 41.2, bpm: 118, chords: [[0, 6, 12, 13], [0, 1, 7, 12], [0, 6, 11, 18], [0, 3, 6, 12]],   barsPerChord: 1, cutoff: [200, 2600], drive: 3.2, drums: 'hard', gain: 0.55 },
  };
  let gen = null;

  function genPad(t, chord) {
    const m = gen.m, o = { x: 0, p: 1, g: 1 };
    const len = m.barsPerChord * 4 * 60 / m.bpm;
    const v = voice(o, len + 4, 0, gen.out, false);
    const mix = v.gain(0.12);
    for (const semi of chord) {
      const f = m.root * Math.pow(2, semi / 12);
      for (const det of [-9, 8]) {
        const s = v.osc('sawtooth', f, t, t + len + 3.5); s.detune.value = det + rnd(-2, 2); s.connect(mix);
      }
      const sub = v.osc('sine', f / 2, t, t + len + 3.5); const subSh = v.shaper(2.5); const subG = v.gain(0.35);
      v.chain(sub, subSh, subG, mix);
    }
    const lp = v.filter('lowpass', m.cutoff[0], 1.4); const sh = v.shaper(m.drive); const g = v.gain(0);
    sweep(lp.frequency, t, m.cutoff[0], m.cutoff[1], len * 0.6); lp.frequency.exponentialRampToValueAtTime(m.cutoff[0], t + len + 2);
    v.lfo(0.11 + rnd(0, 0.05), m.cutoff[0] * 0.4, lp.frequency, t, t + len + 3.5);
    v.chain(mix, lp, sh, g, v.out); adsr(g.gain, t, m.gain, 1.6, 0.2, 1, len + 0.5, 2.5);
    v.reverb(0.55);
  }
  function genKick(t, gain) {
    const v = voice({ x: 0 }, 0.4, 0, gen.out, false);
    const b = v.noise('brown', t, t + 0.3); const lp = v.filter('lowpass', 100, 1.5); const g = v.gain(0);
    v.chain(b, lp, g, v.out); perc(g.gain, t, gain, 0.004, 0.22);
    const s = v.osc('sine', 60, t, t + 0.3); sweep(s.frequency, t, 70, 36, 0.15);
    const sh = v.shaper(3); const lp2 = v.filter('lowpass', 160, 1); const g2 = v.gain(0);
    v.chain(s, sh, lp2, g2, v.out); perc(g2.gain, t, gain * 0.8, 0.004, 0.2);
  }
  function genHat(t, gain) {
    const v = voice({ x: rnd(-0.3, 0.3) }, 0.12, 0, gen.out, false);
    const n = v.noise('white', t, t + 0.1); const hp = v.filter('highpass', 7500, 1); const g = v.gain(0);
    v.chain(n, hp, g, v.out); perc(g.gain, t, gain, 0.002, 0.05);
  }
  function genSnare(t, gain) {
    const v = voice({ x: 0 }, 0.3, 0, gen.out, false);
    const n = v.noise('white', t, t + 0.25); const bp = v.filter('bandpass', 1800, 1); const g = v.gain(0);
    v.chain(n, bp, g, v.out); perc(g.gain, t, gain, 0.003, 0.16);
    const b = v.noise('brown', t, t + 0.2); const lp = v.filter('lowpass', 350, 1); const g2 = v.gain(0);
    v.chain(b, lp, g2, v.out); perc(g2.gain, t, gain * 0.7, 0.003, 0.1);
    v.reverb(0.3);
  }
  function genShaker(t, gain) {
    const v = voice({ x: rnd(-0.6, 0.6) }, 0.2, 0, gen.out, false);
    const n = v.noise('pink', t, t + 0.18); const bp = v.filter('bandpass', 4000, 2); const g = v.gain(0);
    v.chain(n, bp, g, v.out); adsr(g.gain, t, gain, 0.05, 0.02, 0.8, 0.08, 0.06);
  }
  function genBeat(t, beat) {
    const m = gen.m, step = beat % 4, bar = Math.floor(beat / 4);
    if (beat % (m.barsPerChord * 4) === 0) genPad(t, m.chords[gen.chord++ % m.chords.length]);
    if (m.drums === 'soft') {
      if (step === 0 && bar % 2 === 0) genKick(t, 0.35);
      if (step === 2 && Math.random() < 0.5) genShaker(t, 0.06);
    } else if (m.drums === 'mid') {
      if (step === 0 || (step === 2 && Math.random() < 0.6)) genKick(t, 0.5);
      if (step === 1 || step === 3) genHat(t, 0.05 + Math.random() * 0.05);
      if (step === 2 && bar % 2 === 1) genSnare(t, 0.2);
    } else {
      genKick(t, 0.65);
      if (step === 1 || step === 3) genSnare(t, 0.35);
      genHat(t, 0.08); genHat(t + 30 / m.bpm, 0.05);
      if (Math.random() < 0.3) genHat(t + 45 / m.bpm, 0.06);
    }
  }
  function genTick() {
    if (!gen) return;
    try {
      while (gen.next < ctx.currentTime + 0.35) { genBeat(gen.next, gen.beat); gen.next += 60 / gen.m.bpm; gen.beat++; }
    } catch (e) { console.warn('[AudioEngine] génératif', e); }
  }
  function startGenerativeMusic(mood) {
    if (!ctx) return;
    try {
      stopGenerativeMusic(1.5);
      const m = MOODS[mood] || MOODS.hub;
      const out = ctx.createGain(); out.gain.value = 0.0001; out.connect(musicDuck);
      const t = ctx.currentTime;
      out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(1, t + 1.5);
      gen = { m, mood, out, next: t + 0.1, beat: 0, chord: 0, timer: null, nodes: [out] };
      // Texture de fond continue : bruit rose lowpass modulé très lentement → réverbe
      const amb = voice({ x: 0 }, Infinity, 0, out, false);
      const n = amb.noise('pink', t, Infinity); const lp = amb.filter('lowpass', 400, 2); const g = amb.gain(mood === 'boss' ? 0.08 : 0.06);
      amb.lfo(0.05, 250, lp.frequency, t, Infinity); amb.chain(n, lp, g, amb.out); amb.reverb(0.6);
      gen.amb = amb;
      if (m.drums === 'hard') { // drone FM grave saturé pour le boss (toujours filtré)
        const dr = voice({ x: 0 }, Infinity, 0, out, false);
        const f = dr.fm(m.root, m.root * 0.5, 40, t, Infinity);
        dr.lfo(0.2, 30, f.idx.gain, t, Infinity);
        const sh = dr.shaper(4); const lp2 = dr.filter('lowpass', 220, 3); const g2 = dr.gain(0.18);
        dr.lfo(0.13, 80, lp2.frequency, t, Infinity); dr.chain(f.car, sh, lp2, g2, dr.out); dr.reverb(0.3);
        gen.drone = dr;
      }
      genTick();
      gen.timer = setInterval(genTick, 120);
    } catch (e) { console.warn('[AudioEngine] startGenerativeMusic', e); gen = null; }
  }
  function stopGenerativeMusic(fade) {
    if (!ctx || !gen) return;
    const g = gen; gen = null;
    fade = isNum(fade) ? fade : 1;
    try {
      clearInterval(g.timer);
      const t = ctx.currentTime;
      g.out.gain.cancelScheduledValues(t); g.out.gain.setValueAtTime(g.out.gain.value, t);
      g.out.gain.linearRampToValueAtTime(0.0001, t + Math.max(fade, 0.01));
      const cleanup = () => { try { g.amb && g.amb.kill(); g.drone && g.drone.kill(); g.out.disconnect(); } catch (e) { /* */ } };
      if (fade > 0) setTimeout(cleanup, fade * 1000 + 100); else cleanup();
    } catch (e) { /* silencieux */ }
  }

  /* ------------------------------------------------------------------ */
  /* API publique                                                        */
  /* ------------------------------------------------------------------ */
  api.init = init;
  api.resume = resume;
  api.setVolume = setVolume;
  api.getVolume = getVolume;
  api.startFlame = startFlame;
  api.stopFlame = stopFlame;
  api.playMusic = playMusic;
  api.stopMusic = stopMusic;
  api.duckMusic = duckMusic;
  api.startGenerativeMusic = startGenerativeMusic;
  api.stopGenerativeMusic = stopGenerativeMusic;
  api.list = () => NAMES.slice();
  api.play = (name, opts) => { if (typeof api[name] === 'function' && NAMES.indexOf(name) >= 0) api[name](opts); };
  api.isReady = () => !!ctx;
  api.voiceCount = () => voices.length;
  api.getContext = () => ctx;

  global.AudioEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
