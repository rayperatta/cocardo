/* Video: «Hice a TODOS los personajes de Cocardo para mi juego». Solo arte del juego (retratos SVG), sin tomas.
   Todo va al compás de la cumbia del juego (3 tiempos por personaje). Las víctimas salen congeladas y rompen el hielo. */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E, V = K.V;
  var B = K.BEAT, D = 3 * B;              // 1,73 s por personaje
  var T0 = D;                             // gancho de 3 tiempos
  var REP = [
    { id: 'cocardo', nombre: 'Cocardo', tag: 'el heladero', a: 'burlon', b: 'carcajada', linea: 'No está viejo, está experimentado.', c1: '#6e3f22', c2: '#c58b5a' },
    { id: 'lima', nombre: 'Lima', tag: 'su amor', b: 'enojado', linea: 'Ya no más.', c1: '#3f9a1e', c2: '#b9ee7a', vic: true },
    { id: 'cereza', nombre: 'Cherry', tag: 'la socia', a: 'coqueta', b: 'burlon', linea: 'Yo vi una oportunidad.', c1: '#a3123a', c2: '#ff6f93' },
    { id: 'pina', nombre: 'Don Piña', tag: 'el millonario', a: 'normal', b: 'feliz', linea: 'Consígueme 5 y tenemos un trato.', c1: '#7b1f33', c2: '#e0a92a' },
    { id: 'banano', nombre: 'Banano', tag: 'el investigador', a: 'enojado', b: 'sorprendido', linea: 'Mi hermana también era banana.', c1: '#2f2a24', c2: '#c9a43a' },
    { id: 'banana', nombre: 'Banana', tag: 'su hermana', b: 'feliz', linea: 'Gracias por venir por mí.', c1: '#c79a00', c2: '#ffe680', vic: true },
    { id: 'fresa', nombre: 'Fresa', tag: 'la prima de Lima', b: 'feliz', linea: 'Vine a ver a mi prima Lima.', c1: '#c4163c', c2: '#ff8aa0', vic: true },
    { id: 'durazna', nombre: 'Durazna', tag: 'la clienta', b: 'sorprendido', linea: '¿Helado gratis de por vida?', c1: '#d9622b', c2: '#ffc39a', vic: true },
    { id: 'uva', nombre: 'Uva', tag: 'la nueva', b: 'asustado', linea: 'Un hombre me encerró en un congelador.', c1: '#4b1f8a', c2: '#b48af0', vic: true },
    { id: 'naranja', nombre: 'Naranja', tag: 'la vecina', b: 'feliz', ret: { variant: 'panecitos' }, linea: 'Vecina, te traje panecitos calientitos.', c1: '#d2600a', c2: '#ffb25e', vic: true },
  ];
  var SEC = ['limon', 'policia_fresa', 'policia_sandia', 'guardaespaldas', 'brocoli', 'reportera'];
  var TODOS = REP.map(function (r) { return r.id; }).concat(SEC);
  var T_SEC = T0 + REP.length * D, T_MOS = T_SEC + D, T_FIN = T_MOS + D, DUR = T_FIN + 2.5;
  var DESHIELO = 0.3;                     // fracción del tramo en que la víctima rompe el hielo
  var CPS = 46;

  function moodA(r) { return r.vic ? 'asustado' : r.a; }

  // esquirlas de hielo al romperse
  function esquirlas(ctx, t0, t, cx, cy) {
    var d = t - t0;
    if (d < 0 || d > 0.9) return;
    ctx.save();
    for (var i = 0; i < 26; i++) {
      var a = V.hash(i * 7.3) * Math.PI * 2, v = 700 + V.hash(i * 3.1) * 900, s = 18 + V.hash(i * 5.7) * 34;
      var x = cx + Math.cos(a) * v * d, y = cy + Math.sin(a) * v * d + 1400 * d * d;
      ctx.globalAlpha = Math.max(0, 1 - d / 0.9);
      ctx.translate(x, y); ctx.rotate(a + d * 8);
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, s * 0.4); ctx.lineTo(-s * 0.5, s * 0.6); ctx.closePath();
      ctx.fillStyle = i % 3 ? '#dff6ff' : '#9fdcff'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(43,22,48,0.5)'; ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.restore();
  }

  function fondo(ctx, c1, c2, t) {
    var g = ctx.createRadialGradient(W / 2, 900, 120, W / 2, 900, 1250);
    g.addColorStop(0, c2); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // rayos suaves que giran
    ctx.save(); ctx.globalAlpha = 0.1; ctx.translate(W / 2, 900); ctx.rotate(t * 0.2); ctx.fillStyle = '#fff';
    for (var i = 0; i < 14; i++) { ctx.rotate(Math.PI * 2 / 14); if (i % 2) continue; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-110, -1600); ctx.lineTo(110, -1600); ctx.fill(); }
    ctx.restore();
    V.toldo(ctx, C.pink, '#ffffff', 120);
  }

  function burbuja(ctx, texto, t, t0) {
    if (t < t0) return;
    var e = K.p(t, t0, t0 + 0.18, E.back), n = Math.floor((t - t0) * CPS), vis = texto.slice(0, Math.max(0, n));
    ctx.save(); ctx.translate(500, 1330); ctx.scale(e, e);
    ctx.font = '800 56px ' + F.body;
    var w = Math.min(860, ctx.measureText(texto).width + 80), h = 112;
    if (ctx.measureText(texto).width + 80 > 860) h = 172;
    V.rr(ctx, -w / 2, -h / 2, w, h, 40); ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 9; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-60, -h / 2 + 2); ctx.lineTo(-20, -h / 2 - 46); ctx.lineTo(0, -h / 2 + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.cream; ctx.fillRect(-58, -h / 2 - 4, 56, 12);
    ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if (h > 120) {
      var pal = texto.split(' '), l1 = '', i = 0;
      while (i < pal.length && ctx.measureText(l1 + pal[i] + ' ').width < w - 80) { l1 += pal[i] + ' '; i++; }
      var x0 = -w / 2 + 40;
      ctx.fillText(vis.slice(0, l1.length), x0, -30);
      ctx.fillText(vis.slice(l1.length), x0, 34);
    } else ctx.fillText(vis, -w / 2 + 40, 2);
    ctx.restore();
  }

  function personaje(ctx, t, i) {
    var r = REP[i], t0 = T0 + i * D, d = t - t0;
    fondo(ctx, r.c1, r.c2, t);
    var ent = K.p(t, t0, t0 + 0.22, E.back), bob = Math.sin(d * 5) * 8;
    var deshielo = t0 + DESHIELO * D, cambio = r.vic ? deshielo : t0 + 0.5 * D;
    var mood = t < cambio ? moodA(r) : r.b;
    var opts = Object.assign({}, r.ret || {});
    if (r.vic && t < deshielo) opts.frozen = true;
    var img = K.retrato(r.id, mood, opts);
    var pk = t >= cambio ? 1 + 0.08 * Math.max(0, 1 - (t - cambio) / 0.16) : 1;
    var tem = r.vic && t < deshielo && d > 0.15 ? Math.sin(t * 90) * 5 * K.p(t, t0 + 0.15, deshielo) : 0;
    if (img.complete) {
      var s = 860 * ent * pk;
      ctx.drawImage(img, 540 - s / 2 + tem, 900 - s / 2 + bob + (1 - ent) * 300, s, s);
    }
    if (r.vic) {
      K.flash(t, deshielo, 0.18, '#e9f8ff', 0.85);
      esquirlas(ctx, deshielo, t, 540, 860);
    }
    K.popTexto(t, t0 + 0.05, r.nombre, W / 2, 300, { size: 150, strokeW: 26, rot: -0.03 });
    K.popTexto(t, t0 + 0.14, r.tag, W / 2, 425, { font: F.body, weight: '900', size: 56, fill: C.gold, strokeW: 13 });
    burbuja(ctx, r.linea, t, (r.vic ? deshielo + 0.05 : t0 + 0.4));
    // barrido de salida
    if (d > D - 0.1) { ctx.fillStyle = 'rgba(255,255,255,' + (0.6 * K.p(t, t0 + D - 0.1, t0 + D)) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function mosaico(ctx, t, t0, ids, cols, y0, tam, conNombre) {
    var filas = Math.ceil(ids.length / cols);
    ids.forEach(function (id, k) {
      var c = k % cols, f = Math.floor(k / cols), tt = t0 + k * 0.045, e = K.p(t, tt, tt + 0.2, E.back);
      if (e <= 0) return;
      var x = W / 2 + (c - (cols - 1) / 2) * tam, y = y0 + (f - (filas - 1) / 2) * tam;
      var img = K.retrato(id, id === 'cocardo' ? 'carcajada' : 'feliz');
      ctx.save(); ctx.translate(x, y); ctx.scale(e, e);
      ctx.beginPath(); ctx.arc(0, 0, tam * 0.46, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
      ctx.lineWidth = 8; ctx.strokeStyle = C.ink; ctx.stroke();
      ctx.save(); ctx.clip(); if (img.complete) ctx.drawImage(img, -tam * 0.55, -tam * 0.5, tam * 1.1, tam * 1.1); ctx.restore();
      ctx.restore();
    });
  }

  var sfx = [['subida', 0, { dur: T0 - 0.05, v: 0.6 }]], extra = [];
  REP.forEach(function (r, i) {
    var t0 = T0 + i * D;
    sfx.push(['whoosh', t0 - 0.08, { v: 0.8 }]);
    if (r.vic) { extra.push(['ice', { hp: 0 }, t0 + DESHIELO * D, 1.3]); extra.push(['frost', {}, t0 + DESHIELO * D + 0.04, 1]); }
    else sfx.push(['pop', t0 + 0.5 * D, { f: 520 }]);
    var tb = (r.vic ? t0 + DESHIELO * D + 0.05 : t0 + 0.4);
    for (var k = 0; k < r.linea.length; k += 3) extra.push(['blip', { who: r.id }, tb + k / CPS, 1]);
  });
  SEC.forEach(function (id, k) { sfx.push(['pop', T_SEC + k * B / 2, { f: 500 + k * 90 }]); });
  sfx.push(['whoosh', T_MOS - 0.08, {}], ['golpe', T_MOS, { v: 0.5 }], ['whoosh', T_FIN - 0.08, {}]);
  for (var q = 0; q < 10; q++) sfx.push(['pop', 0.08 + q * 0.12, { f: 600 + q * 60, v: 0.6 }]);

  K.montaje({
    dur: DUR,
    antes: function () {
      TODOS.forEach(function (id) { K.retrato(id, id === 'cocardo' ? 'carcajada' : 'feliz'); });
      REP.forEach(function (r) {
        var o = Object.assign({}, r.ret || {});
        K.retrato(r.id, r.b, o);
        if (r.vic) K.retrato(r.id, 'asustado', Object.assign({ frozen: true }, o)); else K.retrato(r.id, r.a, o);
      });
    },
    capas: function (ctx, t) {
      if (t < T0) {
        fondo(ctx, C.drama, C.drama2, t);
        mosaico(ctx, t, 0.08, REP.map(function (r) { return r.id; }), 4, 1020, 250);
        K.palabras(t, 0.0, 'Hice a TODOS los personajes', W / 2, 290, { size: 70, maxW: 1000, ritmo: 0.08 });
        K.palabras(t, 0.4, 'de Cocardo para mi juego', W / 2, 395, { size: 70, maxW: 1000, ritmo: 0.08, colorResalta: C.pink });
        return;
      }
      if (t < T_SEC) { personaje(ctx, t, Math.min(REP.length - 1, Math.floor((t - T0) / D))); return; }
      if (t < T_MOS) {
        var k = Math.min(SEC.length - 1, Math.floor((t - T_SEC) / (B / 2)));
        fondo(ctx, '#1f5f7a', '#7fd0e8', t);
        var img = K.retrato(SEC[k], 'feliz');
        var e = V.pop(t - (T_SEC + k * B / 2), 0.12);
        if (img.complete) ctx.drawImage(img, 540 - 400 * e, 900 - 400 * e, 800 * e, 800 * e);
        K.popTexto(t, T_SEC, '…y 6 más', W / 2, 330, { size: 130, strokeW: 24, sinPop: false });
        return;
      }
      if (t < T_FIN) {
        fondo(ctx, C.drama, C.drama2, t);
        mosaico(ctx, t, T_MOS, TODOS, 4, 960, 225);
        K.palabras(t, T_MOS + 0.15, '¿Quién es tu favorito?', W / 2, 300, { size: 96, maxW: 980 });
        return;
      }
      K.tarjetaFinal(t, T_FIN, { moodCocardo: 'carcajada' });
    },
    audio: {
      extra: extra,
      sfx: sfx,
      musica: [{ t0: 0, t1: DUR, desde: 0, gain: 1.15, fadeOut: 1.0 }],
    },
  });
})();
