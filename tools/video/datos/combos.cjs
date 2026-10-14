// Tableros para los combos (cambiar dos especiales entre sí): tablero real del nivel 5 con los dos especiales al centro.
const Engine = require('../../../js/core/engine.js');
const Levels = require('../../../js/core/levels.js');
const COMBOS = {
  pp: { nombre: 'Paleta + Paleta', a: 'Fh', b: 'Lv' },
  pb: { nombre: 'Paleta + Bomba', a: 'Fh', b: 'Ub' },
  bb: { nombre: 'Bomba + Bomba', a: 'Bb', b: 'Nb' },
  cp: { nombre: 'Copa + Paleta', a: '@', b: 'Fh' },
  cb: { nombre: 'Copa + Bomba', a: '@', b: 'Ub' },
  cc: { nombre: 'Copa + Copa', a: '@', b: '@' },
};
const A = { r: 4, c: 3 }, B = { r: 4, c: 4 };
function filas(s) {
  return s.grid.map((row) => row.map((cell) => (cell && cell.p ? cell.p.color : '#')));
}
function tablero(clave) {
  const k = COMBOS[clave], lv = Levels.get(5);
  for (let seed = 1; seed < 500; seed++) {
    const g = filas(Engine.createGame(lv, seed));
    g[A.r][A.c] = k.a; g[B.r][B.c] = k.b;
    const rows = g.map((r) => r.join(' '));
    const st = Engine.fromRows(rows, { colors: 'LFBUN', seed: 5, movesLeft: 15, moves: 22 });
    if (Engine.isStable(st)) return { rows, a: A, b: B, opts: { levelId: 5, colors: 'LFBUN', seed: 5, movesLeft: 15, moves: 22, goals: [{ type: 'color', color: 'N', n: 99 }] } };
  }
  throw new Error('sin tablero para ' + clave);
}
module.exports = { COMBOS, tablero };
