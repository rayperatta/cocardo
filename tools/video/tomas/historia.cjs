// Escenas de historia del juego a ritmo de lectura. --var <clave de js/story.js> (pre2, pre10, post10, cliff15…)
module.exports = {
  semilla: 3,
  async correr(T, clave) {
    await T.pausar();
    await T.ev(() => Cocardo.UI.show('map'));
    await T.esperar(1.0);
    T.ritmo(30);
    await T.seguir();
    await T.historia(clave, { lectura: 1.2 });
    await T.esperar(0.6);
  },
};
