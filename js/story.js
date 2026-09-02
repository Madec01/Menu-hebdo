'use strict';
/* Bêtes de Papier — textes narratifs (BP.story).
 *
 * Voix : le carnet de Nour, jeune monteur·se d'ombres de la troupe Kalamos.
 * Personnages : Tibor (le vieux conteur), Iva (la musicienne), l'inspecteur Delcour, le juge.
 * Aucune dépendance : ce module ne contient que des chaînes.
 */
window.BP = window.BP || {};
(function (BP) {

  var story = {};

  /* ---------------------------------------------------------------- titre */

  story.title = 'Bêtes de Papier';
  story.subtitle = 'Carnet de Nour, monteur d\'ombres chez les Kalamos';
  story.tagline = 'Entre la flamme et le drap, tout ce qu\'on ne peut pas dire.';

  /* ---------------------------------------------------------------- actes */

  story.acts = {
    1: {
      title: 'Acte I — Les foires',
      intro: [
        'On m\'a donné le coffre un matin de mars, sans cérémonie. Tibor a seulement dit : ' +
        '« Il est plus vieux que moi. Ne perds rien. »',
        'Dedans, cent quarante découpes de papier bouilli, noircies par la fumée de trois ' +
        'générations. Des disques, des gouttes, des choses qui ne ressemblent à rien tant ' +
        'qu\'on ne les met pas devant la lampe.',
        'Le métier tient en une phrase : plus une découpe est près de la flamme, plus son ' +
        'ombre est grande. Tout le reste — les lièvres, les grues, les rois — n\'est que la ' +
        'conséquence patiente de cette phrase.',
        'Nous jouons les foires. Sault, Bèze, Carmol. Les enfants au premier rang, les ' +
        'gendarmes au fond, et Iva qui accorde son saz pendant que je tends le drap.'
      ],
      outro: 'À Sault, un homme en manteau gris est resté après le dernier rideau. Il a ' +
        'demandé combien de découpes contenait le coffre. J\'ai répondu que je ne les avais ' +
        'jamais comptées. Il a écrit quelque chose, il a salué, il est parti. ' +
        'Tibor a plié le drap sans un mot et nous avons pris la route la nuit même.'
    },
    2: {
      title: 'Acte II — Les villes fermées',
      intro: [
        'Les villes se ferment l\'une après l\'autre. On n\'entre plus qu\'avec un laissez-passer ; ' +
        'on ne sort plus qu\'avec une raison écrite.',
        'Une troupe d\'ombres, elle, entre encore : nous ne sommes qu\'un divertissement. ' +
        'C\'est ce que dit le sceau sur nos papiers.',
        'Tibor a sorti du fond du coffre deux lampes que je n\'avais jamais vues : une lampe ' +
        'de cuivre rouge et une lampe à verre bleu. Posées ensemble devant le même drap, ' +
        'elles donnent à chaque découpe deux ombres — l\'une rouge, l\'autre bleue.',
        'Qui tient un monocle rouge ne voit que la première. Qui tient un verre bleu ne voit ' +
        'que la seconde. Et qui n\'a rien devant l\'œil ne distingue que l\'ombre franche, ' +
        'là où les deux se recouvrent. Trois publics, une seule scène.',
        'Les familles ont compris avant nous. Elles nous confient des phrases : un nom, une ' +
        'porte, une heure. Nous les faisons passer en bêtes.'
      ],
      outro: 'Iva a été arrêtée sur la place de la halle, son tambour encore chaud. On a ' +
        'ouvert le coffre devant nous et retiré tout ce qui « représente » : les têtes, les ' +
        'mains, les couronnes. Il nous reste des barres et des disques. ' +
        'Le lendemain, la Chancellerie nous convoquait. La citation était signée Delcour.'
    },
    3: {
      title: 'Acte III — Le procès',
      intro: [
        'Le tribunal a fait tendre notre drap entre deux colonnes de la salle d\'audience, ' +
        'comme une pièce à conviction qu\'on aurait décidé de faire parler.',
        'Ils ont apporté leurs propres lampes. Une de cuivre rouge, une à verre bleu. ' +
        'Ils ne savent pas ce que cela permet. Delcour, peut-être, s\'en doute.',
        'Le juge regardera à l\'œil nu. La foule, aux fenêtres, tient des verres teintés de ' +
        'rouge que le vitrier de la rue basse a distribués ce matin. Iva, dans sa cage, ' +
        'derrière la balustrade, en a un bleu.',
        'Tibor n\'a plus de voix. C\'est moi qui nommerai les bêtes.'
      ],
      outro: 'Le rideau est tombé sur un silence long. Puis quelqu\'un a applaudi, et il a ' +
        'fallu que tout le monde applaudisse, y compris ceux qui n\'avaient rien vu.'
    }
  };

  /* ---------------------------------------------------------------- épilogues */

  story.endings = {
    transmission: {
      title: 'Transmission',
      paragraphs: [
        'Les trois lectures ont tenu jusqu\'au dernier coup de tambour. Le juge a vu un conte ' +
        'de nourrice et l\'a dit tout haut. La foule a vu l\'accusation et s\'est tue, ce qui ' +
        'est une manière de crier. Iva a vu la clé et a frappé deux coups contre le mur.',
        'On nous a relâchés le surlendemain, faute de grief. Iva est sortie une semaine plus ' +
        'tard par la porte des cuisines, à l\'heure exacte où le drap l\'avait annoncé.',
        'Tibor est mort à l\'automne, dans une charrette, en écoutant pleuvoir. Nous avons ' +
        'joué le soir même : on ne referme pas un coffre le jour où quelqu\'un le quitte.',
        'J\'ai donné le coffre au printemps à une fille de Carmol qui savait déjà faire un ' +
        'lièvre avec ses mains. Je lui ai dit la seule phrase qu\'il fallait dire, celle que ' +
        'Tibor m\'avait dite : il est plus vieux que moi, ne perds rien.'
      ]
    },
    evasion: {
      title: 'L\'Évasion',
      paragraphs: [
        'Le verre bleu a tout reçu. Iva a lu la clé, le couloir, l\'heure — et elle est sortie.',
        'Le reste s\'est brouillé. Le juge a vu une bête confuse et n\'a rien conclu ; la foule ' +
        'aux verres rouges a vu un fouillis et s\'en est allée sans avoir compris ce qu\'on ' +
        'l\'accusait de ne pas savoir.',
        'Nous avons été condamnés à six mois pour « spectacle non déclaré ». C\'est peu. ' +
        'C\'est même une plaisanterie, comparé à ce qui aurait pu être dit.',
        'Iva nous attendait à la sortie avec le coffre, qu\'elle avait racheté à un ferrailleur. ' +
        'Il manquait douze découpes. Nous en avons taillé d\'autres, moins belles, qui font ' +
        'les mêmes bêtes.'
      ]
    },
    dissolution: {
      title: 'Dissolution',
      paragraphs: [
        'Le drap n\'a rien dit de net. Trois publics ont regardé la même toile et chacun y a ' +
        'vu du gris.',
        'Le juge a parlé d\'« images sans objet ». Delcour a refermé son carnet sans écrire, ' +
        'et je crois que c\'est ce jour-là qu\'il a cessé de nous craindre — ce qui est la pire ' +
        'chose qui puisse arriver à une troupe d\'ombres.',
        'Iva est restée. La troupe s\'est défaite à Bèze, un mardi, sans dispute.',
        'J\'ai gardé le coffre. Je le rouvre parfois, dans des granges, pour trois personnes. ' +
        'Les bêtes reviennent toujours ; c\'est nous qui manquons de lumière.'
      ]
    }
  };

  /** Règle de l'épilogue : `scores` = { red, blue, umbra } de la finale. */
  story.pickEnding = function (scores) {
    scores = scores || {};
    var vals = ['red', 'blue', 'umbra'].map(function (k) {
      return typeof scores[k] === 'number' ? scores[k] : 0;
    });
    var all = vals.every(function (v) { return v >= 0.95; });
    if (all) return story.endings.transmission;
    if ((scores.blue || 0) >= 0.95) return story.endings.evasion;
    return story.endings.dissolution;
  };

  /* ---------------------------------------------------------------- tutoriel */
  /* Voix de Tibor : brève, imagée, jamais didactique. */

  story.tutorial = {
    move: 'Prends une découpe dans le coffre et pose-la sur le drap, petit. ' +
      'Le doigt commande, l\'ombre suit — un peu en retard, comme tout ce qui obéit.',
    depth: 'Approche la découpe de la flamme, petit, et regarde l\'ombre grandir. ' +
      'Recule-la contre le drap : elle redevient sage et petite.',
    rotate: 'Tourne la découpe d\'un quinzième de tour à la fois. Une oreille droite, ' +
      'c\'est un morceau de papier ; une oreille penchée, c\'est un animal qui écoute.',
    flip: 'Le coffre n\'a jamais eu deux ailes. Il a une aile et un miroir : ' +
      'retourne la même découpe, et la paire est faite.',
    tilt: 'Bascule la découpe de profil. Elle ne disparaît pas : elle s\'amincit. ' +
      'C\'est ainsi qu\'on fait des pattes de héron avec des cailloux.',
    oiled: 'Le papier huilé laisse passer la lumière : son ombre est grise. ' +
      'Pose-en deux l\'une sur l\'autre et le gris redevient noir. Mentir deux fois, ça finit par être vrai.',
    twolamps: 'Deux lampes, deux ombres. Le cuivre rouge en jette une, le verre bleu l\'autre. ' +
      'Colle la découpe au drap : elles se confondent. Approche-la des flammes : elles s\'écartent.',
    umbra: 'Celui qui n\'a pas de verre teinté ne voit que l\'ombre franche : ' +
      'l\'endroit où les deux lumières sont barrées ensemble. C\'est la lecture du juge. Soigne-la.',
    performance: 'En représentation, le tambour ne t\'attend pas. À chaque frappe la bête change. ' +
      'On ne recommence pas, petit : on rattrape.',
    target: 'La cible est dessinée à la craie sur le drap. Personne dans la salle ne la voit ' +
      'que toi. Si elle te gêne, éteins-la.'
  };

  /* ---------------------------------------------------------------- succès */

  story.achievements = {
    premier_rideau: { name: 'Premier rideau', desc: 'Réussir un premier tableau.' },
    minimaliste: { name: 'Minimaliste', desc: 'Une ovation en moins de manipulations que le par.' },
    sans_retour: { name: 'Sans retour', desc: 'Une ovation sans jamais annuler un geste.' },
    ovation: { name: 'Ovation', desc: 'Décrocher trois étoiles sur un tableau.' },
    acte1: { name: 'Les foires', desc: 'Terminer l\'acte I.' },
    acte2: { name: 'Les villes fermées', desc: 'Terminer l\'acte II.' },
    acte3: { name: 'Le procès', desc: 'Terminer l\'acte III.' },
    double_lecture: { name: 'Double lecture', desc: 'Réussir un premier tableau à deux lampes.' },
    trois_lectures: { name: 'Trois lectures', desc: 'Satisfaire les trois lectures de la finale.' },
    oeil_de_lynx: { name: 'Œil de lynx', desc: 'Atteindre une ressemblance de 99,5 %.' },
    improvisateur: { name: 'Improvisateur', desc: 'Réussir une improvisation du jour.' },
    tournee_5: { name: 'Cinq villes', desc: 'Tenir cinq étapes de tournée.' },
    tournee_10: { name: 'Dix villes', desc: 'Tenir dix étapes de tournée.' },
    repertoire: { name: 'Répertoire', desc: 'Trois étoiles sur tous les tableaux de l\'histoire.' },
    coffre_ouvert: { name: 'Coffre ouvert', desc: 'Avoir posé au moins une fois chaque découpe.' },
    patient: { name: 'Patient', desc: 'Réussir un tableau après trois échecs, ou après quarante manipulations.' }
  };

  /* ---------------------------------------------------------------- libellés */

  story.ui = {
    play: 'Jouer',
    continue: 'Reprendre',
    improv: 'Improvisation du jour',
    tournee: 'Tournée',
    achievements: 'Succès',
    options: 'Options',
    credits: 'La troupe',
    back: 'Retour',
    close: 'Fermer',
    next: 'Suivant',
    replay: 'Rejouer',
    retry: 'Recommencer',
    curtain: 'Lever le rideau',
    hint: 'Indice',
    target: 'Cible',
    targetOn: 'Montrer la cible',
    targetOff: 'Masquer la cible',
    undo: 'Annuler',
    reset: 'Tout reprendre',
    remove: 'Retirer',
    deeper: 'Reculer',
    closer: 'Avancer',
    rotateLeft: 'Tourner à gauche',
    rotateRight: 'Tourner à droite',
    tilt: 'Basculer',
    flip: 'Miroir',
    menu: 'Menu',
    coffre: 'Coffre',
    moves: 'Manipulations',
    par: 'Par',
    score: 'Ressemblance',
    stars: 'Étoiles',
    act: 'Acte',
    tableau: 'Tableau',
    performance: 'Représentation',
    beat: 'Frappe',
    locked: 'Verrouillé',
    done: 'Réussi',
    viewAll: 'Salle',
    viewRed: 'Verre rouge',
    viewBlue: 'Verre bleu',
    viewUmbra: 'Œil nu',
    readingMain: 'Ombre',
    readingRed: 'Lecture rouge',
    readingBlue: 'Lecture bleue',
    readingUmbra: 'Ombre franche',
    music: 'Musique',
    sfx: 'Effets',
    muted: 'Silence',
    reduceMotion: 'Mouvements réduits',
    sideView: 'Vue de côté',
    eraseSave: 'Effacer la sauvegarde',
    eraseConfirm: 'Effacer pour de bon ?',
    yes: 'Oui',
    no: 'Non',
    passed: 'Réussi',
    gold: 'Ovation',
    failed: 'Le rideau tombe',
    failedHint: 'L\'ombre n\'y était pas encore. On recommence.',
    bestScore: 'Meilleur',
    stage: 'Étape',
    tourneeOver: 'Fin de tournée',
    tourneeScore: 'Villes tenues',
    improvToday: 'Bête du jour',
    epilogue: 'Épilogue',
    theEnd: 'Fin'
  };

  BP.story = story;
})(window.BP);
