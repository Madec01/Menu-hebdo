'use strict';
/* Bêtes de Papier — audio.
 *
 * Tout est synthétisé à la volée avec la Web Audio API : aucun fichier, aucune dépendance.
 * Palette : troupe ambulante d'Europe du Sud-Est / Anatolie —
 *   saz pincé (Karplus-Strong doublé et désaccordé), tambour à main (dum/tek),
 *   cloches et bois (synthèse modale inharmonique), flûte de roseau (bruit soufflé + résonateur),
 *   papier (grains de bruit passe-bande), lampe à suif (bruit rose modulé + crépitements),
 *   public (bruit à formants) — le tout dans une petite salle basse (réverbération à
 *   convolution dont la réponse impulsionnelle est générée en code).
 *
 * Rythme et musique : planification sur AudioContext.currentTime, avec anticipation
 * (lookahead 100 ms, planificateur réveillé toutes les 25 ms). Le timer ne sert QUE à
 * planifier : jamais à déclencher un son.
 *
 * Si l'AudioContext est indisponible, toutes les fonctions publiques sont des no-op.
 */
window.BP = window.BP || {};
(function (BP) {

  var AC = window.AudioContext || window.webkitAudioContext || null;

  /* ------------------------------------------------------------------ */
  /* Utilitaires sans contexte                                           */
  /* ------------------------------------------------------------------ */

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rndi(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function chance(p) { return Math.random() < p; }
  function noop() {}

  /* Gammes (demi-tons depuis la tonique). */
  var SCALES = {
    hijaz:    [0, 1, 4, 5, 7, 8, 10],   // 1, b2, 3, 4, 5, b6, b7
    kurd:     [0, 1, 3, 5, 7, 8, 10],   // phrygien
    nihavend: [0, 2, 3, 5, 7, 8, 10],   // mineur naturel
    ussak:    [0, 1.5, 3, 5, 7, 8, 10]  // seconde neutre (approx. commatique)
  };

  /* Degré de gamme -> rapport de fréquence (les degrés hors bornes montent/descendent d'octave). */
  function degRatio(scale, d) {
    var n = scale.length;
    var oct = Math.floor(d / n);
    var i = d - oct * n;
    return Math.pow(2, (scale[i] + 12 * oct) / 12);
  }

  /* ------------------------------------------------------------------ */
  /* Moteur — instanciable sur n'importe quel contexte (live ou offline)  */
  /* ------------------------------------------------------------------ */

  function createEngine(ctx, options) {
    options = options || {};
    var offline = !!options.offline ||
      (typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext) ||
      (typeof window.webkitOfflineAudioContext !== 'undefined' && ctx instanceof window.webkitOfflineAudioContext);

    var sr = ctx.sampleRate;
    var LOOKAHEAD = 0.10;      // s d'anticipation
    var TICK_MS = 25;          // ms entre deux réveils du planificateur

    /* ---------------- graphe maître ---------------- */

    function gainNode(v) { var g = ctx.createGain(); g.gain.value = v; return g; }

    var master = gainNode(0.82);
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 26;
    comp.ratio.value = 2.6;
    comp.attack.value = 0.012;
    comp.release.value = 0.30;

    /* Limiteur doux : tanh. Gain unitaire pour les petits signaux, jamais d'écrêtage numérique. */
    var shaperIn = gainNode(1 / 3);
    var shaper = ctx.createWaveShaper();
    (function () {
      var n = 2049, c = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var u = (i / (n - 1)) * 2 - 1;
        c[i] = Math.tanh(u * 3);
      }
      shaper.curve = c;
      shaper.oversample = '2x';
    })();
    master.connect(comp);
    comp.connect(shaperIn);
    shaperIn.connect(shaper);
    shaper.connect(ctx.destination);

    /* Réverbération à convolution, réponse impulsionnelle générée. */
    var convolver = ctx.createConvolver();
    convolver.normalize = false;
    convolver.buffer = makeImpulse();
    var revReturn = gainNode(1.0);
    var revTone = ctx.createBiquadFilter();
    revTone.type = 'lowpass'; revTone.frequency.value = 4200; revTone.Q.value = 0.4;
    var revHi = ctx.createBiquadFilter();
    revHi.type = 'highpass'; revHi.frequency.value = 140;
    convolver.connect(revTone); revTone.connect(revHi); revHi.connect(revReturn);
    revReturn.connect(master);
    var revBus = gainNode(1.0);
    revBus.connect(convolver);

    /* Bus : sec + envoi vers la réverbération. */
    function makeBus(dry, wet) {
      var d = gainNode(dry), w = gainNode(wet), input = gainNode(1);
      input.connect(d); d.connect(master);
      input.connect(w); w.connect(revBus);
      return { in: input, dry: d, wet: w };
    }
    var busMusic = makeBus(0.62, 0.30);
    var busSfx   = makeBus(0.85, 0.20);
    var busAmb   = makeBus(0.40, 0.12);

    /* ---------------- réponse impulsionnelle ---------------- */

    function makeImpulse() {
      var dur = 1.45;                                  // queue ~1.2 s à -60 dB + marge
      var len = Math.max(8, Math.floor(sr * dur));
      var pre = Math.floor(0.015 * sr);                // pré-délai 15 ms
      var buf = ctx.createBuffer(2, len, sr);
      var early = [
        [0.0000, 0.62], [0.0091, -0.44], [0.0163, 0.38], [0.0247, -0.31],
        [0.0338, 0.26], [0.0451, -0.21], [0.0592, 0.17], [0.0733, -0.13]
      ];
      var peak = 0, ch, i;
      for (ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch);
        var y = 0, y2 = 0;
        var skew = ch === 0 ? 1 : 1.037;               // décorrélation stéréo
        for (i = pre; i < len; i++) {
          var t = (i - pre) / sr;
          var env = Math.pow(10, -3 * t / 1.2);        // -60 dB à 1.2 s
          var n = Math.random() * 2 - 1;
          // passe-bas qui se referme au fil de la queue
          var k = 0.78 - 0.62 * Math.min(1, t / 1.1);
          y += (n - y) * k;
          y2 += (y - y2) * 0.6;
          d[i] = y2 * env;
        }
        for (var e = 0; e < early.length; e++) {
          var idx = pre + Math.floor(early[e][0] * skew * sr);
          if (idx < len) d[idx] += early[e][1] * (ch === 0 ? 1 : 0.92);
        }
        for (i = 0; i < len; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; }
      }
      var norm = peak > 0 ? 0.30 / peak : 1;
      for (ch = 0; ch < 2; ch++) {
        var dd = buf.getChannelData(ch);
        for (i = 0; i < len; i++) dd[i] *= norm;
      }
      return buf;
    }

    /* ---------------- bruit réutilisable ---------------- */

    var whiteBuf = null, pinkBuf = null;

    function getWhite() {
      if (!whiteBuf) {
        var len = Math.floor(sr * 2);
        whiteBuf = ctx.createBuffer(1, len, sr);
        var d = whiteBuf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      return whiteBuf;
    }

    function getPink() {
      if (!pinkBuf) {
        var len = Math.floor(sr * 3);
        pinkBuf = ctx.createBuffer(1, len, sr);
        var d = pinkBuf.getChannelData(0);
        var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (var i = 0; i < len; i++) {
          var w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.96900 * b2 + w * 0.1538520;
          b3 = 0.86650 * b3 + w * 0.3104856;
          b4 = 0.55000 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.0168980;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        }
      }
      return pinkBuf;
    }

    /* ---------------- gestion des nœuds ---------------- */

    var voices = 0;
    var MAX_VOICES = 110;

    function budget(n) {
      if (offline) return true;
      return voices + (n || 1) <= MAX_VOICES;
    }

    /* Démarre une source, la stoppe et déconnecte toute la chaîne à la fin. */
    function fire(src, when, stopAt, chain) {
      voices++;
      try { src.start(when); } catch (e) {}
      try { src.stop(stopAt); } catch (e) {}
      src.onended = function () {
        voices--;
        try { src.disconnect(); } catch (e) {}
        if (chain) for (var i = 0; i < chain.length; i++) { try { chain[i].disconnect(); } catch (e) {} }
        src.onended = null;
      };
    }

    function noiseSrc(loop, pink) {
      var s = ctx.createBufferSource();
      s.buffer = pink ? getPink() : getWhite();
      if (loop) { s.loop = true; s.loopStart = 0; s.loopEnd = s.buffer.duration; }
      return s;
    }

    function panner(p) {
      if (ctx.createStereoPanner) { var n = ctx.createStereoPanner(); n.pan.value = clamp(p, -1, 1); return n; }
      return gainNode(1);
    }

    function bpf(freq, q) {
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      return f;
    }
    function lpf(freq, q) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq; if (q != null) f.Q.value = q;
      return f;
    }
    function hpf(freq) {
      var f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = freq;
      return f;
    }

    /* Enveloppe percussive simple. */
    function env(g, t0, peak, atk, dec, hold) {
      var p = g.gain;
      p.setValueAtTime(0.0001, t0);
      p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + atk);
      if (hold) p.setValueAtTime(Math.max(0.0002, peak), t0 + atk + hold);
      p.exponentialRampToValueAtTime(0.0001, t0 + atk + (hold || 0) + dec);
    }

    /* ------------------------------------------------------------------ */
    /* Cordes pincées — Karplus-Strong précalculé                          */
    /* ------------------------------------------------------------------ */

    var ksCache = {}, ksKeys = [];
    var KS_MAX = 30;

    /* Rend un AudioBuffer mono de corde pincée à la fréquence donnée. */
    function renderKS(freq, pluck, damp, dur) {
      var N = Math.max(3, Math.round(sr / freq));
      var len = Math.max(64, Math.ceil(sr * dur));
      var buf = ctx.createBuffer(1, len, sr);
      var out = buf.getChannelData(0);
      var line = new Float32Array(N);
      var i;

      /* Excitation : bruit lissé, filtré en peigne selon la position de pincement. */
      var raw = new Float32Array(N);
      for (i = 0; i < N; i++) raw[i] = Math.random() * 2 - 1;
      var pi = clamp(Math.round(N * pluck), 1, N - 1);
      var s = 0, mx = 0;
      for (i = 0; i < N; i++) {
        var v = raw[i] - raw[(i + pi) % N];
        s += (v - s) * 0.55;                         // adoucit l'attaque (plectre de corne, pas de clic)
        line[i] = s;
        var a = Math.abs(s); if (a > mx) mx = a;
      }
      if (mx > 0) for (i = 0; i < N; i++) line[i] /= mx;

      /* Boucle : passe-bas un pôle + perte, T60 réglé par `damp`. */
      var t60 = damp;
      var loss = Math.pow(10, -3 / (sr * t60));
      var lp = clamp(0.34 + 260 / freq, 0.28, 0.72);  // les graves perdent moins vite leurs aigus
      var y = 0, idx = 0;
      for (i = 0; i < len; i++) {
        var x = line[idx];
        y += (x - y) * lp;
        line[idx] = y * loss;
        out[i] = x;
        idx++; if (idx === N) idx = 0;
      }
      /* Fondu final pour éviter la coupure nette. */
      var fade = Math.min(len, Math.floor(sr * 0.06));
      for (i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
      return buf;
    }

    /* Récupère (ou rend) un buffer de corde pour la fréquence donnée.
       Le buffer est calculé sur la note tempérée la plus proche ; la fréquence exacte
       (et le désaccord en cents) est obtenue par playbackRate. */
    function ksBuffer(freq, pluckIdx, dampIdx) {
      var midi = Math.round(69 + 12 * Math.log(freq / 440) / Math.LN2);
      midi = clamp(midi, 24, 96);
      var base = 440 * Math.pow(2, (midi - 69) / 12);
      var key = midi + ':' + pluckIdx + ':' + dampIdx;
      var b = ksCache[key];
      if (!b) {
        var pluck = [0.13, 0.22, 0.33, 0.44][pluckIdx] || 0.25;
        var damp = [1.05, 1.7, 2.4][dampIdx] != null ? [1.05, 1.7, 2.4][dampIdx] : 1.7;
        var dur = clamp(2.5 - (midi - 40) * 0.022, 0.85, 2.5);
        b = renderKS(base, pluck, damp, dur);
        if (ksKeys.length >= KS_MAX) { delete ksCache[ksKeys.shift()]; }
        ksCache[key] = b; ksKeys.push(key);
      }
      return { buf: b, base: base };
    }

    /* Une corde. o = { vel, pluck (0..3), damp (0..2), cents, pan, dur, bus, wet } */
    function pluckString(t0, freq, o) {
      o = o || {};
      if (!budget(1)) return;
      var kb = ksBuffer(freq, o.pluck != null ? o.pluck : rndi(0, 3), o.damp != null ? o.damp : 1);
      var src = ctx.createBufferSource();
      src.buffer = kb.buf;
      var cents = o.cents || 0;
      src.playbackRate.value = (freq / kb.base) * Math.pow(2, cents / 1200);
      var life = Math.min(kb.buf.duration / src.playbackRate.value, o.dur || 3.0);

      var g = gainNode(0.0001);
      var vel = o.vel != null ? o.vel : 0.6;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.002, vel), t0 + 0.004);
      g.gain.setTargetAtTime(0.0001, t0 + life * 0.55, life * 0.30);

      /* Caisse : petit résonateur + adoucissement des aigus. */
      var body = ctx.createBiquadFilter();
      body.type = 'peaking'; body.frequency.value = o.body || 240; body.Q.value = 1.1; body.gain.value = 5;
      var soft = lpf(o.bright || 4600, 0.6);
      var p = panner(o.pan != null ? o.pan : rnd(-0.35, 0.35));

      src.connect(body); body.connect(soft); soft.connect(g); g.connect(p);
      p.connect((o.bus || busMusic).in);
      fire(src, t0, t0 + life + 0.1, [body, soft, g, p]);
    }

    /* Note de saz : deux cordes doublées, désaccordées de ±4 cents. */
    function saz(t0, freq, o) {
      o = o || {};
      var vel = o.vel != null ? o.vel : 0.55;
      var pluck = o.pluck != null ? o.pluck : rndi(0, 3);
      var bus = o.bus || busMusic;
      pluckString(t0, freq, {
        vel: vel, pluck: pluck, damp: o.damp, cents: rnd(-1.5, 1.5),
        pan: (o.pan || 0) - 0.13, bus: bus, dur: o.dur, bright: o.bright, body: o.body
      });
      if (o.double !== false) {
        pluckString(t0 + rnd(0.002, 0.009), freq, {
          vel: vel * (o.doubleLevel != null ? o.doubleLevel : 0.8),
          pluck: clamp(pluck + (chance(0.5) ? 1 : -1), 0, 3),
          damp: o.damp, cents: (chance(0.5) ? 1 : -1) * rnd(3, 4.5),
          pan: (o.pan || 0) + 0.15, bus: bus, dur: o.dur, bright: o.bright, body: o.body
        });
      }
    }

    /* ------------------------------------------------------------------ */
    /* Tambour à main                                                      */
    /* ------------------------------------------------------------------ */

    function drumHit(t0, type, vel, bus) {
      bus = bus || busSfx;
      vel = clamp(vel != null ? vel : 0.8, 0.05, 1.4);
      t0 += rnd(-0.012, 0.012);                         // micro-décalage humain ±12 ms
      if (t0 < ctx.currentTime) t0 = ctx.currentTime + 0.001;
      if (!budget(2)) return;

      if (type === 'tek' || type === 't') {
        /* tek : aigu, sec, sur le bord de la peau */
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(430 * rnd(0.94, 1.07), t0);
        o.frequency.exponentialRampToValueAtTime(250, t0 + 0.03);
        var og = gainNode(0.0001);
        env(og, t0, 0.30 * vel, 0.002, 0.085);
        var n = noiseSrc(false);
        n.playbackRate.value = rnd(0.9, 1.15);
        var nf = bpf(rnd(2600, 3600), 1.1);
        var nh = hpf(1400);
        var ng = gainNode(0.0001);
        env(ng, t0, 0.42 * vel, 0.0015, 0.10);
        var p = panner(rnd(-0.3, 0.3));
        o.connect(og); og.connect(p);
        n.connect(nf); nf.connect(nh); nh.connect(ng); ng.connect(p);
        p.connect(bus.in);
        fire(o, t0, t0 + 0.16, [og]);
        fire(n, t0, t0 + 0.18, [nf, nh, ng, p]);
      } else {
        /* dum : grave, hauteur descendante 180 -> 70 Hz en 80 ms */
        var o2 = ctx.createOscillator();
        o2.type = 'sine';
        o2.frequency.setValueAtTime(180 * rnd(0.95, 1.06), t0);
        o2.frequency.exponentialRampToValueAtTime(70, t0 + 0.08);
        var og2 = gainNode(0.0001);
        env(og2, t0, 0.72 * vel, 0.004, 0.34);
        var n2 = noiseSrc(false);
        n2.playbackRate.value = rnd(0.85, 1.1);
        var nf2 = lpf(rnd(380, 620), 1.2);
        var ng2 = gainNode(0.0001);
        env(ng2, t0, 0.30 * vel, 0.002, 0.11);
        var sk = noiseSrc(false);                         // claquement de peau
        var skf = bpf(rnd(1500, 2200), 1.4);
        var skg = gainNode(0.0001);
        env(skg, t0, 0.13 * vel, 0.001, 0.035);
        var p2 = panner(rnd(-0.15, 0.15));
        o2.connect(og2); og2.connect(p2);
        n2.connect(nf2); nf2.connect(ng2); ng2.connect(p2);
        sk.connect(skf); skf.connect(skg); skg.connect(p2);
        p2.connect(bus.in);
        fire(o2, t0, t0 + 0.5, [og2]);
        fire(n2, t0, t0 + 0.25, [nf2, ng2]);
        fire(sk, t0, t0 + 0.12, [skf, skg, p2]);
      }
    }

    /* ------------------------------------------------------------------ */
    /* Cloche / bois — synthèse modale                                     */
    /* ------------------------------------------------------------------ */

    /* ratios inharmoniques + décroissances différenciées */
    var MODAL = {
      bell: { r: [1, 2.02, 2.79, 4.11, 5.43, 7.02], a: [1, 0.62, 0.44, 0.28, 0.16, 0.09], d: [1, 0.72, 0.55, 0.36, 0.24, 0.15], noise: 0.14, nf: 4200 },
      wood: { r: [1, 2.71, 4.98, 7.4], a: [1, 0.5, 0.26, 0.12], d: [1, 0.42, 0.24, 0.13], noise: 0.5, nf: 2400 },
      tine: { r: [1, 4.02, 10.6], a: [1, 0.4, 0.15], d: [1, 0.5, 0.3], noise: 0.1, nf: 5200 }
    };

    function modal(t0, freq, o) {
      o = o || {};
      var kind = MODAL[o.kind || 'bell'];
      var vel = o.vel != null ? o.vel : 0.4;
      var decay = o.decay || 1.6;
      var bus = o.bus || busSfx;
      var n = Math.min(kind.r.length, o.partials || kind.r.length);
      if (!budget(n + 1)) return;
      var p = panner(o.pan != null ? o.pan : rnd(-0.25, 0.25));
      var mix = gainNode(1);
      mix.connect(p); p.connect(bus.in);
      var tails = [];
      for (var i = 0; i < n; i++) {
        var f = freq * kind.r[i] * (1 + rnd(-0.004, 0.004));
        if (f > sr * 0.45) continue;
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        var g = gainNode(0.0001);
        var d = decay * kind.d[i];
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0004, vel * kind.a[i]), t0 + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.004 + d);
        osc.connect(g); g.connect(mix);
        fire(osc, t0, t0 + 0.02 + d, [g]);
        tails.push(d);
      }
      /* transitoire de bruit (le marteau, le maillet) */
      var nb = noiseSrc(false);
      var nf = bpf(kind.nf * rnd(0.85, 1.2), 0.9);
      var ng = gainNode(0.0001);
      env(ng, t0, vel * kind.noise, 0.001, 0.022);
      nb.connect(nf); nf.connect(ng); ng.connect(mix);
      fire(nb, t0, t0 + 0.06, [nf, ng]);
      var maxd = 0.1; for (var k = 0; k < tails.length; k++) maxd = Math.max(maxd, tails[k]);
      var stopper = ctx.createBufferSource();     // porteur du nettoyage de mix/p
      stopper.buffer = getWhite(); stopper.loop = true;
      var mute = gainNode(0);
      stopper.connect(mute); mute.connect(master);
      fire(stopper, t0, t0 + maxd + 0.2, [mute, mix, p]);
    }

    /* ------------------------------------------------------------------ */
    /* Papier                                                              */
    /* ------------------------------------------------------------------ */

    /* Rafale de micro-grains de bruit passe-bande (2–6 kHz). */
    function paperBurst(t0, o) {
      o = o || {};
      var count = o.count || rndi(8, 15);
      var spread = o.spread != null ? o.spread : 0.055;
      var level = o.level != null ? o.level : 0.5;
      var lo = o.lo || 2000, hi = o.hi || 6000;
      var bus = o.bus || busSfx;
      var p = panner(o.pan != null ? o.pan : rnd(-0.35, 0.35));
      var mix = gainNode(1);
      mix.connect(p); p.connect(bus.in);
      var last = 0;
      for (var i = 0; i < count; i++) {
        if (!budget(1)) break;
        var frac = o.even ? i / count : Math.pow(Math.random(), o.skew || 1);
        var t = t0 + frac * spread;
        var dur = rnd(0.005, 0.015);                    // 5–15 ms
        var s = noiseSrc(false);
        s.playbackRate.value = rnd(0.8, 1.25);
        var f = bpf(rnd(lo, hi) * (o.tiltUp ? (0.6 + frac) : 1), rnd(1.4, 3.2));
        var g = gainNode(0.0001);
        var amp = level * rnd(0.25, 1.0) * (o.decay ? (1 - frac * 0.85) : 1);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0004, amp), t + dur * 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(mix);
        fire(s, t, t + dur + 0.01, [f, g]);
        last = Math.max(last, t + dur);
      }
      var stop = ctx.createBufferSource();
      stop.buffer = getWhite(); stop.loop = true;
      var mute = gainNode(0);
      stop.connect(mute); mute.connect(master);
      fire(stop, t0, last + 0.1, [mute, mix, p]);
    }

    /* Glissement : bruit filtré dont la fréquence monte ou descend (120 ms). */
    function paperGlide(t0, dir, o) {
      o = o || {};
      if (!budget(1)) return;
      var dur = o.dur || 0.12;
      var s = noiseSrc(false);
      s.playbackRate.value = rnd(0.85, 1.15);
      var f = bpf(1, 3.6);
      var a = o.from || (dir >= 0 ? 900 : 3200);
      var b = o.to || (dir >= 0 ? 3400 : 800);
      f.frequency.setValueAtTime(a, t0);
      f.frequency.exponentialRampToValueAtTime(b, t0 + dur);
      var g = gainNode(0.0001);
      var lv = o.level != null ? o.level : 0.32;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(lv, t0 + dur * 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      var p = panner(rnd(-0.25, 0.25));
      s.connect(f); f.connect(g); g.connect(p); p.connect((o.bus || busSfx).in);
      fire(s, t0, t0 + dur + 0.03, [f, g, p]);
    }

    /* Frottement long de tissu (rideau). */
    function clothRustle(t0, dur, level) {
      if (!budget(2)) return;
      var s = noiseSrc(true, true);
      s.playbackRate.value = rnd(0.8, 1.1);
      var f = bpf(600, 0.8);
      f.frequency.setValueAtTime(420, t0);
      f.frequency.linearRampToValueAtTime(1500, t0 + dur * 0.45);
      f.frequency.linearRampToValueAtTime(500, t0 + dur);
      var hp = hpf(220);
      var g = gainNode(0.0001);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(level, t0 + dur * 0.35);
      g.gain.linearRampToValueAtTime(level * 0.75, t0 + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      /* frémissement d'amplitude */
      var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = rnd(2.4, 4.2);
      var lg = gainNode(level * 0.35);
      lfo.connect(lg); lg.connect(g.gain);
      var p = panner(rnd(-0.2, 0.2));
      s.connect(f); f.connect(hp); hp.connect(g); g.connect(p); p.connect(busSfx.in);
      fire(s, t0, t0 + dur + 0.05, [f, hp, g, p]);
      fire(lfo, t0, t0 + dur + 0.05, [lg]);
    }

    /* ------------------------------------------------------------------ */
    /* Flûte de roseau (ney)                                               */
    /* ------------------------------------------------------------------ */

    function ney(t0, freq, dur, vel, bus) {
      if (!budget(3)) return;
      bus = bus || busMusic;
      vel = vel != null ? vel : 0.5;
      var s = noiseSrc(true);
      s.playbackRate.value = rnd(0.9, 1.1);

      var r1 = bpf(freq, 24);           // résonateur à haut Q = la hauteur
      var r2 = bpf(freq * 2, 14);
      var r3 = bpf(freq * 3, 9);
      var g1 = gainNode(1.0), g2 = gainNode(0.34), g3 = gainNode(0.12);
      var breath = hpf(2200);
      var gb = gainNode(0.035);

      var out = gainNode(0.0001);
      var atk = Math.min(0.16, dur * 0.35);
      out.gain.setValueAtTime(0.0001, t0);
      out.gain.exponentialRampToValueAtTime(Math.max(0.002, vel * 15), t0 + atk);
      out.gain.setValueAtTime(Math.max(0.002, vel * 15), t0 + Math.max(atk, dur - 0.22));
      out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      /* vibrato irrégulier : deux LFO incommensurables + léger souffle de hauteur */
      var v1 = ctx.createOscillator(); v1.type = 'sine'; v1.frequency.value = rnd(4.1, 5.0);
      var v2 = ctx.createOscillator(); v2.type = 'sine'; v2.frequency.value = rnd(6.3, 7.9);
      var vg1 = gainNode(freq * 0.012), vg2 = gainNode(freq * 0.006);
      var vdep = gainNode(0.0001);
      vdep.gain.setValueAtTime(0.0001, t0);
      vdep.gain.linearRampToValueAtTime(1, t0 + Math.min(0.5, dur * 0.6));
      v1.connect(vg1); v2.connect(vg2);
      vg1.connect(vdep); vg2.connect(vdep);
      vdep.connect(r1.frequency); vdep.connect(r2.frequency);

      s.connect(r1); r1.connect(g1); g1.connect(out);
      s.connect(r2); r2.connect(g2); g2.connect(out);
      s.connect(r3); r3.connect(g3); g3.connect(out);
      s.connect(breath); breath.connect(gb); gb.connect(out);
      var p = panner(rnd(-0.15, 0.15));
      out.connect(p); p.connect(bus.in);

      fire(s, t0, t0 + dur + 0.08, [r1, r2, r3, g1, g2, g3, breath, gb, out, p]);
      fire(v1, t0, t0 + dur + 0.08, [vg1]);
      fire(v2, t0, t0 + dur + 0.08, [vg2, vdep]);
    }

    /* ------------------------------------------------------------------ */
    /* Ambiance : lampe + public                                            */
    /* ------------------------------------------------------------------ */

    var amb = {
      on: false,
      audience: 0.25,
      lampSrc: null, lampGain: null,
      audSrc: null, audGain: null,
      nextCrackle: 0, nextBrown: 0, nextGrain: 0,
      brown: 0
    };

    function buildAmbience() {
      if (amb.lampSrc) return;
      /* lampe : bruit rose passe-bas ~800 Hz, amplitude en mouvement brownien lent */
      var s = noiseSrc(true, true);
      s.playbackRate.value = 0.85;
      var f = lpf(800, 0.7);
      var hp = hpf(80);
      var g = gainNode(0.10);
      s.connect(f); f.connect(hp); hp.connect(g); g.connect(busAmb.in);
      try { s.start(0); } catch (e) {}
      amb.lampSrc = s; amb.lampGain = g;

      /* public : bruit granulaire passé par deux formants */
      var a = noiseSrc(true, true);
      a.playbackRate.value = 0.55;
      var f1 = bpf(500, 4.5), f2 = bpf(1500, 6);
      var ag1 = gainNode(3.2), ag2 = gainNode(2.0);
      var ag = gainNode(0.0001);
      var alp = lpf(2600, 0.6);
      a.connect(f1); f1.connect(ag1); ag1.connect(ag);
      a.connect(f2); f2.connect(ag2); ag2.connect(ag);
      ag.connect(alp); alp.connect(busAmb.in);
      try { a.start(0); } catch (e) {}
      amb.audSrc = a; amb.audGain = ag;
    }

    function ambienceSchedule(until) {
      if (!amb.on) return;
      var t;
      /* mouvement brownien lent sur la lampe */
      while (amb.nextBrown < until) {
        t = Math.max(amb.nextBrown, ctx.currentTime);
        amb.brown = clamp(amb.brown + rnd(-0.28, 0.28), -1, 1);
        var lv = 0.075 + 0.038 * amb.brown;
        try { amb.lampGain.gain.setTargetAtTime(lv, t, 0.22); } catch (e) {}
        amb.nextBrown += rnd(0.12, 0.3);
      }
      /* crépitements (processus de Poisson) */
      while (amb.nextCrackle < until) {
        t = Math.max(amb.nextCrackle, ctx.currentTime + 0.001);
        if (budget(1)) {
          var s = noiseSrc(false);
          s.playbackRate.value = rnd(0.8, 1.4);
          var f = bpf(rnd(900, 3400), rnd(1.5, 5));
          var g = gainNode(0.0001);
          var d = rnd(0.004, 0.018);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(rnd(0.03, 0.14), t + 0.001);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d);
          var p = panner(rnd(-0.5, 0.5));
          s.connect(f); f.connect(g); g.connect(p); p.connect(busAmb.in);
          fire(s, t, t + d + 0.02, [f, g, p]);
        }
        amb.nextCrackle += -Math.log(1 - Math.random()) * 0.55;   // ~1.8 crépitement/s
      }
      /* public : densité pilotée par setAudience */
      var v = amb.audience;
      try { amb.audGain.gain.setTargetAtTime(0.0001 + v * 0.30, ctx.currentTime, 0.5); } catch (e) {}
      while (amb.nextGrain < until) {
        t = Math.max(amb.nextGrain, ctx.currentTime + 0.001);
        if (v > 0.02 && budget(1) && chance(0.35 + v * 0.6)) {
          var gs = noiseSrc(true, true);
          gs.playbackRate.value = rnd(0.5, 0.9);
          var gf = bpf(rnd(380, 1700), rnd(3, 7));
          var gg = gainNode(0.0001);
          var gd = rnd(0.06, 0.28);
          gg.gain.setValueAtTime(0.0001, t);
          gg.gain.linearRampToValueAtTime(rnd(0.05, 0.20) * (0.25 + v), t + gd * 0.4);
          gg.gain.exponentialRampToValueAtTime(0.0001, t + gd);
          var gp = panner(rnd(-0.7, 0.7));
          gs.connect(gf); gf.connect(gg); gg.connect(gp); gp.connect(busAmb.in);
          fire(gs, t, t + gd + 0.03, [gf, gg, gp]);
        }
        amb.nextGrain += rnd(0.09, 0.34) / (0.35 + v);
      }
    }

    function setAmbience(on) {
      on = !!on;
      if (on === amb.on) return;
      amb.on = on;
      if (on) {
        buildAmbience();
        var now = ctx.currentTime;
        amb.nextCrackle = now + 0.2; amb.nextBrown = now + 0.05; amb.nextGrain = now + 0.3;
        try { amb.lampGain.gain.setTargetAtTime(0.075, now, 0.8); } catch (e) {}
        startClock();
      } else if (amb.lampGain) {
        try { amb.lampGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); } catch (e) {}
        try { amb.audGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); } catch (e) {}
      }
    }

    /* ------------------------------------------------------------------ */
    /* Applaudissements                                                     */
    /* ------------------------------------------------------------------ */

    /* Grains d'applaudissements à densité décroissante, à un instant donné. */
    function applauseAt(t0, v, dur) {
      v = clamp(v != null ? v : 0.6, 0, 1);
      dur = dur || (1.5 + v * 2.5);                   // 1.5 s .. 4 s
      var mix = gainNode(0.9);
      var wide = panner(0);
      mix.connect(wide); wide.connect(busSfx.in);
      var t = t0, n = 0;
      var maxGrains = offline ? 900 : 380;
      while (t < t0 + dur && n < maxGrains) {
        var frac = (t - t0) / dur;
        var dens = (14 + v * 46) * Math.exp(-frac * 2.1) + 3;   // densité décroissante
        if (budget(1)) {
          var s = noiseSrc(false);
          s.playbackRate.value = rnd(0.7, 1.4);
          var f = bpf(rnd(1100, 3600), rnd(0.8, 2.4));
          var g = gainNode(0.0001);
          var d = rnd(0.006, 0.016);
          var amp = rnd(0.14, 0.55) * (0.5 + v * 0.6) * (1 - frac * 0.5);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(Math.max(0.0004, amp), t + 0.0015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d);
          var p = panner(rnd(-0.85, 0.85));
          s.connect(f); f.connect(g); g.connect(p); p.connect(mix);
          fire(s, t, t + d + 0.01, [f, g, p]);
          n++;
        }
        t += -Math.log(1 - Math.random()) / dens;
      }
      /* quelques « bravo » : formants glissants */
      if (v > 0.45) {
        var shouts = rndi(1, 1 + Math.round(v * 3));
        for (var i = 0; i < shouts; i++) bravo(t0 + rnd(0.25, dur * 0.7), mix);
      }
      var stop = ctx.createBufferSource();
      stop.buffer = getWhite(); stop.loop = true;
      var mute = gainNode(0);
      stop.connect(mute); mute.connect(master);
      fire(stop, t0, t0 + dur + 0.6, [mute, mix, wide]);
    }

    function applause(v) { applauseAt(ctx.currentTime + 0.02, v); }

    function bravo(t0, dest) {
      if (!budget(2)) return;
      var d = rnd(0.28, 0.5);
      var s = noiseSrc(true, true);
      s.playbackRate.value = rnd(0.6, 1.0);
      var f1 = bpf(700, 7), f2 = bpf(1200, 8);
      var a = rnd(0.75, 1.3);
      f1.frequency.setValueAtTime(620 * a, t0);
      f1.frequency.linearRampToValueAtTime(430 * a, t0 + d);
      f2.frequency.setValueAtTime(1100 * a, t0);
      f2.frequency.linearRampToValueAtTime(1650 * a, t0 + d);
      var g1 = gainNode(1), g2 = gainNode(0.6);
      var g = gainNode(0.0001);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(rnd(0.10, 0.22), t0 + d * 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      var p = panner(rnd(-0.8, 0.8));
      s.connect(f1); f1.connect(g1); g1.connect(g);
      s.connect(f2); f2.connect(g2); g2.connect(g);
      g.connect(p); p.connect(dest || busSfx.in);
      fire(s, t0, t0 + d + 0.05, [f1, f2, g1, g2, g, p]);
    }

    /* ------------------------------------------------------------------ */
    /* Thèmes                                                               */
    /* ------------------------------------------------------------------ */

    /* Motifs : suite d'objets { d: degré de gamme, b: durée en temps, v: vélocité, r: silence } */
    var THEMES = {
      menu: {
        bpm: 76, root: 146.83, scale: 'hijaz', beatsPerBar: 4, voice: 'saz',
        droneLevel: 0.5, droneOct: -1, sazLevel: 0.5, bright: 4200, damp: 1,
        bellDeg: 7, bellLevel: 0.16, bellDecay: 2.2,
        motif: [
          { d: 0, b: 1.5, v: 0.62 }, { d: 1, b: 0.5, v: 0.38 }, { d: 2, b: 1, v: 0.5 }, { d: 0, b: 1, v: 0.42 },
          { d: 4, b: 1.5, v: 0.6 }, { d: 3, b: 0.5, v: 0.34 }, { d: 2, b: 2, v: 0.46 },
          { r: 1, b: 1 }, { d: 1, b: 1, v: 0.4 }, { d: 0, b: 2, v: 0.55 },
          { d: -3, b: 1.5, v: 0.5 }, { d: -1, b: 0.5, v: 0.3 }, { d: 0, b: 2, v: 0.44 }
        ]
      },
      act1: {
        bpm: 86, root: 196.00, scale: 'hijaz', beatsPerBar: 4, voice: 'saz',
        droneLevel: 0.34, droneOct: -1, sazLevel: 0.55, bright: 5200, damp: 2,
        bellDeg: 7, bellLevel: 0.2, bellDecay: 1.8,
        motif: [
          { d: 0, b: 1, v: 0.6 }, { d: 2, b: 0.5, v: 0.42 }, { d: 3, b: 0.5, v: 0.44 }, { d: 4, b: 1, v: 0.62 }, { d: 2, b: 1, v: 0.46 },
          { d: 3, b: 1, v: 0.5 }, { d: 4, b: 0.5, v: 0.4 }, { d: 5, b: 0.5, v: 0.46 }, { d: 4, b: 2, v: 0.55 },
          { d: 7, b: 1, v: 0.64 }, { d: 6, b: 0.5, v: 0.4 }, { d: 5, b: 0.5, v: 0.42 }, { d: 4, b: 1, v: 0.5 }, { r: 1, b: 1 },
          { d: 2, b: 1, v: 0.48 }, { d: 1, b: 1, v: 0.4 }, { d: 0, b: 2, v: 0.58 },
          { d: 0, b: 0.5, v: 0.34 }, { d: 1, b: 0.5, v: 0.36 }, { d: 0, b: 1, v: 0.44 }, { r: 1, b: 2 }
        ]
      },
      act2: {
        bpm: 72, root: 110.00, scale: 'kurd', beatsPerBar: 4, voice: 'saz',
        droneLevel: 0.85, droneOct: 0, sazLevel: 0.5, bright: 3200, damp: 1,
        bellDeg: 4, bellLevel: 0.13, bellDecay: 2.6,
        motif: [
          { d: 0, b: 2, v: 0.55 }, { d: 1, b: 1, v: 0.38 }, { d: 0, b: 1, v: 0.34 },
          { d: 3, b: 1.5, v: 0.52 }, { d: 2, b: 0.5, v: 0.34 }, { d: 1, b: 2, v: 0.44 },
          { r: 1, b: 1 }, { d: -2, b: 1, v: 0.46 }, { d: 0, b: 2, v: 0.5 },
          { d: 4, b: 1, v: 0.5 }, { d: 3, b: 1, v: 0.4 }, { d: 1, b: 1, v: 0.36 }, { d: 0, b: 1, v: 0.42 },
          { d: -3, b: 2, v: 0.48 }, { r: 1, b: 2 }
        ]
      },
      act3: {
        bpm: 64, root: 82.41, scale: 'hijaz', beatsPerBar: 4, voice: 'saz',
        droneLevel: 1.0, droneOct: 0, sazLevel: 0.48, bright: 2600, damp: 0,
        bellDeg: 11, bellLevel: 0.09, bellDecay: 3.4, bellFar: true,
        motif: [
          { d: 0, b: 3, v: 0.5 }, { d: 1, b: 1, v: 0.34 },
          { d: 0, b: 2, v: 0.42 }, { r: 1, b: 2 },
          { d: 4, b: 2, v: 0.48 }, { d: 3, b: 1, v: 0.32 }, { d: 1, b: 1, v: 0.3 },
          { d: 0, b: 4, v: 0.46 },
          { d: -3, b: 2, v: 0.44 }, { d: 0, b: 1, v: 0.3 }, { r: 1, b: 1 }
        ]
      },
      performance: {
        bpm: 92, root: 146.83, scale: 'hijaz', beatsPerBar: 4, voice: 'saz',
        droneLevel: 0.45, droneOct: -1, sazLevel: 0.55, bright: 5000, damp: 2,
        bellDeg: 7, bellLevel: 0.18, bellDecay: 1.3,
        drum: 'D.t.D.tt..t.D.t.',
        motif: [
          { d: 0, b: 0.5, v: 0.6 }, { d: 0, b: 0.5, v: 0.34 }, { d: 2, b: 0.5, v: 0.48 }, { d: 1, b: 0.5, v: 0.36 },
          { d: 0, b: 0.5, v: 0.5 }, { d: 4, b: 0.5, v: 0.54 }, { d: 3, b: 1, v: 0.44 },
          { d: 2, b: 0.5, v: 0.5 }, { d: 3, b: 0.5, v: 0.4 }, { d: 4, b: 0.5, v: 0.56 }, { d: 2, b: 0.5, v: 0.38 },
          { d: 1, b: 1, v: 0.46 }, { d: 0, b: 1, v: 0.56 },
          { d: 5, b: 0.5, v: 0.52 }, { d: 4, b: 0.5, v: 0.4 }, { d: 3, b: 0.5, v: 0.46 }, { d: 2, b: 0.5, v: 0.38 },
          { d: 1, b: 0.5, v: 0.44 }, { d: 0, b: 1.5, v: 0.58 }
        ]
      },
      ending: {
        bpm: 60, root: 220.00, scale: 'hijaz', beatsPerBar: 4, voice: 'ney',
        droneLevel: 0.7, droneOct: -1, sazLevel: 0.62, bright: 4000, damp: 2,
        bellDeg: 7, bellLevel: 0.1, bellDecay: 2.8,
        motif: [
          { d: 0, b: 2.5, v: 0.5 }, { d: 1, b: 1.5, v: 0.4 },
          { d: 2, b: 2, v: 0.48 }, { d: 1, b: 1, v: 0.36 }, { d: 0, b: 1, v: 0.42 },
          { r: 1, b: 1 }, { d: 4, b: 3, v: 0.5 },
          { d: 3, b: 1.5, v: 0.4 }, { d: 2, b: 1.5, v: 0.38 }, { d: 0, b: 3, v: 0.46 },
          { r: 1, b: 2 }
        ]
      }
    };

    /* ---------------- séquenceur musical ---------------- */

    var music = {
      name: null,
      theme: null,
      gain: null,
      drone: null,
      next: 0,          // prochaine note (temps absolu)
      idx: 0,
      beat: 0,          // position en temps depuis le début
      intensity: 0.55,
      stopAt: 0,
      dead: false
    };
    var oldMusics = [];
    var FADE = 1.5;

    function makeDrone(theme, dest, level) {
      var root = theme.root * Math.pow(2, theme.droneOct || 0);
      var g = gainNode(0.0001);
      var band = bpf(root * 2.4, 1.6);
      var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.055 + Math.random() * 0.04;
      var lg = gainNode(root * 1.1);
      lfo.connect(lg); lg.connect(band.frequency);
      var soft = lpf(1800, 0.5);
      band.connect(soft); soft.connect(g); g.connect(dest);

      var oscs = [];
      var specs = [
        { f: root, det: -9, a: 0.5 },
        { f: root, det: +11, a: 0.5 },
        { f: root * 1.5, det: -6, a: 0.22 }
      ];
      for (var i = 0; i < specs.length; i++) {
        var o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = specs[i].f;
        o.detune.value = specs[i].det;
        var og = gainNode(specs[i].a);
        o.connect(og); og.connect(band);
        try { o.start(0); } catch (e) {}
        oscs.push(o, og);
      }
      try { lfo.start(0); } catch (e) {}
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(level, ctx.currentTime + 2.0);
      return {
        gain: g, level: level,
        stop: function (when) {
          try { g.gain.cancelScheduledValues(when); } catch (e) {}
          try { g.gain.setTargetAtTime(0.0001, when, 0.4); } catch (e) {}
          for (var k = 0; k < oscs.length; k++) {
            if (oscs[k].stop) { try { oscs[k].stop(when + 2.2); } catch (e) {} }
          }
          try { lfo.stop(when + 2.2); } catch (e) {}
          lfo.onended = function () {
            try { g.disconnect(); band.disconnect(); soft.disconnect(); lg.disconnect(); } catch (e) {}
          };
        }
      };
    }

    function startTheme(name, t0) {
      var theme = THEMES[name];
      if (!theme) return;
      var g = gainNode(0.0001);
      g.connect(busMusic.in);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(1, t0 + FADE);
      music = {
        name: name, theme: theme, gain: g, bus: { in: g },
        drone: makeDrone(theme, g, 0.042 * (theme.droneLevel || 0.5) + 0.006),
        next: t0 + 0.05, idx: 0, beat: 0,
        intensity: music.intensity, dead: false
      };
    }

    function fadeOutMusic(m, t0) {
      if (!m || !m.gain || m.dead) return;
      m.dead = true;
      try { m.gain.gain.cancelScheduledValues(t0); } catch (e) {}
      try { m.gain.gain.setValueAtTime(m.gain.gain.value, t0); } catch (e) {}
      try { m.gain.gain.linearRampToValueAtTime(0.0001, t0 + FADE); } catch (e) {}
      if (m.drone) m.drone.stop(t0);
      m.stopAt = t0 + FADE + 2.4;
      oldMusics.push(m);
    }

    function musicSchedule(until) {
      /* nettoyage des thèmes en cours d'extinction */
      for (var i = oldMusics.length - 1; i >= 0; i--) {
        if (oldMusics[i].stopAt < ctx.currentTime) {
          try { oldMusics[i].gain.disconnect(); } catch (e) {}
          oldMusics.splice(i, 1);
        }
      }
      var m = music;
      if (!m.theme || m.dead) return;
      var th = m.theme;
      var mbus = m.bus;
      var beatDur = 60 / th.bpm;
      var iv = clamp(m.intensity, 0, 1);
      var motif = th.motif;

      while (m.next < until) {
        var t = m.next;
        if (t < ctx.currentTime) t = ctx.currentTime + 0.005;
        var step = motif[m.idx % motif.length];
        var dur = step.b * beatDur;
        var barPos = m.beat % th.beatsPerBar;
        var strong = Math.abs(barPos) < 0.001;

        if (!step.r) {
          var f = th.root * degRatio(SCALES[th.scale], step.d);
          var vel = (step.v != null ? step.v : 0.5) * (0.85 + rnd(-0.09, 0.09));
          /* silences aléatoires : la troupe respire */
          var skip = chance(0.05 + (1 - iv) * 0.10) && !strong;
          if (!skip) {
            var lvl = (th.sazLevel || 0.5) * (0.42 + 0.58 * iv);
            if (th.voice === 'ney') {
              ney(t, f, Math.max(0.35, dur * 0.92), vel * lvl * 0.42, mbus);
              if (iv > 0.5 && chance(0.35)) {
                saz(t + dur * 0.5, f * 0.5, {
                  vel: vel * lvl * 0.5, double: iv > 0.62, damp: th.damp, bright: th.bright, bus: mbus
                });
              }
            } else {
              /* ornement : appogiature juste avant la note */
              if (iv > 0.5 && chance(0.10 + iv * 0.22)) {
                var od = chance(0.5) ? 1 : -1;
                var of = th.root * degRatio(SCALES[th.scale], step.d + od);
                saz(Math.max(ctx.currentTime + 0.001, t - 0.075), of, {
                  vel: vel * lvl * 0.42, double: false, damp: th.damp, bus: mbus,
                  bright: th.bright, pluck: rndi(2, 3), pan: rnd(-0.2, 0.2)
                });
              }
              saz(t, f, {
                vel: vel * lvl, double: iv > 0.32, doubleLevel: clamp((iv - 0.28) * 1.7, 0.15, 0.85),
                damp: th.damp, bright: th.bright, pluck: rndi(0, 3), pan: rnd(-0.18, 0.18),
                bus: mbus, dur: Math.max(0.7, dur * 2.2)
              });
              /* trille court sur les notes longues */
              if (iv > 0.72 && step.b >= 1.5 && chance(0.22)) {
                var tf = th.root * degRatio(SCALES[th.scale], step.d + 1);
                saz(t + dur * 0.45, tf, { vel: vel * lvl * 0.34, double: false, damp: th.damp, bright: th.bright, bus: mbus });
                saz(t + dur * 0.55, f, { vel: vel * lvl * 0.30, double: false, damp: th.damp, bright: th.bright, bus: mbus });
              }
            }
          }
        }

        /* petite cloche modale sur les temps forts quand l'intensité monte */
        if (strong && iv > 0.66 && th.bellLevel) {
          var everyBar = th.bellFar ? 4 : 2;
          if (Math.round(m.beat / th.beatsPerBar) % everyBar === 0) {
            var bf = th.root * degRatio(SCALES[th.scale], th.bellDeg) * (th.bellFar ? 2 : 2);
            modal(t, bf, {
              kind: 'bell',
              vel: th.bellLevel * (0.4 + (iv - 0.66) * 1.8) * (th.bellFar ? 0.5 : 1),
              decay: th.bellDecay, bus: mbus, pan: rnd(-0.4, 0.4),
              partials: th.bellFar ? 3 : 5
            });
          }
        }

        m.beat += step.b;
        m.next = t + dur;
        m.idx++;
        if (m.idx >= motif.length * 64) m.idx = m.idx % motif.length;
      }
    }

    /* ---------------- séquenceur de tambour ---------------- */

    var drumSeq = { on: false, steps: null, stepDur: 0.25, loopLen: 1, next: 0, pos: 0 };

    function parsePattern(pattern) {
      var steps = [], i;
      if (typeof pattern === 'string') {
        var sd = 60 / ((music.theme && music.theme.bpm) || 92) / 2;   // une croche
        for (i = 0; i < pattern.length; i++) {
          var c = pattern.charAt(i);
          if (c === 'D' || c === 'd') steps.push({ t: i * sd, type: 'dum', v: c === 'D' ? 1 : 0.7 });
          else if (c === 'T' || c === 't') steps.push({ t: i * sd, type: 'tek', v: c === 'T' ? 0.9 : 0.6 });
        }
        return { steps: steps, loopLen: pattern.length * sd };
      }
      if (Object.prototype.toString.call(pattern) === '[object Array]') {
        var maxT = 0;
        for (i = 0; i < pattern.length; i++) {
          var p = pattern[i];
          if (!p || p.type === 'rest') { if (p && p.t > maxT) maxT = p.t; continue; }
          steps.push({ t: p.t || 0, type: p.type === 'tek' ? 'tek' : 'dum', v: p.v != null ? p.v : 0.85 });
          if (p.t > maxT) maxT = p.t;
        }
        var len = pattern.loopLength || (maxT + (60 / ((music.theme && music.theme.bpm) || 92) / 2));
        return { steps: steps, loopLen: Math.max(0.2, len) };
      }
      return { steps: [], loopLen: 1 };
    }

    function startDrum(pattern) {
      var p = parsePattern(pattern);
      if (!p.steps.length) { stopDrum(); return; }
      drumSeq.on = true;
      drumSeq.steps = p.steps;
      drumSeq.loopLen = p.loopLen;
      drumSeq.next = ctx.currentTime + 0.06;
      drumSeq.pos = 0;
      startClock();
    }

    function stopDrum() { drumSeq.on = false; drumSeq.steps = null; }

    /* Planification coup par coup (motifs de longueur quelconque). */
    function drumSchedule(until) {
      if (!drumSeq.on || !drumSeq.steps) return;
      var guard = 0;
      while (guard++ < 400) {
        var loopIdx = Math.floor(drumSeq.pos / drumSeq.steps.length);
        var i = drumSeq.pos % drumSeq.steps.length;
        var s = drumSeq.steps[i];
        var t = drumSeq.next + loopIdx * drumSeq.loopLen + s.t;
        if (t >= until) break;
        if (t >= ctx.currentTime) drumHit(t, s.type, s.v * rnd(0.78, 1.05), busSfx);
        drumSeq.pos++;
      }
    }

    /* ---------------- horloge de planification ---------------- */

    var timer = null;

    function runSchedulers(until) {
      try { musicSchedule(until); } catch (e) { if (window.console) console.error('[BP.audio] music', e); }
      try { drumSchedule(until); } catch (e) { if (window.console) console.error('[BP.audio] drum', e); }
      try { ambienceSchedule(until); } catch (e) { if (window.console) console.error('[BP.audio] amb', e); }
    }

    function tick() {
      runSchedulers(ctx.currentTime + LOOKAHEAD);
      if (!music.theme && !drumSeq.on && !amb.on && !oldMusics.length) stopClock();
    }

    function startClock() {
      if (offline || timer) return;
      timer = setInterval(tick, TICK_MS);
      tick();
    }
    function stopClock() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    /* ------------------------------------------------------------------ */
    /* Effets                                                              */
    /* ------------------------------------------------------------------ */

    function arpeggio(t0, root, scale, degs, opts) {
      opts = opts || {};
      for (var i = 0; i < degs.length; i++) {
        var f = root * degRatio(SCALES[scale], degs[i]);
        saz(t0 + i * (opts.step || 0.085) + rnd(-0.006, 0.006), f, {
          vel: (opts.vel || 0.5) * (0.85 + i * 0.03), double: true, damp: opts.damp != null ? opts.damp : 2,
          bright: 5200, bus: busSfx, pan: rnd(-0.3, 0.3), pluck: rndi(0, 2)
        });
      }
    }

    var SFX = {
      pick: function (t) {
        paperBurst(t, { count: rndi(8, 11), spread: 0.045, level: 1.3, lo: 2400, hi: 6000, decay: true });
      },
      select: function (t) {
        paperBurst(t, { count: rndi(5, 8), spread: 0.022, level: 1.25, lo: 2600, hi: 6000, decay: true });
      },
      place: function (t) {
        paperBurst(t, { count: rndi(10, 15), spread: 0.06, level: 1.05, lo: 2000, hi: 5200, decay: true });
        if (budget(1)) {                                   // le papier qui touche la planche
          var s = noiseSrc(false);
          var f = lpf(320, 1.1);
          var g = gainNode(0.0001);
          env(g, t + 0.004, 0.42, 0.003, 0.075);
          var p = panner(rnd(-0.2, 0.2));
          s.connect(f); f.connect(g); g.connect(p); p.connect(busSfx.in);
          fire(s, t, t + 0.14, [f, g, p]);
        }
      },
      rotate: function (t) {
        paperBurst(t, { count: rndi(9, 14), spread: 0.09, level: 0.85, lo: 1800, hi: 5200, even: true, tiltUp: true });
      },
      depth: function (t, dir) {
        paperGlide(t, dir >= 0 ? 1 : -1, { level: 0.62 });
        paperBurst(t, { count: rndi(6, 9), spread: 0.05, level: 0.6, lo: 2600, hi: 6000, decay: true });
      },
      tilt: function (t) {
        paperBurst(t, { count: rndi(8, 12), spread: 0.07, level: 0.8, lo: 2200, hi: 5600, even: true });
        paperGlide(t + 0.01, -1, { level: 0.34, dur: 0.1, from: 2600, to: 1300 });
      },
      flip: function (t) {
        paperBurst(t, { count: rndi(6, 9), spread: 0.03, level: 0.85, lo: 2400, hi: 6000, decay: true });
        paperBurst(t + 0.065, { count: rndi(7, 11), spread: 0.045, level: 1.0, lo: 2000, hi: 5400, decay: true });
      },
      page: function (t) {
        paperBurst(t, { count: rndi(12, 15), spread: 0.16, level: 0.9, lo: 1800, hi: 5600, even: true, tiltUp: true });
        paperGlide(t + 0.02, 1, { level: 0.46, dur: 0.22, from: 700, to: 2600 });
      },
      remove: function (t) {                                // papier froissé
        paperBurst(t, { count: 15, spread: 0.18, level: 1.0, lo: 1800, hi: 6000 });
        paperBurst(t + 0.09, { count: 13, spread: 0.16, level: 0.78, lo: 2200, hi: 6000, decay: true });
        paperGlide(t + 0.02, -1, { level: 0.3, dur: 0.24, from: 3000, to: 900 });
      },
      undo: function (t) {
        paperBurst(t, { count: rndi(6, 9), spread: 0.03, level: 0.78, lo: 2600, hi: 6000, decay: true });
        paperGlide(t + 0.015, -1, { level: 0.6, dur: 0.13, from: 3200, to: 800 });
      },
      ui: function (t) { modal(t, 620, { kind: 'wood', vel: 0.16, decay: 0.16, partials: 3 }); },
      error: function (t) {                                 // corde étouffée grave
        pluckString(t, 98, { vel: 0.42, pluck: 0, damp: 0, dur: 0.5, bright: 1400, bus: busSfx, pan: 0 });
        pluckString(t + 0.01, 97.2, { vel: 0.30, pluck: 0, damp: 0, dur: 0.45, bright: 1200, bus: busSfx, pan: 0.1 });
        modal(t, 150, { kind: 'wood', vel: 0.12, decay: 0.2, partials: 2, bus: busSfx });
      },
      beat: function (t) { drumHit(t, 'dum', 0.95, busSfx); },
      star: function (t) { modal(t, 1180, { kind: 'bell', vel: 0.30, decay: 2.0, bus: busSfx }); },
      achievement: function (t) {
        modal(t, 880, { kind: 'bell', vel: 0.26, decay: 2.2, bus: busSfx, pan: -0.2 });
        modal(t + 0.19, 1320, { kind: 'bell', vel: 0.24, decay: 2.6, bus: busSfx, pan: 0.22 });
      },
      unlock: function (t) {
        saz(t, 293.66, { vel: 0.5, double: true, damp: 2, bright: 5200, bus: busSfx });
        modal(t + 0.14, 1174, { kind: 'tine', vel: 0.2, decay: 1.6, bus: busSfx, pan: 0.15 });
      },
      success: function (t) {
        arpeggio(t, 293.66, 'hijaz', [0, 2, 4, 7], { vel: 0.5, step: 0.09 });
        applauseAt(t + 0.32, 0.32, 0.9);
      },
      gold: function (t) {
        arpeggio(t, 293.66, 'hijaz', [0, 2, 3, 4, 6, 7, 9], { vel: 0.55, step: 0.075 });
        modal(t + 0.55, 1174, { kind: 'bell', vel: 0.28, decay: 3.0, bus: busSfx });
        applauseAt(t + 0.4, 0.95, 3.6);
      },
      curtain: function (t) {
        clothRustle(t, 1.7, 0.17);
        drumHit(t + 1.35, 'dum', 0.7, busSfx);
        drumHit(t + 1.55, 'tek', 0.45, busSfx);
      }
    };

    /* ------------------------------------------------------------------ */
    /* API du moteur                                                       */
    /* ------------------------------------------------------------------ */

    var api = {
      ctx: ctx,
      offline: offline,
      master: master,

      sfx: function (name, arg) {
        var fn = SFX[name];
        if (!fn) return;
        var t = ctx.currentTime + 0.005;
        fn(t, arg);
      },

      playMusic: function (name) {
        if (!THEMES[name]) return;
        var t0 = ctx.currentTime + 0.02;
        if (music.name === name && !music.dead) return;
        if (music.theme) fadeOutMusic(music, t0);
        startTheme(name, t0);
        startClock();
      },

      stopMusic: function () {
        if (music.theme) fadeOutMusic(music, ctx.currentTime + 0.01);
        music = { name: null, theme: null, gain: null, drone: null, next: 0, idx: 0, beat: 0, intensity: music.intensity, dead: true };
      },

      setIntensity: function (v) { music.intensity = clamp(v, 0, 1); },
      setAudience: function (v) { amb.audience = clamp(v, 0, 1); if (amb.on) startClock(); },
      applause: applause,
      ambience: setAmbience,
      drum: startDrum,
      stopDrum: stopDrum,

      setVolumes: function (v) {
        var t = ctx.currentTime;
        if (v.music != null) {
          busMusic.dry.gain.setTargetAtTime(0.62 * v.music, t, 0.05);
          busMusic.wet.gain.setTargetAtTime(0.30 * v.music, t, 0.05);
        }
        if (v.sfx != null) {
          busSfx.dry.gain.setTargetAtTime(0.85 * v.sfx, t, 0.05);
          busSfx.wet.gain.setTargetAtTime(0.20 * v.sfx, t, 0.05);
          busAmb.dry.gain.setTargetAtTime(0.40 * v.sfx, t, 0.05);
          busAmb.wet.gain.setTargetAtTime(0.12 * v.sfx, t, 0.05);
        }
      },

      setMuted: function (b) {
        master.gain.setTargetAtTime(b ? 0.0001 : 0.82, ctx.currentTime, 0.03);
      },

      /* Utilitaires internes (tests / rendu hors ligne) */
      _prerender: function (seconds, step) {
        step = step || 0.1;
        for (var t = 0; t < seconds + step; t += step) runSchedulers(t + step);
      },
      _themes: THEMES,
      _sfxAt: function (name, t, arg) { if (SFX[name]) SFX[name](t, arg); },
      _dispose: function () {
        stopClock();
        try { master.disconnect(); } catch (e) {}
      },
      _stats: function () { return { voices: voices, ks: ksKeys.length, old: oldMusics.length }; }
    };

    return api;
  }

  /* ------------------------------------------------------------------ */
  /* Façade publique                                                     */
  /* ------------------------------------------------------------------ */

  var engine = null;
  var ctx = null;
  var state = { muted: false, music: 0.7, sfx: 0.9, ready: false, wantAmbience: false, wantMusic: null, intensity: 0.55, audience: 0.25 };
  var visBound = false;
  var suspendedByHide = false;

  function ensure() { return engine; }

  var audio = {

    /** Crée le contexte audio. Idempotent. À appeler dans un geste utilisateur. */
    init: function () {
      if (engine || !AC) { if (!AC) state.ready = false; return !!engine; }
      try {
        ctx = new AC();
      } catch (e) {
        ctx = null;
        return false;
      }
      try {
        engine = createEngine(ctx);
      } catch (e2) {
        if (window.console) console.error('[BP.audio] init', e2);
        engine = null;
        return false;
      }
      state.ready = true;
      engine.setVolumes({ music: state.music, sfx: state.sfx });
      engine.setMuted(state.muted);
      engine.setIntensity(state.intensity);
      engine.setAudience(state.audience);
      if (state.wantAmbience) engine.ambience(true);
      if (state.wantMusic) engine.playMusic(state.wantMusic);

      if (!visBound && typeof document !== 'undefined' && document.addEventListener) {
        visBound = true;
        document.addEventListener('visibilitychange', function () {
          if (!ctx) return;
          if (document.hidden) {
            if (ctx.state === 'running') { suspendedByHide = true; try { ctx.suspend(); } catch (e) {} }
          } else if (suspendedByHide) {
            suspendedByHide = false;
            try { ctx.resume(); } catch (e) {}
          }
        }, false);
      }
      this.resume();
      return true;
    },

    /** Reprend le contexte (politique d'autoplay). */
    resume: function () {
      if (!ctx) return;
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    },

    isReady: function () { return !!engine; },
    state: function () { return ctx ? ctx.state : 'unavailable'; },

    setMuted: function (b) {
      state.muted = !!b;
      if (engine) engine.setMuted(state.muted);
    },

    setVolumes: function (v) {
      v = v || {};
      if (v.music != null) state.music = clamp(v.music, 0, 1);
      if (v.sfx != null) state.sfx = clamp(v.sfx, 0, 1);
      if (engine) engine.setVolumes({ music: state.music, sfx: state.sfx });
    },

    sfx: function (name, arg) { if (engine) engine.sfx(name, arg); },

    playMusic: function (theme) {
      state.wantMusic = theme;
      if (engine) engine.playMusic(theme);
    },

    stopMusic: function () {
      state.wantMusic = null;
      if (engine) engine.stopMusic();
    },

    setIntensity: function (v) {
      state.intensity = clamp(v, 0, 1);
      if (engine) engine.setIntensity(state.intensity);
    },

    setAudience: function (v) {
      state.audience = clamp(v, 0, 1);
      if (engine) engine.setAudience(state.audience);
    },

    applause: function (v) { if (engine) engine.applause(v); },

    drum: function (pattern) { if (engine) engine.drum(pattern); },
    stopDrum: function () { if (engine) engine.stopDrum(); },

    ambience: function (on) {
      state.wantAmbience = !!on;
      if (engine) engine.ambience(!!on);
    },

    /** Usage interne / tests : monte un moteur sur un contexte fourni (OfflineAudioContext). */
    _createEngine: function (c) { return createEngine(c); },
    _engine: function () { return engine; },
    _available: !!AC
  };

  if (!AC) {
    /* Aucun AudioContext : tout devient no-op silencieux. */
    for (var k in audio) {
      if (typeof audio[k] === 'function' && k !== '_createEngine' && k !== 'state') audio[k] = noop;
    }
    audio.init = function () { return false; };
    audio.isReady = function () { return false; };
    audio.state = function () { return 'unavailable'; };
    audio._createEngine = function () { return null; };
  }

  BP.audio = audio;

})(window.BP);
