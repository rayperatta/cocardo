/* Cocardo: ¡Rescate Helado! — los 30 niveles de la campaña (datos puros).
   Contrato: docs/ARQUITECTURA.md §4.1 y §5. Diseño: docs/DISENO.md §7, con los villanos y los congeladores
   adaptados al canon de docs/PERSONAJES.md (Cocardo escarcha, Cherry convierte fruta en cajas del inventario).
   Leyenda del layout: '#' vacío · '.' fruta · 'e' fruta escarchada · '1' '2' '3' hielo · 'K' caja ·
   'R' fruta congelada (rescue[] en orden de lectura) · 'C' congelador 2×2 · 'T' ficha (tokens.skin). */
(function () {
  'use strict';
  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  // ---------- atajos (cada llamada devuelve un objeto nuevo) ----------
  function color(c, n) { return { type: 'color', color: c, n: n }; }
  function ice() { return { type: 'ice' }; }
  function crates(n) { return { type: 'crate', n: n }; }
  function rescue() { return { type: 'rescue' }; }
  function token() { return { type: 'token' }; }
  function boss() { return { type: 'boss' }; }
  // Cocardo escarcha fruta; Cherry la convierte en cajas. src 'boss' = el rayo sale del congelador.
  function frost(every, count, src) { return { who: 'cocardo', act: 'frost', every: every, count: count || 1, src: src || 'hud' }; }
  function crate(every, count) { return { who: 'cereza', act: 'crate', every: every, count: count || 1, src: 'hud' }; }

  function L(o) {
    var lvl = {
      id: o.id, chapter: Math.ceil(o.id / 5), name: o.name,
      boss: !!o.boss, hard: !!o.hard, final: !!o.final,
      layout: o.layout, colors: o.colors, moves: o.moves, goals: o.goals,
      villains: o.villains || [],
    };
    ['rescue', 'friendHP', 'freezer', 'tokens', 'ensure', 'teach'].forEach(function (k) {
      if (o[k] !== undefined) lvl[k] = o[k];
    });
    return lvl;
  }

  var list = [
    // ===== Capítulo 1 · La nieve de Lima (Parte 1) — Coco's Scoops está en quiebra =====
    L({ id: 1, name: 'Prende menos luces', colors: 'LFBU', moves: 20, teach: 'swap',
      goals: [color('L', 12)],
      layout: [
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
      ] }),
    L({ id: 2, name: 'Está experimentado', colors: 'LFBU', moves: 20, teach: 'paleta', ensure: 'ph',
      goals: [color('F', 15), color('B', 15)],
      layout: [
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
      ] }),
    L({ id: 3, name: 'Huele a quemado', colors: 'LFBUN', moves: 20, teach: 'bomba', ensure: 'bomba',
      goals: [color('U', 18)],
      layout: [
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
        '.......',
      ] }),
    L({ id: 4, name: 'Hielo de importación', colors: 'LFBUN', moves: 22, teach: 'hielo',
      goals: [ice()],
      layout: [
        '........',
        '........',
        '........',
        '..1111..',
        '..1111..',
        '........',
        '........',
        '........',
      ] }),
    L({ id: 5, name: 'Dale un golpecito', boss: true, colors: 'LFBUN', moves: 24, teach: 'copa', ensure: 'copa',
      goals: [color('N', 20), ice()],
      layout: [
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '1......1',
        '11111111',
      ] }),

    // ===== Capítulo 2 · Necesitamos un nuevo sabor (Partes 2-3) — Fresa y el trato de Don Piña =====
    L({ id: 6, name: 'Uno por persona', colors: 'LFBUN', moves: 17, teach: 'hp2',
      goals: [ice()],
      layout: [
        '11111111',
        '........',
        '........',
        '..222...',
        '..222...',
        '........',
        '........',
        '........',
      ] }),
    L({ id: 7, name: 'Depende quién pregunte', colors: 'LFBND', moves: 17, teach: 'cucharon',
      // primer «Pedido de Piña»: tres sabores a la vez
      goals: [color('L', 18), color('F', 18), color('D', 18)],
      layout: [
        '##....##',
        '#......#',
        '........',
        '........',
        '........',
        '........',
        '#......#',
        '##....##',
      ] }),
    L({ id: 8, name: 'Es orgánico', colors: 'LFBUN', moves: 17, teach: 'escarcha',
      goals: [color('B', 25)],
      layout: [
        '........',
        '........',
        '.eeeeee.',
        '........',
        '........',
        '.eeeeee.',
        '........',
        '........',
      ] }),
    L({ id: 9, name: '¿Ayudas o estorbas?', colors: 'LFBUN', moves: 20, teach: 'villano',
      goals: [color('U', 25), ice()],
      villains: [frost(5)],
      layout: [
        '........',
        '........',
        '...22...',
        '..2##2..',
        '..2##2..',
        '...22...',
        '........',
        '........',
      ] }),
    L({ id: 10, name: 'El congelador viejo', boss: true, colors: 'LFBUN', moves: 20, teach: 'congelador',
      goals: [boss(), rescue()],
      freezer: { who: 'cocardo', hp: 8, label: 'El congelador viejo' },
      rescue: ['lima'], friendHP: 2,
      villains: [frost(4, 1, 'boss')],
      layout: [
        '........',
        '...CC...',
        '...CC...',
        '........',
        '........',
        '........',
        '...R....',
        '........',
      ] }),

    // ===== Capítulo 3 · Voy a ampliar el menú (Partes 4-5) — el congelador grande =====
    L({ id: 11, name: '¿Para qué tanto espacio?', colors: 'LFBUN', moves: 17, teach: 'chorro',
      goals: [color('L', 25), color('N', 25)],
      villains: [frost(5)],
      layout: [
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
      ] }),
    L({ id: 12, name: 'Helado gratis de por vida', colors: 'LFBUND', moves: 25, teach: 'colores6',
      goals: [ice()],
      layout: [
        '##....##',
        '#......#',
        '..2222..',
        '..2332..',
        '..2332..',
        '..2222..',
        '#......#',
        '##....##',
      ] }),
    L({ id: 13, name: 'Prima al rescate', colors: 'LFBUN', moves: 17,
      goals: [rescue(), ice()],
      rescue: ['fresa'], friendHP: 2,
      villains: [frost(5)],
      layout: [
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '..111...',
        '111R1111',
      ] }),
    L({ id: 14, name: 'A la hora del cierre', colors: 'LFBND', moves: 19, teach: 'batido',
      goals: [color('D', 25), ice()],
      villains: [frost(4)],
      layout: [
        '##....##',
        '##eeee##',
        '........',
        '22....22',
        '22....22',
        '........',
        '##....##',
        '##....##',
      ] }),
    L({ id: 15, name: 'El congelador grande', boss: true, colors: 'LFBND', moves: 25,
      goals: [boss(), rescue()],
      freezer: { who: 'cocardo', hp: 10, label: 'El congelador grande' },
      rescue: ['durazna'], friendHP: 3,
      villains: [frost(4, 1, 'boss')],
      // la fila de hielo de abajo no es meta: estorba
      layout: [
        '...CC...',
        '...CC...',
        '........',
        '........',
        '........',
        '......R.',
        '........',
        '11111111',
      ] }),

    // ===== Capítulo 4 · Cherry conoce el negocio (Partes 6-7) — las cajas del inventario =====
    L({ id: 16, name: 'Un imperio de helado', colors: 'LFBUN', moves: 17, teach: 'cajas',
      goals: [crates(12)],
      layout: [
        '........',
        '........',
        '........',
        '.KKKKKK.',
        '.KKKKKK.',
        '........',
        '........',
        '........',
      ] }),
    L({ id: 17, name: 'Denos el triple', colors: 'LFBUND', moves: 27, teach: 'cereza',
      goals: [crates(10), color('B', 25)],
      villains: [crate(5)],
      layout: [
        '........',
        '........',
        '.KKKKK..',
        '...##...',
        '...##...',
        '..KKKKK.',
        '........',
        '........',
      ] }),
    L({ id: 18, name: 'Demasiado familiar', colors: 'LFBUN', moves: 19,
      goals: [ice(), crates(8)],
      villains: [crate(5)],
      layout: [
        '##....##',
        '#111111#',
        '........',
        'K..KK..K',
        'K..KK..K',
        '........',
        '#.2222.#',
        '##2222##',
      ] }),
    L({ id: 19, name: 'Buenas noches, naranjita', hard: true, colors: 'LFBUND', moves: 17,
      // Cherry la congeló, pero Cocardo la guardó en su congelador viejo: él escarcha
      goals: [rescue(), crates(8)],
      rescue: ['naranja'], friendHP: 3,
      villains: [frost(5)],
      layout: [
        'KK....KK',
        '........',
        '........',
        '...K....',
        '..KRK...',
        '...K....',
        '........',
        '........',
      ] }),
    L({ id: 20, name: 'Socios del congelador', boss: true, colors: 'LFBUND', moves: 27, teach: 'dosvillanos',
      goals: [boss(), crates(10)],
      freezer: { who: 'cocardo', hp: 12, label: 'El congelador grande' },
      villains: [frost(4, 1, 'boss'), crate(6)],
      layout: [
        '.KKKKKK.',
        '........',
        '........',
        '...CC...',
        '...CC...',
        '........',
        '........',
        'KK....KK',
      ] }),

    // ===== Capítulo 5 · La fuga (Partes 8-10) — el apagón y las pruebas de Banano =====
    L({ id: 21, name: 'La fuga de Uva', colors: 'LFBUN', moves: 17, teach: 'ficha',
      goals: [token(), color('N', 20)],
      tokens: { skin: 'uva', total: 1, onBoard: 1 },
      villains: [crate(5)],
      layout: [
        '...T....',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
      ] }),
    L({ id: 22, name: 'Solo quiero respuestas', colors: 'LFBUN', moves: 32, teach: 'pruebas',
      // 5 sabores (DISENO decía 6): con 6 en el embudo de la CRUZ las pruebas se atascan
      goals: [token(), crates(8)],
      tokens: { skin: 'prueba', total: 3, onBoard: 1 },
      villains: [crate(5)],
      layout: [
        '##.T..##',
        '##....##',
        '........',
        '........',
        'KK....KK',
        'KK....KK',
        '##....##',
        '##....##',
      ] }),
    L({ id: 23, name: 'Tenías suerte', hard: true, colors: 'LFBUND', moves: 20,
      goals: [ice()],
      villains: [crate(4)],
      layout: [
        '........',
        '........',
        '22222222',
        '........',
        '........',
        '11111111',
        '........',
        '...33...',
      ] }),
    L({ id: 24, name: 'La grabación', colors: 'LFBND', moves: 37,
      // 5 sabores en los niveles normales de pruebas, para que no queden más duros que los ⚠
      goals: [token(), crates(10)],
      tokens: { skin: 'prueba', total: 4, onBoard: 2 },
      villains: [crate(4)],
      layout: [
        '.T....T.',
        '........',
        '..KKKK..',
        'K..##...',
        '...##..K',
        '..KKKK..',
        '........',
        '........',
      ] }),
    L({ id: 25, name: 'El congelador de Cherry', boss: true, colors: 'LFBUND', moves: 40,
      goals: [boss(), token()],
      freezer: { who: 'cereza', hp: 14, label: 'El congelador de Cherry' },
      tokens: { skin: 'prueba', total: 2, onBoard: 2 },
      // el congelador rosado de Cherry también suelta escarcha
      villains: [{ who: 'cereza', act: 'frost', every: 3, count: 1, src: 'boss' }],
      layout: [
        'T......T',
        '...CC...',
        '...CC...',
        '........',
        '........',
        '........',
        '........',
        '........',
      ] }),

    // ===== Capítulo 6 · Se acabó el sabor (Partes 11-13) — la pulsera, el choque y el deshielo =====
    L({ id: 26, name: 'La pulsera', colors: 'LFBUD', moves: 30,
      goals: [ice(), token()],
      tokens: { skin: 'prueba', total: 3, onBoard: 1 },
      villains: [crate(4)],
      layout: [
        '##.T..##',
        '#......#',
        '.222222.',
        '.222222.',
        '........',
        '........',
        '#.1111.#',
        '##....##',
      ] }),
    L({ id: 27, name: 'Deja de temblar', hard: true, colors: 'LFBUND', moves: 23,
      goals: [color('U', 30), crates(12)],
      villains: [crate(4)],
      layout: [
        '........',
        '........',
        '........',
        '.KKKKKK.',
        '.KKKKKK.',
        '........',
        'eeeeeeee',
        '........',
      ] }),
    L({ id: 28, name: '¿Dónde está mi hermana?', colors: 'FBUND', moves: 36,
      goals: [ice(), token()],
      tokens: { skin: 'prueba', total: 3, onBoard: 1 },
      villains: [frost(4)],
      layout: [
        '##T...##',
        '##....##',
        '..1111..',
        '..1331..',
        '..1331..',
        '..1111..',
        '##....##',
        '##....##',
      ] }),
    L({ id: 29, name: 'Todas las unidades', hard: true, colors: 'LFBUND', moves: 18,
      goals: [crates(14), ice()],
      villains: [crate(3)],
      layout: [
        'KKKKKKKK',
        '........',
        '........',
        '.222222.',
        '.222222.',
        '........',
        '........',
        '.KKKKKK.',
      ] }),
    L({ id: 30, name: 'Se acabó el sabor', boss: true, final: true, colors: 'LFBUND', moves: 36,
      goals: [boss(), rescue()],
      freezer: { who: 'cocardo', hp: 16, label: 'El gran congelador' },
      rescue: ['uva', 'banana'], friendHP: 3,
      // final: los dos villanos a la vez
      villains: [frost(4, 2, 'boss'), crate(6)],
      layout: [
        '...CC...',
        '...CC...',
        '........',
        '111..111',
        '........',
        '.R....R.',
        '#......#',
        '##....##',
      ] }),
  ];

  var chapters = [
    { id: 1, name: 'La nieve de Lima', zone: "Coco's Scoops", color: '#ff6fa5', levels: [1, 2, 3, 4, 5] },
    { id: 2, name: 'Necesitamos un nuevo sabor', zone: 'La oficina de Don Piña', color: '#a1286a', levels: [6, 7, 8, 9, 10] },
    { id: 3, name: 'Voy a ampliar el menú', zone: 'La trastienda', color: '#4aa8e0', levels: [11, 12, 13, 14, 15] },
    { id: 4, name: 'Cherry conoce el negocio', zone: 'El vecindario de Cherry', color: '#d61f4b', levels: [16, 17, 18, 19, 20] },
    { id: 5, name: 'La fuga', zone: 'La noche de la tormenta', color: '#5b1e74', levels: [21, 22, 23, 24, 25] },
    { id: 6, name: 'Se acabó el sabor', zone: 'Los congeladores', color: '#2a6fb0', levels: [26, 27, 28, 29, 30] },
  ];

  function get(id) {
    var n = Number(id);
    if (!Number.isInteger(n) || n < 1 || n > list.length) return null;
    return list[n - 1];
  }

  var Levels = { list: list, chapters: chapters, get: get, count: list.length };

  Cocardo.Levels = Levels;
  if (typeof module !== 'undefined' && module.exports) module.exports = Levels;
})();
