/* Cocardo: ¡Rescate Helado! — Reto Diario (puro: sin Date, sin Math.random).
   Contrato: docs/ARQUITECTURA.md §6. Reglas: docs/DISENO.md §9.
   Quien llama pasa las partes de la fecha local (año, mes 1-12, día 1-31). */
(function () {
  'use strict';
  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  var TITLE = '🥥 Cocardo: ¡Rescate Helado!';
  var EPOCH_DAYS = daysFromCivil(2026, 10, 1); // Reto #1
  var NAMES = {
    cocardo: 'Cocardo', lima: 'Lima', cereza: 'Cherry', pina: 'Don Piña', banano: 'Banano', banana: 'Banana',
    fresa: 'Fresa', durazna: 'Durazna', uva: 'Uva', naranja: 'Naranja', limon: 'Limón',
    policia_fresa: 'La oficial', policia_sandia: 'El oficial Sandía', guardaespaldas: 'El guardaespaldas',
    brocoli: 'El repartidor', reportera: 'La reportera',
  };

  // Días desde 1970-01-01 en el calendario gregoriano proléptico (algoritmo de H. Hinnant).
  function daysFromCivil(y, m, d) {
    y -= m <= 2 ? 1 : 0;
    var era = Math.floor(y / 400);
    var yoe = y - era * 400;
    var doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  function splitKey(key) {
    var k = Math.floor(Number(key));
    return { y: Math.floor(k / 10000), m: Math.floor(k / 100) % 100, d: k % 100 };
  }
  function keyDays(key) { var p = splitKey(key); return daysFromCivil(p.y, p.m, p.d); }

  function dateKey(y, m, d) { return y * 10000 + m * 100 + d; }

  function challengeNumber(y, m, d) { return daysFromCivil(y, m, d) - EPOCH_DAYS + 1; }

  // Días entre dos claves YYYYMMDD (b - a). Útil para la racha: 1 = días seguidos.
  function daysBetween(keyA, keyB) { return keyDays(keyB) - keyDays(keyA); }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Nivel de campaña 6 + (D mod 20), con 2 movimientos menos, sin tutorial.
  function levelFor(key, levelsList) {
    var list = levelsList;
    if (!list && Cocardo.Levels) list = Cocardo.Levels.list;
    if (!list && typeof require === 'function') list = require('./levels.js').list;
    var id = 6 + (Math.floor(Number(key)) % 20);
    var base = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { base = list[i]; break; }
    if (!base) return null;
    var lvl = clone(base);
    lvl.daily = true;
    lvl.moves = base.moves - 2;
    delete lvl.teach;
    return lvl;
  }

  // Semilla del día = D: todos juegan el mismo tablero.
  function seedFor(key) { return Math.floor(Number(key)) >>> 0; }

  function moveEmoji(turnInfo) {
    var t = turnInfo || {};
    if (t.combo) return '🍦';
    var c = t.cascades !== undefined ? t.cascades : (t.maxCascade || 0);
    if (c >= 5) return '🟥';
    if (c >= 3) return '🟧';
    if (c === 2) return '🟨';
    return '⬜';
  }

  function stars(n) { var s = ''; for (var i = 0; i < n; i++) s += '⭐'; return s; }

  // Texto para compartir (DISENO §9):
  //   🥥 Cocardo: ¡Rescate Helado! · Reto #14
  //   ⭐⭐⭐ 13/20 movs · Combo x6        (al perder: ❌ 20/20 movs)
  //   10 emojis por fila, una por jugada
  //   🔥 Racha: 4
  function shareText(o) {
    o = o || {};
    var turns = (o.turns || []).filter(function (t) { return t && t.valid !== false; });
    var used = o.movesUsed !== undefined ? o.movesUsed : turns.length;
    var total = o.movesTotal !== undefined ? o.movesTotal : used;
    var lines = [TITLE + ' · Reto #' + o.num];
    var res;
    if (o.won) {
      res = stars(Math.max(1, Math.min(3, o.stars | 0))) + ' ' + used + '/' + total + ' movs';
      if ((o.maxCombo | 0) >= 2) res += ' · Combo x' + (o.maxCombo | 0);
    } else {
      res = '❌ ' + used + '/' + total + ' movs';
    }
    lines.push(res);
    for (var i = 0; i < turns.length; i += 10) {
      lines.push(turns.slice(i, i + 10).map(moveEmoji).join(''));
    }
    if ((o.streak | 0) > 0) lines.push('🔥 Racha: ' + (o.streak | 0));
    return lines.join('\n');
  }

  // «Nivel 10 ⭐⭐⭐ ¡Rescaté a Lima! ¿Puedes tú?» (la URL la agrega la UI si el protocolo es http/https).
  function campaignShareText(o) {
    o = o || {};
    var names = (o.rescued || []).map(function (x) { return NAMES[x] || String(x); });
    var brag;
    if (!names.length) brag = '¡Nivel superado!';
    else if (names.length === 1) brag = '¡Rescaté a ' + names[0] + '!';
    else brag = '¡Rescaté a ' + names.slice(0, -1).join(', a ') + ' y a ' + names[names.length - 1] + '!';
    var st = stars(Math.max(0, Math.min(3, o.stars | 0)));
    return TITLE + '\nNivel ' + o.levelId + (st ? ' ' + st : '') + ' ' + brag + ' ¿Puedes tú?';
  }

  var Daily = {
    dateKey: dateKey,
    challengeNumber: challengeNumber,
    daysBetween: daysBetween,
    levelFor: levelFor,
    seedFor: seedFor,
    moveEmoji: moveEmoji,
    shareText: shareText,
    campaignShareText: campaignShareText,
  };

  Cocardo.Daily = Daily;
  if (typeof module !== 'undefined' && module.exports) module.exports = Daily;
})();
