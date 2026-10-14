#!/usr/bin/env node
// Busca momentos de juego para los videos con el mismo motor del juego (misma semilla = mismo tablero en pantalla).
// Uso:
//   node tools/video/plan.cjs cascadas 1-30 [--semillas 400]   mejores aperturas en cascada de niveles reales
//   node tools/video/plan.cjs partida <nivel> <semilla>         partida del bot, jugada por jugada
//   node tools/video/plan.cjs ultimo <niveles> [--semillas 300] victorias en el último movimiento
//   node tools/video/plan.cjs casi <niveles> [--semillas 300]   último movimiento: una jugada pierde por poco y otra gana
// Como módulo: { nivel, jugar, aperturas, casi, resumenJugada }
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
  } else {
    console.error('comandos: cascadas | partida | ultimo | casi');
    process.exit(2);
  }
}

module.exports = { nivel, jugar, aperturas, casi, debil, resumenJugada, rango };
