// Pruebas de la versión completa: códigos firmados, candados, canje y herramienta (node --test tests/*.test.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const License = require('../js/core/license.js');
const Store = require('../js/store.js');

const subtle = crypto.webcrypto.subtle;
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = (({ x, y }) => ({ kty: 'EC', crv: 'P-256', x, y }))(publicKey.export({ format: 'jwk' }));
const other = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;

function sign(serial, opts) {
  const o = opts || {};
  const payload = License._header(o.product || License.PRODUCT_FULL, serial);
  if (o.format) payload[0] = o.format;
  const sig = crypto.sign('sha256', License._message(payload), { key: o.key || privateKey, dsaEncoding: 'ieee-p1363' });
  return License._encode(new Uint8Array([...payload, ...sig]));
}

// Cambia un carácter sin salir del alfabeto ni de la forma canónica
function flip(code, i) { return code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1); }

// ---------------------------------------------------------------- License (puro)
test('License: base64url ida y vuelta, 70 bytes -> 94 caracteres', () => {
  const bytes = new Uint8Array(70).map((_, i) => (i * 37 + 11) & 255);
  const s = License._encode(bytes);
  assert.equal(s.length, License.CODE_LEN);
  assert.equal(s, Buffer.from(bytes).toString('base64url'));
  const d = License.decode(License._encode(new Uint8Array([1, 1, 0, 0, 1, 2, ...new Uint8Array(64)])));
  assert.equal(d.serial, 258);
  assert.equal(d.product, 1);
  assert.equal(d.sig.length, 64);
});

test('License: firma válida -> ok, con serie y producto', async () => {
  const code = sign(4471);
  assert.equal(code.length, 94);
  const r = await License.verify(code, subtle, jwk);
  assert.deepEqual(r, { ok: true, reason: 'ok', code, serial: 4471, product: 1 });
  const big = await License.verify(sign(0xFFFFFFFF), subtle, jwk);
  assert.equal(big.ok, true);
  assert.equal(big.serial, 0xFFFFFFFF);
});

test('License: normalize acepta enlace, hash con otros parámetros y saltos de línea', async () => {
  const code = sign(12);
  assert.equal(License.normalize(code), code);
  assert.equal(License.normalize('https://x.github.io/cocardo/#licencia=' + code), code);
  assert.equal(License.normalize('#debug&licencia=' + code + '&otro=1'), code);
  assert.equal(License.normalize('  ' + code.slice(0, 40) + '\n' + code.slice(40) + '\n'), code);
  assert.equal(License.normalize(code.slice(1)), null);
  assert.equal(License.normalize(code + 'A'), null);
  assert.equal(License.normalize(code.replace(/.$/, '+')), null);
  assert.equal(License.normalize(null), null);
  assert.equal((await License.verify('https://x/#licencia=' + code, subtle, jwk)).ok, true);
});

test('License: alterar cualquier parte rompe la firma', async () => {
  const code = sign(99);
  // 3 y 7 = cabecera (producto y serie), 30 y 80 = firma
  for (const i of [3, 7, 30, 80]) {
    const r = await License.verify(flip(code, i), subtle, jwk);
    assert.equal(r.ok, false, 'posición ' + i);
    assert.ok(['signature', 'product', 'format'].includes(r.reason), r.reason);
  }
  assert.equal((await License.verify(sign(99, { key: other }), subtle, jwk)).reason, 'signature');
});

test('License: formato, producto, anulados, sin clave y sin crypto', async () => {
  const code = sign(5);
  assert.equal((await License.verify('hola', subtle, jwk)).reason, 'format');
  assert.equal((await License.verify(sign(5, { format: 2 }), subtle, jwk)).reason, 'format');
  // 94 caracteres = 70 bytes + 4 bits de relleno que deben ir en 0 (forma canónica)
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const v = B64.indexOf(code[93]);
  assert.equal(v & 15, 0);
  assert.equal(License.decode(code.slice(0, 93) + B64[v | 1]), null);
  assert.equal((await License.verify(sign(5, { product: 2 }), subtle, jwk)).reason, 'product');
  assert.equal((await License.verify(code, subtle, null)).reason, 'nokey');
  assert.equal((await License.verify(code, null, jwk)).reason, 'nocrypto');
  assert.equal((await License.verify(code, {}, jwk)).reason, 'nocrypto');
  License.REVOKED.push(5);
  try {
    const r = await License.verify(code, subtle, jwk);
    assert.equal(r.reason, 'revoked');
    assert.equal(r.serial, 5);
  } finally { License.REVOKED.pop(); }
  // sin jwk explícito usa PUBLIC_KEY (la de producción: no reconoce códigos de otra clave)
  assert.equal((await License.verify(code, subtle)).reason, 'signature');
  const k = License.PUBLIC_KEY;
  License.PUBLIC_KEY = null;
  try { assert.equal((await License.verify(code, subtle)).reason, 'nokey'); } finally { License.PUBLIC_KEY = k; }
});

test('License: candados en el borde 10/11', () => {
  assert.equal(License.FREE_LEVELS, 10);
  assert.equal(License.isLevelLocked(1, false), false);
  assert.equal(License.isLevelLocked(10, false), false);
  assert.equal(License.isLevelLocked(11, false), true);
  assert.equal(License.isLevelLocked(30, false), true);
  assert.equal(License.isLevelLocked(30, true), false);
});

test('License: módulo puro (sin window, document, localStorage, Date ni Math.random)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../js/core/license.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    .replace("(typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {})", '');
  for (const bad of ['window', 'document', 'localStorage', 'Date', 'Math.random']) assert.ok(!src.includes(bad), bad);
});

// ---------------------------------------------------------------- Store (entorno simulado)
function fakeEnv(hash, protocol) {
  const calls = [];
  const location = { protocol: protocol || 'https:', origin: 'https://fan.example', pathname: '/cocardo/', search: '', hash: hash || '' };
  return {
    calls,
    env: {
      location,
      history: { replaceState: (s, t, url) => { calls.push(url); location.hash = url.includes('#') ? url.slice(url.indexOf('#')) : ''; } },
      subtle,
      now: () => 1760000000000,
    },
  };
}

function withStore(fn) {
  return async () => {
    const saved = { key: License.PUBLIC_KEY, buy: Store.config.buyUrl, contact: Store.config.contact };
    License.PUBLIC_KEY = jwk;
    Store.config.buyUrl = 'https://ejemplo.itch.io/cocardo-completo';
    Store.config.contact = 'juego@example.com';
    Store._memory.license = null;
    try { await fn(); } finally {
      License.PUBLIC_KEY = saved.key;
      Store.config.buyUrl = saved.buy;
      Store.config.contact = saved.contact;
      Store._memory.license = null;
      Store._setEnv(null);
    }
  };
}

test('Store: falta clave, enlace de compra o contacto -> no bloquea nada', withStore(async () => {
  assert.equal(Store.selling(), true);
  for (const [field, obj] of [['PUBLIC_KEY', License], ['buyUrl', Store.config], ['contact', Store.config]]) {
    const v = obj[field];
    obj[field] = field === 'PUBLIC_KEY' ? null : '';
    assert.equal(Store.selling(), false, 'sin ' + field);
    assert.equal(Store.isLocked(11), false, 'sin ' + field);
    obj[field] = v;
  }
  assert.equal(Store.isLocked(11), true);
}));

test('Store: configuración publicada (precio y aviso de fans; la venta espera enlace y correo)', () => {
  assert.equal(Store.config.price, 'US$1,99');
  assert.match(Store.config.fanNote, /^Juego de fans hecho con permiso de la creadora\./);
  assert.doesNotMatch(Store.config.fanNote, /oficial/i);
  assert.equal(Store.selling(), !!(Store.config.buyUrl && Store.config.contact));
});

test('License: la clave pública del repo corresponde a la privada de producción (código de control anulado)', async () => {
  // Serie 0 firmada con la clave privada de producción. Está anulada: no desbloquea nada.
  const control = 'AQEAAAAA-xUEK1edzkzmYrlogwTRf5lJNY7g9OBsMf_sny_diy2FzEiomQ-eZpfzIvV_yXhzmsnY6u1O07KDPvYkjluvBQ';
  assert.ok(License.PUBLIC_KEY && License.PUBLIC_KEY.crv === 'P-256');
  assert.deepEqual(License.REVOKED, [0]);
  assert.equal((await License.verify(control, subtle)).reason, 'revoked');
  License.REVOKED.length = 0;
  try {
    const r = await License.verify(control, subtle);
    assert.equal(r.reason, 'ok', 'la clave pública no coincide con la que firmó el control');
    assert.equal(r.serial, 0);
  } finally { License.REVOKED.push(0); }
});

test('Store: con venta activa bloquea 11–30 hasta canjear', withStore(async () => {
  const { env } = fakeEnv();
  Store._setEnv(env);
  assert.equal(Store.selling(), true);
  assert.equal(Store.isLocked(10), false);
  assert.equal(Store.isLocked(11), true);
  const seen = [];
  const off = Store.onChange((full) => seen.push(full));
  const bad = await Store.redeem('basura');
  assert.equal(bad.reason, 'format');
  assert.equal(Store.isFull(), false);
  const code = sign(321);
  const r = await Store.redeem('\n' + code + '\n');
  assert.equal(r.ok, true);
  assert.equal(Store.isFull(), true);
  assert.equal(Store.isLocked(30), false);
  assert.equal(Store.code(), code);
  assert.deepEqual(Store._memory.license, { code, serial: 321, product: 1, at: 1760000000000 });
  assert.deepEqual(seen, [true]);
  off();
}));

test('Store: init canjea #licencia=… y lo borra del hash sin tocar lo demás', withStore(async () => {
  const code = sign(77);
  const { env, calls } = fakeEnv('#debug&licencia=' + code);
  Store._setEnv(env);
  const r = await Store.init({ show: false });
  assert.equal(r.redeemed, true);
  assert.equal(Store.isFull(), true);
  assert.deepEqual(calls, ['/cocardo/#debug']);
  assert.equal(env.location.hash, '#debug');
  // un enlace falso no borra la licencia que ya había
  const fake = fakeEnv('#licencia=' + flip(sign(78), 50));
  Store._setEnv(fake.env);
  const r2 = await Store.init({ show: false });
  assert.equal(r2.redeemed, false);
  assert.equal(r2.result.reason, 'signature');
  assert.equal(Store.code(), code);
}));

test('Store: init revisa la licencia guardada (anulada -> se quita; sin crypto -> se respeta)', withStore(async () => {
  const code = sign(500);
  Store._memory.license = { code, serial: 500, product: 1, at: 1 };
  const { env } = fakeEnv('');
  Store._setEnv(env);
  assert.deepEqual(await Store.init({ show: false }), { redeemed: false });
  assert.equal(Store.isFull(), true);
  Store._setEnv(Object.assign({}, env, { subtle: null }));
  License.REVOKED.push(500);
  try {
    await Store.init({ show: false });
    assert.equal(Store.isFull(), false, 'anulada se quita aunque no haya crypto');
    Store._memory.license = { code, serial: 500, product: 1, at: 1 };
    License.REVOKED.pop();
    await Store.init({ show: false });
    assert.equal(Store.isFull(), true, 'sin crypto se confía en lo guardado');
  } finally { if (License.REVOKED[License.REVOKED.length - 1] === 500) License.REVOKED.pop(); }
  Store._setEnv(env);
  Store._memory.license = { code: 'debug', serial: 0, product: 1, at: 1 };
  await Store.init({ show: false });
  assert.equal(Store.isFull(), false, 'un código inválido guardado se quita');
}));

test('Store: detecta cuando corre dentro de itch.io', withStore(async () => {
  const { env } = fakeEnv();
  for (const [host, want] of [['html-classic.itch.zone', true], ['v6p9d9t4.ssl.hwcdn.itch.zone', true], ['fan.itch.io', true],
    ['fan.example', false], ['itch.zone.example.com', false], ['', false]]) {
    Store._setEnv(Object.assign({}, env, { location: Object.assign({}, env.location, { hostname: host }) }));
    assert.equal(Store.onItch(), want, host);
  }
}));

test('Store: setFull (debug) enciende y apaga la versión completa', withStore(async () => {
  Store._setEnv(fakeEnv().env);
  Store.setFull(true);
  assert.equal(Store.isFull(), true);
  assert.equal(Store.isLocked(20), false);
  Store.setFull(false);
  assert.equal(Store.isFull(), false);
  assert.equal(Store.isLocked(20), true);
}));

test('Store en el navegador: guarda la licencia en Cocardo.Save y llama save()', async () => {
  const vm = require('node:vm');
  const saveData = { v: 1, unlocked: 1, license: null };
  let saves = 0;
  const location = { protocol: 'file:', origin: 'null', pathname: '/x/index.html', search: '', hash: '#licencia=' + sign(9) };
  const win = {
    location,
    history: { replaceState: (s, t, url) => { location.hash = url.includes('#') ? url.slice(url.indexOf('#')) : ''; } },
    crypto: crypto.webcrypto,
    Cocardo: { Save: { get: () => saveData, save: () => { saves++; } } },
  };
  win.window = win;
  const ctx = vm.createContext(win);
  for (const f of ['../js/core/license.js', '../js/store.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), ctx, { filename: f });
  }
  const S = win.Cocardo.Store;
  win.Cocardo.License.PUBLIC_KEY = jwk;
  S.config.buyUrl = 'https://ejemplo.itch.io/cocardo-completo';
  S.config.contact = 'juego@example.com';
  assert.equal(S.isLocked(11), true);
  const r = await S.init({ show: false });
  assert.equal(r.redeemed, true);
  assert.equal(saveData.license.serial, 9);
  assert.equal(typeof saveData.license.at, 'number');
  assert.ok(saves >= 1);
  assert.equal(location.hash, '');
  assert.equal(S.isLocked(11), false);
  assert.equal(S.canVerify(), true);
});

// ---------------------------------------------------------------- tools/license.cjs
test('tools/license.cjs: keygen, sign, batch y verify', () => {
  const tool = path.join(__dirname, '../tools/license.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cocardo-lic-'));
  const run = (...args) => execFileSync(process.execPath, [tool, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const key = path.join(dir, 'k.pem');
    const out = run('keygen', '--out', key);
    assert.match(out, /PUBLIC_KEY: \{ kty: 'EC', crv: 'P-256', x: '[\w-]{43}', y: '[\w-]{43}' \}/);
    assert.equal(fs.statSync(key).mode & 0o777, 0o600);
    const signed = run('sign', '--key', key, '--serial', '42', '--url', 'https://fan.example/cocardo/');
    const code = signed.match(/código \(94\): ([\w-]{94})/)[1];
    assert.ok(signed.includes('enlace: https://fan.example/cocardo/#licencia=' + code));
    assert.match(run('verify', code, '--key', key), /ok serie=42 producto=1/);
    assert.throws(() => run('sign', '--key', key, '--serial', '42'), /ya se usó/);
    const csv = path.join(dir, 'lote.csv');
    run('batch', '--key', key, '--from', '100', '--count', '3', '--csv', csv, '--url', 'https://fan.example/c/');
    const rows = fs.readFileSync(csv, 'utf8').trim().split('\n');
    assert.equal(rows[0], 'serie,codigo,enlace');
    assert.equal(rows.length, 4);
    assert.match(rows[3], /^102,[\w-]{94},https:\/\/fan\.example\/c\/#licencia=[\w-]{94}$/);
    assert.match(run('verify', rows[1].split(',')[2], '--key', key), /ok serie=100/);
    // sin --url: solo serie y código; --txt: un código por línea
    const csv2 = path.join(dir, 'lote2.csv'), txt = path.join(dir, 'lote2.txt');
    run('batch', '--key', key, '--from', '200', '--count', '2', '--csv', csv2, '--txt', txt);
    assert.match(fs.readFileSync(csv2, 'utf8'), /^serie,codigo\n200,[\w-]{94}\n201,[\w-]{94}\n$/);
    const codes = fs.readFileSync(txt, 'utf8').trim().split('\n');
    assert.equal(codes.length, 2);
    assert.match(run('verify', codes[1], '--key', key), /ok serie=201/);
    assert.ok(!run('sign', '--key', key, '--serial', '300').includes('enlace:'));
    assert.equal(fs.readFileSync(path.join(dir, 'licencias.csv'), 'utf8').trim().split('\n').length, 8);
    assert.throws(() => run('keygen', '--out', path.join(__dirname, 'no.pem')), /dentro del repo/);
    assert.ok(!fs.existsSync(path.join(__dirname, 'no.pem')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
