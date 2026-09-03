/* ---------- biomes ---------- */
const BIOMES = [
  { id: 'crypte', name: 'Catacombes', sub: 'Pierre froide et torches mourantes',
    pal: { floor: '#232739', floor2: '#1d2130', deco: '#2b3048', wall: '#363c5b', wallTop: '#4a5280', wallEdge: '#5d67a0', accent: '#7fd7ff', torch: '#ffb347', wallStyle: 'brick', decoKind: 'bones' },
    hazards: [], enemies: ['slime', 'slime', 'bat', 'archer', 'brute'], boss: 'guardian', tracks: ['crypte', 'crypte2'], amb: 'drip', dark: 0.55, root: 50 },
  { id: 'foret', name: 'Forêt des Racines', sub: 'Des troncs qui poussent vers le bas',
    pal: { floor: '#24301f', floor2: '#1d271a', deco: '#31442a', wall: '#3f3120', wallTop: '#5a4a2c', wallEdge: '#7e6a3e', accent: '#9be36a', torch: '#ffd27a', wallStyle: 'roots', decoKind: 'forest' },
    hazards: ['mud', 'water'], enemies: ['loup', 'corbeau', 'sylvain', 'sanglier', 'spider', 'corbeau'], boss: 'cerf', tracks: ['foret', 'foret2'], amb: 'forest', dark: 0.5, root: 53 },
  { id: 'jardin', name: 'Jardin Suspendu', sub: 'Racines, spores et lumière verte',
    pal: { floor: '#233626', floor2: '#1c2c1f', deco: '#2f4a30', wall: '#3d5a34', wallTop: '#557a48', wallEdge: '#7aa862', accent: '#b8ff7a', torch: '#c8ff9a', wallStyle: 'roots', decoKind: 'garden' },
    hazards: ['water', 'mud'], enemies: ['thornling', 'thornling', 'wasp', 'druid', 'treant', 'spider'], boss: 'sylve', tracks: ['jardin', 'jardin2'], amb: 'swamp', dark: 0.5, root: 55, glow: '#b8ff7a' },
  { id: 'marais', name: 'Marais Putride', sub: 'Eaux mortes et bourdonnements',
    pal: { floor: '#22301f', floor2: '#1b271a', deco: '#2c3d28', wall: '#3a4a2c', wallTop: '#546c3a', wallEdge: '#6f8f4a', accent: '#a3ff5e', torch: '#9dff7a', wallStyle: 'rough', decoKind: 'reeds' },
    hazards: ['water', 'poison'], enemies: ['slime', 'spider', 'toad', 'shaman', 'bat', 'spider'], boss: 'queen', tracks: ['marais', 'marais2'], amb: 'swamp', dark: 0.6, root: 52 },
  { id: 'ossuaire', name: 'Ossuaire', sub: 'Des murs faits de ceux qui sont passés',
    pal: { floor: '#2e2a26', floor2: '#26221e', deco: '#3c3630', wall: '#5a5248', wallTop: '#8a8070', wallEdge: '#b0a898', accent: '#f0e8d0', torch: '#ffd07a', wallStyle: 'bone', decoKind: 'skulls' },
    hazards: ['spikes'], enemies: ['archer', 'bonespider', 'skullbomb', 'bonegolem', 'bat', 'archer'], boss: 'lich', tracks: ['ossuaire', 'ossuaire2'], amb: 'drip', dark: 0.58, root: 49 },
  { id: 'fongique', name: 'Grotte Fongique', sub: 'Chapeaux luisants et spores qui dérivent',
    pal: { floor: '#2a2236', floor2: '#231c2e', deco: '#3a2e4a', wall: '#3a2f48', wallTop: '#55446a', wallEdge: '#7a6494', accent: '#d98cff', torch: '#8fd8c8', wallStyle: 'rough', decoKind: 'mushrooms' },
    hazards: ['poison', 'mud'], enemies: ['myconide', 'myconide', 'phalene', 'sporeling', 'mycomancien', 'spider'], boss: 'mycelium', tracks: ['fongique', 'fongique2'], amb: 'drip', dark: 0.6, root: 51, glow: '#b07ad8' },
  { id: 'forge', name: 'Forge Ardente', sub: 'Métal en fusion et cendres',
    pal: { floor: '#2f2424', floor2: '#271c1c', deco: '#3c2c28', wall: '#4b302b', wallTop: '#6e4238', wallEdge: '#915242', accent: '#ff7b3a', torch: '#ff9f43', wallStyle: 'brick', decoKind: 'forge' },
    hazards: ['lava'], enemies: ['imp', 'turret', 'golem', 'mage', 'bat', 'imp'], boss: 'colossus', tracks: ['forge', 'forge2'], amb: 'fire', dark: 0.45, root: 48 },
  { id: 'cascade', name: 'Gorges des Cascades', sub: 'Roche mouillée et rugissement d\'eau',
    pal: { floor: '#2a3238', floor2: '#232a30', deco: '#364249', wall: '#3d4a52', wallTop: '#5a6c78', wallEdge: '#82a0b0', accent: '#7fe0ff', torch: '#ffd27a', wallStyle: 'rough', decoKind: 'cascade' },
    hazards: ['water', 'pit'], enemies: ['grenouille', 'crabe', 'harpie', 'naiade', 'crabe', 'harpie'], boss: 'salamandre', tracks: ['cascade', 'cascade2'], amb: 'water', dark: 0.48, root: 56 },
  { id: 'cristal', name: 'Grottes de Cristal', sub: 'Chaque paroi renvoie ta lumière',
    pal: { floor: '#2a2340', floor2: '#221c36', deco: '#3a2f58', wall: '#4a3a70', wallTop: '#6a52a0', wallEdge: '#9a7ad0', accent: '#ff7bd5', torch: '#7bffea', wallStyle: 'crystal', decoKind: 'crystals' },
    hazards: ['ice', 'spikes'], enemies: ['crystalbat', 'crystalturret', 'crystalgolem', 'icemage', 'crystalbat', 'ghost'], boss: 'prism', tracks: ['cristal', 'cristal2'], amb: 'wind', dark: 0.5, root: 57, glow: '#ff7bd5' },
  { id: 'givre', name: 'Cavernes de Givre', sub: 'Glace bleue et souffle glacial',
    pal: { floor: '#253447', floor2: '#1f2b3c', deco: '#2f4158', wall: '#3f5772', wallTop: '#5d7d9f', wallEdge: '#82a4c8', accent: '#bfe9ff', torch: '#9fd8ff', wallStyle: 'rough', decoKind: 'ice' },
    hazards: ['ice'], enemies: ['wolf', 'wolf', 'icemage', 'ghost', 'yeti', 'archer'], boss: 'frostking', tracks: ['givre', 'givre2'], amb: 'wind', dark: 0.5, root: 54 },
  { id: 'noyee', name: 'Cité Noyée', sub: 'Une ville sous une mer qui ne bouge plus',
    pal: { floor: '#1f3038', floor2: '#182830', deco: '#284048', wall: '#2f4a55', wallTop: '#456a78', wallEdge: '#6a98a8', accent: '#5fd6ff', torch: '#7fe8ff', wallStyle: 'brick', decoKind: 'drowned' },
    hazards: ['water', 'mud', 'pit'], enemies: ['drowned', 'toad', 'ghost', 'wolf', 'drowned', 'spider'], boss: 'leviathan', tracks: ['noyee', 'noyee2'], amb: 'swamp', dark: 0.62, root: 51 },
  { id: 'abime', name: "L'Abîme", sub: 'Là où la lumière renonce',
    pal: { floor: '#1b1727', floor2: '#160f20', deco: '#261d35', wall: '#2c2342', wallTop: '#3f3163', wallEdge: '#57448e', accent: '#c77dff', torch: '#b36bff', wallStyle: 'rough', decoKind: 'runes' },
    hazards: ['pit'], enemies: ['ghost', 'shade', 'bomber', 'voidmage', 'spider', 'wolf', 'bomber'], boss: 'eye', tracks: ['abime', 'abime2'], amb: 'void', dark: 0.78, root: 47, glow: '#c77dff' },
];
const FLOORS_PER_BIOME = 2;
const biomeFor = floor => BIOMES[Math.floor((floor - 1) / FLOORS_PER_BIOME) % BIOMES.length];
const cycleOf = floor => Math.floor((floor - 1) / (FLOORS_PER_BIOME * BIOMES.length));

/* ---------- ennemis ---------- */
const ETYPES = {
  slime:    { name: 'Vase', shape: 'blob', r: 13, hp: 3, spd: 74, color: '#6ee76e', dark: '#2f8a3a', contact: 1, ai: 'chase' },
  bat:      { name: 'Chauve-souris', shape: 'bat', r: 9, hp: 2, spd: 150, color: '#b58cff', dark: '#5f3fb0', contact: 1, ai: 'zigzag', fly: true },
  archer:   { name: 'Archer squelette', shape: 'humanoid', r: 11, hp: 4, spd: 62, color: '#d9d2c0', dark: '#7a7160', contact: 1, ai: 'archer', fireCd: 2.1, bSpd: 270 },
  brute:    { name: 'Brute', shape: 'brute', r: 20, hp: 12, spd: 55, color: '#ff5e5e', dark: '#9c2323', contact: 2, ai: 'charge', dashSpd: 420, windT: 0.5 },
  mage:     { name: 'Mage', shape: 'mage', r: 12, hp: 5, spd: 85, color: '#4ecdc4', dark: '#1d6f6a', contact: 1, ai: 'kite', fireCd: 2.1, bSpd: 210 },
  turret:   { name: 'Canon', shape: 'turret', r: 14, hp: 7, spd: 0, color: '#ff9f43', dark: '#a85a12', contact: 1, ai: 'turret', fireCd: 1.9, bSpd: 185 },
  spider:   { name: 'Araignée', shape: 'spider', r: 12, hp: 4, spd: 120, color: '#8b6b3a', dark: '#4a3418', contact: 1, ai: 'spider', fireCd: 2.8 },
  toad:     { name: 'Crapaud', shape: 'toad', r: 16, hp: 8, spd: 0, color: '#7bb35a', dark: '#3d6a2a', contact: 1, ai: 'hop' },
  shaman:   { name: 'Chaman', shape: 'mage', r: 12, hp: 5, spd: 75, color: '#d1a54a', dark: '#6e5320', contact: 1, ai: 'shaman', fireCd: 3.2 },
  imp:      { name: 'Diablotin', shape: 'bat', r: 10, hp: 3, spd: 160, color: '#ff6b3a', dark: '#8a2a10', contact: 1, ai: 'zigzag', fly: true, shooter: true, fireCd: 2.5, bSpd: 230 },
  golem:    { name: 'Golem de fer', shape: 'brute', r: 22, hp: 18, spd: 46, color: '#a67c52', dark: '#5c3f24', contact: 2, ai: 'charge', dashSpd: 380, windT: 0.6 },
  wolf:     { name: 'Loup des neiges', shape: 'wolf', r: 12, hp: 5, spd: 105, color: '#d5dde9', dark: '#6f7a8c', contact: 1, ai: 'charge', dashSpd: 540, windT: 0.3 },
  icemage:  { name: 'Mage de givre', shape: 'mage', r: 12, hp: 6, spd: 70, color: '#9fd8ff', dark: '#3a6f96', contact: 1, ai: 'kite', fireCd: 2.5, bSpd: 170, spread: 3, slowShot: true },
  ghost:    { name: 'Spectre', shape: 'ghost', r: 12, hp: 5, spd: 66, color: '#d6ccff', dark: '#6b5bb0', contact: 1, ai: 'ghost', fly: true },
  yeti:     { name: 'Yéti', shape: 'brute', r: 22, hp: 16, spd: 50, color: '#eef4ff', dark: '#7f93b0', contact: 2, ai: 'charge', dashSpd: 400, windT: 0.55, ringOnWall: true },
  shade:    { name: 'Ombre', shape: 'humanoid', r: 11, hp: 5, spd: 95, color: '#6a58a8', dark: '#2a2040', contact: 1, ai: 'archer', fireCd: 1.7, bSpd: 300 },
  bomber:   { name: 'Kamikaze', shape: 'bomber', r: 11, hp: 3, spd: 135, color: '#ff3b6b', dark: '#7a1030', contact: 1, ai: 'bomber' },
  voidmage: { name: 'Mage du néant', shape: 'mage', r: 13, hp: 7, spd: 80, color: '#c77dff', dark: '#5b2a8a', contact: 1, ai: 'kite', fireCd: 2.7, bSpd: 150, homing: true },
  // jardin suspendu
  thornling: { name: 'Ronce vive', shape: 'blob', r: 13, hp: 4, spd: 82, color: '#4f9a4a', dark: '#204a22', contact: 1, ai: 'chase' },
  wasp:      { name: 'Guêpe', shape: 'bat', r: 9, hp: 2, spd: 170, color: '#e8c94a', dark: '#5a4a10', contact: 1, ai: 'zigzag', fly: true, shooter: true, fireCd: 2.8, bSpd: 260 },
  treant:    { name: 'Tréant', shape: 'brute', r: 22, hp: 20, spd: 40, color: '#6b4a2a', dark: '#3a2812', contact: 2, ai: 'charge', dashSpd: 320, windT: 0.8 },
  druid:     { name: 'Druide déchu', shape: 'mage', r: 12, hp: 6, spd: 70, color: '#8fbf5a', dark: '#3a5a20', contact: 1, ai: 'shaman', fireCd: 3 },
  // ossuaire
  bonegolem: { name: 'Golem d\'os', shape: 'brute', r: 21, hp: 16, spd: 50, color: '#e8e0cc', dark: '#8a8070', contact: 2, ai: 'charge', dashSpd: 400, windT: 0.5 },
  skullbomb: { name: 'Crâne hurleur', shape: 'bomber', r: 11, hp: 3, spd: 125, color: '#e8e0cc', dark: '#6a6050', contact: 1, ai: 'bomber' },
  bonespider: { name: 'Araignée d\'os', shape: 'spider', r: 12, hp: 5, spd: 130, color: '#d8d0bc', dark: '#6a6050', contact: 1, ai: 'spider', fireCd: 2.6 },
  // cité noyée
  drowned:   { name: 'Noyé', shape: 'mage', r: 12, hp: 6, spd: 75, color: '#4a8fa8', dark: '#1f4a5a', contact: 1, ai: 'kite', fireCd: 2.4, bSpd: 160, spread: 2, slowShot: true },
  // grottes de cristal
  crystalbat: { name: 'Chauve-souris de cristal', shape: 'bat', r: 9, hp: 3, spd: 150, color: '#ff7bd5', dark: '#8a2a6a', contact: 1, ai: 'zigzag', fly: true, shooter: true, fireCd: 3, bSpd: 240 },
  crystalturret: { name: 'Prisme gardien', shape: 'turret', r: 14, hp: 8, spd: 0, color: '#7bffea', dark: '#1f7a6a', contact: 1, ai: 'turret', fireCd: 1.6, bSpd: 220 },
  crystalgolem: { name: 'Golem de cristal', shape: 'brute', r: 22, hp: 22, spd: 45, color: '#c07bff', dark: '#5a2a8a', contact: 2, ai: 'charge', dashSpd: 380, windT: 0.6, ringOnWall: true },
  // forêt des racines
  loup:      { name: 'Loup gris', shape: 'wolf', r: 12, hp: 5, spd: 100, color: '#8a8478', dark: '#4a443a', contact: 1, ai: 'charge', dashSpd: 520, windT: 0.3 },
  corbeau:   { name: 'Corbeau', shape: 'bat', r: 9, hp: 2, spd: 165, color: '#2e2f3a', dark: '#131418', contact: 1, ai: 'zigzag', fly: true },
  sylvain:   { name: 'Archer sylvain', shape: 'humanoid', r: 11, hp: 4, spd: 70, color: '#6fa05a', dark: '#2f4f26', contact: 1, ai: 'archer', fireCd: 1.9, bSpd: 300 },
  sanglier:  { name: 'Sanglier', shape: 'brute', r: 19, hp: 11, spd: 60, color: '#7a5236', dark: '#3e2816', contact: 2, ai: 'charge', dashSpd: 480, windT: 0.4 },
  // grotte fongique
  myconide:  { name: 'Myconide', shape: 'blob', r: 13, hp: 4, spd: 70, color: '#b07ad8', dark: '#5a3a80', contact: 1, ai: 'chase' },
  sporeling: { name: 'Sporule', shape: 'bomber', r: 10, hp: 2, spd: 120, color: '#8fd8c8', dark: '#3a7a6a', contact: 1, ai: 'bomber' },
  phalene:   { name: 'Phalène', shape: 'bat', r: 9, hp: 2, spd: 140, color: '#e8d8b0', dark: '#8a7a58', contact: 1, ai: 'zigzag', fly: true },
  mycomancien: { name: 'Mycomancien', shape: 'mage', r: 12, hp: 6, spd: 72, color: '#c68cff', dark: '#5a2a8a', contact: 1, ai: 'shaman', fireCd: 3 },
  // gorges des cascades
  grenouille: { name: 'Grenouille des gorges', shape: 'toad', r: 15, hp: 7, spd: 0, color: '#4a9ad0', dark: '#1e4a70', contact: 1, ai: 'hop' },
  harpie:    { name: 'Harpie', shape: 'bat', r: 10, hp: 3, spd: 155, color: '#e0a060', dark: '#7a4a20', contact: 1, ai: 'zigzag', fly: true, shooter: true, fireCd: 2.6, bSpd: 250 },
  crabe:     { name: 'Crabe des roches', shape: 'spider', r: 12, hp: 6, spd: 95, color: '#e06a4a', dark: '#7a2a18', contact: 1, ai: 'spider', fireCd: 3 },
  naiade:    { name: 'Naïade', shape: 'mage', r: 12, hp: 5, spd: 85, color: '#6ad0e0', dark: '#1f6a7a', contact: 1, ai: 'kite', fireCd: 2.2, bSpd: 200, spread: 2 },
  hunter:   { name: 'Le Traqueur', shape: 'ghost', r: 15, hp: 28, spd: 125, color: '#ff2244', dark: '#5a0a18', contact: 2, ai: 'ghost', fly: true, hunter: true },
};
const ELITES = [
  { id: 'rapide', name: 'Rapide', color: '#ffe066', f: e => { e.spd *= 1.5; } },
  { id: 'blinde', name: 'Blindé', color: '#b0b8c8', f: e => { e.hp = e.maxHp = Math.round(e.maxHp * 2.4); } },
  { id: 'explosif', name: 'Explosif', color: '#ff7b3a', f: e => { e.explodeOnDeath = true; } },
  { id: 'invocateur', name: 'Invocateur', color: '#c77dff', f: e => { e.summonOnDeath = true; } },
  { id: 'sangsue', name: 'Sangsue', color: '#ff3b6b', f: e => { e.vampire = true; e.hp = e.maxHp = Math.round(e.maxHp * 1.5); } },
];

/* ---------- boss ---------- */
const BOSSES = {
  guardian:  { name: 'Gardien de Vase', color: '#8be05a', dark: '#3d7a1c', r: 30, hp: 60, spd: 82, shape: 'blob', attacks: ['ring', 'dash', 'summon:slime', 'ring', 'dash'] },
  queen:     { name: 'Reine des Marais', color: '#86bf5c', dark: '#2f5a1e', r: 32, hp: 80, spd: 30, shape: 'toad', attacks: ['hop', 'spit', 'hop', 'summon:spider', 'spit'] },
  colossus:  { name: 'Colosse de Forge', color: '#ff7b54', dark: '#8a2f12', r: 36, hp: 105, spd: 48, shape: 'brute', attacks: ['erupt', 'wall', 'dash', 'erupt', 'wall'] },
  frostking: { name: 'Roi de Givre', color: '#cfeeff', dark: '#3a6f96', r: 30, hp: 95, spd: 72, shape: 'mage', attacks: ['spikes', 'ring', 'blink', 'summon:ghost', 'spikes', 'blink'] },
  sylve:     { name: 'Mère des Ronces', color: '#5fa04a', dark: '#2a4a1e', r: 32, hp: 75, spd: 60, shape: 'blob', attacks: ['summon:thornling', 'spit', 'ring', 'summon:wasp', 'spit', 'ring'] },
  lich:      { name: 'La Liche', color: '#e8e0cc', dark: '#5a5040', r: 30, hp: 100, spd: 55, shape: 'mage', attacks: ['summon:archer', 'spikes', 'blink', 'ring', 'summon:skullbomb', 'blink', 'spikes'] },
  leviathan: { name: 'Léviathan des Eaux Mortes', color: '#3a7fa0', dark: '#163a4a', r: 34, hp: 115, spd: 35, shape: 'toad', attacks: ['hop', 'wall', 'spit', 'ring', 'hop', 'wall'] },
  prism:     { name: 'Prisme Éveillé', color: '#ff7bd5', dark: '#7a2a5a', r: 32, hp: 120, spd: 65, shape: 'eye', attacks: ['laser', 'spikes', 'blink', 'spiral', 'ring', 'blink', 'laser'] },
  cerf:      { name: 'Le Grand Cerf', color: '#8a6240', dark: '#3e2816', r: 33, hp: 90, spd: 70, shape: 'brute', attacks: ['dash', 'summon:corbeau', 'ring', 'dash', 'wall', 'dash'] },
  mycelium:  { name: 'Mère Mycélium', color: '#b07ad8', dark: '#4a2a70', r: 32, hp: 95, spd: 50, shape: 'blob', attacks: ['summon:sporeling', 'spit', 'ring', 'summon:myconide', 'spit', 'spiral'] },
  salamandre: { name: 'Salamandre des Cascades', color: '#2f7a8a', dark: '#123a48', r: 32, hp: 105, spd: 40, shape: 'toad', attacks: ['hop', 'spit', 'dash', 'wall', 'hop', 'ring'] },
  eye:       { name: "Œil de l'Abîme", color: '#c77dff', dark: '#4b1f7a', r: 34, hp: 125, spd: 60, shape: 'eye', attacks: ['laser', 'blink', 'spiral', 'summon:bomber', 'laser', 'blink', 'spiral'] },
};
const ROMAN = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/* ---------- armes ---------- */
const WEAPONS = {
  wand:   { name: 'Baguette d\'os', ic: '🪄', rate: 3.2, dmg: 1, bSpd: 440, r: 4, spread: 0.16, desc: 'Tirs rapides et fiables. La valeur sûre.', sfx: 'shoot_wand', cost: 0 },
  bow:    { name: 'Arc d\'if', ic: '🏹', rate: 1.15, dmg: 3.4, bSpd: 640, r: 4, pierce: 2, spread: 0.1, lifeMul: 1.4, desc: 'Flèches lentes à tirer, mais qui transpercent tout sur leur passage.', sfx: 'shoot_bow', cost: 45 },
  blades: { name: 'Lames jumelles', ic: '🗡️', rate: 2.8, dmg: 2.4, melee: true, range: 60, arc: 2.2, desc: 'Corps à corps rapide. Les coups dévient les projectiles ennemis.', sfx: 'shoot_blades', cost: 45 },
  orb:    { name: 'Orbe de braise', ic: '🔮', rate: 1.35, dmg: 1.6, bSpd: 300, r: 7, aoe: 62, spread: 0.2, desc: 'Boules lentes qui explosent à l\'impact et touchent en zone.', sfx: 'shoot_orb', cost: 45 },
  storm:  { name: 'Sceptre d\'orage', ic: '⚡', rate: 1.9, dmg: 1.5, bSpd: 540, r: 4, chain: 2, spread: 0.18, desc: 'Éclairs qui bondissent d\'un ennemi à l\'autre.', sfx: 'shoot_storm', cost: 45 },
};

/* ---------- reliques ---------- */
const RELICS = [
  { id: 'dmg',      ic: '⚔️', n: 'Lame aiguisée',      d: '+30 % de dégâts',                                    f: p => { p.dmgMul += 0.3; } },
  { id: 'rate',     ic: '🔥', n: 'Gâchette rapide',    d: '+25 % de cadence',                                   f: p => { p.rateMul *= 1.25; } },
  { id: 'spd',      ic: '👟', n: 'Bottes légères',     d: '+15 % de vitesse',                                   f: p => { p.spd *= 1.15; } },
  { id: 'hp',       ic: '❤️', n: 'Cœur de pierre',     d: '+1 cœur max et soigne 1 cœur',                       f: p => { p.maxHp += 2; p.hp = Math.min(p.maxHp, p.hp + 2); } },
  { id: 'multi',    ic: '🔱', n: 'Tir divisé',         d: '+1 projectile par tir',                              f: p => { p.multi++; } },
  { id: 'pierce',   ic: '📌', n: 'Pointe perforante',  d: 'Les tirs traversent un ennemi de plus',              f: p => { p.pierce++; } },
  { id: 'bspd',     ic: '💨', n: 'Poudre noire',       d: '+30 % de vitesse et de portée des tirs',             f: p => { p.bSpdMul *= 1.3; } },
  { id: 'dash',     ic: '🌀', n: "Cape d'ombre",       d: 'Le dash se recharge 35 % plus vite',                 f: p => { p.dashCd *= 0.65; } },
  { id: 'vamp',     ic: '🧛', n: 'Croc vampirique',    d: '15 % de chance de soigner ½ cœur par kill',          f: p => { p.lifesteal += 0.15; } },
  { id: 'shield',   ic: '🛡️', n: 'Égide',              d: 'Bloque un coup toutes les 15 s',                     f: p => { p.shield = true; p.shieldT = 0; }, once: true },
  { id: 'boom',     ic: '💥', n: 'Sang volatil',       d: 'Les ennemis explosent à leur mort',                  f: p => { p.explode = true; }, once: true },
  { id: 'bounce',   ic: '🏀', n: 'Balles caoutchouc',  d: 'Les tirs rebondissent une fois sur les murs',        f: p => { p.bounce++; } },
  { id: 'crit',     ic: '🎯', n: 'Œil du faucon',      d: '+20 % de chance de critique (×2)',                   f: p => { p.crit += 0.2; } },
  { id: 'magnet',   ic: '🧲', n: 'Aimant',             d: 'Attire les objets de beaucoup plus loin',            f: p => { p.magnet += 150; } },
  { id: 'thorns',   ic: '🌵', n: "Armure d'épines",    d: 'Les ennemis qui te touchent subissent 3 dégâts',     f: p => { p.thorns += 3; } },
  { id: 'big',      ic: '⚫', n: 'Boulets',            d: 'Projectiles plus gros, +1 dégât',                    f: p => { p.bSize += 3; p.dmgFlat += 1; } },
  { id: 'slow',     ic: '❄️', n: 'Souffle glacé',      d: 'Les tirs ralentissent les ennemis',                  f: p => { p.slow = true; }, once: true },
  { id: 'orbit',    ic: '🪐', n: 'Satellites',         d: 'Deux orbes tournent autour de toi et blessent',      f: p => { p.orbit += 2; } },
  { id: 'pet',      ic: '👻', n: 'Esprit familier',    d: 'Un esprit te suit et tire sur les ennemis',          f: p => { p.pet++; } },
  { id: 'firedash', ic: '🔥', n: 'Traînée ardente',    d: 'Ton dash laisse un sillage de flammes',              f: p => { p.fireDash = true; }, once: true },
  { id: 'ricochet', ic: '↩️', n: 'Ricochet',           d: 'Les tirs rebondissent vers un autre ennemi',         f: p => { p.ricochet++; } },
  { id: 'homing',   ic: '🧿', n: 'Œil guide',          d: 'Les tirs se dirigent vers les ennemis',              f: p => { p.homing += 1; } },
  { id: 'lucky',    ic: '🍀', n: 'Trèfle',             d: 'Les ennemis lâchent beaucoup plus d\'objets',        f: p => { p.luck += 0.5; } },
  { id: 'ironskin', ic: '🪨', n: 'Peau de pierre',     d: '20 % de chance d\'ignorer un coup',                  f: p => { p.dodge += 0.2; } },
  { id: 'phoenix',  ic: '🪶', n: 'Plume de phénix',    d: 'Ressuscite une fois avec 2 cœurs',                   f: p => { p.revive++; } },
  { id: 'venom',    ic: '☠️', n: 'Venin',              d: 'Les tirs empoisonnent (dégâts sur la durée)',        f: p => { p.venom += 1; } },
  { id: 'surge',    ic: '⚡', n: 'Condensateur',       d: 'La Surcharge se charge 50 % plus vite',              f: p => { p.surgeGain *= 1.5; } },
  { id: 'greed',    ic: '◆',  n: 'Bourse sans fond',   d: '+30 % d\'essence ramassée',                          f: p => { p.greed += 0.3; } },
  { id: 'combo',    ic: '🔗', n: 'Chaîne de fer',      d: 'Les combos durent 2 s de plus',                      f: p => { p.comboWindow += 2; } },
  { id: 'heal',     ic: '🧪', n: 'Potion',             d: 'Soigne complètement',                                f: p => { p.hp = p.maxHp; }, consumable: true },
  // reliques de l'Envers (uniquement dans les coffres de l'autre côté)
  { id: 'voile1',   ic: '🪡', n: 'Aiguille de Voile',  d: 'Traverser coûte 40 % de Voile en moins',              f: p => { p.voileCostMul *= 0.6; }, envers: true },
  { id: 'voile2',   ic: '⌛', n: 'Sablier inversé',    d: 'Le Voile se vide deux fois moins vite dans l\'Envers', f: p => { p.voileDrainMul *= 0.5; }, envers: true },
  { id: 'voile3',   ic: '👁️', n: 'Œil de l\'autre côté', d: 'Les Reflets lâchent de l\'essence et le double de Voile', f: p => { p.refletBonus = true; }, envers: true },
  { id: 'voile4',   ic: '🩶', n: 'Pas de brume',       d: 'Dans l\'Envers : +25 % de vitesse, et chaque traversée rend invulnérable 1,5 s', f: p => { p.enversSpeed = true; }, envers: true },
];
const relicById = id => RELICS.find(r => r.id === id);

/* ---------- serments ---------- */
const OATHS = [
  { id: 'sang',  ic: '🩸', n: 'Serment de sang',     d: 'Tu perds 1 cœur max pour cet étage.', reward: '+60 % d\'essence ramassée', apply: p => { p.maxHp = Math.max(2, p.maxHp - 2); p.hp = Math.min(p.hp, p.maxHp); }, undo: p => { p.maxHp += 2; p.hp = Math.min(p.maxHp, p.hp + 2); }, essMul: 1.6 },
  { id: 'ombre', ic: '🌑', n: "Serment de l'ombre",  d: 'Plus de dash sur cet étage.', reward: '+40 % de dégâts', apply: p => { p.noDash = true; p.dmgMul += 0.4; }, undo: p => { p.noDash = false; p.dmgMul -= 0.4; } },
  { id: 'fer',   ic: '⛓️', n: 'Serment du fer',      d: 'Les ennemis ont 40 % de PV en plus.', reward: 'Une relique bonus après le boss', enemyHp: 1.4, bonusRelic: true },
  { id: 'hate',  ic: '⏳', n: 'Serment de hâte',     d: 'La Menace monte deux fois plus vite.', reward: 'Une relique bonus après le boss', menace: 2, bonusRelic: true },
  { id: 'brume', ic: '🌫️', n: 'Serment de brume',    d: 'Les ténèbres se resserrent autour de toi.', reward: '+50 % d\'essence ramassée', dark: 0.3, essMul: 1.5 },
  { id: 'faim',  ic: '🍖', n: 'Serment de faim',     d: 'Aucun cœur ne tombe des ennemis.', reward: 'Les ennemis lâchent deux fois plus d\'essence', noHearts: true, coinMul: 2 },
  { id: 'miroir', ic: '🪞', n: 'Serment du miroir', d: 'Tu commences l\'étage dans l\'Envers, Voile plein. Le drain y est réduit de moitié.', reward: 'Une relique bonus après le boss', bonusRelic: true, mirror: true },
];

/* ---------- méta ---------- */
const META = [
  { id: 'vit',   ic: '❤️', n: 'Vitalité',   d: '+1 cœur de départ par niveau',                 max: 3, cost: l => 25 + 25 * l },
  { id: 'force', ic: '⚔️', n: 'Force',      d: '+10 % de dégâts par niveau',                    max: 5, cost: l => 20 + 18 * l },
  { id: 'agi',   ic: '👟', n: 'Agilité',    d: '+6 % de vitesse par niveau',                    max: 3, cost: l => 20 + 18 * l },
  { id: 'or',    ic: '◆',  n: 'Cupidité',   d: '+25 % d\'essence ramassée par niveau',          max: 3, cost: l => 20 + 25 * l },
  { id: 'spark', ic: '⚡', n: 'Étincelle',  d: 'Commence chaque étage avec 40 % de Surcharge',  max: 1, cost: () => 50 },
  { id: 'relic', ic: '🎁', n: 'Héritage',   d: 'Commence chaque partie avec une relique',       max: 1, cost: () => 70 },
  { id: 'calm',  ic: '🕯️', n: 'Patience',   d: 'La Menace monte 25 % moins vite par niveau',    max: 2, cost: l => 30 + 30 * l },
  { id: 'veil',  ic: '🌫️', n: 'Voile ample', d: 'Le Voile se vide 15 % moins vite dans l\'Envers, par niveau', max: 2, cost: l => 35 + 30 * l },
];

/* ---------- gabarits de salles ---------- */
const TEMPLATES = ['open', 'pillars', 'cross', 'ring', 'random', 'corridors', 'islands', 'maze', 'arena'];
