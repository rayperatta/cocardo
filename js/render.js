/* Cocardo: ¡Rescate Helado! — Renderer del tablero en canvas.
 * Dueño: Board. Contrato: docs/ARQUITECTURA.md §11, reglas visuales: docs/DISENO.md §12 y §15.
 * Cocardo.Render.create(canvas, { fx }) -> R
 *  - modelo visual del tablero (piezas con id, bloqueos, congelador) espejo de la grilla del motor
 *  - sprites rasterizados desde Cocardo.Art (SVG -> Image -> canvas) por tamaño de celda, con caché
 *  - reloj interno + tweens + temporizadores; requestAnimationFrame SOLO mientras algo se mueve */
(function () {
  'use strict';
  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  var EASE = {
    linear: function (t) { return t; },
    in: function (t) { return t * t; },
    in3: function (t) { return t * t * t; },
    out: function (t) { return 1 - (1 - t) * (1 - t); },
    out3: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOut: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    outBack: function (t) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };
  var TILE = 0.98;          // tamaño de la ficha respecto a la celda
  var SPECIAL_SCALE = 1.08; // los especiales se dibujan un poco más grandes, con contorno blanco brillante
  var SPECIAL = { ph: 1, pv: 1, bomba: 1, copa: 1 };
  var RASTER = 1.15;        // sobre-muestreo de sprites (para los "pop" que agrandan la ficha)
  var FLAVOR = { L: '#8fd63a', F: '#ff3b55', B: '#ffd23c', U: '#9a4ed6', N: '#ff8c1f', D: '#ff9a6a' };

  function create(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var fx = opts.fx || null;

    // ---------- estado visual ----------
    var R = {
      canvas: canvas, ctx: ctx, fx: fx, EASE: EASE,
      rows: 8, cols: 8, side: 300, cell: 30, pad: 6, ox: 6, oy: 6, dpr: 1,
      cells: [], pieces: {}, dying: [], dyingB: [], fz: null, fzDying: null, colTop: [],
      sel: null, cursor: null, hint: null, spotlight: null, guide: null, exits: false, fzBadge: null, nudges: {},
      onFrame: null,
    };
    var scared = {};
    var bg = null;

    // ---------- reloj, tweens y temporizadores ----------
    var clock = { t: 0, paused: false };
    var tweens = [], timers = [];
    var rafId = 0, lastTs = 0, fxWasAlive = false, freezeLeft = 0;

    function now() { return clock.t; }

    // Anima props numéricas de obj hacia `to`. El valor inicial se toma al empezar (tras el delay).
    function tween(obj, to, dur, ease, delay, done) {
      var tw = { obj: obj, to: to, from: null, t0: clock.t + (delay || 0), dur: Math.max(1, dur || 1), ease: EASE[ease] || ease || EASE.out, done: done || null };
      tweens.push(tw);
      kick();
      return tw;
    }
    function stepTweens() {
      for (var i = 0; i < tweens.length; i++) {
        var tw = tweens[i];
        if (clock.t < tw.t0) continue;
        if (!tw.from) { tw.from = {}; for (var k in tw.to) tw.from[k] = tw.obj[k] === undefined ? 0 : tw.obj[k]; }
        var p = Math.min(1, (clock.t - tw.t0) / tw.dur), e = tw.ease(p);
        for (var k2 in tw.to) tw.obj[k2] = tw.from[k2] + (tw.to[k2] - tw.from[k2]) * e;
        if (p >= 1) tw.fin = true;
      }
      var fin = [];
      tweens = tweens.filter(function (tw) { if (tw.fin) { if (tw.done) fin.push(tw.done); return false; } return true; });
      fin.forEach(function (f) { try { f(); } catch (e) { report(e); } });
    }
    function after(ms, fn) { timers.push({ at: clock.t + Math.max(0, ms), fn: fn }); kick(); }
    function wait(ms) { return new Promise(function (res) { after(ms, res); }); }
    function stepTimers() {
      if (!timers.length) return;
      var due = [];
      timers = timers.filter(function (t) { if (t.at <= clock.t) { due.push(t); return false; } return true; });
      due.sort(function (a, b) { return a.at - b.at; });
      due.forEach(function (t) { try { t.fn(); } catch (e) { report(e); } });
    }
    // Termina todo al instante (saltar animaciones / reiniciar)
    function flush() {
      var guard = 0;
      while ((tweens.length || timers.length) && guard++ < 50) {
        tweens.forEach(function (tw) {
          if (!tw.from) { tw.from = {}; for (var k in tw.to) tw.from[k] = tw.obj[k]; }
          for (var k2 in tw.to) tw.obj[k2] = tw.to[k2];
        });
        var tw0 = tweens; tweens = [];
        tw0.forEach(function (tw) { if (tw.done) { try { tw.done(); } catch (e) { report(e); } } });
        var t0 = timers; timers = [];
        t0.sort(function (a, b) { return a.at - b.at; });
        t0.forEach(function (t) { try { t.fn(); } catch (e) { report(e); } });
      }
      R.dying = []; R.dyingB = []; R.fzDying = null;
      kick();
    }
    function cancelAll() { tweens = []; timers = []; freezeLeft = 0; R.dying = []; R.dyingB = []; R.fzDying = null; }
    function report(e) { if (typeof console !== 'undefined') console.error(e); }

    function continuous() { return !!(R.sel || R.hint || R.spotlight || R.guide || freezeLeft > 0 || (R.fzBadge && R.fzBadge.n === 1)); }
    function active() {
      if (clock.paused) return false;
      return tweens.length > 0 || timers.length > 0 || (fx && fx.alive()) || continuous();
    }
    function kick() {
      if (!rafId && typeof requestAnimationFrame === 'function') rafId = requestAnimationFrame(frame);
    }
    function frame(ts) {
      rafId = 0;
      var dt = lastTs ? Math.min(50, Math.max(0, ts - lastTs)) : 16;
      lastTs = ts;
      if (!clock.paused) {
        if (freezeLeft > 0) freezeLeft -= dt;   // congelar imagen: el reloj no avanza
        else {
          clock.t += dt;
          stepTweens();
          stepTimers();
          if (fx) fx.update(dt);
        }
      }
      if (R.onFrame) { try { R.onFrame(dt); } catch (e) { report(e); } }
      draw();
      if (fx) {
        var al = fx.alive();
        if (al || fxWasAlive || fx.needsClear()) fx.draw();
        fxWasAlive = al;
      }
      if (active()) kick(); else lastTs = 0;
    }
    function setPaused(p) {
      clock.paused = !!p;
      if (!p) { lastTs = 0; kick(); }
    }

    // ---------- geometría ----------
    function layout(sideCss, rows, cols, dpr) {
      R.rows = rows || R.rows; R.cols = cols || R.cols;
      R.dpr = Math.min(2, Math.max(1, dpr || 1));
      R.side = Math.max(120, Math.floor(sideCss));
      R.pad = Math.max(6, Math.round(R.side * 0.02));
      var n = Math.max(R.rows, R.cols);
      R.cell = (R.side - 2 * R.pad) / n;
      R.ox = R.pad + (n - R.cols) * R.cell / 2;
      R.oy = R.pad + (n - R.rows) * R.cell / 2;
      canvas.width = Math.round(R.side * R.dpr);
      canvas.height = Math.round(R.side * R.dpr);
      canvas.style.width = R.side + 'px';
      canvas.style.height = R.side + 'px';
      buildBg();
      var want = spritePx(1);
      var stale = !spriteBase || Math.abs(want - spriteBase) / spriteBase > 0.1;
      return stale;
    }
    function X(c) { return R.ox + c * R.cell; }
    function Y(r) { return R.oy + r * R.cell; }
    function cellCenter(r, c) { return { x: X(c) + R.cell / 2, y: Y(r) + R.cell / 2 }; }
    function cellAt(x, y) {
      var c = Math.floor((x - R.ox) / R.cell), r = Math.floor((y - R.oy) / R.cell);
      if (r < 0 || c < 0 || r >= R.rows || c >= R.cols) return null;
      return { r: r, c: c };
    }

    // ---------- modelo ----------
    function mkPiece(p, r, c) {
      return { id: p.id, type: p.type, color: p.color, frost: !!p.frost, skin: p.skin || null, r: r, c: c, x: c, y: r,
        s: 1, sx: 1, sy: 1, a: 1, rot: 0, z: 0, frostA: p.frost ? 1 : 0, flash: 0, shine: 0, face: null, blinkUntil: 0, ox: 0, oy: 0 };
    }
    function mkBlock(b) { return { kind: b.kind, hp: b.hp, maxHp: b.maxHp, who: b.who || null, s: 1, a: 1, ox: 0, oy: 0, flash: 0 }; }

    function load(state) {
      R.rows = state.rows; R.cols = state.cols;
      R.cells = []; R.pieces = {}; R.dying = []; R.dyingB = []; R.fz = null; R.fzDying = null; R.nudges = {};
      for (var r = 0; r < state.rows; r++) {
        R.cells.push([]);
        for (var c = 0; c < state.cols; c++) {
          var cell = state.grid[r][c];
          if (!cell) { R.cells[r].push(null); continue; }
          var v = { b: null, pid: null, fzPart: false };
          if (cell.b) {
            if (cell.b.kind === 'freezer') v.fzPart = true;
            else v.b = mkBlock(cell.b);
          } else if (cell.p) {
            v.pid = cell.p.id;
            R.pieces[cell.p.id] = mkPiece(cell.p, r, c);
          }
          R.cells[r].push(v);
        }
      }
      var f = state.freezer;
      if (f && f.hp > 0) R.fz = { r: f.r, c: f.c, hp: f.hp, maxHp: f.maxHp, who: f.who, hpShown: f.hp, s: 1, a: 1, ox: 0, oy: 0, flash: 0 };
      computeStatic();
      buildBg();
      kick();
    }
    function computeStatic() {
      R.colTop = [];
      for (var c = 0; c < R.cols; c++) {
        var top = R.rows;
        for (var r = 0; r < R.rows; r++) if (R.cells[r] && R.cells[r][c]) { top = r; break; }
        R.colTop.push(top);
      }
      scared = {};
      if (R.fz) {
        for (var dr = -1; dr <= 2; dr++) for (var dc = -1; dc <= 2; dc++) scared[(R.fz.r + dr) + ',' + (R.fz.c + dc)] = 1;
      }
    }
    function cellV(r, c) { return (r >= 0 && c >= 0 && r < R.rows && c < R.cols && R.cells[r]) ? R.cells[r][c] : null; }
    function pieceAt(r, c) { var v = cellV(r, c); return v && v.pid != null ? R.pieces[v.pid] || null : null; }

    // Saca una pieza del modelo; se sigue dibujando (en `dying`) hasta que termine su animación.
    function removePiece(id, keepMs) {
      var p = R.pieces[id];
      if (!p) return null;
      var v = cellV(p.r, p.c);
      if (v && v.pid === id) v.pid = null;
      delete R.pieces[id];
      R.dying.push(p);
      after(keepMs || 0, function () { var i = R.dying.indexOf(p); if (i >= 0) R.dying.splice(i, 1); });
      return p;
    }
    function addPiece(desc, r, c) {
      var p = mkPiece(desc, r, c);
      R.pieces[p.id] = p;
      var v = cellV(r, c);
      if (v) v.pid = p.id;
      return p;
    }
    function setBlock(r, c, desc) {
      var v = cellV(r, c);
      if (!v) return null;
      v.b = mkBlock(desc);
      return v.b;
    }
    function removeBlock(r, c, keepMs) {
      var v = cellV(r, c);
      if (!v || !v.b) return null;
      var b = v.b; v.b = null;
      b.r = r; b.c = c;
      R.dyingB.push(b);
      after(keepMs || 0, function () { var i = R.dyingB.indexOf(b); if (i >= 0) R.dyingB.splice(i, 1); });
      return b;
    }
    function removeFreezer(keepMs) {
      var f = R.fz;
      if (!f) return null;
      R.fz = null;
      for (var dr = 0; dr < 2; dr++) for (var dc = 0; dc < 2; dc++) { var v = cellV(f.r + dr, f.c + dc); if (v) v.fzPart = false; }
      R.fzDying = f;
      after(keepMs || 0, function () { if (R.fzDying === f) R.fzDying = null; });
      computeStatic();
      return f;
    }

    // Instantánea para comparar con el estado del motor
    function diff(state) {
      var out = [];
      for (var r = 0; r < state.rows; r++) for (var c = 0; c < state.cols; c++) {
        var sc = state.grid[r][c], v = cellV(r, c);
        if (!sc) { if (v) out.push('void ' + r + ',' + c); continue; }
        if (!v) { out.push('missing ' + r + ',' + c); continue; }
        if (sc.p) {
          var p = v.pid != null ? R.pieces[v.pid] : null;
          if (!p) { out.push('no piece at ' + r + ',' + c); continue; }
          if (p.id !== sc.p.id || p.type !== sc.p.type || p.color !== sc.p.color || !!p.frost !== !!sc.p.frost || p.r !== r || p.c !== c)
            out.push('piece ' + r + ',' + c + ' view=' + [p.id, p.type, p.color, p.frost, p.r, p.c].join('/') + ' eng=' + [sc.p.id, sc.p.type, sc.p.color, sc.p.frost].join('/'));
          else if (Math.abs(p.x - c) > 0.01 || Math.abs(p.y - r) > 0.01 || p.a < 0.99 || p.s < 0.99)
            out.push('piece ' + p.id + ' not at rest (' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + ' a=' + p.a.toFixed(2) + ' s=' + p.s.toFixed(2) + ')');
        } else if (v.pid != null) out.push('extra piece ' + v.pid + ' at ' + r + ',' + c);
        if (sc.b) {
          if (sc.b.kind === 'freezer') { if (!v.fzPart) out.push('freezer part ' + r + ',' + c); }
          else if (!v.b || v.b.kind !== sc.b.kind || v.b.hp !== sc.b.hp) out.push('block ' + r + ',' + c + ' ' + sc.b.kind + sc.b.hp + ' view=' + (v.b ? v.b.kind + v.b.hp : 'none'));
        } else if (v.b || v.fzPart) out.push('extra block ' + r + ',' + c);
      }
      var f = state.freezer;
      if (f && f.hp > 0) { if (!R.fz || R.fz.hp !== f.hp) out.push('freezer hp ' + f.hp + ' view=' + (R.fz ? R.fz.hp : 'none')); }
      else if (R.fz) out.push('freezer should be gone');
      var nView = Object.keys(R.pieces).length, nEng = 0;
      state.grid.forEach(function (row) { row.forEach(function (cl) { if (cl && cl.p) nEng++; }); });
      if (nView !== nEng) out.push('piece count view=' + nView + ' eng=' + nEng);
      return out;
    }

    // ---------- sprites ----------
    var sprites = {}, spriteGen = {}, spriteBase = 0, pending = {}, genN = 0;
    function spritePx(mult) { return Math.max(8, Math.round(R.cell * R.dpr * RASTER * (mult || 1))); }
    function keyMult(key) { return key.indexOf('fz|') === 0 ? 2 : 1; }

    function svgFor(key) {
      var A = Cocardo.Art || {}, p = key.split('|');
      try {
        switch (p[0]) {
          case 't': return A.tile ? A.tile(p[1], { type: p[2], face: p[3] }) : null;
          case 'copa': return A.copa ? A.copa() : (A.tile ? A.tile(null, { type: 'copa' }) : null);
          case 'tok': return A.token ? A.token(p[1]) : null;
          case 'frost': return A.frost ? A.frost() : null;
          case 'ice': return A.ice ? A.ice(+p[1], +p[2]) : null;
          case 'crate': return A.crate ? A.crate() : null;
          case 'fr': return A.friend ? A.friend(p[1], +p[2], +p[3]) : null;
          case 'fz': return A.freezer ? A.freezer(p[1], +p[2], +p[3]) : null;
        }
      } catch (e) { report(e); }
      return null;
    }
    // Sprite de emergencia si el arte falla (nunca rompemos el juego)
    function fallbackSprite(key, px) {
      var cv = document.createElement('canvas');
      cv.width = cv.height = px;
      var g = cv.getContext('2d'), p = key.split('|'), col = '#cccccc';
      if (p[0] === 't') col = FLAVOR[p[1]] || col;
      else if (p[0] === 'ice' || p[0] === 'fr' || p[0] === 'frost') col = 'rgba(191,233,255,0.8)';
      else if (p[0] === 'crate') col = '#c98a4a';
      else if (p[0] === 'fz') col = '#e9e2d2';
      else if (p[0] === 'tok') col = '#ffc93c';
      else if (p[0] === 'copa') col = '#ff6fa5';
      g.fillStyle = col; g.strokeStyle = '#2b1630'; g.lineWidth = px * 0.05;
      g.beginPath();
      if (p[0] === 't' || p[0] === 'tok' || p[0] === 'copa') g.arc(px / 2, px / 2, px * 0.42, 0, Math.PI * 2);
      else g.rect(px * 0.06, px * 0.06, px * 0.88, px * 0.88);
      g.fill(); g.stroke();
      return cv;
    }
    function rasterize(key, px) {
      return new Promise(function (resolve) {
        var svg = svgFor(key);
        if (!svg || typeof Image === 'undefined') { resolve(fallbackSprite(key, px)); return; }
        var img = new Image(), done = false;
        function finish(ok) {
          if (done) return; done = true;
          if (!ok) { resolve(fallbackSprite(key, px)); return; }
          var cv = document.createElement('canvas');
          cv.width = cv.height = px;
          try { cv.getContext('2d').drawImage(img, 0, 0, px, px); } catch (e) { resolve(fallbackSprite(key, px)); return; }
          resolve(cv);
        }
        img.onload = function () { finish(true); };
        img.onerror = function () { finish(false); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
    }
    // Asegura que existan los sprites indicados (al tamaño actual). Si el tamaño cambia a mitad de carga, se repite.
    function load1(k) {
      var pd = pending[k];
      if (pd && pd.gen === genN) return pd.p;
      var gen = genN;
      var pr = rasterize(k, spritePx(keyMult(k))).then(function (cv) {
        if (gen === genN) { sprites[k] = cv; spriteGen[k] = gen; delete pending[k]; kick(); return null; }
        return load1(k);
      });
      pending[k] = { p: pr, gen: gen };
      return pr;
    }
    function ensure(keys) {
      if (!spriteBase) spriteBase = spritePx(1);
      var list = [];
      keys.forEach(function (k) {
        if (!k || (sprites[k] && spriteGen[k] === genN)) return;
        list.push(load1(k));
      });
      return Promise.all(list);
    }
    // Vuelve a rasterizar todo lo que hay en caché al nuevo tamaño; mientras, se dibujan los viejos escalados
    function rerasterize() {
      genN++;
      glows = {};
      spriteBase = spritePx(1);
      return ensure(Object.keys(sprites).concat(Object.keys(pending)));
    }
    function sprite(key) { return sprites[key] || null; }

    // Contorno blanco con brillo de un especial: silueta dilatada (8 copias corridas, rellena de blanco) con
    // sombra difusa. Se arma una vez por sprite y se guarda; se dibuja detrás de la ficha.
    var glows = {};
    function glowFor(img, key) {
      var gk = key + '|' + (img.width || 0);
      if (glows[gk] !== undefined) return glows[gk];
      if (typeof document === 'undefined' || !img.width) return null;
      var S = img.width, padPx = Math.ceil(S * 0.14), W = S + padPx * 2, out = null;
      try {
        var sil = document.createElement('canvas'); sil.width = sil.height = W;
        var g = sil.getContext('2d'), d = Math.max(1, S * 0.04);
        for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; g.drawImage(img, padPx + Math.cos(a) * d, padPx + Math.sin(a) * d, S, S); }
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, W);
        out = document.createElement('canvas'); out.width = out.height = W;
        var o = out.getContext('2d');
        // contorno blanco nítido con halo cálido (se lee igual sobre el damero crema y sobre fondos oscuros)
        o.shadowColor = 'rgba(255,196,60,0.95)'; o.shadowBlur = S * 0.1;
        o.drawImage(sil, 0, 0); o.drawImage(sil, 0, 0);
        o.shadowColor = 'rgba(255,255,255,1)'; o.shadowBlur = S * 0.04;
        o.drawImage(sil, 0, 0);
        out.padK = W / S;
      } catch (e) { out = null; }
      glows[gk] = out;
      return out;
    }
    // Destello que barre la ficha en diagonal (brillo ocioso de los especiales); k = 0..1
    var scratch = null;
    function drawShine(img, cx, cy, w, h, k, alpha) {
      if (typeof document === 'undefined') return;
      var sw = Math.max(2, Math.ceil(w * R.dpr)), sh = Math.max(2, Math.ceil(h * R.dpr));
      if (!scratch) scratch = document.createElement('canvas');
      if (scratch.width < sw || scratch.height < sh) { scratch.width = Math.max(scratch.width, sw); scratch.height = Math.max(scratch.height, sh); }
      var g = scratch.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, sw, sh);
      g.drawImage(img, 0, 0, sw, sh);
      g.globalCompositeOperation = 'source-in';
      var bw = sw * 0.55, x0 = -bw + k * (sw + bw * 1.4);
      var gr = g.createLinearGradient(x0, 0, x0 + bw, bw * 0.55);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, sw, sh);
      g.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * Math.sin(Math.PI * Math.max(0, Math.min(1, k)));
      ctx.drawImage(scratch, 0, 0, sw, sh, cx - w / 2, cy - h / 2, w, h);
      ctx.restore();
    }

    function faceFor(p) {
      if (p.face) return p.face;
      if (p.blinkUntil > clock.t) return 'blink';
      if (p.frost || scared[p.r + ',' + p.c]) return 'scared';
      return 'normal';
    }
    function pieceKey(p, face) {
      if (p.type === 'copa') return 'copa';
      if (p.type === 'token') return 'tok|' + (p.skin || 'uva');
      var f = face || faceFor(p);
      if (p.type !== 'n' && f === 'scared') f = 'normal';
      return 't|' + p.color + '|' + p.type + '|' + f;
    }
    function pieceSprite(p) {
      var k = pieceKey(p);
      var s = sprites[k];
      if (s) return s;
      if (p.type !== 'copa' && p.type !== 'token') {
        s = sprites[pieceKey(p, 'normal')] || sprites['t|' + p.color + '|n|normal'];
        if (!pending[k]) load1(k);
      }
      return s || null;
    }
    function blockKey(b) {
      if (b.kind === 'ice') return 'ice|' + Math.max(1, b.hp) + '|' + b.maxHp;
      if (b.kind === 'crate') return 'crate';
      if (b.kind === 'friend') return 'fr|' + b.who + '|' + Math.max(1, b.hp) + '|' + b.maxHp;
      return null;
    }
    function fzKey(f) { return 'fz|' + f.who + '|' + Math.max(1, f.hp) + '|' + f.maxHp; }
    function anySprite(prefix) {
      for (var k in sprites) if (k.indexOf(prefix) === 0) return sprites[k];
      return null;
    }

    // Todas las claves que puede necesitar un nivel. essential = lo que se ve en el primer cuadro.
    function keysFor(state, level) {
      var ess = [], rest = [], faces = ['normal', 'blink', 'scared', 'happy'];
      var seen = {};
      function add(list, k) { if (!seen[k]) { seen[k] = 1; list.push(k); } }
      (state.colors || []).forEach(function (col) {
        add(ess, 't|' + col + '|n|normal');
        faces.forEach(function (f) { add(rest, 't|' + col + '|n|' + f); });
        ['ph', 'pv', 'bomba'].forEach(function (t) { ['normal', 'blink', 'happy'].forEach(function (f) { add(rest, 't|' + col + '|' + t + '|' + f); }); });
      });
      add(ess, 'frost'); add(rest, 'copa'); add(rest, 'crate');
      var hasCrateVillain = (state.villains || []).some(function (v) { return v.act === 'crate'; });
      if (hasCrateVillain) add(ess, 'crate');
      state.grid.forEach(function (row) {
        row.forEach(function (cell) {
          if (!cell) return;
          if (cell.p) {
            if (cell.p.type === 'token') add(ess, 'tok|' + (cell.p.skin || 'uva'));
            else if (cell.p.type !== 'n') add(ess, pieceKey({ type: cell.p.type, color: cell.p.color }, 'normal'));
            else if (cell.p.frost) add(ess, 't|' + cell.p.color + '|n|scared');
          }
          if (cell.b && cell.b.kind !== 'freezer') {
            var b = cell.b;
            add(ess, blockKey(b));
            for (var h = 1; h <= b.maxHp; h++) add(rest, blockKey({ kind: b.kind, hp: h, maxHp: b.maxHp, who: b.who }));
          }
        });
      });
      if (state.tokens) add(ess, 'tok|' + state.tokens.skin);
      if (state.freezer && state.freezer.hp > 0) {
        var f = state.freezer;
        add(ess, fzKey(f));
        for (var h2 = 1; h2 <= f.maxHp; h2++) add(rest, fzKey({ who: f.who, hp: h2, maxHp: f.maxHp }));
        (state.colors || []).forEach(function (col) { add(ess, 't|' + col + '|n|scared'); });
      }
      rest = rest.filter(function (k) { return ess.indexOf(k) < 0; });
      return { essential: ess, rest: rest };
    }

    // ---------- fondo del tablero (pre-renderizado) ----------
    function roundRectPath(g, x, y, w, h, rad) {
      // rad = [tl, tr, br, bl]
      g.moveTo(x + rad[0], y);
      g.lineTo(x + w - rad[1], y);
      if (rad[1]) g.arcTo(x + w, y, x + w, y + rad[1], rad[1]); else g.lineTo(x + w, y);
      g.lineTo(x + w, y + h - rad[2]);
      if (rad[2]) g.arcTo(x + w, y + h, x + w - rad[2], y + h, rad[2]); else g.lineTo(x + w, y + h);
      g.lineTo(x + rad[3], y + h);
      if (rad[3]) g.arcTo(x, y + h, x, y + h - rad[3], rad[3]); else g.lineTo(x, y + h);
      g.lineTo(x, y + rad[0]);
      if (rad[0]) g.arcTo(x, y, x + rad[0], y, rad[0]); else g.lineTo(x, y);
      g.closePath();
    }
    function isCell(r, c) { return !!cellV(r, c); }
    function buildBg() {
      if (typeof document === 'undefined' || !R.cells.length) return;
      var px = Math.round(R.side * R.dpr);
      if (!bg) bg = document.createElement('canvas');
      bg.width = px; bg.height = px;
      var g = bg.getContext('2d');
      g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
      g.clearRect(0, 0, R.side, R.side);
      var cs = R.cell;
      function layer(inflate, radius, fill, checker) {
        g.beginPath();
        for (var r = 0; r < R.rows; r++) for (var c = 0; c < R.cols; c++) {
          if (!isCell(r, c)) continue;
          if (checker && (r + c) % 2 === 0) continue;
          var up = isCell(r - 1, c), dn = isCell(r + 1, c), lf = isCell(r, c - 1), rt = isCell(r, c + 1);
          var x = X(c), y = Y(r), w = cs, h = cs;
          if (!checker) {
            x -= lf ? 0 : inflate; w += (lf ? 0 : inflate) + (rt ? 0.6 : inflate);
            y -= up ? 0 : inflate; h += (up ? 0 : inflate) + (dn ? 0.6 : inflate);
          }
          var rad = [(!up && !lf) ? radius : 0, (!up && !rt) ? radius : 0, (!dn && !rt) ? radius : 0, (!dn && !lf) ? radius : 0];
          roundRectPath(g, x, y, w, h, rad);
        }
        g.fillStyle = fill;
        g.fill('nonzero');
      }
      var k = Math.max(3, cs * 0.09);
      // sombra suave
      g.save(); g.translate(0, k * 0.6);
      layer(k * 1.5, cs * 0.3, 'rgba(43,22,48,0.28)');
      g.restore();
      layer(k * 1.5, cs * 0.3, 'rgba(43,22,48,0.62)');           // contorno tinta
      layer(k * 0.9, cs * 0.24, 'rgba(234,248,255,0.96)');        // borde de hielo
      layer(0, cs * 0.16, 'rgba(255,246,234,0.86)');              // panel crema
      layer(0, cs * 0.16, 'rgba(191,233,255,0.42)', true);        // damero helado
      // brillo superior del panel
      var grd = g.createLinearGradient(0, R.oy, 0, R.oy + R.rows * cs);
      grd.addColorStop(0, 'rgba(255,255,255,0.35)'); grd.addColorStop(0.4, 'rgba(255,255,255,0)'); grd.addColorStop(1, 'rgba(160,200,230,0.12)');
      g.save();
      g.beginPath();
      for (var r = 0; r < R.rows; r++) for (var c = 0; c < R.cols; c++) if (isCell(r, c)) g.rect(X(c), Y(r), cs + 0.5, cs + 0.5);
      g.clip();
      g.fillStyle = grd; g.fillRect(0, 0, R.side, R.side);
      g.restore();
    }

    // ---------- dibujo ----------
    function drawImg(img, cx, cy, w, h, rot, alpha) {
      if (!img) return;
      ctx.globalAlpha = alpha;
      if (rot) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } else ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    }
    function hintRot(p) {
      var h = R.hint;
      if (!h) return 0;
      if (!((p.r === h.a.r && p.c === h.a.c) || (p.r === h.b.r && p.c === h.b.c))) return 0;
      var t = (clock.t - h.t0) % 1500;
      if (t > 700) return 0;
      return Math.sin(t / 700 * Math.PI * 4) * 0.2 * Math.sin(t / 700 * Math.PI);
    }
    function drawPiece(p) {
      if (p.a <= 0.01 || p.s <= 0.01) return;
      var img = pieceSprite(p);
      if (!img) return;
      var sp = !!SPECIAL[p.type];
      var cs = R.cell, size = cs * TILE * p.s * (sp ? SPECIAL_SCALE : 1), w = size * p.sx, h = size * p.sy;
      var cx = X(p.x) + cs / 2 + p.ox * cs, cy = Y(p.y) + cs / 2 + p.oy * cs + (size - h) / 2;
      var nd = R.nudges[p.id];
      if (nd) { cx += nd.x * cs; cy += nd.y * cs; }
      var rot = p.rot + hintRot(p);
      var top = R.colTop[p.c] || 0, clipped = p.y < top - 0.001;
      if (clipped) {
        ctx.save();
        ctx.beginPath(); ctx.rect(X(p.c) - cs, Y(top), cs * 3, R.side); ctx.clip();
      }
      if (sp) {
        var gl = glowFor(img, pieceKey(p));
        if (gl) drawImg(gl, cx, cy, w * gl.padK, h * gl.padK, rot, p.a * 0.95);
      }
      drawImg(img, cx, cy, w, h, rot, p.a);
      if (sp && p.shine > 0.001 && p.shine < 0.999 && !rot) drawShine(img, cx, cy, w, h, p.shine, p.a);
      if (p.frostA > 0.01) drawImg(sprites.frost, cx, cy, w * 1.02, h * 1.02, rot, p.a * p.frostA);
      if (p.flash > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        drawImg(img, cx, cy, w, h, rot, Math.min(1, p.flash) * p.a);
        ctx.restore();
      }
      if (clipped) ctx.restore();
      ctx.globalAlpha = 1;
    }
    function drawBlock(b, r, c) {
      var key = blockKey(b), img = sprites[key] || anySprite(b.kind === 'ice' ? 'ice|' : b.kind === 'friend' ? 'fr|' + b.who : 'crate');
      if (!img || b.a <= 0.01) return;
      var cs = R.cell, size = cs * b.s;
      drawImg(img, X(c) + cs / 2 + b.ox * cs, Y(r) + cs / 2 + b.oy * cs, size, size, 0, b.a);
      if (b.flash > 0.01) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        drawImg(img, X(c) + cs / 2 + b.ox * cs, Y(r) + cs / 2 + b.oy * cs, size, size, 0, Math.min(1, b.flash));
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    function drawFreezer(f) {
      var img = sprites[fzKey(f)] || anySprite('fz|' + f.who);
      var cs = R.cell, size = cs * 2 * f.s;
      var cx = X(f.c) + cs + f.ox * cs, cy = Y(f.r) + cs + f.oy * cs;
      if (img && f.a > 0.01) {
        drawImg(img, cx, cy, size, size, f.rot || 0, f.a);
        if (f.flash > 0.01) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          drawImg(img, cx, cy, size, size, f.rot || 0, Math.min(1, f.flash) * 0.8);
          ctx.restore();
        }
      }
      ctx.globalAlpha = f.a;
      // barra de vida
      var pink = f.who === 'cereza';
      var bw = cs * 1.56, bh = Math.max(8, cs * 0.24), bx = X(f.c) + cs - bw / 2 + f.ox * cs, by = Y(f.r) + cs * 2 - bh - cs * 0.04 + f.oy * cs;
      ctx.beginPath(); roundRectPath(ctx, bx - 2, by - 2, bw + 4, bh + 4, [bh / 2 + 2, bh / 2 + 2, bh / 2 + 2, bh / 2 + 2]);
      ctx.fillStyle = '#2b1630'; ctx.fill();
      var frac = Math.max(0, Math.min(1, f.hpShown / f.maxHp));
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); roundRectPath(ctx, bx, by, bw, bh, [bh / 2, bh / 2, bh / 2, bh / 2]); ctx.fill();
      if (frac > 0) {
        var gr = ctx.createLinearGradient(0, by, 0, by + bh);
        gr.addColorStop(0, pink ? '#ffb0cc' : '#9fe4ff'); gr.addColorStop(1, pink ? '#e0408a' : '#2a8fd8');
        ctx.fillStyle = gr;
        ctx.beginPath(); roundRectPath(ctx, bx, by, Math.max(bh, bw * frac), bh, [bh / 2, bh / 2, bh / 2, bh / 2]); ctx.fill();
      }
      ctx.font = Math.round(bh * 0.86) + "px 'Lilita One', 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = '#2b1630'; ctx.lineJoin = 'round';
      var txt = Math.max(0, Math.round(f.hpShown)) + '/' + f.maxHp;
      ctx.strokeText(txt, bx + bw / 2, by + bh / 2 + 1);
      ctx.fillStyle = '#ffffff'; ctx.fillText(txt, bx + bw / 2, by + bh / 2 + 1);
      // globito de cuenta regresiva del villano del congelador
      var bd = R.fzBadge;
      if (bd && bd.n > 0 && f === R.fz) {
        var pulse = bd.n === 1 ? 1 + 0.12 * Math.sin(clock.t / 90) : 1;
        var rr = cs * 0.3 * pulse, bxc = X(f.c) + cs * 2 - cs * 0.16 + f.ox * cs, byc = Y(f.r) + cs * 0.2 + f.oy * cs;
        ctx.beginPath(); ctx.arc(bxc, byc, rr + 2.5, 0, Math.PI * 2); ctx.fillStyle = '#2b1630'; ctx.fill();
        ctx.beginPath(); ctx.arc(bxc, byc, rr, 0, Math.PI * 2);
        ctx.fillStyle = bd.n === 1 ? '#d61f4b' : (pink ? '#ff6fa5' : '#4aa8e0'); ctx.fill();
        ctx.font = Math.round(rr * 1.25) + "px 'Lilita One', 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif";
        ctx.fillStyle = '#ffffff'; ctx.fillText(String(bd.n), bxc, byc + 1);
      }
      ctx.globalAlpha = 1;
    }
    function ringAt(r, c, color, lw, inset, alpha, wc, hc) {
      var cs = R.cell, x = X(c) + inset, y = Y(r) + inset, w = cs * (wc || 1) - inset * 2, h = cs * (hc || 1) - inset * 2, rad = cs * 0.22;
      ctx.globalAlpha = alpha;
      ctx.beginPath(); roundRectPath(ctx, x, y, w, h, [rad, rad, rad, rad]);
      ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    function draw() {
      ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
      ctx.clearRect(0, 0, R.side, R.side);
      if (bg) ctx.drawImage(bg, 0, 0, R.side, R.side);
      var cs = R.cell, k, p, list = [], top = [];
      // fichas (las que se mueven, encima)
      for (k in R.pieces) { p = R.pieces[k]; (p.z > 0 ? top : list).push(p); }
      for (var i = 0; i < R.dying.length; i++) (R.dying[i].z > 0 ? top : list).push(R.dying[i]);
      // brillo bajo las fichas de la pista
      if (R.hint) {
        var hk = 0.7 + 0.3 * Math.sin((clock.t - R.hint.t0) / 220);
        [R.hint.a, R.hint.b].forEach(function (q) {
          var gx = X(q.c) + cs / 2, gy = Y(q.r) + cs / 2;
          var gr = ctx.createRadialGradient(gx, gy, cs * 0.2, gx, gy, cs * 0.72);
          gr.addColorStop(0, 'rgba(255,236,120,' + hk.toFixed(3) + ')');
          gr.addColorStop(0.65, 'rgba(255,214,90,' + (0.55 * hk).toFixed(3) + ')');
          gr.addColorStop(1, 'rgba(255,214,90,0)');
          ctx.fillStyle = gr;
          ctx.fillRect(X(q.c) - cs * 0.25, Y(q.r) - cs * 0.25, cs * 1.5, cs * 1.5);
        });
      }
      list.forEach(drawPiece);
      // bloqueos (las fichas que caen pasan por detrás)
      for (var r = 0; r < R.rows; r++) for (var c = 0; c < R.cols; c++) {
        var v = R.cells[r] && R.cells[r][c];
        if (v && v.b) drawBlock(v.b, r, c);
      }
      R.dyingB.forEach(function (b) { drawBlock(b, b.r, b.c); });
      if (R.fz) drawFreezer(R.fz);
      if (R.fzDying) drawFreezer(R.fzDying);
      top.forEach(drawPiece);
      if (R.exits) drawExits();
      // foco del tutorial
      if (R.spotlight && R.spotlight.length) {
        ctx.beginPath();
        ctx.rect(0, 0, R.side, R.side);
        // cada hueco es una celda, o un bloque de w x h celdas (el congelador entero)
        R.spotlight.forEach(function (q) {
          var x = X(q.c) + 1, y = Y(q.r) + 1, w = cs * (q.w || 1) - 2, h = cs * (q.h || 1) - 2, rad = cs * 0.2;
          ctx.moveTo(x + rad, y); ctx.arcTo(x, y, x, y + rad, rad); ctx.lineTo(x, y + h - rad); ctx.arcTo(x, y + h, x + rad, y + h, rad);
          ctx.lineTo(x + w - rad, y + h); ctx.arcTo(x + w, y + h, x + w, y + h - rad, rad); ctx.lineTo(x + w, y + rad); ctx.arcTo(x + w, y, x + w - rad, y, rad);
          ctx.closePath();
        });
        ctx.fillStyle = 'rgba(30,12,40,0.58)';
        ctx.fill('evenodd');
        R.spotlight.forEach(function (q) { ringAt(q.r, q.c, '#ffc93c', 3, 1.5, 0.6 + 0.4 * Math.sin(clock.t / 160), q.w, q.h); });
      }
      if (R.guide) drawGuide(R.guide);
      // selección y cursor
      if (R.sel) {
        var pulse = 0.75 + 0.25 * Math.sin(clock.t / 130);
        ringAt(R.sel.r, R.sel.c, 'rgba(255,201,60,0.6)', 10, -1, pulse);
        ringAt(R.sel.r, R.sel.c, '#ffc93c', 4, 0.5, 1);
        ringAt(R.sel.r, R.sel.c, '#ffffff', 2, 3.5, 1);
      }
      if (R.cursor) {
        ctx.setLineDash([6, 4]);
        ringAt(R.cursor.r, R.cursor.c, '#2b1630', 3, 2, 0.9);
        ctx.setLineDash([]);
        ringAt(R.cursor.r, R.cursor.c, '#ffffff', 1.5, 4, 0.9);
      }
    }
    function requestDraw() { kick(); }

    // Fila de la casilla más baja de una columna en el modelo visual (donde sale una ficha); -1 si no hay
    function lowestSlotV(c) {
      for (var r = R.rows - 1; r >= 0; r--) {
        var v = cellV(r, c);
        if (!v || v.b || v.fzPart) continue;
        var p = v.pid != null ? R.pieces[v.pid] : null;
        if (p && p.frost) continue;
        return r;
      }
      return -1;
    }
    // Marcas de salida (niveles con fichas): un chevrón dorado bajo la casilla más baja de cada columna
    function chevron(x, y, w, h, fill, alpha) {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - h / 2); ctx.lineTo(x, y + h / 2); ctx.lineTo(x + w / 2, y - h / 2);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(4, h * 0.95); ctx.strokeStyle = '#2b1630'; ctx.stroke();
      ctx.lineWidth = Math.max(2, h * 0.5); ctx.strokeStyle = fill; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    function drawExits() {
      var cs = R.cell, w = cs * 0.34, h = cs * 0.13;
      for (var c = 0; c < R.cols; c++) {
        var r = lowestSlotV(c);
        if (r < 0) continue;
        var x = X(c) + cs / 2, y = Y(r + 1) - h * 0.15;
        chevron(x, y, w, h, '#ffc93c', 0.95);
      }
    }
    // Flecha punteada del tutorial de fichas: de la ficha hasta la salida de su columna
    function drawGuide(gd) {
      var cs = R.cell, x = X(gd.c) + cs / 2, y0 = Y(gd.r0) + cs * 0.92, y1 = Y(gd.r1 + 1) - cs * 0.12;
      if (y1 <= y0) return;
      var t = (clock.t / 40) % 14;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.setLineDash([cs * 0.16, cs * 0.14]);
      ctx.lineDashOffset = -t;
      ctx.lineWidth = Math.max(5, cs * 0.13); ctx.strokeStyle = '#2b1630';
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1 - cs * 0.12); ctx.stroke();
      ctx.lineWidth = Math.max(3, cs * 0.075); ctx.strokeStyle = '#ffe680';
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1 - cs * 0.12); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      chevron(x, y1, cs * 0.42, cs * 0.17, '#ffe680', 1);
    }

    // Parpadeo ocioso de una ficha al azar
    function blinkRandom() {
      var ids = Object.keys(R.pieces);
      if (!ids.length) return;
      var p = R.pieces[ids[(Math.random() * ids.length) | 0]];
      if (!p || p.type === 'copa' || p.type === 'token' || p.frost) return;
      p.blinkUntil = clock.t + 150;
      kick();
      setTimeout(kick, 170);
    }

    // ---------- API ----------
    R.now = now; R.tween = tween; R.after = after; R.wait = wait; R.flush = flush; R.cancelAll = cancelAll;
    R.setPaused = setPaused; R.freeze = function (ms) { freezeLeft = Math.max(freezeLeft, ms || 0); kick(); }; R.isPaused = function () { return clock.paused; };
    R.layout = layout; R.X = X; R.Y = Y; R.cellCenter = cellCenter; R.cellAt = cellAt;
    R.load = load; R.cellV = cellV; R.pieceAt = pieceAt; R.removePiece = removePiece; R.addPiece = addPiece;
    R.removeBlock = removeBlock; R.setBlock = setBlock; R.removeFreezer = removeFreezer; R.computeStatic = computeStatic; R.diff = diff;
    R.ensure = ensure; R.rerasterize = rerasterize; R.sprite = sprite; R.keysFor = keysFor; R.pieceKey = pieceKey; R.blockKey = blockKey;
    R.draw = draw; R.requestDraw = requestDraw; R.kick = kick; R.blinkRandom = blinkRandom;
    R.busyAnim = function () { return tweens.length > 0 || timers.length > 0; };
    return R;
  }

  Cocardo.Render = { create: create, EASE: EASE, FLAVOR: FLAVOR };
})();
