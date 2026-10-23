import sharp from "sharp";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const logo = await readFile(resolve(root, "public/logo.svg"));
await mkdir(resolve(root, "public/icons"), { recursive: true });
for (const [file, size] of [["icon-192.png",192],["icon-512.png",512],["apple-touch-icon.png",180]]) {
  await sharp(logo).resize(size,size).png().toFile(resolve(root, "public/icons", file));
}
const androidRes = resolve(root, "android/app/src/main/res");
for (const dir of await readdir(androidRes).catch(() => [])) {
  if (!dir.startsWith("mipmap-") || dir === "mipmap-anydpi-v26") continue;
  for (const name of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) {
    const file = resolve(androidRes, dir, name);
    const meta = await sharp(file).metadata().catch(() => null);
    if (!meta?.width) continue;
    const size = meta.width;
    if (name.includes("foreground")) {
      const inner = await sharp(logo).resize(Math.round(size * .62)).png().toBuffer();
      await sharp({ create: { width:size, height:size, channels:4, background:"#FACC15" } }).composite([{ input:inner, gravity:"centre" }]).png().toFile(file);
    } else await sharp(logo).resize(size,size).png().toFile(file);
  }
}
const iosIcon = resolve(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png");
if (await readFile(iosIcon).catch(() => null)) await sharp(logo).resize(1024,1024).flatten({ background:"#FFFFFF" }).png().toFile(iosIcon);
console.log("Generated PWA and available native icons from the existing academy logo.");
