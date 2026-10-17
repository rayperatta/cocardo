/* F01 «¿Cuántas cascadas?» — plantilla de montaje (léeme: tools/video/formatos/F01/README.md).
   Una apertura real que encadena cascadas, con la LISTA DE DOPAMINA de serie:
     cuadro 0  la mano del tutorial ya está sobre el tablero y el gancho ya se lee (la jugada sale a los 0,2 s);
     ritmo     un pop por cascada, empujones de cámara en cada especial y textos del juego que escalan;
     escalada  contador que cambia de color (dorado → rosa → rojo), pops agudos pasada la cascada 10 y temblor creciente;
     tensión   contador tapado («x?») que se destapa con confeti y golpe (clímax), o visible con tramos propios;
     ganas     reto con el nivel en pantalla («NIVEL 5 · juega gratis») y tarjeta de 1 s o menos;
     bucle     la tarjeta sube y deja ver el cuadro 0 tal cual (tablero, mano y gancho): el video se repite solo.
   Uso (tools/video/videos/<id>/montaje.js):
     (function () { var s = document.createElement('script'); s.src = 'formatos/F01/plantilla.js';
       s.onload = function () { F01.montar({ toma: 'D05-2-cascada', nivel: 5, cascadas: 12, contador: 'tapado',
         gancho: ['80 piezas en UNA jugada.', '¿Cuántas cascadas?'] }); };
       document.body.appendChild(s); })();
   Parámetros de F01.montar(p):
     toma       carpeta de dist/cap (tomas de tools/video/formatos/F01/tomas/cascada.cjs)
     nivel      número del nivel (chip del reto y CTA: «JUEGA GRATIS» del 1 al 10, «EMPIEZA GRATIS» después)
     cascadas   las que dice el motor: si la toma no hace esas, el montaje no arranca (window.__error)
     contador   'tapado' (por defecto: se destapa al final) o 'vista'
     gancho     [línea 1 (ya visible en el cuadro 0), línea 2 (entra palabra a palabra)]; ganchoSub: chip opcional
     ganchoHasta  s hasta donde dura el gancho (1,7); después entra el contador
     etiqueta   rótulo del contador ('CUENTA LAS CASCADAS' tapado, 'CASCADAS' a la vista)
     revela     { texto: '¿Acertaste?', dur: 1.5 } (solo tapado) | false
     tramos     [{ nombre, src?, hasta?, vel? (número o [[src0, src1, vel], …]), dur?, congelado? (s), mudo, vol, trans,
                  cam: [[s relativos, {z, x, y}]], musica: false, bajar: [[s0, s1, nivel]], sfx: [[nombre, s, opts]],
                  extra: [[sonido del juego, opts, s, gain]], antes(x), dibujar(ctx, t, x) }] — van tras la cascada
                  (o tras la revelación); sin src siguen donde quedó la toma. x = { de, a, info, ev(nombre) → horas,
                  temblor(t, px, dur), sfx(nombre, t, opts), extra(nombre, opts, t, gain), celda(r, c) → punto en pantalla }
     repeticion { texto: '¿Lo ves?', sub: 'UNA sola jugada', zoom: 1.3 } | false: la apertura otra vez, de cerca y con la
                mano, antes del reto (por defecto solo con el contador tapado)
     reto       { texto: '¿Y tú cuántas haces?', sub: 'NIVEL 5 · juega gratis', dur: 1.3, src?, vel?, y? } | false
     tarjeta    { cta, sub, pie, moodCocardo, moodCherry, dur: 1.0 } (la tarjeta va siempre; los últimos 0,2 s sube)
     vel        velocidad de la cascada (1); entra: s antes del toque en que arranca el video (0,2)
     finA       segundo de la toma en que acaba el clip de la cascada (por defecto: tapado, 0,32 s tras la última
                cascada; a la vista, la marca «fin-cascada»)
     musica     false = sin la cumbia del juego; musicaGain (1,6, el valor por defecto del kit) */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E, V = K.V;
  var XC = 500;          // centro de los textos: la zona segura va de x = 70 a 930
  var ROJO = '#ff4f4f';
  var F01 = (window.F01 = {});

  F01.cta = function (nivel) { return nivel <= 10 ? 'JUEGA GRATIS' : 'EMPIEZA GRATIS'; };
  F01.subReto = function (nivel) { return 'NIVEL ' + nivel + (nivel <= 10 ? ' · juega gratis' : ' · tu turno'); };
  F01.XC = XC;

  // Confeti determinista (mismo resultado en cada render): ráfaga desde (x, y) hacia arriba
  var COLORES = [C.pink, C.gold, C.mint, C.ice, C.cream, C.cherry, '#9be35a'];
  F01.confeti = function (ctx, t, t0, x, y, o) {
    o = o || {};
    var d = t - t0, dur = o.dur || 1.7;
    if (d < 0 || d > dur) return;
    var n = o.n || 110, f = o.fuerza || 1, abanico = o.abanico || 2.4, k = 2.4, g = 1500;
    var sal = 1 - K.p(d, dur * 0.65, dur);
    ctx.save();
    for (var i = 0; i < n; i++) {
      var h1 = V.hash(i * 1.37 + 0.51), h2 = V.hash(i * 2.11 + 3.1), h3 = V.hash(i * 3.73 + 7.7), h4 = V.hash(i * 5.3 + 1.9);
      var ang = -Math.PI / 2 + (h1 - 0.5) * abanico, vel = (1100 + h2 * 1900) * f;
      var e = (1 - Math.exp(-k * d)) / k;
      var px = x + Math.cos(ang) * vel * e, py = y + Math.sin(ang) * vel * e + 0.5 * g * d * d * (0.5 + h3 * 0.5);
      var w = 16 + h3 * 16, h = 9 + h4 * 9, rot = h4 * 6 + d * (6 + h1 * 10) * (h2 > 0.5 ? 1 : -1);
      ctx.save();
      ctx.globalAlpha = sal;
      ctx.translate(px, py); ctx.rotate(rot); ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(d * 9 + i)));
      ctx.fillStyle = COLORES[i % COLORES.length];
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.restore();
  };

  F01.montar = function (p) {
    fetch('/cap/' + p.toma + '/toma.json').then(function (r) {
      if (!r.ok) throw new Error('no encontré la toma ' + p.toma + ' en dist/cap (¿la capturaste?)');
      return r.json();
    }).then(function (tm) { construir(p, tm); }).catch(function (e) { window.__error = 'F01: ' + e.message; });
  };

  function construir(p, tm) {
    var tapado = p.contador !== 'vista', v = p.vel || 1, entra = p.entra == null ? 0.2 : p.entra;
    var llega = tm.dedo.filter(function (d) { return d.llega; })[0];
    var toque = llega && tm.dedo.filter(function (d) { return d.abajo && d.t >= llega.t; })[0];
    if (!toque) throw new Error('la toma no tiene el dedo de la apertura');
    var marca = function (n) { var m = tm.marcas.filter(function (x) { return x.nombre === n; })[0]; return m ? m.t : null; };
    var finC = marca('fin-cascada');
    var casc = tm.sonidos.filter(function (s) { return s.name === 'match' && s.t >= toque.t && s.t <= finC + 0.05; });
    var N = casc.reduce(function (m, s) { return Math.max(m, (s.opts && s.opts.cascade) || 0); }, 0);
    if (p.cascadas != null && N !== p.cascadas) throw new Error('la toma hace ' + N + ' cascadas y la ficha dice ' + p.cascadas);
    var src0 = toque.t - entra, ultima = casc[casc.length - 1].t;
    var finA = p.finA != null ? p.finA : tapado ? ultima + 0.32 : finC;
    var tA = (finA - src0) / v;
    var ganchoHasta = p.ganchoHasta || 1.7;
    var nivel = p.nivel;
    var tarjeta = Object.assign({ dur: 1.0, cta: F01.cta(nivel), sub: 'link en el perfil', pie: 'cocardo.app',
      moodCocardo: 'llorando', moodCherry: 'coqueta' }, p.tarjeta || {});

    // ---------- cámara de la cascada: empuje lento y un golpe de zoom en cada especial ----------
    var base = function (t) { return 1 + 0.07 * K.clamp(t / tA, 0, 1); };
    var cam = [[0, { z: 1, x: 540, y: 1030 }]], ult = -1;
    tm.sonidos.forEach(function (s) {
      if (['bomba', 'paleta', 'copa', 'combo'].indexOf(s.name) < 0 || s.t < toque.t || s.t > finA) return;
      var t = (s.t - src0) / v;
      if (t - ult < 0.5 || t + 0.42 > tA) return;
      ult = t;
      cam.push([t, { z: base(t), x: 540, y: 1030 }], [t + 0.09, { z: base(t) + 0.04, x: 540, y: 1030 }, 'out'],
        [t + 0.42, { z: base(t + 0.42), x: 540, y: 1030 }]);
    });
    cam.push([tA, { z: base(tA), x: 540, y: 1030 }]);

    // ---------- fases: cascada → (revelación) → tramos → (reto) → tarjeta ----------
    var fases = [], tt = 0, srcFin = finA;
    var A = { toma: 'a', de: 0, a: tA, src: src0, vel: [[0, v]], cam: cam };
    fases.push({ nombre: 'cascada', de: 0, a: tA, clip: A, tr: {}, dibujar: dibujarCascada });
    tt = tA;
    function agregar(tr, dibujar) {
      var src = tr.src != null ? tr.src : srcFin, clip = { toma: 'a', de: tt, src: src, mudo: !!tr.mudo, trans: tr.trans,
        dedo: tr.dedo, vineta: tr.vineta, grado: tr.grado, vol: tr.vol }, dur, fin;
      if (tr.congelado != null) { dur = tr.congelado; clip.vel = [[0, 0]]; clip.mudo = true; fin = src; }
      else if (Array.isArray(tr.vel)) {
        var r = K.tramos(tr.vel, tr.rampa); clip.vel = r.vel; clip.src = src = r.src; dur = tr.dur || r.dur; fin = tr.vel[tr.vel.length - 1][1];
      } else {
        var vv = tr.vel == null ? 1 : tr.vel;
        dur = tr.dur != null ? tr.dur : (tr.hasta - src) / vv; clip.vel = [[0, vv]]; fin = src + dur * vv;
      }
      clip.a = tt + dur;
      clip.cam = tr.cam ? tr.cam.map(function (k) { return [tt + k[0], k[1], k[2]]; }) : [[tt, { z: 1, x: 540, y: 960 }]];
      var f = { nombre: tr.nombre || 'tramo', de: tt, a: tt + dur, clip: clip, tr: tr, dibujar: dibujar || tr.dibujar };
      fases.push(f); tt += dur; srcFin = fin;
      return f;
    }
    var revela = tapado && p.revela !== false ? Object.assign({ texto: '¿Acertaste?', dur: 1.5 }, p.revela || {}) : null;
    if (revela) agregar({ nombre: 'revela', dur: revela.dur, vel: 1, bajar: [[-0.05, 0.5, 0.45]] }, dibujarRevela);
    (p.tramos || []).forEach(function (tr) { agregar(tr); });
    // «¿Lo ves?»: la apertura otra vez, de cerca y con la mano (ganas de jugar; por defecto con el contador tapado)
    var rep = (p.repeticion == null ? tapado : p.repeticion) ? Object.assign({ texto: '¿Lo ves?', sub: 'UNA sola jugada' }, p.repeticion || {}) : null;
    if (rep) {
      var jg = (tm.marcas.filter(function (m) { return m.nombre === 'jugada'; })[0] || {}).datos, tb = tm.tablero;
      var cx = jg ? tb.x0 + (jg.a.c + jg.b.c) / 2 * tb.paso : 540, cy = jg ? tb.y0 + (jg.a.r + jg.b.r) / 2 * tb.paso : 1000;
      var zr = rep.zoom || 1.3, foco = { z: zr, x: cx, y: Math.max(cy, 760) };
      agregar({ nombre: 'repeticion', src: toque.t - 0.32, hasta: casc[0].t + 0.55, trans: 'barrido', vol: 0.85,
        cam: [[0, { z: 1.12, x: cx, y: foco.y }], [0.35, foco, 'out']], bajar: [[0, 1.2, 0.6]] }, function (ctx, t, x) {
        K.sombraArriba(0.8, 700);
        ctx.save(); ctx.globalAlpha = K.p(t, x.de, x.de + 0.12); K.placa(XC, 378, 820, 210, 0.78); ctx.restore();
        K.popTexto(t, x.de + 0.04, rep.texto, XC, 345, { size: 100, maxW: 760, fill: C.gold, strokeW: 20, rot: -0.03 });
        if (rep.sub) K.popTexto(t, x.de + 0.3, rep.sub, XC, 440, { font: F.body, weight: '900', size: 50, fill: C.cream, strokeW: 12 });
      });
    }
    var reto = p.reto === false ? null : Object.assign({ texto: '¿Y tú cuántas haces?', sub: F01.subReto(nivel), dur: 1.3 }, p.reto || {});
    if (reto) agregar({ nombre: 'reto', src: reto.src, vel: reto.vel == null ? 1 : reto.vel, dur: reto.dur, trans: reto.trans }, dibujarReto);
    var fTar = agregar({ nombre: 'tarjeta', src: src0, congelado: tarjeta.dur }, dibujarTarjeta);
    fTar.clip.dedo = true;
    var DUR = tt;

    function faseEn(t) { for (var i = fases.length - 1; i >= 0; i--) if (t >= fases[i].de) return fases[i]; return fases[0]; }
    function xDe(f, extra) {
      return { de: f.de, a: f.a, info: extra ? extra.info : f.clip._info, ev: function (n) { return evDe(f, n); },
        celda: function (r, c) { var i = (extra && extra.info) || f.clip._info, q = K.celda('a', r, c); return i ? K.aPantalla(i, q.x, q.y) : q; } };
    }
    function evDe(f, n) { return K.eventos(n, function (s, c) { return c === f.clip; }).map(function (e) { return e.t; }); }

    // ---------- textos ----------
    function gancho(ctx, t) {
      // placa oscura detrás: el gancho se lee aunque el HUD del juego tenga un globo de diálogo debajo
      var g = p.gancho || [], sale = ganchoHasta, a = 1 - K.p(t, sale - 0.15, sale);
      K.sombraArriba(0.6 * a, 700);
      if (a > 0) { ctx.save(); ctx.globalAlpha = a; K.placa(XC, 400, 890, p.ganchoSub ? 300 : 250, 0.8); ctx.restore(); }
      if (g[0]) K.popTexto(t, -0.4, g[0], XC, 318, { size: p.ganchoSize1 || 86, maxW: 820, hasta: sale, strokeW: 17 });
      if (g[1]) K.palabras(t, 0.12, g[1], XC, 428, { size: p.ganchoSize2 || 92, maxW: 840, hasta: sale, ritmo: 0.07 });
      if (p.ganchoSub) K.popTexto(t, 0.55, p.ganchoSub, XC, 514, { font: F.body, weight: '900', size: 40, fill: C.mint, strokeW: 10, hasta: sale });
    }
    var CASC = [];   // [{t, n}] en el video
    function cascadaEn(t) { var n = 0, t0 = 0; CASC.forEach(function (e) { if (t >= e.t) { n = e.n; t0 = e.t; } }); return { n: n, t0: t0 }; }
    function colorDe(n) { return n < N * 0.34 ? C.gold : n < N * 0.67 ? C.pink : ROJO; }
    function placa(ctx, t, t0, color, rotulo) {
      var kb = K.p(t, t0, t0 + 0.2, E.back);
      K.placa(XC, 418, 420 * kb, 250 * kb, 0.74);
      if (color && kb > 0.5) {
        ctx.save(); V.rr(ctx, XC - 210 * kb, 418 - 125 * kb, 420 * kb, 250 * kb, 46);
        ctx.lineWidth = 8; ctx.strokeStyle = color; ctx.stroke(); ctx.restore();
      }
      var et = rotulo || p.etiqueta || (tapado ? 'CUENTA LAS CASCADAS' : 'CASCADAS');
      K.popTexto(t, t0, et, XC, 340, { font: F.body, weight: '900', size: 38, fill: C.cream, strokeW: 10, sinPop: true, maxW: 380 });
    }
    function dibujarCascada(ctx, t) {
      if (t < ganchoHasta) gancho(ctx, t);
      var c = cascadaEn(t), tIn = ganchoHasta;
      if (t < tIn || !c.n) return;
      var t0 = Math.max(tIn, c.t0);
      K.sombraArriba(0.55 * K.p(t, tIn, tIn + 0.2), 600);
      placa(ctx, t, tIn, colorDe(c.n));
      if (tapado) {
        // «x?» que salta con cada cascada: se cuentan los pops, no el número
        var k = V.pop(t - t0, 0.16), rot = -0.08 + 0.1 * Math.sin((t - t0) * 30) * Math.exp(-(t - t0) * 8);
        ctx.save(); ctx.translate(XC, 452); ctx.rotate(rot); ctx.scale(k, k);
        V.texto(ctx, 'x?', 0, 0, { size: 170, fill: colorDe(c.n), strokeW: 28 });
        ctx.restore();
      } else {
        K.contador(t, t0, c.n, XC, 452, colorDe(c.n));
        if (c.n === N) K.flash(t, c.t0, 0.22, '#fff', 0.5);
      }
    }
    function dibujarRevela(ctx, t, x) {
      var t0 = x.de;
      K.sombraArriba(0.85, 820);
      placa(ctx, t, -1, ROJO, 'CASCADAS');
      ctx.save(); ctx.translate(XC, 452); ctx.rotate(-0.08); var k = V.pop(t - t0, 0.24) * (1 + 0.05 * Math.sin((t - t0) * 7));
      ctx.scale(k, k); V.texto(ctx, 'x' + N, 0, 0, { size: 200, fill: C.gold, strokeW: 30 }); ctx.restore();
      K.flash(t, t0, 0.3, '#fff', 0.45);
      F01.confeti(ctx, t, t0, XC, 470, { n: 120 });
      if (revela.texto) K.popTexto(t, t0 + 0.32, revela.texto, XC, 650, { size: 96, fill: C.cream, strokeW: 19, rot: -0.04 });
    }
    function dibujarReto(ctx, t, x) {
      var ry = reto.y || 268;
      K.sombraArriba(0.88, 760);
      ctx.save(); ctx.globalAlpha = K.p(t, x.de, x.de + 0.12); K.placa(XC, ry + 48, 890, reto.sub ? 220 : 140, 0.78); ctx.restore();
      K.palabras(t, x.de + 0.02, reto.texto, XC, ry, { size: reto.size || 90, maxW: 860, ritmo: 0.07, hasta: x.a + 0.12 });
      if (reto.sub) K.popTexto(t, x.de + 0.35, reto.sub, XC, ry + 100, { font: F.body, weight: '900', size: 48, fill: C.mint, strokeW: 12 });
    }
    function dibujarTarjeta(ctx, t, x) {
      // la tarjeta entra ya armada (título y personajes) y en 0,6 s salen el botón, el link y el dominio;
      // en los últimos 0,2 s sube y deja el cuadro 0 tal cual: tablero, mano y gancho
      var fin = (Math.round(x.a * 30) - 1) / 30, k = K.p(t, fin - 0.2, fin, E.in);   // fin = último fotograma que graba grabar.cjs
      if (k > 0) gancho(ctx, 0);
      if (k >= 1) return;
      ctx.save(); ctx.translate(0, -H * 1.05 * k);
      K.tarjetaFinal(t, x.de - 0.3, { cta: tarjeta.cta, sub: tarjeta.sub, pie: tarjeta.pie, moodCocardo: tarjeta.moodCocardo,
        moodCherry: tarjeta.moodCherry });
      ctx.restore();
    }

    // ---------- música (cumbia del juego) y efectos ----------
    var mus = [], cur = null;
    fases.forEach(function (f) {
      var on = p.musica !== false && f.tr.musica !== false;
      if (!on) { cur = null; return; }
      if (cur && Math.abs(cur.t1 - f.de) < 1e-6) cur.t1 = f.a;
      else { cur = { t0: f.de, t1: f.a, desde: f.de, gain: p.musicaGain || 1.6, fadeIn: f.de ? 0.04 : 0.02, fadeOut: 0.05, bajar: [] }; mus.push(cur); }
      (f.tr.bajar || []).forEach(function (b) { cur.bajar.push([f.de + b[0], f.de + b[1], b[2]]); });
    });
    if (mus.length) mus[mus.length - 1].fadeOut = 0.45;
    var sfx = [], extra = [];
    fases.forEach(function (f, i) {
      if (i && (f.clip.trans === 'barrido' || f.clip.trans === 'golpe')) sfx.push(['whoosh', f.de - 0.03, { v: 0.8 }]);
      (f.tr.sfx || []).forEach(function (s) { sfx.push([s[0], f.de + s[1], s[2] || {}]); });
      (f.tr.extra || []).forEach(function (e) { extra.push([e[0], e[1] || {}, f.de + e[2], e[3]]); });
    });
    var tCasc = (ultima - src0) / v;
    if (p.ganchoSub) sfx.push(['pop', 0.56, { f: 900, v: 0.6 }]);
    if (tapado) {
      sfx.push(['subida', Math.max(0, tA - 1.0), { dur: Math.min(1.0, tA), v: 0.6 }]);
      if (revela) sfx.push(['golpe', tA, { v: 0.9 }], ['pop', tA + 0.02, { f: 900 }], ['pop', tA + 0.34, { f: 1200 }]);
    } else sfx.push(['golpe', tCasc, { v: 0.5 }]);
    var reF = fases.filter(function (f) { return f.nombre === 'reto'; })[0];
    if (reF) sfx.push(['pop', reF.de + 0.02, { f: 650, v: 0.7 }], ['pop', reF.de + 0.36, { f: 850, v: 0.7 }]);
    sfx.push(['whoosh', fTar.de - 0.04, {}], ['pop', fTar.de + 0.06, { f: 600 }], ['pop', fTar.de + 0.26, { f: 800 }],
      ['pop', fTar.de + 0.41, { f: 1000, v: 0.6 }], ['whoosh', fTar.a - 0.24, { v: 0.7 }]);

    K.montaje({
      dur: DUR,
      tomas: { a: p.toma },
      clips: fases.map(function (f) { return f.clip; }),
      antes: function () {
        // cascadas a su hora en el video (el número sale del juego: opts.cascade)
        var lista = K.eventos('match', function (s, c) { return c === A; }).filter(function (e) { return e.src >= toque.t && e.src <= finC + 0.05; });
        var n = 0;
        lista.forEach(function (e) { var m = e.opts.cascade || n + 1; if (m > n) { n = m; CASC.push({ t: e.t, n: m }); } });
        var tem = [], desde = Math.ceil(N * 0.4);
        CASC.forEach(function (e) {
          if (e.n >= desde) tem.push([e.t, 3 + (e.n - desde) * (9 / Math.max(1, N - desde)), 0.24]);
          // el pop del juego deja de subir de tono en la cascada 10: desde ahí sube con un pop propio
          if (e.n > 10) sfx.push(['pop', e.t + 0.01, { f: 700 * Math.pow(1.07, e.n - 10), v: 0.55 }]);
        });
        ['bomba', 'paleta', 'copa', 'combo'].forEach(function (nm) {
          K.eventos(nm, function (s, c) { return c === A; }).forEach(function (e) { tem.push([e.t, 8, 0.28]); });
        });
        fases.forEach(function (f) {
          if (!f.tr.antes) return;
          var x = xDe(f);
          x.temblor = function (t, px, d) { tem.push([t, px, d || 0.3]); };
          x.sfx = function (nm, t, o) { sfx.push([nm, t, o || {}]); };
          x.extra = function (nm, o, t, g) { extra.push([nm, o || {}, t, g]); };
          f.tr.antes(x);
        });
        K.M.temblor = tem;
        K.retrato('cocardo', tarjeta.moodCocardo); K.retrato('cereza', tarjeta.moodCherry);
        (p.retratos || []).forEach(function (r) { K.retrato(r[0], r[1], r[2]); });
      },
      capas: function (ctx, t, ex) {
        var f = faseEn(t);
        if (f.dibujar) f.dibujar(ctx, t, xDe(f, ex));
      },
      audio: { juego: 1, sfx: sfx, extra: extra, musica: mus },
    });
    F01.fases = fases; F01.N = N; F01.dur = DUR;
  }
})();
