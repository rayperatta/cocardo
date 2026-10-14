#!/usr/bin/env node
// Genera una versión de un solo archivo del juego (todo el CSS y JS en línea).
// Uso: node tools/build-single.cjs [salida]            -> por defecto dist/cocardo.html (documento completo)
//      node tools/build-single.cjs --fragment [salida]  -> sin <!doctype>/<html>/<head>/<body> (para publicar como artifact)
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const outArg = args.filter(a => !a.startsWith('--'))[0];
const out = path.resolve(root, outArg || (fragment ? 'dist/cocardo-fragment.html' : 'dist/cocardo.html'));

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// <link rel="stylesheet" href="css/...">  ->  <style>…</style>  (los enlaces externos, p. ej. Google Fonts, se quedan)
html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, tag => {
  const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1];
  if (!href || /^https?:/i.test(href)) return tag;
  const css = fs.readFileSync(path.join(root, href), 'utf8');
  return `<style>/* ${href} */\n${css}\n</style>`;
});

// <script src="js/..."></script>  ->  <script>…</script>
html = html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, pre, src) => {
  if (/^https?:/i.test(src)) return tag;
  const js = fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>/* ${src} */\n${js}\n</script>`;
});

if (fragment) {
  // El publicador de artifacts envuelve la página en su propio esqueleto: quitamos el nuestro.
  const title = (html.match(/<title>[\s\S]*?<\/title>/i) || [''])[0];
  const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || ['', ''])[1]
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/<title>[\s\S]*?<\/title>/i, '');
  // index.html no debe llevar atributos en <body> (el esqueleto del artifact no los conservaría).
  const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || ['', html])[1];
  html = `${title}\n${head.trim()}\n${body.trim()}\n`;
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${path.relative(root, out)}: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
