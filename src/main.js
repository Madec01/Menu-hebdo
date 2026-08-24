/* CORE — boucle principale, entrees clavier, redimensionnement. */
(function (CORE) {
  'use strict';

  var GAME = CORE.GAME, G = GAME.G, UI = CORE.UI;
  var cv = document.getElementById('cv');
  var ctx = cv.getContext('2d');

  function resize() {
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.floor(window.innerWidth * G.dpr);
    cv.height = Math.floor(window.innerHeight * G.dpr);
    cv.style.width = window.innerWidth + 'px';
    cv.style.height = window.innerHeight + 'px';
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);
  resize();

  /* ------------------------------------------------------------- ENTREES */
  var keys = {};
  var CODE = {
    up: ['KeyZ', 'KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyQ', 'KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    turbo: ['Space']
  };
  function held(list) {
    for (var i = 0; i < list.length; i++) if (keys[list[i]]) return true;
    return false;
  }
  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyM') { CORE.SFX.toggle(); return; }
    if ((e.code === 'KeyE' || e.code === 'KeyF') && !keys[e.code]) placeQueued = true;
    if (e.code === 'KeyR' && G.state === 'play') { GAME.startLevel(G.run.levelIndex); return; }
    if (e.code === 'Escape' && G.state === 'play') { CORE.SFX.drill(false, 0); UI.buildMenu(); prevState = 'menu'; G.state = 'menu'; return; }
    keys[e.code] = true;
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
    CORE.SFX.init();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () { keys = {}; });

  var placeQueued = false;
  var input = { dx: 0, dy: 0, turbo: false, place: false };
  function readInput() {
    input.place = placeQueued;
    placeQueued = false;
    input.dx = (held(CODE.right) ? 1 : 0) - (held(CODE.left) ? 1 : 0);
    input.dy = (held(CODE.down) ? 1 : 0) - (held(CODE.up) ? 1 : 0);
    input.turbo = held(CODE.turbo);
  }

  /* --------------------------------------------------------------- BOUCLE */
  var last = performance.now(), acc = 0, hudAcc = 0;
  var prevState = G.state;

  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (G.state === 'play') {
      readInput();
      GAME.update(dt, input);
      CORE.RENDER.draw(ctx, cv, G, dt);
      hudAcc += dt;
      if (hudAcc > 0.06) { hudAcc = 0; UI.updateHud(); }
    } else if (G.world) {
      CORE.RENDER.draw(ctx, cv, G, 0);
    }

    if (G.state !== prevState) {
      if (G.state === 'station') UI.buildStation();
      else if (G.state === 'end') UI.buildEnd();
      else if (G.state === 'play') UI.show(null);
      prevState = G.state;
    }

    requestAnimationFrame(frame);
  }

  UI.bind();
  UI.buildMenu();
  requestAnimationFrame(frame);
})(window.CORE);
