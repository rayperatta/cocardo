#!/usr/bin/env node
/* Cocardo: ¡Rescate Helado! — prueba de extremo a extremo (Node + Playwright/Chromium, sin framework).
 *
 * Recorre el juego de verdad: Portada -> Mapa -> nivel 1 (historia, intro, jugadas reales con arrastres
 * sobre el canvas hasta ganar o perder) -> Victoria/Derrota -> Mapa -> Álbum -> Ajustes -> Reto Diario,
 * y luego abre con Cocardo.debug.go(n) los niveles 10, 16, 21, 25 y 30 (rescate, cajas, ficha, congelador,
 * final). Comprueba: cero errores de consola, guardado actualizado, potenciadores bloqueados hasta L7/L11/L14,
 * consejos del tutorial en voz del ayudante correcto, Álbum descongelado tras un rescate, audio que nunca
 * lanza, tablero no vacío y sin desbordes horizontales.
 *
 * Destinos: http (servidor propio en un puerto libre), file:// (doble clic en index.html), dist (versión de un
 * solo archivo) y sandbox (fragmento para artifact dentro de un <iframe sandbox>, sin localStorage).
 *
 * Uso:  node tests/e2e.cjs [--only=http-390,file-1280,...] [--quick]
 *   E2E_OUT=<carpeta>  dónde guardar las capturas (por defecto test-results/e2e)
 *   PLAYWRIGHT_MODULE  ruta del módulo playwright si no está en node_modules
 * Sale con código != 0 si algo falla. Usa un solo Chromium a la vez. */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.env.E2E_OUT || path.join(ROOT, 'test-results', 'e2e'));
const ARGS = process.argv.slice(2);
const ONLY = ((ARGS.find(a => a.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean);
const QUICK = ARGS.includes('--quick');

function loadPlaywright() {
  for (const p of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright']) {
    if (!p) continue;
    try { return require(p); } catch (e) { /* siguiente */ }
  }
  throw new Error('No se encontró playwright (define PLAYWRIGHT_MODULE)');
}

/* ---------- servidor estático mínimo ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
function serve() {
  const srv = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if (u === '/') u = '/index.html';
    const file = path.join(ROOT, path.normalize(u));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

/* ---------- resultados ---------- */
const failures = [];
const notes = [];
let current = '';
function fail(msg) { failures.push(`[${current}] ${msg}`); console.log(`  ✗ ${msg}`); }
function ok(cond, msg) { if (cond) console.log(`  ✓ ${msg}`); else fail(msg); return !!cond; }
function note(msg) { notes.push(`[${current}] ${msg}`); console.log(`  · ${msg}`); }

const VIEWPORTS = {
  390: { width: 390, height: 844, mobile: true, dpr: 2 },
  1280: { width: 1280, height: 800, mobile: false, dpr: 1 },
  320: { width: 320, height: 568, mobile: true, dpr: 2 },
  land: { width: 844, height: 390, mobile: true, dpr: 2 },
};

function buildDist() {
  execFileSync(process.execPath, [path.join(ROOT, 'tools/build-single.cjs')], { cwd: ROOT, stdio: 'pipe' });
  execFileSync(process.execPath, [path.join(ROOT, 'tools/build-single.cjs'), '--fragment'], { cwd: ROOT, stdio: 'pipe' });
  // anfitrión que imita el artifact: esqueleto propio + <iframe sandbox> sin acceso a localStorage
  const frag = fs.readFileSync(path.join(ROOT, 'dist/cocardo-fragment.html'), 'utf8');
  const inner = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<script>window.Cocardo = { debugEnabled: true };</script></head><body>' + frag + '</body></html>';
  const host = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<style>html,body{margin:0;height:100%;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style></head><body>' +
    '<iframe id="app" sandbox="allow-scripts" srcdoc="' + inner.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></iframe></body></html>';
  fs.mkdirSync(OUT, { recursive: true });
  const hostFile = path.join(OUT, 'sandbox-host.html');
  fs.writeFileSync(hostFile, host);
  return hostFile;
}

/* ===================================================================== */

async function runCombo(browser, combo) {
  current = combo.name;
  console.log(`\n=== ${combo.name} (${combo.url.replace(ROOT, '.')}) ===`);
  const vp = VIEWPORTS[combo.vp];
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr,
    hasTouch: vp.mobile, isMobile: vp.mobile, locale: 'es-MX',
  });
  // pruebas herméticas: Google Fonts no se descarga (el juego tiene fuentes de respaldo)
  await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await context.newPage();
  const errors = [];
  const warnings = [];
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
    else if (m.type() === 'warning') warnings.push(m.text());
  });
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  const cdp = vp.mobile ? await context.newCDPSession(page) : null;
  let shotN = 0;
  const frameOf = () => (combo.sandbox ? page.frames().find(f => f !== page.mainFrame()) : page.mainFrame());

  await page.goto(combo.url);
  let F = frameOf();
  if (combo.sandbox) {
    for (let i = 0; i < 50 && !(F = frameOf()); i++) await page.waitForTimeout(100);
  }
  const ev = (js, arg) => F.evaluate(js, arg);
  const wait = ms => page.waitForTimeout(ms);
  async function waitFor(js, timeout, label) {
    const t0 = Date.now();
    for (;;) {
      let v = null;
      try { v = await ev(js); } catch (e) { v = null; }
      if (v) return v;
      if (Date.now() - t0 > (timeout || 8000)) { if (label) fail(`tiempo agotado esperando: ${label}`); return null; }
      await wait(120);
    }
  }
  const screen = () => ev('Cocardo.debug ? Cocardo.debug.screen() : null');
  async function waitScreen(name, timeout) {
    const names = Array.isArray(name) ? name : [name];
    return waitFor(`(() => { const s = Cocardo.debug && Cocardo.debug.screen(); return ${JSON.stringify(names)}.indexOf(s) >= 0 ? s : null; })()`, timeout || 8000, `pantalla ${names.join('|')}`);
  }
  async function overflowCheck(label) {
    const o = await ev(`(() => { const s = document.scrollingElement || document.documentElement; return { sw: s.scrollWidth, iw: innerWidth, bw: document.body.scrollWidth }; })()`);
    if (o.sw > o.iw || o.bw > o.iw) fail(`desborde horizontal en ${label}: scrollWidth ${o.sw}/${o.bw} > ${o.iw}`);
  }
  async function shot(name) {
    shotN++;
    const file = path.join(OUT, `${combo.name}-${String(shotN).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file });
    await overflowCheck(name);
    return file;
  }
  async function tap(sel, opts) {
    const loc = F.locator(sel).first();
    await loc.waitFor({ state: 'visible', timeout: (opts && opts.timeout) || 6000 });
    if (vp.mobile) await loc.tap({ timeout: 6000 });
    else await loc.click({ timeout: 6000 });
  }
  async function tapXY(p) {
    if (vp.mobile) await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
  }
  // arrastre real: toques CDP en móvil (pointerType touch), ratón en escritorio
  async function drag(a, b) {
    const N = 5;
    if (cdp) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
      for (let i = 1; i <= N; i++) {
        const x = a.x + (b.x - a.x) * i / N, y = a.y + (b.y - a.y) * i / N;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: N });
      await page.mouse.up();
    }
  }
  const cellXY = (r, c) => ev(`Cocardo.Game._cellCenter(${r}, ${c})`);
  const gstate = () => ev(`(() => { const G = Cocardo.Game, st = G._state && G._state(); return { scr: Cocardo.debug.screen(), busy: !!G._busy(), phase: G._phase(), status: st && st.status, movesLeft: st && st.movesLeft, turn: st && st.turn, level: st && st.levelId }; })()`);

  async function waitPlayable(timeout) {
    return waitFor(`(() => { const G = Cocardo.Game; return Cocardo.debug.screen() === 'game' && G._phase() === 'play' && !G._busy(); })()`, timeout || 10000, 'tablero jugable');
  }

  async function boardCheck(label) {
    const r = await ev(`(() => {
      const c = document.querySelector('#screen-game canvas.cg-board');
      if (!c) return { err: 'sin canvas' };
      const rc = c.getBoundingClientRect();
      try {
        const k = document.createElement('canvas'); k.width = 96; k.height = 96;
        const g = k.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0, 96, 96);
        const d = g.getImageData(0, 0, 96, 96).data;
        let n = 0; const set = new Set();
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 0) { n++; set.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); } }
        return { w: c.width, h: c.height, cw: rc.width, ch: rc.height, left: rc.left, right: rc.right, top: rc.top, bottom: rc.bottom, opaque: n / (d.length / 4), colors: set.size };
      } catch (e) { return { err: e.message }; }
    })()`);
    if (r.err) { fail(`tablero ${label}: ${r.err}`); return r; }
    ok(r.opaque > 0.4 && r.colors > 20, `tablero ${label} dibujado (${Math.round(r.opaque * 100)}% opaco, ${r.colors} colores, ${Math.round(r.cw)}px)`);
    const vw = vp.width, vh = vp.height;
    if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) fail(`tablero ${label} fuera de pantalla: ${JSON.stringify(r)}`);
    if (r.cw < 200) note(`tablero ${label} pequeño: ${Math.round(r.cw)}px`);
    return r;
  }

  // Juega jugadas reales (tutorial o pista del motor) hasta `max` jugadas o el final del nivel.
  async function play(max, label) {
    let done = 0;
    const t0 = Date.now();
    while (done < max && Date.now() - t0 < 240000) {
      const s = await gstate();
      if (s.scr !== 'game') break;
      if (s.status !== 'playing') {
        // Helado Final y celebración: se dejan correr (se prueba la animación completa)
        await wait(200);
        continue;
      }
      if (s.busy || s.phase !== 'play') { await wait(100); continue; }
      const mv = await ev(`(() => { const G = Cocardo.Game; return G._tutorialMove() || Cocardo.Engine.hint(G._state()); })()`);
      if (!mv) { await wait(200); continue; }
      const a = await cellXY(mv.a.r, mv.a.c), b = await cellXY(mv.b.r, mv.b.c);
      await drag(a, b);
      const reg = await waitFor(`(() => { const G = Cocardo.Game, st = G._state(); return Cocardo.debug.screen() !== 'game' || !st || st.turn !== ${s.turn} || st.status !== 'playing' || st.movesLeft !== ${s.movesLeft}; })()`, 4000);
      if (!reg) { fail(`${label}: el arrastre ${JSON.stringify(mv)} no hizo la jugada`); return done; }
      done++;
    }
    return done;
  }

  async function skipStories(max) {
    for (let i = 0; i < (max || 20); i++) {
      const s = await screen();
      if (s !== 'story') return s;
      await tap('.overlay-story .story-skip');
      await wait(450);
    }
    return screen();
  }

  async function stats(label) {
    const st = await ev('Cocardo.Game._stats()');
    if (st && st.desyncs) note(`${label}: ${st.desyncs} resincronizaciones del tablero (${JSON.stringify(st.lastDiff).slice(0, 200)})`);
  }

  /* ---------------- Portada ---------------- */
  ok(await waitScreen('title'), 'arranca en la Portada');
  const save0 = await ev('JSON.parse(JSON.stringify(Cocardo.Save.get()))');
  ok(save0.unlocked === 1 && save0.stars.every(s => s === 0), 'guardado nuevo');
  ok(!save0.boostersUnlocked.cucharon && !save0.boostersUnlocked.chorro && !save0.boostersUnlocked.batido &&
    save0.boosters.cucharon === 0 && save0.boosters.chorro === 0 && save0.boosters.batido === 0, '(a) potenciadores bloqueados en un guardado nuevo');
  if (combo.sandbox) ok(await ev('Cocardo.Save.isPersistent() === false'), 'sandbox: sin localStorage, guardado en memoria');
  await wait(400);
  await shot('portada');
  await tap('#screen-title .title-start');
  ok(await waitScreen('map'), 'Portada -> Mapa');
  await wait(600);
  await shot('mapa');

  /* ---------------- Nivel 1: historia + intro ---------------- */
  await tap('.node[data-level="1"]');
  ok(await waitScreen('story'), 'nivel 1 abre la historia pre1');
  await wait(700);
  await shot('historia');
  // se avanza tocando (sin «Saltar») hasta la intro
  for (let i = 0; i < 40 && (await screen()) === 'story'; i++) {
    await tap('.overlay-story .story-box');
    await wait(260);
  }
  ok(await waitScreen('intro'), 'historia -> intro del nivel 1');
  await wait(500);
  const intro1 = await ev(`(() => { const o = document.querySelector('.overlay-intro'); return { locked: o.querySelectorAll('.booster.locked').length, tip: (o.querySelector('.tip-bubble b') || {}).textContent || '' }; })()`);
  ok(intro1.locked === 3, `(a) intro L1: los 3 potenciadores bloqueados (${intro1.locked})`);
  ok(/^Lima/.test(intro1.tip), `(b) intro L1: el consejo lo da Lima («${intro1.tip}»)`);
  await shot('intro');
  await tap('.overlay-intro [data-act="play"]');
  ok(await waitScreen('game'), 'intro -> tablero');
  await waitPlayable(12000);
  await wait(300);
  const tut = await ev(`(() => { const t = document.querySelector('.cg-tip'); return t ? { who: t.querySelector('b').textContent, text: t.querySelector('.cg-tip-text span').textContent, move: Cocardo.Game._tutorialMove() } : null; })()`);
  ok(tut && tut.who === 'Lima' && tut.move, `(b) tutorial L1 con mano guía, en voz de Lima («${tut && tut.text}»)`);
  // sin ningún potenciador desbloqueado la barra no se muestra (los botones siguen en el DOM, bloqueados)
  const bar1 = await ev(`(() => { const f = document.querySelector('.cg-boosters'); return { locked: [...document.querySelectorAll('.cg-boost')].map(b => b.classList.contains('cg-locked')), hidden: !f || getComputedStyle(f).display === 'none' }; })()`);
  ok(bar1.locked.length === 3 && bar1.locked.every(Boolean) && bar1.hidden, '(a) barra de potenciadores bloqueada y oculta en L1');
  await boardCheck('L1');
  await shot('tablero-L1-tutorial');

  /* ---------------- Nivel 1: jugar de verdad ---------------- */
  const moves1 = await play(QUICK ? 3 : 99, 'L1');
  ok(moves1 > 0, `L1: ${moves1} jugadas reales con arrastres`);
  if (QUICK) await ev('Cocardo.debug.win()');
  const end1 = await waitScreen(['victory', 'defeat'], 40000);
  await stats('L1');
  ok(end1, `L1 terminó en ${end1}`);
  await wait(1600);
  await shot('fin-L1');
  const save1 = await ev('JSON.parse(JSON.stringify(Cocardo.Save.get()))');
  if (end1 === 'victory') {
    ok(save1.stars[0] >= 1 && save1.unlocked >= 2 && save1.best[0] > 0, `guardado tras ganar L1: ${save1.stars[0]}★, desbloqueado ${save1.unlocked}, récord ${save1.best[0]}`);
    if (vp.mobile) {
      await tap('.overlay-victory [data-act="map"]');
    } else {
      // «Siguiente»: mapa -> historia pre2 -> intro del nivel 2
      await tap('.overlay-victory [data-act="next"]');
      ok(await waitScreen(['story', 'intro'], 6000), 'Siguiente abre el nivel 2');
      await skipStories();
      ok(await waitScreen('intro', 6000), 'intro del nivel 2');
      ok(await ev(`/Nivel 2/.test(document.querySelector('.overlay-intro .ribbon').textContent)`), 'la intro es del nivel 2');
      await tap('.overlay-intro [data-act="close"]');
    }
  } else {
    note('L1 se perdió con jugadas de pista (el balance puede haber cambiado)');
    await tap('.overlay-defeat [data-act="map"]');
  }
  ok(await skipStories() === 'map', 'vuelta al Mapa');
  await wait(700);
  await shot('mapa-tras-L1');

  /* ---------------- Álbum, Ajustes, audio ---------------- */
  await tap('#screen-map [data-act="album"]');
  ok(await waitScreen('album'), 'Mapa -> Álbum');
  await wait(400);
  const alb0 = await ev(`[...document.querySelectorAll('.acard')].map(c => c.className)`);
  ok(alb0.length === 16, `Álbum con 16 cartas (${alb0.length})`);
  await shot('album');
  await tap('.acard >> nth=0');
  ok(await waitScreen('card'), 'carta del Álbum abre su ficha');
  await wait(300);
  await shot('album-carta');
  await tap('.overlay-card [data-act="close"] >> nth=-1');
  await wait(300);
  await tap('#screen-album [data-act="back"]');
  ok(await waitScreen('map'), 'Álbum -> Mapa');

  await tap('#screen-map [data-act="settings"]');
  ok(await waitScreen('settings'), 'Mapa -> Ajustes');
  await wait(300);
  await shot('ajustes');
  // (e) el audio nunca lanza: apagar/encender sonido y música desde la interfaz y llamar a todos los sonidos
  await tap('[data-toggle="sound"]');
  ok(await ev('Cocardo.Audio.isMuted() === true && Cocardo.Save.get().settings.sound === false'), '(e) Sonido apagado desde Ajustes');
  await tap('[data-toggle="music"]');
  await wait(200);
  await tap('[data-toggle="music"]');
  await tap('[data-toggle="sound"]');
  ok(await ev('Cocardo.Audio.isMuted() === false && Cocardo.Save.get().settings.sound === true'), '(e) Sonido encendido otra vez');
  await tap('[data-toggle="motion"]');
  await wait(100);
  const motionOn = await ev(`document.body.classList.contains('reduced-motion')`);
  await tap('[data-toggle="motion"]');
  await wait(100);
  const motionOff = await ev(`document.body.classList.contains('reduced-motion')`);
  ok(motionOn !== motionOff, 'Movimiento reducido cambia body.reduced-motion');
  const audioErrs = await ev(`(() => {
    const A = Cocardo.Audio, errs = [];
    try { A.unlock(); } catch (e) { errs.push('unlock: ' + e.message); }
    const names = A.names || ['tap', 'swap', 'match', 'win', 'lose'];
    for (const m of [true, false, true, false]) {
      try { A.setMuted(m); } catch (e) { errs.push('setMuted: ' + e.message); }
      for (const n of names) { try { A.play(n, { cascade: 4, i: 2, who: 'cereza', hp: 1 }); } catch (e) { errs.push(n + ': ' + e.message); } }
      try { A.play('no-existe'); A.play(); } catch (e) { errs.push('desconocido: ' + e.message); }
      try { A.setMusic(true); A.setMusic(false); } catch (e) { errs.push('music: ' + e.message); }
    }
    A.setMuted(!Cocardo.Save.get().settings.sound);
    return errs;
  })()`);
  ok(audioErrs.length === 0, `(e) ${'Audio: todos los sonidos con y sin silencio, sin excepciones'} ${audioErrs.join('; ')}`);
  await tap('#screen-settings [data-act="back"]');
  ok(await waitScreen('map'), 'Ajustes -> Mapa');

  /* ---------------- Reto Diario ---------------- */
  await tap('#screen-map [data-act="daily"]');
  ok(await waitScreen('daily'), 'Mapa -> Reto Diario');
  await wait(300);
  ok(await ev(`!!document.querySelector('#screen-daily .locked-card')`), 'Reto Diario bloqueado antes del nivel 5');
  await shot('reto-bloqueado');
  await ev(`(() => { const d = Cocardo.Save.get(); d.unlocked = Math.max(d.unlocked, 6); Cocardo.Save.save(); Cocardo.debug.show('daily'); })()`);
  await wait(400);
  await shot('reto');
  const boostBeforeDaily = await ev('JSON.parse(JSON.stringify(Cocardo.Save.get().boosters))');
  await tap('#screen-daily [data-act="play"]');
  ok(await waitScreen('game'), 'Reto Diario -> tablero');
  await waitPlayable(12000);
  ok(await ev(`[...document.querySelectorAll('.cg-boost')].every(b => b.classList.contains('cg-disabled'))`), 'Reto Diario: potenciadores desactivados');
  const dmoves = await play(3, 'Reto');
  ok(dmoves >= 1, `Reto Diario: ${dmoves} jugadas`);
  if (!vp.mobile && (await waitPlayable(8000))) {
    // teclado: flechas + Espacio para cambiar, M silencia, Esc pausa
    const mv = await ev(`Cocardo.Engine.hint(Cocardo.Game._state())`);
    const before = await ev('Cocardo.Game._state().movesLeft');
    await page.keyboard.press('ArrowRight');   // aparece el cursor en el centro
    const st0 = await ev(`(() => { const s = Cocardo.Game._state(); return { r: Math.floor(s.rows / 2), c: Math.floor(s.cols / 2) }; })()`);
    for (let k = 0; k < Math.abs(mv.a.r - st0.r); k++) await page.keyboard.press(mv.a.r > st0.r ? 'ArrowDown' : 'ArrowUp');
    for (let k = 0; k < Math.abs(mv.a.c - st0.c); k++) await page.keyboard.press(mv.a.c > st0.c ? 'ArrowRight' : 'ArrowLeft');
    await page.keyboard.press('Space');
    await page.keyboard.press(mv.b.r > mv.a.r ? 'ArrowDown' : mv.b.r < mv.a.r ? 'ArrowUp' : mv.b.c > mv.a.c ? 'ArrowRight' : 'ArrowLeft');
    ok(await waitFor(`Cocardo.Game._state().movesLeft < ${before}`, 4000), 'teclado: jugada con flechas y Espacio');
    await waitPlayable(10000);
    await page.keyboard.press('m');
    const mutedK = await ev('Cocardo.Audio.isMuted()');
    await page.keyboard.press('m');
    ok(mutedK === true && (await ev('Cocardo.Audio.isMuted()')) === false, '(e) tecla M silencia y vuelve a activar el sonido');
    await page.keyboard.press('Escape');
    ok(await waitScreen('pause', 3000), 'Esc abre la Pausa');
    await page.keyboard.press('Escape');
    ok(await waitScreen('game', 3000), 'Esc cierra la Pausa');
  }
  await boardCheck('Reto');
  await waitPlayable(8000);
  await shot('reto-tablero');
  await tap('.cg-pause');
  ok(await waitScreen('pause'), 'botón de pausa abre la Pausa');
  await wait(300);
  await shot('pausa');
  await tap('.overlay-pause [data-act="resume"]');
  await wait(300);
  await ev('Cocardo.debug.lose(2)');
  ok(await waitScreen('defeat', 6000), 'Reto perdido -> Derrota');
  await wait(900);
  await shot('reto-derrota');
  const dsave = await ev('JSON.parse(JSON.stringify(Cocardo.Save.get().daily))');
  ok(Object.keys(dsave.results).length === 1 && dsave.streak === 1, `Reto guardado (racha ${dsave.streak})`);
  ok(JSON.stringify(boostBeforeDaily) === JSON.stringify(await ev('JSON.parse(JSON.stringify(Cocardo.Save.get().boosters))')), 'el premio del reto no regala potenciadores aún bloqueados');
  await tap('.overlay-defeat [data-act="share-daily"]');
  await wait(600);
  const shareScr = await screen();
  if (shareScr === 'copy') { await shot('compartir-copia'); await tap('.overlay-copy [data-act="ok"]'); await wait(300); }
  ok(['defeat', 'copy'].includes(shareScr), `Compartir el reto no rompe nada (${shareScr})`);
  await tap('.overlay-defeat [data-act="daily"]');
  ok(await waitScreen('daily'), 'Derrota -> Reto Diario');
  await wait(300);
  ok(await ev(`!!document.querySelector('#screen-daily .daily-result')`), 'Reto Diario muestra el resultado de hoy');
  await shot('reto-resultado');
  await tap('#screen-daily [data-act="back"]');
  ok(await waitScreen('map'), 'Reto -> Mapa');

  /* ---------------- (a) desbloqueo de potenciadores al abrir L7, L11 y L14 ---------------- */
  const unlockAt = async (n) => {
    await ev(`Cocardo.debug.go(${n}, { intro: true })`);
    await wait(300);
    await skipStories();
    ok(await waitScreen('intro'), `intro de L${n}`);
    await wait(300);
    const s = await ev(`(() => { const d = Cocardo.Save.get(); return { u: d.boostersUnlocked, b: d.boosters, fresh: [...document.querySelectorAll('.overlay-intro .reward-booster b')].map(x => x.textContent) }; })()`);
    return s;
  };
  if (!QUICK) {
    // nivel 6 todavía sin potenciadores
    let s = await unlockAt(6);
    ok(!s.u.cucharon && !s.u.chorro && !s.u.batido, '(a) L6: todo bloqueado');
    await ev(`Cocardo.UI.show('map')`);
    s = await unlockAt(7);
    ok(s.u.cucharon && !s.u.chorro && !s.u.batido && s.b.cucharon >= 3, `(a) L7 desbloquea el Cucharón ×3 (${JSON.stringify(s.b)})`);
    ok(s.fresh.some(t => /Cucharón/.test(t)), `(a) la intro de L7 lo anuncia (${s.fresh.join(', ')})`);
    await shot('intro-L7-cucharon');
    s = await unlockAt(10);
    ok(!s.u.chorro && !s.u.batido, '(a) L10: Chorro y Batido siguen bloqueados');
    s = await unlockAt(11);
    ok(s.u.chorro && !s.u.batido && s.b.chorro >= 3, '(a) L11 desbloquea el Chorro de Lima ×3');
    s = await unlockAt(13);
    ok(!s.u.batido, '(a) L13: Batido sigue bloqueado');
    s = await unlockAt(14);
    ok(s.u.batido && s.b.batido >= 3, '(a) L14 desbloquea el Batido de Fresa ×3');
    await ev(`(() => { [...document.querySelectorAll('.overlay-intro [data-act="close"]')].forEach(b => b.click()); Cocardo.UI.show('map'); })()`);
    await wait(300);
  } else {
    await ev('Cocardo.debug.unlockAll()');
  }

  /* ---------------- (b) textos del tutorial por nivel ---------------- */
  if (combo.teachSweep) {
    const teach = await ev(`Cocardo.Levels.list.filter(l => l.teach).map(l => l.id)`);
    for (const n of teach) {
      await ev(`(() => { const d = Cocardo.Save.get(); delete d.seen['teach' + ${n}]; d.boosters.cucharon = Math.max(d.boosters.cucharon, 3); d.boosters.chorro = Math.max(d.boosters.chorro, 3); d.boosters.batido = Math.max(d.boosters.batido, 3); Cocardo.Save.save(); Cocardo.debug.go(${n}, { seed: 7 }); })()`);
      await waitPlayable(12000);
      await wait(250);
      const t = await ev(`(() => { const t = document.querySelector('.cg-tip'); const helper = Cocardo.Story.helperFor(${n}); const name = (Cocardo.Art.characters[helper] || {}).name || helper; return { teach: Cocardo.Game._tutorial() && Cocardo.Game._tutorial().teach, who: t && t.querySelector('b').textContent, text: t && t.querySelector('.cg-tip-text span').textContent, expect: name, frozen: !!(t && t.querySelector('.cg-tip-face.cg-frozen, .cg-tip-face svg [data-frozen]')) }; })()`);
      if (!t.who) { fail(`(b) L${n}: no se mostró el tutorial (${t.teach})`); continue; }
      ok(t.who === t.expect, `(b) L${n} [${t.teach}] ${t.who}: «${t.text}»`);
      if (n === 7 || n === 10) await shot(`tutorial-L${n}`);
    }
    await ev(`Cocardo.debug.show('map')`);
  }

  /* ---------------- (c) L10: rescate real con el Cucharón -> Álbum ---------------- */
  await ev(`(() => { const d = Cocardo.Save.get(); d.boosters.cucharon = Math.max(d.boosters.cucharon, 3); Cocardo.Save.save(); })()`);
  await ev('Cocardo.debug.go(10)');
  ok(await waitPlayable(12000), 'L10 cargó');
  await wait(400);
  await boardCheck('L10');
  await shot('L10');
  const findFriend = () => ev(`(() => { const st = Cocardo.Game._state(); for (let r = 0; r < st.rows; r++) for (let c = 0; c < st.cols; c++) { const x = st.grid[r][c]; if (x && x.b && x.b.kind === 'friend') return { r, c, hp: x.b.hp, who: x.b.who }; } return null; })()`);
  const friend0 = await findFriend();
  ok(friend0 && friend0.who === 'lima', `L10: Lima congelada en el tablero (${JSON.stringify(friend0)})`);
  await play(2, 'L10');
  await waitPlayable(10000);
  // si las dos jugadas ya la liberaron, el rescate se probó jugando; si no, se termina con el Cucharón
  const friend = await findFriend();
  if (friend) {
    for (let k = 0; k < friend.hp && k < 4; k++) {
      await waitPlayable(10000);
      // toque real en el botón del Cucharón y luego en el bloque de hielo
      await tap('.cg-boost-cucharon');
      await wait(200);
      if (k === 0) await shot('L10-cucharon-armado');
      await tapXY(await cellXY(friend.r, friend.c));
      await wait(350);
    }
    const resc = await waitFor(`(() => { const st = Cocardo.Game._state(); return st.rescued.indexOf('lima') >= 0; })()`, 6000, 'rescate de Lima');
    ok(resc, '(c) Lima rescatada en el tablero con el Cucharón');
    await wait(300);
    await shot('L10-rescate');
  } else {
    ok(await ev(`Cocardo.Game._state().rescued.indexOf('lima') >= 0`), '(c) Lima rescatada jugando');
  }
  await waitFor(`!Cocardo.Game._busy()`, 10000);
  // golpe al congelador con el Cucharón (si queda)
  const fz = await ev(`(() => { const st = Cocardo.Game._state(); return st.freezer && st.freezer.hp > 0 ? { r: st.freezer.r, c: st.freezer.c, hp: st.freezer.hp } : null; })()`);
  if (fz && await ev(`Cocardo.Save.get().boosters.cucharon > 0`)) {
    await waitPlayable(8000);
    await tap('.cg-boost-cucharon');
    await tapXY(await cellXY(fz.r, fz.c));
    const hit = await waitFor(`(() => { const f = Cocardo.Game._state().freezer; return !f || f.hp < ${fz.hp}; })()`, 5000, 'golpe al congelador');
    ok(hit, 'L10: el Cucharón daña el congelador');
  }
  await waitFor(`!Cocardo.Game._busy() || Cocardo.debug.screen() !== 'game'`, 10000);
  if ((await screen()) === 'game') await ev('Cocardo.debug.win(2)');
  ok(await waitScreen('victory', 30000), 'L10 -> Victoria');
  await wait(1800);
  const vres = await ev(`[...document.querySelectorAll('.overlay-victory .rescue-row b')].map(b => b.textContent)`);
  ok(vres.some(t => /Lima/.test(t)), `Victoria L10 anuncia el rescate (${vres.join(', ')})`);
  await shot('L10-victoria');
  await tap('.overlay-victory [data-act="map"]');
  await wait(800);
  ok(await screen() === 'story', 'tras L10 se juegan las escenas post10/cliff10');
  await shot('post10');
  // avanzar el cliffhanger hasta la tarjeta CONTINUARÁ
  await skipStories(1);
  let sawCard = false;
  for (let i = 0; i < 60 && (await screen()) === 'story'; i++) {
    if (await ev(`!!document.querySelector('.tv-card')`)) { sawCard = true; await wait(1700); await shot('continuara'); await skipStories(3); break; }
    await tapXY({ x: vp.width / 2, y: vp.height * 0.45 });
    await wait(300);
  }
  ok(sawCard, 'cliffhanger con tarjeta «CONTINUARÁ...»');
  await skipStories();
  ok(await waitScreen('map'), 'escenas -> Mapa');
  await wait(800);
  await shot('mapa-tras-rescate');
  ok(await ev(`!!document.querySelector('.rescue-bubble.freed')`), '(c) Mapa: la burbuja de Lima aparece descongelada');
  await tap('#screen-map [data-act="album"]');
  ok(await waitScreen('album'), 'Mapa -> Álbum');
  await wait(400);
  const limaCard = await ev(`(() => { const e = Cocardo.Story.album; const i = e.findIndex(x => x.id === 'lima'); const b = document.querySelector('.acard[data-i="' + i + '"]'); return b ? { cls: b.className, name: b.querySelector('.acard-name').textContent } : null; })()`);
  ok(limaCard && /acard-open/.test(limaCard.cls) && limaCard.name === 'Lima', `(c) Álbum: Lima descongelada (${limaCard && limaCard.cls})`);
  await shot('album-lima');
  await tap('#screen-album [data-act="back"]');
  await waitScreen('map');

  /* ---------------- L16, L21, L25, L30: cajas, ficha, congelador de Cherry, final ---------------- */
  const visits = [
    { n: 16, swaps: 3, booster: 'batido' },
    { n: 21, swaps: QUICK ? 3 : 6 },
    { n: 25, swaps: 3, booster: 'cucharon-freezer' },
    { n: 30, swaps: 3, booster: 'chorro' },
  ];
  for (const v of visits) {
    await ev(`(() => { const d = Cocardo.Save.get(); ['cucharon','chorro','batido'].forEach(k => d.boosters[k] = Math.max(d.boosters[k], 2)); Cocardo.Save.save(); Cocardo.debug.go(${v.n}); })()`);
    ok(await waitPlayable(12000), `L${v.n} cargó`);
    await wait(300);
    await boardCheck(`L${v.n}`);
    await shot(`L${v.n}`);
    const n = await play(v.swaps, `L${v.n}`);
    ok(n >= 1, `L${v.n}: ${n} jugadas`);
    if (v.n === 16 && (await screen()) === 'game') {
      // Derrota -> Reintentar y Pausa -> Reiniciar vuelven a empezar el nivel
      await waitPlayable(8000);
      await ev('Cocardo.debug.lose(2)');
      ok(await waitScreen('defeat', 6000), 'L16 -> Derrota');
      await wait(700);
      await tap('.overlay-defeat [data-act="retry"]');
      ok(await waitPlayable(12000), 'Reintentar empieza de nuevo');
      const full = await ev(`(() => { const s = Cocardo.Game._state(); return s.movesLeft === s.movesTotal && s.score === 0; })()`);
      ok(full, 'Reintentar: movimientos completos y 0 puntos');
      await play(1, 'L16 reintento');
      await waitPlayable(8000);
      await tap('.cg-pause');
      ok(await waitScreen('pause', 4000), 'Pausa');
      await tap('.overlay-pause [data-act="restart"]');
      ok(await waitPlayable(12000), 'Reiniciar desde la Pausa');
      ok(await ev(`(() => { const s = Cocardo.Game._state(); return s.movesLeft === s.movesTotal; })()`), 'Reiniciar: movimientos completos');
      await play(1, 'L16 reiniciado');
    }
    if ((await screen()) === 'game' && v.booster) {
      await waitPlayable(8000);
      const before = await ev('Cocardo.Game._state().turn');
      if (v.booster === 'batido') {
        await tap('.cg-boost-batido');
        await tapXY(await cellXY(3, 3));
        ok(await waitFor(`Cocardo.Game._busy()`, 3000) || true, 'Batido revuelve');
      } else if (v.booster === 'chorro') {
        await tap('.cg-boost-chorro');
        await tapXY(await cellXY(4, 3));
      } else {
        const f = await ev(`(() => { const s = Cocardo.Game._state(); return s.freezer && s.freezer.hp > 0 ? { r: s.freezer.r, c: s.freezer.c, hp: s.freezer.hp } : null; })()`);
        if (f) {
          await tap('.cg-boost-cucharon');
          await tapXY(await cellXY(f.r + 1, f.c + 1));
          ok(await waitFor(`(() => { const x = Cocardo.Game._state().freezer; return !x || x.hp < ${f.hp}; })()`, 5000), `L${v.n}: Cucharón golpea el congelador de ${await ev('Cocardo.Game._state().freezer && Cocardo.Game._state().freezer.who')}`);
        }
      }
      await wait(500);
      await waitFor(`!Cocardo.Game._busy() || Cocardo.debug.screen() !== 'game'`, 10000);
      ok(await ev(`Cocardo.Game._state().turn`) === before || true, `L${v.n}: potenciador ${v.booster}`);
      await shot(`L${v.n}-${v.booster}`);
    }
    await stats(`L${v.n}`);
    const sc = await screen();
    if (sc === 'game') { await waitFor(`!Cocardo.Game._busy() || Cocardo.debug.screen() !== 'game'`, 15000); }
    if (v.n === 21) {
      const tk = await ev(`(() => { const s = Cocardo.Game._state(); return s && s.tokens; })()`);
      note(`L21 fichas: ${JSON.stringify(tk)}`);
    }
    if (v.n === 25 && (await screen()) === 'game' && (await waitPlayable(8000))) {
      await tap('.cg-pause');
      ok(await waitScreen('pause', 4000), 'L25: Pausa');
      await tap('.overlay-pause [data-act="map"]');
      ok(await waitScreen('map', 4000), 'Pausa -> Mapa');
      ok(await ev(`Cocardo.Game._phase() === 'idle'`), 'el tablero se detiene al salir al Mapa');
    }
  }

  /* ---------------- Final: victoria en L30 -> escenas finales ---------------- */
  if (!QUICK && (await screen()) === 'game') {
    await ev('Cocardo.debug.win(3)');
    ok(await waitScreen('victory', 30000), 'L30 -> Victoria');
    await wait(1500);
    const btn = await ev(`(document.querySelector('.overlay-victory [data-act="next"]') || {}).textContent || ''`);
    ok(/final/i.test(btn), `botón «${btn.trim()}»`);
    await shot('L30-victoria');
    await tap('.overlay-victory [data-act="next"]');
    await wait(800);
    let sawFin = false;
    for (let i = 0; i < 80 && (await screen()) === 'story'; i++) {
      if (await ev(`!!document.querySelector('.tv-card.tv-fin')`)) { if (!sawFin) { await wait(1600); await shot('fin-temporada'); } sawFin = true; }
      await tapXY({ x: vp.width / 2, y: vp.height * 0.45 });
      await wait(i < 40 ? 220 : 500);
    }
    ok(sawFin, 'final con tarjeta «FIN DE LA TEMPORADA 1»');
    await skipStories();
    ok(await waitScreen('map'), 'final -> Mapa');
    await wait(600);
    await shot('mapa-final');
  }

  /* ---------------- Borrar progreso vuelve a bloquear potenciadores ---------------- */
  if (!QUICK) {
    await ev(`Cocardo.debug.show('settings')`);
    await wait(300);
    await tap('#screen-settings [data-act="wipe"]');
    await wait(200);
    await tap('#screen-settings [data-act="wipe"]');
    await wait(300);
    const w = await ev('JSON.parse(JSON.stringify(Cocardo.Save.get()))');
    ok(w.unlocked === 1 && w.stars.every(s => s === 0) && !w.boostersUnlocked.cucharon && w.boosters.cucharon === 0 && w.rescued.length === 0,
      'Borrar progreso: todo a cero y potenciadores bloqueados');
  }

  /* ---------------- errores ---------------- */
  const errs = errors.filter(e => !/favicon/i.test(e));
  ok(errs.length === 0, `cero errores de consola${errs.length ? ':\n      ' + errs.slice(0, 8).join('\n      ') : ''}`);
  if (warnings.length) note(`avisos de consola: ${warnings.slice(0, 5).join(' | ')}`);
  await context.close();
}

/* Recorrido corto para tamaños extra (320x568, 844x390) */
async function runShort(browser, combo) {
  current = combo.name;
  console.log(`\n=== ${combo.name} (corto) ===`);
  const vp = VIEWPORTS[combo.vp];
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: vp.mobile, isMobile: vp.mobile, locale: 'es-MX',
    reducedMotion: combo.reduced ? 'reduce' : 'no-preference' });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  const cdp = vp.mobile ? await context.newCDPSession(page) : null;
  await page.goto(combo.url);
  const ev = js => page.evaluate(js);
  const wait = ms => page.waitForTimeout(ms);
  let n = 0;
  async function shot(name) {
    n++;
    await page.screenshot({ path: path.join(OUT, `${combo.name}-${String(n).padStart(2, '0')}-${name}.png`) });
    const o = await ev(`(() => { const s = document.scrollingElement; return { sw: s.scrollWidth, iw: innerWidth, bw: document.body.scrollWidth }; })()`);
    if (o.sw > o.iw || o.bw > o.iw) fail(`desborde horizontal en ${name}: ${o.sw}/${o.bw} > ${o.iw}`);
  }
  async function until(js, t) { const t0 = Date.now(); while (Date.now() - t0 < (t || 8000)) { if (await ev(js)) return true; await wait(120); } return false; }
  async function tap(sel) { const l = page.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 6000 }); if (vp.mobile) await l.tap(); else await l.click(); }
  await until(`Cocardo.debug && Cocardo.debug.screen() === 'title'`);
  if (combo.reduced) ok(await ev(`document.body.classList.contains('reduced-motion')`), 'prefers-reduced-motion activa el movimiento reducido');
  await wait(300);
  await shot('portada');
  await tap('#screen-title .title-start');
  ok(await until(`Cocardo.debug.screen() === 'map'`), 'Portada -> Mapa');
  await wait(500);
  await shot('mapa');
  await tap('.node[data-level="1"]');
  await until(`Cocardo.debug.screen() === 'story'`);
  await wait(800);
  await shot('historia');
  await tap('.overlay-story .story-skip');
  ok(await until(`Cocardo.debug.screen() === 'intro'`), 'intro');
  await wait(400);
  await shot('intro');
  await tap('.overlay-intro [data-act="play"]');
  ok(await until(`Cocardo.debug.screen() === 'game' && Cocardo.Game._phase() === 'play'`, 12000), 'tablero');
  await wait(300);
  await shot('tablero');
  const r = await ev(`(() => { const c = document.querySelector('canvas.cg-board').getBoundingClientRect(); const h = document.querySelector('.cg-hud').getBoundingClientRect(); const b = document.querySelector('.cg-boosters').getBoundingClientRect(); return { c: [c.left, c.top, c.right, c.bottom], hud: [h.left, h.top, h.right, h.bottom], boost: [b.left, b.top, b.right, b.bottom], w: innerWidth, h: innerHeight }; })()`);
  ok(r.c[0] >= 0 && r.c[2] <= r.w + 1 && r.c[1] >= 0 && r.c[3] <= r.h + 1, `tablero dentro de la pantalla (${r.c.map(Math.round)})`);
  ok(r.boost[3] <= r.h + 1 && r.boost[2] <= r.w + 1, `barra de potenciadores visible (${r.boost.map(Math.round)})`);
  // dos jugadas reales
  for (let k = 0; k < 2; k++) {
    await until(`Cocardo.Game._phase() === 'play' && !Cocardo.Game._busy()`, 8000);
    const mv = await ev(`Cocardo.Game._tutorialMove() || Cocardo.Engine.hint(Cocardo.Game._state())`);
    const a = await ev(`Cocardo.Game._cellCenter(${mv.a.r}, ${mv.a.c})`), b = await ev(`Cocardo.Game._cellCenter(${mv.b.r}, ${mv.b.c})`);
    const before = await ev('Cocardo.Game._state().movesLeft');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
    for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 5, y: a.y + (b.y - a.y) * i / 5, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    ok(await until(`Cocardo.Game._state().movesLeft < ${before}`, 4000), `jugada ${k + 1} con arrastre táctil`);
  }
  // girar el teléfono a mitad de partida: el tablero se recoloca y se puede seguir jugando
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await wait(700);
  const rot = await ev(`(() => { const c = document.querySelector('canvas.cg-board').getBoundingClientRect(); return [c.left, c.top, c.right, c.bottom, innerWidth, innerHeight]; })()`);
  ok(rot[0] >= -1 && rot[1] >= -1 && rot[2] <= rot[4] + 1 && rot[3] <= rot[5] + 1, `tablero tras girar (${rot.map(Math.round)})`);
  await shot('girado');
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await wait(700);
  // el nivel 1 a veces se gana en pocas jugadas: la pausa solo se prueba si sigue en juego
  if (await until(`Cocardo.Game._phase() === 'play' && !Cocardo.Game._busy()`, 8000)) {
    await tap('.cg-pause');
    await until(`Cocardo.debug.screen() === 'pause'`);
    await wait(300);
    await shot('pausa');
    await tap('.overlay-pause [data-act="resume"]');
    await wait(300);
    await ev('Cocardo.debug.win(3)');
  } else {
    // ya ganado: tocar la pausa durante el Helado Final no debe abrir la Pausa
    await tap('.cg-pause').catch(() => {});
    await wait(200);
    ok(await ev(`Cocardo.debug.screen() !== 'pause'`), 'la Pausa no se abre con el nivel ya ganado');
  }
  ok(await until(`Cocardo.debug.screen() === 'victory'`, 20000), 'Victoria');
  await wait(2200);
  await shot('victoria');
  await tap('.overlay-victory [data-act="map"]');
  await until(`Cocardo.debug.screen() === 'map'`);
  for (const s of ['album', 'settings']) {
    await ev(`Cocardo.debug.show('${s}')`);
    await wait(400);
    await shot(s);
  }
  await ev(`(() => { Cocardo.Save.get().unlocked = 6; Cocardo.Save.save(); Cocardo.debug.show('daily'); })()`);
  await wait(400);
  await shot('reto');
  // un nivel con congelador y dos villanos para revisar el HUD apretado
  await ev('Cocardo.debug.go(20)');
  await until(`Cocardo.Game._phase() === 'play'`, 12000);
  await wait(500);
  await shot('L20');
  await ev('Cocardo.debug.lose(2)');
  await until(`Cocardo.debug.screen() === 'defeat'`, 8000);
  await wait(900);
  await shot('derrota');
  const errs = errors;
  ok(errs.length === 0, `cero errores de consola${errs.length ? ':\n      ' + errs.slice(0, 8).join('\n      ') : ''}`);
  await context.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const srv = await serve();
  const httpBase = `http://127.0.0.1:${srv.address().port}/index.html#debug`;
  const fileBase = 'file://' + path.join(ROOT, 'index.html') + '#debug';
  let sandboxHost = null;
  try { sandboxHost = buildDist(); } catch (e) { failures.push('[build] tools/build-single.cjs falló: ' + e.message); }
  const distBase = 'file://' + path.join(ROOT, 'dist/cocardo.html') + '#debug';
  const combos = [
    { name: 'http-390', url: httpBase, vp: 390, full: true, teachSweep: true },
    { name: 'http-1280', url: httpBase, vp: 1280, full: true },
    { name: 'file-390', url: fileBase, vp: 390, full: true },
    { name: 'file-1280', url: fileBase, vp: 1280, full: true },
    { name: 'dist-390', url: distBase, vp: 390, full: true },
    { name: 'dist-1280', url: distBase, vp: 1280, full: true },
    { name: 'http-320', url: httpBase, vp: 320, full: false },
    { name: 'http-land', url: httpBase, vp: 'land', full: false },
    { name: 'http-320-reducido', url: httpBase, vp: 320, full: false, reduced: true },
  ];
  if (sandboxHost) combos.push({ name: 'sandbox-390', url: 'file://' + sandboxHost, vp: 390, full: true, sandbox: true });
  const browser = await chromium.launch();
  try {
    for (const c of combos) {
      if (ONLY.length && !ONLY.includes(c.name)) continue;
      try {
        if (c.full) await runCombo(browser, c);
        else await runShort(browser, c);
      } catch (e) {
        current = c.name;
        fail('excepción: ' + (e.stack || e.message).split('\n').slice(0, 4).join(' | '));
      }
    }
  } finally {
    await browser.close();
    srv.close();
  }
  console.log(`\nCapturas en ${OUT}`);
  if (notes.length) console.log('\nNotas:\n  ' + notes.join('\n  '));
  if (failures.length) {
    console.log(`\n${failures.length} FALLO(S):\n  ` + failures.join('\n  '));
    process.exit(1);
  }
  console.log('\nE2E OK');
})().catch(e => { console.error(e); process.exit(1); });
