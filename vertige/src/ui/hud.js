// Construit et met à jour l'en-tête de jeu (#hud) : coups restants, jauge de
// rotation, XP/niveau de salle, objectif, nom de salle, annonce de rotation,
// bande « Prochaines entrées » (compétence Prévoyance) et effets actifs.
import { COULEURS } from '../data/couleurs.js';
import { formatNombre } from './utils.js';

// Traduit l'objectif de la salle en texte français selon son type (§3/§7 CONTRATS).
function texteObjectif(objectif) {
  if (!objectif) return '';
  const progres = formatNombre(objectif.progres ?? 0);
  const cible = formatNombre(objectif.cible ?? 0);
  switch (objectif.type) {
    case 'score':   return `Score ${progres} / ${cible}`;
    case 'couleur': return `${progres} / ${cible}`;
    case 'ballons': return `Ballons ${progres} / ${cible}`;
    case 'pierres': return `Pierres ${progres} / ${cible}`;
    default:        return `${progres} / ${cible}`;
  }
}

// sens de rotation → symbole affiché dans l'annonce.
const SYMBOLE_ROTATION = { '-1': '⟲', '1': '⟳', '2': '↻' };

export function creerHud(elHud) {
  elHud.innerHTML = '';
  elHud.classList.add('hud');

  const ligneHaut = document.createElement('div');
  ligneHaut.className = 'hud-ligne hud-ligne-haut';
  const nomSalle = document.createElement('span');
  nomSalle.className = 'hud-salle';
  const coupsEl = document.createElement('span');
  coupsEl.className = 'hud-coups';
  ligneHaut.append(nomSalle, coupsEl);

  const jaugeEl = document.createElement('div');
  jaugeEl.className = 'hud-jauge';

  const xpEl = document.createElement('div');
  xpEl.className = 'hud-xp';
  // Niveau affiché dans une pastille ronde (style Cartoon pop) plutôt qu'en texte.
  const niveauEl = document.createElement('span');
  niveauEl.className = 'niveau-pastille';
  const barreXp = document.createElement('div');
  barreXp.className = 'barre-xp';
  const remplissageXp = document.createElement('div');
  remplissageXp.className = 'remplissage';
  barreXp.appendChild(remplissageXp);
  xpEl.append(niveauEl, barreXp);

  const objectifEl = document.createElement('div');
  objectifEl.className = 'hud-objectif';
  const pastilleObjectif = document.createElement('span');
  pastilleObjectif.className = 'bille-mini';
  pastilleObjectif.hidden = true;
  const texteObjectifEl = document.createElement('span');
  objectifEl.append(pastilleObjectif, texteObjectifEl);

  const annonceEl = document.createElement('div');
  annonceEl.className = 'hud-annonce';
  annonceEl.hidden = true;

  const entreesEl = document.createElement('div');
  entreesEl.className = 'hud-entrees';
  entreesEl.hidden = true;
  const entreesLabel = document.createElement('span');
  entreesLabel.className = 'hud-entrees-label';
  entreesLabel.textContent = 'Prochaines entrées';
  const entreesBilles = document.createElement('span');
  entreesBilles.className = 'hud-entrees-billes';
  entreesEl.append(entreesLabel, entreesBilles);

  const effetsEl = document.createElement('div');
  effetsEl.className = 'hud-effets';

  elHud.append(ligneHaut, jaugeEl, xpEl, objectifEl, annonceEl, entreesEl, effetsEl);

  // Le nombre de pastilles de jauge ne change presque jamais : on ne
  // reconstruit la rangée que si jaugeMax a changé.
  let jaugeMaxPrecedent = -1;
  function majJauge(jauge, jaugeMax) {
    if (jaugeMax !== jaugeMaxPrecedent) {
      jaugeEl.innerHTML = '';
      for (let i = 0; i < jaugeMax; i += 1) {
        const pastille = document.createElement('span');
        pastille.className = 'jauge-pastille';
        pastille.textContent = '★'; // étoile allumée/éteinte selon .allumee (CSS)
        jaugeEl.appendChild(pastille);
      }
      jaugeMaxPrecedent = jaugeMax;
    }
    Array.from(jaugeEl.children).forEach((pastille, i) => {
      pastille.classList.toggle('allumee', i < jauge);
    });
  }

  return {
    // Met à jour l'ensemble du HUD depuis l'état du moteur (etat, §3 CONTRATS).
    maj(etat) {
      nomSalle.textContent = etat.salle?.nom ?? '';
      coupsEl.textContent = `${etat.coups ?? 0} coups`;
      majJauge(etat.jauge ?? 0, etat.jaugeMax ?? 0);

      const niveau = etat.niveau ?? 1;
      niveauEl.textContent = String(niveau);
      niveauEl.setAttribute('aria-label', `Niveau ${niveau} sur 10`);
      const bas = etat.xpNiveau ?? 0, haut = etat.xpProchain;
      const fraction = haut === null || haut === undefined ? 1 : (etat.xpSalle - bas) / Math.max(1, haut - bas);
      remplissageXp.style.width = `${Math.min(100, Math.max(0, fraction * 100))}%`;

      const objectif = etat.objectif;
      texteObjectifEl.textContent = texteObjectif(objectif);
      if (objectif?.type === 'couleur' && objectif.couleur != null) {
        pastilleObjectif.hidden = false;
        pastilleObjectif.style.setProperty('--c', COULEURS[objectif.couleur]?.hex ?? '#999');
      } else {
        pastilleObjectif.hidden = true;
      }

      if (etat.annonce) {
        annonceEl.hidden = false;
        const symbole = SYMBOLE_ROTATION[String(etat.annonce.sens)] ?? '?';
        annonceEl.textContent = `Prochaine rotation : ${symbole}`;
      } else {
        annonceEl.hidden = true;
      }

      const aPrevoyance = etat.competences?.includes('prevoyance');
      const entrees = (etat.prochainesEntrees ?? []).slice(0, 8);
      if (aPrevoyance && entrees.length) {
        entreesEl.hidden = false;
        entreesBilles.innerHTML = '';
        entrees.forEach((couleur) => {
          const bille = document.createElement('span');
          bille.className = 'bille-mini';
          bille.style.setProperty('--c', COULEURS[couleur]?.hex ?? '#999');
          entreesBilles.appendChild(bille);
        });
      } else {
        entreesEl.hidden = true;
      }

      const effets = etat.effetsActifs ?? [];
      effetsEl.innerHTML = '';
      effetsEl.hidden = effets.length === 0;
      effets.forEach((effet) => {
        const chip = document.createElement('span');
        chip.className = 'hud-effet';
        chip.textContent = effet.restant === null || effet.restant === undefined ? `${effet.nom} · salle` : `${effet.nom} · ${effet.restant} tour${effet.restant > 1 ? 's' : ''}`;
        effetsEl.appendChild(chip);
      });
    },
  };
}
