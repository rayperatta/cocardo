/* D01-2 · F07 Telenovela (variante tráiler): «¿Cocardo… en VIDEOJUEGO? Y tú eres el ayudante». El 02 (trailer.js)
   rehecho con la plantilla F07: una voz por hueco (narrador en la portada, Cocardo y su congelador de cuatro mil pesos,
   Lima congelada, Cherry descubriendo a Banana), cortes al golpe del tema (103,3 BPM), escalada hasta Copa + Copa y la
   tarjeta EMPIEZA GRATIS que enlaza con el cuadro 0. Sin fechas. 27,7 s.
   v2 (revisión de dopamina): las voces de Cocardo y de Lima suenan sobre el juego, no sobre retratos quietos. Cocardo
   habla encima del congelador recibiendo golpes (primera jugada del nivel 10) y su retrato queda en un golpe de 1 compás;
   Lima congelada es un plano corto con su «Psst…», y «…ayudante» cae en el corte a la mano del tutorial, que juega a
   velocidad real mientras ella termina. El clímax entra con el tablero vacío, en el centro y como el texto más grande, y
   corta antes del «¡Rico!» del juego.
   Render: node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/D01-2/montaje.js" dist/videos-mes/D01-2-trailer.mp4 --cap dist/cap --volumen ganancia --revisar */
(function () {
  'use strict';
  var C = window.K.C;
  var P = {
    voz: 'dist/estudio/voz/D01-2.json',
    tomas: { cas: 'cascada', por: 'portada', cong: 'congelador10', pre2: 'hist-pre2', pre6: 'D01-2-hist-pre6',
      f30: 'final30', cc: 'combo-cc', cl15: 'hist-cliff15' },
    // tema-1: 103,3 BPM medidos, golpe en 4,9517 s del archivo (python3 tools/video/formatos/F07/ritmo.py tema)
    // gain 3: la música queda unos 8 dB bajo las voces y 18 dB bajo ellas cuando se agacha (con 1 quedaba a 16 y 26 dB)
    musica: { tipo: 'tema', bpm: 103.3, desde: 4.9517, gain: 3.0, tramos: [{ de: 0, a: 'copa', fadeOut: 0.12 }], bucle: 'tarjeta' },
    pistas: [{ tipo: 'drama', de: 'banana', a: 'continua', desde: 6.63, gain: 2.5, fadeIn: 0.25, fadeOut: 0.12 }],
    gancho: { lineas: ['¿Cocardo…', '…en VIDEOJUEGO?'], extra: [{ s: 'Y TÚ eres el ayudante', en: 0.85 }] },
    planos: [
      // 0) el clímax de las 18 cascadas ya en marcha, con el gancho escrito desde el cuadro 0
      { id: 'gancho', toma: 'cas', src: 6.95, b: 4, pulso: 0.02, cam: { z: 1.12, x: 520, y: 1010 }, cam2: { z: 1.2 } },
      // 1) narrador: «La frutinovela…» en la portada (el pie de la portada queda fuera de cuadro) y «…ahora se juega» en el mapa
      { id: 'portada', toma: 'por', src: 0.05, vel: 0.9, b: 2, voz: 'portada', vozEn: 0.06, trans: 'barrido',
        cam: { z: 1.14, x: 540, y: 800 }, cam2: { z: 1.24, y: 760 } },
      { id: 'mapa', toma: 'por', src: 4.45, vel: 2.0, b: 3, cam: { z: 1.16, x: 540, y: 830 }, cam2: { z: 1.2 },
        // el aviso «Capítulo 7 en construcción · Se abre el…» queda fuera de cuadro y además va tapado
        tapa: { x0: 0, y0: 1690, x1: 1080, y1: 1920 }, textos: [{ s: '30 niveles', en: 0.06, size: 124 }] },
      // 2) el congelador de cuatro mil pesos (con Lima en su bloque) recibiendo golpes de verdad: la primera jugada del nivel 10
      //    (empieza en 1,42 s de la toma, cuando ya se fue el cuadro de diálogo del juego: 5 golpes al congelador de 1,73 a
      //    3,89 s, sin la mano, que se guarda para «¡Ese eres TÚ!») y, encima, Cocardo:
      //    «No está viejo, está experimentado.» (la voz va de 0,45 a 2,58 s del plano y sigue en el retrato)
      { id: 'congelador', toma: 'cong', src: 1.42, vel: 1.3, b: 4, voz: 'viejo', vozEn: 0.45, pulso: 0.02, dedo: false,
        // encuadre: el congelador queda bajo el texto de arriba y los elogios del juego (y = 960 de la toma), arriba del subtítulo
        cam: { z: 1.5, x: 560, y: 905 }, cam2: { z: 1.58, x: 555, y: 900 },
        textos: [{ s: 'El congelador de 4.000 pesos…', estilo: 'palabras', size: 88, ritmo: 0.07 }],
        efectos: [{ en: 0.02, golpe: 0.45 }, { en: { evento: 'freezerHit', n: 0 }, temblor: [7, 0.2] },
          { en: { evento: 'freezerHit', n: 2 }, temblor: [8, 0.2] }, { en: { evento: 'freezerHit', n: 3 }, temblor: [10, 0.25] }] },
      // golpe de 1 compás: la cara de Cocardo en «…experimentado»
      { id: 'viejo', toma: 'pre2', src: 5.75, b: 1, historia: true, cam: { z: 1.12, x: 560, y: 1380 }, cam2: { z: 1.18 } },
      // 3) Lima, congelada (plano corto): «Psst…» sobre su retrato y «…ayudante» ya en el corte a la mano del tutorial
      { id: 'lima', toma: 'pre6', src: 0.3, b: 2, voz: 'lima', vozEn: 0.6, historia: true,
        cam: { z: 1.22, x: 400, y: 1250 }, cam2: { z: 1.32, x: 385, y: 1230 }, zooms: [[0.62, 1.07]], extra: [['frost', 0.03, 0.8]],
        textos: [{ s: 'Lima quedó congelada 🧊', en: 0.06, size: 86, fill: C.ice }] },
      // 4) la mano del tutorial hace la primera jugada y arrancan las cascadas a velocidad real mientras Lima termina su frase
      //    (el plano dura lo que su voz): la jugada y las dos primeras cascadas a 1x, después a 1,4x (cascadas 1 a 5). La
      //    segunda cascada (2,32 s de la toma) cae a 10,84 s, después de «Sigo»: encima de la palabra, whisper oía «Digo».
      //    Cámara libre: el tablero entero queda arriba del subtítulo y la mano, a la vista.
      { id: 'mano', toma: 'cas', tramos: [[0.78, 2.45, 1.0], [2.45, 4.35, 1.4]], hastaVoz: true, pulso: 0.02, libre: true,
        cam: { z: 1.08, x: 520, y: 1381 }, cam2: { z: 1.14, x: 520, y: 1360 }, zooms: [[1.55, 1.05]],
        textos: [{ s: '¡Ese eres TÚ! 👇', en: 0.2, size: 108 }] },
      // 5) montaje al golpe: las 18 cascadas con el contador, el congelador cae y Lima sale, último movimiento y Copa + Copa
      { id: 'cascada', toma: 'cas', tramos: [[4.18, 8.95, 2.85], [8.95, 9.6, 0.95]], b: 4, pulso: 0.02,
        cam: { z: 1.12, x: 520, y: 1000 }, cam2: { z: 1.22 }, contador: { evento: 'match', x: 740, y: 1240, size: 170 },
        textos: [{ s: '¡18 CASCADAS!', en: { evento: 'match', si: function (s) { return s.opts && s.opts.cascade === 18; } }, size: 108 }] },
      { id: 'lima-libre', toma: 'cong', tramos: [[23.75, 24.9, 1.3], [24.9, 25.9, 1.0]], b: 3, pulso: 0.02,
        cam: { z: 1.15, x: 540, y: 820 }, cam2: { z: 1.25, x: 520, y: 770 },
        textos: [{ s: '¡Rompe el congelador!', en: 0.04, size: 92, hasta: { evento: 'rescue' } },
          { s: '¡LIMA LIBRE!', en: { evento: 'rescue' }, size: 124, fill: '#8fd63a', y: 1250 }],
        efectos: [{ en: { evento: 'rescue' }, temblor: [16, 0.45] }] },
      { id: 'ultimo', toma: 'f30', tramos: [[53.6, 54.8, 1.6], [54.8, 55.9, 1.0]], b: 3, pulso: 0.02,
        cam: { z: 1.1, x: 540, y: 950 }, cam2: { z: 1.22, x: 520, y: 900 }, extra: [['heartbeat', 0.02, 1.1]],
        textos: [{ s: '¡ÚLTIMO MOVIMIENTO!', en: 0.04, size: 90, fill: '#ff4f4f', hasta: { evento: 'rescue' } },
          { s: '¡UVA LIBRE!', en: { evento: 'rescue' }, size: 124, fill: '#c9a0ff', y: 1250 }],
        efectos: [{ en: { evento: 'rescue' }, temblor: [14, 0.4] }] },
      // clímax (hacia el 70 %): Copa + Copa en cámara lenta limpia el tablero entero. La cámara lenta cubre la explosión y
      // el tablero vacío (1,05-1,75 s de la toma); «¡TODO EL TABLERO!» entra con el tablero vacío (1,5 s de la toma), en el
      // centro y como el texto más grande del video, y el plano corta mientras se rellena (1,97 s), antes del «¡Rico!» del
      // juego (2,18 s)
      { id: 'copa', toma: 'cc', tramos: [[0.5, 1.05, 1.0], [1.05, 1.75, 0.45], [1.75, 2.1, 1.0]], b: 4, pulso: 0.015,
        cam: { z: 1.1, x: 540, y: 1000 }, cam2: { z: 1.0, x: 540, y: 960 }, sfx: [['subida', -0.25, { dur: 1.0, v: 0.6 }], ['subida', 0.45, { dur: 1.1, v: 0.8 }]],
        textos: [{ s: 'COPA + COPA', en: { evento: 'swap' }, size: 112, hasta: 1.55 },
          { s: '¡TODO EL', en: 1.55, size: 200, fill: C.pink, y: 870, rot: -0.05 },
          { s: 'TABLERO!', en: 1.6, size: 200, fill: C.gold, y: 1075, rot: -0.02, pop: false }],
        efectos: [{ en: { evento: 'combo' }, temblor: [18, 0.5], golpe: 0.8 },
          { en: 1.55, flash: 0.3, confeti: true, golpe: 0.9, temblor: [24, 0.5], y: 980 }],
        extra: [['star', 1.62, 0.9, { i: 1 }], ['star', 1.8, 0.9, { i: 2 }], ['star', 1.98, 0.9, { i: 3 }]] },
      // 6) el giro: «Pero Cherry…», ¡TAN-TAN-TAAAN! con los tres zooms y «Mira, ahí está Banana… esto es hermoso.»
      { id: 'pero', toma: 'cl15', src: 13.37, b: 2, historia: true, tapa: false, cam: { z: 1.12, x: 540, y: 1330 }, cam2: { z: 1.2 },
        sfx: [['rayon', -0.02, { v: 0.8 }]], extra: [['heartbeat', 0.1, 1.0], ['heartbeat', 0.68, 1.0]],
        textos: [{ s: 'Pero Cherry…', en: 0.06, estilo: 'script', size: 132, fill: C.pink }] },
      { id: 'tantan', toma: 'cl15', src: 15.48, b: 2, historia: true, tapa: false, pulso: 0, cam: { z: 1.0, x: 540, y: 1330 },
        zooms: [[0.12, 1.08], [0.42, 1.08], [0.72, 1.08]] },
      { id: 'banana', toma: 'cl15', src: 16.8, voz: 'banana', vozEn: 0.06, historia: true,
        cam: { z: 1.12, x: 620, y: 1360 }, cam2: { z: 1.3, x: 700, y: 1300 }, zooms: [[1.0, 1.07]] },   // escalón en «Banana»
      // 7) CONTINUARÁ… (la tarjeta del juego, antes de que vuelva al mapa) y la tarjeta final de 1 s → cuadro 0
      { id: 'continua', toma: 'cl15', src: 20.3, b: 2, libre: true, pulso: 0.02,
        cam: { z: 1.1, x: 540, y: 1180 }, cam2: { z: 1.16 }, extra: [['drama', 0.0, 0.7]] },
      { id: 'tarjeta', d: 1.0, tarjeta: { cta: 'EMPIEZA GRATIS', sub: 'link en el perfil', pie: 'cocardo.app',
        moodCocardo: 'burlon', moodCherry: 'coqueta', linea: '¿Hasta qué nivel llegas?', adelanto: 0.2 } },
    ],
  };
  // la cámara libre del plano «mano» deja ver, debajo de la toma (fuera de la zona segura), su relleno desenfocado:
  // un degradado oscuro lo vuelve un borde limpio
  P.capas = function (ctx, tt, extra, porId) {
    var p = porId.mano;
    if (!p || tt < p.de || tt >= p.a) return;
    var gr = ctx.createLinearGradient(0, 1470, 0, 1640);
    gr.addColorStop(0, 'rgba(43,22,48,0)'); gr.addColorStop(1, 'rgba(43,22,48,0.92)');
    ctx.save(); ctx.fillStyle = gr; ctx.fillRect(0, 1470, 1080, 450); ctx.restore();
  };
  var s = document.createElement('script');
  s.src = 'formatos/F07/plantilla.js';
  s.onload = function () { window.F07(P); };
  s.onerror = function () { window.__error = 'no se pudo cargar formatos/F07/plantilla.js'; };
  document.body.appendChild(s);
})();
