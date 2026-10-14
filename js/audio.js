/* Cocardo: ¡Rescate Helado! — Audio sintetizado con WebAudio (sin archivos de sonido).
 * Contrato: docs/ARQUITECTURA.md §9. Lista de sonidos: docs/DISENO.md §13.
 * En Node (sin window) es un stub inofensivo: todas las funciones existen y no hacen nada. */
(function () {
  'use strict';

  var root = typeof window !== 'undefined' ? window : null;
  var Cocardo = root ? (root.Cocardo = root.Cocardo || {}) : {};

  var NAMES = ['tap', 'swap', 'invalid', 'match', 'special', 'paleta', 'bomba', 'copa', 'combo', 'ice', 'frost',
    'crate', 'rescue', 'token', 'tick', 'laugh', 'freezerHit', 'heartbeat', 'win', 'star', 'lose', 'drama', 'blip',
    'villain', 'shuffle', 'booster'];

  // Niveles generales (el compresor y el limitador evitan saturar)
  var MASTER_VOL = 0.6;
  var MUSIC_VOL = 0.28;
  var REVERB_SEND = 0.16;
  var LEAD = 0.012;          // margen de programación (s)
  var THROTTLE = 0.03;       // mismo sonido dentro de 30 ms -> se ignora
  var MAX_VOICES = 72;       // fuentes simultáneas máximas

  var live = null;           // grafo del AudioContext en vivo
  var muted = false;
  var musicOn = false;
  var unsupported = false;
  var unlockAt = -1e9;
  var last = {};
  var voices = 0;
  var blipN = 0;
  var noiseOff = 0;
  var lcg = 0x2545f491;
  var autoSuspended = false;
  var listening = false;
  var music = null;          // estado del secuenciador de música

  function noop() {}
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  // Entero acotado; valores no numéricos -> def
  function int(v, def, a, b) {
    var n = Math.round(Number(v));
    return isFinite(n) ? clamp(n, a, b) : def;
  }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function nowMs() {
    return (root && root.performance && root.performance.now) ? root.performance.now() : new Date().getTime();
  }
  // Ruido determinista (LCG), sin Math.random
  function rnd() {
    lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0;
    return lcg / 4294967296 * 2 - 1;
  }

  /* ---------- Búferes generados ---------- */

  function makeNoise(ctx, secs) {
    var n = Math.floor(ctx.sampleRate * secs);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = rnd();
    return buf;
  }

  // Respuesta de impulso corta y suave para una sala pequeña (brillo "pulido")
  function makeImpulse(ctx, secs) {
    var sr = ctx.sampleRate;
    var n = Math.floor(sr * secs);
    var pre = Math.floor(sr * 0.012);
    var buf = ctx.createBuffer(2, n, sr);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      var lp = 0;
      for (var i = 0; i < n; i++) {
        if (i < pre) { d[i] = 0; continue; }
        var k = (i - pre) / (n - pre);
        lp += 0.35 * (rnd() - lp);           // ruido oscurecido (menos áspero)
        d[i] = lp * Math.pow(1 - k, 3.2);
      }
    }
    return buf;
  }

  // Raspado de güiro: ruido agudo modulado por "dientes"
  function makeGuiro(ctx, secs, ridgeHz) {
    var sr = ctx.sampleRate;
    var n = Math.floor(sr * secs);
    var buf = ctx.createBuffer(1, n, sr);
    var d = buf.getChannelData(0);
    var px = 0, py = 0, ph = 0;
    for (var i = 0; i < n; i++) {
      var t = i / sr;
      var x = rnd();
      py = 0.86 * (py + x - px); px = x;          // pasa-altos simple
      ph += (ridgeHz * (1 + 0.35 * t / secs)) / sr;
      var ridge = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * ph), 3);
      var env = Math.min(1, t / 0.006) * Math.min(1, (secs - t) / (secs * 0.35));
      d[i] = py * (0.25 + 0.75 * ridge) * env;
    }
    return buf;
  }

  /* ---------- Grafo ---------- */

  function buildGraph(ctx, offline) {
    var G = { ctx: ctx, offline: !!offline };
    var master = ctx.createGain();
    master.gain.value = (!offline && muted) ? 0 : MASTER_VOL;
    var shelf = ctx.createBiquadFilter();       // recorta lo más chillón
    shelf.type = 'lowpass';
    shelf.frequency.value = 12000;
    shelf.Q.value = 0;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 10;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    var lim = ctx.createDynamicsCompressor();   // limitador final
    lim.threshold.value = -3;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.08;
    master.connect(shelf);
    shelf.connect(comp);
    comp.connect(lim);
    lim.connect(ctx.destination);

    var sfx = ctx.createGain();
    sfx.connect(master);
    var mus = ctx.createGain();
    mus.gain.value = MUSIC_VOL;
    mus.connect(master);

    if (ctx.createConvolver) {
      try {
        var conv = ctx.createConvolver();
        conv.buffer = makeImpulse(ctx, 0.9);
        var send = ctx.createGain();
        send.gain.value = REVERB_SEND;
        sfx.connect(send);
        var msend = ctx.createGain();
        msend.gain.value = REVERB_SEND * 0.6;
        mus.connect(msend);
        send.connect(conv);
        msend.connect(conv);
        conv.connect(master);
      } catch (e) { /* sin reverberación */ }
    }

    G.master = master;
    G.sfx = sfx;
    G.music = mus;
    G.noise = makeNoise(ctx, 1);
    G.guiroL = makeGuiro(ctx, 0.15, 42);
    G.guiroS = makeGuiro(ctx, 0.045, 60);
    return G;
  }

  /* ---------- Primitivas de voz ---------- */

  function track(G, src, nodes) {
    if (!G.offline) voices++;
    src.onended = function () {
      if (!G.offline) voices = Math.max(0, voices - 1);
      for (var i = 0; i < nodes.length; i++) {
        try { nodes[i].disconnect(); } catch (e) { /* ya desconectado */ }
      }
    };
  }

  function path(param, t, pts) {
    for (var i = 0; i < pts.length; i++) param.exponentialRampToValueAtTime(pts[i][1], t + pts[i][0]);
  }

  // Envolvente: ataque lineal, caída exponencial; con s>0 sostiene hasta `hold` y suelta en `r`
  function envelope(p, t, o, peak) {
    var a = o.a != null ? o.a : 0.004;
    var d = o.d != null ? o.d : 0.15;
    var s = o.s || 0;
    var r = o.r != null ? o.r : 0.08;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    if (!s) {
      p.exponentialRampToValueAtTime(0.0001, t + a + d);
      return t + a + d;
    }
    var hold = Math.max(o.hold || 0, a + d);
    var sv = Math.max(peak * s, 0.0001);
    p.exponentialRampToValueAtTime(sv, t + a + d);
    p.setValueAtTime(sv, t + hold);
    p.exponentialRampToValueAtTime(0.0001, t + hold + r);
    return t + hold + r;
  }

  function addFilter(ctx, head, f, t, nodes) {
    var fl = ctx.createBiquadFilter();
    fl.type = f.type || 'lowpass';
    fl.Q.value = f.q != null ? f.q : 0.7;
    fl.frequency.setValueAtTime(f.f, t);
    if (f.f2) fl.frequency.exponentialRampToValueAtTime(f.f2, t + (f.glide || 0.1));
    if (f.fs) path(fl.frequency, t, f.fs);
    head.connect(fl);
    nodes.push(fl);
    return fl;
  }

  // Filtros + envolvente + trémolo + paneo; devuelve el tiempo final
  function chain(G, head, nodes, t, o, out) {
    var ctx = G.ctx;
    if (o.filt) head = addFilter(ctx, head, o.filt, t, nodes);
    if (o.filt2) head = addFilter(ctx, head, o.filt2, t, nodes);
    var g = ctx.createGain();
    head.connect(g);
    head = g;
    nodes.push(g);
    var end = envelope(g.gain, t, o, (o.v != null ? o.v : 0.2) * (G.k || 1));
    if (o.trem) {
      var tg = ctx.createGain();
      tg.gain.value = 1 - o.trem.depth / 2;
      var lfo = ctx.createOscillator();
      lfo.frequency.value = o.trem.rate;
      var lg = ctx.createGain();
      lg.gain.value = o.trem.depth / 2;
      lfo.connect(lg);
      lg.connect(tg.gain);
      head.connect(tg);
      head = tg;
      lfo.start(t);
      lfo.stop(end + 0.05);
      nodes.push(tg, lfo, lg);
    }
    if (o.pan && ctx.createStereoPanner) {
      var pn = ctx.createStereoPanner();
      pn.pan.value = clamp(o.pan, -1, 1);
      head.connect(pn);
      head = pn;
      nodes.push(pn);
    }
    head.connect(out);
    return end;
  }

  // Oscilador: o = { type, f, f2, glide, fs:[[dt,f]], det, vib:{rate,cents,to,delay}, filt, filt2, a,d,s,hold,r, v, trem, pan }
  function tone(G, out, t, o) {
    var ctx = G.ctx;
    var src = ctx.createOscillator();
    src.type = o.type || 'sine';
    src.frequency.setValueAtTime(o.f, t);
    if (o.f2) {
      var gl = o.glide != null ? o.glide : ((o.a || 0.004) + (o.d != null ? o.d : 0.15));
      if (o.lin) src.frequency.linearRampToValueAtTime(o.f2, t + gl);
      else src.frequency.exponentialRampToValueAtTime(o.f2, t + gl);
    }
    if (o.fs) path(src.frequency, t, o.fs);
    if (o.det) src.detune.setValueAtTime(o.det, t);
    var nodes = [src];
    var end = chain(G, src, nodes, t, o, out);
    if (o.vib) {
      var vl = ctx.createOscillator();
      vl.frequency.value = o.vib.rate;
      var vg = ctx.createGain();
      var c0 = o.vib.delay ? 0 : o.vib.cents;
      vg.gain.setValueAtTime(c0, t);
      if (o.vib.delay) vg.gain.linearRampToValueAtTime(o.vib.cents, t + o.vib.delay);
      if (o.vib.to != null) vg.gain.linearRampToValueAtTime(o.vib.to, end);
      vl.connect(vg);
      vg.connect(src.detune);
      vl.start(t);
      vl.stop(end + 0.05);
      nodes.push(vl, vg);
    }
    src.start(t);
    src.stop(end + 0.03);
    track(G, src, nodes);
    return end;
  }

  // Ruido: o = { buf, rate, filt, filt2, a,d,s,hold,r, v, trem, pan }
  function noise(G, out, t, o) {
    var ctx = G.ctx;
    var src = ctx.createBufferSource();
    var own = !!o.buf;
    src.buffer = own ? o.buf : G.noise;
    src.loop = !own;
    if (o.rate) src.playbackRate.value = o.rate;
    var nodes = [src];
    var end = chain(G, src, nodes, t, o, out);
    noiseOff = (noiseOff + 0.2371) % 0.9;
    src.start(t, own ? 0 : noiseOff);
    src.stop(own ? Math.min(end + 0.03, t + o.buf.duration / (o.rate || 1) + 0.01) : end + 0.03);
    track(G, src, nodes);
    return end;
  }

  // Campanita: fundamental + parcial brillante
  function bell(G, out, t, f, v, d, pan) {
    tone(G, out, t, { type: 'sine', f: f, a: 0.002, d: d, v: v, pan: pan });
    tone(G, out, t, { type: 'sine', f: f * 2.01, a: 0.001, d: d * 0.45, v: v * 0.3, pan: pan });
    tone(G, out, t, { type: 'triangle', f: f * 0.5, a: 0.003, d: d * 0.6, v: v * 0.25, pan: pan });
  }

  // Tintineo de cristal: parciales inarmónicos escalonados
  function tinkle(G, out, t, freqs, step, v, d) {
    for (var i = 0; i < freqs.length; i++) {
      var pan = (i % 2 ? 0.35 : -0.35) * (i % 3 ? 1 : 0.5);
      tone(G, out, t + i * step, { type: 'sine', f: freqs[i], a: 0.001, d: d, v: v, pan: pan });
      tone(G, out, t + i * step, { type: 'sine', f: freqs[i] * 2.76, a: 0.001, d: d * 0.4, v: v * 0.25, pan: -pan });
    }
  }

  function sparkleNoise(G, out, t, v, d) {
    noise(G, out, t, { filt: { type: 'highpass', f: 6500, q: 0.5 }, a: 0.01, d: d, v: v });
  }

  // Baja la música un momento para que se escuchen los jingles
  function duck(G, t, dur) {
    if (G.offline || !music) return;
    var p = G.music.gain;
    try {
      p.cancelScheduledValues(t);
      p.setTargetAtTime(MUSIC_VOL * 0.25, t, 0.04);
      p.setTargetAtTime(MUSIC_VOL, t + dur, 0.35);
    } catch (e) { /* nada */ }
  }

  /* ---------- Recetas de sonidos ---------- */

  var PENTA = [0, 2, 4, 7, 9];
  function penta(base, idx) { return base + 12 * Math.floor(idx / 5) + PENTA[idx % 5]; }

  var BLIP_BASE = { cocardo: 300, cereza: 640, lima: 540, pina: 580, banana: 480, fresa: 610, durazna: 560,
    uva: 450, naranja: 520 };
  var BLIP_STEPS = [0, 2, -1, 3, 1, -2, 2, 0, 4, 1];

  // Ajuste fino de volumen por sonido (equilibrio medido con render sin conexión)
  var LEVEL = {
    tap: 1.33, swap: 1.26, invalid: 0.65, match: 1.17, special: 2.75, paleta: 3.35, bomba: 0.62, copa: 2.45,
    ice: 1.7, frost: 1.97, rescue: 2.3, tick: 1.16, laugh: 0.9, win: 1.25, star: 1.36, lose: 1.9, drama: 2.1,
    blip: 1.25, villain: 1.33, shuffle: 1.36, booster: 2.1,
  };

  var S = {};

  // Toque de UI: "plip" de burbuja
  S.tap = function (G, out, t) {
    tone(G, out, t, { type: 'sine', f: 520, f2: 1150, glide: 0.035, a: 0.002, d: 0.06, v: 0.16 });
    tone(G, out, t, { type: 'triangle', f: 1700, a: 0.001, d: 0.025, v: 0.025 });
  };

  // Intercambio: soplido corto
  S.swap = function (G, out, t) {
    noise(G, out, t, { filt: { type: 'bandpass', f: 600, f2: 2800, glide: 0.13, q: 1.4 }, a: 0.035, d: 0.11, v: 0.32 });
    tone(G, out, t, { type: 'sine', f: 330, f2: 560, glide: 0.11, a: 0.02, d: 0.09, v: 0.05 });
  };

  // Inválido: "boing" de resorte
  S.invalid = function (G, out, t) {
    tone(G, out, t, { type: 'triangle', f: 340, fs: [[0.05, 250], [0.28, 165]], a: 0.003, d: 0.28, v: 0.24,
      vib: { rate: 17, cents: 160, to: 15 }, filt: { type: 'lowpass', f: 1800 } });
    tone(G, out, t, { type: 'sine', f: 170, f2: 95, glide: 0.07, a: 0.002, d: 0.07, v: 0.16 });
  };

  // Match: pop en escala pentatónica que sube con la cascada
  S.match = function (G, out, t, o) {
    var c = int(o.cascade, 1, 1, 10);
    var f = mtof(penta(60, c + 3));            // c1 = La4 ... c10 = Sol6
    tone(G, out, t, { type: 'sine', f: f * 0.5, f2: f * 1.5, glide: 0.05, a: 0.002, d: 0.06, v: 0.12 });
    tone(G, out, t, { type: 'triangle', f: f * 0.8, fs: [[0.025, f]], a: 0.003, d: 0.24, v: 0.2 });
    tone(G, out, t, { type: 'sine', f: f * 2, a: 0.002, d: 0.09, v: 0.06 });
    noise(G, out, t, { filt: { type: 'highpass', f: 3500 }, a: 0.001, d: 0.014, v: 0.07 });
    if (c >= 3) tone(G, out, t + 0.035, { type: 'triangle', f: f * 1.5, a: 0.003, d: 0.18, v: 0.06, pan: 0.3 });
    if (c >= 5) {
      tone(G, out, t + 0.07, { type: 'sine', f: f * 2, a: 0.004, d: 0.26, v: 0.06, pan: -0.3,
        vib: { rate: 7, cents: 15 } });
      sparkleNoise(G, out, t + 0.03, 0.025, 0.18);
    }
  };

  // Especial creado: destello arpegiado
  S.special = function (G, out, t) {
    tone(G, out, t, { type: 'sine', f: 420, f2: 980, glide: 0.08, a: 0.003, d: 0.08, v: 0.1 });
    var notes = [84, 88, 91, 96];
    for (var i = 0; i < notes.length; i++) {
      var pan = [-0.3, 0.3, -0.15, 0.15][i];
      tone(G, out, t + 0.03 + i * 0.035, { type: 'triangle', f: mtof(notes[i]), a: 0.002, d: 0.16, v: 0.09, pan: pan });
      tone(G, out, t + 0.03 + i * 0.035, { type: 'sine', f: mtof(notes[i]) * 2, a: 0.002, d: 0.07, v: 0.025, pan: -pan });
    }
    sparkleNoise(G, out, t + 0.04, 0.035, 0.22);
  };

  // Paleta: barrido de ruido filtrado + zap
  S.paleta = function (G, out, t) {
    noise(G, out, t, { filt: { type: 'bandpass', f: 500, f2: 7000, glide: 0.24, q: 2.2 }, a: 0.01, d: 0.28, v: 0.45 });
    tone(G, out, t, { type: 'sawtooth', f: 1600, f2: 220, glide: 0.22, a: 0.003, d: 0.24, v: 0.06,
      filt: { type: 'lowpass', f: 3200 } });
    tone(G, out, t, { type: 'sine', f: 880, f2: 1760, glide: 0.06, a: 0.002, d: 0.1, v: 0.07 });
  };

  // Bomba: seno grave + ráfaga de ruido
  S.bomba = function (G, out, t) {
    tone(G, out, t, { type: 'sine', f: 150, f2: 42, glide: 0.34, a: 0.003, d: 0.42, v: 0.6 });
    tone(G, out, t, { type: 'triangle', f: 230, f2: 80, glide: 0.2, a: 0.002, d: 0.22, v: 0.22 });
    noise(G, out, t, { filt: { type: 'lowpass', f: 2600, f2: 160, glide: 0.3 }, a: 0.002, d: 0.34, v: 0.42 });
    noise(G, out, t, { filt: { type: 'highpass', f: 1500 }, a: 0.001, d: 0.03, v: 0.12 });
  };

  // Copa: arpegio arcoíris + brillo final
  S.copa = function (G, out, t) {
    var notes = [72, 74, 76, 79, 81, 84, 86, 88, 91];
    for (var i = 0; i < notes.length; i++) {
      var pan = ((i % 3) - 1) * 0.4;
      tone(G, out, t + i * 0.03, { type: 'triangle', f: mtof(notes[i]), a: 0.002, d: 0.17, v: 0.1, pan: pan });
      tone(G, out, t + i * 0.03, { type: 'sine', f: mtof(notes[i]) * 2, a: 0.002, d: 0.06, v: 0.025, pan: -pan });
    }
    noise(G, out, t, { filt: { type: 'bandpass', f: 900, f2: 6000, glide: 0.28, q: 1.5 }, a: 0.05, d: 0.25, v: 0.1 });
    var shine = [84, 88, 91, 96];
    for (var k = 0; k < shine.length; k++) {
      tone(G, out, t + 0.28, { type: 'sine', f: mtof(shine[k]), a: 0.01, d: 0.4, v: 0.05, pan: (k - 1.5) * 0.25,
        vib: { rate: 6.5, cents: 12, delay: 0.1 } });
    }
    sparkleNoise(G, out, t + 0.26, 0.04, 0.35);
  };

  // Combo: gran acorde
  S.combo = function (G, out, t) {
    var chord = [48, 55, 60, 64, 67, 72, 76];
    for (var i = 0; i < chord.length; i++) {
      var pan = (i - 3) * 0.12;
      for (var dv = -1; dv <= 1; dv += 2) {
        tone(G, out, t, { type: 'sawtooth', f: mtof(chord[i]), det: dv * 9, a: 0.008, d: 0.22, s: 0.35, hold: 0.35,
          r: 0.32, v: 0.04, pan: pan + dv * 0.15, filt: { type: 'lowpass', f: 500, fs: [[0.06, 4200], [0.6, 1200]] } });
      }
    }
    tone(G, out, t, { type: 'sine', f: 130, f2: 40, glide: 0.35, a: 0.002, d: 0.4, v: 0.45 });
    noise(G, out, t, { filt: { type: 'lowpass', f: 4500, f2: 300, glide: 0.25 }, a: 0.002, d: 0.26, v: 0.26 });
    var top = [84, 88, 91, 96];
    for (var k = 0; k < top.length; k++) {
      tone(G, out, t + 0.08 + k * 0.04, { type: 'triangle', f: mtof(top[k]), a: 0.002, d: 0.2, v: 0.06,
        pan: k % 2 ? 0.35 : -0.35 });
    }
    sparkleNoise(G, out, t + 0.1, 0.04, 0.4);
  };

  // Hielo: chasquido filtrado según HP restante (0 = se rompe)
  S.ice = function (G, out, t, o) {
    var hp = o.hp == null ? 1 : int(o.hp, 1, 0, 3);
    var f = [3400, 2600, 1900, 1400][hp];
    noise(G, out, t, { filt: { type: 'bandpass', f: f, q: 5 }, a: 0.001, d: 0.05, v: 0.5 });
    noise(G, out, t + 0.022, { filt: { type: 'bandpass', f: f * 1.3, q: 5 }, a: 0.001, d: 0.03, v: 0.28 });
    tone(G, out, t, { type: 'sine', f: f * 0.5, f2: f * 0.33, glide: 0.04, a: 0.001, d: 0.045, v: 0.12 });
    if (hp === 0) {
      noise(G, out, t + 0.01, { filt: { type: 'highpass', f: 2500 }, a: 0.002, d: 0.2, v: 0.14 });
      tinkle(G, out, t + 0.03, [2960, 3520, 2490, 4186], 0.028, 0.05, 0.14);
    }
  };

  // Escarcha rota: tintineo vidrioso
  S.frost = function (G, out, t) {
    noise(G, out, t, { filt: { type: 'highpass', f: 5000 }, a: 0.001, d: 0.07, v: 0.08 });
    tinkle(G, out, t, [mtof(88), mtof(95), mtof(91), mtof(100)], 0.03, 0.07, 0.18);
  };

  // Caja: golpe de madera "toc-toc"
  function knock(G, out, t, k, v) {
    tone(G, out, t, { type: 'triangle', f: 270 * k, fs: [[0.05, 150 * k]], a: 0.001, d: 0.07, v: 0.32 * v });
    noise(G, out, t, { filt: { type: 'bandpass', f: 900 * k, q: 3 }, a: 0.001, d: 0.04, v: 0.3 * v });
    tone(G, out, t, { type: 'sine', f: 560 * k, a: 0.001, d: 0.03, v: 0.06 * v });
  }
  S.crate = function (G, out, t) {
    knock(G, out, t, 1, 1);
    knock(G, out, t + 0.085, 0.85, 0.7);
  };

  // Fanfarria de rescate
  function brass(G, out, t, m, dur, v, vib) {
    for (var dv = -1; dv <= 1; dv += 2) {
      tone(G, out, t, { type: 'sawtooth', f: mtof(m), det: dv * 7, a: 0.012, d: 0.07, s: 0.65, hold: dur, r: 0.09,
        v: v, pan: dv * 0.2, filt: { type: 'lowpass', f: 900, fs: [[0.04, 3200], [dur + 0.05, 1600]] },
        vib: vib ? { rate: 5.5, cents: 14, delay: 0.15 } : null });
    }
  }
  S.rescue = function (G, out, t) {
    duck(G, t, 1.0);
    brass(G, out, t, 67, 0.07, 0.045);
    brass(G, out, t + 0.09, 72, 0.07, 0.045);
    brass(G, out, t + 0.18, 76, 0.07, 0.045);
    brass(G, out, t + 0.27, 79, 0.42, 0.05, true);
    brass(G, out, t + 0.27, 72, 0.42, 0.03, false);
    tone(G, out, t + 0.27, { type: 'triangle', f: mtof(48), a: 0.01, d: 0.4, v: 0.14 });
    tinkle(G, out, t + 0.3, [mtof(96), mtof(100), mtof(103)], 0.05, 0.035, 0.25);
    sparkleNoise(G, out, t + 0.27, 0.035, 0.4);
  };

  // Ficha recogida: campanita tipo moneda
  S.token = function (G, out, t) {
    bell(G, out, t, mtof(83), 0.12, 0.08);
    bell(G, out, t + 0.07, mtof(88), 0.14, 0.35);
    tone(G, out, t + 0.07, { type: 'square', f: mtof(88), a: 0.002, d: 0.12, v: 0.02, filt: { type: 'lowpass', f: 3000 } });
  };

  // Tic de cuenta regresiva (bloque de madera)
  S.tick = function (G, out, t) {
    tone(G, out, t, { type: 'sine', f: 1800, f2: 1250, glide: 0.02, a: 0.001, d: 0.05, v: 0.2 });
    tone(G, out, t, { type: 'sine', f: 900, a: 0.001, d: 0.06, v: 0.07 });
    noise(G, out, t, { filt: { type: 'bandpass', f: 2500, q: 4 }, a: 0.001, d: 0.02, v: 0.18 });
  };

  // Risa de villano: Cocardo «ja-ja-ja» (cuadrada, grave) / Cereza «ji-ji-ji» (aguda)
  S.laugh = function (G, out, t, o) {
    var i;
    if (o.who === 'cereza') {
      var fc = [622, 698, 740, 698, 659];
      for (i = 0; i < fc.length; i++) {
        var tc = t + i * 0.095;
        noise(G, out, tc, { filt: { type: 'bandpass', f: 3200, q: 1.5 }, a: 0.003, d: 0.025, v: 0.1 });
        tone(G, out, tc + 0.012, { type: 'triangle', f: fc[i] * 0.9, fs: [[0.025, fc[i]]], a: 0.006, d: 0.025, s: 0.7,
          hold: 0.05, r: 0.025, v: 0.24, vib: { rate: 10, cents: 25 } });
        tone(G, out, tc + 0.012, { type: 'square', f: fc[i] * 0.9, fs: [[0.025, fc[i]]], a: 0.006, d: 0.025, s: 0.6,
          hold: 0.05, r: 0.025, v: 0.07, filt: { type: 'bandpass', f: 2400, q: 2 } });
      }
      return;
    }
    var fk = [233, 220, 208, 196];
    for (i = 0; i < fk.length; i++) {
      var tk = t + i * 0.14;
      noise(G, out, tk, { filt: { type: 'bandpass', f: 1600, q: 1.2 }, a: 0.004, d: 0.035, v: 0.12 });
      tone(G, out, tk + 0.02, { type: 'square', f: fk[i] * 1.12, fs: [[0.035, fk[i]]], a: 0.008, d: 0.04, s: 0.7,
        hold: 0.085, r: 0.04, v: 0.08, filt: { type: 'lowpass', f: 1300, q: 7 } });
      tone(G, out, tk + 0.02, { type: 'sine', f: fk[i] * 1.12, fs: [[0.035, fk[i]]], a: 0.008, d: 0.04, s: 0.7,
        hold: 0.085, r: 0.04, v: 0.1 });
    }
  };

  // Golpe al Congelador: "thunk" metálico
  S.freezerHit = function (G, out, t) {
    tone(G, out, t, { type: 'sine', f: 115, f2: 52, glide: 0.13, a: 0.002, d: 0.2, v: 0.5 });
    tone(G, out, t, { type: 'triangle', f: 230, f2: 120, glide: 0.1, a: 0.002, d: 0.12, v: 0.15 });
    noise(G, out, t, { filt: { type: 'lowpass', f: 900, f2: 200, glide: 0.1 }, a: 0.001, d: 0.11, v: 0.3 });
    tone(G, out, t, { type: 'triangle', f: 331, a: 0.001, d: 0.1, v: 0.05 });
    tone(G, out, t, { type: 'triangle', f: 467, a: 0.001, d: 0.08, v: 0.04 });
    noise(G, out, t, { filt: { type: 'bandpass', f: 3600, q: 5 }, a: 0.001, d: 0.03, v: 0.14 });
  };

  // Latido suave doble (con armónicos para que se oiga en teléfonos)
  S.heartbeat = function (G, out, t) {
    var beats = [[0, 1], [0.17, 0.7]];
    for (var i = 0; i < beats.length; i++) {
      var tb = t + beats[i][0], k = beats[i][1];
      tone(G, out, tb, { type: 'sine', f: 78, f2: 46, glide: 0.1, a: 0.006, d: 0.14, v: 0.32 * k });
      tone(G, out, tb, { type: 'triangle', f: 125, f2: 82, glide: 0.08, a: 0.005, d: 0.09, v: 0.1 * k,
        filt: { type: 'lowpass', f: 400 } });
      noise(G, out, tb, { filt: { type: 'lowpass', f: 180 }, a: 0.003, d: 0.06, v: 0.12 * k });
    }
  };

  // Jingle de victoria
  function lead(G, out, t, m, dur, v, vib) {
    tone(G, out, t, { type: 'square', f: mtof(m), a: 0.006, d: 0.06, s: 0.6, hold: dur, r: 0.08, v: v * 0.5,
      filt: { type: 'lowpass', f: 2600 }, vib: vib ? { rate: 6, cents: 14, delay: 0.12 } : null });
    tone(G, out, t, { type: 'triangle', f: mtof(m), a: 0.006, d: 0.06, s: 0.6, hold: dur, r: 0.1, v: v,
      vib: vib ? { rate: 6, cents: 14, delay: 0.12 } : null });
  }
  S.win = function (G, out, t) {
    duck(G, t, 1.6);
    var mel = [[72, 0, 0.08], [76, 0.09, 0.08], [79, 0.18, 0.08], [84, 0.27, 0.16], [79, 0.45, 0.08], [84, 0.54, 0.55]];
    for (var i = 0; i < mel.length; i++) lead(G, out, t + mel[i][1], mel[i][0], mel[i][2], 0.13, i === mel.length - 1);
    var bass = [[48, 0], [55, 0.27], [48, 0.54]];
    for (var b = 0; b < bass.length; b++) {
      tone(G, out, t + bass[b][1], { type: 'triangle', f: mtof(bass[b][0]), a: 0.005, d: 0.25, v: 0.16 });
    }
    var ch = [72, 76, 79];
    for (var k = 0; k < ch.length; k++) {
      tone(G, out, t + 0.54, { type: 'triangle', f: mtof(ch[k]), a: 0.02, d: 0.2, s: 0.5, hold: 0.5, r: 0.25,
        v: 0.05, pan: (k - 1) * 0.35 });
    }
    tinkle(G, out, t + 0.6, [mtof(96), mtof(100), mtof(103), mtof(108)], 0.05, 0.035, 0.25);
    sparkleNoise(G, out, t + 0.55, 0.04, 0.5);
  };

  // Estrellas: dings ascendentes (i = 0..2)
  S.star = function (G, out, t, o) {
    var i = int(o.i, 0, 0, 2);
    var f = mtof([84, 88, 91][i]);
    bell(G, out, t, f, 0.18, 0.55, [-0.25, 0, 0.25][i]);
    sparkleNoise(G, out, t, 0.035, 0.12);
    if (i === 2) {
      tone(G, out, t + 0.02, { type: 'sine', f: f * 1.5, a: 0.003, d: 0.4, v: 0.05 });
      tinkle(G, out, t + 0.08, [mtof(96), mtof(100), mtof(103)], 0.04, 0.03, 0.22);
    }
  };

  // Derrota: trombón triste descendente
  S.lose = function (G, out, t) {
    duck(G, t, 1.6);
    var notes = [[58, 0, 0.17], [57, 0.22, 0.17], [56, 0.44, 0.17], [55, 0.66, 0.6]];
    for (var i = 0; i < notes.length; i++) {
      var m = notes[i][0], tn = t + notes[i][1], dur = notes[i][2];
      var longN = i === notes.length - 1;
      for (var dv = -1; dv <= 1; dv += 2) {
        tone(G, out, tn, { type: 'sawtooth', f: mtof(m), fs: longN ? [[dur, mtof(m - 0.6)]] : null, det: dv * 6,
          a: 0.03, d: 0.08, s: 0.75, hold: dur, r: 0.1, v: 0.08, pan: dv * 0.15,
          filt: { type: 'lowpass', f: 380, fs: [[0.08, 1400], [dur, 650]], q: 3 },
          vib: longN ? { rate: 5, cents: 45, delay: 0.25 } : null });
      }
    }
  };

  // «tan-tan-TAAAN» de telenovela: Mi menor, Mi menor, Do menor con trémolo y vibrato
  function stab(G, out, t, chord, bassM, hold, big) {
    for (var i = 0; i < chord.length; i++) {
      var pan = (i - (chord.length - 1) / 2) * 0.18;
      for (var dv = -1; dv <= 1; dv += 2) {
        tone(G, out, t, { type: 'sawtooth', f: mtof(chord[i]), det: dv * 10, a: big ? 0.02 : 0.008, d: 0.12,
          s: big ? 0.6 : 0.35, hold: hold, r: big ? 0.55 : 0.12, v: 0.035, pan: pan + dv * 0.12,
          filt: { type: 'lowpass', f: big ? 900 : 1200, fs: big ? [[0.08, 2600], [hold, 1500]] : [[0.03, 2600], [0.2, 1100]] },
          trem: big ? { rate: 7, depth: 0.45 } : null,
          vib: big ? { rate: 5.5, cents: 12, delay: 0.3 } : null });
      }
    }
    // timbal
    tone(G, out, t, { type: 'sine', f: mtof(bassM), f2: mtof(bassM) * 0.92, glide: 0.3, a: 0.004, d: big ? 0.9 : 0.3,
      v: big ? 0.26 : 0.2 });
    tone(G, out, t, { type: 'triangle', f: mtof(bassM + 12), a: 0.004, d: big ? 0.5 : 0.2, v: 0.12 });
    noise(G, out, t, { filt: { type: 'lowpass', f: 500 }, a: 0.002, d: 0.08, v: 0.14 });
    if (big) {
      noise(G, out, t + 0.05, { filt: { type: 'lowpass', f: 260 }, a: 0.3, d: 0.2, s: 0.8, hold: hold, r: 0.5, v: 0.12,
        trem: { rate: 16, depth: 0.7 } });
    }
  }
  S.drama = function (G, out, t) {
    duck(G, t, 2.2);
    stab(G, out, t, [52, 55, 59, 64], 40, 0.14, false);
    stab(G, out, t + 0.27, [52, 55, 59, 64], 40, 0.14, false);
    stab(G, out, t + 0.56, [48, 51, 55, 60, 63], 36, 1.15, true);
  };

  // Blip de diálogo: sutil, variación de tono por contador
  S.blip = function (G, out, t, o) {
    var base = BLIP_BASE[o.who] || 540;
    var f = base * Math.pow(2, BLIP_STEPS[blipN++ % BLIP_STEPS.length] / 12);
    tone(G, out, t, { type: 'triangle', f: f, a: 0.004, d: 0.045, v: 0.08 });
    tone(G, out, t, { type: 'square', f: f, a: 0.004, d: 0.03, v: 0.02, filt: { type: 'lowpass', f: 1500 } });
  };

  // Villano actúa: motivo cromático "sigiloso" + soplido helado
  S.villain = function (G, out, t) {
    var notes = [62, 61, 60, 59];
    for (var i = 0; i < notes.length; i++) {
      tone(G, out, t + i * 0.07, { type: 'square', f: mtof(notes[i]), a: 0.004, d: 0.06, v: 0.06,
        filt: { type: 'lowpass', f: 1300 } });
      tone(G, out, t + i * 0.07, { type: 'triangle', f: mtof(notes[i]), a: 0.004, d: 0.06, v: 0.09 });
    }
    tone(G, out, t + 0.28, { type: 'triangle', f: mtof(50), a: 0.01, d: 0.06, s: 0.6, hold: 0.16, r: 0.12, v: 0.15,
      vib: { rate: 6, cents: 30 } });
    noise(G, out, t + 0.05, { filt: { type: 'bandpass', f: 3500, f2: 700, glide: 0.4, q: 1.6 }, a: 0.08, d: 0.35, v: 0.12 });
  };

  // Mezclar tablero: remolino + "barajado"
  S.shuffle = function (G, out, t) {
    tone(G, out, t, { type: 'sine', f: 300, f2: 1100, glide: 0.36, a: 0.03, d: 0.36, v: 0.1, vib: { rate: 14, cents: 70 } });
    for (var i = 0; i < 8; i++) {
      noise(G, out, t + i * 0.042, { filt: { type: 'bandpass', f: 1200 + i * 300, q: 3 }, a: 0.001, d: 0.022, v: 0.22,
        pan: i % 2 ? 0.3 : -0.3 });
    }
  };

  // Potenciador: subida de energía + acorde brillante
  S.booster = function (G, out, t) {
    tone(G, out, t, { type: 'square', f: 220, f2: 880, glide: 0.22, a: 0.01, d: 0.22, v: 0.05, filt: { type: 'lowpass', f: 2000 } });
    tone(G, out, t, { type: 'triangle', f: 440, f2: 1760, glide: 0.22, a: 0.01, d: 0.22, v: 0.08 });
    noise(G, out, t, { filt: { type: 'highpass', f: 2000 }, a: 0.12, d: 0.1, v: 0.06 });
    var ch = [84, 88, 91];
    for (var k = 0; k < ch.length; k++) {
      tone(G, out, t + 0.22, { type: 'sine', f: mtof(ch[k]), a: 0.004, d: 0.28, v: 0.07, pan: (k - 1) * 0.3 });
    }
    sparkleNoise(G, out, t + 0.22, 0.035, 0.2);
  };

  /* ---------- Música (P2): bucle cumbia-pop de 8 compases ---------- */

  var BPM = 104;
  var STEP = 60 / BPM / 4;     // semicorchea
  var LOOP = 128;              // 8 compases x 16
  var CHORDS = { C: [60, 64, 67], G: [59, 62, 67], Am: [57, 60, 64], F: [57, 60, 65] };
  var HALVES = ['C', 'C', 'G', 'G', 'Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G', 'F', 'G', 'C', 'C'];
  var BASS = [48, 43, 43, 50, 45, 52, 41, 48, 48, 43, 43, 50, 41, 43, 48, 43];   // raíz en 1, quinta en 3
  var MELODY = [
    [[0, 76, 3], [3, 79, 3], [6, 84, 2], [8, 81, 2], [10, 79, 2], [12, 76, 4]],
    [[0, 74, 3], [3, 79, 3], [6, 83, 2], [8, 81, 2], [10, 79, 2], [12, 74, 4]],
    [[0, 72, 3], [3, 76, 3], [6, 81, 2], [8, 79, 2], [10, 76, 2], [12, 72, 4]],
    [[0, 77, 2], [2, 81, 2], [4, 84, 2], [6, 81, 2], [8, 79, 3], [11, 77, 1], [12, 76, 2], [14, 74, 2]],
    [[0, 76, 3], [3, 79, 3], [6, 84, 2], [8, 86, 2], [10, 84, 2], [12, 79, 4]],
    [[0, 74, 3], [3, 79, 3], [6, 83, 2], [8, 86, 3], [11, 84, 1], [12, 83, 2], [14, 81, 2]],
    [[0, 81, 2], [2, 77, 2], [4, 81, 2], [6, 84, 2], [8, 83, 2], [10, 79, 2], [12, 83, 2], [14, 86, 2]],
    [[0, 84, 4], [4, 79, 2], [6, 76, 2], [8, 72, 4]],
  ];
  var MEL_AT = {};
  (function () {
    for (var b = 0; b < MELODY.length; b++) {
      for (var i = 0; i < MELODY[b].length; i++) MEL_AT[b * 16 + MELODY[b][i][0]] = MELODY[b][i];
    }
  })();

  function scheduleStep(G, out, step, t) {
    var s = step % 16;
    var half = Math.floor(step / 8) % 16;
    // güiro: «chaa-chi-ki» en cada tiempo
    var q = s % 4;
    if (q === 0) noise(G, out, t, { buf: G.guiroL, filt: { type: 'highpass', f: 2500 }, a: 0.002, d: 0.14, v: 0.16 });
    else if (q >= 2) noise(G, out, t, { buf: G.guiroS, filt: { type: 'highpass', f: 2500 }, a: 0.001, d: 0.045, v: q === 2 ? 0.1 : 0.07 });
    // bajo en 1 y 3 (+ bombo suave)
    if (s === 0 || s === 8) {
      var bm = BASS[half];
      tone(G, out, t, { type: 'triangle', f: mtof(bm), a: 0.006, d: 0.34, v: 0.24, filt: { type: 'lowpass', f: 900 } });
      tone(G, out, t, { type: 'sine', f: mtof(bm), a: 0.006, d: 0.3, v: 0.18 });
      tone(G, out, t, { type: 'sine', f: 120, f2: 48, glide: 0.12, a: 0.003, d: 0.14, v: 0.16 });
    }
    // conga (tumbao) en el «y» del 2 y del 4
    if (s === 6 || s === 14) tone(G, out, t, { type: 'sine', f: 330, f2: 280, glide: 0.08, a: 0.002, d: 0.11, v: 0.09, pan: 0.3 });
    if (s === 7 || s === 15) tone(G, out, t, { type: 'sine', f: 240, f2: 205, glide: 0.08, a: 0.002, d: 0.13, v: 0.09, pan: 0.3 });
    // acorde a contratiempo («chuc»)
    if (s % 4 === 2) {
      var ch = CHORDS[HALVES[half]];
      for (var k = 0; k < ch.length; k++) {
        tone(G, out, t, { type: 'triangle', f: mtof(ch[k]), a: 0.003, d: 0.08, v: 0.035, pan: -0.25 + k * 0.08 });
      }
    }
    // melodía (acordeón brillante)
    var n = MEL_AT[step % LOOP];
    if (n) {
      var dur = n[2] * STEP * 0.85;
      var long = n[2] >= 4;
      for (var dv = -1; dv <= 1; dv += 2) {
        tone(G, out, t, { type: dv < 0 ? 'square' : 'sawtooth', f: mtof(n[1]), det: dv * 6, a: 0.01, d: 0.06, s: 0.55,
          hold: dur, r: 0.06, v: 0.032, pan: dv * 0.12, filt: { type: 'lowpass', f: 2600 },
          vib: long ? { rate: 5.5, cents: 10, delay: 0.15 } : null });
      }
    }
  }

  function musicTick() {
    try {
      if (!music || !live) return;
      var ctx = live.ctx;
      if (ctx.state !== 'running') return;
      var now = ctx.currentTime;
      if (music.next < now - 0.2) music.next = now + 0.05;    // se recupera tras una pausa larga
      while (music.next < now + 0.15) {
        if (!muted) scheduleStep(live, music.bus, music.step, music.next);
        music.step = (music.step + 1) % LOOP;
        music.next += STEP;
      }
    } catch (e) { /* nunca romper */ }
  }

  function startMusic() {
    if (!live || music || !root || !root.setInterval) return;
    var ctx = live.ctx;
    var bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.4);
    bus.connect(live.music);
    music = { bus: bus, step: 0, next: ctx.currentTime + 0.08, timer: 0 };
    music.timer = root.setInterval(musicTick, 25);
    musicTick();
  }

  function stopMusic() {
    if (!music) return;
    var m = music;
    music = null;
    try { root.clearInterval(m.timer); } catch (e) { /* nada */ }
    try {
      var ctx = live.ctx;
      m.bus.gain.cancelScheduledValues(ctx.currentTime);
      m.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
      live.music.gain.cancelScheduledValues(ctx.currentTime);
      live.music.gain.setValueAtTime(MUSIC_VOL, ctx.currentTime);
    } catch (e) { /* nada */ }
    root.setTimeout(function () { try { m.bus.disconnect(); } catch (e) { /* nada */ } }, 700);
  }

  /* ---------- Contexto, desbloqueo y visibilidad ---------- */

  function resume() {
    try {
      var ctx = live && live.ctx;
      if (!ctx || ctx.state === 'running' || ctx.state === 'closed' || !ctx.resume) return;
      var p = ctx.resume();
      if (p && p.then) p.then(noop, noop);
    } catch (e) { /* nada */ }
  }

  // iOS: un búfer silencioso dentro del gesto termina de "abrir" el audio
  function prime() {
    try {
      var ctx = live.ctx;
      var src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.onended = function () { try { src.disconnect(); } catch (e) { /* nada */ } };
      src.start(0);
    } catch (e) { /* nada */ }
  }

  function hidden() { return typeof document !== 'undefined' && !!document.hidden; }

  function onVisibility() {
    try {
      if (!live) return;
      var ctx = live.ctx;
      if (hidden()) {
        if (ctx.state === 'running' && ctx.suspend) {
          autoSuspended = true;
          var p = ctx.suspend();
          if (p && p.then) p.then(noop, noop);
        }
      } else if (autoSuspended) {
        autoSuspended = false;
        resume();
      }
    } catch (e) { /* nada */ }
  }

  function onGesture() {
    if (live && live.ctx.state !== 'running' && !hidden()) { resume(); prime(); }
  }

  function listen() {
    if (listening || !root || !root.addEventListener) return;
    listening = true;
    try {
      var opt = { capture: true, passive: true };
      root.addEventListener('pointerdown', onGesture, opt);
      root.addEventListener('touchend', onGesture, opt);
      root.addEventListener('keydown', onGesture, opt);
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', onVisibility);
      }
    } catch (e) { /* nada */ }
  }

  function unlock() {
    try {
      if (!root) return false;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) { unsupported = true; return false; }
      if (live && live.ctx.state === 'closed') { stopMusic(); live = null; last = {}; }
      if (!live) {
        var ctx;
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
        live = buildGraph(ctx, false);
        listen();
        prime();
      }
      unlockAt = nowMs();
      if (live.ctx.state !== 'running') { resume(); prime(); }
      if (musicOn && !music) startMusic();
      return true;
    } catch (e) {
      return false;
    }
  }

  function play(name, opts) {
    try {
      if (muted || !live || !S[name]) return;
      var ctx = live.ctx;
      if (ctx.state !== 'running') {
        // justo tras unlock() el contexto puede tardar en arrancar: se permite programar
        if (ctx.state === 'closed' || nowMs() - unlockAt > 600) return;
      }
      opts = opts || {};
      var key = name === 'star' ? 'star' + (opts.i | 0) : name;
      var now = ctx.currentTime;
      var prev = last[key];
      if (prev != null && now - prev < THROTTLE && now >= prev) return;
      if (voices > MAX_VOICES) return;
      last[key] = now;
      live.k = LEVEL[name] || 1;
      try { S[name](live, live.sfx, now + LEAD, opts); } finally { live.k = 1; }
    } catch (e) { /* el audio nunca rompe el juego */ }
  }

  function setMuted(b) {
    muted = !!b;
    try {
      if (live) {
        var ctx = live.ctx;
        var p = live.master.gain;
        p.cancelScheduledValues(ctx.currentTime);
        p.setTargetAtTime(muted ? 0 : MASTER_VOL, ctx.currentTime, 0.03);
      }
    } catch (e) { /* nada */ }
  }

  function setMusic(b) {
    musicOn = !!b;
    try {
      if (musicOn) startMusic();
      else stopMusic();
    } catch (e) { /* nada */ }
  }

  /* ---------- Herramientas de desarrollo (render sin conexión) ---------- */

  function offlineCtx(secs) {
    var OAC = root && (root.OfflineAudioContext || root.webkitOfflineAudioContext);
    if (!OAC) return null;
    var sr = 44100;
    return new OAC(2, Math.ceil(sr * secs), sr);
  }

  // El compresor recién creado atenúa sus primeros ~300 ms: se calienta antes de medir
  var WARM = 0.8;

  // Devuelve el render recortado desde WARM (el sonido empieza en ~0 s)
  function trimmed(octx, p) {
    return p.then(function (buf) {
      var from = Math.floor(WARM * buf.sampleRate);
      var out = octx.createBuffer(buf.numberOfChannels, buf.length - from, buf.sampleRate);
      for (var ch = 0; ch < buf.numberOfChannels; ch++) out.getChannelData(ch).set(buf.getChannelData(ch).subarray(from));
      return out;
    });
  }

  // Renderiza un sonido (o una lista [[nombre, opts, segundos], ...]) a un AudioBuffer
  function render(name, opts, secs) {
    try {
      var items = Array.isArray(name) ? name : [[name, opts, 0]];
      var octx = offlineCtx(WARM + (secs || 2.6));
      if (!octx) return Promise.resolve(null);
      var G = buildGraph(octx, true);
      for (var i = 0; i < items.length; i++) {
        var n = items[i][0];
        if (!S[n]) continue;
        G.k = LEVEL[n] || 1;
        S[n](G, G.sfx, WARM + 0.005 + (items[i][2] || 0), items[i][1] || {});
      }
      G.k = 1;
      return trimmed(octx, octx.startRendering());
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function renderMusic(loops) {
    try {
      var n = LOOP * (loops || 1);
      var octx = offlineCtx(WARM + n * STEP + 1);
      if (!octx) return Promise.resolve(null);
      var G = buildGraph(octx, true);
      for (var i = 0; i < n; i++) scheduleStep(G, G.music, i % LOOP, WARM + 0.005 + i * STEP);
      return trimmed(octx, octx.startRendering());
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  var AudioApi = {
    unlock: unlock,
    play: play,
    setMuted: setMuted,
    isMuted: function () { return muted; },
    setMusic: setMusic,
    isMusicOn: function () { return musicOn; },
    names: NAMES.slice(),
    isSupported: function () {
      return !!(root && (root.AudioContext || root.webkitAudioContext)) && !unsupported;
    },
    isUnlocked: function () { return !!live; },
    _render: render,
    _renderMusic: renderMusic,
    _stats: function () {
      return { voices: voices, state: live ? live.ctx.state : 'none', music: !!music, muted: muted };
    },
  };

  Cocardo.Audio = AudioApi;
  if (typeof module !== 'undefined' && module.exports) module.exports = AudioApi;
})();
