# Carnet de bord

À lire en premier au démarrage d'une session. Les consignes de travail sont
dans `CLAUDE.md`.

## Où en est le projet

- **v6.29**, branche `claude/architecte-logique-v5-vntfkp`, **255 tests verts**
  (`npm test`).
- `logicgates.html` : ~14 400 lignes, un seul `<script>`, aucune dépendance.
- Copies figées dans `versions/` (v5.1 → v6.29), avec leur tableau dans
  `versions/README.md`.
- Catalogue : **188 leçons en 36 chapitres** — 63 à table de vérité (dont 8
  boîtes noires), 85 libres, et 30 à **condition de réussite** (chapitres 31 à 34).

## Ce qui vient d'être fait

**🔧 Lot A de l'audit : ce qui se voit tout de suite** (v6.29). Les huit points
sont faits.

1. **La vérification en continu ne rejoue plus la table pour rien.** Compteur
   `logicVersion`, incrémenté dans `markDirty()` — le seul point de passage de
   toute modification du plan (56 appels). Filet de sécurité : on compare aussi
   les nombres de composants et de fils, au cas où un chemin oublierait
   `markDirty`. **Basculer un interrupteur n'invalide PAS**, et c'est voulu :
   `liveCheck` sauvegarde les entrées, pilote la table lui-même, puis les
   restaure — leur état n'entre pas dans son résultat.
2. **`compSig` voit la taille** (`bw`/`bh`) : étirer un cadre ou un mur réveille
   enfin le cache des tracés.
3. **Les cibles de clic se mesurent en PIXELS D'ÉCRAN** : `tolPin()` = 14 px
   (24 au doigt), `tolFil()` = 11 px (18). Toujours `Math.max` avec le dessin,
   sinon la zone deviendrait plus petite que la broche en vue rapprochée.
   `touchMode` suit `e.pointerType`, remis à jour au `pointermove` aussi —
   sinon un effleurement sur un portable tactile laissait les cibles larges
   pour le reste de la séance. Vérifié : 14 px d'écran à tous les zooms.
4. **Le magnétisme aussi**, avec une **hystérésis** : `ALIGN_PRISE = 8`,
   `ALIGN_LACHE = 13` pixels d'écran. `alignAccroche` mémorise à quoi on est
   collé et se remet à zéro à chaque nouveau geste. **`Alt` coupe tout.**
5. **Le câble annonce sa couleur AVANT qu'on lâche.** `canConnect(from, to)`
   rend `{ etat:'oui'|'remplace'|'deja'|'non'|'rien' }` : vert, ambre, rouge,
   plus un anneau de la même couleur sur la borne visée. Et le fil qui va être
   remplacé s'efface d'avance (38 % d'opacité).
   **T248 met le prédicteur et le juge face à face** : si `canConnect` et
   `connectWire` divergeaient un jour, l'annonce serait pire que rien.
6. **Un losange fantôme** sur le fil survolé, là où le double-clic posera une
   poignée. Sans lui, on double-cliquait à l'aveugle — et surtout on ignorait
   qu'on pouvait le faire.
7. **`elecTrop` ne renonce plus en silence** : un message une seule fois, avec
   le nombre de points et la limite.
8. ~~Les murs~~ — fait en v6.27.

**📮 Lot 10 : transmettre quelque chose** (v6.28). **LA FEUILLE DE ROUTE ⚡ EST
TERMINÉE** — la section correspondante de `CLAUDE.md` a été supprimée, comme
elle le demandait elle-même.

Cinq pièces : `MANIP` (manipulateur Morse), `DECMOR` (décodeur), `SERIE` /
`DESERIE` (émetteur et récepteur numériques série), `HP` (haut-parleur). Plus
le **chapitre 36 « Tout se tient »**, six leçons, m183 → m188.

- **La règle des séquences temporisées** : elles avancent dans `commit()`, qui
  n'est appelé QU'UNE FOIS par image (`:4942`), jamais dans `eval()`, appelé
  cinq fois (`:4935`). Et avec un `while (simNow - c.t0 >= T){ c.t0 += T; … }`,
  pas un `if` : sinon la vitesse plafonne en silence dès qu'une case dure moins
  qu'une image. Toutes s'appuient sur `simNow` (jamais plafonné, suit le
  ralenti) et se taisent quand `simulating` est vrai — sinon une vérification
  en continu ferait avancer le message.
- `seq:true` sur les quatre : sans ça, `boardCombinatoire()` les prendrait pour
  de la logique combinatoire.
- **Aucune n'est de famille `in` ni `sense`**, donc aucune n'atterrit dans
  `INPUT_TYPES` (`:8345`) — leurs montages de référence peuvent les contenir.
- **Le Morse** : une seule règle de durée, le point est l'unité, le trait en
  vaut trois, les silences une / trois / sept. `morseUnite(wpm) = 1200/wpm`
  (convention internationale sur le mot PARIS, qui vaut 50 unités). Le décodeur
  ne connaît QUE des durées — d'où la leçon : les deux bouts doivent être
  réglés sur la même vitesse, sinon les traits passent pour des points.
- **La trame numérique** : 11 cases — départ, 8 bits (poids faible d'abord),
  2 stop. Le récepteur échantillonne au MILIEU de chaque case, ce qui lui
  laisse une demi-case de tolérance d'horloge. Débit volontairement lent
  (2 à 20 bits/s) : à 60 images par seconde, un bit doit durer au moins deux
  images pour être vu.

**DEUX DÉFAUTS DU MOTEUR TROUVÉS EN CHEMIN, tous deux corrigés :**

1. **La crête d'un circuit alternatif était mesurée une fois par image.** Elle
   tombait donc à zéro quand l'image tombait pile sur un passage par zéro — et
   une image de 60 ms tombe *exactement* trois fois par période sur du 50 Hz.
   `icrete`/`pcrete` sont maintenant pris sur **tous les sous-pas**
   (`br.ipk` / `br.ppk`). Ça corrige aussi, rétroactivement, la mesure de crête
   des chapitres 33 et 35.
2. **Il n'existait aucun moyen de suivre un courant plus finement qu'une
   image.** Nouveau crochet `sous(c, dt, i)`, appelé à chaque sous-pas avec le
   courant de l'instant. C'est ce qui permet au haut-parleur de mesurer 50 Hz :
   on ne peut pas compter des alternances en regardant soixante fois par
   seconde. Et on **lisse la période, pas la fréquence** — l'inverse d'une
   moyenne n'est pas la moyenne des inverses, et ça suffisait à afficher 54 Hz
   pour du 50.

**📻 Lot 9 : l'accord et la modulation** (v6.26).

**LA DÉCISION DE FOND, prise avec l'auteur** : on ne simule PAS la porteuse, on
simule ce que la LIAISON fait au signal. Une porteuse de 100 MHz, c'est cent
millions d'allers-retours par seconde — deux millions de fois plus de points
que le moteur n'en calcule. En revanche l'accord, le désaccord, le brouillage,
l'atténuation et le bruit se modélisent exactement, et ce sont eux qu'on veut
comprendre. C'est ce que l'auteur appelait « simuler la simulation d'onde ».

- **L'accord** : `ondeAccord(df, bp) = 1/(1 + |2·df/bp|⁴)`. Cloche à flancs
  raides — 1 au centre, la moitié au bord de la bande passante, presque rien
  au-delà. L'exposant 4 (et pas 2) parce qu'un vrai poste a plusieurs étages :
  avec un exposant 2, deux stations à 200 kHz d'écart se brouillaient encore.
- **`ondeCapa(f)`** : le condensateur qu'il faudrait avec une bobine de 1 µH,
  par f = 1/(2π√(LC)). C'est la formule du chapitre 33 appliquée telle quelle,
  et elle donne quelques picofarads — les vraies valeurs. C'est ce qui relie
  le bouton d'accord au circuit LC déjà appris.
- **La modulation**, sur l'entrée `MOD` de l'émetteur : AM fait varier `_amp`
  (jamais jusqu'à zéro, `ONDE_AMMIN = .2`), FM fait varier `_fem` de
  ±excursion (75 kHz par défaut, la vraie valeur de la radio FM).
- **Le bruit, et c'est le cœur pédagogique du lot** : `snr = _uant/ONDE_UBRUIT`.
  En AM le bruit s'ajoute à l'amplitude donc au signal — grésillement
  progressif. En FM il ne touche pas la fréquence — signal parfait jusqu'au
  seuil (`ONDE_FMSEUIL = 4`), puis **décrochage brutal**. C'est l'effet de
  seuil, il est réel, et c'est ce qu'on vit en voiture.
- **Calibrage** : `ONDE_UBRUIT = .05` V, choisi pour que le grésillement
  devienne sensible au moment même où le seuil de réception est atteint.
- **La mire.** `POT` est dans `INPUT_TYPES`, donc `spawnGroup` le REFUSE dans
  une démo de mission (règle voulue : l'élève pose ses propres entrées). Un
  émetteur modulé sans rien sur MOD envoie donc une **mire d'essai** —
  `_xeff = (sin(simNow/900)+1)/2`. Les démos passent leur propre test, et
  c'est en plus une vraie commodité.
- **Chapitre 35 « Choisir sa station »**, m179 → m182.
- Au passage : les nouveaux formateurs (`fmtMetre`, `fmtMHz`, `fmtKHz`)
  écrivaient « 98,0 MHz » avec une virgule alors que tout le fichier écrit
  « 6.0 V » avec un point. Aligné sur le point.

**🧰 Réparations de l'overlay** (v6.25). Onze défauts, tous **reproduits dans
Chromium avant correction** — deux audits UI/UX indépendants, recoupés.

- **Le clavier.** Une fenêtre ouverte prend désormais la main : `modaleOuverte()`
  + `dansChamp()` en tête du gestionnaire. Avant, le filtre ne rejetait que les
  champs de saisie : **curseur sur un bouton de « Mes montages », touche Suppr,
  et un composant du plan disparaissait** (reproduit). Et Échap, filtré dès
  qu'on tapait dans un champ, ne fermait rien — alors que l'écran promet
  « Échap pour fermer » à quatre endroits, tous dans des panneaux qui mettent
  le curseur dans leur champ en s'ouvrant.
- **Les messages passaient derrière le voile** (toast 60, voile 80). Or c'est
  précisément là qu'on les déclenche : « montage enregistré », « nom déjà
  pris ». Passés à 120, et calés sur `--barh` (ils recouvraient la barre).
- **Trois identifiants en double** : `quick-head/title/hint` servaient aux DEUX
  panneaux flottants, et `getElementById` ne rend que le premier — le panneau
  « Relier à… » écrivait son titre dans celui de la recherche. **T236 scanne
  maintenant tout le balisage** : ce test aurait attrapé le bug.
- **La corbeille** était intégralement recouverte par la barre du bas sous
  1512 px de large, c'est-à-dire partout. Sur `--barh` et z 22.
- **L'énoncé** est centré, les boutons collés à droite : recouvrement dès
  1136 px (**56 px de texte mangés à 1024**, mesuré). Il cesse d'être centré à
  ce palier. Rétrécir un bloc centré ne sert à rien : ça ne libère que la
  moitié de chaque côté — c'est ce que faisait l'ancienne règle à 900 px.
- **L'en-tête perdait 174 px de boutons à 1024 px** (mesuré), inatteignables
  puisque le corps ne défile pas. Deux paliers + défilement horizontal en filet.
- **Contraste** : le blanc sur le vert de « Vérifier le circuit » donnait
  **2,62 pour 1**, le plus mauvais chiffre du fichier, sur le bouton le plus
  regardé. Dégradés assombris, on est à 5,4. (Un des deux audits affirmait que
  « le contraste n'est pas le problème » — vrai pour la palette, faux pour les
  boutons.)
- Plus : « Mes puces » défile enfin (seule fenêtre sans hauteur maximale, son
  bouton Fermer pouvait sortir de l'écran), « Sandbox libre » n'est plus peint
  en rouge (`btn-second`), le flou n'est plus appliqué deux fois, le texte des
  fenêtres se sélectionne, et `prefers-reduced-motion` coupe les animations
  **et les 160 confettis**.

**Ce qui reste des deux audits, pour la refonte de l'overlay** : sémantique de
dialogue (`role`, `aria-modal`, `aria-live`), gestion et piège du focus, cibles
tactiles à 44 px, vraie couche mobile sous 560 px, éditeur GRAFCET en petite
largeur, échelle typographique (vingt tailles aujourd'hui, dont du 7,5 px), et
la bascule éventuelle vers la balise `<dialog>`.

**📡 Lot 8 : la radio — la distance et les obstacles** (v6.24). **Phase 4
commencée.**

Premier calcul du fichier où **la position des boîtiers compte pour de vrai**.

- `solveOndes()`, juste AVANT `solveElec()` dans `simulate()`. Elle lit la
  puissance que chaque émetteur a consommée à l'image d'avant et pose sur
  chaque récepteur la tension qu'il capte. **Le décalage d'une image est
  voulu** : le récepteur est lui-même une source pour le solveur du continu,
  donc sans ce décalage c'est l'œuf et la poule.
- **La physique**, en deux lignes et deux constantes : `ONDE_PXM = 50`
  (50 px = 1 m) et `ONDE_D0 = .5`. Reçu = `Pe · (d0/d)² · ∏ atténuations`,
  puis `U = √(P·300)` — 300 Ω, l'impédance d'une antenne. Vérifié : à 1 W,
  0,77 V à 11 m, et doubler la distance divise la tension par 2 et la
  puissance par 4, au chiffre près.
- **Calibrage** : seuil du récepteur à **0,3 V** par défaut, ce qui donne une
  portée utile de ~29 m à 1 W — soit exactement une largeur d'écran. Sans ça,
  un émetteur de 1 W porte à 170 m et on ne perd jamais le signal à l'écran.
- `segCoupeRect()` : rognage de Liang-Barsky. Il n'existait **aucun**
  utilitaire d'intersection dans le fichier.
- Trois composants, famille `onde`, **sixième onglet ⚡ « La radio »** :
  `EMET` (résistance ordinaire vue du circuit — il rayonne ce qu'il consomme,
  donc mal alimenté il émet moins), `RECEP` (source de `_uant` volts derrière
  300 Ω, plus une sortie `MES` en volts et une sortie `SEU` tout-ou-rien),
  `MUR` (redimensionnable par sa poignée, comme `ZONE` — le mécanisme
  `grip`/`gripAt`/`gripMove` était déjà générique).
- `pickComp` : **un mur cède le pas**. Il est grand et volerait sinon les clics
  des pièces posées dessus. Il est aussi dessiné derrière, avec `ZONE`.
- `drawOndes()` : arceaux concentriques autour de chaque émetteur (le dernier
  marque la portée utile) et trait pointillé émetteur → récepteur, cyan si la
  liaison tient, rouge sinon. Dessiné entre la grille et les câbles.
- **Chapitre 34 « Sans fil »**, quatre leçons m175 → m178. m176 compare
  **deux** récepteurs plutôt que d'exiger un déplacement : un montage figé ne
  peut pas démontrer un mouvement (même problème que l'interrupteur de m169).

**Lot 7 bis : trois finitions signalées à l'usage** (v6.23).

1. **Les fils droits restent droits.** Deux bornes exactement en face
   donnaient bien un trait droit… jusqu'à ce qu'un deuxième câble emprunte le
   même couloir : la règle anti-superposition (`spreadRoutes`) écartait tout
   le monde, y compris lui, d'où une bosse de 5,5 px à chaque bout — et un fil
   déjà posé qui changeait de forme tout seul. Désormais `buildRoute` marque
   le fil (`w._droit`) et `spreadRoutes` en fait le **point fixe** de son
   couloir : les autres s'écartent autour de lui.

2. **Les bornes de puissance se relient dans tous les sens.** Une borne à vis
   n'a pas de sens : deux ampoules en parallèle se câblent entrée sur entrée
   et sortie sur sortie, et un voltmètre se pose aux bornes de ce qu'on veut.
   Nouvelle fonction `relierBornes(départ, arrivée)` (nommée, donc testable) :
   le sens compte toujours pour un signal ou un tuyau, jamais pour `pui`.
   Trois conséquences : cliquer une borne ⚡ déjà câblée commence un NOUVEAU
   fil au lieu de décrocher l'ancien (pour en retirer un : le survoler, Suppr) ;
   `recalcFan` distingue les deux côtés d'un même rang de broches ; et le
   **format d'enregistrement gagne un sixième champ** `sd` qui dit de quel côté
   est chaque bout — absent (0) = l'ancien cas, donc les vieilles sauvegardes
   se relisent telles quelles (`wireSide` / `wireEnds`, quatre points de
   relecture : puce, groupe, mission, bac à sable).

3. **Le condensateur revu.** Le vrai défaut n'était pas dans le moteur (la
   décharge était juste, mesurée) : c'est que **tout se passait en quelques
   millisecondes**, donc en moins d'une image. Un condensateur de 10 000 µF —
   l'ancien maximum — se vide dans une ampoule de 25 Ω en 250 ms.
   - la capacité monte maintenant **jusqu'au farad** (le supercondensateur
     existe pour de vrai), sur une **glissière logarithmique** : nouveau champ
     `log:true` sur une option, plus `paramFrac` / `paramVal` / `paramArrondi`
     (deux chiffres significatifs) et `disp` pour afficher « 22 mF » au lieu
     de « 22000 µF ». `INDUC.ind` en profite aussi.
   - le boîtier affiche un **chrono du dernier remplissage** (⏱ 50 ms), en
     rouge sous 0,2 s, avec le conseil dans l'infobulle. Il est MESURÉ, pas
     calculé : le chronomètre tourne tant qu'un courant notable passe.
     **Deux seuils** (démarrer à 50 % de la crête, continuer jusqu'à 12 %) —
     avec un seuil unique, le courant résiduel de fin de charge, arrondi à
     0,1 mA, clignotait autour et relançait un chrono qui écrasait la mesure.
   - `c._upk` et `c._vide` : « il a été chargé, puis il est retombé sous le
     tiers ». C'est ce qui permet à m169 d'exiger une VRAIE décharge.
   - **m169 refaite** : interrupteur, 22 000 µF, ampoule 4,5 V / 0,8 W. Vérifié
     dans Chromium : plein à 4,33 V, on ouvre, 1,04 V à 0,6 s, éteint à 2,6 s.
   - `joueMontage` (harnais) **manœuvre** maintenant les interrupteurs de
     puissance au milieu de la course et les remet comme il les a trouvés :
     un montage de référence qu'on ne manœuvre jamais ne peut pas démontrer
     une décharge.

**⚡ Lot 7 : trier le courant** (v6.22). **Phase 3 terminée.**

- `DIODE` et `PONT` redresseur : les premiers composants NON LINÉAIRES de
  l'atelier. Ils entrent dans la boucle d'essais qui servait déjà à la
  limitation de courant (portée de 6 à 12 tours : un pont a quatre diodes,
  dont deux basculent à chaque alternance).
- La **résonance** ne demandait aucun composant : bobine + condensateur +
  générateur suffisaient. Vérifié dans Chromium — sur un LC de 2 H et 200 µF,
  le pic tombe à 8 Hz pour une théorie à 7,96 Hz.
- **Chapitre 33 « Le courant alternatif »**, huit leçons (m167 → m174), de
  « le courant qui change de sens » à « fabriquer du continu ».
- Cinquième onglet ⚡ **« L'alternatif »** et famille `alt` : GENEAC, CONDO,
  INDUC, DIODE, PONT. « Le continu » débordait à douze tuiles.
- `c.icrete` / `c.pcrete` : la crête récente, qui s'efface doucement. Sans
  elles, impossible d'écrire une condition de réussite sur un circuit qui
  pulse — au moment du contrôle, une sinusoïde peut passer par zéro.
  `ckPulsees(part)` s'en sert.

**Le tracé des câbles, deux défauts de fond** (v6.21). Mesuré sur les 722
câbles de tous les montages livrés : **traversées 61 → 10**, **pire détour
282 → 114 px**.

1. `bypassY` n'avait que deux choix : au-dessus de TOUT, ou en dessous de
   TOUT. Il ne savait pas se faufiler ENTRE deux obstacles — un fil dont les
   deux bornes étaient à la même hauteur grimpait de 186 px et survolait
   l'écran entier pour éviter deux ampoules entre lesquelles il y avait toute
   la place. Il cherche maintenant le **couloir libre le plus proche**
   (`bouchons()` fusionne les bandes occupées ; `bypassY` prend le meilleur
   couloir). Et il **serre sa marge** (26 → 16 → 10 px) plutôt que de renoncer
   quand tous les couloirs sont trop étroits.
2. Le chemin vers l'AVANT ne regardait rien : un fil traversait tranquillement
   un boîtier posé entre ses deux bornes dès qu'elles étaient à la même
   hauteur. `barreH` / `barreV` le vérifient désormais avant de tracer.

**⚡ Lot 6 : l'alternatif** (v6.20). Phase 3 entamée. Trois morceaux :

1. **Une horloge pour le circuit.** Le simulateur lisait l'heure de la machine
   à 54 endroits ; 45 lignes sont passées sur `simNow`. Deux temps cohabitent
   désormais : l'AFFICHAGE (animations, clignotements — vraie montre, toujours)
   et la SIMULATION (`simNow`, que le ralenti étire). Le bouton ⏱ de l'en-tête
   cycle ×1 / ×10 / ×100 et ralentit **tout** — vérifié : une temporisation
   d'une seconde demande douze secondes réelles en ×10.
2. **Les sous-pas.** `solveElec` découpe l'image en jusqu'à 32 pas dès qu'une
   branche a de la mémoire ou réclame de la finesse. Sans elles : **un seul
   pas**, calcul identique à avant.
3. **`CONDO`, `INDUC`, `GENEAC`** (sinus / carré / triangle, jusqu'à 100 Hz),
   et l'oscilloscope qui échantillonne au sous-pas, fenêtre jusqu'à 20 ms.

**⚡ Énergie & ondes, lot 1 sur 10 : le socle du continu** (v6.11). L'atelier
🔌 n'est plus grisé. Il contient quatre composants — `PILE`, `INTERP`
(interrupteur de puissance), `LAMPE` (ampoule à filament), `MASSE` — et un
**vrai solveur nodal** qui résout tout le circuit d'un coup.

Ce qu'on peut faire : la boucle pile → interrupteur → ampoule → masse → pile.
Deux ampoules en parallèle et la pile s'affaisse, visiblement. On ouvre la
boucle et tout s'éteint.

**⚡ Lot 5 : produire autrement, et rejoindre le Process** (v6.19). Phase 2
terminée. `CHAUD` (la chaudière — elle n'avait JAMAIS été écrite, la feuille de
route la promettait depuis le début), `TURBINE` à vapeur avec régulateur,
`SOLAIRE` (source de COURANT, qui voit les ampoules posées à côté de lui),
`SEEBECK` (thermopile). Chapitre 32, huit leçons.

**Six onglets débordaient de l'écran**, dans les trois ateliers (`calc` et
`act` en avaient seize). Dégonflés : deux onglets de plus (« Données & bus »,
« Procédés ») et une règle nouvelle — un composant rangé À LA MAIN dans un
onglet n'est plus rangé une seconde fois par sa famille. Un onglet marqué
`emprunt:true` fait exception (il emprunte sans priver l'atelier d'origine).

**v6.18 — l'atelier ⚡ passe à quatre onglets** : Le continu (8), Mesure (3),
Produire (3), Câblage (7). Une seule rangée de quinze tuiles débordait de
l'écran, et l'auteur ne retrouvait plus l'aimant. Trois familles nouvelles
(`mesu`, `prod`, `wirp`) avec chacune sa section de guide.

**⚡ Lot 4 : produire du courant** (v6.17). `AIMANT` (se promène à la souris,
aucune borne — il agit par sa position), `BOBINE` (loi de Faraday : la tension
suit la VITESSE à laquelle le champ change ; immobile au centre = zéro), et
`DYNAMO` à manivelle qu'on tourne à la souris, dont l'effort et le retard sur
la main augmentent avec la charge. Deux jauges côte à côte : effort fourni et
électricité produite. L'oscilloscope montre enfin le NÉGATIF (il écrêtait) —
sans quoi la moitié de l'alternatif était invisible.

**⚡ Lot 3 : le chapitre du continu** (v6.16). Le **chapitre 31 « Le courant
continu »**, dix leçons à la fin du catalogue, chacune avec son montage de
référence et sa **vraie condition de réussite** — c'est le premier chapitre où
« Vérifier » regarde le circuit au lieu de croire le joueur sur parole. Quatre
**montages d'exemple ⚡** dans le menu 📦 (la boucle, le banc de mesure, le
variateur, les deux barres et un fusible).

**v6.15 — le câblage de l'atelier ⚡, et le fusible.** L'onglet Câblage de
l'atelier énergie est maintenant le sien (`wirep`) : les barres et le tunnel de
PUISSANCE en tête, ceux de signal en dessous pour les sorties de mesure.
Avant, il n'offrait que les rails logiques, qui refusent la puissance à juste
titre — d'où la confusion. Les barres de puissance sont aussi **redessinées**
en jeu de barres épais à têtes de vis hexagonales, impossibles à confondre avec
le mince liseré ambre du rail de signal. Et quand on se trompe malgré tout, le
message de refus **nomme le jumeau à prendre**.

Nouveau composant : le **FUSIBLE** (calibre réglable, fond au-delà, se remplace
au clic).

Les deux mécanismes du chapitre :
- `m.check(components, wires)` — la troisième façon de gagner, pour les leçons
  sans table de vérité. Rend `true`, ou **la phrase qui dit ce qui manque** —
  c'est elle que le joueur lit, donc elle doit être utile, pas décorative.
  Vocabulaire d'appui : `ckTous`, `ckUn`, `ckAllumees`, `ckSources`,
  `ckDebite`, `ckBoucle`, juste avant `const missions`.
- `m.dom` — l'atelier de la leçon ; `loadMission` y bascule tout seul.
**T207 est le garde-fou du chapitre** : il pose le montage de référence de
chaque leçon et exige qu'il passe sa propre condition. Toute nouvelle leçon à
`check` doit y survivre.

**v6.14 — confort et câblage.** Rail et tunnel de puissance (`RAILP4`,
`RAILP8`, `TUNP`). Le **clic simple sélectionne** (et actionne toujours le
composant), **Maj + glisser duplique**, **Ctrl+X** coupe. Le tracé des câbles
corrigé sur trois points de plus (voir « Décisions »).

**⚡ Lot 2 : mesurer, régler, regarder** (v6.13). Sept composants :
`RESIS` (anneaux de couleur), `POTP` (potentiomètre à trois bornes, un vrai
diviseur), `VOLT`, `AMP`, `GENE` (alimentation réglable à la souris avec
limitation de courant), `OSCILLO` (deux sondes de tension + une entrée de
mesure, base de temps réelle), et le court-circuit signalé.

**v6.12 — les trois défauts trouvés par l'auteur en essayant le lot 1**, tous
corrigés : les câbles qui serpentaient (trois causes, dont un vieux bug
d'écartement cumulatif qui touchait TOUS les domaines), l'éclat des ampoules
qui se figeait au-delà de deux, et le circuit qui refusait de fonctionner sans
masse. Voir « Décisions » ci-dessous.

Avant ça (v6.8 → v6.10) : la refonte de l'affichage en trois lots — bandeau
`#enonce`, `#infos` repliable, `#actions` ; cartouche de leçon posé sur le
plan ; sommaire devenu carte du cours.

## Décisions qui expliquent le code

- **Une diode s'ouvre sur la TENSION et se ferme sur le COURANT.** Fermer sur
  la tension aussi faisait osciller les quatre diodes d'un pont entre deux
  états au passage par zéro : le calcul s'arrêtait au bout de ses douze tours
  sur un état incohérent, et la sortie plongeait à −0,6 V.
- **`poseDiode` écrit `br.g` et `br.e` DANS la branche**, pas seulement dans
  la matrice. Première version : la matrice était juste, mais le bloc qui
  publie les résultats relisait la résistance d'origine et annonçait −12 A à
  contresens. Toute non-linéarité doit poser ses valeurs pour de bon.
- **Le `−` d'un pont redresseur est une ENTRÉE.** Déclaré en sortie, le
  montage était incâblable : on ne branche pas une sortie sur une sortie, et
  le courant doit bien revenir quelque part.

- **Le solveur tourne AVANT les passes, une seule fois.** `solveElec()` est
  appelé en tête de `simulate()`, pas dans la boucle des 5 passes. Les
  composants de puissance ne calculent donc rien dans leur `eval()` : ils
  *déclarent* leur branche (`branche(c)` → `{a, b, r, e}`) et lisent ensuite
  `c.u`, `c.i`, `c.p` que le solveur a posés. Deux conséquences : le résultat
  ne dépend pas de l'ordre des composants, et les mesures qui en découlent
  n'ont aucun retard.
- **Toute source a une résistance interne** — sans exception. C'est ce qui
  permet de remplacer chaque générateur par un courant en parallèle d'une
  conductance : le système ne contient alors que des conductances, sans le
  moindre cas particulier. Une pile parfaite (`ri = 0`) casserait le calcul ;
  `ri` est borné à 0,05 Ω minimum.
- **Une borne de puissance accepte plusieurs fils.** La règle « une entrée,
  une seule arrivée » ne vaut plus pour le `kind === 'pui'` : c'est une borne
  à vis, tout ce qui s'y raccorde n'est qu'un seul point électrique. C'est ce
  qui rend le rail de masse utilisable.
- **Les bornes de puissance ne sont pas remises à zéro entre les passes**
  (ligne du `forEach` de `simulate`), sinon les tensions posées par le solveur
  seraient effacées avant d'être lues.
- **Deux variables de temps, et pas une.** `simNow` (l'horloge du circuit)
  n'est **PAS** plafonnée : les temporisations comparent des échéances, et un
  plafond leur ferait rater un saut dans le temps — c'est ce qui a permis aux
  48 tests qui pilotent `Date.now` de passer sans être touchés. `simDt` reste
  plafonné à 200 ms : il sert à intégrer, un pas énorme ferait diverger.
  Restent en temps réel, à raison : dates de sauvegarde, annulation, appui
  long, dé du composant ALÉA, cadence du panneau d'aide, export PNG.
- **Le modèle compagnon met la mémoire dans le moule existant.** Sur UN pas de
  temps, un condensateur se comporte comme une résistance en série avec une
  pile (`r = dt/C`, `e = −u_précédent`) ; une bobine pareil (`r = rs + L/dt`,
  `e = (L/dt)·i_précédent`). Le solveur ignore donc jusqu'à leur existence.
  Méthode d'Euler implicite : elle ne s'emballe jamais, même à pas grossier —
  une méthode plus fine ferait osciller l'affichage au moindre réglage.
- **Une branche peut réclamer un pas de temps.** `br.dtMax` : le générateur
  alternatif demande 1/(40·hz), soit quarante points par période. `br.dyn`
  dit que sa tension change à chaque sous-pas, et le crochet `pas(c, dt)` la
  recalcule. `avant(c)` ne fait plus qu'exposer la valeur de l'instant — c'est
  `pas` qui fait avancer la phase, sinon les 32 sous-pas verraient tous la
  même tension et l'onde redeviendrait un escalier.
- **`elecSous`** vaut 0 quand aucune mémoire n'est sur le plan : c'est la
  garantie que l'existant est inchangé, et c'est aussi ce qui empêche
  l'oscilloscope de compter deux fois ses points.
- **Trois causes de plus au « les câbles font n'importe quoi »**, corrigées en
  v6.14 :
  1. `recalcFan` ne classait les fils que par borne de DÉPART. Deux fils qui
     rejoignent le même côté d'un composant (les deux entrées d'un voltmètre)
     prenaient la même colonne d'approche et la même hauteur de contournement.
     Il y a maintenant un `fanIn`, rang d'ARRIVÉE, qui allonge l'amorce
     d'arrivée et écarte la ligne de contournement. Ne jamais l'appliquer dans
     le cas `enFace`, sinon un montage droit se remet à décrocher (T192b).
  2. `spreadRoutes` regroupait par CASE FIXE de 11 px : deux fils distants de
     3 px pouvaient tomber de part et d'autre d'une frontière et n'être jamais
     écartés. C'est maintenant un regroupement par voisinage. `WIRE_ECART` est
     passé de 7 à 11 px — il faut dépasser le halo de 8 px d'un câble de
     puissance.
  3. `bypassY` ne regardait que les DEUX boîtiers reliés : un composant posé
     entre les deux était invisible et le fil lui passait dessous. Elle survole
     maintenant tout ce qui se trouve sur le passage. Conséquence : le cache
     des tracés dépend de la position des autres composants — d'où `compSig()`,
     une signature grossière du plan recalculée une fois par image.
- **Le clic simple sélectionne ET actionne.** Ne jamais supprimer l'appel à
  `clickComp` dans le `pointerup` : c'est lui qui bascule les interrupteurs, et
  T56 le vérifie. Maj ou Ctrl + clic ne fait QUE (dé)sélectionner, sans
  actionner. Maj + glisser passe par `dupliquerPourGlisser`.
- **Un montage de référence doit être JOUABLE, pas seulement bien câblé.** T207
  place la démo de chaque leçon ⚡, puis **joue le montage** (promène les
  aimants dans les bobines, tourne les manivelles, laisse le temps passer) et
  exige que la condition de réussite soit remplie. C'est ce test qui a révélé
  que `spawnGroup` REFUSE de coller un interrupteur dans une leçon (les entrées
  sont fournies par l'énoncé) : un montage de référence ne peut donc pas en
  contenir. D'où la chauffe à la main de la chaudière.
- **La turbine a un régulateur**, comme les vraies : sous charge elle ouvre la
  vapeur pour tenir sa vitesse. Tant que la chaudière suit, la vitesse ne bouge
  presque pas — c'est la consommation qui monte. Quand la chaudière ne suit
  plus, tout s'écroule d'un coup. C'est la leçon m163.
- **Les sources qui dépendent du temps préparent leur tension dans `avant(c)`**,
  appelé une fois par image en tête de `solveElec` — pas dans `branche`, qui
  doit rester pure (elle est rejouée à chaque tour de la limitation de courant).
  C'est là que sert `simDt`.
- **`manipHit` / `manipMove` / `manipEnd`** : une pièce qui se MANŒUVRE à la
  souris (la manivelle) au lieu de se régler. Le boîtier se déplace toujours
  par ses bords. `libre:true` sur un composant le dispense de la grille et des
  guides d'alignement — indispensable pour l'aimant, dont le geste EST la
  physique.
- **La main TIENT la manivelle tant que le bouton est enfoncé.** Trois pièges
  successivement rencontrés, tous les trois corrigés : (1) un ressort sans
  amortisseur fait osciller le volant jusqu'à se faire doubler d'un tour ;
  (2) la souris n'envoie pas un événement par image, donc la vitesse de la main
  doit être LISSÉE, sinon l'amortisseur freine une image sur deux ; (3) l'effort
  affiché doit être l'énergie réellement absorbée (électricité + frottements),
  pas « couple de la main × vitesse », sinon les à-coups du poignet le font
  osciller et les deux jauges ne se ressemblent plus.
- **Un composant peut déclarer PLUSIEURS branches.** `branche(c)` rend soit un
  objet, soit un tableau. Le potentiomètre en a deux, de part et d'autre de son
  curseur — c'est ce qui en fait un vrai diviseur. Les branches au-delà de la
  première rangent leur résultat dans `c.brs[k]`, pas dans `c.u`/`c.i`.
- **La limitation de courant force à itérer.** Une source qui limite n'est pas
  linéaire : on résout, on regarde qui a franchi sa limite, on la remplace par
  une source de courant et on recommence (6 tours maximum). `br.mode` dit dans
  quel régime elle est, `c.limite` le publie pour l'affichage. Le relâchement
  se fait quand la tension demandée redescend sous la consigne.
- **`POT` était déjà pris** par le potentiomètre de mesure du Process
  (`defSensor('POT')`). Le nouveau s'appelle `POTP`. Vérifier les collisions
  d'identifiants avant d'écrire un `defComp` : l'écrasement est silencieux et
  fait tomber une dizaine de tests d'un coup, très loin de la cause.
- **La masse n'est PAS nécessaire.** Erreur du premier jet, corrigée en v6.12 :
  le solveur refusait de calculer sans masse, et une masse abandonnée dans un
  coin suffisait à réveiller le circuit. Désormais chaque circuit indépendant
  posé sur le plan choisit son propre zéro — la masse si elle en fait partie,
  sinon le `−` d'une de ses sources. La leçon « un circuit est une boucle »
  vient de la boucle ouverte, pas de l'absence d'un symbole.
  `elecOn` dit si le solveur a du travail (il sort immédiatement quand aucun
  composant de puissance n'est sur le plan — coût nul pour l'existant).
- **Toutes les bornes de puissance sont à la même hauteur** (`ENER_Y = 40`, via
  `enerPinPos`), quelle que soit la taille du boîtier : sans ça, deux
  composants côte à côte n'ont jamais leurs bornes en face et le fil décroche.
  Un composant qui pose ses bornes lui-même doit aussi les étiqueter lui-même
  (`enerLabels`) — le rendu générique ne le fait plus pour lui.
- **`spreadRoutes` repart de `_raw`, jamais de `_rp`.** Bug historique trouvé
  en v6.12 : l'écartement des couloirs relisait le tracé DÉJÀ écarté et
  s'ajoutait à chaque image. Les fils dérivaient selon l'historique
  d'affichage. C'était la cause principale des « câbles qui font n'importe
  quoi », toutes familles confondues.
- **L'éclat d'un filament suit la puissance^2,2**, pas la puissance. Sinon la
  baisse d'éclat quand on ajoute des ampoules en parallèle passe sous le seuil
  de perception. La couleur va du rouge-orangé au blanc chaud (`filColor`) :
  c'est le levier visuel le plus efficace, et il est physiquement juste.

## Pièges du fichier (durement acquis)

*(Les règles de travail — vérifier dans Chromium, ancrer les scripts,
nettoyer avant de committer — sont dans `CLAUDE.md`. Ici, les faits sur le
fichier lui-même.)*

1. Le stub de test renvoie **toujours** `[]` pour `querySelectorAll` et **des
   zéros** pour `getBoundingClientRect` ; `requestAnimationFrame` ne tourne
   pas, donc `render()` n'est jamais appelée en test. Un code testable est un
   code en **fonctions nommées** appelables directement.
2. Attention aux **apostrophes typographiques** `’` dans les ancres de
   recherche : le fichier en contient des vraies, pas des `'`.
3. `bw`/`bh` sont des **getters** qui tiennent compte de la rotation ; `w`/`h`
   sont les valeurs brutes. Pour tout rectangle, c'est `bw`/`bh`.
4. Trois ids sont **dupliqués** dans le HTML (`quick-head`, `quick-title`,
   `quick-hint`, dans `#find` et `#quick`). Bug latent, ne pas s'en inspirer.
5. **Les nouvelles leçons s'ajoutent à la FIN du tableau `missions`.** T178,
   T179 et T48 supposent que la première leçon du cours est celle d'aujourd'hui.
6. Un composant ajouté au registre doit être **complet** (nom, nom court,
   famille, icône, couleur, w/h ≥ 40, entrée de guide de plus de 40 signes,
   présence dans un onglet) : T66 et T57 le vérifient tout seuls. Une nouvelle
   famille exige une entrée dans `FAM_SECTIONS`, sinon son guide n'est jamais
   rendu et T57 tombe.

## Défauts connus, à corriger plus tard

- **Il reste 10 câbles qui traversent un boîtier** (sur 722) et 339 avec un
  demi-tour, dont la plupart sont légitimes (une cible derrière soi impose un
  contournement). Les cas restants viennent des approches VERTICALES (broches
  en haut ou en bas d'un boîtier), que `barreH`/`barreV` ne couvrent pas
  encore. Script de mesure : `mesure.js` dans le bac à sable de la session —
  à réécrire si besoin, il compare deux versions du fichier.
- **`spreadRoutes` écarte dès que deux câbles se frôlent en un point.** Un
  écartement qui ne tiendrait compte que des recouvrements sur la LONGUEUR
  serait moins bavard. Non fait, c'était le troisième point du lot câbles.
- **Le routage A\* proposé pour le bouton « Ranger les câbles »** : bonne idée,
  mais il faudrait une carte d'occupation (router séquentiellement en
  pénalisant les cases déjà prises), sinon tous les fils prennent le même
  chemin optimal et se superposent. `bypassY` ne doit PAS être touché : elle
  sert au tracé vivant, pas au bouton.

- **Dans un cadre de commentaire (la « zone »), on ne peut pas tirer de câble
  entre deux composants.** Signalé par l'auteur. Le cadre doit intercepter le
  geste de câblage — regarder le `pointerdown` du canvas et la façon dont
  `ZONE` capte le clic (`hit`, `noDrag`, ordre de dessin : les cadres passent
  derrière, mais le test de survol les voit peut-être en premier).

- **Le cartouche du tuteur recouvre le schéma sur sa dernière page.** Vu en
  v6.16 sur la leçon m152 : à la page du « pourquoi », plus aucune cible n'est
  désignée, et `placeLecon()` n'a donc plus rien à éviter — il se pose au
  milieu, sur les composants. Pas bloquant (on le déplace à la main). Piste :
  à défaut de cible, éviter l'encombrement de TOUS les composants.

## L'AUDIT DU MOTEUR — vérifié, chiffré, et en grande partie à NE PAS suivre

Deux visions techniques (ChatGPT, Gemini) ont été recoupées et **vérifiées ligne
par ligne, avec des mesures**. Le résultat principal : l'essentiel de ce qu'elles
proposent résout des problèmes que cette application n'a pas.

**Les chiffres de référence, à ressortir avant tout chantier de performance :**
- les 129 montages livrés font en moyenne **5,3 composants / 6,1 fils** (le plus
  gros : 12 / 15) ;
- profondeur logique des 58 solutions : médiane **3 étages**, maximum 8 ;
- le moteur ENTIER coûte **0,285 ms sur les 16,7 ms d'une image** (1,7 %) à
  30 composants / 40 fils, et 0,73 ms sur un pire cas de 200 composants ;
- **la plus grosse matrice électrique de tout le catalogue fait 3 × 3.**

### Ce qui est vraiment cassé (mesuré, par gravité)

1. **`liveCheck` fait sauter des images.** Toutes les 700 ms, `liveTick`
   (`:13753`) rejoue toute la table de vérité **même si rien n'a changé** :
   mesuré **20,2 ms** sur 29 composants / 49 fils, contre 0,06 ms pour une
   image temps réel. C'est de loin la dépense la plus lourde du fichier — plus
   que tous les autres points d'optimisation réunis. Correction : un compteur
   `logicVersion` invalidé sur connexion / suppression / ajout / réglage / **et
   basculement d'interrupteur** (sinon le retour en direct décroche du joueur).
2. **L'anneau d'inverseurs bat à la fréquence de l'ÉCRAN.** Mesuré avec
   `simulate(5)` : 3, 5 et 9 inverseurs donnent tous `10101010…`, une bascule
   par image. Or un anneau de 9 portes est trois fois plus lent qu'un anneau de
   3. C'est la seule fausseté du moteur logique qui se voie.
3. **Une entrée oubliée est indiscernable d'un zéro** (`:4925`,
   `pin.state = 0`). Le piège le plus coûteux en temps pour un élève.
4. **Le sens du courant dessiné sur les fils de puissance est arbitraire**
   (`:1782`, `this.inPin.comp.i`). Pire depuis `relierBornes` (v6.23) : « inPin »
   n'est plus que le bout cliqué en second. Faux dès qu'il y a une dérivation.
   → Correction saine : animation symétrique dont seule la VITESSE dépend de
   l'intensité. Ne PAS tenter les courants de branche : le solveur raisonne par
   nœuds, il ne les connaît pas.
5. ~~**Un mur faisait dévier les câbles**~~ — **CORRIGÉ v6.27** (`DECOR`).
6. **Aucune accessibilité clavier ni lecteur d'écran** — 0 `aria-label`,
   0 `tabindex`, 0 `role`. Chantier à part.
7. **Zones de clic minuscules au zoom reculé** : broche 13 unités MONDE
   (`:1285`) = 4,6 px à zoom 0,35 ; fil 9 (`:1997`) ; poignée au double-clic 10
   (`:5222`). Et `ALIGN_SEUIL = 7` en monde (`:16462`), sans hystérésis, sans
   `Alt` (0 occurrence dans le fichier).

### Trois défauts qu'AUCUNE des deux visions n'avait vus

- **`compSig` ignore la taille** (`:1449` — seulement `x`, `y`, `id`) :
  redimensionner un cadre ou un mur ne réveille pas le cache des tracés.
- **Une bascule RS en portes est jugée « combinatoire »** : `boardCombinatoire()`
  (`:13697`) teste une LISTE DE TYPES (`SEQ_MARKERS`), pas la présence d'un
  cycle. Vérifié : deux NOR rebouclés → `true`. La vérification en continu la
  traite donc comme une table de vérité figée.
- **`elecTrop` échoue en silence** (`:4746`) : au-delà de 160 nœuds plus rien
  n'est résolu et aucun message n'est affiché.
- Bonus : **un tunnel coûte une passe entière de retard** (`:10068`,
  `c.val = TUN_PREV[n]`).

### Ce qui est VRAI mais sans aucune conséquence à cette échelle

À ne pas entreprendre, et à ressortir si la question revient :
tri topologique + Tarjan à la place des 5 passes (33 ms de stabilisation sur le
circuit le PLUS profond du catalogue — invisible) · index amont/aval pour la
vitesse (0,05 ms/image) · `spreadRoutes` (0,089 ms, et **le cache de tracé existe
déjà**, `:1561`) · `compSig` (**0,0008 ms**) · hachage spatial pour le survol
(0,144 ms) · séparation compilation/résolution du solveur (noyée dans 0,06 ms) ·
solveur creux ou Gauss-Seidel (**matrices 3 × 3**) · pré-calcul des ondes ·
couches Canvas multiples (gain non démontré — mesurer le DESSIN dans Chromium
d'abord, c'est le seul poste non chiffré).

### Ce qui est faux ou déjà fait dans les deux visions

- « le retour de mission dit où, pas pourquoi » → **déjà fait** (`:13746`,
  `:13678`) ;
- « ajouter un mode suivre le signal » → **à moitié fait** (`focusSet` +
  `neighbourhood(comp, 3)`, `:16090`) ;
- « `openQuick` s'ouvre à tort » → **déjà protégé** par `moved` (`:5155`) ;
- « 3 px au zoom mini » → 4,6 px, le zoom s'arrête à 0,35 (`:1197`) ;
- Gemini : « une seule passe hors éléments séquentiels » → **casserait**
  l'anneau d'inverseurs et la bascule RS en portes. ChatGPT avait vu le piège.

### Le plan retenu, en trois lots (à faire APRÈS le lot 10)

**Lot A — ce qui se voit tout de suite : FAIT, v6.29.**
**Lot B — dire la vérité sur les signaux** (effort gros, risque moyen) : index
amont/aval (comme OUTIL, pas comme optimisation) · `pin.status`
`valid/floating/conflict` (exceptions : broches masquées de rail, bornes de
puissance, entrées optionnelles) · conflits de tunnels · sens du courant ·
détection de cycle réelle dans `boardCombinatoire` (passer les 63 leçons à
table de vérité au crible d'abord) · cône causal · « suivre le signal » au clic
droit.
**Lot C — le temps du circuit** (effort moyen, risque ÉLEVÉ sur un point) :
pause sur `visibilitychange` (**ne PAS plafonner `simNow`** : décision
documentée, et `post.js:5257` l'exige) · transport ⏸ ⏭ ▶ · **délai de porte
simulé** — une passe par tranche de temps de circuit plutôt que 5 par image,
pour que l'anneau de 5 batte plus lentement que celui de 3. Ce dernier point
touche TOUT (bascules, GRAFCET, procédés, tunnels, 246 tests) : à livrer seul,
avec T207 comme garde-fou.

## Chantiers demandés, hors feuille de route

- **Refonte complète de l'overlay, APRÈS la phase 4.** Demandé explicitement.
  L'overlay, c'est tout ce qui flotte au-dessus du plan : l'en-tête et ses
  treize boutons, le bandeau `#enonce`, la colonne `#actions`, le bloc
  `#infos`, le cartouche de leçon, le bandeau de victoire, la barre du bas.
  Ça s'est empilé lot après lot sans jamais être repensé d'un bloc.
  **Avant de coder, demander à l'auteur ce qui le gêne précisément** — la même
  erreur que pour la barre du bas serait de refondre à l'aveugle.

- **VISION D'ENSEMBLE POUR LA REFONTE DE L'OVERLAY** (donnée par l'auteur,
  à garder telle quelle jusqu'à la refonte). Direction : une interface de
  logiciel métier moderne — très peu de commandes toujours visibles, les
  fonctions avancées au bon endroit et au bon moment, le plan de travail
  clairement principal.

  **En-tête épuré** : `⚡ ARCHITECTE LOGIQUE · Chap.12 · XOR   ↶ ↷ 🔍 💾 ⋯`.
  Tout le reste passe dans le menu `⋯`, rangé en cinq sections : AFFICHAGE
  (grille, noms, mini-plan, focus, recentrer) · SIMULATION (lecture, pause,
  un pas, vitesse) · CIRCUIT (analyser, organiser, ranger les câbles) ·
  FICHIER (montages, exemples, PNG, importer) · AIDE (guide, raccourcis,
  tutoriel).

  **Ctrl+K, centre de commande** : composants, leçons, commandes, montages,
  exemples, outils, aide — une seule entrée qui évite d'ajouter un bouton à
  chaque nouveauté.

  **Barre du bas à deux niveaux maximum** : un sélecteur d'atelier compact
  (`⚡ Électronique ▾`) puis les catégories, avec « ★ Rapide » en page
  d'accueil (favoris épinglés + derniers utilisés + les plus fréquents).

  **Panneau de mission compact** : titre, une phrase, l'objectif, `[Vérifier]`.
  Le reste (table de vérité, contraintes, indice, solution) se déplie.

  **Écran de performance après réussite** : étoiles, portes utilisées contre
  optimal, objectifs secondaires, `[Comparer avec l'idéal]`.

  **Comparaison avec la solution sur le plan** : solution en fantômes, vert =
  équivalent, ambre = inutile, cyan = manquant, plus un panneau qui explique.

  **Diagnostic cliquable** : entrée inutilisée, branche isolée, simplification
  possible — un clic centre la caméra et surligne.

  **Le reste** : isoler le chemin d'un signal, mode focus plein écran,
  alignement et espacement façon Figma, `🪄 Organiser le circuit` (auto-layout
  entrées → logique → mémoire → sorties), inspecteur latéral à sections
  repliables, clic droit court et contextuel, mini-plan seulement quand utile,
  panneau de transport de simulation (⏮ ⏸ ⏭ ×1), chronogramme optionnel,
  vraie UX mobile (feuille du bas, appui long, pincement), historique de
  versions dans « Mes montages », onboarding interactif, astuces contextuelles.

  Quatre vagues proposées : 1) dépolluer · 2) fluidifier · 3) renforcer le
  pédagogique · 4) fonctions avancées.

  **CE QUI EXISTE DÉJÀ — vérifié dans le code, à ne pas redévelopper :**
  mini-plan (`drawMini`, `miniClick`), guides d'alignement (`alignGuides`),
  mise en évidence du voisinage au survol (`focusSet`, dès 10 composants),
  favoris + fréquence d'usage (`favPins`, `favFreq`), recherche dans tout le
  catalogue (barre du bas), analyseur (`#analyze-modal`), « Ranger les câbles »
  (`btn-route` → `autoRoute`, aussi au clic droit), système d'étoiles au nombre
  de portes (`m.par` + `progress.best`), ralenti ×1/×10/×100, export PNG,
  montages, exemples, guide, menu contextuel (`#ctxmenu`), et la solution
  posée en direct sur le schéma.
  **N'existe pas** : Ctrl+K, le menu `⋯`, pause / un pas, l'auto-layout des
  composants, l'écran de performance, le diagnostic cliquable, l'inspecteur
  latéral, l'historique de versions, l'onboarding, le chronogramme global.

  **MON AVIS FRANC, à relire avant de coder :**
  1. **L'en-tête est le bon premier chantier** : 11 boutons + logo + pastille,
     c'est exactement ce que les deux audits ont mesuré comme débordant. Passer
     à cinq commandes règle l'encombrement ET la surcharge d'un seul geste.
  2. **Attention à `⋯`** : cinq sections × cinq entrées = vingt-cinq lignes
     dans un menu déroulant, c'est-à-dire le même problème déplacé. Le critère
     de ce qui reste visible doit être la FRÉQUENCE d'usage, pas le rangement :
     dans cette appli, « ralenti » et « ranger les câbles » servent en
     permanence, autant qu'annuler/refaire.
  3. **Ctrl+K est un geste d'expert** — l'auteur ne code pas, et ses lecteurs
     encore moins. Excellent comme accélérateur, dangereux comme rangement :
     règle à tenir, **rien ne doit exister UNIQUEMENT dans Ctrl+K**.
  4. **L'écran de performance : garder ce qui se mesure.** Portes utilisées
     contre optimal (objectif, déjà là) et « aucun câble croisé » (mesurable,
     le compteur de traversées existe depuis le lot câbles). En revanche
     « lisibilité : bonne » est un jugement esthétique de la machine : difficile
     à rendre juste, et une note fausse enseigne le contraire de ce qu'on veut.
  5. **`🪄 Organiser le circuit` est le morceau le plus lourd de la liste**
     (placement en couches + réduction des croisements). Il vaut le coup, mais
     c'est un lot à lui seul, pas une ligne de la vague 2.
  6. **Le chronogramme fait double emploi** avec l'OSCILLOSCOPE, qui trace déjà
     les signaux. À garder en dernier, ou à abandonner.
  7. **Réponse de l'auteur : NON, pas de téléphone** — « pas tout de suite, on
     verra plus tard ». La vraie UX mobile sort donc de la vague 4.
     Il a aussi confirmé : « on fera une refonte quoi qu'il arrive des menus,
     je n'aime pas ».
  8. **L'historique de versions est bon marché** (`localStorage` est déjà là) et
     rassure beaucoup : je le remonterais en vague 1.
  9. **Le croquis de barre du bas sous-estime le catalogue réel** : 97
     composants, 20 onglets, dont 7 pour l'atelier Électronique, 8 pour Process
     et 6 pour ⚡. « Deux niveaux maximum » reste juste, mais il faudra vérifier
     que neuf catégories tiennent vraiment sur une ligne.

- **Refondre la barre du bas.** L'auteur la trouve « peu ergonomique à
  l'usage », même après la refonte de la v6.6. À reprendre en entier, pas à
  rafistoler.
  Ce qu'elle contient aujourd'hui : trois boutons d'atelier + recherche +
  repli (`buildToolbar`), une rangée d'onglets (`modeTabs` / `TOOL_TABS`), une
  barre de favoris qui se compose seule (`favPins` / `favFreq`), et les tuiles
  de composants avec cadenas de progression (`toolState` / `updateToolbar`).
  Le catalogue compte maintenant ~90 composants pour 3 ateliers et 16 onglets —
  c'est probablement là que le bât blesse.
  **Piège vérifié en v6.18** : `.tool-row` a `overflow-x:auto` mais
  `scrollbar-width:none`. Une rangée trop longue défile donc en silence, sans
  autre indice qu'un dégradé discret au bord (`.more-right`). Un composant au-delà
  du bord devient introuvable. T149 refuse maintenant plus de 10 tuiles par
  onglet — mais l'affordance de défilement reste à revoir dans la refonte.
  **Avant de coder, demander à l'auteur ce qui le gêne précisément** : trop de
  clics pour changer d'onglet ? les favoris qui bougent tout seuls ? la
  recherche qu'on oublie ? la barre qui mange l'écran ? Une refonte à l'aveugle
  coûterait cher pour rien.

## LA PROPOSITION D'OVERLAY — maquette faite, en attente de validation

Maquette cliquable « La grille nue » : **`maquettes/la-grille-nue.html`**,
fichier autonome à ouvrir dans un navigateur (cinq états : panneau rangé, panneau
ouvert, menu ouvert, mode leçon, et « aujourd'hui » pour comparer.)

Contrainte qui commande tout, donnée par l'auteur :
**« je veux que la grille soit le plus épurée possible, d'où le fait de
pouvoir ranger le panneau des ateliers en bas à gauche au clic ».**
Correction de sa vision initiale : pas d'entrées « sandbox / chapitre /
montage » séparées — un seul **bouton Menu en haut à gauche**.

Ce que la maquette propose :
1. **En-tête** : `⚡ ARCHITECTE LOGIQUE` + `☰ Menu` + fil d'Ariane à gauche,
   `↶ ↷` + pastille de progression à droite. Les 14 boutons partent au menu.
2. **Menu** : grande fenêtre au centre, **tuiles en 5 sections** (Aller /
   Affichage / Simulation / Circuit / Aide), l'état de chaque réglage écrit
   à côté. Surtout pas une liste de 25 lignes.
3. **Panneau des objets** : ancré en bas à gauche. Au repos = **un seul
   bouton 🧰**. Au clic il se déplie vers la droite en 3 rangées (ateliers +
   recherche / catégories / tuiles). **« ★ Rapide » devient la première
   catégorie et la catégorie par défaut** — ça remplace la 4ᵉ rangée de
   favoris qu'il voulait, sans manger de hauteur.
4. **Zone Outils** en haut à droite : information seulement (table de vérité
   + compteurs), rangeable elle aussi.
5. **Bandeau de leçon** au centre haut : chapitre, titre, objectif, et les
   trois actions. « Tout effacer » part au menu.

Livraison proposée en 4 lots : 1 en-tête, **2 panneau (à faire en premier :
c'est lui qui donne la grille nue, et c'est le moins risqué)**, 3 leçon,
4 zone Outils.

## Ce qui reste

Découpage validé avec l'auteur. Un lot, on livre, il teste, il valide.

**Phase 1 — le continu : TERMINÉE.**
→ le lot 3 devra ajouter **une vraie condition de réussite** : aujourd'hui une
leçon sans table de vérité est gagnée dès qu'on clique sur « Vérifier »
(`logicgates.html`, gestionnaire de `btn-verify`, la ligne `if (!m.tt.length)`).
Prévoir un champ `m.check(components, wires)`.

**Phase 2 — produire : TERMINÉE.**

**Phase 3 — l'alternatif : TERMINÉE** (lots 6 et 7, v6.20 et v6.22).
→ il manque encore des **montages d'exemple ⚡ pour l'alternatif** dans le
menu 📦 (les quatre existants ne couvrent que le continu).

**Phase 4 — l'éther : TERMINÉE.** Lot 8 (distance et obstacles) v6.24,
lot 9 (accord, bande passante, AM/FM, bruit) v6.26, lot 10 (Morse, trame
numérique, haut-parleur, chapitre final) v6.28.

**➡️ LA FEUILLE DE ROUTE ⚡ EST TERMINÉE.** La suite du travail est dans
« Chantiers demandés » et « L'audit du moteur » ci-dessus. L'ordre convenu avec
l'auteur : le **lot A** de l'audit (petit, sans risque, gain immédiat), puis la
**refonte de l'overlay et des menus**.
→ **Un audit UI/UX complet de l'overlay a été demandé** pendant le lot 8
(hiérarchie visuelle, ergonomie, accessibilité/responsive, technique). Son
rapport alimentera la refonte de l'overlay prévue après la phase 4.
