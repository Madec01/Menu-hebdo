// Panneau Mode Test : configuration d'une salle isolée (salle, compétences,
// seed, difficulté, couleurs, jauge) pour prototyper sans jouer tout le run.
export function creerTest(conteneur, actions) {
  conteneur.classList.add('couche-test');
  conteneur.innerHTML = '';

  const panneau = document.createElement('div');
  panneau.className = 'panneau-test';

  const titre = document.createElement('h2');
  titre.textContent = 'Mode Test';
  panneau.appendChild(titre);

  const champs = document.createElement('div');
  champs.className = 'test-champs';
  panneau.appendChild(champs);

  // Ajoute un champ étiqueté dans la colonne de gauche.
  function champ(libelle, ...elements) {
    const bloc = document.createElement('label');
    bloc.className = 'test-champ';
    const lab = document.createElement('span');
    lab.textContent = libelle;
    bloc.append(lab, ...elements);
    champs.appendChild(bloc);
    return bloc;
  }

  // --- Salle ---
  const selectSalle = document.createElement('select');
  champ('Salle', selectSalle);

  // --- Compétences (cases à cocher) ---
  const listeCompetences = document.createElement('div');
  listeCompetences.className = 'test-competences';
  const blocCompetences = document.createElement('div');
  blocCompetences.className = 'test-champ-large';
  const labCompetences = document.createElement('span');
  labCompetences.textContent = 'Compétences';
  blocCompetences.append(labCompetences, listeCompetences);
  champs.appendChild(blocCompetences);

  // --- Seed ---
  const inputSeed = document.createElement('input');
  inputSeed.type = 'number';
  inputSeed.step = '1';
  champ('Seed', inputSeed);

  // --- Difficulté (0.5 → 2, pas 0.1) ---
  const inputDifficulte = document.createElement('input');
  inputDifficulte.type = 'range';
  inputDifficulte.min = '0.5';
  inputDifficulte.max = '2';
  inputDifficulte.step = '0.1';
  inputDifficulte.value = '1';
  const valDifficulte = document.createElement('span');
  valDifficulte.className = 'test-valeur';
  valDifficulte.textContent = '1.0';
  inputDifficulte.addEventListener('input', () => {
    valDifficulte.textContent = Number(inputDifficulte.value).toFixed(1);
  });
  champ('Difficulté', inputDifficulte, valDifficulte);

  // --- Couleurs (par défaut de la salle, ou 3..6) ---
  const selectCouleurs = document.createElement('select');
  const optDefaut = document.createElement('option');
  optDefaut.value = '';
  optDefaut.textContent = 'Défaut de la salle';
  selectCouleurs.appendChild(optDefaut);
  [3, 4, 5, 6].forEach((n) => {
    const option = document.createElement('option');
    option.value = String(n);
    option.textContent = String(n);
    selectCouleurs.appendChild(option);
  });
  champ('Couleurs', selectCouleurs);

  // --- Jauge initiale (0..6), avec option « par défaut » ---
  const inputJauge = document.createElement('input');
  inputJauge.type = 'range';
  inputJauge.min = '0';
  inputJauge.max = '6';
  inputJauge.step = '1';
  inputJauge.value = '3';
  inputJauge.disabled = true;
  const valJauge = document.createElement('span');
  valJauge.className = 'test-valeur';
  valJauge.textContent = inputJauge.value;
  inputJauge.addEventListener('input', () => { valJauge.textContent = inputJauge.value; });
  const caseJaugeDefaut = document.createElement('input');
  caseJaugeDefaut.type = 'checkbox';
  caseJaugeDefaut.checked = true;
  const labelJaugeDefaut = document.createElement('label');
  labelJaugeDefaut.className = 'test-case-defaut';
  labelJaugeDefaut.append(caseJaugeDefaut, document.createTextNode(' par défaut'));
  caseJaugeDefaut.addEventListener('change', () => {
    inputJauge.disabled = caseJaugeDefaut.checked;
  });
  champ('Jauge initiale', inputJauge, valJauge, labelJaugeDefaut);

  // --- Pied : Lancer / Retour ---
  const pied = document.createElement('div');
  pied.className = 'test-pied';

  const btnRetour = document.createElement('button');
  btnRetour.type = 'button';
  btnRetour.className = 'touche';
  btnRetour.textContent = 'Retour';
  // Pas d'action dédiée au retour du panneau Test dans le contrat §7 :
  // on réutilise quitter(), comme pour « Retour au menu » en fin de run.
  btnRetour.addEventListener('click', () => actions.quitter());

  const btnLancer = document.createElement('button');
  btnLancer.type = 'button';
  btnLancer.className = 'touche touche-accent';
  btnLancer.textContent = 'Lancer';
  btnLancer.addEventListener('click', () => {
    const competencesChoisies = Array.from(
      listeCompetences.querySelectorAll('input[type="checkbox"]:checked'),
    ).map((c) => c.value);
    actions.lancerTest({
      salleId: selectSalle.value || null,
      competences: competencesChoisies,
      seed: Number(inputSeed.value) || 0,
      difficulte: Number(inputDifficulte.value),
      couleurs: selectCouleurs.value ? Number(selectCouleurs.value) : null,
      jauge: caseJaugeDefaut.checked ? null : Number(inputJauge.value),
    });
  });

  pied.append(btnRetour, btnLancer);
  panneau.appendChild(pied);
  conteneur.appendChild(panneau);

  return {
    // config = { salles:[{id,nom}], competences:[{id,nom,rarete}] } (§7 CONTRATS).
    afficher(config) {
      selectSalle.innerHTML = '';
      (config?.salles ?? []).forEach((salle) => {
        const option = document.createElement('option');
        option.value = salle.id;
        option.textContent = salle.nom;
        selectSalle.appendChild(option);
      });

      listeCompetences.innerHTML = '';
      (config?.competences ?? []).forEach((competence) => {
        const label = document.createElement('label');
        label.className = `test-competence pastille-${competence.rarete ?? 'commun'}`;
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = competence.id;
        label.append(input, document.createTextNode(` ${competence.nom}`));
        listeCompetences.appendChild(label);
      });

      inputSeed.value = String(Math.floor(Math.random() * 1_000_000));
    },
  };
}
