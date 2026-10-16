#!/usr/bin/env node
/* Graba un video vertical (1080×1920) de un bot jugando un nivel, para publicar en TikTok, Reels o Shorts.
 * El bot juega la mejor jugada que propone el motor (Cocardo.Engine.hint), igual que la pista del juego.
 *
 * Uso:  node tools/record.cjs [--level 12] [--seed 7] [--daily] [--out clips] [--mp4] [--max 60] [--speed 1]
 *   --level N   nivel de campaña (1-30). Por defecto 12.
 *   --seed N    semilla del tablero (misma semilla = misma partida). Aleatoria si falta.
 *   --daily     graba el Reto Diario de hoy en vez de un nivel.
 *   --out DIR   carpeta de salida (por defecto clips/).
 *   --mp4       convierte a MP4 (H.264) con el ffmpeg de Playwright si está disponible.
 *   --max N     jugadas como máximo (por defecto 80).
 *   --pause MS  pausa entre jugadas en milisegundos (por defecto 450): más pausa = video más tranquilo.
 * Resultado: clips/cocardo-nivel-12-<fecha>.webm (y .mp4 con --mp4). Consejo para TikTok: corta los
 * primeros 2 s con el gancho («Cocardo congeló a Lima…») en tu editor y deja la cascada más grande al inicio. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
function opt(name, def) { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; }
function flag(name) { return args.includes('--' + name); }
const LEVEL = +opt('level', 12);
const SEED = opt('seed', null);
const DAILY = flag('daily');
const OUTDIR = path.resolve(ROOT, opt('out', 'clips'));
const MP4 = flag('mp4');
const MAX = +opt('max', 80);
const PAUSE = +opt('pause', 450);

function loadPlaywright() {
  for (const p of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright']) {
    if (!p) continue;
    try { return require(p); } catch (e) { /* siguiente */ }
  }
  throw new Error('No se encontró playwright (define PLAYWRIGHT_MODULE)');
}
// ffmpeg con libx264: el del sistema (apt install ffmpeg / brew install ffmpeg). El que trae Playwright
// solo sabe de WebM, así que no sirve para convertir.
function findFfmpeg() {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-encoders']);
  if (r.status === 0 && /libx264/.test(String(r.stdout))) return 'ffmpeg';
  return null;
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
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
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    recordVideo: { dir: OUTDIR, size: { width: 1080, height: 1920 } },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${base}/index.html#debug`);
  await page.waitForFunction(() => window.Cocardo && Cocardo.debug && Cocardo.debug.screen() === 'title');
  await page.evaluate(() => { Cocardo.debug.unlockAll(); const d = Cocardo.Save.get(); d.settings.skipStory = true; Cocardo.Save.save(); });
  await wait(600);
  let label;
  if (DAILY) {
    await page.evaluate(() => { Cocardo.debug.show('daily'); });
    await wait(900);
    await page.locator('[data-act="play"]').first().tap();
    label = 'reto-' + (await page.evaluate(() => Cocardo.debug.daily().num));
  } else {
    await page.evaluate(([n, seed]) => Cocardo.debug.go(n, { seed: seed != null ? +seed : undefined }), [LEVEL, SEED]);
    label = 'nivel-' + LEVEL;
  }
  const playable = () => page.evaluate(() => { const G = Cocardo.Game; return Cocardo.debug.screen() === 'game' && G._phase && G._phase() === 'play' && !G._busy(); });
  const t0 = Date.now();
  while (!(await playable()) && Date.now() - t0 < 15000) await wait(150);
  await wait(900);
  let moves = 0;
  while (moves < MAX) {
    const scr = await page.evaluate(() => Cocardo.debug.screen());
    if (scr !== 'game') break;
    if (!(await playable())) { await wait(120); continue; }
    const mv = await page.evaluate(() => { const G = Cocardo.Game; return (G._tutorialMove && G._tutorialMove()) || Cocardo.Engine.hint(G._state()); });
    if (!mv) break;
    await page.evaluate(m => Cocardo.debug.swap(m.a, m.b), mv);
    moves++;
    await wait(PAUSE);
    const st = await page.evaluate(() => { const s = Cocardo.Game._state(); return s ? s.status : 'playing'; });
    if (st !== 'playing') break;
  }
  // deja ver Victoria/Derrota (estrellas, confeti) antes de cortar
  const t1 = Date.now();
  while (Date.now() - t1 < 9000) {
    const scr = await page.evaluate(() => Cocardo.debug.screen());
    if (scr === 'victory' || scr === 'defeat') { await wait(4500); break; }
    await wait(200);
  }
  const result = await page.evaluate(() => { const s = Cocardo.Game._state(); return s ? { status: s.status, score: s.score, movesLeft: s.movesLeft } : null; });
  const video = page.video();
  await ctx.close();   // cierra el contexto (no el navegador) para que el video termine de escribirse
  srv.close();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const webm = path.join(OUTDIR, `cocardo-${label}-${stamp}.webm`);
  await video.saveAs(webm);
  try { await video.delete(); } catch (e) { /* nada */ }
  await browser.close();
  console.log(`${path.relative(ROOT, webm)}  (${moves} jugadas, ${result ? result.status + ', ' + result.score + ' pts' : 'sin estado'})`);
  if (errors.length) console.log('errores de página:', errors.join('\n'));
  if (MP4) {
    const ff = findFfmpeg();
    if (!ff) { console.log('No hay ffmpeg con libx264 (instálalo: apt install ffmpeg / brew install ffmpeg). Convierte con:\n  ffmpeg -i "' + path.relative(ROOT, webm) + '" -c:v libx264 -pix_fmt yuv420p -r 30 -movflags +faststart clip.mp4'); return; }
    const mp4 = webm.replace(/\.webm$/, '.mp4');
    const r = spawnSync(ff, ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', mp4], { stdio: 'inherit' });
    if (r.status === 0) console.log(path.relative(ROOT, mp4)); else console.log('no se pudo convertir a MP4 (código ' + r.status + ')');
  }
})().catch(e => { console.error(e); process.exit(1); });
