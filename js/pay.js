/* Cocardo: ¡Rescate Helado! — Compra única del «juego completo» con Paddle (Cocardo.Pay).
 * Reglas y puesta en marcha: docs/PAGOS.md. Configuración: CloudConfig.pay en js/cloud-config.js.
 *
 * Los niveles 1–10 son gratis. La progresión no cambia (ganar un nivel abre el siguiente, save.unlocked), pero sin
 * comprar no se puede EMPEZAR un nivel con id mayor que FREE, también los capítulos que vayan saliendo. Comprar quita
 * ese tope y nada más: no salta niveles. El Reto Diario es siempre gratis aunque reuse tableros (la UI no le pregunta).
 *
 * Con pay.on = false, sin token o sin priceId, desde file:// o dentro de un iframe, on() es false: no hay candado
 * (allowed() siempre es true), no se descarga Paddle.js y no se llama a ningún servidor.
 *
 * Dónde vive la compra (nunca dentro del guardado «cocardo.v1», ni en users/{uid} ni en users/{uid}/private/save:
 * Progress.merge se queda con el máximo de cada campo y el navegador puede escribir esos documentos):
 *   - entitlements/{uid} en Firestore { premium, order, source, at }: lo escribe solo el Worker cocardo-pagos (webhook
 *     de Paddle o «Ya pagué»); el dueño lo lee y aquí se escucha en vivo con Cocardo.Cloud.watchDoc.
 *   - copia local en localStorage «cocardo.v1.premium» = { device: { legacy:true, at } | null, accounts: { uid: { order, at } } }
 *     y «cocardo.v1.premium.checked» = '1' cuando ya se revisó si el aparato venía de antes de la venta.
 *   Una compra de la cuenta A no vale para la cuenta B; el permiso del aparato (jugador antiguo) vale para todas.
 *   El permiso del aparato se decide UNA vez, al primer arranque con la venta encendida y con el guardado de este
 *   aparato tal como está antes de juntarlo con la nube; nunca a partir de progreso que llega después (ese lo puede
 *   escribir cualquier cuenta y no se podría quitar con un reembolso).
 *   Si se compró con apodo (sesión anónima) y luego se entra con una cuenta de Google que ya existía, Firebase cambia
 *   de uid: Cocardo.Cloud guarda el token de la sesión que se deja y aquí se le pide al Worker que traiga la compra
 *   (/api/restore { from }). Si no se puede, avisa 'left-behind' para que la UI ofrezca «Ya pagué».
 *
 * API:
 *   init()                      main.js al arrancar: revisa si el aparato es antiguo, escucha la cuenta y, si la página
 *                               abrió con ?_ptxn=txn_… (enlace «Pagar en Safari/Chrome»), carga Paddle.js, que abre ese pago solo
 *   on() -> bool                venta activa
 *   FREE                        niveles gratis (pay.freeLevels)
 *   allowed(levelId) -> bool    ¿puede empezar ese nivel?  !on() || levelId <= FREE || premium()
 *   premium() -> bool           la cuenta actual tiene su compra en la copia local, o el aparato es antiguo
 *   state() -> { on, premium, legacy, account, pending, slow, external, busy, leftBehind, error, price, event }
 *                               pending: pagó y se espera el aviso del servidor; slow: ya pasó ~1 min («Procesando tu
 *                               pago…»); external: el pago se abrió desde el enlace ?_ptxn (la compra va a la cuenta
 *                               que lo creó, p. ej. la de TikTok); busy: el pago está abierto o hay una compra o un «Ya
 *                               pagué» en curso (la UI no abre el editor de apodo encima: lo hace en el onChange en que
 *                               busy vuelve a false); leftBehind: la compra quedó en la sesión con apodo que se dejó
 *                               (ofrecer «Ya pagué»); price: precio para mostrar
 *   onChange(fn) -> off()       fn(state) en cada cambio. state.event dice qué pasó: 'premium' | 'completed' | 'cancel' |
 *                               'slow' | 'restored' | 'already' | 'error' | 'price' | 'account' | 'legacy' |
 *                               'left-behind' | 'change' | 'debug'
 *   offChange(fn)
 *   legacyCheck(save) -> bool   jugador de antes de la venta: solo la primera vez en este aparato, si el guardado ya
 *                               abrió un nivel mayor que FREE (unlocked > FREE) o ganó el FREE+1 (stars[FREE] > 0).
 *                               Después solo devuelve si el aparato tiene permiso
 *   buy({ level, overlay }) -> Promise<{ ok, already?, url?, reason? }>
 *                               sin usuario entra con apodo anónimo, pide la transacción al Worker y abre el pago de
 *                               Paddle encima del juego (overlay:false = solo crea la transacción, para el enlace externo)
 *   externalUrl() -> string     enlace del último pago de esta cuenta (para abrirlo en Safari/Chrome); '' si no hay
 *   price() -> Promise<string>  precio local con impuestos (Paddle.PricePreview); si falla, 'US$1,99 · 1,99 €'
 *   restore(invoice, email) -> Promise<{ ok, reason? }>   «Ya pagué»: el Worker verifica con Paddle y mueve la compra aquí
 *   refresh()                   vuelve a escuchar entitlements/{uid} (respuesta fresca del servidor)
 *   track(name, params)         analítica; la UI manda track('paywall_view', { level }) al mostrar el candado */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : null;
  if (!root) return;
  var Cocardo = (root.Cocardo = root.Cocardo || {});

  var KEY = 'cocardo.v1.premium';
  var CHECKED = 'cocardo.v1.premium.checked';
  var PADDLE_SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js';   // Paddle pide cargarlo siempre desde su CDN
  var FALLBACK_PRICE = 'US$1,99 · 1,99 €';
  var SLOW_MS = 60000;      // tras ~1 min sin aviso del servidor: «Procesando tu pago…»
  var TIMEOUT_MS = 20000;   // llamadas al Worker
  // Ajustes del pago (nombres según developer.paddle.com: Paddle.Checkout.open → settings)
  var SETTINGS = { displayMode: 'overlay', locale: 'es', variant: 'one-page' };

  var listeners = [];
  var mem = null;            // copia en memoria de «cocardo.v1.premium» (si localStorage falla, vale esta sesión)
  var memChecked = false;
  var started = false;
  var watchUid = '', watchOff = null, watchToken = 0, watchBroken = false;
  var paddleP = null;
  var priceText = '', priceP = null;
  var watchAnon = false;      // la cuenta escuchada es una sesión con apodo (anónima)
  var pending = false, slow = false, slowTimer = 0, external = false, completed = false;
  var overlayOpen = false, restoring = false, carrying = false, leftBehind = false;
  var lastError = '', lastEvent = '';
  var checkout = null;       // último pago creado: { uid, txn, url }
  var buying = null;
  var debugPremium = null;   // solo con #debug (ver _debug)

  /* ---------- configuración ---------- */

  function cfg() { return (Cocardo.CloudConfig && Cocardo.CloudConfig.pay) || {}; }
  function free() { var n = Number(cfg().freeLevels); return isFinite(n) && n >= 0 ? Math.floor(n) : 10; }
  function httpOk() { try { return /^https?:$/.test(root.location.protocol); } catch (e) { return false; } }
  function framed() { try { return root.top !== root.self; } catch (e) { return true; } }
  function on() { var c = cfg(); return !!(c.on && c.token && c.priceId) && httpOk() && !framed(); }
  function cloud() { return Cocardo.Cloud || null; }

  /* ---------- copia local ---------- */

  function ls() { try { return root.localStorage || null; } catch (e) { return null; } }
  function clean(o) {
    var out = { device: null, accounts: {} };
    if (!o || typeof o !== 'object') return out;
    if (o.device && o.device.legacy === true) out.device = { legacy: true, at: Number(o.device.at) || 0 };
    if (o.accounts && typeof o.accounts === 'object') {
      Object.keys(o.accounts).forEach(function (uid) {
        var a = o.accounts[uid];
        if (uid.length <= 128 && a && typeof a === 'object') out.accounts[uid] = { order: String(a.order || '').slice(0, 64), at: Number(a.at) || 0 };
      });
    }
    return out;
  }
  function read() {
    if (mem) return mem;
    var raw = null;
    try { var s = ls(); var t = s && s.getItem(KEY); if (t) raw = JSON.parse(t); } catch (e) { raw = null; }
    mem = clean(raw);
    return mem;
  }
  function write() { try { var s = ls(); if (s) s.setItem(KEY, JSON.stringify(read())); } catch (e) { /* queda en memoria */ } }
  function wasChecked() {
    if (memChecked) return true;
    try { var s = ls(); memChecked = !!s && s.getItem(CHECKED) === '1'; } catch (e) { memChecked = false; }
    return memChecked;
  }
  function markChecked() { memChecked = true; try { var s = ls(); if (s) s.setItem(CHECKED, '1'); } catch (e) { /* nada */ } }
  function millis(v) {
    if (v && typeof v.toMillis === 'function') { try { return v.toMillis(); } catch (e) { /* abajo */ } }
    if (typeof v === 'number' && isFinite(v)) return v;
    var t = Date.parse(v);
    return isFinite(t) ? t : Date.now();
  }

  /* ---------- quién juega y si pagó ---------- */

  // Cuenta actual. Antes de que cargue el SDK (la sesión se restaura ~1,2 s después del arranque), mientras Firebase
  // todavía no dijo si había sesión, o si no pudo cargar (sin conexión) vale la última cuenta de este aparato (la
  // copia del perfil que guarda Cocardo.Cloud): así el que pagó no ve el candado al abrir ni sin internet.
  function currentUid() {
    var C = cloud();
    if (!C) return '';
    var u = C.user ? C.user() : null;
    if (u && u.uid) return u.uid;
    var st = C.state ? C.state() : 'off';
    var known = C.authKnown ? C.authKnown() : true;
    if (st === 'idle' || st === 'loading' || st === 'error' || (st === 'ready' && !known)) {
      try { var d = Cocardo.Save.get(); if (d.cloud && d.cloud.on && d.cloud.uid) return String(d.cloud.uid); } catch (e) { /* nada */ }
    }
    return '';
  }
  function accountGrant(uid) { return !!(uid && read().accounts[uid]); }
  function premium() {
    if (debugPremium !== null) return debugPremium;
    return !!read().device || accountGrant(currentUid());
  }
  function allowed(levelId) { return !on() || !(Number(levelId) > free()) || premium(); }

  function state() {
    return {
      on: on(), premium: premium(), legacy: !!read().device, account: accountGrant(currentUid()),
      pending: pending, slow: slow, external: external, busy: !!buying || restoring || carrying || overlayOpen,
      leftBehind: leftBehind, error: lastError, price: priceText || FALLBACK_PRICE, event: lastEvent,
    };
  }
  function emit(ev) {
    lastEvent = ev || '';
    var s = state();
    listeners.slice().forEach(function (fn) { try { fn(s); } catch (e) { console.error('[Cocardo.Pay]', e); } });
  }
  function onChange(fn) {
    if (listeners.indexOf(fn) < 0) listeners.push(fn);
    return function () { offChange(fn); };
  }
  function offChange(fn) { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }

  function track(name, params) {
    try { if (Cocardo.Track && Cocardo.Track.event) Cocardo.Track.event(name, params || {}); } catch (e) { /* nada */ }
  }

  /* ---------- jugadores de antes de la venta ---------- */

  // Solo la primera vez (init() la llama antes de que Cocardo.Cloud junte el guardado con la nube). Ganar el nivel
  // FREE+1 también cuenta, pero solo aquí: después lo puede lograr cualquiera que pagó (y luego pidió el reembolso) o
  // escribirlo en su propio guardado de la nube
  function legacyCheck(d) {
    if (!on() || !d || typeof d !== 'object') return false;
    var m = read();
    if (wasChecked()) return !!m.device;
    var F = free();
    var stars = Array.isArray(d.stars) ? d.stars : [];
    var grant = (Number(d.unlocked) || 0) > F || (Number(stars[F]) || 0) > 0;
    markChecked();
    if (grant && !m.device) {
      m.device = { legacy: true, at: Date.now() };
      write();
      emit('legacy');
    }
    return !!m.device;
  }

  /* ---------- escucha de entitlements/{uid} ---------- */

  function watch(uid, anon) {
    if (watchOff) { try { watchOff(); } catch (e) { /* nada */ } watchOff = null; }
    watchUid = uid;
    watchAnon = !!(uid && anon);
    watchBroken = false;
    leftBehind = false;
    var token = ++watchToken;
    var C = cloud();
    if (!uid || !C || typeof C.watchDoc !== 'function') return;
    watchOff = C.watchDoc('entitlements/' + uid, function (snap) {
      if (token === watchToken) onEntitlement(uid, snap);
    }, function () {
      // tras un error Firestore no avisa más (sin conexión, reglas): refresh() vuelve a escuchar
      if (token === watchToken) watchBroken = true;
    });
  }
  function refresh() { if (on()) watch(watchUid, watchAnon); }

  // snap = { exists, fromCache, data } (Cocardo.Cloud.watchDoc)
  function onEntitlement(uid, snap) {
    if (!snap) return;
    if (snap.fromCache && !snap.exists) return;   // caché local vacía (sin conexión o recién abierto): no dice nada
    var acc = read().accounts;
    var had = !!acc[uid];
    var d = snap.exists ? (snap.data || {}) : null;
    if (d && d.premium === true) acc[uid] = { order: String(d.order || '').slice(0, 64), at: millis(d.at) };
    else delete acc[uid];   // el servidor dice que no hay compra (devuelta o movida a otra cuenta con «Ya pagué»)
    write();
    var has = !!acc[uid];
    if (has && pending && uid === currentUid()) { stopPending(); emit('premium'); return; }
    if (has !== had) emit(has ? 'premium' : 'change');
  }

  function onCloud() {
    var C = cloud();
    var u = C && C.user ? C.user() : null;
    var uid = u && u.uid ? u.uid : '';
    if (uid === watchUid) { watchAnon = !!(uid && u.anon); return; }   // p. ej. el apodo se vinculó con Google
    var prev = watchUid, prevAnon = watchAnon;
    watch(uid, u && u.anon);
    emit('account');
    if (prev && prevAnon) carryFrom(prev, uid);
  }

  // Se dejó una sesión con apodo (anónima) que tenía la compra (o un pago en curso): al entrar con una cuenta de
  // Google que ya existía, Cocardo.Cloud guardó el token de esa sesión y el Worker trae la compra sin gastar
  // traslados. Si no hay token (cerró sesión) o falla, 'left-behind': la UI ofrece «Ya pagué» con la factura
  function carryFrom(prev, uid) {
    if (!accountGrant(prev) && !(checkout && checkout.uid === prev)) return;
    var C = cloud();
    var tok = '';
    try { tok = C && C.takeAnonToken ? C.takeAnonToken(prev) : ''; } catch (e) { tok = ''; }
    if (!uid || !tok) { leftBehind = true; emit('left-behind'); return; }
    carrying = true;
    api('/api/restore', { from: tok }).then(function (res) {
      carrying = false;
      if (!res || res.ok !== true) throw fail('carry-failed');
      if (currentUid() !== uid) return;
      startPending();   // la compra ya es de esta cuenta: llega por la escucha
      if (watchBroken) refresh();
      emit('restored');
    }).catch(function () {
      carrying = false;
      if (currentUid() !== uid) return;
      leftBehind = true;
      emit('left-behind');
    });
  }

  function startPending() {
    if (accountGrant(currentUid())) return;
    pending = true;
    slow = false;
    clearTimeout(slowTimer);
    slowTimer = setTimeout(function () {
      if (!pending) return;
      slow = true;
      refresh();
      emit('slow');
    }, SLOW_MS);
  }
  function stopPending() {
    pending = false;
    slow = false;
    external = false;
    lastError = '';
    clearTimeout(slowTimer);
  }

  /* ---------- Paddle.js ---------- */

  function script(src) {
    return new Promise(function (res, rej) {
      var doc = root.document;
      var s = doc.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('paddle-load')); };
      doc.head.appendChild(s);
    });
  }
  // Se descarga una sola vez y Paddle.Initialize() se llama una sola vez por página (lo exige Paddle)
  function ensurePaddle() {
    if (paddleP) return paddleP;
    if (!on()) return Promise.reject(new Error('pay-off'));
    paddleP = (root.Paddle && root.Paddle.Initialize ? Promise.resolve() : script(PADDLE_SRC)).then(function () {
      var P = root.Paddle;
      if (!P || !P.Initialize || !P.Checkout) throw new Error('paddle-load');
      if (cfg().env !== 'live' && P.Environment) P.Environment.set('sandbox');   // antes de Initialize
      P.Initialize({ token: cfg().token, eventCallback: onPaddle, checkout: { settings: SETTINGS } });
      return P;
    });
    paddleP.catch(function () { paddleP = null; });
    return paddleP;
  }

  // Eventos del pago (developer.paddle.com/paddle-js/events): name + data con transaction_id, currency_code, totals
  function onPaddle(ev) {
    var name = ev && ev.name;
    var data = (ev && ev.data) || {};
    if (name === 'checkout.completed') {
      completed = true;
      var t = data.totals || {};
      track('purchase', { transaction_id: String(data.transaction_id || ''), currency: String(data.currency_code || ''), value: typeof t.total === 'number' ? t.total : undefined });
      startPending();
      if (watchBroken) refresh();
      emit('completed');
    } else if (name === 'checkout.closed') {
      var done = completed;
      completed = false;
      overlayOpen = false;
      cleanLink();
      if (!done) {
        external = false;
        track('checkout_cancel', {});
        emit('cancel');
      } else emit('change');   // busy vuelve a false
    }
  }

  // Transacción que viene en la dirección (?_ptxn=txn_…): enlace de pago abierto en Safari/Chrome
  function linkTxn() {
    try { var m = /[?&]_ptxn=(txn_[A-Za-z0-9]+)/.exec(root.location.search || ''); return m ? m[1] : ''; } catch (e) { return ''; }
  }
  // Quita ?_ptxn de la dirección al cerrar el pago (recargar no lo vuelve a abrir)
  function cleanLink() {
    try {
      var loc = root.location;
      if (!/[?&]_ptxn=/.test(loc.search || '')) return;
      var q = loc.search.replace(/^\?/, '').split('&').filter(function (p) { return p && p.indexOf('_ptxn=') !== 0; }).join('&');
      root.history.replaceState(root.history.state, '', loc.pathname + (q ? '?' + q : '') + (loc.hash || ''));
    } catch (e) { /* nada */ }
  }

  /* ---------- Worker cocardo-pagos ---------- */

  function fail(code, status) { var e = new Error(code); if (status) e.status = status; return e; }

  // Hace falta un usuario de Firebase: el actual, o uno anónimo («Jugar con apodo»). Se espera a que Firebase
  // sepa si había sesión, para no crear una anónima encima de una cuenta de Google que se está restaurando.
  function ensureUser() {
    var C = cloud();
    if (!C || !C.available || !C.available()) return Promise.reject(fail('cloud-off'));
    var u = C.user ? C.user() : null;
    if (u && u.uid) return Promise.resolve(u.uid);
    return C.authReady().then(function (uid) {
      if (uid) return uid;
      return C.signInAnon().then(function () { return C.authReady(); }).then(function (uid2) {
        if (!uid2) throw fail('no-user');
        return uid2;
      });
    });
  }

  // POST {apiBase}/api/… con el token de Firebase. Un 401 (token vencido) se reintenta una vez con token nuevo.
  function api(path, body, retried) {
    return cloud().idToken(!!retried).then(function (tok) {
      var url = String(cfg().apiBase || '').replace(/\/+$/, '') + path;
      var ctl = typeof root.AbortController === 'function' ? new root.AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : 0;
      var init = { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify(body || {}) };
      if (ctl) init.signal = ctl.signal;
      return root.fetch(url, init).then(function (r) {
        clearTimeout(timer);
        return r.json().catch(function () { return null; }).then(function (j) {
          if (r.status === 401 && !retried) return api(path, body, true);
          if (!r.ok) throw fail((j && j.error) || ('HTTP ' + r.status), r.status);
          return j || {};
        });
      }, function (e) { clearTimeout(timer); throw e; });
    });
  }

  // Mensaje corto para el jugador
  function friendly(e) {
    var m = String((e && e.message) || '');
    var st = (e && e.status) || 0;
    if (m === 'cloud-off') return 'Para comprar abre el juego en cocardo.app con internet.';
    if (m === 'paddle-load') return 'No se pudo abrir el pago. Revisa tu conexión e inténtalo otra vez.';
    if (st === 429) return 'Demasiados intentos. Espera un momento y vuelve a probar.';
    if (st === 401) return 'Tu sesión venció. Vuelve a intentarlo.';
    if (st === 403 && m === 'origin') return 'Para comprar abre el juego en cocardo.app.';
    if (st === 403 && m === 'sandbox') return 'La venta está en pruebas y esta cuenta no está en la lista de prueba.';
    // respuestas de /api/restore cuando la factura y el correo sí coinciden (tools/pay-worker/worker.js)
    if (st === 409 && m === 'pending') return 'Tu pago todavía se está procesando. Vuelve a intentarlo en unos minutos.';
    if (st === 409 && m === 'limit') return 'Esta compra ya cambió de cuenta demasiadas veces.';
    if (st >= 500) return 'El pago no está disponible ahora mismo. Inténtalo en un rato.';
    if ((e && e.name === 'AbortError') || /Failed to fetch|NetworkError|network/i.test(m)) return 'Sin conexión. Inténtalo de nuevo.';
    if (e && e.code && cloud() && cloud().message) return cloud().message(e) || 'Algo falló. Inténtalo otra vez.';
    return 'Algo falló con el pago. Inténtalo otra vez.';
  }

  function safeUrl(u) { return typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u) ? u.slice(0, 500) : ''; }

  /* ---------- comprar, precio y «Ya pagué» ---------- */

  function buy(opts) {
    opts = opts || {};
    if (!on()) return Promise.resolve({ ok: false, reason: 'off' });
    if (buying) return buying;
    init();
    lastError = '';
    track('checkout_start', { level: opts.level });
    var overlay = opts.overlay !== false;
    var paddle = overlay ? ensurePaddle() : null;   // se descarga mientras el Worker crea la transacción
    if (paddle) paddle.catch(function () { /* se avisa abajo */ });
    buying = ensureUser().then(function (uid) {
      return api('/api/checkout', {}).then(function (res) {
        if (res.already) {   // la cuenta ya tenía la compra: solo falta que llegue a la copia local
          refresh();
          emit('already');
          return { ok: true, already: true };
        }
        if (!/^txn_/.test(String(res.transactionId || ''))) throw fail('bad-response');
        checkout = { uid: uid, txn: res.transactionId, url: safeUrl(res.checkoutUrl) };
        if (!overlay) return { ok: true, url: checkout.url };
        return paddle.then(function (P) {
          completed = false;
          external = false;
          overlayOpen = true;   // hasta checkout.closed
          P.Checkout.open({ transactionId: res.transactionId, settings: SETTINGS });
          return { ok: true, url: checkout.url };
        });
      });
    }).then(function (r) { buying = null; return r; }, function (e) {
      buying = null;
      lastError = friendly(e);
      emit('error');
      return { ok: false, reason: lastError, url: externalUrl() };
    });
    return buying;
  }

  function externalUrl() { return checkout && checkout.url && checkout.uid === currentUid() ? checkout.url : ''; }

  function price() {
    if (priceText) return Promise.resolve(priceText);
    if (!on()) return Promise.resolve(FALLBACK_PRICE);
    if (priceP) return priceP;
    priceP = ensurePaddle().then(function (P) {
      if (typeof P.PricePreview !== 'function') throw new Error('sin PricePreview');
      // sin dirección, Paddle ubica al visitante por su IP y devuelve el precio de su país (camelCase en Paddle.js)
      return P.PricePreview({ items: [{ priceId: cfg().priceId, quantity: 1 }] });
    }).then(function (res) {
      var li = res && res.data && res.data.details && res.data.details.lineItems;
      var t = li && li[0] && li[0].formattedTotals && li[0].formattedTotals.total;   // total con impuestos
      if (typeof t !== 'string' || !t) throw new Error('sin precio');
      priceText = t.slice(0, 40);
      emit('price');
      return priceText;
    }).catch(function () { priceP = null; return FALLBACK_PRICE; });
    return priceP;
  }

  function restore(invoice, email) {
    if (!on()) return Promise.resolve({ ok: false, reason: 'off' });
    invoice = String(invoice == null ? '' : invoice).trim();
    email = String(email == null ? '' : email).trim();
    if (!invoice || invoice.length > 64) return Promise.resolve({ ok: false, reason: 'Escribe el número de factura del correo de Paddle' });
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Promise.resolve({ ok: false, reason: 'Escribe el correo con el que pagaste' });
    init();
    lastError = '';
    restoring = true;
    return ensureUser().then(function () {
      return api('/api/restore', { invoice: invoice, email: email });
    }).then(function (res) {
      if (!res || res.ok !== true) throw fail('restore-failed');
    }).then(function () {
      restoring = false;
      track('restore_purchase', {});
      startPending();   // el Worker ya movió la compra a esta cuenta: llega por la escucha
      if (watchBroken) refresh();
      emit('restored');
      return { ok: true };
    }, function (e) {
      restoring = false;
      var st = (e && e.status) || 0;
      lastError = (e && e.message === 'restore-failed') || st === 400 || st === 404 ? 'No encontramos esa compra. Revisa el número de factura y el correo.' : friendly(e);
      emit('error');
      return { ok: false, reason: lastError };
    });
  }

  /* ---------- arranque ---------- */

  function init() {
    if (started || !on()) return;
    started = true;
    read();
    try { if (Cocardo.Save) legacyCheck(Cocardo.Save.get()); } catch (e) { /* nada */ }
    var C = cloud();
    if (C && C.onChange) C.onChange(onCloud);
    onCloud();
    // otra pestaña compró o restauró: se vuelve a leer la copia local
    try {
      root.addEventListener('storage', function (e) {
        if (e && (e.key === KEY || e.key === null)) { mem = null; emit('change'); }
      });
    } catch (e) { /* nada */ }
    if (linkTxn()) {
      external = true;
      track('checkout_start', { via: 'link' });
      ensurePaddle().catch(function (e) { lastError = friendly(e); emit('error'); });
    }
  }

  // Depuración: main.js llama _debug(debugOn) una sola vez al arrancar; solo con #debug en desarrollo queda
  // _setPremiumForDebug(true | false | null) (null vuelve a lo real). En producción no queda ninguno de los dos.
  function setPremiumForDebug(v) {
    debugPremium = v == null ? null : !!v;
    emit('debug');
    return premium();
  }

  var Pay = {
    init: init,
    on: on,
    allowed: allowed,
    premium: premium,
    state: state,
    onChange: onChange,
    offChange: offChange,
    legacyCheck: legacyCheck,
    buy: buy,
    externalUrl: externalUrl,
    price: price,
    restore: restore,
    refresh: refresh,
    track: track,
    _debug: function (enabled) {
      delete Pay._debug;
      if (enabled) Pay._setPremiumForDebug = setPremiumForDebug;
    },
  };
  Object.defineProperty(Pay, 'FREE', { get: free, enumerable: true });
  Cocardo.Pay = Pay;
})();
