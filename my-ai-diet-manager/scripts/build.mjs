import { resolve } from "node:path";
import { build as viteBuild } from "vite";
import { rootDir } from "./paths.mjs";
import { clean } from "./clean.mjs";
import { typecheck } from "./typecheck.mjs";
import { buildWorker } from "./build-worker.mjs";
import { assembleDeployment } from "./assemble-deployment.mjs";
import { verifyDeployment } from "./verify-deployment.mjs";

async function main() {
  console.log("1/6 Cleaning previous build output...");
  await clean();

  console.log("2/6 Type-checking frontend...");
  await typecheck("frontend");

  console.log("3/6 Type-checking worker...");
  await typecheck("worker");

  console.log("4/6 Building frontend with Vite...");
  await viteBuild({ configFile: resolve(rootDir, "vite.config.ts"), logLevel: "warn" });

  console.log("5/6 Bundling worker with esbuild...");
  await buildWorker();

  console.log("Assembling deploy-folder...");
  await assembleDeployment();

  console.log("6/6 Verifying deployment output...");
  const result = await verifyDeployment();

  console.log(`Build complete. deploy-folder contains ${result.fileCount} files.`);
}

main().catch((err) => {
  console.error(err.stack ?? err.message);
  process.exit(1);
});
