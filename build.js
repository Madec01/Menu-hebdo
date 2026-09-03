// Assemble src/ en un seul index.html (et optionnellement une version "artefact" sans squelette HTML).
// Usage : node build.js [chemin/vers/artefact.html]
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'src');
const js = fs.readdirSync(src).filter(f => /^\d\d-.*\.js$/.test(f)).sort().map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
const css = fs.readFileSync(path.join(src, 'style.css'), 'utf8');
const markup = fs.readFileSync(path.join(src, 'markup.html'), 'utf8');
const tpl = fs.readFileSync(path.join(src, 'index.tpl.html'), 'utf8');
const out = tpl.replace('/*CSS*/', () => css).replace('<!--MARKUP-->', () => markup).replace('/*JS*/', () => js);
fs.writeFileSync(path.join(__dirname, 'index.html'), out);
console.log('index.html :', (out.length / 1024).toFixed(0), 'Ko');
const artOut = process.argv[2];
if (artOut) {
  const head = out.match(/<title>[\s\S]*?<\/style>/)[0];
  const body = out.match(/<body>\n([\s\S]*)<\/body>/)[1];
  fs.writeFileSync(artOut, head + '\n' + body);
  console.log('artefact :', artOut);
}
