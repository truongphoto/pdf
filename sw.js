const CACHE_VERSION = 'qr-tham-dinh-v25-one-map';
const APP_SHELL = [
  './','./index.html','./styles.css?v=25','./app.js?v=25','./v25.js?v=25','./manifest.json',
  './assets/brand-truong-gpp.png','./assets/favicon-y-te-32.png','./assets/apple-touch-icon.png',
  './assets/app-icon-192.png','./assets/app-icon-512.png','./assets/app-icon-maskable-512.png','./assets/so-do-dia-diem-template.png',
  './assets/icons/y-te.svg','./assets/icons/quay-thuoc.svg','./assets/icons/nha-thuoc.svg','./assets/icons/cong-ty-duoc.svg','./assets/icons/phong-kham.svg','./assets/icons/benh-vien.svg'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_VERSION).then(c=>c.addAll(APP_SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==self.location.origin)return;
  const fresh=r.mode==='navigate'||/\.(?:js|css|html)$/.test(u.pathname);
  if(fresh){e.respondWith(fetch(r).then(res=>{if(res&&res.ok)caches.open(CACHE_VERSION).then(c=>c.put(r,res.clone()));return res}).catch(()=>caches.match(r).then(x=>x||caches.match('./index.html'))));return}
  e.respondWith(caches.match(r).then(x=>x||fetch(r).then(res=>{if(res&&res.ok)caches.open(CACHE_VERSION).then(c=>c.put(r,res.clone()));return res})));
});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
