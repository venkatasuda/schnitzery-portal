// Schnitzery Portal — service worker (hand-rolled, conservative).
// Goal: let the app (especially the kiosk) load even if the server is down and
// the device reloads mid-outage. It caches the app shell + immutable static
// assets on visit, and serves them from cache when the network fails.
//
// Safety rules:
//   • GET only — writes/POSTs are never cached.
//   • Same-origin only — Supabase, the QR/font CDNs, etc. always go to network.
//   • API/auth paths are never cached.
//   • Bump CACHE_VERSION to invalidate old caches on the next activate.

const CACHE_VERSION = "schnitzery-v1";
const APP_SHELL = ["/", "/kiosk", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  const copy = response.clone();
  caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
  return response;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                       // never cache writes

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Supabase / QR libs / fonts → network only
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) return;

  // Immutable static assets + icons + manifest → cache-first.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => putInCache(req, res)))
    );
    return;
  }

  // Page navigations → network-first, fall back to cache (the offline cold load).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/kiosk")).then((hit) => hit || caches.match("/")))
    );
    return;
  }

  // Other same-origin GETs → stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((hit) => {
      const fetched = fetch(req).then((res) => putInCache(req, res)).catch(() => hit);
      return hit || fetched;
    })
  );
});
