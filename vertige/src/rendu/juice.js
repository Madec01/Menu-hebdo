// Juice « Cartoon pop » (docs/CONTRATS.md §2) : textes flottants (+XP, mots de combo),
// anneaux d'onde de choc sur les explosions, et un squash élastique réutilisable (plateau
// ou bille). Pools fixes, zéro allocation par frame — seul un déclenchement (événement de
// jeu) occupe un emplacement déjà réservé.

import { ENCRE } from '../data/couleurs.js';

const MAX_TEXTES = 16;
const MAX_ONDES = 12;

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
// rebond élastique avec dépassement (overshoot), classique « back out »
const easeBackOut = (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

const MOTS_COMBO = [[10, 'VERTIGE !'], [8, 'Énorme !'], [6, 'Super !'], [4, 'Joli !']];
function motCombo(taille) {
  for (const [seuil, mot] of MOTS_COMBO) if (taille >= seuil) return mot;
  return null;
}
const POLICE = '"Arial Rounded MT Bold", "Trebuchet MS", "Nunito", "Segoe UI", sans-serif';

export function creerJuice() {
  // --- textes flottants : type 0 = +XP (monte 1 case, 700 ms), type 1 = combo (rebond, 900 ms)
  const tx = new Float32Array(MAX_TEXTES), ty = new Float32Array(MAX_TEXTES);
  const tt = new Float32Array(MAX_TEXTES), td = new Float32Array(MAX_TEXTES);
  const ttype = new Uint8Array(MAX_TEXTES);
  const tmot = new Array(MAX_TEXTES).fill('');
  let nTextes = 0;

  function occuper(i, x, y, type, mot, duree) { tx[i] = x; ty[i] = y; tt[i] = 0; td[i] = duree; ttype[i] = type; tmot[i] = mot; }
  // à saturation (≥16 flottants à l'écran) on recycle le plus ancien plutôt que d'en perdre un neuf
  function emettreXP(x, y, gain) { occuper(nTextes < MAX_TEXTES ? nTextes++ : 0, x, y, 0, '+' + (gain ?? ''), 0.7); }
  function emettreCombo(x, y, taille) {
    const mot = motCombo(taille); if (!mot) return;
    occuper(nTextes < MAX_TEXTES ? nTextes++ : 0, x, y, 1, mot, 0.9);
  }
  function majTextes(dt) {
    for (let i = 0; i < nTextes; i++) {
      tt[i] += dt;
      if (tt[i] >= td[i]) {
        const last = nTextes - 1;
        tx[i] = tx[last]; ty[i] = ty[last]; tt[i] = tt[last]; td[i] = td[last]; ttype[i] = ttype[last]; tmot[i] = tmot[last];
        nTextes--; i--;
      }
    }
  }
  function dessinerTextes(ctx, cellPix) {
    for (let i = 0; i < nTextes; i++) {
      const p = clamp01(tt[i] / td[i]);
      ctx.save();
      if (ttype[i] === 0) {
        // +XP : monte d'une case le long de l'écran, s'efface en fin de course
        ctx.translate(tx[i], ty[i] - easeOutCubic(p) * cellPix);
        ctx.globalAlpha = 1 - clamp01((p - 0.55) / 0.45);
        ctx.font = `900 ${Math.round(cellPix * 0.45)}px ${POLICE}`;
      } else {
        // mot de combo : rebond élastique (overshoot) + légère rotation, sur la case tapée
        const echelle = p < 0.45 ? Math.max(0, easeBackOut(p / 0.45)) : 1 + Math.sin((p - 0.45) * Math.PI) * 0.03;
        ctx.translate(tx[i], ty[i]);
        ctx.rotate(Math.sin(p * Math.PI * 2.4) * (1 - p) * (6 * Math.PI / 180));
        ctx.scale(echelle, echelle);
        ctx.globalAlpha = 1 - clamp01((p - 0.72) / 0.28);
        ctx.font = `900 ${Math.round(cellPix * 1.2)}px ${POLICE}`;
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, cellPix * 0.08);
      ctx.strokeStyle = ENCRE; ctx.strokeText(tmot[i], 0, 0);
      ctx.fillStyle = '#ffffff'; ctx.fillText(tmot[i], 0, 0);
      ctx.restore();
    }
  }

  // --- anneaux d'onde de choc : trait épais qui s'élargit et s'efface (explosions uniquement)
  const ox = new Float32Array(MAX_ONDES), oy = new Float32Array(MAX_ONDES);
  const ot = new Float32Array(MAX_ONDES), od = new Float32Array(MAX_ONDES), orayon = new Float32Array(MAX_ONDES);
  let nOndes = 0;
  function emettreOnde(x, y, rayonMax) {
    if (nOndes >= MAX_ONDES) return;
    const i = nOndes++; ox[i] = x; oy[i] = y; ot[i] = 0; od[i] = 0.42; orayon[i] = rayonMax;
  }
  function majOndes(dt) {
    for (let i = 0; i < nOndes; i++) {
      ot[i] += dt;
      if (ot[i] >= od[i]) {
        const last = nOndes - 1;
        ox[i] = ox[last]; oy[i] = oy[last]; ot[i] = ot[last]; od[i] = od[last]; orayon[i] = orayon[last];
        nOndes--; i--;
      }
    }
  }
  function dessinerOndes(ctx, cellPix) {
    for (let i = 0; i < nOndes; i++) {
      const p = ot[i] / od[i], r = cellPix * 0.3 + orayon[i] * easeOutCubic(p);
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.9;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, cellPix * 0.16 * (1 - p * 0.5));
      ctx.beginPath(); ctx.arc(ox[i], oy[i], r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  // --- squash élastique générique : échelle x↑ / y↓ puis retour (plateau entier, ou une bille)
  function creerSquash(duree = 0.25, ampli = 0.04) {
    let t = duree; // t >= duree => inactif, échelle neutre
    return {
      declencher() { t = 0; },
      maj(dt) { if (t < duree) t += dt; },
      get actif() { return t < duree; },
      get sx() { return t < duree ? 1 + ampli * Math.sin(clamp01(t / duree) * Math.PI) : 1; },
      get sy() { return t < duree ? 1 - ampli * Math.sin(clamp01(t / duree) * Math.PI) : 1; },
    };
  }

  return {
    emettreXP, emettreCombo, majTextes, dessinerTextes,
    emettreOnde, majOndes, dessinerOndes,
    creerSquash,
    get enCours() { return nTextes > 0 || nOndes > 0; },
    vider() { nTextes = 0; nOndes = 0; },
  };
}
