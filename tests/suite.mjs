/* ============================================================================
   Cadence — suite de tests
   ----------------------------------------------------------------------------
   Pilote le jeu dans un vrai navigateur : on pose des machines, on fait tourner
   la simulation, et on vérifie ce qui en sort. Chaque cas ouvre une page neuve.

   Lancer :   node tests/suite.mjs
              node tests/suite.mjs reseau qualite      (quelques cas seulement)
   ========================================================================== */

import { chromium } from "./playwright.mjs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const JEU = "file://" + resolve(RACINE, "cadence.html");

/* ------------------------------------------------------------- Utilitaires */
const CAS = [];
const cas = (nom, fn) => CAS.push({ nom, fn });

/** Chaque cas reçoit une page fraîche, une partie neuve et deux raccourcis. */
async function contexte(nav, mode){
  const page = await nav.newPage({ viewport:{ width:1440, height:900 } });
  const erreurs = [];
  page.on("pageerror", e => erreurs.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") erreurs.push("console: " + m.text()); });
  await page.goto(JEU);
  if (mode) await page.evaluate(m => {
    [...document.querySelectorAll("#choixMode button")].find(b => b.textContent === m)?.click();
  }, mode);
  await page.click("#btNouvelle");
  await page.waitForTimeout(150);
  // `jeu` évalue du code dans la page ; `sim` fait tourner N journées
  const jeu = fn => page.evaluate(fn);
  const sim = jours => page.evaluate(n => {
    for (let t=0; t<n*CONFIG.ticksParJour; t++) simTick();
    document.querySelector("#ecranVendredi")?.classList.remove("visible");
    document.querySelector("#ecranMenu")?.classList.remove("visible");
    document.querySelector("#ecranSortieRecette")?.classList.remove("visible");
    etat.meta.vitesse = 1;
  }, jours);
  return { page, jeu, sim, erreurs };
}

/** Assertions : on collecte tout, on ne s'arrête pas au premier échec. */
function verif(){
  const echecs = [];
  const v = (nom, cond, detail) => { if (!cond) echecs.push(nom + (detail ? " — " + detail : "")); };
  v.egal = (nom, a, b) => v(nom, a === b, "attendu " + JSON.stringify(b) + ", obtenu " + JSON.stringify(a));
  v.proche = (nom, a, b, tol) => v(nom, Math.abs(a-b) <= tol, "attendu ~" + b + ", obtenu " + a);
  v.aumoins = (nom, a, b) => v(nom, a >= b, "attendu au moins " + b + ", obtenu " + a);
  v.echecs = echecs;
  return v;
}

/* ------------------------------------------------------ Scénarios partagés */
const SEG = `(x1,y1,x2,y2)=>{const t=[];let x=x1,y=y1;t.push({x,y});
  while(x!==x2){x+=Math.sign(x2-x);t.push({x,y});}
  while(y!==y2){y+=Math.sign(y2-y);t.push({x,y});}return t;}`;

/** Une ligne de l'âge 1 : laveuse, trancheuse, friteuse, et de quoi tourner. */
const LIGNE_AGE1 = `
  poserMachine('laveuse',3,2,0); poserMachine('trancheuse',6,2,0); poserMachine('friteuse',3,6,0);
  acheter('pdt_brutes',2000); acheter('huile',400);
`;

/* ============================================================ Les cas =====*/

cas("didacticiel", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();
  const bulle = () => page.textContent("#bulleTexte");
  const etapes = [await bulle()];
  for (const [nom, x, y] of [["Laveuse-éplucheuse",3,2],["Trancheuse",6,2],["Friteuse",3,6]]){
    await jeu(`poserMachine(${JSON.stringify(nom==="Laveuse-éplucheuse"?"laveuse":nom==="Trancheuse"?"trancheuse":"friteuse")},${x},${y},0)`);
    await page.waitForTimeout(60);
    etapes.push(await bulle());
  }
  await jeu("acheter('pdt_brutes',500)");
  await page.waitForTimeout(60);
  etapes.push(await bulle());
  v("le contremaître avance à chaque étape", new Set(etapes).size === 5,
    "textes distincts : " + new Set(etapes).size + "/5");
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: "5 étapes" };
});

cas("chaine-age1", async (nav) => {
  const { page, jeu, sim, erreurs } = await contexte(nav);
  const v = verif();
  await jeu(LIGNE_AGE1);
  await sim(6);
  const r = await jeu(`({
    chips: Math.round(etat.progression.produits.chips_vrac||0),
    rebut: Math.round(etat.progression.produits.chips_ratees||0),
    vendu: Math.round(etat.progression.vendus.chips_vrac||0)
  })`);
  v.aumoins("des chips sortent", r.chips, 120);
  v.egal("aucun rebut avant l'âge 3", r.rebut, 0);
  v.aumoins("elles se vendent", r.vendu, 100);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: r.chips + " kg en 6 jours" };
});

cas("conservation-matiere", async (nav) => {
  const { page, jeu, sim, erreurs } = await contexte(nav);
  const v = verif();
  await jeu(`
    poserMachine('laveuse',3,2,0); poserMachine('trancheuse',6,2,0); poserMachine('friteuse',3,6,0);
    acheter('pdt_brutes',1200); acheter('huile',200);
    etat.finances.solde = 500000; etat.venteAuto = false;
  `);
  await sim(25);
  const r = await jeu(`(() => {
    const t = {};
    const add = (k,x) => { if (x > 1e-6) t[k] = (t[k]||0) + x; };
    const tout = tousStocks();
    for (const k in tout) add(k, tout[k]);
    for (const m of U().machines){
      for (const k in m.entree) add(k, m.entree[k]);
      for (const k in m.sortie) add(k, m.sortie[k]);
      if (m.enCycle){ const rc = recetteDe(m); for (const e of rc.entrees) add(e.id, e.qte); }
    }
    for (const c of U().convoyeurs) for (const p of c.transit) add(p.item, p.qte);
    for (const o of U().ouvriers) if (o.charge) add(o.charge.item, o.charge.qte);
    const P = etat.progression.produits;
    return { t, lavees:P.pdt_lavees||0, rond:P.rondelles||0, chips:P.chips_vrac||0 };
  })()`);
  // Les recettes disent : 30 brutes → 25 lavées ; 25 lavées → 25 rondelles ; 24 rondelles + 3,5 huile → 6 chips
  v.proche("pommes de terre conservées", r.lavees/25*30 + (r.t.pdt_brutes||0), 1200, 2);
  v.proche("huile conservée", r.chips/6*3.5 + (r.t.huile||0), 200, 2);
  v.proche("épluchées conservées", r.rond + (r.t.pdt_lavees||0), r.lavees, 2);
  v.proche("rondelles conservées", r.chips/6*24 + (r.t.rondelles||0), r.rond, 2);
  v.proche("chips conservées", (r.t.chips_vrac||0), r.chips, 2);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: Math.round(r.chips) + " kg produits" };
});

cas("reseau-convoyeurs", async (nav) => {
  const { page, jeu, sim, erreurs } = await contexte(nav);
  const v = verif();
  const r = await jeu(`(() => {
    etat.finances.solde = 120000; sauterAge(2);
    poserMachine('laveuse',10,2,0); poserMachine('trancheuse',10,7,0);
    const seg = ${SEG};
    const conv = p => { vue.traceConvoyeur = p; validerTrace(); vue.traceConvoyeur = null;
                        return U().convoyeurs[U().convoyeurs.length-1]; };
    const A = conv(seg(2,5,5,5)), B = conv(seg(6,5,9,5)), C = conv(seg(10,5,10,4));
    const D = conv(seg(12,3,13,5)), E = conv(seg(13,6,11,6));
    const nom = id => { const n = noeudParId(id); return !n ? 'rien'
      : estQuai(n) ? 'quai' : n.type === 'convoyeur' ? 'convoyeur' : n.type; };
    return {
      chaine: [A,B,C].map(c => nom(c.source) + '>' + nom(c.destination)),
      suite:  [D,E].map(c => nom(c.source) + '>' + nom(c.destination)),
      orphelins: U().convoyeurs.filter(c => c.etat === 'non_relie').length
    };
  })()`);
  v.egal("le tronçon 1 part du quai", r.chaine[0], "quai>convoyeur");
  v.egal("le tronçon 2 chaîne les deux", r.chaine[1], "convoyeur>convoyeur");
  v.egal("le tronçon 3 arrive à la machine", r.chaine[2], "convoyeur>laveuse");
  v.egal("la laveuse alimente la suite", r.suite[0], "laveuse>convoyeur");
  v.egal("qui arrive à la trancheuse", r.suite[1], "convoyeur>trancheuse");
  v.egal("aucun convoyeur orphelin", r.orphelins, 0);
  await jeu("acheter('pdt_brutes',3000); for(let i=0;i<3;i++) embaucher(creerCandidat());");
  await sim(3);
  const prod = await jeu("Math.round(etat.progression.produits.rondelles||0)");
  v.aumoins("la matière traverse le réseau", prod, 200);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: prod + " kg de rondelles" };
});

cas("qualite-age3", async (nav) => {
  const { page, jeu, sim, erreurs } = await contexte(nav);
  const v = verif();
  await jeu(`
    sauterAge(3); etat.finances.solde = 150000; remplirStocks();
    poserMachine('laveuse',4,3,0); poserMachine('trancheuse',8,3,0); poserMachine('friteuse',12,3,0);
    for (let i=0;i<4;i++) embaucher(creerCandidat());
  `);
  await sim(6);
  const r = await jeu(`(() => {
    const f = U().machines.find(m => m.type === 'friteuse');
    const op = f.operateurId != null ? ouvrierParId(f.operateurId) : null;
    return { huile: f.fraicheurHuile, taux: tauxRebut(f, op),
             rate: Math.round(etat.progression.produits.chips_ratees||0),
             bon: Math.round(etat.progression.produits.chips_vrac||0) };
  })()`);
  v("l'huile vieillit", r.huile < 0.35, "fraîcheur " + r.huile.toFixed(2));
  v("une part part au rebut", r.taux > 0.05, "taux " + r.taux.toFixed(3));
  v.aumoins("du raté est produit", r.rate, 20);
  const apres = await jeu(`(() => {
    const f = U().machines.find(m => m.type === 'friteuse');
    changerHuile(f);
    const arret = f.arretRestant;
    for (let t=0;t<8;t++) simTick();
    const pendant = f.etat;
    for (let t=0;t<CONFIG.ticksParJour;t++) simTick();
    document.querySelector('#ecranVendredi')?.classList.remove('visible');
    const op = f.operateurId != null ? ouvrierParId(f.operateurId) : null;
    // On compare à saleté et usure identiques : sinon une journée de crasse en
    // plus peut annuler le gain, et le test bascule au hasard.
    const neuve = tauxRebut(f, op);
    const memoire = f.fraicheurHuile;
    f.fraicheurHuile = 0.1;
    const usee = tauxRebut(f, op);
    f.fraicheurHuile = memoire;
    return { huile: f.fraicheurHuile, arret, pendant, taux: neuve, usee };
  })()`);
  v("le bain repart quasi neuf", apres.huile > 0.65, "fraîcheur " + apres.huile.toFixed(2));
  v.egal("la friteuse s'arrête pendant la vidange", apres.pendant, "arret");
  v("l'huile neuve fait remonter la qualité", apres.taux < apres.usee,
    "rebut " + apres.taux.toFixed(3) + " avec l'huile neuve contre " + apres.usee.toFixed(3) + " fatiguée");

  // Le raté part chez le client tant qu'on ne trie pas
  const rec = await jeu(`(() => {
    ajouterStock('chips_ratees', 200); ajouterStock('chips_vrac', 600);
    const c = creerContrat('chips_vrac');
    c.quantite = 400; c.prixUnitaire = 13; c.dateLimite = jourCourant()+10;
    accepterContrat(c);
    const rep = etat.reputation;
    livrerContrats();
    return { reclam: Math.round(c.reclamations||0), repAvant: rep, repApres: etat.reputation };
  })()`);
  v.aumoins("le client réclame", rec.reclam, 1);
  v("la réputation en pâtit", rec.repApres < rec.repAvant, rec.repAvant + " → " + rec.repApres);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: r.rate + " kg de raté" };
});

cas("modes-de-partie", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav, "Bac à sable");
  const v = verif();
  const r = await jeu(`(() => {
    const avant = etat.finances.solde;
    const pose = poserMachine('ensacheuse',5,5,0);      // machine d'âge 2, à l'âge 1
    depenser(999999, 'test');
    etat.finances.solde = -99999; verifierFaillite();
    const fin = document.querySelector('#ecranFin').classList.contains('visible');
    etat.finances.solde = 8000;
    return { mode: etat.meta.mode, pose, cout: avant - etat.finances.solde, fin,
             verrous: document.querySelectorAll('#barreBasse .outil.verrou').length };
  })()`);
  v.egal("mode bac à sable actif", r.mode, "bacASable");
  v("une machine d'un âge futur se pose", r.pose);
  v.egal("la construction est gratuite", r.cout, 0);
  v("aucun dépôt de bilan", !r.fin);
  v.egal("rien n'est verrouillé", r.verrous, 0);
  const n = await jeu(`(() => {
    const soldes = [];
    for (const k in MODES){ etat.meta.mode = k; const s = etat.finances.solde; depenser(1000,'test');
      soldes.push(k + ':' + (s - etat.finances.solde)); }
    etat.meta.mode = 'normal';
    return soldes.join(' ');
  })()`);
  v("seul le bac à sable ne débite pas", n.includes("bacASable:0") && n.includes("normal:1000"), n);
  const nbModes = Object.keys(await jeu("MODES")).length;
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: nbModes + " modes" };
});

cas("saut-de-niveau", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();
  for (let n=1; n<=5; n++){
    const r = await jeu(`(() => { sauterAge(${n});
      return { age: etat.meta.age, nom: U().nom, l: U().largeur, h: U().hauteur }; })()`);
    v.egal("âge " + n + " atteint", r.age, n);
    v.egal("atelier de l'âge " + n, r.l + "x" + r.h, AGES_ATTENDUS[n-1]);
  }
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: "5 âges" };
});
const AGES_ATTENDUS = ["15x12","20x16","32x24","48x36","64x44"];

cas("auto-verifications", async (nav) => {
  const { page, jeu, sim, erreurs } = await contexte(nav);
  const v = verif();
  await jeu(`
    sauterAge(3); etat.finances.solde = 200000; remplirStocks();
    poserMachine('laveuse',4,4,0); poserMachine('trancheuse',8,4,0);
    poserMachine('friteuse',12,4,0); poserMachine('tri',12,9,0); poserMachine('caisse',4,9,0);
    const seg = ${SEG};
    const conv = p => { vue.traceConvoyeur = p; validerTrace(); vue.traceConvoyeur = null; };
    conv(seg(2,5,3,4)); conv(seg(6,4,7,4)); conv(seg(10,4,11,4)); conv(seg(13,6,13,8));
    for (let i=0;i<5;i++) embaucher(creerCandidat());
  `);
  await sim(5);
  const r = await jeu("verifierPartie()");
  for (const t of r) v(t.nom, t.ok, t.detail);
  v.aumoins("toutes les vérifications sont exécutées", r.length, 8);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: r.length + " invariants" };
});

cas("sauvegarde", async (nav) => {
  const { page, jeu, sim, erreurs } = await contexte(nav);
  const v = verif();
  await jeu(LIGNE_AGE1 + "for (let i=0;i<2;i++) embaucher(creerCandidat());");
  await sim(4);
  const avant = await jeu(`(() => { etat.meta.vitesse = 0; sauvegarder(CONFIG.sauvegarde);
    return { t: etat.meta.tempsJeu, solde: Math.round(etat.finances.solde),
             mach: U().machines.length, grille: Array.from(U().grille).join(''),
             chips: Math.round(etat.progression.produits.chips_vrac||0) }; })()`);
  await page.reload();
  await page.waitForTimeout(250);
  await page.click("#btContinuer");
  await page.waitForTimeout(250);
  const apres = await jeu(`({ t: etat.meta.tempsJeu, solde: Math.round(etat.finances.solde),
    mach: U().machines.length, grille: Array.from(U().grille).join(''),
    chips: Math.round(etat.progression.produits.chips_vrac||0) })`);
  v("la partie rechargée est identique", JSON.stringify(avant) === JSON.stringify(apres),
    JSON.stringify(avant) + " ≠ " + JSON.stringify(apres));
  const repart = await jeu("(() => { const a = etat.meta.tempsJeu; for (let t=0;t<20;t++) simTick(); return etat.meta.tempsJeu > a; })()");
  v("la simulation repart", repart);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: "aller-retour complet" };
});

cas("rythme-age1", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();
  const r = await jeu(`(() => {
    poserMachine('laveuse',3,2,0); poserMachine('trancheuse',6,2,0); poserMachine('friteuse',3,6,0);
    acheter('pdt_brutes',400); acheter('huile',80);
    let jours = 0;
    while (etat.meta.age === 1 && jours < 120 && etat.finances.solde > CONFIG.faillite){
      for (let t=0;t<CONFIG.ticksParJour;t++) simTick();
      jours++;
      if (stockDe('pdt_brutes') < 250) acheter('pdt_brutes', 400);
      if (stockDe('huile') < 40) acheter('huile', 80);
      for (const c of etat.contrats.proposes.slice()){
        const cap = capaciteHebdoEstimee(c.produitId);
        const sem = Math.max(1, (c.dateLimite - jourCourant())/5);
        if (c.quantite/sem <= cap*0.9) accepterContrat(c); else refuserContrat(c);
      }
      if (etat.finances.solde > 7000 && U().ouvriers.length < 3) embaucher(creerCandidat());
      document.querySelector('#ecranVendredi')?.classList.remove('visible');
      document.querySelector('#ecranMenu')?.classList.remove('visible');
      etat.meta.vitesse = 1;
    }
    return { jours, minutes: jours*CONFIG.secondesParJour/60, age: etat.meta.age,
             solde: Math.round(etat.finances.solde) };
  })()`);
  v.egal("l'âge 1 est bouclé", r.age, 2);
  v("dans la fenêtre visée de 15 à 35 minutes", r.minutes >= 15 && r.minutes <= 35,
    r.minutes.toFixed(1) + " min");
  v("l'entreprise est viable", r.solde > 0, r.solde + " €");
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: r.minutes.toFixed(1) + " min réelles" };
});

cas("performance", async (nav) => {
  const { page, jeu, sim, erreurs } = await contexte(nav);
  const v = verif();
  await jeu(`
    sauterAge(3); etat.finances.solde = 400000; remplirStocks();
    let n = 0;
    for (let y=2; y<20; y+=4) for (let x=4; x<26; x+=4){
      const t = ['laveuse','trancheuse','friteuse','tambour'][n % 4];
      if (poserMachine(t, x, y, 0)) n++;
    }
    for (let i=0;i<20;i++) embaucher(creerCandidat());
  `);
  await sim(1);
  const cout = await jeu(`(() => {
    const chrono = (f, n) => { const t = performance.now(); for (let i=0;i<n;i++) f(); return (performance.now()-t)/n; };
    return { tick: chrono(() => simTick(), 200), rendu: chrono(() => dessiner(), 40),
             machines: U().machines.length, ouvriers: U().ouvriers.length };
  })()`);
  v("un tick de simulation reste sous 2 ms", cout.tick < 2, cout.tick.toFixed(2) + " ms");
  v("une image reste sous 40 ms en rendu logiciel", cout.rendu < 40, cout.rendu.toFixed(1) + " ms");
  await page.close();
  return { echecs: v.echecs.concat(erreurs),
           note: cout.machines + " machines, " + cout.ouvriers + " ouvriers · tick " +
                 cout.tick.toFixed(2) + " ms · image " + cout.rendu.toFixed(1) + " ms" };
});

cas("recherche-age4", async (nav) => {
  const { page, jeu, sim, erreurs } = await contexte(nav);
  const v = verif();
  await jeu("sauterAge(4); etat.finances.solde = 200000; remplirStocks();");
  const sansBureau = await jeu(`lancerEtude("Essai sans bureau", { gout:'nature', coupe:'ondulee', cuisson:'friture', sel:'normal', texture:'standard', touche:'aucune', format:'familial' })`);
  v("sans bureau, aucune étude ne démarre", sansBureau === false, String(sansBureau));
  await jeu("poserMachine('bureau',-4,2,0);");   // dans la cour, à l'ouest
  // Un ingrédient encore fermé se refuse, même avec un bureau et de l'argent.
  const verrou = await jeu(`lancerEtude("Trop tôt", { gout:'truffe', coupe:'ondulee', cuisson:'friture', sel:'normal', texture:'standard', touche:'aucune', format:'familial' })`);
  v("un ingrédient verrouillé bloque l'étude", verrou === false, String(verrou));
  await jeu("etat.recherche.tout = true; verifierDeblocages(false);");

  // La note doit dépendre de la composition, pas du hasard seul.
  const notes = await jeu(`(() => {
    const bonne = { gout:'truffe', coupe:'gaufrette', cuisson:'huile_olive', sel:'normal',
                    texture:'double', touche:'aucune', format:'familial' };
    const mauvaise = { gout:'truffe', coupe:'allumette', cuisson:'four', sel:'bien',
                       texture:'standard', touche:'petillante', format:'maxi' };
    return { bonne: noteRecette(bonne,0).note, mauvaise: noteRecette(mauvaise,0).note,
             accordsB: accordsDe(bonne).length, accordsM: accordsDe(mauvaise).filter(a=>a.delta<0).length };
  })()`);
  v("une recette bien accordée note mieux qu'une recette bancale",
    notes.bonne > notes.mauvaise + 15, notes.bonne + " contre " + notes.mauvaise);
  v.aumoins("les bons accords se déclenchent", notes.accordsB, 2);
  v.aumoins("les mauvais accords aussi", notes.accordsM, 2);

  // Une étude coûte, prend du temps, puis sort.
  const etude = await jeu(`(() => {
    const t = { gout:'oignon_creme', coupe:'ondulee', cuisson:'chaudron', sel:'normal',
                texture:'craquante', touche:'herbes', format:'familial' };
    const avant = etat.finances.solde;
    lancerEtude("Ondulée du Bassin", t);
    return { cout: avant - etat.finances.solde, jours: etat.recherche.enCours.jours };
  })()`);
  v.aumoins("l'étude est payée", etude.cout, 3000);
  v.aumoins("elle prend du temps", etude.jours, 4);
  await sim(etude.jours + 1);
  const r = await jeu(`(() => {
    const r = etat.recherche.recettes[0];
    return r ? { id:r.id, nom:r.nom, note:r.note, prix:r.prixUnite,
                 avis:(r.avis||[]).length, pistes:(r.pistes||[]).length,
                 item: !!ITEMS[r.id], recette: !!RECETTES['ensacher_'+r.id],
                 surEnsacheuse: MACHINES.ensacheuse.recettes.includes('ensacher_'+r.id),
                 rate: !!ITEMS[r.id+'_rate'] } : null;
  })()`);
  v("la recette est sortie", r !== null);
  if (r){
    v("elle a une note", r.note > 0 && r.note <= 100, String(r.note));
    v("elle a un prix", r.prix > 0, r.prix + " €");
    v.aumoins("le public donne des avis", r.avis, 2);
    v.aumoins("des pistes d'amélioration sont proposées", r.pistes, 1);
    v("elle devient une vraie matière", r.item);
    v("avec sa variante ratée", r.rate);
    v("et une vraie recette d'ensachage", r.recette);
    v("réglable sur l'ensacheuse", r.surEnsacheuse);
  }

  // Elle se produit et se vend pour de bon.
  const prod = await jeu(`(() => {
    const rid = etat.recherche.recettes[0].id;
    poserMachine('ensacheuse',6,6,0);
    const e = U().machines.find(m => m.type === 'ensacheuse');
    e.recetteId = 'ensacher_' + rid;
    ajouterStock('chips_assaisonnees', 400);
    for (let i=0;i<3;i++) embaucher(creerCandidat());
    for (let t=0;t<CONFIG.ticksParJour*3;t++) simTick();
    document.querySelector('#ecranVendredi')?.classList.remove('visible');
    return { faits: Math.round(etat.progression.produits[rid]||0), vendus: Math.round(etat.progression.vendus[rid]||0) };
  })()`);
  v.aumoins("des sachets maison sortent", prod.faits, 100);
  v.aumoins("et se vendent", prod.vendus, 50);

  // La sauvegarde doit reconstruire la recette au chargement.
  const rt = await jeu(`(() => {
    const rid = etat.recherche.recettes[0].id;
    const brut = serialiser();
    nettoyerRecettesJoueur();
    const disparu = !ITEMS[rid];
    appliquer(JSON.parse(brut));
    return { disparu, revenu: !!ITEMS[rid] && !!RECETTES['ensacher_'+rid] };
  })()`);
  v("la recette n'est pas dans les tables constantes", rt.disparu);
  v("elle est reconstruite au chargement", rt.revenu);

  const inv = await jeu("verifierPartie()");
  for (const t of inv) v("invariant : " + t.nom, t.ok, t.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: r ? ("« " + r.nom + " » notée " + r.note) : "—" };
});

cas("raccord-sans-coupure", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();
  // Une bande chargée de sachets ne doit pas empêcher deux kilos de sel de
  // passer : les unités ne se mélangent pas dans le calcul d'encombrement.
  const vol = await jeu(`({
    kilo: volumeItem('sel'), sachet: volumeItem('sachet'),
    capa: (() => { sauterAge(3); etat.finances.solde = 200000;
      poserMachine('tambour',14,6,0);
      const seg = ${JSON.stringify(SEG)};
      return 0; })()
  })`);
  v("un sachet tient moins de place qu'un kilo", vol.sachet < vol.kilo,
    vol.sachet + " contre " + vol.kilo);

  const r = await jeu(`(() => {
    const seg = ${SEG};
    const conv = p => { vue.traceConvoyeur = p; validerTrace(); vue.traceConvoyeur = null;
                        return U().convoyeurs[U().convoyeurs.length-1]; };
    const A = conv(seg(2,6,7,6));      // quai -> ...
    const B = conv(seg(8,6,13,6));     // ...  -> tambour
    // on encombre volontairement la bande d'aval avec des sachets
    B.transit.push({ item:'sachet', qte:600, t:B.latence*0.5 });
    // puis on présente un colis de deux kilos de sel au raccord
    A.transit.push({ item:'sel', qte:2, t:0 });
    const placeAvant = placeEntree(B, 'sel');
    for (let t=0;t<4;t++) simTick();
    const surA = A.transit.filter(p => p.item === 'sel').reduce((s,p)=>s+p.qte,0);
    const surB = B.transit.filter(p => p.item === 'sel').reduce((s,p)=>s+p.qte,0);
    return { placeAvant, surA, surB, liensOk: A.destination === B.id && B.source === A.id };
  })()`);
  v("les deux tronçons sont bien chaînés", r.liensOk);
  v("la bande d'aval a de la place malgré ses sachets", r.placeAvant > 2,
    "place pour " + Math.round(r.placeAvant) + " kg de sel");
  v("le sel n'est pas coupé en deux au raccord", !(r.surA > 0.01 && r.surB > 0.01),
    r.surA.toFixed(2) + " kg restés en amont, " + r.surB.toFixed(2) + " kg passés");
  v("le sel a bien traversé", r.surB > 1.9 || r.surA < 0.01,
    "amont " + r.surA.toFixed(2) + " · aval " + r.surB.toFixed(2));
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: "2 kg passés d'un bloc" };
});

cas("quais-et-rangement", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();

  // Deux quais dès le départ, chacun son compartiment.
  const q0 = await jeu(`(() => {
    ajouterStock('pdt_brutes', 200); ajouterStock('chips_vrac', 50);
    const u = U();
    return { entree:{x:u.quaiEntree.x,h:u.quaiEntree.h}, sortie:{x:u.quaiSortie.x,h:u.quaiSortie.h},
             largeur:u.largeur,
             patatesEntree: Math.round(u.stocks.pdt_brutes||0),
             patatesSortie: Math.round(u.stocksSortie.pdt_brutes||0),
             chipsEntree: Math.round(u.stocks.chips_vrac||0),
             chipsSortie: Math.round(u.stocksSortie.chips_vrac||0),
             idE: occupant(u, u.quaiEntree.x, u.quaiEntree.y),
             idS: occupant(u, u.quaiSortie.x, u.quaiSortie.y) };
  })()`);
  v.egal("le quai d'entrée est contre le mur de gauche", q0.entree.x, 0);
  v.egal("le quai de sortie est contre celui de droite", q0.sortie.x, q0.largeur - 2);
  v.egal("ils portent des identifiants distincts", q0.idE + "/" + q0.idS, "1/2");
  v.egal("les patates se rangent à l'entrée", q0.patatesEntree, 200);
  v.egal("et pas à la sortie", q0.patatesSortie, 0);
  v.egal("les chips se rangent à la sortie", q0.chipsSortie, 50);
  v.egal("et pas à l'entrée", q0.chipsEntree, 0);

  // Le quai d'entrée ne bouge pas quand l'atelier grandit : ce qui y est
  // raccordé doit le rester.
  const bouge = await jeu(`(() => {
    const seg = ${JSON.stringify(SEG)};
    return 0; })()`);
  const g = await jeu(`(() => {
    const u = U();
    const avant = { x:u.quaiEntree.x, y:u.quaiEntree.y };
    poserMachine('laveuse',3,u.quaiEntree.y+1,0);
    const seg = ${SEG};
    vue.traceConvoyeur = seg(2, u.quaiEntree.y+1, 2, u.quaiEntree.y+1)
                          .concat([{x:2,y:u.quaiEntree.y+2}]);
    validerTrace(); vue.traceConvoyeur = null;
    const c = U().convoyeurs[0];
    const relieAvant = c && noeudParId(c.source) && estQuai(noeudParId(c.source));
    sauterAge(3);
    return { avant, apres:{ x:U().quaiEntree.x, y:U().quaiEntree.y },
             relieAvant: !!relieAvant,
             relieApres: !!(c && noeudParId(c.source) && estQuai(noeudParId(c.source))),
             hauteur: U().quaiEntree.h };
  })()`);
  v.egal("le quai d'entrée n'a pas bougé", g.apres.x + "," + g.apres.y, g.avant.x + "," + g.avant.y);
  v("il a grandi avec l'atelier", g.hauteur >= 4, g.hauteur + " tuiles");
  v("le convoyeur qui y était raccordé l'est toujours", !g.relieAvant || g.relieApres);

  // Bac dédié : il se règle seul, puis ne prend plus que ça.
  const bac = await jeu(`(() => {
    etat.finances.solde = 200000;
    poserMachine('caisse_dediee',14,6,0);
    const b = U().machines.find(m => m.type === 'caisse_dediee');
    const videAccepteTout = placeEntree(b,'rondelles') > 0 && placeEntree(b,'sel') > 0;
    livrer(b, 'rondelles', 100);
    return { videAccepteTout, filtre:b.filtre,
             refuse: placeEntree(b,'sel'), accepte: placeEntree(b,'rondelles'),
             capa: MACHINES.caisse_dediee.capacite, capaOrdinaire: MACHINES.caisse.capacite };
  })()`);
  v("un bac dédié vierge accepte tout", bac.videAccepteTout);
  v.egal("il se règle sur la première marchandise reçue", bac.filtre, "rondelles");
  v.egal("puis refuse le reste", bac.refuse, 0);
  v("mais accepte encore la sienne", bac.accepte > 100, bac.accepte + " kg");
  v("il tient plus qu'un bac ordinaire", bac.capa > bac.capaOrdinaire,
    bac.capa + " contre " + bac.capaOrdinaire);

  // Filtre de convoyeur : une bande n'emporte que ce qu'on lui dit.
  const f = await jeu(`(() => {
    sauterAge(4);
    poserMachine('friteuse',20,6,0); poserMachine('caisse',24,6,0);
    const seg = ${SEG};
    vue.traceConvoyeur = seg(23,7,23,7).concat([{x:23,y:6}]);
    validerTrace(); vue.traceConvoyeur = null;
    const c = U().convoyeurs[U().convoyeurs.length-1];
    const sans = itemsAcceptes(c).length;
    c.filtre = 'chips_ratees';
    const avec = itemsAcceptes(c);
    return { sans, avec, source: !!noeudParId(c.source), dest: !!noeudParId(c.destination) };
  })()`);
  v("la bande est raccordée aux deux bouts", f.source && f.dest);
  v("sans filtre elle prend plusieurs marchandises", f.sans > 1, f.sans + " acceptées");
  v.egal("avec un filtre, une seule", f.avec.length, 1);
  v.egal("et c'est la bonne", f.avec[0], "chips_ratees");

  // Agrandir un quai à la demande.
  const ag = await jeu(`(() => {
    const h0 = U().quaiSortie.h; agrandirQuai(true);
    return { h0, h1: U().quaiSortie.h };
  })()`);
  v("le quai s'agrandit contre espèces", ag.h1 === ag.h0 + 2, ag.h0 + " → " + ag.h1);

  const inv = await jeu("verifierPartie()");
  for (const t of inv) v("invariant : " + t.nom, t.ok, t.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: "2 quais, 3 rangements, filtres" };
});

cas("batiments-et-equipe", async (nav) => {
  const { page, jeu, sim, erreurs } = await contexte(nav);
  const v = verif();
  await jeu("sauterAge(4); etat.finances.solde = 300000; remplirStocks();");

  // Les trois bâtiments existent, se posent, et ne produisent rien.
  const b = await jeu(`(() => {
    const ok = ['salle_pause','salle_formation','bureau'].map(t => MACHINES[t] && MACHINES[t].batiment === true);
    poserMachine('salle_pause',-4,2,0); poserMachine('salle_formation',-4,6,0); poserMachine('bureau',-4,11,0);
    const u = U();
    const poses = ['salle_pause','salle_formation','bureau'].map(t => u.machines.some(m=>m.type===t));
    const sp = u.machines.find(m=>m.type==='salle_pause');
    for (let t=0;t<20;t++) simTick();
    return { ok, poses, etatSalle: sp.etat, recette: sp.recette || null, bureaux: bureauxDisponibles() };
  })()`);
  v("les trois sont déclarés comme bâtiments", b.ok.every(Boolean), JSON.stringify(b.ok));
  v("ils se posent tous les trois", b.poses.every(Boolean), JSON.stringify(b.poses));
  v("un bâtiment ne fabrique rien", b.recette === null, String(b.recette));
  v.egal("le bureau est compté", b.bureaux, 1);

  // La salle de pause : on y va vraiment, et on y récupère bien plus vite.
  const rep = await jeu(`(() => {
    for (const o of U().ouvriers.slice()) licencier(o, true);
    embaucher(creerCandidat());
    const o = U().ouvriers[0];
    const sp = U().machines.find(m=>m.type==='salle_pause');
    o.x = sp.x + sp.l + 4; o.y = sp.y; o.fatigue = 0.95; libererTache(o);
    let vuRepos = false, vuAssis = false, sorti = false;
    for (let t=0;t<160;t++){        // la salle est dans la cour : le trajet est long
      simTick();
      if (o.tache && o.tache.type === 'repos'){ vuRepos = true; if (o.tache.phase === 'assis') vuAssis = true; }
      if (!dansAtelier(U(), Math.round(o.x-0.5), Math.round(o.y-0.5))) sorti = true;
      if (vuAssis) break;
    }
    const f0 = o.fatigue;
    for (let t=0;t<12;t++) simTick();
    return { vuRepos, vuAssis, sorti, f0, f1: o.fatigue, moral: o.moral, bonus: bonusSallePause(),
             portes: portesAtelier(U()).length };
  })()`);
  v("un ouvrier épuisé part à la salle de pause", rep.vuRepos);
  v("il sort de l'atelier pour ça", rep.sorti);
  v("il s'y assied", rep.vuAssis);
  v.egal("l'atelier a ses quatre portes", rep.portes, 4);
  v("et il récupère nettement", rep.f0 - rep.f1 > 0.1,
    rep.f0.toFixed(2) + " → " + rep.f1.toFixed(2));
  v("la salle change l'ambiance de tout l'atelier", rep.bonus > 0, "+" + rep.bonus);

  // La formation : plusieurs jours hors poste, puis une vraie compétence en plus.
  const f0 = await jeu(`(() => {
    const o = U().ouvriers[0];
    o.competences.friture = 0.4;
    const avant = etat.finances.solde;
    lancerFormation(o, 'friture');
    for (let t=0;t<8;t++) simTick();
    return { cout: avant - etat.finances.solde, enFormation: !!o.enFormation,
             etat: o.etat, poste: o.tache ? o.tache.type : null,
             comp: o.competences.friture, jours: (etat.formations[0]||{}).restant };
  })()`);
  v.aumoins("la formation est payée", f0.cout, 1000);
  v("l'ouvrier quitte l'atelier", f0.enFormation && f0.poste === null, f0.etat);
  v.aumoins("elle dure plusieurs jours", f0.jours, 4);
  await sim(f0.jours + 1);
  const f1 = await jeu(`(() => {
    const o = U().ouvriers[0];
    return { enFormation: !!o.enFormation, comp: o.competences.friture, restantes: etat.formations.length };
  })()`);
  v("il revient au bout du compte", !f1.enFormation);
  v("mieux formé qu'avant", f1.comp > f0.comp + 0.15, f0.comp.toFixed(2) + " → " + f1.comp.toFixed(2));
  v.egal("la formation est soldée", f1.restantes, 0);

  // Une prime : de l'argent contre du moral.
  const pr = await jeu(`(() => {
    const o = U().ouvriers[0];
    o.moral = 0.3;
    const avant = etat.finances.solde;
    verserPrime(o, 200, true);
    return { cout: avant - etat.finances.solde, moral: o.moral };
  })()`);
  v.egal("la prime sort de la caisse", Math.round(pr.cout), 200);
  v("et remonte le moral", pr.moral > 0.5, "moral " + pr.moral.toFixed(2));

  // Sans salle de formation, on ne forme personne.
  const sans = await jeu(`(() => {
    for (const m of U().machines.filter(m=>m.type==='salle_formation')) demolir(m, true);
    const o = U().ouvriers[0];
    lancerFormation(o, 'lavage');
    return { enFormation: !!o.enFormation, encours: etat.formations.length };
  })()`);
  v("pas de salle, pas de formation", !sans.enFormation && sans.encours === 0);

  const inv = await jeu("verifierPartie()");
  for (const t of inv) v("invariant : " + t.nom, t.ok, t.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: "pause, formation, primes" };
});

cas("cour-et-murs", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();

  // Le terrain déborde l'atelier de la profondeur de cour, sur les quatre côtés.
  const t = await jeu(`(() => {
    const u = U();
    return { l:u.largeur, h:u.hauteur, cour:profondeurCour(u), cases:u.grille.length,
             dedans: dansAtelier(u,3,3), dehors: dansCour(u,-3,3),
             nordOuest: dansCour(u,-3,-3), horsTerrain: dansPlan(u,-99,0) };
  })()`);
  v.egal("la grille couvre l'atelier et sa cour",
    t.cases, (t.l + 2*t.cour) * (t.h + 2*t.cour));
  v("l'intérieur est l'atelier", t.dedans && !t.horsTerrain);
  v("les côtés sont de la cour", t.dehors && t.nordOuest);

  // Chacun de son côté du mur.
  const p = await jeu(`(() => {
    sauterAge(4); etat.finances.solde = 300000;
    const u = U();
    return {
      batDedans: poserMachine('salle_pause',6,6,0),
      batDehors: poserMachine('salle_pause',-4,2,0),
      machDehors: poserMachine('laveuse',-4,8,0),
      machDedans: poserMachine('laveuse',6,6,0),
      refusBat: refusPose(u,'salle_pause',6,6,0),
      refusMach: refusPose(u,'laveuse',-4,8,0)
    };
  })()`);
  v("un bâtiment ne se pose pas dans l'atelier", p.batDedans === false);
  v("il se pose dans la cour", p.batDehors === true);
  v("une machine ne se pose pas dans la cour", p.machDehors === false);
  v("elle se pose dans l'atelier", p.machDedans === true);
  v("le refus s'explique", /cour/.test(p.refusBat) && /atelier/.test(p.refusMach),
    p.refusBat + " / " + p.refusMach);

  // Un convoyeur reste à l'intérieur.
  const c = await jeu(`(() => {
    const u = U();
    return { ancreDehors: ancrageConvoyeur(-3,3,{x:0,y:3}),
             route: routerConvoyeur({x:2,y:2},{x:-3,y:2}) };
  })()`);
  v("on n'ancre pas une bande dans la cour", c.ancreDehors === null);
  v("et on ne l'y route pas non plus", c.route === null);

  // On ne franchit le mur qu'aux portes.
  const f = await jeu(`(() => {
    const u = U(), portes = portesAtelier(u);
    const pn = portes.find(q => q.y === 0);
    return { nb: portes.length,
             parLaPorte: franchissable(u, pn.x, 0, pn.x, -1),
             parLeMur: franchissable(u, pn.x+2, 0, pn.x+2, -1),
             dedans: franchissable(u, 5,5, 5,6),
             cheminDehors: !!cheminVers(u, 4, 4, -1, 20) };
  })()`);
  v.egal("quatre portes, une par façade", f.nb, 4);
  v("on sort par la porte", f.parLaPorte);
  v("on ne traverse pas le mur ailleurs", !f.parLeMur);
  v("à l'intérieur on circule librement", f.dedans);
  v("la cour reste accessible à pied", f.cheminDehors);

  // Le mur qui avance pousse la cour devant lui au lieu d'avaler un bâtiment.
  const g = await jeu(`(() => {
    const u = U();
    const b = u.machines.find(m => m.type === 'salle_pause');
    poserMachine('salle_formation', u.largeur+1, 4, 0);
    const est = u.machines.find(m => m.type === 'salle_formation');
    const avant = { x:est.x, ouest:b.x, l:u.largeur };
    agrandirAtelier(2,0);
    return { avant, apres:{ x:est.x, ouest:b.x, l:u.largeur },
             toujoursDehors: rectDansCour(u, est.x, est.y, est.l, est.h),
             surGrille: occupant(u, est.x, est.y) === est.id };
  })()`);
  v.egal("le mur a bien avancé", g.apres.l, g.avant.l + 2);
  v.egal("le bâtiment de l'est a reculé d'autant", g.apres.x, g.avant.x + 2);
  v.egal("celui de l'ouest n'a pas bougé", g.apres.ouest, g.avant.ouest);
  v("il est toujours dans la cour", g.toujoursDehors);
  v("et toujours inscrit sur la grille", g.surGrille);

  const inv = await jeu("verifierPartie()");
  for (const t of inv) v("invariant : " + t.nom, t.ok, t.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: "cour, portes, murs mobiles" };
});

cas("garde-manger", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();

  // La table elle-même doit tenir debout : c'est de la donnée, elle se vérifie.
  const t = await jeu(`(() => {
    const tous = toutesOptions();
    const ids = tous.map(o => o.id);
    const doublons = ids.filter((x,i) => ids.indexOf(x) !== i);
    const parAxe = AXES_RECETTE.map(a => ({ nom:a.nom, n:a.options.length,
      premiereOuverte: !a.options[0].debloc }));
    const accordsFaux = ACCORDS.filter(a => !ids.includes(a.a) && !TAGS.has(a.a) ||
                                            !ids.includes(a.b) && !TAGS.has(a.b))
                               .map(a => a.a + "+" + a.b);
    const sansCouleur = AXES_RECETTE[0].options.filter(o => !o.couleur).map(o => o.id);
    const apresInconnu = tous.filter(o => o.debloc && o.debloc.apres && !ids.includes(o.debloc.apres))
                             .map(o => o.id);
    const tagInconnu = tous.filter(o => o.debloc && o.debloc.tag &&
                                        !tous.some(x => (x.tags||[]).includes(o.debloc.tag)))
                           .map(o => o.id);
    const sansMot = tous.filter(o => o.debloc && !motDeblocage(o)).map(o => o.id);
    return { total: tous.length, doublons, parAxe, accords: ACCORDS.length, accordsFaux,
             sansCouleur, apresInconnu, tagInconnu, sansMot };
  })()`.replace("TAGS.has", "new Set(toutesOptions().flatMap(o=>o.tags||[])).has"));
  v.aumoins("le garde-manger est vaste", t.total, 80);
  v.egal("aucun identifiant en double", t.doublons.length, 0, t.doublons.join(", "));
  v.aumoins("sept axes de composition", t.parAxe.length, 7);
  v("chaque axe a une option ouverte d'entrée de jeu",
    t.parAxe.every(a => a.premiereOuverte), JSON.stringify(t.parAxe.filter(a=>!a.premiereOuverte)));
  v.aumoins("beaucoup d'accords", t.accords, 80);
  v.egal("tous les accords portent sur des ingrédients réels", t.accordsFaux.length, 0, t.accordsFaux.join(", "));
  v.egal("chaque goût a sa couleur de sachet", t.sansCouleur.length, 0, t.sansCouleur.join(", "));
  v.egal("les conditions « après » visent un ingrédient réel", t.apresInconnu.length, 0, t.apresInconnu.join(", "));
  v.egal("les conditions par tag visent un tag réel", t.tagInconnu.length, 0, t.tagInconnu.join(", "));
  v.egal("chaque verrou sait dire comment l'ouvrir", t.sansMot.length, 0, t.sansMot.join(", "));

  // Au départ, très peu est ouvert.
  const d0 = await jeu("compteDebloque()");
  v("on commence avec une petite poignée", d0.ouverts < d0.total * 0.35,
    d0.ouverts + " sur " + d0.total);

  // Chaque condition s'ouvre pour la bonne raison.
  const c = await jeu(`(() => {
    sauterAge(4); etat.finances.solde = 400000;
    const R = etat.recherche;
    const dispo = id => optionDisponible(toutesOptions().find(o => o.id === id));
    const faux = { truffe: dispo('truffe'), fleur: dispo('fleur'), curry: dispo('curry'),
                   tandoori: dispo('tandoori'), or: dispo('or_comestible') };
    // deux recettes sorties, dont une qui pique
    R.recettes.push({ note:60, traits:{ gout:'paprika', coupe:'fine', cuisson:'friture',
                                        sel:'normal', texture:'standard', touche:'aucune', format:'familial' } });
    const apres1 = { fleur: dispo('fleur'), curry: dispo('curry') };
    R.recettes.push({ note:60, traits:{ gout:'curry', coupe:'fine', cuisson:'friture',
                                        sel:'normal', texture:'standard', touche:'aucune', format:'familial' } });
    const apres2 = { fleur: dispo('fleur'), tandoori: dispo('tandoori') };
    R.notoriete = 35;
    const apresNotoriete = { truffe: dispo('truffe'), or: dispo('or_comestible') };
    R.recettes.push({ note:88, traits:{ gout:'truffe', coupe:'fine', cuisson:'friture',
                                        sel:'normal', texture:'standard', touche:'aucune', format:'familial' } });
    const apresNote = { or: dispo('or_comestible') };
    return { faux, apres1, apres2, apresNotoriete, apresNote };
  })()`);
  v("rien de tout ça n'est ouvert au départ",
    !c.faux.truffe && !c.faux.fleur && !c.faux.curry && !c.faux.tandoori && !c.faux.or);
  v("une recette qui pique ouvre le curry", c.apres1.curry);
  v("mais pas encore la fleur de sel, qui en demande deux", !c.apres1.fleur);
  v("la deuxième recette ouvre la fleur de sel", c.apres2.fleur);
  v("avoir essayé le curry ouvre le tandoori", c.apres2.tandoori);
  v("la notoriété ouvre la truffe", c.apresNotoriete.truffe);
  v("mais l'or attend une recette à 85", !c.apresNotoriete.or && c.apresNote.or);

  // Ce qui vient de s'ouvrir est annoncé, et une seule fois.
  const n = await jeu(`(() => {
    verifierDeblocages(false);
    const rien = verifierDeblocages(false).length;
    etat.recherche.notoriete = 75;
    const neufs = verifierDeblocages(false).map(o => o.id);
    const encore = verifierDeblocages(false).length;
    return { rien, neufs, encore };
  })()`);
  v.egal("rien de neuf quand rien ne change", n.rien, 0);
  v("un palier de notoriété ouvre des ingrédients", n.neufs.length > 0, n.neufs.join(", "));
  v.egal("on ne l'annonce pas deux fois", n.encore, 0);

  // Le bac à sable ouvre tout, et une composition reste toujours valide.
  const bac = await jeu(`(() => {
    etat.meta.mode = 'bacASable'; etat.recherche.tout = false;
    const c = compteDebloque();
    brouillon = brouillonParDefaut();
    for (const a of AXES_RECETTE) brouillon.traits[a.cle] = a.options[a.options.length-1].id;
    etat.meta.mode = 'normal'; etat.recherche.tout = false; etat.recherche.notoriete = 0;
    etat.recherche.recettes = [];
    assainirBrouillon();
    const reste = optionsDe(brouillon.traits).filter(o => !optionDisponible(o)).length;
    return { tout: c.ouverts === c.total, reste, complet: optionsDe(brouillon.traits).length };
  })()`);
  v("le bac à sable ouvre tout le garde-manger", bac.tout);
  v.egal("un ingrédient refermé est remplacé, pas laissé en place", bac.reste, 0);
  v.egal("la composition reste complète", bac.complet, 7);

  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: d0.total + " ingrédients, " + t.accords + " accords" };
});

cas("bande-courte-et-quai", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();

  // Le tracé dessiné doit toucher le quai, pas partir de travers : un quai haut
  // a son centre loin du bout de bande, et c'est là que ça se voyait.
  const q = await jeu(`(() => {
    sauterAge(2); etat.finances.solde = 300000; remplirStocks();
    poserMachine('laveuse',5,3,0);
    const seg = (x1,y1,x2,y2)=>{const p=[];const dx=Math.sign(x2-x1),dy=Math.sign(y2-y1);
      let x=x1,y=y1;p.push({x,y});while(x!==x2||y!==y2){if(x!==x2)x+=dx;else y+=dy;p.push({x,y});}return p;};
    vue.traceConvoyeur = seg(2,4,4,4); validerTrace(); vue.traceConvoyeur = null;
    const c = U().convoyeurs[0], u = U(), r = cheminRendu(c);
    return { bordQuai: u.quaiEntree.x + u.quaiEntree.l, debut: r[0], fin: r[r.length-1],
             hautQuai: u.quaiEntree.h, source: c.source, dest: !!noeudParId(c.destination) };
  })()`);
  v.egal("la bande part bien du quai", q.source, 1);
  v("elle touche le bord du quai", Math.abs(q.debut.x - q.bordQuai) < 0.06,
    "x = " + q.debut.x.toFixed(2) + " pour un mur à " + q.bordQuai);
  v("et elle reste sur sa ligne", Math.abs(q.debut.y - 4.5) < 0.06, "y = " + q.debut.y.toFixed(2));
  v("elle touche la machine à l'autre bout", Math.abs(q.fin.x - 5) < 0.06, "x = " + q.fin.x.toFixed(2));

  // Une seule tuile entre deux machines : ça doit passer, et dans le bon sens.
  const c1 = await jeu(`(() => {
    poserMachine('trancheuse',8,3,0);
    const u = U();
    const lav = u.machines.find(m=>m.type==='laveuse'), tra = u.machines.find(m=>m.type==='trancheuse');
    vue.convDepart = { x:7, y:4, noeud: lav };
    vue.convArrivee = { x:7, y:4, noeud: tra };
    vue.traceConvoyeur = [{x:7,y:4}];
    const pose = validerTrace();
    vue.traceConvoyeur = null; vue.convDepart = null; vue.convArrivee = null;
    const c = u.convoyeurs[u.convoyeurs.length-1];
    return { pose, tuiles: c.chemin.length, etat: c.etat,
             src: nomNoeud(noeudParId(c.source)), dst: nomNoeud(noeudParId(c.destination)),
             rendu: cheminRendu(c).length };
  })()`);
  v("une bande d'une seule tuile se pose", c1.pose === true && c1.tuiles === 1);
  v.egal("elle prend à la laveuse", c1.src, "Laveuse-éplucheuse");
  v.egal("et donne à la trancheuse", c1.dst, "Trancheuse");
  v("elle est reliée des deux côtés", c1.etat !== "non_relie", c1.etat);
  v.aumoins("elle se dessine bien jusqu'aux deux machines", c1.rendu, 3);

  // Et la matière passe vraiment par ce raccord court.
  await jeu("acheter('pdt_brutes',2000); for(let i=0;i<3;i++) embaucher(creerCandidat());");
  await jeu("for (let t=0;t<CONFIG.ticksParJour*4;t++) simTick(); document.querySelector('#ecranVendredi')?.classList.remove('visible');");
  const prod = await jeu("Math.round(etat.progression.produits.rondelles||0)");
  v.aumoins("la matière traverse la bande courte", prod, 100);

  const inv = await jeu("verifierPartie()");
  for (const t of inv) v("invariant : " + t.nom, t.ok, t.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: prod + " kg via une bande d'une tuile" };
});

cas("croiser-ou-brancher", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();

  const r = await jeu(`(() => {
    sauterAge(3); etat.finances.solde = 400000; remplirStocks();
    const u = U();
    poserMachine('laveuse',4,2,0); poserMachine('trancheuse',10,2,0);
    poserMachine('friteuse',6,7,0); poserMachine('caisse',6,0,0);
    const seg = (x1,y1,x2,y2)=>{const p=[];const dx=Math.sign(x2-x1),dy=Math.sign(y2-y1);
      let x=x1,y=y1;p.push({x,y});while(x!==x2||y!==y2){if(x!==x2)x+=dx;else y+=dy;p.push({x,y});}return p;};
    vue.traceConvoyeur = seg(6,3,9,3); validerTrace(); vue.traceConvoyeur = null;
    const h = u.convoyeurs[u.convoyeurs.length-1];
    vue.convCroise = false;
    const contourne = routerConvoyeur({x:7,y:2},{x:7,y:6});
    vue.convCroise = true;
    const croise = routerConvoyeur({x:7,y:2},{x:7,y:6});
    const avant = etat.finances.solde;
    vue.traceConvoyeur = croise; vue.convDepart = null; vue.convArrivee = null;
    const pose = validerTrace();
    const cout = avant - etat.finances.solde;
    vue.traceConvoyeur = null; vue.convCroise = false;
    const vert = u.convoyeurs[u.convoyeurs.length-1];
    return { contourne: contourne && contourne.length, croise: croise && croise.length, pose, cout,
             ponts: vert.ponts, tuiles: vert.chemin.length, idH: h.id, idV: vert.id,
             sousLePont: occupant(u,7,3),
             hIntact: h.chemin.every(t => occupant(u,t.x,t.y) === h.id),
             relies: [vert.source, vert.destination].every(x => !!noeudParId(x)),
             croiseSansLien: vert.source !== h.id && vert.destination !== h.id };
  })()`);
  v("sans croisement, le tracé fait le tour", r.contourne > r.croise + 6,
    r.contourne + " tuiles contre " + r.croise);
  v.egal("en croisant, il va tout droit", r.croise, 5);
  v("la bande se pose", r.pose === true);
  v.egal("avec un pont", r.ponts.length, 1);
  v.egal("le pont est au croisement", r.ponts[0], "7,3");
  v.egal("la tuile reste à la bande du dessous", r.sousLePont, r.idH);
  v("la bande du dessous est intacte", r.hIntact);
  v("celle du dessus est reliée à ses deux bouts", r.relies);
  v("et surtout : croiser n'est pas se brancher", r.croiseSansLien);
  v.aumoins("un pont se paie", r.cout, 5*45 + 120);

  // La marchandise circule des deux côtés sans se mélanger.
  const flux = await jeu(`(() => {
    acheter('pdt_brutes',3000); for(let i=0;i<4;i++) embaucher(creerCandidat());
    for (let t=0;t<CONFIG.ticksParJour*4;t++) simTick();
    document.querySelector('#ecranVendredi')?.classList.remove('visible');
    const u = U();
    const h = u.convoyeurs[0], vert = u.convoyeurs[1];
    const items = c => [...new Set(c.transit.map(p => p.item))];
    return { surH: items(h), surV: items(vert),
             rondelles: Math.round(etat.progression.produits.rondelles||0) };
  })()`);
  v.aumoins("la ligne du dessous tourne", flux.rondelles, 100);
  v("rien de la bande du dessous ne se retrouve sur celle du dessus",
    !flux.surH.some(i => flux.surV.includes(i)) || !flux.surH.length || !flux.surV.length,
    "dessous " + flux.surH.join(",") + " · dessus " + flux.surV.join(","));

  // Démolir ce qui est dessous fait redescendre le pont.
  const bas = await jeu(`(() => {
    const u = U();
    demolir(u.convoyeurs[0], true);
    reindexer();
    const vert = u.convoyeurs[0];
    return { ponts: vert.ponts.length, grille: occupant(u,7,3) === vert.id };
  })()`);
  v.egal("le pont redescend quand il n'enjambe plus rien", bas.ponts, 0);
  v("et il reprend sa tuile", bas.grille);

  const inv = await jeu("verifierPartie()");
  for (const t of inv) v("invariant : " + t.nom, t.ok, t.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: "contourner " + r.contourne + " vs croiser " + r.croise };
});

cas("equipe-et-stocks", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();

  // Affecter tout le monde d'un coup : chacun sur le poste où il est le meilleur.
  const a = await jeu(`(() => {
    sauterAge(3); etat.finances.solde = 400000; remplirStocks();
    poserMachine('laveuse',4,3,0); poserMachine('trancheuse',9,3,0);
    poserMachine('friteuse',14,3,0); poserMachine('tambour',4,9,0);
    for (const o of U().ouvriers.slice()) licencier(o, true);
    for (let i=0;i<6;i++) embaucher(creerCandidat());
    const postes = machinesAOperer().length;
    const n = affecterAutomatiquement();
    const u = U();
    const assignes = u.ouvriers.filter(o => o.posteAssigne != null).map(o => o.posteAssigne);
    const uniques = new Set(assignes).size;
    const auPortage = u.ouvriers.filter(o => o.posteAssigne == null).length;
    return { postes, n, assignes: assignes.length, uniques, auPortage, equipe: u.ouvriers.length };
  })()`);
  v.egal("chaque machine reçoit quelqu'un", a.n, a.postes);
  v.egal("et personne n'est mis deux fois", a.uniques, a.assignes);
  v.egal("le reste part au portage", a.auPortage, a.equipe - a.n);

  // Le placement optimise vraiment ce qu'il annonce : la compétence, moins le
  // trajet. On le compare à une affectation prise dans l'ordre, sur le même
  // critère — sinon on mesure autre chose que ce que le code cherche.
  const comp = await jeu(`(() => {
    const u = U();
    const note = (o,m) => {
      const acces = tuileAcces(u, m, o.x, o.y);
      if (!acces) return -99;
      return 10*(o.competences[COMP_MACHINE[m.type]] ?? 0.5) -
             Math.hypot(acces.x - o.x, acces.y - o.y)*0.12;
    };
    const choisi = u.ouvriers.filter(o => o.posteAssigne != null)
                             .reduce((s,o) => s + note(o, noeudParId(o.posteAssigne)), 0);
    const postes = machinesAOperer();
    let ordre = 0;
    for (let i=0;i<postes.length;i++) ordre += note(u.ouvriers[i], postes[i]);
    return { choisi, ordre, n: postes.length };
  })()`);
  v("l'affectation vaut mieux qu'un tirage dans l'ordre",
    comp.choisi >= comp.ordre - 0.001,
    comp.choisi.toFixed(2) + " contre " + comp.ordre.toFixed(2));

  const lib = await jeu(`(() => { const n = libererTousLesPostes();
    return { n, restants: U().ouvriers.filter(o => o.posteAssigne != null).length }; })()`);
  v.aumoins("on peut tout libérer", lib.n, 1);
  v.egal("et il ne reste aucun poste fixe", lib.restants, 0);

  // Réapprovisionnement : seuil, lot, plafond, prix maximum.
  const st = await jeu(`(() => {
    const u = U();
    u.stocks = {};
    const r = reglerSurConsommation('pdt_brutes');
    r.actif = true; r.plafond = 800; r.prixMax = 0;
    const avant = etat.finances.solde;
    reapprovisionner();
    const apres1 = Math.round(stockDe('pdt_brutes'));
    // deuxième passage : le plafond doit borner
    ajouterStock('pdt_brutes', 0);
    reapprovisionner(); reapprovisionner();
    const apres2 = Math.round(stockDe('pdt_brutes'));
    return { seuil:r.seuil, lot:r.lot, plafond:r.plafond, apres1, apres2,
             depense: avant - etat.finances.solde };
  })()`);
  v("le réglage automatique donne un seuil et un lot sensés",
    st.seuil > 0 && st.lot > st.seuil, st.seuil + " / " + st.lot);
  v("la première recommande arrive", st.apres1 > 0 && st.apres1 <= st.plafond,
    st.apres1 + " livrés pour un lot de " + st.lot + " et un plafond de " + st.plafond);
  v("le plafond borne le stock", st.apres2 <= st.plafond, st.apres2 + " pour un plafond de " + st.plafond);
  v.aumoins("et ça se paie", st.depense, 1);

  const cher = await jeu(`(() => {
    const u = U(); u.stocks = {};
    const r = etat.reappro['pdt_brutes'];
    r.plafond = 0; r.prixMax = prixAchat('pdt_brutes') * 0.5;   // limite sous le cours
    const avant = Math.round(stockDe('pdt_brutes'));
    reapprovisionner();
    const bloque = Math.round(stockDe('pdt_brutes'));
    r.prixMax = prixAchat('pdt_brutes') * 2;
    reapprovisionner();
    return { avant, bloque, passe: Math.round(stockDe('pdt_brutes')) };
  })()`);
  v.egal("au-dessus du prix maximum, on n'achète pas", cher.bloque, cher.avant);
  v.aumoins("en dessous, la livraison arrive", cher.passe, 1);

  const auto = await jeu(`(() => {
    U().stocks = {}; ajouterStock('pdt_brutes', 10);
    return { faible: autonomieDe('pdt_brutes') < 1, jour: uneJourneeDe('pdt_brutes') > 0 };
  })()`);
  v("l'autonomie se lit en jours", auto.faible && auto.jour);

  const inv = await jeu("verifierPartie()");
  for (const t of inv) v("invariant : " + t.nom, t.ok, t.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: a.n + " postes placés, seuils réglés" };
});

cas("quai-de-sortie", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();

  // Le geste du joueur, dans les deux sens, sur les deux quais.
  const r = await jeu(`(() => {
    sauterAge(2); etat.finances.solde = 300000; remplirStocks();
    const u = U(), qs = u.quaiSortie, qe = u.quaiEntree;
    poserMachine('ensacheuse', qs.x-6, qs.y, 0);
    const m = u.machines[u.machines.length-1];
    const clic = (x,y,vers) => ancrageConvoyeur(x, y, vers);
    const aS = clic(qs.x, qs.y+1, { x:m.x, y:m.y });
    const aE = clic(qe.x, qe.y+1, { x:m.x, y:m.y });
    // machine -> quai de sortie, par le tracé automatique
    vue.outil = { type:"convoyeur" };
    vue.convDepart = clic(m.x+1, m.y+1, { x:qs.x, y:qs.y });
    majApercuConvoyeur(qs.x, qs.y+1);
    const trace = vue.traceConvoyeur;
    const pose = validerTrace();
    const c = u.convoyeurs[u.convoyeurs.length-1];
    annulerTrace();
    return { ancreSortie: !!(aS && aS.noeud && aS.noeud.id === 2),
             ancreEntree: !!(aE && aE.noeud && aE.noeud.id === 1),
             surLaTuile: !!noeudSous(qs.x, qs.y+1),
             trace: !!trace, pose,
             src: c && c.source, dst: c && c.destination, etat: c && c.etat,
             nomSortie: nomNoeud(noeudParId(2)), nomEntree: nomNoeud(noeudParId(1)) };
  })()`);
  v("cliquer sur le quai de sortie l'accroche", r.ancreSortie);
  v("cliquer sur le quai d'entrée aussi", r.ancreEntree);
  v("le quai de sortie répond quand on le survole", r.surLaTuile);
  v("le tracé se calcule jusqu'à lui", r.trace && r.pose === true);
  v.egal("et la bande le prend pour destination", r.dst, 2);
  v("elle est reliée", r.etat !== "non_relie", r.etat);
  v("les deux quais se nomment différemment", r.nomSortie !== r.nomEntree,
    r.nomEntree + " / " + r.nomSortie);

  // Et la marchandise y arrive vraiment.
  const flux = await jeu(`(() => {
    const u = U();
    const m = u.machines.find(x => x.type === 'ensacheuse');
    ajouterStock('chips_assaisonnees', 400); ajouterStock('film', 200);
    m.entree = { chips_assaisonnees: 80, film: 8 };
    for (let i=0;i<3;i++) embaucher(creerCandidat());
    let arrive = 0;
    for (let t=0;t<CONFIG.ticksParJour*2;t++){
      const avant = stockDe('sachet');
      simTick();
      arrive += Math.max(0, stockDe('sachet') - avant);
    }
    document.querySelector('#ecranVendredi')?.classList.remove('visible');
    return { arrive: Math.round(arrive), pool: Math.round(u.stocksSortie.sachet||0) };
  })()`);
  v.aumoins("des sachets arrivent bien au quai de sortie", flux.arrive, 1);

  // Cliquer sur un quai doit ouvrir la fiche de CE quai-là.
  const clic = await jeu(`(() => {
    const u = U();
    const sel = q => { vue.selection = noeudSous(q.x, q.y+1).id; vue.ongletActif = "detail";
                       majOnglets(); majPanneau();
                       return { id: vue.selection,
                                titre: document.querySelector('#contenuPanneau .titrePan').textContent }; };
    return { sortie: sel(u.quaiSortie), entree: sel(u.quaiEntree) };
  })()`);
  v.egal("cliquer sur le quai de sortie le sélectionne", clic.sortie.id, 2);
  v.egal("et ouvre sa fiche", clic.sortie.titre, "Quai de sortie");
  v.egal("cliquer sur le quai d'entrée le sélectionne", clic.entree.id, 1);
  v.egal("et ouvre la sienne", clic.entree.titre, "Quai d'entrée");

  // Un quai n'accepte que ce qui lui revient : plus de marchandise qui se
  // téléporte d'un quai à l'autre sans qu'on comprenne pourquoi.
  const tri = await jeu(`(() => {
    const u = U();
    const S = noeudParId(2), E = noeudParId(1);
    const avant = Math.round(u.stocks.rondelles||0);
    livrer(S, 'sachet', 10);
    const place = { rondellesVersSortie: placeEntree(S,'rondelles'),
                    sachetsVersSortie: placeEntree(S,'sachet') > 0,
                    patatesVersEntree: placeEntree(E,'pdt_brutes') > 0,
                    sachetsVersEntree: placeEntree(E,'sachet') };
    return Object.assign(place, { rondellesRestees: Math.round(u.stocks.rondelles||0) - avant,
                                  explication: pourquoiRienAVendre().length > 20 });
  })()`);
  v.egal("le quai de sortie refuse un en-cours", tri.rondellesVersSortie, 0);
  v("il accepte le produit fini", tri.sachetsVersSortie);
  v("le quai d'entrée accepte la matière", tri.patatesVersEntree);
  v.egal("et refuse le produit fini", tri.sachetsVersEntree, 0);
  v.egal("rien ne se téléporte vers l'autre quai", tri.rondellesRestees, 0);
  v("un quai de sortie vide explique pourquoi", tri.explication);

  const inv = await jeu("verifierPartie()");
  for (const t of inv) v("invariant : " + t.nom, t.ok, t.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: flux.arrive + " sachets livrés au quai" };
});

cas("marque-et-marches", async (nav) => {
  const { page, jeu, sim, erreurs } = await contexte(nav);
  const v = verif();

  // Les trois jauges existent et se lisent au même endroit.
  const j = await jeu(`({ notoriete: notoriete(), confiance: confiance(), standing: standing(),
                          reputation: etat.reputation, depart: CONFIG.standingDepart })`);
  v.egal("la confiance est bien la réputation", j.confiance, j.reputation);
  v.egal("le standing démarre au milieu", Math.round(j.standing), j.depart);
  v.egal("et la notoriété à zéro", Math.round(j.notoriete), 0);

  // Le sachet et le logo pilotent le standing visé, dans le bon sens.
  const st = await jeu(`(() => {
    const m = etat.marque;
    const pose = (logo,fond,motif,style) => { m.logo=logo; m.fond=fond; m.motif=motif; m.styleNom=style;
                                              return Math.round(cibleStanding()); };
    const chic = pose('blason','bordeaux','kraft','serif');
    const discount = pose('eclair','orange','eclats','pochoir');
    const neutre = pose('etoile','jaune','uni','batons');
    return { chic, discount, neutre };
  })()`);
  v("un sachet chic vise le haut de gamme", st.chic >= 85, String(st.chic));
  v("un sachet criard vise le bas", st.discount <= 20, String(st.discount));
  v("et un sachet neutre reste au milieu", st.neutre > 25 && st.neutre < 60, String(st.neutre));

  // Le standing ne saute pas : il met des semaines.
  const lent = await jeu(`(() => {
    const m = etat.marque;
    m.logo='blason'; m.fond='bordeaux'; m.motif='kraft'; m.styleNom='serif';
    m.standing = 40;
    const suite = [];
    for (let i=0;i<6;i++){ majStanding(semaineVierge()); suite.push(Math.round(m.standing)); }
    return { suite, cible: Math.round(cibleStanding()) };
  })()`);
  v("il monte progressivement", lent.suite[0] < lent.suite[1] && lent.suite[1] < lent.suite[3],
    lent.suite.join(" → "));
  v("sans jamais dépasser sa cible", Math.max(...lent.suite) <= lent.cible + 1,
    lent.suite.join(" → ") + " pour une cible de " + lent.cible);

  // Les marchés lisent les jauges chacun à leur façon — et se contredisent.
  const mar = await jeu(`(() => {
    sauterAge(4);
    const m = etat.marque;
    const test = (not, conf, sta) => {
      etat.recherche.notoriete = not; etat.reputation = conf; m.standing = sta;
      return paliersOuverts().map(p => p.id);
    };
    return { debut:   test(0, 50, 42),
             chic:    test(30, 70, 92),
             volume:  test(60, 80, 45),
             raisons: { national: motPalier(palierParId('national')),
                        fine: motPalier(palierParId('fine')) } };
  })()`);
  v("au départ, seul le coin est ouvert", mar.debut.join(",") === "local", mar.debut.join(","));
  v("en haut de gamme, l'épicerie fine s'ouvre", mar.chic.includes("fine"));
  v("et le national se ferme — on ne peut pas être les deux",
    !mar.chic.includes("national"), mar.chic.join(","));
  v("en gamme moyenne et connu, le national s'ouvre", mar.volume.includes("national"));
  v("mais l'épicerie fine se ferme", !mar.volume.includes("fine"), mar.volume.join(","));
  v("et le refus s'explique en français", /gamme/.test(mar.raisons.fine), mar.raisons.fine);

  // Un palier ouvert paie selon ce à quoi il tient.
  const prix = await jeu(`(() => {
    etat.recherche.notoriete = 30; etat.reputation = 70; etat.marque.standing = 92;
    const fine = primePalier(palierParId('fine'));
    etat.recherche.notoriete = 60; etat.reputation = 80; etat.marque.standing = 45;
    const nat = primePalier(palierParId('national'));
    return { fine, nat };
  })()`);
  v("l'épicerie fine paie au-dessus du courant", prix.fine > 1.05, prix.fine.toFixed(2));
  v("la centrale paie moins", prix.nat < prix.fine, prix.nat.toFixed(2));

  // Les clients viennent du palier ouvert, jamais d'un autre.
  const cl = await jeu(`(() => {
    etat.recherche.notoriete = 0; etat.reputation = 50; etat.marque.standing = 42;
    const paliers = new Set();
    for (let i=0;i<40;i++) paliers.add(creerContrat('sachet').palier);
    return [...paliers];
  })()`);
  v.egal("au départ, tous les clients sont locaux", cl.join(","), "local");

  // Le logo et le sachet se dessinent sans erreur, pour toutes les formes.
  const dess = await jeu(`(() => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 240;
    const g = c.getContext('2d');
    let n = 0;
    for (const l of LOGOS)
      for (const f of FONDS_SACHET.slice(0,2))
        for (const mo of MOTIFS_SACHET){
          const m = Object.assign({}, etat.marque, { logo:l.id, fond:f.id, motif:mo.id });
          dessinerSachet(g, m, 10, 10, 120, 160, "Une recette au nom très long");
          n++;
        }
    return n;
  })()`);
  v.aumoins("tous les sachets se dessinent", dess, 90);

  const inv = await jeu("verifierPartie()");
  for (const t of inv) v("invariant : " + t.nom, t.ok, t.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: 5 + " marchés, " + dess + " sachets dessinés" };
});

cas("labels", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();

  // Rien ne se déclenche tout seul, et rien ne coûte avant qu'on le demande.
  const d0 = await jeu(`(() => {
    const avant = etat.finances.solde;
    for (let i=0;i<8;i++) majLabels();
    return { obtenus: etat.labels.obtenus.length, depense: avant - etat.finances.solde,
             dispoAge1: LABELS.filter(labelDisponible).length };
  })()`);
  v.egal("aucun label à l'âge 1", d0.dispoAge1, 0);
  v.egal("donc aucun obtenu", d0.obtenus, 0);
  v.egal("et rien de dépensé", Math.round(d0.depense), 0);

  // La condition se mesure, et elle se tient dans le temps.
  const t = await jeu(`(() => {
    sauterAge(3); etat.finances.solde = 200000;
    poserMachine('friteuse',5,4,0);
    const u = U();
    u.salete = 0.05;
    const f = u.machines.find(m => m.type === 'friteuse');
    f.fraicheurHuile = 0.95; f.usure = 0.1;
    const suite = [];
    for (let i=0;i<2;i++){ majLabels(); suite.push(labelEnCours('huile')); }
    const pretAvant = demanderAudit('huile');   // deux semaines sur trois : trop tôt
    const avant = etat.finances.solde;
    majLabels();
    const pret = labelEnCours('huile');
    const ok = demanderAudit('huile');
    return { suite, pret, ok, obtenu: labelObtenu('huile'),
             cout: avant - etat.finances.solde, tropTot: pretAvant,
             mesure: mesureLabel('huile') };
  })()`);
  v.egal("le compteur monte d'une semaine à la fois", t.suite.join(","), "1,2");
  v("la condition se lit en clair", /%/.test(t.mesure.dit), t.mesure.dit);
  v("l'audit est refusé avant l'heure", t.tropTot === false);
  v("puis accepté", t.ok === true && t.obtenu === true);
  v.aumoins("et il se paie", t.cout, 2800);

  // Ce qu'un label rapporte, et ce qu'il coûte chaque semaine.
  const eff = await jeu(`(() => {
    const st = bonusStandingLabels(), cf = bonusConfianceLabels();
    const avant = etat.finances.solde;
    majLabels();
    return { st, cf, hebdo: Math.round(avant - etat.finances.solde), prime: primeLabels() };
  })()`);
  v.aumoins("le standing en profite", eff.st, 10);
  v.aumoins("la confiance aussi", eff.cf, 3);
  v.aumoins("et l'entretien se prélève chaque semaine", eff.hebdo, 160);

  // Il se perd le jour où on ne le tient plus.
  const perdu = await jeu(`(() => {
    const f = U().machines.find(m => m.type === 'friteuse');
    f.fraicheurHuile = 0.2;
    majLabels();
    return { obtenu: labelObtenu('huile'), suite: labelEnCours('huile'), standing: bonusStandingLabels() };
  })()`);
  v("l'huile fatiguée fait perdre le label", !perdu.obtenu);
  v.egal("et le compteur repart de zéro", perdu.suite, 0);
  v.egal("le bonus de standing disparaît avec lui", perdu.standing, 0);

  // Le local coûte vraiment plus cher.
  const loc = await jeu(`(() => {
    const nu = prixAchat('pdt_brutes');
    etat.labels.local = true;
    const cher = prixAchat('pdt_brutes');
    etat.labels.local = false;
    const film = { nu: prixAchat('film'), sel: prixAchat('sel') };
    etat.labels.local = true;
    film.cher = prixAchat('film'); film.selCher = prixAchat('sel');
    etat.labels.local = false;
    return { nu, cher, film };
  })()`);
  v("la matière locale coûte 12 % de plus", Math.abs(loc.cher/loc.nu - 1.12) < 0.01,
    loc.nu.toFixed(2) + " → " + loc.cher.toFixed(2));
  v.egal("mais pas l'emballage, qui ne pousse pas", loc.film.cher, loc.film.nu);
  v.egal("ni le sel, qui se ramasse", loc.film.selCher, loc.film.sel);

  // L'export exige l'atelier certifié, et le dit.
  const exp = await jeu(`(() => {
    sauterAge(4);
    etat.recherche.notoriete = 90; etat.reputation = 95; etat.marque.standing = 50;
    etat.labels.obtenus = [];
    const sans = palierOuvert(palierParId('export'));
    const dit = motPalier(palierParId('export'));
    etat.labels.obtenus = ['atelier'];
    return { sans, avec: palierOuvert(palierParId('export')), dit };
  })()`);
  v("sans atelier certifié, pas d'export", exp.sans === false);
  v("avec, il s'ouvre", exp.avec === true);
  v("et le refus le disait", /certifié/.test(exp.dit), exp.dit);

  const inv = await jeu("verifierPartie()");
  for (const t2 of inv) v("invariant : " + t2.nom, t2.ok, t2.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: 4 + " labels, gagnés et perdus" };
});

cas("le-concurrent", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();

  const r0 = await jeu(`({ nom: etat.rival.nom, part: partMarche(),
                           dansLaTable: RIVAUX.some(x => x.nom === etat.rival.nom) })`);
  v("un concurrent existe dès le départ", !!r0.nom, r0.nom);
  v("il sort de la table", r0.dansLaTable);
  v("le rayon est partagé", r0.part > 0.15 && r0.part < 0.9, Math.round(r0.part*100) + " %");

  // Notre part suit nos jauges, dans le bon sens.
  const p = await jeu(`(() => {
    sauterAge(3);
    const set = (n,c,s) => { etat.recherche.notoriete=n; etat.reputation=c; etat.marque.standing=s;
                             return partMarche(); };
    etat.rival.notoriete = 40; etat.rival.confiance = 60; etat.rival.standing = 50;
    return { faible: set(5, 30, 42), fort: set(90, 95, 55) };
  })()`);
  v("une marque faible pèse peu dans le rayon", p.faible < 0.45, Math.round(p.faible*100) + " %");
  v("une marque forte pèse plus", p.fort > p.faible + 0.15,
    Math.round(p.faible*100) + " % → " + Math.round(p.fort*100) + " %");

  // Il se démarque : on monte, il descend.
  const d = await jeu(`(() => {
    etat.marque.standing = 90; etat.rival.standing = 80;
    for (let i=0;i<10;i++) majRival();
    const bas = etat.rival.standing;
    etat.marque.standing = 20;
    for (let i=0;i<10;i++) majRival();
    return { bas, haut: etat.rival.standing };
  })()`);
  v("face à une marque chic, il descend en gamme", d.bas < 50, Math.round(d.bas));
  v("face à une marque discount, il monte", d.haut > d.bas + 15,
    Math.round(d.bas) + " → " + Math.round(d.haut));

  // Ses coups arrivent, et laissent une trace lisible.
  const c = await jeu(`(() => {
    const faits = [];
    for (let i=0;i<60;i++){
      const av = etat.stats.semaineCourante.faits.length;
      majRival();
      if (etat.stats.semaineCourante.faits.length > av)
        faits.push(etat.stats.semaineCourante.faits[etat.stats.semaineCourante.faits.length-1]);
    }
    return { n: faits.length, exemple: faits[0] || "",
             borne: etat.rival.notoriete <= 100 && etat.rival.confiance >= 20 };
  })()`);
  v.aumoins("il fait parler de lui", c.n, 5);
  v("et chaque coup se lit en français", /\w+ \w+/.test(c.exemple), c.exemple);
  v("ses jauges restent dans les clous", c.borne);

  // Le rayon décide de ce que les commerces paient et de ce qu'on nous propose.
  const eff = await jeu(`(() => {
    const mesure = () => {
      const u = U(); u.stocksSortie = {}; ajouterStock('chips_vrac', 100);
      const avant = etat.finances.solde;
      etat.venteAuto = true; vendreSurplus();
      return Math.round(etat.finances.solde - avant);
    };
    etat.recherche.notoriete = 5; etat.reputation = 30; etat.marque.standing = 42;
    etat.rival.notoriete = 90; etat.rival.confiance = 95; etat.rival.standing = 50;
    const petit = mesure(), partPetite = partMarche();
    etat.recherche.notoriete = 95; etat.reputation = 95; etat.marque.standing = 55;
    etat.rival.notoriete = 20; etat.rival.confiance = 40;
    const gros = mesure(), partGrosse = partMarche();
    return { petit, gros, partPetite, partGrosse };
  })()`);
  v("une marque écrasée vend moins cher au comptant", eff.gros > eff.petit,
    eff.petit + " € contre " + eff.gros + " €");
  v("et sa part de rayon le disait", eff.partGrosse > eff.partPetite);

  const inv = await jeu("verifierPartie()");
  for (const t of inv) v("invariant : " + t.nom, t.ok, t.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: r0.nom + ", " + c.n + " coups en 60 semaines" };
});

cas("clients-et-cadres", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();

  // Un client se souvient : la série monte, la fidélité avec.
  const f = await jeu(`(() => {
    sauterAge(3); etat.finances.solde = 300000;
    const n = "Épicerie Vidal";
    const suite = [];
    for (let i=0;i<7;i++){ ficheClient(n).serie = i; suite.push(fidelite(n)); }
    ficheClient(n).serie = 6;
    return { suite, mot: motFidelite(n), plafond: fidelite(n) };
  })()`);
  v.egal("la fidélité monte par paliers", f.suite.join(","), "0,0,1,1,2,2,3");
  v.egal("et plafonne", f.plafond, 3);
  v("elle se dit en français", /fidèle/.test(f.mot), f.mot);

  // Un client fidèle propose plus gros et paie mieux.
  const gros = await jeu(`(() => {
    const n = "Épicerie Vidal";
    const moyenne = () => {
      let q = 0, p = 0, k = 0;
      for (let i=0;i<400;i++){
        const c = creerContrat('chips_vrac');
        if (c.client !== n) continue;
        q += c.quantite; p += c.prixUnitaire; k++;
      }
      return { q: q/Math.max(1,k), p: p/Math.max(1,k), k };
    };
    for (const x in etat.stats.clients) etat.stats.clients[x].serie = 0;
    const froid = moyenne();
    ficheClient(n).serie = 6;
    const chaud = moyenne();
    return { froid, chaud };
  })()`);
  v("un client fidèle commande plus gros", gros.chaud.q > gros.froid.q * 1.3,
    Math.round(gros.froid.q) + " → " + Math.round(gros.chaud.q));
  v("et il revient plus souvent", gros.chaud.k > gros.froid.k, gros.froid.k + " → " + gros.chaud.k);
  v("il paie un peu mieux", gros.chaud.p >= gros.froid.p, gros.froid.p + " → " + gros.chaud.p);

  // Déçu deux fois, il s'en va — et ne repropose plus rien.
  const parti = await jeu(`(() => {
    const n = "Halles de Villebourg";
    const fc = ficheClient(n);
    fc.serie = 5; fc.ratees = 1;
    fc.serie = 0; fc.ratees = 2; fc.bouderie = 6;
    let vu = 0;
    for (let i=0;i<300;i++) if (creerContrat('chips_vrac').client === n) vu++;
    const apres = (() => { for (let k=0;k<6;k++) majClients(); return ficheClient(n).bouderie; })();
    let revenu = 0;
    for (let i=0;i<300;i++) if (creerContrat('chips_vrac').client === n) revenu++;
    return { vu, apres, revenu, mot: (fc.bouderie = 3, motFidelite(n)) };
  })()`);
  v.egal("un client fâché ne propose plus rien", parti.vu, 0);
  v.egal("la fâcherie s'apaise avec le temps", parti.apres, 0);
  v.aumoins("et il revient", parti.revenu, 1);
  v("le panneau le dit", /fâché/.test(parti.mot), parti.mot);

  // Les cadres : un bureau chacun, et un effet mesurable.
  const c = await jeu(`(() => {
    const u = U();
    for (const m of u.machines.filter(m => m.type === 'bureau')) demolir(m, true);
    const sansBureau = { libres: bureauxLibres() };
    poserMachine('bureau',-4,2,0); poserMachine('bureau',-4,7,0);
    const avant = bureauxLibres();
    etat.cadres = ['commercial'];
    const apres = bureauxLibres();
    // le commercial pèse sur le nombre d'offres et sur les prix
    const prixSans = (() => { etat.cadres = []; let p=0; for (let i=0;i<200;i++) p += creerContrat('chips_vrac').prixUnitaire; return p/200; })();
    etat.cadres = ['commercial'];
    const prixAvec = (() => { let p=0; for (let i=0;i<200;i++) p += creerContrat('chips_vrac').prixUnitaire; return p/200; })();
    return { sansBureau, avant, apres, prixSans, prixAvec };
  })()`);
  v.egal("sans bureau, aucun n'est libre", c.sansBureau.libres, 0);
  v.egal("deux bureaux, deux libres", c.avant, 2);
  v.egal("un cadre en occupe un", c.apres, 1);
  v("le commercial fait monter les prix signés", c.prixAvec > c.prixSans,
    c.prixSans.toFixed(1) + " → " + c.prixAvec.toFixed(1));

  // Le responsable qualité fait vraiment baisser le rebut.
  const q = await jeu(`(() => {
    poserMachine('friteuse',8,4,0);
    const m = U().machines.find(x => x.type === 'friteuse');
    m.fraicheurHuile = 0.3; m.usure = 0.5;
    etat.cadres = [];
    const sans = tauxRebut(m, null);
    etat.cadres = ['qualite'];
    const avec = tauxRebut(m, null);
    return { sans, avec };
  })()`);
  v("le responsable qualité écarte un quart du rebut",
    q.avec < q.sans * 0.8, (q.sans*100).toFixed(1) + " % → " + (q.avec*100).toFixed(1) + " %");

  // Un cadre coûte tous les jours, et le marketing travaille tout seul.
  const s2 = await jeu(`(() => {
    etat.cadres = ['commercial','qualite'];
    const avant = etat.finances.solde;
    finJournee();
    document.querySelector('#ecranVendredi')?.classList.remove('visible');
    const coutJour = avant - etat.finances.solde;
    etat.cadres = ['marketing'];
    etat.recherche.notoriete = 10;
    majCadres();
    const n1 = etat.recherche.notoriete;
    return { coutJour, monte: n1 > 10 };
  })()`);
  v.aumoins("deux cadres coûtent leur salaire chaque jour", s2.coutJour, 440);
  v("le marketing fait monter la notoriété tout seul", s2.monte);

  const inv = await jeu("verifierPartie()");
  for (const t of inv) v("invariant : " + t.nom, t.ok, t.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: "fidélité, bouderie, 3 cadres" };
});

cas("la-fin", async (nav) => {
  const { page, jeu, erreurs } = await contexte(nav);
  const v = verif();

  // Les cinq âges s'enchaînent vraiment : l'âge 4 était inatteignable en jeu.
  const ch = await jeu(`(() => {
    etat.finances.solde = 500000;
    const suite = [etat.meta.age];
    // âge 1 → 2
    etat.progression.vendus.chips_vrac = 99999; verifierObjectif(); suite.push(etat.meta.age);
    // âge 2 → 3
    etat.progression.produitsSemaine.sachet = 99999; verifierObjectif(); suite.push(etat.meta.age);
    // âge 3 → 4
    etat.progression.compteurs.grosseCommande = 5; verifierObjectif(); suite.push(etat.meta.age);
    // âge 4 → 5
    etat.progression.compteurs.recetteReussie = 5; verifierObjectif(); suite.push(etat.meta.age);
    for (const id of ['#ecranMenu','#ecranVendredi']) document.querySelector(id)?.classList.remove('visible');
    return { suite, termine: !!etat.progression.termine };
  })()`);
  v.egal("les cinq âges s'enchaînent", ch.suite.join("→"), "1→2→3→4→5");
  v("et l'âge 5 n'est pas la fin tout de suite", !ch.termine);

  // Le dernier objectif se lit sur la marque, pas sur des kilos.
  const c = await jeu(`(() => {
    const depart = conditionsMaison();
    etat.recherche.notoriete = 85; etat.reputation = 90;
    etat.rival.notoriete = 5; etat.rival.confiance = 30; etat.rival.standing = 50;
    etat.marque.standing = 55;
    etat.labels.obtenus = [];
    const presque = conditionsMaison();
    etat.labels.obtenus = ['atelier'];
    const toutes = conditionsMaison();
    return { depart: depart.map(x=>x.ok), presque: presque.map(x=>x.ok), toutes: toutes.map(x=>x.ok),
             noms: toutes.map(x=>x.nom), dit: depart[0].dit,
             part: progressionObjectif() };
  })()`);
  v.egal("quatre conditions", ch.suite.length && c.noms.length, 4);
  v("aucune n'est remplie au départ", c.depart.every(x => !x));
  v("le label manque encore", c.presque.filter(x=>x).length === 3, c.presque.join(","));
  v("puis tout est là", c.toutes.every(Boolean));
  v("chaque condition dit où l'on en est", /sur 100/.test(c.dit), c.dit);
  v.egal("la jauge d'objectif suit les conditions", c.part.cible, 4);

  // Tout réuni : l'épilogue s'ouvre et dit ce qu'est devenue la maison.
  const fin = await jeu(`(() => {
    etat.marque.nom = "Croq'Bassin";
    etat.recherche.recettes.push({ id:'x', nom:'Sardine du Port', note:94, traits:{}, avis:[], pistes:[] });
    etat.stats.clients['Épicerie Vidal'] = { ca:12000, commandes:9, reclamations:0, serie:6, ratees:0, bouderie:0 };
    verifierObjectif();
    const z = document.querySelector('#ecranEpilogue');
    return { visible: z.classList.contains('visible'),
             termine: !!etat.progression.termine,
             nom: document.querySelector('#epiNom')?.textContent,
             mention: document.querySelector('#epiMention')?.textContent || "",
             tuiles: document.querySelectorAll('.epiTuile').length,
             lignes: [...document.querySelectorAll('.epiLigne')].map(l => l.children[0].textContent),
             vitesse: etat.meta.vitesse };
  })()`);
  v("l'épilogue s'ouvre", fin.visible && fin.termine);
  v.egal("il porte le nom de la marque", fin.nom, "Croq'Bassin");
  v("il résume la partie en une phrase", fin.mention.length > 25, fin.mention);
  v.egal("quatre chiffres", fin.tuiles, 4);
  v("il cite la meilleure recette", fin.lignes.includes("Votre meilleure recette"), fin.lignes.join(" · "));
  v("le meilleur client", fin.lignes.includes("Votre meilleur client"));
  v("le concurrent", fin.lignes.includes("En face"));
  v.egal("et le jeu s'arrête pour qu'on lise", fin.vitesse, 0);

  // On ne rejoue pas la fin en boucle.
  const encore = await jeu(`(() => {
    document.querySelector('#ecranEpilogue').classList.remove('visible');
    verifierObjectif();
    return document.querySelector('#ecranEpilogue').classList.contains('visible');
  })()`);
  v("elle ne se rouvre pas toute seule", !encore);

  const inv = await jeu("verifierPartie()");
  for (const t of inv) v("invariant : " + t.nom, t.ok, t.detail);
  await page.close();
  return { echecs: v.echecs.concat(erreurs), note: "5 âges, 4 conditions, épilogue" };
});

/* ============================================================== Exécution ==*/
const filtre = process.argv.slice(2);
const choisis = filtre.length ? CAS.filter(c => filtre.some(f => c.nom.includes(f))) : CAS;

const nav = await chromium.launch();
let rates = 0;
console.log("\n  Cadence — " + choisis.length + " cas\n");
for (const c of choisis){
  const t0 = Date.now();
  let r;
  try { r = await c.fn(nav); }
  catch (e){ r = { echecs: ["exception : " + e.message] }; }
  const s = ((Date.now()-t0)/1000).toFixed(1) + "s";
  if (r.echecs.length){
    rates++;
    console.log("  ✗ " + c.nom.padEnd(22) + s);
    for (const e of r.echecs) console.log("      " + e);
  } else {
    console.log("  ✓ " + c.nom.padEnd(22) + s.padEnd(7) + (r.note || ""));
  }
}
await nav.close();
console.log("\n  " + (rates ? rates + " cas en échec sur " + choisis.length
                             : choisis.length + " cas, tout est vert") + "\n");
process.exit(rates ? 1 : 0);
