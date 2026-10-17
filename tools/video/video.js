/* Cocardo — utilidades de navegador para las escenas de video (tools/video/*.html).
   Una escena define window.Escena = { duracion, fps, preparar() -> Promise<{wav}>, dibujar(t) -> dataURL }
   y la graba tools/video/grabar.cjs. Lienzo fijo de 1080x1920 (vertical TikTok/Reels). */
(function () {
  'use strict';
  var W = 1080, H = 1920, SR = 44100;

  // Colores de marca (docs/ARQUITECTURA.md §13)
  var C = {
    ink: '#2b1630', cream: '#fff6ea', mint: '#bff3e1', pink: '#ff6fa5', cherry: '#d61f4b', coco: '#7a4a2a',
    ice: '#bfe9ff', iceDeep: '#4aa8e0', gold: '#ffc93c', drama: '#5b1e74', drama2: '#a1286a', ok: '#33b679',
  };
  var FONT = { display: "'Lilita One', 'Arial Rounded MT Bold', sans-serif", body: "'Nunito', sans-serif",
    script: "'Yellowtail', cursive", mono: "'DejaVu Sans Mono', ui-monospace, monospace" };

  // Zona segura: TikTok tapa la franja derecha (botones) y el 25 % de abajo (texto del post)
  var SAFE = { left: 70, right: 930, top: 210, bottom: 1440 };

  function lienzo() {
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    document.body.appendChild(cv);
    return cv;
  }

  function fuentesListas() {
    var pedidas = ['400 80px "Lilita One"', '900 80px Nunito', '800 80px Nunito', '400 80px Yellowtail'];
    return Promise.all(pedidas.map(function (f) { return document.fonts.load(f); })).then(function () {
      return document.fonts.ready;
    });
  }

  /* ---------- Audio: render sin conexión con js/audio.js y mezcla ---------- */

  // items: [[nombre, opts, segundo], ...]
  function renderSonidos(items, secs) {
    return Cocardo.Audio._render(items, null, secs).then(function (buf) {
      if (!buf) throw new Error('render de audio falló');
      return buf;
    });
  }

  function pista(secs) {
    var n = Math.ceil(secs * SR);
    return [new Float32Array(n), new Float32Array(n)];
  }

  // Suma buf (AudioBuffer) en la pista desde el segundo `en`, con ganancia y fundidos opcionales
  function mezclar(dst, buf, en, o) {
    o = o || {};
    var g = o.gain == null ? 1 : o.gain, fin = o.fadeIn || 0, fout = o.fadeOut || 0;
    var desde = Math.round((o.desde || 0) * SR);
    var largo = Math.min(buf.length - desde, o.dur != null ? Math.round(o.dur * SR) : Infinity);
    var off = Math.round(en * SR);
    for (var ch = 0; ch < 2; ch++) {
      var src = buf.getChannelData(Math.min(ch, buf.numberOfChannels - 1)), d = dst[ch];
      for (var i = 0; i < largo; i++) {
        var j = off + i;
        if (j < 0 || j >= d.length) continue;
        var k = g, ts = i / SR, tr = (largo - i) / SR;
        if (fin && ts < fin) k *= ts / fin;
        if (fout && tr < fout) k *= tr / fout;
        d[j] += src[desde + i] * k;
      }
    }
  }

  /* ---------- Audio de archivo (voces, música): grabar.cjs sirve la raíz del repo ---------- */

  // Descarga y decodifica un audio (WAV, MP3, OGG, FLAC) remuestreado a 44,1 kHz
  function cargarAudio(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('no pude cargar el audio ' + url + ' (' + r.status + ')');
      return r.arrayBuffer();
    }).then(function (ab) {
      return new OfflineAudioContext(2, 1, SR).decodeAudioData(ab);
    });
  }

  // Nivel RMS de un AudioBuffer contando solo bloques de 100 ms con sonido (sobre -50 dBFS)
  function rmsSonoro(buf) {
    var B = SR / 10, acc = 0, n = 0;
    for (var ch = 0; ch < buf.numberOfChannels; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i + B <= d.length; i += B) {
        var s = 0;
        for (var j = i; j < i + B; j++) s += d[j] * d[j];
        if (s / B > 1e-5) { acc += s; n += B; }
      }
    }
    return n ? Math.sqrt(acc / n) : 0;
  }

  // [inicio, fin] en segundos de la parte que suena (sin los silencios de los extremos; umbral -40 dBFS)
  function tramoSonoro(buf, umbral) {
    var u = umbral || 0.01, a = buf.length, b = 0;
    for (var ch = 0; ch < buf.numberOfChannels; ch++) {
      var d = buf.getChannelData(ch), i;
      for (i = 0; i < a; i++) if (Math.abs(d[i]) > u) { a = i; break; }
      for (i = d.length - 1; i > b; i--) if (Math.abs(d[i]) > u) { b = i; break; }
    }
    return a >= b ? [0, buf.duration] : [a / SR, b / SR];
  }

  // Baja la pista a `nivel` en cada tramo [desde, hasta]: bajada antes del tramo y subida después (o.bajada, o.subida).
  // Si dos tramos se pisan no se multiplican: manda el más bajo.
  function atenuar(p, tramos, nivel, o) {
    o = o || {};
    var baja = Math.max(1e-3, o.bajada == null ? 0.08 : o.bajada), sube = Math.max(1e-3, o.subida == null ? 0.25 : o.subida);
    var n = p[0].length;
    if (!tramos.length || nivel >= 1) return;
    var env = new Float32Array(n).fill(1);
    tramos.forEach(function (b) {
      var i0 = Math.max(0, Math.floor((b[0] - baja) * SR)), i1 = Math.min(n, Math.ceil((b[1] + sube) * SR));
      for (var i = i0; i < i1; i++) {
        var tt = i / SR, g = nivel;
        if (tt < b[0]) g = 1 + (nivel - 1) * Math.min(1, (tt - (b[0] - baja)) / baja);
        else if (tt > b[1]) g = nivel + (1 - nivel) * Math.min(1, (tt - b[1]) / sube);
        if (g < env[i]) env[i] = g;
      }
    });
    for (var ch = 0; ch < 2; ch++) for (var i = 0; i < n; i++) p[ch][i] *= env[i];
  }

  function mono(p) {
    var m = new Float32Array(p[0].length);
    for (var i = 0; i < m.length; i++) m[i] = 0.5 * (p[0][i] + p[1][i]);
    return m;
  }

  // Lleva el pico de la mezcla a `objetivo` (evita recortes en el WAV; el volumen final lo fija ffmpeg)
  function normalizar(p, objetivo) {
    var pk = 1e-6;
    for (var ch = 0; ch < 2; ch++) for (var i = 0; i < p[ch].length; i++) pk = Math.max(pk, Math.abs(p[ch][i]));
    var g = (objetivo || 0.5) / pk;
    for (ch = 0; ch < 2; ch++) for (i = 0; i < p[ch].length; i++) p[ch][i] *= g;
    return pk;
  }

  // WAV PCM 16 bits estéreo en base64
  function wavBase64(p) {
    var n = p[0].length, bytes = 44 + n * 4, ab = new ArrayBuffer(bytes), v = new DataView(ab);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, bytes - 8, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, SR, true);
    v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data');
    v.setUint32(40, n * 4, true);
    for (var i = 0, o = 44; i < n; i++) {
      for (var ch = 0; ch < 2; ch++, o += 2) {
        var s = Math.max(-1, Math.min(1, p[ch][i]));
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
    }
    var u8 = new Uint8Array(ab), out = '', CH = 0x8000;
    for (var k = 0; k < u8.length; k += CH) out += String.fromCharCode.apply(null, u8.subarray(k, k + CH));
    return btoa(out);
  }

  /* ---------- Dibujo ---------- */

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Texto tipo sticker: relleno con contorno grueso y sombra dura
  function texto(ctx, s, x, y, o) {
    o = o || {};
    var size = o.size || 80;
    ctx.save();
    ctx.font = (o.weight || '400') + ' ' + size + 'px ' + (o.font || FONT.display);
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    var maxW = o.maxW || 0;
    if (maxW) {
      var w = ctx.measureText(s).width;
      if (w > maxW) {
        size = Math.floor(size * maxW / w);
        ctx.font = (o.weight || '400') + ' ' + size + 'px ' + (o.font || FONT.display);
      }
    }
    if (o.sombra !== false) {
      ctx.fillStyle = o.sombraColor || 'rgba(43,22,48,0.55)';
      var sd = o.sombraDist == null ? Math.max(4, size * 0.07) : o.sombraDist;
      if (o.stroke !== false) {
        ctx.lineWidth = o.strokeW || Math.max(6, size * 0.16);
        ctx.strokeStyle = o.sombraColor || 'rgba(43,22,48,0.55)';
        ctx.strokeText(s, x, y + sd);
      }
      ctx.fillText(s, x, y + sd);
    }
    if (o.stroke !== false) {
      ctx.lineWidth = o.strokeW || Math.max(6, size * 0.16);
      ctx.strokeStyle = o.stroke || C.ink;
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = o.fill || C.cream;
    ctx.fillText(s, x, y);
    ctx.restore();
    return size;
  }

  // Toldo a rayas con borde ondulado (fachada de la heladería)
  function toldo(ctx, a, b, alto) {
    var ancho = 90, r = ancho / 2;
    for (var i = 0; i * ancho < W; i++) {
      ctx.fillStyle = i % 2 ? b : a;
      ctx.fillRect(i * ancho, 0, ancho, alto);
      ctx.beginPath();
      ctx.arc(i * ancho + r, alto, r, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(43,22,48,0.18)';
    ctx.fillRect(0, alto - 8, W, 8);
  }

  function fondo(ctx, color, color2) {
    var g = ctx.createRadialGradient(W / 2, H * 0.42, 80, W / 2, H * 0.42, H * 0.75);
    g.addColorStop(0, color2 || color);
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillRect(-80, -80, W + 160, H + 160);   // margen para zoom y temblor
    // puntitos de helado (chispas) muy suaves
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < 70; i++) {
      var x = (i * 389) % W, y = (i * 677) % H;
      rr(ctx, x, y, 34, 12, 6);
      ctx.save(); ctx.translate(x, y); ctx.rotate((i % 7) * 0.5); ctx.translate(-x, -y);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // Analizador: bloques de pico cada 10 ms para el auto-volumen del osciloscopio
  function analizar(m) {
    var B = Math.round(SR / 100), n = Math.ceil(m.length / B), pk = new Float32Array(n);
    for (var b = 0; b < n; b++) {
      var mx = 0;
      for (var i = b * B, e = Math.min(m.length, i + B); i < e; i++) { var a = Math.abs(m[i]); if (a > mx) mx = a; }
      pk[b] = mx;
    }
    return { m: m, pk: pk, B: B };
  }

  // Osciloscopio: ventana de ~32 ms con disparo en cruce por cero, como uno de verdad
  function osciloscopio(ctx, an, t, x, y, w, h, color, o) {
    o = o || {};
    ctx.save();
    rr(ctx, x, y, w, h, 36);
    ctx.fillStyle = o.panel || 'rgba(43,22,48,0.88)';
    ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.clip();
    // cuadrícula
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2;
    for (var gx = 1; gx < 8; gx++) { ctx.beginPath(); ctx.moveTo(x + gx * w / 8, y); ctx.lineTo(x + gx * w / 8, y + h); ctx.stroke(); }
    for (var gy = 1; gy < 4; gy++) { ctx.beginPath(); ctx.moveTo(x, y + gy * h / 4); ctx.lineTo(x + w, y + gy * h / 4); ctx.stroke(); }
    var m = an.m, s = Math.floor(t * SR), WIN = o.ventana || 1400;
    var k = s;
    for (var j = s + 1; j < s + 900 && j < m.length; j++) { if (m[j - 1] <= 0 && m[j] > 0) { k = j; break; } }
    // ganancia automática suave: pico en ±80 ms
    var b0 = Math.max(0, Math.floor(s / an.B) - 8), b1 = Math.min(an.pk.length - 1, Math.floor(s / an.B) + 8), pk = 0;
    for (var b = b0; b <= b1; b++) pk = Math.max(pk, an.pk[b]);
    var g = 0.88 / Math.max(pk, 0.06);
    var cy = y + h / 2, amp = h / 2 - 26;
    ctx.beginPath();
    for (var i = 0; i < WIN; i++) {
      var v = k + i < m.length ? m[k + i] * g : 0;
      v = Math.max(-1.05, Math.min(1.05, v));
      var px = x + 18 + (w - 36) * i / (WIN - 1), py = cy - v * amp;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = 28;
    ctx.strokeStyle = color; ctx.lineWidth = 9; ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }

  // Barras de volumen del tramo [t0, t1] con cabezal en t
  function barras(ctx, an, t0, t1, t, x, y, w, h, color) {
    var N = 48, gap = 6, bw = (w - gap * (N - 1)) / N, m = an.m;
    var vals = [], mx = 1e-4;
    for (var i = 0; i < N; i++) {
      var a = Math.floor((t0 + (t1 - t0) * i / N) * SR), e = Math.floor((t0 + (t1 - t0) * (i + 1) / N) * SR), acc = 0, n = 0;
      for (var j = a; j < e && j < m.length; j += 4) { acc += m[j] * m[j]; n++; }
      var r = Math.sqrt(acc / Math.max(1, n));
      vals.push(r); if (r > mx) mx = r;
    }
    var hecho = (t - t0) / (t1 - t0);
    for (var q = 0; q < N; q++) {
      var bh = Math.max(8, h * Math.sqrt(vals[q] / mx));
      ctx.fillStyle = (q + 0.5) / N <= hecho ? color : 'rgba(43,22,48,0.25)';
      rr(ctx, x + q * (bw + gap), y + (h - bh) / 2, bw, bh, Math.min(bw / 2, 6));
      ctx.fill();
    }
  }

  function chip(ctx, s, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.font = '700 ' + (o.size || 32) + 'px ' + FONT.mono;
    var w = ctx.measureText(s).width + 56, h = (o.size || 32) + 34;
    rr(ctx, x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fillStyle = o.bg || 'rgba(43,22,48,0.9)'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = o.borde || 'rgba(255,255,255,0.35)'; ctx.stroke();
    ctx.fillStyle = o.fill || C.mint;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y + 2);
    ctx.restore();
  }

  // Rebote de "pop": escala 0 -> 1 con sobrepaso (easeOutBack)
  function pop(dt, dur) {
    if (dt <= 0) return 0;
    var x = Math.min(1, dt / (dur || 0.18)) - 1, c1 = 2.2;
    return 1 + (c1 + 1) * x * x * x + c1 * x * x;
  }

  // Pseudoaleatorio estable por fotograma (temblor de cámara)
  function hash(n) { var x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }

  window.Video = {
    W: W, H: H, SR: SR, C: C, FONT: FONT, SAFE: SAFE,
    lienzo: lienzo, fuentesListas: fuentesListas,
    renderSonidos: renderSonidos, pista: pista, mezclar: mezclar, mono: mono, normalizar: normalizar,
    wavBase64: wavBase64, cargarAudio: cargarAudio, rmsSonoro: rmsSonoro, tramoSonoro: tramoSonoro, atenuar: atenuar,
    rr: rr, texto: texto, toldo: toldo, fondo: fondo, analizar: analizar, osciloscopio: osciloscopio,
    barras: barras, chip: chip, pop: pop, hash: hash,
  };
})();
