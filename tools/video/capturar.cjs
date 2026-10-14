#!/usr/bin/env node
// Captura una "toma" del juego real, fotograma a fotograma, para editarla después (tools/video/montaje.html).
// Uso: node tools/video/capturar.cjs <toma.cjs> <carpeta> [--fps 60] [--var <variante>]
//
// Determinismo: reloj falso de Playwright (timers, requestAnimationFrame, performance.now), animaciones CSS
// pausadas y movidas a mano con la Web Animations API, Math.random con semilla y guardado precargado.
// Salida: <carpeta>/f00000.jpg… (1080x1920) y <carpeta>/toma.json con los sonidos que pidió el juego
// (Cocardo.Audio.play), las marcas de la toma y el recorrido del dedo, todo en segundos desde el fotograma 0.
//
// Una toma es un módulo: module.exports = { semilla, guardado(save) {…}, async correr(T) {…} }
// T.pausar() antes del primer fotograma deja correr el juego sin guardar nada (preparar una partida); T.ritmo(fps)
// cambia los fotogramas por segundo a mitad de toma (pocos en lo que se va a ver acelerado, 60 en cámara lenta).
// toma.json guarda el segundo exacto de cada fotograma (tiempos).
'use strict';
const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  for (const p of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright']) {
    if (!p) continue;
    try { return require(p); } catch (e) { /* siguiente */ }
  }
  throw new Error('No se encontró playwright (define PLAYWRIGHT_MODULE)');
}

const ROOT = path.resolve(__dirname, '..', '..');
const VIEW = { width: 540, height: 960, dpr: 2 };

// Guardado base: todo desbloqueado, tutoriales e historias vistas, sin música del juego (la pone el montaje)
function guardadoBase() {
  const seen = {};
  for (let i = 1; i <= 30; i++) seen['teach' + i] = true;
  return {
    v: 1, unlocked: 30, stars: Array(30).fill(3), best: Array(30).fill(0),
    boosters: { cucharon: 3, chorro: 3, batido: 3 }, boostersUnlocked: { cucharon: true, chorro: true, batido: true },
    rescued: [], seen, daily: { last: 0, streak: 0, bestStreak: 0, results: {} },
    settings: { sound: true, vibra: false, motion: 'off', music: false, skipStory: false },   // motion 'off' = efectos completos
  };
}

function initScript(cfg) {
  // Se ejecuta en la página antes que el juego
  let s = cfg.semilla >>> 0;
  Math.random = function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try { if (cfg.save && !sessionStorage.getItem('__cocardoVideo')) { localStorage.setItem('cocardo.v1', cfg.save); sessionStorage.setItem('__cocardoVideo', '1'); } } catch (e) { /* nada */ }
  const rec = (window.__rec = { sounds: [], music: [] });
  // Engancha Cocardo.Audio en cuanto audio.js lo define: se anota cada sonido y no suena nada en vivo
  const C = (window.Cocardo = window.Cocardo || {});
  C.debugEnabled = true;
  let real;
  Object.defineProperty(C, 'Audio', {
    configurable: true, enumerable: true,
    get() { return real; },
    set(v) {
      real = v;
      if (!v || v.__grabado) return;
      v.__grabado = true;
      v.play = function (name, opts) {
        let o = {};
        try { o = opts ? JSON.parse(JSON.stringify(opts)) : {}; } catch (e) { o = {}; }
        rec.sounds.push({ t: performance.now(), name: name, opts: o });
      };
      const setMusic = v.setMusic;
      v.setMusic = function (b) { rec.music.push({ t: performance.now(), on: !!b }); try { setMusic.call(v, false); } catch (e) { /* nada */ } };
    },
  });
  // Solo en video: el destello blanco del juego (Bombas, Copas, combos) se suaviza. Al acelerar o ralentizar se encadenan
  // varios y lavan la imagen; además los destellos fuertes disparan avisos de fotosensibilidad en TikTok.
  document.addEventListener('DOMContentLoaded', function () {
    const st = document.createElement('style');
    st.textContent = '#flash.flash-white.flash-on,#flash.flash-ice.flash-on{animation-name:__flashVideo!important;animation-duration:.38s!important}' +
      '@keyframes __flashVideo{0%{opacity:.5}100%{opacity:0}}';
    document.head.appendChild(st);
  });
  // Animaciones CSS al compás del reloj falso
  window.__stepAnims = function () {
    const now = performance.now();
    let list = [];
    try { list = document.getAnimations(); } catch (e) { return 0; }
    for (const a of list) {
      if (a.__t0 === undefined) {
        a.__t0 = now;
        try { a.pause(); } catch (e) { /* nada */ }
      }
      const ct = now - a.__t0;
      let end = Infinity;
      try { end = a.effect ? a.effect.getComputedTiming().endTime : Infinity; } catch (e) { end = Infinity; }
      if (isFinite(end) && ct >= end) {
        if (a.playState !== 'finished') { try { a.finish(); } catch (e) { /* nada */ } }
      } else {
        try { a.currentTime = ct; } catch (e) { /* nada */ }
      }
    }
    return list.length;
  };
}

class Toma {
  constructor(page, cdp, out, fps) {
    this.page = page; this.cdp = cdp; this.out = out; this.fps = fps;
    this.n = 0;            // fotogramas guardados
    this.tick = 0;         // pasos de reloj dados (para repartir los ms)
    this.grabando = true;
    this.ms = 0;           // ms de juego desde el fotograma 0
    this.empezo = false;
    this.tiempos = [];
    this.marcas = []; this.dedo = [];
    this.cortes = [];      // tramos sin grabar (el reloj avanzó pero no hay fotogramas)
  }
  get t() { return this.ms / 1000; }
  ritmo(fps) { this.fps = fps; this.tick = 0; }
  async ev(fn, arg) { return this.page.evaluate(fn, arg); }
  async paso() {
    // ms enteros que promedian 1000/fps
    const a = Math.round((this.tick + 1) * 1000 / this.fps) - Math.round(this.tick * 1000 / this.fps);
    this.tick++;
    await this.page.clock.runFor(a);
    await this.page.evaluate(() => window.__stepAnims());
    if (this.empezo) this.ms += a;
    if (!this.grabando) return;
    if (!this.empezo) { this.empezo = true; this.t0 = await this.page.evaluate(() => performance.now()); }
    this.tiempos.push(+(this.ms / 1000).toFixed(4));
    // superficie a densidad 2 (ver lanzamiento): fotogramas de 1080x1920 nítidos
    const r = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    fs.writeFileSync(path.join(this.out, 'f' + String(this.n).padStart(5, '0') + '.jpg'), Buffer.from(r.data, 'base64'));
    this.n++;
    if (this.n % 120 === 0) process.stdout.write(`\r  ${this.n} fotogramas (${this.t.toFixed(1)} s)`);
  }
  async esperar(seg) { const k = Math.round(seg * this.fps); for (let i = 0; i < k; i++) await this.paso(); }
  async hasta(fn, maxSeg, arg) {
    const k = Math.round((maxSeg || 20) * this.fps);
    for (let i = 0; i < k; i++) {
      if (await this.page.evaluate(fn, arg)) return true;
      await this.paso();
    }
    return false;
  }
  marca(nombre, datos) { this.marcas.push({ t: this.t, nombre, datos: datos || null }); }
  async pausar() {
    if (this.empezo) throw new Error('pausar() solo antes del primer fotograma: el audio y los fotogramas van en un solo tiempo');
    this.grabando = false;
  }
  async seguir() { this.grabando = true; }
  async fin(maxSeg) { return this.hasta(() => ['victory', 'defeat'].includes(Cocardo.debug.screen()), maxSeg || 40); }

  // Tablero
  async jugable() {
    return this.hasta(() => { const G = Cocardo.Game; return Cocardo.debug.screen() === 'game' && G._phase() === 'play' && !G._busy(); }, 25);
  }
  async quieto(maxSeg) {
    return this.hasta(() => { const G = Cocardo.Game, st = G._state(); return !G._busy() || !st || st.status !== 'playing'; }, maxSeg || 25);
  }
  async ir(nivel, semilla) {
    await this.ev(([n, s]) => Cocardo.debug.go(n, { seed: s }), [nivel, semilla]);
    const ok = await this.jugable();
    this.tablero = await this.ev(() => {
      const st = Cocardo.Game._state(), a = Cocardo.Game._cellCenter(0, 0), b = Cocardo.Game._cellCenter(st.rows - 1, st.cols - 1);
      return { filas: st.rows, cols: st.cols, x0: a.x, y0: a.y, x1: b.x, y1: b.y };
    });
    return ok;
  }
  async celda(r, c) { return this.ev(([r, c]) => Cocardo.Game._cellCenter(r, c), [r, c]); }
  async toque(tipo, x, y) {
    const tp = tipo === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
    await this.cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: tp });
    this.dedo.push({ t: this.t, x: x * VIEW.dpr, y: y * VIEW.dpr, abajo: tipo !== 'touchEnd' });
  }
  // Deslizar de la celda a a la b como un dedo de verdad: se apoya, arrastra y suelta
  async deslizar(a, b, o) {
    o = o || {};
    const pa = await this.celda(a.r, a.c), pb = await this.celda(b.r, b.c);
    const antes = o.antes == null ? 0.12 : o.antes, dur = o.dur || 0.16;
    this.dedo.push({ t: this.t, x: pa.x * VIEW.dpr, y: pa.y * VIEW.dpr, abajo: false, llega: true });
    await this.esperar(antes);
    await this.toque('touchStart', pa.x, pa.y);
    const k = Math.max(2, Math.round(dur * this.fps));
    for (let i = 1; i <= k; i++) {
      const e = i / k, f = e * e * (3 - 2 * e);
      await this.toque('touchMove', pa.x + (pb.x - pa.x) * f, pa.y + (pb.y - pa.y) * f);
      await this.paso();
    }
    await this.toque('touchEnd', pb.x, pb.y);
    this.marca('jugada', { a, b });
  }
  async tocarXY(x, y) {
    await this.toque('touchStart', x, y); await this.paso(); await this.toque('touchEnd', x, y);
  }
  async tocarCelda(r, c) { const p = await this.celda(r, c); return this.tocarXY(p.x, p.y); }
  async tocar(sel) {
    const p = await this.ev((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    if (!p) throw new Error('no encontré ' + sel);
    return this.tocarXY(p.x, p.y);
  }
  async jugar(a, b, o) { await this.deslizar(a, b, o); await this.paso(); return this.quieto(); }
  // Juega una escena de historia del juego a ritmo de lectura (30 letras/s + pausa) y anota cada línea
  async historia(clave, o) {
    o = o || {};
    const lineas = await this.ev((k) => (Cocardo.Story.scripts[k] || []).map((l) => ({ who: l.who || null, text: l.text || '', sfx: l.sfx || null, card: l.card || null })), clave);
    await this.ev((k) => { window.__hist = 'run'; Cocardo.UI.playStory(k, () => { window.__hist = 'fin'; }, {}); }, clave);
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      this.marca('linea', { clave, i, who: l.who, text: l.text, sfx: l.sfx, card: l.card });
      if (o.hasta != null && i > o.hasta) break;
      if (l.sfx) { await this.esperar(1.25); continue; }
      const extra = (o.pausas && o.pausas[i]) || 0;
      await this.esperar((l.card ? (o.carta || 2.6) : l.text.length / 30 + (o.lectura || 1.15)) + extra);
      if (o.hasta != null && i === o.hasta) break;
      await this.ev(() => { const e = document.querySelector('.overlay-story'); if (e) e.click(); });
    }
    this.marca('historia-fin', { clave });
  }
  // jugadas del bot (tools/video/plan.cjs) con la misma semilla que el juego
  async jugadas(lista, desde, hasta, o) {
    for (let i = desde; i < hasta && i < lista.length; i++) {
      if (o && o.ritmos && o.ritmos[i]) this.ritmo(o.ritmos[i]);
      if (o && o.alGrabar === i) await this.seguir();
      await this.jugar(lista[i].a, lista[i].b, { antes: (o && o.antes) || 0.25 });
      this.marca('turno', { i, ...lista[i] });
      await this.esperar((o && o.entre) || 0.15);
    }
  }
}

(async () => {
  const argv = process.argv.slice(2);
  const [tomaFile, out] = argv;
  if (!tomaFile || !out) { console.error('uso: node tools/video/capturar.cjs <toma.cjs> <carpeta> [--fps 60]'); process.exit(2); }
  const iF = argv.indexOf('--fps');
  const fps = iF > 0 ? +argv[iF + 1] : 60;
  const toma = require(path.resolve(tomaFile));
  const iV = argv.indexOf('--var');
  const variante = iV > 0 ? argv[iV + 1] : null;
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (/^f\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(out, f));

  const save = guardadoBase();
  if (toma.guardado) toma.guardado(save, variante);
  const { chromium } = loadPlaywright();
  // sin --force-device-scale-factor la captura de CDP sale en píxeles CSS (540x960)
  const browser = await chromium.launch({ args: ['--force-device-scale-factor=' + VIEW.dpr] });
  const ctx = await browser.newContext({ viewport: { width: VIEW.width, height: VIEW.height }, deviceScaleFactor: VIEW.dpr,
    isMobile: true, hasTouch: true, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.addInitScript(initScript, { semilla: (typeof toma.semilla === 'function' ? toma.semilla(variante) : toma.semilla) || 12345, save: JSON.stringify(save) });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.dpr, mobile: true });
  await page.clock.install({ time: new Date('2026-10-15T19:00:00-06:00') });
  await page.goto('file://' + path.join(ROOT, 'index.html') + '#debug');
  await page.waitForFunction(() => window.Cocardo && Cocardo.debug && Cocardo.UI && document.fonts && document.fonts.status === 'loaded', null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(new Date('2026-10-15T19:00:10-06:00'));
  const T = new Toma(page, cdp, out, fps);
  const t0 = Date.now();
  await toma.correr(T, variante);
  const rec = await page.evaluate(() => window.__rec);
  const base = T.t0 || 0;
  const log = {
    fps, fotogramas: T.n, duracion: T.t, tiempos: T.tiempos, ancho: VIEW.width * VIEW.dpr, alto: VIEW.height * VIEW.dpr,
    sonidos: rec.sounds.map((s) => ({ t: +((s.t - base) / 1000).toFixed(4), name: s.name, opts: s.opts })).filter((s) => s.t >= -0.05 && s.t <= T.t + 0.05),
    musica: rec.music.map((m) => ({ t: (m.t - base) / 1000, on: m.on })),
    marcas: T.marcas, dedo: T.dedo, errores,
    // centro de cada celda en píxeles de la toma: x = x0 + c·paso, y = y0 + r·paso
    tablero: T.tablero ? { filas: T.tablero.filas, cols: T.tablero.cols, x0: T.tablero.x0 * VIEW.dpr, y0: T.tablero.y0 * VIEW.dpr,
      paso: (T.tablero.x1 - T.tablero.x0) / Math.max(1, T.tablero.cols - 1) * VIEW.dpr } : null,
  };
  fs.writeFileSync(path.join(out, 'toma.json'), JSON.stringify(log, null, 1));
  await browser.close();
  console.log(`\r${path.basename(tomaFile)} → ${out}: ${T.n} fotogramas (${T.t.toFixed(1)} s) en ${((Date.now() - t0) / 1000).toFixed(0)} s, ${log.sonidos.length} sonidos${errores.length ? ', ' + errores.length + ' errores' : ''}`);
  if (errores.length) console.error(errores.slice(0, 5).join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
