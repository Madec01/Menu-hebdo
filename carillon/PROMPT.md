# CARILLON — Brief de production (PROMPT.md)

> Ce document est le brief d'origine du commanditaire (Martin). Il fait foi sur le
> concept, la direction artistique, l'audio et la définition de « fini ».
> Les contrats techniques sont dans ARCHITECTURE.md ; les canaux de récupération
> d'assets dans SOURCING.md.

## 0. Règles non négociables

- Aucune dépendance npm, aucun build step, aucun framework. JavaScript vanilla en modules ES, Canvas 2D, Web Audio API.
- Les graphismes sont des sprites téléchargés, libres de droits. Interdiction de dessiner personnages, ennemis, décors, objets en primitives de code. Le code ne dessine que : particules, VFX, lumière, UI.
- Tout l'audio est échantillonné (fichiers réels). Interdiction formelle d'`OscillatorNode` pour musique ou bruitages. Instruments réels, percussions réelles, voix réelles, field recordings.
- Aucune URL inventée. Une source n'est citée que si le fichier a réellement été téléchargé. Asset non vérifié = asset rejeté.
- CREDITS.md obligatoire et à jour : chaque fichier, auteur, licence, URL source.
- Interface en français, bascule EN dans les options.
- Code commenté en français, lisible, fichiers < 400 lignes.

## 1. Le jeu

**Pitch.** CARILLON est un survivor-like (bullet-heaven) cadencé par la musique : les attaques partent sur le temps, jouer dans le rythme fait monter la bande-son. Vue du dessus, ZQSD, vagues qui enflent, niveau toutes les ~20 s, boss à la fin. Runs de 12 min.

**Monde — Les Marches Sourdes.** Le Grand Silence mange le son. Les villages tiennent grâce à leurs cloches-mères ; le bronze est la seule matière que le Silence ne digère pas. L'Ordre des Battants coud dans la poitrine de gamins déracinés un Battant, cœur de bronze qui bat en mesure. Leur travail : entrer dans les paroisses tombées, remonter au beffroi, faire sonner la cloche jusqu'à l'aube. Tu es le dernier apprenti du Beffroi Mère ; ton maître est parti reconsacrer Cendrelune il y a trois mois et n'est pas revenu. Ton : folk-horror rural. Boue, suif, bronze, brume, chants de veillée.

**Boucle.** Hub (carte des paroisses) → nuit de 12 min, la Sourdine monte (vignette, densité, palier toutes les 2 min) → Échos (XP) → niveau = 3 cartes (Timbre = arme, Accord = passif ; max 6 + 6) → Fêlures (mini-boss) min 4 et 8 → Bourdon (boss) min 12 → bilan → Bronze → hub. Le Bronze débloque sonneurs, Timbres de départ, améliorations du Beffroi, Feuillets.

**Le hook — la Mesure.** Pulsation 4/4 permanente (96 BPM par défaut) calée sur la musique via `AudioContext.currentTime` (lookahead, jamais `setInterval`). Toutes les armes tirent sur les temps (croche = 2×/temps, ronde = tous les 4 temps). Deux actions rythmiques : Volée (Espace, dash) et Contre-battement (Clic droit / Shift, parade). Dans la fenêtre (± 110 ms) → charge la Résonance, jauge à 4 crans (×1 → ×1.4 → ×1.8 → ×2.5) qui décroît sur les ratés et contrôle dégâts ET musique : ×1 bourdon seul ; ×1.4 + percussions ; ×1.8 + vielle/nyckelharpa ; ×2.5 + voix, écran qui vibre. Halo de bronze au sol sur chaque temps + flash de vignette. Accessibilité : « Mesure assistée » (fenêtre ×3) et « Sans rythme » (Résonance auto ×1.8).

**Contenu.** 4 sonneurs (Wren/Battant ; Osric/Bourdon ; Maren/Grelots ; Le Muet/Diapason). 9 Timbres : Battant, Clarine, Bourdon, Grelots, Tocsin, Cor de Brume, Crécelle, Chaîne d'Angélus, Diapason. 8 Accords : Ferrure, Souffle, Contrepoids, Corde de chanvre, Cire d'abeille, Métronome, Étain, Écho. 4 fusions (ex. Tocsin + Contrepoids → Glas). Bestiaire ≥ 8 types (Feutres, Bâillons, Ouateux, Fossoyeurs, Chœur Muet, Rampes de suie, Veuves grises, Cierges) + 3 boss (Le Bourdon Fêlé, La Veuve de Suie, Ce qui reste du Maître). 5 paroisses : Cendrelune, Les Tourbes, Val-des-Cordes, La Nef Noyée, Le Beffroi Mère. 24 Feuillets du Battant.

## 2. Direction artistique

Proscrit : néon, glassmorphisme, dégradés violets, cyan sur noir. Palette : suie `#16130f`, tourbe `#2a241c`, mousse `#4a5540`, os `#d8cdb4`, bronze `#c9973f` (accent rare), braise `#e0603a`, gris-silence `#8f8d93`. Pixel art cohérent, `imageSmoothingEnabled = false`, échelle entière. Nuit noire éclairée par le Battant, torches, braises (canvas lumière en `multiply` + couche `screen`). Brume parallaxe, cendres, grain, vignette. Typo display gothique adoucie + pixel-font UI, OFL, locales. UI parchemin/bronze, 9-slice. Juice : hit-stop 40 ms, screenshake réglable, nombres de dégâts, flash 1 frame, traînée de dash, ralenti 0,4× à la mort, zoom boss.

## 3. Audio

Folk acoustique, funèbre et dansant : cloches/bronze, vielle, nyckelharpa, bodhrán, cornemuse/cor, contrebasse, voix en bourdon, field recordings. 6 à 8 morceaux (menu, hub, 5 paroisses, boss, victoire, mort). Couches : stems ou couche rythmique séquencée en Web Audio à partir d'échantillons acoustiques sur la grille de la Mesure (approche par défaut). Boucles sans clic (crossfade 200 ms). ≥ 30 bruitages (≥ 3 variantes des impacts, pitch ±8 %). Bus master → music/sfx/ui, ducking −4 dB, passe-bas dans les auras de Feutre. Déblocage audio au premier clic (« Cliquez pour sonner »). < 60 Mo d'audio, OGG Vorbis ~112 kbps.

## 4. Définition de « fini »

- Se lance avec le script de serveur, aucune erreur console, aucun 404.
- 60 fps stables à la minute 10 sur une machine modeste.
- Zéro sprite de gameplay dessiné en code. Zéro oscillateur.
- ≥ 6 morceaux, ≥ 30 bruitages, tous acoustiques, tous crédités.
- Les 4 couches de Résonance s'entendent nettement et sans clic.
- Run complète : titre → hub → tutoriel → 12 min → boss → bilan → déblocage → nouvelle run avec progression conservée.
- Sauvegarde persistante, export/import fonctionnels.
- Options toutes fonctionnelles, remappage inclus, mode « Sans rythme » testé.
- FR et EN complets, aucune chaîne en dur dans le JS.
- CREDITS.md exhaustif.
- Un inconnu comprend comment jouer sans qu'on lui explique.

## 5. Interdits

Match-3, runner, clicker, gestion. Néon/glass/violet. `alert()`, `prompt()`, `confirm()`. Assets non vérifiés. Fichiers de 2000 lignes. Livrer avec « il reste à faire X ».
