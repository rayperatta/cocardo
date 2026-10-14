/* Video: «Perdí por UN hielo… esto debí hacer». Tomas: tools/video/tomas/casi13.cjs (--var pierde|gana), nivel 13,
   semilla 45. Gancho con la derrota → repaso acelerado → último movimiento (latido) → la jugada que pierde (libera a Fresa
   pero falta 1 hielo) → rebobinar → la jugada correcta: Copa y 12 cascadas → victoria. */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E;
  var gana = K.tramos([[10.9, 12.3, 1], [12.3, 16.0, 1.4], [16.0, 19.6, 1]]);
  var T_REP = 2.2, T_ULT = 5.0, T_MAL = 6.6, T_DER = 10.3, T_REB = 12.2, T_DEBI = 12.9, T_GANA = 13.6;
  var T_VIC = T_GANA + gana.dur, T_FIN = T_VIC + 2.1, DUR = T_FIN + 2.5;
  var CASC = [], ev = {};

  K.montaje({
    dur: DUR,
    tomas: { p: 'casi-pierde', g: 'casi-gana' },
    clips: [
      { toma: 'p', de: 0, a: T_REP, src: 17.2, vel: [[0, 0]], mudo: true, dedo: false,
        cam: [[0, { z: 1, x: 540, y: 960 }], [T_REP, { z: 1.06, x: 540, y: 1000 }]] },
      { toma: 'p', de: T_REP, a: T_ULT, src: 0.3, vel: [[0, 3.3]], mudo: true, trans: 'barrido' },
      { toma: 'p', de: T_ULT, a: T_MAL, src: 9.7, vel: [[0, 1]], trans: 'golpe',
        cam: [[T_ULT, { z: 1, x: 540, y: 960 }], [T_MAL, { z: 1.08, x: 540, y: 1000 }]] },
      { toma: 'p', de: T_MAL, a: T_DER, src: 11.3, vel: [[0, 1]], cam: [[T_MAL, { z: 1.08, x: 540, y: 1000 }], [T_MAL + 0.6, { z: 1, x: 540, y: 960 }]] },
      { toma: 'p', de: T_DER, a: T_REB, src: 16.2, vel: [[0, 1]], cam: [[T_DER, { z: 1, x: 540, y: 960 }], [T_REB, { z: 1.1, x: 540, y: 900 }]] },
      { toma: 'p', de: T_REB, a: T_DEBI, src: 16.0, vel: [[0, -8.8]], mudo: true, dedo: false },
      { toma: 'g', de: T_DEBI, a: T_GANA, src: 10.0, vel: [[0, 0]], mudo: true, dedo: false },
      { toma: 'g', de: T_GANA, a: T_VIC, src: gana.src, vel: gana.vel, trans: 'golpe' },
      { toma: 'g', de: T_VIC, a: T_FIN, src: 20.8, vel: [[0, 1]] },
    ],
    antes: function () {
      CASC = K.eventos('match', function (s, c) { return c.toma === 'g' && c.de === T_GANA; });
      ev.fresa = (K.eventos('rescue', function (s, c) { return c.toma === 'p'; })[0] || {}).t;
      ev.rescG = (K.eventos('rescue', function (s, c) { return c.toma === 'g' && c.de === T_GANA; })[0] || {}).t;
      ev.win = (K.eventos('win', function (s, c) { return c.toma === 'g'; })[0] || {}).t;
      var tem = [];
      CASC.forEach(function (e, i) { if (i >= 5) tem.push([e.t, 3 + i, 0.22]); });
      if (ev.win) tem.push([ev.win, 16, 0.4]);
      K.M.temblor = tem;
      K.retrato('cocardo', 'carcajada');
    },
    capas: function (ctx, t) {
      if (t < T_REP) {
        K.sombraArriba(0.85, 600);
        K.palabras(t, 0.0, 'Perdí por UN hielo', W / 2, 250, { size: 104, maxW: 1000, ritmo: 0.09 });
        K.popTexto(t, 0.55, '…esto debí hacer 👇', W / 2, 370, { size: 80, fill: C.gold, strokeW: 16 });
        var coc = K.retrato('cocardo', 'carcajada');
        if (coc.complete && t > 0.3) { var e = K.p(t, 0.3, 0.55, E.back); ctx.drawImage(coc, 640, 1450 + (1 - e) * 500 + Math.sin(t * 22) * 8, 460, 460); }
        return;
      }
      if (t < T_ULT) {
        K.sombraArriba(0.7, 520);
        K.popTexto(t, T_REP + 0.05, 'Nivel 13 · rescatar a Fresa', W / 2, 300, { font: F.body, weight: '900', size: 58, fill: C.cream, strokeW: 13 });
        K.popTexto(t, T_REP + 0.2, '▶▶ x3', W / 2, 400, { font: F.body, weight: '900', size: 52, fill: C.gold, strokeW: 12 });
        return;
      }
      if (t < T_MAL) {
        var pul = 0.5 + 0.5 * Math.sin((t - T_ULT) * Math.PI * 2 / 0.8);
        ctx.fillStyle = 'rgba(200,0,30,' + (0.12 + 0.12 * pul) + ')'; ctx.fillRect(0, 0, W, H);
        K.sombraArriba(0.7, 520);
        K.popTexto(t, T_ULT + 0.05, 'ÚLTIMO MOVIMIENTO', W / 2, 330, { size: 100, fill: '#ff4f4f', strokeW: 20, rot: -0.03 });
        return;
      }
      if (t < T_DER) {
        K.sombraArriba(0.6, 520);
        if (ev.fresa) K.popTexto(t, ev.fresa + 0.1, '¡Fresa libre! 🍓', W / 2, 320, { size: 100, fill: C.pink, strokeW: 20, hasta: ev.fresa + 1.6 });
        if (ev.fresa) K.popTexto(t, ev.fresa + 1.7, 'pero…', W / 2, 320, { size: 110, fill: C.cream, strokeW: 20 });
        return;
      }
      if (t < T_REB) {
        K.sombraArriba(0.6, 520);
        K.popTexto(t, T_DER + 0.15, '¡ME FALTÓ UN HIELO!', W / 2, 310, { size: 96, fill: C.ice, strokeW: 20, rot: -0.03 });
        K.sello(t, T_DER + 0.5, false, 880, 470, 90);
        return;
      }
      if (t < T_DEBI) {
        K.vhs(t, 1);
        K.popTexto(t, T_REB, '◀◀ REBOBINANDO', W / 2, 420, { font: F.body, weight: '900', size: 64, fill: C.cream, strokeW: 14, sinPop: true });
        return;
      }
      if (t < T_GANA) {
        K.sombraArriba(0.8, 600);
        K.popTexto(t, T_DEBI + 0.05, 'Esto debí hacer:', W / 2, 360, { size: 110, fill: C.gold, strokeW: 22 });
        return;
      }
      if (t < T_VIC) {
        var n = 0, t0 = 0;
        CASC.forEach(function (e) { if (t >= e.t) { n++; t0 = e.t; } });
        K.sombraArriba(0.55, 520);
        if (n) {
          var kb = K.p(t, CASC[0].t, CASC[0].t + 0.2, E.back);
          K.placa(W / 2, 410, 380 * kb, 250 * kb, 0.72);
          K.popTexto(t, CASC[0].t, 'CASCADAS', W / 2, 360, { font: F.body, weight: '900', size: 42, fill: C.cream, strokeW: 11, sinPop: true });
          K.contador(t, t0, n, W / 2, 450, n < 6 ? C.gold : n < 10 ? C.pink : '#ff4f4f');
        }
        if (ev.rescG) K.popTexto(t, ev.rescG, 'Fresa ✔', 900, 600, { font: F.body, weight: '900', size: 50, fill: C.pink, strokeW: 12 });
        if (ev.win) { K.flash(t, ev.win, 0.25, '#fff', 0.7); K.sello(t, ev.win + 0.05, true, 880, 600, 90); }
        return;
      }
      if (t < T_FIN) {
        K.palabras(t, T_VIC + 0.3, '¿A ti también te ha pasado?', W / 2, 330, { size: 74, maxW: 1000, ritmo: 0.07 });
        return;
      }
      K.tarjetaFinal(t, T_FIN, { moodCocardo: 'carcajada' });
    },
    audio: {
      juego: 1,
      extra: [['laugh', { who: 'cocardo' }, 0.35, 1.2], ['lose', {}, 0.05, 0.7], ['heartbeat', {}, T_ULT + 0.05, 1.3], ['heartbeat', {}, T_ULT + 0.85, 1.3],
        ['drama', {}, T_DER + 0.1, 0.9]],
      sfx: [['whoosh', T_REP - 0.05, {}], ['rayon', T_ULT - 0.02, { v: 0.8 }], ['golpe', T_DER + 0.5, { v: 0.6 }], ['rebobinar', T_REB, { dur: 0.7 }],
        ['golpe', T_DEBI, { v: 0.5 }], ['whoosh', T_GANA - 0.05, {}], ['subida', T_GANA + 2.2, { dur: 3.2, v: 0.4 }], ['whoosh', T_FIN - 0.05, {}]],
      musica: [
        { t0: T_REP, t1: T_ULT, desde: 0, gain: 1.0, fadeIn: 0.05, fadeOut: 0.05 },
        { t0: T_GANA, t1: DUR, desde: 4 * K.BEAT, gain: 1.0, fadeIn: 0.05, fadeOut: 0.9 },
      ],
    },
  });
})();
