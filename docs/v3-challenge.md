# CORE — v3 : remettre du danger

> Diagnostic et propositions. Aucun code.
> Reponse a trois symptomes — « on s'ennuie », « ca manque de challenge »,
> « c'est long et c'est facile trop longtemps » — qui n'ont qu'une seule cause.

---

## 1. Le diagnostic : il ne peut rien arriver

Les trois symptomes sont le meme probleme.

**Le chrono ne menace rien.** C'est un score, pas un adversaire. Quand tu es lent, il ne
se passe *rien* : pas de son, pas de danger qui approche, aucune consequence avant l'ecran
de fin. Un compteur qu'on ne peut pas perdre ne cree pas de tension, il cree un classement.
C'est tres bien pour un speedrunner a sa dixieme partie ; ca ne tient personne a sa
premiere.

**Il n'y a pas de geste a reussir.** Pendant 90 % du temps, l'action optimale est
« maintenir S ». Aucun reflexe, aucune lecture, aucune decision sous pression. La seule
vraie decision — devier ou pas — se prend toutes les 20 secondes et se paie en secondes
invisibles.

**On a supprime la difficulte par construction.** L'invariant est ecrit noir sur blanc
dans le game design : *1 a 4 coups par bloc, du debut a la fin*. La durete monte, la force
monte, les deux s'annulent. On a fabrique une courbe ou le joueur ne rencontre **jamais**
de resistance. Ce n'est pas un bug d'equilibrage, c'est le resultat exact de la regle qu'on
s'est donnee.

Et « facile pendant longtemps » a une cause supplementaire, mecanique : un niveau fait
200 lignes, soit une bonne minute de descente dans de la roche qui se ressemble. Le
contenu interessant — bonus, evenements, blocs speciaux — est dilue dans un tres grand
volume de remplissage.

> **La cause unique : rien ne peut mal tourner.** Pas de menace, pas d'echec, pas de geste
> a rater. Tant que ca reste vrai, ajouter du contenu ne fera que rendre l'ennui plus varie.

---

## 2. Les references, et ce qu'on leur prend

| Jeu | Ce qu'il fait | Ce qu'on en prend |
|---|---|---|
| **Mr. Driller** | Les blocs non soutenus **tombent** et t'ecrasent. Creuser est dangereux. | **Le chantier n°1.** C'est ce qui transforme creuser en competence. |
| **Spelunky** | Passe un delai, un fantome invincible apparait et te chasse. | Le chrono devient une **menace visible** au lieu d'un score. |
| **Downwell** | Descente rapide, on ne s'arrete jamais ; les munitions ne se rechargent qu'en prenant des risques. | Le **turbo se merite** au lieu d'etre un cooldown gratuit. |
| **Dome Keeper** | Un cycle : creuse, puis reviens defendre. La pression est periodique et annoncee. | Le **rythme par vagues** : des pics de danger, pas une pression continue. |
| **Steamworld Dig** | Le sol s'effondre, la mine se degrade. | Les galeries ne sont pas des acquis definitifs. |
| **Deep Rock Galactic** | La sequence d'extraction : tout devient hostile, il faut fuir. | Les **fins de couche** deviennent des morceaux de bravoure. |
| **Tetris / Puyo** | Le terrain monte, l'espace se referme. | La **variante effondrement**, generalisee. |
| **Nuclear Throne** | Les objets changent les *regles*, pas les chiffres. | Des cartes qui modifient le fonctionnement, pas le pourcentage. |

---

## 3. Chantier n°1 — la roche tombe *(le plus gros gain, de loin)*

Aujourd'hui les blocs flottent : tu peux vider toute une ligne, le plafond reste en l'air.
C'est ce qui rend le forage sans consequence.

**Proposition : toute masse de roche non soutenue tombe.**

- Quand un bloc perd ses appuis, il chute, entrainant ses voisins.
- Un bloc qui tombe sur la foreuse fait des **degats d'integrite** (§7) et l'enfonce.
- On peut le voir venir : une masse fragilisee **tremble et se fissure pendant 0,4 s**
  avant de lacher. Le danger est toujours annonce, jamais gratuit.

Ce que ca change immediatement :

- **Creuser large devient dangereux**, pas seulement couteux en carburant. La largeur de
  taille passe de « bonus evident » a « arme a double tranchant ».
- **Ou tu creuses compte enfin.** Miner par en dessous une masse suspendue, c'est se la
  prendre sur le toit ; la miner par le cote, c'est la faire tomber a cote de toi.
- **Ca devient un outil.** Faire tomber une colonne de 30 blocs pour se creuser un puits
  gratuit, ou pour boucher une galerie derriere soi, c'est le genre d'astuce dont on parle.
- **La cascade de cristal et le charbon explosif prennent enfin tout leur sens** : une
  explosion qui declenche un effondrement en chaine, c'est un moment de jeu.

C'est la modification qui, a elle seule, transforme le forage en competence. Si on n'en
fait qu'une, c'est celle-la.

---

## 4. Chantier n°2 — la menace descend avec toi

Le chrono doit avoir un visage.

**Proposition : la Faille.** A partir de 15 secondes dans un niveau, le plafond commence a
s'effondrer depuis le haut et descend, de plus en plus vite. On la voit : un mur de gravats
et de poussiere, un grondement qui monte, l'ecran qui vire au rouge quand elle approche.

- Vitesse de depart lente, **acceleration continue**. Tu peux la distancer largement en
  jouant bien, elle te rattrape si tu traines.
- Elle **ne tue pas** : se faire rattraper, c'est etre enseveli — quelques secondes bloque,
  de l'integrite en moins, et il faut se degager. Enorme en secondes, nul en progression.
- Elle **rend les detours couteux en temps reel**, pas en score abstrait. Aller chercher un
  filon 20 blocs sur le cote, c'est laisser la Faille gagner 20 blocs. C'est *ca*, un
  arbitrage qu'on ressent.
- Elle **supprime le retour en arriere gratuit** : ce qui est au-dessus est perdu.

Variante pour la fin de couche : la Faille **accelere brutalement** apres le Sceau. La
derniere ligne droite de chaque couche devient une fuite.

---

## 5. Chantier n°3 — le rythme : deux fois plus court, deux fois plus dense

C'est la reponse directe a « c'est long et c'est facile trop longtemps ».

| | Aujourd'hui | Propose |
|---|---|---|
| Longueur d'un niveau | 200 lignes | **90 a 120 lignes** |
| Duree d'un niveau | 25 a 90 s | **30 a 50 s** |
| Nombre de niveaux | 9 | **15 a 18** |
| Couche 1 | 3 niveaux, ~2 min | **2 niveaux, ~70 s** |

Trois regles de conception qui vont avec :

1. **Une nouveaute par niveau.** Chaque niveau introduit exactement une chose — un bloc,
   un danger, une variante — et la suivante arrive avant qu'on s'en lasse.
2. **Pas de remplissage.** Si 20 lignes consecutives ne contiennent ni minerai, ni bonus,
   ni danger, ni cavite, la generation doit y mettre quelque chose. Aucun couloir de roche
   uniforme de plus de 15 lignes.
3. **Alterner les textures de deplacement.** Forer, tomber, rouler dans une galerie,
   glisser : jamais plus de 10 secondes de la meme sensation d'affilee.

La couche 1 doit durer **une minute et demie**, pas cinq. On n'apprend pas a conduire une
foreuse pendant cinq minutes.

---

## 6. Chantier n°4 — des dangers qui se pilotent

Pas de combat, pas d'armes : la conception dit que le jeu parle de roche et de machine.
Mais des dangers qui demandent un **geste**, oui. Trois suffisent pour la couche 1-3 :

- **Le ver de roche.** Il vit dans la pierre, il te suit dans ta propre galerie, il est plus
  rapide que toi en terrain creuse mais lent dans la roche vierge. On ne le tue pas : on le
  seme en creusant du neuf, ou on lui fait tomber un plafond dessus. Un vrai duel de
  pilotage.
- **Les poches de gaz.** Forer dedans a pleine vitesse les enflamme. Il faut ralentir, ou
  les contourner, ou s'en servir pour declencher un effondrement. Une decision, chaque fois.
- **L'eau et la lave.** Elles coulent dans **tes** galeries, en suivant la gravite. Percer
  une poche au mauvais endroit inonde ce que tu viens de creuser. Tu deviens responsable de
  la forme de ton propre tunnel.

Chacun se voit venir, chacun se gere par la conduite. Aucun ne demande de viser.

---

## 7. Chantier n°5 — l'integrite, et la question de l'echec

Il faut le dire franchement : **le pilier « on ne peut pas perdre » est la cause directe du
manque de challenge.** On ne peut pas garder ce pilier intact et esperer de la tension.

Ma proposition, qui garde l'esprit sans l'inertie :

- La foreuse a **3 points d'integrite**, visibles. Ils remontent a chaque station.
- Un ecrasement, une explosion, un ver : **−1**.
- A 0 : la foreuse est hors service, **le niveau redemarre**. Pas la partie. Pas la
  progression. Pas l'equipement.

C'est acceptable **parce que les niveaux font 40 secondes** (§5). Un echec coute 40 secondes
et une lecon, pas une soiree. C'est exactement le contrat de Downwell et de Spelunky : la
mort est frequente, bon marche, et instructive.

Ce qu'on garde intact : **l'expedition, elle, ne se perd jamais.** Aucun game over global,
aucune perte d'equipement, aucun retour en arriere. On perd un niveau, jamais une partie.

---

## 8. Chantier n°6 — le turbo se merite

Le turbo est aujourd'hui un cooldown : il revient tout seul, donc il ne se decide pas.

**Proposition (Downwell) : le turbo ne se recharge qu'en jouant bien.** Chaque bloc de
minerai perce, chaque bonus ramasse, chaque bloc casse pendant un combo en rend un peu.
Rester prudent, c'est ne jamais l'avoir. Enchainer, c'est l'avoir tout le temps.

Meme logique pour deux ou trois cartes : des passifs qui changent la **regle** plutot que le
chiffre.

- *Sismographe* — les masses instables se colorent avant de tomber.
- *Etayeur* — les blocs ne tombent plus derriere toi, seulement devant.
- *Charognard* — la roche qui te tombe dessus se transforme en minerai.
- *Casse-cou* — +40 % de vitesse tant que la Faille est a moins de 15 blocs.
- *Sismique* — chaque effondrement declenche rend du turbo.

Une carte doit pouvoir faire dire « ah, maintenant je joue autrement », pas « +12 % ».

---

## 9. Le visuel : ce qui manque

Tu dis que c'est beau mais qu'il manque quelque chose. A mon avis, il manque **l'espace** :
tout est a plat, sur un seul plan, et on ne sent ni la profondeur, ni le poids, ni le noir.

Par ordre d'impact :

1. **Le parallaxe.** Deux ou trois plans d'arriere-plan qui defilent plus lentement :
   silhouettes de cavernes lointaines, strates, colonnes. C'est ce qui donne la sensation
   d'etre *dans* quelque chose. C'est le plus gros gain visuel pour le moins de travail.
2. **La lumiere de la foreuse.** Un vrai cone de phare oriente dans le sens de la marche,
   qui balaie la roche et projette des ombres portees simples. Aujourd'hui l'obscurite est
   un disque centre ; un cone qui suit la tete, c'est immediatement plus vivant.
3. **La galerie doit avoir l'air creusee.** Bords irreguliers, gravats au fond, poussiere
   en suspension, trainees d'humidite. Aujourd'hui un tunnel est un rectangle noir.
4. **Les premiers plans.** Des rochers et des stalactites qui passent devant la camera,
   floutes. Ca cree instantanement de la profondeur.
5. **La jauge de descente laterale.** Une barre verticale sur le cote montrant le niveau
   entier, ta position, la sortie et la Faille qui descend. Downwell fait exactement ca, et
   c'est ce qui rend la menace lisible.
6. **Le poids.** La camera qui recule un peu en vitesse, qui tremble a l'impact, un flou de
   mouvement leger en chute. Une machine de plusieurs tonnes ne doit pas se deplacer comme
   un curseur.
7. **Les strates doivent se voir.** Des lignes de sediment horizontales, des veines de
   couleur, des fossiles en fond. Aujourd'hui la roche est un damier de bruit.
8. **L'ambiance sonore de couche** : gouttes, grondements lointains, craquements. Le silence
   entre deux bonus est ce qui fait le plus « vide ».

---

## 10. Ce que ca donne, concretement

Les trois premieres minutes, reecrites :

| | Aujourd'hui | Apres |
|---|---|---|
| 0-30 s | Tu maintiens S dans de la terre. | Tu maintiens S, tu apprends la conduite. La Faille apparait a 15 s : tu comprends qu'il faut avancer. |
| 30-60 s | Tu maintiens S. Un bonus. | Tu sous-mines une masse, elle te tombe dessus, tu perds un point d'integrite. Tu comprends la roche. |
| 1-2 min | Tu maintiens S. Station. | Fin du niveau 1-1 (40 s). Station. Niveau 1-2 : un ver de roche te suit, tu apprends a le semer. |
| 2-3 min | Tu maintiens S. Deuxieme station. | Sceau de la couche 1 : la Faille accelere, tu fuis vers le bas, tu perces le bouchon in extremis. |

Meme jeu, memes systemes, meme foreuse. Ce qui change, c'est qu'il **peut arriver quelque
chose** a chaque seconde.

---

## 11. Priorisation

| # | Chantier | Effet | Cout |
|---|---|---|---|
| 1 | **La roche qui tombe** (§3) | Transforme le forage en competence | Moyen |
| 2 | **Niveaux 2x plus courts** (§5) | Supprime l'ennui immediatement | Faible |
| 3 | **La Faille** (§4) | Donne un visage au chrono | Faible |
| 4 | **Integrite et redemarrage** (§7) | Cree un vrai enjeu | Faible |
| 5 | **Parallaxe et cone de lumiere** (§9.1-9.2) | Le plus gros gain visuel | Moyen |
| 6 | **Le turbo qui se merite** (§8) | Recompense le beau jeu | Faible |
| 7 | **Ver de roche, gaz, liquides** (§6) | Du danger a piloter | Eleve |
| 8 | **Le reste du visuel** (§9.3-9.8) | Finition | Progressif |

Les quatre premiers se tiennent : ils forment **un seul lot coherent**, et c'est ce lot qui
repond a ta remarque. Les faire a moitie ne servira a rien — une Faille sans integrite ne
menace toujours rien, une roche qui tombe sans niveaux courts rend juste le remplissage plus
penible.

Apres ce lot, **toute la calibration est a refaire** : les temps de medaille, la
consommation de carburant, la courbe de durete. C'est normal, et c'est le signe que le
changement est reel.

---

## 12. Ce qu'on ne touche pas

- **La foreuse et sa conduite** : 8 directions, forage sans bouton dedie, ancrage, elan,
  turbo, chute libre. C'est bon, ca n'est pas le probleme.
- **Le carburant** tel qu'il est : au volume excave, deux pressions distinctes.
- **Les deux formules** et les quatre stats.
- **L'expedition ne se perd jamais.** On ajoute un echec au niveau, pas a la partie.
- **La structure** : niveaux courts, stations, tirage de 3 cartes, boutique, medailles.
- **Pas de combat, pas d'armes.** Les dangers se pilotent, ils ne se tirent pas.
