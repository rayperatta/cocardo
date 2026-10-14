/* Cocardo: ¡Rescate Helado! — Versión completa: candados, canje de códigos y pantallas de compra.
 * Contrato: docs/ARQUITECTURA.md §14. Decisión y textos: docs/MONETIZACION.md.
 * Usa Cocardo.License (verificación) y Cocardo.Save (campo `license`). Sin servidor, sin SDK externos.
 * Mientras no haya clave pública y enlace de compra, no bloquea nada: el juego entero es gratis. */
(function () {
  'use strict';

  var root = typeof window !== 'undefined' ? window : null;
  var Cocardo = root ? (root.Cocardo = root.Cocardo || {}) : {};

  // Lo único que cambia quien publica el juego (ver docs/MONETIZACION.md §6).
  // La venta se enciende cuando hay clave pública, buyUrl y contact (el contacto es obligatorio antes de cobrar).
  var config = {
    buyUrl: '',        // PENDIENTE: página de venta en itch.io
    donateUrl: '',     // «Invítame un helado» (opcional, no desbloquea nada)
    price: 'US$1,99',  // texto del botón
    contact: '',       // PENDIENTE: correo para dudas y reembolsos (se muestra en la pantalla de compra)
    // Aviso de juego de fans: el mismo texto va en la portada y en Ajustes (DISENO §11)
    fanNote: 'Juego de fans hecho con permiso de la creadora. Inspirado en la frutinovela viral.',
  };

  var memory = { license: null };   // sin Cocardo.Save (vistas previas, pruebas)
  var listeners = [];
  var env = null;
  var overlay = null;
  var lastFocus = null;
  var onClose = null;

  function E() {
    if (env) return env;
    var c = root && root.crypto;
    return {
      location: root ? root.location : null,
      history: root ? root.history : null,
      subtle: c && c.subtle ? c.subtle : null,
      now: function () { return Date.now(); },
    };
  }
  function L() { return Cocardo.License || (typeof require === 'function' ? require('./core/license.js') : null); }
  function data() {
    var S = Cocardo.Save;
    var d = S && typeof S.get === 'function' ? S.get() : null;
    return d && typeof d === 'object' ? d : memory;
  }
  function persist() {
    try { if (Cocardo.Save && typeof Cocardo.Save.save === 'function') Cocardo.Save.save(); } catch (e) { /* nada */ }
  }
  function emit() {
    var full = isFull();
    listeners.slice().forEach(function (fn) { try { fn(full); } catch (e) { /* nada */ } });
  }
  function sfx(name) {
    try { if (Cocardo.Audio) Cocardo.Audio.play(name); } catch (e) { /* nada */ }
  }

  // ------------------------------------------------------------ estado

  function selling() { return !!(L().PUBLIC_KEY && config.buyUrl && config.contact); }
  function isFull() {
    var lic = data().license;
    return !!(lic && lic.code);
  }
  function isLocked(levelId) { return selling() && L().isLevelLocked(levelId, isFull()); }
  function code() { var lic = data().license; return lic && lic.code ? lic.code : null; }
  function canVerify() { return !!(E().subtle && L().PUBLIC_KEY); }

  function setLicense(lic) {
    var d = data();
    var before = isFull();
    d.license = lic;
    persist();
    if (before !== isFull() || lic) emit();
  }

  function redeem(text) {
    var Lic = L();
    return Lic.verify(text, E().subtle).then(function (r) {
      if (r.ok) setLicense({ code: r.code, serial: r.serial, product: r.product, at: E().now() });
      return r;
    });
  }

  // Enlace que se puede guardar o compartir con uno mismo (sin otros parámetros del hash)
  function licenseLink(c) {
    var loc = E().location;
    if (!loc || !/^https?:$/.test(loc.protocol)) return c;
    return loc.origin + loc.pathname + '#licencia=' + c;
  }

  // Quita 'licencia=…' del hash sin recargar ni dejarlo en el historial
  function cleanHash() {
    var loc = E().location, hist = E().history;
    if (!loc || !hist || typeof hist.replaceState !== 'function') return;
    var rest = String(loc.hash || '').replace(/^#/, '').split('&').filter(function (p) {
      return p && p.indexOf('licencia=') !== 0;
    }).join('&');
    try { hist.replaceState(null, '', loc.pathname + loc.search + (rest ? '#' + rest : '')); } catch (e) { /* nada */ }
  }

  // Llamar tras Cocardo.Save.load(). Canjea '#licencia=…' y revisa la licencia guardada (lista de anuladas).
  function init(opts) {
    var show = !(opts && opts.show === false);
    var loc = E().location;
    var hash = loc ? String(loc.hash || '') : '';
    var saved = code();
    var check = Promise.resolve();
    if (saved) {
      check = L().verify(saved, E().subtle).then(function (r) {
        // Sin crypto o sin clave no se puede revisar: se confía en lo guardado
        if (!r.ok && r.reason !== 'nocrypto' && r.reason !== 'nokey') setLicense(null);
      });
    }
    return check.then(function () {
      if (hash.indexOf('licencia=') < 0) return { redeemed: false };
      cleanHash();
      return redeem(hash).then(function (r) {
        if (show && typeof document !== 'undefined') open(r.ok ? 'success' : 'redeem', { result: r });
        return { redeemed: r.ok, result: r };
      });
    });
  }

  function onChange(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }

  // ------------------------------------------------------------ textos

  var REASONS = {
    format: 'Ese código está incompleto. Cópialo otra vez, entero, desde el mensaje de tu compra.',
    signature: 'Ese código no es válido. Revisa que lo copiaste completo, sin cambiar nada.',
    product: 'Ese código no es de esta temporada.',
    revoked: 'Ese código fue anulado.',
    nokey: 'Los códigos todavía no están activados en esta versión del juego.',
    nocrypto: 'Este navegador no puede revisar el código. Abre el juego en Chrome, Safari o Firefox actualizados.',
  };

  function reasonText(r) {
    var t = REASONS[r.reason] || REASONS.signature;
    if ((r.reason === 'revoked' || r.reason === 'signature') && config.contact) {
      t += ' Si lo compraste, escríbenos a ' + config.contact + '.';
    }
    return t;
  }

  var BULLETS = [
    '20 niveles nuevos (del 11 al 30): 4 capítulos de puro drama',
    'Rescata a Fresa, Durazna, Naranja, Uva y Banana',
    'Traiciones, secretos y el gran final de temporada',
    'Marco dorado de «Socio de la heladería» en tu Álbum',
    'Pago único: sin suscripción, sin anuncios y sin compras extra',
    'El Reto Diario y el Álbum siguen gratis para todos',
  ];

  // ------------------------------------------------------------ DOM

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function button(cls, text, fn) {
    var b = el('button', 'st-btn ' + cls, text);
    b.type = 'button';
    b.addEventListener('click', function () { sfx('tap'); fn(); });
    return b;
  }
  function link(cls, text, href) {
    var a = el('a', 'st-btn ' + cls, text);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.addEventListener('click', function () { sfx('tap'); });
    return a;
  }

  // Copiar con respaldo: portapapeles -> cuadro de texto seleccionado (como DISENO §9)
  function copyBox(text, label) {
    var wrap = el('div', 'st-copy');
    var note = el('p', 'st-note', '');
    var fallback = function () {
      var ta = el('textarea', 'st-input');
      ta.readOnly = true;
      ta.rows = 3;
      ta.value = text;
      wrap.appendChild(ta);
      note.textContent = 'Cópialo y guárdalo en un lugar seguro.';
      ta.focus();
      ta.select();
    };
    var b = button('st-ghost', label, function () {
      b.disabled = true;
      var p;
      try { p = root.navigator.clipboard.writeText(text); } catch (e) { p = Promise.reject(e); }
      Promise.resolve(p).then(function () { note.textContent = '¡Copiado!'; }, fallback);
    });
    wrap.appendChild(b);
    wrap.appendChild(note);
    return wrap;
  }

  function footer(card, withMinors) {
    var f = el('p', 'st-fine');
    var parts = [config.fanNote];
    if (withMinors) parts.push('Si eres menor de edad, pide permiso a un adulto antes de pagar.');
    parts.push('Tu progreso se guarda en este navegador.');
    if (config.contact) parts.push('¿Dudas o reembolsos? ' + config.contact);
    f.textContent = parts.join(' ');
    card.appendChild(f);
  }

  function header(card, kicker, title) {
    var h = el('div', 'st-head');
    var A = Cocardo.Art;
    if (A && typeof A.portrait === 'function') {
      var p = el('div', 'st-portrait');
      try { p.innerHTML = A.portrait('cocardo', 'burlon'); } catch (e) { p = null; }
      if (p) h.appendChild(p);
    }
    if (kicker) h.appendChild(el('div', 'st-kicker', kicker));
    var t = el('h2', 'st-title', title);
    t.id = 'st-title';
    h.appendChild(t);
    card.appendChild(h);
  }

  var VIEWS = {
    paywall: function (card, opts) {
      if (!selling()) return VIEWS.status(card, opts);
      header(card, 'CONTINUARÁ...', 'en la versión completa');
      card.appendChild(el('p', 'st-lead', opts.reason === 'lock'
        ? 'Este capítulo continúa en la versión completa. Esto es lo que te espera:'
        : 'Lima está a salvo, pero Don Piña quiere mil helados y Cocardo dice que va a necesitar… más fruta. ¿Quién sigue?'));
      var ul = el('ul', 'st-list');
      BULLETS.forEach(function (t) { ul.appendChild(el('li', null, t)); });
      card.appendChild(ul);
      var row = el('div', 'st-actions');
      row.appendChild(link('st-primary', 'Desbloquear todo' + (config.price ? ' · ' + config.price : ''), config.buyUrl));
      row.appendChild(button('st-secondary', 'Ya tengo un código', function () { render('redeem', opts); }));
      row.appendChild(button('st-secondary', 'Ahora no', close));
      card.appendChild(row);
      card.appendChild(copyBox(config.buyUrl, '¿No se abre? Copiar enlace de pago'));
      footer(card, true);
    },

    redeem: function (card, opts) {
      header(card, 'Versión completa', 'Canjear código');
      card.appendChild(el('p', 'st-lead', 'Pega aquí el código o el enlace que te llegó después de pagar.'));
      var ta = el('textarea', 'st-input');
      ta.rows = 3;
      ta.placeholder = 'AQEAAA…';
      ta.setAttribute('aria-label', 'Código de la versión completa');
      ta.autocapitalize = 'off';
      ta.spellcheck = false;
      card.appendChild(ta);
      var msg = el('p', 'st-msg');
      msg.setAttribute('role', 'status');
      card.appendChild(msg);
      var prev = opts.result;
      if (prev && !prev.ok) { msg.textContent = reasonText(prev); msg.className = 'st-msg st-bad'; }
      var row = el('div', 'st-actions');
      var go = button('st-primary', 'Canjear', function () {
        go.disabled = true;
        msg.className = 'st-msg';
        msg.textContent = 'Revisando…';
        redeem(ta.value).then(function (r) {
          go.disabled = false;
          if (r.ok) { render('success', opts); return; }
          sfx('invalid');
          msg.className = 'st-msg st-bad';
          msg.textContent = reasonText(r);
        });
      });
      row.appendChild(go);
      row.appendChild(button('st-secondary', selling() ? 'Volver' : 'Cerrar',
        function () { if (selling()) render('paywall', opts); else close(); }));
      card.appendChild(row);
      footer(card, false);
    },

    success: function (card) {
      sfx('win');
      card.classList.add('st-win');
      header(card, '¡Tenemos un trato, socio!', 'Versión completa desbloqueada');
      card.appendChild(el('p', 'st-lead', 'Ya tienes los niveles 11 al 30 y tu marco dorado está en el Álbum. ' +
        'Guarda tu código por si cambias de celular o de navegador.'));
      var row = el('div', 'st-actions');
      row.appendChild(button('st-primary', '¡A rescatar!', close));
      card.appendChild(row);
      card.appendChild(copyBox(licenseLink(code()), 'Copiar mi código'));
    },

    status: function (card) {
      if (isFull()) {
        header(card, 'Versión completa', '¡Gracias por apoyar este juego de fans!');
        var lic = data().license;
        card.appendChild(el('p', 'st-lead', 'Tienes los 30 niveles desbloqueados (código n.º ' + lic.serial + '). ' +
          'Borrar progreso no quita la versión completa.'));
        card.appendChild(copyBox(licenseLink(lic.code), 'Copiar mi código'));
      } else if (selling()) {
        header(card, 'Versión completa', 'Niveles 11 al 30' + (config.price ? ' · ' + config.price : ''));
        card.appendChild(el('p', 'st-lead', 'Pago único. Los niveles 1 al 10, el Reto Diario y el Álbum son gratis.'));
        var r1 = el('div', 'st-actions');
        r1.appendChild(button('st-primary', 'Ver qué incluye', function () { render('paywall', { reason: 'settings' }); }));
        r1.appendChild(button('st-secondary', 'Ya tengo un código', function () { render('redeem', {}); }));
        card.appendChild(r1);
      } else {
        header(card, 'Juego de fans', 'Este juego es gratis y completo');
        card.appendChild(el('p', 'st-lead', 'Los 30 niveles, el Reto Diario y el Álbum son para todos.'));
      }
      var row = el('div', 'st-actions');
      if (config.donateUrl) row.appendChild(link('st-secondary', 'Invítame un helado', config.donateUrl));
      row.appendChild(button('st-secondary', 'Cerrar', close));
      card.appendChild(row);
      footer(card, !!config.donateUrl);
    },
  };

  function render(view, opts) {
    if (!overlay) return;
    var card = overlay.querySelector('.st-card');
    card.className = 'st-card st-view-' + view;
    card.textContent = '';
    (VIEWS[view] || VIEWS.status)(card, opts || {});
    var first = card.querySelector('textarea:not([readonly]), .st-primary, .st-btn');
    if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
    card.scrollTop = 0;
  }

  function onKey(e) {
    if (!overlay) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = overlay.querySelectorAll('button:not([disabled]), a[href], textarea');
    if (!f.length) return;
    var a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }

  // view: 'paywall' | 'redeem' | 'success' | 'status'. opts: { reason:'cliff'|'lock'|'settings', onClose(full) }
  function open(view, opts) {
    if (typeof document === 'undefined') return;
    opts = opts || {};
    if (!overlay) {
      lastFocus = document.activeElement;
      overlay = el('div', 'st-overlay');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'st-title');
      overlay.appendChild(el('div', 'st-card'));
      overlay.addEventListener('pointerdown', function (e) { if (e.target === overlay) close(); });
      (document.getElementById('app') || document.body).appendChild(overlay);
      document.addEventListener('keydown', onKey, true);
    }
    onClose = typeof opts.onClose === 'function' ? opts.onClose : null;
    render(view, opts);
  }

  function close() {
    if (!overlay) return;
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    overlay = null;
    if (lastFocus && typeof lastFocus.focus === 'function') { try { lastFocus.focus(); } catch (e) { /* nada */ } }
    var cb = onClose;
    onClose = null;
    if (cb) cb(isFull());
  }

  var Store = {
    config: config,
    init: init,
    selling: selling,
    isFull: isFull,
    isLocked: isLocked,
    code: code,
    canVerify: canVerify,
    redeem: redeem,
    onChange: onChange,
    open: open,
    close: close,
    isOpen: function () { return !!overlay; },
    // Solo para #debug y pruebas
    setFull: function (on) {
      setLicense(on ? { code: 'debug', serial: 0, product: 1, at: E().now() } : null);
    },
    _setEnv: function (e) { env = e; },
    _memory: memory,
  };

  Cocardo.Store = Store;
  if (typeof module !== 'undefined' && module.exports) module.exports = Store;
})();
