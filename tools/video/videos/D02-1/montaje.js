/* D02-1 «Reto #20: ¿te sobra más de UNO?» (formato F05, plantilla tools/video/formatos/F05/plantilla.js).
   Reto Diario del martes 20 de octubre de 2026: nivel 6 «Uno por persona» (hielo grueso), 19 movimientos.
   Datos con el motor: node tools/video/formatos/F05/generar.cjs D02-1 → reto.json (bot honesto: ganó con 1 de sobra,
   ⬜⬜🟨⬜⬜⬜⬜🟧⬜⬜🟧🟧🟨🟧⬜🟧🍦⬜; el que ve las frutas que caen: ganó con 7 de sobra). Nunca se ve una jugada.
   Toma: dist/cap/D02-1-tablero (tomas/reto.cjs --var 20261020:9 --fps 30). Voces: guion.json → dist/estudio/voz/D02-1.json
   (Cocardo: su burla «low» durante la cuenta atrás y la de «win» tras el sello, de js/story.js).

   Arreglos de la revisión, hechos aquí sin tocar la plantilla ni el kit (se envuelven K.montaje y Escena.dibujar):
   - La carta de emojis crece: 3 filas de 6 a 100 px (antes 2 de 10 a 70) y, tras el sello, la capa se aleja un 6 %
     para que quepan el otro bot y «se puede». La burla va arriba y deja abajo sitio para la cuenta 3-2-1 en grande.
   - Cámara: el tablero se acerca al entrar la carta (z 1 → 1,26; sale de cuadro la franja de potenciadores), deriva
     hasta 1,33, golpe de zoom y temblor en cada 🟨 🟧 🍦 (fondo y carta), quieto 0,35 s antes del sello y golpe en él.
   - Recompensa: sobre cada 🟨 🟧 la palabra de cascada del juego con sus cascadas reales (js/game.js CASCADE_TEXT y
     reto.json → turnos), y el 🍦 (combo) con su momento: «¡COMBO!», brillo y chispas que salen de la carta.
   - Tensión: el fondo se oscurece con la cuenta; el «1» late con el corazón y, con el sello, se pone verde («¡DE SOBRA!»).
   - Tarjeta final de 1,55 s armada 1,8 veces más rápido (completa ~1 s; la mano del tutorial toca «JUEGA GRATIS» dos
     veces) y una cola de 0,36 s que barre la tarjeta y deja el cuadro 0 (bucle sin salto). */
(function () {
  'use strict';
  var K = window.K, V = K.V, C = K.C, F = K.F, E = K.E, W = K.W, SAFE = K.SAFE;
  var XC = (SAFE.left + SAFE.right) / 2, CX0 = SAFE.left, CX1 = SAFE.right;
  var DATOS = 'tools/video/videos/D02-1/reto.json';
  var TAM = 100, POR_FILA = 6, CARTA_Y = 490, PASO = TAM + 12;
  var TARJETA = 1.55, RAPIDA = 1.8, COLA = 0.36, BARRIDO = 0.16;
  var CASCADA = ['', '', '¡Rico!', '¡Delicioso!', '¡Escandaloso!', '¡DRAMÁTICO!', '¡¡TELENOVELA!!'];   // js/game.js
  var COLOR_CASCADA = ['', '', C.mint, C.gold, '#ff9a2e', C.pink, C.pink];
  var OPC_TARJETA = { cta: 'JUEGA GRATIS', sub: 'link en el perfil', pie: 'cocardo.app', moodCocardo: 'llorando' };

  var D, EH, TURNOS, T, CARTA_H, CY, YCUENTA, golpes = [], cola = null;

  function emojis(s) { return Array.from(String(s || '')).filter(function (c) { return /\S/.test(c) && c !== '\uFE0F'; }); }
  // misma geometría que la carta de la plantilla (posEmoji con P.emojiTam, P.porFila y P.cartaY)
  function posEmoji(i) {
    var fila = Math.floor(i / POR_FILA), col = i % POR_FILA, ancho = POR_FILA * PASO - 12;
    return { x: XC - ancho / 2 + TAM / 2 + col * PASO, y: CARTA_Y + 136 + PASO / 2 + fila * PASO };
  }
  function tEmoji(i) { return T.e0 + i * T.paso; }
  // golpe: sube en 50 ms y cae en ~0,3 s
  function pulso(d) { return d < 0 ? 0 : d < 0.05 ? E.out(d / 0.05) : Math.exp(-(d - 0.05) * 10); }

  /* ---------- cámara del tablero de fondo (claves densas, una por fotograma) ---------- */
  function camFondo(t) {
    var a0 = T.carta - 0.05, a1 = T.carta + 0.55, z, y;
    var zA = 1 + 0.03 * K.p(a0, 0, 1, E.io);
    if (t < a0) { z = 1 + 0.03 * K.p(t, 0, 1, E.io); y = 1040; }
    else if (t < a1) { var k = E.io((t - a0) / (a1 - a0)); z = K.lerp(zA, 1.26, k); y = K.lerp(1040, 785, k); }
    else if (t < T.ultimo + 0.1) { z = K.lerp(1.26, 1.33, K.p(t, a1, T.ultimo + 0.1)); y = 785; }
    else if (t < T.sello + 0.45) { z = 1.33; y = 785; }                       // quieta antes del sello
    else { var q = K.p(t, T.sello + 0.45, T.reto, E.io); z = K.lerp(1.33, 1.22, q); y = K.lerp(785, 815, q); }
    var m = 1, sx = 0, sy = 0, f = Math.round(t * 30);
    golpes.forEach(function (g) {
      var d = t - g.t;
      if (d < 0 || d > 0.7) return;
      m += g.fondo * pulso(d);
      if (d < g.dur) {
        var a = g.temblor * Math.pow(1 - d / g.dur, 2);
        sx += (V.hash(f + g.t * 7) - 0.5) * 2 * a; sy += (V.hash(f * 3 + g.t * 11) - 0.5) * 2 * a;
      }
    });
    return { z: z * m, x: 540 + sx, y: y + sy };
  }
  // la capa de la carta: golpes de zoom propios y, tras el sello, se aleja un 6 % (anclada arriba de la carta)
  function capaCarta(t) {
    if (T.carta == null || t < T.carta + 0.3 || t >= T.reto) return null;
    var m = 1;
    golpes.forEach(function (g) { var d = t - g.t; if (d >= 0 && d < 0.7) m += g.carta * pulso(d); });
    var lejos = 1 - 0.06 * K.p(t, T.vidente - 0.15, T.vidente + 0.3, E.io);
    return { m: m, s: lejos };
  }
  function aplicar(c, z) {
    c.translate(XC, CARTA_Y); c.scale(z.s, z.s); c.translate(-XC, -CARTA_Y);
    c.translate(XC, CY); c.scale(z.m, z.m); c.translate(-XC, -CY);
  }
  function enPantalla(p, z) {
    if (!z) return p;
    var x = XC + (p.x - XC) * z.m, y = CY + (p.y - CY) * z.m;
    return { x: XC + (x - XC) * z.s, y: CARTA_Y + (y - CARTA_Y) * z.s };
  }

  /* ---------- capas nuevas ---------- */
  // palabra de cascada del juego sobre cada jugada de 2 o más cascadas (y «¡COMBO!» sobre el 🍦), dentro de la carta
  function palabras(c, t) {
    TURNOS.forEach(function (tu, i) {
      var te = tEmoji(i), d = t - te, dura = tu.combo ? 0.6 : 0.5;
      if (d < 0 || d > dura) return;
      var nivel = Math.min(6, tu.cascadas || 0), txt = tu.combo ? '¡COMBO!' : CASCADA[nivel];
      if (!txt) return;
      // si la jugada siguiente también trae palabra, esta se va en 0,08 s
      var sig = TURNOS[i + 1], sale = te + dura;
      if (sig && (sig.combo || (sig.cascadas || 0) >= 2)) sale = Math.min(sale, tEmoji(i + 1) + 0.08);
      if (t >= sale) return;
      var size = tu.combo ? 92 : 50 + 10 * (nivel - 2), p = posEmoji(i);
      c.save(); c.font = '400 ' + size + 'px ' + F.display;
      var w = c.measureText(txt).width; c.restore();
      var x = Math.max(CX0 + 24 + w / 2, Math.min(CX1 - 24 - w / 2, p.x));
      var y = p.y - TAM * (tu.combo ? 0.85 : 0.62) - (tu.combo ? 40 : 55) * E.out(Math.min(1, d / dura));
      var a = 1 - K.p(t, sale - Math.min(0.17, sale - te - 0.05), sale), k = V.pop(d, 0.16);
      c.save(); c.globalAlpha = a; c.translate(x, y); c.rotate(i % 2 ? 0.07 : -0.07); c.scale(k, k);
      V.texto(c, txt, 0, 0, { size: size, fill: tu.combo ? C.gold : COLOR_CASCADA[nivel], strokeW: Math.round(size * 0.2) });
      c.restore();
    });
  }
  // el 🍦: brillo y chispas que salen de la carta y cruzan la pantalla
  function copa(c, t) {
    EH.forEach(function (ch, i) {
      if (ch !== '🍦') return;
      var te = tEmoji(i), d = t - te;
      if (d < 0 || d > 1.0) return;
      var p = enPantalla(posEmoji(i), capaCarta(t));
      if (d < 0.45) {
        var r = 90 + 330 * E.out(d / 0.45), gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gr.addColorStop(0, 'rgba(255,214,90,' + (0.55 * (1 - d / 0.45)) + ')'); gr.addColorStop(1, 'rgba(255,214,90,0)');
        c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = gr; c.fillRect(p.x - r, p.y - r, 2 * r, 2 * r); c.restore();
      }
      var cols = [C.gold, '#ffffff', C.pink, C.mint, '#ff9a2e', C.ice];
      c.save();
      for (var j = 0; j < 48; j++) {
        var h1 = V.hash(j * 7.7 + 1), h2 = V.hash(j * 3.3 + 2), h3 = V.hash(j * 5.1 + 3);
        var ang = j * 2.39996 + h1, vel = 650 + 1000 * h2;
        var px = p.x + Math.cos(ang) * vel * d, py = p.y + Math.sin(ang) * vel * d + 1100 * d * d;
        c.globalAlpha = Math.max(0, 1 - Math.max(0, d - 0.55) / 0.45);
        c.setTransform(1, 0, 0, 1, px, py); c.rotate(d * (5 + h3 * 9) + j);
        c.fillStyle = cols[j % cols.length];
        if (j % 3 === 0) { c.beginPath(); c.arc(0, 0, 9 + 5 * h3, 0, Math.PI * 2); c.fill(); }
        else c.fillRect(-14, -5, 28, 10);
      }
      c.restore();
    });
  }
  // cuenta de los 3 últimos movimientos, en grande bajo la carta
  function cuenta(c, t) {
    var n = EH.length;
    for (var k = 0; k < 3; k++) {
      var i = n - 3 + k, q = D.movimientos - (i + 1), te = tEmoji(i);
      if (i < 0 || q < 1 || q > 3) continue;
      var ultimo = i === n - 1, fin = ultimo ? T.sello + 0.45 : tEmoji(i + 1);
      if (t < te || t >= fin) continue;
      var d = t - te, kk = d < 0.14 ? 1.9 - 0.9 * E.out(d / 0.14) : 1, a = 1;
      if (ultimo) [0.06, 0.3].forEach(function (b) { var e = d - b; if (e > 0 && e < 0.2) kk *= 1 + 0.09 * Math.sin(Math.PI * e / 0.2); });
      var verde = ultimo && t >= T.sello && D.honesto.gano;
      if (verde) { kk = 1 + 0.22 * Math.max(0, 1 - (t - T.sello) / 0.2); a = 1 - K.p(t, T.sello + 0.25, T.sello + 0.45); }
      var col = verde ? C.ok : '#e8283c';
      c.save(); c.globalAlpha = a;
      if (d < 0.35 && !verde) {   // anillo que se abre con cada número
        c.beginPath(); c.arc(XC, YCUENTA, 130 + 120 * E.out(d / 0.35), 0, Math.PI * 2);
        c.lineWidth = 14 * (1 - d / 0.35) + 2; c.strokeStyle = 'rgba(255,90,106,' + (1 - d / 0.35) + ')'; c.stroke();
      }
      c.translate(XC, YCUENTA); c.scale(kk, kk);
      c.beginPath(); c.arc(0, 0, 128, 0, Math.PI * 2); c.fillStyle = col; c.fill();
      c.lineWidth = 24; c.strokeStyle = C.ink; c.stroke(); c.lineWidth = 12; c.strokeStyle = C.cream; c.stroke();
      V.texto(c, String(q), 0, -20, { size: 180, fill: C.cream, strokeW: 22, sombra: false });
      V.texto(c, verde ? '¡DE SOBRA!' : q === 1 ? 'QUEDA' : 'QUEDAN', 0, 72, { font: F.body, weight: '900', size: 34,
        fill: C.cream, stroke: false, sombra: false, maxW: 172 });
      c.restore();
    }
  }
  // el fondo se oscurece con la cuenta y vuelve de golpe con el sello
  function tension(c, t) {
    if (t < T.ultimo - 0.3 || t >= T.sello) return;
    c.save(); c.fillStyle = 'rgba(15,4,20,' + (0.42 * K.p(t, T.ultimo - 0.3, T.sello - 0.05, E.io)) + ')';
    c.fillRect(0, 0, W, K.H); c.restore();
  }
  // entre la burla (arriba) y la reacción (arriba) la cabecera asomaría 0,4 s: la tapa la banda
  function bandaPantalla(c) {
    var gr = c.createLinearGradient(0, 0, 0, 415);
    gr.addColorStop(0, 'rgba(32,10,38,1)'); gr.addColorStop(305 / 415, 'rgba(32,10,38,1)');
    gr.addColorStop(345 / 415, 'rgba(32,10,38,0.93)'); gr.addColorStop(1, 'rgba(32,10,38,0)');
    c.save(); c.fillStyle = gr; c.fillRect(0, 0, W, 415); c.restore();
  }
  function tapaCabecera(c, t, hayArriba) {
    if (hayArriba || t < T.ultimo || t >= T.sello + 0.6) return;
    var gr = c.createLinearGradient(0, 0, 0, 470);
    gr.addColorStop(0, 'rgba(32,10,38,1)'); gr.addColorStop(400 / 470, 'rgba(32,10,38,1)'); gr.addColorStop(1, 'rgba(32,10,38,0)');
    c.save(); c.fillStyle = gr; c.fillRect(0, 0, W, 470); c.restore();
  }

  // la tarjeta no se queda quieta: la mano del tutorial del juego toca «JUEGA GRATIS» dos veces y el botón rebota
  var TOQUES = [0.62, 1.02];
  function tarjetaViva(c, t) {
    var d = t - T.tarjeta, img = K.icono('hand');
    var k = 1;
    TOQUES.forEach(function (tq) { var e = d - tq; if (e >= 0 && e < 0.3) k += 0.07 * Math.sin(Math.PI * e / 0.3); });
    if (k > 1.001) {   // el mismo botón de K.tarjetaFinal, un poco más grande encima
      c.save(); c.translate(W / 2, 790); c.scale(k, k);
      V.rr(c, -400, -78, 800, 156, 78); c.fillStyle = C.pink; c.fill(); c.lineWidth = 12; c.strokeStyle = C.ink; c.stroke();
      V.texto(c, OPC_TARJETA.cta, 0, 4, { size: 92, fill: C.cream, strokeW: 16, sombra: false });
      c.restore();
    }
    if (!img.complete || d < 0.42) return;
    var ent = E.out(K.p(d, 0.42, 0.58)), s = 150, abajo = TOQUES.some(function (tq) { return d >= tq && d < tq + 0.14; });
    var x = K.lerp(1060, 892, ent), y = K.lerp(1250, 800, ent) + (abajo ? 6 : 0);
    c.save(); c.globalAlpha = ent;
    if (abajo) {
      c.beginPath(); c.arc(x, y, 40, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.4)'; c.fill();
      c.lineWidth = 6; c.strokeStyle = 'rgba(255,255,255,0.95)'; c.stroke();
    }
    c.shadowColor = 'rgba(43,22,48,0.45)'; c.shadowBlur = 18; c.shadowOffsetY = 8;
    c.drawImage(img, x - s * 10.75 / 24, y - s * 4.5 / 24, s, s);
    c.restore();
  }

  /* ---------- envoltura del montaje que arma la plantilla ---------- */
  var tarjetaOrig = K.tarjetaFinal;
  // la tarjeta se arma 1,8 veces más rápido: botón a 0,19 s, «link en el perfil» a 0,31 s y «cocardo.app» a 0,39 s
  K.tarjetaFinal = function (t, t0, o) { return tarjetaOrig(t0 + (t - t0) * RAPIDA, t0, o); };

  var montajeOrig = K.montaje;
  K.montaje = function (M) {
    K.montaje = montajeOrig;
    T = window.__F05;
    CARTA_H = 136 + Math.ceil(EH.length / POR_FILA) * PASO + 96;
    CY = CARTA_Y + CARTA_H / 2;
    YCUENTA = Math.round((CARTA_Y + CARTA_H + SAFE.bottom) / 2);
    var FUERZA = { '🟨': [0.04, 0.03, 4, 0.2], '🟧': [0.06, 0.045, 8, 0.25], '🟥': [0.08, 0.055, 12, 0.3], '🍦': [0.1, 0.07, 16, 0.35] };
    EH.forEach(function (ch, i) {
      var f = FUERZA[ch];
      if (f) golpes.push({ t: tEmoji(i), fondo: f[0], carta: f[1], temblor: f[2], dur: f[3] });
    });
    golpes.push({ t: T.sello, fondo: 0.08, carta: 0.05, temblor: 14, dur: 0.35 });

    // cámara del tablero (el clip que empieza en 0 y llega al reto final)
    M.clips.forEach(function (cl) {
      if (cl.de !== 0) return;
      var keys = [];
      for (var i = 0, n = Math.ceil(cl.a * 30) + 2; i <= n; i++) keys.push([i / 30, camFondo(i / 30), 'lin']);
      cl.cam = keys;
    });
    M.dur = function () { return T.fin + COLA; };

    var capasOrig = M.capas;
    M.capas = function (c, t, extra) {
      if (cola != null) {
        // cola del bucle: el cuadro 0 de la plantilla y la tarjeta que sale barrida hacia la izquierda
        capasOrig(c, 0, extra);
        if (cola < BARRIDO) {
          c.save(); c.translate(-W * E.in(cola / BARRIDO), 0);
          tarjetaOrig(T.tarjeta + 5, T.tarjeta, OPC_TARJETA);
          c.restore();
        }
        return;
      }
      tension(c, t);
      var subOrig = K.subtitulo, diferidos = [], z = capaCarta(t);
      if (t < T.tarjeta) K.subtitulo = function () { diferidos.push(arguments); };
      if (z && z.s < 1) bandaPantalla(c);
      c.save();
      try {
        if (z) aplicar(c, z);
        capasOrig(c, t, extra);
        if (t >= T.carta && t < T.reto) palabras(c, t);
      } finally { c.restore(); K.subtitulo = subOrig; }
      if (t >= T.carta && t < T.reto) {
        tapaCabecera(c, t, diferidos.some(function (a) { return a[4] && a[4].arriba; }));
        copa(c, t);
        cuenta(c, t);
      }
      diferidos.forEach(function (a) { subOrig.apply(K, a); });
      if (t >= T.tarjeta) tarjetaViva(c, t);
    };

    var A = M.audio;
    A.extra.forEach(function (e) { if (e[0] === 'star' && Math.abs(e[2] - (T.tarjeta + 0.35)) < 1e-6) e[2] = T.tarjeta + 0.35 / RAPIDA; });
    A.sfx.push(['pop', T.tarjeta + 0.55 / RAPIDA, { f: 990, v: 0.45 }], ['pop', T.tarjeta + 0.7 / RAPIDA, { f: 1320, v: 0.4 }]);
    for (var k = 0; k < 3; k++) { var ie = EH.length - 3 + k; if (ie >= 0) A.sfx.push(['golpe', tEmoji(ie), { v: 0.4 }]); }
    A.sfx.push(['subida', T.ultimo - 0.3, { dur: T.sello - T.ultimo + 0.28, v: 0.5 }]);
    EH.forEach(function (ch, i) { if (ch === '🍦') A.extra.push(['star', { i: 2 }, tEmoji(i) + 0.06, 0.7]); });
    TOQUES.forEach(function (tq) { A.extra.push(['tap', {}, T.tarjeta + tq, 0.9]); });
    A.sfx.push(['whoosh', T.fin - 0.04, { v: 0.8 }]);
    if (A.musica && A.musica[0]) { A.musica[0].t1 = T.fin + COLA; A.musica[0].fadeOut = 0.2; }

    montajeOrig(M);

    var dibujar = window.Escena.dibujar;
    window.Escena.dibujar = function (t) {
      cola = t >= T.fin - 1e-6 ? t - T.fin : null;
      return dibujar(cola != null ? 0 : t);
    };
  };

  fetch(K.url(DATOS)).then(function (r) {
    if (!r.ok) throw new Error('no encontré ' + DATOS);
    return r.json();
  }).then(function (datos) {
    D = datos; EH = emojis(D.honesto.emojis); TURNOS = D.honesto.turnos || [];
    var s = document.createElement('script');
    s.src = 'formatos/F05/plantilla.js';
    s.onerror = function () { window.__error = 'no se pudo cargar formatos/F05/plantilla.js'; };
    s.onload = function () {
      window.F05({
        datos: DATOS,
        guion: 'dist/estudio/voz/D02-1.json',
        toma: 'D02-1-tablero',
        gancho: ['RETO DIARIO #20', '¿Te sobra más de UNO?'],
        reto: ['¿Te sobra más de UNO?', 'Pega tu fila'],
        emojiTam: TAM, porFila: POR_FILA, cartaY: CARTA_Y,
        subArriba: ['reaccion', 'burla'],
        sePuedeTam: 86,
        tarjeta: TARJETA,
      });
    };
    document.body.appendChild(s);
  }).catch(function (e) { window.__error = String((e && e.message) || e); });
})();
