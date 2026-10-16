// Nivel 30 (final), semilla 3: Banana sale en la jugada 13 con combo y Uva en la ÚLTIMA (31). Ritmo variable.
const P = require('../plan.cjs');
module.exports = {
  semilla: 3,
  async correr(T) {
    const J = P.jugar(30, 3, { peek: true }).jugadas;
    await T.pausar();
    await T.ir(30, 3);
    T.ritmo(30);
    await T.seguir();
    await T.esperar(0.6);
    await T.jugadas(J, 0, 11, { antes: 0.2, ritmos: { 0: 10 } });
    T.ritmo(60); T.marca('banana');
    await T.jugadas(J, 11, 13, { antes: 0.25 });
    T.ritmo(10);
    await T.jugadas(J, 13, 27, { antes: 0.2 });
    T.ritmo(30); T.marca('congelador');
    await T.jugadas(J, 27, 30, { antes: 0.25 });
    T.ritmo(60); T.marca('ultima');
    await T.esperar(1.0);
    await T.jugadas(J, 30, 31, { antes: 0.4 });
    T.marca('ganado');
    await T.fin(40);
    T.ritmo(30);
    T.marca('victoria');
    await T.esperar(3.5);
  },
};
