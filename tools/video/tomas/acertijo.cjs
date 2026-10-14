// Acertijo «¿A, B o C?» (tools/video/datos/acertijo.cjs): último movimiento en el nivel 10. --var A|B|C
const A = require('../datos/acertijo.cjs');
module.exports = {
  semilla: 10,
  async correr(T, v) {
    const op = A.OPCIONES[v || 'C'];
    await T.pausar();
    await T.ir(10, 1);
    await T.ev(([f, o]) => Cocardo.Game._setState(Cocardo.Engine.fromRows(f, o)), [A.FILAS, A.OPTS]);
    await T.esperar(1.5);
    await T.seguir();
    await T.esperar(1.2);
    await T.deslizar(op.a, op.b, { antes: 0.3, dur: 0.2 });
    await T.paso();
    await T.quieto(30);
    T.marca('resuelto');
    await T.fin(30);
    T.marca('pantalla-final');
    await T.esperar(3.0);
  },
};
