// F01 «¿Cuántas cascadas?»: una apertura en cascada de cualquier nivel, con la mano haciendo el cambio.
// Copia parametrizada de tools/video/tomas/cascada.cjs (que sigue fija en el nivel 4, semilla 2465).
//   --var <nivel>:<semilla>:<r,c>:<r,c>[:<r,c>:<r,c>…]
//   El primer par de celdas es la apertura en cascada; los pares siguientes (opcionales) son las jugadas de después.
//   Si la partida termina, espera la pantalla final (marca «victoria» o «derrota») y graba 3 s más.
// Ejemplos (fichas F01 del calendario; la jugada sale de `node tools/video/plan.cjs cascadas <niveles>`):
//   node tools/video/capturar.cjs tools/video/formatos/F01/tomas/cascada.cjs dist/cap/D05-2-cascada --var 5:76:4,5:4,6
//   node tools/video/capturar.cjs tools/video/formatos/F01/tomas/cascada.cjs dist/cap/D01-1-cascada --var 4:2465:7,2:7,3:4,5:5,5:6,6:7,6
// Con la variante del 03 (la segunda línea) sale fotograma a fotograma igual que tools/video/tomas/cascada.cjs.
// Marcas: «jugada» (al soltar el dedo), «fin-cascada», «jugada-fin» (tras cada jugada extra), «ganado», «victoria».
'use strict';

function leer(v) {
  const p = String(v || '').split(':');
  if (p.length < 4 || p.length % 2) throw new Error('--var <nivel>:<semilla>:<r,c>:<r,c>[:<r,c>:<r,c>…]');
  const celda = (s) => { const [r, c] = s.split(',').map(Number); return { r, c }; };
  const jugadas = [];
  for (let i = 2; i < p.length; i += 2) jugadas.push({ a: celda(p[i]), b: celda(p[i + 1]) });
  return { nivel: +p[0], semilla: +p[1], jugadas };
}

module.exports = {
  leer,
  semilla: (v) => leer(v).semilla,
  async correr(T, v) {
    const { nivel, semilla, jugadas } = leer(v);
    const termino = () => T.ev(() => { const st = Cocardo.Game._state(); return !st || st.status !== 'playing'; });
    await T.pausar();
    await T.ir(nivel, semilla);
    await T.seguir();
    await T.esperar(1.0);
    // la apertura: el dedo llega, se apoya y arrastra (la mano del tutorial que dibuja el montaje)
    await T.deslizar(jugadas[0].a, jugadas[0].b, { antes: 0.35, dur: 0.2 });
    await T.paso();
    await T.quieto(40);
    T.marca('fin-cascada');
    await T.esperar(0.6);
    for (let i = 1; i < jugadas.length; i++) {
      const ultima = i === jugadas.length - 1;
      if (!ultima) {
        await T.jugar(jugadas[i].a, jugadas[i].b, { antes: 0.25 });
        T.marca('jugada-fin', { i });
        await T.esperar(0.3);
      } else {
        await T.deslizar(jugadas[i].a, jugadas[i].b, { antes: 0.25 });
        await T.paso();
        await T.quieto(40);
        T.marca('jugada-fin', { i });
      }
      if (await termino()) break;
    }
    if (await termino()) {
      T.marca('ganado');
      await T.hasta(() => ['victory', 'defeat'].includes(Cocardo.debug.screen()), 40);
      T.marca(await T.ev(() => (Cocardo.debug.screen() === 'victory' ? 'victoria' : 'derrota')));
      await T.esperar(3.0);
    } else {
      await T.esperar(1.0);
    }
  },
};
