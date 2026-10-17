/* D02-3 «Los 16 personajes de mi juego» (formato F12, plantilla tools/video/formatos/F12/plantilla.js).
   El 07 (montajes/personajes.js) rehecho y más corto: los 10 principales dicen con su voz las líneas de
   parametros.lineas (tools/video/videos/D02-3/guion.json → dist/estudio/voz/D02-3.json), en su orden: víctimas (salen
   congeladas y la mano del tutorial rompe el hielo; Lima ya va rota en el cuadro 0), Banano, Don Piña, Cherry con el
   ¡TAN-TAN-TAAAN! (clímax) y Cocardo con su risa. Los 6 secundarios, en ráfaga y sin voz, con las etiquetas de la ficha
   (la reportera y el oficial Sandía con etiqueta neutra: sus cartas se abren en el nivel 30). Contador «n/16». */
(function () {
  'use strict';
  var s = document.createElement('script');
  s.src = 'formatos/F12/plantilla.js';
  s.onerror = function () { window.__error = 'no se pudo cargar formatos/F12/plantilla.js'; };
  s.onload = function () {
    window.F12({
      guion: 'dist/estudio/voz/D02-3.json',
      gancho: ['¿Cuántos personajes de Cocardo reconoces?', 'Son 16'],
      contador: 16,
      planos: [
        { id: 'lima', vic: true, humores: ['enojado', 'sorprendido'] },
        { id: 'fresa', vic: true, humores: ['feliz', 'enojado'] },
        { id: 'durazna', vic: true, humores: ['feliz', 'sorprendido'] },
        { id: 'uva', vic: true, humores: ['feliz', 'nervioso', 'feliz'] },
        { id: 'naranja', vic: true, humores: ['feliz', 'carcajada'], ret: { variant: 'panecitos' } },
        { id: 'banana', vic: true, humores: ['nervioso', 'sorprendido'] },
        { id: 'banano', humores: ['enojado', 'sorprendido'], entrada: 'golpe' },
        { id: 'pina', humores: ['normal', 'feliz'], villano: true, entrada: 'golpe' },
        { id: 'cereza', humores: ['coqueta', 'burlon'], villano: true, entrada: 'villain', tan: true },
        { id: 'cocardo', humores: ['burlon'], villano: true, entrada: 'villain', risa: true },
      ],
      rafaga: [
        { id: 'limon', tag: 'el del callejón' },
        { id: 'policia_fresa', tag: 'la oficial' },
        { id: 'policia_sandia', tag: 'el oficial' },
        { id: 'guardaespaldas', tag: 'el guardaespaldas' },
        { id: 'brocoli', tag: 'el repartidor' },
        { id: 'reportera', tag: 'la reportera' },
      ],
      cierre: { texto: '¿Cuántos reconociste?', sub: 'comenta tu número', dur: 1.25 },
      tarjeta: { cta: 'EMPIEZA GRATIS', sub: 'link en el perfil', pie: 'cocardo.app' },
      musica: 'tema',
    });
  };
  document.body.appendChild(s);
})();
