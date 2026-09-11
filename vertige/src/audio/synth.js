// Briques de synthèse pour l'audio de VERTIGE (docs/CONTRATS.md §6).
// Tout est fabriqué en mémoire par Web Audio : pas de fichier, pas de bibliothèque.
// Esthétique visée : jouet en bois, billes de verre, papier — jamais 8-bit/chiptune.
// Règle : uniquement des ondes 'sine'/'triangle' (jamais 'square'/'sawtooth', trop
// synthétiques) et du bruit blanc filtré pour toutes les matières « bois » et « verre ».
// Chaque « recette » exportée (construireXxx) reçoit (ctx, params) et renvoie
// { sortie, noeuds, duree } : un GainNode de sortie (non connecté au haut-parleur),
// la liste de tous les noeuds créés (pour déconnexion propre) et la durée de vie
// du son en secondes. C'est audio.js qui connecte `sortie` au bus maître et gère
// la polyphonie / le nettoyage.

// --- Petites aides numériques -----------------------------------------------

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

// ±4 % de variation de hauteur par défaut, tirée à chaque appel : évite l'effet
// « machine » d'un son toujours identique.
function variationHauteur(pourcentage = 0.04) {
  return 1 + (Math.random() * 2 - 1) * pourcentage;
}

// La profondeur (rangée dans la pile) monte la hauteur d'un demi-ton par rang.
function demiTonVersRatio(demiTons = 0) { return Math.pow(2, demiTons / 12); }

// Petite variation reproductible selon le nom du type (pour varier les sons
// « spéciale » sans tableau de correspondance à entretenir).
function hashTypeVariation(texte) {
  let h = 0;
  const s = String(texte || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return (h % 100) / 100;
}

// --- Bruit blanc et réponse impulsionnelle de réverbération -----------------

// Buffer de bruit blanc mono de la durée donnée (secondes).
function creerBruitBlanc(ctx, duree) {
  const taille = Math.max(1, Math.round(ctx.sampleRate * duree));
  const buffer = ctx.createBuffer(1, taille, ctx.sampleRate);
  const donnees = buffer.getChannelData(0);
  for (let i = 0; i < taille; i++) donnees[i] = Math.random() * 2 - 1;
  return buffer;
}

// Réponse impulsionnelle générée pour la convolution : bruit blanc dont
// l'amplitude décroît exponentiellement (~1.2 s), pour une petite pièce chaleureuse
// en bois/papier — sans aucun fichier audio externe.
export function creerReponseImpulsionnelle(ctx, duree = 1.2, decroissance = 3.2) {
  const taille = Math.max(1, Math.round(ctx.sampleRate * duree));
  const impulsion = ctx.createBuffer(2, taille, ctx.sampleRate);
  for (let canal = 0; canal < 2; canal++) {
    const donnees = impulsion.getChannelData(canal);
    for (let i = 0; i < taille; i++) {
      const t = i / taille;
      donnees[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decroissance);
    }
  }
  return impulsion;
}

// --- Enveloppe et oscillateurs désaccordés -----------------------------------

// Enveloppe douce (attaque/decay/sustain/release) sur un AudioParam de gain, en
// rampes exponentielles (avec plancher) pour ne jamais produire de clic.
function appliquerEnveloppe(param, tDebut, { pic = 1, attaque = 0.01, decay = 0.08, sustain = 0.5, duree = 0.2, release = 0.15 } = {}) {
  const plancher = 0.0001;
  const sommet = Math.max(plancher, pic);
  param.cancelScheduledValues(tDebut);
  param.setValueAtTime(plancher, tDebut);
  param.exponentialRampToValueAtTime(sommet, tDebut + Math.max(0.001, attaque));
  const niveauSustain = Math.max(plancher, sommet * sustain);
  const tSustain = tDebut + Math.max(0.001, attaque) + decay;
  param.exponentialRampToValueAtTime(niveauSustain, tSustain);
  const tFin = Math.max(tSustain, tDebut + duree);
  param.setValueAtTime(niveauSustain, tFin);
  param.exponentialRampToValueAtTime(plancher, tFin + Math.max(0.02, release));
}

// Deux oscillateurs légèrement désaccordés sur la même fréquence, sommés : timbre
// plus riche et « vivant » qu'un oscillateur unique (jamais de son trop pur/synthé).
function creerOscillateursDesaccordes(ctx, frequence, type = 'sine', detuneCents = 6) {
  const sortie = ctx.createGain();
  sortie.gain.value = 0.6;
  const osc1 = ctx.createOscillator();
  osc1.type = type; osc1.frequency.value = frequence; osc1.detune.value = -detuneCents;
  const osc2 = ctx.createOscillator();
  osc2.type = type; osc2.frequency.value = frequence; osc2.detune.value = detuneCents;
  osc1.connect(sortie); osc2.connect(sortie);
  return { sortie, oscillateurs: [osc1, osc2] };
}

// --- Gestion d'une « construction » (un son en cours d'assemblage) ----------

function nouvelleConstruction(ctx) {
  return { sortie: ctx.createGain(), noeuds: [], finMax: 0.05 };
}
function ajouterFin(c, temps) { if (temps > c.finMax) c.finMax = temps; }
function finaliser(c) {
  c.noeuds.push(c.sortie);
  return { sortie: c.sortie, noeuds: c.noeuds, duree: c.finMax };
}

// --- Matières réutilisées : verre, bois, bruit filtré, glissando ------------

// Tintement de verre : deux partiels harmoniques légèrement désaccordés (bille de
// verre), attaque quasi instantanée, décroissance rapide et claire.
function tintementVerre(ctx, c, { tDebut, frequence, duree = 0.3, niveau = 0.6 }) {
  const { sortie, oscillateurs } = creerOscillateursDesaccordes(ctx, frequence, 'sine', 5);
  const gain = ctx.createGain();
  sortie.connect(gain); gain.connect(c.sortie);
  appliquerEnveloppe(gain.gain, tDebut, { pic: niveau, attaque: 0.002, decay: duree * 0.3, sustain: 0.25, duree: duree * 0.35, release: duree * 0.65 });

  // Partiel inharmonique en plus, typique du verre (brillance courte).
  const partiel = ctx.createOscillator();
  partiel.type = 'sine'; partiel.frequency.value = frequence * 2.76;
  const gainPartiel = ctx.createGain();
  partiel.connect(gainPartiel); gainPartiel.connect(c.sortie);
  appliquerEnveloppe(gainPartiel.gain, tDebut, { pic: niveau * 0.35, attaque: 0.002, decay: 0.05, sustain: 0, duree: 0.05, release: duree * 0.35 });

  oscillateurs.forEach((o) => { o.start(tDebut); o.stop(tDebut + duree + 0.1); });
  partiel.start(tDebut); partiel.stop(tDebut + duree * 0.5 + 0.1);
  c.noeuds.push(sortie, gain, partiel, gainPartiel, ...oscillateurs);
  ajouterFin(c, tDebut + duree + 0.15);
}

// Toc de bois : bruit bref filtré (grain) + un corps grave sinusoïdal (rondeur mate).
function tocBois(ctx, c, { tDebut, frequence = 150, duree = 0.08, niveau = 0.5 }) {
  const source = ctx.createBufferSource();
  source.buffer = creerBruitBlanc(ctx, duree + 0.05);
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'bandpass'; filtre.frequency.value = frequence * 3; filtre.Q.value = 1.1;
  const gainBruit = ctx.createGain();
  source.connect(filtre); filtre.connect(gainBruit); gainBruit.connect(c.sortie);
  appliquerEnveloppe(gainBruit.gain, tDebut, { pic: niveau * 0.6, attaque: 0.001, decay: duree * 0.4, sustain: 0, duree: duree * 0.3, release: duree * 0.5 });

  const corps = ctx.createOscillator();
  corps.type = 'sine'; corps.frequency.value = frequence;
  const gainCorps = ctx.createGain();
  corps.connect(gainCorps); gainCorps.connect(c.sortie);
  appliquerEnveloppe(gainCorps.gain, tDebut, { pic: niveau, attaque: 0.001, decay: duree * 0.5, sustain: 0.1, duree: duree * 0.4, release: duree * 0.6 });

  source.start(tDebut); source.stop(tDebut + duree + 0.1);
  corps.start(tDebut); corps.stop(tDebut + duree + 0.15);
  c.noeuds.push(source, filtre, gainBruit, corps, gainCorps);
  ajouterFin(c, tDebut + duree + 0.2);
}

// Bruit filtré avec balayage de fréquence + enveloppe : whoosh, souffle, grondement,
// craquement, frottement — tout ce qui est « texture » plutôt que « note ».
function bruitFiltreEnveloppe(ctx, c, { tDebut, type = 'bandpass', freqDebut, freqFin, duree, niveau = 0.4, Q = 1, attaque = 0.005, release }) {
  const rel = release != null ? release : duree * 0.6;
  const source = ctx.createBufferSource();
  source.buffer = creerBruitBlanc(ctx, duree + rel + 0.05);
  const filtre = ctx.createBiquadFilter();
  filtre.type = type; filtre.Q.value = Q;
  filtre.frequency.setValueAtTime(Math.max(20, freqDebut), tDebut);
  filtre.frequency.exponentialRampToValueAtTime(Math.max(20, freqFin), tDebut + duree);
  const gain = ctx.createGain();
  source.connect(filtre); filtre.connect(gain); gain.connect(c.sortie);
  appliquerEnveloppe(gain.gain, tDebut, { pic: niveau, attaque, decay: duree * 0.3, sustain: 0.35, duree: duree * 0.6, release: rel });
  source.start(tDebut); source.stop(tDebut + duree + rel + 0.1);
  c.noeuds.push(source, filtre, gain);
  ajouterFin(c, tDebut + duree + rel + 0.15);
}

// Oscillateurs désaccordés dont la fréquence glisse de freqDebut à freqFin : sert
// aux sub-impacts graves, aux glissandos doux et aux petits « allumages ».
function oscillateurGlissant(ctx, c, { tDebut, freqDebut, freqFin, duree, niveau = 0.5, type = 'sine' }) {
  const { sortie, oscillateurs } = creerOscillateursDesaccordes(ctx, freqDebut, type, 6);
  oscillateurs.forEach((o) => {
    o.frequency.setValueAtTime(Math.max(20, freqDebut), tDebut);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freqFin), tDebut + duree);
    o.start(tDebut); o.stop(tDebut + duree + 0.1);
  });
  const gain = ctx.createGain();
  sortie.connect(gain); gain.connect(c.sortie);
  appliquerEnveloppe(gain.gain, tDebut, { pic: niveau, attaque: Math.min(0.02, duree * 0.15), decay: duree * 0.3, sustain: 0.4, duree: duree * 0.5, release: duree * 0.5 });
  c.noeuds.push(sortie, gain, ...oscillateurs);
  ajouterFin(c, tDebut + duree + 0.15);
}

// Note « marimba » : attaque en toc de bois + fondamentale désaccordée + un partiel
// court à l'octave/quarte — corps boisé, jamais un simple bip.
function noteMarimba(ctx, c, { tDebut, frequence, duree, niveau = 0.6 }) {
  tocBois(ctx, c, { tDebut, frequence: frequence * 0.5, duree: 0.035, niveau: niveau * 0.35 });
  const { sortie, oscillateurs } = creerOscillateursDesaccordes(ctx, frequence, 'sine', 4);
  const gain = ctx.createGain();
  sortie.connect(gain); gain.connect(c.sortie);
  appliquerEnveloppe(gain.gain, tDebut, { pic: niveau, attaque: 0.004, decay: duree * 0.3, sustain: 0.3, duree: duree * 0.35, release: duree * 0.65 });
  const partiel = ctx.createOscillator();
  partiel.type = 'sine'; partiel.frequency.value = frequence * 4;
  const gainPartiel = ctx.createGain();
  partiel.connect(gainPartiel); gainPartiel.connect(c.sortie);
  appliquerEnveloppe(gainPartiel.gain, tDebut, { pic: niveau * 0.25, attaque: 0.002, decay: 0.03, sustain: 0, duree: 0.03, release: 0.08 });
  oscillateurs.forEach((o) => { o.start(tDebut); o.stop(tDebut + duree + 0.1); });
  partiel.start(tDebut); partiel.stop(tDebut + 0.15);
  c.noeuds.push(sortie, gain, partiel, gainPartiel, ...oscillateurs);
  ajouterFin(c, tDebut + duree + 0.15);
}

// --- Petits éléments de jeu (bulle, ballon, fusée, tic, glissando) ----------

function plopAqueux(ctx, c, tDebut) {
  oscillateurGlissant(ctx, c, { tDebut, freqDebut: 500 * variationHauteur(), freqFin: 180, duree: 0.18, niveau: 0.5 });
  bruitFiltreEnveloppe(ctx, c, { tDebut, type: 'bandpass', freqDebut: 900, freqFin: 400, duree: 0.12, niveau: 0.2, Q: 1.5, attaque: 0.002, release: 0.1 });
}
function popSec(ctx, c, tDebut) {
  bruitFiltreEnveloppe(ctx, c, { tDebut, type: 'bandpass', freqDebut: 1400, freqFin: 2200, duree: 0.05, niveau: 0.55, Q: 0.9, attaque: 0.001, release: 0.05 });
  oscillateurGlissant(ctx, c, { tDebut, freqDebut: 900 * variationHauteur(), freqFin: 300, duree: 0.06, niveau: 0.35, type: 'triangle' });
}
function allumage(ctx, c, tDebut) {
  bruitFiltreEnveloppe(ctx, c, { tDebut, type: 'bandpass', freqDebut: 300, freqFin: 1800, duree: 0.3, niveau: 0.32, Q: 1, attaque: 0.03, release: 0.1 });
  oscillateurGlissant(ctx, c, { tDebut: tDebut + 0.02, freqDebut: 200, freqFin: 700, duree: 0.28, niveau: 0.28 });
}
function tic(ctx, c, tDebut) {
  tocBois(ctx, c, { tDebut, frequence: 700 * variationHauteur(), duree: 0.025, niveau: 0.28 });
}
function glissandoDoux(ctx, c, tDebut) {
  oscillateurGlissant(ctx, c, { tDebut, freqDebut: 400 * variationHauteur(), freqFin: 700, duree: 0.2, niveau: 0.32 });
}

// --- Recettes exportées : une par famille de son de §6 ----------------------

// 'tap' : bille de verre qui toque sur le bois ; hauteur liée à la taille du groupe.
export function construireTap(ctx, { taille = 2 } = {}) {
  const c = nouvelleConstruction(ctx);
  const t = clamp((taille - 2) / 6, 0, 1);
  const variation = variationHauteur();
  const freqVerre = (320 + t * 780) * variation;
  const freqBois = (110 + t * 90) * variation;
  const tDebut = ctx.currentTime;
  tocBois(ctx, c, { tDebut, frequence: freqBois, duree: 0.09, niveau: 0.55 });
  tintementVerre(ctx, c, { tDebut: tDebut + 0.004, frequence: freqVerre, duree: 0.18 + t * 0.12, niveau: 0.6 + t * 0.2 });
  return finaliser(c);
}

// 'detruit' : selon la cause, tintements en rafale, impact grave, whoosh, accord
// scintillant, grondement ou craquement sec. La profondeur monte la hauteur et la
// brillance.
export function construireDetruit(ctx, { taille = 1, cause = 'pierre', profondeur = 0 } = {}) {
  const c = nouvelleConstruction(ctx);
  const ratioProfondeur = demiTonVersRatio(profondeur);
  const brillance = 1 + Math.min(profondeur, 8) * 0.12;
  const tDebut = ctx.currentTime;
  switch (cause) {
    case 'groupe': {
      const n = Math.min(6, Math.max(1, Math.round(taille)));
      for (let i = 0; i < n; i++) {
        const freq = (500 + Math.random() * 500) * ratioProfondeur * variationHauteur();
        tintementVerre(ctx, c, { tDebut: tDebut + i * 0.015, frequence: freq, duree: 0.22, niveau: 0.5 });
      }
      break;
    }
    case 'bombe': {
      oscillateurGlissant(ctx, c, { tDebut, freqDebut: 50 * ratioProfondeur, freqFin: 30 * ratioProfondeur, duree: 0.4, niveau: 0.65, type: 'sine' });
      bruitFiltreEnveloppe(ctx, c, { tDebut, type: 'lowpass', freqDebut: 1200 * brillance, freqFin: 200, duree: 0.35, niveau: 0.42, Q: 0.7, attaque: 0.001 });
      break;
    }
    case 'ligne':
    case 'croix': {
      bruitFiltreEnveloppe(ctx, c, { tDebut, type: 'bandpass', freqDebut: 300 * ratioProfondeur, freqFin: 2200 * brillance, duree: 0.35, niveau: 0.42, Q: 1.2, attaque: 0.01 });
      break;
    }
    case 'couleur': {
      const base = 480 * ratioProfondeur;
      [1, 1.5, 2, 2.5 * brillance].forEach((mult, i) => {
        tintementVerre(ctx, c, { tDebut: tDebut + i * 0.01, frequence: base * mult * variationHauteur(), duree: 0.5, niveau: 0.38 });
      });
      // Shimmer léger (bruit haut filtré) : évoque un frémissement de papier fin.
      bruitFiltreEnveloppe(ctx, c, { tDebut: tDebut + 0.02, type: 'highpass', freqDebut: 4000, freqFin: 6000, duree: 0.4, niveau: 0.12, Q: 0.6, attaque: 0.05, release: 0.3 });
      break;
    }
    case 'fusee': {
      bruitFiltreEnveloppe(ctx, c, { tDebut, type: 'bandpass', freqDebut: 2200 * brillance, freqFin: 200, duree: 0.9, niveau: 0.4, Q: 1, attaque: 0.02, release: 0.3 });
      break;
    }
    case 'maree': {
      bruitFiltreEnveloppe(ctx, c, { tDebut, type: 'lowpass', freqDebut: 220 * ratioProfondeur, freqFin: 140, duree: 0.9, niveau: 0.45, Q: 0.5, attaque: 0.15, release: 0.4 });
      oscillateurGlissant(ctx, c, { tDebut, freqDebut: 65 * ratioProfondeur, freqFin: 45 * ratioProfondeur, duree: 0.8, niveau: 0.35, type: 'sine' });
      break;
    }
    default: { // 'pierre' / 'effet' : craquement sec
      bruitFiltreEnveloppe(ctx, c, { tDebut, type: 'bandpass', freqDebut: 1800 * brillance * ratioProfondeur, freqFin: 900, duree: 0.09, niveau: 0.45, Q: 1.4, attaque: 0.001, release: 0.06 });
    }
  }
  return finaliser(c);
}

// 'speciale' : tintement cristallin court (la réverb globale fait le reste).
export function construireSpeciale(ctx, { type = 'defaut' } = {}) {
  const c = nouvelleConstruction(ctx);
  const freqBase = (700 + hashTypeVariation(type) * 260) * variationHauteur();
  tintementVerre(ctx, c, { tDebut: ctx.currentTime, frequence: freqBase, duree: 0.4, niveau: 0.75 });
  return finaliser(c);
}

// 'rotation' : frottement doux (bruit passe-bande balayé) puis clac de butée en bois.
export function construireRotation(ctx, { sens = 1 } = {}) {
  const c = nouvelleConstruction(ctx);
  const dureeFrottement = sens === 2 ? 0.55 : 0.3;
  const tDebut = ctx.currentTime;
  bruitFiltreEnveloppe(ctx, c, { tDebut, type: 'bandpass', freqDebut: 500, freqFin: 900, duree: dureeFrottement, niveau: 0.22, Q: 2.2, attaque: 0.05, release: 0.08 });
  tocBois(ctx, c, { tDebut: tDebut + dureeFrottement, frequence: 180 * variationHauteur(), duree: 0.07, niveau: 0.5 });
  return finaliser(c);
}

// 'chute' : souffle très discret.
export function construireChute(ctx) {
  const c = nouvelleConstruction(ctx);
  bruitFiltreEnveloppe(ctx, c, { tDebut: ctx.currentTime, type: 'lowpass', freqDebut: 1200, freqFin: 500, duree: 0.25, niveau: 0.1, Q: 0.6, attaque: 0.03, release: 0.12 });
  return finaliser(c);
}

// 'rebond' : toc de verre sur bois pour n billes arrivant ensemble, volume plafonné.
export function construireRebond(ctx, { n = 1 } = {}) {
  const c = nouvelleConstruction(ctx);
  const nombre = clamp(Math.round(n), 1, 8);
  const niveau = Math.min(0.7, 0.35 + nombre * 0.05); // plafond de volume
  const tDebut = ctx.currentTime;
  for (let i = 0; i < nombre; i++) {
    const decalage = i * (0.008 + Math.random() * 0.01); // léger étalement
    tocBois(ctx, c, { tDebut: tDebut + decalage, frequence: 140 * variationHauteur(), duree: 0.06, niveau: 0.2 + niveau * 0.3 });
    tintementVerre(ctx, c, { tDebut: tDebut + decalage + 0.003, frequence: (500 + Math.random() * 200) * variationHauteur(), duree: 0.15, niveau: niveau / Math.sqrt(nombre) });
  }
  return finaliser(c);
}

// 'element' : bulle/ballon/fusée/tic/glissando selon {type, action}.
export function construireElement(ctx, { type = '', action = '' } = {}) {
  const c = nouvelleConstruction(ctx);
  const tDebut = ctx.currentTime;
  if (type === 'bulle' && action === 'libere') plopAqueux(ctx, c, tDebut);
  else if (type === 'ballon' && action === 'eclate') popSec(ctx, c, tDebut);
  else if (type === 'fusee' && action === 'fusee') allumage(ctx, c, tDebut);
  else if (action === 'activation') tic(ctx, c, tDebut);
  else if (action === 'monte') glissandoDoux(ctx, c, tDebut);
  else tic(ctx, c, tDebut); // repli neutre
  return finaliser(c);
}

// 'niveau' : trois notes arpégées (accord majeur), timbre de marimba.
export function construireNiveau(ctx) {
  const c = nouvelleConstruction(ctx);
  const tDebut = ctx.currentTime;
  const fondamentale = 440 * variationHauteur();
  [1, 1.25, 1.5].forEach((ratio, i) => {
    noteMarimba(ctx, c, { tDebut: tDebut + i * 0.11, frequence: fondamentale * ratio, duree: 0.35, niveau: 0.55 });
  });
  return finaliser(c);
}

// 'competence' : accord plus grave et solennel (joué simultanément).
export function construireCompetence(ctx) {
  const c = nouvelleConstruction(ctx);
  const tDebut = ctx.currentTime;
  const fondamentale = 220 * variationHauteur();
  [1, 1.2, 1.5].forEach((ratio) => {
    noteMarimba(ctx, c, { tDebut, frequence: fondamentale * ratio, duree: 0.7, niveau: 0.5 });
  });
  return finaliser(c);
}

// 'victoire' : fanfare courte à couches (arpège + tintement de verre final).
export function construireVictoire(ctx) {
  const c = nouvelleConstruction(ctx);
  const tDebut = ctx.currentTime;
  const fondamentale = 523 * variationHauteur();
  [1, 1.25, 1.5, 2].forEach((ratio, i) => {
    noteMarimba(ctx, c, { tDebut: tDebut + i * 0.07, frequence: fondamentale * ratio, duree: 0.4, niveau: 0.55 });
  });
  tintementVerre(ctx, c, { tDebut: tDebut + 0.28, frequence: fondamentale * 3, duree: 0.6, niveau: 0.45 });
  return finaliser(c);
}

// 'echec' : descente sombre (deux glissandos descendants légèrement désaccordés).
export function construireEchec(ctx) {
  const c = nouvelleConstruction(ctx);
  const tDebut = ctx.currentTime;
  const fondamentale = 300 * variationHauteur();
  oscillateurGlissant(ctx, c, { tDebut, freqDebut: fondamentale, freqFin: fondamentale * 0.5, duree: 0.6, niveau: 0.42, type: 'triangle' });
  oscillateurGlissant(ctx, c, { tDebut: tDebut + 0.05, freqDebut: fondamentale * 0.75, freqFin: fondamentale * 0.4, duree: 0.55, niveau: 0.32 });
  return finaliser(c);
}

// 'ui' : clic de bois doux.
export function construireUi(ctx) {
  const c = nouvelleConstruction(ctx);
  tocBois(ctx, c, { tDebut: ctx.currentTime, frequence: 260 * variationHauteur(), duree: 0.05, niveau: 0.3 });
  return finaliser(c);
}

// 'erreur' : buzz feutré court (oscillateurs graves désaccordés + bruit grave, très filtrés).
export function construireErreur(ctx) {
  const c = nouvelleConstruction(ctx);
  const tDebut = ctx.currentTime;
  oscillateurGlissant(ctx, c, { tDebut, freqDebut: 150, freqFin: 130, duree: 0.13, niveau: 0.28, type: 'triangle' });
  bruitFiltreEnveloppe(ctx, c, { tDebut, type: 'lowpass', freqDebut: 500, freqFin: 300, duree: 0.15, niveau: 0.3, Q: 0.8, attaque: 0.002, release: 0.08 });
  return finaliser(c);
}
