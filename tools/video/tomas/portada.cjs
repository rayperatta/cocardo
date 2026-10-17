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
    // Desde abajo (nivel 1) hasta el borde de arriba de la zona del nivel 30. Desde el 17 oct el mapa sigue con los
    // capítulos en obra (31-120): subir hasta scrollTop 0 terminaba en la temporada 4 bajo el texto «30 niveles».
    const { max, fin } = await T.ev(() => {
      const sc = document.querySelector('#screen-map .map-scroll');
      const max = sc.scrollHeight - sc.clientHeight;
      const y = (el) => el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
      const n30 = sc.querySelector('.node[data-level="30"]');
      if (!n30) throw new Error('el mapa no tiene el nivel 30');
      const c = y(n30) + n30.offsetHeight / 2;
      const zona = Array.from(sc.querySelectorAll('.zone')).find((z) => y(z) <= c && c < y(z) + z.offsetHeight);
      return { max, fin: Math.max(0, Math.min(max, zona ? y(zona) : 0)) };
    });
    const N = 105;
    for (let i = 0; i <= N; i++) {
      const k = i / N, e = k * k * (3 - 2 * k);
      await T.ev((v) => { document.querySelector('#screen-map .map-scroll').scrollTop = v; }, max - (max - fin) * e);
      await T.paso();
    }
    await T.esperar(0.8);
  },
};
