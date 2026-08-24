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
  [['Deux ateliers', 'les deux modes de palette'],
   ['unités réelles', 'les réglages en unité physique'],
   ['% de l’échelle', 'le repli en pourcentage'],
   ['seuil haut', 'le seuil haut des capteurs'],
   ['seuil bas', 'le seuil bas des capteurs'],
   ['raccord fluide', 'la tuyauterie'],
   ['GRAFCET', 'le GRAFCET'],
   ['réceptivité', 'les réceptivités'],
   ['CEI 60848', 'la norme du GRAFCET'],
   ['CEI 60073', 'les couleurs normalisées des voyants'],
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

T('T149 deux ateliers : la palette se filtre en électronique ou en process', () => {
  const noms = () => modeTabs().map(t => t.key);
  setAppMode('tout');
  ok(noms().includes('gate') && noms().includes('act'), 'mode Tout : toute la palette');
  setAppMode('elec');
  ok(noms().includes('gate') && noms().includes('calc'), 'électronique : portes et calcul');
  ok(!noms().includes('act') && !noms().includes('reg'),
     'électronique : ni actionneurs ni régulation');
  ok(noms().includes('sense') && noms().includes('in'), 'les entrées et capteurs restent partout');
  setAppMode('proc');
  ok(noms().includes('act') && noms().includes('reg'), 'process : actionneurs et régulation');
  ok(!noms().includes('gate'), 'process : pas de portes dans la palette');
  eq(localStorage.getItem('al2_mode'), 'proc', 'le choix est mémorisé');
  // la recherche reste universelle : rien n'est jamais hors d'atteinte
  ok(searchTypes('nand').includes('NAND'), 'la recherche traverse les deux ateliers');
  ok(searchTypes('pompe').includes('PUMP'), 'et retrouve aussi le procédé');
  // l'onglet courant est ramené dans le domaine du mode
  toolbarTab = 99; buildToolbar();
  ok(toolbarTab < modeTabs().length, 'onglet ramené dans le mode');
  setAppMode('tout');
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

T('T154 GRAFCET : étapes, réceptivités, temporisation et rebouclage', () => {
  board();
  const g = mk('GRAFCET', 0, 0);
  const r1 = mk('SWITCH', -300, 0), r2 = mk('SWITCH', -300, 100);
  link(r1, 0, g, 0); link(r2, 0, g, 1);
  applyInspector(g, fld('o_nb', 3));
  eq(grNb(g), 3, 'trois étapes');
  // par défaut le cycle est linéaire et reboucle
  eq(grStep(g, 0).cible, 1, 'X0 → X1'); eq(grStep(g, 2).cible, 0, 'la dernière reboucle');
  // X0 attend R1
  const gr = (i, ch, v) => applyInspector(g, Object.assign(fld('x', v), { dataset:{ gr:i + ',' + ch } }));
  gr(0, 'cond', 'R1'); gr(1, 'cond', 'R2'); gr(2, 'cond', '1'); gr(2, 'tempo', 1);
  sim();
  eq(g.et, 0, 'on démarre sur l’étape initiale');
  eq(g.outPins[0].state, 1, 'X0 est actif');
  eq(g.outPins[1].state, 0, 'et lui seul');
  // R1 encore à 0 : rien ne bouge, même après du temps
  for (let i = 0; i < 5; i++){ __advance(200); sim(); }
  eq(g.et, 0, 'sans réceptivité, l’étape ne passe pas — c’est ça, « l’automate attend »');
  r1.state = 1; __advance(100); sim();
  eq(g.et, 1, 'R1 franchit la transition');
  sim();                                   // le franchissement se publie au cycle suivant
  eq(g.outPins[1].state, 1, 'X1 prend le relais');
  eq(g.outPins[0].state, 0, 'et X0 s’éteint : une seule étape active');
  r1.state = 0; r2.state = 1; __advance(100); sim();
  eq(g.et, 2, 'R2 fait avancer à X2');
  // X2 : réceptivité toujours vraie mais temporisée à 1 s
  __advance(300); sim();
  eq(g.et, 2, 'la temporisation retient l’étape');
  for (let i = 0; i < 6; i++){ __advance(200); sim(); }
  eq(g.et, 0, 'après 1 s, la transition est franchie et le cycle reboucle');
  // INIT ramène à l’étape initiale depuis n’importe où
  r1.state = 1; __advance(100); sim();
  eq(g.et, 1, 'reparti dans le cycle');
  const ini = mk('SWITCH', -300, 200); link(ini, 0, g, 4);
  ini.state = 1; __advance(100); sim();
  eq(g.et, 0, 'INIT ramène à l’étape initiale');
});

T('T155 GRAFCET : choix de séquence, mémoire d’étape et broches alignées', () => {
  board();
  const g = mk('GRAFCET', 0, 0);
  const a = mk('SWITCH', -300, 0), b = mk('SWITCH', -300, 100);
  link(a, 0, g, 0); link(b, 0, g, 1);
  applyInspector(g, fld('o_nb', 4));
  const gr = (i, ch, v) => applyInspector(g, Object.assign(fld('x', v), { dataset:{ gr:i + ',' + ch } }));
  // depuis X0 : R1 → X1 (pièce bonne), sinon R2 → X3 (rebut)
  gr(0, 'cond', 'R1'); gr(0, 'cible', 1);
  gr(0, 'alt', 'R2');  gr(0, 'altCible', 3);
  sim();
  b.state = 1; __advance(100); sim();
  eq(g.et, 3, 'la branche « OU BIEN » aiguille vers l’étape 3');
  // retour et vérification de la branche principale
  applyInspector(g, Object.assign(fld('x', 0), { dataset:{ gr:'3,cible' } }));
  b.state = 0; gr(3, 'cond', '1'); __advance(100); sim();
  eq(g.et, 0, 'retour à l’étape initiale');
  a.state = 1; __advance(100); sim();
  eq(g.et, 1, 'la branche principale reste prioritaire');
  // l'étape courante voyage avec le montage
  const data = serializeGroup([g]);
  board();
  const copie = spawnGroup(data, 0, 0, true).made[0];
  eq(copie.et, 1, 'l’étape active est sauvegardée');
  eq(grStep(copie, 0).alt, 'R2', 'et la table des transitions aussi');
  // la broche Xn est à la hauteur de la case n
  eq(Math.round(copie.outPins[0].ly - copie.y), 30, 'X0 en face de l’étape 0');
  eq(Math.round(copie.outPins[2].ly - copie.outPins[1].ly), GR_PAS, 'un pas d’étape entre deux broches');
  // le boîtier grandit avec le nombre d'étapes
  const h4 = copie.h;
  applyInspector(copie, fld('o_nb', 6));
  ok(copie.h > h4, 'six étapes : le boîtier s’allonge');
});

T('T156 l’exemple « Perceuse en GRAFCET » enchaîne son cycle', () => {
  board();
  const ex = EXAMPLES.find(e => e.name === 'Perceuse en GRAFCET');
  ok(!!ex, 'exemple présent');
  const m = spawnGroup(ex.data, 0, 0, true).made;
  const g = m[0], dep = m[1], ver = m[2];
  sim();
  eq(g.et, 0, 'au repos sur l’étape initiale');
  // le vérin ne bouge pas tant qu’on n’a pas donné le départ
  for (let i = 0; i < 5; i++){ __advance(150); sim(); }
  eq(g.et, 0, 'sans départ, rien ne se passe');
  ok(ver.pos < 0.05, 'la broche est en haut');
  dep.state = 1; __advance(100); sim(); sim();
  eq(g.et, 1, 'départ donné : descente');
  dep.state = 0;
  // on suit le cycle complet en relevant chaque changement d'étape
  const vues = [g.et], tps = {};
  let t0 = Date.now();
  for (let i = 0; i < 220; i++){
    __advance(60); sim();
    if (g.et !== vues[vues.length - 1]){
      tps[vues[vues.length - 1]] = Date.now() - t0; t0 = Date.now();
      vues.push(g.et);
      if (vues.length > 4) break;
    }
  }
  deq(vues.slice(0, 5), [1, 2, 3, 0], 'le cycle s’enchaîne 1 → 2 → 3 → 0');
  ok(tps[2] >= 2000, 'l’étape de perçage a bien duré 2 s (' + tps[2] + ' ms)');
  ok(tps[1] > 1500 && tps[1] < 3500, 'la descente attend le capteur bas (' + tps[1] + ' ms)');
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
    // deux câbles ne doivent pas viser la même entrée
    const cibles = (lay.wires || []).map(w => w[2] + ':' + w[3]);
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

/* ===================== bilan ===================== */
console.log('\n' + (__fail ? '✗' : '✓') + ' ' + __pass + ' test(s) réussi(s), ' +
            __fail + ' échec(s)' + (__fail ? ' : ' + __failures.join(', ') : '') + '\n');
return { passed: __pass, failed: __fail };
}
