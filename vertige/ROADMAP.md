# VERTIGE — feuille de route

Tableau de bord du projet. Tenu à jour en direct. Voir `CLAUDE.md` pour le cadrage.

---

## À faire maintenant

1. **Martin tranche les 6 décisions en attente ci-dessous** (surtout D1 rotation, D4 coût de rotation, D0 emplacement).
2. Phase 0 — prototype de ressenti (voir ci-dessous) : grille + tap + rotation + chute, rien d'autre.
3. Jouer la phase 0 et trancher D1/D3/D4 au doigt plutôt qu'à l'argument.
4. Geler le contrat du bus de hooks dans `docs/CONTRATS.md` avant tout code de compétence.
5. Lancer l'agent idées (salles + compétences) une fois la phase 0 jouable.

---

## Décisions en attente de Martin

| # | Question | Ma recommandation |
|---|---|---|
| D0 | Dépôt : `blast` (CLAUDE.md §2) ou `Menu-hebdo/vertige/` ? | `Menu-hebdo/vertige/`, comme `terra-nova/`. Même outillage, un seul dépôt à suivre. Déplaçable en une commande. |
| D1 | §11.1 Rotation : tourner les données, ou garder les données fixes et déplacer la gravité ? | **Gravité mobile, données fixes.** Voir argumentaire dans le récap de session. Contredit §4.1. |
| D2 | §11.2 Murs / cages tournent-ils ? | Tout tourne avec le plateau par défaut. Séparer deux champs distincts : `tombe` (la gravité le déplace) et `ancrage` (`plateau` / `ecran`). Aucun élément en `ecran` en phase 1. |
| D3 | §11.3 Remplissage par le haut visuel ou le haut d'origine ? | **Haut visuel** (côté opposé à la gravité). Champ par salle `entree`. La marée est un système séparé qui pousse depuis le côté gravité. |
| D4 | §11.4 La rotation coûte un coup ou une jauge ? | **Jauge séparée**, avec le coût en donnée (`{source:'coups'\|'jauge', valeur}`) et un curseur en mode Test. Un coût en coups rend la rotation dominée. |
| D5 | Bibliothèques (§2) | Pixi.js (rendu + halo), anime.js (UI et plateau), Howler.js (son, samples CC0), mulberry32 maison (RNG, déjà la convention de `terra-nova`). **Pas de matter.js.** |
| D6 | Seuils des spéciales (§4.3) | 5/7/9/12 → **4/6/8/10**, chiffres à l'appui (`tools/seuils.mjs`). À revalider sur le vrai simulateur. |

---

## Phase 0 — prototype de ressenti (proposée, hors CLAUDE.md)

Objectif : répondre à D1, D3, D4 en jouant, pas en discutant. Aucune spéciale, aucune XP, aucune salle.

- [ ] Squelette du projet (Vite, `src/moteur/` pur + `src/rendu/`, `tests/`, `tools/`)
- [ ] Grille 8×10, 5 couleurs, seed déterministe
- [ ] Détection de groupe et tap
- [ ] Rotation 90°/180° avec animation du plateau
- [ ] Chute avec accélération et rebond
- [ ] Remplissage par le haut visuel
- [ ] Mode Test minimal : seed, nombre de couleurs, coût de rotation, approche de rotation
- [ ] Simulateur headless `tools/sim.mjs` (le moteur tourne sans DOM)

## Phase 1 — Le cœur

- [ ] Spéciales : bombe, ligne, croix, bombe de couleur, orientées par la gravité
- [ ] Chaînes de spéciales
- [ ] XP et niveau en salle 1 → 7
- [ ] ~12 effets de niveau (paliers 1-3 et 4-7)
- [ ] Bus de hooks central + `docs/CONTRATS.md`
- [ ] Éléments : Bulle, Ballon, Fusée dormante
- [ ] 5 salles enchaînées : normale, Puits, Marée haute, Tempête, Le Pendule (boss)
- [ ] Écran de choix de compétence entre les salles (~10 compétences)
- [ ] Sons (non chiptune), particules, screenshake
- [ ] Sauvegarde du run en cours (localStorage)
- [ ] Mode Test complet (tout débloqué, choix de salle et de compétences, difficulté, seed)
- [ ] Audit code + audit gameplay de fin de phase

## Phase 2 — Le run

- [ ] Carte de nœuds, acte 1 (~12 salles), élites, salles spéciales
- [ ] Tous les éléments de §5
- [ ] Pool complet de compétences et d'effets 1-7
- [ ] Boutique méta minimale
- [ ] Audit équilibrage sur simulation

## Phase 3 — Profondeur

- [ ] Actes 2 et 3, tous les boss, salles à étapes et anarchiques restantes
- [ ] Effets 8-10, ultimes, personnages, atelier (fusions)
- [ ] Cosmétiques, statistiques, équilibrage final

---

## Bugs

Aucun (pas encore de code).

---

## Idées en plus

- **Phase 0 avant la phase 1** — deux piliers sur cinq sont des questions de ressenti (rotation, satisfaction physique) ; aucune discussion ne les tranche. Proposé ci-dessus.
- **Télégraphe de rotation** — au survol / appui long du bouton de rotation, afficher en fantôme où les billes vont retomber. Rend la rotation lisible sans la rendre triviale, et sert directement le pilier 1.
- **Interdire tout aléatoire dans la rotation** — aucun mélange, jamais. Les salles anarchiques (Tempête, Roulette, Vrille) annoncent toujours la rotation *avant* que le joueur ne s'engage, comme le fait « Pile ou face ». Sinon elles cassent la prévisibilité qui rend la mécanique lisible.
- **Bombe de couleur créée autrement que par la taille de groupe** — elle n'apparaît quasiment jamais naturellement (1,1 % des grilles ont un groupe de 12). La rattacher au Cristal, à une compétence ou à un effet de niveau plutôt qu'à un seuil.
- **Jauge de rotation qui se recharge sur les gros groupes** — +1 rotation par groupe de 6+. Lie les deux verbes du jeu au lieu de les mettre en concurrence.
- **Le moteur ne connaît pas le rendu** — `src/moteur/` en JS pur, testable avec `node --test` et simulable en headless dès la phase 0, comme `terra-nova`. Condition pour que l'audit d'équilibrage de la phase 2 soit possible.

---

## Fait

- 2026-09-11 — Import du document de cadrage dans `vertige/CLAUDE.md`, création de `ROADMAP.md`, mesure des seuils (`tools/seuils.mjs`).
