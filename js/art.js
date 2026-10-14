/* Cocardo: ¡Rescate Helado! — Arte del tablero en SVG (cadenas, sin DOM).
 * Contrato: docs/ARQUITECTURA.md §8. Aspecto de personajes: docs/PERSONAJES.md.
 * Este archivo crea Cocardo.Art; js/art-characters.js añade `characters` y `portrait`.
 * Nunca sobrescribe claves existentes. Cada llamada usa ids únicos (sufijo contador). */
(function () {
  'use strict';

  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  var INK = '#2b1630';
  var NS = 'xmlns="http://www.w3.org/2000/svg"';
  var uidN = 0;

  // ---------- utilidades ----------
  function f(n) { return Math.round(n * 10) / 10; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function newCtx() { uidN = (uidN + 1) % 1e9; return { id: 'k' + uidN.toString(36), n: 0, defs: [] }; }
  function gid(ctx) { ctx.n++; return ctx.id + '_' + ctx.n; }
  function wrap(ctx, w, h, body, extra) {
    return '<svg ' + NS + ' viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '"' + (extra || '') + '>' +
      (ctx.defs.length ? '<defs>' + ctx.defs.join('') + '</defs>' : '') + body + '</svg>';
  }
  // Degradado radial: stops = [[offset, color, opacity?], ...]
  function rg(ctx, stops, cx, cy, r, fx, fy) {
    var id = gid(ctx);
    ctx.defs.push('<radialGradient id="' + id + '" cx="' + (cx == null ? 0.4 : cx) + '" cy="' + (cy == null ? 0.35 : cy) +
      '" r="' + (r == null ? 0.7 : r) + '"' + (fx != null ? ' fx="' + fx + '" fy="' + fy + '"' : '') + '>' + stopsStr(stops) + '</radialGradient>');
    return 'url(#' + id + ')';
  }
  function lg(ctx, stops, x1, y1, x2, y2) {
    var id = gid(ctx);
    ctx.defs.push('<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' + stopsStr(stops) + '</linearGradient>');
    return 'url(#' + id + ')';
  }
  function stopsStr(stops) {
    return stops.map(function (s) {
      return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>';
    }).join('');
  }
  function clip(ctx, shape) {
    var id = gid(ctx);
    ctx.defs.push('<clipPath id="' + id + '">' + shape + '</clipPath>');
    return 'url(#' + id + ')';
  }
  // Curva suave cerrada (Catmull-Rom) por puntos [[x,y],...]
  function smooth(pts) {
    var n = pts.length, d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += 'C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
        f(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
    }
    return d + 'Z';
  }
  // Contorno ondulado alrededor de una elipse
  function wavy(cx, cy, rx, ry, n, amp, rot) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (rot || 0) + i * Math.PI * 2 / n, k = 1 + (i % 2 ? -amp : amp);
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return smooth(pts);
  }
  // Nube de rizos: arcos hacia afuera entre puntos de un círculo
  function scallop(cx, cy, rx, ry, n, rot) {
    var d = '', a0 = rot || 0;
    for (var i = 0; i <= n; i++) {
      var a = a0 + i * Math.PI * 2 / n, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      if (i === 0) d = 'M' + f(x) + ' ' + f(y);
      else {
        var chord = 2 * Math.sin(Math.PI / n) * (rx + ry) / 2;
        d += 'A' + f(chord * 0.58) + ' ' + f(chord * 0.58) + ' 0 0 1 ' + f(x) + ' ' + f(y);
      }
    }
    return d + 'Z';
  }
  function g(tf, body) { return '<g transform="' + tf + '">' + body + '</g>'; }
  function shadow(cx, cy, rx, ry, op) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + INK + '" opacity="' + (op || 0.28) + '"/>';
  }
  function gloss(cx, cy, rx, ry, rot, op) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')" fill="#fff" opacity="' + (op || 0.55) + '"/>';
  }
  function flake(cx, cy, r, sw, col, op) {
    var s = '', i, a, x, y, bx, by;
    for (i = 0; i < 3; i++) {
      a = i * Math.PI / 3 + Math.PI / 2;
      x = Math.cos(a) * r; y = Math.sin(a) * r;
      s += 'M' + f(cx - x) + ' ' + f(cy - y) + 'L' + f(cx + x) + ' ' + f(cy + y);
    }
    for (i = 0; i < 6; i++) {
      a = i * Math.PI / 3 + Math.PI / 2;
      bx = cx + Math.cos(a) * r * 0.55; by = cy + Math.sin(a) * r * 0.55;
      var b1 = a + 0.75, b2 = a - 0.75, l = r * 0.32;
      s += 'M' + f(bx + Math.cos(b1) * l) + ' ' + f(by + Math.sin(b1) * l) + 'L' + f(bx) + ' ' + f(by) + 'L' + f(bx + Math.cos(b2) * l) + ' ' + f(by + Math.sin(b2) * l);
    }
    return '<path d="' + s + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"' + (op ? ' opacity="' + op + '"' : '') + '/>';
  }
  // Florecita blanca de 5 pétalos (azahar / flor de lima)
  function blossom(cx, cy, r) {
    var s = '';
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      s += '<circle cx="' + f(cx + Math.cos(a) * r * 0.62) + '" cy="' + f(cy + Math.sin(a) * r * 0.62) + '" r="' + f(r * 0.5) + '"/>';
    }
    return '<g fill="#fffdf6" stroke="' + INK + '" stroke-width="' + f(Math.max(0.8, r * 0.22)) + '">' + s + '</g>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + f(r * 0.34) + '" fill="#ffd23c"/>';
  }
  function leaf(x, y, len, rot, fill, sw) {
    var w = len * 0.42;
    return g('translate(' + x + ' ' + y + ') rotate(' + rot + ')',
      '<path d="M0 0C' + f(len * 0.25) + ' ' + f(-w) + ' ' + f(len * 0.75) + ' ' + f(-w) + ' ' + len + ' 0C' + f(len * 0.75) + ' ' + f(w) + ' ' + f(len * 0.25) + ' ' + f(w) + ' 0 0Z" fill="' + fill + '" stroke="' + INK + '" stroke-width="' + (sw || 1.6) + '" stroke-linejoin="round"/>' +
      '<path d="M' + f(len * 0.12) + ' 0L' + f(len * 0.8) + ' 0" stroke="' + INK + '" stroke-opacity=".35" stroke-width="1"/>');
  }

  // ---------- paletas de las seis víctimas ----------
  var COLORS = ['L', 'F', 'B', 'U', 'N', 'D'];
  var IDS = { L: 'lima', F: 'fresa', B: 'banana', U: 'uva', N: 'naranja', D: 'durazna' };
  // Solo fichas/tablero: los retratos (art-characters.js) llevan su propia paleta canónica. Aquí Uva, Durazna y Lima
  // usan tonos más vivos y menos pelo oscuro para que las seis fichas se distingan de un vistazo (DISENO §6).
  var PAL = {
    L: { skin: '#b4f03c', light: '#f6ffc8', dark: '#5fb514', hair: '#3cb53a', hairL: '#8ae45c', hairD: '#1e7f24',
      iris: '#e0a020', brow: '#2c7020', lips: '#3c8a2a', blush: '#ff9a7a', main: '#8fd63a' },
    F: { skin: '#ff3650', light: '#ff9aa0', dark: '#bc0c2c', hair: '#3daa45', hairL: '#7fd65a', hairD: '#1d7a2c',
      iris: '#2fa84f', brow: '#2f8a3a', lips: '#a3123a', blush: '#ffb3c0', main: '#ff3b55' },
    B: { skin: '#ffe96e', light: '#fffbd8', dark: '#e8b818', hair: '#ffd81a', hairL: '#fff3a8', hairD: '#d29c08',
      iris: '#7d8b2a', brow: '#7d7a2a', lips: '#ff4f93', blush: '#ff9ab5', main: '#ffe266' },
    U: { skin: '#a852fa', light: '#d8a4ff', dark: '#5c12c0', hair: '#86b98c', hairL: '#cdeccb', hairD: '#4c7f62',
      iris: '#7a4a26', brow: '#46306a', lips: '#ff9ce0', blush: '#ff8ae6', main: '#9a4ed6' },
    N: { skin: '#ffa444', light: '#ffd496', dark: '#e85e0e', hair: '#ff8a1a', hairL: '#ffc25a', hairD: '#c45306',
      iris: '#8f9a36', brow: '#b0601e', lips: '#ff6f5a', blush: '#ff7a6a', main: '#ff8c1f' },
    D: { skin: '#ffb08a', light: '#fff0cc', dark: '#f2607a', hair: '#24573a', hairL: '#3f8a5c', hairD: '#123522',
      iris: '#2e9a52', brow: '#1f4d2e', lips: '#c0507f', blush: '#ff3a64', main: '#ffa07a' }
  };
  function normColor(c) {
    if (typeof c === 'number') return COLORS[c] || 'L';
    var s = String(c || 'L');
    if (PAL[s]) return s;
    for (var k in IDS) if (IDS[k] === s.toLowerCase()) return k;
    return PAL[s.toUpperCase()] ? s.toUpperCase() : 'L';
  }

  // ---------- cara (ojos grandes + boca) ----------
  // o: { x: centro, ey: altura ojos, ex: separación, my: altura boca, s: escala, lash: true }
  function face(p, mood, o) {
    var x = o.x || 50, ey = o.ey, ex = o.ex || 11, my = o.my, s = o.s || 1, out = '';
    var mood2 = mood || 'normal';
    function eyeAt(cx, side) {
      var e = '', rx = 7 * s, ry = 8.4 * s;
      if (mood2 === 'blink') {
        e += '<path d="M' + f(cx - rx) + ' ' + f(ey) + 'Q' + cx + ' ' + f(ey + 6 * s) + ' ' + f(cx + rx) + ' ' + f(ey) + '" fill="none" stroke="' + INK + '" stroke-width="' + f(2.6 * s) + '" stroke-linecap="round"/>';
        if (o.lash !== false) e += '<path d="M' + f(cx + side * rx) + ' ' + f(ey) + 'l' + f(side * 2.6 * s) + ' ' + f(-1.6 * s) + '" stroke="' + INK + '" stroke-width="' + f(2 * s) + '" stroke-linecap="round"/>';
        return e;
      }
      if (mood2 === 'happy') {
        return '<path d="M' + f(cx - rx) + ' ' + f(ey + 2 * s) + 'Q' + cx + ' ' + f(ey - 8 * s) + ' ' + f(cx + rx) + ' ' + f(ey + 2 * s) + '" fill="none" stroke="' + INK + '" stroke-width="' + f(3 * s) + '" stroke-linecap="round"/>';
      }
      var scared = mood2 === 'scared';
      if (scared) { rx *= 1.08; ry *= 1.14; }
      var ir = (scared ? 3.6 : 5.3) * s, pr = (scared ? 2 : 2.7) * s, dy = scared ? 0 : 1.2 * s;
      e += '<ellipse cx="' + cx + '" cy="' + ey + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="#fff" stroke="' + INK + '" stroke-width="' + f(2 * s) + '"/>';
      e += '<circle cx="' + f(cx + 0.4 * s * side * -1) + '" cy="' + f(ey + dy) + '" r="' + f(ir) + '" fill="' + p.iris + '"/>';
      e += '<circle cx="' + f(cx + 0.4 * s * side * -1) + '" cy="' + f(ey + dy) + '" r="' + f(pr) + '" fill="' + INK + '"/>';
      e += '<circle cx="' + f(cx - 1.8 * s) + '" cy="' + f(ey - 2 * s) + '" r="' + f(1.9 * s) + '" fill="#fff"/>';
      e += '<circle cx="' + f(cx + 1.9 * s) + '" cy="' + f(ey + 3 * s) + '" r="' + f(0.9 * s) + '" fill="#fff"/>';
      if (o.lash !== false) {
        // párpado superior grueso + pestaña
        e += '<path d="M' + f(cx - rx * 0.98) + ' ' + f(ey - 1 * s) + 'Q' + f(cx) + ' ' + f(ey - ry * 1.42) + ' ' + f(cx + rx * 0.98) + ' ' + f(ey - 1 * s) + '" fill="none" stroke="' + INK + '" stroke-width="' + f(2.6 * s) + '" stroke-linecap="round"/>';
        e += '<path d="M' + f(cx + side * rx * 0.85) + ' ' + f(ey - ry * 0.55) + 'l' + f(side * 3 * s) + ' ' + f(-2.2 * s) + '" stroke="' + INK + '" stroke-width="' + f(2 * s) + '" stroke-linecap="round"/>';
      }
      return e;
    }
    // cejas
    var by = ey - 11.5 * s, bw = 5.5 * s;
    [-1, 1].forEach(function (side) {
      var cx = x + side * ex;
      var d;
      if (mood2 === 'scared') d = 'M' + f(cx - side * bw) + ' ' + f(by + 1 * s) + 'Q' + cx + ' ' + f(by - 4 * s) + ' ' + f(cx + side * bw) + ' ' + f(by - 4.5 * s);
      else if (mood2 === 'happy') d = 'M' + f(cx - bw) + ' ' + f(by - 1 * s) + 'Q' + cx + ' ' + f(by - 4.5 * s) + ' ' + f(cx + bw) + ' ' + f(by - 1 * s);
      else d = 'M' + f(cx - bw) + ' ' + f(by) + 'Q' + cx + ' ' + f(by - 3.5 * s) + ' ' + f(cx + bw) + ' ' + f(by + 0.5 * s);
      out += '<path d="' + d + '" fill="none" stroke="' + p.brow + '" stroke-width="' + f(2.3 * s) + '" stroke-linecap="round"/>';
    });
    out += eyeAt(x - ex, -1) + eyeAt(x + ex, 1);
    // rubor
    var bop = mood2 === 'happy' ? 0.7 : (o.blushOp || 0.45);
    out += '<ellipse cx="' + f(x - ex - 3 * s) + '" cy="' + f(ey + 10 * s) + '" rx="' + f(5 * s * (o.blushR || 1)) + '" ry="' + f(3 * s * (o.blushR || 1)) + '" fill="' + p.blush + '" opacity="' + bop + '"/>';
    out += '<ellipse cx="' + f(x + ex + 3 * s) + '" cy="' + f(ey + 10 * s) + '" rx="' + f(5 * s * (o.blushR || 1)) + '" ry="' + f(3 * s * (o.blushR || 1)) + '" fill="' + p.blush + '" opacity="' + bop + '"/>';
    // boca
    if (mood2 === 'scared') {
      out += '<ellipse cx="' + x + '" cy="' + f(my + 1 * s) + '" rx="' + f(3.2 * s) + '" ry="' + f(4 * s) + '" fill="#6a1838" stroke="' + INK + '" stroke-width="' + f(1.8 * s) + '"/>';
      out += '<path d="M' + f(x + 24 * s) + ' ' + f(ey - 18 * s) + 'q' + f(5 * s) + ' ' + f(7 * s) + ' ' + f(2.6 * s) + ' ' + f(10 * s) + 'q' + f(-2.6 * s) + ' ' + f(3 * s) + ' ' + f(-5 * s) + ' 0q' + f(-2 * s) + ' ' + f(-3 * s) + ' ' + f(2.4 * s) + ' ' + f(-10 * s) + 'Z" fill="#bfe9ff" stroke="' + INK + '" stroke-width="' + f(1.5 * s) + '"/>';
    } else if (mood2 === 'happy') {
      out += '<path d="M' + f(x - 8 * s) + ' ' + f(my - 2 * s) + 'Q' + x + ' ' + f(my + 13 * s) + ' ' + f(x + 8 * s) + ' ' + f(my - 2 * s) + 'Z" fill="#7a1d36" stroke="' + INK + '" stroke-width="' + f(2 * s) + '" stroke-linejoin="round"/>';
      out += '<ellipse cx="' + x + '" cy="' + f(my + 4.6 * s) + '" rx="' + f(3.6 * s) + '" ry="' + f(1.9 * s) + '" fill="#ff7c9c"/>';
    } else {
      out += '<path d="M' + f(x - 5.5 * s) + ' ' + f(my) + 'Q' + x + ' ' + f(my + 7 * s) + ' ' + f(x + 5.5 * s) + ' ' + f(my) + 'Q' + x + ' ' + f(my + 2.2 * s) + ' ' + f(x - 5.5 * s) + ' ' + f(my) + 'Z" fill="' + p.lips + '" stroke="' + INK + '" stroke-width="' + f(1.7 * s) + '" stroke-linejoin="round"/>';
    }
    return out;
  }

  function skinFill(ctx, p) { return rg(ctx, [[0, p.light], [0.55, p.skin], [1, p.dark]], 0.38, 0.3, 0.75); }
  function hairFill(ctx, p) { return rg(ctx, [[0, p.hairL], [0.6, p.hair], [1, p.hairD]], 0.4, 0.3, 0.8); }
  var SW = 3; // grosor de contorno en caja de 100

  // ---------- cabezas de las víctimas (caja 100x100) ----------
  var HEADS = {};

  // Rodaja de lima (gajos) como broche del pelo
  function limeSlice(cx, cy, r) {
    var sp = '';
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4 + 0.2;
      sp += 'M' + cx + ' ' + cy + 'L' + f(cx + Math.cos(a) * r * 0.7) + ' ' + f(cy + Math.sin(a) * r * 0.7);
    }
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#2f9a2a" stroke="' + INK + '" stroke-width="1.9"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + f(r * 0.8) + '" fill="#f4ffd8"/><circle cx="' + cx + '" cy="' + cy + '" r="' + f(r * 0.68) + '" fill="#c4f04e"/>' +
      '<path d="' + sp + '" stroke="#f4ffd8" stroke-width="1.3"/><circle cx="' + cx + '" cy="' + cy + '" r="' + f(r * 0.13) + '" fill="#f4ffd8"/>';
  }
  // Ficha de Lima: cara verde lima grande; el pelo es solo un fleco de hojas onduladas con florecitas blancas.
  HEADS.L = function (ctx, p, mood) {
    var hf = hairFill(ctx, p), out = '';
    // mechones ondulados que asoman a los lados (pelo largo)
    out += '<path d="M21 48C11 58 19 68 11 78C8 84 12 90 18 89C17 82 24 76 23 67C22 59 27 54 28 50ZM79 48C89 58 81 68 89 78C92 84 88 90 82 89C83 82 76 76 77 67C78 59 73 54 72 50Z" fill="' + hf + '" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/>';
    out += '<circle cx="50" cy="57" r="34" fill="' + skinFill(ctx, p) + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    // poros de cáscara
    out += '<g fill="#eaff8a" opacity=".85"><circle cx="30" cy="76" r="1.1"/><circle cx="70" cy="77" r="1.1"/><circle cx="24" cy="63" r="1"/><circle cx="76" cy="63" r="1"/><circle cx="42" cy="84" r="1"/><circle cx="58" cy="85" r="1.1"/></g>';
    out += gloss(33, 50, 6, 3.4, -30, 0.5);
    // fleco de hojas: puntas de hoja alrededor de la coronilla y borde ondulado sobre la frente
    var d = '', R1 = 32, R2 = 42, a0 = 194, a1 = 346, n = 8, st = (a1 - a0) / n, rad = Math.PI / 180;
    function pt(a, r) { return f(50 + Math.cos(a * rad) * r) + ' ' + f(57 + Math.sin(a * rad) * r); }
    d = 'M' + pt(a0, R1);
    for (var i = 0; i < n; i++) {
      var a = a0 + i * st;
      d += 'Q' + pt(a + st * 0.15, R2 - 3) + ' ' + pt(a + st * 0.62, R2) + 'Q' + pt(a + st * 0.8, R1 + 4) + ' ' + pt(a + st, R1);
    }
    d += 'Q79 37 72 41Q66 45 61 39Q55 33 50 39Q45 33 39 39Q34 45 28 41Q21 37 ' + pt(a0, R1) + 'Z';
    out += '<path d="' + d + '" fill="' + hf + '" stroke="' + INK + '" stroke-width="' + SW + '" stroke-linejoin="round"/>';
    // nervaduras / brillos de las hojas
    out += '<path d="M30 32q6-6 13-7M57 25q8 0 13 5M22 40q1-4 4-7" fill="none" stroke="' + p.hairL + '" stroke-width="2.2" stroke-linecap="round"/>';
    // florecitas blancas y rodaja de lima
    out += blossom(25, 27, 5.2) + blossom(47, 18, 5.4) + blossom(14, 47, 4.3) + blossom(87, 47, 4.3);
    out += limeSlice(74, 23, 10);
    out += face(p, mood, { ey: 60, ex: 11.5, my: 75, s: 1.04 });
    return out;
  };

  HEADS.F = function (ctx, p, mood) {
    var out = '', hf = hairFill(ctx, p);
    // melena verde detrás (larga)
    out += '<path d="M26 35C14 43 11 62 15 80C20 75 25 68 29 62ZM74 35C86 43 89 62 85 80C80 75 75 68 71 62Z" fill="' + hf + '" stroke="' + INK + '" stroke-width="' + SW + '" stroke-linejoin="round"/>';
    // cara de fresa
    out += '<path d="M50 93C30 90 15 70 16 48C17 31 32 24 50 26C68 24 83 31 84 48C85 70 70 90 50 93Z" fill="' + skinFill(ctx, p) + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    // semillas
    var seeds = [[28, 40], [72, 40], [22, 55], [78, 55], [26, 70], [74, 70], [36, 82], [64, 82], [50, 87], [42, 41], [58, 41], [34, 75], [66, 75], [50, 80]];
    out += '<g fill="#ffe680" stroke="#b8862a" stroke-width=".5">' + seeds.map(function (q) {
      return '<ellipse cx="' + q[0] + '" cy="' + q[1] + '" rx="1.2" ry="1.9"/>';
    }).join('') + '</g>';
    out += gloss(33, 44, 7, 4, -35, 0.5);
    // fleco disparejo
    out += '<path d="M33 30L37 44L42 35L46 45L50 35L54 45L58 35L63 43L67 30Z" fill="' + hf + '" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/>';
    // corona de cáliz puntiaguda
    var ang = [-178, -150, -122, -96, -84, -58, -30, -2], len = [22, 25, 22, 19, 19, 22, 25, 22], cal = '';
    ang.forEach(function (a, i) {
      var L = len[i];
      cal += g('translate(50 29) rotate(' + a + ')', '<path d="M0 -5Q' + f(L * 0.55) + ' -4 ' + L + ' 0Q' + f(L * 0.55) + ' 4 0 5Z"/>');
    });
    out += '<g fill="#38b24a" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' + cal + '</g>';
    out += '<circle cx="50" cy="28" r="5" fill="#2c9a3c" stroke="' + INK + '" stroke-width="2"/>';
    out += '<path d="M50 24q1-7 5-10" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/><path d="M50 24q1-7 5-10" fill="none" stroke="#5a8f2a" stroke-width="2.6" stroke-linecap="round"/>';
    out += face(p, mood, { ey: 55, ex: 11.5, my: 70 });
    return out;
  };

  function peelStrip(x, y, rot, sc, mirror, p) {
    var tf = 'translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(rot) + ') scale(' + (mirror ? -sc : sc) + ' ' + sc + ')';
    return g(tf,
      '<path d="M-8 2C-9 -12 -7 -25 3 -32C7 -35 12 -32 10 -27C4 -22 4 -12 8 2Z" fill="' + p.hair + '" stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<path d="M-2 -1C-3 -12 -1 -22 6 -28C1 -20 1 -12 3 -1Z" fill="' + p.hairL + '"/>' +
      '<path d="M5 -33C8 -35 12 -32 10 -27C9 -26 7 -27 6 -29Z" fill="#7a4a1e"/>');
  }
  HEADS.B = function (ctx, p, mood) {
    var out = '';
    var angs = [-128, -96, -64, -32, 0, 32, 64, 96, 128];
    angs.forEach(function (a) {
      var r = a * Math.PI / 180;
      out += peelStrip(50 + Math.sin(r) * 14, 52 - Math.cos(r) * 14, a, 1.06, a < 0 || (a === 0), p);
    });
    out += '<circle cx="50" cy="58" r="27.5" fill="' + skinFill(ctx, p) + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    out += gloss(38, 47, 7, 4, -30, 0.6);
    // pecas
    out += '<g fill="#b07a3a" opacity=".75"><circle cx="34" cy="68" r="1.1"/><circle cx="37.5" cy="71" r="1"/><circle cx="31" cy="71.5" r=".9"/><circle cx="66" cy="68" r="1.1"/><circle cx="62.5" cy="71" r="1"/><circle cx="69" cy="71.5" r=".9"/></g>';
    // tiras de cáscara al frente (fleco)
    out += peelStrip(46, 40, -62, 0.62, true, p) + peelStrip(54, 40, 62, 0.62, false, p);
    out += face(p, mood, { ey: 58, ex: 11, my: 72 });
    return out;
  };

  // Ficha de Uva: cara morado uva grande, fleco de lado verde claro, hoja de parra y un racimo grande.
  HEADS.U = function (ctx, p, mood) {
    var out = '', hf = hairFill(ctx, p);
    // zarcillos rizados a los lados (detrás)
    out += '<path d="M18 58c-9 4-10 14-4 18c4 3 9-1 6-5c-2-2-5 0-4 2M82 60c9 4 10 14 4 18c-4 3-9-1-6-5c2-2 5 0 4 2" fill="none" stroke="' + INK + '" stroke-width="4.6" stroke-linecap="round"/>' +
      '<path d="M18 58c-9 4-10 14-4 18c4 3 9-1 6-5c-2-2-5 0-4 2M82 60c9 4 10 14 4 18c-4 3-9-1-6-5c2-2 5 0 4 2" fill="none" stroke="#9fe07a" stroke-width="2.2" stroke-linecap="round"/>';
    out += '<circle cx="50" cy="57" r="34" fill="' + skinFill(ctx, p) + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    // moteado morado
    out += '<g fill="#6a22b8" opacity=".3"><circle cx="27" cy="74" r="2.6"/><circle cx="73" cy="76" r="2.2"/><circle cx="62" cy="86" r="1.8"/><circle cx="38" cy="86" r="2"/><circle cx="22" cy="62" r="1.6"/></g>';
    out += gloss(31, 52, 6, 3.4, -30, 0.55);
    // fleco de lado (verde claro con brillo)
    out += '<path d="M18 53C15 36 28 25 46 24C60 23 72 28 79 37C68 33 58 34 48 38C38 42 28 46 18 53Z" fill="' + hf + '" stroke="' + INK + '" stroke-width="' + SW + '" stroke-linejoin="round"/>';
    out += '<path d="M26 35q9-7 21-7" fill="none" stroke="' + p.hairL + '" stroke-width="2.4" stroke-linecap="round"/>';
    // hoja de parra grande
    out += g('translate(24 22) rotate(-24) scale(1.12)',
      '<path d="M0 10C-6 8 -14 6 -16 -1C-11 -1 -9 -3 -10 -7C-6 -6 -4 -9 -5 -14C-1 -11 2 -12 3 -16C6 -12 9 -11 12 -13C12 -8 14 -6 18 -5C16 0 13 3 10 4C12 7 8 9 0 10Z" fill="#6cc84a" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M0 9L-9 -2M0 9L-2 -9M0 9L5 -10M0 9L11 -6" stroke="#2f6e22" stroke-width="1.1" fill="none" opacity=".7"/>');
    // racimo grande (arriba a la derecha)
    var gf = rg(ctx, [[0, '#ecc8ff'], [0.4, '#a040f4'], [1, '#5212a8']], 0.38, 0.32, 0.7);
    var gp = [[78, 33], [71, 23], [84, 23], [64, 13], [77, 12], [90, 14]], cl = '';
    gp.forEach(function (q) { cl += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="6.6"/>'; });
    out += '<path d="M78 7Q80 1 86 0" fill="none" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/><path d="M78 7Q80 1 86 0" fill="none" stroke="#7a5a2a" stroke-width="2.4" stroke-linecap="round"/>';
    out += '<g fill="' + gf + '" stroke="' + INK + '" stroke-width="2">' + cl + '</g>';
    out += '<g fill="#fff" opacity=".85">' + gp.map(function (q) { return '<circle cx="' + (q[0] - 2.2) + '" cy="' + (q[1] - 2.2) + '" r="1.6"/>'; }).join('') + '</g>';
    out += face(p, mood, { ey: 60, ex: 11.5, my: 75, s: 1.04 });
    return out;
  };

  function curl(cx, cy, r, col) {
    return '<path d="M' + f(cx - r * 0.2) + ' ' + f(cy) + 'a' + f(r * 0.3) + ' ' + f(r * 0.3) + ' 0 1 1 ' + f(r * 0.4) + ' ' + f(r * 0.3) + 'a' + f(r * 0.6) + ' ' + f(r * 0.6) + ' 0 1 1 ' + f(-r * 0.9) + ' ' + f(-r * 0.7) + '" fill="none" stroke="' + col + '" stroke-width="1.8" stroke-linecap="round"/>';
  }
  HEADS.N = function (ctx, p, mood) {
    var out = '', hf = hairFill(ctx, p);
    out += '<path d="' + scallop(50, 53, 36, 36, 13, -Math.PI / 2) + '" fill="' + hf + '" stroke="' + INK + '" stroke-width="' + SW + '" stroke-linejoin="round"/>';
    for (var i = 0; i < 13; i++) {
      var a = -Math.PI / 2 + (i + 0.5) * Math.PI * 2 / 13;
      out += curl(50 + Math.cos(a) * 36, 53 + Math.sin(a) * 36, 8, p.hairD);
    }
    out += '<circle cx="50" cy="60" r="26" fill="' + skinFill(ctx, p) + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    out += gloss(38, 50, 7, 4, -30, 0.5);
    // fleco de rizos
    var fr = [[30, 41, 7.5], [40, 36, 8], [51, 34, 8.2], [62, 36, 8], [71, 42, 7.2]], s = '';
    fr.forEach(function (q) { s += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + q[2] + '"/>'; });
    out += '<g fill="' + hf + '" stroke="' + INK + '" stroke-width="2.4">' + s + '</g>';
    fr.forEach(function (q) { out += curl(q[0], q[1], q[2], p.hairD); });
    // hojitas y azahar
    out += leaf(50, 12, 14, -160, '#4caf50', 1.8) + leaf(50, 12, 14, -20, '#4caf50', 1.8);
    out += blossom(50, 13, 7);
    out += face(p, mood, { ey: 61, ex: 10.5, my: 74, s: 0.96 });
    return out;
  };

  // Ficha de Durazna: silueta de durazno (corazón) con la línea del durazno, rubor fuerte, tallito con hojas
  // y solo un fleco fino verde oscuro con raya al medio.
  var PEACH = 'M50 28C57 15 79 13 88 31C97 49 90 73 74 86C66 92 58 95 50 95C42 95 34 92 26 86C10 73 3 49 12 31C21 13 43 15 50 28Z';
  HEADS.D = function (ctx, p, mood) {
    var out = '', hf = hairFill(ctx, p);
    var pf = rg(ctx, [[0, '#ffefc4'], [0.38, '#ffc088'], [0.72, '#ff9474'], [1, '#f04e6e']], 0.36, 0.3, 0.8);
    out += '<path d="' + PEACH + '" fill="' + pf + '"/>';
    // lado rojizo del durazno
    var bl = rg(ctx, [[0, '#ff2a5c', 0.6], [1, '#ff2a5c', 0]], 0.5, 0.5, 0.5);
    out += '<g clip-path="' + clip(ctx, '<path d="' + PEACH + '"/>') + '"><ellipse cx="80" cy="70" rx="26" ry="30" fill="' + bl + '"/></g>';
    out += '<path d="' + PEACH + '" fill="none" stroke="' + INK + '" stroke-width="' + SW + '" stroke-linejoin="round"/>';
    // línea del durazno
    out += '<path d="M50 29C44 36 44 43 48 49" fill="none" stroke="#e8505a" stroke-width="2.6" stroke-linecap="round"/><path d="M45 32C41 37 41 42 43 46" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>';
    out += gloss(26, 50, 6, 3.4, -30, 0.55);
    // fleco fino de cortinas con raya al medio
    out += '<path d="M50 30C40 27 26 31 20 42C18 46 17 50 17 56C21 48 26 43 33 40C39 37 45 35 50 33ZM50 30C60 27 74 31 80 42C82 46 83 50 83 56C79 48 74 43 67 40C61 37 55 35 50 33Z" fill="' + hf + '" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round"/>';
    // tallito con hojas
    out += '<path d="M50 29Q48 19 53 9" fill="none" stroke="' + INK + '" stroke-width="6.4" stroke-linecap="round"/><path d="M50 29Q48 19 53 9" fill="none" stroke="#8a5530" stroke-width="3.2" stroke-linecap="round"/>';
    out += leaf(52, 13, 24, -14, '#5cc84a', 2) + leaf(50, 15, 15, -165, '#45b040', 1.8);
    // nariz sonrojada
    out += '<ellipse cx="50" cy="68" rx="3.2" ry="2.2" fill="#ff3a64" opacity=".6"/>';
    out += face(p, mood, { ey: 60, ex: 11.5, my: 76, blushR: 1.4, blushOp: 0.75 });
    return out;
  };

  function headStr(ctx, col, mood) { return HEADS[col](ctx, PAL[col], mood); }

  // ---------- cabezas simples para el resto del reparto (amigos congelados y congeladores) ----------
  function maleFace(o) {
    // o: {ey, ex, my, iris, brow, mood: 'smirk'|'normal'|'scared'|'sly', lashes}
    var ey = o.ey, ex = o.ex || 11, my = o.my, out = '', mood = o.mood || 'normal';
    [-1, 1].forEach(function (side) {
      var cx = 50 + side * ex;
      var ry = mood === 'scared' ? 8 : 6.6;
      out += '<ellipse cx="' + cx + '" cy="' + ey + '" rx="6" ry="' + ry + '" fill="#fff" stroke="' + INK + '" stroke-width="2"/>';
      out += '<circle cx="' + (cx - side * 0.6) + '" cy="' + (ey + 1) + '" r="' + (mood === 'scared' ? 3 : 4.3) + '" fill="' + (o.iris || '#5a3418') + '"/>';
      out += '<circle cx="' + (cx - side * 0.6) + '" cy="' + (ey + 1) + '" r="2.1" fill="' + INK + '"/><circle cx="' + (cx - 1.5) + '" cy="' + (ey - 1.6) + '" r="1.5" fill="#fff"/>';
      if (mood === 'sly') out += '<path d="M' + (cx - 6.6) + ' ' + (ey - 1) + 'Q' + cx + ' ' + (ey - 4) + ' ' + (cx + 6.6) + ' ' + (ey - 1) + 'L' + (cx + 6.6) + ' ' + (ey - 9) + 'L' + (cx - 6.6) + ' ' + (ey - 9) + 'Z" fill="' + (o.lid || '#d0213f') + '" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>';
      if (o.lashes) out += '<path d="M' + (cx + side * 5.5) + ' ' + (ey - 2) + 'l' + side * 3.4 + ' -2.6" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>';
      // cejas
      var bw = 6.5, by = ey - 9.5, d;
      if (o.thickBrows) {
        var lift = (mood === 'smirk' && side === 1) ? -3 : 0;
        d = 'M' + (cx - bw - 1) + ' ' + (by + (side === -1 ? 2 : 0) + lift) + 'Q' + cx + ' ' + (by - 5 + lift) + ' ' + (cx + bw + 1) + ' ' + (by + (side === 1 ? 2 : 0) + lift);
        out += '<path d="' + d + '" fill="none" stroke="' + (o.brow || INK) + '" stroke-width="4.6" stroke-linecap="round"/>';
      } else {
        d = 'M' + (cx - bw) + ' ' + (by + 1) + 'Q' + cx + ' ' + (by - 3) + ' ' + (cx + bw) + ' ' + (by + 1);
        if (mood === 'scared') d = 'M' + (cx - side * bw) + ' ' + (by + 1) + 'L' + (cx + side * bw) + ' ' + (by - 3);
        out += '<path d="' + d + '" fill="none" stroke="' + (o.brow || INK) + '" stroke-width="' + (o.browW || 2.6) + '" stroke-linecap="round"/>';
      }
    });
    if (mood === 'scared') out += '<ellipse cx="50" cy="' + (my + 1) + '" rx="3.5" ry="4.4" fill="#5a1630" stroke="' + INK + '" stroke-width="1.8"/>';
    else if (mood === 'smirk') out += '<path d="M40 ' + my + 'Q52 ' + (my + 6) + ' 62 ' + (my - 4) + 'Q53 ' + (my + 11) + ' 40 ' + my + 'Z" fill="#fff" stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"/>';
    else if (mood === 'sly') out += '<path d="M42 ' + my + 'Q52 ' + (my + 5) + ' 60 ' + (my - 3) + 'Q53 ' + (my + 9) + ' 42 ' + my + 'Z" fill="' + (o.lips || '#7a1030') + '" stroke="' + INK + '" stroke-width="1.8" stroke-linejoin="round"/><circle cx="47" cy="' + (my + 2.5) + '" r="1" fill="#fff" opacity=".7"/>';
    else out += '<path d="M43 ' + my + 'Q50 ' + (my + 5) + ' 57 ' + my + '" fill="none" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/>';
    return out;
  }

  function cocardoHead(ctx, mood) {
    var out = '';
    var cf = rg(ctx, [[0, '#a8724a'], [0.6, '#7a4a2a'], [1, '#4a2a16']], 0.4, 0.3, 0.8);
    out += '<path d="M50 6C78 6 94 24 91 48C89 72 73 92 50 92C27 92 11 72 9 48C6 24 22 6 50 6Z" fill="' + cf + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    // fibras
    var fib = '';
    for (var i = 0; i < 22; i++) {
      var a = i * Math.PI * 2 / 22, x = 50 + Math.cos(a) * 40, y = 49 + Math.sin(a) * 42;
      fib += 'M' + f(x) + ' ' + f(y) + 'l' + f(Math.cos(a + 0.6) * 5) + ' ' + f(Math.sin(a + 0.6) * 5);
    }
    out += '<path d="' + fib + 'M30 20l4 3M66 18l-3 4M22 34l4 2M78 34l-4 2" stroke="#c49066" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>';
    out += '<g fill="#2b160c"><ellipse cx="42" cy="17" rx="3.4" ry="2.6"/><ellipse cx="58" cy="17" rx="3.4" ry="2.6"/><ellipse cx="50" cy="24" rx="3" ry="2.4"/></g>';
    // cara lisa
    var ff = rg(ctx, [[0, '#d39a6a'], [0.7, '#a86c42'], [1, '#8a5432']], 0.45, 0.35, 0.7);
    out += '<path d="M50 30C68 30 80 40 80 58C80 76 67 88 50 88C33 88 20 76 20 58C20 40 32 30 50 30Z" fill="' + ff + '"/>';
    // barba de fibra
    out += '<path d="M24 70C30 84 40 88 50 88C60 88 70 84 76 70" fill="none" stroke="#5a3418" stroke-width="2" stroke-dasharray="1.5 2.5" opacity=".8"/>';
    out += maleFace({ ey: 52, ex: 13, my: 72, iris: '#4a2a14', brow: '#1a0d08', thickBrows: true, mood: mood === 'scared' ? 'scared' : 'smirk' });
    out += '<path d="M45 60Q50 67 55 60" fill="#8a5432" stroke="' + INK + '" stroke-width="2" stroke-linecap="round"/>';
    out += gloss(30, 30, 8, 4, -40, 0.25);
    return out;
  }

  function cerezaHead(ctx, mood) {
    var out = '';
    // pelo largo en mechones verde bosque y vino
    out += '<path d="M14 60C10 30 30 14 50 14C70 14 90 30 86 60C85 74 90 84 85 93L15 93C10 84 15 74 14 60Z" fill="#7a1638" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    out += '<path d="M20 40C14 58 18 78 24 92L32 92C26 76 24 58 28 44ZM80 40C86 58 82 78 76 92L68 92C74 76 76 58 72 44Z" fill="#245a32"/>';
    var sf = rg(ctx, [[0, '#ff8a9a'], [0.5, '#e01e43'], [1, '#8a0c26']], 0.38, 0.3, 0.75);
    out += '<circle cx="50" cy="58" r="27" fill="' + sf + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    out += gloss(37, 45, 9, 4.6, -30, 0.7);
    // raya al medio
    out += '<path d="M50 25C35 23 22 34 21 52C27 42 36 36 50 34Z" fill="#245a32" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/>';
    out += '<path d="M50 25C65 23 78 34 79 52C73 42 64 36 50 34Z" fill="#7a1638" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/>';
    // tallo único con hoja
    out += '<path d="M50 26Q48 12 58 4" fill="none" stroke="' + INK + '" stroke-width="5.4" stroke-linecap="round"/><path d="M50 26Q48 12 58 4" fill="none" stroke="#6a9a2a" stroke-width="2.6" stroke-linecap="round"/>';
    out += leaf(55, 8, 17, 10, '#3fae4a', 1.8);
    out += maleFace({ ey: 58, ex: 11.5, my: 72, iris: '#e09a20', brow: '#a0262a', browW: 2.2, lashes: true, mood: mood === 'scared' ? 'scared' : 'sly', lid: '#d42a48', lips: '#7a0c2e' });
    out += '<ellipse cx="34" cy="68" rx="4.5" ry="2.6" fill="#ff6f8f" opacity=".5"/><ellipse cx="66" cy="68" rx="4.5" ry="2.6" fill="#ff6f8f" opacity=".5"/>';
    return out;
  }

  function pinaHead(ctx, mood) {
    var out = '', i;
    var crown = '';
    var ca = [-150, -128, -108, -90, -72, -52, -30];
    for (i = 0; i < ca.length; i++) crown += g('translate(50 26) rotate(' + ca[i] + ')', '<path d="M0 -4L' + (i === 3 ? 26 : 21) + ' 0L0 4Z"/>');
    out += '<g fill="#2f9a3a" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' + crown + '</g>';
    var pf = rg(ctx, [[0, '#ffe68a'], [0.6, '#f2b632'], [1, '#b87a14']], 0.4, 0.35, 0.75);
    out += '<ellipse cx="50" cy="60" rx="31" ry="32" fill="' + pf + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    out += '<path d="M30 40L62 88M44 32L76 78M24 58L46 90M38 88L72 36M24 74L54 32M56 90L80 54" stroke="#b07812" stroke-width="1.2" opacity=".45"/>';
    out += maleFace({ ey: 58, ex: 12, my: 76, iris: '#5a3418', brow: '#6a3a14', browW: 3.4, mood: mood === 'scared' ? 'scared' : 'normal' });
    return out;
  }

  function bananoHead(ctx, mood) {
    var out = '';
    var bf = rg(ctx, [[0, '#fff3a0'], [0.6, '#ffd83a'], [1, '#c99a12']], 0.4, 0.3, 0.8);
    out += '<path d="M50 10C64 10 74 24 74 46L74 74C74 86 64 94 50 94C36 94 26 86 26 74L26 46C26 24 36 10 50 10Z" fill="' + bf + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    out += '<path d="M48 12Q46 4 54 2" fill="none" stroke="' + INK + '" stroke-width="6" stroke-linecap="round"/><path d="M48 12Q46 4 54 2" fill="none" stroke="#7a4a1e" stroke-width="3" stroke-linecap="round"/>';
    out += '<g fill="#8a5a1e" opacity=".55"><circle cx="34" cy="30" r="1.6"/><circle cx="66" cy="34" r="1.3"/><circle cx="62" cy="22" r="1.1"/></g>';
    out += '<path d="M28 66C30 90 42 96 50 96C58 96 70 90 72 66C64 74 58 70 50 70C42 70 36 74 28 66Z" fill="#1d1414" stroke="' + INK + '" stroke-width="2"/>';
    out += maleFace({ ey: 50, ex: 10, my: 75, iris: '#4a2a14', brow: '#1a1010', thickBrows: true, mood: mood === 'scared' ? 'scared' : 'normal' });
    out += '<path d="M38 68Q50 62 62 68Q56 72 50 70Q44 72 38 68Z" fill="#1d1414"/>';
    return out;
  }

  function simpleHead(ctx, spec, mood) {
    var out = '';
    var sf = rg(ctx, [[0, spec.light], [0.6, spec.skin], [1, spec.dark]], 0.4, 0.3, 0.8);
    if (spec.back) out += spec.back;
    out += '<path d="' + (spec.shape || 'M50 14C72 14 86 32 86 54C86 76 70 92 50 92C30 92 14 76 14 54C14 32 28 14 50 14Z') + '" fill="' + sf + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    if (spec.tex) out += spec.tex;
    out += gloss(34, 36, 8, 4, -30, 0.4);
    out += maleFace({ ey: spec.ey || 56, ex: 11, my: spec.my || 74, iris: spec.iris || '#4a2a14', brow: spec.brow || INK, mood: mood === 'scared' ? 'scared' : (spec.mood || 'normal'), lashes: spec.lashes });
    if (spec.front) out += spec.front;
    return out;
  }
  var CAP = '<path d="M20 34C22 16 78 16 80 34Z" fill="#1c2a4a" stroke="' + INK + '" stroke-width="2.6"/><path d="M16 36Q50 28 84 36L84 40Q50 34 16 40Z" fill="#111a30" stroke="' + INK + '" stroke-width="2"/><circle cx="50" cy="26" r="4" fill="#ffc93c" stroke="' + INK + '" stroke-width="1.4"/>';
  var OTHERS = {
    limon: { skin: '#f4e04a', light: '#fff7a6', dark: '#b8a012', shape: 'M50 12C70 12 88 30 88 52C88 76 70 92 50 92C30 92 12 76 12 52C12 30 30 12 50 12Z',
      tex: '<path d="M26 40q6 4 4 10M70 36q-4 6 0 12M40 82q6-3 12 0" fill="none" stroke="#a89012" stroke-width="1.6" opacity=".7"/>',
      front: '<path d="M50 14q-2-6 2-9" stroke="#6a4a1e" stroke-width="3" stroke-linecap="round"/>' + leaf(52, 6, 14, -10, '#4caf50'), brow: '#6a5a1a' },
    policia_fresa: { skin: '#ff4256', light: '#ff9aa0', dark: '#b3122f', shape: 'M50 92C30 88 16 70 16 50C16 34 32 26 50 28C68 26 84 34 84 50C84 70 70 88 50 92Z',
      tex: '<g fill="#ffe680"><circle cx="30" cy="66" r="1.4"/><circle cx="70" cy="66" r="1.4"/><circle cx="40" cy="82" r="1.4"/><circle cx="60" cy="82" r="1.4"/><circle cx="24" cy="52" r="1.4"/><circle cx="76" cy="52" r="1.4"/></g>',
      front: CAP, ey: 54, my: 72, lashes: true },
    policia_sandia: { skin: '#3fa84a', light: '#8fe08a', dark: '#1d6a28',
      tex: '<path d="M30 20q-8 30 2 66M50 14v78M70 20q8 30-2 66" fill="none" stroke="#1d6a28" stroke-width="5" opacity=".5"/><ellipse cx="50" cy="64" rx="24" ry="22" fill="#ffd0b0" opacity=".9"/>',
      front: CAP, ey: 58, my: 76 },
    guardaespaldas: { skin: '#ffae3a', light: '#ffe08a', dark: '#e0402a',
      front: '<path d="M30 52H70L68 60Q60 64 54 58H46Q40 64 32 60Z" fill="#111" stroke="' + INK + '" stroke-width="2"/>' + leaf(50, 14, 14, -60, '#4caf50'), mood: 'normal' },
    brocoli: { skin: '#d8f0b0', light: '#f2ffe0', dark: '#8ab860',
      back: '<path d="' + scallop(50, 44, 38, 32, 11, Math.PI) + '" fill="#3f9a3a" stroke="' + INK + '" stroke-width="3"/>',
      shape: 'M50 34C66 34 74 46 74 60C74 78 64 90 50 90C36 90 26 78 26 60C26 46 34 34 50 34Z',
      front: '<path d="M30 72C34 92 66 92 70 72C62 80 38 80 30 72Z" fill="#3f9a3a" stroke="' + INK + '" stroke-width="2"/>', ey: 56, my: 72 },
    reportera: { skin: '#ffc23a', light: '#ffe8a0', dark: '#e0802a',
      back: '<path d="M14 60C12 28 30 12 50 12C70 12 88 28 86 60L88 90L12 90Z" fill="#3f8a3a" stroke="' + INK + '" stroke-width="3"/>',
      front: '<path d="M50 16C34 16 22 28 20 46C30 34 40 30 54 30C64 30 72 34 80 44C78 26 66 16 50 16Z" fill="#3f8a3a" stroke="' + INK + '" stroke-width="2.4"/>', lashes: true }
  };
  function charHead(ctx, who, mood) {
    var col = null;
    for (var k in IDS) if (IDS[k] === who) col = k;
    if (col) return headStr(ctx, col, mood === 'scared' ? 'scared' : (mood || 'normal'));
    if (who === 'cocardo') return cocardoHead(ctx, mood);
    if (who === 'cereza' || who === 'cherry') return cerezaHead(ctx, mood);
    if (who === 'pina') return pinaHead(ctx, mood);
    if (who === 'banano') return bananoHead(ctx, mood);
    return simpleHead(ctx, OTHERS[who] || OTHERS.limon, mood);
  }

  // ---------- fichas ----------
  function tile(color, opts) {
    opts = opts || {};
    var type = opts.type || 'n';
    if (type === 'copa') return copa(opts);
    if (type === 'token') return token(opts.skin || 'prueba');
    var col = normColor(color), p = PAL[col], mood = opts.face || 'normal';
    if (mood !== 'blink' && mood !== 'scared' && mood !== 'happy') mood = 'normal';
    var ctx = newCtx(), body = '';
    if (type === 'ph' || type === 'pv') body = paletaBody(ctx, col, p, mood, type === 'ph');
    else if (type === 'bomba') body = bombaBody(ctx, col, p, mood);
    else body = shadow(50, 93, 30, 4.5) + headStr(ctx, col, mood);
    return wrap(ctx, 100, 100, body);
  }

  // Colores de sabor saturados para las especiales: [claro, principal, oscuro]
  var POP = { L: ['#ecffa8', '#86e01e', '#3a8c0c'], F: ['#ffb4c0', '#ff2a4a', '#ae0828'], B: ['#fff8b8', '#ffd414', '#cc9200'],
    U: ['#ecd0ff', '#a33ef8', '#5410b4'], N: ['#ffdcaa', '#ff7a0e', '#c44600'], D: ['#ffe8cc', '#ff8a72', '#e2406a'] };
  // Halo blanco suave detrás de las especiales (las hace saltar a la vista sobre las fichas normales)
  function halo(ctx, cx, cy, r, col) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + rg(ctx, [[0, col || '#fff', 0.95], [0.55, col || '#fff', 0.55], [1, col || '#fff', 0]], 0.5, 0.5, 0.5) + '"/>';
  }

  // Paleta: helado de palito con franjas gruesas y flechas en la dirección que limpia (pv = columna, ph = fila).
  // Se dibuja vertical y se gira -90° para la horizontal (el palito queda a la derecha); la cara no se gira.
  var POPSICLE = 'M19 32Q19 4 50 4Q81 4 81 32V64Q81 73 72 73H28Q19 73 19 64Z';
  function paletaBody(ctx, col, p, mood, horiz) {
    var c = POP[col], v = '', i, st = '';
    var out = halo(ctx, 50, 48, 50);
    v += '<rect x="42.5" y="62" width="15" height="34" rx="7.5" fill="#f6d69c" stroke="' + INK + '" stroke-width="2.8"/>' +
      '<path d="M47 76V90M53 80V87" stroke="#c48c48" stroke-width="1.6" stroke-linecap="round"/>';
    v += '<path d="' + POPSICLE + '" fill="none" stroke="#fff" stroke-width="10" stroke-linejoin="round"/>';
    v += '<path d="' + POPSICLE + '" fill="' + lg(ctx, [[0, c[0]], [0.3, c[1]], [0.75, c[1]], [1, c[2]]], 0, 0, 1, 0) + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    for (i = 0; i < 3; i++) st += '<rect x="' + (24.5 + i * 19) + '" y="0" width="9" height="100"/>';
    v += '<g clip-path="' + clip(ctx, '<path d="' + POPSICLE + '"/>') + '"><g fill="#fff" opacity=".9">' + st + '</g>' +
      '<path d="M19 66H81" stroke="' + c[2] + '" stroke-width="5" opacity=".5"/></g>';
    v += '<path d="M26 28Q27 13 40 9" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>';
    v += arrow(50, 5, -90) + arrow(26, 88, 90) + arrow(74, 88, 90);
    out += horiz ? g('rotate(-90 50 50)', v) : v;
    out += g(horiz ? 'translate(18 23) scale(.46)' : 'translate(27 13) scale(.46)', headStr(ctx, col, mood));
    out += sparkle(horiz ? 86 : 89, horiz ? 14 : 13, 6, '#fff');
    return out;
  }
  function arrow(x, y, rot) {
    return g('translate(' + x + ' ' + y + ') rotate(' + rot + ')',
      '<path d="M7 0L-6 -11L-6 11Z" fill="#fff" stroke="' + INK + '" stroke-width="2.8" stroke-linejoin="round"/>');
  }

  function coconut(ctx, cx, cy, r) {
    var cf = rg(ctx, [[0, '#b07a4e'], [0.55, '#7a4a2a'], [1, '#3e2214']], 0.38, 0.3, 0.75);
    var out = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + cf + '" stroke="' + INK + '" stroke-width="' + f(r * 0.085) + '"/>';
    var fib = '';
    for (var i = 0; i < 16; i++) {
      var a = i * Math.PI * 2 / 16 + 0.2, rr = r * (i % 2 ? 0.72 : 0.86);
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      fib += 'M' + f(x) + ' ' + f(y) + 'l' + f(Math.cos(a + 1.2) * r * 0.16) + ' ' + f(Math.sin(a + 1.2) * r * 0.16);
    }
    out += '<path d="' + fib + '" stroke="#c99a6a" stroke-width="' + f(r * 0.045) + '" stroke-linecap="round" opacity=".75"/>';
    return out;
  }
  function bombaBody(ctx, col, p, mood) {
    var c = POP[col];
    var out = halo(ctx, 48, 56, 50) + shadow(50, 95, 32, 4);
    // mecha
    out += '<path d="M63 25Q68 12 79 12" fill="none" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/><path d="M63 25Q68 12 79 12" fill="none" stroke="#f6dca0" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="3 2"/>';
    // contorno blanco + coco
    out += '<circle cx="48" cy="57" r="37" fill="none" stroke="#fff" stroke-width="9"/>';
    out += coconut(ctx, 48, 57, 37);
    out += '<g fill="#2b160c"><ellipse cx="38" cy="31" rx="3.4" ry="2.6"/><ellipse cx="50" cy="28" rx="3.4" ry="2.6"/><ellipse cx="44" cy="37" rx="3" ry="2.3"/></g>';
    // faja del color del sabor
    var cp = clip(ctx, '<circle cx="48" cy="57" r="37"/>');
    out += '<g clip-path="' + cp + '"><path d="M0 51Q48 42 100 51L100 72Q48 63 0 72Z" fill="' + c[1] + '" stroke="' + INK + '" stroke-width="2.6"/>' +
      '<path d="M0 55Q48 46 100 55" fill="none" stroke="#fff" stroke-width="2.4" opacity=".7"/></g>';
    out += gloss(31, 41, 8, 4, -35, 0.4);
    // medallón con la cabeza
    out += '<circle cx="48" cy="62" r="26" fill="' + c[0] + '" stroke="' + INK + '" stroke-width="2.8"/>';
    var mc = clip(ctx, '<circle cx="48" cy="62" r="24.6"/>');
    out += '<g clip-path="' + mc + '">' + g('translate(22 34) scale(.53)', headStr(ctx, col, mood)) + '</g>';
    // chispa con resplandor
    out += '<circle cx="81" cy="13" r="17" fill="' + rg(ctx, [[0, '#fffbd0', 1], [0.35, '#ffd23c', 0.85], [1, '#ff6a1a', 0]], 0.5, 0.5, 0.5) + '"/>';
    out += '<path d="M81 -1L85 7L94 4L89 12L97 17L87 18L86 27L80 20L71 24L75 15L67 10L77 8Z" fill="#fff36a" stroke="#e8380a" stroke-width="2" stroke-linejoin="round"/>';
    out += '<circle cx="81" cy="13" r="3.6" fill="#fff"/><g fill="#ff8a1a"><circle cx="66" cy="4" r="1.6"/><circle cx="95" cy="27" r="1.4"/><circle cx="70" cy="22" r="1.2"/></g>';
    return out;
  }

  // ---------- Copa Arcoíris ----------
  function copa() {
    var ctx = newCtx(), out = halo(ctx, 50, 46, 50, '#fff8d0') + shadow(50, 95, 26, 4);
    var gf = lg(ctx, [[0, '#ffffff', 0.9], [0.5, '#d8f4ff', 0.8], [1, '#9fdcff', 0.9]], 0, 0, 1, 0);
    // arcoíris detrás de las bolas
    var rb = ['#ff3355', '#ff8a10', '#ffd414', '#2ed060', '#2f8cff', '#9a44f0'], arc = '';
    rb.forEach(function (c, i) { var r = 45 - i * 4.2; arc += '<path d="M' + f(50 - r) + ' 50A' + r + ' ' + r + ' 0 0 1 ' + f(50 + r) + ' 50" stroke="' + c + '"/>'; });
    out += '<path d="M3 50A47 47 0 0 1 97 50" fill="none" stroke="#fff" stroke-width="9"/>';
    out += '<g fill="none" stroke-width="4.6">' + arc + '</g>';
    // bolas
    out += '<circle cx="34" cy="44" r="15" fill="#ff5fa8" stroke="' + INK + '" stroke-width="2.6"/>';
    out += '<circle cx="66" cy="44" r="15" fill="#2fe0b8" stroke="' + INK + '" stroke-width="2.6"/>';
    out += '<circle cx="50" cy="28" r="16" fill="#ffd41a" stroke="' + INK + '" stroke-width="2.6"/>';
    out += '<circle cx="50" cy="12" r="8" fill="#b070ff" stroke="' + INK + '" stroke-width="2.4"/>';
    out += '<g fill="#fff" opacity=".7"><ellipse cx="29" cy="39" rx="4" ry="2.4"/><ellipse cx="61" cy="39" rx="4" ry="2.4"/><ellipse cx="45" cy="22" rx="4.5" ry="2.6"/><circle cx="47" cy="9" r="2"/></g>';
    // chispitas de colores
    var sp = [[30, 50, '#2f8cff', 30], [38, 38, '#ff3355', -20], [62, 50, '#ff8a10', 40], [70, 38, '#9a44f0', -40], [44, 30, '#2ed060', 60], [56, 24, '#ff4f93', -10], [52, 34, '#2f8cff', 20], [27, 44, '#ffd414', 70], [72, 46, '#fff', 10], [50, 14, '#fff', 50]];
    out += sp.map(function (s) { return '<rect x="' + (s[0] - 3) + '" y="' + (s[1] - 1) + '" width="6" height="2.2" rx="1.1" fill="' + s[2] + '" transform="rotate(' + s[3] + ' ' + s[0] + ' ' + s[1] + ')"/>'; }).join('');
    // copa de vidrio con contorno blanco
    var CUP = 'M14 50H86Q84 74 58 78L56 84H44L42 78Q16 74 14 50Z';
    out += '<path d="' + CUP + '" fill="none" stroke="#fff" stroke-width="8" stroke-linejoin="round"/>';
    out += '<path d="' + CUP + '" fill="' + gf + '" stroke="' + INK + '" stroke-width="' + SW + '" stroke-linejoin="round"/>';
    // franjas arcoíris en el vidrio
    var cp = clip(ctx, '<path d="M14 50H86Q84 74 58 78L42 78Q16 74 14 50Z"/>'), st = '';
    rb.forEach(function (c, i) { st += '<rect x="0" y="' + (52 + i * 4.2) + '" width="100" height="4.4" fill="' + c + '"/>'; });
    out += '<g clip-path="' + cp + '">' + st + '</g>';
    out += '<path d="M14 50H86" stroke="' + INK + '" stroke-width="' + SW + '"/><path d="M22 56Q26 68 38 72" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>';
    out += '<path d="M30 92Q50 84 70 92Z" fill="' + gf + '" stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="round"/><rect x="45" y="82" width="10" height="9" fill="#d7f2ff" stroke="' + INK + '" stroke-width="2.2"/>';
    // destellos
    out += sparkle(88, 16, 7, '#fff') + sparkle(12, 22, 5.5, '#fff') + sparkle(86, 70, 4.5, '#ffd414');
    return wrap(ctx, 100, 100, out);
  }
  function sparkle(x, y, r, col) {
    return '<path d="M' + x + ' ' + (y - r) + 'Q' + (x + r * 0.2) + ' ' + (y - r * 0.2) + ' ' + (x + r) + ' ' + y + 'Q' + (x + r * 0.2) + ' ' + (y + r * 0.2) + ' ' + x + ' ' + (y + r) + 'Q' + (x - r * 0.2) + ' ' + (y + r * 0.2) + ' ' + (x - r) + ' ' + y + 'Q' + (x - r * 0.2) + ' ' + (y - r * 0.2) + ' ' + x + ' ' + (y - r) + 'Z" fill="' + col + '" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/>';
  }

  // ---------- fichas especiales (Uva fugitiva / Prueba) ----------
  function goldDisc(ctx) {
    var gf = rg(ctx, [[0, '#fff6c8'], [0.6, '#ffe07a'], [1, '#ffb52e']], 0.5, 0.45, 0.6);
    return shadow(50, 94, 30, 4) + '<circle cx="50" cy="50" r="43" fill="' + gf + '" stroke="' + INK + '" stroke-width="' + SW + '"/>' +
      '<circle cx="50" cy="50" r="37.5" fill="none" stroke="#ffc93c" stroke-width="3.5"/><circle cx="50" cy="50" r="37.5" fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 5" opacity=".9"/>';
  }
  function bangBadge(x, y) {
    return '<circle cx="' + x + '" cy="' + y + '" r="11" fill="#d61f4b" stroke="' + INK + '" stroke-width="2.6"/>' +
      '<path d="M' + (x - 1.8) + ' ' + (y - 7) + 'H' + (x + 1.8) + 'L' + (x + 1.2) + ' ' + (y + 2) + 'H' + (x - 1.2) + 'Z" fill="#fff"/><circle cx="' + x + '" cy="' + (y + 5) + '" r="1.9" fill="#fff"/>';
  }
  function token(skin) {
    var ctx = newCtx(), out = goldDisc(ctx);
    if (skin === 'uva') {
      // líneas de velocidad
      out += '<path d="M10 40H24M8 52H20M12 64H24" stroke="' + INK + '" stroke-width="3" stroke-linecap="round" opacity=".55"/>';
      // piernitas corriendo
      out += '<path d="M48 76L40 88M58 76L68 84" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/><path d="M48 76L40 88M58 76L68 84" stroke="#9b4fd6" stroke-width="4" stroke-linecap="round"/>';
      out += '<ellipse cx="38" cy="89" rx="6" ry="3.4" fill="#d8b0ff" stroke="' + INK + '" stroke-width="2"/><ellipse cx="70" cy="85" rx="6" ry="3.4" fill="#d8b0ff" stroke="' + INK + '" stroke-width="2"/>';
      out += g('translate(22 10) scale(.66) rotate(8 50 50)', headStr(ctx, 'U', 'scared'));
      out += '<path d="M14 26q4 6 0 10M86 66q4 4 2 8" fill="none" stroke="#7fd0ff" stroke-width="2.4" stroke-linecap="round"/>';
      out += bangBadge(82, 18);
    } else {
      // carpeta manila con foto y lupa
      out += '<path d="M20 34H40L45 28H66L68 34H80V76H20Z" fill="#c9923e" stroke="' + INK + '" stroke-width="2.6" stroke-linejoin="round"/>';
      out += '<rect x="27" y="26" width="42" height="40" fill="#fff" stroke="' + INK + '" stroke-width="2" transform="rotate(-6 48 46)"/>';
      out += '<g transform="rotate(-6 48 46)"><rect x="31" y="30" width="16" height="14" fill="#ffb3cf" stroke="' + INK + '" stroke-width="1.4"/><circle cx="39" cy="36" r="3.5" fill="#ffd23c"/><path d="M51 33H64M51 38H62M31 50H63M31 55H58" stroke="#9a8a9a" stroke-width="2" stroke-linecap="round"/></g>';
      out += '<path d="M16 42H84L80 80H20Z" fill="#f2c46a" stroke="' + INK + '" stroke-width="2.8" stroke-linejoin="round"/>';
      out += '<rect x="28" y="60" width="28" height="9" rx="2" fill="none" stroke="#d61f4b" stroke-width="2.4" transform="rotate(-8 42 64)"/>';
      out += '<path d="M31 64.5H53" stroke="#d61f4b" stroke-width="2" stroke-dasharray="3 2" transform="rotate(-8 42 64)"/>';
      // lupa
      out += '<path d="M70 66L82 80" stroke="' + INK + '" stroke-width="8" stroke-linecap="round"/><path d="M70 66L82 80" stroke="#7a4a2a" stroke-width="4.5" stroke-linecap="round"/>';
      out += '<circle cx="63" cy="57" r="11" fill="#bfe9ff" fill-opacity=".7" stroke="' + INK + '" stroke-width="3.2"/><path d="M57 53q3-4 7-4" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>';
      out += bangBadge(82, 18);
    }
    return wrap(ctx, 100, 100, out);
  }

  // ---------- escarcha (overlay) ----------
  function frostCorners(op) {
    var c = '<path d="M4 34V14Q4 4 14 4H34L30 8L26 6L23 11L18 9L16 15L10 15L11 21L6 23L9 28Z"/>';
    return '<g fill="#f4fbff" stroke="#9fd6f5" stroke-width="1.4" stroke-linejoin="round" opacity="' + (op || 0.95) + '">' + c +
      g('matrix(-1 0 0 1 100 0)', c) + g('matrix(1 0 0 -1 0 100)', c) + g('matrix(-1 0 0 -1 100 100)', c) + '</g>';
  }
  function frost() {
    var ctx = newCtx();
    var ff = lg(ctx, [[0, '#ffffff', 0.55], [0.45, '#d8f2ff', 0.18], [1, '#9fd6f5', 0.5]], 0, 0, 1, 1);
    var out = '<rect x="3" y="3" width="94" height="94" rx="16" fill="' + ff + '" stroke="#e8f8ff" stroke-width="3"/>';
    out += '<rect x="3" y="3" width="94" height="94" rx="16" fill="none" stroke="#7cc6ef" stroke-width="1.5" stroke-dasharray="7 4" opacity=".8"/>';
    out += frostCorners(0.92);
    out += '<path d="M14 70L32 88M62 10L92 40" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".45"/>';
    out += flake(20, 20, 9, 2.6, '#fff') + flake(80, 80, 9, 2.6, '#fff') + flake(82, 20, 6, 2, '#ffffff', 0.9) + flake(18, 82, 6, 2, '#ffffff', 0.9);
    out += flake(20, 20, 9, 1, '#4aa8e0', 0.6) + flake(80, 80, 9, 1, '#4aa8e0', 0.6);
    return wrap(ctx, 100, 100, out);
  }

  // ---------- bloque de hielo ----------
  var CRACKS = [
    'M50 6L46 22L56 30L44 44L52 52',
    'M95 60L80 58L74 70L62 66L54 76',
    'M8 72L22 66L28 78L40 74L46 94',
    'M6 30L20 36L18 48L32 52'
  ];
  function cracks(n, sw) {
    var out = '';
    for (var i = 0; i < n && i < CRACKS.length; i++) {
      out += '<path d="' + CRACKS[i] + '" fill="none" stroke="#fff" stroke-width="' + (sw + 2) + '" stroke-linecap="round" stroke-linejoin="round"/>';
      out += '<path d="' + CRACKS[i] + '" fill="none" stroke="#2a6f9e" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    return out;
  }
  function hpPips(hp, maxHp) {
    var out = '', w = 10, gap = 3, tot = maxHp * w + (maxHp - 1) * gap, x0 = 50 - tot / 2;
    for (var i = 0; i < maxHp; i++) {
      var on = i < hp;
      out += '<rect x="' + f(x0 + i * (w + gap)) + '" y="84" width="' + w + '" height="6" rx="3" fill="' + (on ? '#fff' : '#3b7aa8') + '" stroke="' + INK + '" stroke-width="1.6" opacity="' + (on ? 1 : 0.6) + '"/>';
    }
    return out;
  }
  function ice(hp, maxHp) {
    hp = clamp(Math.round(hp || 1), 1, 3); maxHp = clamp(Math.max(hp, Math.round(maxHp || hp)), 1, 3);
    var ctx = newCtx(), out = '';
    // más HP = más grueso, más azul y con más marcos
    var top = ['', '#f2fbff', '#dcf3ff', '#c4ebff'][hp], mid = ['', '#bfe8ff', '#8fd3f7', '#5db6ea'][hp], bot = ['', '#8fd0f2', '#4aa8e0', '#2a7fc0'][hp];
    var bf = lg(ctx, [[0, top], [0.5, mid], [1, bot]], 0, 0, 0.8, 1);
    out += shadow(50, 95, 40, 3.5, 0.2);
    out += '<rect x="4" y="4" width="92" height="92" rx="14" fill="' + bf + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    // bisel interior
    out += '<rect x="9" y="9" width="82" height="82" rx="10" fill="none" stroke="#fff" stroke-width="2.4" stroke-opacity=".75"/>';
    // capas (una por HP extra)
    for (var i = 1; i < hp; i++) {
      var ins = 6 + i * 10;
      out += '<rect x="' + ins + '" y="' + ins + '" width="' + (100 - 2 * ins) + '" height="' + (100 - 2 * ins) + '" rx="' + (12 - i * 2) + '" fill="#ffffff" fill-opacity=".16" stroke="#ffffff" stroke-width="3" stroke-opacity=".9"/>';
      out += '<rect x="' + (ins + 2.5) + '" y="' + (ins + 2.5) + '" width="' + (100 - 2 * ins - 5) + '" height="' + (100 - 2 * ins - 5) + '" rx="' + (10 - i * 2) + '" fill="none" stroke="#1d5f8f" stroke-width="1.4" stroke-opacity=".45"/>';
    }
    // brillo y sombra del bisel
    out += '<path d="M12 42V22Q12 12 22 12H58" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>';
    out += '<path d="M88 58V78Q88 88 78 88H44" fill="none" stroke="#1d5f8f" stroke-width="3" stroke-linecap="round" opacity=".35"/>';
    out += '<path d="M26 74L72 28M38 80L80 38" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".35"/>';
    // burbujitas
    out += '<g fill="#fff" opacity=".8"><circle cx="70" cy="70" r="2.2"/><circle cx="76" cy="62" r="1.4"/><circle cx="24" cy="30" r="1.6"/></g>';
    if (hp >= 3) out += flake(50, 48, 11, 2.8, '#fff', 0.9);
    else if (hp === 2) out += flake(50, 48, 7, 2.2, '#fff', 0.75);
    out += cracks(maxHp - hp, 1.8);
    out += hpPips(hp, maxHp);
    return wrap(ctx, 100, 100, out);
  }

  // ---------- caja del inventario ----------
  function cherryStamp(x, y, s, col) {
    return g('translate(' + x + ' ' + y + ') rotate(-12) scale(' + s + ')',
      '<circle r="17" fill="none" stroke="' + col + '" stroke-width="3"/><circle r="13.5" fill="none" stroke="' + col + '" stroke-width="1.2"/>' +
      '<circle cx="-1" cy="4" r="7" fill="' + col + '"/><path d="M-1 -3Q0 -10 6 -12" fill="none" stroke="' + col + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M3 -10Q10 -14 12 -8Q6 -6 3 -10Z" fill="' + col + '"/><circle cx="-3" cy="2" r="1.8" fill="#f3d5a8" opacity=".8"/>');
  }
  function crate() {
    var ctx = newCtx(), out = shadow(50, 95, 40, 3.5, 0.22);
    var wf = lg(ctx, [[0, '#e3ac6a'], [1, '#b8763a']], 0, 0, 0, 1);
    out += '<rect x="5" y="5" width="90" height="88" rx="8" fill="' + wf + '" stroke="' + INK + '" stroke-width="' + SW + '"/>';
    // tablas
    out += '<path d="M9 34H91M9 64H91" stroke="#8a5426" stroke-width="2.4"/>';
    out += '<path d="M9 22H91M9 50H91M9 78H91" stroke="#c98a4a" stroke-width="1.2" opacity=".6"/>';
    out += '<path d="M20 26q8 2 16 0M60 56q10 2 18 0M30 84q6 1 12 0" fill="none" stroke="#8a5426" stroke-width="1.2" opacity=".6"/>';
    // marco y diagonal
    out += '<path d="M14 14L86 86" stroke="' + INK + '" stroke-width="12" stroke-linecap="round" opacity=".9"/><path d="M14 14L86 86" stroke="#d29a5a" stroke-width="8" stroke-linecap="round"/>';
    out += '<rect x="9" y="9" width="82" height="80" rx="5" fill="none" stroke="#7a4a20" stroke-width="5"/>';
    out += '<g fill="#5a3a20"><circle cx="15" cy="15" r="2"/><circle cx="85" cy="15" r="2"/><circle cx="15" cy="83" r="2"/><circle cx="85" cy="83" r="2"/></g>';
    // etiqueta de inventario
    out += '<rect x="52" y="14" width="34" height="18" rx="2" fill="#fff6ea" stroke="' + INK + '" stroke-width="1.6" transform="rotate(4 69 23)"/>';
    out += '<path d="M56 20H80M56 24.5H76M56 29H72" stroke="#7a6a7a" stroke-width="1.6" transform="rotate(4 69 23)"/>';
    out += cherryStamp(32, 66, 1, '#d61f4b');
    out += '<path d="M8 8H50" stroke="#fff" stroke-width="2" opacity=".35" stroke-linecap="round"/>';
    return wrap(ctx, 100, 100, out);
  }

  // ---------- amigo congelado (bloque de hielo grueso con el personaje dentro, cadena y candado) ----------
  // Etapas: 0 = intacto (ojos cerrados), 1 = agrietado (asustado), 2 = último golpe (feliz, candado abierto).
  function linkChain(x0, x1, y) {
    var s = '';
    for (var x = x0, i = 0; x <= x1; x += 7, i++) s += i % 2 ? '<rect x="' + f(x - 2.4) + '" y="' + f(y - 1.6) + '" width="4.8" height="3.2" rx="1.6"/>' : '<rect x="' + f(x - 4.4) + '" y="' + f(y - 3.2) + '" width="8.8" height="6.4" rx="3.2"/>';
    return '<g fill="none" stroke="' + INK + '" stroke-width="4.4">' + s + '</g><g fill="none" stroke="#c9d4de" stroke-width="2">' + s + '</g>';
  }
  function friend(who, hp, maxHp) {
    hp = Math.max(1, Math.round(hp || 1)); maxHp = Math.max(hp, Math.round(maxHp || hp));
    var ctx = newCtx(), out = '', lost = maxHp - hp;
    var stage = lost === 0 ? 0 : (hp === 1 ? 2 : 1);
    var mood = stage === 0 ? 'blink' : (stage === 2 ? 'happy' : 'scared');
    var W = '<rect x="15" y="16" width="70" height="60" rx="7"/>';
    out += shadow(50, 96, 42, 3.5, 0.25);
    // bloque con bisel grueso
    out += '<rect x="2" y="2" width="96" height="94" rx="14" fill="' + lg(ctx, [[0, '#f2fbff'], [0.55, '#a9dcf6'], [1, '#5aa6dc']], 0, 0, 0.6, 1) + '" stroke="' + INK + '" stroke-width="3.4"/>';
    out += '<path d="M4 16Q4 4 16 4H84Q96 4 96 16L85 16H15Z" fill="#fff" opacity=".9"/>';
    out += '<path d="M4 16L15 16V76L4 84Z" fill="#fff" opacity=".55"/>';
    out += '<path d="M96 16L85 16V76L96 84Z" fill="#1f6aa8" opacity=".3"/>';
    out += '<path d="M4 84L15 76H85L96 84Q96 94 84 94H16Q4 94 4 84Z" fill="#1f6aa8" opacity=".42"/>';
    // ventana de hielo con el personaje dentro (más chico y detrás del vidrio escarchado)
    out += W.replace('/>', ' fill="' + lg(ctx, [[0, '#d6f1ff'], [1, '#7cc4ee']], 0, 0, 0, 1) + '"/>');
    out += '<g clip-path="' + clip(ctx, W) + '">' + g('translate(23 17) scale(.54)', charHead(ctx, who || 'lima', mood)) +
      W.replace('/>', ' fill="' + lg(ctx, [[0, '#ffffff', 0.72], [0.45, '#d8f2ff', 0.38], [1, '#5ab0e6', 0.55]], 0, 0, 0.5, 1) + '"/>') +
      '<path d="M10 70L48 12M34 84L80 16" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".38"/>' +
      flake(23, 24, 6, 1.8, '#fff', 0.9) + flake(78, 68, 5, 1.6, '#fff', 0.8) + '</g>';
    out += W.replace('/>', ' fill="none" stroke="' + INK + '" stroke-width="2.6"/>');
    out += '<path d="M18 40V24Q18 19 23 19H50" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>';
    // grietas según el daño
    var CR = ['M62 4L57 22L66 30L54 44', 'M96 52L80 50L74 62L62 58', 'M4 60L20 56L26 68L38 64L42 76', 'M40 4L44 18L36 30', 'M96 30L86 36L88 46'];
    var nc = stage === 0 ? 0 : (stage === 1 ? 2 : 5), cr = '';
    for (var i = 0; i < nc; i++) cr += '<path d="' + CR[i] + '"/>';
    if (cr) out += '<g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#fff" stroke-width="4.4">' + cr + '</g><g stroke="#1d5f8f" stroke-width="2.2">' + cr + '</g></g>';
    if (stage === 2) out += '<path d="M84 4H96V16Z" fill="' + INK + '" opacity=".2"/><path d="M4 92L4 82L12 92Z" fill="' + INK + '" opacity=".2"/>';
    // cadena y candado
    out += linkChain(7, 93, 82);
    var open = stage === 2;
    out += '<path d="' + (open ? 'M44 79V70Q44 62 51 62Q58 62 58 70' : 'M44 79V71Q44 64 50 64Q56 64 56 71V79') + '" fill="none" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="' + (open ? 'M44 79V70Q44 62 51 62Q58 62 58 70' : 'M44 79V71Q44 64 50 64Q56 64 56 71V79') + '" fill="none" stroke="#c9d4de" stroke-width="3" stroke-linecap="round"/>';
    out += '<rect x="38" y="74" width="24" height="19" rx="4.5" fill="' + lg(ctx, [[0, '#ffe680'], [1, '#e09a10']], 0, 0, 0, 1) + '" stroke="' + INK + '" stroke-width="2.8"/>';
    out += '<circle cx="50" cy="81.5" r="2.6" fill="' + INK + '"/><path d="M50 82V88" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/><path d="M41 77H52" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>';
    // destellos de escarcha
    out += sparkle(10, 10, 5, '#fff') + sparkle(91, 62, 4.5, '#fff') + sparkle(90, 10, 3.5, '#fff');
    // vida: píldoras grandes arriba
    var w = 14, gap = 4, tot = maxHp * w + (maxHp - 1) * gap, x0 = 50 - tot / 2;
    for (var k = 0; k < maxHp; k++) {
      var on = k < hp;
      out += '<rect x="' + f(x0 + k * (w + gap)) + '" y="5" width="' + w + '" height="8" rx="4" fill="' + (on ? '#fff' : '#2a5f86') + '" stroke="' + INK + '" stroke-width="2"' + (on ? '' : ' opacity=".7"') + '/>';
      if (on) out += '<rect x="' + f(x0 + k * (w + gap) + 3) + '" y="7.4" width="' + (w - 6) + '" height="3.2" rx="1.6" fill="#5fd0ff"/>';
    }
    return wrap(ctx, 100, 100, out);
  }

  // ---------- congelador jefe (2x2) ----------
  // Congelador vertical de una puerta con la cara del dueño en una calcomanía.
  // Cocardo: blanco hueso, oxidado, luz azul. Cereza: rosa con detalles dorados.
  function freezer(who, hp, maxHp) {
    var pink = who === 'cereza' || who === 'cherry';
    maxHp = Math.max(1, maxHp || hp || 1); hp = clamp(hp == null ? maxHp : hp, 0, maxHp);
    var r = hp / maxHp, stage = r > 0.75 ? 0 : r > 0.5 ? 1 : r > 0.25 ? 2 : 3;
    var ctx = newCtx(), out = '';
    var bodyF = pink ? lg(ctx, [[0, '#ffd0e2'], [0.45, '#ffb0cc'], [1, '#e0608e']], 0, 0, 1, 0)
      : lg(ctx, [[0, '#f6f1e4'], [0.45, '#e6dfcc'], [1, '#b3a990']], 0, 0, 1, 0);
    var doorF = pink ? lg(ctx, [[0, '#ffe6f0'], [0.55, '#ffc0d8'], [1, '#f088b0']], 0, 0, 1, 1)
      : lg(ctx, [[0, '#fffdf6'], [0.55, '#efe9da'], [1, '#cfc6ae']], 0, 0, 1, 1);
    var glow = pink ? '#ff5fa0' : '#38c8ff', trim = pink ? '#ffc93c' : '#a9b3bf';
    var halo = rg(ctx, [[0, glow, 0.55], [1, glow, 0]], 0.5, 0.5, 0.5);
    out += '<ellipse cx="100" cy="104" rx="98" ry="98" fill="' + halo + '"/>';
    out += shadow(100, 192, 78, 6, 0.32);
    // patas
    out += '<rect x="40" y="180" width="18" height="12" rx="3" fill="#4a4050" stroke="' + INK + '" stroke-width="3"/><rect x="142" y="180" width="18" height="12" rx="3" fill="#4a4050" stroke="' + INK + '" stroke-width="3"/>';
    // cuerpo
    out += '<rect x="26" y="10" width="148" height="174" rx="16" fill="' + bodyF + '" stroke="' + INK + '" stroke-width="5"/>';
    // rejilla inferior
    out += '<rect x="44" y="164" width="112" height="13" rx="4" fill="' + (pink ? '#b8406e' : '#6e6a70') + '" stroke="' + INK + '" stroke-width="3"/>';
    out += '<path d="M54 168V173M64 168V173M74 168V173M84 168V173M94 168V173M104 168V173M114 168V173M124 168V173M134 168V173M144 168V173" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>';
    // luz por la rendija de la puerta
    out += '<rect x="33" y="19" width="134" height="140" rx="11" fill="none" stroke="' + glow + '" stroke-width="' + (stage >= 3 ? 7 : 4) + '" opacity=".95"/>';
    // puerta
    var door = '';
    door += '<rect x="35" y="21" width="130" height="136" rx="10" fill="' + doorF + '" stroke="' + INK + '" stroke-width="4"/>';
    door += '<path d="M44 30H130" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/><path d="M44 30V70" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/>';
    // bisagras
    door += '<g fill="' + trim + '" stroke="' + INK + '" stroke-width="2.4"><rect x="30" y="36" width="9" height="18" rx="3"/><rect x="30" y="124" width="9" height="18" rx="3"/></g>';
    // calcomanía con la cara del dueño
    var stF = pink ? rg(ctx, [[0, '#fff0f6'], [0.7, '#ff9ec4'], [1, '#e04a86']], 0.5, 0.4, 0.7)
      : rg(ctx, [[0, '#f2fbff'], [0.7, '#9fdcff'], [1, '#3a9ad8']], 0.5, 0.4, 0.7);
    var st = '';
    st += '<rect x="-42" y="-42" width="84" height="84" rx="20" fill="#fff" stroke="' + INK + '" stroke-width="3.4"/>';
    st += '<rect x="-36" y="-36" width="72" height="72" rx="15" fill="' + stF + '"/>';
    var sc = clip(ctx, '<rect x="-36" y="-36" width="72" height="72" rx="15"/>');
    var mood = stage >= 2 ? 'scared' : (pink ? 'sly' : 'smirk');
    st += '<g clip-path="' + sc + '">' + g('translate(-40 -37) scale(.8)', pink ? cerezaHead(ctx, mood) : cocardoHead(ctx, mood)) + '</g>';
    // esquina despegada (viejo) o brillito (Cereza)
    if (!pink) st += '<path d="M42 22L42 42L22 42Z" fill="#cfc6ae" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/><path d="M42 22Q30 30 22 42" fill="#fff" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round"/>';
    else st += sparkle(36, -36, 7, '#fff');
    door += g('translate(92 80) rotate(' + (pink ? 4 : -5) + ')', st);
    // termómetro / placa
    if (pink) {
      door += '<path d="M92 150C86 143 76 145 76 137C76 131 84 129 92 135C100 129 108 131 108 137C108 145 98 143 92 150Z" fill="#d61f4b" stroke="' + INK + '" stroke-width="2.6"/><path d="M83 136q2-3 5-2" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".8"/>';
    } else {
      door += '<circle cx="64" cy="138" r="11" fill="#fff" stroke="' + INK + '" stroke-width="3"/><path d="M64 138L70 132" stroke="#d61f4b" stroke-width="2.6" stroke-linecap="round"/><circle cx="64" cy="138" r="2" fill="' + INK + '"/>';
      door += '<rect x="84" y="132" width="40" height="12" rx="6" fill="#7a4a2a" stroke="' + INK + '" stroke-width="2.6"/><circle cx="95" cy="138" r="2.6" fill="#ff7eb6"/><circle cx="104" cy="138" r="2.6" fill="#5fdcc0"/><circle cx="113" cy="138" r="2.6" fill="#ffd84a"/>';
    }
    // manija
    var handleTf = stage >= 2 ? ' transform="rotate(12 150 90)"' : '';
    door += '<g' + handleTf + '><rect x="144" y="56" width="12" height="62" rx="6" fill="' + (pink ? '#ffd84a' : '#d8dde4') + '" stroke="' + INK + '" stroke-width="3.4"/><path d="M148 62V110" stroke="#fff" stroke-width="2.4" opacity=".7"/></g>';
    // óxido y abolladuras / brillos
    if (!pink) {
      door += '<g fill="#b5652a" opacity=".6"><ellipse cx="46" cy="104" rx="5" ry="7"/><ellipse cx="156" cy="148" rx="5" ry="3"/><circle cx="141" cy="30" r="3"/><ellipse cx="128" cy="150" rx="3" ry="2"/></g>';
      door += '<path d="M46 98v14M157 145q3 4 1 8" stroke="#8a4a1e" stroke-width="1.6" fill="none" opacity=".6"/>';
    } else {
      door += sparkle(150, 136, 5, '#fff') + '<g fill="#ffc93c" stroke="' + INK + '" stroke-width="1.4"><circle cx="44" cy="30" r="3"/><circle cx="156" cy="30" r="3"/><circle cx="44" cy="148" r="3"/><circle cx="156" cy="148" r="3"/></g>';
    }
    // escarcha que se cuela por las orillas
    var fr = '<path d="M35 52V31Q35 21 45 21H66L61 26L56 24L52 30L46 28L44 35L39 35L40 42L36 44Z"/>';
    door += '<g fill="#f4fbff" stroke="' + (pink ? '#ff9ec4' : '#7cc6ef') + '" stroke-width="1.6" stroke-linejoin="round" opacity=".95">' + fr + g('matrix(-1 0 0 -1 200 178)', fr) + '</g>';
    // daño: grietas y abolladuras según hp
    var crack = function (d, w) {
      return '<path d="' + d + '" fill="none" stroke="#fff" stroke-width="' + (w + 2.4) + '" stroke-linecap="round" stroke-linejoin="round"/><path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';
    };
    if (stage >= 1) {
      door += crack('M120 22L114 36L124 44L116 56', 2);
      door += '<ellipse cx="54" cy="70" rx="8" ry="11" fill="' + INK + '" opacity=".14"/><path d="M48 62q6-4 12 2" fill="none" stroke="#fff" stroke-width="2" opacity=".8"/>';
    }
    if (stage >= 2) {
      door += crack('M36 112L52 116L48 126L62 132L58 146', 2.2);
      door += crack('M164 96L150 104L154 116L140 122', 2.2);
      door += '<ellipse cx="130" cy="140" rx="9" ry="6" fill="' + INK + '" opacity=".16"/>';
    }
    if (stage >= 3) {
      door += crack('M88 22L96 40L84 52L100 70L90 84L104 100L94 122L108 156', 2.6);
    }
    out += '<g' + (stage >= 3 ? ' transform="rotate(-3 35 157)"' : '') + '>' + door + '</g>';
    // nieve arriba + carámbanos
    out += '<path d="M30 16Q46 4 64 12Q82 2 100 11Q120 2 138 12Q156 4 170 16Q172 24 164 22L162 32L156 22L144 24L140 36L134 23L110 24L106 32L100 23L70 24L66 34L60 23L40 24L38 30L34 22Q26 24 30 16Z" fill="#f4fbff" stroke="' + (pink ? '#ff9ec4' : '#7cc6ef') + '" stroke-width="2" stroke-linejoin="round"/>';
    if (stage >= 2) {
      out += '<g fill="#dff4ff" stroke="' + INK + '" stroke-width="1.8" stroke-linejoin="round"><path d="M178 150l8 4-4 8-8-3z"/><path d="M18 120l7-2 2 7-7 2z"/></g>';
      out += sparkle(184, 120, 7, '#ffd23c');
    }
    if (stage >= 3) out += sparkle(16, 60, 8, '#ffd23c') + sparkle(176, 40, 6, '#ffd23c') + '<path d="M70 192l-6 5M134 192l6 5" stroke="#bfe9ff" stroke-width="4" stroke-linecap="round"/>';
    return wrap(ctx, 200, 200, out);
  }

  // ---------- iconos 24x24 ----------
  var C = 'currentColor';
  function starPath(cx, cy, R, r) {
    var d = '';
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
      d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * rr) + ' ' + f(cy + Math.sin(a) * rr);
    }
    return d + 'Z';
  }
  function gearPath() {
    var d = '', n = 8;
    for (var i = 0; i < n * 4; i++) {
      var a = i * Math.PI * 2 / (n * 4) - Math.PI / 2, rr = (i % 4 < 2) ? 11 : 8;
      d += (i ? 'L' : 'M') + f(12 + Math.cos(a) * rr) + ' ' + f(12 + Math.sin(a) * rr);
    }
    return d + 'ZM12 8.4A3.6 3.6 0 1 0 12 15.6A3.6 3.6 0 1 0 12 8.4Z';
  }
  var ICONS = {
    star: '<path d="' + starPath(12, 12.6, 11.2, 5.2) + '" fill="#ffc93c" stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.6 9.6L10.4 9.4" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".9"/>',
    starEmpty: '<path d="' + starPath(12, 12.6, 10.4, 4.8) + '" fill="' + C + '" fill-opacity=".18" stroke="' + C + '" stroke-width="2" stroke-linejoin="round"/>',
    lock: '<path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10" fill="none" stroke="' + C + '" stroke-width="2.6"/><path fill-rule="evenodd" fill="' + C + '" d="M4.5 10.5Q4.5 9.5 5.5 9.5H18.5Q19.5 9.5 19.5 10.5V20Q19.5 22 17.5 22H6.5Q4.5 22 4.5 20ZM12 13.4a1.8 1.8 0 0 0-1 3.3V19h2v-2.3a1.8 1.8 0 0 0-1-3.3Z"/>',
    pause: '<rect x="5" y="4" width="5" height="16" rx="1.6" fill="' + C + '"/><rect x="14" y="4" width="5" height="16" rx="1.6" fill="' + C + '"/>',
    play: '<path d="M7 4.4Q7 3 8.3 3.7L19.6 10.8Q20.8 11.6 19.6 12.4L8.3 19.6Q7 20.4 7 19Z" fill="' + C + '"/>',
    sound: '<path d="M3 9H7L12 4.5V19.5L7 15H3Z" fill="' + C + '" stroke="' + C + '" stroke-width="1.4" stroke-linejoin="round"/><path d="M15.5 8.5Q18 12 15.5 15.5M18.5 5.5Q23 12 18.5 18.5" fill="none" stroke="' + C + '" stroke-width="2.2" stroke-linecap="round"/>',
    mute: '<path d="M3 9H7L12 4.5V19.5L7 15H3Z" fill="' + C + '" stroke="' + C + '" stroke-width="1.4" stroke-linejoin="round"/><path d="M15.5 9L21.5 15M21.5 9L15.5 15" stroke="' + C + '" stroke-width="2.4" stroke-linecap="round"/>',
    music: '<path d="M9 17.5V5.5L20 3V15" fill="none" stroke="' + C + '" stroke-width="2.4" stroke-linejoin="round"/><ellipse cx="6.5" cy="17.8" rx="3.3" ry="2.7" fill="' + C + '"/><ellipse cx="17.5" cy="15.3" rx="3.3" ry="2.7" fill="' + C + '"/><path d="M9 8.5L20 6" stroke="' + C + '" stroke-width="2.4"/>',
    vibra: '<rect x="7.5" y="3" width="9" height="18" rx="2.2" fill="none" stroke="' + C + '" stroke-width="2.2"/><circle cx="12" cy="17.4" r="1.2" fill="' + C + '"/><path d="M4.5 8L2.5 10L4.5 12L2.5 14L4.5 16M19.5 8L21.5 10L19.5 12L21.5 14L19.5 16" fill="none" stroke="' + C + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    map: '<path d="M2.5 5.5L8.5 3.5L15.5 5.5L21.5 3.5V18.5L15.5 20.5L8.5 18.5L2.5 20.5Z" fill="' + C + '" fill-opacity=".22" stroke="' + C + '" stroke-width="2" stroke-linejoin="round"/><path d="M8.5 3.5V18.5M15.5 5.5V20.5" stroke="' + C + '" stroke-width="1.6"/><path d="M5 15Q8 10 12 13T19 8" fill="none" stroke="' + C + '" stroke-width="1.8" stroke-dasharray="2 2" stroke-linecap="round"/>',
    album: '<path fill-rule="evenodd" fill="' + C + '" d="M4 4.5Q4 3 5.5 3H19V21H5.5Q4 21 4 19.5ZM6.6 3.8H7.6V20.2H6.6ZM13 16.5C10.5 14.6 9.5 13.3 9.5 11.9C9.5 10.6 10.4 9.8 11.4 9.8C12.1 9.8 12.6 10.2 13 10.7C13.4 10.2 13.9 9.8 14.6 9.8C15.6 9.8 16.5 10.6 16.5 11.9C16.5 13.3 15.5 14.6 13 16.5Z"/>',
    settings: '<path fill-rule="evenodd" fill="' + C + '" d="' + gearPath() + '"/>',
    share: '<circle cx="18" cy="5.5" r="3.2" fill="' + C + '"/><circle cx="6" cy="12" r="3.2" fill="' + C + '"/><circle cx="18" cy="18.5" r="3.2" fill="' + C + '"/><path d="M18 5.5L6 12L18 18.5" fill="none" stroke="' + C + '" stroke-width="2.2"/>',
    flame: '<path d="M12 22C7 22 4.5 18.5 4.5 15C4.5 10.5 8.5 8.5 9 3.5C12 5.5 13 8 12.6 10.5C14 9.8 14.8 8.6 15 7C18 9.5 19.5 12.5 19.5 15.5C19.5 19 16.5 22 12 22Z" fill="#ff7a1a" stroke="' + INK + '" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 21C9.8 21 8.6 19.4 8.6 17.8C8.6 15.6 10.6 14.6 11 12.6C13.6 14 15.4 16 15.4 18C15.4 19.8 14 21 12 21Z" fill="#ffd23c"/>',
    back: '<path d="M14.5 4L6.5 12L14.5 20" fill="none" stroke="' + C + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M5.5 5.5L18.5 18.5M18.5 5.5L5.5 18.5" stroke="' + C + '" stroke-width="3.2" stroke-linecap="round"/>',
    retry: '<path d="M19.5 12A7.5 7.5 0 1 1 16.8 6.2" fill="none" stroke="' + C + '" stroke-width="2.8" stroke-linecap="round"/><path d="M14 2.8L20.4 4.2L18.6 10.4Z" fill="' + C + '" stroke="' + C + '" stroke-width="1.2" stroke-linejoin="round"/>',
    next: '<path d="M3.5 12H18M12.5 5.5L19 12L12.5 18.5" fill="none" stroke="' + C + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
    snowflake: '',
    box: '<path d="M3 7.5L12 3.5L21 7.5V17L12 21L3 17Z" fill="' + C + '" fill-opacity=".25" stroke="' + C + '" stroke-width="2" stroke-linejoin="round"/><path d="M3 7.5L12 11.5L21 7.5M12 11.5V21M7.5 5.5L16.5 9.5" fill="none" stroke="' + C + '" stroke-width="2" stroke-linejoin="round"/>',
    cucharon: '<path d="M13.5 13.5L21 21" stroke="' + C + '" stroke-width="3.4" stroke-linecap="round"/><path d="M3.5 9.5A6.5 6.5 0 0 1 16.5 9.5Q16.5 10.5 15.5 10.5H4.5Q3.5 10.5 3.5 9.5Z" fill="' + C + '"/><path d="M4 11.5H16Q15 16 10 16Q5 16 4 11.5Z" fill="' + C + '" fill-opacity=".55"/>',
    chorro: '<path d="M8 2.5H12V5H8Z" fill="' + C + '"/><path fill-rule="evenodd" fill="' + C + '" d="M6 7Q6 5 8 5H12Q14 5 14 7V20Q14 22 12 22H8Q6 22 6 20ZM7.6 10.2H12.4V15H7.6Z"/><path d="M14 4Q19 3 20 8Q20.5 11 19 13" fill="none" stroke="' + C + '" stroke-width="2" stroke-linecap="round"/><path d="M19 15Q20.5 17 19 18.5Q17.5 17 19 15Z" fill="' + C + '"/>',
    batido: '<path d="M14 1.5L12 9" stroke="' + C + '" stroke-width="2.2" stroke-linecap="round"/><path d="M5 9.5Q5 6 9 6Q10 4 12.5 4.5Q15 4 16 6.5Q19 7 19 9.5Z" fill="' + C + '" fill-opacity=".55"/><path fill-rule="evenodd" fill="' + C + '" d="M5 9.5H19L17 21Q16.8 22 15.8 22H8.2Q7.2 22 7 21ZM6.3 13.3H17.7L17.5 14.8H6.5Z"/>',
    moves: '<path d="M4 8.5H17M13.5 4.5L18 8.5L13.5 12.5" fill="none" stroke="' + C + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 15.5H7M10.5 11.5L6 15.5L10.5 19.5" fill="none" stroke="' + C + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    hand: '<path d="M9 13V4.5A1.75 1.75 0 0 1 12.5 4.5V11L18 12Q20 12.5 19.6 14.6L18.6 19.5Q18.2 21.5 16.2 21.5H11Q9.6 21.5 8.7 20.4L5.2 16Q4.2 14.6 5.6 13.6Q6.8 12.8 8 14Z" fill="' + C + '" stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round"/><path d="M12.5 11V15M15.5 11.6V15" stroke="' + INK + '" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>',
    calendar: '<path fill-rule="evenodd" fill="' + C + '" d="M3 6.5Q3 4.5 5 4.5H19Q21 4.5 21 6.5V19.5Q21 21.5 19 21.5H5Q3 21.5 3 19.5ZM5 10V19.5H19V10Z"/><path d="M7.5 2.5V6.5M16.5 2.5V6.5" stroke="' + C + '" stroke-width="2.4" stroke-linecap="round"/><g fill="' + C + '"><rect x="7" y="12" width="3" height="2.6" rx=".6"/><rect x="10.5" y="12" width="3" height="2.6" rx=".6"/><rect x="14" y="12" width="3" height="2.6" rx=".6"/><rect x="7" y="15.6" width="3" height="2.6" rx=".6"/><rect x="10.5" y="15.6" width="3" height="2.6" rx=".6"/></g>',
    trophy: '<path d="M7 3H17V9A5 5 0 0 1 7 9Z" fill="' + C + '"/><path d="M7 5H3.5Q3.5 10 7.6 11M17 5H20.5Q20.5 10 16.4 11" fill="none" stroke="' + C + '" stroke-width="2"/><path d="M10.5 13.5H13.5V17H10.5Z" fill="' + C + '"/><path d="M7 21Q7 17 12 17Q17 17 17 21Z" fill="' + C + '"/>',
    check: '<path d="M4 12.5L9.5 18L20 6.5" fill="none" stroke="' + C + '" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  function icon(name, opts) {
    opts = opts || {};
    var ctx = newCtx(), body;
    if (name === 'snowflake') body = flake(12, 12, 10, 2.2, C);
    else body = ICONS[name];
    if (body == null) body = '<circle cx="12" cy="12" r="8" fill="' + C + '"/>';
    var extra = opts.color ? ' style="color:' + opts.color + '"' : '';
    var s = opts.size || 24;
    return wrap(ctx, 24, 24, body, extra).replace('width="24" height="24"', 'width="' + s + '" height="' + s + '"');
  }

  // ---------- logo ----------
  function logo() {
    var ctx = newCtx(), out = '';
    var tf = lg(ctx, [[0, '#fff6ea'], [0.45, '#ffd0e2'], [1, '#ff6fa5']], 0, 0, 0, 1);
    var font = 'font-family="Lilita One, Arial Rounded MT Bold, Arial Black, sans-serif" font-weight="900"';
    var word = function (fill, stroke, sw, dx, dy) {
      return '<g transform="translate(' + dx + ' ' + dy + ')" ' + font + ' font-size="104" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '" stroke-linejoin="round" paint-order="stroke">' +
        '<text x="18" y="122" textLength="70" lengthAdjust="spacingAndGlyphs">C</text>' +
        '<text x="160" y="122" textLength="238" lengthAdjust="spacingAndGlyphs">cardo</text></g>';
    };
    // sombra 3D
    out += word(INK, INK, 18, 4, 8);
    out += word(tf, INK, 12, 0, 0);
    // goteo de helado que sale de las letras (gota con bulbo; parche para unirla a la letra)
    var drips = [[54, 26], [184, 18], [232, 30], [322, 16]], dr = '', patch = '';
    drips.forEach(function (d) {
      var x = d[0], L = 112 + d[1];
      dr += '<path d="M' + (x - 7) + ' 117C' + (x - 7) + ' ' + (L - 10) + ' ' + (x - 4) + ' ' + (L - 8) + ' ' + (x - 5) + ' ' + (L - 2) + 'A5.5 5.5 0 1 0 ' + (x + 5) + ' ' + (L - 2) + 'C' + (x + 4) + ' ' + (L - 8) + ' ' + (x + 7) + ' ' + (L - 10) + ' ' + (x + 7) + ' 117Z"/>';
      patch += '<rect x="' + (x - 5.2) + '" y="115" width="10.4" height="15"/>';
    });
    out += '<g fill="#ff6fa5" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round">' + dr + '</g><g fill="#ff6fa5">' + patch + '</g>';
    out += '<g fill="#fff" opacity=".6">' + drips.map(function (d) { return '<ellipse cx="' + (d[0] - 2) + '" cy="' + (112 + d[1] - 3) + '" rx="1.6" ry="2.4"/>'; }).join('') + '</g>';
    // coco en lugar de la "o"
    out += '<circle cx="125" cy="92" r="35" fill="' + INK + '" transform="translate(4 8)"/>';
    out += coconut(ctx, 125, 92, 33);
    out += '<g fill="#2b160c"><ellipse cx="115" cy="74" rx="4" ry="3"/><ellipse cx="131" cy="72" rx="4" ry="3"/><ellipse cx="123" cy="83" rx="3.6" ry="2.8"/></g>';
    out += '<path d="M106 102Q125 118 144 102" fill="none" stroke="#f3d5a8" stroke-width="4" stroke-linecap="round" opacity=".9"/>';
    out += gloss(112, 80, 8, 4, -35, 0.35);
    // conito de helado clavado junto a la C
    out += g('translate(40 34) rotate(-24)',
      '<path d="M-11 4L0 34L11 4Z" fill="#f2b465" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M-6 9L4 22M2 7L8 16M-8 16L0 7" stroke="#b8742c" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M-15 6Q-18 -6 -8 -10Q-6 -22 6 -20Q16 -18 15 -6Q19 2 13 6Q9 13 5 6Q0 10 -4 6Q-10 12 -15 6Z" fill="#ff8fbe" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>' +
      '<ellipse cx="-3" cy="-11" rx="5" ry="3" fill="#fff" opacity=".7"/>' +
      '<g fill="#fff"><rect x="3" y="-6" width="5" height="2" rx="1" fill="#5fdcc0" transform="rotate(30 5 -5)"/><rect x="-10" y="-2" width="5" height="2" rx="1" fill="#ffd84a"/><rect x="6" y="2" width="5" height="2" rx="1" fill="#b88cff" transform="rotate(-40 8 3)"/></g>');
    // cinta del subtítulo
    out += '<path d="M40 150L380 150L392 168L380 186L40 186L28 168Z" fill="#5b1e74" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>';
    out += '<path d="M28 168L8 160L18 176L10 190L40 186ZM392 168L412 160L402 176L410 190L380 186Z" fill="#a1286a" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>';
    out += '<text x="210" y="181" text-anchor="middle" font-family="Yellowtail, Brush Script MT, cursive" font-size="36" fill="#ffc93c" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round" paint-order="stroke" textLength="300" lengthAdjust="spacingAndGlyphs">¡Rescate Helado!</text>';
    // destellos
    out += sparkle(392, 46, 10, '#fff') + sparkle(14, 120, 8, '#fff') + sparkle(375, 128, 6, '#ffc93c');
    out += flake(392, 92, 9, 3, '#bfe9ff');
    return wrap(ctx, 420, 210, out);
  }

  // ---------- fondos ----------
  function pattern(ctx, w, h, body, tf) {
    var id = gid(ctx);
    ctx.defs.push('<pattern id="' + id + '" width="' + w + '" height="' + h + '" patternUnits="userSpaceOnUse"' + (tf ? ' patternTransform="' + tf + '"' : '') + '>' + body + '</pattern>');
    return 'url(#' + id + ')';
  }
  function zoneKey(z) {
    var s = String(z == null ? '' : z).toLowerCase().normalize ? String(z == null ? '' : z).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : String(z).toLowerCase();
    var num = { '1': 'heladeria', '2': 'mansion', '3': 'trastienda', '4': 'noche', '5': 'cherry', '6': 'congelador' };
    if (num[s]) return num[s];
    if (/cherry|cereza/.test(s)) return 'cherry';
    if (/congela|freez|frio/.test(s)) return 'congelador';
    if (/mansion|pina|oficina/.test(s)) return 'mansion';
    if (/trastienda|callejon|bodega/.test(s)) return 'trastienda';
    if (/noche|calle|comisaria|lluvia|policia/.test(s)) return 'noche';
    return 'heladeria';
  }
  // Texto de neón (resplandor + tubo + núcleo claro). Fuente script con respaldos genéricos.
  function neonText(x, y, txt, size, col) {
    var t = '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="Yellowtail, Brush Script MT, Segoe Script, cursive" font-size="' + size + '" fill="none" stroke-linejoin="round"';
    return t + ' stroke="' + col + '" stroke-width="' + f(size * 0.22) + '" opacity=".22">' + txt + '</text>' +
      t + ' stroke="' + col + '" stroke-width="' + f(size * 0.09) + '" opacity=".85">' + txt + '</text>' +
      t + ' stroke="#fff4f9" stroke-width="' + f(size * 0.03) + '">' + txt + '</text>';
  }
  function background(zone) {
    var key = zoneKey(zone), ctx = newCtx(), out = '';
    var BG = {
      heladeria: function () {
        var cone = '<g opacity=".5"><path d="M20 22L26 40L32 22Z" fill="#f2b98a"/><circle cx="26" cy="19" r="7" fill="#fff"/></g><g opacity=".35"><path d="M60 62L66 80L72 62Z" fill="#f2b98a"/><circle cx="66" cy="59" r="7" fill="#c8f5e4"/></g>';
        var o = '<rect width="400" height="800" fill="#ffd3e3"/><rect width="400" height="800" fill="' + pattern(ctx, 80, 80, cone) + '"/>';
        o += '<rect width="400" height="800" fill="' + lg(ctx, [[0, '#ffffff', 0.35], [0.5, '#ffffff', 0], [1, '#ff9ec4', 0.25]], 0, 0, 0, 1) + '"/>';
        // lámparas colgantes
        [70, 200, 330].forEach(function (x) {
          o += '<path d="M' + x + ' 0V70" stroke="#c78aa5" stroke-width="2"/><ellipse cx="' + x + '" cy="104" rx="40" ry="16" fill="#fff6c8" opacity=".5"/><path d="M' + (x - 26) + ' 96Q' + x + ' 56 ' + (x + 26) + ' 96Z" fill="#bff3e1" stroke="#8fdcc4" stroke-width="3"/>';
        });
        // letrero de neón «Coco's Scoops»
        o += neonText(200, 250, "Coco's Scoops", 54, '#ff6fa5');
        o += '<g fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(200 300)"><path d="M-14 0L0 34L14 0M-16 0Q-18 -18 0 -20Q18 -18 16 0Z" stroke="#ff6fa5" stroke-width="10" opacity=".25"/><path d="M-14 0L0 34L14 0M-16 0Q-18 -18 0 -20Q18 -18 16 0Z" stroke="#fff0f6" stroke-width="3.5" opacity=".9"/></g>';
        // vitrina curva con charolas de helado
        o += '<rect y="610" width="400" height="190" fill="#bff3e1"/><rect y="600" width="400" height="16" fill="#fff6ea"/>';
        o += '<g fill="none" stroke="#8fdcc4" stroke-width="4">' + [20, 120, 220, 320].map(function (x) { return '<rect x="' + x + '" y="640" width="60" height="130" rx="8"/>'; }).join('') + '</g>';
        o += '<path d="M10 600V540Q10 500 60 496H340Q390 500 390 540V600Z" fill="#e8f8ff" opacity=".55" stroke="#ffffff" stroke-width="4"/>';
        var tubs = ['#a6e34f', '#ff7a8f', '#ffc48e', '#fff0a0', '#b77ae6', '#ffab55'];
        tubs.forEach(function (c, i) {
          var x = 28 + i * 58;
          o += '<path d="M' + x + ' 590V566Q' + (x + 24) + ' 548 ' + (x + 48) + ' 566V590Z" fill="' + c + '" opacity=".85"/><rect x="' + (x - 2) + '" y="586" width="52" height="10" rx="3" fill="#ffffff" opacity=".8"/>';
        });
        o += '<path d="M30 520Q120 506 200 508" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7" fill="none"/>';
        return o;
      },
      trastienda: function () {
        var o = '<rect width="400" height="800" fill="' + lg(ctx, [[0, '#3a3f58'], [1, '#262a3e']], 0, 0, 0, 1) + '"/>';
        o += '<ellipse cx="300" cy="420" rx="260" ry="320" fill="' + rg(ctx, [[0, '#6fd0ff', 0.45], [1, '#6fd0ff', 0]], 0.5, 0.5, 0.5) + '"/>';
        // estanterías de acero con cajas del «inventario»
        [140, 330, 520, 710].forEach(function (y, i) {
          o += '<rect x="0" y="' + y + '" width="400" height="10" fill="#7f8aa6" opacity=".7"/>';
          for (var k = 0; k < 4; k++) {
            var x = 20 + k * 95 + (i % 2) * 30, w = 50 + ((k + i) % 3) * 10, h = 40 + ((k * 7 + i) % 3) * 16;
            o += '<rect x="' + x + '" y="' + (y - h) + '" width="' + w + '" height="' + h + '" fill="#a98058" opacity=".55"/><path d="M' + x + ' ' + (y - h + 10) + 'h' + w + 'M' + (x + w / 2) + ' ' + (y - h) + 'v10" stroke="#7a5a3a" stroke-width="3" opacity=".5"/>';
            if ((k + i) % 3 === 1) o += '<g opacity=".45" transform="translate(' + (x + w / 2) + ' ' + (y - h / 2 + 4) + ')"><circle r="9" fill="none" stroke="#d61f4b" stroke-width="2"/><circle cx="-1" cy="2" r="4" fill="#d61f4b"/><path d="M-1 -2Q0 -6 4 -7" stroke="#d61f4b" stroke-width="1.6" fill="none"/></g>';
          }
        });
        o += '<path d="M20 0V800M380 0V800" stroke="#7f8aa6" stroke-width="10" opacity=".6"/>';
        // rendija de luz azul del congelador
        o += '<rect x="372" y="200" width="6" height="420" fill="#8fe4ff" opacity=".35"/><rect x="360" y="200" width="30" height="420" fill="#4ad0ff" opacity=".08"/>';
        o += '<rect width="400" height="800" fill="#1a2a50" opacity=".2"/>';
        return o;
      },
      mansion: function () {
        var o = '<rect width="400" height="800" fill="' + lg(ctx, [[0, '#5a2c1c'], [1, '#341810']], 0, 0, 0, 1) + '"/>';
        o += '<rect width="400" height="800" fill="' + pattern(ctx, 100, 200, '<rect x="10" y="20" width="80" height="160" rx="6" fill="none" stroke="#7a4028" stroke-width="5"/><rect x="18" y="28" width="64" height="144" rx="4" fill="#4a2416" opacity=".5"/><path d="M14 24h72" stroke="#c99a3a" stroke-width="1.5" opacity=".5"/>') + '"/>';
        // cortinas vino y moldura dorada
        o += '<path d="M0 0H70Q60 300 90 800H0Z" fill="#7a1a36" opacity=".8"/><path d="M400 0H330Q340 300 310 800H400Z" fill="#7a1a36" opacity=".8"/>';
        o += '<rect y="0" width="400" height="18" fill="#c99a3a" opacity=".7"/><rect y="640" width="400" height="10" fill="#c99a3a" opacity=".6"/>';
        // cuadro dorado y candelabro
        o += '<rect x="130" y="250" width="140" height="170" rx="6" fill="#4a2416" stroke="#e0b44a" stroke-width="10" opacity=".75"/><circle cx="200" cy="320" r="34" fill="#f2b632" opacity=".4"/><path d="M178 296L188 270L200 290L212 270L222 296Z" fill="#2f9a3a" opacity=".45"/>';
        o += '<path d="M200 0V60" stroke="#e0b44a" stroke-width="3"/><path d="M150 86Q200 120 250 86" fill="none" stroke="#e0b44a" stroke-width="5" opacity=".8"/>';
        o += [150, 175, 200, 225, 250].map(function (x) { return '<circle cx="' + x + '" cy="' + (x === 200 ? 100 : 92) + '" r="5" fill="#fff3b0" opacity=".85"/>'; }).join('');
        o += '<ellipse cx="200" cy="96" rx="120" ry="60" fill="#ffd27a" opacity=".12"/>';
        o += '<rect y="650" width="400" height="150" fill="#2a120a" opacity=".6"/>';
        // escritorio con copa de helado y vaso de whisky
        o += '<path d="M40 600H360L350 640H50Z" fill="#3a1a10" opacity=".85"/><rect x="60" y="640" width="280" height="110" fill="#2e140c" opacity=".8"/><path d="M40 600H360" stroke="#e0b44a" stroke-width="3" opacity=".6"/>';
        o += '<g opacity=".55"><path d="M250 600L246 578H266L262 600Z" fill="#ffd27a"/><path d="M130 600h20M140 600v-14M126 586Q140 596 154 586Z" stroke="#e0b44a" stroke-width="3" fill="#ff9ec4"/><circle cx="140" cy="578" r="9" fill="#ff9ec4"/></g>';
        return o;
      },
      cherry: function () {
        var o = '<rect width="400" height="800" fill="#1e0f1c"/>';
        o += '<rect width="400" height="800" fill="' + pattern(ctx, 60, 60, '<rect width="30" height="60" fill="#ff6fa5" opacity=".14"/>', 'rotate(30)') + '"/>';
        var ch = '<g opacity=".35"><circle cx="30" cy="40" r="9" fill="#d61f4b"/><path d="M30 31Q32 18 42 14" fill="none" stroke="#3fae4a" stroke-width="2.4"/><path d="M38 16q8-4 10 2q-6 3-10-2z" fill="#3fae4a"/></g><path d="M80 90c-4-6 2-10 6-6c4-4 10 0 6 6l-6 6z" fill="#ff6fa5" opacity=".3"/>';
        o += '<rect width="400" height="800" fill="' + pattern(ctx, 120, 120, ch) + '"/>';
        o += '<ellipse cx="200" cy="300" rx="260" ry="300" fill="' + rg(ctx, [[0, '#ff6fa5', 0.35], [1, '#ff6fa5', 0]], 0.5, 0.5, 0.5) + '"/>';
        o += sparkle(60, 120, 8, '#ffc93c') + sparkle(340, 220, 10, '#ffc93c') + sparkle(90, 520, 7, '#ffc93c') + sparkle(320, 640, 9, '#ffc93c');
        o += '<rect y="740" width="400" height="60" fill="#ff6fa5" opacity=".18"/>';
        return o;
      },
      noche: function () {
        var o = '<rect width="400" height="800" fill="' + lg(ctx, [[0, '#141a3a'], [0.6, '#2a1f4a'], [1, '#3a2050']], 0, 0, 0, 1) + '"/>';
        // luces de patrulla (comisaría) muy suaves
        o += '<ellipse cx="0" cy="120" rx="200" ry="160" fill="' + rg(ctx, [[0, '#ff3b5c', 0.35], [1, '#ff3b5c', 0]], 0.5, 0.5, 0.5) + '"/>';
        o += '<ellipse cx="400" cy="160" rx="200" ry="160" fill="' + rg(ctx, [[0, '#3b8bff', 0.35], [1, '#3b8bff', 0]], 0.5, 0.5, 0.5) + '"/>';
        // edificios
        o += '<path d="M0 300H60V220H120V270H170V180H240V250H290V200H350V260H400V800H0Z" fill="#20193a"/>';
        var wins = '';
        for (var y = 240; y < 400; y += 40) for (var x = 15; x < 400; x += 45) if ((x * 7 + y) % 3 === 0) wins += '<rect x="' + x + '" y="' + y + '" width="14" height="18" fill="#ffd27a" opacity=".25"/>';
        o += wins;
        // fachada de ladrillo
        var brick = '<rect width="40" height="20" fill="#5a2230"/><path d="M0 0.5H40M0 10.5H40M20 0V10M0 10V20M40 10V20" stroke="#3a1420" stroke-width="1.4"/>';
        o += '<rect x="30" y="380" width="340" height="340" fill="' + pattern(ctx, 40, 20, brick) + '" opacity=".85"/>';
        // letrero con neón
        o += '<rect x="56" y="392" width="288" height="78" rx="14" fill="#1a1028" stroke="#ff6fa5" stroke-width="3" opacity=".9"/>';
        o += neonText(200, 446, "Coco's Scoops", 44, '#ff6fa5');
        // toldo a rayas rosa y blanco
        var aw = '';
        for (var k = 0; k < 8; k++) aw += '<path d="M' + (30 + k * 42.5) + ' 488H' + (51 + k * 42.5) + 'L' + (49 + k * 42.5) + ' 528H' + (28 + k * 42.5) + 'Z" fill="#fff0f6" opacity=".8"/>';
        o += '<path d="M24 488H376L372 528H28Z" fill="#ff8fbe" opacity=".8"/>' + aw;
        o += '<path d="M28 528' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (k) { return 'q21 16 42.5 0'; }).join('') + 'V528Z" fill="#ff8fbe" opacity=".8"/>';
        // vitrina iluminada y puerta
        o += '<rect x="56" y="560" width="190" height="130" rx="6" fill="#ffb6d0" opacity=".28"/><rect x="270" y="556" width="74" height="164" rx="6" fill="#1a1028" opacity=".7"/>';
        o += '<path d="M70 640Q100 600 140 610" stroke="#fff" stroke-width="5" opacity=".2" fill="none" stroke-linecap="round"/>';
        // banqueta, charcos y lluvia
        o += '<rect y="720" width="400" height="80" fill="#151030"/><ellipse cx="160" cy="762" rx="130" ry="12" fill="#ff6fa5" opacity=".2"/><ellipse cx="330" cy="782" rx="60" ry="7" fill="#3b8bff" opacity=".2"/>';
        var rain = '<path d="M10 0l-6 22M50 40l-6 22M30 80l-6 22" stroke="#9fd6f5" stroke-width="1.6" opacity=".35"/>';
        o += '<rect width="400" height="800" fill="' + pattern(ctx, 60, 110, rain) + '"/>';
        return o;
      },
      congelador: function () {
        var o = '<rect width="400" height="800" fill="' + lg(ctx, [[0, '#d8f2ff'], [0.6, '#9fd6f5'], [1, '#6fb6e6']], 0, 0, 0, 1) + '"/>';
        o += '<rect width="400" height="800" fill="' + pattern(ctx, 100, 100, '<rect x="2" y="2" width="96" height="96" rx="6" fill="none" stroke="#ffffff" stroke-width="2" opacity=".5"/><circle cx="8" cy="8" r="2" fill="#7fb0d0" opacity=".6"/><circle cx="92" cy="8" r="2" fill="#7fb0d0" opacity=".6"/>') + '"/>';
        // carámbanos
        var ic = 'M0 0';
        for (var x = 0; x <= 400; x += 25) ic += 'L' + (x + 8) + ' ' + (18 + (x * 13 % 30)) + 'L' + (x + 16) + ' 4L' + (x + 25) + ' 0';
        o += '<path d="' + ic + 'V0Z" fill="#ffffff" opacity=".85"/>';
        o += '<ellipse cx="200" cy="120" rx="240" ry="160" fill="' + rg(ctx, [[0, '#4ad0ff', 0.4], [1, '#4ad0ff', 0]], 0.5, 0.5, 0.5) + '"/>';
        o += flake(70, 260, 30, 4, '#fff', 0.5) + flake(330, 420, 40, 5, '#fff', 0.45) + flake(110, 620, 24, 3, '#fff', 0.5) + flake(300, 150, 18, 3, '#fff', 0.5);
        o += '<path d="M0 700Q100 670 200 700T400 690V800H0Z" fill="#f4fbff" opacity=".9"/>';
        return o;
      }
    };
    out = BG[key]();
    return wrap(ctx, 400, 800, out, ' preserveAspectRatio="xMidYMid slice"');
  }

  // ---------- registro ----------
  var api = {
    tile: tile, copa: copa, token: token, frost: frost, ice: ice, crate: crate, friend: friend, freezer: freezer,
    icon: icon, logo: logo, background: background,
    iconNames: Object.keys(ICONS),
    zones: ['heladeria', 'mansion', 'trastienda', 'noche', 'cherry', 'congelador']
  };
  var Art = Cocardo.Art || (Cocardo.Art = {});
  Object.keys(api).forEach(function (k) { if (!(k in Art)) Art[k] = api[k]; });
  if (typeof module !== 'undefined' && module.exports) module.exports = Art;
})();
