// Portada (con su animación de entrada) y un barrido del mapa del nivel 1 al 30, para el tráiler.
module.exports = {
  semilla: 1,
  async correr(T) {
    await T.pausar();
    await T.ev(() => Cocardo.UI.show('title'));
    await T.esperar(0.5);
    T.ritmo(30);
    await T.seguir();
    // se vuelve a insertar la portada para que su animación arranque desde cero (se arma una sola vez al cargar)
    await T.ev(() => { const s = document.getElementById('screen-title'); s.innerHTML = s.innerHTML; });
    await T.esperar(4.0);
    T.marca('mapa');
    await T.ev(() => Cocardo.UI.show('map'));
    await T.esperar(0.4);
    const max = await T.ev(() => { const sc = document.querySelector('#screen-map .map-scroll'); return sc.scrollHeight - sc.clientHeight; });
    const N = 105;
    for (let i = 0; i <= N; i++) {
      const k = i / N, e = k * k * (3 - 2 * k);
      await T.ev((v) => { document.querySelector('#screen-map .map-scroll').scrollTop = v; }, max * (1 - e));
      await T.paso();
    }
    await T.esperar(0.8);
  },
};
