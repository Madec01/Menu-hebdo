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
    for (const k in U().stocks) add(k, U().stocks[k]);
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
    return { huile: f.fraicheurHuile, arret, pendant, taux: tauxRebut(f, op) };
  })()`);
  v("le bain repart quasi neuf", apres.huile > 0.65, "fraîcheur " + apres.huile.toFixed(2));
  v.egal("la friteuse s'arrête pendant la vidange", apres.pendant, "arret");
  v("la qualité remonte", apres.taux < r.taux, apres.taux.toFixed(3) + " vs " + r.taux.toFixed(3));

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
const AGES_ATTENDUS = ["12x10","20x16","32x24","48x36","48x36"];

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

  // La note doit dépendre de la composition, pas du hasard seul.
  const notes = await jeu(`(() => {
    const bonne = { gout:'truffe', coupe:'gaufrette', cuisson:'huile_olive', sel:'normal', format:'familial' };
    const mauvaise = { gout:'truffe', coupe:'allumette', cuisson:'four', sel:'bien', format:'maxi' };
    return { bonne: noteRecette(bonne,0).note, mauvaise: noteRecette(mauvaise,0).note,
             accordsB: accordsDe(bonne).length, accordsM: accordsDe(mauvaise).filter(a=>a.delta<0).length };
  })()`);
  v("une recette bien accordée note mieux qu'une recette bancale",
    notes.bonne > notes.mauvaise + 15, notes.bonne + " contre " + notes.mauvaise);
  v.aumoins("les bons accords se déclenchent", notes.accordsB, 2);
  v.aumoins("les mauvais accords aussi", notes.accordsM, 2);

  // Une étude coûte, prend du temps, puis sort.
  const etude = await jeu(`(() => {
    const t = { gout:'oignon_creme', coupe:'ondulee', cuisson:'chaudron', sel:'normal', format:'familial' };
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
