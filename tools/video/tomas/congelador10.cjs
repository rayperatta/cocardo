// Nivel 10, semilla 101: el bot rompe el congelador viejo y libera a Lima en 8 jugadas (la última hace las dos cosas).
const P = require('../plan.cjs');
module.exports = {
  semilla: 101,
  async correr(T) {
    const J = P.jugar(10, 101, { peek: true }).jugadas;
    await T.pausar();
    await T.ir(10, 101);
    T.ritmo(30);
    await T.seguir();
    await T.esperar(0.8);
    await T.jugadas(J, 0, 7, { antes: 0.25 });
    T.ritmo(60);
    T.marca('ultima');
    await T.esperar(0.5);
    await T.jugadas(J, 7, 8, { antes: 0.35 });
    T.marca('ganado');
    T.ritmo(30);
    await T.fin(40);
    T.marca('victoria');
    await T.esperar(3.0);
  },
};
