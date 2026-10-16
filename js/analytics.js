/* Cocardo: ¡Rescate Helado! — Analítica mínima (Cocardo.Track).
 * Contrato: docs/ARQUITECTURA.md §16. Envía eventos a Google Analytics 4 si hay un ID en js/cloud-config.js
 * (se carga gtag.js solo entonces y solo desde http/https). Sin ID, todo es un no-op: no se descarga nada.
 * Eventos: level_start, level_end, daily_end, share, clip, sign_in, sign_out, nick_set, install, referral. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : null;
  if (!root) return;
  var Cocardo = (root.Cocardo = root.Cocardo || {});
  var doc = root.document;
  var loaded = false, loading = false, queue = [];

  function id() { return (Cocardo.CloudConfig && Cocardo.CloudConfig.ga4) || ''; }
  function httpOk() { try { return /^https?:$/.test(location.protocol); } catch (e) { return false; } }
  function enabled() { return !!id() && httpOk(); }

  function gtag() { root.dataLayer = root.dataLayer || []; root.dataLayer.push(arguments); }

  function load() {
    if (loaded || loading || !enabled()) return;
    loading = true;
    try {
      var s = doc.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id());
      s.onload = function () {
        loaded = true;
        gtag('js', new Date());
        gtag('config', id(), { send_page_view: true, anonymize_ip: true });
        queue.forEach(function (q) { gtag('event', q.name, q.params); });
        queue = [];
      };
      s.onerror = function () { loading = false; queue = []; };
      doc.head.appendChild(s);
    } catch (e) { loading = false; }
  }

  // Cocardo.Track.event('level_end', { level: 3, won: true, stars: 2 })
  function event(name, params) {
    if (!enabled()) return;
    var p = {};
    try { Object.keys(params || {}).forEach(function (k) { var v = params[k]; if (v != null && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) p[k] = v; }); } catch (e) { /* nada */ }
    if (loaded) { try { gtag('event', name, p); } catch (e) { /* nada */ } return; }
    if (queue.length < 50) queue.push({ name: name, params: p });
    load();
  }

  function setUser(uid) {
    if (!enabled()) return;
    try { gtag('config', id(), { user_id: uid ? String(uid).slice(0, 64) : undefined }); } catch (e) { /* nada */ }
  }

  Cocardo.Track = { enabled: enabled, event: event, setUser: setUser, load: load };
})();
