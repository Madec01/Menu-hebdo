# SOURCING.md — récupération d'assets dans cette session

## 1. Réseau : ce qui passe, ce qui est bloqué

La session sort par un proxy d'entreprise qui **refuse la plupart des sites** (CONNECT 403).
Ne pas insister sur un hôte bloqué, ne pas contourner. Testé le 2026-09-04 :

| Accessible | Bloqué |
|---|---|
| `github.com` (clone git, pages via WebFetch), `raw.githubusercontent.com`, `objects.githubusercontent.com` | opengameart.org, kenney.nl, freesound.org, itch.io, incompetech.com, freepd.com, archive.org, pixabay.com |
| `registry.npmjs.org` (métadonnées + tarballs), `pypi.org`, `files.pythonhosted.org` | cdnjs, jsdelivr, unpkg, wikimedia, huggingface, codeberg, gitea, sourceforge |
| `gitlab.com`, `bitbucket.org`, `fonts.gstatic.com`, `storage.googleapis.com`, `s3.amazonaws.com` | `codeload.github.com` (403 sur les zip), `api.github.com` (limitée au dépôt de la session : pas de recherche, pas de `contents` d'autres dépôts) |

L'outil **WebSearch** fonctionne (découverte de dépôts GitHub qui hébergent des packs).
**WebFetch** fonctionne sur `github.com` (README, arborescence d'un dépôt) mais pas sur les sites bloqués.

## 2. Techniques qui marchent

```bash
# Dépôt public entier (petit/moyen)
git clone --depth 1 https://github.com/OWNER/REPO.git
# Gros dépôt : clone sans blobs puis extraction ciblée
git clone --filter=blob:none --depth 1 --sparse https://github.com/OWNER/REPO.git R
cd R && git sparse-checkout set "Chemin/Dossier" && git ls-tree -r --name-only HEAD | head
# Fichier isolé
curl -sSL -o out.png https://raw.githubusercontent.com/OWNER/REPO/BRANCH/chemin/fichier.png
# Paquet npm (ex. polices @fontsource, licence OFL)
curl -sS https://registry.npmjs.org/@fontsource/im-fell-english/latest | python3 -c "import sys,json;print(json.load(sys.stdin)['dist']['tarball'])"
curl -sSL -o pkg.tgz <tarball> && tar xzf pkg.tgz
# Polices Google (dépôt google/fonts, dossier ofl/<famille>/)
curl -sSL -o UnifrakturCook-Bold.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/unifrakturcook/UnifrakturCook-Bold.ttf
```

Outils locaux : `python3` avec `Pillow`, `numpy`, `soundfile` ; ffmpeg statique :
`FF=$(python3 -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())")` (encodeurs libvorbis/libopus OK). Pas de `gh`.

## 3. Déjà téléchargé (cache local, scratchpad)

Racine : `/tmp/claude-0/-home-user-Menu-hebdo/ba2c9172-fe8d-5ae0-8c32-08cae3270aad/scratchpad/probe/`

- `vcsl/` — **Versilian Community Sample Library**, CC0 (fichier `LICENSE`), ~5,8 Go de WAV : Tubular Bells, Hand Bells (Nepalese), Bell Tree, Hand Chimes, Frame Drum, Bass Drum, Snare Rope Tension, Timpani, Claps, Gong, Anvil, Ratchet, Sleigh Bells, Woodblock, Slapstick, Shakers, Wine Glasses, Psaltery (archet + pincé), Folk Harp, Harpsichords, Pipe Organ, Renaissance Organ, Recorders, Didgeridoo, Ocean Drum, Harmonica…
- `vsco/` — **VSCO 2 Community Edition**, CC0, clone sans blobs (`git sparse-checkout set` pour récupérer un dossier) : Strings (violon, alto, violoncelle, contrebasse, sustain/pizz/trem), Brass (cor, trombone, trompette, tuba), Woodwinds, Percussion, Keys/Organ.
- `lpc/` — **Universal LPC Spritesheet Character Generator**, licences par fichier dans `CREDITS.csv` (OGA-BY 3.0 / CC-BY-SA 3.0 / GPL 3.0), `spritesheets/` (corps, vêtements, armes, 64×64, animations walk/slash/thrust/spellcast/hurt/shoot, 4 directions).
- Sonatina Symphonic Orchestra : `https://github.com/peastman/sso` accessible (CC Sampling Plus 1.0 ; contient un chœur — à vérifier dans le dépôt).

Pistes à explorer (non vérifiées — à cloner et à lire la licence avant tout usage) : `Tiddybub/2d-assets` (index de 1 100 packs CC0, vérifier s'il héberge les fichiers), miroirs GitHub des packs 0x72 / Kenney / DCSS (`crawl/crawl`, tuiles CC0 32×32), `game-icons/icons` (CC-BY 3.0), `sfzinstruments/*` (bibliothèques SFZ libres), soundfonts libres (FluidR3 MIT, GeneralUser GS) pour chœur/voix si aucune autre source.

## 4. Procédure imposée pour chaque asset

1. **Télécharger** par un canal du § 2. Noter l'URL exacte utilisée (`downloadedFrom`).
2. **Vérifier** que le fichier s'ouvre (`python3 -c "from PIL import Image; Image.open(p).verify()"`, `soundfile.info(p)`).
3. **Prouver la licence** : un fichier `LICENSE`/`README`/`CREDITS.csv` **dans le dépôt téléchargé** doit énoncer la licence de ce fichier précis. Chemin noté dans `evidence`. Pas de preuve = rejet.
4. **Créditer** dans le manifeste (`credits`) et dans `CREDITS-visual.md` / `CREDITS-audio.md`, puis seulement intégrer.

Licences acceptées : CC0, CC-BY (3.0/4.0), CC-BY-SA (3.0/4.0), OGA-BY, OFL 1.1, MIT, CC Sampling Plus 1.0. GPL seule : à éviter si une alternative existe. Refusées : « free for personal use », « no redistribution », licence introuvable, « je crois que c'est libre ».

Format d'une entrée de crédits (Markdown) :
```
### <titre du pack ou du fichier>
- Fichiers : `assets/sprites/feutre.png`, `assets/sprites/baillon.png`
- Auteur(s) : Nom (pseudo)
- Licence : CC-BY-SA 3.0
- Source d'origine : https://... (page de l'auteur, telle que citée par le dépôt)
- Téléchargé depuis : https://github.com/... (URL réellement utilisée)
- Preuve : `chemin/LICENSE` ou `CREDITS.csv` ligne « ... »
- Modifications : recolorisation, découpe, conversion OGG 112 kbps
```
