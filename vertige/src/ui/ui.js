// Assemble l'interface complète de VERTIGE : menu, HUD, commandes de
// rotation, cartes de choix, panneau Mode Test et toasts. Point d'entrée
// unique conforme au contrat §7 (docs/CONTRATS.md) : creerUI(racine, actions).
import { creerHud } from './hud.js';
import { creerCartes } from './cartes.js';
import { creerTest } from './test.js';
import { formatNombre } from './utils.js';

const DUREE_TOAST = 1600; // ms

export function creerUI(racine, actions) {
  const doc = racine.ownerDocument || document;
  const elHud = doc.getElementById('hud');

  racine.innerHTML = '';

  // --- Couches plein écran (mutuellement exclusives) ---
  const coucheMenu = doc.createElement('div');
  coucheMenu.className = 'couche couche-menu';
  coucheMenu.hidden = true;

  const coucheAttente = doc.createElement('div');
  coucheAttente.className = 'couche';
  coucheAttente.hidden = true;

  const coucheTest = doc.createElement('div');
  coucheTest.className = 'couche';
  coucheTest.hidden = true;

  const coucheToasts = doc.createElement('div');
  coucheToasts.className = 'couche-toasts';

  racine.append(coucheMenu, coucheAttente, coucheTest, coucheToasts);

  const hud = creerHud(elHud);
  const cartes = creerCartes(coucheAttente, actions);
  const test = creerTest(coucheTest, actions);

  function masquerCouches() {
    coucheMenu.hidden = true;
    coucheAttente.hidden = true;
    coucheTest.hidden = true;
  }

  // =====================================================================
  // Menu principal
  // =====================================================================
  function construireMenu({ profil, runEnCours } = {}) {
    coucheMenu.innerHTML = '';
    const p = profil ?? {};

    const panneau = doc.createElement('div');
    panneau.className = 'panneau-menu';

    const titre = doc.createElement('h1');
    titre.className = 'titre-vertige';
    titre.textContent = 'VERTIGE';
    panneau.appendChild(titre);

    const boutons = doc.createElement('div');
    boutons.className = 'menu-boutons';

    const btnNouveau = doc.createElement('button');
    btnNouveau.type = 'button';
    btnNouveau.className = 'touche touche-accent touche-large';
    btnNouveau.textContent = 'Nouveau run';
    btnNouveau.addEventListener('click', () => actions.nouveauRun());
    boutons.appendChild(btnNouveau);

    if (runEnCours) {
      const btnContinuer = doc.createElement('button');
      btnContinuer.type = 'button';
      btnContinuer.className = 'touche touche-large';
      btnContinuer.textContent = 'Continuer';
      btnContinuer.addEventListener('click', () => actions.continuerRun());
      boutons.appendChild(btnContinuer);
    }

    const btnTest = doc.createElement('button');
    btnTest.type = 'button';
    btnTest.className = 'touche touche-orange touche-large';
    btnTest.textContent = 'Mode Test';
    // Le contrat §7 ne définit pas d'action dédiée pour ouvrir le panneau
    // Test depuis le menu (seul actions.lancerTest(config) existe, pour le
    // bouton « Lancer » du panneau). On appelle un hook optionnel : si le
    // module applicatif ne le fournit pas, le clic ne fait rien plutôt que
    // de lever une erreur.
    btnTest.addEventListener('click', () => actions.ouvrirModeTest?.());
    boutons.appendChild(btnTest);

    panneau.appendChild(boutons);

    const ligneSon = doc.createElement('label');
    ligneSon.className = 'menu-son';
    const caseSon = doc.createElement('input');
    caseSon.type = 'checkbox';
    caseSon.checked = !!p.muet;
    caseSon.addEventListener('change', () => actions.muet(caseSon.checked));
    ligneSon.append(caseSon, doc.createTextNode(' Couper le son'));
    panneau.appendChild(ligneSon);

    const stats = doc.createElement('div');
    stats.className = 'menu-stats';
    [
      ['Runs joués', formatNombre(p.runs ?? 0)],
      ['Meilleure salle', p.meilleureSalle ?? '—'],
      ['Monnaie méta', formatNombre(p.monnaieMeta ?? 0)],
    ].forEach(([libelle, valeur]) => {
      const item = doc.createElement('div');
      item.className = 'menu-stat';
      const l = doc.createElement('span');
      l.className = 'menu-stat-label';
      l.textContent = libelle;
      const v = doc.createElement('span');
      v.className = 'menu-stat-valeur';
      v.textContent = valeur;
      item.append(l, v);
      stats.appendChild(item);
    });
    panneau.appendChild(stats);

    coucheMenu.appendChild(panneau);
  }

  // =====================================================================
  // Commandes de rotation (footer #commandes, déjà présent dans index.html)
  // =====================================================================
  const btnGauche = doc.getElementById('btn-rotation-gauche');
  const btnDroite = doc.getElementById('btn-rotation-droite');
  const btn180 = doc.getElementById('btn-rotation-180');
  btnGauche?.addEventListener('click', () => actions.tourner(-1));
  btnDroite?.addEventListener('click', () => actions.tourner(1));
  btn180?.addEventListener('click', () => actions.tourner(2));

  function majBoutonsRotation(etat) {
    const desactive = (etat.jauge ?? 0) <= 0 || !!etat.enAttente;
    [btnGauche, btnDroite, btn180].forEach((bouton) => {
      if (bouton) bouton.disabled = desactive;
    });
  }

  // =====================================================================
  // Clavier : Q/← = -1, D/→ = +1, S/↓ = 2, Échap = quitter (confirmation)
  // =====================================================================
  doc.addEventListener('keydown', (evt) => {
    if (evt.repeat) return;
    const touche = evt.key.toLowerCase();
    if (touche === 'q' || touche === 'arrowleft') actions.tourner(-1);
    else if (touche === 'd' || touche === 'arrowright') actions.tourner(1);
    else if (touche === 's' || touche === 'arrowdown') actions.tourner(2);
    else if (evt.key === 'Escape') {
      const confirmer = doc.defaultView?.confirm ?? globalThis.confirm;
      if (typeof confirmer === 'function' && confirmer('Quitter le run en cours ?')) {
        actions.quitter();
      }
    }
  });

  // =====================================================================
  // Toasts
  // =====================================================================
  function message(texte) {
    const toast = doc.createElement('div');
    toast.className = 'toast';
    toast.textContent = texte;
    coucheToasts.appendChild(toast);
    setTimeout(() => toast.remove(), DUREE_TOAST);
  }

  // =====================================================================
  // API publique (§7 CONTRATS)
  // =====================================================================
  return {
    afficherMenu(donnees) {
      masquerCouches();
      construireMenu(donnees);
      coucheMenu.hidden = false;
    },

    afficherJeu() {
      masquerCouches();
    },

    majHud(etat) {
      hud.maj(etat);
      majBoutonsRotation(etat);
    },

    afficherAttente(enAttente) {
      if (!enAttente) {
        coucheAttente.hidden = true;
        cartes.masquer();
        return;
      }
      masquerCouches();
      cartes.afficher(enAttente);
      coucheAttente.hidden = false;
    },

    masquerAttente() {
      coucheAttente.hidden = true;
      cartes.masquer();
    },

    message,

    afficherTest(config) {
      masquerCouches();
      test.afficher(config);
      coucheTest.hidden = false;
    },
  };
}
