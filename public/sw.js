const CACHE_NAME = "ladresse-cache-v3";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];
const STATIC_PREFIXES = ["/_next/static/", "/icon.svg", "/manifest.webmanifest"];

// Espaces staff : jamais mis en cache ni servis hors-ligne, pour qu'un client
// ne puisse jamais tomber sur une page cuisine/admin figée en cache.
const STAFF_PREFIXES = ["/admin", "/cuisine", "/proprio", "/serveur", "/staff"];

function isStaffPath(pathname) {
  return STAFF_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // Staff routes: always network, never cache, never offline fallback.
  if (isStaffPath(requestUrl.pathname)) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const fallback = await caches.match("/");
        return fallback || Response.error();
      }),
    );
    return;
  }

  const isStaticAsset = STATIC_PREFIXES.some((prefix) => requestUrl.pathname.startsWith(prefix));
  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response.ok) {
            return response;
          }
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        });
    }),
  );
});
