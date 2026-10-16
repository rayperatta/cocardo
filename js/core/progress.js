/* Cocardo: ¡Rescate Helado! — Progreso en la nube (puro: sin Date, sin Math.random, sin DOM).
   Contrato: docs/ARQUITECTURA.md §14. Lo usan Cocardo.Cloud (navegador) y las pruebas (Node).
   - merge(a, b): junta dos guardados (local y nube) sin perder nada: lo mejor de cada uno.
   - summary(d): resumen público del progreso para el ranking (estrellas, niveles, rescates).
   - validNick(s) / normalizeNick(s): reglas del apodo (3–16 letras, números, _ ; sin groserías). */
(function () {
  'use strict';
  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  var LEVELS = 30;
  var BOOSTERS = ['cucharon', 'chorro', 'batido'];
  var NICK_RE = /^[A-Za-z0-9_ÁÉÍÓÚÜÑáéíóúüñ]{3,16}$/;
  // palabras reservadas o que no queremos ver en un ranking público (lista corta, sin acentos ni mayúsculas)
  var BLOCKED = ['admin', 'moderador', 'cocardo_oficial', 'frutasalocadas', 'frutitaenlatada', 'puta', 'puto', 'mierda',
    'pendejo', 'pendeja', 'verga', 'culo', 'marica', 'maricon', 'nazi', 'hitler', 'sexo', 'porno', 'cabron', 'cabrona',
    'chingar', 'chinga', 'joder', 'coño', 'cono', 'polla', 'pinga', 'gonorrea', 'malparido', 'hijueputa', 'hdp'];

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function num(v, def, lo, hi) {
    var n = Number(v);
    if (!isFinite(n)) return def;
    n = Math.floor(n);
    return n < lo ? lo : (n > hi ? hi : n);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fill(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }

  // Quita acentos y pasa a minúsculas (clave única del apodo: «Lima» y «lima» son el mismo)
  function normalizeNick(s) {
    var t = String(s == null ? '' : s).trim();
    try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* sin normalize: se queda igual */ }
    return t.toLowerCase();
  }

  // Devuelve { ok:true, nick } o { ok:false, reason:'…' } (texto listo para mostrar)
  function validNick(s) {
    var nick = String(s == null ? '' : s).trim();
    if (nick.length < 3) return { ok: false, reason: 'Mínimo 3 letras' };
    if (nick.length > 16) return { ok: false, reason: 'Máximo 16 letras' };
    if (!NICK_RE.test(nick)) return { ok: false, reason: 'Solo letras, números y guion bajo' };
    var key = normalizeNick(nick).replace(/_/g, '');
    for (var i = 0; i < BLOCKED.length; i++) {
      if (key.indexOf(BLOCKED[i]) >= 0) return { ok: false, reason: 'Ese apodo no se puede usar' };
    }
    return { ok: true, nick: nick, key: normalizeNick(nick) };
  }

  // Resumen público (lo que ve el ranking general). Nunca incluye ajustes ni datos privados.
  function summary(d) {
    d = isObj(d) ? d : {};
    var stars = Array.isArray(d.stars) ? d.stars : [];
    var total = 0, levels = 0;
    for (var i = 0; i < LEVELS; i++) {
      var s = num(stars[i], 0, 0, 3);
      total += s;
      if (s > 0) levels++;
    }
    var daily = isObj(d.daily) ? d.daily : {};
    return {
      stars: total,
      levels: levels,
      rescued: Array.isArray(d.rescued) ? d.rescued.length : 0,
      bestStreak: num(daily.bestStreak, 0, 0, 1e6),
      finished: num(stars[LEVELS - 1], 0, 0, 3) > 0,
    };
  }

  // Junta dos guardados. Reglas: estrellas y récords = el máximo; desbloqueo = el máximo; rescatados y escenas
  // vistas = la unión; potenciadores = el máximo de cada uno (nunca se duplican); reto diario = la racha más
  // larga y los resultados de ambos (si un día está en los dos, gana el local). Ajustes: los del primero (local).
  function merge(local, cloud) {
    var a = isObj(local) ? clone(local) : {};
    var b = isObj(cloud) ? cloud : {};
    var out = a;
    out.v = 1;
    out.unlocked = Math.max(num(a.unlocked, 1, 1, LEVELS), num(b.unlocked, 1, 1, LEVELS));
    var as = Array.isArray(a.stars) ? a.stars : [], bs = Array.isArray(b.stars) ? b.stars : [];
    var ab = Array.isArray(a.best) ? a.best : [], bb = Array.isArray(b.best) ? b.best : [];
    out.stars = fill(LEVELS, 0);
    out.best = fill(LEVELS, 0);
    for (var i = 0; i < LEVELS; i++) {
      out.stars[i] = Math.max(num(as[i], 0, 0, 3), num(bs[i], 0, 0, 3));
      out.best[i] = Math.max(num(ab[i], 0, 0, 1e9), num(bb[i], 0, 0, 1e9));
      if (out.stars[i] > 0) out.unlocked = Math.max(out.unlocked, Math.min(LEVELS, i + 2));
    }
    out.boosters = isObj(a.boosters) ? a.boosters : {};
    out.boostersUnlocked = isObj(a.boostersUnlocked) ? a.boostersUnlocked : {};
    BOOSTERS.forEach(function (k) {
      out.boosters[k] = Math.max(num(out.boosters[k], 0, 0, 9), num(isObj(b.boosters) ? b.boosters[k] : 0, 0, 0, 9));
      out.boostersUnlocked[k] = !!out.boostersUnlocked[k] || !!(isObj(b.boostersUnlocked) && b.boostersUnlocked[k]);
    });
    out.rescued = Array.isArray(a.rescued) ? a.rescued.slice() : [];
    (Array.isArray(b.rescued) ? b.rescued : []).forEach(function (w) {
      if (typeof w === 'string' && w.length < 40 && out.rescued.indexOf(w) < 0) out.rescued.push(w);
    });
    out.seen = isObj(a.seen) ? a.seen : {};
    if (isObj(b.seen)) Object.keys(b.seen).forEach(function (k) { if (k.length < 60 && b.seen[k]) out.seen[k] = true; });
    var ad = isObj(a.daily) ? a.daily : {}, bd = isObj(b.daily) ? b.daily : {};
    out.daily = {
      last: Math.max(num(ad.last, 0, 0, 99991231), num(bd.last, 0, 0, 99991231)),
      streak: 0, bestStreak: 0, results: {},
    };
    // la racha vigente es la del guardado con el último día jugado más reciente (si empatan, la mayor)
    var al = num(ad.last, 0, 0, 99991231), bl = num(bd.last, 0, 0, 99991231);
    if (al > bl) out.daily.streak = num(ad.streak, 0, 0, 1e6);
    else if (bl > al) out.daily.streak = num(bd.streak, 0, 0, 1e6);
    else out.daily.streak = Math.max(num(ad.streak, 0, 0, 1e6), num(bd.streak, 0, 0, 1e6));
    out.daily.bestStreak = Math.max(num(ad.bestStreak, 0, 0, 1e6), num(bd.bestStreak, 0, 0, 1e6), out.daily.streak);
    if (isObj(bd.results)) Object.keys(bd.results).forEach(function (k) { if (/^\d{8}$/.test(k) && isObj(bd.results[k])) out.daily.results[k] = clone(bd.results[k]); });
    if (isObj(ad.results)) Object.keys(ad.results).forEach(function (k) { if (/^\d{8}$/.test(k) && isObj(ad.results[k])) out.daily.results[k] = clone(ad.results[k]); });
    out.settings = isObj(a.settings) ? a.settings : (isObj(b.settings) ? clone(b.settings) : {});
    return out;
  }

  // Lo que se sube a la nube: el progreso sin ajustes (los ajustes son de cada aparato)
  function forCloud(d) {
    var c = merge(d, null);
    delete c.settings;
    return c;
  }

  var Progress = {
    LEVELS: LEVELS,
    merge: merge,
    summary: summary,
    forCloud: forCloud,
    validNick: validNick,
    normalizeNick: normalizeNick,
    NICK_RE: NICK_RE,
  };
  Cocardo.Progress = Progress;
  if (typeof module !== 'undefined' && module.exports) module.exports = Progress;
})();
