import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { rootDir, nodeModulesDir } from "./paths.mjs";

async function resolveBin(packageName, binName) {
  const pkgPath = resolve(nodeModulesDir, packageName, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const binField = typeof pkg.bin === "string" ? pkg.bin : pkg.bin[binName];
  return resolve(nodeModulesDir, packageName, binField);
}

export async function typecheck(target) {
  const configFile = target === "worker" ? "tsconfig.worker.json" : "tsconfig.frontend.json";
  const tscPath = await resolveBin("typescript", "tsc");

  const result = spawnSync(process.execPath, [tscPath, "--project", resolve(rootDir, configFile)], {
    stdio: "inherit",
    cwd: rootDir
  });

  if (result.status !== 0) {
    throw new Error(`Type checking failed for ${target}.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2];
  typecheck(target)
    .then(() => console.log(`Type check passed: ${target}`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
