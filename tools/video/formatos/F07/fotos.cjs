#!/usr/bin/env node
// Vista rápida de un montaje sin grabar el video: dibuja solo los segundos pedidos y los junta en una tira.
// Uso: node tools/video/formatos/F07/fotos.cjs "tools/video/montaje.html?m=videos/<id>/montaje.js" <carpeta> 0,0.5,1,12.3 [--cap dist/cap] [--wav]
// Deja <carpeta>/f-<t>.png, <carpeta>/tira.jpg (escala 0,3) y, con --wav, la mezcla sin normalizar en <carpeta>/mezcla.wav.
// Imprime la duración y la línea de tiempo de la plantilla F07 (planos y voces). Abre un solo Chromium (~1 GB).
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac' };

function playwright() {
  for (const p of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright']) {
    if (!p) continue;
    try { return require(p); } catch (e) { /* siguiente */ }
  }
  throw new Error('No se encontró playwright (define PLAYWRIGHT_MODULE)');
}
function servir(cap) {
  const srv = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    let base = ROOT;
    if (u.startsWith('/cap/')) { base = path.resolve(cap); u = u.slice(4); }
    const file = path.join(base, path.normalize(u));
    if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

(async () => {
  const argv = process.argv.slice(2);
  const [escena, dir, lista] = argv;
  if (!lista) { console.error('uso: fotos.cjs <escena?m=…> <carpeta> t1,t2,… [--cap dist/cap] [--wav]'); process.exit(1); }
  const iC = argv.indexOf('--cap');
  const cap = path.resolve(iC > 0 ? argv[iC + 1] : path.join(ROOT, 'dist/cap'));
  fs.mkdirSync(dir, { recursive: true });
  const srv = await servir(cap);
  const [archivo, query] = escena.split('?');
  const url = `http://127.0.0.1:${srv.address().port}/${path.relative(ROOT, path.resolve(archivo)).split(path.sep).join('/')}${query ? '?' + query : ''}`;
  const { chromium } = playwright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errores.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.Escena || window.__error, null, { timeout: 30000 });
  const fallo = await page.evaluate(() => window.__error || null);
  if (fallo) throw new Error(fallo);
  const info = await page.evaluate(() => window.Escena.preparar());
  if (argv.includes('--wav')) fs.writeFileSync(path.join(dir, 'mezcla.wav'), Buffer.from(info.wav, 'base64'));
  const linea = await page.evaluate(() => {
    const f = window.F07 && window.F07.info;
    if (!f) return null;
    return { dur: f.DUR, beat: f.B, planos: f.planos.map((p) => [p.id || p.i, +p.de.toFixed(3), +p.a.toFixed(3)]),
      voces: f.guion ? f.guion.lineas.map((l) => [l.quien, +l.t0.toFixed(3), +l.t1.toFixed(3), l.texto]) : [] };
  });
  console.log(`duración ${info.duracion.toFixed(3)} s`);
  if (linea) console.log(JSON.stringify(linea));
  const ts = lista.split(',').map(Number);
  const pngs = [];
  for (const t of ts) {
    const d = await page.evaluate((tt) => window.Escena.dibujar(tt), t);
    const f = path.join(dir, `f-${t.toFixed(2)}.png`);
    fs.writeFileSync(f, Buffer.from(d.slice(d.indexOf(',') + 1), 'base64'));
    pngs.push([f, t]);
  }
  await browser.close();
  srv.close();
  const ins = pngs.flatMap((p) => ['-i', p[0]]);
  const n = pngs.length;
  const filtro = pngs.map((p, k) => `[${k}]scale=324:576,drawtext=text='${p[1].toFixed(2)} s':x=8:y=8:fontsize=24:fontcolor=yellow:box=1:boxcolor=black[v${k}]`).join(';')
    + ';' + pngs.map((p, k) => `[v${k}]`).join('') + (n > 1 ? `hstack=${n}` : 'null');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...ins, '-filter_complex', filtro, path.join(dir, 'tira.jpg')]);
  console.log(path.join(dir, 'tira.jpg'));
  if (errores.length) console.error(errores.join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
