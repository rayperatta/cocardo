// F02 «Acertijo #N: ¿A, B o C?»: el último movimiento de un acertijo, una opción por toma.
// --var <acertijo.json>:<A|B|C>   (acertijo.json lo escribe tools/video/formatos/F02/generar.cjs; ruta desde la raíz)
//   ej.: node tools/video/capturar.cjs tools/video/formatos/F02/tomas/acertijo.cjs dist/cap/D07-3-A \
//          --var tools/video/videos/D07-3/acertijo.json:A
// Dos fuentes: «fijo» (tablero armado a mano con Engine.fromRows, como tools/video/datos/acertijo.cjs) o «plan» (la
// partida del bot de plan.cjs casi: nivel + semilla + jugadas previas, rehecha con el mismo motor dentro de la página).
// Igual que tools/video/tomas/acertijo.cjs: 1,5 s de preparación sin grabar, 1,2 s quieto, la jugada (dedo del tutorial),
// la resolución, la pantalla final y 3 s más. Comprueba que el juego dé lo mismo que el motor (gana o pierde).
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');

function leer(v) {
  const i = String(v || '').lastIndexOf(':');
  if (i < 0) throw new Error('--var <acertijo.json>:<A|B|C>');
  const ruta = v.slice(0, i), letra = v.slice(i + 1).toUpperCase();
  const D = JSON.parse(fs.readFileSync(path.resolve(ROOT, ruta), 'utf8'));
  const op = D.opciones && D.opciones[letra];
  if (!op) throw new Error(`${ruta} no tiene la opción ${letra}`);
  return { D, letra, op };
}

module.exports = {
  semilla: (v) => leer(v).D.semillaPagina || 12345,
  async correr(T, v) {
    const { D, letra, op } = leer(v);
    await T.pausar();
    if (D.fuente === 'fijo') {
      await T.ir(D.nivel, 1);
      await T.ev(([f, o]) => Cocardo.Game._setState(Cocardo.Engine.fromRows(f, o)), [D.filas, D.opts]);
    } else {
      await T.ir(D.nivel, D.partida.semilla);
      await T.ev(([n, s, pre]) => {
        let st = Cocardo.Engine.createGame(JSON.parse(JSON.stringify(Cocardo.Levels.get(n))), s);
        for (const m of pre) st = Cocardo.Engine.applySwap(st, m.a, m.b).state;
        return Cocardo.Game._setState(st);
      }, [D.nivel, D.partida.semilla, D.partida.prefijo]);
    }
    const quedan = await T.ev(() => Cocardo.Game._state().movesLeft);
    if (quedan !== 1) throw new Error(`el estado tiene ${quedan} movimientos, no 1`);
    await T.esperar(1.5);
    await T.seguir();
    await T.esperar(1.2);
    await T.deslizar(op.a, op.b, { antes: 0.3, dur: 0.2 });
    await T.paso();
    await T.quieto(30);
    T.marca('resuelto');
    await T.fin(30);
    const fin = await T.ev(() => Cocardo.Game._state().status);
    T.marca('pantalla-final', { letra, status: fin });
    if ((fin === 'won') !== !!op.gana) throw new Error(`la opción ${letra} dio «${fin}» en el juego y el motor dice ${op.gana ? 'gana' : 'pierde'}`);
    await T.esperar(3.0);
  },
};
