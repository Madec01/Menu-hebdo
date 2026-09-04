// audio/harmony.js — harmonie des partitions : tonalité, mode et accords par mesure (§ 9.3, champ
// `chords`). Utilisé par music.js (currentChord) et timbres.js (les Timbres chantent sur l'accord).
// Un accord = { name, root (midi, octave 4 : 60..71), quality ('maj'|'min'|'dim'|'sus2'|'sus4'),
// third, fifth (midi), tones [root, third, fifth], scale [7 midi ascendants depuis root] }.
// `scale` est la gamme du mode de la pièce tournée pour commencer sur la fondamentale de l'accord,
// dans laquelle les notes de l'accord sont forcées (ex. « E » majeur en la éolien → sol# remplace sol).

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E' };

// Intervalles (demi-tons) des modes, noms français et anglais acceptés.
const MODES = {
  ionien: [0, 2, 4, 5, 7, 9, 11], majeur: [0, 2, 4, 5, 7, 9, 11], major: [0, 2, 4, 5, 7, 9, 11], ionian: [0, 2, 4, 5, 7, 9, 11],
  dorien: [0, 2, 3, 5, 7, 9, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygien: [0, 1, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydien: [0, 2, 4, 6, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydien: [0, 2, 4, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10],
  éolien: [0, 2, 3, 5, 7, 8, 10], eolien: [0, 2, 3, 5, 7, 8, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], mineur: [0, 2, 3, 5, 7, 8, 10], minor: [0, 2, 3, 5, 7, 8, 10],
  locrien: [0, 1, 3, 5, 6, 8, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
};
const QUALITIES = { '': 'maj', maj: 'maj', M: 'maj', m: 'min', min: 'min', dim: 'dim', '°': 'dim', sus2: 'sus2', sus4: 'sus4' };
const TRIADS = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], sus2: [0, 2, 7], sus4: [0, 5, 7] };

/** 'Bb' / 'A#' / 'D' → classe de hauteur 0..11. */
export function pitchClass(name) {
  const n = FLATS[name] || name;
  const i = NOTES.indexOf(n);
  if (i < 0) throw new Error(`harmony: note inconnue « ${name} »`);
  return i;
}

/** Intervalles du mode (défaut : dorien, le mode de Cendrelune). */
export function modeIntervals(mode) {
  return MODES[String(mode || 'dorien').toLowerCase()] || MODES.dorien;
}

/** Classes de hauteur (0..11) de la gamme `key` + `mode`, à partir de la tonique. */
export function keyScale(key, mode) {
  const root = pitchClass(key || 'D');
  return modeIntervals(mode).map((i) => (root + i) % 12);
}

/**
 * Analyse un nom d'accord ('Dm', 'Bb', 'Gsus4', 'F#dim', 'A7' → la 7e est ignorée) dans la tonalité
 * donnée. Forme objet acceptée aussi : { root:'D', quality:'min' }.
 */
export function parseChord(chord, key = 'D', mode = 'dorien') {
  let rootName, qual;
  if (chord && typeof chord === 'object') { rootName = chord.root; qual = chord.quality || ''; }
  else {
    const m = /^([A-G][#b]?)(maj|min|dim|sus2|sus4|m|M|°)?7?$/.exec(String(chord).trim());
    if (!m) throw new Error(`harmony: accord invalide « ${chord} »`);
    rootName = m[1]; qual = m[2] || '';
  }
  const quality = QUALITIES[qual] || (qual === 'min' ? 'min' : 'maj');
  const rootPc = pitchClass(rootName);
  const tri = TRIADS[quality];
  const tones = tri.map((i) => 60 + rootPc + i);         // octave 4 (60..71 pour la fondamentale)
  // gamme du mode tournée sur la fondamentale de l'accord
  const kscale = keyScale(key, mode);
  let degrees = kscale.map((pc) => (pc - rootPc + 12) % 12).sort((a, b) => a - b);
  if (!degrees.includes(0)) { degrees = degrees.filter((d) => d !== 1 && d !== 11); degrees.push(0); degrees.sort((a, b) => a - b); }
  // les notes de l'accord remplacent le degré le plus proche s'il n'est pas dans la gamme
  for (const iv of tri) {
    if (degrees.includes(iv)) continue;
    let best = 0;
    for (let i = 1; i < degrees.length; i++) if (Math.abs(degrees[i] - iv) < Math.abs(degrees[best] - iv)) best = i;
    degrees[best] = iv;
  }
  degrees = Array.from(new Set(degrees)).sort((a, b) => a - b);
  while (degrees.length < 7) degrees.push(degrees[degrees.length - 1]);   // sûreté (gammes exotiques)
  const scale = degrees.slice(0, 7).map((d) => 60 + rootPc + d);
  return { name: typeof chord === 'string' ? chord : rootName + (quality === 'maj' ? '' : quality), root: 60 + rootPc, quality, third: tones[1], fifth: tones[2], tones, scale };
}

/** Accords d'une partition, un par mesure (tableau `chords`, ou tonique tenue si absent). */
export function chordsOf(score) {
  const key = score.key || 'D', mode = score.mode || 'dorien';
  const list = Array.isArray(score.chords) && score.chords.length ? score.chords : [key + (modeIntervals(mode)[2] === 3 ? 'm' : '')];
  const out = [];
  for (let b = 0; b < score.bars; b++) out.push(parseChord(list[b % list.length], key, mode));
  return out;
}

/**
 * Degré de gamme (1 = fondamentale, 3 = tierce, 5 = quinte, 8 = octave, 0/négatifs = en dessous)
 * → midi, transposé dans le registre `octave` (fondamentale placée dans [12·(octave+1), +12[).
 */
export function degreeToMidi(chord, degree, octave = 4) {
  const d = degree - 1;
  const oct = Math.floor(d / 7);
  const idx = ((d % 7) + 7) % 7;
  return chord.scale[idx] + 12 * oct + 12 * (octave - 4);
}

/** Nom scientifique ('F#5') d'une note midi, pour le sampler. */
export function midiToName(midi) {
  const m = Math.round(midi);
  return NOTES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}

/** Accord par défaut quand aucune piste ne joue : ré mineur dorien (Cendrelune). */
export const DEFAULT_CHORD = parseChord('Dm', 'D', 'dorien');
