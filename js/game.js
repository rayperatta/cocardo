/* Cocardo: ¡Rescate Helado! — Pantalla de juego (HUD + tablero + ayudas + reproductor de pasos).
 * Dueño: Board. Contrato: docs/ARQUITECTURA.md §11-§12. Diseño: docs/DISENO.md §2, §5, §6, §10, §12, §13.
 * Usa: Cocardo.Engine (puro), Cocardo.Render (canvas), Cocardo.FX (partículas), Cocardo.Art, Cocardo.Story,
 *      Cocardo.Audio, Cocardo.Save. Todo lo que no exista se reemplaza por valores por defecto (nunca rompe). */
(function () {
  'use strict';
  var Cocardo = (typeof window !== 'undefined' ? (window.Cocardo = window.Cocardo || {}) : {});

  // ---------- textos y datos por defecto ----------
  var NAMES = {
    cocardo: 'Cocardo', lima: 'Lima', cereza: 'Cherry', pina: 'Don Piña', banano: 'Banano', banana: 'Banana', fresa: 'Fresa',
    durazna: 'Durazna', uva: 'Uva', naranja: 'Naranja', limon: 'Limón', policia_fresa: 'La oficial', policia_sandia: 'El oficial Sandía',
    guardaespaldas: 'El guardaespaldas', brocoli: 'El repartidor', reportera: 'La reportera',
  };
  var CASCADE_TEXT = ['', '', '¡Rico!', '¡Delicioso!', '¡Escandaloso!', '¡DRAMÁTICO!', '¡¡TELENOVELA!!'];
  var TAUNTS = {
    cocardo: {
      start: ['¡Hoy toca helado de todo!', '¡Nadie descongela a mis… sabores!', '¡Entran frutas, salen sabores!'],
      low: ['¡Se te derrite el tiempo!', '¡Ya casi es mío, ayudante!'],
      act: ['¡Fresquito, fresquito!', '¡A congelar se ha dicho!', '¡Jajaja! ¡Al congelador!'],
    },
    cereza: {
      start: ['Esta heladería es mía, cariño.', '¿Pruebas? ¿Qué pruebas?'],
      low: ['Ay, qué fresquito te está quedando todo.', 'Tic, tac, mi amor…'],
      act: ['Una cajita más, cariño.', '¡Al inventario!', 'Ji, ji, ji…'],
    },
  };
  var RESCUE_LINES = {
    lima: '¡Libre! ¡Ese coco me encerró!', fresa: '¡Gracias! ¡Ya siento mis semillitas!', durazna: '¡Siento las pelusitas otra vez!',
    naranja: '¡Libre! ¡Y con toda mi pulpa!', uva: '¡Libre otra vez! ¡Y para siempre!', banana: '¡Gracias! ¿Y mi hermano?',
  };
  var TEACH = {
    swap: 'Desliza una fruta para juntar 3 iguales.',
    paleta: '¡Junta 4 en línea y sale una Paleta!',
    bomba: '¿Una L o una T? ¡Bomba de Coco!',
    hielo: 'Combina junto al hielo para romperlo.',
    copa: '¡5 en línea: Copa Arcoíris! Cámbiala con cualquier fruta.',
    hp2: 'Este hielo es más grueso: ¡pégale dos veces!',
    pedido: '¡Pedido de Piña! Junta todos los sabores del ticket.',
    cucharon: 'Toca el Cucharón y luego una ficha: ¡la rompe sin gastar movimiento!',
    escarcha: 'La escarcha no deja mover la fruta. ¡Combínala para soltarla!',
    villano: 'Cocardo congela una fruta cada pocos turnos. ¡Mira su cuenta!',
    congelador: 'Combina junto al congelador para romperlo y rescatar a tu amiga.',
    chorro: 'El Chorro de Lima limpia una fila entera. ¡Tócalo y elige una fila!',
    colores6: '¡Seis sabores! Busca bien tus jugadas.',
    batido: '¿Atorado? El Batido de Fresa revuelve todo el tablero.',
    cajas: 'Las cajas de Cherry se rompen como el hielo: ¡combina a su lado!',
    cereza: 'Cherry convierte frutas en cajas. ¡Ojo con su cuenta!',
    dosvillanos: '¡Dos villanos! Vigila las dos cuentas.',
    ficha: '¡Lleva a Uva hasta abajo para que escape!',
    pruebas: 'Baja las pruebas hasta el fondo para que Banano las reúna.',
  };
  var BOOSTERS = [
    { type: 'cucharon', name: 'Cucharón', unlock: 7, prompt: 'Toca una ficha o un bloque' },
    { type: 'chorro', name: 'Chorro', unlock: 11, prompt: 'Toca una fila para limpiarla' },
    { type: 'batido', name: 'Batido', unlock: 14, prompt: 'Toca el tablero para revolver' },
  ];
  var ZONES = ['heladeria', 'mansion', 'trastienda', 'noche', 'cherry', 'congelador'];
  var GOAL_LABEL = { ice: 'Hielo', crate: 'Cajas', rescue: 'Rescate', token: 'Fichas', boss: 'Congelador' };
  var COLOR_NAME = { L: 'Lima', F: 'Fresa', B: 'Banana', U: 'Uva', N: 'Naranja', D: 'Durazna' };

  // ---------- utilidades ----------
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function Art() { return Cocardo.Art || {}; }
  function Story() { return Cocardo.Story || {}; }
  function Engine() { return Cocardo.Engine; }
  function safe(fn, dflt) { try { var v = fn(); return (v === undefined || v === null) ? dflt : v; } catch (e) { return dflt; } }
  function pick(arr) { return arr && arr.length ? arr[(Math.random() * arr.length) | 0] : ''; }
  function sfx(name, o) { try { if (Cocardo.Audio && Cocardo.Audio.play) Cocardo.Audio.play(name, o || {}); } catch (e) { /* nada */ } }
  function unlockAudio() { try { if (Cocardo.Audio && Cocardo.Audio.unlock) Cocardo.Audio.unlock(); } catch (e) { /* nada */ } }
  var MEM = {
    boosters: { cucharon: 0, chorro: 0, batido: 0 }, boostersUnlocked: { cucharon: false, chorro: false, batido: false },
    seen: {}, settings: { sound: true, vibra: true, motion: 'auto' },
  };
  function data() {
    var d = safe(function () { return Cocardo.Save && Cocardo.Save.get ? Cocardo.Save.get() : null; }, null);
    if (!d) d = MEM;
    if (!d.boosters) d.boosters = { cucharon: 0, chorro: 0, batido: 0 };
    if (!d.boostersUnlocked) d.boostersUnlocked = { cucharon: false, chorro: false, batido: false };
    if (!d.seen) d.seen = {};
    return d;
  }
  function persist() { try { if (Cocardo.Save && Cocardo.Save.save) Cocardo.Save.save(); } catch (e) { /* nada */ } }
  function vibrate(ms) {
    try {
      var s = data().settings;
      if (s && s.vibra === false) return;
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
    } catch (e) { /* nada */ }
  }
  function reducedMotion() {
    try {
      if (document.body && document.body.classList.contains('reduced-motion')) return true;
      var m = data().settings && data().settings.motion;
      if (m && m !== 'auto') return false;   // la Shell decide con body.reduced-motion
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }
  function charName(id) { return safe(function () { return Art().characters[id].name; }, NAMES[id] || id); }
  function portraitSvg(who, mood, o) {
    var s = safe(function () { return Art().portrait(who, mood || 'normal', o || {}); }, '');
    if (s) return s;
    var col = { cocardo: '#7a4a2a', cereza: '#d61f4b', pina: '#ffc93c', banano: '#ffe266', limon: '#f4e04a', lima: '#8fd63a',
      fresa: '#ff3b55', banana: '#ffe266', uva: '#9a4ed6', naranja: '#ff8c1f', durazna: '#ffb07a' }[who] || '#ff6fa5';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="104" r="78" fill="' + col +
      '" stroke="#2b1630" stroke-width="8"/><circle cx="76" cy="96" r="9" fill="#2b1630"/><circle cx="124" cy="96" r="9" fill="#2b1630"/>' +
      '<path d="M70 132q30 22 60 0" fill="none" stroke="#2b1630" stroke-width="8" stroke-linecap="round"/></svg>';
  }
  function icon(name) { return safe(function () { return Art().icon(name); }, ''); }
  function same(a, b) { return !!a && !!b && a.r === b.r && a.c === b.c; }
  function adjacent(a, b) { return !!a && !!b && Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1; }
  function fmt(n) { n = Math.round(n); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  // ---------- estado del módulo ----------
  var G = {
    mounted: false, root: null, els: {}, R: null, fx: null,
    level: null, opts: {}, state: null, seed: 0, daily: false,
    phase: 'idle', paused: false, gen: 0,
    turns: [], sel: null, cursor: null, press: null, armed: null,
    tutorial: null, hintTimer: 0, blinkTimer: 0, player: null,
    villains: [], goals: [], movesShown: null, scoreShown: 0, scoreTarget: 0,
    lowTaunt: false, boardOff: { x: 0, y: 0 }, desyncs: 0, lastDiff: null, lastShake: '',
    bubbleTimer: 0, toastTimer: 0, endTimer: 0, ro: null,
  };

  // =====================================================================
  //  Montaje
  // =====================================================================
  function mount(container) {
    if (G.mounted) return;
    if (!container) throw new Error('Cocardo.Game.mount: falta el contenedor');
    try { if (getComputedStyle(container).position === 'static') container.style.position = 'relative'; } catch (e) { /* nada */ }
    var root = el('div', 'cg-root');
    root.innerHTML =
      '<div class="cg-bg"></div>' +
      '<header class="cg-hud">' +
      '  <div class="cg-topbar">' +
      '    <button class="cg-pause" type="button" aria-label="Pausa">' + icon('pause') + '</button>' +
      '    <div class="cg-title"><span class="cg-lvl"></span><span class="cg-lvname"></span></div>' +
      '    <div class="cg-score" aria-label="Puntos"><span class="cg-score-n">0</span><small>pts</small></div>' +
      '  </div>' +
      '  <div class="cg-card">' +
      '    <div class="cg-villains"></div>' +
      '    <div class="cg-goals"></div>' +
      '    <div class="cg-moves" aria-live="polite"><span class="cg-moves-n">0</span><span class="cg-moves-l">movs</span></div>' +
      '  </div>' +
      '</header>' +
      '<main class="cg-stage">' +
      '  <div class="cg-board-wrap">' +
      '    <canvas class="cg-board" role="img" aria-label="Tablero de frutas"></canvas>' +
      '    <div class="cg-peek" aria-hidden="true"></div>' +
      '  </div>' +
      '</main>' +
      '<footer class="cg-boosters"></footer>' +
      '<canvas class="cg-fx" aria-hidden="true"></canvas>' +
      '<div class="cg-overlay" aria-live="polite"></div>';
    container.appendChild(root);
    G.root = root;
    var q = function (s) { return root.querySelector(s); };
    G.els = {
      bg: q('.cg-bg'), hud: q('.cg-hud'), pause: q('.cg-pause'), lvl: q('.cg-lvl'), lvname: q('.cg-lvname'),
      score: q('.cg-score-n'), card: q('.cg-card'), villains: q('.cg-villains'), goals: q('.cg-goals'), moves: q('.cg-moves'),
      movesN: q('.cg-moves-n'), stage: q('.cg-stage'), wrap: q('.cg-board-wrap'), canvas: q('.cg-board'), peek: q('.cg-peek'),
      boosters: q('.cg-boosters'), fxc: q('.cg-fx'), overlay: q('.cg-overlay'),
    };
    G.fx = Cocardo.FX.create(G.els.fxc);
    G.R = Cocardo.Render.create(G.els.canvas, { fx: G.fx });
    G.R.onFrame = onFrame;
    buildBoosterBar();

    var cv = G.els.canvas;
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onCancel);
    cv.addEventListener('lostpointercapture', onCancel);
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    root.addEventListener('pointerdown', onRootDown, true);
    G.els.pause.addEventListener('click', function (e) {
      if (e.detail > 0) G.els.pause.blur();
      unlockAudio(); sfx('tap');
      if (G.phase !== 'idle' && G.phase !== 'done' && G.opts.onPause) G.opts.onPause();
    });
    window.addEventListener('keydown', onKey);
    if (typeof ResizeObserver === 'function') {
      G.ro = new ResizeObserver(function () { if (G.phase !== 'idle') resize(); });
      G.ro.observe(root);
    }
    G.mounted = true;
  }

  // =====================================================================
  //  Inicio de nivel
  // =====================================================================
  function start(level, opts) {
    if (!G.mounted) throw new Error('Cocardo.Game.start: llama primero a mount()');
    stopInternal();
    var gen = ++G.gen;
    G.level = level; G.opts = opts || {};
    G.seed = (G.opts.seed !== undefined && G.opts.seed !== null) ? G.opts.seed : ((Math.random() * 4294967296) >>> 0);
    G.daily = !!(G.opts.daily || level.daily);
    G.state = Engine().createGame(level, G.seed);
    G.turns = []; G.lowTaunt = false; G.desyncs = 0; G.lastDiff = null;
    G.phase = 'intro'; G.paused = false; G.sel = null; G.cursor = null; G.armed = null; G.press = null;
    G.scoreShown = 0; G.scoreTarget = 0; G.movesShown = null;
    G.R.setPaused(false);
    G.fx.setReduced(reducedMotion());
    G.root.classList.remove('cg-danger', 'cg-paused', 'cg-ended', 'cg-won');
    G.root.classList.toggle('cg-daily', G.daily);
    G.els.canvas.style.opacity = '0';
    setBackground();
    buildHud();
    updateBoosters();
    resize();
    G.R.load(G.state);
    G.R.fzBadge = null;
    updateVillainBadges();
    var keys = G.R.keysFor(G.state, level);
    var t0 = now();
    G.R.ensure(keys.essential).then(function () {
      if (gen !== G.gen) return;
      G.loadMs = Math.round(now() - t0);
      var rest = G.R.ensure(keys.rest).then(function () { G.loadAllMs = Math.round(now() - t0); });
      G.spritesReady = rest;
      intro(gen);
    });
  }
  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

  function setBackground() {
    var ch = G.level.chapter || Math.min(6, Math.max(1, Math.ceil((G.level.id || 1) / 5)));
    var zones = safe(function () { return Art().zones; }, ZONES) || ZONES;
    var zone = zones[ch - 1] || 'heladeria';
    if (G.bgZone === zone) return;
    G.bgZone = zone;
    var svg = safe(function () { return Art().background(zone); }, '');
    G.els.bg.style.backgroundImage = svg ? 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")' : '';
  }

  // Las piezas caen desde arriba al empezar
  function intro(gen) {
    var R = G.R, red = reducedMotion(), maxT = 0;
    G.els.canvas.style.opacity = '1';
    if (!red) {
      Object.keys(R.pieces).forEach(function (id) {
        var p = R.pieces[id];
        var top = R.colTop[p.c] || 0;
        p.y = top - (R.rows - p.r) - 1.5 - (p.r - top) * 0.15;
        var delay = p.c * 30 + (R.rows - p.r) * 22, dur = 360 + (p.r - p.y) * 18;
        R.tween(p, { y: p.r }, dur, 'out3', delay);
        p.sy = 1; p.sx = 1;
        R.tween(p, { sy: 0.86, sx: 1.1 }, 50, 'out', delay + dur);
        R.tween(p, { sy: 1, sx: 1 }, 110, 'outBack', delay + dur + 50);
        maxT = Math.max(maxT, delay + dur + 160);
      });
      for (var r = 0; r < R.rows; r++) for (var c = 0; c < R.cols; c++) {
        var v = R.cellV(r, c);
        if (v && v.b) { v.b.s = 0.4; v.b.a = 0; R.tween(v.b, { s: 1, a: 1 }, 320, 'outBack', 120 + (r + c) * 25); }
      }
      if (R.fz) { R.fz.s = 0.3; R.fz.a = 0; R.tween(R.fz, { s: 1, a: 1 }, 420, 'outBack', 200); }
      maxT = Math.max(maxT, 650);
    }
    R.kick();
    R.wait(maxT).then(function () {
      if (gen !== G.gen) return;
      G.phase = 'play';
      if (!maybeTutorial()) taunt('start');
      armHint();
      startBlinks();
    });
  }

  // =====================================================================
  //  HUD
  // =====================================================================
  function mainVillain() {
    var lv = G.level || {};
    var v = safe(function () { return Story().villainFor(lv.id); }, null);
    if (v) return v;
    if (lv.freezer && lv.freezer.who) return lv.freezer.who;
    if (lv.villains && lv.villains[0]) return lv.villains[0].who;
    return (lv.id || 1) >= 21 ? 'cereza' : 'cocardo';
  }
  function buildHud() {
    var lv = G.level, E = G.els;
    E.lvl.textContent = G.daily ? 'Reto Diario' : 'Nivel ' + lv.id;
    E.lvname.textContent = lv.name || '';
    E.score.textContent = '0';
    // villanos: el principal primero, luego los del nivel y el dueño del congelador
    var whos = [mainVillain()];
    (G.state.villains || []).forEach(function (v) { if (whos.indexOf(v.who) < 0) whos.push(v.who); });
    if (G.state.freezer && whos.indexOf(G.state.freezer.who) < 0) whos.push(G.state.freezer.who);
    E.villains.innerHTML = '';
    E.villains.classList.toggle('cg-two', whos.length > 1);
    G.villains = whos.map(function (who, k) {
      var box = el('div', 'cg-villain cg-v-' + who + (k ? ' cg-v2' : ''));
      var face = el('div', 'cg-portrait');
      var badges = el('div', 'cg-badges');
      var name = el('div', 'cg-vname', charName(who));
      box.appendChild(face); box.appendChild(name); box.appendChild(badges);
      E.villains.appendChild(box);
      var entry = { who: who, box: box, face: face, badgesEl: badges, mood: null, temp: null, tempUntil: 0, tempTimer: 0, badges: [] };
      (G.state.villains || []).forEach(function (v, i) {
        if (v.who !== who) return;
        var b = el('div', 'cg-badge cg-badge-' + v.act, '<span class="cg-badge-ic">' + icon(v.act === 'crate' ? 'box' : 'snowflake') + '</span><span class="cg-badge-n"></span>');
        b.title = v.act === 'crate' ? 'Turnos para la próxima caja' : 'Turnos para la próxima escarcha';
        badges.appendChild(b);
        entry.badges.push({ i: i, el: b, n: b.querySelector('.cg-badge-n'), last: null });
      });
      return entry;
    });
    G.villains.forEach(function (v) { setMood(v, baseMood(), true); });
    buildGoals();
    setMoves(G.state.movesLeft, true);
  }

  function goalIconSvg(g) {
    var A = Art(), lv = G.level || {};
    return safe(function () {
      switch (g.type) {
        case 'color': return A.tile(g.color, { type: 'n', face: 'normal' });
        case 'ice': return A.ice(1, 1);
        case 'crate': return A.crate();
        case 'rescue': {
          var left = (lv.rescue || []).filter(function (w) { return !G.state || G.state.rescued.indexOf(w) < 0; });
          var who = left[0] || (lv.rescue || ['lima'])[0];
          return A.friend(who, 2, 2);
        }
        case 'token': return A.token((G.state && G.state.tokens && G.state.tokens.skin) || (lv.tokens && lv.tokens.skin) || 'uva');
        case 'boss': {
          var f = G.state && G.state.freezer;
          return A.freezer((f && f.who) || (lv.freezer && lv.freezer.who) || 'cocardo', f ? f.maxHp : 8, f ? f.maxHp : 8);
        }
      }
      return '';
    }, '');
  }
  function goalTitle(g) { return g.type === 'color' ? COLOR_NAME[g.color] : GOAL_LABEL[g.type] || ''; }
  function buildGoals() {
    var E = G.els, goals = G.state.goals;
    E.goals.innerHTML = '';
    G.goals = [];
    var colorIdx = [];
    goals.forEach(function (g, i) { if (g.type === 'color') colorIdx.push(i); });
    var ticket = null, row = null;
    if (colorIdx.length >= 2) {
      ticket = el('div', 'cg-ticket');
      ticket.innerHTML = '<div class="cg-ticket-head"><span class="cg-ticket-face">' + portraitSvg('pina', 'normal') +
        '</span><span class="cg-ticket-title">Pedido de Piña</span></div><div class="cg-ticket-items"></div>';
      row = ticket.querySelector('.cg-ticket-items');
      E.goals.appendChild(ticket);
    }
    E.goals.classList.toggle('cg-has-ticket', !!ticket);
    E.goals.classList.toggle('cg-many', goals.length >= 3 && !ticket);
    E.goals.setAttribute('data-n', String(goals.length));
    goals.forEach(function (g, i) {
      var chip = el('div', 'cg-goal cg-goal-' + g.type);
      chip.title = goalTitle(g);
      chip.innerHTML = '<span class="cg-goal-ic">' + goalIconSvg(g) + '</span><span class="cg-goal-n"></span><span class="cg-goal-ok">' + icon('check') + '</span>';
      ((ticket && g.type === 'color') ? row : E.goals).appendChild(chip);
      var entry = { i: i, el: chip, ic: chip.querySelector('.cg-goal-ic'), n: chip.querySelector('.cg-goal-n'), shown: null };
      G.goals.push(entry);
      setGoal(i, g.remaining, true);
    });
  }
  function setGoal(i, v, silent) {
    var g = G.goals[i];
    if (!g) return;
    if (g.shown === v) return;
    var dec = g.shown !== null && v < g.shown;
    g.shown = v;
    g.n.textContent = String(Math.max(0, v));
    g.el.classList.toggle('cg-done', v <= 0);
    if (dec && !silent) {
      g.el.classList.remove('cg-bump'); void g.el.offsetWidth; g.el.classList.add('cg-bump');
      if (v <= 0) sfx('star', { i: 1 });
    }
    if (G.state && G.state.goals[i] && G.state.goals[i].type === 'rescue') {
      var svg = goalIconSvg(G.state.goals[i]);
      if (svg && v > 0) g.ic.innerHTML = svg;
    }
  }
  function setMoves(n, silent) {
    if (G.movesShown === n) return;
    var prev = G.movesShown;
    G.movesShown = n;
    G.els.movesN.textContent = String(n);
    G.els.moves.classList.toggle('cg-low', n <= 5);
    if (!silent && prev !== null && n < prev) {
      G.els.moves.classList.remove('cg-tick'); void G.els.moves.offsetWidth; G.els.moves.classList.add('cg-tick');
    }
  }
  function setScore(v) { G.scoreTarget = v; G.R.kick(); }

  // ----- villanos: ánimo y cuentas -----
  function progress() {
    var u = safe(function () { return Engine().goalUnits(G.state); }, null);
    if (!u || !u.start) return 0;
    return 1 - u.remaining / u.start;
  }
  function baseMood() {
    var s = G.state;
    if (!s) return 'burlon';
    if (s.status === 'won') return 'llorando';
    if (s.status === 'lost') return 'carcajada';
    return progress() >= 0.7 ? 'nervioso' : 'burlon';
  }
  function setMood(v, mood, force) {
    if (!force && v.mood === mood) return;
    v.mood = mood;
    v.face.innerHTML = portraitSvg(v.who, mood);
    v.box.setAttribute('data-mood', mood);
  }
  function refreshMoods() {
    var t = Date.now();
    G.villains.forEach(function (v) { setMood(v, (v.temp && v.tempUntil > t && G.state.status === 'playing') ? v.temp : baseMood()); });
  }
  function tempMood(who, mood, ms) {
    G.villains.forEach(function (v) {
      if (who && v.who !== who) return;
      v.temp = mood; v.tempUntil = Date.now() + ms;
      clearTimeout(v.tempTimer);
      v.tempTimer = setTimeout(refreshMoods, ms + 20);
    });
    refreshMoods();
    if (mood === 'furioso' || mood === 'carcajada') {
      G.villains.forEach(function (v) {
        if (who && v.who !== who) return;
        v.box.classList.remove('cg-shake'); void v.box.offsetWidth; v.box.classList.add('cg-shake');
      });
    }
  }
  function villainActive(v) {
    var s = G.state;
    if (v.src === 'boss' && (!s.freezer || s.freezer.hp <= 0)) return false;
    return true;
  }
  function updateVillainBadges() {
    var s = G.state, fzN = null;
    G.villains.forEach(function (ve) {
      ve.badges.forEach(function (b) {
        var v = s.villains[b.i];
        if (!v) return;
        var on = villainActive(v);
        b.el.classList.toggle('cg-off', !on);
        b.n.textContent = on ? String(v.counter) : '–';
        b.el.classList.toggle('cg-urgent', on && v.counter === 1);
        if (b.last !== null && b.last !== v.counter) { b.el.classList.remove('cg-bump'); void b.el.offsetWidth; b.el.classList.add('cg-bump'); }
        b.last = v.counter;
        if (v.src === 'boss' && on) fzN = fzN === null ? v.counter : Math.min(fzN, v.counter);
      });
    });
    G.R.fzBadge = fzN !== null ? { n: fzN } : null;
    G.R.kick();
  }
  function villainEntry(who) {
    for (var i = 0; i < G.villains.length; i++) if (G.villains[i].who === who) return G.villains[i];
    return G.villains[0] || null;
  }

  // ----- burbujas, banners, textos -----
  function rootRect() { return G.root.getBoundingClientRect(); }
  function relRect(e) {
    var r = e.getBoundingClientRect(), o = rootRect();
    return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, cx: r.left - o.left + r.width / 2, cy: r.top - o.top + r.height / 2 };
  }
  function boardPt(x, y) { return { x: G.boardOff.x + x, y: G.boardOff.y + y }; }
  function cellPt(r, c) { var p = G.R.cellCenter(r, c); return boardPt(p.x, p.y); }

  function taunt(kind, who) {
    who = who || mainVillain();
    var list = safe(function () { return Story().taunts[who][kind]; }, null) || (TAUNTS[who] || TAUNTS.cocardo)[kind];
    if (!list && kind === 'lose') list = safe(function () { return Story().taunts[who].low; }, null) || (TAUNTS[who] || TAUNTS.cocardo).low;
    if (!list && kind === 'win') list = ['¡Mi sabor estrella!'];
    var txt = pick(list);
    if (!txt) return;
    var ve = villainEntry(who);
    if (!ve) return;
    showBubble(ve.face, txt, kind === 'act' ? 1900 : 2900, who);
  }
  function showBubble(anchor, text, ms, who) {
    var ov = G.els.overlay;
    var old = ov.querySelector('.cg-bubble');
    if (old) old.remove();
    var b = el('div', 'cg-bubble cg-bubble-' + (who || 'x'));
    b.innerHTML = '<b>' + charName(who) + '</b><span></span>';
    b.querySelector('span').textContent = text;
    ov.appendChild(b);
    var a = relRect(anchor), rr = rootRect();
    var wide = G.root.classList.contains('cg-wide');
    var bw = b.offsetWidth, bh = b.offsetHeight, x, y;
    if (wide) { x = a.x + a.w + 10; y = a.cy - bh / 2; b.classList.add('cg-tail-left'); }
    else { x = a.cx - 26; y = a.y + a.h + 10; b.classList.add('cg-tail-up'); }
    x = Math.max(8, Math.min(rr.width - bw - 8, x));
    y = Math.max(8, Math.min(rr.height - bh - 8, y));
    b.style.left = x + 'px'; b.style.top = y + 'px';
    b.style.setProperty('--tail-x', Math.max(14, Math.min(bw - 22, a.cx - x - 8)) + 'px');
    clearTimeout(G.bubbleTimer);
    G.bubbleTimer = setTimeout(function () {
      b.classList.add('cg-out');
      setTimeout(function () { b.remove(); }, 260);
    }, ms);
  }
  function banner(text, sub, cls, ms) {
    var ov = G.els.overlay;
    var b = el('div', 'cg-banner ' + (cls || ''));
    b.innerHTML = '<div class="cg-banner-t"></div>' + (sub ? '<div class="cg-banner-s"></div>' : '');
    b.querySelector('.cg-banner-t').textContent = text;
    if (sub) b.querySelector('.cg-banner-s').textContent = sub;
    var c = boardPt(G.R.side / 2, G.R.side / 2);
    b.style.top = c.y + 'px';
    ov.appendChild(b);
    if (ms) setTimeout(function () { b.classList.add('cg-out'); setTimeout(function () { b.remove(); }, 320); }, ms);
    return b;
  }
  function showCascade(c) {
    var arr = safe(function () { return Story().cascadeText; }, null) || CASCADE_TEXT;
    var txt = arr[Math.min(c, arr.length - 1)];
    if (!txt) return;
    var ov = G.els.overlay, old = ov.querySelector('.cg-cascade');
    if (old) old.remove();
    var e = el('div', 'cg-cascade cg-c' + Math.min(c, 6));
    e.textContent = txt;
    var p = boardPt(G.R.side / 2, G.R.side * 0.42);
    e.style.left = p.x + 'px'; e.style.top = p.y + 'px';
    ov.appendChild(e);
    setTimeout(function () { e.remove(); }, 1150);
  }
  function toast(text, ms, cls) {
    var ov = G.els.overlay, old = ov.querySelector('.cg-toast');
    if (old) old.remove();
    var t = el('div', 'cg-toast ' + (cls || ''));
    t.textContent = text;
    var p = boardPt(G.R.side / 2, G.R.side - 8);
    t.style.left = p.x + 'px'; t.style.top = p.y + 'px';
    ov.appendChild(t);
    clearTimeout(G.toastTimer);
    if (ms !== 0) G.toastTimer = setTimeout(function () { t.classList.add('cg-out'); setTimeout(function () { t.remove(); }, 250); }, ms || 1400);
    return t;
  }
  function clearToast() { var t = G.els.overlay.querySelector('.cg-toast'); if (t) t.remove(); }
  function rescuePop(who, r, c) {
    var pt = cellPt(r, c), rr = rootRect();
    var line = safe(function () {
      var S = Story();
      if (S.rescueLines && S.rescueLines[who]) return S.rescueLines[who];
      if (typeof S.rescueLine === 'function') return S.rescueLine(who);
      return null;
    }, null) || RESCUE_LINES[who] || '¡Libre! ¡Gracias!';
    var e = el('div', 'cg-rescue');
    e.innerHTML = '<div class="cg-rescue-face">' + portraitSvg(who, 'feliz') + '</div><div class="cg-rescue-say"><b></b><span></span></div>';
    e.querySelector('b').textContent = charName(who);
    e.querySelector('span').textContent = line;
    G.els.overlay.appendChild(e);
    var size = Math.max(84, Math.min(130, G.R.cell * 2.2));
    e.style.setProperty('--face', size + 'px');
    var x = Math.max(size / 2 + 6, Math.min(rr.width - size / 2 - 6, pt.x));
    e.style.left = x + 'px'; e.style.top = pt.y + 'px';
    var say = e.querySelector('.cg-rescue-say');
    var sw = say.offsetWidth, sx = Math.max(8 - (x - sw / 2), Math.min(rr.width - 8 - (x + sw / 2), 0));
    say.style.setProperty('--shift', sx + 'px');
    if (pt.y < rr.height * 0.4) e.classList.add('cg-below');
    G.fx.hearts(pt.x, pt.y - 10, 12);
    setTimeout(function () { e.classList.add('cg-out'); setTimeout(function () { e.remove(); }, 380); }, 2500);
  }
  function domSprite(svg, cls, x, y, size, ms) {
    var e = el('div', 'cg-sprite ' + (cls || ''), svg);
    e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.width = size + 'px'; e.style.height = size + 'px';
    G.els.overlay.appendChild(e);
    setTimeout(function () { e.remove(); }, ms || 700);
    return e;
  }

  // =====================================================================
  //  Barra de ayudas (boosters)
  // =====================================================================
  function buildBoosterBar() {
    var bar = G.els.boosters;
    bar.innerHTML = '';
    BOOSTERS.forEach(function (b) {
      var btn = el('button', 'cg-boost cg-boost-' + b.type);
      btn.type = 'button';
      btn.setAttribute('data-type', b.type);
      btn.innerHTML = '<span class="cg-boost-ic">' + icon(b.type) + '</span><span class="cg-boost-name">' + b.name + '</span>' +
        '<span class="cg-boost-n">0</span><span class="cg-boost-lock">' + icon('lock') + '</span>';
      btn.addEventListener('click', function (e) { if (e.detail > 0) btn.blur(); onBoosterClick(b.type); });
      bar.appendChild(btn);
    });
  }
  function boosterInfo(type) {
    var d = data();
    return { count: d.boosters[type] || 0, unlocked: !!d.boostersUnlocked[type] };
  }
  function updateBoosters() {
    BOOSTERS.forEach(function (b) {
      var btn = G.els.boosters.querySelector('.cg-boost-' + b.type);
      if (!btn) return;
      var inf = boosterInfo(b.type);
      btn.classList.toggle('cg-locked', !inf.unlocked);
      btn.classList.toggle('cg-empty', inf.unlocked && inf.count <= 0);
      btn.classList.toggle('cg-armed', G.armed === b.type);
      btn.classList.toggle('cg-disabled', G.daily);
      btn.querySelector('.cg-boost-n').textContent = String(inf.count);
      var label = b.name + (inf.unlocked ? ' (' + inf.count + ')' : ' (bloqueado)');
      btn.setAttribute('aria-label', label);
      btn.setAttribute('aria-pressed', G.armed === b.type ? 'true' : 'false');
    });
  }
  function onBoosterClick(type) {
    unlockAudio(); markInput();
    if (G.phase !== 'play' || G.paused) return;
    var b = BOOSTERS.filter(function (x) { return x.type === type; })[0], inf = boosterInfo(type);
    var btn = G.els.boosters.querySelector('.cg-boost-' + type);
    var why = G.daily ? 'Sin ayudas en el Reto Diario' : !inf.unlocked ? 'Se desbloquea en el nivel ' + b.unlock : inf.count <= 0 ? '¡Ya no te quedan!' : null;
    if (why) {
      sfx('invalid'); toast(why);
      if (btn) { btn.classList.remove('cg-no'); void btn.offsetWidth; btn.classList.add('cg-no'); }
      return;
    }
    sfx('tap');
    if (G.armed === type) { disarm(); return; }
    arm(type);
  }
  function arm(type) {
    G.armed = type;
    setSel(null);
    G.els.wrap.classList.add('cg-target');
    G.els.wrap.setAttribute('data-armed', type);
    var b = BOOSTERS.filter(function (x) { return x.type === type; })[0];
    toast(b.prompt, 0, 'cg-toast-armed');
    if (G.tutorial && G.tutorial.booster === type) tutorialText(b.prompt + '.');
    updateBoosters();
  }
  function disarm() {
    if (!G.armed) return;
    G.armed = null;
    G.els.wrap.classList.remove('cg-target');
    G.els.wrap.removeAttribute('data-armed');
    clearToast();
    updateBoosters();
  }
  function useArmed(cell) {
    var type = G.armed;
    if (!type) return;
    if (type !== 'batido' && !cell) { disarm(); return; }
    var res = null;
    try { res = Engine().useBooster(G.state, type, type === 'batido' ? null : cell); } catch (e) { res = null; }
    if (!res || !res.steps) {
      sfx('invalid');
      toast(type === 'cucharon' ? '¡Ahí no! Elige una fruta o un bloque' : '¡Ahí no!', 1200, 'cg-toast-armed');
      if (cell) nudgeCell(cell);
      setTimeout(function () { if (G.armed === type) toast(BOOSTERS.filter(function (x) { return x.type === type; })[0].prompt, 0, 'cg-toast-armed'); }, 1250);
      return;
    }
    var d = data();
    d.boosters[type] = Math.max(0, (d.boosters[type] || 0) - 1);
    persist();
    disarm();
    var tut = G.tutorial;
    if (tut && (tut.booster === type || tut.hud)) endTutorial();
    runTurn(res, 'booster');
  }

  // =====================================================================
  //  Entrada
  // =====================================================================
  function canPlay() { return G.phase === 'play' && !G.paused; }
  function markInput() { clearHint(); armHint(); }
  function evPt(e) {
    var rect = G.els.canvas.getBoundingClientRect();
    var k = rect.width ? G.R.side / rect.width : 1;
    var x = (e.clientX - rect.left) * k, y = (e.clientY - rect.top) * k;
    var cell = G.R.cellAt(x, y);
    if (cell && !G.R.cellV(cell.r, cell.c)) cell = null;
    return { x: x, y: y, cell: cell };
  }
  function onRootDown(e) {
    unlockAudio();
    if (G.phase === 'hf') { skipHF(); e.stopPropagation(); e.preventDefault(); return; }
    if (G.phase === 'end' && G.endSkip) { G.endSkip(); e.stopPropagation(); e.preventDefault(); }
    var b = G.els.overlay.querySelector('.cg-bubble');
    if (b && !e.target.closest('.cg-boost')) b.classList.add('cg-out');
  }
  function onDown(e) {
    if (e.button !== undefined && e.button > 0) return;
    e.preventDefault();
    markInput();
    if (!canPlay()) return;
    var pt = evPt(e);
    G.press = { id: e.pointerId, x: pt.x, y: pt.y, cell: pt.cell, fired: false };
    try { G.els.canvas.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    var p = pt.cell && G.R.pieceAt(pt.cell.r, pt.cell.c);
    if (p && !G.armed && !p.frost) { G.pressed = p; G.R.tween(p, { s: 1.08 }, 70, 'out'); }
  }
  function releasePressed() {
    if (G.pressed) { var p = G.pressed; G.pressed = null; if (G.R.pieces[p.id]) G.R.tween(p, { s: 1 }, 90, 'out'); }
  }
  function onMove(e) {
    var pr = G.press;
    if (!pr || pr.id !== e.pointerId || pr.fired) return;
    var pt = evPt(e), dx = pt.x - pr.x, dy = pt.y - pr.y, thr = Math.max(12, 0.3 * G.R.cell);
    if (Math.abs(dx) < thr && Math.abs(dy) < thr) return;
    pr.fired = true;
    releasePressed();
    if (!canPlay() || G.armed || !pr.cell) return;
    var b = Math.abs(dx) > Math.abs(dy) ? { r: pr.cell.r, c: pr.cell.c + (dx > 0 ? 1 : -1) } : { r: pr.cell.r + (dy > 0 ? 1 : -1), c: pr.cell.c };
    setSel(null);
    trySwap(pr.cell, b);
  }
  function onUp(e) {
    var pr = G.press;
    if (!pr || pr.id !== e.pointerId) return;
    G.press = null;
    releasePressed();
    if (pr.fired || !canPlay()) return;
    onTapCell(pr.cell);
  }
  function onCancel(e) {
    if (G.press && (!e || e.pointerId === G.press.id)) { G.press = null; releasePressed(); }
  }
  function setSel(cell) {
    var R = G.R;
    var old = G.sel && R.pieceAt(G.sel.r, G.sel.c);
    if (old && (!cell || !same(cell, G.sel))) R.tween(old, { s: 1 }, 110, 'out');
    G.sel = cell ? { r: cell.r, c: cell.c } : null;
    R.sel = G.sel;
    var p = G.sel && R.pieceAt(G.sel.r, G.sel.c);
    if (p) R.tween(p, { s: 1.1 }, 140, 'outBack');
    R.kick();
  }
  function onTapCell(cell) {
    if (G.armed) { useArmed(cell); return; }
    if (!cell) { setSel(null); return; }
    var p = G.R.pieceAt(cell.r, cell.c);
    if (!G.sel) {
      if (p && !p.frost) { setSel(cell); sfx('tap'); }
      else if (p) nudgeCell(cell);
      return;
    }
    if (same(G.sel, cell)) { setSel(null); return; }
    if (adjacent(G.sel, cell)) { var a = G.sel; setSel(null); trySwap(a, cell); return; }
    if (p && !p.frost) { setSel(cell); sfx('tap'); } else setSel(null);
  }
  function inBoard(q) { return !!q && q.r >= 0 && q.c >= 0 && q.r < G.state.rows && q.c < G.state.cols; }
  // Sacudida corta de una ficha (escarcha, objetivo inválido)
  function nudgeCell(cell) {
    var p = G.R.pieceAt(cell.r, cell.c);
    var obj = p || (G.R.cellV(cell.r, cell.c) || {}).b;
    if (!obj) return;
    G.R.tween(obj, { ox: 0.08 }, 45, 'out');
    G.R.tween(obj, { ox: -0.08 }, 70, 'inOut', 45);
    G.R.tween(obj, { ox: 0 }, 60, 'out', 115);
    if (p && p.frost) { sfx('frost'); G.R.tween(p, { flash: 0.6 }, 60, 'out'); G.R.tween(p, { flash: 0 }, 200, 'out', 60); }
  }

  function trySwap(a, b) {
    if (!canPlay() || !inBoard(a)) return false;
    var pa = G.R.pieceAt(a.r, a.c);
    if (!pa) return false;
    if (G.tutorial && G.tutorial.move) {
      var m = G.tutorial.move;
      if (!((same(m.a, a) && same(m.b, b)) || (same(m.a, b) && same(m.b, a)))) { tutorialNudge(); return false; }
    }
    clearHint();
    if (pa.frost) { nudgeCell(a); return false; }
    var res = Engine().applySwap(G.state, a, b);
    if (!res.turnInfo || !res.turnInfo.valid) { playInvalid(a, b); return false; }
    G.turns.push(res.turnInfo);
    runTurn(res, 'swap');
    return true;
  }
  function playInvalid(a, b) {
    var R = G.R, gen = G.gen;
    G.phase = 'resolve';
    sfx('invalid');
    var pa = R.pieceAt(a.r, a.c), pb = inBoard(b) ? R.pieceAt(b.r, b.c) : null, d = 120, end = 2 * d;
    if (pa && pb && !pb.frost) {
      pa.z = 1;
      R.tween(pa, { x: b.c, y: b.r }, d, 'inOut');
      R.tween(pa, { x: a.c, y: a.r }, d, 'inOut', d, function () { pa.z = 0; });
      R.tween(pb, { x: a.c, y: a.r }, d, 'inOut');
      R.tween(pb, { x: b.c, y: b.r }, d, 'inOut', d);
    } else if (pa) {
      var dx = (b.c - a.c) * 0.28, dy = (b.r - a.r) * 0.28;
      R.tween(pa, { ox: dx, oy: dy }, d * 0.8, 'out');
      R.tween(pa, { ox: 0, oy: 0 }, d, 'outBack', d * 0.8);
      end = d * 1.8;
    }
    R.wait(end).then(function () {
      if (gen !== G.gen) return;
      if (G.phase === 'resolve') G.phase = 'play';
      armHint();
    });
  }

  // ----- teclado -----
  function onKey(e) {
    if (!G.mounted || G.phase === 'idle' || G.phase === 'done') return;
    if (!G.root.offsetParent && G.root.getClientRects().length === 0) return;   // pantalla oculta
    var t = e.target && e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    var k = e.key;
    if (k === 'Escape') {
      if (G.armed) { disarm(); e.preventDefault(); return; }
      if (!G.paused && G.opts.onPause) { e.preventDefault(); G.opts.onPause(); }
      return;
    }
    if (G.paused) return;
    if (k === 'm' || k === 'M') { toggleMute(); return; }
    var DIRS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    var isAct = k === ' ' || k === 'Enter' || k === 'Spacebar';
    if (!DIRS[k] && !isAct) return;
    e.preventDefault();
    unlockAudio();
    if (G.phase === 'hf' && isAct) { skipHF(); return; }
    if (G.phase === 'end' && isAct && G.endSkip) { G.endSkip(); return; }
    markInput();
    if (!canPlay()) return;
    var center = { r: Math.floor(G.state.rows / 2), c: Math.floor(G.state.cols / 2) };
    if (!G.cursor) { setCursor(G.sel || center); return; }
    if (DIRS[k]) {
      var d = DIRS[k];
      if (G.sel) {
        var a = G.sel, nb = { r: a.r + d[0], c: a.c + d[1] };
        setSel(null);
        if (inBoard(nb)) { setCursor(nb); trySwap(a, nb); }
        return;
      }
      var n = { r: G.cursor.r + d[0], c: G.cursor.c + d[1] };
      if (inBoard(n)) setCursor(n);
    } else onTapCell(G.R.cellV(G.cursor.r, G.cursor.c) ? G.cursor : null);
  }
  function setCursor(c) { G.cursor = c ? { r: c.r, c: c.c } : null; G.R.cursor = G.cursor; G.R.kick(); }
  function toggleMute() {
    try {
      var A = Cocardo.Audio;
      if (!A || !A.setMuted) return;
      var m = !A.isMuted();
      A.setMuted(m);
      var d = data();
      if (d.settings) d.settings.sound = !m;
      persist();
      toast(m ? 'Sonido apagado' : 'Sonido encendido', 1000);
    } catch (e) { /* nada */ }
  }

  // ----- pista -----
  function armHint() {
    clearTimeout(G.hintTimer);
    if (G.phase !== 'play' || G.paused) return;
    G.hintTimer = setTimeout(showHint, 6000);
  }
  function showHint() {
    if (G.phase !== 'play' || G.paused || G.armed || (G.tutorial && G.tutorial.move)) return;
    var h = safe(function () { return Engine().hint(G.state); }, null);
    if (!h) return;
    G.R.hint = { a: h.a, b: h.b, t0: G.R.now() };
    G.R.kick();
    showPeeker(h);
  }
  function clearHint() {
    clearTimeout(G.hintTimer);
    if (G.R && G.R.hint) { G.R.hint = null; G.R.kick(); }
    hidePeeker();
  }
  // La cabeza se asoma por detrás del tablero: por un costado si hay lugar, si no por el borde de arriba, si no por encima del borde.
  function showPeeker(h) {
    var who = safe(function () { return Story().hintPeeker(G.level.id); }, null) || 'limon';
    var R = G.R, pk = G.els.peek;
    var midC = (h.a.c + h.b.c) / 2, midR = (h.a.r + h.b.r) / 2;
    var size = Math.round(Math.max(52, Math.min(96, R.cell * 1.35)));
    var st = relRect(G.els.stage), bd = relRect(G.els.canvas), rr = rootRect();
    var sideRoom = Math.min(bd.x, rr.width - (bd.x + bd.w)), above = bd.y - st.y;
    var mode, side = midC < R.cols / 2 ? 'right' : 'left';
    if (sideRoom >= size * 0.6) mode = 'side';
    else if (above >= size * 0.5) mode = 'top';
    else mode = 'over';
    pk.innerHTML = '<div class="cg-peek-face">' + portraitSvg(who, 'sorprendido') + '</div><div class="cg-peek-say">¡Psst!</div>';
    pk.className = 'cg-peek cg-peek-' + (mode === 'top' ? 'top' : side) + ' cg-peek-' + mode;
    pk.style.width = size + 'px'; pk.style.height = size + 'px';
    if (mode === 'top') {
      var x = R.X(midC) + R.cell / 2 - size / 2;
      pk.style.left = Math.round(Math.max(4, Math.min(R.side - size - 4, x))) + 'px';
      pk.style.top = '';
    } else {
      pk.style.left = '';
      pk.style.top = Math.round(R.Y(midR) + R.cell / 2 - size / 2) + 'px';
    }
    void pk.offsetWidth;
    pk.classList.add('cg-in');
  }
  function hidePeeker() { if (G.els.peek) G.els.peek.classList.remove('cg-in'); }

  // parpadeos ociosos
  function startBlinks() {
    clearInterval(G.blinkTimer);
    G.blinkTimer = setInterval(function () {
      if (G.paused || G.phase === 'idle' || G.phase === 'done') return;
      if (Math.random() < 0.55) G.R.blinkRandom();
    }, 420);
  }

  // =====================================================================
  //  Turnos
  // =====================================================================
  function runTurn(res, kind) {
    var gen = G.gen;
    G.phase = 'resolve';
    disarm();
    setSel(null);
    var prev = G.state;
    G.state = res.state;
    var pc = { prev: prev, speed: 1, hf: false, cancelled: false };
    G.player = pc;
    return playSteps(res.steps, pc).then(function () {
      if (gen !== G.gen || pc.cancelled) return;
      finishTurn(kind);
    }, function (err) {
      if (typeof console !== 'undefined') console.error(err);
      if (gen !== G.gen) return;
      G.R.flush(); G.R.load(G.state);
      finishTurn(kind);
    });
  }
  function playSteps(steps, pc) {
    pc.goals = pc.prev.goals.map(function (g) { return g.remaining; });
    var i = 0;
    function next() {
      if (pc.cancelled || i >= steps.length) return Promise.resolve();
      var st = steps[i++];
      return playStep(st, pc).then(next);
    }
    return next();
  }

  function syncCheck() {
    var d = G.R.diff(G.state).filter(function (s) { return s.indexOf('not at rest') < 0; });
    if (d.length) {
      G.desyncs++; G.lastDiff = d;
      if (Cocardo.debugEnabled && typeof console !== 'undefined') console.warn('Cocardo.Game: tablero resincronizado', d);
      G.R.load(G.state);
    }
  }

  function finishTurn(kind) {
    syncCheck();
    var s = G.state;
    setMoves(s.movesLeft);
    setScore(s.score);
    // los contadores quedan exactos cuando terminan de llegar los íconos voladores
    var gen = G.gen;
    G.R.after(620, function () { if (gen === G.gen) G.state.goals.forEach(function (g, i) { setGoal(i, g.remaining); }); });
    updateVillainBadges();
    refreshMoods();
    if (G.tutorial && (G.tutorial.move || G.tutorial.hud || kind === 'swap')) endTutorial();
    if (s.status === 'won') { winSeq(); return; }
    if (s.status === 'lost') { loseSeq(); return; }
    G.phase = 'play';
    if (kind === 'swap') {
      if (s.movesLeft === 5 && !G.lowTaunt) { G.lowTaunt = true; taunt('low'); }
      if (s.movesLeft <= 3) sfx('heartbeat');
      var tick = s.villains.some(function (v) { return v.counter === 1 && villainActive(v); });
      if (tick) sfx('tick');
    }
    G.root.classList.toggle('cg-danger', s.movesLeft <= 3);
    armHint();
  }

  // =====================================================================
  //  Reproductor de pasos (animación de los eventos del motor)
  // =====================================================================
  function flavorColor(k) { return (Cocardo.Render && Cocardo.Render.FLAVOR[k]) || '#ffffff'; }

  function playStep(step, pc) {
    var R = G.R, fx = G.fx, cs = R.cell, red = reducedMotion();
    var f = pc.speed * (step.cascade >= 4 ? 0.7 : 1);
    function D(ms) { return ms * f; }
    var ev = step.events || [], end = 0, src = null, last = 0, sources = [], once = {};
    var fallEnd = {};
    if (typeof step.movesLeft === 'number') setMoves(step.movesLeft);

    function center(r, c) { return R.cellCenter(r, c); }
    function rootC(r, c) { return cellPt(r, c); }
    function playOnce(name, o) { if (once[name]) return; once[name] = 1; sfx(name, o); }
    // retraso de un golpe según la fuente activa (rayo, onda, combo, ayuda)
    function delayFor(r, c) {
      if (!src) return 0;
      var dr = Math.abs(r - src.r), dc = Math.abs(c - src.c);
      switch (src.kind) {
        case 'ph': return D(40 + dc * 24);
        case 'pv': return D(40 + dr * 24);
        case 'bomba': return D(60 + Math.max(dr, dc) * 30);
        case 'copa': return D(210);
        case 'combo': return D(70 + Math.max(dr, dc) * 26);
        case 'combocopa': return D(120);
        case 'cucharon': return D(190);
        case 'chorro': return D(60 + c * 30);
        default: return D(60);
      }
    }
    function pop(p, d, dur) {
      p.face = 'happy';
      R.removePiece(p.id, d + dur + 20);
      R.tween(p, { s: 1.2, flash: 0.35 }, dur * 0.32, 'out', d);
      R.tween(p, { s: 0, a: 0, flash: 0 }, dur * 0.68, 'in', d + dur * 0.32);
    }

    var i = 0;
    while (i < ev.length) {
      var e = ev[i];
      // ----- caídas y apariciones (dos fases: levantar todas y luego colocar) -----
      if (e.t === 'fall' || e.t === 'spawn') {
        var batch = [];
        while (i < ev.length && (ev[i].t === 'fall' || ev[i].t === 'spawn')) batch.push(ev[i++]);
        var lifted = [];
        batch.forEach(function (x) {
          if (x.t !== 'fall') return;
          var p = R.pieces[x.id];
          if (!p) return;
          var v = R.cellV(x.from.r, x.from.c);
          if (v && v.pid === x.id) v.pid = null;
          lifted.push([p, x]);
        });
        lifted.forEach(function (pair) {
          var p = pair[0], x = pair[1], v = R.cellV(x.to.r, x.to.c);
          if (v) v.pid = p.id;
          p.r = x.to.r; p.c = x.to.c;
        });
        batch.forEach(function (x) {
          if (x.t !== 'spawn') return;
          var p = R.addPiece({ id: x.id, type: x.type, color: x.color, frost: false, skin: x.skin }, x.to.r, x.to.c);
          p.y = (R.colTop[x.to.c] || 0) + x.from;
          lifted.push([p, x]);
        });
        lifted.forEach(function (pair) {
          var p = pair[0], dist = p.r - p.y;
          if (dist <= 0.001) { p.y = p.r; return; }
          var dur = D(Math.max(140, 80 * dist));
          R.tween(p, { y: p.r }, dur, 'in');
          R.tween(p, { sy: 0.8, sx: 1.12 }, D(35), 'out', dur);
          R.tween(p, { sy: 1, sx: 1 }, D(55), 'out', dur + D(35));
          fallEnd[p.id] = dur;
          end = Math.max(end, dur + D(40));
        });
        continue;
      }
      var d = 0, p, b, pt, c0;
      switch (e.t) {
        case 'swap': {
          var pa = R.pieces[e.ids[0]], pb = R.pieces[e.ids[1]];
          var va = R.cellV(e.a.r, e.a.c), vb = R.cellV(e.b.r, e.b.c);
          if (pa && pb && va && vb) {
            va.pid = pb.id; vb.pid = pa.id;
            pa.r = e.b.r; pa.c = e.b.c; pb.r = e.a.r; pb.c = e.a.c;
            pa.z = 1;
            R.tween(pa, { x: e.b.c, y: e.b.r }, D(140), 'inOut', 0, function () { pa.z = 0; });
            R.tween(pb, { x: e.a.c, y: e.a.r }, D(140), 'inOut');
          }
          sfx('swap');
          end = Math.max(end, D(140));
          break;
        }
        case 'cascade':
          pc.cascade = e.c;
          sfx('match', { cascade: e.c });
          vibrate(10);
          if (e.c >= 2) showCascade(e.c);
          if (e.c >= 4) tempMood(null, 'furioso', 1500);
          break;
        case 'clear':
          p = R.pieces[e.id];
          d = src ? delayFor(e.r, e.c) : 0;
          last = d;
          if (p) {
            pop(p, d, D(160));
            c0 = center(e.r, e.c);
            (function (x, y, col, dd) { R.after(dd + D(40), function () { fx.juice(G.boardOff.x + x, G.boardOff.y + y, col, cs / 46); }); })(c0.x, c0.y, e.color, d);
          }
          sources.push({ kind: 'color', color: e.color, r: e.r, c: e.c, t: d + D(60) });
          end = Math.max(end, d + D(170));
          break;
        case 'unfrost':
          p = R.pieces[e.id];
          d = src ? delayFor(e.r, e.c) : 0;
          last = d;
          if (p) {
            p.frost = false;
            R.tween(p, { frostA: 0 }, D(150), 'out', d);
            pt = rootC(e.r, e.c);
            (function (x, y, dd) { R.after(dd, function () { fx.shards(x, y, cs, { count: 7, power: 0.8 }); }); })(pt.x, pt.y, d);
          }
          playOnce('frost');
          end = Math.max(end, d + D(160));
          break;
        case 'damage':
          d = src ? delayFor(e.r, e.c) : D(40);
          last = d;
          if (e.kind === 'freezer') {
            var fz = R.fz;
            if (fz) {
              fz.hp = e.hp;
              R.tween(fz, { hpShown: e.hp }, D(260), 'out', d);
              R.tween(fz, { s: 1.06, flash: 0.7, ox: 0.04 }, D(60), 'out', d);
              R.tween(fz, { s: 1, flash: 0, ox: 0 }, D(200), 'outBack', d + D(60));
              pt = rootC(fz.r + 0.5, fz.c + 0.5);
              (function (x, y, dd, who) { R.after(dd, function () { fx.shards(x, y, cs * 1.6, { count: 8 }); fx.shake(2, 140); }); })(pt.x, pt.y, d, fz.who);
              tempMood(fz.who, 'furioso', 1500);
            }
            playOnce('freezerHit');
            sources.push({ kind: 'boss', r: e.r, c: e.c, t: d });
          } else {
            b = (R.cellV(e.r, e.c) || {}).b;
            if (b) {
              b.hp = e.hp;
              R.tween(b, { s: 1.1, flash: 0.6 }, D(60), 'out', d);
              R.tween(b, { s: 1, flash: 0 }, D(150), 'outBack', d + D(60));
              pt = rootC(e.r, e.c);
              (function (x, y, dd) { R.after(dd, function () { fx.shards(x, y, cs, { count: 6, power: 0.7 }); }); })(pt.x, pt.y, d);
            }
            if (e.kind === 'crate') playOnce('crate'); else sfx('ice', { hp: e.hp });
          }
          end = Math.max(end, d + D(200));
          break;
        case 'destroy':
          d = src ? delayFor(e.r, e.c) : D(40);
          last = d;
          b = R.removeBlock(e.r, e.c, d + D(200));
          if (b) {
            R.tween(b, { s: 1.18, flash: 0.8 }, D(70), 'out', d);
            R.tween(b, { s: 0.3, a: 0 }, D(130), 'in', d + D(70));
          }
          pt = rootC(e.r, e.c);
          (function (x, y, dd, kind) {
            R.after(dd + D(60), function () {
              if (kind === 'crate') fx.splinters(x, y, cs); else fx.shards(x, y, cs, { count: 14, power: 1.15 });
            });
          })(pt.x, pt.y, d, e.kind);
          if (e.kind === 'crate') sfx('crate'); else sfx('ice', { hp: 0 });
          sources.push({ kind: e.kind, r: e.r, c: e.c, t: d + D(70) });
          end = Math.max(end, d + D(210));
          break;
        case 'rescue':
          d = src ? delayFor(e.r, e.c) : D(40);
          last = d;
          b = R.removeBlock(e.r, e.c, d + D(240));
          if (b) {
            R.tween(b, { s: 1.25, flash: 1 }, D(90), 'out', d);
            R.tween(b, { s: 0.2, a: 0 }, D(150), 'in', d + D(90));
          }
          pt = rootC(e.r, e.c);
          (function (x, y, dd, who, r, c) {
            R.after(dd + D(80), function () {
              fx.shards(x, y, cs, { count: 18, power: 1.3 });
              fx.sparkle(x, y, cs, 10);
              rescuePop(who, r, c);
            });
          })(pt.x, pt.y, d, e.who, e.r, e.c);
          sfx('rescue');
          vibrate(30);
          sources.push({ kind: 'rescue', r: e.r, c: e.c, t: d + D(500) });
          end = Math.max(end, d + D(420));
          break;
        case 'freezerDown': {
          d = src ? delayFor(e.r, e.c) : D(40);
          last = d;
          var fd = R.removeFreezer(d + D(480));
          if (fd) {
            fd.hpShown = 0;
            R.tween(fd, { s: 1.15, flash: 1 }, D(120), 'out', d);
            R.tween(fd, { s: 0.2, a: 0, rot: 0.5 }, D(320), 'in', d + D(120));
          }
          pt = rootC(e.r + 0.5, e.c + 0.5);
          (function (x, y, dd) {
            R.after(dd + D(100), function () {
              fx.shards(x, y, cs * 2, { count: 30, power: 1.6 });
              fx.sparkle(x, y, cs * 2, 14);
              fx.ring(x, y, cs * 0.5, cs * 3, '#bfe9ff', 420);
              fx.shake(6, 320);
            });
          })(pt.x, pt.y, d);
          sfx('freezerHit'); sfx('bomba');
          vibrate(40);
          tempMood(e.who, 'furioso', 1500);
          G.R.fzBadge = null;
          sources.push({ kind: 'boss', r: e.r, c: e.c, t: d + D(200) });
          end = Math.max(end, d + D(500));
          break;
        }
        case 'activate': {
          p = R.pieces[e.id];
          src = { kind: e.type, r: e.r, c: e.c };
          d = 0; last = D(80);
          c0 = center(e.r, e.c);
          pt = rootC(e.r, e.c);
          if (p) {
            p.z = 1;
            R.removePiece(p.id, D(260));
            R.tween(p, { s: 1.35, flash: 1 }, D(90), 'out');
            R.tween(p, { s: 0, a: 0 }, D(150), 'in', D(90));
          }
          var col = flavorColor(e.color);
          if (e.type === 'ph' || e.type === 'pv') {
            var hz = e.type === 'ph';
            var x1 = hz ? G.boardOff.x + R.X(0) : pt.x, x2 = hz ? G.boardOff.x + R.X(R.cols) : pt.x;
            var y1 = hz ? pt.y : G.boardOff.y + R.Y(0), y2 = hz ? pt.y : G.boardOff.y + R.Y(R.rows);
            fx.beam(x1, y1, x2, y2, cs * 0.72, col, D(300));
            fx.sparkle(pt.x, pt.y, cs, 6);
            sfx('paleta');
            end = Math.max(end, D(40 + 24 * Math.max(R.rows, R.cols)) + D(170));
          } else if (e.type === 'bomba') {
            fx.ring(pt.x, pt.y, cs * 0.3, cs * 1.9, col, D(320));
            fx.glow(pt.x, pt.y, cs * 1.6, 'rgba(255,240,180,0.9)', D(260));
            fx.shake(4, 220);
            sfx('bomba');
            vibrate(30);
            end = Math.max(end, D(60 + 30 * 2) + D(170));
          } else if (e.type === 'copa') {
            var bc = flavorColor(e.color);
            (e.cells || []).forEach(function (q, k) {
              var tp = rootC(q.r, q.c);
              fx.beam(pt.x, pt.y, tp.x, tp.y, cs * 0.16, k % 2 ? '#ffffff' : bc, D(330));
            });
            fx.glow(pt.x, pt.y, cs * 2, 'rgba(255,220,255,0.9)', D(300));
            fx.sparkle(pt.x, pt.y, cs * 1.4, 12);
            sfx('copa');
            // congelar imagen 60 ms cuando los rayos llegan (no con movimiento reducido)
            if (!red) R.after(D(200), function () { R.freeze(60); });
            end = Math.max(end, D(210) + D(170));
          }
          if (e.points) { /* los puntos llegan en su propio evento */ }
          break;
        }
        case 'combo': {
          src = { kind: (e.types.indexOf('copa') >= 0 && !(e.types[0] === 'copa' && e.types[1] === 'copa')) ? 'combocopa' : 'combo', r: e.r, c: e.c };
          last = D(80);
          (e.ids || []).forEach(function (id) {
            var q = R.pieces[id];
            if (!q) return;
            q.z = 1;
            R.removePiece(id, D(260));
            R.tween(q, { s: 1.4, flash: 1 }, D(90), 'out');
            R.tween(q, { s: 0, a: 0 }, D(160), 'in', D(90));
          });
          pt = rootC(e.r, e.c);
          var t2 = e.types.slice().sort().join('+');
          var pal = (e.types[0] === 'ph' || e.types[0] === 'pv' ? 1 : 0) + (e.types[1] === 'ph' || e.types[1] === 'pv' ? 1 : 0);
          if (t2 === 'copa+copa') {
            fx.ring(pt.x, pt.y, cs * 0.4, cs * 9, '#ff6fa5', D(520));
            fx.ring(pt.x, pt.y, cs * 0.2, cs * 7, '#ffc93c', D(460), D(80));
            fx.glow(pt.x, pt.y, cs * 4, 'rgba(255,255,255,0.95)', D(400));
            fx.shake(8, 360);
            end = Math.max(end, D(70 + 26 * 8) + D(170));
          } else if (src.kind === 'combocopa') {
            (e.cells || []).forEach(function (q, k) {
              var tp = rootC(q.r, q.c);
              fx.beam(pt.x, pt.y, tp.x, tp.y, cs * 0.14, k % 2 ? '#ffffff' : '#ff6fa5', D(300));
            });
            fx.glow(pt.x, pt.y, cs * 2.2, 'rgba(255,220,255,0.95)', D(320));
            fx.shake(4, 220);
            end = Math.max(end, D(300));
          } else {
            var bx0 = G.boardOff.x + R.X(0), bx1 = G.boardOff.x + R.X(R.cols), by0 = G.boardOff.y + R.Y(0), by1 = G.boardOff.y + R.Y(R.rows);
            if (pal === 2) {
              fx.beam(bx0, pt.y, bx1, pt.y, cs * 0.8, '#ffffff', D(320));
              fx.beam(pt.x, by0, pt.x, by1, cs * 0.8, '#ffffff', D(320));
            } else if (pal === 1) {
              for (var dd2 = -1; dd2 <= 1; dd2++) {
                fx.beam(bx0, pt.y + dd2 * cs, bx1, pt.y + dd2 * cs, cs * 0.75, '#ffe680', D(340));
                fx.beam(pt.x + dd2 * cs, by0, pt.x + dd2 * cs, by1, cs * 0.75, '#ffe680', D(340));
              }
            } else {
              fx.ring(pt.x, pt.y, cs * 0.4, cs * 3.2, '#ffc93c', D(380));
              fx.ring(pt.x, pt.y, cs * 0.3, cs * 2.4, '#ffffff', D(320), D(60));
            }
            fx.glow(pt.x, pt.y, cs * 2.4, 'rgba(255,240,180,0.95)', D(320));
            fx.shake(6, 300);
            end = Math.max(end, D(70 + 26 * 8) + D(170));
          }
          sfx('combo');
          vibrate(30);
          tempMood(null, 'furioso', 1500);
          break;
        }
        case 'transform': {
          p = R.pieces[e.id];
          d = src && src.kind === 'combocopa' ? D(100 + (i % 12) * 14) : 0;
          last = d;
          if (p) {
            (function (pp, ee, dd) {
              R.after(dd, function () {
                pp.type = ee.type;
                if (ee.color !== undefined && ee.color !== null) pp.color = ee.color;
                var q = rootC(pp.r, pp.c);
                fx.sparkle(q.x, q.y, cs, 7);
              });
            })(p, e, d);
            R.tween(p, { s: 1.28, flash: 0.9 }, D(90), 'out', d);
            R.tween(p, { s: 1, flash: 0 }, D(140), 'outBack', d + D(90));
          }
          playOnce('special');
          end = Math.max(end, d + D(240));
          break;
        }
        case 'create': {
          p = R.addPiece({ id: e.id, type: e.type, color: e.color, frost: false }, e.r, e.c);
          p.s = 0; p.flash = 1;
          R.tween(p, { s: 1.3 }, D(130), 'out');
          R.tween(p, { s: 1, flash: 0 }, D(120), 'outBack', D(130));
          pt = rootC(e.r, e.c);
          fx.glow(pt.x, pt.y, cs * 1.3, 'rgba(255,246,170,0.95)', D(380));
          fx.sparkle(pt.x, pt.y, cs, 10);
          playOnce('special');
          last = 0;
          end = Math.max(end, D(250));
          break;
        }
        case 'collect': {
          d = (fallEnd[e.id] || 0) + D(60);
          last = d;
          p = R.pieces[e.id];
          if (p) {
            R.removePiece(p.id, d + D(240));
            R.tween(p, { s: 1.3, flash: 1, oy: -0.2 }, D(110), 'out', d);
            R.tween(p, { s: 0.2, a: 0, oy: -0.5 }, D(130), 'in', d + D(110));
          }
          pt = rootC(e.r, e.c);
          (function (x, y, dd) { R.after(dd, function () { fx.sparkle(x, y, cs * 1.2, 12, '#ffc93c'); sfx('token'); }); })(pt.x, pt.y, d);
          sources.push({ kind: 'token', skin: e.skin, r: e.r, c: e.c, t: d + D(80) });
          end = Math.max(end, d + D(260));
          break;
        }
        case 'villain':
          end = Math.max(end, animVillain(e, D, red));
          break;
        case 'shuffle':
          end = Math.max(end, animShuffle(e, D));
          break;
        case 'booster':
          src = { kind: e.type, r: e.r || 0, c: e.c || 0 };
          end = Math.max(end, animBooster(e, D));
          break;
        case 'points':
          if (e.value) {
            pt = rootC(e.r, e.c);
            var size = Math.round(Math.max(14, Math.min(30, cs * 0.36 + Math.min(10, e.value / 120))));
            fx.text(pt.x, pt.y, '+' + fmt(e.value), { size: size, delay: last + D(60), color: e.value >= 300 ? '#ffe680' : '#ffffff' });
          }
          break;
        case 'goal': case 'win': case 'lose': case 'invalid':
          break;
      }
      i++;
    }

    // ----- HUD: puntos y metas (los íconos vuelan a su contador) -----
    if (typeof step.score === 'number') R.after(Math.min(end, D(200)), function () { setScore(step.score); });
    if (step.goals) {
      step.goals.forEach(function (rem, gi) {
        var before = pc.goals[gi];
        if (rem >= before) return;
        pc.goals[gi] = rem;
        launchGoal(gi, before - rem, rem, sources);
      });
    }
    if (pc.hf) end = Math.max(end, D(90));
    return R.wait(Math.max(0, end));
  }

  // Íconos de meta que vuelan desde el tablero hasta el contador
  function launchGoal(gi, count, rem, sources) {
    var R = G.R, g = G.state.goals[gi], entry = G.goals[gi];
    if (!g || !entry) return;
    var match = sources.filter(function (s) {
      if (g.type === 'color') return s.kind === 'color' && s.color === g.color;
      if (g.type === 'ice') return s.kind === 'ice';
      if (g.type === 'crate') return s.kind === 'crate';
      if (g.type === 'rescue') return s.kind === 'rescue';
      if (g.type === 'token') return s.kind === 'token';
      if (g.type === 'boss') return s.kind === 'boss';
      return false;
    });
    var img = null;
    if (g.type === 'color') img = R.sprite('t|' + g.color + '|n|happy') || R.sprite('t|' + g.color + '|n|normal');
    else if (g.type === 'ice') img = R.sprite('ice|1|1') || R.sprite('ice|1|2') || R.sprite('ice|1|3');
    else if (g.type === 'crate') img = R.sprite('crate');
    else if (g.type === 'token') img = R.sprite('tok|' + (G.state.tokens ? G.state.tokens.skin : 'uva'));
    var flyDur = 520, maxFly = Math.min(count, 6, match.length);
    if (!img || !maxFly || (g.type !== 'color' && g.type !== 'ice' && g.type !== 'crate' && g.type !== 'token')) {
      var t = match.length ? match[match.length - 1].t : 0;
      R.after(t + 120, function () { setGoal(gi, Math.min(entry.shown === null ? rem : entry.shown, rem)); });
      return;
    }
    var tg = relRect(entry.ic);
    var stepK = match.length / maxFly, left = maxFly;
    function land() {
      left--;
      var cur = entry.shown === null ? rem + count : entry.shown;
      var target = left <= 0 ? rem : Math.max(rem, cur - Math.ceil((cur - rem) / (left + 1)));
      setGoal(gi, Math.min(cur, target));
    }
    for (var k = 0; k < maxFly; k++) {
      var s = match[Math.min(match.length - 1, Math.floor(k * stepK))];
      var pt = cellPt(s.r, s.c);
      (function (pt, tt) {
        R.after(tt, function () { G.fx.flyer(img, pt.x, pt.y, tg.cx, tg.cy, R.cell * 0.82, flyDur, 0, land); });
      })(pt, s.t + k * 25);
    }
  }

  // ----- villano: rayo desde el retrato del HUD o desde el congelador -----
  function animVillain(e, D, red) {
    var R = G.R, fx = G.fx, cs = R.cell;
    var ve = villainEntry(e.who), from;
    if (e.src === 'boss' && R.fz) from = cellPt(R.fz.r + 0.5, R.fz.c + 0.5);
    else if (ve) { var rr = relRect(ve.face); from = { x: rr.cx, y: rr.cy }; }
    else from = boardPt(R.side / 2, 0);
    var color = e.who === 'cereza' ? '#ff6fa5' : '#7fdcff';
    sfx('villain');
    sfx('laugh', { who: e.who });
    tempMood(e.who, 'carcajada', 1200);
    if (ve) { ve.box.classList.remove('cg-zap'); void ve.box.offsetWidth; ve.box.classList.add('cg-zap'); }
    updateVillainBadges();
    if (Math.random() < 0.6) taunt('act', e.who);
    var end = D(300);
    (e.targets || []).forEach(function (t, k) {
      var dly = D(k * 110), hit = dly + D(320);
      var to = cellPt(t.r, t.c);
      fx.ray(from.x, from.y, to.x, to.y, color, D(460), dly);
      var p = R.pieces[t.id];
      if (e.act === 'crate') {
        if (p) {
          R.removePiece(p.id, hit + D(160));
          R.tween(p, { s: 0.2, a: 0 }, D(140), 'in', hit);
        }
        var v = R.cellV(t.r, t.c);
        if (v) v.pid = null;
        // modelo: la caja existe ya (el siguiente paso la puede necesitar); se ve caer al llegar el rayo
        var bv = R.setBlock(t.r, t.c, { kind: 'crate', hp: 1, maxHp: 1 });
        if (bv) {
          bv.s = 1.7; bv.a = 0;
          R.tween(bv, { s: 1, a: 1 }, D(200), 'in', hit);
          R.tween(bv, { oy: -0.06 }, D(60), 'out', hit + D(200));
          R.tween(bv, { oy: 0 }, D(90), 'outBack', hit + D(260));
        }
        R.after(hit + D(190), function () {
          fx.splinters(to.x, to.y + cs * 0.3, cs * 0.6);
          if (!red) fx.shake(2, 120);
          sfx('crate');
        });
      } else {
        if (p) {
          p.frost = true;
          R.tween(p, { frostA: 1, flash: 0.8 }, D(160), 'out', hit);
          R.tween(p, { flash: 0 }, D(160), 'out', hit + D(160));
        }
        R.after(hit, function () { fx.puff(to.x, to.y, cs, '#e8f8ff'); sfx('frost'); });
      }
      end = Math.max(end, hit + D(380));
    });
    return end;
  }

  // ----- barajado (sin jugadas o Batido) -----
  function animShuffle(e, D) {
    var R = G.R, fx = G.fx;
    var who = e.who || mainVillain();
    var text = e.reason === 'batido' ? '¡Batido de Fresa!' : '¡' + charName(who) + ' revolvió la heladería!';
    banner(text, e.reason === 'batido' ? '¡A revolver!' : 'No había jugadas', 'cg-banner-shuffle', 1300);
    sfx('shuffle');
    // modelo
    for (var r = 0; r < R.rows; r++) for (var c = 0; c < R.cols; c++) { var v = R.cellV(r, c); if (v) v.pid = null; }
    var cx = (R.cols - 1) / 2, cy = (R.rows - 1) / 2;
    (e.pieces || []).forEach(function (sp, k) {
      var p = R.pieces[sp.id];
      if (!p) p = R.addPiece({ id: sp.id, type: sp.type, color: sp.color, frost: sp.frost, skin: sp.skin }, sp.r, sp.c);
      var moved = p.r !== sp.r || p.c !== sp.c || p.color !== sp.color;
      p.r = sp.r; p.c = sp.c; p.type = sp.type; p.color = sp.color;
      if (!!p.frost !== !!sp.frost) { p.frost = !!sp.frost; R.tween(p, { frostA: sp.frost ? 1 : 0 }, D(200), 'out', D(300)); }
      var v2 = R.cellV(sp.r, sp.c);
      if (v2) v2.pid = sp.id;
      if (!moved) return;
      var ang = Math.atan2(p.y - cy, p.x - cx) + 1.4;
      var rad = 0.9 + Math.random() * 0.8;
      R.tween(p, { x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad, rot: 2.5, s: 0.8 }, D(300), 'in', D(k % 8 * 10));
      R.tween(p, { x: sp.c, y: sp.r, rot: 0, s: 1 }, D(340), 'out3', D(320 + (k % 8) * 10));
    });
    var c0 = boardPt(R.side / 2, R.side / 2);
    fx.sparkle(c0.x, c0.y, R.cell * 3, 16);
    return D(760) + 240;
  }

  // ----- ayudas -----
  function animBooster(e, D) {
    var R = G.R, fx = G.fx, cs = R.cell;
    sfx('booster');
    if (e.type === 'cucharon') {
      var pt = cellPt(e.r, e.c), size = cs * 1.5;
      domSprite(icon('cucharon'), 'cg-spoon', pt.x - size * 0.5, pt.y - size * 0.95, size, 650);
      R.after(D(170), function () { fx.ring(pt.x, pt.y, cs * 0.2, cs * 1.1, '#ffffff', 260); fx.shake(3, 140); });
      return D(260);
    }
    if (e.type === 'chorro') {
      var y = cellPt(e.r, 0).y, x0 = G.boardOff.x + R.X(0), x1 = G.boardOff.x + R.X(R.cols);
      fx.beam(x0, y, x1, y, cs * 0.9, '#b6f04a', D(420));
      for (var c = 0; c < R.cols; c++) {
        (function (cc) { R.after(D(60 + cc * 30), function () { var q = cellPt(e.r, cc); fx.juice(q.x, q.y, 'L', cs / 50); }); })(c);
      }
      var lp = cellPt(e.r, 0);
      domSprite(icon('chorro'), 'cg-squirt', lp.x - cs * 1.1, lp.y - cs * 0.6, cs * 1.2, 700);
      return D(60 + R.cols * 30 + 120);
    }
    if (e.type === 'batido') {
      var c0 = boardPt(R.side / 2, R.side * 0.2);
      domSprite(icon('batido'), 'cg-blender', c0.x - cs * 1.1, c0.y - cs * 1.1, cs * 2.2, 1000);
      return D(380);
    }
    return 0;
  }

  // =====================================================================
  //  Fin de nivel
  // =====================================================================
  function winSeq() {
    var gen = G.gen, R = G.R, s = G.state;
    G.phase = 'hf';
    G.root.classList.remove('cg-danger');
    refreshMoods();
    clearHint();
    taunt('win');
    var p = Promise.resolve();
    G.hfSkip = false; G.player = null;
    // espera que se corta si el jugador toca para saltar
    function waitSkip(ms) {
      return new Promise(function (res) {
        var done = false;
        function go() { if (!done) { done = true; G.hfWake = null; res(); } }
        G.hfWake = go;
        R.wait(ms).then(go);
      });
    }
    if (s.movesLeft > 0) {
      p = waitSkip(300).then(function () {
        if (gen !== G.gen || G.hfSkip) return;
        banner('¡Helado Final!', 'Toca para saltar', 'cg-banner-hf', 1500);
        sfx('special');
        return waitSkip(950);
      }).then(function () {
        if (gen !== G.gen) return;
        var hf = Engine().heladoFinal(G.state);
        // velocidad adaptable: con muchos movimientos sobrantes el Helado Final no debe pasar de ~7 s
        var hfSpeed = Math.min(0.75, Math.max(0.22, 6000 / (Math.max(1, G.state.movesLeft) * 1800)));
        var pc = { prev: G.state, speed: hfSpeed, hf: true, cancelled: false };
        G.state = hf.state;
        if (G.hfSkip) { applyInstant(); return; }
        G.player = pc;
        return playSteps(hf.steps || [], pc).then(function () {
          if (gen !== G.gen) return;
          if (!pc.cancelled) syncCheck();
        });
      });
    }
    p.then(function () {
      if (gen !== G.gen) return;
      G.player = null;
      celebrate(gen);
    });
  }
  function skipHF() {
    var pc = G.player;
    if (!pc || !pc.hf) { G.hfSkip = true; if (G.hfWake) G.hfWake(); return; }
    if (pc.cancelled) return;
    pc.cancelled = true;
    applyInstant();
  }
  // Salta al estado final al instante (Helado Final)
  function applyInstant() {
    G.R.flush();
    G.fx.clear();
    G.R.load(G.state);
    setMoves(G.state.movesLeft, true);
    setScore(G.state.score);
    G.els.overlay.querySelectorAll('.cg-banner, .cg-cascade').forEach(function (b) { b.remove(); });
  }
  function celebrate(gen) {
    var s = G.state;
    G.phase = 'end';
    G.root.classList.add('cg-ended', 'cg-won');
    setMoves(s.movesLeft, true);
    setScore(s.score);
    refreshMoods();
    G.fx.confetti(150);
    var c0 = boardPt(G.R.side / 2, G.R.side / 2);
    G.fx.sparkle(c0.x, c0.y, G.R.cell * 4, 20);
    sfx('win');
    banner(G.daily ? '¡Reto superado!' : '¡Nivel superado!', '', 'cg-banner-win', 1700);
    endAfter(gen, 1800, true);
  }
  function loseSeq() {
    var gen = G.gen;
    G.phase = 'end';
    G.root.classList.remove('cg-danger');
    G.root.classList.add('cg-ended');
    clearHint();
    refreshMoods();
    var nm = nearMiss();
    sfx('laugh', { who: mainVillain() });
    sfx('lose');
    banner('¡Sin movimientos!', nm ? '¡Casi! Te faltan ' + nm.remaining : '', 'cg-banner-lose', 1700);
    taunt('lose');
    endAfter(gen, 1800, false);
  }
  function endAfter(gen, ms, won) {
    var done = false;
    function fire() {
      if (done || gen !== G.gen) return;
      done = true;
      G.endSkip = null;
      clearTimeout(G.endTimer);
      finish(won);
    }
    G.endSkip = fire;
    G.endTimer = setTimeout(fire, ms);
  }
  function nearMiss() {
    var s = G.state;
    var u = safe(function () { return Engine().goalUnits(s); }, null);
    if (!u || !u.start || u.remaining <= 0 || u.remaining > 0.2 * u.start) return null;
    var g = s.goals.filter(function (x) { return x.remaining > 0; }).sort(function (a, b) { return b.remaining - a.remaining; })[0];
    if (!g) return null;
    var o = { remaining: u.remaining, icon: goalIconSvg(g), goal: { type: g.type, remaining: g.remaining } };
    if (g.color) o.goal.color = g.color;
    return o;
  }
  function buildResult(won) {
    var s = G.state, E = Engine();
    var ml = won ? ((s.wonMovesLeft !== null && s.wonMovesLeft !== undefined) ? s.wonMovesLeft : s.movesLeft) : 0;
    return {
      won: !!won,
      stars: won ? safe(function () { return E.starsFor(s); }, 1) : 0,
      score: s.score,
      movesLeft: ml,
      movesUsed: s.movesTotal - ml,
      movesTotal: s.movesTotal,
      levelId: G.level.id,
      daily: G.daily,
      turns: G.turns.slice(),
      rescued: (s.rescued || []).slice(),
      maxCascade: (s.stats && s.stats.maxCascade) || 0,
      nearMiss: won ? null : nearMiss(),
    };
  }
  function finish(won) {
    G.phase = 'done';
    clearHint();
    var res = buildResult(won);
    G.lastResult = res;
    if (G.opts.onEnd) { try { G.opts.onEnd(res); } catch (e) { if (typeof console !== 'undefined') console.error(e); } }
  }

  // =====================================================================
  //  Tutorial (mano guía) — primera vez en niveles con level.teach
  // =====================================================================
  function maybeTutorial() {
    var lv = G.level;
    if (!lv || !lv.teach || G.daily) return false;
    var key = 'teach' + lv.id, d = data();
    if (d.seen[key]) return false;
    startTutorial(lv.teach, key);
    return !!G.tutorial;
  }
  function boosterUsable(type) { var inf = boosterInfo(type); return inf.unlocked && inf.count > 0 && !G.daily; }
  function teachScore(teach) {
    function count(steps, fn, firstOnly) {
      var n = 0;
      steps.forEach(function (st) {
        if (firstOnly && st.cascade > 1) return;
        (st.events || []).forEach(function (e) { if (fn(e)) n++; });
      });
      return n;
    }
    var tokenIds = {};
    G.state.grid.forEach(function (row) { row.forEach(function (cl) { if (cl && cl.p && cl.p.type === 'token') tokenIds[cl.p.id] = 1; }); });
    switch (teach) {
      case 'paleta': return function (st) { return count(st, function (e) { return e.t === 'create' && (e.type === 'ph' || e.type === 'pv'); }, true); };
      case 'bomba': return function (st) { return count(st, function (e) { return e.t === 'create' && e.type === 'bomba'; }, true); };
      case 'copa': return function (st) { return count(st, function (e) { return e.t === 'create' && e.type === 'copa'; }, true); };
      case 'hielo': case 'hp2': return function (st) {
        return 10 * count(st, function (e) { return (e.t === 'damage' || e.t === 'destroy') && e.kind === 'ice'; }, true) +
          count(st, function (e) { return (e.t === 'damage' || e.t === 'destroy') && e.kind === 'ice'; });
      };
      case 'escarcha': return function (st) { return count(st, function (e) { return e.t === 'unfrost'; }, true); };
      case 'congelador': return function (st) {
        return 10 * count(st, function (e) { return (e.t === 'damage' && e.kind === 'freezer') || e.t === 'freezerDown'; }, true) +
          count(st, function (e) { return e.t === 'damage' && e.kind === 'friend'; });
      };
      case 'cajas': return function (st) { return count(st, function (e) { return (e.t === 'destroy' || e.t === 'damage') && e.kind === 'crate'; }, true); };
      case 'ficha': case 'pruebas': return function (st) {
        var n = 0;
        st.forEach(function (s) {
          (s.events || []).forEach(function (e) {
            if (e.t === 'collect') n += 100;
            if (e.t === 'fall' && tokenIds[e.id]) n += e.to.r - e.from.r;
            if (e.t === 'swap' && (tokenIds[e.ids[0]] || tokenIds[e.ids[1]])) n += 1;
          });
        });
        return n;
      };
    }
    return null;
  }
  function findTeachMove(teach) {
    var E = Engine(), s = G.state;
    var score = teachScore(teach);
    var hint = safe(function () { return E.hint(s); }, null);
    if (!score) return hint;
    var moves = safe(function () { return E.validMoves(s); }, []), best = null, bs = 0;
    moves.forEach(function (m) {
      var res = safe(function () { return E.applySwap(s, m.a, m.b); }, null);
      if (!res || !res.turnInfo.valid) return;
      var v = score(res.steps);
      if (v > bs) { bs = v; best = m; }
    });
    return best || hint;
  }
  function startTutorial(teach, key) {
    var t = { teach: teach, key: key, move: null, booster: null, hud: false, els: [] };
    var text = TEACH[teach] || safe(function () { return Story().tips[G.level.id]; }, null) || TEACH.swap;
    if ((teach === 'cucharon' || teach === 'chorro' || teach === 'batido') && boosterUsable(teach)) t.booster = teach;
    else if (teach === 'villano' || teach === 'cereza' || teach === 'dosvillanos') t.hud = true;
    else t.move = findTeachMove(teach);
    if (!t.booster && !t.hud && !t.move) return;
    G.tutorial = t;
    var helper = safe(function () { return Story().helperFor(G.level.id); }, null) || ((G.level.id || 1) >= 16 ? 'banano' : 'lima');
    var tip = el('div', 'cg-tip');
    tip.innerHTML = '<span class="cg-tip-face">' + portraitSvg(helper, 'feliz') + '</span><span class="cg-tip-text"><b></b><span></span></span>';
    tip.querySelector('b').textContent = charName(helper);
    tip.querySelector('.cg-tip-text span').textContent = text;
    G.els.overlay.appendChild(tip);
    t.els.push(tip);
    t.tip = tip;
    var hand = el('div', 'cg-hand', icon('hand'));
    G.els.overlay.appendChild(hand);
    t.els.push(hand);
    t.hand = hand;
    placeTutorial();
    sfx('blip');
  }
  function placeTutorial() {
    var t = G.tutorial;
    if (!t) return;
    var R = G.R, hand = t.hand, tip = t.tip, rr = rootRect();
    var hs = Math.round(Math.max(44, Math.min(72, R.cell * 1.15)));
    hand.style.width = hand.style.height = hs + 'px';
    var tipY;
    if (t.move) {
      var a = cellPt(t.move.a.r, t.move.a.c), b = cellPt(t.move.b.r, t.move.b.c);
      R.spotlight = [t.move.a, t.move.b];
      hand.className = 'cg-hand cg-hand-swipe';
      hand.style.left = (a.x - hs * 0.45) + 'px'; hand.style.top = (a.y - hs * 0.19) + 'px';
      hand.style.setProperty('--dx', (b.x - a.x) + 'px'); hand.style.setProperty('--dy', (b.y - a.y) + 'px');
      var midR = (t.move.a.r + t.move.b.r) / 2;
      tipY = midR < R.rows / 2 ? boardPt(0, R.Y(Math.min(R.rows, Math.ceil(midR) + 2))).y : boardPt(0, R.Y(Math.max(0, Math.floor(midR) - 1))).y - 8;
      tip.classList.toggle('cg-tip-above', midR >= R.rows / 2);
    } else {
      R.spotlight = null;
      var target = t.booster ? G.els.boosters.querySelector('.cg-boost-' + t.booster + ' .cg-boost-ic') : (G.villains[0] && (G.villains[0].badges[0] ? G.villains[0].badges[0].el : G.villains[0].face));
      if (target) {
        var tr = relRect(target);
        hand.className = 'cg-hand cg-hand-tap';
        hand.style.left = (tr.cx - hs * 0.45) + 'px'; hand.style.top = (tr.cy - hs * 0.19) + 'px';
      }
      if (t.booster && !G.root.classList.contains('cg-wide')) {
        // encima de la barra de ayudas, sin tapar más tablero del necesario
        var bb = relRect(G.els.boosters);
        tipY = Math.max(boardPt(0, R.side * 0.3).y, bb.y - 6);
        tip.classList.add('cg-tip-above');
      } else if (t.hud && !G.root.classList.contains('cg-wide')) {
        tipY = relRect(G.els.card).y + relRect(G.els.card).h + 12;
      } else {
        tipY = boardPt(0, R.side * 0.5).y;
        tip.classList.add('cg-tip-mid');
      }
    }
    var bw = Math.min(R.side - 16, 420);
    tip.style.width = bw + 'px';
    tip.style.left = (G.boardOff.x + (R.side - bw) / 2) + 'px';
    tip.style.top = Math.max(8, Math.min(rr.height - 60, tipY)) + 'px';
    R.kick();
  }
  function tutorialText(txt) { var t = G.tutorial; if (t && t.tip) t.tip.querySelector('.cg-tip-text span').textContent = txt; }
  function tutorialNudge() {
    var t = G.tutorial;
    sfx('invalid');
    if (!t || !t.hand) return;
    t.hand.classList.remove('cg-hand-swipe'); void t.hand.offsetWidth; t.hand.classList.add('cg-hand-swipe');
    if (t.tip) { t.tip.classList.remove('cg-bump'); void t.tip.offsetWidth; t.tip.classList.add('cg-bump'); }
  }
  function endTutorial() {
    var t = G.tutorial;
    if (!t) return;
    G.tutorial = null;
    G.R.spotlight = null;
    G.R.kick();
    t.els.forEach(function (e) { e.classList.add('cg-out'); setTimeout(function () { e.remove(); }, 300); });
    var d = data();
    d.seen[t.key] = true;
    persist();
  }

  // =====================================================================
  //  Bucle por cuadro: vibración de pantalla y marcador
  // =====================================================================
  function onFrame(dt) {
    var o = G.fx.offset(), tr = (o.x || o.y) ? 'translate(' + o.x + 'px,' + o.y + 'px)' : '';
    if (tr !== G.lastShake) { G.els.wrap.style.transform = tr; G.lastShake = tr; }
    if (G.scoreShown !== G.scoreTarget) {
      var diff = G.scoreTarget - G.scoreShown;
      var stepV = Math.max(1, Math.ceil(Math.abs(diff) * Math.min(1, dt / 90)));
      G.scoreShown += diff > 0 ? Math.min(stepV, diff) : Math.max(-stepV, diff);
      G.els.score.textContent = fmt(G.scoreShown);
      G.R.kick();
    }
  }

  // =====================================================================
  //  Tamaño y diseño (teléfono vertical / pantalla ancha)
  // =====================================================================
  function resize() {
    if (!G.mounted) return;
    var rr = rootRect(), w = rr.width, h = rr.height;
    if ((w < 10 || h < 10) && G.laidOut) {   // pantalla oculta: se conserva el último tamaño
      if (G.state && (G.R.rows !== G.state.rows || G.R.cols !== G.state.cols)) G.R.layout(G.R.side, G.state.rows, G.state.cols, G.R.dpr);
      return;
    }
    // ancho: ≥900 px horizontal (DISENO §11.5); también teléfonos acostados, donde el HUD arriba dejaría un tablero diminuto
    var wide = w > h && (w >= 900 || (h < 560 && w >= 560));
    G.root.classList.toggle('cg-wide', wide);
    G.root.classList.toggle('cg-short', h < (wide ? 620 : 640));
    G.root.classList.toggle('cg-tall', !wide && h >= 760 && w >= 360);
    G.root.classList.toggle('cg-narrow', !wide && w < 360);
    var st = G.els.stage.getBoundingClientRect();
    var side;
    if (w < 10 || h < 10 || st.width < 10) side = 320;   // pantalla oculta: valor provisional
    else side = Math.floor(Math.min(st.width - 24, st.height - 8, 600));
    side = Math.max(160, side);
    G.els.wrap.style.width = side + 'px';
    G.els.wrap.style.height = side + 'px';
    var dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    var rows = G.state ? G.state.rows : 8, cols = G.state ? G.state.cols : 8;
    var stale = G.R.layout(side, rows, cols, dpr);
    if (w >= 10 && h >= 10) G.laidOut = true;
    if (stale && G.state && G.phase !== 'idle') G.R.rerasterize();
    // la capa de efectos cubre toda la pantalla: con 1.5x basta y cuesta casi la mitad de píxeles
    G.fx.resize(Math.max(1, w), Math.max(1, h), Math.min(1.5, dpr));
    var cr = G.els.canvas.getBoundingClientRect();
    G.boardOff = { x: cr.left - rr.left - (G.fx.offset().x || 0), y: cr.top - rr.top - (G.fx.offset().y || 0) };
    if (G.tutorial) placeTutorial();
    G.R.kick();
  }

  // =====================================================================
  //  Pausa, reinicio, parada
  // =====================================================================
  function pause() {
    if (G.paused || G.phase === 'idle') return;
    G.paused = true;
    G.R.setPaused(true);
    clearHint();
    onCancel();
    G.root.classList.add('cg-paused');
  }
  function resume() {
    if (!G.paused) return;
    G.paused = false;
    G.fx.setReduced(reducedMotion());
    G.R.setPaused(false);
    G.root.classList.remove('cg-paused');
    armHint();
  }
  function restart() {
    if (!G.level) return;
    start(G.level, G.opts);
  }
  function stopInternal() {
    G.gen++;
    G.phase = 'idle';
    G.paused = false;
    if (G.player) G.player.cancelled = true;
    G.player = null;
    clearTimeout(G.hintTimer); clearTimeout(G.bubbleTimer); clearTimeout(G.toastTimer); clearTimeout(G.endTimer);
    clearInterval(G.blinkTimer);
    G.endSkip = null;
    G.villains.forEach(function (v) { clearTimeout(v.tempTimer); });
    if (G.R) { G.R.cancelAll(); G.R.setPaused(false); G.R.hint = null; G.R.sel = null; G.R.cursor = null; G.R.spotlight = null; G.R.fzBadge = null; }
    if (G.fx) G.fx.clear();
    G.tutorial = null; G.armed = null; G.sel = null; G.cursor = null; G.press = null; G.pressed = null;
    if (G.els.overlay) G.els.overlay.innerHTML = '';
    if (G.els.wrap) { G.els.wrap.classList.remove('cg-target'); G.els.wrap.style.transform = ''; G.lastShake = ''; }
    hidePeeker();
  }
  function stop() {
    if (!G.mounted) return;
    stopInternal();
    if (G.R) G.R.kick();
  }

  // ---------- ayudas para pruebas (contrato §12) ----------
  function testSwap(a, b) {
    if (!canPlay()) return Promise.resolve(false);
    if (G.tutorial) endTutorial();   // las pruebas automáticas no quedan atadas a la jugada del tutorial
    var before = G.turns.length;
    var ok = trySwap(a, b);
    if (!ok) return Promise.resolve(false);
    return new Promise(function (res) {
      (function poll() { if (!_busyFn()) res(G.turns.length > before); else setTimeout(poll, 30); })();
    });
  }
  function _busyFn() { return G.phase === 'intro' || G.phase === 'resolve' || G.phase === 'hf' || G.phase === 'end'; }

  // Fin forzado (para Cocardo.debug.win()/lose() de la Shell)
  function debugEnd(won) {
    if (!G.level || G.phase === 'idle' || G.phase === 'done') return null;
    var s = G.state;
    s.status = won ? 'won' : 'lost';
    if (won) { s.wonMovesLeft = s.movesLeft; s.goals.forEach(function (g) { g.remaining = 0; }); }
    else s.movesLeft = 0;
    stopTimersOnly();
    finish(!!won);
    return G.lastResult;
  }
  function stopTimersOnly() {
    if (G.player) G.player.cancelled = true;
    G.R.flush(); G.fx.clear();
    clearTimeout(G.endTimer);
  }

  // Solo pruebas: reemplaza el estado del motor por uno armado a mano (Engine.fromRows) y redibuja.
  function testSetState(st) {
    if (!G.mounted || !st || G.phase === 'idle') return false;
    clearHint(); setSel(null); disarm();
    if (G.tutorial) endTutorial();
    G.R.flush(); G.fx.clear();
    G.state = st;
    G.phase = 'play';
    buildHud();
    resize();
    G.R.load(st);
    updateVillainBadges();
    var keys = G.R.keysFor(st, G.level);
    return G.R.ensure(keys.essential.concat(keys.rest)).then(function () { G.R.kick(); return true; });
  }

  Cocardo.Game = {
    mount: mount,
    start: start,
    pause: pause,
    resume: resume,
    restart: restart,
    stop: stop,
    resize: resize,
    // pruebas / depuración
    _state: function () { return G.state; },
    _busy: _busyFn,
    _phase: function () { return G.phase; },
    _diff: function () { return G.state && G.R ? G.R.diff(G.state) : []; },
    _swap: testSwap,
    _skip: function () { if (G.phase === 'hf') skipHF(); else if (G.endSkip) G.endSkip(); },
    _tutorialMove: function () { return G.tutorial && G.tutorial.move ? G.tutorial.move : null; },
    _tutorial: function () { return G.tutorial ? { teach: G.tutorial.teach, move: G.tutorial.move, booster: G.tutorial.booster, hud: G.tutorial.hud } : null; },
    _cellCenter: function (r, c) { var p = cellPt(r, c), rr = rootRect(); return { x: rr.left + p.x, y: rr.top + p.y }; },
    _stats: function () { return { desyncs: G.desyncs, lastDiff: G.lastDiff, loadMs: G.loadMs, loadAllMs: G.loadAllMs, particles: G.fx ? G.fx.count() : 0, cell: G.R ? G.R.cell : 0, side: G.R ? G.R.side : 0 }; },
    _result: function () { return G.lastResult || null; },
    _debugEnd: debugEnd,
    _setState: testSetState,
    _useBooster: function (type, cell) { if (!canPlay()) return false; arm(type); onTapCell(cell); return true; },
  };
})();
