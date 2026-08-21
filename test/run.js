#!/usr/bin/env node
/* =====================================================================
   ARCHITECTE LOGIQUE — harnais de test headless (2/3 : lanceur)
   Extrait le <script> du HTML autonome, le concatène entre
   test/pre.js (stubs navigateur) et test/post.js (les tests), puis
   exécute le tout dans un contexte vm isolé.
       node test/run.js [chemin/du/fichier.html]
   Code de sortie : 0 si tout passe, 1 sinon.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const htmlPath = path.resolve(process.argv[2] || path.join(root, 'logicgates.html'));

if (!fs.existsSync(htmlPath)){
  console.error('✗ Fichier introuvable : ' + htmlPath);
  process.exit(1);
}
const html = fs.readFileSync(htmlPath, 'utf8');

/* Le jeu est un HTML autonome : un seul <script> non typé, sans attribut. */
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
if (scripts.length !== 1){
  console.error('✗ Attendu exactement 1 bloc <script> dans le HTML, trouvé ' + scripts.length + '.');
  process.exit(1);
}
const game = scripts[0];

const pre  = fs.readFileSync(path.join(__dirname, 'pre.js'), 'utf8');
const post = fs.readFileSync(path.join(__dirname, 'post.js'), 'utf8');

/* Concaténation : le code du jeu déclare tout en const/let de portée script,
   post.js doit donc vivre dans LE MÊME script pour y accéder. */
const source = [
  '/* ---- pre.js ---- */', pre,
  '/* ---- jeu ---- */',    game,
  '/* ---- post.js ---- */', post,
  '__runTests();'
].join('\n');

const sandbox = { console, setTimeout, clearTimeout, setInterval, clearInterval, process, Math, JSON };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

let result;
try {
  result = vm.runInContext(source, sandbox, { filename:'architecte-logique.bundle.js', timeout: 120000 });
} catch (e){
  console.error('✗ Erreur fatale au chargement du jeu :');
  console.error(e && e.stack || e);
  process.exit(1);
}
process.exit(result && result.failed ? 1 : 0);
