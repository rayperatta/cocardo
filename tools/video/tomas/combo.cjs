// Combos de especiales (tools/video/datos/combos.cjs). --var pp|pb|bb|cp|cb|cc
const D = require('../datos/combos.cjs');
module.exports = {
  semilla: 5,
  async correr(T, v) {
    const t = D.tablero(v);
    await T.pausar();
    await T.ir(5, 5);
    await T.ev(([f, o]) => Cocardo.Game._setState(Cocardo.Engine.fromRows(f, o)), [t.rows, t.opts]);
    await T.esperar(1.5);
    await T.seguir();
    await T.esperar(0.7);
    await T.deslizar(t.a, t.b, { antes: 0.25, dur: 0.18 });
    await T.paso();
    await T.quieto(30);
    T.marca('resuelto');
    await T.esperar(1.0);
  },
};
