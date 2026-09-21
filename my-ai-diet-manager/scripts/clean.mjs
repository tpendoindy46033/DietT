import { rm } from "node:fs/promises";
import { frontendDistDir, deployDir } from "./paths.mjs";

export async function clean() {
  await rm(frontendDistDir, { recursive: true, force: true });
  await rm(deployDir, { recursive: true, force: true });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  clean().then(() => console.log("Cleaned build outputs."));
}
