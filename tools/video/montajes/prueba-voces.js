/* Prueba del motor: voces con guion (dist/estudio/prueba/guion.json), voz suelta (audio.voces), subtítulos grandes, cuadro
   de diálogo del juego tapado (desenfoque, encuadre sin cuadro y placa), música externa y tarjeta final.
   Los WAV son señales sintéticas hechas con ffmpeg (no es voz real). Toma: dist/cap/prueba-hist
   (node tools/video/capturar.cjs tools/video/tomas/historia.cjs dist/cap/prueba-hist --fps 30 --var cliff15).
   Para medir el ducking: ?v=mudo deja solo la música (voces a 0, sin juego) y ?v=juego solo los sonidos del juego;
   con «-sin» al final (mudo-sin, juego-sin) sale igual pero sin ducking. */
(function () {
  'use strict';
  var K = window.K, C = K.C, W = K.W;
  var HIST = { z: 1, x: 540, y: 1410 };
  var v = new URLSearchParams(location.search).get('v') || '';
  var mudo = v.indexOf('mudo') === 0, soloJuego = v.indexOf('juego') === 0;
  // ?g=vozpy lee el mismo guion con la forma exacta que imprime tools/video/voz/voz.py (rutas absolutas en «ruta»)
  var fuente = /[?&]g=vozpy\b/.test(location.search) ? 'dist/estudio/prueba/guion-vozpy.json' : 'dist/estudio/prueba/guion.json';
  var g = K.guion(fuente, [0.4, null, 6.0, null], { pausa: 0.3, gain: mudo || soloJuego ? 0 : 1 });
  var LIMA = 0, TF = 0;

  K.montaje({
    // la duración sale del guion: voz de Lima tras la última línea y luego la tarjeta final
    dur: function () { LIMA = g.fin + 0.4; TF = LIMA + 2.3; return TF + 2.5; },
    tomas: { h: 'prueba-hist' },
    clips: [
      { toma: 'h', de: 0, a: 6, src: 0.3, libre: true, cam: [[0, HIST]], vineta: 0.25, tapa: true },
      { toma: 'h', de: 6, a: 10.5, src: 10.2, cam: [[6, K.CAM_SIN_CUADRO]], trans: 'barrido', vineta: 0.25 },
      { toma: 'h', de: 10.5, a: 40, src: 13.4, libre: true, cam: [[10.5, HIST]], trans: 'golpe', vineta: 0.25, tapa: 'placa' },
    ],
    capas: function (ctx, t) {
      if (t < 2.2) {
        K.sombraArriba(0.6, 520);
        K.palabras(t, 0.05, 'Prueba de voces y subtítulos', W / 2, 300, { size: 80, maxW: 840, ritmo: 0.07 });
      }
      // voz suelta (audio.voces) con su subtítulo a mano, arriba
      K.subtitulo(t, LIMA - 0.05, LIMA + 2.1, '¡Ayuda, estoy congelada!', { quien: 'lima', arriba: true, habla: [LIMA + 0.25, LIMA + 1.6] });
      if (t >= TF) K.tarjetaFinal(t, TF, { moodCherry: 'coqueta', moodCocardo: 'burlon' });
    },
    audio: {
      juego: mudo ? 0 : 1,
      voces: [{ archivo: 'dist/estudio/prueba/voz-lima.wav', t: 0, gain: mudo || soloJuego ? 0 : 1, quien: 'lima' }],
      musicaArchivo: soloJuego ? null : 'dist/estudio/prueba/musica-prueba.wav',
      ducking: /-sin$/.test(v) ? false : { musica: 0.3, juego: 0.6 },
      sfx: [['whoosh', 5.95, {}]],
    },
    antes: function () {
      // la voz suelta va a la hora que dejó el guion
      K.M.audio.voces[0].t = LIMA;
    },
  });
})();
