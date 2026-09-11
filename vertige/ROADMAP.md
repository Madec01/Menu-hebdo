# VERTIGE — feuille de route

Tableau de bord du projet. Tenu à jour en direct. Voir `CLAUDE.md` pour le cadrage.

---

## À faire maintenant

1. Intégrer le rendu (agent en cours), lancer `npm run smoke:shot`, regarder les captures, corriger.
2. Jouer un run complet à la main (Martin) : ressenti de la rotation, de la chute, des sons.
3. Audit code + audit gameplay de fin de phase 1 (agents), appliquer les bloquants.
4. Équilibrer avec `npm run sim` : Puits (46 % avec un bot qui ignore la couleur), Pendule.
5. Trier `docs/IDEES.md` (agent idées) dans « Idées en plus » ci-dessous.

---

## Décisions en attente de Martin

| # | Question | Ma recommandation |
|---|---|---|
| D7 | Le trou sous un ballon (il flotte et fait sol) reste vide jusqu'à la prochaine rotation. Garder ce comportement ou faire tomber le ballon comme les autres ? | Garder : c'est ce qui rend la rotation utile autour d'un ballon. À juger en jouant. |
| D8 | Audio en synthèse Web Audio (aucun fichier). Si ça sonne « 8-bit » à l'oreille de Martin, passer aux samples CC0 (Kenney) en phase 2 ? | Écouter d'abord. |

Décisions D0-D6 tranchées le 2026-09-11 (voir CLAUDE.md §12).

---

## Phase 1 — Le cœur

- [x] Squelette Vite, `src/moteur/` pur, `src/rendu/`, `src/ui/`, `src/audio/`, `tests/`, `tools/`
- [x] Contrats entre modules (`docs/CONTRATS.md`)
- [x] Grille, gravité mobile, groupes, tap, rotation 90/180, chute, remplissage par le haut visuel
- [x] Spéciales bombe / ligne / croix / couleur orientées par la gravité, chaînes, spéciales adjacentes
- [x] Éléments bulle, ballon, fusée (activation par proximité)
- [x] Pierres (détruites par adjacence et par explosion)
- [x] XP, niveau en salle 1 → 7, 13 effets de niveau (paliers 1-2) par hooks
- [x] Bus de hooks central
- [x] 10 compétences de run par hooks, écran de choix entre les salles
- [x] 5 salles linéaires : Vestibule, Puits, Marée haute, Tempête, Le Pendule
- [x] Jauge de rotation (+1 par groupe de 6+), coût en donnée
- [x] Sauvegarde du run (localStorage) et profil méta minimal
- [x] Simulateur headless `tools/sim.mjs`, tests `node --test` (8)
- [x] UI HTML/CSS style Atelier, panneau mode Test (salle, compétences, seed, difficulté, couleurs, jauge)
- [x] Audio Web Audio en synthèse (13 familles de sons)
- [ ] Rendu Canvas 2D style Atelier (agent en cours)
- [ ] Test de fumée Playwright vert (`npm run smoke`)
- [ ] Captures vérifiées à l'œil, ressenti validé par Martin
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

- [ ] (mineur) `tools/sim.mjs` : la politique gourmande ignore l'objectif couleur, ce qui sous-estime le Puits.

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

- 2026-09-11 — Phase 1 : moteur complet (1 200 lignes), données, UI, audio, sim, tests. Reste le rendu et l'intégration.
- 2026-09-11 — Import du document de cadrage dans `vertige/CLAUDE.md`, création de `ROADMAP.md`, mesure des seuils (`tools/seuils.mjs`).
