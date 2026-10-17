#!/usr/bin/env node
// Valida el calendario de videos contra el juego y contra sus propias reglas.
// Uso: node tools/video/calendario/validar.cjs [calendario.json] [--rapido]
//      node tools/video/calendario/validar.cjs --reto AAAAMMDD   datos del Reto de ese día (para cambiar un video)
//      node tools/video/calendario/validar.cjs --voz             voz estimada de cada video (y de cada rama) frente a duracion_s
//   --rapido: no vuelve a jugar con el motor (Retos, acertijos, cascadas, rescates, últimos movimientos).
// Revisa: 90 videos, 3 por día y en orden; horas de México y de Lisboa (con el cambio de hora del 25 de octubre);
// en cada combinación posible de condiciones (capítulo 7 a tiempo, corrido al 6 de noviembre o sin fecha; capítulo 8,
// GA4, comentarios, ranking): ningún formato dos veces el mismo día, ninguno más de 2 días seguidos en la misma franja
// y ganchos distintos (con avisos si un formato sale 3 días seguidos o más de 4 veces en una semana); ganchos de 9
// palabras o menos; los 13 videos que ya existen, una vez cada uno; escenas de js/story.js y niveles de
// js/core/levels.js que existan; que cada línea de «lineas» esté en js/story.js (o lleve «nueva») y que la voz quepa
// en la duración (11,5 caracteres por segundo, la voz más lenta medida); personajes con voz en
// tools/video/voz/voces.json; textos sin frases prohibidas ni vetadas y con una pregunta; fechas solo en videos y ramas
// que dependen de un despliegue oculto; y, con el motor, que cada cifra siga siendo cierta (los Retos cambian si un lunes
// se toca un nivel del 6 al 25). Sale con 1 si hay errores; los avisos no cuentan como error.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const args = process.argv.slice(2);
const RAPIDO = args.includes('--rapido') || args.includes('--voz');
const VOZ = args.includes('--voz');
const iReto = args.indexOf('--reto');
const archivo = path.resolve(args.find((a, i) => !a.startsWith('--') && !(iReto >= 0 && i === iReto + 1)) || path.join(__dirname, '2026-10-19.json'));

const Story = require(path.join(ROOT, 'js/story.js'));
const Levels = require(path.join(ROOT, 'js/core/levels.js'));

// ---------- el Reto de un día, con el mismo bot que el resto del calendario ----------
function jugarReto(clave, peek) {
  const Engine = require(path.join(ROOT, 'js/core/engine.js'));
  const Daily = require(path.join(ROOT, 'js/core/daily.js'));
  const Sim = require(path.join(ROOT, 'tools/sim.js'));
  const lv = Daily.levelFor(clave, Levels.list);
  let s = Engine.createGame(lv, Daily.seedFor(clave));
  const W0 = Sim.goalWork(s).map((x) => Math.max(1, x));
  const t = [];
  while (s.status === 'playing') {
    const mv = Engine.validMoves(s);
    if (!mv.length) break;
    const m = Sim.goalAwareMove(s, mv, W0, peek);
    const r = Engine.applySwap(s, m.a, m.b);
    t.push(r.turnInfo); s = r.state;
  }
  const gano = s.status === 'won';
  return { lv, gano, sobran: gano ? s.wonMovesLeft : 0, emojis: t.map(Daily.moveEmoji).join('') };
}
const txtReto = (r) => (!r.gano ? 'perdió' : r.sobran === 0 ? 'ganó en el último movimiento' : `ganó con ${r.sobran} de sobra`);
const numReto = (fecha) => Math.round((Date.parse(fecha + 'T00:00:00Z') - Date.UTC(2026, 9, 1)) / 864e5) + 1;

if (iReto >= 0) {
  const clave = Number(args[iReto + 1]);
  if (!/^\d{8}$/.test(String(clave))) { console.error('Uso: --reto AAAAMMDD'); process.exit(2); }
  const fecha = `${String(clave).slice(0, 4)}-${String(clave).slice(4, 6)}-${String(clave).slice(6)}`;
  const h = jugarReto(clave, false), e = jugarReto(clave, true);
  console.log(JSON.stringify({ reto: numReto(fecha), clave, nivel: h.lv.id, nombre_nivel: h.lv.name, movimientos: h.lv.moves,
    bot_honesto: txtReto(h), bot_que_ve_relleno: txtReto(e), emojis_bot_honesto: h.emojis }, null, 2));
  process.exit(0);
}

const cal = JSON.parse(fs.readFileSync(archivo, 'utf8'));
const formatos = JSON.parse(fs.readFileSync(path.join(__dirname, 'formatos.json'), 'utf8'));
const voces = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/video/voz/voces.json'), 'utf8'));

const errores = [], avisos = [];
const E = (id, m) => errores.push(`${id}: ${m}`);
const A = (id, m) => avisos.push(`${id}: ${m}`);

const FORMATOS = new Set(formatos.formatos.map((f) => f.id));
const MUSICA = new Set(Object.keys(formatos.musica_grupos));
const ESCENAS = new Set(Object.keys(Story.scripts));
const NIVELES = new Set(Levels.list.map((l) => l.id));
const PERSONAJES = new Set(Story.album.map((a) => a.id).concat(['narrador']));
const CON_VOZ = new Set(Object.keys(voces.personajes || {}));
const EMOCIONES = new Set(Object.keys(voces.emociones || {}));
const EXISTENTES = ['01-asi-suena-cocardo.mp4', '02-trailer.mp4', '03-mejor-jugada.mp4', '04-acertijo-abc.mp4', '05-perdi-por-uno.mp4',
  '06-congelador.mp4', '07-personajes.mp4', '08-combos.mp4', '09-traicion-cherry.mp4', '10-ultimo-movimiento.mp4',
  '11-rescate-6-de-6.mp4', '12-asmr-hielo.mp4', '13-nivel-final.mp4'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const FRANJAS = ['mañana', 'tarde', 'noche'];
// Texto público (gancho, título, texto del post): lo que nunca se dice
const PROHIBIDAS = [/juego de fans/i, /no oficial/i, /100\s?%\s?gratis/i, /todo gratis/i, /gratis en la web/i];
// Líneas de js/story.js que rompen el ángulo de rescate (docs/videos/CALENDARIO-VIDEOS.md §6)
const VETADAS = [/es orgánico/i, /raspar/i, /solo un poquito/i, /se regeneró/i, /plátano con chocolate/i, /coco cremosito/i, /bromi/i, /será rápido/i];
const CTA = [/juega gratis/i, /empieza gratis/i, /el reto diario es gratis/i];
const FECHA = /\b(viernes|lunes|martes|miércoles|jueves|sábado|domingo) \d{1,2}\b|\b\d{1,2} de (octubre|noviembre|diciembre)\b/i;
// condiciones que dependen de un despliegue oculto: solo con ellas se puede decir un día (docs/CALENDARIO.md §4, paso 8)
const CON_FECHA = new Set(['cap7', 'cap7_3nov', 'cap8', 'cap8_3nov', 'ga4']);
// en una rama de la alternativa, solo el respaldo del 7 y el capítulo 8 (una rama «si cap7» no sabe la fecha del 8)
const RAMA_CON_FECHA = new Set(['cap7_3nov', 'cap8', 'cap8_3nov']);
// voz: la más lenta medida en dist/estudio/voz-cache/ (Cocardo, Chatterbox) y la pausa con que K.guion encadena líneas
const RITMO = 11.5, PAUSA = 0.25;

const palabras = (s) => String(s).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const hhmm = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '');
function lisboa(fecha, hora) {
  // Ciudad de México: UTC−6 todo el año (sin horario de verano desde 2022). Lisboa: lo que diga Intl.
  const [h, m] = hora.split(':').map(Number);
  const [y, mo, d] = fecha.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, h + 6, m));
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(t).map((x) => [x.type, x.value]));
  return { hora: `${p.hour}:${p.minute}`, fecha: `${p.year}-${p.month}-${p.day}` };
}
const nivelDeEscena = (k) => { const m = /^(pre|post|cliff)(\d+)$/.exec(k); return m ? Number(m[2]) : k === 'ending' ? 30 : null; };

// ---------- condiciones: «cap7», «!cap7», «cap7|cap7_3nov» (o), [«a», «b»] (y) ----------
const terminos = (x) => (x == null ? [] : Array.isArray(x) ? x.flatMap(terminos) : String(x).split('|').map((t) => t.trim()))
  .map((t) => ({ id: t.replace(/^!/, ''), neg: t.startsWith('!') }));
function cumple(x, s) {
  if (x == null) return true;
  if (Array.isArray(x)) return x.every((y) => cumple(y, s));
  return String(x).split('|').some((t) => (t.trim().startsWith('!') ? !s[t.trim().slice(1)] : !!s[t.trim()]));
}
const permiteFecha = (x, conjunto) => terminos(x).some((t) => !t.neg && (conjunto || CON_FECHA).has(t.id));
const ramas = (v) => (!v.alternativa ? [] : Array.isArray(v.alternativa) ? v.alternativa : [v.alternativa]);

// ---------- voz: números a letras como texto_es.py, para contar lo que de verdad se dice ----------
const UNI = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece',
  'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DEC = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CEN = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
function menorMil(n) {
  if (n < 30) return UNI[n];
  if (n < 100) return DEC[Math.floor(n / 10)] + (n % 10 ? ' y ' + UNI[n % 10] : '');
  if (n === 100) return 'cien';
  return CEN[Math.floor(n / 100)] + (n % 100 ? ' ' + menorMil(n % 100) : '');
}
const apocope = (s) => (s.endsWith('veintiuno') ? s.slice(0, -9) + 'veintiún' : s.endsWith('uno') ? s.slice(0, -3) + 'un' : s);
function enLetras(n) {
  if (n < 1000) return menorMil(n);
  if (n < 1e6) { const m = Math.floor(n / 1000), r = n % 1000; return (m === 1 ? 'mil' : apocope(menorMil(m)) + ' mil') + (r ? ' ' + menorMil(r) : ''); }
  const mm = Math.floor(n / 1e6), r = n % 1e6;
  return (mm === 1 ? 'un millón' : apocope(enLetras(mm)) + ' millones') + (r ? ' ' + enLetras(r) : '');
}
const paraVoz = (t) => String(t).replace(/\d{1,3}(?:[.,]\d{3})+(?!\d)|\d+/g, (m) => {
  const c = m.replace(/[.,](?=\d{3}\b)/g, '');
  return c.length <= 9 ? enLetras(Number(c)) : m;
}).replace(/\.\.\./g, '…').replace(/\s+/g, ' ').trim();

// todo lo que un personaje puede decir según js/story.js (escenas, burlas, rescates y citas del álbum)
const TEXTOS = [];
for (const [k, arr] of Object.entries(Story.scripts)) arr.forEach((e) => e.text && TEXTOS.push({ quien: e.who, texto: e.text, escena: k }));
for (const [q, o] of Object.entries(Story.taunts || {})) for (const l of Object.values(o)) l.forEach((t) => TEXTOS.push({ quien: q, texto: t }));
for (const [q, t] of Object.entries(Story.rescueLines || {})) TEXTOS.push({ quien: q, texto: t });
Story.album.forEach((a) => TEXTOS.push({ quien: a.id, texto: a.quote }));

// Lo que se dice en voz: «lineas» si está (lo exacto); si no, las escenas menos los cortes, más linea, burla(s) y cita
function dichas(p) {
  if (Array.isArray(p.lineas)) return p.lineas.map((l) => (typeof l === 'string' ? { texto: l } : l));
  const out = [], cortes = p.cortes || [];
  const completas = new Set(cortes.map((c) => /^(\S+) completo$/.exec(c)).filter(Boolean).map((m) => m[1]));
  for (const k of p.escenas || []) {
    if (!ESCENAS.has(k) || completas.has(k)) continue;
    for (const e of Story.scripts[k]) if (e.text && !cortes.includes(e.text)) out.push({ quien: e.who, texto: e.text });
  }
  const burlas = p.burlas ? Object.values(p.burlas).flat() : [];
  for (const t of [p.linea, p.burla, p.cita].concat(burlas)) if (typeof t === 'string' && !out.some((o) => o.texto.includes(t))) out.push({ texto: t });
  return out;
}
const vozEstimada = (ls) => (ls.length ? ls.reduce((a, l) => a + paraVoz(l.texto).length, 0) / RITMO + PAUSA * (ls.length - 1) : 0);
const sinTexto = new Set(), tablaVoz = [];

// ---------- revisión de un video (o de una rama de su alternativa) ----------
function revisar(id, v, fecha, tag) {
  if (!FORMATOS.has(v.formato)) E(tag, `formato desconocido ${v.formato}`);
  if (!hhmm(v.hora_cdmx)) E(tag, `hora_cdmx inválida «${v.hora_cdmx}»`);
  else {
    const L = lisboa(fecha, v.hora_cdmx);
    if (v.hora_lisboa !== L.hora || v.fecha_lisboa !== L.fecha) E(tag, `Lisboa debería ser ${L.fecha} ${L.hora}, no ${v.fecha_lisboa} ${v.hora_lisboa}`);
  }
  for (const k of ['titulo', 'gancho', 'idea', 'texto_post']) if (!v[k] || typeof v[k] !== 'string') E(tag, `falta ${k}`);
  if (v.gancho && palabras(v.gancho) > 9) E(tag, `gancho de ${palabras(v.gancho)} palabras: «${v.gancho}»`);
  if (v.gancho_b && palabras(v.gancho_b) > 9) E(tag, `gancho_b de ${palabras(v.gancho_b)} palabras`);
  if (!MUSICA.has(v.musica)) E(tag, `música «${v.musica}» fuera de ${[...MUSICA].join(' | ')}`);
  if (!(v.duracion_s >= 5 && v.duracion_s <= 60)) E(tag, `duración ${v.duracion_s} s fuera de 5-60 (revisar.cjs aprueba de 6 a 60)`);
  else if (v.duracion_s < 6) A(tag, `${v.duracion_s} s: revisar.cjs pide 6 s como mínimo (usa --min 5)`);
  else if (v.duracion_s > 57) A(tag, `${v.duracion_s} s: casi en el tope de 60 de revisar.cjs; cualquier décima de más no aprueba`);
  const hs = v.hashtags || [];
  if (hs.length < 4 || hs.length > 5) E(tag, `${hs.length} hashtags (van 4 o 5)`);
  if (hs.some((h) => !/^#[\p{L}\p{N}]+$/u.test(h))) E(tag, `hashtag mal escrito: ${hs.join(' ')}`);
  if (new Set(hs).size !== hs.length) E(tag, 'hashtags repetidos');
  // personajes y voces
  for (const q of v.quien_habla || []) {
    if (!PERSONAJES.has(q)) E(tag, `personaje desconocido «${q}»`);
    else if (!CON_VOZ.has(q)) A(tag, `«${q}» todavía no tiene voz en tools/video/voz/voces.json (crearla o dejar su línea solo con subtítulo)`);
  }
  if (v.usa_voces !== (v.quien_habla || []).length > 0) E(tag, 'usa_voces no coincide con quien_habla');
  // textos públicos
  const publico = [v.titulo, v.gancho, v.gancho_b, v.texto_post].filter(Boolean).join(' \n ');
  for (const r of PROHIBIDAS) if (r.test(publico)) E(tag, `texto público con frase prohibida ${r}`);
  if (!CTA.some((r) => r.test(v.texto_post || ''))) E(tag, 'el texto del post no trae «Juega gratis», «Empieza gratis» ni «El Reto Diario es gratis»');
  if (!/\?/.test(v.texto_post || '')) E(tag, 'el texto del post no trae una pregunta para comentar (§6)');
  if (/\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?(am|pm|hrs?)\b/i.test(publico)) E(tag, 'el texto público da una hora concreta (se dice «a medianoche, tu hora»)');
  if (/medianoche/i.test(publico) && !/medianoche,? tu hora/i.test(publico)) E(tag, '«medianoche» sin «tu hora»');
  if (/(^|[^\p{L}])rió(?!\p{L})/iu.test(publico)) E(tag, '«rió» va sin tilde: «se rio» (Ortografía de la RAE, 2010)');
  const p = v.parametros || {};
  const ls = dichas(p);
  if (/juega gratis/i.test(v.texto_post || '') && v.formato !== 'F05') {
    const nv = [p.nivel].concat((p.escenas || []).map(nivelDeEscena), ls.map((l) => l.escena && nivelDeEscena(l.escena))).filter((n) => n != null);
    if (!nv.length) A(tag, '«Juega gratis» sin nivel ni escena: va solo en videos de los niveles 1 a 10 y del Reto');
    else if (Math.max(...nv) > 10) E(tag, `«Juega gratis» en un video del nivel ${Math.max(...nv)}: usa «Empieza gratis»`);
  }
  // líneas vetadas (en todo lo que se dice o se ve, salvo la lista de cortes y el nombre interno del nivel)
  const dicho = [publico, v.idea, JSON.stringify(p.lineas || ''), p.linea, p.burla, JSON.stringify(p.burlas || ''), p.cita].filter(Boolean).join(' ');
  for (const r of VETADAS) if (r.test(dicho)) E(tag, `usa una línea vetada ${r}`);
  if (/X\s?%|\bX de cada\b/.test(publico)) A(tag, 'lleva «X» por llenar con el dato real el día de publicar');
  // «lineas»: cada una dicha por alguien de quien_habla y sacada de js/story.js (o marcada «nueva»)
  if (Array.isArray(p.lineas)) {
    const hablan = new Set();
    for (const l of p.lineas) {
      if (!l || typeof l !== 'object' || typeof l.texto !== 'string' || !l.quien) { E(tag, `línea sin «quien» o sin «texto»: ${JSON.stringify(l)}`); continue; }
      hablan.add(l.quien);
      if (!(v.quien_habla || []).includes(l.quien)) E(tag, `«${l.quien}» dice «${l.texto}» pero no está en quien_habla`);
      if (l.emocion && !EMOCIONES.has(l.emocion)) E(tag, `emoción «${l.emocion}» fuera de voces.json`);
      if (l.escena && !ESCENAS.has(l.escena)) E(tag, `línea de la escena «${l.escena}», que no existe`);
      // vale un fragmento de la línea (se le puede añadir el punto final)
      const frag = l.texto.replace(/[.…!?,]+$/u, '');
      if (!l.nueva && !TEXTOS.some((t) => t.quien === l.quien && (!l.escena || t.escena === l.escena) && t.texto.includes(frag)))
        E(tag, `«${l.texto}» no está en boca de ${l.quien}${l.escena ? ' en ' + l.escena : ''} en js/story.js (si es nueva, márcala «nueva»)`);
    }
    for (const q of v.quien_habla || []) if (!hablan.has(q)) A(tag, `«${q}» está en quien_habla pero no tiene ninguna línea en «lineas»`);
  }
  // que la voz quepa: caracteres dichos (números en letras) ÷ 11,5 + 0,25 s entre líneas
  if (v.usa_voces) {
    const est = vozEstimada(ls);
    if (ls.length) tablaVoz.push([tag, ls.length, ls.reduce((a, l) => a + paraVoz(l.texto).length, 0), est, v.duracion_s]);
    if (!ls.length) sinTexto.add(tag);
    else if (est > 59) E(tag, `la voz sola dura unos ${est.toFixed(1)} s: con la tarjeta final pasa de 60 (recorta «lineas» o parte el video)`);
    else if (est > v.duracion_s + 5) E(tag, `la voz sola dura unos ${est.toFixed(1)} s y el video dice ${v.duracion_s} s: recorta «lineas» o parte el episodio`);
    else if (est > v.duracion_s) A(tag, `la voz sola dura unos ${est.toFixed(1)} s, más que duracion_s (${v.duracion_s}): recalcúlala con g.fin al armar el guion`);
  }
  // escenas y niveles
  const escenas = [].concat(p.escenas || [], p.escena && ESCENAS.has(p.escena) ? [p.escena] : []);
  for (const k of escenas) if (!ESCENAS.has(k)) E(tag, `escena «${k}» no existe en js/story.js`);
  for (const k of p.escenas_por_escribir || []) if (ESCENAS.has(k)) A(tag, `la escena «${k}» ya existe en js/story.js: pásala a «escenas»`);
  if (p.nivel != null && !NIVELES.has(p.nivel)) E(tag, `nivel ${p.nivel} no existe en js/core/levels.js`);
  // lo que se cita en la idea y en los textos también tiene que existir (lo futuro va en *_por_escribir/_por_construir)
  const citado = [v.titulo, v.gancho, v.idea, v.texto_post].join(' ');
  for (const m of citado.matchAll(/\b(pre|post|cliff)(\d+)\b/g)) if (!ESCENAS.has(m[0])) E(tag, `cita la escena «${m[0]}», que no existe en js/story.js`);
  for (const m of citado.matchAll(/\bnivel(?:es)? (\d+)(?: (?:y|al|a) (\d+))?/g))
    for (const n of [m[1], m[2]].filter(Boolean).map(Number)) if (!NIVELES.has(n)) E(tag, `cita el nivel ${n}, que no existe en js/core/levels.js`);
  // «nivel N … «Nombre»»: el nombre tiene que ser el de levels.js
  for (const m of citado.matchAll(/nivel (\d+)[^«\d.]{0,22}«([^»]+)»/gi)) {
    const lv = Levels.list.find((l) => l.id === Number(m[1]));
    if (lv && lv.name !== m[2]) E(tag, `el nivel ${m[1]} se llama «${lv.name}», no «${m[2]}»`);
  }
  for (const n of p.niveles_por_construir || []) if (NIVELES.has(n)) A(tag, `el nivel ${n} ya existe: revisa el video`);
  if (p.semilla != null && !Number.isInteger(p.semilla)) E(tag, `semilla no entera ${p.semilla}`);
  if ((p.frase === 'la única') && p.ganadoras_en_tablero != null && p.ganadoras_en_tablero !== 1) E(tag, `dice «la única» con ${p.ganadoras_en_tablero} ganadoras`);
}

// ---------- estructura del calendario ----------
const vids = cal.videos || [];
if (vids.length !== 90) E('calendario', `${vids.length} videos (deben ser 90)`);
const conds = cal.plan && cal.plan.condiciones ? cal.plan.condiciones : {};
const dep = (cal.plan && cal.plan.dependencias_condiciones) || {};
for (const [k, req] of Object.entries(dep)) for (const t of [k].concat(req).flatMap((r) => terminos(r))) if (!conds[t.id]) E('plan', `dependencia con la condición «${t.id}», que no está en plan.condiciones`);
const inicio = Date.parse((cal.plan && cal.plan.inicio) + 'T00:00:00Z');
const porDia = {};
vids.forEach((v, i) => {
  const dia = Math.floor(i / 3) + 1, slot = i % 3;
  const idEsperado = `D${String(dia).padStart(2, '0')}-${slot + 1}`;
  if (v.id !== idEsperado) E(v.id, `fuera de orden: debería ser ${idEsperado}`);
  if (v.dia !== dia) E(v.id, `dia ${v.dia}, debería ser ${dia}`);
  const fecha = new Date(inicio + (dia - 1) * 864e5).toISOString().slice(0, 10);
  if (v.fecha !== fecha) E(v.id, `fecha ${v.fecha}, debería ser ${fecha}`);
  if (v.dia_semana !== DIAS[new Date(fecha + 'T12:00:00Z').getUTCDay()]) E(v.id, `día de la semana ${v.dia_semana} no corresponde a ${fecha}`);
  if (v.franja !== FRANJAS[slot]) E(v.id, `franja ${v.franja}, debería ser ${FRANJAS[slot]}`);
  revisar(v.id, v, v.fecha, v.id);
  const rs = ramas(v);
  if (v.condicion) {
    for (const t of terminos(v.condicion)) if (!conds[t.id]) E(v.id, `condición «${t.id}» no está en plan.condiciones`);
    if (!v.condicional) E(v.id, 'tiene condición pero no el texto de «condicional»');
    if (!rs.length) E(v.id, 'es condicional y no trae alternativa');
    rs.forEach((r, k) => {
      const tag = Array.isArray(v.alternativa) ? `${v.id} (alternativa ${k + 1}${r.si ? ', si ' + [].concat(r.si).join(' y ') : ''})` : `${v.id} (alternativa)`;
      for (const t of terminos(r.si)) if (!conds[t.id]) E(tag, `condición «${t.id}» no está en plan.condiciones`);
      if (Array.isArray(v.alternativa) && k === rs.length - 1 && r.si) E(tag, 'la última rama va sin «si»: es la que sale en los demás casos');
      if (Array.isArray(v.alternativa) && k < rs.length - 1 && !r.si) E(tag, 'solo la última rama puede ir sin «si»');
      revisar(v.id, r, v.fecha, tag);
      // una rama solo puede decir un día si depende de un despliegue oculto (el respaldo del 7 o el capítulo 8)
      if (FECHA.test([r.gancho, r.texto_post].join(' '))) {
        if (!permiteFecha(r.si, RAMA_CON_FECHA)) E(tag, 'da una fecha en el texto público sin depender de cap7_3nov, cap8 o cap8_3nov');
        if (v.fecha < '2026-10-27') E(tag, 'menciona una fecha antes del despliegue oculto del 27 de octubre');
      }
    });
  } else if (v.condicional || v.alternativa) E(v.id, 'trae condicional o alternativa sin «condicion»');
  // fechas en lo público solo con condición de despliegue (y la del capítulo 7 nunca antes del 27 de octubre)
  if (FECHA.test([v.gancho, v.texto_post].join(' '))) {
    if (!permiteFecha(v.condicion)) E(v.id, 'da una fecha en el texto público sin ser condicional');
    if (v.fecha < '2026-10-27') E(v.id, 'menciona una fecha antes del despliegue oculto del 27 de octubre');
  }
  (porDia[dia] = porDia[dia] || []).push(v);
});
for (const [dia, lista] of Object.entries(porDia)) {
  if (lista.length !== 3) E(`día ${dia}`, `${lista.length} videos (deben ser 3)`);
  const hs = lista.map((v) => v.hora_cdmx);
  if (!(hs[0] < hs[1] && hs[1] < hs[2])) E(`día ${dia}`, `horas fuera de orden ${hs.join(' ')}`);
}

// existentes: cada uno exactamente una vez; el 13 (spoiler) fuera de la primera semana y el 11 después del 13
const usoEx = {};
vids.forEach((v) => { if (v.existente) (usoEx[v.existente] = usoEx[v.existente] || []).push(v); });
for (const ex of EXISTENTES) {
  const u = usoEx[ex] || [];
  if (u.length !== 1) E('existentes', `${ex} aparece ${u.length} veces (debe ser 1)`);
  if (!fs.existsSync(path.join(ROOT, 'dist/videos', ex))) A('existentes', `no encuentro dist/videos/${ex}`);
}
for (const ex of Object.keys(usoEx)) if (!EXISTENTES.includes(ex)) E('existentes', `«${ex}» no es uno de los 13`);
const f13 = (usoEx['13-nivel-final.mp4'] || [])[0], f11 = (usoEx['11-rescate-6-de-6.mp4'] || [])[0];
if (f13 && f13.fecha < '2026-10-26') E(f13.id, 'el video del nivel final (spoiler) cae en la primera semana');
if (f13 && f11 && f11.dia <= f13.dia) E(f11.id, 'el 11 enseña el final del nivel 30: va después del 13');

// ---------- escenarios: todas las combinaciones posibles de condiciones ----------
const ids = Object.keys(conds);
const escenarios = [];
for (let mask = 0; mask < 1 << ids.length; mask++) {
  const s = {};
  ids.forEach((k, i) => { s[k] = !!(mask & (1 << i)); });
  if (Object.entries(dep).every(([k, req]) => !s[k] || req.every((r) => cumple(r, s)))) escenarios.push(s);
}
const efectivo = (v, s) => (!v.condicion || cumple(v.condicion, s) ? v : ramas(v).find((r) => cumple(r.si, s)) || null);
// formatos atados al ciclo de un capítulo (D−2, D−1, D): pueden salir 3 días seguidos
const CICLO = new Set((cal.plan && cal.plan.formatos_de_ciclo) || []);
const SEMANAS = [[1, 7], [8, 14], [15, 21], [22, 28], [29, 30]];
const variedad = {};
let malos = 0;
for (const s of escenarios) {
  const nombre = ids.map((k) => (s[k] ? k : '!' + k)).join(' ');
  const errs = [];
  const efs = vids.map((v) => efectivo(v, s));
  efs.forEach((x, i) => { if (!x) errs.push(`${vids[i].id}: ninguna rama de la alternativa vale para este caso`); });
  if (errs.length) { malos++; errs.slice(0, 6).forEach((m) => E(`escenario [${nombre}]`, m)); continue; }
  // mismo día
  for (let d = 0; d < 30; d++) {
    const f = efs.slice(d * 3, d * 3 + 3).map((x) => x.formato);
    if (new Set(f).size !== f.length) errs.push(`día ${d + 1}: formato repetido (${f.join(', ')})`);
    const h = efs.slice(d * 3, d * 3 + 3).map((x) => x.hora_cdmx);
    if (!(h[0] < h[1] && h[1] < h[2])) errs.push(`día ${d + 1}: horas fuera de orden (${h.join(' ')})`);
  }
  // misma franja, más de 2 días seguidos
  for (let slot = 0; slot < 3; slot++) {
    for (let d = 2; d < 30; d++) {
      const a = efs[(d - 2) * 3 + slot].formato, b = efs[(d - 1) * 3 + slot].formato, c = efs[d * 3 + slot].formato;
      if (a === b && b === c) errs.push(`${FRANJAS[slot]}: ${a} los días ${d - 1}, ${d} y ${d + 1}`);
    }
  }
  // ganchos distintos
  const vistos = {};
  efs.forEach((x, i) => {
    const g = x.gancho.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
    if (vistos[g]) errs.push(`gancho repetido en ${vistos[g]} y ${vids[i].id}: «${x.gancho}»`);
    else vistos[g] = vids[i].id;
  });
  // variedad (avisos): un formato 3 días seguidos en cualquier franja o más de 4 veces en una semana
  const dias = {};
  efs.forEach((x, i) => { (dias[x.formato] = dias[x.formato] || new Set()).add(Math.floor(i / 3) + 1); });
  for (const [f, ds] of Object.entries(dias)) {
    if (!CICLO.has(f)) for (let d = 1; d <= 28; d++) if (ds.has(d) && ds.has(d + 1) && ds.has(d + 2)) {
      const k = `${f} sale 3 días seguidos (días ${d}, ${d + 1} y ${d + 2})`; variedad[k] = (variedad[k] || 0) + 1;
    }
    for (const [a, b] of SEMANAS) {
      const n = efs.slice((a - 1) * 3, b * 3).filter((x) => x.formato === f).length;
      if (n > 4) { const k = `${f} sale ${n} veces en los días ${a} a ${b}`; variedad[k] = (variedad[k] || 0) + 1; }
    }
  }
  if (errs.length) { malos++; if (malos <= 3) errs.slice(0, 6).forEach((m) => E(`escenario [${nombre}]`, m)); }
}
for (const [k, n] of Object.entries(variedad)) A('variedad', `${k}${n < escenarios.length ? ` (en ${n} de ${escenarios.length} escenarios)` : ''}`);

// ---------- con el motor: que cada cifra siga siendo cierta ----------
if (!RAPIDO) {
  const Engine = require(path.join(ROOT, 'js/core/engine.js'));
  const P = require(path.join(ROOT, 'tools/video/plan.cjs'));
  const claveDeFecha = (f) => Number(f.replace(/-/g, ''));
  const igual = (x, y) => x && y && x.r === y.r && x.c === y.c;
  const cacheCasi = {}, cacheJugar = {};
  const casi = (n, s, pol) => { const k = `${n}:${s}:${pol}`; return k in cacheCasi ? cacheCasi[k] : (cacheCasi[k] = P.casi(n, s, pol === 'experto' ? undefined : pol)); };
  const jugar = (n, s) => { const k = `${n}:${s}`; return cacheJugar[k] || (cacheJugar[k] = P.jugar(n, s, { peek: true })); };
  for (const v of vids) {
    const todas = [[v, v.id]].concat(ramas(v).map((r, k) => [r, `${v.id} (alternativa${Array.isArray(v.alternativa) ? ' ' + (k + 1) : ''})`]));
    for (const [x, tag] of todas) {
      if (!x || !x.parametros) continue;
      const p = x.parametros;
      if (p.reto != null) {
        if (p.clave !== claveDeFecha(v.fecha)) E(tag, `el Reto #${p.reto} es del ${p.clave}, pero el video sale el ${v.fecha}`);
        const num = numReto(v.fecha);
        if (num !== p.reto) E(tag, `el ${v.fecha} toca el Reto #${num}, no el #${p.reto}`);
        const h = jugarReto(p.clave, false), e = jugarReto(p.clave, true);
        if (h.lv.id !== p.nivel || h.lv.moves !== p.movimientos) E(tag, `el Reto cambió: ahora es el nivel ${h.lv.id} con ${h.lv.moves} movimientos`);
        if (txtReto(h) !== p.bot_honesto || txtReto(e) !== p.bot_que_ve_relleno || h.emojis !== p.emojis_bot_honesto)
          E(tag, `el resultado del Reto cambió (bot honesto: ${txtReto(h)}; el que ve el relleno: ${txtReto(e)}): regenera textos y gancho`);
      }
      if (['F02', 'F03'].includes(x.formato) && p.nivel && p.semilla && p.politica !== undefined) {
        const r = casi(p.nivel, p.semilla, p.politica);
        if (!r) E(tag, `plan.cjs casi ya no da un final para ${p.nivel}:${p.semilla}:${p.politica}`);
        else {
          if (p.ganadoras_en_tablero != null && r.gana.length !== p.ganadoras_en_tablero) E(tag, `el motor da ${r.gana.length} jugadas ganadoras, no ${p.ganadoras_en_tablero}`);
          if (p.prefijo != null && r.prefijo.length !== p.prefijo) E(tag, `el prefijo ahora tiene ${r.prefijo.length} jugadas, no ${p.prefijo}`);
          if (!r.pierde.some((j) => j.faltan === 1)) E(tag, 'ninguna jugada se queda a 1');
          // la perdedora fija que enseña la toma (--var …:pierde:<indice>)
          if (p.pierde && p.pierde.indice != null) {
            const j = r.pierde[p.pierde.indice];
            if (!j || !igual(j.a, p.pierde.a) || !igual(j.b, p.pierde.b) || j.faltan !== p.pierde.faltan || j.cascadas !== p.pierde.cascadas
              || j.piezas !== p.pierde.piezas || !!j.combo !== !!p.pierde.combo)
              E(tag, `la perdedora ${p.pierde.indice} ya no es la del calendario (${j ? `${j.cascadas} cascadas, ${j.piezas} piezas, faltan ${j.faltan}` : 'no existe'})`);
          }
          // y la ganadora fija (--var …:gana:<indice>, en el orden de plan.cjs casi)
          if (p.gana_indice != null) {
            const g = r.gana[p.gana_indice], q = p.gana || {};
            if (!g || (q.a && (!igual(g.a, q.a) || !igual(g.b, q.b))) || (q.cascadas != null && g.cascadas !== q.cascadas) || (q.piezas != null && g.piezas !== q.piezas))
              E(tag, `la ganadora ${p.gana_indice} ya no es la del calendario (${g ? `${g.cascadas} cascadas, ${g.piezas} piezas` : 'no existe'})`);
          }
        }
      }
      if (p.datos && /datos\/acertijo\.cjs$/.test(p.datos)) {
        // tablero armado a mano: cuántas jugadas de todo el tablero ganan y si la respuesta es una de ellas
        const D = require(path.join(ROOT, p.datos));
        const s0 = Engine.fromRows(D.FILAS, D.OPTS);
        const ganan = Engine.validMoves(s0).filter((m) => Engine.applySwap(s0, m.a, m.b).state.status === 'won');
        if (p.ganadoras_en_tablero != null && ganan.length !== p.ganadoras_en_tablero) E(tag, `el tablero de ${p.datos} tiene ${ganan.length} jugadas ganadoras, no ${p.ganadoras_en_tablero}`);
        const o = p.respuesta && D.OPCIONES[p.respuesta];
        if (o && Engine.applySwap(s0, o.a, o.b).state.status !== 'won') E(tag, `la opción ${p.respuesta} ya no gana`);
      }
      // una apertura desde el tablero inicial (cascadas y reacciones)
      if (p.jugada && p.cascadas != null && p.nivel && p.semilla) {
        const s0 = Engine.createGame(P.nivel(p.nivel), p.semilla);
        const res = Engine.applySwap(s0, p.jugada.a, p.jugada.b);
        if (res.turnInfo.cascades !== p.cascadas || res.turnInfo.cleared !== p.piezas)
          E(tag, `la jugada da ${res.turnInfo.cascades} cascadas y ${res.turnInfo.cleared} piezas, no ${p.cascadas} y ${p.piezas}`);
      }
      // un rescate dentro de una partida del bot (la misma que graba tomas/nivel.cjs)
      if (p.rescate && p.nivel && p.semilla) {
        const r = jugar(p.nivel, p.semilla), j = r.jugadas[p.rescate.jugada - 1];
        if (!j || !j.rescates.includes(p.victima) || j.cascadas !== p.rescate.cascadas || j.piezas !== p.rescate.piezas)
          E(tag, `la jugada ${p.rescate.jugada} ya no rescata a ${p.victima} con ${p.rescate.cascadas} cascadas y ${p.rescate.piezas} piezas`);
        else if (p.rescate.gana && (r.estado !== 'won' || r.jugadas.length !== p.rescate.jugada)) E(tag, `la jugada ${p.rescate.jugada} ya no es la que gana el nivel`);
      }
      // el congelador que cae dentro del tramo grabado (ASMR)
      if (p.congelador_cae_en && p.nivel && p.semilla) {
        const j = jugar(p.nivel, p.semilla).jugadas[p.congelador_cae_en - 1];
        if (!j || j.fz !== 0) E(tag, `el congelador ya no cae en la jugada ${p.congelador_cae_en}`);
      }
      if (x.formato === 'F04' && p.jugadas && p.nivel && p.semilla) {
        const r = P.jugar(p.nivel, p.semilla, { peek: true });
        if (r.estado !== 'won' || r.quedan !== 0 || r.jugadas.length !== p.jugadas) E(tag, `la partida ya no se gana en la jugada ${p.jugadas} (${r.estado}, ${r.jugadas.length} jugadas, quedan ${r.quedan})`);
      }
    }
  }
}

if (VOZ) {
  console.log('Video                                   líneas  caracteres  voz ≈ s  duracion_s');
  for (const [t, n, c, e, d] of tablaVoz) console.log(`${t.padEnd(40)}${String(n).padStart(6)}${String(c).padStart(12)}${e.toFixed(1).padStart(9)}${String(d).padStart(12)}`);
  console.log(`(${String(RITMO).replace('.', ',')} caracteres/s y ${String(PAUSA).replace('.', ',')} s entre líneas; los números cuentan en letras)\n`);
}

// ---------- resumen ----------
const cuenta = {};
vids.forEach((v) => { cuenta[v.formato] = (cuenta[v.formato] || 0) + 1; });
const nombres = Object.fromEntries(formatos.formatos.map((f) => [f.id, f.nombre]));
console.log(`Calendario ${path.relative(ROOT, archivo)}: ${vids.length} videos, ${Object.keys(porDia).length} días, ${escenarios.length} escenarios de condiciones revisados${RAPIDO ? ' (sin motor)' : ''}.`);
console.log('Por formato: ' + Object.keys(cuenta).sort().map((k) => `${k} ${nombres[k] || '?'} ${cuenta[k]}`).join(' · '));
const cond = vids.filter((v) => v.condicion).length;
console.log(`Condicionales: ${cond} (con alternativa escrita). Existentes: ${Object.keys(usoEx).length} de 13.`);
const conVoz = vids.filter((v) => v.usa_voces);
const sinTextoBase = conVoz.filter((v) => sinTexto.has(v.id)).map((v) => v.id);
console.log(`Voz medida a ${String(RITMO).replace('.', ',')} caracteres/s: ${conVoz.length - sinTextoBase.length} de ${conVoz.length} videos con voces (plan normal) declaran lo que se dice. `
  + `Sin texto todavía (escenas por escribir, respuestas, narrador por redactar; se mide al armar el guion): ${sinTextoBase.join(', ') || 'ninguno'}.`);
if (avisos.length) { console.log(`\nAvisos (${new Set(avisos).size}):`); [...new Set(avisos)].forEach((a) => console.log('  · ' + a)); }
if (errores.length) { console.log(`\nErrores (${errores.length}):`); errores.forEach((e) => console.log('  ✗ ' + e)); process.exit(1); }
console.log('\nOK: el calendario cumple todas las reglas.');
