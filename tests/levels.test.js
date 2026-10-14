// Pruebas de los 30 niveles (js/core/levels.js) con el motor real, y del guion (js/story.js).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../js/core/engine.js');
const Levels = require('../js/core/levels.js');
const Story = require('../js/story.js');

const COLORS = 'LFBUND';
const VICTIMS = ['lima', 'fresa', 'banana', 'uva', 'naranja', 'durazna'];
const MAIN = ['cocardo', 'lima', 'cereza', 'pina', 'banano', 'banana', 'fresa', 'durazna', 'uva', 'naranja'];
const SECONDARY = ['limon', 'policia_fresa', 'policia_sandia', 'guardaespaldas', 'brocoli', 'reportera'];
const CHARACTERS = MAIN.concat(SECONDARY);
const MOODS = ['normal', 'feliz', 'triste', 'enojado', 'asustado', 'sorprendido', 'burlon', 'nervioso', 'furioso', 'carcajada', 'llorando', 'coqueta'];
const TEACH = ['swap', 'paleta', 'bomba', 'hielo', 'copa', 'hp2', 'pedido', 'cucharon', 'escarcha', 'villano', 'congelador', 'chorro', 'colores6', 'batido', 'cajas', 'cereza', 'dosvillanos', 'ficha', 'pruebas'];
const SEEDS = [0, 1, 2, 7, 'reto', 20261014];

const cells = (lvl) => lvl.layout.join('');
const count = (lvl, chars) => [...cells(lvl)].filter((ch) => chars.includes(ch)).length;
const goalTypes = (lvl) => lvl.goals.map((g) => g.type);
const hasGoal = (lvl, t) => goalTypes(lvl).includes(t);

// ======================================================================= estructura
test('Levels: 30 niveles en orden, get() y count', () => {
  assert.equal(Levels.count, 30);
  assert.equal(Levels.list.length, 30);
  Levels.list.forEach((lvl, i) => {
    assert.equal(lvl.id, i + 1);
    assert.equal(lvl.chapter, Math.ceil(lvl.id / 5));
    assert.equal(Levels.get(lvl.id), lvl);
    assert.equal(Levels.get(String(lvl.id)), lvl);
  });
  for (const bad of [0, 31, -1, 1.5, 'x', null, undefined]) assert.equal(Levels.get(bad), null);
  const names = Levels.list.map((l) => l.name);
  names.forEach((n) => assert.ok(typeof n === 'string' && n.length >= 3 && n.length <= 28, 'nombre: ' + n));
  assert.equal(new Set(names).size, 30, 'nombres repetidos');
  assert.deepEqual(JSON.parse(JSON.stringify(Levels.list)), Levels.list, 'niveles no JSON-clonables');
});

test('Levels: 6 capítulos del canon con zona, color y 5 niveles cada uno', () => {
  const names = ['La nieve de Lima', 'Necesitamos un nuevo sabor', 'Voy a ampliar el menú', 'Cherry conoce el negocio', 'La fuga', 'Se acabó el sabor'];
  assert.equal(Levels.chapters.length, 6);
  Levels.chapters.forEach((ch, i) => {
    assert.equal(ch.id, i + 1);
    assert.equal(ch.name, names[i]);
    assert.ok(typeof ch.zone === 'string' && ch.zone.length > 3);
    assert.match(ch.color, /^#[0-9a-f]{6}$/i);
    assert.deepEqual(ch.levels, [1, 2, 3, 4, 5].map((k) => i * 5 + k));
    ch.levels.forEach((id) => assert.equal(Levels.get(id).chapter, ch.id));
  });
  assert.equal(Levels.chapters[0].zone, "Coco's Scoops");
});

test('Levels: layout rectangular 7 u 8, solo caracteres de la leyenda', () => {
  for (const lvl of Levels.list) {
    const w = lvl.layout[0].length;
    assert.ok(w === 7 || w === 8, `L${lvl.id} ancho ${w}`);
    assert.ok(lvl.layout.length === 7 || lvl.layout.length === 8, `L${lvl.id} alto`);
    assert.equal(lvl.layout.length, w, `L${lvl.id}: el tablero debe ser cuadrado (R7/R8)`);
    lvl.layout.forEach((row, r) => {
      assert.equal(row.length, w, `L${lvl.id} fila ${r} con largo distinto`);
      assert.match(row, /^[#.e123KRCT]+$/, `L${lvl.id} fila ${r}: carácter fuera de la leyenda`);
    });
    // nada de filas o columnas completamente vacías
    lvl.layout.forEach((row, r) => assert.ok(/[^#]/.test(row), `L${lvl.id} fila ${r} vacía`));
    for (let c = 0; c < w; c++) assert.ok(lvl.layout.some((row) => row[c] !== '#'), `L${lvl.id} columna ${c} vacía`);
  }
});

test('Levels: colores 4-6 válidos y metas de color dentro del nivel', () => {
  for (const lvl of Levels.list) {
    assert.equal(typeof lvl.colors, 'string');
    assert.ok(lvl.colors.length >= 4 && lvl.colors.length <= 6, `L${lvl.id} colores`);
    assert.equal(new Set(lvl.colors).size, lvl.colors.length, `L${lvl.id} colores repetidos`);
    [...lvl.colors].forEach((c) => assert.ok(COLORS.includes(c), `L${lvl.id} color ${c}`));
    // en el mismo orden que la tabla de colores
    assert.equal(lvl.colors, [...COLORS].filter((c) => lvl.colors.includes(c)).join(''), `L${lvl.id} orden de colores`);
    const colorGoals = lvl.goals.filter((g) => g.type === 'color');
    colorGoals.forEach((g) => {
      assert.ok(lvl.colors.includes(g.color), `L${lvl.id} meta de color ${g.color} fuera del nivel`);
      assert.ok(Number.isInteger(g.n) && g.n > 0);
      // metas que se leen de un vistazo: hasta 30 por sabor, hasta 25 si el pedido es de 3 sabores
      const cap = colorGoals.length >= 3 ? 25 : 30;
      assert.ok(g.n <= cap, `L${lvl.id}: meta ${g.color}×${g.n} > ${cap}`);
    });
  }
});

test('Levels: movimientos en [18, 32] (capítulo 1 en [20, 24]) y 1-3 metas sin repetir', () => {
  for (const lvl of Levels.list) {
    // el reto diario juega los niveles 6-25 con 2 menos: con 18 queda en 16 o más
    const [lo, hi] = lvl.chapter === 1 ? [20, 24] : [18, 32];
    assert.ok(Number.isInteger(lvl.moves) && lvl.moves >= lo && lvl.moves <= hi, `L${lvl.id} movimientos ${lvl.moves} fuera de [${lo}, ${hi}]`);
    assert.ok(lvl.goals.length >= 1 && lvl.goals.length <= 3, `L${lvl.id} metas`);
    const keys = lvl.goals.map((g) => g.type + (g.color || ''));
    assert.equal(new Set(keys).size, keys.length, `L${lvl.id} metas repetidas`);
    lvl.goals.forEach((g) => assert.ok(['color', 'ice', 'crate', 'rescue', 'token', 'boss'].includes(g.type)));
  }
});

test('Levels: congelador = exactamente 0 o 4 C en un cuadrado 2×2, freezer sí y solo sí hay C', () => {
  for (const lvl of Levels.list) {
    const cs = [];
    lvl.layout.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === 'C') cs.push([r, c]); }));
    assert.ok(cs.length === 0 || cs.length === 4, `L${lvl.id}: ${cs.length} celdas C`);
    if (cs.length) {
      const [r0, c0] = cs[0];
      assert.deepEqual(cs, [[r0, c0], [r0, c0 + 1], [r0 + 1, c0], [r0 + 1, c0 + 1]], `L${lvl.id}: C no forma 2×2`);
      assert.ok(lvl.freezer, `L${lvl.id}: falta freezer`);
      assert.ok(['cocardo', 'cereza'].includes(lvl.freezer.who));
      assert.ok(Number.isInteger(lvl.freezer.hp) && lvl.freezer.hp > 0);
    } else assert.equal(lvl.freezer, undefined, `L${lvl.id}: freezer sin C`);
    assert.equal(hasGoal(lvl, 'boss'), cs.length === 4, `L${lvl.id}: meta boss ⇔ congelador`);
  }
});

test('Levels: R = rescue.length, friendHP, y fichas T con tokens ⇔ meta token', () => {
  for (const lvl of Levels.list) {
    const nR = count(lvl, 'R');
    if (nR) {
      assert.ok(Array.isArray(lvl.rescue), `L${lvl.id}: falta rescue`);
      assert.equal(lvl.rescue.length, nR, `L${lvl.id}: R != rescue.length`);
      lvl.rescue.forEach((w) => assert.ok(VICTIMS.includes(w), `L${lvl.id}: ${w} no es víctima`));
      assert.ok([2, 3].includes(lvl.friendHP), `L${lvl.id}: friendHP`);
    } else {
      assert.equal(lvl.rescue, undefined, `L${lvl.id}: rescue sin R`);
      assert.equal(lvl.friendHP, undefined);
    }
    assert.equal(hasGoal(lvl, 'rescue'), nR > 0, `L${lvl.id}: meta rescue ⇔ R`);
    const nT = count(lvl, 'T');
    assert.equal(!!lvl.tokens, hasGoal(lvl, 'token'), `L${lvl.id}: tokens ⇔ meta token`);
    if (lvl.tokens) {
      const t = lvl.tokens;
      assert.ok(['uva', 'prueba'].includes(t.skin));
      assert.ok(Number.isInteger(t.total) && t.total > 0);
      assert.ok(t.onBoard >= 1 && t.onBoard <= t.total);
      assert.ok(nT >= 1 && nT <= t.onBoard, `L${lvl.id}: T en el layout (${nT}) vs onBoard`);
    } else assert.equal(nT, 0, `L${lvl.id}: T sin tokens`);
  }
});

test('Levels: ninguna meta imposible', () => {
  for (const lvl of Levels.list) {
    const crateVillain = lvl.villains.some((v) => v.act === 'crate');
    for (const g of lvl.goals) {
      if (g.type === 'ice') assert.ok(count(lvl, '123') > 0, `L${lvl.id}: meta de hielo sin hielo`);
      if (g.type === 'crate') {
        assert.ok(Number.isInteger(g.n) && g.n > 0);
        // las cajas del layout alcanzan; si no, tiene que haber un villano que las fabrique
        assert.ok(count(lvl, 'K') >= g.n || crateVillain, `L${lvl.id}: faltan cajas para la meta`);
      }
      if (g.type === 'rescue') assert.ok(count(lvl, 'R') > 0);
      if (g.type === 'boss') assert.equal(count(lvl, 'C'), 4);
      if (g.type === 'token') assert.ok(lvl.tokens && lvl.tokens.total > 0);
    }
    // las piezas de color de una meta tienen que poder aparecer (casillas jugables suficientes)
    assert.ok(count(lvl, '.eT') >= 30, `L${lvl.id}: tablero demasiado tapado`);
  }
});

test('Levels: villanos canónicos (Cocardo escarcha, Cherry encajona) y dueños de congeladores', () => {
  for (const lvl of Levels.list) {
    assert.ok(Array.isArray(lvl.villains));
    for (const v of lvl.villains) {
      assert.ok(['cocardo', 'cereza'].includes(v.who));
      assert.ok(['frost', 'crate'].includes(v.act));
      assert.ok(['hud', 'boss'].includes(v.src));
      assert.ok(Number.isInteger(v.every) && v.every >= 3, `L${lvl.id}: every`);
      assert.ok(Number.isInteger(v.count) && v.count >= 1 && v.count <= 2);
      if (v.src === 'boss') {
        assert.ok(lvl.freezer, `L${lvl.id}: villano de congelador sin congelador`);
        assert.equal(v.who, lvl.freezer.who, `L${lvl.id}: el rayo sale del congelador de su dueño`);
      } else {
        assert.equal(v.who, v.act === 'frost' ? 'cocardo' : 'cereza', `L${lvl.id}: ${v.who} no hace ${v.act}`);
      }
    }
  }
  const owners = Levels.list.filter((l) => l.freezer).map((l) => [l.id, l.freezer.who]);
  assert.deepEqual(owners, [[10, 'cocardo'], [15, 'cocardo'], [20, 'cocardo'], [25, 'cereza'], [30, 'cocardo']]);
  // jefes con los dos villanos actuando
  for (const id of [20, 30]) assert.deepEqual(Levels.get(id).villains.map((v) => v.who).sort(), ['cereza', 'cocardo'], `L${id}`);
  // Cherry no actúa antes del capítulo 4
  Levels.list.filter((l) => l.chapter < 4).forEach((l) => assert.ok(l.villains.every((v) => v.who === 'cocardo'), `L${l.id}`));
  // capítulos 1 y parte del 2 sin villano: se aprende a jugar primero
  for (let id = 1; id <= 8; id++) assert.equal(Levels.get(id).villains.length, 0, `L${id}`);
});

test('Levels: en los jefes con rescate, los amigos empiezan encajados (el rescate llega al final)', () => {
  // ninguna casilla jugable al lado de una R: solo se llega a ella rompiendo el congelador, el hielo de al
  // lado o con un especial, así que no se libera en las primeras jugadas
  for (const lvl of Levels.list.filter((l) => l.boss && l.rescue)) {
    lvl.layout.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch !== 'R') return;
      const near = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
        .map(([y, x]) => (lvl.layout[y] || '')[x])
        .filter((v) => v !== undefined);
      assert.ok(near.includes('C'), `L${lvl.id}: R(${r},${c}) no está junto al congelador`);
      assert.ok(near.every((v) => /[#123KRC]/.test(v)), `L${lvl.id}: R(${r},${c}) tiene una casilla jugable al lado`);
    }));
  }
});

test('Levels: rescates del canon (cada víctima se rescata una sola vez)', () => {
  const plan = Levels.list.filter((l) => l.rescue).map((l) => [l.id, l.rescue]);
  assert.deepEqual(plan, [[10, ['lima']], [13, ['fresa']], [15, ['durazna']], [19, ['naranja']], [30, ['uva', 'banana']]]);
  assert.deepEqual(plan.flatMap((p) => p[1]).sort(), VICTIMS.slice().sort());
});

test('Levels: orden de enseñanza, ensure, jefes y niveles difíciles', () => {
  const taught = Levels.list.filter((l) => l.teach).map((l) => [l.id, l.teach]);
  assert.deepEqual(taught, [
    [1, 'swap'], [2, 'paleta'], [3, 'bomba'], [4, 'hielo'], [5, 'copa'], [6, 'hp2'], [7, 'cucharon'], [8, 'escarcha'],
    [9, 'villano'], [10, 'congelador'], [11, 'chorro'], [12, 'colores6'], [14, 'batido'], [16, 'cajas'], [17, 'cereza'],
    [20, 'dosvillanos'], [21, 'ficha'], [22, 'pruebas'],
  ]);
  taught.forEach(([, t]) => assert.ok(TEACH.includes(t)));
  // cada mecánica aparece por primera vez en el nivel que la enseña
  const firstSeen = (pred) => Levels.list.find(pred).id;
  assert.equal(firstSeen((l) => /[123]/.test(cells(l))), 4);
  assert.equal(firstSeen((l) => /[23]/.test(cells(l))), 6);
  assert.equal(firstSeen((l) => l.goals.filter((g) => g.type === 'color').length >= 3), 7);
  assert.equal(firstSeen((l) => cells(l).includes('e')), 8);
  assert.equal(firstSeen((l) => l.villains.length > 0), 9);
  assert.equal(firstSeen((l) => !!l.freezer), 10);
  assert.equal(firstSeen((l) => l.colors.length === 6), 12);
  assert.equal(firstSeen((l) => cells(l).includes('K')), 16);
  assert.equal(firstSeen((l) => l.villains.some((v) => v.who === 'cereza')), 17);
  assert.equal(firstSeen((l) => l.villains.length >= 2), 20);
  assert.equal(firstSeen((l) => !!l.tokens), 21);
  assert.equal(firstSeen((l) => l.tokens && l.tokens.skin === 'prueba'), 22);
  assert.equal(Levels.get(21).tokens.skin, 'uva');

  assert.deepEqual(Levels.list.filter((l) => l.ensure).map((l) => [l.id, l.ensure]), [[2, 'ph'], [3, 'bomba'], [5, 'copa']]);
  assert.deepEqual(Levels.list.filter((l) => l.boss).map((l) => l.id), [5, 10, 15, 20, 25, 30]);
  assert.deepEqual(Levels.list.filter((l) => l.hard).map((l) => l.id), [19, 23, 27, 29]);
  assert.deepEqual(Levels.list.filter((l) => l.final).map((l) => l.id), [30]);
  // cada jefe tiene un congelador de verdad (salvo el del capítulo 1, que enseña la Copa)
  for (const lvl of Levels.list.filter((l) => l.boss && l.id > 5)) {
    assert.ok(lvl.freezer && lvl.freezer.hp >= 8, `L${lvl.id}: jefe sin congelador de al menos 8 PV`);
    assert.ok(lvl.goals.some((g) => g.type === 'boss'), `L${lvl.id}: jefe sin meta boss`);
  }
  // curva de movimientos suave: entre vecinos no más de 6 de diferencia, salvo al entrar o salir de un jefe
  for (let id = 2; id <= Levels.count; id++) {
    const a = Levels.get(id - 1), b = Levels.get(id);
    if (a.boss || b.boss) continue;
    assert.ok(Math.abs(b.moves - a.moves) <= 6, `L${a.id}→L${b.id}: ${a.moves}→${b.moves} movimientos`);
  }
});

// ======================================================================= con el motor
test('Levels: createGame funciona con varias semillas y respeta el layout', () => {
  for (const lvl of Levels.list) {
    for (const seed of SEEDS) {
      const s = Engine.createGame(lvl, seed);
      const where = `L${lvl.id} seed ${seed}`;
      assert.equal(s.status, 'playing', where);
      assert.equal(s.rows, lvl.layout.length);
      assert.equal(s.cols, lvl.layout[0].length);
      assert.equal(s.movesLeft, lvl.moves);
      assert.ok(Engine.isStable(s), `${where}: tablero inicial con matches`);
      assert.ok(Engine.validMoves(s).length > 0, `${where}: sin jugadas`);
      s.goals.forEach((g, i) => {
        assert.equal(g.type, lvl.goals[i].type);
        assert.ok(g.target > 0, `${where}: meta ${g.type} con objetivo ${g.target}`);
      });
      // objetivos según la leyenda (ARQUITECTURA §4.1)
      lvl.goals.forEach((g, i) => {
        const want = g.type === 'color' ? g.n : g.type === 'ice' ? count(lvl, '123') : g.type === 'crate' ? g.n
          : g.type === 'rescue' ? count(lvl, 'R') : g.type === 'token' ? lvl.tokens.total : lvl.freezer.hp;
        assert.equal(s.goals[i].target, want, `${where}: objetivo ${g.type}`);
      });
      // amigos en orden de lectura
      const who = [];
      s.grid.forEach((row) => row.forEach((cl) => { if (cl && cl.b && cl.b.kind === 'friend') who.push(cl.b.who); }));
      assert.deepEqual(who, lvl.rescue || []);
      if (lvl.freezer) assert.deepEqual([s.freezer.who, s.freezer.hp], [lvl.freezer.who, lvl.freezer.hp]);
      assert.deepEqual(Engine.createGame(lvl, seed), s, `${where}: no determinista`);
    }
  }
});

test('Levels: ensure garantiza la jugada especial en el tablero inicial', () => {
  for (const lvl of Levels.list.filter((l) => l.ensure)) {
    for (const seed of SEEDS) {
      const s = Engine.createGame(lvl, seed);
      const ok = Engine.validMoves(s).some((m) => {
        const an = Engine._analyzeSwap(s, m.a, m.b);
        return an && an.specials.some((x) => x === lvl.ensure || (lvl.ensure === 'ph' && (x === 'ph' || x === 'pv')));
      });
      assert.ok(ok, `L${lvl.id} seed ${seed}: falta jugada que cree ${lvl.ensure}`);
    }
  }
});

// Bot sencillo que mira una jugada adelante: avance en las metas, fichas más abajo, especiales.
function botMove(s) {
  const u0 = Engine.goalUnits(s).remaining;
  let best = null, bestV = -Infinity;
  for (const m of Engine.validMoves(s)) {
    const r = Engine.applySwap(s, m.a, m.b);
    if (!r.turnInfo.valid) continue;
    if (r.state.status === 'won') return r;
    let v = (u0 - Engine.goalUnits(r.state).remaining) * 10 + r.turnInfo.specials * 3;
    r.state.grid.forEach((row, ri) => row.forEach((cl) => { if (cl && cl.p && cl.p.type === 'token') v += ri; }));
    if (v > bestV) { bestV = v; best = r; }
  }
  return best;
}

test('Levels: cada nivel se puede ganar (bot con movimientos de sobra)', () => {
  for (const lvl of Levels.list) {
    const easy = Object.assign({}, lvl, { moves: lvl.moves + 25 });
    let won = false;
    for (let k = 0; k < 4 && !won; k++) {
      let s = Engine.createGame(easy, 'bot' + k);
      while (s.status === 'playing') {
        const r = botMove(s);
        assert.ok(r, `L${lvl.id}: el bot no encontró jugada`);
        s = r.state;
      }
      won = s.status === 'won';
      if (won) {
        assert.deepEqual(s.rescued.slice().sort(), (lvl.rescue || []).slice().sort(), `L${lvl.id}: rescatados`);
        if (lvl.freezer) assert.equal(s.freezer.hp, 0);
      }
    }
    assert.ok(won, `L${lvl.id}: el bot no ganó ni con ${easy.moves} movimientos`);
  }
});

// ======================================================================= guion
function scriptEntries() { return Object.entries(Story.scripts); }
function lines(key) { return Story.scripts[key].filter((e) => e.text !== undefined); }

test('Story: forLevel apunta a guiones existentes y los cliffhangers caen en los finales', () => {
  for (let id = 1; id <= 30; id++) {
    const f = Story.forLevel(id);
    for (const k of ['pre', 'post', 'cliff']) if (f[k]) assert.ok(Array.isArray(Story.scripts[f[k]]), `L${id} ${k}: ${f[k]}`);
    assert.ok(f.pre, `L${id} sin escena previa`);
    assert.equal(!!f.cliff, id % 5 === 0, `L${id}: cliff`);
  }
  assert.equal(Story.forLevel(30).cliff, 'ending');
  for (const id of [5, 10, 15, 20, 25]) {
    const sc = Story.scripts[Story.forLevel(id).cliff];
    assert.equal(sc[sc.length - 1].card, 'CONTINUARÁ…', `cliff${id}`);
  }
  const end = Story.scripts.ending;
  assert.deepEqual(end.slice(-2).map((e) => e.card), ['FIN DE LA TEMPORADA 1', '¿Segunda temporada…?']);
  // todas las escenas se usan
  const used = new Set();
  for (let id = 1; id <= 30; id++) Object.values(Story.forLevel(id)).forEach((k) => used.add(k));
  scriptEntries().forEach(([k]) => assert.ok(used.has(k), `escena sin usar: ${k}`));
});

test('Story: entradas válidas, 2-6 líneas por escena y líneas de máximo 90 caracteres', () => {
  for (const [key, sc] of scriptEntries()) {
    assert.ok(sc.length > 0);
    for (const e of sc) {
      const kinds = ['text', 'sfx', 'card'].filter((k) => e[k] !== undefined);
      assert.equal(kinds.length, 1, `${key}: entrada ambigua ${JSON.stringify(e)}`);
      if (e.text !== undefined) {
        assert.ok(CHARACTERS.includes(e.who), `${key}: who ${e.who}`);
        assert.ok(MOODS.includes(e.mood), `${key}: mood ${e.mood}`);
        assert.ok(e.text.length >= 1 && e.text.length <= 90, `${key}: línea de ${e.text.length}: ${e.text}`);
        if (e.variant) assert.ok(['carcel', 'huida', 'tubo', 'panecitos'].includes(e.variant));
        if (e.frozen) assert.ok(VICTIMS.includes(e.who), `${key}: solo las víctimas hablan congeladas`);
      }
      if (e.sfx !== undefined) assert.ok(Story.effects[e.sfx], `${key}: efecto ${e.sfx}`);
      if (e.card !== undefined) assert.ok(e.card.length > 0 && e.card.length <= 40);
    }
    const n = lines(key).length;
    if (key !== 'ending') assert.ok(n >= 2 && n <= 6, `${key}: ${n} líneas`);
  }
  for (const fx of Object.values(Story.effects)) assert.ok(fx.text && fx.sound);
});

test('Story: frases canónicas en boca de quien las dijo', () => {
  const said = (who, text) => scriptEntries().some(([, sc]) => sc.some((e) => e.who === who && e.text === text));
  const canon = [
    ['lima', 'Cocardo, hoy vendemos menos de lo que cuesta prender las luces.'],
    ['cocardo', 'Bueno, entonces mañana prende menos luces.'],
    ['cocardo', 'No está viejo, está experimentado.'],
    ['cocardo', 'Lima, hazte para atrás, no abre.'],
    ['lima', 'Ya sé, ya sé, Cocardo… tengo frío.'],
    ['cocardo', '¡No inventes, estás viva!'],
    ['cocardo', 'Perdóname, amor… solo un poquito.'],
    ['cocardo', 'Uno por persona, ya se me están poniendo violentos.'],
    ['cocardo', 'Mañana habrá un sabor nuevo.'],
    ['fresa', 'Vine a ver a mi prima Lima, no me responde desde ayer.'],
    ['cocardo', 'Lo siento, Fresa, pero te necesito.'],
    ['pina', '¿Tú eres Cocardo?'],
    ['cocardo', 'Depende quién pregunte.'],
    ['pina', 'Necesito 500 litros para empezar… 500 por sabor. Consígueme 5 y tenemos un trato.'],
    ['brocoli', 'Oiga, sí está grande, ¿para qué quiere tanto espacio?'],
    ['cocardo', 'Voy a ampliar el menú.'],
    ['cocardo', '¡Perfecto, ya están los 5!'],
    ['cocardo', 'Cherry, no abra ese congelador.'],
    ['cereza', 'Tú haces el helado, yo te ayudo a convertir esto en un imperio.'],
    ['cocardo', 'Con cuidado, chicas, no quiero que se me rompa el inventario.'],
    ['cereza', 'Espere, queremos el triple de lo que ofreció.'],
    ['pina', 'Me agradas. Denos el triple.'],
    ['banano', 'Otra vez no… esto me resulta demasiado familiar.'],
    ['naranja', 'Vecina, te traje panecitos calientitos.'],
    ['cereza', 'Buenas noches, naranjita.'],
    ['cocardo', 'Si se descongelan, se acabó el negocio.'],
    ['cocardo', 'Lima, Fresa, Durazna, Banana… ¿dónde está Uva?'],
    ['uva', 'Ayúdame, por favor… un hombre me encerró en un congelador.'],
    ['cereza', 'Aquí termina el paseo.'],
    ['cereza', 'Sí. Se acabó, Uva.'],
    ['pina', 'Mientras cumplan con el pedido, no es asunto mío.'],
    ['limon', 'El coco y la cereza tienen algo grande escondido en los congeladores.'],
    ['banano', 'Esta pulsera se la regalé yo… Hermana, estuviste aquí.'],
    ['cereza', 'Deja de temblar y piensa.'],
    ['banano', 'Así que tú eres Cocardo… ¿Dónde está mi hermana?'],
    ['banano', 'Una menos.'],
    ['policia_fresa', 'Todas las que estén cerca.'],
    ['cocardo', 'Se están descongelando.'],
    ['cocardo', 'Lima. Mi amor, eres tú.'],
    ['lima', 'Ya no más.'],
    ['policia_fresa', 'Ya pasó todo. Arrestamos al culpable.'],
    ['policia_sandia', 'Luces.'],
    ['reportera', 'Cocardo, dueño de la famosa heladería, fue arrestado esta noche…'],
    ['cereza', 'Un boleto de avión, por favor.'],
    ['pina', 'Cherry… interesante.'],
    ['banano', 'Siempre iba a venir por ti.'],
    ['lima', 'A veces lo descubres demasiado tarde.'],
    // revisión de canon (docs/investigacion/verificacion.json)
    ['lima', 'Hace ruidos raros, tiembla solo y huele a quemado.'],
    ['cocardo', 'Tu brazo… se regeneró.'],
    ['brocoli', '¿Quiere que me lleve el congelador viejo?'],
    ['cereza', '¿Qué te sirvo? ¿Plátano? Ese es nuevo.'],
    ['pina', 'Creí que eras un hombre de palabra.'],
    ['guardaespaldas', 'Entonces tendrás que sacármelas.'],
    ['guardaespaldas', '¿No le preocupa lo que encontraron?'],
    ['reportera', 'Cocardo no trabajaba solo. Las autoridades buscan a su compañera Cherry.'],
    ['fresa', 'Supongo que nunca sabes de lo que alguien es capaz, ¿no?'],
  ];
  for (const [who, text] of canon) assert.ok(said(who, text), `falta «${text}» (${who})`);
  // los secundarios aparecen en escena
  for (const id of SECONDARY) assert.ok(scriptEntries().some(([, sc]) => sc.some((e) => e.who === id)), `${id} sin escena`);
});

test('Story: el guion acompaña a los niveles (rescates, congeladores, Uva fugitiva)', () => {
  // tras cada nivel de rescate, la rescatada habla primero en la escena post
  for (const lvl of Levels.list.filter((l) => l.rescue && l.id !== 30)) {
    const post = Story.forLevel(lvl.id).post;
    assert.ok(post, `L${lvl.id} sin escena post`);
    assert.equal(lines(post)[0].who, lvl.rescue[0], `post${lvl.id}`);
  }
  // en el final hablan Uva y Banana, ya libres
  for (const w of Levels.get(30).rescue) assert.ok(lines('ending').some((e) => e.who === w && !e.frozen));
  // una víctima no habla congelada después de ser rescatada
  const rescuedAt = {};
  Levels.list.forEach((l) => (l.rescue || []).forEach((w) => { rescuedAt[w] = l.id; }));
  for (let id = 1; id <= 30; id++) {
    const pre = Story.forLevel(id).pre;
    lines(pre).filter((e) => e.frozen).forEach((e) => assert.ok(id <= rescuedAt[e.who], `pre${id}: ${e.who} ya estaba libre`));
  }
  // la víctima del nivel de rescate aparece antes (congelada o atrapada)
  assert.ok(lines('post21')[0].who === 'uva' && lines('pre21').some((e) => e.who === 'uva'));
});

test('Story: helperFor, hintPeeker, villainFor y consejos', () => {
  const rescuedAt = {};
  Levels.list.forEach((l) => (l.rescue || []).forEach((w) => { rescuedAt[w] = l.id; }));
  for (let id = 1; id <= 30; id++) {
    const lvl = Levels.get(id);
    const h = Story.helperFor(id);
    assert.ok(CHARACTERS.includes(h));
    if (lvl.chapter === 1) assert.equal(h, 'lima');
    else if (lvl.chapter >= 5) assert.equal(h, 'banano');
    else assert.ok(h === 'lima' || rescuedAt[h] < id, `L${id}: ${h} aún no fue rescatada`);
    assert.equal(Story.hintPeeker(id), lvl.chapter <= 4 ? 'limon' : 'banano');
    const v = Story.villainFor(id);
    assert.ok(['cocardo', 'cereza'].includes(v));
    const present = lvl.villains.map((x) => x.who).concat(lvl.freezer ? [lvl.freezer.who] : []);
    if (present.length) assert.ok(present.includes(v), `L${id}: villano del HUD ${v} no actúa`);
    if (lvl.freezer) assert.equal(v, lvl.freezer.who, `L${id}: el jefe es el dueño del congelador`);
    if (lvl.chapter < 4) assert.equal(v, 'cocardo');
    assert.ok(typeof Story.tips[id] === 'string' && Story.tips[id].length > 10 && Story.tips[id].length <= 90, `tip ${id}`);
  }
  assert.equal(Story.villainFor(16), 'cereza'); // las cajas del inventario son de Cherry
  assert.equal(Story.chapterTitles.length, 6);
});

test('Story: burlas, textos de cascada y álbum de 16', () => {
  for (const who of ['cocardo', 'cereza']) {
    for (const k of ['start', 'low', 'act']) {
      const arr = Story.taunts[who][k];
      assert.ok(Array.isArray(arr) && arr.length >= 2, `${who}.${k}`);
      arr.forEach((t) => assert.ok(t.length > 0 && t.length <= 60, `${who}.${k}: ${t}`));
    }
  }
  const all = (who) => Object.values(Story.taunts[who]).flat();
  assert.ok(all('cocardo').includes('Mañana habrá un sabor nuevo.'));
  assert.ok(all('cocardo').includes('Habrá que raspar un poquito más.'));
  assert.ok(all('cereza').includes('Te dije que valían el triple.'));
  for (const v of VICTIMS) assert.ok(Story.rescueLines[v] && Story.rescueLines[v].length <= 50, `rescueLines.${v}`);
  assert.deepEqual(Story.cascadeText, ['', '', '¡Rico!', '¡Delicioso!', '¡Escandaloso!', '¡DRAMÁTICO!', '¡¡TELENOVELA!!']);

  assert.equal(Story.album.length, 16);
  assert.deepEqual(Story.album.map((a) => a.id), CHARACTERS);
  const names = { cereza: 'Cherry', pina: 'Don Piña', limon: 'Limón', policia_fresa: 'La oficial', policia_sandia: 'El oficial Sandía', guardaespaldas: 'El guardaespaldas', brocoli: 'El repartidor', reportera: 'La reportera' };
  for (const a of Story.album) {
    if (names[a.id]) assert.equal(a.name, names[a.id]);
    assert.equal(Story.nameOf(a.id), a.name);
    assert.ok(a.role.length > 10 && a.role.length <= 90, a.id);
    assert.ok(a.quote.length >= 1 && a.quote.length <= 90, a.id);
    const u = a.unlock;
    assert.ok(['start', 'level', 'rescue'].includes(u.type));
    if (u.type === 'level') assert.ok(Number.isInteger(u.level) && u.level >= 1 && u.level <= 30);
    if (u.type === 'rescue') {
      assert.equal(u.who, a.id);
      assert.ok(Levels.list.some((l) => (l.rescue || []).includes(a.id)), `${a.id} nunca se rescata`);
    }
  }
  // las víctimas se desbloquean al rescatarlas; Cocardo desde el inicio
  Story.album.filter((a) => VICTIMS.includes(a.id)).forEach((a) => assert.equal(a.unlock.type, 'rescue'));
  assert.equal(Story.album[0].unlock.type, 'start');
});
