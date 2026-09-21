import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptsDir = dirname(fileURLToPath(import.meta.url));

export const rootDir = resolve(scriptsDir, "..");
export const srcDir = resolve(rootDir, "src");
export const workerEntry = resolve(srcDir, "worker", "index.ts");
export const frontendDistDir = resolve(rootDir, "dist-frontend");
export const deployDir = resolve(rootDir, "deploy-folder");
export const publicDir = resolve(rootDir, "public");
export const databaseDir = resolve(rootDir, "database");
export const nodeModulesDir = resolve(rootDir, "node_modules");
export const testsDir = resolve(rootDir, "tests");
