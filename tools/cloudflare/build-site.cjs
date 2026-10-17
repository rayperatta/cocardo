#!/usr/bin/env node
/* Cocardo: ¡Rescate Helado! — Arma la carpeta pública del sitio (dist/site/) para publicarla en Cloudflare.
   Solo copia lo que el jugador necesita: index.html, landing.html, landing/, css/, js/, icons/, el manifest, sw.js y el
   favicon. Lo interno (docs/, tools/, tests/, firebase/, redes/, README, package.json) nunca sale del repositorio.
   Añade _headers (misma política de caché que GitHub Pages y firebase.json) y _redirects (la landing vieja).
   Uso: node tools/cloudflare/build-site.cjs   → dist/site/ (lo usa tools/deploy-cloudflare.sh) */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'dist', 'site');
const PUBLIC = ['index.html', 'landing.html', 'landing', 'css', 'js', 'icons', 'manifest.webmanifest', 'sw.js', 'favicon.ico'];
const NEVER = ['docs', 'tools', 'tests', 'firebase', 'redes', 'README.md', 'package.json', '_config.yml', 'CNAME', 'node_modules', '.git'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const p of PUBLIC) {
  const src = path.join(ROOT, p);
  if (!fs.existsSync(src)) { console.error('build-site: falta ' + p); process.exit(1); }
  fs.cpSync(src, path.join(OUT, p), { recursive: true });
}

// Caché del navegador: 10 min para el juego (como servía GitHub Pages: el service worker es «red primero» y así
// un capítulo nuevo llega en la siguiente apertura), sw.js sin caché (el navegador comprueba la versión siempre),
// íconos un día.
// (las reglas se acumulan: la general va primero y las específicas quitan su Cache-Control con «!» antes de poner el suyo)
fs.writeFileSync(path.join(OUT, '_headers'), [
  '/*',
  '  Cache-Control: public, max-age=600',
  '  X-Content-Type-Options: nosniff',
  '',
  '/icons/*',
  '  ! Cache-Control',
  '  Cache-Control: public, max-age=86400',
  '',
  '/sw.js',
  '  ! Cache-Control',
  '  Cache-Control: no-cache',
  '',
].join('\n'));
// La landing vieja vivía en /landing/: redirige a landing.html (landing/index.html queda como respaldo)
fs.writeFileSync(path.join(OUT, '_redirects'), '/landing/ /landing 301\n');   // /landing.html ya redirige solo a /landing

// Comprobación: nada interno se coló
const listed = fs.readdirSync(OUT);
for (const bad of NEVER) if (listed.includes(bad)) { console.error('build-site: ' + bad + ' no debe publicarse'); process.exit(1); }
let files = 0, bytes = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else { files++; bytes += fs.statSync(p).size; }
  }
})(OUT);
console.log(`dist/site: ${files} archivos, ${(bytes / 1024 / 1024).toFixed(2)} MB (${listed.join(', ')})`);
