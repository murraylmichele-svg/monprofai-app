// ============================================================
// SW.JS — Service Worker for offline support
// ============================================================

var CACHE_NAME = 'monprofai-v1';
var FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/roster.js',
  '/observations.js',
  '/productions.js',
  '/bulletins.js',
  '/audio-queue.js',
  '/styles.css'
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
