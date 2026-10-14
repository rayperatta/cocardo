#!/usr/bin/env node
// Herramienta de desarrollo: captura de pantalla de una página con Chromium (Playwright).
// Uso: node tools/shot.cjs <url|archivo> <salida.png> [ancho] [alto] [esperaMs] [scriptJS]
//   scriptJS (opcional): código que se evalúa en la página antes de la captura.
// Imprime los errores de consola de la página.
const path = require('path');
function loadPlaywright() {
  for (const p of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright']) {
    if (!p) continue;
    try { return require(p); } catch (e) { /* siguiente */ }
  }
  throw new Error('No se encontró playwright (define PLAYWRIGHT_MODULE)');
}
(async () => {
  const [target, out, w = '390', h = '844', wait = '800', script] = process.argv.slice(2);
  if (!target || !out) { console.error('uso: node tools/shot.cjs <url|archivo> <salida.png> [ancho] [alto] [esperaMs] [scriptJS]'); process.exit(2); }
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const width = +w, height = +h;
  const mobile = width < 700;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, hasTouch: mobile, isMobile: mobile });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  const url = /^https?:|^file:/.test(target) ? target : 'file://' + path.resolve(target);
  await page.goto(url);
  await page.waitForTimeout(+wait);
  if (script) { const r = await page.evaluate(script); if (r !== undefined) console.log('eval:', JSON.stringify(r)); await page.waitForTimeout(+wait); }
  await page.screenshot({ path: out });
  await browser.close();
  console.log(errors.length ? errors.join('\n') : 'sin errores de consola');
})().catch(e => { console.error(e); process.exit(1); });
