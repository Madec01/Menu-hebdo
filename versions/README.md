# Copies figées

Chaque fichier est une version complète et autonome du jeu, conservée
telle quelle. Elles ne sont jamais modifiées : en cas de problème sur la
version en cours, il suffit d'en recopier une par-dessus `logicgates.html`.

| Fichier | Contenu |
| --- | --- |
| `logicgates-v5.0-livre.html` | la v5 telle que livrée (106 missions, inspecteur, analyseur) |
| `logicgates-v5.1-corrige.html` | v5 + guide complété, modale analyseur réparée, persistance des réglages, bus visibles, export PNG recadré, appui long |
| `logicgates-v6.0.html` | v6 : registre de composants, 54 nouveaux composants (capteurs, actionneurs, régulation, procédés), tuteur avec solveur, infobulle, rotation, tunnels, 130 missions |
| `logicgates-v6.1.html` | v6.1 : deux ateliers (électronique / process), réglages en unités réelles (°C, bar, %, tr/min), capteurs à deux seuils, tuyauterie raccordable, PID, 142 missions |
| `logicgates-v6.2.html` | v6.2 : mesure continue (fin du plafond 8 bits), GRAFCET, pannes à diagnostiquer, voyants de couleur, tuteur sur toutes les missions, 148 missions |
| `logicgates-v6.3.html` | v6.3 : GRAFCET normalisé (divergences ET/OU, réceptivités en expression, temps de scrutation) avec éditeur graphique dédié |
| `logicgates-v6.4.html` | v6.4 : tracé des câbles en angles droits, écartement des couloirs, trois modes de tracé |
| `logicgates-v6.5.html` | v6.5 : rail de distribution, cadres titrés, pose d'un composant déjà relié, guides d'alignement, menu contextuel, plan miniature, recherche sur le plan |
| `logicgates-v6.6.html` | v6.6 : barre d'outils refondue — trois ateliers, onglets redistribués, barre de favoris, repli |
| `logicgates-v6.7.html` | v6.7 : la leçon sur le schéma (pages, halo, reprise), bandeau de victoire, sommaire des leçons |
| `logicgates-v6.8.html` | v6.8 : plus de colonne latérale — énoncé en bandeau, table repliable, boutons flottants, leçon en carte large |
| `logicgates-v6.9.html` | v6.9 : le cartouche de leçon posé sur le plan — placement automatique, trait vers la cible, déplaçable |
| `logicgates-v6.10.html` | v6.10 : la carte du cours — 30 tuiles de chapitre, anneaux de progression, leçons en pastilles |

Les copies antérieures ne connaissent évidemment pas les tests des versions
suivantes : on vérifie seulement qu'elles démarrent.

```sh
node test/run.js versions/logicgates-v5.1-corrige.html --smoke
node test/run.js versions/logicgates-v6.0.html --smoke
node test/run.js versions/logicgates-v6.1.html --smoke
node test/run.js versions/logicgates-v6.2.html --smoke
node test/run.js versions/logicgates-v6.3.html --smoke
node test/run.js versions/logicgates-v6.4.html --smoke
node test/run.js versions/logicgates-v6.5.html --smoke
node test/run.js versions/logicgates-v6.6.html --smoke
node test/run.js versions/logicgates-v6.7.html --smoke
node test/run.js versions/logicgates-v6.8.html --smoke
node test/run.js versions/logicgates-v6.9.html --smoke
node test/run.js versions/logicgates-v6.10.html           # suite complète
```
