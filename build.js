/* Genere core.html : un seul fichier autonome, tous les scripts inlines.
   Usage : node build.js   ->  core.html  */
const fs = require('fs');
const path = require('path');

const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)];
if (!scripts.length) throw new Error('aucun <script src> trouve dans index.html');

let bundle = '';
for (const [, src] of scripts) {
  const code = fs.readFileSync(path.join(root, src), 'utf8');
  bundle += '\n/* ============================ ' + src + ' ============================ */\n' + code;
}

// On remplace le premier <script src> par le bundle, on supprime les autres.
// Le remplacement passe par une fonction : le code contient des "$'" et "$&",
// qui seraient interpretes comme des motifs de remplacement dans une chaine.
html = html.replace(scripts[0][0], () => '<script>' + bundle + '\n</script>');
for (let i = 1; i < scripts.length; i++) html = html.replace(scripts[i][0], '');
html = html.replace(/\n{3,}/g, '\n\n');

fs.writeFileSync(path.join(root, 'core.html'), html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log('core.html genere — ' + scripts.length + ' scripts inlines, ' + kb + ' Ko');
