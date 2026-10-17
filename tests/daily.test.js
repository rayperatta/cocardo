// Pruebas del Reto Diario (js/core/daily.js): fechas, nivel del día, semilla y texto para compartir.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Daily = require('../js/core/daily.js');
const Levels = require('../js/core/levels.js');
const Engine = require('../js/core/engine.js');

const ti = (cascades, combo) => ({ valid: true, cascades, combo: !!combo, cleared: 3, specials: 0 });

test('Daily: módulos puros (sin Date, Math.random ni DOM)', () => {
  for (const f of ['daily.js', 'levels.js', 'roadmap.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(src, /\bDate\s*[.(]|new\s+Date|Math\.random|document\.|localStorage|alert\(|confirm\(|prompt\(/, f);
  }
});

test('Daily: dateKey', () => {
  assert.equal(Daily.dateKey(2026, 10, 14), 20261014);
  assert.equal(Daily.dateKey(2026, 10, 1), 20261001);
  assert.equal(Daily.dateKey(2027, 1, 5), 20270105);
  assert.equal(Daily.dateKey(2030, 12, 31), 20301231);
});

test('Daily: challengeNumber cuenta días desde 2026-10-01 (+1)', () => {
  assert.equal(Daily.challengeNumber(2026, 10, 1), 1);
  assert.equal(Daily.challengeNumber(2026, 10, 2), 2);
  assert.equal(Daily.challengeNumber(2026, 10, 14), 14);
  assert.equal(Daily.challengeNumber(2026, 10, 31), 31);
  assert.equal(Daily.challengeNumber(2026, 11, 1), 32);
  assert.equal(Daily.challengeNumber(2026, 12, 1), 62);
  assert.equal(Daily.challengeNumber(2027, 1, 1), 93);
  assert.equal(Daily.challengeNumber(2027, 10, 1), 366);
  assert.equal(Daily.challengeNumber(2028, 10, 1), 732); // 2028 es bisiesto
  assert.equal(Daily.challengeNumber(2026, 9, 30), 0);
});

test('Daily: daysBetween entre claves (cambios de mes, año y bisiestos)', () => {
  assert.equal(Daily.daysBetween(20261014, 20261015), 1);
  assert.equal(Daily.daysBetween(20261031, 20261101), 1);
  assert.equal(Daily.daysBetween(20261231, 20270101), 1);
  assert.equal(Daily.daysBetween(20270228, 20270301), 1);
  assert.equal(Daily.daysBetween(20280228, 20280301), 2);
  assert.equal(Daily.daysBetween(20261014, 20261014), 0);
  assert.equal(Daily.daysBetween(20261015, 20261014), -1);
  assert.equal(Daily.daysBetween(20261001, 20271001), 365);
});

test('Daily: levelFor = nivel 6 + (D mod 20), copia con daily:true y 2 movimientos menos', () => {
  const key = 20261014;
  const lvl = Daily.levelFor(key, Levels.list);
  const base = Levels.get(6 + (key % 20));
  assert.equal(lvl.id, 20);
  assert.equal(lvl.id, base.id);
  assert.equal(lvl.daily, true);
  assert.equal(lvl.moves, base.moves - 2);
  assert.notEqual(lvl, base);
  assert.notEqual(lvl.layout, base.layout);
  assert.equal(base.daily, undefined, 'no modifica el nivel de campaña');
  assert.equal(lvl.teach, undefined, 'sin tutorial en el reto');
  assert.deepEqual(lvl.layout, base.layout);
  assert.deepEqual(lvl.goals, base.goals);
  assert.deepEqual(Daily.levelFor(key, Levels.list), lvl, 'determinista');
  // sin lista explícita usa Cocardo.Levels
  assert.deepEqual(Daily.levelFor(key), lvl);
  // un mes recorre los 20 niveles 6..25
  const ids = new Set();
  for (let d = 1; d <= 20; d++) ids.add(Daily.levelFor(Daily.dateKey(2026, 10, d), Levels.list).id);
  assert.deepEqual([...ids].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => 6 + i));
  for (let d = 1; d <= 31; d++) {
    const l = Daily.levelFor(Daily.dateKey(2026, 12, d), Levels.list);
    assert.ok(l.id >= 6 && l.id <= 25);
    assert.ok(l.moves >= 15);
  }
});

test('Daily: seedFor y tablero del día idéntico para todos', () => {
  assert.equal(Daily.seedFor(20261014), 20261014);
  const s = Daily.seedFor(20301231);
  assert.ok(Number.isInteger(s) && s >= 0 && s <= 0xffffffff);
  assert.equal(Daily.seedFor(20261014), Daily.seedFor(20261014));
  assert.notEqual(Daily.seedFor(20261014), Daily.seedFor(20261015));
  for (const key of [20261001, 20261014, 20261231, 20270615]) {
    const lvl = Daily.levelFor(key, Levels.list);
    const a = Engine.createGame(lvl, Daily.seedFor(key));
    const b = Engine.createGame(Daily.levelFor(key, Levels.list), Daily.seedFor(key));
    assert.deepEqual(a, b);
    assert.equal(a.daily, true);
    assert.equal(a.movesLeft, lvl.moves);
    assert.ok(Engine.validMoves(a).length > 0);
  }
  // días distintos con el mismo nivel dan tableros distintos
  const k1 = 20261001, k2 = 20261021;
  assert.equal(Daily.levelFor(k1, Levels.list).id, Daily.levelFor(k2, Levels.list).id);
  assert.notDeepEqual(Engine.createGame(Daily.levelFor(k1, Levels.list), Daily.seedFor(k1)).grid,
    Engine.createGame(Daily.levelFor(k2, Levels.list), Daily.seedFor(k2)).grid);
});

test('Daily: moveEmoji', () => {
  assert.equal(Daily.moveEmoji(ti(1)), '⬜');
  assert.equal(Daily.moveEmoji(ti(2)), '🟨');
  assert.equal(Daily.moveEmoji(ti(3)), '🟧');
  assert.equal(Daily.moveEmoji(ti(4)), '🟧');
  assert.equal(Daily.moveEmoji(ti(5)), '🟥');
  assert.equal(Daily.moveEmoji(ti(9)), '🟥');
  assert.equal(Daily.moveEmoji(ti(1, true)), '🍦');
  assert.equal(Daily.moveEmoji(ti(6, true)), '🍦');
  assert.equal(Daily.moveEmoji({ maxCascade: 3, combo: false }), '🟧');
  assert.equal(Daily.moveEmoji({}), '⬜');
  assert.equal(Daily.moveEmoji(null), '⬜');
});

test('Daily: shareText con el formato exacto de DISENO §9', () => {
  const turns = [2, 1, 3, 1, 5, 2, 1, 1, 4, 2, 1, 6].map((c) => ti(c)).concat([ti(1, true)]);
  const txt = Daily.shareText({ num: 14, won: true, movesUsed: 13, movesTotal: 20, stars: 3, maxCombo: 6, turns, streak: 4 });
  assert.equal(txt, [
    '🥥 Cocardo: ¡Rescate Helado! · Reto #14',
    '⭐⭐⭐ 13/20 movs · Combo x6',
    '🟨⬜🟧⬜🟥🟨⬜⬜🟧🟨',
    '⬜🟥🍦',
    '🔥 Racha: 4',
  ].join('\n'));
});

test('Daily: shareText al perder, filas de 10 y casos borde', () => {
  const lost = Daily.shareText({ num: 3, won: false, movesUsed: 20, movesTotal: 20, stars: 0, maxCombo: 3, turns: Array.from({ length: 20 }, () => ti(1)), streak: 1 });
  const lines = lost.split('\n');
  assert.equal(lines[0], '🥥 Cocardo: ¡Rescate Helado! · Reto #3');
  assert.equal(lines[1], '❌ 20/20 movs');
  assert.equal(lines[2], '⬜'.repeat(10));
  assert.equal(lines[3], '⬜'.repeat(10));
  assert.equal(lines[4], '🔥 Racha: 1');
  assert.equal(lines.length, 5);

  // 25 jugadas -> filas de 10, 10 y 5; las jugadas inválidas no cuentan
  const turns = Array.from({ length: 25 }, (_, i) => ti((i % 6) + 1));
  turns.splice(3, 0, { valid: false, cascades: 0, combo: false });
  const t = Daily.shareText({ num: 40, won: true, movesUsed: 25, movesTotal: 26, stars: 1, maxCombo: 1, turns, streak: 0 });
  const rows = t.split('\n');
  assert.equal(rows[1], '⭐ 25/26 movs', 'sin combo x1');
  assert.deepEqual(rows.slice(2).map((r) => [...r].length), [10, 10, 5]);
  assert.ok(!t.includes('Racha'), 'sin racha cuando es 0');
  rows.slice(2).forEach((r) => assert.match(r, /^(⬜|🟨|🟧|🟥|🍦)+$/u));

  // estrellas acotadas a 1..3 al ganar
  assert.ok(Daily.shareText({ num: 1, won: true, movesUsed: 5, movesTotal: 20, stars: 0, turns: [ti(1)] }).split('\n')[1].startsWith('⭐ '));
  assert.ok(Daily.shareText({ num: 1, won: true, movesUsed: 5, movesTotal: 20, stars: 7, turns: [ti(1)] }).split('\n')[1].startsWith('⭐⭐⭐ '));
});

test('Daily: campaignShareText', () => {
  assert.equal(Daily.campaignShareText({ levelId: 10, stars: 3, rescued: ['Lima'] }).split('\n')[1], 'Nivel 10 ⭐⭐⭐ ¡Rescaté a Lima! ¿Puedes tú?');
  assert.equal(Daily.campaignShareText({ levelId: 10, stars: 3, rescued: ['lima'] }).split('\n')[1], 'Nivel 10 ⭐⭐⭐ ¡Rescaté a Lima! ¿Puedes tú?');
  assert.equal(Daily.campaignShareText({ levelId: 30, stars: 2, rescued: ['uva', 'banana'] }).split('\n')[1], 'Nivel 30 ⭐⭐ ¡Rescaté a Uva y a Banana! ¿Puedes tú?');
  assert.equal(Daily.campaignShareText({ levelId: 7, stars: 1, rescued: [] }).split('\n')[1], 'Nivel 7 ⭐ ¡Nivel superado! ¿Puedes tú?');
  assert.equal(Daily.campaignShareText({ levelId: 7, stars: 1 }).split('\n')[0], '🥥 Cocardo: ¡Rescate Helado!');
});
