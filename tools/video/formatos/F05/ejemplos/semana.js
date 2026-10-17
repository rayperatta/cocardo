/* Ejemplo de la edición «semana» de F05 («la semana de mi bot», la rama sin ranking del salón de la fama).
   Datos: node tools/video/formatos/F05/generar.cjs D14-2 --rama 1 --salida dist/estudio/F05-prueba/semana
   Usa la toma de D02-1 solo para ver el encuadre: el video real captura el tablero de su Reto (README de F05).
   Vista: node tools/video/formatos/F07/fotos.cjs "tools/video/montaje.html?m=formatos/F05/ejemplos/semana.js" <carpeta> 0,1,2,4 */
(function () {
  'use strict';
  var s = document.createElement('script');
  s.src = 'formatos/F05/plantilla.js';
  s.onload = function () {
    window.F05({
      datos: 'dist/estudio/F05-prueba/semana/reto.json',
      toma: 'D02-1-tablero',
      pregunta: '¿Tú ganaste el #31?',
      gancho: ['HOY: RETO #32', '¿Tú lo ganas?'],
    });
  };
  document.body.appendChild(s);
})();
