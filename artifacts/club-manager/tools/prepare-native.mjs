import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const cwd = resolve(import.meta.dirname, "..");
for (const args of [["run","build"],["exec","cap","sync"]]) {
  const result = spawnSync("pnpm", args, { cwd, stdio:"inherit", env:{...process.env,PORT:process.env.PORT || "24124",BASE_PATH:"/",NODE_ENV:"production"} });
  if (result.status !== 0) process.exit(result.status || 1);
}
