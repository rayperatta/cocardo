/* Ejemplo de la edición «noticiero» de F05 (vista previa de la plantilla, no es un video para publicar).
   Datos: node tools/video/formatos/F05/generar.cjs D12-1 --rama 1 --salida dist/estudio/F05-prueba/noticiero
   Usa la toma de D02-1 solo para ver el encuadre: el video real captura su tablero (README de F05).
   Vista: node tools/video/formatos/F07/fotos.cjs "tools/video/montaje.html?m=formatos/F05/ejemplos/noticiero.js" <carpeta> 0,1,2,4 */
(function () {
  'use strict';
  var s = document.createElement('script');
  s.src = 'formatos/F05/plantilla.js';
  s.onload = function () {
    window.F05({
      datos: 'dist/estudio/F05-prueba/noticiero/reto.json',
      toma: 'D02-1-tablero',
      titular: 'CHERRY SIGUE PRÓFUGA',
      gancho: ['RETO DIARIO #30', '¿Dejas más de 11?'],
      reto: ['¿Dejas más de 11?', 'Pega tu fila'],
      vidente: false,
    });
  };
  document.body.appendChild(s);
})();
