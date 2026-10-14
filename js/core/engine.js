/* Cocardo: ¡Rescate Helado! — motor match-3 puro y determinista.
   Contrato: docs/ARQUITECTURA.md §4. Reglas: docs/DISENO.md §3-5, §10.
   Nunca toca el DOM, ni Math.random, ni Date. Cada función pública devuelve un estado NUEVO. */
(function () {
  'use strict';
  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});
  var RNG = Cocardo.RNG;
  if (!RNG && typeof require === 'function') RNG = require('./rng.js');

  var COLOR_CODES = ['L', 'F', 'B', 'U', 'N', 'D'];
  var MATCHABLE = { n: 1, ph: 1, pv: 1, bomba: 1 };
  var SPECIAL = { ph: 1, pv: 1, bomba: 1, copa: 1 };
  var PALETA = { ph: 1, pv: 1 };
  var DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  // ---------- utilidades ----------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rnd(s) { var o = RNG.next(s.rng); s.rng = o.state; return o.value; }
  function rint(s, n) { return Math.floor(rnd(s) * n); }
  function pc(r, c) { return { r: r, c: c }; }
  // Solo índices enteros dentro del tablero: 0.5, '0', NaN, null... quedan fuera (evita g[0.5] === undefined y c+1 === '01').
  function inB(g, r, c) { return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0 && r < g.length && c < g[0].length; }
  function pieceAt(g, r, c) { var cell = inB(g, r, c) ? g[r][c] : null; return cell && cell.p ? cell.p : null; }
  function mcolor(cell) { return cell && cell.p && MATCHABLE[cell.p.type] ? cell.p.color : null; }
  function isSlot(cell) { return !!cell && !cell.b && !(cell.p && cell.p.frost); }
  function byReading(cols) { return function (x, y) { return (x.r * cols + x.c) - (y.r * cols + y.c); }; }

  // ---------- detección de matches ----------
  function findGroups(g) {
    var R = g.length, C = g[0].length, runs = [], r, c, e, k, i;
    for (r = 0; r < R; r++) {
      c = 0;
      while (c < C) {
        k = mcolor(g[r][c]);
        if (!k) { c++; continue; }
        e = c + 1;
        while (e < C && mcolor(g[r][e]) === k) e++;
        if (e - c >= 3) { var cells = []; for (i = c; i < e; i++) cells.push(pc(r, i)); runs.push({ dir: 'h', color: k, cells: cells }); }
        c = e;
      }
    }
    for (c = 0; c < C; c++) {
      r = 0;
      while (r < R) {
        k = mcolor(g[r][c]);
        if (!k) { r++; continue; }
        e = r + 1;
        while (e < R && mcolor(g[e][c]) === k) e++;
        if (e - r >= 3) { var vc = []; for (i = r; i < e; i++) vc.push(pc(i, c)); runs.push({ dir: 'v', color: k, cells: vc }); }
        r = e;
      }
    }
    if (!runs.length) return [];
    var parent = runs.map(function (_, j) { return j; });
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    var owner = {};
    runs.forEach(function (run, j) {
      run.cells.forEach(function (p) {
        var key = p.r * C + p.c;
        if (owner[key] !== undefined) { var a = find(j), b = find(owner[key]); if (a !== b) parent[a] = b; }
        else owner[key] = j;
      });
    });
    var byRoot = {}, groups = [];
    runs.forEach(function (run, j) {
      var rt = find(j);
      if (!byRoot[rt]) { byRoot[rt] = { color: run.color, runs: [], cells: [], _k: {} }; groups.push(byRoot[rt]); }
      var gr = byRoot[rt];
      gr.runs.push(run);
      run.cells.forEach(function (p) { var key = p.r * C + p.c; if (!gr._k[key]) { gr._k[key] = 1; gr.cells.push(p); } });
    });
    var cmp = byReading(C);
    groups.forEach(function (gr) { gr.cells.sort(cmp); delete gr._k; });
    groups.sort(function (x, y) { return cmp(x.cells[0], y.cells[0]); });
    return groups;
  }

  function hasMatch(g) {
    var R = g.length, C = g[0].length, r, c, k;
    for (r = 0; r < R; r++) for (c = 0; c < C; c++) {
      k = mcolor(g[r][c]);
      if (!k) continue;
      if (c + 2 < C && mcolor(g[r][c + 1]) === k && mcolor(g[r][c + 2]) === k) return true;
      if (r + 2 < R && mcolor(g[r + 1][c]) === k && mcolor(g[r + 2][c]) === k) return true;
    }
    return false;
  }

  function matchAt(g, r, c) {
    var k = mcolor(g[r][c]);
    if (!k) return false;
    var C = g[0].length, R = g.length, n = 1, i;
    for (i = c - 1; i >= 0 && mcolor(g[r][i]) === k; i--) n++;
    for (i = c + 1; i < C && mcolor(g[r][i]) === k; i++) n++;
    if (n >= 3) return true;
    n = 1;
    for (i = r - 1; i >= 0 && mcolor(g[i][c]) === k; i--) n++;
    for (i = r + 1; i < R && mcolor(g[i][c]) === k; i++) n++;
    return n >= 3;
  }

  // Qué especial crea un grupo (DISENO §3.3), con la corrida más larga.
  function specialFor(group) {
    var maxLen = 0, hasH = false, hasV = false, longest = null;
    group.runs.forEach(function (run) {
      if (run.cells.length > maxLen) { maxLen = run.cells.length; longest = run; }
      if (run.dir === 'h') hasH = true; else hasV = true;
    });
    if (maxLen >= 5) return { type: 'copa', longest: longest };
    if (hasH && hasV) return { type: 'bomba', longest: longest };
    if (maxLen === 4) return { type: longest.dir === 'h' ? 'ph' : 'pv', longest: longest };
    return null;
  }

  // Celda donde nace el especial: reglas (a)-(d).
  function placeFor(g, group, sp, swapCells) {
    var cand = [], C = g[0].length;
    var inGroup = {};
    group.cells.forEach(function (p) { inGroup[p.r * C + p.c] = 1; });
    if (swapCells) swapCells.forEach(function (p) { if (inGroup[p.r * C + p.c]) cand.push(p); });
    if (sp.type === 'bomba') {
      var hk = {}, vk = {};
      group.runs.forEach(function (run) {
        run.cells.forEach(function (p) { (run.dir === 'h' ? hk : vk)[p.r * C + p.c] = 1; });
      });
      group.cells.forEach(function (p) { var key = p.r * C + p.c; if (hk[key] && vk[key]) cand.push(p); });
    }
    var L = sp.longest.cells, mid = Math.floor(L.length / 2);
    cand.push(L[mid]);
    L.forEach(function (p, i) { if (i !== mid) cand.push(p); });
    group.cells.forEach(function (p) { cand.push(p); });
    for (var i = 0; i < cand.length; i++) {
      var pp = pieceAt(g, cand[i].r, cand[i].c);
      if (pp && pp.type === 'n' && !pp.frost) return pc(cand[i].r, cand[i].c);
    }
    return null;
  }

  // ---------- validez de intercambios ----------
  // Devuelve 'combo' | 'copa' | 'normal' | null.
  function swapKind(g, a, b) {
    if (!a || !b || !inB(g, a.r, a.c) || !inB(g, b.r, b.c)) return null;
    if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return null;
    var pa = pieceAt(g, a.r, a.c), pb = pieceAt(g, b.r, b.c);
    if (!pa || !pb || pa.frost || pb.frost) return null;
    if (SPECIAL[pa.type] && SPECIAL[pb.type]) return 'combo';
    if (pa.type === 'copa' || pb.type === 'copa') {
      var other = pa.type === 'copa' ? pb : pa;
      return other.type === 'n' ? 'copa' : null;
    }
    var ca = g[a.r][a.c], cb = g[b.r][b.c];
    ca.p = pb; cb.p = pa;
    var ok = matchAt(g, a.r, a.c) || matchAt(g, b.r, b.c);
    ca.p = pa; cb.p = pb;
    return ok ? 'normal' : null;
  }

  function listMoves(g, firstOnly) {
    var R = g.length, C = g[0].length, out = [];
    for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
      var p = pieceAt(g, r, c);
      if (!p || p.frost) continue;
      if (c + 1 < C && swapKind(g, pc(r, c), pc(r, c + 1))) { out.push({ a: pc(r, c), b: pc(r, c + 1) }); if (firstOnly) return out; }
      if (r + 1 < R && swapKind(g, pc(r, c), pc(r + 1, c))) { out.push({ a: pc(r, c), b: pc(r + 1, c) }); if (firstOnly) return out; }
    }
    return out;
  }
  function hasValidMove(g) { return listMoves(g, true).length > 0; }

  // Evalúa un intercambio sin resolverlo (para pista y 'ensure').
  var COMBO_STRENGTH = { 'copa+copa': 6, 'bomba+copa': 5, 'copa+ph': 4, 'copa+pv': 4, 'bomba+bomba': 3, 'bomba+ph': 2, 'bomba+pv': 2, 'ph+ph': 1, 'ph+pv': 1, 'pv+pv': 1 };
  function analyzeSwap(g, a, b) {
    var kind = swapKind(g, a, b);
    if (!kind) return null;
    var pa = pieceAt(g, a.r, a.c), pb = pieceAt(g, b.r, b.c);
    if (kind === 'combo') {
      var key = [pa.type, pb.type].sort().join('+');
      return { kind: kind, rank: 5, sub: COMBO_STRENGTH[key] || 0, specials: [], cleared: 0 };
    }
    if (kind === 'copa') {
      var col = (pa.type === 'copa' ? pb : pa).color, n = 0;
      g.forEach(function (row) { row.forEach(function (cell) { if (mcolor(cell) === col) n++; }); });
      return { kind: kind, rank: 1, sub: n, specials: [], cleared: n };
    }
    var ca = g[a.r][a.c], cb = g[b.r][b.c];
    ca.p = pb; cb.p = pa;
    var groups = findGroups(g), specials = [], cleared = 0, rank = 1;
    var RANK = { copa: 4, bomba: 3, ph: 2, pv: 2 };
    groups.forEach(function (gr) {
      cleared += gr.cells.length;
      var sp = specialFor(gr);
      if (sp && placeFor(g, gr, sp, [a, b])) { specials.push(sp.type); rank = Math.max(rank, RANK[sp.type]); }
    });
    ca.p = pa; cb.p = pb;
    return { kind: kind, rank: rank, sub: cleared, specials: specials, cleared: cleared };
  }

  // ---------- contexto de resolución ----------
  function newCtx(s) {
    return {
      s: s, steps: [], queued: {},
      info: { valid: true, cascades: 0, combo: false, cleared: 0, specials: 0 },
      lastGoals: s.goals.map(function (gl) { return gl.remaining; }),
    };
  }

  function pushStep(ctx, kind, cas, events) {
    var s = ctx.s;
    s.goals.forEach(function (gl, i) {
      if (gl.remaining !== ctx.lastGoals[i]) { events.push({ t: 'goal', index: i, remaining: gl.remaining }); ctx.lastGoals[i] = gl.remaining; }
    });
    ctx.steps.push({
      kind: kind, cascade: cas, events: events, score: s.score, movesLeft: s.movesLeft,
      goals: s.goals.map(function (gl) { return gl.remaining; }),
    });
  }

  function goalDec(s, type, color) {
    s.goals.forEach(function (gl) {
      if (gl.type === type && (type !== 'color' || gl.color === color) && gl.remaining > 0) gl.remaining--;
    });
  }

  function removePiece(ctx, r, c, cas, events) {
    var s = ctx.s, p = s.grid[r][c].p, pts = 20 * cas;
    events.push({ t: 'clear', id: p.id, r: r, c: c, color: p.color, type: p.type, points: pts });
    s.grid[r][c] = {};
    s.score += pts;
    ctx.info.cleared++;
    if (p.color) goalDec(s, 'color', p.color);
  }

  // Un golpe a un bloqueo. hitSet limita a 1 daño por bloqueo por grupo/activación (el congelador cuenta como uno).
  function hitBlocker(ctx, r, c, events, hitSet) {
    var s = ctx.s, g = s.grid, b = g[r][c].b;
    if (b.kind === 'freezer') {
      var fz = s.freezer;
      if (!fz || fz.hp <= 0 || hitSet.FZ) return;
      hitSet.FZ = 1;
      fz.hp--; s.score += 50; goalDec(s, 'boss');
      if (fz.hp > 0) events.push({ t: 'damage', r: fz.r, c: fz.c, kind: 'freezer', hp: fz.hp });
      else {
        events.push({ t: 'freezerDown', r: fz.r, c: fz.c, who: fz.who });
        g[fz.r][fz.c] = {}; g[fz.r][fz.c + 1] = {}; g[fz.r + 1][fz.c] = {}; g[fz.r + 1][fz.c + 1] = {};
      }
      return;
    }
    var key = r * g[0].length + c;
    if (hitSet[key]) return;
    hitSet[key] = 1;
    b.hp--; s.score += 50;
    if (b.hp > 0) { events.push({ t: 'damage', r: r, c: c, kind: b.kind, hp: b.hp }); return; }
    g[r][c] = {};
    if (b.kind === 'friend') {
      events.push({ t: 'rescue', r: r, c: c, who: b.who });
      s.rescued.push(b.who); s.score += 1000; goalDec(s, 'rescue');
    } else {
      events.push({ t: 'destroy', r: r, c: c, kind: b.kind });
      goalDec(s, b.kind === 'ice' ? 'ice' : 'crate');
    }
  }

  // Golpe de una activación sobre una celda.
  function hitCell(ctx, r, c, cas, events, hitSet, next) {
    var cell = ctx.s.grid[r][c];
    if (!cell) return;
    if (cell.b) { hitBlocker(ctx, r, c, events, hitSet); return; }
    var p = cell.p;
    if (!p || p.type === 'token') return;
    if (p.frost) { p.frost = false; events.push({ t: 'unfrost', id: p.id, r: r, c: c }); return; }
    if (SPECIAL[p.type]) {
      if (!ctx.queued[p.id]) { ctx.queued[p.id] = 1; next.push({ r: r, c: c, id: p.id }); }
      return;
    }
    removePiece(ctx, r, c, cas, events);
  }

  function rowCells(g, r) { var o = []; for (var c = 0; c < g[0].length; c++) if (g[r][c]) o.push(pc(r, c)); return o; }
  function colCells(g, c) { var o = []; for (var r = 0; r < g.length; r++) if (g[r][c]) o.push(pc(r, c)); return o; }
  function areaCells(g, r0, c0, rad) {
    var o = [];
    for (var r = r0 - rad; r <= r0 + rad; r++) for (var c = c0 - rad; c <= c0 + rad; c++) if (inB(g, r, c) && g[r][c]) o.push(pc(r, c));
    return o;
  }
  function unionCells(g, lists) {
    var C = g[0].length, seen = {}, out = [];
    lists.forEach(function (l) { l.forEach(function (p) { var k = p.r * C + p.c; if (!seen[k]) { seen[k] = 1; out.push(p); } }); });
    return out.sort(byReading(C));
  }
  function mostCommonColor(g) {
    var cnt = {};
    g.forEach(function (row) { row.forEach(function (cell) { if (cell && cell.p && cell.p.type === 'n') cnt[cell.p.color] = (cnt[cell.p.color] || 0) + 1; }); });
    var best = null, bn = 0;
    COLOR_CODES.forEach(function (k) { if ((cnt[k] || 0) > bn) { bn = cnt[k]; best = k; } });
    return best;
  }
  function colorCells(g, color) {
    var o = [];
    g.forEach(function (row, r) { row.forEach(function (cell, c) { if (mcolor(cell) === color) o.push(pc(r, c)); }); });
    return o;
  }

  // Dispara un especial (se quita a sí mismo y golpea su área).
  function fire(ctx, act, cas, events, next) {
    var s = ctx.s, g = s.grid, cell = g[act.r][act.c];
    if (!cell || !cell.p || cell.p.id !== act.id) return;
    var p = cell.p, before = s.score, pts = 20 * cas;
    g[act.r][act.c] = {};
    s.score += pts; ctx.info.cleared++;
    if (p.color) goalDec(s, 'color', p.color);
    var cells, color = p.color;
    if (p.type === 'ph') cells = rowCells(g, act.r);
    else if (p.type === 'pv') cells = colCells(g, act.c);
    else if (p.type === 'bomba') cells = areaCells(g, act.r, act.c, 1);
    else { color = act.color || mostCommonColor(g); cells = color ? colorCells(g, color) : []; }
    events.push({ t: 'activate', id: p.id, r: act.r, c: act.c, type: p.type, color: color, cells: cells, points: pts });
    var hit = {};
    cells.forEach(function (q) { if (q.r !== act.r || q.c !== act.c) hitCell(ctx, q.r, q.c, cas, events, hit, next); });
    events.push({ t: 'points', r: act.r, c: act.c, value: s.score - before });
  }

  function runWaves(ctx, wave, cas) {
    var guard = 0;
    while (wave.length && guard++ < 500) {
      var events = [], next = [];
      wave.forEach(function (act) { fire(ctx, act, cas, events, next); });
      pushStep(ctx, 'activate', cas, events);
      wave = next;
    }
  }

  // Paso de limpieza de una cascada: devuelve la ola 0 y los especiales a crear.
  function clearStep(ctx, groups, cas, swapCells) {
    var s = ctx.s, g = s.grid, events = [{ t: 'cascade', c: cas }], wave = [], creations = [];
    groups.forEach(function (gr) {
      var sp = specialFor(gr);
      var place = sp ? placeFor(g, gr, sp, swapCells) : null;
      var before = s.score;
      gr.cells.forEach(function (q) {
        var p = g[q.r][q.c].p;
        if (p.frost) { p.frost = false; events.push({ t: 'unfrost', id: p.id, r: q.r, c: q.c }); }
        else if (SPECIAL[p.type]) { if (!ctx.queued[p.id]) { ctx.queued[p.id] = 1; wave.push({ r: q.r, c: q.c, id: p.id }); } }
        else removePiece(ctx, q.r, q.c, cas, events);
      });
      var hit = {};
      gr.cells.forEach(function (q) {
        DIRS.forEach(function (d) {
          var nr = q.r + d[0], nc = q.c + d[1];
          if (inB(g, nr, nc) && g[nr][nc] && g[nr][nc].b) hitBlocker(ctx, nr, nc, events, hit);
        });
      });
      if (place) creations.push({ r: place.r, c: place.c, type: sp.type, color: sp.type === 'copa' ? null : gr.color });
      var anchor = place || gr.cells[Math.floor(gr.cells.length / 2)];
      if (s.score > before) events.push({ t: 'points', r: anchor.r, c: anchor.c, value: s.score - before });
    });
    pushStep(ctx, 'clear', cas, events);
    return { wave: wave, creations: creations };
  }

  function createStep(ctx, creations, cas) {
    var s = ctx.s, g = s.grid, events = [];
    creations.forEach(function (cr) {
      var cell = g[cr.r][cr.c];
      if (!cell || cell.b || cell.p) return;
      var id = s.nextId++;
      g[cr.r][cr.c] = { p: { id: id, type: cr.type, color: cr.color, frost: false } };
      s.score += 60; ctx.info.specials++; s.stats.specials++;
      events.push({ t: 'create', id: id, r: cr.r, c: cr.c, type: cr.type, color: cr.color });
      events.push({ t: 'points', r: cr.r, c: cr.c, value: 60 });
    });
    if (events.length) pushStep(ctx, 'create', cas, events);
  }

  function countTokens(g) {
    var n = 0;
    g.forEach(function (row) { row.forEach(function (cell) { if (cell && cell.p && cell.p.type === 'token') n++; }); });
    return n;
  }

  // Gravedad + aparición + recolección de fichas (repite mientras se recolecte algo).
  function fallPhase(ctx, cas) {
    var s = ctx.s, g = s.grid, R = g.length, C = g[0].length;
    for (var guard = 0; guard < 100; guard++) {
      var falls = [], spawns = [], collects = [], plan = [], r, c;
      for (c = 0; c < C; c++) {
        var slots = [];
        for (r = 0; r < R; r++) if (isSlot(g[r][c])) slots.push(r);
        if (!slots.length) continue;
        var pieces = slots.filter(function (rr) { return !!g[rr][c].p; });
        var k = slots.length - pieces.length;
        for (var i = pieces.length - 1; i >= 0; i--) {
          var from = pieces[i], to = slots[k + i];
          if (from !== to) {
            var p = g[from][c].p;
            g[to][c] = { p: p }; g[from][c] = {};
            falls.push({ t: 'fall', id: p.id, from: pc(from, c), to: pc(to, c) });
          }
        }
        plan.push({ c: c, slots: slots, empties: slots.slice(0, k) });
      }
      var tokenCol = {};
      if (s.tokens) {
        var onBoard = countTokens(g);
        var cand = plan.filter(function (pl) { return pl.empties.length > 0; });
        while (onBoard < s.tokens.onBoard && s.tokens.spawned < s.tokens.total && cand.length) {
          var ix = rint(s, cand.length);
          tokenCol[cand[ix].c] = 1;
          cand.splice(ix, 1);
          onBoard++; s.tokens.spawned++;
        }
      }
      plan.forEach(function (pl) {
        var k2 = pl.empties.length;
        for (var j = k2 - 1; j >= 0; j--) {
          var rr = pl.empties[j], id = s.nextId++, piece, ev;
          if (j === 0 && tokenCol[pl.c]) {
            piece = { id: id, type: 'token', color: null, frost: false, skin: s.tokens.skin };
            ev = { t: 'spawn', id: id, to: pc(rr, pl.c), type: 'token', color: null, skin: s.tokens.skin, from: -(k2 - j) };
          } else {
            var col = s.colors[rint(s, s.colors.length)];
            piece = { id: id, type: 'n', color: col, frost: false };
            ev = { t: 'spawn', id: id, to: pc(rr, pl.c), type: 'n', color: col, from: -(k2 - j) };
          }
          g[rr][pl.c] = { p: piece };
          spawns.push(ev);
        }
      });
      plan.forEach(function (pl) {
        var low = pl.slots[pl.slots.length - 1], p = g[low][pl.c].p;
        if (p && p.type === 'token') {
          collects.push({ t: 'collect', id: p.id, r: low, c: pl.c, skin: p.skin });
          collects.push({ t: 'points', r: low, c: pl.c, value: 500 });
          g[low][pl.c] = {};
          if (s.tokens) s.tokens.collected++;
          s.score += 500; goalDec(s, 'token');
        }
      });
      var events = falls.concat(spawns, collects);
      if (events.length) pushStep(ctx, 'fall', cas, events);
      if (!collects.length) break;
    }
  }

  // Bucle de resolución (DISENO §3.4). init() opcional produce la ola 0 de la cascada 1.
  function resolve(ctx, init, swapCells) {
    var s = ctx.s;
    for (var cas = 1; cas < 300; cas++) {
      ctx.queued = {};
      var wave, creations = [];
      if (cas === 1 && init) wave = init();
      else {
        var groups = findGroups(s.grid);
        if (!groups.length) break;
        var res = clearStep(ctx, groups, cas, cas === 1 ? swapCells : null);
        wave = res.wave; creations = res.creations;
      }
      runWaves(ctx, wave, cas);
      createStep(ctx, creations, cas);
      fallPhase(ctx, cas);
      ctx.info.cascades = cas;
      if (cas > s.stats.maxCascade) s.stats.maxCascade = cas;
    }
  }

  // ---------- combos e intercambio con Copa ----------
  // A = pieza que estaba en a (ahora en b), B = pieza que estaba en b (ahora en a).
  function comboInit(ctx, a, b, A, B) {
    var s = ctx.s, g = s.grid, cas = 1, events = [], before = s.score;
    var ta = A.type, tb = B.type;
    ctx.info.combo = true; s.stats.combos++;
    function drop(p, at) {
      g[at.r][at.c] = {};
      s.score += 20 * cas; ctx.info.cleared++;
      if (p.color) goalDec(s, 'color', p.color);
    }
    if (ta === 'copa' && tb === 'copa') {
      drop(A, b); drop(B, a);
      var all = [];
      g.forEach(function (row, r) { row.forEach(function (cell, c) { if (cell) all.push(pc(r, c)); }); });
      events.push({ t: 'combo', a: pc(a.r, a.c), b: pc(b.r, b.c), types: [ta, tb], r: b.r, c: b.c, cells: all, ids: [A.id, B.id], points: 40 * cas });
      var hit = {};
      all.forEach(function (q) {
        var cell = g[q.r][q.c];
        if (cell.b) { hitBlocker(ctx, q.r, q.c, events, hit); return; }
        var p = cell.p;
        if (!p || p.type === 'token') return;
        if (p.frost) { p.frost = false; events.push({ t: 'unfrost', id: p.id, r: q.r, c: q.c }); return; }
        removePiece(ctx, q.r, q.c, cas, events);
      });
      events.push({ t: 'points', r: b.r, c: b.c, value: s.score - before });
      pushStep(ctx, 'activate', cas, events);
      return [];
    }
    if (ta === 'copa' || tb === 'copa') {
      var Cp = ta === 'copa' ? A : B, X = ta === 'copa' ? B : A;
      var posC = ta === 'copa' ? b : a, posX = ta === 'copa' ? a : b;
      drop(Cp, posC);
      var targets = [];
      g.forEach(function (row, r) {
        row.forEach(function (cell, c) {
          if (cell && cell.p && cell.p.type === 'n' && !cell.p.frost && cell.p.color === X.color) targets.push(pc(r, c));
        });
      });
      events.push({ t: 'combo', a: pc(a.r, a.c), b: pc(b.r, b.c), types: [ta, tb], r: b.r, c: b.c, cells: targets, ids: [Cp.id], points: 20 * cas });
      var wave = [{ r: posX.r, c: posX.c, id: X.id }];
      ctx.queued[X.id] = 1;
      targets.forEach(function (q) {
        var p = g[q.r][q.c].p;
        var nt = X.type === 'bomba' ? 'bomba' : (rnd(s) < 0.5 ? 'ph' : 'pv');
        p.type = nt;
        events.push({ t: 'transform', id: p.id, r: q.r, c: q.c, type: nt, color: p.color });
        ctx.queued[p.id] = 1;
        wave.push({ r: q.r, c: q.c, id: p.id });
      });
      events.push({ t: 'points', r: b.r, c: b.c, value: s.score - before });
      pushStep(ctx, 'activate', cas, events);
      return wave;
    }
    // combos de área
    drop(A, b); drop(B, a);
    var nPal = (PALETA[ta] ? 1 : 0) + (PALETA[tb] ? 1 : 0), cells;
    if (nPal === 2) cells = unionCells(g, [rowCells(g, b.r), colCells(g, b.c)]);
    else if (nPal === 1) {
      var ls = [];
      for (var d = -1; d <= 1; d++) {
        if (b.r + d >= 0 && b.r + d < g.length) ls.push(rowCells(g, b.r + d));
        if (b.c + d >= 0 && b.c + d < g[0].length) ls.push(colCells(g, b.c + d));
      }
      cells = unionCells(g, ls);
    } else cells = areaCells(g, b.r, b.c, 2);
    events.push({ t: 'combo', a: pc(a.r, a.c), b: pc(b.r, b.c), types: [ta, tb], r: b.r, c: b.c, cells: cells, ids: [A.id, B.id], points: 40 * cas });
    var next = [], hit2 = {};
    cells.forEach(function (q) { hitCell(ctx, q.r, q.c, cas, events, hit2, next); });
    events.push({ t: 'points', r: b.r, c: b.c, value: s.score - before });
    pushStep(ctx, 'activate', cas, events);
    return next;
  }

  // ---------- fin de turno: villanos, barajar ----------
  function goalsDone(s) { return s.goals.every(function (gl) { return gl.remaining <= 0; }); }

  function villainPhase(ctx) {
    var s = ctx.s, g = s.grid, events = [];
    s.villains.forEach(function (v) {
      if (v.src === 'boss' && s.freezer && s.freezer.hp <= 0) return;
      v.counter--;
      if (v.counter > 0) return;
      v.counter = v.every;
      var cand = [];
      g.forEach(function (row, r) {
        row.forEach(function (cell, c) { if (cell && cell.p && cell.p.type === 'n' && !cell.p.frost) cand.push(pc(r, c)); });
      });
      var targets = [];
      for (var i = 0; i < (v.count || 1) && cand.length; i++) {
        var q = cand.splice(rint(s, cand.length), 1)[0], p = g[q.r][q.c].p;
        targets.push({ r: q.r, c: q.c, id: p.id });
        if (v.act === 'crate') g[q.r][q.c] = { b: { kind: 'crate', hp: 1, maxHp: 1 } };
        else p.frost = true;
      }
      events.push({ t: 'villain', who: v.who, act: v.act, src: v.src, targets: targets });
    });
    if (events.length) pushStep(ctx, 'villain', 0, events);
  }

  function pickColorAvoid(s, g, r, c, colors) {
    var bad = {};
    if (c >= 2) { var x = mcolor(g[r][c - 1]); if (x && x === mcolor(g[r][c - 2])) bad[x] = 1; }
    if (r >= 2) { var y = mcolor(g[r - 1][c]); if (y && y === mcolor(g[r - 2][c])) bad[y] = 1; }
    var allowed = colors.filter(function (k) { return !bad[k]; });
    if (!allowed.length) allowed = colors;
    return allowed[rint(s, allowed.length)];
  }

  function allPieces(g) {
    var out = [];
    g.forEach(function (row, r) {
      row.forEach(function (cell, c) {
        if (cell && cell.p) {
          var p = cell.p, o = { id: p.id, r: r, c: c, color: p.color, type: p.type, frost: p.frost };
          if (p.skin) o.skin = p.skin;
          out.push(o);
        }
      });
    });
    return out;
  }

  // Barajado (DISENO §3.5 paso 4). Sin pasos si ctx es null.
  function shuffleGrid(s) {
    var g = s.grid;
    function ok() { return !hasMatch(g) && hasValidMove(g); }
    for (var round = 0; round < 12; round++) {
      var pos = [];
      g.forEach(function (row, r) {
        row.forEach(function (cell, c) { if (cell && cell.p && MATCHABLE[cell.p.type] && !cell.p.frost) pos.push(pc(r, c)); });
      });
      var pieces = pos.map(function (q) { return g[q.r][q.c].p; });
      var t, i;
      for (t = 0; t < 50; t++) {
        for (i = pieces.length - 1; i > 0; i--) { var j = rint(s, i + 1), tmp = pieces[i]; pieces[i] = pieces[j]; pieces[j] = tmp; }
        pos.forEach(function (q, k) { g[q.r][q.c] = { p: pieces[k] }; });
        if (ok()) return true;
      }
      for (t = 0; t < 200; t++) {
        pos.forEach(function (q) { var p = g[q.r][q.c].p; if (p.type === 'n') p.color = pickColorAvoid(s, g, q.r, q.c, s.colors); });
        if (ok()) return true;
      }
      var frosted = [];
      g.forEach(function (row, r) { row.forEach(function (cell, c) { if (cell && cell.p && cell.p.frost) frosted.push(pc(r, c)); }); });
      for (i = 0; i < 3 && frosted.length; i++) {
        var q = frosted.splice(rint(s, frosted.length), 1)[0];
        g[q.r][q.c].p.frost = false;
      }
    }
    return false;
  }

  function shuffleStep(ctx, reason) {
    var s = ctx.s;
    shuffleGrid(s);
    pushStep(ctx, 'shuffle', 0, [{
      t: 'shuffle', reason: reason, who: s.levelId >= 21 ? 'cereza' : 'cocardo', pieces: allPieces(s.grid),
    }]);
  }

  function endTurn(ctx, isSwap) {
    var s = ctx.s;
    if (goalsDone(s)) {
      s.status = 'won'; s.wonMovesLeft = s.movesLeft;
      pushStep(ctx, 'end', 0, [{ t: 'win' }]);
      return;
    }
    if (isSwap) {
      if (s.movesLeft > 0) villainPhase(ctx);
      if (s.movesLeft <= 0) {
        s.status = 'lost';
        pushStep(ctx, 'end', 0, [{ t: 'lose' }]);
        return;
      }
    }
    if (!hasValidMove(s.grid)) {
      shuffleStep(ctx, 'nomoves');
      if (hasMatch(s.grid)) resolve(ctx, null, null); // caso patológico: no debería ocurrir
    }
  }

  // ---------- creación del juego ----------
  function initGoals(level, counts, fzHp) {
    return (level.goals || []).map(function (gl) {
      var target;
      if (gl.type === 'color') target = gl.n;
      else if (gl.type === 'ice') target = counts.ice;
      else if (gl.type === 'crate') target = gl.n;
      else if (gl.type === 'rescue') target = counts.friend;
      else if (gl.type === 'token') target = level.tokens ? level.tokens.total : 0;
      else if (gl.type === 'boss') target = fzHp || 0;
      else target = gl.n || 0;
      var o = { type: gl.type };
      if (gl.type === 'color') o.color = gl.color;
      o.target = target; o.remaining = target;
      return o;
    });
  }

  function baseState(level, seed, rows, cols, colors) {
    return {
      levelId: level.id || 0, daily: !!level.daily, rows: rows, cols: cols, colors: colors,
      rng: RNG.seedFrom(seed), nextId: 1, turn: 0, grid: null, freezer: null,
      movesLeft: level.moves || 20, movesTotal: level.moves || 20, score: 0, goals: [],
      villains: (level.villains || []).map(function (v) {
        return { who: v.who, act: v.act, every: v.every, count: v.count || 1, src: v.src || 'hud', counter: v.every };
      }),
      tokens: level.tokens ? { skin: level.tokens.skin, total: level.tokens.total, onBoard: level.tokens.onBoard, spawned: 0, collected: 0 } : null,
      rescued: [], status: 'playing', stats: { maxCascade: 0, specials: 0, combos: 0 }, wonMovesLeft: null,
    };
  }

  function assignIds(s) {
    s.grid.forEach(function (row) { row.forEach(function (cell) { if (cell && cell.p) cell.p.id = s.nextId++; }); });
  }

  function ensureOk(g, ensure) {
    var moves = listMoves(g, false);
    for (var i = 0; i < moves.length; i++) {
      var an = analyzeSwap(g, moves[i].a, moves[i].b);
      if (!an || an.kind !== 'normal') continue;
      for (var j = 0; j < an.specials.length; j++) {
        var t = an.specials[j];
        if (t === ensure || (ensure === 'ph' && (t === 'ph' || t === 'pv'))) return true;
      }
    }
    return false;
  }

  function createGame(level, seed) {
    var layout = level.layout, rows = layout.length, cols = layout[0].length;
    var colors = String(level.colors || 'LFBU').split('');
    var s = baseState(level, seed, rows, cols, colors);
    var friendHP = level.friendHP || 2, rescue = level.rescue || [], fi = 0;
    var counts = { ice: 0, friend: 0 }, fz = null, nT = 0;
    // plantilla estática
    var tpl = [];
    for (var r = 0; r < rows; r++) {
      tpl.push([]);
      for (var c = 0; c < cols; c++) {
        var ch = layout[r][c], t;
        if (ch === '#') t = null;
        else if (ch === '.') t = { gen: true, frost: false };
        else if (ch === 'e' || ch === 'E') t = { gen: true, frost: true };
        else if (ch === '1' || ch === '2' || ch === '3') { t = { b: { kind: 'ice', hp: +ch, maxHp: +ch } }; counts.ice++; }
        else if (ch === 'K') t = { b: { kind: 'crate', hp: 1, maxHp: 1 } };
        else if (ch === 'R') { t = { b: { kind: 'friend', hp: friendHP, maxHp: friendHP, who: rescue[fi++] || 'lima' } }; counts.friend++; }
        else if (ch === 'C') { t = { b: { kind: 'freezer' } }; if (!fz) fz = { r: r, c: c }; }
        else if (ch === 'T') { t = { tok: true }; nT++; }
        else t = { gen: true, frost: false };
        tpl[r].push(t);
      }
    }
    if (fz) {
      var fhp = (level.freezer && level.freezer.hp) || 8;
      s.freezer = { r: fz.r, c: fz.c, hp: fhp, maxHp: fhp, who: (level.freezer && level.freezer.who) || 'cocardo' };
    }
    if (s.tokens) s.tokens.spawned = nT;
    var skin = level.tokens ? level.tokens.skin : 'uva';
    var g = null;
    for (var attempt = 0; attempt < 1000; attempt++) {
      g = [];
      for (r = 0; r < rows; r++) {
        g.push([]);
        for (c = 0; c < cols; c++) {
          var tp = tpl[r][c];
          if (!tp) g[r].push(null);
          else if (tp.b) g[r].push({ b: clone(tp.b) });
          else if (tp.tok) g[r].push({ p: { id: 0, type: 'token', color: null, frost: false, skin: skin } });
          else g[r].push({ p: { id: 0, type: 'n', color: pickColorAvoid(s, g, r, c, colors), frost: tp.frost } });
        }
      }
      if (hasMatch(g) || !hasValidMove(g)) continue;
      if (level.ensure && attempt < 500 && !ensureOk(g, level.ensure)) continue;
      break;
    }
    s.grid = g;
    if (!hasValidMove(g)) shuffleGrid(s);
    assignIds(s);
    s.goals = initGoals(level, counts, s.freezer ? s.freezer.hp : 0);
    return s;
  }

  // Ayuda de pruebas: tablero exacto desde filas de fichas separadas por espacios.
  //   '#' vacío · 'L','F','B','U','N','D' normal · sufijo '*' escarcha · sufijo 'h'|'v'|'b' = ph|pv|bomba
  //   '@' Copa · 'T' ficha (sufijo 'p' = prueba) · 'I1'..'I3' hielo · 'K' caja · 'R' / 'R3' amigo · 'Z' congelador
  function fromRows(rowsIn, opts) {
    opts = opts || {};
    var cellsTxt = rowsIn.map(function (row) { return row.trim().split(/\s+/); });
    var rows = cellsTxt.length, cols = cellsTxt[0].length;
    var level = {
      id: opts.levelId || 0, moves: opts.moves || 20, goals: opts.goals || [{ type: 'color', color: 'L', n: 99 }],
      villains: opts.villains || [], tokens: opts.tokens || null, daily: !!opts.daily,
    };
    var colors;
    if (opts.colors) colors = String(opts.colors).split('');
    else {
      // por defecto: LFBU más los colores presentes en el tablero
      var present = 'LFBU' + cellsTxt.map(function (row) { return row.join(''); }).join('');
      colors = COLOR_CODES.filter(function (k) { return present.indexOf(k) >= 0; });
    }
    var s = baseState(level, opts.seed === undefined ? 1 : opts.seed, rows, cols, colors);
    var rescue = opts.rescue || [], fi = 0, counts = { ice: 0, friend: 0 }, fz = null, nT = 0;
    var tokSkin = opts.tokens ? opts.tokens.skin : 'uva';
    s.grid = cellsTxt.map(function (row, r) {
      if (row.length !== cols) throw new Error('fromRows: fila ' + r + ' con largo distinto');
      return row.map(function (tk, c) {
        if (tk === '#') return null;
        if (tk === '@') return { p: { id: 0, type: 'copa', color: null, frost: false } };
        if (tk[0] === 'T') { nT++; return { p: { id: 0, type: 'token', color: null, frost: false, skin: tk[1] === 'p' ? 'prueba' : (tk[1] === 'u' ? 'uva' : tokSkin) } }; }
        if (tk[0] === 'I') { var h = +tk[1] || 1; counts.ice++; return { b: { kind: 'ice', hp: h, maxHp: h } }; }
        if (tk === 'K') return { b: { kind: 'crate', hp: 1, maxHp: 1 } };
        if (tk[0] === 'R') { var fh = +tk[1] || opts.friendHP || 2; counts.friend++; return { b: { kind: 'friend', hp: fh, maxHp: fh, who: rescue[fi++] || 'lima' } }; }
        if (tk === 'Z') { if (!fz) fz = { r: r, c: c }; return { b: { kind: 'freezer' } }; }
        var col = tk[0];
        if (COLOR_CODES.indexOf(col) < 0) throw new Error('fromRows: ficha desconocida ' + tk);
        var type = 'n', frost = false;
        for (var i = 1; i < tk.length; i++) {
          if (tk[i] === '*') frost = true;
          else if (tk[i] === 'h') type = 'ph';
          else if (tk[i] === 'v') type = 'pv';
          else if (tk[i] === 'b') type = 'bomba';
        }
        return { p: { id: 0, type: type, color: col, frost: frost } };
      });
    });
    if (fz) {
      var fhp = (opts.freezer && opts.freezer.hp) || 8;
      s.freezer = { r: fz.r, c: fz.c, hp: fhp, maxHp: fhp, who: (opts.freezer && opts.freezer.who) || 'cocardo' };
    }
    if (s.tokens) s.tokens.spawned = opts.tokens.spawned !== undefined ? opts.tokens.spawned : nT;
    assignIds(s);
    s.goals = initGoals(level, counts, s.freezer ? s.freezer.hp : 0);
    if (opts.movesLeft !== undefined) s.movesLeft = opts.movesLeft;
    return s;
  }

  // ---------- API pública ----------
  function invalidResult(s, a, b) {
    return {
      state: s,
      steps: [{
        kind: 'invalid', cascade: 0, events: [{ t: 'invalid', a: a ? pc(a.r, a.c) : null, b: b ? pc(b.r, b.c) : null }],
        score: s.score, movesLeft: s.movesLeft, goals: s.goals.map(function (gl) { return gl.remaining; }),
      }],
      turnInfo: { valid: false, cascades: 0, combo: false, cleared: 0, specials: 0 },
    };
  }

  function applySwap(state, a, b) {
    var s = clone(state);
    var kind = s.status === 'playing' ? swapKind(s.grid, a, b) : null;
    if (!kind) return invalidResult(s, a, b);
    a = pc(a.r, a.c); b = pc(b.r, b.c);
    var ctx = newCtx(s), g = s.grid;
    var A = g[a.r][a.c].p, B = g[b.r][b.c].p;
    g[a.r][a.c] = { p: B }; g[b.r][b.c] = { p: A };
    s.movesLeft--; s.turn++;
    pushStep(ctx, 'swap', 0, [{ t: 'swap', a: a, b: b, ids: [A.id, B.id], back: false }]);
    var init = null;
    if (kind === 'combo') init = function () { return comboInit(ctx, a, b, A, B); };
    else if (kind === 'copa') {
      init = function () {
        var cop = A.type === 'copa' ? A : B, nn = A.type === 'copa' ? B : A, at = A.type === 'copa' ? b : a;
        var events = [], next = [];
        fire(ctx, { r: at.r, c: at.c, id: cop.id, color: nn.color }, 1, events, next);
        pushStep(ctx, 'activate', 1, events);
        return next;
      };
    }
    resolve(ctx, init, kind === 'normal' ? [a, b] : null);
    endTurn(ctx, true);
    return { state: s, steps: ctx.steps, turnInfo: ctx.info };
  }

  function useBooster(state, type, cell) {
    if (!state || state.status !== 'playing') return null;
    var s = clone(state), g = s.grid, ctx = newCtx(s);
    if (type === 'batido') {
      pushStep(ctx, 'booster', 0, [{ t: 'booster', type: 'batido' }]);
      shuffleStep(ctx, 'batido');
      resolve(ctx, null, null);
    } else if (type === 'cucharon' || type === 'chorro') {
      if (!cell || !inB(g, cell.r, cell.c) || !g[cell.r][cell.c]) return null;
      var r = cell.r, c = cell.c, target = g[r][c];
      if (type === 'cucharon') {
        if (!target.b && !target.p) return null;
        if (target.p && target.p.type === 'token') return null;
        resolve(ctx, function () {
          var events = [{ t: 'booster', type: 'cucharon', r: r, c: c, cells: [pc(r, c)] }], next = [], before = s.score;
          hitCell(ctx, r, c, 1, events, {}, next);
          if (s.score > before) events.push({ t: 'points', r: r, c: c, value: s.score - before });
          pushStep(ctx, 'booster', 1, events);
          return next;
        }, null);
      } else {
        resolve(ctx, function () {
          var cells = rowCells(g, r), next = [], hit = {}, before = s.score;
          var events = [{ t: 'booster', type: 'chorro', r: r, c: c, cells: cells }];
          cells.forEach(function (q) { hitCell(ctx, q.r, q.c, 1, events, hit, next); });
          if (s.score > before) events.push({ t: 'points', r: r, c: c, value: s.score - before });
          pushStep(ctx, 'booster', 1, events);
          return next;
        }, null);
      }
    } else return null;
    endTurn(ctx, false);
    return { state: s, steps: ctx.steps, turnInfo: ctx.info };
  }

  function heladoFinal(state) {
    var s = clone(state), ctx = newCtx(s);
    if (s.status !== 'won') return { state: s, steps: [] };
    var g = s.grid;
    while (s.movesLeft > 0) {
      s.movesLeft--; s.score += 300;
      var cand = [];
      g.forEach(function (row, r) {
        row.forEach(function (cell, c) { if (cell && cell.p && cell.p.type === 'n' && !cell.p.frost) cand.push(pc(r, c)); });
      });
      if (!cand.length) { pushStep(ctx, 'transform', 1, []); continue; }
      var q = cand[rint(s, cand.length)], p = g[q.r][q.c].p;
      p.type = rnd(s) < 0.5 ? 'ph' : 'pv';
      pushStep(ctx, 'transform', 1, [
        { t: 'transform', id: p.id, r: q.r, c: q.c, type: p.type, color: p.color },
        { t: 'points', r: q.r, c: q.c, value: 300 },
      ]);
      resolve(ctx, (function (pid, rr, cc) {
        return function () { ctx.queued[pid] = 1; return [{ r: rr, c: cc, id: pid }]; };
      })(p.id, q.r, q.c), null);
    }
    return { state: s, steps: ctx.steps };
  }

  // swapKind intercambia piezas in situ para probar matches: siempre sobre una copia (§4.2, el estado de entrada nunca se muta).
  function validMoves(state) { return listMoves(clone(state.grid), false); }
  function canSwap(state, a, b) { return state.status === 'playing' && !!swapKind(clone(state.grid), a, b); }

  function hint(state) {
    if (state.status !== 'playing') return null;
    var g = clone(state.grid), moves = listMoves(g, false), best = null, bestScore = -1;
    moves.forEach(function (m) {
      var an = analyzeSwap(g, m.a, m.b);
      if (!an) return;
      var sc = an.rank * 10000 + an.sub;
      if (sc > bestScore) { bestScore = sc; best = m; }
    });
    return best ? { a: best.a, b: best.b } : null;
  }

  function goalUnits(state) {
    var rem = 0, start = 0;
    state.goals.forEach(function (gl) { rem += Math.max(0, gl.remaining); start += gl.target; });
    return { remaining: rem, start: start };
  }

  function starsFor(state) {
    if (state.status !== 'won') return 0;
    var ml = state.wonMovesLeft !== null && state.wonMovesLeft !== undefined ? state.wonMovesLeft : state.movesLeft;
    var tot = state.movesTotal || 1;
    return 1 + (ml * 100 >= 15 * tot ? 1 : 0) + (ml * 100 >= 30 * tot ? 1 : 0);
  }

  function isStable(state) { return !hasMatch(state.grid); }

  function findMatches(state) {
    return findGroups(state.grid).map(function (gr) {
      var sp = specialFor(gr);
      return { color: gr.color, cells: gr.cells, runs: gr.runs.map(function (r) { return { dir: r.dir, cells: r.cells }; }), special: sp ? sp.type : null };
    });
  }

  var Engine = {
    COLORS: COLOR_CODES,
    createGame: createGame,
    validMoves: validMoves,
    hint: hint,
    canSwap: canSwap,
    applySwap: applySwap,
    useBooster: useBooster,
    heladoFinal: heladoFinal,
    goalUnits: goalUnits,
    starsFor: starsFor,
    isStable: isStable,
    findMatches: findMatches,
    fromRows: fromRows,
    _fromRows: fromRows,
    _analyzeSwap: function (state, a, b) { return analyzeSwap(clone(state.grid), a, b); },
  };

  Cocardo.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})();
