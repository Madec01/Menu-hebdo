# Idées

## Salles (6)

**Verre fumé** (contrainte)
Seule la bande de cases alignée avec l'axe de gravité actuel (la « verticale » de chute) est nette ; le reste est flouté comme du verre dépoli. Tourner déplace la bande nette, forçant à lire le plateau différemment à chaque rotation.
*(Inspiration : Tetris Effect)*

**Cadran** (contrainte rotation)
La jauge de rotation devient un cadran à 4 crans, un par orientation ; chaque orientation utilisée se verrouille jusqu'à ce que les 3 autres aient servi. Empêche de spammer toujours le même quart de tour.
*(Inspiration : Luck be a Landlord)*

**Double fond** (contrainte)
Une rotation à 180° fait glisser un fond caché sous la grille, qui remplace la rangée du bas actuelle par une rangée surprise (bonus ou piège). Un seul déclenchement par salle.
*(Inspiration : jouet en bois à double fond, thème du jeu)*

**Chape de plomb** (contrainte)
Des billes marquées « lestées » ne bougent qu'après deux rotations consécutives dans le même sens ; il faut planifier une séquence au lieu de tourner au hasard.
*(Inspiration : Monument Valley)*

**Entonnoir** (étapes, 3 sous-salles, grille et niveau conservés)
Chaque sous-salle a une colonne de moins que la précédente ; il faut tourner pour redistribuer les billes vers le centre avant que la largeur ne les coince.
*(Inspiration : Tetris — puits qui se resserre)*

**Le Métronome** (élite/boss)
À chaque tour, le boss impose la rotation exactement inverse de celle jouée par le joueur au tour précédent, l'obligeant à anticiper deux coups à l'avance au lieu de réagir.
*(Inspiration : Tetris Effect, jeux de rythme)*

## Compétences de run (6)

**Contrepoids** (Commun)
La rotation suivante est gratuite si le tap qui la précède a détruit un groupe de 6+ ; sinon coût normal. Récompense le skill d'enchaînement plutôt que la rotation systématique.
*(Inspiration : Peglin — momentum de combo)*

**Roue dentée** (Épique)
Toutes les 4 rotations effectuées dans la salle (compteur visible), chaque spéciale présente sur le plateau explose simultanément. Encourage à tourner même sans besoin immédiat.
*(Inspiration : Vampire Survivors — paliers d'évolution)*

**Dernier axe** (Rare)
Tant que la gravité reste sur le même axe (horizontal ou vertical) après une rotation, les spéciales orientées sur cet axe gagnent +1 rayon ; changer d'axe remet le bonus à zéro.
*(Inspiration : Tetris Effect — bonus de continuité)*

**Boussole brisée** (Rare, malus)
Chaque rotation a 50 % de chance d'enchaîner un quart supplémentaire dans le même sens (max 180°), mais chaque quart cumulé donne +1 rayon à la prochaine spéciale créée.
*(Inspiration : Balatro — risque/récompense)*

**Double engagement** (Épique, synergie)
En la choisissant, le choix de compétence suivant est restreint à la même catégorie (ex. « Rotation ») ; en échange, les deux compétences de cette catégorie appliquent leurs effets à 150 %.
*(Inspiration : Slay the Spire — archétypes de build)*

**Lest largué** (Commun)
À chaque rotation, la bille-pierre la plus proche du nouveau « haut » (le point le plus loin de la gravité) redevient une bille normale.
*(Inspiration : Royal Match — obstacles qui se dissolvent)*

## Éléments (4)

**Toupie** (3 activations)
À chaque rotation du plateau, elle pivote sur elle-même et convertit la bille adjacente dans le sens de rotation à sa couleur actuelle ; à la 3e activation, elle libère une bombe de couleur.
*(Inspiration : Peglin)*

**Ancre de bois** (fixe, 2 activations)
Ne tombe jamais mais retient une case en dessous d'elle pendant une rotation supplémentaire (les billes juste sous elle chutent un tour plus tard) ; 2 activations la brisent et libèrent tout d'un coup.
*(Inspiration : jouet en bois à contrepoids)*

**Coussin d'air** (1 activation, fragile)
Gèle sa case et les 4 cases orthogonales pendant la rotation suivante (elles ne tombent pas), créant une poche stable à exploiter pour construire un groupe.
*(Inspiration : Monument Valley — géométrie figée un instant)*

**Origami** (2 activations)
Après la prochaine rotation, il se déplie en 3 billes aléatoires qui comblent les cases vides autour de lui ; la 2e activation le transforme en bille-ligne orientée selon la gravité du moment.
*(Inspiration : esthétique papier du jeu, Toon Blast)*

## Feel (2)

**Flottement de chute**
À la rotation, un temps de suspension de 0,15 s laisse les billes en apesanteur avant qu'elles ne retombent avec un cliquetis de billes de verre dont le volume et la hauteur dépendent du nombre de billes qui tombent.
*(Inspiration : Tetris Effect — impact du hard drop)*

**Halo directionnel**
Une flèche en pointillés façon craie/papier indique en permanence le sens de gravité sur le bord de la grille, et pulse dans la couleur de la spéciale la plus proche quand elle est activable, pour lire l'axe sans ambiguïté.
*(Inspiration : Monument Valley — lisibilité spatiale)*

## Top 5 pour la phase 2

- **Cadran** : enseigne dès le début la grammaire complète de la rotation (les 4 orientations) au lieu de laisser le joueur en négliger une, structurant la lecture des salles.
- **Contrepoids** (compétence) : coût d'implémentation faible, renforce immédiatement la boucle taper→tourner déjà posée par la règle « +1 jauge par groupe de 6+ ».
- **Toupie** (élément) : élément signature qui rend la rotation visible et gratifiante à l'écran, bon candidat pour les captures/trailers de la phase 2.
- **Halo directionnel** (feel) : correctif de lisibilité peu coûteux et nécessaire dès que les salles à contrainte de gravité se multiplient.
- **Double engagement** (compétence) : introduit une vraie synergie inter-compétences (archétypes), un axe encore absent du §6.2 et différenciant pour la boucle de run.
