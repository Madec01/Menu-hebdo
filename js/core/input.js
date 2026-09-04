// Input: keyboard (AZERTY/QWERTY aware), mouse, touch virtual controls.
window.Input = (function () {
  const keys = {};
  const pressed = {};
  const mouse = { x: 0, y: 0, down: false, justDown: false, justUp: false, wx: 0, wy: 0 };
  let layout = 'azerty';
  const touch = { move: { x: 0, y: 0, active: false }, buttons: {} };
  let anyKeyCb = null;

  const MAP = {
    azerty: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] },
    qwerty: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] },
  };
  // On AZERTY, physical KeyW is the "Z" key and KeyA is "Q" — so we key off event.code, which is
  // layout-independent: ZQSD on AZERTY == WASD on QWERTY physically. We still expose the layout for UI labels.
  const ACTIONS = {
    attack: ['Space', 'KeyJ', 'Enter'],
    dodge: ['ShiftLeft', 'ShiftRight', 'KeyK'],
    rally: ['KeyR', 'KeyL'],
    interact: ['KeyE', 'KeyF'],
    build: ['KeyB'],
    pause: ['Escape', 'KeyP'],
    map: ['KeyM', 'Tab'],
    skip: ['KeyN'],
    slot1: ['Digit1'], slot2: ['Digit2'], slot3: ['Digit3'], slot4: ['Digit4'], slot5: ['Digit5'], slot6: ['Digit6'],
  };

  function setLayout(l) { layout = l; }
  function getLayout() { return layout; }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true; pressed[e.code] = true;
    if (anyKeyCb) { const cb = anyKeyCb; anyKeyCb = null; cb(); }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  function bindCanvas(canvas, toWorld) {
    const upd = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
      if (toWorld) { const w = toWorld(mouse.x, mouse.y); mouse.wx = w.x; mouse.wy = w.y; }
    };
    canvas.addEventListener('mousemove', upd);
    canvas.addEventListener('mousedown', (e) => { upd(e); if (e.button === 0) { mouse.down = true; mouse.justDown = true; } if (e.button === 2) { mouse.rdown = true; mouse.rjustDown = true; } });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) { mouse.down = false; mouse.justUp = true; } if (e.button === 2) mouse.rdown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function axis() {
    let x = 0, y = 0;
    const m = MAP[layout];
    if (m.left.some(c => keys[c])) x -= 1;
    if (m.right.some(c => keys[c])) x += 1;
    if (m.up.some(c => keys[c])) y -= 1;
    if (m.down.some(c => keys[c])) y += 1;
    if (touch.move.active) { x += touch.move.x; y += touch.move.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  function held(a) { return ACTIONS[a].some(c => keys[c]) || !!touch.buttons[a]; }
  function just(a) { const r = ACTIONS[a].some(c => pressed[c]) || touch.buttons[a] === 2; return r; }
  function endFrame() { for (const k in pressed) pressed[k] = false; mouse.justDown = false; mouse.justUp = false; mouse.rjustDown = false; for (const b in touch.buttons) if (touch.buttons[b] === 2) touch.buttons[b] = 1; }
  function touchButton(a, state) { touch.buttons[a] = state ? 2 : 0; }
  function touchButtonHold(a, down) { if (down) { if (!touch.buttons[a]) touch.buttons[a] = 2; } else touch.buttons[a] = 0; }
  function onAnyKey(cb) { anyKeyCb = cb; }
  function keyName(a) {
    const c = ACTIONS[a] ? ACTIONS[a][0] : a;
    const names = { Space: 'ESPACE', ShiftLeft: 'MAJ', KeyR: 'R', KeyE: 'E', KeyB: 'B', Escape: 'ÉCHAP', KeyM: 'M', KeyN: 'N', Enter: 'ENTRÉE' };
    return names[c] || c.replace('Key', '').replace('Digit', '');
  }
  return { keys, mouse, touch, axis, held, just, endFrame, bindCanvas, setLayout, getLayout, touchButton, touchButtonHold, onAnyKey, keyName, ACTIONS };
})();
