# CORE

Un jeu de minage 2D. Tu pilotes une foreuse, tu perces la planete couche par couche,
et ton seul adversaire est le chrono.

> Pas de vie, pas d'energie, pas de game over. Un piege te coute des secondes,
> jamais la partie.

## Jouer

Ouvre `index.html` dans un navigateur. C'est tout — aucune dependance, aucun build,
aucun serveur.

```
git clone <ce depot> && cd Menu-hebdo
xdg-open index.html      # ou double-clic sur le fichier
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

## Contenu du MVP

6 niveaux (2 couches), 6 bonus temporaires cumulables en niveaux I-III, 2 pieges,
17 passifs dont une legendaire, 3 metiers de depart, 4 pieces de foreuse, medailles et
records par niveau.

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
```

**Tout l'equilibrage tient dans `src/config.js` et `src/content.js`.** Le reste n'en depend
pas : changer la durete d'une couche ou le prix d'une piece ne demande de toucher a rien
d'autre.

## Les deux formules qui gouvernent le jeu

```
temps_pour_percer_un_bloc = ceil(durete / FORCE) / (VITESSE x elan)
blocs_perces_par_coup     = LARGEUR x LONGUEUR
durete(profondeur)        = 1 + 100 x (profondeur / 4000)^2
```

Bonus, passifs et pieces n'agissent que sur ces quatre chiffres.
**Invariant d'equilibrage : entre 1 et 4 coups par bloc, du debut a la fin.**

## Conception

- [docs/game-design-minage.md](docs/game-design-minage.md) — le game design complet :
  boucle de jeu, foreuse, structure en 18 niveaux, les 6 couches et leurs mecaniques.
- [docs/bonus-et-passifs.md](docs/bonus-et-passifs.md) — le catalogue complet :
  19 bonus, 49 passifs, 10 legendaires, 6 pactes, 8 metiers, regles de tirage et
  archetypes de build.

Le code implemente le perimetre marque « MVP » dans ces deux documents.
