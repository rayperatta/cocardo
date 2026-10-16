/* Video: «Solo 1 jugada rescata a Lima. ¿A, B o C?». Tomas: tools/video/tomas/acertijo.cjs (--var A|B|C), tablero en
   tools/video/datos/acertijo.cjs. Gancho congelado con las tres opciones → cuenta 3-2-1 → A (✗) → rebobinar → B (✗)
   → rebobinar → C (✓: la Paleta barre la fila, rompe el congelador y libera a Lima) → tarjeta final. */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E;
  var OP = { A: [{ r: 6, c: 2 }, { r: 7, c: 2 }], B: [{ r: 4, c: 3 }, { r: 5, c: 3 }], C: [{ r: 0, c: 5 }, { r: 1, c: 5 }] };
  var COL = { A: '#ff9a2e', B: '#4aa8e0', C: C.pink };
  var T_CUENTA = 3.4, T_A = 5.9, T_R1 = 9.0, T_B = 9.5, T_R2 = 13.1, T_C = 13.6, T_FIN = 20.0, DUR = 22.5;
  var ev = {};

  function celda(r, c) { return { x: 106 + 124 * c, y: 602 + 124 * r }; }
  function opciones(ctx, t, info, t0) {
    ['A', 'B', 'C'].forEach(function (k, i) {
      var o = OP[k], p1 = K.aPantalla(info, celda(o[0].r, o[0].c).x, celda(o[0].r, o[0].c).y), p2 = K.aPantalla(info, celda(o[1].r, o[1].c).x, celda(o[1].r, o[1].c).y);
      K.intercambio(t, t0 + i * 0.22, p1, p2, COL[k]);
      K.etiqueta(t, t0 + i * 0.22, k, (p1.x + p2.x) / 2 - 120, (p1.y + p2.y) / 2, COL[k]);
    });
  }
  function insignia(t, t0, letra) {
    K.etiqueta(t, t0, letra, 120, 330, COL[letra]);
  }
  function rebobinar(ctx, t, t0) {
    K.vhs(t, 1);
    K.popTexto(t, t0, '◀◀ REBOBINANDO', W / 2, 420, { font: F.body, weight: '900', size: 64, fill: C.cream, strokeW: 14, sinPop: true });
  }

  K.montaje({
    dur: DUR,
    tomas: { a: 'acertijo2-A', b: 'acertijo2-B', c: 'acertijo2-C' },
    clips: [
      { toma: 'c', de: 0, a: T_A, src: 0.6, vel: [[0, 0]], mudo: true, dedo: false,
        cam: [[0, { z: 1, x: 540, y: 960 }], [T_A, { z: 1.05, x: 540, y: 960 }]] },
      { toma: 'a', de: T_A, a: T_R1, src: 1.15, vel: [[0, 1.15]], trans: 'golpe' },
      { toma: 'a', de: T_R1, a: T_B, src: 4.6, vel: [[0, -7.2]], mudo: true, dedo: false },
      { toma: 'b', de: T_B, a: T_R2, src: 1.15, vel: [[0, 1.15]], trans: 'golpe' },
      { toma: 'b', de: T_R2, a: T_C, src: 5.2, vel: [[0, -8.4]], mudo: true, dedo: false },
      { toma: 'c', de: T_C, a: T_FIN, src: 1.15, vel: [[0, 1], [0.8, 1], [0.95, 0.35], [2.2, 0.35], [2.4, 1]], trans: 'golpe',
        cam: [[T_C, { z: 1, x: 540, y: 960 }], [T_C + 0.9, { z: 1.12, x: 540, y: 760 }], [T_C + 2.6, { z: 1.12, x: 540, y: 760 }], [T_C + 3.2, { z: 1, x: 540, y: 960 }]] },
    ],
    antes: function () {
      function uno(nombre, filtro) { var e = K.eventos(nombre, filtro); return e.length ? e[0].t : null; }
      ev.loseA = uno('lose', function (s, c) { return c.toma === 'a'; });
      ev.fzB = uno('freezerHit', function (s, c) { return c.toma === 'b'; });
      ev.loseB = uno('lose', function (s, c) { return c.toma === 'b'; });
      ev.paleta = uno('paleta', function (s, c) { return c.toma === 'c'; });
      ev.win = uno('win', function (s, c) { return c.toma === 'c'; });
      K.M.temblor = [[ev.fzB || 10.1, 14, 0.4], [ev.paleta || 15, 12, 0.35]];
      K.retrato('lima', 'asustado', { frozen: true });
    },
    capas: function (ctx, t, o) {
      var info = o.info;
      if (t < T_A) {
        K.sombraArriba(0.85, 560);
        if (info) {
          var pl = K.aPantalla(info, celda(0, 2).x, celda(0, 2).y);
          K.anillo(t, 0.35, pl.x, pl.y, 86, C.ice);
          opciones(ctx, t, info, 0.9);
        }
        if (t < T_CUENTA) {
          K.palabras(t, 0.0, 'Solo 1 jugada rescata a Lima', W / 2, 290, { size: 74, maxW: 1000, ritmo: 0.08, hasta: T_CUENTA });
          K.popTexto(t, 0.6, '¿A, B o C?', W / 2, 420, { size: 132, fill: C.gold, strokeW: 24, rot: -0.03, hasta: T_CUENTA });
        } else {
          var n = 3 - Math.floor((t - T_CUENTA) / 0.8), tn = T_CUENTA + (3 - n) * 0.8;
          if (n >= 1) K.popTexto(t, tn, String(n), W / 2, 330, { size: 220, fill: n === 1 ? '#ff4f4f' : C.cream, strokeW: 32, dur: 0.16 });
          K.popTexto(t, T_CUENTA + 0.1, 'comenta tu respuesta 👇', W / 2, 480, { font: F.body, weight: '900', size: 54, fill: C.gold, strokeW: 12 });
        }
        return;
      }
      if (t < T_R1) {
        K.sombraArriba(0.6, 520);
        insignia(t, T_A, 'A');
        if (ev.loseA) { K.sello(t, ev.loseA, false, 540, 420); }
        return;
      }
      if (t < T_B) { rebobinar(ctx, t, T_R1); return; }
      if (t < T_R2) {
        K.sombraArriba(0.6, 520);
        insignia(t, T_B, 'B');
        if (ev.fzB) K.popTexto(t, ev.fzB + 0.1, '¡El congelador sí!', W / 2, 330, { size: 92, fill: C.cream, strokeW: 18, hasta: ev.loseB || T_R2 });
        if (ev.loseB) {
          K.popTexto(t, ev.loseB, '…¿y Lima? 🥶', W / 2, 330, { size: 100, fill: C.ice, strokeW: 20 });
          K.sello(t, ev.loseB + 0.15, false, 540, 520, 95);
        }
        return;
      }
      if (t < T_C) { rebobinar(ctx, t, T_R2); return; }
      if (t < T_FIN) {
        K.sombraArriba(0.6, 520);
        insignia(t, T_C, 'C');
        if (ev.paleta) {
          K.palabras(t, ev.paleta - 0.05, 'La Paleta barre TODA la fila', W / 2, 300, { size: 70, maxW: 1000, ritmo: 0.07, hasta: (ev.win || 17) + 0.6 });
        }
        if (ev.win) {
          K.sello(t, ev.win, true, 880, 420, 100);
          K.popTexto(t, ev.win + 0.75, '¿Acertaste? 👇', W / 2, 330, { size: 104, fill: C.gold, strokeW: 20 });
        }
        return;
      }
      K.tarjetaFinal(t, T_FIN, { moodCocardo: 'llorando' });
    },
    audio: {
      juego: 1,
      extra: [['villain', {}, 0.05, 0.8], ['tick', {}, T_CUENTA, 1.2], ['tick', {}, T_CUENTA + 0.8, 1.2], ['tick', {}, T_CUENTA + 1.6, 1.2],
        ['heartbeat', {}, T_CUENTA + 0.02, 1], ['heartbeat', {}, T_CUENTA + 0.82, 1], ['heartbeat', {}, T_CUENTA + 1.62, 1.1]],
      sfx: [['pop', 0.9, { f: 600 }], ['pop', 1.12, { f: 700 }], ['pop', 1.34, { f: 800 }], ['whoosh', T_A - 0.05, {}],
        ['rebobinar', T_R1, { dur: 0.5 }], ['whoosh', T_B - 0.05, {}], ['rebobinar', T_R2, { dur: 0.5 }], ['whoosh', T_C - 0.05, {}],
        ['whoosh', T_FIN - 0.05, {}]],
      musica: [{ t0: T_A, t1: DUR, desde: 0, gain: 0.95, fadeIn: 0.05, fadeOut: 0.9, bajar: [[T_R1, T_B, 0.15], [T_R2, T_C, 0.15]] }],
    },
  });
})();
