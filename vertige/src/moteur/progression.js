// XP et niveau en salle (§6.1). Seuils cumulés : index = niveau − 1.
import { EFFETS } from '../data/effets.js';

export const SEUILS_NIVEAU = [0, 150, 400, 750, 1200, 1750, 2400, 3200, 4100, 5200];
export const NIVEAU_MAX = 7; // paliers 8-10 verrouillés en phase 1

export function palierPour(niveau) { return niveau <= 3 ? 1 : niveau <= 7 ? 2 : 3; }

/** Propose n effets du palier du niveau atteint, jamais déjà proposés ou appliqués dans la salle. */
export function proposerEffets(ctx, niveau) {
  const n = ctx.bus.reduire('propositionsNiveau', 2, ctx, { niveau });
  const palier = palierPour(niveau);
  const vus = new Set(ctx.etat.effetsVus);
  let pool = EFFETS.filter((e) => e.palier === palier && !vus.has(e.id));
  if (pool.length < n) pool = pool.concat(EFFETS.filter((e) => e.palier !== palier && !vus.has(e.id)));
  ctx.rng.melanger(pool);
  return pool.slice(0, n).map((e) => ({ id: e.id, nom: e.nom, desc: e.desc }));
}

/** Applique l'effet choisi ; les effets à durée s'inscrivent dans etat.effetsActifs. */
export function appliquerEffet(ctx, id, options = {}) {
  const e = EFFETS.find((x) => x.id === id);
  if (!e) return false;
  if (!options.reprise) {
    ctx.etat.effetsVus.push(id);
    if (e.duree) ctx.etat.effetsActifs.push({ id, nom: e.nom, restant: e.duree === 'salle' ? null : e.duree });
    ctx.emettre({ t: 'effet', id, nom: e.nom });
  }
  e.appliquer(ctx, options);
  return true;
}

export function retirerEffet(ctx, id) {
  ctx.bus.off('effet:' + id);
  const l = ctx.etat.effetsActifs;
  const k = l.findIndex((x) => x.id === id);
  if (k >= 0) l.splice(k, 1);
}

/** Fin de tour : décrémente les effets à durée, retire ceux qui expirent. */
export function expirerEffets(ctx) {
  for (const a of ctx.etat.effetsActifs.slice()) {
    if (a.restant === null) continue;
    a.restant--;
    if (a.restant <= 0) retirerEffet(ctx, a.id);
  }
}
