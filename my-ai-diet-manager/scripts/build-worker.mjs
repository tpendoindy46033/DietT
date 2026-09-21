import { resolve } from "node:path";
import * as esbuild from "esbuild";
import { workerEntry, deployDir, rootDir } from "./paths.mjs";

export async function buildWorker() {
  const result = await esbuild.build({
    entryPoints: [workerEntry],
    bundle: true,
    outfile: resolve(deployDir, "_worker.js"),
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    sourcemap: false,
    conditions: ["worker", "browser"],
    alias: {
      "@shared": resolve(rootDir, "src/shared")
    },
    metafile: false,
    logLevel: "silent"
  });

  if (result.errors.length > 0) {
    throw new Error(`esbuild reported errors bundling the worker: ${JSON.stringify(result.errors)}`);
  }
  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.warn(`[esbuild] ${warning.text}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildWorker().then(() => console.log("Worker bundled to deploy-folder/_worker.js"));
}
