/* Pruebas del candado de pago en la interfaz (js/ui.js con Cocardo.Pay), del orden de carga de js/pay.js y del
 * service worker. js/ui.js, js/core/levels.js, js/core/roadmap.js y js/pay.js corren en un contexto aparte (vm) con
 * window y document mínimos: aquí solo se prueban las funciones que no tocan el DOM (Cocardo.UI._pay). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LEVELS = read('js/core/levels.js');
const ROADMAP = read('js/core/roadmap.js');
const UI = read('js/ui.js');
const PAY = read('js/pay.js');
const TODAY = 20261017;   // capítulos 1 a 6 construidos y abiertos; el 7 se abre el 30 de octubre

// Contexto con Levels + Roadmap + ui.js. pay: objeto Cocardo.Pay (falso), 'real' (js/pay.js con payCfg) o null
function ui(pay, payCfg) {
  const win = { console, Cocardo: { debugToday: TODAY }, matchMedia: undefined, setTimeout, clearTimeout };
  win.window = win;
  win.document = {};
  vm.createContext(win);
  vm.runInContext(LEVELS, win, { filename: 'js/core/levels.js' });
  vm.runInContext(ROADMAP, win, { filename: 'js/core/roadmap.js' });
  if (pay === 'real') {
    win.Cocardo.CloudConfig = { pay: payCfg };
    win.location = { protocol: 'https:', hostname: 'cocardo.app', search: '', pathname: '/', hash: '' };
    win.top = win;
    win.self = win;
    vm.runInContext(PAY, win, { filename: 'js/pay.js' });
  } else if (pay) {
    win.Cocardo.Pay = pay;
  }
  vm.runInContext(UI, win, { filename: 'js/ui.js' });
  return { win, P: win.Cocardo.UI._pay };
}

// Cocardo.Pay falso con la venta encendida (FREE = 10)
function fakePay(o) {
  o = o || {};
  const st = { premium: !!o.premium };
  return {
    st,
    FREE: 10,
    on: () => true,
    premium: () => st.premium,
    allowed: (id) => id <= 10 || st.premium,
    state: () => ({ on: true, premium: st.premium, busy: false, pending: false }),
  };
}

test('Juego completo: sin js/pay.js, playable() es el de siempre (construido y abierto por fecha)', () => {
  const { P } = ui(null);
  for (let id = 1; id <= 30; id++) assert.equal(P.playable(id), true, 'nivel ' + id);
  assert.equal(P.playable(0), false);
  assert.equal(P.playable(31), false, 'capítulo 7 en construcción');
  for (let id = 1; id <= 31; id++) assert.equal(P.blocked(id), false);
});

test('Juego completo: con js/pay.js y pay.on:false (configuración publicada) nada cambia', () => {
  for (const cfg of [{ on: false, freeLevels: 10, token: '', priceId: '' }, { on: false, freeLevels: 10, token: 'live_x', priceId: 'pri_x' }]) {
    const { P, win } = ui('real', cfg);
    assert.equal(win.Cocardo.Pay.on(), false);
    for (let id = 1; id <= 30; id++) assert.equal(P.playable(id), true, 'nivel ' + id);
    assert.equal(P.playable(31), false);
    for (let id = 1; id <= 31; id++) assert.equal(P.blocked(id), false);
  }
});

test('Juego completo: venta encendida sin compra -> 1..10 jugables y 11+ cerrados solo por el pago', () => {
  const pay = fakePay();
  const { P } = ui(pay);
  for (let id = 1; id <= 10; id++) { assert.equal(P.playable(id), true); assert.equal(P.blocked(id), false); }
  for (let id = 11; id <= 30; id++) { assert.equal(P.playable(id), false, 'nivel ' + id); assert.equal(P.blocked(id), true, 'nivel ' + id); }
  // lo que no está construido o abierto no es «culpa» del pago (ficha de la hoja de ruta, como siempre)
  assert.equal(P.blocked(31), false);
  assert.equal(P.blocked(120), false);
  // con la compra se quita el tope (la progresión la sigue mirando el mapa con save.unlocked)
  pay.st.premium = true;
  for (let id = 1; id <= 30; id++) { assert.equal(P.playable(id), true); assert.equal(P.blocked(id), false); }
  assert.equal(P.playable(31), false);
});

test('Juego completo: un capítulo programado (fecha por llegar) no muestra la ficha de pago', () => {
  const pay = fakePay();
  const { P, win } = ui(pay);
  const ch3 = win.Cocardo.Levels.chapters[2];
  ch3.opens = '2026-12-01';
  try {
    assert.equal(P.playable(11), false);
    assert.equal(P.blocked(11), false, 'cerrado por fecha: ficha del capítulo');
    assert.equal(P.blocked(20), false, 'tapa a los que vienen después');
    pay.st.premium = true;
    assert.equal(P.playable(11), false, 'comprar no salta la fecha');
  } finally { delete ch3.opens; }
});

test('Juego completo: el texto de la ficha sale de Levels y Roadmap (sin spoilers)', () => {
  const { P } = ui(fakePay());
  const items = P.pitch();
  assert.equal(items[0].t, 'Capítulos 3 al 6 · 20 niveles más');
  assert.equal(items[1].t, 'Capítulos nuevos, sin pagar otra vez');
  assert.equal(items[1].s, 'Próximo: capítulo 7 · previsto para el viernes 30 de octubre', 'donde se vende, la fecha es prevista (Términos §5), no «se abre»');
  assert.equal(items[2].t, 'El Reto Diario sigue gratis para todos');
});

test('Juego completo: un capítulo construido antes de su estreno no se cuenta en la ficha hasta que se abre', () => {
  const { P, win } = ui(fakePay());
  const L = win.Cocardo.Levels;
  // el capítulo 7 ya construido (CALENDARIO: se copia en Levels.chapters con `opens`), todavía programado
  L.chapters.push({ id: 7, name: 'Cherry… interesante', zone: 'La oficina de Don Piña', color: '#c99a3a', levels: [31, 32, 33, 34, 35], opens: '2026-10-30' });
  try {
    const items = P.pitch();
    assert.equal(items[0].t, 'Capítulos 3 al 6 · 20 niveles más', 'solo lo que ya se puede jugar');
    assert.equal(items[1].s, 'Próximo: capítulo 7 · previsto para el viernes 30 de octubre', 'y el 7 sigue como próximo estreno');
    assert.equal(P.blocked(31), false, 'cerrado por fecha: la ficha del capítulo, no la de pago');
  } finally { L.chapters.pop(); }
});

test('Juego completo: sin precio local de Paddle, la ficha muestra el de lista (se ve cuánto cuesta antes de pagar)', () => {
  const { P } = ui(fakePay());
  assert.equal(P.priceLine('', false), 'Pago único, sin suscripción', 'mientras se pide el precio local: una línea');
  assert.equal(P.priceLine('', true), '<b>US$1,99 (1,99 € en la zona euro), impuestos incluidos</b> · pago único', 'Paddle no lo dio');
  assert.equal(P.priceLine('1,99 €', false), '<b>1,99 €</b> · pago único, sin suscripción');
});

test('Juego completo: el precio de respaldo (dos monedas) no se muestra; el de Paddle sí', () => {
  const { P } = ui(fakePay());
  assert.equal(P.priceText('US$1,99 · 1,99 €'), '');
  assert.equal(P.priceText('1,99 €'), '1,99 €');
  assert.equal(P.priceText('US$1.99'), 'US$1.99');
  assert.equal(P.priceText(''), '');
  assert.equal(P.priceText(undefined), '');
});

test('Juego completo: un pago hecho con el enlace en otro navegador no deja «Procesando tu pago…» en este', () => {
  const { P } = ui(fakePay());
  assert.equal(P.waiting({ pending: true, external: false }), true, 'pagó aquí: se espera el aviso del servidor');
  assert.equal(P.waiting({ pending: true, external: true }), false, 'la compra es de la cuenta que creó el enlace');
  assert.equal(P.waiting({ pending: false, external: true }), false);
});

/* «Ya pagué»: los mensajes salen de lo que responde el Worker (400 invalid, 409 pending, 409 limit) pasando por
 * Cocardo.Pay.restore de verdad, así un cambio de texto en js/pay.js no rompe la traducción sin que se note */
function payRestoreReason(status, body) {
  const store = new Map();
  const user = { uid: 'u1', anon: false };
  const win = {
    console, setTimeout, clearTimeout,
    location: { protocol: 'https:', hostname: 'cocardo.app', search: '', pathname: '/', hash: '' },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    addEventListener: () => {},
    document: { createElement: () => ({}), head: { appendChild: () => {} } },
    fetch: () => Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) }),
    Cocardo: {
      CloudConfig: { pay: { on: true, freeLevels: 10, env: 'sandbox', token: 'test_abc', priceId: 'pri_123', apiBase: '' } },
      Cloud: {
        available: () => true, user: () => user, state: () => 'ready', authKnown: () => true, onChange: () => {},
        authReady: () => Promise.resolve('u1'), idToken: () => Promise.resolve('tok'), watchDoc: () => () => {}, message: () => '',
      },
    },
  };
  win.window = win;
  win.top = win;
  win.self = win;
  vm.createContext(win);
  vm.runInContext(PAY, win, { filename: 'js/pay.js' });
  return win.Cocardo.Pay.restore('325-10566', 'ana@example.com').then((r) => { assert.equal(r.ok, false); return r.reason; });
}

test('Juego completo: «Ya pagué» traduce los errores del Worker a mensajes cortos', async () => {
  const { P } = ui(fakePay());
  const invalid = 'No encontramos esa compra. Revisa el número de factura y el correo.';
  const pending = 'Tu pago todavía se está procesando. Prueba otra vez en unos minutos.';
  // sin correo de soporte en la configuración: la ayuda al comprador de Paddle (nunca un «escríbenos» sin dirección)
  const limit = 'Esta compra ya cambió de cuenta demasiadas veces. Pide ayuda en paddle.net con tu número de factura.';
  assert.equal(P.restoreMessage('invalid'), invalid);
  assert.equal(P.restoreMessage('pending'), pending);
  assert.equal(P.restoreMessage('limit'), limit);
  assert.equal(P.restoreMessage(await payRestoreReason(400, { error: 'invalid' })), invalid);
  assert.equal(P.restoreMessage(await payRestoreReason(404, { error: 'not_found' })), invalid);
  assert.equal(P.restoreMessage(await payRestoreReason(409, { error: 'pending' })), pending);
  assert.equal(P.restoreMessage(await payRestoreReason(409, { error: 'limit' })), limit);
  // los demás (sin conexión, demasiados intentos, campos vacíos) pasan tal cual
  const rate = await payRestoreReason(429, { error: 'rate' });
  assert.equal(P.restoreMessage(rate), rate);
  assert.notEqual(rate, limit);
  // todos terminan en punto
  assert.equal(P.restoreMessage('Escribe el correo con el que pagaste'), 'Escribe el correo con el que pagaste.');
  assert.equal(P.restoreMessage(''), 'Algo falló. Inténtalo otra vez.');
  // otro dominio (o sin nube): Cocardo.Pay lo dice «para comprar»; en «Ya pagué» se vino a recuperar una compra
  assert.equal(P.restoreMessage(await payRestoreReason(403, { error: 'origin' })), 'Para recuperar tu compra abre el juego en cocardo.app.');
  assert.equal(P.restoreMessage('Para comprar abre el juego en cocardo.app con internet.'), 'Para recuperar tu compra abre el juego en cocardo.app con internet.');
});

test('Juego completo: con un correo de soporte en CloudConfig.pay.support, el límite de traslados lo da', () => {
  const { P, win } = ui(fakePay());
  win.Cocardo.CloudConfig = { pay: { support: 'ayuda@cocardo.app' } };
  assert.equal(P.restoreMessage('limit'), 'Esta compra ya cambió de cuenta demasiadas veces. Escríbenos a ayuda@cocardo.app con tu número de factura.');
  assert.deepEqual({ ...P.support() }, { text: 'ayuda@cocardo.app', href: 'mailto:ayuda@cocardo.app', mail: true });
  win.Cocardo.CloudConfig = { pay: { support: 'no es un correo' } };
  assert.equal(P.support().text, 'paddle.net');
});

test('Juego completo: el editor de apodo espera a que termine el pago (Pay.state().busy) y luego se abre', () => {
  // UI.init() con nube y pago falsos: se guardan sus escuchas para avisar a mano
  const asked = [];
  let cloudFn = null, payFn = null;
  const st = { on: true, premium: false, busy: true, pending: false, event: '' };
  const pay = Object.assign(fakePay(), { state: () => Object.assign({}, st), onChange: (fn) => { payFn = fn; } });
  const { win } = ui(pay);
  const user = { uid: 'anon1', anon: true };
  win.addEventListener = () => {};
  win.location = { search: '' };
  Object.assign(win.document, { addEventListener: () => {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] });
  win.Cocardo.Cloud = {
    onChange: (fn) => { cloudFn = fn; }, user: () => user, profile: () => null, available: () => true,
    // showProfileEditor pide un apodo sugerido antes de dibujar: aquí se anota y se corta (no hay DOM)
    suggestNick: () => { asked.push('nick'); throw new Error('sin DOM'); },
  };
  win.Cocardo.UI.init();
  assert.equal(typeof cloudFn, 'function');
  assert.equal(typeof payFn, 'function');
  const snap = { state: 'ready', user, profile: null, profileReady: true, error: '' };
  cloudFn(snap);
  assert.deepEqual(asked, [], 'con el pago abierto no se pide apodo');
  st.busy = false;
  st.event = 'change';
  assert.throws(() => payFn(Object.assign({}, st)), /sin DOM/);
  assert.deepEqual(asked, ['nick'], 'busy pasó a false: se pide el apodo');
  // una sola vez por sesión
  st.event = 'change';
  payFn(Object.assign({}, st));
  cloudFn(snap);
  assert.deepEqual(asked, ['nick']);
});

test('Juego completo: sin pago en curso el apodo se pide como siempre (venta apagada)', () => {
  const asked = [];
  let cloudFn = null;
  const { win } = ui(null);
  const user = { uid: 'g1', anon: false };
  win.addEventListener = () => {};
  win.location = { search: '' };
  Object.assign(win.document, { addEventListener: () => {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] });
  win.Cocardo.Cloud = { onChange: (fn) => { cloudFn = fn; }, user: () => user, profile: () => null, available: () => true, suggestNick: () => { asked.push('nick'); throw new Error('sin DOM'); } };
  win.Cocardo.UI.init();
  assert.throws(() => cloudFn({ state: 'ready', user, profile: null, profileReady: true, error: '' }), /sin DOM/);
  assert.deepEqual(asked, ['nick']);
});

test('Juego completo: index.html carga js/pay.js después de la nube y la analítica, antes de ui.js y main.js', () => {
  const order = [...read('index.html').matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  const i = order.indexOf('js/pay.js');
  assert.ok(i > 0, 'index.html carga js/pay.js');
  for (const before of ['js/cloud-config.js', 'js/cloud.js', 'js/analytics.js', 'js/save.js']) assert.ok(order.indexOf(before) < i, before + ' antes');
  for (const after of ['js/ui.js', 'js/main.js']) assert.ok(order.indexOf(after) > i, after + ' después');
});

test('Juego completo: el service worker guarda js/pay.js y nunca /api/, /__/ ni Paddle.js', () => {
  const src = read('sw.js');
  const self = { location: new URL('https://cocardo.app/sw.js'), addEventListener: () => {} };
  const ctx = { self, URL, caches: {}, fetch: () => {}, Response: {} };
  vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__sw = { CORE: CORE, VERSION: VERSION, cacheable: cacheable };', ctx, { filename: 'sw.js' });
  const sw = ctx.__sw;
  assert.ok(sw.CORE.includes('./js/pay.js'));
  assert.ok(sw.CORE.indexOf('./js/pay.js') < sw.CORE.indexOf('./js/ui.js'));
  assert.notEqual(sw.VERSION, 'cocardo-v1.2.0', 'VERSION nueva para que los jugadores reciban js/pay.js');
  const ok = (u) => sw.cacheable(new URL(u));
  assert.equal(ok('https://cocardo.app/'), true);
  assert.equal(ok('https://cocardo.app/js/pay.js'), true);
  assert.equal(ok('https://cocardo.app/?_ptxn=txn_01abc'), true);
  assert.equal(ok('https://cocardo.app/api/health'), false);
  assert.equal(ok('https://cocardo.app/api/checkout'), false);
  assert.equal(ok('https://cocardo.app/__/auth/handler'), false);
  assert.equal(ok('https://cdn.paddle.com/paddle/v2/paddle.js'), false);
  assert.equal(ok('https://sandbox-buy.paddle.com/checkout'), false);
  assert.equal(ok('https://fonts.gstatic.com/s/x.woff2'), true);
});
