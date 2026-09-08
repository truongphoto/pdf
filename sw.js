const CACHE_VERSION = 'qr-tham-dinh-v21-silent-pdf';
const APP_SHELL = [
  './', './index.html', './styles.css?v=19', './app.js?v=19', './manifest.json',
  './assets/brand-truong-gpp.png', './assets/favicon-y-te-32.png',
  './assets/apple-touch-icon.png', './assets/app-icon-192.png', './assets/app-icon-512.png',
  './assets/app-icon-maskable-512.png', './assets/so-do-dia-diem-template.png',
  './assets/icons/y-te.svg', './assets/icons/quay-thuoc.svg', './assets/icons/nha-thuoc.svg',
  './assets/icons/cong-ty-duoc.svg', './assets/icons/phong-kham.svg', './assets/icons/benh-vien.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then(cache => cache.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.ok) caches.open(CACHE_VERSION).then(cache => cache.put(req, res.clone()));
      return res;
    })));
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
