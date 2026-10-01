// 离线缓存：先返回缓存，同时后台更新（下次打开即是新版本）。
// 修改资源列表时把 CACHE 版本号加一，旧缓存会被清掉。
const CACHE = 'lowbar-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './core.js',
  './plan.js',
  './storage.js',
  './manifest.json',
  './icon.svg',
  './apple-touch-icon.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req)
      .then((res) => {
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
      .catch(() => cached || cache.match('./index.html'));
    if (cached) {
      e.waitUntil(network);
      return cached;
    }
    return network;
  })());
});
