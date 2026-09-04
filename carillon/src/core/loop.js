// core/loop.js — boucle à pas fixe (ARCHITECTURE.md § 4).
// La logique tourne à stepHz (60 Hz) via un accumulateur ; le rendu est appelé
// une fois par frame avec alpha ∈ [0,1] pour interpoler. timeScale module dt
// (0 = hit-stop, 0.4 = ralenti de mort) sans toucher au nombre de pas.

/**
 * @param {object} o
 * @param {(dt:number)=>void} o.update   appelé N fois par frame, dt = timeScale / stepHz
 * @param {(alpha:number)=>void} o.render appelé une fois par frame
 * @param {number} [o.stepHz=60]
 * @param {number} [o.maxFrameMs=250]  plafond du temps rattrapé par frame (spirale de la mort)
 */
export function createLoop({ update, render, stepHz = 60, maxFrameMs = 250 }) {
  const stepSec = 1 / stepHz;
  const stepMs = 1000 / stepHz;
  let running = false;
  let rafId = 0;
  let last = 0;            // horodatage de la frame précédente (ms)
  let acc = 0;             // accumulateur (ms)
  let timeScale = 1;
  let fpsAcc = 0, fpsFrames = 0; // moyenne glissante sur ~500 ms

  const stats = {
    fps: 0,          // frames rendues par seconde (moyenne 0,5 s)
    updates: 0,      // pas logiques exécutés à la dernière frame
    entities: 0,     // libre : le jeu y écrit son nombre d'entités actives
    frameMs: 0,      // durée réelle de la dernière frame (update + render)
    updateMs: 0,
    renderMs: 0,
    frames: 0,       // compteur total de frames rendues
    ticks: 0,        // compteur total de pas logiques
    timeScale: 1,
  };

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    let elapsed = now - last;
    last = now;
    if (elapsed > maxFrameMs) elapsed = maxFrameMs; // onglet en arrière-plan, pic GC…
    if (elapsed < 0) elapsed = 0;
    acc += elapsed;

    // Mesure des fps (temps réel, indépendante du timeScale).
    fpsAcc += elapsed; fpsFrames++;
    if (fpsAcc >= 500) { stats.fps = Math.round(fpsFrames * 1000 / fpsAcc); fpsAcc = 0; fpsFrames = 0; }

    const t0 = performance.now();
    let n = 0;
    const dt = stepSec * timeScale;
    while (acc >= stepMs) {
      update(dt);
      acc -= stepMs;
      n++;
      stats.ticks++;
    }
    const t1 = performance.now();
    render(acc / stepMs);
    const t2 = performance.now();

    stats.updates = n;
    stats.updateMs = t1 - t0;
    stats.renderMs = t2 - t1;
    stats.frameMs = t2 - t0;
    stats.frames++;
    stats.timeScale = timeScale;
  }

  return {
    stats,
    /** Démarre (idempotent). */
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      rafId = requestAnimationFrame(frame);
    },
    /** Arrête ; l'accumulateur est remis à zéro au prochain start(). */
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    },
    /** Facteur de temps logique (0 gèle la logique, le rendu continue). */
    setTimeScale(s) { timeScale = Math.max(0, +s || 0); stats.timeScale = timeScale; },
    getTimeScale() { return timeScale; },
    get running() { return running; },
    /** Durée d'un pas logique en secondes (sans timeScale). */
    stepSec,
  };
}
