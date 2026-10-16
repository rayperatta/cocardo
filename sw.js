/* Cocardo: ¡Rescate Helado! — Service worker: el juego abre sin conexión y se instala como app.
 * Estrategia: red primero (siempre la versión nueva si hay internet) y caché como respaldo. Solo se cachean
 * los archivos del juego y las fuentes; nunca las llamadas a Firebase/Analytics. Cambia VERSION al publicar. */
'use strict';
var VERSION = 'cocardo-v1.1.0';
var CORE = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css', './css/game.css',
  './js/core/rng.js', './js/core/engine.js', './js/core/levels.js', './js/core/daily.js', './js/core/progress.js',
  './js/story.js', './js/art.js', './js/art-characters.js', './js/audio.js', './js/save.js', './js/fx.js', './js/render.js',
  './js/game.js', './js/cloud-config.js', './js/cloud.js', './js/analytics.js', './js/clip.js', './js/ui.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/favicon.svg',
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () { /* opcional */ }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function cacheable(url) {
  if (url.origin === self.location.origin) return true;
  return /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
}

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (!cacheable(url)) return;   // Firebase, Analytics, etc.: directo a la red
  ev.respondWith(fetch(req).then(function (res) {
    if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put(req, copy); }).catch(function () { /* nada */ });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: url.origin === self.location.origin }).then(function (hit) {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    });
  }));
});
