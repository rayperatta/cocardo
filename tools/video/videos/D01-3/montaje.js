/* D01-3 «Acertijo #1: solo una salva a Lima» (formato F02, plantilla tools/video/formatos/F02/plantilla.js).
   El 04 rehecho: nivel 10, último movimiento, tablero armado a mano (tools/video/datos/acertijo.cjs). De las 8 jugadas
   del tablero solo la C gana (generar.cjs lo comprueba): la A saca una Copa Arcoíris y nada más, la B rompe el
   congelador pero Lima sigue congelada y la C hace que la Paleta barra la fila 0 y la libere.
   Tomas: las del 04 (dist/cap/acertijo2-A, -B, -C), iguales a las de tomas/acertijo.cjs de F02 con este acertijo.json.
   Voces: tools/video/videos/D01-3/guion.json → dist/estudio/voz/D01-3.json (Lima de pre10 y post10; el narrador cuenta
   y cierra en dos líneas cortas, sin el silencio que dejaba la pregunta).
   Retoques de este video sobre la plantilla (sin tocarla: se envuelven M.dur y M.capas antes de K.montaje):
   - gancho corto (Lima solo dice «Rompe el congelador viejo y luego mi bloque.») con golpe de cámara al congelador y a
     Lima cuando los nombra, crujido y pulso de anillo;
   - en la ganadora se tapa la burbuja propia del juego («Lima: ¡Libre! Ya no más congelador.») mientras sale nuestro
     subtítulo de Lima;
   - la línea de victoria de Lima entra 0,8 s tras la victoria (fuera del jingle y del golpe) y el golpe de victoria baja
     solo debajo de ella; en el cierre la música queda a 0,5 bajo la voz (no a 0,28);
   - pantalla de resultados con un estímulo cada ≤0,7 s: deriva de cámara, golpe de cámara y confeti en «¡Rescataste a
     Lima!», «comenta tu letra» rebotando con su 👇, la letra C con su ✔ cuando la voz dice «letra». */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, V = K.V, E = K.E, SAFE = K.SAFE;
  var XC = (SAFE.left + SAFE.right) / 2, XT = 565;
  var GANA = 'C';
  // burbuja propia del juego en la toma ganadora (px de la toma): aparece en src 2,98 y se va con la pantalla de
  // resultados (fundido de 4,57 a 4,70)
  var BURBUJA_LIMA = { x0: 122, y0: 708, x1: 590, y1: 842, oscuro: 0.5 };
  var BUR_SRC = [2.9, 4.55, 4.74];
  var INSIGNIA = { x: 540, y: 1010, w: 680, h: 136, src: 5.74 };   // «¡Rescataste a Lima!» (px de la toma, src en que entra)
  var CARTA_SRC = 4.56;                                               // entra la pantalla de resultados
  var LIMA = { x: 354, y: 602 }, CONGELADOR = { x: 540, y: 664 };     // focos del gancho (px de la toma)
  var CAM0 = { z: 1, x: 540, y: 960 };

  // segundo en que se dice una palabra (reparto por letras y pausas, igual que la plantilla y K.subtitulo)
  function horaPalabra(ln, palabra) {
    var pal = ln.texto.split(/\s+/), tot = 0, hit = -1;
    pal.forEach(function (p) {
      if (hit < 0 && p.toLowerCase().indexOf(palabra.toLowerCase()) >= 0) hit = tot;
      tot += p.replace(/[^\p{L}\p{N}]/gu, '').length + 1.2 + (/[.!?…:]["»)]*$/.test(p) ? 3 : /[,;]["»)]*$/.test(p) ? 1.35 : 0);
    });
    if (hit < 0) return null;
    return ln.voz[0] + (ln.voz[1] - ln.voz[0]) * hit / tot;
  }
  function onda(t, t0, dur, amp) {
    var d = t - t0;
    return d >= 0 && d < dur ? amp * Math.sin(Math.PI * d / dur) * (1 - d / dur) : 0;
  }
  // confeti determinista (como el de la plantilla), más corto
  function confeti(ctx, t, t0, x, y, n, sem) {
    var d = t - t0;
    if (d < 0 || d > 1.8) return;
    var cols = [C.pink, C.gold, C.mint, C.ice, C.cherry, '#ffffff', '#ff9a2e'];
    ctx.save();
    for (var i = 0; i < n; i++) {
      var h1 = V.hash(i * 7.31 + sem), h2 = V.hash(i * 3.17 + sem * 2), h3 = V.hash(i * 5.71 + sem * 3);
      var ang = -Math.PI / 2 + (h1 - 0.5) * 2.9, vel = 700 + h2 * 1100;
      var px = x + Math.cos(ang) * vel * d + Math.sin(d * 6 + i) * 26, py = y + Math.sin(ang) * vel * d + 1500 * d * d;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, d - 1.1) / 0.7);
      ctx.setTransform(1, 0, 0, 1, px, py); ctx.rotate(d * (4 + h3 * 8) + i);
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(-12, -7, 24, 14);
    }
    ctx.restore();
  }
  // la insignia de la letra, como la dibuja la plantilla (para hacerla rebotar encima de la suya)
  function letraC(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fillStyle = C.pink; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = C.ink; ctx.stroke();
    V.texto(ctx, GANA, 0, 4, { size: 78, fill: C.cream, strokeW: 14, sombra: false, maxW: 92 });
    ctx.restore();
  }

  function retocar(M) {
    var durP = M.dur, capasP = M.capas, X = {};

    M.dur = function () {
      var DUR = durP();
      var g = K.guiones[K.guiones.length - 1], L = g.lineas;
      // 0 pide · 1-3 cuenta · 4 gana · 5 «¿Acertaste?» · 6 «¡Comenta tu letra!»
      var gch = M.clips.filter(function (c) { return c.de === 0 && c.mudo; })[0];
      var cw = M.clips.filter(function (c) { return c.toma === GANA && !c.mudo; })[0];
      X.cw = cw; X.gch = gch; X.DUR = DUR; X.FIN = cw.a;
      X.fin = K.eventos('win')[0].t;
      X.cuenta = L[1].t0 - 0.03;
      X.cong = horaPalabra(L[0], 'congelador'); X.bloq = horaPalabra(L[0], 'bloque');
      X.gana = L[4].voz;
      X.acert = L[5].voz[0]; X.comenta = L[6].voz[0]; X.letra = horaPalabra(L[6], 'letra');
      X.carta = K.salida(cw, CARTA_SRC); X.insignia = K.salida(cw, INSIGNIA.src);
      X.cierreTexto = X.fin + 0.9;   // como la plantilla (acertasteRetraso)

      /* gancho: golpe de cámara al congelador y a Lima cuando ella los nombra; luego la cuenta de la plantilla */
      var cuenta = gch.cam.filter(function (k) { return k[0] >= X.cuenta - 0.06; });
      gch.cam = [[0, CAM0], [X.cong - 0.03, CAM0],
        [X.cong + 0.13, { z: 1.12, x: CONGELADOR.x, y: CONGELADOR.y }, 'out'],
        [X.bloq - 0.05, { z: 1.1, x: 470, y: 700 }],
        [X.bloq + 0.12, { z: 1.17, x: LIMA.x, y: LIMA.y }, 'out']].concat(cuenta);

      /* resultados: deriva lenta, golpe a «¡Rescataste a Lima!» y vuelta suave hasta la tarjeta */
      var camR = cw.cam.filter(function (k) { return k[0] < X.carta - 0.05; });
      cw.cam = camR.concat([
        [X.carta - 0.02, CAM0],
        [X.insignia - 0.03, { z: 1.035, x: 540, y: 985 }],
        [X.insignia + 0.16, { z: 1.13, x: INSIGNIA.x, y: INSIGNIA.y }, 'out'],
        [X.FIN, { z: 1.07, x: 540, y: 990 }]]);
      M.temblor = (M.temblor || []).concat([[X.cong, 6, 0.3], [X.bloq, 7, 0.3], [X.insignia, 8, 0.3]]);

      /* audio */
      var A = M.audio;
      A.extra = (A.extra || []).concat([
        ['ice', { hp: 2 }, X.bloq, 0.8],                  // crujido en «bloque»
        ['star', { i: 1 }, X.insignia, 0.9],              // ding con la insignia
        ['match', { cascade: 7 }, X.comenta, 0.75],       // pop alto con «comenta»
        ['star', { i: 2 }, X.letra, 1.0]]);                // ding con la letra C y su ✔
      A.sfx = (A.sfx || []).concat([['pop', X.insignia + 0.02, { f: 900 }], ['pop', X.letra, { f: 1200, v: 0.8 }]]);
      // música: 0,5 bajo las voces (el cierre conserva la energía) y, aparte, 0,56 más bajo la voz de Lima del gancho
      A.ducking = { musica: 0.5, juego: 0.5 };
      var dm = A.musica && A.musica[0];
      if (dm) dm.bajar = (dm.bajar || []).concat([[L[0].voz[0], L[0].voz[1], 0.56]]);
      // golpe de victoria: entero hasta la voz de Lima, bajo (0,45) debajo de ella y entero otra vez en el cierre
      var p0 = A.pistas && A.pistas[0];
      if (p0) {
        var ini = p0.t, fin = p0.t + p0.dur, c0 = X.gana[0] - 0.1, c1 = X.gana[1] + 0.06, xf = 0.06;
        A.pistas = [
          { archivo: p0.archivo, t: ini, dur: c0 + xf - ini, gain: p0.gain, fadeIn: p0.fadeIn, fadeOut: 2 * xf },
          { archivo: p0.archivo, t: c0 - xf, desde: c0 - xf - ini, dur: c1 - c0 + 2 * xf, gain: p0.gain * 0.45, fadeIn: 2 * xf, fadeOut: 2 * xf },
          { archivo: p0.archivo, t: c1 - xf, desde: c1 - xf - ini, dur: fin - (c1 - xf), gain: p0.gain, fadeIn: 2 * xf, fadeOut: p0.fadeOut }];
      }
      window.__horas = { cong: X.cong, bloq: X.bloq, cuenta: X.cuenta, fin: X.fin, gana: X.gana, acert: X.acert,
        comenta: X.comenta, letra: X.letra, carta: X.carta, insignia: X.insignia, FIN: X.FIN, DUR: DUR };
      return DUR;
    };

    M.capas = function (ctx, t, o) {
      var info = o.info, c = o.clip;
      // la burbuja propia del juego sale a la vez que nuestro subtítulo de Lima: se tapa (se apaga con el fundido)
      if (c && c === X.cw && info && o.img && o.src >= BUR_SRC[0] && o.src < BUR_SRC[2]) {
        ctx.save();
        ctx.globalAlpha = 1 - K.p(o.src, BUR_SRC[1], BUR_SRC[2]);
        K.tapa(o.img, info, BURBUJA_LIMA);
        ctx.restore();
      }
      capasP(ctx, t, o);
      if (!info || t >= X.FIN) return;
      if (c === X.gch) {
        // pulso del anillo de Lima cuando dice «bloque»
        var d = t - X.bloq;
        if (d >= 0 && d < 0.45) {
          var p = K.aPantalla(info, LIMA.x, LIMA.y), k = d / 0.45;
          ctx.save(); ctx.globalAlpha = 1 - k; ctx.lineWidth = 14 * (1 - k) + 4; ctx.strokeStyle = C.ice;
          ctx.beginPath(); ctx.arc(p.x, p.y, 84 * info.z * (1 + 0.9 * E.out(k)), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        return;
      }
      if (c !== X.cw) return;
      // «¡Rescataste a Lima!»: marco dorado que late y confeti que sale de ella
      if (t >= X.insignia) {
        var q = K.aPantalla(info, INSIGNIA.x, INSIGNIA.y), s = info.z * (1 + onda(t, X.insignia, 0.35, 0.18));
        var a = Math.min(1, (t - X.insignia) / 0.12);
        ctx.save(); ctx.globalAlpha = a; ctx.translate(q.x, q.y); ctx.scale(s, s);
        V.rr(ctx, -INSIGNIA.w / 2, -INSIGNIA.h / 2, INSIGNIA.w, INSIGNIA.h, 34);
        ctx.lineWidth = 12 + 4 * Math.sin((t - X.insignia) * 10); ctx.strokeStyle = C.gold; ctx.stroke();
        ctx.restore();
        confeti(ctx, t, X.insignia, q.x, q.y - 40, 70, 11);
      }
      // «comenta tu letra» (la plantilla lo deja en blanco: va aquí con su 👇 latiendo y rebote cuando la voz lo dice)
      if (t >= X.cierreTexto + 0.3) {
        var tx = 'comenta tu letra', y = 405, kk = 1 + onda(t, X.comenta, 0.4, 0.3);
        ctx.save(); ctx.font = '900 56px ' + F.body; var w = ctx.measureText(tx).width; ctx.restore();
        var x0 = XT - 34;
        K.popTexto(t, X.cierreTexto + 0.3, tx, x0, y, { font: F.body, weight: '900', size: 56 * kk, fill: kk > 1.05 ? C.gold : C.cream, strokeW: 12, maxW: 640 });
        var bob = Math.abs(Math.sin((t - X.cierreTexto) * Math.PI * 2.4)) * 14, kd = 1 + onda(t, X.comenta, 0.4, 0.5);
        K.popTexto(t, X.cierreTexto + 0.36, '👇', Math.min(x0 + w / 2 + 52, SAFE.right - 40), y + bob, { size: 66 * kd, stroke: false, sombra: false });
      }
      // la letra C rebota con su ✔ cuando la voz dice «letra»
      if (t >= X.letra) {
        var yL = 345;
        letraC(ctx, 128, yL, 1.1 * (1 + onda(t, X.letra, 0.4, 0.4)));
        K.sello(t, X.letra + 0.05, true, 128 + 52, yL + 44, 30);
      }
    };
  }

  var base = K.montaje;
  K.montaje = function (M) { K.montaje = base; retocar(M); return base(M); };

  var s = document.createElement('script');
  s.src = 'formatos/F02/plantilla.js';
  s.onerror = function () { window.__error = 'no se pudo cargar formatos/F02/plantilla.js'; };
  s.onload = function () {
    window.F02({
      datos: 'tools/video/videos/D01-3/acertijo.json',
      tomas: { A: 'acertijo2-A', B: 'acertijo2-B', C: 'acertijo2-C' },
      guion: 'dist/estudio/voz/D01-3.json',
      t0: 0.1,
      pasoCuenta: 0.65,
      serie: 'ACERTIJO #1 · NIVEL 10',
      gancho: ['Solo UNA rescata a Lima', '¿A, B o C?'],
      focoPalabra: { congelador: 'congelador' },
      textos: {
        A: [{ evento: 'special', texto: 'Sale una Copa Arcoíris…', size: 76 }, { evento: 'lose', texto: '…¡y nada más!' }],
        B: [{ evento: 'freezerHit', texto: '¡El congelador sí!' }, { evento: 'lose', texto: '…¿y Lima? 🥶', size: 100, color: '#bfe9ff' }],
        C: [{ evento: 'paleta', texto: '¡La Paleta barre TODA la fila!', palabras: true, retraso: -0.05 }],
      },
      lento: 'paleta',
      lentoDur: 0.35,
      zoom: { x: 540, y: 720, z: 1.12 },
      ganaRetraso: 0.8,
      comentaFinal: ' ',
    });
  };
  document.body.appendChild(s);
})();
