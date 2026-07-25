// Schnitzery Portal — service worker (hand-rolled, conservative).
// Goal: let the KIOSK screen load even if the server is down and the device
// reloads mid-outage. It caches a small public/kiosk app shell plus immutable
// static assets, and serves those from cache when the network fails.
//
// Safety rules:
//   • GET only — writes/POSTs are never cached.
//   • Same-origin only — Supabase, the QR/font CDNs, etc. always go to network.
//   • API/auth paths are never cached.
//   • ONLY the routes in CACHEABLE_PAGES are ever stored. Every other page —
//     anything behind the (app) layout — is network-only and is never written
//     to the cache. See the note below.
//   • Only 200/basic responses are stored, and never ones marked no-store/private.
//   • Bump CACHE_VERSION to invalidate old caches on the next activate.
//
// ── WHY PAGES ARE NO LONGER CACHED BY DEFAULT ───────────────────────────────
// v1 cached EVERY navigation response unconditionally. On a shared device (a
// kiosk tablet, the back-office iPad) that meant one employee's rendered
// /timesheet, /payroll or /staff/[id] HTML — with their personal data in it —
// sat in the Cache API and could be served to the NEXT person to use that
// device during any network blip. The cache also survived logout entirely.
// If you need a new route to work offline, add it to CACHEABLE_PAGES *only*
// after confirming it renders nothing user-specific.
// ────────────────────────────────────────────────────────────────────────────

const CACHE_VERSION = "schnitzery-v3";

// Routes safe to serve to any user of a shared device.
// "/" is deliberately ABSENT — it is the authenticated home page.
const CACHEABLE_PAGES = ["/kiosk", "/login"];

const APP_SHELL = [
  "/kiosk",
  "/login",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

function isCacheablePage(pathname) {
  return CACHEABLE_PAGES.includes(pathname);
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // Individually, NOT cache.addAll — addAll is atomic, so a single missing
      // asset (the icons, historically) rejected the whole call and left the
      // cache completely empty while the .catch() hid the failure.
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[sw] precache skipped:", url, err && err.message);
          })
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Store a response only if it is genuinely safe and useful to replay later.
function putInCache(request, response) {
  try {
    if (!response || !response.ok || response.status !== 200) return response;
    if (response.type !== "basic") return response;   // opaque/cors/redirect → skip

    const cc = (response.headers.get("Cache-Control") || "").toLowerCase();
    if (cc.includes("no-store") || cc.includes("private")) return response;

    const copy = response.clone();
    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
  } catch {
    /* caching must never break the response */
  }
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

  // Page navigations.
  if (req.mode === "navigate") {
    // Not on the allowlist → straight to the network, and never cached.
    // No cross-route cache fallback either: serving a cached /kiosk in place of
    // a failed /payroll is how the wrong person's page ends up on screen.
    if (!isCacheablePage(url.pathname)) return;

    event.respondWith(
      fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/kiosk")))
    );
    return;
  }

  // Other same-origin GETs (RSC payloads, data requests) → network-only.
  // These carry user-specific rendered output just like pages do.
});

// ── Push notifications ───────────────────────────────────────────────────────
// Shows a notification when the server pushes one. Payload shape is set by
// sendPushToUser() in src/lib/push/actions.ts: { title, body, url }.
self.addEventListener("push", (event) => {
  let data = { title: "Schnitzery", body: "", url: "/" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

// Focus an existing tab on the target route, or open one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if (c.url.includes(url) && "focus" in c) return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
