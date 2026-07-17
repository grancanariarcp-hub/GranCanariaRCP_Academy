// Service worker mínimo: su presencia (con un handler de fetch) es requisito
// para que Chrome/Android ofrezca "Instalar app". Estrategia network-first con
// caché de reserva para que la app abra aun sin conexión.
const CACHE = 'rcp-academy-v1';
const CORE = ['/'];

self.addEventListener('install', (event) => {
  // Precache best-effort: si '/' fallara, el install NO debe fallar (si no,
  // no habría SW activo y Chrome no ofrecería "Instalar app").
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Solo GET de la propia web; el resto (API, otros orígenes) va directo a la red.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
  );
});
