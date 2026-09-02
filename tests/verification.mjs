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
ok('un titre long revient à la ligne',
  await page.evaluate(() => { const t = document.querySelector('.daybin .item textarea.title');
    return t && parseInt(t.style.height) >= 18; }), true);

/* ---- 3. Cocher, prioriser, supprimer, annuler --------------------------- */
await page.locator(`.daybin[data-jour="${auj}"] .item`).first().locator('.chk').check();
await page.waitForTimeout(200);
ok('cocher une tâche', await page.evaluate(() => tousLesItems().filter(i => i.status === 'done').length), 1);

const idCycle = await injecter(() => { const i = creerItem({ placement:'day', date:dateAujourdhui() }, false);
  etat.items[i].title = 'Cycle'; rendre(); return i; });
const cycle = [];
for (let k = 0; k < 3; k++){
  await page.locator(`.daybin .item[data-id="${idCycle}"] .pdot`).click();
  await page.waitForTimeout(120);
  cycle.push(await injecter(i => etat.items[i].priority, idCycle));
}
ok('cycle des trois priorités', cycle, ['urgent','semaine','libre']);

const avant = await page.evaluate(() => Object.keys(etat.items).length);
await page.locator(`.daybin[data-jour="${auj}"] .item`).first().locator('.del').click({ force:true });
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

/* ---- 8. Réglages, affichage, impression --------------------------------- */
await page.click('#settingsBtn'); await page.waitForTimeout(300);
await page.selectOption('#rTheme', 'sombre'); await page.waitForTimeout(200);
ok('thème sombre appliqué', await page.evaluate(() => document.documentElement.dataset.theme), 'sombre');
await page.selectOption('#rDeb', '360'); await page.waitForTimeout(250);
ok('plage horaire modifiée', await page.evaluate(() => etat.settings.debutJournee), 360);
ok('grille reconstruite en conséquence',
   await page.evaluate(() => document.querySelector('.daycol').querySelectorAll('.slot').length), 26);
await page.uncheck('#rWe'); await page.waitForTimeout(250);
ok('week-end masqué : 5 colonnes', await page.locator('.board-head .dayhead').count(), 5);
await page.check('#rWe'); await page.waitForTimeout(200);
await page.selectOption('#rTheme', 'clair'); await page.waitForTimeout(150);
await page.click('#rClose'); await page.waitForTimeout(200);

await page.emulateMedia({ media:'print' }); await page.waitForTimeout(200);
ok('impression : barre d\'outils masquée', await page.locator('.topbar').isHidden(), true);
ok('impression : titre de la semaine visible', await page.locator('#printhead').isVisible(), true);
await page.emulateMedia({ media:'screen' });

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
