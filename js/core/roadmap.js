/* Cocardo: ¡Rescate Helado! — Hoja de ruta: capítulos en construcción con fecha de apertura (datos puros).
   Contrato: docs/ARQUITECTURA.md §17. Calendario, reglas de decisión y cómo construir un capítulo: docs/CALENDARIO.md.

   Dos listas distintas:
   - Cocardo.Levels.chapters: capítulos CONSTRUIDOS (sus niveles existen). Un capítulo construido puede traer
     `opens` ('YYYY-MM-DD'): hasta ese día se ve en el mapa como «programado» (con fecha) y no se puede jugar.
   - Roadmap.planned: capítulos EN CONSTRUCCIÓN (todavía sin niveles). El mapa los pinta como zonas en obra con
     sus nodos fantasma, nombre, teaser y fecha prevista. Al construir un capítulo se copia su entrada a
     Levels.chapters (con `opens`); si queda también aquí no pasa nada: la entrada de Levels manda.

   `opens` admite tres precisiones: 'YYYY-MM-DD' (día exacto: se promete), 'YYYY-MM' (mes previsto) y 'YYYY'
   (año previsto). Solo se promete día exacto cuando el capítulo ya está construido o a menos de 6 semanas.
   La fecha se compara con la fecha LOCAL del jugador (clave YYYYMMDD, igual que el Reto Diario): el capítulo
   abre a la medianoche local de cada quien, sin depender de la red. Módulo puro: sin Date ni Math.random. */
(function () {
  'use strict';
  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  var LEVELS_PER_CHAPTER = 5;
  // Tope de los arreglos del guardado (stars/best) y de los límites de la nube (reglas de Firestore):
  // 24 capítulos × 5 niveles. Si algún día se planea más allá, súbelo aquí, en firebase/firestore.rules y en
  // js/cloud.js, y despliega las reglas ANTES de abrir ese capítulo.
  var MAX_LEVELS = 120;

  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  // ---------- temporadas ----------
  var seasons = [
    { id: 1, name: 'La Nieve de Lima', chapters: [1, 2, 3, 4, 5, 6] },
    { id: 2, name: 'El regreso de Cherry', chapters: [7, 8, 9, 10, 11, 12] },
    { id: 3, name: 'El pedido de Don Piña', chapters: [13, 14, 15, 16, 17, 18] },
    { id: 4, name: 'El último golpecito', chapters: [19, 20, 21, 22, 23, 24] },
  ];

  function range(first, n) { var a = []; for (var i = 0; i < n; i++) a.push(first + i); return a; }
  function C(o) {
    return {
      id: o.id, season: o.season, name: o.name, zone: o.zone, color: o.color, teaser: o.teaser,
      levels: range((o.id - 1) * LEVELS_PER_CHAPTER + 1, LEVELS_PER_CHAPTER), opens: o.opens,
    };
  }

  // ---------- capítulos en construcción (continuación propia del juego, no de la serie) ----------
  // Nombre ≤ 26 caracteres (rótulo del mapa), teaser ≤ 70 (sin spoilers de temporadas anteriores). Fechas: docs/CALENDARIO.md §2.
  // La zona debe caer en un fondo que Art.background sepa pintar (zoneKey en js/art.js: cherry, congela, pina/oficina/mansion,
  // trastienda/callejon, noche/calle/comisaria/policia; lo demás es la heladería). Historia: docs/CALENDARIO.md §6.
  var planned = [
    // ===== Temporada 2 · El regreso de Cherry =====
    C({ id: 7, season: 2, name: 'Cherry… interesante', zone: 'La oficina de Don Piña', color: '#c99a3a', opens: '2026-10-30',
      teaser: 'Don Piña tiene pedidos, dinero… y nadie que le haga el helado.' }),
    C({ id: 8, season: 2, name: 'Se renta local', zone: "Coco's Scoops, cerrada", color: '#7a4a8a', opens: '2026-11',
      teaser: 'Hay letrero nuevo en Coco\'s Scoops. Y alguien entra de noche.' }),
    C({ id: 9, season: 2, name: 'Visita en la cárcel', zone: 'La comisaría', color: '#2f4f7a', opens: '2026-11',
      teaser: 'Hay visita en la comisaría… y el oficial Sandía no ve nada.' }),
    C({ id: 10, season: 2, name: 'La sucursal', zone: 'La heladería de Cherry', color: '#d61f4b', opens: '2026-12',
      teaser: 'Letrero nuevo, congelador rosado… y un sabor que sabe a nada.' }),
    C({ id: 11, season: 2, name: 'Todas las unidades', zone: 'La noche de la persecución', color: '#5b1e74', opens: '2027-01',
      teaser: 'Banano y la oficial siguen la pista del camión de helados.' }),
    C({ id: 12, season: 2, name: 'Se derrite el imperio', zone: 'El congelador rosado', color: '#ff6fa5', opens: '2027-01',
      teaser: 'Final de temporada: Cherry contra todos. Y un apagón más.' }),
    // ===== Temporada 3 · El pedido de Don Piña =====
    C({ id: 13, season: 3, name: 'Un hombre de palabra', zone: 'La mansión de Don Piña', color: '#8a1c3a', opens: '2027-02',
      teaser: 'Don Piña ya no quiere comprar helado: quiere la fórmula.' }),
    C({ id: 14, season: 3, name: 'El guardaespaldas', zone: 'El estacionamiento, de noche', color: '#3a3f58', opens: '2027-03',
      teaser: 'Habla poco, pega fuerte… y ahora maneja el congelador.' }),
    C({ id: 15, season: 3, name: 'Helado de importación', zone: 'El puerto, de noche', color: '#2a6fb0', opens: '2027-04',
      teaser: 'Contenedores llenos de hielo. Limón vio algo raro en el muelle.' }),
    C({ id: 16, season: 3, name: 'La reportera', zone: 'La calle del noticiero', color: '#f2b632', opens: '2027-04',
      teaser: 'Investigó demasiado. Hoy no salió al aire.' }),
    C({ id: 17, season: 3, name: 'El socio secreto', zone: 'La trastienda', color: '#4aa8e0', opens: '2027-05',
      teaser: 'Alguien de adentro le pasa la receta a Don Piña.' }),
    C({ id: 18, season: 3, name: 'Quinientos litros', zone: 'La fábrica congeladora', color: '#a1286a', opens: '2027-06',
      teaser: 'Final de temporada: el pedido más grande de la historia.' }),
    // ===== Temporada 4 · El último golpecito =====
    C({ id: 19, season: 4, name: 'Luces', zone: 'La celda de la comisaría', color: '#2b1630', opens: '2027',
      teaser: 'Se fue la luz en la comisaría. Y el oficial Sandía perdió algo.' }),
    C({ id: 20, season: 4, name: 'Está experimentado', zone: 'La fábrica congeladora', color: '#7a4a2a', opens: '2027',
      teaser: 'El congelador viejo vuelve a ronronear.' }),
    C({ id: 21, season: 4, name: 'Prima al rescate', zone: 'El callejón', color: '#9be15d', opens: '2027',
      teaser: 'Lima y Fresa ya no esperan a nadie. Van por el congelador viejo.' }),
    C({ id: 22, season: 4, name: 'Tres villanos', zone: 'La terraza de la mansión', color: '#5b1e74', opens: '2027',
      teaser: 'Tres villanos, una mesa y cero confianza. Mala idea.' }),
    C({ id: 23, season: 4, name: 'La gran nevada', zone: 'La ciudad congelada', color: '#bfe9ff', opens: '2027',
      teaser: 'Toda la ciudad amanece bajo escarcha. ¡Drama!' }),
    C({ id: 24, season: 4, name: 'El último sabor', zone: 'El gran congelador', color: '#ffc93c', opens: '2027',
      teaser: 'Gran final: todos los congeladores, todos los rescates.' }),
  ];

  // ---------- fechas (calendario gregoriano, sin Date) ----------
  function daysFromCivil(y, m, d) {
    y -= m <= 2 ? 1 : 0;
    var era = Math.floor(y / 400);
    var yoe = y - era * 400;
    var doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  function split(key) {
    var k = Math.floor(Number(key));
    return { y: Math.floor(k / 10000), m: Math.floor(k / 100) % 100, d: k % 100 };
  }
  function keyDays(key) { var p = split(key); return daysFromCivil(p.y, p.m, p.d); }
  function dateKey(y, m, d) { return y * 10000 + m * 100 + d; }
  function daysInMonth(y, m) {
    if (m === 2) return (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28;
    return [4, 6, 9, 11].indexOf(m) >= 0 ? 30 : 31;
  }
  // 0 = domingo … 6 = sábado (el 1 de enero de 1970 fue jueves)
  function weekday(key) { return ((keyDays(key) + 4) % 7 + 7) % 7; }
  function daysBetween(a, b) { return keyDays(b) - keyDays(a); }

  // 'YYYY-MM-DD' | 'YYYY-MM' | 'YYYY' -> { precision, first, last } (claves YYYYMMDD) o null
  function parseOpens(s) {
    var m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(String(s == null ? '' : s));
    if (!m) return null;
    var y = +m[1], mo = m[2] ? +m[2] : 0, d = m[3] ? +m[3] : 0;
    if (y < 2026 || y > 2099) return null;
    if (m[2] && (mo < 1 || mo > 12)) return null;
    if (m[3]) {
      if (d < 1 || d > daysInMonth(y, mo)) return null;
      return { precision: 'dia', first: dateKey(y, mo, d), last: dateKey(y, mo, d) };
    }
    if (m[2]) return { precision: 'mes', first: dateKey(y, mo, 1), last: dateKey(y, mo, daysInMonth(y, mo)) };
    return { precision: 'anio', first: dateKey(y, 1, 1), last: dateKey(y, 12, 31) };
  }

  // Estado de un capítulo para la fecha local `today` (YYYYMMDD):
  //   'abierto'      construido y ya se puede jugar (sin fecha o fecha cumplida)
  //   'programado'   construido pero su fecha todavía no llega (se ve con fecha exacta)
  //   'construccion' sin niveles aún, fecha prevista por delante
  //   'retrasado'    sin niveles aún y la fecha prevista ya pasó (se muestra «¡ya casi!», nunca una fecha vieja)
  function stateFor(opens, built, today) {
    var p = parseOpens(opens);
    if (built) return (!p || today >= p.first) ? 'abierto' : 'programado';
    if (!p) return 'construccion';
    return today > p.last ? 'retrasado' : 'construccion';
  }

  function daysUntil(opens, today) {
    var p = parseOpens(opens);
    return p ? daysBetween(today, p.first) : null;
  }

  function dayText(key, withYear) {
    var p = split(key);
    return DAYS[weekday(key)] + ' ' + p.d + ' de ' + MONTHS[p.m - 1] + (withYear ? ' de ' + p.y : '');
  }

  // Texto para el mapa y la ficha del capítulo. Nunca muestra una fecha vencida como promesa.
  function whenText(opens, built, today) {
    var p = parseOpens(opens);
    var st = stateFor(opens, built, today);
    if (st === 'abierto') return p ? 'Abierto desde el ' + dayText(p.first, split(p.first).y !== split(today).y) : 'Abierto';
    if (st === 'retrasado') return 'En construcción · ¡ya casi!';
    if (!p) return 'En construcción';
    var sameYear = split(p.first).y === split(today).y;
    if (p.precision === 'dia') {
      var n = daysBetween(today, p.first);
      if (n === 0) return '¡Se abre hoy!';
      if (n === 1) return 'Se abre mañana';
      if (n < 7) return 'Se abre el ' + DAYS[weekday(p.first)];
      return 'Se abre el ' + dayText(p.first, !sameYear);
    }
    if (p.precision === 'mes') return 'Previsto para ' + MONTHS[split(p.first).m - 1] + (sameYear ? '' : ' de ' + split(p.first).y);
    return 'Previsto para ' + split(p.first).y;
  }

  function daysText(n) {
    if (n == null) return '';
    if (n <= 0) return '¡hoy!';
    if (n === 1) return 'falta 1 día';
    return 'faltan ' + n + ' días';
  }

  // ---------- consultas ----------
  function seasonOf(chapterId) {
    for (var i = 0; i < seasons.length; i++) if (seasons[i].chapters.indexOf(chapterId) >= 0) return seasons[i];
    return null;
  }

  function lastLevel(ch) { var l = ch && ch.levels; return l && l.length ? l[l.length - 1] : 0; }

  // Todos los capítulos en orden, con su estado para `today`: primero los construidos (builtChapters, normalmente
  // Cocardo.Levels.chapters) y después los planeados con id mayor que el último construido.
  function merged(builtChapters, today) {
    var out = [];
    var built = Array.isArray(builtChapters) ? builtChapters : [];
    var maxId = 0;
    built.forEach(function (ch) {
      var st = stateFor(ch.opens, true, today);
      var s = seasonOf(ch.id);
      out.push({
        id: ch.id, name: ch.name, zone: ch.zone, color: ch.color, levels: ch.levels, opens: ch.opens, teaser: ch.teaser || '',
        built: true, state: st, when: ch.opens ? whenText(ch.opens, true, today) : '', days: daysUntil(ch.opens, today),
        season: s ? s.id : null, seasonName: s ? s.name : '',
      });
      if (ch.id > maxId) maxId = ch.id;
    });
    planned.forEach(function (ch) {
      if (ch.id <= maxId) return;
      var st = stateFor(ch.opens, false, today);
      var s = seasonOf(ch.id);
      out.push({
        id: ch.id, name: ch.name, zone: ch.zone, color: ch.color, levels: ch.levels, opens: ch.opens, teaser: ch.teaser,
        built: false, state: st, when: whenText(ch.opens, false, today), days: daysUntil(ch.opens, today),
        season: s ? s.id : null, seasonName: s ? s.name : '',
      });
    });
    return out;
  }

  // Último nivel jugable hoy: los capítulos construidos abiertos, de corrido desde el primero (un capítulo
  // programado tapa a los que vengan después aunque ya estuvieran abiertos por fecha).
  function openCount(builtChapters, today) {
    var n = 0;
    var built = Array.isArray(builtChapters) ? builtChapters : [];
    for (var i = 0; i < built.length; i++) {
      if (stateFor(built[i].opens, true, today) !== 'abierto') break;
      n = Math.max(n, lastLevel(built[i]));
    }
    return n;
  }

  // Primer capítulo que todavía no se puede jugar (programado o en construcción), o null si no hay más.
  function nextOpening(builtChapters, today) {
    var all = merged(builtChapters, today);
    for (var i = 0; i < all.length; i++) if (all[i].state !== 'abierto') return all[i];
    return null;
  }

  function chapterOfLevel(builtChapters, levelId) {
    var all = merged(builtChapters, 0);
    for (var i = 0; i < all.length; i++) if (all[i].levels.indexOf(levelId) >= 0) return all[i];
    return null;
  }

  var Roadmap = {
    LEVELS_PER_CHAPTER: LEVELS_PER_CHAPTER,
    MAX_LEVELS: MAX_LEVELS,
    seasons: seasons,
    planned: planned,
    parseOpens: parseOpens,
    stateFor: stateFor,
    whenText: whenText,
    daysUntil: daysUntil,
    daysText: daysText,
    dayText: dayText,
    weekday: weekday,
    daysBetween: daysBetween,
    seasonOf: seasonOf,
    merged: merged,
    openCount: openCount,
    nextOpening: nextOpening,
    chapterOfLevel: chapterOfLevel,
  };

  Cocardo.Roadmap = Roadmap;
  if (typeof module !== 'undefined' && module.exports) module.exports = Roadmap;
})();
