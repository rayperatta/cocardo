/* Video: «El NIVEL FINAL de mi juego de Cocardo». Escena pre30 → nivel 30 (semilla 3): Banana sale con un combo, cae el
   congelador rosa y Uva sale en el ÚLTIMO movimiento → final de temporada (escena ending) → «¿Segunda temporada…?». */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E;
  var HIST = { z: 1, x: 540, y: 1410 };
  var inicio = K.tramos([[0.0, 0.6, 1], [0.6, 12.6, 4.2]]);
  var banana = K.tramos([[20.0, 22.15, 1.1], [22.15, 22.65, 0.4], [22.65, 23.6, 1]]);
  var medio = K.tramos([[24.3, 46.7, 7.5]], 0);
  var rosa = K.tramos([[47.1, 51.0, 1.35]], 0);
  var ultima = K.tramos([[53.4, 54.82, 1], [54.82, 55.35, 0.35], [55.35, 56.6, 1]]);
  var t = 0, T = {};
  function sig(nombre, d) { T[nombre] = t; t += d; return T[nombre]; }
  sig('pre30a', 2.5); sig('pre30b', 2.35); sig('ini', inicio.dur); sig('ban', banana.dur); sig('med', medio.dur); sig('rosa', rosa.dur);
  sig('ult', ultima.dur); sig('vic', 1.8); sig('amor', 3.3); sig('culp', 2.05); sig('avion', 2.0); sig('fin', 4.3); sig('tarjeta', 2.6);
  var DUR = t, ev = {};

  K.montaje({
    dur: DUR,
    tomas: { p: 'hist-pre30', f: 'final30', e: 'hist-ending' },
    clips: [
      { toma: 'p', de: T.pre30a, a: T.pre30b, src: 5.43, libre: true, cam: [[0, HIST]], vineta: 0.25 },
      { toma: 'p', de: T.pre30b, a: T.ini, src: 7.97, libre: true, cam: [[T.pre30b, HIST]], trans: 'barrido', vineta: 0.25 },
      { toma: 'f', de: T.ini, a: T.ban, src: inicio.src, vel: inicio.vel, trans: 'golpe' },
      { toma: 'f', de: T.ban, a: T.med, src: banana.src, vel: banana.vel, trans: 'golpe', cam: [[T.ban, { z: 1.08, x: 540, y: 1000 }]] },
      { toma: 'f', de: T.med, a: T.rosa, src: medio.src, vel: medio.vel, mudo: true, trans: 'barrido' },
      { toma: 'f', de: T.rosa, a: T.ult, src: rosa.src, vel: rosa.vel, trans: 'golpe' },
      { toma: 'f', de: T.ult, a: T.vic, src: ultima.src, vel: ultima.vel, trans: 'golpe',
        cam: [[T.ult, { z: 1, x: 540, y: 960 }], [T.ult + 1.3, { z: 1.1, x: 540, y: 1000 }], [T.vic, { z: 1, x: 540, y: 960 }]] },
      { toma: 'f', de: T.vic, a: T.amor, src: 57.9, trans: 'golpe' },
      { toma: 'e', de: T.amor, a: T.culp, src: 4.33, vel: [[0, 1.05]], libre: true, cam: [[T.amor, HIST]], trans: 'barrido', vineta: 0.25 },
      { toma: 'e', de: T.culp, a: T.avion, src: 11.53, libre: true, cam: [[T.culp, HIST]], trans: 'barrido', vineta: 0.25 },
      { toma: 'e', de: T.avion, a: T.fin, src: 34.27, libre: true, cam: [[T.avion, HIST]], trans: 'barrido', vineta: 0.25 },
      { toma: 'e', de: T.fin, a: T.tarjeta, src: 59.37, vel: [[0, 1.2]], trans: 'golpe' },
    ],
    antes: function () {
      function uno(n, clipDe) { var e = K.eventos(n, function (s, c) { return c.de === clipDe; }); return e.length ? e[0].t : null; }
      ev.banana = uno('rescue', T.ban);
      ev.uva = uno('rescue', T.ult);
      var stars = K.eventos('star', function (s, c) { return c.de === T.rosa; });
      ev.rosa = stars.length ? stars[0].t : T.rosa + 2;
      ev.win = uno('win', T.ult);
      K.M.temblor = [[ev.banana || 0, 14, 0.4], [ev.rosa, 16, 0.45], [ev.uva || 0, 20, 0.5]];
    },
    capas: function (ctx, tt) {
      if (tt < T.ini) {
        K.sombraArriba(0.55, 520);
        K.palabras(tt, 0.05, 'El NIVEL FINAL', W / 2, 270, { size: 112, maxW: 1000, ritmo: 0.1 });
        K.popTexto(tt, 0.55, 'de mi juego de Cocardo', W / 2, 390, { size: 70, fill: C.gold, strokeW: 14 });
        return;
      }
      if (tt < T.ban) {
        K.sombraArriba(0.7, 540);
        K.palabras(tt, T.ini + 0.05, 'Rescata a Uva y a Banana', W / 2, 310, { size: 80, maxW: 1000, ritmo: 0.07 });
        K.popTexto(tt, T.ini + 0.8, '▶▶ x4', W / 2, 420, { font: F.body, weight: '900', size: 52, fill: C.gold, strokeW: 12 });
        return;
      }
      if (tt < T.med) {
        K.sombraArriba(0.6, 520);
        if (ev.banana) { K.flash(tt, ev.banana, 0.25, '#fff', 0.45); K.popTexto(tt, ev.banana + 0.05, '¡BANANA LIBRE! 🍌', W / 2, 330, { size: 100, fill: C.gold, strokeW: 20, rot: -0.04 }); }
        return;
      }
      if (tt < T.rosa) {
        K.sombraArriba(0.6, 500);
        K.popTexto(tt, T.med + 0.05, '▶▶ x7', W / 2, 330, { size: 96, fill: C.cream, strokeW: 18 });
        return;
      }
      if (tt < T.ult) {
        K.sombraArriba(0.6, 520);
        K.palabras(tt, T.rosa + 0.05, 'El congelador rosa…', W / 2, 300, { size: 84, maxW: 1000, ritmo: 0.08 });
        K.popTexto(tt, ev.rosa, '…¡ADIÓS!', W / 2, 420, { size: 120, fill: C.pink, strokeW: 22, rot: -0.04 });
        return;
      }
      if (tt < T.vic) {
        if (!ev.uva || tt < ev.uva) {
          var pul = 0.5 + 0.5 * Math.sin((tt - T.ult) * Math.PI * 2 / 0.75);
          ctx.fillStyle = 'rgba(200,0,30,' + (0.1 + 0.12 * pul) + ')'; ctx.fillRect(0, 0, W, H);
        }
        K.sombraArriba(0.7, 540);
        K.popTexto(tt, T.ult + 0.05, 'ÚLTIMO MOVIMIENTO', W / 2, 300, { size: 96, fill: '#ff4f4f', strokeW: 20, rot: -0.03, hasta: ev.uva });
        if (ev.uva) {
          K.flash(tt, ev.uva, 0.3, '#fff', 0.5);
          K.popTexto(tt, ev.uva + 0.05, '¡UVA LIBRE! 🍇', W / 2, 300, { size: 110, fill: '#c9a0ff', strokeW: 22, rot: -0.04 });
          K.popTexto(tt, ev.uva + 0.5, '¡en el último!', W / 2, 420, { size: 80, fill: C.gold, strokeW: 16 });
        }
        return;
      }
      if (tt < T.amor) return;
      if (tt < T.fin) { K.sombraArriba(0.45, 420); if (tt < T.culp) K.popTexto(tt, T.amor + 0.1, 'El final 🥹', W / 2, 280, { size: 92, fill: C.cream, strokeW: 18 }); return; }
      if (tt < T.tarjeta) {
        K.popTexto(tt, T.fin + 3.0, '¿La quieres? 👇', W / 2, 300, { size: 92, fill: C.gold, strokeW: 18 });
        return;
      }
      K.tarjetaFinal(tt, T.tarjeta, { moodCocardo: 'triste', moodCherry: 'coqueta' });
    },
    audio: {
      juego: 1,
      sfx: [['golpe', 0.02, { v: 0.4 }], ['whoosh', T.ini - 0.05, {}], ['whoosh', T.ban - 0.05, {}], ['whoosh', T.med - 0.05, {}],
        ['whoosh', T.rosa - 0.05, {}], ['whoosh', T.ult - 0.05, {}], ['whoosh', T.amor - 0.05, {}], ['whoosh', T.tarjeta - 0.05, {}]],
      extra: [['heartbeat', {}, T.ult + 0.05, 1.2], ['heartbeat', {}, T.ult + 0.8, 1.2], ['drama', {}, T.fin + 0.05, 0.8]],
      musica: [{ t0: T.ini, t1: T.amor, desde: 0, gain: 0.95, fadeIn: 0.1, fadeOut: 0.4, bajar: [[T.ult, (T.ult + ultima.dur * 0.6), 0.3]] },
        { t0: T.tarjeta, t1: DUR, desde: 0, gain: 1, fadeIn: 0.05, fadeOut: 0.8 }],
    },
  });
})();
