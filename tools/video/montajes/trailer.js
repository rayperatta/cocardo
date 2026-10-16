/* Video: tráiler «Cocardo: ¡Rescate Helado!». Apertura de cine → portada → historia (congelador «experimentado», Lima
   congelada habla con el ayudante) → montaje al compás con lo mejor del juego → giro de Cherry → «CONTINUARÁ…» → tarjeta. */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E, B = K.BEAT;
  var HIST = { z: 1, x: 540, y: 1410 };
  var t = 0, T = {};
  function sig(n, d) { T[n] = t; t += d; }
  sig('avance', 1.25); sig('negro', 1.35); sig('portada', 2.4); sig('compre', 2.5); sig('viejo', 2.15); sig('lima', 2.4); sig('mapa', 1.7);
  // montaje al compás (la cumbia entra en T.mont)
  sig('mont', 0);
  var MONT = [
    { k: 'casc', toma: 'cas', src: 7.0, vel: 1.0, beats: 3, txt: '18 cascadas' },
    { k: 'cong', toma: 'cong', src: 24.55, vel: 0.6, beats: 2, txt: 'rompe congeladores' },
    { k: 'cc', toma: 'cc', src: 0.95, vel: 0.8, beats: 2, txt: 'combos' },
    { k: 'cherry', toma: 'ch17', src: 3.35, vel: 1.0, beats: 2, txt: 'Cherry 🍒' },
    { k: 'hf', toma: 'cas', src: 17.3, vel: 1.4, beats: 2, txt: '¡Helado Final!' },
    { k: 'uva', toma: 'f30', src: 54.6, vel: 0.7, beats: 2, txt: 'rescata a todas' },
  ];
  MONT.forEach(function (m) { m.de = t; t += m.beats * B; });
  sig('cherry', 2.25); sig('banana', 2.2); sig('continua', 2.4); sig('tarjeta', 4.2);
  var DUR = t;

  var clips = [
    // avance: el clímax de las 18 cascadas como primer fotograma (en TikTok nada de abrir en negro)
    { toma: 'cas', de: T.avance, a: T.negro, src: 8.3, vel: [[0, 0.5]], trans: 'golpe', cam: [[0, { z: 1.15, x: 540, y: 1000 }]] },
    { toma: 'por', de: T.portada, a: T.compre, src: 0.1, cam: [[T.portada, { z: 1.12, x: 540, y: 820 }], [T.compre, { z: 1.05, x: 540, y: 860 }]], vineta: 0.3 },
    { toma: 'pre2', de: T.compre, a: T.viejo, src: 0, vel: [[0, 1.2]], libre: true, cam: [[T.compre, HIST]], trans: 'barrido', vineta: 0.3 },
    { toma: 'pre2', de: T.viejo, a: T.lima, src: 5.2, vel: [[0, 1.05]], libre: true, cam: [[T.viejo, HIST]], trans: 'golpe', vineta: 0.3 },
    { toma: 'pre10', de: T.lima, a: T.mapa, src: 0, vel: [[0, 1.35]], libre: true, cam: [[T.lima, HIST]], trans: 'barrido', vineta: 0.3 },
    { toma: 'por', de: T.mapa, a: T.mont, src: 4.5, vel: [[0, 2.0]], trans: 'barrido', mudo: true },
    { toma: 'cl15', de: T.cherry, a: T.banana, src: 13.37, vel: [[0, 1.05]], libre: true, cam: [[T.cherry, HIST]], trans: 'golpe', vineta: 0.3 },
    { toma: 'cl15', de: T.banana, a: T.continua, src: 16.87, vel: [[0, 1.05]], libre: true, cam: [[T.banana, HIST], [T.continua, { z: 1.06, x: 540, y: 1410 }]], trans: 'golpe', vineta: 0.3 },
    { toma: 'cl15', de: T.continua, a: T.tarjeta, src: 19.37, trans: 'golpe' },
  ];
  MONT.forEach(function (m) {
    clips.push({ toma: m.toma, de: m.de, a: m.de + m.beats * B, src: m.src, vel: [[0, m.vel]], trans: 'golpe', cam: [[m.de, { z: 1.1, x: 540, y: 1000 }]] });
  });

  function cine(t) {
    // barras de cine en la apertura y la historia; se abren en el montaje
    var k = t < T.negro ? 0 : t < T.mont ? 1 : t < T.cherry ? 1 - K.p(t, T.mont, T.mont + 0.3, E.out) : t < T.tarjeta ? K.p(t, T.cherry, T.cherry + 0.3, E.out) : 0;
    K.cine(k);
  }

  K.montaje({
    dur: DUR,
    tomas: { por: 'portada', pre2: 'hist-pre2', pre10: 'hist-pre10', cas: 'cascada', cong: 'congelador10', cc: 'combo-cc', ch17: 'cherry17', f30: 'final30', cl15: 'hist-cliff15' },
    clips: clips,
    capas: function (ctx, tt) {
      if (tt < T.negro) {
        K.sombraArriba(0.75, 600);
        K.popTexto(tt, 0, '¿Cocardo…', W / 2, 300, { size: 110, fill: C.cream, strokeW: 22, sinPop: true });
        K.popTexto(tt, 0.35, '…en VIDEOJUEGO?', W / 2, 425, { size: 104, fill: C.gold, strokeW: 22, rot: -0.03 });
        return;
      }
      if (tt < T.portada) {
        ctx.fillStyle = '#0c0410'; ctx.fillRect(0, 0, W, H);
        var a = K.p(tt, T.negro, T.negro + 0.2) * (1 - K.p(tt, T.portada - 0.2, T.portada));
        ctx.save(); ctx.globalAlpha = a;
        K.texto('En una heladería en quiebra…', W / 2, H / 2 - 40, { font: F.script, size: 112, fill: C.cream, stroke: C.drama, strokeW: 12, maxW: 1000 });
        ctx.restore();
        cine(tt);
        return;
      }
      if (tt < T.compre) { cine(tt); return; }
      if (tt < T.mapa) {
        if (tt >= T.lima) {
          K.sombraArriba(0.5, 480);
          K.palabras(tt, T.lima + 0.1, 'Tú eres su ayudante secreto', W / 2, 330, { size: 70, maxW: 1000, ritmo: 0.07 });
        }
        cine(tt);
        return;
      }
      if (tt < T.mont) {
        K.sombraArriba(0.6, 520);
        K.popTexto(tt, T.mapa + 0.05, '30 niveles', W / 2, 330, { size: 120, fill: C.gold, strokeW: 22, rot: -0.03 });
        cine(tt);
        return;
      }
      for (var i = 0; i < MONT.length; i++) {
        var m = MONT[i];
        if (tt >= m.de && tt < m.de + m.beats * B) {
          K.sombraArriba(0.6, 500);
          K.popTexto(tt, m.de + 0.03, m.txt, W / 2, 330, { size: 96, fill: i % 2 ? C.pink : C.gold, strokeW: 20, rot: (i % 2 ? 0.03 : -0.03), dur: 0.15 });
          cine(tt);
          return;
        }
      }
      if (tt < T.tarjeta) {
        if (tt < T.continua) {
          K.sombraArriba(0.5, 480);
          K.popTexto(tt, T.cherry + 0.1, 'Pero Cherry…', W / 2, 330, { size: 100, fill: C.pink, strokeW: 20, hasta: T.banana });
        }
        cine(tt);
        return;
      }
      K.tarjetaFinal(tt, T.tarjeta, { moodCocardo: 'burlon', moodCherry: 'coqueta' });
      K.popTexto(tt, T.tarjeta + 0.85, '30 niveles · 16 personajes', W / 2, 232, { font: F.body, weight: '900', size: 46, fill: C.ink, stroke: C.cream, strokeW: 10 });
    },
    audio: {
      juego: 1,
      extra: [['drama', {}, T.negro + 0.02, 0.9], ['drama', {}, T.continua + 0.02, 0.7]],
      sfx: [['golpe', 0.0, { v: 0.6 }], ['rayon', T.negro - 0.03, { v: 0.7 }], ['subida', T.mapa - 0.4, { dur: 1.9, v: 0.6 }], ['golpe', T.mont, { v: 0.8 }], ['whoosh', T.portada - 0.05, {}], ['whoosh', T.compre - 0.05, { v: 0.6 }],
        ['whoosh', T.lima - 0.05, { v: 0.6 }], ['whoosh', T.mapa - 0.05, {}], ['rayon', T.cherry - 0.02, { v: 0.8 }], ['whoosh', T.tarjeta - 0.05, {}]]
        .concat(MONT.map(function (m) { return ['whoosh', m.de - 0.05, { v: 0.6 }]; })),
      musica: [{ t0: T.portada, t1: T.mont, desde: 0, gain: 0.45, fadeIn: 0.4, fadeOut: 0.05 },
        { t0: T.mont, t1: T.cherry, desde: 0, gain: 1.1, fadeIn: 0.02, fadeOut: 0.05 },
        { t0: T.tarjeta, t1: DUR, desde: 0, gain: 1.05, fadeIn: 0.05, fadeOut: 1.0 }],
    },
  });
})();
