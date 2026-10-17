#!/usr/bin/env node
// F05 «Reto de hoy #N» — datos de un video con el motor del juego (el mismo bot que validar.cjs).
//
//   node tools/video/formatos/F05/generar.cjs <id>            ficha del calendario (o su alternativa con --rama)
//   opciones: --rama N (0 = la ficha; 1, 2… = las ramas de «alternativa»; por defecto 0 si no es condicional)
//             --guion (escribe tools/video/videos/<id>/guion.json desde parametros.lineas o anfitrion + linea, si no existe;
//                      --forzar lo reescribe)
//             --calendario <json> · --seco (solo comprueba) · --salida <carpeta> (en vez de tools/video/videos/<id>)
//
// Juega el Reto de ese día (Daily.levelFor + Daily.seedFor) con el bot honesto (no ve el relleno) y con el que ve las
// frutas que van a caer (peek), y en la edición «salon»/«semana» además los 7 Retos de la semana. Compara cada cifra con la
// ficha (sale con 1 si no cuadra: un lunes pudo cambiar un nivel del 6 al 25) y escribe tools/video/videos/<id>/reto.json,
// que leen la toma (tomas/reto.cjs) y la plantilla (plantilla.js). Nunca se guarda una jugada: solo turnos sin casillas.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const Engine = require(path.join(ROOT, 'js/core/engine.js'));
const Daily = require(path.join(ROOT, 'js/core/daily.js'));
const Levels = require(path.join(ROOT, 'js/core/levels.js'));
const Sim = require(path.join(ROOT, 'tools/sim.js'));

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const id = argv[0];
if (!id || id.startsWith('-')) {
  console.error('uso: node tools/video/formatos/F05/generar.cjs <id> [--rama N] [--guion [--forzar]] [--seco]');
  process.exit(2);
}

function calendario() {
  const dir = path.join(ROOT, 'tools/video/calendario');
  const f = opt('--calendario') || path.join(dir, fs.readdirSync(dir).filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort().pop());
  return JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
}
const ficha0 = (calendario().videos || []).find((v) => v.id === id);
if (!ficha0) { console.error('no hay ficha ' + id + ' en el calendario'); process.exit(2); }
// rama: 0 = la ficha; N = la N-ésima de «alternativa» (objeto o lista de ramas)
const ramas = ficha0.alternativa ? (Array.isArray(ficha0.alternativa) ? ficha0.alternativa : [ficha0.alternativa]) : [];
let rama = opt('--rama');
if (rama == null) {
  if (ficha0.condicion) {
    console.error(`${id} es condicional («${ficha0.condicion}»: ${ficha0.condicional}). Elige --rama 0 (se cumple) o ` +
      ramas.map((r, i) => `--rama ${i + 1}${r.si ? ' (si ' + r.si + ')' : ' (los demás casos)'}`).join(', ') + '.');
    process.exit(2);
  }
  rama = 0;
}
rama = +rama;
if (rama > ramas.length) { console.error(`${id} no tiene rama ${rama}`); process.exit(2); }
const ficha = rama ? Object.assign({}, ficha0, ramas[rama - 1]) : ficha0;
const par = ficha.parametros || {};
const errores = [];
const E = (m) => errores.push(m);

// ---------- el Reto de un día, jugado como validar.cjs ----------
const EPOCH = Date.UTC(2026, 9, 1);   // Reto #1 (js/core/daily.js)
function claveDeReto(n) { const d = new Date(EPOCH + (n - 1) * 864e5); return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate(); }
function numDeClave(k) { return Daily.challengeNumber(Math.floor(k / 10000), Math.floor(k / 100) % 100, k % 100); }
function jugar(clave, peek) {
  const lv = Daily.levelFor(clave, Levels.list);
  let s = Engine.createGame(lv, Daily.seedFor(clave));
  const W0 = Sim.goalWork(s).map((x) => Math.max(1, x));
  const turnos = [];
  while (s.status === 'playing') {
    const mv = Engine.validMoves(s);
    if (!mv.length) break;
    const m = Sim.goalAwareMove(s, mv, W0, peek);
    const r = Engine.applySwap(s, m.a, m.b);
    // del turno solo lo que sale en la fila de emojis (nunca las casillas: el Reto no enseña jugadas)
    turnos.push({ emoji: Daily.moveEmoji(r.turnInfo), cascadas: r.turnInfo.cascades, combo: !!r.turnInfo.combo, piezas: r.turnInfo.cleared });
    s = r.state;
  }
  const gano = s.status === 'won';
  return { gano, sobran: gano ? s.wonMovesLeft : 0, usados: turnos.length, estrellas: Engine.starsFor(s), turnos,
    emojis: turnos.map((t) => t.emoji).join(''), lv };
}
const txt = (r) => (!r.gano ? 'perdió' : r.sobran === 0 ? 'ganó en el último movimiento' : `ganó con ${r.sobran} de sobra`);
function resumen(r) { return { gano: r.gano, sobran: r.sobran, usados: r.usados, estrellas: r.estrellas, texto: txt(r), emojis: r.emojis, turnos: r.turnos }; }

const clave = +par.clave;
if (!/^\d{8}$/.test(String(clave))) { console.error('la ficha no trae parametros.clave (AAAAMMDD)'); process.exit(2); }
const num = numDeClave(clave);
const fecha = `${String(clave).slice(0, 4)}-${String(clave).slice(4, 6)}-${String(clave).slice(6)}`;
if (ficha.fecha && ficha.fecha !== fecha) E(`el Reto es del ${fecha} y el video sale el ${ficha.fecha}`);
if (par.reto != null && par.reto !== num) E(`la clave ${clave} es el Reto #${num}, no el #${par.reto}`);
const h = jugar(clave, false), v = jugar(clave, true), lv = h.lv;
if (par.nivel != null && par.nivel !== lv.id) E(`el Reto #${num} es el nivel ${lv.id}, no el ${par.nivel}`);
if (par.movimientos != null && par.movimientos !== lv.moves) E(`el Reto #${num} tiene ${lv.moves} movimientos, no ${par.movimientos}`);
if (par.bot_honesto && par.bot_honesto !== txt(h)) E(`bot honesto: el motor dice «${txt(h)}», la ficha «${par.bot_honesto}»`);
if (par.bot_que_ve_relleno && par.bot_que_ve_relleno !== txt(v)) E(`bot que ve el relleno: el motor dice «${txt(v)}», la ficha «${par.bot_que_ve_relleno}»`);
if (par.emojis_bot_honesto && par.emojis_bot_honesto !== h.emojis) E(`emojis: el motor da ${h.emojis}, la ficha ${par.emojis_bot_honesto}`);

// ---------- la semana (salón de la fama o «la semana de mi bot») ----------
let semana = null;
if (Array.isArray(par.semana) && par.semana.length === 2) {
  semana = [];
  for (let n = par.semana[0]; n <= par.semana[1]; n++) {
    const k = claveDeReto(n), r = jugar(k, false), rv = jugar(k, true);
    semana.push({ reto: n, clave: k, nivel: r.lv.id, nombre_nivel: r.lv.name, gano: r.gano, sobran: r.sobran, texto: txt(r),
      vidente: txt(rv) });
  }
  const g = semana.filter((x) => x.gano).length, p = semana.length - g;
  const dice = `${g} ganados y ${p} perdido${p === 1 ? '' : 's'} (Retos #${par.semana[0]} a #${par.semana[1]})`;
  if (par.bot_semana && par.bot_semana !== dice) E(`semana: el motor dice «${dice}», la ficha «${par.bot_semana}»`);
}

const villano = ((lv.villains || [])[0] || {}).who || null;
const datos = {
  id, rama, formato: 'F05', fecha, edicion: par.edicion || 'normal', reto: num, clave,
  nivel: lv.id, nombre_nivel: lv.name, movimientos: lv.moves, villano,
  anfitrion: par.anfitrion || villano || 'cocardo', linea: par.linea || null,
  sin_rotulo_del_nivel: !!par.sin_rotulo_del_nivel,
  gancho: ficha.gancho || null, titulo: ficha.titulo || null,
  honesto: resumen(h), vidente: resumen(v), semana,
  toma: `${id}-tablero`,
  generado: 'tools/video/formatos/F05/generar.cjs ' + argv.join(' '),
};

console.log(`${id}${rama ? ' (rama ' + rama + ')' : ''} · Reto #${num} (${fecha}) · nivel ${lv.id} «${lv.name}» · ${lv.moves} movimientos · edición ${datos.edicion}`);
console.log(`  bot honesto: ${txt(h)} (${h.usados} jugadas, ${h.estrellas}★) ${h.emojis}`);
console.log(`  bot que ve el relleno: ${txt(v)} (${v.usados} jugadas, ${v.estrellas}★) ${v.emojis}`);
if (semana) console.log('  semana: ' + semana.map((x) => `#${x.reto} ${x.gano ? '✔' : '✘'}`).join(' '));
if (errores.length) { console.error('NO CUADRA con la ficha:\n  - ' + errores.join('\n  - ')); process.exit(1); }
if (argv.includes('--seco')) process.exit(0);

const dir = path.resolve(opt('--salida') || path.join(ROOT, 'tools/video/videos', id));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'reto.json'), JSON.stringify(datos, null, 1) + '\n');
console.log('→ ' + path.relative(ROOT, path.join(dir, 'reto.json')));

// ---------- borrador del guion (lote de voz.py) ----------
const EMOCION = { cocardo: 'burlon', cereza: 'coqueta', reportera: 'noticia', narrador: 'narracion', durazna: 'asustado', lima: 'asustado' };
if (argv.includes('--guion')) {
  const g = path.join(dir, 'guion.json');
  if (fs.existsSync(g) && !argv.includes('--forzar')) console.log('  guion.json ya existe (--forzar para reescribirlo)');
  else {
    let lote;
    if (Array.isArray(par.lineas) && par.lineas.length) lote = par.lineas.map((l, i) => Object.assign({ hueco: i ? 'reaccion' : 'burla' }, l));
    else if (par.linea) lote = [{ quien: datos.anfitrion, texto: par.linea, emocion: EMOCION[datos.anfitrion] || 'normal', hueco: datos.edicion === 'noticiero' ? 'noticia' : 'burla' }];
    else lote = [];
    fs.writeFileSync(g, JSON.stringify(lote, null, 2) + '\n');
    console.log('→ ' + path.relative(ROOT, g) + (lote.length ? '' : ' (vacío: escribe las líneas, ver README de F05)'));
  }
}
console.log(`\nToma:   node tools/video/capturar.cjs tools/video/formatos/F05/tomas/reto.cjs dist/cap/${datos.toma} --var ${clave} --fps 30`);
console.log(`Voces:  python3 tools/video/voz/voz.py tools/video/videos/${id}/guion.json --revisar --salida dist/estudio/voz/${id} > dist/estudio/voz/${id}.json`);
console.log(`Render: node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/${id}/montaje.js" dist/videos-mes/${id}-reto-${num}.mp4 --cap dist/cap --volumen ganancia --revisar`);
