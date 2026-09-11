// Compétences de run (§6.2), phase 1 : 10 compétences, toutes par hooks.
import { voisins } from '../moteur/grille.js';
import { zoneSpeciale } from '../moteur/speciales.js';
import { convertir } from './effets.js';

const src = (id) => ({ source: 'comp:' + id });

/** Voisines ordinaires (billes sans spéciale) des cases détruites d'un événement. */
function voisinesOrdinaires(ctx, evt, pred = () => true) {
  const g = ctx.grille, r = new Set();
  for (const { x, y } of evt.cellules) for (const v of voisins(g, y * g.w + x)) {
    const c = g.cellules[v];
    if (c && c.type === 'bille' && !c.speciale && pred(c)) r.add(v);
  }
  return [...r];
}

export const COMPETENCES = [
  { id: 'propagation_vert', nom: 'Propagation verte', rarete: 'rare', stackable: false,
    desc: 'Taper un groupe vert teinte ses voisines en vert.',
    installer(ctx) {
      const fn = (c, evt) => {
        const vertes = evt.cellules.filter((k) => k.couleur === 1);
        if (!vertes.length) return;
        convertir(c, voisinesOrdinaires(c, { cellules: vertes }, (cv) => cv.couleur !== 1), 1);
      };
      // Groupes tapés seulement : avec les explosions, une bombe de couleur verte relançait la propagation à l'infini.
      ctx.bus.on('groupeDetruit', fn, src('propagation_vert'));
    } },
  { id: 'seuil_abaisse', nom: 'Seuil abaissé', rarete: 'rare', stackable: 2,
    desc: 'Tous les seuils de spéciales −1 (bombe dès 3).',
    installer(ctx) {
      ctx.bus.on('seuils', (v, c) => { const n = c.nb('seuil_abaisse'); return { bombe: v.bombe - n, ligne: v.ligne - n, croix: v.croix - n, couleur: v.couleur - n }; }, src('seuil_abaisse'));
    } },
  { id: 'vertige', nom: 'Vertige', rarete: 'commun', stackable: true,
    desc: '+1 rotation par salle.',
    installer(ctx) { ctx.bus.on('jaugeInitiale', (v, c) => v + c.nb('vertige'), src('vertige')); } },
  { id: 'domino', nom: 'Domino', rarete: 'commun', stackable: false,
    desc: 'Détruire 4 billes ou plus teinte une voisine de la zone vidée à leur couleur.',
    installer(ctx) {
      ctx.bus.on('groupeDetruit', (c, evt) => {
        if (evt.taille < 4) return;
        const cand = voisinesOrdinaires(c, evt, (cv) => cv.couleur !== evt.couleur);
        if (cand.length) convertir(c, [c.rng.choix(cand)], evt.couleur);
      }, src('domino'));
    } },
  { id: 'avidite', nom: 'Avidité', rarete: 'commun', stackable: false,
    desc: '+1 coup par groupe de 7 ou plus (3 fois par salle au plus).',
    installer(ctx) {
      ctx.bus.on('groupeDetruit', (c, evt) => {
        if (evt.taille + 1 < 7) return; // +1 : la bille tapée devenue spéciale
        // Plafond par salle : avec Propagation verte, les coups devenaient infinis (audit gameplay 2026-09-11).
        const cle = 'avidite:' + c.etat.salleIndex;
        if ((c.memo[cle] ?? 0) >= 3) return;
        c.memo[cle] = (c.memo[cle] ?? 0) + 1;
        c.etat.coups++; c.emettre({ t: 'coups', coups: c.etat.coups, jauge: c.etat.jauge }); c.emettre({ t: 'message', texte: 'Avidité : +1 coup' });
      }, src('avidite'));
    } },
  { id: 'cascade', nom: 'Cascade', rarete: 'commun', stackable: false,
    desc: 'Chaque maillon d’une chaîne de spéciales vaut ×1,5 XP cumulatif.',
    installer(ctx) { ctx.bus.on('xpGain', (v, c, s) => (s.profondeur > 0 ? v * Math.pow(1.5, Math.min(6, s.profondeur)) : v), src('cascade')); } },
  { id: 'coup_de_trop', nom: 'Coup de trop', rarete: 'commun', stackable: false,
    desc: 'Quand les coups tombent à 0, un dernier tap gratuit (une fois par salle).',
    installer(ctx) {
      ctx.bus.on('coupsEpuises', (c) => {
        if (c.memo.coupDeTrop === c.etat.salleIndex) return;
        c.memo.coupDeTrop = c.etat.salleIndex;
        c.etat.coups = 1; c.emettre({ t: 'coups', coups: 1, jauge: c.etat.jauge }); c.emettre({ t: 'message', texte: 'Coup de trop : un dernier tap' });
      }, src('coup_de_trop'));
    } },
  { id: 'fossoyeur', nom: 'Fossoyeur', rarete: 'commun', stackable: false,
    desc: 'Les pierres touchées deviennent des billes au lieu de disparaître.',
    installer(ctx) { ctx.bus.on('sortPierre', () => 'bille', src('fossoyeur')); } },
  { id: 'prevoyance', nom: 'Prévoyance', rarete: 'commun', stackable: false,
    desc: 'Tu vois les prochaines billes qui entreront.',
    installer() {} },
  { id: 'double_amorce', nom: 'Double amorce', rarete: 'commun', stackable: false,
    desc: 'Une bombe qui explose à côté d’une autre bombe forme une croix épaisse.',
    installer(ctx) {
      ctx.bus.on('zoneExplosion', (zone, c, evt) => {
        if (evt.type !== 'bombe') return;
        const g = c.grille;
        const adj = voisins(g, evt.i).some((v) => { const cv = g.cellules[v]; return cv && cv.speciale === 'bombe'; });
        if (!adj) return;
        return zoneSpeciale(c, evt.i, { speciale: 'croix', rayon: 2, couleur: evt.cellule.couleur });
      }, src('double_amorce'));
    } },
];

export const POIDS_RARETE = { commun: 60, rare: 30, epique: 10 };
