/* Cocardo: ¡Rescate Helado! — Landing page.
 * Reutiliza el arte vectorial del juego (Cocardo.Art) y los datos de historia (Cocardo.Story, Cocardo.Levels). */
(function () {
  'use strict';
  var C = window.Cocardo || {};
  var Art = C.Art, Story = C.Story, Levels = C.Levels, Daily = C.Daily;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ---------- arte declarativo: data-art="logo" | "tile:L[:tipo|cara]" | "portrait:id:ánimo" | "icon:nombre" | "ice" | "friend" ----------
  function artFor(spec) {
    if (!Art) return '';
    var p = spec.split(':');
    switch (p[0]) {
      case 'logo': return Art.logo();
      case 'icon': return Art.icon(p[1]);
      case 'ice': return Art.ice(2, 3);
      case 'friend': return Art.friend('lima', 2, 3);
      case 'portrait': return Art.portrait(p[1], p[2] || 'normal');
      case 'tile':
        if (p[1] === 'copa') return Art.tile(null, { type: 'copa' });
        if (p[2] === 'ph' || p[2] === 'pv' || p[2] === 'bomba') return Art.tile(p[1], { type: p[2] });
        return Art.tile(p[1], { face: p[2] || 'normal' });
    }
    return '';
  }
  $$('[data-art]').forEach(function (el) {
    try { el.innerHTML = artFor(el.getAttribute('data-art')); } catch (e) { /* el arte es decorativo */ }
  });

  // ---------- navegación ----------
  var nav = $('#nav'), burger = $('#burger'), menu = $('#menu'), fab = $('#fab');
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    document.body.classList.toggle('no-scroll', open);
  }
  burger.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  window.matchMedia('(min-width: 900px)').addEventListener('change', function () { setMenu(false); });

  var hero = $('.hero');
  function onScroll() {
    var y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 10);
    fab.classList.toggle('is-visible', y > hero.offsetHeight * 0.75);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // sección activa en el menú
  var links = $$('.nav__links a[href^="#"]');
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var t = $(a.getAttribute('href')); if (t) spy.observe(t); });
  }

  // ---------- capítulos ----------
  var chaptersEl = $('#chapters');
  if (Levels && Levels.chapters) {
    var parts = (Story && Story.chapterTitles) || [];
    var bosses = ['lima', 'fresa', 'durazna', 'naranja', 'uva', 'cocardo'];
    chaptersEl.innerHTML = Levels.chapters.map(function (ch, i) {
      return '<li class="chapter reveal" style="--c:' + ch.color + '">' +
        '<span class="chapter__num">' + ch.id + '</span>' +
        '<div class="chapter__body"><small>' + (parts[i] || '') + ' · ' + ch.zone + '</small>' +
        '<h3>' + ch.name + '</h3>' +
        '<span class="chapter__levels">Niveles ' + ch.levels[0] + '–' + ch.levels[ch.levels.length - 1] + '</span></div>' +
        '<span class="chapter__face" aria-hidden="true">' + safe(function () { return Art.portrait(bosses[i], i === 5 ? 'llorando' : 'asustado', { frozen: i < 5 }); }) + '</span>' +
        '</li>';
    }).join('');
  }

  function safe(fn) { try { return fn(); } catch (e) { return ''; } }

  // ---------- frases en la «tele» ----------
  var album = (Story && Story.album) || [];
  var tvQuote = $('#tvQuote'), tvCast = $('#tvCast');
  var tvIds = ['pina', 'cocardo', 'lima', 'cereza', 'banano', 'durazna'];
  var tvItems = tvIds.map(function (id) { return album.filter(function (a) { return a.id === id; })[0]; }).filter(Boolean);
  if (tvItems.length) {
    tvCast.innerHTML = tvItems.map(function (a, i) {
      return '<button class="tv__btn' + (i === 0 ? ' is-on' : '') + '" data-i="' + i + '" aria-label="Frase de ' + a.name + '">' +
        safe(function () { return Art.portrait(a.id, 'normal'); }) + '</button>';
    }).join('');
    var tvI = 0, tvTimer;
    var showQuote = function (i) {
      tvI = i;
      var a = tvItems[i];
      tvQuote.classList.remove('is-in');
      void tvQuote.offsetWidth;
      tvQuote.innerHTML = '<p>«' + a.quote + '»</p><footer>— ' + a.name + '</footer>';
      tvQuote.classList.add('is-in');
      $$('.tv__btn', tvCast).forEach(function (b, k) { b.classList.toggle('is-on', k === i); });
    };
    tvCast.addEventListener('click', function (e) {
      var b = e.target.closest('.tv__btn');
      if (!b) return;
      clearInterval(tvTimer);
      showQuote(+b.getAttribute('data-i'));
    });
    if (!reduced) tvTimer = setInterval(function () { showQuote((tvI + 1) % tvItems.length); }, 5200);
  }

  // ---------- reparto (con víctimas congeladas que se descongelan al tocarlas) ----------
  var castIds = ['cocardo', 'lima', 'cereza', 'pina', 'banano', 'banana', 'fresa', 'durazna', 'uva', 'naranja', 'guardaespaldas', 'limon'];
  var victims = { lima: 1, banana: 1, fresa: 1, durazna: 1, uva: 1, naranja: 1 };
  var castGrid = $('#castGrid');
  var castItems = castIds.map(function (id) { return album.filter(function (a) { return a.id === id; })[0]; }).filter(Boolean);
  castGrid.innerHTML = castItems.map(function (a) {
    var frozen = !!victims[a.id];
    var col = (Art && Art.characters && Art.characters[a.id] && Art.characters[a.id].color) || '#ff6fa5';
    return '<article class="char reveal' + (frozen ? ' is-frozen' : '') + '" style="--c:' + col + '">' +
      (frozen
        ? '<button class="char__pic" data-id="' + a.id + '" aria-label="Descongelar a ' + a.name + '">'
        : '<div class="char__pic">') +
      safe(function () { return Art.portrait(a.id, frozen ? 'asustado' : 'normal', { frozen: frozen }); }) +
      (frozen ? '<span class="char__hint">Toca para descongelar</span></button>' : '</div>') +
      '<h3>' + a.name + '</h3><p class="char__role">' + a.role + '</p>' +
      '<p class="char__quote">«' + a.quote + '»</p></article>';
  }).join('');
  castGrid.addEventListener('click', function (e) {
    var b = e.target.closest('.char__pic[data-id]');
    if (!b) return;
    var card = b.parentNode, id = b.getAttribute('data-id');
    if (!card.classList.contains('is-frozen')) return;
    card.classList.remove('is-frozen');
    card.classList.add('is-thawed');
    b.innerHTML = safe(function () { return Art.portrait(id, 'feliz'); }) + '<span class="char__hint">¡Rescatado!</span>';
    b.setAttribute('aria-label', '¡Rescataste a ' + C.Story.nameOf(id) + '!');
    burst(b);
  });

  function burst(el) {
    if (reduced) return;
    var r = el.getBoundingClientRect();
    var bits = ['❄', '✦', '♥', '❄', '✦', '❄', '♥', '✦'];
    bits.forEach(function (ch, i) {
      var s = document.createElement('span');
      s.className = 'spark';
      s.textContent = ch;
      var a = (i / bits.length) * Math.PI * 2;
      s.style.left = (r.left + r.width / 2) + 'px';
      s.style.top = (r.top + r.height / 2) + 'px';
      s.style.setProperty('--dx', Math.cos(a) * 90 + 'px');
      s.style.setProperty('--dy', Math.sin(a) * 90 + 'px');
      document.body.appendChild(s);
      setTimeout(function () { s.remove(); }, 900);
    });
  }

  // ---------- número del reto de hoy ----------
  if (Daily) {
    var d = new Date();
    var n = safe(function () { return Daily.challengeNumber(d.getFullYear(), d.getMonth() + 1, d.getDate()); });
    if (n > 0) $('#dailyNum').textContent = n;
  }

  // ---------- copos de nieve en el héroe ----------
  var flakes = $('.flakes');
  if (flakes && !reduced) {
    var html = '';
    for (var i = 0; i < 18; i++) {
      html += '<span style="left:' + (Math.random() * 100).toFixed(1) + '%;animation-delay:-' + (Math.random() * 14).toFixed(1) +
        's;animation-duration:' + (10 + Math.random() * 10).toFixed(1) + 's;font-size:' + (10 + Math.random() * 16).toFixed(0) + 'px">❄</span>';
    }
    flakes.innerHTML = html;
  }

  // ---------- aparición al hacer scroll ----------
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    document.documentElement.classList.add('js-reveal');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el, i) {
      el.style.setProperty('--d', (i % 4) * 70 + 'ms');
      io.observe(el);
    });
  }

  // ---------- mini tablero animado ----------
  var board = $('#board');
  if (!board || !Art) return;
  var N = 6, COLS = ['L', 'F', 'B', 'U', 'N'];
  var cache = {};
  function tileSvg(c, face) { var k = c + (face || ''); return cache[k] || (cache[k] = Art.tile(c, { face: face || 'normal' })); }
  function rnd(a) { return a[(Math.random() * a.length) | 0]; }
  var grid = [], cells = [];
  // tablero inicial sin tríos
  for (var r = 0; r < N; r++) {
    grid[r] = [];
    for (var c = 0; c < N; c++) {
      var opts = COLS.filter(function (k) {
        return !(c >= 2 && grid[r][c - 1] === k && grid[r][c - 2] === k) && !(r >= 2 && grid[r - 1][c] === k && grid[r - 2][c] === k);
      });
      grid[r][c] = rnd(opts);
    }
  }
  function place(el, r, c) { el.style.transform = 'translate(' + (c * 100) + '%,' + (r * 100) + '%)'; }
  for (r = 0; r < N; r++) {
    cells[r] = [];
    for (c = 0; c < N; c++) {
      var el = document.createElement('div');
      el.className = 'cell';
      el.innerHTML = tileSvg(grid[r][c]);
      place(el, r, c);
      board.appendChild(el);
      cells[r][c] = el;
    }
  }
  var goal = 20, moves = 24, goalEl = $('#goalCount'), movesEl = $('#movesCount');
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function setTile(r, c, k) {
    if (grid[r][c] === k) return;
    var el = cells[r][c];
    grid[r][c] = k;
    el.innerHTML = tileSvg(k);
    el.classList.remove('is-morph'); void el.offsetWidth; el.classList.add('is-morph');
  }

  async function step() {
    // prepara una jugada: fila r, columnas c..c+2; la ficha de c+2 viene de la fila de abajo (o arriba)
    var row = 1 + ((Math.random() * (N - 2)) | 0), col = (Math.random() * (N - 2)) | 0;
    var k = Math.random() < 0.45 ? 'L' : rnd(COLS);
    var other = rnd(COLS.filter(function (x) { return x !== k; }));
    var nr = Math.random() < 0.5 ? row - 1 : row + 1;
    setTile(row, col, k); setTile(row, col + 1, k); setTile(row, col + 2, other); setTile(nr, col + 2, k);
    await wait(500);
    // selección e intercambio
    var a = cells[row][col + 2], b = cells[nr][col + 2];
    b.classList.add('is-picked');
    await wait(380);
    place(a, nr, col + 2); place(b, row, col + 2);
    cells[row][col + 2] = b; cells[nr][col + 2] = a;
    grid[row][col + 2] = k; grid[nr][col + 2] = other;
    moves = Math.max(1, moves - 1); movesEl.textContent = moves;
    await wait(320);
    b.classList.remove('is-picked');
    // explota el trío
    var trio = [cells[row][col], cells[row][col + 1], cells[row][col + 2]];
    trio.forEach(function (t) { t.innerHTML = tileSvg(k, 'happy'); t.classList.add('is-pop'); });
    if (k === 'L') { goal = Math.max(0, goal - 3); goalEl.textContent = goal; goalEl.parentNode.classList.add('is-bump'); }
    await wait(380);
    goalEl.parentNode.classList.remove('is-bump');
    // caen las de arriba y entran nuevas
    for (var cc = col; cc < col + 3; cc++) {
      var popped = cells[row][cc];
      for (var rr = row; rr > 0; rr--) { cells[rr][cc] = cells[rr - 1][cc]; grid[rr][cc] = grid[rr - 1][cc]; place(cells[rr][cc], rr, cc); }
      var nk = rnd(COLS);
      popped.classList.remove('is-pop');
      popped.classList.add('no-anim');
      place(popped, -1, cc);
      popped.innerHTML = tileSvg(nk);
      void popped.offsetWidth;
      popped.classList.remove('no-anim');
      cells[0][cc] = popped; grid[0][cc] = nk;
      place(popped, 0, cc);
    }
    await wait(520);
    if (goal === 0 || moves <= 1) {
      await wait(600);
      goal = 20; moves = 24; goalEl.textContent = goal; movesEl.textContent = moves;
    }
  }

  if (!reduced) {
    var running = false, visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(board);
    }
    (async function loop() {
      if (running) return;
      running = true;
      for (;;) {
        if (visible && !document.hidden) await step();
        await wait(900);
      }
    })();
  }
})();
