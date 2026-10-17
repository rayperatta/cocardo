/* Cocardo: ¡Rescate Helado! — Interfaz (Shell): pantallas, capas, navegación y contabilidad de progreso.
 * Contrato: docs/ARQUITECTURA.md §10-§13. Pantallas: docs/DISENO.md §11. Reto Diario: §9. Guardado: §14.
 * El tablero (#screen-game) lo construye Cocardo.Game; aquí solo se monta una vez y se arranca/detiene. */
(function () {
  'use strict';

  var Cocardo = (window.Cocardo = window.Cocardo || {});
  var doc = document;

  /* ---------- utilidades ---------- */

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return ESC[ch]; }); }
  function el(html) {
    var t = doc.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(arr) { return arr && arr.length ? arr[rand(arr.length)] : null; }
  function later(fn, ms) { return setTimeout(fn, ms); }
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

  function play(name, opts) {
    try { if (Cocardo.Audio) Cocardo.Audio.play(name, opts); } catch (e) { /* el audio nunca rompe la UI */ }
  }
  function data() { return Cocardo.Save.get(); }
  function persist() { try { Cocardo.Save.save(); } catch (e) { /* nada */ } }

  function game() { return Cocardo.Game || null; }
  function gameCall(fn) {
    var g = game();
    if (!g || typeof g[fn] !== 'function') return undefined;
    try {
      return g[fn].apply(g, Array.prototype.slice.call(arguments, 1));
    } catch (e) {
      console.error('[Cocardo.Game.' + fn + ']', e);
      return undefined;
    }
  }

  /* ---------- movimiento reducido ---------- */

  var motionMQ = null;
  try { motionMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e) { motionMQ = null; }
  // settings.motion = estado del interruptor «Movimiento reducido»: 'on' activo, 'off' apagado, 'auto' según el sistema
  function reducedMotion() {
    var m = data().settings.motion;
    if (m === 'on') return true;
    if (m === 'off') return false;
    return !!(motionMQ && motionMQ.matches);
  }
  function applyMotion() {
    doc.body.classList.toggle('reduced-motion', reducedMotion());
    doc.body.classList.toggle('motion-ok', data().settings.motion === 'off');
  }

  function applySettings() {
    var s = data().settings;
    try {
      if (Cocardo.Audio) {
        Cocardo.Audio.setMuted(!s.sound);
        Cocardo.Audio.setMusic(!!s.music);
      }
    } catch (e) { /* nada */ }
    applyMotion();
  }

  /* ---------- arte (con respaldos si un módulo aún no existe) ---------- */

  var NAMES = {
    cocardo: 'Cocardo', lima: 'Lima', cereza: 'Cherry', pina: 'Don Piña', banano: 'Banano', banana: 'Banana',
    fresa: 'Fresa', durazna: 'Durazna', uva: 'Uva', naranja: 'Naranja', limon: 'Limón', policia_fresa: 'La oficial',
    policia_sandia: 'El oficial Sandía', guardaespaldas: 'El guardaespaldas', brocoli: 'El repartidor',
    reportera: 'La reportera', todos: 'Todos',
  };
  var FALLBACK_COLORS = {
    cocardo: '#7a4a2a', lima: '#7ed957', cereza: '#d61f4b', pina: '#f2b632', banano: '#f5d84a', banana: '#ffe27a',
    fresa: '#ff4d6d', durazna: '#ffad7a', uva: '#8e4fc9', naranja: '#ff9a1f', limon: '#f3e36a',
  };
  var COLOR_WHO = { L: 'lima', F: 'fresa', B: 'banana', U: 'uva', N: 'naranja', D: 'durazna' };
  var VICTIMS = ['lima', 'fresa', 'banana', 'uva', 'naranja', 'durazna'];
  var BOOSTERS = [
    { id: 'cucharon', name: 'Cucharón', level: 7 },
    { id: 'chorro', name: 'Chorro de Lima', level: 11 },
    { id: 'batido', name: 'Batido de Fresa', level: 14 },
  ];

  function art(fn) {
    var A = Cocardo.Art;
    if (!A || typeof A[fn] !== 'function') return '';
    try { return A[fn].apply(A, Array.prototype.slice.call(arguments, 1)) || ''; } catch (e) { return ''; }
  }
  function icon(name, size) { return art('icon', name, { size: size || 24 }); }
  function knownChar(who) {
    var A = Cocardo.Art;
    return !!((A && A.characters && A.characters[who]) || (NAMES[who] && who !== 'todos'));
  }
  function nameOf(who) {
    var A = Cocardo.Art;
    var c = A && A.characters && A.characters[who];
    if (c && c.name) return c.name;
    if (NAMES[who]) return NAMES[who];
    return who ? String(who).charAt(0).toUpperCase() + String(who).slice(1) : '';
  }
  function portrait(who, mood, opts) {
    var svg = art('portrait', who, mood || 'normal', opts || {});
    if (svg) return svg;
    // respaldo: medallón con la inicial
    var col = (opts && opts.silhouette) ? '#3a5f84' : (FALLBACK_COLORS[who] || '#ff6fa5');
    var ch = (opts && opts.silhouette) ? '?' : esc(nameOf(who).charAt(0));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="96" r="70" fill="' + col +
      '" stroke="#2b1630" stroke-width="8"/><text x="100" y="124" text-anchor="middle" font-size="80" font-family="Lilita One, sans-serif" fill="#fff">' +
      ch + '</text></svg>';
  }

  /* ---------- datos de contenido (con respaldos) ---------- */

  function levelList() { return (Cocardo.Levels && Cocardo.Levels.list) || []; }
  function levelCount() { return (Cocardo.Levels && Cocardo.Levels.count) || levelList().length || 30; }
  function getLevel(id) {
    var L = Cocardo.Levels;
    var lv = null;
    try { lv = L && typeof L.get === 'function' ? L.get(id) : null; } catch (e) { lv = null; }
    return lv || levelList()[id - 1] || null;
  }
  /* ---------- hoja de ruta: capítulos con fecha (Cocardo.Roadmap) ---------- */

  function roadmap() { return Cocardo.Roadmap || null; }
  // Fecha local de hoy (YYYYMMDD). Con #debug, Cocardo.debugToday = 20261030 simula otro día (o debug.today(k)).
  function todayKey() {
    var o = Cocardo.debugToday;
    if (o && /^\d{8}$/.test(String(o))) return Number(o);
    return keyOf(dateParts(0));
  }
  // Capítulos construidos y en construcción, en orden y con su estado para hoy (Roadmap.merged).
  // Sin Roadmap: solo los construidos, todos abiertos.
  function chapterStates() {
    var R = roadmap();
    var chs = chapters();
    if (R) {
      try { return R.merged(chs, todayKey()); } catch (e) { console.error('[Cocardo.Roadmap.merged]', e); }
    }
    return chs.map(function (ch) {
      return { id: ch.id, name: ch.name, zone: ch.zone, color: ch.color, levels: ch.levels, built: true, state: 'abierto', when: '', days: null, season: 1, seasonName: '' };
    });
  }
  function chapterStateOf(id) {
    var all = chapterStates();
    for (var i = 0; i < all.length; i++) if (all[i].levels && all[i].levels.indexOf(id) >= 0) return all[i];
    return null;
  }
  // Último nivel que se puede jugar hoy: capítulos construidos y ya abiertos por fecha, de corrido desde el 1
  function openCount() {
    var count = levelCount();
    var R = roadmap();
    if (!R) return count;
    var n = count;
    try { n = R.openCount(chapters(), todayKey()) | 0; } catch (e) { n = count; }
    return Math.max(0, Math.min(count, n));
  }
  function playable(id) { return id >= 1 && id <= openCount(); }
  // Tope de niveles del guardado (stars/best): hasta ahí puede avanzar `unlocked` aunque el capítulo no exista aún
  function maxLevels() { var R = roadmap(); return (R && R.MAX_LEVELS) || levelCount(); }
  function nextOpening() {
    var R = roadmap();
    if (!R) return null;
    try { return R.nextOpening(chapters(), todayKey()); } catch (e) { return null; }
  }

  // Respaldo por si Cocardo.Levels no cargó: mismos nombres, zonas y colores que js/core/levels.js
  var DEFAULT_CHAPTERS = [
    { id: 1, name: 'La nieve de Lima', zone: "Coco's Scoops", color: '#ff6fa5' },
    { id: 2, name: 'Necesitamos un nuevo sabor', zone: "Coco's Scoops", color: '#a1286a' },
    { id: 3, name: 'Voy a ampliar el menú', zone: 'La trastienda', color: '#4aa8e0' },
    { id: 4, name: 'Cherry conoce el negocio', zone: 'El vecindario de Cherry', color: '#d61f4b' },
    { id: 5, name: 'La fuga', zone: 'La noche de la tormenta', color: '#5b1e74' },
    { id: 6, name: 'Se acabó el sabor', zone: 'Los congeladores', color: '#2a6fb0' },
  ];
  function chapters() {
    var ch = Cocardo.Levels && Cocardo.Levels.chapters;
    if (ch && ch.length) return ch;
    return DEFAULT_CHAPTERS.map(function (c, i) {
      return { id: c.id, name: c.name, zone: c.zone, color: c.color, levels: [1, 2, 3, 4, 5].map(function (k) { return i * 5 + k; }) };
    });
  }
  function chapterOf(id) {
    var chs = chapters();
    for (var i = 0; i < chs.length; i++) if (chs[i].levels && chs[i].levels.indexOf(id) >= 0) return chs[i];
    return chs[Math.min(chs.length - 1, Math.max(0, Math.ceil(id / 5) - 1))];
  }
  function isFinale(id) {
    var lv = getLevel(id);
    var ch = chapterOf(id);
    return !!((lv && (lv.boss || lv.final)) || (ch && ch.levels && ch.levels[ch.levels.length - 1] === id));
  }

  function story() { return Cocardo.Story || {}; }
  function scenesFor(id) {
    try { return (typeof story().forLevel === 'function' && story().forLevel(id)) || {}; } catch (e) { return {}; }
  }
  function script(key) {
    var s = story().scripts;
    return (s && key && Array.isArray(s[key]) && s[key].length) ? s[key] : null;
  }
  function villainFor(id) {
    try { if (typeof story().villainFor === 'function') return story().villainFor(id) || 'cocardo'; } catch (e) { /* nada */ }
    return id > 20 ? 'cereza' : 'cocardo';
  }
  function helperFor(id) {
    try { if (typeof story().helperFor === 'function') return story().helperFor(id) || 'lima'; } catch (e) { /* nada */ }
    return id > 20 ? 'banano' : 'lima';
  }
  function helperFrozen(id) {
    try { return typeof story().helperFrozen === 'function' && !!story().helperFrozen(id); } catch (e) { return false; }
  }
  function tipFor(id) {
    var t = story().tips;
    return (t && t[id]) || '';
  }
  function tauntFor(who, kind) {
    var t = story().taunts;
    var list = t && t[who] && t[who][kind];
    return pick(list) || '';
  }
  // Dueño del congelador o villano principal del nivel (para la cara de los jefes)
  function bossFace(id) {
    var lv = getLevel(id);
    if (lv && lv.freezer && lv.freezer.who) return lv.freezer.who;
    return villainFor(id);
  }
  function rescueLevelOf(who) {
    var list = levelList();
    for (var i = 0; i < list.length; i++) if (list[i].rescue && list[i].rescue.indexOf(who) >= 0) return list[i].id;
    return 0;
  }

  /* ---------- pantallas ---------- */

  var SCREENS = ['title', 'map', 'game', 'daily', 'album', 'settings'];
  var current = null;
  var renderers = {};

  function show(name) {
    if (SCREENS.indexOf(name) < 0) return;
    var prev = current;
    current = name;
    SCREENS.forEach(function (n) {
      var s = doc.getElementById('screen-' + n);
      if (!s) return;
      if (n === name) {
        s.hidden = false;
        if (prev !== name) {
          s.classList.remove('screen-in');
          void s.offsetWidth;
          s.classList.add('screen-in');
        }
      } else {
        s.hidden = true;
      }
    });
    if (name !== 'daily') stopDailyTimer();
    if (renderers[name]) renderers[name]();
    if (name === 'map' && queuedScenes.length) later(flushQueuedScenes, 0);
    if (name === 'game') {
      requestAnimationFrame(function () { gameCall('resize'); });
    }
  }

  /* ---------- capas (overlays) ---------- */

  var stack = [];

  function overlayRoot() { return doc.getElementById('overlays'); }

  function openOverlay(name, content, opts) {
    opts = opts || {};
    var o = el('<div class="overlay overlay-' + name + '" role="dialog" aria-modal="true" data-name="' + name + '"></div>');
    if (opts.label) o.setAttribute('aria-label', opts.label);
    if (typeof content === 'string') o.innerHTML = content;
    else if (content) o.appendChild(content);
    overlayRoot().appendChild(o);
    var entry = { name: name, el: o, onEsc: opts.onEsc || null, prevFocus: doc.activeElement, openedAt: now() };
    stack.push(entry);
    if (opts.guard) guardClicks(entry);
    focusFirst(o);
    return o;
  }
  // Capas que se abren justo después de un toque (nodo del mapa, carta del Álbum, toque que salta la
  // celebración del tablero): el segundo toque de un doble toque no debe cerrarlas ni pulsar sus botones.
  // Un clic de puntero solo cuenta si su pointerdown empezó dentro de la capa y al menos GUARD_MS después de
  // abrirla (el toque que la abrió también suelta su clic encima, y en táctil llega con detail 0).
  // Teclado (Enter/Espacio dentro de la capa) y click() programático (isTrusted false) siempre pasan.
  var GUARD_MS = 350;
  function guardClicks(entry) {
    var o = entry.el;
    var downAt = -1;
    o.addEventListener('pointerdown', function () { downAt = now(); }, true);
    o.addEventListener('click', function (ev) {
      // entry.keyAt lo marca onKeyDown (Enter/Espacio con esta capa arriba)
      var keyed = entry.keyAt != null && now() - entry.keyAt < 1500;
      var stray = ev.isTrusted !== false && !keyed && (downAt < 0 || downAt - entry.openedAt < GUARD_MS);
      downAt = -1;
      entry.keyAt = null;
      if (stray) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
      }
    }, true);
  }
  function focusFirst(o) {
    var f = o.querySelector('[data-autofocus]') || o.querySelector('button, [tabindex="0"], textarea');
    if (f) {
      try { f.focus({ preventScroll: true }); } catch (e) { try { f.focus(); } catch (e2) { /* nada */ } }
    }
  }
  function findEntry(target) {
    for (var i = stack.length - 1; i >= 0; i--) {
      if (stack[i].el === target || stack[i].name === target) return i;
    }
    return -1;
  }
  function closeOverlay(target, instant) {
    var i = findEntry(target);
    if (i < 0) return;
    var entry = stack.splice(i, 1)[0];
    var o = entry.el;
    if (entry.cleanup) { try { entry.cleanup(); } catch (e) { /* nada */ } }
    if (instant || reducedMotion()) {
      o.remove();
    } else {
      o.classList.add('closing');
      later(function () { o.remove(); }, 200);
    }
    var top = stack[stack.length - 1];
    if (top) focusFirst(top.el);
    else if (entry.prevFocus && entry.prevFocus.isConnected && typeof entry.prevFocus.focus === 'function') {
      try { entry.prevFocus.focus({ preventScroll: true }); } catch (e) { /* nada */ }
    }
  }
  function closeAllOverlays() {
    while (stack.length) closeOverlay(stack[stack.length - 1].el, true);
  }
  function topOverlay() { return stack.length ? stack[stack.length - 1] : null; }
  function isOpen(name) { return findEntry(name) >= 0; }

  /* ---------- aviso (toast) ---------- */

  var toastTimer = 0;
  function toast(msg, ms) {
    var t = doc.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    t.classList.remove('toast-in');
    void t.offsetWidth;
    t.classList.add('toast-in');
    clearTimeout(toastTimer);
    toastTimer = later(function () { t.hidden = true; }, ms || 1900);
  }

  function flash(kind) {
    var f = doc.getElementById('flash');
    if (!f) return;
    f.className = 'flash flash-' + (kind || 'white');
    void f.offsetWidth;
    f.classList.add('flash-on');
  }

  /* ---------- nube: cuenta, apodo, ranking y clips (ARQUITECTURA §14-§16) ---------- */

  var askedNick = false, lastCloudError = '', pendingGo = null, pendingClip = null, rankTab = 'daily';
  var AVATARS = ['lima', 'fresa', 'banana', 'uva', 'naranja', 'durazna', 'cocardo', 'cereza', 'pina', 'banano',
    'limon', 'policia_fresa', 'policia_sandia', 'guardaespaldas', 'brocoli', 'reportera'];

  function cloud() { return Cocardo.Cloud || null; }
  function cloudOn() { var c = cloud(); return !!(c && c.available && c.available()); }
  function cloudUser() { var c = cloud(); return c && c.user ? c.user() : null; }
  function cloudProfile() { var c = cloud(); return c && c.profile ? c.profile() : null; }
  // apodo y avatar: del perfil vivo o de la copia en el guardado (antes de que cargue el SDK)
  function cloudNick() {
    var p = cloudProfile();
    if (p && p.nick) return p.nick;
    var cc = data().cloud;
    return (cc && cc.on && cc.nick) ? cc.nick : '';
  }
  function cloudAvatar() {
    var p = cloudProfile();
    if (p && p.avatar) return p.avatar;
    var cc = data().cloud;
    return (cc && cc.avatar) || 'lima';
  }
  function track(name, params) { try { if (Cocardo.Track) Cocardo.Track.event(name, params || {}); } catch (e) { /* nada */ } }
  function cloudPush() { try { var c = cloud(); if (c && cloudUser()) c.push(); } catch (e) { /* nada */ } }
  // Manda al ranking el intento oficial del día (si hay sesión y apodo). Se reintenta al entrar más tarde.
  function cloudSubmitDaily(key) {
    var c = cloud();
    var r = data().daily.results[key];
    if (!c || !r || !cloudUser() || !cloudProfile()) return;
    c.submitDaily(key, { won: r.won, score: r.score, stars: r.stars, movesUsed: r.movesUsed, movesTotal: r.movesTotal, maxCombo: r.maxCombo, num: r.num })
      .then(function (sent) { if (sent && current === 'daily') renderDaily(); });
  }
  function onCloudChange(snap) {
    refreshTitleChip();
    if (current === 'settings') renderSettings();
    else if (current === 'daily') renderDaily();
    if (snap.user && snap.profile) cloudSubmitDaily(keyOf(dateParts(0)));
    // primera vez con cuenta y sin apodo: se pide uno (una sola vez por sesión)
    if (snap.user && snap.profileReady && !snap.profile && !askedNick && !isOpen('profile')) {
      askedNick = true;
      showProfileEditor(true);
    }
    if (snap.error && snap.error !== lastCloudError) { lastCloudError = snap.error; toast(snap.error, 4500); }
  }

  function accountChipHtml() {
    if (!cloudOn()) return '';
    var nick = cloudNick();
    if (nick) {
      return '<button class="account-chip chip-in" data-act="account" aria-label="Mi cuenta: ' + esc(nick) + '"><span class="chip-face">' + portrait(cloudAvatar(), 'feliz') + '</span><span class="chip-txt">' + esc(nick) + '</span></button>';
    }
    return '<button class="account-chip" data-act="account" aria-label="Entrar con tu cuenta"><span class="chip-face">' + icon('user', 22) + '</span><span class="chip-txt">Entrar</span></button>';
  }
  function socialRowHtml() {
    var so = (Cocardo.CloudConfig && Cocardo.CloudConfig.social) || {};
    var out = '';
    if (so.tiktok) out += '<a href="https://www.tiktok.com/@' + esc(String(so.tiktok).replace(/^@/, '')) + '" target="_blank" rel="noopener" aria-label="TikTok">TT</a>';
    if (so.instagram) out += '<a href="https://www.instagram.com/' + esc(String(so.instagram).replace(/^@/, '')) + '" target="_blank" rel="noopener" aria-label="Instagram">IG</a>';
    return out ? '<div class="social-row">' + out + '</div>' : '';
  }
  function refreshTitleChip() {
    var sec = doc.getElementById('screen-title');
    var old = sec ? $('.account-chip', sec) : null;
    if (!old) return;
    var html = accountChipHtml();
    if (!html) { old.remove(); return; }
    old.parentNode.replaceChild(el(html), old);
  }

  function statsPills() {
    var sum = Cocardo.Progress ? Cocardo.Progress.summary(data()) : { stars: 0, levels: 0, rescued: 0, bestStreak: 0 };
    return '<div class="account-stats"><span class="pill">' + icon('star', 18) + ' ' + sum.stars + '</span>' +
      '<span class="pill">' + icon('map', 18) + ' ' + sum.levels + ' niv.</span>' +
      '<span class="pill">' + icon('flame', 18) + ' ' + sum.bestStreak + '</span></div>';
  }

  // Ventana de cuenta: entrar (Google o apodo sin cuenta) o ver el perfil
  function showAccount() {
    var c = cloud();
    if (!c || !cloudOn()) { toast('Las cuentas no están disponibles en esta copia del juego'); return; }
    if (isOpen('account')) closeOverlay('account', true);
    var u = cloudUser(), st = c.state();
    var nick = cloudNick();
    var inApp = c.inAppBrowser();
    var body;
    if (u) {
      body = '<span class="account-face big">' + portrait(cloudAvatar(), 'feliz') + '</span>' +
        '<h2 class="card-title">' + esc(nick || 'Sin apodo') + '</h2>' +
        '<p class="account-note">' + (u.anon ? 'Apodo sin cuenta (solo en este aparato)' : 'Cuenta de Google' + (u.name ? ' · ' + esc(u.name) : '')) + '</p>' +
        statsPills() +
        '<div class="btn-col">' +
          '<button class="btn btn-gold" data-act="profile" data-autofocus>' + icon('user', 22) + ' ' + (nick ? 'Cambiar apodo o avatar' : 'Elegir apodo') + '</button>' +
          (u.anon && !inApp ? '<button class="btn btn-google" data-act="google">' + icon('google', 22) + ' Vincular con Google</button>' : '') +
          '<div class="btn-row"><button class="btn btn-white btn-sm" data-act="sync">' + icon('cloud', 20) + ' Sincronizar</button>' +
          '<button class="btn btn-white btn-sm" data-act="logout">' + icon('logout', 20) + ' Salir</button></div>' +
        '</div>' +
        (u.anon ? '<p class="account-note">Vincula tu Google para no perder el apodo ni el progreso si cambias de celular.</p>' : '');
    } else {
      body = '<span class="account-face big">' + icon('user', 56) + '</span>' +
        '<h2 class="card-title">Tu cuenta</h2>' +
        '<p class="account-note">Guarda tu progreso en la nube, elige un apodo y entra al ranking del Reto Diario.</p>' +
        (inApp ? '<p class="account-note warn">Estás dentro de otra app (TikTok, Instagram…) y Google no deja entrar desde aquí. Abre el juego en Chrome o Safari (menú ⋯ → «Abrir en el navegador») o juega con un apodo.</p>' : '') +
        '<div class="btn-col">' +
          (inApp
            ? '<button class="btn btn-gold" data-act="copylink" data-autofocus>' + icon('share', 22) + ' Copiar enlace del juego</button>'
            : '<button class="btn btn-google" data-act="google" data-autofocus' + (st === 'loading' ? ' disabled' : '') + '>' + icon('google', 22) + ' ' + (st === 'loading' ? 'Conectando…' : 'Entrar con Google') + '</button>') +
          '<button class="btn btn-white btn-sm" data-act="anon">Jugar con apodo (sin cuenta)</button>' +
          '<button class="btn btn-white btn-sm" data-act="close">Ahora no</button>' +
        '</div>';
    }
    var o = openOverlay('account',
      '<div class="card pop account-card profile-card">' +
        '<button class="close-btn" data-act="close" aria-label="Cerrar">' + icon('close', 22) + '</button>' + body + '</div>',
    { label: 'Tu cuenta', onEsc: function () { closeOverlay('account'); } });
    o.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-act]');
      if (!t) { if (ev.target === o) closeOverlay(o); return; }
      var act = t.getAttribute('data-act');
      if (act === 'close') { closeOverlay(o); return; }
      if (act === 'copylink') { share('Juega Cocardo: ¡Rescate Helado! 🍦'); return; }
      closeOverlay(o, true);
      if (act === 'profile') showProfileEditor(false);
      else if (act === 'google') doSignIn();
      else if (act === 'anon') doSignInAnon();
      else if (act === 'sync') doSync();
      else if (act === 'logout') doSignOut();
    });
    return o;
  }

  // Apodo y avatar (first = recién creada la cuenta, sin apodo todavía)
  function showProfileEditor(first) {
    var c = cloud();
    if (!c || !cloudUser()) { showAccount(); return; }
    if (isOpen('profile')) closeOverlay('profile', true);
    var p = cloudProfile();
    var nick = (p && p.nick) || c.suggestNick();
    var avatar = (p && p.avatar) || 'lima';
    var chosen = avatar;
    var grid = AVATARS.map(function (id) {
      return '<button type="button" class="avatar-opt' + (id === avatar ? ' on' : '') + '" data-avatar="' + id + '" aria-label="' + esc(nameOf(id)) + '" aria-pressed="' + (id === avatar ? 'true' : 'false') + '">' + portrait(id, 'feliz') + '</button>';
    }).join('');
    var input = null;
    var o = openOverlay('profile',
      '<div class="card pop profile-card">' +
        (first ? '' : '<button class="close-btn" data-act="close" aria-label="Cerrar">' + icon('close', 22) + '</button>') +
        '<h2 class="card-title">' + (first ? '¡Elige tu apodo!' : 'Tu apodo y avatar') + '</h2>' +
        '<div class="nick-field"><label for="nick-input">Apodo (3 a 16 letras)</label>' +
          '<input id="nick-input" class="nick-input" type="text" maxlength="16" autocomplete="nickname" autocapitalize="off" spellcheck="false" value="' + esc(nick) + '">' +
          '<small class="nick-hint js-hint">Así te verán en el ranking.</small></div>' +
        '<div class="avatar-grid" role="group" aria-label="Avatar">' + grid + '</div>' +
        '<div class="btn-col"><button class="btn btn-pink btn-big" data-act="save">' + icon('check', 24) + ' Guardar</button>' +
          (first ? '<button class="btn btn-white btn-sm" data-act="close">Después</button>' : '') + '</div>' +
      '</div>',
    { label: 'Apodo y avatar', onEsc: function () { closeOverlay('profile'); },
      onKey: function (ev) { if (ev.key === 'Enter' && input && doc.activeElement === input) { save(); return true; } return false; } });
    input = $('#nick-input', o);
    var hint = $('.js-hint', o);
    function check() {
      var v = Cocardo.Progress.validNick(input.value);
      hint.textContent = v.ok ? 'Así te verán en el ranking.' : v.reason;
      hint.classList.toggle('bad', !v.ok);
      return v;
    }
    input.addEventListener('input', check);
    var saving = false;
    function save() {
      if (saving) return;
      var v = check();
      if (!v.ok) { play('invalid'); try { input.focus(); } catch (e) { /* nada */ } return; }
      saving = true;
      var btn = $('[data-act="save"]', o);
      btn.disabled = true;
      btn.textContent = 'Guardando…';
      c.saveProfile({ nick: v.nick, avatar: chosen }).then(function (r) {
        saving = false;
        if (r && r.ok) {
          track('nick_set', {});
          closeOverlay(o, true);
          toast('¡Listo, ' + r.nick + '! Ya estás en el ranking.', 3000);
          play('booster');
          refreshTitleChip();
          if (current === 'settings') renderSettings();
          else if (current === 'daily') renderDaily();
          cloudSubmitDaily(keyOf(dateParts(0)));
        } else {
          btn.disabled = false;
          btn.innerHTML = icon('check', 24) + ' Guardar';
          hint.textContent = (r && r.reason) || 'No se pudo guardar';
          hint.classList.add('bad');
          play('invalid');
        }
      });
    }
    o.addEventListener('click', function (ev) {
      var a = ev.target.closest('[data-avatar]');
      if (a) {
        chosen = a.getAttribute('data-avatar');
        $$('.avatar-opt', o).forEach(function (b) { var on = b === a; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        return;
      }
      var t = ev.target.closest('[data-act]');
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (act === 'save') save();
      else if (act === 'close') closeOverlay(o);
    });
    later(function () { try { input.focus(); input.select(); } catch (e) { /* nada */ } }, 150);
    return o;
  }

  function doSignIn() {
    var c = cloud();
    if (!c) return;
    if (c.inAppBrowser()) { showAccount(); return; }
    toast('Conectando con Google…', 2500);
    c.signIn().then(function (u) {
      if (!u) return;
      track('sign_in', { method: u.anon ? 'anon' : 'google' });
      toast(u.name ? '¡Hola, ' + u.name.split(' ')[0] + '!' : '¡Listo!');
      play('booster');
    }, function (e) { var m = c.message(e); if (m) toast(m, 4500); });
  }
  function doSignInAnon() {
    var c = cloud();
    if (!c) return;
    c.signInAnon().then(function () { track('sign_in', { method: 'anon' }); }, function (e) { var m = c.message(e); if (m) toast(m, 4500); });
  }
  function doSync() {
    var c = cloud();
    if (!c || !cloudUser()) { showAccount(); return; }
    toast('Sincronizando…');
    c.sync().then(function (ok) {
      toast(ok ? 'Progreso sincronizado' : 'No se pudo sincronizar', 2500);
      if (current === 'settings') renderSettings();
      else if (current === 'map') renderMap();
    });
  }
  function doSignOut() {
    var c = cloud();
    if (!c) return;
    c.signOut().then(function () { track('sign_out', {}); toast('Sesión cerrada. Tu progreso sigue en este aparato.', 3000); });
  }

  // Tarjeta de cuenta en Ajustes
  function accountCardHtml() {
    if (!cloudOn()) return '';
    var c = cloud();
    var st = c.state();
    var u = cloudUser();
    var nick = cloudNick();
    var restoring = !u && data().cloud && data().cloud.on && (st === 'idle' || st === 'loading');
    var inner;
    if (u || restoring) {
      inner = '<div class="account-head"><span class="account-face">' + portrait(cloudAvatar(), 'feliz') + '</span>' +
        '<span class="account-name"><b>' + esc(nick || 'Sin apodo') + '</b><small>' + (u ? (u.anon ? 'Apodo sin cuenta' : 'Cuenta de Google') : 'Conectando…') + '</small></span></div>' +
        statsPills() +
        '<div class="btn-col">' +
          '<button class="btn btn-gold btn-sm" data-act="profile">' + icon('user', 20) + ' ' + (nick ? 'Cambiar apodo o avatar' : 'Elegir apodo') + '</button>' +
          (u && u.anon && !c.inAppBrowser() ? '<button class="btn btn-google btn-sm" data-act="google">' + icon('google', 20) + ' Vincular con Google</button>' : '') +
          '<div class="btn-row"><button class="btn btn-white btn-sm" data-act="sync">' + icon('cloud', 20) + ' Sincronizar</button>' +
          '<button class="btn btn-white btn-sm" data-act="logout">' + icon('logout', 20) + ' Salir</button></div>' +
        '</div>' +
        (u && u.anon ? '<p class="account-note">Vincula tu Google para no perder el apodo ni el progreso si cambias de celular.</p>' : '');
    } else {
      inner = '<div class="account-head"><span class="account-face">' + icon('user', 34) + '</span>' +
        '<span class="account-name"><b>Tu cuenta</b><small>Progreso en la nube y ranking</small></span></div>' +
        '<div class="btn-col"><button class="btn btn-google" data-act="google"' + (st === 'loading' ? ' disabled' : '') + '>' + icon('google', 22) + ' ' + (st === 'loading' ? 'Conectando…' : 'Entrar con Google') + '</button>' +
        '<button class="btn btn-white btn-sm" data-act="anon">Jugar con apodo (sin cuenta)</button></div>' +
        (c.inAppBrowser() ? '<p class="account-note warn">Estás dentro de otra app (TikTok, Instagram…). Google no deja entrar desde aquí: abre el juego en Chrome o Safari, o juega con apodo.</p>' : '');
    }
    var err = c.error();
    return '<div class="card settings-card account-card">' + inner + (err ? '<p class="account-note error">' + esc(err) + '</p>' : '') + '</div>';
  }

  /* ---------- ranking (Reto Diario) ---------- */

  function rankingCardHtml() {
    if (!cloudOn()) return '';
    var nick = cloudNick();
    return '<div class="card rank-card">' +
      '<h2 class="rank-title">' + icon('trophy', 26) + ' Ranking</h2>' +
      '<div class="rank-tabs" role="tablist">' +
        '<button class="rank-tab" role="tab" data-tab="daily" aria-selected="' + (rankTab === 'daily' ? 'true' : 'false') + '">Reto de hoy</button>' +
        '<button class="rank-tab" role="tab" data-tab="top" aria-selected="' + (rankTab === 'top' ? 'true' : 'false') + '">Estrellas</button></div>' +
      '<div class="rank-body"><p class="rank-empty">Cargando…</p></div>' +
      (nick ? '' : '<div class="rank-cta"><button class="btn btn-gold btn-sm" data-act="account">' + icon('user', 20) + ' Entra para aparecer aquí</button></div>') +
      '</div>';
  }
  function loadRanking(key) {
    var c = cloud();
    var sec = doc.getElementById('screen-daily');
    var body = sec ? $('.rank-body', sec) : null;
    if (!c || !body || !cloudOn()) return;
    var tab = rankTab;
    var p = tab === 'daily' ? c.dailyTop(key, 20) : c.topPlayers(20);
    p.then(function (rows) {
      if (!body.isConnected || rankTab !== tab) return;
      body.innerHTML = rankListHtml(rows || [], tab);
    }, function () {
      if (body.isConnected) body.innerHTML = '<p class="rank-empty">No se pudo cargar el ranking. Revisa tu conexión.</p>';
    });
  }
  function rankListHtml(rows, tab) {
    if (!rows.length) {
      return '<p class="rank-empty">' + (tab === 'daily' ? 'Nadie ha terminado el reto de hoy todavía. ¡Sé la primera persona!' : 'Todavía no hay rescatistas con apodo. ¡Sé la primera persona!') + '</p>';
    }
    var me = cloudUser();
    return '<ol class="rank-list">' + rows.map(function (r, i) {
      var mine = !!(me && r.uid === me.uid);
      var pos = i + 1;
      var medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : String(pos);
      var right, sub;
      if (tab === 'daily') {
        right = '<span class="rank-score' + (r.won ? '' : ' lost') + '">' + (r.won ? '⭐'.repeat(clamp(r.stars | 0, 1, 3)) + ' ' : '❌ ') + (r.score | 0).toLocaleString('es-MX') + '</span>';
        sub = (r.movesUsed | 0) + '/' + (r.movesTotal | 0) + ' movs';
      } else {
        // tope a lo jugable hoy: quien adelanta el reloj del teléfono no luce estrellas de capítulos aún cerrados
        var capN = openCount();
        right = '<span class="rank-score">' + icon('star', 16) + ' ' + Math.min(r.stars | 0, capN * 3) + '</span>';
        sub = Math.min(r.levels | 0, capN) + ' niveles · ' + (r.rescued | 0) + ' rescates' + (r.finished ? ' · 🏁' : '');
      }
      return '<li class="rank-row' + (mine ? ' me' : '') + '"><span class="rank-pos' + (pos <= 3 ? ' top' : '') + '">' + medal + '</span>' +
        '<span class="rank-face">' + portrait(r.avatar || 'lima', 'feliz') + '</span>' +
        '<span class="rank-nick">' + esc(r.nick || '???') + '<small>' + esc(sub) + '</small></span>' + right + '</li>';
    }).join('') + '</ol>';
  }

  /* ---------- clips 9:16 de la partida (Cocardo.Clip) ---------- */

  function clipsSupported() { try { return !!(Cocardo.Clip && Cocardo.Clip.supported()); } catch (e) { return false; } }
  // El lienzo del tablero (.cg-board); el de partículas (.cg-fx) cubre toda la pantalla y es transparente
  function gameCanvas() {
    var g = doc.getElementById('screen-game');
    if (!g) return null;
    return $('canvas.cg-board', g) || $$('canvas', g).filter(function (c) { return !/cg-fx/.test(c.className); })[0] || null;
  }
  function clipFooter() {
    var url = '';
    try {
      url = (Cocardo.CloudConfig && Cocardo.CloudConfig.siteUrl) || (/^https?:$/.test(location.protocol) ? location.host + location.pathname.replace(/index\.html$/, '') : '');
    } catch (e) { url = ''; }
    url = String(url).replace(/^https?:\/\//, '').replace(/\/$/, '');
    var nick = cloudNick();
    return (nick ? '@' + nick + ' · ' : '') + (url || 'Cocardo: ¡Rescate Helado!');
  }
  function clipHud() {
    var st = gameCall('_state') || {};
    var s = session || {};
    return {
      title: s.daily ? 'Reto #' + (s.dailyNum || '') : 'Nivel ' + (s.levelId || ''),
      sub: (s.level && s.level.name) || '',
      moves: st.movesLeft != null ? st.movesLeft : null,
      score: st.score != null ? st.score : null,
      footer: clipFooter(),
      cta: '¿Puedes tú? 🍦',
    };
  }
  function startClip() {
    var C = Cocardo.Clip;
    if (!clipsSupported() || C.recording()) return false;
    var cv = gameCanvas();
    if (!cv) return false;
    var audio = null;
    try { if (Cocardo.Audio && Cocardo.Audio.captureStream) audio = Cocardo.Audio.captureStream(); } catch (e) { audio = null; }
    C.discard();
    if (!C.start({ canvas: cv, hud: clipHud, audio: audio })) return false;
    showRecDot(true);
    return true;
  }
  // Termina la grabación; devuelve Promise<File|null>. discard = true tira el clip (salir al mapa, apagar el ajuste)
  function stopClip(discard) {
    var C = Cocardo.Clip;
    showRecDot(false);
    if (!C) return Promise.resolve(null);
    if (!C.recording()) return Promise.resolve(discard ? null : C.last());
    return C.stop().then(function (f) {
      if (discard) { C.discard(); return null; }
      return f;
    });
  }
  function showRecDot(on) {
    var d = doc.getElementById('rec-dot');
    if (!on) { if (d) d.remove(); return; }
    if (d) return;
    doc.body.appendChild(el('<div id="rec-dot" class="rec-dot" aria-hidden="true"><i></i>REC</div>'));
  }
  // Botón «Compartir clip» en Victoria/Derrota cuando hay un clip de esta partida
  function attachClipButton(o, textFn) {
    var C = Cocardo.Clip;
    if (!C) return;
    var p = pendingClip || Promise.resolve(C.last());
    p.then(function (f) {
      if (!f || !o.isConnected) return;
      var col = $('.btn-col', o);
      if (!col || $('.clip-btn', o)) return;
      var secs = Math.round(((C.lastMeta() || {}).ms || 0) / 1000);
      var b = el('<button class="btn btn-drama btn-sm clip-btn" data-act="clip">' + icon('video', 20) + ' Compartir clip' + (secs ? ' (' + secs + ' s)' : '') + '</button>');
      b.addEventListener('click', function (ev) { ev.stopPropagation(); shareClip(typeof textFn === 'function' ? textFn() : ''); });
      col.appendChild(b);
    });
  }
  function shareClip(text) {
    var C = Cocardo.Clip;
    if (!C || !C.last()) { toast('No hay clip de esta partida'); return; }
    track('clip', {});
    var url = shareUrl();
    C.share(C.last(), url ? (text ? text + '\n' : '') + url : (text || '')).then(function (r) {
      if (r === 'saved') toast('Clip guardado en tus descargas. ¡Súbelo a TikTok!', 3500);
      else if (r === 'fail') toast('No se pudo compartir el clip');
    });
  }

  // Parámetros de la dirección: ?r=apodo (invitación), ?go=daily (acceso directo), ?source=pwa (app instalada)
  function readQuery() {
    var q = '';
    try { q = location.search || ''; } catch (e) { q = ''; }
    if (!q) return;
    var m = /[?&]r=([^&#]+)/.exec(q);
    if (m) {
      var ref = '';
      try { ref = decodeURIComponent(m[1]).slice(0, 16); } catch (e) { ref = ''; }
      var v = Cocardo.Progress ? Cocardo.Progress.validNick(ref) : { ok: false };
      if (v.ok && !data().ref && ref !== cloudNick()) {
        data().ref = ref;
        persist();
        track('referral', { ref: ref });
        later(function () { toast('¡Te invitó ' + ref + '! A rescatar frutas 🍦', 3500); }, 900);
      }
    }
    if (/[?&]go=daily\b/.test(q)) pendingGo = 'daily';
    if (/[?&]source=pwa\b/.test(q)) track('pwa_open', {});
  }

  /* ---------- compartir ---------- */

  function shareUrl() {
    var base = '';
    try { base = /^https?:$/.test(location.protocol) ? location.href.split('#')[0].split('?')[0] : ''; } catch (e) { base = ''; }
    if (!base) { try { base = (Cocardo.CloudConfig && Cocardo.CloudConfig.siteUrl) || ''; } catch (e) { base = ''; } }
    if (!base) return '';
    // enlace de invitación: ?r=<apodo> (quien lo abre queda como referido y ve «Te invitó …»)
    var nick = cloudNick();
    return nick ? base + '?r=' + encodeURIComponent(nick) : base;
  }

  // En un iframe sin permiso (p. ej. el artifact) llamar a la API ya ensucia la consola: se pregunta antes
  function policyAllows(feature) {
    try {
      var pp = doc.permissionsPolicy || doc.featurePolicy;
      if (pp && typeof pp.allowsFeature === 'function') return !!pp.allowsFeature(feature);
    } catch (e) { /* sin política: se intenta */ }
    return true;
  }

  function share(text) {
    track('share', { screen: current || '' });
    var url = shareUrl();
    var full = url ? text + '\n' + url : text;
    function copyFallback() {
      var done = false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && policyAllows('clipboard-write')) {
          return navigator.clipboard.writeText(full).then(function () {
            toast('¡Copiado!');
            return 'copied';
          }, function () {
            showCopyBox(full);
            return 'box';
          });
        }
      } catch (e) { done = false; }
      if (!done) showCopyBox(full);
      return Promise.resolve('box');
    }
    try {
      if (navigator.share && policyAllows('web-share')) {
        return navigator.share({ text: full }).then(function () { return 'shared'; }, function (err) {
          if (err && err.name === 'AbortError') return 'abort';
          return copyFallback();
        });
      }
    } catch (e) { /* sigue con el portapapeles */ }
    return copyFallback();
  }

  /* ---------- imagen para compartir (tarjeta 1080x1920 para historias / TikTok) ---------- */

  var SHARE_W = 1080, SHARE_H = 1920;
  // ¿El navegador puede compartir archivos? (Web Share nivel 2, permitido en este marco)
  function canShareFiles() {
    try {
      if (!navigator.share || !navigator.canShare || typeof File !== 'function' || !policyAllows('web-share')) return false;
      return !!navigator.canShare({ files: [new File([new Uint8Array(8)], 'x.png', { type: 'image/png' })] });
    } catch (e) { return false; }
  }
  // Cambia el tamaño del <svg> raíz (se rasteriza nítido al tamaño final)
  function svgSized(svg, w, h) {
    return String(svg).replace(/<svg\b([^>]*)>/, function (m, attrs) {
      return '<svg' + attrs.replace(/\s(width|height)="[^"]*"/g, '') + ' width="' + w + '" height="' + h + '">';
    });
  }
  function svgImage(svg, w, h) {
    return new Promise(function (resolve) {
      if (!svg) { resolve(null); return; }
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgSized(svg, w, h));
    });
  }
  function wrapLines(g, text, maxW) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (cur && g.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // o: { id, stars, who, mood, line, zone, title, name }. Devuelve Promise<File|null>; nunca lanza.
  function buildShareImage(o) {
    var FONT = '"Lilita One", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    var BODY = '"Nunito", system-ui, sans-serif';
    var fontsReady = (doc.fonts && doc.fonts.load) ? Promise.all([doc.fonts.load('80px "Lilita One"'), doc.fonts.load('900 40px "Nunito"')]).catch(function () { return null; }) : Promise.resolve();
    var starOn = art('icon', 'star', { size: 24 });
    var starOff = String(art('icon', 'starEmpty', { size: 24 })).replace(/currentColor/g, '#2b1630');
    return Promise.all([
      // sin letreros de texto del fondo (el neón de la heladería quedaría detrás del retrato)
      svgImage(String(zoneBg(o.zone) || '').replace(/<text[\s\S]*?<\/text>/g, ''), SHARE_W, SHARE_H),
      svgImage(art('logo'), 720, 360), svgImage(portrait(o.who, o.mood), 700, 700),
      svgImage(starOn, 200, 200), svgImage(starOff, 200, 200), fontsReady,
    ]).then(function (im) {
      var cv = doc.createElement('canvas');
      cv.width = SHARE_W; cv.height = SHARE_H;
      var g = cv.getContext('2d');
      if (!g) return null;
      // fondo de la zona + velo de telenovela
      g.fillStyle = '#ffd3e3'; g.fillRect(0, 0, SHARE_W, SHARE_H);
      if (im[0]) g.drawImage(im[0], 0, 0, SHARE_W, SHARE_H);
      var veil = g.createLinearGradient(0, 0, 0, SHARE_H);
      veil.addColorStop(0, 'rgba(43,22,48,.15)'); veil.addColorStop(0.55, 'rgba(91,30,116,.35)'); veil.addColorStop(1, 'rgba(43,22,48,.85)');
      g.fillStyle = veil; g.fillRect(0, 0, SHARE_W, SHARE_H);
      if (im[1]) g.drawImage(im[1], (SHARE_W - 720) / 2, 60, 720, 360);
      // tarjeta crema
      roundRect(g, 70, 1060, SHARE_W - 140, 580, 60);
      g.fillStyle = '#fff6ea'; g.fill();
      g.lineWidth = 12; g.strokeStyle = '#2b1630'; g.stroke();
      // retrato grande que asoma sobre la tarjeta
      if (im[2]) g.drawImage(im[2], (SHARE_W - 700) / 2, 436, 700, 700);
      // estrellas
      for (var k = 0; k < 3; k++) {
        var sz = k === 1 ? 220 : 180;
        var sx = SHARE_W / 2 + (k - 1) * 230 - sz / 2, sy = 1040 - (k === 1 ? 40 : 0);
        var si = k < o.stars ? im[3] : im[4];
        if (si) g.drawImage(si, sx, sy, sz, sz);
      }
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillStyle = '#5b1e74';
      g.font = '84px ' + FONT;
      g.fillText(o.title, SHARE_W / 2, 1340);
      g.fillStyle = '#a1286a';
      g.font = '52px ' + FONT;
      g.fillText('«' + o.name + '»', SHARE_W / 2, 1420, SHARE_W - 200);
      // frase del personaje
      g.fillStyle = '#2b1630';
      g.font = '800 46px ' + BODY;
      wrapLines(g, o.line, SHARE_W - 260).slice(0, 2).forEach(function (ln, i) { g.fillText(ln, SHARE_W / 2, 1510 + i * 60); });
      g.fillStyle = '#fff6ea';
      g.font = '60px ' + FONT;
      g.fillText('¿Puedes tú?', SHARE_W / 2, 1770);
      g.font = '700 32px ' + BODY;
      g.fillText('Juego de fans · Cocardo: ¡Rescate Helado!', SHARE_W / 2, 1860);
      return new Promise(function (res) {
        try { cv.toBlob(function (b) { res(b); }, 'image/png'); } catch (e) { res(null); }
      });
    }).then(function (blob) {
      return blob ? new File([blob], 'cocardo-nivel-' + o.id + '.png', { type: 'image/png' }) : null;
    }).catch(function () { return null; });
  }
  // Comparte la imagen (si se puede) con el texto; si no, false y se usa el flujo de texto
  function shareImage(file, text) {
    try {
      if (!file || !navigator.canShare || !navigator.canShare({ files: [file] })) return false;
      var url = shareUrl();
      navigator.share({ files: [file], text: url ? text + '\n' + url : text }).then(null, function (err) {
        if (err && err.name === 'AbortError') return;
        share(text);
      });
      return true;
    } catch (e) { return false; }
  }

  function showCopyBox(text) {
    if (isOpen('copy')) closeOverlay('copy', true);
    var o = openOverlay('copy', '<div class="card pop copy-card">' +
      '<h2 class="card-title">Cópialo y compártelo</h2>' +
      '<textarea class="copy-text" readonly rows="7" aria-label="Texto para compartir"></textarea>' +
      '<div class="btn-row"><button class="btn btn-pink" data-act="ok" data-autofocus>Listo</button></div></div>',
    { label: 'Cópialo y compártelo', onEsc: function () { closeOverlay('copy'); } });
    var ta = $('textarea', o);
    ta.value = text;
    try { ta.focus(); ta.select(); ta.setSelectionRange(0, text.length); } catch (e) { /* nada */ }
    $('[data-act="ok"]', o).addEventListener('click', function () { closeOverlay('copy'); });
    return o;
  }

  /* ---------- fecha local / reto diario ---------- */

  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function dateParts(offsetDays) {
    var d = new Date();
    if (offsetDays) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays);
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), wd: d.getDay() };
  }
  function keyOf(p) {
    var D = Cocardo.Daily;
    try { if (D && D.dateKey) return D.dateKey(p.y, p.m, p.d); } catch (e) { /* respaldo */ }
    return p.y * 10000 + p.m * 100 + p.d;
  }
  function dailyInfo() {
    var D = Cocardo.Daily;
    var p = dateParts(0);
    var key = keyOf(p);
    var info = { parts: p, key: key, num: 0, level: null, seed: key, ok: false };
    if (!D) return info;
    try {
      info.num = D.challengeNumber(p.y, p.m, p.d);
      info.level = D.levelFor(key, levelList());
      info.seed = D.seedFor(key);
      info.ok = !!info.level;
    } catch (e) {
      console.error('[Cocardo.Daily]', e);
    }
    return info;
  }
  function dailyUnlocked() { return data().unlocked > 5 || data().stars[4] > 0; }
  // Racha vigente: solo cuenta si el último reto fue hoy o ayer
  function currentStreak() {
    var d = data().daily;
    var today = keyOf(dateParts(0));
    var yest = keyOf(dateParts(-1));
    return (d.last === today || d.last === yest) ? d.streak : 0;
  }

  /* ---------- potenciadores ---------- */

  function boosterName(id) {
    for (var i = 0; i < BOOSTERS.length; i++) if (BOOSTERS[i].id === id) return BOOSTERS[i].name;
    return id;
  }
  // Desbloquea (con 3 usos) los potenciadores de L7/L11/L14 al llegar a ese nivel
  function unlockBoostersFor(id) {
    var d = data();
    var fresh = [];
    BOOSTERS.forEach(function (b) {
      if (id >= b.level && !d.boostersUnlocked[b.id]) {
        d.boostersUnlocked[b.id] = true;
        d.boosters[b.id] = Math.min(Cocardo.Save.BOOSTER_CAP || 9, (d.boosters[b.id] | 0) + 3);
        fresh.push(b.id);
      }
    });
    if (fresh.length) persist();
    return fresh;
  }
  // +1 de un potenciador desbloqueado al azar (tope 9). Devuelve el id o null.
  function grantRandomBooster() {
    var d = data();
    var cap = Cocardo.Save.BOOSTER_CAP || 9;
    var pool = BOOSTERS.filter(function (b) { return d.boostersUnlocked[b.id] && (d.boosters[b.id] | 0) < cap; });
    var b = pick(pool);
    if (!b) return null;
    d.boosters[b.id] = (d.boosters[b.id] | 0) + 1;
    return b.id;
  }

  /* ---------- iconos de objetivos ---------- */

  function countLayout(level, chars) {
    var n = 0;
    (level.layout || []).forEach(function (row) {
      for (var i = 0; i < row.length; i++) if (chars.indexOf(row[i]) >= 0) n++;
    });
    return n;
  }
  function goalInfo(goal, level) {
    var t = goal.type;
    if (t === 'color') {
      return { icon: art('tile', goal.color, { type: 'n', face: 'happy' }), n: goal.n, label: nameOf(COLOR_WHO[goal.color]), type: t };
    }
    if (t === 'ice') return { icon: art('ice', 1, 1), n: countLayout(level, '123'), label: 'Hielo', type: t };
    if (t === 'crate') return { icon: art('crate'), n: goal.n, label: 'Cajas', type: t };
    if (t === 'rescue') {
      var who = (level.rescue && level.rescue[0]) || 'lima';
      var hp = level.friendHP || 2;
      var names = (level.rescue || []).map(nameOf);
      return { icon: art('friend', who, hp, hp), n: countLayout(level, 'R'), label: names.length ? 'Rescata a ' + names.join(' y a ') : 'Rescate', type: t };
    }
    if (t === 'token') {
      var skin = (level.tokens && level.tokens.skin) || 'prueba';
      return { icon: art('token', skin), n: (level.tokens && level.tokens.total) || 1, label: skin === 'uva' ? 'Ayuda a Uva' : 'Pruebas', type: t };
    }
    if (t === 'boss') {
      var fz = level.freezer || { who: 'cocardo', hp: 8 };
      return { icon: art('freezer', fz.who, fz.hp, fz.hp), n: fz.hp, label: 'Congelador', type: t };
    }
    return { icon: '', n: goal.n || 0, label: '', type: t };
  }
  // Ícono para el texto de «¡Casi!» (acepta svg, código de color, tipo de objetivo u objeto objetivo)
  function nearIcon(spec, level) {
    if (!spec) return '';
    if (typeof spec === 'string') {
      if (spec.indexOf('<svg') === 0) return spec;
      if (/^[LFBUND]$/.test(spec)) return art('tile', spec, { type: 'n' });
      if (spec === 'ice') return art('ice', 1, 1);
      if (spec === 'crate') return art('crate');
      if (spec === 'rescue' || spec === 'friend') return art('friend', (level && level.rescue && level.rescue[0]) || 'lima', 1, 2);
      if (spec === 'token') return art('token', (level && level.tokens && level.tokens.skin) || 'prueba');
      if (spec === 'boss' || spec === 'freezer') {
        var fz = (level && level.freezer) || { who: 'cocardo', hp: 8 };
        return art('freezer', fz.who, 1, fz.hp);
      }
      if (COLOR_WHO[spec.charAt(0)] && spec.length === 1) return art('tile', spec, { type: 'n' });
      return '';
    }
    if (typeof spec === 'object' && spec.type) return goalInfo(spec, level || {}).icon;
    return '';
  }

  function goalsHtml(level) {
    var goals = level.goals || [];
    var colorGoals = goals.filter(function (g) { return g.type === 'color'; });
    var items = goals.map(function (g) {
      var gi = goalInfo(g, level);
      return '<div class="goal goal-' + gi.type + '"><span class="goal-icon">' + gi.icon + '</span>' +
        '<b class="goal-n">' + (gi.type === 'rescue' || gi.type === 'boss' ? '' : '×') + gi.n + '</b>' +
        '<small class="goal-label">' + esc(gi.label) + '</small></div>';
    }).join('');
    if (colorGoals.length >= 2) {
      return '<div class="ticket"><div class="ticket-head"><span class="ticket-face">' + portrait('pina', 'feliz') +
        '</span><span>Pedido de Piña</span></div><div class="goals">' + items + '</div></div>';
    }
    return '<div class="goals">' + items + '</div>';
  }

  function starsHtml(n, cls) {
    var s = '';
    for (var i = 0; i < 3; i++) s += '<span class="' + (cls || 'mini-star') + (i < n ? ' on' : '') + '">' + icon(i < n ? 'star' : 'starEmpty', 24) + '</span>';
    return s;
  }

  /* ===================================================================== */
  /*                                PORTADA                                */
  /* ===================================================================== */

  var titleBuilt = false;
  function renderTitle() {
    var sec = doc.getElementById('screen-title');
    if (titleBuilt) return;
    titleBuilt = true;
    var scoops = ['#9be15d', '#ff5d7e', '#ffe27a', '#a46ad8', '#ffa23a', '#ffb48f'];
    var flakes = '';
    for (var i = 0; i < 14; i++) {
      flakes += '<i class="flake" style="--x:' + ((i * 37) % 100) + '%;--d:' + (6 + (i * 7) % 6) + 's;--delay:-' + ((i * 13) % 9) + 's;--s:' + (0.6 + (i % 4) * 0.25) + '"></i>';
    }
    sec.innerHTML =
      '<div class="col title-col">' +
        '<div class="title-bg" aria-hidden="true">' + art('background', 'heladeria') + '</div>' +
        '<div class="awning" aria-hidden="true"></div>' +
        '<div class="flakes" aria-hidden="true">' + flakes + '</div>' +
        socialRowHtml() + accountChipHtml() +
        '<div class="title-main">' +
          '<h1 class="title-logo" aria-label="Cocardo: ¡Rescate Helado!">' + (art('logo') || '<span class="logo-text">Cocardo<br><small>¡Rescate Helado!</small></span>') + '</h1>' +
          '<div class="title-hero" aria-hidden="true">' +
            '<div class="hero-glow"></div>' +
            '<div class="hero-cocardo">' + portrait('cocardo', 'burlon') + '</div>' +
            '<div class="hero-counter">' + scoops.map(function (c, k) {
              return '<span class="scoop" style="--c:' + c + ';--k:' + k + '"></span>';
            }).join('') + '</div>' +
          '</div>' +
          '<p class="title-tag">Una frutinovela de helados</p>' +
          '<button class="title-start" data-autofocus><span>Toca para empezar</span></button>' +
        '</div>' +
        '<footer class="disclaimer">Juego de fans, no oficial. Inspirado en la frutinovela viral <i>La Nieve de Lima</i> (@frutitaenlatada).</footer>' +
      '</div>';
    sec.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('[data-act="account"]')) { ev.stopPropagation(); showAccount(); return; }
      if (ev.target.closest && ev.target.closest('a')) return;
      leaveTitle();
    });
  }
  renderers.title = renderTitle;

  var leaving = false;
  function leaveTitle() {
    if (current !== 'title' || leaving) return;
    leaving = true;
    try { if (Cocardo.Audio) Cocardo.Audio.unlock(); } catch (e) { /* nada */ }
    play('tap');
    var sec = doc.getElementById('screen-title');
    sec.classList.add('title-out');
    later(function () {
      leaving = false;
      if (isFreshStart()) {
        // la Portada se queda desvanecida bajo la historia (que es opaca) hasta que entra el tablero
        later(function () { sec.classList.remove('title-out'); }, 700);
        firstSession();
        return;
      }
      sec.classList.remove('title-out');
      if (pendingGo === 'daily' && dailyUnlocked()) { pendingGo = null; show('daily'); return; }
      pendingGo = null;
      show('map');
    }, reducedMotion() ? 0 : 260);
  }

  // Guardado nuevo: sin estrellas y sin haber visto la historia del nivel 1
  function isFreshStart() {
    var d = data();
    if (d.unlocked > 1 || d.stars.some(function (x) { return (x | 0) > 0; })) return false;
    var pre = scenesFor(1).pre;
    return !(pre && d.seen[pre]);
  }
  // Primera sesión: Portada -> historia pre1 -> tablero del nivel 1 (sin mapa ni tarjeta de intro;
  // el tutorial del tablero ya explica la jugada)
  function firstSession() {
    var go = function () { startLevel(1); };
    var pre = scenesFor(1).pre;
    if (pre && script(pre)) playScene(pre, go, { level: 1 });
    else go();
  }

  /* ===================================================================== */
  /*                                  MAPA                                 */
  /* ===================================================================== */

  var MAP = { STEP: 112, HEAD: 160, TAIL: 40, PAD_TOP: 24, PAD_BOT: 170 };   // HEAD: sitio para el rótulo del capítulo (2 líneas) sin tapar las estrellas del jefe
  var XPAT = [0.5, 0.73, 0.64, 0.33, 0.5];
  var bgCache = {};
  var mapGeom = null;
  var mapBuilt = false;

  function zoneBg(zone) {
    if (!bgCache[zone]) bgCache[zone] = art('background', zone);
    return bgCache[zone];
  }

  var GHOST = { STEP: 84, HEAD: 150, TAIL: 34 };   // zonas en construcción: nodos fantasma más juntos
  function mapLayout() {
    var chs = chapterStates();
    var nodes = [];
    var zones = [];
    var byId = {};
    var y = MAP.PAD_TOP;
    for (var k = chs.length - 1; k >= 0; k--) {
      var ch = chs[k];
      var ghost = !ch.built;
      var M = ghost ? GHOST : MAP;
      var n = (ch.levels || []).length;
      var zh = M.HEAD + n * M.STEP + M.TAIL;
      // la zona de arriba cubre el margen superior y la de abajo el inferior (sin huecos)
      var zTop = k === chs.length - 1 ? 0 : y;
      var zH = zh + (y - zTop) + (k === 0 ? MAP.PAD_BOT : 0);
      zones.unshift({ ch: ch, idx: k, top: zTop, h: zH, headTop: y - zTop, ghost: ghost });
      for (var j = 0; j < n; j++) {
        var id = ch.levels[j];
        var xf = XPAT[j % XPAT.length];
        if (j === n - 1) xf = 0.5;
        if (k % 2 === 1) xf = 1 - xf;
        var node = { id: id, ch: ch, chIdx: k, j: j, xf: xf, y: y + zh - M.TAIL - 30 - j * M.STEP, ghost: ghost };
        nodes.push(node);
        byId[id] = node;
      }
      y += zh;
    }
    nodes.sort(function (a, b) { return a.id - b.id; });
    return { nodes: nodes, zones: zones, byId: byId, height: y + MAP.PAD_BOT };
  }

  function buildMapShell() {
    var sec = doc.getElementById('screen-map');
    sec.innerHTML =
      '<div class="col map-col">' +
        '<header class="topbar">' +
          '<div class="pill stars-pill" aria-label="Estrellas">' + icon('star', 26) + '<b class="js-stars">0</b><small class="js-stars-max">/' + levelCount() * 3 + '</small></div>' +
          '<button class="pill daily-btn" data-act="daily" aria-label="Reto Diario">' + icon('flame', 26) +
            '<span class="daily-txt">Reto</span><b class="js-streak">0</b><i class="dot" hidden></i><span class="mini-lock" hidden>' + icon('lock', 14) + '</span></button>' +
          '<button class="round-btn" data-act="album" aria-label="Álbum">' + icon('album', 26) + '</button>' +
          '<button class="round-btn" data-act="settings" aria-label="Ajustes">' + icon('settings', 26) + '</button>' +
        '</header>' +
        '<div class="map-scroll"><div class="map-world"></div></div>' +
        '<button class="rescue-banner" data-act="rescue" hidden></button>' +
      '</div>';
    sec.addEventListener('click', onMapClick);
    $('.map-scroll', sec).addEventListener('scroll', function () {
      var b = $('.rescue-banner', sec);
      if (b) b.classList.toggle('dim', false);
    }, { passive: true });
    mapBuilt = true;
  }

  function shakeNode(t) {
    t.classList.remove('shake');
    void t.offsetWidth;
    t.classList.add('shake');
  }
  function onMapClick(ev) {
    var t = ev.target.closest('[data-act], [data-level], [data-chapter]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (t.hasAttribute('data-level')) {
      var id = +t.getAttribute('data-level');
      if (!playable(id)) {
        // capítulo construido con fecha por llegar: la ficha dice cuándo se abre
        play('invalid');
        shakeNode(t);
        var cs = chapterStateOf(id);
        if (cs && cs.state !== 'abierto') showRoadmap(cs.id);
        else toast('Este nivel aún se está congelando…');
        return;
      }
      if (id > data().unlocked) {
        play('invalid');
        shakeNode(t);
        toast('¡Primero supera el nivel ' + (data().unlocked) + '!');
        return;
      }
      openLevel(id);
    } else if (act === 'daily') show('daily');
    else if (act === 'album') show('album');
    else if (act === 'settings') show('settings');
    else if (act === 'rescue') {
      var lv = +t.getAttribute('data-target');
      var cid = +t.getAttribute('data-chapter');
      if (lv) scrollMapTo(lv, true);
      if (cid) later(function () { showRoadmap(cid); }, 350);
    } else if (t.hasAttribute('data-chapter')) {
      // nodo fantasma o rótulo de un capítulo en construcción / programado
      play('tap');
      showRoadmap(+t.getAttribute('data-chapter'));
    }
  }

  function totalStars() { return data().stars.reduce(function (a, b) { return a + (b | 0); }, 0); }

  // Escena en la que congelan a cada víctima: antes de verla, el mapa no la nombra (sin spoilers)
  var CAPTURE_SCENE = { lima: 'cliff5', fresa: 'pre6', durazna: 'pre12', uva: 'pre14', banana: 'pre14', naranja: 'pre19' };
  function captureSeen(who) {
    var key = CAPTURE_SCENE[who];
    var d = data();
    if (!key || d.rescued.indexOf(who) >= 0) return true;
    return !!d.seen[key];
  }

  function nextRescue() {
    var d = data();
    var list = levelList();
    for (var i = 0; i < list.length; i++) {
      var lv = list[i];
      if (!lv.rescue || !lv.rescue.length || (d.stars[lv.id - 1] | 0) > 0) continue;
      var who = null;
      for (var k = 0; k < lv.rescue.length; k++) if (d.rescued.indexOf(lv.rescue[k]) < 0) { who = lv.rescue[k]; break; }
      if (who) return { level: lv.id, who: who, all: lv.rescue.filter(function (w) { return d.rescued.indexOf(w) < 0; }) };
    }
    return null;
  }

  function renderMap() {
    if (!mapBuilt) buildMapShell();
    var sec = doc.getElementById('screen-map');
    var d = data();
    var count = levelCount();
    var openN = openCount();
    var world = $('.map-world', sec);
    var geo = mapLayout();
    mapGeom = geo;
    var cur = Math.max(1, Math.min(d.unlocked, openN || count));
    // ¿ya superó todo lo que se puede jugar hoy?
    var doneAll = openN > 0 && (d.stars[openN - 1] | 0) > 0;

    // barra superior
    $('.js-stars', sec).textContent = totalStars();
    $('.js-stars-max', sec).textContent = '/' + (openN || count) * 3;   // máximo alcanzable hoy, no el de capítulos cerrados
    var dBtn = $('.daily-btn', sec);
    var unlockedDaily = dailyUnlocked();
    dBtn.classList.toggle('locked', !unlockedDaily);
    $('.js-streak', sec).textContent = currentStreak();
    $('.mini-lock', sec).hidden = unlockedDaily;
    var todayDone = !!d.daily.results[keyOf(dateParts(0))];
    $('.dot', sec).hidden = !unlockedDaily || todayDone;

    // mundo
    var R = roadmap();
    var html = '';
    geo.zones.forEach(function (z) {
      var ch = z.ch;
      var first = ch.levels && ch.levels[0];
      var ghost = !!z.ghost;
      var dated = !ghost && !!ch.state && ch.state !== 'abierto';   // construido, con fecha por llegar
      var locked = ghost || dated || first > d.unlocked;
      var season = R && ghost ? R.seasonOf(ch.id) : null;
      var seasonFirst = !!(season && season.chapters[0] === ch.id);
      var sub = ghost ? (seasonFirst ? ch.seasonName : '') : ((story().chapterTitles && story().chapterTitles[z.idx]) || (ch.season > 1 ? ch.seasonName : '') || '');
      var num = 'Capítulo ' + ch.id + (ghost && ch.season ? ' · Temporada ' + ch.season : '');
      var when = (ghost || dated) && ch.when ? '<span class="zone-when">' + icon(dated ? 'calendar' : 'cone', 14) + '<span>' + esc(ch.when) + '</span></span>' : '';
      var btn = ghost || dated;
      var tag = btn ? 'button' : 'div';
      var attrs = btn ? ' type="button" data-chapter="' + ch.id + '" aria-label="' + esc(num + ', ' + ch.name + ', ' + (ch.when || 'en construcción')) + '"' : '';
      html += '<div class="zone zone-ch' + esc(ch.id) + (ghost ? ' zone-planned zone-' + esc(ch.state || 'construccion') : (isShopZone(ch.zone) ? ' zone-shop' : '')) + (dated ? ' zone-dated' : '') + (locked && !ghost ? ' zone-locked' : '') + '" style="top:' + z.top + 'px;height:' + z.h + 'px;--zc:' + esc(ch.color || '#ff6fa5') + '">' +
        '<div class="zone-bg">' + (ghost ? '' : zoneBg(ch.zone || ch.id)) + '</div>' +
        (ghost && z.idx === geo.zones.length - 1 ? '<div class="zone-fog" aria-hidden="true"></div>' : '') +
        '<' + tag + ' class="zone-head' + (btn ? ' zone-head-btn' : '') + '" style="top:' + (z.headTop + 34) + 'px"' + attrs + '><span class="zone-num">' + esc(num) + '</span><b class="zone-name">' + esc(ch.name) + '</b>' +
        (sub ? '<small class="zone-sub">' + esc(sub) + '</small>' : '') + when + (locked && !ghost ? '<span class="zone-lock">' + icon('lock', 18) + '</span>' : '') + '</' + tag + '>' +
        '</div>';
    });
    geo.zones.forEach(function (z) {
      if (!z.ghost && isShopZone(z.ch.zone)) html += mapNeonHtml(geo, z.idx, (z.ch.levels && z.ch.levels[0]) > d.unlocked || z.ch.state !== 'abierto');
    });
    html += '<svg class="map-road" aria-hidden="true"></svg>';
    geo.nodes.forEach(function (n) {
      var zc = esc(n.ch.color || '#ff6fa5');
      if (n.ghost) {
        // nivel en construcción: nodo fantasma que abre la ficha del capítulo
        html += '<button type="button" class="node node-ghost" data-chapter="' + n.ch.id + '" style="left:' + (n.xf * 100) + '%;top:' + n.y + 'px;--zc:' + zc + '" aria-label="' + esc('Nivel ' + n.id + ', en construcción, ' + (n.ch.when || '')) + '">' +
          '<span class="node-disc"><span class="node-num">' + n.id + '</span></span>' +
          (n.j === 0 ? '<span class="node-cone" aria-hidden="true">' + icon('cone', 16) + '</span>' : '') +
          '</button>';
        return;
      }
      var lv = getLevel(n.id) || {};
      var stars = d.stars[n.id - 1] | 0;
      var dated = !!n.ch.state && n.ch.state !== 'abierto';
      var locked = dated || n.id > d.unlocked;
      var isCur = n.id === cur && !(n.id === openN && doneAll) && !dated;
      var boss = isFinale(n.id);
      var cls = 'node' + (boss ? ' node-boss' : '') + (locked ? ' node-locked' : '') + (dated ? ' node-dated' : '') + (stars ? ' node-done' : '') + (isCur ? ' node-current' : '');
      var label = 'Nivel ' + n.id + (lv.name ? ', ' + lv.name : '') + (locked ? (dated ? ', ' + (n.ch.when || 'próximamente') : ', bloqueado') : (stars ? ', ' + stars + (stars === 1 ? ' estrella' : ' estrellas') : ''));
      html += '<button class="' + cls + '" data-level="' + n.id + '" style="left:' + (n.xf * 100) + '%;top:' + n.y + 'px;--zc:' + zc + '" aria-label="' + esc(label) + '">' +
        (locked ? '' : '<span class="node-stars">' + starsHtml(stars) + '</span>') +
        '<span class="node-disc">' +
          (boss ? '<span class="node-face">' + portrait(bossFace(n.id), locked ? 'normal' : 'burlon') + '</span>' : '') +
          '<span class="node-num">' + n.id + '</span>' +
        '</span>' +
        (locked ? '<span class="node-lock">' + icon(dated ? 'calendar' : 'lock', dated ? 16 : 18) + '</span>' : '') +
        (lv.hard ? '<span class="node-drama">¡Drama!</span>' : '') +
        '</button>';
      // burbuja de rescate junto al nivel que libera a alguien
      if (lv.rescue && lv.rescue.length) {
        var side = n.xf <= 0.5 ? 1 : -1;
        lv.rescue.forEach(function (who, k) {
          var freed = d.rescued.indexOf(who) >= 0;
          var known = captureSeen(who);
          html += '<div class="rescue-bubble' + (freed ? ' freed' : '') + (known ? '' : ' unknown') + '" style="left:calc(' + (n.xf * 100) + '% + ' + (side * (boss ? 78 : 66) + side * k * 46) + 'px);top:' + (n.y - 6 + k * 10) + 'px" title="' + esc(known ? nameOf(who) : '???') + '">' +
            portrait(who, freed ? 'feliz' : (known ? 'asustado' : 'normal'), freed ? {} : (known ? { frozen: true } : { silhouette: true })) + '</div>';
        });
      }
    });
    if (!(doneAll && cur === openN)) {
      // manita que señala el nivel actual (del lado contrario a las burbujas de rescate)
      var cn = geo.byId[cur];
      if (cn) {
        var hs = cn.xf <= 0.5 ? -1 : 1;
        var off = isFinale(cn.id) ? 72 : 60;
        html += '<div class="map-hand ' + (hs < 0 ? 'from-left' : 'from-right') + '" style="left:calc(' + (cn.xf * 100) + '% + ' + (hs * off) + 'px);top:' + cn.y + 'px" aria-hidden="true">' + icon('hand', 40) + '</div>';
      }
    }
    world.style.height = geo.height + 'px';
    world.innerHTML = html;
    drawRoad();

    // aviso de próximo rescate; sin rescates pendientes, el próximo capítulo (programado o en construcción)
    var banner = $('.rescue-banner', sec);
    var nr = nextRescue();
    var nx = nextOpening();
    banner.removeAttribute('data-chapter');
    if (nr && nr.level <= openN) {
      // niveles por jugar contando el actual (actual 9, rescate en 10 -> «faltan 2 niveles»)
      var left = nr.level - cur + 1;
      var names = nr.all.every(captureSeen) ? nr.all.map(nameOf).join(' y ') : '???';
      var when2 = left <= 1 ? '¡en este nivel!' : 'faltan ' + left + ' niveles';
      banner.innerHTML = '<span class="rb-face">' + portrait(nr.who, 'normal', { silhouette: true }) + '</span>' +
        '<span class="rb-txt"><small>Próximo rescate</small><b>' + esc(names) + ' · ' + esc(when2) + '</b></span>' +
        '<span class="rb-flake">' + icon('snowflake', 22) + '</span>';
      banner.setAttribute('data-target', nr.level);
      banner.setAttribute('aria-label', 'Próximo rescate: ' + names + ', ' + when2);
      banner.hidden = false;
    } else if (nx && nx.levels && nx.levels.length) {
      var lateB = nx.state === 'retrasado';
      var small = nx.built ? 'Próximo capítulo' : (lateB ? 'Capítulo ' + nx.id : 'Capítulo ' + nx.id + ' en construcción');
      var big = lateB ? 'Un poquito más… ¡ya casi!' : (nx.when || nx.name);
      banner.innerHTML = '<span class="rb-face rb-build">' + icon('cone', 30) + '</span>' +
        '<span class="rb-txt"><small>' + esc(small) + '</small><b>' + esc(big) + '</b></span>' +
        '<span class="rb-flake rb-clock">' + icon('clock', 22) + '</span>';
      banner.setAttribute('data-target', nx.levels[0]);
      banner.setAttribute('data-chapter', nx.id);
      banner.setAttribute('aria-label', small + ': ' + nx.name + ', ' + big);
      banner.hidden = false;
    } else if (levelList().length) {
      banner.innerHTML = '<span class="rb-face happy">' + portrait('lima', 'feliz') + '</span><span class="rb-txt"><small>¡Bravo!</small><b>Todas las frutas a salvo</b></span>';
      banner.removeAttribute('data-target');
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
    requestAnimationFrame(function () { scrollMapTo(cur, false); });
    announceOpenings(d, openN);
  }
  renderers.map = renderMap;

  // Un capítulo con fecha que ya abrió y el jugador había llegado hasta él: se celebra una sola vez
  function announceOpenings(d, openN) {
    var fresh = null;
    chapterStates().forEach(function (ch) {
      if (!ch.built || !ch.opens || ch.state !== 'abierto' || !ch.levels || !ch.levels.length) return;
      var key = 'open' + ch.id;
      if (d.seen[key]) return;
      if (ch.levels[0] > d.unlocked || ch.levels[0] > openN) return;
      // solo se celebra a quien ya vio el final del capítulo anterior (quien acaba de ganarlo verá el rótulo tras las escenas)
      var prevSc = scenesFor(ch.levels[0] - 1);
      var prevSeen = prevSc.cliff ? (prevSc.cliff === 'ending' ? !!d.seen.ending : !!d.seen[prevSc.cliff]) : true;
      if (!prevSeen) return;
      d.seen[key] = true;
      if (!fresh) fresh = ch;
    });
    if (!fresh) return;
    persist();
    toast('¡Capítulo ' + fresh.id + ' abierto! «' + fresh.name + '»', 3200);
    play('booster');
    later(function () { scrollMapTo(fresh.levels[0], true); }, 250);
  }

  // ¿La zona usa el fondo de la heladería? (mismo criterio que Art.background: es el fondo por defecto)
  function isShopZone(zone) {
    var s = String(zone == null ? '' : zone).toLowerCase();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* sin normalize */ }
    if (/^[2-6]$/.test(s)) return false;
    return !/cherry|cereza|congela|freez|frio|mansion|pina|oficina|trastienda|callejon|bodega|noche|calle|comisaria|lluvia|policia/.test(s);
  }
  // Letrero de neón «Coco's Scoops»: el fondo de la heladería lo trae justo detrás del nodo jefe del capítulo
  // (el retrato lo tapa). En el mapa se oculta el del fondo (css: .zone-shop .zone-bg text) y se pinta aquí, en
  // el hueco libre entre los nodos 4 y 5 del capítulo, del lado contrario al nodo 4.
  function mapNeonHtml(geo, chIdx, locked) {
    var mine = geo.nodes.filter(function (n) { return n.chIdx === chIdx; });
    if (mine.length < 5) return '';
    var a = mine[3], b = mine[4];
    var x = a.xf <= 0.5 ? 0.73 : 0.27;
    var y = (a.y + b.y) / 2 + 30;
    var t = '<text x="110" y="47" textLength="196" lengthAdjust="spacingAndGlyphs"';
    var word = "Coco's Scoops";
    return '<div class="map-neon' + (locked ? ' locked' : '') + '" style="left:' + (x * 100) + '%;top:' + Math.round(y) + 'px" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 66"><g font-family="Yellowtail, Brush Script MT, Segoe Script, cursive" font-size="42" text-anchor="middle" fill="none" stroke-linejoin="round">' +
      t + ' stroke="#ff6fa5" stroke-width="10" opacity=".25">' + word + '</text>' +
      t + ' stroke="#ff6fa5" stroke-width="4" opacity=".9">' + word + '</text>' +
      t + ' stroke="#fff4f9" stroke-width="1.4">' + word + '</text>' +
      '</g></svg></div>';
  }

  // Camino curvo (Catmull-Rom -> Bézier) entre los nodos, en píxeles
  function drawRoad() {
    var sec = doc.getElementById('screen-map');
    var world = $('.map-world', sec);
    var svg = $('.map-road', world);
    if (!svg || !mapGeom) return;
    var W = world.clientWidth || 360;
    var H = mapGeom.height;
    var pts = mapGeom.nodes.map(function (n) { return [n.xf * W, n.y]; });
    function pathFor(p) {
      if (p.length < 2) return '';
      var dd = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1);
      for (var i = 0; i < p.length - 1; i++) {
        var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
        var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
        var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
        dd += 'C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
      return dd;
    }
    var builtN = 0;
    mapGeom.nodes.forEach(function (n) { if (!n.ghost) builtN++; });
    var all = pathFor(pts.slice(0, builtN));
    // hacia los niveles en construcción el camino sigue punteado, como un plano
    var future = builtN < pts.length ? pathFor(pts.slice(Math.max(0, builtN - 1))) : '';
    var doneN = Math.min(builtN, openCount(), data().unlocked);
    var prog = pathFor(pts.slice(0, doneN));
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.innerHTML =
      (future ? '<path class="road-future" d="' + future + '" fill="none" stroke="#fff6ea" stroke-width="12" stroke-linecap="round"/>' : '') +
      '<path d="' + all + '" fill="none" stroke="#2b1630" stroke-opacity=".55" stroke-width="30" stroke-linecap="round"/>' +
      '<path d="' + all + '" fill="none" stroke="#fff6ea" stroke-width="22" stroke-linecap="round"/>' +
      '<path d="' + all + '" fill="none" stroke="#bfe9ff" stroke-width="6" stroke-linecap="round" stroke-dasharray="0 18"/>' +
      (prog ? '<path d="' + prog + '" fill="none" stroke="#ffc93c" stroke-width="9" stroke-linecap="round" stroke-dasharray="0 18"/>' : '');
  }

  function scrollMapTo(id, smooth) {
    var sec = doc.getElementById('screen-map');
    var sc = $('.map-scroll', sec);
    if (!sc || !mapGeom) return;
    var n = (mapGeom.byId && mapGeom.byId[id]) || mapGeom.nodes[id - 1];
    if (!n) return;
    var top = Math.max(0, n.y - sc.clientHeight * 0.55);
    try {
      sc.scrollTo({ top: top, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
    } catch (e) {
      sc.scrollTop = top;
    }
    if (smooth) {
      var b = $('.node[data-level="' + id + '"]', sec);
      if (b) {
        b.classList.remove('wiggle');
        void b.offsetWidth;
        b.classList.add('wiggle');
      }
    }
  }

  /* ===================================================================== */
  /*                               HISTORIA                                */
  /* ===================================================================== */

  // Efectos de sonido de los guiones ({sfx:'clac'} etc.). La palabra en pantalla sale de Cocardo.Story.effects
  // (fuente única); estas palabras son solo el respaldo si la historia no la trae.
  var SFX = {
    clac: { word: '¡CLAC!', sound: 'drama', flash: 'ice', shake: true },
    drama: { word: '¡TAN, TAN, TAAAN!', sound: 'drama', flash: 'drama', shake: false },
    trueno: { word: '¡BRRRUUUM!', sound: 'bomba', flash: 'white', shake: true },
    crash: { word: '¡CRASH!', sound: 'bomba', flash: 'white', shake: true },
    plaf: { word: '¡PLAF!', sound: 'crate', flash: null, shake: true },
    sirena: { word: '¡UIU-UIU!', sound: 'drama', flash: 'siren', shake: false },
  };

  function sfxWord(name) {
    var e = story().effects;
    var fx = e && e[name];
    return (fx && typeof fx.text === 'string' && fx.text) || '';
  }

  var TYPE_CPS = 50;   // letras por segundo de la máquina de escribir

  // Reproduce un guion de Cocardo.Story.scripts[key]. opts: { level, extraCards:[...], zone }
  function playStory(key, done, opts) {
    opts = opts || {};
    var lines = (script(key) || []).slice();
    if (opts.extraCards) {
      opts.extraCards.forEach(function (c) { lines.push(c); });
    }
    if (opts.cardsOnly) lines = cliffCards(lines);
    if (!lines.length) { if (done) done(); return; }
    var lvId = opts.level || 0;
    var ch = lvId ? chapterOf(lvId) : null;
    var zone = opts.zone || (ch && ch.zone) || 'heladeria';
    var o = openOverlay('story',
      '<div class="story">' +
        '<div class="story-bg" aria-hidden="true">' + zoneBg(zone) + '</div>' +
        '<div class="story-vignette" aria-hidden="true"></div>' +
        '<button class="story-skip" data-act="skip">Saltar ' + icon('next', 18) + '</button>' +
        '<div class="story-stage" aria-hidden="true"></div>' +
        '<div class="story-box" tabindex="0" aria-live="polite">' +
          '<div class="story-name"></div>' +
          '<p class="story-text"></p>' +
          '<span class="story-next" aria-hidden="true">▼</span>' +
        '</div>' +
        '<div class="story-fx" aria-hidden="true"></div>' +
        '<div class="story-card-layer"></div>' +
      '</div>',
    { label: 'Historia', onEsc: function () { finish(); } });

    var stage = $('.story-stage', o);
    var box = $('.story-box', o);
    var nameEl = $('.story-name', o);
    var textEl = $('.story-text', o);
    var fxEl = $('.story-fx', o);
    var cardLayer = $('.story-card-layer', o);
    var sides = {};
    var slots = { left: null, right: null };
    var idx = -1;
    var typing = false;
    var full = '';
    var shown = 0;
    var t0 = 0;
    var timer = 0;
    var autoTimer = 0;
    var cardReadyAt = 0;
    var lastSpeaker = null;
    var lastMood = 'normal';
    var curWho = null;
    var ended = false;

    // Lado del personaje: el nuevo hablante se pone enfrente del anterior (careo de telenovela)
    function sideFor(who) {
      var s = sides[who];
      var lastSide = lastSpeaker && lastSpeaker !== who ? sides[lastSpeaker] : null;
      if (!s) s = lastSide === 'left' ? 'right' : 'left';
      else if (lastSide && s === lastSide) s = s === 'left' ? 'right' : 'left';
      sides[who] = s;
      return s;
    }

    function setPortrait(line) {
      var who = line.who;
      var speaking = null;
      if (knownChar(who)) {
        var mood = line.mood || 'normal';
        var pOpts = {};
        if (line.variant) pOpts.variant = line.variant;
        if (line.frozen) pOpts.frozen = true;
        var key2 = who + '|' + mood + '|' + (line.variant || '') + '|' + (line.frozen ? 1 : 0);
        var side = sideFor(who);
        var slot = slots[side];
        if (slot && slot.who === who) {
          if (slot.key !== key2) {
            slot.el.innerHTML = portrait(who, mood, pOpts);
            slot.key = key2;
            slot.el.classList.remove('mood-pop');
            void slot.el.offsetWidth;
            slot.el.classList.add('mood-pop');
          }
        } else {
          if (slot) {
            var old = slot.el;
            old.classList.add('out');
            later(function () { old.remove(); }, 240);
          }
          // si estaba del otro lado, se quita de ahí
          var other = side === 'left' ? 'right' : 'left';
          if (slots[other] && slots[other].who === who) { slots[other].el.remove(); slots[other] = null; }
          var p = el('<div class="story-portrait ' + side + '">' + portrait(who, mood, pOpts) + '</div>');
          stage.appendChild(p);
          slot = slots[side] = { who: who, key: key2, el: p };
        }
        speaking = slots[side];
        curWho = who;
      } else {
        curWho = null;
      }
      ['left', 'right'].forEach(function (sd) {
        if (slots[sd]) slots[sd].el.classList.toggle('speaking', slots[sd] === speaking);
      });
      stage.classList.toggle('duo', !!(slots.left && slots.right));
    }

    function stopTyping() {
      clearInterval(timer);
      timer = 0;
      typing = false;
      textEl.textContent = full;
      box.classList.add('ready');
    }

    function typeTick() {
      var n = Math.floor((now() - t0) * TYPE_CPS / 1000);
      if (n <= shown) return;
      var prevShown = shown;
      shown = Math.min(full.length, n);
      textEl.textContent = full.slice(0, shown);
      // un «blip» cada dos letras visibles
      for (var i = prevShown; i < shown; i++) {
        if (i % 2 === 0 && /\S/.test(full.charAt(i))) { play('blip', { who: curWho || '' }); break; }
      }
      if (shown >= full.length) stopTyping();
    }

    function showCard(line) {
      var face = lastSpeaker || villainFor(lvId || 1);
      var mood = lastMood || 'burlon';
      var popts = {};
      var text = String(line.card || '');
      // CONTINUARÁ = tres zooms; FIN / ¿Segunda temporada? = tarjetas finales; otro texto = rótulo de transición
      var kind = /continuar/i.test(text) ? 'cliff' : 'note';
      if (/fin de la temporada/i.test(text)) { kind = 'fin'; face = 'cocardo'; mood = 'triste'; popts = { variant: 'carcel' }; }
      else if (/segunda temporada/i.test(text)) { kind = 'season'; face = 'cereza'; mood = 'coqueta'; popts = { variant: 'huida' }; }
      if (line.who && knownChar(line.who)) { face = line.who; mood = line.mood || mood; }
      cardLayer.innerHTML = '';
      cardLayer.appendChild(tvCard(text, kind === 'note' ? null : face, mood, popts, kind));
      box.classList.add('hidden-box');
      stage.classList.add('hidden-stage');
      if (kind === 'note') play('blip', { who: 'reportera' });
      else play(kind === 'fin' ? 'win' : 'drama');
      cardReadyAt = now() + (reducedMotion() ? 400 : (kind === 'note' ? 700 : 1500));
    }

    function next() {
      clearTimeout(autoTimer);
      if (typing) { stopTyping(); return; }
      if (cardReadyAt && now() < cardReadyAt) return;
      cardReadyAt = 0;
      idx++;
      if (idx >= lines.length) { finish(); return; }
      var line = lines[idx] || {};
      cardLayer.innerHTML = '';
      box.classList.remove('hidden-box');
      stage.classList.remove('hidden-stage');
      if (line.sfx) {
        // efecto de sonido de historieta («¡CLAC!», «¡CRASH!»...) con destello y sacudida
        var fx = SFX[line.sfx] || { word: String(line.text || line.sfx).toUpperCase(), sound: 'drama', flash: 'white', shake: true };
        fxEl.innerHTML = '<span class="sfx-word sfx-' + esc(line.sfx) + '">' + esc(line.text || sfxWord(line.sfx) || fx.word) + '</span>';
        fxEl.classList.remove('sfx-on');
        void fxEl.offsetWidth;
        fxEl.classList.add('sfx-on');
        if (fx.shake) {
          o.classList.remove('shake');
          void o.offsetWidth;
          o.classList.add('shake');
        }
        if (fx.flash) flash(fx.flash);
        play(fx.sound);
        box.classList.add('hidden-box');
        autoTimer = later(next, 1100);
        return;
      }
      if (line.card) {
        showCard(line);
        return;
      }
      fxEl.innerHTML = '';
      setPortrait(line);
      if (knownChar(line.who)) { lastSpeaker = line.who; lastMood = line.mood || 'normal'; }
      var nm = line.who ? nameOf(line.who) : '';
      nameEl.textContent = nm;
      nameEl.hidden = !nm;
      nameEl.className = 'story-name ' + (sides[line.who] || 'left');
      box.classList.toggle('narrator', !line.who);
      full = String(line.text || '');
      box.setAttribute('aria-label', (nm ? nm + ': ' : '') + full);
      shown = 0;
      textEl.textContent = '';
      box.classList.remove('ready');
      typing = true;
      t0 = now();
      clearInterval(timer);
      timer = setInterval(typeTick, 33);
      typeTick();
    }

    function finish() {
      if (ended) return;
      ended = true;
      clearInterval(timer);
      clearTimeout(autoTimer);
      if (key) { data().seen[key] = true; persist(); }
      closeOverlay(o);
      if (done) later(done, 0);
    }

    o.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-act="skip"]')) { ev.stopPropagation(); finish(); return; }
      next();
    });
    var entry = stack[findEntry(o)];
    entry.onKey = function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar' || ev.key === 'ArrowRight') {
        if (doc.activeElement && doc.activeElement.closest && doc.activeElement.closest('[data-act="skip"]')) return false;
        next();
        return true;
      }
      return false;
    };
    entry.cleanup = function () { clearInterval(timer); clearTimeout(autoTimer); };
    try { box.focus({ preventScroll: true }); } catch (e) { /* nada */ }
    next();
  }

  // Tarjeta de telenovela: tres zooms rápidos a una cara + texto en letra manuscrita
  function tvCard(text, face, mood, popts, kind) {
    var rays = '';
    for (var i = 0; i < 12; i++) rays += '<i style="--r:' + (i * 30) + 'deg"></i>';
    return el('<div class="tv-card tv-' + (kind || 'cliff') + '">' +
      '<div class="tv-rays" aria-hidden="true">' + rays + '</div>' +
      (face ? '<div class="tv-face" aria-hidden="true">' + portrait(face, mood, popts) + '</div>' : '') +
      '<div class="tv-bars" aria-hidden="true"></div>' +
      '<p class="tv-text">' + esc(text) + '</p>' +
      '<small class="tv-hint">Toca para continuar</small>' +
      '</div>');
  }

  /* ---------- «Omitir historias» (settings.skipStory) ---------- */

  function skipStoriesOn() { return !!(data().settings && data().settings.skipStory); }
  // Escena normal (antes/después del nivel): con «Omitir historias» se da por vista y se sigue.
  // Los cliffhangers (solo su tarjeta) y el final se juegan siempre: ver playScenes.
  function playScene(key, done, opts) {
    if (!key || !script(key)) { if (done) done(); return; }
    if (skipStoriesOn()) {
      data().seen[key] = true;
      persist();
      if (done) done();
      return;
    }
    playStory(key, done, opts);
  }
  // Solo las tarjetas de cliffhanger, con la cara del último que habló (como en el guion completo)
  function cliffCards(lines) {
    var out = [];
    var who = null, mood = 'normal';
    lines.forEach(function (l) {
      if (!l) return;
      if (l.card) {
        if (/continuar/i.test(l.card)) out.push(l.who || !who ? l : { card: l.card, who: who, mood: mood });
        else if (/fin de la temporada|segunda temporada/i.test(l.card)) out.push(l);
      } else if (l.who && knownChar(l.who)) {
        who = l.who;
        mood = l.mood || 'normal';
      }
    });
    return out;
  }

  // Juega una lista de escenas en orden: claves de guion o { cliff:key } / { ending:true }
  function playScenes(list, done, lvId) {
    list = (list || []).slice();
    function step() {
      if (!list.length) { if (done) done(); return; }
      var s = list.shift();
      if (typeof s === 'string') { playScene(s, step, { level: lvId }); return; }
      if (s.cliff) {
        // diálogo del cliffhanger + tarjeta «CONTINUARÁ…» (si el guion no la trae)
        var lines = script(s.cliff) || [];
        var hasCard = lines.some(function (l) { return l && l.card; });
        playStory(s.cliff, step, { level: lvId, extraCards: hasCard ? null : [{ card: 'CONTINUARÁ…' }], cardsOnly: skipStoriesOn() });
        return;
      }
      if (s.ending) {
        var el2 = script('ending') || [];
        var cards = [];
        var hasFin = el2.some(function (l) { return l && l.card && /fin de la temporada/i.test(l.card); });
        var hasSeason = el2.some(function (l) { return l && l.card && /segunda temporada/i.test(l.card); });
        if (!hasFin) cards.push({ card: 'FIN DE LA TEMPORADA 1' });
        if (!hasSeason) cards.push({ card: '¿Segunda temporada…?' });
        // la respuesta a «¿Segunda temporada…?»: el siguiente capítulo y cuándo se abre
        var nx = chapterStateOf((lvId | 0) + 1);
        if (nx && nx.state === 'abierto') cards.push({ card: 'Capítulo ' + nx.id + ': ¡ya te espera!' });
        else if (nx && nx.when) cards.push({ card: 'Capítulo ' + nx.id + ': ' + nx.when.charAt(0).toLowerCase() + nx.when.slice(1) });
        playStory('ending', step, { level: lvId, extraCards: cards, zone: 'congelador' });
        return;
      }
      step();
    }
    step();
  }

  /* ===================================================================== */
  /*                         INTRO DE NIVEL Y JUEGO                         */
  /* ===================================================================== */

  var session = null;
  var playToken = 0;
  var mounted = false;
  var attempts = {};   // intentos por nivel en esta sesión (se manda a GA4 como `attempt`)

  function ensureMounted() {
    if (mounted) return true;
    var g = game();
    if (!g || typeof g.mount !== 'function') return false;
    try {
      g.mount(doc.getElementById('screen-game'));
      mounted = true;
    } catch (e) {
      console.error('[Cocardo.Game.mount]', e);
    }
    return mounted;
  }

  // Desde el mapa: historia previa (la primera vez) y luego la intro del nivel.
  // opts.direct (botón «Siguiente»): si el nivel no estrena mecánica ni potenciador, sin tarjeta de intro:
  // historia (si no se ha visto) -> tablero.
  function openLevel(id, opts) {
    opts = opts || {};
    var lv = getLevel(id);
    if (!lv) { toast('Este nivel aún se está congelando…'); return; }
    if (!opts.force && !playable(id)) {
      // capítulo construido pero con fecha por llegar: la ficha dice cuándo se abre
      var cs = chapterStateOf(id);
      if (current !== 'map') show('map');
      if (cs && cs.state !== 'abierto') showRoadmap(cs.id);
      else toast('Este nivel aún se está congelando…');
      return;
    }
    var fresh = unlockBoostersFor(id);
    var sc = scenesFor(id);
    function next() {
      if (opts.direct && !needsIntro(lv, fresh)) { startLevel(id); return; }
      if (current !== 'map') show('map');
      showIntro(id, fresh);
    }
    if (sc.pre && !data().seen[sc.pre] && script(sc.pre)) playScene(sc.pre, next, { level: id });
    else next();
  }
  // El tablero enseña la mecánica del nivel (tutorial con mano guía) la primera vez que se juega
  function boardTeaches(lv) { return !!(lv && lv.teach && !data().seen['teach' + lv.id]); }
  function needsIntro(lv, fresh) { return (fresh && fresh.length > 0) || boardTeaches(lv); }

  function boostersHtml(daily, fresh) {
    var d = data();
    if (daily) return '<p class="intro-note">' + icon('lock', 16) + ' Sin potenciadores en el Reto Diario</p>';
    return '<div class="boosters">' + BOOSTERS.map(function (b) {
      var un = d.boostersUnlocked[b.id];
      var isNew = fresh && fresh.indexOf(b.id) >= 0;
      return '<div class="booster' + (un ? '' : ' locked') + (isNew ? ' fresh' : '') + '" title="' + esc(b.name) + '">' +
        (isNew ? '<span class="b-new">¡Nuevo!</span>' : '') +
        '<span class="b-icon">' + icon(b.id, 30) + '</span>' +
        (un ? '<b class="b-count">' + (d.boosters[b.id] | 0) + '</b>' : '<span class="b-lock">' + icon('lock', 14) + '</span>') +
        '<small>' + esc(un ? b.name : 'Nivel ' + b.level) + '</small></div>';
    }).join('') + '</div>';
  }

  function showIntro(id, freshBoosters) {
    var lv = getLevel(id);
    if (!lv) return;
    if (isOpen('intro')) closeOverlay('intro', true);
    var d = data();
    var ch = chapterOf(id);
    var helper = helperFor(id);
    // si el tablero va a enseñar la mecánica con su tutorial, el consejo de la tarjeta sobra (y no cabe)
    var tip = boardTeaches(lv) ? '' : tipFor(id);
    var stars = d.stars[id - 1] | 0;
    var best = d.best[id - 1] | 0;
    var fresh = freshBoosters || [];
    var badges = '';
    if (isFinale(id)) badges += '<span class="badge badge-boss">' + (lv.final ? '¡Gran final!' : 'Final de capítulo') + '</span>';
    if (lv.hard) badges += '<span class="badge badge-drama">¡Drama!</span>';
    // fila compacta: capítulo + (estrellas y récord solo si ya se jugó)
    var meta = '<p class="intro-chapter">' + esc(ch ? 'Capítulo ' + ch.id + ' · ' + ch.name : '') + '</p>';
    var starsRow = (stars || best) ? '<div class="intro-stars">' + starsHtml(stars, 'mid-star') + (best ? '<small>Récord: ' + best.toLocaleString('es-MX') + '</small>' : '') + '</div>' : '';
    var o = openOverlay('intro',
      '<div class="card pop intro-card" style="--zc:' + esc(ch && ch.color || '#ff6fa5') + '">' +
        '<button class="close-btn" data-act="close" aria-label="Volver al mapa">' + icon('close', 22) + '</button>' +
        '<div class="ribbon"><span>Nivel ' + id + '</span></div>' +
        // bloques: en vertical van uno tras otro; en horizontal bajo, metas a la izquierda y ayudas a la derecha
        '<div class="intro-head"><h2 class="intro-name">' + esc(lv.name || '') + '</h2>' +
          meta +
          (badges ? '<div class="badges">' + badges + '</div>' : '') +
          starsRow + '</div>' +
        '<div class="intro-main"><h3 class="sec-title">Objetivos</h3>' + goalsHtml(lv) +
          '<div class="moves-pill">' + icon('moves', 22) + '<b>' + (lv.moves | 0) + '</b> movimientos</div></div>' +
        '<div class="intro-side">' +
          (tip ? '<div class="tip"><span class="tip-face">' + portrait(helper, 'feliz', helperFrozen(id) ? { frozen: true } : {}) + '</span><p class="tip-bubble"><b>' + esc(nameOf(helper)) + ':</b> ' + esc(tip) + '</p></div>' : '') +
          '<h3 class="sec-title sec-boost">Potenciadores</h3>' + boostersHtml(false, fresh) + '</div>' +
        '<div class="btn-row"><button class="btn btn-pink btn-big" data-act="play" data-autofocus>' + icon('play', 26) + ' ¡A jugar!</button></div>' +
      '</div>',
    { label: 'Nivel ' + id, guard: true, onEsc: function () { closeOverlay('intro'); } });
    o.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-act]');
      if (!t && ev.target === o) { closeOverlay(o); return; }
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (act === 'close') closeOverlay(o);
      else if (act === 'play') { closeOverlay(o, true); startLevel(id); }
    });
    // el potenciador nuevo se celebra en su propia ventana, encima de la tarjeta
    if (fresh.length) showBoosterPop(fresh);
  }

  var BOOSTER_DESC = {
    cucharon: 'Rompe una fruta o un bloque sin gastar movimiento.',
    chorro: 'Limpia una fila entera de un solo chorro.',
    batido: 'Revuelve todo el tablero cuando no ves jugadas.',
  };
  function showBoosterPop(list) {
    if (isOpen('unlock')) closeOverlay('unlock', true);
    var rays = '';
    for (var i = 0; i < 12; i++) rays += '<i style="--r:' + (i * 30) + 'deg"></i>';
    var items = list.map(function (b) {
      return '<div class="unlock-item">' +
        '<span class="unlock-icon"><span class="unlock-rays" aria-hidden="true">' + rays + '</span>' + icon(b, 72) + '<b class="unlock-count">×3</b></span>' +
        '<b class="unlock-name">' + esc(boosterName(b)) + '</b>' +
        '<p class="unlock-desc">' + esc(BOOSTER_DESC[b] || '') + '</p></div>';
    }).join('');
    var title = list.length > 1 ? '¡Nuevos potenciadores!' : '¡Nuevo potenciador!';
    var o = openOverlay('unlock',
      '<div class="card pop unlock-card">' +
        '<div class="ribbon ribbon-gold"><span>¡Regalo!</span></div>' +
        '<p class="unlock-title">' + esc(title) + '</p>' +
        items +
        '<div class="btn-row"><button class="btn btn-pink btn-big" data-act="ok" data-autofocus>¡Genial!</button></div>' +
      '</div>',
    { label: title, guard: true, onEsc: function () { closeOverlay('unlock'); } });
    play('booster');
    o.addEventListener('click', function (ev) {
      if (ev.target === o || ev.target.closest('[data-act="ok"]')) closeOverlay(o);
    });
    return o;
  }

  function randomSeed() { return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1; }

  // Arranca el tablero. opts: { daily, practice, dailyKey, dailyNum, seed, level }
  function startLevel(id, opts) {
    opts = opts || {};
    var lv = opts.level || getLevel(id);
    if (!lv) { toast('Este nivel aún se está congelando…'); return false; }
    closeAllOverlays();
    if (!opts.daily) unlockBoostersFor(id);
    if (session && !session.ended) gameCall('stop');
    var token = ++playToken;
    session = {
      levelId: lv.id || id, level: lv, daily: !!opts.daily, practice: !!opts.practice,
      dailyKey: opts.dailyKey || 0, dailyNum: opts.dailyNum || 0,
      seed: opts.seed != null ? opts.seed : randomSeed(), ended: false, opts: opts,
    };
    show('game');
    if (!ensureMounted()) {
      toast('El tablero no está disponible');
      return false;
    }
    gameCall('start', lv, {
      seed: session.seed,
      daily: session.daily,
      onEnd: function (result) { if (token === playToken) onEnd(result); },
      onPause: function () { if (token === playToken) showPause(); },
    });
    requestAnimationFrame(function () { gameCall('resize'); });
    // intentos seguidos del mismo nivel en esta sesión (para ver la «cola larga» en GA4 sin tocar el guardado)
    if (!opts.daily) { attempts[lv.id || id] = (attempts[lv.id || id] | 0) + 1; }
    track('level_start', { level: lv.id || id, chapter: (lv.chapter | 0) || chapterOf(lv.id || id).id, daily: !!opts.daily, practice: !!opts.practice, attempt: opts.daily ? 0 : attempts[lv.id || id] });
    if (data().settings.clips && clipsSupported()) later(function () { if (token === playToken && session && !session.ended) startClip(); }, 350);
    return true;
  }

  function replay() {
    if (!session) return;
    var s = session;
    if (s.daily) {
      // el reto se repite como práctica: mismo tablero, no se guarda
      startLevel(s.levelId, { daily: true, practice: true, dailyKey: s.dailyKey, dailyNum: s.dailyNum, seed: s.seed, level: s.level });
    } else {
      startLevel(s.levelId);
    }
  }

  function leaveGame() {
    stopClip(true);
    gameCall('stop');
    session = null;
    playToken++;
  }

  /* ---------- pausa ---------- */

  // El tablero dice si se puede pausar (no durante el Helado Final ni la celebración, ni con el resultado
  // ya decidido por el motor aunque la animación siga). Sin Game.canPause, se mira el estado del motor.
  function resultDecided() {
    var st = gameCall('_state');
    return !!(st && st.status && st.status !== 'playing');
  }
  function gameCanPause() {
    var g = game();
    if (g && typeof g.canPause === 'function') {
      try { if (!g.canPause()) return false; } catch (e) { /* se sigue con la comprobación de respaldo */ }
    }
    return !resultDecided();
  }

  function showPause() {
    if (current !== 'game' || !session || session.ended) return;
    if (isOpen('pause')) return;
    // también cubre visibilitychange: con el turno ganador o perdedor ya decidido no se abre la Pausa,
    // así Mapa/Reiniciar no pueden tirar el resultado (el temporizador del final entrega onEnd)
    if (!gameCanPause()) return;
    gameCall('pause');
    var lv = session.level || {};
    var title = session.daily ? 'Reto #' + session.dailyNum : 'Nivel ' + session.levelId;
    var o = openOverlay('pause',
      '<div class="card pop pause-card">' +
        '<div class="ribbon ribbon-drama"><span>Pausa</span></div>' +
        '<p class="pause-level">' + esc(title) + (lv.name ? ' · ' + esc(lv.name) : '') + '</p>' +
        goalsHtml(lv) +
        '<div class="btn-col">' +
          '<button class="btn btn-pink btn-big" data-act="resume" data-autofocus>' + icon('play', 24) + ' Seguir</button>' +
          '<button class="btn btn-gold" data-act="restart">' + icon('retry', 22) + ' Reiniciar</button>' +
          '<button class="btn btn-mint" data-act="map">' + icon('map', 22) + ' Mapa</button>' +
        '</div>' +
        '<div class="pause-toggles">' + toggleHtml('sound', 'Sonido', data().settings.sound) + toggleHtml('music', 'Música', data().settings.music) + (clipsSupported() ? toggleHtml('clips', 'Grabar clip', !!data().settings.clips, '', 'video') : '') + '</div>' +
      '</div>',
    { label: 'Pausa', onEsc: function () { resumeFromPause(); } });
    o.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-act], [data-toggle]');
      if (!t) return;
      if (t.hasAttribute('data-toggle')) { flipToggle(t); return; }
      var act = t.getAttribute('data-act');
      // defensa extra: si el resultado ya está decidido, Mapa/Reiniciar solo reanudan para que llegue onEnd
      if ((act === 'restart' || act === 'map') && (resultDecided() || !session || session.ended)) { resumeFromPause(); return; }
      if (act === 'resume') resumeFromPause();
      else if (act === 'restart') { closeOverlay(o, true); gameCall('restart'); gameCall('resume'); }
      else if (act === 'map') { closeOverlay(o, true); leaveGame(); show('map'); }
    });
  }
  function resumeFromPause() {
    closeOverlay('pause');
    gameCall('resume');
  }

  /* ---------- fin de nivel: contabilidad ---------- */

  var debugOverride = null;
  function onEnd(result) {
    result = result || {};
    if (debugOverride) {
      Object.keys(debugOverride).forEach(function (k) { result[k] = debugOverride[k]; });
      debugOverride = null;
    }
    var sess = session || { levelId: result.levelId, daily: !!result.daily, level: getLevel(result.levelId) };
    if (sess.ended) return;
    if (result.interrupted) { recordInterrupted(result, sess); return; }
    sess.ended = true;
    pendingClip = stopClip(false);
    closeOverlay('pause', true);
    if (sess.daily || result.daily) dailyEnd(result, sess);
    else campaignEnd(result, sess);
  }

  // Resultado ya decidido que el tablero entrega al detenerse o reiniciarse (stop/restart/start llegaron
  // antes que onEnd): se guarda igual (estrellas, desbloqueo, rescates, intento oficial del reto) pero sin
  // Victoria/Derrota; las escenas pendientes (post/cliffhanger/final) se juegan la próxima vez que se vea el
  // mapa. La sesión no se da por terminada: tras restart() sigue con la partida nueva (en el reto diario esa
  // ya cuenta como práctica, porque el intento oficial quedó guardado).
  function recordInterrupted(result, sess) {
    if (sess.daily || result.daily) { recordDaily(result, sess); return; }
    if (!result.won) return;
    var id = result.levelId || sess.levelId;
    var sum = recordCampaignWin(result, id);
    if (sum.pending && sum.pending.length) queuedScenes.push({ id: id, list: sum.pending.slice() });
  }

  var queuedScenes = [];
  function sceneSeen(p) {
    var seen = data().seen;
    if (typeof p === 'string') return !!seen[p];
    if (p && p.cliff) return !!seen[p.cliff];
    if (p && p.ending) return !!seen.ending;
    return true;
  }
  // Escenas de una victoria interrumpida: se juegan en el mapa en cuanto no haya otra capa abierta
  function flushQueuedScenes() {
    if (current !== 'map' || stack.length) return;
    while (queuedScenes.length) {
      var q = queuedScenes.shift();
      var list = q.list.filter(function (p) { return !sceneSeen(p); });
      if (!list.length) continue;
      playScenes(list, function () { afterScenes(q.id, list); }, q.id);
      return;
    }
  }

  // Calcula y guarda estrellas, récord, desbloqueo, rescates y premios. Devuelve el resumen para la Victoria.
  function recordCampaignWin(result, id) {
    var d = data();
    var i = id - 1;
    var prev = d.stars[i] | 0;
    var stars = clamp((result.stars | 0) || 1, 1, 3);
    var sum = { id: id, stars: stars, prevStars: prev, firstWin: prev === 0, record: false, freed: [], rewards: [], score: result.score | 0 };
    d.stars[i] = Math.max(prev, stars);
    if ((result.score | 0) > (d.best[i] | 0)) { sum.record = prev > 0; d.best[i] = result.score | 0; }
    // el desbloqueo puede apuntar a un nivel que todavía no existe (capítulo en construcción): el mapa lo
    // limita a lo jugable hoy (openCount) y, al abrirse el capítulo, el siguiente nivel ya está libre
    d.unlocked = Math.max(d.unlocked, Math.min(maxLevels(), id + 1));
    // rescatados: los que informa el motor y, si el nivel tenía objetivo de rescate, todos los de level.rescue
    var lv = getLevel(id);
    var freedNow = (result.rescued || []).slice();
    if (lv && lv.rescue && (lv.goals || []).some(function (g) { return g.type === 'rescue'; })) {
      lv.rescue.forEach(function (w) { if (freedNow.indexOf(w) < 0) freedNow.push(w); });
    }
    sum.rescuedAll = freedNow;
    freedNow.forEach(function (w) {
      if (d.rescued.indexOf(w) < 0) { d.rescued.push(w); sum.freed.push(w); }
    });
    if (stars === 3 && prev < 3) {
      var b = grantRandomBooster();
      if (b) sum.rewards.push({ kind: 'star3', booster: b });
    }
    persist();
    cloudPush();
    // escenas pendientes (primera victoria)
    var sc = scenesFor(id);
    var pend = [];
    if (sc.post && !d.seen[sc.post] && script(sc.post)) pend.push(sc.post);
    if (sc.cliff && !d.seen[sc.cliff]) pend.push(sc.cliff === 'ending' ? { ending: true } : { cliff: sc.cliff });
    if (lv && lv.final && !d.seen.ending && !pend.some(function (p) { return p && p.ending; })) pend.push({ ending: true });
    sum.pending = pend;
    return sum;
  }

  function campaignEnd(result, sess) {
    var id = result.levelId || sess.levelId;
    track('level_end', { level: id, chapter: chapterOf(id).id, won: !!result.won, stars: result.stars | 0, moves_used: result.movesUsed | 0, moves_left: result.movesLeft | 0, attempt: attempts[id] | 0 });
    if (result.won) attempts[id] = 0;
    if (result.won) {
      var sum = recordCampaignWin(result, id);
      showVictory(result, sess, sum);
    } else {
      showDefeat(result, sess);
    }
  }

  function dailyEnd(result, sess) {
    track('daily_end', { num: sess.dailyNum | 0, won: !!result.won, stars: result.stars | 0, moves_used: result.movesUsed | 0, practice: !!sess.practice });
    var sum = recordDaily(result, sess);
    if (result.won) showVictory(result, sess, sum);
    else showDefeat(result, sess, sum);
  }
  // Guarda el intento del reto (solo el primero terminado del día es oficial). Devuelve el resumen.
  function recordDaily(result, sess) {
    var d = data();
    var key = sess.dailyKey || keyOf(dateParts(0));
    var official = !sess.practice && !d.daily.results[key];
    var sum = { daily: true, practice: !official, rewards: [], num: sess.dailyNum, key: key };
    if (official) {
      if (d.daily.last !== key) {
        d.daily.streak = (d.daily.last && prevKey(key) === d.daily.last) ? d.daily.streak + 1 : 1;
        d.daily.last = key;
      }
      d.daily.bestStreak = Math.max(d.daily.bestStreak | 0, d.daily.streak | 0);
      var b = grantRandomBooster();
      if (b) sum.rewards.push({ kind: 'daily', booster: b });
      var text = dailyShareText(result, sess, d.daily.streak);
      d.daily.results[key] = {
        won: !!result.won, stars: result.won ? clamp(result.stars | 0, 1, 3) : 0, score: result.score | 0,
        movesUsed: result.movesUsed | 0, movesTotal: result.movesTotal | 0, maxCombo: result.maxCascade | 0,
        num: sess.dailyNum, text: text,
      };
      persist();
      cloudPush();
      cloudSubmitDaily(key);
    }
    sum.streak = currentStreak();
    return sum;
  }
  // Clave del día anterior a una clave YYYYMMDD
  function prevKey(key) {
    var y = Math.floor(key / 10000), m = Math.floor(key / 100) % 100, dd = key % 100;
    var t = new Date(y, m - 1, dd - 1);
    return keyOf({ y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() });
  }

  function dailyShareText(result, sess, streak) {
    var D = Cocardo.Daily;
    try {
      if (D && D.shareText) {
        return D.shareText({
          num: sess.dailyNum, won: !!result.won, movesUsed: result.movesUsed | 0, movesTotal: result.movesTotal | 0,
          stars: result.won ? clamp(result.stars | 0, 1, 3) : 0, maxCombo: result.maxCascade | 0, turns: result.turns || [], streak: streak | 0,
        });
      }
    } catch (e) { console.error('[Cocardo.Daily.shareText]', e); }
    return '🥥 Cocardo: ¡Rescate Helado! · Reto #' + sess.dailyNum + '\n' +
      (result.won ? '⭐'.repeat(clamp(result.stars | 0, 1, 3)) : '❌') + ' ' + (result.movesUsed | 0) + '/' + (result.movesTotal | 0) + ' movs\n🔥 Racha: ' + (streak | 0);
  }

  function campaignShareText(id, stars, rescued) {
    var names = (rescued || []).map(nameOf);
    var D = Cocardo.Daily;
    try {
      if (D && D.campaignShareText) return D.campaignShareText({ levelId: id, stars: stars, rescued: names });
    } catch (e) { console.error('[Cocardo.Daily.campaignShareText]', e); }
    return '🥥 Cocardo: ¡Rescate Helado!\nNivel ' + id + ' ' + '⭐'.repeat(stars) +
      (names.length ? ' ¡Rescaté a ' + names.join(' y a ') + '!' : '') + ' ¿Puedes tú?';
  }

  /* ---------- Victoria ---------- */

  var VICTORY_TITLES = ['¡Lo lograste!', '¡Qué rico!', '¡DELICIOSO!'];

  function rewardHtml(r) {
    if (r.kind === 'star3') {
      return '<div class="reward reward-booster"><span class="r-icon">' + icon(r.booster, 34) + '</span><span><small>Premio por 3 estrellas</small><b>+1 ' + esc(boosterName(r.booster)) + '</b></span></div>';
    }
    if (r.kind === 'daily') {
      return '<div class="reward reward-booster"><span class="r-icon">' + icon(r.booster, 34) + '</span><span><small>Premio del reto</small><b>+1 ' + esc(boosterName(r.booster)) + '</b></span></div>';
    }
    return '';
  }

  function showVictory(result, sess, sum) {
    var daily = !!sum.daily;
    var stars = clamp((result.stars | 0) || 1, 1, 3);
    var id = result.levelId || sess.levelId;
    var count = openCount();   // lo jugable hoy: tras el último nivel abierto, «Continuar» lleva al mapa
    var rescued = (sum.rescuedAll || result.rescued || []).filter(function (w, i, a) { return a.indexOf(w) === i; });
    // un solo renglón aunque sean varios (L30: Uva y Banana), para que la tarjeta quepa sin desplazar
    var rNames = rescued.map(nameOf);
    var rescueHtml = rescued.length ? '<div class="rescue-row' + (rescued.length > 1 ? ' rr-multi' : '') + '">' +
      rescued.map(function (w) { return '<span class="rr-face">' + portrait(w, 'feliz') + '</span>'; }).join('') +
      '<span class="rr-txt"><small>¡Libre del hielo!</small><b>¡Rescataste a ' + esc(rNames.length > 1 ? rNames.slice(0, -1).join(', ') + ' y ' + rNames[rNames.length - 1] : rNames[0]) + '!</b></span><span class="rr-hearts" aria-hidden="true"><i></i><i></i><i></i></span></div>' : '';
    var title = daily ? '¡Reto superado!' : VICTORY_TITLES[stars - 1];
    // protagonista de la tarjeta: la fruta rescatada (fila de rescate) o, si no hubo rescate, el villano llorando
    var villain = villainFor(id);
    var cry = tauntFor(villain, 'win') || (villain === 'cereza' ? '¿¡Mi inventario!?' : '¡Mi sabor estrella!');
    var heroHtml = rescued.length ? '' :
      '<div class="v-hero"><span class="v-hero-face">' + portrait(villain, 'llorando') + '</span><p class="v-hero-bubble">' + esc(cry) + '</p></div>';
    var sub = daily ? 'Reto #' + (sess.dailyNum || '') + (sum.practice ? '' : ' · ¡Racha ' + (sum.streak | 0) + '!') : 'Nivel ' + id + (sess.level && sess.level.name ? ' · ' + sess.level.name : '');
    var btns;
    if (daily) {
      btns = '<button class="btn btn-pink btn-big" data-act="share-daily" data-autofocus>' + icon('share', 24) + ' Compartir</button>' +
        '<div class="btn-row">' +
          '<button class="btn btn-gold" data-act="daily">' + icon('calendar', 22) + ' Reto</button>' +
          '<button class="btn btn-mint" data-act="map">' + icon('map', 22) + ' Mapa</button>' +
        '</div>';
    } else {
      // primero lo pendiente: con el final de temporada por ver, el botón lo dice aunque ya haya más niveles abiertos
      var hasEnding = (sum.pending || []).some(function (x) { return x && x.ending; });
      var nextLabel = hasEnding ? '¡Ver el final!' : (id >= count ? 'Continuar' : 'Siguiente');
      btns = '<button class="btn btn-pink btn-big" data-act="next" data-autofocus>' + nextLabel + ' ' + icon('next', 24) + '</button>' +
        '<div class="btn-row tri">' +
          '<button class="btn btn-gold" data-act="replay">' + icon('retry', 22) + ' Repetir</button>' +
          '<button class="btn btn-mint" data-act="map">' + icon('map', 22) + ' Mapa</button>' +
          '<button class="btn btn-ice" data-act="share">' + icon('share', 22) + ' Compartir</button>' +
        '</div>';
    }
    var sprinkles = '';
    for (var i = 0; i < 18; i++) sprinkles += '<i style="--x:' + ((i * 53) % 100) + '%;--d:' + (1.6 + (i % 5) * 0.35) + 's;--delay:' + ((i * 0.13) % 1.4).toFixed(2) + 's;--c:' + ['#ff6fa5', '#ffc93c', '#bff3e1', '#4aa8e0', '#d61f4b', '#fff'][i % 6] + ';--rot:' + (i * 47 % 180) + 'deg"></i>';
    var o = openOverlay('victory',
      '<div class="sprinkles" aria-hidden="true">' + sprinkles + '</div>' +
      '<div class="card pop victory-card">' +
        '<div class="ribbon ribbon-gold"><span>' + esc(title) + '</span></div>' +
        (sum.practice ? '<span class="badge badge-practice">Práctica</span>' : '') +
        '<p class="v-sub">' + esc(sub) + '</p>' +
        '<div class="v-stars">' + [0, 1, 2].map(function (k) {
          return '<span class="v-star v-star-' + k + '" data-i="' + k + '"><span class="v-empty">' + icon('starEmpty', 64) + '</span><span class="v-full">' + icon('star', 64) + '</span></span>';
        }).join('') + '</div>' +
        '<div class="v-score"><small>Puntos</small><b class="js-score">0</b>' + (sum.record ? '<span class="badge badge-record">¡Nuevo récord!</span>' : '') + '</div>' +
        '<div class="v-side">' + heroHtml + rescueHtml + (sum.rewards || []).map(rewardHtml).join('') + '</div>' +
        '<div class="btn-col">' + btns + '</div>' +
      '</div>',
    { label: title, guard: true });
    attachClipButton(o, function () { return daily ? ((data().daily.results[sum.key] || {}).text || '') : campaignShareText(id, stars, rescued); });
    // estrellas que se estampan una por una (~0,3 s cada una)
    var rm = reducedMotion();
    var base = rm ? 120 : 250;
    var gap = rm ? 100 : 300;
    for (var k = 0; k < stars; k++) {
      (function (k2) {
        later(function () {
          var s = $('.v-star-' + k2, o);
          if (s) s.classList.add('on');
          play('star', { i: k2 });
        }, base + k2 * gap);
      })(k);
    }
    if (rescued.length) later(function () { play('rescue'); }, base + stars * gap + 150);
    if ((sum.rewards || []).length) later(function () { play('booster'); }, base + stars * gap + 450);
    countUp($('.js-score', o), result.score | 0, rm ? 0 : 550, base);
    // imagen para compartir: se prepara después de los sellos (para no trabar la animación) y solo si el
    // navegador puede compartir archivos; al tocar «Compartir» ya está lista (el gesto del usuario sigue vivo)
    var shareFile = null;
    if (!daily && canShareFiles()) {
      var hero = rescued.length ? { who: rescued[0], mood: 'feliz', line: rescueLine(rescued[0]) } : { who: villain, mood: 'llorando', line: cry };
      later(function () {
        if (!o.isConnected) return;
        buildShareImage({ id: id, stars: stars, who: hero.who, mood: hero.mood, line: hero.line, zone: (chapterOf(id) || {}).zone || 'heladeria',
          title: '¡Nivel ' + id + ' superado!', name: (sess.level && sess.level.name) || '' }).then(function (f) { shareFile = f; });
      }, base + stars * gap + 600);
    }

    o.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-act]');
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (act === 'share') {
        var txt = campaignShareText(id, stars, rescued);
        if (!shareImage(shareFile, txt)) share(txt);
        return;
      }
      if (act === 'share-daily') { shareDailyResult(sum.key); return; }
      closeOverlay(o, true);
      if (act === 'replay') { replay(); return; }
      var pend = sum.pending || [];
      leaveGame();
      if (act === 'daily') { show('daily'); return; }
      if (act === 'map') {
        show('map');
        playScenes(pend, function () { afterScenes(id, pend); }, id);
        return;
      }
      if (act === 'next') {
        var cliffy = pend.some(function (p) { return p && (p.cliff || p.ending); });
        if (cliffy || id >= count) {
          // fin de capítulo: escenas y mapa con el rótulo del capítulo nuevo
          show('map');
          playScenes(pend, function () { afterScenes(id, pend); }, id);
        } else {
          // sin pasar por el mapa: escena posterior (si hay) -> siguiente nivel
          playScenes(pend, function () { openLevel(id + 1, { direct: true }); }, id);
        }
      }
    });
  }

  // Tras las escenas: mapa actualizado y, después de un cliffhanger, el rótulo del capítulo nuevo; si ya no
  // queda nada abierto, el mapa sube hasta el siguiente capítulo (programado o en construcción) y lo anuncia
  function afterScenes(id, pend) {
    var count = openCount();
    var hadCliff = pend.some(function (p) { return p && (p.cliff || p.ending); });
    var nextId = Math.min(count, id + 1);
    if (hadCliff && id < count) {
      // el rótulo del capítulo nuevo ya lo anuncia: sin el aviso «¡Capítulo N abierto!» encima
      var cs = chapterStateOf(nextId);
      if (cs && cs.built && cs.opens && !data().seen['open' + cs.id]) { data().seen['open' + cs.id] = true; persist(); }
    }
    // se vuelve a pintar: las escenas recién vistas cambian el aviso de próximo rescate
    if (current !== 'map') show('map');
    else renderMap();
    if (queuedScenes.length) later(flushQueuedScenes, 300);
    if (hadCliff && id < count) {
      var ch = chapterOf(nextId);
      if (ch) later(function () { chapterBanner(ch); }, 200);
      later(function () { scrollMapTo(nextId, true); }, 120);
    } else if (hadCliff && id >= count) {
      var nx = nextOpening();
      if (nx && nx.levels && nx.levels.length) {
        later(function () { scrollMapTo(nx.levels[0], true); }, 120);
        later(function () { roadmapBanner(nx); }, 450);
      }
    }
  }

  function chapterBanner(ch) {
    var sub = (story().chapterTitles && story().chapterTitles[ch.id - 1]) || '';
    var b = el('<div class="chapter-banner" aria-live="polite"><small>Capítulo ' + ch.id + (sub ? ' · ' + esc(sub) : '') + '</small><b>' + esc(ch.name) + '</b></div>');
    var col = $('#screen-map .map-col');
    if (!col) return;
    col.appendChild(b);
    play('drama');
    later(function () { b.remove(); }, 3200);
  }

  // Rótulo del siguiente capítulo cuando todavía no se puede jugar (con su fecha)
  function roadmapBanner(ch) {
    var small = 'Capítulo ' + ch.id + (ch.built ? ' · ¡muy pronto!' : ' · en construcción');
    var b = el('<div class="chapter-banner cb-roadmap" aria-live="polite"><small>' + esc(small) + '</small><b>' + esc(ch.name) + '</b>' +
      (ch.when ? '<span class="cb-when">' + icon(ch.built ? 'calendar' : 'cone', 16) + '<span>' + esc(ch.when) + '</span></span>' : '') + '</div>');
    var col = $('#screen-map .map-col');
    if (!col) return;
    col.appendChild(b);
    play('drama');
    later(function () { b.remove(); }, 3600);
  }

  // Cara que presenta cada temporada en la ficha del capítulo (el villano de la temporada)
  var SEASON_FACE = { 1: ['cocardo', 'burlon'], 2: ['cereza', 'coqueta'], 3: ['pina', 'burlon'], 4: ['cocardo', 'burlon'] };

  // Ficha de un capítulo que todavía no se puede jugar: nombre, teaser, fecha (o «previsto»), cuenta regresiva
  // y qué hacer mientras tanto. Registra el toque (roadmap_tap): es la señal de cuánta gente espera más niveles.
  function showRoadmap(cid) {
    var ch = null;
    chapterStates().forEach(function (c) { if (c.id === cid) ch = c; });
    if (!ch) return;
    if (ch.state === 'abierto') { if (ch.levels && ch.levels.length) scrollMapTo(ch.levels[0], true); return; }
    if (isOpen('roadmap')) closeOverlay('roadmap', true);
    track('roadmap_tap', { chapter: ch.id, state: ch.state, days: ch.days == null ? -1 : ch.days, built: !!ch.built });
    var R = roadmap();
    var scheduled = ch.state === 'programado';
    var prec = (R && R.parseOpens(ch.opens) || {}).precision;
    // «retrasado», o el día prometido sin el capítulo en esta copia del juego (lo más probable: una versión guardada)
    var late = ch.state === 'retrasado' || (!ch.built && prec === 'dia' && ch.days === 0);
    var daysTxt = (R && ch.days != null && !late && ch.days > 0 && (scheduled || prec === 'dia')) ? R.daysText(ch.days) : '';
    var whenSmall = scheduled ? 'Fecha de apertura' : 'Apertura prevista';
    var whenBig = ch.when || 'En construcción';
    if (ch.state === 'retrasado') { whenSmall = 'Estado'; whenBig = '¡Ya casi!'; }
    else if (/^Previsto para /.test(whenBig)) { whenSmall = 'Previsto para'; whenBig = whenBig.replace(/^Previsto para /, ''); whenBig = whenBig.charAt(0).toUpperCase() + whenBig.slice(1); }
    var online = true;
    try { online = navigator.onLine !== false; } catch (e) { online = true; }
    var canDaily = dailyUnlocked();
    var showReload = late && online;
    var tri = showReload && canDaily;
    var ribbon = scheduled ? '¡Muy pronto!' : 'En construcción';
    var first = ch.levels[0], last = ch.levels[ch.levels.length - 1];
    var note = late ? 'Se está tardando un poquito más de lo previsto. ¡Ya casi!' + (online ? ' Si ya se anunció, toca «Actualizar»: puede que tengas una versión guardada del juego.' : ' Abre el juego con internet para recibir la versión nueva.')
      : scheduled ? 'Los niveles ' + first + ' a ' + last + ' ya están listos: se abren solos ese día.'
      : 'Los niveles ' + first + ' a ' + last + ' se están congelando… Mientras tanto: el Reto Diario y las estrellas que te faltan.';
    var face = SEASON_FACE[ch.season] || SEASON_FACE[1];
    var o = openOverlay('roadmap',
      '<div class="card pop roadmap-card' + (late ? ' rm-late' : '') + '" style="--zc:' + esc(ch.color || '#ff6fa5') + '">' +
        '<button class="close-btn" data-act="close" aria-label="Cerrar">' + icon('close', 22) + '</button>' +
        '<div class="ribbon ribbon-drama"><span>' + esc(ribbon) + '</span></div>' +
        '<div class="rm-tape" aria-hidden="true"></div>' +
        '<p class="rm-chapter">' + esc('Capítulo ' + ch.id + (ch.season && ch.seasonName ? ' · Temporada ' + ch.season + ': ' + ch.seasonName : '')) + '</p>' +
        (ch.season > 1 ? '<p class="rm-fan">Historia original del juego de fans · no oficial</p>' : '') +
        '<div class="rm-head"><span class="rm-face">' + portrait(face[0], face[1]) + '</span>' +
          '<div class="rm-txt"><h2 class="rm-name">' + esc(ch.name) + '</h2>' + (ch.teaser ? '<p class="rm-teaser">' + esc(ch.teaser) + '</p>' : '') + '</div></div>' +
        '<div class="rm-when"><span class="rm-ico">' + icon(scheduled ? 'calendar' : 'cone', 30) + '</span>' +
          '<span class="rm-when-txt"><small>' + esc(whenSmall) + '</small><b>' + esc(whenBig) + '</b>' +
          (daysTxt ? '<small class="rm-days">' + esc(daysTxt) + '</small>' : '') + '</span></div>' +
        '<p class="rm-note">' + esc(note) + '</p>' +
        '<div class="btn-row' + (tri ? ' tri' : '') + '">' +
          (showReload ? '<button class="btn btn-pink" data-act="reload">' + icon('retry', 22) + ' Actualizar</button>' : '') +
          (canDaily ? '<button class="btn btn-gold" data-act="daily">' + icon('flame', 22) + (tri ? ' Reto' : ' Reto de hoy') + '</button>' : '') +
          '<button class="btn btn-ice" data-act="share" aria-label="Avisar a un amigo">' + icon('share', 22) + ' Avisar</button>' +
        '</div>' +
      '</div>',
    { label: 'Capítulo ' + ch.id, guard: true, onEsc: function () { closeOverlay('roadmap'); } });
    o.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-act]');
      if (!t && ev.target === o) { closeOverlay(o); return; }
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (act === 'close') closeOverlay(o);
      else if (act === 'daily') { closeOverlay(o, true); show('daily'); }
      else if (act === 'share') share(roadmapShareText(ch));
      else if (act === 'reload') { try { location.reload(); } catch (e) { /* nada */ } }
    });
    return o;
  }
  function roadmapShareText(ch) {
    var when = ch.when ? ch.when.charAt(0).toLowerCase() + ch.when.slice(1) : 'en construcción';
    var n = openCount();
    return '🥥 Cocardo: ¡Rescate Helado!\nCapítulo ' + ch.id + ' «' + ch.name + '»: ' + when + (/[!?…]$/.test(when) ? ' ' : '. ') + '¿Terminas los ' + n + ' niveles antes?';
  }

  function countUp(node, target, ms, delay) {
    if (!node) return;
    var fmt = function (v) { return Math.round(v).toLocaleString('es-MX'); };
    if (!ms) { node.textContent = fmt(target); return; }
    later(function () {
      var t0 = now();
      (function tick() {
        var k = clamp((now() - t0) / ms, 0, 1);
        node.textContent = fmt(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1 && node.isConnected) requestAnimationFrame(tick);
      })();
    }, delay || 0);
  }

  /* ---------- Derrota ---------- */

  function showDefeat(result, sess, sum) {
    sum = sum || {};
    var id = result.levelId || sess.levelId;
    var lv = sess.level || getLevel(id) || {};
    var villain = villainFor(id);
    var nm = result.nearMiss;
    var prog = goalProgress(result, lv);
    var headline;
    if (nm && nm.remaining > 0) {
      // cada meta pendiente con SU número y su ícono (nearMiss.goals); sin lista, la meta principal
      var near = (nm.goals && nm.goals.length ? nm.goals : [{ remaining: nm.remaining, icon: nm.icon }])
        .filter(function (g) { return (g.remaining | 0) > 0; });
      if (!near.length) near = [{ remaining: nm.remaining, icon: nm.icon }];
      var one = near.length === 1 && (near[0].remaining | 0) === 1;
      headline = '<p class="d-near' + (near.length > 1 ? ' multi' : '') + '">¡Casi! Te ' + (one ? 'falta' : 'faltan') + ' ' + joinEs(near.map(function (g) {
        var ic = nearIcon(g.icon || (g.type ? g : null), lv);
        return '<span class="d-nm"' + (g.title ? ' title="' + esc(g.title) + '"' : '') + '><b>' + (g.remaining | 0) + '</b>' + (ic ? '<span class="d-icon">' + ic + '</span>' : '') + '</span>';
      })) + '</p>';
    } else {
      headline = '<p class="d-near">¡Te quedaste sin movimientos!</p>';
    }
    // avance de cada objetivo (ícono + hecho/meta) y un consejo corto del ayudante para la mecánica del nivel
    var progHtml = prog && prog.length ? '<div class="d-goals" aria-label="Objetivos">' + prog.map(function (g) {
      return '<span class="d-goal' + (g.left > 0 ? '' : ' done') + '" title="' + esc(g.label) + '"><span class="dg-icon">' + g.icon + '</span>' +
        '<b class="dg-n">' + g.done + '<small>/' + g.target + '</small></b>' + (g.left > 0 ? '' : '<span class="dg-ok">' + icon('check', 14) + '</span>') + '</span>';
    }).join('') + '</div>' : '';
    var helper = helperFor(id);
    var tip = tipFor(id);
    var tipHtml = tip ? '<div class="d-tip"><span class="d-tip-face">' + portrait(helper, 'normal', helperFrozen(id) ? { frozen: true } : {}) + '</span>' +
      '<p class="d-tip-text"><b>' + esc(nameOf(helper)) + ':</b> ' + esc(tip) + '</p></div>' : '';
    var taunt = tauntFor(villain, 'lose') || tauntFor(villain, 'low') || (villain === 'cereza' ? 'Ay, qué fresquito te está quedando todo.' : '¡Se te derritió el tiempo!');
    var daily = !!(sum.daily);
    var btns = daily
      ? '<button class="btn btn-pink btn-big" data-act="share-daily" data-autofocus>' + icon('share', 24) + ' Compartir</button>' +
        '<div class="btn-row"><button class="btn btn-gold" data-act="retry">' + icon('retry', 22) + ' Practicar</button>' +
        '<button class="btn btn-mint" data-act="daily">' + icon('calendar', 22) + ' Reto</button></div>'
      : '<button class="btn btn-pink btn-big" data-act="retry" data-autofocus>' + icon('retry', 24) + ' Reintentar</button>' +
        '<div class="btn-row"><button class="btn btn-mint" data-act="map">' + icon('map', 22) + ' Mapa</button></div>';
    var o = openOverlay('defeat',
      '<div class="card pop defeat-card">' +
        '<div class="ribbon ribbon-cherry"><span>' + (daily ? '¡Reto perdido!' : '¡Se derritió!') + '</span></div>' +
        (sum.practice ? '<span class="badge badge-practice">Práctica</span>' : '') +
        '<p class="v-sub">' + esc(daily ? 'Reto #' + (sess.dailyNum || '') : 'Nivel ' + id + (lv.name ? ' · ' + lv.name : '')) + '</p>' +
        '<div class="d-villain"><div class="d-face">' + portrait(villain, 'carcajada') + '</div>' +
          '<p class="d-bubble">' + esc(taunt) + '</p></div>' +
        '<div class="d-info">' + headline + progHtml + tipHtml + (sum.rewards || []).map(rewardHtml).join('') + '</div>' +
        '<div class="btn-col">' + btns + '</div>' +
      '</div>',
    { label: 'Derrota', guard: true });
    attachClipButton(o, function () { return daily ? ((data().daily.results[sum.key] || {}).text || '') : ('Casi rescato a las frutas en el nivel ' + id + '… ¿Puedes tú?'); });
    later(function () { play('laugh', { who: villain }); }, reducedMotion() ? 50 : 350);
    o.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-act]');
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (act === 'share-daily') { shareDailyResult(sum.key); return; }
      closeOverlay(o, true);
      if (act === 'retry') { replay(); return; }
      leaveGame();
      show(act === 'daily' ? 'daily' : 'map');
    });
  }

  // «a», «a y b», «a, b y c»
  function joinEs(parts) {
    if (parts.length < 2) return parts.join('');
    return parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];
  }

  function rescueLine(who) {
    var r = story().rescueLines;
    return (r && r[who]) || '¡Libre! ¡Gracias, ayudante!';
  }

  // Avance de los objetivos al terminar: result.goals si el tablero lo trae; si no, el estado final del motor
  function goalProgress(result, lv) {
    var goals = Array.isArray(result.goals) ? result.goals : null;
    if (!goals) {
      var st = gameCall('_state');
      if (st && Array.isArray(st.goals) && (st.levelId == null || st.levelId === lv.id)) goals = st.goals;
    }
    if (!goals || !goals.length) return null;
    var defs = lv.goals || [];
    return goals.map(function (g, i) {
      var def = defs[i] || g;
      var gi = goalInfo(def, lv);
      var target = Math.max(0, (g.target != null ? g.target : gi.n) | 0);
      var left = clamp(g.remaining | 0, 0, target);
      var label = gi.label;
      if (gi.type === 'token') label = gi.label === 'Ayuda a Uva' ? 'Uva' : 'Pruebas';
      return { icon: gi.icon, label: label, done: target - left, target: target, left: left };
    });
  }

  function shareDailyResult(key) {
    var r = data().daily.results[key || keyOf(dateParts(0))];
    if (r && r.text) share(r.text);
    else toast('Juega el reto de hoy para compartirlo');
  }

  /* ===================================================================== */
  /*                              RETO DIARIO                              */
  /* ===================================================================== */

  var dailyTimer = 0;
  function stopDailyTimer() { clearInterval(dailyTimer); dailyTimer = 0; }

  function fmtCountdown(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, ss = s % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }
  function msToMidnight() {
    var d = new Date();
    var next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return next - d;
  }

  function subbar(title, iconName) {
    return '<header class="subbar"><button class="round-btn" data-act="back" aria-label="Volver al mapa">' + icon('back', 24) + '</button>' +
      '<h1 class="sub-title">' + (iconName ? icon(iconName, 26) : '') + esc(title) + '</h1><span class="subbar-space"></span></header>';
  }

  function renderDaily() {
    var sec = doc.getElementById('screen-daily');
    var d = data();
    var info = dailyInfo();
    var p = info.parts;
    var res = d.daily.results[info.key];
    var unlocked = dailyUnlocked();
    var body = '';
    if (!unlocked) {
      body = '<div class="card daily-card locked-card"><span class="big-lock">' + icon('lock', 56) + '</span>' +
        '<h2 class="card-title">¡Todavía no!</h2><p>El Reto Diario se abre al superar el <b>nivel 5</b>.</p>' +
        '<div class="btn-row"><button class="btn btn-pink" data-act="back">' + icon('map', 22) + ' Ir al mapa</button></div></div>';
    } else if (!info.ok) {
      body = '<div class="card daily-card"><h2 class="card-title">Reto no disponible</h2><p>Vuelve en un ratito: estamos raspando el hielo.</p></div>';
    } else {
      var lv = info.level;
      var state;
      if (res) {
        state = '<div class="daily-result ' + (res.won ? 'won' : 'lost') + '">' +
          '<b>' + (res.won ? '¡Superado! ' + '⭐'.repeat(clamp(res.stars | 0, 1, 3)) : '❌ No salió esta vez') + '</b>' +
          '<span>' + (res.movesUsed | 0) + '/' + (res.movesTotal | 0) + ' movs · ' + (res.score | 0).toLocaleString('es-MX') + ' pts</span></div>' +
          (res.text ? '<pre class="share-preview">' + esc(res.text) + '</pre>' : '');
      } else {
        state = '<p class="daily-hint">Mismo tablero para todos hoy. Solo cuenta tu <b>primer intento</b>.</p>';
      }
      body =
        '<div class="card daily-card">' +
          '<div class="daily-head"><span class="cal">' + icon('calendar', 34) + '</span><div><b class="daily-num">Reto #' + info.num + '</b>' +
          '<small>' + DAYS[p.wd] + ' ' + p.d + ' de ' + MONTHS[p.m - 1] + '</small></div></div>' +
          '<p class="daily-level">«' + esc(lv.name || '') + '» · <b>' + (lv.moves | 0) + '</b> movimientos</p>' +
          goalsHtml(lv) + state +
          '<div class="btn-col">' +
            (res
              ? '<button class="btn btn-pink btn-big" data-act="share" data-autofocus>' + icon('share', 24) + ' Compartir</button>' +
                '<button class="btn btn-gold" data-act="play">' + icon('retry', 22) + ' Jugar de práctica</button>'
              : '<button class="btn btn-pink btn-big" data-act="play" data-autofocus>' + icon('play', 24) + ' ¡Jugar reto!</button>') +
          '</div>' +
          '<p class="intro-note">' + icon('lock', 14) + ' Sin potenciadores · Tu primer intento te da +1 potenciador</p>' +
        '</div>' +
        '<div class="card streak-card">' +
          '<div class="streak-main">' + icon('flame', 40) + '<b>' + currentStreak() + '</b><span>' + (currentStreak() === 1 ? 'día de racha' : 'días de racha') + '</span></div>' +
          '<small>Mejor racha: ' + (d.daily.bestStreak | 0) + '</small>' +
          '<div class="week">' + weekStrip() + '</div>' +
        '</div>' +
        '<p class="countdown">Nuevo reto en <b class="js-count">' + fmtCountdown(msToMidnight()) + '</b></p>' +
        rankingCardHtml();
    }
    sec.innerHTML = '<div class="col sub-col daily-col">' + subbar('Reto Diario', 'calendar') + '<div class="sub-body">' + body + '</div></div>';
    if (!sec.dataset.wired) {
      sec.dataset.wired = '1';
      sec.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-act], [data-tab]');
        if (!t) return;
        if (t.hasAttribute('data-tab')) {
          rankTab = t.getAttribute('data-tab') === 'top' ? 'top' : 'daily';
          $$('.rank-tab', sec).forEach(function (b) { b.setAttribute('aria-selected', b === t ? 'true' : 'false'); });
          var body = $('.rank-body', sec);
          if (body) body.innerHTML = '<p class="rank-empty">Cargando…</p>';
          loadRanking(dailyInfo().key);
          return;
        }
        var act = t.getAttribute('data-act');
        if (act === 'back') show('map');
        else if (act === 'share') shareDailyResult(dailyInfo().key);
        else if (act === 'play') playDaily();
        else if (act === 'account') showAccount();
      });
    }
    stopDailyTimer();
    if (unlocked && info.ok) loadRanking(info.key);
    if (unlocked && info.ok) {
      var startKey = info.key;
      dailyTimer = setInterval(function () {
        if (current !== 'daily') { stopDailyTimer(); return; }
        if (keyOf(dateParts(0)) !== startKey) { renderDaily(); return; }
        var c = $('.js-count', sec);
        if (c) c.textContent = fmtCountdown(msToMidnight());
      }, 1000);
    }
  }
  renderers.daily = renderDaily;

  function weekStrip() {
    var d = data();
    var out = '';
    for (var i = -6; i <= 0; i++) {
      var p = dateParts(i);
      var r = d.daily.results[keyOf(p)];
      var cls = r ? (r.won ? 'w-won' : 'w-lost') : (i === 0 ? 'w-today' : 'w-none');
      out += '<span class="wday ' + cls + '"><small>' + DAYS_SHORT[p.wd] + '</small><i>' + (r ? (r.won ? icon('check', 16) : '✕') : '') + '</i></span>';
    }
    return out;
  }

  function playDaily() {
    var info = dailyInfo();
    if (!info.ok) { toast('Reto no disponible'); return; }
    var practice = !!data().daily.results[info.key];
    startLevel(info.level.id, { daily: true, practice: practice, dailyKey: info.key, dailyNum: info.num, seed: info.seed, level: info.level });
    if (practice) toast('Modo práctica: este intento no cuenta');
  }

  /* ===================================================================== */
  /*                                 ÁLBUM                                 */
  /* ===================================================================== */

  var DEFAULT_ALBUM = ['cocardo', 'lima', 'cereza', 'pina', 'banano', 'banana', 'fresa', 'durazna', 'uva', 'naranja',
    'limon', 'policia_fresa', 'policia_sandia', 'guardaespaldas', 'brocoli', 'reportera'];

  function albumEntries() {
    var a = story().album;
    if (a && a.length) return a;
    return DEFAULT_ALBUM.map(function (id) {
      return { id: id, name: nameOf(id), role: '', quote: '', unlock: VICTIMS.indexOf(id) >= 0 ? { type: 'rescue', who: id } : { type: 'start' } };
    });
  }
  // Estado de una carta: 'open' | 'frozen' | 'locked'
  //  - 'level': se conoce al superar ese nivel (antes, silueta)
  //  - víctimas: bloqueadas hasta ver su captura; luego congeladas hasta que se rescatan
  function cardState(e) {
    var d = data();
    var u = e.unlock || { type: 'start' };
    if (u.type === 'level') {
      var n = u.level | 0;
      var met = n <= 1 || (d.stars[n - 1] | 0) > 0 || d.unlocked > n;
      if (!met) return 'locked';
    }
    var who = u.type === 'rescue' ? (u.who || e.id) : e.id;
    if (u.type === 'rescue' || VICTIMS.indexOf(who) >= 0) {
      if (d.rescued.indexOf(who) >= 0) return 'open';
      // sin spoilers: antes de ver su captura la víctima sigue siendo una carta bloqueada («???»)
      return captureSeen(who) ? 'frozen' : 'locked';
    }
    return 'open';
  }

  function renderAlbum() {
    var sec = doc.getElementById('screen-album');
    var list = albumEntries();
    var openN = 0;
    var cards = list.map(function (e, i) {
      var st = cardState(e);
      if (st === 'open') openN++;
      var u = e.unlock || {};
      var face;
      var hint = '';
      if (st === 'open') face = portrait(e.id, VICTIMS.indexOf(e.id) >= 0 ? 'feliz' : 'normal');
      else if (st === 'frozen') {
        face = portrait(e.id, 'asustado', { frozen: true });
        var rl = rescueLevelOf(u.who || e.id);
        hint = rl ? '¡Congelada! Rescátala en el nivel ' + rl : '¡Congelada!';
      } else {
        face = portrait(e.id, 'normal', { silhouette: true });
        hint = u.level ? 'Se desbloquea en el nivel ' + u.level : 'Sigue la historia…';
      }
      return '<button class="acard acard-' + st + '" data-i="' + i + '" style="--i:' + i + '" aria-label="' + esc(st === 'locked' ? 'Carta bloqueada' : (e.name || nameOf(e.id))) + '">' +
        '<span class="acard-face">' + face + '</span>' +
        '<b class="acard-name">' + esc(st === 'locked' ? '???' : (e.name || nameOf(e.id))) + '</b>' +
        (st === 'open' ? '' : '<small class="acard-role">' + esc(hint) + '</small>') +
        '</button>';
    }).join('');
    sec.innerHTML = '<div class="col sub-col album-col">' + subbar('Álbum', 'album') +
      '<div class="sub-body"><p class="album-count"><b>' + openN + '</b>/' + list.length + ' cartas</p><div class="album-grid">' + cards + '</div></div></div>';
    if (!sec.dataset.wired) {
      sec.dataset.wired = '1';
      sec.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-act], [data-i]');
        if (!t) return;
        if (t.getAttribute('data-act') === 'back') { show('map'); return; }
        var e = albumEntries()[+t.getAttribute('data-i')];
        if (e) showCard(e);
      });
    }
  }
  renderers.album = renderAlbum;

  function showCard(e) {
    var st = cardState(e);
    if (st === 'locked') { play('invalid'); toast('Sigue jugando para conocer a este personaje'); return; }
    var frozen = st === 'frozen';
    var o = openOverlay('card',
      '<div class="card pop album-detail' + (frozen ? ' frozen' : '') + '">' +
        '<button class="close-btn" data-act="close" aria-label="Cerrar">' + icon('close', 22) + '</button>' +
        '<div class="ad-face">' + portrait(e.id, frozen ? 'asustado' : (e.id === 'cocardo' || e.id === 'cereza' ? 'burlon' : 'feliz'), frozen ? { frozen: true } : {}) + '</div>' +
        '<h2 class="ad-name">' + esc(e.name || nameOf(e.id)) + '</h2>' +
        '<p class="ad-role">' + esc(frozen ? '¡Está congelada! Rescátala para leer su ficha.' : (e.role || '')) + '</p>' +
        (!frozen && e.quote ? '<blockquote class="ad-quote">«' + esc(String(e.quote).replace(/^[«"]|[»"]$/g, '')) + '»</blockquote>' : '') +
        '<div class="btn-row"><button class="btn btn-pink" data-act="close" data-autofocus>Cerrar</button></div>' +
      '</div>',
    { label: e.name || nameOf(e.id), guard: true, onEsc: function () { closeOverlay('card'); } });
    o.addEventListener('click', function (ev) {
      if (ev.target === o || ev.target.closest('[data-act="close"]')) closeOverlay(o);
    });
  }

  /* ===================================================================== */
  /*                                AJUSTES                                */
  /* ===================================================================== */

  function toggleHtml(key, label, on, sub, iconName) {
    var icons = { sound: on ? 'sound' : 'mute', music: 'music', vibra: 'vibra', motion: 'snowflake', skipStory: 'next' };
    return '<button class="toggle" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-toggle="' + key + '">' +
      '<span class="t-icon">' + icon(iconName || icons[key] || 'check', 24) + '</span>' +
      '<span class="t-label">' + esc(label) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
      '<span class="switch" aria-hidden="true"><i></i></span></button>';
  }

  function flipToggle(btn) {
    var key = btn.getAttribute('data-toggle');
    var s = data().settings;
    var on;
    if (key === 'motion') {
      on = !reducedMotion();
      s.motion = on ? 'on' : 'off';
    } else {
      s[key] = !s[key];
      on = s[key];
    }
    persist();
    applySettings();
    if (key === 'sound' && on) {
      try { if (Cocardo.Audio) Cocardo.Audio.unlock(); } catch (e) { /* nada */ }
      play('tap');
    }
    if (key === 'vibra' && on) { try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { /* nada */ } }
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    if (key === 'clips') {
      if (on && current === 'game' && session && !session.ended) startClip();
      else if (!on) stopClip(true);
      track('clips_toggle', { on: on });
    }
    if (key === 'sound') { var ic = $('.t-icon', btn); if (ic) ic.innerHTML = icon(on ? 'sound' : 'mute', 24); }
    if (key === 'motion') { var sm = $('.t-label small', btn); if (sm) sm.textContent = 'Menos zooms y sacudidas'; }
  }

  var wipeArmed = 0;
  function renderSettings() {
    var sec = doc.getElementById('screen-settings');
    var s = data().settings;
    clearTimeout(wipeArmed);
    wipeArmed = 0;
    sec.innerHTML = '<div class="col sub-col settings-col">' + subbar('Ajustes', 'settings') +
      '<div class="sub-body">' +
        accountCardHtml() +
        '<div class="card settings-card">' +
          toggleHtml('sound', 'Sonido', s.sound, 'Efectos del juego') +
          toggleHtml('music', 'Música', s.music, 'Cumbia heladera') +
          toggleHtml('vibra', 'Vibración', s.vibra, 'En celulares compatibles') +
          toggleHtml('motion', 'Movimiento reducido', reducedMotion(), s.motion === 'auto' ? 'Automático (según tu sistema)' : 'Menos zooms y sacudidas') +
          toggleHtml('skipStory', 'Omitir historias', !!s.skipStory, 'Solo verás los «Continuará» y el final') +
          (clipsSupported() ? toggleHtml('clips', 'Grabar clips', !!s.clips, 'Video 9:16 de cada partida, listo para TikTok', 'video') : '') +
        '</div>' +
        '<div class="card settings-card danger-card">' +
          '<button class="btn btn-cherry wipe-btn" data-act="wipe">Borrar progreso</button>' +
          '<small>Se borran estrellas, rescates, potenciadores y rachas. No se puede deshacer.</small>' +
        '</div>' +
        '<footer class="disclaimer in-card">Juego de fans, no oficial. Inspirado en la frutinovela viral <i>La Nieve de Lima</i> (@frutitaenlatada).' +
        (Cocardo.Save.isForeign && Cocardo.Save.isForeign()
          ? '<br><b>Ojo:</b> hay un guardado de una versión más nueva del juego. Esta copia no lo toca: lo que juegues aquí no se guarda.'
          : (Cocardo.Save.isPersistent && !Cocardo.Save.isPersistent() ? '<br><b>Ojo:</b> este navegador no deja guardar; tu progreso dura hasta cerrar la página.' : '')) + '</footer>' +
      '</div></div>';
    if (!sec.dataset.wired) {
      sec.dataset.wired = '1';
      sec.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-act], [data-toggle]');
        if (!t) return;
        if (t.hasAttribute('data-toggle')) { flipToggle(t); return; }
        var act = t.getAttribute('data-act');
        if (act === 'back') show('map');
        else if (act === 'wipe') wipe(t);
        else if (act === 'google') doSignIn();
        else if (act === 'anon') doSignInAnon();
        else if (act === 'profile') showProfileEditor(false);
        else if (act === 'sync') doSync();
        else if (act === 'logout') doSignOut();
      });
    }
  }
  renderers.settings = renderSettings;

  function wipe(btn) {
    if (!wipeArmed) {
      btn.textContent = '¿Seguro? Toca otra vez';
      btn.classList.add('armed');
      wipeArmed = later(function () {
        wipeArmed = 0;
        if (btn.isConnected) { btn.textContent = 'Borrar progreso'; btn.classList.remove('armed'); }
      }, 3000);
      return;
    }
    clearTimeout(wipeArmed);
    wipeArmed = 0;
    var keep = JSON.parse(JSON.stringify(data().settings));
    Cocardo.Save.reset();
    data().settings = keep;
    persist();
    applySettings();
    btn.textContent = 'Borrar progreso';
    btn.classList.remove('armed');
    toast('Progreso borrado. ¡A empezar de nuevo!');
    play('shuffle');
  }

  /* ===================================================================== */
  /*                         TECLADO Y EVENTOS GLOBALES                     */
  /* ===================================================================== */

  function onKeyDown(ev) {
    var top = topOverlay();
    if (top) {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') top.keyAt = now();   // activación por teclado (guardClicks)
      if (top.onKey && top.onKey(ev)) { ev.preventDefault(); ev.stopPropagation(); return; }
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        ev.preventDefault();
        if (top.onEsc) top.onEsc();
        ev.stopPropagation();
        return;
      }
      if (ev.key === 'Tab') trapTab(ev, top.el);
      // mientras hay una capa abierta, el tablero no recibe teclas
      ev.stopPropagation();
      return;
    }
    if (current === 'title') {
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') { ev.preventDefault(); leaveTitle(); }
      return;
    }
    if (ev.key === 'Escape' || ev.key === 'Esc') {
      // en el tablero, Cocardo.Game decide (primero cancela un potenciador armado, luego llama a onPause)
      if (current === 'game') { if (!mounted) { showPause(); ev.preventDefault(); } }
      else if (current === 'daily' || current === 'album' || current === 'settings') { show('map'); ev.preventDefault(); }
    }
  }
  function trapTab(ev, root) {
    var f = $$('button, textarea, [tabindex="0"]', root).filter(function (n) { return !n.disabled && n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && doc.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && doc.activeElement === last) { ev.preventDefault(); first.focus(); }
    else if (!root.contains(doc.activeElement)) { ev.preventDefault(); first.focus(); }
  }

  // Sonido «tap» en los botones de la interfaz (no en los del tablero)
  function onClickSound(ev) {
    var b = ev.target.closest && ev.target.closest('button');
    if (!b || b.closest('#screen-game')) return;
    if (b.closest('.node-locked')) return;
    play('tap');
  }

  function unlockAudioOnce() {
    try { if (Cocardo.Audio) Cocardo.Audio.unlock(); } catch (e) { /* nada */ }
  }

  function onVisibility() {
    if (doc.hidden && current === 'game' && session && !session.ended && !stack.length) showPause();
  }

  var resizeRaf = 0;
  function onResize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(function () {
      resizeRaf = 0;
      // Cocardo.Game.resize() lo llama main.js
      if (current === 'map') drawRoad();
    });
  }

  var inited = false;
  function init() {
    if (inited) return;
    inited = true;
    window.addEventListener('keydown', onKeyDown, true);
    doc.addEventListener('click', onClickSound, true);
    doc.addEventListener('pointerdown', unlockAudioOnce, true);
    doc.addEventListener('keydown', unlockAudioOnce, true);
    doc.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    if (motionMQ) {
      var onMQ = function () { applyMotion(); };
      if (motionMQ.addEventListener) motionMQ.addEventListener('change', onMQ);
      else if (motionMQ.addListener) motionMQ.addListener(onMQ);
    }
    // el menú contextual estorba en pantallas táctiles
    doc.addEventListener('contextmenu', function (ev) {
      if (!ev.target.closest || !ev.target.closest('textarea, input')) ev.preventDefault();
    });
    var fl = doc.getElementById('flash');
    if (fl) fl.addEventListener('animationend', function () { fl.className = 'flash'; });
    var c = cloud();
    if (c && c.onChange) c.onChange(onCloudChange);
    readQuery();
  }

  /* ---------- ganchos de depuración (ARQUITECTURA §12) ---------- */

  function cellCenter(r, c) {
    var gm = game();
    if (gm && typeof gm._cellCenter === 'function') {
      var p0 = gm._cellCenter(r, c);
      if (p0) return { x: p0.x, y: p0.y, el: doc.elementFromPoint(p0.x, p0.y) || $('#screen-game canvas') };
    }
    var g = doc.getElementById('screen-game');
    var cv = $$('canvas', g).sort(function (a, b) {
      return b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight;
    })[0];
    var st = gameCall('_state');
    if (!cv || !st) return null;
    var rc = cv.getBoundingClientRect();
    return { x: rc.left + (c + 0.5) * rc.width / st.cols, y: rc.top + (r + 0.5) * rc.height / st.rows, el: cv };
  }
  function pointer(type, p, target) {
    var init2 = { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 };
    var ev;
    try { ev = new PointerEvent(type, init2); } catch (e) { ev = new MouseEvent(type, init2); }
    target.dispatchEvent(ev);
  }

  function makeDebug() {
    return {
      unlockAll: function () {
        var d = data();
        d.unlocked = levelCount();
        unlockBoostersFor(99);
        persist();
        if (current === 'map') renderMap();
        return true;
      },
      go: function (id, opts) {
        id = id | 0;
        if (!getLevel(id)) return false;
        var d = data();
        d.unlocked = Math.max(d.unlocked, id);
        persist();
        closeAllOverlays();
        if (opts && opts.intro) { show('map'); openLevel(id, { force: true }); return true; }
        return startLevel(id, { seed: opts && opts.seed });
      },
      // Fin forzado: usa Cocardo.Game._debugEnd si existe (resultado real); stars/near fuerzan valores
      win: function (stars) {
        if (!session || session.ended) return false;
        if (stars != null) debugOverride = { stars: clamp(stars | 0, 1, 3) };
        var g = game();
        if (g && typeof g._debugEnd === 'function' && g._debugEnd(true)) return true;
        var st = gameCall('_state') || {};
        gameCall('pause');
        var mt = st.movesTotal || (session.level && session.level.moves) || 20;
        onEnd({
          won: true, stars: 3, score: st.score || 3000, movesLeft: st.movesLeft || 0, movesUsed: mt - (st.movesLeft || 0),
          movesTotal: mt, levelId: session.levelId, daily: session.daily, turns: [], maxCascade: 1,
          rescued: (session.level && session.level.rescue) ? session.level.rescue.slice() : [], nearMiss: null,
        });
        return true;
      },
      lose: function (near) {
        if (!session || session.ended) return false;
        if (near) {
          var g0 = session.level && session.level.goals && session.level.goals[0];
          debugOverride = { nearMiss: { remaining: near === true ? 2 : near | 0, icon: g0 ? (g0.color || g0.type) : 'L' } };
        }
        var g = game();
        if (g && typeof g._debugEnd === 'function' && g._debugEnd(false)) return true;
        var st = gameCall('_state') || {};
        gameCall('pause');
        var mt = st.movesTotal || (session.level && session.level.moves) || 20;
        onEnd({
          won: false, stars: 0, score: st.score || 0, movesLeft: 0, movesUsed: mt, movesTotal: mt,
          levelId: session.levelId, daily: session.daily, turns: [], maxCascade: 1, rescued: [], nearMiss: null,
        });
        return true;
      },
      state: function () { return gameCall('_state') || null; },
      busy: function () { return !!gameCall('_busy'); },
      swap: function (a, b) {
        var g = game();
        if (g && typeof g._swap === 'function') return g._swap(a, b);   // Promise<boolean> al terminar la animación
        var pa = cellCenter(a.r, a.c), pb = cellCenter(b.r, b.c);
        if (!pa || !pb) return false;
        pointer('pointerdown', pa, pa.el);
        pointer('pointermove', { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }, pa.el);
        pointer('pointermove', pb, pa.el);
        pointer('pointerup', pb, pa.el);
        return true;
      },
      screen: function () { var t = topOverlay(); return t ? t.name : current; },
      // hoja de ruta: today(20261030) simula esa fecha local (null = hoy de verdad); roadmap() da los capítulos con estado
      today: function (key) { Cocardo.debugToday = key || null; if (current === 'map') renderMap(); return todayKey(); },
      roadmap: chapterStates,
      openCount: openCount,
      showRoadmap: showRoadmap,
      overlays: function () { return stack.map(function (e) { return e.name; }); },
      save: function () { return data(); },
      daily: function () { var i = dailyInfo(); return { key: i.key, num: i.num, levelId: i.level && i.level.id }; },
      show: show,
      cellCenter: cellCenter,
    };
  }

  /* ---------- API pública ---------- */

  Cocardo.UI = {
    init: init,
    show: show,
    current: function () { return current; },
    applySettings: applySettings,
    reducedMotion: reducedMotion,
    openLevel: openLevel,
    startLevel: startLevel,
    playStory: playStory,
    share: share,
    toast: toast,
    makeDebug: makeDebug,
    _session: function () { return session; },
    _shareImage: buildShareImage,
    _recordCampaignWin: recordCampaignWin,
    showAccount: showAccount,
    showProfileEditor: showProfileEditor,
    showRoadmap: showRoadmap,
  };
})();
