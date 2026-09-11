// Rendu Canvas 2D — style « Cartoon pop » (Toon Blast pour le dessin, Candy Crush pour le juice — §2).
// Ne connaît rien au moteur : ne lit que `etat` (§3) et les événements du journal (§4).
import { creerSprites } from './sprites.js';
import { creerParticules } from './particules.js';
import { creerDecor } from './decor.js';
import { creerJuice } from './juice.js';
import { COULEURS, ENCRE } from '../data/couleurs.js';
const HEX = COULEURS.map((c) => c.hex);
const couleurHex = (i) => HEX[i] ?? '#8a857b';
const DUREE_ROTATION = 0.38;   // s — §5
const DUREE_CHUTE = 0.35;      // s — §5, chute complète
const GRAVITE_CASES = 78;      // accélération de l'intégrateur de chute, en cases/s²
const RESTITUTION = 0.25;      // rebond à l'arrivée
const SHAKE_MAX = 10;          // px, plafonné
const MARGE = 0.94;            // 6 % de marge autour du plateau
const CAUSES_EXPLOSION = new Set(['bombe', 'ligne', 'croix', 'couleur', 'fusee']); // anneau d'onde de choc (§2)
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const attend = (ms) => new Promise((res) => setTimeout(res, ms)); // gravité en coordonnées plateau, table fixe (§1)
const TABLE_G = [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }];
const vecteurG = (g) => TABLE_G[((g % 4) + 4) % 4];
export function creerRendu(canvas, { onTap, onSurvol } = {}) {
  const ctx = canvas.getContext('2d');
  const sprites = creerSprites();
  const particules = creerParticules();
  const decor = creerDecor();
  const juice = creerJuice();
  const squashPlateau = juice.creerSquash(0.25, 0.04); // échelle x 1,04 / y 0,96, 250 ms (§2)
  // --- état de la grille / plateau, et de la transform écran (centre+secousse, rotation, échelle)
  let w = 8, h = 10, forme = null, graviteCourante = 0, etatCourant = null;
  const billes = new Map(); // id -> billeVis
  let cellPixBase = 40, fitNormalPx = 40, fitSwapPx = 40;
  let angleActuel = 0, echelleActuelle = 1;
  let angleTween = null; // {angleDebut,angleFin,echelleDebut,echelleFin,t,duree}
  let shakeMag = 0, shakeX = 0, shakeY = 0;
  let previewSens = null; // aperçu de rotation : no-op accepté proprement (cf §5)
  let tempsTotal = 0;     // accumulateur pour les micro-animations vivantes (sucette, étincelle)
  let dernierDetruit = null; // position écran de la dernière salve `detruit` (pour le +XP qui suit, §2)
  const surligneesSet = new Set();
  let courantAudio = null;
  let rafId = null, dernierT = null;
  // fabrique un sprite visuel de bille à partir d'une Cellule (§1)
  function creerBilleVis(cel, x, y) {
    return {
      id: cel.id, type: cel.type, couleur: cel.couleur, speciale: cel.speciale || null,
      element: cel.element ? { type: cel.element.type, activations: cel.element.activations || 0, max: cel.element.max || 1, contenu: cel.element.contenu || null } : null,
      x, y, echelle: 1, alpha: 1, fondu: null, pulse: null, pop: null, chute: null, glisse: null,
      squash: null, squashX: 1, squashY: 1,
    };
  }
  // --- transform : case plateau <-> pixel écran (fonctions miroir l'une de l'autre) --------
  function localVersEcran(cx, cy) {
    const lx = (cx - w / 2 + 0.5) * cellPixBase * echelleActuelle, ly = (cy - h / 2 + 0.5) * cellPixBase * echelleActuelle;
    const ca = Math.cos(angleActuel), sa = Math.sin(angleActuel);
    return { x: canvas.width / 2 + shakeX + lx * ca - ly * sa, y: canvas.height / 2 + shakeY + lx * sa + ly * ca };
  }
  function ecranVersCase(px, py) {
    const dx = px - (canvas.width / 2 + shakeX), dy = py - (canvas.height / 2 + shakeY);
    const ca = Math.cos(-angleActuel), sa = Math.sin(-angleActuel);
    const lx = (dx * ca - dy * sa) / echelleActuelle, ly = (dx * sa + dy * ca) / echelleActuelle;
    return { x: lx / cellPixBase + w / 2 - 0.5, y: ly / cellPixBase + h / 2 - 0.5 };
  }
  const calcEchelle = (gravite) => (gravite % 2 === 0 ? fitNormalPx : fitSwapPx) / cellPixBase;
  function recalculerEchelles() {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const cw = Math.max(1, Math.round((canvas.clientWidth || canvas.width || 1) * dpr));
    const ch = Math.max(1, Math.round((canvas.clientHeight || canvas.height || 1) * dpr));
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    fitNormalPx = Math.min((cw * MARGE) / w, (ch * MARGE) / h);
    fitSwapPx = Math.min((cw * MARGE) / h, (ch * MARGE) / w);
    cellPixBase = Math.max(8, Math.floor(Math.max(fitNormalPx, fitSwapPx)));
    sprites.regenererCases(cellPixBase); sprites.regenererPlateau(w, h, cellPixBase, forme); decor.regenerer(cellPixBase);
    if (!angleTween) echelleActuelle = calcEchelle(graviteCourante);
  }
  // --- pointeur : tap (souris et tactile) et survol -----------------------------------------
  function pointDepuisEvenement(e) {
    const rect = canvas.getBoundingClientRect();
    const rw = rect.width || canvas.width || 1, rh = rect.height || canvas.height || 1;
    const c = ecranVersCase((e.clientX - rect.left) * (canvas.width / rw), (e.clientY - rect.top) * (canvas.height / rh));
    const rx = Math.round(c.x), ry = Math.round(c.y);
    if (rx < 0 || ry < 0 || rx >= w || ry >= h) return null;
    if (forme && forme[ry * w + rx] === 0) return null;
    return { x: rx, y: ry };
  }
  const surPointerDown = (e) => { const p = pointDepuisEvenement(e); if (p && onTap) onTap(p.x, p.y); };
  const surPointerMove = (e) => { const p = pointDepuisEvenement(e); if (onSurvol) onSurvol(p ? { x: p.x, y: p.y } : null); };
  const surPointerLeave = () => { if (onSurvol) onSurvol(null); };
  canvas.addEventListener('pointerdown', surPointerDown); canvas.addEventListener('pointermove', surPointerMove); canvas.addEventListener('pointerleave', surPointerLeave);
  // --- intégrateurs d'animation par bille -----------------------------------------------------
  function demarrerChute(bv, de, vers, retard = 0) {
    // décompose le déplacement sur l'axe de G (animé) et son perpendiculaire (posé instantanément)
    const axeX = de.y === vers.y && de.x !== vers.x;
    if (axeX) { bv.y = vers.y; bv.x = de.x; } else { bv.x = vers.x; bv.y = de.y; }
    const delta = axeX ? vers.x - de.x : vers.y - de.y;
    const dir = delta === 0 ? 1 : Math.sign(delta);
    bv.chute = { axe: axeX ? 'x' : 'y', origine: axeX ? de.x : de.y, dir, distance: Math.abs(delta), v: 0, pos: 0, t: 0, rebondFait: false, retard };
  }
  function avancerChute(bv, dt) {
    const c = bv.chute; if (!c) return;
    if (c.retard > 0) { c.retard -= dt; if (c.retard > 0) return; dt += c.retard; c.retard = 0; }
    c.v += GRAVITE_CASES * dt; c.pos += c.v * dt; c.t += dt;
    let fini = false;
    if (!c.rebondFait && c.pos >= c.distance) {
      c.pos = c.distance - (c.pos - c.distance) * RESTITUTION;
      c.v = -c.v * RESTITUTION; c.rebondFait = true;
      bv.squash = { t: 0, duree: 0.18 }; // squash vertical à l'atterrissage (§2)
      if (courantAudio) courantAudio.jouer('rebond', { n: 1 });
    } else if (c.rebondFait && c.v <= 0) fini = true;
    if (c.t > 0.6) fini = true;
    if (fini) { c.pos = c.distance; bv.chute = null; }
    const val = c.origine + c.dir * c.pos;
    if (c.axe === 'x') bv.x = val; else bv.y = val;
  }
  function demarrerGlisse(bv, de, vers, duree, retirerApres) {
    bv.x = de.x; bv.y = de.y;
    bv.glisse = { de: { x: de.x, y: de.y }, vers: { x: vers.x, y: vers.y }, t: 0, duree, retirerApres };
  }
  function avancerGlisse(id, bv, dt) {
    const gl = bv.glisse; if (!gl) return;
    gl.t += dt;
    const p = easeInOut(clamp01(gl.t / gl.duree));
    bv.x = lerp(gl.de.x, gl.vers.x, p); bv.y = lerp(gl.de.y, gl.vers.y, p);
    if (gl.t >= gl.duree) { bv.glisse = null; if (gl.retirerApres) billes.delete(id); }
  }
  const declencherShake = (intensite) => { shakeMag = Math.min(SHAKE_MAX, Math.max(shakeMag, SHAKE_MAX * intensite)); };
  function majShake(dt) {
    if (shakeMag > 0.05) { shakeMag *= Math.exp(-dt * 8); shakeX = (Math.random() * 2 - 1) * shakeMag; shakeY = (Math.random() * 2 - 1) * shakeMag; }
    else { shakeMag = 0; shakeX = 0; shakeY = 0; }
  }
  // --- dessin d'une cellule --------------------------------------------------------------------
  const dessinerCentre = (image) => { if (image) ctx.drawImage(image, -image.width / 2, -image.height / 2); };
  function dessinerContenu(c) {
    if (!c) return;
    dessinerCentre(c.type === 'pierre' ? sprites.pierre() : sprites.bille(c.couleur != null ? c.couleur : 0));
  }
  function dessinerBilleCouleur(bv) {
    if (bv.speciale === 'bombe') { // étincelle vivante : flicker par frame, pas de sprite recalculé
      dessinerCentre(sprites.bombe());
      const off = sprites.bombeMecheOffset(), a = 0.55 + 0.45 * Math.sin(tempsTotal * 9 + bv.x * 3 + bv.y * 5);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffe27a';
      ctx.beginPath(); ctx.arc(off.ox, off.oy, cellPixBase * 0.055, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      return;
    }
    if (bv.speciale === 'couleur') { ctx.save(); ctx.rotate(tempsTotal * 0.6); dessinerCentre(sprites.couleurSpeciale()); ctx.restore(); return; } // sucette qui tourne lentement
    if (bv.fondu) {
      const p = easeInOut(clamp01(bv.fondu.t / bv.fondu.duree));
      ctx.save(); ctx.globalAlpha *= 1 - p; dessinerCentre(sprites.bille(bv.fondu.de)); ctx.restore();
      ctx.save(); ctx.globalAlpha *= p; dessinerCentre(sprites.bille(bv.fondu.vers)); ctx.restore();
    } else dessinerCentre(sprites.bille(bv.couleur != null ? bv.couleur : 0));
    if (bv.speciale === 'ligne' || bv.speciale === 'croix') { // contre-rotation : icône alignée sur la gravité écran
      ctx.save(); ctx.rotate(-angleActuel);
      dessinerCentre(bv.speciale === 'ligne' ? sprites.overlayLigne() : sprites.overlayCroix());
      ctx.restore();
    }
  }
  function dessinerElement(bv) {
    const el = bv.element || {};
    if (el.type === 'bulle') { if (el.contenu) { ctx.save(); ctx.scale(0.62, 0.62); dessinerContenu(el.contenu); ctx.restore(); } dessinerCentre(sprites.bulleOverlay()); }
    else if (el.type === 'ballon') dessinerCentre(sprites.ballon(bv.couleur != null ? bv.couleur : 0));
    else if (el.type === 'fusee') { ctx.save(); ctx.rotate(-angleActuel); dessinerCentre(sprites.fusee()); ctx.restore(); }
  }
  function dessinerSurlignage(lx, ly) {
    ctx.save(); ctx.translate(lx, ly);
    ctx.beginPath(); ctx.arc(0, 0, cellPixBase * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
    ctx.lineWidth = Math.max(1, cellPixBase * 0.035); ctx.strokeStyle = ENCRE; ctx.globalAlpha = 0.55; ctx.stroke();
    ctx.restore();
  }
  function dessinerFrame() {
    decor.dessiner(ctx, canvas.width, canvas.height); // ciel + nuages : couvre tout le canvas
    ctx.save();
    ctx.translate(canvas.width / 2 + shakeX, canvas.height / 2 + shakeY);
    ctx.rotate(angleActuel); ctx.scale(echelleActuelle * squashPlateau.sx, echelleActuelle * squashPlateau.sy);
    const plateau = sprites.plateau(); if (plateau) ctx.drawImage(plateau, -plateau.width / 2, -plateau.height / 2);
    for (const [, bv] of billes) {
      const lx = (bv.x - w / 2 + 0.5) * cellPixBase, ly = (bv.y - h / 2 + 0.5) * cellPixBase;
      if (surligneesSet.size && surligneesSet.has(`${Math.round(bv.x)},${Math.round(bv.y)}`)) dessinerSurlignage(lx, ly); // pas de chaîne allouée sans survol
      ctx.save();
      ctx.translate(lx, ly); ctx.globalAlpha = bv.alpha; ctx.scale(bv.echelle * bv.squashX, bv.echelle * bv.squashY);
      if (bv.type === 'pierre') dessinerCentre(sprites.pierre());
      else if (bv.type === 'element') dessinerElement(bv);
      else dessinerBilleCouleur(bv);
      ctx.restore();
    }
    ctx.restore();
    juice.dessinerOndes(ctx, cellPixBase); juice.dessinerTextes(ctx, cellPixBase); particules.dessiner(ctx);
  }
  // Boucle en continu tant que visible (§2, décor), coupée sur document.hidden puis reprise par
  // 'visibilitychange'. `enAnimation` (§5) reflète l'activité de premier plan, pas cette boucle.
  function rienNAnime() {
    if (angleTween || particules.enCours || juice.enCours || squashPlateau.actif || shakeMag > 0.05 || surligneesSet.size > 0) return false;
    for (const [, bv] of billes) if (bv.chute || bv.glisse || bv.pulse || bv.fondu || bv.pop || bv.squash) return false;
    return true;
  }
  function majAnimations(dt) {
    tempsTotal += dt; decor.maj(dt); squashPlateau.maj(dt); juice.majTextes(dt); juice.majOndes(dt);
    if (angleTween) {
      angleTween.t += dt;
      const p = clamp01(angleTween.t / angleTween.duree), e = easeInOut(p);
      angleActuel = lerp(angleTween.angleDebut, angleTween.angleFin, e);
      echelleActuelle = lerp(angleTween.echelleDebut, angleTween.echelleFin, e);
      if (p >= 1) angleTween = null;
    }
    for (const [id, bv] of billes) {
      if (bv.fondu) { bv.fondu.t += dt; if (bv.fondu.t >= bv.fondu.duree) bv.fondu = null; }
      if (bv.pulse) { bv.pulse.t += dt; const p = clamp01(bv.pulse.t / bv.pulse.duree); bv.echelle = 1 + Math.sin(p * Math.PI) * 0.18; if (p >= 1) { bv.pulse = null; bv.echelle = 1; } }
      if (bv.pop) { bv.pop.t += dt; const p = clamp01(bv.pop.t / bv.pop.duree); bv.echelle = easeInOut(p); if (p >= 1) { bv.pop = null; bv.echelle = 1; } }
      if (bv.squash) { bv.squash.t += dt; const p = clamp01(bv.squash.t / bv.squash.duree), s = Math.sin(p * Math.PI); bv.squashX = 1 + 0.1 * s; bv.squashY = 1 - 0.1 * s; if (p >= 1) { bv.squash = null; bv.squashX = 1; bv.squashY = 1; } }
      if (bv.chute) avancerChute(bv, dt);
      if (bv.glisse) avancerGlisse(id, bv, dt);
    }
    majShake(dt); particules.maj(dt);
  }
  function tick(ts) {
    if (dernierT == null) dernierT = ts;
    const dt = Math.min(0.05, (ts - dernierT) / 1000); dernierT = ts;
    majAnimations(dt); dessinerFrame();
    if (typeof document !== 'undefined' && document.hidden) { rafId = null; return; } // repris par 'visibilitychange'
    rafId = requestAnimationFrame(tick);
  }
  let enPause = false; // retour au menu : plus rien à dessiner, on coupe la boucle (audit code 2026-09-11)
  function pause() { enPause = true; if (rafId != null) cancelAnimationFrame(rafId); rafId = null; }
  function reprendre() { enPause = false; demarrerBoucle(); }
  function demarrerBoucle() {
    if (enPause || rafId != null || (typeof document !== 'undefined' && document.hidden)) return;
    dernierT = null; rafId = requestAnimationFrame(tick);
  }
  // --- gestion des événements du journal (§4) : chacun anime puis attend sa propre durée ------
  function surTap(evt) { // mot de combo sur la case tapée, selon tap.taille (§2)
    const ecran = localVersEcran(evt.x, evt.y);
    juice.emettreCombo(ecran.x, ecran.y, evt.taille || 0);
    if (courantAudio) courantAudio.jouer('tap', { taille: evt.taille });
    demarrerBoucle();
  }
  function surXp(evt) { // +gain à la position de la dernière salve `detruit` (§2, xp suit toujours detruit)
    if (dernierDetruit) juice.emettreXP(dernierDetruit.x, dernierDetruit.y, evt.gain);
    demarrerBoucle();
  }
  async function surDetruit(evt) {
    const cellules = evt.cellules || [], taille = cellules.length || 1;
    let sx = 0, sy = 0, n = 0;
    for (const c of cellules) {
      const bv = billes.get(c.id), pos = bv ? { x: bv.x, y: bv.y } : { x: c.x, y: c.y }, ecran = localVersEcran(pos.x, pos.y);
      sx += ecran.x; sy += ecran.y; n++;
      particules.emettreDestruction(ecran.x, ecran.y, couleurHex(c.couleur), Math.min(12, 4 + Math.round(16 / taille)));
      if (bv) billes.delete(c.id);
    }
    if (n > 0) {
      dernierDetruit = { x: sx / n, y: sy / n };
      if (CAUSES_EXPLOSION.has(evt.cause)) juice.emettreOnde(dernierDetruit.x, dernierDetruit.y, cellPixBase * (0.8 + Math.min(1.4, taille * 0.07)));
    }
    declencherShake(Math.min(1, taille / 10));
    if (courantAudio) courantAudio.jouer('detruit', { taille, cause: evt.cause, profondeur: evt.profondeur || 0 });
    demarrerBoucle(); await attend(90);
  }
  async function surSpeciale(evt) {
    const bv = billes.get(evt.id);
    if (bv) { bv.speciale = evt.type; bv.pulse = { t: 0, duree: 0.22 }; }
    if (courantAudio) courantAudio.jouer('speciale', { type: evt.type });
    demarrerBoucle(); await attend(180);
  }
  async function surConversion(evt) {
    for (const c of evt.cellules) {
      const bv = billes.get(c.id); if (!bv) continue;
      if (c.type) bv.type = c.type; // ex : pierre convertie en bille
      bv.fondu = { de: bv.couleur != null ? bv.couleur : c.couleur, vers: c.couleur, t: 0, duree: 0.3 }; bv.couleur = c.couleur;
    }
    demarrerBoucle(); await attend(300);
  }
  async function surElement(evt) {
    const bv = billes.get(evt.id);
    if (bv) {
      bv.element = { type: evt.type, activations: evt.activations, max: evt.max, contenu: bv.element ? bv.element.contenu : null };
      if (evt.action === 'activation' || evt.action === 'libere') bv.pulse = { t: 0, duree: 0.2 };
      else if (evt.action === 'eclate') {
        const ecran = localVersEcran(bv.x, bv.y);
        if (evt.type === 'ballon') particules.emettreConfettis(ecran.x, ecran.y, 18);
        else particules.emettreDestruction(ecran.x, ecran.y, couleurHex(bv.couleur), 14);
        billes.delete(evt.id);
      } else if (evt.action === 'fusee') {
        const G = vecteurG(graviteCourante);
        demarrerGlisse(bv, { x: bv.x, y: bv.y }, { x: bv.x + G.x * (w + h), y: bv.y + G.y * (w + h) }, 0.3, true);
      } else if (evt.action === 'monte') {
        demarrerGlisse(bv, evt.de || { x: bv.x, y: bv.y }, { x: evt.x, y: evt.y }, 0.2, false);
      }
    }
    if (courantAudio) courantAudio.jouer('element', { type: evt.type, action: evt.action });
    demarrerBoucle(); await attend(evt.action === 'monte' ? 200 : evt.action === 'fusee' ? 300 : 150);
  }
  async function surRotation(evt) {
    const avant = graviteCourante;
    graviteCourante = evt.vers != null ? evt.vers : ((avant + evt.sens + 4) % 4);
    const delta = evt.sens === 2 ? Math.PI : evt.sens * (Math.PI / 2);
    angleTween = { angleDebut: angleActuel, angleFin: angleActuel + delta, echelleDebut: calcEchelle(avant), echelleFin: calcEchelle(graviteCourante), t: 0, duree: DUREE_ROTATION };
    if (courantAudio) courantAudio.jouer('rotation', { sens: evt.sens });
    demarrerBoucle(); await attend(DUREE_ROTATION * 1000);
    squashPlateau.declencher(); // squash élastique du plateau en fin de rotation (§2)
  }
  async function surChute(evt) {
    for (const d of evt.deplacements || []) { const bv = billes.get(d.id); if (bv) demarrerChute(bv, d.de, d.vers); }
    demarrerBoucle(); await attend(DUREE_CHUTE * 1000);
    squashPlateau.declencher(); // squash élastique du plateau à l'atterrissage des billes (§2)
  }
  async function surRemplissage(evt) {
    for (const c of evt.cellules || []) {
      const bv = creerBilleVis(c, c.depuis.x, c.depuis.y);
      billes.set(c.id, bv); demarrerChute(bv, c.depuis, { x: c.x, y: c.y });
    }
    demarrerBoucle(); await attend(DUREE_CHUTE * 1000);
    squashPlateau.declencher();
  }
  async function surMaree(evt) {
    const duree = 0.3;
    for (const d of evt.deplacements || []) { const bv = billes.get(d.id); if (bv) demarrerGlisse(bv, { x: bv.x, y: bv.y }, d.vers, duree, false); }
    for (const e of evt.entrees || []) {
      const depuis = e.depuis || { x: e.x, y: e.y }, bv = creerBilleVis(e, depuis.x, depuis.y);
      billes.set(e.id, bv); demarrerGlisse(bv, depuis, { x: e.x, y: e.y }, duree, false);
    }
    for (const s of evt.sorties || []) billes.delete(s.id);
    demarrerBoucle(); await attend(duree * 1000);
  }
  async function surSalle() {
    const G = vecteurG(graviteCourante);
    for (const [, bv] of billes) {
      const cible = { x: bv.x, y: bv.y };
      const depart = { x: cible.x - G.x * 3, y: cible.y - G.y * 3 };
      demarrerChute(bv, depart, cible, (bv.x + bv.y) * 0.015);
    }
    demarrerBoucle(); await attend(450);
  }
  async function surApparition(evt) {
    for (const c of evt.cellules || []) {
      const bv = creerBilleVis(c, c.x, c.y);
      bv.echelle = 0; bv.pop = { t: 0, duree: 0.18 }; billes.set(c.id, bv);
    }
    demarrerBoucle(); await attend(180);
  }
  // --- API publique (§5) -----------------------------------------------------------------------
  function synchroniser(etat) {
    etatCourant = etat;
    w = etat.grille.w; h = etat.grille.h; forme = etat.grille.forme || null; graviteCourante = etat.gravite || 0;
    angleTween = null; particules.vider(); juice.vider(); dernierDetruit = null;
    shakeMag = 0; shakeX = 0; shakeY = 0; surligneesSet.clear(); billes.clear();
    recalculerEchelles();
    angleActuel = graviteCourante * (Math.PI / 2); echelleActuelle = calcEchelle(graviteCourante);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (forme && forme[idx] === 0) continue;
      const cel = etat.grille.cellules[idx];
      if (cel) billes.set(cel.id, creerBilleVis(cel, x, y));
    }
    dessinerFrame();
    demarrerBoucle(); // le décor anime en continu tant que visible (§2)
  }
  async function jouer(evenements, { audio } = {}) {
    courantAudio = audio || null;
    demarrerBoucle();
    for (const evt of evenements || []) {
      switch (evt.t) {
        case 'tap': surTap(evt); break;
        case 'detruit': await surDetruit(evt); break;
        case 'speciale': await surSpeciale(evt); break;
        case 'conversion': await surConversion(evt); break;
        case 'element': await surElement(evt); break;
        case 'rotation': await surRotation(evt); break;
        case 'chute': await surChute(evt); break;
        case 'remplissage': await surRemplissage(evt); break;
        case 'maree': await surMaree(evt); break;
        case 'salle': await surSalle(evt); break;
        case 'apparition': await surApparition(evt); break;
        case 'xp': surXp(evt); break;
        default: break; // événement ignoré par le rendu (UI/audio/moteur uniquement)
      }
    }
  }
  function surligner(cellules) {
    surligneesSet.clear();
    for (const c of cellules || []) surligneesSet.add(`${c.x},${c.y}`);
    demarrerBoucle();
    if (!cellules || cellules.length === 0) dessinerFrame();
  }
  function previsualiserRotation(sens) { previewSens = sens; } // no-op propre : accepté sans effet visuel
  function redimensionner() { if (etatCourant) { recalculerEchelles(); dessinerFrame(); } }
  // La taille CSS du canvas change après mise en page (HUD, couche masquée) : on suit ces changements.
  let observateur = null;
  if (typeof ResizeObserver !== 'undefined') { observateur = new ResizeObserver(() => redimensionner()); observateur.observe(canvas); }
  const surVisibilite = () => { if (typeof document !== 'undefined' && !document.hidden) demarrerBoucle(); }; // décor en continu tant que visible (§2)
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', surVisibilite);
  function detruire() {
    if (observateur) { observateur.disconnect(); observateur = null; }
    if (typeof document !== 'undefined' && document.removeEventListener) document.removeEventListener('visibilitychange', surVisibilite);
    if (rafId != null) cancelAnimationFrame(rafId); rafId = null;
    canvas.removeEventListener('pointerdown', surPointerDown); canvas.removeEventListener('pointermove', surPointerMove); canvas.removeEventListener('pointerleave', surPointerLeave);
    particules.vider(); juice.vider(); billes.clear();
  }
  return {
    synchroniser, jouer, surligner, previsualiserRotation, redimensionner, detruire, pause, reprendre,
    get enAnimation() { return !rienNAnime(); },
  };
}
