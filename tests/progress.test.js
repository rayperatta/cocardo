/* Pruebas de Cocardo.Progress (fusión de guardados, resumen y apodos). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Progress = require('../js/core/progress.js');
const Save = require('../js/save.js');

function fresh() { return Save.defaults(); }

test('Progress.validNick: reglas del apodo', () => {
  assert.equal(Progress.validNick('Lima').ok, true);
  assert.equal(Progress.validNick('  Lima_22 ').nick, 'Lima_22');
  assert.equal(Progress.validNick('ab').ok, false);
  assert.equal(Progress.validNick('a'.repeat(17)).ok, false);
  assert.equal(Progress.validNick('con espacio').ok, false);
  assert.equal(Progress.validNick('hola!').ok, false);
  assert.equal(Progress.validNick('Admin').ok, false);
  assert.equal(Progress.validNick('MiErDa_x').ok, false);
  assert.equal(Progress.validNick('Piñita').ok, true);
  assert.equal(Progress.validNick('Piñita').key, 'pinita');
  assert.equal(Progress.normalizeNick('ÁnGel'), 'angel');
});

test('Progress.summary: estrellas, niveles, rescates y racha', () => {
  const d = fresh();
  d.stars[0] = 3; d.stars[1] = 1; d.stars[29] = 2;
  d.rescued = ['lima', 'fresa'];
  d.daily.bestStreak = 7;
  const s = Progress.summary(d);
  assert.deepEqual(s, { stars: 6, levels: 3, rescued: 2, bestStreak: 7, finished: true });
  assert.deepEqual(Progress.summary(null), { stars: 0, levels: 0, rescued: 0, bestStreak: 0, finished: false });
});

test('Progress.merge: lo mejor de los dos guardados sin perder nada', () => {
  const a = fresh(), b = fresh();
  a.stars[0] = 2; a.best[0] = 1200; a.unlocked = 3; a.rescued = ['lima']; a.seen = { pre1: true };
  a.boosters.cucharon = 2; a.boostersUnlocked.cucharon = true;
  a.daily = { last: 20261015, streak: 2, bestStreak: 2, results: { 20261015: { won: true, stars: 2, score: 500 } } };
  a.settings.sound = false;
  b.stars[0] = 3; b.stars[1] = 1; b.best[0] = 900; b.best[1] = 300; b.unlocked = 2; b.rescued = ['fresa']; b.seen = { post1: true };
  b.boosters.cucharon = 1; b.boosters.chorro = 3; b.boostersUnlocked.chorro = true;
  b.daily = { last: 20261016, streak: 5, bestStreak: 5, results: { 20261016: { won: false, stars: 0, score: 100 }, 20261015: { won: true, stars: 1, score: 100 } } };
  const m = Progress.merge(a, b);
  assert.equal(m.stars[0], 3);
  assert.equal(m.stars[1], 1);
  assert.equal(m.best[0], 1200);
  assert.equal(m.best[1], 300);
  assert.equal(m.unlocked, 3);
  assert.deepEqual(m.rescued, ['lima', 'fresa']);
  assert.deepEqual(m.seen, { pre1: true, post1: true });
  assert.equal(m.boosters.cucharon, 2);
  assert.equal(m.boosters.chorro, 3);
  assert.equal(m.boostersUnlocked.cucharon, true);
  assert.equal(m.boostersUnlocked.chorro, true);
  assert.equal(m.daily.last, 20261016);
  assert.equal(m.daily.streak, 5, 'la racha vigente es la del guardado con el día más reciente');
  assert.equal(m.daily.bestStreak, 5);
  assert.equal(m.daily.results[20261015].score, 500, 'si un día está en los dos gana el local');
  assert.equal(m.daily.results[20261016].won, false);
  assert.equal(m.settings.sound, false, 'los ajustes son del aparato (local)');
  // el guardado fusionado pasa por Save.sanitize sin pérdidas
  assert.equal(m.v, 1);
});

test('Progress.merge: con nube vacía o basura devuelve el local intacto', () => {
  const a = fresh();
  a.stars[4] = 3; a.unlocked = 6;
  const m = Progress.merge(a, null);
  assert.deepEqual(m.stars, a.stars);
  assert.equal(m.unlocked, 6);
  const m2 = Progress.merge(a, { stars: 'x', unlocked: 999, boosters: 5, daily: 'no' });
  assert.equal(m2.unlocked, 30, 'el desbloqueo se limita a 30');
  assert.deepEqual(m2.stars, a.stars);
});

test('Progress.merge: el desbloqueo nunca queda atrás de las estrellas', () => {
  const a = fresh(), b = fresh();
  b.stars[9] = 1;
  const m = Progress.merge(a, b);
  assert.equal(m.unlocked, 11);
});

test('Progress.forCloud: sin ajustes', () => {
  const a = fresh();
  a.settings.music = true;
  const c = Progress.forCloud(a);
  assert.equal(c.settings, undefined);
  assert.equal(c.v, 1);
  assert.equal(Array.isArray(c.stars), true);
});
