/* Cache only public static assets; never cache sessions, API data, or club records. */
const CACHE = "iraq-alameer-public-v1";
const BASE = new URL("./", self.location.href);
const urlFor = (path) => new URL(path, BASE).href;
const PUBLIC = [
  "offline.html",
  "iraq-alameer-logo.png",
  "favicon.svg",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
].map(urlFor);
const APP_ROUTES = new Set([
  "",
  "dashboard",
  "members",
  "subscriptions",
  "plans",
  "finance",
  "reports",
  "employees",
  "payroll",
  "cash",
  "attendance",
  "settings",
  "admin",
  "account",
  "receipt",
  "sign-in",
  "sign-up",
  "download",
]);

async function offlinePage() {
  return (await caches.match(urlFor("offline.html"))) ||
    new Response("غير متصل بالإنترنت", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith("iraq-alameer-public-") && name !== CACHE) {
        await caches.delete(name);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== BASE.origin ||
    request.headers.has("Authorization")
  ) return;
  if (!url.pathname.startsWith(BASE.pathname)) return;
  const relative = url.pathname.slice(BASE.pathname.length);

  if (request.mode === "navigate") {
    if (!APP_ROUTES.has(relative.split("/")[0])) return;
    event.respondWith(
      self.navigator?.onLine === false
        ? offlinePage()
        : fetch(request, { cache: "no-store" }).catch(offlinePage),
    );
    return;
  }

  if (url.search) return;
  const staticBuildAsset = /^assets\/[^/]+\.(?:js|css|woff2?|png|svg|webp)$/.test(relative);
  if (!PUBLIC.includes(url.href) && !staticBuildAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
