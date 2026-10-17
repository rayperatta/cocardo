#!/usr/bin/env node
// F01 «¿Cuántas cascadas?»: de la ficha del calendario a la toma, el montaje y el texto del post.
// Uso (desde la raíz del repo):
//   node tools/video/formatos/F01/ficha.cjs verificar            cada ficha F01 contra el motor (cascadas, piezas, especiales)
//   node tools/video/formatos/F01/ficha.cjs conteo [5000]        aperturas probadas en los niveles 1-30 y la mejor (gancho del D01-1)
//   node tools/video/formatos/F01/ficha.cjs toma <id>            comando de captura de su toma (dist/cap/<id>-cascada)
//   node tools/video/formatos/F01/ficha.cjs montaje <id> [--forzar] [--salida <dir>]   escribe tools/video/videos/<id>/montaje.js
//   node tools/video/formatos/F01/ficha.cjs texto <id>           texto del post con sus hashtags (para dist/videos-mes/<id>-<slug>.txt)
// Calendario: tools/video/calendario/2026-10-19.json (otro con --calendario <ruta>).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const argv = process.argv.slice(2);
const iC = argv.indexOf('--calendario');
const CAL = iC >= 0 ? path.resolve(argv[iC + 1]) : path.join(ROOT, 'tools/video/calendario/2026-10-19.json');

function fichas() { return JSON.parse(fs.readFileSync(CAL, 'utf8')).videos.filter((v) => v.formato === 'F01'); }
function ficha(id) {
  const f = fichas().find((v) => v.id === id);
  if (!f) { console.error(`no hay ficha F01 con id ${id} en ${path.relative(ROOT, CAL)}`); process.exit(2); }
  return f;
}
const celda = (x) => `${x.r},${x.c}`;
const miles = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');   // 1.220.992, como en los ganchos
function variante(f) {
  const p = f.parametros;
  return `${p.nivel}:${p.semilla}:${celda(p.jugada.a)}:${celda(p.jugada.b)}` + (p.despues || []).map((j) => `:${celda(j.a)}:${celda(j.b)}`).join('');
}

// La jugada con el motor del juego (lo mismo que verá la toma)
function comprobar(f) {
  const P = require(path.join(ROOT, 'tools/video/plan.cjs'));
  const Engine = require(path.join(ROOT, 'js/core/engine.js'));
  const p = f.parametros;
  const res = Engine.applySwap(Engine.createGame(P.nivel(p.nivel), p.semilla), p.jugada.a, p.jugada.b);
  const r = P.resumenJugada(res), fallas = [];
  if (p.cascadas != null && r.cascadas !== p.cascadas) fallas.push(`cascadas ${r.cascadas} (ficha ${p.cascadas})`);
  if (p.piezas != null && r.piezas !== p.piezas) fallas.push(`piezas ${r.piezas} (ficha ${p.piezas})`);
  if (p.especiales) {
    const cuenta = (l) => l.reduce((o, k) => ((o[k] = (o[k] || 0) + 1), o), {});
    const a = cuenta(r.especiales), b = cuenta(p.especiales);
    for (const k of Object.keys(b)) if ((a[k] || 0) < b[k]) fallas.push(`especial ${k} x${b[k]} (el motor crea ${JSON.stringify(r.especiales)})`);
  }
  return { r, fallas, res };
}

// Gancho en dos líneas: la 1.ª ya se lee en el cuadro 0, la 2.ª entra palabra a palabra
function partirGancho(g) {
  const m = g.match(/^(.+?[.?!…])\s+(.+)$/);
  if (m && m[1].length <= 30 && m[2].length <= 30) return [m[1], m[2]];
  const pal = g.split(/\s+/);
  let mejor = [g], dif = Infinity;
  for (let i = 1; i < pal.length; i++) {
    const a = pal.slice(0, i).join(' '), b = pal.slice(i).join(' '), d = Math.abs(a.length - b.length);
    if (d < dif && !/^[¿¡]/.test(pal[i - 1])) { dif = d; mejor = [a, b]; }
  }
  return mejor;
}

const cmd = argv[0];
if (cmd === 'verificar') {
  let malas = 0;
  for (const f of fichas()) {
    const { r, fallas } = comprobar(f);
    if (fallas.length) malas++;
    console.log(`${fallas.length ? 'FALLA' : 'ok   '} ${f.id} nivel ${f.parametros.nivel}, semilla ${f.parametros.semilla}: ${r.cascadas} cascadas, ${r.piezas} piezas, ${JSON.stringify(r.especiales)}${fallas.length ? ' → ' + fallas.join('; ') : ''}`);
  }
  console.log(malas ? `${malas} fichas ya no cuadran: busca otra jugada con node tools/video/plan.cjs cascadas <nivel>` : 'todas las fichas F01 cuadran con el motor');
  process.exit(malas ? 1 : 0);
} else if (cmd === 'conteo') {
  // «Probé N jugadas… y esta fue la MEJOR»: todas las aperturas de los niveles 1-30 con las semillas 1..S
  const P = require(path.join(ROOT, 'tools/video/plan.cjs'));
  const Engine = require(path.join(ROOT, 'js/core/engine.js'));
  const S = +argv[1] || 5000;
  let total = 0, max = 0, mejores = [];
  for (let id = 1; id <= 30; id++) {
    const lv = P.nivel(id);
    for (let seed = 1; seed <= S; seed++) {
      const s = Engine.createGame(lv, seed);
      for (const m of Engine.validMoves(s)) {
        total++;
        const c = Engine.applySwap(s, m.a, m.b).turnInfo.cascades;
        if (c > max) { max = c; mejores = []; }
        if (c >= max - 2) mejores.push({ nivel: id, semilla: seed, a: m.a, b: m.b, cascadas: c });
      }
    }
    process.stderr.write(`\rnivel ${id}/30: ${miles(total)} aperturas`);
  }
  mejores = mejores.filter((x) => x.cascadas >= max - 2).sort((a, b) => b.cascadas - a.cascadas).slice(0, 8);
  console.log(`\n${miles(total)} aperturas (niveles 1-30, semillas 1-${S}); máximo ${max} cascadas`);
  for (const x of mejores) console.log(`  ${x.cascadas} cascadas: nivel ${x.nivel}, semilla ${x.semilla}, ${celda(x.a)} ↔ ${celda(x.b)}`);
} else if (cmd === 'toma') {
  const f = ficha(argv[1]);
  console.log(`node tools/video/capturar.cjs tools/video/formatos/F01/tomas/cascada.cjs dist/cap/${f.id}-cascada --var ${variante(f)}`);
} else if (cmd === 'montaje') {
  const f = ficha(argv[1]), p = f.parametros, { r, fallas } = comprobar(f);
  if (fallas.length) { console.error(`${f.id} no cuadra con el motor: ${fallas.join('; ')}`); process.exit(1); }
  const iS = argv.indexOf('--salida');
  const dir = iS >= 0 ? path.resolve(argv[iS + 1]) : path.join(ROOT, 'tools/video/videos', f.id), out = path.join(dir, 'montaje.js');
  if (fs.existsSync(out) && !argv.includes('--forzar')) { console.error(`ya existe ${path.relative(ROOT, out)} (--forzar lo pisa)`); process.exit(1); }
  const g = partirGancho(f.gancho), tapado = (p.contador || 'tapado') !== 'vista';
  const o = {
    toma: `${f.id}-cascada`, nivel: p.nivel, cascadas: r.cascadas, contador: tapado ? 'tapado' : 'vista', gancho: g,
    ganchoSub: /nivel/i.test(f.gancho) ? 'una sola jugada' : `NIVEL ${p.nivel} · una sola jugada`,
  };
  const js = `/* ${f.id} «${f.titulo}» (F01) con tools/video/formatos/F01/plantilla.js. Hecho con
   node tools/video/formatos/F01/ficha.cjs montaje ${f.id}  (retócalo a mano: gancho, reto, tramos…)
   Toma: ${`node tools/video/capturar.cjs tools/video/formatos/F01/tomas/cascada.cjs dist/cap/${f.id}-cascada --var ${variante(f)}`}
   Motor: ${r.cascadas} cascadas, ${r.piezas} piezas, especiales ${JSON.stringify(r.especiales)}. */
(function () {
  'use strict';
  var s = document.createElement('script');
  s.src = 'formatos/F01/plantilla.js';
  s.onerror = function () { window.__error = 'no se pudo cargar formatos/F01/plantilla.js'; };
  s.onload = function () {
    F01.montar(${JSON.stringify(o, null, 2).replace(/\n/g, '\n    ')});
  };
  document.body.appendChild(s);
})();
`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(out, js);
  console.log(`${path.relative(ROOT, out)} listo. Siguiente:\n  ${`node tools/video/capturar.cjs tools/video/formatos/F01/tomas/cascada.cjs dist/cap/${f.id}-cascada --var ${variante(f)}`}\n  node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/${f.id}/montaje.js" dist/videos-mes/${f.id}-<slug>.mp4 --cap dist/cap --volumen ganancia --revisar`);
} else if (cmd === 'texto') {
  const f = ficha(argv[1]);
  console.log(`${f.texto_post}\n\n${f.hashtags.join(' ')}`);
} else {
  console.error('comandos: verificar | conteo [semillas] | toma <id> | montaje <id> [--forzar] | texto <id>');
  process.exit(2);
}
