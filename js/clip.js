/* Cocardo: ¡Rescate Helado! — Clips de jugada en vertical 9:16 (Cocardo.Clip).
 * Contrato: docs/ARQUITECTURA.md §15. Graba el tablero (canvas) y el audio del juego con MediaRecorder,
 * compuestos en un lienzo 720×1280 con logo, nombre del nivel, movimientos, puntos y marca de agua, listo para
 * TikTok, Reels o Shorts. Sin dependencias; si el navegador no lo soporta, supported() devuelve false y la UI
 * no muestra el botón. Formato: MP4 si el navegador lo codifica (Safari, Chrome nuevo), si no WebM. */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : null;
  if (!root) return;
  var Cocardo = (root.Cocardo = root.Cocardo || {});
  var doc = root.document;

  var W = 720, H = 1280, FPS = 30;
  var MAX_MS = 3 * 60 * 1000;      // nunca más de 3 minutos (memoria)
  var MIME = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

  var rec = null;          // grabación en curso { mr, chunks, canvas, g, src, hud, raf, t0, mime, stream, logo }
  var last = null;         // último clip terminado (File)
  var lastMeta = null;     // { ms, mime }
  var logoImg = null, logoPromise = null;

  function framed() { try { return root.top !== root.self; } catch (e) { return true; } }
  function mimeType() {
    try {
      if (!root.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
      for (var i = 0; i < MIME.length; i++) if (MediaRecorder.isTypeSupported(MIME[i])) return MIME[i];
    } catch (e) { /* nada */ }
    return '';
  }
  function supported() {
    try {
      if (framed()) return false;
      var cv = doc.createElement('canvas');
      return !!(root.MediaRecorder && typeof cv.captureStream === 'function' && mimeType());
    } catch (e) { return false; }
  }

  function logo() {
    if (logoPromise) return logoPromise;
    logoPromise = new Promise(function (res) {
      try {
        var svg = Cocardo.Art && Cocardo.Art.logo ? Cocardo.Art.logo() : '';
        if (!svg) { res(null); return; }
        svg = String(svg).replace(/<svg\b([^>]*)>/, function (m, a) { return '<svg' + a.replace(/\s(width|height)="[^"]*"/g, '') + ' width="560" height="280">'; });
        var img = new Image();
        img.onload = function () { logoImg = img; res(img); };
        img.onerror = function () { res(null); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      } catch (e) { res(null); }
    });
    return logoPromise;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function pill(g, x, y, w, h, fill, text, font, color) {
    roundRect(g, x, y, w, h, h / 2);
    g.fillStyle = fill; g.fill();
    g.lineWidth = 5; g.strokeStyle = '#2b1630'; g.stroke();
    g.fillStyle = color || '#2b1630';
    g.font = font;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, x + w / 2, y + h / 2 + 2);
  }

  // Dibuja un cuadro: fondo, logo, título, tablero y marca de agua
  function frame(r) {
    var g = r.g, hud = {};
    try { hud = r.hud ? (r.hud() || {}) : {}; } catch (e) { hud = {}; }
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2b1630'); grad.addColorStop(0.5, '#5b1e74'); grad.addColorStop(1, '#2b1630');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    // chispitas fijas (se mueven despacio con el tiempo)
    var t = (Date.now() - r.t0) / 1000;
    g.fillStyle = 'rgba(255,255,255,.12)';
    for (var i = 0; i < 24; i++) {
      var x = (i * 173 + 40) % W, y = ((i * 311 + t * 18 * (1 + i % 3)) % (H + 40)) - 20;
      g.beginPath(); g.arc(x, y, 3 + (i % 3) * 2, 0, Math.PI * 2); g.fill();
    }
    if (logoImg) g.drawImage(logoImg, (W - 420) / 2, 34, 420, 210);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff6ea';
    g.font = '44px "Lilita One", "Arial Rounded MT Bold", sans-serif';
    g.fillText(String(hud.title || ''), W / 2, 282, W - 80);
    if (hud.sub) {
      g.fillStyle = '#ffc93c';
      g.font = '800 28px "Nunito", system-ui, sans-serif';
      g.fillText(String(hud.sub), W / 2, 326, W - 80);
    }
    // tablero centrado, cuadrado, con marco
    var src = r.src;
    var size = W - 56, bx = 28, by = 372;
    if (src && src.width && src.height) {
      var ar = src.width / src.height;
      var bw = size, bh = size;
      if (ar > 1) bh = size / ar; else bw = size * ar;
      var ox = bx + (size - bw) / 2, oy = by + (size - bh) / 2;
      roundRect(g, ox - 10, oy - 10, bw + 20, bh + 20, 34);
      g.fillStyle = 'rgba(255,246,234,.18)'; g.fill();
      try { g.drawImage(src, ox, oy, bw, bh); } catch (e) { /* lienzo aún no listo */ }
    }
    // pastillas de movimientos y puntos
    var py = by + size + 36;
    if (hud.moves != null) pill(g, 40, py, 300, 84, '#ff6fa5', String(hud.moves) + ' movs', '40px "Lilita One", sans-serif', '#fff6ea');
    if (hud.score != null) pill(g, W - 340, py, 300, 84, '#ffc93c', String(hud.score).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' pts', '40px "Lilita One", sans-serif', '#2b1630');
    // marca de agua
    g.fillStyle = 'rgba(255,246,234,.95)';
    g.font = '800 30px "Nunito", system-ui, sans-serif';
    g.fillText(String(hud.footer || 'Cocardo: ¡Rescate Helado! · juego de fans'), W / 2, H - 92, W - 60);
    g.fillStyle = '#ffc93c';
    g.font = '36px "Lilita One", sans-serif';
    g.fillText(String(hud.cta || '¿Puedes tú?'), W / 2, H - 44);
  }

  function tick() {
    if (!rec) return;
    frame(rec);
    if (Date.now() - rec.t0 > MAX_MS) { stop(); return; }
    rec.raf = requestAnimationFrame(tick);
  }

  // opts: { canvas (tablero), hud() -> { title, sub, moves, score, footer, cta }, audio?: MediaStream }
  function start(opts) {
    opts = opts || {};
    if (rec || !supported() || !opts.canvas) return false;
    try {
      var cv = doc.createElement('canvas');
      cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      if (!g) return false;
      var stream = cv.captureStream(FPS);
      if (opts.audio && opts.audio.getAudioTracks) {
        opts.audio.getAudioTracks().forEach(function (tr) { try { stream.addTrack(tr); } catch (e) { /* nada */ } });
      }
      var mime = mimeType();
      var mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 });
      var chunks = [];
      mr.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
      rec = { mr: mr, chunks: chunks, canvas: cv, g: g, src: opts.canvas, hud: opts.hud, raf: 0, t0: Date.now(), mime: mime, stream: stream, done: null };
      logo().then(function () { if (rec && rec.mr === mr) frame(rec); });
      frame(rec);
      mr.start(1000);
      rec.raf = requestAnimationFrame(tick);
      return true;
    } catch (e) {
      rec = null;
      return false;
    }
  }

  // Termina la grabación. Devuelve Promise<File|null> (null si duró menos de 1,5 s o falló)
  function stop() {
    if (!rec) return Promise.resolve(last);
    var r = rec;
    rec = null;
    cancelAnimationFrame(r.raf);
    if (r.done) return r.done;
    r.done = new Promise(function (res) {
      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        try { r.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* nada */ }
        var ms = Date.now() - r.t0;
        if (!r.chunks.length || ms < 1500) { res(null); return; }
        var ext = /mp4/.test(r.mime) ? 'mp4' : 'webm';
        var type = r.mime.split(';')[0];
        try {
          var blob = new Blob(r.chunks, { type: type });
          last = new File([blob], 'cocardo-clip-' + new Date().toISOString().slice(0, 10) + '.' + ext, { type: type });
          lastMeta = { ms: ms, mime: type };
          res(last);
        } catch (e) { res(null); }
      }
      try {
        r.mr.onstop = finish;
        r.mr.onerror = finish;
        if (r.mr.state !== 'inactive') r.mr.stop(); else finish();
      } catch (e) { finish(); }
      setTimeout(finish, 3000);
    });
    return r.done;
  }

  function canShareFile(file) {
    try {
      return !!(file && root.navigator && navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (e) { return false; }
  }
  // Comparte el clip con la hoja nativa (TikTok/IG/WhatsApp) o lo descarga. Devuelve Promise<'shared'|'saved'|'abort'|'fail'>
  function share(file, text) {
    file = file || last;
    if (!file) return Promise.resolve('fail');
    if (canShareFile(file)) {
      return navigator.share({ files: [file], text: text || '', title: 'Cocardo: ¡Rescate Helado!' }).then(function () { return 'shared'; }, function (err) {
        if (err && err.name === 'AbortError') return 'abort';
        return download(file) ? 'saved' : 'fail';
      });
    }
    return Promise.resolve(download(file) ? 'saved' : 'fail');
  }
  // Descarga (fuera de un iframe): enlace temporal con `download`; es la única excepción a la regla de ARQUITECTURA §0
  function download(file) {
    try {
      if (framed() || !root.URL || !URL.createObjectURL) return false;
      var url = URL.createObjectURL(file);
      var a = doc.createElement('a');
      a.href = url;
      a.download = file.name;
      a.rel = 'noopener';
      doc.body.appendChild(a);
      a.click();
      setTimeout(function () { try { a.remove(); URL.revokeObjectURL(url); } catch (e) { /* nada */ } }, 2000);
      return true;
    } catch (e) { return false; }
  }

  function discard() { last = null; lastMeta = null; }

  Cocardo.Clip = {
    _snapshot: function () { try { return rec ? rec.canvas.toDataURL('image/png') : null; } catch (e) { return null; } },
    supported: supported,
    recording: function () { return !!rec; },
    start: start,
    stop: stop,
    last: function () { return last; },
    lastMeta: function () { return lastMeta; },
    share: share,
    download: download,
    discard: discard,
    canShareFile: canShareFile,
    W: W, H: H,
  };
})();
