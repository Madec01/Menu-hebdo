// Stub minimal du bus (§ 5) utilisé par run-playwright.mjs UNIQUEMENT si src/core/events.js
// n'existe pas encore (agent C). Même contrat : on(name, fn) → off, once, off, emit.
const listeners = new Map();
export const bus = {
  on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
    return () => bus.off(name, fn);
  },
  once(name, fn) {
    const off = bus.on(name, (p) => { off(); fn(p); });
    return off;
  },
  off(name, fn) { listeners.get(name)?.delete(fn); },
  emit(name, payload) { for (const fn of [...(listeners.get(name) || [])]) fn(payload); },
};
