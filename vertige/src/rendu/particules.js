// Pool de particules à taille fixe (≤ 800), zéro allocation par frame (§2 « juice »).
// Une seule famille visuelle « cartoon » : confettis rectangulaires multicolores qui
// tournent avec la gravité, et étoiles à 4 branches. Toujours en 'source-over'.

const MAX = 800;
const PALETTE = ['#ff3b5c', '#3ad24f', '#2f8cff', '#ffcc1f', '#b04cff', '#22d3ee', '#ff5fa2', '#ff9f1c', '#ffffff'];

function hex2rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

export function creerParticules() {
  // tableaux typés partagés, index 0..n-1 = particules actives (swap-remove à la mort)
  const x = new Float32Array(MAX), y = new Float32Array(MAX);
  const vx = new Float32Array(MAX), vy = new Float32Array(MAX);
  const rot = new Float32Array(MAX), vrot = new Float32Array(MAX);
  const vie = new Float32Array(MAX), vieMax = new Float32Array(MAX);
  const taille = new Float32Array(MAX);
  const r = new Uint8Array(MAX), g = new Uint8Array(MAX), b = new Uint8Array(MAX);
  const forme = new Uint8Array(MAX); // 0 = confetti rectangle, 1 = étoile 4 branches
  let n = 0;

  function creerParticule(px, py, cr, cg, cb, f, opts) {
    if (n >= MAX) return; // pool plein : on ignore silencieusement (plafonné par contrat)
    const i = n++;
    x[i] = px; y[i] = py;
    const angle = opts.angleBase + (Math.random() - 0.5) * opts.etalement;
    const vitesse = opts.vitesseMin + Math.random() * (opts.vitesseMax - opts.vitesseMin);
    vx[i] = Math.cos(angle) * vitesse; vy[i] = Math.sin(angle) * vitesse;
    rot[i] = Math.random() * Math.PI * 2;
    vrot[i] = (Math.random() - 0.5) * opts.vrotMax;
    vieMax[i] = vie[i] = opts.vieMin + Math.random() * (opts.vieMax - opts.vieMin);
    taille[i] = opts.tailleMin + Math.random() * (opts.tailleMax - opts.tailleMin);
    r[i] = cr; g[i] = cg; b[i] = cb; forme[i] = f;
  }

  const OPTS_CONFETTI = { angleBase: -Math.PI / 2, etalement: Math.PI * 1.7, vitesseMin: 70, vitesseMax: 260, vrotMax: 12, vieMin: 0.4, vieMax: 0.8, tailleMin: 3, tailleMax: 7 };
  const OPTS_ETOILE = { angleBase: -Math.PI / 2, etalement: Math.PI * 1.5, vitesseMin: 50, vitesseMax: 180, vrotMax: 6, vieMin: 0.35, vieMax: 0.65, tailleMin: 3, tailleMax: 6 };

  // confettis multicolores + étoiles à 4 branches — juice de destruction, proportionnel et
  // plafonné par l'appelant (rendu.js) via `nombre`. hexAccent = couleur de la bille détruite.
  function emettreDestruction(px, py, hexAccent, nombre) {
    const teintes = [hexAccent, hexAccent, ...PALETTE];
    for (let k = 0; k < nombre; k++) {
      const hex = teintes[(Math.random() * teintes.length) | 0];
      const [cr, cg, cb] = hex2rgb(hex);
      const etoile = k % 3 === 0;
      creerParticule(px, py, cr, cg, cb, etoile ? 1 : 0, etoile ? OPTS_ETOILE : OPTS_CONFETTI);
    }
  }
  // confettis multicolores seuls (éclatement d'un ballon)
  function emettreConfettis(px, py, nombre) {
    for (let k = 0; k < nombre; k++) {
      const hex = PALETTE[(Math.random() * PALETTE.length) | 0];
      const [cr, cg, cb] = hex2rgb(hex);
      creerParticule(px, py, cr, cg, cb, 0, OPTS_CONFETTI);
    }
  }

  // intégration physique — dt en secondes. Suppression par swap-remove, zéro allocation.
  function maj(dt) {
    const GRAVITE = 480, AMORTI = 0.995;
    for (let i = 0; i < n; i++) {
      vy[i] += GRAVITE * dt;
      vx[i] += Math.cos(rot[i] * 2.3) * 30 * dt; vx[i] *= AMORTI; // léger flottement, façon confetti
      x[i] += vx[i] * dt; y[i] += vy[i] * dt; rot[i] += vrot[i] * dt;
      vie[i] -= dt;
      if (vie[i] <= 0) {
        const last = n - 1;
        x[i] = x[last]; y[i] = y[last]; vx[i] = vx[last]; vy[i] = vy[last];
        rot[i] = rot[last]; vrot[i] = vrot[last]; vie[i] = vie[last]; vieMax[i] = vieMax[last];
        taille[i] = taille[last]; r[i] = r[last]; g[i] = g[last]; b[i] = b[last]; forme[i] = forme[last];
        n--; i--; // réévaluer cet index (occupé par l'ancienne dernière particule)
      }
    }
  }

  function cheminEtoile(ctx, s) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      const aMid = a + Math.PI / 4;
      ctx.lineTo(Math.cos(aMid) * s * 0.4, Math.sin(aMid) * s * 0.4);
    }
    ctx.closePath();
  }

  // dessin — toujours source-over, jamais additif (§2).
  function dessiner(ctx) {
    if (n === 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < n; i++) {
      const alpha = Math.max(0, Math.min(1, vie[i] / vieMax[i])), s = taille[i];
      ctx.save(); ctx.translate(x[i], y[i]); ctx.rotate(rot[i]); ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${r[i]},${g[i]},${b[i]})`;
      if (forme[i] === 1) cheminEtoile(ctx, s); else { ctx.beginPath(); ctx.rect(-s * 0.6, -s * 0.35, s * 1.2, s * 0.7); }
      ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  return {
    emettreDestruction, emettreConfettis,
    maj, dessiner,
    get enCours() { return n > 0; },
    vider() { n = 0; },
  };
}
