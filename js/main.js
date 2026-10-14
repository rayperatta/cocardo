/* Cocardo: ¡Rescate Helado! — Arranque.
 * Carga el guardado, aplica ajustes (sonido, movimiento reducido), muestra la Portada,
 * conecta el redimensionado con Cocardo.Game.resize() y expone los ganchos de depuración (#debug). */
(function () {
  'use strict';

  var Cocardo = (window.Cocardo = window.Cocardo || {});

  function boot() {
    if (Cocardo._booted) return;
    Cocardo._booted = true;

    try { Cocardo.Save.load(); } catch (e) { console.error('[Cocardo.Save.load]', e); }

    var UI = Cocardo.UI;
    UI.applySettings();
    UI.init();

    // Ganchos para pruebas automáticas (ARQUITECTURA §12)
    var debugOn = false;
    try { debugOn = location.hash === '#debug' || Cocardo.debugEnabled === true; } catch (e) { debugOn = !!Cocardo.debugEnabled; }
    if (debugOn) {
      Cocardo.debug = UI.makeDebug();
      document.documentElement.classList.add('debug');
    }

    UI.show('title');

    // El tablero se adapta a cambios de tamaño (ui.js también redibuja el camino del mapa)
    var raf = 0;
    function onResize() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        if (UI.current() === 'game' && Cocardo.Game && typeof Cocardo.Game.resize === 'function') {
          try { Cocardo.Game.resize(); } catch (e) { console.error('[Cocardo.Game.resize]', e); }
        }
      });
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
