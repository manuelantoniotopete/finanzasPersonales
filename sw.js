/* Mis Finanzas — Service Worker
   Estrategia:
   - Navegación (HTML): network-first, con index.html cacheado como respaldo offline.
   - Resto (CSS/JS/iconos/CDN): cache-first, poblando cache en segundo plano.
   Sube CACHE_VERSION cuando cambies archivos del shell para forzar actualización. */
const CACHE_VERSION = "finanzas-v6";

// Críticos del mismo origen (si alguno falla, la instalación falla → se reintenta).
const CORE = [
  "./",
  "./index.html",
  "./css/styles.css?v=6",
  "./js/app.js?v=7",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];
// Dependencia externa (tolerante: si el CDN falla, no rompe la instalación).
const CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(CORE);
    try { await cache.add(CDN); } catch (e) { /* sin red al instalar: se cacheará al usarse */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // HTML / navegación: network-first para no quedar pegado a un shell viejo.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put("./index.html", res.clone());
        return res;
      } catch (e) {
        return (await caches.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // Resto: cache-first con relleno en segundo plano.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
