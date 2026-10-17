// Catálogo de tomas con nombre: carpeta de dist/cap/ → archivo de tools/video/tomas/ y variante (--var).
// Los montajes piden las tomas por estos nombres (campo `tomas:`). Lo usa `capturar.cjs --todas`.
// Al agregar una toma nueva para un montaje, anótala aquí con el comando que la rehace.
module.exports = {
  // 03 cascada.js (y tráiler)
  cascada: { toma: 'cascada' },
  // 04 acertijo.js
  'acertijo2-A': { toma: 'acertijo', var: 'A' },
  'acertijo2-B': { toma: 'acertijo', var: 'B' },
  'acertijo2-C': { toma: 'acertijo', var: 'C' },
  // 05 casi.js (casi-gana también en rescates.js)
  'casi-pierde': { toma: 'casi13', var: 'pierde' },
  'casi-gana': { toma: 'casi13', var: 'gana' },
  // 06 congelador.js (congelador10 y hist-pre10 también en el tráiler; congelador10 en rescates.js)
  congelador10: { toma: 'congelador10' },
  'hist-pre10': { toma: 'historia', var: 'pre10' },
  'hist-post10': { toma: 'historia', var: 'post10' },
  // 08 combos.js (combo-cc también en el tráiler)
  'combo-pp': { toma: 'combo', var: 'pp' },
  'combo-bb': { toma: 'combo', var: 'bb' },
  'combo-pb': { toma: 'combo', var: 'pb' },
  'combo-cp': { toma: 'combo', var: 'cp' },
  'combo-cb': { toma: 'combo', var: 'cb' },
  'combo-cc': { toma: 'combo', var: 'cc' },
  // 09 cherry.js (cherry17 y hist-cliff15 también en el tráiler)
  'hist-cliff15': { toma: 'historia', var: 'cliff15' },
  'hist-pre16': { toma: 'historia', var: 'pre16' },
  'hist-pre17': { toma: 'historia', var: 'pre17' },
  cherry17: { toma: 'nivel', var: '17:1:3:6:30' },
  rosa25: { toma: 'nivel', var: '25:19:9:11:60' },
  'hist-cliff25': { toma: 'historia', var: 'cliff25' },
  // 10 clutch.js
  clutch23: { toma: 'nivel', var: '23:31:22:26:60' },
  // 11 rescates.js
  rescate15: { toma: 'rescate', var: '15' },
  rescate19: { toma: 'rescate', var: '19' },
  // 12 hielo.js
  hielo12: { toma: 'nivel', var: '12:1:0:8:60' },
  // 13 final.js (final30 también en el tráiler y en rescates.js)
  final30: { toma: 'final30' },
  'hist-pre30': { toma: 'historia', var: 'pre30' },
  'hist-ending': { toma: 'historia', var: 'ending' },
  // 02 trailer.js
  portada: { toma: 'portada' },
  'hist-pre2': { toma: 'historia', var: 'pre2' },
  // prueba-voces.js (prueba del motor de voces, no es un video para publicar)
  'prueba-hist': { toma: 'historia', var: 'cliff15', fps: 30 },
};
