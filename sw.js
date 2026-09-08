const CACHE_VERSION = 'qr-tham-dinh-v26-google-preview-stable';
const APP_SHELL = [
  './', './index.html', './styles.css?v=26', './app.js?v=26', './v26.js?v=26', './manifest.json',
  './assets/brand-truong-gpp.png', './assets/favicon-y-te-32.png',
  './assets/apple-touch-icon.png', './assets/app-icon-192.png', './assets/app-icon-512.png',
  './assets/app-icon-maskable-512.png', './assets/so-do-dia-diem-template.png',
  './assets/icons/y-te.svg', './assets/icons/quay-thuoc.svg', './assets/icons/nha-thuoc.svg',
  './assets/icons/cong-ty-duoc.svg', './assets/icons/phong-kham.svg', './assets/icons/benh-vien.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isFreshCode = req.mode === 'navigate' || /\.(?:js|css|html)$/.test(url.pathname);
  if (isFreshCode) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) caches.open(CACHE_VERSION).then(cache => cache.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.ok) caches.open(CACHE_VERSION).then(cache => cache.put(req, res.clone()));
      return res;
    }))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
