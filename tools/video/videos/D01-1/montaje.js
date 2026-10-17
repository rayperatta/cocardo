/* D01-1 «La mejor jugada» (F01, ♻ del 03 cascada.js) con la plantilla tools/video/formatos/F01/plantilla.js.
   Toma: dist/cap/D01-1-cascada = formatos/F01/tomas/cascada.cjs --var 4:2465:7,2:7,3:4,5:5,5:6,6:7,6
   (nivel 4, semilla 2465: 18 cascadas, 15 de 16 hielos; dos jugadas después cae el último y sobran 19).
   Cifras: 1.220.992 aperturas probadas (niveles 1 a 30, semillas 1 a 5000) y esta es la única de 16 cascadas o más:
   node tools/video/formatos/F01/ficha.cjs conteo. Contador a la vista: el reto es «¿Le ganas a las 18?».
   Cuadro 0 con la mano ya en el tablero → 18 cascadas → «¡faltó UNO!» (risa de Cocardo) → 2 jugadas en x3 →
   el último hielo en cámara lenta (clímax, ≈ 68 %) → Helado Final → reto → tarjeta que sube al cuadro 0. */
(function () {
  'use strict';
  var s = document.createElement('script');
  s.src = 'formatos/F01/plantilla.js';
  s.onerror = function () { window.__error = 'no se pudo cargar formatos/F01/plantilla.js'; };
  s.onload = function () {
    var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E, XC = F01.XC;
    var ICE = 0;
    F01.montar({
      toma: 'D01-1-cascada',
      nivel: 4,
      cascadas: 18,
      contador: 'vista',
      gancho: ['Probé 1.220.992 jugadas…', 'y esta fue la MEJOR'],
      ganchoSub: 'nivel 4 · primera jugada',
      ganchoHasta: 1.75,
      retratos: [['cocardo', 'carcajada']],
      tramos: [
        // tensión: se congela, zoom al hielo que quedó y Cocardo se ríe
        { nombre: 'falto', congelado: 1.25, trans: 'golpe', musica: false,
          cam: [[0, { z: 1, x: 540, y: 960 }], [0.45, { z: 1.14, x: 760, y: 870 }, 'out']],
          sfx: [['rayon', 0, { v: 1.2 }], ['golpe', 0.02, { v: 0.6 }]],
          extra: [['laugh', { who: 'cocardo' }, 0.27, 1.2]],
          dibujar: function (ctx, t, x) {
            ctx.fillStyle = 'rgba(30,8,40,0.35)'; ctx.fillRect(0, 0, W, H);
            K.sombraArriba(0.85, 640);
            var q = x.celda(0, 7);
            K.anillo(t, x.de + 0.1, q.x, q.y, 92, C.pink);
            K.palabras(t, x.de + 0.03, '15 de 16 hielos…', XC, 290, { size: 86, maxW: 820, resalta: false, hasta: x.a });
            K.popTexto(t, x.de + 0.45, '¡faltó UNO!', XC, 415, { size: 128, maxW: 820, fill: C.pink, strokeW: 24, rot: -0.04, hasta: x.a });
            var coc = K.retrato('cocardo', 'carcajada');
            if (coc.complete && t > x.de + 0.15) {
              var e = K.p(t, x.de + 0.15, x.de + 0.4, E.back), sal = K.p(t, x.a - 0.2, x.a, E.in), bob = Math.sin(t * 22) * 8;
              ctx.drawImage(coc, -60, 1250 + (1 - e) * 500 + sal * 500 + bob, 560, 560);
            }
          } },
        // las dos jugadas que faltan, a toda velocidad (con sus sonidos)
        { nombre: 'x3', src: 10.0, hasta: 14.2, vel: 3, trans: 'barrido', vol: 0.75,
          dibujar: function (ctx, t, x) {
            K.sombraArriba(0.75, 640);
            K.popTexto(t, x.de + 0.05, '2 jugadas después…', XC, 330, { size: 90, maxW: 820, strokeW: 18, hasta: x.a });
            K.popTexto(t, x.de + 0.22, '▶▶ x3', XC, 445, { font: F.body, weight: '900', size: 56, fill: C.gold, strokeW: 12, hasta: x.a });
          } },
        // clímax: el último hielo en cámara lenta
        { nombre: 'ultimo', vel: [[14.2, 15.42, 1], [15.42, 15.75, 0.35], [15.75, 16.35, 1]], rampa: 0.06,
          cam: [[0, { z: 1, x: 540, y: 960 }], [1.0, { z: 1, x: 540, y: 960 }], [1.45, { z: 1.12, x: 760, y: 870 }, 'out'],
            [2.25, { z: 1.12, x: 760, y: 870 }], [2.7, { z: 1, x: 540, y: 960 }]],
          bajar: [[1.15, 2.2, 0.35]],
          antes: function (x) {
            var ice = x.ev('ice');
            ICE = ice.length ? ice[ice.length - 1] : x.de + 1.65;
            x.temblor(ICE, 18, 0.45);
            x.sfx('golpe', ICE, { v: 0.9 });
            x.sfx('subida', ICE - 0.7, { dur: 0.68, v: 0.5 });
          },
          dibujar: function (ctx, t, x) {
            var q = x.celda(0, 7);
            if (t < ICE) {
              K.anillo(t, x.de + 1.0, q.x, q.y, 82, C.ice);
              K.sombraArriba(0.7 * K.p(t, x.de + 0.85, x.de + 1.0), 600);
              K.popTexto(t, x.de + 0.9, '¿y el último hielo…?', XC, 330, { size: 84, maxW: 820, fill: C.ice, strokeW: 17, hasta: ICE });
            }
            K.sombraArriba(0.75 * K.p(t, ICE - 0.1, ICE + 0.1), 640);
            K.flash(t, ICE, 0.25, '#fff', 0.45);
            F01.confeti(ctx, t, ICE, q.x, q.y, { n: 90, fuerza: 0.85 });
            K.popTexto(t, ICE, '¡EL ÚLTIMO!', XC, 400, { size: 128, maxW: 820, fill: C.gold, strokeW: 24, rot: -0.04 });
          } },
        // alivio: ¡Helado Final! (los 19 movimientos que sobran se vuelven Paletas)
        { nombre: 'paletas', src: 16.75, hasta: 20.45, vel: 1.6, trans: 'golpe',
          dibujar: function (ctx, t, x) {
            K.sombraArriba(0.9 * K.p(t, x.de, x.de + 0.2), 700);
            ctx.save(); ctx.globalAlpha = K.p(t, x.de, x.de + 0.12); K.placa(XC, 348, 890, 240, 0.8); ctx.restore();
            K.palabras(t, x.de + 0.1, '¡Sobraron 19 movimientos!', XC, 290, { size: 72, maxW: 860, resalta: false, ritmo: 0.07 });
            K.popTexto(t, x.de + 0.7, '¡cada uno, una PALETA!', XC, 405, { size: 104, maxW: 840, fill: C.pink, strokeW: 20, rot: -0.03 });
          } },
      ],
      reto: { texto: '¿Le ganas a las 18?', src: 21.1, dur: 1.3, trans: 'golpe' },
      tarjeta: { moodCocardo: 'llorando' },
    });
  };
  document.body.appendChild(s);
})();
