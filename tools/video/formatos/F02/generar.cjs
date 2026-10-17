#!/usr/bin/env node
// F02 «Acertijo #N: ¿A, B o C?» — prepara los datos de un acertijo con el motor del juego.
//
//   node tools/video/formatos/F02/generar.cjs <id>                       ficha del calendario (nivel, semilla, política)
//   node tools/video/formatos/F02/generar.cjs <id> --fijo tools/video/datos/acertijo.cjs   tablero armado a mano
//   opciones: --respuesta A|B|C (letra de la ganadora; por defecto la de la ficha o una que rota con la semilla)
//             --perdedoras i,j (índices de plan.cjs casi en «pierde»; por defecto dos que se quedan a 1, separadas)
//             --calendario <json> (por defecto el más reciente de tools/video/calendario/)
//             --guion (escribe un borrador de guion.json si no existe: cuenta 3-2-1 y cierre del narrador)
//             --seco (solo comprueba e imprime, no escribe) · --salida <carpeta> (en vez de tools/video/videos/<id>)
//
// Escribe tools/video/videos/<id>/acertijo.json (lo leen la toma tomas/acertijo.cjs y plantilla.js) e imprime los
// comandos de captura. Comprueba con el motor que la ganadora gana, que las otras dos pierden y cuántas jugadas de TODO
// el tablero ganan («la única» solo si es 1; si no, «de estas tres, solo una gana»). Sale con 1 si algo no cuadra.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const Engine = require(path.join(ROOT, 'js/core/engine.js'));
const P = require(path.join(ROOT, 'tools/video/plan.cjs'));

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const id = argv[0];
if (!id || id.startsWith('-')) {
  console.error('uso: node tools/video/formatos/F02/generar.cjs <id> [--fijo datos.cjs] [--respuesta A|B|C] [--perdedoras i,j] [--guion]');
  process.exit(2);
}

function calendario() {
  const dir = path.join(ROOT, 'tools/video/calendario');
  const f = opt('--calendario') || path.join(dir, fs.readdirSync(dir).filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort().pop());
  return JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
}
const ficha = (calendario().videos || []).find((v) => v.id === id) || null;
const par = (ficha && ficha.parametros) || {};
const fijo = opt('--fijo') || (par.datos && /datos\/acertijo\.cjs$/.test(par.datos) ? par.datos : null);

// celdas de la víctima (bloque «friend») y del congelador: el gancho las marca con un anillo
function focos(st) {
  const out = [];
  st.grid.forEach((fila, r) => fila.forEach((cel, c) => { if (cel && cel.b && cel.b.kind === 'friend') out.push({ r, c, tipo: 'victima', who: cel.b.who }); }));
  if (st.freezer) out.push({ r: st.freezer.r + 0.5, c: st.freezer.c + 0.5, tipo: 'congelador', who: st.freezer.who });
  return out;
}
// lo que hace una jugada desde el estado: resumen, si gana y cuántas unidades de meta faltan
function probar(st, a, b) {
  const res = Engine.applySwap(st, a, b), u0 = Engine.goalUnits(st).remaining;
  // piezas acumuladas al terminar cada cascada (para el contador del montaje; la última es la cifra exacta del motor)
  const porCascada = [];
  let acc = 0;
  for (const s of res.steps) {
    if (!s.cascade) continue;
    for (const e of s.events) if (e.t === 'clear') acc++;
    porCascada[s.cascade - 1] = acc;
  }
  const total = res.turnInfo.cleared;
  const pc = porCascada.map((x) => Math.min(total, Math.round(x * total / Math.max(1, acc))));
  if (pc.length) pc[pc.length - 1] = total;
  return { a, b, ...P.resumenJugada(res), gana: res.state.status === 'won', faltan: Engine.goalUnits(res.state).remaining,
    metas_antes: u0, metas: res.state.goals.map((g) => ({ tipo: g.type, quedan: g.remaining })), piezas_por_cascada: pc };
}
const lejos = (x, y) => Math.hypot((x.a.r + x.b.r) / 2 - (y.a.r + y.b.r) / 2, (x.a.c + x.b.c) / 2 - (y.a.c + y.b.c) / 2);

let st, D;
if (fijo) {
  const F = require(path.resolve(ROOT, fijo));
  st = Engine.fromRows(F.FILAS, F.OPTS);
  const ops = {};
  for (const k of ['A', 'B', 'C']) ops[k] = probar(st, F.OPCIONES[k].a, F.OPCIONES[k].b);
  D = { fuente: 'fijo', datos: fijo, nivel: F.OPTS.levelId, semillaPagina: par.semilla_pagina || F.OPTS.levelId,
    filas: F.FILAS, opts: F.OPTS, opciones: ops };
} else {
  if (!par.nivel || !par.semilla) { console.error(`${id}: la ficha no trae nivel y semilla (o usa --fijo)`); process.exit(2); }
  const pol = par.politica == null ? 'experto' : par.politica;
  const r = P.casi(par.nivel, par.semilla, pol === 'experto' ? undefined : pol);
  if (!r) { console.error(`plan.cjs casi no da un último movimiento para ${par.nivel}:${par.semilla}:${pol}`); process.exit(1); }
  st = Engine.createGame(P.nivel(par.nivel), par.semilla);
  for (const m of r.prefijo) st = Engine.applySwap(st, m.a, m.b).state;
  // ganadora: la de la ficha (gana.a/b o gana_indice) o la que más piezas rompe
  let g = r.gana.slice().sort((x, y) => y.piezas - x.piezas)[0];
  if (par.gana_indice != null) g = r.gana[par.gana_indice];
  else if (par.gana && par.gana.a) g = r.gana.find((x) => x.a.r === par.gana.a.r && x.a.c === par.gana.a.c && x.b.r === par.gana.b.r && x.b.c === par.gana.b.c) || g;
  // perdedoras: las que se quedan a 1, separadas de la ganadora y entre sí (más cascadas = más acción)
  let pierden;
  const pedidas = opt('--perdedoras');
  if (pedidas) pierden = pedidas.split(',').map((i) => r.pierde[+i]);
  else {
    const cand = r.pierde.filter((x) => x.faltan === 1).sort((x, y) => y.cascadas - x.cascadas || y.piezas - x.piezas);
    pierden = [];
    for (const x of cand) {
      if (pierden.length === 2) break;
      if (lejos(x, g) >= 2 && pierden.every((y) => lejos(x, y) >= 2)) pierden.push(x);
    }
    for (const x of cand) if (pierden.length < 2 && !pierden.includes(x)) pierden.push(x);
  }
  if (pierden.length < 2 || pierden.some((x) => !x)) { console.error('no hay dos jugadas que se queden a 1'); process.exit(1); }
  const letra = (opt('--respuesta') || par.respuesta || ['B', 'C', 'A'][par.semilla % 3]).toUpperCase();
  const otras = ['A', 'B', 'C'].filter((k) => k !== letra), ops = {};
  ops[letra] = probar(st, g.a, g.b);
  otras.forEach((k, i) => { ops[k] = probar(st, pierden[i].a, pierden[i].b); });
  D = { fuente: 'plan', nivel: par.nivel, semillaPagina: par.semilla,
    partida: { semilla: par.semilla, politica: pol, prefijo: r.prefijo.map((m) => ({ a: m.a, b: m.b })) }, opciones: ops };
}

// comprobaciones con el motor
const todas = Engine.validMoves(st).map((m) => probar(st, m.a, m.b));
const ganan = todas.filter((x) => x.gana);
const letras = Object.keys(D.opciones).sort();
const respuesta = letras.filter((k) => D.opciones[k].gana);
const fallos = [];
if (st.movesLeft !== 1) fallos.push(`el estado tiene ${st.movesLeft} movimientos, no 1`);
if (respuesta.length !== 1) fallos.push(`de las tres opciones ganan ${respuesta.length}, no 1`);
if (par.ganadoras_en_tablero != null && ganan.length !== par.ganadoras_en_tablero) fallos.push(`en todo el tablero ganan ${ganan.length}, la ficha dice ${par.ganadoras_en_tablero}`);
if (par.frase === 'la única' && ganan.length !== 1) fallos.push('la ficha dice «la única» y gana más de una jugada');
D.id = id;
D.respuesta = respuesta[0] || null;
D.jugadas_validas = todas.length;
D.ganadoras_en_tablero = ganan.length;
D.frase = ganan.length === 1 ? 'la única' : 'de estas tres, solo una gana';
D.focos = focos(st);
D.victima = (D.focos.find((f) => f.tipo === 'victima') || {}).who || null;
D.tomas = {};
for (const k of letras) D.tomas[k] = `${id}-${k}`;
D.generado = new Date().toISOString().slice(0, 19);

const seco = argv.includes('--seco');
const dir = opt('--salida') ? path.resolve(opt('--salida')) : path.join(ROOT, 'tools/video/videos', id);
const salida = path.join(dir, 'acertijo.json');
if (!seco) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(salida, JSON.stringify(D, null, 1) + '\n'); }

console.log(`${id}: nivel ${D.nivel}, ${D.fuente === 'fijo' ? 'tablero ' + D.datos : `semilla ${D.partida.semilla}, bot ${D.partida.politica}, ${D.partida.prefijo.length} jugadas previas`}`);
for (const k of letras) {
  const o = D.opciones[k];
  console.log(`  ${k}${k === D.respuesta ? ' ✓' : '  '} r${o.a.r}c${o.a.c}↔r${o.b.r}c${o.b.c}: ${o.gana ? 'GANA' : 'pierde, faltan ' + o.faltan}, ${o.cascadas} cascadas, ${o.piezas} piezas` +
    `${o.especiales.length ? ', ' + o.especiales.join('+') : ''}${o.combo ? ', combo' : ''}${o.rescates.length ? ', rescata a ' + o.rescates.join(', ') : ''}`);
}
console.log(`  jugadas válidas ${todas.length}, ganan ${ganan.length} → «${D.frase}»; víctima: ${D.victima || '—'}`);
console.log(`${seco ? '(en seco: no escribe nada) ' : ''}→ ${path.relative(ROOT, salida)}\n\nCapturas (una a la vez, ~0,5 GB de RAM cada una):`);
for (const k of letras) console.log(`  node tools/video/capturar.cjs tools/video/formatos/F02/tomas/acertijo.cjs dist/cap/${id}-${k} --var tools/video/videos/${id}/acertijo.json:${k}`);

// borrador del guion (solo si no existe): el narrador cuenta y cierra; la línea del personaje la pones tú
const gpath = path.join(dir, 'guion.json');
if (argv.includes('--guion') && !seco && !fs.existsSync(gpath)) {
  const L = [
    { quien: 'narrador', texto: 'Tres.', emocion: 'narracion', nueva: true, hueco: 'cuenta3' },
    { quien: 'narrador', texto: 'Dos.', emocion: 'narracion', nueva: true, hueco: 'cuenta2' },
    { quien: 'narrador', texto: 'Uno.', emocion: 'narracion', nueva: true, hueco: 'cuenta1' },
    { quien: 'narrador', texto: '¿Acertaste? Comenta tu letra.', emocion: 'narracion', nueva: true, hueco: 'cierre' },
  ];
  fs.writeFileSync(gpath, JSON.stringify(L, null, 2) + '\n');
  console.log(`\nBorrador → ${path.relative(ROOT, gpath)}: añade la línea del personaje («hueco»: «pide», «gana» o «falla»).`);
}
if (fallos.length) { console.error('\nNO CUADRA:\n  ' + fallos.join('\n  ')); process.exit(1); }
