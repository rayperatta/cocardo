/* F07 · Telenovela — plantilla de montaje (episodios, «Lo que no viste», tráiler). Sale de trailer.js, cherry.js y
   final.js. Un video la usa desde tools/video/videos/<id>/montaje.js (ver README.md de esta carpeta):

     F07({ voz: 'dist/estudio/voz/<id>.json', tomas: {…}, musica: {…}, gancho: {…}, planos: [ … ] });

   La plantilla primero lee el JSON de voces (tools/video/voz/voz.py) y dist/estudio/musica/elegidas.json, y con eso arma
   la línea de tiempo: cada plano dura sus compases (b), sus segundos (d) o lo que tarda su voz, siempre redondeado al
   compás de la música para que cada corte caiga en un golpe. Trae de serie la LISTA DE DOPAMINA:
   - gancho en el cuadro 0 (texto ya puesto, sin pop, sobre la acción) y el rótulo «Ep. N» si lo hay;
   - un estímulo por golpe: corte con whoosh, pulso de cámara en cada compás, textos pop con un «pop» que sube de tono;
   - contador que sube (cascadas), eventos del juego (rescate, golpe al congelador) con texto, temblor y confeti;
   - cámara lenta solo donde se pida (clímax) y destellos suaves (nunca más de uno por plano);
   - voces con subtítulos grandes (K.guion) y la música agachada debajo; los «blip» de los cuadros de diálogo, fuera;
   - tarjeta final de 1 s y bucle: la música de la tarjeta es justo la que precede al cuadro 0, así el bucle no salta.

   Plano: { id, toma (alias de `tomas`), src, vel (número o claves [[t, v]]), tramos ([[desde, hasta, vel], …] de la toma),
     b | d | (sin nada: lo que dure su voz), voz (índice, «hueco», «escena» o id de la línea), vozEn (s desde el corte, 0.1),
     cola (s tras la voz, 0.15), historia (escena de js/story.js: encuadre libre, cuadro de diálogo tapado, viñeta),
     cam / cam2 ({ z, x, y } al empezar / al terminar), pulso (zoom por compás, 0.025), zooms ([[s, factor], …] escalones
     de zoom: los «tres zooms» de telenovela), trans ('golpe' | 'barrido' | 'corte' | 'flash'), tapa (true, 'placa' o
     un rectángulo de la toma), dedo (false la quita), mudo, vol, vineta, grado,
     textos: [{ s, en, hasta, y, size, fill, stroke, font, rot, estilo: 'pop' | 'palabras' | 'script', pop: false }],
     contador: { evento: 'match', campo: 'cascade', x, y, size, color, prefijo: 'x' },
     efectos: [{ en, temblor: [px, s], flash: alfa (≤ 0.4), confeti: true, golpe: volumen, sfx: [nombre, opts] }],
     extra: [[sonido del juego, s, ganancia, opts]], sfx: [[nombre de kit.js, s, opts]], whoosh: false,
     continua: true (dibuja «CONTINUARÁ…» si la toma no lo trae),
     tarjeta: { cta, sub, pie, moodCocardo, moodCherry, linea, adelanto } (plano sin toma: la tarjeta final) }
   `en`/`hasta`: segundos desde el corte, o un evento del juego en ese plano: { evento: 'rescue', n: 0, mas: 0.05,
   si: function (sonido) {…} }.
   Música: { tipo: 'tema' | 'drama' | 'calma' | 'victoria' (de elegidas.json) o archivo, bpm, desde (segundo del archivo
   que suena en t = 0: un golpe; tools/video/formatos/F07/ritmo.py lo calcula), gain, tramos: [{ de, a, gain, fadeIn,
   fadeOut }] (de/a: id de plano o segundos; sin tramos suena de punta a punta), bucle: id del plano
   donde vuelve para enlazar con el cuadro 0 }. pistas: [{ tipo | archivo, de, dur, gain, fadeIn, fadeOut, desde }]. */
(function () {
  'use strict';
  var K = window.K, C = K.C, F = K.F, W = K.W, H = K.H, E = K.E, V = K.V, S = K.SAFE;
  var CX = (S.left + S.right) / 2;          // 500: centro de la zona segura (la franja derecha la tapan los botones)
  var MAXW = S.right - S.left - 40;         // 820
  var HIST = { z: 1.06, x: 540, y: 1390 };  // escenas: retratos arriba, el cuadro de diálogo queda donde va el subtítulo

  function json(ruta) {
    return fetch(K.url(ruta)).then(function (r) {
      if (!r.ok) throw new Error('no encontré ' + ruta + ' (' + r.status + ')');
      return r.json();
    });
  }
  function linea(lineas, v) {
    if (typeof v === 'number') return lineas[v];
    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i];
      if (l.hueco === v || l.id === v || String(l.id) === String(v) || l.escena === v) return l;
    }
    return null;
  }
  function velDe(p) {
    if (p.vel == null) return [[0, 1]];
    return typeof p.vel === 'number' ? [[0, p.vel]] : p.vel;
  }

  window.F07 = function (P) {
    Promise.all([P.voz ? json(P.voz) : Promise.resolve(null),
      json(P.elegidas || 'dist/estudio/musica/elegidas.json').catch(function () { return null; })])
      .then(function (r) { armar(P, r[0], r[1]); })
      .catch(function (e) { window.__error = 'F07: ' + (e && e.message || e); console.error(e); });
  };

  function armar(P, voz, eleg) {
    var M = P.musica || {};
    var pista = M.archivo || (M.tipo && eleg && eleg[M.tipo] && eleg[M.tipo].archivo) || null;
    var bpm = M.bpm || (M.tipo && eleg && eleg[M.tipo] && (eleg[M.tipo].bpm_medido || eleg[M.tipo].bpm)) || 104;
    var B = 60 / bpm;
    var lineas = voz ? (voz.lineas || voz) : [];
    var planos = P.planos, porId = {};

    /* ---------- línea de tiempo ---------- */
    var t = 0, vozFin = 0, usadas = [];
    planos.forEach(function (p, i) {
      p.i = i; p.de = t;
      if (p.id) porId[p.id] = p;
      var tr = p.tramos ? K.tramos(p.tramos, p.rampa) : null;
      if (tr) { p.src = tr.src; p.vel = tr.vel; }
      if (p.voz != null) {
        var ln = linea(lineas, p.voz);
        if (!ln) throw new Error('el plano ' + (p.id || i) + ' pide la voz ' + p.voz + ', que no está en ' + P.voz);
        ln = Object.assign({}, ln, { hora: t + (p.vozEn != null ? p.vozEn : 0.1) });
        vozFin = ln.hora + (+ln.duracion || 0);
        usadas.push(ln);
      }
      var d;
      if (p.b != null) d = p.b * B;
      else if (p.d != null) d = p.d;
      else if (p.voz != null || p.hastaVoz) {
        d = Math.max(p.min || 0, vozFin + (p.cola != null ? p.cola : 0.15) - t);
        d = Math.max(1, Math.ceil(d / B - 0.2)) * B;
      } else if (tr) d = Math.max(1, Math.round(tr.dur / B)) * B;
      else d = 2 * B;
      p.dur = d; p.a = t + d; t += d;
    });
    var DUR = t;
    function hora(v, def) {
      if (v == null) return def;
      if (typeof v === 'number') return v;
      var p = porId[v];
      if (!p) throw new Error('no hay plano «' + v + '»');
      return p.de;
    }
    function horaFin(v, def) {
      if (v == null) return def;
      if (typeof v === 'number') return v;
      return porId[v].a;
    }

    /* ---------- voces y subtítulos ---------- */
    usadas.sort(function (a, b) { return a.hora - b.hora; });
    var g = usadas.length ? K.guion({ lineas: usadas }, usadas.map(function (l) { return l.hora; }), Object.assign({ cola: 0.3 }, P.subtitulos || {})) : null;

    /* ---------- cámara: base que se acerca, pulso en cada compás y escalones de zoom ---------- */
    function camara(p, c0, c1) {
      var amp = p.pulso != null ? p.pulso : P.pulso != null ? P.pulso : 0.025, keys = [], paso = 1 / 60;
      var zooms = (p.zooms || []).map(function (z) { return [p.de + z[0], z[1]]; });
      for (var tt = p.de; tt <= p.a + paso; tt += paso) {
        var k = E.io(K.clamp((tt - p.de) / Math.max(0.01, p.dur), 0, 1));
        var z = K.lerp(c0.z, c1.z, k), x = K.lerp(c0.x, c1.x, k), y = K.lerp(c0.y, c1.y, k);
        if (amp) {
          var desde = tt - Math.floor(tt / B + 1e-6) * B;   // segundos desde el último golpe
          z *= 1 + amp * Math.exp(-desde / 0.11);
        }
        zooms.forEach(function (zz) { if (tt >= zz[0]) z *= 1 + (zz[1] - 1) * E.out(K.clamp((tt - zz[0]) / 0.12, 0, 1)); });
        keys.push([tt, { z: z, x: x, y: y }, 'lin']);
      }
      return keys;
    }
    var clips = [];
    planos.forEach(function (p, i) {
      if (!p.toma) return;
      var hist = !!p.historia;
      var c0 = Object.assign({}, hist ? HIST : { z: 1, x: 540, y: 960 }, p.cam || {});
      var c1 = Object.assign({}, c0, p.cam2 || {});
      var c = { toma: p.toma, de: p.de, a: p.a, src: p.src || 0, vel: velDe(p), cam: camara(p, c0, c1),
        libre: p.libre != null ? p.libre : hist, tapa: p.tapa != null ? p.tapa : hist,
        trans: p.trans || (i ? 'golpe' : 'corte'), vineta: p.vineta != null ? p.vineta : hist ? 0.25 : undefined,
        mudo: p.mudo, vol: p.vol, dedo: p.dedo, grado: p.grado };
      p.clip = c;
      clips.push(c);
    });

    /* ---------- tiempos de eventos del juego ---------- */
    function enDe(p, v, def) {
      if (v == null) return def;
      if (typeof v === 'number') return p.de + v;
      var ev = K.eventos(v.evento, function (s, c) { return c === p.clip && (!v.si || v.si(s)); });
      var e = ev[v.n || 0] || (v.n === -1 ? ev[ev.length - 1] : null);
      if (!e) { console.warn('F07: el plano ' + (p.id || p.i) + ' no tiene el evento ' + v.evento); return def; }
      return e.t + (v.mas || 0);
    }
    var textos = [], efectos = [], contadores = [], popSfx = [], temblor = [];
    function antes() {
      var nPop = 0;
      planos.forEach(function (p) {
        (p.textos || []).forEach(function (x) {
          var o = Object.assign({}, x, { t0: enDe(p, x.en, p.de + 0.04), t1: x.hasta === null ? Infinity : enDe(p, x.hasta, p.a), p: p });
          textos.push(o);
          if ((o.estilo || 'pop') !== 'palabras' && x.pop !== false) popSfx.push(['pop', o.t0, { f: 520 + 45 * Math.min(nPop++, 14), v: 0.55 }]);
        });
        (p.efectos || []).forEach(function (x) {
          var o = Object.assign({}, x, { t0: enDe(p, x.en, p.de), p: p });
          efectos.push(o);
          if (o.temblor) temblor.push([o.t0, o.temblor[0], o.temblor[1] || 0.4]);
        });
        if (p.contador) {
          var ct = p.contador, campo = ct.campo || 'cascade';
          var ev = K.eventos(ct.evento || 'match', function (s, c) { return c === p.clip; });
          var pasos = [], max = 0;
          ev.forEach(function (e) { var n = +(e.opts || {})[campo] || 0; if (n > max) { max = n; pasos.push([e.t, n]); } });
          contadores.push({ p: p, ct: ct, pasos: pasos });
        }
      });
      K.M.temblor = temblor;
    }

    /* ---------- dibujo ---------- */
    function pulsoBeat(tt) { var d = tt - Math.floor(tt / B + 1e-6) * B; return Math.exp(-d / 0.12); }
    function confeti(tt, t0, x0, y0) {
      var d = tt - t0;
      if (d < 0 || d > 1.6) return;
      var ctx = K.ctx(), cols = [C.pink, C.gold, C.mint, C.ice, C.cherry, '#c9a0ff', C.cream];
      ctx.save();
      ctx.globalAlpha = 1 - K.p(d, 1.1, 1.6);
      for (var i = 0; i < 110; i++) {
        var h1 = V.hash(i * 3.1 + 1), h2 = V.hash(i * 7.7 + 2), h3 = V.hash(i * 1.3 + 3);
        var vx = (h1 - 0.5) * 1900, vy = -700 - h2 * 1500;
        var x = x0 + vx * d, y = y0 + vy * d + 2300 * d * d;
        ctx.save(); ctx.translate(x, y); ctx.rotate(h3 * 6 + d * (4 + h1 * 8));
        ctx.fillStyle = cols[i % cols.length];
        ctx.fillRect(-11, -6, 22, 12);
        ctx.restore();
      }
      ctx.restore();
    }
    function rotulo(tt) {
      if (!P.rotulo) return;
      var ctx = K.ctx(), s = P.rotulo;
      ctx.save();
      ctx.font = '400 54px ' + F.display;
      var w = ctx.measureText(s).width + 56, x = S.left + 20, y = 236;
      var k = 1 + 0.04 * pulsoBeat(tt);
      ctx.translate(x + w / 2, y + 36); ctx.scale(k, k); ctx.rotate(-0.04);
      V.rr(ctx, -w / 2, -36, w, 72, 36); ctx.fillStyle = C.pink; ctx.fill();
      ctx.lineWidth = 8; ctx.strokeStyle = C.ink; ctx.stroke();
      V.texto(ctx, s, 0, 2, { size: 54, fill: C.cream, strokeW: 10, sombra: false });
      ctx.restore();
    }
    function gancho(ctx, tt) {
      var G = P.gancho;
      if (!G || tt >= hora(G.hasta, planos[0].a)) return;
      var y0 = G.y || (P.rotulo ? 380 : 300), k = 1 + 0.035 * pulsoBeat(tt);
      K.sombraArriba(0.8, y0 + (G.lineas.length + (G.extra ? G.extra.length : 0)) * 120 + 120);
      rotulo(tt);
      G.lineas.forEach(function (s, i) {
        // en el cuadro 0 ya está escrito (sin pop): es la miniatura del feed
        ctx.save(); ctx.translate(CX, y0 + i * 122); ctx.scale(k, k); ctx.rotate(i % 2 ? 0.025 : -0.03);
        V.texto(ctx, s, 0, 0, { size: G.size || 108, fill: i % 2 ? C.gold : C.cream, strokeW: 22, maxW: MAXW });
        ctx.restore();
      });
      (G.extra || []).forEach(function (x, j) {
        K.popTexto(tt, x.en, x.s, CX, y0 + (G.lineas.length + j) * 122 + 8, { size: x.size || 76, fill: x.fill || C.pink,
          strokeW: 17, rot: -0.02, maxW: MAXW, font: x.font });
      });
    }
    function capas(ctx, tt, extra) {
      gancho(ctx, tt);
      var p = null;
      for (var i = 0; i < planos.length; i++) if (tt >= planos[i].de && tt < planos[i].a) p = planos[i];
      if (!p) return;
      if (p.tarjeta) {
        var o = p.tarjeta;
        K.tarjetaFinal(tt, p.de - (o.adelanto != null ? o.adelanto : 0.2), o);
        if (o.linea) K.popTexto(tt, p.de, o.linea, W / 2, 238, { font: F.body, weight: '900', size: 50, fill: C.ink, stroke: C.cream, strokeW: 11, maxW: 900 });
        return;
      }
      if (p.cine) K.cine(p.cine === true ? 1 : p.cine);
      // textos de arriba con su sombra
      var vis = textos.filter(function (x) { return x.p === p && tt >= x.t0 && tt < x.t1 && !x.abajo; });
      if (vis.length && p.sombra !== false) K.sombraArriba(p.sombra || 0.65, 600);
      textos.forEach(function (x) {
        if (x.p !== p || tt < x.t0 || tt >= x.t1) return;
        var y = x.y || 320, size = x.size || 96, hasta = x.t1 === Infinity ? null : x.t1;
        if (x.estilo === 'palabras') K.palabras(tt, x.t0, x.s, CX, y, { size: size, maxW: MAXW, ritmo: x.ritmo || 0.08, hasta: hasta });
        else if (x.estilo === 'script') K.popTexto(tt, x.t0, x.s, CX, y, { font: F.script, size: size, fill: x.fill || C.cream, stroke: x.stroke || C.drama, strokeW: 16, rot: x.rot || -0.03, maxW: MAXW, hasta: hasta });
        else K.popTexto(tt, x.t0, x.s, CX, y, { size: size, fill: x.fill || C.gold, stroke: x.stroke, strokeW: x.strokeW || Math.round(size * 0.2), rot: x.rot != null ? x.rot : -0.03, maxW: MAXW, hasta: hasta, font: x.font, dur: x.dur });
      });
      contadores.forEach(function (c) {
        if (c.p !== p) return;
        var n = 0, tn = 0;
        c.pasos.forEach(function (s) { if (tt >= s[0]) { n = s[1]; tn = s[0]; } });
        if (!n) return;
        var ct = c.ct, k = V.pop(tt - tn, 0.14), sz = (ct.size || 170) * (1 + Math.min(n, 20) * 0.012);
        ctx.save(); ctx.translate(ct.x || CX, ct.y || 1180); ctx.rotate(-0.08); ctx.scale(k, k);
        V.texto(ctx, (ct.prefijo == null ? 'x' : ct.prefijo) + n, 0, 0, { size: sz, fill: n >= (ct.oro || 10) ? C.gold : (ct.color || C.cream), strokeW: Math.round(sz * 0.16) });
        ctx.restore();
      });
      efectos.forEach(function (e) {
        if (e.p !== p) return;   // el confeti y el destello no pasan al plano siguiente
        if (e.flash) K.flash(tt, e.t0, 0.25, '#fff', Math.min(0.4, e.flash));
        if (e.confeti) confeti(tt, e.t0, e.x || W / 2, e.y || 760);
      });
      if (p.continua) {
        K.popTexto(tt, p.de + (p.continua.en || 0.15), 'CONTINUARÁ…', CX, p.continua.y || 1250, { font: F.script, size: 130, fill: C.gold, stroke: C.drama, strokeW: 18, rot: -0.04, maxW: MAXW });
      }
    }

    /* ---------- audio ---------- */
    var sfx = [['golpe', 0.0, { v: 0.6 }]], extra = [];
    planos.forEach(function (p, i) {
      if (i && p.whoosh !== false) sfx.push(['whoosh', p.de - 0.06, { v: i % 2 ? 0.55 : 0.75 }]);
      (p.sfx || []).forEach(function (s) { sfx.push([s[0], p.de + s[1], s[2] || {}]); });
      (p.extra || []).forEach(function (e) { extra.push([e[0], e[3] || {}, p.de + e[1], e[2] == null ? 1 : e[2]]); });
    });
    var A = { juego: P.juego == null ? 1 : P.juego, sfx: sfx, extra: extra, ducking: P.ducking,
      filtro: function (s) { return P.blips || s.name !== 'blip'; } };
    if (P.volumen) A.volumen = P.volumen;
    if (pista) {
      var desde0 = M.desde || 0, tramos = M.tramos || [{}];
      A.musicaArchivo = pista;
      A.musica = tramos.map(function (q) {
        var t0 = hora(q.de, 0), t1 = horaFin(q.a, DUR);
        return { t0: t0, t1: t1, desde: desde0 + t0, gain: q.gain != null ? q.gain : (M.gain || 1), fadeIn: q.fadeIn != null ? q.fadeIn : 0.02,
          fadeOut: q.fadeOut != null ? q.fadeOut : 0.3, bajar: q.bajar };
      });
      if (M.bucle != null) {
        // la música de la tarjeta es la que va justo antes del cuadro 0: al repetirse, el bucle no salta
        var tb = hora(M.bucle);
        A.musica.push({ t0: tb, t1: DUR, desde: Math.max(0, desde0 - (DUR - tb)), gain: M.gainBucle || M.gain || 1, fadeIn: 0.03, fadeOut: 0.0 });
      }
    }
    A.pistas = (P.pistas || []).map(function (q) {
      var ar = q.archivo || (eleg && eleg[q.tipo] && eleg[q.tipo].archivo);
      if (!ar) return null;
      var t0 = hora(q.de, 0);
      return { archivo: ar, t: t0 + (q.mas || 0), desde: q.desde || 0, dur: q.dur != null ? q.dur : horaFin(q.a, DUR) - t0 - (q.mas || 0),
        gain: q.gain, fadeIn: q.fadeIn, fadeOut: q.fadeOut };
    }).filter(Boolean);

    K.montaje({
      dur: DUR,
      tomas: P.tomas,
      clips: clips,
      antes: function () {
        antes();
        A.sfx = sfx.concat(popSfx);
        efectos.forEach(function (e) {
          if (e.golpe) A.sfx.push(['golpe', e.t0, { v: e.golpe }]);
          if (e.sfx) A.sfx.push([e.sfx[0], e.t0 + (e.sfx[2] || 0), e.sfx[1] || {}]);
          if (e.juego) A.extra.push([e.juego[0], e.juego[2] || {}, e.t0, e.juego[1] == null ? 1 : e.juego[1]]);
        });
        if (P.antes) P.antes({ planos: planos, porId: porId, guion: g, B: B, DUR: DUR });
      },
      capas: function (ctx, tt, extra) {
        capas(ctx, tt, extra);
        if (P.capas) P.capas(ctx, tt, extra, porId);
      },
      audio: A,
    });
    window.F07.info = { DUR: DUR, B: B, planos: planos, guion: g };
  }
})();
