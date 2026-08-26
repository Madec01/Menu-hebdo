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
/* Comparaison à tolérance : la chaîne de mesure est continue, pas entière */
function near(got, want, tol, msg){
  if (!(Math.abs(got - want) <= (tol == null ? 0.5 : tol)))
    fail('Assertion : ' + (msg || '') + ' — attendu ' + want + ' ± ' + (tol == null ? 0.5 : tol) +
      ', obtenu ' + got);
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
  // Un indice de borne qui n'existe pas fabriquait un fil à moitié vide, sans
  // rien dire, et l'erreur ressortait beaucoup plus loin.
  if (!a.outPins[ai || 0]) fail('link : ' + a.type + ' n’a pas de sortie ' + (ai || 0));
  if (!b.inPins[bi || 0])  fail('link : ' + b.type + ' n’a pas d’entrée ' + (bi || 0));
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

T('T33 tous les exemples se chargent et se simulent', () => {
  ok(EXAMPLES.length >= 23, 'catalogue d’exemples (' + EXAMPLES.length + ')');
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

T('T42 « donne-moi la solution » répond sur les 148 leçons', () => {
  missions.forEach((m, i) => {
    loadMission(i);
    __fire('btn-solution', 'click');
    ok(!__el('tutor-box').classList.contains('hidden'), m.id + ' : la leçon s’ouvre');
    const h = __el('tutor-txt').innerHTML;
    ok(h.length > 20, m.id + ' : la page a du texte (' + h.length + ')');
    // il doit toujours rester de quoi lire : au moins une page
    ok(/\d+ \/ \d+/.test(__el('tutor-dots').textContent), m.id + ' : pagination affichée');
    closeTutor();
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
    // une variante peut renvoyer à l'entrée de guide d'une autre (rails 4/8/12)
    const couvert = d.guide || Object.keys(REG).some(o =>
      REG[o].guide && (REG[o].guide.also || []).includes(id));
    ok(couvert, id + ' : couvert par une entrée de guide');
    if (d.guide) ok(d.guide.txt && d.guide.txt.length > 40, id + ' : entrée de guide rédigée');
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
  eq(t.outPins[0].state, phys2raw(20, { min:-10, max:50 }), '20 °C → valeur brute');
  eq(t.outPins[1].state, 0, '20 °C sous le seuil de 25 °C');
  applyInspector(t, fld('o_val', 30)); sim();
  eq(t.outPins[1].state, 1, '30 °C : seuil dépassé');
  eq(t.outPins[0].state, phys2raw(30, { min:-10, max:50 }), 'valeur brute suit la mesure');
  applyInspector(t, fld('o_val', 99));
  eq(optOf(t, 'val'), 50, 'mesure bornée au maximum du capteur');
  applyInspector(l, fld('o_seuil', 500)); applyInspector(l, fld('o_val', 800)); sim();
  eq(l.outPins[1].state, 1, 'lumière au-dessus du seuil');
  eq(d.outPins[0].state, phys2raw(120, { min:0, max:400 }), 'distance convertie');
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
    const brut = phys2raw(pc, { min:0, max:100 });
    near(can.inPins[0].state, brut, 0.01, pc + ' % arrive en continu (' + brut + ')');
    eq(can.raw, Math.round(brut), 'le CAN quantifie sur 8 bits : ' + Math.round(brut));
    eq(cna.outPins[0].state, Math.round(brut), 'reconverti à l’identique');
    eq(jauge.raw, Math.round(brut), 'la jauge reçoit la valeur');
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
  // le potentiomètre parle en % : la consigne et l'hystérésis aussi
  applyInspector(th, fld('o_cons', 50)); applyInspector(th, fld('o_hyst', 5));
  eq(optOf(th, 'cons'), phys2raw(50, { min:0, max:100 }), '50 % → 128 en interne');
  eq(optTxt(th, 'cons'), '50 %', 'et l’affichage reste en %');
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
  const PC = { min:0, max:100 };
  applyInspector(sc, fld('o_haut', 78)); applyInspector(sc, fld('o_bas', 31));
  applyInspector(li, fld('o_min', 20)); applyInspector(li, fld('o_max', 60));
  const set = pc => { applyInspector(pot, fld('o_val', pc)); sim(); };
  set(0);  eq(sc.outPins[0].state, 0, 'départ bas');
  set(50); eq(sc.outPins[0].state, 0, '≈128 : pas encore le seuil haut');
  set(90); eq(sc.outPins[0].state, 1, '≈230 : bascule');
  set(50); eq(sc.outPins[0].state, 1, 'reste haut dans la zone d’hystérésis');
  set(10); eq(sc.outPins[0].state, 0, 'sous le seuil bas : retombe');
  set(0);   eq(li.outPins[0].state, phys2raw(20, PC), 'limiteur : plancher');
  set(100); eq(li.outPins[0].state, phys2raw(60, PC), 'limiteur : plafond');
  set(30);  eq(li.outPins[0].state, phys2raw(30, { min:0, max:100 }), 'entre les deux : inchangé');
});

T('T94 rampe : la sortie rejoint la cible à pente limitée', () => {
  board();
  const pot = mk('POT', 0, 0), r = mk('RAMPE', 300, 0);
  link(pot, 0, r, 0);
  applyInspector(r, fld('o_vit', 40));           // 40 % d'échelle par seconde ≈ 102 brut
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

/* ===================== 6octies. Mesures et procédés ===================== */
console.log('— Mesures & procédés —');

T('T128 convention de commande : 1 = pleine puissance, valeur dosée = proportionnel', () => {
  board();
  const c = mk('AND', 0, 0);
  const p = c.inPins[0];
  p.state = 0;   eq(anaIn(p), 0, 'zéro');
  p.state = 1;   eq(anaIn(p), 255, 'un interrupteur commande à fond');
  p.state = 128; eq(anaIn(p), 128, 'valeur dosée respectée');
  p.state = 999; eq(anaIn(p), 255, 'borné');
});

T('T129 chaque actionneur renvoie sa mesure', () => {
  const attendu = {
    MOTOR:['VIT','TR'], JACK:['S0','S1','POS'], VALVE:['DÉB','S'], PUMP:['DÉB','REF'],
    SERVO:['POS'], CUVE:['NIV','HAUT','BAS','PRES','S'], FOUR:['T°','CHAUD'],
    AIR:['PRES','HAUT','BAS','AIR'], CONV:['VIT','PIÈCE'], STEPPER:['POS']
  };
  Object.keys(attendu).forEach(t => {
    const d = REG[t];
    ok(d, t + ' existe');
    deq(d.outs.map(o => o.n), attendu[t], t + ' : sorties attendues');
    ok(d.outs.some(o => o.bus), t + ' : au moins une mesure analogique');
  });
  // et la barrière historique aussi
  board();
  const b = mk('BARRIER', 0, 0), sw = mk('SWITCH', -200, 0);
  link(sw, 0, b, 0);
  eq(b.outputs, 1, 'la barrière a désormais une sortie d’angle');
  sw.state = 1;
  for (let i = 0; i < 60; i++){ sim(); drawScene(0); }
  ok(b.outPins[0].state > 200, 'angle mesuré une fois ouverte (' + b.outPins[0].state + ')');
});

T('T130 moteur : vitesse avec inertie, tachymètre, commande dosée', () => {
  board();
  const pot = mk('POT', 0, 0), pwm = mk('PWM', 250, 0), m = mk('MOTOR', 500, 0);
  const en = mk('HIGH', 0, 300);
  link(pot, 0, pwm, 0); link(en, 0, pwm, 1); link(pwm, 0, m, 0);
  applyInspector(m, fld('o_inert', 1));
  applyInspector(pot, fld('o_val', 100));            // pleine commande
  sim();
  eq(Math.round(m.vit), 0, 'à l’arrêt au départ');
  for (let i = 0; i < 3; i++){ __advance(200); sim(); }
  ok(m.vit > 20 && m.vit < 250, 'la vitesse monte progressivement (' + Math.round(m.vit) + ')');
  for (let i = 0; i < 30; i++){ __advance(200); sim(); }
  ok(m.vit > 200, 'régime établi (' + Math.round(m.vit) + ')');
  sim();
  ok(m.outPins[0].state > 200, 'vitesse publiée sur le bus');
  // le tachymètre compte les tours
  const tours0 = m.tours;
  for (let i = 0; i < 40; i++){ __advance(200); sim(); }
  ok(m.tours > tours0, 'le tachymètre compte les tours (' + m.tours + ')');
  // commande à mi-valeur : vitesse plus basse
  applyInspector(pot, fld('o_val', 30));
  for (let i = 0; i < 40; i++){ __advance(200); sim(); }
  ok(m.vit < 150, 'commande réduite → vitesse réduite (' + Math.round(m.vit) + ')');
  // arrêt
  applyInspector(pot, fld('o_val', 0));
  for (let i = 0; i < 40; i++){ __advance(200); sim(); }
  eq(m.vit, 0, 'le moteur s’arrête');
});

T('T131 vérin et servo : la position se mesure', () => {
  board();
  const s = mk('SWITCH', 0, 0), j = mk('JACK', 300, 0), jauge = mk('JAUGE', 700, 0);
  link(s, 0, j, 0); link(j, 2, jauge, 0);
  applyInspector(j, fld('o_sec', 1));
  s.state = 1;
  for (let i = 0; i < 4; i++){ __advance(150); sim(); }
  const pos = j.outPins[2].state;
  ok(pos > 60 && pos < 220, 'position intermédiaire mesurée (' + pos + ')');
  eq(jauge.raw, pos, 'la jauge reçoit la position');
  ok(!j.outPins[0].state && !j.outPins[1].state, 'entre les deux fins de course');
  for (let i = 0; i < 10; i++){ __advance(150); sim(); }
  eq(j.outPins[2].state, 255, 'sorti : mesure au maximum');
  eq(j.outPins[1].state, 1, 'et fin de course sorti');
  // servo : consigne vs position réelle
  board();
  const pot = mk('POT', 0, 0), sv = mk('SERVO', 300, 0);
  link(pot, 0, sv, 0);
  applyInspector(pot, fld('o_val', 100));
  sim();
  eq(sv.outPins[0].state, 0, 'la mesure part de zéro même si la consigne est à fond');
  for (let i = 0; i < 4; i++){ __advance(150); sim(); }
  const p1 = sv.outPins[0].state;
  ok(p1 > 10 && p1 < 250, 'le bras est en chemin (' + p1 + ')');
  for (let i = 0; i < 15; i++){ __advance(150); sim(); }
  ok(sv.outPins[0].state > 245, 'consigne atteinte');
});

T('T132 débits dosables : vanne, pompe et cuve', () => {
  board();
  const pot = mk('POT', 0, 0), v = mk('VALVE', 250, 0), pu = mk('PUMP', 250, 300);
  link(pot, 0, v, 0); link(pot, 0, pu, 0);
  applyInspector(pot, fld('o_val', 50)); sim();
  const ouv = v.outPins[0].state;
  ok(ouv > 100 && ouv < 160, 'vanne à demi ouverte → débit à demi (' + ouv + ')');
  for (let i = 0; i < 10; i++){ __advance(150); sim(); }
  ok(pu.outPins[0].state > 100 && pu.outPins[0].state < 160, 'pompe à mi-débit');
  // cuve : un remplissage dosé est plus lent
  board();
  const sw = mk('SWITCH', 0, 0), cuve = mk('CUVE', 300, 0);
  link(sw, 0, cuve, 0);
  applyInspector(cuve, fld('o_debit', 40));
  cuve.niv = 0; sw.state = 1;
  for (let i = 0; i < 5; i++){ __advance(200); sim(); }
  const plein = cuve.niv;
  ok(plein > 25, 'à pleine commande, ça monte vite (' + Math.round(plein) + ' %)');
  sim();                                       // les sorties publient l’état après le commit
  near(cuve.outPins[3].state, cuve.niv * 2.55, 0.01, 'la pression suit le niveau');
  board();
  const g = mk('GROUP', 0, 0), sw2 = [0,1,2,3].map(i => mk('SWITCH', -200, i * 70));
  const cuve2 = mk('CUVE', 300, 0);
  sw2.forEach((x, i) => link(x, 0, g, i));
  link(g, 0, cuve2, 0);
  applyInspector(cuve2, fld('o_debit', 40));
  cuve2.niv = 0;
  drive(sw2, [1,0,0,0]);                       // bus = 8 sur 15 → environ 3 % de la pleine commande
  for (let i = 0; i < 5; i++){ __advance(200); sim(); }
  ok(cuve2.niv < plein, 'commande dosée → remplissage plus lent (' + cuve2.niv.toFixed(1) + ' %)');
});

T('T133 réservoir d’air : compresseur, consommation et fuite', () => {
  board();
  const comp = mk('SWITCH', 0, 0), use = mk('SWITCH', 0, 200), air = mk('AIR', 300, 0);
  link(comp, 0, air, 0); link(use, 0, air, 1);
  applyInspector(air, fld('o_debit', 5)); applyInspector(air, fld('o_fuite', 0));
  air.bar = 0; sim();
  eq(air.outPins[2].state, 1, 'réservoir vide : seuil bas actif');
  comp.state = 1;
  for (let i = 0; i < 12; i++){ __advance(200); sim(); }
  ok(air.bar > 7.5, 'le compresseur remplit (' + air.bar.toFixed(1) + ' bar)');
  eq(air.outPins[1].state, 1, 'seuil haut atteint');
  ok(air.outPins[0].state > 190, 'pression publiée sur le bus');
  comp.state = 0; use.state = 1;
  for (let i = 0; i < 12; i++){ __advance(200); sim(); }
  ok(air.bar < 4, 'la consommation le vide (' + air.bar.toFixed(1) + ' bar)');
  // la fuite seule fait baisser la pression
  use.state = 0; air.bar = 8;
  applyInspector(air, fld('o_fuite', 20));
  for (let i = 0; i < 20; i++){ __advance(200); sim(); }
  ok(air.bar < 8, 'même à l’arrêt, ça fuit (' + air.bar.toFixed(1) + ' bar)');
});

T('T134 convoyeur : vitesse mesurée et comptage des pièces', () => {
  board();
  const sw = mk('SWITCH', 0, 0), conv = mk('CONV', 300, 0);
  const edge = mk('CNT4', 700, 0);
  link(sw, 0, conv, 0); link(conv, 1, edge, 0);
  applyInspector(conv, fld('o_esp', 1));            // une pièce par seconde
  sw.state = 1;
  for (let i = 0; i < 10; i++){ __advance(200); sim(); }
  ok(conv.vit > 200, 'le tapis a pris sa vitesse (' + Math.round(conv.vit) + ')');
  const n0 = conv.n;
  for (let i = 0; i < 25; i++){ __advance(200); sim(); }
  ok(conv.n > n0 + 2, 'des pièces sont sorties (' + conv.n + ')');
  ok(edge.cval > 0, 'et le compteur les a comptées (' + edge.cval + ')');
  sw.state = 0;
  for (let i = 0; i < 15; i++){ __advance(200); sim(); }
  eq(conv.vit, 0, 'tapis arrêté');
  const n1 = conv.n;
  for (let i = 0; i < 10; i++){ __advance(200); sim(); }
  eq(conv.n, n1, 'plus aucune pièce à l’arrêt');
});

T('T135 enregistreur : deux voies échantillonnées dans le temps', () => {
  board();
  const pot = mk('POT', 0, 0), four = mk('FOUR', 250, 0), rec = mk('COURBE', 600, 0);
  link(pot, 0, four, 0); link(four, 0, rec, 0); link(pot, 0, rec, 1);
  applyInspector(rec, fld('o_duree', 30));
  applyInspector(pot, fld('o_val', 100));
  applyInspector(four, fld('o_inert', 2));
  eq(rec.buf1.length, 0, 'buffer vide au départ');
  for (let i = 0; i < 40; i++){ __advance(200); sim(); }
  ok(rec.buf1.length > 5, 'la voie 1 enregistre (' + rec.buf1.length + ' points)');
  eq(rec.buf1.length, rec.buf2.length, 'les deux voies restent synchrones');
  ok(rec.buf1[rec.buf1.length - 1] > rec.buf1[0], 'la température monte au fil du temps');
  ok(rec.buf2.every(v => v === rec.buf2[0]), 'la consigne reste plate');
  // la fenêtre borne le nombre de points
  for (let i = 0; i < 400; i++){ __advance(200); sim(); }
  ok(rec.buf1.length <= 180, 'fenêtre glissante bornée (' + rec.buf1.length + ')');
  drawScene(0);
});

T('T136 boucle de vitesse : le tachymètre régule le moteur', () => {
  board();
  const m = mk('MOTOR', 600, 0), reg = mk('PROP', 200, 0), pwm = mk('PWM', 400, 0);
  const en = mk('HIGH', 200, 400);
  link(m, 0, reg, 0);                     // la vitesse mesurée revient au régulateur
  link(reg, 0, pwm, 0); link(en, 0, pwm, 1); link(pwm, 0, m, 0);
  // le régulateur voit une vitesse en tr/min : la consigne se donne en tr/min
  applyInspector(reg, fld('o_cons', 1765)); applyInspector(reg, fld('o_gain', 4));
  near(optOf(reg, 'cons'), 150, 0.1, '1765 tr/min → 150 en interne');
  applyInspector(m, fld('o_inert', .5));
  applyInspector(pwm, fld('o_hz', 20));
  for (let i = 0; i < 120; i++){ __advance(100); sim(); }
  ok(m.vit > 100 && m.vit < 210, 'la vitesse se cale autour de la consigne (' +
     Math.round(m.vit) + ' pour 150)');
  // on augmente la consigne : la vitesse suit
  applyInspector(reg, fld('o_cons', 2588));       // ≈ 220 en interne
  for (let i = 0; i < 120; i++){ __advance(100); sim(); }
  ok(m.vit > 150, 'nouvelle consigne suivie (' + Math.round(m.vit) + ')');
});

T('T137 unités : chaque mesure déclare son échelle physique', () => {
  const attendu = { MOTOR:['tr/min'], JACK:['%'], VALVE:['L/min'], PUMP:['L/min'],
                    SERVO:['°'], FOUR:['°C'], CUVE:['%','bar'], AIR:['bar'],
                    CONV:['m/min'], STEPPER:['pas'], TEMPC:['°C'], DIST:['cm'], POT:['%'] };
  Object.keys(attendu).forEach(t => {
    const unites = REG[t].outs.filter(o => o.unit != null).map(o => o.unit);
    deq(unites, attendu[t], t + ' : unités déclarées');
    REG[t].outs.filter(o => o.unit != null).forEach(o =>
      ok(typeof o.min === 'number' && o.max > o.min, t + ' : échelle cohérente'));
  });
  board();
  const four = mk('FOUR', 0, 0);
  const info = pinInfo(four.outPins[0]);
  ok(info && info.unit === '°C', 'métadonnée lisible depuis un pin');
  eq(physOf(0, info).txt, '0 °C', 'zéro');
  eq(physOf(255, info).txt, '250 °C', 'pleine échelle');
  eq(physOf(128, info).txt, '125 °C', 'milieu');
  eq(pinInfo(four.outPins[1]), null, 'une sortie booléenne n’a pas d’unité');
});

T('T138 écran de mesure : il reconnaît tout seul ce qu’on lui branche', () => {
  board();
  const cuve = mk('CUVE', 0, 0), four = mk('FOUR', 0, 300);
  const ecran = mk('ECRAN', 500, 0);
  link(cuve, 0, ecran, 0);
  cuve.niv = 72; sim(); sim();
  eq(ecran.actives.length, 1, 'une voie branchée');
  eq(ecran.actives[0].txt, '72 %', 'niveau affiché en pourcentage, sans réglage');
  ok(/CUVE/.test(ecran.actives[0].nom), 'la source est nommée');
  link(four, 0, ecran, 1);
  four.temp = 128; sim(); sim();
  eq(ecran.actives.length, 2, 'deux voies');
  eq(ecran.actives[1].txt, '125 °C', 'température affichée en degrés');
  // pression de la cuve sur une 3e voie
  link(cuve, 3, ecran, 2); sim(); sim();
  eq(ecran.actives[2].txt, '7.2 bar', 'la pression a sa propre unité et sa décimale');
  // unité imposée
  applyInspector(ecran, Object.assign(fld('o_unite', 'L'), { type:'text' }));
  applyInspector(ecran, fld('o_ech', 500));
  sim(); sim();
  ok(/L$/.test(ecran.actives[0].txt), 'unité forcée : ' + ecran.actives[0].txt);
  applyInspector(ecran, Object.assign(fld('o_unite', ''), { type:'text' }));
  applyInspector(ecran, fld('o_ech', 0));
  sim(); sim();
  eq(ecran.actives[0].txt, '72 %', 'retour à la détection automatique');
  drawScene(0);
  // rien de branché
  board();
  const seul = mk('ECRAN', 0, 0);
  sim();
  eq(seul.actives.length, 0, 'aucune voie');
  drawScene(0);
  ok(/rien de branché/i.test(compTipData(seul).lines.join(' ')), 'l’infobulle le dit');
});

T('T139 jauge et câbles affichent aussi la valeur physique', () => {
  board();
  const air = mk('AIR', 0, 0), j = mk('JAUGE', 400, 0);
  const w = link(air, 0, j, 0);
  air.bar = 6.4; sim(); sim();
  eq(j.ph.txt, '6.4 bar', 'la jauge lit l’échelle de sa source');
  ok(/6.4 bar/.test(wireTipData(w).lines[1]), 'le câble aussi : ' + wireTipData(w).lines[1]);
  // une mesure sans unité reste en valeur brute
  board();
  const g = mk('GROUP', 0, 0), j2 = mk('JAUGE', 400, 0);
  const sw = [0,1,2,3].map(i => mk('SWITCH', -300, i * 70));
  sw.forEach((x, i) => link(x, 0, g, i));
  const w2 = link(g, 0, j2, 0);
  drive(sw, [1,0,1,0]); sim();
  ok(!/bar|°C/.test(wireTipData(w2).lines[1]), 'un bus sans unité reste brut');
});

T('T140 capteur branché : il mesure le procédé au lieu d’être réglé à la main', () => {
  board();
  const four = mk('FOUR', 0, 0), capt = mk('TEMPC', 400, 0);
  applyInspector(capt, fld('o_val', 20));
  sim();
  eq(Math.round(capt.mes), 20, 'libre : il affiche la valeur simulée');
  eq(capt.direct, false, 'pas de mesure en direct');
  ok(primaryParam(capt), 'la glissière est disponible');
  link(four, 0, capt, 0);
  four.temp = 40;                         // 40/255 de 0-250 °C ≈ 39 °C
  sim(); sim();
  ok(capt.direct, 'branché : mesure en direct');
  ok(Math.abs(capt.mes - 39) < 3, 'il lit la température du four (' + capt.mes.toFixed(1) + ' °C)');
  ok(!primaryParam(capt), 'la glissière disparaît : c’est le procédé qui commande');
  ok(!capt.horsGamme, 'dans la gamme');
  // hors gamme : le capteur sature, comme un vrai instrument
  four.temp = 200;                        // ≈ 196 °C, hors des 50 °C du capteur
  sim(); sim();
  ok(capt.horsGamme, 'saturation détectée');
  eq(capt.mes, 50, 'il affiche son maximum');
  eq(capt.outPins[0].state, 255, 'et sort la pleine échelle');
  ok(/hors gamme/.test(compTipData(capt).lines.join(' ')), 'l’infobulle explique la saturation');
  // débranché : il revient à la valeur simulée
  wires = wires.filter(w => w.inPin !== capt.inPins[0]);
  sim(); sim();
  eq(capt.direct, false, 'redevenu simulateur');
  eq(Math.round(capt.mes), 20, 'la valeur réglée à la main est retrouvée');
});

T('T141 boucle complète four → capteur → régulateur → four', () => {
  board();
  const four = mk('FOUR', 600, 0), capt = mk('TEMPC', 900, 0);
  const th = mk('THERMO', 150, 0);
  link(four, 0, capt, 0);                 // le capteur mesure le four
  link(capt, 0, th, 0);                   // sa mesure alimente le régulateur
  link(th, 0, four, 0);                   // qui commande la chauffe
  // La consigne se donne directement en °C, dans l'échelle du capteur branché
  applyInspector(th, fld('o_cons', 25)); applyInspector(th, fld('o_hyst', 2.4));
  eq(optTxt(th, 'cons'), '25 °C', 'le thermostat affiche sa consigne en °C');
  eq(optOf(th, 'cons'), phys2raw(25, { min:-10, max:50 }), '25 °C → 149 en interne');
  applyInspector(four, fld('o_inert', 2));
  eq(Math.round(four.temp), 0, 'four froid');
  let coupe = false, relance = false;
  for (let i = 0; i < 300; i++){
    __advance(100); sim();
    if (th.outPins[0].state === 0) coupe = true;
    if (coupe && th.outPins[0].state === 1) relance = true;
  }
  ok(capt.direct, 'le capteur est bien en prise directe');
  ok(coupe && relance, 'la boucle passant par le capteur régule vraiment');
  ok(four.temp > 10 && four.temp < 60,
    'et maintient la température autour de la consigne (' + Math.round(four.temp) + ')');
  ok(Math.abs(capt.raw - 150) < 45, 'la mesure tourne autour de la consigne (' + capt.raw + ')');
});

T('T142 PID : les trois termes, l’anti-emballement et la remise à zéro', () => {
  board();
  const four = mk('FOUR', 600, 0), pid = mk('PID', 150, 0);
  link(four, 0, pid, 0); link(pid, 0, four, 0);
  applyInspector(pid, fld('o_cons', 150));
  applyInspector(pid, fld('o_kp', 2)); applyInspector(pid, fld('o_ki', 0)); applyInspector(pid, fld('o_kd', 0));
  applyInspector(four, fld('o_inert', 2));
  // P seul : il reste un écart résiduel
  for (let i = 0; i < 250; i++){ __advance(100); sim(); }
  const ecartP = 150 - four.temp;
  ok(ecartP > 5, 'proportionnel seul : écart résiduel de ' + Math.round(ecartP));
  ok(Math.abs(pid.i) < 0.01, 'terme intégral nul');
  // on ajoute l'intégrale : l'écart s'efface
  applyInspector(pid, fld('o_ki', 0.5));
  for (let i = 0; i < 400; i++){ __advance(100); sim(); }
  const ecartPI = Math.abs(150 - four.temp);
  ok(ecartPI < ecartP, 'l’intégrale réduit l’écart (' + Math.round(ecartPI) + ' contre ' + Math.round(ecartP) + ')');
  ok(Math.abs(pid.i) > 0, 'le terme I travaille');
  // anti-emballement : consigne inatteignable, l'intégrale ne diverge pas
  applyInspector(pid, fld('o_cons', 255));
  for (let i = 0; i < 300; i++){ __advance(100); sim(); }
  const integ1 = pid.integ;
  for (let i = 0; i < 300; i++){ __advance(100); sim(); }
  ok(Math.abs(pid.integ - integ1) < Math.abs(integ1) * 0.5 + 50,
    'l’intégrale ne s’emballe pas en butée');
  ok(pid.cmd <= 255 && pid.cmd >= 0, 'commande toujours dans les bornes');
  // remise à zéro
  const raz = mk('SWITCH', 0, 400);
  link(raz, 0, pid, 1);
  raz.state = 1; sim(); sim();
  eq(pid.integ, 0, 'RAZ efface l’intégrale');
  eq(Math.round(pid.cmd), 0, 'et la commande');
});

T('T143 PID : le terme dérivé s’oppose à la montée, la boucle converge', () => {
  board();
  const four = mk('FOUR', 600, 0), pid = mk('PID', 150, 0);
  link(four, 0, pid, 0); link(pid, 0, four, 0);
  applyInspector(pid, fld('o_cons', 200));
  applyInspector(pid, fld('o_kp', 2)); applyInspector(pid, fld('o_ki', 0.5));
  applyInspector(pid, fld('o_kd', 3));
  applyInspector(four, fld('o_inert', 4));
  let dMin = 0, dVu = false;
  for (let i = 0; i < 80; i++){
    __advance(100); sim();
    if (four.temp > 20 && four.temp < 190){ dMin = Math.min(dMin, pid.dd); dVu = true; }
  }
  ok(dVu, 'la montée a été observée');
  ok(dMin < -1, 'pendant la montée, le terme D freine (' + Math.round(dMin) + ')');
  for (let i = 0; i < 500; i++){ __advance(100); sim(); }
  ok(Math.abs(four.temp - 200) < 12, 'le PID complet amène à la consigne (' +
     Math.round(four.temp) + ' pour 200)');
  ok(Math.abs(pid.err) < 15, 'écart résiduel faible (' + Math.round(pid.err) + ')');
  // sans intégrale, l'écart résiduel réapparaît
  applyInspector(pid, fld('o_ki', 0));
  pid.integ = 0;
  for (let i = 0; i < 500; i++){ __advance(100); sim(); }
  ok(Math.abs(200 - four.temp) > 15, 'sans I : écart résiduel de ' + Math.round(200 - four.temp));
});

T('T144 tuyauterie : raccords fluides, bridage et répartition', () => {
  board();
  const pot = mk('POT', 0, 0), pu = mk('PUMP', 250, 0), tu = mk('TUYAU', 550, 0);
  const cuve = mk('CUVE', 850, 0);
  link(pot, 0, pu, 0);                       // commande électrique de la pompe
  link(pu, 1, tu, 0);                        // refoulement → tuyau (raccords fluides)
  link(tu, 0, cuve, 2);                      // tuyau → arrivée de la cuve
  applyInspector(pot, fld('o_val', 100));
  applyInspector(tu, fld('o_dn', 20));       // tuyau étroit
  cuve.niv = 0;
  for (let i = 0; i < 30; i++){ __advance(150); sim(); }   // le temps que la pompe s'établisse
  ok(tu.bride, 'le tuyau bride le débit');
  near(tu.outPins[0].state, tu.max, 0.1, 'débit plafonné à la section');
  cuve.niv = 0;
  for (let i = 0; i < 12; i++){ __advance(150); sim(); }
  const lent = cuve.niv;
  ok(lent > 0, 'la cuve se remplit par le tuyau (' + lent.toFixed(1) + ' %)');
  applyInspector(tu, fld('o_dn', 100));      // tuyau large
  for (let i = 0; i < 20; i++){ __advance(150); sim(); }   // la pompe remonte en régime
  cuve.niv = 0;
  for (let i = 0; i < 12; i++){ __advance(150); sim(); }
  ok(!tu.bride, 'plus de bridage');
  ok(cuve.niv > lent * 1.5, 'remplissage bien plus rapide (' + cuve.niv.toFixed(1) +
     ' contre ' + lent.toFixed(1) + ')');
  // té : répartition du débit
  board();
  const p2 = mk('POT', 0, 0), pu2 = mk('PUMP', 200, 0), te = mk('TE', 450, 0);
  const c1 = mk('CUVE', 750, 0), c2 = mk('CUVE', 750, 400);
  link(p2, 0, pu2, 0); link(pu2, 1, te, 0);
  link(te, 0, c1, 2); link(te, 1, c2, 2);
  applyInspector(p2, fld('o_val', 100));
  applyInspector(te, fld('o_rep', 75));
  c1.niv = 0; c2.niv = 0;
  for (let i = 0; i < 15; i++){ __advance(150); sim(); }
  ok(c1.niv > c2.niv * 1.8, 'la répartition 75/25 se voit sur les niveaux (' +
     c1.niv.toFixed(1) + ' contre ' + c2.niv.toFixed(1) + ')');
});

T('T145 un tuyau ne se branche pas sur une borne électrique', () => {
  board();
  const led = mk('LED', 400, 0), pu = mk('PUMP', 0, 0);
  eq(pu.outPins[1].kind, 'flu', 'le refoulement est un port fluide');
  eq(pu.outPins[0].kind, 'log', 'la mesure de débit reste électrique');
  eq(led.inPins[0].kind, 'log', 'une ampoule a une borne électrique');
  connectWire(pu.outPins[1], led.inPins[0]);
  eq(wires.length, 0, 'le raccordement est refusé');
  const cuve = mk('CUVE', 700, 0);
  eq(cuve.inPins[2].kind, 'flu', 'la cuve a une arrivée fluide');
  connectWire(pu.outPins[1], cuve.inPins[2]);
  eq(wires.length, 1, 'entre deux ports fluides, ça se raccorde');
  ok(wires[0].flu, 'la liaison se sait fluide');
  connectWire(pu.outPins[0], cuve.inPins[0]);
  eq(wires.length, 2, 'et l’électrique reste possible');
  ok(!wires[1].flu, 'cette liaison-là est électrique');
  drawScene(0);
});

T('T146 hydraulique : la cuve se vide par gravité et déborde', () => {
  board();
  const haut = mk('CUVE', 0, 0), tu = mk('TUYAU', 350, 0), bas = mk('CUVE', 700, 0);
  link(haut, 4, tu, 0);                      // départ de la cuve haute
  link(tu, 0, bas, 2);                       // vers l’arrivée de la cuve basse
  applyInspector(tu, fld('o_dn', 60));
  applyInspector(haut, fld('o_debit', 30)); applyInspector(bas, fld('o_debit', 30));
  haut.niv = 90; bas.niv = 0;
  for (let i = 0; i < 20; i++){ __advance(150); sim(); }
  ok(haut.niv < 90, 'la cuve haute se vide (' + haut.niv.toFixed(1) + ' %)');
  ok(bas.niv > 0, 'la cuve basse se remplit (' + bas.niv.toFixed(1) + ' %)');
  // une cuve pleine n’accepte plus rien : le débit s’arrête
  bas.niv = 100; sim(); sim();
  eq(bas.inPins[2].accept, 0, 'cuve pleine : elle n’absorbe plus');
  const avant = haut.niv;
  for (let i = 0; i < 10; i++){ __advance(150); sim(); }
  ok(Math.abs(haut.niv - avant) < 1.5, 'et l’amont cesse de couler (' + haut.niv.toFixed(1) + ')');
  // un départ non raccordé ne vide pas la cuve
  board();
  const seule = mk('CUVE', 0, 0);
  seule.niv = 80;
  for (let i = 0; i < 15; i++){ __advance(150); sim(); }
  eq(Math.round(seule.niv), 80, 'sans tuyau raccordé, rien ne s’écoule');
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

T('T60 le guide documente les ateliers, les unités, les seuils et la tuyauterie', () => {
  const html = __el('guide-body').innerHTML;
  [['Trois ateliers', 'les trois ateliers'],
   ['Les favoris', 'la barre de favoris'],
   ['unités réelles', 'les réglages en unité physique'],
   ['% de l’échelle', 'le repli en pourcentage'],
   ['seuil haut', 'le seuil haut des capteurs'],
   ['seuil bas', 'le seuil bas des capteurs'],
   ['raccord fluide', 'la tuyauterie'],
   ['GRAFCET', 'le GRAFCET'],
   ['réceptivité', 'les réceptivités'],
   ['CEI 60848', 'la norme du GRAFCET'],
   ['CEI 60073', 'les couleurs normalisées des voyants'],
   ['mesure figée', 'les pannes simulées'],
   ['premier maillon', 'la méthode de diagnostic'],
   ['éditeur de GRAFCET', 'l’éditeur de GRAFCET'],
   ['divergence ET', 'les divergences ET'],
   ['tracé des câbles', 'le tracé des câbles'],
   ['angles arrondis', 'les angles arrondis'],
   ['plan miniature', 'le plan miniature'],
   ['rail de distribution', 'le rail de distribution'],
   ['déjà relié', 'la pose d’un composant déjà relié'],
   ['guides d’alignement', 'les guides d’alignement'],
   ['clic droit', 'le menu contextuel'],
   ['Ctrl+F', 'la recherche sur le plan'],
   ['BRIDÉ', 'le bridage d’un tuyau trop étroit']]
    .forEach(([txt, what]) => ok(html.includes(txt), 'le guide parle de ' + what));
  ok(/TUYAU/.test(__el('guide-body').innerHTML), 'et présente le tuyau lui-même');
});

T('T59 le guide ne mentionne plus les anciens déblocages de mission', () => {
  const html = __el('guide-body').innerHTML;
  ok(!/récompense (de la )?mission/i.test(html), 'plus de « récompense mission » (déblocage total en v5)');
  ok(!/pour débloquer/i.test(html), 'plus de mention de déblocage');
});

T('T147 tous les exemples se câblent sur des ports compatibles', () => {
  const bad = [];
  EXAMPLES.forEach(ex => {
    board();
    const r = spawnGroup(ex.data, 0, 0, true);
    (ex.data.wires || []).forEach(w => {
      const a = r.made[w[0]], b = r.made[w[2]];
      if (!a || !b) return bad.push(ex.name + ' : câble vers un composant absent');
      const op = a.outPins[w[1]], ip = b.inPins[w[3]];
      if (!op || !ip) return bad.push(ex.name + ' : broche absente ' +
        a.type + '#' + w[1] + ' → ' + b.type + '#' + w[3]);
      if (op.kind !== ip.kind) bad.push(ex.name + ' : ' + a.type + '#' + w[1] +
        '(' + op.kind + ') → ' + b.type + '#' + w[3] + '(' + ip.kind + ')');
    });
  });
  ok(!bad.length, 'liaisons incohérentes —\n      ' + bad.join('\n      '));
});

T('T148 les réglages se donnent dans l’unité de la mesure branchée', () => {
  board();
  const four = mk('FOUR', 0, 0), th = mk('THERMO', 400, 0);
  // sans rien de branché : on parle en % de l'échelle
  eq(optScale(th, REG.THERMO.opts[0]).unit, '%', 'par défaut : % de l’échelle');
  applyInspector(th, fld('o_cons', 50));
  eq(optOf(th, 'cons'), 127.5, '50 % → 127,5 en interne : plus d’arrondi');
  // branché sur un four (0-250 °C) : la consigne se donne en °C
  link(four, 0, th, 0);
  const sc = optScale(th, REG.THERMO.opts[0]);
  eq(sc.unit, '°C', 'la consigne parle la langue du four');
  eq(sc.max, 250, 'et son échelle');
  applyInspector(th, fld('o_cons', 47));
  eq(optOf(th, 'cons'), phys2raw(47, { min:0, max:250 }), '47 °C stocké en brut');
  eq(optTxt(th, 'cons'), '47 °C', 'et relu en °C');
  // l'hystérésis est un écart : on convertit l'amplitude, pas le zéro
  applyInspector(th, fld('o_hyst', 10));
  near(optOf(th, 'hyst'), 10 / 250 * 255, 0.01, '10 °C d’écart converti sans perte');
  eq(optTxt(th, 'hyst'), '10 °C', 'relu comme un écart');
  // le champ de l'inspecteur porte l'unité, pas « 0-255 »
  const html = regOptField(th, REG.THERMO.opts[0]);
  ok(/Consigne \(°C\)/.test(html), 'l’intitulé porte l’unité');
  ok(/value="47"/.test(html), 'la valeur affichée est physique');
  ok(!/0-255/.test(html), 'plus aucune échelle brute à l’écran');
  // et la glissière aussi
  const p = primaryParam(th);
  eq(p.unit, '°C', 'la glissière est graduée en °C');
  eq(p.max, 250, 'sur toute l’échelle du four');
  eq(p.get(th), 47, 'et lit la consigne en °C');
  p.set(th, 120);
  eq(optTxt(th, 'cons'), '120 °C', 'glisser règle bien la consigne physique');
  // le four exprime son propre seuil dans sa propre unité
  applyInspector(four, fld('o_alerte', 200));
  eq(optTxt(four, 'alerte'), '200 °C', 'seuil « chaud » en °C');
  eq(optOf(four, 'alerte'), phys2raw(200, { min:0, max:250 }), 'stocké en brut');
});

T('T149 trois ateliers : la palette se recompose, les favoris ne bougent pas', () => {
  const cles = () => modeTabs().map(t => t.key);
  setAppMode('elec');
  deq(cles(), ['in','gate','mem','calc','data','out','wire'], 'électronique : sept onglets');
  setAppMode('proc');
  deq(cles(), ['pupi','sense','act','proce','reg','time','sup','wire'], 'process : huit onglets');
  ok(!cles().includes('gate'), 'pas de portes côté process');
  ok(!cles().includes('calc'), 'ni de calcul');
  eq(localStorage.getItem('al2_mode'), 'proc', 'le choix est mémorisé');
  // le troisième atelier est ouvert : il a ses propres onglets
  const phys = MODES.find(m => m.k === 'phys');
  ok(phys && !phys.bientot, 'l’atelier Énergie & ondes n’est plus « bientôt »');
  setAppMode('phys');
  eq(appMode, 'phys', 'et il s’ouvre');
  deq(cles(), ['ener','mesu','prod','alt','onde','wirep'], 'énergie : six onglets, aucun surchargé');
  // aucune rangée ne doit déborder : au-delà d'une dizaine de tuiles, le
  // composant du bout devient introuvable (il faut deviner qu'on peut faire
  // défiler la rangée).
  // Aucune rangée ne doit déborder, DANS AUCUN ATELIER : `.tool-row` défile en
  // silence (barre masquée), donc la tuile du bout devient introuvable.
  ['elec','proc','phys'].forEach(d => {
    setAppMode(d);
    modeTabs().forEach(t => ok(t.items.length <= 11,
      'atelier ' + d + ', onglet « ' + t.name + ' » : ' + t.items.length + ' tuiles, c’est trop'));
  });
  setAppMode('phys');            // on rend la main dans l'atelier qu'on testait
  const cab = TOOL_TABS.find(t => t.key === 'wirep');
  ok(cab.items.indexOf('RAILP8') < cab.items.indexOf('RAIL8'),
     'les rails de puissance passent AVANT ceux de signal');
  ok(cab.items.includes('TUNP'), 'et le tunnel de puissance y est');
  ok(!cles().includes('gate') && !cles().includes('sense'),
     'ni portes logiques ni capteurs de process côté énergie');
  setAppMode('proc');
  // il n’y a plus de mode « Tout »
  ok(!MODES.some(m => m.k === 'tout'), 'le mode Tout a disparu');

  // --- le pupitre et la supervision sont des vues taillées pour le process
  const pupi = TOOL_TABS.find(t => t.key === 'pupi');
  ok(pupi.items.includes('BUTTON') && pupi.items.includes('ESTOP'), 'le pupitre a ses boutons');
  ok(!pupi.items.includes('NOISE') && !pupi.items.includes('SEQ'),
     'mais ni bruit ni séquenceur : ils n’ont rien à faire sur un pupitre');
  const sup = TOOL_TABS.find(t => t.key === 'sup');
  ok(sup.items.includes('ECRAN') && sup.items.includes('COURBE'), 'la supervision a l’écran et l’enregistreur');
  ok(!sup.items.includes('MATRIX') && !sup.items.includes('SEGMENT'),
     'mais ni matrice 8×8 ni afficheur 7 segments');

  // --- chaque atelier retient l’onglet où on l’a laissé
  setAppMode('elec'); toolbarTab = 3; tabParDom.elec = 3;
  setAppMode('proc'); toolbarTab = 5; 
  setAppMode('elec');
  eq(toolbarTab, 3, 'retour à l’onglet quitté côté électronique');
  setAppMode('proc');
  eq(toolbarTab, 5, 'et côté process');

  // --- la recherche traverse tout, sans doublon
  ok(searchTypes('nand').includes('NAND'), 'la recherche traverse les ateliers');
  ok(searchTypes('pompe').includes('PUMP'), 'et retrouve le procédé');
  const bt = searchTypes('bouton');
  eq(bt.length, new Set(bt).size, 'un composant présent dans deux onglets n’apparaît qu’une fois');
  setAppMode('elec');
});

T('T149b la barre de favoris est indépendante des ateliers', () => {
  const pins0 = favPins.slice(), freq0 = Object.assign({}, favFreq);
  favPins = ['AND','LED']; favFreq = {};
  setAppMode('elec');
  const a = favList();
  setAppMode('proc');
  deq(favList(), a, 'les favoris ne changent pas d’un atelier à l’autre');
  ok(a.includes('AND') && a.includes('LED'), 'les épingles y sont');
  // épingler et retirer
  favEpingle('PUMP');
  ok(favPins.includes('PUMP'), 'un clic droit épingle');
  ok(favList().includes('PUMP'), 'et ça se voit dans la barre');
  favEpingle('PUMP');
  ok(!favPins.includes('PUMP'), 'un second clic droit retire');
  // les plus employés complètent automatiquement
  favPins = ['AND'];
  favFreq = { FOUR:9, CUVE:5, TUYAU:1 };
  const l = favList();
  eq(l[0], 'AND', 'les épingles passent devant');
  ok(l.includes('FOUR') && l.includes('CUVE'), 'les habitués complètent');
  ok(!l.includes('TUYAU'), 'un composant posé une seule fois ne compte pas encore');
  ok(l.indexOf('FOUR') < l.indexOf('CUVE'), 'du plus employé au moins employé');
  ok(l.length <= FAV_MAX, 'jamais plus de ' + FAV_MAX + ' tuiles');
  // poser un composant le compte
  const n0 = favFreq.NOT | 0;
  favNote('NOT');
  eq(favFreq.NOT, n0 + 1, 'poser un composant le compte');
  favPins = pins0; favFreq = freq0; favSave();
});

T('T150 les exemples hydrauliques tournent vraiment', () => {
  const charge = nom => {
    board();
    const ex = EXAMPLES.find(e => e.name === nom);
    ok(!!ex, 'exemple « ' + nom + ' » présent');
    return spawnGroup(ex.data, 0, 0, true).made;
  };
  // réseau : la répartition du té remplit deux cuves à des vitesses différentes
  let m = charge('Circuit hydraulique');
  const te = m[2], cA = m[3], cB = m[4];
  applyInspector(te, fld('o_rep', 75));
  for (let i = 0; i < 40; i++){ __advance(150); sim(); }
  ok(cA.niv > 10, 'la cuve A se remplit (' + cA.niv.toFixed(1) + ' %)');
  ok(cA.niv > cB.niv * 1.8, 'trois fois plus vite que la B (' + cB.niv.toFixed(1) + ' %)');
  // cuve A pleine : le débit se reporte entièrement sur la B
  cA.niv = 100;
  const avant = cB.niv;
  for (let i = 0; i < 10; i++){ __advance(150); sim(); }
  const reporte = cB.niv - avant;
  cA.niv = 100; cB.niv = 50;
  ok(reporte > 0, 'la branche restante continue de recevoir (' + reporte.toFixed(1) + ' %)');
  // remplissage automatique : la mémoire SR tient la décision entre les deux seuils
  m = charge('Remplissage automatique');
  const cuve = m[0], vanne = m[1], sr = m[2];
  cuve.niv = 10;                                   // sous le seuil bas
  for (let i = 0; i < 4; i++){ __advance(120); sim(); }
  eq(sr.outPins[0].state, 1, 'sous le seuil bas : la mémoire ouvre la vanne');
  ok(vanne.open === 1, 'la vanne est ouverte');
  for (let i = 0; i < 12; i++){ __advance(150); sim(); }
  ok(cuve.niv > 12, 'la cuve se remplit par le tuyau (' + cuve.niv.toFixed(1) + ' %)');
  cuve.niv = 50; sim();                            // dans la zone morte
  eq(sr.outPins[0].state, 1, 'entre les deux seuils : elle ne change pas d’avis');
  cuve.niv = 90;
  for (let i = 0; i < 3; i++){ __advance(120); sim(); }
  eq(sr.outPins[0].state, 0, 'au seuil haut : arrêt');
  eq(vanne.open, 0, 'la vanne se referme');
  cuve.niv = 50; sim();
  eq(sr.outPins[0].state, 0, 'et reste fermée en redescendant dans la zone morte');
});

T('T151 aucune valeur affichée ne déborde en décimales', () => {
  const sale = /\d+[.,]\d{2,}/;                 // 128.4 passe, 128.4567 non
  const fautifs = [];
  Object.keys(REG).forEach(id => {
    board();
    const c = mk(id, 0, 0);
    // on injecte une mesure volontairement « moche » sur chaque entrée
    c.inPins.forEach(p => p.state = 123.456789);
    try { c.evaluate(); c.commit && c.commit(); c.evaluate(); } catch (e){ return; }
    const d = REG[id];
    const bouts = [];
    try { if (d.value) bouts.push(d.value(c)); } catch (e){}
    try { if (d.sub)   bouts.push(d.sub(c)); } catch (e){}
    try { if (d.tip)   bouts.push((d.tip(c) || []).join(' | ')); } catch (e){}
    bouts.filter(x => x != null).forEach(x => {
      if (sale.test(String(x))) fautifs.push(id + ' : ' + x);
    });
  });
  ok(!fautifs.length, 'affichages non arrondis —\n      ' + fautifs.join('\n      '));
});

T('T152 la mesure garde sa finesse d’un bout à l’autre de la chaîne', () => {
  board();
  // un thermocouple 0-400 °C : un pas entier vaudrait 1,57 °C
  const four = mk('THERMOC', 0, 0);
  const th = mk('THERMO', 400, 0);
  link(four, 0, th, 0);
  applyInspector(four, fld('o_val', 100.4));
  sim();
  const brut = four.outPins[0].state;
  ok(!Number.isInteger(brut), 'la sortie du capteur n’est plus quantifiée (' + brut + ')');
  near(raw2phys(brut, { min:0, max:400 }), 100.4, 0.01, '100,4 °C traverse le câble sans perte');
  // deux mesures séparées de moins d’un pas entier restent distinctes
  applyInspector(four, fld('o_val', 100.9));
  sim();
  ok(four.outPins[0].state !== brut, '100,9 °C se distingue de 100,4 °C');
  // et la consigne se pose au même endroit
  applyInspector(th, fld('o_cons', 100.4));
  near(raw2phys(optOf(th, 'cons'), { min:0, max:400 }), 100.4, 0.01,
       'la consigne vise exactement la même valeur');
});

T('T153 les voyants prennent les couleurs normalisées du pupitre', () => {
  board();
  const l = mk('LED', 0, 0);
  eq(compColor(l), GATE_STYLE.LED.c, 'par défaut : la couleur de la famille');
  applyInspector(l, fld('coul', 'rouge'));
  eq(compColor(l), lampColor('rouge'), 'recoloré en rouge');
  eq(l.opt.coul, 'rouge', 'le choix est mémorisé dans les réglages');
  applyInspector(l, fld('coul', 'mauve-imaginaire'));
  eq(l.opt.coul, 'rouge', 'une couleur inconnue est refusée');
  // le clic fait défiler la palette et revient à son point de départ
  const n = LAMP_COLORS.length;
  const depart = l.opt.coul;
  for (let i = 0; i < n; i++) clickComp(l, l.x + 10, l.y + 10);
  eq(l.opt.coul, depart, 'le clic boucle sur toute la palette');
  clickComp(l, l.x + 10, l.y + 10);
  ok(l.opt.coul !== depart, 'et change bien de couleur à chaque clic');
  // la couleur voyage avec le composant
  const rouge = mk('LED', 200, 0);
  applyInspector(rouge, fld('coul', 'orange'));
  const data = serializeGroup([rouge]);
  board();
  const copie = spawnGroup(data, 0, 0, true).made[0];
  eq(copie.opt.coul, 'orange', 'copier-coller, sauvegardes et exemples la conservent');
  eq(compColor(copie), lampColor('orange'), 'et elle se rallume de la bonne couleur');
});

T('T154 GRAFCET : franchissement, temporisation, scrutation et INIT', () => {
  board();
  const g = mk('GRAFCET', 0, 0);
  const r1 = mk('SWITCH', -400, 0), r2 = mk('SWITCH', -400, 120), ini = mk('SWITCH', -400, 240);
  link(r1, 0, g, 0); link(r2, 0, g, 1); link(ini, 0, g, 4);
  // un cycle à trois étapes : X0 --R1--> X1 --R2--> X2 --t/1s--> X0
  const M = grModel(g);
  M.st = [{ x:0, y:0, ini:1 }, { x:0, y:1 }, { x:0, y:2 }];
  M.tr = [{ de:[0], a:[1], r:'R1', t:0 },
          { de:[1], a:[2], r:'R2', t:0 },
          { de:[2], a:[0], r:'1',  t:1 }];
  M.scan = 100;
  grReset(g);
  eq(grNb(g), 3, 'trois étapes');
  sim();
  eq(g.outPins[0].state, 1, 'X0 actif au départ');
  eq(g.outPins[1].state, 0, 'et lui seul');

  // sans réceptivité vraie, le jeton ne bouge pas — même longtemps
  for (let i = 0; i < 20; i++){ __advance(150); sim(); }
  ok(g.act[0], 'sans réceptivité, l’étape ne passe pas : l’automate attend');

  r1.state = 1; __advance(150); sim();
  ok(g.act[1] && !g.act[0], 'R1 franchit la transition : X0 s’éteint, X1 s’allume');
  sim();
  eq(g.outPins[1].state, 1, 'la broche X1 suit au cycle suivant');

  r1.state = 0; r2.state = 1; __advance(150); sim();
  ok(g.act[2], 'R2 fait avancer à X2');

  // temporisation : « toujours vraie », mais pas avant 1 s
  __advance(300); sim();
  ok(g.act[2], 'la temporisation retient l’étape');
  for (let i = 0; i < 8; i++){ __advance(200); sim(); }
  ok(g.act[0], 'après 1 s, la transition est franchie et le cycle reboucle');

  // le temps de scrutation borne la vitesse : c’est ce qui empêche le clignotement
  M.tr.forEach(t => { t.r = '1'; t.t = 0; });
  M.scan = 500;
  grReset(g);
  const depart = g.act.indexOf(1);
  __advance(100); sim(); sim();
  eq(g.act.indexOf(1), depart, 'sous le temps de scrutation, rien ne bouge');
  __advance(600); sim();
  ok(g.act.indexOf(1) !== depart, 'passé la scrutation, une seule transition est franchie');

  // INIT ramène à la situation initiale, sur front montant
  ini.state = 1; __advance(600); sim();
  ok(g.act[0] && !g.act[1] && !g.act[2], 'INIT ramène à l’étape initiale');
});

T('T155 GRAFCET : divergences OU et ET, réceptivités composées', () => {
  board();
  const g = mk('GRAFCET', 0, 0);
  const a = mk('SWITCH', -400, 0), b = mk('SWITCH', -400, 120), c2 = mk('SWITCH', -400, 240);
  link(a, 0, g, 0); link(b, 0, g, 1); link(c2, 0, g, 2);
  const M = grModel(g);
  M.scan = 50;

  // --- divergence OU : deux transitions concurrentes, réceptivités exclusives
  M.st = [{ x:1, y:0, ini:1 }, { x:0, y:1 }, { x:2, y:1 }];
  M.tr = [{ de:[0], a:[1], r:'R1·/R2', t:0 },
          { de:[0], a:[2], r:'R2·/R1', t:0 }];
  grReset(g);
  b.state = 1; __advance(100); sim();
  ok(g.act[2] && !g.act[1], 'R2 seule aiguille vers la branche de droite');
  grReset(g); b.state = 0; a.state = 1; __advance(100); sim();
  ok(g.act[1] && !g.act[2], 'R1 seule aiguille vers la branche de gauche');
  grReset(g); b.state = 1; __advance(100); sim();
  ok(g.act[0], 'les deux à la fois : réceptivités exclusives, rien ne part');

  // --- divergence ET : deux branches actives en même temps, puis convergence
  a.state = 0; b.state = 0; c2.state = 0;
  M.st = [{ x:1, y:0, ini:1 }, { x:0, y:1 }, { x:2, y:1 }, { x:1, y:2 }];
  M.tr = [{ de:[0], a:[1, 2], r:'R1', t:0 },        // divergence ET
          { de:[1, 2], a:[3], r:'R2', t:0 },        // convergence ET
          { de:[3], a:[0], r:'R3', t:0 }];
  grReset(g);
  a.state = 1; __advance(100); sim();
  ok(g.act[1] && g.act[2], 'divergence ET : les deux branches partent ensemble');
  eq(g.act[0], 0, 'et l’étape amont s’éteint');
  sim();
  ok(g.outPins[1].state === 1 && g.outPins[2].state === 1, 'les deux broches sont actives');
  // la convergence attend que les DEUX branches soient là
  a.state = 0; g.act[2] = 0; b.state = 1; __advance(100); sim();
  eq(g.act[3], 0, 'convergence ET : une seule branche prête ne suffit pas');
  g.act[2] = 1; __advance(100); sim();
  ok(g.act[3] && !g.act[1] && !g.act[2], 'les deux branches réunies, la convergence est franchie');
});

T('T156 GRAFCET : l’expression de réceptivité, le modèle et sa migration', () => {
  board();
  const g = mk('GRAFCET', 0, 0);
  const r = [0, 1, 2, 3].map(i => { const s2 = mk('SWITCH', -400, i * 100); link(s2, 0, g, i); return s2; });
  const M = grModel(g);
  M.st = [{ x:0, y:0, ini:1 }, { x:0, y:1 }];
  grReset(g); sim();
  const E = e => grEval(g, e);
  r[0].state = 1; r[1].state = 0; r[2].state = 1; sim();
  ok(E('R1'), 'R1');
  ok(!E('R2'), 'R2');
  ok(E('/R2'), 'le complément');
  ok(E('R1·R3'), 'le ET');
  ok(!E('R1·R2'), 'le ET, faux');
  ok(E('R2+R1'), 'le OU');
  ok(E('R1·/R2'), 'la composition');
  ok(E('/(R2+R4)'), 'les parenthèses');
  ok(E('X0'), 'l’activité d’une étape');
  ok(!E('X1'), 'une étape inactive');
  ok(E('1') && !E('0'), 'les constantes');
  ok(!E(''), 'une réceptivité vide ne franchit jamais : c’est le défaut sûr');

  // --- édition du modèle
  M.tr = [];
  const k = grAddStep(g, 1, 1);
  eq(grNb(g), 3, 'une étape ajoutée');
  grAddTrans(g, [0], [k], 'R4', 2);
  eq(grModel(g).tr.length, 1, 'une transition ajoutée');
  eq(grLabel(grModel(g).tr[0]), 'R4·t/2s', 'son étiquette porte la temporisation');
  grDelStep(g, 0);
  eq(grNb(g), 2, 'une étape supprimée');
  eq(grModel(g).tr.length, 0, 'et les transitions qui la touchaient avec');
  ok(grModel(g).st.some(e => e.ini), 'il reste toujours une étape initiale');

  // --- migration d'un montage enregistré à l'ancien format linéaire
  const vieux = mk('GRAFCET', 400, 0);
  vieux.opt = { nb:3, gr:[{ cond:'R1' }, { cond:'1', tempo:2 }, { cond:'R2', alt:'R3', altCible:0 }] };
  const mig = grModel(vieux);
  eq(mig.st.length, 3, 'les trois étapes sont retrouvées');
  eq(mig.tr.length, 4, 'trois transitions plus la branche alternative');
  eq(mig.tr[0].r, 'R1', 'les réceptivités sont reprises');
  eq(mig.tr[1].t, 2, 'les temporisations aussi');
  deq(mig.tr[1].a, [2], 'le chaînage est conservé');
  deq(mig.tr[2].a, [0], 'et le rebouclage de la dernière étape');
  eq(mig.tr[3].r, 'R3', 'la branche alternative devient une seconde transition');

  // --- et l'état voyage avec le montage
  board();
  const g2 = mk('GRAFCET', 0, 0);
  const M2 = grModel(g2);
  M2.st = [{ x:0, y:0, ini:1 }, { x:0, y:1 }, { x:0, y:2 }];
  M2.tr = [{ de:[0], a:[1], r:'1', t:0 }];
  grReset(g2); g2.act = [0, 1, 0];
  const data = serializeGroup([g2]);
  board();
  const copie = spawnGroup(data, 0, 0, true).made[0];
  deq(copie.act, [0, 1, 0], 'l’étape active est sauvegardée');
  eq(grNb(copie), 3, 'et le graphe avec');
});

T('T156b l’exemple « Perceuse en GRAFCET » enchaîne son cycle', () => {
  board();
  const ex = EXAMPLES.find(e => e.name === 'Perceuse en GRAFCET');
  ok(!!ex, 'exemple présent');
  const m = spawnGroup(ex.data, 0, 0, true).made;
  const g = m[0], dep = m[1], ver = m[2];
  grModel(g).scan = 60;                       // on accélère la scrutation pour le test
  sim();
  ok(g.act[0], 'au repos sur l’étape initiale');
  for (let i = 0; i < 5; i++){ __advance(150); sim(); }
  ok(g.act[0], 'sans départ, rien ne se passe');
  ok(ver.pos < 0.05, 'la broche est en haut');
  dep.state = 1; __advance(100); sim(); sim();
  ok(g.act[1], 'départ donné : descente');
  dep.state = 0;
  const vues = [1], tps = {};
  let t0 = Date.now();
  for (let i = 0; i < 300; i++){
    __advance(60); sim();
    const cur = g.act.indexOf(1);
    if (cur !== vues[vues.length - 1]){
      tps[vues[vues.length - 1]] = Date.now() - t0; t0 = Date.now();
      vues.push(cur);
      if (vues.length > 4) break;
    }
  }
  deq(vues.slice(0, 5), [1, 2, 3, 0], 'le cycle s’enchaîne 1 → 2 → 3 → 0');
  ok(tps[2] >= 2000, 'l’étape de perçage a bien duré 2 s (' + tps[2] + ' ms)');
  ok(ver.pos < .05, 'la broche est revenue en haut');
});

T('T157 le tuteur s’ouvre sur toutes les missions, table ou libre', () => {
  const sans = [];
  missions.forEach((m, i) => {
    if (m.bb) return;                                  // boîte noire : refus assumé
    const sol = buildSolution(m) || buildFreeSolution(m);
    if (!sol || !sol.steps || !sol.steps.length) sans.push(m.id + ' « ' + m.title + ' »');
  });
  ok(!sans.length, 'missions sans marche à suivre —\n      ' + sans.join('\n      '));
});

T('T158 les montages de référence des missions sont cohérents', () => {
  const bad = [];
  let avec = 0;
  missions.forEach(m => {
    const lay = missionDemo(m);
    if (!lay) return;
    avec++;
    board();
    const r = spawnGroup(lay, 0, 0, true);
    (lay.wires || []).forEach(w => {
      const a = r.made[w[0]], b = r.made[w[2]];
      if (!a || !b) return bad.push(m.id + ' : câble vers un composant absent');
      const op = a.outPins[w[1]], ip = b.inPins[w[3]];
      if (!op) return bad.push(m.id + ' : ' + a.type + ' n’a pas de sortie #' + w[1]);
      if (!ip) return bad.push(m.id + ' : ' + b.type + ' n’a pas d’entrée #' + w[3]);
      if (op.kind !== ip.kind)
        bad.push(m.id + ' : ' + a.type + '#' + w[1] + '(' + op.kind + ') → ' +
                 b.type + '#' + w[3] + '(' + ip.kind + ')');
    });
    // deux câbles ne doivent pas viser la même entrée — sauf une borne de
    // PUISSANCE, qui est une borne à vis et en accepte autant qu'on veut
    const cibles = (lay.wires || []).filter(w => {
      const b = r.made[w[2]], ip = b && b.inPins[w[3]];
      return ip && ip.kind !== 'pui';
    }).map(w => w[2] + ':' + w[3]);
    const dbl = cibles.filter((x, i) => cibles.indexOf(x) !== i);
    if (dbl.length) bad.push(m.id + ' : entrée alimentée deux fois (' + [...new Set(dbl)].join(', ') + ')');
    // et le montage doit tourner sans exploser
    try { sim(); sim(); } catch (e){ bad.push(m.id + ' : simulation en erreur — ' + e.message); }
  });
  ok(avec >= 55, 'au moins 55 missions ont un montage de référence (' + avec + ')');
  ok(!bad.length, 'montages incohérents —\n      ' + bad.join('\n      '));
});

T('T159 le tuteur pose vraiment le montage d’une mission libre', () => {
  const idx = missions.findIndex(m => m.id === 'm77');
  ok(idx >= 0, 'mission m77 présente');
  loadMission(idx);
  const avant = components.length;
  openTutor();
  ok(!!tutor, 'le tuteur s’ouvre sur une mission libre');
  ok(tutor.sol.libre, 'en mode « marche à suivre »');
  ok(tutor.sol.comps.length >= 4, 'avec un montage de référence');
  tutorAll();
  const poses = components.length - avant;
  eq(poses, tutor.sol.comps.length, 'tout le montage est posé sur le plan');
  ok(components.some(c => c.type === 'NIBBLE'), 'le clavier 4 bits en fait partie');
  ok(wires.length >= 8, 'et les câbles avec (' + wires.length + ')');
  sim();
  const dec = components.find(c => c.type === 'DEC');
  const nib = components.find(c => c.type === 'NIBBLE');
  nib.value = 11; sim(); sim();
  eq(dec.inPins.map(p => p.state ? 1 : 0).join(''), '1011', 'la valeur traverse le bus jusqu’à l’afficheur');
  loadMission(-1);
});

T('T160 les entrées ne sont bridées que sur les missions à table de vérité', () => {
  const libre = missions.find(m => m.id === 'm77');
  const table = missions.find(m => m.tt && m.tt.length && m.inputs >= 2);
  ok(!!table, 'au moins une mission à table');
  ok(!toolState('NIBBLE', libre).dis, 'mission libre : le clavier 4 bits est disponible');
  ok(!toolState('SWITCH', libre).dis, 'et les interrupteurs aussi');
  ok(!toolState('CLOCK', libre).dis, 'et l’horloge');
  ok(toolState('SWITCH', table).dis, 'mission à table : les entrées sont fournies');
  ok(toolState('NIBBLE', table).dis, 'le clavier aussi : la table deviendrait invérifiable');
  // les capteurs restent posables partout : ce sont des instruments, pas des entrées d’essai
  ok(!toolState('TEMPC', table).dis, 'un capteur reste posable même sur une mission à table');
  ok(!toolState('AND', libre).dis, 'et la logique n’est jamais bridée sans consigne explicite');
  // une mission « NAND uniquement » verrouille bien les autres portes
  const nandOnly = missions.find(m => m.allowed && m.allowed.length === 1);
  if (nandOnly){
    ok(toolState('AND', nandOnly).dis, 'mission à base imposée : les autres portes sont fermées');
    ok(!toolState(nandOnly.allowed[0], nandOnly).dis, 'sauf celle qu’elle impose');
  }
});

T('T161 pannes : hors service, mesure figée, dérive et organe bloqué', () => {
  board();
  const four = mk('FOUR', 0, 0), capt = mk('TEMPC', 300, 0), ecr = mk('ECRAN', 600, 0);
  const on = mk('HIGH', -300, 0);
  link(on, 0, four, 0); link(four, 0, capt, 0); link(capt, 0, ecr, 0);
  for (let i = 0; i < 20; i++){ __advance(150); sim(); }
  const sain = capt.outPins[0].state;
  ok(sain > 0, 'en marche normale, le capteur mesure (' + sain.toFixed(1) + ')');

  // --- hors service : plus rien ne sort
  setPanne(capt, 'hs');
  sim();
  eq(capt.outPins[0].state, 0, 'hors service : plus aucune sortie');
  eq(ecr.inPins[0].state, 0, 'et l’écran ne reçoit plus rien');

  // --- mesure figée : la valeur reste, le four continue de chauffer
  setPanne(capt, 'fige');
  sim();
  const gele = capt.outPins[0].state;
  ok(gele > 0, 'figée sur la dernière valeur (' + gele.toFixed(1) + ')');
  const avant = four.temp;
  for (let i = 0; i < 20; i++){ __advance(150); sim(); }
  ok(four.temp > avant + 5, 'le four continue de monter pour de vrai');
  eq(capt.outPins[0].state, gele, 'mais la mesure ne bouge plus d’un poil');

  // --- dérive : la mesure ment d’un pourcentage constant.
  // Sur un capteur en pleine échelle la dérive serait invisible (il sature
  // déjà) : on la mesure sur une sonde à mi-course, comme en vrai.
  setPanne(capt, '');
  const pot = mk('POT', 0, 400);
  applyInspector(pot, fld('o_val', 40));
  sim(); sim();
  const vrai = pot.outPins[0].state;
  ok(vrai > 20 && vrai < ANA_MAX - 20, 'la sonde est à mi-échelle (' + vrai.toFixed(1) + ')');
  setPanne(pot, 'derive', 50);
  sim(); sim();
  near(pot.outPins[0].state / vrai, 1.5, 0.02, 'la dérive de 50 % décale bien la mesure');
  setPanne(pot, 'derive', -30);
  sim(); sim();
  near(pot.outPins[0].state / vrai, 0.7, 0.02, 'et une dérive négative fait lire trop bas');

  // --- organe bloqué : l’intérieur ne bouge plus
  const t0 = four.temp;
  setPanne(four, 'bloque');
  for (let i = 0; i < 20; i++){ __advance(150); sim(); }
  near(four.temp, t0, 0.01, 'four bloqué : sa température ne bouge plus');
  ok(capt.outPins[0].state > 0, 'et le capteur dit honnêtement que rien ne change');
  setPanne(four, '');
  for (let i = 0; i < 10; i++){ __advance(150); sim(); }
  ok(four.temp > t0, 'panne levée : le procédé repart');
});

T('T162 une panne se règle, se révèle et voyage avec le montage', () => {
  board();
  const v = mk('VALVE', 0, 0);
  eq(pannesOf(v), null, 'un composant neuf est sain');
  applyInspector(v, fld('panne', 'bloque'));
  eq(v.panne.k, 'bloque', 'l’inspecteur pose la panne');
  applyInspector(v, fld('panne', 'derive'));
  applyInspector(v, fld('pannev', 35));
  eq(v.panne.v, 35, 'et son ampleur');
  applyInspector(v, fld('panne', 'nimportequoi'));
  eq(pannesOf(v), null, 'une panne inconnue remet le composant en état');
  applyInspector(v, fld('panne', 'hs'));
  // elle survit à la copie et à la sauvegarde
  const data = serializeGroup([v]);
  board();
  const copie = spawnGroup(data, 0, 0, true).made[0];
  eq(copie.panne.k, 'hs', 'la panne voyage avec le montage');
  // …et au parcours annuler / refaire
  const snap = snapshotState();
  copie.panne = null;
  buildBoard(JSON.parse(snap));
  ok(pannesOf(components[0]), 'annuler retrouve le composant en panne');
  // le révélateur ne change rien à la simulation, seulement à l’affichage
  const avant = revelePannes;
  revelePannes = true;
  ok(compTipData(components[0]).lines.some(l => /EN PANNE/.test(l)),
     'révélées, elles s’annoncent dans l’infobulle');
  revelePannes = false;
  ok(!compTipData(components[0]).lines.some(l => /EN PANNE/.test(l)),
     'masquées, rien ne les trahit — c’est le principe du diagnostic');
  revelePannes = avant;
});

T('T163 les missions de dépannage tombent vraiment en panne', () => {
  // m146 : le capteur figé laisse le four s’emballer
  let idx = missions.findIndex(m => m.id === 'm146');
  ok(idx >= 0, 'mission m146 présente');
  loadMission(idx); openTutor(); tutorAll();
  const capt = components.find(c => c.type === 'TEMPC');
  const four = components.find(c => c.type === 'FOUR');
  ok(pannesOf(capt) && pannesOf(capt).k === 'fige', 'le capteur est bien posé en panne');
  for (let i = 0; i < 40; i++){ __advance(150); sim(); }
  const mes = capt.outPins[0].state, vrai = four.temp;
  ok(vrai > 120, 'le four s’emballe pour de vrai (' + Math.round(vrai) + ')');
  for (let i = 0; i < 20; i++){ __advance(150); sim(); }
  eq(capt.outPins[0].state, mes, 'pendant que la mesure reste figée');
  ok(four.temp > vrai, 'et que la température continue de monter');
  // panne levée : la boucle régule de nouveau
  setPanne(capt, '');
  let coupe = false;
  for (let i = 0; i < 120; i++){ __advance(150); sim(); if (!four.pwr) coupe = true; }
  ok(coupe, 'panne levée, le thermostat finit par couper');

  // m147 : la vanne bloquée ne laisse rien passer malgré l’ordre
  idx = missions.findIndex(m => m.id === 'm147');
  loadMission(idx); openTutor(); tutorAll();
  const vanne = components.find(c => c.type === 'VALVE');
  const cuve = components.find(c => c.type === 'CUVE');
  const niv0 = cuve.niv;
  for (let i = 0; i < 30; i++){ __advance(150); sim(); }
  ok(vanne.inPins[0].state > 0, 'l’ordre d’ouvrir arrive bien à la vanne');
  near(cuve.niv, niv0, 0.5, 'et pourtant la cuve ne se remplit pas');
  setPanne(vanne, '');
  for (let i = 0; i < 30; i++){ __advance(150); sim(); }
  ok(cuve.niv > niv0 + 3, 'panne levée : le remplissage repart (' + cuve.niv.toFixed(1) + ' %)');
  loadMission(-1);
});

T('T164 l’éditeur de GRAFCET construit et corrige le graphe', () => {
  board();
  const g = mk('GRAFCET', 0, 0);
  openGrafcet(g);
  ok(grOuvert(), 'l’éditeur s’ouvre sur un GRAFCET');
  eq(grComp, g, 'et travaille sur le bon composant');

  // ajouter une étape
  const n0 = grNb(g);
  const nouvelle = grToolAdd();
  eq(grNb(g), n0 + 1, 'une étape ajoutée');
  ok(grSel && grSel.k === 'st' && grSel.i === nouvelle, 'et sélectionnée aussitôt');
  const M = grModel(g);
  ok(!M.st.some((e, i) => i !== nouvelle && e.x === M.st[nouvelle].x && e.y === M.st[nouvelle].y),
     'posée sur une case libre, sans en recouvrir une autre');

  // relier : deux clics, une transition
  const nt = M.tr.length;
  grToolLink();
  eq(grMode, 'link', 'mode raccordement armé');
  grClickStep(0);
  eq(grLinkFrom, 0, 'première étape retenue');
  grClickStep(nouvelle);
  eq(M.tr.length, nt + 1, 'la transition est créée');
  eq(grMode, '', 'et le mode se referme tout seul');
  eq(grSel.k, 'tr', 'la nouvelle transition est sélectionnée');
  deq(M.tr[grSel.i].de, [0], 'de la bonne étape');
  deq(M.tr[grSel.i].a, [nouvelle], 'vers la bonne étape');
  const T = grSel.i;

  // réceptivité et temporisation
  grSetRec(T, 'R2·/R3');
  eq(M.tr[T].r, 'R2·/R3', 'la réceptivité est reprise');
  grSetTempo(T, '3');
  eq(M.tr[T].t, 3, 'la temporisation aussi');
  eq(grLabel(M.tr[T]), 'R2·¬R3·t/3s', 'et l’étiquette les rassemble');

  // divergence ET par les pastilles d’aval
  grToggleBranch(T, 'a', 1);
  ok(M.tr[T].a.length === 2, 'une seconde étape aval : divergence ET');
  grToggleBranch(T, 'a', 1);
  ok(M.tr[T].a.length === 1, 'et on peut la retirer');
  grToggleBranch(T, 'a', M.tr[T].a[0]);
  ok(M.tr[T].a.length === 1, 'mais jamais retirer la dernière : une transition mène quelque part');

  // étape initiale
  grSel = { k:'st', i:nouvelle };
  grToolInit();
  ok(M.st[nouvelle].ini, 'l’étape devient initiale');
  grSel = { k:'st', i:0 };
  grToolInit(); grSel = { k:'st', i:nouvelle }; grToolInit();
  ok(M.st.some(e => e.ini), 'il reste toujours au moins une étape initiale');

  // suppression
  grSel = { k:'tr', i:T };
  const avant = M.tr.length;
  grToolDel();
  eq(M.tr.length, avant - 1, 'la transition sélectionnée est supprimée');
  eq(grSel, null, 'et la sélection est libérée');

  // temps de scrutation
  eq(grSetScan('800'), 800, 'le temps de scrutation se règle');
  eq(grScan(g), 800, 'et il est retenu');
  grSetScan('5');
  ok(grScan(g) >= 20, 'borné en bas : un automate ne scrute pas à l’infini');

  // le graphe édité survit à la fermeture
  const nb = grNb(g), ntr = grModel(g).tr.length;
  closeGrafcet();
  ok(!grOuvert(), 'l’éditeur se referme');
  eq(grNb(g), nb, 'les étapes sont conservées');
  eq(grModel(g).tr.length, ntr, 'les transitions aussi');
});

T('T165 un GRAFCET neuf ne s’emballe pas', () => {
  board();
  const g = mk('GRAFCET', 0, 0);
  sim();
  const depart = g.act.join('');
  // le défaut d’usine attend R1 : rien ne bouge tant qu’on n’appuie pas
  for (let i = 0; i < 60; i++){ __advance(16); sim(); }
  eq(g.act.join(''), depart, 'sans réceptivité vraie, le jeton reste en place');
  // et même avec une réceptivité toujours vraie, la scrutation borne la cadence
  const M = grModel(g);
  M.tr.forEach(t => { t.r = '1'; t.t = 0; });
  M.scan = 250;
  grReset(g);
  let sauts = 0, prev = g.act.join('');
  for (let i = 0; i < 60; i++){                 // 60 images à 16 ms ≈ 1 s
    __advance(16); sim();
    if (g.act.join('') !== prev){ sauts++; prev = g.act.join(''); }
  }
  ok(sauts <= 5, 'au plus quelques franchissements par seconde (' + sauts + '), pas soixante');
  ok(sauts >= 2, 'mais le graphe avance quand même (' + sauts + ')');
});

T('T166 le tracé des câbles : angles droits, contournement et couloirs', () => {
  const mode0 = wireMode;
  board();
  setWireMode('ortho');
  const a = mk('SWITCH', 0, 0), b = mk('LED', 500, 300);
  const w = link(a, 0, b, 0);
  sim();
  const P = w.route();
  ok(P.length >= 4, 'un itinéraire à plusieurs segments (' + P.length + ')');
  // tous les segments intermédiaires sont horizontaux ou verticaux
  let obliques = 0;
  for (let i = 1; i < P.length - 2; i++)
    if (Math.abs(P[i].x - P[i+1].x) > .6 && Math.abs(P[i].y - P[i+1].y) > .6) obliques++;
  eq(obliques, 0, 'aucun segment oblique');
  eq(Math.round(P[0].x), Math.round(a.outPins[0].x), 'il part de la broche de sortie');
  eq(Math.round(P[P.length-1].y), Math.round(b.inPins[0].y), 'et arrive sur la broche d’entrée');
  // l'amorce quitte la broche dans sa direction
  ok(P[1].x > P[0].x, 'l’amorce sort vers la droite d’une broche de sortie');

  // --- rétroaction : la cible est derrière, l’itinéraire contourne
  board();
  const g1 = mk('AND', 400, 200), g2 = mk('NOT', 100, 200);
  const w2 = link(g1, 0, g2, 0);
  sim();
  const R = w2.route();
  const yMax = Math.max(...R.map(p => p.y)), yMin = Math.min(...R.map(p => p.y));
  ok(yMax > g1.y + g1.h - 1 || yMin < g1.y + 1,
     'le retour passe au-dessus ou au-dessous des boîtiers');
  let obl2 = 0;
  for (let i = 1; i < R.length - 2; i++)
    if (Math.abs(R[i].x - R[i+1].x) > .6 && Math.abs(R[i].y - R[i+1].y) > .6) obl2++;
  eq(obl2, 0, 'et reste à angles droits');

  // --- deux câbles dans le même couloir sont écartés
  board();
  const s1 = mk('SWITCH', 0, 0), s2 = mk('SWITCH', 0, 120);
  const l1 = mk('LED', 600, 0), l2 = mk('LED', 600, 120);
  link(s1, 0, l2, 0); link(s2, 0, l1, 0);        // deux trajets qui se croisent
  sim();
  spreadRoutes();
  const colonnes = wires.map(w3 => {
    const P3 = w3._rp;
    for (let i = 1; i < P3.length - 2; i++)
      if (Math.abs(P3[i].x - P3[i+1].x) < .6 && Math.abs(P3[i].y - P3[i+1].y) > 20) return P3[i].x;
    return null;
  }).filter(v => v != null);
  eq(colonnes.length, 2, 'les deux câbles ont un segment vertical');
  ok(Math.abs(colonnes[0] - colonnes[1]) >= WIRE_ECART - .01,
     'et ils ne se superposent pas (' + Math.abs(colonnes[0] - colonnes[1]).toFixed(1) + ' px)');

  // --- les trois modes, et le choix mémorisé
  setWireMode('direct');
  const d = wires[0].route();
  eq(d.length, 2, 'mode direct : un seul segment');
  eq(localStorage.getItem('al2_wire'), 'direct', 'le mode est mémorisé');
  setWireMode('courbe');
  ok(typeof wires[0].segCtrl === 'function', 'mode courbe : les contrôles de Bézier restent');
  setWireMode('pasunmode');
  eq(wireMode, 'courbe', 'un mode inconnu est refusé');
  const suivant = cycleWireMode();
  ok(suivant && suivant[0] !== 'courbe', 'le bouton fait défiler les modes');
  setWireMode(mode0);
});

T('T167 les poignées posent un itinéraire à la main, au bon endroit', () => {
  const mode0 = wireMode;
  setWireMode('ortho');
  board();
  const a = mk('SWITCH', 0, 0), b = mk('LED', 600, 300);
  const w = link(a, 0, b, 0);
  sim();
  // un point pris au milieu du tracé désigne le bon tronçon
  const ech = w.segPoints(8);
  const mil = ech[Math.floor(ech.length / 2)];
  eq(mil.seg, 0, 'sans poignée, tout le fil est le tronçon 0');
  w.wp.splice(mil.seg, 0, { x:320, y:160 });
  eq(w.wp.length, 1, 'la poignée est posée');
  const P = w.route();
  ok(P.some(p => Math.abs(p.x - 320) < .6 && Math.abs(p.y - 160) < .6),
     'et l’itinéraire passe bien par elle');
  let obl = 0;
  for (let i = 1; i < P.length - 2; i++)
    if (Math.abs(P[i].x - P[i+1].x) > .6 && Math.abs(P[i].y - P[i+1].y) > .6) obl++;
  eq(obl, 0, 'le tracé reste à angles droits de part et d’autre');
  // les tronçons sont maintenant numérotés de part et d’autre de la poignée
  const legs = [...new Set(w.segPoints(8).map(p => p.seg))].sort();
  deq(legs, [0, 1], 'deux tronçons, avant et après la poignée');
  // une seconde poignée s’insère du bon côté
  const apres = w.segPoints(8).filter(p => p.seg === 1);
  w.wp.splice(apres[0].seg, 0, { x:480, y:240 });
  eq(w.wp.length, 2, 'deux poignées');
  deq(w.wp.map(p => p.x), [320, 480], 'insérée après la première, pas avant');
  setWireMode(mode0);
});

T('T168 le rail de distribution : un seul point, deux rangées, une arrivée', () => {
  board();
  const r = mk('RAIL8', 300, 300);
  eq(railN(r), 8, 'huit bornes par défaut');
  const src = mk('HIGH', 0, 0);
  // l'arrivée se fait par une borne quelconque — ici celle du bas, au milieu
  const bas = RAIL_MAX + 4;
  wires.push(new Wire(src.outPins[0], r.inPins[bas]));
  // et les départs se prennent partout : en haut, en bas, à gauche, à droite
  const cibles = [0, 7, RAIL_MAX + 1, RAIL_MAX + 6].map((k, i) => {
    const l = mk('LED', 800, i * 140);
    wires.push(new Wire(r.outPins[k], l.inPins[0]));
    return l;
  });
  recalcFan(); sim(); sim();
  cibles.forEach((l, i) => eq(l.inPins[0].state, 1,
    'la borne ' + [0, 7, RAIL_MAX + 1, RAIL_MAX + 6][i] + ' distribue aussi'));
  eq(r.val, 1, 'le rail porte la valeur reçue');

  // --- une seconde arrivée est refusée : ce serait un court-circuit
  const autre = mk('SWITCH', 0, 400);
  const n0 = wires.length;
  connectWire(autre.outPins[0], r.inPins[2]);
  eq(wires.length, n0, 'la seconde arrivée est refusée');
  ok(REG.RAIL8.refuse(r, r.inPins[2]), 'et le composant dit pourquoi');
  eq(REG.RAIL8.refuse(r, r.outPins[2]), null, 'mais un départ de plus reste permis');
  connectWire(r.outPins[3], mk('LED', 800, 700).inPins[0]);
  eq(wires.length, n0 + 1, 'et il s’ajoute');
  // débranchée, l'arrivée redevient possible
  wires = wires.filter(w => w.inPin.comp !== r);
  eq(REG.RAIL8.refuse(r, r.inPins[2]), null, 'rail libéré : on peut réalimenter');

  // --- les câbles arrivent par le haut ou par le bas, jamais de côté
  const dHaut = r.inPins[3].dir(), dBas = r.outPins[RAIL_MAX + 3].dir();
  eq(dHaut.x, 0, 'la rangée du haut sort verticalement');
  eq(dHaut.y, -1, 'vers le haut');
  eq(dBas.x, 0, 'celle du bas aussi');
  eq(dBas.y, 1, 'vers le bas');
  // les deux rangées sont bien de part et d'autre de la barre
  ok(r.inPins[3].ly < r.y + 1, 'rangée du haut sur le bord supérieur');
  ok(r.outPins[RAIL_MAX + 3].ly > r.y + r.h - 1, 'rangée du bas sur le bord inférieur');
  // et une borne accepte arrivée ET départ au même endroit
  near(r.inPins[3].lx, r.outPins[3].lx, 0.01, 'arrivée et départ sont au même point');
  near(r.inPins[3].ly, r.outPins[3].ly, 0.01, 'exactement');

  // --- une valeur analogique passe sans être ramenée à 1
  board();
  const r2 = mk('RAIL8', 300, 200), pot = mk('POT', 0, 0), j = mk('JAUGE', 700, 0);
  applyInspector(pot, fld('o_val', 40));
  wires.push(new Wire(pot.outPins[0], r2.inPins[2]));
  wires.push(new Wire(r2.outPins[RAIL_MAX + 6], j.inPins[0]));
  recalcFan(); sim(); sim();
  near(j.raw, pot.outPins[0].state, 0.01, 'le rail transporte la mesure telle quelle');

  // --- la longueur se règle, et le boîtier suit
  const w0 = r2.w;
  applyInspector(r2, fld('o_n', 16));
  eq(railN(r2), 16, 'seize bornes');
  ok(r2.w > w0, 'la barre s’allonge');
  applyInspector(r2, fld('o_n', 2));
  eq(railN(r2), 2, 'deux bornes au minimum');
  applyInspector(r2, fld('o_n', 99));
  eq(railN(r2), RAIL_MAX, 'bornée à seize');
  applyInspector(r2, fld('o_n', 4));
  sim(); sim();
  eq(r2.outPins[6].state, 0, 'la borne 7 d’un rail de 4 ne sort rien');
  ok(REG.RAIL8.pinHidden(r2, r2.outPins[6]), 'et elle n’est ni dessinée ni cliquable');
  ok(!REG.RAIL8.pinHidden(r2, r2.outPins[RAIL_MAX + 2]), 'la borne 3 du bas existe toujours');

  // --- pas de glissière : elle se poserait sur la rangée de bornes
  eq(primaryParam(r2), null, 'le rail n’a pas de glissière');

  // --- les trois longueurs de la palette et le repère
  ['RAIL4', 'RAIL8', 'RAIL12'].forEach((id, i) => {
    const c = mk(id, 0, 400 + i * 120);
    eq(railN(c), [4, 8, 12][i], id + ' : bonne longueur par défaut');
    ok(TOOL_TABS.some(t => t.items.includes(id)), id + ' : présent dans la palette');
  });
  const nomme = mk('RAIL4', 1100, 0);
  applyInspector(nomme, Object.assign(fld('o_nom', 'ALIM'), { tagName:'INPUT' }));
  eq(optOf(nomme, 'nom'), 'ALIM', 'le repère est retenu');
  ok(REG.RAIL4.tip(nomme).some(l => /ALIM/.test(l)), 'et rappelé dans l’infobulle');
  ok(REG.RAIL4.tip(nomme).some(l => /Aucune arrivée/.test(l)), 'un rail non alimenté le dit');

  // --- l'onglet Câblage existe dans les deux ateliers
  const tab = TOOL_TABS.find(t => t.key === 'wire');
  ok(!!tab, 'onglet Câblage');
  ok(tab.items.includes('TUNNEL'), 'le tunnel l’a rejoint');
  ok(tab.dom.includes('elec') && tab.dom.includes('proc'), 'disponible des deux côtés');
});

T('T168b lâcher un fil sur une borne de rail vise bien l’arrivée', () => {
  board();
  const r = mk('RAIL8', 300, 300), src = mk('HIGH', 0, 0);
  // la broche d'arrivée et celle de départ sont au même point : c'est le sens
  // demandé qui départage
  const x = r.inPins[2].x, y = r.inPins[2].y;
  const pIn  = pickPin(x, y, 'in'),  pOut = pickPin(x, y, 'out');
  ok(pIn && !pIn.isOutput, 'on peut viser l’arrivée');
  ok(pOut && pOut.isOutput, 'et le départ');
  eq(pIn.comp, r, 'sur le bon composant');
  connectWire(src.outPins[0], pIn);
  eq(wires.length, 1, 'le raccordement se fait');
  sim(); sim();
  eq(r.val, 1, 'et le rail distribue');
});

T('T169 le plan miniature ne s’affiche que quand il sert, et navigue', () => {
  board();
  eq(miniGeo(), null, 'plan vide : pas de miniature');
  mk('AND', 0, 0);
  cam.z = 1; cam.x = 0; cam.y = 0;
  eq(miniGeo(), null, 'un montage qui tient à l’écran : inutile');
  // un montage plus large que la vue
  for (let i = 0; i < 12; i++) mk('AND', i * 400, i * 260);
  const g = miniGeo();
  ok(!!g, 'montage débordant : la miniature apparaît');
  ok(g.w > 80 && g.h > 60, 'de taille lisible');
  ok(g.k > 0 && g.k < 1, 'à l’échelle réduite (' + g.k.toFixed(3) + ')');
  // un clic dans la miniature recentre la vue sur le point visé
  const cible = components[6];
  const sx = g.ox + (cible.x + cible.bw / 2) * g.k, sy = g.oy + (cible.y + cible.bh / 2) * g.k;
  ok(miniClick(sx, sy), 'le clic est pris par la miniature');
  const centre = s2w(W / 2, H / 2);
  near(centre.x, cible.x + cible.bw / 2, 2, 'la vue se centre sur le point cliqué');
  near(centre.y, cible.y + cible.bh / 2, 2, 'en X comme en Y');
  ok(!miniClick(W - 20, 20), 'un clic ailleurs ne la concerne pas');
  cam.z = 1; cam.x = 0; cam.y = 0;
});

T('T170 tirer un fil dans le vide propose et pose le composant câblé', () => {
  board();
  const a = mk('SWITCH', 0, 0);
  // depuis une sortie logique : on propose de la logique et des sorties
  const sugg = (openQuick(a.outPins[0], 400, 300), quickTypes(quickFrom));
  ok(sugg.length > 0, 'des composants sont proposés');
  ok(sugg.includes('LED') || sugg.includes('AND'), 'et ce sont les bons (' + sugg.slice(0,4) + ')');
  ok(!sugg.includes('SWITCH'), 'pas une source : elle n’a rien pour recevoir');
  // on en choisit un : il est posé ET câblé, du bon côté
  const n0 = components.length, w0 = wires.length;
  const c = quickPlace('AND');
  eq(components.length, n0 + 1, 'le composant est posé');
  eq(wires.length, w0 + 1, 'et câblé du même geste');
  eq(wires[wires.length-1].outPin, a.outPins[0], 'depuis la broche restée en l’air');
  eq(wires[wires.length-1].inPin.comp, c, 'vers le nouveau venu');
  ok(c.x > 400 - 200, 'posé à droite : le fil ne repart pas en arrière');
  eq(quickFrom, null, 'et le menu se referme');

  // depuis une ENTRÉE : on propose des sources, et le composant se pose à gauche
  board();
  const l = mk('LED', 600, 300);
  openQuick(l.inPins[0], 300, 300);
  const src = quickTypes(quickFrom);
  ok(src.includes('SWITCH') || src.includes('HIGH'), 'des sources sont proposées');
  const c2 = quickPlace('HIGH');
  ok(c2.x < s2w(300, 300).x, 'posé à gauche de la broche');
  eq(wires[wires.length-1].inPin, l.inPins[0], 'et câblé vers l’entrée');
  sim(); sim();
  eq(l.inPins[0].state, 1, 'le montage fonctionne aussitôt');

  // les natures sont respectées : un port fluide n’appelle que de la tuyauterie
  board();
  const pu = mk('PUMP', 0, 0);
  openQuick(pu.outPins[1], 400, 300);           // REF, port fluide
  const flu = quickTypes(quickFrom);
  ok(flu.includes('TUYAU'), 'la tuyauterie est proposée');
  ok(!flu.includes('AND'), 'mais pas une porte logique');
  flu.forEach(t => {
    const p = new Component(0, 0, t);
    ok(p.inPins.some(x => x.kind === 'flu'), t + ' a bien un raccord fluide');
  });
  closeQuick();

  // la recherche filtre, et un composant interdit par la mission n’est pas offert
  board();
  const b2 = mk('SWITCH', 0, 0);
  openQuick(b2.outPins[0], 400, 300);
  quickFilter = 'ampoule';
  ok(quickTypes(quickFrom).includes('LED'), 'la recherche retrouve l’ampoule');
  quickFilter = 'zzzz';
  eq(quickTypes(quickFrom).length, 0, 'et ne trouve rien quand il n’y a rien');
  closeQuick();
});

T('T171 les guides d’alignement collent le bloc sur ses voisins', () => {
  board();
  const a = mk('AND', 200, 200), b = mk('OR', 600, 500);
  // presque aligné à gauche : ça s'accroche
  let r = alignGuides(b, 204, 500);
  eq(r.x, 200, 'bord gauche recalé sur celui du voisin');
  ok(alignLines.some(g => g.vert), 'et la ligne verticale est tracée');
  // presque aligné en haut
  r = alignGuides(b, 900, 197);
  eq(r.y, 200, 'bord haut recalé');
  ok(alignLines.some(g => !g.vert), 'ligne horizontale');
  // les centres s'alignent aussi
  const cy = a.y + a.bh / 2;
  r = alignGuides(b, 900, cy - b.bh / 2 + 3);
  near(r.y + b.bh / 2, cy, 0.01, 'les centres se rejoignent');
  // trop loin : rien ne bouge
  r = alignGuides(b, 900, 700);
  eq(r.x, 900, 'hors tolérance, la position est respectée');
  eq(r.y, 700, 'en X comme en Y');
  eq(alignLines.length, 0, 'et aucun guide n’est tracé');
  // un bloc ne s’aligne pas sur lui-même
  r = alignGuides(a, 200, 200);
  eq(alignLines.length, 0, 'pas de guide sur soi-même');
});

T('T172 le cadre de commentaire range le plan et emporte son contenu', () => {
  board();
  const a = mk('AND', 200, 200), b = mk('OR', 500, 260), loin = mk('NOT', 1400, 900);
  selection.clear(); selection.add(a); selection.add(b);
  const z = encadrerSelection();
  ok(!!z && z.type === 'ZONE', 'le cadre est créé depuis la sélection');
  ok(z.x < a.x && z.y < a.y, 'il englobe le premier');
  ok(z.x + z.w > b.x + b.bw && z.y + z.h > b.y + b.bh, 'et le second');
  const dedans = zoneContenu(z);
  eq(dedans.length, 2, 'il contient les deux composants');
  ok(!dedans.includes(loin), 'et pas celui qui est loin');
  // il ne se prend que par sa barre de titre
  ok(compHit(z, z.x + 40, z.y + 8), 'la barre de titre le sélectionne');
  ok(!compHit(z, z.x + 40, z.y + 120), 'le reste du cadre laisse passer les clics');
  eq(pickComp(a.x + 10, a.y + 10), a, 'un composant sous le cadre reste attrapable');
  // il ne compte pas comme une porte
  eq(gateCost('ZONE') || 0, 0, 'il ne coûte aucune porte');
  // --- la poignée de coin redimensionne, la glissière a disparu
  eq(primaryParam(z), null, 'pas de glissière : elle serait hors d’atteinte');
  eq(gripAt(z.x + z.w - 10, z.y + z.h - 10), z, 'la poignée du coin bas-droit répond');
  eq(gripAt(z.x + 10, z.y + 10), null, 'et pas le reste du cadre');
  const w0 = z.w, h0 = z.h;
  gripStart(z, z.x + z.w - 10, z.y + z.h - 10);
  gripMove(z.x + z.w - 10 + 200, z.y + z.h - 10 + 160);
  ok(z.w > w0 + 150, 'le cadre s’agrandit (' + w0 + ' → ' + z.w + ')');
  ok(z.h > h0 + 100, 'en hauteur aussi');
  eq(z.opt.larg, z.w, 'et la taille est bien celle du réglage');
  gripMove(z.x - 5000, z.y - 5000);
  ok(z.w >= 140 && z.h >= 100, 'il ne peut pas devenir minuscule');
  zoneDrag = null;

  // la taille et le titre voyagent avec le montage
  applyInspector(z, Object.assign(fld('o_titre', 'Boucle de température'), { tagName:'INPUT' }));
  const data = serializeGroup([z]);
  board();
  const copie = spawnGroup(data, 0, 0, true).made[0];
  eq(optOf(copie, 'titre'), 'Boucle de température', 'le titre est conservé');
  eq(copie.w, z.w, 'la largeur aussi');
  eq(copie.h, z.h, 'et la hauteur');
});

T('T173 trouver un composant sur le plan et s’y rendre', () => {
  board();
  const four = mk('FOUR', 2000, 1400);
  const led = mk('LED', 0, 0);
  led.customLabel = 'Alarme';
  cam.z = 1; cam.x = 0; cam.y = 0;
  eq(findMatches('four').length, 1, 'le four est retrouvé par son nom');
  eq(findMatches('four')[0], four, 'et c’est le bon');
  eq(findMatches('alarme')[0], led, 'une étiquette personnalisée aussi');
  eq(findMatches('zzz').length, 0, 'et rien quand rien ne correspond');
  eq(findMatches('').length, 2, 'sans filtre : tout le plan');
  ok(findMatches('')[0].customLabel, 'les composants étiquetés viennent en tête');
  // s'y rendre
  gotoComp(four);
  const centre = s2w(W / 2, H / 2);
  near(centre.x, four.x + four.bw / 2, 2, 'la vue se centre sur le composant');
  near(centre.y, four.y + four.bh / 2, 2, 'en X comme en Y');
  ok(selection.has(four), 'et il est sélectionné pour qu’on le repère');
  cam.z = 1; cam.x = 0; cam.y = 0; selection.clear();
});

T('T174 la leçon se lit page par page, en avant comme en arrière', () => {
  const idx = missions.findIndex(m => m.id === 'm7');
  loadMission(idx);
  __fire('btn-tutor', 'click');
  ok(tutor, 'la leçon est ouverte');
  const n = tutor.sol.steps.length + 1;          // + la page « terminé »
  eq(tutor.step, 0, 'on démarre à la première page');
  eq(__el('tutor-dots').textContent, '1 / ' + n, 'le compteur affiche la page');
  ok(__el('tutor-prev').disabled, 'pas de page avant la première');
  ok(!__el('tutor-skip').disabled, 'mais on peut avancer');
  __fire('tutor-skip', 'click');
  eq(tutor.step, 1, 'la flèche avance d’une page');
  ok(/ÉTAPE 2/.test(__el('tutor-step').textContent), 'et le titre suit');
  ok(!__el('tutor-prev').disabled, 'on peut désormais reculer');
  __fire('tutor-prev', 'click');
  eq(tutor.step, 0, 'la flèche arrière revient d’une page');
  // on ne dépasse jamais les bornes
  for (let k = 0; k < n + 5; k++) __fire('tutor-skip', 'click');
  eq(tutor.step, n - 1, 'la dernière page est un mur');
  ok(__el('tutor-skip').disabled, 'et la flèche avant s’éteint');
  for (let k = 0; k < n + 5; k++) __fire('tutor-prev', 'click');
  eq(tutor.step, 0, 'la première page aussi');
  closeTutor();
  eq(tutor, null, 'et la leçon se referme');
});

T('T175 chaque page éclaire la partie du schéma dont elle parle', () => {
  const idx = missions.findIndex(m => m.id === 'm7');
  loadMission(idx);
  __fire('btn-tutor', 'click');
  __fire('tutor-all', 'click');                  // le montage est posé
  eq(Object.keys(tutor.ghosts).length, 0, 'plus un seul fantôme');
  tutor.step = 0; renderTutor();
  ok(lessonFocus && lessonFocus.size, 'la première étape désigne des composants');
  const av = lessonFocus.size;
  ok([...lessonFocus].every(c => components.includes(c)),
     'et ce sont bien des composants du plan');
  // les noms écrits en capitales dans le texte sont reconnus
  const et = components.find(c => c.type === 'AND');
  if (et) ok(lessonRefs('Pose une porte <b>ET</b> au milieu').includes(et),
             '« ET » désigne la porte ET posée');
  ok(!lessonRefs('rien de reconnaissable ici').length,
     'un texte sans nom de composant ne désigne rien');
  ok(lessonRefs('').length === 0, 'et un texte vide non plus');
  drawScene(0);                                   // le halo se dessine sans erreur
  ok(av > 0, 'la mise en valeur survit au rendu');
  closeTutor();
  eq(lessonFocus, null, 'fermer la leçon éteint la mise en valeur');
});

T('T176 la dernière page consultée est retenue leçon par leçon', () => {
  const idx = missions.findIndex(m => m.id === 'm7');
  const id = missions[idx].id;
  delete (progress.step || {})[id];
  loadMission(idx);
  __fire('btn-tutor', 'click');
  __fire('tutor-skip', 'click');
  __fire('tutor-skip', 'click');
  eq(tutor.step, 2, 'on est page 3');
  ok(progress.step && progress.step[id], 'la position est mémorisée');
  eq(progress.step[id].n, 2, 'à la bonne page');
  loadMission(idx);                               // on quitte et on revient
  eq(tutor, null, 'changer de leçon referme le panneau');
  __fire('btn-tutor', 'click');
  eq(tutor.step, 2, 'la leçon reprend là où on l’avait laissée');
  // jamais sur la page « terminé » : il doit rester quelque chose à faire
  progress.step[id] = { m:'etapes', n: tutor.sol.steps.length };
  closeTutor(); __fire('btn-tutor', 'click');
  eq(tutor.step, 0, 'une position en fin de leçon repart du début');
  closeTutor();
  delete progress.step[id];
});

T('T177 la victoire enchaîne sur le « pourquoi », sur le schéma', () => {
  const idx = missions.findIndex(m => m.id === 'm2');   // ET
  loadMission(idx);
  const sol = buildSolution(missions[idx]);
  applySolution(sol, -1, {});
  __el('win-banner').classList.add('hidden');
  __fire('btn-verify', 'click');
  ok(!__el('win-banner').classList.contains('hidden'),
     'un bandeau, pas une modale : le schéma reste visible');
  eq(lessonMode, 'pourquoi', 'la leçon bascule sur l’explication');
  ok(tutor && tutor.pages.length, 'et elle a des pages à dérouler');
  ok(/POURQUOI 1 \/ /.test(__el('tutor-step').textContent), 'numérotées');
  const h = __el('tutor-txt').innerHTML;
  ok(h.length > 30, 'la première page a du contenu');
  __fire('tutor-skip', 'click');
  ok(__el('tutor-txt').innerHTML !== h, 'la page suivante est différente');
  ok(__el('tutor-place').classList.contains('hidden'), 'plus rien à poser');
  __fire('btn-stay', 'click');
  ok(__el('win-banner').classList.contains('hidden'), '« rester ici » range le bandeau');
  // le découpage du « pourquoi » ne perd pas de texte
  missions.slice(0, 40).forEach(m => {
    const pg = whyPages(m);
    ok(pg.length >= 1, m.id + ' : au moins une page de pourquoi');
  });
  closeTutor();
  loadMission(-1);
});

T('T178 la carte du cours : une tuile par chapitre, ses leçons en pastilles', () => {
  loadMission(-1);
  somFiltre = '';
  renderSommaire();
  const list = __el('som-list');
  const chs = chapitres();
  ok(chs.length >= 20, 'les 30 chapitres sont reconstitués (' + chs.length + ')');
  eq(chs.reduce((a, c) => a + c.lecons.length, 0), missions.length,
     'et toutes les leçons y sont, une seule fois');
  eq(list.children.length, chs.length, 'une tuile par chapitre, tout visible d’un coup');
  const t0 = list.children[0];
  ok(/som-tuile/.test(t0.className), 'ce sont bien des tuiles');
  // l'anneau porte le numéro du chapitre et la part réussie
  const tete = t0.children.find(c => /som-th/.test(c.className));
  ok(tete, 'la tuile a son en-tête');
  ok(/som-anneau/.test(tete.innerHTML), 'avec son anneau de progression');
  ok(/<text[^>]*>1<\/text>/.test(tete.innerHTML), 'le numéro du chapitre au centre');
  ok(/\d+ \/ \d+ réussies/.test(tete.innerHTML), 'et le compte des leçons réussies');
  eq(numChapitre('Chapitre 12 · Mémoire'), '12', 'le numéro se lit dans le nom');
  eq(nomChapitre('Chapitre 12 · Mémoire'), 'Mémoire', 'et le nom sans son numéro');
  // les pastilles : une par leçon, cliquables, numérotées
  const past = t0.children.find(c => /som-pastilles/.test(c.className));
  ok(past, 'la tuile a ses pastilles');
  eq(past.children.length, chs[0].lecons.length, 'une pastille par leçon du chapitre');
  eq(past.children[0].textContent, '1', 'numérotée par le rang de la leçon');
  past.children[1].dispatch('click');
  eq(currentIdx, 1, 'cliquer une pastille charge la leçon');
  ok(!__el('sommaire-modal').classList.contains('show'), 'et referme le sommaire');
  // l'état d'une leçon se lit dans la classe de sa pastille
  const m0 = missions[0];
  delete progress.done[m0.id];
  eq(classeEtat(m0), '', 'leçon jamais réussie : pastille neutre');
  progress.done[m0.id] = true; progress.best[m0.id] = 999;
  eq(classeEtat(m0), 'ok', 'leçon réussie : pastille verte');
  progress.best[m0.id] = m0.par;
  eq(classeEtat(m0), m0.par > 0 ? 'star' : 'ok', 'objectif atteint : pastille dorée');
  renderSommaire();
  ok(/som-p (ok|star)/.test(list.children[0].children[1].children[0].className),
     'et la pastille rendue porte bien cet état');
  // recherche : on repasse à des titres, pas des pastilles
  somFiltrer('multiplexeur');
  const trouve = list.children.filter(c => /som-l/.test(c.className));
  ok(trouve.length >= 1, 'la recherche trouve des leçons (' + trouve.length + ')');
  ok(trouve.length < missions.length, 'et elle filtre vraiment');
  ok(/som-t/.test(trouve[0].innerHTML), 'avec le titre de la leçon');
  ok(!list.children.some(c => /som-tuile/.test(c.className)), 'plus de tuiles pendant la recherche');
  trouve[0].dispatch('click');
  ok(currentIdx >= 0, 'un résultat se charge au clic');
  somFiltrer('zzzznexistepas');
  ok(list.children.some(c => /som-vide/.test(c.className)), 'sinon elle le dit');
  somFiltrer('');
  ok(list.children.every(c => /som-tuile/.test(c.className)), 'et les tuiles reviennent');
  // reprendre
  missions.forEach(m => { progress.done[m.id] = true; });
  eq(somReprendre(), 0, 'tout réussi : on repart du début');
  delete progress.done[missions[12].id];
  eq(somReprendre(), 12, 'sinon on reprend à la première leçon non réussie');
  missions.forEach(m => { delete progress.done[m.id]; delete progress.best[m.id]; });
  eq(somReprendre(), 0, 'rien de fait : la première leçon');
  __fire('btn-sommaire', 'click');
  ok(__el('sommaire-modal').classList.contains('show'), 'le bouton ouvre le sommaire');
  __fire('btn-close-sommaire', 'click');
  ok(!__el('sommaire-modal').classList.contains('show'), 'et le referme');
  loadMission(-1);
});


T('T179 le fil d’Ariane situe la leçon dans son chapitre', () => {
  loadMission(-1);
  eq(__el('mission-chapter').textContent, 'Mode libre', 'en sandbox : mode libre');
  ok(__el('mis-prev').disabled, 'et pas de leçon précédente');
  const idx = missions.findIndex((m, i) => i > 0 && m.ch === missions[i - 1].ch);
  loadMission(idx);
  const p = missionPos(idx);
  const num = (missions[idx].ch.match(/^Chapitre\s+(\d+)/i) || [, ''])[1];
  eq(__el('mission-chapter').textContent,
     missions[idx].ch.replace(/^Chapitre\s+\d+\s*·\s*/i, ''), 'le nom du chapitre est affiché');
  eq(__el('mission-pos').textContent, 'chap. ' + num + ' · leçon ' + p.n + ' / ' + p.total,
     'et le numéro de chapitre avec le rang de la leçon');
  ok(p.n >= 2 && p.total >= p.n, 'le rang est cohérent');
  ok(!__el('mis-prev').disabled && !__el('mis-next').disabled, 'les deux flèches servent');
  __fire('mis-next', 'click');
  eq(currentIdx, idx + 1, 'la flèche avance d’une leçon');
  __fire('mis-prev', 'click');
  eq(currentIdx, idx, 'et l’autre recule');
  loadMission(missions.length - 1);
  ok(__el('mis-next').disabled, 'pas de leçon après la dernière');
  loadMission(-1);
});

T('T180 la colonne de droite a bien disparu, sans rien perdre', () => {
  // ce qui doit avoir disparu du balisage
  ['mission-panel', 'panel-tab', 'mission-scroll'].forEach(id => {
    ok(!__HTML.includes('id="' + id + '"'), id + ' n’est plus dans le balisage');
    ok(!__HTML.includes("getElementById('" + id + "')"), id + ' n’est plus appelé');
  });
  // les quatre blocs qui la remplacent
  ['enonce', 'enonce-corps', 'enonce-tab', 'infos', 'infos-corps', 'infos-tab',
   'actions', 'tutor-box'].forEach(id =>
    ok(__HTML.includes('id="' + id + '"'), id + ' existe'));
  // et rien de son contenu n’a été perdu en route
  ['mission-chapter', 'mission-pos', 'mission-title', 'mission-desc', 'mission-badges',
   'truth-wrap', 'truth-table', 'live-box', 'stats-row', 'stat-gates', 'stat-wires',
   'stat-zoom', 'btn-tutor', 'btn-start', 'btn-verify', 'btn-solution', 'btn-reset',
   'mis-prev', 'mis-next', 'btn-sommaire'].forEach(id =>
    ok(__HTML.includes('id="' + id + '"'), id + ' a survécu au déménagement'));
  // les blocs flottants ne doivent plus dépendre de la colonne
  ok(/#enonce\{position:fixed/.test(__HTML), 'l’énoncé est un bandeau flottant');
  ok(/#infos\{position:fixed/.test(__HTML), 'la table est un bloc flottant');
  ok(/#actions\{position:fixed/.test(__HTML), 'les boutons flottent');
  ok(/#tutor-box\{position:fixed/.test(__HTML), 'la leçon est posée au-dessus du plan');
});

T('T181 l’énoncé et la table se replient chacun de leur côté', () => {
  loadMission(missions.findIndex(m => m.id === 'm7'));
  const en = __el('enonce'), inf = __el('infos');
  en.classList.remove('replie'); inf.classList.remove('replie');
  __fire('enonce-tab', 'click');
  ok(en.classList.contains('replie'), 'l’énoncé se replie');
  ok(!inf.classList.contains('replie'), 'sans entraîner la table');
  __fire('infos-tab', 'click');
  ok(inf.classList.contains('replie'), 'la table se replie de son côté');
  __fire('enonce-tab', 'click');
  ok(!en.classList.contains('replie'), 'et l’énoncé se déplie');
  __fire('infos-tab', 'click');
  ok(!inf.classList.contains('replie'), 'la table aussi');
  loadMission(-1);
});

T('T182 le bandeau de victoire ne laisse pas dépasser l’énoncé', () => {
  const idx = missions.findIndex(m => m.id === 'm2');
  loadMission(idx);
  const en = __el('enonce');
  ok(!en.classList.contains('masque'), 'au départ l’énoncé est visible');
  applySolution(buildSolution(missions[idx]), -1, {});
  __fire('btn-verify', 'click');
  ok(!__el('win-banner').classList.contains('hidden'), 'le bandeau s’affiche');
  ok(en.classList.contains('masque'), 'et l’énoncé s’efface sous lui');
  __fire('btn-stay', 'click');
  ok(!en.classList.contains('masque'), 'le ranger rend l’énoncé');
  // changer de leçon doit aussi tout remettre d’aplomb
  en.classList.add('masque');
  loadMission(idx);
  ok(!en.classList.contains('masque'), 'charger une leçon rend l’énoncé');
  ok(__el('win-banner').classList.contains('hidden'), 'et range le bandeau');
  closeTutor();
  loadMission(-1);
});

T('T183 le cartouche se pose à côté de ce dont la page parle', () => {
  const idx = missions.findIndex(m => m.id === 'm7');
  loadMission(idx);
  openTutor();
  ok(tutor, 'la leçon est ouverte');
  tutorAll();                                  // tout est posé : de vraies cibles
  tutor.step = 1; renderTutor();
  const z = zoneUtile();
  ok(z.w > 200 && z.h > 150, 'la zone libre est exploitable (' + Math.round(z.w) + '×' + Math.round(z.h) + ')');
  const r = placeLecon();
  ok(r, 'la carte est posée');
  ok(r.x >= z.x - .5 && r.y >= z.y - .5, 'elle ne déborde pas en haut à gauche');
  ok(r.x + r.w <= z.x + z.w + .5, 'ni à droite');
  ok(r.y + r.h <= z.y + z.h + .5, 'ni en bas — donc jamais sous la barre d’outils');
  // elle ne recouvre jamais ce qu’elle désigne
  const cibles = cibleLecon();
  ok(cibles && cibles.length, 'la page désigne bien quelque chose');
  const cible = bboxEcran(cibles);
  eq(recouvrement(r, cible), 0, 'elle ne recouvre pas sa propre cible');
  // et elle reste près : sinon le trait n’aurait aucun sens
  const d = Math.hypot(r.x + r.w/2 - (cible.x + cible.w/2), r.y + r.h/2 - (cible.y + cible.h/2));
  ok(d < 900, 'elle reste à portée de regard (' + Math.round(d) + ' px)');
  closeTutor();
});

T('T184 elle suit les pages, se laisse poser à la main, et se recolle', () => {
  loadMission(missions.findIndex(m => m.id === 'm7'));
  openTutor(); tutorAll();
  tutor.step = 0; renderTutor();
  const a = placeLecon();
  tutor.step = 2; renderTutor();
  const b = placeLecon();
  ok(a && b, 'les deux pages posent la carte');
  // posée à la main : la position demandée est respectée
  lessonPose = { x:120, y:300 };
  const c = placeLecon();
  near(c.x, 120, 1, 'la carte va où on la pose');
  near(c.y, 300, 1, 'en X comme en Y');
  // mais jamais hors de la zone utile
  const z = zoneUtile();
  lessonPose = { x:-800, y:-800 };
  const d = placeLecon();
  ok(d.x >= z.x - .5 && d.y >= z.y - .5, 'on ne peut pas la perdre hors de l’écran');
  lessonPose = { x:99999, y:99999 };
  const e = placeLecon();
  ok(e.x + e.w <= z.x + z.w + .5 && e.y + e.h <= z.y + z.h + .5, 'ni de l’autre côté');
  // se recoller rend le placement automatique
  lessonPose = null;
  const f = placeLecon();
  ok(f, 'elle se replace toute seule');
  closeTutor();
  eq(lessonPose, null, 'fermer la leçon oublie la position posée à la main');
  eq(lessonRect, null, 'et la carte n’occupe plus rien');
  eq(placeLecon(), null, 'leçon fermée : rien à poser');
  loadMission(-1);
});

T('T185 le halo épouse l’encombrement réel, rotation comprise', () => {
  // bw/bh et non w/h : sur un composant tourné d’un quart de tour, le halo
  // tombait de travers
  ok(/roundRect\(c\.x - 9, c\.y - 9, c\.bw \+ 18, c\.bh \+ 18/.test(__HTML),
     'le halo est tracé sur bw/bh');
  board();
  const c = mk('DEC', 200, 200);
  const w0 = c.bw, h0 = c.bh;
  c.rot = 1;
  eq(c.bw, h0, 'un quart de tour échange largeur et hauteur');
  eq(c.bh, w0, 'dans les deux sens');
  // le rectangle écran suit la rotation
  cam.x = 0; cam.y = 0; cam.z = 1;
  const r = bboxEcran([c]);
  near(r.w, h0, .5, 'le rectangle écran suit');
  near(r.h, w0, .5, 'lui aussi');
  // et le zoom
  cam.z = 2;
  const r2 = bboxEcran([c]);
  near(r2.w, h0 * 2, .5, 'le zoom double la largeur à l’écran');
  cam.z = 1;
});


console.log('\n— ⚡ Énergie & ondes : le continu —');

/* Petit atelier : une boucle pile → interrupteur → ampoule → masse → pile */
function boucle(opt){
  board();
  const p = mk('PILE', 0, 0), k = mk('INTERP', 200, 0),
        l = mk('LAMPE', 400, 0), g = mk('MASSE', 600, 0);
  if (opt && opt.e != null)  p.opt.e  = opt.e;
  if (opt && opt.ri != null) p.opt.ri = opt.ri;
  link(p, 0, k, 0);           // + → A de l'interrupteur
  link(k, 0, l, 0);           // B → A de l'ampoule
  link(l, 0, g, 0);           // B → retour R1 de la masse
  link(g, 0, p, 0);           // masse → − de la pile : la boucle est fermée
  k.state = 1;
  return { p, k, l, g };
}

T('T186 le troisième type de liaison : hexagonal, et il ne se mélange pas', () => {
  board();
  const p = mk('PILE', 0, 0), l = mk('LAMPE', 200, 0);
  const sw = mk('SWITCH', 0, 300), led = mk('LED', 200, 300);
  const tuy = mk('TUYAU', 0, 600);
  eq(p.outPins[0].kind, 'pui', 'le + de la pile est une borne de puissance');
  eq(p.inPins[0].kind, 'pui', 'le − aussi');
  eq(led.inPins[0].kind, 'log', 'le voyant reste un port logique');
  eq(tuy.inPins[0].kind, 'flu', 'le tuyau reste un raccord fluide');
  // les trois natures refusent de se marier
  connectWire(p.outPins[0], led.inPins[0]);
  eq(wires.length, 0, 'puissance → logique : refusé');
  connectWire(sw.outPins[0], l.inPins[0]);
  eq(wires.length, 0, 'logique → puissance : refusé');
  connectWire(tuy.outPins[0], l.inPins[0]);
  eq(wires.length, 0, 'fluide → puissance : refusé');
  connectWire(p.outPins[0], l.inPins[0]);
  eq(wires.length, 1, 'puissance → puissance : accepté');
  // une borne à vis accepte plusieurs fils, une entrée logique non
  const l2 = mk('LAMPE', 400, 0), g = mk('MASSE', 600, 0);
  connectWire(l.outPins[0], g.inPins[0]);
  connectWire(l2.outPins[0], g.inPins[0]);
  eq(wires.filter(w => w.inPin === g.inPins[0]).length, 2,
     'deux retours sur la même borne de masse');
  connectWire(l.outPins[0], g.inPins[0]);
  eq(wires.filter(w => w.inPin === g.inPins[0]).length, 2, 'mais pas deux fois le même fil');
});

T('T187 la boucle : fermée ça s’allume, ouverte il ne se passe rien', () => {
  const b = boucle();
  sim();
  ok(b.l.i > 0.2, 'le courant traverse l’ampoule : ' + b.l.i);
  ok(b.l.u > 3, 'et elle reçoit sa tension : ' + b.l.u);
  ok(b.l.p > 0.8, 'elle éclaire : ' + b.l.p + ' W');
  // on ouvre l'interrupteur : plus rien, nulle part
  b.k.state = 0; sim();
  near(b.l.i, 0, 1e-3, 'plus de courant');
  near(b.l.p, 0, 1e-3, 'plus de lumière');
  near(b.p.i, 0, 1e-3, 'la pile ne débite plus');
  // à vide, la pile affiche bien sa tension à vide
  near(Math.abs(b.p.u), 4.5, .05, 'et elle retrouve ses 4,5 V à vide');
});

T('T188 c’est la BOUCLE qui compte, pas la masse', () => {
  const b = boucle();
  sim();
  ok(b.l.p > 0.8, 'au départ elle éclaire');
  // on coupe le seul fil qui ramène le courant au − de la pile
  wires = wires.filter(w => !(w.outPin.comp === b.g && w.inPin.comp === b.p));
  sim();
  near(b.l.i, 0, 1e-3, 'la boucle est rompue : plus rien ne circule');
  near(b.l.p, 0, 1e-3, 'et l’ampoule s’éteint');
  // en revanche une boucle fermée SANS masse marche très bien : une lampe de
  // poche n’a pas de fil de terre. La masse ne sert qu’à fixer le zéro.
  board();
  const p = mk('PILE', 0, 0), l = mk('LAMPE', 200, 0);
  p.opt.ri = 0.01;
  link(p, 0, l, 0); link(l, 0, p, 0);
  sim();
  ok(!elecMasse, 'aucune masse posée');
  ok(l.p > 0.8, 'et pourtant l’ampoule éclaire : ' + l.p + ' W');
  near(l.u, 4.5, .05, 'elle reçoit toute la tension');
  // faute de masse, le zéro est pris sur le − de la pile : les tensions
  // affichées restent lisibles (4,5 V d’un côté, 0 V au retour)
  near(p.outPins[0].state, 4.5, .05, 'le + est à 4,5 V');
  near(p.inPins[0].state, 0, 1e-3, 'le − est le zéro');
  // une masse abandonnée dans un coin, reliée à rien, ne change rien
  const g = mk('MASSE', 0, 400);
  sim();
  ok(elecMasse, 'la masse est bien détectée');
  ok(l.p > 0.8, 'le circuit marche toujours');
  near(p.outPins[0].state, 4.5, .05, 'et les tensions ne se sont pas mises à flotter');
  near(g.inPins[0].state, 0, 1e-3, 'la masse esseulée reste à 0 V');
});

T('T189 la loi d’Ohm se constate : U = R × I, et la puissance suit', () => {
  const b = boucle({ e:4.5, ri:0.01 });   // pile quasi parfaite : le calcul est lisible
  sim();
  const R = 4.5 * 4.5 / 1.4;              // résistance déduite du nominal de l’ampoule
  near(b.l.u / b.l.i, R, R * .02, 'la tension divisée par le courant redonne la résistance');
  near(b.l.i, 4.5 / R, .02, 'et le courant vaut U ÷ R');
  near(b.l.p, b.l.u * b.l.i, .01, 'la puissance est bien le produit des deux');
  // le courant est le même partout dans une boucle sans dérivation
  near(Math.abs(b.p.i), b.l.i, .01, 'la pile débite exactement ce que l’ampoule consomme');
});

T('T190 la pile faiblit quand on tire dessus, et ça se voit', () => {
  const b = boucle({ e:4.5, ri:1 });
  sim();
  const seule = Math.abs(b.p.u), eclatSeule = b.l.p;
  ok(seule < 4.5, 'en charge, la tension aux bornes est déjà sous les 4,5 V : ' + seule);
  ok(seule > 3.5, 'mais elle tient : ' + seule);
  // une deuxième ampoule en parallèle : deux fois plus de courant demandé
  const l2 = mk('LAMPE', 400, 200);
  link(b.k, 0, l2, 0);
  link(l2, 0, b.g, 0);            // même borne de retour : c'est une barre
  sim();
  const deux = Math.abs(b.p.u);
  ok(deux < seule - .1, 'avec deux ampoules la pile s’affaisse : ' + deux + ' < ' + seule);
  ok(b.l.p < eclatSeule - .05, 'et la première éclaire moins qu’avant');
  near(b.l.p, l2.p, .02, 'les deux ampoules éclairent pareil : elles ont la même tension');
  ok(Math.abs(b.p.i) > 1.9 * b.l.i - .05, 'la pile débite la somme des deux courants');
  // et la baisse ne s'arrête pas à la deuxième : chaque ampoule ajoutée retire
  // encore ~10 % de puissance à toutes les autres.
  const suite = [b.l.p];
  for (let n = 3; n <= 6; n++){
    const ln = mk('LAMPE', 400, 200 * n);
    link(b.k, 0, ln, 0); link(ln, 0, b.g, 0);
    sim();
    suite.push(b.l.p);
  }
  for (let i = 1; i < suite.length; i++)
    ok(suite[i] < suite[i-1] * .95,
       'ampoule ' + (i + 2) + ' : la puissance baisse encore (' +
       suite[i-1].toFixed(3) + ' → ' + suite[i].toFixed(3) + ' W)');
  ok(suite[suite.length-1] < suite[0] * .7,
     'de 2 à 6 ampoules, chacune perd plus de 30 % de sa puissance');
});

T('T191 en série on partage la tension, en parallèle on partage le courant', () => {
  // deux ampoules en série sur une pile quasi parfaite
  board();
  const p = mk('PILE', 0, 0), a = mk('LAMPE', 200, 0), b2 = mk('LAMPE', 400, 0), g = mk('MASSE', 600, 0);
  p.opt.ri = 0.01;
  link(p, 0, a, 0); link(a, 0, b2, 0); link(b2, 0, g, 0); link(g, 0, p, 0);
  sim();
  near(a.u, b2.u, .02, 'deux ampoules identiques en série se partagent la tension');
  near(a.u + b2.u, 4.5, .05, 'et la somme des chutes vaut la tension de la pile');
  near(a.i, b2.i, .01, 'le courant est le même dans les deux');
  const serie = a.p;
  // les mêmes en parallèle
  board();
  const p2 = mk('PILE', 0, 0), c1 = mk('LAMPE', 200, 0), c2 = mk('LAMPE', 200, 200), g2 = mk('MASSE', 600, 0);
  p2.opt.ri = 0.01;
  link(p2, 0, c1, 0); link(p2, 0, c2, 0);
  link(c1, 0, g2, 0); link(c2, 0, g2, 0); link(g2, 0, p2, 0);   // même borne : c'est une barre
  sim();
  near(c1.u, 4.5, .05, 'en parallèle, chacune reçoit la tension entière');
  ok(c1.p > serie * 3, 'donc elles éclairent bien plus fort qu’en série');
  near(Math.abs(p2.i), c1.i + c2.i, .02, 'et la pile fournit la somme des deux courants');
});

T('T192 le solveur ne coûte rien quand aucun circuit électrique n’est posé', () => {
  board();
  const s1 = mk('SWITCH', 0, 0), a = mk('AND', 200, 0), led = mk('LED', 400, 0);
  link(s1, 0, a, 0); link(s1, 0, a, 1); link(a, 0, led, 0);
  s1.state = 1; sim();
  ok(!elecOn, 'le solveur se sait inutile');
  eq(led.inPins[0].state, 1, 'et la logique fonctionne comme avant');
  // les deux domaines cohabitent sur le même plan sans se gêner
  const b = boucle();
  const s2 = mk('SWITCH', 0, 400), l2 = mk('LED', 200, 400);
  link(s2, 0, l2, 0); s2.state = 1;
  sim();
  ok(elecOn, 'avec de la puissance sur le plan, le solveur travaille');
  eq(l2.inPins[0].state, 1, 'la logique marche toujours à côté');
  ok(b.l.p > 0.8, 'et l’ampoule éclaire toujours');
});

T('T192b les fils de puissance vont droit, et ne dérivent pas', () => {
  board();
  // deux composants d'énergie posés à la même hauteur : leurs bornes sont
  // exactement en face, quelles que soient leurs tailles de boîtier.
  const p = mk('PILE', 0, 100), k = mk('INTERP', 300, 100), l = mk('LAMPE', 600, 100);
  eq(p.outPins[0].y, k.inPins[0].y, 'la sortie de la pile et l’entrée de l’interrupteur sont à la même hauteur');
  eq(k.outPins[0].y, l.inPins[0].y, 'idem entre l’interrupteur et l’ampoule');
  const w = link(p, 0, k, 0);
  const R = w.route();
  const memeY = R.every(pt => Math.abs(pt.y - R[0].y) < .01);
  ok(memeY, 'le tracé ne fait aucun décrochement : ' + JSON.stringify(R.map(q => Math.round(q.y))));
  // l'écartement des couloirs ne doit pas se cumuler d'une image à l'autre
  const l2 = mk('LAMPE', 600, 400);
  link(k, 0, l, 0); link(k, 0, l2, 0);
  spreadRoutes();
  const t1 = wires.map(x => x._rp.map(q => [Math.round(q.x*100), Math.round(q.y*100)]));
  spreadRoutes(); spreadRoutes(); spreadRoutes();
  const t2 = wires.map(x => x._rp.map(q => [Math.round(q.x*100), Math.round(q.y*100)]));
  deq(t2, t1, 'trois images de plus ne déplacent pas les fils d’un pixel');
});

T('T193 l’atelier ⚡ est complet : composants, guide, sauvegarde', () => {
  // les quatre composants sont bien rangés dans l'onglet du continu
  const onglet = TOOL_TABS.find(t => t.key === 'ener');
  ok(onglet, 'l’onglet du continu existe');
  ['PILE','INTERP','LAMPE','MASSE'].forEach(t =>
    ok(onglet.items.includes(t), t + ' est dans l’onglet'));
  // l'état d'un interrupteur de puissance survit à une sauvegarde
  const b = boucle();
  sim();
  const data = serializeGroup(components);
  board();
  spawnGroup(data, 0, 0, false);
  const k = components.find(c => c.type === 'INTERP');
  const l = components.find(c => c.type === 'LAMPE');
  eq(k.state, 1, 'l’interrupteur est retrouvé fermé');
  sim();
  ok(l.p > 0.8, 'et le circuit rechargé éclaire toujours');
  // le menu de câblage rapide propose bien de la puissance, pas de la logique
  const sugg = quickTypes(components.find(c => c.type === 'PILE').outPins[0]);
  ok(sugg.includes('LAMPE') || sugg.includes('INTERP'), 'suggestions de puissance');
  ok(!sugg.includes('AND'), 'et pas de porte logique au bout d’un fil de puissance');
});


console.log('\n— ⚡ Lot 2 : mesurer, régler, regarder —');

/* Un banc : générateur → ampèremètre → ce qu'on veut → masse → générateur */
function banc(u, ilim){
  board();
  const g = mk('GENE', 0, 0), a = mk('AMP', 200, 0), m = mk('MASSE', 800, 0);
  g.opt.u = u == null ? 6 : u;
  g.opt.ri = 0.01;
  g.opt.ilim = ilim == null ? 5 : ilim;
  link(g, 0, a, 0);
  link(m, 0, g, 0);
  return { g, a, m };
}

T('T194 la loi d’Ohm, mesurée par les instruments', () => {
  const b = banc(6);
  const r = mk('RESIS', 450, 0); r.opt.r = 47;
  const v = mk('VOLT', 450, 250);
  link(b.a, 0, r, 0);
  link(r, 0, b.m, 0);
  link(b.a, 0, v, 0);            // le voltmètre EN TRAVERS de la résistance
  link(r, 0, v, 1);
  sim();
  near(v.u, 6, .05, 'le voltmètre lit la tension aux bornes');
  near(b.a.i, 6 / 47, .002, 'l’ampèremètre lit 128 mA');
  near(v.u / b.a.i, 47, 1, 'U ÷ I redonne bien la résistance');
  // on double la tension : le courant double
  b.g.opt.u = 12; sim();
  near(b.a.i, 12 / 47, .002, 'tension doublée, courant doublé');
  // on divise la résistance par deux : il double encore
  r.opt.r = 23.5; sim();
  near(b.a.i, 12 / 23.5, .004, 'résistance divisée par deux, courant doublé');
  // les mesures sortent aussi sur un bus, à l'échelle
  ok(v.outPins[0].state > 0 && v.outPins[0].state <= 255, 'le voltmètre publie sa mesure');
  ok(b.a.outPins[1].state > 0, 'l’ampèremètre aussi');
});

T('T195 en série les tensions s’ajoutent, en parallèle les courants', () => {
  // deux résistances égales en série : chacune prend la moitié
  const b = banc(12);
  const r1 = mk('RESIS', 400, 0), r2 = mk('RESIS', 600, 0);
  r1.opt.r = 100; r2.opt.r = 100;
  link(b.a, 0, r1, 0); link(r1, 0, r2, 0); link(r2, 0, b.m, 0);
  sim();
  near(r1.u, 6, .05, 'la première prend la moitié');
  near(r2.u, 6, .05, 'la seconde aussi');
  near(r1.u + r2.u, 12, .05, 'et les deux chutes font la tension totale');
  near(r1.i, r2.i, .001, 'le courant est le même dans les deux');
  near(r1.i, 12 / 200, .002, 'soit U ÷ (R1+R2)');
  // les mêmes en parallèle
  board();
  const g = mk('GENE', 0, 0), a = mk('AMP', 200, 0), m = mk('MASSE', 800, 0);
  g.opt.u = 12; g.opt.ri = .01; g.opt.ilim = 5;
  const p1 = mk('RESIS', 400, 0), p2 = mk('RESIS', 400, 200);
  p1.opt.r = 100; p2.opt.r = 100;
  link(g, 0, a, 0); link(a, 0, p1, 0); link(a, 0, p2, 0);
  link(p1, 0, m, 0); link(p2, 0, m, 0); link(m, 0, g, 0);
  sim();
  near(p1.u, 12, .05, 'en parallèle chacune reçoit toute la tension');
  near(a.i, p1.i + p2.i, .002, 'et le courant total est la somme des deux');
  near(a.i, 2 * 12 / 100, .005, 'soit deux fois plus qu’avec une seule');
});

T('T196 le potentiomètre partage la tension selon son curseur', () => {
  const b = banc(10);
  const p = mk('POTP', 400, 0), r = mk('RESIS', 650, 0);
  p.opt.rt = 100; p.opt.pos = 30;
  r.opt.r = 100000;                     // charge très faible : diviseur à vide
  link(b.a, 0, p, 0);                   // A du potentiomètre
  link(p, 1, b.m, 0);                   // B à la masse
  link(p, 0, r, 0);                     // curseur vers la charge
  link(r, 0, b.m, 0);
  sim();
  near(p.outPins[0].state, 3, .1, 'curseur à 30 % → 30 % de la tension');
  p.opt.pos = 75; sim();
  near(p.outPins[0].state, 7.5, .1, 'curseur à 75 % → 7,5 V');
  p.opt.pos = 0; sim();
  near(p.outPins[0].state, 0, .1, 'curseur en bas → 0 V');
  p.opt.pos = 100; sim();
  near(p.outPins[0].state, 10, .1, 'curseur en haut → toute la tension');
  // la résistance totale ne change pas, elle : le courant reste le même
  const i0 = Math.abs(b.g.i);
  p.opt.pos = 50; sim();
  near(Math.abs(b.g.i), i0, .01, 'la résistance totale ne dépend pas du curseur');
});

T('T197 le générateur limite son courant au lieu de subir un court-circuit', () => {
  const b = banc(6, 0.5);
  const r = mk('RESIS', 450, 0); r.opt.r = 1;    // presque un court-circuit
  link(b.a, 0, r, 0); link(r, 0, b.m, 0);
  sim();
  eq(b.g.limite, 1, 'elle passe en limitation');
  near(Math.abs(b.g.i), 0.5, .02, 'et tient exactement sa limite');
  ok(Math.abs(b.g.u) < 1, 'elle a lâché la tension : ' + Math.abs(b.g.u) + ' V');
  // on relâche la demande : elle reprend sa tension
  r.opt.r = 100; sim();
  eq(b.g.limite, 0, 'de retour en mode tension');
  near(Math.abs(b.g.u), 6, .05, 'elle tient de nouveau sa consigne');
  near(Math.abs(b.g.i), 6 / 100, .003, 'et le courant redevient celui de la charge');
  // la limite se règle
  b.g.opt.ilim = 0.02; sim();
  eq(b.g.limite, 1, 'une limite plus basse la fait basculer à nouveau');
  near(Math.abs(b.g.i), 0.02, .002, 'au nouveau seuil');
});

T('T198 le court-circuit est signalé, franc ou non', () => {
  // une pile qui débite dans presque rien : sa tension s’effondre
  board();
  const p = mk('PILE', 0, 0), r = mk('RESIS', 300, 0), m = mk('MASSE', 600, 0);
  p.opt.e = 4.5; p.opt.ri = 1; r.opt.r = 0.1;
  link(p, 0, r, 0); link(r, 0, m, 0); link(m, 0, p, 0);
  sim();
  eq(p.court, 1, 'la pile signale le court-circuit');
  ok(Math.abs(p.u) < 4.5 * .25, 'sa tension est effondrée : ' + Math.abs(p.u) + ' V');
  ok(Math.abs(p.i) > 4, 'et elle débite énormément : ' + Math.abs(p.i) + ' A');
  // un court-circuit FRANC : le + et le − sur le même point
  board();
  const p2 = mk('PILE', 0, 0), m2 = mk('MASSE', 400, 0);
  link(p2, 0, m2, 0); link(m2, 0, p2, 0);
  sim();
  eq(p2.court, 1, 'les deux bornes sur le même point : signalé aussi');
  // et un montage sain ne crie pas au loup
  board();
  const p3 = mk('PILE', 0, 0), l = mk('LAMPE', 300, 0), m3 = mk('MASSE', 600, 0);
  link(p3, 0, l, 0); link(l, 0, m3, 0); link(m3, 0, p3, 0);
  sim();
  eq(p3.court || 0, 0, 'une ampoule normale n’est pas un court-circuit');
});

T('T199 les instruments ne perturbent pas ce qu’ils mesurent', () => {
  // sans ampèremètre
  board();
  const g = mk('GENE', 0, 0), r = mk('RESIS', 400, 0), m = mk('MASSE', 700, 0);
  g.opt.u = 6; g.opt.ri = .01; g.opt.ilim = 5; r.opt.r = 47;
  link(g, 0, r, 0); link(r, 0, m, 0); link(m, 0, g, 0);
  sim();
  const sans = r.i;
  // avec l'ampèremètre inséré, et un voltmètre en travers
  const b = banc(6);
  const r2 = mk('RESIS', 450, 0); r2.opt.r = 47;
  const v = mk('VOLT', 450, 250);
  link(b.a, 0, r2, 0); link(r2, 0, b.m, 0);
  link(b.a, 0, v, 0); link(r2, 0, v, 1);
  sim();
  near(r2.i, sans, sans * .002, 'les instruments changent le courant de moins de 0,2 %');
  ok(Math.abs(v.i) < 1e-4, 'le voltmètre ne prélève presque rien : ' + v.i + ' A');
  ok(Math.abs(b.a.u) < 1e-3, 'l’ampèremètre ne fait presque aucune chute : ' + b.a.u + ' V');
});

T('T200 l’oscilloscope suit le temps, pas les images', () => {
  const b = banc(6);
  const r = mk('RESIS', 450, 0); r.opt.r = 47;
  const o = mk('OSCILLO', 450, 300);
  link(b.a, 0, r, 0); link(r, 0, b.m, 0);
  link(b.a, 0, o, 0);              // sonde V1 sur la résistance
  link(b.a, 1, o, 2);              // la mesure de l’ampèremètre sur l’entrée MES
  o.opt.win = 5;
  o.buf = []; o.tps = 0;
  for (let k = 0; k < 6; k++){ __advance(100); sim(); }
  ok(o.buf.length >= 5, 'il a échantillonné : ' + o.buf.length + ' points');
  near(o.tps, 0.5, .12, 'et le temps compté est une vraie durée (0,5 s)');
  near(o.buf[o.buf.length - 1].a, 6, .05, 'la sonde V1 lit la tension du circuit');
  ok(o.mes != null && Math.abs(o.mes - 6 / 47) < .01,
     'l’entrée de mesure rend le courant en ampères : ' + o.mes);
  // la fenêtre glisse : les vieux points sortent
  o.opt.win = 1;
  for (let k = 0; k < 12; k++){ __advance(100); sim(); }
  const t1 = o.tps;
  ok(o.buf.every(p => p.t >= t1 - 1.3), 'rien de plus vieux que la fenêtre ne reste');
  // en vérification de mission, il ne doit rien enregistrer
  const n0 = o.buf.length;
  simulating = true; __advance(100); sim(); simulating = false;
  eq(o.buf.length, n0, 'la vérification d’une mission ne pollue pas la trace');
});

T('T201 les sept composants du lot 2 sont rangés et câblables', () => {
  const onglet = TOOL_TABS.find(t => t.key === 'ener');
  const tous = TOOL_TABS.reduce((a, t) => a.concat(t.items), []);
  ['RESIS','POTP','VOLT','AMP','GENE','OSCILLO'].forEach(t =>
    ok(tous.includes(t), t + ' est dans la barre d’outils'));
  // l’ancien potentiomètre de mesure n’a pas été écrasé
  eq(REG.POT.family, 'sense', 'le potentiomètre de mesure du Process est intact');
  eq(REG.POTP.family, 'ener', 'celui de puissance est un autre composant');
  // le menu de câblage rapide propose de la puissance au bout d’un fil de puissance
  board();
  const g = mk('GENE', 0, 0);
  const sugg = quickTypes(g.outPins[0]);
  ok(sugg.includes('RESIS') || sugg.includes('AMP'), 'suggestions de puissance');
  ok(!sugg.includes('AND'), 'pas de porte logique');
  // et les bornes de mesure restent logiques, donc incompatibles
  const a = mk('AMP', 300, 0), led = mk('LED', 600, 0);
  eq(a.outPins[1].kind, 'log', 'la sortie MES est un port de signal');
  wires = [];
  connectWire(a.outPins[1], led.inPins[0]);
  eq(wires.length, 1, 'elle se branche sur un composant logique');
  wires = [];
  connectWire(a.outPins[1], mk('RESIS', 900, 0).inPins[0]);
  eq(wires.length, 0, 'mais pas sur une borne de puissance');
});


T('T202 le rail de puissance : une barre, un seul point', () => {
  board();
  const g = mk('GENE', 0, 0), r = mk('RAILP8', 300, 0), m = mk('MASSE', 300, 400);
  g.opt.u = 12; g.opt.ri = .01; g.opt.ilim = 5;
  const l1 = mk('LAMPE', 600, 0), l2 = mk('LAMPE', 600, 200), l3 = mk('LAMPE', 600, 400);
  link(g, 0, r, 0);                     // on alimente la barre UNE fois
  [l1, l2, l3].forEach((l, k) => { link(r, k + 1, l, 0); link(l, 0, m, 0); });
  link(m, 0, g, 0);
  sim();
  near(r.outPins[0].state, 12, .1, 'toute la barre est à 12 V');
  near(r.outPins[5].state, 12, .1, 'y compris une borne où rien n’est branché');
  near(r.inPins[3].state, 12, .1, 'dessus comme dessous');
  ok(l1.p > .5 && l2.p > .5 && l3.p > .5, 'les trois ampoules sont alimentées');
  near(l1.p, l2.p, .01, 'et toutes pareil');
  near(Math.abs(g.i), l1.i + l2.i + l3.i, .01, 'le générateur fournit la somme');
  // une barre sans alimentation reste à zéro
  const r2 = mk('RAILP4', 900, 600);
  sim();
  near(r2.outPins[0].state, 0, 1e-3, 'une barre non alimentée reste à 0 V');
});

T('T203 le tunnel de puissance : deux tunnels de même nom sont le même point', () => {
  board();
  const g = mk('GENE', 0, 0), m = mk('MASSE', 0, 500);
  g.opt.u = 9; g.opt.ri = .01; g.opt.ilim = 5;
  const t1 = mk('TUNP', 250, 0), t2 = mk('TUNP', 700, 200);
  const r = mk('RESIS', 950, 200);
  t1.opt.nom = '+'; t2.opt.nom = '+'; r.opt.r = 90;
  link(g, 0, t1, 0);                    // l’alimentation entre dans le premier
  link(t2, 0, r, 0);                    // et ressort du second, sans aucun fil entre eux
  link(r, 0, m, 0); link(m, 0, g, 0);
  sim();
  near(t2.outPins[0].state, 9, .1, 'le second tunnel est à la tension du premier');
  near(r.u, 9, .1, 'la résistance est bien alimentée');
  near(r.i, 9 / 90, .003, 'et le courant est celui de la loi d’Ohm');
  // un nom différent coupe la liaison
  t2.opt.nom = 'X'; sim();
  near(r.i, 0, 1e-3, 'nom différent : plus rien ne passe');
  t2.opt.nom = '+'; sim();
  near(r.i, 9 / 90, .003, 'et ça repart quand les noms se retrouvent');
  // trois tunnels de même nom : toujours un seul point
  const t3 = mk('TUNP', 700, 600); t3.opt.nom = '+';
  const l = mk('LAMPE', 950, 600);
  link(t3, 0, l, 0); link(l, 0, m, 0);
  sim();
  near(t3.outPins[0].state, Math.abs(g.u), .15, 'le troisième aussi');
  ok(l.p > .5, 'et l’ampoule qu’il alimente éclaire');
});

T('T204 rails et tunnels de puissance ne se mélangent pas avec ceux du signal', () => {
  board();
  const rp = mk('RAILP8', 0, 0), rl = mk('RAIL8', 0, 300);
  eq(rp.outPins[0].kind, 'pui', 'le rail de puissance a des bornes de puissance');
  eq(rl.outPins[0].kind, 'log', 'le rail de signal garde les siennes');
  wires = [];
  connectWire(rp.outPins[0], rl.inPins[0]);
  eq(wires.length, 0, 'on ne relie pas l’un à l’autre');
  const tp = mk('TUNP', 400, 0), tl = mk('TUNNEL', 400, 300);
  tp.opt.nom = 'A'; tl.opt.nom = 'A';
  const l = mk('LAMPE', 800, 0), g = mk('GENE', 800, 300), m = mk('MASSE', 800, 600);
  g.opt.u = 6; g.opt.ri = .01;
  link(g, 0, tp, 0);
  connectWire(tl.outPins[0], l.inPins[0]);        // le vrai contrôle de câblage
  eq(wires.filter(w => w.inPin.comp === l).length, 0,
     'un tunnel de signal ne peut pas alimenter une ampoule de puissance');
  // et les deux familles de tunnels ne partagent pas leurs noms
  const tp2 = mk('TUNP', 400, 600); tp2.opt.nom = 'A';
  link(tp2, 0, l, 0); link(l, 0, m, 0); link(m, 0, g, 0);
  sim();
  ok(l.p > .2, 'entre tunnels de puissance de même nom, en revanche, ça passe');
});


console.log('\n— ⚡ Lot 3 : le chapitre du continu —');

/* Pose le montage de référence d'une leçon et le simule */
function poseDemo(id){
  const idx = missions.findIndex(m => m.id === id);
  loadMission(idx);
  delete progress.done[id];
  const lay = missionDemo(missions[idx]);
  const r = spawnGroup(lay, 0, 0, false);
  sim();
  return { idx, m:missions[idx], made:r.made };
}

T('T205 les chapitres ⚡ : à la fin du cours, et dans leur atelier', () => {
  const lec = missions.filter(m => m.dom === 'phys');
  eq(missions.filter(m => /Chapitre 31/.test(m.ch)).length, 10, 'dix leçons au chapitre 31');
  eq(missions.filter(m => /Chapitre 32/.test(m.ch)).length, 8, 'huit au chapitre 32');
  eq(missions.filter(m => /Chapitre 33/.test(m.ch)).length, 8, 'huit au chapitre 33');
  eq(missions.filter(m => /Chapitre 34/.test(m.ch)).length, 4, 'quatre au chapitre 34');
  eq(missions.filter(m => /Chapitre 35/.test(m.ch)).length, 4, 'quatre au chapitre 35');
  eq(missions.filter(m => /Chapitre 36/.test(m.ch)).length, 6, 'six au chapitre 36');
  eq(lec.length, 40, 'quarante leçons dans l’atelier ⚡ en tout');
  // toutes à la fin du catalogue, et groupées
  const prem = missions.findIndex(m => m.dom === 'phys');
  eq(prem + lec.length, missions.length, 'elles occupent la fin du catalogue');
  for (let k = prem; k < missions.length; k++)
    eq(missions[k].dom, 'phys', 'aucune leçon étrangère au milieu');
  lec.forEach(m => {
    eq(m.tt.length, 0, m.id + ' : pas de table de vérité');
    ok(typeof m.check === 'function', m.id + ' : a une vraie condition de réussite');
    ok(m.sol.demo, m.id + ' : a un montage de référence');
  });
  // les chapitres apparaissent dans la carte du cours, l’un après l’autre
  const noms = chapitres().map(c => c.ch || c.nom || c.name || '');
  ['31','32','33','34','35','36'].forEach((n, i) =>
    ok(new RegExp('Chapitre ' + n).test(noms[noms.length - 6 + i]),
       'le chapitre ' + n + ' est à sa place dans la carte du cours'));
  // et charger une leçon bascule dans l’atelier ⚡
  setAppMode('elec');
  loadMission(prem);
  eq(appMode, 'phys', 'la leçon emmène dans son atelier');
  loadMission(-1); setAppMode('elec');
});

T('T206 la condition de réussite regarde le circuit, pas le clic', () => {
  // montage incomplet : refusé
  const idx = missions.findIndex(m => m.id === 'm149');
  loadMission(idx);
  delete progress.done['m149'];
  const p = mk('PILE', 0, 0), l = mk('LAMPE', 300, 0), g = mk('MASSE', 600, 0);
  link(p, 0, l, 0); link(l, 0, g, 0);            // il manque le retour au −
  sim();
  __fire('btn-verify', 'click');
  ok(!progress.done['m149'], 'boucle ouverte : refusé, malgré le clic');
  ok(typeof missions[idx].check() === 'string', 'et la leçon dit ce qui manque');
  // on referme la boucle : accepté
  link(g, 0, p, 0);
  sim();
  eq(missions[idx].check(), true, 'boucle fermée : la condition est remplie');
  __fire('btn-verify', 'click');
  ok(progress.done['m149'], 'mission validée');
  loadMission(-1);
});

/* Joue le montage : certaines leçons demandent un GESTE (promener l'aimant,
   tourner la manivelle) ou simplement du temps (monter en pression). Un
   montage de référence n'est bon que s'il est réellement jouable. */
function joueMontage(tours){
  /* 90 tours de 60 ms = 5,4 s de temps de circuit. Il en faut autant depuis
     le chapitre 36 : un message en Morse à 10 mots par minute met quatre
     secondes à partir, et le décodeur ne peut rien affirmer avant. */
  const n = tours || 90;
  /* On MANŒUVRE le montage, on ne le regarde pas seulement tourner : un
     interrupteur qu'on n'ouvre jamais n'apprend rien, et c'est l'ouverture
     qui décharge un condensateur. On rouvre puis on referme, et on laisse
     l'installation dans l'état où on l'a trouvée. */
  const inters = components.filter(c => c.type === 'INTERP' && c.state);
  for (let k = 0; k < n; k++){
    const ouvert = k >= Math.floor(n * .4) && k < Math.floor(n * .75);
    inters.forEach(s => { s.state = ouvert ? 0 : 1; });
    components.filter(c => c.type === 'AIMANT').forEach(a => {
      const b = components.find(c => c.type === 'BOBINE');
      if (!b) return;
      const cx = b.x + b.bw / 2 - a.bw / 2;
      a.x = cx + Math.sin(k * .5) * 220;              // des allers-retours francs
    });
    components.filter(c => c.type === 'DYNAMO').forEach(d =>
      manivelleVers(d, d.x + d.bw / 2 + Math.cos(k * .12) * 50,
                       d.y + 112 + Math.sin(k * .12) * 50));
    __advance(60); sim();
  }
}

T('T207 chaque leçon ⚡ est réussie par son propre montage', () => {
  const rates = [];
  missions.filter(m => m.dom === 'phys').forEach(m => {
    poseDemo(m.id);
    joueMontage();
    const r = m.check(components, wires);
    if (r !== true) rates.push(m.id + ' « ' + m.title +' » → ' + r);
  });
  loadMission(-1);
  ok(!rates.length, 'montages de référence qui ne passent pas leur propre test —\n      ' +
     rates.join('\n      '));
});

T('T208 le fusible fond, coupe, et se remplace', () => {
  board();
  const g = mk('GENE', 0, 0), f = mk('FUSIBLE', 300, 0), l = mk('LAMPE', 600, 0), m = mk('MASSE', 900, 0);
  g.opt.u = 6; g.opt.ri = .05; g.opt.ilim = 5; f.opt.cal = 2;
  link(g, 0, f, 0); link(f, 0, l, 0); link(l, 0, m, 0); link(m, 0, g, 0);
  sim();
  eq(f.grille, 0, 'calibre large : il tient');
  ok(l.p > .5, 'et l’ampoule éclaire');
  const passe = Math.abs(f.i);
  // un calibre sous le courant réel : il fond
  f.opt.cal = passe / 2;
  sim();
  eq(f.grille, 1, 'calibre trop petit : il fond');
  sim();
  near(l.i, 0, 1e-3, 'et il COUPE — plus rien ne circule');
  near(l.p, 0, 1e-3, 'l’ampoule est éteinte');
  // on le remplace sans rien corriger : il refond
  clickComp(f, f.x + f.w / 2, f.y + 40);
  eq(f.grille, 0, 'le clic le remplace');
  sim();
  eq(f.grille, 1, 'mais la cause est toujours là : il refond');
  // on corrige, puis on remplace
  f.opt.cal = passe * 1.5;
  clickComp(f, f.x + f.w / 2, f.y + 40);
  sim();
  eq(f.grille, 0, 'calibre corrigé : il tient');
  ok(l.p > .5, 'et la lumière revient');
});

T('T209 les montages d’exemple ⚡ font vraiment ce qu’ils annoncent', () => {
  const noms = EXAMPLES.map(e => e.name);
  ['⚡ La boucle qui s’allume', '⚡ Banc de mesure', '⚡ Variateur de lumière',
   '⚡ Deux barres et un fusible'].forEach(n =>
    ok(noms.includes(n), 'l’exemple « ' + n + ' » est au catalogue'));
  // la boucle s'allume
  board();
  loadExample(noms.indexOf('⚡ La boucle qui s’allume'));
  sim();
  ok(components.find(c => c.type === 'LAMPE').p > .5, 'la boucle éclaire');
  eq(components.find(c => c.type === 'INTERP').state, 1, 'et l’interrupteur est bien retrouvé fermé');
  // le banc mesure
  board();
  loadExample(noms.indexOf('⚡ Banc de mesure'));
  for (let k = 0; k < 3; k++){ __advance(60); sim(); }
  const v = components.find(c => c.type === 'VOLT'), a = components.find(c => c.type === 'AMP');
  const o = components.find(c => c.type === 'OSCILLO');
  near(v.u, 9, .2, 'le voltmètre lit la tension du générateur');
  near(a.i, 9 / 47, .01, 'l’ampèremètre lit le courant de la loi d’Ohm');
  ok(o.buf.length >= 2, 'et l’oscilloscope trace');
  // les deux barres alimentent les trois ampoules
  board();
  loadExample(noms.indexOf('⚡ Deux barres et un fusible'));
  sim();
  const ls = components.filter(c => c.type === 'LAMPE');
  eq(ls.length, 3, 'trois ampoules');
  ok(ls.every(l => l.p > .3), 'toutes alimentées par les barres');
  eq(components.find(c => c.type === 'FUSIBLE').grille, 0, 'et le fusible tient');
  board();
});


console.log('\n— ⚡ Lot 4 : produire du courant —');

/* Un banc d'induction : bobine + charge + masse, et un aimant loin devant */
function bancInduction(){
  board();
  const b = mk('BOBINE', 400, 100), a = mk('AIMANT', -600, 128),
        r = mk('RESIS', 760, 100), m = mk('MASSE', 1000, 100);
  r.opt.r = 100;
  link(b, 0, r, 0); link(r, 0, m, 0); link(m, 0, b, 0);
  __advance(50); sim(); __advance(50); sim();      // au repos, flux mémorisé
  return { b, a, r, m, cx: b.x + b.bw / 2 };
}
/* Amène le CENTRE de l'aimant à l'abscisse x en ms millisecondes, et rend la
   tension produite. (Se tromper de repère fausse tout : c.x est le bord gauche.) */
function passe(t, x, ms){
  t.a.x = x - t.a.bw / 2; __advance(ms); sim();
  return t.b.emf;
}

T('T210 l’induction : ce n’est pas le champ qui produit, c’est sa variation', () => {
  const t = bancInduction();
  near(t.b.emf, 0, 1e-6, 'aimant immobile et loin : rien');
  // on l’approche : une tension apparaît
  const e1 = passe(t, t.cx - 120, 60);
  ok(Math.abs(e1) > .3, 'aimant en mouvement : une tension apparaît (' + e1.toFixed(2) + ' V)');
  // deux fois plus vite : deux fois plus fort
  const t2 = bancInduction();
  const lent = Math.abs(passe(t2, t2.cx - 120, 120));
  const t3 = bancInduction();
  const vite = Math.abs(passe(t3, t3.cx - 120, 60));
  ok(vite > lent * 1.7, 'deux fois plus vite, environ deux fois plus fort (' +
     lent.toFixed(2) + ' → ' + vite.toFixed(2) + ' V)');
  // s’éloigner produit le signe opposé
  const t4 = bancInduction();
  const vers = passe(t4, t4.cx - 100, 60);
  const loin = passe(t4, t4.cx - 400, 60);
  ok(vers * loin < 0, 'aller puis repartir : la tension change de signe');
  // pile au centre, en plein champ maximal : ZÉRO
  const t5 = bancInduction();
  passe(t5, t5.cx - 30, 60);
  const centre = passe(t5, t5.cx + 30, 60);     // symétrique autour du centre
  ok(Math.abs(centre) < Math.abs(vers) * .2,
     'traversée symétrique du centre : la tension s’annule (' + centre.toFixed(3) + ' V)');
  // et s’arrêter suffit à tout éteindre
  const t6 = bancInduction();
  passe(t6, t6.cx - 60, 60);
  const arret = passe(t6, t6.cx - 60, 60);      // il ne bouge plus
  near(arret, 0, 1e-6, 'immobile au cœur de la bobine : rien du tout');
});

T('T211 l’induction alimente vraiment un circuit', () => {
  const t = bancInduction();
  passe(t, t.cx - 120, 60);
  ok(Math.abs(t.r.i) > .002, 'un courant traverse la résistance : ' + fmtAmp(t.r.i));
  near(Math.abs(t.b.i), Math.abs(t.r.i), .001, 'la bobine débite ce que la charge consomme');
  // plus de spires, plus de tension
  const t2 = bancInduction();
  t2.b.opt.n = 400;
  const fort = Math.abs(passe(t2, t2.cx - 120, 60));
  const t3 = bancInduction();
  t3.b.opt.n = 100;
  const faible = Math.abs(passe(t3, t3.cx - 120, 60));
  ok(fort > faible * 3, 'quatre fois plus de spires, bien plus de tension');
  // retourner l’aimant inverse le signe
  const t4 = bancInduction();
  const n = passe(t4, t4.cx - 120, 60);
  const t5 = bancInduction();
  t5.a.opt.sens = 'S';
  __advance(50); sim();
  const sud = passe(t5, t5.cx - 120, 60);
  ok(n * sud < 0, 'pôle retourné : tension inversée');
});

T('T212 la dynamo : ce que tu produis, tu le paies en effort', () => {
  /* Un geste régulier et RÉALISTE : la main tourne à une vitesse que la
     manivelle peut suivre. Un geste plus rapide qu'elle ne l'emmène nulle part. */
  const tourne = (d, pas, ms, vitesse) => {
    const cx = d.x + d.bw / 2, cy = d.y + 112;
    for (let k = 0; k < pas; k++){
      const a = k * (vitesse == null ? .12 : vitesse);
      manivelleVers(d, cx + Math.cos(a) * 50, cy + Math.sin(a) * 50);
      __advance(ms); sim();
    }
  };
  const banc = (charges, ke, rb) => {
    board();
    const d = mk('DYNAMO', 0, 0), m = mk('MASSE', 900, 0);
    d.opt.ke = ke == null ? 9 : ke; d.opt.rb = rb == null ? 2 : rb;
    link(m, 0, d, 0);
    const ls = [];
    for (let k = 0; k < charges; k++){
      const l = mk('LAMPE', 500, k * 200);
      link(d, 0, l, 0); link(l, 0, m, 0);
      ls.push(l);
    }
    return { d, ls };
  };
  // à vide : elle tourne, elle produit une tension, mais aucune puissance
  const v = banc(0);
  tourne(v.d, 90, 30);
  ok(Math.abs(v.d.vit) > 1, 'la manivelle tourne : ' + v.d.vit.toFixed(2) + ' rad/s');
  ok(Math.abs(v.d.emf) > .5, 'et produit une tension : ' + fmtVolt(v.d.emf));
  near(v.d.pelec, 0, 1e-3, 'à vide, aucune électricité produite');
  const effortVide = v.d.pmeca, retardVide = Math.abs(v.d.retard);
  // une ampoule : le MÊME geste demande plus d'effort, et la manivelle traîne
  const un = banc(1);
  tourne(un.d, 90, 30);
  ok(un.d.pelec > .05, 'elle alimente l’ampoule : ' + fmtWatt(un.d.pelec));
  ok(un.ls[0].p > .02, 'et l’ampoule éclaire');
  ok(un.d.pmeca > effortVide * 2,
     'le même geste coûte bien plus d’effort (' + fmtWatt(effortVide) + ' → ' + fmtWatt(un.d.pmeca) + ')');
  ok(Math.abs(un.d.retard) > retardVide * 2,
     'et la manivelle traîne davantage derrière la main (' +
     Math.round(retardVide * 57) + '° → ' + Math.round(Math.abs(un.d.retard) * 57) + '°)');
  // trois ampoules : ça devient franchement dur
  const trois = banc(3);
  tourne(trois.d, 90, 30);
  ok(trois.d.pmeca > un.d.pmeca * 1.5,
     'trois ampoules, bien plus dur encore (' + fmtWatt(trois.d.pmeca) + ')');
  ok(Math.abs(trois.d.retard) > Math.abs(un.d.retard),
     'et elle traîne encore plus');
  // l'énergie ne se crée pas : l'effort couvre toujours ce qui est produit
  [un, trois].forEach(b => ok(b.d.pmeca >= b.d.pelec * .95,
    'l’effort fourni couvre l’électricité produite (' + fmtWatt(b.d.pmeca) +
    ' pour ' + fmtWatt(b.d.pelec) + ')'));
  // on lâche : elle s'arrête, et tout s'éteint
  manivelleLache(trois.d);
  for (let k = 0; k < 200; k++){ __advance(40); sim(); }
  near(trois.d.vit, 0, .12, 'lâchée, elle finit par s’arrêter');
  near(trois.d.pelec, 0, 1e-3, 'et ne produit plus rien');
  // le compteur « tenir N secondes »
  const t = banc(1, 12, 1);
  tourne(t.d, 80, 40);
  ok(t.d.tenu > 1, 'elle a tenu plus d’une seconde : ' + t.d.tenu.toFixed(2) + ' s');
  manivelleLache(t.d);
  for (let k = 0; k < 200; k++){ __advance(40); sim(); }
  near(t.d.tenu, 0, .01, 'et le compteur repart à zéro dès qu’elle ne produit plus');
});

T('T212b l’oscilloscope montre aussi le NÉGATIF', () => {
  const t = bancInduction();
  const o = mk('OSCILLO', 300, 600);
  link(t.b, 0, o, 0);
  o.opt.win = 6; o.buf = []; o.tps = 0;
  // un aller-retour : la tension doit passer des deux côtés de zéro
  for (const x of [t.cx - 260, t.cx - 120, t.cx + 60, t.cx + 240,
                   t.cx + 60, t.cx - 120, t.cx - 260]){
    passe(t, x, 60);
  }
  const hauts = o.buf.filter(q => q.a > .3).length;
  const bas   = o.buf.filter(q => q.a < -.3).length;
  ok(hauts > 0, 'la trace monte au-dessus de zéro (' + hauts + ' points)');
  ok(bas > 0, 'et descend en dessous (' + bas + ' points) — sinon la moitié de ' +
     'l’alternatif serait invisible');
  drawScene(0);                       // le tracé signé ne doit pas lever d’exception
});

T('T213 aimant, bobine et dynamo sont complets et rangés', () => {
  const onglet = TOOL_TABS.find(t => t.key === 'ener');
  const tous2 = TOOL_TABS.reduce((a, t) => a.concat(t.items), []);
  ['AIMANT','BOBINE','DYNAMO'].forEach(t => ok(tous2.includes(t), t + ' est dans la barre d’outils'));
  // l'aimant n'a aucune borne : il agit par sa position
  board();
  const a = mk('AIMANT', 0, 0);
  eq(a.inputs, 0, 'l’aimant n’a pas d’entrée');
  eq(a.outputs, 0, 'ni de sortie');
  ok(REG.AIMANT.libre, 'et il se promène sans s’aimanter à la grille');
  // la bobine et la dynamo sont des sources de puissance
  const b = mk('BOBINE', 300, 0), d = mk('DYNAMO', 600, 0);
  eq(b.outPins[0].kind, 'pui', 'la bobine sort de la puissance');
  eq(d.outPins[0].kind, 'pui', 'la dynamo aussi');
  // la manivelle s'attrape en son centre, pas sur les bords
  ok(REG.DYNAMO.manipHit(d, d.x + d.bw / 2, d.y + 112), 'le centre de la manivelle s’attrape');
  ok(!REG.DYNAMO.manipHit(d, d.x + 4, d.y + 4), 'mais pas le coin du boîtier');
  // l'angle de la manivelle survit à une sauvegarde
  d.ang = 1.23;
  const data = serializeGroup([d]);
  board();
  spawnGroup(data, 0, 0, false);
  near(components[0].ang, 1.23, .02, 'la position de la manivelle est retrouvée');
  board();
});


console.log('\n— ⚡ Lot 5 : produire autrement, et rejoindre le Process —');

/* Chaudière chauffée à fond, turbine branchée dessus, et ce qu'on veut derrière */
function centrale(charges){
  board();
  const h = mk('SWITCH', 0, 0); h.state = 1;         // pleine chauffe (HIGH vaut toujours 1)
  const ch = mk('CHAUD', 200, 0), tu = mk('TURBINE', 500, 0), m = mk('MASSE', 1000, 0);
  ch.opt.montee = 4; ch.opt.fuite = 2;
  tu.opt.ke = 20; tu.opt.rb = 1;
  link(h, 0, ch, 0);                                  // CHF
  link(ch, 2, tu, 1);                                 // VAP → VAP
  link(m, 0, tu, 0);                                  // le retour
  const ls = [];
  for (let k = 0; k < (charges || 0); k++){
    const l = mk('LAMPE', 750, k * 200);
    link(tu, 0, l, 0); link(l, 0, m, 0);
    ls.push(l);
  }
  return { ch, tu, m, ls };
}
function chauffe(n, ms){ for (let k = 0; k < n; k++){ __advance(ms || 100); sim(); } }

T('T214 la chaudière : de la chaleur, de l’eau, et de la pression', () => {
  board();
  const h = mk('SWITCH', 0, 0); h.state = 1;
  const ch = mk('CHAUD', 200, 0);
  ch.opt.montee = 4; ch.opt.fuite = 2;
  link(h, 0, ch, 0);
  chauffe(30);
  ok(ch.bar > 3, 'la pression monte quand on chauffe : ' + ch.bar.toFixed(1) + ' bar');
  ok(ch.outPins[0].state > 0, 'et elle est publiée sur la mesure');
  // on coupe la chauffe : elle redescend toute seule
  h.state = 0; ch.opt.fuite = 25; sim();
  const avant = ch.bar;
  chauffe(60);
  ok(ch.bar < avant - .5, 'chauffe coupée, la pression retombe (' +
     avant.toFixed(1) + ' → ' + ch.bar.toFixed(1) + ' bar)');
  // la surpression est signalée
  h.state = 1; ch.opt.haut = 2;
  chauffe(40);
  eq(ch.outPins[1].state, 1, 'au-delà du seuil, la sortie HAUT passe à 1');
});

T('T215 la turbine : sans vapeur rien, et ce qu’elle produit, elle le paie', () => {
  // sans vapeur, elle ne tourne pas
  board();
  const tu = mk('TURBINE', 0, 0), m = mk('MASSE', 500, 0), l = mk('LAMPE', 250, 200);
  link(m, 0, tu, 0); link(tu, 0, l, 0); link(l, 0, m, 0);
  chauffe(30);
  near(tu.vit, 0, .05, 'aucune vapeur : la roue ne tourne pas');
  near(tu.emf, 0, .05, 'et elle ne produit rien');
  // avec la chaudière, elle démarre et allume
  const c = centrale(1);
  chauffe(60);
  ok(c.ch.bar > 2, 'la chaudière est montée en pression : ' + c.ch.bar.toFixed(1) + ' bar');
  ok(c.tu.vit > 1, 'la turbine tourne : ' + c.tu.vit.toFixed(1) + ' rad/s');
  ok(c.ls[0].p > .1, 'et l’ampoule éclaire : ' + fmtWatt(c.ls[0].p));
  const seule = c.tu.besoin, vitSeule = c.tu.vit, eclSeule = c.ls[0].p;
  // trois ampoules sur la MÊME chaudière : elle ne suit plus. La turbine
  // réclame plus de vapeur, n'en obtient pas assez, ralentit — et tout le
  // monde éclaire moins. C'est la leçon.
  const c3 = centrale(3);
  chauffe(60);
  ok(c3.tu.vit < vitSeule,
     'la chaudière ne suit pas : la turbine ralentit (' + vitSeule.toFixed(1) +
     ' → ' + c3.tu.vit.toFixed(1) + ' rad/s)');
  ok(c3.ls[0].p < eclSeule,
     'et chaque ampoule éclaire moins (' + fmtWatt(eclSeule) + ' → ' + fmtWatt(c3.ls[0].p) + ')');
  // avec une chaudière à la hauteur, en revanche, elle réclame bien davantage
  const g = centrale(3);
  g.ch.opt.montee = 6; g.ch.opt.fuite = 1;
  chauffe(90);
  ok(g.tu.besoin > seule * 1.3,
     'chaudière suffisante : elle ouvre la vapeur pour tenir sa vitesse (' +
     Math.round(seule / 2.55) + ' % → ' + Math.round(g.tu.besoin / 2.55) + ' %)');
  ok(g.tu.pelec > c3.tu.pelec,
     'et elle produit vraiment plus : ' + fmtWatt(c3.tu.pelec) + ' → ' + fmtWatt(g.tu.pelec));
  // on coupe la chauffe : tout retombe, dans l'ordre
  components.filter(x => x.type === 'SWITCH').forEach(x => x.state = 0);
  chauffe(160);
  near(g.tu.vit, 0, .4, 'chauffe coupée, la turbine s’arrête');
  ok(g.ls[0].p < .02, 'et les ampoules s’éteignent');
});

T('T216 le panneau solaire : la lumière devient du courant', () => {
  board();
  const s = mk('SOLAIRE', 0, 0), r = mk('RESIS', 400, 0), m = mk('MASSE', 700, 0);
  s.opt.soleil = 0; s.opt.uco = 9; s.opt.icc = .5; r.opt.r = 100;
  link(s, 0, r, 0); link(r, 0, m, 0); link(m, 0, s, 0);
  __advance(50); sim();
  near(s.emf, 0, .05, 'dans le noir, il ne produit rien');
  s.opt.soleil = 100; __advance(50); sim();
  near(s.emf, 9, .1, 'en plein soleil, il donne sa tension à vide');
  ok(r.i > .05, 'et il débite dans la charge : ' + fmtAmp(r.i));
  // c'est une source de COURANT : sous une charge faible, il plafonne
  r.opt.r = 1; __advance(50); sim();
  eq(s.limite, 1, 'charge trop gourmande : il plafonne');
  near(Math.abs(s.i), .5, .02, 'exactement à son courant maximal');
  ok(Math.abs(s.u) < 3, 'et il a lâché la tension : ' + fmtVolt(s.u));
  // la chaîne complète : une ampoule l'éclaire
  board();
  const p = mk('PILE', 0, 0), l1 = mk('LAMPE', 300, 0), g = mk('MASSE', 600, 0);
  link(p, 0, l1, 0); link(l1, 0, g, 0); link(g, 0, p, 0);
  const s2 = mk('SOLAIRE', 300, 130);                 // juste sous l’ampoule
  s2.opt.soleil = 0;
  const l2 = mk('LAMPE', 640, 130);
  link(s2, 0, l2, 0); link(l2, 0, g, 0); link(g, 0, s2, 0);
  __advance(50); sim(); __advance(50); sim();
  ok(l1.p > .5, 'la première ampoule est allumée par la pile');
  ok(s2.ecl > .1, 'le panneau voit cette ampoule : ' + Math.round(s2.ecl * 100) + ' %');
  ok(s2.emf > .5, 'et il produit une tension : ' + fmtVolt(s2.emf));
  ok(l2.p > 0 && l2.p < l1.p, 'la seconde ampoule s’allume, plus faiblement : c’est le rendement');
  // éloigné, il ne voit plus rien
  s2.x = 3000; __advance(50); sim();
  ok(s2.ecl < .05, 'éloigné, il ne voit plus l’ampoule');
});

T('T217 la thermopile : un écart de température devient une tension', () => {
  board();
  const sb = mk('SEEBECK', 0, 0), r = mk('RESIS', 400, 0), m = mk('MASSE', 700, 0);
  sb.opt.tc = 20; sb.opt.tf = 20; sb.opt.n = 60; r.opt.r = 20;
  __advance(50); sim();
  near(sb.emf, 0, 1e-3, 'les deux faces à la même température : rien');
  sb.opt.tc = 220; __advance(50); sim();
  near(sb.dt, 200, .5, '200 °C d’écart');
  near(sb.emf, 200 * 60 * 40e-6, .01, 'soit environ un demi-volt (40 µV par degré et par jonction)');
  // plus de jonctions, plus de tension
  sb.opt.n = 120; __advance(50); sim();
  near(sb.emf, 200 * 120 * 40e-6, .01, 'deux fois plus de jonctions, deux fois plus de tension');
  // branchée sur un vrai four, elle suit sa température
  board();
  const h = mk('SWITCH', 0, 0); h.state = 1;
  const f = mk('FOUR', 200, 0), sb2 = mk('SEEBECK', 600, 0);
  sb2.opt.tf = 20; sb2.opt.n = 100;
  link(h, 0, f, 0); link(f, 0, sb2, 1);
  chauffe(60);
  ok(f.temp > 20, 'le four a chauffé');
  ok(sb2.tc > 40, 'la thermopile lit sa température : ' + Math.round(sb2.tc) + ' °C');
  ok(sb2.emf > .05, 'et elle produit : ' + fmtVolt(sb2.emf));
});

T('T218 les onglets ne débordent plus, dans aucun atelier', () => {
  ['elec','proc','phys'].forEach(d => {
    setAppMode(d);
    modeTabs().forEach(t => ok(t.items.length <= 11,
      'atelier ' + d + ' · « ' + t.name + ' » : ' + t.items.length));
  });
  setAppMode('elec');
  // un composant rangé à la main ne se retrouve pas EN PLUS dans l’onglet de sa famille
  const inTab = TOOL_TABS.find(t => t.key === 'in');
  ok(!inTab.items.includes('ESTOP'), 'l’arrêt d’urgence reste au pupitre, pas dans les entrées');
  const outTab = TOOL_TABS.find(t => t.key === 'out');
  ok(!outTab.items.includes('JAUGE'), 'la jauge reste en supervision');
  const act = TOOL_TABS.find(t => t.key === 'act');
  ok(!act.items.includes('FOUR'), 'le four est passé dans « Procédés »');
  // …mais un onglet qui EMPRUNTE ne prive personne
  const wire = TOOL_TABS.find(t => t.key === 'wire');
  ok(wire.items.includes('TUNNEL') && wire.items.includes('RAIL8'),
     'le rail et le tunnel de signal restent dans le câblage des deux autres ateliers');
  const wirep = TOOL_TABS.find(t => t.key === 'wirep');
  ok(wirep.items.includes('TUNNEL'), 'tout en étant empruntés par l’atelier ⚡');
  board();
});

T('T219 l’horloge du simulateur, et le ralenti', () => {
  board();
  eq(ralenti, 1, 'au départ le circuit vit à la vitesse du monde');
  // le facteur ne prend que trois valeurs
  setRalenti(10);  eq(ralenti, 10, '×10 est accepté');
  setRalenti(7);   eq(ralenti, 10, 'une valeur inconnue est refusée');
  setRalenti(1);
  eq(cycleRalenti()[0], 10,  'le bouton passe de ×1 à ×10');
  eq(cycleRalenti()[0], 100, 'puis à ×100');
  eq(cycleRalenti()[0], 1,   'puis revient à ×1');
  // à ×1, l’horloge du circuit suit exactement la vraie montre
  mk('CLOCK', 100, 100);
  sim();
  let a = simNow; __advance(100); sim();
  near(simNow - a, 100, .5, '×1 : 100 ms réelles font 100 ms de circuit');
  // et elle n’est PAS plafonnée : une temporisation compare des échéances,
  // un plafond lui ferait rater un saut dans le temps
  a = simNow; __advance(1000); sim();
  near(simNow - a, 1000, .5, 'un grand saut passe en entier (pas de plafond)');
  // le pas d’intégration, lui, reste plafonné
  a = simNow; __advance(5000); sim();
  near(simNow - a, 5000, .5, 'l’horloge avance de tout le saut');
  ok(simDt <= 200.001, 'mais le pas d’intégration reste borné à 200 ms (' + simDt + ')');
  // au ralenti, le circuit vieillit moins vite
  setRalenti(10);
  a = simNow; __advance(1000); sim();
  near(simNow - a, 100, .5, '×10 : 1000 ms réelles ne font que 100 ms de circuit');
  setRalenti(100);
  a = simNow; __advance(1000); sim();
  near(simNow - a, 10, .5, '×100 : dix fois moins encore');
  // une temporisation suit bien le ralenti
  setRalenti(1);
  board();
  const b = mk('SWITCH', 0, 0), ton = mk('TON', 300, 0);
  link(b, 0, ton, 0);
  applyInspector(ton, fld('o_sec', 1));
  b.state = 1; sim();
  __advance(600); sim();
  eq(ton.q, 0, 'à 0,6 s la temporisation n’a pas encore lâché');
  __advance(600); sim();
  eq(ton.q, 1, 'à 1,2 s elle a lâché');
  // la même, au ralenti : il faut dix fois plus de temps réel
  board();
  setRalenti(10);
  const b2 = mk('SWITCH', 0, 0), t2 = mk('TON', 300, 0);
  link(b2, 0, t2, 0);
  applyInspector(t2, fld('o_sec', 1));
  b2.state = 1; sim();
  __advance(1200); sim();
  eq(t2.q, 0, '×10 : 1,2 s réelles ne suffisent plus');
  __advance(11000); sim();
  eq(t2.q, 1, 'il en faut douze — le ralenti ralentit TOUT');
  setRalenti(1);
  try { localStorage.removeItem('al2_ralenti'); } catch(e){}
  board();
});

/* Faire s'écouler du VRAI temps de circuit : les sous-pas ne servent que si
   `simDt` est non nul, et le harnais fige l'horloge tant qu'on ne l'avance pas. */
function laisseFiler(ms, pasImage){
  const pas = pasImage || 16;
  for (let t = 0; t < ms; t += pas){ __advance(pas); sim(); }
}

T('T220 le condensateur : il se remplit en courbe, il garde, il se vide', () => {
  board();
  const p = mk('PILE', 0, 0), k = mk('INTERP', 200, 0),
        r = mk('RESIS', 400, 0), co = mk('CONDO', 600, 0), g = mk('MASSE', 800, 0);
  r.opt.r = 1000; co.opt.cap = 1000;        // 1 kΩ × 1000 µF : une seconde de constante
  link(p, 0, k, 0); link(k, 0, r, 0); link(r, 0, co, 0); link(co, 0, g, 0); link(g, 0, p, 0);
  k.state = 1;
  sim();
  const uc = () => (co._mem && co._mem.u0) || 0;
  near(uc(), 0, .05, 'au départ il est vide');
  // il ne se remplit pas d’un coup : c’est toute la différence avec un fil
  laisseFiler(200);
  const a = uc();
  ok(a > .5 && a < 1.4, 'à 0,2 s il est à peine entamé (' + a.toFixed(2) + ' V)');
  laisseFiler(800);
  const b = uc();
  // 4,5 V × (1 − e⁻¹) = 2,84 V
  near(b, 2.84, .35, 'à 1 s (une constante de temps) il est aux deux tiers');
  ok(b > a, 'et il a bien continué de monter');
  laisseFiler(3000);
  const plein = uc();
  near(plein, 4.5, .2, 'au bout de plusieurs constantes il atteint la pile');
  // on coupe : il GARDE sa charge, c’est ça, avoir de la mémoire
  k.state = 0;
  laisseFiler(500);
  near(uc(), plein, .25, 'interrupteur ouvert, il garde sa tension');
  // le pas de temps a bien été découpé
  ok(elecSous > 1, 'la mémoire a déclenché les sous-pas (' + elecSous + ')');
});

T('T221 la bobine : le courant met du temps à s’établir', () => {
  board();
  const p = mk('PILE', 0, 0), k = mk('INTERP', 200, 0),
        b = mk('INDUC', 400, 0), g = mk('MASSE', 600, 0);
  b.opt.ind = 2000; b.opt.rs = 2;           // 2 H sur 2 Ω : une seconde de constante
  link(p, 0, k, 0); link(k, 0, b, 0); link(b, 0, g, 0); link(g, 0, p, 0);
  k.state = 1;
  sim();
  const il = () => (b._mem && b._mem.i0) || 0;
  near(il(), 0, .05, 'à l’instant où on ferme, elle ne laisse rien passer');
  laisseFiler(200);
  const a = Math.abs(il());
  laisseFiler(5000);
  const c = Math.abs(il());
  ok(c > a, 'le courant monte en pente, il ne bondit pas');
  ok(c > 1, 'et il finit par s’établir pour de bon (' + c.toFixed(2) + ' A)');
  /* Régime établi : la bobine n’est plus qu’un fil résistant, et le rapport
     U / I sur ELLE retombe sur la résistance de son fil. On ne compare pas à
     4,5 / 2 : la pile a sa propre résistance interne, et l’interrupteur la
     sienne. Tant que le courant monte encore, ce rapport reste au-dessus de
     rs — c’est justement la tension que la bobine oppose au changement. */
  const rap = Math.abs(b.u) / c;
  ok(rap >= 1.9 && rap < 2.5,
     'U / I sur la bobine retombe sur la résistance de son fil (' + rap.toFixed(2) + ' Ω pour 2 Ω)');
  ok(elecSous > 1, 'elle aussi a déclenché les sous-pas');
});

T('T222 le générateur alternatif : il change de sens, et assez finement', () => {
  board();
  const g = mk('GENEAC', 0, 0), l = mk('LAMPE', 300, 0);
  g.opt.hz = 2; g.opt.amp = 12; g.opt.forme = 'sinus';
  link(g, 0, l, 0); link(l, 0, g, 0);
  sim();
  // une période entière, relevée finement
  let mini = 1e9, maxi = -1e9, zero = 0;
  for (let i = 0; i < 40; i++){
    laisseFiler(16, 16);
    const v = g.emf;
    mini = Math.min(mini, v); maxi = Math.max(maxi, v);
    if (Math.abs(v) < 3) zero++;
  }
  ok(maxi > 9,  'il monte jusqu’à son amplitude (' + maxi.toFixed(1) + ' V)');
  ok(mini < -9, 'et il descend autant de l’autre côté (' + mini.toFixed(1) + ' V)');
  ok(zero > 0,  'en passant par zéro — c’est ce qui le distingue d’une pile');
  ok(elecSous > 1, 'il réclame des sous-pas pour que l’onde reste une onde (' + elecSous + ')');
  // les trois formes existent et donnent bien trois signaux différents
  eq(acValeur('carre', .1),  1, 'le carré est en haut sur la première moitié');
  eq(acValeur('carre', .6), -1, 'et en bas sur la seconde');
  near(acValeur('tri', .25), 0, .001, 'le triangle passe par son sommet au quart');
  near(acValeur('sinus', .25), 1, .001, 'le sinus, lui, est au sommet au quart');
  // et la phase avance vraiment avec l’horloge du circuit, pas avec la montre
  const ph0 = g.ph;
  laisseFiler(250, 16);
  ok(Math.abs(g.ph - ph0) > .1, 'la phase a tourné');
});

T('T223 les trois nouveaux sont complets et rangés, sans faire déborder', () => {
  ['CONDO', 'INDUC', 'GENEAC'].forEach(t => {
    const d = REG[t];
    ok(d, t + ' existe');
    ok(d.elec, t + ' est un composant de puissance');
    ok(d.guide && d.guide.txt.length > 40, t + ' a son entrée de guide');
    ok(TOOL_TABS.some(x => x.items.includes(t)), t + ' est rangé dans un onglet');
    // il se pose, se simule et se dessine
    board();
    const c = mk(t, 100, 100);
    sim(); drawScene(0);
    ok(c, t + ' se pose sans erreur');
  });
  // le rangement ne fait déborder aucun onglet
  TOOL_TABS.filter(t => (t.dom || []).includes('phys')).forEach(t =>
    ok(t.items.length <= 11, 'onglet ⚡ « ' + t.name + ' » : ' + t.items.length + ' tuiles'));
  // sans mémoire ni source rapide, le solveur retrouve son pas unique
  const b = boucle(); sim();
  eq(elecSous, 0, 'un circuit continu ordinaire ne coûte pas un sous-pas');
});

T('T224 le contournement se faufile au lieu de survoler tout le plan', () => {
  board();
  // deux pièces à relier, à la même hauteur, la cible DERRIÈRE : il faut
  // contourner. Un obstacle au-dessus, un autre en dessous — et entre les
  // deux, toute la place voulue.
  const g = mk('MASSE', 900, 140), pl = mk('PILE', 0, 140);
  const haut = mk('LAMPE', 450, -60), bas = mk('LAMPE', 450, 380);
  link(g, 0, pl, 0);
  sim();
  const w = wires[0];
  const A = { x:w.outPin.x, y:w.outPin.y }, B = { x:w.inPin.x, y:w.inPin.y };
  near(A.y, B.y, 2, 'les deux bornes sont bien à la même hauteur');
  const y = bypassY(w.outPin.comp, w.inPin.comp, A, B, 0, 0);
  ok(y > haut.y + haut.bh, 'il passe SOUS l’obstacle du haut, au lieu de le survoler');
  ok(y < bas.y, 'et AU-DESSUS de celui du bas : il se faufile entre les deux');
  // le détour reste raisonnable : c’est tout l’objet de la correction
  ok(Math.abs(y - A.y) < 220, 'le détour reste court (' + Math.round(Math.abs(y - A.y)) + ' px)');
  // et les bouchons sont bien fusionnés, marge comprise
  const bo = bouchons(w.outPin.comp, w.inPin.comp, A, B, 26);
  ok(bo.length >= 2, 'les obstacles laissent au moins un couloir (' + bo.length + ' bouchons)');
  for (let i = 1; i < bo.length; i++)
    ok(bo[i][0] > bo[i-1][1], 'les bouchons sont fusionnés et ordonnés');
});

T('T225 un câble ne traverse plus un boîtier posé sur son chemin', () => {
  board();
  const p = mk('PILE', 0, 0), ob = mk('RESIS', 420, 0), l = mk('LAMPE', 840, 0);
  link(p, 0, l, 0);                       // on saute par-dessus la résistance
  sim();
  const pts = wires[0].route();
  let traverse = false;
  for (let i = 1; i < pts.length; i++){
    const x0 = Math.min(pts[i-1].x, pts[i].x), x1 = Math.max(pts[i-1].x, pts[i].x);
    const y0 = Math.min(pts[i-1].y, pts[i].y), y1 = Math.max(pts[i-1].y, pts[i].y);
    if (x1 > ob.x + 2 && x0 < ob.x + ob.bw - 2 &&
        y1 > ob.y + 2 && y0 < ob.y + ob.bh - 2) traverse = true;
  }
  ok(!traverse, 'le fil contourne la résistance au lieu de la couper');
  // les deux détecteurs de collision disent vrai
  ok(barreH(ob.x - 60, ob.x + ob.bw + 60, ob.y + ob.bh / 2, null, null),
     'barreH voit un boîtier sur une horizontale qui le coupe');
  ok(!barreH(ob.x - 60, ob.x + ob.bw + 60, ob.y - 40, null, null),
     'et ne le voit pas quand la ligne passe au-dessus');
  ok(barreV(ob.x + ob.bw / 2, ob.y - 60, ob.y + ob.bh + 60, null, null),
     'barreV le voit sur une verticale qui le coupe');
  ok(!barreV(ob.x - 40, ob.y - 60, ob.y + ob.bh + 60, null, null),
     'et pas quand elle passe à côté');
  // la pièce reliée n’est jamais un obstacle pour son propre fil
  ok(!barreH(ob.x - 60, ob.x + ob.bw + 60, ob.y + ob.bh / 2, ob, null),
     'un boîtier relié ne se barre pas le passage à lui-même');
  // deux bornes en face et rien entre elles : le fil reste DROIT
  board();
  const a2 = mk('PILE', 0, 0), b2 = mk('LAMPE', 700, 0);
  link(a2, 0, b2, 0);
  sim();
  const ys = [...new Set(wires[0].route().map(q => Math.round(q.y)))];
  eq(ys.length, 1, 'sans obstacle, le fil ne fait aucun détour');
});

T('T226 la diode ne laisse passer que dans un sens, le pont redresse les deux', () => {
  // --- une diode seule : la moitié de l’onde disparaît ---
  board();
  const g = mk('GENEAC', 0, 0), d = mk('DIODE', 300, 0),
        l = mk('LAMPE', 600, 0), ms = mk('MASSE', 900, 0);
  g.opt.hz = 4; g.opt.amp = 12;
  link(g, 0, d, 0); link(d, 0, l, 0); link(l, 0, ms, 0); link(ms, 0, g, 0);
  sim();
  let mini = 1e9, maxi = -1e9;
  for (let k = 0; k < 60; k++){ laisseFiler(8, 8); mini = Math.min(mini, d.i); maxi = Math.max(maxi, d.i); }
  ok(maxi > .01, 'elle laisse passer dans son sens (' + maxi.toFixed(3) + ' A)');
  ok(mini > -.01, 'et rien dans l’autre (' + mini.toFixed(4) + ' A)');
  // à l’envers, plus rien ne passe du tout
  board();
  const g2 = mk('GENEAC', 0, 0), d2 = mk('DIODE', 300, 0),
        l2 = mk('LAMPE', 600, 0), m2 = mk('MASSE', 900, 0);
  g2.opt.hz = 4; g2.opt.amp = 12;
  link(g2, 0, d2, 0); link(d2, 0, l2, 0); link(l2, 0, m2, 0); link(m2, 0, g2, 0);
  sim();
  const vf = 5;                        // un seuil énorme : elle ne s’ouvre jamais
  d2.opt.vf = vf;
  let passe = 0;
  for (let k = 0; k < 40; k++){ laisseFiler(8, 8); passe = Math.max(passe, Math.abs(d2.i)); }
  ok(passe < .5, 'un seuil trop haut la garde fermée (' + passe.toFixed(3) + ' A)');

  // --- le pont : les deux alternances, du même côté ---
  board();
  const g3 = mk('GENEAC', 0, 60), pt = mk('PONT', 340, 0),
        l3 = mk('LAMPE', 720, 60), m3 = mk('MASSE', 60, 300);
  g3.opt.hz = 4; g3.opt.amp = 14;
  link(g3, 0, pt, 0); link(m3, 0, g3, 0); link(m3, 0, pt, 1);
  link(pt, 0, l3, 0); link(l3, 0, pt, 2);
  sim();
  let umin = 1e9, umax = -1e9, allume = 0, tours = 0;
  for (let k = 0; k < 60; k++){
    laisseFiler(8, 8); tours++;
    const u = (+pt.outPins[0].state || 0) - (+pt.inPins[2].state || 0);
    umin = Math.min(umin, u); umax = Math.max(umax, u);
    if (l3.p > .05) allume++;
  }
  ok(umax > 5, 'la sortie monte (' + umax.toFixed(1) + ' V)');
  ok(umin > -.6, 'et ne passe jamais vraiment sous zéro (' + umin.toFixed(2) + ' V)');
  ok(allume / tours > .5,
     'l’ampoule éclaire plus de la moitié du temps : les DEUX alternances servent ('
     + Math.round(allume / tours * 100) + ' %)');
});

T('T227 le circuit LC a une fréquence préférée', () => {
  board();
  const g = mk('GENEAC', 0, 0), b = mk('INDUC', 300, 0), co = mk('CONDO', 600, 0),
        r = mk('RESIS', 900, 0), ms = mk('MASSE', 1200, 0);
  g.opt.amp = 12; g.opt.ri = .5;
  b.opt.ind = 1000; b.opt.rs = 1;      // 1 H
  co.opt.cap = 100;                    // 100 µF  →  f0 ≈ 15,9 Hz
  r.opt.r = 2;
  link(g, 0, b, 0); link(b, 0, co, 0); link(co, 0, r, 0); link(r, 0, ms, 0); link(ms, 0, g, 0);
  const f0 = 1 / (2 * Math.PI * Math.sqrt(1 * 100e-6));
  near(f0, 15.9, .3, 'la fréquence propre théorique vaut bien 15,9 Hz');
  const mesure = hz => {
    g.opt.hz = hz;
    sim();
    laisseFiler(200, 8);               // on laisse le régime s’établir
    let pic = 0;
    for (let k = 0; k < 40; k++){ laisseFiler(8, 8); pic = Math.max(pic, Math.abs(r.i)); }
    return pic;
  };
  const bas = mesure(5), pres = mesure(16), haut = mesure(50);
  ok(pres > bas * 2,  'à la résonance le courant dépasse largement celui du bas (' +
     pres.toFixed(3) + ' contre ' + bas.toFixed(3) + ' A)');
  ok(pres > haut * 2, 'et celui du haut (' + pres.toFixed(3) + ' contre ' + haut.toFixed(3) + ' A)');
  // les deux pièces sont indispensables : l’une sans l’autre, pas de pic
  ok(elecSous > 1, 'le circuit réclame bien des sous-pas');
});

T('T228 les composants de l’alternatif sont complets et rangés', () => {
  ['DIODE', 'PONT'].forEach(t => {
    const d = REG[t];
    ok(d && d.elec, t + ' est un composant de puissance');
    ok(d.guide && d.guide.txt.length > 40, t + ' a son entrée de guide');
    ok(TOOL_TABS.some(x => x.items.includes(t)), t + ' est rangé dans un onglet');
    board(); mk(t, 100, 100); sim(); drawScene(0);
  });
  // le cinquième onglet ⚡ existe et ne déborde pas
  const alt = TOOL_TABS.find(t => t.key === 'alt');
  ok(alt, 'l’onglet « L’alternatif » existe');
  ok(alt.items.length >= 5 && alt.items.length <= 11,
     'il contient les pièces de l’alternatif sans déborder (' + alt.items.length + ')');
  ['GENEAC', 'CONDO', 'INDUC', 'DIODE', 'PONT'].forEach(t =>
    ok(alt.items.includes(t), t + ' y est rangé'));
  // sa section de guide existe, sinon T57 tomberait sans dire pourquoi
  ok(FAM_SECTIONS.some(f => f.key === 'alt'), 'la famille a sa section de guide');
});


console.log('\n— ⚡ Finitions : fils droits, bornes libres, condensateur visible —');

T('T229 un fil droit reste droit, même quand un autre passe dans le couloir', () => {
  board();
  const p = mk('PILE', 0, 0), k = mk('INTERP', 400, 0);
  const w = link(p, 0, k, 0);
  sim(); drawScene(0); spreadRoutes();
  const ya = p.outPins[0].y;
  ok(w._raw.every(q => Math.abs(q.y - ya) < .5), 'seul, il est parfaitement droit');
  ok(w._rp.every(q => Math.abs(q.y - ya) < .5), 'et le tracé posé aussi');
  // un deuxième fil part de la même borne : c'est LUI qui s'écarte
  const l = mk('LAMPE', 400, 320);
  const w2 = link(p, 0, l, 0);
  sim(); drawScene(0); spreadRoutes();
  ok(w._rp.every(q => Math.abs(q.y - ya) < .6),
     'le fil droit n’a pas bougé (' + w._rp.map(q => Math.round(q.y)).join(',') + ')');
  ok(w2._rp.some(q => Math.abs(q.y - ya) > 4), 'et l’autre s’est bien écarté');
});

T('T230 en puissance, une borne se relie à n’importe quelle borne', () => {
  board();
  const l1 = mk('LAMPE', 0, 0), l2 = mk('LAMPE', 300, 0);
  // deux ampoules en parallèle : entrée sur entrée, sortie sur sortie
  relierBornes(l1.inPins[0], l2.inPins[0]);
  relierBornes(l1.outPins[0], l2.outPins[0]);
  eq(wires.length, 2, 'les deux fils de parallèle sont posés');
  relierBornes(l1.inPins[0], l2.inPins[0]);
  eq(wires.length, 2, 'le même fil ne se pose pas deux fois');
  relierBornes(l2.inPins[0], l1.inPins[0]);
  eq(wires.length, 2, 'ni dans l’autre sens');
  // et ça marche vraiment : les deux ampoules brillent pareil
  const g = mk('PILE', -300, 0), m = mk('MASSE', 600, 0);
  link(g, 0, l1, 0); link(l1, 0, m, 0); link(m, 0, g, 0);
  sim();
  ok(l1.p > .05 && l2.p > .05, 'les deux éclairent');
  near(l1.p, l2.p, Math.max(.02, l1.p * .05), 'et elles se partagent le courant à égalité');
  // un signal, lui, garde son sens
  board();
  const a = mk('SWITCH', 0, 0), b = mk('SWITCH', 200, 0);
  relierBornes(a.outPins[0], b.outPins[0]);
  eq(wires.length, 0, 'deux sorties logiques ne se relient pas');
  // le côté de chaque bout survit à une sauvegarde
  board();
  const p1 = mk('LAMPE', 0, 0), p2 = mk('LAMPE', 300, 0);
  relierBornes(p1.inPins[0], p2.inPins[0]);
  const data = serializeGroup(components);
  board();
  spawnGroup(data, 0, 0, false);
  eq(wires.length, 1, 'le fil est relu');
  ok(!wires[0].outPin.isOutput && !wires[0].inPin.isOutput,
     'et ses deux bouts sont toujours des entrées');
});

T('T231 le condensateur : jusqu’au farad, et il dit combien de temps il a mis', () => {
  board();
  const d = REG.CONDO.opts.find(o => o.k === 'cap');
  ok(d.max >= 1e6, 'la capacité monte jusqu’au farad (' + d.max + ' µF)');
  ok(d.log, 'et sa glissière compte en décades');
  // la glissière logarithmique : le milieu de la course, c'est la racine
  const pr = { min:1, max:10000, log:true, step:1 };
  near(paramVal(pr, .5), 100, 1, 'à mi-course d’une échelle log, on est à la racine');
  near(paramFrac(pr, 100), .5, .01, 'et l’aller-retour retombe juste');
  eq(paramArrondi(pr, 4712), 4700, 'deux chiffres significatifs');
  eq(paramArrondi(pr, 47.12), 47, 'à toutes les échelles');
  // le chronomètre : un remplissage lent est mesuré, un remplissage éclair est signalé
  board();
  const pl = mk('PILE', 0, 0), k = mk('INTERP', 200, 0),
        r = mk('RESIS', 400, 0), co = mk('CONDO', 600, 0), g = mk('MASSE', 800, 0);
  r.opt.r = 1000; co.opt.cap = 1000;                // une seconde de constante
  link(pl, 0, k, 0); link(k, 0, r, 0); link(r, 0, co, 0); link(co, 0, g, 0); link(g, 0, pl, 0);
  k.state = 1; sim();
  laisseFiler(6000);
  ok(co._tplein > .5 && co._tplein < 12,
     'le remplissage mesuré tient debout (' + co._tplein.toFixed(2) + ' s)');
  ok(co._upk > 4, 'et il est bien monté à la tension de la pile');
  ok(!co._vide, 'plein, il n’est évidemment pas marqué vidé');
  // on coupe, il se vide dans une ampoule : cette fois c'est la DÉCHARGE
  const la = mk('LAMPE', 600, 300);
  la.opt.un = 4.5; la.opt.pn = .8;
  link(r, 0, la, 0); link(la, 0, g, 0);
  laisseFiler(300);
  k.state = 0;
  laisseFiler(3000);
  ok(co._vide, 'coupé, il a rendu ce qu’il gardait');
  ok(Math.abs(memLu(co, 'u0')) < 1, 'et il est retombé près de zéro');
});

console.log('\n— 📡 Lot 8 : la radio — la distance et les obstacles —');

/* Un émetteur alimenté, et un récepteur qu'on pose où l'on veut. */
function posteRadio(dxPx, dyPx){
  board();
  const g = mk('GENE', 0, 0), e = mk('EMET', 320, 0), m = mk('MASSE', 640, 0);
  g.opt.u = 12; g.opt.ri = .1; g.opt.ilim = 3; e.opt.pw = 1; e.opt.un = 12;
  link(g, 0, e, 0); link(e, 0, m, 0); link(m, 0, g, 0);
  const r = mk('RECEP', 320 + (dxPx || 0), dyPx || 0);
  r.opt.seuil = .3;
  sim(); sim();                 // la 2e image : l'émetteur a publié sa puissance
  return { g, e, m, r };
}

T('T232 la radio : sans fil, et deux fois plus loin c’est quatre fois moins', () => {
  const A = posteRadio(0, 500);
  ok(A.e._ray > .9 && A.e._ray < 1.1, 'l’émetteur rayonne ce qu’il consomme (' + A.e._ray.toFixed(3) + ' W)');
  ok(!wires.some(w => w.outPin.comp === A.e && w.inPin.comp === A.r), 'aucun fil ne les relie');
  ok(A.r._uant > 0, 'et pourtant le récepteur capte (' + fmtVolt(A.r._uant) + ')');
  ok(A.r._src === A.e, 'il sait de qui ça vient');
  const d1 = A.r._dist, u1 = A.r._uant, p1 = A.r._recu;
  // on l'éloigne exactement deux fois plus
  A.r.y = A.r.y + (A.r.y - (A.e.y + A.e.bh / 2 - A.r.bh / 2));
  sim(); sim();
  const d2 = A.r._dist, u2 = A.r._uant, p2 = A.r._recu;
  near(d2 / d1, 2, .04, 'il est deux fois plus loin (' + fmtMetre(d1) + ' → ' + fmtMetre(d2) + ')');
  near(u1 / u2, 2, .06, 'la TENSION est divisée par deux');
  near(p1 / p2, 4, .2, 'mais la PUISSANCE par quatre — c’est ça, la loi du carré');
  // un émetteur débranché n’émet rien
  wires = wires.filter(w => w.outPin.comp !== A.g);
  recalcFan(); sim(); sim();
  near(A.e._ray, 0, 1e-3, 'débranché, il ne rayonne plus rien');
  near(A.r._uant, 0, 1e-6, 'et le récepteur ne capte plus rien');
});

T('T233 un mur sur le trajet coupe, un mur à côté ne fait rien', () => {
  // le rognage de segment, d’abord, tout seul
  ok(segCoupeRect(0, 0, 100, 0, 40, -10, 20, 20), 'un segment qui traverse');
  ok(!segCoupeRect(0, 0, 100, 0, 40, 40, 20, 20), 'un rectangle posé à côté');
  ok(!segCoupeRect(0, 0, 30, 0, 40, -10, 20, 20), 'un rectangle au-delà du bout');
  ok(segCoupeRect(0, 0, 0, 100, -10, 40, 20, 20), 'un segment vertical');

  const A = posteRadio(0, 600);
  const libre = A.r._uant;
  ok(A.r.outPins[3].state === 1, 'sans obstacle, la liaison tient');
  // un mur POSÉ À CÔTÉ ne change rien
  const cote = mk('MUR', 1400, 300);
  cote.opt.mat = 'metal'; cote.opt.larg = 288; cote.opt.haut = 64;
  REG.MUR.restore(cote);
  sim(); sim();
  near(A.r._uant, libre, libre * .001, 'un mur à côté du trajet ne gêne personne');
  eq(A.r._murs, 0, 'et il n’est pas compté');
  // le même mur, mis en travers
  cote.x = 240; cote.y = 300;
  sim(); sim();
  eq(A.r._murs, 1, 'en travers, il compte');
  ok(A.r._uant < libre * .1, 'et il coupe pour de bon (' + fmtVolt(libre) + ' → ' + fmtVolt(A.r._uant) + ')');
  eq(A.r.outPins[3].state, 0, 'la liaison est perdue');
  // les quatre matières, dans l’ordre
  const lus = ONDE_MATS.map(m => { cote.opt.mat = m[0]; sim(); sim(); return A.r._uant; });
  for (let i = 1; i < lus.length; i++)
    ok(lus[i] < lus[i-1], ONDE_MATS[i][2] + ' coupe plus que ' + ONDE_MATS[i-1][2]);
  // deux murs coupent plus qu’un
  const deux = mk('MUR', 240, 420);
  deux.opt.mat = 'bois'; deux.opt.larg = 288; deux.opt.haut = 64;
  REG.MUR.restore(deux);
  cote.opt.mat = 'bois'; sim(); sim();
  const d2 = A.r._uant;
  wires = wires; components = components.filter(c => c !== deux);
  sim(); sim();
  ok(d2 < A.r._uant * .8, 'deux cloisons coupent plus qu’une seule');
});

T('T234 le récepteur est une vraie source, et un seuil qui décide', () => {
  const A = posteRadio(0, 400);
  ok(A.r._uant > .3, 'il capte largement');
  // un voltmètre à ses bornes lit la tension qu’il produit
  const v = mk('VOLT', 900, 400);
  relierBornes(v.inPins[0], A.r.outPins[0]);
  relierBornes(v.inPins[1], A.r.inPins[0]);
  sim(); sim();
  ok(Math.abs(A.r.u) > .05, 'ses bornes ⚡ portent bien une tension (' + fmtVolt(A.r.u) + ')');
  // la sortie MES parle en volts, la sortie SEU décide
  const mes = raw2phys(A.r.outPins[2].state, { min:0, max:5 });
  near(mes, Math.min(5, A.r._uant), .05, 'la sortie MES dit la même chose, en volts');
  eq(A.r.outPins[3].state, 1, 'au-dessus du seuil, SEU est à 1');
  A.r.opt.seuil = 4.9;
  sim(); sim();
  eq(A.r.outPins[3].state, 0, 'seuil relevé : SEU retombe à 0');
  eq(A.r._hs, 1, 'et il retient qu’il a été hors de portée');
});

T('T235 les trois pièces de la radio sont complètes et rangées', () => {
  ['EMET', 'RECEP', 'MUR'].forEach(t => {
    const d = REG[t];
    ok(d, t + ' est au registre');
    ok(d.guide && d.guide.txt.length > 40, t + ' a son entrée de guide');
    ok(TOOL_TABS.some(x => x.items.includes(t)), t + ' est rangé dans un onglet');
    board(); mk(t, 100, 100); sim(); drawScene(0);
  });
  const on = TOOL_TABS.find(t => t.key === 'onde');
  ok(on, 'l’onglet « La radio » existe');
  ok(on.items.length >= 3 && on.items.length <= 11, 'il ne déborde pas (' + on.items.length + ')');
  ok(FAM_SECTIONS.some(f => f.key === 'onde'), 'la famille a sa section de guide');
  // l’échelle du plan est dite quelque part, sinon « la distance » ne veut rien dire
  eq(ONDE_PXM, 50, '50 pixels valent un mètre');
  eq(fmtMetre(.4), '40 cm', 'les petites distances se disent en centimètres');
  eq(fmtMetre(3.25), '3.3 m', 'et les autres en mètres');
  // le mur se redimensionne par sa poignée, comme un cadre
  board();
  const m = mk('MUR', 0, 0);
  ok(REG.MUR.grip(m), 'il a une poignée de coin');
  gripStart(m, m.x + m.w, m.y + m.h);
  gripMove(m.x + m.w + 160, m.y + m.h + 96);
  ok(m.w > 96 && m.h > 288, 'et il s’étire (' + m.w + '×' + m.h + ')');
  eq(m.opt.larg, m.w, 'la taille est rangée dans les réglages, donc sauvegardée');
});

console.log('\n— 🧰 Réparations de l’overlay —');

T('T236 aucun identifiant en double dans le balisage', () => {
  /* `getElementById` ne rend QUE le premier trouvé. Deux éléments qui portent
     le même identifiant, et le code écrit dans le mauvais sans rien dire :
     c'est exactement ce qui faisait écrire au panneau « Relier à… » son titre
     dans celui de la recherche. Ce test-là aurait attrapé le bug. */
  const vus = new Map();
  const doubles = [];
  for (const m of __HTML.matchAll(/\bid="([\w-]+)"/g)){
    const k = m[1];
    if (vus.has(k)) doubles.push(k); else vus.set(k, 1);
  }
  ok(!doubles.length, 'identifiants portés par deux éléments : ' + [...new Set(doubles)].join(', '));
  // et les deux panneaux flottants ont bien chacun les leurs
  ['find-head', 'find-title', 'find-hint', 'find-close',
   'quick-head', 'quick-title', 'quick-hint', 'quick-close'].forEach(id =>
    ok(__HTML.includes('id="' + id + '"'), id + ' existe dans le balisage'));
  // …et chacun son style : celui de la recherche n’en avait aucun
  ok(/#quick-close,#find-close\{/.test(__HTML), 'les deux croix de fermeture sont stylées ensemble');
  ok(/#quick-title,#find-title\{/.test(__HTML), 'les deux titres aussi');
});

T('T237 l’overlay : ce qui se recouvrait ne se recouvre plus', () => {
  const z = sel => {
    const m = __HTML.match(new RegExp(sel.replace(/[.#]/g, '\\$&') + '\\{[^}]*z-index:(\\d+)'));
    return m ? +m[1] : null;
  };
  const zToast = z('#toast-box'), zModale = z('.modal-overlay'), zBarre = z('#toolbar'),
        zCorb = z('#trash-zone'), zEntete = z('#hud-header');
  ok(zToast > zModale, 'les messages passent DEVANT le voile des fenêtres (' +
     zToast + ' contre ' + zModale + ')');
  ok(zCorb > zBarre, 'la corbeille passe devant la barre du bas (' + zCorb + ' contre ' + zBarre + ')');
  ok(zEntete > zBarre, 'et l’en-tête aussi');
  // la corbeille et les messages sont calés sur la HAUTEUR RÉELLE de la barre
  ok(/#trash-zone\{[^}]*bottom:calc\(var\(--barh/.test(__HTML.replace(/\n\s*/g, '')),
     'la corbeille suit la hauteur de la barre du bas');
  ok(/#toast-box\{[^}]*bottom:calc\(var\(--barh/.test(__HTML.replace(/\n\s*/g, '')),
     'les messages aussi');
  // l’énoncé cesse d’être centré avant de passer sous les boutons d’action
  ok(/@media \(max-width:1136px\)/.test(__HTML), 'un palier à 1136 px, là où le recouvrement commence');
  ok(/#hud-header\{[^}]*overflow-x:auto/.test(__HTML.replace(/\n\s*/g, '')),
     'l’en-tête ne peut plus perdre ses derniers boutons');
  // « Mes puces » défile enfin, comme les autres fenêtres
  ok(/#chips-list\{[^}]*overflow-y:auto/.test(__HTML.replace(/\n\s*/g, '')),
     'la fenêtre des puces défile');
  ok(/#chips-modal \.modal-content\{[^}]*max-height/.test(__HTML.replace(/\n\s*/g, '')),
     'et elle a une hauteur maximale');
});

T('T238 le clavier : une fenêtre ouverte prend la main', () => {
  ok(typeof modaleOuverte === 'function', 'la fenêtre du dessus se repère');
  ok(typeof dansChamp === 'function', 'et un champ de saisie aussi');
  eq(dansChamp({ tagName:'INPUT' }), true, 'un champ de texte en est un');
  eq(dansChamp({ tagName:'BUTTON' }), false, 'un bouton, non — c’est tout le bug : ' +
     'le curseur posé sur un bouton de fenêtre laissait passer Suppr jusqu’au plan');
  eq(dansChamp(null), false, 'et rien du tout non plus');
  // le garde-fou est bien AVANT les raccourcis, pas après
  const src = __HTML.slice(__HTML.indexOf('const modale = modaleOuverte(), champ = dansChamp'));
  const iGarde = src.indexOf('if (modale || champ) return;');
  const iSuppr = src.indexOf("e.key === 'Delete'");
  ok(iGarde > 0 && iSuppr > iGarde, 'Suppr est traité APRÈS le garde-fou');
  ok(src.indexOf("e.key === 'Escape'") < iGarde, 'et Échap AVANT, pour traverser les champs');
});

T('T239 les animations se coupent, le texte se copie, les couleurs se lisent', () => {
  const plat = __HTML.replace(/\n\s*/g, '');
  ok(/@media \(prefers-reduced-motion: reduce\)/.test(plat),
     'le réglage système « réduire les animations » est écouté');
  ok(plat.includes("matchMedia('(prefers-reduced-motion: reduce)').matches) return;"),
     'et les confettis s’abstiennent aussi');
  ok(/\.modal-content,[^{]*\{user-select:text/.test(plat),
     'le texte des fenêtres se sélectionne');
  // le vert du bouton principal : blanc dessus, il faut au moins 4,5 pour 1
  const m = plat.match(/\.btn-verify\{background:linear-gradient\(180deg,(#[0-9a-f]{6})/);
  ok(m, 'le bouton de vérification a bien un dégradé');
  const lum = h => {
    const c = [1,3,5].map(i => parseInt(h.substr(i,2),16)/255)
      .map(v => v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4));
    return .2126*c[0] + .7152*c[1] + .0722*c[2];
  };
  const ratio = 1.05 / (lum(m[1]) + .05);
  ok(ratio >= 4.5, 'et le blanc dessus tient le seuil (' + ratio.toFixed(2) + ' pour 1)');
  // « Sandbox libre » ne détruit rien : il ne doit plus porter l’habit du rouge
  ok(/id="som-sandbox"/.test(__HTML), 'le bouton existe');
  ok(!/btn-ghost" id="som-sandbox"/.test(__HTML), 'et il n’est plus peint en rouge');
});

console.log('\n— 📻 Lot 9 : l’accord et la modulation —');

/* Un émetteur alimenté, et un récepteur posé où l'on veut. */
function station(opts){
  const o = opts || {};
  board();
  const g = mk('GENE', 0, 0), e = mk('EMET', 320, 0), m = mk('MASSE', 700, 0);
  g.opt.u = 12; g.opt.ri = .1; g.opt.ilim = 3;
  e.opt.pw = o.pw || 1; e.opt.un = 12; e.opt.freq = o.freq || 98;
  if (o.mod) e.opt.mod = o.mod;
  if (o.exc) e.opt.exc = o.exc;
  link(g, 0, e, 0); link(e, 0, m, 0); link(m, 0, g, 0);
  const r = mk('RECEP', 320, o.dy != null ? o.dy : 500);
  r.opt.accord = o.accord || o.freq || 98; r.opt.bp = o.bp || 200; r.opt.seuil = o.seuil || .3;
  sim(); sim();
  return { g, e, m, r };
}

T('T240 l’accord : la cloche, le choix d’une station, la bande passante', () => {
  // la courbe de réponse, seule : 1 au centre, la moitié au bord de la bande
  near(ondeAccord(0, 200), 1, 1e-9, 'au centre, tout passe');
  near(ondeAccord(100, 200), .5, .01, 'au bord de la bande passante, la moitié');
  ok(ondeAccord(400, 200) < .01, 'à deux bandes passantes, il ne reste presque rien');
  ok(ondeAccord(-100, 200) === ondeAccord(100, 200), 'et la cloche est symétrique');

  // accordé, puis désaccordé du même montage
  const A = station({ freq:98, accord:98 });
  const juste = A.r._uant;
  ok(juste > .3 && A.r._sel > .99, 'accordé, il reçoit tout (' + fmtVolt(juste) + ')');
  A.r.opt.accord = 98.4;                       // 400 kHz plus loin
  sim(); sim();
  ok(A.r._uant < juste * .1,
     'désaccordé de 400 kHz, il ne reste presque rien (' + fmtVolt(A.r._uant) + ')');
  near(A.r._ecart, -400, 1, 'et il sait de combien il est à côté');

  // deux stations : celle qu'on écoute, et celle qu'on ignore
  const B = station({ freq:98, accord:98 });
  const e2 = mk('EMET', 320, 260);
  e2.opt.pw = 1; e2.opt.un = 12; e2.opt.freq = 106;
  link(B.g, 0, e2, 0); link(e2, 0, B.m, 0);
  sim(); sim();
  ok(e2._ray > .5, 'le second émetteur rayonne aussi');
  ok(B.r._src === B.e, 'mais c’est le premier qu’on entend');
  ok(B.r._pur > .99, 'et le second ne se mêle pas à la conversation (' +
     Math.round(B.r._pur * 1000) / 10 + ' %)');
  // on tourne le bouton : c’est l’autre, maintenant
  B.r.opt.accord = 106;
  sim(); sim();
  ok(B.r._src === e2, 'un tour de bouton, et on écoute l’autre station');

  // la bande passante : trop large, on prend le voisin avec
  const C = station({ freq:98, accord:98, bp:200 });
  const v = mk('EMET', 320, 260);
  v.opt.pw = 1; v.opt.un = 12; v.opt.freq = 98.4;
  link(C.g, 0, v, 0); link(v, 0, C.m, 0);
  sim(); sim();
  ok(C.r._pur > .95, 'à 200 kHz de bande passante, le voisin est écarté');
  C.r.opt.bp = 4000;
  sim(); sim();
  ok(C.r._pur < .9, 'à 4 000 kHz, il entre par-dessus (' + Math.round((1 - C.r._pur) * 100) + ' % du voisin)');
});

T('T241 AM et FM : ce qui entre ressort, et le bruit ne les touche pas pareil', () => {
  // AM : la porteuse grossit et maigrit
  const A = station({ freq:98, mod:'am', dy:300 });
  const p = mk('POT', -300, 300);
  link(p, 0, A.e, 1);
  const pose = v => { applyInspector(p, fld('o_val', v)); sim(); sim(); };
  pose(80);
  near(A.e._mx, .8, .02, 'l’émetteur lit bien ce qu’on lui donne');
  near(A.r._dem, .8, .12, 'et ça ressort à l’autre bout, sans aucun fil');
  pose(20);
  near(A.r._dem, .2, .12, 'on change la valeur, elle suit');
  ok(A.e._amp < 1, 'en AM, l’amplitude de la porteuse a bien varié');

  // FM : la fréquence bouge, l’amplitude non
  const B = station({ freq:98, mod:'fm', exc:75, dy:300 });
  const q = mk('POT', -300, 300);
  link(q, 0, B.e, 1);
  const poseB = v => { applyInspector(q, fld('o_val', v)); sim(); sim(); };
  poseB(100);
  near(B.e._fem, 98.075, .002, 'au maximum, la fréquence monte de 75 kHz');
  eq(B.e._amp, 1, 'et l’amplitude ne bouge pas d’un poil — c’est toute la FM');
  poseB(0);
  near(B.e._fem, 97.925, .002, 'au minimum, elle descend d’autant');
  poseB(50);
  near(B.r._dem, .5, .05, 'le récepteur retrouve la valeur envoyée');

  /* Le bruit. À la même distance et à la même puissance, l’AM tremble et la
     FM ne bronche pas : c’est la seule raison pour laquelle la FM existe. */
  const C = station({ freq:98, mod:'am', pw:.2, dy:420, seuil:.05 });
  ok(C.r._grese > .1, 'l’AM grésille à cette distance (' + Math.round(C.r._grese * 100) + ' %)');
  let mini = 9, maxi = -9;
  for (let k = 0; k < 40; k++){ sim(); mini = Math.min(mini, C.r._dem); maxi = Math.max(maxi, C.r._dem); }
  ok(maxi - mini > .05, 'et la valeur reçue tremble d’une image à l’autre (' +
     Math.round((maxi - mini) * 100) + ' points)');
  // la FM au MÊME endroit, avec la MÊME puissance
  const D = station({ freq:98, mod:'fm', pw:.2, dy:420, seuil:.05 });
  near(D.r._dist, C.r._dist, .01, 'les deux liaisons font la même distance');
  eq(D.r._grese, 0, 'la FM, elle, est parfaitement propre au même endroit');
  let fmini = 9, fmaxi = -9;
  for (let k = 0; k < 40; k++){ sim(); fmini = Math.min(fmini, D.r._dem); fmaxi = Math.max(fmaxi, D.r._dem); }
  near(fmaxi - fmini, 0, 1e-9, 'pas le moindre tremblement');
  // …jusqu’au décrochage, qui est brutal
  D.r.y += 900;
  sim(); sim();
  eq(D.r._grese, 1, 'plus loin, elle ne se dégrade pas : elle DÉCROCHE d’un coup');
  eq(D.r._fmko, 1, 'et elle retient qu’elle a décroché');
});

T('T242 les repères : les unités, la formule du circuit accordé, la mire', () => {
  eq(fmtMHz(98), '98.0 MHz', 'une fréquence se lit en MHz');
  eq(fmtMHz(.54), '540 kHz', 'et les grandes ondes en kHz');
  eq(fmtMHz(2400), '2.4 GHz', 'et le wifi en GHz');
  eq(fmtKHz(200), '200 kHz', 'un écart d’accord se lit en kHz');
  eq(fmtKHz(4000), '4.0 MHz', 'sauf quand il devient grand');
  /* Le condensateur équivalent : f = 1/(2π√(LC)) avec L = 1 µH. C'est la
     formule du chapitre 33, et le chiffre qu'affiche le récepteur. */
  const C = ondeCapa(98);
  const f = 1 / (2 * Math.PI * Math.sqrt(1e-6 * C));
  near(f / 1e6, 98, .01, 'la formule retombe bien sur la fréquence de départ');
  ok(C > 1e-12 && C < 1e-11, 'et ça fait quelques picofarads, comme en vrai (' + fmtFarad(C) + ')');
  eq(fmtFarad(2.6e-12), '2.6 pF', 'le picofarad s’affiche');

  // la mire : rien de branché, mais l’émetteur envoie quand même quelque chose
  const A = station({ freq:98, mod:'am', dy:300 });
  eq(A.e._mx, null, 'rien n’est branché sur MOD');
  ok(A.e._xeff != null, 'et pourtant il module : c’est la mire d’essai');
  ok(A.r._dem != null, 'le récepteur la reçoit');
  // …et une porteuse nue, elle, ne dit rien
  A.e.opt.mod = 'aucune';
  sim(); sim();
  eq(A.e._xeff, null, 'porteuse nue : rien à transmettre');
  eq(A.r._dem, null, 'et rien à démoduler');
  ok(A.r._uant > .3, 'mais elle arrive quand même — une porteuse, ça se mesure');
});

T('T243 le décor n’est pas un obstacle pour les câbles', () => {
  /* Un cadre de commentaire entoure, un mur arrête les ondes — ni l'un ni
     l'autre ne doit faire dévier un fil. Le mur avait été oublié : mesuré,
     un câble droit de 592 px passait à 892 px avec deux coudes en plus. */
  const trace = obstacle => {
    board();
    const a = mk('PILE', 0, 300), b = mk('INTERP', 700, 300);
    if (obstacle){
      // posé pile en travers : la ligne du fil passe à ENER_Y sous le haut du boîtier
      const o = mk(obstacle, 300, 300);
      if (obstacle === 'MUR'){ o.opt.larg = 96; o.opt.haut = 288; REG.MUR.restore(o); }
    }
    const w = link(a, 0, b, 0);
    sim(); drawScene(0); spreadRoutes();
    let L = 0; const P = w._rp;
    for (let i = 1; i < P.length; i++) L += Math.abs(P[i].x - P[i-1].x) + Math.abs(P[i].y - P[i-1].y);
    return { L:Math.round(L), n:P.length };
  };
  const seul = trace(null);
  eq(trace('ZONE').L, seul.L, 'un cadre ne fait pas dévier le câble');
  const mur = trace('MUR');
  eq(mur.L, seul.L, 'un mur non plus (' + mur.L + ' px contre ' + seul.L + ')');
  eq(mur.n, seul.n, 'et il ne fabrique pas de coudes en plus');
  // un vrai boîtier, lui, doit toujours être contourné
  const boite = trace('RESIS');
  ok(boite.L > seul.L, 'mais un composant posé en travers, oui (' + boite.L + ' px)');
  ok(DECOR.has('ZONE') && DECOR.has('MUR') && !DECOR.has('RESIS'), 'la liste du décor est juste');
});

console.log('\n— 📮 Lot 10 : transmettre quelque chose —');

T('T244 le Morse : la table, la trame, et un aller-retour complet', () => {
  eq(MORSE.S, '...', 'S vaut trois points');
  eq(MORSE.O, '---', 'O vaut trois traits');
  eq(MORSE_INV['.-'], 'A', 'et la table se relit dans l’autre sens');
  eq(Object.keys(MORSE).length, 36, 'les 26 lettres et les 10 chiffres');
  // la trame de « E », la lettre la plus courte : un point, puis le silence de fin
  deq(morseTrame('E'), [1,0,0,0,0,0,0,0], 'un point suivi de sept unités de silence');
  // « SOS » : 5 + 3 + 11 + 3 + 5 + 7 unités
  eq(morseTrame('SOS').length, 34, 'SOS fait 34 unités');
  eq(morseUnite(12), 100, 'à 12 mots/minute, un point dure 100 ms');
  eq(morseNet('sos, à l’aide !'), 'SOS A L AIDE', 'accents et ponctuation deviennent des espaces');

  // l’aller-retour : le manipulateur parle, le décodeur écrit
  board();
  const m = mk('MANIP', 0, 0), d = mk('DECMOR', 400, 0);
  m.opt.msg = 'SOS'; m.opt.wpm = 12; d.opt.wpm = 12;
  link(m, 0, d, 0);
  sim();
  laisseFiler(4200);
  ok(d.txt.indexOf('SOS') >= 0, 'le décodeur a écrit SOS (reçu : « ' + d.txt + ' »)');
  // …et si les deux ne sont pas d’accord sur la vitesse, ça ne veut plus rien dire
  const juste = d.txt;
  d.txt = ''; d.sig = ''; d.opt.wpm = 5;      // le décodeur croit qu’on va deux fois moins vite
  laisseFiler(4200);
  ok(d.txt.indexOf('SOS') < 0,
     'à la mauvaise vitesse, le texte devient illisible (« ' + d.txt + ' » au lieu de « ' + juste + ' »)');
});

T('T245 la trame numérique : un octet bit par bit, et ce qui la casse', () => {
  eq(SERIE_N, 11, 'onze cases : départ, huit bits, deux stop');
  eq(serieBit(0, 0), 1, 'la première case est toujours le bit de départ');
  eq(serieBit(1, 1), 1, 'le bit de poids faible part en premier');
  eq(serieBit(1, 2), 0, 'et les suivants sont à zéro');
  eq(serieBit(128, 8), 1, 'le poids fort part en dernier');
  eq(serieBit(255, 9), 0, 'le stop est un silence');
  eq(serieBin(65), '01000001', 'le binaire s’écrit poids fort à gauche');

  board();
  const e = mk('SERIE', 0, 0), r = mk('DESERIE', 400, 0);
  e.opt.oct = 65; e.opt.baud = 8; r.opt.baud = 8;
  link(e, 0, r, 0);
  sim();
  laisseFiler(4000);
  eq(r.oct, 65, 'la valeur est arrivée entière');
  eq(r.err, 0, 'sans erreur de trame');
  ok(r.nb >= 2, 'et elle s’est répétée (' + r.nb + ' octets reçus)');
  // une autre valeur passe aussi
  e.opt.oct = 200;
  laisseFiler(4000);
  eq(r.oct, 200, 'on change la valeur, elle suit');
  // le mauvais débit : les bits sont lus au mauvais moment
  r.opt.baud = 3; r.oct = 0; r.nb = 0;
  laisseFiler(6000);
  ok(r.oct !== 200 || r.err, 'au mauvais débit, ce qui sort n’a plus rien à voir (' + r.oct + ')');
  // le débit règle bien la durée d’un bit
  e.opt.baud = 4;
  eq(Math.round(1000 / 4), 250, 'à 4 bits/s, un bit dure 250 ms');
});

T('T246 le haut-parleur mesure la fréquence du courant qui le traverse', () => {
  board();
  const g = mk('GENEAC', 0, 0), h = mk('HP', 400, 0), m = mk('MASSE', 800, 0);
  g.opt.hz = 50; g.opt.amp = 12; g.opt.ri = .5; h.opt.z = 8;
  link(g, 0, h, 0); link(h, 0, m, 0); link(m, 0, g, 0);
  sim();
  laisseFiler(1200);
  ok(h._hz > 44 && h._hz < 56, 'il mesure bien 50 Hz (' + h._hz.toFixed(1) + ')');
  ok(h.pcrete > .1, 'et il reçoit de la puissance (' + fmtWatt(h.pcrete) + ')');
  // on change la fréquence de la source : la mesure suit
  g.opt.hz = 20;
  laisseFiler(2000);
  ok(h._hz > 17 && h._hz < 23, 'on descend à 20 Hz, il suit (' + h._hz.toFixed(1) + ')');
  // du continu ne fait aucun son
  board();
  const p = mk('PILE', 0, 0), h2 = mk('HP', 400, 0), m2 = mk('MASSE', 800, 0);
  link(p, 0, h2, 0); link(h2, 0, m2, 0); link(m2, 0, p, 0);
  sim(); laisseFiler(600);
  near(h2._hz, 0, 1e-9, 'du courant continu ne fait pas de son');
  ok(h2.p > .1, 'alors qu’il consomme bel et bien (' + fmtWatt(h2.p) + ')');
  eq(fmtHz(50), '50 Hz', 'une fréquence audible se lit en Hz');
  eq(fmtHz(1200), '1.2 kHz', 'et les aigus en kHz');

  /* La crête d'un circuit alternatif se mesure pendant les SOUS-PAS, pas une
     fois par image. Le piège : une image de 60 ms tombe exactement trois fois
     par période sur du 50 Hz — donc toujours au même endroit de la sinusoïde,
     et si cet endroit est un passage par zéro, la crête mesurée valait zéro. */
  board();
  const g3 = mk('GENEAC', 0, 0), h3 = mk('HP', 400, 0), m3 = mk('MASSE', 800, 0);
  g3.opt.hz = 50; g3.opt.amp = 12; g3.opt.ri = .5; h3.opt.z = 8;
  link(g3, 0, h3, 0); link(h3, 0, m3, 0); link(m3, 0, g3, 0);
  sim();
  laisseFiler(1200, 60);                       // 60 ms pile : trois périodes par image
  near(h3.p, 0, .05, 'à cette cadence, l’instant tombe toujours sur le zéro');
  ok(h3.pcrete > 5, 'et pourtant la crête est juste (' + fmtWatt(h3.pcrete) +
     ') — elle est prise sur les sous-pas');
  ok(h3.icrete > .8, 'le courant crête aussi (' + fmtAmp(h3.icrete) + ')');
});

T('T247 les cinq pièces du lot 10 sont complètes et rangées', () => {
  ['MANIP', 'DECMOR', 'SERIE', 'DESERIE', 'HP'].forEach(t => {
    const d = REG[t];
    ok(d, t + ' est au registre');
    ok(d.guide && d.guide.txt.length > 40, t + ' a son entrée de guide');
    ok(TOOL_TABS.some(x => x.items.includes(t)), t + ' est rangé dans un onglet');
    board(); mk(t, 100, 100); sim(); drawScene(0);
  });
  // les quatre qui déroulent une séquence sont marqués séquentiels : sans ça,
  // la vérification en continu les prendrait pour de la logique combinatoire
  ['MANIP', 'DECMOR', 'SERIE', 'DESERIE'].forEach(t =>
    ok(REG[t].seq, t + ' est marqué séquentiel'));
  // aucun n’est une « entrée » : sinon les montages de référence les refuseraient
  ['MANIP', 'SERIE'].forEach(t =>
    ok(!INPUT_TYPES.includes(t), t + ' n’est pas classé comme entrée'));
  const on = TOOL_TABS.find(t => t.key === 'onde');
  ok(on.items.length >= 8 && on.items.length <= 11,
     'l’onglet La radio ne déborde pas (' + on.items.length + ' tuiles)');
  // le son ne part jamais pendant une vérification, ni sur un plan effacé
  ok(__HTML.includes('if (simulating || hz < 25'), 'le haut-parleur se tait pendant une vérification');
});

console.log('\n— 🔧 Lot A : ce qui se voit tout de suite —');

T('T248 le fil annonce à l’avance ce qu’il va faire — et il dit vrai', () => {
  /* `canConnect` prédit, `connectWire` juge. S'ils divergent, l'annonce est
     pire que pas d'annonce du tout : ce test les met face à face. */
  const essaie = (a, b) => {
    const n = wires.length;
    const dit = canConnect(a, b);
    relierBornes(a, b);
    const fait = wires.length > n;
    return { dit:dit.etat, fait };
  };
  board();
  const g1 = mk('AND', 0, 0), g2 = mk('AND', 300, 0), l = mk('LED', 600, 0);
  let r = essaie(g1.outPins[0], g2.inPins[0]);
  eq(r.dit, 'oui', 'sortie vers entrée : annoncé possible');
  eq(r.fait, true, '…et ça marche');
  r = essaie(g1.outPins[0], g2.outPins[0]);
  eq(r.dit, 'non', 'deux sorties logiques : annoncé impossible');
  eq(r.fait, false, '…et ça ne marche pas');
  r = essaie(g1.inPins[0], g2.inPins[0]);
  eq(r.dit, 'non', 'deux entrées logiques non plus');
  eq(r.fait, false, '…confirmé');
  // une entrée déjà occupée : le fil sera REMPLACÉ, et on le dit
  const v = canConnect(l.outPins ? g1.outPins[0] : null, g2.inPins[0]);
  eq(v.etat, 'remplace', 'une entrée déjà câblée annonce un remplacement');
  ok(v.vieux && v.vieux.inPin === g2.inPins[0], 'et elle désigne le fil qui va disparaître');
  // les bornes de puissance, elles, se relient dans tous les sens
  board();
  const a = mk('LAMPE', 0, 0), b = mk('LAMPE', 300, 0);
  r = essaie(a.inPins[0], b.inPins[0]);
  eq(r.dit, 'oui', 'deux entrées de PUISSANCE : annoncé possible');
  eq(r.fait, true, '…et ça marche');
  eq(canConnect(a.inPins[0], b.inPins[0]).etat, 'deja', 'refaire le même fil : déjà relié');
  // les natures différentes
  board();
  const p = mk('AND', 0, 0), q = mk('LAMPE', 300, 0);
  eq(canConnect(p.outPins[0], q.inPins[0]).etat, 'non', 'signal vers puissance : non');
  ok(canConnect(p.outPins[0], q.inPins[0]).quoi.length > 10, 'et on dit pourquoi');
  eq(canConnect(p.outPins[0], null).etat, 'rien', 'rien sous le curseur : rien à dire');
  eq(canConnect(p.outPins[0], p.outPins[0]).etat, 'rien', 'la borne de départ non plus');
  // chaque verdict a sa couleur
  ['oui', 'remplace', 'deja', 'non'].forEach(k =>
    ok(/^#[0-9a-f]{6}$/i.test(CONNECT_COUL[k]), k + ' a une couleur'));
});

T('T249 les cibles de clic se mesurent en pixels d’écran', () => {
  board();
  touchMode = false;                            // un test plus haut a touché l'écran
  const g = mk('AND', 0, 0);
  const pin = g.outPins[0];
  const zAvant = cam.z;
  const loin = (d) => pin.isHit(pin.x + d, pin.y);
  cam.z = 1;
  ok(loin(10), 'à zoom normal, on attrape la broche à 10 unités');
  ok(!loin(30), 'mais pas à 30');
  cam.z = .35;                                  // vue reculée : le zoom minimum
  ok(loin(30), 'en vue reculée, la zone sensible s’agrandit sur le plan…');
  ok(!loin(60), '…sans devenir absurde');
  cam.z = 2.5;                                  // vue rapprochée
  ok(loin(pin.r + 3), 'en vue rapprochée elle ne descend jamais sous le dessin');
  // 14 px d’écran, quel que soit le zoom : c’est ça qu’on a voulu
  cam.z = 1;   const a = tolPin();
  cam.z = .5;  const b = tolPin();
  near(b, a * 2, .01, 'deux fois plus reculé, deux fois plus large sur le plan');
  touchMode = true; const c = tolPin(); touchMode = false;
  ok(c > b, 'et un doigt a droit à une cible plus grande qu’une souris');
  cam.z = zAvant;
});

T('T250 le magnétisme : même ressenti à tous les zooms, et Alt le coupe', () => {
  board();
  const fixe = mk('AND', 400, 200), bouge = mk('AND', 0, 500);
  const essaie = (dy) => { alignAccroche = { x:null, y:null };
                           return Math.round(alignGuides(bouge, 0, fixe.y + dy).y - fixe.y); };
  cam.z = 1;
  eq(essaie(5), 0, 'à 5 unités du repère, ça s’accroche');
  eq(essaie(11), 11, 'à 11, non — le seuil de prise est à 8');
  // l’hystérésis : une fois collé, on ne décroche pas au premier frémissement
  alignAccroche = { x:null, y:null };
  alignGuides(bouge, 0, fixe.y + 5);
  ok(alignAccroche.y != null, 'on est bien collé');
  eq(Math.round(alignGuides(bouge, 0, fixe.y + 11).y - fixe.y), 0,
     'à 11 on tient encore : c’est l’hystérésis');
  eq(Math.round(alignGuides(bouge, 0, fixe.y + 16).y - fixe.y), 16, 'à 16 on lâche');
  // le même geste, en vue reculée : le seuil suit le zoom
  cam.z = .5;
  eq(essaie(14), 0, 'à moitié de zoom, 14 unités valent 7 pixels d’écran : ça accroche');
  cam.z = 1;
  // Alt coupe tout
  keysDown.add('ALT');
  eq(essaie(2), 2, 'Alt appuyé : plus rien n’attire');
  keysDown.delete('ALT');
  eq(essaie(2), 0, 'relâché : ça revient');
});

T('T251 la table de vérité n’est plus rejouée pour rien', () => {
  const tt = missions.findIndex(m => m.tt && m.tt.length && !m.bb && m.inputs === 1 && m.outputs === 1);
  ok(tt >= 0, 'il existe une leçon à une entrée et une sortie');
  loadMission(tt);
  const sw = mk('SWITCH', 0, 0), nt = mk('NOT', 300, 0), le = mk('LED', 600, 0);
  link(sw, 0, nt, 0); link(nt, 0, le, 0);
  sim();
  liveT = 0; liveTick();
  const vrai = liveRes;
  ok(vrai, 'un premier passage a bien calculé quelque chose');
  // rien n’a bougé : on ne recalcule pas
  liveRes = 'SENTINELLE'; liveT = 0; liveTick();
  eq(liveRes, 'SENTINELLE', 'circuit inchangé : la table n’est PAS rejouée');
  // basculer un interrupteur ne change rien non plus — la vérification pilote
  // elle-même les entrées, leur état n’entre pas dans son résultat
  sw.state = sw.state ? 0 : 1; liveT = 0; liveTick();
  eq(liveRes, 'SENTINELLE', 'un interrupteur basculé ne relance rien');
  // en revanche, toucher au circuit relance
  liveRes = vrai;
  markDirty();
  liveT = 0; liveTick();
  ok(liveRes !== 'SENTINELLE' && liveRes, 'le circuit modifié : on recalcule');
  loadMission(-1);
});

T('T252 la signature des tracés voit aussi la taille', () => {
  board();
  const z = mk('ZONE', 0, 0);
  const avant = compSig();
  z.w = 800; z.opt.larg = 800;
  __advance(16); sim();
  ok(compSig() !== avant, 'étirer un cadre réveille le cache des tracés');
  const b = compSig();
  z.x += 32;
  __advance(16); sim();
  ok(compSig() !== b, 'le déplacer aussi, comme avant');
});

/* ===================== bilan ===================== */
console.log('\n' + (__fail ? '✗' : '✓') + ' ' + __pass + ' test(s) réussi(s), ' +
            __fail + ' échec(s)' + (__fail ? ' : ' + __failures.join(', ') : '') + '\n');
return { passed: __pass, failed: __fail };
}
