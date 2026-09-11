// Sprites pré-rendus sur canvas hors écran — style « Cartoon pop » (docs/CONTRATS.md §2).
// Toon Blast pour le dessin : aplats saturés, contours encre épais, reflets nets, jamais de
// dégradé recalculé par frame. Régénérés uniquement quand la taille de case change :
// rendu.js ne fait que des drawImage + transformations sur ces sprites.

import { COULEURS, ENCRE, CADRE, CADRE_CLAIR, CADRE_FONCE, CHAMP_HAUT, CHAMP_BAS } from '../data/couleurs.js';

// --- petits utilitaires couleur -----------------------------------------------------
function hex2rgb(hex) { const n = parseInt(hex.slice(1), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
function rgbaHex(hex, a) { const { r, g, b } = hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; }
function melangeHex(hex1, hex2, t) {
  const a = hex2rgb(hex1), b = hex2rgb(hex2);
  return `rgb(${Math.round(a.r + (b.r - a.r) * t)},${Math.round(a.g + (b.g - a.g) * t)},${Math.round(a.b + (b.b - a.b) * t)})`;
}
const eclaircir = (hex, t) => melangeHex(hex, '#ffffff', t);
const assombrir = (hex, t) => melangeHex(hex, '#000000', t);

function creerCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return { canvas: c, ctx: c.getContext('2d') };
}

// rectangle à coins arrondis (évite de dépendre de ctx.roundRect)
function chemineRectArrondi(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// étoile à n branches (croix, boulons, étincelle) : chemin seul, à remplir/tracer par l'appelant
function cheminEtoile(ctx, cx, cy, r, branches, ratioCreux) {
  ctx.beginPath();
  for (let i = 0; i < branches; i++) {
    const a = (i / branches) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    const aMid = a + Math.PI / branches;
    ctx.lineTo(cx + Math.cos(aMid) * r * ratioCreux, cy + Math.sin(aMid) * r * ratioCreux);
  }
  ctx.closePath();
}

// --- bille « gomme brillante » : aplat saturé, contour encre épais, reflet allongé --------
function dessinerBille(ctx, cx, cy, cellPix, hex, contour) {
  const r = cellPix * 0.44; // 88 % de la case
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx + r * 0.16, cy + r * 0.3, r * 0.82, r * 0.36, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8,4,26,0.32)'; ctx.filter = 'blur(2px)'; ctx.fill(); ctx.filter = 'none';
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.05);
  g.addColorStop(0, eclaircir(hex, 0.24)); g.addColorStop(0.55, hex); g.addColorStop(1, assombrir(hex, 0.18));
  ctx.fillStyle = g; ctx.fill();
  const gi = ctx.createRadialGradient(cx + r * 0.32, cy + r * 0.38, r * 0.15, cx + r * 0.1, cy + r * 0.1, r * 1.1);
  gi.addColorStop(0, 'rgba(0,0,0,0.3)'); gi.addColorStop(0.55, 'rgba(0,0,0,0)');
  ctx.fillStyle = gi; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = Math.max(1.5, cellPix * 0.06); ctx.strokeStyle = contour || assombrir(hex, 0.5); ctx.stroke(); // contour ≈ 6 % de la case
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx - r * 0.36, cy - r * 0.4, r * 0.34, r * 0.18, -0.55, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx - r * 0.02, cy - r * 0.04, r * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  ctx.restore();
}

// --- module principal -----------------------------------------------------------------
export function creerSprites() {
  let cellPix = 0;
  const billes = new Map(), ballons = new Map();
  let bombe = null, mecheOffset = { ox: 0, oy: 0 };
  let flecheLigne = null, etoileCroix = null, sucette = null;
  let pierre = null, bulleOverlay = null, fusee = null;
  let plateauCanvas = null, plateauInfo = null;

  function batirBille(hex, contour) {
    const { canvas, ctx } = creerCanvas(cellPix, cellPix);
    dessinerBille(ctx, cellPix / 2, cellPix / 2, cellPix, hex, contour);
    return canvas;
  }

  function batirBallon(hex, contour) {
    const { canvas, ctx } = creerCanvas(cellPix, cellPix);
    const cx = cellPix / 2, cy = cellPix * 0.42, rv = cellPix * 0.44 * 1.14, rh = cellPix * 0.44 * 0.92;
    ctx.save();
    ctx.strokeStyle = ENCRE; ctx.lineWidth = Math.max(1, cellPix * 0.025);
    ctx.beginPath(); ctx.moveTo(cx, cy + rv); ctx.quadraticCurveTo(cx + cellPix * 0.07, cellPix * 0.82, cx, cellPix * 0.97); ctx.stroke();
    ctx.restore();
    // corps ovale : même traitement que la bille, étiré verticalement (nœud+ficelle par-dessus)
    ctx.save(); ctx.translate(cx, cy); ctx.scale(0.92, 1.14); dessinerBille(ctx, 0, 0, cellPix, hex, contour); ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(cx - rh * 0.18, cy + rv * 0.96); ctx.lineTo(cx + rh * 0.18, cy + rv * 0.96); ctx.lineTo(cx, cy + rv * 1.14); ctx.closePath();
    ctx.fillStyle = assombrir(hex, 0.15); ctx.fill();
    ctx.lineWidth = Math.max(1, cellPix * 0.02); ctx.strokeStyle = contour || ENCRE; ctx.stroke();
    ctx.restore();
    return canvas;
  }

  function batirBombe() {
    const { canvas, ctx } = creerCanvas(cellPix, cellPix);
    const cx = cellPix / 2, cy = cellPix / 2, r = cellPix * 0.4;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx + r * 0.16, cy + r * 0.32, r * 0.82, r * 0.36, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,4,26,0.32)'; ctx.filter = 'blur(2px)'; ctx.fill(); ctx.filter = 'none';
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.08, cx, cy, r * 1.05);
    g.addColorStop(0, '#3d3a4a'); g.addColorStop(0.55, '#17141f'); g.addColorStop(1, '#050408');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1.5, cellPix * 0.06); ctx.strokeStyle = ENCRE; ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx - r * 0.34, cy - r * 0.38, r * 0.3, r * 0.16, -0.55, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
    ctx.restore();
    // mèche qui part du sommet, en courbe
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, r * 0.16); ctx.strokeStyle = '#caa15a';
    ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.92); ctx.quadraticCurveTo(cx + r * 0.5, cy - r * 1.22, cx + r * 0.12, cy - r * 1.5); ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.07); ctx.strokeStyle = ENCRE; ctx.stroke();
    ctx.restore();
    mecheOffset = { ox: r * 0.12, oy: -r * 1.5 }; // relu par rendu.js pour l'étincelle vivante (flicker par frame)
    ctx.save(); ctx.translate(cx + mecheOffset.ox, cy + mecheOffset.oy);
    cheminEtoile(ctx, 0, 0, r * 0.22, 4, 0.4); ctx.fillStyle = '#ffd23f'; ctx.fill();
    ctx.restore();
    return canvas;
  }

  function batirSucette() {
    // bombe de couleur = sucette arc-en-ciel : spirale conique (repli radial pastel sinon)
    const { canvas, ctx } = creerCanvas(cellPix, cellPix);
    const cx = cellPix / 2, cy = cellPix / 2, r = cellPix * 0.44;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx + r * 0.16, cy + r * 0.3, r * 0.82, r * 0.36, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,4,26,0.32)'; ctx.filter = 'blur(2px)'; ctx.fill(); ctx.filter = 'none';
    ctx.restore();
    const conique = ctx.createConicGradient ? ctx.createConicGradient(0, cx, cy) : null;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (conique) {
      const teintes = COULEURS.map((c) => c.hex);
      teintes.forEach((c, i) => conique.addColorStop(i / teintes.length, c));
      conique.addColorStop(1, teintes[0]);
      ctx.fillStyle = conique;
    } else {
      const gr = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, COULEURS[3].hex); gr.addColorStop(1, COULEURS[0].hex);
      ctx.fillStyle = gr;
    }
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, cellPix * 0.06); ctx.strokeStyle = ENCRE; ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx - r * 0.34, cy - r * 0.38, r * 0.28, r * 0.15, -0.55, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
    ctx.restore();
    return canvas;
  }

  function batirFlecheLigne() {
    // flèche blanche épaisse, canonique pointant « vers le bas » du sprite (contre-rotée à l'usage)
    const { canvas, ctx } = creerCanvas(cellPix, cellPix);
    const cx = cellPix / 2, cy = cellPix / 2, s = cellPix * 0.32;
    ctx.save(); ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, s * 1.1); ctx.lineTo(-s * 0.62, s * 0.15); ctx.lineTo(-s * 0.24, s * 0.15);
    ctx.lineTo(-s * 0.24, -s * 1.05); ctx.lineTo(s * 0.24, -s * 1.05); ctx.lineTo(s * 0.24, s * 0.15);
    ctx.lineTo(s * 0.62, s * 0.15); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = Math.max(1.5, cellPix * 0.045); ctx.strokeStyle = ENCRE; ctx.stroke();
    ctx.restore();
    return canvas;
  }

  function batirEtoileCroix() {
    const { canvas, ctx } = creerCanvas(cellPix, cellPix);
    const cx = cellPix / 2, cy = cellPix / 2, r = cellPix * 0.34;
    ctx.save();
    cheminEtoile(ctx, cx, cy, r, 4, 0.42);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = Math.max(1.5, cellPix * 0.045); ctx.strokeStyle = ENCRE; ctx.stroke();
    ctx.restore();
    return canvas;
  }

  function batirPierre() {
    // rocher cartoon gris-bleu, facetté — polygone déterministe (stable entre régénérations)
    const { canvas, ctx } = creerCanvas(cellPix, cellPix);
    const cx = cellPix / 2, cy = cellPix / 2, r = cellPix * 0.42;
    const jitter = [1, 0.84, 0.96, 0.78, 1, 0.86, 0.9, 0.8];
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx + r * 0.18, cy + r * 0.28, r * 0.8, r * 0.36, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,4,26,0.28)'; ctx.filter = 'blur(1.5px)'; ctx.fill(); ctx.filter = 'none';
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    jitter.forEach((j, i) => {
      const a = (i / jitter.length) * Math.PI * 2 - Math.PI / 2, rr = r * j;
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, '#a7b2c6'); g.addColorStop(0.5, '#6c7893'); g.addColorStop(1, '#414a60');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1.5, cellPix * 0.055); ctx.strokeStyle = ENCRE; ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.3, cy - r * 0.5); ctx.lineTo(cx + r * 0.1, cy - r * 0.1);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
    return canvas;
  }

  function batirBulleOverlay() {
    // sphère de verre transparente, contour + reflet ; le contenu miniature est dessiné en
    // dessous par rendu.js avant de composer cette surcouche.
    const { canvas, ctx } = creerCanvas(cellPix, cellPix);
    const cx = cellPix / 2, cy = cellPix / 2, r = cellPix * 0.46;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.75, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0.35)');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1.5, cellPix * 0.05); ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.lineWidth = Math.max(1, cellPix * 0.02); ctx.strokeStyle = ENCRE; ctx.globalAlpha = 0.5; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.22, r * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
    ctx.restore();
    return canvas;
  }

  function batirFusee() {
    // élément fusée dormante : cartoon rouge et blanc, pointe canonique vers le bas (contre-rotée)
    const { canvas, ctx } = creerCanvas(cellPix, cellPix);
    const s = cellPix * 0.4, rouge = COULEURS[0].hex;
    ctx.save(); ctx.translate(cellPix / 2, cellPix / 2);
    ctx.beginPath();
    ctx.moveTo(0, s * 1.05); ctx.lineTo(-s * 0.4, s * 0.15);
    ctx.quadraticCurveTo(-s * 0.4, -s * 0.85, 0, -s * 1.05);
    ctx.quadraticCurveTo(s * 0.4, -s * 0.85, s * 0.4, s * 0.15); ctx.closePath();
    ctx.fillStyle = '#f4f2ee'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -s * 1.05); ctx.quadraticCurveTo(s * 0.4, -s * 0.85, s * 0.4, -s * 0.35);
    ctx.lineTo(-s * 0.4, -s * 0.35); ctx.quadraticCurveTo(-s * 0.4, -s * 0.85, 0, -s * 1.05); ctx.closePath();
    ctx.fillStyle = rouge; ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * 0.06); ctx.strokeStyle = ENCRE;
    ctx.beginPath();
    ctx.moveTo(0, s * 1.05); ctx.lineTo(-s * 0.4, s * 0.15); ctx.quadraticCurveTo(-s * 0.4, -s * 0.85, 0, -s * 1.05);
    ctx.quadraticCurveTo(s * 0.4, -s * 0.85, s * 0.4, s * 0.15); ctx.closePath(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.38, s * 0.1); ctx.lineTo(-s * 0.75, s * 0.55); ctx.lineTo(-s * 0.18, s * 0.3); ctx.closePath();
    ctx.moveTo(s * 0.38, s * 0.1); ctx.lineTo(s * 0.75, s * 0.55); ctx.lineTo(s * 0.18, s * 0.3); ctx.closePath();
    ctx.fillStyle = rouge; ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.05); ctx.strokeStyle = ENCRE; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = '#8fd6ff'; ctx.fill(); ctx.lineWidth = Math.max(1, s * 0.04); ctx.strokeStyle = ENCRE; ctx.stroke();
    ctx.restore();
    return canvas;
  }

  function regenererCases(taille) {
    taille = Math.max(4, Math.round(taille));
    if (taille === cellPix) return;
    cellPix = taille;
    billes.clear(); ballons.clear();
    for (const c of COULEURS) { billes.set(c.id, batirBille(c.hex, c.contour)); ballons.set(c.id, batirBallon(c.hex, c.contour)); }
    bombe = batirBombe();
    flecheLigne = batirFlecheLigne();
    etoileCroix = batirEtoileCroix();
    sucette = batirSucette();
    pierre = batirPierre();
    bulleOverlay = batirBulleOverlay();
    fusee = batirFusee();
  }

  // boulon/étoile peint à chaque coin du cadre
  function dessinerBoulon(ctx, cx, cy, r) {
    ctx.save();
    cheminEtoile(ctx, cx, cy, r, 4, 0.5);
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, CADRE_CLAIR); g.addColorStop(1, CADRE_FONCE);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.18); ctx.strokeStyle = ENCRE; ctx.stroke();
    ctx.restore();
  }

  // cuvette en losange, un ton plus clair que le champ à cet endroit
  function dessinerCuvette(ctx, cx, cy, taille, teinteFond) {
    const s = taille * 0.32, clair = eclaircir(teinteFond, 0.16);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
    ctx.beginPath(); ctx.rect(-s, -s, s * 2, s * 2);
    ctx.fillStyle = rgbaHex(clair, 0.55); ctx.fill();
    ctx.strokeStyle = rgbaHex(assombrir(teinteFond, 0.25), 0.4); ctx.lineWidth = Math.max(1, taille * 0.03); ctx.stroke();
    ctx.restore();
  }

  // (re)construit la texture du plateau : cadre peint épais + champ indigo + cuvettes. Une
  // fois par taille de plateau — jamais recalculé par frame.
  function regenererPlateau(w, h, taille, forme) {
    taille = Math.max(4, Math.round(taille));
    if (plateauInfo && plateauInfo.w === w && plateauInfo.h === h && plateauInfo.cellPix === taille) return;
    plateauInfo = { w, h, cellPix: taille };
    const rim = taille * 0.42, pad = taille * 0.32;
    const largeur = w * taille + rim * 2 + pad * 2, hauteur = h * taille + rim * 2 + pad * 2;
    const { canvas, ctx } = creerCanvas(largeur, hauteur);
    const bx = pad, by = pad, bw = largeur - pad * 2, bh = hauteur - pad * 2, rCoin = rim * 1.4;

    // ombre portée douce sous le plateau
    ctx.save(); ctx.filter = 'blur(6px)';
    chemineRectArrondi(ctx, bx + rim * 0.3, by + rim * 0.5, bw, bh, rCoin);
    ctx.fillStyle = 'rgba(8,4,26,0.3)'; ctx.fill(); ctx.filter = 'none'; ctx.restore();

    // cadre peint épais : bord clair en haut, foncé en bas, contour encre
    chemineRectArrondi(ctx, bx, by, bw, bh, rCoin);
    const gc = ctx.createLinearGradient(bx, by, bx, by + bh);
    gc.addColorStop(0, CADRE_CLAIR); gc.addColorStop(0.5, CADRE); gc.addColorStop(1, CADRE_FONCE);
    ctx.fillStyle = gc; ctx.fill();
    ctx.lineWidth = Math.max(3, taille * 0.05); ctx.strokeStyle = ENCRE; ctx.stroke();

    // champ intérieur indigo
    const ix = bx + rim, iy = by + rim, iw = bw - rim * 2, ih = bh - rim * 2;
    chemineRectArrondi(ctx, ix, iy, iw, ih, rCoin * 0.55);
    const gf = ctx.createLinearGradient(ix, iy, ix, iy + ih);
    gf.addColorStop(0, CHAMP_HAUT); gf.addColorStop(1, CHAMP_BAS);
    ctx.fillStyle = gf; ctx.fill();
    ctx.lineWidth = Math.max(2, taille * 0.03); ctx.strokeStyle = ENCRE; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1;

    // cuvettes en losange, à l'intérieur du champ (clip)
    ctx.save();
    chemineRectArrondi(ctx, ix, iy, iw, ih, rCoin * 0.55); ctx.clip();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (forme && forme[y * w + x] === 0) continue;
      const cx = ix + (x + 0.5) * taille, cy = iy + (y + 0.5) * taille;
      const t = ih > 0 ? (cy - iy) / ih : 0;
      dessinerCuvette(ctx, cx, cy, taille, melangeHex(CHAMP_HAUT, CHAMP_BAS, t));
    }
    ctx.restore();

    // boulons/étoiles aux quatre coins
    const rb = rim * 0.42;
    dessinerBoulon(ctx, bx + rim * 0.7, by + rim * 0.7, rb);
    dessinerBoulon(ctx, bx + bw - rim * 0.7, by + rim * 0.7, rb);
    dessinerBoulon(ctx, bx + rim * 0.7, by + bh - rim * 0.7, rb);
    dessinerBoulon(ctx, bx + bw - rim * 0.7, by + bh - rim * 0.7, rb);

    plateauCanvas = canvas;
  }

  return {
    regenererCases, regenererPlateau,
    bille: (couleur) => billes.get(couleur) || null,
    ballon: (couleur) => ballons.get(couleur) || null,
    bombe: () => bombe,
    bombeMecheOffset: () => mecheOffset,
    overlayLigne: () => flecheLigne,
    overlayCroix: () => etoileCroix,
    couleurSpeciale: () => sucette,
    pierre: () => pierre,
    bulleOverlay: () => bulleOverlay,
    fusee: () => fusee,
    plateau: () => plateauCanvas,
    plateauInfo: () => plateauInfo,
    get cellPix() { return cellPix; },
  };
}
