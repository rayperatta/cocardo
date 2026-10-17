#!/usr/bin/env node
// F03 «Perdí por uno» — prepara los datos de un video con el motor del juego (léeme: README.md de esta carpeta).
//
//   node tools/video/formatos/F03/generar.cjs <id>             ficha del calendario (nivel, semilla, política)
//   opciones: --pierde i / --gana i   índices de plan.cjs casi SIN ordenar (por defecto los de la ficha: pierde.indice y
//                                     gana_indice; si no trae, la que se queda a «pierde_por» con más piezas y la
//                                     ganadora que más piezas rompe)
//             --nivel N --semilla S --politica P   otro caso (p. ej. el nivel que pidió la gente: plan.cjs casi N)
//             --calendario <json>   (por defecto el más reciente de tools/video/calendario/)
//             --guion               escribe tools/video/videos/<id>/guion.json (lote de voz.py) si no existe: las
//                                   parametros.lineas de la ficha o, si no trae, «burla»/«burlas» con hueco «burla»
//             --montaje             escribe tools/video/videos/<id>/montaje.js (si no existe) con el gancho de la ficha
//             --texto               imprime el texto del post (texto_post + hashtags) y nada más
//             --seco                solo comprueba e imprime · --salida <carpeta> (en vez de tools/video/videos/<id>)
//
// Escribe tools/video/videos/<id>/casi.json (lo lee plantilla.js) e imprime los comandos de captura, voces y render.
// Comprueba con el motor lo que dice la ficha: que la perdedora se queda a «pierde_por», que la ganadora gana, cuántas
// jugadas de TODO el tablero ganan («la única» solo si es 1; si no, «había N jugadas que ganaban»), el prefijo y las
// cifras de la ficha. Sale con 1 si algo no cuadra.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const Engine = require(path.join(ROOT, 'js/core/engine.js'));
const Story = require(path.join(ROOT, 'js/story.js'));
const P = require(path.join(ROOT, 'tools/video/plan.cjs'));

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const id = argv[0];
if (!id || id.startsWith('-')) {
  console.error('uso: node tools/video/formatos/F03/generar.cjs <id> [--pierde i] [--gana i] [--guion] [--montaje] [--texto] [--seco]');
  process.exit(2);
}
function calendario() {
  const dir = path.join(ROOT, 'tools/video/calendario');
  const f = opt('--calendario') || path.join(dir, fs.readdirSync(dir).filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort().pop());
  return JSON.parse(fs.readFileSync(path.resolve(f), 'utf8'));
}
const ficha = (calendario().videos || []).find((v) => v.id === id) || null;
if (!ficha && !opt('--nivel')) { console.error(`${id}: no está en el calendario (o pasa --nivel --semilla --politica)`); process.exit(2); }
const par = (ficha && ficha.parametros) || {};

if (argv.includes('--texto')) {
  if (!ficha) process.exit(2);
  console.log(ficha.texto_post + '\n\n' + (ficha.hashtags || []).join(' '));
  process.exit(0);
}

const nivel = +(opt('--nivel') || par.nivel), semilla = +(opt('--semilla') || par.semilla);
const polTxt = String(opt('--politica') || (par.politica == null ? 'experto' : par.politica));
const pol = polTxt === 'experto' ? undefined : polTxt === 'pista' ? 'pista' : +polTxt;
const cambiado = !!opt('--nivel');   // otro caso: las cifras de la ficha no se comparan
const r = P.casi(nivel, semilla, pol);
if (!r) { console.error(`plan.cjs casi no da un último movimiento para ${nivel}:${semilla}:${polTxt}`); process.exit(1); }

const errores = [], avisos = [];
const igual = (x, y) => x && y && x.r === y.r && x.c === y.c;
let st = Engine.createGame(P.nivel(nivel), semilla);
for (const m of r.prefijo) st = Engine.applySwap(st, m.a, m.b).state;
if (st.movesLeft !== 1) errores.push(`el prefijo deja ${st.movesLeft} movimientos, no 1`);

// ---------- qué hace una jugada: cifras, metas tras cada cascada y lo que queda en el tablero ----------
const UNIDAD = { ice: ['hielo', 'hielos', 'm'], crate: ['caja', 'cajas', 'f'], rescue: ['rescate', 'rescates', 'm'],
  boss: ['golpe al congelador', 'golpes al congelador', 'm'], color: ['fruta', 'frutas', 'f'], token: ['prueba', 'pruebas', 'f'] };
const BLOQUE = { ice: 'ice', crate: 'crate', rescue: 'friend' };
function probar(a, b) {
  const res = Engine.applySwap(st, a, b);
  // metas (lo que falta de cada una) al terminar cada cascada; [0] = antes de la jugada
  const metas = [st.goals.map((g) => g.remaining)], piezas = [];
  let acc = 0;
  for (const s of res.steps) {
    for (const e of s.events) if (e.t === 'clear') acc++;
    if (!s.cascade) continue;
    metas[s.cascade] = s.goals.slice();
    piezas[s.cascade - 1] = acc;
  }
  for (let i = 1; i < metas.length; i++) if (!metas[i]) metas[i] = metas[i - 1];
  const total = res.turnInfo.cleared;
  const pc = piezas.map((x) => Math.min(total, Math.round(x * total / Math.max(1, acc))));
  if (pc.length) pc[pc.length - 1] = total;
  // lo que queda sin hacer al final (celdas de los bloques de las metas que faltan, para marcarlas)
  const fin = res.state, quedan = [];
  fin.goals.forEach((g) => {
    if (g.remaining <= 0) return;
    if (g.type === 'boss' && fin.freezer) quedan.push({ tipo: 'boss', r: fin.freezer.r + 0.5, c: fin.freezer.c + 0.5 });
    const k = BLOQUE[g.type];
    if (k) fin.grid.forEach((fila, rr) => fila.forEach((cel, cc) => { if (cel && cel.b && cel.b.kind === k) quedan.push({ tipo: g.type, r: rr, c: cc, who: cel.b.who }); }));
  });
  return { a, b, ...P.resumenJugada(res), gana: fin.status === 'won', faltan: Engine.goalUnits(fin).remaining,
    metas_por_cascada: metas, piezas_por_cascada: pc, quedan: quedan.length <= 4 ? quedan : [] };
}

// ---------- la perdedora y la ganadora ----------
const porPiezas = (lista, filtro) => lista.map((x, i) => [x, i]).filter(([x]) => !filtro || filtro(x)).sort((p, q) => q[0].piezas - p[0].piezas)[0];
const pierdePor = par.pierde_por || (par.pierde && par.pierde.faltan) || 1;
let iP = opt('--pierde') != null ? +opt('--pierde') : par.pierde && par.pierde.indice != null && !cambiado ? par.pierde.indice : null;
if (iP == null) { const m = porPiezas(r.pierde, (x) => x.faltan === pierdePor); iP = m ? m[1] : -1; }
let iG = opt('--gana') != null ? +opt('--gana') : par.gana_indice != null && !cambiado ? par.gana_indice : null;
if (iG == null) iG = porPiezas(r.gana)[1];
const jp = r.pierde[iP], jg = r.gana[iG];
if (!jp) errores.push(`no hay una jugada que se quede a ${pierdePor} (pierde[${iP}])`);
if (!jg) errores.push(`no hay ganadora gana[${iG}]`);
if (!jp || !jg) { errores.forEach((e) => console.error('ERROR ' + e)); process.exit(1); }
const pierde = probar(jp.a, jp.b), gana = probar(jg.a, jg.b);
if (pierde.gana || pierde.faltan !== jp.faltan) errores.push('la perdedora no pierde como dice plan.cjs');
if (!gana.gana) errores.push('la ganadora no gana');
if (pierde.faltan !== pierdePor) errores.push(`la perdedora se queda a ${pierde.faltan}, no a ${pierdePor}`);

// ---------- lo que dice la ficha ----------
if (!cambiado) {
  if (par.ganadoras_en_tablero != null && r.gana.length !== par.ganadoras_en_tablero) errores.push(`el motor da ${r.gana.length} jugadas ganadoras, no ${par.ganadoras_en_tablero}`);
  if (par.prefijo != null && r.prefijo.length !== par.prefijo) errores.push(`el prefijo tiene ${r.prefijo.length} jugadas, no ${par.prefijo}`);
  const q = par.pierde || {};
  if (q.a && (!igual(q.a, jp.a) || !igual(q.b, jp.b))) errores.push('la perdedora no es la de la ficha (pierde.a/b)');
  for (const k of ['cascadas', 'piezas', 'faltan']) if (q[k] != null && q[k] !== pierde[k]) errores.push(`la perdedora hace ${k} = ${pierde[k]}, la ficha dice ${q[k]}`);
  if (q.combo != null && !!q.combo !== pierde.combo) errores.push('combo de la perdedora distinto a la ficha');
  const g = par.gana || {};
  if (g.a && (!igual(g.a, jg.a) || !igual(g.b, jg.b))) errores.push('la ganadora no es la de la ficha (gana.a/b)');
  for (const k of ['cascadas', 'piezas']) if (g[k] != null && g[k] !== gana[k]) errores.push(`la ganadora hace ${k} = ${gana[k]}, la ficha dice ${g[k]}`);
  if (g.combo != null && !!g.combo !== gana.combo) errores.push('combo de la ganadora distinto a la ficha');
  // lo que se afirma (sin las advertencias «nunca «la única»»)
  const txt = [ficha.idea, ficha.texto_post, ficha.gancho, par.frase].join(' ').replace(/nunca\s*«[^»]*»/gi, '');
  if (r.gana.length > 1 && /\b(la )?[úu]nica\b|solo UNA|sólo UNA/i.test(txt)) errores.push(`la ficha dice «la única»/«solo UNA» y ganan ${r.gana.length} jugadas: «había ${r.gana.length} jugadas que ganaban»`);
  const nCasc = /(\d+) cascadas/.exec(ficha.idea || '');
  if (nCasc && +nCasc[1] !== gana.cascadas && +nCasc[1] !== pierde.cascadas) avisos.push(`la idea dice ${nCasc[1]} cascadas; ganadora ${gana.cascadas}, perdedora ${pierde.cascadas}`);
}

// ---------- datos para la plantilla ----------
const lv = P.nivel(nivel);
const COLOR = { L: 'Lima', F: 'Fresa', B: 'Banana', U: 'Uva', N: 'Naranja', D: 'Durazna' };   // como js/game.js
const skin = (st.tokens && st.tokens.skin) || (lv0().tokens && lv0().tokens.skin) || 'uva';
if (skin === 'uva') UNIDAD.token = ['Uva', 'Uvas', 'f'];
function lv0() { return P.nivel(nivel); }
const metasNombres = st.goals.map((g) => {
  if (g.type === 'color') return COLOR[g.color] || 'Frutas';
  if (g.type === 'token') return skin === 'uva' ? 'Uva' : 'Pruebas';
  if (g.type === 'rescue') { const f = []; st.grid.forEach((fl) => fl.forEach((c) => { if (c && c.b && c.b.kind === 'friend') f.push(Story.nameOf(c.b.who)); })); return f.join(' y ') || 'Rescate'; }
  return { ice: 'Hielo', crate: 'Cajas', boss: 'Congelador', color: 'Frutas', token: 'Pruebas' }[g.type] || g.type;
});
const metaFalta = st.goals.findIndex((g, i) => pierde.metas_por_cascada[pierde.metas_por_cascada.length - 1][i] > 0);
const u = UNIDAD[(st.goals[metaFalta] || {}).type] || ['pieza', 'piezas', 'f'];
const villanos = (lv.villains && lv.villains.length ? lv.villains.map((v) => v.who) : [Story.villainFor(nivel)]).filter((x, i, a) => a.indexOf(x) === i);
const nGan = r.gana.length;
const D = {
  id, nivel, nombre: lv.name, semilla, politica: polTxt, prefijo: r.prefijo.length,
  tomas: { pierde: `${id}-pierde`, gana: `${id}-gana` },
  var: { pierde: `${nivel}:${semilla}:${polTxt}:pierde:${iP}`, gana: `${nivel}:${semilla}:${polTxt}:gana:${iG}` },
  indices: { pierde: iP, gana: iG },
  ganadoras_en_tablero: nGan,
  metas: st.goals.map((g, i) => ({ tipo: g.type, nombre: metasNombres[i], antes: g.remaining })),
  falta: { meta: metaFalta, n: pierde.faltan, unidad: pierde.faltan === 1 ? u[0] : u[1], genero: u[2],
    texto: '¡FALTÓ ' + (pierde.faltan === 1 ? (u[2] === 'f' ? 'UNA' : 'UN') : String(pierde.faltan)) + ' ' + (pierde.faltan === 1 ? u[0] : u[1]).toUpperCase() + '!' },
  frase_ganadoras: nGan === 1 ? 'La ÚNICA que ganaba' : `Había ${nGan} que ganaban`,
  villanos,
  pierde, gana,
  cta: nivel <= 10 ? 'JUEGA GRATIS' : 'EMPIEZA GRATIS',
};

// ---------- salida ----------
const salida = opt('--salida') || path.join(ROOT, 'tools/video/videos', id);
console.log(`${id}: nivel ${nivel} «${lv.name}», semilla ${semilla}, bot ${polTxt}, prefijo ${r.prefijo.length} jugadas`);
console.log(`  pierde[${iP}] r${jp.a.r}c${jp.a.c}↔r${jp.b.r}c${jp.b.c}: ${pierde.cascadas} cascadas, ${pierde.piezas} piezas${pierde.combo ? ', combo' : ''}, falta ${pierde.faltan} (${D.falta.unidad})` +
  (pierde.rescates.length ? `, rescata a ${pierde.rescates.join(', ')}` : '') + (pierde.quedan.length ? `; queda en ${pierde.quedan.map((q) => `r${q.r}c${q.c}`).join(', ')}` : ''));
console.log(`  gana[${iG}] r${jg.a.r}c${jg.a.c}↔r${jg.b.r}c${jg.b.c}: ${gana.cascadas} cascadas, ${gana.piezas} piezas${gana.combo ? ', combo' : ''}, especiales ${gana.especiales.join(' ') || '—'}` +
  (gana.rescates.length ? `, rescata a ${gana.rescates.join(', ')}` : ''));
console.log(`  ganan ${nGan} de ${r.gana.length + r.pierde.length} jugadas que se quedan cerca (${nGan === 1 ? '«la única»' : `«había ${nGan} jugadas que ganaban», nunca «la única»`}); villanos: ${villanos.join(', ')}`);
avisos.forEach((a) => console.log('  AVISO ' + a));
if (errores.length) { errores.forEach((e) => console.error('  ERROR ' + e)); process.exit(1); }
if (argv.includes('--seco')) process.exit(0);

fs.mkdirSync(salida, { recursive: true });
fs.writeFileSync(path.join(salida, 'casi.json'), JSON.stringify(D, null, 1) + '\n');
console.log(`  → ${path.relative(ROOT, path.join(salida, 'casi.json'))}`);

if (argv.includes('--guion')) {
  const g = path.join(salida, 'guion.json');
  if (fs.existsSync(g)) console.log(`  ${path.relative(ROOT, g)} ya existe: no lo toco`);
  else {
    let lote = (par.lineas || []).map((l) => ({ ...l, hueco: l.hueco || 'burla' }));
    if (!lote.length) {
      const b = par.burlas || (par.burla ? { [villanos[0]]: par.burla } : {});
      lote = Object.keys(b).map((q) => ({ quien: q, texto: b[q], emocion: 'carcajada', hueco: 'burla' }));
    }
    fs.writeFileSync(g, JSON.stringify(lote, null, 2) + '\n');
    console.log(`  → ${path.relative(ROOT, g)} (${lote.length} líneas; revisa que cada «texto» esté en js/story.js o lleve «nueva»)`);
  }
}
if (argv.includes('--montaje')) {
  const m = path.join(salida, 'montaje.js');
  if (fs.existsSync(m)) console.log(`  ${path.relative(ROOT, m)} ya existe: no lo toco`);
  else {
    const gch = String((ficha && ficha.gancho) || '').split(/(?<=[.!…])\s+(?=[¿¡A-ZÁÉÍÓÚÑ])/);
    fs.writeFileSync(m, `/* ${id} «${(ficha && ficha.titulo) || ''}» (formato F03, plantilla tools/video/formatos/F03/plantilla.js).
   Datos: tools/video/formatos/F03/generar.cjs ${id} → casi.json. Tomas: dist/cap/${id}-pierde y ${id}-gana. */
(function () {
  'use strict';
  var s = document.createElement('script');
  s.src = 'formatos/F03/plantilla.js';
  s.onerror = function () { window.__error = 'no se pudo cargar formatos/F03/plantilla.js'; };
  s.onload = function () {
    window.F03({
      datos: 'tools/video/videos/${id}/casi.json',
      guion: 'dist/estudio/voz/${id}.json',
      gancho: ${JSON.stringify(gch.length > 1 ? [gch[0], gch.slice(1).join(' ')] : [gch[0] || '', '¿Ves la jugada?'])},
    });
  };
  document.body.appendChild(s);
})();
`);
    console.log(`  → ${path.relative(ROOT, m)}`);
  }
}
const rel = path.relative(ROOT, salida);
console.log(`
Tomas (una a la vez, ~1,5 min y ~0,3 GB cada una):
  node tools/video/capturar.cjs tools/video/formatos/F03/tomas/casi.cjs dist/cap/${D.tomas.pierde} --var ${D.var.pierde}
  node tools/video/capturar.cjs tools/video/formatos/F03/tomas/casi.cjs dist/cap/${D.tomas.gana} --var ${D.var.gana}
Voces:
  python3 tools/video/voz/voz.py ${rel}/guion.json --revisar --salida dist/estudio/voz/${id} > dist/estudio/voz/${id}.json
Render y revisión:
  node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/${id}/montaje.js" dist/videos-mes/${id}-<slug>.mp4 --cap dist/cap --volumen ganancia --revisar --fotos 0
  node tools/video/revisar.cjs dist/videos-mes/${id}-<slug>.mp4 --breve --dir dist/estudio/revision/${id}`);
