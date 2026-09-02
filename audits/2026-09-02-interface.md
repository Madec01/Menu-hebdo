# Audit visuel — agenda.html (version 1.0.0)

Méthode : Chromium 1194 via Playwright, `file:///home/user/Menu-hebdo/agenda.html`, données réalistes
injectées en mémoire (42 items : titres de 36 à 78 caractères, 12 tâches le mercredi, jeudi et dimanche
vides, 3 rendez-vous chevauchants le mardi, rendez-vous de 15 min et de 3 h, parking de 9 lignes,
note de semaine de 446 caractères, 5 tâches urgentes).
Captures : `visuel/` — 1920×1080, 1440×900, 1366×768, 1280×720 en clair et sombre, plus `print-1440-clair.png`
et `impression.pdf`. Mesures : `visuel/mesures.json`, `visuel/mesures2.json`.
Toutes les valeurs ci-dessous sont lues au DOM (`getBoundingClientRect`, `getComputedStyle`) ou au pixel
sur les captures. Aucun défaut n'est mentionné sans avoir été vu sur une capture.

---

## 1. VERDICT

**Refonte de la mise en page, pas refonte complète du CSS.** Les couleurs, les rayons, les ombres et la
sobriété générale sont bons et se tiennent dans les deux thèmes ; ce qui est cassé, c'est la *répartition
de l'espace vertical* et **trois règles précises** (`.daybin` en flex sans `flex:none`, `.daycol` en grid
sans `grid-column` sur les rendez-vous, `max-height:190px`).

Ces trois règles suffisent à expliquer la totalité de ce que l'utilisateur voit : le bac « À faire » est
plafonné à 190 px alors qu'il contient 1 137 px de contenu, ses 12 tâches sont écrasées à 20 px de haut
chacune, et leur texte est repeint *sous* la tâche suivante. Le bug B-003 n'est pas revenu : le champ
multi-ligne fonctionne parfaitement — c'est son parent qui l'écrase.

En face, la grille horaire occupe 555 px dont **80,5 % de vide**. Le rapport de surface est exactement
inversé par rapport au besoin. Corriger les trois règles + rendre la hauteur des deux zones négociable
(disposition **B** ci-dessous) règle tout sans toucher à la palette ni au balisage.

---

## 2. DÉFAUTS, PAR GRAVITÉ

| # | Grav. | Constat chiffré | Cause (ligne) | Capture | Correction |
|---|---|---|---|---|---|
| D-01 | **Bloquant** | Les 3 rendez-vous chevauchants du mardi ont une **largeur de texte de 0,0 px** (1440, 1366, 1280) et 0,6 px à 1920. Titres invisibles à 100 % : 415, 776 et 729 px de texte masqués. `grid-template-columns` de la colonne mardi = `0px 65.47px 65.47px 65.48px` : la piste des créneaux est **écrasée à 0 px**, donc les 22 créneaux horaires de ce jour deviennent inclicables. | `.slot{grid-column:1}` L259 + `.daycol{display:grid}` L256 ; JS L1239 pose `gridRow` mais **jamais** `gridColumn` → placement automatique dans des colonnes implicites | `visuel/crop-chevauchement.png`, `1440x900-clair.png` (colonne MAR, 10:00) | `.daycol{grid-template-columns:1fr}` + `.item.slotitem{grid-column:1}` (vérifié : la piste repasse à 196,4 px, le texte à 109 px). Puis calculer les couloirs en JS : grouper les rendez-vous qui se recouvrent, `left: (i/n)*100%`, `width: calc(100%/n - 3px)` |
| D-02 | **Bloquant** | Bac « À faire » du mercredi : **12 items sur 12 comprimés**, hauteur réelle 20 px pour un texte de 70 à 120 px. Contenu naturel 1 137 px, `clientHeight` 190 px. **4 items entièrement hors champ**, sans barre de défilement visible. L'en-tête annonce « 15 » tâches, 8 sont lisibles. | `.daybin{display:flex;flex-direction:column}` L241 + `.item` sans `flex-shrink:0` (calculé : `flexShrink:"1"`, `minHeight:"20px"`, `overflow:"visible"` L275-279) | `visuel/crop-bins-clair.png`, `crop-bins-sombre.png` | `.daybin>.item{flex:0 0 auto}` — **vérifié en direct** : items comprimés 12 → 0, première tâche 20 px → 109 px |
| D-03 | **Bloquant** | Le texte débordant d'un item est **repeint sous l'item suivant** (fond opaque `--surface-2`/`--p-urgent-bg`) : on lit « Appeler le » puis « pour le bilan » à moitié caché derrière « Réécrire la ». 15 items sur 41 en `débord:true`. | `.item{overflow:visible}` (défaut) L275 ; les frères suivants peignent par-dessus | `crop-bins-clair.png` (colonne MER) | Corollaire de D-02. En filet de sécurité : `.daybin>.item{overflow:hidden}` + `.item .title{-webkit-line-clamp:3}` pour un plafond franc plutôt qu'un chevauchement |
| D-04 | **Majeur** | `.daybin` plafonné à **190 px** pendant que `.board-scroll` mesure 555 px dont **80,5 % de surface vide** (748 px² occupés sur 3 827 px² à 1920×1080 ; 77,9 % de vide à 1440). Répartition 190/555 = 25/75 pour un besoin inverse. | `.daybin{max-height:190px}` L241 | `1920x1080-clair.png` (colonnes JEU, SAM, DIM entièrement blanches sur 555 px) | Supprimer `max-height` fixe ; `.daybin{max-height:none}` et déplacer le plafond sur la **rangée** : `.board{grid-template-rows:auto auto minmax(120px,var(--bins-h,38vh)) minmax(0,1fr)}` avec poignée de redimensionnement (le fichier en a déjà une, `.grabber` L353) |
| D-05 | **Majeur** | Un rendez-vous et une tâche sont **strictement identiques** : même `.item`, même case à cocher 13×13 (L296), même pastille 13×13 (L307), même bordure gauche de priorité. `elementItem()` L1319 compose la classe à partir de `it.priority` **uniquement** ; `it.kind` (`"task"`/`"event"`, L677) n'atteint jamais le DOM alors qu'il pilote déjà la logique métier (L933, L1001). L'**heure de début n'est jamais affichée** : le seul indice est la position verticale, détruite dès que la boîte fait 22 px. | JS L1319-1362 | `1440x900-clair.png` : « Réunion d'équipe hebdomadaire » porte une case à cocher et une pastille de priorité | `el.className += " k-" + it.kind` ; pour `k-event` : pas de case à cocher, pas de pastille, `border-left:3px solid var(--accent)`, fond `color-mix(in srgb,var(--accent) 8%,var(--surface))`, et un `<time>` `11.5px/600` en tête de boîte (`09:00`) ou en préfixe inline si la boîte fait < 34 px |
| D-06 | **Majeur** | Teinte « aujourd'hui » : bandeau **continu de 707,4 px** (en-tête 33,4 + bac 190 + colonne 484) et 197 px de large à 1440, 772 px à 1920 — mais un contraste mesuré au pixel de **1,02:1** en clair (`#fffdf3` sur `#ffffff`) et **1,005:1** en sombre (`#232019` sur `#1c2027`). Simultanément trop grand et trop faible : on voit une grosse barre crème sans savoir ce qu'elle marque. | `--today:#fffdf3` L67, `--today:#232019` L92, `.is-today{background:var(--today)}` L228 | `1920x1080-clair.png`, `1440x900-sombre.png` | Retirer le fond de `.daycol.is-today` et `.daybin.is-today`. Marquer la date **dans l'en-tête seulement** : `.dayhead.is-today .dd{background:var(--today-line);color:#fff;border-radius:99px;padding:1px 7px}` (blanc sur `#b93225` = 5,92:1) + garder `.nowline`. Optionnellement `.daycol.is-today{box-shadow:inset 2px 0 0 var(--today-line)}` |
| D-07 | **Majeur** | Impression : contenu de **2 088 px de haut** pour un A4 paysage utile de 194 mm = **733 px** → **2,85 pages**. Les 7 bacs passent à **1 137 px chacun** (`max-height:none` L463) : le haut de la feuille est une colonne mercredi de 1 137 px et six colonnes blanches. La grille 08:00-19:00 est reléguée en bas sur ~230 px. | L463 `.daybin{max-height:none}` ; `@page{size:A4 landscape;margin:8mm}` L455 | `visuel/print-reduit.png`, `visuel/impression.pdf` | `@media print{.daybin{max-height:none;display:block} .item{break-inside:avoid} .board-scroll{max-height:none} :root{--slot-h:14px;--fs:8.5pt}}` + masquer les heures hors plage occupée. Objectif mesuré : ramener `body.scrollHeight` sous 1 040 px à 1 440 px de large (ratio 1 440/733) |
| D-08 | **Majeur** | Impression : **toute l'information de priorité disparaît**. `.item{border-color:#999!important}` L462 écrase `border-left-color` (raccourci > propriété longue), et `background:#fff!important` efface `--p-urgent-bg`/`--p-semaine-bg`. `.item .pdot` est masquée L457. Sur papier, une urgence et un « quand je peux » sont identiques. | L457, L462 | `visuel/print-reduit.png` : les 12 items du mercredi sont gris uniformes | `@media print{.item{background:#fff!important;border:1px solid #999!important;border-left:3px solid #000!important} .item.p-urgent{border-left-color:#b93225!important} .item.p-semaine{border-left-color:#9a5c00!important}}` ou remplacer par un glyphe imprimable (`!`, `•`) |
| D-09 | **Majeur** | Thème sombre : les cases à cocher non cochées sont **#ffffff pur** (relevé pixel (90,211) = 255,255,255), soit **13,67:1** contre le fond de l'item, alors que le **titre** de la tâche n'est qu'à 11,23:1. 41 pastilles blanches dominent la page. Idem pour les barres de défilement, `input[type=time]`, `input[type=number]`, `input[type=color]` des réglages. | Aucune déclaration `color-scheme` dans tout le fichier (grep : 0 occurrence). `accent-color` L296 ne colore que l'état *coché* | `1440x900-sombre.png`, `crop-bins-sombre.png` | `:root{color-scheme:light}` et `html[data-theme="sombre"]{color-scheme:dark}` — une ligne, corrige tous les contrôles natifs d'un coup |
| D-10 | **Sérieux** | Puces urgentes tronquées **en plein mot, sans ellipse** : « …du troisième t », « …à la société Marchand ». Mesuré : `scrollWidth` 404 px pour `clientWidth` 357 px (47 px cachés) et 420/357 (63 px). Le bandeau prend **105,6 px sur 3 rangées** pour 5 puces, alors que 490 px de la largeur restent vides à droite. | `.uchip{max-width:440px}` L194 ; titre = `<input type="text">` mono-ligne L1275 avec `size` plafonné à 56 L1278 | `visuel/crop-urgent.png` | `.uchip{max-width:none;flex:1 1 240px}` + `.uchip .utitle{flex:1;min-width:0;text-overflow:ellipsis}` + `title=it.title` sur la puce ; supprimer l'attribut `size` (L1278) qui impose une largeur intrinsèque arbitraire |
| D-11 | **Sérieux** | À 1280×720 la grille horaire ne montre que **163 px sur 500** (08:00 → 11:00) : 76 % de la hauteur d'écran est consommée par les bandeaux fixes (55,5 topbar + 105,6 urgent + 34,4 en-têtes + 191 bacs + 5 poignée + 168 bas = 559,5 px). À 1366×768 : 211 px sur 500. | Empilement de hauteurs fixes : L133 `padding:8px 14px`, L183 `min-height:40px`, L241 `max-height:190px`, L337 `height:168px` | `1280x720-clair.png`, `1366x768-clair.png` | Compacter le chrome (voir §6) : topbar `padding:5px 12px` → 44 px, `.urgentbar` sur une rangée → 40 px, `.bottom` défaut 152 px. Gain mesuré ≈ 88 px, soit +54 % de grille visible à 1280×720 |
| D-12 | **Sérieux** | `.item.slotitem{overflow:hidden}` coupe **sans ellipse ni indice** : « Réunion d'équipe hebdomadaire » perd 11 px (2ᵉ ligne coupée en deux) à 1280 ; « Revue de fin de semaine… » perd 21 px à 1440, 37 px à 1366 et 1280 ; « Déjeuner avec Sophie Marchand… » perd 5 px à 1440. Un rendez-vous de 30 min = 44 px de boîte pour 34 px de texte : il n'y a de place que pour 2 lignes de 12 px. | `.item.slotitem{overflow:hidden}` L323 ; `.item.slotitem .title{font-size:12px}` L325 ; `--slot-h:22px` L52 | `1280x720-clair.png` (colonne MER, 09:00) | `--slot-h:26px` (30 min = 52 px, 3 lignes) et `.item.slotitem .title{display:-webkit-box;-webkit-line-clamp:var(--lc,2);-webkit-box-orient:vertical;overflow:hidden}` avec `--lc` posé en JS d'après `span` ; ajouter `title=it.title` pour la version complète au survol |
| D-13 | **Sérieux** | 10 couples texte/fond sous 4,5:1 en clair, 8 en sombre — dont 5 sous 3,0:1 en clair. Le pire : compteur de charge 2,66:1, tâche terminée 2,56:1, tâche qui traîne 2,71:1, jour de la puce urgente 2,79:1. Voir §4. | `--text-faint:#8b93a1` L66 / `#767f8d` L91 ; `.item.done{opacity:.42}` L284 ; `.uchip .uday{opacity:.7}` L201 ; `--p-semaine:#c97b00` L72 | toutes | Nouvelles valeurs en §6 |
| D-14 | **Sérieux** | Un rendez-vous de **15 min** occupe exactement la même boîte qu'un rendez-vous de 30 min : `Math.max(1, Math.min(n-ligne+1, Math.round(15/30)))` = `Math.max(1,0)` = 1 créneau = 22 px. « Point rapide », « Point budget » et « Café » (15 min) sont indistinguables d'un créneau de 30 min. | JS L1237 | `1440x900-clair.png` (LUN 09:00, MER 11:00, VEN 08:30) | Passer la grille au quart d'heure pour le calcul : `grid-auto-rows: calc(var(--slot-h)/2)` et `span = Math.max(1, Math.round(dur/15))`, en gardant un affichage des lignes toutes les 30 min |
| D-15 | **Mineur** | Le message flottant est **imprimé** : « Sauvegarde du jour enregistrée dans votre dossier Téléchargements. » se retrouve au milieu de la feuille, par-dessus les tâches du mercredi. `.toast` n'est pas dans la liste masquée. | L457 (liste `display:none!important` sans `.toast`) | `visuel/print-reduit.png`, centre | Ajouter `.toast` (et `.savechip`) à la liste L457 |
| D-16 | **Mineur** | Le « × » de suppression est **toujours visible** dans le bandeau urgent (`opacity:.5` L318) mais **caché jusqu'au survol** dans les items (`opacity:0` L314). Deux comportements pour le même geste. Il s'imprime aussi dans les puces urgentes (`.item .del` est masqué L457, `.uchip .del` non). | L314, L318, L457 | `crop-urgent.png` | Uniformiser à `opacity:0` + `:hover/:focus-within` ; masquer `.del` (sans le préfixe `.item`) à l'impression — exactement la leçon déjà écrite dans B-004 |
| D-17 | **Mineur** | Un jour vide (jeudi, dimanche) affiche **190 px de bac totalement blanc**, sans repère ni invitation, alors que `.parklist` et `.urgentlist` ont un `.emptyhint` (L202). Incohérence : la zone la plus vide de l'écran est la seule sans texte d'aide. | `rendreBacs()` L1211-1221 : aucune branche « liste vide » | `1920x1080-clair.png` (colonne JEU) | Ajouter le même `.emptyhint` (« Rien de prévu — cliquez pour ajouter »), en `11.5px`, `--text-faint` corrigé |
| D-18 | **Mineur** | `.binlabel` (« À FAIRE ») est en **10 px / 700 / majuscules / letter-spacing .05em** à 3,09:1 : c'est le libellé le plus petit et le moins contrasté de l'écran alors qu'il nomme la zone que l'utilisateur juge trop petite. La gouttière fait 58 px de large et n'affiche rien d'autre. | `.binlabel{font-size:10px}` L236, `.gutter`/`--gutter:58px` L53 | `crop-bins-clair.png` (colonne de gauche) | `11.5px/700`, `--text-faint` corrigé, et le nombre de tâches restantes à côté (« À FAIRE · 8 ») |

---

## 3. TRONCATURES ET DÉBORDEMENTS — liste exhaustive

Cinq mécanismes distincts, tous vérifiés au DOM. Aucun d'eux n'est le mécanisme corrigé par B-003 :
le `<textarea class="title">` est **toujours** dimensionné correctement (`scrollHeight === clientHeight`
sur les 41 items, donc `clip:false` partout). Le champ multi-ligne fait son travail ; c'est son
environnement qui le trahit.

**T-1 — Écrasement par `flex-shrink` (le plus grave, 15 items sur 41).**
`.daybin` est un conteneur flex en colonne (L241). `.item` n'a pas `flex-shrink:0`, donc le moteur le
comprime jusqu'à `min-height:20px` (L279). Le `<textarea>` garde sa hauteur calculée (70 à 120 px) et
**déborde de son parent**. Comme `.item` est en `overflow:visible`, ce texte est peint dans le flux, puis
**recouvert par le fond opaque de l'item suivant**. Résultat : on lit la 1ʳᵉ ligne, un fragment de la 2ᵉ,
rien du reste. Mesures mercredi : item 20 px / texte 103 px (« Appeler le comptable… »), 20/120
(« Réécrire la fiche de poste… »), 20/86, 20/103, 20/103, 20/86, 20/70, 20/86, 20/86, 20/86, 20/53, 20/53.
*Vérifié* : `.daybin>.item{flex:0 0 auto}` ramène 12 items comprimés à 0.

**T-2 — Coupure nette par `max-height` (4 items entièrement invisibles).**
`.daybin{max-height:190px;overflow-y:auto}` L241. Contenu du mercredi : 302 px après écrasement,
**1 137 px** une fois T-1 corrigé. 4 items sont sous la ligne de flottaison. Chromium sous Linux masque la
barre de défilement au repos : **aucun indice visuel** que du contenu manque. Le lundi lui-même est coupé
avec seulement 3 tâches (`scrollHeight` 192 pour `clientHeight` 190) : « …période de Noël » est rogné en bas.

**T-3 — Colonnes implicites de la grille (3 rendez-vous, 100 % du titre perdu).**
`.daycol{display:grid;grid-auto-rows:var(--slot-h)}` (L256) sans `grid-template-columns`. `.slot` force
`grid-column:1` (L259) ; les `.slotitem` n'ont **aucune** contrainte de colonne (JS L1239 ne pose que
`gridRow`). Trois rendez-vous dont les plages se recouvrent occupent donc les colonnes implicites 2, 3
et 4. `grid-template-columns` calculé = `0px 65.47px 65.47px 65.48px` : la piste des créneaux tombe à 0 px
et chaque boîte fait 61,5 px de large. Le `<textarea>`, coincé entre une case à cocher, une pastille et un
« × », se retrouve à **0,0 px de large** ; il se replie sur 28, 46 et 53 lignes, dont `overflow:hidden`
(L323) n'en montre aucune. Le titre est intégralement perdu — pas tronqué, **absent**.
*Vérifié* : `.daycol .slotitem{grid-column:1}` ramène la piste à 196,4 px et le texte à 109 px.

**T-4 — `overflow:hidden` sur une boîte plus courte que son texte (6 rendez-vous).**
`.item.slotitem{overflow:hidden}` L323. Un rendez-vous de 30 min = 44 px de boîte (2 créneaux à 22 px) et
le texte à 12 px / 1,35 fait 16,2 px la ligne : 2 lignes tiennent, la 3ᵉ est coupée à mi-hauteur.
Pertes mesurées : 37 px (« Revue de fin de semaine… » à 1366 et 1280), 21 px (à 1440), 11 px
(« Réunion d'équipe hebdomadaire » à 1280), 5 px (« Déjeuner avec Sophie Marchand… » à 1440).
Pas d'ellipse : la coupure tombe au milieu d'un jambage, on ne sait pas qu'il manque quelque chose.

**T-5 — Champ mono-ligne dans le bandeau urgent (2 puces sur 5).**
Le titre urgent est un `<input type="text">` (JS L1275), pas un `<textarea>` : c'est précisément la
construction que B-003 avait supprimée dans les items, restée en place ici. `.uchip{max-width:440px}`
(L194) fixe le plafond ; l'attribut `size` (L1278, plafonné à 56 caractères) fixe la largeur intrinsèque.
Résultat mesuré : `scrollWidth` 404 px pour `clientWidth` 357 px, et 420 px pour 357 px. Le texte est
coupé **en plein mot, sans ellipse** : « …du troisième t », « …à la société Marchand ».

**Débordements sans troncature, à consigner aussi :**
- Le bandeau urgent passe à **3 rangées / 105,6 px** dès 5 puces à 1440 et moins, alors que 490 px de
  largeur restent inutilisés à droite : c'est `max-width:440px` qui force le retour à la ligne prématuré.
- À 1280×720, `.board-scroll` a `clientHeight` 163 px pour `scrollHeight` 500 px : **67 % de la grille
  horaire est hors champ** en permanence, y compris le rendez-vous de 15:00 à 18:00.
- Le message flottant `.toast` recouvre la zone des notes et du parking pendant 4 s au démarrage
  (visible sur les 8 captures d'écran) et s'imprime (D-15).

---

## 4. CONTRASTES WCAG MESURÉS

Ratios calculés depuis les couleurs **effectivement composées** : opacité de la chaîne d'ancêtres
appliquée, fond opaque le plus proche remonté. Seuil AA texte normal : 4,5:1.

### Thème clair

| Élément | Taille / graisse | Couleur sur fond | Ratio | |
|---|---|---|---|---|
| Compteur de charge (`.dayhead .load`) | 11 px / 400 | `#8b93a1` sur `#eceef2` | **2,66** | ✗ |
| Tâche terminée (`.item.done .title`, opacité 0,42) | 12,5 px / 400 | `#1b1f24`@42 % sur `#f7f8fa` | **2,56** | ✗ |
| Tâche qui traîne (`.item.stale .title`) | 12,5 px / 400 | `#8b93a1` sur `#fdecea` | **2,71** | ✗ |
| Jour de la puce urgente (`.uchip .uday`, opacité 0,7) | 11 px / 400 | `#cf3b30`@70 % sur `#fdecea` | **2,79** | ✗ |
| Compteur de report (`.item .roll`) | 10 px / 400 | `#c97b00` sur `#fdecea` | **2,91** | ✗ |
| Pastille de sauvegarde (`.savechip`) | 12 px / 400 | `#8b93a1` sur `#f7f8fa` | **2,91** | ✗ |
| Libellé « À faire » (`.binlabel`) | 10 px / 700 | `#8b93a1` sur `#ffffff` | **3,09** | ✗ |
| Heure de la gouttière (`.hlab`) | 11 px / 400 | `#8b93a1` sur `#ffffff` | **3,09** | ✗ |
| Sous-titre de semaine (`.weeksub`) | 12,5 px / 400 | `#8b93a1` sur `#ffffff` | **3,09** | ✗ |
| En-tête de panneau bas (`.paneheader`) | 10,5 px / 700 | `#8b93a1` sur `#ffffff` | **3,09** | ✗ |
| Titre de tâche urgente (`.uchip .utitle`) | 13 px / 500 | `#cf3b30` sur `#fdecea` | **4,25** | ✗ |
| Libellé « URGENT » (`.urgentbar .lab`) | 11 px / 700 | `#cf3b30` sur `#ffffff` | 4,86 | ✓ |
| Nom du jour (`.dayhead .dn`) | 11 px / 700 | `#59616e` sur `#ffffff` | 6,25 | ✓ |
| Titre de tâche (bac) | 12,5 px / 400 | `#1b1f24` sur `#fdf3e2` | 15,06 | ✓ |
| Titre de rendez-vous (grille) | 12 px / 400 | `#1b1f24` sur `#f7f8fa` | 15,58 | ✓ |
| Numéro du jour, titre de semaine, notes, bouton | 13-16 px | `#1b1f24` sur `#ffffff` | 16,56 | ✓ |

**11 couples sous 4,5:1, dont 6 sous 3,0:1** — et tous concernent des textes de 10 à 13 px, c'est-à-dire
« texte normal » au sens WCAG, jamais « grand texte ».

### Thème sombre

| Élément | Taille / graisse | Couleur sur fond | Ratio | |
|---|---|---|---|---|
| Jour de la puce urgente (opacité 0,7) | 11 px / 400 | `#f0776a`@70 % sur `#3a2320` | **3,33** | ✗ |
| Compteur de charge | 11 px / 400 | `#767f8d` sur `#2a2f38` | **3,32** | ✗ |
| Tâche terminée (opacité 0,42) | 12,5 px / 400 | `#e6e9ee`@42 % sur `#22262e` | **3,42** | ✗ |
| Tâche qui traîne | 12,5 px / 400 | `#767f8d` sur `#372c18` | **3,60** | ✗ |
| Pastille de sauvegarde | 12 px / 400 | `#767f8d` sur `#22262e` | **3,75** | ✗ |
| Libellé « À faire » | 10 px / 700 | `#767f8d` sur `#1c2027` | **4,04** | ✗ |
| Heure de la gouttière | 11 px / 400 | `#767f8d` sur `#1c2027` | **4,04** | ✗ |
| Sous-titre de semaine | 12,5 px / 400 | `#767f8d` sur `#1c2027` | **4,04** | ✗ |
| En-tête de panneau bas | 10,5 px / 700 | `#767f8d` sur `#1c2027` | **4,04** | ✗ |
| Titre de tâche urgente | 13 px / 500 | `#f0776a` sur `#3a2320` | 5,24 | ✓ |
| Libellé « URGENT » | 11 px / 700 | `#f0776a` sur `#1c2027` | 5,88 | ✓ |
| Compteur de report | 10 px / 400 | `#e0a44a` sur `#3a2320` | 6,65 | ✓ |
| Nom du jour | 11 px / 700 | `#a4acba` sur `#1c2027` | 7,15 | ✓ |
| Titre de tâche / rendez-vous | 12-12,5 px | `#e6e9ee` sur `#372c18`/`#22262e` | 11,23 / 12,46 | ✓ |

**9 couples sous 4,5:1.** À noter, un défaut inverse : **la case à cocher non cochée est à 13,67:1**
(`#ffffff` relevé au pixel) contre 11,23:1 pour le titre qu'elle accompagne — le contrôle crie plus fort
que le contenu (D-09).

**Teintes de fond, mesurées au pixel** (informatif, pas soumis au 4,5:1) :
« aujourd'hui » 1,02:1 en clair et 1,005:1 en sombre ; week-end 1,063:1 et 1,077:1 ; bordures
`#dfe3ea` 1,29:1 et `#c7cdd8` 1,60:1 sur blanc.

---

## 5. MISE EN PAGE PROPOSÉE

État actuel mesuré à 1440×900 (total 902 px) :

```
┌──────────────────────────────────────────────────────────────────┐ 55,5  topbar
├──────────────────────────────────────────────────────────────────┤ 105,6 urgent (3 rangées !)
├──────┬───────┬───────┬───────┬───────┬───────┬───────┬───────────┤ 34,4  en-têtes de jour
│ AFR  │ 190px │ 190px │ 190px │ 190px │ 190px │ 190px │ 190px     │ 191   BACS — plafond dur
│      │ 3 it. │ 2 it. │ 12 it.│ VIDE  │ 2 it. │ 1 it. │ VIDE      │       1137 px de contenu au MER
├──────┼───────┼───────┼───────┼───────┼───────┼───────┼───────────┤
│08:00 │       │       │       │       │       │       │           │ 342,5 GRILLE — 500 px nécessaires
│  ...  vide   vide    vide     VIDE    vide    vide    VIDE       │       77,9 % de surface vide
├──────┴───────┴───────┴───────┴───────┴───────┴───────┴───────────┤ 5     poignée
│  NOTES (1,6 fr)                    │  PARKING (1 fr)             │ 168   bas
└────────────────────────────────────┴─────────────────────────────┘
```

### Disposition A — « bac élastique » (retouches ciblées, ~25 lignes de CSS)

```
┌──────────────────────────────────────────────────────────────────┐ 55,5
├──────────────────────────────────────────────────────────────────┤ 105,6
├──────┬───────┬───────┬───────┬───────┬───────┬───────┬───────────┤ 34,4
│ AFR  │  3it  │  2it  │ 12 it │ vide  │  2it  │  1it  │  vide     │ 300  BACS max-height:min(40vh,340px)
│      │ 149px │ 105px │ défil.│ 46px  │ 105px │  61px │  46px     │      items en flex:0 0 auto
├──────┼───────┼───────┼───────┼───────┼───────┼───────┼───────────┤
│08:00 │       │       │       │       │       │       │           │ 233  grille (défilement)
├──────┴───────┴───────┴───────┴───────┴───────┴───────┴───────────┤ 5
│  NOTES                             │  PARKING                    │ 168
└────────────────────────────────────┴─────────────────────────────┘   Σ 901
```
**Gagné** : plus aucun texte écrasé ni chevauché (D-02, D-03), 8 tâches lisibles au lieu de 4, les 3
rendez-vous chevauchants redeviennent lisibles (D-01). Correctif minimal, aucun risque de régression sur
le glisser-déposer ni sur l'impression.
**Perdu** : la grille tombe à 233 px (10 créneaux visibles sur 22) à 1440×900 et **à 0 px à 1280×720** ;
le plafond reste arbitraire (une semaine à 20 tâches défile toujours) ; la grille reste vide à 78 %.

### Disposition B — « deux zones négociables + grille recadrée » ← **recommandée**

Le bac et la grille deviennent les deux rangées d'un `minmax()` réglable par la poignée existante ; la
grille n'affiche que la **plage horaire réellement occupée** (recalculée à chaque rendu, ±1 h de marge),
et le chrome est compacté.

```
┌──────────────────────────────────────────────────────────────────┐ 44   topbar (padding 5px 12px)
├──────────────────────────────────────────────────────────────────┤ 40   urgent — 1 rangée, puces flexibles
├──────┬───────┬───────┬───────┬───────┬───────┬───────┬───────────┤ 32   en-têtes (badge « aujourd'hui »)
│ À    │  3it  │  2it  │ 12 it │       │  2it  │  1it  │           │
│ FAIRE│ 149px │ 105px │ 1137  │ vide  │ 105px │  61px │  vide     │ 300  BACS  minmax(120px, 38vh)
│  · 8 │       │       │ défil.│       │       │       │           │      ← réglable à la souris
├══════╧═══════╧═══════╧═══════╧═══════╧═══════╧═══════╧═══════════┤ 6    poignée (déjà présente)
│08:00 │ 09:00 Point rapide          │       │ 08:30 Café          │
│10:00 │ ┌──────────┬───────────┐    │       │                     │ 320  GRILLE 08:00→18:00 recadrée
│11:00 │ │Entretien │Webinaire  │    │       │                     │      --slot-h:26px, couloirs calculés
│...   │ └──────────┴───────────┘    │       │                     │      (19 créneaux × 26 = 494, défile)
├──────┴─────────────────────────────┴───────┴─────────────────────┤
│  NOTES (1,6 fr)                    │  PARKING (1 fr)             │ 152  bas (défaut abaissé)
└────────────────────────────────────┴─────────────────────────────┘   Σ 900
```
**Gagné** : le bac passe de 190 à 300 px par défaut **et devient réglable de 120 px à 60 vh** — l'utilisateur
arbitre lui-même « à faire » contre « heures » selon sa semaine. Le chrome fixe hors zones de contenu
descend de **368,5 à 274 px**, donc l'espace partagé entre bac et grille passe de 351,5 à **446 px à
1280×720 (+27 %)** : réparti à parts égales, cela donne 226 px de bac (**+18 %**) et 220 px de grille
(**+35 %**, contre 163 px aujourd'hui). Les couloirs de rendez-vous règlent D-01 pour de bon, le badge de
date règle D-06.
Le recadrage horaire (08:30→18:00 au lieu de 08:00→19:00 sur ce jeu de données) ne récupère que 3 créneaux,
soit **66 px** : il ne réduit le taux de vide que de 80,5 % à 77,4 %, car ce vide est surtout *horizontal*
(jeudi et dimanche entièrement libres). Son intérêt est de rendre ces 66 px au bac, pas de densifier la grille.
**Perdu** : ~35 lignes de JS nouvelles (calcul des couloirs, recadrage de la plage, persistance de la hauteur
du bac dans `settings`) ; le recadrage automatique peut surprendre (à neutraliser par une case dans les
réglages) ; la poignée existante doit gérer deux zones au lieu d'une.

### Disposition C — « colonne-jour continue » (refonte complète du gabarit)

Chaque jour devient **une seule colonne défilante** : les tâches sans heure en haut, la grille horaire
dessous, dans le même conteneur de défilement. Il n'y a plus de rangée « bacs » ni de plafond.

```
┌──────────────────────────────────────────────────────────────────┐ 44   topbar
├──────────────────────────────────────────────────────────────────┤ 40   urgent
├───────────┬───────────┬─────●─────┬───────────┬──────────────────┤ 32   en-têtes (● = aujourd'hui)
│ LUN 31    │ MAR 1     │ MER 2     │ JEU 3     │ VEN 4  SAM  DIM  │
│ ▸ 3 tâches│ ▸ 2 tâches│ ▸ 12 tâch.│ ▸ rien    │ ▸ 2 tâches       │
│ ─────────  ─────────   ─────────   ─────────   ─────────         │ 630  UNE zone, 7 colonnes,
│ 09:00 Point│           │09:00 Réun.│           │08:30 Café        │      chaque colonne défile seule
│ 10:00 Comi│10:00 Entr.│11:00 Point│           │                  │      la gouttière disparaît,
│       té  │10:00 Webi.│           │           │                  │      l'heure est écrite dans la boîte
│ 13:00 Déj.│10:30 Appel│14:00 Form.│           │16:00 Revue       │
├───────────┴───────────┴───────────┴───────────┴──────────────────┤
│  NOTES                             │  PARKING                    │ 152
└────────────────────────────────────┴─────────────────────────────┘   Σ 898
```
**Gagné** : plus aucun plafond, plus aucune zone vide structurelle — un jour chargé s'allonge, un jour vide
ne coûte rien ; c'est le modèle de Sunsama et d'Amie ; l'impression tient naturellement sur une page
puisque rien n'a de hauteur imposée.
**Perdu** : **la lecture des heures en travers de la semaine disparaît** (on ne voit plus d'un coup d'œil que
mardi 10:00 est pris et jeudi 10:00 libre) ; le glisser-déposer sur un créneau précis, l'étirement de durée
(`.resize` L326) et la ligne « maintenant » (`.nowline` L263) doivent être repensés ; c'est une réécriture de
`construireSquelette()`, `rendreGrille()` et de tout le code de dépôt — plusieurs centaines de lignes.

**Recommandation : B.** A ne fait que déplacer le problème vers la grille et devient inutilisable à
1280×720. C est le bon modèle sur le fond mais sacrifie la comparaison horaire entre jours, qui est la
raison d'être d'un semainier de bureau, pour un coût de réécriture sans commune mesure avec le défaut à
corriger.

---

## 6. ÉCHELLE TYPOGRAPHIQUE ET COULEURS — valeurs à adopter

### Échelle typographique (7 niveaux, base 13 px, raison ≈ 1,15)

Aujourd'hui le fichier utilise **11 tailles** (10 / 10,5 / 11 / 11,5 / 12 / 12,5 / 13 / 15 / 16 px) et
5 graisses (400 / 500 / 650 / 700 + `bold` natif) sans règle : `.binlabel` 10 px et `.paneheader` 10,5 px
jouent le même rôle ; `.item .title` 12,5 px et `.item.slotitem .title` 12 px aussi.

```css
:root{
  --fs-micro:  11px;   /* 700, 1.2,  letter-spacing .05em, MAJUSCULES — intertitres de zone */
  --fs-meta:   11.5px; /* 500, 1.25, tabular-nums — heures, compteurs, jour d'une puce, ↩ */
  --fs-dense:  12.5px; /* 400, 1.35 — titre de rendez-vous dans la grille */
  --fs-body:   13px;   /* 400, 1.4  — titre de tâche (bac, parking), puce urgente */
  --fs-strong: 13px;   /* 600 — heure de début d'un rendez-vous, en tête de boîte */
  --fs-day:    15px;   /* 600, letter-spacing -.01em — numéro du jour */
  --fs-title:  15px;   /* 650, letter-spacing -.01em — « Semaine 36 » */
}
```
Affectations : `.binlabel` et `.paneheader` → `--fs-micro` (au lieu de 10 et 10,5) ; `.hlab`, `.load`,
`.uday`, `.roll` → `--fs-meta` (au lieu de 11, 11, 11, 10) ; `.item.slotitem .title` → `--fs-dense`
(au lieu de 12) ; `.item .title` et `.uchip .utitle` → `--fs-body` (au lieu de 12,5 et 13) ;
`.dayhead .dd` → `--fs-day` (16 → 15, la différence avec `--fs-title` n'était pas lisible).
**Aucune taille sous 11 px** : à 10 px et 400 de graisse, le seuil de 4,5:1 ne suffit plus.

Interlignage : 1,35 pour les titres denses, 1,4 pour le corps, 1,55 pour `#notes` (déjà correct L349).
Hauteur d'un item de bac : `min-height:26px`, `padding:3px 6px 3px 4px`, `gap:3px` (au lieu de
`min-height:20px`, `padding:2px 5px 2px 3px`, `gap:5px` L276-279) — 3 lignes de 13 px tiennent en 60 px.

### Couleurs — variables à corriger

```css
:root{
  color-scheme: light;                 /* NOUVEAU — corrige D-09 */
  --text-faint:  #636c7b;              /* était #8b93a1 : 3,09 → 5,30 / 4,99 / 4,56 sur les 3 surfaces */
  --p-urgent:    #b93225;              /* était #cf3b30 : 4,25 → 5,18 sur #fdecea, 5,92 sur blanc */
  --p-semaine:   #9a5c00;              /* était #c97b00 : 3,02 → 4,89 sur #fdf3e2, 4,70 sur #fdecea */
  --text-done:   #59616e;              /* NOUVEAU : remplace opacity .42 — 5,88 sur #f7f8fa */
  --today-line:  #b93225;              /* aligné sur --p-urgent */
  /* --today SUPPRIMÉE : plus de fond de colonne (D-06) */
  --slot-h:      26px;                 /* était 22px : 2 lignes de 12,5px tiennent dans 30 min */
}
html[data-theme="sombre"]{
  color-scheme: dark;                  /* NOUVEAU */
  --text-faint:  #949daa;              /* était #767f8d : 4,04 → 5,96 / 5,53 / 4,91 */
  --text-done:   #a4acba;              /* 6,64 sur #22262e */
  --p-urgent:    #f0776a;              /* conservée : 5,24 / 5,88, conforme */
  --p-semaine:   #e0a44a;              /* conservée : 6,24 / 7,45, conforme */
}
```

Règles qui doivent changer avec elles :
```css
.item.done{opacity:1}                        /* L284 : 2,56:1 → supprimer l'opacité */
.item.done .title{color:var(--text-done);text-decoration:line-through}
.item.stale .title{color:var(--text-soft)}   /* L287 : 2,71:1 → 5,88:1 */
.uchip .uday{opacity:1;color:var(--p-urgent)}/* L201 : 2,79:1 → 5,18:1 */
.dayhead .load{color:var(--text-soft)}       /* L224 : 2,66:1 → 5,25:1 sur --surface-3 */
```

### Distinction rendez-vous / tâche (D-05)

```css
.item.k-event{
  border-left:3px solid var(--accent);
  background:color-mix(in srgb,var(--accent) 8%,var(--surface));
  border-radius:5px;
}
.item.k-event .chk,.item.k-event .pdot{display:none}      /* un rendez-vous ne se coche pas */
.item.k-event .hour{
  font-size:var(--fs-strong);font-weight:600;color:var(--accent);
  font-variant-numeric:tabular-nums;margin-right:5px;
}
.item.k-task{border-left-width:3px}                        /* la couleur reste celle de la priorité */
```
Côté JS, une ligne dans `elementItem()` (L1319) : `el.className += " k-" + it.kind;` et l'ajout du
`<span class="hour">` quand `it.startMin != null`. Trois signaux redondants séparent alors les deux
objets : **forme** (case à cocher ou non), **couleur** (bleu d'accent contre couleur de priorité),
**contenu** (heure de début affichée).

### Marquage « aujourd'hui » (D-06)

```css
.is-today{background:transparent}                  /* annule L228 */
.dayhead.is-today .dd{
  background:var(--today-line);color:#fff;         /* 5,92:1 */
  border-radius:99px;padding:1px 8px;margin-left:-2px;
}
.dayhead.is-today .dn{color:var(--today-line)}     /* conservé */
.daycol.is-today,.daybin.is-today{box-shadow:inset 2px 0 0 var(--today-line)}
```
Un repère de 24×20 px à contraste 5,92:1 remplace un bandeau de 707 px à 1,02:1.

---

## 7. CE QUE FONT LES MEILLEURS

Note d'honnêteté : la politique de sortie réseau de cette session bloque `WebFetch` sur la quasi-totalité
des domaines (403 du mandataire pour `developers.google.com`, `ui-patterns.com`, `w3.org`, `nngroup.com`,
`fullcalendar.io`, `m3.material.io`). Les enseignements ci-dessous proviennent des résultats de recherche,
pas d'une lecture intégrale des pages. Les URL sont données pour vérification.

1. **Google Workspace — « Better visualize shorter meetings »** — https://workspaceupdates.googleblog.com/2020/07/better-visualize-shorter-meetings-in-calendar.html
   Google a explicitement cessé, en 2020, d'afficher les rendez-vous de moins de 25 min à la taille d'un
   créneau de 30 min. *Transposable* : D-14 — ici « Point rapide » (15 min) et « Point budget » (15 min)
   occupent exactement les 22 px d'un créneau de 30 min. Passer le calcul de `span` au quart d'heure.

2. **9to5Google — analyse du même changement** — https://9to5google.com/2020/07/07/short-google-calendar-events-will-no-longer-be-displayed-as-30-minutes-entries/
   Le rendu court reste **optionnel** (« Display shorter events the same size as 30 minute events »).
   *Transposable* : mettre le recadrage horaire de la disposition B derrière une case dans les réglages,
   plutôt que de l'imposer.

3. **Rolldate — construire un calendrier d'événements performant** — https://dev.to/rolldate/how-to-build-a-high-performance-javascript-event-calendar-for-thousands-of-events-30in
   Les événements doivent d'abord être répartis en **groupes de collision**, l'attribution des colonnes se
   faisant indépendamment dans chaque groupe — sinon des événements qui ne se chevauchent pas héritent de
   la largeur étroite imposée par ceux qui se chevauchent. *Transposable* : exactement l'algorithme qui
   manque à `rendreGrille()` (L1233-1241) et qui cause D-01/T-3.

4. **Mobiscroll — Scheduler, prévention du chevauchement** — https://demo.mobiscroll.com/scheduler/prevent-double-booking-events
   Le chevauchement est traité comme un **état à signaler**, pas seulement à mettre en page.
   *Transposable* : quand `n > 3` couloirs, afficher « +2 » plutôt que de réduire indéfiniment la largeur —
   à 61,5 px de boîte, la largeur de texte tombe déjà à 0.

5. **Eleken — Calendar UI Examples + UX tips** — https://www.eleken.co/blog-posts/calendar-ui
   Hiérarchie typographique : grande police pour les dates, petite pour les événements ; indices visuels
   (ombrage, surbrillance) pour orienter instantanément. *Transposable* : `.dayhead .dd` (15-16 px, 650)
   contre `.item .title` (13 px, 400) est la bonne relation — c'est le reste de l'échelle, à 11 tailles
   pour 7 rôles, qu'il faut ramener à 7 niveaux (§6).

6. **UX Patterns for Developers — Calendar View** — https://uxpatterns.dev/patterns/data-display/calendar
   « Today (highlighted) » est un **état de cellule** distinct, et il ne faut pas donner le même traitement
   visuel à « aujourd'hui » et à une plage sélectionnée. *Transposable* : D-06 — remplacer le bandeau de
   colonne de 707 px par un marqueur de date, en gardant la surbrillance de plage pour le survol de créneau.

7. **Setproduct — Calendar UI design** — https://www.setproduct.com/blog/calendar-ui-design
   Employer la couleur **avec parcimonie** pour signaler catégorie ou urgence, et hiérarchiser pour séparer
   les valeurs principales du contexte. *Transposable* : ici quatre teintes de fond coexistent dans la même
   colonne (`--today`, `--is-weekend`, `--p-urgent-bg`, `--p-semaine-bg`), toutes entre 1,02 et 1,08:1 :
   beaucoup de couleur pour très peu de signal. Retirer `--today` et `is-weekend` du fond, garder la
   couleur pour la priorité seule.

8. **Paul Wallas — Designing for Data Density** — https://paulwallas.medium.com/designing-for-data-density-what-most-ui-tutorials-wont-teach-you-091b3e9b51f4
   En resserrant blancs, corps et interlignage on loge ≈ 1,5× plus d'éléments à surface égale ; pour une
   cellule dense, **13 px avec un interlignage de 1,4** donne le meilleur rapport densité/lisibilité.
   *Transposable* : c'est exactement la valeur retenue pour `--fs-body` (§6) ; le fichier est aujourd'hui
   à 12,5 px / 1,35, donc déjà correct — le problème n'est pas la densité du texte mais la hauteur
   allouée à sa boîte.

9. **Nathan Curtis (EightShapes) — Size in Design Systems** — https://eightshapes.com/articles/size-in-design-systems/
   Les systèmes matures proposent un mode **Default** et un mode **High Density** plutôt qu'une seule
   échelle figée ; la densité résulte d'un ensemble cohérent (marges, gouttières, corps), pas d'une taille
   isolée. *Transposable* : le réglage `hauteurCreneau` existe déjà (L659) ; l'étendre en un vrai réglage
   « compact / confortable » qui pilote d'un coup `--slot-h`, `--fs`, les `padding` d'item et `--bins-h`.

10. **Envy Labs — Balancing interface information density** — https://envylabs.com/insights/interface-information-density-best-practices
    La typographie des tableaux de bord dépasse rarement 14 px, avec une densité supérieure à une mise en
    page ordinaire. *Transposable* : valide la base de 13-14 px ici, et confirme qu'il ne faut **pas**
    résoudre D-02 en réduisant le corps — la place doit venir de la répartition verticale.

11. **MDN — `flex-shrink`** — https://developer.mozilla.org/en-US/docs/Web/CSS/flex-shrink
    Un enfant de conteneur flex a `flex-shrink:1` par défaut et se comprime en dessous de sa taille de
    contenu ; les remèdes sont `flex-shrink:0`, `min-height:0` ou `overflow`. *Transposable* : **la cause
    racine de T-1**, le défaut le plus visible de tout le fichier. `.item` hérite de `flex-shrink:1` dans
    `.daybin` et son `min-height:20px` (L279) devient le plancher de compression.

12. **fantasai — Flexbox Implied Minimum Size** — https://fantasai.inkedblade.net/style/discuss/flexbox-min-size/
    La taille minimale implicite (`min-height:auto` en colonne) est censée empêcher précisément ce genre
    d'écrasement. *Transposable* : ici elle est **désactivée** par le `min-height:20px` explicite de la
    ligne 279 — c'est cette valeur, écrite pour garantir une hauteur *minimale*, qui sert de hauteur
    *finale* aux 12 tâches du mercredi. Le correctif complet est `min-height:26px` **plus** `flex:0 0 auto`.

13. **CSS-Tricks — `line-clamp`** — https://css-tricks.com/almanac/properties/l/line-clamp/ et
    **LogRocket** — https://blog.logrocket.com/css-line-clamp/
    Pour du texte multi-ligne, `-webkit-line-clamp` coupe à un nombre de lignes défini **en ajoutant une
    ellipse**, et le texte reste dans le DOM (donc accessible aux technologies d'assistance).
    *Transposable* : T-4 — `.item.slotitem{overflow:hidden}` coupe aujourd'hui au milieu d'un jambage,
    sans ellipse ni indice. Un `line-clamp` piloté par la durée du rendez-vous donne une coupure honnête.

14. **Muzli — Dark Mode Design Systems: patterns, tokens, hierarchy** — https://muz.li/blog/dark-mode-design-systems-a-complete-guide-to-patterns-tokens-and-hierarchy/ et
    **ColorContrast — WCAG-compliant dark UI** — https://www.colorcontrast.org/blog/dark-mode-contrast-accessibility-guide/
    Le 4,5:1 s'applique **à l'identique** en mode sombre ; l'élévation s'y exprime par la luminance
    (chaque niveau plus clair) et non par l'ombre ; toujours passer par des jetons sémantiques.
    *Transposable* : le fichier a déjà la bonne structure de jetons (L50-106) — il suffit de corriger
    `--text-faint` sombre (`#767f8d`, 4,04:1) en `#949daa` (5,96:1) ; et `--shadow` (L105) est inopérant
    sur fond `#1c2027`, c'est `--surface-2`/`--surface-3` qui doit porter l'élévation.

15. **CSS-Tricks — System Font Stack** — https://css-tricks.com/snippets/css/system-font-stack/ et
    **modern-font-stacks** — https://github.com/system-fonts/modern-font-stacks
    La pile système rend instantanément, fonctionne hors ligne et s'adapte à chaque OS.
    *Transposable* : la pile de la ligne 55 est correcte et **doit être conservée** — aucune des
    recommandations de cet audit n'introduit de police distante. Ajouter simplement `system-ui` en tête
    et `"Noto Sans"` avant `sans-serif`.

16. **Smashing Magazine — Designing for Print with CSS** — https://www.smashingmagazine.com/2015/01/designing-for-print-with-css/ et
    **DiDoesDigital — Print styles** — https://didoesdigital.com/blog/print-styles/
    `@page` fixe l'orientation et les marges ; `break-inside:avoid` empêche la coupure d'un bloc ; les
    styles d'écran (hauteurs fixes, `overflow`) doivent être **explicitement neutralisés**.
    *Transposable* : D-07 — la feuille d'impression (L454-466) neutralise `.daybin{max-height}` mais laisse
    `display:flex` et `--slot-h`, d'où 2 088 px pour 733 px disponibles ; et elle oublie `.toast` (D-15)
    et les couleurs de priorité (D-08).

17. **Notion Calendar — guide de prise en main** — https://www.notion.com/help/guides/getting-started-with-notion-calendar
    Les tâches sans date ni heure sont présentées comme des **événements « toute la journée »**, et on leur
    attribue un créneau par glisser-déposer depuis cette rangée vers la grille.
    *Transposable* : c'est précisément le rôle du bac « À faire », mais Notion Calendar laisse cette rangée
    **grandir avec son contenu** au lieu de la plafonner à 190 px — c'est la disposition B.

18. **Sunsama — Daily Planning** — https://www.sunsama.com/daily-planning
    Tâches et réunions sont disposées **côte à côte** dans une colonne de jour unique pour évaluer le temps
    disponible. *Transposable* : c'est la disposition C ; retenue comme modèle de fond mais écartée ici
    parce qu'elle sacrifie la comparaison horaire d'un jour à l'autre, raison d'être d'un semainier.

---

## Annexe — inventaire des captures

| Fichier | Ce qu'il montre |
|---|---|
| `1920x1080-clair.png` / `-sombre.png` | Bandeau « aujourd'hui » de 772 px ; grille vide à 80,5 % |
| `1440x900-clair.png` / `-sombre.png` | Référence des mesures ; bac mercredi écrasé ; rendez-vous mardi invisibles |
| `1366x768-clair.png` / `-sombre.png` | Grille réduite à 211 px sur 500 |
| `1280x720-clair.png` / `-sombre.png` | Cas critique : 163 px de grille, « Réunion d'équipe » coupée |
| `crop-bins-clair.png` / `crop-bins-sombre.png` | T-1 et T-3 en gros plan : texte peint sous l'item suivant |
| `crop-chevauchement.png` | D-01 : trois rendez-vous réduits à des boîtes vides |
| `crop-urgent.png` | T-5 : « …du troisième t » |
| `print-1440-clair.png`, `print-reduit.png`, `impression.pdf` | D-07, D-08, D-15 |
| `preuve-patch.png` | État après `flex:0 0 auto` + `grid-column:1` appliqués à chaud |
| `mesures.json`, `mesures2.json` | Toutes les mesures DOM et les ratios de contraste |
