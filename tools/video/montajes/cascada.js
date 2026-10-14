/* Video: «La mejor jugada entre 472.206». Toma: tools/video/tomas/cascada.cjs (nivel 4, semilla 2465).
   Gancho congelado → 18 cascadas con contador → «¡faltó UNO!» (congelado + risa de Cocardo) → 2 jugadas en x3 →
   último hielo en cámara lenta → ¡Helado Final! → estrellas → tarjeta final. */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, E = K.E;
  var CASC = [], ICE = 0, TEMBLOR = [];

  K.montaje({
    dur: 24.4,
    tomas: { a: 'cascada' },
    clips: [
      { toma: 'a', de: 0, a: 1.1, src: 0.9, vel: [[0, 0]], mudo: true, dedo: false,
        cam: [[0, { z: 1, x: 540, y: 1000 }], [1.1, { z: 1.06, x: 540, y: 1000 }, 'out']] },
      { toma: 'a', de: 1.1, a: 9.95, src: 0.95, vel: [[0, 1], [7.75, 1], [7.95, 0.55]],
        cam: [[1.1, { z: 1.06, x: 540, y: 1000 }], [1.5, { z: 1, x: 540, y: 1000 }, 'out'], [9.0, { z: 1.03, x: 540, y: 1000 }]] },
      { toma: 'a', de: 9.95, a: 11.35, src: 9.45, vel: [[0, 0]], mudo: true, trans: 'golpe',
        cam: [[9.95, { z: 1, x: 540, y: 1000 }], [10.4, { z: 1.14, x: 760, y: 1000 }, 'out']] },
      { toma: 'a', de: 11.35, a: 12.85, src: 10.0, vel: [[0, 3]], mudo: true, trans: 'barrido' },
      { toma: 'a', de: 12.85, a: 15.0, src: 14.5, vel: [[0, 1], [0.9, 1], [1.0, 0.4], [1.55, 0.4], [1.7, 1]],
        cam: [[12.85, { z: 1, x: 540, y: 1000 }], [13.9, { z: 1.1, x: 760, y: 900 }], [14.6, { z: 1, x: 540, y: 1000 }]] },
      { toma: 'a', de: 15.0, a: 19.4, src: 16.25 },
      { toma: 'a', de: 19.4, a: 21.9, src: 21.05, trans: 'golpe' },
    ],
    antes: function () {
      CASC = K.eventos('match', function (s, c) { return c.de === 1.1; });
      var ice = K.eventos('ice', function (s, c) { return c.de === 12.85; });
      ICE = ice.length ? ice[0].t : 14.1;
      CASC.forEach(function (e, i) { if (i >= 9) TEMBLOR.push([e.t, 4 + (i - 9) * 1.2, 0.25]); });
      TEMBLOR.push([ICE, 18, 0.45]);
      K.eventos('paleta').forEach(function (e) { TEMBLOR.push([e.t, 7, 0.25]); });
      K.M.temblor = TEMBLOR;
      K.retrato('cocardo', 'carcajada');
    },
    capas: function (ctx, t) {
      // gancho
      if (t < 1.1) {
        ctx.fillStyle = 'rgba(30,8,40,' + (0.62 * (1 - K.p(t, 0.95, 1.1))) + ')';
        ctx.fillRect(0, 0, W, K.H);
        K.palabras(t, 0.0, 'Probé 472.206 jugadas…', W / 2, 380, { size: 84, maxW: 980, hasta: 1.1, resalta: false });
        K.palabras(t, 0.42, 'y esta fue la MEJOR', W / 2, 520, { size: 100, maxW: 980, hasta: 1.1, ritmo: 0.09 });
        K.popTexto(t, 0.75, 'nivel 4 · primera jugada', W / 2, 650, { font: F.body, weight: '900', size: 46, fill: C.mint, strokeW: 11, hasta: 1.1 });
      }
      // contador de cascadas
      if (t >= 1.1 && t < 9.95) {
        var n = 0, t0 = 0;
        CASC.forEach(function (e) { if (t >= e.t) { n = e.opts.cascade || n + 1; t0 = e.t; } });
        if (n) {
          var col = n < 6 ? C.gold : n < 12 ? C.pink : '#ff4f4f';
          var kb = K.p(t, CASC[0].t, CASC[0].t + 0.2, E.back);
          K.placa(W / 2, 425, 380 * kb, 250 * kb, 0.72);
          K.popTexto(t, CASC[0].t, 'CASCADAS', W / 2, 372, { font: F.body, weight: '900', size: 42, fill: C.cream, strokeW: 11, sinPop: true });
          K.contador(t, t0, n, W / 2, 462, col);
          if (n === 18) K.flash(t, t0, 0.22, '#fff', 0.7);
        }
      }
      // ¡faltó uno!
      if (t >= 9.95 && t < 11.35) {
        ctx.fillStyle = 'rgba(30,8,40,0.35)'; ctx.fillRect(0, 0, W, K.H);
        K.sombraArriba(0.8, 640);
        var info = K.M.clips[2]._info;
        if (info) { var c07 = K.celda('a', 0, 7), p = K.aPantalla(info, c07.x, c07.y); K.anillo(t, 10.05, p.x, p.y, 95, C.pink); }
        K.palabras(t, 9.98, '15 de 16 hielos…', W / 2, 330, { size: 88, resalta: false, hasta: 11.35 });
        K.popTexto(t, 10.4, '¡faltó UNO!', W / 2, 455, { size: 128, fill: C.pink, strokeW: 24, rot: -0.04, hasta: 11.35 });
        var coc = K.retrato('cocardo', 'carcajada');
        if (coc.complete && t > 10.15) {
          var e = K.p(t, 10.15, 10.4, E.back), sal = K.p(t, 11.15, 11.35, E.in), bob = Math.sin(t * 22) * 8;
          ctx.drawImage(coc, -60, 1250 + (1 - e) * 500 + sal * 500 + bob, 560, 560);
        }
      }
      if (t >= 11.35 && t < 12.85) {
        K.sombraArriba(0.75, 680);
        K.popTexto(t, 11.4, '2 jugadas después…', W / 2, 420, { size: 92, fill: C.cream, strokeW: 18, hasta: 12.85 });
        K.popTexto(t, 11.55, '▶▶ x3', W / 2, 530, { font: F.body, weight: '900', size: 52, fill: C.gold, strokeW: 12, hasta: 12.85 });
      }
      if (t >= 12.85 && t < 15.0) {
        K.sombraArriba(0.7 * K.p(t, ICE - 0.1, ICE + 0.1), 640);
        K.flash(t, ICE, 0.2, '#fff', 0.55);
        K.popTexto(t, ICE, '¡EL ÚLTIMO!', W / 2, 440, { size: 128, fill: C.gold, strokeW: 24, rot: -0.04, hasta: 15.0 });
      }
      if (t >= 15.0 && t < 19.4) {
        K.sombraArriba(0.8 * K.p(t, 15.0, 15.3) * (1 - K.p(t, 19.2, 19.4)), 660);
        K.palabras(t, 15.25, 'Cada movimiento que sobra', W / 2, 360, { size: 62, maxW: 980, resalta: false, hasta: 19.4 });
        K.popTexto(t, 16.2, '¡es una PALETA!', W / 2, 465, { size: 104, fill: C.pink, strokeW: 20, rot: -0.03, hasta: 19.4 });
      }
      if (t >= 20.3 && t < 21.9) {
        K.palabras(t, 20.3, '¿Tu récord de cascadas?', W / 2, 330, { size: 80, maxW: 980, hasta: 21.9 });
      }
      if (t >= 21.9) K.tarjetaFinal(t, 21.9, { moodCocardo: 'llorando' });
    },
    audio: {
      juego: 1,
      extra: [['laugh', { who: 'cocardo' }, 10.22, 1.2]],
      sfx: [['subida', 0.0, { dur: 1.05, v: 0.8 }], ['whoosh', 1.02, {}], ['rayon', 9.95, { v: 1.2 }], ['golpe', 9.97, { v: 0.6 }],
        ['whoosh', 11.33, {}], ['golpe', 14.1, { v: 0.9 }], ['whoosh', 19.38, { v: 0.7 }], ['whoosh', 21.88, {}], ['pop', 22.25, { f: 600 }],
        ['pop', 22.6, { f: 800 }]],
      musica: [
        { t0: 1.1, t1: 9.95, desde: 0, gain: 1.0, fadeOut: 0.03 },
        { t0: 11.35, t1: 24.4, desde: 10.25, gain: 1.0, fadeIn: 0.05, fadeOut: 0.9, bajar: [[13.9, 15.0, 0.35]] },
      ],
    },
  });
})();
