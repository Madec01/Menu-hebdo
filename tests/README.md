# Tests

Le jeu est un fichier HTML autonome : il n'a aucune dépendance. La suite de
tests, elle, pilote un vrai navigateur.

```sh
npm install -g playwright && npx playwright install chromium   # une seule fois
node tests/suite.mjs                    # tous les cas
node tests/suite.mjs reseau qualite     # seulement ceux dont le nom contient ça
```

La suite sort en code 1 si un cas échoue.

## Ce qui est couvert

| Cas | Ce qu'il vérifie |
|---|---|
| `didacticiel` | le contremaître avance d'étape à chaque geste du joueur |
| `chaine-age1` | des chips sortent, se vendent, et rien ne part au rebut avant l'âge 3 |
| `conservation-matiere` | rien ne se perd : achats = consommations + inventaire, à chaque étage |
| `reseau-convoyeurs` | les bandes se chaînent, se raccordent seules, et la matière traverse |
| `qualite-age3` | l'huile vieillit, le bain se refait, le raté part chez le client s'il n'est pas trié |
| `modes-de-partie` | le bac à sable ne débite rien, ne verrouille rien, ne fait pas faillite |
| `saut-de-niveau` | les cinq âges s'atteignent, l'atelier prend la bonne taille |
| `auto-verifications` | les 9 invariants du jeu (`verifierPartie()`) tiennent sur une usine qui tourne |
| `sauvegarde` | aller-retour complet : la partie rechargée est identique au bit près |
| `rythme-age1` | l'âge 1 se boucle dans la fenêtre de 15 à 35 minutes réelles |
| `performance` | un tick reste sous 2 ms, une image sous 40 ms en rendu logiciel |
| `recherche-age4` | pas de bureau, pas d'étude ; sinon la recette sort, notée, commentée, ensachable |
| `raccord-sans-coupure` | un colis passe d'une bande à l'autre d'un bloc, sans se faire couper en deux |
| `quais-et-rangement` | deux quais, chaque marchandise dans le bon, bac dédié et filtres de bande |
| `batiments-et-equipe` | la salle de pause remet debout, la formation forme, la prime remonte le moral |
| `cour-et-murs` | machines dedans, bâtiments dehors, sortie par les portes, mur qui pousse la cour |
| `garde-manger` | la table du labo se tient, et chaque verrou s'ouvre pour la bonne raison |
| `bande-courte-et-quai` | une bande touche le quai, et une seule tuile suffit à relier deux machines |

## Les invariants, aussi dans le jeu

`verifierPartie()` est exposé dans la page. Le panneau de développement
(<kbd>F2</kbd> → « Vérifier la partie ») le lance et affiche le rapport, ce qui
permet de contrôler une partie en cours sans quitter le jeu.

Il contrôle : la cohérence de la grille, le respect des murs (machines
dedans, bâtiments dehors), l'absence de nombre aberrant, le
raccordement des convoyeurs, l'état de l'équipe, la validité des recettes, leur
rentabilité, la prise en charge des objectifs d'âge, et la fidélité de la
sauvegarde.

## Écrire un cas

Un cas reçoit le navigateur, ouvre une page neuve avec une partie fraîche, et
renvoie la liste de ses échecs. `jeu(...)` évalue du code dans la page — tout
l'état du jeu y est accessible — et `sim(jours)` fait tourner la simulation.

```js
cas("mon-cas", async (nav) => {
  const { page, jeu, sim, erreurs } = await contexte(nav);
  const v = verif();
  await jeu("poserMachine('laveuse',3,2,0); acheter('pdt_brutes',500)");
  await sim(3);
  v.aumoins("ça produit", await jeu("etat.progression.produits.pdt_lavees||0"), 100);
  await page.close();
  return { echecs: v.echecs.concat(erreurs) };
});
```
