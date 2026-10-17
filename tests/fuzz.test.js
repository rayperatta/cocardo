// Pruebas adversariales del motor: juego aleatorio con invariantes + casos límite a mano.
// Contrato: docs/ARQUITECTURA.md §4; reglas: docs/DISENO.md §3-5, §10.
// Este archivo NO confía en el motor para calcular lo esperado: los grupos, jugadas válidas,
// áreas de activación, lugar de los especiales, puntaje y metas se recalculan aquí de forma independiente.
'use strict';
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const RNG = require('../js/core/rng.js');
const Engine = require('../js/core/engine.js');
const Replay = require('../js/core/replay.js');

// ======================================================================= utilidades
const COLORS = ['L', 'F', 'B', 'U', 'N', 'D'];
const MATCH = { n: 1, ph: 1, pv: 1, bomba: 1 };
const SPEC = { ph: 1, pv: 1, bomba: 1, copa: 1 };
const PAL = { ph: 1, pv: 1 };
const P = (r, c) => ({ r, c });
const K = (r, c) => r * 16 + c;
const clone = (o) => JSON.parse(JSON.stringify(o));
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) deepFreeze(o[k]); }
  return o;
}
function mkRand(seed) {
  let st = RNG.seedFrom(seed);
  return () => { const o = RNG.next(st); st = o.state; return o.value; };
}
const SEEN = {};

// Relleno sin matches ni jugadas (colores F,B,U,N); las piezas de prueba usan L y D.
function fill(lines) {
  return lines.map((l, r) => l.trim().split(/\s+/).map((t, c) => (t === '.' ? 'FBUN'[(r + 2 * c) % 4] : t)).join(' '));
}
function board(lines, opts, unstable) {
  const s = Engine.fromRows(fill(lines), opts || {});
  if (!unstable) assert.equal(groupsOf(s.grid).length, 0, 'tablero de prueba con matches');
  return s;
}

// ---------------------------------------------------------------- reglas independientes
function mcol(cell) { return cell && cell.p && MATCH[cell.p.type] ? cell.p.color : null; }
function pieceOf(g, r, c) { const cl = r >= 0 && c >= 0 && r < g.length && c < g[0].length ? g[r][c] : null; return cl && cl.p ? cl.p : null; }
function sortRead(a) { return a.sort((x, y) => x.r - y.r || x.c - y.c); }

// Grupos (DISENO §3.3): corridas ≥3 en fila/columna, unidas si comparten celda.
function groupsOf(g) {
  const R = g.length, C = g[0].length, runs = [];
  for (let r = 0; r < R; r++) {
    let c = 0;
    while (c < C) {
      const k = mcol(g[r][c]);
      if (!k) { c++; continue; }
      let e = c + 1;
      while (e < C && mcol(g[r][e]) === k) e++;
      if (e - c >= 3) { const cells = []; for (let i = c; i < e; i++) cells.push(P(r, i)); runs.push({ dir: 'h', color: k, cells }); }
      c = e;
    }
  }
  for (let c = 0; c < C; c++) {
    let r = 0;
    while (r < R) {
      const k = mcol(g[r][c]);
      if (!k) { r++; continue; }
      let e = r + 1;
      while (e < R && mcol(g[e][c]) === k) e++;
      if (e - r >= 3) { const cells = []; for (let i = r; i < e; i++) cells.push(P(i, c)); runs.push({ dir: 'v', color: k, cells }); }
      r = e;
    }
  }
  const groups = [];
  for (const run of runs) {
    const keys = new Set(run.cells.map((q) => K(q.r, q.c)));
    const hits = groups.filter((gr) => gr.cells.some((q) => keys.has(K(q.r, q.c))));
    let tgt;
    if (!hits.length) { tgt = { color: run.color, runs: [], cells: [] }; groups.push(tgt); } else {
      tgt = hits[0];
      for (const o of hits.slice(1)) { tgt.runs.push(...o.runs); tgt.cells.push(...o.cells); groups.splice(groups.indexOf(o), 1); }
    }
    tgt.runs.push(run);
    const have = new Set(tgt.cells.map((q) => K(q.r, q.c)));
    run.cells.forEach((q) => { if (!have.has(K(q.r, q.c))) { have.add(K(q.r, q.c)); tgt.cells.push(q); } });
  }
  groups.forEach((gr) => sortRead(gr.cells));
  return groups;
}
function runThrough(g, r, c) {
  const k = mcol(g[r][c]);
  if (!k) return false;
  let n = 1, i;
  for (i = c - 1; i >= 0 && mcol(g[r][i]) === k; i--) n++;
  for (i = c + 1; i < g[0].length && mcol(g[r][i]) === k; i++) n++;
  if (n >= 3) return true;
  n = 1;
  for (i = r - 1; i >= 0 && mcol(g[i][c]) === k; i--) n++;
  for (i = r + 1; i < g.length && mcol(g[i][c]) === k; i++) n++;
  return n >= 3;
}
// Validez de un intercambio (DISENO §3.2).
function swapOk(g, a, b) {
  if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return false;
  const pa = pieceOf(g, a.r, a.c), pb = pieceOf(g, b.r, b.c);
  if (!pa || !pb || pa.frost || pb.frost) return false;
  if (SPEC[pa.type] && SPEC[pb.type]) return true;
  if ((pa.type === 'copa' && pb.type === 'n') || (pb.type === 'copa' && pa.type === 'n')) return true;
  const h = clone(g);
  h[a.r][a.c] = { p: pb }; h[b.r][b.c] = { p: pa };
  return runThrough(h, a.r, a.c) || runThrough(h, b.r, b.c);
}
function allSwaps(g) {
  const out = [];
  for (let r = 0; r < g.length; r++) for (let c = 0; c < g[0].length; c++) {
    if (c + 1 < g[0].length && swapOk(g, P(r, c), P(r, c + 1))) out.push({ a: P(r, c), b: P(r, c + 1) });
    if (r + 1 < g.length && swapOk(g, P(r, c), P(r + 1, c))) out.push({ a: P(r, c), b: P(r + 1, c) });
  }
  return out;
}
const moveKey = (m) => { const x = K(m.a.r, m.a.c), y = K(m.b.r, m.b.c); return Math.min(x, y) + ':' + Math.max(x, y); };

// Especial y lugar esperados para un grupo (DISENO §3.3). Devuelve {type,color,options:Set<key|'none'>} o null.
function expectedSpecial(g, group, swapCells) {
  let maxLen = 0, hasH = false, hasV = false;
  group.runs.forEach((run) => { maxLen = Math.max(maxLen, run.cells.length); if (run.dir === 'h') hasH = true; else hasV = true; });
  let type = null;
  if (maxLen >= 5) type = 'copa';
  else if (hasH && hasV) type = 'bomba';
  else if (maxLen === 4) type = group.runs.find((x) => x.cells.length === 4).dir === 'h' ? 'ph' : 'pv';
  if (!type) return null;
  const inG = new Set(group.cells.map((q) => K(q.r, q.c)));
  const okCell = (q) => { const p = pieceOf(g, q.r, q.c); return p && p.type === 'n' && !p.frost; };
  const options = new Set();
  const longest = group.runs.filter((x) => x.cells.length === maxLen);
  for (const L of longest) {
    for (const wrap of [false, true]) {
      const cand = [];
      if (swapCells) swapCells.forEach((q) => { if (inG.has(K(q.r, q.c))) cand.push(q); });
      if (type === 'bomba') {
        const hk = new Set(), vk = new Set();
        group.runs.forEach((run) => run.cells.forEach((q) => (run.dir === 'h' ? hk : vk).add(K(q.r, q.c))));
        group.cells.forEach((q) => { if (hk.has(K(q.r, q.c)) && vk.has(K(q.r, q.c))) cand.push(q); });
      }
      const cells = sortRead(L.cells.slice()), mid = Math.floor(cells.length / 2);
      cand.push(cells[mid]);
      if (wrap) { for (let i = mid + 1; i < cells.length; i++) cand.push(cells[i]); for (let i = 0; i < mid; i++) cand.push(cells[i]); } else cells.forEach((q, i) => { if (i !== mid) cand.push(q); });
      group.cells.forEach((q) => cand.push(q));
      const hit = cand.find(okCell);
      options.add(hit ? K(hit.r, hit.c) : 'none');
    }
  }
  return { type, color: type === 'copa' ? null : group.color, options };
}

function isSlotCell(cell) { return !!cell && !cell.b && !(cell.p && cell.p.frost); }
function lowestSlot(g, c) { for (let r = g.length - 1; r >= 0; r--) if (isSlotCell(g[r][c])) return r; return -1; }
function rowArea(g, r) { const o = []; for (let c = 0; c < g[0].length; c++) if (g[r][c]) o.push(P(r, c)); return o; }
function colArea(g, c) { const o = []; for (let r = 0; r < g.length; r++) if (g[r][c]) o.push(P(r, c)); return o; }
function boxArea(g, r0, c0, rad) {
  const o = [];
  for (let r = r0 - rad; r <= r0 + rad; r++) for (let c = c0 - rad; c <= c0 + rad; c++) if (r >= 0 && c >= 0 && r < g.length && c < g[0].length && g[r][c]) o.push(P(r, c));
  return o;
}
function union(lists) { const m = new Map(); lists.flat().forEach((q) => m.set(K(q.r, q.c), q)); return sortRead([...m.values()]); }
function colorCellsOf(g, color) { const o = []; g.forEach((row, r) => row.forEach((cl, c) => { if (mcol(cl) === color) o.push(P(r, c)); })); return o; }
function mostCommonN(g) {
  const cnt = {};
  g.forEach((row) => row.forEach((cl) => { if (cl && cl.p && cl.p.type === 'n') cnt[cl.p.color] = (cnt[cl.p.color] || 0) + 1; }));
  let best = null, bn = 0;
  COLORS.forEach((k) => { if ((cnt[k] || 0) > bn) { bn = cnt[k]; best = k; } });
  return best;
}
const keySet = (cells) => new Set(cells.map((q) => K(q.r, q.c)));
const sameCells = (a, b) => { const x = [...keySet(a)].sort(), y = [...keySet(b)].sort(); return x.length === y.length && x.every((v, i) => v === y[i]); };
function freezerKeyAt(g, r, c) { const cl = g[r] && g[r][c]; return cl && cl.b && cl.b.kind === 'freezer'; }
function hitKey(e) { return e.kind === 'freezer' || e.t === 'freezerDown' ? 'FZ' : K(e.r, e.c); }
const HIT_T = { damage: 1, destroy: 1, rescue: 1, freezerDown: 1 };
function hpOf(grid, fz, key) {
  if (key === 'FZ') return fz ? fz.hp : 0;
  const cl = grid[Math.floor(key / 16)][key % 16];
  return cl && cl.b ? cl.b.hp : 0;
}
function replayOn(grid, fz, events) {
  const out = Replay.applyFull({ grid, freezer: fz }, [{ events }]);
  return { grid: out.grid, fz: fz ? { r: fz.r, c: fz.c, hp: out.freezerHp } : null };
}
function hasEmpty(g) { return g.some((row) => row.some((cl) => cl && !cl.b && !cl.p)); }
function goalsDone(goals) { return goals.every((x) => x.remaining <= 0); }

// ======================================================================= validador por llamada
const ALLOWED = {
  swap: ['swap'], invalid: ['invalid'],
  clear: ['cascade', 'clear', 'unfrost', 'damage', 'destroy', 'rescue', 'freezerDown', 'points', 'goal'],
  activate: ['activate', 'combo', 'transform', 'clear', 'unfrost', 'damage', 'destroy', 'rescue', 'freezerDown', 'points', 'goal'],
  booster: ['booster', 'clear', 'unfrost', 'damage', 'destroy', 'rescue', 'freezerDown', 'points', 'goal'],
  create: ['create', 'points', 'goal'],
  fall: ['fall', 'spawn', 'collect', 'points', 'goal'],
  villain: ['villain'], shuffle: ['shuffle'], transform: ['transform', 'points'], end: ['win', 'lose'],
};

// Campos de cada evento (ARQUITECTURA §4.4 + adiciones documentadas del motor).
const isCell = (q) => q && Number.isInteger(q.r) && Number.isInteger(q.c);
const EVENT_SCHEMA = {
  swap: (e) => isCell(e.a) && isCell(e.b) && Array.isArray(e.ids) && e.ids.length === 2 && e.back === false,
  invalid: (e) => 'a' in e && 'b' in e,
  cascade: (e) => Number.isInteger(e.c) && e.c >= 1,
  clear: (e) => Number.isInteger(e.id) && isCell(e) && 'color' in e && typeof e.type === 'string' && e.points > 0,
  unfrost: (e) => Number.isInteger(e.id) && isCell(e),
  damage: (e) => isCell(e) && typeof e.kind === 'string' && Number.isInteger(e.hp) && e.hp > 0,
  destroy: (e) => isCell(e) && (e.kind === 'ice' || e.kind === 'crate'),
  rescue: (e) => isCell(e) && typeof e.who === 'string',
  freezerDown: (e) => isCell(e) && (e.who === 'cocardo' || e.who === 'cereza'),
  activate: (e) => Number.isInteger(e.id) && isCell(e) && SPEC[e.type] && 'color' in e && Array.isArray(e.cells) && e.cells.every(isCell) && e.points > 0,
  combo: (e) => isCell(e.a) && isCell(e.b) && Array.isArray(e.types) && e.types.length === 2 && isCell(e) && Array.isArray(e.cells) && Array.isArray(e.ids),
  create: (e) => Number.isInteger(e.id) && isCell(e) && SPEC[e.type] && 'color' in e,
  transform: (e) => Number.isInteger(e.id) && isCell(e) && SPEC[e.type],
  fall: (e) => Number.isInteger(e.id) && isCell(e.from) && isCell(e.to),
  spawn: (e) => Number.isInteger(e.id) && isCell(e.to) && (e.type === 'n' || e.type === 'token') && 'color' in e && Number.isInteger(e.from) && e.from < 0,
  collect: (e) => Number.isInteger(e.id) && isCell(e) && (e.skin === 'uva' || e.skin === 'prueba'),
  villain: (e) => typeof e.who === 'string' && (e.act === 'frost' || e.act === 'crate') && (e.src === 'hud' || e.src === 'boss') && Array.isArray(e.targets) && e.targets.every((t) => isCell(t) && Number.isInteger(t.id)),
  shuffle: (e) => (e.reason === 'nomoves' || e.reason === 'batido') && Array.isArray(e.pieces) && e.pieces.every((q) => Number.isInteger(q.id) && isCell(q) && 'color' in q && typeof q.type === 'string' && typeof q.frost === 'boolean'),
  points: (e) => isCell(e) && typeof e.value === 'number' && e.value > 0,
  goal: (e) => Number.isInteger(e.index) && Number.isInteger(e.remaining) && e.remaining >= 0,
  booster: (e) => ['cucharon', 'chorro', 'batido'].includes(e.type),
  win: () => true, lose: () => true,
};
function checkStepSchema(st, W) {
  assert.deepEqual(Object.keys(st).sort(), ['cascade', 'events', 'goals', 'kind', 'movesLeft', 'score'], `${W}: campos del paso`);
  assert.ok(Number.isInteger(st.cascade) && st.cascade >= 0 && Number.isInteger(st.score) && Number.isInteger(st.movesLeft) && Array.isArray(st.goals), `${W}: tipos del paso`);
  st.events.forEach((e) => assert.ok(EVENT_SCHEMA[e.t] && EVENT_SCHEMA[e.t](e), `${W}: evento con campos inválidos ${JSON.stringify(e)}`));
}

// Nivel de la pista (DISENO §2): combo 5 > crea Copa 4 > Bomba 3 > Paleta 2 > resto 1.
function moveTier(g, m) {
  const pa = pieceOf(g, m.a.r, m.a.c), pb = pieceOf(g, m.b.r, m.b.c);
  if (SPEC[pa.type] && SPEC[pb.type]) return 5;
  if (pa.type === 'copa' || pb.type === 'copa') return 1;
  const h = clone(g);
  h[m.a.r][m.a.c] = { p: pb }; h[m.b.r][m.b.c] = { p: pa };
  let tier = 1;
  groupsOf(h).forEach((gr) => {
    const x = expectedSpecial(h, gr, [m.a, m.b]);
    if (x && !x.options.has('none')) tier = Math.max(tier, { copa: 4, bomba: 3, ph: 2, pv: 2 }[x.type]);
  });
  return tier;
}

// Efectos de un golpe de área sobre una celda (activación / combo de área / potenciador).
function checkAreaEffects(pre, fz, area, selfKey, seg, ctx, where) {
  const evById = {};
  seg.forEach((e) => { if (e.t === 'clear' || e.t === 'unfrost') (evById[e.id] = evById[e.id] || []).push(e.t); });
  const areaK = keySet(area);
  let fzHit = false;
  for (const q of area) {
    const k = K(q.r, q.c);
    if (k === selfKey) continue;
    const cl = pre[q.r][q.c];
    if (cl.b) {
      if (cl.b.kind === 'freezer') { if (fz && fz.hp > 0) fzHit = true; continue; }
      const n = seg.filter((e) => HIT_T[e.t] && e.kind !== 'freezer' && e.t !== 'freezerDown' && K(e.r, e.c) === k).length;
      assert.equal(n, 1, `${where}: el bloqueo en ${q.r},${q.c} debe recibir exactamente 1 golpe (recibió ${n})`);
      continue;
    }
    const p = cl.p;
    if (!p) continue;
    const got = evById[p.id] || [];
    if (p.type === 'token') assert.equal(got.length, 0, `${where}: una ficha fue tocada por un golpe`);
    else if (p.frost) assert.ok(got[0] === 'unfrost', `${where}: pieza escarchada ${p.id} en el área no perdió la escarcha`);
    else if (SPEC[p.type]) {
      assert.ok(!got.includes('clear'), `${where}: especial ${p.id} quitado sin disparar`);
      if (!ctx.fired.has(p.id)) ctx.hitSpecials.add(p.id);
    } else assert.deepEqual(got, ['clear'], `${where}: pieza normal ${p.id} en ${q.r},${q.c} no fue quitada`);
  }
  const fzEv = seg.filter((e) => HIT_T[e.t] && (e.kind === 'freezer' || e.t === 'freezerDown')).length;
  assert.equal(fzEv, fzHit ? 1 : 0, `${where}: el congelador debe recibir ${fzHit ? 1 : 0} golpe(s) por activación (recibió ${fzEv})`);
  // nada fuera del área
  seg.forEach((e) => {
    if ((e.t === 'clear' || e.t === 'unfrost' || ((e.t === 'damage' || e.t === 'destroy' || e.t === 'rescue') && e.kind !== 'freezer')) && !areaK.has(K(e.r, e.c))) {
      assert.fail(`${where}: evento ${e.t} fuera del área en ${e.r},${e.c}`);
    }
  });
}

// prev: estado de entrada; res: resultado; call: {kind:'swap'|'booster'|'helado', a,b, type, cell}
function checkCall(prev, res, call, where) {
  const steps = res.steps;
  assert.ok(Array.isArray(steps), `${where}: steps no es arreglo`);
  const S = res.state;
  let grid = clone(prev.grid);
  let fz = prev.freezer ? { r: prev.freezer.r, c: prev.freezer.c, hp: prev.freezer.hp } : null;
  let score = prev.score, goals = prev.goals.map((x) => x.remaining), moves = prev.movesLeft;
  const ctx = { fired: new Set(), hitSpecials: new Set() };
  let expectWave = null, expectCombo = false, pendingCreate = null, lastClearC = 0, curCascade = 0;
  let afterTail = false, villainSteps = 0, shuffleSteps = 0, endStep = null, transformSteps = 0;
  const exits = new Set(), enters = new Set(), transformed = new Set();
  let collects = 0, tokenSpawns = 0, creates = 0, rescuedWho = [];
  const swapKind = call.kind === 'swap' && steps[0] && steps[0].kind === 'swap'
    ? (() => {
      const pa = pieceOf(prev.grid, call.a.r, call.a.c), pb = pieceOf(prev.grid, call.b.r, call.b.c);
      if (SPEC[pa.type] && SPEC[pb.type]) return 'combo';
      if (pa.type === 'copa' || pb.type === 'copa') return 'copa';
      return 'normal';
    })() : null;

  steps.forEach((st, si) => {
    const W = `${where} paso#${si}(${st.kind})`;
    assert.ok(ALLOWED[st.kind], `${W}: tipo de paso desconocido`);
    checkStepSchema(st, W);
    assert.ok(!endStep, `${W}: hay pasos después del paso 'end'`);
    st.events.forEach((e) => {
      SEEN[e.t] = 1;
      assert.ok(ALLOWED[st.kind].includes(e.t), `${W}: evento ${e.t} no permitido en paso ${st.kind}`);
    });
    // goal al final del paso
    const firstGoal = st.events.findIndex((e) => e.t === 'goal');
    if (firstGoal >= 0) assert.ok(st.events.slice(firstGoal).every((e) => e.t === 'goal'), `${W}: eventos goal no van al final`);
    if (afterTail && ['clear', 'activate', 'create', 'fall', 'booster', 'swap', 'transform'].includes(st.kind)) {
      assert.fail(`${W}: paso de resolución después de villano/barajado (el barajado dejó matches o el orden es incorrecto)`);
    }
    if (expectWave && expectWave.size && st.kind !== 'activate') assert.fail(`${W}: se esperaba una ola de activación con ${[...expectWave]} y llegó ${st.kind}`);
    if (pendingCreate && st.kind !== 'activate' && st.kind !== 'create') {
      const want = pendingCreate.filter((x) => !x.options.has('none'));
      assert.equal(want.length, 0, `${W}: faltó el paso create (se esperaban ${JSON.stringify(want.map((x) => x.type))})`);
      pendingCreate = null;
    }
    if (st.cascade > 0) {
      if (call.kind === 'helado' && st.kind === 'transform') curCascade = 0;
      assert.ok(st.cascade >= curCascade, `${W}: cascada retrocede ${curCascade}->${st.cascade}`);
      curCascade = st.cascade;
    }
    const pre = grid, preFz = fz ? { ...fz } : null;
    let dScore = 0;
    const dec = {};
    const segs = [];
    const addDec = (k, n) => { dec[k] = (dec[k] || 0) + (n || 1); };

    // ---------- verificación por tipo de paso, aplicando por segmentos
    if (st.kind === 'swap') {
      assert.equal(si, 0, `${W}: swap no es el primer paso`);
      const e = st.events[0];
      const pa = pieceOf(pre, e.a.r, e.a.c), pb = pieceOf(pre, e.b.r, e.b.c);
      assert.ok(pa && pb && !pa.frost && !pb.frost, `${W}: intercambio de pieza escarchada o vacía`);
      ({ grid, fz } = replayOn(grid, fz, st.events));
      moves -= 1;
      if (swapKind === 'combo') expectCombo = true;
      else if (swapKind === 'copa') expectWave = new Set([(pa.type === 'copa' ? pa : pb).id]);
    } else if (st.kind === 'invalid') {
      assert.equal(steps.length, 1, `${W}: invalid debe ser el único paso`);
    } else if (st.kind === 'clear') {
      assert.equal(st.events[0].t, 'cascade', `${W}: el paso clear no empieza con cascade`);
      assert.equal(st.events[0].c, st.cascade, `${W}: cascade.c != step.cascade`);
      assert.equal(st.cascade, lastClearC ? lastClearC + 1 : st.cascade, `${W}: cascadas no consecutivas`);
      if (!lastClearC && call.kind === 'swap' && swapKind === 'normal') assert.equal(st.cascade, 1, `${W}: primera cascada de un swap normal != 1`);
      lastClearC = st.cascade;
      const groups = groupsOf(pre);
      assert.ok(groups.length > 0, `${W}: paso clear sin grupos en el tablero`);
      const evs = st.events;
      const cleared = new Map(), unfrosted = new Set();
      evs.forEach((e) => {
        if (e.t === 'clear') { cleared.set(e.id, e); assert.equal(e.points, 20 * st.cascade, `${W}: puntos de clear`); }
        if (e.t === 'unfrost') unfrosted.add(e.id);
      });
      const wave = new Set();
      const U = new Set();
      groups.forEach((gr) => gr.cells.forEach((q) => {
        U.add(K(q.r, q.c));
        const p = pre[q.r][q.c].p;
        if (p.frost) {
          assert.ok(unfrosted.has(p.id), `${W}: pieza escarchada ${p.id} en grupo sin unfrost`);
          assert.ok(!cleared.has(p.id), `${W}: pieza escarchada ${p.id} quitada (debía solo perder escarcha)`);
        } else if (SPEC[p.type]) { assert.ok(!cleared.has(p.id), `${W}: especial quitado sin disparar`); wave.add(p.id); } else assert.ok(cleared.has(p.id), `${W}: pieza ${p.id} del grupo en ${q.r},${q.c} no fue quitada`);
      }));
      evs.forEach((e) => { if ((e.t === 'clear' || e.t === 'unfrost') && !U.has(K(e.r, e.c))) assert.fail(`${W}: ${e.t} fuera de los grupos en ${e.r},${e.c}`); });
      // daño por adyacencia: 1 por bloqueo por grupo (congelador = 1 objeto)
      const expHits = {};
      groups.forEach((gr) => {
        const adj = new Set();
        gr.cells.forEach((q) => [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
          const r = q.r + dr, c = q.c + dc;
          const cl = r >= 0 && c >= 0 && r < pre.length && c < pre[0].length ? pre[r][c] : null;
          if (cl && cl.b) adj.add(cl.b.kind === 'freezer' ? 'FZ' : K(r, c));
        }));
        adj.forEach((k) => { expHits[k] = (expHits[k] || 0) + 1; });
      });
      const gotHits = {};
      evs.forEach((e) => { if (HIT_T[e.t]) { const k = hitKey(e); gotHits[k] = (gotHits[k] || 0) + 1; } });
      new Set([...Object.keys(expHits), ...Object.keys(gotHits)]).forEach((k) => {
        const key = k === 'FZ' ? 'FZ' : +k;
        const want = Math.min(expHits[k] || 0, hpOf(pre, preFz, key));
        assert.equal(gotHits[k] || 0, want, `${W}: golpes al bloqueo ${k} = ${gotHits[k] || 0}, esperado ${want} (1 por grupo adyacente)`);
      });
      // lugar de especiales
      const swapCells = call.kind === 'swap' && st.cascade === 1 && swapKind === 'normal' ? [call.a, call.b] : null;
      pendingCreate = groups.map((gr) => expectedSpecial(pre, gr, swapCells)).filter(Boolean);
      pendingCreate.cascade = st.cascade;
      ({ grid, fz } = replayOn(grid, fz, evs));
      segs.push(evs);
      expectWave = wave;
      ctx.hitSpecials = new Set();
    } else if (st.kind === 'activate' || st.kind === 'booster') {
      // segmentos: cada activate/combo/booster abre uno
      const parts = [];
      st.events.forEach((e) => {
        if (e.t === 'activate' || e.t === 'combo' || e.t === 'booster' || !parts.length) parts.push([]);
        parts[parts.length - 1].push(e);
      });
      if (st.kind === 'activate') {
        st.events.filter((e) => e.t === 'transform').forEach((e) => { assert.ok(pieceOf(grid, e.r, e.c) && pieceOf(grid, e.r, e.c).id === e.id); });
        const ids = new Set(st.events.filter((e) => e.t === 'activate').map((e) => e.id));
        if (expectCombo) {
          assert.ok(st.events[0].t === 'combo', `${W}: tras un swap de dos especiales se esperaba combo`);
          expectCombo = false;
        } else {
          assert.ok(expectWave, `${W}: ola de activación inesperada`);
          assert.deepEqual([...ids].sort(), [...expectWave].sort(), `${W}: la ola dispara ${[...ids]} pero se esperaba ${[...expectWave]}`);
        }
      } else {
        assert.equal(si, 0, `${W}: booster no es el primer paso`);
        assert.ok(call.kind === 'booster', `${W}: paso booster fuera de un potenciador`);
      }
      ctx.hitSpecials = new Set();
      let nextWave = null;
      for (const seg of parts) {
        const h = seg[0];
        const SW = `${W} ${h.t}${h.type ? ':' + h.type : ''}@${h.r},${h.c}`;
        const g0 = grid, fz0 = fz ? { ...fz } : null;
        if (h.t === 'activate') {
          const p = pieceOf(g0, h.r, h.c);
          assert.ok(p && p.id === h.id && p.type === h.type && SPEC[p.type] && !p.frost, `${SW}: la pieza que dispara no está`);
          assert.ok(!ctx.fired.has(h.id), `${SW}: especial disparado dos veces`);
          ctx.fired.add(h.id);
          assert.equal(h.points, 20 * st.cascade, `${SW}: puntos de activación`);
          let area;
          if (h.type === 'ph') area = rowArea(g0, h.r);
          else if (h.type === 'pv') area = colArea(g0, h.c);
          else if (h.type === 'bomba') area = boxArea(g0, h.r, h.c, 1);
          else {
            const g1 = clone(g0); g1[h.r][h.c] = {};
            let want;
            if (swapKind === 'copa' && si === 1) {
              const pa = pieceOf(prev.grid, call.a.r, call.a.c), pb = pieceOf(prev.grid, call.b.r, call.b.c);
              want = (pa.type === 'copa' ? pb : pa).color;
            } else want = mostCommonN(g1);
            assert.equal(h.color, want, `${SW}: la Copa eligió color ${h.color}, se esperaba ${want}`);
            area = want ? colorCellsOf(g1, want) : [];
          }
          if (h.color !== undefined && h.type !== 'copa') assert.equal(h.color, p.color);
          assert.ok(sameCells(h.cells.filter((q) => K(q.r, q.c) !== K(h.r, h.c)), area.filter((q) => K(q.r, q.c) !== K(h.r, h.c))), `${SW}: celdas del área ${JSON.stringify(h.cells)} != esperado ${JSON.stringify(area)}`);
          checkAreaEffects(g0, fz0, area, K(h.r, h.c), seg, ctx, SW);
          if (p.color && p.type !== 'copa') addDec('color:' + p.color);
        } else if (h.t === 'combo') {
          assert.equal(si, 1, `${SW}: combo fuera del primer paso tras el swap`);
          const A = pieceOf(prev.grid, call.a.r, call.a.c), B = pieceOf(prev.grid, call.b.r, call.b.c);
          assert.deepEqual(h.types, [A.type, B.type], `${SW}: types del combo`);
          assert.deepEqual([h.r, h.c], [call.b.r, call.b.c], `${SW}: el combo debe centrarse en b`);
          const ta = A.type, tb = B.type, nPal = (PAL[ta] ? 1 : 0) + (PAL[tb] ? 1 : 0);
          const g1 = clone(g0);
          if (ta === 'copa' && tb === 'copa') {
            assert.deepEqual(h.ids.slice().sort(), [A.id, B.id].sort());
            g1[call.a.r][call.a.c] = {}; g1[call.b.r][call.b.c] = {};
            const all = []; g1.forEach((row, r) => row.forEach((cl, c) => { if (cl) all.push(P(r, c)); }));
            assert.ok(sameCells(h.cells, all), `${SW}: Copa+Copa debe cubrir todo el tablero`);
            const byId = {};
            seg.forEach((e) => { if (e.t === 'clear' || e.t === 'unfrost') byId[e.id] = e.t; });
            let blockers = new Set(), fzAlive = false;
            all.forEach((q) => {
              const cl = g1[q.r][q.c];
              if (cl.b) { if (cl.b.kind === 'freezer') fzAlive = fz0 && fz0.hp > 0; else blockers.add(K(q.r, q.c)); return; }
              if (!cl.p) return;
              const pp = cl.p;
              if (pp.type === 'token') assert.equal(byId[pp.id], undefined, `${SW}: Copa+Copa tocó una ficha`);
              else if (pp.frost) assert.equal(byId[pp.id], 'unfrost', `${SW}: escarcha no rota`);
              else assert.equal(byId[pp.id], 'clear', `${SW}: pieza ${pp.type} ${pp.id} no quitada por Copa+Copa`);
            });
            const hits = {};
            seg.forEach((e) => { if (HIT_T[e.t]) { const k = hitKey(e); hits[k] = (hits[k] || 0) + 1; } });
            blockers.forEach((k) => assert.equal(hits[k], 1, `${SW}: cada bloqueo recibe 1 daño en Copa+Copa`));
            assert.equal(hits.FZ || 0, fzAlive ? 1 : 0, `${SW}: congelador en Copa+Copa`);
            assert.equal(seg.filter((e) => e.t === 'activate').length, 0);
            ctx.fired.add(A.id); ctx.fired.add(B.id);
            seg.filter((e) => e.t === 'clear').forEach((e) => ctx.fired.add(e.id));
            nextWave = new Set();
          } else if (ta === 'copa' || tb === 'copa') {
            const Cp = ta === 'copa' ? A : B, X = ta === 'copa' ? B : A;
            assert.deepEqual(h.ids, [Cp.id], `${SW}: Copa+${X.type} solo quita la Copa`);
            const posC = ta === 'copa' ? call.b : call.a;
            g1[posC.r][posC.c] = {};
            const targets = [];
            g1.forEach((row, r) => row.forEach((cl, c) => { if (cl && cl.p && cl.p.type === 'n' && !cl.p.frost && cl.p.color === X.color) targets.push(P(r, c)); }));
            assert.ok(sameCells(h.cells, targets), `${SW}: celdas de Copa+${X.type}`);
            const tr = seg.filter((e) => e.t === 'transform');
            assert.ok(sameCells(tr, targets), `${SW}: transform debe cubrir toda ${X.color} normal no escarchada`);
            tr.forEach((e) => {
              if (X.type === 'bomba') assert.equal(e.type, 'bomba'); else assert.ok(PAL[e.type], `${SW}: transform a ${e.type}`);
              assert.equal(e.color, X.color);
              transformed.add(e.id);
            });
            assert.equal(seg.filter((e) => e.t === 'clear' || HIT_T[e.t]).length, 0, `${SW}: Copa+${X.type} no debe golpear nada en su paso`);
            ctx.fired.add(Cp.id);
            nextWave = new Set([X.id, ...tr.map((e) => e.id)]);
          } else {
            assert.deepEqual(h.ids.slice().sort(), [A.id, B.id].sort());
            g1[call.a.r][call.a.c] = {}; g1[call.b.r][call.b.c] = {};
            const b = call.b;
            let area;
            if (nPal === 2) area = union([rowArea(g1, b.r), colArea(g1, b.c)]);
            else if (nPal === 1) {
              const ls = [];
              for (let d = -1; d <= 1; d++) {
                if (b.r + d >= 0 && b.r + d < g1.length) ls.push(rowArea(g1, b.r + d));
                if (b.c + d >= 0 && b.c + d < g1[0].length) ls.push(colArea(g1, b.c + d));
              }
              area = union(ls);
            } else area = boxArea(g1, b.r, b.c, 2);
            assert.ok(sameCells(h.cells, area), `${SW}: área del combo ${ta}+${tb}`);
            ctx.fired.add(A.id); ctx.fired.add(B.id);
            checkAreaEffects(g1, fz0, area, -1, seg, ctx, SW);
          }
          assert.equal(h.points, 20 * st.cascade * h.ids.length, `${SW}: puntos del combo`);
          h.ids.forEach((id) => { const pp = id === A.id ? A : B; if (pp.color) addDec('color:' + pp.color); });
        } else if (h.t === 'booster') {
          assert.equal(h.type, call.type, `${SW}: tipo de booster`);
          if (h.type === 'batido') { assert.equal(seg.length, 1); } else if (h.type === 'cucharon') {
            assert.deepEqual([h.r, h.c], [call.cell.r, call.cell.c]);
            assert.ok(sameCells(h.cells, [call.cell]));
            const cl = g0[h.r][h.c];
            if (cl.p && SPEC[cl.p.type]) assert.equal(seg.filter((e) => e.t !== 'booster').length, 0, `${SW}: Cucharón sobre especial: el paso booster solo lleva el evento booster`);
            checkAreaEffects(g0, fz0, [call.cell], -1, seg, ctx, SW);
          } else {
            assert.equal(h.r, call.cell.r);
            const area = rowArea(g0, h.r);
            assert.ok(sameCells(h.cells, area), `${SW}: Chorro debe cubrir la fila`);
            checkAreaEffects(g0, fz0, area, -1, seg, ctx, SW);
          }
        } else assert.fail(`${SW}: segmento sin cabecera`);
        seg.forEach((e) => {
          if (e.t === 'clear') {
            assert.notEqual(e.type, 'token', `${SW}: ficha quitada por un golpe`);
            assert.equal(e.points, 20 * st.cascade, `${SW}: puntos de clear`);
          }
        });
        ({ grid, fz } = replayOn(grid, fz, seg));
        segs.push(seg);
      }
      expectWave = nextWave || new Set([...ctx.hitSpecials].filter((id) => !ctx.fired.has(id)));
      if (st.kind === 'booster' && call.type === 'batido') expectWave = null;
    } else if (st.kind === 'create') {
      assert.ok(pendingCreate && pendingCreate.cascade === st.cascade, `${W}: create sin paso clear previo en la misma cascada`);
      const want = pendingCreate.filter((x) => !x.options.has('none') || x.options.size > 1);
      const got = st.events.filter((e) => e.t === 'create');
      const used = new Set();
      got.forEach((e) => {
        SEEN['create:' + e.type] = 1;
        assert.ok(grid[e.r][e.c] && !grid[e.r][e.c].p && !grid[e.r][e.c].b, `${W}: create en celda ocupada`);
        const ix = want.findIndex((x, i) => !used.has(i) && x.type === e.type && x.color === e.color && x.options.has(K(e.r, e.c)));
        assert.ok(ix >= 0, `${W}: create ${e.type}@${e.r},${e.c} no coincide con lo esperado ${JSON.stringify(want.map((x) => [x.type, x.color, [...x.options]]))}`);
        used.add(ix);
      });
      const missing = want.filter((x, i) => !used.has(i) && !x.options.has('none'));
      assert.equal(missing.length, 0, `${W}: faltan especiales ${JSON.stringify(missing.map((x) => [x.type, [...x.options]]))}`);
      creates += got.length;
      pendingCreate = null;
      ({ grid, fz } = replayOn(grid, fz, st.events));
      segs.push(st.events);
    } else if (st.kind === 'fall') {
      pendingCreate = null;
      const falls = st.events.filter((e) => e.t === 'fall'), spawns = st.events.filter((e) => e.t === 'spawn');
      const colsEv = st.events.filter((e) => e.t === 'collect');
      falls.forEach((e) => {
        const p = pieceOf(pre, e.from.r, e.from.c);
        assert.ok(p && p.id === e.id, `${W}: fall de pieza ausente`);
        assert.ok(!p.frost, `${W}: una pieza escarchada (${p.id}) cayó`);
        assert.equal(e.from.c, e.to.c, `${W}: caída diagonal`);
      });
      const byCol = {};
      spawns.forEach((e) => {
        (byCol[e.to.c] = byCol[e.to.c] || []).push(e);
        if (e.type === 'token') { tokenSpawns++; assert.ok(prev.tokens, `${W}: ficha sin config de fichas`); assert.equal(e.skin, prev.tokens.skin); assert.equal(e.color, null); } else { assert.equal(e.type, 'n'); assert.ok(prev.colors.includes(e.color), `${W}: color fuera del nivel`); }
        enters.add(e.id);
      });
      Object.values(byCol).forEach((list) => {
        list.sort((x, y) => y.to.r - x.to.r);
        list.forEach((e, i) => assert.equal(e.from, -(i + 1), `${W}: spawn.from debe ser -1,-2… desde abajo`));
        const top = list[list.length - 1];
        list.forEach((e) => { if (e.type === 'token') assert.equal(e.to.r, top.to.r, `${W}: la ficha debe nacer en el hueco superior`); });
      });
      const noCol = st.events.filter((e) => e.t !== 'collect' && !(e.t === 'points' && colsEv.length) && e.t !== 'goal');
      ({ grid, fz } = replayOn(grid, fz, noCol));
      colsEv.forEach((e) => {
        assert.equal(e.r, lowestSlot(grid, e.c), `${W}: ficha recolectada en ${e.r},${e.c} que no es el slot más bajo`);
        assert.equal(pieceOf(grid, e.r, e.c).type, 'token');
        exits.add(e.id); collects++;
      });
      ({ grid, fz } = replayOn(grid, fz, st.events.filter((e) => e.t === 'collect')));
      if (colsEv.length) {
        assert.ok(steps[si + 1] && steps[si + 1].kind === 'fall', `${W}: tras una recolección debe venir otro paso fall`);
      } else {
        assert.ok(!hasEmpty(grid), `${W}: quedan celdas vacías tras la caída`);
        for (let c = 0; c < grid[0].length; c++) {
          const lr = lowestSlot(grid, c);
          if (lr >= 0) assert.ok(!(grid[lr][c].p && grid[lr][c].p.type === 'token'), `${W}: ficha en el slot más bajo de la columna ${c} sin recolectar`);
        }
        if (prev.tokens) {
          let n = 0; grid.forEach((row) => row.forEach((cl) => { if (cl && cl.p && cl.p.type === 'token') n++; }));
          let n0 = 0; prev.grid.forEach((row) => row.forEach((cl) => { if (cl && cl.p && cl.p.type === 'token') n0++; }));
          assert.ok(n <= Math.max(prev.tokens.onBoard, n0), `${W}: más fichas (${n}) que onBoard`);
        }
      }
      segs.push(st.events);
    } else if (st.kind === 'villain') {
      villainSteps++;
      afterTail = true;
      assert.equal(call.kind, 'swap', `${W}: villano fuera de un intercambio`);
      for (const e of st.events) {
        const elig = []; grid.forEach((row, r) => row.forEach((cl, c) => { if (cl && cl.p && cl.p.type === 'n' && !cl.p.frost) elig.push(K(r, c)); }));
        const v = prev.villains.find((x) => x.who === e.who && x.act === e.act && x.src === e.src);
        assert.ok(v, `${W}: villano desconocido`);
        assert.equal(e.targets.length, Math.min(v.count, elig.length), `${W}: cantidad de objetivos del villano`);
        assert.equal(new Set(e.targets.map((t) => K(t.r, t.c))).size, e.targets.length, `${W}: objetivos repetidos`);
        e.targets.forEach((t) => {
          const p = pieceOf(grid, t.r, t.c);
          assert.ok(p && p.id === t.id && p.type === 'n' && !p.frost, `${W}: villano apuntó a ${p ? p.type + (p.frost ? '*' : '') : 'nada'}`);
          if (e.act === 'crate') exits.add(t.id);
        });
        ({ grid, fz } = replayOn(grid, fz, [e]));
      }
      segs.push(st.events);
    } else if (st.kind === 'shuffle') {
      shuffleSteps++;
      afterTail = true;
      const e = st.events[0];
      assert.equal(st.events.length, 1);
      assert.equal(e.who, prev.levelId >= 21 ? 'cereza' : 'cocardo', `${W}: who del barajado`);
      if (call.kind === 'booster' && call.type === 'batido' && shuffleSteps === 1) assert.equal(e.reason, 'batido');
      else {
        assert.equal(e.reason, 'nomoves');
        assert.equal(allSwaps(pre).length, 0, `${W}: barajado 'nomoves' con jugadas disponibles`);
      }
      const before = {};
      pre.forEach((row, r) => row.forEach((cl, c) => { if (cl && cl.p) before[cl.p.id] = { ...cl.p, r, c }; }));
      assert.equal(e.pieces.length, Object.keys(before).length, `${W}: el barajado cambió la cantidad de piezas`);
      e.pieces.forEach((q) => {
        const o = before[q.id];
        assert.ok(o, `${W}: pieza nueva en barajado`);
        assert.equal(q.type, o.type, `${W}: el barajado cambió el tipo de ${q.id}`);
        if (o.type === 'copa' || o.type === 'token') assert.deepEqual([q.r, q.c], [o.r, o.c], `${W}: el barajado movió una ${o.type}`);
        if (o.frost && q.frost) assert.deepEqual([q.r, q.c], [o.r, o.c], `${W}: el barajado movió una pieza escarchada`);
        assert.ok(!(q.frost && !o.frost), `${W}: el barajado agregó escarcha`);
        if (o.type !== 'n') assert.equal(q.color, o.color, `${W}: el barajado cambió el color de un especial`);
        else assert.ok(prev.colors.includes(q.color));
      });
      ({ grid, fz } = replayOn(grid, fz, st.events));
      assert.equal(groupsOf(grid).length, 0, `${W}: el barajado dejó matches`);
      assert.ok(allSwaps(grid).length > 0, `${W}: el barajado dejó el tablero sin jugadas`);
      segs.push(st.events);
    } else if (st.kind === 'transform') {
      assert.equal(call.kind, 'helado', `${W}: paso transform fuera de Helado Final`);
      transformSteps++;
      moves -= 1;
      dScore += 300;
      const tr = st.events.filter((e) => e.t === 'transform');
      assert.ok(tr.length <= 1);
      if (tr.length) {
        const p = pieceOf(pre, tr[0].r, tr[0].c);
        assert.ok(p && p.id === tr[0].id && p.type === 'n' && !p.frost, `${W}: Helado Final transformó algo que no es normal`);
        assert.ok(PAL[tr[0].type]);
        assert.equal(tr[0].color, p.color);
        expectWave = new Set([p.id]);
      } else {
        let n = 0; pre.forEach((row) => row.forEach((cl) => { if (cl && cl.p && cl.p.type === 'n' && !cl.p.frost) n++; }));
        assert.equal(n, 0, `${W}: transform vacío habiendo piezas normales`);
        expectWave = null;
      }
      ctx.fired = new Set();
      lastClearC = 0;
      ({ grid, fz } = replayOn(grid, fz, st.events));
      segs.push(st.events);
    } else if (st.kind === 'end') {
      endStep = st;
      assert.equal(st.events.length, 1);
      ({ grid, fz } = replayOn(grid, fz, st.events));
    }

    // ---------- puntaje y metas derivados de los eventos
    st.events.forEach((e) => {
      if (e.t === 'clear') { dScore += e.points; if (e.color) addDec('color:' + e.color); exits.add(e.id); }
      if (e.t === 'activate') { dScore += e.points; exits.add(e.id); }
      if (e.t === 'combo') { dScore += e.points; e.ids.forEach((id) => exits.add(id)); }
      if (e.t === 'create') { dScore += 60; enters.add(e.id); }
      if (HIT_T[e.t]) dScore += 50;
      if (e.t === 'rescue') { dScore += 1000; addDec('rescue'); rescuedWho.push(e.who); }
      if (e.t === 'destroy') addDec(e.kind === 'ice' ? 'ice' : 'crate');
      if ((e.t === 'damage' && e.kind === 'freezer') || e.t === 'freezerDown') addDec('boss');
      if (e.t === 'collect') { dScore += 500; addDec('token'); }
    });
    if (st.kind !== 'invalid') {
      assert.equal(st.score - score, dScore, `${W}: el puntaje subió ${st.score - score}, los eventos suman ${dScore}`);
      const expGoals = prev.goals.map((gl, i) => {
        const k = gl.type === 'color' ? 'color:' + gl.color : gl.type;
        return Math.max(0, goals[i] - (dec[k] || 0));
      });
      assert.deepEqual(st.goals, expGoals, `${W}: metas ${JSON.stringify(st.goals)} != derivadas de eventos ${JSON.stringify(expGoals)}`);
      const gev = st.events.filter((e) => e.t === 'goal');
      st.goals.forEach((v, i) => {
        const ev = gev.filter((e) => e.index === i);
        if (v !== goals[i]) assert.ok(ev.length === 1 && ev[0].remaining === v, `${W}: falta evento goal para la meta ${i}`);
        else assert.equal(ev.length, 0, `${W}: evento goal sin cambio`);
      });
      assert.equal(st.movesLeft, moves, `${W}: movesLeft del paso`);
      score = st.score; goals = st.goals.slice();
    }
  });
  if (expectWave && expectWave.size) assert.fail(`${where}: quedaron especiales golpeados sin disparar: ${[...expectWave]}`);
  if (pendingCreate && pendingCreate.some((x) => !x.options.has('none'))) assert.fail(`${where}: faltó el paso create al final`);

  // ---------- grilla final == Replay
  assert.deepStrictEqual(grid, S.grid, `${where}: Replay por segmentos != state.grid`);
  assert.deepStrictEqual(Replay.apply(prev, steps), S.grid, `${where}: Replay.apply(prev, steps) != state.grid`);
  if (prev.freezer) assert.equal(fz.hp, S.freezer.hp, `${where}: hp del congelador`);

  // ---------- estado
  checkStateShape(prev, S, where);
  assert.ok(S.score >= prev.score, `${where}: el puntaje bajó`);
  if (steps.length && steps[0].kind !== 'invalid') {
    const last = steps[steps.length - 1];
    assert.equal(last.score, S.score, `${where}: score del último paso`);
    assert.equal(last.movesLeft, S.movesLeft, `${where}: movesLeft del último paso`);
    assert.deepEqual(last.goals, S.goals.map((x) => x.remaining), `${where}: metas del último paso`);
  }
  // ids: los que no salieron se conservan; los nuevos son spawn/create
  const idsPrev = new Set(), idsNow = new Set();
  prev.grid.forEach((row) => row.forEach((cl) => { if (cl && cl.p) idsPrev.add(cl.p.id); }));
  S.grid.forEach((row) => row.forEach((cl) => { if (cl && cl.p) idsNow.add(cl.p.id); }));
  idsPrev.forEach((id) => { if (!idsNow.has(id)) assert.ok(exits.has(id), `${where}: la pieza ${id} desapareció sin evento`); });
  idsNow.forEach((id) => { if (!idsPrev.has(id)) assert.ok(enters.has(id), `${where}: la pieza ${id} apareció sin evento`); });
  assert.ok(S.nextId >= prev.nextId, `${where}: nextId bajó`);
  // tipos conservados salvo transform
  const tPrev = {};
  prev.grid.forEach((row) => row.forEach((cl) => { if (cl && cl.p) tPrev[cl.p.id] = cl.p; }));
  S.grid.forEach((row) => row.forEach((cl) => {
    if (cl && cl.p && tPrev[cl.p.id] && !transformed.has(cl.p.id) && call.kind !== 'helado') assert.equal(cl.p.type, tPrev[cl.p.id].type, `${where}: tipo cambiado sin transform`);
  }));
  if (prev.tokens) {
    assert.equal(S.tokens.collected, prev.tokens.collected + collects, `${where}: tokens.collected`);
    assert.equal(S.tokens.spawned, prev.tokens.spawned + tokenSpawns, `${where}: tokens.spawned`);
    assert.ok(S.tokens.spawned <= Math.max(S.tokens.total, prev.tokens.spawned), `${where}: más fichas que total`);
  }
  assert.deepEqual(S.rescued, prev.rescued.concat(rescuedWho), `${where}: rescued`);
  assert.ok(S.stats.maxCascade >= prev.stats.maxCascade);
  assert.equal(S.stats.specials, prev.stats.specials + creates, `${where}: stats.specials`);

  // ---------- transiciones de estado
  const done = goalsDone(S.goals);
  if (call.kind === 'swap') {
    const valid = swapOk(prev.grid, call.a, call.b) && prev.status === 'playing';
    if (!valid) {
      assert.equal(steps.length, 1, `${where}: swap inválido con más de un paso`);
      assert.equal(steps[0].kind, 'invalid');
      assert.equal(res.turnInfo.valid, false);
      assert.deepStrictEqual(S, prev, `${where}: un swap inválido cambió el estado`);
      return;
    }
    assert.equal(res.turnInfo.valid, true, `${where}: swap válido marcado inválido`);
    assert.equal(S.movesLeft, prev.movesLeft - 1, `${where}: movesLeft debe bajar exactamente 1`);
    assert.equal(S.turn, prev.turn + 1);
    assert.equal(res.turnInfo.combo, swapKind === 'combo', `${where}: turnInfo.combo`);
    assert.equal(res.turnInfo.specials, creates, `${where}: turnInfo.specials`);
    const maxC = Math.max(0, ...steps.map((x) => x.cascade));
    assert.equal(res.turnInfo.cascades, maxC, `${where}: turnInfo.cascades`);
    if (done) {
      assert.equal(S.status, 'won', `${where}: metas completas sin victoria`);
      assert.equal(villainSteps, 0, `${where}: el villano actuó en el turno ganador`);
      assert.ok(endStep && endStep.events[0].t === 'win', `${where}: falta win`);
      assert.equal(S.wonMovesLeft, S.movesLeft);
    } else if (S.movesLeft === 0) {
      assert.equal(S.status, 'lost', `${where}: sin movimientos y metas incompletas debe perder`);
      assert.equal(villainSteps, 0, `${where}: el villano actuó sin movimientos restantes`);
      assert.ok(endStep && endStep.events[0].t === 'lose', `${where}: falta lose`);
    } else {
      assert.equal(S.status, 'playing', `${where}: estado ${S.status} con metas incompletas y ${S.movesLeft} movimientos`);
      assert.equal(endStep, null, `${where}: paso end sin terminar`);
    }
    // contadores de villanos
    const exp = prev.villains.map((v) => ({ ...v }));
    const acts = [];
    if (!done && S.movesLeft > 0) {
      exp.forEach((v) => {
        if (v.src === 'boss' && S.freezer && S.freezer.hp <= 0) return;
        v.counter--;
        if (v.counter <= 0) { acts.push(v); v.counter = v.every; }
      });
    }
    assert.deepEqual(S.villains, exp, `${where}: contadores de villanos`);
    const vev = steps.filter((x) => x.kind === 'villain').flatMap((x) => x.events);
    assert.deepEqual(vev.map((e) => [e.who, e.act, e.src]), acts.map((v) => [v.who, v.act, v.src]), `${where}: villanos que actuaron`);
  } else if (call.kind === 'booster') {
    assert.equal(S.movesLeft, prev.movesLeft, `${where}: un potenciador gastó movimiento`);
    assert.deepEqual(S.villains, prev.villains, `${where}: un potenciador movió contadores de villanos`);
    assert.equal(villainSteps, 0);
    assert.notEqual(S.status, 'lost', `${where}: un potenciador hizo perder`);
    assert.equal(S.status, done ? 'won' : 'playing', `${where}: estado tras potenciador`);
    if (done) assert.ok(endStep && endStep.events[0].t === 'win');
    else assert.equal(endStep, null);
    if (call.type === 'batido') assert.deepEqual(steps.slice(0, 2).map((x) => x.kind), ['booster', 'shuffle'], `${where}: Batido = booster + shuffle`);
  } else if (call.kind === 'helado') {
    assert.equal(S.status, 'won');
    assert.equal(S.movesLeft, 0, `${where}: Helado Final debe dejar 0 movimientos`);
    assert.equal(transformSteps, prev.movesLeft, `${where}: un paso transform por movimiento restante`);
    assert.equal(villainSteps + shuffleSteps, 0, `${where}: Helado Final sin villanos ni barajado`);
    assert.equal(endStep, null);
    assert.ok(S.score >= prev.score + 300 * prev.movesLeft);
  }
  if (S.status === 'playing') {
    const vm = Engine.validMoves(clone(S));
    assert.ok(vm.length > 0, `${where}: estado jugable sin jugadas (garantía de barajado)`);
    assert.deepEqual(vm.map(moveKey).sort(), allSwaps(S.grid).map(moveKey).sort(), `${where}: validMoves no coincide con las reglas`);
    assert.ok(!done, `${where}: metas completas pero sigue jugando`);
  }
}

// Forma y validez de un estado devuelto.
function checkStateShape(prev, S, where) {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(S)), S, `${where}: el estado no es JSON-clonable`);
  for (const k of ['levelId', 'daily', 'rows', 'cols', 'colors', 'rng', 'nextId', 'turn', 'grid', 'freezer', 'movesLeft', 'movesTotal', 'score', 'goals', 'villains', 'tokens', 'rescued', 'status', 'stats']) assert.ok(k in S, `${where}: falta state.${k}`);
  assert.ok(Number.isInteger(S.rng) && S.rng >= 0 && S.rng <= 0xFFFFFFFF, `${where}: rng no es uint32`);
  assert.equal(typeof S.daily, 'boolean');
  assert.ok(['playing', 'won', 'lost'].includes(S.status));
  const gu = Engine.goalUnits(S);
  assert.deepEqual(gu, { remaining: S.goals.reduce((x, g) => x + g.remaining, 0), start: S.goals.reduce((x, g) => x + g.target, 0) }, `${where}: goalUnits`);
  assert.equal(S.rows, prev.rows); assert.equal(S.cols, prev.cols);
  assert.deepEqual(S.colors, prev.colors);
  assert.equal(S.levelId, prev.levelId);
  assert.equal(S.grid.length, S.rows);
  const ids = new Set();
  S.grid.forEach((row, r) => {
    assert.equal(row.length, S.cols);
    row.forEach((cl, c) => {
      const pc = prev.grid[r][c];
      assert.equal(cl === null, pc === null, `${where}: ${r},${c} cambió entre vacío y jugable`);
      if (cl === null) return;
      const keys = Object.keys(cl);
      assert.ok(keys.length === 1 && (keys[0] === 'b' || keys[0] === 'p'), `${where}: celda ${r},${c} con claves ${keys} (debe tener exactamente una pieza o un bloqueo)`);
      if (cl.b) {
        assert.ok(['ice', 'crate', 'friend', 'freezer'].includes(cl.b.kind));
        if (cl.b.kind !== 'freezer') assert.ok(cl.b.hp > 0 && cl.b.hp <= cl.b.maxHp, `${where}: hp de bloqueo inválido en ${r},${c}`);
        else assert.ok(S.freezer && S.freezer.hp > 0, `${where}: celda de congelador con hp 0`);
        return;
      }
      const p = cl.p;
      assert.ok(Number.isInteger(p.id) && p.id > 0 && p.id < S.nextId, `${where}: id inválido ${p.id}`);
      assert.ok(!ids.has(p.id), `${where}: id duplicado ${p.id}`);
      ids.add(p.id);
      assert.ok(['n', 'ph', 'pv', 'bomba', 'copa', 'token'].includes(p.type));
      assert.equal(typeof p.frost, 'boolean');
      if (p.frost) assert.equal(p.type, 'n', `${where}: escarcha sobre ${p.type}`);
      if (p.type === 'copa' || p.type === 'token') assert.equal(p.color, null);
      else assert.ok(S.colors.includes(p.color), `${where}: color ${p.color} fuera del nivel`);
      if (p.type === 'token') assert.ok(p.skin === 'uva' || p.skin === 'prueba');
      else assert.equal(p.skin, undefined);
    });
  });
  if (S.freezer) {
    assert.ok(S.freezer.hp >= 0);
    if (S.freezer.hp > 0) for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) assert.ok(freezerKeyAt(S.grid, S.freezer.r + dr, S.freezer.c + dc), `${where}: congelador incompleto`);
  }
  S.goals.forEach((gl, i) => {
    assert.ok(gl.remaining >= 0 && gl.remaining <= gl.target, `${where}: meta ${i} fuera de rango`);
    assert.ok(gl.remaining <= prev.goals[i].remaining, `${where}: meta ${i} subió`);
  });
  assert.equal(groupsOf(S.grid).length, 0, `${where}: quedan matches en el tablero estable`);
  assert.ok(Engine.isStable(S));
}

// Llamada + validación + determinismo + no mutación.
function run(prev, call, where) {
  deepFreeze(prev);
  const snap = JSON.stringify(prev);
  const doIt = (st) => {
    if (call.kind === 'swap') return Engine.applySwap(st, call.a, call.b);
    if (call.kind === 'booster') return Engine.useBooster(st, call.type, call.cell);
    return Engine.heladoFinal(st);
  };
  const res = doIt(prev);
  assert.equal(JSON.stringify(prev), snap, `${where}: la entrada fue mutada`);
  const again = doIt(clone(prev));
  assert.deepStrictEqual(again, res, `${where}: no determinista`);
  if (call.kind === 'booster') {
    const legal = prev.status === 'playing' && ['cucharon', 'chorro', 'batido'].includes(call.type) && (call.type === 'batido' || (
      call.cell && call.cell.r >= 0 && call.cell.c >= 0 && call.cell.r < prev.rows && call.cell.c < prev.cols && prev.grid[call.cell.r][call.cell.c] &&
      !(call.type === 'cucharon' && prev.grid[call.cell.r][call.cell.c].p && prev.grid[call.cell.r][call.cell.c].p.type === 'token')));
    if (!legal) { assert.equal(res, null, `${where}: potenciador ilegal aceptado`); return null; }
    assert.ok(res, `${where}: potenciador legal rechazado`);
  }
  if (call.kind === 'helado' && prev.status !== 'won') {
    assert.equal(res.steps.length, 0, `${where}: Helado Final fuera de victoria`);
    assert.deepStrictEqual(res.state, prev);
    return res;
  }
  checkCall(prev, res, call, where);
  return res;
}

// Tablero inicial (ARQUITECTURA §4.1, DISENO §3.7).
function checkInitial(level, s, where) {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s)), s, `${where}: estado no JSON-clonable`);
  assert.equal(s.rows, level.layout.length); assert.equal(s.cols, level.layout[0].length);
  assert.equal(s.status, 'playing'); assert.equal(s.score, 0); assert.equal(s.turn, 0);
  assert.equal(s.movesLeft, level.moves); assert.equal(s.movesTotal, level.moves);
  assert.deepEqual(s.colors, level.colors.split(''));
  const ids = new Set();
  let ice = 0, friends = 0, nT = 0;
  const fi = [];
  level.layout.forEach((row, r) => [...row].forEach((ch, c) => {
    const cl = s.grid[r][c];
    if (ch === '#') { assert.equal(cl, null, `${where}: vacío en ${r},${c}`); return; }
    assert.ok(cl, `${where}: celda jugable nula en ${r},${c}`);
    if ('123'.includes(ch)) { ice++; assert.deepEqual(cl.b, { kind: 'ice', hp: +ch, maxHp: +ch }); return; }
    if (ch === 'K') { assert.deepEqual(cl.b, { kind: 'crate', hp: 1, maxHp: 1 }); return; }
    if (ch === 'R') { friends++; fi.push(cl.b.who); const hp = level.friendHP || 2; assert.equal(cl.b.kind, 'friend'); assert.equal(cl.b.hp, hp); assert.equal(cl.b.maxHp, hp); return; }
    if (ch === 'C') { assert.deepEqual(cl.b, { kind: 'freezer' }); return; }
    assert.ok(cl.p, `${where}: sin pieza en ${r},${c}`);
    assert.ok(!ids.has(cl.p.id)); ids.add(cl.p.id);
    assert.ok(cl.p.id < s.nextId);
    if (ch === 'T') { nT++; assert.equal(cl.p.type, 'token'); assert.equal(cl.p.skin, level.tokens.skin); assert.equal(cl.p.color, null); return; }
    assert.equal(cl.p.type, 'n', `${where}: el tablero inicial trae ${cl.p.type}`);
    assert.ok(s.colors.includes(cl.p.color));
    assert.equal(cl.p.frost, ch === 'e', `${where}: escarcha en ${r},${c}`);
  }));
  assert.deepEqual(fi, (level.rescue || []).slice(0, friends), `${where}: amigos en orden de lectura`);
  if (level.freezer) {
    assert.ok(s.freezer);
    assert.equal(s.freezer.hp, level.freezer.hp); assert.equal(s.freezer.maxHp, level.freezer.hp); assert.equal(s.freezer.who, level.freezer.who);
    assert.equal(level.layout[s.freezer.r][s.freezer.c], 'C');
  } else assert.equal(s.freezer, null);
  if (level.tokens) assert.deepEqual(s.tokens, { skin: level.tokens.skin, total: level.tokens.total, onBoard: level.tokens.onBoard, spawned: nT, collected: 0 });
  s.villains.forEach((v, i) => { assert.equal(v.counter, level.villains[i].every); assert.equal(v.count, level.villains[i].count || 1); assert.equal(v.src, level.villains[i].src || 'hud'); });
  level.goals.forEach((gl, i) => {
    const want = gl.type === 'color' ? gl.n : gl.type === 'ice' ? ice : gl.type === 'crate' ? gl.n : gl.type === 'rescue' ? friends : gl.type === 'token' ? level.tokens.total : level.freezer.hp;
    assert.equal(s.goals[i].type, gl.type);
    assert.equal(s.goals[i].target, want, `${where}: objetivo de meta ${gl.type}`);
    assert.equal(s.goals[i].remaining, want);
  });
  assert.equal(groupsOf(s.grid).length, 0, `${where}: tablero inicial con matches`);
  const mv = allSwaps(s.grid);
  assert.ok(mv.length > 0, `${where}: tablero inicial sin jugadas`);
  if (level.ensure) {
    const ok = mv.some((m) => {
      if (!swapOk(s.grid, m.a, m.b)) return false;
      const h = clone(s.grid);
      const pa = h[m.a.r][m.a.c].p, pb = h[m.b.r][m.b.c].p;
      if (pa.type !== 'n' || pb.type !== 'n') return false;
      h[m.a.r][m.a.c] = { p: pb }; h[m.b.r][m.b.c] = { p: pa };
      return groupsOf(h).some((gr) => {
        const x = expectedSpecial(h, gr, [m.a, m.b]);
        return x && !x.options.has('none') && (x.type === level.ensure || (level.ensure === 'ph' && PAL[x.type]));
      });
    });
    assert.ok(ok, `${where}: ensure '${level.ensure}' no respetado`);
  }
}

// ======================================================================= niveles de DISENO §7
function shape(name) {
  if (name === 'R7') return Array.from({ length: 7 }, () => '.......'.split(''));
  const g = Array.from({ length: 8 }, () => '........'.split(''));
  const voids = {
    R8: [],
    OCT: [[0, 0], [0, 1], [1, 0], [0, 6], [0, 7], [1, 7], [6, 0], [7, 0], [7, 1], [6, 7], [7, 6], [7, 7]],
    CRUZ: [[0, 0], [0, 1], [1, 0], [1, 1], [0, 6], [0, 7], [1, 6], [1, 7], [6, 0], [6, 1], [7, 0], [7, 1], [6, 6], [6, 7], [7, 6], [7, 7]],
    HUECO: [[3, 3], [3, 4], [4, 3], [4, 4]],
    COPA: [[6, 0], [6, 7], [7, 0], [7, 1], [7, 6], [7, 7]],
  }[name];
  voids.forEach(([r, c]) => { g[r][c] = '#'; });
  return g;
}
// put(g, ch, 'r3-4', 'c2-5')
function rng2(s) { const m = /^[rc](\d)(?:-(\d))?$/.exec(s); const a = +m[1], b = m[2] !== undefined ? +m[2] : a; const o = []; for (let i = a; i <= b; i++) o.push(i); return o; }
function put(g, ch, rs, cs) { rng2(rs).forEach((r) => rng2(cs).forEach((c) => { g[r][c] = ch; })); }
function L(g) { return g.map((row) => row.join('')); }
const V = (who, act, every, count, src) => ({ who, act, every, count: count || 1, src: src || 'hud' });
const col = (color, n) => ({ type: 'color', color, n });

function designLevels() {
  const lv = [];
  const add = (id, shp, colors, moves, goals, edit, extra) => { const g = shape(shp); if (edit) edit(g); lv.push(Object.assign({ id, chapter: Math.ceil(id / 5), name: 'N' + id, layout: L(g), colors, moves, goals, villains: [] }, extra || {})); };
  add(1, 'R7', 'LFBU', 20, [col('L', 12)]);
  add(2, 'R7', 'LFBU', 20, [col('F', 15), col('B', 15)], null, { ensure: 'ph' });
  add(3, 'R7', 'LFBUN', 20, [col('U', 18)], null, { ensure: 'bomba' });
  add(4, 'R8', 'LFBUN', 22, [{ type: 'ice' }], (g) => put(g, '1', 'r3-4', 'c2-5'));
  add(5, 'R8', 'LFBUN', 22, [col('N', 20), { type: 'ice' }], (g) => { put(g, '1', 'r7', 'c0-7'); put(g, '1', 'r6', 'c0'); put(g, '1', 'r6', 'c7'); }, { ensure: 'copa' });
  add(6, 'R8', 'LFBUN', 22, [{ type: 'ice' }], (g) => { put(g, '1', 'r0', 'c0-7'); put(g, '2', 'r3-4', 'c2-4'); });
  add(7, 'OCT', 'LFBND', 22, [col('L', 18), col('F', 18), col('D', 18)]);
  add(8, 'R8', 'LFBUN', 24, [col('B', 25)], (g) => { put(g, 'e', 'r2', 'c1-6'); put(g, 'e', 'r5', 'c1-6'); });
  add(9, 'HUECO', 'LFBUN', 24, [col('U', 25), { type: 'ice' }], (g) => { put(g, '2', 'r2', 'c3-4'); put(g, '2', 'r5', 'c3-4'); put(g, '2', 'r3-4', 'c2'); put(g, '2', 'r3-4', 'c5'); }, { villains: [V('cocardo', 'frost', 5)] });
  add(10, 'R8', 'LFBUN', 26, [{ type: 'boss' }, { type: 'rescue' }], (g) => { put(g, 'C', 'r1-2', 'c3-4'); put(g, 'R', 'r6', 'c3'); }, { freezer: { who: 'cocardo', hp: 8 }, rescue: ['lima'], friendHP: 2, villains: [V('cocardo', 'frost', 4, 1, 'boss')], boss: true });
  add(11, 'R8', 'LFBUN', 22, [col('L', 25), col('N', 25)], null, { villains: [V('cocardo', 'frost', 5)] });
  add(12, 'OCT', 'LFBUND', 25, [{ type: 'ice' }], (g) => { put(g, '2', 'r2', 'c2-5'); put(g, '2', 'r5', 'c2-5'); put(g, '2', 'r3-4', 'c2'); put(g, '2', 'r3-4', 'c5'); put(g, '3', 'r3-4', 'c3-4'); });
  add(13, 'R8', 'LFBUN', 25, [{ type: 'rescue' }, { type: 'ice' }], (g) => { put(g, '1', 'r7', 'c0-2'); put(g, '1', 'r7', 'c4-7'); put(g, '1', 'r6', 'c2-4'); put(g, 'R', 'r7', 'c3'); }, { rescue: ['fresa'], friendHP: 2, villains: [V('cocardo', 'frost', 5)] });
  add(14, 'CRUZ', 'LFBND', 24, [col('D', 25), { type: 'ice' }], (g) => { put(g, '2', 'r3-4', 'c0-1'); put(g, '2', 'r3-4', 'c6-7'); put(g, 'e', 'r1', 'c2-5'); }, { villains: [V('cocardo', 'frost', 4)] });
  add(15, 'R8', 'LFBND', 26, [{ type: 'boss' }, { type: 'rescue' }], (g) => { put(g, 'C', 'r0-1', 'c3-4'); put(g, 'R', 'r5', 'c6'); put(g, '1', 'r7', 'c0-7'); }, { freezer: { who: 'cocardo', hp: 10 }, rescue: ['durazna'], friendHP: 3, villains: [V('cocardo', 'frost', 4, 1, 'boss')] });
  add(16, 'R8', 'LFBUN', 22, [{ type: 'crate', n: 12 }], (g) => put(g, 'K', 'r3-4', 'c1-6'));
  add(17, 'HUECO', 'LFBUND', 25, [{ type: 'crate', n: 10 }, col('B', 25)], (g) => { put(g, 'K', 'r2', 'c1-5'); put(g, 'K', 'r5', 'c2-6'); }, { villains: [V('cereza', 'crate', 5)] });
  add(18, 'OCT', 'LFBUN', 24, [{ type: 'ice' }, { type: 'crate', n: 8 }], (g) => { put(g, '1', 'r1', 'c1-6'); put(g, '2', 'r6', 'c2-5'); put(g, '2', 'r7', 'c2-5'); put(g, 'K', 'r3-4', 'c0'); put(g, 'K', 'r3-4', 'c3-4'); put(g, 'K', 'r3-4', 'c7'); }, { villains: [V('cereza', 'crate', 5)] });
  add(19, 'R8', 'LFBUND', 26, [{ type: 'rescue' }, { type: 'crate', n: 8 }], (g) => { put(g, 'R', 'r4', 'c3'); put(g, 'K', 'r3', 'c3'); put(g, 'K', 'r5', 'c3'); put(g, 'K', 'r4', 'c2'); put(g, 'K', 'r4', 'c4'); put(g, 'K', 'r0', 'c0-1'); put(g, 'K', 'r0', 'c6-7'); }, { rescue: ['naranja'], friendHP: 3, villains: [V('cocardo', 'frost', 5)] });
  add(20, 'R8', 'LFBUND', 28, [{ type: 'boss' }, { type: 'crate', n: 10 }], (g) => { put(g, 'C', 'r3-4', 'c3-4'); put(g, 'K', 'r0', 'c1-6'); put(g, 'K', 'r7', 'c0-1'); put(g, 'K', 'r7', 'c6-7'); }, { freezer: { who: 'cocardo', hp: 12 }, villains: [V('cocardo', 'frost', 4, 1, 'boss'), V('cereza', 'crate', 6)] });
  add(21, 'R8', 'LFBUN', 22, [{ type: 'token' }, col('N', 20)], (g) => put(g, 'T', 'r0', 'c3'), { tokens: { skin: 'uva', total: 1, onBoard: 1 }, villains: [V('cereza', 'crate', 5)] });
  add(22, 'CRUZ', 'LFBUND', 24, [{ type: 'token' }, { type: 'crate', n: 8 }], (g) => { put(g, 'T', 'r0', 'c3'); put(g, 'K', 'r4-5', 'c0-1'); put(g, 'K', 'r4-5', 'c6-7'); }, { tokens: { skin: 'prueba', total: 3, onBoard: 1 }, villains: [V('cereza', 'crate', 5)] });
  add(23, 'R8', 'LFBUND', 25, [{ type: 'ice' }], (g) => { put(g, '2', 'r2', 'c0-7'); put(g, '1', 'r5', 'c0-7'); put(g, '3', 'r7', 'c3-4'); }, { villains: [V('cereza', 'crate', 4)] });
  add(24, 'HUECO', 'LFBUND', 25, [{ type: 'token' }, { type: 'crate', n: 10 }], (g) => { put(g, 'T', 'r0', 'c1'); put(g, 'T', 'r0', 'c6'); put(g, 'K', 'r2', 'c2-5'); put(g, 'K', 'r5', 'c2-5'); put(g, 'K', 'r3', 'c0'); put(g, 'K', 'r4', 'c7'); }, { tokens: { skin: 'prueba', total: 4, onBoard: 2 }, villains: [V('cereza', 'crate', 4)] });
  add(25, 'R8', 'LFBUND', 28, [{ type: 'boss' }, { type: 'token' }], (g) => { put(g, 'C', 'r1-2', 'c3-4'); put(g, 'T', 'r0', 'c0'); put(g, 'T', 'r0', 'c7'); }, { freezer: { who: 'cereza', hp: 14 }, tokens: { skin: 'prueba', total: 2, onBoard: 2 }, villains: [V('cereza', 'frost', 3, 1, 'boss')] });
  add(26, 'OCT', 'LFBUND', 25, [{ type: 'ice' }, { type: 'token' }], (g) => { put(g, '2', 'r2-3', 'c1-6'); put(g, '1', 'r6', 'c2-5'); put(g, 'T', 'r0', 'c3'); }, { tokens: { skin: 'prueba', total: 3, onBoard: 1 }, villains: [V('cereza', 'crate', 4)] });
  add(27, 'R8', 'LFBUND', 26, [col('U', 30), { type: 'crate', n: 12 }], (g) => { put(g, 'K', 'r3-4', 'c1-6'); put(g, 'e', 'r6', 'c0-7'); }, { villains: [V('cereza', 'crate', 4)] });
  add(28, 'CRUZ', 'LFBUND', 26, [{ type: 'ice' }, { type: 'token' }], (g) => { put(g, '1', 'r2', 'c2-5'); put(g, '1', 'r5', 'c2-5'); put(g, '1', 'r3-4', 'c2'); put(g, '1', 'r3-4', 'c5'); put(g, '3', 'r3-4', 'c3-4'); put(g, 'T', 'r0', 'c2'); }, { tokens: { skin: 'prueba', total: 3, onBoard: 1 }, villains: [V('cereza', 'frost', 4)] });
  add(29, 'R8', 'LFBUND', 27, [{ type: 'crate', n: 14 }, { type: 'ice' }], (g) => { put(g, 'K', 'r0', 'c0-7'); put(g, 'K', 'r7', 'c1-6'); put(g, '2', 'r3-4', 'c1-6'); }, { villains: [V('cereza', 'crate', 3)] });
  add(30, 'COPA', 'LFBUND', 30, [{ type: 'boss' }, { type: 'rescue' }], (g) => { put(g, 'C', 'r0-1', 'c3-4'); put(g, 'R', 'r5', 'c1'); put(g, 'R', 'r5', 'c6'); put(g, '1', 'r3', 'c0-2'); put(g, '1', 'r3', 'c5-7'); }, { freezer: { who: 'cereza', hp: 16 }, rescue: ['uva', 'banana'], friendHP: 3, villains: [V('cereza', 'frost', 4, 2, 'boss')] });
  return lv;
}
// Variante fácil para alcanzar victorias (y Helado Final) con juego aleatorio, y villanos agresivos.
function easyVariant(l) {
  const e = clone(l);
  e.goals = l.goals.map((g) => (g.type === 'color' ? { ...g, n: 5 } : g.type === 'crate' ? { ...g, n: 3 } : g));
  if (e.freezer) e.freezer.hp = 2;
  if (e.friendHP) e.friendHP = 1;
  e.villains = (e.villains || []).map((v) => ({ ...v, every: 2, count: 2 }));
  // en niveles de hielo puro, el hielo se vuelve de 1 HP y escaso
  e.layout = e.layout.map((row, r) => row.replace(/[23]/g, '1').split('').map((ch, c) => (ch === '1' && (r + c) % 2 ? '.' : ch)).join(''));
  e.moves = l.moves + 6;
  return e;
}
// Variantes sintéticas extremas (formas con vacío + todo junto).
function extremeLevels() {
  const out = [];
  const mk = (id, shp, edit, extra) => { const g = shape(shp); edit(g); out.push(Object.assign({ id, chapter: 6, name: 'X' + id, layout: L(g), colors: 'LFBUN', moves: 30, villains: [] }, extra)); };
  // HUECO con fichas uva que deben atravesar el hueco, escarcha y villanos de ambos tipos cada turno
  mk(21, 'HUECO', (g) => { put(g, 'T', 'r0', 'c3'); put(g, 'T', 'r0', 'c4'); put(g, 'e', 'r6', 'c2-5'); put(g, '1', 'r7', 'c0'); put(g, 'K', 'r7', 'c7'); },
    { goals: [{ type: 'token' }, { type: 'crate', n: 4 }], tokens: { skin: 'uva', total: 6, onBoard: 2 }, villains: [V('cereza', 'crate', 1, 2), V('cocardo', 'frost', 1, 3)] });
  // COPA con congelador 2x2, amigos, hielo 1-3, fichas prueba y villano jefe que escarcha 3
  mk(30, 'COPA', (g) => { put(g, 'C', 'r2-3', 'c3-4'); put(g, 'R', 'r5', 'c1'); put(g, 'R', 'r5', 'c6'); put(g, '3', 'r1', 'c0'); put(g, '2', 'r1', 'c7'); put(g, '1', 'r4', 'c0-1'); put(g, 'T', 'r0', 'c2'); put(g, 'e', 'r6', 'c3-4'); },
    { goals: [{ type: 'boss' }, { type: 'rescue' }, { type: 'token' }], freezer: { who: 'cereza', hp: 3 }, rescue: ['uva', 'banana'], friendHP: 1, tokens: { skin: 'prueba', total: 3, onBoard: 1 }, villains: [V('cereza', 'frost', 2, 3, 'boss'), V('cocardo', 'crate', 3, 1, 'hud')] });
  // OCT 6 colores con hielo y cajas; villano de escarcha cada turno (muchos barajados)
  mk(12, 'OCT', (g) => { put(g, '3', 'r3-4', 'c3-4'); put(g, 'K', 'r2', 'c2-5'); put(g, 'e', 'r5', 'c1-6'); },
    { colors: 'LFBUND', goals: [{ type: 'ice' }, { type: 'crate', n: 4 }], villains: [V('cocardo', 'frost', 1, 4)] });
  // CRUZ con muchísima escarcha y 4 colores (fuerza barajados y la ruta de romper escarcha)
  mk(14, 'CRUZ', (g) => { put(g, 'e', 'r2-5', 'c0-7'); put(g, 'e', 'r0-1', 'c2-5'); },
    { colors: 'LFBU', goals: [col('L', 15)], villains: [V('cocardo', 'frost', 1, 4)] });
  return out;
}

const DESIGN = designLevels();
const EXTREME = extremeLevels();

// ======================================================================= juego aleatorio
function playGame(level, seed, tag) {
  let s = Engine.createGame(level, seed);
  const where0 = `[${tag} nivel ${level.id} seed ${JSON.stringify(seed)}]`;
  checkInitial(level, s, where0 + ' createGame');
  const again = Engine.createGame(level, seed);
  assert.deepStrictEqual(again, s, where0 + ' createGame no determinista');
  const rand = mkRand('juego:' + tag + ':' + level.id + ':' + seed);
  let turn = 0, boosters = 0;
  while (s.status === 'playing' && turn < 300) {
    const x = rand();
    let call;
    if (x < 0.09 && boosters < 12) {
      boosters++;
      const types = ['cucharon', 'chorro', 'batido', 'cucharon', 'chorro', 'martillo'];
      const t = types[Math.floor(rand() * types.length)];
      const cell = rand() < 0.05 ? null : P(Math.floor(rand() * (s.rows + 2)) - 1, Math.floor(rand() * (s.cols + 2)) - 1);
      call = { kind: 'booster', type: t, cell };
    } else if (x < 0.15) {
      const a = P(Math.floor(rand() * s.rows), Math.floor(rand() * s.cols));
      const d = [[0, 1], [1, 0], [0, -1], [-1, 0], [0, 2]][Math.floor(rand() * 5)];
      call = { kind: 'swap', a, b: P(a.r + d[0], a.c + d[1]) };
    } else {
      const mv = Engine.validMoves(clone(s));
      let m = x < 0.3 ? Engine.hint(deepFreeze(s)) : mv[Math.floor(rand() * mv.length)];
      if (!m) m = mv[0];
      call = rand() < 0.5 ? { kind: 'swap', a: m.a, b: m.b } : { kind: 'swap', a: m.b, b: m.a };
    }
    const where = `${where0} turno ${turn} ${JSON.stringify(call)}`;
    if (turn % 3 === 0) {
      const all = allSwaps(s.grid), h = Engine.hint(s);
      if (!all.length) assert.equal(h, null, `${where}: pista sin jugadas`);
      else {
        assert.ok(h && all.some((m) => moveKey(m) === moveKey(h)), `${where}: la pista no es una jugada válida`);
        const best = Math.max(...all.map((m) => moveTier(s.grid, m)));
        assert.equal(moveTier(s.grid, h), best, `${where}: la pista eligió nivel ${moveTier(s.grid, h)} habiendo uno de nivel ${best}`);
      }
    }
    const res = run(s, call, where);
    if (call.kind === 'swap') {
      assert.equal(Engine.canSwap(s, call.a, call.b), swapOk(s.grid, call.a, call.b), `${where}: canSwap no coincide con las reglas`);
    }
    if (res) s = res.state;
    turn++;
  }
  assert.notEqual(s.status, 'playing', `${where0}: la partida no terminó`);
  if (s.status === 'won') {
    assert.ok(Engine.starsFor(s) >= 1);
    const hf = run(s, { kind: 'helado' }, `${where0} Helado Final`);
    assert.equal(Engine.starsFor(hf.state), Engine.starsFor(s), `${where0}: Helado Final cambió las estrellas`);
    const ml = s.movesLeft, tot = s.movesTotal;
    assert.equal(Engine.starsFor(s), 1 + (ml >= 0.15 * tot ? 1 : 0) + (ml >= 0.30 * tot ? 1 : 0), `${where0}: estrellas`);
    // tras ganar ya no se aceptan jugadas ni potenciadores
    const mv = allSwaps(s.grid)[0];
    if (mv) assert.equal(Engine.applySwap(s, mv.a, mv.b).turnInfo.valid, false);
    assert.equal(Engine.useBooster(s, 'batido', null), null);
  } else {
    assert.equal(Engine.starsFor(s), 0);
    assert.equal(s.movesLeft, 0);
    const hf = run(s, { kind: 'helado' }, `${where0} Helado Final tras perder`);
    assert.equal(hf.steps.length, 0);
  }
  return s.status;
}

const STATS = { games: 0, won: 0, lost: 0 };
function fuzzLevel(level, tag, seeds) {
  for (const seed of seeds) {
    const st = playGame(level, seed, tag);
    STATS.games++; STATS[st]++;
  }
}

// Una prueba por nivel/variante para que cada falla tenga un nombre reproducible.
for (const l of DESIGN) {
  test(`fuzz DISENO L${String(l.id).padStart(2, '0')} normal (seeds 0-4)`, () => fuzzLevel(l, 'normal', [0, 1, 2, 3, 4]));
  test(`fuzz DISENO L${String(l.id).padStart(2, '0')} fácil+villanos agresivos (seeds 0-4)`, () => fuzzLevel(easyVariant(l), 'facil', [0, 1, 2, 3, 4]));
}
for (const l of EXTREME) {
  test(`fuzz extremo ${l.name} (forma con vacíos, seeds 0-9)`, () => fuzzLevel(l, 'extremo', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
}
const LEVELS_FILE = path.join(__dirname, '..', 'js', 'core', 'levels.js');
test('fuzz js/core/levels.js (todos los niveles reales, seeds 0-2; si el archivo existe)', () => {
  if (!fs.existsSync(LEVELS_FILE)) { assert.ok(DESIGN.length === 30); return; }
  const Levels = require(LEVELS_FILE);
  assert.ok(Levels && Array.isArray(Levels.list) && Levels.list.length >= 30 && Levels.list.length % 5 === 0, 'Levels.list: al menos los 30 de la temporada 1, en capítulos de 5');
  for (const l of Levels.list) fuzzLevel(l, 'levels.js', [0, 1, 2]);
});
test('fuzz: cobertura (≥300 partidas, victorias, derrotas, todos los eventos)', () => {
  assert.ok(STATS.games >= 300, 'partidas: ' + STATS.games);
  assert.ok(STATS.won > 10, 'victorias: ' + STATS.won);
  assert.ok(STATS.lost > 10, 'derrotas: ' + STATS.lost);
  for (const t of ['swap', 'invalid', 'cascade', 'clear', 'unfrost', 'damage', 'destroy', 'rescue', 'freezerDown', 'activate', 'combo', 'create', 'transform', 'fall', 'spawn', 'collect', 'villain', 'shuffle', 'points', 'goal', 'win', 'lose', 'booster', 'create:ph', 'create:pv', 'create:bomba', 'create:copa']) {
    assert.ok(SEEN[t], 'nunca apareció ' + t);
  }
});

// ======================================================================= casos a mano
test('createGame: cada nivel de DISENO §7 (y de levels.js si existe) con 6 semillas', () => {
  const list = DESIGN.concat(EXTREME);
  if (fs.existsSync(LEVELS_FILE)) list.push(...require(LEVELS_FILE).list);
  for (const l of list) for (const seed of [0, 1, 7, 'x', 20261014, 999]) {
    const s = Engine.createGame(l, seed);
    checkInitial(l, s, `createGame nivel ${l.id} seed ${seed}`);
    assert.deepStrictEqual(Engine.createGame(l, seed), s);
  }
});

// Tablero de combos 7×7: ficha, hielo, caja, escarcha, congelador y piezas de los colores en juego.
function comboBoard(x, y) {
  return board([
    'D . . D* . . .',
    '. L . I2 . T .',
    '. . . . L* . D',
    `. . . ${x} ${y} . .`,
    'L . . . . . K',
    '. . Z Z . D .',
    'D . Z Z . L .',
  ], { colors: 'LFBUND', freezer: { hp: 5 }, goals: [{ type: 'boss' }, col('L', 30), col('D', 30)] });
}
test('combos: cada par ordenado de especiales (ph, pv, bomba, Copa) con área, ondas y daño verificados', () => {
  const XS = ['Lh', 'Lv', 'Lb', '@'], YS = ['Dh', 'Dv', 'Db', '@'];
  for (const x of XS) for (const y of YS) {
    for (const [a, b] of [[P(3, 3), P(3, 4)], [P(3, 4), P(3, 3)]]) {
      const s = comboBoard(x, y);
      const res = run(s, { kind: 'swap', a, b }, `combo ${x}+${y} ${a.c}->${b.c}`);
      assert.equal(res.turnInfo.combo, true, `combo ${x}+${y}`);
      const cmb = res.steps[1].events.find((e) => e.t === 'combo');
      assert.ok(cmb, `combo ${x}+${y}: falta evento combo`);
    }
  }
});

test('Copa + normal: quita la Copa y todo ese color; la escarcha se rompe; los especiales del color disparan', () => {
  const s = board([
    '. L . . . . .',
    '. . . L* . . .',
    '. . . @ D . .',
    '. Lv . . . . .',
    '. . . . . L .',
  ], { colors: 'LFBUND' });
  // Copa con D (a la derecha) y con L (no hay L al lado: se mueve la Copa hacia una L no existe) -> D
  const res = run(s, { kind: 'swap', a: P(2, 3), b: P(2, 4) }, 'Copa+D');
  const act = res.steps[1].events.find((e) => e.t === 'activate');
  assert.equal(act.type, 'copa');
  assert.equal(act.color, 'D');
  const s2 = board([
    '. L . . . . .',
    '. . . L* . . .',
    '. . L @ . . .',
    '. Lv . . . . .',
    '. . . . . L .',
  ], { colors: 'LFBUND', goals: [col('L', 10)] });
  const r2 = run(s2, { kind: 'swap', a: P(2, 3), b: P(2, 2) }, 'Copa+L');
  const a2 = r2.steps[1].events.find((e) => e.t === 'activate');
  assert.equal(a2.color, 'L');
  assert.ok(r2.steps[1].events.some((e) => e.t === 'unfrost' && e.r === 1 && e.c === 3), 'la L escarchada pierde la escarcha');
  assert.equal(r2.steps[2].kind, 'activate', 'la Paleta L dispara en la ola siguiente');
  assert.equal(r2.steps[2].events[0].type, 'pv');
});

test('olas en cadena: ph -> pv -> bomba -> Copa golpeada por la bomba (color más común)', () => {
  const s = board([
    '. . . . . . .',
    '. . . . . . .',
    'Lh . . . . Dv .',
    '. . . . . . .',
    '. . . . . . .',
    '. . . . . Db .',
    '. . . . . . @',
  ], { colors: 'LFBUND' });
  const res = run(s, { kind: 'booster', type: 'cucharon', cell: P(2, 0) }, 'olas');
  const acts = res.steps.filter((x) => x.kind === 'activate').map((x) => x.events.filter((e) => e.t === 'activate').map((e) => e.type));
  assert.deepEqual(acts.slice(0, 4), [['ph'], ['pv'], ['bomba'], ['copa']]);
  assert.equal(res.steps[0].kind, 'booster');
  assert.deepEqual(res.steps[0].events.map((e) => e.t), ['booster']);
});

test('Copa golpeada por un rayo: empate de color más común -> el de menor índice', () => {
  // tras el rayo de la fila 0 quedan 4 F y 4 B normales (+1 U): F (idx 1) gana a B (idx 2)
  const s = Engine.fromRows([
    'Lh @ L L N',
    'B F U B F',
    'F B # F B',
  ], { colors: 'LFBUN' });
  assert.equal(groupsOf(s.grid).length, 0);
  const res = run(s, { kind: 'booster', type: 'cucharon', cell: P(0, 0) }, 'copa empate');
  const cop = res.steps.flatMap((x) => x.events).find((e) => e.t === 'activate' && e.type === 'copa');
  assert.equal(cop.color, 'F');
});

test('5 en línea que además forma una L -> Copa (no Bomba) en la celda intercambiada', () => {
  const s = board([
    '. . . . . . .',
    '. . L . . . .',
    '. . L . . . .',
    'L L D L L . .',
    '. . L . . . .',
    '. . . . . . .',
    '. . . . . . .',
  ], { colors: 'LFBUND', goals: [col('L', 30)] });
  const res = run(s, { kind: 'swap', a: P(4, 2), b: P(3, 2) }, '5+L');
  const cr = res.steps.filter((x) => x.kind === 'create' && x.cascade === 1).flatMap((x) => x.events).filter((e) => e.t === 'create');
  assert.equal(cr.length, 1);
  assert.deepEqual([cr[0].type, cr[0].r, cr[0].c, cr[0].color], ['copa', 3, 2, null]);
  assert.equal(res.steps[1].events.filter((e) => e.t === 'clear').length, 7);
  assert.equal(res.state.goals[0].remaining, 23);
});

test('dos grupos simultáneos de un intercambio: dos pv, cada uno en su celda intercambiada', () => {
  const s = board([
    '. . . . . . .',
    '. . . L D . .',
    '. . . L D . .',
    '. . . D L . .',
    '. . . L D . .',
    '. . . . . . .',
    '. . . . . . .',
  ], { colors: 'LFBUND' });
  const res = run(s, { kind: 'swap', a: P(3, 3), b: P(3, 4) }, 'dos grupos');
  const clr = res.steps[1];
  assert.equal(clr.kind, 'clear');
  assert.equal(clr.events.filter((e) => e.t === 'clear').length, 8);
  const cr = res.steps.find((x) => x.kind === 'create').events.filter((e) => e.t === 'create');
  assert.deepEqual(cr.map((e) => [e.type, e.r, e.c, e.color]).sort(), [['pv', 3, 3, 'L'], ['pv', 3, 4, 'D']]);
  // y 3+3 horizontal: un paso clear con 6 clears y sin especiales
  const s2 = board(['. . . . . . .', '. . . . . . .', 'D D L D L L .', '. . . . . . .'], { colors: 'LFBUND' });
  const r2 = run(s2, { kind: 'swap', a: P(2, 2), b: P(2, 3) }, 'dos grupos 3+3');
  assert.equal(r2.steps[1].events.filter((e) => e.t === 'clear').length, 6);
  assert.ok(!r2.steps.some((x) => x.kind === 'create' && x.cascade === 1));
});

test('especiales en cascadas: lugar (c) desde ⌊len/2⌋ saltando escarcha, (d) resto del grupo, y sin candidato no hay especial', () => {
  // (c): fila 5 con 4 L preexistentes, la del medio (índice 2) escarchada -> no nace ahí
  let s = board([
    '. . . . . . .',
    '. . . . . . .',
    '. . . . . . .',
    '. . . . . . .',
    '. . . . . . .',
    'L L L* L . . .',
    '. . . . . . .',
  ], { colors: 'LFBUND' }, true);
  let res = run(s, { kind: 'booster', type: 'cucharon', cell: P(0, 6) }, 'lugar c');
  let cr = res.steps.filter((x) => x.kind === 'create').flatMap((x) => x.events).filter((e) => e.t === 'create');
  assert.ok(cr.length >= 1);
  assert.equal(cr[0].type, 'ph');
  assert.equal(cr[0].r, 5);
  assert.notEqual(cr[0].c, 2, 'no debe nacer sobre la pieza escarchada');
  // (d): L con cruce y corrida horizontal escarchados -> Bomba en (0,0)
  s = board([
    'L . . . . . .',
    'L* . . . . . .',
    'L* L* L* . . . .',
    '. . . . . . .',
    '. . . . . . .',
  ], { colors: 'LFBUND' }, true);
  res = run(s, { kind: 'booster', type: 'cucharon', cell: P(4, 6) }, 'lugar d');
  cr = res.steps.filter((x) => x.kind === 'create').flatMap((x) => x.events).filter((e) => e.t === 'create');
  assert.deepEqual([cr[0].type, cr[0].r, cr[0].c], ['bomba', 0, 0]);
  // sin candidato: toda la corrida escarchada
  s = board(['. . . . . .', 'L* L* L* L* . .', '. . . . . .', '. . . . . .'], { colors: 'LFBUND' }, true);
  res = run(s, { kind: 'booster', type: 'cucharon', cell: P(3, 5) }, 'sin candidato');
  assert.ok(!res.steps.some((x) => x.kind === 'create' && x.cascade === 2));
  assert.equal(res.steps.flatMap((x) => x.events).filter((e) => e.t === 'unfrost').length, 4);
});

test('congelador: 1 daño por grupo aunque toque varias celdas; 2 grupos = 2; un rayo por 2 celdas = 1', () => {
  // un grupo bajo el congelador (toca 2 celdas) + hielo adyacente a 2 celdas del grupo
  let s = board([
    '. . . . . . .',
    '. . Z Z . . .',
    '. . Z Z . . .',
    '. L D L I2 . .',
    '. . L . . . .',
    '. . . . . . .',
  ], { colors: 'LFBUND', freezer: { hp: 8 }, goals: [{ type: 'boss' }] });
  // hacemos L L L en fila 3: c1..c3 (la L sube de (4,2)); toca (2,2) y (2,3) del congelador
  let res = run(s, { kind: 'swap', a: P(4, 2), b: P(3, 2) }, 'congelador 1 grupo');
  let d = res.steps[1].events.filter((e) => e.t === 'damage');
  assert.deepEqual(d.map((e) => [e.kind, e.hp]).sort(), [['freezer', 7], ['ice', 1]]);
  // dos grupos preexistentes tocando el congelador -> 2 daños en el mismo paso clear
  s = board([
    '. . . . D . .',
    '. . Z Z D . .',
    '. . Z Z D . .',
    '. L L L . . .',
    '. . . . . . .',
    '. . . . . . .',
  ], { colors: 'LFBUND', freezer: { hp: 8 }, goals: [{ type: 'boss' }] }, true);
  res = run(s, { kind: 'booster', type: 'cucharon', cell: P(5, 6) }, 'congelador 2 grupos');
  const clr = res.steps.find((x) => x.kind === 'clear');
  assert.equal(clr.events.filter((e) => e.t === 'damage' && e.kind === 'freezer').length, 2);
  // Chorro por la fila 1 cruza 2 celdas del congelador -> 1 daño
  s = board(['. . . . . . .', '. . Z Z . . .', '. . Z Z . . .', '. . . . . . .'], { colors: 'LFBUND', freezer: { hp: 8 }, goals: [{ type: 'boss' }] });
  res = run(s, { kind: 'booster', type: 'chorro', cell: P(1, 0) }, 'chorro congelador');
  assert.equal(res.state.freezer.hp, 7);
  // Bomba+Bomba encima del congelador -> 1 daño
  s = board(['. . . . . . .', '. . Z Z . . .', '. . Z Z . . .', '. . Lb Db . . .', '. . . . . . .'], { colors: 'LFBUND', freezer: { hp: 8 }, goals: [{ type: 'boss' }] });
  res = run(s, { kind: 'swap', a: P(3, 2), b: P(3, 3) }, 'bomba+bomba congelador');
  assert.equal(res.steps[1].events.filter((e) => e.t === 'damage' && e.kind === 'freezer').length, 1);
});

test('pieza escarchada dentro de un match: pierde la escarcha, se queda y no cuenta para la meta', () => {
  const s = board([
    '. . . . . . .',
    '. . . . . . .',
    'L* L D . . . .',
    '. . L . . . .',
    '. . . . . . .',
  ], { colors: 'LFBUND', goals: [col('L', 10)] });
  const fid = s.grid[2][0].p.id;
  const res = run(s, { kind: 'swap', a: P(3, 2), b: P(2, 2) }, 'escarcha en match');
  assert.ok(res.steps[1].events.some((e) => e.t === 'unfrost' && e.id === fid));
  assert.equal(res.steps[1].goals[0], 8);
  assert.equal(res.state.grid[2][0].p.id, fid);
  assert.equal(res.state.grid[2][0].p.frost, false);
});

test('fichas: se recolectan en el slot más bajo sobre hielo, sobre vacío y atravesando un hueco', () => {
  const s = board([
    '. . . . .',
    '. . T . .',
    '. . # . .',
    'T T # . .',
    '. . # . .',
    'I1 # . . .',
  ], { colors: 'LFBUND', tokens: { skin: 'uva', total: 3, onBoard: 3 }, goals: [{ type: 'token' }] });
  // columna 0: la ficha (3,0) cae a (4,0) (sobre hielo)
  let res = run(s, { kind: 'booster', type: 'cucharon', cell: P(4, 0) }, 'ficha sobre hielo');
  let c = res.steps.flatMap((x) => x.events).filter((e) => e.t === 'collect');
  assert.deepEqual(c.map((e) => [e.r, e.c, e.skin]), [[4, 0, 'uva']]);
  // columna 1: el slot más bajo es (4,1) (debajo hay vacío)
  res = run(s, { kind: 'booster', type: 'cucharon', cell: P(4, 1) }, 'ficha sobre vacío');
  c = res.steps.flatMap((x) => x.events).filter((e) => e.t === 'collect');
  assert.deepEqual(c.map((e) => [e.r, e.c]), [[4, 1]]);
  // columna 2: (0,2) normal y (1,2) ficha; vacíos r2-4; (5,2) normal -> la ficha cae a (5,2)
  res = run(s, { kind: 'booster', type: 'cucharon', cell: P(5, 2) }, 'ficha cruza hueco');
  c = res.steps.flatMap((x) => x.events).filter((e) => e.t === 'collect');
  assert.deepEqual(c.map((e) => [e.r, e.c]), [[5, 2]]);
  assert.ok(res.steps.flatMap((x) => x.events).some((e) => e.t === 'fall' && e.from.r === 1 && e.to.r === 5 && e.to.c === 2));
  // las fichas ignoran Chorro y Copa+Copa
  res = run(s, { kind: 'booster', type: 'chorro', cell: P(3, 3) }, 'chorro sobre fichas');
  assert.equal(res.steps.flatMap((x) => x.events).filter((e) => e.t === 'clear' && e.type === 'token').length, 0);
});

test('fichas: nacen en el hueco superior de una columna al azar y respetan onBoard/total', () => {
  const s = board([
    '. . . .',
    '. . . .',
    '. . . .',
    'Tp . L .',
    'L L D .',
  ], { colors: 'LFBUND', tokens: { skin: 'prueba', total: 3, onBoard: 1 }, goals: [{ type: 'token' }] });
  const res = run(s, { kind: 'swap', a: P(4, 2), b: P(3, 2) }, 'aparición de ficha');
  assert.ok(res.steps.flatMap((x) => x.events).some((e) => e.t === 'collect'));
});

test('Helado Final: un paso transform (+300, -1 mov) por movimiento; Paleta aleatoria que dispara; sin piezas normales los pasos van vacíos', () => {
  const s = board([
    '. . . . . . .',
    '. . . . . . .',
    'L L D . . . .',
    '. . L . . . .',
    '. . . . . . .',
  ], { colors: 'LFBUND', goals: [col('L', 3)], moves: 10 });
  const w = run(s, { kind: 'swap', a: P(3, 2), b: P(2, 2) }, 'gana');
  assert.equal(w.state.status, 'won');
  assert.equal(w.state.movesLeft, 9);
  assert.equal(Engine.starsFor(w.state), 3);
  const hf = run(w.state, { kind: 'helado' }, 'Helado Final');
  assert.equal(hf.steps.filter((x) => x.kind === 'transform').length, 9);
  assert.equal(hf.state.movesLeft, 0);
  assert.equal(Engine.starsFor(hf.state), 3);
  // sin piezas normales
  const e = clone(Engine.fromRows(['K K K', 'K T K', 'K K K'], { goals: [{ type: 'crate', n: 1 }] }));
  e.status = 'won'; e.wonMovesLeft = 2; e.movesLeft = 2;
  const he = Engine.heladoFinal(deepFreeze(e));
  assert.deepEqual(he.steps.map((x) => [x.kind, x.events.length, x.movesLeft]), [['transform', 0, 1], ['transform', 0, 0]]);
  assert.equal(he.state.score, e.score + 600);
  // fuera de victoria no hace nada
  assert.deepEqual(Engine.heladoFinal(deepFreeze(clone(s))).steps, []);
});

test('potenciadores sobre cada tipo de celda (normal, escarcha, ph, pv, bomba, Copa, ficha, hielo, caja, amigo, congelador, vacío, fuera)', () => {
  const mk = () => board([
    'L L* Dh Dv . .',
    'Db @ T I2 K R2',
    '. . Z Z # .',
    'D . Z Z . .',
    '. . . . . L',
  ], { colors: 'LFBUND', freezer: { hp: 4 }, rescue: ['fresa'], tokens: { skin: 'uva', total: 1, onBoard: 1 }, villains: [V('cocardo', 'frost', 1, 1)], goals: [{ type: 'boss' }, { type: 'rescue' }, col('L', 20)] });
  const s = mk();
  const cells = [];
  for (let r = -1; r <= s.rows; r++) for (let c = -1; c <= s.cols; c++) cells.push(P(r, c));
  for (const type of ['cucharon', 'chorro']) {
    for (const cell of cells) {
      run(mk(), { kind: 'booster', type, cell }, `${type}@${cell.r},${cell.c}`);
    }
  }
  run(mk(), { kind: 'booster', type: 'batido', cell: null }, 'batido');
  run(mk(), { kind: 'booster', type: 'batido', cell: P(99, 99) }, 'batido con celda');
  run(mk(), { kind: 'booster', type: 'martillo', cell: P(0, 0) }, 'tipo desconocido');
  run(mk(), { kind: 'booster', type: 'cucharon', cell: undefined }, 'cucharon sin celda');
  // detalles concretos
  let r = Engine.useBooster(mk(), 'cucharon', P(1, 3));
  assert.ok(r.steps[0].events.some((e) => e.t === 'damage' && e.kind === 'ice' && e.hp === 1));
  r = Engine.useBooster(mk(), 'cucharon', P(1, 4));
  assert.ok(r.steps[0].events.some((e) => e.t === 'destroy' && e.kind === 'crate'));
  r = Engine.useBooster(mk(), 'cucharon', P(2, 3));
  assert.equal(r.state.freezer.hp, 3);
  r = Engine.useBooster(mk(), 'cucharon', P(1, 1));
  assert.deepEqual(r.steps.slice(0, 2).map((x) => x.kind), ['booster', 'activate']);
  assert.equal(r.steps[1].events[0].type, 'copa');
  assert.equal(Engine.useBooster(mk(), 'cucharon', P(1, 2)), null, 'Cucharón sobre ficha');
  assert.equal(Engine.useBooster(mk(), 'cucharon', P(2, 4)), null, 'Cucharón sobre vacío');
  // en estado ganado/perdido no se aceptan
  const lost = clone(mk()); lost.status = 'lost';
  assert.equal(Engine.useBooster(lost, 'chorro', P(0, 0)), null);
});

test('fin de turno: victoria antes que villanos; con 0 movimientos el villano no actúa y se pierde', () => {
  const VV = [V('cocardo', 'frost', 1, 2), V('cereza', 'crate', 1, 1)];
  const lines = ['. . . . . . .', '. . . . . . .', 'L L D . . . .', '. . L . . . .', '. . . . . . .'];
  // gana en la última jugada: ni villano ni derrota
  let s = board(lines, { colors: 'LFBUND', goals: [col('L', 3)], villains: VV, movesLeft: 1 });
  let res = run(s, { kind: 'swap', a: P(3, 2), b: P(2, 2) }, 'gana último');
  assert.equal(res.state.status, 'won');
  // no completa con 1 movimiento: pierde sin villano
  s = board(lines, { colors: 'LFBUND', goals: [col('L', 30)], villains: VV, movesLeft: 1 });
  res = run(s, { kind: 'swap', a: P(3, 2), b: P(2, 2) }, 'pierde último');
  assert.equal(res.state.status, 'lost');
  // con 2 movimientos: sigue jugando y los dos villanos actúan
  s = board(lines, { colors: 'LFBUND', goals: [col('L', 30)], villains: VV, movesLeft: 2 });
  res = run(s, { kind: 'swap', a: P(3, 2), b: P(2, 2) }, 'villanos actúan');
  assert.equal(res.state.status, 'playing');
  assert.equal(res.steps.filter((x) => x.kind === 'villain').length, 1);
});

test('barajado: villanos que escarchan casi todo fuerzan barajados válidos (garantía de jugada)', () => {
  const l = { id: 22, layout: ['eeeeeee', 'eeeeeee', 'e.....e', 'e.....e', 'e.....e', 'eeeeeee'], colors: 'LFBU', moves: 25, goals: [col('L', 99)], villains: [V('cereza', 'frost', 1, 6)] };
  for (let seed = 0; seed < 15; seed++) playGame(l, seed, 'escarcha-total');
});

test('validMoves, hint, canSwap, isStable y findMatches funcionan sobre un estado congelado (no mutan la entrada)', () => {
  const s = deepFreeze(Engine.createGame(DESIGN[0], 3));
  const snap = JSON.stringify(s);
  assert.doesNotThrow(() => Engine.hint(s));
  assert.doesNotThrow(() => Engine.canSwap(s, P(0, 0), P(0, 1)));
  assert.doesNotThrow(() => Engine.isStable(s));
  assert.doesNotThrow(() => Engine.findMatches(s));
  assert.doesNotThrow(() => Engine.goalUnits(s));
  assert.doesNotThrow(() => Engine.starsFor(s));
  assert.doesNotThrow(() => Engine.validMoves(s), 'validMoves muta temporalmente state.grid (falla con Object.freeze)');
  assert.equal(JSON.stringify(s), snap);
});

test('applySwap con coordenadas malformadas devuelve invalid sin lanzar', () => {
  const s = deepFreeze(Engine.createGame(DESIGN[0], 3));
  for (const [a, b] of [[P(-1, 0), P(0, 0)], [P(0, 0), P(0, 0)], [null, P(0, 0)], [P(0, 0), P(2, 0)], [P(0.5, 0), P(1.5, 0)], [{ r: '0', c: '0' }, { r: '0', c: '1' }]]) {
    let res;
    assert.doesNotThrow(() => { res = Engine.applySwap(s, a, b); }, `applySwap(${JSON.stringify(a)}, ${JSON.stringify(b)}) lanzó`);
    assert.equal(res.turnInfo.valid, false, `applySwap(${JSON.stringify(a)}, ${JSON.stringify(b)}) aceptado`);
    assert.equal(res.state.movesLeft, s.movesLeft);
  }
});

test('determinismo: misma semilla e intercambios -> pasos y estados idénticos en 20 jugadas', () => {
  const play = () => {
    let s = Engine.createGame(DESIGN[24], 'det');
    const log = [];
    for (let i = 0; i < 20 && s.status === 'playing'; i++) {
      const m = Engine.validMoves(clone(s))[i % Engine.validMoves(clone(s)).length];
      const res = Engine.applySwap(s, m.a, m.b);
      log.push(res);
      s = res.state;
    }
    return log;
  };
  assert.deepStrictEqual(play(), play());
});
