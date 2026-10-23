/* Only public code/assets. Never cache HTML sessions, API, auth, finance, or other apps. */
const CACHE = "prime-academy-public-v1";
const BASE = new URL("./", self.location.href);
const urlFor = path => new URL(path, BASE).href;
const PUBLIC = ["offline.html", "logo.svg", "favicon.svg", "manifest.json", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"].map(urlFor);
const MAIN_ROUTES = new Set(["", "download", "app", "dashboard", "members", "subscriptions", "plans", "finance", "reports", "employees", "payroll", "cash", "attendance", "reminders", "whatsapp", "settings", "admin", "account", "receipt", "sign-in", "sign-up"]);
async function offlinePage() {
  const offline = await caches.match(urlFor("offline.html"));
  return offline || new Response("غير متصل بالإنترنت", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC)));
  // No skipWaiting: never force an update over a financial form in another tab.
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("prime-academy-public-") && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== BASE.origin || req.headers.has("Authorization")) return;
  const relative = url.pathname.slice(BASE.pathname.length);
  if (!url.pathname.startsWith(BASE.pathname)) return;
  if (req.mode === "navigate") {
    if (!MAIN_ROUTES.has(relative.split("/")[0])) return; // v2/other artifacts bypass this worker.
    // A browser HTTP-cache copy of the SPA HTML is not a working offline app:
    // it can reference uncached modules and otherwise render a blank page.
    event.respondWith(self.navigator?.onLine === false
      ? offlinePage()
      : fetch(req, { cache: "no-store" }).catch(offlinePage));
    return;
  }
  if (url.search) return;
  const builtAsset = /^assets\/[^/]+\.(?:js|css|woff2?|png|svg|webp)$/.test(relative);
  if (!PUBLIC.includes(url.href) && !builtAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    const response = await fetch(req);
    if (response.ok && response.type === "basic") await cache.put(req, response.clone());
    return response;
  })());
});
