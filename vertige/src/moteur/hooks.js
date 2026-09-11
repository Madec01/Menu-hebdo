// Bus central : compétences et effets de niveau s'y abonnent ; la logique de grille
// n'en connaît que les noms d'événements (docs/CONTRATS.md §8).
export function creerBus() {
  const abonnes = new Map(); // nom → [{fn, source}]
  const bus = {
    on(nom, fn, { source } = {}) {
      if (!abonnes.has(nom)) abonnes.set(nom, []);
      abonnes.get(nom).push({ fn, source: source ?? null });
    },
    /** Retire tous les abonnements d'une source (ex. 'effet:coups_2'). */
    off(source) {
      for (const liste of abonnes.values()) {
        for (let i = liste.length - 1; i >= 0; i--) if (liste[i].source === source) liste.splice(i, 1);
      }
    },
    /** Notifie les abonnés ; ils peuvent muter ctx et pousser des événements. */
    emettre(nom, ctx, evt = {}) {
      const liste = abonnes.get(nom);
      if (!liste) return;
      for (const a of liste.slice()) a.fn(ctx, evt);
    },
    /** Passe une valeur dans chaque réducteur abonné ; undefined = valeur inchangée. */
    reduire(nom, valeur, ctx, evt = {}) {
      const liste = abonnes.get(nom);
      if (!liste) return valeur;
      let v = valeur;
      for (const a of liste.slice()) { const r = a.fn(v, ctx, evt); if (r !== undefined) v = r; }
      return v;
    },
    sources() {
      const s = new Set();
      for (const liste of abonnes.values()) for (const a of liste) if (a.source) s.add(a.source);
      return [...s];
    },
    vider() { abonnes.clear(); },
  };
  return bus;
}
