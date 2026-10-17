/* Ejemplo de F05 con una fila larga y el bot honesto perdiendo (D22-1: 24 emojis; el que ve el relleno gana con 7).
   Datos: node tools/video/formatos/F05/generar.cjs D22-1 --salida dist/estudio/F05-prueba/largo
   Usa la toma de D02-1 solo para ver el encuadre. */
(function () {
  'use strict';
  var s = document.createElement('script');
  s.src = 'formatos/F05/plantilla.js';
  s.onload = function () {
    window.F05({
      datos: 'dist/estudio/F05-prueba/largo/reto.json',
      toma: 'D02-1-tablero',
      gancho: ['RETO DIARIO #40', '7 cascadas… y mi bot PERDIÓ'],
      reto: ['¿Tú la sacas?', 'Pega tu fila'],
    });
  };
  document.body.appendChild(s);
})();
