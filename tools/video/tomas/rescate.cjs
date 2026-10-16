// Momento de rescate de un nivel (sin grabar lo de antes). --var 15 (Durazna, semilla 63) | 19 (Naranja, semilla 40)
const P = require('../plan.cjs');
const CASOS = { 15: { semilla: 63 }, 19: { semilla: 40 } };
module.exports = {
  semilla: (v) => CASOS[v].semilla,
  async correr(T, v) {
    const s = CASOS[v].semilla, J = P.jugar(+v, s, { peek: true }).jugadas;
    const k = J.findIndex((j) => j.rescates.length);
    await T.pausar();
    await T.ir(+v, s);
    await T.jugadas(J, 0, k, { antes: 0.05, entre: 0.05 });
    await T.esperar(0.5);
    await T.seguir();
    await T.esperar(0.8);
    await T.jugadas(J, k, k + 1, { antes: 0.35 });
    T.marca('rescate');
    await T.esperar(2.5);
  },
};
