#!/usr/bin/env node
/* Cocardo: ¡Rescate Helado! — Calendario de capítulos: qué ve el jugador hoy y qué toca hacer.

   Uso:  node tools/calendario.js [--hoy YYYY-MM-DD] [--md]
     --hoy    simula otra fecha local (por defecto, la de hoy)
     --md     tabla en Markdown (para pegar en docs/CALENDARIO.md o en un mensaje)

   Lee js/core/levels.js (capítulos construidos, con su `opens`) y js/core/roadmap.js (capítulos en
   construcción) y comprueba lo mismo que el juego: estado de cada capítulo para esa fecha, texto que se
   muestra en el mapa, niveles jugables y avisos: fechas vencidas sin niveles, capítulos programados sin
   margen de despliegue, tope de niveles del guardado y de las reglas de Firestore. Sale con código 1 si
   hay algo que arreglar antes de publicar. */
'use strict';
const fs = require('fs');
const path = require('path');
const Roadmap = require('../js/core/roadmap.js');
const Levels = require('../js/core/levels.js');

const args = process.argv.slice(2);
const md = args.includes('--md');
const hoyArg = (() => { const i = args.indexOf('--hoy'); return i >= 0 ? args[i + 1] : null; })();
const now = new Date();
let today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
if (hoyArg) {
  const p = Roadmap.parseOpens(hoyArg);
  if (!p || p.precision !== 'dia') { console.error(`--hoy ${hoyArg}: usa YYYY-MM-DD`); process.exit(2); }
  today = p.first;
}

const all = Roadmap.merged(Levels.chapters, today);
const openN = Roadmap.openCount(Levels.chapters, today);
const next = Roadmap.nextOpening(Levels.chapters, today);
const warnings = [];

// --- avisos ---
for (const ch of all) {
  const p = Roadmap.parseOpens(ch.opens);
  if (ch.state === 'retrasado') warnings.push(`Capítulo ${ch.id} «${ch.name}»: la fecha prevista (${ch.opens}) ya pasó y no tiene niveles. Constrúyelo o mueve la fecha en js/core/roadmap.js.`);
  if (ch.state === 'programado' && ch.days != null && ch.days > 21) warnings.push(`Capítulo ${ch.id}: construido y programado a ${ch.days} días. Está bien, pero recuerda que ya viaja en el build (cualquiera con #debug puede verlo).`);
  if (!ch.built && p && p.precision === 'dia' && ch.days != null && ch.days <= 3) warnings.push(`Capítulo ${ch.id}: promete día exacto (${ch.opens}) en ${ch.days} día(s) y aún no está construido. Despliega ya o cambia la fecha.`);
  if (!ch.built && p && p.precision === 'dia' && ch.days != null && ch.days > 42) warnings.push(`Capítulo ${ch.id}: día exacto a ${ch.days} días. Mejor mes ('YYYY-MM') hasta que esté construido.`);
  if (ch.built && !ch.opens && ch.id > Roadmap.seasons[0].chapters.length) warnings.push(`Capítulo ${ch.id}: construido sin fecha (abre en cuanto se publique). Si quieres coordinarlo con el video, ponle opens.`);
}
const lastPlanned = Roadmap.planned.length ? Roadmap.planned[Roadmap.planned.length - 1] : null;
const lastLevel = Math.max(openN, lastPlanned ? lastPlanned.levels[4] : 0, Levels.count);
if (lastLevel > Roadmap.MAX_LEVELS) warnings.push(`Hay niveles hasta el ${lastLevel} pero MAX_LEVELS es ${Roadmap.MAX_LEVELS}: súbelo en roadmap.js, firebase/firestore.rules y js/cloud.js.`);
try {
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firebase', 'firestore.rules'), 'utf8');
  if (!rules.includes(`isInt(d.levels, 0, ${Roadmap.MAX_LEVELS})`)) warnings.push(`firebase/firestore.rules no tiene el tope de ${Roadmap.MAX_LEVELS} niveles: actualízalo y despliega (firebase deploy --only firestore:rules).`);
} catch (e) { /* sin reglas en este checkout */ }
for (const ch of Levels.chapters) {
  const dup = Roadmap.planned.find((p) => p.id === ch.id);
  if (dup && dup.opens !== ch.opens) warnings.push(`Capítulo ${ch.id}: la fecha de Levels.chapters (${ch.opens}) y la de Roadmap.planned (${dup.opens}) no coinciden; manda la de Levels. Borra la entrada planeada.`);
}

// --- salida ---
const fmtDay = (k) => Roadmap.dayText(k, true);
const title = `Calendario de capítulos · hoy ${fmtDay(today)} (${today})`;
const rows = all.map((ch) => ({
  cap: ch.id, temporada: ch.season, nombre: ch.name, niveles: `${ch.levels[0]}-${ch.levels[ch.levels.length - 1]}`,
  estado: ch.state, fecha: ch.opens || '—', mapa: ch.when || (ch.built ? 'Abierto' : ''), dias: ch.days == null ? '' : String(ch.days),
}));

if (md) {
  console.log(`### ${title}\n`);
  console.log('| Cap. | T. | Nombre | Niveles | Estado | opens | Texto del mapa | Días |');
  console.log('|---|---|---|---|---|---|---|---|');
  rows.forEach((r) => console.log(`| ${r.cap} | ${r.temporada} | ${r.nombre} | ${r.niveles} | ${r.estado} | ${r.fecha} | ${r.mapa} | ${r.dias} |`));
} else {
  console.log(title);
  console.log('cap  T  estado        opens        días  texto del mapa                          nombre (niveles)');
  rows.forEach((r) => console.log(
    String(r.cap).padStart(3) + '  ' + String(r.temporada || '').padEnd(2) + ' ' + r.estado.padEnd(13) + ' ' + String(r.fecha).padEnd(12) + ' ' +
    r.dias.padStart(4) + '  ' + r.mapa.padEnd(40).slice(0, 40) + ' ' + r.nombre + ' (' + r.niveles + ')'));
}
console.log('');
console.log(`Niveles jugables hoy: 1-${openN} de ${Levels.count} construidos; ${Roadmap.planned.filter((p) => p.id > Levels.chapters[Levels.chapters.length - 1].id).length} capítulos en construcción (tope del guardado: ${Roadmap.MAX_LEVELS} niveles).`);
if (next) console.log(`Siguiente apertura: capítulo ${next.id} «${next.name}» — ${next.when}${next.days != null ? ' (' + Roadmap.daysText(next.days) + ')' : ''}${next.built ? ' [construido, programado]' : ' [sin construir]'}.`);
else console.log('No queda nada por abrir: planea la siguiente temporada en js/core/roadmap.js.');
if (warnings.length) {
  console.log('\nAvisos:');
  warnings.forEach((w) => console.log(' - ' + w));
  process.exit(1);
}
console.log('\nSin avisos.');
