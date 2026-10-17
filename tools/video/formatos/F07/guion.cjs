#!/usr/bin/env node
// F07 · Telenovela: de la ficha del calendario al guion (lote de voces) y, si se pide, al esqueleto del montaje.
// Uso: node tools/video/formatos/F07/guion.cjs <id> [--rama N] [--montaje] [--dir carpeta] [--calendario tools/video/calendario/AAAA-MM-DD.json]
//   --rama N: la alternativa N (1, 2, 3…; como voz.py --rama). Sin --rama, el plan normal.
//   Escribe tools/video/videos/<id>/guion.json (parametros.lineas tal cual: es el lote de tools/video/voz/voz.py) e imprime
//   las tomas que faltan en dist/cap/ y los comandos de voces, render y revisión.
//   --montaje: además escribe tools/video/videos/<id>/montaje.js (si no existe) con un plano de historia por línea (el
//   segundo exacto de cada línea sale de las marcas de la toma hist-<escena>), el tramo de nivel, CONTINUARÁ… y la tarjeta.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const argv = process.argv.slice(2);
const id = argv.find((a) => /^D\d\d-\d$/.test(a));
if (!id) { console.error('uso: guion.cjs <id> [--rama N] [--montaje]'); process.exit(1); }
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const rama = +(opt('--rama') || 0);
const calRuta = opt('--calendario') || path.join(ROOT, 'tools/video/calendario',
  fs.readdirSync(path.join(ROOT, 'tools/video/calendario')).filter((f) => /^20.*\.json$/.test(f)).sort().pop());
const cal = JSON.parse(fs.readFileSync(calRuta, 'utf8'));
const v = cal.videos.find((x) => x.id === id);
if (!v) { console.error(`no existe ${id} en ${calRuta}`); process.exit(1); }
const ramas = [v].concat(Array.isArray(v.alternativa) ? v.alternativa : v.alternativa ? [v.alternativa] : []);
const f = ramas[rama];
if (!f) { console.error(`${id} no tiene la rama ${rama} (tiene ${ramas.length - 1} alternativas)`); process.exit(1); }
if (f.formato !== 'F07') console.warn(`ojo: ${id}${rama ? ' rama ' + rama : ''} es ${f.formato}, no F07`);
const par = f.parametros || {};
if (v.condicion && !rama) console.warn(`ojo: ${id} es condicional («${v.condicion}»): comprueba la condición antes (plan.condiciones del calendario)`);
if ((par.escenas_por_escribir || []).length) console.warn(`ojo: faltan escenas por escribir en js/story.js: ${par.escenas_por_escribir.join(', ')} — no se puede producir todavía`);

const dir = opt('--dir') ? path.resolve(opt('--dir')) : path.join(ROOT, 'tools/video/videos', id);   // --dir: otra carpeta (pruebas)
fs.mkdirSync(dir, { recursive: true });
const lineas = (par.lineas || []).map((l) => Object.assign({}, l));
fs.writeFileSync(path.join(dir, 'guion.json'), JSON.stringify(lineas, null, 2) + '\n');
console.log(`${path.relative(ROOT, path.join(dir, 'guion.json'))}: ${lineas.length} líneas, ${lineas.reduce((n, l) => n + l.texto.length, 0)} caracteres`);

// tomas: hist-<escena> por cada escena con líneas y las de nivel que trae la ficha («nivel 5 (nivel.cjs --var 5:1:0:5:30)»)
const cap = path.join(ROOT, 'dist/cap');
const existe = (n) => fs.existsSync(path.join(cap, n, 'toma.json'));
const escenas = [...new Set(lineas.map((l) => l.escena).filter(Boolean))];
const tomas = {}, faltan = [];
escenas.forEach((e) => {
  const n = existe(`hist-${e}`) ? `hist-${e}` : `${id}-hist-${e}`;
  tomas['h_' + e] = n;
  if (!existe(n)) faltan.push(`node tools/video/capturar.cjs tools/video/tomas/historia.cjs dist/cap/${n} --var ${e}`);
});
let nivel = null;
(par.tomas || []).forEach((t) => {
  const m = /nivel\s+(\d+)\s*\(nivel\.cjs --var ([\d:]+)\)/.exec(t);
  if (m) {
    const n = existe(`nivel${m[2].replace(/:/g, '-')}`) ? `nivel${m[2].replace(/:/g, '-')}` : `${id}-nivel${m[1]}`;
    tomas.nivel = n; nivel = { n: +m[1], var: m[2] };
    if (!existe(n)) faltan.push(`node tools/video/capturar.cjs tools/video/tomas/nivel.cjs dist/cap/${n} --var ${m[2]}`);
  } else if (!/^hist-/.test(t) && !/^nivel/.test(t)) {
    tomas[t.replace(/[^\w]/g, '')] = t;
    if (!existe(t)) faltan.push(`(toma ${t}: ver tools/video/datos/tomas.cjs)`);
  }
});
if (faltan.length) console.log('\nTomas que faltan:\n  ' + faltan.join('\n  '));

console.log(`\nVoces:\n  python3 tools/video/voz/voz.py tools/video/videos/${id}/guion.json --revisar --salida dist/estudio/voz/${id} > dist/estudio/voz/${id}.json`);
console.log(`Vista rápida:\n  node tools/video/formatos/F07/fotos.cjs "tools/video/montaje.html?m=videos/${id}/montaje.js" dist/estudio/${id}/vista 0,0.5,1,10 --wav`);
console.log(`Render:\n  node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/${id}/montaje.js" dist/videos-mes/${id}-<slug>.mp4 --cap dist/cap --volumen ganancia --revisar --fotos 0,0.5,1`);
console.log(`Voz de la mezcla:\n  ~/.local/share/cocardo-estudio/voz-whisper/bin/python tools/video/voz/revisar_voz.py dist/videos-mes/${id}-<slug>.mp4 --guion dist/estudio/voz/${id}.json`);

if (!argv.includes('--montaje')) process.exit(0);
const salida = path.join(dir, 'montaje.js');
if (fs.existsSync(salida)) { console.log(`\n${path.relative(ROOT, salida)} ya existe: no lo toco`); process.exit(0); }

// segundo de cada línea en su toma de historia (marcas «linea» de toma.json)
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
function srcDe(l) {
  const n = tomas['h_' + l.escena];
  if (!n || !existe(n)) return null;
  const j = JSON.parse(fs.readFileSync(path.join(cap, n, 'toma.json'), 'utf8'));
  const a = norm(l.texto);
  const m = (j.marcas || []).find((x) => x.nombre === 'linea' && x.datos && (norm(x.datos.text).includes(a) || a.includes(norm(x.datos.text))));
  return m ? Math.max(0, +(m.t - 0.05).toFixed(2)) : null;
}
// ritmo de la música del formato (drama) para que los cortes caigan en el golpe
let ritmo = { bpm: 90, desde: 0 };
const r = spawnSync('python3', [path.join(__dirname, 'ritmo.py'), f.musica === 'tema' ? 'tema' : 'drama'], { encoding: 'utf8' });
try { ritmo = JSON.parse(r.stdout); } catch (e) { console.warn('ritmo.py no respondió: bpm 90 y desde 0 (corrígelo a mano)'); }

// gancho en dos líneas parejas (sin «Ep. N», que va en su placa), sin dejar «el», «de»… al final de la primera
let gancho = String(f.gancho || '').replace(new RegExp('^' + (par.rotulo || '@@').replace('.', '\\.') + ':?\\s*'), '');
gancho = gancho.replace(/^([¿¡«]*)(\p{Ll})/u, (m, a, b) => a + b.toUpperCase());
const pal = gancho.split(' ');
let mitad = 1, mejor = Infinity;
for (let k = 1; k < pal.length; k++) {
  const izq = pal.slice(0, k).join(' ').length, der = pal.slice(k).join(' ').length;
  const coste = Math.abs(izq - der) + (/^(el|la|los|las|un|una|de|del|en|a|al|y|o|que|con|por|para|tu|su|mi)$/i.test(pal[k - 1]) ? 100 : 0);
  if (coste < mejor) { mejor = coste; mitad = k; }
}
const L = [];
const q = (s) => JSON.stringify(s);
L.push(`/* ${id} · F07 Telenovela: ${f.titulo}. Esqueleto generado por tools/video/formatos/F07/guion.cjs: ajusta src, cámaras,`);
L.push(`   textos y el tramo de juego mirando la vista rápida (fotos.cjs). Gancho: «${f.gancho}». */`);
L.push('(function () {');
L.push("  'use strict';");
L.push('  var C = window.K.C;');
L.push('  var P = {');
L.push(`    voz: 'dist/estudio/voz/${id}.json',`);
L.push(`    tomas: ${JSON.stringify(tomas)},`);
L.push(`    musica: { tipo: ${q(f.musica === 'tema' ? 'tema' : 'drama')}, bpm: ${ritmo.bpm}, desde: ${ritmo.desde}, gain: 3.0, bucle: 'tarjeta' },`);
if (par.rotulo) L.push(`    rotulo: ${q(par.rotulo)},`);
L.push(`    gancho: { lineas: [${q(pal.slice(0, mitad).join(' '))}, ${q(pal.slice(mitad).join(' '))}] },`);
L.push('    planos: [');
let primero = true, nivelPuesto = !nivel;
lineas.forEach((l, i) => {
  // el tramo de nivel va antes de la primera línea de una escena posterior al nivel (post/cliff) o al final
  if (!nivelPuesto && /^(post|cliff)/.test(l.escena || '')) {
    L.push(`      { id: 'juego', toma: 'nivel', src: 0, b: 10, pulso: 0.02, contador: { evento: 'match' }, textos: [{ s: ${q('Nivel ' + nivel.n)}, en: 0.05 }] },   // TODO: tramo real con plan.cjs`);
    nivelPuesto = true;
  }
  const s = srcDe(l);
  L.push(`      { id: ${q('l' + (i + 1))}, toma: ${q('h_' + l.escena)}, src: ${s == null ? '0 /* TODO: segundo de la línea */' : s}, voz: ${i}, historia: true${primero ? '' : ''} },   // ${l.quien}: ${l.texto}`);
  primero = false;
});
if (!nivelPuesto) L.push(`      { id: 'juego', toma: 'nivel', src: 0, b: 10, pulso: 0.02, contador: { evento: 'match' } },   // TODO: tramo real con plan.cjs`);
const tarjeta = par.tarjeta && par.tarjeta !== 'CONTINUARÁ…' ? par.tarjeta : null;
L.push(`      { id: 'continua', toma: ${q('h_' + (lineas.length ? lineas[lineas.length - 1].escena : ''))}, src: 0, b: 2, continua: true },   // TODO: si la escena trae su CONTINUARÁ…, úsalo (continua: false)`);
const cta = nivel && nivel.n <= 10 ? 'JUEGA GRATIS' : 'EMPIEZA GRATIS';
L.push(`      { id: 'tarjeta', d: 1.0, tarjeta: { cta: ${q(cta)}, sub: 'link en el perfil', pie: 'cocardo.app'${tarjeta ? ', linea: ' + q(tarjeta) : ''} } },`);
L.push('    ],');
L.push('  };');
L.push("  var s = document.createElement('script');");
L.push("  s.src = 'formatos/F07/plantilla.js';");
L.push('  s.onload = function () { window.F07(P); };');
L.push("  s.onerror = function () { window.__error = 'no se pudo cargar formatos/F07/plantilla.js'; };");
L.push('  document.body.appendChild(s);');
L.push('})();');
fs.writeFileSync(salida, L.join('\n') + '\n');
console.log(`\n${path.relative(ROOT, salida)}: esqueleto con ${lineas.length} planos de voz`);
