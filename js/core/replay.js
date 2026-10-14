/* Cocardo: ¡Rescate Helado! — reproductor puro de eventos.
   Modelo mental del renderer: parte de prevState.grid y aplica SOLO los eventos de los pasos
   para reconstruir la grilla resultante. Lanza Error ante cualquier inconsistencia. */
(function () {
  'use strict';
  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  function fail(msg, e) { throw new Error('Replay: ' + msg + ' ' + JSON.stringify(e)); }

  function run(prevState, steps) {
    var g = JSON.parse(JSON.stringify(prevState.grid));
    var fz = prevState.freezer ? { r: prevState.freezer.r, c: prevState.freezer.c, hp: prevState.freezer.hp } : null;

    function cell(r, c) {
      if (r < 0 || c < 0 || r >= g.length || c >= g[0].length) fail('fuera del tablero', { r: r, c: c });
      return g[r][c];
    }
    function pieceWithId(r, c, id, e) {
      var cl = cell(r, c);
      if (!cl || !cl.p || cl.p.id !== id) fail('pieza ' + id + ' no está en ' + r + ',' + c, e);
      return cl.p;
    }
    function isEmpty(cl) { return !!cl && !cl.p && !cl.b; }

    (steps || []).forEach(function (step) {
      var ev = step.events || [], i = 0;
      while (i < ev.length) {
        var e = ev[i];
        if (e.t === 'fall') {
          // las caídas de un mismo bloque se aplican en dos fases (sacar todas, luego colocar)
          var batch = [];
          while (i < ev.length && ev[i].t === 'fall') batch.push(ev[i++]);
          var moving = batch.map(function (f) {
            var p = pieceWithId(f.from.r, f.from.c, f.id, f);
            g[f.from.r][f.from.c] = {};
            return p;
          });
          batch.forEach(function (f, k) {
            if (!isEmpty(cell(f.to.r, f.to.c))) fail('destino de caída ocupado', f);
            if (f.to.c !== f.from.c || f.to.r <= f.from.r) fail('caída no vertical hacia abajo', f);
            g[f.to.r][f.to.c] = { p: moving[k] };
          });
          continue;
        }
        var cl, p;
        switch (e.t) {
          case 'swap': {
            var pa = pieceWithId(e.a.r, e.a.c, e.ids[0], e), pb = pieceWithId(e.b.r, e.b.c, e.ids[1], e);
            g[e.a.r][e.a.c] = { p: pb }; g[e.b.r][e.b.c] = { p: pa };
            break;
          }
          case 'clear':
            pieceWithId(e.r, e.c, e.id, e);
            g[e.r][e.c] = {};
            break;
          case 'unfrost':
            p = pieceWithId(e.r, e.c, e.id, e);
            if (!p.frost) fail('unfrost sin escarcha', e);
            p.frost = false;
            break;
          case 'damage':
            if (e.kind === 'freezer') {
              if (!fz || fz.r !== e.r || fz.c !== e.c) fail('daño a congelador inexistente', e);
              fz.hp = e.hp;
            } else {
              cl = cell(e.r, e.c);
              if (!cl || !cl.b || cl.b.kind !== e.kind) fail('daño sin bloqueo', e);
              cl.b.hp = e.hp;
            }
            break;
          case 'destroy':
            cl = cell(e.r, e.c);
            if (!cl || !cl.b || cl.b.kind !== e.kind) fail('destroy sin bloqueo', e);
            g[e.r][e.c] = {};
            break;
          case 'rescue':
            cl = cell(e.r, e.c);
            if (!cl || !cl.b || cl.b.kind !== 'friend') fail('rescue sin amigo', e);
            g[e.r][e.c] = {};
            break;
          case 'freezerDown':
            if (!fz || fz.r !== e.r || fz.c !== e.c) fail('freezerDown sin congelador', e);
            fz.hp = 0;
            g[e.r][e.c] = {}; g[e.r][e.c + 1] = {}; g[e.r + 1][e.c] = {}; g[e.r + 1][e.c + 1] = {};
            break;
          case 'activate':
            pieceWithId(e.r, e.c, e.id, e);
            g[e.r][e.c] = {};
            break;
          case 'combo':
            (e.ids || []).forEach(function (id) {
              var at = null;
              [e.a, e.b].forEach(function (q) { var c2 = cell(q.r, q.c); if (c2 && c2.p && c2.p.id === id) at = q; });
              if (!at) fail('pieza de combo ' + id + ' no está en a/b', e);
              g[at.r][at.c] = {};
            });
            break;
          case 'create':
            if (!isEmpty(cell(e.r, e.c))) fail('create sobre celda ocupada', e);
            g[e.r][e.c] = { p: { id: e.id, type: e.type, color: e.color, frost: false } };
            break;
          case 'transform':
            p = pieceWithId(e.r, e.c, e.id, e);
            p.type = e.type;
            if (e.color !== undefined) p.color = e.color;
            break;
          case 'spawn': {
            if (!isEmpty(cell(e.to.r, e.to.c))) fail('spawn sobre celda ocupada', e);
            var np = { id: e.id, type: e.type, color: e.color, frost: false };
            if (e.skin) np.skin = e.skin;
            g[e.to.r][e.to.c] = { p: np };
            break;
          }
          case 'collect':
            p = pieceWithId(e.r, e.c, e.id, e);
            if (p.type !== 'token') fail('collect de algo que no es ficha', e);
            g[e.r][e.c] = {};
            break;
          case 'villain':
            e.targets.forEach(function (tg) {
              var tp = pieceWithId(tg.r, tg.c, tg.id, e);
              if (tp.type !== 'n' || tp.frost) fail('objetivo de villano inválido', tg);
              if (e.act === 'crate') g[tg.r][tg.c] = { b: { kind: 'crate', hp: 1, maxHp: 1 } };
              else tp.frost = true;
            });
            break;
          case 'shuffle': {
            var byId = {}, count = 0;
            g.forEach(function (row, r) {
              row.forEach(function (c2, c) { if (c2 && c2.p) { byId[c2.p.id] = c2.p; g[r][c] = {}; count++; } });
            });
            if (count !== e.pieces.length) fail('shuffle con distinta cantidad de piezas', { had: count, got: e.pieces.length });
            e.pieces.forEach(function (sp) {
              var old = byId[sp.id];
              if (!old) fail('shuffle con pieza desconocida', sp);
              if (!isEmpty(cell(sp.r, sp.c))) fail('shuffle a celda ocupada', sp);
              var q = { id: sp.id, type: sp.type, color: sp.color, frost: !!sp.frost };
              if (old.skin) q.skin = old.skin;
              g[sp.r][sp.c] = { p: q };
            });
            break;
          }
          case 'invalid': case 'cascade': case 'points': case 'goal': case 'booster': case 'win': case 'lose':
            break;
          default:
            fail('evento desconocido', e);
        }
        i++;
      }
    });
    return { grid: g, freezerHp: fz ? fz.hp : null };
  }

  var Replay = {
    apply: function (prevState, steps) { return run(prevState, steps).grid; },
    applyFull: run,
  };

  Cocardo.Replay = Replay;
  if (typeof module !== 'undefined' && module.exports) module.exports = Replay;
})();
