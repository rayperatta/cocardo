/* Video: «Nivel ¡Drama!: lo gané en el ÚLTIMO movimiento». Toma: tools/video/tomas/nivel.cjs --var 23:31:22:26:60
   (nivel 23, el de más hielo; las 4 últimas jugadas del bot). La última junta dos Bombas y rompe todo lo que quedaba. */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E;
  var juego = K.tramos([[0.75, 9.1, 1.6], [9.1, 9.4, 1], [9.4, 10.3, 0.3], [10.3, 12.0, 1]]);
  var T_J = 2.0, T_V = T_J + juego.dur, T_FIN = T_V + 2.4, DUR = T_FIN + 2.5, ev = {};

  K.montaje({
    dur: DUR,
    tomas: { a: 'clutch23' },
    clips: [
      { toma: 'a', de: 0, a: T_J, src: 0.6, vel: [[0, 0]], mudo: true, dedo: false, cam: [[0, { z: 1, x: 540, y: 960 }], [T_J, { z: 1.05, x: 540, y: 980 }]] },
      { toma: 'a', de: T_J, a: T_V, src: juego.src, vel: juego.vel, trans: 'golpe',
        cam: [[T_J, { z: 1, x: 540, y: 960 }], [T_J + juego.dur * 0.55, { z: 1, x: 540, y: 960 }], [T_J + juego.dur * 0.68, { z: 1.12, x: 540, y: 1000 }], [T_V, { z: 1, x: 540, y: 960 }]] },
      { toma: 'a', de: T_V, a: T_FIN, src: 12.9, trans: 'golpe' },
    ],
    antes: function () {
      ev.swaps = K.eventos('swap').map(function (e) { return e.t; });
      ev.villano = (K.eventos('villain')[0] || {}).t;
      ev.combo = (K.eventos('combo')[0] || {}).t;
      ev.win = (K.eventos('win')[0] || {}).t;
      K.M.temblor = ev.combo ? [[ev.combo, 26, 0.6]] : [];
    },
    capas: function (ctx, t) {
      if (t < T_J) {
        K.sombraArriba(0.85, 640);
        K.popTexto(t, 0.0, 'NIVEL ⚠️ ¡DRAMA!', W / 2, 270, { size: 96, fill: '#ff4f4f', strokeW: 20, rot: -0.03, sinPop: true });
        K.palabras(t, 0.35, 'quedan 4 movimientos', W / 2, 395, { size: 80, maxW: 1000, ritmo: 0.08 });
        K.popTexto(t, 0.95, '¿llego? 😰', W / 2, 505, { size: 84, fill: C.gold, strokeW: 16 });
        return;
      }
      if (t < T_V) {
        var quedan = 4; ev.swaps.forEach(function (s) { if (t >= s) quedan--; });
        var ultimo = quedan <= 1;
        if (ultimo && !ev.combo || (ev.combo && t < ev.combo && ultimo)) {
          var pul = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 0.75);
          ctx.fillStyle = 'rgba(200,0,30,' + (0.1 + 0.12 * pul) + ')'; ctx.fillRect(0, 0, W, H);
        }
        K.sombraArriba(0.7, 540);
        K.placa(W / 2, 360, 560, 150, 0.75);
        K.texto(Math.max(0, quedan) + (quedan === 1 ? ' movimiento' : ' movimientos'), W / 2, 360, { size: 72, fill: quedan <= 1 ? '#ff4f4f' : C.cream, strokeW: 14 });
        if (ev.villano) K.popTexto(t, ev.villano, 'Cherry: ¡más cajas! 📦', W / 2, 500, { size: 66, fill: C.pink, strokeW: 14, hasta: ev.villano + 1.4 });
        if (ev.combo) {
          K.flash(t, ev.combo, 0.3, '#fff', 0.5);
          K.popTexto(t, ev.combo + 0.02, '¡BOMBA + BOMBA!', W / 2, 520, { size: 104, fill: C.gold, strokeW: 22, rot: -0.04, hasta: (ev.win || ev.combo + 2) });
        }
        if (ev.win) K.popTexto(t, ev.win, '¡EN EL ÚLTIMO!', W / 2, 520, { size: 116, fill: '#9be35a', strokeW: 24, rot: -0.04 });
        return;
      }
      if (t < T_FIN) {
        K.palabras(t, T_V + 0.2, '¿Cuál es tu nivel más difícil? 👇', W / 2, 330, { size: 70, maxW: 1000, ritmo: 0.06 });
        return;
      }
      K.tarjetaFinal(t, T_FIN, { moodCocardo: 'llorando', moodCherry: 'furioso' });
    },
    audio: {
      juego: 1,
      extra: [['heartbeat', {}, 0.1, 1.2], ['heartbeat', {}, 0.9, 1.2], ['heartbeat', {}, 1.7, 1.2]],
      sfx: [['whoosh', T_J - 0.05, {}], ['golpe', T_J + juego.dur * 0.62, { v: 0.6 }], ['whoosh', T_V - 0.05, { v: 0.7 }], ['whoosh', T_FIN - 0.05, {}]],
      musica: [{ t0: T_J, t1: DUR, desde: 0, gain: 0.95, fadeIn: 0.1, fadeOut: 0.9, bajar: [[T_J + juego.dur * 0.55, T_J + juego.dur * 0.75, 0.3]] }],
    },
  });
})();
