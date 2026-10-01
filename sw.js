// 离线缓存：联网时用最新版本，断网时用缓存。
// 修改资源列表时把 CACHE 版本号加一，旧缓存会被清掉。
const CACHE = 'lowbar-v3';
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

// 联网时总是取最新版本并更新缓存；断网时才用缓存。
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      return (await cache.match(req, { ignoreSearch: true })) || cache.match('./index.html');
    }
  })());
});
