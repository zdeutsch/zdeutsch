const SW_VERSION = "2026-04-24-cache-strategy-v3";
const STATIC_CACHE = `zdeutsch-static-${SW_VERSION}`;
const RUNTIME_CACHE = `zdeutsch-runtime-${SW_VERSION}`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./correction.html",
  "./lesen.html",
  "./horen.html",
  "./shreiben.html",
  "./theme.css",
  "./horen.css",
  "./shared.js",
  "./main.js",
  "./correction.js",
  "./lesen.js",
  "./horen.js",
  "./shreiben.js",
  "./manifest.webmanifest",
  "./logo.svg",
  "./pwa/icon-192.png",
  "./pwa/icon-512.png",
  "./pwa/apple-touch-icon.png"
];
const NETWORK_FIRST_ASSET_PATTERN = /\.(?:css|html|js|webmanifest)$/i;
const DATABASE_ASSET_PATTERN = /\/database\/[^/?#]+\.json$/i;

function cacheResponse(cacheName, request, response) {
  if (!response || (!response.ok && response.type !== "opaque")) {
    return response;
  }
  const responseClone = response.clone();
  caches.open(cacheName).then((cache) => cache.put(request, responseClone));
  return response;
}

async function getCachedResponse(request, { cacheName = RUNTIME_CACHE, ignoreSearch = false } = {}) {
  const cache = await caches.open(cacheName);
  return cache.match(request, { ignoreSearch });
}

function revalidateRequest(request, { cacheName = RUNTIME_CACHE, fetchOptions = {} } = {}) {
  return fetch(request, fetchOptions)
    .then((response) => cacheResponse(cacheName, request, response))
    .catch(() => null);
}

function shouldUseNetworkFirst(request, url) {
  if (request.mode === "navigate") {
    return true;
  }
  return NETWORK_FIRST_ASSET_PATTERN.test(url.pathname || "");
}

function isDatabaseRequest(url) {
  return DATABASE_ASSET_PATTERN.test(url.pathname || "");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isDatabaseRequest(url)) {
    event.respondWith(
      (async () => {
        const cachedResponse = await getCachedResponse(request, {
          cacheName: RUNTIME_CACHE,
          ignoreSearch: true
        });
        const networkPromise = revalidateRequest(request, {
          cacheName: RUNTIME_CACHE,
          fetchOptions: { cache: "no-cache" }
        });

        if (cachedResponse) {
          event.waitUntil(networkPromise);
          return cachedResponse;
        }

        const networkResponse = await networkPromise;
        return networkResponse || new Response(
          JSON.stringify({ error: "Database file is temporarily unavailable." }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-store"
            }
          }
        );
      })()
    );
    return;
  }

  if (shouldUseNetworkFirst(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => cacheResponse(RUNTIME_CACHE, request, response))
        .catch(async () => {
          return caches.match(request, { ignoreSearch: true }) || caches.match("./index.html");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => cacheResponse(RUNTIME_CACHE, request, response))
        .catch(() => caches.match(request, { ignoreSearch: true }).then((cachedResponse) => cachedResponse || caches.match("./index.html")));
    })
  );
});
