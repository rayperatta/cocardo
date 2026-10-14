/* Cocardo: ¡Rescate Helado! — RNG determinista (mulberry32). Puro: sin Math.random ni Date. */
(function () {
  'use strict';
  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  var RNG = {
    // Un paso de mulberry32. El estado (uint32) lo guarda quien llama.
    next: function (state) {
      var a = ((state >>> 0) + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: a };
    },
    // Hash estable FNV-1a sobre String(x) -> uint32.
    seedFrom: function (x) {
      var str = String(x);
      var h = 0x811C9DC5;
      for (var i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return h >>> 0;
    },
  };

  Cocardo.RNG = RNG;
  if (typeof module !== 'undefined' && module.exports) module.exports = RNG;
})();
