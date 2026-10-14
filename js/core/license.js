/* Cocardo: ¡Rescate Helado! — Códigos de la versión completa (firma ECDSA P-256, verificación sin servidor).
 * Contrato: docs/ARQUITECTURA.md §14. Decisión de negocio: docs/MONETIZACION.md.
 * Puro: no toca window, document ni localStorage. WebCrypto (crypto.subtle) lo pasa quien llama.
 *
 * Código = base64url de 70 bytes:
 *   [0] formato (1) · [1] producto (1 = niveles 11–30) · [2..5] número de serie (uint32, big-endian)
 *   [6..69] firma ECDSA P-256 / SHA-256 (r‖s) sobre 'COCARDO1' ‖ bytes[0..5]
 * La clave privada vive fuera del repo (tools/license.cjs keygen). Aquí solo va la pública. */
(function () {
  'use strict';
  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  var FORMAT = 1;
  var HEADER = 6;
  var SIG = 64;
  var BYTES = HEADER + SIG;
  var CODE_LEN = 94;          // ceil(70 * 4 / 3) sin relleno
  var DOMAIN = 'COCARDO1';
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  // base64url sin relleno
  function encode(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      var left = bytes.length - i;
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
      if (left > 1) out += B64[(n >> 6) & 63];
      if (left > 2) out += B64[n & 63];
    }
    return out;
  }

  function decodeB64(str) {
    if (str.length % 4 === 1) return null;
    var out = [];
    var buf = 0, bits = 0;
    for (var i = 0; i < str.length; i++) {
      var v = B64.indexOf(str[i]);
      if (v < 0) return null;
      buf = (buf << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out.push((buf >> bits) & 255);
      }
    }
    return new Uint8Array(out);
  }

  // Acepta el código suelto, el enlace completo o '#licencia=…' (con otros parámetros o saltos de línea).
  function normalize(input) {
    if (typeof input !== 'string') return null;
    var m = input.match(/licencia=([A-Za-z0-9_-]+)/);
    var code = m ? m[1] : input.replace(/\s+/g, '');
    return /^[A-Za-z0-9_-]+$/.test(code) && code.length === CODE_LEN ? code : null;
  }

  function decode(code) {
    var c = normalize(code);
    if (!c) return null;
    var bytes = decodeB64(c);
    // Solo la forma canónica: evita que un mismo código tenga varias escrituras
    if (!bytes || bytes.length !== BYTES || encode(bytes) !== c) return null;
    if (bytes[0] !== FORMAT) return null;
    var serial = ((bytes[2] << 24) | (bytes[3] << 16) | (bytes[4] << 8) | bytes[5]) >>> 0;
    return { code: c, format: bytes[0], product: bytes[1], serial: serial,
      payload: bytes.slice(0, HEADER), sig: bytes.slice(HEADER) };
  }

  // Bytes firmados: dominio + cabecera (lo mismo usa tools/license.cjs)
  function message(payload) {
    var out = new Uint8Array(DOMAIN.length + payload.length);
    for (var i = 0; i < DOMAIN.length; i++) out[i] = DOMAIN.charCodeAt(i);
    out.set(payload, DOMAIN.length);
    return out;
  }

  function header(product, serial) {
    var s = serial >>> 0;
    return new Uint8Array([FORMAT, product & 255, (s >>> 24) & 255, (s >>> 16) & 255, (s >>> 8) & 255, s & 255]);
  }

  // -> Promise<{ ok, reason, code?, serial?, product? }>
  // reason: 'ok' | 'format' | 'product' | 'revoked' | 'signature' | 'nokey' | 'nocrypto'
  function verify(input, subtle, jwk) {
    var key = jwk === undefined ? License.PUBLIC_KEY : jwk;
    var d = decode(input);
    if (!d) return Promise.resolve({ ok: false, reason: 'format' });
    var info = { code: d.code, serial: d.serial, product: d.product };
    var fail = function (reason) { info.ok = false; info.reason = reason; return info; };
    if (d.product !== License.PRODUCT_FULL) return Promise.resolve(fail('product'));
    if (License.REVOKED.indexOf(d.serial) >= 0) return Promise.resolve(fail('revoked'));
    if (!key) return Promise.resolve(fail('nokey'));
    if (!subtle || typeof subtle.verify !== 'function') return Promise.resolve(fail('nocrypto'));
    var alg = { name: 'ECDSA', namedCurve: 'P-256' };
    var pub = { kty: 'EC', crv: 'P-256', x: key.x, y: key.y };
    return Promise.resolve()
      .then(function () { return subtle.importKey('jwk', pub, alg, false, ['verify']); })
      .then(function (k) { return subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, d.sig, message(d.payload)); })
      .then(function (good) { if (good) { info.ok = true; info.reason = 'ok'; return info; } return fail('signature'); },
        function () { return fail('nocrypto'); });
  }

  // ¿El nivel pide la versión completa? (solo campaña; el Reto Diario siempre es gratis)
  function isLevelLocked(levelId, full) {
    return !full && levelId > License.FREE_LEVELS;
  }

  var License = {
    FREE_LEVELS: 10,
    PRODUCT_FULL: 1,
    CODE_LEN: CODE_LEN,
    // Clave pública de producción: la imprime `node tools/license.cjs keygen`. null = venta apagada.
    PUBLIC_KEY: null,
    // Números de serie anulados (códigos filtrados o reembolsados)
    REVOKED: [],
    normalize: normalize,
    decode: decode,
    verify: verify,
    isLevelLocked: isLevelLocked,
    // Para tools/license.cjs y las pruebas
    _encode: encode,
    _header: header,
    _message: message,
  };

  Cocardo.License = License;
  if (typeof module !== 'undefined' && module.exports) module.exports = License;
})();
