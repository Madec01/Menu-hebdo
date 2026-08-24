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

Les copies antérieures ne connaissent évidemment pas les tests des versions
suivantes : on vérifie seulement qu'elles démarrent.

```sh
node test/run.js versions/logicgates-v5.1-corrige.html --smoke
node test/run.js versions/logicgates-v6.0.html --smoke
node test/run.js versions/logicgates-v6.1.html --smoke
node test/run.js versions/logicgates-v6.2.html            # suite complète
```
