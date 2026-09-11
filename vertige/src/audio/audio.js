// Moteur audio de VERTIGE (docs/CONTRATS.md §6) — Web Audio, synthèse en couches.
// Ambiance « jouet en bois et billes de verre sur papier » : aucun son 8-bit/chiptune.
// Tout est généré (oscillateurs désaccordés, bruit blanc filtré, réverb à convolution
// avec réponse impulsionnelle synthétisée) : aucun fichier, aucune bibliothèque, aucun réseau.
//
// Graphe audio :
//   voix -> busSec ------------------------\
//   voix -> busReverbSend -> convolver -----+--> compresseur -> gainVolume -> gainMuet -> destination
//
// Chaque son est une « voix » temporaire (voir synth.js) : ses noeuds sont déconnectés
// dès la fin de son enveloppe, et la polyphonie est plafonnée à 24 voix simultanées
// (la plus ancienne est coupée proprement — fondu de 20 ms — quand la limite est atteinte).

import * as synth from './synth.js';

const POLYPHONIE_MAX = 24;

let contexte = null;        // AudioContext, créé au premier appel de init()
let busSec = null;          // GainNode : chemin direct (sans réverb)
let busReverbSend = null;   // GainNode : départ vers la réverb (~20 % du mix)
let convolver = null;       // ConvolverNode : réponse impulsionnelle générée
let compresseur = null;     // DynamicsCompressorNode sur le bus master
let gainVolume = null;      // GainNode : volume utilisateur (0..1)
let gainMuet = null;        // GainNode : 0 si muet, 1 sinon

let volumeCourant = 0.8;
let estMuetCourant = false;
let voixActives = [];       // voix en cours, de la plus ancienne à la plus récente

// --- Cycle de vie du contexte ------------------------------------------------

// Crée l'AudioContext au premier geste utilisateur. Idempotent : un second appel
// se contente de reprendre le contexte s'il est suspendu (politique d'autoplay).
function init() {
  if (contexte) {
    if (contexte.state === 'suspended') contexte.resume();
    return;
  }
  const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return; // Web Audio indisponible : jouer() restera silencieux, sans erreur
  contexte = new AC();
  construireGraphe();
}

// Construit le bus master une seule fois : deux départs (sec / réverb), un
// convolveur avec réponse impulsionnelle synthétisée, un compresseur, puis le
// volume utilisateur et le mute.
function construireGraphe() {
  busSec = contexte.createGain();
  busSec.gain.value = 1;

  busReverbSend = contexte.createGain();
  busReverbSend.gain.value = 0.2; // réverb mixée à ~20 %

  convolver = contexte.createConvolver();
  convolver.buffer = synth.creerReponseImpulsionnelle(contexte, 1.2, 3.2);
  convolver.normalize = true;

  compresseur = contexte.createDynamicsCompressor();
  compresseur.threshold.value = -18;
  compresseur.knee.value = 20;
  compresseur.ratio.value = 3;
  compresseur.attack.value = 0.003;
  compresseur.release.value = 0.25;

  gainVolume = contexte.createGain();
  gainVolume.gain.value = volumeCourant;

  gainMuet = contexte.createGain();
  gainMuet.gain.value = estMuetCourant ? 0 : 1;

  busSec.connect(compresseur);
  busReverbSend.connect(convolver);
  convolver.connect(compresseur);
  compresseur.connect(gainVolume);
  gainVolume.connect(gainMuet);
  gainMuet.connect(contexte.destination);
}

// --- Réglages -----------------------------------------------------------------

// Volume général, 0..1.
function volume(v) {
  volumeCourant = Math.min(1, Math.max(0, v));
  if (gainVolume) gainVolume.gain.setTargetAtTime(volumeCourant, contexte.currentTime, 0.01);
}

// Coupe ou rétablit le son (le volume réglé est conservé).
function muet(b) {
  estMuetCourant = !!b;
  if (gainMuet) gainMuet.gain.setTargetAtTime(estMuetCourant ? 0 : 1, contexte.currentTime, 0.01);
}

function estMuet() { return estMuetCourant; }

// --- Gestion des voix (polyphonie ≤ 24, nettoyage sans fuite) ----------------

// Connecte la voix au bus master et l'enregistre ; coupe la plus ancienne voix si
// la polyphonie maximale est atteinte, puis programme son propre nettoyage.
function jouerVoix({ sortie, noeuds, duree }) {
  if (voixActives.length >= POLYPHONIE_MAX) {
    couperVoix(voixActives.shift());
  }
  sortie.connect(busSec);
  sortie.connect(busReverbSend);
  const voix = { sortie, noeuds, actif: true, minuteur: null };
  voix.minuteur = setTimeout(() => terminerVoix(voix), Math.ceil(duree * 1000) + 80);
  voixActives.push(voix);
}

// Coupe une voix immédiatement (fondu de 20 ms pour éviter tout clic), puis nettoie.
function couperVoix(voix) {
  if (!voix || !voix.actif) return;
  voix.actif = false;
  clearTimeout(voix.minuteur);
  try {
    const maintenant = contexte.currentTime;
    voix.sortie.gain.cancelScheduledValues(maintenant);
    voix.sortie.gain.setValueAtTime(voix.sortie.gain.value, maintenant);
    voix.sortie.gain.linearRampToValueAtTime(0, maintenant + 0.02);
  } catch (e) { /* contexte déjà fermé : rien à faire */ }
  setTimeout(() => nettoyerVoix(voix), 40);
}

// Fin naturelle de l'enveloppe : la voix est déjà silencieuse, il suffit de nettoyer.
function terminerVoix(voix) {
  if (!voix.actif) return;
  voix.actif = false;
  nettoyerVoix(voix);
}

// Déconnecte tous les noeuds de la voix (aucune fuite) et la retire de la liste.
function nettoyerVoix(voix) {
  voix.noeuds.forEach((n) => {
    try { if (typeof n.stop === 'function') n.stop(); } catch (e) { /* déjà arrêté */ }
    try { n.disconnect(); } catch (e) { /* déjà déconnecté */ }
  });
  const i = voixActives.indexOf(voix);
  if (i !== -1) voixActives.splice(i, 1);
}

// --- Répertoire des sons --------------------------------------------------

const FABRIQUES = {
  tap: synth.construireTap,
  detruit: synth.construireDetruit,
  speciale: synth.construireSpeciale,
  rotation: synth.construireRotation,
  chute: synth.construireChute,
  rebond: synth.construireRebond,
  element: synth.construireElement,
  niveau: synth.construireNiveau,
  competence: synth.construireCompetence,
  victoire: synth.construireVictoire,
  echec: synth.construireEchec,
  ui: synth.construireUi,
  erreur: synth.construireErreur,
};

// Joue un son par son nom. Ne fait rien (sans erreur) si init() n'a pas encore
// été appelé, si le nom est inconnu, ou si la synthèse échoue pour une raison
// quelconque — un son ne doit jamais interrompre le jeu.
function jouer(nom, params = {}) {
  if (!contexte) return;
  const fabrique = FABRIQUES[nom];
  if (!fabrique) return;
  let construction;
  try {
    construction = fabrique(contexte, params);
  } catch (e) {
    return;
  }
  if (construction) jouerVoix(construction);
}

export const audio = { init, jouer, volume, muet, estMuet };
