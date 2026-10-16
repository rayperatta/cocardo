/* Video: «Rescaté a TODAS (6/6)». Un rescate por víctima, en el orden del juego, al compás (4 tiempos cada uno):
   Lima (nivel 10), Fresa (13), Durazna (15), Naranja (19), Banana y Uva (30, Uva en el último movimiento). */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E, B = K.BEAT;
  var R = [
    { id: 'lima', nombre: 'Lima', toma: 'lima', src: 24.0, lento: [24.85, 25.35] },
    { id: 'fresa', nombre: 'Fresa', toma: 'fresa', src: 11.4, lento: [12.85, 13.25] },
    { id: 'durazna', nombre: 'Durazna', toma: 'durazna', src: 0.75, lento: [1.4, 1.8] },
    { id: 'naranja', nombre: 'Naranja', toma: 'naranja', src: 1.0, lento: [1.9, 2.3] },
    { id: 'banana', nombre: 'Banana', toma: 'f30', src: 21.6, lento: [22.2, 22.6] },
    { id: 'uva', nombre: 'Uva', toma: 'f30', src: 54.35, lento: [54.8, 55.3] },
  ];
  var T0 = 3 * B, D = 4 * B, clips = [];
  clips.push({ toma: 'lima', de: 0, a: T0, src: 23.0, vel: [[0, 0]], mudo: true, dedo: false, cam: [[0, { z: 1, x: 540, y: 960 }]] });
  R.forEach(function (r, i) {
    var de = T0 + i * D, a = de + D, l0 = r.lento[0] - r.src, dur = r.lento[1] - r.lento[0];
    r.de = de;
    clips.push({ toma: r.toma, de: de, a: a, src: r.src, trans: 'golpe',
      vel: [[0, 1], [l0, 1], [l0 + 0.06, 0.4], [l0 + dur / 0.4, 0.4], [l0 + dur / 0.4 + 0.1, 1]],
      cam: [[de, { z: 1.08, x: 540, y: 1000 }]] });
  });
  var T_MOS = T0 + R.length * D, T_FIN = T_MOS + 3 * B, DUR = T_FIN + 2.6;
  var resc = {};

  function fila(ctx, t) {
    R.forEach(function (r, i) {
      var x = 165 + i * 150, y = 330, libre = resc[r.id] != null && t >= resc[r.id];
      var img = K.retrato(r.id, libre ? 'feliz' : 'asustado', libre ? {} : { frozen: true });
      var k = libre ? 1 + 0.25 * Math.max(0, 1 - (t - resc[r.id]) / 0.25) : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      ctx.beginPath(); ctx.arc(0, 0, 66, 0, Math.PI * 2); ctx.fillStyle = libre ? C.mint : '#bfe9ff'; ctx.fill();
      ctx.lineWidth = 8; ctx.strokeStyle = libre ? C.ok : C.ink; ctx.stroke();
      ctx.save(); ctx.clip(); if (img.complete) ctx.drawImage(img, -78, -70, 156, 156); ctx.restore();
      ctx.restore();
    });
  }

  K.montaje({
    dur: DUR,
    tomas: { lima: 'congelador10', fresa: 'casi-gana', durazna: 'rescate15', naranja: 'rescate19', f30: 'final30' },
    clips: clips,
    antes: function () {
      var tem = [];
      R.forEach(function (r, i) {
        var e = K.eventos('rescue', function (s, c) { return c.de === r.de; })[0];
        resc[r.id] = e ? e.t : r.de + 1.2;
        tem.push([resc[r.id], 14, 0.4]);
        K.retrato(r.id, 'feliz'); K.retrato(r.id, 'asustado', { frozen: true });
      });
      K.M.temblor = tem;
    },
    capas: function (ctx, t) {
      if (t < T_MOS) {
        K.sombraArriba(0.85, 620);
        fila(ctx, t);
      }
      if (t < T0) {
        K.palabras(t, 0.05, 'Rescaté a TODAS', W / 2, 490, { size: 104, maxW: 1000, ritmo: 0.09 });
        K.popTexto(t, 0.6, 'las 6 frutas congeladas 🧊', W / 2, 600, { font: F.body, weight: '900', size: 56, fill: C.ice, strokeW: 12 });
        return;
      }
      for (var i = 0; i < R.length; i++) {
        var r = R[i];
        if (t >= r.de && t < r.de + D) {
          var n = i + (t >= resc[r.id] ? 1 : 0);
          K.popTexto(t, r.de, n + ' / 6', W / 2, 480, { size: 96, fill: n === 6 ? C.gold : C.cream, strokeW: 18, sinPop: true });
          K.flash(t, resc[r.id], 0.25, '#fff', 0.45);
          K.popTexto(t, resc[r.id] + 0.05, '¡' + r.nombre.toUpperCase() + ' LIBRE!', W / 2, 610, { size: 104, fill: '#9be35a', strokeW: 22, rot: -0.04 });
          if (i === 5) K.popTexto(t, resc[r.id] + 0.6, 'en el ÚLTIMO movimiento', W / 2, 720, { font: F.body, weight: '900', size: 56, fill: C.gold, strokeW: 12 });
          return;
        }
      }
      if (t < T_FIN) {
        V0(ctx, t);
        return;
      }
      K.tarjetaFinal(t, T_FIN, { moodCocardo: 'llorando', moodCherry: 'enojado' });
    },
    audio: {
      juego: 1,
      volumen: { rescue: 1.4 },
      sfx: [['subida', 0, { dur: T0 - 0.05, v: 0.5 }]].concat(R.map(function (r) { return ['whoosh', r.de - 0.06, { v: 0.8 }]; }))
        .concat([['whoosh', T_MOS - 0.06, {}], ['whoosh', T_FIN - 0.06, {}]]),
      musica: [{ t0: 0, t1: DUR, desde: 0, gain: 0.95, fadeOut: 0.9 }],
    },
  });

  // las seis, libres y felices
  function V0(ctx, t) {
    var V = K.V;
    V.fondo(ctx, C.drama, C.drama2);
    V.toldo(ctx, C.pink, '#ffffff', 120);
    R.forEach(function (r, i) {
      var c = i % 3, f = Math.floor(i / 3), x = 230 + c * 310, y = 860 + f * 380, tt = T_MOS + i * 0.06, e = K.p(t, tt, tt + 0.25, E.back);
      var img = K.retrato(r.id, 'feliz');
      if (img.complete && e > 0) ctx.drawImage(img, x - 170 * e, y - 170 * e + Math.sin(t * 5 + i) * 8, 340 * e, 340 * e);
    });
    K.palabras(t, T_MOS + 0.1, '¿Cuál es tu favorita? 👇', W / 2, 330, { size: 88, maxW: 1000, ritmo: 0.08 });
  }
})();
