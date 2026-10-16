#!/usr/bin/env node
/* Genera los íconos y la imagen de vista previa (Open Graph) a partir del arte SVG del juego, con Chromium.
 * Uso: node tools/build-icons.cjs            -> icons/favicon.svg, icon-192.png, icon-512.png,
 *                                               icon-512-maskable.png, apple-touch-icon.png, og.png
 * Vuelve a correrlo si cambia el logo o el retrato de Cocardo. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'icons');

function loadPlaywright() {
  for (const p of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright']) {
    if (!p) continue;
    try { return require(p); } catch (e) { /* siguiente */ }
  }
  throw new Error('No se encontró playwright (define PLAYWRIGHT_MODULE)');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const art = fs.readFileSync(path.join(ROOT, 'js/art.js'), 'utf8');
  const chars = fs.readFileSync(path.join(ROOT, 'js/art-characters.js'), 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@800;900&family=Yellowtail&display=swap">
<style>
  body { margin: 0; background: #fff; font-family: 'Nunito', system-ui, sans-serif; }
  .tile { position: relative; overflow: hidden; display: grid; place-items: center;
    background: radial-gradient(circle at 30% 25%, #ffe4ee 0, #ffb3cf 45%, #ff6fa5 100%); }
  .tile.rounded { border-radius: 22%; }
  .tile .dots { position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(255,255,255,.55) 0 3px, transparent 4px); background-size: 46px 46px; opacity: .8; }
  .tile .face { position: relative; width: 84%; height: 84%; transform: translateY(6%); }
  .tile.maskable .face { width: 66%; height: 66%; transform: translateY(4%); }
  .tile svg { width: 100%; height: 100%; }
  .og { position: relative; width: 1200px; height: 630px; overflow: hidden; background: #ffd3e3; }
  .og .bg { position: absolute; inset: 0; }
  .og .bg svg { width: 100%; height: 100%; }
  .og .veil { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(43,22,48,.55) 0%, rgba(43,22,48,.15) 55%, rgba(43,22,48,0) 100%); }
  .og .logo { position: absolute; left: 56px; top: 54px; width: 620px; filter: drop-shadow(0 8px 0 rgba(43,22,48,.35)); }
  .og .logo svg { width: 100%; height: auto; }
  .og .tag { position: absolute; left: 66px; top: 372px; font-family: 'Yellowtail', cursive; font-size: 54px; color: #fff; text-shadow: 0 4px 0 #5b1e74; }
  .og .cta { position: absolute; left: 66px; top: 470px; padding: 14px 34px; border: 4px solid #2b1630; border-radius: 999px; background: linear-gradient(180deg,#fff,#fff6ea 55%,#f6d8bd); font-family: 'Lilita One', sans-serif; font-size: 40px; color: #5b1e74; box-shadow: 0 7px 0 #2b1630; }
  .og .hero { position: absolute; right: 36px; bottom: -40px; width: 560px; height: 560px; filter: drop-shadow(0 10px 0 rgba(43,22,48,.3)); }
  .og .hero svg { width: 100%; height: 100%; }
  .og .fan { position: absolute; right: 24px; top: 22px; padding: 6px 14px; border-radius: 999px; background: rgba(43,22,48,.75); color: #fff6ea; font-weight: 800; font-size: 18px; }
</style></head><body>
<div id="i512" class="tile rounded" style="width:512px;height:512px"><div class="dots"></div><div class="face"></div></div>
<div id="imask" class="tile maskable" style="width:512px;height:512px"><div class="dots"></div><div class="face"></div></div>
<div id="i180" class="tile" style="width:180px;height:180px"><div class="dots"></div><div class="face"></div></div>
<div id="i192" class="tile rounded" style="width:192px;height:192px"><div class="dots"></div><div class="face"></div></div>
<div id="og" class="og"><div class="bg"></div><div class="veil"></div><div class="logo"></div>
  <div class="tag">Una frutinovela de helados</div>
  <div class="cta">Juega gratis en tu celular</div>
  <div class="hero"></div><div class="fan">Juego de fans, no oficial</div></div>
<script>${art}</script><script>${chars}</script>
<script>
  var A = window.Cocardo.Art;
  var face = A.portrait('cocardo', 'feliz');
  document.querySelectorAll('.tile .face').forEach(function (n) { n.innerHTML = face; });
  document.querySelector('#og .bg').innerHTML = String(A.background('heladeria')).replace(/<text[\\s\\S]*?<\\/text>/g, '');
  document.querySelector('#og .logo').innerHTML = A.logo();
  document.querySelector('#og .hero').innerHTML = A.portrait('cocardo', 'burlon');
</script></body></html>`;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 2200 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const shots = [['#i512', 'icon-512.png'], ['#imask', 'icon-512-maskable.png'], ['#i180', 'apple-touch-icon.png'], ['#i192', 'icon-192.png'], ['#og', 'og.png']];
  for (const [sel, name] of shots) {
    await page.locator(sel).screenshot({ path: path.join(OUT, name), omitBackground: name !== 'og.png' && /512\.png|192/.test(name) });
    console.log('icons/' + name);
  }
  // favicon.svg: el retrato sobre un círculo rosa (un solo archivo, sin dependencias)
  const faceSvg = await page.evaluate(() => window.Cocardo.Art.portrait('cocardo', 'feliz'));
  const inner = faceSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="98" fill="#ff6fa5"/><g transform="translate(12 18) scale(.88)">${inner}</g></svg>`;
  fs.writeFileSync(path.join(OUT, 'favicon.svg'), favicon);
  console.log('icons/favicon.svg');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
