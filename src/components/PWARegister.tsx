"use client";

import { useEffect } from "react";

// Registers the service worker once, after load. Renders nothing.
export default function PWARegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Development assets reuse URLs; an old worker can replay obsolete CSS/JS.
    if (process.env.NODE_ENV === "development") {
      const cleanDevelopmentWorker = async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        let removed = false;
        for (const registration of registrations) {
          const worker = registration.active || registration.waiting || registration.installing;
          if (worker?.scriptURL === new URL("/sw.js", window.location.origin).href) {
            removed = await registration.unregister() || removed;
          }
        }
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("schnitzery-")).map((key) => caches.delete(key)));
        if (removed && navigator.serviceWorker.controller?.scriptURL === new URL("/sw.js", window.location.origin).href) window.location.reload();
      };
      cleanDevelopmentWorker().catch(() => { /* Development remains usable without worker cleanup. */ });
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* SW optional; ignore */ });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
