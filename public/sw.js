const CACHE_NAME = "collection-app-v0-3";
const IMAGE_CACHE_NAME = "collection-app-images-v0-1";
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const withScope = (path) => `${SCOPE_PATH}${path}`;
const APP_SHELL = [withScope("/"), withScope("/manifest.webmanifest"), withScope("/icons/icon.svg")];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => ![CACHE_NAME, IMAGE_CACHE_NAME].includes(key)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (event.request.destination === "image") {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) {
            return cached;
          }

          return fetch(event.request)
            .then((response) => {
              cache.put(event.request, response.clone()).catch(() => undefined);
              return response;
            })
            .catch((error) => caches.match(event.request).then((fallback) => fallback || Promise.reject(error)))
        })
      )
    );
    return;
  }

  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith("/rest/") || requestUrl.pathname.startsWith("/auth/")) {
    return;
  }

  if (event.request.mode === "navigate" || requestUrl.pathname === withScope("/") || requestUrl.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match(withScope("/"))))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(withScope("/")));
    })
  );
});
