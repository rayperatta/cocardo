/* D02-2 «Por un hielo» (formato F03, plantilla tools/video/formatos/F03/plantilla.js).
   El 05 rehecho: nivel 13, semilla 45, partida de mi bot con 25 % de jugadas al azar (plan.cjs casi). En el último
   movimiento hay 13 jugadas posibles y solo UNA gana. El video enseña primero la que más cerca se queda
   (r3c3↔r4c3: 4 cascadas, libera a Fresa, se queda a 1 hielo en r7c0) y luego la única ganadora (r6c2↔r7c2, la Copa:
   12 cascadas, 129 piezas, rescata a Fresa). Lo comprueba generar.cjs → casi.json.
   OJO, la historia tiene que ser verdad: el bot NO perdió (en esa partida jugó la ganadora y ganó), así que el texto
   nunca dice «mi bot perdió» ni «me faltó»: dice «esta jugada pierde» y «¿ves la ÚNICA que gana?».
   Tomas: dist/cap/D02-2-pierde y D02-2-gana (tomas/casi.cjs de F03). Voz: la carcajada de Cocardo
   («Mañana habrá un sabor nuevo.», taunts.cocardo.lose de js/story.js) → dist/estudio/voz/D02-2.json.
   Arreglo propio (sin tocar la plantilla): en la pausa el tablero perdido se desenfoca, para que «¿Qué jugada harías
   TÚ?» no caiga encima del cartel «¡Sin movimientos!» ni de «¡Casi! Te falta 1» del juego. */
(function () {
  'use strict';
  var K = window.K;
  if (!K || !K.montaje) { window.__error = 'D02-2: el kit no está cargado'; return; }

  // Envuelve las capas de la plantilla: antes de dibujarlas, en la pausa (y hasta que la pregunta se va en el
  // rebobinado) se desenfoca el fotograma entero de la toma. Así la pausa parece pausa y no hay dos textos encima.
  var montajeOrig = K.montaje;
  K.montaje = function (M) {
    K.montaje = montajeOrig;
    var capas = M.capas;
    M.capas = function (ctx, t, o) {
      var T = window.F03 && window.F03.T;
      if (T && o && o.img && o.info && t >= T.PAUSA && t < T.RESP) {
        // entra de golpe con el rayón (si entra fundido, el cartel se lee bajo la pregunta los primeros cuadros) y se va
        // cuando la pregunta ya se fue (la pregunta se apaga de T.REB a T.REB + 0,25)
        var a = 1 - K.p(t, T.REB + 0.25, T.REB + 0.4);
        if (a > 0) {
          ctx.save();
          ctx.globalAlpha = a;
          K.tapa(o.img, o.info, { x0: -240, y0: -240, x1: 1320, y1: 2160, blur: 22, oscuro: 0.12 });
          ctx.restore();
        }
      }
      capas(ctx, t, o);
    };
    return montajeOrig.call(K, M);
  };

  var s = document.createElement('script');
  s.src = 'formatos/F03/plantilla.js';
  s.onerror = function () { window.__error = 'no se pudo cargar formatos/F03/plantilla.js'; };
  s.onload = function () {
    window.F03({
      datos: 'tools/video/videos/D02-2/casi.json',
      guion: 'dist/estudio/voz/D02-2.json',
      gancho: ['Esta jugada pierde por UN hielo.', '¿Ves la ÚNICA que gana?'],
      falto: '¡FALTÓ UN HIELO!',
      pregunta: '¿Qué jugada harías TÚ?',
      cierre: ['¿La viste a la primera?', 'comenta 👇'],
      cierreRetraso: 1.3,   // «¡GANÓ! x12» se apaga de T.WIN + 1,0 a + 1,25: el cierre entra cuando ya se fue (sin cruce)
    });
  };
  document.body.appendChild(s);
})();
