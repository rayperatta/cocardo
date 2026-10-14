/* Cocardo: ¡Rescate Helado! — Guardado de progreso (localStorage con respaldo en memoria).
 * Contrato: docs/ARQUITECTURA.md §10. Formato y reglas: docs/DISENO.md §14.
 * Todo acceso a localStorage pasa por aquí, siempre dentro de try/catch. */
(function () {
  'use strict';

  var root = typeof window !== 'undefined' ? window : null;
  var Cocardo = root ? (root.Cocardo = root.Cocardo || {}) : {};

  var KEY = 'cocardo.v1';
  var BACKUP_KEY = 'cocardo.v1.backup';   // copia del guardado de una versión más nueva
  var LEVELS = 30;
  var BOOSTERS = ['cucharon', 'chorro', 'batido'];
  var BOOSTER_CAP = 9;
  var DAILY_KEEP = 7;

  var data = null;        // objeto único en memoria (misma identidad siempre)
  var memCopy = null;     // respaldo si localStorage no está disponible
  var storageOk = null;
  var foreign = false;    // hay un guardado de una versión más nueva: no se sobrescribe (solo memoria)

  function fill(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }

  function defaults() {
    return {
      v: 1,
      unlocked: 1,
      stars: fill(LEVELS, 0),
      best: fill(LEVELS, 0),
      boosters: { cucharon: 0, chorro: 0, batido: 0 },
      boostersUnlocked: { cucharon: false, chorro: false, batido: false },
      rescued: [],
      seen: {},
      daily: { last: 0, streak: 0, bestStreak: 0, results: {} },
      settings: { sound: true, vibra: true, motion: 'auto', music: false, skipStory: false },
    };
  }

  // Acceso seguro a localStorage (en iframes aislados puede lanzar SecurityError)
  function store() {
    try {
      var ls = root && root.localStorage;
      if (!ls) return null;
      if (storageOk === null) {
        var t = '__cocardo_test__';
        ls.setItem(t, '1');
        ls.removeItem(t);
        storageOk = true;
      }
      return storageOk ? ls : null;
    } catch (e) {
      storageOk = false;
      return null;
    }
  }

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function num(v, def, lo, hi) {
    var n = Number(v);
    if (!isFinite(n)) return def;
    n = Math.floor(n);
    return n < lo ? lo : (n > hi ? hi : n);
  }

  // Mezcla datos leídos con los valores por defecto, validando tipos. Devuelve null si no sirven.
  function sanitize(raw) {
    if (!isObj(raw) || raw.v !== 1) return null;
    var d = defaults();
    d.unlocked = num(raw.unlocked, 1, 1, LEVELS);
    if (Array.isArray(raw.stars)) for (var i = 0; i < LEVELS; i++) d.stars[i] = num(raw.stars[i], 0, 0, 3);
    if (Array.isArray(raw.best)) for (var j = 0; j < LEVELS; j++) d.best[j] = num(raw.best[j], 0, 0, 1e9);
    BOOSTERS.forEach(function (b) {
      if (isObj(raw.boosters)) d.boosters[b] = num(raw.boosters[b], 0, 0, BOOSTER_CAP);
      if (isObj(raw.boostersUnlocked)) d.boostersUnlocked[b] = !!raw.boostersUnlocked[b];
    });
    if (Array.isArray(raw.rescued)) {
      raw.rescued.forEach(function (w) {
        if (typeof w === 'string' && w.length < 40 && d.rescued.indexOf(w) < 0) d.rescued.push(w);
      });
    }
    if (isObj(raw.seen)) {
      Object.keys(raw.seen).forEach(function (k) { if (k.length < 60) d.seen[k] = !!raw.seen[k]; });
    }
    if (isObj(raw.daily)) {
      d.daily.last = num(raw.daily.last, 0, 0, 99991231);
      d.daily.streak = num(raw.daily.streak, 0, 0, 1e6);
      d.daily.bestStreak = num(raw.daily.bestStreak, 0, 0, 1e6);
      if (d.daily.bestStreak < d.daily.streak) d.daily.bestStreak = d.daily.streak;
      if (isObj(raw.daily.results)) {
        Object.keys(raw.daily.results).forEach(function (k) {
          if (/^\d{8}$/.test(k) && isObj(raw.daily.results[k])) d.daily.results[k] = cleanResult(raw.daily.results[k]);
        });
      }
    }
    if (isObj(raw.settings)) {
      var s = raw.settings;
      if (typeof s.sound === 'boolean') d.settings.sound = s.sound;
      if (typeof s.vibra === 'boolean') d.settings.vibra = s.vibra;
      if (typeof s.music === 'boolean') d.settings.music = s.music;
      if (typeof s.skipStory === 'boolean') d.settings.skipStory = s.skipStory;
      if (s.motion === 'auto' || s.motion === 'on' || s.motion === 'off') d.settings.motion = s.motion;
    }
    // el nivel desbloqueado nunca queda por detrás de lo ya superado
    for (var k = 0; k < LEVELS; k++) {
      if (d.stars[k] > 0) d.unlocked = Math.max(d.unlocked, Math.min(LEVELS, k + 2));
    }
    trimDaily(d);
    return d;
  }

  // Resultado de un reto diario, campo por campo (un guardado editado a mano no rompe la pantalla del Reto)
  function cleanResult(r) {
    var won = !!r.won;
    return {
      won: won,
      stars: won ? num(r.stars, 1, 1, 3) : 0,
      score: num(r.score, 0, 0, 1e9),
      movesUsed: num(r.movesUsed, 0, 0, 999),
      movesTotal: num(r.movesTotal, 0, 0, 999),
      maxCombo: num(r.maxCombo, 0, 0, 999),
      num: num(r.num, 0, 0, 1e6),
      text: typeof r.text === 'string' ? r.text.slice(0, 600) : '',
    };
  }

  // Solo se guardan los últimos 7 resultados diarios
  function trimDaily(d) {
    try {
      var keys = Object.keys(d.daily.results).sort(function (a, b) { return Number(b) - Number(a); });
      for (var i = DAILY_KEEP; i < keys.length; i++) delete d.daily.results[keys[i]];
    } catch (e) { /* nada */ }
  }

  // Copia los campos de src dentro del objeto único `data` (mantiene la identidad)
  function adopt(src) {
    if (!data) data = {};
    Object.keys(data).forEach(function (k) { delete data[k]; });
    Object.keys(src).forEach(function (k) { data[k] = src[k]; });
    return data;
  }

  function readRaw() {
    var ls = store();
    var txt = null;
    if (ls) {
      try { txt = ls.getItem(KEY); } catch (e) { txt = null; }
    }
    if (txt == null) txt = memCopy;
    return txt;
  }

  function load() {
    var parsed = null;
    try {
      var txt = readRaw();
      if (txt) {
        var raw = JSON.parse(txt);
        if (isObj(raw) && typeof raw.v === 'number' && raw.v > 1) {
          // guardado de una versión más nueva (p. ej. se abrió una copia vieja del juego): se respalda y
          // esta versión juega solo en memoria, sin pisarlo
          foreign = true;
          backup(txt);
        }
        parsed = sanitize(raw);
      }
    } catch (e) {
      parsed = null;
    }
    return adopt(parsed || defaults());
  }

  function backup(txt) {
    var ls = store();
    if (!ls) return;
    try { ls.setItem(BACKUP_KEY, txt); } catch (e) { /* sin espacio: el original sigue intacto */ }
  }

  function get() {
    return data || load();
  }

  function save() {
    try {
      var d = get();
      trimDaily(d);
      var txt = JSON.stringify(d);
      memCopy = txt;
      var ls = foreign ? null : store();
      if (ls) {
        try { ls.setItem(KEY, txt); } catch (e) { /* cuota llena o bloqueado: queda en memoria */ }
      }
    } catch (e) { /* nunca lanza */ }
  }

  function reset() {
    adopt(defaults());
    save();
    return data;
  }

  Cocardo.Save = {
    load: load,
    get: get,
    save: save,
    reset: reset,
    defaults: defaults,
    KEY: KEY,
    BOOSTER_CAP: BOOSTER_CAP,
    isPersistent: function () { return !foreign && !!store(); },
    // true si hay un guardado de una versión más nueva que esta copia del juego no toca
    isForeign: function () { return foreign; },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Cocardo.Save;
})();
