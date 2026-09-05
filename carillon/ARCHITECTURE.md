# CARILLON — ARCHITECTURE.md (constitution technique)

Ce document est le contrat entre tous les modules et tous les agents. Chaque agent
ne modifie que son périmètre (§ 12) et respecte à la lettre les signatures publiques
décrites ici. Toute évolution d'un contrat passe par le lead (ce document est mis à
jour AVANT que le code change).

Lire aussi : PROMPT.md (brief, DA, définition de fini) et SOURCING.md (assets).

---

## 1. Principes

1. **Vanilla.** Modules ES natifs (`<script type="module">`), Canvas 2D, Web Audio API. Aucune dépendance, aucun build, aucun CDN à l'exécution.
2. **Données ≠ code.** Équilibrage, vagues, textes, lore, partitions musicales : JSON dans `src/data/`. Le JS ne contient aucun nombre d'équilibrage ni aucune chaîne affichée.
3. **Sprites téléchargés, jamais dessinés.** Le code ne dessine que particules, VFX, lumière, UI (cadres 9-slice découpés dans des sprites).
4. **Audio échantillonné.** `AudioBufferSourceNode` uniquement. `OscillatorNode` est interdit partout, y compris pour l'UI.
5. **Découplage par bus d'événements** (§ 5). Un module ne touche jamais l'état interne d'un autre : il émet, il écoute, il appelle les API publiques.
6. **Pas fixe.** Logique à 60 Hz (`DT = 1/60`), accumulateur, rendu interpolé. Aucune valeur de gameplay ne dépend du framerate.
7. **Pooling systématique** : ennemis, projectiles, particules, textes flottants, pickups.
8. **Fichiers < 400 lignes, commentés en français.** Si un fichier grossit, on le scinde (ex. `weapons.js` → `weapons.js` + `weapons-behaviors.js`).
9. **Rien de synchrone bloquant** : pas d'`alert/prompt/confirm`. Les confirmations sont des dialogues UI.

## 2. Arborescence

```
carillon/
  index.html            # canvas + overlay DOM pour l'UI textuelle, charge src/main.js
  serve.sh / serve.bat  # python3 -m http.server 8080
  CREDITS.md            # assemblé depuis assets/CREDITS-visual.md + assets/audio/CREDITS-audio.md
  README.md  PROMPT.md  ARCHITECTURE.md  SOURCING.md
  src/
    main.js             # bootstrap, chargement, machine à états
    core/    loop.js input.js rng.js events.js pool.js grid.js save.js
    render/  renderer.js atlas.js camera.js lighting.js particles.js fx.js
    audio/   audio.js conductor.js music.js sfx.js sampler.js
    game/    player.js enemies.js weapons.js passives.js spawner.js pickups.js
             boss.js collision.js progression.js resonance.js fusions.js
    ui/      hud.js menu.js levelup.js options.js codex.js tutorial.js hub.js
             results.js i18n.js pause.js credits.js achievements.js widgets.js
    data/    weapons.json passives.json enemies.json waves.json parishes.json
             characters.json lore.json fr.json en.json ui-fr.json ui-en.json upgrades.json
             achievements.json fusions.json music/<trackId>.json
  assets/
    manifest.json       # sprites, tiles, ui, fonts + crédits visuels (agent A)
    preview.html        # planche de tous les assets + lecteur de tous les sons (agent A)
    CREDITS-visual.md
    sprites/  tiles/  ui/  fonts/
    audio/
      manifest.json     # sfx, samples, pistes + crédits audio (agent B)
      CREDITS-audio.md
      music/  sfx/  samples/<instrument>/
  tests/                # pages de test manuelles + scripts node (agent G)
```

Un sous-module peut être ajouté par un agent dans son propre périmètre s'il documente
son API en tête de fichier et n'est importé que depuis son périmètre.

## 3. Conventions

- Nommage : fichiers `kebab-case.js`, fonctions/variables `camelCase`, constantes `UPPER_SNAKE`, identifiants de données `snake_case` (`feutre`, `cor_de_brume`, `hit_bronze`).
- Chaque module exporte des fonctions nommées (pas de `default`). Un module qui a un état expose `init(deps)`.
- Les textes passent par `t('cle.sous_cle', params)` (§ 7.9). Aucune chaîne utilisateur en dur.
- Angles en radians, temps de jeu en secondes (`number`), temps audio en secondes `AudioContext` (`number`, suffixe `At`), durées UI en ms (suffixe `Ms`).
- Coordonnées monde en pixels natifs (avant échelle). Tuile = 32 px. Origine en haut à gauche, y vers le bas.
- Ordre de rendu : sol pré-rendu → décor bas → ombres → entités triées par `y` → projectiles → particules → lumière (`multiply`) → braises (`screen`) → brume → vignette/grain → HUD (DOM + canvas).
- Échelle d'affichage entière (`scale` = 2, 3 ou 4) choisie dans les options, `imageSmoothingEnabled = false` sur tous les contextes.

## 4. Boucle et machine à états (`src/main.js`, `src/core/loop.js`)

```js
// core/loop.js
export function createLoop({ update, render, stepHz = 60, maxFrameMs = 250 })
  // .start() .stop() .setTimeScale(s) .stats -> { fps, updates, entities }
  // update(dt) est appelé N fois par frame avec dt = 1/stepHz * timeScale ;
  // render(alpha) est appelé une fois par frame, alpha ∈ [0,1] pour l'interpolation.
```

États (`main.js`) : `boot → unlock → title → hub → tutorial → run → (pause | levelup) → results → title/hub`, plus `options`, `codex`, `credits` empilables au-dessus de n'importe quel état. Transition = `bus.emit('state:change', { from, to })`. Chaque écran UI expose `enter(params)`, `exit()`, `update(dt)`, `render(ctx, alpha)` et reçoit l'input via le bus.

## 5. Bus d'événements (`src/core/events.js`)

```js
export const bus = { on(name, fn) → off, once(name, fn), off(name, fn), emit(name, payload) }
```

Liste exhaustive (un agent qui a besoin d'un nouvel événement le demande au lead) :

| Événement | Payload | Émis par |
|---|---|---|
| `state:change` | `{from, to}` | main |
| `audio:unlocked` | `{}` | audio |
| `beat` | `{beat, bar, beatInBar (0-3), at}` | conductor |
| `bar` | `{bar, at}` | conductor |
| `rhythm:input` | `{action:'dash'|'parry', grade:'parfait'|'bon'|'rate', offsetMs}` | player |
| `resonance:change` | `{tier (0-3), mult, value (0-1), direction:+1|-1}` | resonance |
| `resonance:blocked` | `{durationSec}` | enemies (Ouateux) |
| `player:hit` | `{damage, from, hp, maxHp}` | player |
| `player:heal` | `{amount}` | player |
| `player:death` | `{at, killer}` | player |
| `player:dash` | `{x, y, dirX, dirY}` | player |
| `player:parry` | `{x, y, success}` | player |
| `player:silenced` | `{durationSec}` | enemies (Bâillon) |
| `player:inAura` | `{depth (0-1)}` | enemies (Feutre) — émis chaque tick |
| `weapon:fire` | `{weaponId, x, y, count, big:boolean}` | weapons |
| `weapon:fusion` | `{fusionId, from:[weaponId, passiveId]}` | fusions |
| `enemy:spawn` | `{kind, id}` | spawner |
| `enemy:hit` | `{id, kind, damage, crit, x, y, onBeat}` | collision |
| `enemy:death` | `{id, kind, x, y, boss:boolean}` | enemies |
| `pickup:xp` | `{amount}` | pickups |
| `pickup:item` | `{kind}` | pickups |
| `level:up` | `{level, choices:[Card, Card, Card]}` | progression |
| `level:choice` | `{card}` | levelup (UI) |
| `run:start` | `{parishId, characterId, seed, tutorial:boolean}` | main |
| `run:minute` | `{minute}` | spawner (sonnerie horaire) |
| `run:tier` | `{tier (1-6)}` | spawner (palier de Sourdine) |
| `run:fissure` | `{bossId, phase:'start'|'end'}` | boss |
| `run:boss` | `{bossId, phase:'intro'|'start'|'phase'|'end', index}` | boss |
| `run:end` | `{victory:boolean, stats:RunStats}` | progression |
| `save:changed` | `{save}` | save |
| `achievement:unlock` | `{id}` | achievements |
| `lore:unlock` | `{leafId}` | progression |
| `options:change` | `{key, value}` | options |
| `input:action` | `{action, pressed:boolean, at}` | input (at = temps audio) |
| `ui:open` / `ui:close` | `{screen}` | ui |

Règle : le payload est un objet plat et sérialisable ; on n'y passe jamais une entité entière sauf son `id`.

## 6. Contrats `core/`

```js
// core/input.js — actions abstraites, remappables, clavier + manette
export const ACTIONS = ['up','down','left','right','dash','parry','pause','confirm','cancel','menuUp','menuDown','menuLeft','menuRight'];
export function initInput({ canvas, getAudioTime })   // getAudioTime() → temps AudioContext
export function isDown(action) → boolean
export function justPressed(action) → boolean          // vrai pendant un seul tick logique
export function pressedAt(action) → number             // temps audio de la dernière pression
export function axis() → { x, y }                      // -1..1 normalisé, clavier ou stick gauche
export function pointer() → { x, y, down, worldX, worldY }
export function setBinding(action, { keys:[], buttons:[] }) / getBindings() / resetBindings()
export function beginCapture(action, onDone)           // remappage : capture la prochaine touche/bouton
export function hasGamepad() → boolean

// core/rng.js — mulberry32, déterministe
export function makeRng(seed) → { next(), range(a,b), int(a,b), pick(arr), chance(p), seed }
export function hashSeed(text) → number                // texte de seed manuelle → uint32

// core/pool.js
export function createPool(factory, reset, initialSize) → { acquire(), release(obj), forEach(fn), active:number, clearAll() }

// core/grid.js — spatial hash
export function createGrid(cellSize) → { clear(), insert(e), query(x, y, r, fn), queryRect(x,y,w,h,fn) }
  // e possède x, y, r ; fn(e) est appelé pour chaque candidat (test précis à la charge de l'appelant)

// core/save.js — localStorage 'carillon.save', schéma versionné
export const SAVE_VERSION = 2   // v2 : unlocked.weapons garanti, lastWeaponByCharacter, lastParish/lastCharacter
export function loadSave() → Save     // migre si version < SAVE_VERSION
export function getSave() → Save     // instance courante (mutable, puis commit())
export function commit()             // sérialise + bus.emit('save:changed')
export function exportSave() → string (JSON)
export function importSave(json) → { ok, error }
export function resetSave()
```

Schéma `Save` (v1) :
```json
{ "version": 1, "bronze": 0, "seedManual": null,
  "unlocked": { "characters": ["wren"], "weapons": ["battant"], "upgrades": [], "leaves": [], "achievements": [], "fusions": [], "parishes": ["cendrelune"] },
  "codex": { "enemies": {"feutre": 12}, "bosses": {} },
  "stats": { "runs": 0, "wins": 0, "kills": 0, "bestTime": 0, "bestResonance": 0 },
  "options": { "lang": "fr", "volMaster": 0.8, "volMusic": 0.8, "volSfx": 0.9, "shake": 1, "particles": 1, "reduceFlash": false, "fullscreen": false, "scale": 0, "beatIndicator": "both", "assist": "none", "showFps": false, "bindings": {} },
  "tutorialDone": false, "lastWeaponByCharacter": {}, "lastParish": null, "lastCharacter": null }
```
`scale: 0` = automatique. `assist ∈ 'none' | 'assisted' | 'norhythm'`.

## 7. Contrats `render/`

```js
// render/renderer.js — possède les canvases (jeu, lumière, écran, ui)
export function initRenderer({ canvas, width: 480, height: 270 })  // résolution logique 16:9, échelle entière ensuite
export function getCtx() → CanvasRenderingContext2D   // calque principal (déjà translaté par la caméra à chaque frame)
export function getUiCtx() → CanvasRenderingContext2D // HUD en pixels logiques, non translaté
export function resize(scaleOption)                    // 0=auto ; recalcule l'échelle entière
export function beginFrame(alpha) / endFrame()         // compose : lumière multiply, braises screen, brume, vignette, grain
export function setVignette(v 0..1) / setGrain(v)
export function logicalSize() → { w, h, scale }

// render/atlas.js — feuilles de sprites décrites par assets/manifest.json
export async function loadAtlas(manifest) → void       // charge toutes les images (Promise), décode
export function draw(ctx, spriteId, animName, frameIndex, x, y, { flipX=false, alpha=1, tint=null, scale=1 } = {})
export function drawTile(ctx, tilesetId, tileIndex, x, y)
export function drawNineSlice(ctx, uiId, x, y, w, h)
export function animFrames(spriteId, animName) → { frames, fps, loop }
export function image(spriteId) → HTMLImageElement | ImageBitmap
  // `tint` : on pré-génère au chargement une version teintée par couleur via un canvas hors-écran (jamais par pixel à la frame)

// render/camera.js
export function initCamera({ w, h })
export function follow(x, y, dt)                       // lissage exponentiel
export function setZoom(z, durationSec)                // zoom boss
export function shake(intensity, durationSec)          // pondéré par l'option screenshake
export function get() → { x, y, zoom, shakeX, shakeY }
export function worldToScreen(x, y) / screenToWorld(x, y)
export function isVisible(x, y, r) → boolean           // culling

// render/lighting.js — canvas noir en multiply + calque screen
export function initLighting({ w, h, ambient: '#16130f' })
export function addLight(x, y, radius, color, intensity, flicker=0)   // par frame, buffer vidé à chaque beginFrame
export function addGlow(x, y, radius, color, intensity)                // calque screen (braises)
export function setAmbient(color)
export function setBeatPulse(v 0..1)                                   // halo au sol sur le temps

// render/particles.js — pool unique, rendu par sprite ou disque (les disques sont autorisés : ce sont des particules)
export function initParticles(max=4000)
export function emit(preset, x, y, opts)   // preset ∈ 'hit','hit_big','dust','ember','ash','silence','dash_trail','xp','bell','parry'
export function updateParticles(dt) / renderParticles(ctx, alpha)
export function setDensity(v 0..1)

// render/fx.js — juice
export function hitStop(ms)                // gèle la logique (timeScale 0) ms millisecondes
export function slowMo(scale, sec)
export function flash(color, frames=1)     // respecte l'option reduceFlash
export function damageNumber(x, y, value, { crit, onBeat })
export function updateFx(dt) / renderFx(ctx, alpha)
```

### 7 bis. Ajouts livrés (C et B) — font partie du contrat

- `core/input.js` : **`tickInput()` à appeler au début de chaque `update(dt)`** ; `initInput({canvas, getAudioTime, screenToWorld, logicalSize})` ; `applyBindings(map)`, `cancelCapture()`, `isCapturing()`.
- `render/fx.js` : **`initFx({ loop, getOptions })`** obligatoire ; `dashTrail(spriteId, anim, frame, x, y, flipX)`.
- `render/lighting.js` : `setHaloPos(x, y)` (position du joueur), `drawBeatHalo(ctx)` à appeler juste après le sol, `prepareLight(color)` au chargement.
- `render/renderer.js` : `getOverlayCtx()` (calque monde composé après la lumière), `setFog`, `setAshes`, `setFlash`, `addFrameHook`, `time()`, `frameDelta()`.
- `render/atlas.js` : `loadAtlas(manifestOuUrl, {baseUrl, tints})` ; `frameAt(id, anim, tSec)`, `animDone`, `dirAnim(id, base, dx, dy)`, `isDirectional(id)`, `prepareTint`, `drawShadow`, `drawIcon(ctx, iconId, x, y)`, `spriteDef/tileDef/uiDef/getManifest`. `tint` = colorisation 60 % ; `'#ffffff'` = flash blanc.
- `render/camera.js` : `worldToScreen/screenToWorld(x, y, out?)` renvoient un objet réutilisé ; `snap`, `viewRect`, `setShakeScale(option)`.
- `game/ground.js` (module de sol unique, `createGround/renderGround/drawProp`, props et lumières depuis parishes.json) ; `render/fonts.js` : `loadFonts(manifest)` ; `render/post.js` interne.
- `audio/conductor.js` : **`conductorTick()` à appeler à chaque tick 60 Hz** (émet `beat`/`bar`). `audio/audio.js` : `initAudio({options})`, `setAssetsBase(url)`. `audio/music.js` : `layerTargets()`. `audio/sfx.js` : `setListener(x, y)`, `playAmbience(id)/stopAmbience()`.
- `audio/timbres.js` : **les Timbres chantent** — `playTimbre(weaponId, {at, x, y, tier, level, big, fusion})` joue une note de la voix de l'arme (`src/data/music/timbres.json` : instrument, registre, motifs d'arpège, accents) sur l'accord courant de la partition (`music.chordAtTime(at)` / `currentChord()`, champ `chords` par mesure dans chaque partition, `audio/harmony.js`), ≤ 3 voix tonales par point de grille, événement `timbre:note`. `sampler.play({release})`, `sfx.play({source})` (impacts limités à 1 par temps et par source, morts 2 par temps).
- Ordre par frame recommandé (`main.js`) : `update` → `tickInput(); conductorTick(); updateFx(dt); jeu; camera.follow(); updateParticles(dt)` ; `render(alpha)` → `beginFrame(alpha)` → `renderGround` → `drawBeatHalo` → ombres → entités + props triés par y → projectiles → `renderParticles` → `renderFx` → lumières → HUD sur `getUiCtx()` → `endFrame()`.

## 8. Contrats `audio/` — le cœur du projet

Graphe : `sources → (bus music | bus sfx | bus ui) → lowpass global → master → destination`.
`music` passe par un `GainNode` de ducking (−4 dB, attaque 10 ms, retour 250 ms).

```js
// audio/audio.js — moteur
export async function initAudio()            // crée l'AudioContext (suspendu), les bus, charge les volumes des options
export async function unlock()               // à appeler dans un handler de clic ; resume() puis bus.emit('audio:unlocked')
export function ctx() → AudioContext
export function now() → number               // ctx.currentTime
export function busNode(name) → GainNode     // 'master' | 'music' | 'sfx' | 'ui'
export function setVolume(name, v 0..1)
export async function loadBuffer(url) → AudioBuffer     // cache par URL, décodage unique
export function getBuffer(url) → AudioBuffer | undefined
export function setLowpass(amount 0..1)      // 0 = ouvert (20 kHz), 1 = étouffé (~600 Hz), lissage 80 ms
export function duck()                        // ducking musique −4 dB (déclenché par weapon:fire big / enemy:hit big)

// audio/conductor.js — LA MESURE. Une seule source de vérité temporelle pour le gameplay rythmique.
export function initConductor({ bpm = 96, beatsPerBar = 4, lookaheadSec = 0.12, tickMs = 25 })
export function start(atTime = now() + 0.05) / stop()
export function isRunning() → boolean
export function setBpm(bpm)                   // prend effet à la prochaine mesure
export function bpm() → number
export function beatDuration() → number       // secondes
export function beatIndex() → number          // entier global, monotone (temps courant)
export function beatInBar() → 0..3
export function bar() → number
export function phase() → 0..1                // position dans le temps courant (rendu du halo)
export function nextBeatAt(subdivision = 1) → number  // temps audio du prochain point de grille ; subdivision 0.5 = croche, 2 = blanche, 4 = ronde
export function schedule(subdivision, fn) → unschedule  // fn(at, beatIndex) appelé ~lookahead AVANT chaque point de grille : c'est ici qu'on planifie les sons
export function judge(inputAt) → { grade:'parfait'|'bon'|'rate', offsetMs, beat }
  // fenêtre : ±windowMs ('bon'), ±windowMs/3 ('parfait') ; windowMs = base × facteur d'assistance
export function setWindowMs(ms) / windowMs()
```
Implémentation imposée : un `setTimeout(tickMs)` (ou Worker) qui, à chaque tick, planifie tous les points de grille tombant dans `[now, now + lookaheadSec]`, en appelant les callbacks `schedule` avec le temps audio exact. Les événements `beat`/`bar` du bus sont émis depuis le tick logique 60 Hz quand `beatIndex()` change (jamais depuis le timer audio) pour rester synchronisés au gameplay.

```js
// audio/sampler.js — instrument échantillonné (couche basse de music.js et sfx.js)
export function createInstrument(def) → Instrument     // def : entrée `samples` du manifest audio (§ 9.2)
  // instrument.play(noteOrKey, at, { gain=1, pitchSemis=0, duration=null, bus='music', pan=0 }) → { stop(at) }
  // choisit l'échantillon le plus proche de la note, transpose via playbackRate, round-robin aléatoire, enveloppe
  // de release 30 ms minimum pour éviter les clics.

// audio/music.js — pistes construites à partir de partitions JSON (§ 9.3) et d'instruments échantillonnés
export async function loadTrack(trackId) → void       // charge la partition et les échantillons nécessaires
export function play(trackId, { layers = 1, fadeSec = 1 })   // démarre calé sur la Mesure ; appelle conductor.setBpm(partition.bpm)
export function stop(fadeSec = 1)
export function setLayers(n 1..4)                     // crossfade 200 ms par couche, jamais de coupure sèche
export function current() → trackId | null
export function setIntensity(v 0..1)                  // variation continue dans la couche (ex. densité des ornements)
// Écoute `resonance:change` → setLayers(tier + 1). Écoute `player:inAura` → audio.setLowpass(depth).

// audio/sfx.js
export async function loadSfx(manifest)                // pré-décode tous les bruitages
export function play(id, { volume=1, pitchVar=0.08, x=null, y=null, bus='sfx', at=null }) → void
  // variantes : le manifest liste N fichiers pour un id ; choix aléatoire sans répétition immédiate ;
  // pitch aléatoire ±pitchVar ; atténuation/pan par distance au joueur si x,y fournis ; limite de 6 voix par id par 100 ms
export function playUi(id)                             // raccourci bus 'ui'
```

Identifiants de bruitages obligatoires (contrat entre B et D/E) :
`hit_light`, `hit_heavy`, `hit_crit`, `enemy_die`, `enemy_die_big`, `boss_hit`, `boss_roar`, `player_step`, `player_hurt`, `player_death`, `dash`, `parry_ok`, `parry_miss`, `resonance_1`, `resonance_2`, `resonance_3`, `resonance_4`, `resonance_drop`, `level_up`, `card_flip`, `card_pick`, `xp_pickup`, `xp_pickup_big`, `bell_minute`, `bell_tier`, `silence_cry`, `silence_burst`, `ui_move`, `ui_confirm`, `ui_cancel`, `weapon_battant`, `weapon_clarine`, `weapon_bourdon`, `weapon_grelots`, `weapon_tocsin`, `weapon_cor`, `weapon_crecelle`, `weapon_chaine`, `weapon_diapason`, `fusion`, `achievement`, `lore_unlock`, `victory_bell`.

Identifiants de pistes obligatoires : `menu`, `hub`, `cendrelune`, `tourbes`, `val_des_cordes`, `nef_noyee`, `beffroi_mere`, `boss`, `victory`, `death`.

### 8 bis. Contrats ajoutés après les audits (vague « approfondissement »)

- `conductor.setInputLatencyMs(ms)` / `inputLatencyMs()` : décalage soustrait à `inputAt` dans `judge()` (calibration dans les options, −150…+150 ms). `judge()` renvoie aussi `early: boolean` (en avance) pour le retour « avance / retard ».
- Résonance (game/resonance.js) : 4 crans ; le cran 3 (×2.5) ne se **tient** qu'avec des frappes « parfait » : un « bon » au cran 3 n'ajoute rien, un « raté » fait perdre un cran immédiatement (avant : 3 ratés). `resonance:change` inchangé ; nouvel événement `resonance:streak {count}` (Parfaits consécutifs).
- Parade (player/collision) : recharge d'un temps (`balance.player.parryCooldownBeats` = 1) ; une parade qui ne pare rien (ni contact ni projectile) est une frappe rythmique **sans gain** ; une parade réussie donne le gain normal + `player:parry {success:true}`.
- Musique (audio/music.js) écoute : `run:start {parishId}` → joue l'ambiance de la paroisse (`parishes.json.ambience`, id de `manifest.samples/ambiences`) ; `run:tier {tier}` → `setIntensity` par palier et `conductor.setBpm(base + 2·tier)` appliqué à la mesure suivante ; `run:fissure {phase:'start'}` → pont (couche « pont » de la partition, 4 mesures) ; `run:boss {phase:'intro'}` → levée de 2 mesures puis piste `boss` ; `run:moment {id:'accalmie'}` → intensité basse. `audio.js` : limiteur doux sur le master (`DynamicsCompressorNode`, seuil −6 dB, ratio 12, c'est un traitement, pas une source), coupe-bas 35 Hz, ducking uniquement sur `enemy:hit {crit}` et `weapon:fusion`.
- Bruitages : `bell_minute` n'est joué que par `bell-hour.js` (le spawner n'appelle plus de son) ; `bell_tier` réservé au palier ; `moment_start` (levée courte) et `pickup` (grelot bref) sont de nouveaux identifiants à fournir par l'audio.
- Jingles (`resonance_1..4`, `level_up`, `achievement`, `fusion`) : joués par le sampler sur l'accord courant (`music.currentChord()`), plus de fichiers en majeur fixe.
- Événements ajoutés : `resonance:streak`, `enemy:desaccord {x, y, depth}` (ennemi qui fausse la musique : `music.setDetune(cents)` local), `boss:phase {bossId, phase}` (bannière), `player:hit` porte désormais `dirX, dirY`.

## 9. Manifestes d'assets

### 9.1 `assets/manifest.json` (visuel, agent A)
```json
{ "version": 1,
  "sprites": {
    "wren": { "file": "sprites/wren.png", "frameW": 64, "frameH": 64, "anchor": [0.5, 0.9],
              "anims": { "idle_down": {"row": 2, "frames": 1, "fps": 1, "loop": true},
                         "walk_down": {"row": 10, "frames": 9, "fps": 12, "loop": true},
                         "walk_up": {...}, "walk_left": {...}, "walk_right": {...},
                         "attack_down": {...}, "hurt": {...} },
              "shadow": 10, "credit": "lpc_wren" } },
  "tiles": { "cendrelune": { "file": "tiles/cendrelune.png", "tileW": 32, "tileH": 32, "credit": "..." ,
             "ground": [0,1,2], "props": {"stump":7, "fence":8} } },
  "ui": { "frame_parchment": { "file": "ui/frame.png", "slice": [8,8,8,8], "credit": "..." },
          "icons": { "file": "ui/icons.png", "frameW": 32, "frameH": 32, "map": {"battant": 0, "ferrure": 12}, "credit": "..." } },
  "fonts": { "display": {"file": "fonts/UnifrakturCook-Bold.ttf", "family": "CarillonDisplay", "credit": "..."},
             "ui":      {"file": "fonts/...", "family": "CarillonUi", "credit": "..."} },
  "credits": { "lpc_wren": { "title": "...", "authors": ["..."], "license": "CC-BY-SA 3.0", "source": "https://...", "downloadedFrom": "https://...", "evidence": "chemin/du/fichier/de/licence" } } }
```
Toute `anim` a au minimum `idle_down`, `walk_down/up/left/right` pour un personnage ; `idle`, `walk`, `die` pour un ennemi (les ennemis peuvent être uni-directionnels avec `flipX`).

### 9.2 `assets/audio/manifest.json` (agent B)
```json
{ "version": 1,
  "sfx": { "hit_light": { "files": ["audio/sfx/hit_light_1.ogg", "audio/sfx/hit_light_2.ogg", "audio/sfx/hit_light_3.ogg"], "gain": 0.9, "credit": "vcsl" } },
  "samples": { "frame_drum": { "kind": "percussion", "files": { "low": ["audio/samples/frame_drum/low_1.ogg", "..."], "high": [...] }, "credit": "vcsl" },
               "contrabass": { "kind": "pitched", "files": { "C2": "audio/samples/contrabass/C2.ogg", "G2": "..." }, "loop": {"C2": [1.2, 3.4]}, "credit": "vsco2" } },
  "tracks": { "cendrelune": { "score": "src/data/music/cendrelune.json", "credit": "original" },
              "menu": { "file": "audio/music/menu.ogg", "loop": [0.0, 94.2], "bpm": 84, "credit": "..." } },
  "credits": { "vcsl": { "title": "Versilian Community Sample Library", "authors": ["Versilian Studios LLC"], "license": "CC0 1.0", "source": "https://github.com/sgossner/VCSL", "downloadedFrom": "https://github.com/sgossner/VCSL", "evidence": "LICENSE" } } }
```
Une piste est soit un fichier bouclé (`file`, `loop` = points de boucle vérifiés), soit une partition (`score`) jouée par `music.js`.

### 9.3 Partition `src/data/music/<trackId>.json`
```json
{ "id": "cendrelune", "bpm": 96, "beatsPerBar": 4, "bars": 16, "key": "D",
  "layers": [
    { "tier": 0, "name": "bourdon",     "instrument": "contrabass",  "gain": 0.8,
      "events": [ { "bar": 0, "beat": 0, "note": "D2", "dur": 16 } ] },
    { "tier": 1, "name": "percussions", "instrument": "frame_drum", "gain": 0.9,
      "pattern": { "steps": 8, "hits": [ ["low", 0, 1.0], ["high", 3, 0.6], ["low", 4, 0.9], ["high", 6, 0.5] ] }, "repeatBars": 1 },
    { "tier": 2, "name": "vielle",      "instrument": "psaltery_bow", "events": [ ... ] },
    { "tier": 3, "name": "voix",        "instrument": "choir",        "events": [ ... ] }
  ] }
```
`tier` = cran de Résonance minimal pour entendre la couche (0 = toujours). `pattern.steps` = subdivisions par mesure. `dur` en temps. Les `events` sont relatifs à la boucle de `bars` mesures et se répètent.

## 10. Données de jeu (`src/data/`)

```jsonc
// weapons.json — un Timbre
{ "id": "battant", "name": "weapon.battant.name", "desc": "weapon.battant.desc", "icon": "battant",
  "behavior": "arc",                   // arc | orbit | shockwave | homing | aura | cone | burst | chain | mark
  "rhythm": 1,                         // subdivision de tir : 0.5 croche, 1 noire, 2 blanche, 4 ronde
  "sfx": "weapon_battant", "projectileSprite": null,
  "base":  { "damage": 12, "area": 1.0, "count": 1, "speed": 1.0, "duration": 0.25, "knockback": 40, "pierce": 1 },
  "levels": [ {}, { "damage": 4 }, { "area": 0.2 }, { "count": 1 }, { "damage": 6 }, { "area": 0.2, "knockback": 20 }, { "damage": 10 } ],   // 7 niveaux, deltas additifs
  "maxLevel": 7 }

// passives.json — un Accord
{ "id": "ferrure", "name": "passive.ferrure.name", "desc": "passive.ferrure.desc", "icon": "ferrure",
  "stat": "armor", "perLevel": 1, "maxLevel": 5 }
// stats connues : armor, speed, area, cadence, regen, window, crit, bounce, maxHp, magnet, xpGain

// fusions.json
{ "id": "glas", "weapon": "tocsin", "passive": "contrepoids", "name": "...", "desc": "...", "behavior": "aura_screen", "rhythm": 4, "base": {...} }

// enemies.json
{ "id": "feutre", "name": "enemy.feutre.name", "lore": "enemy.feutre.lore", "sprite": "feutre",
  "hp": 30, "speed": 28, "damage": 8, "xp": 2, "radius": 12, "mass": 1,
  "behavior": "chase",                 // chase | leap | ranged | swarm | explode | crawl | summon | boss
  "special": { "auraRadius": 90 },     // libre par comportement, documenté dans enemies.js
  "onBeatOnly": false, "tint": "#8f8d93", "deathParticles": "silence" }

// waves.json — par paroisse
{ "cendrelune": { "duration": 720, "tierEvery": 120,
  "spawns": [ { "from": 0, "to": 120, "kind": "feutre", "perSec": 0.8, "cap": 40 }, ... ],
  "events": [ { "at": 240, "type": "fissure", "boss": "veuve_grise_elite" }, { "at": 480, "type": "fissure", "boss": "cierge_elite" }, { "at": 720, "type": "boss", "boss": "bourdon_fele" } ] } }

// parishes.json
{ "id": "cendrelune", "name": "parish.cendrelune.name", "tileset": "cendrelune", "track": "cendrelune", "boss": "bourdon_fele",
  "ambient": "#16130f", "fog": ["#2a241c", "#8f8d93"], "unlock": null, "bronzeReward": 120, "leaves": ["f01","f02","f03","f04","f05"] }

// characters.json — `startWeaponFixed: true` (Le Muet garde le Diapason en premier) ; Timbres de départ débloqués : src/data/start-weapons.json { unlockLevel, costs }
{ "id": "wren", "name": "char.wren.name", "desc": "char.wren.desc", "sprite": "wren", "startWeapon": "battant",
  "stats": { "maxHp": 100, "speed": 110, "armor": 0, "windowMult": 1.3, "resonanceGain": 1, "damageMult": 1 }, "unlockCost": 0, "unique": null }

// upgrades.json (arbre du Beffroi, ≥ 12 nœuds)
{ "id": "bronze_heart", "name": "...", "desc": "...", "cost": [50, 120, 250], "stat": "maxHp", "perLevel": 10, "requires": [] }

// achievements.json (≥ 15)
{ "id": "first_dawn", "name": "...", "desc": "...", "condition": { "type": "run_win", "count": 1 } }

// lore.json — 24 Feuillets
{ "id": "f01", "title": "lore.f01.title", "text": "lore.f01.text", "unlock": { "type": "run_minute", "parish": "cendrelune", "minute": 4 } }

// fr.json / en.json — clés imbriquées, mêmes clés dans les deux fichiers (test automatique dans tests/)
```

## 10 bis. Registre des identifiants et des clés i18n (partagé, figé)

Tout identifiant de données est en `snake_case` et doit figurer ici avant d'être utilisé.

- **Sonneurs** : `wren`, `osric`, `maren`, `le_muet`.
- **Timbres** : `battant`, `clarine`, `bourdon`, `grelots`, `tocsin`, `cor_de_brume`, `crecelle`, `chaine_d_angelus`, `diapason`.
- **Accords** : `ferrure`, `souffle`, `contrepoids`, `corde_de_chanvre`, `cire_d_abeille`, `metronome`, `etain`, `echo`.
- **Fusions** : `glas` (tocsin + contrepoids), `carillon` (clarine + echo), `tonnerre` (bourdon + etain), `requiem` (diapason + metronome).
- **Ennemis** : `feutre`, `baillon`, `ouateux`, `fossoyeur`, `choeur_muet`, `rampe_suie`, `veuve_grise`, `cierge`. Élites de Fêlure : `<ennemi>_elite`.
- **Boss** : `bourdon_fele` (Cendrelune, Les Tourbes), `veuve_suie` (Val-des-Cordes, La Nef Noyée), `maitre` (Le Beffroi Mère).
- **Paroisses** : `cendrelune`, `tourbes`, `val_des_cordes`, `nef_noyee`, `beffroi_mere`.
- **Améliorations du Beffroi** (`upgrades.json`, ≥ 12) : `coeur_de_bronze` (maxHp), `semelles_de_cuir` (speed), `ferrure_du_beffroi` (armor), `oreille_fine` (window), `battant_lourd` (damageMult), `aimant_d_echos` (magnet), `reliquaire` (xpGain), `cire_de_veillee` (regen), `main_sure` (crit), `bourse_de_cuivre` (bronzeGain), `second_souffle` (revive), `contrepoids_de_fonte` (area), `corde_neuve` (cadence), `troisieme_carte` (rerolls).
- **Hauts-faits** (`achievements.json`, ≥ 15) : `premiere_aube`, `sonneur_confirme`, `cent_echos`, `mille_silences`, `plein_timbre`, `plein_accord`, `premiere_fusion`, `quatre_fusions`, `resonance_parfaite`, `sans_faute`, `fele_vaincu`, `veuve_vaincue`, `maitre_vaincu`, `toutes_paroisses`, `tous_sonneurs`, `tous_timbres`, `feuillets_complets`, `sans_rythme_victoire`, `muet_victoire`, `repondre_a_la_cloche`.
- **Feuillets** : `f01` … `f24`.
- **Vague 2 (méta)** : améliorations-règles `cloche_qui_soigne`, `timbre_niveau_2`, `deuxieme_chance`, `contrat_en_plus`, `deuxieme_relique`, `echo_de_felure` (champs `branch`, `rule`) ; hauts-faits `sourdine_v_cendrelune`, `veillee_longue`, `nuit_du_jour`, `premier_contrat`, `dix_contrats` ; contrats (`src/data/contracts.json`) `choeurs_sur_le_temps`, `tenir_cran_2`, `trois_cloches`, `quatre_timbres`, `sans_relique`, `felure_rapide`, `echo_geant`, `sans_coup_une_minute`, `douze_parfaits`, `une_fusion`, `gagner_muet`, `sans_accord`, `cierge_errant`, `aube_cran_4` ; conditions `bell_answers_run`, `run_win_sourdine`, `vigil_seconds`, `daily_done`, `contracts_done`, `leaf_read_tier` ; événement `contract:done {id}` ; écrans `contracts`, `vigil`, `ending`, `daily` ; Save v3 (`sourdine`, `records`, `daily`, `leavesPending`, `battantSeen`, `ending`) ; clés i18n `contract.*`, `ending.*`, `battant.*`, `char.*.quest`, `ui.contracts.*`, `ui.sourdine.*`, `ui.vigil.*`, `ui.ending.*`.
- **Vague 1 (combat)** : ennemis `contretemps`, `voleur_de_cran`, `desaccordeur` ; fusions `grande_volee`, `transhumance`, `corne_de_guet`, `crecelle_du_vendredi`, `angelus_de_veillee` (voir fusions.json pour les ids exacts) ; événements `boss:phase`, `enemy:desaccord`, `resonance:streak`.

- **Bruitages et pistes** : § 8.

Clés i18n (`t('...')`), deux fichiers par langue fusionnés par `i18n.loadLang` :
- `src/data/<lang>.json` — **contenu** (agent F) : `weapon.<id>.name|desc`, `passive.<id>.name|desc`, `fusion.<id>.name|desc`, `enemy.<id>.name|lore`, `boss.<id>.name|lore`, `parish.<id>.name|desc`, `char.<id>.name|desc|trait`, `upgrade.<id>.name|desc`, `achievement.<id>.name|desc`, `lore.<fNN>.title|text`, `tutorial.<step>` (`move`, `wave`, `beat1`, `beat2`, `beat3`, `levelup`, `goal`, `done`), `codex.intro`, `hub.intro`, `title.tagline`.
- `src/data/ui-<lang>.json` — **interface** (agent E) : `ui.*` (menus, HUD, options, pause, bilan, codex, hub, notifications, remappage). E crée les deux fichiers `ui-fr.json` et `ui-en.json` avec exactement les mêmes clés.
- Les descriptions d'armes contiennent des paramètres nommés `{damage}`, `{count}`, `{area}` remplis par `t(key, params)`.

## 11. Contrats `game/` et `ui/`

```js
// game/player.js
export function createPlayer(characterDef, upgradesApplied) → player   // { x, y, r, hp, maxHp, stats, weapons:[], passives:[], facing, state }
export function updatePlayer(p, dt, world)   // déplacement, dash (Volée), parade (Contre-battement), jugement rythmique via conductor.judge(pressedAt('dash'))
export function renderPlayer(ctx, p, alpha)

// game/resonance.js — le hook
export function initResonance({ assist })     // 'none' | 'assisted' | 'norhythm'
export function onRhythmInput(grade)          // 'parfait' +2 crans de valeur, 'bon' +1, 'rate' -1.5 ; émet resonance:change
export function tier() → 0..3 ; mult() → 1 | 1.4 | 1.8 | 2.5 ; value() → 0..1 (dans le cran)
export function block(sec) ; update(dt)       // décroissance lente si aucune action rythmique pendant 4 temps

// game/weapons.js — tir sur la grille : chaque arme s'abonne à conductor.schedule(rhythm, fire)
export function addWeapon(p, weaponId) / upgradeWeapon(p, weaponId) / updateWeapons(p, dt, world) / renderWeapons(ctx, alpha)
export function dpsReport() → { [weaponId]: damageTotal }

// game/enemies.js / spawner.js / boss.js / pickups.js / collision.js
export function createWorld({ parishDef, rng, waveDef }) → world   // { enemies:Pool, projectiles:Pool, pickups:Pool, grid, time, tier }
export function updateWorld(world, dt, player)
export function renderWorld(ctx, world, alpha)
export function spawnEnemy(world, kind, x, y) → enemy
export function damageEnemy(world, enemy, amount, { crit, onBeat, knockX, knockY, source })

// game/progression.js
export function initRun({ parishId, characterId, seed })  → run   // { xp, level, nextXp, kills, timeSec, stats }
export function addXp(run, amount)             // déclenche level:up avec 3 cartes tirées au rng (pondération : 60 % armes non maxées, 40 % passifs)
export function applyCard(run, player, card)
export function finishRun(run, victory) → RunStats  // bronze = f(temps, kills, résonance moyenne, victoire) ; débloque Feuillets ; commit()

// ui/i18n.js
export async function loadLang(code) ; export function t(key, params = {}) → string ; export function lang() ; export function has(key)
  // charge et fusionne src/data/<code>.json (contenu, agent F) et src/data/ui-<code>.json (interface, agent E) ; clé absente → renvoie la clé et loggue un avertissement une seule fois

// ui/widgets.js — primitives UI dessinées sur canvas via 9-slice et polices locales
export function panel(ctx, x, y, w, h, style='parchment') ; button(...) ; gauge(...) ; card(...) ; text(ctx, str, x, y, style)

// Chaque écran ui/*.js : export function create(deps) → { enter(params), exit(), update(dt), render(ctx, alpha), handleAction(action) }
```

`RunStats` : `{ parishId, characterId, seed, timeSec, kills, victory, dpsByWeapon, resonanceAvg, bronze, leafUnlocked, level, build: { weapons: [{id, level}], passives: [{id, level}] } }`.

## 11 bis. Mécaniques ajoutées après le premier playtest

### Reliques de paroisse (`src/game/relics.js`, `src/data/relics.json`, `src/ui/relic-pick.js`)
- Au début de chaque nuit (après le tutoriel, avant la première vague), deux Reliques tirées au rng du run sont proposées ; le joueur en prend une (ou aucune). Une Relique modifie une règle de la run entière, avec un coût ou un revers. Exemples de `relics.json` (≥ 10) :
  `{ "id": "chapelet_de_cire", "name": "relic.chapelet_de_cire.name", "desc": "…", "icon": "…", "effects": { "magnetAll": true }, "drawbacks": { "xpGain": -0.15 } }`,
  `clef_du_beffroi` (Fêlures 1 min plus tôt, Bronze ×2), `langue_de_cloche` (Contre-battement renvoie deux fois, fenêtre −20 %), `suif_de_veillee` (régén ×2, vitesse −10 %), `bronze_fele` (dégâts +25 %, PV max −20 %), `oreille_du_maitre` (fenêtre ×1.5, Résonance décroît ×2), `bourse_percee` (Échos ×1.5, aucun soin), `corde_usee` (cadence +1 cran, recul −50 %), `cierge_noir` (ennemis −15 % PV, élites +50 %), `voile_de_brume` (halo ×1.6, ennemis invisibles hors halo).
- API : `pickRelic(run, relicId)`, `relicMods(run)` → objet de modificateurs lu par player/progression/spawner/pickups/resonance ; événement `relic:pick {relicId}`. Codex : onglet Reliques (découvertes). Bilan : Relique de la nuit.

### Cloche horaire (`src/game/bell-hour.js`, HUD)
- À chaque `run:minute`, la cloche de la paroisse sonne 4 coups sur les 4 temps de la mesure suivante (sfx `bell_minute` déjà joué ; ajouter un coup par temps, dernier plus fort). Si le joueur exécute un Contre-battement dans la fenêtre du **4ᵉ coup**, il « répond à la cloche » : événement `bell:answered {minute, grade}` → bonus tiré par minute : soin 15 %, +1 cran de Résonance, carte gratuite (niveau bonus) à la 4ᵉ et 8ᵉ minute, Bronze ×1 à la 12ᵉ. Manqué : rien (pas de malus).
- HUD : bannière « La cloche sonne » avec 4 points qui s'allument sur les coups, le 4ᵉ en bronze ; retour « Répondu ! » ; le halo pulse plus fort pendant la sonnerie. Haut-fait `repondre_a_la_cloche` (10 réponses). Feuillet possible sur `bell_answers`.

## 12. Périmètres exclusifs des agents

| Agent | Écrit uniquement dans |
|---|---|
| A — Assets visuels | `assets/sprites/**`, `assets/tiles/**`, `assets/ui/**`, `assets/fonts/**`, `assets/manifest.json`, `assets/preview.html`, `assets/CREDITS-visual.md` |
| B — Audio | `assets/audio/**`, `src/audio/**`, `src/data/music/**` |
| C — Moteur & rendu | `src/core/**`, `src/render/**` |
| D — Gameplay | `src/game/**` + création initiale de `src/data/{weapons,passives,fusions,enemies,waves,parishes,characters,upgrades,achievements}.json` (G ne retouche ensuite que les valeurs, jamais en parallèle de D) |
| E — UI/UX & méta | `src/ui/**`, `index.html`, `src/main.js`, `src/data/ui-fr.json`, `src/data/ui-en.json`, CSS |
| F — Lore & contenu | `src/data/lore.json`, `src/data/fr.json`, `src/data/en.json` (contenu : noms, descriptions, Feuillets, tutoriel) |
| G — Équilibrage & QA | `src/data/*.json` (valeurs numériques), `tests/**` ; rapporte, ne modifie pas le JS des autres |
| Lead | `CREDITS.md`, `README.md`, `ARCHITECTURE.md`, `PROMPT.md`, `SOURCING.md`, arbitrages, intégration |

## 13. Budget de performance

- Cible : 60 fps avec 400 entités + 300 projectiles + 2000 particules à la minute 10 sur un portable intégré.
- Rendu : un seul `drawImage` par entité, aucun `save/restore` par entité (transformations manuelles), aucune allocation dans les boucles chaudes (pools, tableaux réutilisés, pas de closures par frame).
- Collision : grille de 64 px, requêtes locales ; jamais O(n²).
- Culling : rien n'est dessiné hors de `camera.isVisible`.
- Sol : pré-rendu en offscreen canvas par chunk de 512 px, redessiné uniquement quand la caméra entre dans un nouveau chunk.
- Audio : ≤ 48 voix simultanées ; `sfx.play` refuse au-delà de 6 voix identiques / 100 ms ; tous les buffers décodés au chargement de la paroisse.
- Poids : audio total < 60 Mo, images < 15 Mo, temps de chargement d'une paroisse < 3 s sur réseau local.
