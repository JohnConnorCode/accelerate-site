/* Command Center service worker. Keep this file deliberately small and explicit. */
const CACHE_NAME = "accelerate-command-center-v1";
const OFFLINE_URL = "/command-center-offline.html";
const STATIC_DESTINATIONS = new Set(["script", "style", "font", "image"]);

function isWorkspacePath(pathname) {
  return (
    pathname === "/workspace" ||
    pathname.startsWith("/admin") ||
    /^\/t\/[a-z0-9]+(?:-[a-z0-9]+)*\/admin(?:\/|$)/.test(pathname)
  );
}

function isNetworkOnlyPath(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/admin/login" ||
    pathname === "/admin/update-password" ||
    pathname.startsWith("/_next/data/")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("accelerate-command-center-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_WORKSPACE_CACHE") {
    // The fallback contains no account data and must survive sign-out offline.
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        for (const request of await cache.keys()) {
          if (new URL(request.url).pathname !== OFFLINE_URL) await cache.delete(request);
        }
      }),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isNetworkOnlyPath(url.pathname)) return;

  if (request.mode === "navigate" && isWorkspacePath(url.pathname)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  if (
    STATIC_DESTINATIONS.has(request.destination) &&
    (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/command-center-icon"))
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
  }
});
