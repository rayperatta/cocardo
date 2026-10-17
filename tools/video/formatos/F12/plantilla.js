/* F12 «Conoce a…» — plantilla de montaje (ver tools/video/formatos/F12/README.md). Sale de montajes/personajes.js.
   Cada video del formato es un montaje corto (tools/video/videos/<id>/montaje.js) que carga este archivo y llama a
     window.F12({ guion, gancho, planos, rafaga?, cierre?, contador?, tarjeta?, musica? })
   Solo arte del juego (retratos SVG de js/art-characters.js), sin tomas. La línea de tiempo sale de las voces (JSON de
   tools/video/voz/voz.py): cada plano dura lo que su voz, y la función tiempos() de abajo es la misma en el navegador y
   en Node (ficha.cjs tiempos <id> la imprime sin renderizar).

   Trae de serie la LISTA DE DOPAMINA:
   - gancho: cuadro 0 con el primer personaje ya hablando (su voz entra a los 0,05 s), la pregunta grande arriba y el
     contador «1/N» en la esquina; la 2.ª línea del gancho ya está y da un golpe con pop a los 0,25 s;
   - ritmo: un personaje nuevo cada 1,5-2 s con barrido de color, whoosh, pop y su placa; dentro de cada plano, el
     cambio de humor con pop y golpe de zoom, y en las víctimas la mano del tutorial que toca el hielo y lo rompe;
   - recompensa que escala: el contador sube con pops cada vez más agudos y cambia de color, los rayos del fondo giran
     más rápido y el nombre crece; ráfaga final (los que no hablan) hasta «N/N» con confeti, golpe y jingle de victoria;
   - tensión y alivio: el ¡TAN-TAN-TAAAN! del juego con tres zooms a la cara (el clímax, hacia el 70 %: tiempos() avisa
     si pasa del 80 %), con la música agachada;
   - sensorial: crujido de hielo, risa del villano, voces con subtítulos grandes y el tema agachado debajo;
   - ganas de jugar: la mano del tutorial rescata a las víctimas, pregunta de cierre («¿Cuántos reconociste?») y la
     tarjeta JUEGA/EMPIEZA GRATIS · link en el perfil · cocardo.app;
   - bucle: tarjeta de 1 s cuyos últimos 0,2 s suben y dejan el cuadro 0 tal cual; la música de la tarjeta es justo la
     que precede a la del cuadro 0, así el bucle no salta.

   Parámetros (P):
     guion      ruta del JSON de voz.py (o el objeto). Cada plano toma sus líneas: `linea: i` (índice en el guion),
                `lineas: [i, j]`, `linea: false` (plano mudo) o, sin nada, la siguiente línea libre de su personaje.
     gancho     ['texto de arriba', 'remate en grande (golpe con pop a los 0,25 s)'] (o un texto solo); los dos se leen en el cuadro 0;
                ganchoHasta: s hasta donde se ve (por defecto, el final del plano 0); ganchoSize, ganchoSize2.
     contador   N: el «n/N» de la esquina; suben los planos (cada personaje una vez, `cuenta: false` lo salta) y la ráfaga.
     planos     [{ id, nombre?, tag?, humores: ['entrada', 'al terminar su línea', …], humorHielo: 'asustado',
                  vic: true (sale congelada; la mano rompe el hielo a los `hieloEn` s, 0,24; en el plano 0 ya va rota),
                  dedo: false (sin mano), libre: false (sin sello «¡LIBRE!»; o el texto del sello),
                  villano: true (fondo más oscuro), entrada: 'villain' | 'golpe' (sonido al entrar),
                  tan: true | { en: s desde el corte, palabra: 'grande', humor, cola } (¡TAN-TAN-TAAAN! con tres zooms;
                       por defecto justo al acabar su línea),
                  risa: true (carcajada y la risa del juego al acabar su línea),
                  ret: { variant: 'panecitos' } (variantes del final, huida/carcel/tubo, solo con P.despuesDelFinal),
                  colores: [oscuro, claro], dur (plano mudo, 1,7 s), min (1,2 s), lead (s del corte a la voz), cola (0,2 s),
                  acompanante: { id, humor, x, s, ret } (detrás, a la izquierda), dato: 'texto' | { texto, en },
                  textos: [{ texto, en: s | 'voz' | 'fin', palabra, x, y, size, color, rot, golpe: true, hasta }],
                  placaNombre: true (nombre en la placa del subtítulo en vez de arriba; el plano del gancho la lleva),
                  reto: { texto, sub, en } (banda de «ganas de jugar» arriba durante el plano, en vez del nombre) }]
     rafaga     [{ id, nombre?, tag? }] los que salen sin voz al final (3 por fila); rafagaTitulo ('¡Y 6 más!'),
                rafagaPaso (0,26 s), rafagaCola (0,4 s), rafagaColores.
     cierre     { texto: '¿Cuántos reconociste?', sub: 'comenta tu número', dur: 1,25, mosaico: true (todos en círculos) }
     reto       { texto, sub, en: s absolutos } banda de «ganas de jugar» arriba desde `en` hasta la tarjeta.
     tarjeta    { cta ('EMPIEZA GRATIS'; 'JUEGA GRATIS' si P.nivel ≤ 10), sub, pie, dur (1,0), moodCocardo, moodCherry }
     musica     'tema' | 'drama' | 'calma' (de dist/estudio/musica/elegidas.json) o false (sin música);
                musicaArchivo, musicaDesde (por defecto el inicio del bucle de la pista), musicaGain (1,4), ducking.
     pausa (0,2 s entre líneas de un mismo plano), despuesDelFinal (permite las variantes del final). */
(function () {
  'use strict';

  /* ---------------- línea de tiempo (pura: sirve en Node) ---------------- */
  var ALIAS = { cherry: 'cereza', 'piña': 'pina', don_pina: 'pina', 'limón': 'limon', 'brócoli': 'brocoli',
    sandia: 'policia_sandia', mango: 'guardaespaldas' };
  function idDe(q) { q = String(q || '').toLowerCase().trim(); return ALIAS[q] || q; }
  var FINAL = { huida: 1, carcel: 1, tubo: 1 };   // variantes que enseñan el final de la temporada 1

  // hora estimada en que suena `palabra` dentro de una línea (reparto por letras y pausas, como los subtítulos)
  function horaPalabra(texto, palabra, h0, dur) {
    var pal = String(texto).split(/\s+/).filter(Boolean), pesos = pal.map(function (w) {
      var pausa = /[.!?…]["»”)]*$/.test(w) ? 1 : /[,;:]["»”)]*$/.test(w) ? 0.45 : 0;
      return w.replace(/[^\p{L}\p{N}]/gu, '').length + 1.2 + pausa * 3;
    });
    var tot = pesos.reduce(function (a, b) { return a + b; }, 0), acc = 0, objetivo = idDe(palabra);
    for (var i = 0; i < pal.length; i++) {
      if (pal[i].toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === objetivo) return h0 + dur * acc / tot;
      acc += pesos[i];
    }
    return h0 + dur;
  }

  function tiempos(P, lineas) {
    lineas = lineas || [];
    var pausa = P.pausa != null ? P.pausa : 0.2;
    var durs = lineas.map(function (l) { return +(l.duracion || l.dur) || Math.max(1, String(l.texto || '').length / 11.5); });
    var usadas = {}, planos = [], horas = [], t = 0, cuenta = 0, contados = {}, eventos = [], avisos = [];
    (P.planos || []).forEach(function (p0, k) {
      var p = Object.assign({}, p0), prev = planos[k - 1];
      p.k = k; p.id = idDe(p.id);
      if (p.ret && FINAL[p.ret.variant] && !P.despuesDelFinal) throw new Error('F12: la variante «' + p.ret.variant + '» es del final (solo con despuesDelFinal)');
      p.mismo = !!(prev && prev.id === p.id && p.corte !== 'barrido');
      var idx;
      if (Array.isArray(p.lineas)) idx = p.lineas.slice();
      else if (typeof p.linea === 'number') idx = [p.linea];
      else if (p.linea === false || p.linea === null) idx = [];
      else {
        idx = [];
        for (var i = 0; i < lineas.length; i++) if (!usadas[i] && idDe(lineas[i].quien) === p.id) { idx = [i]; break; }
      }
      idx.forEach(function (i) {
        if (i < 0 || i >= lineas.length) throw new Error('F12: el plano ' + k + ' pide la línea ' + i + ' y el guion tiene ' + lineas.length);
        if (usadas[i]) avisos.push('la línea ' + i + ' suena dos veces');
        usadas[i] = true;
      });
      p.lin = idx;
      p.t0 = t;
      if (p.vic) p.hielo = k === 0 ? t - 0.12 : t + (p.hieloEn != null ? p.hieloEn : 0.24);
      var lead = p.lead != null ? p.lead : k === 0 ? 0.05 : p.vic ? p.hielo - t + 0.1 : p.entrada === 'villain' ? 0.26 : 0.15;
      var h = t + lead;
      p.horas = [];
      idx.forEach(function (i) { p.horas.push(h); horas[i] = h; h += durs[i] + pausa; });
      p.voz = idx.length ? [p.horas[0], h - pausa] : null;
      var fin = p.voz ? p.voz[1] + (p.cola != null ? p.cola : 0.2) : t + (p.dur || 1.7);
      if (p.voz && p.dur) fin = Math.max(fin, t + p.dur);
      fin = Math.max(fin, t + (p.min != null ? p.min : 1.2));
      if (p.tan) {
        var tn = typeof p.tan === 'object' ? p.tan : {};
        if (tn.en != null) p.tanT = t + tn.en;
        else if (tn.palabra && p.voz) { var u = idx[idx.length - 1]; p.tanT = horaPalabra(lineas[u].texto, tn.palabra, p.horas[p.horas.length - 1], durs[u]); }
        else p.tanT = (p.voz ? p.voz[1] : t + 0.3) + 0.06;
        fin = Math.max(fin, p.tanT + 0.56 + (tn.cola != null ? tn.cola : 0.62));
      }
      if (p.risa) { p.risaT = (p.voz ? p.voz[1] : t + 0.3) + 0.04; fin = Math.max(fin, p.risaT + 0.6); }
      // humores: el primero desde la entrada (o desde que se rompe el hielo); los demás repartidos por la voz
      var hs = p.humores || [p.humor || 'normal'], m = hs.length, ini = p.vic && k > 0 ? p.hielo : t;
      var cambios = [{ t: -1e9, humor: hs[0] }];
      for (var j = 1; j < m; j++) {
        var tc;
        if (p.voz) { var a = p.voz[0] + 0.35, b = Math.max(a, p.voz[1] - 0.12); tc = m === 2 ? b : a + (b - a) * (j - 1) / (m - 2); }
        else tc = ini + (fin - ini) * j / m;
        cambios.push({ t: tc, humor: hs[j] });
      }
      if (p.risa) cambios.push({ t: p.risaT, humor: p.risa === true ? 'carcajada' : p.risa });
      if (p.tan && typeof p.tan === 'object' && p.tan.humor) cambios.push({ t: p.tanT, humor: p.tan.humor });
      cambios.sort(function (x, y) { return x.t - y.t; });
      p.cambios = cambios.filter(function (c, i) { return !i || c.humor !== cambios[i - 1].humor; });
      if (P.contador && p.cuenta !== false && !contados[p.id]) { contados[p.id] = true; cuenta++; p.n = cuenta; eventos.push({ t: k === 0 ? -1 : t, n: cuenta }); }
      p.t1 = fin; t = fin;
      planos.push(p);
    });
    lineas.forEach(function (l, i) { if (!usadas[i]) avisos.push('la línea ' + i + ' («' + l.texto + '») no tiene plano: no suena'); });
    var R = null;
    if (P.rafaga && P.rafaga.length) {
      var paso = P.rafagaPaso || 0.26;
      R = { t0: t, paso: paso };
      R.items = P.rafaga.map(function (it, i) {
        var o = Object.assign({}, typeof it === 'string' ? { id: it } : it);
        o.id = idDe(o.id); o.t = t + 0.12 + i * paso;
        if (o.ret && FINAL[o.ret.variant] && !P.despuesDelFinal) throw new Error('F12: la variante «' + o.ret.variant + '» es del final');
        if (P.contador && !contados[o.id]) { contados[o.id] = true; cuenta++; o.n = cuenta; eventos.push({ t: o.t, n: cuenta }); }
        return o;
      });
      R.t1 = t + 0.12 + (R.items.length - 1) * paso + (P.rafagaCola != null ? P.rafagaCola : 0.4);
      t = R.t1;
    }
    var Ci = null;
    if (P.cierre) { Ci = { t0: t, t1: t + (P.cierre.dur || 1.25) }; t = Ci.t1; }
    var Tj = { t0: t, t1: t + ((P.tarjeta && P.tarjeta.dur) || 1.0) };
    var DUR = Tj.t1;
    var tans = planos.filter(function (p) { return p.tanT != null; }).map(function (p) { return p.tanT + 0.56; });
    var climax = tans.length ? tans[0] : Ci ? Ci.t0 : null;
    if (climax != null && climax > 0.8 * DUR) avisos.push('el clímax cae en el ' + Math.round(100 * climax / DUR) + ' % (máximo 80 %)');
    if (P.contador && cuenta !== P.contador) avisos.push('el contador llega a ' + cuenta + ' y no a ' + P.contador);
    if (DUR > 25.5) avisos.push('dura ' + DUR.toFixed(1) + ' s (más de 25)');
    return { planos: planos, R: R, Ci: Ci, Tj: Tj, DUR: DUR, horas: horas, eventos: eventos, cuenta: cuenta, climax: climax,
      avisos: avisos, durs: durs, ganchoHasta: P.ganchoHasta != null ? P.ganchoHasta : planos.length ? planos[0].t1 : 1.5 };
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { tiempos: tiempos, idDe: idDe, horaPalabra: horaPalabra }; return; }

  /* ---------------- montaje (navegador) ---------------- */
  var K = window.K, C = K.C, F = K.F, V = K.V, W = K.W, H = K.H, E = K.E, SAFE = K.SAFE;
  var XC = (SAFE.left + SAFE.right) / 2;   // 500: centro de la zona segura
  var S = 900, PB = 1470, PY = PB - S / 2, CARA = { x: XC, y: PB - S + 0.47 * S };   // retrato: 900 px, pie en y = 1470
  var MOSTRADOR = 1445;                    // franja de la heladería que tapa el corte del retrato (zona que tapa TikTok)
  var TR = 0.14;                           // barrido entre personajes
  var PALETA = {
    cocardo: ['#6e3f22', '#c58b5a'], lima: ['#3f9a1e', '#b9ee7a'], cereza: ['#a3123a', '#ff6f93'], pina: ['#7b1f33', '#e0a92a'],
    banano: ['#2f2a24', '#c9a43a'], banana: ['#c79a00', '#ffe680'], fresa: ['#c4163c', '#ff8aa0'], durazna: ['#d9622b', '#ffc39a'],
    uva: ['#4b1f8a', '#b48af0'], naranja: ['#d2600a', '#ffb25e'], limon: ['#7d7012', '#f1e27c'], policia_fresa: ['#1d2a52', '#e8545f'],
    policia_sandia: ['#173b2a', '#62c46d'], guardaespaldas: ['#3a1a40', '#ff9a2a'], brocoli: ['#1f4a2a', '#86d36f'], reportera: ['#8a4a14', '#ffd27a'],
  };
  var TAGS = { cocardo: 'el heladero', lima: 'su amor', cereza: 'la socia', pina: 'el millonario', banano: 'el investigador',
    banana: 'su hermana', fresa: 'la prima de Lima', durazna: 'la clienta', uva: 'la nueva', naranja: 'la vecina',
    limon: 'el del callejón', policia_fresa: 'la oficial', policia_sandia: 'el oficial', guardaespaldas: 'el guardaespaldas',
    brocoli: 'el repartidor', reportera: 'la reportera' };
  var COLORES = [C.pink, C.gold, C.mint, C.ice, C.cream, C.cherry, '#9be35a'];

  function json(ruta) {
    if (typeof ruta !== 'string') return Promise.resolve(ruta);
    return fetch(K.url(ruta)).then(function (r) {
      if (!r.ok) throw new Error('no encontré ' + ruta + ' (' + r.status + ')');
      return r.json();
    });
  }
  function cap1(s) { s = String(s || ''); var i = s.search(/[^¿¡«"]/); return i < 0 ? s : s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1); }
  function bump(t, t0, dur) { var d = t - t0; return d < 0 || d > (dur || 0.25) ? 0 : Math.pow(1 - d / (dur || 0.25), 2); }

  window.F12 = function (P) {
    var musica = P.musica === false ? Promise.resolve(null) : json('dist/estudio/musica/elegidas.json').catch(function () { return null; });
    Promise.all([P.guion ? json(P.guion) : Promise.resolve({ lineas: [] }), musica]).then(function (r) {
      construir(P, r[0], r[1]);
    }).catch(function (e) { window.__error = 'F12: ' + String((e && e.message) || e); });
  };
  window.F12.tiempos = tiempos;

  function construir(P, guion, elegidas) {
    var L = Array.isArray(guion) ? guion : guion.lineas || [];
    var T = tiempos(P, L), PL = T.planos, R = T.R, Ci = T.Ci, Tj = T.Tj, DUR = T.DUR;
    window.F12.T = T;
    T.avisos.forEach(function (a) { console.warn('F12: ' + a); });
    var NT = P.contador || 0;

    // voces: solo las líneas con plano, a su hora (los subtítulos los dibuja la plantilla)
    var conHora = [], horasG = [], planoDe = [];
    PL.forEach(function (p) { p.lin.forEach(function (i, j) { conHora.push(L[i]); horasG.push(p.horas[j]); planoDe.push(p); }); });
    var g = conHora.length ? K.guion({ lineas: conHora }, horasG, { subtitulos: false, pausa: P.pausa != null ? P.pausa : 0.2 }) : null;

    /* ---------- dibujo ---------- */
    function colores(p) { return p.colores || PALETA[p.id] || [C.drama, C.drama2]; }
    function nombreDe(id, o) { return (o && o.nombre) || K.personaje(id).nombre; }
    function humorEn(p, t) { var h = p.cambios[0].humor; p.cambios.forEach(function (c) { if (t >= c.t) h = c.humor; }); return h; }
    function ultimoCambio(p, t) { var c0 = null; p.cambios.forEach(function (c, i) { if (i && t >= c.t) c0 = c.t; }); return c0; }
    function cuentaEn(t) { var e = { n: 0, t: -9 }; T.eventos.forEach(function (x) { if (t >= x.t) e = x; }); return e; }
    function frac(n) { return NT ? n / NT : 0; }

    function fondo(ctx, c1, c2, t, giro, oscuro) {
      var gr = ctx.createRadialGradient(XC, 980, 120, XC, 980, 1300);
      gr.addColorStop(0, c2); gr.addColorStop(1, c1);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = 0.11; ctx.translate(XC, 980); ctx.rotate(t * (giro || 0.2)); ctx.fillStyle = '#fff';
      for (var i = 0; i < 14; i++) { ctx.rotate(Math.PI * 2 / 14); if (i % 2) continue; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-120, -1700); ctx.lineTo(120, -1700); ctx.fill(); }
      ctx.restore();
      if (oscuro) { ctx.save(); ctx.globalAlpha = oscuro; ctx.fillStyle = '#1a0820'; ctx.fillRect(0, 0, W, H); ctx.restore(); K.vineta(0.5); }
    }
    function mostrador(ctx) {
      // mostrador de la heladería a rayas menta y blanco con el canto rosa (cae en la franja que tapa TikTok)
      var y = MOSTRADOR;
      ctx.fillStyle = C.mint; ctx.fillRect(0, y, W, H - y);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (var x = 0; x < W; x += 72) ctx.fillRect(x, y + 30, 36, H - y);
      var gr = ctx.createLinearGradient(0, y + 30, 0, y + 150);
      gr.addColorStop(0, 'rgba(43,22,48,0.28)'); gr.addColorStop(1, 'rgba(43,22,48,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, y + 30, W, 120);
      ctx.fillStyle = C.pink; ctx.fillRect(0, y, W, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(0, y + 4, W, 6);
      ctx.fillStyle = 'rgba(43,22,48,0.3)'; ctx.fillRect(0, y - 6, W, 6);
    }
    function retrato(ctx, img, x, yPie, s, alfa) {
      if (!img || !img.complete) return;
      if (alfa != null) { ctx.save(); ctx.globalAlpha = alfa; }
      ctx.drawImage(img, x - s / 2, yPie - s, s, s);
      if (alfa != null) ctx.restore();
    }
    function esquirlas(ctx, t0, t, cx, cy) {
      var d = t - t0;
      if (d < 0 || d > 0.9) return;
      ctx.save();
      for (var i = 0; i < 26; i++) {
        var a = V.hash(i * 7.3) * Math.PI * 2, v = 700 + V.hash(i * 3.1) * 900, s = 18 + V.hash(i * 5.7) * 34;
        var x = cx + Math.cos(a) * v * d, y = cy + Math.sin(a) * v * d + 1400 * d * d;
        ctx.globalAlpha = Math.max(0, 1 - d / 0.9);
        ctx.translate(x, y); ctx.rotate(a + d * 8);
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, s * 0.4); ctx.lineTo(-s * 0.5, s * 0.6); ctx.closePath();
        ctx.fillStyle = i % 3 ? '#dff6ff' : '#9fdcff'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(43,22,48,0.5)'; ctx.stroke();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.restore();
    }
    function confeti(ctx, t, t0, x, y, n) {
      var d = t - t0, dur = 1.8;
      if (d < 0 || d > dur) return;
      var sal = 1 - K.p(d, dur * 0.65, dur);
      ctx.save();
      for (var i = 0; i < n; i++) {
        var h1 = V.hash(i * 1.37 + 0.51), h2 = V.hash(i * 2.11 + 3.1), h3 = V.hash(i * 3.73 + 7.7), h4 = V.hash(i * 5.3 + 1.9);
        var ang = -Math.PI / 2 + (h1 - 0.5) * 2.6, vel = 1100 + h2 * 1900, k = 2.4, e = (1 - Math.exp(-k * d)) / k;
        var px = x + Math.cos(ang) * vel * e, py = y + Math.sin(ang) * vel * e + 750 * d * d * (0.5 + h3 * 0.5);
        ctx.save(); ctx.globalAlpha = sal; ctx.translate(px, py);
        ctx.rotate(h4 * 6 + d * (6 + h1 * 10) * (h2 > 0.5 ? 1 : -1)); ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(d * 9 + i)));
        ctx.fillStyle = COLORES[i % COLORES.length]; ctx.fillRect(-(8 + h3 * 8), -(5 + h4 * 4), 16 + h3 * 16, 9 + h4 * 9);
        ctx.restore();
      }
      ctx.restore();
    }
    // mano del tutorial que llega, toca el hielo y se va (tb = momento en que el hielo se rompe)
    function mano(ctx, t, tb) {
      var d = t - tb;
      if (d < -0.24 || d > 0.2) return;
      var img = K.icono('hand');
      if (!img.complete) return;
      var px = CARA.x + 70, py = CARA.y + 150;
      var lleg = K.p(t, tb - 0.24, tb - 0.08, E.out), x = px + (1 - lleg) * 220, y = py + (1 - lleg) * 300;
      var abajo = d > -0.08 && d < 0.04, s = 200 * (abajo ? 0.88 : 1), a = d > 0.04 ? 1 - K.p(d, 0.04, 0.2) : 1;
      ctx.save(); ctx.globalAlpha = a;
      if (abajo) {
        ctx.beginPath(); ctx.arc(px, py, 50 + 60 * K.p(d, -0.08, 0.04), 0, Math.PI * 2);
        ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
      }
      ctx.shadowColor = 'rgba(43,22,48,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
      ctx.drawImage(img, x - s * 10.75 / 24, y - s * 4.5 / 24, s, s);
      ctx.restore();
    }
    function sello(ctx, t, t0, texto, color) {
      if (t < t0) return;
      var k = V.pop(t - t0, 0.2);
      ctx.save(); ctx.translate(XC + 270, CARA.y - 250); ctx.rotate(0.14); ctx.scale(k, k);
      ctx.font = '400 64px ' + F.display;
      var w = ctx.measureText(texto).width + 60;
      V.rr(ctx, -w / 2, -48, w, 96, 48); ctx.fillStyle = color || C.ok; ctx.fill(); ctx.lineWidth = 9; ctx.strokeStyle = C.ink; ctx.stroke();
      V.texto(ctx, texto, 0, 3, { size: 64, fill: C.cream, strokeW: 12, sombra: false });
      ctx.restore();
    }

    // un plano completo (fondo, retratos, mostrador, toldo, textos propios) en el tiempo t
    function dibujarPlano(ctx, k, t) {
      var p = PL[k], d = t - p.t0, col = colores(p), n = cuentaEn(t).n;
      var oscuro = p.villano ? 0.32 : 0;
      if (p.tanT != null) oscuro += 0.4 * K.p(t, p.tanT - 0.05, p.tanT + 0.25);
      fondo(ctx, col[0], col[1], t, 0.18 + 0.5 * frac(n), oscuro);
      // cámara: empuje lento, golpe en cada cambio de humor, escalones del ¡TAN-TAN-TAAAN!
      var z = 1 + 0.045 * K.p(t, p.t0, p.t1), uc = ultimoCambio(p, t);
      if (uc != null) z += 0.07 * bump(t, uc, 0.22);
      if (p.mismo) z += 0.1 * bump(t, p.t0, 0.24);
      var sh = { x: 0, y: 0 }, golpes = [];
      if (p.tanT != null) {
        [0, 0.27, 0.56].forEach(function (o, i) { var tt = p.tanT + o; z += [0.2, 0.22, 0.32][i] * K.p(t, tt, tt + 0.1, E.out); golpes.push([tt, 10 + 6 * i, 0.25]); });
      }
      if (p.risaT != null) golpes.push([p.risaT, 9, 0.6]);
      if (p.entrada === 'golpe') golpes.push([p.t0 + 0.05, 14, 0.3]);
      (p.textos || []).forEach(function (x) { if (x.golpe) golpes.push([horaTexto(p, x), 14, 0.3]); });
      sh = K.temblor(t, golpes);
      // entrada (pop desde la derecha); el plano 0 ya está puesto (bucle)
      var ent = k === 0 || p.mismo ? 1 : K.p(t, p.t0, p.t0 + 0.24, E.back), entX = (1 - K.p(t, p.t0, p.t0 + 0.2, E.out)) * 240;
      if (k === 0 || p.mismo) entX = 0;
      var bob = Math.sin(d * 5) * 8;
      ctx.save();
      ctx.translate(CARA.x + sh.x + entX, CARA.y + sh.y); ctx.scale(z, z); ctx.translate(-CARA.x, -CARA.y);
      if (p.acompanante) {
        var ac = p.acompanante, sa = ac.s || 720;
        retrato(ctx, K.retrato(idDe(ac.id), ac.humor || 'normal', ac.ret), ac.x != null ? ac.x : XC - 250, PB + 30 + Math.sin(d * 4 + 1) * 6, sa * ent);
      }
      var congelada = p.vic && t < p.hielo;
      var opts = Object.assign({}, p.ret || {});
      if (congelada) opts.frozen = true;
      var img = K.retrato(p.id, congelada ? (p.humorHielo || 'asustado') : humorEn(p, t), opts);
      var tem = congelada && d > 0.1 ? Math.sin(t * 90) * 5 * K.p(t, p.t0 + 0.1, p.hielo) : 0;
      var s = S * (0.82 + 0.18 * ent);
      retrato(ctx, img, XC + tem, PB + bob * 0.6, s);
      ctx.restore();
      if (p.vic) {
        if (k > 0) K.flash(t, p.hielo, 0.16, '#e9f8ff', 0.45);
        esquirlas(ctx, p.hielo, t, CARA.x, CARA.y + 40);
      }
      mostrador(ctx);
      V.toldo(ctx, C.pink, '#ffffff', 120);
      if (p.vic && k > 0 && p.dedo !== false) mano(ctx, t, p.hielo);
      if (p.vic && k > 0 && p.libre !== false) sello(ctx, t, p.hielo + 0.12, typeof p.libre === 'string' ? p.libre : '¡LIBRE!');
      // nombre y etiqueta (salvo bajo el gancho o en la banda del reto)
      var tapadoGancho = P.gancho && t < T.ganchoHasta, tapadoReto = (P.reto && P.reto.en != null && t >= P.reto.en) || p.reto;
      var hastaN = p.tanT != null ? p.tanT + 0.04 : undefined;   // el nombre se va cuando empieza el ¡TAN!
      if (!tapadoGancho && !tapadoReto && !p.placaNombre && !(hastaN != null && t >= hastaN)) {
        var t0n = p.mismo ? -1 : Math.max(p.t0 + 0.03, T.ganchoHasta && P.gancho && p.t0 < T.ganchoHasta ? T.ganchoHasta : 0);
        var tamN = (p.nombreSize || 128) * (1 + 0.16 * frac(n));
        K.popTexto(t, t0n, nombreDe(p.id, p), XC, 380, { size: tamN, strokeW: 24, rot: -0.03, maxW: 840, hasta: hastaN });
        var tag = p.tag != null ? p.tag : TAGS[p.id];
        if (tag) K.popTexto(t, t0n + 0.09, tag, XC, 487, { font: F.body, weight: '900', size: 54, fill: C.gold, strokeW: 13, maxW: 840, hasta: hastaN });
      }
      if (p.dato) {
        var dt = typeof p.dato === 'string' ? { texto: p.dato } : p.dato, tdz = p.t0 + (dt.en != null ? dt.en : 0.5);
        if (t >= tdz && !(p.tanT != null && t >= p.tanT)) {   // el dato se va con el ¡TAN!
          var kd = V.pop(t - tdz, 0.22);
          ctx.save(); ctx.translate(XC, dt.y || 572); ctx.rotate(-0.03); ctx.scale(kd, kd);
          ctx.font = '900 50px ' + F.body;
          var wd = Math.min(860, ctx.measureText(dt.texto).width + 70);
          K.placa(0, 0, wd, 90, 0.85);
          V.texto(ctx, dt.texto, 0, 2, { font: F.body, weight: '900', size: 50, fill: C.mint, strokeW: 11, maxW: wd - 50 });
          ctx.restore();
        }
      }
      (p.textos || []).forEach(function (x) {
        K.popTexto(t, horaTexto(p, x), x.texto, x.x != null ? x.x : XC, x.y || 720, { size: x.size || 110, fill: x.color || C.gold,
          strokeW: Math.round((x.size || 110) * 0.18), rot: x.rot != null ? x.rot : -0.05, hasta: x.hasta != null ? p.t0 + x.hasta : undefined, maxW: 860 });
      });
      if (p.tanT != null) {
        [['¡TAN!', 300, 360, -0.12, C.gold, 120], ['¡TAN!', 700, 372, 0.1, C.pink, 130], ['¡TAAAN!', XC, 520, -0.04, '#ff4f4f', 180]].forEach(function (x, i) {
          K.popTexto(t, p.tanT + [0, 0.27, 0.56][i], x[0], x[1], x[2], { size: x[5], fill: x[4], strokeW: Math.round(x[5] * 0.18), rot: x[3], hasta: p.t1 + 0.05 });
        });
      }
    }
    function horaTexto(p, x) {
      if (x.en === 'voz') return p.voz ? p.voz[0] : p.t0;
      if (x.en === 'fin') return p.voz ? p.voz[1] : p.t1 - 0.4;
      if (x.palabra && p.voz) { var u = p.lin[p.lin.length - 1]; return horaPalabra(L[u].texto, x.palabra, p.horas[p.horas.length - 1], T.durs[u]); }
      return p.t0 + (x.en || 0);
    }

    function contador(ctx, t) {
      if (!NT) return;
      var e = cuentaEn(t);
      if (!e.n) return;
      var f = frac(e.n), color = f < 0.4 ? C.gold : f < 0.8 ? C.pink : '#ff5a5a';
      var k = 1 + 0.35 * bump(t, e.t, 0.28) + 0.12 * f;
      ctx.save(); ctx.translate(180, 262); ctx.rotate(-0.05); ctx.scale(k, k);
      V.rr(ctx, -112, -46, 224, 92, 46); ctx.fillStyle = 'rgba(43,22,48,0.88)'; ctx.fill();
      ctx.lineWidth = 7; ctx.strokeStyle = color; ctx.stroke();
      V.texto(ctx, e.n + '/' + NT, 0, 3, { size: 66, fill: color, strokeW: 12, sombra: false, maxW: 200 });
      ctx.restore();
    }
    // gancho tal cual se ve en el cuadro 0 (t = 0 lo vuelve a dibujar el bucle)
    var gancho = P.gancho ? (Array.isArray(P.gancho) ? P.gancho : [P.gancho]) : null;
    function dibujarGancho(ctx, t) {
      if (!gancho || t >= T.ganchoHasta) return;
      var sal = 1 - K.p(t, T.ganchoHasta - 0.12, T.ganchoHasta, E.in);
      ctx.save(); ctx.globalAlpha = sal;
      K.placa(XC, gancho[1] ? 455 : 410, 900, gancho[1] ? 330 : 200, 0.8);
      K.palabras(t, -5, gancho[0], XC, gancho[1] ? 385 : 410, { size: P.ganchoSize || 72, maxW: 840, resalta: false });
      ctx.restore();
      if (gancho[1]) {
        // el remate ya se lee en el cuadro 0 (portada y bucle) y da un golpe con pop a los 0,25 s
        var t2 = P.ganchoEn2 != null ? P.ganchoEn2 : 0.25, pul = 1 + 0.04 * Math.sin(Math.max(0, t - t2) * 9) * (t >= t2 ? 1 : 0);
        ctx.save(); ctx.globalAlpha = sal; ctx.translate(XC, 548); ctx.rotate(-0.03); var kk = (1 + 0.3 * bump(t, t2, 0.3)) * pul; ctx.scale(kk, kk);
        V.texto(ctx, gancho[1], 0, 0, { size: P.ganchoSize2 || 116, fill: t >= t2 && t < t2 + 0.3 ? C.cream : C.gold, strokeW: 22, maxW: 860 });
        ctx.restore();
      }
    }
    // banda de «ganas de jugar» arriba (P.reto desde r.en hasta la tarjeta, o p.reto durante su plano)
    function dibujarReto(ctx, t, r, t0) {
      if (!r || t0 == null || t < t0) return;
      ctx.save(); ctx.globalAlpha = K.p(t, t0, t0 + 0.12); K.placa(XC, 430, 900, r.sub ? 250 : 160, 0.8); ctx.restore();
      K.palabras(t, t0 + 0.02, r.texto, XC, r.sub ? 380 : 430, { size: r.size || 84, maxW: 840, ritmo: 0.07 });
      if (r.sub) K.popTexto(t, t0 + 0.3, r.sub, XC, 498, { font: F.body, weight: '900', size: 54, fill: C.mint, strokeW: 12, maxW: 840 });
    }
    function subtitulos(t) {
      if (!g) return;
      g.lineas.forEach(function (ln, i) {
        var p = planoDe[i], sig = g.lineas[i + 1];
        var a = ln.voz[0] - 0.08, b = ln.voz[1] + 0.3;
        if (sig && b > sig.voz[0] - 0.08) b = Math.max(a + 0.3, sig.voz[0] - 0.08);
        b = Math.min(b, p.t1 - 0.03);
        if (p.tanT != null && p.tanT > ln.voz[1] - 0.05) b = Math.min(b, p.tanT + 0.04);
        if (p.k === 0 && i === 0) a = Math.min(a, -0.5);   // en el cuadro 0 el subtítulo ya está puesto (bucle)
        if (t >= a && t < b) K.subtitulo(t, a, b, ln.texto, { quien: ln.quien, habla: ln.voz, nombre: p.placaNombre || (p.k === 0 && gancho) ? undefined : false });
      });
    }
    function dibujarRafaga(ctx, t) {
      var cc = P.rafagaColores || ['#1f5f7a', '#7fd0e8'], n = cuentaEn(t).n;
      fondo(ctx, cc[0], cc[1], t, 0.7 + 0.6 * frac(n));
      V.toldo(ctx, C.pink, '#ffffff', 120);
      K.popTexto(t, R.t0 + 0.02, P.rafagaTitulo || '¡Y ' + R.items.length + ' más!', XC, 392, { size: 118, strokeW: 22, rot: -0.03 });
      var cols = 3, filas = Math.ceil(R.items.length / cols), paso = 290, fy = 420;
      R.items.forEach(function (it, i) {
        if (t < it.t) return;
        var c = i % cols, f = Math.floor(i / cols), enFila = Math.min(cols, R.items.length - f * cols);
        var x = XC + (c - (enFila - 1) / 2) * paso, y = 770 + (f - (filas - 1) / 2) * fy + 40;
        var e = V.pop(t - it.t, 0.2), pc = PALETA[it.id] || [C.drama, C.drama2];
        ctx.save(); ctx.translate(x, y); ctx.scale(e, e);
        ctx.beginPath(); ctx.arc(0, 0, 128, 0, Math.PI * 2); ctx.fillStyle = pc[1]; ctx.fill();
        ctx.save(); ctx.clip();
        var img = K.retrato(it.id, it.humor || 'feliz', it.ret);
        if (img.complete) ctx.drawImage(img, -150, -150, 300, 300);
        ctx.restore();
        ctx.lineWidth = 10; ctx.strokeStyle = C.ink; ctx.stroke();
        var nom = it.nombre || K.personaje(it.id).nombre, tag = it.tag != null ? it.tag : TAGS[it.id];
        if (/^(el|la)\s/i.test(nom) && tag) { nom = cap1(tag); tag = ''; }
        V.texto(ctx, nom, 0, 170, { size: 50, strokeW: 11, maxW: 280 });
        if (tag && tag.toLowerCase() !== nom.toLowerCase()) V.texto(ctx, tag, 0, 216, { font: F.body, weight: '900', size: 34, fill: C.gold, strokeW: 9, maxW: 280 });
        ctx.restore();
      });
    }
    function todos() {
      var ids = [], vistos = {};
      PL.forEach(function (p) { if (!vistos[p.id]) { vistos[p.id] = 1; ids.push({ id: p.id, ret: p.ret }); } });
      (R ? R.items : []).forEach(function (it) { if (!vistos[it.id]) { vistos[it.id] = 1; ids.push({ id: it.id, ret: it.ret }); } });
      return ids;
    }
    function humorMosaico(id) { return id === 'cocardo' ? 'carcajada' : id === 'cereza' ? 'coqueta' : 'feliz'; }
    function dibujarCierre(ctx, t) {
      var cz = P.cierre || {};
      fondo(ctx, C.drama, C.drama2, t, 1.1);
      V.toldo(ctx, C.pink, '#ffffff', 120);
      if (cz.mosaico !== false) {
        var ids = todos(), cols = 4, tam = 205, filas = Math.ceil(ids.length / cols);
        ids.forEach(function (o, i) {
          var c = i % cols, f = Math.floor(i / cols), tt = Ci.t0 + i * 0.018, e = V.pop(t - tt, 0.18);
          if (e <= 0) return;
          var x = XC + (c - (cols - 1) / 2) * tam, y = 935 + (f - (filas - 1) / 2) * tam;
          ctx.save(); ctx.translate(x, y); ctx.scale(e, e);
          ctx.beginPath(); ctx.arc(0, 0, tam * 0.46, 0, Math.PI * 2); ctx.fillStyle = (PALETA[o.id] || [0, C.cream])[1]; ctx.fill();
          ctx.save(); ctx.clip();
          var img = K.retrato(o.id, humorMosaico(o.id), o.ret);
          if (img.complete) ctx.drawImage(img, -tam * 0.55, -tam * 0.5, tam * 1.1, tam * 1.1);
          ctx.restore();
          ctx.lineWidth = 8; ctx.strokeStyle = C.ink; ctx.stroke();
          ctx.restore();
        });
      }
      if (NT) {
        var k = V.pop(t - Ci.t0, 0.26) * (1 + 0.04 * Math.sin((t - Ci.t0) * 8));
        ctx.save(); ctx.translate(XC, 300); ctx.rotate(-0.05); ctx.scale(k, k);
        V.texto(ctx, T.cuenta + '/' + NT, 0, 0, { size: 170, fill: C.gold, strokeW: 28 });
        ctx.restore();
      }
      if (cz.texto) K.palabras(t, Ci.t0 + 0.15, cz.texto, XC, NT ? 455 : 400, { size: cz.size || 84, maxW: 860, ritmo: 0.07 });
      if (cz.sub) K.popTexto(t, Ci.t0 + 0.45, cz.sub, XC, 1405, { font: F.body, weight: '900', size: 54, fill: C.mint, strokeW: 12, maxW: 840 });
      confeti(ctx, t, Ci.t0, XC, 330, 130);
    }
    var cta = (P.tarjeta && P.tarjeta.cta) || (P.nivel != null && P.nivel <= 10 ? 'JUEGA GRATIS' : 'EMPIEZA GRATIS');
    function dibujarTarjeta(ctx, t) {
      // entra ya armada (título, personajes y botón; link y dominio a los 0,1 y 0,25 s); en los últimos 0,2 s sube y deja
      // ver el cuadro 0 tal cual
      var tj = P.tarjeta || {}, fin = (Math.round(DUR * 30) - 1) / 30, k = K.p(t, fin - 0.2, fin, E.in);
      if (k > 0) cuadro(ctx, 0, true);
      if (k >= 1) return;
      ctx.save(); ctx.translate(0, -H * 1.05 * k);
      K.tarjetaFinal(t, Tj.t0 - 0.45, { cta: cta, sub: tj.sub, pie: tj.pie, moodCocardo: tj.moodCocardo || 'carcajada', moodCherry: tj.moodCherry });
      ctx.restore();
    }
    // todo lo que se ve en t (sin la tarjeta si bucle = true)
    function cuadro(ctx, t, bucle) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!bucle && t >= Tj.t0) { dibujarTarjeta(ctx, t); return; }
      if (Ci && t >= Ci.t0) { dibujarCierre(ctx, t); return; }
      if (R && t >= R.t0) { dibujarRafaga(ctx, t); contador(ctx, t); return; }
      var k = 0;
      for (var i = 0; i < PL.length; i++) if (t >= PL[i].t0) k = i;
      var p = PL[k];
      if (k > 0 && !p.mismo && t < p.t0 + TR) {
        dibujarPlano(ctx, k - 1, PL[k - 1].t1 - 1 / 60);
        var u = E.out(K.p(t, p.t0, p.t0 + TR)), xe = W + 300 - u * (W + 640);
        ctx.save(); ctx.beginPath(); ctx.moveTo(xe, 0); ctx.lineTo(W + 20, 0); ctx.lineTo(W + 20, H); ctx.lineTo(xe - 300, H); ctx.closePath(); ctx.clip();
        dibujarPlano(ctx, k, t);
        ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.moveTo(xe, 0); ctx.lineTo(xe - 300, H); ctx.lineWidth = 26; ctx.strokeStyle = colores(p)[1]; ctx.stroke(); ctx.restore();
      } else dibujarPlano(ctx, k, t);
      dibujarGancho(ctx, t);
      if (P.reto) dibujarReto(ctx, t, P.reto, P.reto.en);
      if (p.reto && !(k > 0 && !p.mismo && t < p.t0 + TR)) dibujarReto(ctx, t, p.reto, p.t0 + (p.reto.en || 0.05));
      contador(ctx, t);
      subtitulos(bucle ? 0 : t);
    }

    /* ---------- sonido ---------- */
    var A = {}, ex = [], sfx = [];
    PL.forEach(function (p, k) {
      if (k > 0) sfx.push(p.mismo ? ['pop', p.t0, { f: 820, v: 0.55 }] : ['whoosh', p.t0 - 0.06, { v: 0.75 }]);
      if (p.vic) {
        if (k > 0) ex.push(['tap', {}, p.hielo - 0.06, 0.8], ['ice', { hp: 0 }, p.hielo, 1.3], ['frost', {}, p.hielo + 0.04, 1]);
        else ex.push(['ice', { hp: 0 }, 0, 1.0], ['frost', {}, 0.02, 0.9]);
        if (k > 0 && p.libre !== false) sfx.push(['pop', p.hielo + 0.12, { f: 1050, v: 0.4 }]);
      }
      if (p.entrada === 'villain') ex.push(['villain', {}, p.t0 + 0.01, 0.75]);
      if (p.entrada === 'golpe') sfx.push(['golpe', p.t0 + 0.05, { v: 0.7 }]);
      p.cambios.forEach(function (c, i) { if (i && c.t > p.t0 + 0.1 && c.t !== p.risaT) sfx.push(['pop', c.t, { f: 900, v: 0.42 }]); });
      if (p.tanT != null) { ex.push(['drama', {}, p.tanT, 1.0]); sfx.push(['golpe', p.tanT + 0.56, { v: 0.35 }]); }
      if (p.risaT != null) ex.push(['laugh', { who: p.id }, p.risaT, 0.95]);
      (p.textos || []).forEach(function (x) { var tt = horaTexto(p, x); sfx.push(x.golpe ? ['golpe', tt, { v: 0.7 }] : ['pop', tt, { f: 760, v: 0.5 }]); });
      if (p.dato) sfx.push(['pop', p.t0 + ((p.dato.en != null ? p.dato.en : 0.5)), { f: 680, v: 0.45 }]);
    });
    // el contador sube con pops cada vez más agudos (1,5 semitonos por personaje)
    T.eventos.forEach(function (e) { if (e.t > 0) sfx.push(['pop', e.t + 0.01, { f: 480 * Math.pow(2, e.n * 1.5 / 12), v: 0.7 }]); });
    if (gancho && gancho[1]) sfx.push(['pop', P.ganchoEn2 != null ? P.ganchoEn2 : 0.25, { f: 640, v: 0.6 }]);
    if (P.reto && P.reto.en != null) sfx.push(['whoosh', P.reto.en - 0.04, { v: 0.6 }]);
    PL.forEach(function (p) { if (p.reto) sfx.push(['pop', p.t0 + (p.reto.en || 0.05) + 0.3, { f: 720, v: 0.5 }]); });
    if (R) { sfx.push(['whoosh', R.t0 - 0.05, {}], ['subida', R.t0 + 0.05, { dur: Math.max(0.6, (Ci ? Ci.t0 : Tj.t0) - R.t0 - 0.08), v: 0.45 }]); }
    if (Ci) { sfx.push(['whoosh', Ci.t0 - 0.05, { v: 0.6 }], ['golpe', Ci.t0, { v: 0.9 }]); ex.push(['win', {}, Ci.t0 + 0.03, 0.85]); }
    sfx.push(['whoosh', Tj.t0 - 0.04, {}], ['pop', Tj.t0 + 0.01, { f: 600 }], ['pop', Tj.t0 + 0.11, { f: 800 }], ['pop', Tj.t0 + 0.26, { f: 1000, v: 0.6 }],
      ['whoosh', DUR - 0.24, { v: 0.7 }]);
    A.extra = ex; A.sfx = sfx;
    var tipo = P.musica === false ? null : (typeof P.musica === 'string' ? P.musica : 'tema');
    var el = elegidas && tipo ? elegidas[tipo] : null;
    var archivo = P.musicaArchivo || (el && el.archivo);
    var bajar = [];
    PL.forEach(function (p) { if (p.tanT != null) bajar.push([p.tanT - 0.05, p.tanT + 1.25, 0.12]); });
    if (Ci) bajar.push([Ci.t0, Ci.t0 + 1.0, 0.45]);
    if (tipo) {
      var gain = P.musicaGain || 1.4;
      if (archivo) {
        // la tarjeta suena con lo que precede al cuadro 0: al volver al principio la música sigue sin saltar
        var desde = P.musicaDesde != null ? P.musicaDesde : (el && el.bucle && el.bucle.inicio) || 0;
        var cola = Tj.t1 - Tj.t0;
        A.musicaArchivo = archivo;
        A.musica = desde >= cola + 0.1
          ? [{ t0: 0, t1: Tj.t0 + 0.03, desde: desde, gain: gain, fadeIn: 0.01, fadeOut: 0.05, bajar: bajar },
             { t0: Tj.t0, t1: DUR, desde: desde - cola, gain: gain, fadeIn: 0.05, fadeOut: 0.01 }]
          : [{ t0: 0, t1: DUR, desde: desde, gain: gain, fadeIn: 0.01, fadeOut: 0.3, bajar: bajar }];
      } else {
        A.musica = [{ t0: 0, t1: DUR, desde: 0, gain: gain, fadeOut: 0.3, bajar: bajar }];   // la cumbia del juego
      }
    }
    A.ducking = P.ducking || { musica: 0.32, juego: 0.6 };

    K.montaje({
      dur: DUR,
      antes: function () {
        var pedir = function (id, humor, ret) { K.retrato(id, humor, ret); };
        PL.forEach(function (p) {
          p.cambios.forEach(function (c) { pedir(p.id, c.humor, p.ret || {}); });
          if (p.vic) pedir(p.id, p.humorHielo || 'asustado', Object.assign({}, p.ret || {}, { frozen: true }));
          if (p.acompanante) pedir(idDe(p.acompanante.id), p.acompanante.humor || 'normal', p.acompanante.ret);
        });
        if (R) R.items.forEach(function (it) { pedir(it.id, it.humor || 'feliz', it.ret); });
        if (Ci) todos().forEach(function (o) { pedir(o.id, humorMosaico(o.id), o.ret); });
        var tj = P.tarjeta || {};
        pedir('cocardo', tj.moodCocardo || 'carcajada'); pedir('cereza', tj.moodCherry || 'coqueta');
        K.icono('hand');
      },
      capas: function (ctx, t) { cuadro(ctx, t, false); },
      audio: A,
    });
  }
})();
