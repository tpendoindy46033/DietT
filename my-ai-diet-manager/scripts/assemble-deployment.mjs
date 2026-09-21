import { cp, mkdir } from "node:fs/promises";
import { deployDir, frontendDistDir, publicDir } from "./paths.mjs";
import { generateIcons } from "./generate-icons.mjs";

export async function assembleDeployment() {
  await mkdir(deployDir, { recursive: true });

  await generateIcons();

  // Vite output: index.html, /assets/*.js, /assets/*.css
  await cp(frontendDistDir, deployDir, { recursive: true });

  // Static PWA files: manifest, headers, icons (worker itself is copied separately by build-worker.mjs)
  await cp(publicDir, deployDir, { recursive: true });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  assembleDeployment().then(() => console.log("Assembled deploy-folder."));
}
