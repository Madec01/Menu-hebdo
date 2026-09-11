// Écrans d'attente construits depuis etat.enAttente (§3/§7 CONTRATS) :
// montée de niveau, choix de compétence, fin de salle, fin de run.
export function creerCartes(conteneur, actions) {
  conteneur.classList.add('couche-attente');
  conteneur.innerHTML = '';

  const panneau = document.createElement('div');
  panneau.className = 'panneau-attente';

  const titre = document.createElement('h2');
  titre.className = 'attente-titre';

  const sousTitre = document.createElement('p');
  sousTitre.className = 'attente-soustitre';
  sousTitre.hidden = true;

  const grille = document.createElement('div');
  grille.className = 'grille-cartes';

  const pied = document.createElement('div');
  pied.className = 'attente-pied';

  panneau.append(titre, sousTitre, grille, pied);
  conteneur.appendChild(panneau);

  function vider() {
    titre.textContent = '';
    sousTitre.hidden = true;
    sousTitre.textContent = '';
    grille.innerHTML = '';
    pied.innerHTML = '';
  }

  // Une carte de choix (niveau ou compétence), inclinée façon carton posé
  // sur la table (voir .carte en CSS).
  function carteChoix({ nom, desc, rarete, onChoisir }) {
    const carte = document.createElement('button');
    carte.type = 'button';
    carte.className = 'carte';
    if (rarete) carte.classList.add(`carte-${rarete}`);
    if (rarete) {
      const pastille = document.createElement('span');
      pastille.className = `pastille-rarete pastille-${rarete}`;
      carte.appendChild(pastille);
    }
    const titreCarte = document.createElement('h3');
    titreCarte.textContent = nom;
    const descCarte = document.createElement('p');
    descCarte.textContent = desc;
    carte.append(titreCarte, descCarte);
    carte.addEventListener('click', onChoisir);
    return carte;
  }

  function boutonPied(texte, onClick, accent = false) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = accent ? 'touche touche-accent touche-large' : 'touche touche-large';
    bouton.textContent = texte;
    bouton.addEventListener('click', onClick);
    pied.appendChild(bouton);
    return bouton;
  }

  return {
    afficher(enAttente) {
      vider();
      if (!enAttente) return;

      if (enAttente.type === 'niveau') {
        titre.textContent = `Niveau ${enAttente.niveau} !`;
        (enAttente.propositions ?? []).forEach((prop) => {
          grille.appendChild(carteChoix({
            nom: prop.nom,
            desc: prop.desc,
            onChoisir: () => actions.choisir(prop.id),
          }));
        });
      } else if (enAttente.type === 'competence') {
        titre.textContent = 'Choisis une compétence';
        (enAttente.propositions ?? []).forEach((prop) => {
          grille.appendChild(carteChoix({
            nom: prop.nom,
            desc: prop.desc,
            rarete: prop.rarete,
            onChoisir: () => actions.choisir(prop.id),
          }));
        });
        boutonPied('Passer', () => actions.choisir(null));
      } else if (enAttente.type === 'finSalle') {
        titre.textContent = enAttente.victoire ? 'Salle terminée' : 'Échec';
        sousTitre.hidden = false;
        const raison = enAttente.raison ? `${enAttente.raison} — ` : '';
        sousTitre.textContent = `${raison}XP ${enAttente.xpSalle ?? 0}`;
        boutonPied('Continuer', () => actions.choisir(null), true);
      } else if (enAttente.type === 'finRun') {
        titre.textContent = enAttente.victoire ? 'Victoire' : 'Fin du run';
        sousTitre.hidden = false;
        sousTitre.textContent = `XP totale ${enAttente.xpTotale ?? 0} — Monnaie méta ${enAttente.monnaieMeta ?? 0}`;
        boutonPied('Retour au menu', () => actions.quitter(), true);
      }
    },
    masquer() {
      vider();
    },
  };
}
