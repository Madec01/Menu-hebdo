/* CORE — sons de synthese (WebAudio), sans aucun fichier. */
window.CORE = window.CORE || {};
(function (CORE) {
  'use strict';

  var ctx = null, master = null, drillGain = null, drillSrc = null, enabled = true;

  function init() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // bruit blanc en boucle pour le forage
    var len = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    drillSrc = ctx.createBufferSource();
    drillSrc.buffer = buf; drillSrc.loop = true;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700;
    drillGain = ctx.createGain();
    drillGain.gain.value = 0;
    drillSrc.connect(lp); lp.connect(drillGain); drillGain.connect(master);
    drillSrc.start();
  }

  function blip(freq, dur, type, vol, slide) {
    if (!enabled) return;
    init();
    if (!ctx) return;
    var o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), ctx.currentTime + dur);
    gn.gain.setValueAtTime(vol || 0.18, ctx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(gn); gn.connect(master);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  CORE.SFX = {
    init: init,
    toggle: function () { enabled = !enabled; if (master) master.gain.value = enabled ? 0.5 : 0; return enabled; },
    enabled: function () { return enabled; },
    drill: function (on, intensity) {
      if (!ctx || !enabled) return;
      drillGain.gain.value = on ? Math.min(0.22, 0.05 + intensity * 0.05) : 0;
    },
    breakBlock: function () { blip(180 + Math.random() * 60, 0.07, 'square', 0.10, 70); },
    ore: function () { blip(880, 0.10, 'triangle', 0.16, 1320); },
    gold: function () { blip(660, 0.09, 'triangle', 0.2, 990); setTimeout(function () { blip(990, 0.12, 'triangle', 0.18, 1480); }, 70); },
    bonus: function () { blip(520, 0.09, 'sawtooth', 0.14, 1040); setTimeout(function () { blip(1040, 0.14, 'square', 0.12, 1560); }, 60); },
    malus: function () { blip(200, 0.25, 'sawtooth', 0.16, 60); },
    stall: function () { blip(90, 0.12, 'square', 0.12, 60); },
    turbo: function () { blip(300, 0.3, 'sawtooth', 0.14, 900); },
    land: function () { blip(120, 0.12, 'square', 0.12, 60); },
    level: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        setTimeout(function () { blip(f, 0.16, 'triangle', 0.16); }, i * 90);
      });
    },
    /* trois sons distincts pour les niveaux I, II et III d'un bonus */
    bonusTier: function (level) {
      if (level >= 3) {
        [660, 880, 1100, 1320, 1760].forEach(function (f, i) {
          setTimeout(function () { blip(f, 0.14, 'square', 0.17); }, i * 55);
        });
      } else if (level === 2) {
        blip(620, 0.09, 'sawtooth', 0.15, 1240);
        setTimeout(function () { blip(1240, 0.13, 'square', 0.14, 1860); }, 60);
      } else {
        blip(520, 0.09, 'sawtooth', 0.14, 1040);
        setTimeout(function () { blip(1040, 0.12, 'square', 0.12, 1560); }, 55);
      }
    },
    expire: function () { blip(150, 0.14, 'square', 0.11, 70); },
    fuel: function () { blip(300, 0.1, 'triangle', 0.16, 520); },
    alarm: function () {
      [0, 220, 440].forEach(function (d) {
        setTimeout(function () { blip(760, 0.12, 'square', 0.16, 500); }, d);
      });
    },
    cascade: function () {
      [900, 1150, 1400, 1700].forEach(function (f, i) {
        setTimeout(function () { blip(f, 0.1, 'triangle', 0.12); }, i * 45);
      });
    },
    blast: function () { blip(120, 0.35, 'sawtooth', 0.2, 40); },
    bounce: function () { blip(400, 0.16, 'sine', 0.16, 1100); },
    hurt: function () {
      blip(220, 0.22, 'sawtooth', 0.22, 70);
      setTimeout(function () { blip(140, 0.3, 'square', 0.16, 50); }, 60);
    },
    fail: function () {
      [400, 320, 250, 180, 120].forEach(function (f, i) {
        setTimeout(function () { blip(f, 0.22, 'sawtooth', 0.18); }, i * 110);
      });
    },
    creak: function () { blip(90, 0.35, 'sawtooth', 0.09, 130); },
    rockfall: function () {
      blip(70, 0.4, 'sawtooth', 0.2, 35);
      setTimeout(function () { blip(110, 0.25, 'square', 0.12, 45); }, 80);
    },
    faille: function (near) {
      if (!ctx || !enabled) return;
      blip(55 + near * 40, 0.5, 'sawtooth', 0.06 + near * 0.1, 40);
    },
    event: function () {
      blip(180, 0.5, 'sawtooth', 0.13, 320);
      setTimeout(function () { blip(320, 0.4, 'triangle', 0.12, 240); }, 140);
    }
  };
})(window.CORE);
