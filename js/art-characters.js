/* Cocardo: ¡Rescate Helado! — Retratos de personajes en SVG (cadenas, sin DOM).
 * Contrato: docs/ARQUITECTURA.md §8. Aspecto, nombres y ropa: docs/PERSONAJES.md (manda).
 * Añade Cocardo.Art.characters y Cocardo.Art.portrait(id, mood, opts) sin pisar otras claves.
 * Cada retrato: viewBox 0 0 200 200, busto (cabeza y hombros), fondo transparente,
 * ids de degradados/recortes únicos por llamada (sufijo contador). */
(function () {
  'use strict';

  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  var INK = '#2b1630';
  var NS = 'xmlns="http://www.w3.org/2000/svg"';
  var SW = 5;      // contorno exterior (2.5 % del tamaño)
  var GOLD = '#ffc93c';
  var uid = 0;

  // ---------- utilidades ----------
  function f(n) { return Math.round(n * 10) / 10; }
  function pt(p) { return f(p[0]) + ' ' + f(p[1]); }
  function ip(x, y) { return Math.round(x) + ' ' + Math.round(y); }
  function newCtx(o) {
    uid = (uid + 1) % 1e9;
    return { id: 'cp' + uid.toString(36), n: 0, defs: [], frozen: !!o.frozen && !o.silhouette, sil: !!o.silhouette };
  }
  function gid(c) { c.n++; return c.id + '_' + c.n; }
  function stopsStr(s) {
    return s.map(function (q) {
      return '<stop offset="' + q[0] + '" stop-color="' + q[1] + '"' + (q[2] != null ? ' stop-opacity="' + q[2] + '"' : '') + '/>';
    }).join('');
  }
  function rg(c, s, cx, cy, r, fx, fy) {
    var id = gid(c);
    c.defs.push('<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' +
      (fx != null ? ' fx="' + fx + '" fy="' + fy + '"' : '') + '>' + stopsStr(s) + '</radialGradient>');
    return 'url(#' + id + ')';
  }
  function lg(c, s, x1, y1, x2, y2) {
    var id = gid(c);
    c.defs.push('<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' + stopsStr(s) + '</linearGradient>');
    return 'url(#' + id + ')';
  }
  function clipD(c, d) {
    var id = gid(c);
    c.defs.push('<clipPath id="' + id + '"><path d="' + d + '"/></clipPath>');
    return 'url(#' + id + ')';
  }
  function P(d, fill, sw, extra) {
    return '<path d="' + d + '" fill="' + (fill || 'none') + '"' +
      (sw ? ' stroke="' + INK + '" stroke-width="' + sw + '"' : '') + (extra || '') + '/>';
  }
  function S(d, col, w, extra) { return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (extra || '') + '/>'; }
  function C(x, y, r, fill, sw, extra) {
    return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(r) + '" fill="' + fill + '"' +
      (sw ? ' stroke="' + INK + '" stroke-width="' + sw + '"' : '') + (extra || '') + '/>';
  }
  function E(x, y, rx, ry, fill, sw, extra) {
    return '<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + fill + '"' +
      (sw ? ' stroke="' + INK + '" stroke-width="' + sw + '"' : '') + (extra || '') + '/>';
  }
  function G(tf, body, extra) { return '<g' + (tf ? ' transform="' + tf + '"' : '') + (extra || '') + '>' + body + '</g>'; }
  function op(o) { return ' opacity="' + o + '"'; }
  // Ruta simétrica respecto a x=100: s0 = [dx,y] inicial, segs = [dx,y] (línea) o [c1dx,c1y,c2dx,c2y,dx,y] (curva)
  function sym(s0, segs) {
    var cx = 100, d = 'M' + f(cx + s0[0]) + ' ' + f(s0[1]), pts = [s0], i, s, prev;
    for (i = 0; i < segs.length; i++) {
      s = segs[i];
      if (s.length === 2) { d += 'L' + f(cx + s[0]) + ' ' + f(s[1]); pts.push(s); } else {
        d += 'C' + f(cx + s[0]) + ' ' + f(s[1]) + ' ' + f(cx + s[2]) + ' ' + f(s[3]) + ' ' + f(cx + s[4]) + ' ' + f(s[5]);
        pts.push([s[4], s[5]]);
      }
    }
    var last = pts[pts.length - 1];
    d += 'L' + f(cx - last[0]) + ' ' + f(last[1]);
    for (i = segs.length - 1; i >= 0; i--) {
      s = segs[i]; prev = pts[i];
      if (s.length === 2) d += 'L' + f(cx - prev[0]) + ' ' + f(prev[1]);
      else d += 'C' + f(cx - s[2]) + ' ' + f(s[3]) + ' ' + f(cx - s[0]) + ' ' + f(s[1]) + ' ' + f(cx - prev[0]) + ' ' + f(prev[1]);
    }
    return d + 'Z';
  }
  // Curva suave cerrada (Catmull-Rom) por puntos
  function smooth(pts, open) {
    var n = pts.length, d = 'M' + pt(pts[0]), last = open ? n - 1 : n;
    for (var i = 0; i < last; i++) {
      var p0 = pts[open ? Math.max(i - 1, 0) : (i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      var p3 = pts[open ? Math.min(i + 2, n - 1) : (i + 2) % n];
      d += 'C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
        f(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + pt(p2);
    }
    return d + (open ? '' : 'Z');
  }
  // Generador pseudoaleatorio fijo (mismo dibujo en cada llamada)
  function prng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Puntos (trazos de longitud cero con punta redonda) => textura muy compacta
  function dots(list) { return list.map(function (q) { return 'M' + f(q[0]) + ' ' + f(q[1]) + 'h.1'; }).join(''); }

  // ---------- piezas comunes ----------
  function gloss(x, y, rx, ry, rot, o) {
    return E(0, 0, rx, ry, '#fff', 0, op(o == null ? 0.55 : o)).replace('<ellipse', '<ellipse transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + rot + ')"');
  }
  function leaf(x, y, len, rot, fill, sw) {
    var w = len * 0.4;
    return G('translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(rot) + ')',
      P('M0 0C' + f(len * 0.25) + ' ' + f(-w) + ' ' + f(len * 0.72) + ' ' + f(-w) + ' ' + f(len) + ' 0C' + f(len * 0.72) + ' ' + f(w) + ' ' + f(len * 0.25) + ' ' + f(w) + ' 0 0Z', fill, sw || 2.4) +
      S('M' + f(len * 0.12) + ' 0L' + f(len * 0.78) + ' 0', INK, 1.2, op(0.35)));
  }
  function blossom(cx, cy, r) {
    var s = '';
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      s += C(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.5, '#fffdf6');
    }
    return G('', s, ' stroke="' + INK + '" stroke-width="' + f(Math.max(1.2, r * 0.2)) + '"') + C(cx, cy, r * 0.32, '#ffd23c');
  }
  function hoop(x, y, r) {
    return C(x, y, r, 'none', 0, ' stroke="' + INK + '" stroke-width="4.6"') + C(x, y, r, 'none', 0, ' stroke="' + GOLD + '" stroke-width="2.4"') +
      S('M' + f(x - r * 0.7) + ' ' + f(y - r * 0.5) + 'q' + f(r * 0.3) + ' ' + f(-r * 0.4) + ' ' + f(r * 0.7) + ' ' + f(-r * 0.45), '#fff7d0', 1.2);
  }
  function chain(d, w) { return S(d, INK, (w || 2) + 1.8) + S(d, GOLD, w || 2); }
  function coin(x, y, r) { return C(x, y, r, GOLD, 1.6) + C(x - r * 0.3, y - r * 0.3, r * 0.3, '#fff6c8'); }
  function sparkle(x, y, r, col) {
    var q = r * 0.28;
    return P('M' + f(x) + ' ' + f(y - r) + 'Q' + f(x + q) + ' ' + f(y - q) + ' ' + f(x + r) + ' ' + f(y) + 'Q' + f(x + q) + ' ' + f(y + q) + ' ' + f(x) + ' ' + f(y + r) +
      'Q' + f(x - q) + ' ' + f(y + q) + ' ' + f(x - r) + ' ' + f(y) + 'Q' + f(x - q) + ' ' + f(y - q) + ' ' + f(x) + ' ' + f(y - r) + 'Z', col || '#fff', 1.4);
  }
  function drop(x, y, s, rot, col) {
    return G('translate(' + f(x) + ' ' + f(y) + ') rotate(' + (rot || 0) + ') scale(' + s + ')',
      P('M0 -10C3 -4 7 0 7 5A7 7 0 0 1 -7 5C-7 0 -3 -4 0 -10Z', col || '#8fdcff', 2.2) + E(-2.4, 4, 1.8, 2.6, '#fff', 0, op(0.85)));
  }
  function heart(x, y, s, col) {
    return G('translate(' + f(x) + ' ' + f(y) + ') scale(' + s + ')',
      P('M0 9C-10 2 -12 -4 -8 -8C-5 -11 -1 -9 0 -6C1 -9 5 -11 8 -8C12 -4 10 2 0 9Z', col || '#ff4f8a', 2.2) + E(-5, -5, 2, 1.4, '#fff', 0, op(0.8)));
  }
  function skinG(c, p) { return rg(c, [[0, p.light], [0.55, p.skin], [1, p.dark]], 0.42, 0.34, 0.72); }
  function hairG(c, p) { return rg(c, [[0, p.hairL], [0.55, p.hair], [1, p.hairD]], 0.45, 0.3, 0.75); }

  // ---------- ojo: elipse recortada por párpados (cálculo exacto con arcos) ----------
  function lineCut(cx, cy, rx, ry, yl, yr) {
    var k = (yr - yl) / (2 * rx), d = (yl + yr) / 2 - cy;
    var A = 1 / (rx * rx) + k * k / (ry * ry), B = 2 * k * d / (ry * ry), Cc = d * d / (ry * ry) - 1;
    var D = B * B - 4 * A * Cc;
    if (D <= 0) return null;
    var s = Math.sqrt(D), u1 = (-B - s) / (2 * A), u2 = (-B + s) / (2 * A);
    return { a: [cx + u1, cy + d + k * u1], b: [cx + u2, cy + d + k * u2], d: d };
  }
  function aperture(cx, cy, rx, ry, top, bot, curve) {
    var T = top && lineCut(cx, cy, rx, ry, top[0], top[1]);
    var B = bot && lineCut(cx, cy, rx, ry, bot[0], bot[1]);
    var a = 'A' + f(rx) + ' ' + f(ry) + ' 0 ', L = [cx - rx, cy], R = [cx + rx, cy], d, up;
    var lidC = T ? 'Q' + f((T.a[0] + T.b[0]) / 2) + ' ' + f((T.a[1] + T.b[1]) / 2 - ry * (curve == null ? 0.3 : curve)) + ' ' + pt(T.b) : '';
    if (T && B) d = 'M' + pt(T.a) + lidC + a + '0 1 ' + pt(B.b) + 'L' + pt(B.a) + a + '0 1 ' + pt(T.a) + 'Z';
    else if (T) d = 'M' + pt(T.a) + lidC + a + (T.d < 0 ? 1 : 0) + ' 1 ' + pt(T.a) + 'Z';
    else if (B) d = 'M' + pt(B.b) + 'L' + pt(B.a) + a + (B.d > 0 ? 1 : 0) + ' 1 ' + pt(B.b) + 'Z';
    else d = 'M' + pt(L) + a + '0 1 ' + pt(R) + a + '0 1 ' + pt(L) + 'Z';
    if (T) { up = 'M' + pt(T.a) + lidC; L = T.a; R = T.b; } else if (B && B.d < 0) { up = 'M' + pt(B.a) + a + '0 1 ' + pt(B.b); L = B.a; R = B.b; } else up = 'M' + pt(L) + a + '0 1 ' + pt(R);
    return { d: d, up: up, L: L, R: R };
  }

  // ---------- estados de ánimo ----------
  // e: ojos {lid:[interior, exterior] (fracción cubierta desde arriba), bot, s (escala), pupil, iris, look:[dx,dy], closed:'up'|'down'}
  // eR: ojo derecho (del espectador) si difiere. b: cejas [dy interior, dy exterior, arco] (o [izq, der]). m: boca. x: extras.
  var MOODS = ['normal', 'feliz', 'triste', 'enojado', 'asustado', 'sorprendido', 'burlon', 'nervioso', 'furioso', 'carcajada', 'llorando', 'coqueta'];
  var MS = {
    normal: { e: { lid: [0.1, 0.1] }, b: [0, 0, 0], m: null, x: [] },
    feliz: { e: { lid: [0.04, 0.04], bot: 0.3, hl: 1.25 }, b: [-4, -2, 1], m: 'grin', x: ['spark'] },
    triste: { e: { lid: [0.2, 0.48], look: [0, 2.5] }, b: [-7, 3, -1], m: 'frown', x: ['tear'] },
    enojado: { e: { lid: [0.48, 0.16], curve: 0.08 }, b: [7, -3, -1], m: 'grit', x: [] },
    asustado: { e: { s: 1.12, pupil: 0.55, iris: 0.7, look: [0, -1] }, b: [-9, -3, 0], m: 'scream', x: ['shock', 'sweat', 'shiver'] },
    sorprendido: { e: { s: 1.16, pupil: 0.8, iris: 0.85 }, b: [-11, -8, 2], m: 'o', x: ['pop'] },
    burlon: { e: { lid: [0.44, 0.4], look: [-2.5, 1], curve: 0.12 }, b: [[3, 2, 0], [-7, -6, 2]], m: 'smirk', x: [] },
    nervioso: { e: { lid: [0.1, 0.14], look: [3.5, 0.5], pupil: 0.85 }, b: [-5, 2, 0], m: 'nervous', x: ['sweat'] },
    furioso: { e: { lid: [0.55, 0.12], pupil: 0.6, bot: 0.08, curve: 0.04 }, b: [9, -5, -2], m: 'shout', x: ['steam', 'vein'], tint: 1 },
    carcajada: { e: { closed: 'up' }, b: [-6, -4, 2], m: 'laugh', x: ['lol'] },
    llorando: { e: { closed: 'down' }, b: [-9, 4, -1], m: 'cry', x: ['streams'] },
    coqueta: { e: { lid: [0.16, 0.16] }, eR: { closed: 'up' }, b: [[-2, -1, 1], [-4, -3, 2]], m: 'smile', x: ['heart'] }
  };
  var EVIL = { burlon: 1, enojado: 1, furioso: 1 };

  // ---------- rasgos de la cara ----------
  // F: { x, ey, ex, er:[rx,ry], iris, lash:0|1|2, lidc (color de párpado), brow, bw, bg, arch, my, mw, lips, mouth, nose, ny, blush, blushOp }
  function eye(c, F, M, side, irisFill) {
    var st = (side > 0 && M.eR) ? M.eR : M.e;
    if (c.frozen) st = { s: 1.06 };
    var s = st.s || 1, rx = F.er[0] * s, ry = F.er[1] * s, cx = F.x + side * F.ex, cy = F.ey, out = '', d;
    var lw = F.lash ? 3.8 : 3.2;
    if (st.closed) {
      var oy = st.closed === 'up' ? 2 : -2;
      d = 'M' + f(cx - rx) + ' ' + f(cy + oy) + 'Q' + f(cx) + ' ' + f(st.closed === 'up' ? cy - ry * 1.1 : cy + ry * 0.95) + ' ' + f(cx + rx) + ' ' + f(cy + oy);
      out += S(d, INK, 4);
      if (F.lash) {
        var ox = cx + side * rx, dy = st.closed === 'up' ? -3.6 : 3.4;
        out += S('M' + f(ox) + ' ' + f(cy + oy) + 'l' + f(side * 5) + ' ' + dy + 'M' + f(ox - side * 3.4) + ' ' + f(cy + oy + (st.closed === 'up' ? -4.2 : 3.6)) + 'l' + f(side * 3.6) + ' ' + f(dy * 1.1), INK, 2.4);
      }
      return out;
    }
    var lid = st.lid || [0, 0], add = F.lidAdd || 0;
    var li = lid[0] + add, lo = lid[1] + add;
    var yIn = cy - ry + 2 * ry * li, yOut = cy - ry + 2 * ry * lo;
    var top = (li > 0 || lo > 0) ? (side > 0 ? [yIn, yOut] : [yOut, yIn]) : null;
    var bot = st.bot ? [cy + ry - 2 * ry * st.bot, cy + ry - 2 * ry * st.bot] : null;
    var ap = aperture(cx, cy, rx, ry, top, bot, st.curve);
    var glow = F.glow && EVIL[M.name] && !c.frozen;
    if (glow) out += E(cx, cy, rx * 1.7, ry * 1.5, rg(c, [[0, '#ff3a3a', 0.75], [1, '#ff0000', 0]], 0.5, 0.5, 0.5));
    var inner = E(cx, cy, rx, ry, c.frozen ? '#f2fbff' : '#fff') + E(cx, cy - ry * 0.95, rx * 1.3, ry * 0.62, c.frozen ? '#bfe3f7' : '#d3c9e6', 0, op(0.6));
    if (!c.frozen) {
      var look = st.look || [0, 0], ir = ry * 0.68 * (st.iris || 1), ix = cx + look[0], iy = cy + ry * 0.08 + look[1];
      inner += C(ix, iy, ir, glow ? F.glowFill : irisFill) + C(ix, iy, ir * 0.5 * (st.pupil || 1), '#1a0c14') +
        C(ix - ir * 0.36, iy - ir * 0.4, ir * 0.36 * (st.hl || 1), '#fff') + C(ix + ir * 0.38, iy + ir * 0.36, ir * 0.16, '#fff', 0, op(0.9));
    } else {
      inner += E(cx - rx * 0.3, cy - ry * 0.35, rx * 0.28, ry * 0.18, '#fff');
    }
    out += G('', inner, ' clip-path="' + clipD(c, ap.d) + '"') + P(ap.d, 'none', 2.2) + S(ap.up, INK, lw);
    var O = side > 0 ? ap.R : ap.L;
    if (F.lash === 2) out += P('M' + pt(O) + 'l' + f(side * 9) + ' -6.5l' + f(-side * 6) + ' 5Z', INK, 1.4);
    if (F.lash) out += S('M' + pt(O) + 'l' + f(side * 5.2) + ' -3.4M' + f(O[0] - side * 3.4) + ' ' + f(O[1] - 3.2) + 'l' + f(side * 3.8) + ' -4.2', INK, 2.4);
    return out;
  }
  function brow(F, M, side) {
    var bm = Array.isArray(M.b[0]) ? M.b[side > 0 ? 1 : 0] : M.b;
    var rx = F.er[0], cx = F.x + side * F.ex, by = F.ey - F.er[1] - (F.bg || 8);
    var xi = cx - side * rx * 0.72, xo = cx + side * rx * 1.12;
    var yi = by + bm[0] + (F.bin || 0), yo = by + bm[1] + 2.5, t = F.bw || 4.4;
    var a = (F.arch == null ? 3 : F.arch) + (bm[2] || 0) * 1.5;
    var mx = (xi + xo) / 2, my = (yi + yo) / 2 - a;
    var d = 'M' + f(xi) + ' ' + f(yi - t / 2) + 'Q' + f(mx) + ' ' + f(my - t * 0.55) + ' ' + f(xo) + ' ' + f(yo) +
      'Q' + f(mx) + ' ' + f(my + t * 0.45) + ' ' + f(xi) + ' ' + f(yi + t / 2) + 'Z';
    return P(d, F.brow, 0, ' stroke="' + F.brow + '" stroke-width="1.6"');
  }
  function nose(F) {
    var x = F.x, y = F.ny, t = F.nose, sk = F.nosec || 'rgba(60,20,30,.35)';
    if (t === 'none') return '';
    if (t === 'broad' || t === 'strong' || t === 'bulb') {
      var w = t === 'broad' ? 12 : (t === 'bulb' ? 10 : 8.5);
      return P('M' + f(x - w * 0.55) + ' ' + f(y - 12) + 'Q' + f(x - w * 0.6) + ' ' + f(y - 3) + ' ' + f(x - w) + ' ' + f(y + 1) + 'Q' + f(x - w - 2) + ' ' + f(y + 7) + ' ' + f(x - w * 0.45) + ' ' + f(y + 7) +
        'Q' + f(x) + ' ' + f(y + 10) + ' ' + f(x + w * 0.45) + ' ' + f(y + 7) + 'Q' + f(x + w + 2) + ' ' + f(y + 7) + ' ' + f(x + w) + ' ' + f(y + 1), 'none', 0, ' stroke="' + sk + '" stroke-width="2.8"') +
        E(x - w * 0.4, y + 4.6, 2.2, 1.4, sk) + E(x + w * 0.4, y + 4.6, 2.2, 1.4, sk) + E(x - 1, y - 2, w * 0.3, 2.4, '#fff', 0, op(0.4));
    }
    return S('M' + f(x - 3.6) + ' ' + f(y + 0.5) + 'Q' + f(x) + ' ' + f(y + 3.4) + ' ' + f(x + 3.6) + ' ' + f(y + 0.5), sk, 2.6) + C(x - 1, y - 3, 1.5, '#fff', 0, op(0.55));
  }
  function lipsShape(x, y, w, cl, cr, h, col, mid) {
    var d = 'M' + f(x - w) + ' ' + f(y + cl) + 'Q' + f(x - w * 0.5) + ' ' + f(y - 5) + ' ' + f(x) + ' ' + f(y - 2.4) + 'Q' + f(x + w * 0.5) + ' ' + f(y - 5) + ' ' + f(x + w) + ' ' + f(y + cr) +
      'Q' + f(x + w * 0.45) + ' ' + f(y + h + 2) + ' ' + f(x) + ' ' + f(y + h + 1) + 'Q' + f(x - w * 0.45) + ' ' + f(y + h + 2) + ' ' + f(x - w) + ' ' + f(y + cl) + 'Z';
    return P(d, col, 2) + S('M' + f(x - w) + ' ' + f(y + cl) + 'Q' + f(x) + ' ' + f(y + mid) + ' ' + f(x + w) + ' ' + f(y + cr), INK, 2) +
      E(x - w * 0.22, y + h - 1.2, w * 0.24, 1.5, '#fff', 0, op(0.65));
  }
  function mouth(c, F, kind) {
    var x = F.mx || F.x, y = F.my, w = F.mw, L = F.lips, out = '', d, inner = '';
    var DK = '#4a0f22', TG = '#ff6f8a';
    function open(dd, inn) {
      var cl = clipD(c, dd);
      return P(dd, DK, L ? 6.4 : 2.8) + G('', inn, ' clip-path="' + cl + '"') + S(dd, L || INK, L ? 3.2 : 2.8);
    }
    function teethBand(d2, mids) {
      var cl = clipD(c, d2);
      return P(d2, '#fff', 0) + G('', mids, ' clip-path="' + cl + '"') + S(d2, INK, 2.6);
    }
    switch (kind) {
      case 'smile':
        if (L) return lipsShape(x, y, w, -3.2, -3.2, 6, L, 3.2);
        return S('M' + f(x - w) + ' ' + f(y - 3) + 'Q' + f(x) + ' ' + f(y + 7) + ' ' + f(x + w) + ' ' + f(y - 3), INK, 3) +
          S('M' + f(x - w - 2) + ' ' + f(y - 5) + 'l2.4 2.4M' + f(x + w + 2) + ' ' + f(y - 5) + 'l-2.4 2.4', INK, 2.4);
      case 'smirk':
        if (L) return lipsShape(x, y, w, 1.5, -6, 5.5, L, 1.8);
        return S('M' + f(x - w * 0.8) + ' ' + f(y + 1) + 'Q' + f(x + w * 0.25) + ' ' + f(y + 5) + ' ' + f(x + w) + ' ' + f(y - 6), INK, 3) +
          S('M' + f(x + w + 1) + ' ' + f(y - 9) + 'q2 3 0 6', INK, 2.2);
      case 'frown':
        if (L) return lipsShape(x, y, w * 0.9, 4, 4, 5, L, -0.6);
        return S('M' + f(x - w * 0.8) + ' ' + f(y + 4) + 'Q' + f(x) + ' ' + f(y - 4) + ' ' + f(x + w * 0.8) + ' ' + f(y + 4), INK, 3);
      case 'flat':
        if (L) return lipsShape(x, y, w * 0.85, 0.5, 0.5, 5, L, 1.5);
        return S('M' + f(x - w * 0.8) + ' ' + f(y + 1) + 'Q' + f(x) + ' ' + f(y - 1) + ' ' + f(x + w * 0.8) + ' ' + f(y + 1), INK, 3.2);
      case 'teeth':
        d = 'M' + f(x - w) + ' ' + f(y - 4) + 'Q' + f(x) + ' ' + f(y + 2) + ' ' + f(x + w) + ' ' + f(y - 4) + 'C' + f(x + w * 0.85) + ' ' + f(y + 10) + ' ' + f(x + w * 0.4) + ' ' + f(y + 14) + ' ' + f(x) + ' ' + f(y + 14) +
          'C' + f(x - w * 0.4) + ' ' + f(y + 14) + ' ' + f(x - w * 0.85) + ' ' + f(y + 10) + ' ' + f(x - w) + ' ' + f(y - 4) + 'Z';
        out = teethBand(d, S('M' + f(x - w) + ' ' + f(y + 2) + 'Q' + f(x) + ' ' + f(y + 9) + ' ' + f(x + w) + ' ' + f(y + 2) + 'M' + f(x - 7) + ' ' + f(y - 4) + 'v20M' + f(x) + ' ' + f(y - 4) + 'v20M' + f(x + 7) + ' ' + f(y - 4) + 'v20', '#c9b9c4', 1.4));
        return out + S('M' + f(x - w - 2) + ' ' + f(y - 8) + 'q-3 5 1 9M' + f(x + w + 2) + ' ' + f(y - 8) + 'q3 5 -1 9', INK, 2.2);
      case 'grit':
        d = 'M' + f(x - w * 0.9) + ' ' + f(y + 3) + 'Q' + f(x) + ' ' + f(y - 4) + ' ' + f(x + w * 0.9) + ' ' + f(y + 3) + 'L' + f(x + w * 0.8) + ' ' + f(y + 11) + 'Q' + f(x) + ' ' + f(y + 6) + ' ' + f(x - w * 0.8) + ' ' + f(y + 11) + 'Z';
        return teethBand(d, S('M' + f(x - w) + ' ' + f(y + 6.5) + 'Q' + f(x) + ' ' + f(y + 1.5) + ' ' + f(x + w) + ' ' + f(y + 6.5) + 'M' + f(x - 6) + ' ' + f(y - 4) + 'v20M' + f(x) + ' ' + f(y - 4) + 'v20M' + f(x + 6) + ' ' + f(y - 4) + 'v20', '#b9a9b4', 1.4));
      case 'nervous':
        d = 'M' + f(x - w) + ' ' + f(y + 1) + 'Q' + f(x) + ' ' + f(y - 3) + ' ' + f(x + w) + ' ' + f(y + 1) + 'L' + f(x + w * 0.95) + ' ' + f(y + 10) + 'Q' + f(x) + ' ' + f(y + 7) + ' ' + f(x - w * 0.95) + ' ' + f(y + 10) + 'Z';
        var z = 'M' + f(x - w) + ' ' + f(y + 5.5);
        for (var i = 1; i <= 8; i++) z += 'L' + f(x - w + i * w / 4) + ' ' + f(y + (i % 2 ? 3.2 : 6.2));
        return teethBand(d, S(z, '#9a8a96', 1.5));
      case 'grin':
        d = 'M' + f(x - w) + ' ' + f(y - 3) + 'Q' + f(x) + ' ' + f(y + 3) + ' ' + f(x + w) + ' ' + f(y - 3) + 'C' + f(x + w * 0.9) + ' ' + f(y + 12) + ' ' + f(x + w * 0.45) + ' ' + f(y + 17) + ' ' + f(x) + ' ' + f(y + 17) +
          'C' + f(x - w * 0.45) + ' ' + f(y + 17) + ' ' + f(x - w * 0.9) + ' ' + f(y + 12) + ' ' + f(x - w) + ' ' + f(y - 3) + 'Z';
        inner = P('M' + f(x - w) + ' ' + f(y - 6) + 'H' + f(x + w) + 'V' + f(y + 4) + 'Q' + f(x) + ' ' + f(y + 7) + ' ' + f(x - w) + ' ' + f(y + 4) + 'Z', '#fff') + E(x, y + 17, w * 0.55, 6, TG);
        return open(d, inner);
      case 'laugh':
        var w2 = w * 1.25;
        d = 'M' + f(x - w2) + ' ' + f(y - 5) + 'Q' + f(x) + ' ' + f(y + 1) + ' ' + f(x + w2) + ' ' + f(y - 5) + 'C' + f(x + w2) + ' ' + f(y + 16) + ' ' + f(x + w2 * 0.5) + ' ' + f(y + 27) + ' ' + f(x) + ' ' + f(y + 27) +
          'C' + f(x - w2 * 0.5) + ' ' + f(y + 27) + ' ' + f(x - w2) + ' ' + f(y + 16) + ' ' + f(x - w2) + ' ' + f(y - 5) + 'Z';
        inner = P('M' + f(x - w2) + ' ' + f(y - 8) + 'H' + f(x + w2) + 'V' + f(y + 3) + 'Q' + f(x) + ' ' + f(y + 7) + ' ' + f(x - w2) + ' ' + f(y + 3) + 'Z', '#fff') + E(x, y + 27, w2 * 0.55, 9, TG);
        return open(d, inner);
      case 'o':
        var orx = w * 0.42, ory = w * 0.56;
        d = 'M' + f(x - orx) + ' ' + f(y + 5) + 'A' + f(orx) + ' ' + f(ory) + ' 0 0 1 ' + f(x + orx) + ' ' + f(y + 5) + 'A' + f(orx) + ' ' + f(ory) + ' 0 0 1 ' + f(x - orx) + ' ' + f(y + 5) + 'Z';
        return open(d, E(x, y + 5 + ory, orx * 0.8, ory * 0.45, TG));
      case 'scream':
        d = 'M' + f(x - w * 0.7) + ' ' + f(y + 1) + 'Q' + f(x - w * 0.35) + ' ' + f(y - 3) + ' ' + f(x) + ' ' + f(y) + 'Q' + f(x + w * 0.35) + ' ' + f(y - 3) + ' ' + f(x + w * 0.7) + ' ' + f(y + 1) +
          'C' + f(x + w * 0.9) + ' ' + f(y + 12) + ' ' + f(x + w * 0.5) + ' ' + f(y + 21) + ' ' + f(x) + ' ' + f(y + 21) + 'C' + f(x - w * 0.5) + ' ' + f(y + 21) + ' ' + f(x - w * 0.9) + ' ' + f(y + 12) + ' ' + f(x - w * 0.7) + ' ' + f(y + 1) + 'Z';
        inner = P('M' + f(x - w) + ' ' + f(y - 4) + 'H' + f(x + w) + 'V' + f(y + 3.5) + 'H' + f(x - w) + 'Z', '#fff') + E(x, y + 21, w * 0.45, 5, TG);
        return open(d, inner);
      case 'shout':
        d = 'M' + f(x - w * 1.05) + ' ' + f(y - 3) + 'Q' + f(x) + ' ' + f(y - 7) + ' ' + f(x + w * 1.05) + ' ' + f(y - 3) + 'C' + f(x + w * 0.95) + ' ' + f(y + 12) + ' ' + f(x + w * 0.5) + ' ' + f(y + 22) + ' ' + f(x) + ' ' + f(y + 22) +
          'C' + f(x - w * 0.5) + ' ' + f(y + 22) + ' ' + f(x - w * 0.95) + ' ' + f(y + 12) + ' ' + f(x - w * 1.05) + ' ' + f(y - 3) + 'Z';
        inner = P('M' + f(x - w * 1.1) + ' ' + f(y - 9) + 'H' + f(x + w * 1.1) + 'V' + f(y + 2) + 'H' + f(x - w * 1.1) + 'Z', '#fff') + E(x, y + 22, w * 0.6, 7, TG) +
          P('M' + f(x - w * 0.6) + ' ' + f(y + 24) + 'L' + f(x - w * 0.5) + ' ' + f(y + 16) + 'H' + f(x + w * 0.5) + 'L' + f(x + w * 0.6) + ' ' + f(y + 24) + 'Z', '#fff');
        return open(d, inner);
      case 'cry':
        d = 'M' + f(x - w * 0.85) + ' ' + f(y + 8) + 'C' + f(x - w * 0.6) + ' ' + f(y - 3) + ' ' + f(x + w * 0.6) + ' ' + f(y - 3) + ' ' + f(x + w * 0.85) + ' ' + f(y + 8) +
          'C' + f(x + w * 0.6) + ' ' + f(y + 15) + ' ' + f(x - w * 0.6) + ' ' + f(y + 15) + ' ' + f(x - w * 0.85) + ' ' + f(y + 8) + 'Z';
        inner = P('M' + f(x - w) + ' ' + f(y - 4) + 'H' + f(x + w) + 'V' + f(y + 2) + 'H' + f(x - w) + 'Z', '#fff') + E(x, y + 14, w * 0.45, 4.5, TG);
        return open(d, inner);
    }
    return mouth(c, F, 'smile');
  }
  // Devuelve las partes de la cara para que cada personaje las ordene a su gusto
  function faceParts(c, F, M) {
    var irisFill = rg(c, [[0, F.irisL || '#fff2c0'], [0.45, F.iris], [1, F.irisD || INK]], 0.5, 0.42, 0.62);
    var b = M.name === 'feliz' || M.name === 'coqueta' || M.name === 'carcajada' ? 0.65 : (F.blushOp || 0.42);
    var o = { tint: '', blush: '', eyes: '', brows: '', nose: nose(F), mouth: '' };
    if (M.tint && F.tintPath && !c.frozen) o.tint = P(F.tintPath, lg(c, [[0, '#ff1a2a', 0.55], [0.7, '#ff1a2a', 0.2], [1, '#ff1a2a', 0.08]], 0, 0, 0, 1));
    if (F.blush) {
      var by = F.ey + F.er[1] + (F.blushDy || 7), bx = F.ex + (F.blushDx || 5);
      o.blush = E(F.x - bx, by, 9, 5, F.blush, 0, op(b)) + E(F.x + bx, by, 9, 5, F.blush, 0, op(b));
    }
    if (!F.noEyes) o.eyes = eye(c, F, M, -1, irisFill) + eye(c, F, M, 1, irisFill);
    o.brows = brow(F, M, -1) + brow(F, M, 1);
    o.mouth = F.noMouth ? '' : mouth(c, F, M.m || F.mouth || 'smile');
    return o;
  }
  function faceAll(c, F, M) {
    var o = faceParts(c, F, M);
    return o.tint + o.blush + o.nose + o.mouth + o.eyes + o.brows;
  }

  // ---------- extras de ánimo (sudor, lágrimas, vapor…) ----------
  // H: { cx, cy, rx, ry (elipse de la cabeza), t (tope), chin, sh (hombros) }
  function onHead(H, deg, k) {
    var a = deg * Math.PI / 180;
    return [Math.max(10, Math.min(190, H.cx + Math.cos(a) * H.rx * k)), Math.max(10, H.cy + Math.sin(a) * H.ry * k)];
  }
  function puff(x, y, s) {
    var cs = [[0, 0, 8], [s * 9, -6, 7], [s * 3, -13, 5.5]], a = '', b = '';
    cs.forEach(function (q) { a += C(x + q[0], y + q[1], q[2], '#f6f3fa', 2.4); b += C(x + q[0], y + q[1], q[2] - 1.2, '#f6f3fa'); });
    return a + b + S('M' + f(x - s * 4) + ' ' + f(y + 12) + 'q' + f(s * 3) + ' -4 0 -8', INK, 2, op(0.6));
  }
  function extras(c, F, H, M) {
    var out = '', x = F.x, ey = F.ey, ex = F.ex, rx = F.er[0], ry = F.er[1];
    (M.x || []).forEach(function (k) {
      var p, q, i, sd;
      if (k === 'sweat') { p = onHead(H, -24, 0.97); out += drop(p[0], p[1], 0.95, 10) + drop(Math.min(p[0] + 9, 191), p[1] + 19, 0.6, 16); }
      if (k === 'tear') out += drop(x - ex - rx * 0.55, ey + ry + 7, 0.62, 0);
      if (k === 'streams') {
        for (sd = -1; sd <= 1; sd += 2) {
          var sx = x + sd * (ex + rx * 0.25), sy = ey + 3;
          var d = 'M' + f(sx) + ' ' + f(sy) + 'C' + f(sx + sd * 3) + ' ' + f(sy + 14) + ' ' + f(sx - sd * 2) + ' ' + f(sy + 26) + ' ' + f(sx + sd * 2) + ' ' + f(sy + 40) + 'S' + f(sx + sd * 6) + ' ' + f(sy + 56) + ' ' + f(sx + sd * 3) + ' ' + f(sy + 64);
          out += S(d, INK, 10.5, op(0.8)) + S(d, '#7fd3ff', 7) + S(d, '#fff', 1.8, ' transform="translate(' + (-sd * 1.6) + ' 0)" opacity=".8"');
        }
      }
      if (k === 'lol') {
        for (sd = -1; sd <= 1; sd += 2) {
          out += drop(x + sd * (ex + rx + 6), ey - 5, 0.55, sd * -55) + drop(x + sd * (ex + rx + 13), ey + 4, 0.4, sd * -75);
        }
        out += S('M' + f(H.cx - H.rx - 4) + ' ' + f(H.cy - 6) + 'q-6 8 0 16M' + f(H.cx + H.rx + 4) + ' ' + f(H.cy - 6) + 'q6 8 0 16', INK, 2.6, op(0.7));
      }
      if (k === 'shock') {
        var y1 = H.t + 12, y2 = ey - ry - 16;
        if (y2 - y1 > 6) out += S('M' + (x - 14) + ' ' + y1 + 'V' + f(y2) + 'M' + x + ' ' + (y1 - 3) + 'V' + f(y2 - 2) + 'M' + (x + 14) + ' ' + y1 + 'V' + f(y2), '#4b3fc4', 3, op(0.5));
      }
      if (k === 'shiver') {
        for (sd = -1; sd <= 1; sd += 2) {
          q = Math.max(6, Math.min(194, H.cx + sd * (H.rx + 5)));
          out += S('M' + f(q) + ' ' + f(H.cy - 10) + 'q' + (sd * 5) + ' 8 0 16M' + f(q + sd * 6) + ' ' + f(H.cy - 6) + 'q' + (sd * 4) + ' 6 0 12', INK, 2.4, op(0.75));
        }
      }
      if (k === 'pop') {
        var d2 = '';
        [-152, -136, -120, -60, -44, -28].forEach(function (a) { var p1 = onHead(H, a, 1.08), p2 = onHead(H, a, 1.24); d2 += 'M' + pt(p1) + 'L' + pt(p2); });
        out += S(d2, INK, 3.2);
      }
      if (k === 'spark') { p = onHead(H, -38, 1.04); q = onHead(H, -146, 1.02); out += sparkle(p[0], p[1], 9, '#ffe066') + sparkle(q[0], q[1], 6, '#fff3a0'); }
      if (k === 'heart') { p = onHead(H, -30, 0.98); out += heart(p[0], p[1], 0.95) + sparkle(p[0] - 14, p[1] - 10, 4.5, '#fff'); }
      if (k === 'steam') { p = onHead(H, -150, 0.93); q = onHead(H, -30, 0.93); out += puff(p[0], p[1], -1) + puff(q[0], q[1], 1); }
      if (k === 'vein') {
        p = [x + ex + 4, Math.max(H.t + 16, ey - ry - 26)];
        out += G('translate(' + pt(p) + ')', S('M-7 -2Q-2 -2 -2 -7M2 -7Q2 -2 7 -2M7 2Q2 2 2 7M-2 7Q-2 2 -7 2', '#fff', 6) + S('M-7 -2Q-2 -2 -2 -7M2 -7Q2 -2 7 -2M7 2Q2 2 2 7M-2 7Q-2 2 -7 2', '#e01e3a', 3));
      }
    });
    return out;
  }

  // ---------- congelado / silueta ----------
  function frostFX(c, H) {
    var out = '', i, a, p, b = '';
    for (i = 0; i < 7; i++) {
      a = -158 + i * 22.6;
      p = onHead(H, a, 0.97);
      b += '<ellipse transform="translate(' + pt(p) + ') rotate(' + f(a + 90) + ')" rx="' + (i % 2 ? 12 : 14) + '" ry="7" fill="#f6fcff"/>';
    }
    out += G('', b, ' stroke="#7fb8e0" stroke-width="1.6"');
    var ice = '', list = [[H.cx - 15, H.chin - 3, 12], [H.cx - 2, H.chin, 18], [H.cx + 12, H.chin - 3, 11],
      [44, H.sh + 2, 11], [56, H.sh - 2, 15], [144, H.sh - 2, 14], [157, H.sh + 2, 10]];
    p = onHead(H, 180, 0.98); list.push([p[0] + 4, p[1], 14]);
    p = onHead(H, 0, 0.98); list.push([p[0] - 4, p[1], 12]);
    list.forEach(function (q) { ice += 'M' + f(q[0] - 4) + ' ' + f(q[1]) + 'L' + f(q[0]) + ' ' + f(q[1] + q[2]) + 'L' + f(q[0] + 4) + ' ' + f(q[1]) + 'Z'; });
    out += P(ice, lg(c, [[0, '#ffffff'], [1, '#9fdcff']], 0, 0, 0, 1), 1.6, ' stroke-opacity=".75"');
    out += sparkle(30, 42, 7) + sparkle(174, 70, 9) + sparkle(164, 150, 6) + sparkle(40, 140, 5);
    return out;
  }
  function frozenFilter(c) {
    var id = gid(c);
    c.defs.push('<filter id="' + id + '" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.42 0.22 0.06 0 0.15 0.165 0.55 0.083 0 0.21 0.15 0.275 0.275 0 0.42 0 0 0 1 0"/></filter>');
    return 'url(#' + id + ')';
  }
  function silFilter(c) {
    var id = gid(c);
    c.defs.push('<filter id="' + id + '" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">' +
      '<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0.13 0 0 0 0 0.24 0 0 0 0 0.4 0 0 0 1 0" result="a"/>' +
      '<feMorphology in="SourceAlpha" operator="erode" radius="3.5" result="e"/>' +
      '<feComposite in="SourceAlpha" in2="e" operator="out" result="r"/>' +
      '<feFlood flood-color="#8fd3ff" flood-opacity=".6"/><feComposite in2="r" operator="in" result="rc"/>' +
      '<feMerge><feMergeNode in="a"/><feMergeNode in="rc"/></feMerge></filter>');
    return 'url(#' + id + ')';
  }
  function question(H) {
    var d = 'M-8 -10C-8 -20 8 -20 8 -10C8 -3 0 -3 0 5';
    return G('translate(' + f(H.cx) + ' ' + f(H.cy + 8) + ') scale(1.7)', S(d, INK, 10) + S(d, '#cdeeff', 6) + C(0, 14, 4.2, '#cdeeff', 2.4));
  }

  // ---------- cuerpos ----------
  // Hombros de mujer (piel) + cuello; `top` = prenda encima
  function womanBody(c, p, top) {
    var sk = rg(c, [[0, p.bodyL || p.skin], [0.6, p.skin], [1, p.dark]], 0.5, 0.15, 0.95);
    var o = P(sym([0, 154], [[14, 154], [26, 154, 42, 155, 52, 161], [60, 166, 64, 178, 64, 206]]), sk, SW);
    o += P('M86 112H114V160H86Z', sk) + S('M86 112V157M114 112V157', INK, SW);
    o += P('M86 126Q100 150 114 126V138Q100 158 86 138Z', p.dark, 0, op(0.4));
    o += S('M68 167q11 4 19 1M132 167q-11 4 -19 1', INK, 1.8, op(0.3));
    return o + (top || '');
  }
  // Prenda con escote (U) y mangas cortas
  function teeTop(c, col, colD, rib, depth) {
    var dp = depth || 172;
    var d = sym([0, dp], [[13, dp, 22, dp - 6, 24, 157], [34, 157, 48, 158, 56, 163], [64, 168, 67, 180, 67, 206]]);
    var o = P(d, lg(c, [[0, col], [1, colD]], 0, 0, 0, 1), SW);
    if (rib) {
      var l = '';
      for (var x = 40; x <= 160; x += 6) l += 'M' + x + ' 150V206';
      o += G('', S(l, rib, 1.3), ' clip-path="' + clipD(c, d) + '"');
    }
    return o + S('M52 167Q47 184 47 206M148 167Q153 184 153 206', colD, 2.2) +
      S('M77 160C81 ' + (dp - 2) + ' 90 ' + (dp + 3) + ' 100 ' + (dp + 3) + 'C110 ' + (dp + 3) + ' 119 ' + (dp - 2) + ' 123 160', colD, 2.4, op(0.8));
  }
  // Top sin mangas: kind 'tank' | 'v' | 'heart' (escote corazón); tirantes finos
  function tankTop(c, col, colD, kind, rib, strapW) {
    var sw2 = strapW || 6, d;
    if (kind === 'v') d = sym([0, 190], [[22, 160], [22, 154], [22 + sw2, 154], [30 + sw2, 166, 42, 173, 54, 175], [58, 177], [60, 206]]);
    else if (kind === 'heart') d = sym([0, 180], [[3, 172, 10, 167, 18, 167], [26, 167, 30, 170, 33, 172], [26, 160], [26 + sw2, 158], [34 + sw2, 168, 44, 173, 54, 175], [58, 177], [60, 206]]);
    else d = sym([0, 180], [[10, 180, 18, 174, 21, 164], [22, 154], [22 + sw2, 154], [31 + sw2, 165, 42, 172, 54, 175], [58, 177], [60, 206]]);
    var o = P(d, lg(c, [[0, col], [1, colD]], 0, 0, 0, 1), SW);
    if (rib) {
      var l = '';
      for (var x = 42; x <= 158; x += 5) l += 'M' + x + ' 150V206';
      o += G('', S(l, rib, 1.2), ' clip-path="' + clipD(c, d) + '"');
    }
    if (kind === 'heart') o += S('M100 182V206M95 188l10 5M95 193l10 -5M95 199l10 5', colD, 1.6);
    return o;
  }
  function necklace(layers) {
    var o = chain('M87 148Q100 166 113 148', 1.8);
    if (layers > 1) o += chain('M82 154Q100 184 118 154', 1.8) + coin(100, 169, 3.6) + coin(90.5, 165, 2.4) + coin(109.5, 165, 2.4);
    else o += P('M100 157l3 4l-3 4l-3 -4Z', GOLD, 1.4);
    return o;
  }

  // Cara de mujer (compartida por las víctimas)
  var FACE_W = sym([0, 50], [[26, 50, 43, 69, 43, 95], [43, 121, 22, 141.5, 0, 142]]);
  var H_W = { cx: 100, cy: 92, rx: 64, ry: 68, t: 24, chin: 142, sh: 166 };
  function wF(p, extra) {
    var F = { x: 100, ey: 99, ex: 20, er: [11.5, 13], iris: p.iris, irisL: p.irisL, lash: 1, brow: p.brow, bw: 4.4, bg: 8, arch: 3,
      my: 125, mw: 11, lips: p.lips, mouth: 'smile', nose: 'small', ny: 114, nosec: p.nosec || 'rgba(110,30,40,.4)', blush: p.blush, blushOp: 0.45, tintPath: FACE_W };
    for (var k in extra) F[k] = extra[k];
    return F;
  }

  // ---------- paletas ----------
  var PAL = {
    lima: { skin: '#a6e34f', light: '#e6fca6', dark: '#5aa323', hair: '#3f9b2c', hairL: '#7fd04a', hairD: '#1f6616',
      iris: '#e09a18', irisL: '#ffe28a', brow: '#256a1a', lips: '#2f7a22', blush: '#ffb07a' },
    cereza: { bodyL: '#f0364f', skin: '#e01e43', light: '#ff8fa0', dark: '#7d0a24', hairG: '#1f5a32', hairGL: '#3d8a52', hairB: '#7a1638', hairBL: '#b03a5e',
      iris: '#f0a020', irisL: '#ffe7a0', brow: '#5a0c1c', lips: '#5e0a24', blush: '#ff6f8f' },
    banana: { skin: '#fff0a0', light: '#fffbe2', dark: '#e3b93c', hair: '#ffd23c', hairL: '#fff3c4', hairD: '#c89412',
      iris: '#7d8b2a', irisL: '#dfe88a', brow: '#7d6a2a', lips: '#ff4f93', blush: '#ff9ab5' },
    fresa: { skin: '#ff4256', light: '#ffa0a8', dark: '#b3122f', hair: '#3daa45', hairL: '#86dc5e', hairD: '#1d7a2c',
      iris: '#2fa84f', irisL: '#b8f0a0', brow: '#1f7a2e', lips: '#b80d3a', blush: '#ffb3c0' },
    durazna: { skin: '#ffc48e', light: '#fff0d8', dark: '#f0835a', hair: '#24573a', hairL: '#3f8a5e', hairD: '#103020',
      iris: '#2e9a52', irisL: '#b0f0b0', brow: '#1a4428', lips: '#b85a86', blush: '#ff4f5e' },
    uva: { skin: '#9b4fd6', light: '#dcb0ff', dark: '#4a1878', hair: '#466454', hairL: '#7a9a86', hairD: '#22362a',
      iris: '#7a4a26', irisL: '#e0b080', brow: '#2c3a30', lips: '#f2a6e0', blush: '#ff9ae8' },
    naranja: { skin: '#ff9f45', light: '#ffd8a6', dark: '#e0661a', hair: '#ff8a1a', hairL: '#ffc25a', hairD: '#b84c04',
      iris: '#8f9a36', irisL: '#e6ec9a', brow: '#a8521a', lips: '#ff6a52', blush: '#ff5a4a' }
  };

  // ---------- Cocardo ----------
  var HEAD_COCO = sym([0, 12], [[38, 12, 67, 30, 67, 66], [67, 104, 55, 136, 32, 150], [20, 156, 8, 157, 0, 157]]);
  var FACE_COCO = sym([0, 58], [[30, 58, 51, 76, 51, 104], [51, 132, 30, 153, 0, 153]]);
  var COCO_TEX = (function () {
    var r = prng(11), dk = '', lt = '', mer = '', fr = '', stub = '', i, a, k, x, y;
    function inFace(x, y, k) { var u = (x - 100) / (52 * k), v = (y - 105) / (49 * k); return u * u + v * v < 1; }
    // pelusa del borde
    for (i = 0; i < 60; i++) {
      a = (-208 + i * 236 / 59 + (r() - 0.5) * 3) * Math.PI / 180;
      var k1 = 0.95, k2 = 1.02 + r() * 0.08, tw = (r() - 0.5) * 0.9;
      var x1 = 100 + Math.cos(a) * 67 * k1, y1 = 84 + Math.sin(a) * 72 * k1;
      var x2 = 100 + Math.cos(a + tw * 0.12) * 67 * k2, y2 = 84 + Math.sin(a + tw * 0.12) * 72 * k2;
      var sg = 'M' + ip(x1, y1) + 'Q' + ip((x1 + x2) / 2 + tw * 6, (y1 + y2) / 2 - tw * 3) + ' ' + ip(x2, y2);
      if (i % 3) dk += sg; else lt += sg;
    }
    // fibras a lo largo del coco (meridianos rotos)
    for (k = -5; k <= 5; k++) {
      var lam = k * 15 * Math.PI / 180, seg = '';
      for (var ph = 84; ph >= -30; ph -= 10) {
        var phr = ph * Math.PI / 180;
        x = 100 + 64 * Math.cos(phr) * Math.sin(lam) + (r() - 0.5) * 2; y = 82 - 68 * Math.sin(phr);
        if (inFace(x, y, 1.08) || y > 150) seg = ''; else { mer += (seg ? 'L' : 'M') + ip(x, y); seg = 1; }
      }
    }
    // flequillo de fibra alrededor de la cara
    for (i = 0; i < 34; i++) {
      a = (-200 + i * 220 / 33) * Math.PI / 180;
      var L = 5 + r() * 6, t2 = (r() - 0.5) * 0.5;
      x = 100 + Math.cos(a) * 50; y = 105 + Math.sin(a) * 47;
      fr += 'M' + ip(x, y) + 'l' + ip(Math.cos(a + t2) * L, Math.sin(a + t2) * L);
    }
    // barba de tres días hecha de fibra
    for (i = 0; i < 900 && stub.length < 1000; i++) {
      x = 52 + r() * 96; y = 108 + r() * 46;
      var u = (x - 100) / 50, v = (y - 105) / 47, rr = u * u + v * v;
      if (rr > 0.95 || rr < 0.5) continue;
      if (Math.abs(x - 100) < 22 && y < 148 && y > 120) continue;
      a = Math.PI / 2 + (x - 100) / 60 + (r() - 0.5) * 0.8;
      stub += 'M' + ip(x, y) + 'l' + f(Math.cos(a) * 2.6) + ' ' + f(Math.sin(a) * 2.6);
    }
    return { dk: dk, lt: lt, mer: mer, fr: fr, stub: stub };
  })();
  var COCO_JAW = 'M51 108C54 136 74 153 100 153C126 153 146 136 149 108C142 126 132 136 120 139C112 147 88 147 80 139C68 136 58 126 51 108Z';
  function cocoBadge(x, y, r) {
    return C(x, y, r, '#fff6ea', 2.2) + C(x, y, r - 2.8, 'none', 0, ' stroke="#8a5a32" stroke-width="2" stroke-dasharray="1.5 1.1"') +
      C(x - 3, y - 0.6, 2.5, '#ff7aa8', 0.8) + C(x + 3, y - 0.6, 2.5, '#ffd23c', 0.8) + C(x, y - 2.6, 2.7, '#36c6c0', 0.8) +
      P('M' + f(x - 5.6) + ' ' + f(y + 0.6) + 'A5.6 4.6 0 0 0 ' + f(x + 5.6) + ' ' + f(y + 0.6) + 'Z', '#7a4a26', 0.8) +
      S('M' + f(x + 5.4) + ' ' + f(y - 1) + 'q1 -3 -0.6 -6.4m0 0q-2.4 -0.6 -3.6 1m3.6 -1q2.4 -1 3.8 0.6', '#2f8a3a', 1.1);
  }
  function nameTag(x, y, txt) {
    var o = '<rect x="' + x + '" y="' + y + '" width="25" height="11" rx="2.2" fill="#fff" stroke="' + INK + '" stroke-width="1.6"/>', d = '';
    for (var i = 0; i < 4; i++) {
      var cx = x + 5 + i * 5;
      if (txt[i] === 'C') d += 'M' + f(cx + 1.7) + ' ' + f(y + 3.4) + 'A2 2.4 0 1 0 ' + f(cx + 1.7) + ' ' + f(y + 7.6);
      else d += 'M' + f(cx) + ' ' + f(y + 3) + 'a1.9 2.5 0 1 0 0.01 0Z';
    }
    return o + S(d, INK, 1.3);
  }
  function cocoBody(c) {
    var tee = lg(c, [[0, '#8a984c'], [1, '#56662a']], 0, 0, 0, 1), sk = lg(c, [[0, '#6a3c1e'], [0.5, '#93603a'], [1, '#6a3c1e']], 0, 0, 1, 0);
    var o = P(sym([0, 152], [[18, 152], [30, 152, 54, 154, 68, 160], [82, 166, 86, 182, 86, 206]]), tee, SW);
    o += S('M38 172Q32 188 32 206M162 172Q168 188 168 206', '#4a5824', 2.4);
    o += P('M82 118H118V162H82Z', sk) + S('M82 118V158M118 118V158', INK, SW);
    o += S('M84 150l3 -5M88 156l2 -6M114 150l-3 -5M110 156l-2 -6', '#3a1e0c', 1.6, op(0.7));
    o += P('M79 155C84 171 116 171 121 155L126 159C120 180 80 180 74 159Z', '#6c7c36', 2.6);
    var strap = 'M73 178L85 150M127 178L115 150';
    o += S(strap, INK, 9.5) + S(strap, '#f3ead6', 6);
    var bib = 'M69 178Q69 173 74 173H126Q131 173 131 178L137 206H63Z', st = '';
    o += P(bib, lg(c, [[0, '#fbf5e6'], [1, '#e2d8c0']], 0, 0, 0, 1), SW);
    for (var x = 75; x <= 125; x += 6.2) st += 'M' + f(x) + ' 175L' + f(x + (x - 100) * 0.2) + ' 206';
    o += S(st, '#b5ad9c', 1.2);
    return o + cocoBadge(87, 190, 12) + nameTag(108, 179, 'COCO');
  }
  function cocoJacket(c) {
    var cv = lg(c, [[0, '#f7f0dc'], [1, '#d6c9a8']], 0, 0, 0, 1), sk = lg(c, [[0, '#6a3c1e'], [0.5, '#93603a'], [1, '#6a3c1e']], 0, 0, 1, 0);
    var o = P(sym([0, 150], [[20, 150], [32, 150, 54, 154, 68, 160], [82, 166, 86, 182, 86, 206]]), cv, SW);
    o += P('M82 118H118V160H82Z', sk) + S('M82 118V156M118 118V156', INK, SW);
    o += P('M77 153C82 171 118 171 123 153L129 158C123 183 77 183 71 158Z', '#efe6cf', 2.8);
    // brazos cruzados atados
    o += P('M16 196C40 178 160 178 184 196V206H16Z', cv, 3.4) + S('M60 186q6 6 4 14M140 186q-6 6 -4 14M100 182v24', '#c4b48e', 2);
    var strap = 'M40 166L120 206M160 166L80 206';
    o += S(strap, INK, 10) + S(strap, '#c9b68a', 6.6);
    o += '<g fill="#d9dbe4" stroke="' + INK + '" stroke-width="1.8"><rect x="54" y="168" width="10" height="9" rx="1.5"/><rect x="136" y="168" width="10" height="9" rx="1.5"/><rect x="95" y="190" width="10" height="9" rx="1.5"/></g>';
    return o;
  }
  function muzzle() {
    var o = S('M38 122Q100 112 162 122', INK, 9.5) + S('M38 122Q100 112 162 122', '#5a3a22', 6);
    o += S('M100 112V54', INK, 9.5) + S('M100 112V54', '#5a3a22', 6);
    o += P('M75 113Q100 104 125 113L129 142Q100 159 71 142Z', '#6e4529', 3.2);
    o += S('M85 119V142M92.5 116V147M100 115V149M107.5 116V147M115 119V142', '#26130a', 2.8);
    o += G('', C(78, 117, 1.8, '#e0e2ea') + C(122, 117, 1.8, '#e0e2ea') + C(100, 62, 1.8, '#e0e2ea') + C(46, 121, 1.8, '#e0e2ea') + C(154, 121, 1.8, '#e0e2ea'), ' stroke="' + INK + '" stroke-width="1"');
    return o + gloss(90, 118, 7, 2, -8, 0.3);
  }

  var CH = {};
  CH.cocardo = {
    name: 'Cocardo', fruit: 'coco', color: '#7a4a2a', variants: ['carcel'],
    normal: { e: { lid: [0.16, 0.1] }, b: [[1, 0, 0], [-5, -5, 1.5]] },
    role: 'Dueño de Coco\'s Scoops. Congela frutas y las vende como helado.',
    F: { x: 100, ey: 96, ex: 23, er: [12.5, 13.5], iris: '#7a4520', irisL: '#e8b07a', irisD: '#2a1208', lash: 0, brow: '#1c0f08', bw: 9.5, bg: 7, arch: 3,
      my: 132, mw: 18, lips: null, mouth: 'teeth', nose: 'broad', ny: 117, nosec: '#4a2410', blush: '#d0603a', blushOp: 0.22, tintPath: HEAD_COCO },
    H: { cx: 100, cy: 84, rx: 67, ry: 72, t: 12, chin: 155, sh: 162 },
    draw: function (c, M, v, F) {
      var o = v === 'carcel' ? cocoJacket(c) : cocoBody(c);
      o += P(HEAD_COCO, rg(c, [[0, '#ab7442'], [0.55, '#7a4a26'], [1, '#42220e']], 0.45, 0.26, 0.8), SW);
      var mid = gid(c);
      c.defs.push('<path id="' + mid + '" d="' + COCO_TEX.mer + '"/>');
      o += '<use href="#' + mid + '" fill="none" stroke="#3a1e0c" stroke-width="1.7" stroke-dasharray="9 5" opacity=".5"/><use href="#' + mid + '" fill="none" stroke="#d6a070" stroke-width="1.1" stroke-dasharray="4 13" opacity=".55" transform="translate(2 1)"/>';
      o += S(COCO_TEX.dk, '#2e170a', 1.8) + S(COCO_TEX.lt, '#d29c66', 1.7);
      o += G('', E(86, 40, 6, 4.6, '#26120a') + E(114, 40, 6, 4.6, '#26120a') + E(100, 27, 5.6, 4.4, '#26120a'), ' stroke="#140804" stroke-width="1.4"') +
        C(84.5, 38.6, 1.4, '#7a5030') + C(112.5, 38.6, 1.4, '#7a5030') + C(98.6, 25.8, 1.3, '#7a5030');
      o += gloss(64, 40, 16, 7, -40, 0.22);
      o += S(COCO_TEX.fr, '#2e170a', 2.2, op(0.75));
      o += P(FACE_COCO, rg(c, [[0, '#ecbb8a'], [0.55, '#c4875a'], [1, '#9a5f36']], 0.5, 0.34, 0.7), 0, ' stroke="#4a2612" stroke-width="2.4" stroke-opacity=".55"');
      o += P(COCO_JAW, '#4a2612', 0, op(0.28)) + S(COCO_TEX.stub, '#3a1c0a', 1.3, op(0.55));
      var fp = faceParts(c, F, M);
      o += fp.tint + fp.blush + fp.nose + (v === 'carcel' ? muzzle() : fp.mouth) + fp.eyes + fp.brows;
      return o;
    }
  };

  // ---------- Lima ----------
  CH.lima = {
    name: 'Lima', fruit: 'lima', color: '#8fd63a',
    role: 'Novia y socia de Cocardo. Primera víctima del congelador viejo.',
    F: wF(PAL.lima, {}), H: H_W,
    draw: function (c, M, v, F) {
      var p = PAL.lima, hf = hairG(c, p), o = '';
      o += P(smooth([[100, 22], [134, 25], [160, 44], [171, 74], [166, 102], [175, 128], [167, 152], [176, 178], [156, 190], [100, 176], [44, 190], [24, 178], [33, 152], [25, 128], [34, 102], [29, 74], [40, 44], [66, 25]]), hf, SW);
      o += S('M40 84q-8 24 2 44q8 18 -2 38M160 84q8 24 -2 44q-8 18 2 38', p.hairD, 2.6, op(0.6));
      o += womanBody(c, p, teeTop(c, '#fbf3e2', '#ddd0b6', '#e8dcc4') + necklace(1));
      o += P(FACE_W, skinG(c, p), SW);
      o += '<path d="' + dots([[66, 118], [72, 126], [131, 120], [137, 112], [126, 128], [64, 108], [80, 136], [120, 136], [100, 60], [114, 64], [86, 64]]) + '" stroke="#f0fb9a" stroke-width="2.4" opacity=".85"/>';
      o += gloss(78, 72, 11, 5.5, -32, 0.45);
      o += faceAll(c, F, M);
      o += P('M57 104C51 72 64 44 88 38C116 30 148 46 145 100C139 80 126 66 106 66C97 66 90 62 86 55C80 64 70 73 64 86C61 93 59 98 57 104Z', hf, SW);
      o += S('M70 52q12 -9 26 -8M108 42q22 2 30 22', p.hairL, 3, op(0.9));
      var lockL = smooth([[58, 92], [48, 116], [52, 140], [43, 162], [49, 188], [57, 176], [57, 158], [61, 138], [57, 116]]);
      o += P(lockL, hf, 4) + P(lockL, hf, 4, ' transform="matrix(-1 0 0 1 200 0)"');
      o += hoop(58, 129, 6.5) + hoop(142, 129, 6.5);
      o += leaf(64, 46, 22, -150, '#5fc23a') + leaf(140, 50, 22, -28, '#5fc23a') + leaf(154, 94, 18, 20, '#5fc23a');
      o += C(78, 36, 6, '#c8f25c', 2.2) + C(76, 34, 1.8, '#fff', 0, op(0.8)) + C(156, 74, 5.4, '#c8f25c', 2.2) + C(154.4, 72.4, 1.6, '#fff', 0, op(0.8));
      o += blossom(96, 32, 6.4) + blossom(124, 40, 5.4) + blossom(42, 96, 5.4) + blossom(160, 118, 5) + blossom(52, 158, 4.6) + blossom(150, 168, 4.6);
      return o;
    }
  };

  // ---------- Cherry (Cereza) ----------
  var CHERRY_HAIR = smooth([[100, 24], [136, 28], [160, 50], [168, 82], [163, 114], [171, 146], [165, 186], [136, 192], [100, 172], [64, 192], [35, 186], [29, 146], [37, 114], [32, 82], [40, 50], [64, 28]]);
  function cherryStem() {
    var d = 'M100 38C97 26 99 13 114 4';
    return S(d, INK, 8.6) + S(d, '#6f9a2a', 5) + S('M98.6 30C98 22 100 15 106 10', '#b8d86a', 1.6, op(0.8)) + leaf(112, 6, 26, 14, '#3fae4a');
  }
  function cherryBody(c, v) {
    var p = PAL.cereza, top;
    if (v === 'huida') {
      top = teeTop(c, '#ffffff', '#dcd6e0', null, 176);
      top += S('M33 182q4 -4 8 0t8 0M151 182q4 -4 8 0t8 0', '#c8c0d0', 2) + S('M34 186q3 3 6 0t6 0t6 0M148 186q3 3 6 0t6 0t6 0', '#d8d0e0', 1.6);
    } else top = tankTop(c, '#2a2230', '#141018', 'tank', '#3a3042', 5);
    return womanBody(c, p, top + necklace(2));
  }
  function hat(c) {
    var w = lg(c, [[0, '#ffffff'], [1, '#e6dfd2']], 0, 0, 0, 1);
    return P('M14 64C14 46 186 46 186 64C186 76 14 76 14 64Z', w, SW) +
      P('M60 60C58 26 76 14 100 14C124 14 142 26 140 60C122 66 78 66 60 60Z', w, SW) +
      P('M61 52C80 58 120 58 139 52L140 60C122 66 78 66 60 60Z', '#2a2230', 2.2) + gloss(80, 30, 12, 5, -20, 0.6);
  }
  function sunglasses() {
    var lens = 'M62 88C62 80 94 80 94 88L92 104C90 113 66 113 64 104Z';
    return S('M94 92Q100 88 106 92', INK, 4) + P(lens, '#141018', 3) + P(lens, '#141018', 3, ' transform="matrix(-1 0 0 1 200 0)"') +
      S('M68 88l10 0M122 88l10 0', '#6a6a80', 2.4, op(0.8)) + S('M70 100l14 -8M130 100l14 -8', '#fff', 1.6, op(0.35)) + S('M62 90L57 94M138 90L143 94', INK, 4);
  }
  CH.cereza = {
    name: 'Cherry', fruit: 'cereza', color: '#d61f4b', variants: ['huida'],
    role: 'Clienta convertida en socia. Quiere un imperio helado… y no comparte.',
    F: wF(PAL.cereza, { lash: 2, arch: 4.5, mouth: 'smirk', glow: true, bw: 4.6 }), H: H_W,
    draw: function (c, M, v, F) {
      var p = PAL.cereza, o = '', cl = clipD(c, CHERRY_HAIR), bands = '';
      for (var j = 0; j < 5; j++) {
        for (var sd = -1; sd <= 1; sd += 2) {
          if ((j + (sd > 0 ? 1 : 0)) % 2) continue;
          bands += smooth([[100 + sd * (4 + j * 9), 24], [100 + sd * (22 + j * 9), 52], [100 + sd * (32 + j * 9), 100], [100 + sd * (30 + j * 10), 150], [100 + sd * (36 + j * 10), 200]], true);
        }
      }
      o += P(CHERRY_HAIR, rg(c, [[0, p.hairBL], [0.6, p.hairB], [1, '#4a0a20']], 0.5, 0.3, 0.8)) + G('', S(bands, p.hairG, 10), ' clip-path="' + cl + '"') + P(CHERRY_HAIR, 'none', SW);
      o += cherryBody(c, v);
      o += P(FACE_W, rg(c, [[0, p.light], [0.5, p.skin], [1, p.dark]], 0.4, 0.3, 0.75), SW);
      o += gloss(78, 70, 13, 6.5, -32, 0.75) + gloss(128, 122, 6, 3, -40, 0.45) + C(70, 66, 2.6, '#fff');
      if (v === 'huida') { F.noEyes = true; }
      o += faceAll(c, F, M);
      if (v === 'huida') o += sunglasses();
      var lo = 'M100 30C72 26 50 44 50 80C50 106 46 128 40 152C38 166 42 180 48 192C56 180 58 164 58 148C60 128 60 108 60 92C62 70 76 52 100 44Z';
      var li = 'M100 36C84 40 70 52 64 70C60 84 60 100 57 118C64 106 66 92 68 80C72 64 84 52 100 46Z';
      var gG = rg(c, [[0, p.hairGL], [1, p.hairG]], 0.3, 0.2, 0.9), gB = rg(c, [[0, p.hairBL], [1, p.hairB]], 0.3, 0.2, 0.9);
      o += P(lo, gB, 4) + P(li, gG, 3) + P(lo, gG, 4, ' transform="matrix(-1 0 0 1 200 0)"') + P(li, gB, 3, ' transform="matrix(-1 0 0 1 200 0)"');
      o += S('M58 64q-6 20 -6 44M142 64q6 20 6 44', '#fff', 2, op(0.25));
      o += hoop(57, 128, 4.6) + hoop(143, 128, 4.6);
      if (v === 'huida') o += hat(c);
      o += cherryStem();
      return o;
    }
  };

  // ---------- Don Piña ----------
  var PINA_HEAD = sym([0, 42], [[30, 42, 56, 60, 56, 94], [56, 124, 50, 146, 30, 154], [18, 158, 6, 158, 0, 158]]);
  var PINA_TEX = (function () {
    var l = '', d = [], a, b;
    for (a = -100; a <= 200; a += 17) l += 'M' + a + ' 30l130 130';
    for (b = 0; b <= 300; b += 17) l += 'M' + b + ' 30l-130 130';
    for (a = -100; a <= 200; a += 17) {
      for (b = 0; b <= 300; b += 17) {
        var x = (a + b) / 2 + 8.5, y = (b - a) / 2 + 30;
        var u = (x - 100) / 54, v = (y - 100) / 57;
        if (u * u + v * v < 1) d.push([x, y]);
      }
    }
    return { l: l, d: dots(d) };
  })();
  function pinaCrown(c) {
    var o = '', dk = lg(c, [[0, '#1f6a28'], [1, '#2f8a34']], 0, 0, 1, 0), lt = lg(c, [[0, '#4cbf4a'], [1, '#2f9a3a']], 0, 0, 1, 0);
    function lf(a, L, w, fill) {
      return G('translate(100 54) rotate(' + a + ')', P('M' + (-w) + ' 0Q' + f(-w * 0.9) + ' ' + f(-L * 0.6) + ' 0 ' + (-L) + 'Q' + f(w * 0.9) + ' ' + f(-L * 0.6) + ' ' + w + ' 0Z', fill, 2.6) +
        S('M0 -4L0 ' + f(-L * 0.8), '#8fe07a', 1.4, op(0.7)));
    }
    [[-58, 40], [-36, 50], [-14, 58], [10, 58], [32, 50], [56, 40]].forEach(function (q) { o += lf(q[0], q[1], 7, dk); });
    [[-72, 32], [-48, 42], [-25, 50], [0, 54], [24, 48], [46, 42], [70, 32]].forEach(function (q) { o += lf(q[0], q[1], 6.5, lt); });
    return o;
  }
  function suitBody(c) {
    var jk = lg(c, [[0, '#8e2440'], [1, '#55122a']], 0, 0, 0, 1), sk = lg(c, [[0, '#c98a18'], [0.5, '#f2b632'], [1, '#c98a18']], 0, 0, 1, 0);
    var o = P(sym([0, 154], [[16, 154], [28, 154, 52, 156, 66, 162], [80, 168, 84, 182, 84, 206]]), jk, SW);
    o += P('M84 126H116V162H84Z', sk) + S('M84 126V158M116 126V158', INK, SW);
    o += P('M82 156L100 206L118 156Z', '#6a1830', 2.4);                                    // chaleco
    o += P('M88 156L100 190L112 156Z', '#fff', 2.2);                                       // camisa
    o += P('M86 152L100 166L92 174L82 160Z', '#fff', 2.2) + P('M114 152L100 166L108 174L118 160Z', '#fff', 2.2); // cuello
    o += P('M95 163H105L103 172H97Z', '#9a1f3a', 2) + P('M97 172L94 194L100 202L106 194L103 172Z', '#9a1f3a', 2) + '<rect x="92.5" y="184" width="15" height="3" rx="1.2" fill="#d8dce6" stroke="' + INK + '" stroke-width="1.2"/>';
    var lap = 'M84 154L100 206H90L72 178L64 170L74 166L70 158Z';
    o += P(lap, '#6e1a30', 2.6) + P(lap, '#6e1a30', 2.6, ' transform="matrix(-1 0 0 1 200 0)"');
    o += S('M124 186H146', INK, 2.2) + P('M127 186L130 177L134 183L139 175L143 186Z', GOLD, 1.8) + C(102, 199, 1.6, '#3a0a18');
    return o;
  }
  CH.pina = {
    name: 'Don Piña', fruit: 'piña', color: '#f2b632',
    role: 'Empresario millonario: «Necesito 500 litros… 500 por sabor».',
    normal: { e: { lid: [0.24, 0.18], curve: 0.15 }, b: [[1, 0, 0], [-2, -2, 1]] },
    F: { x: 100, ey: 104, ex: 20, er: [11, 12], iris: '#6a3a14', irisL: '#e0a868', irisD: '#2a1208', lash: 0, brow: '#5a3010', bw: 6.6, bg: 7, arch: 2.5,
      my: 139, mw: 14, lips: null, mouth: 'smirk', nose: 'strong', ny: 121, nosec: '#9a5c08', blush: '#ff8a40', blushOp: 0.2, tintPath: PINA_HEAD },
    H: { cx: 100, cy: 100, rx: 56, ry: 58, t: 42, chin: 157, sh: 162 },
    draw: function (c, M, v, F) {
      var o = suitBody(c) + pinaCrown(c);
      o += P(PINA_HEAD, rg(c, [[0, '#ffe58a'], [0.55, '#f2b632'], [1, '#b06e0c']], 0.45, 0.35, 0.72), SW);
      o += G('', S(PINA_TEX.l, '#a86a0a', 1.6, op(0.55)) + S(PINA_TEX.d, '#7a4808', 3.2, op(0.7)), ' clip-path="' + clipD(c, PINA_HEAD) + '"');
      o += E(100, 112, 44, 44, rg(c, [[0, '#ffe9a0', 0.95], [0.6, '#ffe08a', 0.75], [1, '#ffd36a', 0]], 0.5, 0.5, 0.5));
      o += gloss(70, 70, 10, 5, -40, 0.5);
      o += S('M60 130Q66 148 82 154M140 130Q134 148 118 154', '#a86a0a', 2.2, op(0.5));
      return o + faceAll(c, F, M);
    }
  };

  // ---------- Banano ----------
  var BANANO_HEAD = sym([0, 20], [[18, 20, 38, 34, 41, 68], [44, 104, 43, 136, 27, 150], [17, 158, 6, 160, 0, 160]]);
  var BEARD = smooth([[59, 92], [58, 120], [62, 140], [70, 154], [78, 164], [88, 166], [94, 172], [100, 169], [107, 173], [113, 166], [122, 164], [130, 154], [138, 140], [142, 120], [141, 92],
    [135, 100], [130, 114], [116, 120], [100, 117], [84, 120], [70, 114], [65, 100]]);
  var BANANO_SPOTS = dots([[72, 44], [80, 34], [124, 46], [130, 62], [66, 64], [118, 32], [136, 84], [64, 84], [88, 28], [110, 52], [76, 56]]);
  function shirtBody(c) {
    var sh = lg(c, [[0, '#ffffff'], [1, '#d9d6e2']], 0, 0, 0, 1), sk = lg(c, [[0, '#c99a14'], [0.5, '#ffd83a'], [1, '#c99a14']], 0, 0, 1, 0);
    var o = P(sym([0, 152], [[18, 152], [32, 152, 56, 154, 70, 160], [84, 166, 88, 182, 88, 206]]), sh, SW);
    o += S('M40 176q6 14 4 30M160 176q-6 14 -4 30M72 190q8 6 10 16M128 190q-8 6 -10 16', '#c4c0d0', 2.2);
    o += P('M82 120H118V164H82Z', sk) + S('M82 120V160M118 120V160', INK, SW);
    o += P('M84 158L100 188L116 158Z', sk);
    o += S('M96 182L86 160M104 182L114 160', '#16121a', 3.4);
    o += P('M78 150L86 158L100 188L92 192L74 164Z', '#fff', 2.6) + P('M122 150L114 158L100 188L108 192L126 164Z', '#fff', 2.6);
    o += P('M95.5 180H104.5L102.5 189H97.5Z', '#16121a', 1.6) + P('M97.6 189L95 206H105L102.4 189Z', '#16121a', 1.6);
    return o;
  }
  CH.banano = {
    name: 'Banano', fruit: 'plátano', color: '#e6b422',
    role: 'Investigador rudo y terco. Busca a su hermana Banana.',
    F: { x: 100, ey: 93, ex: 19, er: [10.5, 10.5], iris: '#5a3014', irisL: '#c89060', irisD: '#1a0a04', lash: 0, brow: '#151010', bw: 8.4, bg: 4, arch: 1, bin: 2.5, lidAdd: 0.12,
      my: 134, mw: 11, lips: '#b8664a', mouth: 'flat', nose: 'strong', ny: 112, nosec: '#9a7008', blush: null, tintPath: BANANO_HEAD },
    H: { cx: 100, cy: 92, rx: 44, ry: 68, t: 20, chin: 168, sh: 162 },
    draw: function (c, M, v, F) {
      var o = shirtBody(c);
      o += P('M93 30C91 18 97 8 109 2L117 7C108 12 104 20 106 30Z', lg(c, [[0, '#8a6232'], [1, '#4a2e12']], 0, 0, 1, 0), 2.8) + E(113, 4.5, 4.6, 3.2, '#2a180a', 1.6, ' transform="rotate(30 113 4.5)"');
      o += P(BANANO_HEAD, rg(c, [[0, '#fff6b0'], [0.5, '#ffd83a'], [1, '#c4920e']], 0.4, 0.3, 0.75), SW);
      o += S('M70 38C62 70 62 112 70 146M130 38C138 70 138 112 130 146', '#c4920e', 2.4, op(0.6)) + S('M80 32C72 58 70 90 72 112', '#fffbe0', 4.5, op(0.55));
      o += S(BANANO_SPOTS, '#7a4a1a', 3.4, op(0.55)) + E(126, 70, 5, 3, '#8a5a1e', 0, op(0.25)) + E(70, 50, 4, 2.4, '#8a5a1e', 0, op(0.25));
      o += E(F.x - F.ex, F.ey - 2, 15, 11, '#b8860c', 0, op(0.3)) + E(F.x + F.ex, F.ey - 2, 15, 11, '#b8860c', 0, op(0.3));
      var fp = faceParts(c, F, M);
      o += fp.tint + fp.nose;
      o += P(BEARD, rg(c, [[0, '#3a2e2c'], [1, '#141010']], 0.5, 0.3, 0.7), 3);
      o += S('M68 128q4 12 10 20M132 128q-4 12 -10 20M86 152q6 6 6 12M114 152q-6 6 -6 12', '#4e403c', 1.8, op(0.8));
      o += fp.mouth;
      o += P('M100 123C92 119 80 120 74 131C82 127 90 129 100 128C110 129 118 127 126 131C120 120 108 119 100 123Z', '#1a1414', 2.4);
      return o + fp.eyes + fp.brows;
    }
  };

  // ---------- Banana ----------
  function peel(x, y, rot, sc, flip, p) {
    return G('translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(rot) + ') scale(' + (flip ? -sc : sc) + ' ' + sc + ')',
      P('M-11 6C-13 -18 -10 -38 4 -48C10 -52 17 -47 14 -40C6 -33 5 -18 11 6Z', p.hair, 3.4) +
      P('M-3 2C-4 -16 -2 -32 8 -42C1 -30 1 -16 4 2Z', p.hairL) +
      P('M6 -49C11 -52 17 -47 14 -40C13 -39 10 -40 9 -43Z', '#7a4a1e'));
  }
  CH.banana = {
    name: 'Banana', fruit: 'plátano', color: '#ffe266',
    role: 'Hermana menor de Banano. La atraen con una oferta de trabajo.',
    F: wF(PAL.banana, {}), H: { cx: 100, cy: 88, rx: 70, ry: 70, t: 18, chin: 142, sh: 166 },
    draw: function (c, M, v, F) {
      var p = PAL.banana, o = '';
      [[-150, 1.25], [-122, 1.3], [-96, 1.3], [-70, 1.3], [-44, 1.3], [-20, 1.25], [12, 1.2], [36, 1.15]].forEach(function (q) {
        var a = q[0] * Math.PI / 180;
        o += peel(100 + Math.cos(a) * 30, 86 + Math.sin(a) * 30, q[0] + 90, q[1], q[0] < -90, p);
        if (q[0] > -90 && q[0] < 0) o += peel(200 - (100 + Math.cos(a) * 30), 86 + Math.sin(a) * 30, -(q[0] + 90), q[1], true, p);
      });
      o += peel(56, 150, 200, 1.1, true, p) + peel(144, 150, 160, 1.1, false, p);
      o += womanBody(c, p, tankTop(c, '#fffaf0', '#e6dcc8', 'tank', null, 9) + necklace(2));
      o += P(FACE_W, skinG(c, p), SW);
      o += gloss(78, 72, 11, 5.5, -32, 0.6);
      o += S(dots([[70, 118], [76, 122], [66, 124], [130, 118], [124, 122], [134, 124], [96, 110], [104, 110], [100, 106]]), '#b07a3a', 2.8, op(0.75));
      o += faceAll(c, F, M);
      o += hoop(57, 128, 6) + hoop(143, 128, 6);
      o += peel(84, 62, -58, 0.8, true, p) + peel(116, 62, 58, 0.8, false, p) + peel(100, 56, 0, 0.62, false, p);
      return o;
    }
  };

  // ---------- Fresa ----------
  var FRESA_SEEDS = dots([[70, 70], [86, 60], [114, 60], [130, 70], [64, 86], [136, 86], [66, 118], [134, 118], [78, 132], [122, 132], [92, 139], [108, 139], [100, 62], [60, 102], [140, 102], [74, 82], [126, 82]]);
  function calyx(cx, cy, n, L, fill, sp) {
    var o = '';
    for (var i = 0; i < n; i++) {
      var a = -180 + (i + 0.5) * (sp || 180) / n - ((sp || 180) - 180) / 2;
      o += G('translate(' + cx + ' ' + cy + ') rotate(' + f(a) + ')', P('M0 -5Q' + f(L * 0.55) + ' -5 ' + L + ' 0Q' + f(L * 0.55) + ' 5 0 5Z', fill, 2.6));
    }
    return o;
  }
  CH.fresa = {
    name: 'Fresa', fruit: 'fresa', color: '#ff3b55',
    role: 'Prima de Lima. Se convierte en «el nuevo sabor de fresa».',
    F: wF(PAL.fresa, {}), H: H_W,
    draw: function (c, M, v, F) {
      var p = PAL.fresa, hf = hairG(c, p), o = '';
      o += P(smooth([[100, 30], [134, 32], [156, 52], [164, 86], [162, 124], [168, 160], [166, 190], [140, 192], [100, 176], [60, 192], [34, 190], [32, 160], [38, 124], [36, 86], [44, 52], [66, 32]]), hf, SW);
      o += S('M46 100q-4 40 0 80M154 100q4 40 0 80', p.hairL, 2.6, op(0.6));
      o += womanBody(c, p, tankTop(c, '#ffffff', '#e2dce8', 'heart', null, 5) + necklace(1));
      o += P(FACE_W, skinG(c, p), SW);
      o += S(FRESA_SEEDS, '#ffe680', 3.4) + gloss(78, 72, 11, 5.5, -32, 0.55);
      o += faceAll(c, F, M);
      o += P('M57 98C54 66 74 46 100 46C126 46 146 66 143 98C140 86 138 78 134 70L128 66L122 72L114 60L106 70L98 58L90 70L82 60L74 70L68 64C62 72 58 84 57 98Z', hf, SW);
      var lk = 'M60 84C54 112 54 150 48 186L60 184C64 150 64 114 66 92Z';
      o += P(lk, hf, 4) + P(lk, hf, 4, ' transform="matrix(-1 0 0 1 200 0)"');
      o += hoop(57, 128, 6) + hoop(143, 128, 6);
      o += calyx(100, 44, 7, 24, '#38b24a') + C(100, 42, 6, '#2c9a3c', 2.4) + S('M100 38q1 -8 6 -12', INK, 6) + S('M100 38q1 -8 6 -12', '#5a8f2a', 3);
      return o;
    }
  };

  // ---------- Durazna ----------
  function pipe(c) {
    var g = lg(c, [[0, '#9aa0b0'], [0.4, '#eef0f6'], [1, '#6a7080']], 0, 0, 1, 0);
    var o = G('rotate(14 160 120)', '<rect x="153" y="22" width="13" height="190" rx="5" fill="' + g + '" stroke="' + INK + '" stroke-width="3.4"/>' +
      '<rect x="151" y="140" width="17" height="70" rx="6" fill="#2a6fd6" stroke="' + INK + '" stroke-width="3"/>' + S('M155 150v52', '#8fc0ff', 2.4, op(0.7)) +
      S('M157 30v100', '#fff', 2, op(0.6)));
    o += P('M134 168C134 156 162 154 168 162C174 170 172 192 164 200L138 200C132 192 132 180 134 168Z', PAL.durazna.skin, 3.2) +
      S('M140 172q12 -4 26 0M139 182q12 -4 27 0M140 192q12 -4 24 0', INK, 2, op(0.6));
    return o;
  }
  CH.durazna = {
    name: 'Durazna', fruit: 'durazno', color: '#ffb07a', variants: ['tubo'],
    role: 'Clienta fiel: «helado gratis de por vida». Al final pelea con un tubo.',
    F: wF(PAL.durazna, { blushOp: 0.62, bw: 5.4 }), H: H_W,
    draw: function (c, M, v, F) {
      var p = PAL.durazna, hf = hairG(c, p), o = '';
      o += P(smooth([[100, 28], [136, 30], [160, 52], [168, 84], [162, 116], [172, 150], [164, 190], [136, 194], [100, 174], [64, 194], [36, 190], [28, 150], [38, 116], [32, 84], [40, 52], [64, 30]]), hf, SW);
      o += S('M40 100q-6 24 2 48M160 100q6 24 -2 48', p.hairL, 2.6, op(0.6));
      o += womanBody(c, p, tankTop(c, '#ffffff', '#e2dce8', 'v', null, 6) + necklace(2));
      o += P(FACE_W, rg(c, [[0, '#fff2dc'], [0.45, '#ffc48e'], [0.85, '#ff9e74'], [1, '#f07a5a']], 0.42, 0.36, 0.7), SW);
      o += S('M100 52Q96 60 99 70', '#e0704a', 2.6, op(0.8)) + gloss(78, 72, 10, 5, -32, 0.5) + E(100, 115, 5, 3.4, '#ff5a5e', 0, op(0.5));
      o += faceAll(c, F, M);
      var lo = 'M100 32C74 30 52 46 50 80C48 108 50 132 42 160C40 172 44 184 50 192C58 180 62 166 62 150C62 126 58 104 60 90C62 68 78 50 100 44Z';
      o += P(lo, hf, 4) + P(lo, hf, 4, ' transform="matrix(-1 0 0 1 200 0)"') + S('M56 70q-4 18 -2 40M144 70q4 18 2 40', p.hairL, 2.4, op(0.7));
      o += hoop(57, 128, 6) + hoop(143, 128, 6);
      o += S('M100 40Q99 30 104 22', INK, 7.5) + S('M100 40Q99 30 104 22', '#8a5530', 4) + leaf(103, 25, 22, -24, '#5cbf4a') + leaf(101, 28, 17, -150, '#4caf50');
      if (v === 'tubo') o += pipe(c);
      return o;
    }
  };

  // ---------- Uva ----------
  function vineLeaf(x, y, rot, sc) {
    return G('translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + sc + ')',
      P('M0 18C-10 14 -24 10 -27 -2C-19 -2 -16 -6 -17 -12C-10 -10 -7 -15 -9 -24C-2 -19 3 -21 5 -27C10 -20 15 -19 21 -22C20 -14 24 -10 30 -9C27 0 21 5 17 7C20 12 13 16 0 18Z', '#6cb84a', 2.6 / sc) +
      S('M0 17L-18 -2M0 17L-4 -20M0 17L12 -18M0 17L22 -4', '#2f6e22', 1.6 / sc, op(0.6)));
  }
  function grapes(x, y, s) {
    var g = [[0, 0], [9, 2], [-8, 3], [4, 9], [-4, 11], [12, 10], [1, 18]], o = '', h = '';
    g.forEach(function (q) { o += C(x + q[0] * s, y + q[1] * s, 5.4 * s, '#7b35b8', 2); h += C(x + q[0] * s - 1.8 * s, y + q[1] * s - 1.8 * s, 1.5 * s, '#e8c8ff'); });
    return S('M' + f(x + 2) + ' ' + f(y - 4) + 'l3 -7', '#5a3a1a', 3) + o + h;
  }
  CH.uva = {
    name: 'Uva', fruit: 'uva', color: '#9a4ed6',
    role: 'Nueva en la ciudad. Escapa en el apagón… y Cherry la regresa.',
    F: wF(PAL.uva, {}), H: H_W,
    draw: function (c, M, v, F) {
      var p = PAL.uva, hf = hairG(c, p), o = '';
      o += P(smooth([[100, 24], [136, 28], [162, 50], [172, 82], [166, 116], [174, 150], [166, 190], [138, 194], [100, 176], [62, 194], [34, 190], [26, 150], [34, 116], [28, 82], [38, 50], [64, 28]]), hf, SW);
      o += S('M38 96q-8 26 2 50q8 20 -2 36M162 96q8 26 -2 50q-8 20 2 36', p.hairL, 2.4, op(0.6));
      o += womanBody(c, p, tankTop(c, '#fbf3e2', '#ddd0b6', 'heart', null, 5) + necklace(1));
      o += P(FACE_W, rg(c, [[0, p.light], [0.5, p.skin], [1, p.dark]], 0.4, 0.3, 0.75), SW);
      o += S(dots([[70, 124], [130, 122], [124, 132], [80, 134], [134, 80], [66, 82], [118, 58]]), '#5a1f8a', 5, op(0.35)) + gloss(78, 70, 12, 6, -32, 0.65) + C(70, 66, 2.4, '#fff');
      o += faceAll(c, F, M);
      o += P('M57 102C50 68 70 42 102 42C130 42 150 62 144 100C138 82 124 70 106 68C94 66 78 72 70 82C64 88 60 94 57 102Z', hf, SW);
      o += S('M72 56q14 -10 32 -8', p.hairL, 3, op(0.8));
      var lk = 'M58 92C50 116 54 144 46 176L58 180C62 150 62 122 66 98Z';
      o += P(lk, hf, 4) + P(lk, hf, 4, ' transform="matrix(-1 0 0 1 200 0)"');
      o += hoop(57, 128, 6) + hoop(143, 128, 6);
      o += S('M144 52c6 -8 16 -6 15 2c-1 5 -7 4 -6 0M46 60c-6 -6 -14 -2 -12 4c1 4 6 3 5 0M160 128c8 -2 10 8 4 10', '#7ab84a', 2.6);
      o += vineLeaf(70, 40, -30, 0.95) + vineLeaf(150, 74, 40, 0.8) + grapes(132, 36, 0.95);
      return o;
    }
  };

  // ---------- Naranja ----------
  var NAR_CURLS = (function () {
    var l = [], i, a;
    for (i = 0; i <= 11; i++) { a = (-196 + i * 212 / 11) * Math.PI / 180; l.push([100 + Math.cos(a) * 64, 90 + Math.sin(a) * 62, 17]); }
    return l.concat([[38, 136, 16], [42, 164, 15], [50, 188, 13], [162, 136, 16], [158, 164, 15], [150, 188, 13], [100, 30, 18], [76, 36, 16], [124, 36, 16]]);
  })();
  function spiral(x, y, r) {
    return 'M' + f(x - r * 0.15) + ' ' + f(y) + 'a' + f(r * 0.28) + ' ' + f(r * 0.28) + ' 0 1 1 ' + f(r * 0.42) + ' ' + f(r * 0.22) + 'a' + f(r * 0.55) + ' ' + f(r * 0.55) + ' 0 1 1 ' + f(-r * 0.86) + ' ' + f(-r * 0.5);
  }
  function curls(c, list, fill, col) {
    var a = '', b = '', s = '';
    list.forEach(function (q) { a += C(q[0], q[1], q[2], fill, 4.4); b += C(q[0], q[1], q[2] - 2.2, fill); s += spiral(q[0], q[1], q[2]); });
    return a + b + S(s, col, 2.4);
  }
  function muffinBag(c) {
    var o = P('M62 166L138 166L142 206H58Z', lg(c, [[0, '#d9a86a'], [1, '#b07a40']], 0, 0, 0, 1), 3.4);
    [[78, 160], [100, 156], [122, 160]].forEach(function (q) {
      o += P('M' + (q[0] - 11) + ' ' + (q[1] + 2) + 'L' + (q[0] - 9) + ' ' + (q[1] + 14) + 'H' + (q[0] + 9) + 'L' + (q[0] + 11) + ' ' + (q[1] + 2) + 'Z', '#f4f0ff', 2.2) +
        P('M' + (q[0] - 12) + ' ' + (q[1] + 3) + 'C' + (q[0] - 14) + ' ' + (q[1] - 10) + ' ' + (q[0] + 14) + ' ' + (q[1] - 10) + ' ' + (q[0] + 12) + ' ' + (q[1] + 3) + 'Z', '#a8642a', 2.4) +
        S(dots([[q[0] - 4, q[1] - 2], [q[0] + 4, q[1] - 4], [q[0] + 1, q[1]]]), '#4a2410', 2.6) + E(q[0] - 4, q[1] - 4, 3, 1.4, '#fff', 0, op(0.45));
    });
    o += P('M58 168L62 176L68 168L74 176L80 168L86 176L92 168L98 176L104 168L110 176L116 168L122 176L128 168L134 176L140 168L142 180H58Z', '#e2b57a', 2.4);
    o += S('M90 196h20', '#8a5a2a', 2) + S('M84 148q-4 -8 2 -14M104 144q-4 -8 2 -14M120 148q-4 -8 2 -14', '#fff', 2.4, op(0.8));
    o += E(58, 188, 9, 11, PAL.naranja.skin, 3) + E(142, 188, 9, 11, PAL.naranja.skin, 3);
    return o;
  }
  CH.naranja = {
    name: 'Naranja', fruit: 'naranja', color: '#ff8c1f', variants: ['panecitos'],
    role: 'Vecina de Cherry: «vecina, te traje panecitos calientitos».',
    F: wF(PAL.naranja, { mouth: 'grin', mw: 12 }), H: { cx: 100, cy: 88, rx: 74, ry: 72, t: 14, chin: 142, sh: 166 },
    draw: function (c, M, v, F) {
      var p = PAL.naranja, hf = hairG(c, p), o = '';
      o += curls(c, NAR_CURLS, hf, p.hairD);
      o += womanBody(c, p, tankTop(c, '#ffffff', '#e2dce8', 'heart', null, 6) + necklace(1));
      o += P(FACE_W, skinG(c, p), SW);
      o += S(dots([[68, 116], [74, 124], [132, 116], [126, 124], [80, 66], [120, 66], [100, 60], [62, 100], [138, 100]]), '#ffd2a0', 2.2, op(0.8)) + gloss(78, 72, 11, 5.5, -32, 0.5);
      o += faceAll(c, F, M);
      o += curls(c, [[68, 64, 11], [84, 56, 12], [100, 53, 12], [116, 56, 12], [132, 64, 11]], hf, p.hairD);
      o += hoop(57, 128, 6) + hoop(143, 128, 6);
      o += leaf(98, 18, 20, -150, '#4caf50') + leaf(102, 18, 20, -30, '#4caf50') + blossom(100, 20, 7.5) + blossom(78, 28, 5.4) + blossom(124, 28, 5.4);
      if (v === 'panecitos') o += muffinBag(c);
      return o;
    }
  };

  // ---------- secundarios: piezas ----------
  function maleTorso(c, W, y, fill) {
    return P(sym([0, y], [[18, y], [32, y, W - 30, y + 2, W - 16, y + 8], [W - 2, y + 14, W, y + 30, W, 206]]), fill, SW);
  }
  function neckM(c, w, y1, y2, fill) {
    return P('M' + (100 - w) + ' ' + y1 + 'H' + (100 + w) + 'V' + y2 + 'H' + (100 - w) + 'Z', fill) + S('M' + (100 - w) + ' ' + y1 + 'V' + (y2 - 4) + 'M' + (100 + w) + ' ' + y1 + 'V' + (y2 - 4), INK, SW);
  }
  function badge(x, y, s) {
    return G('translate(' + x + ' ' + y + ') scale(' + (s || 1) + ')', P('M0 -9L7 -6V1C7 6 3 9 0 10C-3 9 -7 6 -7 1V-6Z', GOLD, 2) + P('M0 -4l1.5 3h3l-2.4 2 1 3.2L0 2.4l-3.1 1.8 1-3.2-2.4-2h3Z', '#c48a12'));
  }
  function policeBody(c, W, neckFill) {
    var o = maleTorso(c, W, 154, lg(c, [[0, '#2a3a64'], [1, '#141e38']], 0, 0, 0, 1));
    o += neckM(c, 15, 124, 162, neckFill);
    o += P('M84 156L100 186L116 156Z', '#fff', 2.4) + P('M96 166H104L103 172H97Z', '#141420', 1.4) + P('M97 172L95 196L100 202L105 196L103 172Z', '#141420', 1.4);
    o += P('M82 152L100 172L92 180L78 162Z', '#fff', 2.4) + P('M118 152L100 172L108 180L122 162Z', '#fff', 2.4);
    o += S('M84 160L100 206M116 160L100 206', '#0c1428', 3);
    o += badge(128, 182, 1.15);
    return o;
  }
  // ---------- Limón ----------
  var LIMON_HEAD = sym([0, 26], [[8, 26, 12, 34, 22, 37], [46, 42, 62, 66, 62, 98], [62, 132, 38, 156, 8, 160], [4, 162, 0, 165, 0, 165]]);
  CH.limon = {
    name: 'Limón', fruit: 'limón', color: '#e8d040',
    role: 'Vive en el callejón: «El coco y la cereza tienen algo grande escondido».',
    normal: { e: { lid: [0.36, 0.42], curve: 0.1 }, b: [[2, 4, -1], [-1, 2, 0]] },
    F: { x: 100, ey: 98, ex: 19, er: [10.5, 10], iris: '#6a5a2a', irisL: '#d8c890', lash: 0, brow: '#8a8578', bw: 7, bg: 6, arch: 2, lidAdd: 0.08,
      my: 136, mw: 13, lips: null, mouth: 'smile', nose: 'bulb', ny: 117, nosec: '#9a7a10', blush: '#ff9a50', blushOp: 0.2, tintPath: LIMON_HEAD },
    H: { cx: 100, cy: 96, rx: 62, ry: 68, t: 26, chin: 162, sh: 164 },
    draw: function (c, M, v, F) {
      var jk = lg(c, [[0, '#8a6038'], [1, '#5a3a1e']], 0, 0, 0, 1);
      var o = maleTorso(c, 80, 154, jk);
      o += S('M40 170l10 6M150 176l8 -6M46 190l6 2', '#4a2e16', 2, op(0.6)) + '<rect x="36" y="178" width="18" height="16" rx="2" fill="#9a7a4a" stroke="' + INK + '" stroke-width="2" stroke-dasharray="3 2" transform="rotate(-8 45 186)"/>';
      o += P('M62 164L84 156L96 206H70Z', '#6e4a28', 2.6) + P('M138 164L116 156L104 206H130Z', '#6e4a28', 2.6);
      o += neckM(c, 16, 128, 160, '#c8b030');
      var sc = '#a8433a';
      o += P('M68 150C80 168 120 168 132 150L136 164C122 184 78 184 64 164Z', sc, 2.8) + S('M70 158q30 16 60 0M68 166q32 16 64 0', '#7a2a24', 2, op(0.8));
      o += P('M110 170L118 204L132 200L124 168Z', sc, 2.6) + S('M114 182l12 -3M117 194l12 -3', '#7a2a24', 2);
      o += S('M100 28Q99 18 104 12', INK, 7) + S('M100 28Q99 18 104 12', '#6a4a1e', 3.6) + leaf(103, 15, 20, -18, '#6a9a3a');
      o += P(LIMON_HEAD, rg(c, [[0, '#fbf0a0'], [0.55, '#e3cc3c'], [1, '#a8900e']], 0.42, 0.34, 0.72), SW);
      o += S(dots([[70, 60], [84, 50], [118, 50], [132, 62], [60, 100], [142, 104], [70, 132], [130, 132], [96, 46], [140, 82], [62, 80]]), '#b8a018', 2.6, op(0.7));
      o += S('M76 66q24 -7 48 0M82 74q18 -5 36 0M58 90l-7 -3M58 97l-8 1M142 90l7 -3M142 97l8 1M72 120q-6 12 2 24M128 120q6 12 -2 24M72 110q9 4 18 0M110 110q9 4 18 0', '#8a7410', 2.2, op(0.8));
      o += S(dots([[74, 146], [80, 150], [88, 154], [96, 156], [104, 156], [112, 154], [120, 150], [126, 146], [84, 146], [116, 146], [100, 150]]), '#8a8578', 2.2, op(0.7));
      o += gloss(72, 56, 10, 5, -40, 0.4);
      return o + faceAll(c, F, M);
    }
  };

  // ---------- La oficial (cabeza de fresa) ----------
  var OFI_HEAD = sym([0, 46], [[34, 42, 60, 58, 60, 88], [60, 120, 32, 152, 0, 164]]);
  CH.policia_fresa = {
    name: 'La oficial', fruit: 'fresa', color: '#e8323f',
    role: 'Contacto de Banano en la policía: «¡Todas las unidades!».',
    normal: { b: [2, 0, 0] },
    F: { x: 100, ey: 98, ex: 20, er: [11, 12.5], iris: '#4a2a1a', irisL: '#c89070', lash: 1, brow: '#6a0a1a', bw: 4.6, bg: 7, arch: 2,
      my: 128, mw: 10, lips: '#7a0a24', mouth: 'flat', nose: 'small', ny: 114, nosec: 'rgba(90,10,20,.45)', blush: '#ff9aa0', blushOp: 0.35, tintPath: OFI_HEAD },
    H: { cx: 100, cy: 100, rx: 60, ry: 62, t: 30, chin: 162, sh: 166 },
    draw: function (c, M, v, F) {
      var o = policeBody(c, 72, '#c8203a');
      o += P('M30 168L44 160L52 176L38 184Z', '#141e38', 2) + P('M33 169L44 163L49 174L38 180Z', '#d8c070', 1) + S('M37 171l8 -4M38 175l9 -4', '#141e38', 1.6);
      o += '<rect x="58" y="158" width="11" height="20" rx="2.5" fill="#1a1a22" stroke="' + INK + '" stroke-width="2"/>' + S('M61 158v-8', INK, 2.6) + C(63.5, 166, 2, '#ff3a3a');
      o += P(OFI_HEAD, rg(c, [[0, '#ff8a92'], [0.5, '#e8283e'], [1, '#8a0c22']], 0.42, 0.3, 0.75), SW);
      o += S(dots([[66, 72], [82, 60], [118, 60], [134, 72], [56, 92], [144, 92], [62, 116], [138, 116], [76, 136], [124, 136], [90, 150], [110, 150], [100, 160], [100, 56], [70, 102], [130, 102]]), '#ffe680', 3.4);
      o += gloss(72, 66, 11, 5, -35, 0.6);
      o += faceAll(c, F, M);
      o += calyx(100, 46, 9, 30, '#2f9a3a', 220) + calyx(100, 44, 5, 20, '#4cbf4a', 160) + C(100, 42, 6, '#2c8a3a', 2.4) + S('M100 38q2 -9 8 -12', INK, 6.4) + S('M100 38q2 -9 8 -12', '#5a8f2a', 3.2);
      return o;
    }
  };

  // ---------- El oficial Sandía ----------
  var SAN_HEAD = sym([0, 30], [[40, 30, 68, 52, 68, 92], [68, 130, 42, 158, 0, 160]]);
  var SAN_STRIPES = (function () {
    var d = '';
    for (var k = -3; k <= 3; k++) {
      var pts = [];
      for (var t = 0; t <= 10; t++) {
        var y = 28 + t * 13.4, w = Math.sin(t / 10 * Math.PI);
        pts.push([100 + k * (8 + 13 * w) + (t % 2 ? 3 : -3), y]);
      }
      d += 'M' + pts.map(function (q) { return ip(q[0], q[1]); }).join('L');
    }
    return d;
  })();
  function policeCap(c) {
    return P('M48 60C46 26 154 26 152 60Z', lg(c, [[0, '#2e3e6a'], [1, '#18223e']], 0, 0, 0, 1), SW) +
      P('M46 58H154V68H46Z', '#0e1426', 3) + P('M54 66Q100 58 146 66L150 76Q100 66 50 76Z', '#0a0f1e', 3) + badge(100, 46, 0.95) + gloss(74, 40, 10, 4, -12, 0.35);
  }
  CH.policia_sandia = {
    name: 'El oficial Sandía', fruit: 'sandía', color: '#3fa84a',
    role: 'Esposa a Cocardo y vigila su celda. Cero bromas.',
    normal: { b: [3, 0, -1] },
    F: { x: 100, ey: 100, ex: 21, er: [11, 11.5], iris: '#3a2a1a', irisL: '#b89070', lash: 0, brow: '#0e3212', bw: 7.4, bg: 5, arch: 1.5,
      my: 136, mw: 13, lips: null, mouth: 'flat', nose: 'strong', ny: 118, nosec: '#1f5a22', blush: null, tintPath: SAN_HEAD },
    H: { cx: 100, cy: 96, rx: 68, ry: 64, t: 30, chin: 159, sh: 162 },
    draw: function (c, M, v, F) {
      var o = policeBody(c, 82, '#4aa84a');
      o += P('M30 162H52V170H30Z', '#c8a030', 1.8, ' transform="rotate(10 41 166)"') + P('M148 170H170V162H148Z', '#c8a030', 1.8, ' transform="rotate(-10 159 166)"');
      o += P(SAN_HEAD, rg(c, [[0, '#a8e07a'], [0.5, '#5cb84a'], [1, '#2a7a2a']], 0.42, 0.32, 0.75), SW);
      o += G('', S(SAN_STRIPES, '#1c5a20', 8.5, op(0.85)), ' clip-path="' + clipD(c, SAN_HEAD) + '"');
      o += E(100, 112, 46, 40, rg(c, [[0, '#8fd06a', 0.85], [0.7, '#7cc455', 0.6], [1, '#7cc455', 0]], 0.5, 0.5, 0.5));
      o += gloss(64, 82, 9, 5, -50, 0.5);
      o += faceAll(c, F, M) + policeCap(c);
      return o;
    }
  };

  // ---------- El guardaespaldas (mango) ----------
  var MANGO_HEAD = smooth([[104, 30], [138, 40], [156, 72], [154, 112], [140, 146], [106, 162], [72, 154], [52, 124], [48, 88], [62, 52], [82, 34]]);
  CH.guardaespaldas = {
    name: 'El guardaespaldas', fruit: 'mango', color: '#ff9a2a',
    role: 'La sombra musculosa de Don Piña. No habla, no sonríe.',
    F: { x: 100, ey: 99, ex: 21, er: [12, 11], iris: '#3a2a1a', lash: 0, brow: '#4a1e0a', bw: 7.6, bg: 3, arch: 1, bin: 2, noEyes: true,
      my: 137, mw: 13, lips: null, mouth: 'flat', nose: 'strong', ny: 118, nosec: '#b8501a', blush: null, tintPath: MANGO_HEAD },
    H: { cx: 102, cy: 96, rx: 54, ry: 64, t: 30, chin: 160, sh: 158 },
    draw: function (c, M, v, F) {
      var tee = lg(c, [[0, '#2e2a36'], [1, '#121016']], 0, 0, 0, 1);
      var o = P(sym([0, 150], [[20, 150], [36, 146, 60, 148, 76, 156], [92, 164, 98, 182, 98, 206]]), tee, SW);
      o += S('M62 186q38 12 76 0M100 188v18M40 172q4 18 2 34M160 172q-4 18 -2 34', '#3e3a48', 2.4);
      o += neckM(c, 22, 124, 160, lg(c, [[0, '#b8c83a'], [0.5, '#ffc040'], [1, '#d88a2a']], 0, 0, 1, 0));
      o += P('M76 154C82 170 118 170 124 154L130 158C124 180 76 180 70 158Z', '#24202c', 2.6);
      o += S('M104 32Q104 22 110 16', INK, 6.6) + S('M104 32Q104 22 110 16', '#6a4a1e', 3.2) + leaf(108, 19, 20, -12, '#4caf50');
      o += P(MANGO_HEAD, lg(c, [[0, '#e8402a'], [0.35, '#ff9a2a'], [0.68, '#ffd04a'], [1, '#9ccc3e']], 0.85, 0.05, 0.2, 0.95), SW);
      o += P(MANGO_HEAD, rg(c, [[0, '#fff', 0.45], [0.5, '#fff', 0], [1, '#5a1a00', 0.25]], 0.38, 0.3, 0.8));
      o += S('M150 108q6 8 2 18q-4 10 2 20q4 8 -2 16', INK, 4.6) + S('M150 108q6 8 2 18q-4 10 2 20q4 8 -2 16', '#e8eef6', 2.2);
      var fp = faceParts(c, F, M);
      o += fp.tint + fp.nose + fp.mouth + S('M70 146q30 12 60 0', '#b8501a', 2, op(0.4)) + fp.brows;
      o += S('M48 96L60 94M140 94L152 96', INK, 4.4);
      o += P('M58 92Q100 84 142 92L140 104Q128 118 108 108L100 102L92 108Q72 118 60 104Z', lg(c, [[0, '#3a3644'], [1, '#08060c']], 0, 0, 0, 1), 3);
      o += S('M66 96l14 -2M116 94l16 2', '#fff', 2.2, op(0.45));
      return o;
    }
  };

  // ---------- El repartidor (brócoli) ----------
  var BRO_TOP = [[62, 64, 20], [84, 46, 22], [110, 42, 22], [134, 52, 20], [150, 76, 17], [50, 86, 16], [100, 64, 18], [74, 70, 16], [124, 70, 16]];
  var BRO_BEARD = [[58, 124, 10], [64, 140, 11], [76, 152, 12], [90, 159, 12], [110, 159, 12], [124, 152, 12], [136, 140, 11], [142, 124, 10]];
  var BRO_FACE = sym([0, 66], [[28, 66, 46, 82, 46, 106], [46, 134, 30, 154, 0, 156]]);
  function florets(c, list, fill) {
    var a = '', b = '', d = [];
    list.forEach(function (q) { a += C(q[0], q[1], q[2], fill, 4.2); b += C(q[0], q[1], q[2] - 2, fill); d.push([q[0] - q[2] * 0.3, q[1] - q[2] * 0.2], [q[0] + q[2] * 0.35, q[1] + q[2] * 0.1], [q[0] - q[2] * 0.05, q[1] + q[2] * 0.4]); });
    return a + b + S(dots(d), '#1d5a22', 4.4, op(0.55));
  }
  CH.brocoli = {
    name: 'El repartidor', fruit: 'brócoli', color: '#3f9a3a',
    role: 'Entrega el congelador grande: «¿Para qué quiere tanto espacio?».',
    normal: { b: [[-3, 0, 1], [1, 1, 0]] },
    F: { x: 100, ey: 104, ex: 19, er: [10.5, 11], iris: '#4a2e14', irisL: '#c89a60', lash: 0, brow: '#1f5a22', bw: 6.6, bg: 5, arch: 2,
      my: 132, mw: 11, lips: null, mouth: 'smile', nose: 'strong', ny: 120, nosec: '#5a8a30', blush: '#ff9a7a', blushOp: 0.25, tintPath: BRO_FACE },
    H: { cx: 100, cy: 92, rx: 62, ry: 66, t: 22, chin: 168, sh: 162 },
    draw: function (c, M, v, F) {
      var o = maleTorso(c, 82, 154, lg(c, [[0, '#2a3c6c'], [1, '#16203e']], 0, 0, 0, 1));
      o += neckM(c, 16, 124, 162, '#a8cc70');
      o += P('M80 152L100 170L90 182L74 162Z', '#2e4278', 2.4) + P('M120 152L100 170L110 182L126 162Z', '#2e4278', 2.4) + P('M96 170H104V200H96Z', '#24365e', 1.8) + C(100, 180, 1.8, '#e8e8f0') + C(100, 191, 1.8, '#e8e8f0');
      o += P(BRO_FACE, rg(c, [[0, '#eaf8c8'], [0.6, '#c8e494'], [1, '#8ab860']], 0.45, 0.35, 0.72), SW);
      var fl = rg(c, [[0, '#5cc050'], [0.6, '#2f8a34'], [1, '#1d5a22']], 0.4, 0.3, 0.8);
      o += florets(c, BRO_TOP, fl);
      var fp = faceParts(c, F, M);
      o += fp.tint + fp.blush + fp.nose + florets(c, BRO_BEARD, fl) + fp.mouth + fp.eyes + fp.brows;
      return o;
    }
  };

  // ---------- La reportera ----------
  var REP = { skin: '#ffbf4a', light: '#fff0b8', dark: '#e8862a', hair: '#2f7a34', hairL: '#6cbf4a', hairD: '#154a1c', iris: '#5a3014', irisL: '#d8a060', brow: '#2a5a26', lips: '#e8485a', blush: '#ff8a5a' };
  function microphone(c) {
    var o = G('rotate(-12 64 180)', '<rect x="59" y="168" width="10" height="44" rx="3" fill="#1e1a24" stroke="' + INK + '" stroke-width="2.6"/>' +
      '<rect x="54" y="160" width="20" height="16" rx="2" fill="#ff6fa5" stroke="' + INK + '" stroke-width="2.6"/>' +
      P('M60 172l4 -9l4 9Z', '#fff6ea', 1) + C(64, 162, 2.6, '#7fe0d8') +
      C(64, 148, 11, rg(c, [[0, '#f4f4fa'], [1, '#7a7a8a']], 0.4, 0.35, 0.7), 2.8) + S('M56 144h16M54 150h20M60 139v18M68 139v18', '#5a5a6a', 1.2, op(0.7)));
    return o + E(66, 192, 10, 12, REP.skin, 3) + S('M58 188q8 -3 16 0M58 195q8 -3 16 0', INK, 1.8, op(0.6));
  }
  CH.reportera = {
    name: 'La reportera', fruit: 'papaya', color: '#ffb347',
    role: 'Anuncia en el noticiero el arresto frente a Coco\'s Scoops.',
    F: wF(REP, { mw: 11.5 }), H: H_W,
    draw: function (c, M, v, F) {
      var hf = hairG(c, REP), o = '';
      o += P(smooth([[100, 28], [136, 30], [160, 52], [166, 86], [162, 118], [168, 146], [150, 156], [100, 144], [50, 156], [32, 146], [38, 118], [34, 86], [40, 52], [64, 30]]), hf, SW);
      o += S('M44 70q-6 30 0 66M156 70q6 30 0 66', '#ffb347', 3, op(0.7));
      var bl = lg(c, [[0, '#ffffff'], [1, '#dcd8e4']], 0, 0, 0, 1);
      o += womanBody(c, REP, '');
      o += P('M82 158L100 192L118 158Z', '#3f9a3a', 2.4);
      o += P(sym([0, 196], [[10, 186], [18, 158], [24, 154], [36, 154, 52, 158, 60, 164], [66, 170, 68, 182, 68, 206], [12, 206]]), bl, SW);
      o += P('M82 156L68 170L78 176L72 182L96 206H100Z', '#f0eef6', 2.4) + P('M118 156L132 170L122 176L128 182L104 206H100Z', '#f0eef6', 2.4);
      o += P(FACE_W, skinG(c, REP), SW) + gloss(78, 72, 11, 5.5, -32, 0.5);
      o += faceAll(c, F, M);
      o += P('M57 104C52 70 70 44 100 42C132 40 150 66 143 100C136 76 118 62 96 62C84 62 72 66 66 76C62 84 59 94 57 104Z', hf, SW) + S('M80 52q16 -8 34 -4', '#ffb347', 3, op(0.8)) + S('M120 50q16 6 20 24', REP.hairL, 2.6, op(0.8));
      o += hoop(57, 128, 5) + hoop(143, 128, 5);
      return o + microphone(c);
    }
  };

  // ---------- API ----------
  var ORDER = ['cocardo', 'lima', 'cereza', 'pina', 'banano', 'banana', 'fresa', 'durazna', 'uva', 'naranja',
    'limon', 'policia_fresa', 'policia_sandia', 'guardaespaldas', 'brocoli', 'reportera'];
  var ALIAS = { cherry: 'cereza', 'piña': 'pina', 'don_pina': 'pina', 'limón': 'limon', 'brócoli': 'brocoli', 'sandia': 'policia_sandia', 'mango': 'guardaespaldas' };

  function portrait(id, mood, opts) {
    opts = opts || {};
    var key = String(id == null ? '' : id).toLowerCase();
    key = CH[key] ? key : (ALIAS[key] || key);
    var def = CH[key], unknown = !def;
    if (unknown) { def = CH.cocardo; opts = { silhouette: true, size: opts.size }; }
    var mname = MS[mood] ? mood : 'normal';
    if (opts.silhouette) mname = 'normal';
    var M = { name: mname }, k;
    for (k in MS[mname]) M[k] = MS[mname][k];
    if (mname === 'normal' && def.normal) for (k in def.normal) M[k] = def.normal[k];
    var c = newCtx(opts), F = {};
    for (k in def.F) F[k] = def.F[k];
    var v = def.variants && def.variants.indexOf(opts.variant) >= 0 ? opts.variant : null;
    var fig = def.draw(c, M, v, F), body;
    if (c.sil) body = '<g filter="' + silFilter(c) + '">' + fig + '</g>' + question(def.H);
    else if (c.frozen) body = '<g filter="' + frozenFilter(c) + '">' + fig + '</g>' + frostFX(c, def.H);
    else body = fig + extras(c, F, def.H, M);
    var size = +opts.size || 200;
    return '<svg ' + NS + ' viewBox="0 0 200 200" width="' + size + '" height="' + size + '" role="img" aria-label="' + (unknown ? '?' : def.name) +
      '" stroke-linecap="round" stroke-linejoin="round">' + (c.defs.length ? '<defs>' + c.defs.join('') + '</defs>' : '') + body + '</svg>';
  }

  var characters = {};
  ORDER.forEach(function (id) {
    var d = CH[id];
    if (d) characters[id] = { name: d.name, fruit: d.fruit, color: d.color, role: d.role };
  });

  var api = { characters: characters, portrait: portrait, portraitMoods: MOODS.slice(), portraitVariants: { cocardo: ['carcel'], cereza: ['huida'], durazna: ['tubo'], naranja: ['panecitos'] } };
  var Art = Cocardo.Art || (Cocardo.Art = {});
  Object.keys(api).forEach(function (k) { if (!(k in Art) || k === 'characters' || k === 'portrait') Art[k] = api[k]; });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
