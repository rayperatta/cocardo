// Pruebas del motor puro (node --test tests/).
'use strict';
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const H = require('./helpers.js');
const { assert, RNG, Engine, Replay, setup, events, stepKinds, pieceAt, checkState, checkReplay, LEVELS } = H;

const P = (r, c) => ({ r, c });
const stepsOf = (res, kind, cas) => res.steps.filter((s) => s.kind === kind && (cas === undefined || s.cascade === cas));
const evIn = (steps, t) => events(steps, t);

// ---------------------------------------------------------------- RNG
test('RNG: mulberry32 determinista y seedFrom estable', () => {
  let s = RNG.seedFrom(20261014);
  assert.equal(s, RNG.seedFrom('20261014'));
  assert.notEqual(RNG.seedFrom('a'), RNG.seedFrom('b'));
  const seq1 = [], seq2 = [];
  let a = s, b = s;
  for (let i = 0; i < 100; i++) {
    const x = RNG.next(a); a = x.state; seq1.push(x.value);
    const y = RNG.next(b); b = y.state; seq2.push(y.value);
    assert.ok(x.value >= 0 && x.value < 1);
    assert.ok(Number.isInteger(x.state) && x.state >= 0 && x.state <= 0xFFFFFFFF);
  }
  assert.deepStrictEqual(seq1, seq2);
  // valor conocido de mulberry32 con semilla 0
  assert.equal(RNG.next(0).value, 0.26642920868471265);
});

// ---------------------------------------------------------------- detección
test('detección: horizontal, vertical, L, T, cruz y línea de 5', () => {
  const det = (lines) => Engine.findMatches(setup(lines, { unstable: true }));
  let g = det(['. . . . . .', 'L L L . . .', '. . . . . .', '. . . . . .', '. . . . . .']);
  assert.equal(g.length, 1);
  assert.deepStrictEqual(g[0].cells, [P(1, 0), P(1, 1), P(1, 2)]);
  assert.equal(g[0].special, null);
  assert.equal(g[0].runs[0].dir, 'h');

  g = det(['. . L . .', '. . L . .', '. . L . .', '. . L . .', '. . . . .']);
  assert.equal(g.length, 1);
  assert.equal(g[0].runs[0].dir, 'v');
  assert.equal(g[0].special, 'pv');

  g = det(['. . . . . .', '. . L L L L', '. . . . . .', '. . . . . .']);
  assert.equal(g[0].special, 'ph');

  // L
  g = det(['L . . . .', 'L . . . .', 'L L L . .', '. . . . .', '. . . . .']);
  assert.equal(g.length, 1);
  assert.equal(g[0].cells.length, 5);
  assert.equal(g[0].special, 'bomba');
  assert.deepStrictEqual(g[0].runs.map((r) => r.dir).sort(), ['h', 'v']);

  // T
  g = det(['L L L . .', '. L . . .', '. L . . .', '. . . . .', '. . . . .']);
  assert.equal(g.length, 1);
  assert.equal(g[0].cells.length, 5);
  assert.equal(g[0].special, 'bomba');

  // cruz
  g = det(['. . L . .', '. L L L .', '. . L . .', '. . . . .', '. . . . .']);
  assert.equal(g.length, 1);
  assert.equal(g[0].cells.length, 5);
  assert.equal(g[0].special, 'bomba');

  // línea de 5 y de 6
  g = det(['. . . . . .', '. . . . . .', '. . . . . .', 'L L L L L .', '. . . . . .']);
  assert.equal(g[0].special, 'copa');
  g = det(['. . . . . .', '. . . . . .', 'L L L L L L', '. . . . . .']);
  assert.equal(g[0].special, 'copa');
  // 5 + cruce: la Copa tiene prioridad sobre la Bomba
  g = det(['. . L . . .', '. . L . . .', 'L L L L L .', '. . . . . .', '. . . . . .']);
  assert.equal(g.length, 1);
  assert.equal(g[0].special, 'copa');

  // dos grupos separados
  g = det(['L L L . . .', '. . . . . .', '. . . D D D', '. . . . . .']);
  assert.equal(g.length, 2);
  assert.deepStrictEqual(g.map((x) => x.color), ['L', 'D']);
});

test('detección: escarcha y especiales cuentan; Copa, ficha, vacío y bloqueos cortan', () => {
  const det = (lines) => Engine.findMatches(setup(lines, { unstable: true }));
  assert.equal(det(['. . . . .', 'L L* L . .', '. . . . .', '. . . . .']).length, 1);
  assert.equal(det(['. . . . .', 'L Lh Lb . .', '. . . . .', '. . . . .']).length, 1);
  assert.equal(det(['. . . . .', 'L L @ L L', '. . . . .', '. . . . .']).length, 0);
  assert.equal(det(['. . . . .', 'L L T L L', '. . . . .', '. . . . .']).length, 0);
  assert.equal(det(['. . . . .', 'L L # L L', '. . . . .', '. . . . .']).length, 0);
  assert.equal(det(['. . . . .', 'L L K L L', '. . . . .', '. . . . .']).length, 0);
  assert.equal(det(['. . . . .', 'L L I2 L L', '. . . . .', '. . . . .']).length, 0);
});

// ---------------------------------------------------------------- especiales: prioridad y lugar
function createsOf(res, cas) { return evIn(stepsOf(res, 'create', cas), 'create'); }

test('lugar (a): en la cascada 1 el especial nace en la celda intercambiada', () => {
  const s = setup(['. . . . . .', '. L . . . .', 'L . L L . .', '. . . . . .', '. . . . . .']);
  for (const [a, b] of [[P(1, 1), P(2, 1)], [P(2, 1), P(1, 1)]]) {
    const res = Engine.applySwap(s, a, b);
    assert.equal(res.turnInfo.valid, true);
    const cr = createsOf(res, 1);
    assert.equal(cr.length, 1);
    assert.deepStrictEqual([cr[0].type, cr[0].color, cr[0].r, cr[0].c], ['ph', 'L', 2, 1]); // no el centro (2,2)
    checkReplay(s, res);
  }
  // vertical de 4 -> pv en la celda intercambiada
  const v = setup(['. . L . .', '. . L . .', '. L . . .', '. . L . .', '. . . . .']);
  const rv = Engine.applySwap(v, P(2, 1), P(2, 2));
  const cv = createsOf(rv, 1);
  assert.deepStrictEqual([cv[0].type, cv[0].r, cv[0].c], ['pv', 2, 2]);
  // 5 en línea -> Copa sin color
  const c5 = setup(['. . . . . .', '. . L . . .', 'L L . L L .', '. . . . . .', '. . . . . .']);
  const rc = Engine.applySwap(c5, P(1, 2), P(2, 2));
  const cc = createsOf(rc, 1);
  assert.deepStrictEqual([cc[0].type, cc[0].color, cc[0].r, cc[0].c], ['copa', null, 2, 2]);
  assert.ok(rc.state.stats.specials >= 1);
  assert.ok(rc.turnInfo.specials >= 1);
});

test('lugar (b): Bomba en el cruce (cascada 2, sin regla a)', () => {
  const s = setup([
    '. . . . .',
    '. . . . .',
    '. . L . D',
    'L L D D .',
    '. . L . .',
    '. . L . .',
  ], { colors: 'FBUN' });
  const res = Engine.applySwap(s, P(2, 4), P(3, 4));
  assert.equal(res.turnInfo.valid, true);
  const c2 = createsOf(res, 2).filter((e) => e.color === 'L');
  assert.equal(c2.length, 1);
  assert.deepStrictEqual([c2[0].type, c2[0].r, c2[0].c], ['bomba', 3, 2]);
  checkReplay(s, res);
});

test('lugar (c): corrida más larga desde ⌊len/2⌋, luego el resto en orden', () => {
  // la celda intercambiada tiene un especial -> no califica; el centro (2,2) sí
  let s = setup(['. . . . . .', '. Lh . . . .', 'L . L L . .', '. . . . . .', '. . . . . .']);
  let res = Engine.applySwap(s, P(1, 1), P(2, 1));
  let cr = createsOf(res, 1);
  assert.deepStrictEqual([cr[0].type, cr[0].r, cr[0].c], ['ph', 2, 2]);
  checkReplay(s, res);
  // el centro está escarchado -> primer resto de la corrida: (2,0)
  s = setup(['. . . . . .', '. Lh . . . .', 'L . L* L . .', '. . . . . .', '. . . . . .']);
  res = Engine.applySwap(s, P(1, 1), P(2, 1));
  cr = createsOf(res, 1);
  assert.deepStrictEqual([cr[0].type, cr[0].r, cr[0].c], ['ph', 2, 0]);
  checkReplay(s, res);
});

test('lugar (d): resto del grupo en orden de lectura; sin candidato no hay especial', () => {
  let s = setup([
    '. . . . . .',
    '. . Lh . . .',
    'L* L* . L* . .',
    '. . L . . .',
    '. . L . . .',
    '. . . . . .',
  ]);
  let res = Engine.applySwap(s, P(1, 2), P(2, 2));
  let cr = createsOf(res, 1).filter((e) => e.color === 'L');
  assert.deepStrictEqual([cr[0].type, cr[0].r, cr[0].c], ['bomba', 3, 2]);
  checkReplay(s, res);
  // grupo de 4 sin celdas elegibles -> no se crea nada en la cascada 1
  s = setup(['. . . . . .', '. . Lh . . .', 'L* L* . L* . .', '. . . . . .', '. . . . . .']);
  res = Engine.applySwap(s, P(1, 2), P(2, 2));
  assert.equal(createsOf(res, 1).length, 0);
  checkReplay(s, res);
});

// ---------------------------------------------------------------- gravedad
test('gravedad: salta vacíos, bloqueos y escarcha; aparición desde filas negativas', () => {
  const s = setup([
    '. . . .',
    '. . . .',
    'D* K . .',
    '# . . .',
    '. . L .',
    'L L . .',
  ]);
  const id = (r, c) => pieceAt(s, r, c).id;
  const res = Engine.applySwap(s, P(4, 2), P(5, 2));
  assert.equal(res.turnInfo.valid, true);
  const fall = stepsOf(res, 'fall', 1)[0];
  const falls = fall.events.filter((e) => e.t === 'fall');
  const fmap = {};
  falls.forEach((e) => { fmap[e.id] = e; });
  const expectMove = (r, c, tr) => {
    const e = fmap[id(r, c)];
    assert.ok(e, `falta caída de ${r},${c}`);
    assert.deepStrictEqual([e.from, e.to], [P(r, c), P(tr, c)]);
  };
  // columna 0: slots 0,1,4,5 (r2 escarcha, r3 vacío)
  expectMove(4, 0, 5); expectMove(1, 0, 4); expectMove(0, 0, 1);
  // columna 1: slots 0,1,3,4,5 (r2 caja)
  expectMove(4, 1, 5); expectMove(3, 1, 4); expectMove(1, 1, 3); expectMove(0, 1, 1);
  // la escarcha y la caja no se mueven
  assert.equal(pieceAt(res.state, 2, 0).id, id(2, 0));
  assert.equal(pieceAt(res.state, 2, 0).frost, true);
  assert.equal(res.state.grid[2][1].b.kind, 'crate');
  assert.equal(res.state.grid[3][0], null);
  assert.equal(fmap[id(2, 0)], undefined);
  // apariciones: una por columna afectada, desde -1, en la fila 0
  const spawns = fall.events.filter((e) => e.t === 'spawn');
  assert.equal(spawns.length, 3);
  spawns.forEach((e) => { assert.equal(e.from, -1); assert.equal(e.to.r, 0); assert.equal(e.type, 'n'); });
  checkReplay(s, res);
});

test('gravedad: varias apariciones se apilan en -1, -2, -3', () => {
  const s = setup(['. . . .', '. . . .', '. L . .', '. L . .', '. . L .', '. . . .']);
  // vertical L en columna 1 (filas 2..4) tras mover L de (4,2) a (4,1)
  const res = Engine.applySwap(s, P(4, 2), P(4, 1));
  const sp = stepsOf(res, 'fall', 1)[0].events.filter((e) => e.t === 'spawn' && e.to.c === 1);
  assert.deepStrictEqual(sp.map((e) => [e.to.r, e.from]).sort((a, b) => a[0] - b[0]), [[0, -3], [1, -2], [2, -1]]);
  checkReplay(s, res);
});

// ---------------------------------------------------------------- fichas
test('fichas: se recolectan en el slot más bajo; reaparecen según onBoard/total', () => {
  const s = setup([
    '. . . .',
    '. . . .',
    '. . . .',
    '. . . .',
    'T . L .',
    'L L . .',
  ], { tokens: { skin: 'uva', total: 2, onBoard: 1 }, goals: [{ type: 'token' }] });
  assert.equal(s.tokens.spawned, 1);
  const tokId = pieceAt(s, 4, 0).id;
  const res = Engine.applySwap(s, P(4, 2), P(5, 2));
  const f = stepsOf(res, 'fall', 1);
  assert.ok(f.length >= 2);
  const col = evIn([f[0]], 'collect');
  assert.equal(col.length, 1);
  assert.deepStrictEqual([col[0].id, col[0].r, col[0].c, col[0].skin], [tokId, 5, 0, 'uva']);
  assert.ok(evIn([f[0]], 'fall').some((e) => e.id === tokId && e.to.r === 5));
  // en el siguiente paso de caída aparece la nueva ficha en la columna 0 (única con huecos)
  const tsp = evIn([f[1]], 'spawn').filter((e) => e.type === 'token');
  assert.equal(tsp.length, 1);
  assert.deepStrictEqual([tsp[0].to.c, tsp[0].to.r, tsp[0].skin, tsp[0].color], [0, 0, 'uva', null]);
  assert.equal(res.state.tokens.collected, 1);
  assert.equal(res.state.tokens.spawned, 2);
  assert.equal(res.state.goals[0].remaining, 1);
  assert.ok(evIn(res.steps, 'points').some((e) => e.value === 500));
  checkReplay(s, res);
});

test('fichas: el slot más bajo queda sobre la escarcha; ignoran rayos y Copas', () => {
  const s = setup([
    '. . . .',
    '. . . .',
    '. . . .',
    'T . L .',
    'L L . .',
    'D* . . .',
  ], { tokens: { skin: 'prueba', total: 1, onBoard: 1 }, goals: [{ type: 'token' }, { type: 'color', color: 'L', n: 50 }] });
  const res = Engine.applySwap(s, P(3, 2), P(4, 2));
  const col = evIn(res.steps, 'collect');
  assert.equal(col.length, 1);
  assert.deepStrictEqual([col[0].r, col[0].c, col[0].skin], [4, 0, 'prueba']);
  assert.equal(res.state.goals[0].remaining, 0);
  checkReplay(s, res);

  // un rayo (Chorro) y un combo Copa+Copa no tocan la ficha
  const b = setup(['. . . . .', 'T . . . .', '. . . . .', '. . @ @ .', '. . . . .']);
  const tid = pieceAt(b, 1, 0).id;
  const ch = Engine.useBooster(b, 'chorro', P(1, 3));
  assert.ok(!evIn(ch.steps, 'clear').some((e) => e.id === tid));
  const cc = Engine.applySwap(b, P(3, 2), P(3, 3));
  assert.ok(!evIn(cc.steps, 'clear').some((e) => e.id === tid));
  checkReplay(b, ch); checkReplay(b, cc);
  // Copa con ficha: inválido; ficha con normal: solo si hace match
  const t2 = setup(['. . . . .', '. T @ . .', '. . . . .', '. . . . .']);
  assert.equal(Engine.canSwap(t2, P(1, 1), P(1, 2)), false);
  assert.equal(Engine.applySwap(t2, P(1, 1), P(1, 2)).turnInfo.valid, false);
  const t3 = setup(['. . . . .', 'L L T . .', '. . L . .', '. . . . .']);
  assert.equal(Engine.canSwap(t3, P(1, 2), P(2, 2)), true);
  assert.equal(Engine.canSwap(t3, P(1, 2), P(1, 3)), false);
});

// ---------------------------------------------------------------- combos
const COMBO_BOARD = (x, y) => [
  '. . . . . . .',
  '. . . . . . .',
  '. . . . . . .',
  `. . . ${x} ${y} . .`,
  '. . . . . . .',
  '. . . . . . .',
  '. . . . . . .',
];
function comboRes(x, y, extra) {
  const lines = COMBO_BOARD(x, y);
  if (extra) extra(lines);
  const s = setup(lines, { colors: 'LFBUND' });
  const res = Engine.applySwap(s, P(3, 3), P(3, 4));
  assert.equal(res.turnInfo.valid, true);
  assert.equal(res.turnInfo.combo, true);
  assert.equal(res.state.stats.combos, 1);
  checkReplay(s, res);
  const st = res.steps[1];
  assert.equal(st.kind, 'activate');
  const combo = st.events.find((e) => e.t === 'combo');
  assert.ok(combo);
  assert.deepStrictEqual([combo.r, combo.c], [3, 4]);
  return { s, res, st, combo };
}
const keyset = (cells) => new Set(cells.map((q) => q.r * 10 + q.c));

test('combo Paleta+Paleta (ph+ph, ph+pv, pv+pv): fila y columna de b', () => {
  for (const [x, y] of [['Lh', 'Dh'], ['Lh', 'Dv'], ['Lv', 'Dv']]) {
    const { st, combo } = comboRes(x, y);
    assert.equal(combo.cells.length, 13);
    const ks = keyset(combo.cells);
    for (let i = 0; i < 7; i++) { assert.ok(ks.has(30 + i)); assert.ok(ks.has(i * 10 + 4)); }
    assert.equal(st.events.filter((e) => e.t === 'clear').length, 11);
    assert.equal(combo.ids.length, 2);
  }
});

test('combo Paleta+Bomba: 3 filas y 3 columnas; Bomba+Bomba: 5×5', () => {
  let { st, combo } = comboRes('Lh', 'Db');
  assert.equal(combo.cells.length, 33);
  assert.equal(st.events.filter((e) => e.t === 'clear').length, 31);
  ({ st, combo } = comboRes('Lb', 'Db'));
  assert.equal(combo.cells.length, 25);
  const ks = keyset(combo.cells);
  for (let r = 1; r <= 5; r++) for (let c = 2; c <= 6; c++) assert.ok(ks.has(r * 10 + c));
  assert.equal(st.events.filter((e) => e.t === 'clear').length, 23);
});

function withL(lines) {
  // piezas L sueltas (sin formar corridas) + una L escarchada
  const put = (r, c, t) => { const row = lines[r].split(' '); row[c] = t; lines[r] = row.join(' '); };
  put(0, 0, 'L'); put(0, 6, 'L'); put(6, 0, 'L'); put(6, 6, 'L'); put(5, 1, 'L*');
}

test('combo Copa+Paleta: toda L normal no escarchada se vuelve Paleta y todas disparan en la ola 0', () => {
  const { res, st, combo } = comboRes('Lh', '@', withL);
  const tr = st.events.filter((e) => e.t === 'transform');
  assert.equal(tr.length, 4);
  tr.forEach((e) => { assert.ok(e.type === 'ph' || e.type === 'pv'); assert.equal(e.color, 'L'); });
  assert.ok(!tr.some((e) => e.r === 5 && e.c === 1));
  assert.equal(combo.ids.length, 1); // solo se quita la Copa
  assert.deepStrictEqual(combo.types, ['ph', 'copa']);
  const wave0 = res.steps[2];
  assert.equal(wave0.kind, 'activate');
  const acts = wave0.events.filter((e) => e.t === 'activate');
  assert.equal(acts.length, 5);
  assert.deepStrictEqual([acts[0].r, acts[0].c, acts[0].type], [3, 4, 'ph']); // la Paleta original
});

test('combo Copa+Bomba: las L se vuelven Bombas', () => {
  const { res, st } = comboRes('@', 'Lb', withL);
  const tr = st.events.filter((e) => e.t === 'transform');
  assert.equal(tr.length, 4);
  tr.forEach((e) => assert.equal(e.type, 'bomba'));
  const acts = res.steps[2].events.filter((e) => e.t === 'activate');
  assert.equal(acts.length, 5);
  assert.deepStrictEqual([acts[0].r, acts[0].c], [3, 3]);
});

test('combo Copa+Copa: quita todo, escarcha solo se rompe, 1 daño por bloqueo, especiales sin disparar, fichas intactas', () => {
  const lines = [
    'Z Z . T . . .',
    'Z Z . . . . .',
    '. . . . . . .',
    '. . . @ @ . .',
    '. . . . . Dh .',
    '. . . . . . K',
    'I2 . . D* . . I1',
  ];
  const s = setup(lines, { colors: 'LFBUND', freezer: { who: 'cocardo', hp: 5 }, goals: [{ type: 'boss' }, { type: 'ice' }, { type: 'crate', n: 3 }] });
  const res = Engine.applySwap(s, P(3, 3), P(3, 4));
  checkReplay(s, res);
  const st = res.steps[1];
  const ev = st.events;
  const tok = pieceAt(s, 0, 3).id, dh = pieceAt(s, 4, 5).id, fr = pieceAt(s, 6, 3).id;
  assert.ok(!ev.some((e) => e.t === 'clear' && e.id === tok));
  assert.ok(ev.some((e) => e.t === 'clear' && e.id === dh));
  assert.ok(!ev.some((e) => e.t === 'activate'));
  assert.ok(ev.some((e) => e.t === 'unfrost' && e.id === fr));
  assert.ok(!ev.some((e) => e.t === 'clear' && e.id === fr));
  const fz = ev.filter((e) => e.t === 'damage' && e.kind === 'freezer');
  assert.equal(fz.length, 1);
  assert.equal(fz[0].hp, 4);
  assert.ok(ev.some((e) => e.t === 'damage' && e.kind === 'ice' && e.r === 6 && e.c === 0 && e.hp === 1));
  assert.ok(ev.some((e) => e.t === 'destroy' && e.kind === 'ice' && e.r === 6 && e.c === 6));
  assert.ok(ev.some((e) => e.t === 'destroy' && e.kind === 'crate'));
  // todas las piezas normales (no escarchadas) se fueron: 49 - 4 Z - 3 bloqueos - 2 copas - ficha - escarchada = 38
  assert.equal(ev.filter((e) => e.t === 'clear').length, 38);
  assert.equal(stepsOf(res, 'activate').length, 1);
});

test('Copa + normal: quita la Copa y todas las de ese color; escarcha se rompe; especiales del color disparan', () => {
  const lines = COMBO_BOARD('@', 'L');
  withL(lines);
  const row0 = lines[0].split(' '); row0[3] = 'Lv'; lines[0] = row0.join(' ');
  const s = setup(lines, { colors: 'LFBUND', goals: [{ type: 'color', color: 'L', n: 30 }] });
  const res = Engine.applySwap(s, P(3, 3), P(3, 4));
  assert.equal(res.turnInfo.valid, true);
  assert.equal(res.turnInfo.combo, false);
  checkReplay(s, res);
  const st = res.steps[1];
  const act = st.events.find((e) => e.t === 'activate');
  assert.deepStrictEqual([act.type, act.color, act.r, act.c], ['copa', 'L', 3, 4]);
  // 4 sueltas + la intercambiada
  assert.equal(st.events.filter((e) => e.t === 'clear' && e.color === 'L').length, 5);
  assert.ok(st.events.some((e) => e.t === 'unfrost' && e.r === 5 && e.c === 1));
  const w1 = res.steps[2];
  assert.equal(w1.kind, 'activate');
  assert.equal(w1.events.find((e) => e.t === 'activate').type, 'pv');
  // Copa + escarchada: inválido
  const f = setup(['. . . .', '. @ L* .', '. . . .', '. . . .']);
  assert.equal(Engine.canSwap(f, P(1, 1), P(1, 2)), false);
});

test('Copa golpeada por un rayo: dispara sobre el color más común entre normales', () => {
  // el Chorro en la fila 1 golpea la Copa, que dispara en la ola siguiente
  const s = setup(['. . . . .', '. @ . . .', '. . . . .', 'Lh L . L .', '. . . . .'], { colors: 'FBUND' });
  const res = Engine.useBooster(s, 'chorro', P(1, 0));
  checkReplay(s, res);
  const acts = evIn(res.steps, 'activate').filter((e) => e.type === 'copa');
  assert.equal(acts.length, 1);
  // conteo independiente del color más común tras el chorro
  const before = Replay.apply(s, res.steps.slice(0, 1));
  const cnt = {};
  before.forEach((row) => row.forEach((cl) => { if (cl && cl.p && cl.p.type === 'n') cnt[cl.p.color] = (cnt[cl.p.color] || 0) + 1; }));
  let best = null, bn = 0;
  Engine.COLORS.forEach((k) => { if ((cnt[k] || 0) > bn) { bn = cnt[k]; best = k; } });
  assert.equal(acts[0].color, best);
});

// ---------------------------------------------------------------- olas
test('olas en cadena: Paleta -> Paleta -> Bomba, un paso por ola', () => {
  const s = setup([
    '. . . L . . .',
    '. Lh L . . Dv .',
    '. . . . . . .',
    '. . . . . . .',
    '. . . . . . .',
    '. . . . . Fb .',
    '. . . . . . .',
  ], { colors: 'LFBUND' });
  const ids = [pieceAt(s, 1, 1).id, pieceAt(s, 1, 5).id, pieceAt(s, 5, 5).id];
  const res = Engine.applySwap(s, P(0, 3), P(1, 3));
  assert.equal(res.turnInfo.valid, true);
  const acts = stepsOf(res, 'activate', 1);
  assert.equal(acts.length, 3);
  assert.deepStrictEqual(acts.map((st) => st.events.filter((e) => e.t === 'activate').map((e) => e.id)), [[ids[0]], [ids[1]], [ids[2]]]);
  assert.deepStrictEqual(stepKinds(res.steps).slice(0, 5), ['swap', 'clear', 'activate', 'activate', 'activate']);
  const bomb = acts[2].events.find((e) => e.t === 'activate');
  assert.equal(bomb.cells.length, 9);
  checkReplay(s, res);
});

// ---------------------------------------------------------------- daño a bloqueos
test('daño por adyacencia: 1 por bloqueo por grupo; el congelador cuenta como uno', () => {
  let s = setup([
    '. L . . . .',
    '. L I3 . . .',
    '. . L L . .',
    '. L . . . .',
    '. . . . . .',
  ], { goals: [{ type: 'ice' }] });
  let res = Engine.applySwap(s, P(3, 1), P(2, 1));
  let dmg = evIn(stepsOf(res, 'clear', 1), 'damage');
  assert.equal(dmg.length, 1);
  assert.deepStrictEqual([dmg[0].r, dmg[0].c, dmg[0].kind, dmg[0].hp], [1, 2, 'ice', 2]);
  assert.equal(res.steps[1].score, 5 * 20 + 50);
  checkReplay(s, res);

  // congelador 2x2: corrida de 4 tocando sus dos celdas inferiores -> 1 daño
  s = setup([
    '. . Z Z . .',
    '. . Z Z . .',
    '. L L . L .',
    '. . . L . .',
    '. . . . . .',
  ], { freezer: { who: 'cocardo', hp: 6 }, goals: [{ type: 'boss' }] });
  res = Engine.applySwap(s, P(3, 3), P(2, 3));
  dmg = evIn(stepsOf(res, 'clear', 1), 'damage');
  assert.equal(dmg.length, 1);
  assert.deepStrictEqual([dmg[0].r, dmg[0].c, dmg[0].kind, dmg[0].hp], [0, 2, 'freezer', 5]);
  assert.equal(res.state.goals[0].remaining, 5);
  checkReplay(s, res);

  // dos grupos junto al mismo hielo -> 2 daños
  s = setup([
    '. . . . . .',
    'L L L . . .',
    '. I3 . . . .',
    'L L L . . .',
    '. . . . D .',
    '. . . D . D',
  ], { unstable: true });
  res = Engine.applySwap(s, P(4, 4), P(5, 4));
  dmg = evIn(stepsOf(res, 'clear', 1), 'damage');
  assert.deepStrictEqual(dmg.map((e) => e.hp), [2, 1]);
  checkReplay(s, res);
});

test('daño por activación: el rayo atraviesa bloqueos; congelador 1 vez por activación', () => {
  const s = setup([
    'Lh . Z Z . I2 .',
    '. . Z Z . . .',
    '. . . . . . .',
    '. . . . . . .',
  ], { freezer: { who: 'cereza', hp: 4 }, goals: [{ type: 'boss' }] });
  const res = Engine.useBooster(s, 'cucharon', P(0, 0));
  checkReplay(s, res);
  const st = res.steps.find((x) => x.kind === 'activate');
  const dmg = st.events.filter((e) => e.t === 'damage');
  assert.equal(dmg.filter((e) => e.kind === 'freezer').length, 1);
  assert.ok(dmg.some((e) => e.kind === 'ice' && e.c === 5 && e.hp === 1));
  assert.ok(st.events.some((e) => e.t === 'clear' && e.r === 0 && e.c === 6)); // pasó más allá
});

test('rescate y congelador destruido: celdas libres, puntos y villano jefe deja de actuar', () => {
  let s = setup(['. . . . .', '. R1 . . .', 'L . L . .', '. L . . .', '. . . . .'], { rescue: ['fresa'], goals: [{ type: 'rescue' }, { type: 'color', color: 'L', n: 50 }] });
  let res = Engine.applySwap(s, P(3, 1), P(2, 1));
  const rs = evIn(res.steps, 'rescue');
  assert.deepStrictEqual(rs.map((e) => [e.r, e.c, e.who]), [[1, 1, 'fresa']]);
  assert.deepStrictEqual(res.state.rescued, ['fresa']);
  assert.equal(res.state.goals[0].remaining, 0);
  assert.ok(res.steps[1].score >= 60 + 50 + 1000);
  checkState(res.state);
  checkReplay(s, res);

  s = setup(['. . . . .', '. Z Z . .', '. Z Z . .', 'L . L . .', '. L . . .', '. . . . .'], {
    freezer: { who: 'cocardo', hp: 1 }, villains: [{ who: 'cocardo', act: 'frost', every: 1, count: 1, src: 'boss' }],
    goals: [{ type: 'boss' }, { type: 'color', color: 'L', n: 50 }],
  });
  res = Engine.applySwap(s, P(4, 1), P(3, 1));
  const fd = evIn(res.steps, 'freezerDown');
  assert.deepStrictEqual(fd.map((e) => [e.r, e.c, e.who]), [[1, 1, 'cocardo']]);
  assert.equal(res.state.freezer.hp, 0);
  assert.equal(stepsOf(res, 'villain').length, 0);
  [[1, 1], [1, 2], [2, 1], [2, 2]].forEach(([r, c]) => assert.ok(res.state.grid[r][c].p));
  checkState(res.state);
  checkReplay(s, res);
});

// ---------------------------------------------------------------- villanos
test('villanos: nunca apuntan a escarcha, especiales ni fichas', () => {
  const s = setup([
    'Lh Dv Fb @ T Uh',
    'L* D* F* U* N* B*',
    'Bb Nv Uh Fb Dv Lb',
    '. . . . L .',
    '. . . L . L',
  ], { colors: 'FBUN', villains: [{ who: 'cocardo', act: 'frost', every: 1, count: 99, src: 'hud' }], tokens: { skin: 'uva', total: 1, onBoard: 1 }, goals: [{ type: 'color', color: 'L', n: 99 }] });
  const res = Engine.applySwap(s, P(3, 4), P(4, 4));
  checkReplay(s, res);
  const vi = stepsOf(res, 'villain');
  assert.equal(vi.length, 1);
  const idx = res.steps.indexOf(vi[0]);
  const before = Replay.apply(s, res.steps.slice(0, idx));
  const cand = [];
  before.forEach((row, r) => row.forEach((cl, c) => { if (cl && cl.p && cl.p.type === 'n' && !cl.p.frost) cand.push(cl.p.id); }));
  const tg = vi[0].events[0].targets;
  assert.equal(tg.length, cand.length);
  tg.forEach((t) => assert.ok(cand.includes(t.id)));
  // especiales y fichas intactas
  res.state.grid.forEach((row) => row.forEach((cl) => { if (cl && cl.p && cl.p.type !== 'n') assert.equal(cl.p.frost, false); }));
});

test('villanos: frost/crate, cuenta regresiva y reinicio; cajas de villano cuentan para la meta', () => {
  const s = setup(['. . . . .', '. . . . .', 'L . L . .', '. L . . .', '. . . . .'], {
    villains: [{ who: 'cereza', act: 'crate', every: 2, count: 2, src: 'hud' }], goals: [{ type: 'crate', n: 2 }, { type: 'color', color: 'L', n: 99 }],
  });
  let res = Engine.applySwap(s, P(3, 1), P(2, 1));
  assert.equal(stepsOf(res, 'villain').length, 0);
  assert.equal(res.state.villains[0].counter, 1);
  let st = res.state;
  // segunda jugada válida cualquiera (siempre hay: el motor baraja si no)
  const mv = Engine.validMoves(st)[0];
  res = Engine.applySwap(st, mv.a, mv.b);
  checkReplay(st, res);
  const vi = evIn(res.steps, 'villain');
  assert.equal(vi.length, 1);
  assert.deepStrictEqual([vi[0].who, vi[0].act, vi[0].src], ['cereza', 'crate', 'hud']);
  assert.equal(vi[0].targets.length, 2);
  vi[0].targets.forEach((t) => assert.deepStrictEqual(res.state.grid[t.r][t.c].b, { kind: 'crate', hp: 1, maxHp: 1 }));
  assert.equal(res.state.villains[0].counter, 2);
  // romper una caja de villano cuenta para la meta de cajas
  const t0 = vi[0].targets[0];
  const br = Engine.useBooster(res.state, 'cucharon', P(t0.r, t0.c));
  assert.equal(br.state.goals[0].remaining, res.state.goals[0].remaining - 1);
});

// ---------------------------------------------------------------- metas
test('metas: la escarcha no cuenta; especiales de color sí; Copa no', () => {
  let s = setup(['. . . . .', '. . L . .', 'L L* . . .', '. . . . .', '. . . . .'], { goals: [{ type: 'color', color: 'L', n: 10 }] });
  let res = Engine.applySwap(s, P(1, 2), P(2, 2));
  const cl = stepsOf(res, 'clear', 1)[0];
  assert.equal(cl.goals[0], 8);
  assert.ok(cl.events.some((e) => e.t === 'goal' && e.index === 0 && e.remaining === 8));
  assert.ok(cl.events.some((e) => e.t === 'unfrost'));
  checkReplay(s, res);
  // la Paleta L que dispara cuenta 1
  s = setup(['. . . . .', 'Lh . . . .', '. . . . .', '. . . . .'], { goals: [{ type: 'color', color: 'L', n: 10 }] });
  res = Engine.useBooster(s, 'cucharon', P(1, 0));
  assert.equal(res.steps.find((x) => x.kind === 'activate').goals[0], 9);
  // metas de hielo: cuenta bloques rotos, no golpes
  s = setup(['. . . . .', '. I2 . . .', 'L . L . .', '. L . . .', '. . . . .'], { goals: [{ type: 'ice' }] });
  assert.equal(s.goals[0].target, 1);
  res = Engine.applySwap(s, P(3, 1), P(2, 1));
  assert.equal(res.state.goals[0].remaining, 1);
});

test('fin de turno: victoria antes que villanos; sin movimientos -> villanos no actúan -> derrota', () => {
  const V = [{ who: 'cocardo', act: 'frost', every: 1, count: 1, src: 'hud' }];
  const B = ['. . . . .', '. . L . .', 'L L . . .', '. . . . .', '. . . . .'];
  // gana: no hay paso de villano
  let s = setup(B, { villains: V, goals: [{ type: 'color', color: 'L', n: 3 }] });
  let res = Engine.applySwap(s, P(1, 2), P(2, 2));
  assert.equal(res.state.status, 'won');
  assert.equal(stepsOf(res, 'villain').length, 0);
  assert.equal(res.steps[res.steps.length - 1].kind, 'end');
  assert.deepStrictEqual(res.steps[res.steps.length - 1].events.map((e) => e.t), ['win']);
  assert.equal(res.state.villains[0].counter, 1);
  // gana en el último movimiento
  s = setup(B, { villains: V, movesLeft: 1, goals: [{ type: 'color', color: 'L', n: 3 }] });
  res = Engine.applySwap(s, P(1, 2), P(2, 2));
  assert.equal(res.state.status, 'won');
  assert.equal(res.state.wonMovesLeft, 0);
  // pierde: último movimiento sin completar, sin villano
  s = setup(B, { villains: V, movesLeft: 1, goals: [{ type: 'color', color: 'L', n: 50 }] });
  res = Engine.applySwap(s, P(1, 2), P(2, 2));
  assert.equal(res.state.status, 'lost');
  assert.equal(stepsOf(res, 'villain').length, 0);
  assert.deepStrictEqual(res.steps[res.steps.length - 1].events.map((e) => e.t), ['lose']);
  assert.equal(res.state.movesLeft, 0);
  // sigue jugando: el villano actúa
  s = setup(B, { villains: V, movesLeft: 5, goals: [{ type: 'color', color: 'L', n: 50 }] });
  res = Engine.applySwap(s, P(1, 2), P(2, 2));
  assert.equal(res.state.status, 'playing');
  assert.equal(stepsOf(res, 'villain').length, 1);
  assert.equal(stepsOf(res, 'end').length, 0);
  // tras perder, ya no se acepta nada
  const lost = Engine.applySwap(setup(B, { movesLeft: 1, goals: [{ type: 'color', color: 'L', n: 50 }] }), P(1, 2), P(2, 2)).state;
  assert.equal(Engine.applySwap(lost, P(0, 0), P(0, 1)).turnInfo.valid, false);
  assert.equal(Engine.useBooster(lost, 'batido'), null);
  assert.equal(Engine.hint(lost), null);
});

// ---------------------------------------------------------------- barajar
const DEAD = ['L F B U L', 'B U L F B', 'L F B U* L', 'B U L F B', 'L F B U L'];

test('barajar: tablero sin jugadas tras el turno -> shuffle nomoves con garantía', () => {
  const s = setup(DEAD, { colors: 'LFBU', levelId: 22 });
  assert.equal(Engine.validMoves(s).length, 0);
  const res = Engine.useBooster(s, 'cucharon', P(2, 3)); // solo rompe escarcha
  assert.ok(res);
  const sh = evIn(res.steps, 'shuffle');
  assert.equal(sh.length, 1);
  assert.equal(sh[0].reason, 'nomoves');
  assert.equal(sh[0].who, 'cereza');
  assert.ok(Engine.isStable(res.state));
  assert.ok(Engine.validMoves(res.state).length >= 1);
  const ids = (st) => st.grid.flat().filter((c) => c && c.p).map((c) => c.p.id).sort((a, b) => a - b);
  assert.deepStrictEqual(ids(res.state), ids(s));
  checkReplay(s, res);
});

test('barajar: Batido y tablero casi todo escarchado (debe romper escarcha)', () => {
  let s = setup(DEAD, { colors: 'LFBU' });
  let res = Engine.useBooster(s, 'batido');
  assert.equal(evIn(res.steps, 'shuffle')[0].reason, 'batido');
  assert.ok(Engine.isStable(res.state) && Engine.validMoves(res.state).length >= 1);
  assert.equal(res.state.movesLeft, s.movesLeft);
  checkReplay(s, res);
  const frozen = ['L F* B* U* L*', 'B* U* L* F* B*', 'L* F* B* U* L*', 'B* U* L* F* B*', 'L* F* B* U* L*'];
  s = setup(frozen, { colors: 'LFBU' });
  res = Engine.useBooster(s, 'batido');
  assert.ok(Engine.isStable(res.state));
  assert.ok(Engine.validMoves(res.state).length >= 1);
  checkReplay(s, res);
});

// ---------------------------------------------------------------- tablero inicial
test('tablero inicial: sin matches, al menos 1 jugada, fiel al layout', () => {
  for (const lvl of Object.values(LEVELS)) {
    for (let seed = 0; seed < 25; seed++) {
      const s = Engine.createGame(lvl, seed);
      checkState(s);
      assert.ok(Engine.validMoves(s).length >= 1);
      assert.equal(s.movesLeft, lvl.moves);
      assert.equal(s.status, 'playing');
      let fi = 0;
      lvl.layout.forEach((row, r) => row.split('').forEach((ch, c) => {
        const cl = s.grid[r][c];
        if (ch === '#') assert.equal(cl, null);
        else if ('123'.includes(ch)) assert.deepStrictEqual(cl.b, { kind: 'ice', hp: +ch, maxHp: +ch });
        else if (ch === 'K') assert.deepStrictEqual(cl.b, { kind: 'crate', hp: 1, maxHp: 1 });
        else if (ch === 'R') { assert.equal(cl.b.kind, 'friend'); assert.equal(cl.b.who, lvl.rescue[fi++]); assert.equal(cl.b.hp, lvl.friendHP); }
        else if (ch === 'C') assert.deepStrictEqual(cl.b, { kind: 'freezer' });
        else if (ch === 'T') { assert.equal(cl.p.type, 'token'); assert.equal(cl.p.skin, lvl.tokens.skin); }
        else if (ch === 'e') { assert.equal(cl.p.type, 'n'); assert.equal(cl.p.frost, true); }
        else { assert.equal(cl.p.type, 'n'); assert.equal(cl.p.frost, false); }
      }));
      lvl.goals.forEach((g, i) => {
        const sg = s.goals[i];
        assert.equal(sg.type, g.type);
        const exp = { color: g.n, crate: g.n, ice: lvl.layout.join('').split('').filter((ch) => '123'.includes(ch)).length,
          rescue: (lvl.rescue || []).length, token: lvl.tokens && lvl.tokens.total, boss: lvl.freezer && lvl.freezer.hp }[g.type];
        assert.equal(sg.target, exp);
        assert.equal(sg.remaining, exp);
      });
      if (lvl.tokens) assert.equal(s.tokens.spawned, lvl.layout.join('').split('').filter((ch) => ch === 'T').length);
      if (lvl.freezer) assert.deepStrictEqual([s.freezer.hp, s.freezer.maxHp, s.freezer.who], [lvl.freezer.hp, lvl.freezer.hp, lvl.freezer.who]);
      s.villains.forEach((v) => assert.equal(v.counter, v.every));
    }
  }
});

test('tablero inicial: ensure ph / bomba / copa respetado', () => {
  for (const ensure of ['ph', 'bomba', 'copa']) {
    const lvl = Object.assign({}, LEVELS.basic, { ensure, layout: Array(7).fill('.......'), colors: ensure === 'copa' ? 'LFBUN' : 'LFBU' });
    for (let seed = 0; seed < 15; seed++) {
      const s = Engine.createGame(lvl, 'ens' + seed);
      const ok = Engine.validMoves(s).some((m) => {
        const an = Engine._analyzeSwap(s, m.a, m.b);
        return an && an.kind === 'normal' && an.specials.some((t) => t === ensure || (ensure === 'ph' && (t === 'ph' || t === 'pv')));
      });
      assert.ok(ok, `ensure ${ensure} semilla ${seed}`);
      // y el movimiento realmente crea ese especial
    }
  }
});

// ---------------------------------------------------------------- determinismo
function playScript(level, seed, n) {
  let s = Engine.createGame(level, seed);
  const log = [s];
  let r = RNG.seedFrom('script' + seed);
  for (let i = 0; i < n && s.status === 'playing'; i++) {
    const mv = Engine.validMoves(s);
    const o = RNG.next(r); r = o.state;
    const m = mv[Math.floor(o.value * mv.length)];
    const res = Engine.applySwap(s, m.a, m.b);
    log.push(res);
    s = res.state;
  }
  return log;
}

test('determinismo: misma semilla y jugadas -> mismos estados y pasos', () => {
  for (const lvl of [LEVELS.boss, LEVELS.tokens, LEVELS.crates]) {
    const a = playScript(lvl, 42, 25), b = playScript(lvl, 42, 25);
    assert.deepStrictEqual(a, b);
  }
  const x = Engine.createGame(LEVELS.basic, 1), y = Engine.createGame(LEVELS.basic, 2);
  assert.notDeepStrictEqual(x.grid, y.grid);
  // las funciones no mutan la entrada
  const s = Engine.createGame(LEVELS.boss, 7);
  const copy = JSON.parse(JSON.stringify(s));
  const m = Engine.validMoves(s)[0];
  Engine.applySwap(s, m.a, m.b); Engine.hint(s); Engine.canSwap(s, m.a, m.b);
  Engine.useBooster(s, 'chorro', P(3, 3)); Engine.useBooster(s, 'batido');
  assert.deepStrictEqual(s, copy);
});

// ---------------------------------------------------------------- intercambios inválidos
test('intercambio inválido: no gasta movimiento ni cambia el tablero', () => {
  const s = setup(['. . . . .', '. L* L . .', '. K . . .', '. . . . .'], { goals: [{ type: 'color', color: 'L', n: 5 }] });
  const cases = [[P(0, 0), P(0, 2)], [P(0, 0), P(1, 1)], [P(1, 1), P(1, 2)], [P(1, 1), P(2, 1)], [P(0, 0), P(0, 1)], [P(0, 0), P(-1, 0)]];
  for (const [a, b] of cases) {
    const res = Engine.applySwap(s, a, b);
    assert.equal(res.turnInfo.valid, false);
    assert.equal(res.steps.length, 1);
    assert.equal(res.steps[0].kind, 'invalid');
    assert.deepStrictEqual(res.steps[0].events, [{ t: 'invalid', a, b }]);
    assert.deepStrictEqual(res.state, s);
    assert.notEqual(res.state, s);
    assert.equal(Engine.canSwap(s, a, b), false);
  }
});

// ---------------------------------------------------------------- puntaje, estrellas, unidades
test('puntaje: 20×c por pieza, +60 especial, +50 por golpe', () => {
  const s = setup(['. L . . . .', '. . L L . .', 'L . . . . .', '. . . . . .'], { unstable: false });
  // fila 1: . L L con L en (0,1) -> 3 en línea al bajar (0,1)->(1,1)
  const res = Engine.applySwap(s, P(0, 1), P(1, 1));
  const cl = stepsOf(res, 'clear', 1)[0];
  assert.equal(cl.score, 60);
  cl.events.filter((e) => e.t === 'clear').forEach((e) => assert.equal(e.points, 20));
  stepsOf(res, 'clear').forEach((st) => st.events.filter((e) => e.t === 'clear').forEach((e) => assert.equal(e.points, 20 * st.cascade)));
});

test('estrellas y unidades de meta', () => {
  const base = setup(['. . . . .', '. . L . .', 'L L . . .', '. . . . .'], { moves: 20, goals: [{ type: 'color', color: 'L', n: 3 }] });
  const win = (left) => Engine.applySwap(Object.assign({}, base, { movesLeft: left + 1 }), P(1, 2), P(2, 2)).state;
  assert.equal(Engine.starsFor(win(6)), 3);
  assert.equal(Engine.starsFor(win(5)), 2);
  assert.equal(Engine.starsFor(win(3)), 2);
  assert.equal(Engine.starsFor(win(2)), 1);
  assert.equal(Engine.starsFor(win(0)), 1);
  assert.equal(Engine.starsFor(base), 0);
  const s = Engine.createGame(LEVELS.boss, 3);
  assert.deepStrictEqual(Engine.goalUnits(s), { remaining: 6 + 1, start: 7 });
  const s2 = setup(['Z Z . .', 'Z Z . .', '. . . .', '. . . .'], { freezer: { who: 'cocardo', hp: 9 }, goals: [{ type: 'boss' }, { type: 'color', color: 'L', n: 4 }] });
  s2.freezer.hp = 2; s2.goals[0].remaining = 2; s2.goals[1].remaining = 1;
  assert.deepStrictEqual(Engine.goalUnits(s2), { remaining: 3, start: 13 });
});

// ---------------------------------------------------------------- Helado Final
test('Helado Final: cada movimiento restante = Paleta aleatoria que dispara, +300, movesLeft 0', () => {
  const s = setup(['. . . . . .', '. . L . . .', 'L L . . . .', '. . . . . .', '. . . . . .', '. . . . . .'], { moves: 20, movesLeft: 6, goals: [{ type: 'color', color: 'L', n: 3 }] });
  const won = Engine.applySwap(s, P(1, 2), P(2, 2)).state;
  assert.equal(won.status, 'won');
  assert.equal(won.movesLeft, 5);
  const stars = Engine.starsFor(won);
  assert.equal(Engine.heladoFinal(s).steps.length, 0); // no aplica mientras se juega
  const hf = Engine.heladoFinal(won);
  assert.equal(hf.state.movesLeft, 0);
  assert.equal(hf.state.status, 'won');
  assert.equal(Engine.starsFor(hf.state), stars);
  const tr = stepsOf(hf, 'transform');
  assert.equal(tr.length, 5);
  tr.forEach((st) => {
    const e = st.events.find((x) => x.t === 'transform');
    assert.ok(e.type === 'ph' || e.type === 'pv');
    assert.ok(st.events.some((x) => x.t === 'points' && x.value === 300));
  });
  assert.deepStrictEqual(tr.map((st) => st.movesLeft), [4, 3, 2, 1, 0]);
  assert.ok(hf.state.score >= won.score + 5 * 300 + 5 * 20);
  // cada Paleta transformada dispara justo después
  tr.forEach((st) => {
    const i = hf.steps.indexOf(st);
    const id = st.events.find((x) => x.t === 'transform').id;
    assert.equal(hf.steps[i + 1].kind, 'activate');
    assert.ok(hf.steps[i + 1].events.some((x) => x.t === 'activate' && x.id === id));
  });
  checkReplay(won, hf);
  checkState(hf.state);
  assert.deepStrictEqual(Engine.heladoFinal(won), hf);
});

// ---------------------------------------------------------------- potenciadores
test('Cucharón: quita normal, rompe escarcha, daña bloqueo, dispara especial; sin gastar movimiento ni avanzar villanos', () => {
  const V = [{ who: 'cocardo', act: 'frost', every: 1, count: 1, src: 'hud' }];
  const s = setup(['. . . . .', '. L* I2 . .', '. Lh T . .', '# . . . .'], { villains: V, tokens: { skin: 'uva', total: 1, onBoard: 1 }, goals: [{ type: 'color', color: 'L', n: 9 }] });
  let res = Engine.useBooster(s, 'cucharon', P(0, 0));
  assert.deepStrictEqual(stepKinds(res.steps).slice(0, 2), ['booster', 'fall']);
  assert.ok(res.steps[0].events.some((e) => e.t === 'clear' && e.r === 0 && e.c === 0));
  assert.equal(res.state.movesLeft, s.movesLeft);
  assert.equal(res.state.villains[0].counter, 1);
  assert.equal(stepsOf(res, 'villain').length, 0);
  checkReplay(s, res);
  res = Engine.useBooster(s, 'cucharon', P(1, 1));
  assert.ok(res.steps[0].events.some((e) => e.t === 'unfrost'));
  assert.equal(res.state.goals[0].remaining, 9);
  checkReplay(s, res);
  res = Engine.useBooster(s, 'cucharon', P(1, 2));
  assert.ok(res.steps[0].events.some((e) => e.t === 'damage' && e.hp === 1));
  checkReplay(s, res);
  res = Engine.useBooster(s, 'cucharon', P(2, 1));
  assert.equal(res.steps[1].kind, 'activate');
  assert.equal(res.steps[1].events[0].type, 'ph');
  checkReplay(s, res);
  assert.equal(Engine.useBooster(s, 'cucharon', P(2, 2)), null); // ficha
  assert.equal(Engine.useBooster(s, 'cucharon', P(3, 0)), null); // vacío
  assert.equal(Engine.useBooster(s, 'cucharon', P(9, 9)), null); // fuera
  assert.equal(Engine.useBooster(s, 'cucharon'), null);
  assert.equal(Engine.useBooster(s, 'martillo', P(0, 0)), null);
});

test('Chorro de Lima: activación ph en la fila; Batido: barajado forzado; victoria tras potenciador', () => {
  const s = setup(['. . . . . .', 'L I1 . Dv . .', '. . . . . .', '. . . . . .'], { goals: [{ type: 'ice' }] });
  const res = Engine.useBooster(s, 'chorro', P(1, 4));
  const st = res.steps[0];
  assert.equal(st.kind, 'booster');
  assert.equal(st.events[0].type, 'chorro');
  assert.equal(st.events[0].cells.length, 6);
  assert.ok(st.events.some((e) => e.t === 'destroy' && e.kind === 'ice'));
  assert.ok(st.events.some((e) => e.t === 'clear' && e.r === 1 && e.c === 0));
  assert.equal(res.steps[1].kind, 'activate'); // la pv golpeada dispara en la ola siguiente
  assert.equal(res.state.status, 'won');
  assert.equal(res.steps[res.steps.length - 1].events[0].t, 'win');
  checkReplay(s, res);
  const b = Engine.useBooster(Engine.createGame(LEVELS.basic, 5), 'batido', null);
  assert.equal(b.steps[0].kind, 'booster');
  assert.equal(b.steps[1].kind, 'shuffle');
  checkState(b.state);
});

// ---------------------------------------------------------------- pista
test('pista: combo > Copa > Bomba > Paleta > más piezas; desempate por orden de lectura', () => {
  const H7 = (rows) => setup(rows, { colors: 'LFBUND' });
  // solo 3 en línea: dos jugadas equivalentes -> la primera en orden de lectura
  let s = H7(['. . . . . . .', '. . . . . . .', '. D D . . . .', '. . . D . . .', '. . . . . . .', '. . . . . L L', '. . . . L . .']);
  let h = Engine.hint(s);
  assert.deepStrictEqual(h, { a: P(2, 3), b: P(3, 3) });
  // Paleta gana a 3 en línea
  s = H7(['. . . . D D .', '. . . . . . D', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. L . . . . .', 'L . L L . . .']);
  h = Engine.hint(s);
  assert.deepStrictEqual(h, { a: P(5, 1), b: P(6, 1) });
  // Bomba gana a Paleta
  s = H7(['L . . . . . .', 'L . . . . . .', '. L L . . . .', 'L . . . . . .', '. . . . . . .', '. . . . . D .', 'D . D D . . .']);
  h = Engine.hint(s);
  assert.deepStrictEqual(h, { a: P(2, 0), b: P(3, 0) });
  // Copa gana a Bomba
  s = H7(['L . . . . . .', 'L . . . . . .', '. L L . . . .', 'L . . . . . .', '. . . . . . .', '. . D . . . .', 'D D . D D . .']);
  h = Engine.hint(s);
  assert.deepStrictEqual(h, { a: P(5, 2), b: P(6, 2) });
  // combo gana a Copa
  s = H7(['L . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . . .', '. . . . . Lh Db', '. . D . . . .', 'D D . D D . .']);
  h = Engine.hint(s);
  assert.deepStrictEqual(h, { a: P(4, 5), b: P(4, 6) });
  // sin jugadas
  assert.equal(Engine.hint(setup(DEAD)), null);
});

// ---------------------------------------------------------------- Replay
test('Replay detecta eventos inconsistentes', () => {
  const s = Engine.createGame(LEVELS.basic, 9);
  const m = Engine.validMoves(s)[0];
  const res = Engine.applySwap(s, m.a, m.b);
  assert.deepStrictEqual(Replay.apply(s, res.steps), res.state.grid);
  const bad = JSON.parse(JSON.stringify(res.steps));
  const f = bad.find((st) => st.kind === 'fall');
  f.events = f.events.filter((e) => e.t !== 'spawn');
  assert.throws(() => { const g = Replay.apply(s, bad); assert.deepStrictEqual(g, res.state.grid); });
  const bad2 = JSON.parse(JSON.stringify(res.steps));
  bad2[0].events[0].ids = [12345, 54321];
  assert.throws(() => Replay.apply(s, bad2));
});

test('invariante de Replay en 240+ partidas aleatorias (hielo, cajas, escarcha, fichas, congelador, amigos, villanos, potenciadores, Helado Final)', () => {
  let games = 0, turns = 0;
  const seen = {};
  for (const [name, lvl] of Object.entries(LEVELS)) {
    for (let seed = 0; seed < 30; seed++) {
      let s = Engine.createGame(lvl, name + seed);
      let r = RNG.seedFrom('play' + name + seed);
      while (s.status === 'playing') {
        const mv = Engine.validMoves(s);
        assert.ok(mv.length > 0, 'estado jugable sin jugadas');
        const o = RNG.next(r); r = o.state;
        let res = null;
        if (o.value < 0.06) {
          const types = ['cucharon', 'chorro', 'batido'];
          res = Engine.useBooster(s, types[Math.floor(o.value * 1000) % 3], P(Math.floor(o.value * 7919) % s.rows, Math.floor(o.value * 104729) % s.cols));
        }
        if (!res) {
          const m = o.value < 0.4 ? Engine.hint(s) : mv[Math.floor(o.value * mv.length)];
          res = Engine.applySwap(s, m.a, m.b);
          assert.equal(res.turnInfo.valid, true);
          assert.equal(res.state.movesLeft, s.movesLeft - 1);
        }
        checkReplay(s, res);
        checkState(res.state);
        res.steps.forEach((st) => st.events.forEach((e) => { seen[e.t] = 1; }));
        // cada barajado deja tablero estable con jugadas
        res.steps.forEach((st, i) => {
          if (st.kind === 'shuffle') {
            const g = Replay.apply(s, res.steps.slice(0, i + 1));
            const tmp = Object.assign({}, res.state, { grid: g });
            assert.ok(Engine.isStable(tmp));
            assert.ok(Engine.validMoves(tmp).length > 0);
          }
          if (st.kind === 'villain') {
            const g = Replay.apply(s, res.steps.slice(0, i));
            st.events.forEach((e) => e.targets.forEach((t) => {
              assert.equal(g[t.r][t.c].p.type, 'n');
              assert.equal(g[t.r][t.c].p.frost, false);
            }));
          }
        });
        s = res.state;
        turns++;
      }
      if (s.status === 'won') {
        const hf = Engine.heladoFinal(s);
        checkReplay(s, hf);
        checkState(hf.state);
        assert.equal(hf.state.movesLeft, 0);
      }
      games++;
    }
  }
  assert.ok(games >= 240);
  for (const t of ['swap', 'clear', 'unfrost', 'damage', 'destroy', 'rescue', 'freezerDown', 'activate', 'combo', 'create', 'transform', 'fall', 'spawn', 'collect', 'villain', 'shuffle', 'win', 'lose', 'booster', 'cascade', 'goal', 'points']) {
    assert.ok(seen[t], `nunca apareció el evento ${t}`);
  }
  assert.ok(turns > 1000);
});

// ---------------------------------------------------------------- rendimiento
test('regresión: consultas sobre estado congelado y coordenadas malformadas no lanzan ni mutan', () => {
  const freeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(freeze); } return o; };
  const s = freeze(Engine.createGame(LEVELS.basic, 3));
  const snap = JSON.stringify(s);
  const moves = Engine.validMoves(s);
  assert.ok(moves.length > 0);
  assert.equal(JSON.stringify(s), snap, 'validMoves no debe mutar state.grid');
  const bad = [[P(0.5, 0), P(1.5, 0)], [{ r: '0', c: '0' }, { r: '0', c: '1' }], [P(NaN, 0), P(0, 0)], [{}, P(0, 0)], [null, undefined]];
  bad.forEach(([a, b]) => {
    assert.equal(Engine.canSwap(s, a, b), false);
    const res = Engine.applySwap(s, a, b);
    assert.equal(res.turnInfo.valid, false);
    assert.deepEqual(res.steps.map((x) => x.kind), ['invalid']);
    assert.equal(res.state.movesLeft, s.movesLeft);
  });
  assert.equal(Engine.useBooster(s, 'cucharon', { r: '0', c: '0' }), null);
  assert.equal(Engine.useBooster(s, 'chorro', P(0.5, 0)), null);
  // las coordenadas enteras válidas siguen funcionando
  const m = moves[0];
  assert.equal(Engine.canSwap(s, m.a, m.b), true);
  assert.equal(Engine.applySwap(s, m.a, m.b).turnInfo.valid, true);
  assert.equal(JSON.stringify(s), snap);
});

test('rendimiento: applySwap < 5 ms y validMoves < 2 ms (mediana, 8×8)', () => {
  const tSwap = [], tVm = [];
  for (let seed = 0; seed < 10; seed++) {
    let s = Engine.createGame(LEVELS.crates, seed);
    for (let i = 0; i < 15 && s.status === 'playing'; i++) {
      let t0 = process.hrtime.bigint();
      const mv = Engine.validMoves(s);
      tVm.push(Number(process.hrtime.bigint() - t0) / 1e6);
      const m = mv[(seed + i) % mv.length];
      t0 = process.hrtime.bigint();
      const res = Engine.applySwap(s, m.a, m.b);
      tSwap.push(Number(process.hrtime.bigint() - t0) / 1e6);
      s = res.state;
    }
  }
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  assert.ok(med(tSwap) < 5, 'applySwap mediana ' + med(tSwap));
  assert.ok(med(tVm) < 2, 'validMoves mediana ' + med(tVm));
});

// ---------------------------------------------------------------- niveles reales (si existen)
test('humo: createGame y algunas jugadas en cada nivel de js/core/levels.js', (t) => {
  const file = path.join(__dirname, '..', 'js', 'core', 'levels.js');
  if (!fs.existsSync(file)) { t.skip('levels.js aún no existe'); return; }
  const Levels = require(file);
  assert.ok(Levels && Array.isArray(Levels.list));
  for (const lvl of Levels.list) {
    for (let seed = 0; seed < 3; seed++) {
      let s = Engine.createGame(lvl, seed);
      checkState(s);
      assert.ok(Engine.validMoves(s).length > 0, 'nivel ' + lvl.id + ' sin jugadas');
      if (lvl.ensure) {
        const ok = Engine.validMoves(s).some((m) => {
          const an = Engine._analyzeSwap(s, m.a, m.b);
          return an && an.specials.some((x) => x === lvl.ensure || (lvl.ensure === 'ph' && (x === 'ph' || x === 'pv')));
        });
        assert.ok(ok, 'ensure en nivel ' + lvl.id);
      }
      for (let i = 0; i < 12 && s.status === 'playing'; i++) {
        const m = Engine.hint(s);
        const res = Engine.applySwap(s, m.a, m.b);
        checkReplay(s, res);
        checkState(res.state);
        s = res.state;
      }
    }
  }
});
