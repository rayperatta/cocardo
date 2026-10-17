#!/usr/bin/env node
// F12 «Conoce a…»: de la ficha del calendario al guion, el montaje (borrador), la línea de tiempo y el texto del post.
// Uso (desde la raíz del repo):
//   node tools/video/formatos/F12/ficha.cjs lista                    fichas F12 del calendario (también las de alternativas)
//   node tools/video/formatos/F12/ficha.cjs guion <id>               tools/video/videos/<id>/guion.json = parametros.lineas tal cual
//   node tools/video/formatos/F12/ficha.cjs montaje <id> [--forzar]  borrador de tools/video/videos/<id>/montaje.js desde la ficha
//   node tools/video/formatos/F12/ficha.cjs tiempos <id>             línea de tiempo del montaje con las voces ya hechas (o
//                                                                   estimadas a 11,5 caracteres/s), clímax y avisos; sin renderizar
//   node tools/video/formatos/F12/ficha.cjs comandos <id>            voces, render, revisión y post, en orden
//   node tools/video/formatos/F12/ficha.cjs texto <id>               texto del post con sus hashtags
// --salida <dir> cambia la carpeta del montaje (para probar sin tocar tools/video/videos/<id>/).
// Calendario: tools/video/calendario/2026-10-19.json (otro con --calendario <ruta>).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const argv = process.argv.slice(2);
const iC = argv.indexOf('--calendario');
const CAL = iC >= 0 ? path.resolve(argv[iC + 1]) : path.join(ROOT, 'tools/video/calendario/2026-10-19.json');
const { tiempos, idDe } = require('./plantilla.js');

// fichas F12: los videos del formato y las ramas de alternativa que lo usan (D04-1 puede salir como F12)
function fichas() {
  const out = [];
  for (const v of JSON.parse(fs.readFileSync(CAL, 'utf8')).videos) {
    if (v.formato === 'F12') out.push(v);
    const alt = v.alternativa ? (Array.isArray(v.alternativa) ? v.alternativa : [v.alternativa]) : [];
    alt.forEach((r, i) => { if (r.formato === 'F12') out.push(Object.assign({ id: `${v.id}~${i + 1}`, rama_de: v.id }, r)); });
  }
  return out;
}
function ficha(id) {
  const f = fichas().find((v) => v.id === id);
  if (!f) { console.error(`no hay ficha F12 con id ${id} en ${path.relative(ROOT, CAL)} (lista: node tools/video/formatos/F12/ficha.cjs lista)`); process.exit(2); }
  return f;
}
const iS = argv.indexOf('--salida');   // otra carpeta para el montaje (pruebas): --salida <dir>
const dirDe = (id) => (iS >= 0 ? path.resolve(argv[iS + 1]) : path.join(ROOT, 'tools/video/videos', id.replace('~', '-rama')));
const VACIAS = new Set(['conoce', 'a', 'el', 'la', 'los', 'las', 'de', 'del', 'mi', 'tu', 'y', 'en']);
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !VACIAS.has(w)).slice(0, 2).join('-');
const MOODS = ['normal', 'feliz', 'triste', 'enojado', 'asustado', 'sorprendido', 'burlon', 'nervioso', 'furioso', 'carcajada', 'llorando', 'coqueta'];
const VICTIMAS = new Set(['lima', 'fresa', 'durazna', 'uva', 'naranja', 'banana']);
const VILLANOS = new Set(['cocardo', 'cereza', 'pina']);
// humor de reacción al terminar la línea (el de entrada es la emoción de la voz)
const REACCION = { lima: 'sorprendido', fresa: 'enojado', durazna: 'sorprendido', uva: 'nervioso', naranja: 'carcajada', banana: 'sorprendido',
  banano: 'sorprendido', pina: 'feliz', cereza: 'burlon', cocardo: 'carcajada', limon: 'burlon' };
const ACOMPANANTE = { pina: 'guardaespaldas' };   // solo si la idea lo pide («con el guardaespaldas detrás»)

// Gancho en dos líneas: la 1.ª ya se lee en el cuadro 0, la 2.ª salta a los 0,25 s
function partirGancho(g) {
  const m = g.match(/^(.+?[.?!…:])\s+(.+)$/);
  if (m && m[2].length <= 22) return [m[1], m[2]];
  return [g];
}
const humor = (e, def) => (MOODS.includes(e) ? e : def || 'normal');

// «… en el nivel 7.» / «… desde el nivel 16.» del post → banda de reto del último plano
function retoDe(f) {
  const m = String(f.texto_post || '').match(/([A-ZÁÉÍÓÚÑ¡¿][^.!?👇]*?)\s+((?:en|desde)\s+el\s+nivel\s+\d+)/);
  if (m) return { texto: m[1].trim(), sub: m[2] };
  return { texto: '¿Quién es tu favorito?', sub: 'comenta aquí abajo' };
}

function borrador(f) {
  const p = f.parametros || {}, L = p.lineas || [], gancho = partirGancho(f.gancho), nivel = (String(f.texto_post).match(/nivel (\d+)/) || [])[1];
  const o = { guion: `dist/estudio/voz/${f.id}.json`, gancho };
  if (p.secundarios_sin_cita) {
    // galería: un plano por línea (en su orden) y la ráfaga de los que no hablan
    o.contador = L.length + p.secundarios_sin_cita.length;
    o.planos = L.map((l) => {
      const id = idDe(l.quien), pl = { id, humores: [humor(l.emocion, 'normal'), REACCION[id] || 'feliz'] };
      if (VICTIMAS.has(id)) pl.vic = true;
      if (VILLANOS.has(id)) { pl.villano = true; pl.entrada = id === 'pina' ? 'golpe' : 'villain'; }
      if (id === 'cereza') pl.tan = true;
      if (id === 'cocardo') { pl.risa = true; pl.humores = [humor(l.emocion, 'burlon')]; }
      if (id === 'naranja' && /panecitos/i.test(l.texto)) pl.ret = { variant: 'panecitos' };
      return pl;
    });
    if (!o.planos.some((x) => x.tan) && o.planos.length) o.planos[Math.min(o.planos.length - 1, Math.round(o.planos.length * 0.75))].tan = true;
    o.rafaga = p.secundarios_sin_cita.map((id) => ({ id, tag: (p.etiquetas || {})[id] }));
    o.cierre = { texto: '¿Cuántos reconociste?', sub: 'comenta tu número', dur: 1.25 };
  } else {
    // uno: humores con pop y zoom, sus líneas (el clímax con el ¡TAN-TAN-TAAAN!) y un plano de reto antes de la tarjeta
    const prota = idDe(p.personaje), hs = (p.humores || ['normal']).slice(), planos = [];
    const ultimaProta = L.map((l) => idDe(l.quien)).lastIndexOf(prota);
    let h = 0;
    const sig = () => hs[h++ % hs.length];
    if (L.length <= 1) {
      // una sola línea (la cita): un humor cada ~1,5 s y la cita al final
      for (let i = 0; i < Math.max(1, hs.length - 2); i++) planos.push({ id: prota, humores: [sig()], linea: false, dur: 1.5 });
    }
    L.forEach((l, i) => {
      const id = idDe(l.quien), pl = { id, linea: i };
      pl.humores = id === prota ? [sig()] : [humor(l.emocion, 'normal')];   // la protagonista recorre los humores de la ficha
      if (id === prota && i === ultimaProta) { pl.humores.push(h < hs.length ? sig() : REACCION[id] || 'feliz'); pl.tan = true; }
      if (VILLANOS.has(id) && id !== prota) pl.villano = true;
      planos.push(pl);
    });
    if (ACOMPANANTE[prota] && new RegExp(ACOMPANANTE[prota]).test(f.idea || '')) planos.filter((x) => x.id === prota).forEach((x) => { x.acompanante = { id: ACOMPANANTE[prota], humor: 'normal' }; });
    planos.push({ id: prota, humores: [hs[0]], linea: false, dur: 1.3, reto: retoDe(f) });
    o.planos = planos;
  }
  o.tarjeta = { cta: nivel && +nivel <= 10 && !/empieza gratis/i.test(f.texto_post) ? 'JUEGA GRATIS' : 'EMPIEZA GRATIS', sub: 'link en el perfil', pie: 'cocardo.app' };
  o.musica = f.musica === 'drama' || f.musica === 'calma' ? f.musica : 'tema';
  return o;
}

// lee los parámetros que un montaje.js le pasa a window.F12 (sin navegador)
function parametros(id) {
  const file = path.join(dirDe(id), 'montaje.js');
  if (!fs.existsSync(file)) { console.error(`no existe ${path.relative(ROOT, file)} (node tools/video/formatos/F12/ficha.cjs montaje ${id})`); process.exit(1); }
  let el = null, P = null;
  const ctx = { window: {}, document: { createElement: () => (el = {}), body: { appendChild() {} } } };
  ctx.window.F12 = (p) => { P = p; };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx);
  if (el && el.onload) el.onload();
  if (!P) { console.error(`${path.relative(ROOT, file)} no llama a window.F12`); process.exit(1); }
  return P;
}
function lineasDe(P, id) {
  const voz = typeof P.guion === 'string' ? path.join(ROOT, P.guion) : null;
  if (voz && fs.existsSync(voz)) return { lineas: JSON.parse(fs.readFileSync(voz, 'utf8')).lineas, real: true };
  const g = path.join(dirDe(id), 'guion.json');
  return { lineas: fs.existsSync(g) ? JSON.parse(fs.readFileSync(g, 'utf8')) : (ficha(id).parametros || {}).lineas || [], real: false };
}

const cmd = argv[0];
if (cmd === 'lista') {
  for (const f of fichas()) console.log(`${f.id.padEnd(8)} ${f.fecha || ''} ${f.titulo} — «${f.gancho}» (${(f.parametros && f.parametros.lineas || []).length} líneas, ${f.duracion_s} s)`);
} else if (cmd === 'guion') {
  const f = ficha(argv[1]), dir = dirDe(f.id), out = path.join(dir, 'guion.json');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(out, JSON.stringify((f.parametros || {}).lineas || [], null, 2) + '\n');
  console.log(`${path.relative(ROOT, out)}: ${((f.parametros || {}).lineas || []).length} líneas (parametros.lineas tal cual)`);
} else if (cmd === 'montaje') {
  const f = ficha(argv[1]), dir = dirDe(f.id), out = path.join(dir, 'montaje.js');
  if (fs.existsSync(out) && !argv.includes('--forzar')) { console.error(`ya existe ${path.relative(ROOT, out)} (--forzar lo pisa)`); process.exit(1); }
  const o = borrador(f);
  const js = `/* ${f.id} «${f.titulo}» (F12) con tools/video/formatos/F12/plantilla.js. Borrador hecho con
   node tools/video/formatos/F12/ficha.cjs montaje ${f.id}  (retócalo: humores, textos, dato, tan.palabra, reto…;
   la línea de tiempo se mira con: node tools/video/formatos/F12/ficha.cjs tiempos ${f.id})
   Idea: ${String(f.idea || '').replace(/\*\//g, '*∕')} */
(function () {
  'use strict';
  var s = document.createElement('script');
  s.src = 'formatos/F12/plantilla.js';
  s.onerror = function () { window.__error = 'no se pudo cargar formatos/F12/plantilla.js'; };
  s.onload = function () {
    window.F12(${JSON.stringify(o, null, 2).replace(/\n/g, '\n    ')});
  };
  document.body.appendChild(s);
})();
`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(out, js);
  console.log(`${path.relative(ROOT, out)} listo (borrador). Siguiente: node tools/video/formatos/F12/ficha.cjs comandos ${f.id}`);
} else if (cmd === 'tiempos') {
  const id = argv[1], P = parametros(id), { lineas, real } = lineasDe(P, id);
  let T;
  try { T = tiempos(P, lineas); } catch (e) { console.error(String(e.message || e)); process.exit(1); }
  console.log(`${id}: voces ${real ? 'reales (' + P.guion + ')' : 'estimadas a 11,5 caracteres/s (faltan las de voz.py)'}`);
  for (const p of T.planos) {
    const voz = p.voz ? `voz ${p.voz[0].toFixed(2)}-${p.voz[1].toFixed(2)}` : 'mudo';
    const extra = [p.vic ? `hielo ${p.hielo.toFixed(2)}` : '', p.tanT != null ? `¡TAN! ${p.tanT.toFixed(2)}` : '', p.risaT != null ? `risa ${p.risaT.toFixed(2)}` : '',
      p.n ? `${p.n}/${P.contador}` : '', p.cambios.map((c) => c.humor).join('→')].filter(Boolean).join(' · ');
    console.log(`  ${p.t0.toFixed(2).padStart(6)}-${p.t1.toFixed(2).padEnd(6)} ${p.id.padEnd(15)} ${voz.padEnd(15)} ${extra}`);
  }
  if (T.R) console.log(`  ${T.R.t0.toFixed(2).padStart(6)}-${T.R.t1.toFixed(2).padEnd(6)} ráfaga (${T.R.items.length})`);
  if (T.Ci) console.log(`  ${T.Ci.t0.toFixed(2).padStart(6)}-${T.Ci.t1.toFixed(2).padEnd(6)} cierre`);
  console.log(`  ${T.Tj.t0.toFixed(2).padStart(6)}-${T.Tj.t1.toFixed(2).padEnd(6)} tarjeta`);
  console.log(`duración ${T.DUR.toFixed(2)} s; clímax ${T.climax != null ? T.climax.toFixed(2) + ' s (' + Math.round(100 * T.climax / T.DUR) + ' %)' : '—'}`);
  T.avisos.forEach((a) => console.log('AVISO: ' + a));
  process.exit(T.avisos.length ? 1 : 0);
} else if (cmd === 'comandos') {
  const f = ficha(argv[1]), s = `${f.id}-${slug(f.titulo)}`;
  console.log(`node tools/video/formatos/F12/ficha.cjs guion ${f.id}
mkdir -p dist/estudio/voz
python3 tools/video/voz/voz.py tools/video/videos/${f.id}/guion.json --revisar --salida dist/estudio/voz/${f.id} > dist/estudio/voz/${f.id}.json
node tools/video/formatos/F12/ficha.cjs montaje ${f.id}      # borrador; retócalo y mira la línea de tiempo:
node tools/video/formatos/F12/ficha.cjs tiempos ${f.id}
node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/${f.id}/montaje.js" dist/videos-mes/${s}.mp4 --cap dist/cap --volumen ganancia --revisar --fotos 0,0.5,1
node tools/video/revisar.cjs dist/videos-mes/${s}.mp4 --breve --dir dist/estudio/revision/${f.id}
~/.local/share/cocardo-estudio/voz-whisper/bin/python tools/video/voz/revisar_voz.py dist/videos-mes/${s}.mp4 --guion dist/estudio/voz/${f.id}.json
node tools/video/formatos/F12/ficha.cjs texto ${f.id} > dist/videos-mes/${s}.txt`);
} else if (cmd === 'texto') {
  const f = ficha(argv[1]);
  console.log(`${f.texto_post}\n\n${(f.hashtags || []).join(' ')}`);
} else {
  console.error('comandos: lista | guion <id> | montaje <id> [--forzar] | tiempos <id> | comandos <id> | texto <id>');
  process.exit(2);
}
