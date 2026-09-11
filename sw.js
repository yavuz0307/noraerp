/* NoraCAD ERP — Service Worker
   Amaç: uygulamayı "kurulabilir" yapmak + çevrimdışıyken en son açılan ekranı gösterebilmek.
   Strateji: sayfa (HTML) için ÖNCE İNTERNET (network-first) → böylece güncelleme yaptığında
   herkes en yeni sürümü görür; internet yoksa önbellekteki son sürüme düşer.
   İkonlar için önbellek yeterli. Veriler zaten Supabase'den (canlı) gelir. */

const CACHE = "noracad-erp-v1";
const SHELL = ["./", "./index.html", "./icon-192.png", "./icon-512.png", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Supabase / diğer dış istekler: dokunma, doğrudan internete gitsin
  if (url.origin !== self.location.origin) return;

  // Sayfa gezintisi (HTML): önce internet, olmazsa önbellek
  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Statik dosyalar (ikon vb.): önce önbellek, yoksa internet
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});
