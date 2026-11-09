// Démarrage rapide et usage hors connexion, même avec un réseau capricieux.
const VERSION = 'v2';
const SHELL = `nm-shell-${VERSION}`, DATA = `nm-data-${VERSION}`;
const NAV_TIMEOUT = 3500;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['./', './manifest.webmanifest', './icon-192.png'])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== SHELL && k !== DATA) await caches.delete(k);
  await self.clients.claim();
})()));

/** Range une réponse ; si la place manque, libère les ressources les plus anciennes. */
async function store(cache, req, res) {
  try { await cache.put(req, res); }
  catch {
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, 40).map((k) => cache.delete(k)));
    try { await cache.put(req, res); } catch { /* tant pis, la ressource reste téléchargeable */ }
  }
}

async function cacheFirst(name, req) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await store(cache, req, res.clone());
  return res;
}

async function page(req) {
  const cache = await caches.open(SHELL);
  const network = fetch(req).then(async (res) => { if (res.ok) await store(cache, './', res.clone()); return res; });
  const cached = await cache.match('./');
  if (!cached) return network;
  // Réseau lent : on affiche la version déjà connue, la nouvelle sera prête la prochaine fois.
  const timeout = new Promise((r) => setTimeout(() => r(cached), NAV_TIMEOUT));
  return Promise.race([network.catch(() => cached), timeout]);
}

self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (e.request.mode === 'navigate') { e.respondWith(page(e.request)); return; }
  if (/\/assets\//.test(u.pathname)) { e.respondWith(cacheFirst(SHELL, e.request)); return; }
  if (/\/(models|models-s|textures|textures-s|hdri|thumbs)\//.test(u.pathname)) { e.respondWith(cacheFirst(DATA, e.request)); return; }
  e.respondWith(cacheFirst(SHELL, e.request));
});
