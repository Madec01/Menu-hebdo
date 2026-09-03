// Assemble src/ en un seul index.html (et optionnellement une version "artefact" sans squelette HTML).
// Les assets (planche de sprites, sons) sont embarqués en data URI.
// Usage : node build.js [chemin/vers/artefact.html]
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'src');
const assetsDir = path.join(src, 'assets');

const sprites = fs.readFileSync(path.join(assetsDir, 'sprites.png')).toString('base64');
const atlas = fs.readFileSync(path.join(assetsDir, 'sprites.json'), 'utf8');
const sfx = {};
for (const f of fs.readdirSync(path.join(assetsDir, 'sfx')).filter(f => f.endsWith('.wav')).sort()) {
  sfx[f.replace('.wav', '')] = 'data:audio/wav;base64,' + fs.readFileSync(path.join(assetsDir, 'sfx', f)).toString('base64');
}
const assetsJs = `/* ===== assets (sprites : Crypte Infinie ; sons : Kenney, CC0) ===== */\nconst ASSETS = { sprites: 'data:image/png;base64,${sprites}', atlas: ${atlas}, sfx: ${JSON.stringify(sfx)} };\n`;

const js = assetsJs + fs.readdirSync(src).filter(f => /^\d\d-.*\.js$/.test(f)).sort().map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
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
