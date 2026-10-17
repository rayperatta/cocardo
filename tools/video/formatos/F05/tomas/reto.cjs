// F05 «Reto de hoy #N»: el tablero del Reto Diario de un día, SIN JUGAR. --var AAAAMMDD[:segundos]
//   node tools/video/capturar.cjs tools/video/formatos/F05/tomas/reto.cjs dist/cap/<id>-tablero --var 20261020 --fps 30
// Abre el Reto con Cocardo.debug.today(AAAAMMDD) en modo práctica (practice: true), con el nivel y la semilla de
// js/core/daily.js (el mismo tablero para todos ese día), y graba la caída de las piezas (marca «intro») y el tablero
// quieto con el HUD (marca «tablero»). Nunca toca una ficha: ningún puntaje llega a daily/{día}/scores y no sale
// ninguna jugada. Quita la burbuja del villano (la burla de inicio es al azar) y vuelve a armar el temporizador de la
// pista cada 4 s (a los 6 s el juego enseñaría una jugada). Falla si el tablero de la página no es el del motor.
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const Engine = require(path.join(ROOT, 'js/core/engine.js'));
const Daily = require(path.join(ROOT, 'js/core/daily.js'));
const Levels = require(path.join(ROOT, 'js/core/levels.js'));

// firma del tablero: hueco, color y tipo de cada pieza y bloqueo con sus PV
function firma(grid) {
  return grid.map((fila) => fila.map((c) => (!c ? '#' : (c.p ? c.p.color + (c.p.type || '') + (c.p.frost ? '*' : '') : '_') +
    (c.b ? c.b.kind + c.b.hp : ''))).join(' ')).join('\n');
}

module.exports = {
  semilla: (v) => +String(v).split(':')[0],
  async correr(T, v) {
    const [k, segs] = String(v || '').split(':');
    const clave = +k;
    if (!/^\d{8}$/.test(k)) throw new Error('--var AAAAMMDD[:segundos]');
    const lv = Daily.levelFor(clave, Levels.list), seed = Daily.seedFor(clave);
    const num = Daily.challengeNumber(Math.floor(clave / 10000), Math.floor(clave / 100) % 100, clave % 100);
    const motor = firma(Engine.createGame(lv, seed).grid);
    await T.ev((c) => Cocardo.debug.today(c), clave);
    // la burbuja del villano no sale en ningún fotograma (su burla de inicio es al azar)
    await T.ev(() => { const st = document.createElement('style'); st.textContent = '.cg-bubble{display:none!important}'; document.head.appendChild(st); });
    // Se arranca desde la página (no desde la pantalla del Reto, que lee la fecha real): mismo nivel y semilla que
    // dailyInfo() ese día, en práctica.
    await T.ev(([c, n]) => {
      const D = Cocardo.Daily, L = D.levelFor(c);
      Cocardo.UI.startLevel(L.id, { daily: true, practice: true, dailyKey: c, dailyNum: n, seed: D.seedFor(c), level: L });
    }, [clave, num]);
    // la caída de las piezas se graba: el montaje la usa para volver al cuadro 0 (bucle)
    T.marca('intro');
    const ok = await T.jugable();
    if (!ok) throw new Error('el Reto no llegó a jugable');
    const pagina = await T.ev(() => {
      const st = Cocardo.Game._state();
      return { grid: st.grid, moves: st.movesLeft, daily: !!st.daily, practice: !!(Cocardo.UI._session() || {}).practice,
        hud: (document.querySelector('.cg-lvl') || {}).textContent || '' };
    });
    if (firma(pagina.grid) !== motor) throw new Error('el tablero de la página no es el del motor:\n' + firma(pagina.grid) + '\n---\n' + motor);
    if (pagina.moves !== lv.moves || !pagina.daily || !pagina.practice) throw new Error('no es el Reto en práctica: ' + JSON.stringify({ moves: pagina.moves, daily: pagina.daily, practice: pagina.practice }));
    T.tablero = await T.ev(() => {
      const st = Cocardo.Game._state(), a = Cocardo.Game._cellCenter(0, 0), b = Cocardo.Game._cellCenter(st.rows - 1, st.cols - 1);
      return { filas: st.rows, cols: st.cols, x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    });
    // HUD: caja de movimientos, meta y nombre (píxeles CSS → la plantilla los pasa a la toma ×2)
    const hud = await T.ev(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; };
      return { movs: r('.cg-moves'), titulo: r('.cg-lvl'), nombre: r('.cg-lvname'), meta: r('.cg-goals'), carta: r('.cg-card') };
    });
    T.marca('hud', hud);
    const limpiar = () => T.ev(() => {
      document.querySelectorAll('.cg-bubble').forEach((e) => e.remove());
      // pausa y sigue en el mismo instante: el juego vuelve a contar 6 s antes de la pista (nunca se ve una jugada)
      Cocardo.Game.pause(); Cocardo.Game.resume();
    });
    await limpiar();
    T.marca('tablero', { reto: num, clave, nivel: lv.id, movimientos: lv.moves, hud: pagina.hud });
    const total = +(segs || 9);
    for (let s = 0; s < total; s += 2) {
      for (let i = 0; i < Math.min(2, total - s) * T.fps; i++) {
        await T.paso();
        if (await T.ev(() => !!document.querySelector('.cg-peek.cg-in'))) throw new Error('salió la pista del juego (enseña una jugada)');
      }
      await limpiar();
    }
  },
};
