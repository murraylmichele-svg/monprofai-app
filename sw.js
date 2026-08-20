// ============================================================
// SW.JS — Service Worker for offline support
// ============================================================

var CACHE_NAME = 'monprofai-v41';
var BASE = '/monprofai-app/';
var FILES_TO_CACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'app.js',
  BASE + 'roster.js',
  BASE + 'observations.js',
  BASE + 'productions.js',
  BASE + 'bulletins.js',
  BASE + 'audio-queue.js',
  BASE + 'styles.css',
  BASE + 'heic2any.min.js',
  BASE + 'xlsx.full.min.js'
];
// Install: cache all app files
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) {
          return key !== CACHE_NAME;
        }).map(function(key) {
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(response) {
      return response || fetch(e.request);
    })
  );
});
