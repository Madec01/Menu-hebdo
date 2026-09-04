# CARILLON

Survivor-like cadencé par la musique. Vue du dessus, une main sur ZQSD, des vagues qui enflent
et une bande-son qui monte quand tu joues dans le rythme. Folk-horror rural : boue, bronze, brume.

## Lancer le jeu

Le jeu charge des JSON et des modules ES : il faut un serveur HTTP local (pas de `file://`).

```
./serve.sh        # Linux / macOS
serve.bat         # Windows
```
Puis ouvrir http://localhost:8080/ et cliquer pour « sonner » (déblocage audio).

## Contrôles (par défaut, remappables dans les options)

| Action | Clavier | Manette |
|---|---|---|
| Se déplacer | ZQSD / WASD / flèches | Stick gauche |
| Volée (dash, sur le temps) | Espace | A / Croix |
| Contre-battement (parade, sur le temps) | Shift ou clic droit | B / Rond |
| Pause | Échap | Start |

## Structure

Voir `ARCHITECTURE.md` (contrats des modules), `PROMPT.md` (brief), `SOURCING.md` (assets),
`CREDITS.md` (licences de chaque fichier).
