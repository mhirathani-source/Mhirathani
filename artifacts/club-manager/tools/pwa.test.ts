import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { securePortalUrl } from "../src/lib/public-site";

const root = new URL("../", import.meta.url);
const text = (path: string) => readFile(new URL(path, root), "utf8");
const workerCode = await text("public/service-worker.js");

function worker() {
  const listeners: Record<string, (e: any) => void> = {};
  const requests: { url: string; cache?: RequestCache }[] = [];
  const cached: string[] = [];
  const values = new Map<string, Response>();
  const cache = {
    addAll: async (urls: string[]) => { cached.push(...urls); },
    match: async () => undefined,
    put: async (req: Request, response: Response) => { values.set(req.url, response); },
  };
  const context = {
    URL, Response, Set,
    self: { navigator:{onLine:true}, location: { href:"https://club.example/service-worker.js" }, clients: { claim:async () => {} }, addEventListener:(name:string,fn:any) => { listeners[name] = fn; } },
    caches: { open:async () => cache, keys:async () => [], delete:async () => true, match:async () => new Response("safe-offline") },
    fetch:async (req:Request, options?:RequestInit) => { requests.push({url:req.url,cache:options?.cache}); throw new Error("offline"); },
  };
  vm.runInNewContext(workerCode, context);
  return { listeners, requests, cached, values, context };
}

test("manifest and actual PNGs meet installation requirements", async () => {
  const manifest = JSON.parse(await text("public/manifest.json"));
  assert.equal(manifest.name, "Prime Boxing Academy");
  assert.equal(manifest.short_name, "Prime Academy");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#FACC15");
  assert.equal(manifest.background_color, "#FFFFFF");
  for (const size of [192,512]) {
    const png = await readFile(new URL(`public/icons/icon-${size}.png`, root));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});

test("offline precache includes public resources, never app HTML or user data", async () => {
  const w = worker(); let pending:Promise<unknown> = Promise.resolve();
  w.listeners.install({ waitUntil:(p:Promise<unknown>) => { pending=p; } });
  await pending;
  assert.equal(w.cached.length, 7);
  assert.ok(w.cached.some(url => url.endsWith("/offline.html")));
  assert.ok(w.cached.every(url => !/api|index\.html|sign-in|finance|members|clerk/.test(url)));
});

test("API, auth, mutations and other artifacts never enter the cache handler", () => {
  const w = worker();
  for (const [url, method, mode, authorization] of [
    ["https://club.example/api/club/session","GET","cors",""],
    ["https://club.example/api/club/finance/report","GET","cors",""],
    ["https://club.example/api/members","POST","cors",""],
    ["https://clerk.example/client","GET","cors",""],
    ["https://club.example/prime-v2/","GET","navigate",""],
    ["https://club.example/assets/a.js?token=x","GET","cors",""],
    ["https://club.example/assets/a.js","GET","cors","Bearer secret-test-value"],
  ]) {
    let handled = false;
    w.listeners.fetch({ request:{url,method,mode,headers:new Headers(authorization ? {Authorization:authorization} : {})}, respondWith:() => { handled=true; } });
    assert.equal(handled, false, url);
  }
  assert.equal(w.values.size, 0);
  assert.ok(w.requests.every(request => request.cache === "no-store"));
});

test("an explicitly offline browser skips the HTTP cache and network entirely", async () => {
  const w = worker();
  w.context.self.navigator.onLine = false;
  let pending:Promise<Response> | undefined;
  w.listeners.fetch({ request:{url:"https://club.example/dashboard",method:"GET",mode:"navigate",headers:new Headers()}, respondWith:(p:Promise<Response>) => { pending=p; } });
  assert.ok(pending);
  assert.equal(await (await pending).text(), "safe-offline");
  assert.equal(w.requests.length, 0);
});

test("offline navigation returns safe fallback and never caches authenticated HTML", async () => {
  const w = worker();
  for (const url of ["https://club.example/", "https://club.example/members/123", "https://club.example/sign-in?redirect_url=%2Fdashboard"]) {
    let pending:Promise<Response> | undefined;
    w.listeners.fetch({ request:{url,method:"GET",mode:"navigate",headers:new Headers()}, respondWith:(p:Promise<Response>) => { pending=p; } });
    assert.ok(pending);
    assert.equal(await (await pending).text(), "safe-offline");
  }
  assert.equal(w.values.size, 0);
});

test("native and public entry points use HTTPS and explicitly deny cleartext", async () => {
  assert.equal(new URL(securePortalUrl()).protocol, "https:");
  const android = await text("android/app/src/main/AndroidManifest.xml");
  const security = await text("android/app/src/main/res/xml/network_security_config.xml");
  const ios = await text("ios/App/App/Info.plist");
  assert.match(android, /android:usesCleartextTraffic="false"/);
  assert.match(android, /networkSecurityConfig="@xml\/network_security_config"/);
  assert.match(security, /cleartextTrafficPermitted="false"/);
  assert.match(ios, /NSAllowsArbitraryLoads<\/key>\s*<false\/>/);
  assert.match(ios, /NSAllowsArbitraryLoadsInWebContent<\/key>\s*<false\/>/);
});
