#!/usr/bin/env node
/* Cocardo: ¡Rescate Helado! — Arma la carpeta pública del sitio (dist/site/) para publicarla en Cloudflare.
   Solo copia lo que el jugador necesita: index.html, landing.html, landing/, legal/ (Términos, Privacidad y
   Reembolsos), css/, js/, icons/, el manifest, sw.js y el favicon. Lo interno (docs/, tools/, tests/, firebase/,
   redes/, README, package.json) nunca sale del repositorio.
   Añade _headers (misma política de caché que GitHub Pages y firebase.json) y _redirects (la landing vieja).
   No publica si la venta está encendida con la configuración del sandbox, si hay un id de GA4 en js/cloud-config.js
   (todavía no hay aviso de consentimiento: Privacidad §8) ni si quedan marcadores de datos legales ({{NOMBRE_LEGAL}},
   {{EMAIL_SOPORTE}}, {{DIRECCION_POSTAL}}, {{NIF}}: se rellenan con tools/legal-datos.cjs).
   Uso: node tools/cloudflare/build-site.cjs   → dist/site/ (lo usa tools/deploy-cloudflare.sh) */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'dist', 'site');
const PUBLIC = ['index.html', 'landing.html', 'landing', 'legal', 'css', 'js', 'icons', 'manifest.webmanifest', 'sw.js', 'favicon.ico'];
const NEVER = ['docs', 'tools', 'tests', 'firebase', 'redes', 'README.md', 'package.json', '_config.yml', 'CNAME', 'node_modules', '.git'];

// Problemas de js/cloud-config.js que impiden publicar: [] si ninguno.
// - Venta encendida con la configuración de pruebas: para probar el sandbox se pone el token test_…, env 'sandbox' y
//   apiBase, y eso nunca debe llegar a cocardo.app (docs/PAGOS.md §5). La carpeta sale de la copia local, no de git.
// - Un id de GA4: js/analytics.js y la landing cargarían gtag.js (cookies) sin pedir consentimiento (ePrivacy art. 5.3;
//   Lei 41/2004), y Privacidad §8 dice que no hay analítica. Antes hace falta un aviso de consentimiento.
function configProblems(source) {
  const vm = require('vm');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  const cfg = (sandbox.window.Cocardo && sandbox.window.Cocardo.CloudConfig) || {};
  const out = [];
  const pay = cfg.pay || {};
  const why = !pay.on ? '' : pay.env !== 'live' ? `pay.env es «${pay.env}»`
    : /^test_/.test(pay.token || '') ? 'el token es de sandbox (test_…)'
    : pay.apiBase ? `pay.apiBase apunta a «${pay.apiBase}»` : '';
  if (why) out.push(`js/cloud-config.js tiene la venta encendida con configuración de pruebas (${why}). Para publicar: pay.on:false, o env:'live' con el token live_… y apiBase vacío.`);
  if (String(cfg.ga4 || '').trim()) out.push(`js/cloud-config.js tiene ga4 «${cfg.ga4}»: la analítica pone cookies y el juego todavía no pide consentimiento (Privacidad §8 dice que no hay analítica). Deja ga4 vacío hasta tener el aviso de consentimiento y la política actualizada.`);
  return out;
}

function build() {
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

  // Comprobación: la configuración que se publica (js/cloud-config.js) no es la de pruebas ni enciende la analítica
  {
    const why = configProblems(fs.readFileSync(path.join(OUT, 'js', 'cloud-config.js'), 'utf8'));
    if (why.length) {
      for (const w of why) console.error('build-site: ' + w);
      process.exit(1);
    }
  }

  // Comprobación: los datos del vendedor están puestos. Paddle revisa que Términos y Privacidad digan el nombre legal y
  // un contacto, y el DL 7/2004 (art. 10.º) pide además dirección geográfica y NIF (docs/PAGOS.md §6.2): con cualquier
  // marcador {{…}} a la vista no se publica
  {
    const left = require('../legal-datos.cjs').scan(OUT, fs.readdirSync(OUT));
    if (left.length) {
      const keys = [...new Set(left.map((x) => '{{' + x.key + '}}'))].join(', ');
      console.error(`build-site: quedan ${left.length} marcadores de datos legales sin rellenar (${keys}):`);
      for (const x of left.slice(0, 12)) console.error(`  ${x.file}:${x.line}  {{${x.key}}}`);
      if (left.length > 12) console.error(`  … y ${left.length - 12} más (node tools/legal-datos.cjs los lista todos)`);
      console.error("  Para publicar: NOMBRE_LEGAL='…' EMAIL_SOPORTE='…' DIRECCION_POSTAL='…' NIF='…' node tools/legal-datos.cjs --write");
      process.exit(1);
    }
  }

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
}

// tools/legal-datos.cjs usa PUBLIC para saber qué archivos rellenar
module.exports = { PUBLIC, NEVER, configProblems };
if (require.main === module) build();
