/* F03 «Perdí por uno» — plantilla de montaje (léeme: tools/video/formatos/F03/README.md).
   Cada video del formato es un montaje corto que carga este archivo y llama a window.F03({...}):
     tools/video/videos/<id>/montaje.js → node tools/video/grabar.cjs "tools/video/montaje.html?m=videos/<id>/montaje.js" …
   Lee: casi.json (generar.cjs), las dos tomas (tomas/casi.cjs: <id>-pierde y <id>-gana), el guion de voces (JSON de
   voz.py; cada línea con su «hueco») y la música elegida (dist/estudio/musica/elegidas.json).
   Los tiempos salen solos de los sonidos de las tomas y de la duración de las voces. LISTA DE DOPAMINA de serie:
     gancho    cuadro 0 = el último movimiento: el dedo del bot ya está sobre la pieza, «1 MOVS» con anillo rojo, el fondo
               late en rojo y el gancho (2 líneas) ya se lee; la jugada sale a los 0,25 s;
     ritmo     derrota en ~3 s (aprieta el paso a ×1,35), burla con retrato que entra con golpes de zoom, pausa ≤ 1 s
               con latido y rayón, rebobinado VHS a ×3 o más, la ganadora con empujones de cámara en cada especial;
     escalada  contador de cascadas que pasa de dorado a rosa y a rojo, pops propios que siguen subiendo pasada la 10,
               temblor creciente, metas que se tachan («Fresa ✔»), cámara lenta solo en el golpe final;
     tensión   «¡FALTÓ UN HIELO!» con ✗ y anillo en lo que quedó, carcajada del villano; alivio con ✔, destello suave,
               confeti y el golpe de victoria encima del drama; el clímax se deja antes del 77 % (alarga la cola si hace falta);
     ganas     «¿Qué jugada harías TÚ?» antes del rebobinado; tras él, el tablero quieto con la flecha de la jugada y el
               dedo del tutorial; cierre «¿La viste antes que yo?» y tarjeta JUEGA/EMPIEZA GRATIS · link · cocardo.app;
     bucle     la tarjeta dura 1 s y en sus últimos 0,2 s sube y deja el cuadro 0 tal cual.
   Huecos del guion: «gancho» (voz sobre el gancho), «burla» (tras perder, en orden; cada una con el retrato de quien
   habla), «pausa» (voz en la pausa), «gana» (tras ganar), «cierre» (al final). Sin subtítulo: gancho y pausa. */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, V = K.V, W = K.W, H = K.H, E = K.E;
  var XB = 455, ANCHO = 790;        // centro y ancho de los textos de arriba (deja ver «1 MOVS» a la derecha)
  var XC = 500;                     // centro de la zona segura
  var ROJO = '#ff4f4f', VERDE = '#7be08a';
  var MOODS = ['normal', 'feliz', 'triste', 'enojado', 'asustado', 'sorprendido', 'burlon', 'nervioso', 'furioso', 'carcajada', 'llorando', 'coqueta'];

  function json(ruta) {
    return fetch(K.url(ruta)).then(function (r) {
      if (!r.ok) throw new Error('no encontré ' + ruta + ' (' + r.status + ')');
      return r.json();
    });
  }
  function toma(nombre) {
    return fetch('/cap/' + nombre + '/toma.json').then(function (r) {
      if (!r.ok) throw new Error('no encontré la toma ' + nombre + ' (captúrala: README de F03)');
      return r.json();
    });
  }
  function primero(tm, nombre, desde) {
    var s = (tm.sonidos || []).filter(function (x) { return x.name === nombre && x.t >= (desde || 0); });
    return s.length ? s[0].t : null;
  }
  function marca(tm, n) { var m = (tm.marcas || []).filter(function (x) { return x.nombre === n; }); return m.length ? m[m.length - 1] : null; }
  function llegada(tm) { var d = (tm.dedo || []).filter(function (x) { return x.llega; }); return d.length ? d[d.length - 1].t : null; }

  // Confeti determinista desde (x, y) hacia arriba
  var COLORES = [C.pink, C.gold, C.mint, C.ice, C.cream, C.cherry, '#9be35a'];
  function confeti(ctx, t, t0, x, y, n) {
    var d = t - t0, dur = 1.8;
    if (d < 0 || d > dur) return;
    var sal = 1 - K.p(d, dur * 0.65, dur);
    ctx.save();
    for (var i = 0; i < n; i++) {
      var h1 = V.hash(i * 1.37 + 0.51), h2 = V.hash(i * 2.11 + 3.1), h3 = V.hash(i * 3.73 + 7.7), h4 = V.hash(i * 5.3 + 1.9);
      var ang = -Math.PI / 2 + (h1 - 0.5) * 2.5, vel = 1100 + h2 * 1900, k = 2.4, e = (1 - Math.exp(-k * d)) / k;
      var px = x + Math.cos(ang) * vel * e, py = y + Math.sin(ang) * vel * e + 750 * d * d * (0.5 + h3 * 0.5);
      ctx.save(); ctx.globalAlpha = sal; ctx.translate(px, py);
      ctx.rotate(h4 * 6 + d * (6 + h1 * 10) * (h2 > 0.5 ? 1 : -1)); ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(d * 9 + i)));
      ctx.fillStyle = COLORES[i % COLORES.length]; ctx.fillRect(-(8 + h3 * 8), -(5 + h4 * 4), 16 + h3 * 16, 9 + h4 * 9);
      ctx.restore();
    }
    ctx.restore();
  }

  window.F03 = function (P) {
    var musica = P.musica === false ? Promise.resolve(null) : json('dist/estudio/musica/elegidas.json').catch(function () { return null; });
    Promise.all([json(P.datos), P.guion ? json(P.guion) : Promise.resolve({ lineas: [] }), musica]).then(function (r) {
      var D = r[0], tomas = Object.assign({}, D.tomas, P.tomas || {});
      return Promise.all([toma(tomas.pierde), toma(tomas.gana)]).then(function (tm) { construir(P, D, tomas, tm[0], tm[1], r[1], r[2]); });
    }).catch(function (e) { window.__error = 'F03: ' + String((e && e.message) || e); });
  };

  function construir(P, D, tomas, TP, TG, guion, elegidas) {
    var lista = Array.isArray(guion) ? guion : guion.lineas || [];
    var huecos = lista.map(function (l) { return l.hueco || 'burla'; });
    var durs = lista.map(function (l) { return +(l.duracion || l.dur || 1.2); });
    var tb = TG.tablero || { x0: 106, y0: 602, paso: 124, filas: 8, cols: 8 };
    function celda(rc) { return { x: tb.x0 + rc.c * tb.paso, y: tb.y0 + rc.r * tb.paso }; }
    var hud = (marca(TP, 'hud') || {}).datos || {};
    var movs = hud.movs ? { x: hud.movs.x * 2, y: hud.movs.y * 2, w: hud.movs.w * 2, h: hud.movs.h * 2 } : { x: 885, y: 139, w: 154, h: 166 };
    var gancho = P.gancho || ['Mi bot perdió por UNO.', '¿Ves la jugada?'];
    var tarjeta = Object.assign({ dur: 1.0, cta: D.cta || 'EMPIEZA GRATIS', sub: 'link en el perfil', pie: 'cocardo.app',
      moodCocardo: 'llorando', moodCherry: D.villanos && D.villanos.indexOf('cereza') >= 0 ? 'llorando' : 'coqueta' }, P.tarjeta || {});

    /* ---------- tiempos de las tomas ---------- */
    var llP = llegada(TP), llG = llegada(TG), swP = primero(TP, 'swap', llP), swG = primero(TG, 'swap', llG);
    var finP = primero(TP, 'lose', swP), winG = primero(TG, 'win', swG);
    if (llP == null || swP == null || finP == null) throw new Error('la toma ' + tomas.pierde + ' no tiene dedo, cambio y derrota');
    if (llG == null || swG == null || winG == null) throw new Error('la toma ' + tomas.gana + ' no tiene dedo, cambio y victoria');
    var pfG = (marca(TG, 'pantalla-final') || { t: winG + 1.5 }).t;
    var resG = (TG.sonidos || []).filter(function (s) { return s.name === 'rescue' && s.t > pfG; }).map(function (s) { return s.t; });
    var src0 = llP + (P.entra == null ? 0.12 : P.entra);
    var velP = P.velPierde || 1.35, velG = P.velGana || 1.6, lv = P.lentoVel || 0.45;
    var lA = P.lentoAntes == null ? 0.4 : P.lentoAntes, lD = P.lentoDespues == null ? 0.2 : P.lentoDespues;
    var congela = P.congela == null ? 0.75 : P.congela;           // s de la toma tras la derrota en que se congela el cuadro
    var sRes = llG - (P.respira == null ? 0.4 : P.respira);       // el rebobinado acaba aquí y aquí sigue la ganadora
    function hasta(tr, s) {                                       // segundos de salida hasta que la toma llega a s
      var cut = [];
      for (var i = 0; i < tr.length; i++) { if (s <= tr[i][0]) break; cut.push([tr[i][0], Math.min(s, tr[i][1]), tr[i][2]]); if (s <= tr[i][1]) break; }
      return cut.length ? K.tramos(cut, 0.1).dur : 0;
    }

    /* ---------- A: gancho + jugada que pierde + burla (congelado) ---------- */
    var trA = [[src0, swP + 0.45, 1], [swP + 0.45, finP - 0.12, velP], [finP - 0.12, finP + congela, 1]];
    var kA = K.tramos(trA, 0.1);
    var T = {};
    T.LOSE = hasta(trA, finP);
    T.SW_P = hasta(trA, swP);
    T.CONG = kA.dur;
    // voces: gancho desde 0,1 s; burlas tras la derrota, una tras otra
    var pos = [];   // hora de inicio de cada línea del guion
    var tv = P.t0Gancho == null ? 0.1 : P.t0Gancho;
    huecos.forEach(function (h, i) { if (h === 'gancho') { pos[i] = tv; tv += durs[i] + 0.1; } });
    tv = T.LOSE + (P.burlaRetraso == null ? 0.4 : P.burlaRetraso);
    var nB = 0;
    huecos.forEach(function (h, i) { if (h === 'burla') { pos[i] = tv; tv += durs[i] + (P.burlaHueco == null ? 0.3 : P.burlaHueco); nB++; } });
    T.PAUSA = nB ? tv - (P.burlaHueco == null ? 0.3 : P.burlaHueco) + 0.25 : T.LOSE + 1.4;
    var dP = P.pausa == null ? 0.8 : P.pausa;
    huecos.forEach(function (h, i) { if (h === 'pausa') { pos[i] = T.PAUSA + 0.05; dP = Math.max(dP, durs[i] + 0.2); } });
    T.REB = T.PAUSA + dP;
    var srcCong = finP + congela + 0.1, span = srcCong - sRes;
    var dReb = Math.min(P.rebobinado || 1.1, span / (P.rebobinadoVel || 3));
    T.RESP = T.REB + dReb;

    /* ---------- E: la ganadora y la cola ---------- */
    var srcFinG = Math.max(pfG + (P.colaVictoria == null ? 0.9 : P.colaVictoria), resG.length ? resG[0] + 0.45 : 0);
    var maxG = (TG.duracion || srcFinG) - 0.05;
    var trE = function (fin) {
      return [[sRes, swG + 0.6, 1], [swG + 0.6, winG - lA, velG], [winG - lA, winG + lD, lv], [winG + lD, fin, 1]];
    };
    T.SW_G = T.RESP + hasta(trE(srcFinG), swG);
    T.WIN = T.RESP + hasta(trE(srcFinG), winG);
    T.LENTO = T.RESP + hasta(trE(srcFinG), winG - lA);
    tv = T.WIN + (P.ganaRetraso == null ? 0.55 : P.ganaRetraso);
    huecos.forEach(function (h, i) { if (h === 'gana') { pos[i] = tv; tv += durs[i] + 0.15; } });
    huecos.forEach(function (h, i) { if (h === 'cierre') { pos[i] = tv; tv += durs[i] + 0.1; } });
    var climax = P.climaxMax || 0.77;
    var finE = Math.max(T.RESP + K.tramos(trE(srcFinG), 0.1).dur, tv + 0.2, T.WIN / climax - tarjeta.dur);
    // si hace falta más cola, la toma sigue a 1x hasta donde tenga
    var extra = finE - (T.RESP + K.tramos(trE(srcFinG), 0.1).dur);
    if (extra > 0) srcFinG = Math.min(maxG, srcFinG + extra);
    var kE = K.tramos(trE(srcFinG), 0.1);
    T.FIN = Math.max(finE, T.RESP + kE.dur);
    T.TAR = T.FIN;
    T.DUR = T.TAR + tarjeta.dur;

    /* ---------- cámara ---------- */
    var q0 = (D.pierde.quedan || [])[0], foco = q0 ? celda(q0) : { x: 540, y: 1000 };
    var zF = P.zoomFalta || 1.1;
    var camA = [[0, { z: 1, x: 540, y: 960 }], [Math.max(0.3, T.LOSE - 0.05), { z: 1.04, x: 540, y: 970 }],
      [T.LOSE + 0.3, { z: zF, x: foco.x, y: foco.y }, 'out'], [T.PAUSA, { z: zF, x: foco.x, y: foco.y }]];
    [0.02, 0.44].forEach(function (d) {      // la pausa respira con el latido
      camA.push([T.PAUSA + d + 0.08, { z: zF + 0.03, x: foco.x, y: foco.y }, 'out'], [T.PAUSA + d + 0.36, { z: zF, x: foco.x, y: foco.y }]);
    });
    camA.push([T.REB, { z: zF, x: foco.x, y: foco.y }]);
    var camE = [[T.RESP, { z: 1.04, x: 540, y: 1000 }], [T.SW_G - 0.1, { z: 1, x: 540, y: 990 }]];
    var base = function (t) { return 1 + 0.06 * K.clamp((t - T.SW_G) / Math.max(0.5, T.LENTO - T.SW_G), 0, 1); };
    var ult = -1;
    (TG.sonidos || []).forEach(function (s) {
      if (['bomba', 'paleta', 'copa', 'combo'].indexOf(s.name) < 0 || s.t <= swG || s.t >= winG - lA) return;
      var t = T.RESP + hasta(trE(srcFinG), s.t);
      if (t - ult < 0.5 || t + 0.4 > T.LENTO) return;
      ult = t;
      camE.push([t, { z: base(t), x: 540, y: 1000 }], [t + 0.08, { z: base(t) + 0.045, x: 540, y: 1000 }, 'out'], [t + 0.4, { z: base(t + 0.4), x: 540, y: 1000 }]);
    });
    var zL = P.zoomLento || 1.12;
    camE.push([T.LENTO, { z: base(T.LENTO), x: 540, y: 1000 }], [T.LENTO + 0.3, { z: zL, x: 540, y: 1010 }, 'out'],
      [T.WIN + 0.5, { z: zL + 0.02, x: 540, y: 1010 }], [T.WIN + 1.1, { z: 1, x: 540, y: 960 }]);

    /* ---------- clips ---------- */
    var cA = { toma: 'p', de: 0, a: T.REB, src: src0, vel: kA.vel.concat([[kA.dur, 1], [kA.dur + 0.2, 0]]), cam: camA };
    var cR = { toma: 'p', de: T.REB, a: T.RESP, src: srcCong, vel: [[0, -span / dReb]], mudo: true, dedo: false };
    var cE = { toma: 'g', de: T.RESP, a: T.FIN, src: sRes, vel: kE.vel, cam: camE, trans: 'golpe' };
    var cT = { toma: 'p', de: T.TAR, a: T.DUR, src: src0, vel: [[0, 0]], mudo: true };   // el cuadro 0 bajo la tarjeta
    var M = { tomas: { p: tomas.pierde, g: tomas.gana }, clips: [cA, cR, cE, cT], audio: {} };

    var g = K.guion(P.guion || { lineas: [] }, function () { return 999; }, { subtitulos: false });
    function poner(ln, t0) { var a = ln.voz[0] - ln.t0, b = ln.voz[1] - ln.t0; ln.t0 = t0; ln.t1 = t0 + ln.dur; ln.voz = [t0 + a, t0 + b]; }

    /* ---------- dur(): voces cargadas y clips listos → horas exactas, temblor y audio ---------- */
    var EV = {};   // horas en el video: casP/casG [{ t, n }], metasP/metasG [{ t, i, nombre }], especiales
    M.dur = function () {
      g.lineas.forEach(function (ln, i) { if (pos[i] != null) poner(ln, pos[i]); });
      // horas exactas de las tomas en el video
      T.LOSE = K.salida(cA, finP) || T.LOSE; T.SW_P = K.salida(cA, swP) || T.SW_P;
      T.SW_G = K.salida(cE, swG) || T.SW_G; T.WIN = K.salida(cE, winG) || T.WIN; T.LL_G = K.salida(cE, llG) || T.RESP;
      function cascadas(c, sw, fin, metas) {
        var ev = K.eventos('match', function (s, cc) { return cc === c; }).filter(function (e) { return e.src > sw && e.src <= fin + 0.05; });
        var out = [], n = 0;
        // la primera cascada puede no sonar a «match» (una Copa o un combo): cuenta desde el primer sonido tras el cambio
        var s1 = (c === cA ? TP : TG).sonidos.filter(function (s) { return s.t > sw + 0.01 && s.name !== 'swap'; })[0];
        if (ev.length && (ev[0].opts.cascade || 1) > 1 && s1) out.push({ t: K.salida(c, s1.t), n: (ev[0].opts.cascade || 2) - 1 });
        ev.forEach(function (e) { var m = e.opts.cascade || n + 1; if (m > n) { n = m; out.push({ t: e.t, n: m }); } });
        if (out.length && out[0].n > 1) out.unshift({ t: out[0].t, n: 1 });
        out = out.filter(function (x, i) { return !i || x.n > out[i - 1].n; });
        // metas que se completan en cada cascada
        var hechas = [], prev = metas[0] || [];
        out.forEach(function (x) {
          var m = metas[Math.min(x.n, metas.length - 1)] || prev;
          m.forEach(function (v, i) { if (v <= 0 && prev[i] > 0) hechas.push({ t: x.t, i: i, nombre: (D.metas[i] || {}).nombre || '', tipo: (D.metas[i] || {}).tipo }); });
          prev = m;
        });
        return { cas: out, metas: hechas };
      }
      var a = cascadas(cA, swP, finP, D.pierde.metas_por_cascada || []), b = cascadas(cE, swG, winG, D.gana.metas_por_cascada || []);
      EV.casP = a.cas; EV.metasP = a.metas; EV.casG = b.cas; EV.metasG = b.metas;
      var nG = EV.casG.length ? EV.casG[EV.casG.length - 1].n : 0;
      if (D.gana.cascadas && nG !== D.gana.cascadas) window.__aviso = 'F03: la toma ganadora hace ' + nG + ' cascadas y casi.json dice ' + D.gana.cascadas;
      // temblor: crece desde el 40 % de las cascadas de la ganadora; golpes en los especiales y en la victoria
      var tem = [], desde = Math.ceil(nG * 0.4);
      EV.casG.forEach(function (e) { if (e.n >= desde && nG > 2) tem.push([e.t, 3 + (e.n - desde) * (9 / Math.max(1, nG - desde)), 0.24]); });
      ['bomba', 'paleta', 'copa', 'combo'].forEach(function (nm) {
        K.eventos(nm, function (s, c) { return c === cE; }).forEach(function (e) { if (e.t < T.WIN) tem.push([e.t, 8, 0.28]); });
        K.eventos(nm, function (s, c) { return c === cA; }).forEach(function (e) { tem.push([e.t, 5, 0.22]); });
      });
      tem.push([T.LOSE + 0.05, 10, 0.3], [T.WIN, 16, 0.45]);
      M.temblor = tem;
      // retratos que se van a usar
      g.lineas.forEach(function (ln, i) { if (huecos[i] === 'burla') K.retrato(K.personaje(ln.quien).id, moodDe(lista[i])); });
      (D.villanos || ['cocardo']).forEach(function (v) { K.retrato(v, P.moodFinal || 'llorando'); });
      K.retrato('cocardo', tarjeta.moodCocardo); K.retrato('cereza', tarjeta.moodCherry);
      audio();
      return T.DUR;
    };
    function moodDe(l) { var m = l && (l.mood || l.emocion); return MOODS.indexOf(m) >= 0 ? m : 'carcajada'; }

    /* ---------- audio ---------- */
    function audio() {
      var A = M.audio, ex = [], sfx = [];
      A.juego = 1;
      ex.push(['heartbeat', {}, 0.0, 1.1]);
      // burlas: risa de cada villano que habla (la del primero ya suena en la toma si es el del nivel)
      var risaToma = (TP.sonidos || []).filter(function (s) { return s.name === 'laugh' && Math.abs(s.t - finP) < 0.2; }).map(function (s) { return (s.opts || {}).who; });
      g.lineas.forEach(function (ln, i) {
        if (huecos[i] !== 'burla') return;
        var who = K.personaje(ln.quien).id;
        if (risaToma.indexOf(who) < 0) ex.push(['laugh', { who: who }, Math.max(T.LOSE + 0.05, ln.t0 - 0.45), 0.9]);
        sfx.push(['whoosh', ln.t0 - 0.2, { v: 0.6 }]);
      });
      ex.push(['heartbeat', {}, T.PAUSA + 0.02, 1.2], ['heartbeat', {}, T.PAUSA + 0.44, 1.2]);
      sfx.push(['golpe', T.LOSE + 0.05, { v: 0.7 }], ['rayon', T.PAUSA - 0.02, { v: 0.7 }], ['rebobinar', T.REB, { dur: T.RESP - T.REB + 0.05 }],
        ['golpe', T.RESP, { v: 0.35 }], ['pop', T.LL_G + 0.02, { f: 700, v: 0.7 }], ['pop', T.LL_G + 0.18, { f: 950, v: 0.6 }],
        ['subida', Math.max(T.SW_G + 0.3, T.WIN - 1.6), { dur: Math.min(1.6, T.WIN - T.SW_G - 0.3), v: 0.45 }], ['golpe', T.WIN, { v: 0.9 }]);
      // el pop del juego deja de subir de tono en la cascada 10: desde ahí sube con uno propio
      EV.casG.forEach(function (e) { if (e.n > 10) sfx.push(['pop', e.t + 0.01, { f: 700 * Math.pow(1.07, e.n - 10), v: 0.55 }]); });
      if (T.FIN - 0.55 > T.WIN + (P.cierreRetraso || 1.2) + 0.5) sfx.push(['pop', T.FIN - 0.55, { f: 850, v: 0.6 }]);
      sfx.push(['pop', T.WIN + (P.cierreRetraso || 1.2) + 0.35, { f: 750, v: 0.5 }]);
      // tarjeta y vuelta al cuadro 0
      sfx.push(['whoosh', T.TAR - 0.04, {}], ['pop', T.TAR + 0.06, { f: 600 }], ['pop', T.TAR + 0.26, { f: 800 }], ['pop', T.TAR + 0.41, { f: 1000, v: 0.6 }],
        ['whoosh', T.DUR - 0.24, { v: 0.7 }]);
      A.extra = ex; A.sfx = sfx;
      var tipo = P.musicaTipo || 'drama';
      var dm = P.musicaArchivo || (elegidas && elegidas[tipo] && elegidas[tipo].archivo);
      var vic = P.victoria === false ? null : P.victoria || (elegidas && elegidas.victoria && elegidas.victoria.archivo);
      var bajar = [[T.PAUSA, T.REB, 0.18], [T.REB, T.RESP, 0.3]];
      if (dm) {
        A.musicaArchivo = dm;
        A.musica = [{ t0: 0, t1: vic ? T.WIN + 0.1 : T.DUR, desde: P.musicaDesde || 0, gain: P.musicaGain || 1.5, fadeIn: 0.02, fadeOut: vic ? 0.2 : 0.6, bajar: bajar }];
        if (vic) A.pistas = [{ archivo: vic, t: T.WIN - 0.04, dur: T.DUR - T.WIN + 0.04, gain: P.victoriaGain || 1.2, fadeIn: 0.01, fadeOut: 0.35 }];
      } else {
        A.musica = [{ t0: 0, t1: T.DUR, desde: 0, gain: 1.4, fadeOut: 0.6, bajar: bajar }];   // la cumbia del juego
      }
      A.ducking = P.ducking || { musica: 0.3, juego: 0.55 };
    }

    /* ---------- dibujo ---------- */
    function banda(a, y, h) {
      if (a <= 0) return;
      var ctx = K.ctx(); ctx.save(); ctx.globalAlpha = a; K.placa(XB, y || 360, ANCHO + 60, h || 270, 0.88); ctx.restore();
    }
    function pulso(t) { return 0.5 + 0.5 * Math.cos(2 * Math.PI * t / 0.8); }   // latido: máximo en t = 0
    function anilloMovs(ctx, info, t, a) {
      if (!info || a <= 0) return;
      var p1 = K.aPantalla(info, movs.x, movs.y), p2 = K.aPantalla(info, movs.x + movs.w, movs.y + movs.h);
      var k = 1 + 0.05 * pulso(t);
      ctx.save(); ctx.globalAlpha = a; ctx.translate((p1.x + p2.x) / 2, (p1.y + p2.y) / 2); ctx.scale(k, k);
      V.rr(ctx, -(p2.x - p1.x) / 2 - 14, -(p2.y - p1.y) / 2 - 14, p2.x - p1.x + 28, p2.y - p1.y + 28, 34);
      ctx.lineWidth = 16; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.lineWidth = 9; ctx.strokeStyle = ROJO; ctx.stroke();
      ctx.restore();
    }
    // el gancho tal cual se ve en el cuadro 0 (tl = segundos desde 0; el bucle lo vuelve a dibujar en tl = 0)
    var T_GANCHO = P.ganchoHasta || 1.9;
    function dibujarGancho(ctx, tl, info) {
      var sal = 1 - K.p(tl, T_GANCHO - 0.15, T_GANCHO, E.in);
      if (sal <= 0) return;
      var pul = pulso(tl), late = tl < T.SW_P ? 1 : Math.max(0.35, 1 - (tl - T.SW_P) / 1.2);
      ctx.save(); ctx.globalAlpha = (0.07 + 0.10 * pul) * late * sal; ctx.fillStyle = 'rgba(210,0,30,1)'; ctx.fillRect(0, 0, W, H); ctx.restore();
      K.sombraArriba(0.8 * sal, 620);
      banda(sal, 360, 280);
      anilloMovs(ctx, info, tl, sal);
      ctx.save(); ctx.globalAlpha = sal;
      if (P.serie) chip(ctx, P.serie, 205, C.drama);
      V.texto(ctx, gancho[0], XB, 300, { size: P.ganchoSize || 74, fill: C.cream, strokeW: 15, maxW: ANCHO });
      var k = 1 + 0.045 * pul;
      ctx.translate(XB, 418); ctx.rotate(-0.03); ctx.scale(k, k);
      V.texto(ctx, gancho[1], 0, 0, { size: P.ganchoSize2 || 116, fill: C.gold, strokeW: 22, maxW: ANCHO });
      ctx.restore();
      ctx.save(); ctx.globalAlpha = sal; chip(ctx, P.ultimo || 'ÚLTIMO MOVIMIENTO', 535, '#c4122f'); ctx.restore();
    }
    function chip(ctx, texto, y, color, size) {
      var z = size || 40, h = Math.round(z * 1.5);
      ctx.save(); ctx.font = '900 ' + z + 'px ' + F.body;
      var w = Math.min(ANCHO + 40, ctx.measureText(texto).width + 1.4 * z);
      V.rr(ctx, XB - w / 2, y - h / 2, w, h, h / 2); ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = C.gold; ctx.stroke(); ctx.restore();
      V.texto(ctx, texto, XB, y + 2, { font: F.body, weight: '900', size: z, fill: C.cream, stroke: false, sombra: false, maxW: w - z });
    }
    function colorDe(n) { return n < 6 ? C.gold : n < 10 ? C.pink : ROJO; }
    function contador(ctx, t, lista, desde, y) {
      var n = 0, t0 = 0;
      lista.forEach(function (e) { if (t >= e.t) { n = e.n; t0 = e.t; } });
      if (!n || t < desde) return;
      var kb = K.p(t, desde, desde + 0.18, E.back);
      K.placa(XB, y, 420 * kb, 280 * kb, 0.8);
      K.popTexto(t, desde, P.etiqueta || 'CASCADAS', XB, y - 92, { font: F.body, weight: '900', size: 44, fill: C.cream, strokeW: 11, sinPop: true });
      K.contador(t, Math.max(t0, desde), n, XB, y + 42, colorDe(n));
    }
    function metas(ctx, t, lista, fase) {
      lista.forEach(function (m, j) {
        var txt = fase === 'p' && m.tipo === 'rescue' ? '¡' + m.nombre + ' libre!' : m.nombre + ' ✔';
        K.popTexto(t, m.t + 0.05, txt, P.metaX || 740, (P.metaY || 630) + j * 92, { size: P.metaSize || 82, fill: m.tipo === 'rescue' ? C.pink : C.ice, strokeW: 17,
          rot: -0.04, maxW: 380, hasta: fase === 'p' ? Math.min(m.t + 1.6, T.LOSE) : T.WIN + 1.2 });
      });
    }
    function retratoBurla(ctx, t, ln, i, nI) {
      var a = ln.t0 - 0.2, b = i === nI - 1 ? Math.max(ln.t1 - 0.1, T.PAUSA - 0.25) : ln.t1 + 0.2;
      if (t < a || t > b + 0.25) return;
      var img = K.retrato(K.personaje(ln.quien).id, moodDe(lista[ln.i]));
      if (!img.complete) return;
      var der = i % 2 === 0, s = P.retratoTam || 400, x = der ? 1080 - s - 80 : 80, y = P.retratoY || 445;
      var ent = K.p(t, a, a + 0.28, E.back), sal = K.p(t, b, b + 0.25, E.in);
      var golpe = 1;
      [0, 0.3, 0.6].forEach(function (d, j) { var dd = t - (a + 0.3 + d); if (dd >= 0 && dd < 0.22) golpe = Math.max(golpe, 1 + (0.07 + 0.04 * j) * (1 - dd / 0.22)); });
      var risa = Math.sin(t * 24) * 9;
      ctx.save();
      ctx.translate(x + s / 2 + (der ? 1 : -1) * (1 - ent + sal) * 620, y + s / 2 + risa);
      ctx.scale(golpe, golpe); ctx.rotate((der ? -1 : 1) * 0.05 + Math.sin(t * 12) * 0.03);
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
    function subtitulos(t) {
      g.lineas.forEach(function (ln, i) {
        if (!ln.texto || ln.t0 > 900 || huecos[i] === 'gancho' || huecos[i] === 'pausa') return;
        var a = ln.voz[0] - 0.08, b = ln.voz[1] + 0.35;
        if (t >= a && t < b) K.subtitulo(t, a, b, ln.texto, { quien: ln.quien, habla: ln.voz, y: P.subY || K.SUB.y });
      });
    }
    function quedan(ctx, t, info) {
      if (!info) return;
      (D.pierde.quedan || []).forEach(function (q) {
        var p = K.aPantalla(info, tb.x0 + q.c * tb.paso, tb.y0 + q.r * tb.paso);
        K.anillo(t, T.LOSE + 0.12, p.x, p.y, (q.tipo === 'boss' ? 150 : 82) * info.z, ROJO);
      });
    }

    M.capas = function (ctx, t, o) {
      var info = o.info;
      /* tarjeta (y en sus últimos 0,2 s, el cuadro 0) */
      if (t >= T.TAR) {
        var fin = (Math.round(T.DUR * 30) - 1) / 30, k = K.p(t, fin - 0.2, fin, E.in);
        if (k > 0) dibujarGancho(ctx, 0, info);
        if (k >= 1) return;
        ctx.save(); ctx.translate(0, -H * 1.05 * k);
        K.tarjetaFinal(t, T.TAR - 0.3, { cta: tarjeta.cta, sub: tarjeta.sub, pie: tarjeta.pie, moodCocardo: tarjeta.moodCocardo, moodCherry: tarjeta.moodCherry });
        ctx.restore();
        return;
      }
      /* A: gancho y la jugada que pierde */
      if (t < T.LOSE) {
        if (t < T_GANCHO) dibujarGancho(ctx, t, info);
        else {
          K.sombraArriba(0.6, 560);
          var ctrP = P.contadorPierde != null ? P.contadorPierde : (D.pierde.cascadas || 0) >= 3;
          if (ctrP) contador(ctx, t, EV.casP || [], T_GANCHO, 410);
          anilloMovs(ctx, info, t, 1 - K.p(t, T_GANCHO, T_GANCHO + 0.3));
        }
        metas(ctx, t, EV.metasP || [], 'p');
        subtitulos(t);
        return;
      }
      /* burla: «¡FALTÓ UNO!», ✗, anillo en lo que quedó y el retrato del villano riéndose */
      if (t < T.PAUSA) {
        K.sombraArriba(0.75, 600);
        banda(K.p(t, T.LOSE, T.LOSE + 0.12), 345, 230);
        K.popTexto(t, T.LOSE + 0.05, P.falto || D.falta.texto, XB, 345, { size: P.faltoSize || 88, fill: C.ice, strokeW: 19, rot: -0.03, maxW: ANCHO - 60 });
        quedan(ctx, t, info);
        var bs = g.lineas.filter(function (ln, i) { return huecos[i] === 'burla' && ln.t0 < 900; });
        bs.forEach(function (ln, i) { retratoBurla(ctx, t, ln, i, bs.length); });
        K.sello(t, T.LOSE + 0.35, false, P.selloX || 850, P.selloY || 505, 78);
        subtitulos(t);
        return;
      }
      /* pausa: el tablero respira con el latido y la pregunta */
      if (t < T.REB) {
        ctx.save(); ctx.globalAlpha = 0.45 * K.p(t, T.PAUSA, T.PAUSA + 0.12); ctx.fillStyle = '#1a0620'; ctx.fillRect(0, 0, W, H); ctx.restore();
        K.vineta(0.5);
        // ⏸
        var kp = V.pop(t - T.PAUSA, 0.2);
        ctx.save(); ctx.translate(XC, 600); ctx.scale(kp, kp);
        [-42, 42].forEach(function (dx) { V.rr(ctx, dx - 24, -70, 48, 140, 14); ctx.fillStyle = C.cream; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = C.ink; ctx.stroke(); });
        ctx.restore();
        pregunta(ctx, t, 1);
        return;
      }
      /* rebobinado */
      if (t < T.RESP) {
        K.vhs(t, 1);
        K.popTexto(t, T.REB, '◀◀ REBOBINANDO', XC, 980, { font: F.body, weight: '900', size: 66, fill: C.cream, strokeW: 14, sinPop: true });
        pregunta(ctx, t, 1 - K.p(t, T.REB, T.REB + 0.25));
        return;
      }
      /* la ganadora */
      if (t < T.WIN + 0.05 || t < T.SW_G + 0.6) {
        K.sombraArriba(0.65, 600);
        if (t < T.SW_G + 0.25) {
          // el tablero quieto con la pregunta, la flecha de la jugada y el dedo del tutorial
          banda(1, 360, 250);
          K.popTexto(t, T.RESP, P.pregunta2 || P.pregunta || '¿Qué jugada harías TÚ?', XB, 330, { size: 78, fill: C.cream, strokeW: 16, maxW: ANCHO, sinPop: true });
          K.popTexto(t, T.RESP + 0.05, P.laVes || '¿La ves? 👀', XB, 430, { size: 74, fill: C.gold, strokeW: 15, maxW: ANCHO });
          if (info && t >= T.LL_G) {
            var a1 = K.aPantalla(info, celda(D.gana.a).x, celda(D.gana.a).y), b1 = K.aPantalla(info, celda(D.gana.b).x, celda(D.gana.b).y);
            K.intercambio(t, T.LL_G, a1, b1, C.gold);
          }
        } else {
          contador(ctx, t, EV.casG || [], T.SW_G + 0.25, 410);
          if (t < T.SW_G + 2.2) chipFrase(ctx, t);
        }
        metas(ctx, t, EV.metasG || [], 'g');
        return;
      }
      /* victoria y cola */
      K.sombraArriba(0.7, 600);
      var nG = EV.casG.length ? EV.casG[EV.casG.length - 1].n : 0;
      if (t < T.WIN + 1.25) {
        ctx.save(); ctx.globalAlpha = 1 - K.p(t, T.WIN + 1.0, T.WIN + 1.25);
        K.placa(XB, 410, 420, 280, 0.8);
        K.popTexto(t, T.WIN, P.gano || '¡GANÓ!', XB, 322, { size: 78, fill: VERDE, strokeW: 15 });
        ctx.save(); ctx.translate(XB, 452); ctx.rotate(-0.08); var kx = 1 + 0.06 * Math.sin((t - T.WIN) * 8);
        ctx.scale(kx, kx); V.texto(ctx, 'x' + nG, 0, 0, { size: 190, fill: colorDe(nG), strokeW: 30 }); ctx.restore();
        ctx.restore();
      }
      metas(ctx, t, EV.metasG || [], 'g');
      K.flash(t, T.WIN, 0.25, '#fff2c0', 0.3);
      confeti(ctx, t, T.WIN, XC, P.confetiY || 820, 130);
      K.sello(t, T.WIN + 0.05, true, P.selloX || 850, P.selloY || 505, 84);
      var tc = T.WIN + (P.cierreRetraso || 1.2);
      if (t >= tc) {
        var cierre = P.cierre || ['¿La viste antes que yo?', 'comenta 👇'];
        banda(K.p(t, tc, tc + 0.12), 360, 250);
        K.palabras(t, tc, cierre[0], XB, 325, { size: 78, maxW: ANCHO, ritmo: 0.07 });
        if (cierre[1]) {
          // rebota otra vez antes de la tarjeta (que la cola no se quede quieta)
          var dq = t - (T.FIN - 0.55), bq = dq >= 0 && dq < 0.3 ? 1 + 0.2 * Math.sin(Math.PI * dq / 0.3) : 1;
          ctx.save(); ctx.translate(XB, 435); ctx.scale(bq, bq); ctx.translate(-XB, -435);
          K.popTexto(t, tc + 0.35, cierre[1], XB, 435, { font: F.body, weight: '900', size: 58, fill: C.gold, strokeW: 13, maxW: ANCHO });
          ctx.restore();
        }
      }
      if (P.moodFinal !== false) {
        var v0 = (D.villanos || ['cocardo'])[0], img = K.retrato(v0, P.moodFinal || 'llorando'), te = T.WIN + 0.5;
        if (img.complete && t >= te) {
          var e2 = K.p(t, te, te + 0.3, E.back), s2 = 330;
          ctx.drawImage(img, -20 - (1 - e2) * 400, 1180 + Math.sin(t * 9) * 5, s2, s2);
        }
      }
      subtitulos(t);
    };
    function pregunta(ctx, t, a) {
      if (a <= 0) return;
      var t0 = T.PAUSA + 0.04, k = V.pop(t - t0, 0.22), lat = 1 + 0.05 * Math.max(0, 1 - Math.abs(t - T.PAUSA - 0.46) / 0.15);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(XC, 800); ctx.scale(k * lat, k * lat); ctx.rotate(-0.03);
      var p = (P.pregunta || '¿Qué jugada harías TÚ?').split(/(?<=jugada) /);
      if (p.length > 1) { V.texto(ctx, p[0], 0, -62, { size: 100, fill: C.cream, strokeW: 20, maxW: 860 }); V.texto(ctx, p[1], 0, 62, { size: 124, fill: C.gold, strokeW: 24, maxW: 860 }); }
      else V.texto(ctx, p[0], 0, 0, { size: 110, fill: C.gold, strokeW: 22, maxW: 860 });
      ctx.restore();
    }
    function chipFrase(ctx, t) {
      var a = 1 - K.p(t, T.SW_G + 1.9, T.SW_G + 2.2), k = V.pop(t - T.SW_G - 0.25, 0.2);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(XB, 236); ctx.scale(k, k); ctx.translate(-XB, -236);
      chip(ctx, (P.frase || D.frase_ganadoras).toUpperCase(), 236, C.ok, 46);
      ctx.restore();
    }

    window.F03.T = T; window.F03.EV = EV;
    K.montaje(M);
  }
})();
