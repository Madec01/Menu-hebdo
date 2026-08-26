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
| `logicgates-v6.11.html` | v6.11 : ⚡ Énergie & ondes, phase 1 — solveur nodal du continu, troisième type de liaison (bornes hexagonales), pile à résistance interne, ampoule, interrupteur de puissance, rail de masse |
| `logicgates-v6.19.html` | v6.19 : ⚡ lot 5 — chaudière, turbine à vapeur, panneau solaire, thermopile, chapitre 32 ; et six onglets qui débordaient de l'écran, dégonflés dans les trois ateliers |
| `logicgates-v6.20.html` | v6.20 : ⚡ lot 6 — horloge du simulateur et ralenti, sous-pas de temps, condensateur, bobine, générateur alternatif |
| `logicgates-v6.21.html` | v6.21 : tracé des câbles — le contournement se faufile entre les obstacles, et un fil ne traverse plus un boîtier |
| `logicgates-v6.18.html` | v6.18 : l'atelier ⚡ passe à quatre onglets (Le continu · Mesure · Produire · Câblage) — une rangée de quinze tuiles débordait de l'écran et le composant du bout devenait introuvable |
| `logicgates-v6.17.html` | v6.17 : ⚡ lot 4 — produire du courant : aimant qu'on promène, bobine (loi de Faraday), dynamo à manivelle avec effort et retard sentis, oscilloscope enfin signé |
| `logicgates-v6.16.html` | v6.16 : ⚡ lot 3 — chapitre 31 « Le courant continu » (10 leçons à vraie condition de réussite), la leçon ouvre son atelier, quatre montages d'exemple ⚡ |
| `logicgates-v6.15.html` | v6.15 : onglet Câblage propre à l'atelier ⚡ (barres de puissance en tête), barres redessinées en jeu de barres à vis, fusible, et les deux mécanismes du chapitre à venir (condition de réussite, atelier de la leçon) |
| `logicgates-v6.14.html` | v6.14 : rail et tunnel de puissance ; clic simple = sélection, Maj + glisser = duplication, Ctrl+X ; tracé des câbles — rang d'arrivée, écartement par voisinage, contournement de tous les boîtiers |
| `logicgates-v6.13.html` | v6.13 : ⚡ lot 2 — résistance à anneaux, potentiomètre de puissance, voltmètre, ampèremètre, générateur de tension réglable avec limitation de courant, oscilloscope ⚡ à base de temps réelle, court-circuit signalé |
| `logicgates-v6.12.html` | v6.12 : lot 1 corrigé — câbles droits (l'écartement ne se cumule plus), bornes de puissance toutes à la même hauteur, éclat du filament en puissance^2,2 avec couleur de température, la masse n'est plus obligatoire pour que le courant circule |

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
node test/run.js versions/logicgates-v6.10.html --smoke
node test/run.js versions/logicgates-v6.11.html --smoke
node test/run.js versions/logicgates-v6.12.html --smoke
node test/run.js versions/logicgates-v6.13.html --smoke
node test/run.js versions/logicgates-v6.14.html --smoke
node test/run.js versions/logicgates-v6.15.html --smoke
node test/run.js versions/logicgates-v6.16.html --smoke
node test/run.js versions/logicgates-v6.17.html --smoke
node test/run.js versions/logicgates-v6.18.html --smoke
node test/run.js versions/logicgates-v6.19.html --smoke
node test/run.js versions/logicgates-v6.20.html --smoke
node test/run.js versions/logicgates-v6.21.html          # suite complète
```
