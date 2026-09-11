// Décor animé « Cartoon pop » (docs/CONTRATS.md §2) : ciel en dégradé, nuages qui dérivent,
// éventail de rayons et scintilles flottantes. Coût minimal par frame : un dégradé plein
// écran, un éventail de triangles, et 6 drawImage pour les nuages (sprite unique pré-rendu,
// jamais reconstruit par frame). rendu.js garde la boucle rAF active tant que le canvas est
// visible et la coupe sur document.hidden — voir §5.

import { CIEL_HAUT, CIEL_BAS } from '../data/couleurs.js';

const N_NUAGES = 6;
const N_SCINTILLES = 10;

function creerCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return { canvas: c, ctx: c.getContext('2d') };
}

// nuage cartoon : bulles superposées, contour encre fin
function batirNuage(taille) {
  const w = taille * 2.6, h = taille * 1.5;
  const { canvas, ctx } = creerCanvas(w, h);
  const lobes = [
    { x: w * 0.26, y: h * 0.64, r: taille * 0.48 },
    { x: w * 0.48, y: h * 0.42, r: taille * 0.62 },
    { x: w * 0.72, y: h * 0.58, r: taille * 0.46 },
    { x: w * 0.38, y: h * 0.72, r: taille * 0.4 },
    { x: w * 0.62, y: h * 0.72, r: taille * 0.38 },
  ];
  ctx.save();
  ctx.beginPath();
  for (const l of lobes) { ctx.moveTo(l.x + l.r, l.y); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); }
  // Contour d'abord, remplissage ensuite : le blanc recouvre les arcs intérieurs, seul le pourtour de l'union reste cerné.
  ctx.lineWidth = Math.max(2, taille * 0.1); ctx.strokeStyle = 'rgba(29,27,58,0.45)'; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
  return canvas;
}

function cheminEtoile4(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    const aMid = a + Math.PI / 4;
    ctx.lineTo(cx + Math.cos(aMid) * r * 0.4, cy + Math.sin(aMid) * r * 0.4);
  }
  ctx.closePath();
}

export function creerDecor() {
  let taille = 0, nuageImg = null, temps = 0;
  const nuages = [];
  for (let i = 0; i < N_NUAGES; i++) {
    nuages.push({
      xf: (i / N_NUAGES + (i % 2) * 0.09) % 1,
      yf: 0.06 + ((i * 0.61) % 1) * 0.3,
      echelle: 0.55 + ((i * 0.37) % 1) * 0.55,
      vitesse: 0.006 + ((i * 0.19) % 1) * 0.01,
    });
  }
  // scintilles : tableaux typés fixes, aucune allocation en boucle (§5)
  const scinX = new Float32Array(N_SCINTILLES), scinY = new Float32Array(N_SCINTILLES);
  const scinV = new Float32Array(N_SCINTILLES), scinPh = new Float32Array(N_SCINTILLES);
  for (let i = 0; i < N_SCINTILLES; i++) {
    scinX[i] = (i * 0.171) % 1; scinY[i] = (i * 0.293) % 1;
    scinV[i] = 0.01 + ((i * 0.07) % 1) * 0.015; scinPh[i] = i * 1.7;
  }

  function regenerer(cellPix) {
    const t = Math.max(8, Math.round(cellPix * 1.4));
    if (t === taille) return;
    taille = t; nuageImg = batirNuage(taille);
  }

  function maj(dt) {
    temps += dt;
    for (const nu of nuages) { nu.xf += nu.vitesse * dt; if (nu.xf > 1.2) nu.xf -= 1.4; }
    for (let i = 0; i < N_SCINTILLES; i++) { scinY[i] -= scinV[i] * dt * 0.6; if (scinY[i] < -0.05) scinY[i] = 1.05; }
  }

  function dessiner(ctx, cw, ch) {
    // ciel bleu vif en dégradé, sur tout le canvas
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, CIEL_HAUT); g.addColorStop(1, CIEL_BAS);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);

    // éventail de rayons blancs à 8 %, rotation très lente, derrière le plateau
    ctx.save();
    ctx.translate(cw / 2, ch / 2); ctx.rotate(temps * 0.015);
    ctx.globalAlpha = 0.08; ctx.fillStyle = '#ffffff';
    const rayons = 10, rMax = Math.max(cw, ch) * 0.75;
    for (let i = 0; i < rayons; i++) {
      const a0 = (i / rayons) * Math.PI * 2, a1 = a0 + Math.PI / rayons;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rMax, a0, a1); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // scintilles flottantes (étoiles et points), boucle infinie, zéro allocation
    ctx.save();
    for (let i = 0; i < N_SCINTILLES; i++) {
      const px = scinX[i] * cw, py = scinY[i] * ch;
      const alpha = 0.3 + 0.25 * Math.sin(temps * 1.3 + scinPh[i]);
      ctx.globalAlpha = Math.max(0.08, alpha); ctx.fillStyle = '#ffffff';
      if (i % 3 === 0) { cheminEtoile4(ctx, px, py, Math.max(2, taille * 0.09)); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(px, py, Math.max(1, taille * 0.035), 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();

    // nuages cartoon : dérive lente, uniquement des drawImage (coût constant)
    if (nuageImg) {
      ctx.save(); ctx.globalAlpha = 0.95;
      for (const nu of nuages) {
        const dw = nuageImg.width * nu.echelle, dh = nuageImg.height * nu.echelle;
        const px = nu.xf * (cw + dw) - dw * 0.5, py = nu.yf * ch;
        ctx.drawImage(nuageImg, px, py, dw, dh);
      }
      ctx.restore();
    }
  }

  return { regenerer, maj, dessiner };
}
