# VERTIGE — Tap-blast roguelite à plateau rotatif

> Titre de travail. Document de cadrage pour Claude Code. Lire intégralement avant d'écrire une ligne de code.

---

## 1. Vision

Un jeu de tap-blast (taper un groupe de billes adjacentes de même couleur pour l'éliminer) dont la mécanique centrale est la **rotation du plateau** : tourner la grille change la gravité, toutes les billes retombent, la grille se mélange de façon prévisible. Le joueur enchaîne des **salles** avec objectifs, monte de niveau *dans* chaque salle (1 → 10), choisit des compétences *entre* les salles, et dépense l'expérience accumulée dans une **boutique méta** persistante.

Références : Candy Crush (satisfaction, lisibilité), Angry Birds Dream Blast (tap-blast, physique de chute, éléments activés par proximité), Slay the Spire / Balatro (structure de run, choix entre les salles, synergies qui cassent le jeu).

### Piliers de design
1. **La rotation est une décision, pas un gadget.** Elle coûte quelque chose, elle change l'orientation des billes spéciales, elle amène les éléments vers la zone de jeu. Chaque compétence de rotation doit changer *quand* on tourne.
2. **Satisfaction physique.** Chute avec rebond, cascades lisibles, gros feedback (particules, screenshake léger, son) proportionnel à la taille du groupe.
3. **Trois couches de progression distinctes** : niveau en salle (temporaire, petit), compétences de run (moyen, tout le run), boutique méta (permanent). Un niveau en salle ≈ un tiers d'une compétence de run.
4. **Les éléments réagissent à la proximité, pas au tap direct.** Ils donnent du sens à la rotation.
5. **Synergies.** Les compétences de conversion changent *ce qu'on tape en premier*, les compétences de rotation changent *quand on tourne*. Le pool doit permettre des builds absurdes en fin de run.

---

## 2. Contraintes techniques (non négociables)

- **Dépôt GitHub `blast`**, projet multi-fichiers. Structure recommandée (à valider) : `index.html`, `src/` (modules ES : `grille.js`, `gravite.js`, `rendu.js`, `audio.js`, `hooks.js`, `ui/`), `data/` (salles, compétences, effets, éléments en JSON ou JS pur), `assets/` (sons, sprites), `lib/` (bibliothèques vendorées), `tools/` (scripts de build, simulateur headless). Un build simple (script npm ou Vite) peut produire une version mono-fichier pour partage, mais ce n'est pas obligatoire.
- **Zéro appel réseau à l'exécution** : les bibliothèques sont dans `lib/` ou en `node_modules` buildé, jamais chargées depuis un CDN. Le jeu doit tourner hors ligne, en ouvrant `index.html` ou via un serveur statique, et sur un PC avec proxy.
- **Utiliser l'existant plutôt que réinventer** : animations, tweening, rendu, particules, physique, audio. Candidats à évaluer (proposer un choix argumenté à Martin avant d'intégrer) :
  - Rendu / particules : **PixiJS** (WebGL avec fallback canvas, filtres glow natifs) ou Canvas 2D maison si Pixi est jugé trop lourd.
  - Tweening / animations : **GSAP** ou **anime.js** (chute, rebond, rotation du plateau, UI).
  - Physique de chute / rebond : **matter.js** si on veut du vrai rebond ; sinon intégration simple maison.
  - Audio : **Howler.js** pour jouer des sons libres de droit embarqués en base64 ; **Tone.js** pour la synthèse riche si on génère.
  - Utilitaires : seedrandom (RNG déterministe).
  - Surveiller le poids total (cible < 5 Mo chargés). Si une lib coûte plus qu'elle n'apporte, ne pas l'intégrer.
- Sons : **pas de rendu "oscillateur" / chiptune**. Soit des samples libres de droit (freesound CC0, Kenney) embarqués, soit de la synthèse riche (enveloppes, bruit filtré, réverbération, couches). Si le résultat sonne 8-bit, c'est raté.
- Graphismes : assets libres de droit (Kenney, OpenGameArt CC0) dans `assets/` quand c'est plus beau que du dessin procédural. Le style néon reste la référence.
- Sauvegarde **localStorage** (profil méta, run en cours, options).
- Doit tourner sur mobile (tactile) et desktop (souris). Ratio portrait prioritaire, la grille occupe le centre.
- Esthétique **néon / dark / glassmorphism** cohérente avec les autres projets de Martin : fond sombre profond, billes lumineuses avec halo, panneaux translucides flous, accents saturés. Pas de style "flat cartoon".
- Performance : 60 fps sur mobile milieu de gamme. Object pooling pour particules. Pas de garbage à chaque frame.
- Code en **français** pour les commentaires et noms de données de jeu (compétences, salles), en anglais pour le code technique si plus naturel. Tout le texte joueur en français.
- **Mode Test** accessible depuis le menu : tout débloqué, choix de la salle, choix des compétences, curseur de difficulté, seed fixable. Le mode Normal est le vrai jeu.

### Règles de travail avec Martin

**1. Valider avant de coder.** Pour tout choix structurant (bibliothèques, format de données, architecture, boucle de rotation), proposer d'abord, attendre l'accord de Martin, puis implémenter. Livrer par phases jouables (§9) : chaque phase = un commit sur `blast` qui se lance et se joue. Commits atomiques, messages en français, pas de push de code cassé sur `main`. Ne pas anticiper les phases suivantes au-delà des structures de données prévues ici. Seed déterministe pour tout le run.

**2. Utiliser des agents, activement.** Le travail se fait en équipe d'agents, pas en solo :
- *Agent idées* : avant chaque phase et à chaque fois qu'un système manque de variété (salles, compétences, éléments), lancer un agent qui propose 10-20 idées nouvelles en s'inspirant de jeux existants (Candy Crush, Dream Blast, Toon Blast, Royal Match, Balatro, Slay the Spire, Vampire Survivors, Peglin, Luck be a Landlord). Les idées sont soumises à Martin, pas intégrées d'office.
- *Agents de code* : découper le travail en modules isolables (grille/gravité, rendu, audio, UI de choix, système de hooks, données de salles) et paralléliser quand les interfaces sont fixées. Un agent = un module avec un contrat clair.
- *Agents d'audit* (voir règle 5).

**3. Récap après chaque rendu de code.** À chaque livraison d'un fichier, terminer par un bloc RÉCAP structuré :
- Ce qui a été fait (fonctionnalités, fichiers, libs intégrées, poids du fichier).
- Ce qui a été testé et comment (et ce qui ne l'a pas été).
- Ce qui reste, bugs connus, dette technique.
- **Mes idées** : 2-5 propositions concrètes pour améliorer le jeu (mécaniques, feel, équilibrage).
- **Mes critiques** : ce qui ne marche pas ou pas assez bien dans l'état actuel, sans complaisance. Si une idée de Martin ou une décision antérieure pose problème, le dire clairement avec une alternative.
- Prochaine étape recommandée (identique au bloc « À faire maintenant » de `ROADMAP.md`).
- Tokens consommés approximativement sur la session et modèles utilisés par les agents.

**4. Donner ses idées et ses critiques spontanément.** Pas seulement dans le récap : si en cours de route un choix de design semble faible, une compétence inutile, une salle injouable, le signaler immédiatement. Martin préfère une critique franche à un jeu médiocre.

**5. Audits par agents.** Lancer des agents d'audit :
- *Audit code* : après chaque phase et avant toute refonte. Lisibilité, performance (60 fps mobile), fuites mémoire, cohérence du système de hooks, cas limites de la rotation (grilles non carrées, éléments fixes, billes en vol). L'agent rend un rapport priorisé (bloquant / important / mineur).
- *Audit gameplay* : après chaque phase. L'agent joue le rôle d'un game designer qui compare avec des jeux de référence : feel du tap et de la chute vs Dream Blast, lisibilité vs Candy Crush, courbe de run et synergies vs Slay the Spire / Balatro, juice vs Vampire Survivors. Il rend une liste de ce qui est en dessous des références et de ce qui est au-dessus, avec des propositions concrètes.
- *Audit équilibrage* (phase 2+) : simuler des runs (mode headless si possible) pour repérer les compétences dominantes, inutiles, et les salles injouables.
- Les rapports d'audit sont présentés à Martin résumés, avec la liste des corrections proposées ; les corrections bloquantes peuvent être appliquées directement.

**6. Gestion du contexte : dire quand faire /clear.** Quand le contexte devient long (fin de phase, après un gros audit, après plusieurs allers-retours de debug, ou dès que la qualité des réponses baisse), le dire explicitement à Martin et lui fournir un **prompt de reprise prêt à copier-coller** dans un bloc de code, contenant :
- Rappel de lire CLAUDE.md puis ROADMAP.md.
- État exact du projet en 3 lignes (le détail est dans ROADMAP.md).
- Les décisions prises dans la session qui ne sont pas encore dans CLAUDE.md (et proposer de les y ajouter avant le clear).
- La tâche précise à reprendre, avec le premier pas.
- Les bugs ouverts et les questions en attente de Martin.
Format attendu :
```
Reprise projet VERTIGE — lis CLAUDE.md puis ROADMAP.md.
État : phase X, fichier vertige.html (vN), fonctionnel : ..., cassé : ...
Décisions de la session précédente : ...
Tâche : ...
Premier pas : ...
Bugs ouverts : ...
Questions en attente : ...
```
Mettre à jour ROADMAP.md et CLAUDE.md (§12 Journal) avant chaque clear.

**7. Journal.** Tenir la section §12 à jour à chaque phase : décisions, libs retenues, changements par rapport à ce document.

**8. Feuille de route vivante (`ROADMAP.md` à la racine du dépôt).** Créer ce fichier dès le premier commit et le tenir à jour **en direct**, à chaque tâche terminée, pas seulement en fin de session. C'est le tableau de bord de Martin. Contenu :
- En tête, un bloc **« À faire maintenant »** : les 3-5 prochaines tâches concrètes, dans l'ordre. C'est ce que Martin regarde en premier.
- Par phase (§9), la liste des tâches avec cases à cocher `- [ ]` / `- [x]`. Cocher immédiatement après avoir terminé et testé.
- Une section **Bugs** : chaque bug repéré (par Martin, par un audit, par Claude Code) y est ajouté avec sévérité (bloquant / important / mineur) et coché quand corrigé, avec le commit.
- Une section **Idées en plus** : toutes les idées proposées (agents idées, récaps, Martin) qui ne sont pas encore décidées, avec une ligne d'explication. Quand Martin en valide une, elle passe dans les tâches de la phase concernée.
- Une section **Décisions en attente de Martin** : questions ouvertes bloquantes.
- Une section **Fait** repliée (ou en bas) pour l'historique.
- Format : Markdown pur, court, une ligne par item, dates au format `AAAA-MM-JJ`. Pas de prose.
- Le prompt de reprise (règle 6) renvoie vers `ROADMAP.md` au lieu de redétailler l'état.

**9. Économie de tokens (limites journalières et hebdomadaires de Martin).** Chaque token compte ; optimiser en permanence :
- *Lectures de fichiers* : ne jamais relire un fichier entier déjà en contexte. Utiliser `grep`/`rg` pour cibler, puis lire uniquement les plages de lignes utiles. Ne pas lister le dépôt à répétition. Ne pas lire `lib/`, `assets/`, `node_modules/` sauf nécessité absolue. Découper les gros modules (< 400 lignes) pour que les lectures partielles restent pertinentes.
- *Écritures* : privilégier les éditions ciblées aux réécritures complètes de fichiers. Ne pas recopier du code dans les réponses ; renvoyer aux fichiers.
- *Réponses* : concises. Le récap (règle 3) est structuré, pas verbeux. Pas de rappel de ce que Martin sait déjà.
- *Agents* : un agent reçoit un brief minimal et précis (contrat du module, lignes concernées, critères de fin), pas tout le contexte. Un agent ne relit pas ce que l'orchestrateur a déjà lu s'il peut recevoir l'extrait dans son brief. Pas d'agent pour une tâche que l'orchestrateur fait en moins de 30 lignes.
- *Choix du modèle par agent* — règle : **le modèle le moins cher qui fait le travail correctement**.
  - **Haiku** : recherche dans le code, grep intelligent, listing, reformulation, vérification de syntaxe, génération de données répétitives (variantes de compétences, tables), lint, petits correctifs mécaniques.
  - **Sonnet** : par défaut pour tout le reste — écriture de modules, audits code, agents idées, audit gameplay, debug ordinaire.
  - **Fable / Mythos-class** : **uniquement si vraiment nécessaire** — refonte d'architecture, bug qui a résisté à deux tentatives Sonnet, audit final d'équilibrage sur simulation, décision de design à fort impact. Justifier en une ligne pourquoi Fable est requis avant de le lancer.
  - L'orchestrateur lui-même tourne avec le modèle choisi par Martin ; ne pas en changer sans le dire.
- *Contexte* : appliquer la règle 6 (/clear) plus tôt plutôt que plus tard ; un contexte long coûte cher à chaque tour.
- *Mode Test / simulateur headless* : tester par script (`tools/sim.js`) plutôt que par allers-retours de description quand c'est possible, c'est moins coûteux en tokens qu'une conversation de debug.

---

## 3. Boucle de jeu

### 3.1 Tour de jeu (dans une salle)
1. Le joueur **tape un groupe** (≥ 2 billes adjacentes orthogonalement de même couleur) → elles sont détruites, XP gagnée, éléments adjacents activés, spéciales créées si groupe ≥ seuil.
2. **OU** le joueur **tourne le plateau** : 90° gauche, 90° droite ou 180°. Coût : 1 coup (modifiable par compétences).
3. **Chute** : toutes les billes tombent vers le bas actuel, avec physique (accélération, léger rebond, glissement latéral possible si compétence). Les cascades (nouveaux groupes formés par la chute ne se déclenchent **pas** automatiquement — c'est un tap-blast, pas un match-3 ; par contre les spéciales qui tombent sur une explosion en cours s'enchaînent).
4. **Remplissage** : de nouvelles billes entrent depuis le haut actuel selon les règles de la salle.
5. **Effets de fin de tour** : ruches qui pondent, marée, rotation automatique de la salle, etc.
6. Vérifier objectif / échec.

### 3.2 Salle
- Une salle = grille (dimensions et forme variables), pool de couleurs, objectif, compte de coups, éléments placés, règles spéciales, récompense.
- Le **niveau en salle** part de 1, monte avec l'XP jusqu'à 10. Chaque montée propose **2 effets** (3 avec certaines compétences), valables jusqu'à la sortie de la salle (ou du groupe de sous-salles).
- Sortie de salle → écran de choix de **compétence de run** (3 propositions, 1 choix, possibilité de passer contre de la monnaie de run).

### 3.3 Run
- Carte de nœuds façon Slay the Spire, 3 actes, ~12-15 salles par acte, boss de fin d'acte.
- Types de nœuds : salle normale, salle d'élite, salle à étapes, salle spéciale (boutique, atelier, repos, mystère), boss.
- Ressources de run : **coups** (par salle), **monnaie de run** (dépensée en boutique de run), **compétences de run**.
- Fin de run : victoire (boss acte 3) ou échec (grille bloquée / plus de coups sans objectif atteint / ruche qui remplit tout).
- L'**XP totale** du run est convertie en **monnaie méta** à la fin (victoire ou échec, avec bonus de victoire).

### 3.4 Méta
- Boutique persistante : compétences permanentes, élargissement des pools, personnages, cosmétiques.
- Profil : runs joués, meilleure profondeur, compétences débloquées, personnages.

---

## 4. Grille, billes, spéciales

### 4.1 Grille
- Par défaut 8 × 10 (largeur × hauteur). Variable par salle (puits 5×14, rond, deux moitiés…).
- La grille a une **orientation** (0/90/180/270). La rotation est visuelle *et* logique : on tourne le tableau de données, la gravité reste "vers le bas de l'écran". Plus simple à raisonner que d'avoir une gravité mobile sur une grille fixe. **Proposer les deux approches à Martin avant de coder.**
- Cases possibles : vide, bille, bille-pierre (inerte, ne tombe que par gravité, détruite par explosion adjacente ou effets), élément, mur (fixe, ne tourne pas avec les billes — à valider), cage.

### 4.2 Billes
- 5 couleurs par défaut (pool réglable par salle : 2 à 6). Palette néon distincte : rouge corail, vert acide, bleu électrique, jaune soleil, violet magenta, (cyan pour la 6e).
- Chaque bille a : couleur, position logique, position visuelle (pour l'animation de chute), état (normale, spéciale, teinte en cours…).

### 4.3 Billes spéciales
Créées quand un groupe atteint un seuil. Elles sont **orientées** : leur effet dépend de la gravité au moment de l'explosion.

| Spéciale | Seuil par défaut | Effet |
|---|---|---|
| Bombe | 5 | Explose en carré 3×3 |
| Ligne | 7 | Détruit la colonne dans l'axe de la gravité actuelle |
| Croix | 9 | Ligne + rangée |
| Bombe de couleur | 12 | Détruit toutes les billes de la couleur tapée avec |
| Magnétique | via compétence | À chaque rotation, attire les billes de sa couleur vers elle (rayon 2) |

- Spéciale adjacente à une explosion → s'enclenche (chaîne).
- Deux spéciales adjacentes tapées ensemble → fusion (règles dans les compétences).

---

## 5. Éléments à activation par proximité

Un élément ne se tape pas. Il **s'active** quand un groupe adjacent (orthogonalement) est détruit ou qu'une explosion le touche. Certains réagissent aussi à la rotation.

| Élément | Activations | Comportement |
|---|---|---|
| **Bulle** | 1 | Libère la bille ou spéciale qu'elle contient, qui rejoint la grille |
| **Ballon** | 2 | Monte contre la gravité à chaque rotation ; éclate au plafond ou après 2 activations (objectif classique) |
| **Cristal** | 3 | Change de couleur à chaque activation, la dernière libère une bombe de couleur |
| **Boîte à musique** | 2 (fragile) | Chaque activation = +1 niveau en salle |
| **Fusée dormante** | 1 | Part dans le sens de la gravité actuelle, détruit tout sur son passage. On l'oriente en tournant avant |
| **Ruche** | 3 | Chaque tour *sans* activation : pond une bille-pierre adjacente |
| **Coffre** | 4 | Donne de la monnaie de run |
| **Lanterne** | passif | Éclaire un rayon 2 (salles d'obscurité). Activation = rayon 3 pendant 2 tours |
| **Aimant** | 1 (réutilisable, cooldown 3) | Tire toutes les billes de sa couleur vers lui |
| **Miroir** | passif | Renvoie l'explosion adjacente en symétrie de l'autre côté de la grille |
| **Glaçon** | 1 par couche (1-3) | Recouvre une zone ; la rotation le fait glisser, il n'est pas bloqué |

Les éléments tombent avec la gravité **sauf** Lanterne, Miroir, Aimant, Cage (fixes). À valider élément par élément.

---

## 6. Progression

### 6.1 Niveau en salle (1 → 10)
XP par bille détruite : base 10, × multiplicateur de taille de groupe (groupe de n : ×(1 + 0.15·(n−2))), × multiplicateur de cascade/chaîne. Seuils de niveau : courbe douce, niveau 10 atteignable dans une salle d'élite, rarement dans une salle normale.

Pool d'effets par palier (proposer 2 tirés du palier, sans doublon dans la salle) :

**Niveaux 1-3 (mineurs)**
- +2 coups
- La prochaine spéciale créée est une bombe
- 3 billes aléatoires prennent la couleur dominante
- La prochaine rotation est gratuite
- La ligne du bas est nettoyée
- +1 activation sur tous les éléments présents (ils sont "avancés")

**Niveaux 4-7 (moyens)**
- Les groupes de 3 comptent comme 4 pendant 3 tours
- Les cascades/chaînes valent double XP jusqu'à la fin de la salle
- Une colonne (au choix, selon gravité actuelle) devient monochrome
- Les spéciales existantes gagnent +1 rayon
- Les billes-pierre les plus basses fondent
- Rotation 180° gratuite immédiate
- Le prochain tap teinte ses voisines de sa couleur

**Niveaux 8-10 (majeurs)**
- Bombe de couleur offerte (placée au centre)
- Toutes les spéciales présentes explosent maintenant
- La grille perd une ligne (moins de billes à gérer, définitif pour la salle)
- 5 tours où chaque tap teinte ses voisines
- 3 tours de gravité libre sans coût
- Niveau 10 : **ultime du personnage** (voir §8)

### 6.2 Compétences de run
Choisies entre les salles. Raretés : commun / rare / épique. Une compétence peut avoir un **malus** (plus puissante). Certaines s'empilent (indiquer `stackable`).

**Conversion & contagion**
- *Propagation* (par couleur, existe en 5 versions) : les [vertes] détruites convertissent leurs voisines orthogonales en [vert]. Rare.
- *Teinture* : la première bille tapée du tour teinte sa ligne (selon gravité) de sa couleur. Rare.
- *Domino* : détruire un groupe de 4+ convertit une bille aléatoire adjacente à la zone vidée vers la couleur du groupe. Commun.
- *Monochrome tournant* : chaque rotation convertit 3 billes aléatoires vers la couleur la plus rare. Commun.
- *Écho* : après un tap, les billes de même couleur à distance 2 prennent la couleur du plus gros groupe voisin. Épique.

**Spéciales**
- *Seuil abaissé* : bombe dès 4 au lieu de 5 (tous les seuils −1). Rare, stackable ×2.
- *Double amorce* : bombe adjacente à une bombe → croix double taille. Commun.
- *Ligne rotative* : les billes-ligne tirent dans les deux axes. Rare.
- *Fusion* : deux spéciales adjacentes fusionnent en bombe de couleur. Épique.
- *Bille magnétique* : ajoute la spéciale Magnétique au pool (seuil 6). Rare.
- *Retardée* : les bombes explosent au tour suivant avec rayon +1. Rare (malus léger).

**Rotation**
- *Vertige* : une rotation gratuite par salle. Commun, stackable.
- *Inertie* : à la rotation, les billes glissent d'une case de plus latéralement (regroupe). Rare.
- *Rotation détonante* : chaque rotation déclenche toutes les spéciales présentes. Épique.
- *Aimant de gravité* : à la rotation, une couleur (choisie à l'acquisition) tombe en premier et se regroupe. Rare.
- *Demi-tour brisant* : une rotation 180° détruit les billes-pierre qui touchent le sol. Commun.
- *Tourbillon* : débloque la rotation 45° (chute diagonale), 1 utilisation par salle. Épique, chaotique.

**Chaîne & score**
- *Cascade* : chaque chaîne de spéciales vaut ×1,5 cumulatif. Commun.
- *Serpent* : un groupe en ligne droite de 6+ crée une bille-ligne supplémentaire. Rare.
- *Grande faim* : les groupes de 8+ nettoient leur bordure (1 case). Rare.
- *Avidité* : +1 coup par groupe de 7+. Commun.
- *Frénésie* : trois taps de même couleur d'affilée → le troisième explose en croix. Rare.

**Défense & économie**
- *Coup de trop* : à 0 coup, une dernière rotation gratuite. Commun.
- *Fossoyeur* : les billes-pierre touchées par une explosion deviennent des billes normales au lieu de disparaître. Commun.
- *Réserve* : les coups non utilisés en fin de salle deviennent de la monnaie de run. Commun.
- *Assurance* : une fois par run, annuler le dernier tap. Rare.
- *Prévoyance* : on voit les 2 prochaines lignes qui entreront. Commun.
- *Mentor* : 3 effets proposés à chaque niveau en salle au lieu de 2. Rare.
- *Apprentissage* : +25 % d'XP en salle. Commun, stackable.

**À malus (épiques)**
- *Daltonien* : deux couleurs deviennent une seule, mais une 6e couleur entre dans le pool.
- *Plateau instable* : rotation gratuite, mais une fois sur deux le sens est aléatoire.
- *Tout ou rien* : groupes < 4 rapportent 0, groupes ≥ 4 valent ×2.
- *Bombes fragiles* : les spéciales explosent dès qu'une bille tombe dessus.

### 6.3 Boutique méta
Monnaie : XP totale du run ÷ 100 (bonus ×1.5 en cas de victoire).
- Compétences permanentes (une fois achetées : ajoutées au pool de run, ou passives permanentes selon la compétence — à définir par compétence).
- Déblocage des paliers d'effets de niveau 8-10 (verrouillés au début : le pool s'arrête au niveau 7).
- Personnages (§8).
- Cosmétiques : skins de billes, thèmes de plateau, traînées de particules.

---

## 7. Salles

Format commun : `id, nom, type, grille (w,h,forme), couleurs, coups, objectif, éléments, règles, récompense, acte min`.

### 7.1 Objectifs possibles
Score cible / détruire N billes d'une couleur / éclater N ballons / compléter N cristaux / survivre N tours / vider une zone / ouvrir N coffres / détruire toutes les pierres / atteindre le niveau N en salle.

### 7.2 Salles normales à contrainte
- **Obscurité** : seules les cases à rayon 2 des lanternes et du dernier tap sont visibles.
- **Sablier** : chrono réel au lieu des coups. La rotation gèle le chrono 2 s.
- **Marée haute** : une ligne entre par le bas actuel tous les 2 tours. Tourner change d'où elle arrive.
- **Deux couleurs** : 2 couleurs, mais 40 % de billes-pierre.
- **Quarantaine** : une zone en cage, ses explosions ne font pas tomber l'extérieur.
- **Gravité collante** : les billes ne tombent que lors d'une rotation. Sans rotation, les trous restent.
- **Plateau rond** : grille circulaire, gravité vers le centre ou vers le bord (bascule à chaque rotation).
- **Puits** : grille 5×14, la rotation change tout.

### 7.3 Salles de rotation anarchique
- **Tempête** : chaque tour, le plateau tourne de 1 à 3 quarts dans un sens aléatoire (en plus des rotations du joueur).
- **Tremblement** : tous les 3 tours, deux rotations opposées d'affilée (les billes décollent et retombent légèrement mélangées).
- **Pile ou face** : avant chaque tap, le jeu annonce la rotation qui suivra.
- **Vrille** : un quart de tour automatique à chaque groupe de 5+.
- **Roulette** : rotation gratuite mais sens tiré au dé ; relance possible contre 1 coup.

### 7.4 Salles à étapes (3 sous-salles, grille et niveau conservés)
- **Triptyque** : score → 4 ballons → survivre 5 tours de ruche.
- **Ascension** : trois grilles empilées ; vider le bas de la 1 ouvre la 2 (les billes tombent dedans).
- **Relais** : chaque sous-salle impose une gravité de départ ; ce qui reste devient la contrainte suivante.
- **Trois clés** : trois cristaux dans trois zones verrouillées, à ouvrir avec des fusées.

### 7.5 Élites & boss
- **Le Pendule** : quart de tour automatique à chaque tour.
- **Le Miroir** : deux moitiés à gravités opposées, aimant central.
- **La Ruche mère** : ruche à 8 activations qui pond dans toute la grille.
- **Le Sculpteur** : retire une case de la grille par tour ; finir avant qu'il n'y ait plus de place.
- **L'Écho** : chaque tap du joueur est rejoué en miroir de l'autre côté sur des billes gênantes.
- **Le Voleur** : vole la spéciale la plus puissante tous les 3 tours et la met dans une bulle à récupérer.

### 7.6 Salles spéciales
- **Boutique de run** : racheter des coups, retirer une couleur du run (définitif), améliorer une spéciale (+1 rayon), acheter un effet de niveau.
- **Atelier** : fusionner deux compétences de run en une (table de fusions à écrire, phase 3).
- **Repos** : +2 niveaux de départ dans la prochaine salle, ou retirer le malus d'une compétence.
- **Mystère** : une bulle géante au centre, on tape et on découvre (récompense, piège, élite surprise).

---

## 8. Personnages (méta)

Chacun a une rotation de base différente et un ultime de niveau 10.
- **Le Vertige** (défaut) : une rotation gratuite au début de chaque salle. Ultime : réinitialiser la grille en gardant les spéciales.
- **L'Ingénieur** : voit les fusées dormantes et peut les orienter sans coût. Ultime : toutes les spéciales deviennent des croix.
- **La Ruche** : commence avec une ruche alliée qui pond des billes de sa couleur favorite. Ultime : la ruche pond une bombe.
- **Le Cartographe** : la carte de run montre 2 niveaux de profondeur de plus. Ultime : choisir la prochaine salle librement.

---

## 9. Phases de livraison

### Phase 1 — Le cœur (objectif : c'est déjà satisfaisant)
- Grille 8×10, 5 couleurs, tap-blast, rotation 90/180 avec animation de chute physique.
- Spéciales : bombe, ligne, croix, bombe de couleur, orientées par gravité, chaînes.
- XP + niveau en salle 1 → 7 avec ~12 effets du pool (paliers 1-3 et 4-7).
- **5 salles** enchaînées linéairement (pas de carte) : normale, Puits, Marée haute, Tempête, Le Pendule (boss).
- Éléments : Bulle, Ballon, Fusée dormante.
- Écran de choix de compétence entre les salles avec ~10 compétences (Propagation ×1, Seuil abaissé, Vertige, Domino, Avidité, Cascade, Coup de trop, Fossoyeur, Prévoyance, Double amorce).
- Sons (non chiptune), particules, screenshake, mode Test avec curseur de difficulté et seed.
- Sauvegarde du run en cours.

### Phase 2 — Le run
- Carte de nœuds, acte 1 complet (~12 salles), élites, salles spéciales (boutique, repos, mystère).
- Tous les éléments de §5.
- Pool complet de compétences et d'effets 1-7.
- Boutique méta minimale (compétences permanentes, monnaie).

### Phase 3 — Profondeur
- Actes 2 et 3, tous les boss, salles à étapes, salles anarchiques restantes.
- Effets 8-10, ultimes, personnages, atelier (fusions).
- Cosmétiques, statistiques, équilibrage.

---

## 10. Structures de données (proposition — à valider avant implémentation)

```js
// Bille
{ id, couleur: 0..5, special: null|'bombe'|'ligne'|'croix'|'couleur'|'magnet', x, y, vx, vy, vis:{x,y} }

// Élément
{ type:'bulle'|'ballon'|'cristal'|..., x, y, activations:0, max:3, fixe:false, data:{} }

// Effet de niveau en salle
{ id, palier:1|2|3, nom, desc, appliquer(ctx) }

// Compétence de run
{ id, rarete:'commun'|'rare'|'epique', nom, desc, stackable:false, malus:null,
  hooks:{ onTap?, onRotation?, onSpecialCreate?, onExplosion?, onSalleStart?, onSalleEnd?, onFillLine? } }

// Salle
{ id, nom, type:'normale'|'elite'|'boss'|'etapes'|'speciale', acteMin,
  grille:{w,h,forme:'rect'|'rond'|'puits'|'double'}, couleurs:5, coups:25,
  objectif:{type, cible}, elements:[...], regles:{rotationAuto?, maree?, obscurite?, ...},
  sousSalles?:[...], recompense }

// État de run
{ seed, acte, noeud, coups, monnaieRun, competences:[], niveauSalle, xpSalle, xpTotale, grille, orientation }

// Profil méta (localStorage)
{ monnaieMeta, competencesPermanentes:[], paliersDebloques, personnages:[], cosmetiques:[], stats:{} }
```

Toutes les compétences et effets passent par un **système de hooks** central : un seul endroit dispatch les événements (tap, rotation, explosion, création de spéciale, début/fin de salle, remplissage) vers les compétences actives. Aucune compétence ne doit être codée en dur dans la logique de grille.

---

## 11. Questions ouvertes (à trancher avec Martin avant la phase concernée)

1. Rotation : tourner les données ou déplacer la gravité ? (phase 1)
2. Les murs / cages tournent-ils avec la grille ? (phase 1 si Quarantaine, sinon phase 2)
3. Le remplissage entre-t-il par le haut *visuel* ou par le haut *logique d'origine* ? (phase 1 — impacte fortement le ressenti de Marée haute)
4. La rotation coûte-t-elle un coup par défaut, ou une jauge séparée ? Prototyper les deux en mode Test. (phase 1)
5. Table de fusions de l'atelier. (phase 3)

---

## 12. Journal des décisions (à tenir à jour par Claude Code)

| Date | Phase | Décision / changement | Pourquoi |
|---|---|---|---|
| — | 0 | Document initial | — |
| 2026-09-11 | 0 | Document importé dans `Menu-hebdo/vertige/`, création de `ROADMAP.md` | Règle 8 : la feuille de route existe dès le premier commit |
| 2026-09-11 | 0 | `tools/seuils.mjs` : mesure de la distribution des tailles de groupes | Chiffrer les seuils de spéciales au lieu de les deviner (§4.3) |
