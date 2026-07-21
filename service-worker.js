// Motionz Ledger — minimal service worker
// Purpose: make the app installable (standalone display mode) and let it
// open instantly from the home screen. Data itself always comes live from
// Supabase — this does not cache your ledger data, only the app shell.
const CACHE_NAME = 'motionz-ledger-shell-v2';
const SHELL_FILES = ['./manifest.json', './icon-192.png', './icon-512.png'];
const NETWORK_FIRST_FILES = ['./index.html', './'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const path = url.pathname;

  // index.html: always try the network first so you see updates immediately.
  // Only fall back to whatever's cached if you're genuinely offline.
  const isNetworkFirst = NETWORK_FIRST_FILES.some((f) => path.endsWith(f.replace('./', '')) || path === '/' || path.endsWith('/'));
  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Icons/manifest change rarely — cache-first is fine and faster for these.
  const isShellFile = SHELL_FILES.some((f) => path.endsWith(f.replace('./', '')));
  if (isShellFile) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});

