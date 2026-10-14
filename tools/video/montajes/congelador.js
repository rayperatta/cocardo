/* Video: «Le rompí el congelador a Cocardo en 8 jugadas». Tomas: historia pre10/post10 (tomas/historia.cjs) y
   tomas/congelador10.cjs (nivel 10, semilla 101). Barra de vida del congelador sincronizada con cada golpe (19 PV). */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E;
  var SUBE = 450;   // las escenas de historia se suben para que el diálogo no quede bajo el texto de TikTok
  var HIST = { z: 1, x: 540, y: 960 + SUBE };
  var pelea = K.tramos([
    [0.85, 4.0, 1], [4.0, 9.6, 2.6], [9.6, 10.6, 1], [10.6, 19.8, 3.2], [19.8, 21.1, 1], [21.1, 23.6, 2.5],
    [23.6, 24.85, 1], [24.85, 25.45, 0.3], [25.45, 27.0, 1], [27.0, 31.6, 3],
  ]);
  var T_P = 3.44, T_Q = T_P + pelea.dur, T_FIN = T_Q + 2.4, DUR = T_FIN + 2.5;
  var golpes = [], ev = {};

  K.montaje({
    dur: DUR,
    tomas: { p: 'hist-pre10', g: 'congelador10', q: 'hist-post10' },
    clips: [
      { toma: 'p', de: 0, a: T_P, src: 3.3, vel: [[0, 1.25]], libre: true, cam: [[0, HIST]], vineta: 0.2 },
      { toma: 'g', de: T_P, a: T_Q, src: pelea.src, vel: pelea.vel, trans: 'golpe',
        cam: [[T_P, { z: 1, x: 540, y: 960 }]] },
      { toma: 'q', de: T_Q, a: T_FIN, src: 3.17, vel: [[0, 1.2]], libre: true, cam: [[T_Q, HIST]], trans: 'barrido', vineta: 0.2 },
    ],
    antes: function () {
      golpes = K.eventos('freezerHit', function (s, c) { return c.toma === 'g'; }).map(function (e) { return e.t; });
      ev.rescate = (K.eventos('rescue', function (s, c) { return c.toma === 'g'; })[0] || {}).t;
      ev.ultima = (K.eventos('swap', function (s, c) { return c.toma === 'g'; }).slice(-1)[0] || {}).t;
      ev.win = (K.eventos('win', function (s, c) { return c.toma === 'g'; })[0] || {}).t;
      var tem = golpes.map(function (t) { return [t, 5, 0.18]; });
      if (ev.rescate) tem.push([ev.rescate, 22, 0.6]);
      K.M.temblor = tem;
      ['burlon', 'nervioso', 'asustado', 'llorando', 'furioso'].forEach(function (m) { K.retrato('cocardo', m); });
    },
    capas: function (ctx, t, o) {
      if (t < T_P) {
        K.sombraArriba(0.55, 560);
        K.palabras(t, 0.05, 'Le rompí el congelador', W / 2, 280, { size: 92, maxW: 1000, ritmo: 0.08 });
        K.palabras(t, 0.5, 'a Cocardo en 8 jugadas', W / 2, 395, { size: 92, maxW: 1000, ritmo: 0.08, colorResalta: C.pink });
        return;
      }
      if (t < T_Q) {
        // vida del congelador
        var n = 0; golpes.forEach(function (g) { if (t >= g) n++; });
        var hp = Math.max(0, 19 - n), ult = 0; golpes.forEach(function (g) { if (t >= g) ult = g; });
        K.sombraArriba(0.75, 600);
        var golpe = ult ? Math.max(0, 1 - (t - ult) / 0.2) : 0;
        K.placa(560, 400, 820, 190, 0.8);
        K.texto('CONGELADOR VIEJO', 600, 345, { font: F.body, weight: '900', size: 40, fill: C.ice, strokeW: 9, sombra: false });
        var bw = 560, bx = 320, by = 395;
        ctx.save(); K.V.rr(ctx, bx, by, bw, 48, 24); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
        K.V.rr(ctx, bx, by, Math.max(48, bw * hp / 19), 48, 24);
        ctx.fillStyle = hp > 6 ? '#ff4f6d' : '#ff2a2a'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.restore();
        K.texto(hp + ' / 19', 600, 450 + golpe * -6, { size: 58 + golpe * 14, fill: C.cream, strokeW: 12 });
        var mood = hp === 0 ? 'llorando' : golpe > 0.3 ? 'furioso' : hp > 12 ? 'burlon' : hp > 6 ? 'nervioso' : 'asustado';
        var img = K.retrato('cocardo', mood), s = 250 * (1 + golpe * 0.12);
        if (img.complete) ctx.drawImage(img, 150 - s / 2, 395 - s / 2, s, s);
        // aceleración visible
        var v = K.kf(K.M.clips[1].vel, t - T_P);
        if (v > 1.6) K.popTexto(t, t - 1, '▶▶ x' + Math.round(v), 900, 560, { font: F.body, weight: '900', size: 46, fill: C.gold, strokeW: 10, sinPop: true });
        if (ev.ultima) K.popTexto(t, ev.ultima - 0.05, '¡GOLPE FINAL!', W / 2, 600, { size: 110, fill: C.gold, strokeW: 22, rot: -0.04, hasta: ev.rescate });
        if (ev.rescate) {
          K.flash(t, ev.rescate, 0.25, '#fff', 0.7);
          K.popTexto(t, ev.rescate + 0.05, '¡LIMA ES LIBRE!', W / 2, 600, { size: 120, fill: '#9be35a', strokeW: 24, rot: -0.04, hasta: (ev.win || ev.rescate + 2) + 0.3 });
        }
        if (ev.win) K.popTexto(t, ev.win + 0.35, '16 movimientos de sobra = 16 paletas', W / 2, 600, { size: 58, fill: C.cream, strokeW: 13, maxW: 980 });
        return;
      }
      if (t < T_FIN) {
        K.sombraArriba(0.55, 520);
        K.palabras(t, T_Q + 0.1, 'Mientras tanto, Cocardo:', W / 2, 300, { size: 84, maxW: 1000, ritmo: 0.08 });
        return;
      }
      K.tarjetaFinal(t, T_FIN, { moodCocardo: 'llorando' });
    },
    audio: {
      juego: 1,
      sfx: [['golpe', 0.02, { v: 0.5 }], ['whoosh', T_P - 0.06, {}], ['subida', T_P + pelea.dur * 0.62, { dur: 1.1, v: 0.5 }],
        ['whoosh', T_Q - 0.06, {}], ['whoosh', T_FIN - 0.06, {}], ['pop', T_FIN + 0.35, { f: 600 }]],
      musica: [{ t0: T_P, t1: T_Q + 0.2, desde: 0, gain: 1.0, fadeIn: 0.05, fadeOut: 0.25 },
        { t0: T_FIN, t1: DUR, desde: 8 * K.BEAT, gain: 1.0, fadeIn: 0.05, fadeOut: 0.8 }],
    },
  });
})();
