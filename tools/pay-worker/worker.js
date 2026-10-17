/* Cocardo: ¡Rescate Helado! — Worker de Cloudflare «cocardo-pagos» (ruta cocardo.app/api/*).
 *
 * Vende el «juego completo» (pago único) con Paddle Billing, que es el comerciante registrado: cobra, factura y paga
 * los impuestos. El juego no tiene servidor ni Cloud Functions (plan Spark), así que este Worker es el único que
 * escribe los permisos en Firestore, con una cuenta de servicio de Google (OAuth con JWT RS256; las reglas de
 * seguridad no lo frenan, lo autoriza IAM):
 *   entitlements/{uid}  { premium:true, order:'txn_…', source:'paddle'|'legacy'|'manual', at }   lo lee solo el dueño
 *   orders/{txn}        { uid, status:'paid'|'refunded', priceId, occurredAt, moves, updatedAt [, refund:true] }   nadie
 *                       desde el navegador. uid '' = compra sin dueño (sin custom_data.uid): la reclama «Ya pagué».
 *                       refund:true = hubo un reembolso completo aprobado; es definitivo (ningún contracargo lo deshace)
 * Un permiso 'legacy' o 'manual' nunca se pisa: si esa cuenta además compra, la orden queda a su nombre y listo.
 *
 * Rutas:
 *   GET  /api/health    { ok:true, env }
 *   POST /api/checkout  (Bearer <ID token de Firebase>) crea la transacción de Paddle con custom_data.uid
 *                       → { transactionId, checkoutUrl } o { already:true }
 *   POST /api/webhook   avisos de Paddle (firma Paddle-Signature): transaction.completed da el permiso; un reembolso
 *                       completo aprobado, un contracargo o un chargeback_warning (adjustment.created/updated) lo quitan
 *                       y chargeback_reverse / chargeback_warning_reverse lo devuelven (salvo que haya reembolso)
 *   POST /api/restore   (Bearer) { invoice, email } «Ya pagué»: verifica la factura con Paddle y mueve el permiso a
 *                       esta cuenta → { ok:true } o un error genérico. Máximo 5 traslados por compra, salvo de vuelta a
 *                       la cuenta que pagó o a una cuenta de Google con el correo verificado de la compra (no cuentan:
 *                       así nadie que adivine la factura puede gastar el tope y dejar fuera al comprador).
 *                       (Bearer) { from: <ID token de la sesión con apodo> }: al entrar con una cuenta de Google que ya
 *                       existía, el juego trae la compra de la sesión anónima que deja (prueba los dos tokens, no cuenta)
 *
 * Sandbox: con PADDLE_ENV distinto de 'live' solo las cuentas de TEST_UIDS (uids separados por comas) pueden pedir
 * pagos, recibir permisos o usar «Ya pagué»; las demás compras quedan sin dueño. Así el sandbox, que corre sobre el
 * Firestore de producción, no regala el juego a quien consiga el token de prueba.
 * Límite de pedidos: si el Worker tiene el binding RATE_LIMIT (Workers Rate Limiting), /api/checkout y /api/restore
 * responden 429 al pasarse, por IP y por cuenta (el webhook no se limita). Sin el binding no se limita aquí.
 *
 * Paddle no garantiza el orden ni la cantidad de entregas de cada aviso. orders/{txn}.occurredAt guarda la hora
 * (occurred_at) del aviso de contracargo (o de su reversión) más nuevo que tocó la orden y los más viejos se ignoran;
 * un reembolso aprobado vale aunque llegue tarde. Un reembolso o contracargo que llega antes que la compra crea la
 * orden ya «refunded» para que la compra tardía no dé el permiso. Cada cambio es un solo commit de Firestore con
 * precondiciones (exists / updateTime): si otro aviso ganó la carrera se relee y se vuelve a decidir.
 * Problemas permanentes (otro precio, reembolso parcial, evento desconocido) → 200 y log; fallos de Google, Firestore o
 * Paddle → 500 para que Paddle reintente (lo hace durante 3 días en live). Logs en JSON, sin correos.
 * CPU: en el plan gratis cada pedido tiene 10 ms; esperar la red no cuenta. La clave RSA importada y el token de
 * Google quedan en memoria del isolate (el token hasta 60 s antes de vencer), así que firmar es raro.
 * Se instala con tools/setup-cloudflare-pay.sh (ahí están las variables y los secretos). */

const PADDLE_API = { sandbox: 'https://sandbox-api.paddle.com', live: 'https://api.paddle.com' };
const FIRESTORE = 'https://firestore.googleapis.com/v1';
const OAUTH_URL = 'https://oauth2.googleapis.com/token';
const LOOKUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup';
const SCOPE = 'https://www.googleapis.com/auth/datastore';

const UID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const TXN_RE = /^txn_[a-z0-9]{10,64}$/;     // Paddle: txn_ + 26 caracteres [a-z0-9]
const INVOICE_RE = /^[A-Za-z0-9]{1,16}-[A-Za-z0-9-]{3,48}$/;   // p. ej. 325-10566 (sin comas: el filtro de Paddle las usa)
const TOKEN_RE = /^[A-Za-z0-9._-]{20,4096}$/;
const SIG_TOLERANCE = 5;                    // segundos entre ts de la firma y el reloj (lo que recomienda Paddle)
const MAX_MOVES = 5;                        // veces que «Ya pagué» puede mover una compra de cuenta
const MAX_BODY = 512 * 1024;
const TIMEOUT_MS = 4000;                    // Paddle espera el 200 en menos de 5 s
const TRIES = 3;                            // vueltas leer → decidir → commit si otro escribió en el medio
// estados de un ajuste que todavía no cambian nada (o que ya se deshicieron: llega su *_reverse aparte)
const NOT_FINAL = new Set(['pending_approval', 'rejected', 'reversed']);
// ajustes de disputa: los dos devuelven el dinero al comprador (Paddle crea uno u otro según haya aviso previo)
const DISPUTE = new Set(['chargeback', 'chargeback_warning']);
const DISPUTE_REVERSE = new Set(['chargeback_reverse', 'chargeback_warning_reverse']);
// errores de commit que significan «la precondición no se cumplió» (google.rpc.Code: 409, 400 y 404)
const PRECONDITION = new Set(['ALREADY_EXISTS', 'FAILED_PRECONDITION', 'NOT_FOUND']);

const enc = new TextEncoder();

// Fallo de Google, Firestore o Paddle (red, 5xx, permisos): el webhook responde 500 y Paddle reintenta
class Upstream extends Error {}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    try {
      if (path === '/api/webhook') {
        return request.method === 'POST' ? await webhook(request, env) : text('method', 405);
      }
      if (path === '/api/health') return json({ ok: true, env: env.PADDLE_ENV || null });
      if (path === '/api/checkout' || path === '/api/restore') return await browserRoute(request, env, path);
      return json({ error: 'not_found' }, 404);
    } catch (e) {
      log('error', { path, msg: errMsg(e) });
      return json({ error: 'server' }, 500);
    }
  },
};

/* ---------- utilidades ---------- */

function log(ev, data) { console.log(JSON.stringify(Object.assign({ ev }, data))); }
function errMsg(e) { return String((e && e.message) || e).slice(0, 200); }

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers),
  });
}
function text(body, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
}

// fetch con tiempo máximo; un corte de red cuenta como fallo pasajero
async function call(url, init = {}) {
  const opts = Object.assign({}, init);
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opts.signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    return await fetch(url, opts);
  } catch (e) {
    throw new Upstream('red ' + new URL(url).hostname + ' ' + ((e && e.name) || 'error'));
  }
}

async function readJson(r) {
  try { return await r.json(); } catch (_) { return null; }
}

function bytesToB64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function hex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}
// comparación en tiempo constante (no corta en el primer carácter distinto)
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ¿la hora a (occurred_at) es anterior a b? RFC 3339 de Paddle con microsegundos; sin fecha válida no es «anterior»
function older(a, b) {
  const pa = isoParts(a), pb = isoParts(b);
  if (pa && pb) return pa.base < pb.base || (pa.base === pb.base && pa.frac < pb.frac);
  const ta = Date.parse(a), tb = Date.parse(b);
  return Number.isFinite(ta) && Number.isFinite(tb) && ta < tb;
}
function isoParts(s) {
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?Z$/.exec(String(s || ''));
  return m ? { base: m[1], frac: (m[2] || '').padEnd(9, '0') } : null;
}

function hasPrice(t, priceId) {
  return !!priceId && Array.isArray(t.items)
    && t.items.some((i) => i && ((i.price && i.price.id) === priceId || i.price_id === priceId));
}

/* ---------- CORS, sesión de Firebase, /api/checkout y /api/restore ---------- */

function siteOrigins(env) {
  return String(env.SITE_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
}

async function browserRoute(request, env, path) {
  const origin = request.headers.get('Origin');
  // sin Origin no es un navegador (curl): no hay CORS que cuidar y el token sigue siendo obligatorio
  if (origin && !siteOrigins(env).includes(origin)) {
    log('origin_reject', { path });
    return json({ error: 'origin' }, 403);
  }
  const cors = origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: Object.assign({
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
    }, cors) });
  }
  if (request.method !== 'POST') return json({ error: 'method' }, 405, cors);
  const route = path === '/api/checkout' ? 'checkout' : 'restore';
  // por IP antes de mirar el token (una sesión anónima no cuesta nada) y por cuenta después
  if (!(await allow(env, route + ':ip:' + (request.headers.get('CF-Connecting-IP') || '')))) {
    log('rate_limit', { path, by: 'ip' });
    return json({ error: 'rate' }, 429, cors);
  }
  let res;
  try {
    const user = await verifyUser(request, env);
    if (!user) res = { status: 401, body: { error: 'auth' } };
    else if (!(await allow(env, route + ':uid:' + user.uid))) { log('rate_limit', { path, by: 'uid' }); res = { status: 429, body: { error: 'rate' } }; }
    else res = route === 'checkout' ? await checkout(env, user.uid) : await restore(request, env, user);
  } catch (e) {
    log(route + '_error', { msg: errMsg(e) });
    res = e instanceof Upstream ? { status: 503, body: { error: 'busy' } } : { status: 500, body: { error: 'server' } };
  }
  return json(res.body, res.status, cors);
}

// Workers Rate Limiting (binding RATE_LIMIT, ver tools/setup-cloudflare-pay.sh). Sin binding, o si falla, deja pasar:
// mejor eso que frenar una venta
async function allow(env, key) {
  const rl = env.RATE_LIMIT;
  if (!rl || typeof rl.limit !== 'function') return true;
  try {
    const r = await rl.limit({ key });
    return !(r && r.success === false);
  } catch (e) {
    log('rate_limit_error', { msg: errMsg(e) });
    return true;
  }
}

// Sandbox: solo las cuentas de prueba (TEST_UIDS) pueden comprar o recibir permisos. En live, todas
function canGrant(env, uid) {
  if (env.PADDLE_ENV === 'live') return true;
  return String(env.TEST_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean).includes(uid);
}

// ¿El permiso actual de la cuenta es de otro origen (jugador antiguo o regalo a mano)? Esos no se pisan ni se borran
function keeps(ent) { return !!(ent && ent.fields.premium === true && ent.fields.source !== 'paddle'); }

// Escribe el permiso completo con la precondición de lo que se leyó (cur: null = no existía)
function entWrite(env, uid, cur, data) {
  return cur ? writeSet(env, 'entitlements/' + uid, data, cur.updateTime) : writeCreate(env, 'entitlements/' + uid, data);
}

// La compra txn deja de ser de uid: si su permiso venía de ella pasa a otra compra pagada suya o se borra.
// → { w, moved } para sumar al commit, o null si su permiso no venía de esta compra
async function releaseWrite(env, uid, txn, now) {
  const ent = await fsGet(env, 'entitlements/' + uid);
  if (!ent || ent.fields.order !== txn) return null;
  const moved = await otherPaidOrder(env, uid, txn);
  return {
    moved,
    w: moved ? writeSet(env, 'entitlements/' + uid, grantDoc(moved, now), ent.updateTime)
      : writeDelete(env, 'entitlements/' + uid, ent.updateTime),
  };
}

// ID token de Firebase → { uid, anon, email, emailVerified }, preguntándole a Identity Toolkit (verifica firma,
// vencimiento y proyecto); null si no vale
async function lookup(env, token) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  if (!env.FIREBASE_API_KEY) throw new Upstream('config: falta FIREBASE_API_KEY');
  const headers = { 'Content-Type': 'application/json' };
  // por si la apiKey tiene restricción de sitios web (HTTP referrer): el pedido sale «desde» el juego
  const site = siteOrigins(env)[0];
  if (site) headers.Referer = site + '/';
  const r = await call(LOOKUP_URL + '?key=' + encodeURIComponent(env.FIREBASE_API_KEY), {
    method: 'POST', headers, body: JSON.stringify({ idToken: token }),
  });
  if (r.status >= 500 || r.status === 429) throw new Upstream('lookup ' + r.status);
  const d = await readJson(r);
  if (!r.ok) {
    const reason = String((d && d.error && d.error.message) || r.status);
    // un token vencido o de otro proyecto es normal; una apiKey mal configurada no
    if (r.status === 403 || /API_KEY|PERMISSION/.test(reason)) log('lookup_config', { status: r.status, reason: reason.slice(0, 80) });
    return null;
  }
  const u = d && Array.isArray(d.users) ? d.users[0] : null;
  if (!u || u.disabled === true || typeof u.localId !== 'string' || !UID_RE.test(u.localId)) return null;
  const providers = Array.isArray(u.providerUserInfo) ? u.providerUserInfo.length : 0;
  return {
    uid: u.localId,
    anon: !providers && !u.email && !u.phoneNumber,   // sesión anónima («Jugar con apodo»): sin proveedor ni correo
    email: typeof u.email === 'string' ? u.email.trim().toLowerCase() : '',
    emailVerified: u.emailVerified === true,
  };
}
async function verifyUser(request, env) {
  const m = /^Bearer\s+(\S+)$/.exec(request.headers.get('Authorization') || '');
  return m ? lookup(env, m[1]) : null;
}

async function checkout(env, uid) {
  if (!canGrant(env, uid)) { log('checkout_reject', { uid, reason: 'not_test_uid' }); return { status: 403, body: { error: 'sandbox' } }; }
  const ent = await fsGet(env, 'entitlements/' + uid);
  if (ent && ent.fields.premium === true) return { status: 200, body: { already: true } };
  if (!env.PADDLE_PRICE_ID) throw new Upstream('config: falta PADDLE_PRICE_ID');
  const r = await paddle(env, 'POST', '/transactions', {
    items: [{ price_id: env.PADDLE_PRICE_ID, quantity: 1 }],
    custom_data: { uid },
  });
  const t = r.data;
  if (!r.ok || !t || !TXN_RE.test(String(t.id || ''))) {
    log('checkout_fail', { status: r.status, code: r.code, request: r.requestId });
    return { status: 502, body: { error: 'paddle' } };
  }
  log('checkout', { uid, txn: t.id });
  // checkout.url = enlace de pago por defecto + ?_ptxn=txn_… (null si Paddle no tiene enlace por defecto aprobado)
  return { status: 200, body: { transactionId: t.id, checkoutUrl: (t.checkout && t.checkout.url) || null } };
}

// «Ya pagué»: número de factura + correo de la compra → el permiso pasa a esta cuenta (user.uid).
// Con { from } en vez de factura: traslado desde la sesión anónima que se acaba de dejar (carry)
async function restore(request, env, user) {
  const newUid = user.uid;
  const nope = { status: 400, body: { error: 'invalid' } };   // mismo error si la factura no existe o no coincide
  let body = null;
  try { body = await request.json(); } catch (_) { /* cuerpo inválido */ }
  if (!canGrant(env, newUid)) { log('restore_reject', { uid: newUid, reason: 'not_test_uid' }); return { status: 403, body: { error: 'sandbox' } }; }
  if (body && typeof body.from === 'string') return carry(env, user, body.from);
  const invoice = String((body && body.invoice) || '').trim();
  const email = String((body && body.email) || '').trim().toLowerCase();
  if (!INVOICE_RE.test(invoice) || email.length > 254 || email.indexOf('@') < 1) return nope;

  // GET /transactions?invoice_number=… (filtro documentado) con include=customer para tener el correo en un pedido.
  // Solo vale la que tiene exactamente ese número (no se confía en cómo filtra Paddle)
  const r = await paddle(env, 'GET', '/transactions?invoice_number=' + encodeURIComponent(invoice) + '&include=customer&per_page=5');
  if (!r.ok) {
    log('restore_paddle', { status: r.status, code: r.code, request: r.requestId });
    throw new Upstream('paddle ' + r.status);
  }
  const t = (Array.isArray(r.data) ? r.data : []).find((x) => x && x.status === 'completed' && x.invoice_number === invoice
    && TXN_RE.test(String(x.id || '')) && hasPrice(x, env.PADDLE_PRICE_ID));
  if (!t) { log('restore_reject', { uid: newUid, reason: 'invoice' }); return nope; }
  let buyer = t.customer && t.customer.email;
  if (!buyer && t.customer_id) {
    const c = await paddle(env, 'GET', '/customers/' + encodeURIComponent(t.customer_id));
    if (!c.ok) throw new Upstream('paddle customer ' + c.status);
    buyer = c.data && c.data.email;
  }
  if (!buyer || !safeEqual(String(buyer).trim().toLowerCase(), email)) {
    log('restore_reject', { uid: newUid, txn: t.id, reason: 'email' });
    return nope;
  }

  // La factura es suya: desde acá los errores pueden ser específicos
  const txn = t.id;
  // traslados que no cuentan para el tope: de vuelta a la cuenta que pagó, o a una cuenta con el correo de la compra
  // verificado (Google). Así quien adivine factura y correo no puede gastar el tope y dejar fuera al comprador
  const buyerUid = t.custom_data && typeof t.custom_data.uid === 'string' ? t.custom_data.uid : '';
  const free = newUid === buyerUid || (user.emailVerified && !!user.email && user.email === email);
  for (let i = 0; i < TRIES; i++) {
    const order = await fsGet(env, 'orders/' + txn);
    if (!order) {   // el aviso de Paddle todavía no llegó (o falló y Paddle lo está reintentando)
      log('restore_pending', { uid: newUid, txn });
      return { status: 409, body: { error: 'pending' } };
    }
    const o = order.fields;
    if (o.status !== 'paid') { log('restore_reject', { uid: newUid, txn, reason: 'refunded' }); return nope; }
    const now = new Date();
    const mine = await fsGet(env, 'entitlements/' + newUid);
    if (o.uid === newUid) {   // ya era de esta cuenta: solo se repone el permiso si faltaba
      if (mine && mine.fields.premium === true) return { status: 200, body: { ok: true } };
      if (await fsCommit(env, [
        entWrite(env, newUid, mine, grantDoc(txn, now)),
        writePatch(env, 'orders/' + txn, { updatedAt: now }, order.updateTime),   // que un reembolso en el medio gane
      ])) { log('restore', { txn, to: newUid, moves: o.moves || 0 }); return { status: 200, body: { ok: true } }; }
      continue;
    }
    const moves = Number(o.moves) || 0;
    const counts = !!o.uid && !free;   // reclamar una compra sin dueño tampoco cuenta
    if (counts && moves >= MAX_MOVES) { log('restore_limit', { uid: newUid, txn }); return { status: 409, body: { error: 'limit' } }; }
    if (mine && mine.fields.premium === true) return { status: 200, body: { ok: true } };   // esta cuenta ya lo tiene
    const writes = [
      entWrite(env, newUid, mine, grantDoc(txn, now)),
      writePatch(env, 'orders/' + txn, { uid: newUid, moves: counts ? moves + 1 : moves, updatedAt: now }, order.updateTime),
    ];
    // la cuenta anterior lo pierde solo si su permiso venía de esta compra (y si tiene otra pagada, pasa a esa)
    const rel = o.uid ? await releaseWrite(env, o.uid, txn, now) : null;
    if (rel) writes.push(rel.w);
    if (await fsCommit(env, writes)) {
      log('restore', { txn, from: o.uid || null, to: newUid, moves: counts ? moves + 1 : moves, free: !counts });
      return { status: 200, body: { ok: true } };
    }
  }
  throw new Upstream('contención en orders/' + txn);
}

// Entró con una cuenta de Google que ya existía desde una sesión con apodo (anónima) que tenía la compra: con el
// token de esa sesión (prueba que es suya) la compra pasa a esta cuenta. No gasta traslados, así que el destino no
// puede ser otra sesión anónima (si no, se encadenarían traslados gratis de anónima en anónima)
async function carry(env, to, fromToken) {
  const nope = { status: 400, body: { error: 'invalid' } };
  const toUid = to.uid;
  if (to.anon) { log('carry_reject', { uid: toUid, reason: 'to_anon' }); return nope; }
  const from = await lookup(env, fromToken);
  if (!from || !from.anon || from.uid === toUid) { log('carry_reject', { uid: toUid, reason: 'from' }); return nope; }
  for (let i = 0; i < TRIES; i++) {
    const ent = await fsGet(env, 'entitlements/' + from.uid);
    const txn = ent && ent.fields.premium === true && ent.fields.source === 'paddle' ? String(ent.fields.order || '') : '';
    if (!TXN_RE.test(txn)) { log('carry_reject', { uid: toUid, from: from.uid, reason: 'nothing' }); return nope; }
    const order = await fsGet(env, 'orders/' + txn);
    if (!order || order.fields.status !== 'paid' || order.fields.uid !== from.uid) {
      log('carry_reject', { uid: toUid, from: from.uid, txn, reason: 'order' });
      return nope;
    }
    const now = new Date();
    const mine = await fsGet(env, 'entitlements/' + toUid);
    const writes = [writePatch(env, 'orders/' + txn, { uid: toUid, updatedAt: now }, order.updateTime)];
    if (!(mine && mine.fields.premium === true)) writes.push(entWrite(env, toUid, mine, grantDoc(txn, now)));
    const rel = await releaseWrite(env, from.uid, txn, now);
    if (rel) writes.push(rel.w);
    if (await fsCommit(env, writes)) {
      log('carry', { txn, from: from.uid, to: toUid });
      return { status: 200, body: { ok: true } };
    }
  }
  throw new Upstream('contención en la cuenta ' + from.uid);
}

/* ---------- Paddle ---------- */

function paddleBase(env) {
  const live = env.PADDLE_ENV === 'live';
  const key = String(env.PADDLE_API_KEY || '');
  if (!key) throw new Upstream('config: falta PADDLE_API_KEY');
  // las claves nuevas dicen su entorno: pdl_live_apikey_… / pdl_sdbx_apikey_…
  if (key.startsWith('pdl_') && !key.startsWith(live ? 'pdl_live_' : 'pdl_sdbx_')) {
    throw new Upstream('config: PADDLE_API_KEY no es de ' + (live ? 'live' : 'sandbox'));
  }
  return live ? PADDLE_API.live : PADDLE_API.sandbox;
}

async function paddle(env, method, path, body) {
  const headers = { Authorization: 'Bearer ' + env.PADDLE_API_KEY, 'Paddle-Version': '1' };
  if (body) headers['Content-Type'] = 'application/json';
  const r = await call(paddleBase(env) + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (r.status >= 500 || r.status === 429) throw new Upstream('paddle ' + r.status);
  const d = await readJson(r);
  return {
    ok: r.ok, status: r.status, data: d && d.data,
    code: d && d.error && d.error.code, requestId: d && d.meta && d.meta.request_id,
  };
}

/* ---------- webhook ---------- */

async function webhook(request, env) {
  // sin configuración completa no se descarta nada: 500 y Paddle reintenta cuando esté arreglado
  const missing = ['PADDLE_WEBHOOK_SECRET', 'PADDLE_PRICE_ID', 'FIREBASE_PROJECT'].filter((k) => !env[k]);
  if (missing.length) { log('config', { missing }); return text('config', 500); }
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) return text('too large', 413);
  const raw = new Uint8Array(await request.arrayBuffer());   // la firma es sobre los bytes tal cual llegaron
  if (raw.length > MAX_BODY) return text('too large', 413);
  const sig = await verifySignature(request.headers.get('Paddle-Signature'), raw, env.PADDLE_WEBHOOK_SECRET, Date.now() / 1000);
  if (sig !== true) { log('webhook_reject', { reason: sig }); return text('bad signature', 401); }

  let ev;
  try { ev = JSON.parse(new TextDecoder().decode(raw)); } catch (_) { ev = null; }
  if (!ev || typeof ev !== 'object') { log('webhook_ignore', { reason: 'json' }); return text('ok'); }
  const base = { type: String(ev.event_type || ''), id: String(ev.event_id || '') };
  try {
    if (ev.event_type === 'transaction.completed') return await onCompleted(env, ev, base);
    if (ev.event_type === 'adjustment.created' || ev.event_type === 'adjustment.updated') return await onAdjustment(env, ev, base);
    return ignore('event', base);
  } catch (e) {
    // también errores de programación: mejor que Paddle reintente que perder una compra
    log('webhook_retry', Object.assign({ msg: errMsg(e) }, base));
    return text('retry', 500);
  }
}

// Paddle-Signature: ts=<segundos>;h1=<hex>. h1 = HMAC-SHA256(secreto del destino, "<ts>:<cuerpo crudo>").
// Puede haber más de un h1 (rotación del secreto): basta con que uno coincida.
async function verifySignature(header, raw, secret, nowSec) {
  if (!header) return 'missing';
  let ts = '';
  const h1 = [];
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim(), v = part.slice(i + 1).trim();
    if (k === 'ts') ts = v;
    else if (k === 'h1' && /^[0-9a-fA-F]{64}$/.test(v)) h1.push(v.toLowerCase());
  }
  if (!/^\d{1,12}$/.test(ts) || !h1.length) return 'format';
  if (Math.abs(nowSec - Number(ts)) > SIG_TOLERANCE) return 'stale';
  const prefix = enc.encode(ts + ':');
  const msg = new Uint8Array(prefix.length + raw.length);
  msg.set(prefix);
  msg.set(raw, prefix.length);
  const mac = hex(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), msg)));
  let ok = false;
  for (const h of h1) ok = safeEqual(h, mac) || ok;   // sin cortar antes
  return ok ? true : 'mismatch';
}

let hmacCache = null;   // { secret, key }
async function hmacKey(secret) {
  if (!hmacCache || hmacCache.secret !== secret) {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    hmacCache = { secret, key };
  }
  return hmacCache.key;
}

function ignore(reason, base) {
  log('webhook_ignore', Object.assign({ reason }, base));
  return text('ok');   // Paddle solo da por entregado un 200
}

function grantDoc(txn, now) { return { premium: true, order: txn, source: 'paddle', at: now }; }

// uid de custom_data al que se le puede dar el permiso, o '' (compra sin dueño: la reclama «Ya pagué»).
// Sin dueño: transacción creada o facturada a mano en el panel de Paddle, o en sandbox una cuenta fuera de TEST_UIDS
function ownerOf(env, t, base) {
  const uid = t.custom_data && t.custom_data.uid;
  if (typeof uid !== 'string' || !UID_RE.test(uid)) { log('unclaimed', Object.assign({ reason: 'bad_uid' }, base)); return ''; }
  if (!canGrant(env, uid)) { log('unclaimed', Object.assign({ reason: 'not_test_uid', uid }, base)); return ''; }
  return uid;
}

// transaction.completed: crea orders/{txn} (si no existía) y entitlements/{uid} en el mismo commit
async function onCompleted(env, ev, base) {
  const t = ev.data || {};
  const txn = String(t.id || '');
  Object.assign(base, { txn });
  if (!TXN_RE.test(txn)) return ignore('bad_txn', base);
  if (t.status !== 'completed') return ignore('status', base);
  if (!hasPrice(t, env.PADDLE_PRICE_ID)) return ignore('other_price', base);
  const uid = ownerOf(env, t, base);
  for (let i = 0; i < TRIES; i++) {
    const now = new Date();
    const writes = [writeCreate(env, 'orders/' + txn, { uid, status: 'paid', priceId: env.PADDLE_PRICE_ID, occurredAt: String(ev.occurred_at || ''), moves: 0, updatedAt: now })];
    let kept = false;
    if (uid) {
      const ent = await fsGet(env, 'entitlements/' + uid);
      kept = keeps(ent);   // jugador antiguo o regalo a mano que además compra: su permiso queda como está
      if (!kept) writes.push(entWrite(env, uid, ent, grantDoc(txn, now)));
    }
    if (await fsCommit(env, writes)) {
      log(uid ? 'grant' : 'grant_unclaimed', Object.assign({ uid: uid || null, kept }, base));
      return text('ok');
    }
    // la orden ya existía: entrega repetida (no se toca: el permiso pudo moverse con «Ya pagué») o reembolso previo
    const cur = await fsGet(env, 'orders/' + txn);
    if (cur) {
      log(cur.fields.status === 'refunded' ? 'grant_skip_refunded' : 'grant_duplicate', Object.assign({ uid: uid || null }, base));
      return text('ok');
    }
    // si no, cambió el permiso entre la lectura y el commit: se relee
  }
  throw new Upstream('contención en orders/' + txn);
}

// Reembolso completo: adjustment.type 'full', o 'partial' con todas sus líneas 'full' (la compra tiene una sola
// línea). Uno parcial (un descuento de cortesía o el IVA que Paddle devuelve solo al poner un número fiscal) no quita
function fullRefund(a) {
  if (a.type !== 'partial') return true;
  return Array.isArray(a.items) && a.items.length > 0 && a.items.every((i) => i && i.type === 'full');
}

async function onAdjustment(env, ev, base) {
  const a = ev.data || {};
  const txn = String(a.transaction_id || '');
  Object.assign(base, { txn, action: a.action, status: a.status, kind: a.type });
  if (!TXN_RE.test(txn)) return ignore('bad_txn', base);
  const at = String(ev.occurred_at || '');
  // reembolso: solo aprobado (nace pending_approval y el cambio llega en adjustment.updated; se acepta en los dos)
  if (a.action === 'refund') {
    if (a.status !== 'approved') return ignore('adjustment', base);
    return fullRefund(a) ? revoke(env, txn, at, base, true) : ignore('partial_refund', base);
  }
  // contracargo o aviso de contracargo: Paddle los crea solos y en los dos devuelve el dinero; cuentan salvo que estén
  // pendientes, rechazados o revertidos (la reversión llega como *_reverse aparte)
  if (DISPUTE.has(a.action) && !NOT_FINAL.has(a.status)) return revoke(env, txn, at, base, false);
  if (DISPUTE_REVERSE.has(a.action) && !NOT_FINAL.has(a.status)) return regrant(env, txn, at, base);
  return ignore('adjustment', base);   // pending_approval, rejected, credit, credit_reverse…
}

// La orden pasa a «refunded» y el permiso se borra solo si sigue siendo de esta compra. refund = reembolso aprobado:
// es definitivo y vale aunque llegue después de avisos de contracargo más nuevos (la hora solo ordena las disputas)
async function revoke(env, txn, at, base, refund) {
  for (let i = 0; i < TRIES; i++) {
    const order = await fsGet(env, 'orders/' + txn);
    const now = new Date();
    if (!order) {   // llegó antes que la compra: la orden queda «refunded» para que la compra tardía no dé permiso
      const early = Object.assign({ uid: '', status: 'refunded', priceId: '', occurredAt: at, moves: 0, updatedAt: now }, refund ? { refund: true } : {});
      if (await fsCommit(env, [writeCreate(env, 'orders/' + txn, early)])) {
        log('revoke_early', base);
        return text('ok');
      }
      continue;
    }
    const o = order.fields;
    if (o.refund === true) { log('revoke_duplicate', base); return text('ok'); }   // ya reembolsada: nada más que hacer
    if (!refund && older(at, o.occurredAt)) { log('revoke_stale', base); return text('ok'); }
    if (!refund && o.status === 'refunded' && at === o.occurredAt) { log('revoke_duplicate', base); return text('ok'); }
    // ya «refunded» por un aviso más viejo: solo se adelanta la hora (un chargeback_reverse anterior no debe ganar)
    const fields = { status: 'refunded', occurredAt: older(at, o.occurredAt) ? o.occurredAt : at, updatedAt: now };
    if (refund) fields.refund = true;
    const writes = [writePatch(env, 'orders/' + txn, fields, order.updateTime)];
    // si pagó dos veces y se reembolsa una, el permiso pasa a la otra compra pagada en vez de borrarse
    const rel = o.status !== 'refunded' && o.uid ? await releaseWrite(env, o.uid, txn, now) : null;
    if (rel) writes.push(rel.w);
    if (await fsCommit(env, writes)) {
      log('revoke', Object.assign({ uid: o.uid || null, removed: !!rel && !rel.moved, moved: rel ? rel.moved : null, refund }, base));
      return text('ok');
    }
  }
  throw new Upstream('contención en orders/' + txn);
}

// chargeback_reverse / chargeback_warning_reverse: Paddle ganó la disputa y la compra vuelve a valer (si no hubo
// además un reembolso: ese dinero ya volvió al comprador)
async function regrant(env, txn, at, base) {
  for (let i = 0; i < TRIES; i++) {
    const order = await fsGet(env, 'orders/' + txn);
    const o = order ? order.fields : null;
    if (o && o.refund === true) { log('regrant_refunded', base); return text('ok'); }
    if (o && older(at, o.occurredAt)) { log('regrant_stale', base); return text('ok'); }
    const now = new Date();
    if (o && o.status === 'paid') {
      // ya vale (o se movió con «Ya pagué»): el permiso no se toca, solo la hora, para que un contracargo viejo no gane
      if (at === o.occurredAt) { log('regrant_duplicate', base); return text('ok'); }
      if (await fsCommit(env, [writePatch(env, 'orders/' + txn, { occurredAt: at, updatedAt: now }, order.updateTime)])) {
        log('regrant_noop', base);
        return text('ok');
      }
      continue;
    }
    let uid = (o && o.uid) || '';
    if (!uid) {
      // la orden la creó el contracargo (sin uid) o no existe: el uid sale de la transacción en Paddle
      const r = await paddle(env, 'GET', '/transactions/' + txn);
      if (r.status === 404) return ignore('unknown_txn', base);
      if (!r.ok || !r.data) throw new Upstream('paddle ' + r.status);
      const t = r.data;
      if (t.status !== 'completed' || !hasPrice(t, env.PADDLE_PRICE_ID)) return ignore('not_ours', base);
      uid = ownerOf(env, t, base);   // puede quedar sin dueño: «Ya pagué» la reclama
    }
    const fields = { uid, status: 'paid', priceId: env.PADDLE_PRICE_ID, occurredAt: at, updatedAt: now };
    const writes = [
      order ? writePatch(env, 'orders/' + txn, fields, order.updateTime)
        : writeCreate(env, 'orders/' + txn, Object.assign({ moves: 0 }, fields)),
    ];
    if (uid && canGrant(env, uid)) {
      const ent = await fsGet(env, 'entitlements/' + uid);
      if (!keeps(ent)) writes.push(entWrite(env, uid, ent, grantDoc(txn, now)));
    }
    if (await fsCommit(env, writes)) {
      log('regrant', Object.assign({ uid: uid || null }, base));
      return text('ok');
    }
  }
  throw new Upstream('contención en orders/' + txn);
}

/* ---------- Google: token OAuth de la cuenta de servicio ---------- */

let saCache = null;      // { pem, key } clave RSA importada
let tokenCache = null;   // { email, token, exp } solo el token ya recibido (no promesas: no se comparten entre pedidos)

async function googleToken(env) {
  const email = String(env.GCP_SA_EMAIL || '');
  if (tokenCache && tokenCache.email === email && Date.now() < tokenCache.exp) return tokenCache.token;
  if (!email || !env.GCP_SA_KEY) throw new Upstream('config: faltan GCP_SA_EMAIL o GCP_SA_KEY');
  const iat = Math.floor(Date.now() / 1000);
  const input = bytesToB64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))) + '.'
    + bytesToB64url(enc.encode(JSON.stringify({ iss: email, scope: SCOPE, aud: OAUTH_URL, iat, exp: iat + 3600 })));
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await saKey(env.GCP_SA_KEY), enc.encode(input)));
  const r = await call(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')
      + '&assertion=' + input + '.' + bytesToB64url(sig),
  });
  const d = await readJson(r);
  if (!r.ok || !d || !d.access_token) throw new Upstream('oauth ' + r.status + ' ' + String((d && d.error) || ''));
  const ttl = Number(d.expires_in) || 3600;
  tokenCache = { email, token: d.access_token, exp: Date.now() + Math.max(0, ttl - 60) * 1000 };
  return d.access_token;
}

async function saKey(pem) {
  if (saCache && saCache.pem === pem) return saCache.key;
  // PEM PKCS8 («BEGIN PRIVATE KEY», el private_key del JSON de Google); acepta los \n escritos como texto
  const b64 = String(pem).replace(/\\n/g, '\n').replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  let der;
  try {
    const bin = atob(b64);
    der = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  } catch (_) { throw new Upstream('config: GCP_SA_KEY no es un PEM válido'); }
  let key;
  try {
    key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  } catch (_) { throw new Upstream('config: GCP_SA_KEY no es una clave PKCS8 RSA'); }
  saCache = { pem, key };
  return key;
}

/* ---------- Firestore REST ---------- */

function docName(env, path) { return 'projects/' + env.FIREBASE_PROJECT + '/databases/(default)/documents/' + path; }

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  return { stringValue: String(v) };
}
function encodeFields(data) {
  const out = {};
  for (const k of Object.keys(data)) out[k] = encodeValue(data[k]);
  return out;
}
function decodeValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;   // queda como texto ISO
  if ('mapValue' in v) return decodeFields((v.mapValue && v.mapValue.fields) || {});
  return null;
}
function decodeFields(fields) {
  const out = {};
  for (const k of Object.keys(fields)) out[k] = decodeValue(fields[k]);
  return out;
}

// Escrituras para commit (Write de la API REST); updateTime = precondición «nadie la cambió desde que la leí»
function writeCreate(env, path, data) {
  return { update: { name: docName(env, path), fields: encodeFields(data) }, currentDocument: { exists: false } };
}
function writeSet(env, path, data, updateTime) {   // documento completo (exista o no, salvo con updateTime)
  const w = { update: { name: docName(env, path), fields: encodeFields(data) } };
  if (updateTime) w.currentDocument = { updateTime };
  return w;
}
function writePatch(env, path, data, updateTime) {   // solo esos campos; el resto del documento queda igual
  return {
    update: { name: docName(env, path), fields: encodeFields(data) },
    updateMask: { fieldPaths: Object.keys(data) },
    currentDocument: { updateTime },
  };
}
function writeDelete(env, path, updateTime) {
  return { delete: docName(env, path), currentDocument: { updateTime } };
}

async function fsHeaders(env) { return { Authorization: 'Bearer ' + await googleToken(env) }; }

async function fsError(r) {
  const d = await readJson(r);
  return String((d && d.error && d.error.status) || r.status);
}

// → null si no existe, o { fields, updateTime }
async function fsGet(env, path) {
  const r = await call(FIRESTORE + '/' + docName(env, path), { headers: await fsHeaders(env) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Upstream('firestore get ' + r.status + ' ' + await fsError(r));
  const d = await readJson(r);
  if (!d) throw new Upstream('firestore get: respuesta vacía');
  return { fields: decodeFields(d.fields || {}), updateTime: d.updateTime };
}

// Otra compra pagada que hoy pertenece a uid (orders donde uid == uid), o null
async function otherPaidOrder(env, uid, exceptTxn) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, await fsHeaders(env));
  const r = await call(FIRESTORE + '/projects/' + env.FIREBASE_PROJECT + '/databases/(default)/documents:runQuery', {
    method: 'POST', headers, body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'orders' }],
      where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } } },
      limit: 20,
    } }),
  });
  if (!r.ok) throw new Upstream('firestore runQuery ' + r.status + ' ' + await fsError(r));
  const d = await readJson(r);
  for (const row of Array.isArray(d) ? d : [d]) {   // la respuesta JSON es una lista de resultados
    const doc = row && row.document;
    if (!doc) continue;
    const id = String(doc.name || '').split('/').pop();
    const f = decodeFields(doc.fields || {});
    if (id !== exceptTxn && TXN_RE.test(id) && f.status === 'paid' && f.uid === uid) return id;
  }
  return null;
}

// Todo o nada. → true si se aplicó, false si falló una precondición; otros errores → Upstream
async function fsCommit(env, writes) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, await fsHeaders(env));
  const r = await call(FIRESTORE + '/projects/' + env.FIREBASE_PROJECT + '/databases/(default)/documents:commit', {
    method: 'POST', headers, body: JSON.stringify({ writes }),
  });
  if (r.ok) return true;
  const status = await fsError(r);
  if (PRECONDITION.has(status)) return false;
  throw new Upstream('firestore commit ' + r.status + ' ' + status);   // ABORTED, UNAVAILABLE, PERMISSION_DENIED…
}
