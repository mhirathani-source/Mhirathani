import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import vm from "node:vm";
import ts from "typescript";
const root=resolve(import.meta.dirname,"..");
const read=path=>readFile(resolve(root,path),"utf8");
const manifest=JSON.parse(await read("public/manifest.json"));
assert.equal(manifest.display,"standalone");assert.equal(manifest.dir,"rtl");assert.equal(manifest.lang,"ar");
assert.equal(manifest.name,"Prime Boxing Academy");assert.equal(manifest.short_name,"Prime");
assert.equal(manifest.theme_color,"#FFC107");
assert.equal(manifest.start_url,"./");assert.equal(manifest.scope,"./");
for(const size of [192,512]){
  assert.ok(manifest.icons.find(icon=>icon.sizes===`${size}x${size}`));
  const png=await readFile(resolve(root,`public/icons/icon-${size}.png`));
  assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
}
const publicSite={};
vm.runInNewContext(ts.transpileModule(await read("src/lib/public-site.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
  exports:publicSite,URL,window:{location:{protocol:"https:",origin:"https://Prime1academy.replit.app"}},
});
assert.equal(publicSite.securePortalUrl(),"https://prime1academy.replit.app/");
assert.equal(publicSite.publicDownloadUrl(),"https://prime1academy.replit.app/download");
const callbacks=new Map();
const exported={};
vm.runInNewContext(ts.transpileModule(await read("src/lib/install.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
  exports:exported,window:{addEventListener:(name,fn)=>callbacks.set(name,fn)},Set,
});
let notified=0,prevented=false;
exported.subscribeInstallPrompt(()=>notified++);
const prompt={preventDefault(){prevented=true;}};
callbacks.get("beforeinstallprompt")(prompt);
assert.equal(prevented,true);assert.equal(exported.getInstallPrompt(),prompt);assert.equal(notified,1);
exported.clearInstallPrompt();assert.equal(exported.getInstallPrompt(),null);
const handlers=new Map();
const worker=await read("public/service-worker.js");
vm.runInNewContext(worker,{URL,Set,Response,
  self:{location:{href:"https://prime-boxing-academy.replit.app/service-worker.js"},navigator:{onLine:true},addEventListener:(name,fn)=>handlers.set(name,fn)},
});
for(const path of ["api/club/finance/report","api/club/session","__clerk/v1/client","prime-v2/"]){
  let intercepted=false;
  handlers.get("fetch")({request:{url:`https://prime-boxing-academy.replit.app/${path}`,method:"GET",mode:"navigate",headers:new Headers()},respondWith(){intercepted=true;}});
  assert.equal(intercepted,false,`must not intercept ${path}`);
}
assert.match(await read("capacitor.config.ts"),/appId:\s*'com\.primeboxingacademy\.app'/);
assert.match(await read("capacitor.config.ts"),/url:\s*'https:\/\/prime-boxing-academy\.replit\.app\/'/);
assert.doesNotMatch(await read("src/main.tsx"),/NativePortal/);
console.log("Mobile checks passed: manifest, PNG dimensions, runtime HTTPS links, early install prompt, private-route isolation, hosted native configuration.");
