// Effets de niveau en salle (§6.1), paliers 1 et 2. Tous passent par le bus (docs/CONTRATS.md §8).
import { coord, voisins } from '../moteur/grille.js';
import { colonnes } from '../moteur/gravite.js';
import { avancerElements } from '../moteur/speciales.js';

const src = (id) => ({ source: 'effet:' + id });

/** Indices des billes ordinaires (sans spéciale) vérifiant pred. */
function billes(ctx, pred = () => true) {
  const r = [];
  ctx.grille.cellules.forEach((c, i) => { if (c && c.type === 'bille' && !c.speciale && pred(c, i)) r.push(i); });
  return r;
}

function couleurDominante(ctx) {
  const n = new Array(6).fill(0);
  for (const c of ctx.grille.cellules) if (c && c.type === 'bille') n[c.couleur]++;
  return n.indexOf(Math.max(...n));
}

export function convertir(ctx, indices, couleur) {
  const cellules = [];
  for (const i of indices) {
    const c = ctx.grille.cellules[i];
    if (!c || c.type !== 'bille' || c.couleur === couleur) continue;
    c.couleur = couleur;
    const [x, y] = coord(ctx.grille, i);
    cellules.push({ x, y, id: c.id, couleur });
  }
  if (cellules.length) ctx.emettre({ t: 'conversion', cellules });
  return cellules.length;
}

function colonneLaPlusUnie(ctx) {
  let meilleure = null, score = -1, couleur = 0;
  for (const col of colonnes(ctx.grille.w, ctx.grille.h, ctx.etat.gravite)) {
    const n = new Array(6).fill(0);
    for (const i of col) { const c = ctx.grille.cellules[i]; if (c && c.type === 'bille') n[c.couleur]++; }
    const m = Math.max(...n);
    if (m > score) { score = m; meilleure = col; couleur = n.indexOf(m); }
  }
  return { col: meilleure, couleur };
}

export const EFFETS = [
  // ---- Palier 1 (niveaux 2-3) ----
  { id: 'coups_2', palier: 1, nom: 'Second souffle', desc: '+2 coups.', duree: null,
    appliquer(ctx) { ctx.etat.coups += 2; ctx.emettre({ t: 'coups', coups: ctx.etat.coups, jauge: ctx.etat.jauge }); } },
  { id: 'prochaine_bombe', palier: 1, nom: 'Amorce', desc: 'Le prochain groupe de 3 ou plus crée une bombe.', duree: 'salle',
    appliquer(ctx) {
      ctx.bus.on('seuils', (v) => ({ ...v, bombe: Math.min(v.bombe, 3) }), src('prochaine_bombe'));
      ctx.bus.on('specialeCreee', (c) => c.retirerEffet('prochaine_bombe'), src('prochaine_bombe'));
    } },
  { id: 'dominante_3', palier: 1, nom: 'Teinture rapide', desc: '3 billes prennent la couleur dominante.', duree: null,
    appliquer(ctx) { const d = couleurDominante(ctx); convertir(ctx, ctx.rng.melanger(billes(ctx, (c) => c.couleur !== d)).slice(0, 3), d); } },
  { id: 'rotation_gratuite', palier: 1, nom: 'Pivot libre', desc: 'La prochaine rotation est gratuite.', duree: 'salle',
    appliquer(ctx) {
      ctx.bus.on('coutRotation', () => 0, src('rotation_gratuite'));
      ctx.bus.on('apresRotation', (c, e) => { if (!e.auto) c.retirerEffet('rotation_gratuite'); }, src('rotation_gratuite'));
    } },
  { id: 'nettoyage_bas', palier: 1, nom: 'Coup de balai', desc: 'La ligne du bas est nettoyée.', duree: null,
    appliquer(ctx) {
      const bas = colonnes(ctx.grille.w, ctx.grille.h, ctx.etat.gravite).map((col) => col[col.length - 1]);
      ctx.detruire(bas, 'effet'); ctx.retomber();
    } },
  { id: 'elements_avances', palier: 1, nom: 'Coup de pouce', desc: '+1 activation sur tous les éléments présents.', duree: null,
    appliquer(ctx) { avancerElements(ctx); ctx.retomber(); } },

  // ---- Palier 2 (niveaux 4-7) ----
  { id: 'trois_vaut_quatre', palier: 2, nom: 'Petits groupes', desc: 'Les groupes de 3 comptent comme 4 pendant 3 tours.', duree: 3,
    appliquer(ctx) { ctx.bus.on('tailleGroupe', (v) => (v === 3 ? 4 : v), src('trois_vaut_quatre')); } },
  { id: 'chaines_double', palier: 2, nom: 'Résonance', desc: 'Les chaînes de spéciales valent double XP jusqu’à la fin de la salle.', duree: 'salle',
    appliquer(ctx) { ctx.bus.on('xpGain', (v, c, s) => (s.profondeur > 0 ? v * 2 : v), src('chaines_double')); } },
  { id: 'colonne_monochrome', palier: 2, nom: 'Coulée', desc: 'La colonne la plus unie devient entièrement de sa couleur.', duree: null,
    appliquer(ctx) { const { col, couleur } = colonneLaPlusUnie(ctx); if (col) convertir(ctx, col, couleur); } },
  { id: 'rayon_plus', palier: 2, nom: 'Surcharge', desc: 'Les spéciales présentes gagnent +1 de rayon.', duree: null,
    appliquer(ctx) {
      ctx.grille.cellules.forEach((c, i) => {
        if (!c || !c.speciale) return;
        c.rayon = (c.rayon ?? 1) + 1;
        const [x, y] = coord(ctx.grille, i);
        ctx.emettre({ t: 'speciale', x, y, id: c.id, type: c.speciale });
      });
    } },
  { id: 'pierres_fondent', palier: 2, nom: 'Dégel', desc: 'La pierre la plus basse de chaque colonne fond.', duree: null,
    appliquer(ctx) {
      const cibles = [];
      for (const col of colonnes(ctx.grille.w, ctx.grille.h, ctx.etat.gravite)) {
        for (let i = col.length - 1; i >= 0; i--) { const c = ctx.grille.cellules[col[i]]; if (c && c.type === 'pierre') { cibles.push(col[i]); break; } }
      }
      if (cibles.length) { ctx.detruire(cibles, 'effet'); ctx.retomber(); }
      else ctx.emettre({ t: 'message', texte: 'Aucune pierre à faire fondre' });
    } },
  { id: 'demi_tour', palier: 2, nom: 'Volte-face', desc: 'Rotation 180° gratuite immédiate.', duree: null,
    appliquer(ctx) { ctx.tourner(2, { gratuit: true }); ctx.retomber(); } },
  { id: 'teinte_prochaine', palier: 2, nom: 'Pinceau', desc: 'Le prochain tap teinte ses voisines de sa couleur avant d’exploser.', duree: 'salle',
    appliquer(ctx) {
      ctx.bus.on('avantTap', (c, e) => {
        convertir(c, voisins(c.grille, e.i).filter((v) => { const cv = c.grille.cellules[v]; return cv && cv.type === 'bille' && !cv.speciale; }), e.couleur);
        c.retirerEffet('teinte_prochaine');
      }, src('teinte_prochaine'));
    } },
];
