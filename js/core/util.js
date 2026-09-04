window.U = {
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
  ease: { outCubic: t => 1 - Math.pow(1 - t, 3), inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2, outBack: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2), outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1 },
  // seeded PRNG (mulberry32)
  rng: (seed) => { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
  fmtTime: (s) => { s = Math.floor(s); const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); },
  fmtNum: (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(Math.floor(n)),
  el: (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; },
  isMobile: () => ('ontouchstart' in window) && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
};
