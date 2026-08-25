const CACHE_NAME = "dnp-shell-v2";
const SHELL_FILES = [
  "/",
  "/css/style.css",
  "/js/ws.js",
  "/js/hpStatus.js",
  "/js/render.js",
  "/js/app.js",
  "/fonts/PressStart2P-Regular.ttf",
  "/fonts/VT323-Regular.ttf",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  const isDynamic =
    url.pathname.startsWith("/ws/") ||
    url.pathname.startsWith("/campaigns") ||
    url.pathname.startsWith("/characters") ||
    url.pathname.startsWith("/connection-");

  if (isDynamic || event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
