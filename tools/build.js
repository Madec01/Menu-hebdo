#!/usr/bin/env node
'use strict';
/* Assemble le jeu en un seul fichier HTML autonome : dist/betes-de-papier.html */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="style.css">/, '<style>\n' + css + '\n</style>');
html = html.replace(/<script src="(js\/[a-z]+\.js)"><\/script>/g, (m, file) => {
  const src = fs.readFileSync(path.join(root, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>\n/* ---- ' + file + ' ---- */\n' + src + '\n</script>';
});
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'betes-de-papier.html');
fs.writeFileSync(out, html);
console.log('écrit', out, (fs.statSync(out).size / 1024).toFixed(0) + ' Ko');
