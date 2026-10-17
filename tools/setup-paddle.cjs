#!/usr/bin/env node
// Prepara Paddle Billing para vender el «juego completo» (pasos y contexto en docs/PAGOS.md §1).
// Crea solo lo que falta, así que se puede correr las veces que haga falta:
//   1. el producto «Cocardo: juego completo» (tax_category «standard», ver PRODUCT más abajo)
//   2. su precio de pago único: US$1,99 con impuestos incluidos, 1,99 € en la eurozona y cantidad fija 1
//   3. el destino de notificaciones (webhook) <sitio>/api/webhook con los eventos que atiende el Worker cocardo-pagos
// Si ya existen (los reconoce por custom_data { cocardo: 'juego-completo' }, o por el nombre/destino), los reutiliza
// y corrige con PATCH lo que no coincida. Al final imprime PADDLE_PRICE_ID y lo que falta hacer a mano en el panel.
//
// El secreto del webhook (PADDLE_WEBHOOK_SECRET) se imprime UNA vez, al crear el destino; nunca se escribe en disco.
// Si se pierde: --show-secret lo vuelve a mostrar (Paddle lo devuelve al listar los destinos).
//
// Uso (Node 18+, sin dependencias):
//   PADDLE_API_KEY=pdl_sdbx_apikey_… PADDLE_ENV=sandbox node tools/setup-paddle.cjs [--site https://cocardo.app]
//   node tools/setup-paddle.cjs --dry-run      imprime las peticiones sin enviarlas (no necesita clave)
//   … --show-secret                            vuelve a mostrar el secreto de un destino que ya existía
// Clave de API: Paddle → My account → Settings → Authentication → API keys → New API key, con los permisos
//   product.write, price.write y notification_setting.write (write incluye read). Sandbox: pdl_sdbx_…; live: pdl_live_…
// Referencia: https://developer.paddle.com/api-reference/overview (API versión 1, cabecera Paddle-Version: 1).
'use strict';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
function option(name) {
  const i = args.findIndex(a => a === name || a.startsWith(name + '='));
  if (i < 0) return '';
  return args[i].includes('=') ? args[i].slice(args[i].indexOf('=') + 1) : (args[i + 1] || '');
}

if (flag('--help') || flag('-h')) {
  // la ayuda es el comentario de arriba
  const lines = require('fs').readFileSync(__filename, 'utf8').split('\n').slice(1);
  console.log(lines.slice(0, lines.findIndex(l => !l.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}

const DRY = flag('--dry-run');
const SHOW_SECRET = flag('--show-secret');
const ENV = String(process.env.PADDLE_ENV || (DRY ? 'sandbox' : '')).trim();
const KEY = String(process.env.PADDLE_API_KEY || '').trim();
const BASES = { sandbox: 'https://sandbox-api.paddle.com', live: 'https://api.paddle.com' };
const BASE = BASES[ENV];

// Lo que el script reconoce como suyo (custom_data del producto y del precio)
const MARK = { cocardo: 'juego-completo' };
const PRODUCT_NAME = 'Cocardo: juego completo';
const PRICE_NAME = 'Juego completo';
// Eurozona (21 países, con Bulgaria desde el 1-ene-2026): 1,99 € fijo. El resto del mundo paga el precio base en
// US$ o, con la conversión automática encendida en el panel (Settings → Currencies), su moneda local.
const EUROZONE = ['AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES'];
// Eventos que atiende el Worker: la compra pagada, y los reembolsos/contracargos (se crean y luego se aprueban)
const EVENTS = ['transaction.completed', 'adjustment.created', 'adjustment.updated'];

function fail(msg) { console.error('\n' + msg); process.exit(1); }

if (!BASE) fail('PADDLE_ENV debe ser «sandbox» o «live» (p. ej. PADDLE_ENV=sandbox).');
if (!DRY) {
  if (!KEY) fail('Falta PADDLE_API_KEY (Paddle → My account → Settings → Authentication → API keys).');
  // Formato documentado: pdl_(live|sdbx)_apikey_…; una clave de sandbox no sirve en live ni al revés (403)
  const m = /^pdl_(live|sdbx)_apikey_/.exec(KEY);
  if (m && (m[1] === 'sdbx') !== (ENV === 'sandbox')) {
    fail(`La clave es de ${m[1] === 'sdbx' ? 'sandbox' : 'live'} pero PADDLE_ENV=${ENV}. Usa la clave de la cuenta correcta.`);
  }
  if (!m) console.warn('Aviso: la clave no tiene el formato pdl_…_apikey_…; si Paddle la rechaza, crea una nueva.');
  if (typeof fetch !== 'function') fail('Hace falta Node 18 o superior (fetch).');
}

// Sitio público: el webhook va a <sitio>/api/webhook (ruta del Worker cocardo-pagos) y la imagen sale de <sitio>/icons
let SITE;
try {
  const u = new URL(option('--site') || 'https://cocardo.app');
  if (u.protocol !== 'https:') throw new Error('https');
  SITE = u.origin;
} catch (e) {
  fail('--site debe ser una dirección https, p. ej. --site https://cocardo.app');
}
const WEBHOOK_URL = SITE + '/api/webhook';

// Producto. tax_category «standard» = «Standard Digital Goods»: Paddle la describe como software escrito de antemano
// («pre-written») que se descarga e instala en el aparato. Es lo que se vende: el programa completo de un juego (PWA
// instalable que funciona sin conexión), con un solo pago y sin servicio continuo. No es «digital-goods» (archivos o
// medios que no son software, como música o plantillas) ni «saas» (acceso a una aplicación en la nube). Además es la
// categoría por defecto y viene aprobada; cualquier otra hay que pedirla en Settings → Taxable categories y esperar.
// https://developer.paddle.com/api-reference/products/create-product
const PRODUCT = {
  name: PRODUCT_NAME,
  tax_category: 'standard',
  type: 'standard',
  description: 'Todos los niveles de Cocardo: ¡Rescate Helado! desde el 11, también los capítulos nuevos que vayan ' +
    'saliendo. Pago único, sin suscripción.',
  image_url: SITE + '/icons/icon-512.png',
  custom_data: MARK,
};

// Precio único (billing_cycle null). amount va en la unidad mínima como texto: "199" = 1,99.
// tax_mode «internal»: el precio ya incluye el impuesto (IVA/sales tax), el comprador paga 1,99 justos.
// quantity 1..1: no se puede comprar dos veces en el mismo pago.
// https://developer.paddle.com/api-reference/prices/create-price
function priceBody(productId) {
  return {
    product_id: productId,
    description: 'Juego completo, pago único. Base US$1,99; 1,99 € fijo en la eurozona; conversión automática en el resto.',
    name: PRICE_NAME,
    type: 'standard',
    billing_cycle: null,
    tax_mode: 'internal',
    unit_price: { amount: '199', currency_code: 'USD' },
    unit_price_overrides: [{ country_codes: EUROZONE.slice(), unit_price: { amount: '199', currency_code: 'EUR' } }],
    quantity: { minimum: 1, maximum: 1 },
    custom_data: MARK,
  };
}

// Destino de notificaciones. api_version fija la forma de los eventos que recibe el Worker. En sandbox también recibe
// las simulaciones (Events → Simulations) para probar la firma sin pagar; en live solo eventos reales.
// https://developer.paddle.com/api-reference/notification-settings/create-notification-setting
const NOTIFICATION = {
  description: 'Cocardo: Worker cocardo-pagos (' + WEBHOOK_URL + ')',
  type: 'url',
  destination: WEBHOOK_URL,
  subscribed_events: EVENTS,
  api_version: 1,
  include_sensitive_fields: false,
  traffic_source: ENV === 'sandbox' ? 'all' : 'platform',
};

/* ---------- API ---------- */

class PaddleError extends Error {
  constructor(method, url, status, json, text) {
    const e = (json && json.error) || {};
    const fields = (e.errors || []).map(x => `\n    · ${x.field}: ${x.message}`).join('');
    super(`${method} ${url} → ${status} ${e.code || ''} ${e.detail || text.slice(0, 300)}${fields}` +
      (json && json.meta && json.meta.request_id ? `\n    request_id ${json.meta.request_id} (dáselo a soporte de Paddle)` : ''));
    this.status = status;
    this.code = e.code || '';
  }
}

let dryCount = 0;
function printRequest(method, url, body) {
  console.log(`\n  ${method} ${url}`);
  console.log('  Authorization: Bearer <PADDLE_API_KEY>   Paddle-Version: 1' + (body ? '   Content-Type: application/json' : ''));
  // listas de textos en una sola línea (los 21 países) para que se lea
  if (body) console.log(JSON.stringify(body, null, 2).replace(/\[\s+("[^"\n]*"(?:,\s+"[^"\n]*")*)\s+\]/g,
    (m, list) => '[' + list.split(/,\s+/).join(', ') + ']').replace(/^/gm, '  '));
}

async function api(method, path, body) {
  const url = /^https:\/\//.test(path) ? path : BASE + path;
  // La clave solo viaja a la API de Paddle del entorno elegido (los enlaces «next» de la paginación vienen de Paddle)
  if (!url.startsWith(BASE + '/')) throw new Error('Dirección inesperada: ' + url);
  if (DRY) {
    printRequest(method, url, body);
    if (method === 'GET') return { data: [], meta: { pagination: { has_more: false } } };
    const id = { '/products': 'pro_NUEVO', '/prices': 'pri_NUEVO', '/notification-settings': 'ntfset_NUEVO' }[path] || 'x_' + (++dryCount);
    return { data: Object.assign({ id, endpoint_secret_key: 'pdl_ntfset_(se mostraría aquí una sola vez)' }, body) };
  }
  const res = await fetch(url, {
    method,
    headers: Object.assign(
      { Authorization: 'Bearer ' + KEY, 'Paddle-Version': '1', Accept: 'application/json' },
      body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { /* respuesta que no es JSON */ }
  if (!res.ok) throw new PaddleError(method, url, res.status, json, text);
  return json;
}

// Lista completa siguiendo meta.pagination.next mientras has_more (máx. 200 por página)
async function listAll(path) {
  const out = [];
  let next = path;
  for (let page = 0; next && page < 50; page++) {
    const r = await api('GET', next);
    out.push(...((r && r.data) || []));
    const p = r && r.meta && r.meta.pagination;
    next = p && p.has_more && p.next ? p.next : null;
  }
  return out;
}

/* ---------- comparación ---------- */

const isMine = x => !!(x && x.custom_data && x.custom_data.cocardo === MARK.cocardo);
const money = m => (m ? `${m.amount} ${m.currency_code}` : '-');
function overridesKey(list) {
  return (list || []).map(o => money(o.unit_price) + ':' + (o.country_codes || []).slice().sort().join(',')).sort().join(' | ');
}
// Diferencias entre lo que hay en Paddle y lo que queremos; devuelve { campo: valor deseado }
function diffProduct(p) {
  const d = {};
  if (p.name !== PRODUCT.name) d.name = PRODUCT.name;
  if (p.tax_category !== PRODUCT.tax_category) d.tax_category = PRODUCT.tax_category;
  if (!isMine(p)) d.custom_data = Object.assign({}, p.custom_data || {}, MARK);
  if (!p.image_url) d.image_url = PRODUCT.image_url;
  return d;
}
function diffPrice(p, want) {
  const d = {};
  if (p.tax_mode !== want.tax_mode) d.tax_mode = want.tax_mode;
  if (money(p.unit_price) !== money(want.unit_price)) d.unit_price = want.unit_price;
  if (overridesKey(p.unit_price_overrides) !== overridesKey(want.unit_price_overrides)) d.unit_price_overrides = want.unit_price_overrides;
  const q = p.quantity || {};
  if (q.minimum !== want.quantity.minimum || q.maximum !== want.quantity.maximum) d.quantity = want.quantity;
  if (p.name !== want.name) d.name = want.name;
  if (!isMine(p)) d.custom_data = Object.assign({}, p.custom_data || {}, MARK);
  return d;
}
function diffNotification(n) {
  const d = {};
  const have = (n.subscribed_events || []).map(e => (typeof e === 'string' ? e : e.name)).sort().join(',');
  if (have !== EVENTS.slice().sort().join(',')) d.subscribed_events = EVENTS;   // PATCH reemplaza la lista entera
  if (n.active !== true) d.active = true;
  if (n.traffic_source !== NOTIFICATION.traffic_source) d.traffic_source = NOTIFICATION.traffic_source;
  if (n.include_sensitive_fields) d.include_sensitive_fields = false;
  if (n.api_version !== NOTIFICATION.api_version) d.api_version = NOTIFICATION.api_version;
  return d;
}
const describe = d => Object.keys(d).join(', ');

/* ---------- pasos ---------- */

async function ensureProduct() {
  console.log('\n→ Producto «' + PRODUCT_NAME + '»');
  const all = await listAll('/products?per_page=200&status=active');
  const found = all.find(isMine) || all.find(p => p.name === PRODUCT_NAME);
  if (!found) {
    const r = await api('POST', '/products', PRODUCT);
    console.log(`  + creado ${r.data.id} (tax_category ${PRODUCT.tax_category})`);
    return r.data;
  }
  const d = diffProduct(found);
  if (!Object.keys(d).length) { console.log(`  = ya existía ${found.id}`); return found; }
  const r = await api('PATCH', '/products/' + found.id, d);
  console.log(`  ~ ${found.id} corregido: ${describe(d)}`);
  return r.data;
}

async function ensurePrice(product) {
  console.log('\n→ Precio único US$1,99 / 1,99 € (impuestos incluidos)');
  const want = priceBody(product.id);
  const all = await listAll('/prices?per_page=200&status=active&recurring=false&product_id=' + encodeURIComponent(product.id));
  const mine = all.filter(isMine);
  const found = mine[0] || all.find(p => p.name === PRICE_NAME);
  if (mine.length > 1) console.warn(`  Aviso: hay ${mine.length} precios marcados; se usa ${found.id}. Archiva los demás en Catalog → Products.`);
  if (!found) {
    const r = await api('POST', '/prices', want);
    console.log(`  + creado ${r.data.id}`);
    return r.data;
  }
  const d = diffPrice(found, want);
  if (!Object.keys(d).length) { console.log(`  = ya existía ${found.id}`); return found; }
  const r = await api('PATCH', '/prices/' + found.id, d);
  console.log(`  ~ ${found.id} corregido: ${describe(d)} (vale para los pagos nuevos)`);
  return r.data;
}

async function ensureNotification() {
  console.log('\n→ Webhook ' + WEBHOOK_URL);
  const all = await listAll('/notification-settings?per_page=200');
  const same = all.filter(n => n.type === 'url' && n.destination === WEBHOOK_URL);
  const found = same.find(n => n.active) || same[0];
  if (same.length > 1) console.warn(`  Aviso: hay ${same.length} destinos con esa dirección; se usa ${found.id}. Borra los demás en Events → Notifications.`);
  if (!found) {
    const r = await api('POST', '/notification-settings', NOTIFICATION);
    console.log(`  + creado ${r.data.id} (${EVENTS.join(', ')})`);
    return { setting: r.data, created: true };
  }
  const d = diffNotification(found);
  if (!Object.keys(d).length) { console.log(`  = ya existía ${found.id}`); return { setting: found, created: false }; }
  const r = await api('PATCH', '/notification-settings/' + found.id, d);
  console.log(`  ~ ${found.id} corregido: ${describe(d)}`);
  return { setting: Object.assign({}, found, r.data), created: false };
}

// IPs desde las que Paddle manda los webhooks de este entorno (para la regla de Cloudflare, docs/PAGOS.md §6.5)
async function paddleIps() {
  try {
    const r = await api('GET', '/ips');
    return (r && r.data && r.data.ipv4_cidrs) || [];
  } catch (e) { return []; }
}

// ¿El Worker ya responde? Solo informa: lo normal la primera vez es que todavía no esté subido
async function workerHealth() {
  if (DRY) { console.log(`\n  GET ${SITE}/api/health   (comprobación del Worker, sin clave)`); return; }
  try {
    const res = await fetch(SITE + '/api/health', { headers: { Accept: 'application/json' } });
    const j = await res.json().catch(() => null);
    if (res.ok && j && j.ok) {
      console.log(`\n→ Worker: ${SITE}/api/health responde (env ${j.env || '?'})` +
        (j.env && j.env !== ENV ? `  AVISO: el Worker está en «${j.env}» y este script en «${ENV}»` : ''));
    } else {
      console.log(`\n→ Worker: ${SITE}/api/health todavía no responde (HTTP ${res.status}). Súbelo con tools/setup-cloudflare-pay.sh;` +
        ` mientras tanto Paddle reintenta los avisos (sandbox: 3 veces en 15 min; live: durante 3 días).`);
    }
  } catch (e) {
    console.log(`\n→ Worker: no se pudo consultar ${SITE}/api/health (${e.message}).`);
  }
}

/* ---------- principal ---------- */

(async () => {
  console.log(`Paddle ${ENV}${DRY ? ' · SIMULACIÓN (--dry-run): no se envía nada' : ''} · ${BASE} · sitio ${SITE}`);
  const product = await ensureProduct();
  const price = await ensurePrice(product);
  const { setting, created } = await ensureNotification();
  const ips = await paddleIps();
  await workerHealth();

  const tok = ENV === 'sandbox' ? 'test_' : 'live_';   // prefijo del token del cliente de cada entorno
  const out = [];
  out.push('', '================================================================', `Listo · Paddle ${ENV}`);
  out.push(`  Producto  ${product.id}  «${PRODUCT_NAME}» (tax_category ${PRODUCT.tax_category})`);
  out.push(`  Precio    ${price.id}  US$1,99 base · 1,99 € en ${EUROZONE.length} países de la eurozona · impuestos incluidos · cantidad 1`);
  out.push(`  Webhook   ${setting.id}  ${WEBHOOK_URL}`);
  out.push(`            ${EVENTS.join(', ')} · tráfico: ${NOTIFICATION.traffic_source}`);

  if (created || SHOW_SECRET) {
    out.push('', '---------------- SECRETO DEL WEBHOOK (cópialo ahora) ----------------');
    out.push(`  PADDLE_WEBHOOK_SECRET=${setting.endpoint_secret_key || '(Paddle no lo devolvió: míralo en Events → Notifications → editar destino)'}`);
    out.push('  No se guarda en ningún archivo. Cárgalo como secreto del Worker con tools/setup-cloudflare-pay.sh');
    out.push('  (variable PADDLE_WEBHOOK_SECRET, docs/PAGOS.md §3). Si lo pierdes: este script con --show-secret.');
    out.push('---------------------------------------------------------------------');
  } else {
    out.push('', '  El destino ya existía: su secreto no cambió (si lo necesitas otra vez, añade --show-secret).');
  }

  out.push('', 'Para el Worker (tools/setup-cloudflare-pay.sh, docs/PAGOS.md §3):');
  out.push(`  PADDLE_ENV=${ENV}`);
  out.push(`  PADDLE_PRICE_ID=${price.id}`);
  out.push('  PADDLE_API_KEY=… (otra clave, solo para el Worker; permisos en docs/PAGOS.md §1.2)');
  if (ENV === 'sandbox') out.push('  TEST_UIDS=<tu uid de Firebase> (solo esas cuentas compran y reciben el permiso en sandbox)');
  if (ENV === 'sandbox') {
    // el sandbox corre sobre el Firestore de producción: con el token de prueba publicado cualquiera podría pagar con
    // la tarjeta de prueba, así que esta configuración no se sube
    out.push('', 'Para probar el juego (SOLO en tu copia local de js/cloud-config.js; no lo subas, docs/PAGOS.md §5.1):');
    out.push(`  pay: { on: true, freeLevels: 10, env: 'sandbox', priceId: '${price.id}', token: '${tok}…', apiBase: '${SITE}' }`);
  } else {
    out.push('', 'Para el juego (js/cloud-config.js → pay, docs/PAGOS.md §6.3):');
    out.push(`  env: 'live', priceId: '${price.id}', token: '${tok}…'   (on: true cuando todo esté probado)`);
  }
  out.push('', 'Falta en el panel de Paddle (no hay API para esto):');
  out.push(`  1. Token del cliente (empieza con ${tok}): My account → Settings → Authentication → Client-side tokens → New client-side token.`);
  out.push(`  2. Enlace de pago por defecto: Checkout → Checkout configuration → Default payment link = ${SITE}/ → Save.`);
  out.push('  3. Conversión automática de moneda: My account → Settings → Currencies → Select all → Save.');
  out.push('  4. Métodos de pago: Checkout → Checkout configuration → Payment methods (PayPal, Apple Pay, Google Pay, MB WAY…).');
  if (ips.length) out.push('', `IPs de los webhooks de Paddle (${ENV}), para la regla de Cloudflare (docs/PAGOS.md §6.5):`, '  ' + ips.join(' '));
  console.log(out.join('\n'));
})().catch(e => {
  console.error('\nError: ' + (e && e.message ? e.message : e));
  if (e && e.status === 403) console.error('La clave no tiene permiso (product.write, price.write, notification_setting.write) o es de otro entorno.');
  if (e && e.status === 401) console.error('Clave inválida, vencida o revocada: crea una nueva en My account → Settings → Authentication.');
  process.exit(1);
});
