#!/usr/bin/env node
// Graba una escena (tools/video/*.html) a MP4 vertical 1080x1920 listo para TikTok e Instagram Reels.
// Uso: node tools/video/grabar.cjs <escena.html[?param]> <salida.mp4> [--fotos t1,t2,...] [--cap <carpeta>]
//   --fotos: además guarda PNG de esos segundos junto a la salida (para revisar o usar de portada).
//   --cap: carpeta de tomas capturadas (tools/video/capturar.cjs); la escena las lee en /cap/<toma>/.
// La escena se sirve por HTTP local desde la raíz del repositorio (así el lienzo puede leer las tomas).
// Cada fotograma se dibuja con un reloj fijo (no en tiempo real), así que el video sale idéntico cada vez.
// El audio se sintetiza con js/audio.js (render sin conexión), se normaliza a -14 LUFS y se limita a -2 dBFS.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function loadPlaywright() {
  for (const p of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright']) {
    if (!p) continue;
    try { return require(p); } catch (e) { /* siguiente */ }
  }
  throw new Error('No se encontró playwright (define PLAYWRIGHT_MODULE)');
}

const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
// Servidor estático: / = repositorio, /cap/ = carpeta de tomas
function servir(cap) {
  const srv = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    let base = ROOT;
    if (cap && u.startsWith('/cap/')) { base = path.resolve(cap); u = u.slice(4); }
    const file = path.join(base, path.normalize(u));
    if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

function ffmpeg(args) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg salió con ' + c)))));
  return { p, done };
}

(async () => {
  const argv = process.argv.slice(2);
  const [escena, salida] = argv;
  if (!escena || !salida) {
    console.error('uso: node tools/video/grabar.cjs <escena.html[?param]> <salida.mp4> [--fotos t1,t2,...] [--cap <carpeta>]');
    process.exit(2);
  }
  const iF = argv.indexOf('--fotos');
  const fotos = iF > 0 ? argv[iF + 1].split(',').map(Number) : [];
  const iC = argv.indexOf('--cap');
  const srv = await servir(iC > 0 ? argv[iC + 1] : null);
  const [archivo, query] = escena.split('?');
  const url = `http://127.0.0.1:${srv.address().port}/${path.relative(ROOT, path.resolve(archivo)).split(path.sep).join('/')}${query ? '?' + query : ''}`;

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.Escena || window.__error, null, { timeout: 30000 });
  const fallo = await page.evaluate(() => window.__error || null);
  if (fallo) throw new Error(fallo);

  const info = await page.evaluate(() => window.Escena.preparar());
  const fps = info.fps || 30;
  const total = Math.round(info.duracion * fps);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cocardo-video-'));
  const wav = path.join(tmp, 'audio.wav');
  fs.writeFileSync(wav, Buffer.from(info.wav, 'base64'));

  fs.mkdirSync(path.dirname(path.resolve(salida)), { recursive: true });
  const enc = ffmpeg([
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-i', wav,
    '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-r', String(fps), '-g', String(fps * 2),
    '-af', 'loudnorm=I=-14:TP=-2:LRA=11,aresample=44100,alimiter=limit=0.79:attack=2:release=60:level=0',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-movflags', '+faststart', '-t', String(info.duracion),
    salida,
  ]);

  const base = salida.replace(/\.mp4$/i, '');
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const t = i / fps;
    const url = await page.evaluate((tt) => window.Escena.dibujar(tt), t);
    const png = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!enc.p.stdin.write(png)) await new Promise((r) => enc.p.stdin.once('drain', r));
    if (i % (fps * 2) === 0) process.stdout.write(`\r${(100 * i / total).toFixed(0)} %`);
  }
  enc.p.stdin.end();
  await enc.done;

  for (const t of fotos) {
    const url = await page.evaluate((tt) => window.Escena.dibujar(tt), t);
    fs.writeFileSync(`${base}-${t.toFixed(2)}s.png`, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  }
  await browser.close();
  srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\r${salida}: ${total} fotogramas, ${info.duracion} s, ${((Date.now() - t0) / 1000).toFixed(0)} s de render`);
  if (errores.length) { console.error(errores.join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
