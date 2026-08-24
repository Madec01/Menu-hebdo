/* =====================================================================
   ARCHITECTE LOGIQUE — harnais de test headless (3/3 : les tests)
   Concaténé APRÈS le <script> du jeu : même portée de script, donc accès
   direct à components / wires / missions / simulate / loadMission…
   ===================================================================== */

/* ---------------- micro-framework ---------------- */
var __pass = 0, __fail = 0, __failures = [], __curT = '';
function T(name, fn){
  __curT = name;
  try { fn(); console.log('  ✓ ' + name); __pass++; }
  catch (e){
    console.log('  ✗ ' + name + '\n      ' + (e && e.message || e));
    if (e && e.stack && !/^Assertion/.test(String(e.message)))
      console.log('      ' + e.stack.split('\n').slice(1, 3).join('\n      '));
    __fail++; __failures.push(name);
  }
}
function fail(msg){ const e = new Error(msg); e.message = msg; throw e; }
function ok(cond, msg){ if (!cond) fail('Assertion : ' + (msg || 'condition fausse')); }
function eq(got, want, msg){
  if (got !== want) fail('Assertion : ' + (msg || '') + ' — attendu ' + JSON.stringify(want) +
    ', obtenu ' + JSON.stringify(got));
}
function deq(got, want, msg){
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) fail('Assertion : ' + (msg || '') + ' — attendu ' + b + ', obtenu ' + a);
}

/* ---------------- utilitaires de plateau ---------------- */
let __y = 0;
function board(){
  loadMission(-1);
  components = []; wires = [];
  selection.clear();
  localStorage.removeItem('al2_sandbox');
  undoStack = [snapshotState()]; redoStack = []; undoT = 0;
  __y = 0;
}
function mk(type, x, y){
  const c = new Component(x != null ? x : 0, y != null ? y : (__y += 64), type);
  components.push(c);
  return c;
}
function link(a, ai, b, bi){
  const w = new Wire(a.outPins[ai || 0], b.inPins[bi || 0]);
  wires.push(w); recalcFan();
  return w;
}
function sim(n){ simulate(n || (components.length + wires.length + 10)); }
/* Applique un vecteur d'entrée sur des interrupteurs puis simule */
function drive(sws, bits, n){
  sws.forEach((s, i) => s.state = bits[i]);
  sim(n);
}
/* Table de vérité mesurée d'un circuit à partir de ses interrupteurs/ampoules */
function measure(sws, outs){
  const rows = [];
  for (let i = 0; i < (1 << sws.length); i++){
    sws.forEach((s, j) => s.state = (i >> (sws.length - 1 - j)) & 1);
    sim();
    rows.push(outs.map(o => (o.inPins ? o.inPins[0].state : o.state) ? 1 : 0));
  }
  return rows;
}
/* Faux champ de formulaire pour piloter applyInspector() sans DOM réel */
function fld(k, value, extra){
  return Object.assign({ dataset:{ k }, value:String(value), checked:false, type:'number' }, extra || {});
}

function __runTests(){
console.log('\n══ ARCHITECTE LOGIQUE — tests headless ══\n');

/* ===================== 1. Socle & moteur ===================== */
console.log('— Socle & moteur —');

T('T01 démarrage : sandbox vide, état global cohérent', () => {
  board();
  eq(currentIdx, -1, 'mode sandbox');
  eq(components.length, 0, 'aucun composant');
  eq(wires.length, 0, 'aucun câble');
  ok(typeof simulate === 'function' && typeof loadMission === 'function', 'API présente');
});

T('T02 les 9 portes logiques respectent leur table de vérité', () => {
  const T2 = {
    NOT:  [[0,1],[1,0]],
    AND:  [[0,0,0],[0,1,0],[1,0,0],[1,1,1]],
    OR:   [[0,0,0],[0,1,1],[1,0,1],[1,1,1]],
    XOR:  [[0,0,0],[0,1,1],[1,0,1],[1,1,0]],
    NAND: [[0,0,1],[0,1,1],[1,0,1],[1,1,0]],
    NOR:  [[0,0,1],[0,1,0],[1,0,0],[1,1,0]],
    XNOR: [[0,0,1],[0,1,0],[1,0,0],[1,1,1]]
  };
  Object.keys(T2).forEach(type => {
    board();
    const n = type === 'NOT' ? 1 : 2;
    const sws = [], g = mk(type, 300, 0), led = mk('LED', 600, 0);
    for (let i = 0; i < n; i++){ const s = mk('SWITCH', 0, i * 100); sws.push(s); link(s, 0, g, i); }
    link(g, 0, led, 0);
    T2[type].forEach(row => {
      drive(sws, row.slice(0, n));
      eq(led.inPins[0].state ? 1 : 0, row[n], type + ' pour ' + row.slice(0, n).join(''));
    });
  });
  // portes à 3 entrées
  board();
  const a3 = mk('AND3', 300, 0), o3 = mk('OR3', 300, 300);
  const sw = [0,1,2].map(i => mk('SWITCH', 0, i * 100));
  sw.forEach((s, i) => { link(s, 0, a3, i); link(s, 0, o3, i); });
  const l1 = mk('LED', 600, 0), l2 = mk('LED', 600, 300);
  link(a3, 0, l1, 0); link(o3, 0, l2, 0);
  const rows = measure(sw, [l1, l2]);
  deq(rows.map(r => r[0]), [0,0,0,0,0,0,0,1], 'ET·3');
  deq(rows.map(r => r[1]), [0,1,1,1,1,1,1,1], 'OU·3');
});

T('T03 câblage : deux fils sur une même entrée = OU câblé', () => {
  board();
  const a = mk('SWITCH', 0, 0), b = mk('SWITCH', 0, 100), led = mk('LED', 400, 0);
  link(a, 0, led, 0); link(b, 0, led, 0);
  deq(measure([a, b], [led]).map(r => r[0]), [0,1,1,1], 'OU câblé');
  eq(wires.length, 2, 'les deux fils coexistent');
});

T('T04 connectWire remplace le fil existant sur une entrée', () => {
  board();
  const a = mk('SWITCH', 0, 0), b = mk('SWITCH', 0, 100), led = mk('LED', 400, 0);
  connectWire(a.outPins[0], led.inPins[0]);
  connectWire(b.outPins[0], led.inPins[0]);
  eq(wires.length, 1, 'un seul fil sur l’entrée');
  eq(wires[0].outPin.comp, b, 'le dernier branchement gagne');
});

T('T05 constantes VRAI/FAUX et clavier 4 bits (poids 8-4-2-1)', () => {
  board();
  const h = mk('HIGH'), l = mk('LOW'), lh = mk('LED', 400, 0), ll = mk('LED', 400, 100);
  link(h, 0, lh, 0); link(l, 0, ll, 0); sim();
  eq(lh.inPins[0].state ? 1 : 0, 1, 'VRAI = 1');
  eq(ll.inPins[0].state ? 1 : 0, 0, 'FAUX = 0');
  board();
  const nb = mk('NIBBLE');
  nb.value = 13; sim();
  deq(nb.outPins.map(p => p.state), [1,1,0,1], '13 = 1101');
});

T('T06 suppression : le composant et ses fils disparaissent', () => {
  board();
  const a = mk('SWITCH', 0, 0), g = mk('AND', 300, 0), led = mk('LED', 600, 0);
  link(a, 0, g, 0); link(g, 0, led, 0);
  eq(wires.length, 2);
  deleteComponent(g);
  eq(components.length, 2, 'porte retirée');
  eq(wires.length, 0, 'fils orphelins retirés');
});

T('T07 coût en portes : AND3=2, DFF=6, CNT4=24, LED=0', () => {
  board();
  mk('AND'); mk('AND3'); mk('DFF'); mk('CNT4'); mk('LED'); mk('SWITCH');
  eq(gatesCount(), 1 + 2 + 6 + 24, 'somme des coûts');
});

T('T08 déblocage total v5 : aucun type verrouillé', () => {
  eq(Object.keys(UNLOCKS).length, 0, 'UNLOCKS vide');
  const all = TOOL_TABS.reduce((a, t) => a.concat(t.items), []);
  all.forEach(t => ok(unlockedType(t), t + ' disponible'));
});

/* ===================== 2. Séquentiel ===================== */
console.log('— Séquentiel —');

T('T09 bascule D : capture au front montant, pas au niveau', () => {
  board();
  const d = mk('SWITCH', 0, 0), clk = mk('SWITCH', 0, 100), ff = mk('DFF', 300, 0);
  link(d, 0, ff, 0); link(clk, 0, ff, 1);
  d.state = 1; clk.state = 0; sim();          // adoption du niveau, sans front
  eq(ff.q, 0, 'pas de capture à la mise sous tension');
  clk.state = 1; sim();                        // front montant
  eq(ff.q, 1, 'capture de D=1');
  d.state = 0; sim();                          // D bouge hors front
  eq(ff.q, 1, 'Q reste figé entre deux fronts');
  clk.state = 0; sim(); clk.state = 1; sim();  // nouveau front
  eq(ff.q, 0, 'capture de D=0');
  sim();
  eq(ff.outPins[0].state ? 1 : 0, 0, 'Q');
  eq(ff.outPins[1].state ? 1 : 0, 1, 'Q̄ complémentaire');
});

T('T10 bascule D rebouclée (Q̄→D) = diviseur de fréquence par 2', () => {
  board();
  const clk = mk('SWITCH', 0, 0), ff = mk('DFF', 300, 0);
  link(clk, 0, ff, 1); link(ff, 1, ff, 0);
  const seen = [];
  for (let i = 0; i < 8; i++){ clk.state = i % 2; sim(); seen.push(ff.q); }
  deq(seen, [0,1,1,0,0,1,1,0], 'Q change un front sur deux');
});

T('T11 RETARD 1 cycle', () => {
  board();
  const s = mk('SWITCH', 0, 0), d = mk('DELAY', 300, 0), led = mk('LED', 600, 0);
  link(s, 0, d, 0); link(d, 0, led, 0);
  s.state = 1; sim();
  eq(d.q, 1, 'q suit après un commit');
  s.state = 0; sim();
  eq(d.q, 0, 'et retombe un cycle plus tard');
});

T('T12 RETARD paramétré à n cycles (inspecteur)', () => {
  board();
  const s = mk('SWITCH', 0, 0), d = mk('DELAY', 300, 0);
  link(s, 0, d, 0);
  applyInspector(d, fld('cycles', 3));
  eq(d.opt.cycles, 3, 'opt.cycles');
  s.state = 1;
  for (let i = 0; i < 3; i++){ sim(); eq(d.q, 0, 'encore en transit au cycle ' + (i + 1)); }
  sim();
  eq(d.q, 1, 'sortie au cycle n+1');
  applyInspector(d, fld('cycles', 99));
  eq(d.opt.cycles, 60, 'borné à 60 cycles');
  deq(d.dq, [], 'file vidée au changement de réglage');
});

T('T13 COMPTEUR 4 BITS : +1 par front montant, remise à zéro au niveau', () => {
  board();
  const clk = mk('SWITCH', 0, 0), rst = mk('SWITCH', 0, 100), cnt = mk('CNT4', 300, 0);
  link(clk, 0, cnt, 0); link(rst, 0, cnt, 1);
  clk.state = 0; sim();
  eq(cnt.cval, 0, 'départ à 0');
  for (let i = 1; i <= 3; i++){ clk.state = 1; sim(); clk.state = 0; sim(); eq(cnt.cval, i, 'après ' + i + ' fronts'); }
  sim();
  deq(cnt.outPins.map(p => p.state), [0,0,1,1], '3 = 0011 (poids 8-4-2-1)');
  rst.state = 1; sim();
  eq(cnt.cval, 0, 'RZ au niveau haut, sans front');
  clk.state = 1; sim();
  eq(cnt.cval, 0, 'RZ prioritaire sur le front');
  rst.state = 0; clk.state = 0; sim(); clk.state = 1; sim();
  eq(cnt.cval, 1, 'reprise du comptage');
  // bouclage 15 -> 0
  cnt.cval = 15; clk.state = 0; sim(); clk.state = 1; sim();
  eq(cnt.cval, 0, 'débordement modulo 16');
});

T('T14 SONDE : mémorise les fronts sur une fenêtre de 2 s', () => {
  board();
  const s = mk('SWITCH', 0, 0), pr = mk('PROBE', 300, 0);
  link(s, 0, pr, 0);
  sim();
  for (let i = 0; i < 4; i++){ s.state = 1; sim(); __advance(100); s.state = 0; sim(); __advance(100); }
  eq(pr.edges.length, 4, '4 fronts montants comptés');
  __advance(2500); s.state = 1; sim();
  eq(pr.edges.length, 1, 'fenêtre glissante : les vieux fronts sont oubliés');
});

T('T15 HORLOGE : période issue des presets, puis de l’inspecteur', () => {
  board();
  const clk = mk('CLOCK', 0, 0), led = mk('LED', 300, 0);
  link(clk, 0, led, 0);
  applyInspector(clk, fld('freq', 5));           // 5 Hz -> période 200 ms
  eq(clk.opt.freq, 5, 'fréquence enregistrée');
  __setNow(200000); sim();
  eq(led.inPins[0].state ? 1 : 0, 1, 'première moitié du cycle');
  __setNow(200150); sim();
  eq(led.inPins[0].state ? 1 : 0, 0, 'seconde moitié du cycle');
  applyInspector(clk, fld('duty', 90));           // rapport cyclique 90 %
  __setNow(200150); sim();
  eq(led.inPins[0].state ? 1 : 0, 1, '150/200 = 75 % < 90 %');
  applyInspector(clk, fld('freq', 99));
  eq(clk.opt.freq, 30, 'fréquence bornée à 30 Hz');
  __setNow(__T0);
});

T('T16 SÉQUENCEUR : longueur, motif et défilement', () => {
  board();
  const sq = mk('SEQ', 0, 0);
  applyInspector(sq, Object.assign(fld('len', 16), { tagName:'SELECT' }));
  eq(sq.bits.length, 16, 'trame de 16 pas');
  applyInspector(sq, fld('pat', '1101'));
  deq(sq.bits.slice(0, 6), [1,1,0,1,0,0], 'motif appliqué, reste à 0');
  applyInspector(sq, Object.assign(fld('len', 4), { tagName:'SELECT' }));
  deq(sq.bits, [1,1,0,1], 'trame tronquée à 4 pas');
  applyInspector(sq, fld('hz', 10));
  sq.pos = 0; sq.lastT = Date.now();
  const led = mk('LED', 300, 0); link(sq, 0, led, 0);
  sim(); eq(sq.pos, 0, 'pas encore avancé');
  __advance(120); sim();
  eq(sq.pos, 1, 'un pas après 100 ms à 10 Hz');
});

/* ===================== 3. Blocs v5 ===================== */
console.log('— Blocs v5 —');

T('T17 SOUSTRACTEUR : différence et emprunt sortant', () => {
  board();
  const sw = [0,1,2].map(i => mk('SWITCH', 0, i * 100));
  const sub = mk('SUB', 300, 0), d = mk('LED', 600, 0), bo = mk('LED', 600, 120);
  sw.forEach((s, i) => link(s, 0, sub, i));
  link(sub, 0, d, 0); link(sub, 1, bo, 0);
  const rows = measure(sw, [d, bo]);
  rows.forEach((r, i) => {
    const a = (i >> 2) & 1, b = (i >> 1) & 1, bi = i & 1;
    const v = a - b - bi;
    deq(r, [((v % 2) + 2) % 2, v < 0 ? 1 : 0], 'A-B-Bi pour ' + [a,b,bi].join(''));
  });
});

T('T18 COMPARATEUR 1 bit : >, =, <', () => {
  board();
  const a = mk('SWITCH', 0, 0), b = mk('SWITCH', 0, 100), cp = mk('COMP', 300, 0);
  const g = mk('LED', 600, 0), e = mk('LED', 600, 120), l = mk('LED', 600, 240);
  link(a, 0, cp, 0); link(b, 0, cp, 1);
  link(cp, 0, g, 0); link(cp, 1, e, 0); link(cp, 2, l, 0);
  deq(measure([a, b], [g, e, l]), [[0,1,0],[0,0,1],[1,0,0],[0,1,0]], 'A>B, A=B, A<B');
});

T('T19 DÉMULTIPLEXEUR : la donnée part sur la voie choisie', () => {
  board();
  const d = mk('SWITCH', 0, 0), s = mk('SWITCH', 0, 100), dx = mk('DEMUX', 300, 0);
  const o0 = mk('LED', 600, 0), o1 = mk('LED', 600, 120);
  link(d, 0, dx, 0); link(s, 0, dx, 1); link(dx, 0, o0, 0); link(dx, 1, o1, 0);
  deq(measure([d, s], [o0, o1]), [[0,0],[0,0],[1,0],[0,1]], 'D=1 : S choisit la sortie');
});

T('T20 MULTIPLEXEUR et ADDITIONNEUR complet', () => {
  board();
  const sw = [0,1,2].map(i => mk('SWITCH', 0, i * 100));
  const mx = mk('MUX', 300, 0), lm = mk('LED', 600, 0);
  sw.forEach((s, i) => link(s, 0, mx, i));
  link(mx, 0, lm, 0);
  measure(sw, [lm]).forEach((r, i) => {
    const d0 = (i >> 2) & 1, d1 = (i >> 1) & 1, sel = i & 1;
    eq(r[0], sel ? d1 : d0, 'MUX ' + i);
  });
  board();
  const sw2 = [0,1,2].map(i => mk('SWITCH', 0, i * 100));
  const ad = mk('ADD', 300, 0), so = mk('LED', 600, 0), co = mk('LED', 600, 120);
  sw2.forEach((s, i) => link(s, 0, ad, i));
  link(ad, 0, so, 0); link(ad, 1, co, 0);
  measure(sw2, [so, co]).forEach((r, i) => {
    const n = ((i >> 2) & 1) + ((i >> 1) & 1) + (i & 1);
    deq(r, [n & 1, n > 1 ? 1 : 0], 'ADD ' + i);
  });
});

T('T21 ROM 3→2 programmable : chaque adresse rend sa ligne', () => {
  board();
  const sw = [0,1,2].map(i => mk('SWITCH', 0, i * 100));
  const rom = mk('ROM', 300, 0), s1 = mk('LED', 600, 0), s2 = mk('LED', 600, 120);
  sw.forEach((s, i) => link(s, 0, rom, i));
  link(rom, 0, s1, 0); link(rom, 1, s2, 0);
  deq(rom.opt.rom, [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]], 'ROM vierge');
  const table = [[0,1],[1,0],[1,1],[0,0],[1,1],[0,1],[1,0],[0,0]];
  table.forEach((row, r) => row.forEach((v, k) =>
    applyInspector(rom, { dataset:{ rom: r + ',' + k }, checked: !!v, type:'checkbox' })));
  deq(rom.opt.rom, table, 'table programmée par l’inspecteur');
  deq(measure(sw, [s1, s2]), table, 'sorties conformes à la table');
  drive(sw, [1,0,1]);
  eq(rom.romIdx, 5, 'ligne adressée surlignée = 5');
});

T('T22 BUS : GROUPER/DÉGROUPER transportent 4 bits sur un fil', () => {
  board();
  const sw = [0,1,2,3].map(i => mk('SWITCH', 0, i * 80));
  const gp = mk('GROUP', 300, 0), ug = mk('UNGROUP', 600, 0);
  const leds = [0,1,2,3].map(i => mk('LED', 900, i * 80));
  sw.forEach((s, i) => link(s, 0, gp, i));
  link(gp, 0, ug, 0);
  leds.forEach((l, i) => link(ug, i, l, 0));
  [[0,0,0,0],[1,0,1,1],[1,1,1,1],[0,1,0,0]].forEach(bits => {
    drive(sw, bits);
    eq(gp.outPins[0].state, bits[0]*8 + bits[1]*4 + bits[2]*2 + bits[3], 'valeur du bus ' + bits.join(''));
    deq(leds.map(l => l.inPins[0].state ? 1 : 0), bits, 'bits restitués ' + bits.join(''));
  });
});

T('T23 BUS sur une porte classique : valeur normalisée à 1', () => {
  board();
  const sw = [0,1,2,3].map(i => mk('SWITCH', 0, i * 80));
  const gp = mk('GROUP', 300, 0), and = mk('AND', 600, 0);
  const h = mk('HIGH', 300, 400), led = mk('LED', 900, 0);
  sw.forEach((s, i) => link(s, 0, gp, i));
  link(gp, 0, and, 0); link(h, 0, and, 1); link(and, 0, led, 0);
  drive(sw, [0,1,0,0]);                      // bus = 4
  eq(and.outPins[0].state, 1, 'un bus non nul vaut 1 pour une porte');
  drive(sw, [0,0,0,0]);                      // bus = 0
  eq(and.outPins[0].state, 0, 'un bus nul vaut 0');
});

T('T24 AFFICHEUR OCTET et SONDE : structure des entrées', () => {
  board();
  const o = mk('OCTET'), p = mk('PROBE');
  eq(o.inputs, 8, 'OCTET : 8 entrées');
  eq(o.outputs, 0, 'OCTET : aucune sortie');
  eq(p.inputs, 1, 'SONDE : 1 entrée');
  eq(gateCost('OCTET') + gateCost('PROBE'), 0, 'les afficheurs ne coûtent aucune porte');
});

/* ===================== 4. Édition ===================== */
console.log('— Édition —');

T('T25 sérialisation : aller-retour d’un groupe avec réglages', () => {
  board();
  const clk = mk('CLOCK', 0, 0), sq = mk('SEQ', 200, 0), led = mk('LED', 400, 0);
  clk.opt.freq = 7.5; sq.bits = [1,0,0,1,1,0,1,0];
  link(clk, 0, led, 0);
  const data = serializeGroup(components);
  board();
  const r = spawnGroup(data, 16, 16, false);
  eq(r.made.length, 3, 'trois composants recréés');
  eq(components[0].opt.freq, 7.5, 'réglage horloge conservé');
  deq(components[1].bits, [1,0,0,1,1,0,1,0], 'motif du séquenceur conservé');
  eq(wires.length, 1, 'câble recréé');
  eq(components[0].x, 16, 'décalage appliqué');
});

T('T26 copier / coller', () => {
  board();
  const a = mk('AND', 100, 100), b = mk('OR', 100, 300);
  link(a, 0, b, 0);
  selection.clear(); selection.add(a); selection.add(b);
  ok(copySelection(), 'copie effectuée');
  mouseW = { x: 800, y: 400 };
  const r = pasteClipboard();
  eq(r.made.length, 2, 'deux composants collés');
  eq(components.length, 4, 'les originaux sont toujours là');
  eq(wires.length, 2, 'le câble interne est collé aussi');
});

T('T27 Ctrl+D : duplication décalée de 32 px', () => {
  board();
  const a = mk('XOR', 100, 100);
  selection.clear(); selection.add(a);
  ok(duplicateSelection(), 'duplication effectuée');
  eq(components.length, 2, 'un clone ajouté');
  const clone = components[1];
  eq(clone.x, 132, 'décalé en x'); eq(clone.y, 132, 'décalé en y');
  ok(selection.has(clone) && !selection.has(a), 'le clone devient la sélection');
  selection.clear();
  eq(duplicateSelection(), false, 'sans sélection, rien à dupliquer');
});

T('T28 alignement de la sélection', () => {
  board();
  const a = mk('AND', 100, 0), b = mk('OR', 260, 96), c = mk('XOR', 420, 320);
  selection.clear(); [a,b,c].forEach(x => selection.add(x));
  alignSel('left');
  deq([a.x, b.x, c.x], [100, 100, 100], 'aligné à gauche');
  alignSel('vdist');
  eq(b.y, Math.round(((0 + 320) / 2) / 16) * 16, 'réparti verticalement');
});

T('T29 annuler / refaire', () => {
  board();
  __advance(500); mk('AND', 100, 100); markDirty();
  __advance(500); mk('OR', 300, 100); markDirty();
  eq(components.length, 2);
  ok(undo(), 'undo 1');
  eq(components.length, 1, 'retour à un composant');
  ok(undo(), 'undo 2');
  eq(components.length, 0, 'plateau vide');
  eq(undo(), false, 'plus rien à annuler');
  ok(redo(), 'redo 1');
  eq(components.length, 1, 'refait');
  ok(redo(), 'redo 2');
  eq(components.length, 2, 'refait encore');
  eq(redo(), false, 'plus rien à refaire');
  eq(components[1].type, 'OR', 'le type est bien restitué');
});

T('T30 annuler : coalescence des modifications rapprochées (350 ms)', () => {
  board();
  mk('AND', 100, 100); markDirty();
  mk('OR', 300, 100); markDirty();            // même horodatage -> fusionné
  eq(components.length, 2);
  ok(undo(), 'un seul cran d’annulation');
  eq(components.length, 0, 'les deux ajouts sont annulés ensemble');
});

T('T31 annuler préserve étiquettes, verrous et boîte noire en mission', () => {
  loadMission(missions.findIndex(m => m.id === 'm79'));
  const before = components.length;
  __advance(500);
  const g = mk('NOT', 300, 300); markDirty();
  eq(components.length, before + 1);
  ok(undo(), 'undo en mission');
  eq(components.length, before, 'ajout annulé');
  const bb = components.find(c => c.type === 'BLACKBOX');
  ok(bb && bb.locked && bb.bbTT, 'boîte noire reconstruite verrouillée avec sa table');
  ok(components.some(c => c.obs), 'LED d’observation reconstruite');
  ok(components.filter(c => c.locked).length >= 3, 'les E/S restent verrouillées');
  loadMission(-1);
});

T('T32 sauvegardes nommées : enregistrer, recharger, remplacer', () => {
  board();
  const a = mk('SWITCH', 0, 0), g = mk('NAND', 300, 0), l = mk('LED', 600, 0);
  link(a, 0, g, 0); link(g, 0, l, 0);
  const n0 = SAVES.length;
  const r = saveNamed('test-montage');
  ok(r.ok, 'sauvegarde acceptée');
  eq(SAVES.length, n0 + 1, 'une entrée ajoutée');
  const r2 = saveNamed('test-montage');
  ok(r2.replaced, 'même nom = remplacement');
  eq(SAVES.length, n0 + 1, 'pas de doublon');
  board();
  eq(components.length, 0);
  const idx = SAVES.findIndex(s => s.name === 'test-montage');
  ok(loadSaved(idx).ok, 'rechargement');
  eq(components.length, 3, 'composants restitués');
  eq(wires.length, 2, 'câbles restitués');
  ok(JSON.parse(localStorage.getItem('al2_saves')).length >= 1, 'persisté dans localStorage');
});

T('T33 les 14 exemples se chargent et se simulent', () => {
  eq(EXAMPLES.length, 14, 'catalogue d’exemples');
  EXAMPLES.forEach((ex, i) => {
    board();
    const r = loadExample(i);
    ok(r.ok, 'chargement de « ' + ex.name + ' »');
    eq(r.made.length, ex.data.comps.length, 'tous les composants de « ' + ex.name + ' »');
    eq(wires.length, ex.data.wires.length, 'tous les câbles de « ' + ex.name + ' »');
    for (let k = 0; k < 3; k++){ __advance(60); sim(); }
  });
  board();
});

T('T34 rangement automatique des câbles (autoroute)', () => {
  board();
  const a = mk('SWITCH', 0, 200);
  const obstacle = mk('AND', 300, 190);
  const led = mk('LED', 700, 200);
  link(a, 0, led, 0);
  const before = wires[0].wp.length;
  autoRoute();
  ok(wires[0].wp.length >= before, 'des poignées peuvent être ajoutées');
  eq(wires.length, 1, 'aucun câble perdu');
  sim();
  a.state = 1; sim();
  eq(led.inPins[0].state ? 1 : 0, 1, 'la connexion reste valide');
});

T('T35 puces : création depuis le sandbox, réutilisation, coût', () => {
  board();
  CHIPS = CHIPS.filter(c => c.name !== 'TEST-XOR');
  const a = mk('SWITCH', 0, 0), b = mk('SWITCH', 0, 200);
  const x = mk('XOR', 300, 100), l = mk('LED', 600, 100);
  link(a, 0, x, 0); link(b, 0, x, 1); link(x, 0, l, 0);
  const r = createChip('TEST-XOR');
  ok(r.def, 'puce créée : ' + (r.err || ''));
  eq(r.def.ins, 2, '2 entrées'); eq(r.def.outs, 1, '1 sortie');
  eq(createChip('TEST-XOR').err != null, true, 'nom déjà pris refusé');
  board();
  const chip = spawnChip('TEST-XOR');
  const s1 = mk('SWITCH', 0, 0), s2 = mk('SWITCH', 0, 200), out = mk('LED', 600, 0);
  link(s1, 0, chip, 0); link(s2, 0, chip, 1); link(chip, 0, out, 0);
  deq(measure([s1, s2], [out]).map(v => v[0]), [0,1,1,0], 'la puce se comporte en XOR');
  eq(chip.chipCost, 1, 'coût réel de la puce');
  eq(gatesCount(), 1, 'le coût de la puce est comptabilisé');
  CHIPS = CHIPS.filter(c => c.name !== 'TEST-XOR'); saveChips();
});

/* ===================== 5. Analyseur ===================== */
console.log('— Analyseur —');

T('T36 analyseur : équation booléenne et table mesurée', () => {
  board();
  const a = mk('SWITCH', 0, 0), b = mk('SWITCH', 0, 200);
  const g = mk('AND', 300, 100), l = mk('LED', 600, 100);
  link(a, 0, g, 0); link(b, 0, g, 1); link(g, 0, l, 0);
  const r = analyzeCircuit();
  eq(r.eqs.length, 1, 'une équation');
  eq(r.eqs[0].expr, 'A·B', 'ET reconnu');
  ok(r.combinatoire, 'circuit combinatoire');
  deq(r.table, [[0],[0],[0],[1]], 'table de vérité mesurée');
  deq(r.vars, ['A','B'], 'variables nommées dans l’ordre vertical');
});

T('T37 analyseur : NON, OU câblé, XOR et étiquettes personnalisées', () => {
  board();
  const a = mk('SWITCH', 0, 0), n = mk('NOT', 300, 0), l = mk('LED', 600, 0);
  a.customLabel = 'CAPT'; l.customLabel = 'ALARME';
  link(a, 0, n, 0); link(n, 0, l, 0);
  let r = analyzeCircuit();
  eq(r.eqs[0].name, 'ALARME', 'nom de sortie personnalisé');
  eq(r.eqs[0].expr, '¬CAPT', 'NON reconnu avec étiquette');
  board();
  const s1 = mk('SWITCH', 0, 0), s2 = mk('SWITCH', 0, 200), ld = mk('LED', 600, 0);
  link(s1, 0, ld, 0); link(s2, 0, ld, 0);
  r = analyzeCircuit();
  eq(r.eqs[0].expr, 'A + B', 'deux fils sur une entrée = OU implicite');
});

T('T38 analyseur : circuit séquentiel = pas de table figée', () => {
  board();
  const clk = mk('CLOCK', 0, 0), ff = mk('DFF', 300, 0), l = mk('LED', 600, 0);
  const d = mk('SWITCH', 0, 200);
  link(d, 0, ff, 0); link(clk, 0, ff, 1); link(ff, 0, l, 0);
  const r = analyzeCircuit();
  eq(r.combinatoire, false, 'séquentiel détecté');
  eq(r.table, null, 'aucune table figée');
  ok(/mém\[/.test(r.eqs[0].expr), 'la mémoire apparaît dans l’équation : ' + r.eqs[0].expr);
});

T('T39 analyseur : les boucles sont signalées, pas infinies', () => {
  board();
  const n1 = mk('NOT', 0, 0), n2 = mk('NOT', 200, 0), n3 = mk('NOT', 400, 0), l = mk('LED', 600, 0);
  link(n1, 0, n2, 0); link(n2, 0, n3, 0); link(n3, 0, n1, 0); link(n3, 0, l, 0);
  const r = analyzeCircuit();
  ok(/↺/.test(r.eqs[0].expr), 'cycle marqué ↺ : ' + r.eqs[0].expr);
});

/* ===================== 6. Missions ===================== */
console.log('— Missions —');

T('T40 catalogue : identifiants uniques, tables cohérentes, chapitres continus', () => {
  ok(missions.length >= 118, 'catalogue complet (' + missions.length + ' missions)');
  const ids = new Set(missions.map(m => m.id));
  eq(ids.size, missions.length, 'identifiants uniques');
  const chapitres = [...new Set(missions.map(m => m.ch))];
  ok(chapitres.length >= 20, chapitres.length + ' chapitres');
  missions.forEach((m, i) => {
    const tag = '#' + (i + 1) + ' ' + m.id;
    ok(m.title && m.ch && m.desc, tag + ' : intitulé complet');
    // les missions « libres » (exploration, tt vide) peuvent n’avoir aucune E/S imposée
    ok(m.inputs >= 0 && m.inputs <= 5, tag + ' : nombre d’entrées plausible');
    ok(m.outputs >= 0, tag + ' : nombre de sorties plausible');
    ok(Array.isArray(m.tt), tag + ' : table de vérité présente');
    if (m.tt.length){
      ok(m.inputs >= 1 && m.outputs >= 1, tag + ' : une table exige des E/S');
      eq(m.tt.length, 1 << m.inputs, tag + ' : lignes de table');
      m.tt.forEach((row, r) => eq(row.length, m.outputs, tag + ' ligne ' + r + ' : largeur'));
      m.tt.forEach((row, r) => row.forEach(v =>
        ok(v === 0 || v === 1, tag + ' ligne ' + r + ' : bits 0/1 uniquement')));
    }
    if (m.inLabels)  eq(m.inLabels.length, m.inputs, tag + ' : étiquettes d’entrée');
    if (m.outLabels) eq(m.outLabels.length, m.outputs, tag + ' : étiquettes de sortie');
    if (m.allowed) m.allowed.forEach(t => ok(LOGIC_TYPES.includes(t), tag + ' : type autorisé ' + t));
    ok(m.sol && m.sol.steps && m.sol.steps.length && m.sol.why, tag + ' : solution rédigée');
  });
});

T('T41 chaque mission se charge (E/S verrouillées, table affichée)', () => {
  missions.forEach((m, i) => {
    loadMission(i);
    const ins = components.filter(c => c.type === 'SWITCH' && c.locked);
    const outs = components.filter(c => c.type === 'LED' && c.locked && !c.obs);
    eq(ins.length, m.inputs, m.id + ' : entrées posées');
    eq(outs.length, m.outputs, m.id + ' : sorties posées');
    ok(ins.every(c => c.customLabel), m.id + ' : entrées étiquetées');
  });
  loadMission(-1);
});

T('T42 chaque solution s’affiche sans erreur', () => {
  missions.forEach((m, i) => {
    loadMission(i);
    __fire('btn-solution', 'click');
    const h = __el('solution-text').innerHTML;
    ok(h.length > 40, m.id + ' : texte de solution rendu');
  });
  loadMission(-1);
});

T('T43 mission résolue : la vérification déclenche la victoire', () => {
  const idx = missions.findIndex(m => m.id === 'm2');       // ET
  loadMission(idx);
  delete progress.done['m2'];
  const ins = components.filter(c => c.type === 'SWITCH' && c.locked).sort((a,b) => a.y - b.y);
  const out = components.find(c => c.type === 'LED' && c.locked);
  const g = mk('AND', 400, 200);
  link(ins[0], 0, g, 0); link(ins[1], 0, g, 1); link(g, 0, out, 0);
  __fire('btn-verify', 'click');
  ok(progress.done['m2'], 'mission validée');
  eq(progress.best['m2'], 1, 'meilleur score = 1 porte');
  loadMission(-1);
});

T('T44 mission non résolue : échec signalé, pas de victoire', () => {
  const idx = missions.findIndex(m => m.id === 'm3');       // OU
  loadMission(idx);
  delete progress.done['m3'];
  const ins = components.filter(c => c.type === 'SWITCH' && c.locked).sort((a,b) => a.y - b.y);
  const out = components.find(c => c.type === 'LED' && c.locked);
  const g = mk('AND', 400, 200);                            // mauvaise porte
  link(ins[0], 0, g, 0); link(ins[1], 0, g, 1); link(g, 0, out, 0);
  __fire('btn-verify', 'click');
  ok(!progress.done['m3'], 'mission NON validée');
  loadMission(-1);
});

T('T45 contraintes de mission : portes interdites et budget', () => {
  const idx = missions.findIndex(m => m.allowed && m.allowed.length === 1 && m.allowed[0] === 'NAND');
  ok(idx >= 0, 'au moins une mission « NAND uniquement »');
  const m = missions[idx];
  loadMission(idx);
  delete progress.done[m.id];
  const ins = components.filter(c => c.type === 'SWITCH' && c.locked).sort((a,b) => a.y - b.y);
  const out = components.find(c => c.type === 'LED' && c.locked);
  const g = mk('AND', 400, 200);                            // porte interdite
  ins.forEach((s, i) => link(s, 0, g, Math.min(i, 1)));
  link(g, 0, out, 0);
  __fire('btn-verify', 'click');
  ok(!progress.done[m.id], 'refusée car porte interdite');
  loadMission(-1);
});

T('T46 mission BOÎTE NOIRE : montage, observation, résolution', () => {
  const idx = missions.findIndex(m => m.id === 'm79');
  const m = missions[idx];
  loadMission(idx);
  delete progress.done['m79'];
  const bb = components.find(c => c.type === 'BLACKBOX');
  ok(bb, 'boîte noire posée');
  ok(bb.locked, 'verrouillée');
  eq(bb.inputs, m.inputs, 'entrées de la boîte');
  const obs = components.filter(c => c.obs);
  eq(obs.length, m.outputs, 'LED d’observation posée');
  ok(obs.every(o => o.locked), 'LED témoin verrouillée');
  // la boîte répond selon la table cachée
  const inA = components.find(c => c.type === 'SWITCH' && c.locked);
  inA.state = 0; sim();
  eq(obs[0].inPins[0].state ? 1 : 0, m.tt[0][0], 'observation pour A=0');
  inA.state = 1; sim();
  eq(obs[0].inPins[0].state ? 1 : 0, m.tt[1][0], 'observation pour A=1');
  // la table affichée est masquée
  ok(/[?]/.test(__el('truth-table').innerHTML), 'table affichée en « ? »');
  // reconstruction : un simple NON
  const out = components.find(c => c.type === 'LED' && c.locked && !c.obs);
  const not = mk('NOT', 700, 300);
  link(inA, 0, not, 0); link(not, 0, out, 0);
  __fire('btn-verify', 'click');
  ok(progress.done['m79'], 'mission boîte noire validée : les LED 👁 sont exclues du contrôle');
  loadMission(-1);
});

T('T47 boîtes noires : les 8 missions bb répondent à leur table', () => {
  const bbs = missions.map((m, i) => [m, i]).filter(([m]) => m.bb);
  eq(bbs.length, 8, 'huit missions de rétro-ingénierie');
  bbs.forEach(([m, i]) => {
    loadMission(i);
    const bb = components.find(c => c.type === 'BLACKBOX');
    const ins = components.filter(c => c.type === 'SWITCH' && c.locked).sort((a,b) => a.y - b.y);
    const obs = components.filter(c => c.obs).sort((a,b) => a.y - b.y);
    ok(bb && bb.bbTT === m.tt, m.id + ' : table cachée branchée');
    for (let k = 0; k < m.tt.length; k++){
      ins.forEach((s, j) => s.state = (k >> (m.inputs - 1 - j)) & 1);
      sim();
      deq(obs.map(o => o.inPins[0].state ? 1 : 0), m.tt[k], m.id + ' ligne ' + k);
    }
  });
  loadMission(-1);
});

T('T48 en mission, coller ne duplique pas les entrées fournies', () => {
  loadMission(1);
  const before = components.length;
  const a = mk('AND', 400, 400);
  selection.clear(); selection.add(a);
  copySelection();
  mouseW = { x: 600, y: 600 };
  const r = pasteClipboard();
  eq(r.made.length, 1, 'la porte est collée');
  clipboard = { comps:[{ t:'SWITCH', x:0, y:0 }], wires:[] };
  const r2 = pasteClipboard();
  eq(r2.made.length, 0, 'aucun interrupteur collé en mission');
  eq(r2.skipped, 1, 'entrée ignorée et signalée');
  eq(components.length, before + 2, 'plateau cohérent');
  clipboard = null;
  loadMission(-1);
});

T('T64 bac à sable : les réglages d’inspecteur survivent au rechargement', () => {
  board();
  const rom = mk('ROM', 100, 100), clk = mk('CLOCK', 400, 100), led = mk('LED', 700, 100);
  rom.opt.rom[3] = [1, 1];
  clk.opt.freq = 7.5; clk.opt.duty = 20;
  clk.customLabel = 'TEMPO';
  const w = link(clk, 0, led, 0);
  w.wp = [{ x: 560, y: 40 }];
  saveSandbox();
  const raw = JSON.parse(localStorage.getItem('al2_sandbox'));
  ok(raw && raw.comps.some(c => c.opt), 'les réglages sont bien écrits sur le disque');
  components = []; wires = [];
  restoreSandbox();
  eq(components.length, 3, 'composants restaurés');
  const rom2 = components.find(c => c.type === 'ROM');
  const clk2 = components.find(c => c.type === 'CLOCK');
  deq(rom2.opt.rom[3], [1,1], 'table de la ROM conservée');
  eq(clk2.opt.freq, 7.5, 'fréquence conservée');
  eq(clk2.opt.duty, 20, 'rapport cyclique conservé');
  eq(clk2.customLabel, 'TEMPO', 'étiquette conservée');
  eq(wires[0].wp.length, 1, 'poignée de câble conservée');
  localStorage.removeItem('al2_sandbox');
});

T('T65 puce : une ROM programmée garde sa table une fois encapsulée', () => {
  board();
  CHIPS = CHIPS.filter(c => c.name !== 'TEST-ROM');
  const sw = [0,1,2].map(i => mk('SWITCH', 0, i * 100));
  const rom = mk('ROM', 300, 0), l = mk('LED', 600, 0);
  const table = [[0,0],[1,0],[1,1],[0,1],[1,0],[0,0],[1,1],[1,0]];
  rom.opt.rom = table.map(r => r.slice());
  sw.forEach((s, i) => link(s, 0, rom, i));
  link(rom, 0, l, 0);
  const r = createChip('TEST-ROM');
  ok(r.def, 'puce créée : ' + (r.err || ''));
  board();
  const chip = spawnChip('TEST-ROM');
  const s2 = [0,1,2].map(i => mk('SWITCH', 0, i * 100)), out = mk('LED', 600, 0);
  s2.forEach((s, i) => link(s, 0, chip, i));
  link(chip, 0, out, 0);
  deq(measure(s2, [out]).map(v => v[0]), table.map(r2 => r2[0]),
    'la ROM encapsulée répond comme la table programmée');
  CHIPS = CHIPS.filter(c => c.name !== 'TEST-ROM'); saveChips();
});

/* ===================== 6bis. Registre de composants ===================== */
console.log('— Registre —');

T('T66 registre : chaque composant déclaré est complet et publié', () => {
  const ids = Object.keys(REG);
  ok(ids.length > 0, 'le registre contient des composants');
  ids.forEach(id => {
    const d = REG[id];
    ok(d.name && d.short, id + ' : nom et nom court');
    ok(d.family, id + ' : famille');
    eq(FR_NAME[id], d.name, id + ' : publié dans FR_NAME');
    eq(SHORT[id], d.short, id + ' : publié dans SHORT');
    ok(ICO[id] && /svg/.test(ICO[id]), id + ' : icône');
    ok(GATE_STYLE[id] && GATE_STYLE[id].c, id + ' : couleur');
    ok(d.w >= 40 && d.h >= 40, id + ' : dimensions plausibles');
    ok(Array.isArray(d.ins) && Array.isArray(d.outs), id + ' : pins déclarés');
    ok(d.guide && d.guide.txt && d.guide.txt.length > 40, id + ' : entrée de guide rédigée');
    ok(TOOL_TABS.some(t => t.items.includes(id)), id + ' : présent dans la barre d’outils');
    (d.opts || []).forEach(o => {
      ok(o.k && o.label, id + ' : réglage nommé');
      if (o.type === 'select') ok(Array.isArray(o.choices) && o.choices.length, id + '/' + o.k + ' : choix');
      else if (o.type !== 'text') ok(typeof o.min === 'number' && typeof o.max === 'number' &&
        o.def >= o.min && o.def <= o.max, id + '/' + o.k + ' : bornes cohérentes');
    });
  });
});

T('T67 registre : tous les composants s’instancient, se simulent et se dessinent', () => {
  const ids = Object.keys(REG);
  board();
  ids.forEach((id, i) => {
    const c = mk(id, (i % 8) * 200, Math.floor(i / 8) * 200);
    eq(c.inputs, REG[id].ins.length, id + ' : nombre d’entrées');
    eq(c.outputs, REG[id].outs.length, id + ' : nombre de sorties');
  });
  for (let k = 0; k < 4; k++){ __advance(120); sim(); }
  drawScene(0);                       // aucun dessin ne doit lever d’exception
  const data = serializeGroup(components);
  board();
  const r = spawnGroup(data, 0, 0, false);
  eq(r.made.length, ids.length, 'tous re-instanciables depuis une sauvegarde');
  board();
});

T('T68 TON / TOF : retard à l’enclenchement et au déclenchement', () => {
  board();
  const s = mk('SWITCH', 0, 0), ton = mk('TON', 300, 0), tof = mk('TOF', 300, 200);
  const l1 = mk('LED', 600, 0), l2 = mk('LED', 600, 200);
  link(s, 0, ton, 0); link(s, 0, tof, 0); link(ton, 0, l1, 0); link(tof, 0, l2, 0);
  applyInspector(ton, fld('o_sec', 2)); applyInspector(tof, fld('o_sec', 3));
  eq(optOf(ton, 'sec'), 2, 'durée réglée par l’inspecteur');
  s.state = 1; sim();
  eq(ton.q, 0, 'TON : rien avant la fin du délai');
  eq(tof.q, 1, 'TOF : sortie immédiate');
  __advance(1000); sim(); eq(ton.q, 0, 'TON : toujours en décompte à 1 s');
  __advance(1200); sim(); eq(ton.q, 1, 'TON : sortie après 2,2 s');
  s.state = 0; sim();
  eq(ton.q, 0, 'TON : retombe aussitôt');
  eq(tof.q, 1, 'TOF : maintenu');
  __advance(2000); sim(); eq(tof.q, 1, 'TOF : encore maintenu à 2 s');
  __advance(1500); sim(); eq(tof.q, 0, 'TOF : retombe après 3 s');
  // un appui trop bref n’arme pas le TON
  s.state = 1; sim(); __advance(500); sim(); s.state = 0; sim();
  __advance(3000); sim();
  eq(ton.q, 0, 'TON : appui trop bref, jamais déclenché');
});

T('T69 IMPULSION calibrée : largeur fixe quelle que soit la durée d’appui', () => {
  board();
  const s = mk('SWITCH', 0, 0), p = mk('PULSE', 300, 0);
  link(s, 0, p, 0);
  applyInspector(p, fld('o_sec', 1));
  sim();
  s.state = 1; sim();
  eq(p.q, 1, 'impulsion déclenchée au front');
  __advance(600); sim(); eq(p.q, 1, 'toujours haute à 0,6 s');
  __advance(600); sim(); eq(p.q, 0, 'retombée à 1,2 s malgré l’appui maintenu');
  __advance(2000); sim(); eq(p.q, 0, 'pas de nouvelle impulsion sans nouveau front');
  s.state = 0; sim(); s.state = 1; sim();
  eq(p.q, 1, 'nouveau front, nouvelle impulsion');
});

T('T70 FRONTS : une impulsion sur ↑ puis sur ↓', () => {
  board();
  const s = mk('SWITCH', 0, 0), e = mk('EDGE', 300, 0);
  link(s, 0, e, 0);
  sim(); sim();
  deq([e.up, e.dn], [0,0], 'au repos');
  s.state = 1; sim();
  deq([e.up, e.dn], [1,0], 'front montant');
  sim();
  deq([e.up, e.dn], [0,0], 'impulsion d’une seule frame');
  s.state = 0; sim();
  deq([e.up, e.dn], [0,1], 'front descendant');
});

T('T71 MÉMOIRE SR : auto-maintien et dominance réglable', () => {
  board();
  const S = mk('SWITCH', 0, 0), R = mk('SWITCH', 0, 200), m = mk('SRMEM', 300, 0);
  link(S, 0, m, 0); link(R, 0, m, 1);
  sim(); eq(m.q, 0, 'départ à l’arrêt');
  S.state = 1; sim(); S.state = 0; sim();
  eq(m.q, 1, 'la marche se maintient toute seule');
  R.state = 1; sim(); R.state = 0; sim();
  eq(m.q, 0, 'l’arrêt efface la mémoire');
  S.state = 1; R.state = 1; sim();
  eq(m.q, 0, 'S et R ensemble : arrêt prioritaire par défaut');
  applyInspector(m, Object.assign(fld('o_dom', 's'), { tagName:'SELECT' }));
  sim();
  eq(m.q, 1, 'dominance inversée : marche prioritaire');
  eq(m.outPins[1].state, 0, 'sortie complémentaire');
});

T('T72 ÷N : la sortie change tous les N fronts', () => {
  board();
  const clk = mk('SWITCH', 0, 0), d = mk('DIVN', 300, 0);
  link(clk, 0, d, 0);
  applyInspector(d, fld('o_n', 3));
  const seen = [];
  clk.state = 0; sim();
  for (let i = 0; i < 9; i++){ clk.state = 1; sim(); clk.state = 0; sim(); seen.push(d.q); }
  deq(seen, [0,0,1,1,1,0,0,0,1], 'bascule tous les 3 fronts');
});

T('T73 CHIEN DE GARDE : alerte quand le signal s’arrête', () => {
  board();
  const s = mk('SWITCH', 0, 0), w = mk('WDOG', 300, 0);
  link(s, 0, w, 0);
  applyInspector(w, fld('o_sec', 2));
  sim();
  for (let i = 0; i < 3; i++){ s.state = 1; sim(); __advance(500); s.state = 0; sim(); __advance(500); }
  eq(w.alarm, 0, 'signal vivant : pas d’alerte');
  __advance(2500); sim();
  eq(w.alarm, 1, 'plus de front pendant 2 s : alerte');
  s.state = 1; sim();
  eq(w.alarm, 0, 'un nouveau front rassure le chien de garde');
});

T('T74 NAND·3 et NOR·3', () => {
  board();
  const sw = [0,1,2].map(i => mk('SWITCH', 0, i * 100));
  const na = mk('NAND3', 300, 0), no = mk('NOR3', 300, 300);
  const l1 = mk('LED', 600, 0), l2 = mk('LED', 600, 300);
  sw.forEach((s, i) => { link(s, 0, na, i); link(s, 0, no, i); });
  link(na, 0, l1, 0); link(no, 0, l2, 0);
  const rows = measure(sw, [l1, l2]);
  deq(rows.map(r => r[0]), [1,1,1,1,1,1,1,0], 'NAND·3');
  deq(rows.map(r => r[1]), [1,0,0,0,0,0,0,0], 'NOR·3');
  eq(gateCost('NAND3'), 2, 'coût de la porte élargie');
});

T('T75 décodeurs 2→4 et 3→8 : une seule sortie active', () => {
  board();
  const sw = [0,1,2].map(i => mk('SWITCH', 0, i * 100));
  const d24 = mk('DEC24', 300, 0), d38 = mk('DEC38', 300, 400);
  link(sw[0], 0, d24, 0); link(sw[1], 0, d24, 1); link(sw[2], 0, d24, 2);
  sw.forEach((s, i) => link(s, 0, d38, i));
  for (let v = 0; v < 8; v++){
    drive(sw, [(v >> 2) & 1, (v >> 1) & 1, v & 1]);
    const on38 = d38.outPins.map(p => p.state).reduce((a, b) => a + b, 0);
    eq(on38, 1, 'DÉC 3→8 : une seule sortie pour ' + v);
    eq(d38.outPins[v].state, 1, 'DÉC 3→8 : sortie ' + v);
    const k = (v >> 2) & 1 ? 2 : 0, kk = k + ((v >> 1) & 1);
    if (v & 1) eq(d24.outPins[kk].state, 1, 'DÉC 2→4 validé : sortie ' + kk);
    else eq(d24.outPins.reduce((a, p) => a + p.state, 0), 0, 'DÉC 2→4 : EN=0 éteint tout');
  }
});

T('T76 encodeur prioritaire 4→2', () => {
  board();
  const sw = [0,1,2,3].map(i => mk('SWITCH', 0, i * 90));
  const e = mk('ENC42', 300, 0);
  sw.forEach((s, i) => link(s, 0, e, i));
  drive(sw, [0,0,0,0]);
  eq(e.outPins[2].state, 0, 'aucune entrée : V=0');
  [[1,0,0,0,0],[0,1,0,0,1],[0,0,1,0,2],[0,0,0,1,3]].forEach(r => {
    drive(sw, r.slice(0, 4));
    const v = (e.outPins[0].state ? 2 : 0) + (e.outPins[1].state ? 1 : 0);
    eq(v, r[4], 'entrée ' + r[4] + ' encodée');
    eq(e.outPins[2].state, 1, 'V=1');
  });
  drive(sw, [1,1,0,1]);
  eq((e.outPins[0].state ? 2 : 0) + (e.outPins[1].state ? 1 : 0), 3, 'priorité au numéro le plus haut');
});

T('T77 MUX·4 et DMUX·4', () => {
  board();
  const d = [0,1,2,3].map(i => mk('SWITCH', 0, i * 80));
  const s1 = mk('SWITCH', 0, 400), s0 = mk('SWITCH', 0, 480);
  const mx = mk('MUX4', 300, 0), out = mk('LED', 600, 0);
  d.forEach((x, i) => link(x, 0, mx, i));
  link(s1, 0, mx, 4); link(s0, 0, mx, 5); link(mx, 0, out, 0);
  d.forEach((x, i) => x.state = i % 2);          // D0=0 D1=1 D2=0 D3=1
  for (let k = 0; k < 4; k++){
    s1.state = (k >> 1) & 1; s0.state = k & 1; sim();
    eq(out.inPins[0].state ? 1 : 0, k % 2, 'MUX·4 voie ' + k);
  }
  board();
  const src = mk('SWITCH', 0, 0), a = mk('SWITCH', 0, 100), b = mk('SWITCH', 0, 200);
  const dm = mk('DMUX4', 300, 0);
  link(src, 0, dm, 0); link(a, 0, dm, 1); link(b, 0, dm, 2);
  src.state = 1;
  for (let k = 0; k < 4; k++){
    a.state = (k >> 1) & 1; b.state = k & 1; sim();
    deq(dm.outPins.map(p => p.state), [0,1,2,3].map(i => i === k ? 1 : 0), 'DMUX·4 voie ' + k);
  }
});

T('T78 décodeur BCD → 7 segments : les 16 chiffres', () => {
  board();
  const sw = [0,1,2,3].map(i => mk('SWITCH', 0, i * 80));
  const dec = mk('BCD7', 300, 0);
  sw.forEach((s, i) => link(s, 0, dec, i));
  const attendu = {
    0:'1111110', 1:'0110000', 2:'1101101', 3:'1111001', 4:'0110011',
    5:'1011011', 6:'1011111', 7:'1110000', 8:'1111111', 9:'1111011'
  };
  for (let v = 0; v <= 9; v++){
    drive(sw, [(v>>3)&1, (v>>2)&1, (v>>1)&1, v&1]);
    eq(dec.outPins.map(p => p.state).join(''), attendu[v], 'chiffre ' + v);
  }
  drive(sw, [1,1,1,1]);
  eq(dec.digit, 15, 'les valeurs 10-15 affichent A-F');
});

T('T79 additionneur 4 bits sur bus, avec retenue', () => {
  board();
  const swA = [0,1,2,3].map(i => mk('SWITCH', 0, i * 70));
  const swB = [0,1,2,3].map(i => mk('SWITCH', 200, i * 70));
  const gA = mk('GROUP', 400, 0), gB = mk('GROUP', 400, 300), add = mk('ADD4', 620, 100);
  const ug = mk('UNGROUP', 820, 100);
  swA.forEach((s, i) => link(s, 0, gA, i));
  swB.forEach((s, i) => link(s, 0, gB, i));
  link(gA, 0, add, 0); link(gB, 0, add, 1); link(add, 0, ug, 0);
  const bits = v => [(v>>3)&1, (v>>2)&1, (v>>1)&1, v&1];
  [[5,3],[9,9],[15,1],[7,8],[0,0]].forEach(([a, b]) => {
    swA.forEach((s, i) => s.state = bits(a)[i]);
    swB.forEach((s, i) => s.state = bits(b)[i]);
    sim();
    eq(add.outPins[0].state, (a + b) & 15, a + ' + ' + b + ' (4 bits)');
    eq(add.outPins[1].state, a + b > 15 ? 1 : 0, a + ' + ' + b + ' : retenue');
    eq(ug.outPins.map(p => p.state).join(''), bits((a + b) & 15).join(''), 'bits restitués');
  });
  ok(!add.inPins[0].busWarn, 'un pin déclaré « bus » n’est pas signalé comme normalisé');
});

T('T80 registre sur bus : photographie au front, remise à zéro', () => {
  board();
  const sw = [0,1,2,3].map(i => mk('SWITCH', 0, i * 70));
  const g = mk('GROUP', 300, 0), r = mk('REGB', 520, 0);
  const clk = mk('SWITCH', 0, 400), rst = mk('SWITCH', 0, 480);
  sw.forEach((s, i) => link(s, 0, g, i));
  link(g, 0, r, 0); link(clk, 0, r, 1); link(rst, 0, r, 2);
  drive(sw, [1,0,1,1]);                       // 11
  eq(r.val, 0, 'rien tant qu’il n’y a pas de front');
  clk.state = 1; sim();
  eq(r.val, 11, 'valeur capturée au front montant');
  drive(sw, [0,1,0,0]); clk.state = 0; sim();
  eq(r.val, 11, 'la valeur reste figée entre deux fronts');
  clk.state = 1; sim();
  eq(r.val, 4, 'nouvelle capture');
  rst.state = 1; sim();
  eq(r.val, 0, 'remise à zéro au niveau');
});

T('T81 registre à décalage 8 bits : série vers parallèle', () => {
  board();
  const d = mk('SWITCH', 0, 0), clk = mk('SWITCH', 0, 100), rst = mk('SWITCH', 0, 200);
  const sh = mk('SHIFT8', 300, 0);
  link(d, 0, sh, 0); link(clk, 0, sh, 1); link(rst, 0, sh, 2);
  rst.state = 1; sim(); rst.state = 0; sim();
  const motif = [1,0,1,1,0,0,1,0];
  motif.forEach(b => { d.state = b; clk.state = 0; sim(); clk.state = 1; sim(); });
  eq(sh.val, parseInt(motif.join(''), 2), 'les 8 bits sont entrés en série');
  sim();                                       // les sorties publient l’état après le commit
  eq(sh.outPins[0].state, parseInt(motif.join(''), 2), 'disponibles en parallèle sur le bus');
  eq(sh.outPins[1].state, motif[0], 'le premier bit entré ressort en série');
  rst.state = 1; sim();
  eq(sh.val, 0, 'remise à zéro');
});

T('T82 RAM 16 × 4 : écriture au front, lecture immédiate', () => {
  board();
  const sw = [0,1,2,3].map(i => mk('SWITCH', 0, i * 70));
  const sd = [0,1,2,3].map(i => mk('SWITCH', 200, i * 70));
  const gA = mk('GROUP', 400, 0), gD = mk('GROUP', 400, 300);
  const W = mk('SWITCH', 0, 400), CK = mk('SWITCH', 0, 480);
  const ram2 = mk('RAM16', 620, 0), out = mk('UNGROUP', 860, 0);
  sw.forEach((s, i) => link(s, 0, gA, i));
  sd.forEach((s, i) => link(s, 0, gD, i));
  link(gA, 0, ram2, 0); link(gD, 0, ram2, 1); link(W, 0, ram2, 2); link(CK, 0, ram2, 3);
  link(ram2, 0, out, 0);
  const bits = v => [(v>>3)&1, (v>>2)&1, (v>>1)&1, v&1];
  const ecrire = (a, v) => {
    sw.forEach((s, i) => s.state = bits(a)[i]);
    sd.forEach((s, i) => s.state = bits(v)[i]);
    W.state = 1; CK.state = 0; sim(); CK.state = 1; sim(); W.state = 0; CK.state = 0; sim();
  };
  ecrire(3, 9); ecrire(10, 5); ecrire(0, 15);
  const lire = a => { sw.forEach((s, i) => s.state = bits(a)[i]); sim(); return ram2.outPins[0].state; };
  eq(lire(3), 9, 'case 3');
  eq(lire(10), 5, 'case 10');
  eq(lire(0), 15, 'case 0');
  eq(lire(7), 0, 'case jamais écrite');
  // sans W, le front n’écrit rien
  sw.forEach((s, i) => s.state = bits(3)[i]);
  sd.forEach((s, i) => s.state = bits(1)[i]);
  CK.state = 0; sim(); CK.state = 1; sim();
  eq(lire(3), 9, 'écriture refusée quand W=0');
});

T('T83 entrées d’atelier : arrêt d’urgence, DIP 8, sélecteur, impulsion', () => {
  board();
  const es = mk('ESTOP', 0, 0), dip = mk('DIP8', 200, 0), sel = mk('SEL3', 400, 0), imp = mk('IMPBTN', 600, 0);
  sim();
  eq(es.outPins[0].state, 1, 'arrêt d’urgence armé : contact fermé');
  REG.ESTOP.click(es); sim();
  eq(es.outPins[0].state, 0, 'enfoncé : le contact s’ouvre');
  REG.ESTOP.click(es); sim();
  eq(es.outPins[0].state, 1, 'déverrouillé');
  REG.DIP8.click(dip, dip.x + 40, dip.y + 12 + 2 * 22);   // 3e interrupteur
  REG.DIP8.click(dip, dip.x + 40, dip.y + 12 + 7 * 22);   // 8e interrupteur
  sim();
  deq(dip.outPins.map(p => p.state), [0,0,1,0,0,0,0,1], 'DIP : deux bits levés');
  deq(sel.outPins.map(p => p.state), [1,0,0], 'sélecteur en position I');
  REG.SEL3.click(sel); sim();
  deq(sel.outPins.map(p => p.state), [0,1,0], 'position II');
  REG.SEL3.click(sel); REG.SEL3.click(sel); sim();
  deq(sel.outPins.map(p => p.state), [1,0,0], 'retour en I après trois crans');
  sim(); eq(imp.outPins[0].state, 0, 'bouton à impulsion au repos');
  REG.IMPBTN.click(imp); sim();
  eq(imp.outPins[0].state, 1, 'impulsion émise');
  __advance(400); sim();
  eq(imp.outPins[0].state, 0, 'impulsion terminée toute seule');
});

T('T84 relais : contacts NO et NF', () => {
  board();
  const cmd = mk('SWITCH', 0, 0), src = mk('HIGH', 0, 200), r = mk('RELAY', 300, 0);
  const no = mk('LED', 600, 0), nf = mk('LED', 600, 200);
  link(cmd, 0, r, 0); link(src, 0, r, 1);
  link(r, 0, no, 0); link(r, 1, nf, 0);
  sim();
  eq(no.inPins[0].state ? 1 : 0, 0, 'au repos : NO ouvert');
  eq(nf.inPins[0].state ? 1 : 0, 1, 'au repos : NF passant');
  cmd.state = 1; sim();
  eq(no.inPins[0].state ? 1 : 0, 1, 'excité : NO passant');
  eq(nf.inPins[0].state ? 1 : 0, 0, 'excité : NF ouvert');
});

T('T85 vérin : course, fins de course et blocage', () => {
  board();
  const out = mk('SWITCH', 0, 0), inn = mk('SWITCH', 0, 200), j = mk('JACK', 300, 0);
  link(out, 0, j, 0); link(inn, 0, j, 1);
  applyInspector(j, fld('o_sec', 1));
  sim();
  eq(j.outPins[0].state, 1, 'au départ : fin de course rentré');
  eq(j.outPins[1].state, 0, 'pas encore sorti');
  out.state = 1;
  for (let i = 0; i < 4; i++){ __advance(150); sim(); }
  ok(j.pos > 0.4 && j.pos < 0.8, 'la tige est en mouvement (' + j.pos.toFixed(2) + ')');
  eq(j.outPins[0].state, 0, 'plus en fin de course');
  for (let i = 0; i < 6; i++){ __advance(150); sim(); }
  eq(j.pos, 1, 'course terminée');
  sim();
  eq(j.outPins[1].state, 1, 'fin de course SORTI');
  out.state = 0; inn.state = 1;
  for (let i = 0; i < 10; i++){ __advance(150); sim(); }
  eq(j.pos, 0, 'retour complet');
  // les deux commandes ensemble : rien ne bouge
  out.state = 1; inn.state = 1;
  for (let i = 0; i < 5; i++){ __advance(150); sim(); }
  eq(j.pos, 0, 'commandes contradictoires : vérin bloqué');
});

T('T86 moteur pas à pas : un pas par front, sens réversible', () => {
  board();
  const clk = mk('SWITCH', 0, 0), dir = mk('SWITCH', 0, 200), st = mk('STEPPER', 300, 0);
  link(clk, 0, st, 0); link(dir, 0, st, 1);
  clk.state = 0; sim();
  for (let i = 0; i < 5; i++){ clk.state = 1; sim(); clk.state = 0; sim(); }
  eq(st.step, 5, 'cinq pas en avant');
  dir.state = 1;
  for (let i = 0; i < 2; i++){ clk.state = 1; sim(); clk.state = 0; sim(); }
  eq(st.step, 3, 'deux pas en arrière');
  sim();
  eq(st.outPins[0].state, 3, 'position publiée sur le bus');
});

T('T87 état propre des composants : sauvegardé et restauré', () => {
  board();
  const dip = mk('DIP8', 0, 0), sel = mk('SEL3', 200, 0), es = mk('ESTOP', 400, 0);
  const st = mk('STEPPER', 600, 0), j = mk('JACK', 800, 0);
  dip.bits = [1,0,0,1,0,1,1,0]; sel.pos = 2; es.pressed = 1; st.step = 7; j.pos = 0.5;
  const ram = mk('RAM16', 1000, 0);
  ram.cells[4] = 12; ram.cells[9] = 3;
  const data = serializeGroup(components);
  board();
  spawnGroup(data, 0, 0, false);
  const g = t => components.find(c => c.type === t);
  deq(g('DIP8').bits, [1,0,0,1,0,1,1,0], 'DIP restauré');
  eq(g('SEL3').pos, 2, 'sélecteur restauré');
  eq(g('ESTOP').pressed, 1, 'arrêt d’urgence restauré');
  eq(g('STEPPER').step, 7, 'position du pas-à-pas restaurée');
  eq(g('JACK').pos, 0.5, 'position du vérin restaurée');
  eq(g('RAM16').cells[4], 12, 'contenu de la RAM restauré');
  eq(g('RAM16').cells[9], 3, 'contenu de la RAM restauré (2)');
});

T('T88 chaîne d’automatisme complète : marche/arrêt, sécurité, va-et-vient', () => {
  board();
  // Marche / arrêt avec arrêt d'urgence prioritaire, pilotant un va-et-vient de vérin
  const marche = mk('SWITCH', 0, 0), arret = mk('SWITCH', 0, 120), es = mk('ESTOP', 0, 240);
  const notEs = mk('NOT', 200, 240), ouArret = mk('OR', 380, 180);
  const mem = mk('SRMEM', 560, 60), j = mk('JACK', 760, 60);
  const sens = mk('SRMEM', 560, 400);          // mémoire de sens : sortir / rentrer
  const etOut = mk('AND', 980, 0), etIn = mk('AND', 980, 200), nSens = mk('NOT', 780, 400);
  link(marche, 0, mem, 0);
  link(arret, 0, ouArret, 0);
  link(es, 0, notEs, 0); link(notEs, 0, ouArret, 1);
  link(ouArret, 0, mem, 1);
  // Les fins de course mémorisent le sens : sans cette mémoire, la commande
  // s'annulerait dès que la tige quitte son point de départ.
  link(j, 1, sens, 0);                        // sorti  -> il faut rentrer
  link(j, 0, sens, 1);                        // rentré -> il faut sortir
  link(sens, 0, nSens, 0);
  link(mem, 0, etOut, 0); link(nSens, 0, etOut, 1);
  link(mem, 0, etIn, 0);  link(sens, 0, etIn, 1);
  link(etOut, 0, j, 0); link(etIn, 0, j, 1);
  applyInspector(j, fld('o_sec', 1));
  sim();
  eq(mem.q, 0, 'à l’arrêt au départ');
  marche.state = 1; sim(); marche.state = 0; sim();
  eq(mem.q, 1, 'la marche se maintient');
  let sorti = false, revenu = false, cycles = 0;
  for (let i = 0; i < 60; i++){
    __advance(150); sim();
    if (j.pos > 0.97 && !sorti) sorti = true;
    if (sorti && j.pos < 0.03 && !revenu){ revenu = true; cycles++; }
  }
  ok(sorti, 'le vérin est allé jusqu’au bout tout seul');
  ok(revenu, 'puis il est revenu : le va-et-vient s’entretient sans horloge');
  ok(j.pos > 0.03, 'et il est reparti pour un tour');
  REG.ESTOP.click(es); sim();
  eq(mem.q, 0, 'l’arrêt d’urgence coupe tout');
  marche.state = 1; sim();
  eq(mem.q, 0, 'et empêche le redémarrage tant qu’il est enfoncé');
  REG.ESTOP.click(es); sim();
  eq(mem.q, 1, 'redémarrage possible une fois déverrouillé');
});

/* ===================== 6ter. Analogique, capteurs, régulation ===================== */
console.log('— Analogique & régulation —');

T('T89 capteurs : mesure physique, valeur brute et seuil', () => {
  board();
  const t = mk('TEMPC', 0, 0), l = mk('LDR', 300, 0), d = mk('DIST', 600, 0);
  sim();
  eq(t.outPins[0].state, phys2raw(20, -10, 50), '20 °C → valeur brute');
  eq(t.outPins[1].state, 0, '20 °C sous le seuil de 25 °C');
  applyInspector(t, fld('o_val', 30)); sim();
  eq(t.outPins[1].state, 1, '30 °C : seuil dépassé');
  eq(t.outPins[0].state, phys2raw(30, -10, 50), 'valeur brute suit la mesure');
  applyInspector(t, fld('o_val', 99));
  eq(optOf(t, 'val'), 50, 'mesure bornée au maximum du capteur');
  applyInspector(l, fld('o_seuil', 500)); applyInspector(l, fld('o_val', 800)); sim();
  eq(l.outPins[1].state, 1, 'lumière au-dessus du seuil');
  eq(d.outPins[0].state, phys2raw(120, 0, 400), 'distance convertie');
  // le clic balaye l’échelle
  const v0 = optOf(d, 'val');
  REG.DIST.click(d);
  eq(optOf(d, 'val'), v0 + 40, 'clic : +1/10 d’échelle');
});

T('T90 conversions CAN et CNA : aller-retour sans perte', () => {
  board();
  const pot = mk('POT', 0, 0), can = mk('CAN', 300, 0), cna = mk('CNA', 600, 0);
  const jauge = mk('JAUGE', 900, 0);
  link(pot, 0, can, 0);
  can.outPins.forEach((p, i) => wires.push(new Wire(p, cna.inPins[i])));
  link(cna, 0, jauge, 0);
  recalcFan();
  [0, 25, 50, 75, 100].forEach(pc => {
    applyInspector(pot, fld('o_val', pc)); sim();
    const brut = phys2raw(pc, 0, 100);
    eq(can.raw, brut, pc + ' % → ' + brut);
    eq(cna.outPins[0].state, brut, 'reconverti à l’identique');
    eq(jauge.raw, brut, 'la jauge reçoit la valeur');
  });
  applyInspector(pot, fld('o_val', 100)); sim();
  deq(can.outPins.map(p => p.state), [1,1,1,1,1,1,1,1], '255 = 11111111');
});

T('T91 PWM : le rapport cyclique suit la valeur d’entrée', () => {
  board();
  const pot = mk('POT', 0, 0), en = mk('HIGH', 0, 200), pwm = mk('PWM', 300, 0);
  link(pot, 0, pwm, 0); link(en, 0, pwm, 1);
  applyInspector(pwm, fld('o_hz', 1));            // période 1000 ms
  applyInspector(pot, fld('o_val', 25));          // ≈ 64/255
  __setNow(1000000); sim();
  eq(pwm.outPins[0].state, 1, 'début de période : à 1');
  __setNow(1000000 + 300); sim();
  eq(pwm.outPins[0].state, 0, 'après 30 % de la période : à 0');
  applyInspector(pot, fld('o_val', 90));
  __setNow(1000000 + 800); sim();
  eq(pwm.outPins[0].state, 1, 'à 90 %, encore à 1 en fin de période');
  applyInspector(pot, fld('o_val', 0));
  __setNow(1000000); sim();
  eq(pwm.outPins[0].state, 0, '0 % : toujours éteint');
  __setNow(__T0);
});

T('T92 thermostat : hystérésis et sens d’action', () => {
  board();
  const pot = mk('POT', 0, 0), th = mk('THERMO', 300, 0);
  link(pot, 0, th, 0);
  applyInspector(th, fld('o_cons', 128)); applyInspector(th, fld('o_hyst', 12));
  applyInspector(pot, fld('o_val', 20)); sim();      // ≈ 51 brut, très en dessous
  eq(th.outPins[0].state, 1, 'sous la consigne : ça chauffe');
  applyInspector(pot, fld('o_val', 50)); sim();      // ≈ 128, dans la zone morte
  eq(th.outPins[0].state, 1, 'dans la zone morte : pas de changement d’avis');
  applyInspector(pot, fld('o_val', 90)); sim();      // ≈ 230, bien au-dessus
  eq(th.outPins[0].state, 0, 'au-dessus : arrêt');
  applyInspector(pot, fld('o_val', 50)); sim();
  eq(th.outPins[0].state, 0, 'zone morte : reste arrêté');
  applyInspector(pot, fld('o_val', 20)); sim();
  eq(th.outPins[0].state, 1, 'sous le seuil bas : relance');
  applyInspector(th, Object.assign(fld('o_sens', 'refr'), { tagName:'SELECT' }));
  applyInspector(pot, fld('o_val', 90)); sim();
  eq(th.outPins[0].state, 1, 'en mode refroidissement, la logique s’inverse');
});

T('T93 comparateur à hystérésis (Schmitt) et limiteur', () => {
  board();
  const pot = mk('POT', 0, 0), sc = mk('SCHMITT', 300, 0), li = mk('LIMIT', 300, 300);
  link(pot, 0, sc, 0); link(pot, 0, li, 0);
  applyInspector(sc, fld('o_haut', 200)); applyInspector(sc, fld('o_bas', 80));
  applyInspector(li, fld('o_min', 40)); applyInspector(li, fld('o_max', 150));
  const set = pc => { applyInspector(pot, fld('o_val', pc)); sim(); };
  set(0);  eq(sc.outPins[0].state, 0, 'départ bas');
  set(50); eq(sc.outPins[0].state, 0, '≈128 : pas encore le seuil haut');
  set(90); eq(sc.outPins[0].state, 1, '≈230 : bascule');
  set(50); eq(sc.outPins[0].state, 1, 'reste haut dans la zone d’hystérésis');
  set(10); eq(sc.outPins[0].state, 0, 'sous le seuil bas : retombe');
  set(0);   eq(li.outPins[0].state, 40, 'limiteur : plancher');
  set(100); eq(li.outPins[0].state, 150, 'limiteur : plafond');
  set(30);  eq(li.outPins[0].state, phys2raw(30, 0, 100), 'entre les deux : inchangé');
});

T('T94 rampe : la sortie rejoint la cible à pente limitée', () => {
  board();
  const pot = mk('POT', 0, 0), r = mk('RAMPE', 300, 0);
  link(pot, 0, r, 0);
  applyInspector(r, fld('o_vit', 100));           // 100 unités par seconde
  applyInspector(pot, fld('o_val', 100));         // cible 255
  sim();
  eq(Math.round(r.val), 0, 'départ à zéro');
  for (let i = 0; i < 5; i++){ __advance(100); sim(); }   // le pas d’intégration est borné à 200 ms
  ok(r.val > 30 && r.val < 70, 'la moitié du chemin après 0,5 s (' + Math.round(r.val) + ')');
  for (let i = 0; i < 20; i++){ __advance(200); sim(); }
  eq(Math.round(r.val), 255, 'cible atteinte');
  applyInspector(pot, fld('o_val', 0));
  for (let i = 0; i < 20; i++){ __advance(200); sim(); }
  eq(Math.round(r.val), 0, 'et redescend de la même façon');
});

T('T95 boucle fermée : four + thermostat régulent la température', () => {
  board();
  const four = mk('FOUR', 400, 0), th = mk('THERMO', 100, 0), cna = mk('CNA', 260, 300);
  // FOUR → THERMOSTAT → CNA (poids 128 = pleine chauffe) → FOUR : la boucle est fermée
  link(four, 0, th, 0);
  link(th, 0, cna, 0);
  link(cna, 0, four, 0);
  applyInspector(th, fld('o_cons', 100)); applyInspector(th, fld('o_hyst', 10));
  applyInspector(four, fld('o_inert', 2));
  eq(Math.round(four.temp), 0, 'four froid au départ');
  let atteint = false, coupe = false, relance = false, dernier = 1;
  for (let i = 0; i < 400; i++){
    __advance(100); sim();
    if (four.temp > 90) atteint = true;
    if (atteint && th.outPins[0].state === 0) coupe = true;
    if (coupe && th.outPins[0].state === 1) relance = true;
    dernier = th.outPins[0].state;
  }
  ok(atteint, 'le four monte jusqu’à la consigne (' + Math.round(four.temp) + ')');
  ok(coupe, 'le thermostat coupe au-dessus de la consigne');
  ok(relance, 'puis relance quand ça redescend : la régulation cycle');
  ok(four.temp > 80 && four.temp < 130, 'la température reste autour de la consigne (' +
     Math.round(four.temp) + ')');
});

T('T96 cuve : remplissage automatique entre deux seuils', () => {
  board();
  const cuve = mk('CUVE', 400, 0), mem = mk('SRMEM', 100, 0);
  link(cuve, 2, mem, 0);                 // niveau BAS  -> marche pompe
  link(cuve, 1, mem, 1);                 // niveau HAUT -> arrêt pompe
  link(mem, 0, cuve, 0);                 // pompe -> remplissage
  applyInspector(cuve, fld('o_debit', 50));
  applyInspector(cuve, fld('o_bas', 20)); applyInspector(cuve, fld('o_haut', 80));
  cuve.niv = 10; sim();
  eq(cuve.outPins[2].state, 1, 'niveau bas détecté');
  for (let i = 0; i < 40; i++){ __advance(100); sim(); }
  ok(cuve.niv >= 80, 'la cuve s’est remplie toute seule (' + Math.round(cuve.niv) + ' %)');
  eq(mem.q, 0, 'la pompe s’est arrêtée au niveau haut');
  eq(cuve.outPins[1].state, 1, 'seuil haut signalé');
  // vidange manuelle : la pompe ne repart qu'au niveau bas
  cuve.niv = 50; sim();
  eq(mem.q, 0, 'à mi-hauteur, la pompe reste arrêtée : c’est l’hystérésis');
  cuve.niv = 15; sim();
  eq(mem.q, 1, 'sous le niveau bas, elle repart');
});

T('T97 vérins, servos et jauges acceptent une valeur de bus sans avertissement', () => {
  board();
  const pot = mk('POT', 0, 0), servo = mk('SERVO', 300, 0), jauge = mk('JAUGE', 600, 0);
  link(pot, 0, servo, 0); link(pot, 0, jauge, 0);
  applyInspector(pot, fld('o_val', 100)); sim();
  ok(!servo.inPins[0].busWarn, 'servo : pin bus déclaré');
  ok(!jauge.inPins[0].busWarn, 'jauge : pin bus déclaré');
  for (let i = 0; i < 15; i++){ __advance(150); sim(); }
  ok(Math.abs(servo.ang - Math.PI) < 0.1, 'le servo atteint 180° (' + Math.round(servo.ang * 180 / Math.PI) + '°)');
  applyInspector(pot, fld('o_val', 0));
  for (let i = 0; i < 15; i++){ __advance(150); sim(); }
  ok(servo.ang < 0.1, 'et revient à 0°');
});

/* ===================== 6quater. Solveur et tuteur ===================== */
console.log('— Solveur & tuteur —');

T('T102 solveur : formes simplifiées attendues', () => {
  // ET : une seule ligne à 1 -> un seul terme de deux littéraux
  let r = sopTerms([[0],[0],[0],[1]], 2, 0);
  eq(r.terms.length, 1, 'ET : un terme');
  eq(r.terms[0].length, 2, 'ET : deux littéraux');
  ok(r.terms[0].every(l => !l.neg), 'ET : aucun littéral inversé');
  // OU : simplification en deux termes d’un seul littéral
  r = sopTerms([[0],[1],[1],[1]], 2, 0);
  eq(r.terms.length, 2, 'OU : deux termes');
  ok(r.terms.every(t => t.length === 1), 'OU : simplifié à un littéral par terme');
  // XOR : deux termes de deux littéraux (pas simplifiable)
  r = sopTerms([[0],[1],[1],[0]], 2, 0);
  eq(r.terms.length, 2, 'XOR : deux termes');
  ok(r.terms.every(t => t.length === 2), 'XOR : irréductible');
  // constantes
  eq(sopTerms([[0],[0]], 1, 0).konst, 0, 'toujours 0');
  eq(sopTerms([[1],[1]], 1, 0).konst, 1, 'toujours 1');
  // majorité 3 entrées : 3 termes de 2 littéraux après simplification
  const maj = [[0],[0],[0],[1],[0],[1],[1],[1]];
  r = sopTerms(maj, 3, 0);
  eq(r.terms.length, 3, 'majorité : 3 termes');
  ok(r.terms.every(t => t.length === 2), 'majorité : simplifiée à 2 littéraux par terme');
});

T('T103 solveur : le circuit produit RÉELLEMENT la table demandée', () => {
  let testees = 0, portes = 0;
  missions.forEach((m, idx) => {
    if (!m.tt.length || m.inputs < 1 || m.inputs > 4 || m.bb) return;
    const sol = buildSolution(m);
    ok(sol, m.id + ' : solution construite');
    loadMission(idx);
    applySolution(sol, -1);
    const io = missionIO();
    eq(io.ins.length, m.inputs, m.id + ' : entrées');
    const saved = io.ins.map(c => c.state);
    const passes = components.length + wires.length + 10;
    for (let i = 0; i < m.tt.length; i++){
      for (let j = 0; j < m.inputs; j++) io.ins[j].state = (i >> (m.inputs - 1 - j)) & 1;
      simulate(passes);
      const got = io.outs.map(o => o.inPins[0].state ? 1 : 0);
      deq(got, m.tt[i], m.id + ' ligne ' + i);
    }
    io.ins.forEach((c, j) => c.state = saved[j]);
    testees++; portes += sol.gates;
  });
  ok(testees > 40, 'au moins 40 missions combinatoires résolues (' + testees + ')');
  console.log('        → ' + testees + ' missions résolues automatiquement, ' + portes + ' portes engendrées');
  loadMission(-1);
});

T('T104 solveur : la vérification de mission accepte la solution engendrée', () => {
  ['m2','m3','m5','m7','m12'].forEach(id => {
    const idx = missions.findIndex(m => m.id === id);
    if (idx < 0) return;
    loadMission(idx);
    delete progress.done[id];
    applySolution(buildSolution(missions[idx]), -1);
    __fire('btn-verify', 'click');
    ok(progress.done[id], id + ' : mission validée par la solution du solveur');
  });
  loadMission(-1);
});

T('T105 solveur : pose progressive, étape par étape', () => {
  const idx = missions.findIndex(m => m.id === 'm7');   // XOR ou équivalent
  loadMission(idx);
  const m = missions[idx];
  const sol = buildSolution(m);
  ok(sol.steps.length >= 2, 'plusieurs étapes');
  const base = components.length;
  let dernier = base;
  for (let k = 1; k <= sol.steps.length; k++){
    loadMission(idx);
    applySolution(sol, k);
    ok(components.length >= dernier || k === 1, 'étape ' + k + ' : le circuit grandit');
    dernier = components.length;
  }
  eq(components.length, base + sol.comps.length, 'à la dernière étape, tout est posé');
  sol.steps.forEach((st, i) => {
    ok(st.txt && st.txt.length > 10, 'étape ' + i + ' : texte');
    ok(st.why && st.why.length > 20, 'étape ' + i + ' : explication');
  });
  loadMission(-1);
});

T('T106 solveur : conversion en base NAND / NOR et respect des contraintes', () => {
  const nand = missions.find(m => m.allowed && m.allowed.join() === 'NAND' && m.tt.length);
  ok(nand, 'une mission « NAND uniquement » existe');
  const sol = buildSolution(nand);
  eq(sol.basis, 'NAND', 'base détectée');
  ok(sol.types.filter(t => LOGIC_TYPES.includes(t)).every(t => t === 'NAND'),
    'le circuit engendré n’utilise que des NAND : ' + sol.types.join(','));
  const contraintes = missions.map((m, i) => [m, i])
    .filter(([m]) => m.tt.length && m.inputs >= 1 && m.inputs <= 4 && !m.bb && (m.allowed || m.maxGates));
  ok(contraintes.length >= 5, contraintes.length + ' missions sous contrainte');
  const nonConformes = [];
  contraintes.forEach(([m, i]) => {
    const so = buildSolution(m);
    if (!so.conforme){ nonConformes.push(m.id); return; }
    loadMission(i);
    delete progress.done[m.id];
    applySolution(so, -1);
    __fire('btn-verify', 'click');
    ok(progress.done[m.id], m.id + ' : la solution engendrée passe la vérification sous contrainte');
  });
  console.log('        → ' + (contraintes.length - nonConformes.length) + '/' + contraintes.length +
    ' missions sous contrainte résolues automatiquement' +
    (nonConformes.length ? ' (hors barème : ' + nonConformes.join(', ') + ')' : ''));
  loadMission(-1);
});

T('T107 diagnostic en direct : compte les lignes justes et pointe l’erreur', () => {
  const idx = missions.findIndex(m => m.id === 'm3');   // OU
  loadMission(idx);
  const io = missionIO();
  let r = liveCheck();
  ok(r, 'diagnostic disponible');
  eq(r.total, 4, '4 lignes');
  eq(r.bon, 1, 'circuit vide : seule la ligne 0 0 → 0 est juste');
  ok(r.premierEchec, 'une erreur est pointée');
  eq(r.premierEchec.i, 1, 'première ligne fausse');
  const g = mk('AND', 400, 200);                        // mauvaise porte
  link(io.ins[0], 0, g, 0); link(io.ins[1], 0, g, 1); link(g, 0, io.outs[0], 0);
  r = liveCheck();
  eq(r.bon, 2, 'avec un ET : 2 lignes justes sur 4');
  deleteComponent(g);
  const g2 = mk('OR', 400, 200);
  link(io.ins[0], 0, g2, 0); link(io.ins[1], 0, g2, 1); link(g2, 0, io.outs[0], 0);
  r = liveCheck();
  eq(r.bon, 4, 'avec un OU : tout est juste');
  eq(r.premierEchec, null, 'aucune erreur');
  __advance(800); liveTick();
  ok(/lignes sont justes/.test(__el('live-box').innerHTML), 'message de réussite affiché');
  loadMission(-1);
});

T('T108 diagnostic : un circuit séquentiel n’est pas jugé en continu', () => {
  const idx = missions.findIndex(m => m.id === 'm2');
  loadMission(idx);
  mk('DFF', 400, 300);
  const r = liveCheck();
  ok(r && r.seq, 'séquentiel détecté');
  __advance(800); liveTick();
  ok(/séquentiel/i.test(__el('live-box').innerHTML), 'message adapté');
  loadMission(-1);
});

T('T109 tuteur : fantômes, pas-à-pas et solution complète', () => {
  const idx = missions.findIndex(m => m.id === 'm7');
  loadMission(idx);
  delete progress.done['m7'];
  const base = components.length;
  __fire('btn-tutor', 'click');
  ok(tutor, 'tuteur ouvert');
  ok(!__el('tutor-box').classList.contains('hidden'), 'panneau visible');
  eq(Object.keys(tutor.ghosts).length, tutor.sol.comps.length, 'un fantôme par composant à poser');
  eq(components.length, base, 'aucun composant réel posé pour l’instant');
  ok(/ÉTAPE 1/.test(__el('tutor-step').textContent), 'première étape annoncée');
  ok(__el('tutor-why').innerHTML.length > 20, 'explication affichée');
  drawScene(0);                                   // les fantômes doivent se dessiner
  const n0 = Object.keys(tutor.ghosts).length;
  __fire('tutor-place', 'click');
  ok(Object.keys(tutor.ghosts).length < n0, 'les fantômes de l’étape sont devenus réels');
  ok(components.length > base, 'des composants sont posés');
  __fire('tutor-all', 'click');
  eq(Object.keys(tutor.ghosts).length, 0, 'plus aucun fantôme');
  eq(components.length, base + tutor.sol.comps.length, 'tout est posé');
  const r = liveCheck();
  eq(r.premierEchec, null, 'la solution posée est juste');
  __fire('btn-verify', 'click');
  ok(progress.done['m7'], 'et elle passe la vérification');
  __fire('tutor-close', 'click');
  ok(!tutor, 'tuteur refermé');
  loadMission(-1);
});

T('T110 tuteur : refusé sur une boîte noire, replié en sandbox', () => {
  loadMission(missions.findIndex(m => m.id === 'm79'));
  ok(__el('btn-tutor').classList.contains('hidden'), 'bouton masqué en boîte noire');
  openTutor();
  ok(!tutor, 'aucune solution montrée sur une boîte noire');
  loadMission(-1);
  ok(__el('btn-tutor').classList.contains('hidden'), 'bouton masqué en sandbox');
  eq(liveCheck(), null, 'pas de diagnostic hors mission');
});

/* ===================== 7. Interface & export ===================== */
console.log('— Interface & export —');

T('T52 bus normalisé : le pin concerné est marqué (anneau d’avertissement)', () => {
  board();
  const sw = [0,1,2,3].map(i => mk('SWITCH', 0, i * 80));
  const gp = mk('GROUP', 300, 0), and = mk('AND', 600, 0), ug = mk('UNGROUP', 600, 400);
  sw.forEach((s, i) => link(s, 0, gp, i));
  link(gp, 0, and, 0); link(gp, 0, ug, 0);
  drive(sw, [0,1,0,0]);                       // bus = 4
  eq(and.inPins[0].busWarn, 1, 'porte classique : bus signalé');
  ok(!ug.inPins[0].busWarn, 'DÉGROUPER : consommateur légitime, aucun avertissement');
  drive(sw, [0,0,0,1]);                       // bus = 1 : plus un bus
  ok(!and.inPins[0].busWarn, 'valeur 1 : rien à signaler');
  drive(sw, [0,0,0,0]);
  ok(!and.inPins[0].busWarn, 'bus nul : rien à signaler');
});

T('T53 export PNG : recadrage automatique sur le circuit', () => {
  board();
  mk('AND', 1000, 800); mk('OR', -400, -200);
  const bb = boardBBox();
  ok(bb, 'boîte englobante calculée');
  ok(bb.x0 <= -400 && bb.x1 >= 1000, 'elle couvre tout le montage');
  const saved = { x:cam.x, y:cam.y, z:cam.z };
  const snap = snapshotPNG();
  ok(/^data:image\/png/.test(snap.url), 'image produite');
  ok(snap.fitted, 'recadrage effectué');
  deq({ x:cam.x, y:cam.y, z:cam.z }, saved, 'caméra restaurée après l’export');
  camFitTo(bb);
  eq(Math.round((bb.x0 + bb.w / 2) * cam.z + cam.x), Math.round(W / 2), 'circuit centré en x');
  eq(Math.round((bb.y0 + bb.h / 2) * cam.z + cam.y), Math.round(H / 2), 'circuit centré en y');
  ok(cam.z >= .35 && cam.z <= 2.5, 'zoom dans les bornes');
  resetCam();
  board();
  eq(boardBBox(), null, 'plateau vide : pas de boîte englobante');
  eq(snapshotPNG().fitted, false, 'on retombe sur la vue actuelle');
});

T('T54 inspecteur : placement à droite, bascule à gauche près du bord', () => {
  board();
  const c1 = mk('CLOCK', 100, 200);
  openInspector(c1);
  const el = __el('inspector');
  ok(!el.classList.contains('hidden'), 'panneau ouvert');
  eq(el.style.left, (100 + c1.w + 16) + 'px', 'placé à droite du composant');
  closeInspector();
  ok(el.classList.contains('hidden'), 'panneau refermé');
  const c2 = mk('CLOCK', 1300, 200);
  openInspector(c2);
  eq(el.style.left, (1300 - 250 - 16) + 'px', 'basculé à gauche faute de place à droite');
  closeInspector();
  const c3 = mk('CLOCK', 100, -500);
  openInspector(c3);
  eq(el.style.top, '60px', 'jamais sous la barre du haut');
  closeInspector();
});

T('T55 inspecteur : verrouillé et boîte noire restent inaccessibles', () => {
  board();
  const c = mk('AND', 100, 100);
  c.locked = true;
  openInspector(c);
  ok(__el('inspector').classList.contains('hidden'), 'composant verrouillé : pas d’inspecteur');
  const bb = mk('BLACKBOX', 300, 100);
  openInspector(bb);
  ok(__el('inspector').classList.contains('hidden'), 'boîte noire : pas d’inspecteur');
});

T('T56 tactile : l’appui long ouvre l’inspecteur sans déclencher le clic', () => {
  board();
  const clk = mk('CLOCK', 100, 100);
  const idx0 = clk.clockIdx;
  const pending = [];
  const realST = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => { pending.push({ fn, ms }); return pending.length; };
  try {
    const pt = { clientX: 130, clientY: 130, pointerType:'touch', pointerId: 7 };
    canvas.dispatch('pointerdown', pt);
    const hold = pending.filter(x => x.ms === 550).pop();
    ok(hold, 'minuterie d’appui long armée');
    hold.fn();
    ok(!__el('inspector').classList.contains('hidden'), 'inspecteur ouvert par l’appui long');
    canvas.dispatch('pointerup', pt);
    eq(clk.clockIdx, idx0, 'le relâchement ne change pas le preset');
    // appui court : comportement habituel (cycle des presets)
    closeInspector();
    canvas.dispatch('pointerdown', pt);
    canvas.dispatch('pointerup', pt);
    eq(clk.clockIdx, (idx0 + 1) % CLOCK_SPEEDS.length, 'appui court = presets');
    ok(__el('inspector').classList.contains('hidden'), 'et pas d’inspecteur');
  } finally { globalThis.setTimeout = realST; }
});

T('T60 raccourcis clavier : Ctrl+Z/Y/D et Suppr', () => {
  board();
  __advance(500); const a = mk('AND', 100, 100); markDirty();
  __advance(500); mk('OR', 300, 100); markDirty();
  __fireWin('keydown', { key:'z', ctrlKey:true });
  eq(components.length, 1, 'Ctrl+Z annule');
  __fireWin('keydown', { key:'y', ctrlKey:true });
  eq(components.length, 2, 'Ctrl+Y refait');
  selection.clear(); selection.add(components[0]);
  __fireWin('keydown', { key:'d', ctrlKey:true });
  eq(components.length, 3, 'Ctrl+D duplique');
  __fireWin('keydown', { key:'Delete' });
  eq(components.length, 2, 'Suppr efface la sélection');
  __fireWin('keydown', { key:'Escape' });
  eq(selection.size, 0, 'Échap désélectionne');
});

T('T61 balisage : toutes les modales sont des .modal-overlay refermables', () => {
  const modals = [...__HTML.matchAll(/<div id="([\w-]+-modal)" class="([^"]+)"/g)];
  ok(modals.length >= 6, 'modales trouvées : ' + modals.length);
  modals.forEach(([, id, cls]) => {
    ok(/\bmodal-overlay\b/.test(cls),
      id + ' doit porter la classe modal-overlay (sinon elle reste affichée en permanence)');
  });
  ok(!/class="modal"/.test(__HTML), 'aucune classe « modal » orpheline');
  ok(!/data-close=/.test(__HTML), 'aucun bouton ✕ sans gestionnaire (data-close)');
});

T('T62 balisage : chaque getElementById du script vise un id existant', () => {
  const dyn = new Set(['btn-make-chip','btn-manage-chips','tool-search']);   // créés par buildToolbar()
  const ids = new Set([...__HTML.matchAll(/getElementById\('([\w-]+)'\)/g)].map(m => m[1]));
  const present = new Set([...__HTML.matchAll(/id="([\w-]+)"/g)].map(m => m[1]));
  const missing = [...ids].filter(i => !present.has(i) && !dyn.has(i));
  eq(missing.join(','), '', 'ids introuvables dans le HTML : ' + missing.join(', '));
});

T('T63 la modale de l’analyseur s’ouvre et se referme', () => {
  board();
  const a = mk('SWITCH', 0, 0), b = mk('SWITCH', 0, 200);
  const g = mk('XOR', 300, 100), l = mk('LED', 600, 100);
  link(a, 0, g, 0); link(b, 0, g, 1); link(g, 0, l, 0);
  __el('analyze-modal').classList.remove('show');
  __fire('btn-analyze', 'click');
  ok(__el('analyze-modal').classList.contains('show'), 'modale ouverte');
  const body = __el('analyze-body').innerHTML;
  ok(/⊕/.test(body), 'équation du XOR rendue');
  ok(/<table class="tt"/.test(body), 'table de vérité stylée comme celle du panneau');
  ok(!/id="truth-table"/.test(body), 'pas d’id dupliqué dans la page');
  __fire('btn-close-analyze', 'click');
  ok(!__el('analyze-modal').classList.contains('show'), 'refermée par le bouton');
  // en mission boîte noire, l'analyse est brouillée
  loadMission(missions.findIndex(m => m.id === 'm79'));
  __fire('btn-analyze', 'click');
  ok(/brouill/i.test(__el('analyze-body').innerHTML), 'analyse brouillée sur une boîte noire');
  __fire('btn-close-analyze', 'click');
  loadMission(-1);
});

T('T98 infobulle : composant, pin et câble', () => {
  board();
  const a = mk('SWITCH', 0, 0), g = mk('AND', 300, 0), l = mk('LED', 600, 0);
  a.customLabel = 'CAPTEUR';
  const w = link(a, 0, g, 0); link(g, 0, l, 0);
  a.state = 1; sim();
  const dc = compTipData(g);
  ok(/ET · AND/.test(dc.title), 'titre du composant');
  ok(dc.lines.join(' ').includes('entrées'), 'états des entrées');
  ok(/A=/.test(dc.lines.join(' ')) && /B=/.test(dc.lines.join(' ')), 'pins nommés A et B');
  ok(/S = A·B/.test(dc.lines.join(' ')), 'équation de la porte');
  ok(/coût/.test(dc.lines.join(' ')), 'coût en portes');
  const da = compTipData(a);
  ok(/CAPTEUR/.test(da.title), 'étiquette personnalisée dans le titre');
  const dp = pinTipData(g.inPins[0]);
  ok(/entrée/.test(dp.lines[0]), 'nature du pin');
  ok(/INTERRUPTEUR/.test(dp.lines[1]), 'source du signal');
  const dw = wireTipData(w);
  ok(/INTERRUPTEUR/.test(dw.lines[0]) && /ET/.test(dw.lines[0]), 'les deux extrémités du câble');
  ok(/valeur/.test(dw.lines[1]), 'valeur transportée');
  // un bus affiche sa valeur
  board();
  const sw = [0,1,2,3].map(i => mk('SWITCH', 0, i * 70));
  const gp = mk('GROUP', 300, 0), ug = mk('UNGROUP', 600, 0);
  sw.forEach((x, i) => link(x, 0, gp, i));
  const wb = link(gp, 0, ug, 0);
  drive(sw, [1,0,1,0]);
  ok(/bus 10/.test(wireTipData(wb).lines[1]), 'câble de bus : valeur lisible');
});

T('T99 infobulle : réglages, capteurs, et rien en boîte noire', () => {
  board();
  const t = mk('TEMPC', 0, 0);
  applyInspector(t, fld('o_val', 30)); sim();
  const d = compTipData(t);
  ok(/30/.test(d.lines.join(' ')), 'la mesure apparaît');
  ok(/seuil/i.test(d.lines.join(' ')), 'le seuil apparaît');
  ok(/réglages/.test(d.lines.join(' ')), 'les réglages sont listés');
  loadMission(missions.findIndex(m => m.id === 'm79'));
  const bb = components.find(c => c.type === 'BLACKBOX');
  const db = compTipData(bb);
  ok(/masqué/i.test(db.lines.join(' ')), 'la boîte noire ne révèle rien');
  ok(!/entrées/.test(db.lines.join(' ')), 'aucun état divulgué');
  loadMission(-1);
});

T('T100 noms des composants : bascule et raccourci N', () => {
  board();
  const avant = labelsMode;
  setLabelsMode(false);
  eq(labelsMode, false, 'noms masqués');
  eq(localStorage.getItem('al2_labels'), 'hover', 'préférence enregistrée');
  __fireWin('keydown', { key:'n' });
  eq(labelsMode, true, 'la touche N rebascule');
  __fire('btn-labels', 'click');
  eq(labelsMode, false, 'le bouton aussi');
  drawScene(0);                       // le rendu doit tenir dans les deux modes
  setLabelsMode(true); drawScene(0);
  setLabelsMode(avant);
});

T('T101 touche F : recadrage sur le circuit', () => {
  board();
  mk('AND', 2000, 1500); mk('OR', 2400, 1800);
  resetCam();
  __fireWin('keydown', { key:'f' });
  const bb = boardBBox();
  eq(Math.round((bb.x0 + bb.w / 2) * cam.z + cam.x), Math.round(W / 2), 'circuit centré');
  ok(cam.z <= 2.5 && cam.z >= .35, 'zoom valide');
  board();
  resetCam();
  const z = cam.z;
  __fireWin('keydown', { key:'f' });
  eq(cam.z, z, 'plan vide : la vue ne bouge pas');
});

T('T111 niveau de détail : le rendu se simplifie quand on dézoome', () => {
  board();
  for (let i = 0; i < 12; i++) mk('AND', (i % 4) * 200, Math.floor(i / 4) * 200);
  cam.z = 1;    drawScene(0); eq(lodLevel, 2, 'zoom normal : rendu détaillé');
  cam.z = .5;   drawScene(0); eq(lodLevel, 1, 'zoom moyen : rendu simplifié');
  cam.z = .38;  drawScene(0); eq(lodLevel, 0, 'très dézoomé : blocs');
  resetCam(); drawScene(0);
  eq(lodLevel, 2, 'retour au détail');
});

T('T112 mise en évidence du voisinage au survol', () => {
  board();
  // chaîne de 12 composants : A -> g1 -> g2 -> ... pour que le voisinage soit partiel
  const chain = [];
  let prev = mk('SWITCH', 0, 0);
  chain.push(prev);
  for (let i = 0; i < 11; i++){
    const g = mk('NOT', 200 + i * 160, 0);
    link(prev, 0, g, 0);
    chain.push(g); prev = g;
  }
  const set = neighbourhood(chain[5], 3);
  ok(set.has(chain[5]), 'le composant survolé est dedans');
  ok(set.has(chain[4]) && set.has(chain[6]), 'ses voisins directs aussi');
  ok(set.has(chain[2]) && set.has(chain[8]), 'jusqu’à trois sauts');
  ok(!set.has(chain[0]) && !set.has(chain[11]), 'mais pas tout le circuit');
  // le survol l’active, la sortie l’efface
  hoveredComp = chain[5]; tipFor = chain[5];
  refreshTip();
  ok(focusSet && focusSet.size === set.size, 'focus actif au survol');
  drawScene(0);
  hideTip();
  eq(focusSet, null, 'focus effacé quand l’infobulle disparaît');
  // circuit court : pas de mise en évidence, ce serait inutile
  board();
  const a = mk('SWITCH', 0, 0), g = mk('NOT', 200, 0);
  link(a, 0, g, 0);
  tipFor = a; refreshTip();
  eq(focusSet, null, 'moins de 10 composants : aucun estompage');
  hideTip();
});

/* ===================== 6quinquies. Orientation ===================== */
console.log('— Rotation & miroir —');

T('T113 rotation : les pins suivent le boîtier', () => {
  board();
  const g = mk('AND', 100, 100);
  const w0 = g.bw, h0 = g.bh;
  const inY = g.inPins[0].y, outX = g.outPins[0].x;
  ok(g.inPins[0].x < g.outPins[0].x, 'au départ : entrées à gauche, sortie à droite');
  deq(g.outPins[0].dir(), { x:1, y:0 }, 'sortie vers la droite');
  deq(g.inPins[0].dir(), { x:-1, y:0 }, 'entrée vers la gauche');
  selection.clear(); selection.add(g);
  rotateSel(1);
  eq(g.rot, 1, 'un quart de tour');
  eq(g.bw, h0, 'largeur et hauteur échangées');
  eq(g.bh, w0, 'largeur et hauteur échangées (2)');
  deq(g.outPins[0].dir(), { x:0, y:1 }, 'la sortie pointe vers le bas');
  ok(g.outPins[0].y > g.inPins[0].y, 'la sortie est passée sous les entrées');
  rotateSel(1); rotateSel(1);
  eq(g.rot, 3, 'trois quarts de tour');
  deq(g.outPins[0].dir(), { x:0, y:-1 }, 'la sortie pointe vers le haut');
  rotateSel(1);
  eq(g.rot, 0, 'quatre quarts : retour au départ');
  eq(g.bw, w0, 'encombrement retrouvé');
  rotateSel(-1);
  eq(g.rot, 3, 'Maj+R tourne dans l’autre sens');
});

T('T114 rotation : le composant reste sous le curseur et sélectionnable', () => {
  board();
  const g = mk('DFF', 200, 200);
  const cx = g.x + g.bw / 2, cy = g.y + g.bh / 2;
  selection.clear(); selection.add(g);
  rotateSel(1);
  ok(Math.abs((g.x + g.bw / 2) - cx) <= 8 && Math.abs((g.y + g.bh / 2) - cy) <= 8,
    'le centre du boîtier ne bouge quasiment pas');
  ok(g.isHit(g.x + 4, g.y + 4) && g.isHit(g.x + g.bw - 4, g.y + g.bh - 4),
    'la zone cliquable suit la rotation');
  ok(!g.isHit(g.x + g.bw + 40, g.y), 'et pas au-delà');
  eq(pickComp(g.x + g.bw / 2, g.y + g.bh / 2), g, 'sélectionnable au centre');
});

T('T115 miroir : les entrées passent à droite', () => {
  board();
  const g = mk('AND', 100, 100);
  const inX0 = g.inPins[0].x;
  selection.clear(); selection.add(g);
  mirrorSel();
  ok(g.mir, 'miroir posé');
  ok(g.inPins[0].x > g.outPins[0].x, 'entrées à droite, sortie à gauche');
  deq(g.inPins[0].dir(), { x:1, y:0 }, 'l’entrée regarde vers la droite');
  mirrorSel();
  eq(g.mir, false, 'retour à l’endroit');
  eq(g.inPins[0].x, inX0, 'position retrouvée');
});

T('T116 orientation : simulation, sérialisation et raccourcis', () => {
  board();
  const a = mk('SWITCH', 0, 0), b = mk('SWITCH', 0, 200);
  const g = mk('AND', 400, 100), l = mk('LED', 700, 100);
  link(a, 0, g, 0); link(b, 0, g, 1); link(g, 0, l, 0);
  selection.clear(); selection.add(g);
  rotateSel(1); mirrorSel();
  deq(measure([a, b], [l]).map(r => r[0]), [0,0,0,1], 'le circuit fonctionne à l’identique une fois tourné');
  const data = serializeGroup(components);
  ok(JSON.stringify(data).includes('"rot":1'), 'orientation sérialisée');
  board();
  spawnGroup(data, 0, 0, false);
  const g2 = components.find(c => c.type === 'AND');
  eq(g2.rot, 1, 'rotation restaurée');
  eq(g2.mir, true, 'miroir restauré');
  // raccourcis clavier
  board();
  const k = mk('OR', 100, 100);
  hoveredComp = k;
  __fireWin('keydown', { key:'r' });
  eq(k.rot, 1, 'la touche R tourne le composant survolé');
  __fireWin('keydown', { key:'m' });
  eq(k.mir, true, 'la touche M le retourne');
  hoveredComp = null;
});

T('T117 orientation : dessin et cadrage tiennent compte du boîtier tourné', () => {
  board();
  const list = ['AND','DFF','SEQ','MATRIX','FOUR','CUVE','DIP8','JAUGE','RELAY'];
  list.forEach((t, i) => {
    const c = mk(t, i * 260, 0);
    c.rot = (i % 4); c.mir = i % 2 === 0;
  });
  sim();
  drawScene(0);                       // aucun rendu ne doit lever d’exception
  const bb = boardBBox();
  components.forEach(c => {
    ok(bb.x1 >= c.x + c.bw && bb.y1 >= c.y + c.bh, FR_NAME[c.type] + ' : entièrement dans le cadrage');
  });
  // un séquenceur tourné : le clic sur une case est ramené dans son repère
  const sq = components.find(c => c.type === 'SEQ');
  sq.rot = 1; sq.mir = false;
  const local = { x: sq.x + 20, y: sq.y + 22 };
  const world = sq.l2w(local.x, local.y);
  const back = sq.w2l(world.x, world.y);
  ok(Math.abs(back.x - local.x) < .01 && Math.abs(back.y - local.y) < .01,
    'changement de repère réversible');
});

/* ===================== 6sexies. Tunnels, puces, automate ===================== */
console.log('— Tunnels, puces, automate —');

T('T118 tunnels : le signal traverse sans fil', () => {
  board();
  const a = mk('SWITCH', 0, 0), t1 = mk('TUNNEL', 200, 0);
  const t2 = mk('TUNNEL', 800, 300), led = mk('LED', 1000, 300);
  link(a, 0, t1, 0); link(t2, 0, led, 0);
  applyInspector(t1, Object.assign(fld('o_nom', 'CLK'), { type:'text' }));
  applyInspector(t2, Object.assign(fld('o_nom', 'clk'), { type:'text' }));
  a.state = 1; sim(); sim();
  eq(led.inPins[0].state ? 1 : 0, 1, 'la valeur passe d’un tunnel à l’autre (nom insensible à la casse)');
  a.state = 0; sim(); sim();
  eq(led.inPins[0].state ? 1 : 0, 0, 'et suit les changements');
  // un nom différent ne reçoit rien
  applyInspector(t2, Object.assign(fld('o_nom', 'AUTRE'), { type:'text' }));
  a.state = 1; sim(); sim();
  eq(led.inPins[0].state ? 1 : 0, 0, 'nom différent : aucun lien');
  // trois tunnels du même nom : tous reçoivent
  applyInspector(t2, Object.assign(fld('o_nom', 'CLK'), { type:'text' }));
  const t3 = mk('TUNNEL', 800, 600), led2 = mk('LED', 1000, 600);
  applyInspector(t3, Object.assign(fld('o_nom', 'CLK'), { type:'text' }));
  link(t3, 0, led2, 0);
  sim(); sim();
  eq(led2.inPins[0].state ? 1 : 0, 1, 'tous les tunnels du même nom sont reliés');
  // un bus passe aussi
  board();
  const sw = [0,1,2,3].map(i => mk('SWITCH', 0, i * 70));
  const g = mk('GROUP', 200, 0), ta = mk('TUNNEL', 400, 0), tb = mk('TUNNEL', 700, 0);
  const ug = mk('UNGROUP', 900, 0);
  sw.forEach((x, i) => link(x, 0, g, i));
  link(g, 0, ta, 0); link(tb, 0, ug, 0);
  applyInspector(ta, Object.assign(fld('o_nom', 'BUS'), { type:'text' }));
  applyInspector(tb, Object.assign(fld('o_nom', 'BUS'), { type:'text' }));
  drive(sw, [1,0,1,1]); sim();
  eq(tb.val, 11, 'un bus traverse le tunnel');
});

T('T119 puce depuis une sélection : les câbles frontière deviennent les pins', () => {
  board();
  CHIPS = CHIPS.filter(c => c.name !== 'TEST-SEL');
  const a = mk('SWITCH', 0, 0), b = mk('SWITCH', 0, 200);
  const x1 = mk('XOR', 300, 0), x2 = mk('AND', 300, 300), o = mk('OR', 560, 150);
  const led = mk('LED', 800, 150);
  link(a, 0, x1, 0); link(b, 0, x1, 1);
  link(a, 0, x2, 0); link(b, 0, x2, 1);
  link(x1, 0, o, 0); link(x2, 0, o, 1);
  link(o, 0, led, 0);
  selection.clear(); [x1, x2, o].forEach(c => selection.add(c));
  const r = createChipFromSelection('TEST-SEL');
  ok(r.def, 'puce créée : ' + (r.err || ''));
  eq(r.def.ins, 4, 'quatre entrées franchissent la frontière');
  eq(r.def.outs, 1, 'une seule sortie');
  // la puce reproduit le comportement du bloc encapsulé (ici : A+B, car XOR+ET puis OU)
  board();
  const chip = spawnChip('TEST-SEL');
  const s1 = mk('SWITCH', 0, 0), s2 = mk('SWITCH', 0, 200), out = mk('LED', 700, 0);
  link(s1, 0, chip, 0); link(s2, 0, chip, 1);
  link(s1, 0, chip, 2); link(s2, 0, chip, 3);
  link(chip, 0, out, 0);
  deq(measure([s1, s2], [out]).map(v => v[0]), [0,1,1,1], 'la puce se comporte comme le bloc d’origine');
  eq(chip.chipCost, 3, 'coût réel : trois portes');
  CHIPS = CHIPS.filter(c => c.name !== 'TEST-SEL'); saveChips();
});

T('T120 puce depuis sélection : refus argumentés', () => {
  board();
  selection.clear();
  ok(createChipFromSelection('X').err, 'sélection vide refusée');
  const a = mk('SWITCH', 0, 0), b = mk('SWITCH', 0, 100);
  selection.add(a); selection.add(b);
  ok(/logique/.test(createChipFromSelection('X').err || ''), 'deux interrupteurs : rien à encapsuler');
  loadMission(1);
  selection.clear();
  ok(/sandbox/i.test(createChipFromSelection('X').err || ''), 'interdit en mission');
  loadMission(-1);
});

T('T121 machine à états : transitions programmables, horloge et remise à zéro', () => {
  board();
  const A = mk('SWITCH', 0, 0), B = mk('SWITCH', 0, 100);
  const clk = mk('SWITCH', 0, 200), rst = mk('SWITCH', 0, 300);
  const f = mk('FSM', 300, 0);
  link(A, 0, f, 0); link(B, 0, f, 1); link(clk, 0, f, 2); link(rst, 0, f, 3);
  // cycle 0→1→2→3→0 quelles que soient les entrées
  [0,1,2,3].forEach(st => [0,1,2,3].forEach(k =>
    applyInspector(f, { dataset:{ fsm: st + ',' + k }, value:String((st + 1) % 4) })));
  clk.state = 0; sim();
  eq(f.st, 0, 'état initial');
  const vus = [];
  for (let i = 0; i < 5; i++){ clk.state = 1; sim(); clk.state = 0; sim(); vus.push(f.st); }
  deq(vus, [1,2,3,0,1], 'le cycle se déroule au rythme de l’horloge');
  sim();
  deq(f.outPins.map(p => p.state), [0,1,0,0], 'sortie one-hot de l’état courant');
  rst.state = 1; sim();
  eq(f.st, 0, 'remise à zéro');
  rst.state = 0;
  // transitions conditionnelles : depuis 0, aller en 2 seulement si A=1
  applyInspector(f, { dataset:{ fsm:'0,0' }, value:'0' });
  applyInspector(f, { dataset:{ fsm:'0,1' }, value:'0' });
  applyInspector(f, { dataset:{ fsm:'0,2' }, value:'2' });
  applyInspector(f, { dataset:{ fsm:'0,3' }, value:'2' });
  clk.state = 1; sim(); clk.state = 0; sim();
  eq(f.st, 0, 'A=0 : on reste en 0');
  A.state = 1;
  clk.state = 1; sim(); clk.state = 0; sim();
  eq(f.st, 2, 'A=1 : on part en 2');
});

T('T122 recherche de composant dans la barre d’outils', () => {
  ok(searchTypes('vérin').includes('JACK'), 'accent ignoré');
  ok(searchTypes('VERIN').includes('JACK'), 'casse ignorée');
  ok(searchTypes('bascule').includes('DFF'), 'nom complet');
  ok(searchTypes('tempo').length >= 2, 'plusieurs temporisations trouvées');
  ok(searchTypes('nand').includes('NAND') && searchTypes('nand').includes('NAND3'), 'variantes');
  ok(searchTypes('hystérésis').includes('THERMO') || searchTypes('hystérésis').includes('SCHMITT'),
    'recherche jusque dans le texte du guide');
  eq(searchTypes('zzzz').length, 0, 'aucune correspondance');
  ok(searchTypes('e').length <= 30, 'résultats bornés');
  // la barre se reconstruit sans erreur avec un filtre
  toolFilter = 'moteur'; buildToolbar(); updateToolbar();
  toolFilter = 'zzz'; buildToolbar(); updateToolbar();
  toolFilter = ''; buildToolbar(); updateToolbar();
  ok(TOOL_TABS.length >= 8, 'les onglets sont toujours là');
});

/* ===================== 6septies. Glissière de réglage ===================== */
console.log('— Glissière de réglage —');

T('T123 paramètre principal : détecté sur tout ce qui se règle', () => {
  board();
  const cas = [['TON','Durée'], ['CLOCK','Fréquence'], ['NIBBLE','Valeur'], ['THERMO','Consigne'],
               ['TEMPC','Mesure'], ['PWM','Fréquence'], ['DELAY','Retard'], ['JACK','Course complète'],
               ['DIVN','Diviser par'], ['RAMPE','Pente'], ['BUZZER','Hauteur du son']];
  cas.forEach(([t, lab]) => {
    const c = mk(t, 0, 0);
    const p = primaryParam(c);
    ok(p, t + ' : paramètre principal détecté');
    ok(p.label.startsWith(lab), t + ' : « ' + p.label +' » commence par « ' + lab + ' »');
    ok(typeof p.get(c) === 'number', t + ' : valeur lisible');
    ok(p.min < p.max && p.step > 0, t + ' : bornes cohérentes');
  });
  // ceux qui n'ont rien à régler n'ont pas de glissière
  ['AND','LED','SWITCH','GROUP','RELAY','TUNNEL','FSM'].forEach(t => {
    const c = mk(t, 0, 0);
    const p = primaryParam(c);
    if (t === 'TUNNEL' || t === 'FSM') ok(!p, t + ' : réglage non numérique, pas de glissière');
    else ok(!p, t + ' : rien à régler');
  });
  // un composant verrouillé n'est jamais réglable
  const l = mk('TON', 0, 0); l.locked = true;
  ok(!primaryParam(l), 'composant verrouillé : pas de glissière');
});

T('T124 glisser règle la valeur, avec bornes, pas et réglage fin', () => {
  board();
  const ton = mk('TON', 100, 100);
  const p = primaryParam(ton);
  const z = paramZone(ton);
  ok(z, 'zone de préhension définie');
  ok(paramHit(ton, z.x + z.w / 2, z.y + 4), 'la barre du bas est accrochable');
  ok(!paramHit(ton, z.x + z.w / 2, ton.y + 10), 'le haut du boîtier ne l’est pas');
  eq(optOf(ton, 'sec'), 2, 'valeur de départ');
  paramDragStart(ton, z.x + z.w / 2);
  paramDragMove(z.x + z.w / 2 + z.w / 4, false);      // +1/4 d’échelle
  const v = optOf(ton, 'sec');
  ok(v > 12 && v < 20, 'un quart de course ≈ +15 s (' + v + ')');
  paramDragMove(z.x + z.w * 5, false);
  eq(optOf(ton, 'sec'), 60, 'borné au maximum');
  paramDragMove(z.x - z.w * 5, false);
  eq(optOf(ton, 'sec'), 0.1, 'borné au minimum');
  // réglage fin
  paramDragEnd();
  paramDragStart(ton, 500); ton.opt.sec = 10;
  paramDragStart(ton, 500);
  paramDragMove(500 + z.w / 4, true);
  const vf = optOf(ton, 'sec');
  ok(vf > 10 && vf < 13, 'Maj : six fois plus fin (' + vf + ')');
  paramDragEnd();
  eq(paramDrag, null, 'geste terminé');
});

T('T125 glissière : composants historiques et capteurs', () => {
  board();
  const nb = mk('NIBBLE', 0, 0);
  const zn = paramZone(nb);
  paramDragStart(nb, zn.x);
  paramDragMove(zn.x + zn.w / 2, false);
  ok(nb.value >= 7 && nb.value <= 8, 'clavier 4 bits à mi-course (' + nb.value + ')');
  paramDragEnd();
  sim();
  deq(nb.outPins.map(p => p.state), [(nb.value>>3)&1, (nb.value>>2)&1, (nb.value>>1)&1, nb.value&1],
    'les sorties suivent immédiatement');
  const clk = mk('CLOCK', 300, 0);
  const zc = paramZone(clk);
  paramDragStart(clk, zc.x + zc.w / 2);
  paramDragMove(zc.x + zc.w / 2 + 20, false);
  ok(clk.opt.freq > 2, 'fréquence d’horloge réglée à la souris (' + clk.opt.freq + ' Hz)');
  paramDragEnd();
  const t = mk('TEMPC', 600, 0);
  const zt = paramZone(t);
  paramDragStart(t, zt.x + zt.w / 2);
  paramDragMove(zt.x + zt.w, false);
  eq(optOf(t, 'val'), 50, 'capteur poussé à sa pleine échelle');
  paramDragEnd();
  sim();
  eq(t.outPins[0].state, 255, 'la mesure brute suit');
});

T('T126 glissière : la rotation ne trompe pas la zone d’accroche', () => {
  board();
  const ton = mk('TON', 200, 200);
  ton.rot = 1;
  const z = paramZone(ton);
  const world = ton.l2w(z.x + z.w / 2, z.y + 4);
  ok(paramHit(ton, world.x, world.y), 'zone accrochable après rotation');
  ok(!paramHit(ton, ton.x + ton.bw / 2, ton.y + 6), 'et pas ailleurs');
  ton.rot = 0; ton.mir = true;
  const w2 = ton.l2w(z.x + z.w / 2, z.y + 4);
  ok(paramHit(ton, w2.x, w2.y), 'zone accrochable en miroir');
});

T('T127 glissière : le dessin et l’infobulle en parlent', () => {
  board();
  const ton = mk('TON', 100, 100);
  hoveredComp = ton;
  drawScene(0);                                   // le rendu avec glissière ne doit pas lever d’exception
  const d = compTipData(ton);
  ok(/glisse la barre/.test(d.lines.join(' ')), 'l’infobulle explique le geste');
  ok(/double-clic/.test(d.lines.join(' ')), 'et rappelle l’inspecteur pour la précision');
  hoveredComp = null;
  const led = mk('LED', 400, 100);
  ok(!/glisse la barre/.test(compTipData(led).lines.join(' ')), 'rien à dire sur un composant sans réglage');
});

/* ===================== 7. Guide ===================== */
console.log('— Guide —');

T('T57 le guide couvre tous les composants de la barre d’outils', () => {
  buildGuide();
  const html = __el('guide-body').innerHTML;
  ok(html.length > 4000, 'guide rendu');
  const covered = new Set();
  [...html.matchAll(/data-t="([^"]+)"/g)].forEach(m => m[1].split(' ').forEach(t => covered.add(t)));
  ok(covered.size > 0, 'les entrées du guide déclarent les types couverts (data-t)');
  const expected = TOOL_TABS.reduce((a, t) => a.concat(t.items), []).concat(['CHIP','BLACKBOX']);
  const missing = expected.filter(t => !covered.has(t));
  eq(missing.join(','), '', 'types non documentés : ' + missing.join(', '));
  covered.forEach(t => ok(FR_NAME[t], 'type inconnu déclaré dans le guide : ' + t));
});

T('T58 le guide documente les nouveautés v5 (inspecteur, analyseur, bus…)', () => {
  const html = __el('guide-body').innerHTML;
  [['double-clic', 'inspecteur'], ['🔬', 'analyseur'], ['ROM', 'ROM'],
   ['bus', 'bus'], ['SONDE|Sonde|sonde', 'sonde'], ['octet', 'octet']]
    .forEach(([re, what]) => ok(new RegExp(re, 'i').test(html), 'le guide parle de ' + what));
});

T('T59 le guide ne mentionne plus les anciens déblocages de mission', () => {
  const html = __el('guide-body').innerHTML;
  ok(!/récompense (de la )?mission/i.test(html), 'plus de « récompense mission » (déblocage total en v5)');
  ok(!/pour débloquer/i.test(html), 'plus de mention de déblocage');
});

/* ===================== bilan ===================== */
console.log('\n' + (__fail ? '✗' : '✓') + ' ' + __pass + ' test(s) réussi(s), ' +
            __fail + ' échec(s)' + (__fail ? ' : ' + __failures.join(', ') : '') + '\n');
return { passed: __pass, failed: __fail };
}
