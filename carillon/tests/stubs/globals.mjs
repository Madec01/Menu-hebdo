// tests/stubs/globals.mjs — globaux navigateur minimaux pour Node : localStorage en mémoire,
// document factice (jamais utilisé par la logique, seulement par le rendu), performance.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
};
if (typeof globalThis.document === 'undefined') {
  globalThis.document = { createElement() { return { width: 0, height: 0, getContext() { return null; } }; }, addEventListener() {} };
}
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
