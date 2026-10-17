/* F02 «Acertijo #N: ¿A, B o C?» — plantilla de montaje (ver tools/video/formatos/F02/README.md).
   Cada video del formato es un montaje corto que carga este archivo y llama a window.F02({...}):
     tools/video/videos/<id>/montaje.js → node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/<id>/montaje.js" …
   Lee: los datos del acertijo (generar.cjs → tools/video/videos/<id>/acertijo.json), las tres tomas (toma.json de cada
   opción), el guion de voces (JSON de voz.py; cada línea con su «hueco») y la música elegida (elegidas.json).
   El tiempo sale solo de la duración de las voces y de los sonidos de las tomas:
     gancho: tablero congelado con A, B y C ya marcadas en el cuadro 0, el reto en grande y la línea del personaje
     → cuenta 3-2-1 (número gigante, tic, latido y voz) → las dos que fallan (✗ y rebobinado)
     → la ganadora (cámara lenta solo en su golpe, temblor, ✔, confeti, contador de piezas si rompe muchas)
     → «¿Acertaste?» → tarjeta de 1 s → corte al cuadro 0 (bucle).
   Huecos del guion: «gancho», «pide» o «apuesta» (en el gancho, en ese orden), «cuenta3», «cuenta2», «cuenta1»,
   «falla» (tras el ✗ de cada opción que falla, en orden), «gana» (tras la victoria) y «cierre» («¿Acertaste?»).
   Sin subtítulo: gancho, cuenta y cierre (su texto ya está en grande); los demás llevan el subtítulo del kit. */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, V = K.V, SAFE = K.SAFE;
  var COL = { A: '#ff9a2e', B: '#4aa8e0', C: C.pink };
  var XC = (SAFE.left + SAFE.right) / 2;        // centro de la zona segura (la franja derecha la tapan los botones)
  var XT = 565, ANCHO_T = 700;                  // textos de las opciones: a la derecha de la insignia de la letra
  var HUECOS_GANCHO = ['gancho', 'pide', 'apuesta'], SIN_SUB = ['gancho', 'cuenta3', 'cuenta2', 'cuenta1', 'cierre'];
  // la burbuja del villano del HUD (píxeles de la toma): se tapa, porque la burla de inicio es al azar y alguna está vetada
  var BURBUJA = { x0: 66, y0: 300, x1: 570, y1: 456, oscuro: 0.62 };
  // franja oscura detrás de los textos de arriba (tapa además la burbuja y el borde del HUD)
  function franja(y) { K.placa(540, y || 380, 1010, 176, 0.93); }

  function json(ruta) {
    return fetch(K.url(ruta)).then(function (r) {
      if (!r.ok) throw new Error('no encontré ' + ruta + ' (' + r.status + ')');
      return r.json();
    });
  }
  function primero(tm, nombre, desde) {
    var s = (tm.sonidos || []).filter(function (x) { return x.name === nombre && x.t >= (desde || 0); });
    return s.length ? s[0].t : null;
  }
  // segundo (desde el inicio del audio) en que se dice una palabra: reparto por letras y pausas, como K.subtitulo
  function horaPalabra(ln, palabra) {
    var pal = ln.texto.split(/\s+/), tot = 0, hit = -1;
    pal.forEach(function (p) {
      if (hit < 0 && p.toLowerCase().indexOf(palabra.toLowerCase()) >= 0) hit = tot;
      tot += p.replace(/[^\p{L}\p{N}]/gu, '').length + 1.2 + (/[.!?…:]["»)]*$/.test(p) ? 3 : /[,;]["»)]*$/.test(p) ? 1.35 : 0);
    });
    if (hit < 0) return null;
    return ln.voz[0] + (ln.voz[1] - ln.voz[0]) * hit / tot;
  }

  window.F02 = function (P) {
    var musica = P.musica === false ? Promise.resolve(null) : json('dist/estudio/musica/elegidas.json').catch(function () { return null; });
    Promise.all([json(P.datos), P.guion ? json(P.guion) : Promise.resolve({ lineas: [] }), musica]).then(function (r) {
      var D = r[0], tomas = Object.assign({}, D.tomas, P.tomas || {});
      return Promise.all(['A', 'B', 'C'].map(function (k) {
        return fetch('/cap/' + tomas[k] + '/toma.json').then(function (x) {
          if (!x.ok) throw new Error('no encontré la toma ' + tomas[k] + ' (captúrala: README de F02)');
          return x.json();
        });
      })).then(function (tm) { construir(P, D, tomas, { A: tm[0], B: tm[1], C: tm[2] }, r[1], r[2]); });
    }).catch(function (e) { window.__error = String((e && e.message) || e); });
  };

  function construir(P, D, tomas, TM, guion, elegidas) {
    var huecos = (Array.isArray(guion) ? guion : guion.lineas || []).map(function (l) { return l.hueco || ''; });
    var gan = D.respuesta, malas = ['A', 'B', 'C'].filter(function (k) { return k !== gan; }), orden = malas.concat([gan]);
    var tb = TM[gan].tablero || { x0: 106, y0: 602, paso: 124, filas: 8, cols: 8 };
    var tapa = P.tapa === false ? null : P.tapa || BURBUJA;
    var pops = P.pops || [0.55, 0.8, 1.05];
    function celda(rc) { return { x: tb.x0 + rc.c * tb.paso, y: tb.y0 + rc.r * tb.paso }; }

    // horas que se conocen antes de cargar las voces: ninguna; el guion entra a 999 y dur() lo coloca
    var g = K.guion(P.guion, function () { return 999; }, { subtitulos: false });
    function lineas(h) { return g.lineas.filter(function (ln, i) { return huecos[i] === h; }); }
    function poner(ln, t0) { var a = ln.voz[0] - ln.t0, b = ln.voz[1] - ln.t0; ln.t0 = t0; ln.t1 = t0 + ln.dur; ln.voz = [t0 + a, t0 + b]; return ln.t1; }

    var T = {};          // tiempos del video (dur() los llena)
    var fases = [];      // { letra, gana, de, a, toma, sw, fin, ev } y { rebobinar, de, a }
    var M = { tomas: {}, clips: [], audio: {} };
    ['A', 'B', 'C'].forEach(function (k) { M.tomas[k] = tomas[k]; });

    /* ---------- clips: se arman con duraciones de voz estimadas y se corrigen en dur() ---------- */
    // Como los clips se preparan al llamar a K.montaje, el gancho se arma con la duración del JSON del guion
    // (la de cada WAV, sin silencio en las puntas), que es la misma que medirá el kit al cargar el audio.
    var durs = (Array.isArray(guion) ? guion : guion.lineas || []).map(function (l) { return +(l.duracion || l.dur || 1.2); });
    var t = P.t0 == null ? 0.15 : P.t0;
    huecos.forEach(function (h, i) { if (HUECOS_GANCHO.indexOf(h) >= 0) t += durs[i] + 0.12; });
    T.CUENTA = Math.max(P.ganchoMin || 2.4, t + 0.05);
    T.PASO = P.pasoCuenta || 0.75;
    T.OP = T.CUENTA + 3 * T.PASO;
    T.REB = P.rebobinado || 0.35;
    var fallaDur = huecos.map(function (h, i) { return h === 'falla' ? durs[i] : null; }).filter(function (x) { return x != null; });
    var tt = T.OP;
    orden.forEach(function (k, n) {
      var tm = TM[k], sw = primero(tm, 'swap') || 1.55, s0 = sw - 0.35, gana = k === gan;
      var fin = primero(tm, gana ? 'win' : 'lose', sw) || sw + 1.5;
      var f = { letra: k, gana: gana, de: tt, toma: k, sw: sw, fin: fin };
      if (!gana) {
        // la que falla: el cambio a velocidad normal, la espera hasta «sin movimientos» más rápida y quieta en el ✗
        var fd = fallaDur[n], hold = Math.max(P.pausaFalla || 0.75, fd ? fd + 0.45 : 0);
        var r1 = Math.min(fin - 0.25, sw + 0.75);
        var tr = K.tramos(r1 > sw + 0.2 && fin - r1 > 0.4 ? [[s0, r1, 1], [r1, fin - 0.15, P.rapida || 1.7], [fin - 0.15, fin + hold, 1]]
          : [[s0, fin + hold, 1]], 0.08);
        f.a = tt + tr.dur;
        M.clips.push({ toma: k, de: tt, a: f.a, src: s0, vel: tr.vel, trans: 'golpe', tapa: tapa });
        fases.push(f);
        // rebobinado: la misma toma al revés y rápido, sin sonido del juego
        M.clips.push({ toma: k, de: f.a, a: f.a + T.REB, src: fin + hold, vel: [[0, -(fin + hold - s0) * 0.85 / T.REB]], mudo: true, dedo: false, tapa: tapa });
        fases.push({ rebobinar: true, de: f.a, a: f.a + T.REB });
        tt = f.a + T.REB;
      } else {
        // la ganadora: cámara lenta solo alrededor de su golpe (P.lento: nombre del sonido; si no, la victoria)
        var ev = (P.lento && primero(tm, P.lento, sw)) || fin;
        var l0 = ev - (P.lentoAntes == null ? 0.12 : P.lentoAntes), l1 = Math.min(ev + (P.lentoDur || 0.45), fin - 0.02);
        if (l1 <= l0 + 0.1) l1 = l0 + 0.35;
        var tw = K.tramos([[s0, l0, 1], [l0, l1, P.lentoVel || 0.33], [l1, (tm.duracion || fin + 4) - 0.05, 1]], 0.1);
        f.a = tt + tw.dur; f.ev = ev;
        var zx = P.zoom ? P.zoom.x : 540, zy = P.zoom ? P.zoom.y : 960, zz = P.zoom ? P.zoom.z : 1.08;
        var tl0 = tt + (l0 - s0), tl1 = tl0 + (l1 - l0) / (P.lentoVel || 0.33);
        M.clips.push({ toma: k, de: tt, a: f.a, src: s0, vel: tw.vel, trans: 'golpe', tapa: tapa,
          cam: [[tt, { z: 1, x: 540, y: 960 }], [tl0, { z: 1, x: 540, y: 960 }], [tl0 + 0.25, { z: zz, x: zx, y: zy }, 'out'],
            [tl1, { z: zz + 0.02, x: zx, y: zy }], [tl1 + 0.6, { z: 1, x: 540, y: 960 }]] });
        fases.push(f);
      }
    });
    var fw = fases[fases.length - 1], cw = M.clips[M.clips.length - 1];
    // gancho: el primer cuadro de la ganadora (las tres tomas empiezan en el mismo tablero), congelado y sin sonido
    var camG = [[0, { z: 1, x: 540, y: 960 }], [T.CUENTA - 0.05, { z: 1.035, x: 540, y: 945 }]];
    for (var i = 0; i < 3; i++) {
      var tc = T.CUENTA + i * T.PASO;
      camG.push([tc + 0.06, { z: 1.05 + 0.012 * i, x: 540, y: 950 }, 'out']);
      camG.push([tc + T.PASO - 0.02, { z: 1.035 + 0.012 * i, x: 540, y: 950 }]);
    }
    M.clips.unshift({ toma: gan, de: 0, a: T.OP, src: 0.6, vel: [[0, 0]], mudo: true, dedo: false, tapa: tapa, cam: camG });

    /* ---------- dur(): voces cargadas y clips preparados → horas reales, temblor y audio ---------- */
    M.dur = function () {
      // horas reales de los sonidos de cada toma en el video final (con las curvas de velocidad ya integradas)
      fases.forEach(function (f) {
        if (f.rebobinar) return;
        var c = M.clips.filter(function (x) { return x.toma === f.toma && !x.mudo; })[0];
        f.ev2 = {};
        (TM[f.toma].sonidos || []).forEach(function (s) {
          var x = K.salida(c, s.t);
          if (x == null || x < c.de || x >= c.a) return;
          (f.ev2[s.name] = f.ev2[s.name] || []).push({ t: x, o: s.opts || {} });
        });
        f.tSw = K.salida(c, f.sw);
        f.tFin = K.salida(c, f.fin);
      });
      // voces
      var tv = P.t0 == null ? 0.15 : P.t0;
      g.lineas.forEach(function (ln, i) { if (HUECOS_GANCHO.indexOf(huecos[i]) >= 0) tv = poner(ln, tv) + 0.12; });
      ['cuenta3', 'cuenta2', 'cuenta1'].forEach(function (h, i) { lineas(h).forEach(function (ln) { poner(ln, T.CUENTA + i * T.PASO + 0.03); }); });
      var fl = lineas('falla');
      fases.filter(function (f) { return !f.rebobinar && !f.gana; }).forEach(function (f, n) { if (fl[n]) poner(fl[n], f.tFin + 0.3); });
      var ta = fw.tFin + (P.ganaRetraso == null ? 0.45 : P.ganaRetraso);   // que no choque con el golpe ni el jingle
      lineas('gana').forEach(function (ln) { ta = poner(ln, ta) + 0.15; });
      T.cierre = ta;
      T.cierreTexto = Math.min(ta, fw.tFin + (P.acertasteRetraso || 0.9));   // el texto sale antes que la voz
      lineas('cierre').forEach(function (ln) { ta = poner(ln, ta) + 0.05; });
      if (!lineas('cierre').length) ta += 1.3;
      T.FIN = Math.max(ta, fw.tFin + 1.6);
      T.DUR = T.FIN + (P.tarjeta || 1.0);
      cw.a = T.FIN;   // la ganadora termina donde empieza la tarjeta
      // temblor en los golpes grandes (más fuerte en la ganadora)
      var golpes = [];
      fases.forEach(function (f) {
        if (f.rebobinar) return;
        (P.temblor || ['freezerHit', 'bomba', 'paleta', 'copa', 'combo']).forEach(function (nm) {
          (f.ev2[nm] || []).forEach(function (e) { golpes.push([e.t, f.gana ? 16 : 9, 0.4]); });
        });
        if (f.gana) golpes.push([f.tFin, 10, 0.35]);
      });
      M.temblor = golpes;
      audio();
      return T.DUR;
    };

    /* ---------- audio ---------- */
    function focoHora(f) {
      if (f.tipo === 'victima') return -1;
      var pal = (P.focoPalabra || {})[f.tipo], ln = g.lineas.filter(function (l, i) { return HUECOS_GANCHO.indexOf(huecos[i]) >= 0; })[0];
      var h = pal && ln ? horaPalabra(ln, pal) : null;
      return h != null ? h : 0.35;
    }
    function audio() {
      var A = M.audio, ex = [], sfx = [];
      A.juego = 1;
      // el gancho arranca con el golpe del congelador; las letras suenan subiendo de tono; crujido al marcar cada foco
      ex.push(['freezerHit', {}, 0.0, 0.7]);
      pops.forEach(function (p, i) { ex.push(['match', { cascade: 2 + i * 2 }, p, 0.9]); });
      (D.focos || []).forEach(function (f) { var h = focoHora(f); if (h > 0.2) ex.push(['ice', { hp: 1 }, h, 0.8]); });
      for (var i = 0; i < 3; i++) {
        var tc = T.CUENTA + i * T.PASO;
        ex.push(['tick', {}, tc, 1.2]); ex.push(['heartbeat', {}, tc + 0.02, i === 2 ? 1.15 : 1]);
      }
      sfx.push(['whoosh', T.OP - 0.06, {}]);
      fases.forEach(function (f) {
        if (f.rebobinar) { sfx.push(['rebobinar', f.de, { dur: T.REB + 0.1 }]); return; }
        if (f.de > T.OP + 0.01) sfx.push(['whoosh', f.de - 0.06, {}]);
        sfx.push(['golpe', f.tFin + (f.gana ? 0 : 0.12), { v: f.gana ? 0.8 : 0.6 }]);
      });
      sfx.push(['whoosh', T.FIN - 0.06, {}]);
      A.extra = ex; A.sfx = sfx;
      var bajar = fases.filter(function (f) { return f.rebobinar; }).map(function (f) { return [f.de, f.a, 0.2]; });
      var tipo = P.musicaTipo || 'drama';
      var dm = P.musicaArchivo || (elegidas && elegidas[tipo] && elegidas[tipo].archivo);
      var vic = P.victoria === false ? null : P.victoria || (elegidas && elegidas.victoria && elegidas.victoria.archivo);
      if (dm) {
        A.musicaArchivo = dm;
        A.musica = [{ t0: 0, t1: vic ? fw.tFin + 0.12 : T.DUR, desde: P.musicaDesde || 0, gain: P.musicaGain || 1.5, fadeIn: 0.02,
          fadeOut: vic ? 0.2 : 0.6, bajar: bajar }];
        if (vic) A.pistas = [{ archivo: vic, t: fw.tFin - 0.04, dur: T.DUR - fw.tFin + 0.04, gain: P.victoriaGain || 1.2, fadeIn: 0.01, fadeOut: 0.35 }];
      } else {
        A.musica = [{ t0: 0, t1: T.DUR, desde: 0, gain: 1.2, fadeOut: 0.6, bajar: bajar }];   // la cumbia del juego
      }
      A.ducking = P.ducking || { musica: 0.28, juego: 0.5 };
    }

    /* ---------- dibujo ---------- */
    // franja del tablero sin opciones ni focos: ahí va el subtítulo del personaje (no tapa la jugada)
    var usadas = {};
    ['A', 'B', 'C'].forEach(function (k) { var op = D.opciones[k]; usadas[op.a.r] = usadas[op.b.r] = 1; });
    (D.focos || []).forEach(function (f) { usadas[Math.floor(f.r)] = usadas[Math.ceil(f.r)] = 1; });
    var mejor = null;
    for (var r0 = 0; r0 < tb.filas; r0++) {
      if (usadas[r0]) continue;
      var r1 = r0;
      while (r1 + 1 < tb.filas && !usadas[r1 + 1]) r1++;
      var largo = r1 - r0 + 1, medio = Math.abs((r0 + r1) / 2 - (tb.filas - 1) / 2);
      if (!mejor || largo > mejor.l || (largo === mejor.l && medio < mejor.m)) mejor = { l: largo, m: medio, c: (r0 + r1) / 2 };
      r0 = r1;
    }
    var SUB_Y = P.subY || Math.min(SAFE.bottom - 20, mejor ? tb.y0 + mejor.c * tb.paso + 112 : 1035);

    var letrasPos = {};
    ['A', 'B', 'C'].forEach(function (k) {
      var op = D.opciones[k], p1 = celda(op.a), p2 = celda(op.b), mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      var vertical = op.a.c === op.b.c;
      var lado = (P.lado && P.lado[k]) || (vertical ? (mx - 122 < SAFE.left + 40 ? 'der' : 'izq') : (my - 122 < tb.y0 ? 'abajo' : 'arriba'));
      var off = { izq: [-122, 0], der: [122, 0], arriba: [0, -122], abajo: [0, 122] }[lado];
      letrasPos[k] = { p1: p1, p2: p2, x: mx + off[0], y: my + off[1] };
    });
    // letra redonda con golpes de escala (horas en `golpes`); se ve entera desde el cuadro 0
    function letra(ctx, t, k, x, y, golpes, esc) {
      var s = esc || 1;
      (golpes || []).forEach(function (g0) { var d = t - g0; if (d >= 0 && d < 0.4) s *= 1 + 0.35 * Math.sin(Math.PI * d / 0.4) * (1 - d / 0.4); });
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2);
      ctx.fillStyle = COL[k]; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = C.ink; ctx.stroke();
      V.texto(ctx, k, 0, 4, { size: 78, fill: C.cream, strokeW: 14, sombra: false, maxW: 92 });
      ctx.restore();
    }
    function opciones(ctx, t, info) {
      ['A', 'B', 'C'].forEach(function (k, i) {
        var lp = letrasPos[k], a = K.aPantalla(info, lp.p1.x, lp.p1.y), b = K.aPantalla(info, lp.p2.x, lp.p2.y), q = K.aPantalla(info, lp.x, lp.y);
        K.intercambio(t, -1, a, b, COL[k]);
        letra(ctx, t, k, q.x, q.y, [pops[i]]);
      });
    }
    function pastilla(ctx, texto, y) {
      ctx.save(); ctx.font = '900 44px ' + F.body;
      var w = ctx.measureText(texto).width + 64;
      V.rr(ctx, XC - w / 2, y - 34, w, 68, 34); ctx.fillStyle = C.drama; ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = C.gold; ctx.stroke(); ctx.restore();
      V.texto(ctx, texto, XC, y + 2, { font: F.body, weight: '900', size: 44, fill: C.cream, stroke: false, sombra: false });
    }
    // confeti determinista que sale de (x, y) en t0
    function confeti(ctx, t, t0, x, y, n) {
      var d = t - t0;
      if (d < 0 || d > 2.2) return;
      var cols = [C.pink, C.gold, C.mint, C.ice, C.cherry, '#ffffff', '#ff9a2e'];
      ctx.save();
      for (var i = 0; i < n; i++) {
        var h1 = V.hash(i * 7.31 + 1), h2 = V.hash(i * 3.17 + 2), h3 = V.hash(i * 5.71 + 3);
        var ang = -Math.PI / 2 + (h1 - 0.5) * 2.6, vel = 900 + h2 * 1300;
        var px = x + Math.cos(ang) * vel * d + Math.sin(d * 6 + i) * 30, py = y + Math.sin(ang) * vel * d + 1500 * d * d;
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, d - 1.4) / 0.8);
        ctx.setTransform(1, 0, 0, 1, px, py); ctx.rotate(d * (4 + h3 * 8) + i);
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(-12, -7, 24, 14);
      }
      ctx.restore();
    }
    function textosDe(f) {
      var lista = (P.textos && P.textos[f.letra]) || [];
      if (!Array.isArray(lista)) lista = [lista];
      if (!lista.length && !f.gana) lista = [{ evento: 'lose', texto: D.opciones[f.letra].faltan === 1 ? '¡Le faltó UNO!' : '¡Casi!' }];
      return lista;
    }
    function horaEv(f, ev, n) {
      if (ev === 'lose' || ev === 'win' || ev === 'fin') return f.tFin;
      if (ev === 'inicio') return f.de + 0.1;
      var l = f.ev2[ev];
      return l && l.length ? l[Math.min(n || 0, l.length - 1)].t : null;
    }
    function subtitulos(t) {
      g.lineas.forEach(function (ln, i) {
        if (!ln.texto || SIN_SUB.indexOf(huecos[i]) >= 0 || ln.t0 > 900) return;
        var a = ln.voz[0] - 0.08, b = ln.voz[1] + 0.35;
        if (t >= a && t < b) K.subtitulo(t, a, b, ln.texto, { quien: ln.quien, habla: ln.voz, y: huecos[i] === 'gana' ? (P.subGanaY || K.SUB.y) : SUB_Y });
      });
    }

    M.capas = function (ctx, t, o) {
      var info = o.info;
      if (t < T.OP) {
        K.sombraArriba(0.85, 590);
        franja();
        if (info) {
          (D.focos || []).forEach(function (f) {
            var p = K.aPantalla(info, tb.x0 + f.c * tb.paso, tb.y0 + f.r * tb.paso);
            K.anillo(t, focoHora(f), p.x, p.y, (f.tipo === 'congelador' ? 148 : 84) * info.z, f.tipo === 'victima' ? C.ice : C.gold);
          });
          opciones(ctx, t, info);
        }
        if (t < T.CUENTA) {
          if (P.serie) pastilla(ctx, P.serie, 256);
          var gch = P.gancho || ['Solo UNA gana', '¿A, B o C?'], kk = 1;
          V.texto(ctx, gch[0], XC, 350, { size: 78, fill: C.cream, strokeW: 16, maxW: 840 });
          pops.forEach(function (g0) { var d = t - g0; if (d >= 0 && d < 0.3) kk = Math.max(kk, 1 + 0.08 * Math.sin(Math.PI * d / 0.3)); });
          ctx.save(); ctx.translate(XC, 478); ctx.rotate(-0.03); ctx.scale(kk, kk);
          V.texto(ctx, gch[1], 0, 0, { size: 136, fill: C.gold, strokeW: 24, maxW: 840 });
          ctx.restore();
        } else {
          var n = 3 - Math.floor((t - T.CUENTA) / T.PASO), tn = T.CUENTA + (3 - n) * T.PASO;
          if (n >= 1) K.popTexto(t, tn, String(n), XC, 350, { size: 240, fill: n === 1 ? '#ff4f4f' : C.cream, strokeW: 34, dur: 0.16 });
          K.popTexto(t, T.CUENTA + 0.1, P.comenta || 'comenta tu letra 👇', XC, 515, { font: F.body, weight: '900', size: 58, fill: C.gold, strokeW: 12 });
        }
        subtitulos(t);
        return;
      }
      if (t >= T.FIN) {
        K.tarjetaFinal(t, T.FIN - 0.3, { cta: P.cta || (D.nivel <= 10 ? 'JUEGA GRATIS' : 'EMPIEZA GRATIS'), sub: 'link en el perfil', pie: 'cocardo.app',
          moodCocardo: P.moodCocardo || 'llorando', moodCherry: P.moodCherry });
        return;
      }
      var f = fw;
      for (var i = 0; i < fases.length; i++) if (t >= fases[i].de && t < fases[i].a) { f = fases[i]; break; }
      if (f.rebobinar) {
        K.vhs(t, 1);
        K.popTexto(t, f.de, '◀◀ REBOBINANDO', XC, 420, { font: F.body, weight: '900', size: 64, fill: C.cream, strokeW: 14, sinPop: true });
        return;
      }
      K.sombraArriba(0.6, 560);
      // en el cierre la franja sube para no tapar la cabecera de la pantalla de victoria del juego
      var yF = f.gana && t >= T.cierreTexto ? 350 : 380;
      franja(yF);
      letra(ctx, t, f.letra, 128, yF - 5, [f.de + 0.05], 1.1);
      var tx = textosDe(f);
      tx.forEach(function (x, j) {
        var h = horaEv(f, x.evento, x.n);
        if (h == null) return;
        h += x.retraso || 0;
        var sig = tx[j + 1], hasta = sig ? horaEv(f, sig.evento, sig.n) + (sig.retraso || 0) : f.gana ? f.tFin + 0.8 : null;
        if (x.palabras) K.palabras(t, h, x.texto, XT, x.y || 378, { size: x.size || 70, maxW: ANCHO_T, ritmo: 0.07, hasta: hasta });
        else K.popTexto(t, h, x.texto, XT, x.y || 378, { size: x.size || 88, fill: x.color || C.cream, strokeW: 18, maxW: ANCHO_T, hasta: hasta });
      });
      var SX = P.selloX || 842, SY = P.selloY || 592;
      if (!f.gana) {
        K.sello(t, f.tFin + 0.12, false, SX, SY, 95);
      } else {
        var op = D.opciones[f.letra];
        // contador de piezas que sube con cada cascada (solo si la jugada rompe bastantes)
        var ms = (f.ev2.match || []).filter(function (m) { return m.t >= f.tSw; });
        if (op.piezas >= (P.contadorMin || 12) && ms.length && t >= ms[0].t) {
          var pc = op.piezas_por_cascada || [], val = 0, kc = 1;
          ms.forEach(function (m) {
            if (t >= m.t) val = pc[Math.min(pc.length - 1, (m.o.cascade || 1) - 1)] || val;
            var d = t - m.t; if (d >= 0 && d < 0.2) kc = Math.max(kc, 1 + 0.25 * (1 - d / 0.2));
          });
          if (t >= f.tFin) val = op.piezas;
          ctx.save(); ctx.translate(XC, P.contadorY || 1390); ctx.scale(kc, kc);
          V.texto(ctx, val + ' piezas', 0, 0, { size: 100, fill: C.gold, strokeW: 20 });
          ctx.restore();
        }
        K.flash(t, f.tFin, 0.25, '#fff2c0', 0.3);
        confeti(ctx, t, f.tFin, XC, P.confetiY || 820, 120);
        K.sello(t, f.tFin, true, SX, SY, 100);
        if (t >= T.cierreTexto) {
          // rebota otra vez cuando la voz lo dice
          var dq = t - T.cierre, bq = dq >= 0 && dq < 0.35 ? 1 + 0.12 * Math.sin(Math.PI * dq / 0.35) : 1;
          ctx.save(); ctx.translate(XT, 318); ctx.scale(bq, bq); ctx.translate(-XT, -318);
          K.popTexto(t, T.cierreTexto, P.acertaste || '¿Acertaste?', XT, 318, { size: 104, fill: C.gold, strokeW: 22, rot: -0.03, maxW: ANCHO_T });
          ctx.restore();
          K.popTexto(t, T.cierreTexto + 0.3, P.comentaFinal || 'comenta tu letra 👇', XT, 405, { font: F.body, weight: '900', size: 54, fill: C.cream, strokeW: 12, maxW: ANCHO_T });
        }
      }
      subtitulos(t);
    };

    K.montaje(M);
  }
})();
