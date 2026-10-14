// Utilidades de prueba para el motor (Node).
'use strict';
const assert = require('node:assert/strict');
const RNG = require('../js/core/rng.js');
const Engine = require('../js/core/engine.js');
const Replay = require('../js/core/replay.js');

const fromRows = Engine.fromRows;

// Reemplaza '.' por un relleno sin matches ni jugadas posibles (colores F,B,U,N).
function sketch(lines) {
  return lines.map((l, r) => l.trim().split(/\s+/).map((t, c) => (t === '.' ? 'FBUN'[(r + 2 * c) % 4] : t)).join(' '));
}
// Tablero exacto: '.' = relleno; exige estabilidad salvo opts.unstable.
function setup(lines, opts) {
  const s = fromRows(sketch(lines), opts || {});
  if (!(opts && opts.unstable)) assert.ok(Engine.isStable(s), 'el tablero de prueba tiene matches');
  return s;
}

// Dibuja la grilla como texto (misma notación que fromRows).
function show(state) {
  return state.grid.map((row) => row.map((cell) => {
    if (!cell) return '#';
    if (cell.b) {
      if (cell.b.kind === 'ice') return 'I' + cell.b.hp;
      if (cell.b.kind === 'crate') return 'K';
      if (cell.b.kind === 'friend') return 'R' + cell.b.hp;
      return 'Z';
    }
    if (!cell.p) return '_';
    const p = cell.p;
    if (p.type === 'copa') return '@';
    if (p.type === 'token') return p.skin === 'prueba' ? 'Tp' : 'T';
    return p.color + ({ n: '', ph: 'h', pv: 'v', bomba: 'b' }[p.type]) + (p.frost ? '*' : '');
  }).join(' ')).join('\n');
}

function events(steps, t) {
  const out = [];
  steps.forEach((s) => s.events.forEach((e) => { if (!t || e.t === t) out.push(e); }));
  return out;
}
function stepKinds(steps) { return steps.map((s) => s.kind); }
function cellAt(state, r, c) { return state.grid[r][c]; }
function pieceAt(state, r, c) { const cl = state.grid[r][c]; return cl && cl.p ? cl.p : null; }

// Invariantes de un estado estable.
function checkState(state) {
  const ids = new Set();
  state.grid.forEach((row, r) => row.forEach((cell, c) => {
    if (cell === null) return;
    assert.ok(cell.b || cell.p, `celda vacía en ${r},${c}`);
    assert.ok(!(cell.b && cell.p), `celda doble en ${r},${c}`);
    if (cell.p) {
      assert.ok(!ids.has(cell.p.id), `id duplicado ${cell.p.id}`);
      ids.add(cell.p.id);
      assert.ok(cell.p.id < state.nextId, 'id >= nextId');
      if (cell.p.type === 'token' || cell.p.type === 'copa') assert.equal(cell.p.color, null);
      else assert.ok(state.colors.includes(cell.p.color), 'color fuera del nivel');
      if (cell.p.frost) assert.equal(cell.p.type, 'n');
    }
  }));
  assert.ok(Engine.isStable(state), 'tablero no estable');
  state.goals.forEach((g) => assert.ok(g.remaining >= 0 && g.remaining <= g.target));
}

// Invariante principal: Replay(prev, steps) reproduce result.state.grid.
function checkReplay(prev, res) {
  const out = Replay.applyFull(prev, res.steps);
  assert.deepStrictEqual(out.grid, res.state.grid);
  if (prev.freezer) assert.equal(out.freezerHp, res.state.freezer.hp);
  const last = res.steps[res.steps.length - 1];
  if (last && last.kind !== 'invalid') {
    assert.equal(last.score, res.state.score, 'score del último paso');
    assert.equal(last.movesLeft, res.state.movesLeft, 'movesLeft del último paso');
    assert.deepStrictEqual(last.goals, res.state.goals.map((g) => g.remaining));
  }
}

// Niveles de muestra con todos los elementos.
const LEVELS = {
  basic: { id: 1, layout: Array(7).fill('.......'), colors: 'LFBU', moves: 20, goals: [{ type: 'color', color: 'L', n: 12 }] },
  ice: {
    id: 6, layout: ['11111111', '........', '........', '..222...', '..222...', '........', '........', '........'],
    colors: 'LFBUN', moves: 22, goals: [{ type: 'ice' }],
  },
  frostVillain: {
    id: 9, layout: ['........', '........', '.eeeeee.', '...##...', '...##...', '.eeeeee.', '........', '........'],
    colors: 'LFBUN', moves: 24, goals: [{ type: 'color', color: 'U', n: 25 }],
    villains: [{ who: 'cocardo', act: 'frost', every: 2, count: 2, src: 'hud' }],
  },
  boss: {
    id: 10, layout: ['........', '...CC...', '...CC...', '........', '........', '..1..1..', '...R....', '........'],
    colors: 'LFBUN', moves: 26, goals: [{ type: 'boss' }, { type: 'rescue' }], rescue: ['lima'], friendHP: 2,
    freezer: { who: 'cocardo', hp: 6 }, villains: [{ who: 'cocardo', act: 'frost', every: 2, count: 1, src: 'boss' }],
  },
  crates: {
    id: 20, layout: ['#KKKKKK#', '........', '........', '...CC...', '...CC...', '.KK..KK.', '........', 'KK....KK'],
    colors: 'LFBUND', moves: 28, goals: [{ type: 'boss' }, { type: 'crate', n: 10 }],
    freezer: { who: 'cocardo', hp: 5 },
    villains: [{ who: 'cocardo', act: 'frost', every: 3, count: 1, src: 'boss' }, { who: 'cereza', act: 'crate', every: 2, count: 1, src: 'hud' }],
  },
  tokens: {
    id: 24, layout: ['#T....T#', '........', '..KKKK..', 'K..##...', '...##..K', '..KKKK..', '.e....e.', '##....##'],
    colors: 'LFBUN', moves: 25, goals: [{ type: 'token' }, { type: 'crate', n: 10 }],
    tokens: { skin: 'prueba', total: 4, onBoard: 2 }, villains: [{ who: 'cereza', act: 'crate', every: 2, count: 1, src: 'hud' }],
  },
  final: {
    id: 30, layout: ['...CC...', '...CC...', '........', '111..111', '........', '.R....R.', '#......#', '##....##'],
    colors: 'LFBUND', moves: 30, goals: [{ type: 'boss' }, { type: 'rescue' }], rescue: ['uva', 'banana'], friendHP: 3,
    freezer: { who: 'cereza', hp: 7 }, villains: [{ who: 'cereza', act: 'frost', every: 2, count: 2, src: 'boss' }],
  },
  copaEnsure: { id: 5, layout: Array(8).fill('........'), colors: 'LFBUN', moves: 22, goals: [{ type: 'color', color: 'N', n: 20 }], ensure: 'copa' },
};

module.exports = { assert, RNG, Engine, Replay, fromRows, sketch, setup, show, events, stepKinds, cellAt, pieceAt, checkState, checkReplay, LEVELS };
