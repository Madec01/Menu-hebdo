/* ===========================================================================
   Suite de vérification de l'agenda — à relancer après chaque modification.

   Elle ouvre agenda.html dans un vrai navigateur, EN DOUBLE-CLIC (file://),
   parce que passer par un serveur local masquerait justement la catégorie de
   problèmes qui frapperait l'utilisateur.

   Mode d'emploi :
     npm i playwright
     node tests/verification.mjs
   Si le navigateur n'est pas trouvé, ajustez CHEMIN_NAVIGATEUR ci-dessous
   ou lancez : npx playwright install chromium
   =========================================================================== */
import { chromium } from 'playwright';
import { existsSync } from 'fs';

const CANDIDATS = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].filter(Boolean);
const CHEMIN_NAVIGATEUR = CANDIDATS.find(c => existsSync(c));
const ADRESSE = 'file://' + new URL('../agenda.html', import.meta.url).pathname;

const R = [];
const ok = (nom, obtenu, attendu) => {
  const bon = JSON.stringify(obtenu) === JSON.stringify(attendu);
  R.push((bon ? 'OK    ' : 'ECHEC ') + nom +
    (bon ? '' : `   attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`));
};

const navigateur = await chromium.launch(
  CHEMIN_NAVIGATEUR ? { executablePath: CHEMIN_NAVIGATEUR } : {});
const contexte = await navigateur.newContext({ acceptDownloads: true });
const page = await contexte.newPage();
const erreurs = [];
page.on('pageerror', e => erreurs.push('ERREUR JS : ' + e.message));
page.on('console', m => { if (m.type() === 'error') erreurs.push('CONSOLE : ' + m.text()); });

/* Les panneaux de demarrage se presentent l'un apres l'autre. On les evacue
   tous, quel que soit leur ordre, sinon un panneau ajoute plus tard fait
   echouer des dizaines de controles sans rapport avec lui. */
const evacuerPanneaux = async (p = page) => {
  for (let tour = 0; tour < 6; tour++){
    if (await p.locator('#wOk').count()){ await p.click('#wOk'); await p.waitForTimeout(200); continue; }
    if (await p.locator('#vOui').count()){ await p.click('#vOui'); await p.waitForTimeout(200); continue; }
    break;
  }
};
const neuf = async () => {
  await page.goto(ADRESSE);
  await page.waitForTimeout(500);
  await evacuerPanneaux();
};
const injecter = (fn, arg) => page.evaluate(fn, arg);
const recharger = async (ms = 800) => {
  await page.reload(); await page.waitForTimeout(ms); await evacuerPanneaux();
};

/* ---- 1. Chargement et utilitaires de date ------------------------------- */
await neuf();
const auto = await page.evaluate(() => window.autoTest());
ok('auto-test interne (dates, report, intégrité)', auto.echecs, 0);
R.push('      → ' + auto.total + ' assertions internes');

/* ---- 2. Saisie ---------------------------------------------------------- */
const auj = await page.evaluate(() => dateAujourdhui());
await page.click(`.daybin[data-jour="${auj}"]`);
await page.waitForTimeout(150);
await page.keyboard.type('Appeler le comptable');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
await page.keyboard.type('Relire le devis');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
ok('deux tâches créées à la suite', await page.locator(`.daybin[data-jour="${auj}"] .item`).count(), 2);
/* Ce contrôle mesurait la hauteur du CHAMP de titre, qui s'est toujours
   dimensionné correctement. Il passait donc au vert pendant que la BOÎTE qui
   le contient était écrasée par le bac et que le texte débordait par-dessus la
   tâche suivante. Un contrôle qui mesure le mauvais objet est pire qu'un
   contrôle absent : il donne une confiance imméritée. On mesure désormais la
   boîte, et on remplit le bac pour déclencher précisément la compression. */
await injecter(() => {
  for (let i = 0; i < 10; i++){
    const id = creerItem({ placement:'day', date:dateAujourdhui() }, false);
    etat.items[id].title = 'Relancer le fournisseur au sujet du devis de septembre ' + i;
  }
  rendre();
});
await page.waitForTimeout(300);
const troncature = await page.evaluate(() => {
  const bin = document.querySelector(`.daybin[data-jour="${dateAujourdhui()}"]`);
  let ecrasees = 0, debordantes = 0;
  bin.querySelectorAll('.item').forEach(el => {
    const ta = el.querySelector('textarea.title');
    if (!ta) return;
    const hBoite = el.getBoundingClientRect().height;
    const hTexte = ta.getBoundingClientRect().height;
    if (hBoite < hTexte) ecrasees++;
    if (ta.scrollHeight > hTexte + 1) debordantes++;
  });
  return { ecrasees, debordantes, taches: bin.querySelectorAll('.item').length };
});
ok('bac chargé : les tâches sont bien là', troncature.taches >= 10, true);
ok('un titre long n\'est jamais coupé dans son champ', troncature.debordantes, 0);
ok('une tâche n\'est jamais écrasée par son bac', troncature.ecrasees, 0);

/* Un bac plafonné qui déborde doit le dire : sans repère, l'en-tête annonçait
   huit tâches, le bac en montrait trois, et les cinq autres n'existaient pour
   personne — les navigateurs masquent leur barre de défilement au repos. */
const deborde = await page.evaluate(() => {
  const bin = document.querySelector(`.daybin[data-jour="${dateAujourdhui()}"]`);
  const r = bin.querySelector('.binreste');
  const cachees = [...bin.querySelectorAll('.item')].filter(
    el => el.offsetTop + el.offsetHeight > bin.scrollTop + bin.clientHeight + 1).length;
  return { repere: !!r, texte: r ? r.textContent : '', annonce: r ? parseInt(r.textContent.replace(/\D+/g, '')) : 0,
           cachees: cachees, marque: bin.classList.contains('deborde') };
});
ok('bac qui déborde : un repère l\'annonce', deborde.repere, true);
ok('bac qui déborde : le bac est marqué', deborde.marque, true);
ok('bac qui déborde : le compte annoncé est le bon', deborde.annonce, deborde.cachees);

/* ---- 3. Cocher, prioriser, supprimer, annuler --------------------------- */
await page.locator(`.daybin[data-jour="${auj}"] .item`).first().locator('.chk').check();
await page.waitForTimeout(200);
ok('cocher une tâche', await page.evaluate(() => tousLesItems().filter(i => i.status === 'done').length), 1);

const idCycle = await injecter(() => { const i = creerItem({ placement:'day', date:dateAujourdhui() }, false);
  etat.items[i].title = 'Cycle'; rendre(); return i; });
const cycle = [];
for (let k = 0; k < 3; k++){
  /* Les commandes d'une tâche ne paraissent qu'au survol : c'est ce qui rend
     leur largeur au texte. Un test doit donc survoler avant de cliquer,
     exactement comme le ferait une main. */
  const ligne = page.locator(`.daybin .item[data-id="${idCycle}"]`);
  await ligne.scrollIntoViewIfNeeded();
  await ligne.hover();
  await page.waitForTimeout(60);
  await ligne.locator('.pdot').click();
  await page.waitForTimeout(120);
  cycle.push(await injecter(i => etat.items[i].priority, idCycle));
}
ok('cycle des trois priorités', cycle, ['urgent','semaine','libre']);

const avant = await page.evaluate(() => Object.keys(etat.items).length);
const aSupprimer = page.locator(`.daybin[data-jour="${auj}"] .item`).first();
await aSupprimer.scrollIntoViewIfNeeded();
await aSupprimer.hover();
await page.waitForTimeout(60);
await aSupprimer.locator('.del').click({ force:true });
await page.waitForTimeout(200);
ok('suppression', await page.evaluate(() => Object.keys(etat.items).length), avant - 1);
await page.keyboard.press('Control+z');
await page.waitForTimeout(250);
ok('annulation par Ctrl+Z', await page.evaluate(() => Object.keys(etat.items).length), avant);

/* ---- 4. Persistance ----------------------------------------------------- */
await page.fill('#notes', 'Note de test');
await page.waitForTimeout(500);
await recharger();
ok('données conservées après rechargement', await page.evaluate(() => Object.keys(etat.items).length), avant);
ok('notes conservées', await page.inputValue('#notes'), 'Note de test');

/* Pointeur d'emplacement perdu.
   Se rabattre aveuglement sur l'emplacement "A" pouvait renvoyer le plus
   ANCIEN des deux et faire disparaitre le travail de la journee. */
await injecter(() => { const i = creerItem({ placement:'day', date:dateAujourdhui() }, false);
  etat.items[i].title = 'Ecrite juste avant la perte du pointeur'; enregistrerMaintenant(); });
await page.waitForTimeout(300);
const avantPerte = await page.evaluate(() => Object.keys(etat.items).length);
await page.evaluate(() => localStorage.removeItem('agendaHebdo:slot'));
await recharger();
ok('pointeur perdu : on repart des données les plus récentes',
   await page.evaluate(() => Object.keys(etat.items).length), avantPerte);

/* ---- 4 bis. Deux onglets ouverts sur le meme agenda ---------------------- */
{
  const ctxO = await navigateur.newContext();
  const o1 = await ctxO.newPage(); await o1.goto(ADRESSE); await o1.waitForTimeout(500);
  await evacuerPanneaux(o1);
  await o1.evaluate(() => { for (let i = 0; i < 9; i++){
    const id = creerItem({ placement:'day', date:dateAujourdhui() }, false); etat.items[id].title = 'T' + i; }
    enregistrerMaintenant(); });
  await o1.waitForTimeout(300);

  const o2 = await ctxO.newPage(); await o2.goto(ADRESSE); await o2.waitForTimeout(600);
  await evacuerPanneaux(o2);
  ok('deux onglets : le second voit les données du premier',
     await o2.evaluate(() => Object.keys(etat.items).length), 9);

  await o2.evaluate(() => { const id = creerItem({ placement:'day', date:dateAujourdhui() }, false);
    etat.items[id].title = 'Saisie dans le second onglet'; enregistrerMaintenant(); });
  await o2.waitForTimeout(400);

  // Le premier onglet est desormais perime. Il ne doit plus rien ecrire.
  const refus = await o1.evaluate(() => { etat.items = {}; return storeEcrire(etat); });
  ok('deux onglets : l\'onglet périmé se voit refuser l\'écriture', refus, false);
  await o1.waitForTimeout(200);
  ok('deux onglets : l\'onglet périmé avertit', await o1.locator('#alertBar').isVisible(), true);
  ok('deux onglets : l\'avertissement propose une porte de sortie',
     await o1.locator('#alertAction').isVisible(), true);

  const o3 = await ctxO.newPage(); await o3.goto(ADRESSE); await o3.waitForTimeout(600);
  await evacuerPanneaux(o3);
  ok('deux onglets : rien n\'est écrasé', await o3.evaluate(() => Object.keys(etat.items).length), 10);
  await ctxO.close();
}

/* ---- 4 ter. Rendez-vous qui se chevauchent ------------------------------- */
/* Aucun contrôle de la version 1.0.0 ne créait deux rendez-vous simultanés.
   C'est ce trou qui a laissé passer le défaut le plus bloquant de l'interface :
   les cases horaires cliquables tombaient à zéro pixel de large et la journée
   devenait impossible à cliquer. */
{
  const j = await injecter(() => {
    const jour = datePlus(dateLundi(dateAujourdhui()), 1);
    for (const id of Object.keys(etat.items)) if (id.startsWith('ch')) delete etat.items[id];
    [[540,90,'Réunion équipe produit'],[570,60,'Appel fournisseur'],[600,90,'Comité de pilotage'],
     [900,60,'Entretien annuel']].forEach(([m,d,t],k) => {
      etat.items['ch'+k] = Object.assign({}, ITEM_DEFAUT, { id:'ch'+k, title:t,
        placement:'slot', date:jour, origDate:jour, startMin:m, durMin:d, status:'open' });
    });
    rendre(); return jour;
  });
  await page.waitForTimeout(300);

  const g = await page.evaluate(jour => {
    const col = document.querySelector(`.daycol[data-jour="${jour}"]`);
    const cases = col.querySelectorAll('.slot');
    const rdv = [...col.querySelectorAll('.slotitem')].map(e => ({
      titre: e.querySelector('textarea').value,
      largeur: Math.round(e.getBoundingClientRect().width),
      gauche: Math.round(e.getBoundingClientRect().left),
      texte: Math.round(e.querySelector('textarea').getBoundingClientRect().width),
    }));
    return { largeurCase: Math.round(cases[0].getBoundingClientRect().width),
             nbCases: cases.length, rdv: rdv,
             largeurColonne: Math.round(col.getBoundingClientRect().width) };
  }, j);

  ok('chevauchement : les cases horaires gardent leur largeur',
     g.largeurCase > g.largeurColonne * 0.9, true);
  /* La grille est repliée sur les heures occupées : le nombre de créneaux
     suit donc le contenu. Ce qui compte est qu'ils existent et couvrent bien
     les rendez-vous, pas qu'ils soient vingt-deux à longueur d'année. */
  ok('chevauchement : les cases horaires existent', g.nbCases >= 8, true);
  ok('chevauchement : les quatre rendez-vous sont affichés', g.rdv.length, 4);
  /* Avant correctif, le texte d'un rendez-vous simultané mesurait ZÉRO pixel.
     Un couloir partagé reste étroit — c'est la répartition de l'espace qui
     réglera le fond — mais il doit toujours montrer du texte. */
  ok('chevauchement : aucun rendez-vous réduit à rien',
     g.rdv.every(r => r.texte > 30), true);
  ok('chevauchement : le titre complet reste lisible en infobulle',
     await page.evaluate(jour => {
       const e = document.querySelector(`.daycol[data-jour="${jour}"] .slotitem`);
       return /\d\d:\d\d – \d\d:\d\d/.test(e.title) && e.title.includes('Réunion équipe produit');
     }, j), true);
  // Les trois premiers se chevauchent et se partagent la largeur ; le
  // quatrieme, seul a 15 h, doit reprendre toute la colonne.
  ok('chevauchement : les simultanés se partagent la largeur',
     g.rdv.filter(r => r.largeur < g.largeurColonne * 0.6).length, 3);
  ok('chevauchement : un rendez-vous isolé garde toute la largeur',
     g.rdv.filter(r => r.largeur > g.largeurColonne * 0.85).length, 1);
  ok('chevauchement : les simultanés ne se recouvrent pas',
     new Set(g.rdv.filter(r => r.largeur < g.largeurColonne * 0.6).map(r => r.gauche)).size, 3);

  await injecter(() => { for (const id of Object.keys(etat.items)) if (id.startsWith('ch')) delete etat.items[id];
    rendre(); });
}

/* ---- 5. Report automatique ---------------------------------------------- */
const poser = (id, jours, extra) => injecter(a => {
  const j = datePlus(dateAujourdhui(), a.jours);
  etat.items[a.id] = Object.assign({}, ITEM_DEFAUT, { id:a.id, title:a.id, placement:'day',
    date:j, origDate:j, status:'open' }, a.extra || {});
  etat.meta.lastRolloverOn = ''; enregistrerMaintenant();
}, { id, jours, extra });

await poser('retard', -5);
await recharger();
const t = await injecter(() => etat.items.retard);
ok('report : arrive sur aujourd\'hui', t.date, auj);
ok('report : compteur à 1', t.rolloverCount, 1);
ok('report : atterrit dans le bac À faire', t.placement, 'day');
ok('report : la date d\'origine est intacte', t.origDate, await page.evaluate(() => datePlus(dateAujourdhui(), -5)));
ok('report : marqueur ↩ affiché', await page.locator('.item[data-id="retard"] .roll').count(), 1);

for (let k = 0; k < 3; k++) await recharger(450);
const t2 = await injecter(() => etat.items.retard);
ok('idempotence : la date ne bouge plus', t2.date, auj);
ok('idempotence : le compteur ne monte plus', t2.rolloverCount, 1);

await poser('fossile', -200);
await recharger();
ok('tâche de 200 jours rangée au parking', await injecter(() => etat.items.fossile.placement), 'park');
ok('tâche très ancienne jamais supprimée', await injecter(() => etat.items.fossile.status), 'open');

/* Un rendez-vous, c'est-a-dire un element pose sur un creneau horaire.
   Surtout PAS de kind:'event' ici : aucun geste de l'application ne produit
   cette valeur, si bien que l'ancienne version de ce controle validait une
   branche morte pendant que les vrais rendez-vous, eux, etaient reportes. */
await poser('rdv', -3, { placement:'slot', startMin:600 });
await recharger();
const rdv = await injecter(() => etat.items.rdv);
ok('un rendez-vous passé ne se reporte pas', rdv.date,
   await page.evaluate(() => datePlus(dateAujourdhui(), -3)));
ok('un rendez-vous passé garde son heure', rdv.startMin, 600);
ok('un rendez-vous passé reste sur la grille', rdv.placement, 'slot');
ok('un rendez-vous passé n\'est jamais compté comme reporté', rdv.rolloverCount, 0);

await poser('futur', 3);
await recharger();
ok('une tâche future reste à sa date', await injecter(() => etat.items.futur.date),
   await page.evaluate(() => datePlus(dateAujourdhui(), 3)));

await poser('faite', -4, { status:'done' });
await recharger();
ok('une tâche terminée reste à sa date', await injecter(() => etat.items.faite.date),
   await page.evaluate(() => datePlus(dateAujourdhui(), -4)));

/* ---- 6. Écrans de décision ---------------------------------------------- */
await neuf();
await injecter(() => {
  const semPrec = datePlus(dateLundi(dateAujourdhui()), -7);
  ['a','b','c'].forEach(n => {
    etat.items['sem' + n] = Object.assign({}, ITEM_DEFAUT, { id:'sem' + n, title:'Semaine ' + n,
      placement:'day', date:datePlus(semPrec, 2), origDate:datePlus(semPrec, 2),
      status:'open', priority:'semaine', weekOfOrigin:semPrec });
  });
  etat.meta.lastWeekReviewOn = semPrec; etat.meta.lastRolloverOn = '';
  etat.settings.sasActif = false; enregistrerMaintenant();
});
await recharger();
ok('panneau du lundi affiché', await page.locator('#panel h2').textContent(), 'Le point du lundi');
ok('trois tâches à arbitrer', await page.locator('#panel .arbrow').count(), 3);
await page.locator('#panel .arbrow[data-id="sema"] [data-act="urgent"]').click(); await page.waitForTimeout(150);
ok('arbitrage : passage en urgent', await injecter(() => etat.items.sema.priority), 'urgent');
await page.locator('#panel .arbrow[data-id="semb"] [data-act="abandon"]').click(); await page.waitForTimeout(150);
ok('arbitrage : abandon marque le statut', await injecter(() => etat.items.semb.status), 'abandoned');
ok('arbitrage : abandon ne détruit pas la donnée', await injecter(() => !!etat.items.semb), true);
await page.locator('#panel .arbrow[data-id="semc"] [data-act="garder"]').click(); await page.waitForTimeout(300);
ok('panneau refermé une fois tout traité', await page.locator('#veil').isHidden(), true);
await recharger();
ok('le panneau du lundi ne revient pas le même jour', await page.locator('#veil').isHidden(), true);

await injecter(() => {
  ['x','y','z'].forEach(n => {
    etat.items['sas' + n] = Object.assign({}, ITEM_DEFAUT, { id:'sas' + n, title:'Sas ' + n,
      placement:'day', date:dateAujourdhui(), origDate:dateAujourdhui(), status:'open' });
  });
  etat.settings.sasActif = true; etat.settings.sasHeure = 0; etat.meta.lastSasOn = '';
  enregistrerMaintenant();
});
await recharger();
ok('sas de fin de journée affiché', await page.locator('#panel h2').textContent(), 'Le point de fin de journée');
await page.locator('#panel .arbrow[data-id="sasx"] [data-act="demain"]').click(); await page.waitForTimeout(200);
ok('sas : report à demain', await injecter(() => etat.items.sasx.date),
   await page.evaluate(() => datePlus(dateAujourdhui(), 1)));
await page.locator('#panel .arbrow[data-id="sasy"] [data-act="fait"]').click(); await page.waitForTimeout(200);
ok('sas : marquer fait', await injecter(() => etat.items.sasy.status), 'done');
await page.locator('#panel .arbrow[data-id="sasz"] input[data-act="date"]').fill('2027-03-15');
await page.waitForTimeout(300);
ok('sas : choisir une date précise', await injecter(() => etat.items.sasz.date), '2027-03-15');
ok('sas : les lignes traitées disparaissent',
   await page.locator('#panel .arbrow[data-id="sasx"]').count(), 0);
await page.click('#sOk'); await page.waitForTimeout(300);
ok('sas refermé', await page.locator('#veil').isHidden(), true);
await recharger();
ok('le sas ne revient pas le même jour', await page.locator('#veil').isHidden(), true);

await injecter(() => {
  for (let k = 0; k < 15; k++){
    const j = datePlus(dateAujourdhui(), -(2 + k % 5));
    etat.items['abs' + k] = Object.assign({}, ITEM_DEFAUT, { id:'abs' + k, title:'Absence ' + k,
      placement:'day', date:j, origDate:j, status:'open' });
  }
  etat.meta.lastRolloverOn = ''; etat.settings.sasActif = false; enregistrerMaintenant();
});
await recharger(900);
ok('écran de rattrapage après absence', await page.locator('#panel h2').textContent(),
   'Vous revenez après une absence');
await page.click('#tPark'); await page.waitForTimeout(300);
ok('rattrapage : tout au parking en un clic',
   await injecter(() => Object.keys(etat.items).filter(i => i.startsWith('abs') &&
     etat.items[i].placement === 'park').length), 15);

/* ---- 7. Sauvegarde et intégrité ----------------------------------------- */

/* La sauvegarde ne doit JAMAIS annoncer un succès qu'elle ne peut pas
   constater. Deux chemins, deux comportements, tous deux contrôlés ici. */

// Chemin 1 : le navigateur sait confirmer (fenêtre d'enregistrement).
// On simule une confirmation, puis un renoncement de l'utilisateur.
await page.evaluate(() => {
  window.__ecrit = null;
  window.showSaveFilePicker = async (opts) => ({
    createWritable: async () => ({
      write: async (t) => { window.__ecrit = { nom: opts.suggestedName, taille: t.length }; },
      close: async () => {},
    }),
  });
  etat.meta.lastBackupOn = ''; etat.meta.lastBackupTryOn = '';
});
await page.click('#backupBtn'); await page.waitForTimeout(300);
await page.click('#bExp'); await page.waitForTimeout(400);
ok('enregistrement confirmé : le fichier est bien écrit',
   await page.evaluate(() => !!(window.__ecrit && window.__ecrit.taille > 100)), true);
ok('enregistrement confirmé : nom daté',
   await page.evaluate(() => /^agenda-\d{4}-\d{2}-\d{2}\.json$/.test(window.__ecrit.nom)), true);
ok('enregistrement confirmé : la pastille peut passer au vert',
   await page.evaluate(() => etat.meta.lastBackupOn === dateAujourdhui()), true);

await page.evaluate(() => {
  etat.meta.lastBackupOn = ''; etat.meta.lastBackupTryOn = '';
  window.showSaveFilePicker = async () => { const e = new Error('annulé'); e.name = 'AbortError'; throw e; };
});
await page.click('#bExp'); await page.waitForTimeout(400);
ok('enregistrement abandonné : rien n\'est prétendu',
   await page.evaluate(() => etat.meta.lastBackupOn), '');

// Chemin 2 : téléchargement classique. On ne sait pas s'il arrive, donc on
// enregistre une TENTATIVE et surtout pas une confirmation.
await page.evaluate(() => {
  delete window.showSaveFilePicker;
  etat.meta.lastBackupOn = ''; etat.meta.lastBackupTryOn = '';
});
const dl = page.waitForEvent('download', { timeout:8000 });
await page.click('#bExp');
const fichier = await dl.catch(() => null);
ok('téléchargement de la sauvegarde', fichier !== null, true);
ok('téléchargement non vérifiable : tentative enregistrée',
   await page.evaluate(() => etat.meta.lastBackupTryOn === dateAujourdhui()), true);
ok('téléchargement non vérifiable : AUCUNE confirmation prétendue',
   await page.evaluate(() => etat.meta.lastBackupOn), '');
ok('téléchargement non vérifiable : la pastille le dit',
   await page.evaluate(() => { majPastilleSauvegarde();
     return document.getElementById('saveText').textContent; }), 'Sauvegarde non vérifiée');
ok('téléchargement non vérifiable : une confirmation est proposée',
   await page.locator('#toastAction').isVisible(), true);
await page.click('#toastAction'); await page.waitForTimeout(300);
ok('l\'utilisateur confirme : la sauvegarde compte enfin',
   await page.evaluate(() => etat.meta.lastBackupOn === dateAujourdhui()), true);
await page.click('#backupBtn').catch(() => {}); await page.waitForTimeout(300);

/* La restauration promet d'être réversible, et cette promesse repose
   entièrement sur la copie de sécurité. Si elle ne part pas, on ne remplace
   rien : mieux vaut ne pas restaurer que restaurer sans retour possible. */
{
  await page.click('#bClose').catch(() => {}); await page.waitForTimeout(200);
  const avantResto = await page.evaluate(() => Object.keys(etat.items).length);
  await page.evaluate(() => {
    window.__blobOrigine = window.Blob;
    window.Blob = function(){ throw new Error('téléchargement indisponible'); };
    const faux = enveloppe(etatVide());
    confirmerRestauration(faux, 'test');
  });
  await page.waitForTimeout(300);
  await page.click('#crOui'); await page.waitForTimeout(400);
  ok('copie de sécurité impossible : la restauration est interrompue',
     await page.evaluate(() => Object.keys(etat.items).length), avantResto);
  ok('copie de sécurité impossible : l\'agenda explique pourquoi',
     await page.locator('#riClose').isVisible(), true);
  await page.click('#riClose'); await page.waitForTimeout(200);
  await page.evaluate(() => { window.Blob = window.__blobOrigine; });
}
if (fichier){
  ok('nom de fichier daté', /^agenda-\d{4}-\d{2}-\d{2}\.json$/.test(fichier.suggestedFilename()), true);
  const flux = await fichier.createReadStream();
  let contenu = '';
  for await (const morceau of flux) contenu += morceau;
  ok('format reconnu', JSON.parse(contenu).format, 'agenda-hebdo');
  ok('sauvegarde saine acceptée', await page.evaluate(c => valider(c).ok, contenu), true);
  ok('sauvegarde tronquée refusée',
     await page.evaluate(c => valider(c).ok, contenu.slice(0, contenu.length - 40)), false);
  ok('fichier étranger refusé', await page.evaluate(() => valider('{"format":"autre"}').ok), false);
}
await page.click('#bClose').catch(() => {}); await page.waitForTimeout(200);

/* ---- 7 bis. Instantanés : réservoir partagé ------------------------------ */
{
  const snap = await page.evaluate(() => {
    // On repart d'un stockage d'instantanés propre.
    for (const j of listerInstantanes()) localStorage.removeItem(K.snap + j);
    ramasserLeReservoir();

    for (let i = 0; i < 120; i++){
      etat.items['pool' + i] = Object.assign({}, ITEM_DEFAUT, { id:'pool' + i,
        title:'Tâche de mesure du réservoir numéro ' + i, date:dateAujourdhui(),
        origDate:dateAujourdhui(), status:'open' });
    }
    const compter = (p) => { let n = 0; for (let i = 0; i < localStorage.length; i++){
      const c = localStorage.key(i); if (c && c.indexOf(p) === 0) n++; } return n; };
    const mesurer = () => { let o = 0; for (let i = 0; i < localStorage.length; i++){
      const c = localStorage.key(i); if (c && c.indexOf(K.snap) === 0) o += (localStorage.getItem(c) || '').length;
      } return o; };

    const vraiAuj = window.dateAujourdhui;
    const jours = [];
    for (let d = 0; d < 5; d++){
      const j = datePlus(vraiAuj(), -4 + d);
      window.dateAujourdhui = () => j;
      instantaner(etat);                       // mêmes tâches, cinq jours de suite
      window.dateAujourdhui = vraiAuj;
      jours.push(j);
    }
    return { instantanes: compter(K.snap), reservoir: compter(K.pool),
             octetsInstantanes: mesurer(), jours: jours,
             taches: Object.keys(etat.items).length,
             taillesTaches: JSON.stringify(etat.items).length };
  });

  ok('instantanés : cinq jours enregistrés', snap.instantanes, 5);
  // Les taches n'ont pas bouge d'un jour sur l'autre : le reservoir en contient
  // donc UNE par tache, et non cinq. C'est tout l'interet du dispositif.
  ok('réservoir : une seule copie par tâche inchangée', snap.reservoir, snap.taches);
  ok('réservoir : cinq instantanés coûtent moins qu\'une copie entière',
     snap.octetsInstantanes < snap.taillesTaches, true);

  // Reconstruction fidele
  const relu = await page.evaluate(j => {
    const v = lireInstantane(j);
    return { ok: v.ok, taches: v.ok ? Object.keys(v.paquet.data.items).length : -1,
             titre: v.ok ? v.paquet.data.items.pool7.title : '' };
  }, snap.jours[2]);
  ok('instantané relu : reconstruction réussie', relu.ok, true);
  ok('instantané relu : toutes les tâches sont là', relu.taches >= 120, true);
  ok('instantané relu : le contenu est fidèle', relu.titre, 'Tâche de mesure du réservoir numéro 7');

  // Un reservoir ampute doit etre DETECTE, jamais reconstruit a moitie en silence.
  const ampute = await page.evaluate(j => {
    const p = JSON.parse(localStorage.getItem(K.snap + j));
    localStorage.removeItem(p.refs.pool3);
    const v = lireInstantane(j);
    return { ok: v.ok, msg: v.msg || '' };
  }, snap.jours[2]);
  ok('instantané amputé : refusé, pas reconstruit à moitié', ampute.ok, false);
  ok('instantané amputé : l\'agenda dit pourquoi', /introuvable/.test(ampute.msg), true);

  // Les instantanes de l'ancien format, complets, restent lisibles.
  const ancien = await page.evaluate(() => {
    const j = datePlus(dateAujourdhui(), -9);
    localStorage.setItem(K.snap + j, JSON.stringify(enveloppe({
      schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, meta: etat.meta,
      items: { vieille: Object.assign({}, ITEM_DEFAUT, { id:'vieille', title:'Format d\'avant' }) },
      weekNotes: {}, settings: etat.settings })));
    const v = lireInstantane(j);
    return { ok: v.ok, titre: v.ok ? v.paquet.data.items.vieille.title : '' };
  });
  ok('instantané de l\'ancien format : toujours lisible', ancien.ok, true);
  ok('instantané de l\'ancien format : contenu intact', ancien.titre, 'Format d\'avant');

  // Le ramasse-miettes ne doit rien laisser derriere lui.
  const gc = await page.evaluate(() => {
    for (const j of listerInstantanes()) localStorage.removeItem(K.snap + j);
    ramasserLeReservoir();
    let n = 0; for (let i = 0; i < localStorage.length; i++){
      const c = localStorage.key(i); if (c && c.indexOf(K.pool) === 0) n++; }
    return n;
  });
  ok('réservoir : rien ne subsiste sans instantané qui le désigne', gc, 0);
}

/* ---- 7 ter. Répartition de l'espace ------------------------------------- */
/* Le reproche à l'origine de cette version : « la partie chose à faire est
   trop petite ». Elle était plafonnée à 190 pixels sur TOUT écran, et le
   plafond était à l'envers du besoin — plus l'écran est étroit, plus les
   titres passent à la ligne, plus il faudrait de hauteur. */
{
  await injecter(() => {
    for (const id of Object.keys(etat.items)) delete etat.items[id];
    for (let i = 0; i < 14; i++){
      const id = creerItem({ placement:'day', date:dateAujourdhui() }, false);
      etat.items[id].title = 'Relancer le fournisseur Delmas au sujet du devis ' + i;
    }
    etat.settings.partBacs = appliquerPartBacs(null);
    rendre();
  });
  await page.waitForTimeout(300);

  const espace = await page.evaluate(() => {
    const bacs = document.getElementById('boardBins').getBoundingClientRect().height;
    const grille = document.getElementById('boardScroll').getBoundingClientRect().height;
    const bin = document.querySelector(`.daybin[data-jour="${dateAujourdhui()}"]`);
    const it = bin.querySelector('.item');
    const ta = it.querySelector('textarea.title');
    return { bacs, grille, part: bacs / (bacs + grille),
             plafond: getComputedStyle(bin).maxHeight,
             boite: it.getBoundingClientRect().width,
             texte: ta.getBoundingClientRect().width };
  });

  ok('le bac n\'a plus de plafond en dur', espace.plafond, 'none');
  ok('un jour chargé occupe une vraie part de l\'écran', espace.part > 0.45, true);
  ok('la grille horaire garde toujours sa place', espace.grille >= 120, true);
  // Avant : 84 pixels de décoration sur chaque tâche, quelle que soit la
  // largeur de l'écran, soit la moitié de la place sur un portable.
  ok('la décoration ne mange plus la moitié de la tâche',
     espace.boite - espace.texte <= 40, true);
  ok('le texte occupe l\'essentiel de la largeur',
     espace.texte / espace.boite > 0.8, true);

  // La poignée doit agir DANS LES DEUX SENS, y compris quand le bac est déjà
  // plus court que sa part : une poignée qui ne répond qu'à moitié est pire
  // qu'une poignée absente.
  const boite = await page.locator('#binGrab').boundingBox();
  await page.mouse.move(boite.x + boite.width / 2, boite.y + 3);
  await page.mouse.down();
  await page.mouse.move(boite.x + boite.width / 2, boite.y - 120, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  const apresHaut = await page.evaluate(() => ({
    bacs: document.getElementById('boardBins').getBoundingClientRect().height,
    part: etat.settings.partBacs,
    fixe: document.querySelector('.board').classList.contains('partfixe') }));
  ok('la poignée réduit le bac', apresHaut.bacs < espace.bacs - 40, true);
  ok('la poignée passe en hauteur imposée', apresHaut.fixe, true);

  const boite2 = await page.locator('#binGrab').boundingBox();
  await page.mouse.move(boite2.x + boite2.width / 2, boite2.y + 3);
  await page.mouse.down();
  await page.mouse.move(boite2.x + boite2.width / 2, boite2.y + 130, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  ok('la poignée agrandit le bac',
     await page.evaluate(() => document.getElementById('boardBins').getBoundingClientRect().height) >
       apresHaut.bacs + 40, true);

  const partAvant = await page.evaluate(() => etat.settings.partBacs);
  await recharger();
  ok('la répartition choisie est mémorisée',
     await page.evaluate(() => etat.settings.partBacs), partAvant);

  await page.locator('#binGrab').dblclick();
  await page.waitForTimeout(250);
  ok('le double-clic rend la main à l\'ajustement automatique',
     await page.evaluate(() => etat.settings.partBacs === null &&
       !document.querySelector('.board').classList.contains('partfixe')), true);

  // Le bandeau urgent pouvait s'étaler sur trois rangées et 138 pixels, pris
  // directement sur la zone de travail.
  await injecter(() => {
    for (let i = 0; i < 12; i++){
      const id = creerItem({ placement:'day', date:dateAujourdhui() }, false);
      etat.items[id].title = 'Urgence à traiter sans délai numéro ' + i;
      etat.items[id].priority = 'urgent';
    }
    rendre();
  });
  await page.waitForTimeout(300);
  const urg = await page.evaluate(() => ({
    hauteur: document.querySelector('.urgentbar').getBoundingClientRect().height,
    repere: !!document.querySelector('.ureste'),
    montrees: [...document.querySelectorAll('.uchip')].filter(c =>
      c.getBoundingClientRect().bottom <=
      document.querySelector('.urgentlist').getBoundingClientRect().bottom + 1).length }));
  ok('le bandeau urgent reste borné en hauteur', urg.hauteur <= 80, true);
  ok('le bandeau urgent annonce ce qu\'il replie', urg.repere, true);
  await page.click('.ureste'); await page.waitForTimeout(250);
  ok('le bandeau urgent se déplie',
     await page.evaluate(() => document.querySelector('.urgentbar').getBoundingClientRect().height) > urg.hauteur,
     true);
  await page.click('.ureste'); await page.waitForTimeout(250);
  ok('et se replie',
     await page.evaluate(() => document.querySelector('.urgentbar').getBoundingClientRect().height) <= 80, true);

  await injecter(() => { for (const id of Object.keys(etat.items)) delete etat.items[id]; rendre(); });
}

/* ---- 8. Réglages, affichage, impression --------------------------------- */
await page.click('#settingsBtn'); await page.waitForTimeout(300);
await page.selectOption('#rTheme', 'sombre'); await page.waitForTimeout(200);
ok('thème sombre appliqué', await page.evaluate(() => document.documentElement.dataset.theme), 'sombre');
await page.selectOption('#rDeb', '360'); await page.waitForTimeout(250);
ok('plage horaire modifiée', await page.evaluate(() => etat.settings.debutJournee), 360);

/* La grille repliée ne montre que les heures occupées. Les deux comportements
   sont contrôlés : replié, la plage suit le contenu et reste bien plus courte
   que la plage réglée ; déplié, elle honore exactement le réglage. */
await page.uncheck('#rRepli'); await page.waitForTimeout(300);
ok('grille dépliée : la plage réglée est honorée à la case près',
   await page.evaluate(() => document.querySelector('.daycol').querySelectorAll('.slot').length), 26);
await page.check('#rRepli'); await page.waitForTimeout(300);
const repli = await page.evaluate(() => {
  const p = plageAffichee();
  return { creneaux: document.querySelector('.daycol').querySelectorAll('.slot').length,
           debut: p.debut, fin: p.fin, regle: etat.settings.finJournee - etat.settings.debutJournee };
});
ok('grille repliée : la plage se resserre sur les heures occupées',
   repli.fin - repli.debut < repli.regle, true);
ok('grille repliée : jamais moins de quatre heures', repli.fin - repli.debut >= 240, true);
ok('grille repliée : le nombre de créneaux suit la plage',
   repli.creneaux, (repli.fin - repli.debut) / 30);

await page.uncheck('#rWe'); await page.waitForTimeout(250);
ok('week-end masqué : 5 colonnes', await page.locator('.board-head .dayhead').count(), 5);
await page.check('#rWe'); await page.waitForTimeout(250);
ok('week-end affiché : 7 colonnes', await page.locator('.board-head .dayhead').count(), 7);
ok('le bouton de pliage du week-end est là', await page.locator('.wetoggle').count(), 1);
// Le bouton vit dans la grille : il faut refermer les réglages pour l'atteindre.
await page.click('#rClose'); await page.waitForTimeout(250);
await page.click('.wetoggle'); await page.waitForTimeout(250);
ok('le bouton replie le week-end', await page.locator('.board-head .dayhead').count(), 5);
await page.click('.wetoggle'); await page.waitForTimeout(250);
ok('le bouton le rouvre', await page.locator('.board-head .dayhead').count(), 7);
await page.click('.wetoggle'); await page.waitForTimeout(250);
await page.click('#settingsBtn'); await page.waitForTimeout(300);
await page.check('#rWe'); await page.waitForTimeout(200);
await page.selectOption('#rTheme', 'clair'); await page.waitForTimeout(150);
await page.click('#rClose'); await page.waitForTimeout(200);

/* Sur le papier, tout ce qui existe doit s'imprimer : ni plafond, ni part
   négociée, ni repli. Une tâche hors du cadre à l'écran serait sinon
   purement et simplement absente de la feuille. */
await injecter(() => {
  for (const id of Object.keys(etat.items)) delete etat.items[id];
  const lun = dateLundi(dateAujourdhui());
  for (let d = 0; d < 5; d++) for (let i = 0; i < 2; i++){
    const id = creerItem({ placement:'day', date:datePlus(lun, d) }, false);
    etat.items[id].title = 'Relancer le fournisseur Delmas au sujet du devis ' + d + '-' + i;
  }
  for (let i = 0; i < 2; i++){
    const id = creerItem({ placement:'day', date:dateAujourdhui() }, false);
    etat.items[id].title = 'Urgence ' + i; etat.items[id].priority = 'urgent';
  }
  [[0,540,60,'Comité'],[1,600,45,'Entretien'],[2,840,120,'Atelier']].forEach(([d,m,du,t]) => {
    const id = creerItem({ placement:'slot', date:datePlus(lun, d), startMin:m }, false);
    etat.items[id].title = t; etat.items[id].durMin = du;
  });
  rendre();
});
await page.waitForTimeout(300);
const creneauEcran = await page.evaluate(() => etat.settings.hauteurCreneau);

await injecter(() => preparerImpression(true));
await page.emulateMedia({ media:'print' }); await page.waitForTimeout(250);
ok('impression : barre d\'outils masquée', await page.locator('.topbar').isHidden(), true);
ok('impression : titre de la semaine visible', await page.locator('#printhead').isVisible(), true);

const papier = await page.evaluate(() => {
  let coupees = 0;
  document.querySelectorAll('.daybin .item textarea.title').forEach(ta => {
    if (ta.scrollHeight > ta.getBoundingClientRect().height + 1) coupees++;
  });
  return {
    hauteur: document.querySelector('.app').getBoundingClientRect().height,
    binsMax: getComputedStyle(document.getElementById('boardBins')).maxHeight,
    binMax: getComputedStyle(document.querySelector('.daybin')).maxHeight,
    urgMax: getComputedStyle(document.querySelector('.urgentlist')).maxHeight,
    poignee: getComputedStyle(document.querySelector('.bingrab')).display,
    creneau: etat.settings.hauteurCreneau,
    coupees, taches: document.querySelectorAll('.daybin .item').length,
  };
});
ok('impression : aucun plafond sur les bacs', papier.binsMax, 'none');
ok('impression : aucun plafond sur un jour', papier.binMax, 'none');
ok('impression : le bandeau urgent n\'est plus replié', papier.urgMax, 'none');
ok('impression : les poignées disparaissent', papier.poignee, 'none');
ok('impression : toutes les tâches sont là', papier.taches >= 12, true);
ok('impression : aucun titre coupé', papier.coupees, 0);
ok('impression : les créneaux sont resserrés', papier.creneau < creneauEcran, true);
// A4 paysage, 8 mm de marge : environ 734 px utiles a 96 points par pouce.
ok('impression : une semaine normale tient sur une page', papier.hauteur <= 734, true);

await page.emulateMedia({ media:'screen' });
await injecter(() => preparerImpression(false));
await page.waitForTimeout(200);
ok('impression : la hauteur des créneaux est rendue à l\'écran',
   await page.evaluate(() => etat.settings.hauteurCreneau), creneauEcran);

/* ---- 9. Archive autonome : aller-retour complet -------------------------- */
await neuf();
await injecter(() => {
  ['un','deux','trois'].forEach(n => {
    const i = nouvelId();
    etat.items[i] = Object.assign({}, ITEM_DEFAUT, { id:i, title:'Archive ' + n, placement:'day',
      date:dateAujourdhui(), origDate:dateAujourdhui(), status:'open',
      createdAt:new Date().toISOString() });
  });
  etat.weekNotes[dateLundi(dateAujourdhui())] = { text:'Note archivée', updatedAt:new Date().toISOString() };
  rendre(); enregistrerMaintenant();
});
await page.waitForTimeout(300);
await page.click('#backupBtn'); await page.waitForTimeout(300);
const dlArch = page.waitForEvent('download', { timeout:8000 });
await page.click('#bArch');
const arch = await dlArch.catch(() => null);
ok('archive autonome téléchargée', arch !== null, true);
if (arch){
  ok('archive : nom mensuel', /^agenda-archive-\d{4}-\d{2}\.html$/.test(arch.suggestedFilename()), true);
  const cheminArch = (await import('os')).tmpdir() + '/agenda-archive-test.html';
  await arch.saveAs(cheminArch);
  // On la rouvre dans un contexte NEUF : aucune donnée héritée du navigateur.
  const ctxNeuf = await navigateur.newContext();
  const pageNeuve = await ctxNeuf.newPage();
  const errNeuf = [];
  pageNeuve.on('pageerror', e => errNeuf.push('ARCHIVE : ' + e.message));
  await pageNeuve.goto('file://' + cheminArch);
  await pageNeuve.waitForTimeout(900);
  ok('archive : aucun panneau parasite à l\'ouverture', await pageNeuve.locator('#veil').isHidden(), true);
  ok('archive : les tâches sont retrouvées',
     await pageNeuve.evaluate(() => Object.values(etat.items).filter(i => i.title.startsWith('Archive ')).length), 3);
  ok('archive : la note est retrouvée', await pageNeuve.evaluate(() => noteSemaine()), 'Note archivée');
  ok('archive : les tâches sont affichées', await pageNeuve.locator('.daybin .item').count() >= 3, true);
  ok('archive : aucune ressource chargée depuis internet',
     await pageNeuve.evaluate(() => !document.querySelector('[src^="http"],[href^="http"]')), true);
  erreurs.push(...errNeuf);
  await ctxNeuf.close();
}

/* ---- Bilan --------------------------------------------------------------- */
console.log('\n' + R.join('\n'));
const echecs = R.filter(l => l.startsWith('ECHEC')).length;
console.log('\nErreurs JavaScript : ' + (erreurs.length ? '\n' + erreurs.join('\n') : 'aucune'));
console.log(echecs ? `\n>>> ${echecs} test(s) EN ECHEC.` : `\n>>> Tous les tests réussis.`);
await navigateur.close();
process.exit(echecs || erreurs.length ? 1 : 0);
