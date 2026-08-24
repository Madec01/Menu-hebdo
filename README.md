# CORE

Un jeu de minage 2D. Tu pilotes une foreuse, tu perces la planete couche par couche,
et ton seul adversaire est le chrono.

> Trois points d'integrite. La roche non soutenue te tombe dessus, et une Faille
> descend derriere toi en accelerant. Se faire ecraser relance le NIVEAU — jamais
> la partie, jamais ta progression.
> Le carburant, lui, ne brule qu'a l'action : creuser large coute cher, reflechir
> ne coute rien.

## Jouer

Ouvre `index.html` dans un navigateur. C'est tout — aucune dependance, aucun build,
aucun serveur.

```
git clone <ce depot> && cd Menu-hebdo
xdg-open index.html      # ou double-clic sur le fichier
```

**`core.html`** est le meme jeu en **un seul fichier autonome** (65 Ko, tous les scripts
inlines) : pratique pour l'envoyer, l'heberger ou le poser sur une cle. Il se regenere
apres n'importe quelle modification du code avec :

```
node build.js
```

## Commandes

| Touche | Effet |
|---|---|
| `Z Q S D` / fleches | Diriger la foreuse. **La direction pressee est la direction de forage** — il n'y a pas de bouton « miner ». |
| Deux directions | Forer en diagonale (creuse un escalier) |
| `Espace` | Turbo — 2 s a vitesse doublee, 15 s de recharge |
| `R` | Recommencer le niveau |
| `Echap` | Retour au menu |
| `M` | Couper le son |

## Ce qu'il faut savoir en jouant

- **L'elan** monte quand tu fores dans la meme direction et te donne jusqu'a +50 % de
  vitesse. Changer de direction en fait perdre la moitie : les trajectoires propres paient.
- **Forer vers le haut coute le double.** Remonter est une decision, pas un reflexe.
- **Rouler dans une galerie deja creusee est bien plus rapide que forer.** Tes tunnels
  deviennent tes autoroutes.
- **La chute est gratuite** : une caverne est un raccourci.
- Les **bonus brillent a travers la roche**. Le detour vaut-il les secondes qu'il coute ?
  C'est la seule vraie question du jeu.

## Contenu

- **3 couches, 14 niveaux** courts (100 a 125 lignes, 15 a 40 s chacun), du sol aux
  grottes de cristal. Une nouveaute par niveau, jamais de remplissage.
- **7 variantes de niveaux** : descente, gisement (sortie scellee par un quota), sceau
  de fin de couche, filon (une veine geante a suivre ou a quitter), effondrement (le
  plafond descend), chute (defouloir en caverne), dedale (murs infranchissables).
- **7 evenements de couche** qui se declenchent en cours de niveau : coup de grisou,
  ruee, secousse, eboulement, vapeurs, filon revele, coupure des phares.
- **Des blocs a comportement**, un par couche : roche friable qui s'effondre en cascade,
  poches de charbon qui explosent en chaine, cristaux en reaction en chaine. Plus des
  coffres, des blocs rebond et de la roche gluante.
- **8 bonus** cumulables en niveaux I a III, **3 pieges**, **31 passifs** dont trois
  legendaires et une famille TERRAIN qui change les regles (Sismographe, Etayeur,
  Charognard, Casse-cou), **5 pactes**, **4 metiers**, **6 pieces de foreuse**.
- **Carburant** : reservoir, bidons enfouis, mode reserve, et toute une famille de
  passifs dediee.
- **3 defis optionnels par niveau**, un **combo** qui multiplie l'or, des **medailles**
  or/argent/bronze, et le **fantome** de ton meilleur passage qui creuse a cote de toi.

## Structure

```
index.html          HUD et ecrans (DOM), styles
src/config.js       toutes les constantes d'equilibrage — couches, niveaux, stats de base
src/content.js      catalogue : bonus, malus, passifs, pieces, metiers, regles de tirage
src/world.js        generation d'un niveau : roche, veines, cavernes, bonus, sceau, sortie
src/drill.js        la foreuse : physique, forage directionnel, elan, turbo
src/game.js         etat de jeu : run, niveaux, stats effectives, butin
src/render.js       rendu canvas
src/ui.js           HUD et ecrans
src/main.js         boucle principale et entrees clavier
src/rng.js          aleatoire deterministe (seed)
src/audio.js        sons de synthese, sans aucun fichier
src/save.js         records locaux
build.js            genere core.html, le fichier unique autonome
core.html           le jeu entier en un seul fichier (genere)
```

**Tout l'equilibrage tient dans `src/config.js` et `src/content.js`** — couches, niveaux,
carburant, evenements, defis, bonus, passifs, pactes, pieces. Le reste n'en depend pas :
changer la durete d'une couche ou le prix d'une piece ne demande de toucher a rien d'autre.

Les temps de medaille ne sont pas inventes : ils sont cales par simulation headless d'un
bot sur douze graines, puis derives de la mediane par niveau (or = mediane x 0,92).

## Les deux formules qui gouvernent le jeu

```
temps_pour_percer_un_bloc = ceil(durete / FORCE) / (VITESSE x elan)
blocs_perces_par_coup     = LARGEUR x LONGUEUR
carburant                 = 0,20 L x blocs reellement excaves
durete(profondeur)        = 1 + 100 x (profondeur / 4000)^2
```

Bonus, passifs et pieces n'agissent que sur ces quatre chiffres.
**Invariant d'equilibrage : entre 1 et 4 coups par bloc, du debut a la fin.**
Le chrono punit la durete, le carburant punit la largeur : deux pressions distinctes.

## Conception

- [docs/game-design-minage.md](docs/game-design-minage.md) — le game design complet :
  boucle de jeu, foreuse, structure en 18 niveaux, les 6 couches et leurs mecaniques.
- [docs/bonus-et-passifs.md](docs/bonus-et-passifs.md) — le catalogue complet :
  19 bonus, 49 passifs, 10 legendaires, 6 pactes, 8 metiers, regles de tirage et
  archetypes de build.
- [docs/v2-propositions.md](docs/v2-propositions.md) — le carburant, la variete des
  niveaux et le ressenti des bonus.
- [docs/v3-challenge.md](docs/v3-challenge.md) — le diagnostic du manque de challenge
  et sa reponse : roche qui tombe, Faille, niveaux courts, integrite. Avec les
  references (Mr. Driller, Spelunky, Downwell) dont chaque mecanique est tiree.
