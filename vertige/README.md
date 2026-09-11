# VERTIGE

Tap-blast roguelite à plateau rotatif. Tape un groupe de billes de même couleur pour l'éliminer ;
tourne le plateau pour changer la gravité et tout faire retomber. Enchaîne les salles, monte de niveau
dans chaque salle, choisis des compétences entre les salles.

## Jouer

```
npm install
npm run dev        # http://localhost:5174
npm run build      # dist/ à servir en statique (aucun appel réseau à l'exécution)
```

- Tap / clic sur un groupe ≥ 2 billes. Une spéciale seule se tape aussi.
- ⟲ ⟳ ↻ (ou Q / D / S, flèches) : rotation 90° gauche, 90° droite, 180°. Chaque rotation consomme la jauge ; un groupe de 6+ en rend une.
- Mode Test depuis le menu : salle, compétences, seed, difficulté, couleurs, jauge.

## Développement

```
npm test           # tests du moteur (node --test)
npm run sim        # simulateur headless, statistiques d'équilibrage (--runs, --seed, --competences, --politique)
npm run smoke      # build + Chromium headless + scénario joué ; --shot pour des captures
node tools/seuils.mjs   # distribution des tailles de groupes
```

Le moteur (`src/moteur/`) ne touche jamais au DOM : il renvoie un journal d'événements que le rendu
(`src/rendu/`, Canvas 2D), l'interface (`src/ui/`) et l'audio (`src/audio/`, synthèse Web Audio) consomment.
Contrats entre modules : `docs/CONTRATS.md`. Cadrage : `CLAUDE.md`. Feuille de route : `ROADMAP.md`.
