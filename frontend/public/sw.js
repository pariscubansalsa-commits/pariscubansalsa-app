/* Paris Cuban Salsa — Service Worker (defensive / asset-only mode).
 *
 * IMPORTANT: This SW NEVER intercepts API requests, NEVER intercepts
 * cross-origin requests, NEVER serves cached responses for navigation
 * (always goes to network for HTML).
 *
 * It only caches genuine static assets (JS bundle, CSS, fonts, icons, images)
 * to make the app feel snappy after first load. Anything else falls through
 * to the browser's default behavior.
 */

const CACHE_VERSION = "pcs-v2.0.0";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_ASSETS = [
  "/manifest.json",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// File extensions we are willing to cache (static assets only)
const CACHEABLE_EXT = /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)(?:\?.*)?$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 1. Only handle GET. Everything else (POST, PUT, DELETE) passes through.
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }

  // 2. Cross-origin requests (e.g. api.pariscubansalsa.com, Railway, GA,
  //    Google Auth) — NEVER intercept. Let the browser handle them.
  if (url.origin !== self.location.origin) return;

  // 3. API requests — NEVER intercept. Pass through to the network.
  //    (Belt-and-suspenders even though api should be cross-origin.)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/api-")) {
    return;
  }

  // 4. Navigation (HTML pages) — NEVER serve from cache. Always go to network
  //    so the user gets the latest deployment. If offline, fall back to
  //    /offline.html.
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/offline.html")),
    );
    return;
  }

  // 5. Static asset? Cache-first with network update.
  if (CACHEABLE_EXT.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            if (res && res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      }),
    );
    return;
  }

  // 6. Anything else — pass through (no SW involvement).
});

/* Allow the page to ask the SW to update or self-destruct.
 * Useful during dev / after major deploys. */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "CLEAR_CACHES") {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});
