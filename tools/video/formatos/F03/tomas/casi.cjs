// F03 «Perdí por uno»: el último movimiento de una partida real del bot, con UNA jugada (la que pierde o la que gana).
// --var <nivel>:<semilla>:<politica>:<pierde|gana>:<indice>[:repaso]
//   politica: experto | pista | 0.25 (bot experto que juega al azar esa fracción de las veces; ver tools/video/plan.cjs)
//   indice: posición en la lista de plan.cjs casi SIN ordenar (la misma que escribe generar.cjs en casi.json)
//   repaso: jugadas del final del prefijo que también se graban, a 12 fps (para un repaso acelerado; por defecto 0)
//   ej.: node tools/video/capturar.cjs tools/video/formatos/F03/tomas/casi.cjs dist/cap/D02-2-pierde --var 13:45:0.25:pierde:0
// Es la toma tools/video/tomas/casi13.cjs generalizada: rehace la partida del bot en la página sin grabar (la misma
// semilla y las mismas jugadas que plan.cjs casi), comprueba que el tablero de la página es el del motor con 1
// movimiento, y graba desde ahí: 1,5 s de tablero vivo a 30 fps (gancho y pausa del montaje), la jugada con el dedo
// del tutorial a 60 fps (cámara lenta posible), la pantalla final y 3 s más a 30 fps. Esconde la burbuja del villano
// del HUD (sus burlas salen al azar y alguna está vetada; en el video la burla va con voz). Falla si el juego no da
// lo mismo que el motor (gana o pierde y cuánto falta).
// Marcas: «hud» (rectángulos del HUD en px CSS: movs, metas, villanos), «ultimo-movimiento», «jugada», «resuelto»,
// «pantalla-final» ({ status, metas }).
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const Engine = require(path.join(ROOT, 'js/core/engine.js'));
const P = require(path.join(ROOT, 'tools/video/plan.cjs'));

function leer(v) {
  const p = String(v || '').split(':');
  if (p.length < 4 || !['pierde', 'gana'].includes(p[3])) throw new Error('--var <nivel>:<semilla>:<politica>:<pierde|gana>:<indice>[:repaso]');
  const pol = p[2] === 'experto' || p[2] === '' ? undefined : p[2] === 'pista' ? 'pista' : +p[2];
  return { nivel: +p[0], semilla: +p[1], politica: pol, tipo: p[3], indice: +(p[4] || 0), repaso: +(p[5] || 0) };
}

// firma del tablero: hueco, color y tipo de cada pieza y bloqueo con sus PV
function firma(grid) {
  return grid.map((fila) => fila.map((c) => (!c ? '#' : (c.p ? c.p.color + (c.p.type || '') + (c.p.frost ? '*' : '') : '_') +
    (c.b ? c.b.kind + c.b.hp : ''))).join(' ')).join('\n');
}

module.exports = {
  semilla: (v) => leer(v).semilla,
  async correr(T, v) {
    const o = leer(v);
    const f = P.casi(o.nivel, o.semilla, o.politica);
    if (!f) throw new Error(`plan.cjs casi no da un último movimiento para ${o.nivel}:${o.semilla}:${o.politica}`);
    const j = (o.tipo === 'pierde' ? f.pierde : f.gana)[o.indice];
    if (!j) throw new Error(`no hay ${o.tipo}[${o.indice}] (hay ${f.pierde.length} que pierden y ${f.gana.length} que ganan)`);
    // lo que dice el motor
    let st = Engine.createGame(P.nivel(o.nivel), o.semilla);
    for (const m of f.prefijo) st = Engine.applySwap(st, m.a, m.b).state;
    const motor = firma(st.grid), fin = Engine.applySwap(st, j.a, j.b).state;
    const esperado = { status: fin.status, metas: fin.goals.map((g) => g.remaining) };

    await T.pausar();
    await T.ir(o.nivel, o.semilla);
    await T.ev(() => { const s = document.createElement('style'); s.textContent = '.cg-bubble{display:none!important}'; document.head.appendChild(s); });
    const n = f.prefijo.length, rep = Math.min(o.repaso, n);
    await T.jugadas(f.prefijo, 0, n - rep, { antes: 0.05, entre: 0.05 });
    if (rep) {
      T.ritmo(12);
      await T.seguir();
      T.marca('repaso', { desde: n - rep, hasta: n });
      await T.jugadas(f.prefijo, n - rep, n, { antes: 0.2 });
    }
    const pag = await T.ev(() => { const s = Cocardo.Game._state(); return { grid: s.grid, movs: s.movesLeft, status: s.status }; });
    if (pag.movs !== 1 || pag.status !== 'playing') throw new Error(`la página quedó con ${pag.movs} movimientos (${pag.status}), no 1`);
    if (firma(pag.grid) !== motor) throw new Error('el tablero de la página no es el del motor:\n' + firma(pag.grid) + '\n---\n' + motor);
    T.ritmo(30);
    await T.seguir();
    const hud = await T.ev(() => {
      const r = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.left, y: q.top, w: q.width, h: q.height }; };
      const vs = Array.from(document.querySelectorAll('.cg-villain')).map((e) => {
        const m = /cg-v-([a-z_]+)/.exec(e.className); return { who: m ? m[1] : null, ...r(e) };
      });
      return { movs: r(document.querySelector('.cg-moves')), metas: r(document.querySelector('.cg-goals')), villanos: vs };
    });
    T.marca('hud', hud);
    T.marca('ultimo-movimiento', { nivel: o.nivel, semilla: o.semilla, prefijo: n, tipo: o.tipo, indice: o.indice, a: j.a, b: j.b });
    await T.esperar(1.5);
    if (await T.ev(() => !!document.querySelector('.cg-peek.cg-in'))) throw new Error('salió la pista del juego antes de la jugada');
    T.ritmo(60);
    await T.deslizar(j.a, j.b, { antes: 0.3, dur: 0.2 });
    await T.paso();
    await T.quieto(40);
    T.marca('resuelto');
    await T.fin(40);
    const res = await T.ev(() => { const s = Cocardo.Game._state(); return { status: s.status, metas: s.goals.map((g) => g.remaining) }; });
    T.marca('pantalla-final', res);
    if (res.status !== esperado.status || res.metas.join() !== esperado.metas.join())
      throw new Error(`el juego dio ${JSON.stringify(res)} y el motor ${JSON.stringify(esperado)}`);
    T.ritmo(30);
    await T.esperar(3.0);
  },
};
