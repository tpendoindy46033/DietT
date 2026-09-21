import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { nodeModulesDir, rootDir } from "./paths.mjs";

let cachedBinPath;

export async function resolveWranglerBin() {
  if (cachedBinPath) return cachedBinPath;
  const pkgPath = resolve(nodeModulesDir, "wrangler", "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const binField = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.wrangler;
  cachedBinPath = resolve(nodeModulesDir, "wrangler", binField);
  return cachedBinPath;
}

/** Runs wrangler interactively (stdio inherited) - used for login and secret prompts. */
export async function runWranglerInteractive(args) {
  const binPath = await resolveWranglerBin();
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [binPath, ...args], { stdio: "inherit", cwd: rootDir });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`wrangler ${args.join(" ")} exited with code ${code}`));
    });
    child.on("error", rejectPromise);
  });
}

/** Runs wrangler in the background (detached), for login, so it does not block the caller. */
export async function runWranglerBackground(args) {
  const binPath = await resolveWranglerBin();
  const child = spawn(process.execPath, [binPath, ...args], {
    stdio: "inherit",
    cwd: rootDir,
    detached: true
  });
  child.unref();
  return child;
}

/** Runs wrangler and captures output, for commands whose result we need to parse. */
export async function runWranglerCapture(args) {
  const binPath = await resolveWranglerBin();
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}
