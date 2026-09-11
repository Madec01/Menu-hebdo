# VERTIGE — feuille de route

Tableau de bord du projet. Tenu à jour en direct. Voir `CLAUDE.md` pour le cadrage.

---

## À faire maintenant

1. Martin joue un run complet (`cd vertige && npm install && npm run dev`, http://localhost:5174) : rotation, chute, sons, style. Retour franc.
2. Feel du tap : jouer chute et remplissage en parallèle dans `src/rendu/rendu.js` (aujourd'hui ~800 ms séquentiels par tap, cible < 450 ms — audit gameplay).
3. Télégraphe de rotation : brancher `previsualiserRotation` (fantôme de la chute à l'appui long sur un bouton de rotation).
4. Trancher D7 à D11 (ci-dessous) après la partie de Martin, puis appliquer.
5. Polish : menu (plateau décoratif animé), écran de fin de run avec stats (spéciales créées, plus grosse chaîne, XP par salle).

---

## Décisions en attente de Martin

| # | Question | Ma recommandation |
|---|---|---|
| D7 | Le trou sous un ballon (il flotte et fait sol) reste vide jusqu'à la prochaine rotation. Garder ce comportement ou faire tomber le ballon comme les autres ? | Garder : c'est ce qui rend la rotation utile autour d'un ballon. À juger en jouant. |
| D8 | Audio en synthèse Web Audio (aucun fichier). Si ça sonne « 8-bit » à l'oreille de Martin, passer aux samples CC0 (Kenney) en phase 2 ? | Écouter d'abord. |

| D9 | Audit gameplay : jauge de rotation 3 → 2 et bonus XP ×1,2 sur le tap qui suit une rotation, pour que tourner devienne une décision (le bot tourne 1 fois pour 25 taps). | Oui aux deux, après ton ressenti en jouant. |
| D10 | Audit gameplay : seuil croix 8 → 7 (croix = 3,5 % des spéciales créées). | Attendre : à revoir avec les compétences de conversion de la phase 2. |
| D11 | Audit gameplay : mettre fusées et ballons dès le Vestibule et le Puits pour que la rotation serve dès la première salle. | Oui, une fusée dans le Vestibule, un ballon dans le Puits. |

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
- [x] UI HTML/CSS, panneau mode Test (salle, compétences, seed, difficulté, couleurs, jauge)
- [x] Restyle « Cartoon pop » de l'UI (boutons bonbon 3D, badges, cartes qui rebondissent, ciel)
- [x] Audio Web Audio en synthèse (13 familles de sons)
- [x] Rendu Canvas 2D (première version « Atelier », rejetée : trop sobre)
- [x] Restyle « Cartoon pop » du rendu + juice (textes flottants +XP, mots de combo, confettis, ondes de choc, squash du plateau, nuages)
- [x] Test de fumée Playwright vert (`npm run smoke`) : 24 taps, 6 rotations, 10 choix, 0 erreur
- [x] Captures vérifiées à l'œil (menu, jeu, niveau, fin de salle, mode test)
- [ ] Ressenti validé par Martin en jouant
- [x] Audit code + audit gameplay de fin de phase (`docs/AUDIT_CODE.md`, `docs/AUDIT_GAMEPLAY.md`), bloquants et importants appliqués

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

- [x] (important) Rendu : la boucle rAF tournait après retour au menu — `pause()`/`reprendre()` appelés par main.js (audit code, 2026-09-11).
- [x] (mineur) Rendu : une chaîne allouée par bille et par frame sans survol (audit code, 2026-09-11).
- [ ] (à trancher, D7) Case vide sous un ballon jamais comblée tant qu'on ne tourne pas : l'audit code le classe bloquant, c'est un choix de design à valider en jouant.
- [ ] (mineur) Niveau atteint au tour où l'objectif est atteint : le choix d'effet est sauté (choix assumé : il serait sans effet), à confirmer.
- [x] (bloquant) Plateau minuscule : la taille CSS du canvas n'était pas suivie après la mise en page — ResizeObserver dans le rendu + resize fenêtre (2026-09-11).
- [x] (mineur) HUD : un effet valable toute la salle affichait « null » (2026-09-11).
- [x] (mineur) Après « Salle terminée », l'écran de choix de compétence ne s'affichait pas (journal vide non traité dans main.js) (2026-09-11).
- [x] (important) Équilibrage : Propagation verte + Avidité = coups quasi infinis. Avidité plafonnée à 3 par salle ; Propagation limitée aux groupes tapés (2026-09-11).
- [x] (important) Le Puits (salle 2) plus dur que le boss : coups 22 → 26 ; Marée haute triviale : cible 8 → 12 (audit gameplay, 2026-09-11).
- [ ] (mineur) `tools/sim.mjs` : la politique gourmande ignore l'objectif couleur, ce qui sous-estime le Puits.

---

## Idées en plus

Agent idées 2026-09-11 (18 idées dans `docs/IDEES.md`), son Top 5 :
- **Cadran** (règle de salle) — la jauge devient 4 crans, un par orientation ; une orientation utilisée se verrouille jusqu'à ce que les 3 autres aient servi. Force à jouer les quatre gravités.
- **Contrepoids** (compétence) — rotation gratuite après un groupe de 6+. Proche de la règle « +1 jauge par groupe de 6+ » déjà en place ; à fusionner ou à écarter.
- **Toupie** (élément) — pivote à chaque rotation et teinte la bille adjacente dans le sens de rotation ; 3e activation = bombe de couleur. Élément signature de la rotation.
- **Halo directionnel** (feel) — flèche craie sur le bord du plateau indiquant la gravité, qui pulse quand une spéciale ligne/fusée est alignée. Peu coûteux, faisable dès la phase 1.
- **Double engagement** (compétence épique) — le prochain choix est restreint à la même catégorie, en échange les deux compétences font 150 %. Archétypes de build.

- **Phase 0 avant la phase 1** — deux piliers sur cinq sont des questions de ressenti (rotation, satisfaction physique) ; aucune discussion ne les tranche. Proposé ci-dessus.
- **Télégraphe de rotation** — au survol / appui long du bouton de rotation, afficher en fantôme où les billes vont retomber. Rend la rotation lisible sans la rendre triviale, et sert directement le pilier 1.
- **Interdire tout aléatoire dans la rotation** — aucun mélange, jamais. Les salles anarchiques (Tempête, Roulette, Vrille) annoncent toujours la rotation *avant* que le joueur ne s'engage, comme le fait « Pile ou face ». Sinon elles cassent la prévisibilité qui rend la mécanique lisible.
- **Bombe de couleur créée autrement que par la taille de groupe** — elle n'apparaît quasiment jamais naturellement (1,1 % des grilles ont un groupe de 12). La rattacher au Cristal, à une compétence ou à un effet de niveau plutôt qu'à un seuil.
- **Jauge de rotation qui se recharge sur les gros groupes** — +1 rotation par groupe de 6+. Lie les deux verbes du jeu au lieu de les mettre en concurrence.
- **Le moteur ne connaît pas le rendu** — `src/moteur/` en JS pur, testable avec `node --test` et simulable en headless dès la phase 0, comme `terra-nova`. Condition pour que l'audit d'équilibrage de la phase 2 soit possible.

---

## Fait

- 2026-09-11 — Phase 1 jouable : rendu Cartoon pop + juice, UI bonbon, audits code et gameplay appliqués, build 412 Ko avec sourcemaps, zéro réseau.
- 2026-09-11 — Phase 1 : moteur complet (1 200 lignes), données, UI, audio, sim, tests. Reste le rendu et l'intégration.
- 2026-09-11 — Import du document de cadrage dans `vertige/CLAUDE.md`, création de `ROADMAP.md`, mesure des seuils (`tools/seuils.mjs`).
