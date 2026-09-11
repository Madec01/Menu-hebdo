// Orchestration : moteur ↔ rendu ↔ UI ↔ audio. Voir docs/CONTRATS.md.
import { creerRun, chargerRun } from './moteur/run.js';
import { creerRendu } from './rendu/rendu.js';
import { audio } from './audio/audio.js';
import { creerUI } from './ui/ui.js';
import { SALLES } from './data/salles.js';
import { COMPETENCES } from './data/competences.js';

const CLE_RUN = 'vertige.run', CLE_PROFIL = 'vertige.profil';

function lireJson(cle, defaut) { try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; } catch { return defaut; } }
function ecrire(cle, valeur) { try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch { /* stockage indisponible */ } }

const profil = Object.assign({ runs: 0, victoires: 0, meilleureSalle: 0, monnaieMeta: 0, xpTotale: 0, muet: false }, lireJson(CLE_PROFIL, {}));
let run = null, occupe = false, modeTest = false;

const canvas = document.getElementById('plateau');
const rendu = creerRendu(canvas, {
  onTap(x, y) {
    if (occupe || !run) return;
    audio.init();
    if (!run.peutTaper(x, y)) { audio.jouer('erreur'); return; }
    audio.jouer('tap', { taille: run.groupeA(x, y).length });
    rendu.surligner([]);
    jouer(run.tap(x, y));
  },
  onSurvol(x, y) { rendu.surligner(run && !occupe && x !== null && x !== undefined ? run.groupeA(x, y) : []); },
});

const ui = creerUI(document.getElementById('ui'), {
  nouveauRun() { audio.init(); modeTest = false; run = creerRun({ seed: Date.now() }); demarrer(run.evenementsInitiaux); },
  continuerRun() {
    audio.init(); modeTest = false;
    run = chargerRun(localStorage.getItem(CLE_RUN));
    if (!run) { localStorage.removeItem(CLE_RUN); run = creerRun({ seed: Date.now() }); demarrer(run.evenementsInitiaux); return; }
    demarrer([{ t: 'salle', index: run.etat.salleIndex, nom: run.etat.salle.nom }]);
  },
  ouvrirModeTest() {
    ui.afficherTest({ salles: SALLES.map((s) => ({ id: s.id, nom: s.nom })), competences: COMPETENCES.map((c) => ({ id: c.id, nom: c.nom, rarete: c.rarete })) });
  },
  lancerTest(config) {
    audio.init(); modeTest = true;
    run = creerRun({ seed: config.seed ?? Date.now(), salles: [config.salleId], competences: config.competences ?? [], difficulte: config.difficulte ?? 1,
      options: { couleurs: config.couleurs ?? undefined, jauge: config.jauge ?? undefined } });
    demarrer(run.evenementsInitiaux);
  },
  tourner(sens) {
    if (occupe || !run) return;
    audio.init();
    const ev = run.tourner(sens);
    if (!ev.length) { audio.jouer('erreur'); ui.message(run.etat.enAttente ? 'Choisis d’abord' : 'Plus de rotation disponible'); return; }
    jouer(ev);
  },
  choisir(id) {
    if (occupe || !run || !run.etat.enAttente) return;
    const att = run.etat.enAttente;
    if (att.type === 'finRun') { quitter(); return; }
    audio.jouer(att.type === 'competence' && id ? 'competence' : 'ui');
    ui.masquerAttente();
    jouer(run.choisir(id));
  },
  quitter() { quitter(); },
  muet(b) { profil.muet = !!b; audio.muet(profil.muet); ecrire(CLE_PROFIL, profil); },
});

function demarrer(evenements) {
  ui.afficherJeu();
  rendu.reprendre();
  rendu.synchroniser(run.etat);
  ui.majHud(run.etat);
  jouer(evenements);
}

async function jouer(evenements) {
  evenements = evenements ?? [];
  occupe = true;
  for (const ev of evenements) if (ev.t === 'message') ui.message(ev.texte);
  if (evenements.some((ev) => ev.t === 'salle')) rendu.synchroniser(run.etat); // nouvelle salle : le rendu repart de l'état
  if (evenements.length) { try { await rendu.jouer(evenements, { audio }); } catch (err) { console.error('rendu', err); rendu.synchroniser(run.etat); } }
  occupe = false;
  if (!run) return;
  ui.majHud(run.etat);
  gererAttente();
  sauvegarder();
}

function gererAttente() {
  const att = run.etat.enAttente;
  if (!att) { ui.masquerAttente(); return; }
  if (att.type === 'niveau') audio.jouer('niveau');
  if (att.type === 'finSalle') audio.jouer(att.victoire ? 'victoire' : 'echec');
  if (att.type === 'finRun') {
    audio.jouer(att.victoire ? 'victoire' : 'echec');
    if (!modeTest) {
      profil.runs++; if (att.victoire) profil.victoires++;
      profil.meilleureSalle = Math.max(profil.meilleureSalle, att.salleIndex + 1);
      profil.monnaieMeta += att.monnaieMeta; profil.xpTotale += att.xpTotale;
      ecrire(CLE_PROFIL, profil);
      localStorage.removeItem(CLE_RUN);
    }
  }
  ui.afficherAttente(att);
}

function sauvegarder() {
  if (!run || modeTest) return;
  if (run.etat.enAttente?.type === 'finRun') { localStorage.removeItem(CLE_RUN); return; }
  try { localStorage.setItem(CLE_RUN, run.serialiser()); } catch { /* stockage indisponible */ }
}

function quitter() {
  sauvegarder();
  run = null;
  rendu.pause();
  ui.masquerAttente();
  ui.afficherMenu({ profil, runEnCours: !!localStorage.getItem(CLE_RUN) });
}

audio.muet(profil.muet);
window.addEventListener('resize', () => rendu.redimensionner());
document.addEventListener('pointerdown', () => audio.init(), { once: true });
ui.afficherMenu({ profil, runEnCours: !!localStorage.getItem(CLE_RUN) });

// Accès de débogage et de test de fumée (tools/smoke.mjs).
window.vertige = { get run() { return run; }, get occupe() { return occupe; }, ui, rendu };
