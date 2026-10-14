/* Video: «La traición de Cherry». Escenas cliff15, pre16, pre17, cliff25 (tomas/historia.cjs) + nivel 17 (Cherry vuelve
   cajas las frutas) + nivel 25 (su congelador rosa cae). Montaje de telenovela: diálogos clave, golpes de «tan-tan-TAAAN». */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E;
  var HIST = { z: 1, x: 540, y: 1410 };
  var T = [0, 2.2, 3.45, 5.6, 8.45, 10.75, 14.75, 19.1, 23.5, 26.1];
  var DUR = T[9] + 2.5, ev = {};

  K.montaje({
    dur: DUR,
    tomas: { a: 'hist-cliff15', b: 'hist-pre16', c: 'hist-pre17', j: 'cherry17', r: 'rosa25', z: 'hist-cliff25' },
    clips: [
      { toma: 'a', de: T[0], a: T[1], src: 13.37, libre: true, cam: [[0, HIST]], vineta: 0.25 },
      { toma: 'a', de: T[1], a: T[2], src: 15.6, libre: true, cam: [[T[1], HIST], [T[2], { z: 1.08, x: 540, y: 1410 }]], vineta: 0.3 },
      { toma: 'a', de: T[2], a: T[3], src: 16.87, libre: true, cam: [[T[2], HIST]], trans: 'golpe', vineta: 0.25 },
      { toma: 'b', de: T[3], a: T[4], src: 2.93, vel: [[0, 1.12]], libre: true, cam: [[T[3], HIST]], trans: 'barrido', vineta: 0.25 },
      { toma: 'c', de: T[4], a: T[5], src: 10.23, vel: [[0, 1.05]], libre: true, cam: [[T[4], HIST]], trans: 'barrido', vineta: 0.25 },
      { toma: 'j', de: T[5], a: T[6], src: 2.35, trans: 'golpe', cam: [[T[5], { z: 1, x: 540, y: 960 }], [T[6], { z: 1.06, x: 540, y: 1000 }]] },
      { toma: 'r', de: T[6], a: T[7], src: 2.75, trans: 'golpe', cam: [[T[6], { z: 1, x: 540, y: 960 }]] },
      { toma: 'z', de: T[7], a: T[8], src: 0, vel: [[0, 1.42]], libre: true, cam: [[T[7], HIST]], trans: 'barrido', vineta: 0.3 },
      { toma: 'z', de: T[8], a: T[9], src: 6.27, libre: false, trans: 'golpe' },
    ],
    antes: function () {
      ev.villano = (K.eventos('villain', function (s, c) { return c.toma === 'j'; })[0] || {}).t;
      ev.win = (K.eventos('win', function (s, c) { return c.toma === 'r'; })[0] || {}).t;
      var hits = K.eventos('freezerHit', function (s, c) { return c.toma === 'r'; });
      ev.golpe = hits.length ? hits[hits.length - 1].t : null;
      var tem = [[T[1] + 0.05, 14, 0.5]];
      hits.forEach(function (h) { tem.push([h.t, 10, 0.3]); });
      K.M.temblor = tem;
    },
    capas: function (ctx, t) {
      if (t < T[3]) {
        K.sombraArriba(0.6, 560);
        K.palabras(t, 0.05, 'Cherry descubrió el secreto', W / 2, 270, { size: 80, maxW: 1000, ritmo: 0.07 });
        K.popTexto(t, 0.75, '…y todo cambió 🍒', W / 2, 385, { size: 96, fill: C.pink, strokeW: 18, rot: -0.03 });
        return;
      }
      if (t < T[5]) {
        K.sombraArriba(0.5, 480);
        K.popTexto(t, T[3] + 0.05, 'la nueva socia', W / 2, 300, { font: F.script, size: 120, fill: C.cream, stroke: C.drama, strokeW: 16 });
        return;
      }
      if (t < T[6]) {
        K.sombraArriba(0.75, 560);
        K.palabras(t, T[5] + 0.05, 'Ahora convierte frutas en CAJAS', W / 2, 300, { size: 70, maxW: 1000, ritmo: 0.07 });
        if (ev.villano) K.popTexto(t, ev.villano, 'ji, ji, ji 🍒', W / 2, 420, { size: 92, fill: C.pink, strokeW: 18, rot: -0.04 });
        return;
      }
      if (t < T[7]) {
        K.sombraArriba(0.75, 560);
        K.palabras(t, T[6] + 0.05, 'Su congelador rosa…', W / 2, 300, { size: 84, maxW: 1000, ritmo: 0.08 });
        if (ev.golpe) { K.flash(t, ev.golpe, 0.25, '#fff', 0.5); K.popTexto(t, ev.golpe + 0.05, '…¡ROTO!', W / 2, 420, { size: 128, fill: C.gold, strokeW: 24, rot: -0.04 }); }
        return;
      }
      if (t < T[8]) {
        K.sombraArriba(0.5, 480);
        K.popTexto(t, T[7] + 0.1, 'Pero ahora…', W / 2, 300, { size: 92, fill: C.cream, strokeW: 18 });
        return;
      }
      if (t < T[9]) return;
      K.tarjetaFinal(t, T[9], { moodCherry: 'furioso', moodCocardo: 'asustado' });
    },
    audio: {
      juego: 1,
      extra: [['drama', {}, 0.02, 0.8]],
      sfx: [['whoosh', T[3] - 0.05, {}], ['whoosh', T[4] - 0.05, {}], ['whoosh', T[5] - 0.05, {}], ['whoosh', T[6] - 0.05, {}],
        ['golpe', T[6] + 0.02, { v: 0.4 }], ['whoosh', T[7] - 0.05, {}], ['whoosh', T[9] - 0.05, {}]],
      musica: [{ t0: T[5], t1: T[7], desde: 0, gain: 0.95, fadeIn: 0.1, fadeOut: 0.3 }, { t0: T[9], t1: DUR, desde: 0, gain: 1, fadeIn: 0.05, fadeOut: 0.8 }],
    },
  });
})();
