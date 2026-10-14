// Acertijo «¿A, B o C?» sobre el nivel 10 (congelador de Cocardo + Lima). Último movimiento; el congelador con 1 PV.
// Solo C gana: la Paleta horizontal de la fila 0 barre la fila y rompe congelador y bloque de Lima a la vez.
const FILAS = [
  'N I3 R Z Z N Fh F',
  'B N I3 Z Z F U L',
  'U L B U N B L N',
  'N F U L F U F B',
  'L B L U B L B U',
  'B F U N Uv N F L',
  'L L N L L U N B',
  'B U L F N L B N',
];
const OPCIONES = {
  A: { a: { r: 6, c: 2 }, b: { r: 7, c: 2 } },   // 5 en fila (fila 6): Copa Arcoíris… y nada más
  B: { a: { r: 4, c: 3 }, b: { r: 5, c: 3 } },   // Paleta vertical: rompe el congelador, Lima sigue congelada
  C: { a: { r: 0, c: 5 }, b: { r: 1, c: 5 } },   // Paleta horizontal arriba: rompe todo y gana
};
const OPTS = { levelId: 10, moves: 24, movesLeft: 1, colors: 'LFBUN', goals: [{ type: 'boss' }, { type: 'rescue' }],
  rescue: ['lima'], freezer: { who: 'cocardo', hp: 1 }, friendHP: 1, seed: 1,
  villains: [{ who: 'cocardo', act: 'frost', every: 4, count: 1, src: 'boss' }] };
module.exports = { FILAS, OPCIONES, OPTS };
