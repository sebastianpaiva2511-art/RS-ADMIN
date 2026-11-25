/* RS Admin – service worker (seguro: nunca toca Firebase ni los datos). */
const VERSION = "rs-admin-v2";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
const CDN = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net", "unpkg.com", "www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function guardar(req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    const copia = res.clone();
    caches.open(VERSION).then(function (c) { c.put(req, copia); }).catch(function () {});
  }
  return res;
}

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.search.indexOf("rs_ping") !== -1) return; // prueba de internet: siempre va a la red real
  const mismoOrigen = url.origin === self.location.origin;
  const esCdn = CDN.indexOf(url.hostname) !== -1;
  if (!mismoOrigen && !esCdn) return; // Firebase, APIs, etc.: pasan directo, sin tocar

  // La página y archivos propios: primero internet (siempre ves la versión nueva); sin internet, la guardada.
  if (mismoOrigen) {
    e.respondWith(fetch(req).then(function (r) { return guardar(req, r); }).catch(function () {
      return caches.match(req).then(function (m) { return m || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()); });
    }));
    return;
  }
  // Librerías externas: la guardada al instante y se refresca por detrás.
  e.respondWith(caches.match(req).then(function (m) {
    const red = fetch(req).then(function (r) { return guardar(req, r); }).catch(function () { return m; });
    return m || red;
  }));
});
