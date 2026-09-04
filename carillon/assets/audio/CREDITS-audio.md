# CRÉDITS AUDIO — CARILLON (agent B)

Tout l'audio du jeu est échantillonné : aucun oscillateur, aucun son de synthèse. Chaque fichier ci-dessous a été téléchargé par un canal autorisé (SOURCING.md § 1–2), ouvert et vérifié (`soundfile.info`), et sa licence est prouvée par un fichier présent dans le dépôt téléchargé. Les hauteurs sont en notation scientifique (A4 = 440 Hz) et ont été **mesurées** (YIN + HPS) : VSCO 2 CE et la plupart des dossiers VCSL étiquettent leurs fichiers en convention « C3 = do médian », soit un octave sous la notation scientifique.

Fichiers livrés : 406 références, 34 instruments, 43 bruitages, 5 ambiances, 10 pistes.

## Sources

### Versilian Community Sample Library (VCSL) 1.2
- Fichiers (284) : `assets/audio/samples/anvil/hit_1.ogg`, `assets/audio/samples/anvil/hit_2.ogg`, `assets/audio/samples/anvil/hit_3.ogg`, `assets/audio/samples/anvil/soft_1.ogg`, `assets/audio/samples/anvil/soft_2.ogg`, `assets/audio/samples/bass_drum/hit_1.ogg`, `assets/audio/samples/bass_drum/hit_2.ogg`, `assets/audio/samples/bass_drum/hit_3.ogg`, `assets/audio/samples/bass_drum/soft_1.ogg`, `assets/audio/samples/bass_drum/soft_2.ogg`, `assets/audio/samples/bell_tree/hit_1.ogg`, `assets/audio/samples/bell_tree/hit_2.ogg` … (+272 autres, voir manifest.json, crédit `vcsl`)
- Auteur(s) : Versilian Studios LLC (Samuel Gossner), Simon Dalzell (Ivy Audio) pour l'orgue
- Licence : CC0 1.0
- Source d'origine : https://github.com/sgossner/VCSL
- Téléchargé depuis : https://github.com/sgossner/VCSL (git clone)
- Preuve : `LICENSE (CC0 1.0 Universal) + README.md « This collection is under a Creative Commons 0 license »`
- Modifications : découpe des silences, normalisation −3 dBFS crête, limitation des queues (fondu), boucles crossfadées aux passages par zéro pour les tenues, conversion OGG Vorbis 44,1 kHz (~112 kbps stéréo, q3 ; bruitages mono q5) ; pour les bruitages : superposition, transposition par rééchantillonnage, inversion, filtrage FFT, convolution avec des queues enregistrées du même corpus

### VSCO 2 Community Edition
- Fichiers (62) : `assets/audio/samples/cello/A3.ogg`, `assets/audio/samples/cello/B2.ogg`, `assets/audio/samples/cello/B4.ogg`, `assets/audio/samples/cello/C2.ogg`, `assets/audio/samples/cello/C4.ogg`, `assets/audio/samples/cello/D3.ogg`, `assets/audio/samples/cello/D5.ogg`, `assets/audio/samples/cello/E2.ogg`, `assets/audio/samples/cello/E4.ogg`, `assets/audio/samples/cello/F3.ogg`, `assets/audio/samples/cello/F5.ogg`, `assets/audio/samples/cello/G2.ogg` … (+50 autres, voir manifest.json, crédit `vsco2`)
- Auteur(s) : Versilian Studios (Sam Gossner), Simon Dalzell (Ivy Audio), Elan Hickler (découpe)
- Licence : CC0 1.0
- Source d'origine : https://github.com/sgossner/VSCO-2-CE
- Téléchargé depuis : https://github.com/sgossner/VSCO-2-CE (git clone --filter=blob:none, sparse-checkout Strings/*, Brass/F Horn)
- Preuve : `LICENSE (CC0 1.0 Universal) ; Readme.txt demande un crédit (fourni)`
- Modifications : idem : découpe, normalisation, boucles crossfadées, OGG Vorbis ; ré-étiquetage des hauteurs (convention VSCO « C3 = do médian » → notation scientifique, vérifié par mesure)

### Sonatina Symphonic Orchestra (chœur mixte)
- Fichiers (14) : `assets/audio/samples/choir/A#2.ogg`, `assets/audio/samples/choir/A#3.ogg`, `assets/audio/samples/choir/A#4.ogg`, `assets/audio/samples/choir/A#5.ogg`, `assets/audio/samples/choir/C#3.ogg`, `assets/audio/samples/choir/C#4.ogg`, `assets/audio/samples/choir/C#5.ogg`, `assets/audio/samples/choir/E3.ogg`, `assets/audio/samples/choir/E4.ogg`, `assets/audio/samples/choir/E5.ogg`, `assets/audio/samples/choir/G2.ogg`, `assets/audio/samples/choir/G3.ogg` … (+2 autres, voir manifest.json, crédit `sso`)
- Auteur(s) : Mattias Westlund, Peter Eastman (dépôt), Signal Experiments (boucles)
- Licence : CC Sampling Plus 1.0
- Source d'origine : https://github.com/peastman/sso
- Téléchargé depuis : https://github.com/peastman/sso (git clone sparse « Samples-looped/Chorus »)
- Preuve : `LICENSE « may be used and distributed under the terms of the Creative Commons Sampling Plus 1.0 license »`
- Modifications : découpe autour des points de boucle du SFZ, fondu croisé de boucle recalculé et vérifié, normalisation, OGG Vorbis

### Karoryfer Samples — Cowsynth (cornemuse médiévale)
- Fichiers (11) : `assets/audio/samples/bagpipe/A4.ogg`, `assets/audio/samples/bagpipe/C5.ogg`, `assets/audio/samples/bagpipe/D5.ogg`, `assets/audio/samples/bagpipe/E5.ogg`, `assets/audio/samples/bagpipe/F4.ogg`, `assets/audio/samples/bagpipe/G4.ogg`, `assets/audio/samples/bagpipe_chirp/chirp_1.ogg`, `assets/audio/samples/bagpipe_chirp/chirp_2.ogg`, `assets/audio/samples/bagpipe_chirp/chirp_3.ogg`, `assets/audio/samples/bagpipe_drone/A2.ogg`, `assets/audio/samples/bagpipe_drone/G2.ogg`
- Auteur(s) : Karoryfer Lecolds
- Licence : CC0 1.0
- Source d'origine : https://github.com/sfzinstruments/karoryfer.cowsynth
- Téléchargé depuis : https://github.com/sfzinstruments/karoryfer.cowsynth (git clone, dossier natural/)
- Preuve : `LICENSE (CC0 1.0 Universal) ; readme.txt « Royalty-free for all commercial and non-commercial use »`
- Modifications : découpe, normalisation, boucles, mono, ré-étiquetage des hauteurs mesurées, OGG Vorbis

### Kenney — Impact Sounds 1.0
- Fichiers (5) : `assets/audio/sfx/player_step_1.ogg`, `assets/audio/sfx/player_step_2.ogg`, `assets/audio/sfx/player_step_3.ogg`, `assets/audio/sfx/player_step_4.ogg`, `assets/audio/sfx/player_step_5.ogg`
- Auteur(s) : Kenney (www.kenney.nl)
- Licence : CC0 1.0
- Source d'origine : https://kenney.nl/assets/impact-sounds
- Téléchargé depuis : https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds (git clone sparse « kenney_impactsounds »)
- Preuve : `kenney_impactsounds/License.txt « License: (Creative Commons Zero, CC0) »`
- Modifications : superposition avec des pas dans la boue (rubberduck), découpe, normalisation, mono, OGG Vorbis

### Kenney — RPG Audio
- Fichiers (11) : `assets/audio/sfx/card_flip_1.ogg`, `assets/audio/sfx/card_flip_2.ogg`, `assets/audio/sfx/card_flip_3.ogg`, `assets/audio/sfx/card_pick_1.ogg`, `assets/audio/sfx/enemy_die_1.ogg`, `assets/audio/sfx/enemy_die_2.ogg`, `assets/audio/sfx/enemy_die_3.ogg`, `assets/audio/sfx/lore_unlock_1.ogg`, `assets/audio/sfx/player_hurt_1.ogg`, `assets/audio/sfx/player_hurt_2.ogg`, `assets/audio/sfx/player_hurt_3.ogg`
- Auteur(s) : Kenney Vleugels (Kenney.nl)
- Licence : CC0 1.0
- Source d'origine : https://kenney.nl/assets/rpg-audio
- Téléchargé depuis : https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds (git clone sparse « kenney_rpgaudio »)
- Preuve : `kenney_rpgaudio/License.txt « License (Creative Commons Zero, CC0) »`
- Modifications : découpe, superposition (hand chimes VCSL), normalisation, mono, OGG Vorbis

### rubberduck — packs CC0 (25 mud SFX, 100 wood/metal SFX)
- Fichiers (12) : `assets/audio/sfx/enemy_die_1.ogg`, `assets/audio/sfx/enemy_die_2.ogg`, `assets/audio/sfx/enemy_die_3.ogg`, `assets/audio/sfx/enemy_die_big_1.ogg`, `assets/audio/sfx/enemy_die_big_2.ogg`, `assets/audio/sfx/player_step_1.ogg`, `assets/audio/sfx/player_step_2.ogg`, `assets/audio/sfx/player_step_3.ogg`, `assets/audio/sfx/player_step_4.ogg`, `assets/audio/sfx/player_step_5.ogg`, `assets/audio/sfx/weapon_chaine_1.ogg`, `assets/audio/sfx/weapon_chaine_2.ogg`
- Auteur(s) : rubberduck (OpenGameArt)
- Licence : CC0 1.0
- Source d'origine : https://opengameart.org/users/rubberduck
- Téléchargé depuis : https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds (git clone sparse « 25-CC0-mud-sfx », « 100-CC0-wood-metal-SFX »)
- Preuve : `LICENSE à la racine du dépôt (CC0 1.0 Universal) couvrant l'ensemble « collection of cc0 sounds » ; noms de packs « CC0 »`
- Modifications : découpe, superposition, transposition, normalisation, mono, OGG Vorbis

### Micro Pack — Organic Wooshes
- Fichiers (3) : `assets/audio/sfx/dash_1.ogg`, `assets/audio/sfx/dash_2.ogg`, `assets/audio/sfx/dash_3.ogg`
- Auteur(s) : Benjamin Burnes (Abstraction)
- Licence : CC0 1.0
- Source d'origine : https://abstractionmusic.com
- Téléchargé depuis : https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds (git clone sparse « Micro Pack - Organic Wooshes »)
- Preuve : `« Micro Pack - Organic Wooshes/_README.txt » : « These sounds are public domain (Creative Commons 0) »`
- Modifications : découpe, superposition (grelots VCSL), normalisation, mono, OGG Vorbis

### Wind (felix.blume)
- Fichiers (1) : `assets/audio/sfx/ambience_wind.ogg`
- Auteur(s) : felix.blume
- Licence : CC0 1.0
- Source d'origine : http://www.freesound.org/people/felix.blume/sounds/139337/
- Téléchargé depuis : https://github.com/Muges/ambientsounds (git clone, wind.ogg)
- Preuve : `readme.md du dépôt : « Wind by felix.blume (CC0) »`
- Modifications : extrait de 60 s, boucle crossfadée (1,5 s), normalisation −6 dBFS, OGG Vorbis q2

### Fireplace (inchadney)
- Fichiers (1) : `assets/audio/sfx/ambience_fire.ogg`
- Auteur(s) : inchadney
- Licence : CC0 1.0
- Source d'origine : http://www.freesound.org/people/inchadney/sounds/132534/
- Téléchargé depuis : https://github.com/Muges/ambientsounds (git clone, fireplace.ogg)
- Preuve : `readme.md du dépôt : « Fireplace by inchadney (CC0) »`
- Modifications : extrait de 50 s, boucle crossfadée, normalisation −6 dBFS, OGG Vorbis q2

### Heavy Rain (D W)
- Fichiers (1) : `assets/audio/sfx/ambience_rain.ogg`
- Auteur(s) : D W
- Licence : CC BY 3.0
- Source d'origine : http://www.freesound.org/people/D%20W/sounds/136971/
- Téléchargé depuis : https://github.com/Muges/ambientsounds (git clone, heavy-rain.ogg)
- Preuve : `readme.md du dépôt : « Heavy Rain by D W (CC BY) »`
- Modifications : extrait de 45 s, boucle crossfadée, normalisation −6 dBFS, OGG Vorbis q2

### Thunderstorm (RHumphries)
- Fichiers (1) : `assets/audio/sfx/ambience_storm.ogg`
- Auteur(s) : RHumphries
- Licence : CC BY 3.0
- Source d'origine : http://www.freesound.org/people/RHumphries/sounds/2523/
- Téléchargé depuis : https://github.com/Muges/ambientsounds (git clone, thunderstorm.ogg)
- Preuve : `readme.md du dépôt : « Thunderstorm by RHumphries (CC BY) »`
- Modifications : extrait de 60 s, boucle crossfadée, normalisation −6 dBFS, OGG Vorbis q2

### Partitions CARILLON
- Fichiers (0) : `src/data/music/*.json`
- Auteur(s) : Équipe CARILLON (agent B, 2026)
- Licence : Même licence que le jeu
- Source d'origine : src/data/music/
- Téléchargé depuis : —
- Preuve : `—`
- Modifications : partitions JSON écrites pour le jeu (§ 9.3), jouées par le sampler sur les échantillons ci-dessus

## Bruitages : recette de chaque identifiant

| id | variantes | sources | fabrication |
|---|---|---|---|
| `hit_light` | 3 | vcsl | Tambour sur cadre étouffé + woodblock + clochette népalaise (−5 st). |
| `hit_heavy` | 3 | vcsl | Grosse caisse + enclume filtrée (2,5 kHz). |
| `hit_crit` | 3 | vcsl | Enclume + hand chime aiguë + grosse caisse. |
| `enemy_die` | 3 | kenney_rpg + rubberduck + vcsl | Feutre qui se défait : tissu (Kenney) + boue (rubberduck) + chime inversée. |
| `enemy_die_big` | 2 | vcsl + rubberduck | Gong doux (−5 st) + grosse caisse + boue. |
| `boss_hit` | 3 | vcsl | Timbale + tambour de frein martelé + enclume. |
| `boss_roar` | 2 | vcsl | Didgeridoo (aboiement, −7/−10 st, étiré) convolué avec une queue de gong + tambour de frein archet inversé + timbale + gong raclé. |
| `player_step` | 5 | kenney_impact + rubberduck | Pas dans l'herbe (Kenney) + boue légère (rubberduck). |
| `player_hurt` | 3 | vcsl + kenney_rpg | Cœur de bronze fêlé : clochette népalaise (−9 st) + tissu + caisse claire à cordes. |
| `player_death` | 1 | vcsl | Cloche C4 inversée puis frappée une octave plus bas + gong + carillon éolien descendant (−4 st) + grosse caisse. |
| `dash` | 3 | burnes + vcsl | Volée : woosh organique (Ben Burnes) + grelots. |
| `parry_ok` | 2 | vcsl | Vrai « ting » de bronze : cymbalettes + hand chime + triangle. |
| `parry_miss` | 2 | vcsl | « Tock » sourd : cloche de vache étouffée (−4 st) + woodblock pp. |
| `resonance_1` | 1 | vcsl | Cran 1 : cloche tubulaire D4 seule. |
| `resonance_2` | 1 | vcsl | Cran 2 : cloche D4 + hand chimes D4/A4 (quinte). |
| `resonance_3` | 1 | vcsl | Cran 3 : accord D4/F#4/A4 en hand chimes + cloche A4. |
| `resonance_4` | 1 | vcsl | Cran 4 : accord D5/F#5/A5 + cloches D4/D5 + arbre à cloches. |
| `resonance_drop` | 1 | vcsl | Chute : cloche C4 transposée −7 st, carillon éolien descendant, tambour étouffé. |
| `level_up` | 1 | vcsl | Arpège D4-F#4-A4-D5 en hand chimes + arbre à cloches. |
| `card_flip` | 3 | kenney_rpg | Feuillet retourné (Kenney RPG Audio, bookFlip). |
| `card_pick` | 1 | kenney_rpg + vcsl | Cuir manipulé + hand chime A4. |
| `xp_pickup` | 3 | vcsl | Écho ramassé : coups isolés de l'arbre à cloches. |
| `xp_pickup_big` | 1 | vcsl | Gros écho : arbre à cloches + hand chime D5 + glissando. |
| `bell_minute` | 1 | vcsl | Sonnerie horaire : cloches tubulaires C4 et G4 une octave plus bas (C3, G3). |
| `bell_tier` | 1 | vcsl | Palier de Sourdine : cloche inversée puis gong + cloche grave (−17 st). |
| `silence_cry` | 3 | vcsl | Cri du Silence : aboiement de didgeridoo transposé (−6/−9/−12 st), étiré, convolué avec un verre frotté ; psaltérion à archet et tambour de frein archet inversés ; passe-bas 4,5 kHz. |
| `silence_burst` | 1 | vcsl | Éclat du Silence : ocean drum inversé (montée) puis grosse caisse, gong raclé (−5 st), tambour de frein (−8 st). |
| `ui_move` | 2 | vcsl | Woodblock pp. |
| `ui_confirm` | 1 | vcsl | Hand chime D5 + woodblock. |
| `ui_cancel` | 1 | vcsl | Woodblock (−3 st) + cloche étouffée. |
| `weapon_battant` | 2 | vcsl | Battant : tambour sur cadre + clochette népalaise. |
| `weapon_clarine` | 2 | vcsl | Clarine : hand chimes E6/A6 (étiquettes E5/A5). |
| `weapon_bourdon` | 2 | vcsl | Bourdon : cloche C3 filtrée + grosse caisse. |
| `weapon_grelots` | 2 | vcsl | Grelots. |
| `weapon_tocsin` | 2 | vcsl | Tocsin : cloche F4/G4 + enclume. |
| `weapon_cor` | 2 | vsco2 | Cor de Brume : cor d'harmonie staccato (VSCO 2 CE). |
| `weapon_crecelle` | 2 | vcsl | Crécelle. |
| `weapon_chaine` | 2 | rubberduck + vcsl | Chaîne d'Angélus : clés/chaîne (rubberduck) + hand chime. |
| `weapon_diapason` | 2 | vcsl | Diapason : verre frotté D6, enveloppe douce. |
| `fusion` | 1 | vcsl | Fusion : gong doux + cloches D4/A4 + arbre à cloches. |
| `achievement` | 1 | vcsl | Arpège A-C#-E-A en hand chimes + cymbalettes. |
| `lore_unlock` | 1 | kenney_rpg + vcsl | Feuillet du Battant : livre ouvert (Kenney) + hand chime grave. |
| `victory_bell` | 1 | vcsl | Volée de victoire : cloches D4-F4-A4-D5 + arbre à cloches + hand chimes. |
| `ambience_wind` | 1 | ambientsounds_wind | Vent (felix.blume, CC0) ; boucle 60 s. |
| `ambience_fire` | 1 | ambientsounds_fire | Feu de cheminée (inchadney, CC0) ; boucle 50 s. |
| `ambience_rain` | 1 | ambientsounds_rain | Pluie forte (D W, CC BY) ; boucle 45 s. |
| `ambience_storm` | 1 | ambientsounds_storm | Orage (RHumphries, CC BY) ; boucle 60 s. |
| `ambience_sea` | 1 | vcsl | Ocean drum (VCSL, CC0) : ressac de la Nef Noyée ; passe-bas 3 kHz ; boucle 30 s. |

## Instruments échantillonnés

| instrument | type | fichiers | source | notes |
|---|---|---|---|---|
| `tubular_bells` | pitched | 11 · C4–F5 | vcsl | Tubular Bells 2, vélocité forte ; notation scientifique vérifiée. |
| `hand_chimes` | pitched | 18 · C4–A#6 | vcsl | Hand Chimes ; étiquettes VCSL +12 (mesuré). |
| `psaltery_bow` | pitched (boucles) | 11 · A#4–F#6 | vcsl | Psaltérion à archet (≈ vielle) ; étiquettes +12 ; boucles crossfadées. |
| `psaltery_pluck` | pitched | 11 · A#4–F#6 | vcsl | Psaltérion pincé ; étiquettes +12. |
| `organ` | pitched (boucles) | 25 · C2–C6 | vcsl | Orgue Renaissance 8' (Room) ; étiquettes +12 ; boucles. |
| `recorder` | pitched (boucles) | 13 · C4–C6 | vcsl | Flûte à bec ténor baroque, tenue ; étiquettes +12 ; boucles. |
| `wine_glasses` | pitched (boucles) | 4 · D#5–D6 | vcsl | Verres frottés ; étiquettes +12 (mesuré) ; boucles. |
| `folk_harp` | pitched | 24 · D2–C6 | vcsl | Harpe celtique, vélocité 3 ; étiquettes +12. |
| `didgeridoo` | percussion (boucles) | 5 · drone, bark, short | vcsl | Didgeridoo ≈ C#2 : drones bouclés, aboiements (cris du Silence). |
| `frame_drum` | percussion | 11 · low, high, muted, hand | vcsl | Tambour sur cadre (≈ bodhrán) : low/high/muted/hand, 2–3 round-robins. |
| `bass_drum` | percussion | 5 · hit, soft | vcsl | Grosse caisse de concert. |
| `snare_rope` | percussion | 8 · snare, tenor, roll | vcsl | Caisse claire à cordes (tambour de procession) : timbre, ténor sans timbre. |
| `claps` | percussion | 6 · clap, solo | vcsl | Claquements de mains (groupe / solo). |
| `woodblock` | percussion | 6 · hit, soft | vcsl | Woodblock. |
| `gong` | percussion | 5 · hit, soft, scrape | vcsl | Gong (queues limitées à 8 s). |
| `anvil` | percussion | 5 · hit, soft | vcsl | Enclume. |
| `ratchet` | percussion | 6 · crank, fast, slow | vcsl | Crécelle. |
| `sleigh_bells` | percussion | 5 · hit, shake | vcsl | Grelots. |
| `hand_bells` | percussion | 3 · hit | vcsl | Clochettes népalaises (non accordées). |
| `bell_tree` | percussion | 11 · stroke, hit | vcsl | Arbre à cloches : glissandi (stroke) et coups isolés (hit, ascendants C5→A#5). |
| `tambourine` | percussion | 5 · hit, shake, roll | vcsl | Tambourin. |
| `timpani` | percussion | 6 · low, mid, high | vcsl | Timbales (boss). |
| `triangle` | percussion | 4 · hit, muted | vcsl | Triangle (ouvert / étouffé). |
| `finger_cymbals` | percussion | 1 · hit | vcsl | Cymbalettes (« ting » de bronze). |
| `slapstick` | percussion | 3 · hit | vcsl | Fouet (slapstick). |
| `contrabass` | pitched (boucles) | 14 · E1–B3 | vsco2 | Contrebasse solo, tenue sans vibrato, v3 ; étiquettes +12 (mesuré) ; boucles. |
| `cello` | pitched (boucles) | 13 · C2–F5 | vsco2 | Violoncelles (section), tenue vibrato, v3 ; étiquettes +12 ; boucles. |
| `viola` | pitched (boucles) | 13 · C3–D6 | vsco2 | Altos (section), tenue vibrato, v2 ; étiquettes +12 ; boucles. |
| `violin` | pitched (boucles) | 12 · G3–E6 | vsco2 | Violon solo, archet vibrato, forte ; notation scientifique vérifiée ; boucles. |
| `horn` | pitched (boucles) | 8 · C2–C4 | vsco2 | Cor d'harmonie, tenue, v3 (Cor de Brume) ; étiquettes +12 ; boucles. |
| `choir` | pitched (boucles) | 14 · G2–A#5 | sso | Chœur mixte (hommes G2–E4, femmes G4–A#5), « aah » ; points de boucle du SFZ vérifiés et crossfadés. |
| `bagpipe` | pitched (boucles) | 6 · F4–E5 | cowsynth | Chanter de cornemuse médiévale (hauteurs mesurées : étiquettes +12) ; mono ; boucles. |
| `bagpipe_drone` | pitched (boucles) | 2 · G2–A2 | cowsynth | Bourdons de cornemuse G2 / A2 (hauteurs mesurées) ; mono ; boucles. |
| `bagpipe_chirp` | percussion | 3 · chirp | cowsynth | Pépiements de cornemuse (ornements). |

## Pistes (partitions originales)

| id | titre | tempo | état |
|---|---|---|---|
| `menu` | Le dernier apprenti | 84 BPM, 16 mesures | complete |
| `hub` | Le Beffroi Mère — carte des paroisses | 88 BPM, 8 mesures | esquisse |
| `cendrelune` | Cendrelune — la veillée des cendres | 96 BPM, 16 mesures | complete |
| `tourbes` | Les Tourbes — la marche des noyés | 88 BPM, 8 mesures | esquisse |
| `val_des_cordes` | Val-des-Cordes — la ronde des pendus | 104 BPM, 8 mesures | esquisse |
| `nef_noyee` | La Nef Noyée — psaume sous l'eau | 84 BPM, 8 mesures | esquisse |
| `beffroi_mere` | Le Beffroi Mère — la cloche-mère | 100 BPM, 8 mesures | esquisse |
| `boss` | Le Bourdon Fêlé | 110 BPM, 8 mesures | esquisse |
| `victory` | L'aube sonnée | 96 BPM, 8 mesures | esquisse |
| `death` | Le Silence a mangé le son | 72 BPM, 8 mesures | esquisse |

## Sources examinées et rejetées

- `gregoryjpark/ambient-factory` : sons tirés de pacdv.com / Freesound sans licence déclarée dans le dépôt → rejeté.
- rubberduck « 80 CC0 creature SFX » (cris, souffles) : voix traitées dont la nature enregistrée n'est pas documentée → non utilisés ; les cris du Silence sont fabriqués à partir du didgeridoo, du tambour de frein et du psaltérion (VCSL).
- Kenney UI/Interface/Digital audio (Calinou/kenney-*) : sons d'interface synthétiques → non utilisés (les sons d'UI sont du woodblock et des hand chimes).
- VCSL « Tubular Bells 1 » : convention d'octave différente de « Tubular Bells 2 » (mesuré) → seul le jeu 2 (notation scientifique, C4–F5) est retenu.
- Corbeaux / corneilles : aucun dépôt GitHub trouvé hébergeant un enregistrement avec sa licence (Freesound, BigSoundBank et archive.org sont bloqués) → **manque assumé** ; à remplacer en Phase 2 si un dépôt licencié est trouvé.
