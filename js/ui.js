'use strict';
/* Bêtes de Papier — interface (écrans, HUD, tutoriel, succès, modes).
   Ne dépend d'aucun autre module de façon dure : chaque appel externe est gardé. */
window.BP = window.BP || {};
(function (BP) {

  /* ------------------------------------------------------------------ outils */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    }
    if (html !== undefined && html !== null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /** Découpe un texte (chaîne avec \n\n, ou tableau) en paragraphes. */
  function paras(txt) {
    if (!txt) return [];
    if (Array.isArray(txt)) return txt.map(function (t) { return String(t).trim(); }).filter(Boolean);
    return String(txt).split(/\n\s*\n|\n/).map(function (t) { return t.trim(); }).filter(Boolean);
  }
  /** « touchez » sur tactile, « cliquez » à la souris. */
  function tapWord() {
    try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches ? 'cliquez' : 'touchez'; }
    catch (e) { return 'touchez'; }
  }
  function num2(v) { return (v || 0).toFixed(2).replace('.', ','); }
  function pct(v) { return (Math.round((v || 0) * 1000) / 10).toFixed(1).replace('.', ',') + ' %'; }
  function pct0(v) { return Math.round((v || 0) * 100) + ' %'; }
  function dateHuman(key) {
    var s = String(key);
    if (s.length !== 8) return s;
    var d = new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
    try {
      return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return s.slice(6, 8) + '/' + s.slice(4, 6) + '/' + s.slice(0, 4); }
  }

  /* ------------------------------------------------------------- sauvegarde */

  var DEF_SETTINGS = { music: 0.7, sfx: 0.9, muted: false, reduceMotion: false, sideView: true };
  var localFallback = null;

  function blankSave() {
    return {
      levels: {}, achievements: {}, settings: JSON.parse(JSON.stringify(DEF_SETTINGS)),
      improv: {}, tournee: { best: 0, bestScore: 0 }, seen: {}
    };
  }
  function normalize(s) {
    if (!s || typeof s !== 'object') s = blankSave();
    if (!s.levels) s.levels = {};
    if (!s.achievements) s.achievements = {};
    if (!s.improv) s.improv = {};
    if (!s.tournee) s.tournee = { best: 0, bestScore: 0 };
    if (!s.seen) s.seen = {};
    if (!s.shapesUsed) s.shapesUsed = {};
    if (!s.fails) s.fails = {};
    var st = s.settings || {};
    for (var k in DEF_SETTINGS) if (st[k] === undefined) st[k] = DEF_SETTINGS[k];
    s.settings = st;
    return s;
  }
  function hasCoreSave() { return !!(BP.save && BP.save.get && BP.save.set); }
  function readLocal() {
    if (localFallback) return localFallback;
    try { localFallback = normalize(JSON.parse(localStorage.getItem('bp_save_v1') || 'null')); }
    catch (e) { localFallback = blankSave(); }
    return localFallback;
  }
  function writeLocal() {
    try { localStorage.setItem('bp_save_v1', JSON.stringify(localFallback)); } catch (e) { /* ignore */ }
  }
  /** Lecture normalisée de la sauvegarde. */
  function S() {
    if (hasCoreSave()) { try { return normalize(BP.save.get()); } catch (e) { /* ignore */ } }
    return readLocal();
  }
  /** Mutation persistée. */
  function SAVE(fn) {
    if (hasCoreSave()) {
      try { BP.save.set(function (s) { fn(normalize(s)); }); return; } catch (e) { /* ignore */ }
    }
    fn(readLocal()); writeLocal();
  }
  function resetSave() {
    if (BP.save && BP.save.reset) { try { BP.save.reset(); } catch (e) { /* ignore */ } }
    localFallback = blankSave(); writeLocal();
    try { localStorage.removeItem('bp_save_v1'); } catch (e) { /* ignore */ }
    localFallback = null;
  }
  function lvlSave(id) {
    var r = S().levels[id];
    return r || { best: 0, stars: 0, bestMoves: 0, done: false };
  }

  /* ------------------------------------------------------------------ textes */

  var FALLBACK = {
    tagline: 'Un théâtre d’ombres où ce que le public croit voir devient une arme.',
    acts: [
      { title: 'Les foires', intro: 'La route sent la poussière et la résine.\n\nOn tend le drap entre deux charrettes, on allume la lampe, et les enfants s’assoient devant.' },
      { title: 'Les villes fermées', intro: 'Les portes des villes se ferment tôt, désormais.\n\nCe que nul ne peut écrire, la troupe le fait passer en ombres.' },
      { title: 'Le procès', intro: 'La salle est haute et froide. Le drap n’a jamais paru si petit.\n\nTrois regards, trois histoires. Il faut les tenir toutes.' }
    ],
    tutorial: {
      move: 'Faites glisser une découpe du coffre vers le drap, puis promenez son ombre au doigt.',
      depth: 'Approchez la découpe de la lampe : son ombre grandit sur place. Éloignez-la : elle rétrécit.',
      rotate: 'Tournez la découpe par quarts de quinze degrés jusqu’à ce que l’ombre tombe juste.',
      tilt: 'Basculez la découpe de profil : son ombre s’amincit sans changer de hauteur.',
      flip: 'Le miroir retourne la découpe : la patte gauche devient la patte droite.',
      oiled: 'Le papier huilé ne donne qu’une ombre grise. Deux épaisseurs superposées font du noir.',
      twolamps: 'Deux lampes, deux ombres. Un verre rouge ne montre que l’ombre de la lampe rouge.',
      performance: 'En représentation, le tambour bat : la cible change à chaque frappe. Tenez la ressemblance.',
      target: 'Le fantôme à la craie est la bête que le conteur nomme. Recouvrez-le d’ombre.',
      umbra: 'À l’œil nu, on ne lit que l’ombre franche : la part que les deux lampes noircissent ensemble.'
    },
    endings: [
      { title: 'La lampe soufflée', text: 'Le tribunal n’a vu qu’un barbouillage. On range le coffre sans un mot, et la route reprend, plus étroite.' },
      { title: 'Le doute semé', text: 'Le juge a vu son conte, la foule a vu autre chose. Personne ne saura dire quoi — mais on en parlera longtemps.' },
      { title: 'Les trois lectures', text: 'Le juge applaudit un conte pour enfants ; la foule lit l’accusation ; Iva, derrière ses barreaux, compte les pas de son évasion.' }
    ],
    credits: 'Bêtes de Papier — un théâtre d’ombres de poche.\nOmbres, papier et lumière : tout est dessiné et joué en direct par votre machine.'
  };

  function story() { return BP.story || {}; }
  function gameTitle() { return story().gameTitle || 'Bêtes de Papier'; }
  function tagline() { return story().tagline || story().subtitle || FALLBACK.tagline; }
  /** Retourne l'entrée d'acte n (1..3) quel que soit l'indexage choisi par story.js. */
  function actStory(n) {
    var a = story().acts, found = null;
    if (a) {
      if (Array.isArray(a)) {
        for (var i = 0; i < a.length; i++) if (a[i] && (a[i].act === n || a[i].id === n)) { found = a[i]; break; }
        if (!found) found = a[n] || a[n - 1] || null;
      } else found = a[n] || a['act' + n] || a[String(n)] || null;
    }
    var fb = FALLBACK.acts[n - 1] || { title: 'Acte ' + n, intro: '' };
    return {
      title: (found && (found.title || found.name)) || fb.title,
      intro: (found && (found.intro || found.text)) || fb.intro
    };
  }
  function tutoText(name) {
    var t = story().tutorial || story().tutorials || {};
    var v = t[name];
    if (v && typeof v === 'object') v = v.text || v.body || v.intro;
    return v || FALLBACK.tutorial[name] || '';
  }
  function tutoTitle(name) {
    var t = story().tutorial || story().tutorials || {};
    var v = t[name];
    if (v && typeof v === 'object' && v.title) return v.title;
    var map = {
      move: 'Poser une découpe', depth: 'La profondeur', rotate: 'La rotation', tilt: 'Le basculement',
      flip: 'Le miroir', oiled: 'Le papier huilé', twolamps: 'Deux lampes', performance: 'La représentation',
      target: 'La cible', umbra: 'L’ombre franche'
    };
    return map[name] || 'Le métier';
  }

  /* ------------------------------------------------------------------ icônes */

  var I = {
    play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
    dice: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.3"/><circle cx="15" cy="15" r="1.3"/><circle cx="15" cy="9" r="1.3"/><circle cx="9" cy="15" r="1.3"/></svg>',
    road: '<svg viewBox="0 0 24 24"><path d="M9 3v18M15 3v18"/><path d="M4 21c2-6 2-12 0-18M20 21c-2-6-2-12 0-18"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/><path d="M12 14v4M8 20h8"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M14 5l-7 7 7 7"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    bigger: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="14" height="14" rx="1.5"/><path d="M14 3h7v7M21 3l-7 7"/></svg>',
    smaller: '<svg viewBox="0 0 24 24"><rect x="7" y="9" width="10" height="10" rx="1.5"/><path d="M21 3l-6 6M15 3h6v6" /></svg>',
    rotL: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 1 3 6.2"/><path d="M4 5v6h6"/></svg>',
    rotR: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 0-3 6.2"/><path d="M20 5v6h-6"/></svg>',
    tilt: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="6" height="14" rx="1"/><path d="M13 5v14M18 8v8M21.5 10v4"/></svg>',
    flip: '<svg viewBox="0 0 24 24"><path d="M12 3v18" stroke-dasharray="3 3"/><path d="M9 6L4 12l5 6z"/><path d="M15 6l5 6-5 6z"/></svg>',
    remove: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M8 7l1 13h6l1-13"/></svg>',
    undo: '<svg viewBox="0 0 24 24"><path d="M4 9h11a5 5 0 0 1 0 10h-4"/><path d="M8 5L4 9l4 4"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>',
    target: '<svg viewBox="0 0 24 24"><path d="M12 4c4 3 6 5.5 6 9a6 6 0 0 1-12 0c0-3.5 2-6 6-9z" stroke-dasharray="3 2.5"/><circle cx="12" cy="13" r="2"/></svg>',
    hint: '<svg viewBox="0 0 24 24"><path d="M9 17h6M10 20h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6h5.4c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    lens: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 5v14"/></svg>',
    both: '<svg viewBox="0 0 24 24"><circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/></svg>',
    curtain: '<svg viewBox="0 0 24 24"><path d="M3 4h18"/><path d="M6 4c0 6 2 10 0 16M12 4c0 6-2 10 0 16M18 4c0 6 2 10 0 16"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    star: '<svg viewBox="0 0 24 24" class="star-svg"><path d="M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.9l6-.8z"/></svg>'
  };

  /* ------------------------------------------------------------------ succès */

  var ACHIEVEMENTS = [
    { id: 'premier_rideau', name: 'Premier rideau', desc: 'Réussir votre premier tableau.' },
    { id: 'minimaliste', name: 'Minimaliste', desc: 'Une ovation en moins de manipulations que le par.' },
    { id: 'sans_retour', name: 'Sans retour', desc: 'Une ovation sans jamais annuler.' },
    { id: 'ovation', name: 'Ovation', desc: 'Décrocher trois étoiles sur un tableau.' },
    { id: 'acte1', name: 'Les foires', desc: 'Terminer l’acte I.' },
    { id: 'acte2', name: 'Les villes fermées', desc: 'Terminer l’acte II.' },
    { id: 'acte3', name: 'Le procès', desc: 'Terminer l’acte III.' },
    { id: 'double_lecture', name: 'Double lecture', desc: 'Réussir un tableau éclairé par deux lampes.' },
    { id: 'trois_lectures', name: 'Trois lectures', desc: 'Dans la finale, tenir chaque lecture au-dessus de 95 %.' },
    { id: 'oeil_de_lynx', name: 'Œil de lynx', desc: 'Atteindre 99,5 % de ressemblance.' },
    { id: 'improvisateur', name: 'Improvisateur', desc: 'Réussir une improvisation du jour.' },
    { id: 'tournee_5', name: 'Cinq étapes', desc: 'Tenir cinq étapes d’une tournée.' },
    { id: 'tournee_10', name: 'Dix étapes', desc: 'Tenir dix étapes d’une tournée.' },
    { id: 'repertoire', name: 'Répertoire', desc: 'Trois étoiles sur tous les tableaux de la tournée.' },
    { id: 'coffre_ouvert', name: 'Coffre ouvert', desc: 'Avoir posé chaque découpe du coffre familial au moins une fois.' },
    { id: 'patient', name: 'Patient', desc: 'Réussir un tableau à force d’acharnement.' }
  ];

  function grant(id) {
    var s = S();
    if (s.achievements[id]) return;
    var def = null;
    for (var i = 0; i < ACHIEVEMENTS.length; i++) if (ACHIEVEMENTS[i].id === id) def = ACHIEVEMENTS[i];
    if (!def) return;
    SAVE(function (sv) { sv.achievements[id] = Date.now(); });
    toast(def);
    if (BP.audio && BP.audio.sfx) BP.audio.sfx('achievement');
  }

  var toastTimer = null;
  function toast(def) {
    var box = $('#toast');
    if (!box) return;
    box.innerHTML = '<div class="toast-card"><span class="toast-ic">' + I.trophy + '</span>' +
      '<span class="toast-txt"><b>' + esc(def.name) + '</b><i>' + esc(def.desc) + '</i></span></div>';
    box.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove('show'); }, 4200);
  }

  /** Vérifications déclenchées à la fin d'un tableau. */
  function checkAchievements(ctx) {
    var lv = ctx.level || {}, st = ctx.state || {}, s = S();
    var score = ctx.score || 0, stars = ctx.stars || 0, moves = ctx.moves || 0;
    var par = lv.par || 0, mode = ctx.mode || 'story';

    if (score >= 0.995) grant('oeil_de_lynx');
    if (stars >= 3) grant('ovation');
    if (score >= (BP.GOLD || 0.97)) {
      if (par && moves < par) grant('minimaliste');
      if (!st.undoCount) grant('sans_retour');
    }
    if (mode === 'story') {
      grant('premier_rideau');
      if (lv.lamps && lv.lamps.length >= 2) grant('double_lecture');
      if ((moves >= 40) || ((s.fails && s.fails[lv.id]) || 0) >= 3) grant('patient');
      checkActs();
      checkRepertoire();
      if (lv.act === 3 && lv.type === 'performance') {
        var rs = lv.readings || [], ok = rs.length > 0, sc = (st.scores || ctx.scores || {});
        for (var i = 0; i < rs.length; i++) if (!(sc[rs[i]] >= 0.95)) ok = false;
        if (ok) grant('trois_lectures');
      }
    }
    if (mode === 'improv') grant('improvisateur');
    checkCoffre();
  }

  function actLevels(n) {
    var out = [];
    if (BP.levels && BP.levels.all) {
      BP.levels.all.forEach(function (l) { if (l.act === n) out.push(l); });
    } else if (BP.levels && BP.levels.acts) {
      BP.levels.acts.forEach(function (a) { if (a.act === n) out = (a.levels || []).slice(); });
    }
    return out;
  }
  function checkActs() {
    var s = S();
    [1, 2, 3].forEach(function (n) {
      var ls = actLevels(n);
      if (!ls.length) return;
      var all = ls.every(function (l) { return s.levels[l.id] && s.levels[l.id].done; });
      if (all) grant('acte' + n);
    });
  }
  function checkRepertoire() {
    var s = S(), all = (BP.levels && BP.levels.all) || [];
    if (!all.length) return;
    var ok = all.every(function (l) { return s.levels[l.id] && s.levels[l.id].stars >= 3; });
    if (ok) grant('repertoire');
  }
  function noteShapesUsed() {
    if (!(BP.engine && BP.engine.getState)) return;
    var st = null; try { st = BP.engine.getState(); } catch (e) { return; }
    if (!st || !st.pieces || !st.pieces.length) return;
    var s = S(), fresh = false;
    st.pieces.forEach(function (p) { if (p && p.shape && !s.shapesUsed[p.shape]) fresh = true; });
    if (!fresh) return;
    SAVE(function (sv) {
      st.pieces.forEach(function (p) { if (p && p.shape) sv.shapesUsed[p.shape] = true; });
    });
  }
  function checkCoffre() {
    var list = (BP.shapes && BP.shapes.list) || [];
    if (!list.length) return;
    var s = S();
    for (var i = 0; i < list.length; i++) if (!s.shapesUsed[list[i]]) return;
    grant('coffre_ouvert');
  }

  /* --------------------------------------------------------------- état d'UI */

  var app, stageWrap, stageCanvas, hud, screensEl, tutoLayer;
  var mounted = false;
  var ctx = {              // contexte courant
    mode: 'story',         // 'story' | 'improv' | 'tournee'
    level: null,
    improvKey: null,
    tour: null,            // { seed, stage, total, scores:[] }
    optionsFrom: 'title',
    lastResult: null,
    playing: false,
    extra: [],             // contrôles déverrouillés en cours de tableau
    curtainUp: false,      // représentation démarrée
    score: 0, scores: {}
  };
  var rafId = 0;

  function A(name) { if (BP.audio && BP.audio[name]) return BP.audio[name].apply(BP.audio, [].slice.call(arguments, 1)); }
  function sfx(n) { A('sfx', n); }
  function E(name, arg) {
    if (BP.engine && BP.engine.act) { try { BP.engine.act(name, arg); } catch (e) { console.error('[ui] act ' + name, e); } }
  }
  function engineState() {
    if (BP.engine && BP.engine.getState) { try { return BP.engine.getState() || {}; } catch (e) { return {}; } }
    return {};
  }

  /* ------------------------------------------------------------ gestion écran */

  function showScreen(name, build) {
    stopPlayLoop();
    screensEl.innerHTML = '';
    screensEl.hidden = false;
    document.body.setAttribute('data-screen', name);
    var sec = el('section', { 'class': 'screen screen-' + name, 'data-name': name });
    screensEl.appendChild(sec);
    build(sec);
    sec.scrollTop = 0;
    requestAnimationFrame(function () { sec.classList.add('in'); });
    return sec;
  }
  function hideScreens() {
    screensEl.hidden = true;
    screensEl.innerHTML = '';
    document.body.setAttribute('data-screen', '');
  }
  function btn(label, cls, icon) {
    return '<button type="button" class="btn ' + (cls || '') + '">' +
      (icon ? '<span class="bi">' + icon + '</span>' : '') + '<span>' + esc(label) + '</span></button>';
  }
  function bind(root, sel, fn) {
    var nodes = root.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++) {
      (function (n) {
        n.addEventListener('click', function (ev) { sfx('ui'); fn(ev, n); });
      })(nodes[i]);
    }
  }
  function starsHTML(n, max) {
    max = max || 3; var out = '';
    for (var i = 0; i < max; i++) out += '<span class="star' + (i < n ? ' on' : '') + '">' + I.star + '</span>';
    return '<span class="stars">' + out + '</span>';
  }

  /* ------------------------------------------------------------ écran : titre */

  function screenTitle() {
    ctx.playing = false;
    if (BP.engine && BP.engine.setPaused) BP.engine.setPaused(true);
    hudHide();
    showScreen('title', function (sec) {
      sec.innerHTML =
        '<div class="halo"></div>' +
        '<div class="title-inner">' +
        '  <div class="vitrine">' + hareSVG() + '</div>' +
        '  <h1 class="game-title">' + esc(gameTitle()) + '</h1>' +
        '  <p class="tagline">' + esc(tagline()) + '</p>' +
        '  <nav class="menu-col">' +
        btn(resumeLabel(), 'primary js-play', I.play) +
        btn('Improvisation du jour', 'js-improv', I.dice) +
        btn('Tournée', 'js-tour', I.road) +
        btn('Succès', 'js-ach', I.trophy) +
        btn('Options', 'js-opt', I.gear) +
        '  </nav>' +
        '  <p class="version">version ' + esc(BP.VERSION || '1.0') + '</p>' +
        '</div>';
      bind(sec, '.js-play', function () { goPlayFlow(); });
      bind(sec, '.js-improv', function () { startImprov(); });
      bind(sec, '.js-tour', function () { screenTourneeStart(); });
      bind(sec, '.js-ach', function () { screenAchievements('title'); });
      bind(sec, '.js-opt', function () { screenOptions('title'); });
    });
    A('playMusic', 'menu');
  }

  function resumeLabel() {
    var l = firstPlayable();
    if (!l) return 'Jouer';
    var r = lvlSave(l.id);
    return (r.done || anyDone()) ? 'Reprendre la tournée' : 'Commencer';
  }
  function anyDone() {
    var s = S();
    for (var k in s.levels) if (s.levels[k] && s.levels[k].done) return true;
    return false;
  }
  function allLevels() {
    if (BP.levels && BP.levels.all && BP.levels.all.length) return BP.levels.all;
    var out = [];
    if (BP.levels && BP.levels.acts) BP.levels.acts.forEach(function (a) { out = out.concat(a.levels || []); });
    return out;
  }
  /** Premier tableau jouable non terminé (sinon le premier tout court). */
  function firstPlayable() {
    var all = allLevels();
    for (var i = 0; i < all.length; i++) {
      if (isUnlocked(all[i]) && !lvlSave(all[i].id).done) return all[i];
    }
    return all[all.length - 1] || null;
  }
  function goPlayFlow() {
    var l = firstPlayable();
    if (!l) { screenMap(); return; }
    enterLevel(l);
  }

  /** Silhouette décorative : un lièvre d'ombre posé sur le drap, et un oiseau. */
  function hareSVG() {
    return '<svg viewBox="0 0 240 160" preserveAspectRatio="xMidYMax meet" aria-hidden="true">' +
      '<g class="sil">' +
      '<path d="M119 101c-5-21 2-48 17-70 7-10 15-7 13 6-3 22-11 46-16 64z"/>' +
      '<path d="M134 103c1-21 14-45 31-60 9-8 16-2 10 10-11 21-21 37-25 53z"/>' +
      '<path d="M148 104c6 8 6 19-1 27-9 10-27 12-40 6-7-3-15-5-23-4-9 1-11-8-2-13 9-4 16-9 23-16 11-11 34-11 43 0z"/>' +
      '<path d="M152 110c24-3 49 12 55 36 3 11-3 18-14 18h-78c-10 0-15-7-11-17 7-19 25-35 48-37z"/>' +
      '<path d="M186 160c-3-9-1-18 5-25 3-3 7-2 7 2 0 8 3 16 8 23z"/>' +
      '</g>' +
      '<g class="sil bird">' +
      '<path d="M22 46c10-10 22-12 30-5 5-9 17-12 26-6-11 2-19 7-25 15-7-7-19-9-31-4z"/>' +
      '</g></svg>';
  }

  /* ------------------------------------------------------- déverrouillages */

  function actOf(n) {
    var acts = (BP.levels && BP.levels.acts) || [];
    for (var i = 0; i < acts.length; i++) if (acts[i].act === n) return acts[i];
    return acts[n - 1] || null;
  }
  function actUnlocked(n) {
    if (n <= 1) return true;
    var prev = actLevels(n - 1);
    if (!prev.length) return true;
    var perf = null;
    for (var i = prev.length - 1; i >= 0; i--) if (prev[i].type === 'performance') { perf = prev[i]; break; }
    if (!perf) perf = prev[prev.length - 1];
    return !!lvlSave(perf.id).done;
  }
  function isUnlocked(level) {
    if (!level) return false;
    if (level.act === 0 || !level.act) return true;
    if (!actUnlocked(level.act)) return false;
    var ls = actLevels(level.act);
    var i = ls.indexOf(level);
    if (i < 0) for (var k = 0; k < ls.length; k++) if (ls[k].id === level.id) i = k;
    if (i <= 0) return true;
    return !!lvlSave(ls[i - 1].id).done;
  }

  /* -------------------------------------------------------- écran : la carte */

  function screenMap() {
    ctx.playing = false;
    if (BP.engine && BP.engine.setPaused) BP.engine.setPaused(true);
    hudHide();
    var acts = (BP.levels && BP.levels.acts) || [];
    showScreen('map', function (sec) {
      var h = '<header class="sc-head"><button type="button" class="icon-btn js-back" aria-label="Retour">' + I.back + '</button>' +
        '<h2>La tournée</h2><span class="head-sp"></span></header><div class="sc-body">';
      if (!acts.length) h += '<p class="empty">Le répertoire n’est pas encore chargé.</p>';
      acts.forEach(function (a, ai) {
        var n = (a.act !== undefined ? a.act : ai + 1);
        var open = actUnlocked(n);
        var st = actStory(n);
        h += '<section class="act' + (open ? '' : ' locked') + '">' +
          '<h3 class="act-title"><span class="act-num">Acte ' + roman(n) + '</span>' +
          '<span class="act-name">' + esc(a.title || st.title) + '</span>' +
          (open ? '' : '<span class="act-lock">' + I.lock + ' à venir</span>') + '</h3>' +
          '<div class="vignettes">';
        (a.levels || []).forEach(function (l) {
          var un = isUnlocked(l), r = lvlSave(l.id);
          h += '<button type="button" class="vign' + (un ? '' : ' locked') + (l.type === 'performance' ? ' perf' : '') +
            '" data-id="' + esc(l.id) + '"' + (un ? '' : ' aria-disabled="true"') + '>' +
            '<span class="thumb-box"><canvas class="thumb" width="132" height="99" data-thumb="' + esc(l.id) + '"></canvas>' +
            (un ? '' : '<span class="vlock">' + I.lock + '</span>') + '</span>' +
            '<span class="vign-t">' + esc(l.title || l.id) + '</span>' +
            (l.type === 'performance' ? '<span class="vtag">représentation</span>' : '') +
            starsHTML(r.stars) +
            '</button>';
        });
        h += '</div></section>';
      });
      h += '</div>';
      sec.innerHTML = h;
      bind(sec, '.js-back', function () { screenTitle(); });
      bind(sec, '.vign', function (ev, n) {
        var id = n.getAttribute('data-id');
        var l = findLevel(id);
        if (!l) return;
        if (!isUnlocked(l)) { sfx('error'); n.classList.remove('shake'); void n.offsetWidth; n.classList.add('shake'); return; }
        enterLevel(l);
      });
      // miniatures
      var cs = sec.querySelectorAll('canvas[data-thumb]');
      for (var i = 0; i < cs.length; i++) {
        (function (c) {
          var l = findLevel(c.getAttribute('data-thumb'));
          if (!l) return;
          if (isUnlocked(l) && BP.engine && BP.engine.renderThumb) {
            try { BP.engine.renderThumb(c, l); return; } catch (e) { /* repli */ }
          }
          placeholderThumb(c, isUnlocked(l));
        })(cs[i]);
      }
    });
  }
  function roman(n) { return ['0', 'I', 'II', 'III', 'IV', 'V'][n] || String(n); }
  function findLevel(id) {
    if (BP.levels && BP.levels.byId) { try { var l = BP.levels.byId(id); if (l) return l; } catch (e) { } }
    var all = allLevels();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function placeholderThumb(c, unlocked) {
    var g = c.getContext && c.getContext('2d');
    if (!g) return;
    g.fillStyle = '#e6d6b0'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = unlocked ? 'rgba(40,26,14,.20)' : 'rgba(40,26,14,.12)';
    g.beginPath(); g.ellipse(c.width / 2, c.height / 2, c.width * 0.22, c.height * 0.26, 0, 0, Math.PI * 2); g.fill();
  }

  /* ------------------------------------------------ interlude / intro tableau */

  function enterLevel(level) {
    ctx.mode = 'story'; ctx.level = level;
    var key = 'intro_act' + level.act;
    var ls = actLevels(level.act);
    var first = ls.length && ls[0].id === level.id;
    if (first && level.act && !S().seen[key]) {
      screenInterlude(level.act, function () {
        SAVE(function (s) { s.seen[key] = true; });
        screenBrief(level);
      });
    } else screenBrief(level);
  }

  function screenInterlude(actNum, done) {
    var st = actStory(actNum);
    var ps = paras(st.intro);
    if (!ps.length) { done(); return; }
    var i = 0;
    hudHide();
    showScreen('interlude', function (sec) {
      sec.innerHTML = '<div class="carnet">' +
        '<h2 class="act-head"><small>Acte ' + roman(actNum) + '</small>' + esc(st.title) + '</h2>' +
        '<div class="carnet-body"></div>' +
        '<p class="tap-hint">' + tapWord() + ' pour continuer</p></div>';
      var body = $('.carnet-body', sec);
      function step() {
        if (i >= ps.length) { done(); return; }
        var p = el('p', { 'class': 'para' }, esc(ps[i]));
        body.appendChild(p);
        requestAnimationFrame(function () { p.classList.add('in'); });
        sfx('page');
        i++;
        if (i >= ps.length) $('.tap-hint', sec).textContent = tapWord() + ' pour entrer en scène';
      }
      sec.addEventListener('click', function () { step(); });
      step();
    });
  }

  function screenBrief(level) {
    ctx.level = level;
    hudHide();
    if (BP.engine && BP.engine.setPaused) BP.engine.setPaused(true);
    var isPerf = level.type === 'performance';
    var modeName = ctx.mode === 'improv' ? 'Improvisation du jour'
      : ctx.mode === 'tournee' ? ('Tournée — étape ' + (ctx.tour ? ctx.tour.stage : 1))
        : ('Acte ' + roman(level.act) + (level.index ? ' · tableau ' + level.index : ''));
    showScreen('brief', function (sec) {
      var ps = paras(level.intro);
      sec.innerHTML = '<div class="carnet">' +
        '<p class="kicker">' + esc(modeName) + '</p>' +
        '<h2 class="brief-title">' + esc(level.title || 'Sans titre') + '</h2>' +
        (isPerf ? '<p class="perf-flag">' + I.curtain + ' représentation en direct</p>' : '') +
        '<div class="carnet-body">' + ps.map(function (p) { return '<p class="para in">' + esc(p) + '</p>'; }).join('') + '</div>' +
        '<div class="brief-meta"><span>Coffre : ' + ((level.coffre || []).length) + ' découpes</span>' +
        '<span>Par : ' + (level.par || '—') + ' manipulations</span>' +
        (level.lamps && level.lamps.length > 1 ? '<span>Deux lampes</span>' : '') + '</div>' +
        '<div class="row">' + btn('Lever le rideau', 'primary js-go', I.curtain) +
        btn('Retour', 'ghost js-back', I.back) + '</div></div>';
      bind(sec, '.js-go', function () { sfx('curtain'); startLevel(level); });
      bind(sec, '.js-back', function () {
        if (ctx.mode === 'story') screenMap(); else screenTitle();
      });
    });
  }

  /* --------------------------------------------------------------- le jeu */

  function startLevel(level) {
    ctx.level = level; ctx.playing = true; ctx.lastResult = null;
    ctx.extra = []; ctx.curtainUp = false; ctx.score = 0; ctx.scores = {};
    targetOn = false;
    hideScreens();
    hudBuild(level);
    hudShow();
    if (BP.engine && BP.engine.loadLevel) {
      try { BP.engine.loadLevel(level, { mode: ctx.mode }); } catch (e) { console.error('[ui] loadLevel', e); }
    }
    if (BP.engine && BP.engine.setPaused) BP.engine.setPaused(false);
    if (BP.engine && BP.engine.setOptions) {
      var st = S().settings;
      try { BP.engine.setOptions({ reduceMotion: !!st.reduceMotion, showSideView: !!st.sideView }); } catch (e) { }
    }
    kickResize();
    if (level.type === 'performance') A('playMusic', 'performance');
    else A('playMusic', 'act' + (level.act || 1));
    A('ambience', true);
    startPlayLoop();
    setTimeout(function () { runTutorials(level); }, 380);
  }

  function kickResize() {
    var fire = function () { try { window.dispatchEvent(new Event('resize')); } catch (e) { } };
    requestAnimationFrame(fire);
    setTimeout(fire, 90);
    setTimeout(fire, 320);
  }

  function restartLevel() {
    if (!ctx.level) return;
    hideScreens();
    startLevel(ctx.level);
  }

  /* ------------------------------------------------------------------- HUD */

  var hudRefs = {};

  function hudHide() { if (hud) hud.hidden = true; ctx.playing = false; stopPlayLoop(); }
  function hudShow() { if (hud) hud.hidden = false; }

  function unlockedSet(level) {
    var s = S().seen, set = {};
    for (var k in s) set[k] = true;
    (level.unlocks || []).forEach(function (u) { set[u] = true; });
    ctx.extra.forEach(function (u) { set[u] = true; });   // déverrouillages annoncés en cours de tableau
    // Les tableaux à deux lampes impliquent les vues.
    if (level.lamps && level.lamps.length > 1) set.twolamps = true;
    if ((level.readings || []).length > 1) set.twolamps = true;
    return set;
  }

  function hudBuild(level) {
    var set = unlockedSet(level);
    var readings = level.readings || ['main'];
    var multi = readings.length > 1 || (level.lamps || []).length > 1;

    var gauges = '';
    if (multi) {
      gauges = '<div class="sub-gauges">' + readings.map(function (r) {
        return '<div class="sub" data-reading="' + esc(r) + '"><span class="sub-lab">' + readingShort(r) + '</span>' +
          '<span class="sub-track"><i class="sub-fill r-' + esc(r) + '"></i></span>' +
          '<span class="sub-val">0 %</span></div>';
      }).join('') + '</div>';
    }

    var acts = [];
    if (set.depth) acts.push(['depth-', 'Rétrécir', I.smaller, 'Profondeur − (éloigner de la lampe)', true]);
    if (set.depth) acts.push(['depth+', 'Grandir', I.bigger, 'Profondeur + (approcher de la lampe)', true]);
    if (set.rotate) acts.push(['rot-', 'Gauche', I.rotL, 'Tourner vers la gauche', true]);
    if (set.rotate) acts.push(['rot+', 'Droite', I.rotR, 'Tourner vers la droite', true]);
    if (set.tilt) acts.push(['tilt', 'Basculer', I.tilt, 'Basculer de profil', true]);
    if (set.flip) acts.push(['flip', 'Miroir', I.flip, 'Retourner la découpe', true]);
    acts.push(['remove', 'Retirer', I.remove, 'Retirer la découpe du drap', true]);
    acts.push(['undo', 'Annuler', I.undo, 'Annuler la dernière manipulation', false]);
    acts.push(['reset', 'Recommencer', I.reset, 'Tout recommencer', false]);
    acts.push(['target', 'Cible', I.target, 'Afficher ou masquer le fantôme de la cible', false]);
    if (level.hint) acts.push(['hint', 'Indice', I.hint, 'Un conseil du conteur', false]);
    acts.push(['menu', 'Menu', I.menu, 'Pause', false]);

    var views = '';
    if (multi) {
      var vs = [['all', 'Tout', I.both, '1'], ['red', 'Rouge', I.lens, '2'], ['blue', 'Bleu', I.lens, '3'], ['umbra', 'Œil nu', I.eye, '4']];
      views = '<div class="views" role="group" aria-label="Verres teintés">' + vs.map(function (v) {
        return '<button type="button" class="vbtn v-' + v[0] + '" data-view="' + v[0] + '" title="Vue : ' + esc(v[1]) + ' (touche ' + v[3] + ')">' +
          '<span class="bi">' + v[2] + '</span><span>' + esc(v[1]) + '</span></button>';
      }).join('') + '</div>';
    }

    hud.innerHTML =
      '<div class="hud-top">' +
      '  <div class="hud-line">' +
      '    <span class="hud-title">' + esc(level.title || '') + '</span>' +
      '    <span class="gauge">' +
      '      <span class="gauge-track"><i class="gauge-fill" data-fill></i>' +
      '        <i class="tick pass" style="left:' + ((BP.PASS || 0.9) * 100) + '%"></i>' +
      '        <i class="tick gold" style="left:' + ((BP.GOLD || 0.97) * 100) + '%"></i>' +
      '      </span>' +
      '      <span class="gauge-val" data-val>0 %</span>' +
      '    </span>' +
      '    <span class="hud-moves"><b data-moves>0</b><i>/ ' + (level.par || '—') + '</i><small>manip.</small></span>' +
      '  </div>' + gauges +
      (level.type === 'performance' ? '<div class="beatbar" data-beat hidden><span class="beat-lab"></span><span class="beat-track"><i></i></span></div>' : '') +
      '</div>' +
      '<div class="hud-panel">' +
      (level.type === 'performance' ? '<button type="button" class="btn primary curtain-btn" data-curtain>' +
        '<span class="bi">' + I.curtain + '</span><span>Commencer la représentation</span></button>' : '') +
      views +
      '<div class="pad">' + acts.map(function (a) {
        return '<button type="button" class="pbtn' + (a[4] ? ' needs-sel' : '') + '" data-act="' + a[0] + '" title="' + esc(a[3]) + '" aria-label="' + esc(a[3]) + '">' +
          '<span class="bi">' + a[2] + '</span><span class="pl">' + esc(a[1]) + '</span></button>';
      }).join('') + '</div>' +
      '</div>';

    hudRefs = {
      fill: $('[data-fill]', hud), val: $('[data-val]', hud), moves: $('[data-moves]', hud),
      beat: $('[data-beat]', hud), curtain: $('[data-curtain]', hud)
    };

    var pb = hud.querySelectorAll('.pbtn');
    for (var i = 0; i < pb.length; i++) {
      (function (b) {
        b.addEventListener('click', function () { onPad(b.getAttribute('data-act'), b); });
      })(pb[i]);
    }
    var vb = hud.querySelectorAll('.vbtn');
    for (var j = 0; j < vb.length; j++) {
      (function (b) {
        b.addEventListener('click', function () { sfx('ui'); E('view', b.getAttribute('data-view')); syncViews(); });
      })(vb[j]);
    }
    if (hudRefs.curtain) {
      hudRefs.curtain.hidden = ctx.curtainUp;
      hudRefs.curtain.addEventListener('click', function () {
        sfx('curtain'); E('curtain');
        ctx.curtainUp = true;
        hudRefs.curtain.hidden = true;
        A('drum', 'perf');
        kickResize();
      });
    }
    setGauge(ctx.score, ctx.scores);
    syncViews();
    var tb = hud.querySelector('[data-act="target"]');
    if (tb) tb.classList.toggle('on', targetOn);
  }

  function readingLabel(r) {
    return { main: 'Ombre', red: 'Verre rouge', blue: 'Verre bleu', umbra: 'Œil nu' }[r] || r;
  }
  function readingShort(r) {
    return { main: 'Ombre', red: 'Rouge', blue: 'Bleu', umbra: 'Œil nu' }[r] || r;
  }

  var targetOn = false;
  function onPad(name, node) {
    if (!name) return;
    sfx('ui');
    if (name === 'menu') { screenPause(); return; }
    if (name === 'hint') { showHint(); return; }
    if (name === 'target') {
      targetOn = !targetOn;
      node.classList.toggle('on', targetOn);
      E('showTarget', targetOn);
      return;
    }
    E(name);
  }

  function showHint() {
    var t = (ctx.level && ctx.level.hint) || 'Regardez la cible : ce qui dépasse est souvent une question de profondeur.';
    bubble({ title: 'Indice', text: t, anchor: hud.querySelector('[data-act="hint"]') });
  }

  function setGauge(score, scores) {
    ctx.score = score || 0; ctx.scores = scores || {};
    if (!hudRefs.fill || !hud || hud.hidden) return;
    var v = Math.max(0, Math.min(1, score || 0));
    hudRefs.fill.style.width = (v * 100).toFixed(1) + '%';
    hudRefs.fill.style.background = gaugeColor(v);
    hudRefs.fill.classList.toggle('gold', v >= (BP.GOLD || 0.97));
    if (hudRefs.val) {
      hudRefs.val.textContent = pct0(v);
      hudRefs.val.className = 'gauge-val' + (v >= (BP.GOLD || 0.97) ? ' gold' : v >= (BP.PASS || 0.9) ? ' pass' : '');
    }
    var subs = hud.querySelectorAll('.sub');
    for (var i = 0; i < subs.length; i++) {
      var r = subs[i].getAttribute('data-reading');
      var sv = Math.max(0, Math.min(1, (scores && scores[r]) || 0));
      $('.sub-fill', subs[i]).style.width = (sv * 100).toFixed(1) + '%';
      $('.sub-val', subs[i]).textContent = pct0(sv);
    }
  }
  function gaugeColor(v) {
    var pass = BP.PASS || 0.9, gold = BP.GOLD || 0.97;
    var c;
    if (v < pass) c = mix([109, 74, 42], [232, 168, 56], v / pass);
    else if (v < gold) c = mix([232, 168, 56], [245, 215, 110], (v - pass) / (gold - pass));
    else c = [245, 224, 140];
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }
  function mix(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
  }
  function syncViews() {
    var st = engineState(), v = st.view || 'all';
    var vb = hud.querySelectorAll('.vbtn');
    for (var i = 0; i < vb.length; i++) vb[i].classList.toggle('on', vb[i].getAttribute('data-view') === v);
  }

  /* boucle légère de rafraîchissement pendant le jeu */
  function startPlayLoop() {
    stopPlayLoop();
    var tick = function () {
      if (!ctx.playing) return;
      var st = engineState();
      if (hudRefs.moves) {
        var m = String(st.moves === undefined ? 0 : st.moves);
        if (hudRefs.moves.textContent !== m) hudRefs.moves.textContent = m;
      }
      var sel = !!st.selected;
      var ns = hud.querySelectorAll('.needs-sel');
      for (var i = 0; i < ns.length; i++) ns[i].classList.toggle('dim', !sel);
      syncViews();
      if (hudRefs.beat) {
        var b = st.beat;
        var vis = !!b;
        if (vis !== !hudRefs.beat.hidden) kickResize();   // la hauteur du HUD change : le canvas doit se remesurer
        if (b) {
          hudRefs.beat.hidden = false;
          var total = (ctx.level && ctx.level.beats && ctx.level.beats[b.index] && ctx.level.beats[b.index].seconds) || 10;
          var rem = Math.max(0, b.remaining || 0);
          $('.beat-lab', hudRefs.beat).textContent = 'Frappe ' + ((b.index || 0) + 1) +
            ((ctx.level.beats) ? ' / ' + ctx.level.beats.length : '') + ' — ' + rem.toFixed(1).replace('.', ',') + ' s';
          $('.beat-track i', hudRefs.beat).style.width = Math.max(0, Math.min(100, rem / total * 100)) + '%';
        } else hudRefs.beat.hidden = true;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }
  function stopPlayLoop() { if (rafId) cancelAnimationFrame(rafId); rafId = 0; }

  /* --------------------------------------------------------------- tutoriel */

  var tutoQueue = [], tutoBusy = false;

  function runTutorials(level) {
    var s = S(), q = [];
    (level.unlocks || []).forEach(function (u) { if (!s.seen[u]) q.push(u); });
    var all = allLevels();
    if (all.length && all[0] && all[0].id === level.id && !s.seen.target) q.push('target');
    if ((level.readings || []).indexOf('umbra') >= 0 && !s.seen.umbra) q.push('umbra');
    q.forEach(function (n) { if (n !== tutoCurrent && tutoQueue.indexOf(n) < 0) tutoQueue.push(n); });
    nextTutorial();
  }
  var tutoCurrent = null;
  function nextTutorial() {
    if (tutoBusy) return;
    var name = tutoQueue.shift();
    if (!name) { tutoCurrent = null; return; }
    tutoCurrent = name;
    var txt = tutoText(name);
    if (!txt) { nextTutorial(); return; }
    tutoBusy = true;
    if (BP.engine && BP.engine.setPaused) BP.engine.setPaused(true);
    bubble({
      title: tutoTitle(name), text: txt, anchor: tutoAnchor(name), tutorial: true,
      onClose: function () {
        SAVE(function (s) { s.seen[name] = true; });
        tutoBusy = false;
        if (BP.engine && BP.engine.setPaused) BP.engine.setPaused(false);
        setTimeout(nextTutorial, 120);
      }
    });
    A('sfx', 'unlock');
  }
  function tutoAnchor(name) {
    var m = {
      depth: '[data-act="depth+"]', rotate: '[data-act="rot+"]', tilt: '[data-act="tilt"]',
      flip: '[data-act="flip"]', target: '[data-act="target"]', performance: '[data-curtain]',
      twolamps: '.views', umbra: '.vbtn.v-umbra'
    };
    if (m[name]) { var n = hud.querySelector(m[name]); if (n && n.offsetParent !== null) return n; }
    return null;   // bulle centrée : le conseil porte sur le drap lui-même
  }

  var bubbleOpts = null;
  /** Bulle carnet ancrée sur un élément (ou centrée si l'ancre manque). */
  function bubble(o) {
    bubbleOpts = o;
    tutoLayer.innerHTML = '';
    tutoLayer.hidden = false;
    var wrap = el('div', { 'class': 'tuto-wrap' + (o.tutorial ? ' is-tuto' : '') });
    var box = el('div', { 'class': 'tuto' },
      (o.title ? '<h4>' + esc(o.title) + '</h4>' : '') + '<p>' + esc(o.text) + '</p>' +
      '<span class="tuto-ok">' + (o.tutorial ? 'compris' : 'fermer') + '</span>');
    var arrow = el('i', { 'class': 'tuto-arrow' });
    wrap.appendChild(box); wrap.appendChild(arrow);
    tutoLayer.appendChild(wrap);

    var a = o.anchor && o.anchor.getBoundingClientRect ? o.anchor.getBoundingClientRect() : null;
    var vw = window.innerWidth, vh = window.innerHeight;
    var bw = Math.min(300, vw - 32);
    box.style.width = bw + 'px';
    var bh = box.offsetHeight || 120;
    var cx = a ? a.left + a.width / 2 : vw / 2;
    var above = a ? (a.top > bh + 40) : true;
    var top = a ? (above ? a.top - bh - 16 : a.bottom + 16) : (vh - bh) / 2;
    var left = Math.max(12, Math.min(vw - bw - 12, cx - bw / 2));
    box.style.left = left + 'px';
    box.style.top = Math.max(12, Math.min(vh - bh - 12, top)) + 'px';
    if (a) {
      arrow.style.left = Math.max(left + 14, Math.min(left + bw - 14, cx)) + 'px';
      arrow.style.top = (above ? a.top - 14 : a.bottom + 4) + 'px';
      arrow.classList.add(above ? 'down' : 'up');
      if (o.tutorial) {
        var ring = el('i', { 'class': 'tuto-ring' });
        ring.style.left = a.left - 6 + 'px'; ring.style.top = a.top - 6 + 'px';
        ring.style.width = a.width + 12 + 'px'; ring.style.height = a.height + 12 + 'px';
        wrap.appendChild(ring);
      }
    } else arrow.hidden = true;
    void wrap.offsetWidth;
    wrap.classList.add('in');
    var close = function () {
      bubbleOpts = null;
      wrap.classList.remove('in');
      setTimeout(function () {
        if (bubbleOpts) return;   // une autre bulle a pris la place
        tutoLayer.hidden = true; tutoLayer.innerHTML = '';
      }, 220);
      sfx('page');
      if (o.onClose) o.onClose();
    };
    wrap.addEventListener('click', close);
  }

  /* ------------------------------------------------------------- pause */

  function screenPause() {
    if (BP.engine && BP.engine.setPaused) BP.engine.setPaused(true);
    ctx.playing = false; stopPlayLoop();
    showScreen('pause', function (sec) {
      sec.innerHTML = '<div class="carnet narrow">' +
        '<h2>Entracte</h2>' +
        '<div class="menu-col">' + btn('Reprendre', 'primary js-res', I.play) +
        btn('Recommencer le tableau', 'js-again', I.reset) +
        btn('Options', 'js-opt', I.gear) +
        btn(ctx.mode === 'tournee' ? 'Abandonner la tournée' : 'Carte de la tournée', 'ghost js-map', I.map) +
        '</div></div>';
      bind(sec, '.js-res', function () {
        hideScreens(); ctx.playing = true;
        if (BP.engine && BP.engine.setPaused) BP.engine.setPaused(false);
        hudShow(); startPlayLoop(); kickResize();
      });
      bind(sec, '.js-again', function () { restartLevel(); });
      bind(sec, '.js-opt', function () { screenOptions('pause'); });
      bind(sec, '.js-map', function () {
        if (ctx.mode === 'tournee') { endTournee('abandon'); return; }
        hudHide(); A('ambience', false); A('playMusic', 'menu');
        if (ctx.mode === 'story') screenMap(); else screenTitle();
      });
    });
  }

  /* --------------------------------------------------------- fin de tableau */

  function onWon(d) {
    d = d || {};
    if (d.success === false || d.lost === true) { onLost(d); return; }
    ctx.playing = false; stopPlayLoop();
    var st = engineState();
    var level = ctx.level || d.level || st.level || {};
    var score = (d.score !== undefined) ? d.score : (st.score || 0);
    var moves = (d.moves !== undefined) ? d.moves : (st.moves || 0);
    var par = d.par || level.par || 0;
    var stars = (d.stars !== undefined) ? d.stars : computeStars(score, moves, par);
    var scores = d.scores || st.scores || {};
    ctx.lastResult = { score: score, moves: moves, stars: stars, scores: scores, level: level };

    noteShapesUsed();
    if (ctx.mode === 'story') {
      SAVE(function (s) {
        var r = s.levels[level.id] || { best: 0, stars: 0, bestMoves: 0, done: false };
        r.best = Math.max(r.best || 0, score);
        r.stars = Math.max(r.stars || 0, stars);
        r.bestMoves = r.bestMoves ? Math.min(r.bestMoves, moves) : moves;
        r.done = true;
        s.levels[level.id] = r;
      });
    } else if (ctx.mode === 'improv') {
      var key = ctx.improvKey;
      SAVE(function (s) {
        var r = s.improv[key] || { best: 0, moves: 0 };
        if (score > (r.best || 0)) { r.best = score; r.moves = moves; }
        s.improv[key] = r;
      });
    } else if (ctx.mode === 'tournee' && ctx.tour) {
      ctx.tour.scores.push(score);
      ctx.tour.total += score;
      if (ctx.tour.stage >= 5) grant('tournee_5');
      if (ctx.tour.stage >= 10) grant('tournee_10');
      SAVE(function (s) {
        if (ctx.tour.stage > (s.tournee.best || 0)) s.tournee.best = ctx.tour.stage;
        if (ctx.tour.total > (s.tournee.bestScore || 0)) s.tournee.bestScore = ctx.tour.total;
      });
    }
    checkAchievements({ level: level, state: st, score: score, stars: stars, moves: moves, mode: ctx.mode, scores: scores });

    A('setIntensity', 1);
    A('applause', Math.max(0, Math.min(1, (score - 0.7) / 0.3)));
    sfx(score >= (BP.GOLD || 0.97) ? 'gold' : 'success');

    var isFinale = ctx.mode === 'story' && level.act === 3 && level.type === 'performance';
    screenResult(level, score, stars, moves, par, scores, isFinale);
  }

  function computeStars(score, moves, par) {
    var pass = BP.PASS || 0.9, gold = BP.GOLD || 0.97;
    if (score < pass) return 0;
    if (score < gold) return 1;
    return (par && moves <= par) ? 3 : 2;
  }

  function screenResult(level, score, stars, moves, par, scores, isFinale) {
    hudHide();
    var nextLv = null;
    if (ctx.mode === 'story' && BP.levels && BP.levels.next) { try { nextLv = BP.levels.next(level.id); } catch (e) { } }
    showScreen('result', function (sec) {
      var readings = level.readings || [];
      var detail = readings.length > 1 ? '<ul class="read-list">' + readings.map(function (r) {
        return '<li><span>' + readingLabel(r) + '</span><b>' + pct(scores[r] || 0) + '</b></li>';
      }).join('') + '</ul>' : '';
      var actions = '';
      if (ctx.mode === 'tournee') {
        actions = btn('Étape suivante', 'primary js-next', I.next) + btn('Arrêter la tournée', 'ghost js-stop', I.back);
      } else if (ctx.mode === 'improv') {
        actions = btn('Rejouer', 'js-again', I.reset) + btn('Retour', 'ghost js-map', I.back);
      } else if (isFinale) {
        actions = btn('Épilogue', 'primary js-epi', I.next);
      } else {
        actions = (nextLv ? btn('Suivant', 'primary js-next', I.next) : '') +
          btn('Rejouer', 'js-again', I.reset) + btn('La carte', 'ghost js-map', I.map);
      }
      sec.innerHTML = '<div class="veil"></div><div class="carnet result-card">' +
        '<p class="kicker">' + (score >= (BP.GOLD || 0.97) ? 'Ovation' : score >= (BP.PASS || 0.9) ? 'Le public applaudit' : 'Rideau') + '</p>' +
        '<h2>' + esc(level.title || '') + '</h2>' +
        '<div class="big-stars">' + [0, 1, 2].map(function (i) {
          return '<span class="bstar" data-i="' + i + '">' + I.star + '</span>';
        }).join('') + '</div>' +
        '<div class="result-figures"><div><b>' + pct(score) + '</b><i>ressemblance</i></div>' +
        '<div><b>' + moves + (par ? ' / ' + par : '') + '</b><i>manipulations</i></div></div>' +
        detail +
        (level.outro ? '<div class="carnet-body">' + paras(level.outro).map(function (p) { return '<p class="para in">' + esc(p) + '</p>'; }).join('') + '</div>' : '') +
        '<div class="row">' + actions + '</div></div>';

      // étoiles animées
      var bs = sec.querySelectorAll('.bstar');
      var reduce = reduceMotion();
      for (var i = 0; i < stars; i++) {
        (function (i) {
          var d = reduce ? 0 : 260 + i * 340;
          setTimeout(function () {
            if (!bs[i]) return;
            bs[i].classList.add('on');
            sfx('star');
          }, d);
        })(i);
      }
      bind(sec, '.js-next', function () {
        if (ctx.mode === 'tournee') { nextTourneeStage(); return; }
        if (nextLv) enterLevel(nextLv); else screenMap();
      });
      bind(sec, '.js-again', function () { restartLevel(); });
      bind(sec, '.js-map', function () { A('playMusic', 'menu'); if (ctx.mode === 'story') screenMap(); else screenTitle(); });
      bind(sec, '.js-stop', function () { endTournee('arret'); });
      bind(sec, '.js-epi', function () { screenEpilogue(scores, level); });
    });
  }

  function onLost(d) {
    ctx.playing = false; stopPlayLoop(); hudHide();
    d = d || {};
    var level = ctx.level || {};
    SAVE(function (s) { s.fails[level.id] = (s.fails[level.id] || 0) + 1; });
    sfx('error');
    A('applause', 0);
    if (ctx.mode === 'tournee') { endTournee('echec'); return; }
    showScreen('lost', function (sec) {
      sec.innerHTML = '<div class="veil"></div><div class="carnet result-card lost">' +
        '<p class="kicker">Le public gronde</p>' +
        '<h2>' + esc(level.title || '') + '</h2>' +
        '<p class="lost-txt">L’ombre s’est défaite sous le tambour. On rallume la lampe, on recommence : ' +
        'personne n’a jamais tenu une représentation du premier coup.</p>' +
        (d.score !== undefined ? '<div class="result-figures"><div><b>' + pct(d.score) + '</b><i>ressemblance</i></div></div>' : '') +
        '<div class="row">' + btn('Réessayer', 'primary js-again', I.reset) + btn('La carte', 'ghost js-map', I.map) + '</div></div>';
      bind(sec, '.js-again', function () { restartLevel(); });
      bind(sec, '.js-map', function () { A('playMusic', 'menu'); screenMap(); });
    });
  }

  /* -------------------------------------------------------------- épilogue */

  function pickEnding(scores, level) {
    var rs = (level && level.readings) || ['main'];
    var min = 1;
    rs.forEach(function (r) { min = Math.min(min, (scores && scores[r] !== undefined) ? scores[r] : 0); });
    var tier = min >= 0.95 ? 2 : min >= (BP.PASS || 0.9) ? 1 : 0;
    var e = story().endings;
    var got = null;
    if (typeof story().pickEnding === 'function') {
      // Règle canonique du récit : transmission / évasion / dissolution selon les trois lectures.
      try { got = story().pickEnding(scores || {}); } catch (err) { got = null; }
    }
    if (got) { /* déjà choisi */ }
    else if (Array.isArray(e) && e.length) {
      var withMin = e.filter(function (x) { return x && typeof x.min === 'number'; });
      if (withMin.length === e.length) {
        var sorted = e.slice().sort(function (a, b) { return a.min - b.min; });
        got = sorted[0];
        sorted.forEach(function (x) { if (min >= x.min) got = x; });
      } else got = e[Math.min(e.length - 1, tier)];
    } else if (e && typeof e === 'object') {
      var keys = [['bad', 'sombre', 'echec', 'low', 'poor'], ['mixed', 'moyen', 'doute', 'mid'], ['good', 'bonne', 'best', 'high', 'lumiere']][tier];
      for (var i = 0; i < keys.length && !got; i++) if (e[keys[i]]) got = e[keys[i]];
      if (!got) { var ks = Object.keys(e); got = e[ks[Math.min(ks.length - 1, tier)]]; }
    }
    if (typeof got === 'string') got = { title: '', text: got };
    if (!got) got = FALLBACK.endings[tier];
    var text = got.text || got.body || (Array.isArray(got.paragraphs) ? got.paragraphs.join('\n\n') : '') || FALLBACK.endings[tier].text;
    return { title: got.title || FALLBACK.endings[tier].title, text: text, min: min };
  }

  function screenEpilogue(scores, level) {
    var end = pickEnding(scores, level);
    A('playMusic', 'ending');
    var ps = paras(end.text);
    var i = 0;
    showScreen('epilogue', function (sec) {
      sec.innerHTML = '<div class="halo soft"></div><div class="carnet epilogue">' +
        '<p class="kicker">Épilogue</p><h2>' + esc(end.title) + '</h2>' +
        '<div class="carnet-body"></div><p class="tap-hint">' + tapWord() + ' pour continuer</p></div>';
      var body = $('.carnet-body', sec);
      function step() {
        if (i >= ps.length) { screenCredits(); return; }
        var p = el('p', { 'class': 'para' }, esc(ps[i]));
        body.appendChild(p);
        requestAnimationFrame(function () { p.classList.add('in'); });
        sfx('page'); i++;
        if (i >= ps.length) $('.tap-hint', sec).textContent = tapWord() + ' pour les remerciements';
      }
      sec.addEventListener('click', step);
      step();
    });
  }

  function screenCredits() {
    var c = story().credits || FALLBACK.credits;
    showScreen('credits', function (sec) {
      sec.innerHTML = '<div class="halo soft"></div><div class="carnet narrow">' +
        '<h2 class="game-title small">' + esc(gameTitle()) + '</h2>' +
        '<div class="carnet-body">' + paras(c).map(function (p) { return '<p class="para in">' + esc(p) + '</p>'; }).join('') + '</div>' +
        '<p class="credit-line">Le coffre passe à quelqu’un d’autre.</p>' +
        '<div class="row">' + btn('Retour au titre', 'primary js-title', I.back) + '</div></div>';
      bind(sec, '.js-title', function () { screenTitle(); });
    });
  }

  /* --------------------------------------------------------------- succès */

  function screenAchievements(from) {
    hudHide();
    var s = S();
    showScreen('achievements', function (sec) {
      var got = 0;
      var items = ACHIEVEMENTS.map(function (a) {
        var t = s.achievements[a.id];
        if (t) got++;
        return '<li class="ach' + (t ? ' got' : '') + '"><span class="ach-ic">' + (t ? I.trophy : I.lock) + '</span>' +
          '<span class="ach-txt"><b>' + esc(a.name) + '</b><i>' + esc(a.desc) + '</i>' +
          (t ? '<u>obtenu le ' + esc(fmtDate(t)) + '</u>' : '<u>verrouillé</u>') + '</span></li>';
      }).join('');
      sec.innerHTML = '<header class="sc-head"><button type="button" class="icon-btn js-back" aria-label="Retour">' + I.back + '</button>' +
        '<h2>Succès</h2><span class="head-count">' + got + ' / ' + ACHIEVEMENTS.length + '</span></header>' +
        '<div class="sc-body"><ul class="ach-list">' + items + '</ul></div>';
      bind(sec, '.js-back', function () { from === 'pause' ? screenPause() : screenTitle(); });
    });
  }
  function fmtDate(t) {
    try { return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  /* --------------------------------------------------------------- options */

  function reduceMotion() {
    if (S().settings.reduceMotion) return true;
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function applySettings() {
    var st = S().settings;
    document.body.classList.toggle('reduce-motion', reduceMotion());
    A('setVolumes', { music: st.music, sfx: st.sfx });
    A('setMuted', !!st.muted);
    if (BP.engine && BP.engine.setOptions) {
      try { BP.engine.setOptions({ reduceMotion: reduceMotion(), showSideView: !!st.sideView }); } catch (e) { }
    }
  }

  function screenOptions(from) {
    ctx.optionsFrom = from || 'title';
    hudHide();
    var st = S().settings;
    showScreen('options', function (sec) {
      sec.innerHTML = '<header class="sc-head"><button type="button" class="icon-btn js-back" aria-label="Retour">' + I.back + '</button>' +
        '<h2>Options</h2><span class="head-sp"></span></header><div class="sc-body"><div class="opts">' +
        row('music', 'Musique', 'range', st.music) +
        row('sfx', 'Effets', 'range', st.sfx) +
        row('muted', 'Silence complet', 'check', st.muted) +
        row('reduceMotion', 'Mouvements réduits', 'check', st.reduceMotion) +
        row('sideView', 'Vue de côté (profondeurs)', 'check', st.sideView) +
        '<div class="opt danger"><div class="opt-lab">Effacer la sauvegarde</div>' +
        '<button type="button" class="btn ghost small js-erase"><span>Effacer…</span></button></div>' +
        '<p class="version">Bêtes de Papier — version ' + esc(BP.VERSION || '1.0') + '</p>' +
        '</div></div>';

      function row(id, label, kind, v) {
        if (kind === 'range') {
          return '<div class="opt"><label class="opt-lab" for="o-' + id + '">' + esc(label) + '</label>' +
            '<input type="range" id="o-' + id + '" data-opt="' + id + '" min="0" max="1" step="0.05" value="' + v + '">' +
            '<output data-out="' + id + '">' + Math.round(v * 100) + '</output></div>';
        }
        return '<div class="opt"><label class="opt-lab" for="o-' + id + '">' + esc(label) + '</label>' +
          '<label class="switch"><input type="checkbox" id="o-' + id + '" data-opt="' + id + '"' + (v ? ' checked' : '') + '><span></span></label></div>';
      }

      var ins = sec.querySelectorAll('[data-opt]');
      for (var i = 0; i < ins.length; i++) {
        (function (inp) {
          var key = inp.getAttribute('data-opt');
          inp.addEventListener('input', function () {
            var v = inp.type === 'checkbox' ? inp.checked : parseFloat(inp.value);
            SAVE(function (s) { s.settings[key] = v; });
            var out = sec.querySelector('[data-out="' + key + '"]');
            if (out) out.textContent = Math.round(v * 100);
            applySettings();
            if (inp.type !== 'range') sfx('ui');
          });
          if (inp.type === 'range') inp.addEventListener('change', function () { sfx('ui'); });
        })(ins[i]);
      }
      bind(sec, '.js-back', function () {
        if (ctx.optionsFrom === 'pause') screenPause(); else screenTitle();
      });
      bind(sec, '.js-erase', function (ev, n) {
        if (n.getAttribute('data-armed')) {
          resetSave(); applySettings(); screenTitle(); return;
        }
        n.setAttribute('data-armed', '1');
        n.classList.add('armed');
        n.innerHTML = '<span>Confirmer l’effacement</span>';
        setTimeout(function () {
          if (!n.parentNode) return;
          n.removeAttribute('data-armed'); n.classList.remove('armed');
          n.innerHTML = '<span>Effacer…</span>';
        }, 4000);
      });
    });
  }

  /* ------------------------------------------------------ improvisation */

  function startImprov() {
    var key = (BP.dateKey ? BP.dateKey() : 0);
    ctx.mode = 'improv'; ctx.improvKey = key;
    var lv = null;
    if (BP.levels && BP.levels.makeImprov) { try { lv = BP.levels.makeImprov(key); } catch (e) { console.error('[ui] makeImprov', e); } }
    if (!lv) { notice('L’improvisation du jour n’est pas disponible.'); return; }
    ctx.level = lv;
    var best = S().improv[key];
    hudHide();
    showScreen('improv', function (sec) {
      sec.innerHTML = '<header class="sc-head"><button type="button" class="icon-btn js-back" aria-label="Retour">' + I.back + '</button>' +
        '<h2>Improvisation du jour</h2><span class="head-sp"></span></header>' +
        '<div class="sc-body"><div class="carnet">' +
        '<p class="kicker">' + esc(dateHuman(key)) + '</p>' +
        '<h3 class="brief-title">' + esc(lv.title || 'Silhouette du jour') + '</h3>' +
        '<div class="improv-thumb"><canvas width="220" height="165" data-improv></canvas></div>' +
        '<p class="para in">Une bête tirée du hasard du jour, la même pour tout le monde. Coffre imposé, une seule tentative à la fois — mais vous pouvez recommencer autant que vous voulez.</p>' +
        '<div class="brief-meta"><span>Coffre : ' + ((lv.coffre || []).length) + ' découpes</span><span>Par : ' + (lv.par || '—') + '</span></div>' +
        (best ? '<p class="record">Meilleur du jour : <b>' + pct(best.best) + '</b> en ' + best.moves + ' manipulations</p>'
          : '<p class="record muted">Pas encore de score aujourd’hui.</p>') +
        '<div class="row">' + btn('Lever le rideau', 'primary js-go', I.curtain) + '</div></div></div>';
      var c = $('[data-improv]', sec);
      if (c && BP.engine && BP.engine.renderThumb) { try { BP.engine.renderThumb(c, lv); } catch (e) { placeholderThumb(c, true); } }
      else if (c) placeholderThumb(c, true);
      bind(sec, '.js-go', function () { sfx('curtain'); startLevel(lv); });
      bind(sec, '.js-back', function () { screenTitle(); });
    });
  }

  /* ------------------------------------------------------------- tournée */

  function screenTourneeStart() {
    hudHide();
    var s = S();
    showScreen('tournee', function (sec) {
      sec.innerHTML = '<header class="sc-head"><button type="button" class="icon-btn js-back" aria-label="Retour">' + I.back + '</button>' +
        '<h2>Tournée</h2><span class="head-sp"></span></header>' +
        '<div class="sc-body"><div class="carnet">' +
        '<p class="para in">On monte le drap de village en village. À chaque étape, une bête nouvelle et un coffre un peu plus maigre. ' +
        'Un tableau raté, et la troupe rentre.</p>' +
        '<div class="record-box"><div><b>' + (s.tournee.best || 0) + '</b><i>étapes (record)</i></div>' +
        '<div><b>' + num2(s.tournee.bestScore || 0) + '</b><i>score cumulé</i></div></div>' +
        '<div class="row">' + btn('Prendre la route', 'primary js-go', I.road) + '</div></div></div>';
      bind(sec, '.js-back', function () { screenTitle(); });
      bind(sec, '.js-go', function () { startTournee(); });
    });
  }

  function startTournee() {
    ctx.mode = 'tournee';
    ctx.tour = { seed: Math.floor(Math.random() * 1e9), stage: 1, total: 0, scores: [] };
    loadTourneeStage();
  }
  function nextTourneeStage() {
    if (!ctx.tour) { screenTitle(); return; }
    ctx.tour.stage++;
    loadTourneeStage();
  }
  function loadTourneeStage() {
    var lv = null;
    if (BP.levels && BP.levels.makeTournee) {
      try { lv = BP.levels.makeTournee(ctx.tour.seed, ctx.tour.stage); } catch (e) { console.error('[ui] makeTournee', e); }
    }
    if (!lv) { notice('La tournée n’est pas disponible.'); return; }
    ctx.level = lv;
    screenBrief(lv);
  }
  function endTournee(reason) {
    var t = ctx.tour || { stage: 1, total: 0 };
    var stages = Math.max(0, t.stage - (reason === 'echec' || reason === 'abandon' ? 1 : 0));
    var s = S();
    hudHide();
    A('playMusic', 'menu');
    showScreen('tourend', function (sec) {
      sec.innerHTML = '<div class="veil"></div><div class="carnet result-card">' +
        '<p class="kicker">' + (reason === 'echec' ? 'La troupe rentre' : reason === 'abandon' ? 'On plie le drap' : 'Fin de tournée') + '</p>' +
        '<h2>Tournée terminée</h2>' +
        '<div class="result-figures"><div><b>' + stages + '</b><i>étape' + (stages > 1 ? 's' : '') + '</i></div>' +
        '<div><b>' + num2(t.total) + '</b><i>score cumulé</i></div></div>' +
        '<p class="record">Record : <b>' + (s.tournee.best || 0) + '</b> étapes · <b>' + num2(s.tournee.bestScore || 0) + '</b></p>' +
        '<div class="row">' + btn('Repartir', 'primary js-again', I.road) + btn('Titre', 'ghost js-title', I.back) + '</div></div>';
      bind(sec, '.js-again', function () { startTournee(); });
      bind(sec, '.js-title', function () { ctx.tour = null; ctx.mode = 'story'; screenTitle(); });
    });
  }

  function notice(msg) {
    showScreen('notice', function (sec) {
      sec.innerHTML = '<div class="carnet narrow"><h2>Un instant…</h2><p class="para in">' + esc(msg) + '</p>' +
        '<div class="row">' + btn('Retour', 'primary js-back', I.back) + '</div></div>';
      bind(sec, '.js-back', function () { screenTitle(); });
    });
  }

  /* ---------------------------------------------------------------- init */

  function firstGesture() {
    A('init');
    A('resume');
    applySettings();
    var lv = ctx.playing && ctx.level;
    A('playMusic', !lv ? 'menu' : (lv.type === 'performance' ? 'performance' : 'act' + (lv.act || 1)));
    A('ambience', true);
  }

  function wireEngine() {
    if (!(BP.engine && BP.engine.on)) return;
    BP.engine.on('score', function (d) {
      d = d || {};
      setGauge(d.score !== undefined ? d.score : 0, d.scores || {});
      A('setIntensity', d.score || 0);
    });
    BP.engine.on('won', onWon);
    BP.engine.on('lost', onLost);
    BP.engine.on('unlock', function (name) {
      if (!name || !ctx.level) return;
      // le contrôle apparaît immédiatement dans le panneau, puis le tutoriel le désigne
      if (ctx.extra.indexOf(name) < 0 && !unlockedSet(ctx.level)[name]) {
        ctx.extra.push(name);
        if (ctx.playing) { hudBuild(ctx.level); kickResize(); }
      }
      // Le tutoriel est planifié par runTutorials() au lancement du tableau (évite les doublons).
      if (S().seen[name] || tutoQueue.indexOf(name) >= 0 || !ctx.playing) return;
      tutoQueue.push(name);
      nextTutorial();
    });
    // Les sons de manipulation sont émis par le moteur/l'audio : l'UI ne les double pas.
    BP.engine.on('place', function () { noteShapesUsed(); });
  }

  function init() {
    if (mounted) return;
    mounted = true;
    app = $('#app'); stageWrap = $('#stage-wrap'); stageCanvas = $('#stage');
    hud = $('#hud'); screensEl = $('#screens');
    if (!app || !screensEl) { console.error('[BP.ui] squelette HTML absent'); return; }

    tutoLayer = $('#tuto');
    if (!tutoLayer) { tutoLayer = el('div', { id: 'tuto' }); tutoLayer.hidden = true; app.appendChild(tutoLayer); }
    if (!$('#toast')) app.appendChild(el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }));

    hud.hidden = true;
    screensEl.hidden = true;

    if (BP.engine && BP.engine.init && stageCanvas) {
      try { BP.engine.init(stageCanvas); } catch (e) { console.error('[ui] engine.init', e); }
    }
    wireEngine();
    applySettings();

    document.addEventListener('pointerdown', firstGesture, { once: true });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (ctx.playing) { screenPause(); e.preventDefault(); }
        else if (document.body.getAttribute('data-screen') === 'pause') {
          hideScreens(); ctx.playing = true;
          if (BP.engine && BP.engine.setPaused) BP.engine.setPaused(false);
          hudShow(); startPlayLoop();
        }
      }
    });
    var vpW = window.innerWidth, vpH = window.innerHeight;
    window.addEventListener('resize', function () {
      // ne réagir qu'à un vrai changement de fenêtre (kickResize() en émet aussi)
      if (window.innerWidth === vpW && window.innerHeight === vpH) return;
      vpW = window.innerWidth; vpH = window.innerHeight;
      if (bubbleOpts) bubble(bubbleOpts);   // ré-ancrage de la bulle ouverte
    });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

    screenTitle();
  }

  BP.ui = {
    init: init,
    show: {
      title: screenTitle, map: screenMap, options: screenOptions,
      achievements: screenAchievements, improv: startImprov, tournee: screenTourneeStart
    },
    startLevel: function (id) { var l = findLevel(id); if (l) { ctx.mode = 'story'; startLevel(l); } },
    achievements: ACHIEVEMENTS,
    _ctx: ctx
  };

})(window.BP);
