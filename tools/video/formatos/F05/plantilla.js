/* F05 «Reto de hoy #N» — plantilla de montaje (ver tools/video/formatos/F05/README.md).
   Cada video del formato es un montaje corto que carga este archivo y llama a window.F05({...}):
     tools/video/videos/<id>/montaje.js → node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/<id>/montaje.js" …
   Lee: los datos del Reto (generar.cjs → tools/video/videos/<id>/reto.json, calculados con el motor), la toma del tablero
   (tomas/reto.cjs: la caída de las piezas y el tablero quieto, sin jugar), el guion de voces (JSON de voz.py; cada línea
   con su «hueco») y la música elegida (elegidas.json). NUNCA se enseña una jugada: solo el tablero, la fila de emojis y
   el resultado.
   Ediciones (reto.json → edicion, o P.edicion):
     normal     gancho sobre el tablero del día → la fila de emojis del bot honesto cae de a uno (pops que suben de tono,
                contador de movimientos que baja, temblor en 🟧 🟥 🍦) → sello GANÓ/PERDIÓ (confeti o carcajada) → la fila
                del bot que ve las frutas que caen («se puede con N») → reto al espectador con las piezas cayendo
                («tu turno») → tarjeta de 1 s → corte al cuadro 0 (bucle).
     noticiero  el cuadro 0 es la placa «Noticiero de Coco's Scoops» con el retrato de la reportera y el cintillo del Reto
                corriendo; la noticia (huecos «noticia») y el titular que golpea (P.titular); luego lo mismo que normal
                con los emojis en ráfaga.
     semana     («la semana de mi bot», la rama sin ranking del salón de la fama) el marcador de la semana: un sello por
                Reto (verde/rojo), la pregunta y el tablero de hoy.
     salon      lo mismo con los apodos que pidieron salir (P.apodos: [{ apodo, texto }]); sin apodos cae a «semana».
   Huecos del guion: «gancho» (desde 0,15 s), «burla» (termina justo cuando cae el último emoji), «reaccion» (tras el
   sello), «noticia» (noticiero, encadenadas desde 0,15 s), «presenta» (semana/salón, desde 0,15 s), «cierre» (en el reto
   final). Todas con subtítulo del kit. */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, V = K.V, W = K.W, H = K.H, SAFE = K.SAFE;
  var XC = (SAFE.left + SAFE.right) / 2;          // 500: centro de la zona segura
  var CX0 = SAFE.left, CX1 = SAFE.right, CW = CX1 - CX0;
  var EMOJI_FONT = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  var GRANDES = { '🟧': 1, '🟥': 2, '🍦': 3 };   // emojis que tiemblan (más fuerte cuanto más alto)

  function json(ruta) {
    return fetch(K.url(ruta)).then(function (r) {
      if (!r.ok) throw new Error('no encontré ' + ruta + ' (' + r.status + ')');
      return r.json();
    });
  }
  function emojis(s) { return Array.from(String(s || '')).filter(function (c) { return /\S/.test(c) && c !== '️'; }); }
  function cap1(s) { s = String(s || ''); var i = s.search(/[^¿¡«"]/); return i < 0 ? s : s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1); }
  function sobranTxt(n) { return n === 1 ? 'UNO' : String(n); }

  window.F05 = function (P) {
    var musica = P.musica === false ? Promise.resolve(null) : json('dist/estudio/musica/elegidas.json').catch(function () { return null; });
    Promise.all([json(P.datos), P.guion ? json(P.guion) : Promise.resolve({ lineas: [] }), musica]).then(function (r) {
      var D = r[0], toma = P.toma || D.toma;
      return fetch('/cap/' + toma + '/toma.json').then(function (x) {
        if (!x.ok) throw new Error('no encontré la toma ' + toma + ' (captúrala: README de F05)');
        return x.json();
      }).then(function (tm) { construir(P, D, toma, tm, r[1], r[2]); });
    }).catch(function (e) { window.__error = String((e && e.message) || e); });
  };

  function construir(P, D, toma, TM, guion, elegidas) {
    var ed = P.edicion || D.edicion || 'normal';
    if (ed === 'salon' && !(P.apodos && P.apodos.length)) ed = 'semana';
    var L = (Array.isArray(guion) ? guion : guion.lineas || []);
    var huecos = L.map(function (l) { return l.hueco || ''; });
    var durs = L.map(function (l) { return +(l.duracion || l.dur || 0) || Math.max(1.2, String(l.texto || '').length / 11.5); });
    function lineasDe(h) { var o = []; huecos.forEach(function (x, i) { if (x === h) o.push(i); }); return o; }
    var hon = D.honesto, vid = D.vidente, movs = D.movimientos;
    var EH = emojis(hon.emojis), EV = emojis(vid.emojis);
    var marca = function (n) { var m = (TM.marcas || []).filter(function (x) { return x.nombre === n; })[0]; return m ? m.t : null; };
    var tTab = marca('tablero') || 1.07;
    var introDesde = P.introDesde != null ? P.introDesde : 0.22;   // antes, la pantalla todavía se está fundiendo

    /* ---------- tiempos ---------- */
    var T = { hora: [] }, t = 0;
    var gancho = P.gancho || (function () {
      var g = String(D.gancho || ''), i = g.indexOf(':');
      return i > 0 && /^reto/i.test(g) ? [g.slice(0, i).toUpperCase(), cap1(g.slice(i + 1).trim())] : ['RETO #' + D.reto, cap1(g || '¿Tú puedes?')];
    })();
    // apertura según la edición
    if (ed === 'noticiero') {
      var ln0 = lineasDe('noticia'), tn = 0.15;
      ln0.forEach(function (i) { T.hora[i] = tn; tn += durs[i] + 0.25; });
      T.noticiaFin = ln0.length ? tn - 0.25 : 2.4;
      T.titular = P.titularEn != null ? P.titularEn : (ln0.length ? T.hora[ln0[ln0.length - 1]] + 0.2 : 1.6);
      T.abre = Math.max(T.noticiaFin, T.titular + 1.1) + 0.15;   // corte de la placa al tablero
      t = T.abre;
    } else if (ed === 'semana' || ed === 'salon') {
      var lp = lineasDe('presenta'), tp = 0.15;
      lp.forEach(function (i) { T.hora[i] = tp; tp += durs[i] + 0.25; });
      var items = ed === 'salon' ? P.apodos : (D.semana || []);
      T.itemPaso = P.itemPaso || (ed === 'salon' ? 1.2 : 0.42);
      T.item0 = P.item0 != null ? P.item0 : 0;    // el primero ya está en el cuadro 0
      T.pregunta = T.item0 + items.length * T.itemPaso + 0.25;
      T.abre = Math.max(T.pregunta + 1.5, lp.length ? tp - 0.25 + 0.2 : 0);
      t = T.abre;
    } else {
      lineasDe('gancho').forEach(function (i) { T.hora[i] = 0.15; });
      T.abre = 0;
    }
    var semanaSola = ed === 'semana' || ed === 'salon';
    if (!semanaSola) {
      T.gancho = P.ganchoDur != null ? P.ganchoDur : (ed === 'noticiero' ? 0.7 : 0.8);
      T.carta = t + T.gancho;                       // la tarjeta de emojis entra
      // un emoji cada 0,3 s; con filas largas, más rápido para que la cuenta no pase de ~5,2 s (ráfaga en el noticiero)
      T.paso = P.paso || (ed === 'noticiero' ? 0.18 : Math.min(0.3, Math.max(0.18, 5.2 / Math.max(1, EH.length - 1))));
      T.e0 = T.carta + 0.28;                        // primer emoji
      T.ultimo = T.e0 + (EH.length - 1) * T.paso;
      // la burla termina justo cuando cae el último emoji
      lineasDe('burla').forEach(function (i) { T.hora[i] = Math.max(T.carta, T.ultimo + 0.1 - durs[i]); });
      T.sello = T.ultimo + (P.latido != null ? P.latido : 0.5);
      var tr = T.sello + 0.35;
      lineasDe('reaccion').forEach(function (i) { T.hora[i] = tr; tr += durs[i] + 0.25; });
      T.reaccionFin = tr - 0.25;
      T.vidente = P.vidente === false ? null : T.sello + (P.videnteEn != null ? P.videnteEn : 0.6);
      if (T.vidente != null) {
        T.vPaso = P.videntePaso || 0.06;
        T.v0 = T.vidente + 0.3;
        T.vUltimo = T.v0 + (EV.length - 1) * T.vPaso;
        T.sePuede = Math.max(T.vUltimo + 0.35, T.reaccionFin + 0.15);
        T.reto = T.sePuede + (P.sePuedeDur || 0.8);
      } else T.reto = Math.max(T.sello + 1.6, T.reaccionFin + 0.2);
    } else {
      T.reto = t;
    }
    lineasDe('cierre').forEach(function (i) { T.hora[i] = T.reto + 0.3; });
    var cierreFin = 0;
    lineasDe('cierre').forEach(function (i) { cierreFin = Math.max(cierreFin, T.hora[i] + durs[i]); });
    T.tarjeta = Math.max(T.reto + (P.retoDur || (semanaSola ? 1.8 : 1.25)), cierreFin + 0.15);
    T.fin = T.tarjeta + (P.tarjeta || 0.9);
    window.__F05 = T;

    var g = K.guion(P.guion || { lineas: [] }, function (l, i) { return T.hora[i] != null ? T.hora[i] : 999; }, { subtitulos: false });

    /* ---------- clips ---------- */
    var durToma = TM.duracion || 10;
    var clips = [];
    var tableroDe = ed === 'noticiero' ? T.abre : semanaSola ? T.abre : 0;
    var tableroA = semanaSola ? T.tarjeta : T.reto;
    if (tableroA > tableroDe) {
      var vel = Math.min(1, (durToma - tTab - 0.15) / (tableroA - tableroDe));
      clips.push({ toma: 'b', de: tableroDe, a: tableroA, src: tTab, vel: [[0, vel]], mudo: true, vineta: 0.3,
        cam: [[tableroDe, { z: 1, x: 540, y: 1040 }], [tableroDe + 1, { z: 1.03, x: 540, y: 1040 }],
          [T.sello || tableroA, { z: 1.07, x: 540, y: 1000 }], [tableroA, { z: 1.04, x: 540, y: 1020 }]] });
    }
    if (!semanaSola) {
      // «tu turno»: las piezas vuelven a caer (la caída real del Reto) y el tablero queda como en el cuadro 0
      clips.push({ toma: 'b', de: T.reto, a: T.tarjeta, src: introDesde, mudo: true, vineta: 0.3, trans: 'golpe',
        cam: [[T.reto, { z: 1, x: 540, y: 1040 }]] });
    }

    /* ---------- dibujo ---------- */
    var ctx;
    function emoji(ch, x, y, size, a) {
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = a == null ? 1 : a;
      ctx.font = Math.round(size) + 'px ' + EMOJI_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, x, y + size * 0.04); ctx.restore();
    }
    function texto(s, x, y, o) { return V.texto(ctx, s, x, y, o); }
    function pop(tt, t0, s, x, y, o) { K.popTexto(tt, t0, s, x, y, o); }
    function placa(x0, y0, w, h, a, borde) {
      ctx.save(); V.rr(ctx, x0, y0, w, h, 34);
      ctx.fillStyle = 'rgba(43,22,48,' + (a == null ? 0.9 : a) + ')'; ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = borde || 'rgba(255,255,255,0.28)'; ctx.stroke(); ctx.restore();
    }
    function pastilla(s, x, y, o) {
      o = o || {};
      ctx.save(); ctx.font = '900 ' + (o.size || 46) + 'px ' + F.body;
      var w = ctx.measureText(s).width + 70, h = (o.size || 46) + 30;
      V.rr(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = o.fondo || C.pink; ctx.fill();
      ctx.lineWidth = 7; ctx.strokeStyle = o.borde || C.ink; ctx.stroke(); ctx.restore();
      texto(s, x, y + 2, { font: F.body, weight: '900', size: o.size || 46, fill: o.color || C.cream, strokeW: 9, sombra: false });
    }
    // líneas parejas que caben en maxW
    function partir(s, font, maxW) {
      ctx.save(); ctx.font = font;
      var w = ctx.measureText(s).width, pal = s.split(' ');
      if (w <= maxW || pal.length < 2) { ctx.restore(); return [s]; }
      var mejor = null;
      for (var i = 1; i < pal.length; i++) {
        var a = pal.slice(0, i).join(' '), b = pal.slice(i).join(' ');
        var m = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
        if (!mejor || m < mejor.m) mejor = { m: m, l: [a, b] };
      }
      ctx.restore();
      return mejor.l;
    }
    // una línea con las palabras en MAYÚSCULAS (2 letras o más) en dorado: «¿Te sobra más de UNO?»
    var MAYUS = /^[¿¡"«]*[A-ZÁÉÍÓÚÜÑ0-9#]{2,}[?!.,…"»]*$/;
    function lineaRica(l, x, y, size, color, k) {
      ctx.save(); ctx.font = '400 ' + size + 'px ' + F.display;
      var pal = l.split(' '), esp = ctx.measureText(' ').width, ws = pal.map(function (p) { return ctx.measureText(p).width; });
      var tot = ws.reduce(function (a, b) { return a + b; }, 0) + esp * (pal.length - 1), esc = Math.min(1, (CW - 10) / tot);
      ctx.translate(x, y); ctx.scale(k * esc, k * esc);
      var cx = -tot / 2;
      pal.forEach(function (p, i) {
        texto(p, cx + ws[i] / 2, 0, { size: size, fill: color !== C.cream ? color : MAYUS.test(p) ? C.gold : C.cream, strokeW: Math.round(size * 0.17) });
        cx += ws[i] + esp;
      });
      ctx.restore();
    }
    function bloque(tt, t0, s, y, size, o) {
      o = o || {};
      var font = '400 ' + size + 'px ' + F.display, ls = partir(s, font, o.maxW || CW - 20), lh = size * 1.05;
      ls.forEach(function (l, i) {
        var t1 = t0 + i * (o.escalon || 0);
        if (tt < t1) return;
        var k = o.sinPop ? 1 : V.pop(tt - t1, 0.22);
        if (o.latido) k *= 1 + o.latido;
        ctx.save(); ctx.translate(XC, y + (i - (ls.length - 1) / 2) * lh); ctx.rotate(o.rot || 0);
        lineaRica(l, 0, 0, size, o.color || C.cream, k);
        ctx.restore();
      });
      return ls.length;
    }
    function confeti(tt, t0, x, y, n) {
      var d = tt - t0;
      if (d < 0 || d > 2.2) return;
      var cols = [C.pink, C.gold, C.mint, C.ice, C.cherry, '#ffffff', '#ff9a2e'];
      ctx.save();
      for (var i = 0; i < n; i++) {
        var h1 = V.hash(i * 7.31 + 1), h2 = V.hash(i * 3.17 + 2), h3 = V.hash(i * 5.71 + 3);
        var ang = -Math.PI / 2 + (h1 - 0.5) * 2.6, vel = 900 + h2 * 1300;
        var px = x + Math.cos(ang) * vel * d + Math.sin(d * 6 + i) * 30, py = y + Math.sin(ang) * vel * d + 1500 * d * d;
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, d - 1.4) / 0.8);
        ctx.setTransform(1, 0, 0, 1, px, py); ctx.rotate(d * (4 + h3 * 8) + i);
        ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-12, -7, 24, 14);
      }
      ctx.restore();
    }
    // chispas que salen de un emoji grande
    function chispas(tt, t0, x, y, fuerza) {
      var d = tt - t0;
      if (d < 0 || d > 0.45) return;
      ctx.save();
      for (var i = 0; i < 10 + 6 * fuerza; i++) {
        var a = i * 2.39996, r = (40 + 260 * V.hash(i + 3)) * Math.min(1, d / 0.3) * (0.7 + 0.15 * fuerza);
        ctx.globalAlpha = 1 - d / 0.45;
        ctx.fillStyle = [C.gold, '#ffffff', '#ff9a2e', C.pink][i % 4];
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 7 + 3 * fuerza * (1 - d / 0.45), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // banda oscura de arriba (tapa el HUD del juego, también el rótulo del nivel)
    function banda(a, hasta) {
      if (a <= 0) return;
      ctx.save();
      var gr = ctx.createLinearGradient(0, 0, 0, hasta + 70);
      gr.addColorStop(0, 'rgba(32,10,38,' + a + ')');
      gr.addColorStop((hasta - 40) / (hasta + 70), 'rgba(32,10,38,' + a + ')');
      gr.addColorStop(hasta / (hasta + 70), 'rgba(32,10,38,' + (0.93 * a) + ')');
      gr.addColorStop(1, 'rgba(32,10,38,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, hasta + 70); ctx.restore();
    }

    // cabecera del gancho: pastilla «RETO #N» y la pregunta en grande (k = 1 grande, 0 recogida arriba)
    var PREG = 118;
    function cabecera(tt, k, t0, o) {
      o = o || {};
      banda(1, 345 + 205 * k);
      if (k < 0.02 && subArriba(tt)) return;
      pastilla(gancho[0], XC, 262, { size: 48 });
      var size = PREG * (0.48 + 0.52 * k), y = 352 + 112 * k;
      if (k < 0.02) { texto(gancho[1], XC, 352, { size: Math.round(PREG * 0.48), maxW: CW - 30, strokeW: 10 }); return; }
      // latido del gancho al compás del chip (0,3 s) y de la cumbia
      var lat = o.latido ? 0.07 * Math.max(0, 1 - Math.abs(tt - o.latido) / 0.16) : 0;
      bloque(tt, t0 == null ? -9 : t0, gancho[1], y, size, { sinPop: t0 == null, escalon: 0.08, latido: lat });
      if (o.chip) {
        var kc = t0 == null ? (o.chipEn != null ? V.pop(tt - o.chipEn, 0.2) : 1) : V.pop(tt - (t0 + 0.25), 0.2);
        if (kc > 0) { ctx.save(); ctx.translate(XC, 640); ctx.scale(kc, kc); pastilla(o.chip, 0, 0, { size: 34, fondo: C.drama, borde: C.gold }); ctx.restore(); }
      }
    }

    // tarjeta de la fila de emojis (tipo el texto que se pega al compartir)
    var POR_FILA = P.porFila || 10;
    function geoCarta(n, y0, size, porFila) {
      var filas = Math.max(1, Math.ceil(n / porFila)), paso = size + 12;
      return { y0: y0, filas: filas, paso: paso, size: size, porFila: porFila, cab: 136, h: 136 + filas * paso + 96 };
    }
    if (!P.porFila && EH.length > 20) POR_FILA = 12;
    var GC = geoCarta(EH.length, P.cartaY || 560, P.emojiTam || (POR_FILA > 10 ? 56 : 70), POR_FILA);
    function posEmoji(gc, i) {
      var fila = Math.floor(i / gc.porFila), col = i % gc.porFila, enFila = Math.min(gc.porFila, (gc.n || EH.length) - fila * gc.porFila);
      var ancho = gc.porFila * gc.paso - 12, x0 = XC - ancho / 2 + gc.size / 2;
      return { x: x0 + col * gc.paso, y: gc.y0 + gc.cab + gc.paso / 2 + fila * gc.paso, enFila: enFila };
    }
    function quedanEn(tt) {
      var n = 0;
      for (var i = 0; i < EH.length; i++) if (tt >= T.e0 + i * T.paso) n++;
      return { usados: n, quedan: movs - n };
    }
    function contador(tt, x, y) {
      var q = quedanEn(tt), ult = q.usados ? T.e0 + (q.usados - 1) * T.paso : -9;
      var k = 1 + 0.22 * Math.max(0, 1 - (tt - ult) / 0.18);
      var peligro = q.quedan <= 3;
      if (peligro) k *= 1 + 0.07 * Math.max(0, Math.sin((tt - T.e0) * 9));
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      V.rr(ctx, -72, -58, 144, 116, 26);
      ctx.fillStyle = peligro ? '#e8283c' : C.pink; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = C.cream; ctx.stroke();
      texto(String(Math.max(0, q.quedan)), 0, -10, { size: 78, fill: C.cream, strokeW: 13, sombra: false });
      texto(q.quedan === 1 ? 'QUEDA' : 'QUEDAN', 0, 38, { font: F.body, weight: '900', size: 24, fill: C.cream, stroke: false, sombra: false });
      ctx.restore();
    }
    function carta(tt) {
      if (T.carta == null || tt < T.carta - 0.01 || tt >= T.reto + 0.25) return;
      var ent = K.p(tt, T.carta, T.carta + 0.26, K.E.back), sal = K.p(tt, T.reto - 0.02, T.reto + 0.22, K.E.in);
      var sh = K.temblor(tt, temblores);
      ctx.save();
      ctx.translate((1 - ent) * -W * 0.9 + sal * W + sh.x, sh.y);
      var y0 = GC.y0;
      placa(CX0, y0, CW, GC.h, 0.88, C.gold);
      texto(P.botNombre || 'MI BOT', CX0 + 34, y0 + 52, { size: 64, align: 'left', fill: C.gold, strokeW: 12 });
      texto(P.botSub || 'no ve las frutas que caen', CX0 + 34, y0 + 104, { font: F.body, weight: '900', size: 34, align: 'left', fill: C.ice, stroke: false, sombra: false });
      contador(tt, CX1 - 96, y0 + 70);
      GC.n = EH.length;
      EH.forEach(function (ch, i) {
        var te = T.e0 + i * T.paso;
        if (tt < te) return;
        var p = posEmoji(GC, i), d = tt - te, gde = GRANDES[ch] || 0;
        var k = V.pop(d, 0.2) * (1 + (gde ? 0.18 * gde : 0) * Math.max(0, 1 - d / 0.35));
        var dy = -70 * (1 - K.p(tt, te, te + 0.16, K.E.out));
        if (gde) chispas(tt, te, p.x, p.y, gde);
        emoji(ch, p.x, p.y + dy, GC.size * k, Math.min(1, d / 0.06));
      });
      // resultado como en el texto que se comparte («⭐ 18/19 movs»), a la izquierda; a su derecha se recoge el sello
      var tr = T.ultimo + 0.12, yr = GC.y0 + GC.cab + GC.filas * GC.paso + 44;
      if (tt >= tr) {
        var est = hon.gano ? '⭐'.repeat(Math.max(1, hon.estrellas)) : '❌';
        var k2 = V.pop(tt - tr, 0.2);
        ctx.save(); ctx.translate(CX0 + 40, yr); ctx.scale(k2, k2);
        var res = hon.usados + '/' + movs + ' movs';
        var we = 56 * Array.from(est).length;
        Array.from(est).forEach(function (s, j) { emoji(s, 28 + j * 56, 0, 48, 1); });
        texto(res, we + 16, 2, { font: F.body, weight: '900', size: 50, align: 'left', fill: C.cream, stroke: false, sombra: false });
        ctx.restore();
      }
      // sello GANÓ / PERDIÓ: cae grande sobre la fila y a los 0,85 s se recoge junto al resultado
      if (tt >= T.sello) {
        var d2 = tt - T.sello, ks = d2 < 0.14 ? 2.3 - 1.3 * K.E.out(d2 / 0.14) : 1 + 0.05 * Math.exp(-(d2 - 0.14) * 12) * Math.sin((d2 - 0.14) * 40);
        var col = hon.gano ? C.ok : '#e8283c', ys = GC.y0 + GC.cab + GC.filas * GC.paso / 2 - 10;
        var rec = K.p(tt, T.sello + 0.85, T.sello + 1.1, K.E.io), kr = 1 - 0.58 * rec;
        var sx = K.lerp(XC, CX1 - 150, rec), sy = K.lerp(ys, yr, rec);
        var txt = P.sello || (hon.gano ? '¡GANÓ!' : 'PERDIÓ');
        var sub = P.selloSub != null ? P.selloSub : hon.gano ? (hon.sobran === 0 ? 'en el ÚLTIMO' : 'con ' + sobranTxt(hon.sobran) + ' de sobra') : (vid.gano ? 'pero se puede' : '');
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(-0.11); ctx.scale(ks * kr, ks * kr); ctx.globalAlpha = Math.min(1, d2 / 0.06);
        ctx.font = '400 150px ' + F.display;
        var ws = Math.max(ctx.measureText(txt).width + 90, 520), hs = sub ? 250 : 200;
        V.rr(ctx, -ws / 2, -hs / 2, ws, hs, 40); ctx.fillStyle = 'rgba(255,246,234,0.95)'; ctx.fill();
        ctx.lineWidth = 16; ctx.strokeStyle = col; ctx.stroke();
        texto(txt, 0, sub ? -24 : 4, { size: 150, fill: col, stroke: C.ink, strokeW: 14, sombra: false, maxW: ws - 40 });
        if (sub && d2 >= 0.16) {
          var kb = V.pop(d2 - 0.16, 0.2);
          ctx.save(); ctx.translate(0, 82); ctx.scale(kb, kb);
          texto(sub, 0, 0, { font: F.body, weight: '900', size: 52, fill: C.ink, stroke: false, sombra: false, maxW: ws - 50 });
          ctx.restore();
        }
        ctx.restore();
      }
      ctx.restore();
    }
    // panel del bot que ve las frutas que van a caer
    var GV = geoCarta(EV.length, 0, P.videnteTam || 52, P.videnteFila || 12);
    GV.cab = 74; GV.h = GV.cab + GV.filas * GV.paso + 84; GV.n = EV.length;
    function panelVidente(tt) {
      if (T.vidente == null || tt < T.vidente || tt >= T.reto + 0.25) return;
      GV.y0 = GC.y0 + GC.h + 22;
      var ent = K.p(tt, T.vidente, T.vidente + 0.24, K.E.back), sal = K.p(tt, T.reto - 0.02, T.reto + 0.22, K.E.in);
      ctx.save(); ctx.translate((1 - ent) * W * 0.9 - sal * W, 0);
      placa(CX0, GV.y0, CW, GV.h, 0.88, C.mint);
      texto(P.videnteNombre || 'EL QUE SÍ VE LAS FRUTAS QUE CAEN', XC, GV.y0 + 40, { font: F.body, weight: '900', size: 36, fill: C.mint, stroke: false, sombra: false, maxW: CW - 50 });
      EV.forEach(function (ch, i) {
        var te = T.v0 + i * T.vPaso;
        if (tt < te) return;
        var p = posEmoji(GV, i);
        emoji(ch, p.x, p.y, GV.size * V.pop(tt - te, 0.16), 1);
      });
      var tr = T.vUltimo + 0.1;
      if (tt >= tr) {
        var est = vid.gano ? '⭐'.repeat(Math.max(1, vid.estrellas)) : '❌', k2 = V.pop(tt - tr, 0.2);
        var yr = GV.y0 + GV.cab + GV.filas * GV.paso + 36;
        ctx.save(); ctx.translate(XC, yr); ctx.scale(k2, k2);
        var res = vid.usados + '/' + movs + ' movs';
        ctx.font = '900 44px ' + F.body;
        var we = 50 * Array.from(est).length, wt = ctx.measureText(res).width, x0 = -(we + 14 + wt) / 2;
        Array.from(est).forEach(function (s, j) { emoji(s, x0 + 25 + j * 50, 0, 42, 1); });
        texto(res, x0 + we + 14, 2, { font: F.body, weight: '900', size: 44, align: 'left', fill: C.cream, stroke: false, sombra: false });
        ctx.restore();
      }
      ctx.restore();
      // «se puede con N»
      if (tt >= T.sePuede && tt < T.reto + 0.1) {
        var sp = P.sePuedeTexto || (!vid.gano ? 'NI ÉL PUDO' : vid.sobran === 0 ? '¡LO GANÓ EN EL ÚLTIMO!' : '¡SE PUEDE CON ' + vid.sobran + ' DE SOBRA!');
        var yy = Math.min(SAFE.bottom - 70, GV.y0 + GV.h + 86);
        bloque(tt, T.sePuede, sp, yy, P.sePuedeTam || 92, { color: C.gold, rot: -0.04, latido: 0.09 * Math.max(0, 1 - Math.abs(tt - (T.sePuede + 0.4)) / 0.15) });
      }
    }
    // reto final sobre el tablero que vuelve a caer
    var RETO = P.reto || [gancho[1], 'Pega tu fila'];
    function retoFinal(tt) {
      if (tt < T.reto || tt >= T.tarjeta) return;
      cabecera(tt, 1, null, { chip: P.chip || 'EL MISMO TABLERO PARA TODOS HOY' });
      if (RETO[1]) {
        var kk = V.pop(tt - (T.reto + 0.35), 0.24) * (1 + 0.08 * Math.max(0, 1 - Math.abs(tt - (T.reto + 0.9)) / 0.15));
        if (kk > 0) {
          ctx.save(); ctx.translate(XC, P.pegaY || 1335); ctx.scale(kk, kk);
          ctx.font = '400 92px ' + F.display;
          var w = ctx.measureText(RETO[1]).width, wt = w + 110;
          placa(-wt / 2 - 30, -78, wt + 60, 156, 0.9, C.gold);
          texto(RETO[1], -55, 4, { size: 92, fill: C.gold, strokeW: 15 });
          emoji('👇', w / 2 + 10, 6 + 10 * Math.sin((tt - T.reto) * 10), 84, 1);
          ctx.restore();
        }
      }
      pop(tt, T.reto + 0.12, P.tuTurno || '¡TU TURNO!', XC, 850, { size: 120, fill: C.pink, strokeW: 20, rot: -0.05, hasta: T.reto + 1.0 });
    }

    /* ---------- noticiero ---------- */
    function noticiero(tt) {
      if (tt >= T.abre) return;
      V.fondo(ctx, C.drama, '#7d2f8f');
      // placa del noticiero
      ctx.save(); V.rr(ctx, CX0, 250, CW, 150, 30); ctx.fillStyle = '#e8283c'; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = C.cream; ctx.stroke(); ctx.restore();
      texto(P.placa || "NOTICIERO DE COCO'S SCOOPS", XC, 302, { size: 58, fill: C.cream, strokeW: 11, maxW: CW - 40 });
      texto('EN MI JUEGO · ÚLTIMA HORA', XC, 362, { font: F.body, weight: '900', size: 34, fill: C.gold, stroke: false, sombra: false });
      var img = K.retrato(P.presentadora || 'reportera', 'normal');
      if (img.complete) { var bob = Math.sin(tt * 3) * 6; ctx.drawImage(img, XC - 330, 440 + bob, 660, 660); }
      // titular
      if (P.titular && tt >= T.titular) {
        var k = V.pop(tt - T.titular, 0.24);
        ctx.save(); ctx.translate(XC, 1080); ctx.rotate(-0.04); ctx.scale(k, k);
        placa(-CW / 2, -95, CW, 190, 0.94, C.gold);
        texto(P.titular, 0, 4, { size: 96, fill: C.gold, strokeW: 16, maxW: CW - 50 });
        ctx.restore();
      }
      cintillo(tt, 1320);
    }
    function cintillo(tt, y) {
      var s = (P.cintillo || ('RETO #' + D.reto + ' · ' + movs + ' MOVIMIENTOS · MI BOT ' + hon.texto.toUpperCase() + ' · EL RETO DIARIO ES GRATIS')) + '   ✦   ';
      ctx.save(); ctx.fillStyle = C.gold; ctx.fillRect(0, y - 40, W, 80);
      ctx.font = '900 40px ' + F.body; ctx.fillStyle = C.ink; ctx.textBaseline = 'middle';
      var w = ctx.measureText(s).width, x = -((tt * 260) % w);
      for (; x < W; x += w) ctx.fillText(s, x, y + 2);
      ctx.restore();
    }

    /* ---------- semana / salón ---------- */
    function semana(tt) {
      if (tt >= T.abre) return;
      V.fondo(ctx, C.drama, '#7d2f8f');
      var items = ed === 'salon' ? P.apodos : D.semana;
      pastilla(P.semanaTitulo || (ed === 'salon' ? 'SALÓN DE LA FAMA' : 'LA SEMANA DE MI BOT'), XC, 262, { size: 48 });
      // el gancho de la ficha, grande desde el cuadro 0
      var gs = P.semanaGancho || D.gancho;
      if (gs) bloque(tt, -9, gs, 395, 78, { sinPop: true, latido: 0.05 * Math.max(0, 1 - Math.abs(tt - 0.3) / 0.16) });
      if (ed !== 'salon') {
        var gan = 0, per = 0;
        items.forEach(function (x, i) { if (tt >= T.item0 + i * T.itemPaso) { if (x.gano) gan++; else per++; } });
        texto(gan + ' - ' + per, XC, 560, { size: 120, fill: C.gold, strokeW: 20 });
        texto('ganados · perdidos', XC, 636, { font: F.body, weight: '900', size: 34, fill: C.cream, stroke: false, sombra: false });
      }
      items.forEach(function (x, i) {
        var ti = T.item0 + i * T.itemPaso;
        if (tt < ti) return;
        var y = (ed === 'salon' ? 560 : 720) + i * (ed === 'salon' ? 110 : 88), k = ti <= 0 ? 1 : V.pop(tt - ti, 0.2);
        ctx.save(); ctx.translate(XC, y); ctx.scale(k, k);
        placa(-CW / 2 + 20, -40, CW - 40, 80, 0.85, x.gano === false ? '#e8283c' : C.ok);
        texto(ed === 'salon' ? x.apodo : 'Reto #' + x.reto, -CW / 2 + 60, 2, { size: 50, align: 'left', fill: C.cream, strokeW: 10 });
        texto(ed === 'salon' ? (x.texto || '') : (x.gano ? (x.sobran ? 'ganó con ' + x.sobran : 'ganó en el último') : 'perdió'), CW / 2 - 140, 2,
          { font: F.body, weight: '900', size: 38, align: 'right', fill: x.gano === false ? '#ffb3bd' : C.mint, stroke: false, sombra: false });
        ctx.restore();
        if (ed !== 'salon') K.sello(tt, ti + 0.05, !!x.gano, XC + CW / 2 - 70, y, 36);
      });
      if (P.pregunta && tt >= T.pregunta) bloque(tt, T.pregunta, P.pregunta, 1350, 92, { color: C.gold, rot: -0.03 });
    }
    function semanaCierre(tt) {
      if (tt < T.abre || tt >= T.tarjeta) return;
      cabecera(tt, 1, T.abre, { chip: 'HOY: RETO #' + D.reto + ' · ' + movs + ' MOVS' });
      var kk = V.pop(tt - (T.abre + 0.5), 0.24);
      if (kk > 0) {
        ctx.save(); ctx.translate(XC, 1335); ctx.scale(kk, kk);
        var s = P.pega || 'Pega tu resultado';
        ctx.font = '400 84px ' + F.display;
        var w = ctx.measureText(s).width;
        placa(-w / 2 - 90, -74, w + 180, 148, 0.9, C.gold);
        texto(s, -40, 4, { size: 84, fill: C.gold, strokeW: 14 });
        emoji('👇', w / 2 + 20, 6, 76, 1);
        ctx.restore();
      }
    }

    // subtítulos: abajo, salvo la «reaccion» tras el sello, que va arriba (abajo entra el panel del otro bot)
    var ARRIBA = P.subArriba || ['reaccion'];
    function tramoSub(ln, i) {
      var a = ln.voz[0] - 0.08, b = ln.voz[1] + 0.3, sig = g.lineas[i + 1];
      if (sig && sig.t0 < 900 && b > sig.voz[0] - 0.08) b = Math.max(a + 0.3, sig.voz[0] - 0.08);
      return [a, b];
    }
    function subArriba(tt) {
      return g.lineas.some(function (ln, i) {
        if (!ln.texto || ln.t0 > 900 || ARRIBA.indexOf(huecos[i]) < 0) return false;
        var r = tramoSub(ln, i); return tt >= r[0] - 0.05 && tt < r[1] + 0.05;
      });
    }
    function subtitulos(tt) {
      g.lineas.forEach(function (ln, i) {
        if (!ln.texto || ln.t0 > 900) return;
        var r = tramoSub(ln, i), arriba = ARRIBA.indexOf(huecos[i]) >= 0;
        if (tt >= r[0] && tt < r[1]) K.subtitulo(tt, r[0], r[1], ln.texto, { quien: ln.quien, habla: ln.voz, y: arriba ? null : (P.subY || K.SUB.y), arriba: arriba });
      });
    }

    /* ---------- sonido ---------- */
    var extra = [], sfx = [], temblores = [];
    function rampa(i, n) { return 1 + Math.round(9 * (n > 1 ? i / (n - 1) : 0)); }
    if (!semanaSola) {
      sfx.push(['golpe', T.abre, { v: 0.55 }]);
      if (ed !== 'noticiero') { sfx.push(['pop', T.abre + 0.3, { f: 760, v: 0.7 }]); extra.push(['special', {}, T.abre + 0.3, 0.6]); }
      extra.push(['tick', {}, T.abre + 0.02, 0.6]);
      sfx.push(['whoosh', T.carta - 0.05, { v: 0.9 }]);
      EH.forEach(function (ch, i) {
        var te = T.e0 + i * T.paso, gde = GRANDES[ch] || 0;
        extra.push(['match', { cascade: rampa(i, EH.length) }, te, 1]);
        sfx.push(['pop', te, { f: 520 * Math.pow(2, i / Math.max(8, EH.length - 1)), v: 0.5 }]);
        if (ch === '🟨') extra.push(['ice', { hp: 1 }, te + 0.02, 0.7]);
        if (gde === 1) { extra.push(['special', {}, te, 0.8]); temblores.push([te, 9, 0.25]); }
        if (gde === 2) { extra.push(['bomba', {}, te, 0.9]); temblores.push([te, 16, 0.32]); }
        if (gde === 3) { extra.push(['combo', {}, te, 0.8]); temblores.push([te, 22, 0.4]); }
        if (movs - (i + 1) <= 3 && movs - (i + 1) >= 0) extra.push(['tick', {}, te + 0.05, 0.8]);
      });
      extra.push(['heartbeat', {}, T.ultimo + 0.06, 1.1]);
      if (hon.gano) {
        extra.push(['win', {}, T.sello, 0.9]);
        sfx.push(['golpe', T.sello, { v: 0.9 }]);
        temblores.push([T.sello, 20, 0.35]);
      } else {
        extra.push(['lose', {}, T.sello, 0.8]);
        sfx.push(['golpe', T.sello, { v: 1 }]);
        extra.push(['laugh', { who: D.anfitrion === 'cereza' ? 'cereza' : 'cocardo' }, T.sello + 0.3, 1]);
        temblores.push([T.sello, 24, 0.4]);
      }
      if (T.vidente != null) {
        sfx.push(['whoosh', T.vidente - 0.05, { v: 0.7 }]);
        EV.forEach(function (ch, i) { sfx.push(['pop', T.v0 + i * T.vPaso, { f: 600 * Math.pow(2, i / Math.max(6, EV.length - 1)), v: 0.45 }]); });
        for (var s = 0; s < Math.max(0, vid.estrellas); s++) extra.push(['star', { i: s }, T.vUltimo + 0.1 + s * 0.12, 0.8]);
        if (vid.gano) { extra.push(['special', {}, T.sePuede, 1]); extra.push(['star', { i: 2 }, T.sePuede + 0.4, 0.8]); }
      }
      sfx.push(['whoosh', T.reto - 0.04, { v: 0.9 }]);
      sfx.push(['golpe', T.reto, { v: 0.5 }]);
      extra.push(['tap', {}, T.reto + 0.35, 0.9]);
      sfx.push(['pop', T.reto + 0.9, { f: 880, v: 0.6 }]);
    } else {
      sfx.push(['golpe', 0, { v: 0.55 }]);
      var its = ed === 'salon' ? P.apodos : D.semana;
      its.forEach(function (x, i) {
        var ti = T.item0 + i * T.itemPaso;
        extra.push(['match', { cascade: rampa(i, its.length) }, ti, 1]);
        if (ed !== 'salon') {
          if (x.gano) extra.push(['star', { i: Math.min(2, i % 3) }, ti + 0.05, 0.7]);
          else { extra.push(['lose', {}, ti + 0.05, 0.5]); extra.push(['laugh', { who: 'cereza' }, ti + 0.2, 0.9]); temblores.push([ti, 16, 0.3]); }
        } else if (i === 0) extra.push(['win', {}, ti, 0.8]);
      });
      if (P.pregunta) sfx.push(['golpe', T.pregunta, { v: 0.7 }]);
      sfx.push(['whoosh', T.abre - 0.05, { v: 0.9 }]);
    }
    if (ed === 'noticiero') {
      extra.push(['drama', {}, 0, 0.8]);
      if (P.titular) { sfx.push(['golpe', T.titular, { v: 1 }]); temblores.push([T.titular, 18, 0.3]); }
      sfx.push(['whoosh', T.abre - 0.05, { v: 0.9 }]);
    }
    sfx.push(['whoosh', T.tarjeta - 0.04, { v: 0.8 }]);
    extra.push(['star', { i: 2 }, T.tarjeta + 0.35, 0.7]);

    var tem = elegidas && elegidas[P.musicaTipo || 'tema'], vic = elegidas && elegidas[P.victoria || 'victoria'];
    var audio = { extra: extra, sfx: sfx, ducking: { musica: 0.3, juego: 0.6 } };
    if (tem && tem.archivo && P.musica !== false) {
      audio.musicaArchivo = tem.archivo;
      var bajar = [];
      if (!semanaSola && hon.gano && vic && vic.archivo) bajar.push([T.sello, T.sello + 2.2, 0.3]);
      audio.musica = [{ t0: 0, t1: T.fin, desde: P.musicaDesde != null ? P.musicaDesde : ((tem.bucle && tem.bucle.inicio) || 0), gain: P.musicaGain || 1.5,
        fadeIn: 0.01, fadeOut: 0.25, bajar: bajar }];
      if (!semanaSola && hon.gano && vic && vic.archivo && P.victoria !== false) audio.pistas = [{ archivo: vic.archivo, t: T.sello, dur: 2.6, gain: 1.4, fadeOut: 0.6 }];
    } else if (P.musica !== false) {
      audio.musica = [{ t0: 0, t1: T.fin, desde: 0, gain: 1.6 }];
    }

    K.montaje({
      dur: function () { return T.fin; },
      tomas: { b: toma },
      clips: clips,
      antes: function () { K.retrato('cocardo', hon.gano ? 'llorando' : 'burlon'); K.retrato('cereza', 'coqueta'); if (ed === 'noticiero') K.retrato(P.presentadora || 'reportera', 'normal'); },
      capas: function (c, tt) {
        ctx = c;
        if (ed === 'noticiero') noticiero(tt);
        if (semanaSola) { semana(tt); semanaCierre(tt); }
        if (!semanaSola && tt >= T.abre && tt < T.reto) {
          // gancho y cabecera: grande en el cuadro 0, se recoge arriba cuando entra la fila de emojis
          var k = 1 - K.p(tt, T.carta - 0.08, T.carta + 0.22, K.E.io);
          cabecera(tt, k, ed === 'noticiero' ? T.abre : null, { chip: k > 0.5 ? (P.chip || 'EL MISMO TABLERO PARA TODOS HOY') : null,
            chipEn: ed === 'noticiero' ? null : T.abre + 0.3, latido: ed === 'noticiero' ? null : T.abre + 0.3 });
          if (hon.gano && tt >= T.sello) confeti(tt, T.sello, XC, GC.y0 + 200, 130);
          carta(tt);
          panelVidente(tt);
          if (T.sello && tt >= T.sello && tt < T.sello + 0.3) K.flash(tt, T.sello, 0.28, hon.gano ? '#fff6ea' : '#ff5a6a', 0.32);
        }
        if (!semanaSola) retoFinal(tt);
        subtitulos(tt);
        if (tt >= T.tarjeta) K.tarjetaFinal(tt, T.tarjeta, { cta: P.cta || 'JUEGA GRATIS', sub: P.sub || 'link en el perfil', pie: P.pie != null ? P.pie : 'cocardo.app',
          moodCocardo: hon.gano ? 'llorando' : 'burlon' });
      },
      audio: audio,
    });
  }
})();
