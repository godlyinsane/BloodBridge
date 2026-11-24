/* BloodBridge low-network shell cache.
 * Cache only public static app files. Never cache API responses or donor/patient data.
 */
const CACHE_NAME = "bloodbridge-shell-v1";
const SHELL_URLS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_URLS);
    // CRA emits hashed JS/CSS paths. Cache those shell assets so the offline
    // HTML can still render after a successful first online visit.
    try {
      const response = await fetch("/", { cache: "reload" });
      if (response.ok) {
        const html = await response.clone().text();
        const assets = new Set();
        for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
          const path = match[1];
          if (!path || !path.includes("/static/")) continue;
          const url = new URL(path, self.location.origin);
          if (url.origin === self.location.origin && /\.(?:js|css)$/.test(url.pathname)) assets.add(url.href);
        }
        await Promise.all([...assets].map(async (url) => {
          try { const asset = await fetch(url); if (asset.ok) await cache.put(url, asset); } catch (_) {}
        }));
      }
    } catch (_) {
      // The base shell cache remains usable even if an optional asset fails.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("bloodbridge-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept API calls, non-GET requests, or cross-origin requests.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put("/", response.clone()));
        return response;
      }).catch(async () => (await caches.match("/")) || Response.error())
    );
    return;
  }

  // Network-first for JS/CSS: use fresh bundles when online, cached bundles
  // when offline. This is only for static assets, never private API payloads.
  if (url.pathname.includes("/static/") && /\.(?:js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      }).catch(async () => (await caches.match(request)) || Response.error())
    );
    return;
  }

  if (url.pathname === "/manifest.json") {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
