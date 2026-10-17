/* Pruebas del Worker de pagos (tools/pay-worker/worker.js) sin red: globalThis.fetch se reemplaza por un mundo
 * falso con Identity Toolkit, Paddle, el OAuth de Google y un Firestore en memoria que respeta las precondiciones
 * de commit (exists / updateTime) con los mismos códigos de error que la API REST. La clave de la cuenta de servicio
 * es una RSA de usar y tirar generada acá; el OAuth falso verifica la firma RS256 del JWT. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// El Worker es ESM y el repo no tiene "type":"module": se importa desde una URL data: (siempre ESM, sin avisos)
const SRC = fs.readFileSync(path.join(__dirname, '..', 'tools', 'pay-worker', 'worker.js'), 'utf8');
let worker;
test.before(async () => {
  worker = (await import('data:text/javascript;base64,' + Buffer.from(SRC).toString('base64'))).default;
});

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

const PRICE = 'pri_01testprice00000000000000';
const PROJECT = 'demo-cocardo';
const ENV = {
  PADDLE_ENV: 'sandbox',
  PADDLE_PRICE_ID: PRICE,
  FIREBASE_PROJECT: PROJECT,
  FIREBASE_API_KEY: 'AIza-test-key',
  SITE_ORIGINS: 'https://cocardo.app, http://localhost:8080',
  PADDLE_API_KEY: 'pdl_sdbx_apikey_test',
  PADDLE_WEBHOOK_SECRET: 'pdl_ntfset_test_secret',
  GCP_SA_EMAIL: 'pagos@demo-cocardo.iam.gserviceaccount.com',
  GCP_SA_KEY: PEM,
  // sandbox: solo estas cuentas pueden comprar o recibir permisos (ver la prueba de TEST_UIDS)
  TEST_UIDS: 'alice, bob,carla,dora,anon1,anon2,mallory,erin',
};
const SITE = 'https://cocardo.app';
const DOCS = 'projects/' + PROJECT + '/databases/(default)/documents/';
const FS_URL = 'https://firestore.googleapis.com/v1/';

// Logs del Worker: se guardan para revisar que no lleven correos
const logs = [];
const realLog = console.log;
test.before(() => { console.log = (...a) => { logs.push(a.join(' ')); }; });
test.after(() => { console.log = realLog; });

// Tokens de Google emitidos por el OAuth falso (el Worker los guarda en memoria entre pruebas)
const issued = new Set();
const oauthCalls = [];

const txnId = (n) => 'txn_01hv8wptq8987qeep44cy' + String(n).padStart(5, '0');
const T = (s) => '2026-10-17T10:00:' + s + 'Z';   // occurred_at con microsegundos, como los manda Paddle

function b64url(buf) { return Buffer.from(buf).toString('base64url'); }
function jsonRes(status, body) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }
function gErr(code, status) { return jsonRes(code, { error: { code, message: status.toLowerCase(), status } }); }

function enc(v) {
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  return { stringValue: String(v) };
}
function dec(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('timestampValue' in v) return new Date(v.timestampValue);
  return null;
}

/* ---------- el mundo falso ---------- */

class World {
  constructor(env = ENV) {
    this.env = env;
    this.docs = new Map();     // ruta → { fields (codificados), updateTime }
    this.clock = 0;
    this.calls = [];           // { host, method, path }
    // token → uid (cuenta de Google con correo <uid>@example.com sin verificar) o { uid, anon, email, verified }
    this.users = {
      'idtoken.alice.0123456789': 'alice', 'idtoken.bob.0123456789': 'bob', 'idtoken.carla.012345678': 'carla',
      'idtoken.dora.01234567890': { uid: 'dora', email: 'Ana@Example.com', verified: true },
      'idtoken.anon1.0123456789': { uid: 'anon1', anon: true }, 'idtoken.anon2.0123456789': { uid: 'anon2', anon: true },
      'idtoken.mallory.01234567': { uid: 'mallory', anon: true }, 'idtoken.erin.01234567890': { uid: 'erin', anon: true },
    };
    this.looseInvoice = false;   // Paddle filtrando invoice_number por prefijo (para probar que el Worker compara exacto)
    this.txns = new Map();     // transacciones de Paddle
    this.customers = new Map();
    this.failNext = null;      // { what: 'commit'|'get', code, status } fallo pasajero de Firestore
    this.beforeCommit = null;  // escritor concurrente: corre una vez antes de aplicar un commit
    this.fetch = this.fetch.bind(this);
  }

  // datos de prueba
  put(p, data) { this.docs.set(p, { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, enc(v)])), updateTime: this.stamp() }); }
  get(p) { const d = this.docs.get(p); return d ? Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, dec(v)])) : null; }
  raw(p) { return this.docs.get(p) || null; }
  stamp() { return new Date(Date.UTC(2026, 9, 17, 12) + ++this.clock).toISOString().replace('Z', '123Z'); }
  addTxn({ id, uid, price = PRICE, status = 'completed', invoice = null, email = 'ana@example.com' }) {
    const customerId = 'ctm_' + id.slice(4);
    this.customers.set(customerId, { id: customerId, email });
    const t = { id, status, invoice_number: invoice, customer_id: customerId, custom_data: uid ? { uid } : null, items: [{ price: { id: price }, quantity: 1 }] };
    this.txns.set(id, t);
    return t;
  }
  commits() { return this.calls.filter((c) => c.path.endsWith(':commit')).length; }

  async fetch(input, init = {}) {
    const url = new URL(String(input));
    const method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || {});
    const body = init.body == null ? '' : String(init.body);
    this.calls.push({ host: url.hostname, method, path: decodeURIComponent(url.pathname) });
    if (url.hostname === 'identitytoolkit.googleapis.com') return this.lookup(url, body);
    if (url.hostname === 'oauth2.googleapis.com') return this.oauth(headers, body);
    if (url.hostname === 'firestore.googleapis.com') return this.firestore(url, method, headers, body);
    if (url.hostname === 'sandbox-api.paddle.com') return this.paddle(url, method, headers, body);
    throw new Error('host inesperado ' + url.hostname);
  }

  lookup(url, body) {
    if (url.searchParams.get('key') !== this.env.FIREBASE_API_KEY) return jsonRes(400, { error: { code: 400, message: 'API_KEY_INVALID' } });
    let u = this.users[JSON.parse(body).idToken];
    if (!u) return jsonRes(400, { error: { code: 400, message: 'INVALID_ID_TOKEN' } });
    if (typeof u === 'string') u = { uid: u, email: u + '@example.com', verified: false };
    // forma de accounts:lookup: una cuenta anónima no trae correo ni providerUserInfo
    const info = u.anon ? { localId: u.uid } : { localId: u.uid, email: u.email, emailVerified: !!u.verified,
      providerUserInfo: [{ providerId: 'google.com', email: u.email }] };
    return jsonRes(200, { kind: 'identitytoolkit#GetAccountInfoResponse', users: [info] });
  }

  oauth(headers, body) {
    assert.equal(headers.get('Content-Type'), 'application/x-www-form-urlencoded');
    const q = new URLSearchParams(body);
    assert.equal(q.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    const [h, c, s] = q.get('assertion').split('.');
    assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT' });
    const ok = crypto.verify('RSA-SHA256', Buffer.from(h + '.' + c), publicKey, Buffer.from(s, 'base64url'));
    if (!ok) return jsonRes(400, { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' });
    const claims = JSON.parse(Buffer.from(c, 'base64url'));
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/datastore');
    assert.equal(claims.aud, 'https://oauth2.googleapis.com/token');
    assert.ok(claims.exp - claims.iat <= 3600);
    oauthCalls.push(claims.iss);
    const token = 'ya29.test-' + issued.size;
    issued.add(token);
    return jsonRes(200, { access_token: token, expires_in: 3599, token_type: 'Bearer' });
  }

  firestore(url, method, headers, body) {
    const tok = (headers.get('Authorization') || '').replace(/^Bearer /, '');
    if (!issued.has(tok)) return gErr(401, 'UNAUTHENTICATED');
    const p = decodeURIComponent(url.pathname).slice('/v1/'.length);
    const what = p.endsWith(':commit') ? 'commit' : p.endsWith(':runQuery') ? 'query' : 'get';
    if (this.failNext && this.failNext.what === what) { const f = this.failNext; this.failNext = null; return gErr(f.code, f.status); }
    if (what === 'get') {
      assert.equal(method, 'GET');
      assert.ok(p.startsWith(DOCS), p);
      const d = this.docs.get(p.slice(DOCS.length));
      return d ? jsonRes(200, { name: p, fields: d.fields, createTime: d.updateTime, updateTime: d.updateTime }) : gErr(404, 'NOT_FOUND');
    }
    if (what === 'query') {   // solo lo que usa el Worker: orders donde un campo == valor
      assert.equal(p, 'projects/' + PROJECT + '/databases/(default)/documents:runQuery');
      const q = JSON.parse(body).structuredQuery;
      const f = q.where.fieldFilter;
      assert.deepEqual(q.from, [{ collectionId: 'orders' }]);
      assert.equal(f.op, 'EQUAL');
      const rows = [...this.docs].filter(([k, d]) => k.startsWith('orders/') && d.fields[f.field.fieldPath]
        && d.fields[f.field.fieldPath].stringValue === f.value.stringValue).slice(0, q.limit || 100)
        .map(([k, d]) => ({ document: { name: DOCS + k, fields: d.fields, updateTime: d.updateTime }, readTime: this.stamp() }));
      return jsonRes(200, rows.length ? rows : [{ readTime: this.stamp() }]);
    }
    assert.equal(p, 'projects/' + PROJECT + '/databases/(default)/documents:commit');
    if (this.beforeCommit) { const f = this.beforeCommit; this.beforeCommit = null; f(this); }
    const writes = JSON.parse(body).writes;
    // primero todas las precondiciones (contra el estado de antes), después todo junto
    for (const w of writes) {
      const name = w.update ? w.update.name : w.delete;
      assert.ok(name.startsWith(DOCS), name);
      const cur = this.docs.get(name.slice(DOCS.length));
      const pre = w.currentDocument;
      if (!pre) continue;
      if (pre.exists === false && cur) return gErr(409, 'ALREADY_EXISTS');
      if (pre.exists === true && !cur) return gErr(404, 'NOT_FOUND');
      if (pre.updateTime && !cur) return gErr(404, 'NOT_FOUND');
      if (pre.updateTime && cur.updateTime !== pre.updateTime) return gErr(400, 'FAILED_PRECONDITION');
    }
    const time = this.stamp();
    for (const w of writes) {
      if (w.delete) { this.docs.delete(w.delete.slice(DOCS.length)); continue; }
      const key = w.update.name.slice(DOCS.length);
      let fields = w.update.fields;
      if (w.updateMask) {
        fields = Object.assign({}, (this.docs.get(key) || { fields: {} }).fields);
        for (const f of w.updateMask.fieldPaths) { if (f in w.update.fields) fields[f] = w.update.fields[f]; else delete fields[f]; }
      }
      this.docs.set(key, { fields, updateTime: time });
    }
    return jsonRes(200, { writeResults: writes.map(() => ({ updateTime: time })), commitTime: time });
  }

  paddle(url, method, headers, body) {
    if (headers.get('Authorization') !== 'Bearer ' + this.env.PADDLE_API_KEY) return jsonRes(403, { error: { type: 'request_error', code: 'forbidden' } });
    assert.equal(headers.get('Paddle-Version'), '1');
    const meta = { request_id: 'req-test' };
    if (method === 'POST' && url.pathname === '/transactions') {
      const b = JSON.parse(body);
      const id = txnId(90000 + this.txns.size);
      const t = { id, status: 'draft', custom_data: b.custom_data, customer_id: null, invoice_number: null,
        items: b.items.map((i) => ({ price: { id: i.price_id }, quantity: i.quantity })),
        checkout: { url: 'https://cocardo.app/pagar?_ptxn=' + id } };
      this.txns.set(id, t);
      this.lastCreate = b;
      return jsonRes(201, { data: t, meta });
    }
    if (method === 'GET' && url.pathname === '/transactions') {
      const inv = url.searchParams.get('invoice_number');
      const withCustomer = (url.searchParams.get('include') || '').split(',').includes('customer');
      const data = [...this.txns.values()].filter((t) => t.invoice_number && (this.looseInvoice ? t.invoice_number.startsWith(inv) : t.invoice_number === inv))
        .map((t) => (withCustomer ? Object.assign({ customer: this.customers.get(t.customer_id) }, t) : t));
      return jsonRes(200, { data, meta: Object.assign({ pagination: { per_page: 30, next: '', has_more: false } }, meta) });
    }
    let m = /^\/transactions\/(txn_\w+)$/.exec(url.pathname);
    if (method === 'GET' && m) {
      const t = this.txns.get(m[1]);
      return t ? jsonRes(200, { data: t, meta }) : jsonRes(404, { error: { type: 'request_error', code: 'not_found' }, meta });
    }
    m = /^\/customers\/(ctm_\w+)$/.exec(url.pathname);
    if (method === 'GET' && m) return jsonRes(200, { data: this.customers.get(m[1]), meta });
    throw new Error('Paddle: ruta inesperada ' + method + ' ' + url.pathname);
  }
}

function use(world) { globalThis.fetch = world.fetch; return world; }
const realFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = realFetch; });

/* ---------- pedidos al Worker ---------- */

function signedRequest(event, { secret = ENV.PADDLE_WEBHOOK_SECRET, ts = Math.floor(Date.now() / 1000), header, raw } = {}) {
  const body = raw || JSON.stringify(event);
  const h1 = crypto.createHmac('sha256', secret).update(ts + ':' + body).digest('hex');
  return new Request(SITE + '/api/webhook', {
    method: 'POST', body,
    headers: { 'Content-Type': 'application/json', 'Paddle-Signature': header || ('ts=' + ts + ';h1=' + h1) },
  });
}
async function hook(event, env = ENV, opts) { return worker.fetch(signedRequest(event, opts), env); }

let evtN = 0;
function completed(txn, uid, { price = PRICE, at = T('00.000001'), status = 'completed' } = {}) {
  return {
    event_id: 'evt_' + ++evtN, event_type: 'transaction.completed', occurred_at: at, notification_id: 'ntf_' + evtN,
    data: { id: txn, status, custom_data: uid === undefined ? null : { uid }, items: [{ price: { id: price }, quantity: 1 }],
      invoice_number: '325-1000' + evtN, customer_id: 'ctm_x' },
  };
}
function adjustment(txn, action, status, at, type = 'adjustment.updated', { kind = 'full', items = [] } = {}) {
  return {
    event_id: 'evt_' + ++evtN, event_type: type, occurred_at: at, notification_id: 'ntf_' + evtN,
    data: { id: 'adj_' + evtN, action, status, type: kind, transaction_id: txn, customer_id: 'ctm_x', items },
  };
}
const adjItem = (type, amount = null) => ({ id: 'adjitm_' + ++evtN, item_id: 'txnitm_1', type, amount, proration: null, totals: { subtotal: '0', tax: '0', total: '0' } });
function api(p, { token, origin = SITE, body = {}, method = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (origin) headers.Origin = origin;
  return new Request(SITE + p, { method, headers, body: method === 'POST' ? JSON.stringify(body) : undefined });
}
async function call(req, env = ENV) { const r = await worker.fetch(req, env); return { status: r.status, headers: r.headers, body: await r.json().catch(() => null) }; }

const ALICE = 'idtoken.alice.0123456789', BOB = 'idtoken.bob.0123456789', CARLA = 'idtoken.carla.012345678';
const DORA = 'idtoken.dora.01234567890', ANON1 = 'idtoken.anon1.0123456789', ANON2 = 'idtoken.anon2.0123456789';
const MALLORY = 'idtoken.mallory.01234567', ERIN = 'idtoken.erin.01234567890';

/* ---------- pruebas ---------- */

test('pay-worker: /api/health dice el entorno', async () => {
  use(new World());
  const r = await call(new Request(SITE + '/api/health'));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, env: 'sandbox' });
  assert.equal((await worker.fetch(new Request(SITE + '/api/nada'), ENV)).status, 404);
});

test('pay-worker: firma del webhook válida, inválida, vieja o ausente', async () => {
  const w = use(new World());
  const ev = completed(txnId(1), 'alice');
  // inválida: otro secreto, o el cuerpo cambiado después de firmar
  assert.equal((await hook(ev, ENV, { secret: 'otro' })).status, 401);
  const tampered = signedRequest(ev);
  const forged = new Request(tampered.url, { method: 'POST', headers: tampered.headers, body: JSON.stringify(completed(txnId(1), 'mallory')) });
  assert.equal((await worker.fetch(forged, ENV)).status, 401);
  // vieja (más de 5 s) o del futuro
  assert.equal((await hook(ev, ENV, { ts: Math.floor(Date.now() / 1000) - 30 })).status, 401);
  assert.equal((await hook(ev, ENV, { ts: Math.floor(Date.now() / 1000) + 30 })).status, 401);
  // ausente o mal formada
  const noSig = new Request(SITE + '/api/webhook', { method: 'POST', body: JSON.stringify(ev) });
  assert.equal((await worker.fetch(noSig, ENV)).status, 401);
  assert.equal((await hook(ev, ENV, { header: 'h1=abc' })).status, 401);
  assert.equal(w.calls.length, 0, 'sin firma válida no se toca nada');
  assert.equal((await worker.fetch(new Request(SITE + '/api/webhook'), ENV)).status, 405);

  // válida, también con dos h1 (rotación del secreto) donde solo el segundo sirve
  const ts = Math.floor(Date.now() / 1000);
  const body = JSON.stringify(ev);
  const good = crypto.createHmac('sha256', ENV.PADDLE_WEBHOOK_SECRET).update(ts + ':' + body).digest('hex');
  const r = await hook(ev, ENV, { raw: body, header: 'ts=' + ts + ';h1=' + 'f'.repeat(64) + ';h1=' + good });
  assert.equal(r.status, 200);
  assert.equal(w.get('entitlements/alice').premium, true);
});

test('pay-worker: transaction.completed da el permiso y la entrega repetida no cambia nada', async () => {
  const w = use(new World());
  const txn = txnId(2);
  const r = await hook(completed(txn, 'alice', { at: T('01.123456') }));
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'ok');
  const ent = w.get('entitlements/alice');
  assert.deepEqual(Object.assign({}, ent, { at: null }), { premium: true, order: txn, source: 'paddle', at: null });
  assert.ok(w.raw('entitlements/alice').fields.at.timestampValue, 'at es un timestamp');
  const order = w.get('orders/' + txn);
  assert.deepEqual(Object.assign({}, order, { updatedAt: null }), { uid: 'alice', status: 'paid', priceId: PRICE, occurredAt: T('01.123456'), moves: 0, updatedAt: null });
  assert.ok(w.raw('orders/' + txn).fields.updatedAt.timestampValue);

  const before = JSON.stringify([...w.docs]);
  const again = await hook(completed(txn, 'alice', { at: T('01.123456') }));
  assert.equal(again.status, 200);
  assert.equal(JSON.stringify([...w.docs]), before, 'idempotente');
});

test('pay-worker: otro precio, estado o evento desconocido → 200 sin escribir', async () => {
  const w = use(new World());
  for (const ev of [
    completed(txnId(3), 'alice', { price: 'pri_01otroprecio000000000000000' }),
    completed(txnId(7), 'alice', { status: 'paid' }),
    { event_id: 'evt_x', event_type: 'customer.updated', occurred_at: T('02'), data: { id: 'ctm_1' } },
  ]) {
    const r = await hook(ev);
    assert.equal(r.status, 200, ev.event_type);
  }
  assert.equal(w.commits(), 0);
  assert.equal(w.docs.size, 0);
  // JSON roto pero bien firmado: tampoco se reintenta
  assert.equal((await hook(null, ENV, { raw: '{no es json' })).status, 200);
});

test('pay-worker: compra de nuestro precio sin uid válido → orden sin dueño (sin permiso) que «Ya pagué» reclama', async () => {
  const w = use(new World());
  for (const [n, uid] of [[4, undefined], [5, 'a/b'], [6, 'x'.repeat(129)]]) {
    assert.equal((await hook(completed(txnId(n), uid, { at: T('03.000001') }))).status, 200);
    const o = w.get('orders/' + txnId(n));
    assert.equal(o.uid, '');
    assert.equal(o.status, 'paid');
    assert.equal(o.moves, 0);
  }
  assert.equal([...w.docs.keys()].filter((k) => k.startsWith('entitlements/')).length, 0);

  // una transacción hecha a mano en el panel (sin custom_data): el comprador la reclama con factura y correo
  const txn = txnId(8);
  w.addTxn({ id: txn, uid: null, invoice: '325-30000', email: 'ana@example.com' });
  await hook(completed(txn, undefined));
  const r = await call(api('/api/restore', { token: BOB, body: { invoice: '325-30000', email: 'ana@example.com' } }));
  assert.equal(r.status, 200);
  assert.equal(w.get('entitlements/bob').order, txn);
  assert.equal(w.get('orders/' + txn).uid, 'bob');
  assert.equal(w.get('orders/' + txn).moves, 0, 'reclamar una compra sin dueño no gasta traslados');
});

test('pay-worker: un reembolso aprobado quita solo el permiso de esa compra', async () => {
  const w = use(new World());
  const a = txnId(10), b = txnId(11);
  await hook(completed(a, 'alice', { at: T('10.000001') }));
  await hook(completed(b, 'alice', { at: T('11.000001') }));   // segunda compra: el permiso apunta a b
  assert.equal(w.get('entitlements/alice').order, b);

  // pendiente o rechazado: nada
  await hook(adjustment(a, 'refund', 'pending_approval', T('12.000001'), 'adjustment.created'));
  await hook(adjustment(a, 'refund', 'rejected', T('12.500001')));
  assert.equal(w.get('orders/' + a).status, 'paid');

  const r = await hook(adjustment(a, 'refund', 'approved', T('13.000001')));
  assert.equal(r.status, 200);
  assert.equal(w.get('orders/' + a).status, 'refunded');
  assert.equal(w.get('orders/' + a).occurredAt, T('13.000001'));
  assert.equal(w.get('entitlements/alice').order, b, 'el permiso de la otra compra sigue');

  await hook(adjustment(b, 'refund', 'approved', T('14.000001')));
  assert.equal(w.get('orders/' + b).status, 'refunded');
  assert.equal(w.get('entitlements/alice'), null);
  // repetido: no cambia nada
  const before = JSON.stringify([...w.docs]);
  assert.equal((await hook(adjustment(b, 'refund', 'approved', T('14.000001')))).status, 200);
  assert.equal(JSON.stringify([...w.docs]), before);
});

test('pay-worker: pagó dos veces y se reembolsa la compra del permiso: pasa a la otra', async () => {
  const w = use(new World());
  const a = txnId(15), b = txnId(16);
  await hook(completed(a, 'bob', { at: T('15.000001') }));
  await hook(completed(b, 'bob', { at: T('16.000001') }));
  assert.equal(w.get('entitlements/bob').order, b);
  await hook(adjustment(b, 'refund', 'approved', T('17.000001')));
  assert.equal(w.get('orders/' + b).status, 'refunded');
  assert.deepEqual(Object.assign({}, w.get('entitlements/bob'), { at: null }), { premium: true, order: a, source: 'paddle', at: null });
  await hook(adjustment(a, 'refund', 'approved', T('18.000001')));
  assert.equal(w.get('entitlements/bob'), null, 'sin compras pagadas ya no queda permiso');
});

test('pay-worker: un reembolso que llega antes que la compra impide que la compra tardía dé permiso', async () => {
  const w = use(new World());
  const txn = txnId(20);
  assert.equal((await hook(adjustment(txn, 'refund', 'approved', T('21.000001')))).status, 200);
  assert.equal(w.get('orders/' + txn).status, 'refunded');
  assert.equal((await hook(completed(txn, 'bob', { at: T('20.000001') }))).status, 200);
  assert.equal(w.get('entitlements/bob'), null);
  assert.equal(w.get('orders/' + txn).status, 'refunded');
});

test('pay-worker: contracargo quita, chargeback_reverse devuelve y un aviso viejo no gana', async () => {
  const w = use(new World());
  const txn = txnId(30);
  await hook(completed(txn, 'alice', { at: T('30.000001') }));
  // aviso de contracargo: Paddle ya le devolvió el dinero al comprador, así que también quita; su reversión devuelve
  await hook(adjustment(txn, 'chargeback_warning', 'approved', T('30.500001'), 'adjustment.created'));
  assert.equal(w.get('entitlements/alice'), null, 'chargeback_warning quita el permiso');
  assert.equal(w.get('orders/' + txn).status, 'refunded');
  await hook(adjustment(txn, 'chargeback_warning_reverse', 'approved', T('30.700001'), 'adjustment.created'));
  assert.equal(w.get('entitlements/alice').order, txn, 'chargeback_warning_reverse lo devuelve');
  assert.equal(w.get('orders/' + txn).status, 'paid');
  await hook(adjustment(txn, 'chargeback', 'approved', T('31.000001'), 'adjustment.created'));
  assert.equal(w.get('entitlements/alice'), null);
  assert.equal(w.get('orders/' + txn).status, 'refunded');

  // el contracargo pasa a «reversed»: eso solo no devuelve nada (llega su chargeback_reverse aparte)
  await hook(adjustment(txn, 'chargeback', 'reversed', T('32.000001')));
  assert.equal(w.get('entitlements/alice'), null);

  const r = await hook(adjustment(txn, 'chargeback_reverse', 'approved', T('32.000002'), 'adjustment.created'));
  assert.equal(r.status, 200);
  assert.equal(w.get('entitlements/alice').order, txn);
  assert.equal(w.get('orders/' + txn).status, 'paid');
  // el contracargo viejo entregado otra vez (reintento de Paddle): se ignora por occurred_at
  await hook(adjustment(txn, 'chargeback', 'approved', T('31.000001'), 'adjustment.created'));
  assert.equal(w.get('entitlements/alice').order, txn);
  assert.equal(w.get('orders/' + txn).status, 'paid');
});

test('pay-worker: avisos desordenados convergen (reverse antes que compra y contracargo)', async () => {
  const w = use(new World());
  const txn = txnId(40);
  w.addTxn({ id: txn, uid: 'carla' });
  // llega primero el chargeback_reverse: sin orden, el uid sale de la transacción en Paddle
  await hook(adjustment(txn, 'chargeback_reverse', 'approved', T('43.000001'), 'adjustment.created'));
  assert.equal(w.get('entitlements/carla').order, txn);
  await hook(completed(txn, 'carla', { at: T('40.000001') }));
  await hook(adjustment(txn, 'chargeback', 'approved', T('42.000001'), 'adjustment.created'));
  assert.equal(w.get('entitlements/carla').order, txn, 'el contracargo es anterior al reverse');
  assert.equal(w.get('orders/' + txn).status, 'paid');

  // dos contracargos: el segundo (más nuevo) gana aunque el reverse del primero llegue después
  const t2 = txnId(41);
  await hook(completed(t2, 'carla', { at: T('44.000001') }));
  await hook(adjustment(t2, 'chargeback', 'approved', T('45.000001'), 'adjustment.created'));
  await hook(adjustment(t2, 'chargeback', 'approved', T('48.000001'), 'adjustment.created'));
  await hook(adjustment(t2, 'chargeback_reverse', 'approved', T('46.000001'), 'adjustment.created'));
  assert.equal(w.get('orders/' + t2).status, 'refunded');
  assert.equal(w.get('entitlements/carla').order, txn, 'el permiso de la otra compra no se toca');
});

test('pay-worker: créditos, ajustes no finales y reembolsos parciales se ignoran', async () => {
  const w = use(new World());
  const txn = txnId(50);
  await hook(completed(txn, 'alice'));
  const n = w.commits();
  for (const [action, status] of [['credit', 'approved'], ['credit_reverse', 'approved'], ['chargeback_warning', 'pending_approval'],
    ['chargeback_warning', 'rejected'], ['refund', 'pending_approval'], ['refund', 'rejected'], ['chargeback_reverse', 'rejected']]) {
    assert.equal((await hook(adjustment(txn, action, status, T('51.000001')))).status, 200);
  }
  // reembolso parcial aprobado: un descuento de cortesía o el IVA devuelto al poner un número fiscal (línea «tax»)
  assert.equal((await hook(adjustment(txn, 'refund', 'approved', T('52.000001'), 'adjustment.updated', { kind: 'partial', items: [adjItem('partial', '50')] }))).status, 200);
  assert.equal((await hook(adjustment(txn, 'refund', 'approved', T('52.500001'), 'adjustment.created', { kind: 'partial', items: [adjItem('tax')] }))).status, 200);
  assert.equal(w.commits(), n);
  assert.equal(w.get('entitlements/alice').premium, true);
  assert.equal(w.get('orders/' + txn).status, 'paid');
  // «partial» con la única línea devuelta entera es un reembolso completo
  await hook(adjustment(txn, 'refund', 'approved', T('53.000001'), 'adjustment.updated', { kind: 'partial', items: [adjItem('full')] }));
  assert.equal(w.get('entitlements/alice'), null);
  assert.equal(w.get('orders/' + txn).status, 'refunded');
});

test('pay-worker: un fallo pasajero de Firestore responde 500 y el reintento entrega', async () => {
  const w = use(new World());
  const txn = txnId(60);
  w.failNext = { what: 'commit', code: 503, status: 'UNAVAILABLE' };
  assert.equal((await hook(completed(txn, 'bob'))).status, 500);
  assert.equal(w.get('entitlements/bob'), null);
  w.failNext = { what: 'commit', code: 409, status: 'ABORTED' };   // 409 pero no es precondición
  assert.equal((await hook(completed(txn, 'bob'))).status, 500);
  w.failNext = { what: 'get', code: 403, status: 'PERMISSION_DENIED' };
  assert.equal((await hook(adjustment(txn, 'refund', 'approved', T('61.000001')))).status, 500);
  assert.equal((await hook(completed(txn, 'bob'))).status, 200);
  assert.equal(w.get('entitlements/bob').order, txn);
});

test('pay-worker: si otro aviso escribe en el medio, el reembolso relee y converge', async () => {
  const w = use(new World());
  const txn = txnId(70);
  await hook(completed(txn, 'alice', { at: T('70.000001') }));
  // justo antes del commit del reembolso, «Ya pagué» mueve la compra a bob (cambia updateTime de la orden)
  w.beforeCommit = (world) => {
    world.docs.delete('entitlements/alice');
    world.put('entitlements/bob', { premium: true, order: txn, source: 'paddle', at: new Date() });
    world.put('orders/' + txn, { uid: 'bob', status: 'paid', priceId: PRICE, occurredAt: T('70.000001'), moves: 1, updatedAt: new Date() });
  };
  assert.equal((await hook(adjustment(txn, 'refund', 'approved', T('71.000001')))).status, 200);
  assert.equal(w.get('orders/' + txn).status, 'refunded');
  assert.equal(w.get('entitlements/bob'), null, 'se quitó al dueño actual');
});

test('pay-worker: el token de Google se firma con RS256 y se reutiliza', async () => {
  const env = Object.assign({}, ENV, { GCP_SA_EMAIL: 'cache@demo-cocardo.iam.gserviceaccount.com' });
  const w = use(new World(env));
  await hook(completed(txnId(80), 'alice'), env);
  await hook(completed(txnId(81), 'bob'), env);
  await hook(adjustment(txnId(80), 'refund', 'approved', T('59.000001')), env);
  assert.equal(oauthCalls.filter((e) => e === env.GCP_SA_EMAIL).length, 1);
  assert.equal(w.get('entitlements/bob').premium, true);
  // una clave que no es PKCS8 es un error de configuración: 500 para que Paddle reintente
  const bad = Object.assign({}, ENV, { GCP_SA_EMAIL: 'otra@x.iam.gserviceaccount.com', GCP_SA_KEY: '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----' });
  assert.equal((await hook(completed(txnId(82), 'carla'), bad)).status, 500);
});

test('pay-worker: /api/checkout exige token, crea la transacción y avisa si ya compró', async () => {
  const w = use(new World());
  let r = await call(api('/api/checkout'));
  assert.equal(r.status, 401);
  r = await call(api('/api/checkout', { token: 'idtoken.nadie.0123456789' }));
  assert.equal(r.status, 401);
  assert.equal(w.calls.filter((c) => c.host === 'sandbox-api.paddle.com').length, 0);

  r = await call(api('/api/checkout', { token: ALICE }));
  assert.equal(r.status, 200);
  assert.match(r.body.transactionId, /^txn_/);
  assert.equal(r.body.checkoutUrl, 'https://cocardo.app/pagar?_ptxn=' + r.body.transactionId);
  assert.deepEqual(w.lastCreate, { items: [{ price_id: PRICE, quantity: 1 }], custom_data: { uid: 'alice' } });
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), SITE);

  w.put('entitlements/bob', { premium: true, order: 'txn_x', source: 'legacy', at: new Date() });
  const before = w.txns.size;
  r = await call(api('/api/checkout', { token: BOB }));
  assert.deepEqual(r.body, { already: true });
  assert.equal(w.txns.size, before, 'no se crea otra transacción');

  // clave de sandbox con PADDLE_ENV=live: error de configuración, no se llama a Paddle live
  r = await call(api('/api/checkout', { token: CARLA }), Object.assign({}, ENV, { PADDLE_ENV: 'live' }));
  assert.equal(r.status, 503);
});

test('pay-worker: CORS solo para SITE_ORIGINS', async () => {
  const w = use(new World());
  let r = await worker.fetch(api('/api/checkout', { method: 'OPTIONS', origin: 'http://localhost:8080' }), ENV);
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8080');
  assert.match(r.headers.get('Access-Control-Allow-Headers'), /Authorization/);
  assert.match(r.headers.get('Access-Control-Allow-Methods'), /POST/);

  r = await worker.fetch(api('/api/checkout', { method: 'OPTIONS', origin: 'https://evil.example' }), ENV);
  assert.equal(r.status, 403);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
  r = await worker.fetch(api('/api/restore', { token: ALICE, origin: 'https://evil.example', body: { invoice: '325-1', email: 'a@b.c' } }), ENV);
  assert.equal(r.status, 403);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(w.calls.length, 0, 'un origen ajeno no llega ni a verificar el token');
});

test('pay-worker: /api/restore mueve el permiso, rechaza otro correo y limita los movimientos', async () => {
  const w = use(new World());
  const txn = txnId(100);
  w.addTxn({ id: txn, uid: 'alice', invoice: '325-10566', email: 'Ana.Perez@Example.com' });
  await hook(completed(txn, 'alice', { at: T('59.100001') }));
  assert.equal(w.get('entitlements/alice').order, txn);

  // correo equivocado y factura inexistente: el mismo error genérico, sin escribir nada
  const n = w.commits();
  const wrong = await call(api('/api/restore', { token: BOB, body: { invoice: '325-10566', email: 'otra@example.com' } }));
  const missing = await call(api('/api/restore', { token: BOB, body: { invoice: '999-99999', email: 'ana.perez@example.com' } }));
  assert.equal(wrong.status, 400);
  assert.deepEqual(wrong, Object.assign({}, missing, { headers: wrong.headers }));
  assert.equal((await call(api('/api/restore', { token: BOB, body: { invoice: '../x', email: 'a@b.c' } }))).status, 400);
  assert.equal((await call(api('/api/restore', { body: { invoice: '325-10566', email: 'ana.perez@example.com' } }))).status, 401);
  assert.equal(w.commits(), n);

  // correcto (sin distinguir mayúsculas ni espacios): el permiso pasa de alice a bob
  let r = await call(api('/api/restore', { token: BOB, body: { invoice: ' 325-10566 ', email: ' ANA.PEREZ@example.com ' } }));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal(w.get('entitlements/bob').order, txn);
  assert.equal(w.get('entitlements/bob').source, 'paddle');
  assert.equal(w.get('entitlements/alice'), null);
  assert.equal(w.get('orders/' + txn).uid, 'bob');
  assert.equal(w.get('orders/' + txn).moves, 1);

  // otra vez a la misma cuenta: ok sin gastar un movimiento
  r = await call(api('/api/restore', { token: BOB, body: { invoice: '325-10566', email: 'ana.perez@example.com' } }));
  assert.equal(r.status, 200);
  assert.equal(w.get('orders/' + txn).moves, 1);

  // de vuelta a alice: el permiso de bob venía de esta compra y se va con ella. Volver a la cuenta que pagó no cuenta
  r = await call(api('/api/restore', { token: ALICE, body: { invoice: '325-10566', email: 'ana.perez@example.com' } }));
  assert.equal(r.status, 200);
  assert.equal(w.get('entitlements/bob'), null);
  assert.equal(w.get('orders/' + txn).moves, 1);

  // tope de movimientos
  const o = w.get('orders/' + txn);
  w.put('orders/' + txn, Object.assign(o, { moves: 5 }));
  r = await call(api('/api/restore', { token: CARLA, body: { invoice: '325-10566', email: 'ana.perez@example.com' } }));
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: 'limit' });
  assert.equal(w.get('entitlements/carla'), null);
  assert.equal(w.get('entitlements/alice').order, txn);

  // reembolsada: ya no se puede mover
  w.put('orders/' + txn, Object.assign(o, { moves: 0, status: 'refunded' }));
  r = await call(api('/api/restore', { token: CARLA, body: { invoice: '325-10566', email: 'ana.perez@example.com' } }));
  assert.equal(r.status, 400);
  assert.equal(w.get('entitlements/carla'), null);

  assert.ok(!logs.some((l) => /@/.test(l)), 'los logs no llevan correos');
});

test('pay-worker: /api/restore no le quita a la cuenta vieja un permiso de otra compra y espera al aviso', async () => {
  const w = use(new World());
  const txn = txnId(110);
  w.addTxn({ id: txn, uid: 'alice', invoice: '325-20000', email: 'ana@example.com' });
  // el aviso todavía no llegó
  let r = await call(api('/api/restore', { token: BOB, body: { invoice: '325-20000', email: 'ana@example.com' } }));
  assert.equal(r.status, 409);
  assert.deepEqual(r.body, { error: 'pending' });

  await hook(completed(txn, 'alice'));
  w.put('entitlements/alice', { premium: true, order: 'legacy', source: 'legacy', at: new Date() });   // alice además es veterana
  r = await call(api('/api/restore', { token: BOB, body: { invoice: '325-20000', email: 'ana@example.com' } }));
  assert.equal(r.status, 200);
  assert.equal(w.get('entitlements/alice').source, 'legacy', 'su permiso no venía de esta compra');
  assert.equal(w.get('entitlements/bob').order, txn);
});

test('pay-worker: reembolso, luego contracargo y chargeback_reverse: la compra sigue reembolsada', async () => {
  const w = use(new World());
  const txn = txnId(120);
  await hook(completed(txn, 'alice', { at: T('20.000001') }));
  await hook(adjustment(txn, 'refund', 'approved', T('21.000001')));
  assert.equal(w.get('entitlements/alice'), null);
  assert.equal(w.get('orders/' + txn).refund, true);
  // el comprador además reclama al banco y Paddle gana la disputa: el reembolso ya le devolvió el dinero
  await hook(adjustment(txn, 'chargeback', 'approved', T('22.000001'), 'adjustment.created'));
  await hook(adjustment(txn, 'chargeback_reverse', 'approved', T('23.000001'), 'adjustment.created'));
  assert.equal(w.get('entitlements/alice'), null, 'chargeback_reverse no devuelve una compra reembolsada');
  assert.equal(w.get('orders/' + txn).status, 'refunded');
});

test('pay-worker: un reembolso que llega después de un chargeback_reverse más nuevo igual quita', async () => {
  const w = use(new World());
  const txn = txnId(121);
  await hook(completed(txn, 'bob', { at: T('20.000001') }));
  // Paddle entrega primero el reverse (t23) y el reembolso (t21) llega tarde
  await hook(adjustment(txn, 'chargeback_reverse', 'approved', T('23.000001'), 'adjustment.created'));
  assert.equal(w.get('entitlements/bob').order, txn);
  await hook(adjustment(txn, 'refund', 'approved', T('21.000001')));
  assert.equal(w.get('entitlements/bob'), null);
  assert.equal(w.get('orders/' + txn).status, 'refunded');
  assert.equal(w.get('orders/' + txn).occurredAt, T('23.000001'), 'la hora de las disputas no retrocede');
  // un contracargo viejo repetido no cambia nada
  const before = JSON.stringify([...w.docs]);
  await hook(adjustment(txn, 'chargeback', 'approved', T('22.000001'), 'adjustment.created'));
  assert.equal(JSON.stringify([...w.docs]), before);
});

test('pay-worker: un permiso legacy o manual no se pisa con una compra y sobrevive a su reembolso', async () => {
  const w = use(new World());
  w.put('entitlements/bob', { premium: true, order: '', source: 'manual', at: new Date() });
  const txn = txnId(130);
  await hook(completed(txn, 'bob', { at: T('30.000001') }));
  assert.equal(w.get('entitlements/bob').source, 'manual');
  assert.equal(w.get('orders/' + txn).uid, 'bob', 'la orden igual queda a su nombre');
  await hook(adjustment(txn, 'refund', 'approved', T('31.000001')));
  assert.equal(w.get('entitlements/bob').source, 'manual', 'el reembolso de la compra no le quita el regalo');

  // chargeback_reverse sobre una cuenta legacy tampoco lo pisa
  w.put('entitlements/carla', { premium: true, order: '', source: 'legacy', at: new Date() });
  const t2 = txnId(131);
  await hook(completed(t2, 'carla', { at: T('32.000001') }));
  await hook(adjustment(t2, 'chargeback', 'approved', T('33.000001'), 'adjustment.created'));
  await hook(adjustment(t2, 'chargeback_reverse', 'approved', T('34.000001'), 'adjustment.created'));
  assert.equal(w.get('entitlements/carla').source, 'legacy');
  assert.equal(w.get('orders/' + t2).status, 'paid');
});

test('pay-worker: «Ya pagué» de una compra deja a la cuenta vieja con su otra compra pagada', async () => {
  const w = use(new World());
  const a = txnId(140), b = txnId(141);
  w.addTxn({ id: b, uid: 'alice', invoice: '325-41000', email: 'ana@example.com' });
  await hook(completed(a, 'alice', { at: T('40.000001') }));
  await hook(completed(b, 'alice', { at: T('41.000001') }));
  assert.equal(w.get('entitlements/alice').order, b);
  const r = await call(api('/api/restore', { token: BOB, body: { invoice: '325-41000', email: 'ana@example.com' } }));
  assert.equal(r.status, 200);
  assert.equal(w.get('entitlements/bob').order, b);
  assert.equal(w.get('entitlements/alice').order, a, 'alice conserva el permiso de su otra compra');
});

test('pay-worker: «Ya pagué» exige el número de factura exacto aunque Paddle filtre por prefijo', async () => {
  const w = use(new World());
  w.looseInvoice = true;
  const txn = txnId(150);
  w.addTxn({ id: txn, uid: 'alice', invoice: '325-10566', email: 'ana@example.com' });
  await hook(completed(txn, 'alice'));
  for (const invoice of ['325', '325-1', '325-105']) {
    const r = await call(api('/api/restore', { token: BOB, body: { invoice, email: 'ana@example.com' } }));
    assert.equal(r.status, 400, invoice);
  }
  assert.equal(w.get('entitlements/bob'), null);
  assert.equal(w.get('entitlements/alice').order, txn);
  // con el número completo sí
  assert.equal((await call(api('/api/restore', { token: BOB, body: { invoice: '325-10566', email: 'ana@example.com' } }))).status, 200);
});

test('pay-worker: quien adivina factura y correo no puede gastar el tope y dejar fuera al comprador', async () => {
  const w = use(new World());
  const txn = txnId(160);
  w.addTxn({ id: txn, uid: 'alice', invoice: '325-60000', email: 'ana@example.com' });
  await hook(completed(txn, 'alice'));
  const steal = (token) => call(api('/api/restore', { token, body: { invoice: '325-60000', email: 'ana@example.com' } }));
  // el atacante la pasea entre cuentas anónimas hasta el tope
  const seq = [MALLORY, ERIN, MALLORY, ERIN, MALLORY];
  for (const tok of seq) assert.equal((await steal(tok)).status, 200);
  assert.equal(w.get('orders/' + txn).moves, 5);
  assert.deepEqual((await steal(ERIN)).body, { error: 'limit' }, 'el sexto traslado ya no');
  // la cuenta que pagó siempre puede recuperarla (no cuenta para el tope)
  assert.equal((await steal(ALICE)).status, 200);
  assert.equal(w.get('entitlements/alice').order, txn);
  assert.equal(w.get('entitlements/mallory'), null);
  assert.equal(w.get('orders/' + txn).moves, 5);
  // y también una cuenta de Google con el correo de la compra verificado (otro aparato, sin la sesión original)
  assert.equal((await steal(DORA)).status, 200);
  assert.equal(w.get('entitlements/dora').order, txn);
  assert.equal(w.get('orders/' + txn).moves, 5);
  // una cuenta cualquiera sigue frenada por el tope
  assert.deepEqual((await steal(CARLA)).body, { error: 'limit' });
});

test('pay-worker: { from } trae la compra de la sesión con apodo al entrar con una cuenta de Google que ya existía', async () => {
  const w = use(new World());
  const txn = txnId(170);
  await hook(completed(txn, 'anon1', { at: T('50.000001') }));
  assert.equal(w.get('entitlements/anon1').order, txn);
  const n = w.commits();
  // sin la sesión anónima, con un token ajeno de Google, o de una cuenta anónima sin compra: error genérico
  for (const from of ['basura', BOB, ANON2]) {
    const r = await call(api('/api/restore', { token: ALICE, body: { from } }));
    assert.equal(r.status, 400, from);
  }
  // el destino tampoco puede ser otra sesión anónima: serían traslados gratis encadenados
  assert.equal((await call(api('/api/restore', { token: ANON2, body: { from: ANON1 } }))).status, 400);
  assert.equal(w.get('entitlements/anon1').order, txn);
  assert.equal(w.commits(), n);
  const r = await call(api('/api/restore', { token: ALICE, body: { from: ANON1 } }));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal(w.get('entitlements/alice').order, txn);
  assert.equal(w.get('entitlements/anon1'), null);
  assert.equal(w.get('orders/' + txn).uid, 'alice');
  assert.equal(w.get('orders/' + txn).moves, 0, 'no gasta traslados');
  // repetirlo ya no encuentra nada que traer
  assert.equal((await call(api('/api/restore', { token: ALICE, body: { from: ANON1 } }))).status, 400);
});

test('pay-worker: sandbox solo para TEST_UIDS (checkout, permiso y «Ya pagué»)', async () => {
  const env = Object.assign({}, ENV, { TEST_UIDS: 'alice' });
  const w = use(new World(env));
  let r = await call(api('/api/checkout', { token: BOB }), env);
  assert.equal(r.status, 403);
  assert.deepEqual(r.body, { error: 'sandbox' });
  assert.equal(w.calls.filter((c) => c.host === 'sandbox-api.paddle.com').length, 0, 'no crea transacciones');
  // alguien abre el pago de sandbox por su cuenta con customData { uid: bob }: la compra queda sin dueño
  const txn = txnId(180);
  await hook(completed(txn, 'bob'), env);
  assert.equal(w.get('entitlements/bob'), null);
  assert.equal(w.get('orders/' + txn).uid, '');
  r = await call(api('/api/restore', { token: BOB, body: { invoice: '325-80000', email: 'ana@example.com' } }), env);
  assert.equal(r.status, 403);
  // la cuenta de prueba sí
  r = await call(api('/api/checkout', { token: ALICE }), env);
  assert.equal(r.status, 200);
  // sin TEST_UIDS el sandbox no da permisos a nadie; en live no hay lista
  const none = Object.assign({}, ENV, { TEST_UIDS: '' });
  use(new World(none));
  assert.equal((await call(api('/api/checkout', { token: ALICE }), none)).status, 403);
  const live = Object.assign({}, ENV, { PADDLE_ENV: 'live', PADDLE_API_KEY: 'pdl_live_apikey_test', TEST_UIDS: '' });
  const wl = use(new World(live));
  await hook(completed(txnId(181), 'bob'), live);
  assert.equal(wl.get('entitlements/bob').order, txnId(181));
});

test('pay-worker: con el binding RATE_LIMIT, checkout y restore responden 429 al pasarse (el webhook no)', async () => {
  const counts = new Map();
  const keys = [];
  const RATE_LIMIT = { limit: async ({ key }) => { keys.push(key); const n = (counts.get(key) || 0) + 1; counts.set(key, n); return { success: n <= 2 }; } };
  const env = Object.assign({}, ENV, { RATE_LIMIT });
  const w = use(new World(env));
  const req = () => { const q = api('/api/checkout', { token: ALICE }); q.headers.set('CF-Connecting-IP', '203.0.113.7'); return q; };
  assert.equal((await call(req(), env)).status, 200);
  assert.equal((await call(req(), env)).status, 200);
  const r = await call(req(), env);
  assert.equal(r.status, 429);
  assert.deepEqual(r.body, { error: 'rate' });
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), SITE, 'con CORS, para que el juego lea el error');
  assert.ok(keys.includes('checkout:ip:203.0.113.7'));
  assert.ok(keys.includes('checkout:uid:alice'));
  const lookups = w.calls.filter((c) => c.host === 'identitytoolkit.googleapis.com').length;
  assert.equal(lookups, 2, 'pasado el límite por IP ni siquiera se verifica el token');
  // el webhook no pasa por el límite
  assert.equal((await hook(completed(txnId(190), 'alice'), env)).status, 200);
  // si el binding falla, se deja pasar (no se frena una venta)
  const broken = Object.assign({}, ENV, { RATE_LIMIT: { limit: async () => { throw new Error('caído'); } } });
  use(new World(broken));
  assert.equal((await call(api('/api/checkout', { token: BOB }), broken)).status, 200);
});
