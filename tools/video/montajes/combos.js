/* Video: «Todos los combos de Cocardo, del PEOR al MEJOR». Tomas: tools/video/tomas/combo.cjs (--var pp|bb|pb|cp|cb|cc).
   Cada combo entra en un tiempo de la cumbia y explota 0,4 s después del corte. Piezas: tools/video/plan.cjs (motor). */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E, B = K.BEAT;
  var LISTA = [
    { k: 'pp', n: 6, nombre: 'Paleta + Paleta', dato: '14 frutas', beats: 3 },
    { k: 'bb', n: 5, nombre: 'Bomba + Bomba', dato: '25 frutas', beats: 3 },
    { k: 'pb', n: 4, nombre: 'Paleta + Bomba', dato: '45 frutas', beats: 3 },
    { k: 'cp', n: 3, nombre: 'Copa + Paleta', dato: '57 frutas', beats: 4 },
    { k: 'cb', n: 2, nombre: 'Copa + Bomba', dato: '58 frutas', beats: 4 },
    { k: 'cc', n: 1, nombre: 'Copa + Copa', dato: '¡TODO el tablero!', beats: 5 },
  ];
  var CAM = { z: 1.1, x: 540, y: 1000 };
  var t = 3 * B, clips = [], tomas = {};
  clips.push({ toma: 'cc', de: 0, a: t, src: 0.6, vel: [[0, 0]], mudo: true, dedo: false, cam: [[0, { z: 1, x: 540, y: 960 }], [t, CAM]] });
  LISTA.forEach(function (it) {
    tomas[it.k] = 'combo-' + it.k;
    var d = it.beats * B;
    it.t0 = t;
    var c = { toma: it.k, de: t, a: t + d, src: 0.72, trans: 'golpe', cam: [[t, CAM]] };
    if (it.k === 'cc') c.vel = [[0, 1], [0.38, 1], [0.45, 0.4], [1.3, 0.4], [1.5, 1]];
    clips.push(c);
    t += d;
  });
  var T_PREG = t, T_FIN = t + 3 * B, DUR = T_FIN + 2.6;
  clips.push({ toma: 'cc', de: T_PREG, a: T_FIN, src: 2.4, vel: [[0, 0.6]], cam: [[T_PREG, CAM]] });
  tomas.cc = 'combo-cc';

  var sfx = [['subida', 0, { dur: 3 * B - 0.05, v: 0.5 }]];
  LISTA.forEach(function (it) { sfx.push(['whoosh', it.t0 - 0.06, { v: 0.8 }]); });
  sfx.push(['golpe', LISTA[5].t0 + 0.4, { v: 0.8 }], ['whoosh', T_FIN - 0.06, {}]);

  K.montaje({
    dur: DUR,
    tomas: tomas,
    clips: clips,
    antes: function () {
      var tem = [];
      K.eventos('combo').forEach(function (e) { tem.push([e.t, e.t > LISTA[5].t0 ? 22 : 10, 0.35]); });
      K.M.temblor = tem;
    },
    capas: function (ctx, tt) {
      if (tt < 3 * B) {
        K.sombraArriba(0.85, 620);
        K.palabras(tt, 0.0, 'Todos los combos de Cocardo', W / 2, 280, { size: 76, maxW: 1000, ritmo: 0.07 });
        K.popTexto(tt, 0.55, 'del PEOR al MEJOR', W / 2, 400, { size: 104, fill: C.gold, strokeW: 20, rot: -0.03 });
        return;
      }
      for (var i = 0; i < LISTA.length; i++) {
        var it = LISTA[i], fin = it.t0 + it.beats * B;
        if (tt >= it.t0 && tt < fin) {
          K.sombraArriba(0.75, 560);
          var oro = it.n <= 2;
          K.etiqueta(tt, it.t0 + 0.02, '#' + it.n, 150, 330, it.n === 1 ? C.gold : oro ? C.pink : '#7a6a8a');
          K.popTexto(tt, it.t0 + 0.05, it.nombre, 600, 330, { size: it.n === 1 ? 92 : 80, fill: it.n === 1 ? C.gold : C.cream, strokeW: 18, maxW: 760 });
          K.popTexto(tt, it.t0 + 0.55, it.dato, 600, 440, { font: F.body, weight: '900', size: 56, fill: oro ? C.gold : C.mint, strokeW: 12 });
          if (it.n === 1) K.flash(tt, it.t0 + 0.42, 0.3, '#fff', 0.45);
          return;
        }
      }
      if (tt < T_FIN) {
        K.sombraArriba(0.8, 600);
        K.palabras(tt, T_PREG + 0.05, '¿Cuál es tu favorito? 👇', W / 2, 330, { size: 86, maxW: 1000, ritmo: 0.08 });
        return;
      }
      K.tarjetaFinal(tt, T_FIN, { moodCocardo: 'asustado' });
    },
    audio: {
      juego: 1.1,
      sfx: sfx,
      musica: [{ t0: 0, t1: DUR, desde: 0, gain: 1.0, fadeOut: 0.9, bajar: [[LISTA[5].t0 + 0.35, LISTA[5].t0 + 1.6, 0.4]] }],
    },
  });
})();
