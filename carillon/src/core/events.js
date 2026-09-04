// core/events.js — bus d'événements global (ARCHITECTURE.md § 5).
// Un module émet, un module écoute : personne ne touche l'état interne d'un autre.
// Aucune allocation pendant emit() (tableau d'écouteurs parcouru par index) ;
// les retraits pendant une émission sont différés pour ne rien sauter.

const listeners = new Map(); // nom → tableau de fonctions (null = retiré, à compacter)
let emitting = 0;            // profondeur d'émission en cours
let dirty = false;           // des trous (null) restent à compacter

function list(name) {
  let arr = listeners.get(name);
  if (!arr) { arr = []; listeners.set(name, arr); }
  return arr;
}

// Compacte les tableaux contenant des trous, une fois toutes les émissions terminées.
function compact() {
  if (emitting > 0 || !dirty) return;
  dirty = false;
  for (const arr of listeners.values()) {
    let j = 0;
    for (let i = 0; i < arr.length; i++) if (arr[i] !== null) arr[j++] = arr[i];
    arr.length = j;
  }
}

/** Abonne fn à name ; renvoie la fonction de désabonnement. */
function on(name, fn) {
  list(name).push(fn);
  return () => off(name, fn);
}

/** Abonne fn pour une seule émission. */
function once(name, fn) {
  const wrap = (payload) => { off(name, wrap); fn(payload); };
  wrap._inner = fn;
  return on(name, wrap);
}

/** Désabonne fn (ou un once enveloppant fn). */
function off(name, fn) {
  const arr = listeners.get(name);
  if (!arr) return;
  for (let i = 0; i < arr.length; i++) {
    const l = arr[i];
    if (l === fn || (l && l._inner === fn)) {
      if (emitting > 0) { arr[i] = null; dirty = true; }
      else arr.splice(i, 1);
      return;
    }
  }
}

/** Émet name avec un payload plat et sérialisable (jamais une entité entière). */
function emit(name, payload) {
  const arr = listeners.get(name);
  if (!arr || arr.length === 0) return;
  emitting++;
  const n = arr.length; // les abonnés ajoutés pendant l'émission ne sont pas appelés
  for (let i = 0; i < n; i++) {
    const fn = arr[i];
    if (fn !== null) fn(payload);
  }
  emitting--;
  compact();
}

/** Nombre d'abonnés (tests). */
function count(name) {
  const arr = listeners.get(name);
  if (!arr) return 0;
  let n = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] !== null) n++;
  return n;
}

export const bus = { on, once, off, emit, count };
