// Garde l'application et les ressources 3D déjà vues pour un usage hors connexion.
const CACHE = 'notre-maison-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const heavy = /\/(models|textures|hdri|thumbs)\//.test(u.pathname);
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (heavy) {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    }
    try { const r = await fetch(e.request); if (r.ok) c.put(e.request, r.clone()); return r; }
    catch { return (await c.match(e.request)) || Response.error(); }
  })());
});
