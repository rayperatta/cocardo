/* Cocardo — kit de montaje para videos con gameplay real (tools/video/montaje.html).
   Un montaje (tools/video/montajes/*.js) llama a K.montaje({ dur, tomas, clips, capas, audio }).
   Las tomas las graba tools/video/capturar.cjs y se sirven en /cap/<carpeta>/ (grabar.cjs --cap).
   Lienzo 1080x1920. Tiempos en segundos del video final salvo que se diga otra cosa. */
(function () {
  'use strict';
  var V = window.Video, C = V.C, F = V.FONT, W = V.W, H = V.H, SR = V.SR;
  var K = (window.K = {});
  K.W = W; K.H = H; K.C = C; K.F = F; K.V = V;
  K.BEAT = 60 / 104;   // la cumbia del juego va a 104 BPM

  /* ---------------- curvas ---------------- */
  var E = {
    lin: function (x) { return x; },
    io: function (x) { return x * x * (3 - 2 * x); },
    out: function (x) { return 1 - Math.pow(1 - x, 3); },
    in: function (x) { return x * x * x; },
    expo: function (x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); },
    back: function (x) { var c = 1.9; x -= 1; return 1 + (c + 1) * x * x * x + c * x * x; },
  };
  K.E = E;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  K.clamp = clamp;
  function lerp(a, b, k) { return a + (b - a) * k; }
  K.lerp = lerp;
  // progreso 0..1 de t en [a, b] con curva
  K.p = function (t, a, b, ease) { return (ease || E.lin)(clamp((t - a) / (b - a), 0, 1)); };
  // claves [[t, valor, curva?], ...]; valor número u objeto plano de números
  K.kf = function (keys, t) {
    if (!keys || !keys.length) return null;
    if (t <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        var a = keys[i - 1], b = keys[i], k = (E[b[2]] || E.io)((t - a[0]) / Math.max(1e-6, b[0] - a[0]));
        if (typeof a[1] === 'number') return lerp(a[1], b[1], k);
        var o = {};
        for (var key in b[1]) o[key] = lerp(a[1][key] != null ? a[1][key] : b[1][key], b[1][key], k);
        return o;
      }
    }
    return keys[keys.length - 1][1];
  };

  /* ---------------- tomas (fotogramas capturados) ---------------- */
  var tomas = {};
  K.tomas = tomas;
  function cargarToma(nombre, carpeta) {
    return fetch('/cap/' + carpeta + '/toma.json').then(function (r) {
      if (!r.ok) throw new Error('no encontré la toma ' + carpeta);
      return r.json();
    }).then(function (j) {
      j.nombre = nombre; j.carpeta = carpeta; j.cache = {}; j.orden = [];
      tomas[nombre] = j;
      return j;
    });
  }
  // fotograma que se ve en el segundo s de la toma (tomas con fps variable traen la lista de tiempos)
  function indice(tm, s) {
    var ts = tm.tiempos;
    if (!ts || !ts.length) return Math.round(s * tm.fps);
    var lo = 0, hi = ts.length - 1;
    if (s <= ts[0]) return 0;
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (ts[m] <= s + 0.004) lo = m; else hi = m - 1; }
    return lo;
  }
  K.indice = indice;
  function imagen(tm, i) {
    i = clamp(i | 0, 0, tm.fotogramas - 1);
    var c = tm.cache[i];
    if (c) return c;
    var img = new Image();
    c = tm.cache[i] = new Promise(function (res, rej) {
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error('fotograma ' + tm.carpeta + '/' + i)); };
    });
    img.src = '/cap/' + tm.carpeta + '/f' + String(i).padStart(5, '0') + '.jpg';
    tm.orden.push(i);
    if (tm.orden.length > 140) delete tm.cache[tm.orden.shift()];
    return c;
  }

  /* ---------------- clips con curva de velocidad ---------------- */
  // { toma, de, a, src (s de la toma en `de`), vel: [[t relativo al clip, velocidad, curva?]...],
  //   cam: [[t absoluto, {z, x, y, r}]...], dedo: bool, trans: 'corte'|'flash'|'golpe'|'barrido'|'negro', grado }
  function prepararClip(c) {
    var dt = 1 / 600, n = Math.ceil((c.a - c.de) / dt) + 2, tab = new Float64Array(n), s = c.src || 0;
    var vel = c.vel || [[0, 1]];
    for (var i = 0; i < n; i++) {
      tab[i] = s;
      var v = K.kf(vel, i * dt);
      // velocidad negativa (reversa) solo en clips mudos: los sonidos necesitan un tiempo que siempre avanza
      s = Math.max(0, s + (c.mudo ? v : Math.max(0, v)) * dt);
    }
    c._tab = tab; c._dt = dt;
    return c;
  }
  // tramos de velocidad: [[src desde, src hasta, velocidad], ...] → { vel (claves relativas), dur (s de salida) }
  K.tramos = function (lista, rampa) {
    rampa = rampa == null ? 0.1 : rampa;
    var keys = [], t = 0;
    lista.forEach(function (tr, i) {
      var d = (tr[1] - tr[0]) / tr[2];
      keys.push([t, tr[2]]);
      if (i < lista.length - 1 && d > 2 * rampa) keys.push([t + d - rampa, tr[2]]);
      t += d;
    });
    // duración real integrando la curva (las rampas corren un poco el tiempo)
    var s = lista[0][0], fin = lista[lista.length - 1][1], dt = 1 / 600, tt = 0;
    while (s < fin && tt < t * 3) { s += K.kf(keys, tt) * dt; tt += dt; }
    return { vel: keys, dur: tt, src: lista[0][0] };
  };
  K.srcDe = function (c, t) {
    var x = (t - c.de) / c._dt, i = Math.floor(x);
    if (i < 0) return c._tab[0];
    if (i >= c._tab.length - 1) return c._tab[c._tab.length - 1];
    return lerp(c._tab[i], c._tab[i + 1], x - i);
  };
  // tiempo de salida en el que el clip muestra el segundo `s` de la toma (null si no lo muestra o está congelado)
  function salidaDe(c, s) {
    var tab = c._tab, lo = 0, hi = tab.length - 1;
    if (s < tab[0] - 1e-9 || s > tab[hi] + 1e-9) return null;
    while (lo < hi) { var m = (lo + hi) >> 1; if (tab[m] < s) lo = m + 1; else hi = m; }
    if (lo > 0 && Math.abs(tab[lo] - tab[lo - 1]) < 1e-9 && Math.abs(tab[lo] - s) > 1e-6) return null;
    var t = c.de + lo * c._dt;
    return t <= c.a ? t : null;
  }

  K.salida = function (c, s) { return salidaDe(c, s); };
  // momentos (en el video final) en que suena `nombre` en los clips con sonido; filtro opcional (sonido, clip)
  K.eventos = function (nombre, filtro) {
    var out = [];
    (K.M.clips || []).forEach(function (c) {
      if (c.mudo) return;
      (tomas[c.toma].sonidos || []).forEach(function (s) {
        if (s.name !== nombre || (filtro && !filtro(s, c))) return;
        var t = salidaDe(c, s.t);
        if (t != null && t >= c.de && t < c.a) out.push({ t: t, opts: s.opts || {}, src: s.t });
      });
    });
    return out.sort(function (a, b) { return a.t - b.t; });
  };
  // centro de una celda del tablero de la toma (píxeles de la toma)
  K.celda = function (toma, r, c) {
    var tb = tomas[toma].tablero;
    return { x: tb.x0 + c * tb.paso, y: tb.y0 + r * tb.paso };
  };

  /* ---------------- arte del juego como imágenes ---------------- */
  var svgCache = {};
  K.svg = function (clave, svgStr, ancho) {
    var c = svgCache[clave];
    if (c) return c;
    var s = svgStr;
    if (ancho) s = s.replace(/<svg([^>]*?)\swidth="[^"]*"/, '<svg$1').replace(/<svg([^>]*?)\sheight="[^"]*"/, '<svg$1').replace('<svg', '<svg width="' + ancho + '" height="' + ancho + '"');
    var img = new Image();
    c = svgCache[clave] = { img: img, listo: new Promise(function (res) { img.onload = function () { res(img); }; img.onerror = function () { res(null); }; }) };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    return c;
  };
  K.retrato = function (id, mood, opts) {
    var clave = 'p:' + id + ':' + (mood || 'normal') + ':' + JSON.stringify(opts || {});
    return K.svg(clave, Cocardo.Art.portrait(id, mood || 'normal', opts || {}), 600).img;
  };
  K.icono = function (nombre, color) {
    return K.svg('i:' + nombre + ':' + (color || ''), Cocardo.Art.icon(nombre, { size: 240, color: color }), 240).img;
  };
  K.ficha = function (color, opts) {
    var clave = 't:' + color + JSON.stringify(opts || {});
    return K.svg(clave, Cocardo.Art.tile(color, opts || {}), 300).img;
  };
  // precarga lo que el montaje va a usar (retratos, íconos) antes de dibujar
  K.precargar = function () {
    return Promise.all(Object.keys(svgCache).map(function (k) { return svgCache[k].listo; }));
  };

  /* ---------------- dibujo ---------------- */
  var cv, ctx;
  K.ctx = function () { return ctx; };

  function camaraDe(clip, t) {
    var cam = K.kf(clip.cam, t) || {};
    return { z: cam.z || 1, x: cam.x != null ? cam.x : W / 2, y: cam.y != null ? cam.y : H / 2, r: cam.r || 0 };
  }
  // dibuja un fotograma de la toma con cámara (zoom alrededor de x,y de la toma, sin mostrar bordes)
  function dibujarFotograma(img, cam, sx, sy, grado, libre) {
    var z = Math.max(1, cam.z), hw = W / (2 * z), hh = H / (2 * z);
    var fx = libre ? cam.x : clamp(cam.x, hw, W - hw), fy = libre ? cam.y : clamp(cam.y, hh, H - hh);
    if (libre) {
      // relleno: el mismo fotograma ampliado y desenfocado detrás (lo que quede fuera del cuadro)
      ctx.save(); ctx.filter = 'blur(28px) saturate(1.2) brightness(0.8)';
      ctx.drawImage(img, -W * 0.25, -H * 0.25, W * 1.5, H * 1.5); ctx.restore();
    }
    ctx.save();
    ctx.translate(W / 2 + (sx || 0), H / 2 + (sy || 0));
    if (cam.r) ctx.rotate(cam.r);
    ctx.scale(z, z);
    ctx.translate(-fx, -fy);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.filter = grado || 'saturate(1.14) contrast(1.05)';
    ctx.drawImage(img, 0, 0, W, H);
    ctx.filter = 'none';
    ctx.restore();
    return { z: z, fx: fx, fy: fy, sx: sx || 0, sy: sy || 0, r: cam.r || 0 };
  }
  // pasa un punto de la toma a coordenadas de pantalla con la cámara del fotograma
  K.aPantalla = function (info, x, y) {
    var dx = (x - info.fx) * info.z, dy = (y - info.fy) * info.z, c = Math.cos(info.r), s = Math.sin(info.r);
    return { x: W / 2 + info.sx + dx * c - dy * s, y: H / 2 + info.sy + dx * s + dy * c };
  };

  // Mano del tutorial del juego sobre el dedo de la toma
  function dedoEn(tm, s) {
    var d = tm.dedo, prev = null, next = null;
    for (var i = 0; i < d.length; i++) { if (d[i].t <= s) prev = d[i]; else { next = d[i]; break; } }
    if (!prev) return null;
    var vis;
    if (prev.abajo || prev.llega) vis = 1;
    else vis = 1 - clamp((s - prev.t) / 0.35, 0, 1);
    if (vis <= 0) return null;
    var x = prev.x, y = prev.y;
    if (next && (prev.abajo || prev.llega) && next.abajo) {
      var k = clamp((s - prev.t) / Math.max(1e-3, next.t - prev.t), 0, 1);
      x = lerp(prev.x, next.x, k); y = lerp(prev.y, next.y, k);
    }
    var ent = prev.llega ? clamp((s - prev.t) / 0.1, 0, 1) : 1;
    return { x: x, y: y, abajo: !!prev.abajo, vis: vis * ent };
  }
  function dibujarDedo(info, p) {
    var img = K.icono('hand');
    if (!img.complete) return;
    var q = K.aPantalla(info, p.x, p.y), s = 190 * (p.abajo ? 0.9 : 1);
    ctx.save();
    ctx.globalAlpha = p.vis;
    if (p.abajo) {
      ctx.beginPath(); ctx.arc(q.x, q.y, 46, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    }
    ctx.shadowColor = 'rgba(43,22,48,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
    // la yema del dedo del ícono está en (10.75, 4.5) de 24
    ctx.drawImage(img, q.x - s * 10.75 / 24, q.y - s * 4.5 / 24, s, s);
    ctx.restore();
  }

  function vineta(fuerza) {
    var g = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.3, W / 2, H * 0.46, H * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,6,26,' + (fuerza == null ? 0.34 : fuerza) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  K.vineta = vineta;

  K.temblor = function (t, golpes) {
    // golpes: [[t, fuerza px, dur]]
    var x = 0, y = 0, f = Math.floor(t * 60);
    (golpes || []).forEach(function (g) {
      var d = t - g[0], dur = g[2] || 0.3;
      if (d >= 0 && d < dur) {
        var a = g[1] * Math.pow(1 - d / dur, 2);
        x += (V.hash(f + g[0] * 7) - 0.5) * 2 * a; y += (V.hash(f * 3 + g[0] * 11) - 0.5) * 2 * a;
      }
    });
    return { x: x, y: y };
  };

  /* ---------------- textos y gráficos ---------------- */
  K.texto = function (s, x, y, o) { return V.texto(ctx, s, x, y, o); };
  // texto que entra con rebote en `t0`
  K.popTexto = function (t, t0, s, x, y, o) {
    o = o || {};
    if (t < t0) return;
    var k = o.sinPop ? 1 : V.pop(t - t0, o.dur || 0.22);
    var sale = o.hasta != null ? 1 - K.p(t, o.hasta - 0.12, o.hasta, E.in) : 1;
    if (sale <= 0) return;
    ctx.save();
    ctx.globalAlpha = sale;
    ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(k, k);
    V.texto(ctx, s, 0, 0, o);
    ctx.restore();
  };
  // palabra por palabra (subtítulo dinámico); la palabra que entra brilla en dorado
  K.palabras = function (t, t0, frase, x, y, o) {
    o = o || {};
    if (t < t0) return;
    var size = o.size || 84, ritmo = o.ritmo || 0.11, maxW = o.maxW || 880, lh = size * 1.12;
    ctx.save();
    ctx.font = (o.weight || '400') + ' ' + size + 'px ' + (o.font || F.display);
    var pal = frase.split(' '), lineas = [[]], anchoL = [0], esp = ctx.measureText(' ').width;
    pal.forEach(function (p) {
      var w = ctx.measureText(p).width, li = lineas.length - 1;
      if (anchoL[li] + (lineas[li].length ? esp : 0) + w > maxW && lineas[li].length) { lineas.push([]); anchoL.push(0); li++; }
      anchoL[li] += (lineas[li].length ? esp : 0) + w;
      lineas[li].push({ p: p, w: w });
    });
    ctx.restore();
    var sale = o.hasta != null ? 1 - K.p(t, o.hasta - 0.12, o.hasta, E.in) : 1;
    if (sale <= 0) return;
    var idx = 0, y0 = y - (lineas.length - 1) * lh / 2;
    lineas.forEach(function (lin, li) {
      var cx = x - anchoL[li] / 2;
      lin.forEach(function (w) {
        var tw = t0 + idx * ritmo, k = V.pop(t - tw, 0.2);
        if (k > 0) {
          var dor = o.resalta !== false && t - tw < ritmo * 1.6;
          ctx.save();
          ctx.globalAlpha = sale;
          ctx.translate(cx + w.w / 2, y0 + li * lh); ctx.scale(k, k);
          V.texto(ctx, w.p, 0, 0, { size: size, font: o.font, weight: o.weight, fill: dor ? (o.colorResalta || C.gold) : (o.fill || C.cream),
            strokeW: o.strokeW || Math.max(10, size * 0.18) });
          ctx.restore();
        }
        cx += w.w + esp; idx++;
      });
    });
  };
  // anillo que se dibuja alrededor de un punto
  K.anillo = function (t, t0, x, y, r, color) {
    if (t < t0) return;
    var k = K.p(t, t0, t0 + 0.3, E.out), pul = 1 + 0.04 * Math.sin((t - t0) * 9);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, r * pul, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    ctx.lineWidth = 22; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.lineWidth = 12; ctx.strokeStyle = color || C.gold; ctx.stroke();
    ctx.restore();
  };
  // flecha curva que se traza de (x1,y1) a (x2,y2)
  K.flecha = function (t, t0, x1, y1, x2, y2, color) {
    if (t < t0) return;
    var k = K.p(t, t0, t0 + 0.28, E.out), mx = (x1 + x2) / 2 + (y2 - y1) * 0.25, my = (y1 + y2) / 2 - (x2 - x1) * 0.25;
    var N = 30, pts = [];
    for (var i = 0; i <= N * k; i++) {
      var u = i / N;
      pts.push([(1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * mx + u * u * x2, (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * my + u * u * y2]);
    }
    if (pts.length < 2) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    [[24, C.ink], [12, color || C.gold]].forEach(function (st) {
      ctx.beginPath(); pts.forEach(function (p, j) { if (j) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.lineWidth = st[0]; ctx.strokeStyle = st[1]; ctx.stroke();
    });
    if (k >= 1) {
      var a = Math.atan2(y2 - pts[pts.length - 2][1], x2 - pts[pts.length - 2][0]);
      ctx.translate(x2, y2); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-34, -26); ctx.lineTo(-34, 26); ctx.closePath();
      ctx.lineWidth = 10; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.fillStyle = color || C.gold; ctx.fill();
    }
    ctx.restore();
  };
  // etiqueta redonda (A, B, C…)
  K.etiqueta = function (t, t0, s, x, y, color) {
    if (t < t0) return;
    var k = V.pop(t - t0, 0.2);
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fillStyle = color || C.pink; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = C.ink; ctx.stroke();
    V.texto(ctx, s, 0, 4, { size: 78, fill: C.cream, strokeW: 14, sombra: false, maxW: 92 });
    ctx.restore();
  };
  // globo de diálogo con retrato (estilo de la historia del juego)
  K.globo = function (t, t0, id, mood, nombre, texto, o) {
    o = o || {};
    if (t < t0) return;
    var hasta = o.hasta != null ? o.hasta : Infinity;
    var ent = K.p(t, t0, t0 + 0.25, E.back), sal = 1 - K.p(t, hasta - 0.18, hasta, E.in);
    if (sal <= 0) return;
    var y = o.y || 1180, x0 = 70, w = 860, h = o.h || 250;
    ctx.save();
    ctx.globalAlpha = sal;
    ctx.translate(0, (1 - ent) * 120);
    // retrato
    var img = K.retrato(id, mood, o.ret);
    if (img.complete) {
      var s = o.tamRet || 420, bob = Math.sin((t - t0) * 6) * 6;
      ctx.drawImage(img, o.lado === 'der' ? x0 + w - s + 20 : x0 - 20, y - s + 40 + bob, s, s);
    }
    V.rr(ctx, x0, y, w, h, 34);
    ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 9; ctx.strokeStyle = C.ink; ctx.stroke();
    // etiqueta de nombre
    ctx.font = '400 46px ' + F.display;
    var nw = ctx.measureText(nombre).width + 50, nx = o.lado === 'der' ? x0 + w - nw - 30 : x0 + 30;
    V.rr(ctx, nx, y - 34, nw, 68, 34); ctx.fillStyle = o.color || C.pink; ctx.fill(); ctx.lineWidth = 7; ctx.stroke();
    V.texto(ctx, nombre, nx + nw / 2, y + 1, { size: 46, fill: C.cream, strokeW: 10, sombra: false });
    // texto a máquina (30 caracteres/s como en el juego, más rápido si se pide)
    var vel = o.vel || 38, n = Math.floor((t - t0 - 0.15) * vel), vis = texto.slice(0, clamp(n, 0, texto.length));
    ctx.font = '800 50px ' + F.body; ctx.fillStyle = C.ink; ctx.textBaseline = 'top';
    var words = vis.split(' '), line = '', ly = y + 58;
    words.forEach(function (wd) {
      var test = line ? line + ' ' + wd : wd;
      if (ctx.measureText(test).width > w - 80 && line) { ctx.fillText(line, x0 + 40, ly); line = wd; ly += 62; }
      else line = test;
    });
    if (line) ctx.fillText(line, x0 + 40, ly);
    ctx.restore();
  };
  // barras de cine
  K.cine = function (k) {
    if (k <= 0) return;
    var h = 210 * k;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h);
  };
  K.flash = function (t, t0, dur, color, max) {
    var d = t - t0;
    if (d < 0 || d > (dur || 0.18)) return;
    ctx.save(); ctx.globalAlpha = (max || 0.9) * (1 - d / (dur || 0.18));
    ctx.fillStyle = color || '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore();
  };
  K.negro = function (a) { if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); };
  // rebobinado VHS: desplazamiento RGB, líneas y franja de ruido
  K.vhs = function (t, fuerza) {
    if (fuerza <= 0) return;
    var f = Math.floor(t * 30);
    var img = ctx.getImageData(0, 0, W, H), d = img.data, off = Math.round(14 * fuerza) * 4;
    for (var y = 0; y < H; y++) {
      var shift = (V.hash(y * 0.05 + f) - 0.5) * 30 * fuerza * (V.hash(f + Math.floor(y / 90)) > 0.85 ? 4 : 1);
      var row = y * W * 4, s = Math.round(shift) * 4;
      for (var x = 0; x < W * 4; x += 4) {
        var src = row + clamp(x + s, 0, W * 4 - 4), rs = row + clamp(x + s + off, 0, W * 4 - 4);
        d[row + x] = d[rs]; d[row + x + 1] = d[src + 1]; d[row + x + 2] = d[src + 2];
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.18 * fuerza; ctx.fillStyle = '#000';
    for (var yy = 0; yy < H; yy += 6) ctx.fillRect(0, yy, W, 2);
    var by = ((f * 37) % (H + 300)) - 150;
    ctx.globalAlpha = 0.5 * fuerza; ctx.fillStyle = '#fff';
    for (var i = 0; i < 260; i++) ctx.fillRect(V.hash(i + f) * W, by + V.hash(i * 3 + f) * 120, 4 + V.hash(i * 7) * 30, 3);
    ctx.restore();
  };
  // degradado oscuro arriba para que los textos se lean sobre el HUD del juego (a = opacidad, hasta = y donde se apaga)
  K.sombraArriba = function (a, hasta) {
    if (a <= 0) return;
    var g = ctx.createLinearGradient(0, 0, 0, hasta || 760);
    g.addColorStop(0, 'rgba(25,6,32,' + (a * 0.9) + ')'); g.addColorStop(0.55, 'rgba(25,6,32,' + (a * 0.6) + ')'); g.addColorStop(1, 'rgba(25,6,32,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hasta || 760);
  };
  // placa redondeada detrás de un rótulo
  K.placa = function (x, y, w, h, a) {
    ctx.save(); V.rr(ctx, x - w / 2, y - h / 2, w, h, Math.min(h / 2, 46));
    ctx.fillStyle = 'rgba(43,22,48,' + (a == null ? 0.78 : a) + ')'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke(); ctx.restore();
  };
  // sello ✓ / ✗ que cae con golpe
  K.sello = function (t, t0, ok, x, y, r) {
    if (t < t0) return;
    r = r || 110;
    var d = t - t0, k = d < 0.14 ? 2.2 - 1.2 * E.out(d / 0.14) : 1 + 0.05 * Math.exp(-(d - 0.14) * 12) * Math.sin((d - 0.14) * 40);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12); ctx.scale(k, k);
    ctx.globalAlpha = Math.min(1, d / 0.08);
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = ok ? C.ok : '#e8283c'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 14; ctx.strokeStyle = C.cream; ctx.stroke();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 30; ctx.strokeStyle = C.cream; ctx.beginPath();
    if (ok) { ctx.moveTo(-r * 0.45, 0); ctx.lineTo(-r * 0.1, r * 0.35); ctx.lineTo(r * 0.5, -r * 0.35); }
    else { ctx.moveTo(-r * 0.38, -r * 0.38); ctx.lineTo(r * 0.38, r * 0.38); ctx.moveTo(r * 0.38, -r * 0.38); ctx.lineTo(-r * 0.38, r * 0.38); }
    ctx.stroke(); ctx.restore();
  };
  // flecha de doble punta entre dos celdas (en pantalla)
  K.intercambio = function (t, t0, p1, p2, color) {
    if (t < t0) return;
    var k = K.p(t, t0, t0 + 0.2, E.back), mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, a = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    var L = Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.55 * k;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(a); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    [[30, C.ink], [16, color || C.gold]].forEach(function (st) {
      ctx.lineWidth = st[0]; ctx.strokeStyle = st[1]; ctx.fillStyle = st[1];
      ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke();
      [-1, 1].forEach(function (sg) {
        ctx.beginPath(); ctx.moveTo(sg * (L + 14), 0); ctx.lineTo(sg * (L - 22), -24); ctx.lineTo(sg * (L - 22), 24); ctx.closePath();
        ctx.stroke(); ctx.fill();
      });
    });
    ctx.restore();
  };
  // contador de cascada grande (x7)
  K.contador = function (t, t0, n, x, y, color) {
    if (t < t0) return;
    var k = V.pop(t - t0, 0.16);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.08); ctx.scale(k, k);
    V.texto(ctx, 'x' + n, 0, 0, { size: 190, fill: color || C.gold, strokeW: 30 });
    ctx.restore();
  };

  /* ---------------- tarjeta final ---------------- */
  K.tarjetaFinal = function (t, t0, o) {
    o = o || {};
    if (t < t0) return;
    var d = t - t0;
    V.fondo(ctx, C.mint, '#effff8');
    V.toldo(ctx, C.pink, '#ffffff', 130);
    // Cocardo y Cherry asomándose
    var coc = K.retrato('cocardo', o.moodCocardo || 'burlon'), che = K.retrato('cereza', o.moodCherry || 'coqueta');
    var e1 = K.p(t, t0 + 0.1, t0 + 0.45, E.back), e2 = K.p(t, t0 + 0.2, t0 + 0.55, E.back);
    if (coc.complete) ctx.drawImage(coc, -60 - (1 - e1) * 400, 1010, 560, 560);
    if (che.complete) ctx.drawImage(che, 560 + (1 - e2) * 400, 1010, 560, 560);
    var k1 = V.pop(d, 0.26);
    ctx.save(); ctx.translate(W / 2, 440); ctx.scale(k1, k1); ctx.rotate(-0.03);
    V.texto(ctx, 'Cocardo', 0, -40, { size: 190, fill: C.pink, strokeW: 30 });
    V.texto(ctx, '¡Rescate Helado!', 0, 120, { font: F.script, size: 118, fill: C.cream, stroke: C.drama, strokeW: 18 });
    ctx.restore();
    var k2 = V.pop(d - 0.35, 0.24);
    ctx.save(); ctx.translate(W / 2, 790); ctx.scale(k2, k2);
    V.rr(ctx, -400, -78, 800, 156, 78); ctx.fillStyle = C.pink; ctx.fill(); ctx.lineWidth = 12; ctx.strokeStyle = C.ink; ctx.stroke();
    V.texto(ctx, o.cta || 'JUEGA GRATIS', 0, 4, { size: 92, fill: C.cream, strokeW: 16, sombra: false });
    ctx.restore();
    K.popTexto(t, t0 + 0.55, o.sub || 'link en el perfil', W / 2, 935, { font: F.body, weight: '900', size: 62, fill: C.gold, strokeW: 13 });
    K.popTexto(t, t0 + 0.7, 'juego de fans · no oficial', W / 2, 1015, { font: F.body, weight: '800', size: 36, fill: C.cream, strokeW: 9 });
  };

  /* ---------------- sonido propio (whoosh, subida, golpe, rebobinado) ---------------- */
  function ruido(octx, secs) {
    var n = Math.ceil(secs * SR), b = octx.createBuffer(1, n, SR), d = b.getChannelData(0), s = 12345;
    for (var i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
    return b;
  }
  function env(g, t, a, sus, r, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + sus);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + sus + r);
  }
  var SFX = {
    whoosh: function (o, out, t, p) {
      var src = o.createBufferSource(); src.buffer = ruido(o, 1);
      var bp = o.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(3800, t + 0.18); bp.frequency.exponentialRampToValueAtTime(500, t + 0.4);
      var g = o.createGain(); env(g, t, 0.12, 0.05, 0.25, 0.7 * (p.v || 1));
      var pan = o.createStereoPanner(); pan.pan.setValueAtTime(-0.6, t); pan.pan.linearRampToValueAtTime(0.6, t + 0.4);
      src.connect(bp); bp.connect(g); g.connect(pan); pan.connect(out); src.start(t); src.stop(t + 0.6);
    },
    subida: function (o, out, t, p) {
      var d = p.dur || 1.5, src = o.createBufferSource(); src.buffer = ruido(o, d + 0.2);
      var bp = o.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
      bp.frequency.setValueAtTime(200, t); bp.frequency.exponentialRampToValueAtTime(6000, t + d);
      var g = o.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * (p.v || 1), t + d); g.gain.linearRampToValueAtTime(0, t + d + 0.03);
      src.connect(bp); bp.connect(g); g.connect(out); src.start(t); src.stop(t + d + 0.1);
      var os = o.createOscillator(); os.type = 'sawtooth'; os.frequency.setValueAtTime(110, t); os.frequency.exponentialRampToValueAtTime(880, t + d);
      var lp = o.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      var g2 = o.createGain(); g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.12 * (p.v || 1), t + d); g2.gain.linearRampToValueAtTime(0, t + d + 0.03);
      os.connect(lp); lp.connect(g2); g2.connect(out); os.start(t); os.stop(t + d + 0.1);
    },
    golpe: function (o, out, t, p) {
      var os = o.createOscillator(); os.type = 'sine'; os.frequency.setValueAtTime(95, t); os.frequency.exponentialRampToValueAtTime(32, t + 0.6);
      var g = o.createGain(); env(g, t, 0.004, 0.05, 0.75, 1.0 * (p.v || 1));
      os.connect(g); g.connect(out); os.start(t); os.stop(t + 1);
      var src = o.createBufferSource(); src.buffer = ruido(o, 0.6);
      var lp = o.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.4);
      var g2 = o.createGain(); env(g2, t, 0.002, 0.02, 0.4, 0.55 * (p.v || 1));
      src.connect(lp); lp.connect(g2); g2.connect(out); src.start(t); src.stop(t + 0.6);
    },
    rebobinar: function (o, out, t, p) {
      var d = p.dur || 1.2;
      for (var i = 0; i < d / 0.11; i++) {
        var tt = t + i * 0.11, os = o.createOscillator(); os.type = 'sawtooth';
        os.frequency.setValueAtTime(900 + (i % 3) * 300, tt); os.frequency.exponentialRampToValueAtTime(2600, tt + 0.1);
        var bp = o.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
        var g = o.createGain(); env(g, tt, 0.005, 0.06, 0.04, 0.13 * (p.v || 1));
        os.connect(bp); bp.connect(g); g.connect(out); os.start(tt); os.stop(tt + 0.13);
      }
      var src = o.createBufferSource(); src.buffer = ruido(o, d + 0.2);
      var hp = o.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      var g3 = o.createGain(); env(g3, t, 0.05, d - 0.1, 0.1, 0.12 * (p.v || 1));
      src.connect(hp); hp.connect(g3); g3.connect(out); src.start(t); src.stop(t + d + 0.2);
    },
    rayon: function (o, out, t, p) {   // disco rayado
      var os = o.createOscillator(); os.type = 'sawtooth';
      os.frequency.setValueAtTime(300, t); os.frequency.linearRampToValueAtTime(1400, t + 0.07); os.frequency.linearRampToValueAtTime(200, t + 0.2);
      var bp = o.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.5;
      var g = o.createGain(); env(g, t, 0.005, 0.12, 0.1, 0.4 * (p.v || 1));
      os.connect(bp); bp.connect(g); g.connect(out); os.start(t); os.stop(t + 0.3);
    },
    pop: function (o, out, t, p) {
      var os = o.createOscillator(); os.type = 'sine'; os.frequency.setValueAtTime(p.f || 700, t); os.frequency.exponentialRampToValueAtTime((p.f || 700) * 2.2, t + 0.06);
      var g = o.createGain(); env(g, t, 0.003, 0.02, 0.09, 0.35 * (p.v || 1));
      os.connect(g); g.connect(out); os.start(t); os.stop(t + 0.2);
    },
  };
  function renderSfx(lista, dur) {
    if (!lista.length) return Promise.resolve(null);
    var o = new OfflineAudioContext(2, Math.ceil((dur + 1) * SR), SR);
    var comp = o.createDynamicsCompressor(); comp.connect(o.destination);
    lista.forEach(function (s) { if (SFX[s[0]]) SFX[s[0]](o, comp, Math.max(0, s[1]), s[2] || {}); });
    return o.startRendering();
  }

  /* ---------------- montaje ---------------- */
  K.montaje = function (M) {
    var DUR = M.dur, clips = (M.clips || []).map(prepararClip);
    clips.sort(function (a, b) { return a.de - b.de; });
    M.clips = clips;
    K.M = M;

    function clipEn(t) {
      var c = null;
      for (var i = 0; i < clips.length; i++) if (t >= clips[i].de && t < clips[i].a) c = clips[i];
      return c;
    }

    function preparar() {
      cv = V.lienzo(); ctx = cv.getContext('2d');
      return V.fuentesListas().then(function () {
        var nom = Object.keys(M.tomas || {});
        return Promise.all(nom.map(function (n) { return cargarToma(n, M.tomas[n]); }));
      }).then(function () {
        if (M.antes) M.antes();
        K.icono('hand');
        return K.precargar();
      }).then(function () {
        return mezclarAudio();
      });
    }

    function mezclarAudio() {
      var A = M.audio || {}, grupos = {}, juegoG = A.juego == null ? 1 : A.juego;
      function poner(g, item) { (grupos[g] = grupos[g] || []).push(item); }
      // sonidos del juego remapeados a cada clip (en cámara lenta suenan a su hora, sin estirarse)
      clips.forEach(function (c) {
        if (c.mudo) return;
        var tm = tomas[c.toma];
        (tm.sonidos || []).forEach(function (s) {
          if (A.filtro && !A.filtro(s, c)) return;
          var t = salidaDe(c, s.t);
          if (t == null || t < c.de - 0.001 || t >= c.a) return;
          var g = (A.volumen && A.volumen[s.name] != null ? A.volumen[s.name] : 1) * juegoG * (c.vol == null ? 1 : c.vol);
          if (g > 0) poner(g.toFixed(2), [s.name, s.opts || {}, t]);
        });
      });
      (A.extra || []).forEach(function (e) { poner((e[3] == null ? 1 : e[3]).toFixed(2), [e[0], e[1] || {}, e[2]]); });
      var claves = Object.keys(grupos);
      var promesas = claves.map(function (k) { return V.renderSonidos(grupos[k], DUR + 1); });
      promesas.push(renderSfx(A.sfx || [], DUR));
      var mus = A.musica || [];
      promesas.push(mus.length ? Cocardo.Audio._renderMusic(Math.ceil((DUR + 20) / 18.4)) : Promise.resolve(null));
      return Promise.all(promesas).then(function (r) {
        var p = V.pista(DUR);
        claves.forEach(function (k, i) { V.mezclar(p, r[i], 0, { gain: +k }); });
        var sfx = r[claves.length], musica = r[claves.length + 1];
        if (sfx) V.mezclar(p, sfx, 0, { gain: A.sfxGain || 1 });
        if (musica) {
          mus.forEach(function (m) {
            var tmp = V.pista(DUR);
            V.mezclar(tmp, musica, m.t0, { desde: m.desde || 0, dur: (m.t1 - m.t0), gain: m.gain == null ? 1.6 : m.gain,
              fadeIn: m.fadeIn || 0.02, fadeOut: m.fadeOut || 0.4 });
            // atenuar la música bajo momentos clave
            // b = [desde, hasta, nivel]: baja en 80 ms, sube en 250 ms
            (m.bajar || []).forEach(function (b) {
              var lvl = b[2] == null ? 0.25 : b[2];
              var i0 = Math.max(0, Math.floor((b[0] - 0.08) * SR)), i1 = Math.min(tmp[0].length, Math.ceil((b[1] + 0.25) * SR));
              for (var i = i0; i < i1; i++) {
                var tt = i / SR, gk = lvl;
                if (tt < b[0]) gk = lerp(1, lvl, (tt - (b[0] - 0.08)) / 0.08);
                else if (tt > b[1]) gk = lerp(lvl, 1, (tt - b[1]) / 0.25);
                tmp[0][i] *= gk; tmp[1][i] *= gk;
              }
            });
            for (var ch = 0; ch < 2; ch++) for (var i = 0; i < p[ch].length; i++) p[ch][i] += tmp[ch][i];
          });
        }
        V.normalizar(p, 0.5);
        return { duracion: DUR, fps: 30, wav: V.wavBase64(p) };
      });
    }

    function dibujar(t) {
      var c = clipEn(t);
      var pend = [];
      var info = null, img = null;
      if (c) {
        var tm = tomas[c.toma], s = K.srcDe(c, t), i = indice(tm, s);
        pend.push(imagen(tm, i).then(function (im) { img = im; }));
        for (var k = 1; k <= 3; k++) imagen(tm, indice(tm, K.srcDe(c, t + k / 30)));
      }
      return Promise.all(pend).then(function () {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        if (c && img) {
          var s = K.srcDe(c, t), cam = camaraDe(c, t);
          var sh = M.temblor ? K.temblor(t, M.temblor) : { x: 0, y: 0 };
          // golpe de zoom al entrar con transición 'golpe'
          if (c.trans === 'golpe') cam.z *= 1 + 0.14 * (1 - K.p(t, c.de, c.de + 0.22, E.out));
          var bar = 0;
          if (c.trans === 'barrido') bar = (1 - K.p(t, c.de, c.de + 0.16, E.out)) * 260;
          info = dibujarFotograma(img, cam, sh.x + bar, sh.y, c.grado, c.libre);
          if (bar > 2) { ctx.save(); ctx.globalAlpha = 0.35; dibujarFotograma(img, cam, sh.x + bar * 1.6, sh.y, c.grado, c.libre); ctx.restore(); }
          if (c.dedo !== false) { var dp = dedoEn(tomas[c.toma], s); if (dp) dibujarDedo(info, dp); }
          if (c.vineta !== false) vineta(c.vineta);
          if (c.trans === 'flash') K.flash(t, c.de, 0.2, '#fff', 0.85);
          if (c.trans === 'negro') K.negro(1 - K.p(t, c.de, c.de + 0.3));
          c._info = info;
        }
        if (M.capas) M.capas(ctx, t, { clip: c, info: info, src: c ? K.srcDe(c, t) : 0 });
        return cv.toDataURL('image/png');
      });
    }

    window.Escena = { duracion: DUR, fps: 30, preparar: preparar, dibujar: dibujar };
  };
})();
