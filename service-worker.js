const CACHE='j-stadium-v34';
const FILES=['./','./index.html','./firebase-config.js?v=34','./stadium-details.js?v=34','./firebase-shared.js?v=34','./app.js?v=34','./schedule.js?v=34','./schedule.json','./manifest.json?v=23','./apple-touch-icon.png?v=23','./icon-192.png?v=23','./icon-512.png?v=23'];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('j-stadium-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html'))));
});
