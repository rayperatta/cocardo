#!/usr/bin/env node
/* Cocardo: ¡Rescate Helado! — Rellena los datos legales del vendedor en los archivos que se publican.
   Mientras el dueño no los da, las páginas legales (legal/), landing.html, index.html y js/cloud-config.js llevan
   marcadores literales. Los cuatro son obligatorios:
     {{NOMBRE_LEGAL}}      nombre legal completo (el mismo de la verificación de identidad de Paddle)
     {{EMAIL_SOPORTE}}     correo de soporte: contacto, privacidad y ayuda con compras
     {{DIRECCION_POSTAL}}  dirección geográfica del prestador (Términos §1 y §14, Privacidad §1): la piden el DL 7/2004,
                           art. 10.º, n.º 1, b) y la política de privacidad mínima de Paddle. Puede ser una dirección
                           profesional o de domiciliación; nunca se deja en blanco
     {{NIF}}               número de identificación fiscal portugués (9 cifras; DL 7/2004, art. 10.º, n.º 1, d))
   (El encargo original solo preveía NOMBRE_LEGAL y EMAIL_SOPORTE: DIRECCION_POSTAL y NIF se añadieron a propósito por
   el art. 10.º del DL 7/2004; docs/PAGOS.md §6.2.)
   tools/cloudflare/build-site.cjs no publica mientras quede alguno (usa scan() de aquí).
   Uso:
     node tools/legal-datos.cjs              → dónde está cada marcador y qué cambiaría (no escribe nada)
     NOMBRE_LEGAL='…' EMAIL_SOPORTE='…' DIRECCION_POSTAL='…' NIF='…' node tools/legal-datos.cjs --write
   Sin alguno de los cuatro, --write no escribe nada (y build-site.cjs sigue sin publicar).
   Cambia los archivos del repositorio: revisa `git diff` y haz commit. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KEYS = ['NOMBRE_LEGAL', 'EMAIL_SOPORTE', 'DIRECCION_POSTAL', 'NIF'];
const MARK = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
const TEXT = /\.(html?|js|cjs|mjs|css|json|webmanifest|txt|xml|svg)$/i;
// se insertan en HTML (texto, atributos entre comillas dobles y JSON-LD) y en cadenas JS entre comillas simples
const UNSAFE = /[<>&"\\{}`\u0000-\u001f\u007f]/;

function publicPaths() { return require('./cloudflare/build-site.cjs').PUBLIC; }

// Archivos de texto bajo las rutas dadas (relativas a root), en orden estable
function listFiles(root, rels) {
  const out = [];
  for (const rel of rels) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    (function walk(p) {
      if (fs.statSync(p).isDirectory()) { for (const n of fs.readdirSync(p).sort()) walk(path.join(p, n)); }
      else if (TEXT.test(p)) out.push(p);
    })(abs);
  }
  return out;
}

// Marcadores {{…}} que quedan (los conocidos y cualquier otro): [{ file (relativo a root), line, key }]
function scan(root, rels) {
  const found = [];
  for (const f of listFiles(root, rels)) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
      for (const m of ln.matchAll(MARK)) found.push({ file: path.relative(root, f), line: i + 1, key: m[1] });
    });
  }
  return found;
}

// NIF portugués: 9 cifras y la última es el dígito de control (módulo 11)
function validNif(n) {
  if (!/^[1-9]\d{8}$/.test(n)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(n[i]) * (9 - i);
  const check = 11 - (sum % 11);
  return Number(n[8]) === (check >= 10 ? 0 : check);
}

// Valores de las variables de entorno: { values, errors }
function check(env) {
  const errors = [];
  const clean = (s) => String(s == null ? '' : s).trim().replace(/\s+/g, ' ');
  const name = clean(env.NOMBRE_LEGAL);
  const mail = clean(env.EMAIL_SOPORTE);
  const addr = clean(env.DIRECCION_POSTAL);
  const nif = clean(env.NIF).replace(/^PT/i, '').replace(/[\s.-]/g, '');
  if (!name) errors.push('falta NOMBRE_LEGAL');
  else if (name.length > 120 || UNSAFE.test(name)) errors.push('NOMBRE_LEGAL es demasiado largo o tiene caracteres no permitidos (< > & " \\ { } `)');
  if (!mail) errors.push('falta EMAIL_SOPORTE');
  else if (mail.length > 254 || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(mail)) errors.push('EMAIL_SOPORTE no parece un correo');
  if (!addr) errors.push('falta DIRECCION_POSTAL (dirección geográfica; DL 7/2004, art. 10.º)');
  else if (addr.length > 200 || UNSAFE.test(addr)) errors.push('DIRECCION_POSTAL es demasiado larga o tiene caracteres no permitidos (< > & " \\ { } `)');
  if (!nif) errors.push('falta NIF (DL 7/2004, art. 10.º)');
  else if (!validNif(nif)) errors.push('NIF no parece un NIF portugués (9 cifras con dígito de control)');
  return { values: { NOMBRE_LEGAL: name, EMAIL_SOPORTE: mail, DIRECCION_POSTAL: addr, NIF: nif }, errors };
}

// En .js el marcador está dentro de una cadena entre comillas simples (js/cloud-config.js)
function encode(value, file) { return /\.[cm]?js$/i.test(file) ? value.replace(/'/g, "\\'") : value; }

// Reemplaza los marcadores que tienen valor. write:false solo dice qué cambiaría
function apply(root, rels, values, write) {
  const changed = [];
  for (const f of listFiles(root, rels)) {
    const before = fs.readFileSync(f, 'utf8');
    const after = before.replace(MARK, (m, key) => (values[key] ? encode(values[key], f) : m));
    if (after === before) continue;
    changed.push(path.relative(root, f));
    if (write) fs.writeFileSync(f, after);
  }
  return changed;
}

function report(found) {
  if (!found.length) { console.log('legal-datos: no quedan marcadores {{…}} en los archivos publicados.'); return; }
  console.log(`legal-datos: ${found.length} marcadores en los archivos publicados:`);
  for (const key of [...new Set(found.map((x) => x.key))]) {
    const at = found.filter((x) => x.key === key);
    console.log(`  {{${key}}} ×${at.length}${KEYS.includes(key) ? '' : '  (desconocido: este script no lo rellena)'}`);
    const lines = new Map();
    for (const x of at) lines.set(`${x.file}:${x.line}`, (lines.get(`${x.file}:${x.line}`) || 0) + 1);
    for (const [where, n] of lines) console.log(`    ${where}${n > 1 ? ` (×${n})` : ''}`);
  }
}

function main(argv, env) {
  const write = argv.includes('--write');
  const rels = publicPaths();
  report(scan(ROOT, rels));
  const { values, errors } = check(env);
  if (!write) {
    if (errors.length) {
      console.log(`\nSin escribir nada (${errors.join('; ')}). Para rellenarlos:`);
      console.log("  NOMBRE_LEGAL='…' EMAIL_SOPORTE='…' DIRECCION_POSTAL='…' NIF='…' node tools/legal-datos.cjs --write");
      return 0;
    }
    const would = apply(ROOT, rels, values, false);
    console.log(`\nCon --write: NOMBRE_LEGAL=«${values.NOMBRE_LEGAL}», EMAIL_SOPORTE=«${values.EMAIL_SOPORTE}», ` +
      `DIRECCION_POSTAL=«${values.DIRECCION_POSTAL}», NIF=«${values.NIF}».\n  Cambiaría: ${would.join(', ') || 'nada'}`);
    return 0;
  }
  if (errors.length) { console.error('legal-datos: ' + errors.join('; ')); return 1; }
  const changed = apply(ROOT, rels, values, true);
  console.log(`\nlegal-datos: escritos ${changed.length} archivos: ${changed.join(', ') || 'ninguno'}`);
  const left = scan(ROOT, rels);
  if (left.length) { console.error('legal-datos: todavía quedan marcadores:'); report(left); return 1; }
  console.log('Revisa `git diff` y haz commit; después ya se puede publicar (tools/deploy-cloudflare.sh).');
  return 0;
}

module.exports = { KEYS, listFiles, scan, check, apply, validNif };
if (require.main === module) process.exit(main(process.argv.slice(2), process.env));
