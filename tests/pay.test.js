/* Pruebas de Cocardo.Pay (candado de niveles, jugadores antiguos, compra por cuenta) y del #debug de main.js.
 * js/pay.js se ejecuta en un contexto aparte (vm) con window, localStorage, fetch, Paddle y Cocardo.Cloud falsos:
 * nada sale a la red. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PAY = fs.readFileSync(path.join(__dirname, '../js/pay.js'), 'utf8');
const MAIN = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
const KEY = 'cocardo.v1.premium';
const CHECKED = 'cocardo.v1.premium.checked';
const PAY_ON = { on: true, freeLevels: 10, env: 'sandbox', token: 'test_abc', priceId: 'pri_123', apiBase: '' };

// Objetos de otro contexto (vm) a objetos de aquí, para comparar con deepEqual
const plain = (o) => JSON.parse(JSON.stringify(o));
const flush = () => new Promise((r) => setImmediate(r));
function save(unlocked, stars) {
  const s = new Array(120).fill(0);
  Object.keys(stars || {}).forEach((k) => { s[k] = stars[k]; });
  return { v: 1, unlocked: unlocked, stars: s, cloud: { on: false, nick: '', avatar: '', uid: '' } };
}

/* Arma un navegador falso y carga js/pay.js. o: { pay, user, storage, save, search, protocol, framed, cloudState,
 * fetch(url, init) -> { status, body }, preview } */
function env(o) {
  o = o || {};
  const store = new Map(Object.entries(o.storage || {}));
  const n = { fetch: 0, scripts: 0, signInAnon: 0, watch: 0, onChange: 0, init: 0, envSet: [], open: [], preview: 0 };
  const calls = [];
  const events = [];
  const timers = [];
  const watchers = [];
  const cloudListeners = [];
  let user = o.user || null;

  const Paddle = {
    Environment: { set: (e) => { n.envSet.push(e); } },
    Initialize: (opts) => { n.init++; Paddle._opts = opts; },
    Checkout: { open: (opts) => { n.open.push(opts); } },
    PricePreview: (req) => {
      n.preview++;
      Paddle._req = req;
      if (o.preview === 'fail') return Promise.reject(new Error('boom'));
      return Promise.resolve({ data: { details: { lineItems: [{ formattedTotals: { subtotal: '1,62 €', total: '1,99 €' } }] } } });
    },
  };
  const Cloud = {
    available: () => o.cloudAvailable !== false,
    user: () => user,
    state: () => o.cloudState || (user ? 'ready' : 'idle'),
    onChange: (fn) => { n.onChange++; cloudListeners.push(fn); },
    signInAnon: () => { n.signInAnon++; user = { uid: 'anon1', anon: true }; cloudListeners.forEach((f) => f({ user })); return Promise.resolve(user); },
    authReady: () => Promise.resolve(user ? user.uid : ''),
    authKnown: () => o.authKnown !== false,
    takeAnonToken: (uid) => { const t = o.anonTokens && o.anonTokens[uid]; if (o.anonTokens) delete o.anonTokens[uid]; return t || ''; },
    idToken: (force) => Promise.resolve(force ? 'tok2' : 'tok1'),
    message: () => '',
    watchDoc: (p, cb, err) => {
      n.watch++;
      const w = { path: p, cb, err, off: false };
      watchers.push(w);
      return () => { w.off = true; };
    },
  };
  const win = {
    location: { protocol: o.protocol || 'https:', hostname: 'cocardo.app', search: o.search || '', pathname: '/', hash: '' },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
    },
    document: {
      createElement: (tag) => { n.scripts++; return { tag }; },
      head: { appendChild: (s) => { win.Paddle = Paddle; Promise.resolve().then(() => s.onload()); } },
    },
    fetch: (url, init) => {
      n.fetch++;
      calls.push({ url, init });
      const r = o.fetch ? o.fetch(url, init) : { status: 200, body: { transactionId: 'txn_01abc', checkoutUrl: 'https://cocardo.app/?_ptxn=txn_01abc' } };
      return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: () => Promise.resolve(r.body) });
    },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; },
    addEventListener: () => {},
    history: { state: null, replaceState: (s, t, u) => { win._replaced = u; } },
    console,
    Cocardo: {
      CloudConfig: { pay: Object.assign({}, o.pay === undefined ? PAY_ON : o.pay) },
      Cloud: o.noCloud ? undefined : Cloud,
      Save: o.save ? { get: () => o.save } : undefined,
      Track: { event: (name, params) => { events.push([name, plain(params || {})]); } },
    },
  };
  win.window = win;
  win.self = win;
  win.top = o.framed ? {} : win;
  vm.createContext(win);
  vm.runInContext(PAY, win, { filename: 'js/pay.js' });
  return {
    win, Pay: win.Cocardo.Pay, Paddle, n, calls, events, timers, watchers, store,
    setUser(u) { user = u; cloudListeners.forEach((f) => f({ user })); },
    lastWatch() { return watchers[watchers.length - 1]; },
    cached() { return store.has(KEY) ? JSON.parse(store.get(KEY)) : null; },
  };
}

/* ---------- on() y allowed() ---------- */

test('Pay apagado: todo permitido y premium() es false', () => {
  const t = env({ pay: { on: false, freeLevels: 10, token: 'test_abc', priceId: 'pri_123' } });
  assert.equal(t.Pay.on(), false);
  [1, 10, 11, 30, 120].forEach((id) => assert.equal(t.Pay.allowed(id), true, 'nivel ' + id));
  assert.equal(t.Pay.premium(), false);
  assert.equal(t.Pay.state().on, false);
});

test('Pay.on(): exige token, priceId, http(s) y no estar en un iframe', () => {
  assert.equal(env().Pay.on(), true);
  assert.equal(env({ pay: Object.assign({}, PAY_ON, { token: '' }) }).Pay.on(), false);
  assert.equal(env({ pay: Object.assign({}, PAY_ON, { priceId: '' }) }).Pay.on(), false);
  assert.equal(env({ protocol: 'file:' }).Pay.on(), false);
  assert.equal(env({ framed: true }).Pay.on(), false);
  assert.equal(env({ pay: null }).Pay.on(), false);
  const off = env({ protocol: 'file:' });
  assert.equal(off.Pay.allowed(11), true, 'sin venta activa no hay candado');
});

test('Pay activo sin compra: 1–10 se pueden empezar, 11 en adelante no (también capítulos futuros)', () => {
  const t = env();
  assert.equal(t.Pay.FREE, 10);
  for (let id = 1; id <= 10; id++) assert.equal(t.Pay.allowed(id), true, 'nivel ' + id);
  [11, 12, 30, 31, 60, 120].forEach((id) => assert.equal(t.Pay.allowed(id), false, 'nivel ' + id));
  assert.equal(t.Pay.premium(), false);
});

test('Pay activo con compra: todo permitido; freeLevels configurable', () => {
  const dev = env({ storage: { [KEY]: JSON.stringify({ device: { legacy: true, at: 1 }, accounts: {} }) } });
  [1, 11, 120].forEach((id) => assert.equal(dev.Pay.allowed(id), true));
  const acc = env({ user: { uid: 'A' }, storage: { [KEY]: JSON.stringify({ device: null, accounts: { A: { order: 'txn_1', at: 1 } } }) } });
  [1, 11, 120].forEach((id) => assert.equal(acc.Pay.allowed(id), true));
  const five = env({ pay: Object.assign({}, PAY_ON, { freeLevels: 5 }) });
  assert.equal(five.Pay.allowed(5), true);
  assert.equal(five.Pay.allowed(6), false);
});

/* ---------- jugadores de antes de la venta ---------- */

test('legacyCheck: unlocked > 10 en la primera revisión da permiso al aparato', () => {
  const t = env();
  assert.equal(t.Pay.legacyCheck(save(11)), true);
  assert.equal(t.store.get(CHECKED), '1');
  assert.equal(t.cached().device.legacy, true);
  assert.equal(t.Pay.premium(), true);
  assert.equal(t.Pay.state().legacy, true);
  assert.equal(t.Pay.allowed(120), true);
});

test('legacyCheck: corre una sola vez por aparato; después unlocked ya no cuenta', () => {
  const t = env();
  assert.equal(t.Pay.legacyCheck(save(5)), false);
  assert.equal(t.store.get(CHECKED), '1');
  // un jugador nuevo gana el nivel 10 después del lanzamiento: unlocked = 11, sigue sin permiso
  assert.equal(t.Pay.legacyCheck(save(11)), false);
  assert.equal(t.Pay.legacyCheck(save(30)), false);
  assert.equal(t.cached(), null, 'no se escribió ningún permiso');
  // otra carga de la página con la marca ya puesta
  const again = env({ storage: { [CHECKED]: '1' } });
  assert.equal(again.Pay.legacyCheck(save(25)), false);
  assert.equal(again.Pay.premium(), false);
});

test('legacyCheck: haber ganado el nivel 11 (stars[10] > 0) cuenta solo en la primera revisión', () => {
  const t = env();
  assert.equal(t.Pay.legacyCheck(save(5, { 10: 1 })), true, 'guardado viejo con el 11 ganado');
  assert.equal(t.Pay.premium(), true);
  // ya revisado: ganar el 11 después (alguien que pagó, o un guardado de la nube) no da permiso al aparato
  const later = env({ storage: { [CHECKED]: '1' } });
  assert.equal(later.Pay.legacyCheck(save(11, { 9: 3 })), false, 'ganar el 10 no basta');
  assert.equal(later.Pay.legacyCheck(save(12, { 10: 1 })), false);
  assert.equal(later.Pay.premium(), false);
  assert.equal(later.cached(), null);
});

test('un comprador que ganó el 11 y pidió el reembolso pierde el acceso en todos lados', () => {
  const s = save(5);
  const t = env({ user: { uid: 'A' }, save: s });
  t.Pay.init();   // primera vez: aparato nuevo, sin permiso
  assert.equal(t.Pay.premium(), false);
  t.lastWatch().cb({ exists: true, fromCache: false, data: { premium: true, order: 'txn_1', source: 'paddle', at: 1 } });
  assert.equal(t.Pay.allowed(11), true);
  // gana el 11 y el 12, y la nube avisa cambios (sync) varias veces
  s.unlocked = 13;
  s.stars[10] = 3;
  s.stars[11] = 2;
  t.setUser({ uid: 'A' });
  t.setUser({ uid: 'A' });
  assert.equal(t.cached().device, null, 'el progreso no da permiso al aparato');
  // reembolso: el Worker borra entitlements/A
  t.lastWatch().cb({ exists: false, fromCache: false, data: null });
  assert.equal(t.Pay.premium(), false);
  assert.equal(t.Pay.allowed(12), false);
  t.setUser({ uid: 'B' });
  assert.equal(t.Pay.premium(), false, 'otra cuenta en el mismo aparato tampoco');
  t.setUser(null);
  assert.equal(t.Pay.premium(), false, 'ni sin sesión');
});

test('legacyCheck: con la venta apagada no hace nada ni pone la marca', () => {
  const t = env({ pay: Object.assign({}, PAY_ON, { on: false }) });
  assert.equal(t.Pay.legacyCheck(save(30, { 10: 3 })), false);
  assert.equal(t.store.has(CHECKED), false);
  assert.equal(t.store.has(KEY), false);
});

test('init(): revisa el guardado al arrancar', () => {
  const t = env({ save: save(20) });
  t.Pay.init();
  assert.equal(t.Pay.premium(), true);
  assert.equal(t.store.get(CHECKED), '1');
});

/* ---------- compra por cuenta ---------- */

test('entitlements/{uid}: la compra de la cuenta A no vale para la cuenta B', () => {
  const t = env({ user: { uid: 'A' } });
  t.Pay.init();
  const wa = t.lastWatch();
  assert.equal(wa.path, 'entitlements/A');
  wa.cb({ exists: true, fromCache: false, data: { premium: true, order: 'txn_1', source: 'paddle', at: { toMillis: () => 1234 } } });
  assert.equal(t.Pay.premium(), true);
  assert.deepEqual(t.cached().accounts, { A: { order: 'txn_1', at: 1234 } });

  t.setUser({ uid: 'B' });
  assert.equal(wa.off, true, 'se deja de escuchar la cuenta anterior');
  const wb = t.lastWatch();
  assert.equal(wb.path, 'entitlements/B');
  assert.equal(t.Pay.premium(), false);
  assert.equal(t.Pay.allowed(11), false);
  wb.cb({ exists: false, fromCache: false, data: null });
  assert.deepEqual(Object.keys(t.cached().accounts), ['A'], 'la respuesta de B no toca la copia de A');
  // un aviso tardío de la escucha vieja no cuenta
  wa.cb({ exists: false, fromCache: false, data: null });
  assert.equal(t.cached().accounts.A.order, 'txn_1');

  t.setUser(null);
  assert.equal(wb.off, true);
  assert.equal(t.Pay.premium(), false);
  t.setUser({ uid: 'A' });
  assert.equal(t.Pay.premium(), true, 'al volver a A la copia local sigue valiendo');
});

test('entitlements/{uid}: se ignora fromCache && !exists; el servidor sí puede quitar la compra', () => {
  const t = env({ user: { uid: 'A' }, storage: { [KEY]: JSON.stringify({ device: null, accounts: { A: { order: 'txn_1', at: 1 } } }) } });
  t.Pay.init();
  const w = t.lastWatch();
  w.cb({ exists: false, fromCache: true, data: null });
  assert.equal(t.Pay.premium(), true, 'una caché vacía (sin conexión) no borra la compra');
  w.cb({ exists: true, fromCache: false, data: { premium: false, order: 'txn_1' } });
  assert.equal(t.Pay.premium(), false, 'devuelta');
  w.cb({ exists: true, fromCache: true, data: { premium: true, order: 'txn_2', at: 5 } });
  assert.equal(t.Pay.premium(), true);
  w.cb({ exists: false, fromCache: false, data: null });
  assert.equal(t.Pay.premium(), false, 'movida a otra cuenta con «Ya pagué»');
});

test('el permiso del aparato (jugador antiguo) sobrevive a cambiar de cuenta y a cerrar sesión', () => {
  const t = env({ user: { uid: 'A' }, save: save(15) });
  t.Pay.init();
  assert.equal(t.Pay.premium(), true);
  t.lastWatch().cb({ exists: false, fromCache: false, data: null });
  t.setUser({ uid: 'B' });
  assert.equal(t.Pay.premium(), true);
  t.setUser(null);
  assert.equal(t.Pay.premium(), true);
  assert.equal(t.Pay.allowed(120), true);
  assert.deepEqual(plain(t.Pay.state()).legacy, true);
});

test('antes de que cargue el SDK vale la última cuenta del aparato (no aparece el candado al abrir)', () => {
  const s = save(12);
  s.cloud = { on: true, nick: 'Lima', avatar: 'lima', uid: 'A' };
  const store = { [CHECKED]: '1', [KEY]: JSON.stringify({ device: null, accounts: { A: { order: 'txn_1', at: 1 } } }) };
  assert.equal(env({ save: s, storage: store, cloudState: 'idle' }).Pay.premium(), true);
  assert.equal(env({ save: s, storage: store, cloudState: 'error' }).Pay.premium(), true, 'sin internet el SDK no carga');
  assert.equal(env({ save: s, storage: store, cloudState: 'ready' }).Pay.premium(), false, 'SDK listo sin usuario = sesión cerrada');
  // SDK cargado pero Firebase todavía no avisó si había sesión (el candado no parpadea al abrir)
  assert.equal(env({ save: s, storage: store, cloudState: 'ready', authKnown: false }).Pay.premium(), true);
  const out = save(12);
  out.cloud = { on: false, nick: '', avatar: '', uid: 'A' };
  assert.equal(env({ save: out, storage: store, cloudState: 'idle' }).Pay.premium(), false);
});

/* ---------- venta apagada: nada se descarga ---------- */

test('pay.on = false: nunca carga Paddle ni llama a fetch, ni escucha la nube', async () => {
  const t = env({ pay: { on: false, freeLevels: 10, env: 'sandbox', token: 'test_abc', priceId: 'pri_123', apiBase: '' }, save: save(30, { 10: 3 }), user: { uid: 'A' }, search: '?_ptxn=txn_01abc' });
  t.Pay.init();
  assert.equal(await t.Pay.price(), 'US$1,99 · 1,99 €');
  const b = await t.Pay.buy({ level: 11 });
  assert.equal(b.ok, false);
  const r = await t.Pay.restore('325-1', 'a@b.co');
  assert.equal(r.ok, false);
  t.Pay.legacyCheck(save(30, { 10: 3 }));
  t.Pay.refresh();
  assert.equal(t.Pay.allowed(99), true);
  await flush();
  assert.equal(t.n.fetch, 0);
  assert.equal(t.n.scripts, 0);
  assert.equal(t.win.Paddle, undefined);
  assert.equal(t.n.watch, 0);
  assert.equal(t.n.onChange, 0);
  assert.equal(t.n.signInAnon, 0);
  assert.equal(t.store.size, 0, 'no escribe nada en localStorage');
});

/* ---------- comprar ---------- */

test('buy(): sin usuario entra con apodo, pide la transacción con el token y abre Paddle una sola vez', async () => {
  const t = env();
  t.Pay.init();
  const r = await t.Pay.buy({ level: 11 });
  assert.equal(r.ok, true);
  assert.equal(t.n.signInAnon, 1);
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0].url, '/api/checkout');
  assert.equal(t.calls[0].init.method, 'POST');
  assert.equal(t.calls[0].init.headers.authorization, 'Bearer tok1');
  assert.equal(t.n.scripts, 1);
  assert.deepEqual(t.n.envSet, ['sandbox']);
  assert.equal(t.n.init, 1);
  assert.equal(t.Paddle._opts.token, 'test_abc');
  assert.equal(typeof t.Paddle._opts.eventCallback, 'function');
  assert.deepEqual(plain(t.n.open[0]), { transactionId: 'txn_01abc', settings: { displayMode: 'overlay', locale: 'es', variant: 'one-page' } });
  assert.equal(t.Pay.externalUrl(), 'https://cocardo.app/?_ptxn=txn_01abc');
  assert.equal(t.lastWatch().path, 'entitlements/anon1', 'escucha la compra del usuario nuevo');
  assert.deepEqual(t.events[0], ['checkout_start', { level: 11 }]);

  await t.Pay.buy({ level: 12 });
  assert.equal(t.n.init, 1, 'Paddle.Initialize solo una vez por página');
  assert.equal(t.n.scripts, 1);
  assert.equal(t.n.open.length, 2);
  assert.equal(t.n.signInAnon, 1, 'reusa el usuario');
});

test('buy(): checkout.completed deja pending hasta que llega entitlements/{uid}; luego cerrar no es cancelar', async () => {
  const t = env({ user: { uid: 'A' } });
  t.Pay.init();
  const seen = [];
  t.Pay.onChange((s) => seen.push(s.event));
  await t.Pay.buy();
  const cb = t.Paddle._opts.eventCallback;
  cb({ name: 'checkout.completed', data: { transaction_id: 'txn_01abc', currency_code: 'EUR', totals: { total: 1.99 } } });
  assert.equal(t.Pay.state().pending, true);
  assert.equal(t.Pay.premium(), false);
  const slowT = t.timers.find((x) => x.ms === 60000);
  assert.ok(slowT, 'aviso de «Procesando tu pago…» a los 60 s');
  slowT.fn();
  assert.equal(t.Pay.state().slow, true);
  t.lastWatch().cb({ exists: true, fromCache: false, data: { premium: true, order: 'txn_01abc', source: 'paddle' } });
  const s = t.Pay.state();
  assert.equal(s.pending, false);
  assert.equal(s.slow, false);
  assert.equal(s.premium, true);
  assert.equal(s.event, 'premium');
  cb({ name: 'checkout.closed', data: { transaction_id: 'txn_01abc', status: 'completed' } });
  assert.ok(seen.indexOf('cancel') < 0);
  assert.ok(seen.indexOf('completed') >= 0);
  assert.deepEqual(t.events.find((e) => e[0] === 'purchase'), ['purchase', { transaction_id: 'txn_01abc', currency: 'EUR', value: 1.99 }]);
  assert.equal(t.events.some((e) => e[0] === 'checkout_cancel'), false);
});

test('buy(): cerrar el pago sin terminar avisa cancel', async () => {
  const t = env({ user: { uid: 'A' } });
  t.Pay.init();
  const seen = [];
  t.Pay.onChange((s) => seen.push(s.event));
  await t.Pay.buy();
  t.Paddle._opts.eventCallback({ name: 'checkout.closed', data: { status: 'ready' } });
  assert.equal(seen[seen.length - 1], 'cancel');
  assert.equal(t.Pay.state().pending, false);
  assert.ok(t.events.some((e) => e[0] === 'checkout_cancel'));
});

test('buy(): {already:true} no abre Paddle y vuelve a escuchar la compra', async () => {
  const t = env({ user: { uid: 'A' }, fetch: () => ({ status: 200, body: { already: true } }) });
  t.Pay.init();
  const before = t.n.watch;
  const r = await t.Pay.buy();
  assert.equal(r.ok, true);
  assert.equal(r.already, true);
  assert.equal(t.n.open.length, 0);
  assert.equal(t.n.watch, before + 1);
  assert.equal(t.Pay.state().event, 'already');
});

test('buy({ overlay:false }): solo crea la transacción (enlace para Safari/Chrome), sin descargar Paddle', async () => {
  const t = env({ user: { uid: 'A' } });
  const r = await t.Pay.buy({ overlay: false });
  assert.equal(r.ok, true);
  assert.equal(r.url, 'https://cocardo.app/?_ptxn=txn_01abc');
  assert.equal(t.n.scripts, 0);
  assert.equal(t.Pay.externalUrl(), r.url);
  t.setUser({ uid: 'B' });
  assert.equal(t.Pay.externalUrl(), '', 'el enlace es de la cuenta que lo creó');
});

test('buy(): un error del Worker deja un mensaje y no abre Paddle; 401 se reintenta con token nuevo', async () => {
  const bad = env({ user: { uid: 'A' }, fetch: () => ({ status: 503, body: { error: 'down' } }) });
  const r = await bad.Pay.buy();
  assert.equal(r.ok, false);
  assert.match(r.reason, /no está disponible/);
  assert.equal(bad.Pay.state().error, r.reason);
  assert.equal(bad.n.open.length, 0);

  let first = true;
  const t = env({ user: { uid: 'A' }, fetch: () => { if (first) { first = false; return { status: 401, body: {} }; } return { status: 200, body: { transactionId: 'txn_02', checkoutUrl: 'https://cocardo.app/?_ptxn=txn_02' } }; } });
  const ok = await t.Pay.buy();
  assert.equal(ok.ok, true);
  assert.equal(t.calls.length, 2);
  assert.equal(t.calls[1].init.headers.authorization, 'Bearer tok2');
});

test('env live: no se llama Paddle.Environment.set', async () => {
  const t = env({ user: { uid: 'A' }, pay: Object.assign({}, PAY_ON, { env: 'live', token: 'live_abc' }) });
  await t.Pay.buy();
  assert.deepEqual(t.n.envSet, []);
  assert.equal(t.n.init, 1);
});

test('?_ptxn=txn_…: init() carga Paddle (que abre ese pago solo) y marca external; al cerrar se limpia la dirección', async () => {
  const t = env({ search: '?_ptxn=txn_01abc&r=lima' });
  t.Pay.init();
  await flush();
  assert.equal(t.n.init, 1);
  assert.equal(t.n.open.length, 0, 'Paddle.js abre el pago del enlace por su cuenta');
  assert.equal(t.Pay.state().external, true);
  t.Paddle._opts.eventCallback({ name: 'checkout.completed', data: { transaction_id: 'txn_01abc' } });
  assert.equal(t.Pay.state().external, true, 'la compra va a la cuenta que creó el enlace');
  t.Paddle._opts.eventCallback({ name: 'checkout.closed', data: {} });
  assert.equal(t.win._replaced, '/?r=lima');
});

/* ---------- precio ---------- */

test('price(): total con impuestos de Paddle.PricePreview, en caché; si falla, el texto de respaldo', async () => {
  const t = env();
  assert.equal(await t.Pay.price(), '1,99 €');
  assert.deepEqual(plain(t.Paddle._req), { items: [{ priceId: 'pri_123', quantity: 1 }] });
  assert.equal(await t.Pay.price(), '1,99 €');
  assert.equal(t.n.preview, 1);
  assert.equal(t.Pay.state().price, '1,99 €');
  const f = env({ preview: 'fail' });
  assert.equal(f.Pay.state().price, 'US$1,99 · 1,99 €');
  assert.equal(await f.Pay.price(), 'US$1,99 · 1,99 €');
});

/* ---------- «Ya pagué» ---------- */

test('restore(): valida, envía factura y correo con el token y espera la compra movida', async () => {
  const t = env({ user: { uid: 'A' }, fetch: () => ({ status: 200, body: { ok: true } }) });
  t.Pay.init();
  assert.equal((await t.Pay.restore('', 'a@b.co')).ok, false);
  assert.equal((await t.Pay.restore('325-10566', 'correo')).ok, false);
  assert.equal(t.n.fetch, 0);
  const r = await t.Pay.restore(' 325-10566 ', ' a@b.co ');
  assert.equal(r.ok, true);
  assert.equal(t.calls[0].url, '/api/restore');
  assert.deepEqual(JSON.parse(t.calls[0].init.body), { invoice: '325-10566', email: 'a@b.co' });
  assert.equal(t.Pay.state().pending, true);
  assert.ok(t.events.some((e) => e[0] === 'restore_purchase'));
  t.lastWatch().cb({ exists: true, fromCache: false, data: { premium: true, order: 'txn_9', source: 'paddle' } });
  assert.equal(t.Pay.premium(), true);
  assert.equal(t.Pay.state().pending, false);

  const no = env({ user: { uid: 'A' }, fetch: () => ({ status: 400, body: { error: 'invalid' } }) });
  const r2 = await no.Pay.restore('325-1', 'a@b.co');
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /No encontramos esa compra/);
  assert.equal(no.Pay.state().pending, false);
  const wait = env({ user: { uid: 'A' }, fetch: () => ({ status: 409, body: { error: 'pending' } }) });
  assert.match((await wait.Pay.restore('325-1', 'a@b.co')).reason, /todavía se está procesando/);
  const lim = env({ user: { uid: 'A' }, fetch: () => ({ status: 409, body: { error: 'limit' } }) });
  assert.match((await lim.Pay.restore('325-1', 'a@b.co')).reason, /demasiadas veces/);
  // una respuesta 200 que no dice ok:true no es éxito (y restore() no rechaza la promesa)
  const odd = env({ user: { uid: 'A' }, fetch: () => ({ status: 200, body: { ok: false } }) });
  const r3 = await odd.Pay.restore('325-1', 'a@b.co');
  assert.equal(r3.ok, false);
  assert.match(r3.reason, /No encontramos esa compra/);
  assert.equal(odd.Pay.state().busy, false);
  const sb = env({ user: { uid: 'A' }, fetch: () => ({ status: 403, body: { error: 'sandbox' } }) });
  assert.match((await sb.Pay.restore('325-1', 'a@b.co')).reason, /en pruebas/);
});

test('apiBase: las llamadas van a esa dirección', async () => {
  const t = env({ user: { uid: 'A' }, pay: Object.assign({}, PAY_ON, { apiBase: 'https://pagos.example.workers.dev/' }) });
  await t.Pay.buy({ overlay: false });
  assert.equal(t.calls[0].url, 'https://pagos.example.workers.dev/api/checkout');
});

test('track(): paywall_view y los demás eventos van a Cocardo.Track', () => {
  const t = env();
  t.Pay.track('paywall_view', { level: 11 });
  assert.deepEqual(t.events, [['paywall_view', { level: 11 }]]);
  const none = env({ pay: { on: false } });
  delete none.win.Cocardo.Track;
  assert.doesNotThrow(() => none.Pay.track('paywall_view', { level: 11 }));
});

/* ---------- compra con apodo y luego Google ---------- */

const ANON_GRANT = { [CHECKED]: '1', [KEY]: JSON.stringify({ device: null, accounts: { anon1: { order: 'txn_1', at: 1 } } }) };

test('compró con apodo y entra con un Google que ya existía: pide al Worker traer la compra con el token de la sesión dejada', async () => {
  const t = env({ user: { uid: 'anon1', anon: true }, storage: Object.assign({}, ANON_GRANT), anonTokens: { anon1: 'idtok-anon1-0123456789' },
    fetch: () => ({ status: 200, body: { ok: true } }) });
  t.Pay.init();
  assert.equal(t.Pay.premium(), true);
  const seen = [];
  t.Pay.onChange((st) => seen.push(st.event));
  t.setUser({ uid: 'G', anon: false });   // Cloud.signIn → credential-already-in-use → signInWithCredential
  assert.equal(t.Pay.premium(), false, 'la compra sigue en la cuenta anónima hasta que el Worker la mueva');
  assert.equal(t.Pay.state().busy, true);
  await flush();
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0].url, '/api/restore');
  assert.deepEqual(JSON.parse(t.calls[0].init.body), { from: 'idtok-anon1-0123456789' });
  assert.equal(t.calls[0].init.headers.authorization, 'Bearer tok1', 'con el token de la cuenta nueva');
  assert.equal(t.Pay.state().pending, true);
  assert.equal(t.Pay.state().busy, false);
  assert.ok(seen.includes('restored'));
  t.lastWatch().cb({ exists: true, fromCache: false, data: { premium: true, order: 'txn_1', source: 'paddle' } });
  assert.equal(t.Pay.premium(), true);
  assert.equal(t.lastWatch().path, 'entitlements/G');
});

test('compra que queda en la sesión con apodo: left-behind si no hay token, si falla el Worker o al cerrar sesión', async () => {
  // sin token (p. ej. la venta se encendió después) → no llama al Worker
  const a = env({ user: { uid: 'anon1', anon: true }, storage: Object.assign({}, ANON_GRANT) });
  a.Pay.init();
  a.setUser({ uid: 'G', anon: false });
  assert.equal(a.n.fetch, 0);
  assert.equal(a.Pay.state().event, 'left-behind');
  assert.equal(a.Pay.state().leftBehind, true);
  // el Worker no la encuentra
  const b = env({ user: { uid: 'anon1', anon: true }, storage: Object.assign({}, ANON_GRANT), anonTokens: { anon1: 'idtok-anon1-0123456789' },
    fetch: () => ({ status: 400, body: { error: 'invalid' } }) });
  b.Pay.init();
  b.setUser({ uid: 'G', anon: false });
  await flush();
  assert.equal(b.Pay.state().leftBehind, true);
  assert.equal(b.Pay.state().pending, false);
  // cerrar la sesión anónima que tenía la compra
  const c = env({ user: { uid: 'anon1', anon: true }, storage: Object.assign({}, ANON_GRANT) });
  c.Pay.init();
  c.setUser(null);
  assert.equal(c.Pay.state().event, 'left-behind');
  // al cambiar otra vez de cuenta se limpia
  c.setUser({ uid: 'anon1', anon: true });
  assert.equal(c.Pay.state().leftBehind, false);
});

test('sin compra en la sesión con apodo, o si se vinculó (mismo uid), no hay nada que traer', () => {
  const none = env({ user: { uid: 'anon1', anon: true }, anonTokens: { anon1: 'idtok-anon1-0123456789' } });
  none.Pay.init();
  none.setUser({ uid: 'G', anon: false });
  assert.equal(none.n.fetch, 0);
  assert.equal(none.Pay.state().leftBehind, false);
  // «Vincular con Google» conserva el uid: después cerrar sesión no es dejar la compra en un apodo
  const linked = env({ user: { uid: 'anon1', anon: true }, storage: Object.assign({}, ANON_GRANT) });
  linked.Pay.init();
  linked.setUser({ uid: 'anon1', anon: false });
  linked.setUser(null);
  assert.equal(linked.Pay.state().leftBehind, false);
  assert.equal(linked.n.fetch, 0);
});

test('state().busy mientras se compra y con el pago abierto (la UI no abre el editor de apodo encima)', async () => {
  const t = env();
  t.Pay.init();
  assert.equal(t.Pay.state().busy, false);
  const p = t.Pay.buy({ level: 11 });   // sin usuario: entra con apodo (Cloud avisa) en el medio
  assert.equal(t.Pay.state().busy, true);
  await p;
  assert.equal(t.n.signInAnon, 1);
  assert.equal(t.Pay.state().busy, true, 'el pago de Paddle está abierto');
  const seen = [];
  t.Pay.onChange((st) => seen.push([st.event, st.busy]));
  t.Paddle._opts.eventCallback({ name: 'checkout.completed', data: { transaction_id: 'txn_01abc' } });
  t.Paddle._opts.eventCallback({ name: 'checkout.closed', data: {} });
  assert.deepEqual(seen[seen.length - 1], ['change', false]);
  // cancelar también lo libera
  const c = env({ user: { uid: 'A' } });
  await c.Pay.buy();
  c.Paddle._opts.eventCallback({ name: 'checkout.closed', data: {} });
  assert.equal(c.Pay.state().busy, false);
});

test('buy(): en sandbox una cuenta fuera de TEST_UIDS recibe un mensaje claro', async () => {
  const t = env({ user: { uid: 'A' }, fetch: () => ({ status: 403, body: { error: 'sandbox' } }) });
  const r = await t.Pay.buy();
  assert.equal(r.ok, false);
  assert.match(r.reason, /en pruebas/);
});

/* ---------- js/cloud.js: escucha, sesión y token (SDK compat falso) ---------- */

const CLOUD = fs.readFileSync(path.join(__dirname, '../js/cloud.js'), 'utf8');

function cloudEnv(o) {
  o = o || {};
  const n = { snap: 0, unsub: 0, authUnsub: 0, getIdToken: [], cred: 0, scripts: 0 };
  const snaps = [];
  const authListeners = [];
  const fire = (u) => authListeners.filter((l) => !l.off).forEach((l) => l.cb(u));
  function mkUser(uid, anon) {
    return {
      uid, isAnonymous: anon, displayName: anon ? null : 'Ana', photoURL: null,
      getIdToken: (force) => { n.getIdToken.push([uid, !!force]); return Promise.resolve('idtok-' + uid + (force ? '-fresh' : '')); },
      linkWithPopup: () => (o.linkOk ? (current.isAnonymous = false, Promise.resolve({ user: current }))
        : Promise.reject({ code: 'auth/credential-already-in-use', credential: { providerId: 'google.com' } })),
    };
  }
  let current = o.user ? mkUser(o.user.uid, !!o.user.anon) : null;
  const auth = {
    get currentUser() { return current; },
    useDeviceLanguage() {},
    onAuthStateChanged(cb) {
      const l = { cb, off: false };
      authListeners.push(l);
      if (o.authAuto !== false) Promise.resolve().then(() => { if (!l.off) cb(current); });
      return () => { n.authUnsub++; l.off = true; };
    },
    getRedirectResult: () => Promise.resolve(null),
    signInWithCredential() { n.cred++; current = mkUser('google1', false); fire(current); return Promise.resolve({ user: current }); },
    signInAnonymously() { current = mkUser('anon9', true); fire(current); return Promise.resolve({ user: current }); },
    signOut() { current = null; fire(null); return Promise.resolve(); },
  };
  const docRef = () => ({ get: () => Promise.resolve({ exists: false, data: () => null }), collection: () => ({ doc: docRef }) });
  const db = {
    doc(p) {
      return { onSnapshot(opts, next, err) { n.snap++; const sn = { p, opts, next, err, off: false }; snaps.push(sn); return () => { n.unsub++; sn.off = true; }; } };
    },
    collection: () => ({ doc: docRef }),
    batch: () => ({ set() {}, commit: () => Promise.resolve() }),
  };
  function Provider() { this.setCustomParameters = () => {}; }
  const firebase = {
    apps: [], initializeApp() { firebase.apps.push({}); },
    auth: Object.assign(() => auth, { GoogleAuthProvider: Provider }),
    firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => 'ts' } }),
  };
  const saveObj = { v: 1, cloud: { on: false, nick: '', avatar: '', uid: '' } };
  const store = new Map();
  const win = {
    location: { protocol: 'https:', hostname: 'cocardo.app' },
    navigator: { userAgent: 'test' },
    document: {
      createElement: () => { n.scripts++; return {}; },
      head: { appendChild: (sc) => { Promise.resolve().then(() => { if (o.failLoad) sc.onerror(); else { win.firebase = firebase; sc.onload(); } }); } },
    },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    fetch: () => Promise.reject(new Error('sin red')),
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: (id) => clearTimeout(id),
    console,
    Cocardo: {
      CloudConfig: { firebase: { apiKey: 'AIza-test', projectId: 'demo', appId: '1:2:web:3' }, firebaseVersion: '10.14.1' },
      Save: { get: () => saveObj, save() {} },
      Progress: { merge: (l) => l, forCloud: () => ({}), summary: () => ({ stars: 0, levels: 0, rescued: 0, bestStreak: 0, finished: false }) },
      Pay: { on: () => !!o.payOn },
    },
  };
  win.window = win;
  win.self = win;
  win.top = win;
  vm.createContext(win);
  vm.runInContext(CLOUD, win, { filename: 'js/cloud.js' });
  return { Cloud: win.Cocardo.Cloud, n, snaps, fire, auth, setCurrent(u) { current = u ? mkUser(u.uid, !!u.anon) : null; } };
}
const settle = async () => { for (let i = 0; i < 20; i++) await flush(); };

test('Cloud.watchDoc: pide también los cambios de metadatos y pasa { exists, fromCache, data }', async () => {
  const c = cloudEnv();
  const got = [];
  const off = c.Cloud.watchDoc('entitlements/A', (snap) => got.push(plain(snap)));
  assert.equal(c.n.snap, 0, 'todavía cargando el SDK');
  await settle();
  assert.equal(c.n.snap, 1);
  const sn = c.snaps[0];
  assert.equal(sn.p, 'entitlements/A');
  assert.deepEqual(plain(sn.opts), { includeMetadataChanges: true });
  sn.next({ exists: false, metadata: { fromCache: true }, data: () => { throw new Error('no se llama'); } });
  sn.next({ exists: true, metadata: { fromCache: false }, data: () => ({ premium: true, order: 'txn_1' }) });
  assert.deepEqual(got, [{ exists: false, fromCache: true, data: null }, { exists: true, fromCache: false, data: { premium: true, order: 'txn_1' } }]);
  off();
  assert.equal(c.n.unsub, 1);
});

test('Cloud.watchDoc: dejar de escuchar antes de que cargue el SDK no se suscribe; los errores llegan a onError', async () => {
  const c = cloudEnv();
  const off = c.Cloud.watchDoc('entitlements/A', () => {});
  off();
  await settle();
  assert.equal(c.n.snap, 0);
  const errs = [];
  c.Cloud.watchDoc('entitlements/B', () => {}, (e) => errs.push(e.code));
  await settle();
  c.snaps[0].err({ code: 'permission-denied' });
  assert.deepEqual(errs, ['permission-denied']);
  // si el SDK no carga (sin conexión), también avisa
  const bad = cloudEnv({ failLoad: true });
  const errs2 = [];
  bad.Cloud.watchDoc('entitlements/A', () => {}, (e) => errs2.push(String(e.message)));
  await settle();
  assert.equal(errs2.length, 1);
  assert.equal(bad.n.snap, 0);
});

test('Cloud.authReady / authKnown / idToken', async () => {
  const c = cloudEnv({ user: { uid: 'A' } });
  assert.equal(c.Cloud.authKnown(), false);
  await assert.rejects(c.Cloud.idToken(), /sin-usuario/, 'sin SDK no hay usuario');
  assert.equal(await c.Cloud.authReady(), 'A');
  await settle();
  assert.equal(c.Cloud.authKnown(), true, 'Firebase ya avisó la sesión');
  assert.ok(c.n.authUnsub >= 1, 'la escucha de authReady se suelta');
  assert.equal(await c.Cloud.idToken(), 'idtok-A');
  assert.equal(await c.Cloud.idToken(true), 'idtok-A-fresh');
  const none = cloudEnv();
  assert.equal(await none.Cloud.authReady(), '');
  await assert.rejects(none.Cloud.idToken(), /sin-usuario/);
  // mientras Firebase no dice nada, authKnown sigue en false aunque el SDK esté listo
  const slow = cloudEnv({ authAuto: false });
  slow.Cloud.load();
  await settle();
  assert.equal(slow.Cloud.state(), 'ready');
  assert.equal(slow.Cloud.authKnown(), false);
  slow.fire(null);
  assert.equal(slow.Cloud.authKnown(), true);
});

test('Cloud.signIn desde un apodo con un Google que ya existía: guarda el token de la sesión dejada (solo con la venta encendida)', async () => {
  const c = cloudEnv({ user: { uid: 'anon1', anon: true }, payOn: true });
  await c.Cloud.load();
  await settle();
  await c.Cloud.signIn();
  await settle();
  assert.equal(c.n.cred, 1);
  assert.equal(c.Cloud.user().uid, 'google1');
  assert.deepEqual(c.n.getIdToken[0], ['anon1', false], 'el token se pide antes de cambiar de cuenta');
  assert.equal(c.Cloud.takeAnonToken('otro'), '');
  const again = cloudEnv({ user: { uid: 'anon1', anon: true }, payOn: true });
  await again.Cloud.load();
  await settle();
  await again.Cloud.signIn();
  assert.equal(again.Cloud.takeAnonToken('anon1'), 'idtok-anon1');
  assert.equal(again.Cloud.takeAnonToken('anon1'), '', 'se entrega una sola vez');
  // con la venta apagada no se pide nada extra
  const off = cloudEnv({ user: { uid: 'anon1', anon: true }, payOn: false });
  await off.Cloud.load();
  await settle();
  await off.Cloud.signIn();
  assert.equal(off.n.getIdToken.length, 0);
  assert.equal(off.Cloud.takeAnonToken('anon1'), '');
});

test('Cloud.signIn: vincular el apodo con Google conserva el uid y deja de ser anónimo', async () => {
  const c = cloudEnv({ user: { uid: 'anon1', anon: true }, linkOk: true, payOn: true });
  await c.Cloud.load();
  await settle();
  assert.equal(c.Cloud.user().anon, true);
  await c.Cloud.signIn();
  assert.equal(c.Cloud.user().uid, 'anon1');
  assert.equal(c.Cloud.user().anon, false);
  assert.equal(c.n.cred, 0);
});

/* ---------- depuración ---------- */

test('_setPremiumForDebug solo existe después de _debug(true); _debug se borra al usarlo', () => {
  const t = env();
  assert.equal(t.Pay._setPremiumForDebug, undefined);
  t.Pay._debug(false);
  assert.equal(t.Pay._debug, undefined);
  assert.equal(t.Pay._setPremiumForDebug, undefined);
  const d = env();
  d.Pay._debug(true);
  assert.equal(d.Pay._debug, undefined);
  assert.equal(d.Pay._setPremiumForDebug(true), true);
  assert.equal(d.Pay.allowed(50), true);
  assert.equal(d.Pay._setPremiumForDebug(false), false);
  assert.equal(d.Pay.allowed(50), false);
  d.Pay._setPremiumForDebug(null);
  assert.equal(d.Pay.premium(), false);
});

// main.js con UI, Save, Cloud y Pay falsos: ¿queda Cocardo.debug? selling: Pay.on() (venta encendida)
function boot(href, extra, selling = true) {
  const u = new URL(href);
  const made = { debug: 0, payDebug: [] };
  const win = {
    location: { protocol: u.protocol, hostname: u.hostname, hash: u.hash, search: u.search },
    document: { readyState: 'complete', documentElement: { classList: { add: () => {} } }, addEventListener: () => {} },
    navigator: {},
    console,
    addEventListener: () => {},
    requestAnimationFrame: () => 0,
    Cocardo: Object.assign({
      Save: { load: () => ({}) },
      UI: { applySettings() {}, init() {}, show() {}, current: () => 'title', makeDebug: () => { made.debug++; return { unlockAll() {} }; } },
      Pay: { init() {}, on: () => selling, _debug(on) { made.payDebug.push(on); } },
    }, extra || {}),
  };
  win.window = win;
  win.self = win;
  win.top = win;
  vm.createContext(win);
  vm.runInContext(MAIN, win, { filename: 'js/main.js' });
  return { has: !!win.Cocardo.debug, made };
}

test('main.js: con la venta encendida, #debug solo en desarrollo (file:, localhost, 127.0.0.1, [::1], *.localhost)', () => {
  assert.equal(boot('https://cocardo.app/#debug').has, false, 'producción');
  assert.equal(boot('https://www.cocardo.app/index.html#debug').has, false);
  assert.equal(boot('https://cocardo.app/', { debugEnabled: true }).has, false, 'debugEnabled tampoco vale en producción');
  assert.equal(boot('https://localhost.cocardo.app/#debug').has, false);
  assert.equal(boot('file:///home/x/cocardo/index.html#debug').has, true);
  assert.equal(boot('http://localhost:8080/#debug').has, true);
  assert.equal(boot('http://127.0.0.1:5000/index.html#debug').has, true);
  assert.equal(boot('http://[::1]:5000/#debug').has, true);
  assert.equal(boot('http://cocardo.localhost/#debug').has, true);
  assert.equal(boot('http://localhost:8080/').has, false, 'sin #debug no hay depurador');
  assert.equal(boot('about:srcdoc', { debugEnabled: true }).has, true, 'srcdoc del artifact / tests/e2e.cjs');
  assert.deepEqual(boot('https://cocardo.app/#debug').made.payDebug, [false]);
  assert.deepEqual(boot('http://localhost/#debug').made.payDebug, [true]);
});

test('main.js: con la venta apagada #debug funciona como siempre, también en cocardo.app', () => {
  assert.equal(boot('https://cocardo.app/#debug', null, false).has, true);
  assert.equal(boot('https://cocardo.app/', { debugEnabled: true }, false).has, true);
  assert.equal(boot('https://cocardo.app/', null, false).has, false, 'sin #debug no hay depurador');
  // sin js/pay.js cargado tampoco hay venta
  assert.equal(boot('https://cocardo.app/#debug', { Pay: undefined }).has, true);
});
