# CORE — propositions v2 : carburant, variete, ressenti des bonus

> Trois chantiers, tous **additifs** : rien de ce qui existe n'est remis en cause.
> Voir §5 pour la liste explicite de ce qu'on ne touche pas.

---

## 1. Le carburant

### 1.1 La regle qui change tout

On avait ecarte une jauge d'energie parce qu'elle transformait le jeu en logistique.
Le carburant peut etre l'inverse, a une condition non negociable :

> **Le carburant brule a l'action, jamais au temps.**

Reflechir ne coute rien. Rouler ne coute presque rien. Tomber ne coute rien.
**Forer coute, et forer fort coute cher.** Le chrono punit deja la lenteur : si le
carburant la punissait aussi, on doublerait la meme pression et le jeu deviendrait
etouffant. La ou le chrono dit *« va vite »*, le carburant dit *« choisis ton chemin »*.
Ce sont deux pressions differentes, et c'est pour ca qu'elles se completent.

### 1.2 Ce que ca repare vraiment

Aujourd'hui, la trajectoire optimale est verticale. On maintient `S`. C'est **la** cause de
la repetitivite : il n'y a pas d'itineraire, il y a une ligne.

Avec un reservoir, les bidons enfouis deviennent des **points d'ancrage sur la carte**. Le
trajet optimal n'est plus « tout droit », c'est *« bidon a gauche, puis la veine, puis
plonger dans la caverne »*. Le joueur passe de **tenir une touche** a **tracer une route**.

Second effet, aussi important : creuser en 6 de large devient un **choix** au lieu d'une
evidence. Aujourd'hui la largeur est strictement meilleure ; demain elle vide le reservoir.

### 1.3 Chiffres de depart

| | Valeur |
|---|---|
| Reservoir de base | **100 L** |
| Cout d'un coup de forage | **0,25 L x largeur x longueur** (soit 0,5 L en 2x1) |
| Turbo | consommation **x3** |
| Forage vers le haut | consommation **x1,5** |
| Roulage dans une galerie | 0,05 L/s (negligeable) |
| Chute, reflexion, immobilite | **0 L** |
| Bidon enfoui | **+25 L**, environ 8 par niveau, visibles a travers la roche |
| Plein a la station | gratuit et automatique |

A 3 coups/s en 2x1, un plein dure **environ 65 secondes de forage continu** — soit
exactement un niveau en ligne droite, sans marge. Tout detour se paie en bidons.
En 6x2, le meme plein tient **11 secondes**. C'est la le dilemme.

### 1.4 La panne seche ne termine jamais une partie

A 0 L, la foreuse passe en **mode reserve** : vitesse divisee par 3, turbo interdit, liseré
rouge a l'ecran, alarme sonore. On peut finir le niveau — tres lentement. La sanction est
enorme en secondes et nulle en progression. C'est la meme philosophie que le reste du jeu :
**on perd du temps, jamais la partie.**

Filet de securite : sous 15 L, un bidon est garanti dans un rayon de 20 blocs et son halo
devient beaucoup plus visible. On ne doit jamais mourir de soif par malchance de generation.

### 1.5 Le contenu que ca ouvre

**Pieces de foreuse** — *Reservoir* (+40 L) · *Injection propre* (−15 % de consommation)

**Passifs** — *Econome* (−12 %, cumulable) · *Reserve profonde* (+30 L) ·
*Goutte a goutte* (chaque bloc de minerai rend 1 L) · *Turbo sec* (le turbo ne consomme
rien) · *Recuperateur* (chaque chute de 10 m rend 3 L, la chute devient une ressource) ·
*Jerricane* (les bidons rendent le double)

**Bonus temporaire** — ***Nitro*** : consommation nulle pendant 12 s. C'est le bonus qu'on
garde pour la couche la plus dure, et le premier vrai **bonus qu'on choisit quand
declencher**.

**Pacte** — *Moteur deux temps* : vitesse x1,5, consommation x2.

Le carburant donne enfin un deuxieme axe a l'economie : aujourd'hui tout l'or va dans la
puissance brute, demain il arbitre entre **puissance** et **autonomie**.

---

## 2. Casser la repetitivite

Par ordre de rapport valeur / cout.

### 2.1 Les 4 variantes de niveaux deja concues, mais pas encore codees

Le MVP n'implemente que *Descente*, *Gisement* et *Sceau*. Quatre autres sont deja
specifiees et ne demandent presque rien :

- **Effondrement** — le plafond descend en continu. Pas le temps de fouiller. Pression pure.
- **Dedale** — beaucoup de roche indestructible, un seul passage. On lit le terrain au lieu
  de forcer.
- **Filon** — une immense veine serpente vers le fond. La suivre paie, la quitter va plus
  vite. L'arbitrage central du jeu tient dans un seul niveau.
- **Chute** — presque pas de roche. Vingt secondes de defouloir, en recompense.

C'est le plus gros gain de variete pour le moins de travail : **7 textures de niveaux au
lieu de 3**, sans une seule mecanique nouvelle a inventer.

### 2.2 Evenements de couche

Une ou deux fois par niveau, un evenement se declenche : banniere en haut de l'ecran,
son dedie, changement de couleur d'ambiance. Duree 8 a 20 secondes.

| Evenement | Effet |
|---|---|
| **Coup de grisou** | Chaque bloc mine a 20 % de chance d'exploser en rayon 2 |
| **Ruee** | Tout le minerai vaut double |
| **Secousse** | Toute la couche perd 30 % de durete |
| **Eboulement** | Le plafond se referme derriere vous : plus de retour en arriere |
| **Vapeurs** | Consommation de carburant doublee |
| **Filon revele** | Un filon-mere apparait sur la carte, 20 s pour l'atteindre |
| **Coupure** | Les phares s'eteignent, on ne voit qu'a 4 blocs |

Deux niveaux avec la meme structure ne se jouent plus pareil. C'est peu de code pour
beaucoup de texture.

### 2.3 Une roche qui ne se vaut pas partout

Aujourd'hui un bloc n'a qu'une durete. Donner un **comportement** a un type de bloc par
couche, c'est la « mecanique signature » du game design, et c'est ce qui fait qu'on
reconnait une couche les yeux fermes :

- **Roche friable** (couche 1) — cede en un coup, mais s'effondre **en cascade** sur ses
  voisines. Trouver le bon point d'attaque devient un plaisir.
- **Poche de charbon** (couche 2) — explose, et enflamme les poches voisines. Reactions en
  chaine.
- **Bloc-coffre** — 5 coups au lieu d'un, mais un gros butin. Un mini-choix, partout.
- **Roche rebond** — renvoie la foreuse. Piege, ou raccourci vers le haut.
- **Roche gluante** — traversee au ralenti. A contourner.

### 2.4 Defis optionnels par niveau

Trois defis affiches au depart, or bonus a la cle :
*« finir sans jamais forer vers le haut »*, *« ramasser 3 bonus »*, *« ne jamais passer en
reserve »*, *« finir avec plus de 50 L »*, *« 20 blocs sans lacher la meme direction »*.

Ils ne changent pas le niveau, ils changent **la facon dont tu le joues** — et donc ils
rendent un niveau deja connu a nouveau interessant. Excellent rapport valeur / cout.

### 2.5 Le combo

Un compteur monte quand on enchaine minerai et bonus sans temps mort, et donne un
multiplicateur d'or croissant. Il rend lisible le fait de **bien jouer**, et donne une
raison de viser une trajectoire elegante plutot que fonctionnelle.

### 2.6 Le foreur fantome

Le replay de ton meilleur temps creuse a cote de toi, en semi-transparent. C'est la
meilleure motivation anti-repetitivite qui existe : le niveau ne change pas, mais il y a
soudain quelqu'un a battre. Aucun risque, aucune punition.

---

## 3. Faire sentir les bonus

Le diagnostic est juste : un bonus ramasse change des chiffres, mais ne change presque rien
a ce que le joueur **voit**. Les icones sont dans le coin haut-droite, c'est-a-dire
exactement la ou l'oeil n'est pas : il est sur la foreuse.

Regle generale : **un bonus doit se voir sur la machine, pas dans un coin de l'ecran.**

### 3.1 L'instant du ramassage — 0,4 seconde a soigner

1. **Arret sur image de 100 ms.** Rien ne dit « tu as eu quelque chose » comme un micro-gel.
2. **Le nom du bonus explose au centre de l'ecran**, en gros, a sa couleur, puis **file
   vers son icone du HUD** en retrecissant. L'oeil apprend ou regarder.
3. **Flash plein ecran** de 200 ms a la couleur du bonus, en vignette sur les bords.
4. **Secousse** et gerbe de particules a la couleur du bonus.
5. **Son a trois etages** : niveau I, II et III ont trois sons distincts, de plus en plus
   glorieux. Le III doit etre une petite fanfare.
6. **Ralenti de 0,3 s** pour un bonus epique uniquement — il doit rester rare.

### 3.2 Pendant toute la duree — l'etat doit etre permanent et lisible

7. **La foreuse change d'apparence.** C'est le point le plus important de tout ce document :
   - *Titan* — tete de forage rouge incandescente, visiblement plus grosse
   - *Frenesie* — trainee de vitesse, foret flou, etincelles continues
   - *Expansion* — la tete s'elargit reellement a l'ecran
   - *Perforation* — le foret s'allonge en lance
   - *Nitro* — flammes bleues aux echappements
   - *Aimant* — arcs electriques vers le minerai proche
8. **Un lisere colore par bonus actif** sur le bord de l'ecran. Deux bonus = deux liseres.
   On connait son etat sans rien lire.
9. **Les icones remontent pres de l'action** : au-dessus de la foreuse plutot que dans le
   coin, ou au minimum beaucoup plus grosses.
10. **La roche reagit** : sous Frenesie les fissures partent en etincelles, sous Titan les
    blocs explosent au lieu de se fissurer.
11. **Trois bonus ou plus = surchauffe** : distorsion de l'image, musique saturee, teinte
    orangee. Le pic de puissance doit se voir de loin.

### 3.3 La fin du bonus doit se sentir aussi

12. **Dernier tiers** : l'icone clignote, un tic-tac monte.
13. **A l'expiration** : « clac » sonore grave, breve desaturation de l'ecran, la foreuse
    reprend son apparence normale. La perte doit faire un petit vide — c'est ce qui donne
    envie du suivant.

### 3.4 Avant meme le ramassage

14. Un bonus **a moins de 6 blocs** pulse plus vite et emet un son de proximite. On doit le
    *desirer* avant de l'avoir.

---

## 4. Ordre de mise en oeuvre conseille

| # | Chantier | Pourquoi d'abord |
|---|---|---|
| 1 | **Ressenti des bonus** (§3.1 a §3.3) | Aucune regle ne change, le jeu parait deux fois meilleur. C'est du pur gain. |
| 2 | **Le carburant** (§1) | Change la nature du trajet. A faire avant d'ajouter du contenu, parce que tout s'equilibre autour. |
| 3 | **Les 4 variantes de niveaux** (§2.1) | Deja concues, gros gain de variete, aucune mecanique nouvelle. |
| 4 | **Evenements de couche** (§2.2) | Peu de code, beaucoup de texture. |
| 5 | **Blocs a comportement** (§2.3) | Donne son identite a chaque couche. |
| 6 | **Defis et combo** (§2.4, §2.5) | Rejouabilite d'un niveau deja connu. |
| 7 | **Foreur fantome** (§2.6) | Le plus gros travail, a garder pour la fin. |

Apres 1 et 2, il faudra **rejouer la calibration par simulation** : le carburant rallonge
les niveaux et rend la largeur plus chere. Les temps de medaille actuels ne vaudront plus.

---

## 5. Ce qu'on ne touche pas

Tout ce qui suit reste exactement en l'etat :

- **Les deux formules** et les quatre stats. Le carburant est un cinquieme chiffre a cote,
  il n'entre pas dedans.
- **Le pilotage** : 8 directions, forage sans bouton dedie, ancrage, rotation de tete,
  elan, turbo, marche arriere, chute libre.
- **L'absence de mort.** Aucun ajout ne doit pouvoir terminer une partie. La panne seche
  non plus.
- **La structure** en niveaux courts, stations, tirage de 3 cartes, boutique, medailles.
- **L'invariant** : 1 a 4 coups par bloc, du debut a la fin.
- **Le chrono comme adversaire unique.** Le carburant ne le remplace pas, il ne s'y ajoute
  pas non plus : il ne coute des secondes que si on le gere mal.
