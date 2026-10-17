/* Pruebas de lo que mira la revisión de dominio de Paddle (docs/PAGOS.md §6.2): páginas legales publicadas y enlazadas,
 * precio visible, texto de revendedor, sin «juego de fans» (tampoco en las imágenes que se generan), y
 * tools/legal-datos.cjs (marcadores del vendedor) junto con las comprobaciones de tools/cloudflare/build-site.cjs que no
 * publica mientras queden, ni con la venta en modo sandbox, ni con GA4 sin aviso de consentimiento. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const { PUBLIC } = require('../tools/cloudflare/build-site.cjs');
const Legal = require('../tools/legal-datos.cjs');
const PAGES = ['legal/terminos.html', 'legal/privacidad.html', 'legal/reembolsos.html'];
// Datos del vendedor ya rellenados con tools/legal-datos.cjs (antes eran marcadores {{…}})
const SELLER = { NOMBRE_LEGAL: 'Prince Ray Peratta Espinoza', EMAIL_SOPORTE: 'soporte@cocardo.app', DIRECCION_POSTAL: 'Rua Manuel Teixeira Gomes, 24, Portugal', NIF: '314490043' };
const MOR = 'Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.';

function ldJson(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  const j = JSON.parse(m[1]);
  return j['@graph'] ? j['@graph'][0] : j;
}

test('Legal: las tres páginas se publican (legal/ en PUBLIC), sin scripts, con nombre legal, contacto y enlaces entre sí', () => {
  assert.ok(PUBLIC.includes('legal'), 'legal/ en PUBLIC de build-site');
  for (const p of PAGES) {
    const h = read(p);
    assert.doesNotMatch(h, /<script/i, p + ' sin scripts');
    assert.ok(h.includes(SELLER.NOMBRE_LEGAL), p + ' nombra al vendedor');
    assert.ok(h.includes('mailto:' + SELLER.EMAIL_SOPORTE), p + ' tiene contacto');
    assert.match(h, /lang="en"/, p + ' trae la versión en inglés');
    for (const q of ['terminos', 'privacidad', 'reembolsos']) assert.match(h, new RegExp('href="' + q + '"'), p + ' enlaza ' + q);
    assert.match(h, /<link rel="canonical" href="https:\/\/cocardo\.app\/legal\/(terminos|privacidad|reembolsos)">/);
  }
});

test('Legal: Términos con el texto de revendedor literal y los términos de compra de Paddle; Reembolsos sin «no hay reembolsos»', () => {
  const t = read('legal/terminos.html');
  assert.ok(t.includes(MOR), 'texto de Merchant of Record del manual del vendedor');
  assert.match(t, /paddle\.com\/legal\/buyer-terms/);
  for (const p of PAGES) assert.doesNotMatch(read(p), /checkout-buyer-terms/, p + ': el enlace viejo de Paddle redirige');
  assert.match(t, /livroreclamacoes\.pt/);
  assert.match(t, /cniacc\.pt/);
  const r = read('legal/reembolsos.html');
  assert.match(r, /14 días/);
  assert.match(r, /paddle\.net/);
  assert.doesNotMatch(r, /no (hay|se hacen|ofrecemos) reembolsos|ventas? (son )?(finales|definitivas)/i);
  assert.match(r, /se aplica lo que sea más favorable para ti/, 'si esta política y la de Paddle difieren');
  assert.match(r, /salvo fraude o abuso evidente/, 'la misma excepción que Términos §7');
  assert.match(r, /Paddle te lo confirma por correo/, 'desistimiento: las tres condiciones');
  const pv = read('legal/privacidad.html');
  for (const s of ['entitlements/{uid}', 'orders/', 'cnpd.pt', 'cdn.paddle.com', 'Cloudflare', 'localStorage', 'no usamos analítica']) assert.ok(pv.includes(s), 'privacidad menciona ' + s);
});

test('Legal: datos del prestador (DL 7/2004, art. 10.º) en Términos y Privacidad; versiones en otros idiomas con la regla más favorable', () => {
  for (const p of ['legal/terminos.html', 'legal/privacidad.html']) {
    const h = read(p);
    const first = h.slice(h.indexOf('<section'), h.indexOf('</section>'));
    for (const k of [SELLER.NOMBRE_LEGAL, SELLER.DIRECCION_POSTAL, SELLER.NIF, 'mailto:' + SELLER.EMAIL_SOPORTE]) assert.ok(first.includes(k), p + ' §1 tiene ' + k);
    assert.doesNotMatch(h, /legal:direccion/, p + ': la dirección ya no es un bloque que se pueda quitar');
  }
  for (const p of PAGES) {
    const h = read(p);
    assert.doesNotMatch(h, /Spanish text applies/, p);
    assert.match(h, /the one more favourable to you applies|whichever is more favourable to you applies/, p + ' (inglés)');
    assert.match(h, /lang="pt-PT"[\s\S]*aplica-se a mais favorável para si/, p + ' (resumen en portugués)');
    assert.doesNotMatch(h, /sin coste/, p + ': «sin costo» (es_LA)');
  }
  const t = read('legal/terminos.html');
  assert.match(t, /que solo podemos retirar en los casos del <a href="#suspension">punto 9<\/a>/, 'licencia sin «revocable» a secas');
  assert.match(t, /lo avisaremos con al menos 30 días de antelación/, 'cierre del juego: aviso previo');
  assert.doesNotMatch(t, /te devolvemos el importe si nos lo pides|we will refund you on request/, 'sin reembolso por cierre (decisión del dueño)');
  assert.match(t, /te diremos el motivo/, 'DSA art. 17');
  assert.match(t, /Puedes avisarnos de un apodo ilegal u ofensivo/, 'DSA art. 16');
  assert.doesNotMatch(t, /lo vende <b>\{\{NOMBRE_LEGAL/, 'quien vende la compra es Paddle (revendedor)');
  assert.doesNotMatch(t, /Nosotros nunca vemos ni guardamos los datos de tu tarjeta/);
  const pv = read('legal/privacidad.html');
  assert.doesNotMatch(pv, /Google Fonts\)<\/b>, como encargado|Google Fonts\) and Cloudflare as processors/, 'Google Fonts no es encargado');
  assert.match(pv, /últimos 4 dígitos/, 'lo que Paddle manda del pago');
  assert.match(pv, /cualquier persona puede ver tu apodo/);
  assert.match(pv, /sin actividad durante 24 meses/, 'plazo de las cuentas con apodo');
  // menores: la misma regla en Términos y en Privacidad
  const minors = /<b>Compras:<\/b> si eres menor de edad, necesitas el permiso de tu madre, padre o tutor para comprar el juego completo\. <b>Cuentas:<\/b> si tienes menos de 13 años/;
  assert.match(t, minors);
  assert.match(pv, minors);
});

test('Legal: el Livro de Reclamações está enlazado en todos los pies (landing, páginas legales y juego)', () => {
  const foot = (h) => h.slice(h.indexOf('<footer>'));
  for (const p of ['landing.html', ...PAGES]) assert.match(foot(read(p)), /href="https:\/\/www\.livroreclamacoes\.pt\/"[^>]*>Livro de Reclamações</, p);
  assert.match(read('index.html'), /<noscript>[\s\S]*livroreclamacoes\.pt[\s\S]*<\/noscript>/);
  const ui = read('js/ui.js');
  const fn = ui.slice(ui.indexOf('function legalLinksHtml'), ui.indexOf('function legalName'));
  assert.match(fn, /out\.push\(a\(LIVRO_URL, 'Livro de Reclamações'\)\)/, 'legalLinksHtml (Portada y Ajustes)');
});

test('Legal: la landing muestra el precio y enlaza las páginas legales y el contacto en el pie', () => {
  const h = read('landing.html');
  assert.match(h, /id="precio"/);
  assert.match(h, /US\$1,99/);
  assert.match(h, /1,99 €/);
  const foot = h.slice(h.indexOf('<footer>'));
  for (const q of ['legal/terminos', 'legal/privacidad', 'legal/reembolsos', 'mailto:' + SELLER.EMAIL_SOPORTE, '#precio']) assert.ok(foot.includes('href="' + q + '"'), 'pie enlaza ' + q);
  assert.match(foot, /Paddle\.com/);
});

test('Legal: JSON-LD de la landing y del juego con la oferta gratis y la de 1.99 USD, y el vendedor', () => {
  for (const f of ['landing.html', 'index.html']) {
    const g = ldJson(read(f));
    assert.deepEqual(g.offers.map((o) => o.price + ' ' + o.priceCurrency), ['0 USD', '1.99 USD'], f);
    assert.equal(g.publisher.name, SELLER.NOMBRE_LEGAL, f);
  }
});

test('Legal: ningún archivo publicado dice «juego de fans» / «no oficial» ni promete «gratis» a secas en meta y manifest', () => {
  for (const f of Legal.listFiles(ROOT, PUBLIC)) {
    const s = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /juego de fans|proyecto de fans|no oficial|@frutitaenlatada/i, path.relative(ROOT, f));
    // ni lo presenta como el juego de otra obra: La Nieve de Lima es la historia que cuenta el juego
    assert.doesNotMatch(s, /frutinovela viral|inspirad[oa] en la frutinovela|de la serie|fiel a la serie|frases reales/i, path.relative(ROOT, f));
  }
  const meta = (h) => (h.match(/<meta (name|property)="(description|og:description|twitter:description)" content="[^"]*"/g) || []).join('\n');
  for (const f of ['landing.html', 'index.html']) {
    for (const m of meta(read(f)).split('\n')) if (/gratis/i.test(m)) assert.match(m, /gratis para empezar|niveles 1 al 10/i, f + ': ' + m);
  }
  assert.match(JSON.parse(read('manifest.webmanifest')).description, /gratis para empezar/);
});

test('Legal: las imágenes publicadas no llevan textos viejos: og-2.png desde build-icons.cjs, og.png fuera, capturas del manifest existentes', () => {
  // los PNG no se pueden leer como texto: se prueba su generador y que nadie apunte a la imagen vieja
  const gen = read('tools/build-icons.cjs');
  assert.doesNotMatch(gen, /fans|no oficial|Juega gratis/i);
  assert.match(gen, /Gratis para empezar en tu celular/);
  assert.match(gen, /'og-2\.png'/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'icons', 'og.png')), 'icons/og.png (con «Juego de fans, no oficial») ya no se publica');
  assert.ok(fs.existsSync(path.join(ROOT, 'icons', 'og-2.png')));
  for (const f of ['index.html', 'landing.html']) {
    const h = read(f);
    assert.doesNotMatch(h, /icons\/og\.png/, f);
    const refs = h.match(/https:\/\/cocardo\.app\/icons\/og-2\.png/g) || [];
    assert.equal(refs.length, 3, f + ': og:image, twitter:image y JSON-LD');
  }
  const man = JSON.parse(read('manifest.webmanifest'));
  for (const sh of man.screenshots) assert.ok(fs.existsSync(path.join(ROOT, sh.src)), sh.src);
});

test('Legal: el juego enlaza las páginas legales (Portada y Ajustes) y la ficha de pago pide aceptar Términos y Reembolsos', () => {
  const ui = read('js/ui.js');
  assert.match(ui, /legalLinksHtml\(\{ price: true \}\)/, 'pie de la Portada');
  assert.match(ui, /legalLinksHtml\(\{ contact: true \}\)/, 'Ajustes');
  assert.match(ui, /Al comprar aceptas los <a href="' \+ esc\(siteHref\('legal\/terminos'\)\)/);
  assert.match(ui, /siteHref\('legal\/reembolsos'\)/);
  assert.match(ui, /revendedor y Merchant of Record/);
});

test('Legal: la ficha de pago no exhorta a comprar (público infantil) y siempre muestra un precio', () => {
  const ui = read('js/ui.js');
  assert.doesNotMatch(ui, /'Desbloquea el juego completo'|>Desbloquear<\/button>|' Desbloquear<\/button>/);
  assert.match(ui, /pwTitle\('Del nivel ' \+ \(F \+ 1\) \+ ' en adelante', true\)/, 'título descriptivo (la cinta ya dice «Juego completo»)');
  assert.match(ui, /data-act="buy">Comprar el juego completo<\/button>/);
  assert.match(ui, /Las compras de menores necesitan permiso de su madre, padre o tutor/);
  assert.doesNotMatch(ui, /pide permiso a un adulto/);
});

test('Legal: el apodo sugerido nunca sale del nombre de Google (el ranking es público)', () => {
  const cloud = read('js/cloud.js');
  const fn = cloud.slice(cloud.indexOf('function suggestNick'), cloud.indexOf('function saveProfile'));
  assert.ok(fn.length > 0);
  assert.doesNotMatch(fn, /\.name|user/, 'suggestNick no mira al usuario');
  const ctx = { Math };
  new Function('ctx', fn + '; ctx.f = suggestNick;')(ctx);
  for (let i = 0; i < 20; i++) assert.match(ctx.f(), /^Heladero\d{3}$/);
  assert.match(read('js/ui.js'), /no uses tu nombre real/);
});

const OK_ENV = { NOMBRE_LEGAL: "João D'Ávila", EMAIL_SOPORTE: 'soporte@cocardo.app', DIRECCION_POSTAL: 'Rua das Flores 12, 1200-195 Lisboa', NIF: '123456789' };

test('legal-datos: los cuatro datos son obligatorios (nombre sin < > & " \\ { } `, correo real, dirección y NIF válido)', () => {
  const e = Legal.check({}).errors;
  assert.equal(e.length, 4);
  for (const k of ['NOMBRE_LEGAL', 'EMAIL_SOPORTE', 'DIRECCION_POSTAL', 'NIF']) assert.ok(e.some((x) => x.startsWith('falta ' + k)), k);
  assert.deepEqual(Legal.check(OK_ENV).errors, []);
  assert.equal(Legal.check({ ...OK_ENV, NOMBRE_LEGAL: 'Ana <b>' }).errors.length, 1);
  assert.equal(Legal.check({ ...OK_ENV, EMAIL_SOPORTE: 'no-es-correo' }).errors.length, 1);
  assert.equal(Legal.check({ ...OK_ENV, DIRECCION_POSTAL: '' }).errors.length, 1, 'sin dirección no se escribe nada');
  assert.equal(Legal.check({ ...OK_ENV, DIRECCION_POSTAL: 'Rua <x>' }).errors.length, 1);
  assert.equal(Legal.check({ ...OK_ENV, NIF: '123456780' }).errors.length, 1, 'dígito de control');
  const ok = Legal.check({ ...OK_ENV, NOMBRE_LEGAL: "  João  D'Ávila ", NIF: 'PT 123 456 789' });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.values.NOMBRE_LEGAL, "João D'Ávila");
  assert.equal(ok.values.NIF, '123456789');
  assert.equal(Legal.validNif('123456789'), true);
  assert.equal(Legal.validNif('12345678'), false);
});

test('legal-datos: rellena los marcadores (en .js escapa la comilla) y build-site deja de quejarse; sin todos, nada se quita', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cocardo-legal-'));
  try {
    fs.mkdirSync(path.join(dir, 'legal'));
    fs.mkdirSync(path.join(dir, 'js'));
    const page = '<p>{{NOMBRE_LEGAL}} · {{EMAIL_SOPORTE}}</p>\n<p>Dirección: {{DIRECCION_POSTAL}} · NIF: {{NIF}}</p>\n<p>fin</p>\n';
    fs.writeFileSync(path.join(dir, 'legal', 'a.html'), page);
    fs.writeFileSync(path.join(dir, 'js', 'c.js'), "var c = { name: '{{NOMBRE_LEGAL}}', email: '{{EMAIL_SOPORTE}}' };\n");
    const rels = ['legal', 'js'];
    assert.equal(Legal.scan(dir, rels).length, 6);
    // sin dirección: check() da error (main no escribe) y, aunque se aplicara, el marcador queda y build-site no publica
    const partial = Legal.check({ ...OK_ENV, DIRECCION_POSTAL: '' });
    assert.equal(partial.errors.length, 1);
    Legal.apply(dir, rels, partial.values, false);
    assert.equal(Legal.scan(dir, rels).length, 6, 'sin --write no toca nada');
    const { values } = Legal.check(OK_ENV);
    assert.deepEqual(Legal.apply(dir, rels, values, false), ['legal/a.html', 'js/c.js'], 'sin --write solo dice qué cambiaría');
    Legal.apply(dir, rels, values, true);
    assert.deepEqual(Legal.scan(dir, rels), []);
    assert.equal(fs.readFileSync(path.join(dir, 'legal', 'a.html'), 'utf8'), "<p>João D'Ávila · soporte@cocardo.app</p>\n<p>Dirección: Rua das Flores 12, 1200-195 Lisboa · NIF: 123456789</p>\n<p>fin</p>\n");
    const js = fs.readFileSync(path.join(dir, 'js', 'c.js'), 'utf8');
    const ctx = {};
    new Function('ctx', js + '; ctx.c = c;')(ctx);
    assert.deepEqual(ctx.c, { name: "João D'Ávila", email: 'soporte@cocardo.app' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('build-site: no publica con la venta en modo sandbox ni con un id de GA4 (sin aviso de consentimiento)', () => {
  const { configProblems } = require('../tools/cloudflare/build-site.cjs');
  assert.deepEqual(configProblems(read('js/cloud-config.js')), [], 'la configuración de hoy se puede publicar');
  const cfg = (o) => 'window.Cocardo = { CloudConfig: ' + JSON.stringify(o) + ' };';
  assert.equal(configProblems(cfg({ ga4: 'G-ABC123', pay: { on: false } })).length, 1);
  assert.match(configProblems(cfg({ ga4: 'G-ABC123' }))[0], /consentimiento/);
  assert.equal(configProblems(cfg({ ga4: '', pay: { on: true, env: 'sandbox', token: 'test_x' } })).length, 1);
  assert.deepEqual(configProblems(cfg({ ga4: '', pay: { on: true, env: 'live', token: 'live_x', apiBase: '' } })), []);
});

test('build-site: los datos del vendedor ya están rellenados en lo publicado (sin marcadores {{…}})', () => {
  assert.deepEqual(Legal.scan(ROOT, PUBLIC), []);
  assert.match(read('tools/cloudflare/build-site.cjs'), /require\('\.\.\/legal-datos\.cjs'\)\.scan\(OUT/);
});
