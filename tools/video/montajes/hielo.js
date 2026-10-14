/* Video: «ASMR: rompiendo hielo 🧊». Toma: tools/video/tomas/nivel.cjs --var 12:1:0:8:60 (nivel 12, capas de hielo).
   Sin música: solo los sonidos del juego, con el crujido del hielo al frente. Cámara cerca del hielo. */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E;
  var T_J = 1.6, juego = K.tramos([[0.8, 10.2, 1], [10.2, 10.7, 0.45], [10.7, 12.4, 1]]);
  var T_FIN = T_J + juego.dur, DUR = T_FIN + 2.5;
  var CERCA = { z: 1.32, x: 540, y: 1030 };

  K.montaje({
    dur: DUR,
    tomas: { a: 'hielo12' },
    clips: [
      { toma: 'a', de: 0, a: T_J, src: 0.7, vel: [[0, 0]], mudo: true, dedo: false, cam: [[0, { z: 1.2, x: 540, y: 1030 }], [T_J, CERCA]] },
      { toma: 'a', de: T_J, a: T_FIN, src: juego.src, vel: juego.vel, cam: [[T_J, CERCA], [T_J + 5, { z: 1.4, x: 540, y: 1000 }], [T_FIN, { z: 1.3, x: 540, y: 1060 }]] },
    ],
    antes: function () {
      K.M.temblor = K.eventos('ice').map(function (e) { return [e.t, 3, 0.15]; });
    },
    capas: function (ctx, t) {
      if (t < T_J) {
        K.sombraArriba(0.75, 560);
        K.popTexto(t, 0.0, 'ASMR 🧊', W / 2, 280, { size: 140, fill: C.ice, strokeW: 24, sinPop: true });
        K.palabras(t, 0.4, 'rompiendo hielo', W / 2, 410, { size: 86, maxW: 1000, ritmo: 0.09 });
        K.popTexto(t, 0.9, 'sube el volumen 🔊', W / 2, 510, { font: F.body, weight: '900', size: 52, fill: C.gold, strokeW: 12 });
        return;
      }
      if (t >= T_FIN) K.tarjetaFinal(t, T_FIN, { moodCocardo: 'sorprendido' });
    },
    audio: {
      juego: 1,
      volumen: { ice: 1.9, frost: 1.6, match: 0.75, swap: 0.8 },
      sfx: [['whoosh', T_FIN - 0.05, { v: 0.6 }]],
      musica: [{ t0: T_FIN, t1: DUR, desde: 0, gain: 0.9, fadeIn: 0.2, fadeOut: 0.8 }],
    },
  });
})();
