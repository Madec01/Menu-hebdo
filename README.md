# Crypte Infinie

Un roguelite d'action en HTML/JS, dans un seul fichier, jouable sur PC et sur téléphone.

## Jouer

Ouvre `index.html` dans un navigateur, ou héberge le dépôt sur GitHub Pages.
Aucune dépendance, aucun serveur nécessaire.

## Contrôles

**PC**
- `ZQSD` / `WASD` / flèches : déplacement
- Souris : visée (visée automatique si la souris ne bouge pas), clic pour tirer
- `Espace` ou `Maj` : dash (invulnérable pendant le dash)
- `P` ou `Échap` : pause

**Téléphone**
- Glisser sur la moitié gauche : joystick de déplacement
- Glisser sur la moitié droite : joystick de visée et de tir (sinon tir automatique)
- Bouton DASH

## Principe

- Chaque étage est un ensemble de salles généré aléatoirement, avec une salle au trésor et un boss.
- Élimine tous les ennemis pour ouvrir les portes. Le boss garde l'escalier vers l'étage suivant.
- Les coffres et chaque étage terminé offrent le choix d'une relique parmi trois (dégâts, cadence, tir multiple, perforation, rebond, vampirisme, bouclier, explosion, gel…).
- La mort est définitive, mais l'essence ◆ ramassée est conservée et permet d'acheter des améliorations permanentes dans le menu.
- Les ennemis se renforcent à chaque étage, sans limite de profondeur.

## Ennemis

Vase (fonce sur toi), Chauve-souris (rapide et erratique), Tourelle (tire à distance), Brute (charge après un temps de préparation), Mage (garde ses distances et tire), et un boss par étage avec des anneaux de projectiles et des charges.

---

## Autres projets de ce dépôt

### SUJET NEUF — `salle-zero/`

Roguelite à salles (phase 1 : salles 1 à 5 du palier ADMISSION), un seul `index.html` + `assets/`,
modes Normal / Test, panneau debug, harness `window.__autoplay`. Voir [`salle-zero/README.md`](salle-zero/README.md).

### TERRA NOVA — `terra-nova/`

Jeu de gestion et de terraformation dont le plateau est une planète 3D
procédurale (Three.js). Voir [`terra-nova/README.md`](terra-nova/README.md).

```bash
cd terra-nova && npm install && npm run dev
```
