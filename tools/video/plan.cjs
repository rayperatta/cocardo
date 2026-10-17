#!/usr/bin/env node
// Busca momentos de juego para los videos con el mismo motor del juego (misma semilla = mismo tablero en pantalla).
// Uso:
//   node tools/video/plan.cjs cascadas 1-30 [--semillas 400]   mejores aperturas en cascada de niveles reales
//   node tools/video/plan.cjs partida <nivel> <semilla>         partida del bot, jugada por jugada
//   node tools/video/plan.cjs ultimo <niveles> [--semillas 300] victorias en el último movimiento
//   node tools/video/plan.cjs casi <niveles> [--semillas 300]   último movimiento: una jugada pierde por poco y otra gana
//   node tools/video/plan.cjs verificar                         lo que dicen los montajes sigue siendo cierto (sale 1 si no)
// Como módulo: { nivel, jugar, aperturas, casi, resumenJugada, verificar }
'use strict';
const Engine = require('../../js/core/engine.js');
const Levels = require('../../js/core/levels.js');
const Sim = require('../sim.js');

function nivel(id) { return JSON.parse(JSON.stringify(Levels.get(id))); }

function resumenJugada(res) {
  const ev = { create: [], combo: 0, rescue: [], destroy: 0, villain: 0 };
  for (const st of res.steps) {
    for (const e of st.events) {
      if (e.t === 'create') ev.create.push(e.type);
      else if (e.t === 'combo') ev.combo++;
      else if (e.t === 'rescue') ev.rescue.push(e.who || e.id || 'amigo');
      else if (e.t === 'destroy') ev.destroy++;
      else if (e.t === 'villain') ev.villain++;
    }
  }
  return { cascadas: res.turnInfo.cascades, combo: !!res.turnInfo.combo, piezas: res.turnInfo.cleared, especiales: ev.create, rescates: ev.rescue,
    villano: ev.villain };
}

// Juega con el bot del simulador (peek: ve el relleno real, juega "como experto") y guarda la traza
function jugar(id, semilla, o) {
  o = o || {};
  const lv = nivel(id);
  let s = Engine.createGame(lv, semilla);
  const W0 = Sim.goalWork(s).map((x) => Math.max(1, x));
  const traza = [];
  while (s.status === 'playing') {
    const moves = Engine.validMoves(s);
    if (!moves.length) break;
    const m = o.politica ? o.politica(s, moves, W0) : Sim.goalAwareMove(s, moves, W0, o.peek !== false);
    const res = Engine.applySwap(s, m.a, m.b);
    traza.push({ a: m.a, b: m.b, ...resumenJugada(res), quedan: res.state.movesLeft, fz: res.state.freezer ? res.state.freezer.hp : null,
      metas: res.state.goals.map((g) => g.remaining) });
    s = res.state;
  }
  return { nivel: id, semilla, estado: s.status, quedan: s.status === 'won' ? s.wonMovesLeft : s.movesLeft, jugadas: traza, final: s };
}

// Mejores aperturas en cascada (una sola jugada desde el tablero inicial)
function aperturas(ids, semillas) {
  const out = [];
  for (const id of ids) {
    const lv = nivel(id), hist = {};
    let n = 0;
    for (let seed = 1; seed <= semillas; seed++) {
      const s = Engine.createGame(lv, seed);
      for (const m of Engine.validMoves(s)) {
        const res = Engine.applySwap(s, m.a, m.b), c = res.turnInfo.cascades;
        hist[c] = (hist[c] || 0) + 1; n++;
        if (c >= 9) out.push({ nivel: id, semilla: seed, a: m.a, b: m.b, ...resumenJugada(res) });
      }
    }
    out.push({ nivel: id, hist, total: n });
  }
  return out;
}

// Estados con 1 movimiento: una jugada gana y otra pierde "por poco" (DISENO §5: quedan <= 20 % de las unidades)
// bot experto que juega al azar una fracción p de las veces (determinista por semilla)
function debil(p, semilla) {
  let x = (semilla * 2654435761) >>> 0;
  const rand = () => { x = (x + 0x6D2B79F5) >>> 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return (s, moves, W0) => (rand() < p ? moves[Math.floor(rand() * moves.length)] : Sim.goalAwareMove(s, moves, W0, false));
}

function casi(id, semilla, politica) {
  const r = politica === 'pista' ? jugar(id, semilla, { politica: (s) => Engine.hint(s) })
    : typeof politica === 'number' ? jugar(id, semilla, { politica: debil(politica, semilla) }) : jugar(id, semilla, { peek: true });
  // se rehace la partida hasta que quede 1 movimiento
  const lv = nivel(id);
  let s = Engine.createGame(lv, semilla);
  const prefijo = [];
  for (const j of r.jugadas) {
    if (s.movesLeft <= 1 || s.status !== 'playing') break;
    s = Engine.applySwap(s, j.a, j.b).state;
    prefijo.push({ a: j.a, b: j.b });
  }
  if (s.status !== 'playing' || s.movesLeft !== 1) return null;
  const units0 = Engine.goalUnits(Engine.createGame(lv, semilla)).start;
  const gana = [], pierde = [];
  for (const m of Engine.validMoves(s)) {
    const res = Engine.applySwap(s, m.a, m.b);
    const info = { a: m.a, b: m.b, ...resumenJugada(res) };
    if (res.state.status === 'won') gana.push(info);
    else {
      const u = Engine.goalUnits(res.state).remaining;
      if (u > 0 && u <= Math.max(1, Math.floor(units0 * 0.2))) pierde.push({ ...info, faltan: u });
    }
  }
  if (!gana.length || !pierde.length) return null;
  return { nivel: id, semilla, politica: politica || 'experto', prefijo, gana, pierde, unidades0: units0 };
}

// Lo que los montajes dicen en pantalla (cifras, quién se rescata y cuándo) comprobado con el motor. Correr después
// de tocar js/core/engine.js, js/core/levels.js o tools/sim.js (el bot): si algo falla, esa toma ya no cuenta lo que
// dice el video y hay que buscar otra jugada con los comandos de arriba.
function verificar() {
  const out = [];
  const ok = (nombre, cond, detalle) => out.push({ nombre, ok: !!cond, detalle });
  const jugadaDe = (r, quien) => r.jugadas.findIndex((j) => j.rescates.includes(quien)) + 1;   // 1..n, 0 si no
  // 03 cascada.js y tráiler: nivel 4, semilla 2465
  let res = Engine.applySwap(Engine.createGame(nivel(4), 2465), { r: 7, c: 2 }, { r: 7, c: 3 });
  const hielo = res.state.goals[0], rj = resumenJugada(res);
  ok('cascada: 18 cascadas, 15 de 16 hielos', rj.cascadas === 18 && hielo.target === 16 && hielo.remaining === 1,
    `${rj.cascadas} cascadas, ${hielo.target - hielo.remaining} de ${hielo.target} hielos`);
  res = Engine.applySwap(Engine.applySwap(res.state, { r: 4, c: 5 }, { r: 5, c: 5 }).state, { r: 6, c: 6 }, { r: 7, c: 6 });
  ok('cascada: gana 2 jugadas después con 19 de sobra', res.state.status === 'won' && res.state.wonMovesLeft === 19,
    `${res.state.status}, sobran ${res.state.wonMovesLeft}`);
  // 04 acertijo.js: solo C gana; B rompe el congelador pero Lima sigue congelada
  const A = require('./datos/acertijo.cjs');
  const op = {};
  for (const k of ['A', 'B', 'C']) op[k] = Engine.applySwap(Engine.fromRows(A.FILAS, A.OPTS), A.OPCIONES[k].a, A.OPCIONES[k].b).state;
  ok('acertijo: solo C gana', op.A.status !== 'won' && op.B.status !== 'won' && op.C.status === 'won', `A ${op.A.status}, B ${op.B.status}, C ${op.C.status}`);
  ok('acertijo: B rompe el congelador, Lima sigue', op.B.goals[0].remaining === 0 && op.B.goals[1].remaining === 1, JSON.stringify(op.B.goals.map((g) => g.remaining)));
  // 05 casi.js (y Fresa en rescates.js): nivel 13, semilla 45, bot débil 25 %
  const c = casi(13, 45, 0.25);
  const g = c && c.gana.slice().sort((x, y) => y.piezas - x.piezas)[0];
  ok('casi13: una pierde por 1 y otra gana con 12 cascadas y rescata a Fresa',
    c && c.pierde[0].faltan === 1 && g.cascadas === 12 && g.rescates.includes('fresa'),
    c ? `faltan ${c.pierde[0].faltan}; gana con ${g.cascadas} cascadas, rescata ${g.rescates}` : 'sin estado de último movimiento');
  // 06 congelador.js (y Lima en rescates.js): nivel 10, semilla 101
  const cong = jugar(10, 101, { peek: true }), ult = cong.jugadas[cong.jugadas.length - 1];
  ok('congelador10: gana en 8, la última rompe el congelador y libera a Lima', cong.estado === 'won' && cong.jugadas.length === 8 &&
    ult.fz === 0 && jugadaDe(cong, 'lima') === 8, `${cong.estado} en ${cong.jugadas.length}, Lima en la ${jugadaDe(cong, 'lima')}`);
  // 08 combos.js: cada cambio es combo y Copa + Copa se lleva todo el tablero
  const D = require('./datos/combos.cjs');
  for (const k of Object.keys(D.COMBOS)) {
    const t = D.tablero(k), st = Engine.fromRows(t.rows, t.opts), r = Engine.applySwap(st, t.a, t.b);
    let piezas = 0;
    st.grid.forEach((fila) => fila.forEach((cel) => { if (cel && cel.p) piezas++; }));
    ok(`combo ${k}: ${D.COMBOS[k].nombre}`, r.turnInfo.combo && (k !== 'cc' || r.turnInfo.cleared >= piezas), `${r.turnInfo.cleared} piezas de ${piezas}`);
  }
  // 09 cherry.js: nivel 17 (Cherry actúa en la jugada 5) y nivel 25 (su congelador cae en la 11 y se gana)
  const n17 = jugar(17, 1, { peek: true });
  ok('cherry17: Cherry vuelve cajas en la jugada 5', n17.jugadas[4] && n17.jugadas[4].villano > 0, 'villano en ' + n17.jugadas.map((j, i) => (j.villano ? i + 1 : 0)).filter(Boolean).slice(0, 5));
  const n25 = jugar(25, 19, { peek: true });
  ok('rosa25: congelador roto y victoria en la jugada 11', n25.estado === 'won' && n25.jugadas.length === 11 && n25.jugadas[10].fz === 0, `${n25.estado} en ${n25.jugadas.length}`);
  // 10 clutch.js: nivel 23, semilla 31, gana en el último movimiento
  const n23 = jugar(23, 31, { peek: true });
  ok('clutch23: gana en el último movimiento (26 jugadas)', n23.estado === 'won' && n23.quedan === 0 && n23.jugadas.length === 26, `${n23.estado}, ${n23.jugadas.length} jugadas, sobran ${n23.quedan}`);
  // 11 rescates.js: Durazna (nivel 15) y Naranja (nivel 19)
  const n15 = jugar(15, 63, { peek: true }), n19 = jugar(19, 40, { peek: true });
  ok('rescate15: Durazna', jugadaDe(n15, 'durazna') > 0, 'jugada ' + jugadaDe(n15, 'durazna'));
  ok('rescate19: Naranja', jugadaDe(n19, 'naranja') > 0, 'jugada ' + jugadaDe(n19, 'naranja'));
  // 12 hielo.js: nivel 12, semilla 1 (se graban las jugadas 1-8)
  const n12 = jugar(12, 1, { peek: true });
  ok('hielo12: el bot juega al menos 8 jugadas', n12.jugadas.length >= 8, `${n12.estado} en ${n12.jugadas.length}`);
  // 13 final.js (y tráiler, rescates.js): nivel 30, semilla 3: Banana en la 13 y Uva en la última (31)
  const n30 = jugar(30, 3, { peek: true });
  ok('final30: Banana en la 13 y Uva en la última (31)', n30.estado === 'won' && n30.jugadas.length === 31 && jugadaDe(n30, 'banana') === 13 &&
    jugadaDe(n30, 'uva') === 31, `${n30.estado} en ${n30.jugadas.length}, Banana ${jugadaDe(n30, 'banana')}, Uva ${jugadaDe(n30, 'uva')}`);
  return out;
}

function rango(txt) {
  const ids = [];
  for (const part of String(txt).split(',')) {
    const [a, b] = part.split('-').map(Number);
    for (let i = a; i <= (b || a); i++) ids.push(i);
  }
  return ids;
}

if (require.main === module) {
  const [cmd, arg1, arg2] = process.argv.slice(2);
  const iS = process.argv.indexOf('--semillas');
  const N = iS > 0 ? +process.argv[iS + 1] : 300;
  if (cmd === 'cascadas') {
    const res = aperturas(rango(arg1 || '1-30'), N);
    const top = res.filter((x) => x.semilla).sort((a, b) => b.cascadas - a.cascadas || b.piezas - a.piezas).slice(0, 25);
    for (const x of res.filter((x) => x.hist)) {
      const ge = (k) => Object.entries(x.hist).filter(([c]) => +c >= k).reduce((a, [, v]) => a + v, 0);
      console.log(`nivel ${x.nivel}: ${x.total} aperturas, >=6: ${ge(6)}, >=10: ${ge(10)}, max ${Math.max(...Object.keys(x.hist).map(Number))}`);
    }
    console.log(JSON.stringify(top, null, 0).replace(/\},\{/g, '},\n{'));
  } else if (cmd === 'partida') {
    const r = jugar(+arg1, +arg2, { peek: true });
    r.jugadas.forEach((j, i) => console.log(i + 1, JSON.stringify(j)));
    console.log(r.estado, 'quedan', r.quedan);
  } else if (cmd === 'ultimo') {
    for (const id of rango(arg1)) {
      for (let seed = 1; seed <= N; seed++) {
        const r = jugar(id, seed, { peek: true });
        if (r.estado === 'won' && r.quedan === 0) {
          const u = r.jugadas[r.jugadas.length - 1];
          console.log(JSON.stringify({ nivel: id, semilla: seed, jugadas: r.jugadas.length, ultima: u }));
        }
      }
    }
  } else if (cmd === 'casi') {
    for (const id of rango(arg1)) {
      for (let seed = 1; seed <= N; seed++) {
        const r = casi(id, seed) || casi(id, seed, 0.25) || casi(id, seed, 0.45);
        if (r) console.log(JSON.stringify({ nivel: id, semilla: seed, politica: r.politica, prefijo: r.prefijo.length, gana: r.gana.slice(0, 3), pierde: r.pierde.slice(0, 3) }));
      }
    }
  } else if (cmd === 'verificar') {
    const res = verificar();
    for (const r of res) console.log(`${r.ok ? 'ok   ' : 'FALLA'} ${r.nombre} (${r.detalle})`);
    const malas = res.filter((r) => !r.ok).length;
    console.log(malas ? `${malas} de ${res.length} ya no cuadran` : `las ${res.length} comprobaciones cuadran`);
    process.exit(malas ? 1 : 0);
  } else {
    console.error('comandos: cascadas | partida | ultimo | casi | verificar');
    process.exit(2);
  }
}

module.exports = { nivel, jugar, aperturas, casi, debil, resumenJugada, rango, verificar };
