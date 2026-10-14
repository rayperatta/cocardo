#!/usr/bin/env node
// Claves y códigos de la versión completa (ver docs/MONETIZACION.md §5).
// Uso:
//   node tools/license.cjs keygen --out ~/.cocardo/licencia.pem
//   node tools/license.cjs pub    --key ~/.cocardo/licencia.pem
//   node tools/license.cjs sign   --key ~/.cocardo/licencia.pem --serial 123 [--note "Ko-fi #4471"] [--url https://…/]
//   node tools/license.cjs batch  --key ~/.cocardo/licencia.pem --from 200 --count 50 --csv ~/.cocardo/lote.csv [--txt …] [--url …]
//   node tools/license.cjs verify "<código o enlace>" [--key ~/.cocardo/licencia.pem]
// --url agrega el enlace https://…/#licencia=<código> (no sirve dentro de itch.io: ahí el código se pega).
// --txt escribe un código por línea, listo para cargar como claves externas en la tienda.
// La clave privada y las listas de códigos nunca se guardan dentro del repo: el comando se niega.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const License = require('../js/core/license.js');

const root = path.resolve(__dirname, '..');

function fail(msg) { console.error('error: ' + msg); process.exit(1); }

function parse(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) opts[a.slice(2)] = true;
      else { opts[a.slice(2)] = next; i++; }
    } else opts._.push(a);
  }
  return opts;
}

function expand(p) { return path.resolve(p.replace(/^~(?=$|\/)/, os.homedir())); }

function outsideRepo(p, what) {
  const rel = path.relative(root, p);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) fail(`${what} no puede ir dentro del repo (${p})`);
  return p;
}

function int(v, name) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 0xFFFFFFFF) fail(`--${name} debe ser un entero entre 1 y 4294967295`);
  return n;
}

function loadKey(opts) {
  if (!opts.key || opts.key === true) fail('falta --key <archivo.pem>');
  try { return crypto.createPrivateKey(fs.readFileSync(expand(opts.key))); } catch (e) { fail('no pude leer la clave: ' + e.message); }
}

function publicJwk(key) {
  const jwk = crypto.createPublicKey(key).export({ format: 'jwk' });
  return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
}

function printPublic(jwk) {
  console.log('Pega esto en js/core/license.js:');
  console.log(`    PUBLIC_KEY: { kty: 'EC', crv: 'P-256', x: '${jwk.x}', y: '${jwk.y}' },`);
}

function makeCode(key, serial) {
  const payload = License._header(License.PRODUCT_FULL, serial);
  const sig = crypto.sign('sha256', License._message(payload), { key, dsaEncoding: 'ieee-p1363' });
  const bytes = new Uint8Array(payload.length + sig.length);
  bytes.set(payload, 0);
  bytes.set(sig, payload.length);
  return License._encode(bytes);
}

function link(base, code) { return base.replace(/#.*$/, '') + '#licencia=' + code; }
function urlOf(opts) { return typeof opts.url === 'string' ? opts.url : null; }

// Registro de números de serie usados, junto a la clave
function logFile(opts) { return path.join(path.dirname(expand(opts.key)), 'licencias.csv'); }

function usedSerials(file) {
  try {
    return new Set(fs.readFileSync(file, 'utf8').split('\n').slice(1).map((l) => Number(l.split(',')[0])).filter(Boolean));
  } catch (e) { return new Set(); }
}

function record(file, rows) {
  const head = fs.existsSync(file) ? '' : 'serie,fecha,nota\n';
  const date = new Date().toISOString().slice(0, 10);
  fs.appendFileSync(file, head + rows.map((r) => `${r.serial},${date},${JSON.stringify(r.note || '')}`).join('\n') + '\n',
    { mode: 0o600 });
}

const cmds = {
  keygen(opts) {
    if (!opts.out || opts.out === true) fail('falta --out <archivo.pem> (fuera del repo)');
    const out = outsideRepo(expand(opts.out), 'la clave privada');
    if (fs.existsSync(out) && !opts.force) fail(`${out} ya existe (usa --force para reemplazarla e invalidar todos los códigos)`);
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    console.log(`clave privada: ${out} (0600). Guárdala con respaldo y NO la subas al repo.`);
    printPublic(publicJwk(privateKey));
  },

  pub(opts) { printPublic(publicJwk(loadKey(opts))); },

  sign(opts) {
    const key = loadKey(opts);
    const serial = int(opts.serial, 'serial');
    const file = logFile(opts);
    if (usedSerials(file).has(serial) && !opts.force) fail(`la serie ${serial} ya se usó (ver ${file}); usa otra o --force`);
    const code = makeCode(key, serial);
    record(file, [{ serial, note: typeof opts.note === 'string' ? opts.note : '' }]);
    console.log(`serie ${serial} · producto ${License.PRODUCT_FULL}`);
    console.log(`código (${code.length}): ${code}`);
    if (urlOf(opts)) console.log(`enlace: ${link(urlOf(opts), code)}`);
  },

  batch(opts) {
    const key = loadKey(opts);
    const from = int(opts.from, 'from');
    const count = int(opts.count, 'count');
    if (!opts.csv || opts.csv === true) fail('falta --csv <archivo.csv> (fuera del repo)');
    const csv = outsideRepo(expand(opts.csv), 'la lista de códigos');
    const txt = typeof opts.txt === 'string' ? outsideRepo(expand(opts.txt), 'la lista de códigos') : null;
    const file = logFile(opts);
    const used = usedSerials(file);
    const base = urlOf(opts);
    const rows = [];
    for (let s = from; s < from + count; s++) {
      if (used.has(s) && !opts.force) fail(`la serie ${s} ya se usó (ver ${file})`);
      rows.push({ serial: s, code: makeCode(key, s), note: 'lote ' + path.basename(csv) });
    }
    const line = (r) => [r.serial, r.code].concat(base ? [link(base, r.code)] : []).join(',');
    fs.writeFileSync(csv, (base ? 'serie,codigo,enlace\n' : 'serie,codigo\n') + rows.map(line).join('\n') + '\n', { mode: 0o600 });
    if (txt) fs.writeFileSync(txt, rows.map((r) => r.code).join('\n') + '\n', { mode: 0o600 });
    record(file, rows);
    console.log(`${rows.length} códigos (series ${from}–${from + count - 1}) en ${csv}` + (txt ? ` y ${txt}` : ''));
  },

  async verify(opts) {
    const input = opts._[1];
    if (!input) fail('falta el código o enlace');
    const jwk = opts.key ? publicJwk(loadKey(opts)) : License.PUBLIC_KEY;
    const r = await License.verify(input, crypto.webcrypto.subtle, jwk);
    console.log(r.ok ? `ok serie=${r.serial} producto=${r.product}` : `inválido (${r.reason})${r.serial != null ? ' serie=' + r.serial : ''}`);
    if (!r.ok) process.exitCode = 1;
  },
};

const opts = parse(process.argv.slice(2));
const cmd = cmds[opts._[0]];
if (!cmd) {
  console.error(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(2);
}
Promise.resolve(cmd(opts)).catch((e) => fail(e.message));
