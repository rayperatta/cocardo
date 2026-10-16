// Tramo de una partida del bot: --var <nivel>:<semilla>:<desde>:<hasta>[:fps]  (jugadas desde..hasta-1, se graba desde «desde»)
const P = require('../plan.cjs');
module.exports = {
  semilla: (v) => +v.split(':')[1],
  async correr(T, v) {
    const [n, s, desde, hasta, fps] = v.split(':').map(Number);
    const J = P.jugar(n, s, { peek: true }).jugadas;
    await T.pausar();
    await T.ir(n, s);
    await T.jugadas(J, 0, desde, { antes: 0.05, entre: 0.05 });
    await T.esperar(0.5);
    T.ritmo(fps || 60);
    await T.seguir();
    await T.esperar(0.6);
    await T.jugadas(J, desde, hasta, { antes: 0.3, entre: 0.3 });
    if (hasta >= J.length) { await T.fin(40); T.marca('pantalla-final'); }
    await T.esperar(2.0);
  },
};
