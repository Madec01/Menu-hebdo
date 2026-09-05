/* Assemble dev/*.js + style.css + shell.html → ../index.html (un seul fichier, aucune dépendance). */
const fs = require('fs'), path = require('path');
const dev = __dirname, out = path.join(dev, '..', 'index.html');
const ORDER = ['00_core.js', 'AudioEngine.js', 'content.js', '10_content_api.js', '15_sprites.js', '20_progression.js', '30_entities.js', '32_enemies.js', '34_traps.js', '40_room.js', '50_ui.js', '60_meta.js', '70_debug.js', '90_main.js'];
let html = fs.readFileSync(path.join(dev, 'shell.html'), 'utf8');
html = html.replace('/*@@STYLE@@*/', fs.readFileSync(path.join(dev, 'style.css'), 'utf8'));
const scripts = ORDER.map(f => `<script>\n/* ==== ${f} ==== */\n${fs.readFileSync(path.join(dev, f), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n');
html = html.replace('<!--@@SCRIPTS@@-->', scripts);
fs.writeFileSync(out, html);
console.log('index.html :', (fs.statSync(out).size / 1024).toFixed(0), 'Ko');
