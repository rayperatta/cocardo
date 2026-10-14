/* Cocardo: ¡Rescate Helado! — Efectos de partículas y "juice" sobre un canvas superpuesto.
 * Dueño: Board. Contrato: docs/ARQUITECTURA.md §11, jugo: docs/DISENO.md §12.
 * Cocardo.FX.create(canvas) -> fx. Todo se dibuja en coordenadas CSS del canvas (que cubre la pantalla de juego).
 * Sin requestAnimationFrame propio: el bucle de render.js llama a fx.update(dt) y fx.draw(). */
(function () {
  'use strict';
  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  var MAX_PARTICLES = 250;
  var TAU = Math.PI * 2;

  // Color "jugo" de cada sabor (coincide con la paleta de art.js)
  var JUICE = {
    L: ['#8fd63a', '#d8f79a'], F: ['#ff3b55', '#ffb3c0'], B: ['#ffd23c', '#fff3b0'],
    U: ['#9a4ed6', '#d7a8ff'], N: ['#ff8c1f', '#ffd9a6'], D: ['#ff9a6a', '#ffe0c4'],
  };
  var CONFETTI = ['#ff6fa5', '#ffc93c', '#bff3e1', '#4aa8e0', '#a1286a', '#8fd63a', '#ff8c1f', '#ffffff'];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function easeOut(t) { return 1 - (1 - t) * (1 - t); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function create(canvas) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, DPR = 1;
    var reduced = false;
    var pool = [], live = [];
    var beams = [], rings = [], rays = [], texts = [], flyers = [], glows = [], flashes = [];
    var shake = { t: 0, dur: 0, amp: 0, x: 0, y: 0 };
    var dirty = false;   // hay que limpiar el canvas aunque no quede nada vivo

    function resize(w, h, dpr) {
      W = w; H = h; DPR = dpr || 1;
      canvas.width = Math.max(1, Math.round(w * DPR));
      canvas.height = Math.max(1, Math.round(h * DPR));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      dirty = true;
    }

    // ---------- partículas (pool) ----------
    function spawn(o) {
      if (live.length >= MAX_PARTICLES) return null;
      var p = pool.pop() || {};
      p.x = o.x; p.y = o.y; p.vx = o.vx || 0; p.vy = o.vy || 0;
      p.g = o.g === undefined ? 900 : o.g; p.drag = o.drag === undefined ? 1.2 : o.drag;
      p.life = o.life || 600; p.t = 0; p.size = o.size || 6; p.size1 = o.size1 === undefined ? p.size * 0.3 : o.size1;
      p.color = o.color || '#fff'; p.color2 = o.color2 || null; p.rot = o.rot || 0; p.vr = o.vr || 0;
      p.shape = o.shape || 'dot'; p.alpha = o.alpha === undefined ? 1 : o.alpha; p.delay = o.delay || 0;
      p.flip = rand(0, TAU);
      live.push(p);
      return p;
    }
    function n(count) { return reduced ? Math.ceil(count / 2) : count; }

    // Jugo de fruta al reventar una ficha
    function juice(x, y, color, scale) {
      var c = JUICE[color] || ['#ffffff', '#ffe6f0'], s = scale || 1, k = n(9), i, a, sp;
      for (i = 0; i < k; i++) {
        a = rand(0, TAU); sp = rand(120, 320) * s;
        spawn({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140 * s, size: rand(3, 6.5) * s, life: rand(380, 620),
          color: i % 3 ? c[0] : c[1], shape: i % 2 ? 'drop' : 'dot', g: 1100 });
      }
      for (i = 0; i < n(3); i++) {
        a = rand(0, TAU); sp = rand(40, 110) * s;
        spawn({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rand(2.5, 4) * s, life: rand(300, 450), color: '#ffffff', shape: 'star', g: 0, vr: rand(-6, 6) });
      }
    }

    // Esquirlas de hielo
    function shards(x, y, size, opts) {
      opts = opts || {};
      var k = n(opts.count || 10), cols = opts.colors || ['#ffffff', '#d8f2ff', '#9fd6f5', '#bfe9ff'];
      for (var i = 0; i < k; i++) {
        var a = rand(0, TAU), sp = rand(140, 360) * (opts.power || 1);
        spawn({ x: x + rand(-size / 3, size / 3), y: y + rand(-size / 3, size / 3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 160,
          size: rand(size * 0.1, size * 0.22), size1: 1, life: rand(450, 750), color: pick(cols), color2: '#4aa8e0',
          shape: 'shard', rot: rand(0, TAU), vr: rand(-12, 12), g: 1300, drag: 0.6 });
      }
    }

    // Astillas de caja
    function splinters(x, y, size) {
      var k = n(9), cols = ['#e3ac6a', '#b8763a', '#8a5426', '#d29a5a'];
      for (var i = 0; i < k; i++) {
        var a = rand(0, TAU), sp = rand(140, 340);
        spawn({ x: x + rand(-size / 4, size / 4), y: y + rand(-size / 4, size / 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 180,
          size: rand(size * 0.12, size * 0.26), size1: size * 0.08, life: rand(500, 800), color: pick(cols), color2: '#5a3a20',
          shape: 'chunk', rot: rand(0, TAU), vr: rand(-14, 14), g: 1400, drag: 0.5 });
      }
      for (var j = 0; j < n(4); j++) {
        spawn({ x: x, y: y, vx: rand(-60, 60), vy: rand(-80, -20), size: rand(5, 9), size1: 14, life: 500, color: 'rgba(160,120,80,0.35)', shape: 'dot', g: 0, drag: 2 });
      }
    }

    // Destellos (creación de especiales, transformaciones)
    function sparkle(x, y, size, count, color) {
      var k = n(count || 8);
      for (var i = 0; i < k; i++) {
        var a = (i / k) * TAU + rand(-0.2, 0.2), sp = rand(60, 180) * (size / 40);
        spawn({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rand(4, 8) * (size / 40), size1: 0.5, life: rand(420, 650),
          color: color || pick(['#ffffff', '#ffe680', '#ffc93c']), shape: 'star', g: 0, drag: 2.5, vr: rand(-4, 4) });
      }
    }

    function hearts(x, y, count) {
      var k = n(count || 8);
      for (var i = 0; i < k; i++) {
        spawn({ x: x + rand(-20, 20), y: y + rand(-10, 10), vx: rand(-70, 70), vy: rand(-260, -140), size: rand(7, 12), size1: 4,
          life: rand(800, 1200), color: pick(['#ff6fa5', '#ff3b6b', '#ffb3cf']), shape: 'heart', g: 160, drag: 0.8, vr: rand(-2, 2), delay: i * 40 });
      }
    }

    // Copos (escarcha que llega con el rayo del villano)
    function puff(x, y, size, color) {
      var k = n(8);
      for (var i = 0; i < k; i++) {
        var a = rand(0, TAU), sp = rand(30, 120);
        spawn({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rand(size * 0.08, size * 0.16), size1: 1, life: rand(400, 700),
          color: color || '#ffffff', shape: 'flake', rot: rand(0, TAU), vr: rand(-3, 3), g: 0, drag: 2 });
      }
    }

    // Confeti y chispas de colores sobre toda la pantalla
    function confetti(count) {
      var k = n(count || 140);
      for (var i = 0; i < k; i++) {
        var fromLeft = i % 2 === 0;
        var x = fromLeft ? rand(-10, W * 0.15) : rand(W * 0.85, W + 10);
        spawn({ x: x, y: rand(H * 0.25, H * 0.55), vx: (fromLeft ? 1 : -1) * rand(120, 420), vy: rand(-900, -500),
          size: rand(6, 11), size1: 6, life: rand(1800, 2600), color: pick(CONFETTI), shape: i % 5 === 0 ? 'sprinkle' : 'confetti',
          rot: rand(0, TAU), vr: rand(-10, 10), g: 900, drag: 1.4, delay: rand(0, 300) });
      }
    }

    // ---------- formas grandes ----------
    // Rayo de Paleta: una barra brillante que se extiende desde (x,y) a lo largo de una fila o columna
    function beam(x1, y1, x2, y2, width, color, dur, delay) {
      beams.push({ x1: x1, y1: y1, x2: x2, y2: y2, w: width, color: color || '#ffffff', dur: dur || 260, t: -(delay || 0) });
    }
    function ring(x, y, r0, r1, color, dur, delay) {
      rings.push({ x: x, y: y, r0: r0, r1: r1, color: color || '#ffffff', dur: dur || 300, t: -(delay || 0) });
    }
    // Rayo congelante (zigzag) del villano
    function ray(x1, y1, x2, y2, color, dur, delay) {
      var pts = [], segs = 9, i;
      for (i = 0; i <= segs; i++) pts.push(rand(-1, 1));
      rays.push({ x1: x1, y1: y1, x2: x2, y2: y2, color: color || '#7fdcff', dur: dur || 420, t: -(delay || 0), jag: pts });
    }
    function glow(x, y, r, color, dur, delay) {
      glows.push({ x: x, y: y, r: r, color: color || '#fff6a0', dur: dur || 380, t: -(delay || 0) });
    }
    function flash(x, y, w, h, dur, delay, color) {
      flashes.push({ x: x, y: y, w: w, h: h, dur: dur || 160, t: -(delay || 0), color: color || '#ffffff' });
    }
    // Texto flotante (puntos)
    function text(x, y, str, opts) {
      opts = opts || {};
      var size = opts.size || 18, start = -(opts.delay || 0);
      // si ya hay un texto joven en el mismo sitio, el nuevo va debajo (el viejo ya va subiendo)
      for (var guard = 0; guard < 6; guard++) {
        var hit = false;
        for (var i = 0; i < texts.length; i++) {
          var o = texts[i];
          if (Math.abs(o.x - x) < size * 2 && Math.abs(o.y - y) < size * 1.1 && Math.abs(o.t - start) < 400) { hit = true; break; }
        }
        if (!hit) break;
        y += size * 1.15;
      }
      texts.push({ x: x, y: y, s: String(str), size: size, color: opts.color || '#ffffff', stroke: opts.stroke || '#2b1630',
        dur: opts.dur || 760, rise: opts.rise === undefined ? 34 : opts.rise, t: -(opts.delay || 0) });
    }
    // Ícono que vuela en arco hacia un contador (meta)
    function flyer(img, x0, y0, x1, y1, size, dur, delay, onArrive) {
      flyers.push({ img: img, x0: x0, y0: y0, x1: x1, y1: y1, size: size, dur: dur || 520, t: -(delay || 0), cb: onArrive || null,
        bend: rand(-0.35, 0.35) });
    }
    function doShake(amp, dur) {
      if (reduced) return;
      if (amp >= shake.amp || shake.t >= shake.dur) { shake.amp = amp; shake.dur = dur || 220; shake.t = 0; }
    }

    // ---------- actualización ----------
    function update(dtMs) {
      var dt = dtMs / 1000, i, p;
      for (i = live.length - 1; i >= 0; i--) {
        p = live[i];
        if (p.delay > 0) { p.delay -= dtMs; continue; }
        p.t += dtMs;
        if (p.t >= p.life) { live[i] = live[live.length - 1]; live.pop(); pool.push(p); continue; }
        var dr = Math.max(0, 1 - p.drag * dt);
        p.vx *= dr; p.vy = p.vy * dr + p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      function adv(list) {
        for (var k = list.length - 1; k >= 0; k--) {
          var o = list[k];
          o.t += dtMs;
          if (o.t >= o.dur) {
            if (o.cb) { var cb = o.cb; o.cb = null; try { cb(); } catch (e) { /* nada */ } }
            list.splice(k, 1);
          }
        }
      }
      adv(beams); adv(rings); adv(rays); adv(texts); adv(flyers); adv(glows); adv(flashes);
      if (shake.t < shake.dur) {
        shake.t += dtMs;
        var k2 = 1 - clamp(shake.t / shake.dur, 0, 1);
        shake.x = Math.round(rand(-1, 1) * shake.amp * k2);
        shake.y = Math.round(rand(-1, 1) * shake.amp * k2);
      } else { shake.x = 0; shake.y = 0; }
    }

    function alive() {
      return live.length > 0 || beams.length > 0 || rings.length > 0 || rays.length > 0 || texts.length > 0 ||
        flyers.length > 0 || glows.length > 0 || flashes.length > 0 || shake.t < shake.dur;
    }

    // ---------- dibujo ----------
    function drawStar(x, y, r, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.beginPath();
      for (var i = 0; i < 8; i++) {
        var rr = i % 2 ? r * 0.32 : r, a = i * Math.PI / 4;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    function drawHeart(x, y, s, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s / 10, s / 10);
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.bezierCurveTo(-10, -3, -6, -11, 0, -6);
      ctx.bezierCurveTo(6, -11, 10, -3, 0, 4);
      ctx.fill();
      ctx.restore();
    }
    function drawFlake(x, y, s, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.lineWidth = Math.max(1, s * 0.22); ctx.lineCap = 'round';
      ctx.beginPath();
      for (var i = 0; i < 3; i++) {
        var a = i * Math.PI / 3;
        ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s); ctx.lineTo(-Math.cos(a) * s, -Math.sin(a) * s);
      }
      ctx.stroke(); ctx.restore();
    }

    function draw() {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      dirty = false;
      var i, k, o;
      // destellos de fondo
      for (i = 0; i < glows.length; i++) {
        o = glows[i]; if (o.t < 0) continue;
        k = o.t / o.dur;
        var gr = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * (0.6 + 0.6 * easeOut(k)));
        gr.addColorStop(0, o.color); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = 1 - k; ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 1.3, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // rayos de paleta
      for (i = 0; i < beams.length; i++) {
        o = beams[i]; if (o.t < 0) continue;
        k = o.t / o.dur;
        var grow = clamp(k / 0.35, 0, 1), fade = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;
        var mx = (o.x1 + o.x2) / 2, my = (o.y1 + o.y2) / 2;
        var ax = mx + (o.x1 - mx) * easeOut(grow), ay = my + (o.y1 - my) * easeOut(grow);
        var bx = mx + (o.x2 - mx) * easeOut(grow), by = my + (o.y2 - my) * easeOut(grow);
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.55 * fade; ctx.strokeStyle = o.color; ctx.lineWidth = o.w * (1.1 - 0.4 * k);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.globalAlpha = 0.95 * fade; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = o.w * 0.38 * (1.1 - 0.5 * k);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      // anillos de bomba
      for (i = 0; i < rings.length; i++) {
        o = rings[i]; if (o.t < 0) continue;
        k = easeOut(o.t / o.dur);
        var r = o.r0 + (o.r1 - o.r0) * k;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = o.color; ctx.lineWidth = Math.max(2, 14 * (1 - k));
        ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, 5 * (1 - k));
        ctx.beginPath(); ctx.arc(o.x, o.y, r * 0.92, 0, TAU); ctx.stroke();
      }
      // rayos congelantes
      for (i = 0; i < rays.length; i++) {
        o = rays[i]; if (o.t < 0) continue;
        k = o.t / o.dur;
        var head = clamp(k / 0.45, 0, 1), tail = clamp((k - 0.45) / 0.55, 0, 1);
        var dx = o.x2 - o.x1, dy = o.y2 - o.y1, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len;
        var segs = o.jag.length - 1, amp = Math.min(14, len * 0.06);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        for (var pass = 0; pass < 2; pass++) {
          ctx.globalAlpha = (pass ? 1 : 0.75) * (1 - tail * 0.9);
          ctx.strokeStyle = pass ? '#ffffff' : o.color;
          ctx.lineWidth = pass ? 3.5 : 13;
          ctx.beginPath();
          var started = false;
          for (var s = 0; s <= segs; s++) {
            var f = s / segs;
            if (f > easeInOut(head) + 1e-6 || f < tail * 0.9) continue;
            var j = (s === 0 || s === segs) ? 0 : o.jag[s] * amp * Math.sin((o.t / 40) + s);
            var px = o.x1 + dx * f + nx * j, py = o.y1 + dy * f + ny * j;
            if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        if (head < 1) {
          var hx = o.x1 + dx * easeInOut(head), hy = o.y1 + dy * easeInOut(head);
          ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff';
          drawStar(hx, hy, 9, o.t / 60);
        }
      }
      ctx.globalAlpha = 1;
      // destellos blancos sobre celdas
      for (i = 0; i < flashes.length; i++) {
        o = flashes[i]; if (o.t < 0) continue;
        ctx.globalAlpha = 0.85 * (1 - o.t / o.dur);
        ctx.fillStyle = o.color;
        ctx.fillRect(o.x, o.y, o.w, o.h);
      }
      ctx.globalAlpha = 1;
      // partículas
      for (i = 0; i < live.length; i++) {
        var p = live[i];
        if (p.delay > 0) continue;
        k = p.t / p.life;
        var sz = p.size + (p.size1 - p.size) * k;
        ctx.globalAlpha = p.alpha * (k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
        ctx.fillStyle = p.color;
        switch (p.shape) {
          case 'dot':
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, sz), 0, TAU); ctx.fill(); break;
          case 'drop': {
            var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy), ang = Math.atan2(p.vy, p.vx), st = 1 + Math.min(1.4, sp / 380);
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang); ctx.scale(st, 1 / Math.sqrt(st));
            ctx.beginPath(); ctx.arc(0, 0, Math.max(0.5, sz), 0, TAU); ctx.fill(); ctx.restore(); break;
          }
          case 'star': drawStar(p.x, p.y, Math.max(1, sz), p.rot); break;
          case 'heart': drawHeart(p.x, p.y, Math.max(2, sz), p.rot * 0.2); break;
          case 'flake': ctx.strokeStyle = p.color; drawFlake(p.x, p.y, Math.max(1, sz), p.rot); break;
          case 'shard':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * 0.7, sz * 0.6); ctx.lineTo(-sz * 0.5, sz * 0.4); ctx.closePath();
            ctx.fill(); if (p.color2) { ctx.strokeStyle = p.color2; ctx.lineWidth = 1; ctx.stroke(); }
            ctx.restore(); break;
          case 'chunk':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.fillRect(-sz, -sz * 0.3, sz * 2, sz * 0.6);
            if (p.color2) { ctx.strokeStyle = p.color2; ctx.lineWidth = 1; ctx.strokeRect(-sz, -sz * 0.3, sz * 2, sz * 0.6); }
            ctx.restore(); break;
          case 'confetti':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.scale(1, Math.abs(Math.cos(p.flip + p.t / 90)));
            ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
            ctx.restore(); break;
          case 'sprinkle':
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.lineCap = 'round'; ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.4;
            ctx.beginPath(); ctx.moveTo(-p.size * 0.6, 0); ctx.lineTo(p.size * 0.6, 0); ctx.stroke();
            ctx.restore(); break;
          default:
            ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
        }
      }
      ctx.globalAlpha = 1;
      // íconos voladores
      for (i = 0; i < flyers.length; i++) {
        o = flyers[i]; if (o.t < 0 || !o.img) continue;
        k = easeInOut(clamp(o.t / o.dur, 0, 1));
        var mxp = (o.x0 + o.x1) / 2 + (o.y1 - o.y0) * o.bend, myp = Math.min(o.y0, o.y1) - 40;
        var fx = (1 - k) * (1 - k) * o.x0 + 2 * (1 - k) * k * mxp + k * k * o.x1;
        var fy = (1 - k) * (1 - k) * o.y0 + 2 * (1 - k) * k * myp + k * k * o.y1;
        var fs = o.size * (k < 0.2 ? 1 + k * 1.2 : 1.24 - 0.6 * (k - 0.2) / 0.8);
        ctx.globalAlpha = k > 0.92 ? (1 - k) / 0.08 : 1;
        ctx.drawImage(o.img, fx - fs / 2, fy - fs / 2, fs, fs);
      }
      ctx.globalAlpha = 1;
      // textos de puntos
      for (i = 0; i < texts.length; i++) {
        o = texts[i]; if (o.t < 0) continue;
        k = o.t / o.dur;
        var sc = k < 0.15 ? 0.6 + 0.4 * (k / 0.15) * 1.15 : 1;
        ctx.globalAlpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
        ctx.font = Math.round(o.size * sc) + "px 'Lilita One', 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        var ty = o.y - o.rise * easeOut(k);
        ctx.lineWidth = Math.max(3, o.size * 0.22); ctx.strokeStyle = o.stroke; ctx.strokeText(o.s, o.x, ty);
        ctx.fillStyle = o.color; ctx.fillText(o.s, o.x, ty);
      }
      ctx.globalAlpha = 1;
    }

    function clear() {
      while (live.length) pool.push(live.pop());
      beams.length = 0; rings.length = 0; rays.length = 0; texts.length = 0; glows.length = 0; flashes.length = 0;
      // los voladores pendientes cumplen su callback (para que los contadores queden al día)
      var fl = flyers.splice(0, flyers.length);
      fl.forEach(function (o) { if (o.cb) { try { o.cb(); } catch (e) { /* nada */ } } });
      shake.t = shake.dur = 0; shake.x = shake.y = 0;
      dirty = true;
    }

    return {
      canvas: canvas,
      resize: resize,
      setReduced: function (v) { reduced = !!v; },
      isReduced: function () { return reduced; },
      juice: juice, shards: shards, splinters: splinters, sparkle: sparkle, hearts: hearts, puff: puff, confetti: confetti,
      beam: beam, ring: ring, ray: ray, glow: glow, flash: flash, text: text, flyer: flyer, shake: doShake,
      offset: function () { return { x: shake.x, y: shake.y }; },
      update: update, draw: draw, alive: alive, clear: clear,
      needsClear: function () { return dirty; },
      count: function () { return live.length; },
    };
  }

  Cocardo.FX = { create: create, JUICE: JUICE, MAX_PARTICLES: MAX_PARTICLES };
})();
