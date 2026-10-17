// Pruebas de la hoja de ruta (js/core/roadmap.js): fechas de apertura, estados, textos y datos de los capítulos
// en construcción, más su encaje con los niveles construidos (js/core/levels.js) y el guardado.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Roadmap = require('../js/core/roadmap.js');
const Levels = require('../js/core/levels.js');
const Progress = require('../js/core/progress.js');
const Save = require('../js/save.js');

const TODAY = 20261017; // sábado 17 de octubre de 2026 (fecha de escritura del plan)

test('Roadmap: módulo puro (sin Date, Math.random ni DOM)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'roadmap.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(src, /\bDate\s*[.(]|new\s+Date|Math\.random|document\.|localStorage|alert\(|confirm\(|prompt\(/);
});

test('Roadmap: parseOpens acepta día, mes y año; rechaza lo demás', () => {
  assert.deepEqual(Roadmap.parseOpens('2026-10-30'), { precision: 'dia', first: 20261030, last: 20261030 });
  assert.deepEqual(Roadmap.parseOpens('2026-11'), { precision: 'mes', first: 20261101, last: 20261130 });
  assert.deepEqual(Roadmap.parseOpens('2027-02'), { precision: 'mes', first: 20270201, last: 20270228 });
  assert.deepEqual(Roadmap.parseOpens('2028-02'), { precision: 'mes', first: 20280201, last: 20280229 });
  assert.deepEqual(Roadmap.parseOpens('2027'), { precision: 'anio', first: 20270101, last: 20271231 });
  for (const bad of ['', null, undefined, '2026-13', '2026-02-30', '2025-12-01', '30/10/2026', '2026-1-5', 'pronto']) {
    assert.equal(Roadmap.parseOpens(bad), null, String(bad));
  }
});

test('Roadmap: día de la semana y días entre fechas', () => {
  assert.equal(Roadmap.weekday(20261017), 6, 'el 17 de octubre de 2026 es sábado');
  assert.equal(Roadmap.weekday(20261030), 5, 'el 30 de octubre de 2026 es viernes');
  assert.equal(Roadmap.weekday(20270101), 5, 'el 1 de enero de 2027 es viernes');
  assert.equal(Roadmap.weekday(19700101), 4, 'el 1 de enero de 1970 fue jueves');
  assert.equal(Roadmap.daysBetween(20261017, 20261030), 13);
  assert.equal(Roadmap.daysBetween(20261231, 20270101), 1);
  assert.equal(Roadmap.daysBetween(20261030, 20261017), -13);
  assert.equal(Roadmap.dayText(20261030), 'viernes 30 de octubre');
  assert.equal(Roadmap.dayText(20270105, true), 'martes 5 de enero de 2027');
});

test('Roadmap: estado por fecha (abierto, programado, construccion, retrasado)', () => {
  // construido sin fecha o con fecha cumplida: abierto
  assert.equal(Roadmap.stateFor(undefined, true, TODAY), 'abierto');
  assert.equal(Roadmap.stateFor('2026-10-17', true, TODAY), 'abierto');
  assert.equal(Roadmap.stateFor('2026-10-01', true, TODAY), 'abierto');
  // construido con fecha por llegar: programado (aunque sea mañana)
  assert.equal(Roadmap.stateFor('2026-10-18', true, TODAY), 'programado');
  assert.equal(Roadmap.stateFor('2026-11', true, TODAY), 'programado');
  // sin niveles: en construcción hasta el último día del periodo; después, retrasado
  assert.equal(Roadmap.stateFor('2026-10-30', false, TODAY), 'construccion');
  assert.equal(Roadmap.stateFor('2026-10-30', false, 20261030), 'construccion');
  assert.equal(Roadmap.stateFor('2026-10-30', false, 20261031), 'retrasado');
  assert.equal(Roadmap.stateFor('2026-11', false, 20261130), 'construccion');
  assert.equal(Roadmap.stateFor('2026-11', false, 20261201), 'retrasado');
  assert.equal(Roadmap.stateFor('2027', false, 20271231), 'construccion');
  assert.equal(Roadmap.stateFor('2027', false, 20280101), 'retrasado');
  assert.equal(Roadmap.stateFor(undefined, false, TODAY), 'construccion');
  assert.equal(Roadmap.stateFor('fecha rara', false, TODAY), 'construccion', 'una fecha inválida no rompe: en construcción sin fecha');
});

test('Roadmap: textos para el mapa (nunca una fecha vencida como promesa)', () => {
  assert.equal(Roadmap.whenText('2026-10-30', false, TODAY), 'Se abre el viernes 30 de octubre');
  assert.equal(Roadmap.whenText('2026-10-30', false, 20261024), 'Se abre el viernes', 'a menos de una semana solo el día');
  assert.equal(Roadmap.whenText('2026-10-30', false, 20261029), 'Se abre mañana');
  assert.equal(Roadmap.whenText('2026-10-30', false, 20261030), '¡Se abre hoy!');
  assert.equal(Roadmap.whenText('2026-10-30', true, 20261030), 'Abierto desde el viernes 30 de octubre');
  assert.equal(Roadmap.whenText('2026-10-30', false, 20261031), 'En construcción · ¡ya casi!', 'fecha pasada sin niveles');
  assert.equal(Roadmap.whenText('2026-11', false, TODAY), 'Previsto para noviembre');
  assert.equal(Roadmap.whenText('2027-02', false, TODAY), 'Previsto para febrero de 2027');
  assert.equal(Roadmap.whenText('2027', false, TODAY), 'Previsto para 2027');
  assert.equal(Roadmap.whenText('2027-01-08', false, 20261230), 'Se abre el viernes 8 de enero de 2027');
  assert.equal(Roadmap.whenText(undefined, false, TODAY), 'En construcción');
  assert.equal(Roadmap.whenText(undefined, true, TODAY), 'Abierto');
  assert.equal(Roadmap.daysText(0), '¡hoy!');
  assert.equal(Roadmap.daysText(1), 'falta 1 día');
  assert.equal(Roadmap.daysText(13), 'faltan 13 días');
  assert.equal(Roadmap.daysText(null), '');
  assert.equal(Roadmap.daysUntil('2026-10-30', TODAY), 13);
  assert.equal(Roadmap.daysUntil('2026-11', TODAY), 15);
  assert.equal(Roadmap.daysUntil('x', TODAY), null);
});

test('Roadmap: expectedText (ficha de pago) dice «Previsto para…», nunca «Se abre…», y nada si ya abrió o se retrasó', () => {
  assert.equal(Roadmap.expectedText('2026-10-30', false, TODAY), 'Previsto para el viernes 30 de octubre');
  assert.equal(Roadmap.expectedText('2026-10-30', true, 20261024), 'Previsto para el viernes 30 de octubre', 'a menos de una semana, con fecha completa');
  assert.equal(Roadmap.expectedText('2026-10-30', true, 20261029), 'Previsto para mañana');
  assert.equal(Roadmap.expectedText('2026-10-30', true, 20261030), '', 'construido y en su día: ya está abierto');
  assert.equal(Roadmap.expectedText('2026-10-30', false, 20261031), '', 'fecha pasada sin niveles (retrasado): sin fecha');
  assert.equal(Roadmap.expectedText('2026-12', false, TODAY), 'Previsto para diciembre');
  assert.equal(Roadmap.expectedText('2027-01-08', false, 20261230), 'Previsto para el viernes 8 de enero de 2027');
  assert.equal(Roadmap.expectedText('2027', false, TODAY), 'Previsto para 2027');
  assert.equal(Roadmap.expectedText(undefined, false, TODAY), '');
  assert.doesNotMatch(fs.readFileSync(require.resolve('../js/core/roadmap.js'), 'utf8'), /se promete/, 'el contrato no habla de promesas (Términos §5)');
});

test('Roadmap: capítulos planeados contiguos tras los construidos, 5 niveles, textos cortos y fechas que no retroceden', () => {
  const built = Levels.chapters;
  const lastBuilt = built[built.length - 1];
  assert.ok(Roadmap.planned.length >= 12, 'al menos dos temporadas planeadas');
  // los planeados que ya se construyeron se ignoran (manda Levels.chapters)
  const pending = Roadmap.planned.filter((p) => p.id > lastBuilt.id);
  let prevId = lastBuilt.id, prevLevel = lastBuilt.levels[lastBuilt.levels.length - 1], prevLast = 0;
  const names = new Set();
  for (const ch of pending) {
    assert.equal(ch.id, prevId + 1, `capítulo ${ch.id}: los ids van de corrido`);
    assert.deepEqual(ch.levels, [1, 2, 3, 4, 5].map((k) => prevLevel + k), `capítulo ${ch.id}: niveles`);
    assert.ok(typeof ch.name === 'string' && ch.name.length >= 3 && ch.name.length <= 26, `capítulo ${ch.id}: nombre «${ch.name}» (${ch.name.length})`);
    assert.ok(!names.has(ch.name), `capítulo ${ch.id}: nombre repetido`);
    names.add(ch.name);
    assert.ok(typeof ch.teaser === 'string' && ch.teaser.length >= 10 && ch.teaser.length <= 70, `capítulo ${ch.id}: teaser (${ch.teaser.length})`);
    assert.ok(typeof ch.zone === 'string' && ch.zone.length >= 3 && ch.zone.length <= 30, `capítulo ${ch.id}: zona`);
    assert.match(ch.color, /^#[0-9a-f]{6}$/i, `capítulo ${ch.id}: color`);
    assert.ok(Roadmap.seasonOf(ch.id), `capítulo ${ch.id}: sin temporada`);
    assert.equal(Roadmap.seasonOf(ch.id).id, ch.season);
    const p = Roadmap.parseOpens(ch.opens);
    assert.ok(p, `capítulo ${ch.id}: fecha «${ch.opens}» inválida`);
    // un capítulo nunca se promete antes que el anterior: su periodo (día, mes o año) termina después
    assert.ok(p.last >= prevLast, `capítulo ${ch.id}: abre antes que el anterior`);
    if (p.precision === 'dia') assert.ok(p.first > prevLast || prevLast === 0, `capítulo ${ch.id}: día exacto antes del periodo anterior`);
    assert.ok(p.last >= TODAY, `capítulo ${ch.id}: fecha ya pasada al escribir el plan`);
    prevId = ch.id; prevLevel = ch.levels[4]; prevLast = p.last;
  }
  // día exacto solo para lo cercano (≤ 6 semanas desde hoy); después, mes o año
  for (const ch of pending) {
    const p = Roadmap.parseOpens(ch.opens);
    if (p.precision === 'dia') assert.ok(Roadmap.daysBetween(TODAY, p.first) <= 42, `capítulo ${ch.id}: día exacto a más de 6 semanas`);
  }
  // temporadas: 6 capítulos cada una, de corrido, y la 1 son los capítulos construidos
  assert.deepEqual(Roadmap.seasons[0].chapters, [1, 2, 3, 4, 5, 6]);
  let next = 1;
  for (const s of Roadmap.seasons) {
    assert.equal(s.chapters.length, 6, `temporada ${s.id}`);
    s.chapters.forEach((c) => { assert.equal(c, next, `temporada ${s.id}: capítulo ${c}`); next++; });
    assert.ok(s.name.length >= 3 && s.name.length <= 30, `temporada ${s.id}: nombre`);
  }
  assert.equal(Roadmap.MAX_LEVELS, prevLevel, 'MAX_LEVELS = último nivel planeado (sube el tope si planeas más)');
  assert.equal(Roadmap.MAX_LEVELS % 5, 0);
});

test('Roadmap: merged pone estado a construidos y planeados; los planeados ya construidos se ignoran', () => {
  const all = Roadmap.merged(Levels.chapters, TODAY);
  const lastBuiltId = Levels.chapters[Levels.chapters.length - 1].id;
  assert.equal(all.length, Levels.chapters.length + Roadmap.planned.filter((p) => p.id > lastBuiltId).length);
  all.slice(0, Levels.chapters.length).forEach((ch, i) => {
    assert.equal(ch.built, true);
    assert.ok(ch.state === 'abierto' || ch.state === 'programado', `capítulo ${ch.id}`);
    if (ch.id <= 6) assert.equal(ch.state, 'abierto', `capítulo ${ch.id}`);
    assert.equal(ch.id, Levels.chapters[i].id);
    assert.equal(ch.season, Roadmap.seasonOf(ch.id).id);
  });
  all.slice(Levels.chapters.length).forEach((ch) => {
    assert.equal(ch.built, false);
    assert.equal(ch.state, 'construccion', `capítulo ${ch.id} con fecha ${ch.opens}`);
    assert.ok(ch.when.length > 0);
    assert.ok(ch.seasonName.length > 0);
  });
  // si el capítulo 7 ya está construido (en Levels.chapters), su entrada planeada deja de pintarse
  const S1 = Levels.chapters.slice(0, 6);
  const fake = S1.concat([{ id: 7, name: 'Siete', zone: 'z', color: '#000000', levels: [31, 32, 33, 34, 35], opens: '2026-10-30' }]);
  const m2 = Roadmap.merged(fake, TODAY);
  assert.equal(m2.filter((c) => c.id === 7).length, 1);
  assert.equal(m2[6].built, true);
  assert.equal(m2[6].state, 'programado');
  assert.equal(m2[6].when, 'Se abre el viernes 30 de octubre');
  assert.equal(m2[6].days, 13);
  assert.equal(m2[7].id, 8);
  assert.equal(m2[7].built, false);
  // sin lista de construidos no revienta
  assert.equal(Roadmap.merged(null, TODAY).length, Roadmap.planned.length);
});

test('Roadmap: openCount y nextOpening respetan la fecha local', () => {
  const S1 = Levels.chapters.slice(0, 6);
  assert.equal(Roadmap.openCount(S1, TODAY), 30);
  assert.ok(Roadmap.openCount(Levels.chapters, TODAY) >= 30);
  const ch7 = { id: 7, name: 'Siete', zone: 'z', color: '#000000', levels: [31, 32, 33, 34, 35], opens: '2026-10-30' };
  const ch8 = { id: 8, name: 'Ocho', zone: 'z', color: '#000000', levels: [36, 37, 38, 39, 40] };   // sin fecha: abierto
  const built = S1.concat([ch7, ch8]);
  assert.equal(Roadmap.openCount(built, 20261029), 30, 'el 7 programado tapa también al 8');
  assert.equal(Roadmap.openCount(built, 20261030), 40, 'abre a la medianoche local del día');
  assert.equal(Roadmap.openCount(built, 20270101), 40);
  assert.equal(Roadmap.openCount([], TODAY), 0);
  assert.equal(Roadmap.openCount(null, TODAY), 0);

  const nx = Roadmap.nextOpening(S1, TODAY);
  assert.equal(nx.id, 7);
  assert.equal(nx.built, false);
  assert.equal(nx.state, 'construccion');
  const nxReal = Roadmap.nextOpening(Levels.chapters, TODAY);
  const firstClosed = Roadmap.merged(Levels.chapters, TODAY).find((c) => c.state !== 'abierto');
  assert.equal(nxReal && nxReal.id, firstClosed && firstClosed.id);
  const nx2 = Roadmap.nextOpening(built, 20261029);
  assert.equal(nx2.id, 7);
  assert.equal(nx2.state, 'programado');
  assert.equal(nx2.days, 1);
  assert.equal(nx2.when, 'Se abre mañana');
  const nx3 = Roadmap.nextOpening(built, 20261030);
  assert.equal(nx3.id, 9, 'con 7 y 8 abiertos, el siguiente es el 9 (en construcción)');
  // todo construido y abierto: no hay siguiente
  const everything = Roadmap.planned.map((c) => ({ id: c.id, name: c.name, zone: c.zone, color: c.color, levels: c.levels }));
  assert.equal(Roadmap.nextOpening(S1.concat(everything), TODAY), null);
  assert.equal(Roadmap.openCount(S1.concat(everything), TODAY), Roadmap.MAX_LEVELS);
  assert.equal(Roadmap.chapterOfLevel(S1, 33).id, 7);
  assert.equal(Roadmap.chapterOfLevel(S1, 12).id, 3);
  assert.equal(Roadmap.chapterOfLevel(S1, 999), null);
  // guardados más largos que el tope (versión más nueva) no se recortan al fusionar ni al sanear
  const longer = Save.defaults(); longer.stars = Array(Roadmap.MAX_LEVELS + 5).fill(1); longer.best = Array(Roadmap.MAX_LEVELS + 5).fill(9);
  const ml = Progress.merge(Save.defaults(), longer);
  assert.equal(ml.stars.length, Roadmap.MAX_LEVELS + 5);
  assert.equal(ml.stars[Roadmap.MAX_LEVELS + 4], 1);
  assert.equal(ml.unlocked, Roadmap.MAX_LEVELS + 5);
});

test('Roadmap: el guardado y la nube ya miden MAX_LEVELS (ningún capítulo nuevo pide migrar)', () => {
  const d = Save.defaults();
  assert.equal(d.stars.length, Roadmap.MAX_LEVELS);
  assert.equal(d.best.length, Roadmap.MAX_LEVELS);
  assert.equal(Progress.LEVELS, Roadmap.MAX_LEVELS);
  // un guardado viejo (arreglos de 30) se estira sin perder nada y el desbloqueo sigue a las estrellas
  Save.reset();
  const old = { v: 1, unlocked: 30, stars: Array(30).fill(3), best: Array(30).fill(100) };
  const m = Progress.merge(Save.defaults(), old);
  assert.equal(m.stars.length, Roadmap.MAX_LEVELS);
  assert.equal(m.stars[29], 3);
  assert.equal(m.stars[30], 0);
  assert.equal(m.unlocked, 31, 'terminó el 30: el 31 queda desbloqueado para cuando exista');
  assert.equal(Progress.summary(m).finished, true, '«finished» sigue siendo terminar la temporada 1');
  assert.equal(Progress.summary(m).levels, 30);
  // y a la inversa: progreso en niveles 31+ no se pierde al juntar con un guardado viejo
  const nuevo = Save.defaults();
  nuevo.stars[34] = 2;
  const m2 = Progress.merge(nuevo, old);
  assert.equal(m2.stars[34], 2);
  assert.equal(m2.unlocked, 36);
  // las reglas de Firestore tienen el mismo tope
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firebase', 'firestore.rules'), 'utf8');
  assert.match(rules, new RegExp('isInt\\(d\\.stars, 0, ' + (Roadmap.MAX_LEVELS * 3) + '\\)'));
  assert.match(rules, new RegExp('isInt\\(d\\.levels, 0, ' + Roadmap.MAX_LEVELS + '\\)'));
  const cloud = fs.readFileSync(path.join(__dirname, '..', 'js', 'cloud.js'), 'utf8');
  assert.match(cloud, /MAXL \* 3/);
  Save.reset();
});

test('Roadmap: index.html y sw.js cargan el módulo antes del guardado', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const order = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  const i = order.indexOf('js/core/roadmap.js');
  assert.ok(i > 0, 'index.html carga js/core/roadmap.js');
  assert.ok(i < order.indexOf('js/core/progress.js') && i < order.indexOf('js/save.js'), 'antes de progress.js y save.js');
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/js\/core\/roadmap\.js'/);
});
