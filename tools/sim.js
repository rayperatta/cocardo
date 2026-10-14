#!/usr/bin/env node
/* Cocardo: ¡Rescate Helado! — simulador de balance (DISENO §7 «Tuning»).

   Uso:  node tools/sim.js [ids de nivel...] [--seeds N] [opciones]
     --seeds N    semillas por nivel (40 por defecto)
     --sweep      además imprime la curva victoria%-vs-movimientos (15..40) y una sugerencia de movimientos
     --moves M    juega todos los niveles elegidos con M movimientos en vez de los de levels.js
     --hint       agrega como referencia el bot que solo juega Engine.hint()
     --peek       el bot ve el relleno real al mirar una jugada adelante (por defecto NO: un humano no lo ve)
     --md         tabla en Markdown
     --jobs N     hilos de trabajo (por defecto: núcleos de la CPU)

   Bots:
     bot    principal, consciente de las metas: prueba cada jugada válida con Engine.applySwap (sobre una copia
            con otra semilla de RNG, para no adivinar lo que cae) y puntúa el avance de las metas (unidades
            finas: piezas, PV de hielo/amigos/congelador, filas que bajó cada ficha), con más peso para la meta
            más atrasada, más bonos pequeños por especiales creados y cascadas.
     débil  el mismo bot, pero el 30% de las veces juega una jugada válida al azar.
     hint   (opcional) siempre la jugada de Engine.hint(): no mira las metas.

   Truco de rendimiento: la decisión del bot no depende de los movimientos restantes, así que la partida con
   M movimientos es un prefijo exacto de la partida con más movimientos. Cada semilla se juega una sola vez
   con un tope (--cap, 60 por defecto) y de ahí salen las estadísticas para cualquier M <= tope. */
'use strict';

const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const Engine = require('../js/core/engine.js');
const Levels = require('../js/core/levels.js');
const RNG = require('../js/core/rng.js');

const MIN_MOVES = 15;
const MAX_MOVES = 40;
const WEAK_RANDOM = 0.3;   // el bot débil juega al azar este porcentaje de las veces
const WEAK_MIN = 25;       // después del L5 el bot débil debería ganar al menos esto (%)

// ---------------------------------------------------------------- metas de balance (DISENO §7)
// lo-hi = banda de victorias del bot principal; aim = punto ideal para una curva suave hacia arriba.
function targetFor(lvl) {
  if (lvl.id <= 5) return { kind: lvl.boss ? 'BOSS' : 'intro', lo: 90, hi: 100, aim: lvl.boss ? 92 : 96 };
  if (lvl.boss || lvl.hard) {
    return { kind: lvl.final ? 'FINAL' : lvl.boss ? 'BOSS' : 'hard', lo: 35, hi: 60, aim: Math.round(58 - (lvl.id - 10) * 0.8) };
  }
  return { kind: 'normal', lo: 55, hi: 85, aim: 80 - (lvl.chapter - 2) * 4 };
}

// ---------------------------------------------------------------- bot
function isSlot(cell) { return !!cell && !cell.b && !(cell.p && cell.p.frost); }

function blockerHp(g, kind) {
  let n = 0;
  for (const row of g) for (const cell of row) if (cell && cell.b && cell.b.kind === kind) n += cell.b.hp;
  return n;
}

// Trabajo pendiente de las fichas: casillas libres que le faltan a cada ficha para llegar abajo, más las que
// todavía no salen (cuentan como una columna entera).
function tokenWork(s) {
  const g = s.grid;
  let w = 0;
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      const cell = g[r][c];
      if (!cell || !cell.p || cell.p.type !== 'token') continue;
      let d = 0;
      for (let r2 = r + 1; r2 < s.rows; r2++) if (isSlot(g[r2][c])) d++;
      w += d + 1;
    }
  }
  if (s.tokens) w += Math.max(0, s.tokens.total - s.tokens.spawned) * (s.rows + 1);
  return w;
}

// Trabajo pendiente por meta, en unidades finas (los bloqueos cuentan PV, no celdas).
function goalWork(s) {
  return s.goals.map((gl) => {
    if (gl.remaining <= 0) return 0;
    switch (gl.type) {
      case 'ice': return blockerHp(s.grid, 'ice');
      case 'rescue': return blockerHp(s.grid, 'friend');
      case 'boss': return s.freezer ? Math.max(0, s.freezer.hp) : 0;
      case 'token': return tokenWork(s);
      default: return gl.remaining;   // color, crate
    }
  });
}

const SPECIAL_BONUS = { ph: 4, pv: 4, bomba: 5, copa: 8 };

function goalAwareMove(s, moves, W0, peek) {
  const frac = (w) => w.map((x, i) => x / W0[i]);
  const before = frac(goalWork(s));
  const maxF = Math.max(0, ...before);
  // más peso para la meta más atrasada
  const weight = before.map((f) => (maxF > 0 ? 0.25 + f / maxF : 0));
  // La sonda no depende de los movimientos restantes (prefijo exacto) y, salvo --peek, usa otra semilla.
  const probe = Object.assign({}, s, { movesLeft: 999 });
  if (!peek) probe.rng = (s.rng ^ 0x9E3779B9) >>> 0;
  let best = moves[0], bestV = -Infinity;
  for (const m of moves) {
    const res = Engine.applySwap(probe, m.a, m.b);
    if (!res.turnInfo.valid) continue;
    let v;
    if (res.state.status === 'won') v = 1e6;
    else {
      const after = frac(goalWork(res.state));
      v = 0;
      for (let i = 0; i < after.length; i++) v += weight[i] * (before[i] - after[i]) * 100;
      for (const st of res.steps) for (const e of st.events) if (e.t === 'create') v += SPECIAL_BONUS[e.type] || 0;
      v += Math.max(0, res.turnInfo.cascades - 1) * 0.5;
      // desempates: más piezas y jugadas más abajo (más cascadas)
      v += res.turnInfo.cleared * 0.05 + (m.a.r + m.b.r) * 0.05;
    }
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}

// Juega una partida con `cap` movimientos. Devuelve los movimientos usados para ganar, o null si perdió.
function playGame(level, seed, policy, cap, peek) {
  let s = Engine.createGame(Object.assign({}, level, { moves: cap }), seed);
  const W0 = goalWork(s).map((x) => Math.max(1, x));
  let rs = RNG.seedFrom('bot:' + policy + ':' + seed);
  const rand = () => { const o = RNG.next(rs); rs = o.state; return o.value; };
  while (s.status === 'playing') {
    const moves = Engine.validMoves(s);
    if (!moves.length) return { used: null, stuck: true };
    let m;
    if (policy === 'hint') m = Engine.hint(s);
    else if (policy === 'weak' && rand() < WEAK_RANDOM) m = moves[Math.floor(rand() * moves.length)];
    else m = goalAwareMove(s, moves, W0, peek);
    s = Engine.applySwap(s, m.a, m.b).state;
  }
  return { used: s.status === 'won' ? cap - s.wonMovesLeft : null, stuck: false };
}

function runTask(t) {
  const level = Levels.get(t.id);
  const used = [];
  let stuck = 0;
  for (let i = 0; i < t.seeds; i++) {
    const r = playGame(level, 'sim' + i, t.policy, t.cap, t.peek);
    used.push(r.used);
    if (r.stuck) stuck++;
  }
  return { id: t.id, policy: t.policy, used, stuck };
}

// ---------------------------------------------------------------- estadísticas para M movimientos
function statsAt(used, M) {
  const n = used.length;
  let wins = 0, left = 0, three = 0, turns = 0;
  for (const u of used) {
    if (u !== null && u <= M) {
      wins++;
      const ml = M - u;
      left += ml;
      turns += u;
      if (ml * 100 >= 30 * M) three++;   // misma regla que Engine.starsFor
    } else turns += M;
  }
  return {
    win: (100 * wins) / n,
    left: wins ? left / wins : 0,
    three: (100 * three) / n,
    turns: turns / n,
  };
}

// Movimientos sugeridos: lo más cerca posible del punto ideal, dentro de la banda y con el bot débil >= 25%.
function suggest(lvl, bot, weak) {
  const tg = targetFor(lvl);
  const minM = lvl.id >= 6 && lvl.id <= 25 ? Math.max(MIN_MOVES, 17) : MIN_MOVES;   // reto diario = moves - 2 >= 15
  let best = null, bestCost = Infinity;
  for (let M = minM; M <= MAX_MOVES; M++) {
    const p = statsAt(bot, M).win, w = statsAt(weak, M).win;
    let cost = Math.abs(p - tg.aim);
    if (p < tg.lo) cost += 3 * (tg.lo - p);
    if (p > tg.hi) cost += 3 * (p - tg.hi);
    if (lvl.id > 5 && w < WEAK_MIN) cost += 2 * (WEAK_MIN - w);
    if (cost < bestCost - 1e-9) { bestCost = cost; best = M; }
  }
  return best;
}

// ---------------------------------------------------------------- CLI
function parseArgs(argv) {
  const o = { ids: [], seeds: 40, cap: 60, sweep: false, moves: null, hint: false, peek: false, md: false, jobs: os.cpus().length };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const num = () => { const v = Number(argv[++i]); if (!Number.isFinite(v)) throw new Error('falta número tras ' + a); return v; };
    if (a === '--seeds') o.seeds = num();
    else if (a === '--cap') o.cap = num();
    else if (a === '--moves') o.moves = num();
    else if (a === '--jobs') o.jobs = num();
    else if (a === '--sweep') o.sweep = true;
    else if (a === '--hint') o.hint = true;
    else if (a === '--peek') o.peek = true;
    else if (a === '--md') o.md = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (/^\d+(-\d+)?$/.test(a)) {
      const [x, y] = a.split('-').map(Number);
      for (let k = x; k <= (y || x); k++) o.ids.push(k);
    } else throw new Error('argumento desconocido: ' + a);
  }
  if (!o.ids.length) o.ids = Levels.list.map((l) => l.id);
  o.ids = o.ids.filter((id) => Levels.get(id));
  o.cap = Math.max(o.cap, MAX_MOVES, o.moves || 0);
  return o;
}

function runPool(tasks, jobs) {
  if (jobs <= 1 || tasks.length <= 1) return Promise.resolve(tasks.map(runTask));
  return new Promise((resolve, reject) => {
    const out = new Array(tasks.length);
    let next = 0, done = 0, alive = 0;
    const n = Math.min(jobs, tasks.length);
    for (let w = 0; w < n; w++) {
      const worker = new Worker(__filename, { workerData: { worker: true } });
      alive++;
      const feed = () => {
        if (next >= tasks.length) { worker.postMessage(null); return; }
        const k = next++;
        worker.postMessage({ k, task: tasks[k] });
      };
      worker.on('message', (msg) => {
        out[msg.k] = msg.result;
        done++;
        feed();
      });
      worker.on('error', reject);
      worker.on('exit', () => { alive--; if (!alive) { if (done === tasks.length) resolve(out); else reject(new Error('worker terminó antes de tiempo')); } });
      feed();
    }
  });
}

const pct = (x) => String(Math.round(x));
const fix1 = (x) => x.toFixed(1);

function table(headers, rows, md, align) {
  if (md) {
    const line = (cells) => '| ' + cells.join(' | ') + ' |';
    return [line(headers), line(headers.map((_, i) => (align[i] === 'l' ? ':--' : '--:'))), ...rows.map(line)].join('\n');
  }
  const w = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const fmt = (cells) => cells.map((c, i) => (align[i] === 'l' ? String(c).padEnd(w[i]) : String(c).padStart(w[i]))).join('  ');
  return [fmt(headers), w.map((x) => '-'.repeat(x)).join('  '), ...rows.map(fmt)].join('\n');
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) {
    console.log('node tools/sim.js [ids|a-b...] [--seeds N] [--sweep] [--moves M] [--hint] [--peek] [--md] [--jobs N] [--cap N]');
    return;
  }
  const policies = ['bot', 'weak'].concat(o.hint ? ['hint'] : []);
  const tasks = [];
  for (const id of o.ids) for (const policy of policies) tasks.push({ id, policy, seeds: o.seeds, cap: o.cap, peek: o.peek });
  const t0 = Date.now();
  const results = await runPool(tasks, o.jobs);
  const by = {};
  for (const r of results) (by[r.id] = by[r.id] || {})[r.policy] = r;

  console.log(`Cocardo · simulación de balance · ${o.seeds} semillas por nivel · bot consciente de metas (1 jugada adelante${o.peek ? ', viendo el relleno' : ''}) · débil = ${WEAK_RANDOM * 100}% al azar · ${((Date.now() - t0) / 1000).toFixed(1)} s\n`);

  const headers = ['Nivel', 'Tipo', 'Mov', 'Meta%', 'Bot%', 'Resto', '3★%', 'Turnos', 'Débil%', 'Débil3★%'];
  if (o.hint) headers.push('Hint%');
  headers.push('Bot@40', 'Estado');
  const align = headers.map((h, i) => (i === 1 || h === 'Estado' ? 'l' : 'r'));
  const rows = [], flagged = [];
  for (const id of o.ids) {
    const lvl = Levels.get(id), tg = targetFor(lvl), M = o.moves || lvl.moves, R = by[id];
    const b = statsAt(R.bot.used, M), w = statsAt(R.weak.used, M), at40 = statsAt(R.bot.used, MAX_MOVES);
    const flags = [];
    if (statsAt(R.bot.used, o.cap).win === 0) flags.push(`IMPOSIBLE: 0% incluso con ${o.cap}`);
    else if (at40.win === 0) flags.push('0% con 40 mov.');
    if (b.win < tg.lo) flags.push('difícil');
    if (b.win > tg.hi) flags.push('fácil');
    if (id > 5 && w.win < WEAK_MIN) flags.push(`débil<${WEAK_MIN}`);
    if (R.bot.stuck || R.weak.stuck) flags.push(`sin jugadas×${R.bot.stuck + R.weak.stuck}`);
    if (flags.length) flagged.push(`L${id}: ${flags.join(', ')}`);
    const row = [id, tg.kind, M, `${tg.lo}-${tg.hi}`, pct(b.win), fix1(b.left), pct(b.three), fix1(b.turns), pct(w.win), pct(w.three)];
    if (o.hint) row.push(pct(statsAt(R.hint.used, M).win));
    row.push(pct(at40.win), flags.length ? flags.join(', ') : 'ok');
    rows.push(row);
  }
  console.log(table(headers, rows, o.md, align));
  console.log('\nResto = movimientos que sobran al ganar (promedio de las victorias) · 3★% sobre todas las partidas · Turnos = movimientos jugados en promedio.');
  console.log(flagged.length ? '\nNiveles marcados:\n  ' + flagged.join('\n  ') : '\nTodos los niveles dentro de la meta.');

  if (o.sweep) {
    console.log(`\nCurva victoria% vs movimientos (${MIN_MOVES}..${MAX_MOVES}); «*» = movimientos actuales, «>» = sugerido`);
    const Ms = [];
    for (let M = MIN_MOVES; M <= MAX_MOVES; M++) Ms.push(M);
    console.log('       ' + Ms.map((M) => String(M).padStart(4)).join(''));
    for (const id of o.ids) {
      const lvl = Levels.get(id), R = by[id], sug = suggest(lvl, R.bot.used, R.weak.used);
      const mark = (M) => (M === lvl.moves ? '*' : M === sug ? '>' : ' ');
      console.log(`L${String(id).padEnd(3)}bot ` + Ms.map((M) => (mark(M) + pct(statsAt(R.bot.used, M).win)).padStart(4)).join('') + `   actual ${lvl.moves} → sugerido ${sug} (meta ${targetFor(lvl).aim}%)`);
      console.log('    weak ' + Ms.map((M) => pct(statsAt(R.weak.used, M).win).padStart(4)).join(''));
      if (R.hint) console.log('    hint ' + Ms.map((M) => pct(statsAt(R.hint.used, M).win).padStart(4)).join(''));
    }
  }
}

if (!isMainThread && workerData && workerData.worker) {
  parentPort.on('message', (msg) => {
    if (!msg) { process.exit(0); return; }
    parentPort.postMessage({ k: msg.k, result: runTask(msg.task) });
  });
} else if (require.main === module) {
  main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
}

module.exports = { goalWork, goalAwareMove, playGame, statsAt, targetFor, suggest };
