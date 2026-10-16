// Nivel 13, semilla 45: en el último movimiento una jugada pierde por 1 y otra gana con 12 cascadas y rescata a Fresa.
// --var pierde|gana. Las jugadas 20-23 se graban a 12 fps (se ven aceleradas) y el final a 60.
const P = require('../plan.cjs');
module.exports = {
  semilla: 45,
  async correr(T, v) {
    const f = P.casi(13, 45, 0.25);
    const ultima = v === 'pierde' ? f.pierde[0] : f.gana.sort((a, b) => b.piezas - a.piezas)[0];
    await T.pausar();
    await T.ir(13, 45);
    await T.jugadas(f.prefijo, 0, 19, { antes: 0.05, entre: 0.05 });
    T.ritmo(12);
    await T.seguir();
    await T.jugadas(f.prefijo, 19, f.prefijo.length, { antes: 0.2 });
    T.ritmo(60);
    T.marca('ultimo-movimiento');
    await T.esperar(1.2);
    await T.deslizar(ultima.a, ultima.b, { antes: 0.3, dur: 0.2 });
    await T.paso();
    await T.quieto(40);
    T.marca('resuelto');
    await T.fin(40);
    T.marca('pantalla-final');
    await T.esperar(3.2);
  },
};
